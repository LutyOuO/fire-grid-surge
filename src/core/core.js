(function () {
  'use strict';

  // 核心流程：唯一 Game 状态机/重启/更新/绘制入口；显式调用业务服务。
  var root = typeof window !== 'undefined' ? window : global;
  var CONFIG = root.CONFIG;
  root.G = {
    player: null,
    input: null,
    bag: null,
    wave: null,
    game: null,
    run: null,
    ui: null
  };
  var CanvasView = {
    canvas: null,
    ctx: null,
    init: function () {
      this.canvas = Platform.canvas;
      this.ctx = Platform.ctx;
      // 逻辑分辨率由 Platform 管理
    },
    clientToCanvas: function (clientX, clientY, outPoint) {
      // Platform 已在事件层完成坐标换算，这里直接透传
      outPoint.x = clientX;
      outPoint.y = clientY;
      return outPoint;
    }
  };
  var Camera = {
    x: 0,
    y: 0,
    // 屏幕抖动偏移由 UI.applyWorldShake 在世界绘制阶段统一应用。
    shakeX: 0,
    shakeY: 0,
    shakeTimer: 0,
    shakeSize: 4,
    startShake: function (size, duration) {
      this.shakeSize = size;
      this.shakeTimer = Math.max(this.shakeTimer, duration);
    },
    update: function (dt) {
      var targetX = Player.x - CONFIG.VIEW.WIDTH / 2;
      var targetY = Player.y - CONFIG.VIEW.HEIGHT / 2;
      var maxX = CONFIG.WORLD.WIDTH - CONFIG.VIEW.WIDTH;
      var maxY = CONFIG.WORLD.HEIGHT - CONFIG.VIEW.HEIGHT;
      this.x = Math.max(0, Math.min(maxX, targetX));
      this.y = Math.max(0, Math.min(maxY, targetY));
      // 抖动衰减与每帧随机偏移（不影响跟随目标）
      if (dt === undefined) dt = 0;
      if (this.shakeTimer > 0) {
        this.shakeTimer = Math.max(0, this.shakeTimer - dt);
        this.shakeX = (Math.random() * 2 - 1) * this.shakeSize;
        this.shakeY = (Math.random() * 2 - 1) * this.shakeSize;
      } else {
        this.shakeX = 0;
        this.shakeY = 0;
      }
    }
  };
  var DamageText = {
    pool: [],
    initPool: function () {
      this.pool.length = 0;
      for (var i = 0; i < CONFIG.DAMAGE_TEXT.POOL_SIZE; i++) {
        this.pool.push({
          active: false,
          x: 0,
          y: 0,
          life: 0,
          text: '',
          isCrit: false
        });
      }
    },
    reset: function () {
      for (var i = 0; i < this.pool.length; i++) this.pool[i].active = false;
    },
    spawn: function (x, y, damage, isCrit) {
      for (var i = 0; i < this.pool.length; i++) {
        var item = this.pool[i];
        if (!item.active) {
          item.active = true;
          item.x = x + (Math.random() * 2 - 1) * CONFIG.DAMAGE_TEXT.RANDOM_X;
          item.y = y;
          item.life = CONFIG.DAMAGE_TEXT.LIFE;
          item.isCrit = isCrit;
          item.text = (isCrit ? CONFIG.TEXT.CRIT_PREFIX : '') + Math.round(damage);
          return;
        }
      }
    },
    update: function (dt) {
      for (var i = 0; i < this.pool.length; i++) {
        var item = this.pool[i];
        if (!item.active) continue;
        item.life -= dt;
        item.y -= CONFIG.DAMAGE_TEXT.RISE_SPEED * dt;
        if (item.life <= 0) item.active = false;
      }
    },
    draw: function (ctx) {
      for (var i = 0; i < this.pool.length; i++) {
        var item = this.pool[i];
        if (!item.active) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, item.life / CONFIG.DAMAGE_TEXT.LIFE);
        ctx.font = 'bold ' + (item.isCrit ? CONFIG.DAMAGE_TEXT.CRIT_SIZE * (1 + CONFIG.POLISH.CRIT_POP * item.life / CONFIG.DAMAGE_TEXT.LIFE) : CONFIG.DAMAGE_TEXT.NORMAL_SIZE) + 'px Arial, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = item.isCrit ? CONFIG.COLORS.DAMAGE_CRIT : CONFIG.COLORS.DAMAGE_NORMAL;
        ctx.shadowColor = CONFIG.COLORS.TEXT_SHADOW;
        ctx.shadowBlur = CONFIG.DAMAGE_TEXT.SHADOW_BLUR;
        ctx.fillText(item.text, item.x - Camera.x, item.y - Camera.y);
        ctx.restore();
      }
    }
  };
  var Combat = {
    hitEnemy: function (enemy, baseDamage, hitX, hitY) {
      if (!enemy.active) return;
      var isCrit = Math.random() < Player.critChance;
      var permanentMultiplier = 1 + Meta.getEffectTotal('WEAPON_DAMAGE');
      var damage = baseDamage * permanentMultiplier * (1 + Player.globalDamageBonus) * (isCrit ? CONFIG.PLAYER.CRIT_MULTIPLIER + Player.critDamageBonus : 1);
      DamageText.spawn(hitX, hitY, damage, isCrit);
      Enemy.applyDamage(enemy, damage);
    },
    hitEnemyFixed: function (enemy, damage, hitX, hitY) {
      if (!enemy.active) return;
      DamageText.spawn(hitX, hitY, damage, false);
      Enemy.applyDamage(enemy, damage);
    }
  };
  var Game = {
    state: CONFIG.GAME.STATE_MENU,
    exitType: 'death',
    // 'death' | 'quit' | 'victory' | 'extract'
    survivedSeconds: 0,
    lastTimestamp: 0,
    boundLoop: null,
    _hidden: false,
    init: function () {
      Platform.init();
      CanvasView.init();
      Input.init();
      Enemy.initPool();
      root.FlameWeapon.init();
      root.Crossbow.init();
      root.MortarFX.init();
      root.MortarExplosionFX.init();
      if (root.TeslaArcFX) root.TeslaArcFX.init();
      if (root.FrostPatchFX) root.FrostPatchFX.init();
      root.Bullet.initPool();
      Experience.initPool();
      CoinDrops.initPool();
      PowerUps.initPool();
      DamageText.initPool();
      ExpLevelUp.init();
      Settings.load();
      Meta.load();
      this.bindLifecycle();
      this.enterMenu();
      this.boundLoop = this.loop.bind(this);
      requestAnimationFrame(this.boundLoop);
    },
    // 前后台生命周期（微信 wx.onShow/wx.onHide + H5 visibilitychange）
    bindLifecycle: function () {
      var self = this;
      Platform.onHide(function () {
        self._hidden = true;
        self.lastTimestamp = 0;
        Input.reset();
        if (Ads.active) Ads.cancel();
        // 战斗中切后台自动暂停
        if (self.state === CONFIG.GAME.STATE_PLAYING || self.state === CONFIG.GAME.STATE_LEVELUP) {
          if (root.Panels) root.Panels.pause();
        }
        Meta.markOfflineStart();
        if (AudioFX.ctx && AudioFX.ctx.suspend) {
          AudioFX.ctx.suspend().catch(function () {});
        }
      });
      Platform.onShow(function () {
        self._hidden = false;
        self.lastTimestamp = 0;
        Meta.handleReturnOnline();
        if (AudioFX.ctx && AudioFX.ctx.resume) {
          AudioFX.ctx.resume().catch(function () {});
        }
      });
    },
    enterMenu: function () {
      this.state = CONFIG.GAME.STATE_MENU;
      Input.reset();
      Input.setMovementEnabled(false);
    },
    enterBase: function () {
      root.CampNav.page = "select";
      root.Wardrobe.open = false;
      this.state = CONFIG.GAME.STATE_BASE;
      Input.clearTap();
      Input.setMovementEnabled(false);
    },
    restart: function () {
      root.WeaponProgress.selected = Meta.data.selectedWeapon || 'pistol';
      root.applyEquippedLooks();
      root.Field.reset();
      if (root.BattleEvents) root.BattleEvents.reset();
      FX.reset();
      this.state = CONFIG.GAME.STATE_PLAYING;
      this.exitType = 'death';
      this.survivedSeconds = 0;
      Player.reset();
      Enemy.reset();
      Weapons.reset();
      Spawner.reset();
      Experience.reset();
      CoinDrops.reset();
      PowerUps.reset();
      DamageText.reset();
      ExpLevelUp.reset();
      BossSystem.reset();
      RunStats.reset();
      LaserEmitter.reset();
      MortarStrike.reset();
      root.Extraction.reset();
      Input.reset();
      Input.setMovementEnabled(true);
      Camera.update();
      root.Objectives.reset();
      root.FlameWeapon.reset();
      root.Crossbow.reset();
      root.FlameWeapon.unlocked = root.WeaponProgress.selected === 'flamer';
      root.Crossbow.unlocked = root.WeaponProgress.selected === 'crossbow';
      root.NextRun.start();
    },
    loop: function (timestamp) {
      // 先预约下一帧，防止真机专属 API 偶发异常导致 requestAnimationFrame 永久中断。
      requestAnimationFrame(this.boundLoop);
      if (this.lastTimestamp === 0) {
        this.lastTimestamp = timestamp;
      }
      var rawDt = (timestamp - this.lastTimestamp) / 1000;
      var dt = Math.min(CONFIG.TIME.MAX_DT, Math.max(0, rawDt));
      this.lastTimestamp = timestamp;
      if (!this._hidden) {
        try {
          if (root.Metrics) root.Metrics.sample(dt);
          this.update(dt);
          this.draw();
        } catch (error) {
          this.runtimeError = error && error.stack ? error.stack : String(error);
          this.state = 'RUNTIME_ERROR';
          if (typeof console !== 'undefined' && console.error) console.error('[GAME LOOP]', error);
          Input.reset();
        }
      }
    },
    update: function (dt) {
      if (Ads.active) {
        Input.clearTap();
        return;
      }
      if (this.state === 'RUNTIME_ERROR') {
        if (Input.pendingTap.active) {
          Input.clearTap();
          this.runtimeError = '';
          this.enterMenu();
        }
        return;
      }
      if (root.DevConsole.handleInput() || root.DevConsole.open) return;
      if (this.state === 'WEAPON_SELECT') {
        root.WeaponSelect.update();
        return;
      }
      root.WeaponProgress.update(dt);
      root.Achievements.toastTime = Math.max(0, root.Achievements.toastTime - dt);
      root.RainbowFX.update(dt);
      if (this.state === 'ACHIEVEMENTS') {
        root.Achievements.handlePage();
        return;
      }
      if (this.state === 'FATE') {
        root.FateCards.update(dt);
        return;
      }
      var gameDt = dt * root.DevConsole.timeScale;
      FX.update(gameDt);
      if (this.state === 'PAUSED' || this.state === 'SETTINGS' || this.state === 'HELP') {
        Panels.update();
        return;
      }
      if (this.state === CONFIG.GAME.STATE_PLAYING && UI.consumePauseButton()) {
        Panels.pause();
        return;
      }
      if (this.state === CONFIG.GAME.STATE_PLAYING && root.Objectives.handle()) return;
      if (this.state === CONFIG.GAME.STATE_MENU && !Meta.offlinePopupActive && Input.pendingTap.active && UI.isPointInRect(Input.pendingTap, CONFIG.UI.MENU_BUTTON_X, CONFIG.POLISH.MENU_TOOL_Y, CONFIG.UI.MENU_BUTTON_WIDTH, CONFIG.UI.MENU_BUTTON_HEIGHT)) {
        Panels.open('SETTINGS');
        Input.clearTap();
        return;
      }
      Meta.update(gameDt);
      if (this.state === CONFIG.GAME.STATE_MENU) this.updateMenu();else if (this.state === CONFIG.GAME.STATE_BASE) this.updateBase(gameDt);else if (this.state === CONFIG.GAME.STATE_PLAYING) this.updatePlaying(gameDt);else if (this.state === CONFIG.GAME.STATE_LEVELUP) ExpLevelUp.handleInput();else if (this.state === CONFIG.GAME.STATE_GAMEOVER || this.state === CONFIG.GAME.STATE_VICTORY) this.updateSettlement(this.state === CONFIG.GAME.STATE_VICTORY);
      root.NextRun.update(gameDt);
      if (Spawner.waveIndex > FX.wave) {
        FX.wave = Spawner.waveIndex;
        FX.notice = CONFIG.POLISH.WAVE_NOTICE_TIME;
      }
    },
    updateSettlement: function (v) {
      var a = UI.consumeSettlementAction(v);
      if (a === 0) {
        root.FateCards.open();
        this.state = 'FATE';
      } else if (a === 4) root.FateCards.skip();else if (a === 1) this.requestAdRevive();else if (a === 2) this.requestCoinDouble(v);else if (a === 3) this.requestExtractQuad();
    },
    updateMenu: function () {
      if (Meta.offlinePopupActive) {
        var q = UI.consumeOfflineChoice();
        if (q === 0) Meta.claimOffline(false);else if (q === 1) Ads.showRewarded(CONFIG.ADS.PLACEMENT_OFFLINE_DOUBLE, function () {
          Meta.claimOffline(true);
        }, this.handleAdFail.bind(this));
        return;
      }
      var a = UI.consumeMenuAction();
      if (a === 0) {
        this.state = 'WEAPON_SELECT';
        Input.reset();
        Input.setMovementEnabled(false);
      } else if (a === 1) this.enterBase();else if (a === 2) {
        this.state = 'ACHIEVEMENTS';
        Input.reset();
        Input.setMovementEnabled(false);
        root.Achievements.page = 0;
        root.Achievements.category = 'all';
      } else if (a === 3 && Meta.isSpeedupReady()) Ads.showRewarded(CONFIG.ADS.PLACEMENT_SPEEDUP, function () {
        Meta.claimSpeedup();
      }, this.handleAdFail.bind(this));
    },
    updateBase: function (dt) {
      root.MenuController.updateBase.call(this, dt);
    },
    updatePlaying: function (dt) {
      // 撤离动画期间：游戏逻辑暂停，仅推进撤退动画
      if (root.Extraction.state === 'extracting') {
        root.Extraction.update(dt);
        return;
      }
      var hpBefore = Player.hp,
        killsBefore = RunStats.kills;
      this.survivedSeconds += dt;
      // 冲刺输入（先于道具按钮消费 tap）
      if (UI.consumeDashButton() && Player.canDash()) {
        Player.startDash();
      }
      // 撤退按钮输入
      UI.consumeExtractionAction();
      PowerUps.handleInput();
      if (this.state !== CONFIG.GAME.STATE_PLAYING) return;
      Player.update(dt);
      Camera.update(dt);
      Spawner.update(dt, this.survivedSeconds);
      root.Extraction.notifyWave(Spawner.waveIndex);
      root.Extraction.update(dt);
      BossSystem.update(this.survivedSeconds);
      Enemy.update(dt);
      Enemy.updateBossProjectiles(dt);
      Weapons.update(dt);
      LaserEmitter.update(dt);
      MortarStrike.update(dt);
      if (this.state !== CONFIG.GAME.STATE_PLAYING) return;
      Experience.update(dt);
      CoinDrops.update(dt);
      PowerUps.update(dt);
      DamageText.update(dt);
      Enemy.checkPlayerCollisions();
      if (Player.hp <= 0) {
        this.enterGameOver();
        return;
      }
      if (ExpLevelUp.hasPendingChoice()) {
        this.enterLevelUp();
      }
      if (this.state === CONFIG.GAME.STATE_PLAYING) {
        root.Field.update(dt);
        if (root.BattleEvents) root.BattleEvents.update(dt);
        root.FlameWeapon.update(dt);
        root.Crossbow.update(dt);
        var objectives = root.Objectives,
          achievements = root.Achievements;
        objectives.stats.kills = RunStats.kills;
        objectives.stats.level = ExpLevelUp.level;
        objectives.stats.wave = Spawner.waveIndex;
        objectives.update(dt);
        root.DiamondFX.update(dt);
        if (Player.hp < hpBefore) objectives.onDamage();
        if (RunStats.kills > killsBefore) achievements.add('kills', RunStats.kills - killsBefore);
        achievements.set('bestLevel', ExpLevelUp.level);
        achievements.set('bestWave', Spawner.waveIndex);
        achievements.set('safe', objectives.stats.safe);
      }
    },
    enterLevelUp: function () {
      FX.flash = CONFIG.POLISH.LEVEL_FLASH;
      AudioFX.play("level");
      this.state = CONFIG.GAME.STATE_LEVELUP;
      Input.setMovementEnabled(false);
      Input.clearTap();
      if (!ExpLevelUp.prepareOffers()) {
        ExpLevelUp.pendingChoices = 0;
        this.resumePlaying();
      }
    },
    requestLevelRefresh: function () {
      if (this.state === CONFIG.GAME.STATE_LEVELUP && !Ads.active && RunStats.freeRefreshUsed < CONFIG.PRODUCT.FREE_REFRESH) {
        if (ExpLevelUp.refreshOffersWithRareGuarantee()) RunStats.freeRefreshUsed++;
        Input.clearTap();
        return;
      }
      if (this.state !== CONFIG.GAME.STATE_LEVELUP || RunStats.getRefreshRemaining() <= 0) return;
      Ads.showRewarded(CONFIG.ADS.PLACEMENT_LEVEL_REFRESH, function () {
        if (Game.state !== CONFIG.GAME.STATE_LEVELUP || RunStats.getRefreshRemaining() <= 0) return;
        RunStats.adRefreshUsed += 1;
        ExpLevelUp.refreshOffersWithRareGuarantee();
        Input.clearTap();
      }, this.handleAdFail.bind(this));
    },
    onLevelChoiceResolved: function () {
      if (ExpLevelUp.hasPendingChoice()) {
        if (!ExpLevelUp.prepareOffers()) {
          ExpLevelUp.pendingChoices = 0;
          this.resumePlaying();
        }
        return;
      }
      this.resumePlaying();
    },
    resumePlaying: function () {
      this.state = CONFIG.GAME.STATE_PLAYING;
      Input.setMovementEnabled(true);
      Input.clearTap();
    },
    enterGameOver: function () {
      if (Player.reviveCharges > 0) {
        Player.reviveCharges -= 1;
        Player.hp = Math.max(1, Math.ceil(Player.maxHp * CONFIG.META.IMMORTAL_HP_RATIO));
        Player.invincibleTimer = CONFIG.META.IMMORTAL_INVINCIBLE_TIME;
        return;
      }
      this.exitType = 'death';
      this.state = CONFIG.GAME.STATE_GAMEOVER;
      Input.setMovementEnabled(false);
      Input.clearTap();
      this.commitSettlement(false);
    },
    enterVictory: function () {
      if (this.state === CONFIG.GAME.STATE_VICTORY) return;
      this.exitType = 'victory';
      this.state = CONFIG.GAME.STATE_VICTORY;
      Input.setMovementEnabled(false);
      Input.clearTap();
      this.commitSettlement(true);
    },
    commitSettlement: function (isVictory) {
      RunStats.calculateCoins(this.survivedSeconds, ExpLevelUp.level, isVictory);
      var newCoins = Math.max(0, RunStats.finalCoins - RunStats.committedCoins);
      Meta.settleRun(this.survivedSeconds, RunStats.kills, Spawner.waveIndex, newCoins, !RunStats.runCounted);
      RunStats.runCounted = true;
      RunStats.committedCoins = RunStats.finalCoins;
    },
    requestAdRevive: function () {
      if (this.state !== CONFIG.GAME.STATE_GAMEOVER || RunStats.getReviveRemaining() <= 0) return;
      Ads.showRewarded(CONFIG.ADS.PLACEMENT_REVIVE, function () {
        if (Game.state !== CONFIG.GAME.STATE_GAMEOVER || RunStats.getReviveRemaining() <= 0) return;
        RunStats.adReviveUsed += 1;
        Game.reviveAfterAd();
      }, this.handleAdFail.bind(this));
    },
    reviveAfterAd: function () {
      Player.hp = Math.max(1, Math.ceil(Player.maxHp * CONFIG.ADS.REVIVE_HP_RATIO));
      Player.invincibleTimer = CONFIG.ADS.REVIVE_INVINCIBLE_TIME;
      Enemy.clearScreenForRevive();
      root.Bullet.reset();
      DamageText.reset();
      this.state = CONFIG.GAME.STATE_PLAYING;
      Input.reset();
      Input.setMovementEnabled(true);
      Camera.update();
    },
    requestCoinDouble: function (isVictory) {
      if (this.state !== CONFIG.GAME.STATE_GAMEOVER && this.state !== CONFIG.GAME.STATE_VICTORY || !RunStats.canDoubleCoins()) return;
      Ads.showRewarded(CONFIG.ADS.PLACEMENT_COIN_DOUBLE, function () {
        if (!RunStats.canDoubleCoins()) return;
        RunStats.adCoinDoubleUsed += 1;
        RunStats.coinDoubleClaimed = true;
        Game.commitSettlement(isVictory);
      }, this.handleAdFail.bind(this));
    },
    requestExtractQuad: function () {
      if (this.state !== CONFIG.GAME.STATE_GAMEOVER || Game.exitType !== 'extract' || !RunStats.canExtractAdQuad()) return;
      Ads.showRewarded(CONFIG.ADS.PLACEMENT_COIN_DOUBLE, function () {
        if (!RunStats.canExtractAdQuad()) return;
        RunStats.extractAdClaimed = true;
        Game.commitSettlement(false);
      }, this.handleAdFail.bind(this));
    },
    handleAdFail: function (reason) {
      Meta.showToast(reason === 'wx_not_ready' ? CONFIG.TEXT.AD_WX_TODO : CONFIG.TEXT.AD_BUSY);
    },
    draw: function () {
      var ctx = CanvasView.ctx;
      ButtonUI.count = 0;
      Platform.beginFrame();
      ctx.save();
      try {
        if (this.state === 'WEAPON_SELECT') {
          root.WeaponSelect.draw(ctx);
          return;
        }
        if (this.state === 'PAUSED' || this.state === 'SETTINGS' || this.state === 'HELP') {
          Panels.draw(ctx);
          if (this.state === 'PAUSED' || Panels.parent === 'PAUSED') UI.drawBossBar(ctx, CONFIG.FIELD.BOSS_PANEL_Y);
          return;
        }
        if (this.state === 'RUNTIME_ERROR' || this.state === 'FATE' || this.state === 'ACHIEVEMENTS') {
          if (this.state === 'ACHIEVEMENTS') root.Achievements.drawPage(ctx);else root.MenuOverlay.draw(ctx);
          Ads.draw(ctx);
          return;
        }
        if (this.state === CONFIG.GAME.STATE_MENU || this.state === CONFIG.GAME.STATE_BASE) {
          if (this.state === CONFIG.GAME.STATE_MENU) {
            UI.drawMenu(ctx);
            if (!Meta.offlinePopupActive && !Ads.active) UI.drawActionButton(ctx, CONFIG.UI.MENU_BUTTON_X, CONFIG.POLISH.MENU_TOOL_Y, CONFIG.UI.MENU_BUTTON_WIDTH, CONFIG.UI.MENU_BUTTON_HEIGHT, CONFIG.TEXT.SETTINGS, true, 30);
          } else UI.drawBase(ctx);
          Ads.draw(ctx);
          if (!Ads.active) Metrics.draw(ctx);
          return;
        }
        root.BattleView.draw();
      } finally {
        ctx.restore();
        Platform.endFrame();
      }
    }
  };
  root.Game = Game;
  root.CanvasView = CanvasView;
  root.Camera = Camera;
  root.DamageText = DamageText;
  root.Combat = Combat;
  root.Game = Game;
  root.G.game = Game;
})();

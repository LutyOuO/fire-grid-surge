'use strict';
// ============================================================
// Game（游戏主循环与状态机）
// 主菜单 / 基地 / 战斗 / 升级 / 结算 / 胜利
// 微信下使用 Platform.beginFrame/endFrame 处理全屏清屏与等比变换
// 前后台使用 Platform.onShow/onHide（微信 wx.onShow/wx.onHide）
// ============================================================
var root = (typeof window !== 'undefined') ? window : global;
var CONFIG = root.CONFIG;
var Platform = root.Platform;
var CanvasView = root.CanvasView;
var Input = root.Input;
var Player = root.Player;
var Enemy = root.Enemy;
var Weapons = root.Weapons;
var Spawner = root.Spawner;
var BossSystem = root.BossSystem;
var RunStats = root.RunStats;
var Experience = root.Experience;
var ExpLevelUp = root.ExpLevelUp;
var CoinDrops = root.CoinDrops;
var PowerUps = root.PowerUps;
var DamageText = root.DamageText;
var Meta = root.Meta;
var Settings = root.Settings;
var Ads = root.Ads;
var AudioFX = root.AudioFX;
var Camera = root.Camera;
var UI = root.UI;

var Game = {
  state: CONFIG.GAME.STATE_MENU,
  exitType: 'death', // 'death' | 'quit' | 'victory' | 'extract'
  survivedSeconds: 0,
  lastTimestamp: 0,
  boundLoop: null,
  _hidden: false,

  init: function () {
    Platform.init();
    CanvasView.init();
    Input.init();
    Enemy.initPool();
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
    this.state = CONFIG.GAME.STATE_BASE;
    Input.clearTap();
    Input.setMovementEnabled(false);
  },

  restart: function () {
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
    Meta.update(dt);
    if (Ads.active) return;
    if (this.state === CONFIG.GAME.STATE_MENU) {
      this.updateMenu();
    } else if (this.state === CONFIG.GAME.STATE_BASE) {
      this.updateBase(dt);
    } else if (this.state === CONFIG.GAME.STATE_PLAYING) {
      this.updatePlaying(dt);
    } else if (this.state === CONFIG.GAME.STATE_LEVELUP) {
      ExpLevelUp.handleInput();
    } else if (this.state === CONFIG.GAME.STATE_GAMEOVER || this.state === CONFIG.GAME.STATE_VICTORY) {
      this.updateSettlement(this.state === CONFIG.GAME.STATE_VICTORY);
    }
  },

  updateSettlement: function (isVictory) {
    var action = UI.consumeSettlementAction(isVictory);
    if (action === 0) {
      this.enterMenu();
    } else if (action === 1) {
      this.requestAdRevive();
    } else if (action === 2) {
      this.requestCoinDouble(isVictory);
    } else if (action === 3) {
      this.requestExtractQuad();
    }
  },

  updateMenu: function () {
    if (Meta.offlinePopupActive) {
      var choice = UI.consumeOfflineChoice();
      if (choice === 0) {
        Meta.claimOffline(false);
      } else if (choice === 1) {
        Ads.showRewarded(
          CONFIG.ADS.PLACEMENT_OFFLINE_DOUBLE,
          function () { Meta.claimOffline(true); },
          this.handleAdFail.bind(this));
      }
      return;
    }
    var action = UI.consumeMenuAction();
    if (action === 0) {
      this.restart();
    } else if (action === 1) {
      this.enterBase();
    } else if (action === 2 && Meta.isSpeedupReady()) {
      Ads.showRewarded(
        CONFIG.ADS.PLACEMENT_SPEEDUP,
        function () { Meta.claimSpeedup(); },
        this.handleAdFail.bind(this));
    }
  },

  updateBase: function (dt) {
    if (dt === undefined) dt = 0;
    UI.updateBaseTab(dt);
    var action = UI.consumeBaseAction();
    if (action === -1) {
      this.enterMenu();
    } else if (action === 1001) {
      if (UI.baseTab !== 'character') { UI.baseTab = 'character'; UI.baseTabFade = 0; }
    } else if (action === 1002) {
      if (UI.baseTab !== 'gadget') { UI.baseTab = 'gadget'; UI.baseTabFade = 0; }
    } else if (action === 1010) {
      UI.baseCharacterPage = Math.max(0, UI.baseCharacterPage - 1);
      UI.baseTabFade = 0;
    } else if (action === 1011) {
      UI.baseCharacterPage += 1;
      UI.baseTabFade = 0;
    } else if (action === 1020) {
      UI.baseGadgetIndex = Math.max(0, UI.baseGadgetIndex - 1);
      UI.baseTabFade = 0;
    } else if (action === 1021) {
      UI.baseGadgetIndex += 1;
      UI.baseTabFade = 0;
    } else if (action >= 0 && action < CONFIG.META.UPGRADES.length) {
      Meta.buy(CONFIG.META.UPGRADES[action]);
    } else if (action >= 100 && action < 200) {
      // 道具升级：100 + gi*10 + ii
      var code = action - 100;
      var gi = Math.floor(code / 10);
      var ii = code % 10;
      var gadgetId = Object.keys(CONFIG.META.GADGET_UPGRADES)[gi];
      var itemId = CONFIG.META.GADGET_UPGRADES[gadgetId].items[ii].ID;
      Meta.buyGadget(gadgetId, itemId);
    }
  },

  updatePlaying: function (dt) {
    // 撤离动画期间：游戏逻辑暂停，仅推进撤退动画
    if (root.Extraction.state === 'extracting') {
      root.Extraction.update(dt);
      return;
    }
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
  },

  enterLevelUp: function () {
    this.state = CONFIG.GAME.STATE_LEVELUP;
    Input.setMovementEnabled(false);
    Input.clearTap();
    if (!ExpLevelUp.prepareOffers()) {
      ExpLevelUp.pendingChoices = 0;
      this.resumePlaying();
    }
  },

  requestLevelRefresh: function () {
    if (this.state !== CONFIG.GAME.STATE_LEVELUP || RunStats.getRefreshRemaining() <= 0) return;
    Ads.showRewarded(
      CONFIG.ADS.PLACEMENT_LEVEL_REFRESH,
      function () {
        if (Game.state !== CONFIG.GAME.STATE_LEVELUP || RunStats.getRefreshRemaining() <= 0) return;
        RunStats.adRefreshUsed += 1;
        ExpLevelUp.refreshOffersWithRareGuarantee();
        Input.clearTap();
      },
      this.handleAdFail.bind(this));
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
    Meta.settleRun(this.survivedSeconds, RunStats.kills, Spawner.waveIndex, newCoins);
    RunStats.committedCoins = RunStats.finalCoins;
  },

  requestAdRevive: function () {
    if (this.state !== CONFIG.GAME.STATE_GAMEOVER || RunStats.getReviveRemaining() <= 0) return;
    Ads.showRewarded(
      CONFIG.ADS.PLACEMENT_REVIVE,
      function () {
        if (Game.state !== CONFIG.GAME.STATE_GAMEOVER || RunStats.getReviveRemaining() <= 0) return;
        RunStats.adReviveUsed += 1;
        Game.reviveAfterAd();
      },
      this.handleAdFail.bind(this));
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
    if ((this.state !== CONFIG.GAME.STATE_GAMEOVER && this.state !== CONFIG.GAME.STATE_VICTORY) ||
        !RunStats.canDoubleCoins()) return;
    Ads.showRewarded(
      CONFIG.ADS.PLACEMENT_COIN_DOUBLE,
      function () {
        if (!RunStats.canDoubleCoins()) return;
        RunStats.adCoinDoubleUsed += 1;
        RunStats.coinDoubleClaimed = true;
        Game.commitSettlement(isVictory);
      },
      this.handleAdFail.bind(this));
  },

  requestExtractQuad: function () {
    if (this.state !== CONFIG.GAME.STATE_GAMEOVER || Game.exitType !== 'extract' ||
        !RunStats.canExtractAdQuad()) return;
    Ads.showRewarded(
      CONFIG.ADS.PLACEMENT_COIN_DOUBLE,
      function () {
        if (!RunStats.canExtractAdQuad()) return;
        RunStats.extractAdClaimed = true;
        Game.commitSettlement(false);
      },
      this.handleAdFail.bind(this));
  },

  handleAdFail: function (reason) {
    Meta.showToast(reason === 'wx_not_ready' ? CONFIG.TEXT.AD_WX_TODO : CONFIG.TEXT.AD_BUSY);
  },

  draw: function () {
    var ctx = CanvasView.ctx;
    Platform.beginFrame();

    if (this.state === CONFIG.GAME.STATE_MENU) {
      UI.drawMenu(ctx);
      Ads.draw(ctx);
      Platform.endFrame();
      return;
    }
    if (this.state === CONFIG.GAME.STATE_BASE) {
      UI.drawBase(ctx);
      Ads.draw(ctx);
      Platform.endFrame();
      return;
    }

    UI.drawGround(ctx);
    Experience.draw(ctx);
    CoinDrops.draw(ctx);
    PowerUps.drawWorldItems(ctx);
    Enemy.draw(ctx);
    Weapons.draw(ctx);
    Player.draw(ctx);
    DamageText.draw(ctx);
    UI.drawHud(ctx);

    if (this.state === CONFIG.GAME.STATE_PLAYING) {
      UI.drawJoystick(ctx);
      UI.drawPowerUpButtons(ctx);
    } else if (this.state === CONFIG.GAME.STATE_LEVELUP) {
      UI.drawLevelUp(ctx);
    } else if (this.state === CONFIG.GAME.STATE_GAMEOVER) {
      UI.drawGameOver(ctx);
    } else if (this.state === CONFIG.GAME.STATE_VICTORY) {
      UI.drawVictory(ctx);
    }
    Ads.draw(ctx);

    Platform.endFrame();
  }
};

root.Game = Game;

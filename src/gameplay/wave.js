(function () {
  'use strict';

  // 刷怪：唯一 Spawner，波次配额、精英和每十波 Boss。
  var root = typeof window !== 'undefined' ? window : global;
  var CONFIG = root.CONFIG;
  var Spawner = {
    normalTimer: CONFIG.SPAWNER.FIRST_SPAWN_DELAY,
    waveTimer: CONFIG.SPAWNER.WAVE_INTERVAL,
    eliteTimer: CONFIG.SPAWNER.ELITE_INTERVAL,
    waveIndex: 0,
    extractionSurge: false,
    // v014 #94 战斗阶段机：normal/elite/dominant/boss/lull 循环。
    phase: 'normal',
    phaseIndex: 0,
    phaseTimer: CONFIG.WAVE.PHASES.normal.dur,
    reset: function () {
      this.waveIndex = 0;
      this.bossPending = false;
      this.extractionSurge = false;
      this.waveBossSpawned = false;
      this.bossRemaining = 0;
      this.rangedPending = false;
      this.waveRangedSpawned = false;
      this.theme = null;
      this.pressureWait = 0;
      this.normalTimer = 0;
      this.waveRest = 2;
      this.waveQuota = 0;
      this.eliteQuota = 0;
      this.eliteTimer = 60;
      this.phase = 'normal';
      this.phaseIndex = 0;
      this.phaseTimer = CONFIG.WAVE.PHASES.normal.dur;
    },
    update: function (dt, elapsed) {
      this.updatePhase(dt);
      this.updateQuota(dt, elapsed);
      if (this.bossPending && this.bossRemaining > 0) {
        if (Enemy.activeCount >= CONFIG.ENEMY.POOL_SIZE) Enemy.recycleOneNonBoss();
        var b = this.spawnType(CONFIG.ENEMY.TYPE_BOSS, elapsed);
        if (b) {
          this.bossRemaining -= 1;
          this.waveBossSpawned = this.bossRemaining <= 0;
          this.bossPending = this.bossRemaining > 0;
        }
      }
      if (this.rangedPending && !this.waveRangedSpawned) {
        if (Enemy.activeCount >= CONFIG.ENEMY.POOL_SIZE) Enemy.recycleOneNonBoss();
        var r = this.spawnType(CONFIG.ENEMY.TYPE_BOSS_RANGED, elapsed);
        if (r) {
          if (this.waveIndex % CONFIG.BALANCE.DUAL_BOSS_WAVE === 0) {
            r.maxHp = Math.ceil(r.maxHp * CONFIG.BALANCE.DUAL_RANGED_HP);
            r.hp = r.maxHp;
          }
          this.waveRangedSpawned = true;
          this.rangedPending = false;
        }
      }
    },
    getHpMultiplier: function () {
      var w = Math.max(1, this.waveIndex),
        m = 1 + w * CONFIG.BALANCE.HP_PER_WAVE;
      if (w >= CONFIG.BALANCE.LATE_WAVE) m *= CONFIG.BALANCE.LATE_HP;
      return m;
    },
    getSpawnInterval: function (t) {
      var iv = Math.max(.25, 1.2 - t / 200);
      var theme = this.theme && CONFIG.WAVE_THEMES.KINDS[this.theme];
      if (theme && theme.INTERVAL) iv *= theme.INTERVAL;
      return iv;
    },
    // v014 #94 战斗阶段机：按 PHASE_ORDER 循环 normal→elite→dominant→boss→lull。
    // 时长与配额倍率均在 CONFIG.WAVE.PHASES；quota 作用于刷怪间隔（间隔/quota），
    // 与 extractionSurge ×2 相乘兼容（extractionSurge 在 beginWave 乘总配额，这里乘节奏）。
    getPhaseDef: function () {
      return CONFIG.WAVE.PHASES[this.phase] || CONFIG.WAVE.PHASES.normal;
    },
    getPhaseQuota: function () {
      var q = this.getPhaseDef().quota;
      return q > 0 ? q : 1;
    },
    advancePhase: function () {
      this.phaseIndex = (this.phaseIndex + 1) % CONFIG.WAVE.PHASE_ORDER.length;
      this.phase = CONFIG.WAVE.PHASE_ORDER[this.phaseIndex];
      this.phaseTimer = this.getPhaseDef().dur;
      // 精英阶段补一只精英，要求改路线；notable 阶段（精英/BOSS/整理）播横幅，普通/占优不刷屏。
      if (this.phase === 'elite') {
        if (Enemy.activeCount < CONFIG.ENEMY.POOL_SIZE) this.spawnType(CONFIG.ENEMY.TYPE_ELITE, Game.survivedSeconds);
        this.phaseBanner(CONFIG.TEXT.PHASE_ELITE);
      } else if (this.phase === 'boss') {
        this.phaseBanner(CONFIG.TEXT.PHASE_BOSS);
      } else if (this.phase === 'lull') {
        this.phaseBanner(CONFIG.TEXT.PHASE_LULL);
      }
    },
    phaseBanner: function (text) {
      if (root.Field) {
        root.Field.eventBanner = text;
        root.Field.eventBannerTimer = CONFIG.POLISH.WAVE_NOTICE_TIME;
      }
    },
    updatePhase: function (dt) {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.advancePhase();
    },
    spawnNormal: function (elapsedSeconds) {
      return this.spawnType(this.rollNormalType(), elapsedSeconds);
    },
    normalWeights: function () {
      var f = Math.min(1, this.waveIndex / 15),
        w = 7 - 2 * f,
        r = 2 + f,
        t = 1 + f;
      var theme = this.theme && CONFIG.WAVE_THEMES.KINDS[this.theme];
      if (theme) {
        if (theme.WALKER) w *= theme.WALKER;
        if (theme.RUNNER) r *= theme.RUNNER;
        if (theme.TANK) t *= theme.TANK;
      }
      return { walker: w, runner: r, tank: t };
    },
    rollNormalType: function () {
      var wts = this.normalWeights();
      var n = Math.random() * (wts.walker + wts.runner + wts.tank);
      return n < wts.walker ? CONFIG.ENEMY.TYPE_WALKER : n < wts.walker + wts.runner ? CONFIG.ENEMY.TYPE_RUNNER : CONFIG.ENEMY.TYPE_TANK;
    },
    spawnType: function (typeIndex, elapsedSeconds) {
      if (Enemy.activeCount >= CONFIG.ENEMY.POOL_SIZE) return null;
      var firstSide = Math.floor(Math.random() * 4);
      for (var offset = 0; offset < 4; offset++) {
        var side = (firstSide + offset) % 4;
        var enemy = this.trySpawnOnSide(side, typeIndex, elapsedSeconds);
        if (enemy) return enemy;
      }
      return null;
    },
    trySpawnOnSide: function (side, typeIndex, elapsedSeconds) {
      var margin = CONFIG.CAMERA.SPAWN_BUFFER;
      var radius = CONFIG.ENEMY.TYPES[typeIndex].RADIUS;
      var hw = CONFIG.VIEW.WIDTH / (2 * Camera.zoom), hh = CONFIG.VIEW.HEIGHT / (2 * Camera.zoom);
      var x = 0,
        y = 0;
      if (side === 0 && Camera.cy - hh - margin >= radius) {
        x = Camera.cx + (Math.random() * 2 - 1) * hw;
        y = Camera.cy - hh - margin;
      } else if (side === 1 && Camera.cx + hw + margin <= CONFIG.WORLD.WIDTH - radius) {
        x = Camera.cx + hw + margin;
        y = Camera.cy + (Math.random() * 2 - 1) * hh;
      } else if (side === 2 && Camera.cy + hh + margin <= CONFIG.WORLD.HEIGHT - radius) {
        x = Camera.cx + (Math.random() * 2 - 1) * hw;
        y = Camera.cy + hh + margin;
      } else if (side === 3 && Camera.cx - hw - margin >= radius) {
        x = Camera.cx - hw - margin;
        y = Camera.cy + (Math.random() * 2 - 1) * hh;
      } else {
        return null;
      }
      x = Math.max(radius, Math.min(CONFIG.WORLD.WIDTH - radius, x));
      y = Math.max(radius, Math.min(CONFIG.WORLD.HEIGHT - radius, y));
      return Enemy.spawn(x, y, typeIndex, this.getHpMultiplier(elapsedSeconds));
    },
    // 每波创建配额；十波 Boss 独立记账。
    beginWave: function () {
      this.waveIndex++;
      this.waveBossSpawned = false;
      this.waveRangedSpawned = false;
      this.theme = null;
      // v012 #73 撤离激活后难度惩罚：刷怪配额 ×SPAWN_QUOTA_MULT（按波重算，激活后的新一波生效）。
      var quotaMul = this.extractionSurge ? CONFIG.EXTRACTION.SPAWN_QUOTA_MULT : 1;
      this.waveQuota = Math.floor((8 + this.waveIndex * 4) * quotaMul);
      this.eliteQuota = Math.floor((this.waveIndex >= 3 ? 1 + Math.floor((this.waveIndex - 3) / 2) : 0) * quotaMul);
      this.normalTimer = 0;
      if (root.FX) {
        root.FX.wave = this.waveIndex - 1;
      }
      this.bossPending = this.waveIndex % CONFIG.BALANCE.BOSS_EVERY === 0;
      this.bossRemaining = this.bossPending ? Math.max(1, Math.min(CONFIG.BALANCE.BOSS_MAX_COUNT, Math.round(this.waveIndex / CONFIG.BALANCE.BOSS_COUNT_DIVISOR))) : 0;
      this.rangedPending = this.waveIndex % CONFIG.BALANCE.DUAL_BOSS_WAVE === 0;
      if (this.bossPending) this.waveQuota = Math.max(4, Math.floor(this.waveQuota * CONFIG.BALANCE.BOSS_NORMAL_QUOTA_RATIO));
      var themed = CONFIG.WAVE_THEMES && CONFIG.WAVE_THEMES.WAVES;
      if (themed && themed.indexOf(this.waveIndex) >= 0) {
        var ids = Object.keys(CONFIG.WAVE_THEMES.KINDS);
        this.theme = ids[Math.floor(Math.random() * ids.length)];
        var def = CONFIG.WAVE_THEMES.KINDS[this.theme];
        if (def && def.ELITE) this.eliteQuota += def.ELITE;
      }
    },
    // 单帧最多补发8只，避免恢复前台瞬间刷爆。
    updateQuota: function (dt, elapsed) {
      if (this.waveRest > 0) {
        this.waveRest -= dt;
        if (this.waveRest <= 0) this.beginWave();
        return;
      }
      this.normalTimer -= dt;
      var guard = 8;
      while (this.waveQuota > 0 && this.normalTimer <= 0 && Enemy.activeCount < CONFIG.ENEMY.POOL_SIZE && guard-- > 0) {
        if (this.spawnNormal(elapsed)) this.waveQuota--;
        // v014 #94 阶段配额倍率：间隔 / quota（boss 阶段 1.5x 更快，lull 0.3x 放慢喘息）。
        this.normalTimer += this.getSpawnInterval(elapsed) / this.getPhaseQuota();
      }
      if (this.eliteQuota > 0 && Enemy.activeCount < CONFIG.ENEMY.POOL_SIZE) {
        if (this.spawnType(CONFIG.ENEMY.TYPE_ELITE, elapsed)) this.eliteQuota--;
      }
      this.eliteTimer -= dt;
      if (this.eliteTimer <= 0) {
        if (Enemy.activeCount < CONFIG.ENEMY.POOL_SIZE) this.spawnType(CONFIG.ENEMY.TYPE_ELITE, elapsed);
        this.eliteTimer = 60;
      }
      if (this.waveQuota <= 0 && this.eliteQuota <= 0) {
        this.pressureWait += dt;
        if (Enemy.activeCount <= CONFIG.PRODUCT.WAVE_REMAINING || this.pressureWait >= CONFIG.PRODUCT.WAVE_MAX_WAIT) {
          this.waveRest = CONFIG.PRODUCT.WAVE_REST;
          this.pressureWait = 0;
        }
      }
    }
  };
  root.Spawner = Spawner;
  root.G.wave = Spawner;
  var BattleEvents = {
    timer: 0,
    active: null,
    airdropCount: 0,
    lastAirdropWave: 0,
    nextAirdropGap: 2,
    seen: {},
    reset: function () {
      this.timer = CONFIG.EVENTS.FIRST_DELAY;
      this.firstRun = (Meta.data.runs || 0) === 0;
      this.guided = false;
      if (this.firstRun) this.timer = CONFIG.PRODUCT.FIRST_EVENT;
      this.active = null;
      this.airdropCount = 0;
      // v012 #76 空投改为按波次触发：上一次空投所在波 + 随机间隔(2~3 波)后下一个。
      this.lastAirdropWave = 0;
      this.nextAirdropGap = 2;
      this.seen = {};
    },
    banner: function (text) {
      if (root.Field) {
        Field.eventBanner = text;
        Field.eventBannerTimer = 2.2;
      }
    },
    update: function (dt) {
      if (this.firstRun && !this.guided && Game.survivedSeconds >= CONFIG.PRODUCT.ONBOARD_TIME) {
        this.guided = true;
        this.banner(CONFIG.TEXT.PRODUCT.FIRST);
      }
      if (this.active) {
        this.active.t -= dt;
        this.tickActive(dt);
        if (this.active.t <= 0) {
          this.active = null;
          this.timer = CONFIG.EVENTS.INTERVAL_MIN + Math.random() * (CONFIG.EVENTS.INTERVAL_MAX - CONFIG.EVENTS.INTERVAL_MIN);
        }
        return;
      }
      // v012 #76 空投走与同类事件相同的 BattleEvents 调度链：这里轮询 Spawner.waveIndex，不另起平行系统。
      this.pollAirdropWave();
      this.timer -= dt;
      if (this.timer <= 0) this.roll();
    },
    // 每 2~3 波在随机位置投一个空投（间隔进 CONFIG.EVENTS.KINDS.airdrop）。
    pollAirdropWave: function () {
      var def = CONFIG.EVENTS.KINDS.airdrop;
      var wave = Spawner.waveIndex;
      if (wave < (def.FIRST_WAVE || def.MIN_WAVE)) return;
      if (this.airdropCount >= def.MAX_PER_RUN) return;
      if (this.lastAirdropWave > 0 && wave - this.lastAirdropWave < this.nextAirdropGap) return;
      this.start('airdrop');
      this.lastAirdropWave = wave;
      this.nextAirdropGap = def.WAVE_EVERY_MIN + Math.floor(Math.random() * (def.WAVE_EVERY_MAX - def.WAVE_EVERY_MIN + 1));
    },
    roll: function () {
      var wave = Spawner.waveIndex;
      var pool = [];
      var kinds = CONFIG.EVENTS.KINDS;
      for (var id in kinds) {
        var def = kinds[id];
        if (wave < def.MIN_WAVE) continue;
        // v012 #76 空投已改为波次触发（WEIGHT=0），不再走计时器加权池。
        if (id === 'airdrop') continue;
        for (var w = 0; w < (def.WEIGHT || 1); w++) pool.push(id);
      }
      if (!pool.length) {
        this.timer = CONFIG.EVENTS.INTERVAL_MIN;
        return;
      }
      this.start(pool[Math.floor(Math.random() * pool.length)]);
    },
    start: function (id) {
      var def = CONFIG.EVENTS.KINDS[id];
      if (!def) return;
      this.active = { id: id, t: def.DURATION, land: def.LAND || 0, opened: false, landedFx: false };
      this.active.warning = id === 'grid_surge' ? CONFIG.PRODUCT.GRID_WARNING : 0;
      this.active.t += this.active.warning;
      this.seen[id] = true;
      this.banner(def.BANNER);
      if (id === 'airdrop') {
        this.airdropCount++;
        var pos = this.randomClear(80);
        this.active.x = pos.x;
        this.active.y = pos.y;
        this.active.charge = 0;
        if (root.AudioFX) root.AudioFX.play('airdrop_warn');
        // v012 #76：落点附近刷新 GUARD_COUNT 个守护敌人。
        var guards = def.GUARD_COUNT || 0;
        for (var gi = 0; gi < guards; gi++) {
          if (Enemy.activeCount >= CONFIG.ENEMY.POOL_SIZE) break;
          var gAng = Math.random() * Math.PI * 2;
          var gDist = 130 + Math.random() * 170;
          var gx = pos.x + Math.cos(gAng) * gDist;
          var gy = pos.y + Math.sin(gAng) * gDist;
          Enemy.spawn(gx, gy, CONFIG.ENEMY.TYPE_WALKER, Spawner.getHpMultiplier());
        }
        this.banner(CONFIG.TEXT.PRODUCT.AIRDROP_MARKED);
        if (root.Settings && root.Settings.shake) Camera.startShake(def.LAND_SHAKE * 0.65, def.LAND_SHAKE_TIME);
      } else if (id === 'elite_rush') {
        for (var i = 0; i < def.EXTRA_ELITES; i++) Spawner.spawnType(CONFIG.ENEMY.TYPE_ELITE, Game.survivedSeconds);
        // v014 #97 精英狂潮开始提示
        this.banner(CONFIG.TEXT.PRODUCT.ELITE_RUSH_START);
      } else if (id === 'grid_surge') {
        this.banner(CONFIG.TEXT.PRODUCT.GRID_WARN);
        this.active.strips = [];
        for (var s = 0; s < def.STRIPS; s++) {
          var axis = Math.random() < 0.5 ? 'x' : 'y';
          var max = axis === 'x' ? CONFIG.WORLD.WIDTH : CONFIG.WORLD.HEIGHT;
          this.active.strips.push({ axis: axis, pos: 200 + Math.random() * (max - 400) });
        }
      }
    },
    randomClear: function (r) {
      for (var n = 0; n < 12; n++) {
        var x = 200 + Math.random() * (CONFIG.WORLD.WIDTH - 400);
        var y = 200 + Math.random() * (CONFIG.WORLD.HEIGHT - 400);
        if (!root.WallCollision.inside(x, y, r)) return { x: x, y: y };
      }
      return { x: CONFIG.WORLD.WIDTH / 2, y: CONFIG.WORLD.HEIGHT / 2 };
    },
    // v012 #76 空投奖励：局内金币 GOLD_MIN~MAX（走 CoinDrops，分 COIN_SPLIT 枚）+ 随机主动道具 ITEM_MIN~MAX 个（走 PowerUps）。
    grantAirdrop: function (ev, def) {
      var gold = def.GOLD_MIN + Math.floor(Math.random() * (def.GOLD_MAX - def.GOLD_MIN + 1));
      var split = Math.max(1, def.COIN_SPLIT || 5);
      var per = Math.max(1, Math.round(gold / split));
      var given = 0;
      for (var i = 0; i < split && given < gold; i++) {
        var v = Math.min(per, gold - given);
        root.CoinDrops.drop(ev.x + (Math.random() * 2 - 1) * 55, ev.y + (Math.random() * 2 - 1) * 55, v);
        given += v;
      }
      var items = def.ITEM_MIN + Math.floor(Math.random() * (def.ITEM_MAX - def.ITEM_MIN + 1));
      for (var j = 0; j < items; j++) {
        root.PowerUps.dropRandom(ev.x + (Math.random() * 2 - 1) * 60, ev.y + (Math.random() * 2 - 1) * 60);
      }
      if (root.FX) root.FX.burst(ev.x, ev.y, CONFIG.COLORS.AIRDROP);
    },
    tickActive: function (dt) {
      var ev = this.active, def = CONFIG.EVENTS.KINDS[ev.id];
      if (ev.warning > 0) { ev.warning = Math.max(0, ev.warning - dt); return; }
      if (ev.id === 'airdrop') {
        // v012 #76：落地（下落动画 LAND 秒）后，玩家进入 ACTIVATE_RADIUS 站立 CHARGE_TIME 秒即激活。
        var landed = ev.t <= def.DURATION - def.LAND;
        if (!landed) {
          ev.charge = 0;
          return;
        }
        if (!ev.landedFx) {
          ev.landedFx = true;
          if (root.AudioFX) root.AudioFX.play('airdrop_land');
          if (root.Settings.shake) Camera.startShake(def.LAND_SHAKE, def.LAND_SHAKE_TIME);
          this.banner(CONFIG.TEXT.PRODUCT.AIRDROP_MARKED);
        }
        ev.opened = true;
        var dx = Player.x - ev.x,
          dy = Player.y - ev.y;
        var inRange = dx * dx + dy * dy <= def.ACTIVATE_RADIUS * def.ACTIVATE_RADIUS;
        if (inRange) {
          ev.charge += dt;
          if (ev.charge >= def.CHARGE_TIME) {
            this.grantAirdrop(ev, def);
            ev.t = 0;
          }
        } else {
          ev.charge = Math.max(0, ev.charge - dt * 2);
        }
      } else if (ev.id === 'grid_surge') {
        var w = def.WIDTH / 2, dps = def.DPS * dt;
        var hurt = function (ent) {
          if (ev.strips[0].axis === 'x') {
            if (Math.abs(ent.x - ev.strips[0].pos) <= w + (ent.radius || 0)) return true;
          } else if (Math.abs(ent.y - ev.strips[0].pos) <= w + (ent.radius || 0)) return true;
          if (ev.strips[1]) {
            if (ev.strips[1].axis === 'x') return Math.abs(ent.x - ev.strips[1].pos) <= w + (ent.radius || 0);
            return Math.abs(ent.y - ev.strips[1].pos) <= w + (ent.radius || 0);
          }
          return false;
        };
        if (hurt(Player)) Player.takeDamage(dps, 'event', true);
        for (var i = 0; i < Enemy.pool.length; i++) {
          var e = Enemy.pool[i];
          if (e.active && hurt(e)) Enemy.applyDamage(e, dps);
        }
      } else if (ev.id === 'sanctuary') {
        var ex = CONFIG.EXTRACTION, dx = Player.x - ex.X, dy = Player.y - ex.Y;
        if (dx * dx + dy * dy <= ex.RADIUS * ex.RADIUS) {
          Player.hp = Math.min(Player.maxHp, Player.hp + def.HEAL * dt);
        }
      }
    },
    draw: function (ctx) {
      var ev = this.active;
      if (!ev) return;
      if (ev.id === 'airdrop') {
        var def = CONFIG.EVENTS.KINDS.airdrop;
        var sx = ev.x - Camera.x,
          sy = ev.y - Camera.y;
        ctx.save();
        ctx.strokeStyle = CONFIG.COLORS.AIRDROP;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.85;
        var beam = ctx.createLinearGradient(sx, sy - def.BEAM_HEIGHT, sx, sy + 20);
        root.safeStop(beam, 0, 'rgba(255,158,48,0)'); root.safeStop(beam, 0.72, 'rgba(255,158,48,.18)'); root.safeStop(beam, 1, 'rgba(255,202,100,.64)');
        ctx.fillStyle = beam;
        ctx.fillRect(sx - def.BEAM_WIDTH / 2, sy - def.BEAM_HEIGHT, def.BEAM_WIDTH, def.BEAM_HEIGHT + 20);
        // v012 #76：激活范围圈（站立 CHARGE_TIME 秒）。
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(sx, sy, def.ACTIVATE_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = ev.opened ? '#e9ad58' : '#8a6a32';
        ctx.fillRect(sx - 20, sy - 20, 40, 40);
        var dropIcon = root.UI && root.UI.icon('icon_airdrop');
        if (dropIcon && Camera.isVisible(ev.x, ev.y, 32)) ctx.drawImage(dropIcon, sx - 22, sy - 22, 44, 44);
        // 站立充能进度环
        if (ev.opened && ev.charge > 0) {
          var prog = Math.min(1, ev.charge / def.CHARGE_TIME);
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#fff1d0';
          ctx.beginPath();
          ctx.arc(sx, sy, 46, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      } else if (ev.id === 'grid_surge' && ev.strips) {
        ctx.save();
        ctx.fillStyle = ev.warning > 0 ? 'rgba(233,173,88,0.18)' : 'rgba(90,212,230,0.22)';
        for (var i = 0; i < ev.strips.length; i++) {
          var s = ev.strips[i], w = CONFIG.EVENTS.KINDS.grid_surge.WIDTH;
          if (s.axis === 'x') ctx.fillRect(s.pos - w / 2 - Camera.x, -Camera.y, w, CONFIG.WORLD.HEIGHT);
          else ctx.fillRect(-Camera.x, s.pos - w / 2 - Camera.y, CONFIG.WORLD.WIDTH, w);
        }
        ctx.restore();
      } else if (ev.id === 'sanctuary') {
        ctx.save();
        ctx.strokeStyle = 'rgba(125,179,146,0.7)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(CONFIG.EXTRACTION.X - Camera.x, CONFIG.EXTRACTION.Y - Camera.y, CONFIG.EXTRACTION.RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        // v014 #97 靠近净化区提示：进入外围 2.2 倍半径时显示一句风险提示。
        var sdx = Player.x - CONFIG.EXTRACTION.X, sdy = Player.y - CONFIG.EXTRACTION.Y;
        var nearR = CONFIG.EXTRACTION.RADIUS * 2.2;
        if (sdx * sdx + sdy * sdy <= nearR * nearR) {
          ctx.font = 'bold 18px Arial, "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#7dd39a';
          ctx.fillText(CONFIG.TEXT.PRODUCT.SANCTUARY_NEAR, CONFIG.VIEW.WIDTH / 2, 196);
        }
        ctx.restore();
      } else if (ev.id === 'elite_rush') {
        ctx.save();
        ctx.strokeStyle = 'rgba(233,173,88,0.35)';
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 2;
        for (var i = 0; i < Enemy.pool.length; i++) {
          var e = Enemy.pool[i];
          if (!e.active || e.typeIndex !== CONFIG.ENEMY.TYPE_ELITE) continue;
          ctx.beginPath();
          ctx.arc(e.x - Camera.x, e.y - Camera.y, e.radius + 8, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    },
    // v012 #76：空投在屏幕外时，在屏幕边缘画指向箭头（世界坐标投影到边缘，避开 HUD/操作区）。
    drawEdgeArrow: function (ctx) {
      var ev = this.active;
      if (!ev || ev.id !== 'airdrop') return;
      var x = Camera.worldToScreenX(ev.x), y = Camera.worldToScreenY(ev.y);
      var def = CONFIG.EVENTS.KINDS.airdrop, m = def.GUIDE_MARGIN;
      var top = Math.max(m, CONFIG.PRODUCT.GUIDE_TOP), bottom = Math.max(m, CONFIG.PRODUCT.GUIDE_BOTTOM);
      // 已在屏内可见区则不画。
      if (x > m && x < CONFIG.VIEW.WIDTH - m && y > top && y < CONFIG.VIEW.HEIGHT - bottom) return;
      var cx = CONFIG.VIEW.WIDTH / 2, cy = CONFIG.VIEW.HEIGHT / 2, dx = x - cx, dy = y - cy;
      var tx = Math.abs(dx) > .001 ? (CONFIG.VIEW.WIDTH / 2 - m) / Math.abs(dx) : Infinity;
      var ty = Math.abs(dy) > .001 ? (CONFIG.VIEW.HEIGHT / 2 - Math.max(top, bottom)) / Math.abs(dy) : Infinity;
      var scale = Math.min(tx, ty), px = cx + dx * scale, py = cy + dy * scale;
      ctx.save();
      ctx.fillStyle = CONFIG.COLORS.AIRDROP;
      ctx.translate(px, py);
      ctx.rotate(Math.atan2(y - py, x - px));
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-9, -9);
      ctx.lineTo(-9, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // v014 #97 空投靠近前屏幕边缘文字提示（正立，不随箭头旋转）。
      ctx.save();
      ctx.translate(px, py);
      ctx.fillStyle = '#17201d'; ctx.strokeStyle = CONFIG.COLORS.AIRDROP; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      var icon = root.UI && root.UI.icon('icon_airdrop');
      if (icon) ctx.drawImage(icon, -16, -16, 32, 32); else { ctx.fillStyle = CONFIG.COLORS.AIRDROP; ctx.fillRect(-7, -2, 14, 4); ctx.fillRect(-2, -7, 4, 14); }
      ctx.restore();
      ctx.save();
      ctx.font = 'bold 18px Arial, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CONFIG.COLORS.AIRDROP;
      var worldDx = ev.x - Player.x, worldDy = ev.y - Player.y;
      ctx.fillText(CONFIG.TEXT.PRODUCT.AIRDROP_DISTANCE(Math.round(Math.sqrt(worldDx * worldDx + worldDy * worldDy))), px, py + 26);
      ctx.restore();
    },
    drawBanner: function (ctx) {
      if (!root.Field || Field.eventBannerTimer <= 0 || !Field.eventBanner) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Field.eventBannerTimer);
      ctx.fillStyle = 'rgba(8,12,14,0.72)';
      var w = 520, h = 44, x = (CONFIG.VIEW.WIDTH - w) / 2, y = 118;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = CONFIG.COLORS.TESLA;
      ctx.font = 'bold 22px Arial, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Field.eventBanner, CONFIG.VIEW.WIDTH / 2, y + h / 2);
      ctx.restore();
    }
  };
  root.BattleEvents = BattleEvents;
})();

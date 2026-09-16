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
    reset: function () {
      this.waveIndex = 0;
      this.bossPending = false;
      this.waveBossSpawned = false;
      this.rangedPending = false;
      this.waveRangedSpawned = false;
      this.theme = null;
      this.normalTimer = 0;
      this.waveRest = 2;
      this.waveQuota = 0;
      this.eliteQuota = 0;
      this.eliteTimer = 60;
    },
    update: function (dt, elapsed) {
      this.updateQuota(dt, elapsed);
      if (this.bossPending && !this.waveBossSpawned) {
        if (Enemy.activeCount >= CONFIG.ENEMY.POOL_SIZE) Enemy.recycleOneNonBoss();
        var b = this.spawnType(CONFIG.ENEMY.TYPE_BOSS, elapsed);
        if (b) {
          this.waveBossSpawned = true;
          this.bossPending = false;
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
      var margin = CONFIG.SPAWNER.OUTSIDE_MARGIN;
      var radius = CONFIG.ENEMY.TYPES[typeIndex].RADIUS;
      var x = 0,
        y = 0;
      if (side === 0 && Camera.y - margin >= radius) {
        x = Camera.x + Math.random() * CONFIG.VIEW.WIDTH;
        y = Camera.y - margin;
      } else if (side === 1 && Camera.x + CONFIG.VIEW.WIDTH + margin <= CONFIG.WORLD.WIDTH - radius) {
        x = Camera.x + CONFIG.VIEW.WIDTH + margin;
        y = Camera.y + Math.random() * CONFIG.VIEW.HEIGHT;
      } else if (side === 2 && Camera.y + CONFIG.VIEW.HEIGHT + margin <= CONFIG.WORLD.HEIGHT - radius) {
        x = Camera.x + Math.random() * CONFIG.VIEW.WIDTH;
        y = Camera.y + CONFIG.VIEW.HEIGHT + margin;
      } else if (side === 3 && Camera.x - margin >= radius) {
        x = Camera.x - margin;
        y = Camera.y + Math.random() * CONFIG.VIEW.HEIGHT;
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
      this.waveQuota = 8 + this.waveIndex * 4;
      this.eliteQuota = this.waveIndex >= 3 ? 1 + Math.floor((this.waveIndex - 3) / 2) : 0;
      this.normalTimer = 0;
      if (root.FX) {
        root.FX.wave = this.waveIndex - 1;
      }
      this.bossPending = this.waveIndex % CONFIG.BALANCE.BOSS_EVERY === 0;
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
        this.normalTimer += this.getSpawnInterval(elapsed);
      }
      if (this.eliteQuota > 0 && Enemy.activeCount < CONFIG.ENEMY.POOL_SIZE) {
        if (this.spawnType(CONFIG.ENEMY.TYPE_ELITE, elapsed)) this.eliteQuota--;
      }
      this.eliteTimer -= dt;
      if (this.eliteTimer <= 0) {
        if (Enemy.activeCount < CONFIG.ENEMY.POOL_SIZE) this.spawnType(CONFIG.ENEMY.TYPE_ELITE, elapsed);
        this.eliteTimer = 60;
      }
      if (this.waveQuota <= 0 && this.eliteQuota <= 0) this.waveRest = 2;
    }
  };
  root.Spawner = Spawner;
  root.G.wave = Spawner;
  var BattleEvents = {
    timer: 0,
    active: null,
    airdropCount: 0,
    seen: {},
    reset: function () {
      this.timer = CONFIG.EVENTS.FIRST_DELAY;
      this.active = null;
      this.airdropCount = 0;
      this.seen = {};
    },
    banner: function (text) {
      if (root.Field) {
        Field.eventBanner = text;
        Field.eventBannerTimer = 2.2;
      }
    },
    update: function (dt) {
      if (this.active) {
        this.active.t -= dt;
        this.tickActive(dt);
        if (this.active.t <= 0) {
          this.active = null;
          this.timer = CONFIG.EVENTS.INTERVAL_MIN + Math.random() * (CONFIG.EVENTS.INTERVAL_MAX - CONFIG.EVENTS.INTERVAL_MIN);
        }
        return;
      }
      this.timer -= dt;
      if (this.timer <= 0) this.roll();
    },
    roll: function () {
      var wave = Spawner.waveIndex;
      var pool = [];
      var kinds = CONFIG.EVENTS.KINDS;
      for (var id in kinds) {
        var def = kinds[id];
        if (wave < def.MIN_WAVE) continue;
        if (id === 'airdrop' && this.airdropCount >= def.MAX_PER_RUN) continue;
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
      this.active = { id: id, t: def.DURATION, land: def.LAND || 0, opened: false };
      this.seen[id] = true;
      this.banner(def.BANNER);
      if (id === 'airdrop') {
        this.airdropCount++;
        var pos = this.randomClear(80);
        this.active.x = pos.x;
        this.active.y = pos.y;
      } else if (id === 'elite_rush') {
        for (var i = 0; i < def.EXTRA_ELITES; i++) Spawner.spawnType(CONFIG.ENEMY.TYPE_ELITE, Game.survivedSeconds);
      } else if (id === 'grid_surge') {
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
    tickActive: function (dt) {
      var ev = this.active, def = CONFIG.EVENTS.KINDS[ev.id];
      if (ev.id === 'airdrop') {
        if (!ev.opened && ev.t <= def.DURATION - def.LAND) {
          ev.opened = true;
        }
        if (ev.opened) {
          var dx = Player.x - ev.x, dy = Player.y - ev.y;
          if (dx * dx + dy * dy <= 50 * 50) {
            var types = [0, 1, 2, 3, 4];
            PowerUps.drop(ev.x, ev.y, types[Math.floor(Math.random() * types.length)]);
            for (var g = 0; g < def.GEMS; g++) Experience.dropGem(ev.x + (Math.random() * 2 - 1) * 40, ev.y + (Math.random() * 2 - 1) * 40, 8);
            ev.t = 0;
          }
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
        if (hurt(Player)) Player.takeDamage(dps, 'event');
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
        ctx.save();
        ctx.strokeStyle = CONFIG.COLORS.AIRDROP;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(ev.x - Camera.x, ev.y - Camera.y, 46, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = ev.opened ? '#e9ad58' : '#8a6a32';
        ctx.fillRect(ev.x - Camera.x - 14, ev.y - Camera.y - 14, 28, 28);
        ctx.restore();
      } else if (ev.id === 'grid_surge' && ev.strips) {
        ctx.save();
        ctx.fillStyle = 'rgba(90,212,230,0.22)';
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

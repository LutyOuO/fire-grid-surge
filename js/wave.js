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
    },
    getHpMultiplier: function () {
      var w = Math.max(1, this.waveIndex),
        m = 1 + w * CONFIG.BALANCE.HP_PER_WAVE;
      if (w >= CONFIG.BALANCE.LATE_WAVE) m *= CONFIG.BALANCE.LATE_HP;
      return m;
    },
    getSpawnInterval: function (t) {
      return Math.max(.25, 1.2 - t / 200);
    },
    spawnNormal: function (elapsedSeconds) {
      return this.spawnType(this.rollNormalType(), elapsedSeconds);
    },
    rollNormalType: function () {
      var f = Math.min(1, this.waveIndex / 15),
        w = 7 - 2 * f,
        r = 2 + f,
        t = 1 + f,
        n = Math.random() * (w + r + t);
      return n < w ? CONFIG.ENEMY.TYPE_WALKER : n < w + r ? CONFIG.ENEMY.TYPE_RUNNER : CONFIG.ENEMY.TYPE_TANK;
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
      this.waveQuota = 8 + this.waveIndex * 4;
      this.eliteQuota = this.waveIndex >= 3 ? 1 + Math.floor((this.waveIndex - 3) / 2) : 0;
      this.normalTimer = 0;
      if (root.FX) {
        root.FX.wave = this.waveIndex - 1;
      }
      this.bossPending = this.waveIndex % CONFIG.BALANCE.BOSS_EVERY === 0;
      if (this.bossPending) this.waveQuota = Math.max(4, Math.floor(this.waveQuota * CONFIG.BALANCE.BOSS_NORMAL_QUOTA_RATIO));
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
})();

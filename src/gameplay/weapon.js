(function () {
  'use strict';

  // 武器：手枪、飞刃、喷火器、弩箭、激光与空袭，武器等级成长。
  var root = typeof window !== 'undefined' ? window : global;
  var CONFIG = root.CONFIG;
  var Bullet = {
    pool: [],
    activeCount: 0,
    initPool: function () {
      this.pool.length = 0;
      for (var i = 0; i < CONFIG.WEAPONS.PULSE.POOL_SIZE; i++) {
        this.pool.push({
          active: false,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          life: 0,
          damage: 0,
          pierceRemaining: 0,
          hitCount: 0,
          hitSpawnIds: new Array(CONFIG.WEAPONS.PULSE.MAX_PENETRATION + 1).fill(-1)
        });
      }
    },
    reset: function () {
      this.activeCount = 0;
      for (var i = 0; i < this.pool.length; i++) this.pool[i].active = false;
    },
    spawn: function (x, y, angle, speed, damage, penetration) {
      for (var i = 0; i < this.pool.length; i++) {
        var bullet = this.pool[i];
        if (!bullet.active) {
          bullet.active = true;
          bullet.x = x;
          bullet.y = y;
          bullet.vx = Math.cos(angle) * speed;
          bullet.vy = Math.sin(angle) * speed;
          bullet.life = CONFIG.WEAPONS.PULSE.LIFE + (Player.nextBulletLife || 0);
          bullet.damage = damage;
          bullet.pierceRemaining = penetration;
          bullet.hitCount = 0;
          this.activeCount += 1;
          return true;
        }
      }
      return false;
    },
    deactivate: function (bullet) {
      if (!bullet.active) return;
      bullet.active = false;
      this.activeCount -= 1;
    },
    update: function (dt) {
      for (var i = 0; i < this.pool.length; i++) {
        var bullet = this.pool[i];
        if (!bullet.active) continue;
        bullet.life -= dt;
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        if (this.shouldRemove(bullet)) {
          this.deactivate(bullet);
          continue;
        }
        this.checkEnemyHits(bullet);
      }
    },
    shouldRemove: function (bullet) {
      if (root.WallCollision.inside(bullet.x, bullet.y, CONFIG.WEAPONS.PULSE.RADIUS)) return true;
      var r = CONFIG.WEAPONS.PULSE.RADIUS;
      return bullet.life <= 0 || bullet.x < 0 || bullet.y < 0 || bullet.x > CONFIG.WORLD.WIDTH || bullet.y > CONFIG.WORLD.HEIGHT;
    },
    checkEnemyHits: function (bullet) {
      var maxRadius = 0;
      for (var i = 0; i < CONFIG.ENEMY.TYPES.length; i++) {
        maxRadius = Math.max(maxRadius, CONFIG.ENEMY.TYPES[i].RADIUS);
      }
      var r = maxRadius + CONFIG.WEAPONS.PULSE.RADIUS;
      var x0 = Spatial.cell(bullet.x - r, Spatial.cols);
      var x1 = Spatial.cell(bullet.x + r, Spatial.cols);
      var y0 = Spatial.cell(bullet.y - r, Spatial.rows);
      var y1 = Spatial.cell(bullet.y + r, Spatial.rows);
      for (var y = y0; y <= y1; y++) {
        for (var x = x0; x <= x1; x++) {
          for (var i = Spatial.heads[y * Spatial.cols + x]; i !== -1; i = Spatial.next[i]) {
            var e = Enemy.pool[i];
            if (!e.active || this.hasAlreadyHit(bullet, e.spawnId)) continue;
            var dx = bullet.x - e.x,
              dy = bullet.y - e.y;
            var hit = CONFIG.WEAPONS.PULSE.RADIUS + e.radius;
            if (dx * dx + dy * dy > hit * hit) continue;
            var normalEnemy = e.typeIndex !== CONFIG.ENEMY.TYPE_ELITE && e.typeIndex !== CONFIG.ENEMY.TYPE_BOSS && e.typeIndex !== CONFIG.ENEMY.TYPE_BOSS_RANGED;
            if (normalEnemy && Player.executeChance > 0 && Math.random() < Player.executeChance) {
              root.DamageText.spawn(e.x, e.y, e.hp, true);
              Enemy.applyDamage(e, e.hp + 1);
            } else {
              root.Combat.hitEnemy(e, bullet.damage, e.x, e.y);
            }
            bullet.hitSpawnIds[bullet.hitCount++] = e.spawnId;
            if (bullet.pierceRemaining > 0) {
              bullet.pierceRemaining -= 1;
            } else {
              this.deactivate(bullet);
              return;
            }
          }
        }
      }
    },
    hasAlreadyHit: function (bullet, spawnId) {
      for (var i = 0; i < bullet.hitCount; i++) {
        if (bullet.hitSpawnIds[i] === spawnId) return true;
      }
      return false;
    },
    draw: function (ctx) {
      for (var i = 0; i < this.pool.length; i++) {
        if (this.pool[i].active) this.drawOne(ctx, this.pool[i]);
      }
    },
    drawOne: function (ctx, bullet) {
      var screenX = bullet.x - Camera.x;
      var screenY = bullet.y - Camera.y;
      var speed = Math.hypot(bullet.vx, bullet.vy);
      var trailX = speed > 0 ? screenX - bullet.vx / speed * CONFIG.WEAPONS.PULSE.TRAIL_LENGTH : screenX;
      var trailY = speed > 0 ? screenY - bullet.vy / speed * CONFIG.WEAPONS.PULSE.TRAIL_LENGTH : screenY;
      ctx.save();
      if (PulseGun.laserCannon) {
        var angle = Math.atan2(bullet.vy, bullet.vx);
        ctx.translate(screenX, screenY);
        ctx.rotate(angle);
        ctx.shadowColor = '#fff36a';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#ffd928';
        ctx.fillRect(-30, -3, 30, 6);
        ctx.fillStyle = '#fffbd2';
        ctx.fillRect(-28, -1, 28, 2);
        ctx.restore();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(trailX, trailY);
      ctx.lineTo(screenX, screenY);
      ctx.lineWidth = CONFIG.WEAPONS.PULSE.TRAIL_WIDTH;
      ctx.lineCap = 'round';
      ctx.strokeStyle = CONFIG.COLORS.BULLET_TRAIL;
      ctx.stroke();
      ctx.shadowColor = CONFIG.COLORS.BULLET_GLOW;
      ctx.shadowBlur = CONFIG.WEAPONS.PULSE.DRAW_RADIUS * 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, CONFIG.WEAPONS.PULSE.DRAW_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.COLORS.BULLET;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(screenX, screenY, CONFIG.WEAPONS.PULSE.DRAW_RADIUS * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.COLORS.BULLET_CORE;
      ctx.fill();
      ctx.restore();
    }
  };
  var PulseGun = {
    cooldown: 0,
    damageBonus: 0,
    damageFlat: 0,
    fireRateBonus: 0,
    speedFlat: 0,
    projectileCount: CONFIG.WEAPONS.PULSE.BASE_PROJECTILES,
    penetration: CONFIG.WEAPONS.PULSE.BASE_PENETRATION,
    muzzleFlashTimer: 0,
    cooldownMultiplier: 1,
    projectileMultiplier: 1,
    damageMultiplier: 1,
    laserCannon: false,
    reset: function () {
      this.cooldown = 0;
      this.damageBonus = 0;
      this.damageFlat = 0;
      this.fireRateBonus = 0;
      this.speedFlat = 0;
      this.muzzleFlashTimer = 0;
      this.cooldownMultiplier = 1;
      this.projectileMultiplier = 1;
      this.damageMultiplier = 1;
      this.laserCannon = false;
      this.projectileCount = Math.min(CONFIG.WEAPONS.PULSE.MAX_PROJECTILES, CONFIG.WEAPONS.PULSE.BASE_PROJECTILES + Math.round(Meta.getEffectTotal('START_PROJECTILE')));
      this.penetration = CONFIG.WEAPONS.PULSE.BASE_PENETRATION;
    },
    update: function (dt) {
      if (root.WeaponProgress.selected !== "pistol") return;
      if (this.muzzleFlashTimer > 0) this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
      this.cooldown = Math.max(0, this.cooldown - dt);
      if (this.cooldown > 0) return;
      var target = Enemy.findNearest(Player.x, Player.y);
      if (!target) return;
      this.fireAt(target);
      this.cooldown = this.getInterval();
    },
    getDamage: function () {
      return (CONFIG.WEAPONS.PULSE.DAMAGE + this.damageFlat) * (1 + this.damageBonus) * this.damageMultiplier;
    },
    getInterval: function () {
      return Math.max(CONFIG.WEAPONS.PULSE.MIN_INTERVAL, CONFIG.WEAPONS.PULSE.INTERVAL * this.cooldownMultiplier / (1 + this.fireRateBonus));
    },
    getBulletSpeed: function () {
      return Math.min(CONFIG.WEAPONS.PULSE.MAX_SPEED, (CONFIG.WEAPONS.PULSE.SPEED + this.speedFlat) * (this.laserCannon ? 1.5 : 1));
    },
    fireAt: function (target) {
      var baseAngle = Math.atan2(target.y - Player.y, target.x - Player.x);
      var totalProjectiles = this.projectileCount * this.projectileMultiplier;
      var middle = (totalProjectiles - 1) / 2;
      for (var i = 0; i < totalProjectiles; i++) {
        var angle = baseAngle + (i - middle) * CONFIG.WEAPONS.PULSE.SPREAD_ANGLE;
        Bullet.spawn(Player.x, Player.y, angle, this.getBulletSpeed(), this.getDamage(), this.laserCannon ? 9999 : this.penetration);
      }
      // #5 后坐力（主弹道方向，不叠加）；#16 枪口闪光
      Player.applyRecoil(baseAngle);
      this.muzzleFlashTimer = 0.05;
      root.AudioFX.play("shoot");
    }
  };
  var OrbitBlade = {
    angle: 0,
    damageFlat: 0,
    count: CONFIG.WEAPONS.BLADE.COUNT,
    speedBonus: 0,
    cooldownMultiplier: 1,
    reset: function () {
      this.angle = 0;
      this.damageFlat = 0;
      this.count = CONFIG.WEAPONS.BLADE.COUNT;
      this.speedBonus = 0;
      this.cooldownMultiplier = 1;
    },
    update: function (dt) {
      this.angle += CONFIG.WEAPONS.BLADE.ANGULAR_SPEED * (1 + this.speedBonus) * dt;
      if (this.angle >= Math.PI * 2) this.angle -= Math.PI * 2;
      this.checkEnemyHits();
    },
    getDamage: function () {
      return CONFIG.WEAPONS.BLADE.DAMAGE + this.damageFlat;
    },
    getBladeAngle: function (index) {
      return this.angle + index * Math.PI * 2 / this.count;
    },
    checkEnemyHits: function () {
      for (var ei = 0; ei < Enemy.pool.length; ei++) {
        var enemy = Enemy.pool[ei];
        if (!enemy.active || enemy.bladeCooldown > 0) continue;
        var hitDistance = CONFIG.WEAPONS.BLADE.HIT_RADIUS + enemy.radius;
        var hitDistanceSquared = hitDistance * hitDistance;
        for (var bi = 0; bi < this.count; bi++) {
          var angle = this.getBladeAngle(bi);
          var bladeX = Player.x + Math.cos(angle) * CONFIG.WEAPONS.BLADE.ORBIT_RADIUS;
          var bladeY = Player.y + Math.sin(angle) * CONFIG.WEAPONS.BLADE.ORBIT_RADIUS;
          var dx = bladeX - enemy.x,
            dy = bladeY - enemy.y;
          if (dx * dx + dy * dy <= hitDistanceSquared) {
            enemy.bladeCooldown = CONFIG.WEAPONS.BLADE.HIT_COOLDOWN * this.cooldownMultiplier;
            Combat.hitEnemy(enemy, this.getDamage(), enemy.x, enemy.y);
            break;
          }
        }
      }
    },
    draw: function (ctx) {
      // 主飞刃 + 2 个残影（角度后移，半透明）
      var ghosts = [{
        off: -0.15,
        a: 0.30
      }, {
        off: -0.30,
        a: 0.15
      }];
      for (var g = 0; g < ghosts.length; g++) {
        for (var i = 0; i < this.count; i++) {
          var ga = this.getBladeAngle(i) + ghosts[g].off;
          var gx = Player.x + Math.cos(ga) * CONFIG.WEAPONS.BLADE.ORBIT_RADIUS;
          var gy = Player.y + Math.sin(ga) * CONFIG.WEAPONS.BLADE.ORBIT_RADIUS;
          ctx.save();
          ctx.globalAlpha = ghosts[g].a;
          this.drawOne(ctx, gx - Camera.x, gy - Camera.y, ga);
          ctx.restore();
        }
      }
      for (var i = 0; i < this.count; i++) {
        var angle = this.getBladeAngle(i);
        var worldX = Player.x + Math.cos(angle) * CONFIG.WEAPONS.BLADE.ORBIT_RADIUS;
        var worldY = Player.y + Math.sin(angle) * CONFIG.WEAPONS.BLADE.ORBIT_RADIUS;
        this.drawOne(ctx, worldX - Camera.x, worldY - Camera.y, angle);
      }
    },
    drawOne: function (ctx, x, y, angle) {
      var halfLength = CONFIG.WEAPONS.BLADE.LENGTH / 2;
      var halfWidth = CONFIG.WEAPONS.BLADE.WIDTH / 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.shadowColor = CONFIG.COLORS.WEAPON_BLADE_GLOW;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -halfLength);
      ctx.lineTo(halfWidth, 0);
      ctx.lineTo(0, halfLength);
      ctx.lineTo(-halfWidth, 0);
      ctx.closePath();
      ctx.fillStyle = CONFIG.COLORS.WEAPON_BLADE;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = CONFIG.WEAPONS.BLADE.OUTLINE_WIDTH;
      ctx.strokeStyle = CONFIG.COLORS.BLADE_OUTLINE;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -halfLength * 0.66);
      ctx.lineTo(0, halfLength * 0.66);
      ctx.lineWidth = CONFIG.WEAPONS.BLADE.OUTLINE_WIDTH;
      ctx.strokeStyle = CONFIG.COLORS.BLADE_CORE;
      ctx.stroke();
      ctx.restore();
    }
  };
  var Weapons = {
    reset: function () {
      Bullet.reset();
      PulseGun.reset();
      OrbitBlade.reset();
    },
    update: function (dt) {
      PulseGun.update(dt);
      Bullet.update(dt);
      OrbitBlade.update(dt);
    },
    draw: function (ctx) {
      Bullet.draw(ctx);
      OrbitBlade.draw(ctx);
      root.FlameWeapon.draw(ctx);
      root.Crossbow.draw(ctx);
      root.RainbowFX.draw(ctx);
    },
    // 炸弹和激光共享主武器基础伤害查询。
    getMainDamage: function () {
      var id = root.WeaponProgress.selected || 'pistol';
      if (id === 'flamer') return CONFIG.CONTENT.FLAME.DAMAGE * root.FlameWeapon.damageMul;
      if (id === 'crossbow') return root.Crossbow.damage;
      return root.PulseGun.getDamage();
    }
  };
  var LaserEmitter = {
    active: false,
    timer: 0,
    tickTimer: 0,
    angle: 0,
    startX: 0,
    startY: 0,
    duration: 0,
    width: 0,
    damagePerTick: 0,
    totalDamage: 0,
    reset: function () {
      this.active = false;
      this.timer = 0;
      this.tickTimer = 0;
      this.cooldownTimer = 0;
      this.angle = 0;
      this.elapsed = 0;
      this.lastSweepA = 0;
    },
    activate: function () {
      if (this.active || this.cooldownTimer > 0) return false;
      this.active = true;
      this.angle = -Math.PI / 2;
      this.elapsed = 0;
      this.lastSweepA = this.angle;
      this.timer = 5 + Meta.getGadgetLevel('laser', 'duration');
      this.tickTimer = 0;
      return true;
    },
    update: function (dt) {
      this.cooldownTimer = Math.max(0, (this.cooldownTimer || 0) - dt);
      if (!this.active) return;
      this.elapsed += dt;
      var ramp = CONFIG.LASER_EMITTER.SPIN_RAMP_TIME;
      var t = Math.min(1, this.elapsed / ramp);
      var ease = 1 - Math.pow(1 - t, 3);
      var rps = CONFIG.LASER_EMITTER.SPIN_START_RPS + (CONFIG.LASER_EMITTER.SPIN_MAX_RPS - CONFIG.LASER_EMITTER.SPIN_START_RPS) * ease;
      var speed = rps * Math.PI * 2 * (1 + .15 * Meta.getGadgetLevel('laser', 'speed'));
      this.angle = (this.angle + speed * dt) % (Math.PI * 2);
      this.timer -= dt;
      this.tickTimer -= dt;
      if (this.tickTimer <= 0) {
        this.tickTimer = CONFIG.LASER_EMITTER.TICK_INTERVAL;
        this.dealDamage();
      }
      if (this.timer <= 0) {
        this.active = false;
        this.cooldownTimer = CONFIG.LASER_EMITTER.COOLDOWN * (1 - .15 * Meta.getGadgetLevel('laser', 'cooldown'));
      }
    },
    _endPoint: function () {
      var range = CONFIG.LASER_EMITTER.RANGE;
      return {
        x: this.startX + Math.cos(this.angle) * range,
        y: this.startY + Math.sin(this.angle) * range
      };
    },
    dealDamage: function () {
      var beams = Meta.getGadgetLevel('laser', 'overload') > 0 ? 2 : 1;
      var bossMul = 1 + .25 * Meta.getGadgetLevel('laser', 'bossDamage');
      var base = selectedMainDamage() * 10 * bossMul;
      var s0 = this.lastSweepA,
        s1 = this.angle;
      for (var i = 0; i < Enemy.pool.length; i++) {
        var e = Enemy.pool[i];
        if (!e.active) continue;
        var dx = e.x - Player.x,
          dy = e.y - Player.y,
          dist = Math.hypot(dx, dy);
        if (dist < 1) continue;
        var ea = Math.atan2(dy, dx);
        var halfW = Math.atan2(e.radius + 18, dist);
        var hit = false;
        for (var k = 0; k < beams; k++) {
          if (sectorHit(ea, s0 + k * Math.PI, s1 + k * Math.PI, halfW)) {
            hit = true;
            break;
          }
        }
        if (!hit) continue;
        var strong = e.typeIndex === CONFIG.ENEMY.TYPE_ELITE || e.typeIndex === CONFIG.ENEMY.TYPE_BOSS || e.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED;
        // 无视受击无敌帧：直接扣血并触发死亡判定
        if (strong) {
          e.hp -= base;
          if (root.DamageText) root.DamageText.spawn(e.x, e.y, base, false);
          if (e.hp <= 0) Enemy.kill(e);
        } else {
          e.hp = 0;
          Enemy.kill(e);
        }
        if (root.FX) root.FX.burst(e.x, e.y, '#7ff6ff');
      }
      this.lastSweepA = this.angle;
    },
    explode: function () {
      var end = this._endPoint();
      var r = CONFIG.LASER_EMITTER.OVERLOAD_RADIUS;
      var dmg = this.totalDamage * CONFIG.LASER_EMITTER.OVERLOAD_RATIO;
      for (var i = 0; i < Enemy.pool.length; i++) {
        var e = Enemy.pool[i];
        if (!e.active) continue;
        var dx = e.x - end.x,
          dy = e.y - end.y;
        if (dx * dx + dy * dy <= r * r) Combat.hitEnemyFixed(e, dmg, e.x, e.y);
      }
      if (root.FX && root.FX.burst) root.FX.burst(end.x, end.y, CONFIG.COLORS.LASER_EMITTER_BEAM);
    },
    draw: function (ctx) {
      if (!this.active) return;
      var ends = this.ends(),
        sx = Player.x - Camera.x,
        sy = Player.y - Camera.y;
      ctx.save();
      ctx.lineCap = 'round';
      for (var i = 0; i < ends.length; i++) {
        var z = ends[i],
          ex = z.x - Camera.x,
          ey = z.y - Camera.y;
        ctx.globalAlpha = .38;
        ctx.shadowColor = '#30dfff';
        ctx.shadowBlur = 16;
        ctx.strokeStyle = '#32d9ff';
        ctx.lineWidth = 30;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 7;
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#39e5ff';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(sx, sy, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    // 两束对向激光的世界端点。
    ends: function () {
      var count = Meta.getGadgetLevel('laser', 'overload') > 0 ? 2 : 1,
        out = [];
      for (var i = 0; i < count; i++) {
        var a = this.angle + i * Math.PI,
          d = laserRayDistance(Player.x, Player.y, a);
        out.push({
          a: a,
          x: Player.x + Math.cos(a) * d,
          y: Player.y + Math.sin(a) * d
        });
      }
      return out;
    }
  };
  var MortarStrike = {
    shells: [],
    reset: function () {
      this.shells.length = 0;
      MortarFX.reset();
    },
    activate: function () {
      var full = Meta.getGadgetLevel('mortar', 'fullcover') > 0;
      var count = CONFIG.MORTAR.BASE_COUNT + Meta.getGadgetLevel('mortar', 'count') + (full ? CONFIG.MORTAR.FULLCOVER_EXTRA : 0);
      var targets = this._findTargets(count, full);
      for (var i = 0; i < targets.length; i++) MortarFX.spawnShell(targets[i].x, targets[i].y, i * .5);
      return true;
    },
    _findTargets: function (n, prioritizeElite) {
      // 屏幕内敌人网格化，取最密集的 n 个中心
      var grid = {};
      var gs = CONFIG.MORTAR.GRID_SIZE;
      var eliteCells = {};
      for (var i = 0; i < Enemy.pool.length; i++) {
        var e = Enemy.pool[i];
        if (!e.active) continue;
        var screenX = e.x - Camera.x,
          screenY = e.y - Camera.y;
        if (screenX < 0 || screenX > CONFIG.VIEW.WIDTH || screenY < 0 || screenY > CONFIG.VIEW.HEIGHT) continue;
        var cx = Math.floor(e.x / gs),
          cy = Math.floor(e.y / gs);
        var key = cx + '_' + cy;
        if (!grid[key]) grid[key] = {
          x: e.x,
          y: e.y,
          n: 0,
          elite: false
        };
        grid[key].x = (grid[key].x * grid[key].n + e.x) / (grid[key].n + 1);
        grid[key].y = (grid[key].y * grid[key].n + e.y) / (grid[key].n + 1);
        grid[key].n += 1;
        var isStrong = e.typeIndex === CONFIG.ENEMY.TYPE_ELITE || e.typeIndex === CONFIG.ENEMY.TYPE_BOSS || e.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED;
        if (isStrong) eliteCells[key] = true;
      }
      var keys = Object.keys(grid);
      keys.sort(function (a, b) {
        var ea = prioritizeElite && eliteCells[a] ? 1 : 0;
        var eb = prioritizeElite && eliteCells[b] ? 1 : 0;
        if (ea !== eb) return eb - ea;
        return grid[b].n - grid[a].n;
      });
      var out = [];
      for (var k = 0; k < Math.min(n, keys.length); k++) out.push({
        x: grid[keys[k]].x,
        y: grid[keys[k]].y
      });
      // 屏幕内无敌人则随机落点屏幕中央
      if (out.length === 0) out.push({
        x: Camera.x + CONFIG.VIEW.WIDTH / 2,
        y: Camera.y + CONFIG.VIEW.HEIGHT / 2
      });
      // 目标格少于请求数量时，复用落点（轻微错开）补齐到 n 发
      while (out.length < n) {
        var base = out[out.length - 1];
        out.push({
          x: base.x + (Math.random() * 2 - 1) * 40,
          y: base.y + (Math.random() * 2 - 1) * 40
        });
      }
      return out;
    },
    _radius: function () {
      return CONFIG.MORTAR.BASE_RADIUS + 20 * root.Meta.getGadgetLevel('mortar', 'radius');
    },
    _baseDmg: function () {
      var damageLv = root.Meta.getGadgetLevel('mortar', 'damage');
      return PulseGun.getDamage() * CONFIG.MORTAR.DAMAGE_MULTIPLIER * (1 + 0.2 * damageLv);
    },
    update: function (dt) {
      MortarFX.update(dt);
      for (var i = 0; i < MortarFX.shells.length; i++) {
        var s = MortarFX.shells[i];
        if (s.active && s.t >= 0 && root.WallCollision.inside(s.x, s.y, CONFIG.MORTAR.SHELL_RADIUS)) s.active = false;
      }
    },
    _explode: function (s) {
      var source = Combat.killSource;
      Combat.killSource = 'mortar';
      try {
        var r = this._radius(),
          dmg = this._baseDmg();
        for (var i = 0; i < Enemy.pool.length; i++) {
          var e = Enemy.pool[i];
          if (!e.active) continue;
          var dx = e.x - s.targetX,
            dy = e.y - s.targetY;
          if (dx * dx + dy * dy <= r * r) Combat.hitEnemy(e, dmg, e.x, e.y);
        }
        if (root.FX && root.FX.burst) root.FX.burst(s.targetX, s.targetY, CONFIG.COLORS.ITEM_MORTAR);
      } finally {
        Combat.killSource = source;
      }
    },
    _burnTick: function (s, dt) {
      var r = this._radius();
      var burnLv = root.Meta.getGadgetLevel('mortar', 'burn');
      var dps = this._baseDmg() * CONFIG.MORTAR.BURN_DPS_RATIO * burnLv;
      for (var i = 0; i < Enemy.pool.length; i++) {
        var e = Enemy.pool[i];
        if (!e.active) continue;
        var dx = e.x - s.targetX,
          dy = e.y - s.targetY;
        if (dx * dx + dy * dy <= r * r) Combat.hitEnemyFixed(e, dps * dt, e.x, e.y);
      }
    },
    draw: function (ctx) {
      MortarFX.draw(ctx);
    }
  };

  // 点到线段距离（激光宽度判定）
  function pointToSegDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1,
      dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    var t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    var cx = x1 + t * dx,
      cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
  }
  root.Bullet = Bullet;
  root.PulseGun = PulseGun;
  root.OrbitBlade = OrbitBlade;
  root.Weapons = Weapons;
  root.LaserEmitter = LaserEmitter;
  root.MortarStrike = MortarStrike;
  var FlameWeapon = {
    unlocked: false,
    timer: 0,
    damageMul: 1,
    rate: 1,
    angle: CONFIG.CONTENT.FLAME.ANGLE,
    range: CONFIG.CONTENT.FLAME.RANGE,
    burnLife: CONFIG.BALANCE.FLAME_BURN_DURATION,
    burns: [],
    patches: [],
    visual: 0,
    napalm: false,
    backdraft: false,
    inferno: false,
    infernoTimer: 0,
    init: function () {
      this.burns.length = 0;
      for (var i = 0; i < CONFIG.ENEMY.POOL_SIZE; i++) this.burns.push({
        active: false,
        time: 0,
        tick: 0
      });
      this.patches.length = 0;
      for (var p = 0; p < 8; p++) this.patches.push({ active: false, x: 0, y: 0, r: 70, t: 0, life: 3 });
    },
    reset: function () {
      this.unlocked = false;
      this.timer = 0;
      this.damageMul = 1;
      this.rate = 1;
      this.angle = CONFIG.CONTENT.FLAME.ANGLE;
      this.range = CONFIG.CONTENT.FLAME.RANGE;
      this.burnLife = CONFIG.BALANCE.FLAME_BURN_DURATION;
      this.visual = 0;
      this.napalm = false;
      this.backdraft = false;
      this.inferno = false;
      this.infernoTimer = 0;
      for (var i = 0; i < this.burns.length; i++) this.burns[i].active = false;
      for (var p = 0; p < this.patches.length; p++) this.patches[p].active = false;
    },
    update: function (dt) {
      for (var i = 0; i < this.burns.length; i++) {
        var b = this.burns[i];
        if (!b.active) continue;
        var e = Enemy.pool[i];
        b.time -= dt;
        b.tick -= dt;
        if (!e || !e.active || b.time <= 0) {
          b.active = false;
          continue;
        }
        if (b.tick <= 0) {
          b.tick += CONFIG.BALANCE.FLAME_BURN_TICK;
          Combat.hitEnemyFixed(e, CONFIG.CONTENT.FLAME.DAMAGE * this.damageMul * (1 + (root.W8 && root.W8.dmgBonusFor ? root.W8.dmgBonusFor('flame') : 0)), e.x, e.y);
        }
      }
      if (!this.unlocked) return;
      this.timer -= dt;
      this.visual = Math.max(0, this.visual - dt);
      if (this.timer <= 0) {
        this.timer = .1 / (this.rate * (1 + (root.W8 && root.W8.rateBonusFor ? root.W8.rateBonusFor('flame') : 0)));
        this.fire();
      }
      this.updatePatches(dt);
      if (this.inferno && this.visual > 0) {
        this.infernoTimer -= dt;
        if (this.infernoTimer <= 0) {
          this.infernoTimer = 2;
          var src = Combat.killSource;
          Combat.killSource = 'flame';
          for (var i = 0; i < Enemy.pool.length; i++) {
            var e = Enemy.pool[i];
            if (!e.active) continue;
            var dx = e.x - Player.x, dy = e.y - Player.y;
            if (dx * dx + dy * dy <= 90 * 90) Combat.hitEnemy(e, CONFIG.CONTENT.FLAME.DAMAGE * this.damageMul * 0.6, e.x, e.y);
          }
          Combat.killSource = src;
          Player.hp = Math.min(Player.maxHp, Player.hp + Player.maxHp * 0.04);
        }
      }
    },
    updatePatches: function (dt) {
      var dps = CONFIG.CONTENT.FLAME.DAMAGE * this.damageMul * 0.08;
      for (var i = 0; i < this.patches.length; i++) {
        var p = this.patches[i];
        if (!p.active) continue;
        p.t += dt;
        if (p.t >= p.life) {
          p.active = false;
          continue;
        }
        var src = Combat.killSource;
        Combat.killSource = 'flame';
        for (var j = 0; j < Enemy.pool.length; j++) {
          var e = Enemy.pool[j];
          if (!e.active) continue;
          var dx = e.x - p.x, dy = e.y - p.y;
          if (dx * dx + dy * dy <= p.r * p.r) Combat.hitEnemyFixed(e, dps * dt, e.x, e.y);
        }
        Combat.killSource = src;
      }
    },
    fire: function () {
      var target = Enemy.findNearest(Player.x, Player.y);
      if (!target) return;
      var a = Math.atan2(target.y - Player.y, target.x - Player.x),
        half = this.angle / 2;
      this.aim = a;
      this.visual = .22;
      root.Combat.killSource = 'flame';
      for (var i = 0; i < Enemy.pool.length; i++) {
        var e = Enemy.pool[i];
        if (!e.active) continue;
        var dx = e.x - Player.x,
          dy = e.y - Player.y,
          dist = Math.hypot(dx, dy);
        if (dist > this.range + e.radius) continue;
        var da = Math.atan2(Math.sin(Math.atan2(dy, dx) - a), Math.cos(Math.atan2(dy, dx) - a));
        if (Math.abs(da) <= half) {
          if (!root.WallCollision.segment(Player.x, Player.y, e.x, e.y, 2)) Combat.hitEnemy(e, CONFIG.CONTENT.FLAME.DAMAGE * this.damageMul * (1 + (root.W8 && root.W8.dmgBonusFor ? root.W8.dmgBonusFor('flame') : 0)), e.x, e.y);
          var b = this.burns[i];
          b.active = true;
          b.time = this.burnLife;
          b.tick = .2;
        }
      }
      root.Combat.killSource = '';
      if (this.napalm) {
        for (var p = 0; p < this.patches.length; p++) if (!this.patches[p].active) {
          var patch = this.patches[p];
          patch.active = true;
          patch.x = Player.x + Math.cos(a) * this.range * 0.7;
          patch.y = Player.y + Math.sin(a) * this.range * 0.7;
          patch.r = 70;
          patch.t = 0;
          patch.life = 3;
          break;
        }
      }
      if (this.backdraft) {
        var bx = Player.x + Math.cos(a) * this.range, by = Player.y + Math.sin(a) * this.range;
        root.Combat.killSource = 'flame';
        for (var i = 0; i < Enemy.pool.length; i++) {
          var e = Enemy.pool[i];
          if (!e.active) continue;
          var dx = e.x - bx, dy = e.y - by;
          if (dx * dx + dy * dy <= 70 * 70) Combat.hitEnemy(e, CONFIG.CONTENT.FLAME.DAMAGE * this.damageMul * 0.4, e.x, e.y);
        }
        root.Combat.killSource = '';
        if (root.FX) root.FX.burst(bx, by);
      }
      for (var i = 0; i < this.burns.length; i++) if (this.burns[i].active) {
        this.burns[i].time = CONFIG.BALANCE.FLAME_BURN_DURATION;
        this.burns[i].tick = Math.min(this.burns[i].tick, CONFIG.BALANCE.FLAME_BURN_TICK);
      }
    },
    draw: function (ctx) {
      this.drawCone(ctx);
      if (this.unlocked && this.visual > 0) {
        var x = Player.x - Camera.x,
          y = Player.y - Camera.y;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < 18; i++) {
          var f = (i + 1) / 18,
            a = this.aim + Math.sin(i * 7.3 + Game.survivedSeconds * 20) * this.angle * .42,
            rr = this.range * f,
            sz = 18 * (1 - f) + 6;
          ctx.globalAlpha = .35 + .45 * (1 - f);
          ctx.fillStyle = i % 3 ? '#ff8a24' : '#ffe46b';
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, sz, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      for (var j = 0; j < this.burns.length; j++) {
        var b = this.burns[j],
          e = Enemy.pool[j];
        if (!b.active || !e || !e.active) continue;
        var sx = e.x - Camera.x,
          sy = e.y - Camera.y;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = '#ff5a18';
        ctx.shadowBlur = 14;
        for (var k = 0; k < 4; k++) {
          var ang = k * Math.PI / 2 + Game.survivedSeconds * 4,
            rr = e.radius * .55;
          ctx.fillStyle = k % 2 ? '#ffb12b' : '#ff5425';
          ctx.beginPath();
          ctx.arc(sx + Math.cos(ang) * rr, sy + Math.sin(ang) * rr - 5, 5 + k, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      for (var pi = 0; pi < this.patches.length; pi++) {
        var patch = this.patches[pi];
        if (!patch.active) continue;
        ctx.save();
        ctx.globalAlpha = 0.35 * (1 - patch.t / patch.life);
        ctx.fillStyle = '#ff6928';
        ctx.beginPath();
        ctx.ellipse(patch.x - Camera.x, patch.y - Camera.y, patch.r, patch.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
    // 火焰扇形底层。
    drawCone: function (ctx) {
      if (!this.unlocked || this.visual <= 0) return;
      var x = Player.x - Camera.x,
        y = Player.y - Camera.y,
        a = this.aim,
        half = this.angle / 2;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.visual / .12);
      var g = ctx.createRadialGradient(x, y, 5, x, y, this.range);
      root.safeStop(g, 0, 'rgba(255,245,100,.9)');
      root.safeStop(g, .55, 'rgba(255,140,30,.65)');
      root.safeStop(g, 1, 'rgba(230,45,15,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, this.range, a - half, a + half);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };
  root.FlameWeapon = FlameWeapon;
  var Crossbow = {
    unlocked: false,
    timer: 0,
    damage: CONFIG.CONTENT.CROSSBOW.DAMAGE,
    rate: 1,
    count: 1,
    decay: CONFIG.CONTENT.CROSSBOW.DECAY,
    crit: 0,
    piledriver: false,
    pileBonus: 0,
    scatter: false,
    marksman: false,
    arrows: [],
    init: function () {
      for (var i = 0; i < CONFIG.CONTENT.CROSSBOW.POOL; i++) this.arrows.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        damage: 0,
        angle: 0,
        hitIds: [],
        hitCount: 0,
        life: 1,
        scatter: false,
        firstDist: 0
      });
    },
    reset: function () {
      this.unlocked = false;
      this.timer = 0;
      this.damage = CONFIG.CONTENT.CROSSBOW.DAMAGE;
      this.rate = 1;
      this.count = 1;
      this.decay = CONFIG.CONTENT.CROSSBOW.DECAY;
      this.crit = 0;
      this.piledriver = false;
      this.pileBonus = 0;
      this.scatter = false;
      this.marksman = false;
      for (var i = 0; i < this.arrows.length; i++) {
        this.arrows[i].active = false;
        this.arrows[i].hitCount = 0;
      }
    },
    spawn: function (a, opts) {
      opts = opts || {};
      for (var i = 0; i < this.arrows.length; i++) {
        var b = this.arrows[i];
        if (b.active) continue;
        b.active = true;
        b.x = opts.x != null ? opts.x : Player.x;
        b.y = opts.y != null ? opts.y : Player.y;
        var spd = opts.speed || 700;
        b.vx = Math.cos(a) * spd;
        b.vy = Math.sin(a) * spd;
        b.angle = a;
        b.damage = this.damage * (1 + (this.pileBonus || 0));
        b.hitCount = 0;
        b.life = opts.life || 2;
        b.scatter = !!opts.scatter;
        b.firstDist = 0;
        return b;
      }
    },
    fire: function () {
      var e = Enemy.findNearest(Player.x, Player.y);
      if (!e) return;
      var a = Math.atan2(e.y - Player.y, e.x - Player.x);
      for (var n = 0; n < this.count; n++) this.spawn(a + (n - (this.count - 1) / 2) * .08);
    },
    update: function (dt) {
      if (this.unlocked) {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = CONFIG.CONTENT.CROSSBOW.COOLDOWN / (this.rate * (1 + (root.W8 && root.W8.rateBonusFor ? root.W8.rateBonusFor('crossbow') : 0)));
          this.fire();
        }
      }
      for (var i = 0; i < this.arrows.length; i++) {
        var b = this.arrows[i];
        if (!b.active) continue;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0 || b.x < 0 || b.x > CONFIG.WORLD.WIDTH || b.y < 0 || b.y > CONFIG.WORLD.HEIGHT) {
          if (this.scatter && !b.scatter) this.splitBolt(b);
          b.active = false;
          continue;
        }
        for (var j = 0; j < Enemy.pool.length; j++) {
          var e = Enemy.pool[j];
          if (!e.active || this.wasHit(b, e.spawnId)) continue;
          var dx = e.x - b.x,
            dy = e.y - b.y,
            r = e.radius + 8;
          if (dx * dx + dy * dy <= r * r) {
            b.hitIds[b.hitCount++] = e.spawnId;
            var d = b.damage * (1 + (root.W8 && root.W8.dmgBonusFor ? root.W8.dmgBonusFor('crossbow') : 0)) * (1 + Player.globalDamageBonus) * (1 + Meta.getEffectTotal('WEAPON_DAMAGE'));
            var dist = Math.hypot(e.x - Player.x, e.y - Player.y);
            var crit = Math.random() < Player.critChance + this.crit;
            if (this.marksman && b.hitCount === 1 && dist > 420) {
              crit = true;
              d *= CONFIG.PLAYER.CRIT_MULTIPLIER + Player.critDamageBonus + 0.5;
            } else if (crit) d *= CONFIG.PLAYER.CRIT_MULTIPLIER + Player.critDamageBonus;
            root.Combat.killSource = 'bow';
            Combat.hitEnemyFixed(e, d, e.x, e.y);
            root.Combat.killSource = '';
            b.damage *= Math.max(0, 1 - this.decay);
            if (this.piledriver) this.pileBonus = Math.min(0.6, this.pileBonus + 0.12);
          }
        }
      }
      for (var i = 0; i < this.arrows.length; i++) {
        var b = this.arrows[i];
        if (b.active && root.WallCollision.inside(b.x, b.y, 8)) {
          if (this.scatter && !b.scatter) this.splitBolt(b);
          b.active = false;
          b.hitCount = 0;
        }
      }
    },
    splitBolt: function (b) {
      this.spawn(b.angle - 0.4, { x: b.x, y: b.y, speed: 420, life: 0.35, scatter: true });
      this.spawn(b.angle + 0.4, { x: b.x, y: b.y, speed: 420, life: 0.35, scatter: true });
    },
    wasHit: function (b, id) {
      for (var i = 0; i < b.hitCount; i++) if (b.hitIds[i] === id) return true;
      return false;
    },
    draw: function (ctx) {
      ctx.save();
      for (var i = 0; i < this.arrows.length; i++) {
        var b = this.arrows[i];
        if (!b.active) continue;
        ctx.save();
        ctx.translate(b.x - Camera.x, b.y - Camera.y);
        ctx.rotate(b.angle);
        ctx.strokeStyle = '#e6e6e6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(12, 0);
        ctx.stroke();
        ctx.fillStyle = '#bdc3c7';
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(7, -5);
        ctx.lineTo(7, 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(-13, -2, 20, 4);
        ctx.restore();
      }
      ctx.restore();
    }
  };
  root.Crossbow = Crossbow;
  var WeaponProgress = {
    selected: 'pistol',
    saveTimer: 0,
    need: function (lv) {
      return Math.floor(40 * Math.pow(1.4, Math.max(0, lv - 1)));
    },
    unlocked: function (id) {
      if (id === 'pistol') return true;
      var lv = Meta.data.weaponLevel.pistol.lv;
      return id === 'flamer' ? lv >= 5 : lv >= 10;
    },
    addKill: function (type) {
      var d = Meta.data.weaponLevel[this.selected],
        pts = type === CONFIG.ENEMY.TYPE_TANK ? 2 : type === CONFIG.ENEMY.TYPE_ELITE ? 15 : type === CONFIG.ENEMY.TYPE_BOSS || type === CONFIG.ENEMY.TYPE_BOSS_RANGED ? 100 : 1;
      d.pts += pts;
      while (d.pts >= this.need(d.lv)) {
        d.pts -= this.need(d.lv);
        d.lv++;
      }
      this.saveTimer = 5;
    },
    update: function (dt) {
      if (this.saveTimer > 0 && (this.saveTimer -= dt) <= 0) Meta.save(false);
    }
  };
  root.WeaponProgress = WeaponProgress;
  function laserRayDistance(x, y, a) {
    var dx = Math.cos(a),
      dy = Math.sin(a),
      best = 99999;
    if (dx > 0) best = Math.min(best, (CONFIG.WORLD.WIDTH - x) / dx);else if (dx < 0) best = Math.min(best, (0 - x) / dx);
    if (dy > 0) best = Math.min(best, (CONFIG.WORLD.HEIGHT - y) / dy);else if (dy < 0) best = Math.min(best, (0 - y) / dy);
    return Math.max(0, best);
  }
  function normTwoPi(a) {
    a = a % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return a;
  }
  function sectorHit(ea, s0, s1, halfW) {
    var sweep = s1 - s0;
    if (sweep < 0) sweep += Math.PI * 2;
    var dA = normTwoPi(ea - s0);
    if (dA <= sweep + halfW) return true;
    if (Math.PI * 2 - dA <= halfW) return true;
    return false;
  }
  function selectedMainDamage() {
    var id = WeaponProgress.selected || Meta.data.selectedWeapon || 'pistol';
    if (id === 'flamer') return CONFIG.CONTENT.FLAME.DAMAGE * FlameWeapon.damageMul;
    if (id === 'crossbow') return Crossbow.damage;
    return PulseGun.getDamage();
  }
  var MortarFX = {
    shells: [],
    trails: [],
    groups: [],
    burns: [],
    smoke: [],
    sparks: [],
    init: function () {
      for (var i = 0; i < 10; i++) this.shells.push({
        active: false
      });
      for (var i = 0; i < 60; i++) this.trails.push({
        active: false
      });
      for (var i = 0; i < 3; i++) this.groups.push({
        active: false
      });
      for (var i = 0; i < 10; i++) this.burns.push({
        active: false
      });
      for (var i = 0; i < 20; i++) this.smoke.push({
        active: false
      });
      for (var i = 0; i < 30; i++) this.sparks.push({
        active: false
      });
    },
    reset: function () {
      var pools = [this.shells, this.trails, this.groups, this.burns, this.smoke, this.sparks];
      for (var p = 0; p < pools.length; p++) for (var i = 0; i < pools[p].length; i++) pools[p][i].active = false;
    },
    spawnShell: function (tx, ty, delay) {
      for (var i = 0; i < this.shells.length; i++) {
        var s = this.shells[i];
        if (s.active) continue;
        s.active = true;
        s.tx = tx;
        s.ty = ty;
        s.t = -delay;
        s.duration = 2;
        s.sx = tx - 260;
        s.sy = ty - 620;
        s.x = s.sx;
        s.y = s.sy;
        s.angle = 0;
        s.trail = 0;
        return;
      }
    },
    explode: function (s) {
      s.active = false;
      for (var i = 0; i < this.groups.length; i++) if (!this.groups[i].active) {
        var g = this.groups[i];
        g.active = true;
        g.x = s.tx;
        g.y = s.ty;
        g.life = 3;
        g.burn = Meta.getGadgetLevel('mortar', 'burn') > 0;
        break;
      }
      if (Meta.getGadgetLevel('mortar', 'burn') > 0) for (var i = 0; i < this.burns.length; i++) if (!this.burns[i].active) {
        var b = this.burns[i];
        b.active = true;
        b.x = s.tx;
        b.y = s.ty;
        b.life = 3;
        break;
      }
      for (var i = 0, m = 0; i < this.smoke.length && m < 7; i++) if (!this.smoke[i].active) {
        var q = this.smoke[i];
        q.active = true;
        q.x = s.tx + (Math.random() * 2 - 1) * 35;
        q.y = s.ty;
        q.vx = (Math.random() * 2 - 1) * 28;
        q.vy = -20 - Math.random() * 25;
        q.r = 15 + Math.random() * 10;
        q.life = 1;
        m++;
      }
      for (var i = 0, m = 0; i < this.sparks.length && m < 12; i++) if (!this.sparks[i].active) {
        var q = this.sparks[i],
          a = Math.random() * Math.PI * 2,
          sp = 100 + Math.random() * 100;
        q.active = true;
        q.x = s.tx;
        q.y = s.ty;
        q.vx = Math.cos(a) * sp;
        q.vy = Math.sin(a) * sp - 80;
        q.r = 2 + Math.random() * 2;
        q.life = .5;
        m++;
      }
      if (root.Settings.shake) root.Camera.startShake(3, .15);
      root.MortarStrike._explode({
        targetX: s.tx,
        targetY: s.ty
      });
    },
    update: function (dt) {
      for (var i = 0; i < this.shells.length; i++) {
        var s = this.shells[i];
        if (!s.active) continue;
        s.t += dt;
        if (s.t < 0) continue;
        var f = Math.min(1, s.t / s.duration);
        s.x = s.sx + (s.tx - s.sx) * f;
        s.y = s.sy + (s.ty - s.sy) * f - 150 * Math.sin(f * Math.PI);
        s.angle += 2 * dt;
        s.trail -= dt;
        if (s.trail <= 0) {
          s.trail = .02;
          this.spawnTrail(s.x, s.y);
        }
        if (f >= 1) this.explode(s);
      }
      this.updateParticles(dt);
    },
    spawnTrail: function (x, y) {
      for (var i = 0; i < this.trails.length; i++) if (!this.trails[i].active) {
        var p = this.trails[i];
        p.active = true;
        p.x = x;
        p.y = y;
        p.life = .3;
        return;
      }
    },
    updateParticles: function (dt) {
      for (var i = 0; i < this.trails.length; i++) if (this.trails[i].active && (this.trails[i].life -= dt) <= 0) this.trails[i].active = false;
      for (var i = 0; i < this.groups.length; i++) {
        var g = this.groups[i];
        if (!g.active) continue;
        if ((g.life -= dt) <= 0) g.active = false;
      }
      for (var i = 0; i < this.burns.length; i++) {
        var b = this.burns[i];
        if (!b.active) continue;
        this.burnTick(b, dt);
        if ((b.life -= dt) <= 0) b.active = false;
      }
      for (var i = 0; i < this.smoke.length; i++) {
        var p = this.smoke[i];
        if (!p.active) continue;
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life <= 0) p.active = false;
      }
      for (var i = 0; i < this.sparks.length; i++) {
        var p = this.sparks[i];
        if (!p.active) continue;
        p.life -= dt;
        p.vy += 400 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life <= 0) p.active = false;
      }
    },
    burnTick: function (g, dt) {
      var r = 80,
        dmg = root.MortarStrike._baseDmg() * CONFIG.MORTAR.BURN_DPS_RATIO * Meta.getGadgetLevel('mortar', 'burn') * dt;
      for (var i = 0; i < Enemy.pool.length; i++) {
        var e = Enemy.pool[i];
        if (!e.active) continue;
        var dx = e.x - g.x,
          dy = e.y - g.y;
        if (dx * dx + dy * dy <= r * r) root.Combat.hitEnemyFixed(e, dmg, e.x, e.y);
      }
    },
    draw: function (ctx) {
      for (var i = 0; i < this.groups.length; i++) {
        var g = this.groups[i];
        if (!g.active) continue;
        var x = g.x - Camera.x,
          y = g.y - Camera.y,
          age = 3 - g.life;
        ctx.save();
        if (age < .1) {
          ctx.globalAlpha = 1 - age / .1;
          var gr = ctx.createRadialGradient(x, y, 0, x, y, 60);
          root.safeStop(gr, 0, '#fff');
          root.safeStop(gr, 1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(x, y, 60, 0, Math.PI * 2);
          ctx.fill();
        }
        if (age < .3) {
          ctx.globalAlpha = .9 - age * 1.7;
          var r = 80 * Math.min(1, age / .3),
            gr = ctx.createRadialGradient(x, y, 0, x, y, r);
          root.safeStop(gr, 0, '#F1C40F');
          root.safeStop(gr, 1, '#E74C3C');
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = .4 * g.life / 3;
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(x, y, 80, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      this.drawParticles(ctx);
      for (var i = 0; i < this.shells.length; i++) {
        var s = this.shells[i];
        if (!s.active || s.t < 0) continue;
        var f = Math.min(1, s.t / s.duration),
          remain = s.duration - s.t,
          x = s.tx - Camera.x,
          y = s.ty - Camera.y;
        if (remain <= 1.5) {
          var wr = 80 + 40 * (remain / 1.5);
          ctx.save();
          ctx.globalAlpha = .8;
          ctx.strokeStyle = '#E74C3C';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, wr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = .15 + .15 * (1 - remain / 1.5);
          ctx.fillStyle = '#E74C3C';
          ctx.fill();
          ctx.globalAlpha = .9;
          ctx.beginPath();
          ctx.moveTo(x - 10, y);
          ctx.lineTo(x + 10, y);
          ctx.moveTo(x, y - 10);
          ctx.lineTo(x, y + 10);
          ctx.stroke();
          ctx.font = 'bold 28px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('!', x, y - wr - 10 + Math.sin(s.t * Math.PI * 4) * 5);
          ctx.restore();
        }
        ctx.save();
        ctx.translate(s.x - Camera.x, s.y - Camera.y);
        ctx.rotate(s.angle);
        ctx.fillStyle = '#343a40';
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E74C3C';
        ctx.globalAlpha = .5 + .5 * Math.sin(s.t * Math.PI * 10);
        ctx.beginPath();
        ctx.arc(7, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#687078';
        ctx.beginPath();
        ctx.moveTo(-7, -3);
        ctx.lineTo(-13, -8);
        ctx.lineTo(-11, -1);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-7, 3);
        ctx.lineTo(-13, 8);
        ctx.lineTo(-11, 1);
        ctx.fill();
        ctx.restore();
      }
    },
    drawParticles: function (ctx) {
      for (var g = 0; g < this.groups.length; g++) {
        var z = this.groups[g];
        if (!z.active || !z.burn) continue;
        var fade = Math.min(1, z.life / .3);
        for (var f = 0; f < 10; f++) {
          var a = f * Math.PI * 2 / 10,
            rr = 25 + f % 3 * 20,
            fx = z.x - Camera.x + Math.cos(a) * rr + Math.sin(Date.now() / 180 + f) * 4,
            fy = z.y - Camera.y + Math.sin(a) * rr;
          ctx.globalAlpha = .7 * fade;
          ctx.fillStyle = f % 2 ? '#E74C3C' : '#F39C12';
          ctx.beginPath();
          ctx.moveTo(fx - 5, fy + 8);
          ctx.quadraticCurveTo(fx, fy - 10 - f % 3 * 5, fx + 5, fy + 8);
          ctx.fill();
        }
      }
      for (var i = 0; i < this.trails.length; i++) {
        var p = this.trails[i];
        if (!p.active) continue;
        ctx.globalAlpha = p.life / .3;
        ctx.fillStyle = p.life > .2 ? '#ffe066' : '#ff6b35';
        ctx.beginPath();
        ctx.arc(p.x - Camera.x, p.y - Camera.y, 3 + p.life * 12, 0, Math.PI * 2);
        ctx.fill();
      }
      for (var i = 0; i < this.smoke.length; i++) {
        var p = this.smoke[i];
        if (!p.active) continue;
        ctx.globalAlpha = .6 * p.life;
        ctx.fillStyle = '#42464b';
        ctx.beginPath();
        ctx.arc(p.x - Camera.x, p.y - Camera.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (var i = 0; i < this.sparks.length; i++) {
        var p = this.sparks[i];
        if (!p.active) continue;
        ctx.globalAlpha = p.life / .5;
        ctx.fillStyle = '#ff6b35';
        ctx.beginPath();
        ctx.arc(p.x - Camera.x, p.y - Camera.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  };
  root.MortarFX = MortarFX;
})();

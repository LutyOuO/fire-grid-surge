(function () {
  'use strict';

  // 敌人：对象池、波次属性、避障、眩晕/冻结、Boss 与命中反馈。
  var root = typeof window !== 'undefined' ? window : global;
  var CONFIG = root.CONFIG;
  // 归一化两方向角的最短夹角（弧度，取绝对值）。
  function wallAngDiff(a, b) {
    var d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  }
  var Enemy = {
    pool: [],
    activeCount: 0,
    nextSpawnId: 1,
    bossProjectiles: [],
    pendingBlasts: [],
    initPool: function () {
      this.pool.length = 0;
      for (var i = 0; i < CONFIG.ENEMY.POOL_SIZE; i++) {
        this.pool.push({
          active: false,
          x: 0,
          y: 0,
          hp: 0,
          maxHp: 0,
          speed: 0,
          radius: 0,
          contactDamage: 0,
          typeIndex: CONFIG.ENEMY.TYPE_WALKER,
          bladeCooldown: 0,
          spawnId: 0,
          hitFlash: 0,
          bossAttackTimer: 0,
          bossChargeTimer: 0,
          bossTargetX: 0,
          bossTargetY: 0
        });
      }
      this.bossProjectiles.length = 0;
      for (var j = 0; j < CONFIG.BOSS_RANGED.PROJECTILE_POOL; j++) {
        this.bossProjectiles.push({
          active: false,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          tx: 0,
          ty: 0,
          life: 0
        });
      }
    },
    reset: function () {
      this.activeCount = 0;
      this.nextSpawnId = 1;
      for (var i = 0; i < this.pool.length; i++) this.pool[i].active = false;
      for (var j = 0; j < this.bossProjectiles.length; j++) this.bossProjectiles[j].active = false;
      this.pendingBlasts.length = 0;
    },
    spawn: function (x, y, typeIndex, hpMultiplier) {
      for (var i = 0; i < this.pool.length; i++) {
        var enemy = this.pool[i];
        if (!enemy.active) {
          var type = CONFIG.ENEMY.TYPES[typeIndex];
          enemy.active = true;
          enemy.x = x;
          enemy.y = y;
          enemy.typeIndex = typeIndex;
          enemy.radius = type.RADIUS;
          enemy.speed = type.SPEED;
          enemy.contactDamage = type.DAMAGE;
          enemy.maxHp = Math.ceil(type.HP * hpMultiplier * (Player.nextEnemyHp || 1));
          enemy.hp = enemy.maxHp;
          enemy.bladeCooldown = 0;
          enemy.hitFlash = 0;
          enemy.bossAttackTimer = CONFIG.BOSS_RANGED.ATTACK_INTERVAL;
          enemy.bossChargeTimer = 0;
          enemy.bossTargetX = 0;
          enemy.bossTargetY = 0;
          enemy.stunTimer = 0;
          enemy.freezeTimer = 0;
          enemy.mortarBurnTime = 0;
          enemy.mortarBurnTick = 0;
          enemy.mortarBurnDps = 0;
          enemy.slowMul = 1;
          enemy.affixes = [];
          enemy.affixShield = 0;
          enemy.affixBlast = false;
          enemy.affixSplit = false;
          enemy.gunnerTimer = 0;
          enemy.frostTouched = {};
          enemy.bossChargeTimer = 0;
          enemy.bossTargetX = 0;
          enemy.bossTargetY = 0;
          enemy.meleePhase = 'idle';
          enemy.meleeTimer = CONFIG.BOSS_MELEE.CHARGE_COOLDOWN * 0.45;
          enemy.meleeTx = 0;
          enemy.meleeTy = 0;
          enemy.chargeHit = false;
          enemy.baseContact = enemy.contactDamage;
          enemy.isSummonTurret = false;
          enemy.summonedTurrets = false;
          enemy.summonerId = 0;
          enemy.spawnId = this.nextSpawnId;
          this.nextSpawnId += 1;
          this.activeCount += 1;
          this.applyWaveStats(enemy, typeIndex);
          return enemy;
        }
      }
      return null;
    },
    update: function (dt) {
      for (var i = 0; i < this.pool.length; i++) {
        var enemy = this.pool[i];
        if (!enemy.active) continue;
        this.updateMortarBurn(enemy, dt);
        if (!enemy.active) continue;
        enemy.stunTimer = Math.max(0, (enemy.stunTimer || 0) - dt);
        if (enemy.specialSlowTimer > 0) {
          enemy.specialSlowTimer = Math.max(0, enemy.specialSlowTimer - dt);
          if (enemy.specialSlowTimer === 0) { enemy.slowMul = 1; enemy.specialVulnerable = 1; }
        }
        if (enemy.allyTimer > 0) {
          enemy.allyTimer = Math.max(0, enemy.allyTimer - dt);
          this.updateCorruptAlly(enemy, dt);
          continue;
        }
        enemy.freezeTimer = Math.max(0, (enemy.freezeTimer || 0) - dt);
        if (enemy.freezeTimer > 0) continue;
        if (!PowerUps.isFrozen()) {
          if (enemy.isSummonTurret) {
            this.updateBossRanged(enemy, dt * Player.enemySpeedMultiplier);
          } else if (enemy.typeIndex === CONFIG.ENEMY.TYPE_BOSS) {
            if (!this.updateBossMelee(enemy, dt * Player.enemySpeedMultiplier)) this.moveTowardPlayer(enemy, dt);
          } else {
            this.moveTowardPlayer(enemy, dt);
            if (enemy.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED) {
              this.updateBossRanged(enemy, dt * Player.enemySpeedMultiplier);
            }
          }
          if (enemy.affixes && enemy.affixes.indexOf('gunner') >= 0) this.updateGunner(enemy, dt);
        }
        if (enemy.bladeCooldown > 0) {
          enemy.bladeCooldown = Math.max(0, enemy.bladeCooldown - dt);
        }
        if (enemy.hitFlash > 0) {
          enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
        }
      }
      this.updateBlasts(dt);
      if (root.Spatial) root.Spatial.rebuild();
    },
    // 重复命中刷新持续时间，保留较强燃烧；击杀归属迫击炮。
    applyMortarBurn: function (e, dps) {
      if (!e.active || dps <= 0) return;
      e.mortarBurnTime = CONFIG.TURRETS.KINDS.mortar.BURN_DURATION;
      e.mortarBurnDps = Math.max(e.mortarBurnDps || 0, dps);
    },
    updateMortarBurn: function (e, dt) {
      if (!(e.mortarBurnTime > 0)) return;
      var elapsed = Math.min(dt, e.mortarBurnTime);
      e.mortarBurnTime = Math.max(0, e.mortarBurnTime - elapsed);
      e.mortarBurnTick = (e.mortarBurnTick || 0) + elapsed;
      if (e.mortarBurnTick + 1e-9 < CONFIG.PRODUCT.BURN_TICK && e.mortarBurnTime > 1e-9) return;
      var source = root.Combat.killSource;
      root.Combat.killSource = 'mortar';
      try { this.applyDamage(e, e.mortarBurnDps * e.mortarBurnTick); }
      finally { root.Combat.killSource = source; }
      e.mortarBurnTick = 0;
      if (e.mortarBurnTime <= 1e-9) e.mortarBurnDps = 0;
    },
    moveTowardPlayer: function (e, dt) {
      if (e.stunTimer > 0) return;
      var dx = Player.x - e.x,
        dy = Player.y - e.y,
        base = Math.atan2(dy, dx),
        angle = e.avoidTime > 0 ? e.avoidAngle : base;
      e.avoidCheck -= dt;
      e.avoidTime = Math.max(0, e.avoidTime - dt);
      if (e.avoidCheck <= 0) {
        e.avoidCheck = .2;
        var probe = Math.max(35, e.speed * .35),
          px = e.x + Math.cos(base) * probe,
          py = e.y + Math.sin(base) * probe;
        if (root.WallCollision.inside(px, py, e.radius)) {
          // v012 #69：前方挡墙时沿墙面切向滑动。切向与墙面法线垂直，
          // 前进分量不再被 Field.collideWalls 推墙抵消，滑动速度=正常追击速度。
          var slide = this.wallSlideAngle(e, base, px, py, probe);
          if (slide !== null) {
            e.avoidAngle = slide;
            angle = slide;
            e.avoidTime = .3;
          } else {
            // 角落退化：两侧切向都被堵，回退 ±45° 试探
            var a1 = base - Math.PI / 4,
              a2 = base + Math.PI / 4,
              p1 = !root.WallCollision.inside(e.x + Math.cos(a1) * probe, e.y + Math.sin(a1) * probe, e.radius),
              p2 = !root.WallCollision.inside(e.x + Math.cos(a2) * probe, e.y + Math.sin(a2) * probe, e.radius);
            if (p1 || p2) {
              if (p1 && p2) {
                var d1 = Math.hypot(Player.x - (e.x + Math.cos(a1) * probe), Player.y - (e.y + Math.sin(a1) * probe)),
                  d2 = Math.hypot(Player.x - (e.x + Math.cos(a2) * probe), Player.y - (e.y + Math.sin(a2) * probe));
                angle = d1 < d2 ? a1 : a2;
              } else angle = p1 ? a1 : a2;
              e.avoidAngle = angle;
              e.avoidTime = .3;
            } else {
              e.avoidTime = .12;
              angle = base + Math.PI / 2;
            }
          }
        } else if (e.avoidTime > 0) {
          // 通路已打开：立即恢复朝玩家，不再继续蹭墙
          e.avoidTime = 0;
          e.avoidAngle = 0;
          angle = base;
        }
      }
      var sepX = 0,
        sepY = 0;
      if (e.avoidCheck > .19 && root.Spatial) {
        var searchRadius = e.radius + CONFIG.ENEMY.MAX_RADIUS + 5;
        root.Spatial.forEachInRadius(e.x, e.y, searchRadius, function (o) {
          if (o === e) return;
          var sx = e.x - o.x, sy = e.y - o.y,
            rr = e.radius + o.radius + 5, d2 = sx * sx + sy * sy;
          if (d2 > 0 && d2 < rr * rr) {
            var d = Math.sqrt(d2);
            sepX += sx / d * (rr - d) / rr;
            sepY += sy / d * (rr - d) / rr;
          }
        });
      }
      var speed = e.speed * Player.enemySpeedMultiplier * (e.slowMul || 1);
      e.x += (Math.cos(angle) + sepX * .45) * speed * dt;
      e.y += (Math.sin(angle) + sepY * .45) * speed * dt;
      e.x = Math.max(e.radius, Math.min(CONFIG.WORLD.WIDTH - e.radius, e.x));
      e.y = Math.max(e.radius, Math.min(CONFIG.WORLD.HEIGHT - e.radius, e.y));
      var p = Field.collideWalls(e.x, e.y, e.radius);
      e.x = p.x;
      e.y = p.y;
    },
    // v012 #69：探测点 (px,py) 落入某面墙时，返回沿该墙切向、且偏向玩家一侧的滑动方向角；
    // 两侧切向都被堵时返回 null（由调用方回退到 ±45° 试探）。
    wallSlideAngle: function (e, base, px, py, probe) {
      var walls = CONFIG.FIELD.WALLS;
      for (var i = 0; i < walls.length; i++) {
        var w = walls[i];
        if (px < w.x - e.radius || px > w.x + w.w + e.radius) continue;
        if (py < w.y - e.radius || py > w.y + w.h + e.radius) continue;
        // 敌人到这面墙最近点的法线方向
        var cx = Math.max(w.x, Math.min(e.x, w.x + w.w)),
          cy = Math.max(w.y, Math.min(e.y, w.y + w.h)),
          nx = cx - e.x,
          ny = cy - e.y,
          nd = Math.hypot(nx, ny);
        if (nd < 0.001) continue;
        // 切向 = 法线逆时针旋转 90°
        var a1 = Math.atan2(nx / nd, -ny / nd);
        var a2 = a1 + Math.PI;
        var clear1 = !root.WallCollision.inside(e.x + Math.cos(a1) * probe, e.y + Math.sin(a1) * probe, e.radius);
        var clear2 = !root.WallCollision.inside(e.x + Math.cos(a2) * probe, e.y + Math.sin(a2) * probe, e.radius);
        if (!clear1 && !clear2) continue;
        if (clear1 && clear2) {
          // 已在沿墙滑动且新方向仍畅通：保持原方向（迟滞），避免在墙前来回抖动
          if (e.avoidTime > 0 && e.avoidAngle) {
            return wallAngDiff(e.avoidAngle, a1) < wallAngDiff(e.avoidAngle, a2) ? a1 : a2;
          }
          // 首次选择：选探测点离玩家更近的一侧，即绕向更近的墙角
          var g1x = e.x + Math.cos(a1) * probe,
            g1y = e.y + Math.sin(a1) * probe,
            g2x = e.x + Math.cos(a2) * probe,
            g2y = e.y + Math.sin(a2) * probe;
          var h1 = Math.hypot(Player.x - g1x, Player.y - g1y),
            h2 = Math.hypot(Player.x - g2x, Player.y - g2y);
          return h1 < h2 ? a1 : a2;
        }
        return clear1 ? a1 : a2;
      }
      return null;
    },
    // ---------- 近战Boss：预警线后冲锋 ----------
    updateBossMelee: function (enemy, dt) {
      var cfg = CONFIG.BOSS_MELEE;
      if (!cfg) return false;
      if (enemy.stunTimer > 0) {
        if (enemy.meleePhase === 'warn' || enemy.meleePhase === 'dash') {
          enemy.meleePhase = 'idle';
          enemy.meleeTimer = cfg.CHARGE_COOLDOWN * 0.4;
          if (enemy.baseContact) enemy.contactDamage = enemy.baseContact;
        }
        return false;
      }
      var dx = Player.x - enemy.x, dy = Player.y - enemy.y;
      var dist = Math.hypot(dx, dy);
      if (!enemy.meleePhase) enemy.meleePhase = 'idle';
      if (enemy.meleePhase === 'idle') {
        enemy.meleeTimer -= dt;
        if (enemy.meleeTimer <= 0 && dist >= cfg.CHARGE_RANGE_MIN && dist <= cfg.CHARGE_RANGE_MAX) {
          enemy.meleePhase = 'warn';
          enemy.meleeTimer = cfg.CHARGE_WARN;
          enemy.meleeTx = Player.x;
          enemy.meleeTy = Player.y;
          return true;
        }
        return false;
      }
      if (enemy.meleePhase === 'warn') {
        enemy.meleeTimer -= dt;
        if (enemy.meleeTimer <= 0) {
          enemy.meleePhase = 'dash';
          enemy.meleeTimer = cfg.CHARGE_DURATION;
          enemy.chargeHit = false;
          enemy.baseContact = enemy.contactDamage;
          enemy.contactDamage = Math.ceil(enemy.contactDamage * cfg.CHARGE_DAMAGE_MUL);
          if (root.FX) root.FX.shake = Math.max(root.FX.shake || 0, CONFIG.POLISH.SHAKE_TIME);
        }
        return true;
      }
      if (enemy.meleePhase === 'dash') {
        var tx = enemy.meleeTx - enemy.x, ty = enemy.meleeTy - enemy.y;
        var d = Math.hypot(tx, ty);
        var step = cfg.CHARGE_SPEED * dt;
        if (d > 1) {
          enemy.x += tx / d * Math.min(step, d);
          enemy.y += ty / d * Math.min(step, d);
        }
        if (root.Field && Field.collideWalls) {
          var p = Field.collideWalls(enemy.x, enemy.y, enemy.radius);
          enemy.x = p.x;
          enemy.y = p.y;
        }
        enemy.x = Math.max(enemy.radius, Math.min(CONFIG.WORLD.WIDTH - enemy.radius, enemy.x));
        enemy.y = Math.max(enemy.radius, Math.min(CONFIG.WORLD.HEIGHT - enemy.radius, enemy.y));
        enemy.meleeTimer -= dt;
        if (enemy.meleeTimer <= 0 || d <= step) {
          enemy.meleePhase = 'idle';
          enemy.meleeTimer = cfg.CHARGE_COOLDOWN;
          if (enemy.baseContact) enemy.contactDamage = enemy.baseContact;
        }
        return true;
      }
      return false;
    },
    // ---------- 远程Boss：畸变炮台者 ----------
    isCharging: function (enemy) {
      return enemy.bossChargeTimer > 0;
    },
    bossRangedCharge: function (enemy) {
      return enemy.isSummonTurret ? CONFIG.BOSS_SUMMON.CHARGE_TIME : CONFIG.BOSS_RANGED.CHARGE_TIME;
    },
    bossRangedInterval: function (enemy) {
      return enemy.isSummonTurret ? CONFIG.BOSS_SUMMON.INTERVAL : CONFIG.BOSS_RANGED.ATTACK_INTERVAL;
    },
    updateBossRanged: function (enemy, dt) {
      if (enemy.stunTimer > 0) return;
      if (enemy.bossChargeTimer > 0) {
        enemy.bossChargeTimer -= dt;
        enemy.bossTargetX = Player.x;
        enemy.bossTargetY = Player.y;
        if (enemy.bossChargeTimer <= 0) {
          this.fireBossProjectile(enemy);
          enemy.bossAttackTimer = this.bossRangedInterval(enemy);
        }
      } else {
        enemy.bossAttackTimer -= dt;
        if (enemy.bossAttackTimer <= 0) {
          enemy.bossChargeTimer = this.bossRangedCharge(enemy);
          enemy.bossTargetX = Player.x;
          enemy.bossTargetY = Player.y;
        }
      }
    },
    // 腐化敌人暂时成为盟友：追击最近的非盟友敌人并持续造成接触伤害。
    updateCorruptAlly: function (ally, dt) {
      var target = null, best = Infinity;
      for (var i = 0; i < this.pool.length; i++) {
        var e = this.pool[i]; if (!e.active || e === ally || e.allyTimer > 0) continue;
        var dx = e.x - ally.x, dy = e.y - ally.y, d2 = dx * dx + dy * dy;
        if (d2 < best) { best = d2; target = e; }
      }
      if (!target) return;
      var dist = Math.sqrt(best) || 1, step = ally.speed * dt;
      ally.x += (target.x - ally.x) / dist * step; ally.y += (target.y - ally.y) / dist * step;
      ally.allyAttackTimer = Math.max(0, (ally.allyAttackTimer || 0) - dt);
      if (dist <= ally.radius + target.radius + 8 && ally.allyAttackTimer <= 0) {
        ally.allyAttackTimer = CONFIG.ARMORY.ALLY_ATTACK_INTERVAL;
        this.applyDamage(target, ally.allyDamage || 1);
      }
    },
    fireBossProjectile: function (enemy) {
      var tx = enemy.bossTargetX,
        ty = enemy.bossTargetY;
      var dx = tx - enemy.x,
        dy = ty - enemy.y;
      var dist = Math.hypot(dx, dy);
      if (dist <= 0) {
        dx = 0;
        dy = -1;
        dist = 1;
      }
      var speed = CONFIG.BOSS_RANGED.PROJECTILE_SPEED;
      for (var i = 0; i < this.bossProjectiles.length; i++) {
        var p = this.bossProjectiles[i];
        if (p.active) continue;
        p.active = true;
        p.x = enemy.x;
        p.y = enemy.y;
        p.vx = dx / dist * speed;
        p.vy = dy / dist * speed;
        p.tx = tx;
        p.ty = ty;
        p.life = 0;
        return;
      }
    },
    updateBossProjectiles: function (dt) {
      for (var i = 0; i < this.bossProjectiles.length; i++) {
        var p = this.bossProjectiles[i];
        if (p.active && root.WallCollision.segment(p.x, p.y, p.x + p.vx * dt, p.y + p.vy * dt, CONFIG.BOSS_RANGED.PROJECTILE_RADIUS)) {
          p.active = false;
          if (root.FX) root.FX.burst(p.x, p.y, CONFIG.COLORS.WALL_EDGE);
        }
      }
      for (var i = 0; i < this.bossProjectiles.length; i++) {
        var p = this.bossProjectiles[i];
        if (!p.active) continue;
        p.life += dt;
        // 朝目标点直线飞行
        var dx = p.tx - p.x,
          dy = p.ty - p.y;
        var dist = Math.hypot(dx, dy);
        var step = Math.hypot(p.vx, p.vy) * dt;
        var reached = dist <= step;
        if (!reached && dist > 0) {
          p.x += dx / dist * step;
          p.y += dy / dist * step;
        }
        // 严格世界边界回收（飞出地图即爆炸消散）
        if (p.x < 0 || p.x > CONFIG.WORLD.WIDTH || p.y < 0 || p.y > CONFIG.WORLD.HEIGHT) {
          this.explodeBossProjectile(p.x, p.y, true);
          p.active = false;
          continue;
        }
        // 命中玩家
        var hitR = CONFIG.BOSS_RANGED.PROJECTILE_RADIUS + CONFIG.PLAYER.RADIUS;
        var pdx = Player.x - p.x,
          pdy = Player.y - p.y;
        var directHit = pdx * pdx + pdy * pdy <= hitR * hitR;
        if (directHit) {
          // 直接命中：30 伤害，爆炸不再重复伤害命中者
          Player.takeDamage(CONFIG.BOSS_RANGED.PROJECTILE_DAMAGE, 'boss');
          this.explodeBossProjectile(p.x, p.y, false);
          p.active = false;
          continue;
        }
        // 到达目标点：范围爆炸
        if (reached) {
          this.explodeBossProjectile(p.x, p.y, true);
          p.active = false;
        }
      }
    },
    explodeBossProjectile: function (x, y, damagePlayer) {
      if (root.FX && root.FX.burst) root.FX.burst(x, y, CONFIG.COLORS.BOSS_RANGED_PROJECTILE_GLOW);
      if (damagePlayer) {
        var r = CONFIG.BOSS_RANGED.EXPLOSION_RADIUS;
        var dx = Player.x - x,
          dy = Player.y - y;
        if (dx * dx + dy * dy <= r * r) {
          Player.takeDamage(CONFIG.BOSS_RANGED.EXPLOSION_DAMAGE, 'boss');
        }
      }
    },
    drawRangedBossDetails: function (ctx, enemy, sx, sy) {
      // 背部酸性肿瘤炮台（深紫）
      var turretR = CONFIG.BOSS_RANGED.TURRET_RADIUS;
      var now = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
      var breathe = Math.sin(now * 2.5) * 3;
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy - enemy.radius * 0.5 + breathe, turretR, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.COLORS.BOSS_RANGED_CORE;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = CONFIG.COLORS.BOSS_RANGED_OUTLINE;
      ctx.stroke();
      // 荧光绿脉动光点（蓄力时变亮）
      var chargeRatio = this.isCharging(enemy) ? 1 - enemy.bossChargeTimer / this.bossRangedCharge(enemy) : 0;
      var glow = 0.5 + chargeRatio * 1.0 + Math.sin(now * 6) * 0.15;
      ctx.beginPath();
      ctx.arc(sx, sy - enemy.radius * 0.5 + breathe, 7, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.COLORS.BOSS_RANGED_PROJECTILE_GLOW;
      ctx.shadowColor = CONFIG.COLORS.BOSS_RANGED_PROJECTILE_GLOW;
      ctx.shadowBlur = 12 * glow;
      ctx.fill();
      ctx.restore();
      // 蓄力红色虚线瞄准线
      if (this.isCharging(enemy)) {
        var ax = enemy.bossTargetX - Camera.x;
        var ay = enemy.bossTargetY - Camera.y;
        ctx.save();
        ctx.strokeStyle = CONFIG.COLORS.AIM_LINE;
        ctx.lineWidth = CONFIG.BOSS_RANGED.AIM_LINE_WIDTH;
        ctx.setLineDash([CONFIG.BOSS_RANGED.AIM_DASH, CONFIG.BOSS_RANGED.AIM_DASH]);
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.moveTo(sx, sy - enemy.radius * 0.5);
        ctx.lineTo(ax, ay);
        ctx.stroke();
        ctx.restore();
      }
    },
    drawBossProjectiles: function (ctx) {
      for (var i = 0; i < this.bossProjectiles.length; i++) {
        var p = this.bossProjectiles[i];
        if (!p.active) continue;
        var sx = p.x - Camera.x,
          sy = p.y - Camera.y;
        // 落点预警圈
        var wx = p.tx - Camera.x,
          wy = p.ty - Camera.y;
        ctx.save();
        ctx.beginPath();
        ctx.arc(wx, wy, CONFIG.BOSS_RANGED.EXPLOSION_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.COLORS.WARNING_CIRCLE;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = CONFIG.COLORS.AIM_LINE;
        ctx.stroke();
        ctx.restore();
        // 绿色拖尾
        var speed = Math.hypot(p.vx, p.vy);
        if (speed > 0) {
          var tx = sx - p.vx / speed * 40;
          var ty = sy - p.vy / speed * 40;
          ctx.save();
          ctx.strokeStyle = CONFIG.COLORS.BOSS_RANGED_PROJECTILE_GLOW;
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(sx, sy);
          ctx.stroke();
          ctx.restore();
        }
        // 深紫球体
        ctx.save();
        ctx.shadowColor = CONFIG.COLORS.BOSS_RANGED_PROJECTILE_GLOW;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(sx, sy, CONFIG.BOSS_RANGED.PROJECTILE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.COLORS.BOSS_RANGED_PROJECTILE;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(sx, sy, CONFIG.BOSS_RANGED.PROJECTILE_RADIUS * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.COLORS.BOSS_RANGED_PROJECTILE_GLOW;
        ctx.fill();
        ctx.restore();
      }
    },
    applyDamage: function (e, damage) {
      if (!e.active) return;
      damage *= e.specialVulnerable || 1;
      if (e.affixShield > 0) {
        var absorb = Math.min(e.affixShield, damage);
        e.affixShield -= absorb;
        damage -= absorb;
        e.hitFlash = CONFIG.POLISH.HIT_FLASH;
        if (damage <= 0) return;
      }
      e.hitFlash = CONFIG.POLISH.HIT_FLASH;
      // v014 #96 普通命中轻量反馈：只 hitFlash + 轻点音，不再每击震屏（震屏只给精英/BOSS/暴击）。
      AudioFX.play('hit');
      this.receiveDamage(e, damage);
    },
    // v014 #96 击杀反馈分级：普通=小粒子，精英=大粒子+强音+震屏，BOSS/远程BOSS=超大爆炸+最强音+震屏+慢动作。
    killFeedback: function (e, typeIndex) {
      if (typeIndex === CONFIG.ENEMY.TYPE_BOSS || (typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED && !e.isSummonTurret)) {
        root.FX.feedbackBossKill(e.x, e.y);
      } else if (typeIndex === CONFIG.ENEMY.TYPE_ELITE) {
        root.FX.feedbackEliteKill(e.x, e.y);
      } else {
        root.FX.burst(e.x, e.y);
      }
    },
    kill: function (enemy) {
      if (!enemy.active) return;
      var blast = enemy.affixBlast, split = enemy.affixSplit, dropX = enemy.x, dropY = enemy.y;
      var typeIndex = enemy.typeIndex;
      this.killFeedback(enemy, typeIndex);
      this.recordKill(enemy);
      var type = CONFIG.ENEMY.TYPES[typeIndex];
      enemy.active = false;
      this.activeCount -= 1;
      RunStats.kills += 1;
      // v012 #73 按类型击杀计数（仅累加，不改 AI/伤害）：普通=walker/runner/tank，精英，BOSS=近战大Boss，特殊=远程Boss（召唤炮台不计特殊）。
      if (typeIndex === CONFIG.ENEMY.TYPE_ELITE) RunStats.killElite += 1;
      else if (typeIndex === CONFIG.ENEMY.TYPE_BOSS) RunStats.killBoss += 1;
      else if (typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED && !enemy.isSummonTurret) RunStats.killSpecial += 1;
      else RunStats.killNormal += 1;
      if (Player.killHeal > 0) Player.hp = Math.min(Player.maxHp, Player.hp + Player.killHeal);
      if (blast) this.queueBlast(dropX, dropY);
      if (split) this.trySplit(dropX, dropY, enemy.maxHp);
      // v013 #81 金币(金圆)与经验(蓝菱)完全分离：蓝经验只进 ExpLevelUp，金圆只进 RunStats.gold。
      var KD = CONFIG.KILL_DROPS;
      var dropXp = function (count) {
        for (var g = 0; g < count; g++) {
          Experience.dropGem(
            dropX + (Math.random() * 2 - 1) * KD.SPREAD,
            dropY + (Math.random() * 2 - 1) * KD.SPREAD,
            KD.GEM_VALUE);
        }
      };
      var dropGold = function (count) {
        for (var c = 0; c < count; c++) {
          CoinDrops.drop(
            dropX + (Math.random() * 2 - 1) * KD.SPREAD,
            dropY + (Math.random() * 2 - 1) * KD.SPREAD,
            KD.COIN_VALUE);
        }
      };
      // 远程Boss（特殊）：经验 20 个，金币 5 枚 + 必掉主动道具，不触发近战Boss胜利
      if (typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED && !enemy.isSummonTurret) {
        dropXp(KD.EXP_SPECIAL_COUNT);
        dropGold(KD.GOLD_SPECIAL_COUNT);
        PowerUps.dropRandom(dropX, dropY);
        if (root.BossSystem) root.BossSystem.onRangedBossDefeated();
        return;
      }
      if (enemy.isSummonTurret) {
        Experience.dropGem(dropX, dropY, 2);
        return;
      }
      // 近战 BOSS：经验 20 个，金币 100 枚；精英：经验 5 个，金币 5 枚；普通：经验 1 个，金币 20% 掉 1 枚。
      if (typeIndex === CONFIG.ENEMY.TYPE_BOSS) {
        dropXp(KD.EXP_BOSS_COUNT);
        dropGold(KD.GOLD_BOSS_COUNT);
      } else if (typeIndex === CONFIG.ENEMY.TYPE_ELITE) {
        dropXp(KD.EXP_ELITE_COUNT);
        dropGold(KD.GOLD_ELITE_COUNT);
      } else {
        dropXp(KD.EXP_NORMAL_COUNT);
        if (Math.random() < KD.GOLD_NORMAL_CHANCE) dropGold(KD.GOLD_NORMAL_COUNT);
      }
      PowerUps.rollDrop(dropX, dropY, typeIndex);
      if (typeIndex === CONFIG.ENEMY.TYPE_BOSS) BossSystem.onBossDefeated();
    },
    queueBlast: function (x, y) {
      this.pendingBlasts.push({ x: x, y: y, t: CONFIG.AFFIXES.DEFS.blast.DELAY });
    },
    updateBlasts: function (dt) {
      for (var i = this.pendingBlasts.length - 1; i >= 0; i--) {
        var b = this.pendingBlasts[i];
        b.t -= dt;
        if (b.t > 0) continue;
        var r = CONFIG.AFFIXES.DEFS.blast.RADIUS, dmg = CONFIG.AFFIXES.DEFS.blast.DAMAGE;
        var dx = Player.x - b.x, dy = Player.y - b.y;
        if (dx * dx + dy * dy <= (r + CONFIG.PLAYER.RADIUS) * (r + CONFIG.PLAYER.RADIUS)) Player.takeDamage(dmg, 'blast');
        for (var j = 0; j < this.pool.length; j++) {
          var e = this.pool[j];
          if (!e.active) continue;
          var ex = e.x - b.x, ey = e.y - b.y;
          if (ex * ex + ey * ey <= (r + e.radius) * (r + e.radius)) this.applyDamage(e, dmg);
        }
        if (root.FX) root.FX.burst(b.x, b.y);
        this.pendingBlasts.splice(i, 1);
      }
    },
    trySplit: function (x, y, hp) {
      var d = CONFIG.AFFIXES.DEFS.split, spawned = 0;
      for (var i = 0; i < d.COUNT; i++) {
        if (this.activeCount >= CONFIG.ENEMY.POOL_SIZE) break;
        var child = this.spawn(x + (i ? 24 : -24), y, CONFIG.ENEMY.TYPE_RUNNER, 1);
        if (child) {
          child.maxHp = Math.max(1, Math.ceil(hp * d.HP));
          child.hp = child.maxHp;
          child.affixes = [];
          spawned++;
        }
      }
      if (spawned < d.COUNT) {
        for (var g = spawned; g < d.COUNT; g++) Experience.dropGem(x, y, d.GEMS);
      }
    },
    recycleOneNonBoss: function () {
      for (var i = 0; i < this.pool.length; i++) {
        var enemy = this.pool[i];
        if (enemy.active && enemy.typeIndex !== CONFIG.ENEMY.TYPE_BOSS && !(enemy.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED && !enemy.isSummonTurret)) {
          enemy.active = false;
          this.activeCount -= 1;
          return true;
        }
      }
      return false;
    },
    clearScreenForRevive: function () {
      var left = Camera.x,
        right = Camera.x + CONFIG.VIEW.WIDTH;
      var top = Camera.y,
        bottom = Camera.y + CONFIG.VIEW.HEIGHT;
      for (var i = 0; i < this.pool.length; i++) {
        var enemy = this.pool[i];
        if (!enemy.active || enemy.typeIndex === CONFIG.ENEMY.TYPE_BOSS) continue;
        if (enemy.x + enemy.radius < left || enemy.x - enemy.radius > right || enemy.y + enemy.radius < top || enemy.y - enemy.radius > bottom) continue;
        enemy.active = false;
        this.activeCount -= 1;
      }
      var boss = this.getActiveBoss();
      if (boss) {
        var dx = boss.x - Player.x,
          dy = boss.y - Player.y;
        var distance = Math.hypot(dx, dy);
        var safeDistance = boss.radius + CONFIG.PLAYER.RADIUS + 260;
        if (distance < safeDistance) {
          var nx = distance > 0 ? dx / distance : 1;
          var ny = distance > 0 ? dy / distance : 0;
          boss.x = Math.max(boss.radius, Math.min(CONFIG.WORLD.WIDTH - boss.radius, Player.x + nx * safeDistance));
          boss.y = Math.max(boss.radius, Math.min(CONFIG.WORLD.HEIGHT - boss.radius, Player.y + ny * safeDistance));
        }
      }
    },
    getActiveBoss: function () {
      for (var i = 0; i < this.pool.length; i++) {
        var enemy = this.pool[i];
        if (enemy.active && enemy.typeIndex === CONFIG.ENEMY.TYPE_BOSS) return enemy;
      }
      return null;
    },
    getActiveMeleeBoss: function () {
      return this.getActiveBoss();
    },
    getActiveBosses: function () {
      var list = [];
      for (var i = 0; i < this.pool.length; i++) {
        var e = this.pool[i];
        if (e.active && (e.typeIndex === CONFIG.ENEMY.TYPE_BOSS || e.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED) && !e.isSummonTurret) list.push(e);
      }
      return list;
    },
    findNearest: function (x, y) {
      var nearest = null,
        nearestDistanceSquared = Infinity;
      for (var i = 0; i < this.pool.length; i++) {
        var enemy = this.pool[i];
        if (!enemy.active || enemy.allyTimer > 0) continue;
        var dx = enemy.x - x,
          dy = enemy.y - y;
        var d2 = dx * dx + dy * dy;
        if (d2 < nearestDistanceSquared) {
          nearestDistanceSquared = d2;
          nearest = enemy;
        }
      }
      return nearest;
    },
    checkPlayerCollisions: function () {
      for (var i = 0; i < this.pool.length; i++) {
        var enemy = this.pool[i];
        if (!enemy.active) continue;
        var hitDistance = CONFIG.PLAYER.RADIUS + enemy.radius;
        var dx = Player.x - enemy.x,
          dy = Player.y - enemy.y;
        if (dx * dx + dy * dy <= hitDistance * hitDistance) {
          if (PowerUps.isFrozen()) {
            if (root.FX) root.FX.burst(enemy.x, enemy.y, '#8feaff');
            enemy.hp = 0;
            this.kill(enemy);
            continue;
          }
          var src = enemy.typeIndex === CONFIG.ENEMY.TYPE_ELITE ? 'elite' : enemy.typeIndex === CONFIG.ENEMY.TYPE_BOSS || enemy.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED ? 'boss' : 'normal';
          if (Player.takeDamage(enemy.contactDamage, src)) return true;
        }
      }
      return false;
    },
    draw: function (ctx) {
      for (var i = 0; i < this.pool.length; i++) {
        var enemy = this.pool[i];
        if (enemy.active) this.drawOne(ctx, enemy);
      }
    },
    drawOne: function (ctx, e) {
      if (!Camera.isVisible(e.x, e.y, e.radius + 32)) return;
      var x = e.x - Camera.x,
        y = e.y - Camera.y;
      ctx.save();
      ctx.globalAlpha = e.typeIndex >= CONFIG.ENEMY.TYPE_ELITE ? .38 : .24;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.save();
      ctx.translate(x, y + e.radius * .7);
      ctx.scale(1, .36);
      ctx.arc(0, 0, e.radius * .85, 0, Math.PI * 2);
      ctx.restore();
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, .85);
      ctx.translate(-x, -y);
      this.drawBody(ctx, e);
      ctx.restore();
      this.drawIce(ctx, e);
      if (e.allyTimer > 0) {
        ctx.save(); ctx.strokeStyle = '#8be05a'; ctx.lineWidth = 4; ctx.shadowColor = '#8be05a'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(x, y, e.radius + 7, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      if (e.mortarBurnTime > 0) {
        ctx.save();
        ctx.strokeStyle = CONFIG.COLORS.COIN;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, e.radius + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = CONFIG.COLORS.COIN; ctx.font = '14px Arial';
        ctx.fillText(CONFIG.TEXT.PRODUCT.BURN, x, y - e.radius - 8);
        ctx.restore();
      }
      if ((e.typeIndex === CONFIG.ENEMY.TYPE_BOSS || e.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED) && !e.isSummonTurret) {
        var bw = Math.max(100, e.radius * 2.4), bh = 9, bx = x - bw / 2, by = y - e.radius - 28;
        var name = e.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED ? CONFIG.TEXT.BOSS_RANGED_NAME : CONFIG.TEXT.BOSS_MELEE_NAME;
        ctx.save(); ctx.fillStyle = 'rgba(20,5,20,.9)'; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = e.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED ? '#a55be8' : '#e5533d'; ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), bh);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial,"Microsoft YaHei"'; ctx.textAlign = 'center'; ctx.fillText(name, x, by - 4); ctx.restore();
      }
    },
    drawTypeMark: function (ctx, enemy, x, y, type) {
      ctx.strokeStyle = CONFIG.COLORS[type.OUTLINE_KEY];
      ctx.fillStyle = CONFIG.COLORS[type.OUTLINE_KEY];
      ctx.lineWidth = CONFIG.ENEMY.OUTLINE_WIDTH;
      if (enemy.typeIndex === CONFIG.ENEMY.TYPE_RUNNER) {
        ctx.beginPath();
        ctx.moveTo(x - enemy.radius * 0.45, y);
        ctx.lineTo(x + enemy.radius * 0.5, y - enemy.radius * 0.45);
        ctx.lineTo(x + enemy.radius * 0.5, y + enemy.radius * 0.45);
        ctx.closePath();
        ctx.fill();
      } else if (enemy.typeIndex === CONFIG.ENEMY.TYPE_TANK) {
        ctx.beginPath();
        ctx.arc(x, y, enemy.radius * 0.52, 0, Math.PI * 2);
        ctx.stroke();
      } else if (enemy.typeIndex === CONFIG.ENEMY.TYPE_ELITE || enemy.typeIndex === CONFIG.ENEMY.TYPE_BOSS) {
        ctx.beginPath();
        ctx.arc(x, y, enemy.radius * 0.58, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, enemy.radius * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    // 对象池每次借出时完整重置波次/眩晕/避障字段，避免继承上一只Boss状态。
    applyWaveStats: function (e, type) {
      var w = Math.max(1, root.Spawner.waveIndex),
        c = CONFIG.BALANCE,
        dm = 1 + w * c.DAMAGE_PER_WAVE;
      if (w >= c.LATE_WAVE) dm *= c.LATE_DAMAGE;
      if (type === CONFIG.ENEMY.TYPE_ELITE) {
        e.maxHp = Math.ceil(e.maxHp * c.ELITE_HP);
        e.hp = e.maxHp;
        dm *= c.ELITE_DAMAGE;
      }
      e.isWaveBoss = type === CONFIG.ENEMY.TYPE_BOSS;
      e.waveBoss = e.isWaveBoss ? root.Spawner.waveIndex : 0;
      if (e.isWaveBoss) {
        e.maxHp = Math.ceil(c.BOSS_HP * (1 + w * .05));
        e.hp = e.maxHp;
        e.contactDamage = c.BOSS_DAMAGE;
      } else e.contactDamage = Math.ceil(CONFIG.ENEMY.TYPES[type].DAMAGE * dm);
      e.baseContact = e.contactDamage;
      e.stunTimer = 0;
      e.freezeTimer = 0;
      e.slowMul = 1;
      e.specialSlowTimer = 0;
      e.specialVulnerable = 1;
      e.allyTimer = 0;
      e.allyAttackTimer = 0;
      e.allyDamage = 0;
      e.frostTouched = {};
      e.avoidCheck = Math.random() * .2;
      e.avoidTime = 0;
      e.avoidAngle = 0;
      e.stuckTime = 0;
      if (type === CONFIG.ENEMY.TYPE_ELITE) this.rollAffixes(e);
    },
    rollAffixes: function (e) {
      var pool = CONFIG.AFFIXES.POOL.slice();
      var n = root.Spawner.waveIndex >= CONFIG.AFFIXES.ROLL_DOUBLE_WAVE ? 2 : 1;
      e.affixes = [];
      for (var i = 0; i < n && pool.length; i++) {
        var id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        var blocked = false;
        for (var m = 0; m < CONFIG.AFFIXES.MUTEX.length; m++) {
          var pair = CONFIG.AFFIXES.MUTEX[m];
          if (e.affixes.indexOf(pair[0]) >= 0 && id === pair[1] || e.affixes.indexOf(pair[1]) >= 0 && id === pair[0]) blocked = true;
        }
        if (blocked) {
          i--;
          continue;
        }
        e.affixes.push(id);
      }
      var d = CONFIG.AFFIXES.DEFS;
      if (e.affixes.indexOf('swift') >= 0) e.speed *= d.swift.SPEED;
      if (e.affixes.indexOf('shield') >= 0) e.affixShield = e.maxHp * d.shield.RATIO;
      e.affixBlast = e.affixes.indexOf('blast') >= 0;
      e.affixSplit = e.affixes.indexOf('split') >= 0;
    },
    updateGunner: function (e, dt) {
      e.gunnerTimer = (e.gunnerTimer || 0) - dt;
      if (e.gunnerTimer > 0) return;
      e.gunnerTimer = CONFIG.AFFIXES.DEFS.gunner.INTERVAL;
      var a = Math.atan2(Player.y - e.y, Player.x - e.x);
      if (root.WallCollision.segment(e.x, e.y, e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, 6)) return;
      this.fireBossProjectile({
        x: e.x,
        y: e.y,
        bossTargetX: Player.x,
        bossTargetY: Player.y
      });
    },
    // 冰晶在敌人主体之后绘制。
    drawIce: function (ctx, e) {
      if (!e.active || !PowerUps.isFrozen()) return;
      var x = e.x - Camera.x,
        y = e.y - Camera.y;
      ctx.save();
      ctx.strokeStyle = '#c9f7ff';
      ctx.fillStyle = 'rgba(115,221,255,.7)';
      ctx.lineWidth = 3;
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3,
          px = x + Math.cos(a) * e.radius * .82,
          py = y + Math.sin(a) * e.radius * .82;
        ctx.beginPath();
        ctx.moveTo(px, py - e.radius * .22);
        ctx.lineTo(px - e.radius * .12, py + e.radius * .16);
        ctx.lineTo(px + e.radius * .13, py + e.radius * .12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    },
    // 实体主体与阴影的绘制分工。
    drawBody: function (ctx, enemy) {
      var screenX = enemy.x - Camera.x;
      var screenY = enemy.y - Camera.y;
      var margin = enemy.radius + CONFIG.SPAWNER.OUTSIDE_MARGIN;
      var type = CONFIG.ENEMY.TYPES[enemy.typeIndex];
      if (screenX < -margin || screenX > CONFIG.VIEW.WIDTH + margin || screenY < -margin || screenY > CONFIG.VIEW.HEIGHT + margin) return;
      ctx.save();
      ctx.shadowColor = CONFIG.COLORS[type.GLOW_KEY];
      ctx.shadowBlur = Enemy.activeCount < CONFIG.POLISH.LOW_FX_ENEMIES ? enemy.radius : 0;
      ctx.beginPath();
      ctx.arc(screenX, screenY, enemy.radius, 0, Math.PI * 2);
      ctx.fillStyle = enemy.hitFlash > 0 ? CONFIG.COLORS.ENEMY_HIT : CONFIG.COLORS[type.FILL_KEY];
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = CONFIG.ENEMY.OUTLINE_WIDTH;
      ctx.strokeStyle = CONFIG.COLORS[type.OUTLINE_KEY];
      ctx.stroke();
      this.drawTypeMark(ctx, enemy, screenX, screenY, type);
      if (enemy.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED) {
        this.drawRangedBossDetails(ctx, enemy, screenX, screenY);
      }
      if (PowerUps.isFrozen() || (enemy.freezeTimer || 0) > 0) {
        ctx.beginPath();
        ctx.arc(screenX, screenY, enemy.radius * 0.82, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.COLORS.ENEMY_FROZEN;
        ctx.fill();
      }
      if (enemy.affixes && enemy.affixes.length) {
        var label = CONFIG.AFFIXES.DEFS[enemy.affixes[0]] ? CONFIG.AFFIXES.DEFS[enemy.affixes[0]].NAME : enemy.affixes[0];
        ctx.font = 'bold 16px Arial, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        ctx.fillStyle = '#ffe9c2';
        ctx.strokeText(label, screenX, screenY - enemy.radius - 10);
        ctx.fillText(label, screenX, screenY - enemy.radius - 10);
      }
      ctx.restore();
    },
    // 友方爆炸绘制完毕后再叠加敌方关键预警。
    drawThreats: function (ctx) {
      for (var i = 0; i < this.pool.length; i++) {
        var e = this.pool[i];
        if (e.active && e.typeIndex === CONFIG.ENEMY.TYPE_BOSS && e.meleePhase === 'warn') this.drawMeleeChargeTelegraph(ctx, e, e.x - Camera.x, e.y - Camera.y);
      }
      // v014 #95 远程 BOSS 攻击前红圈预警：蓄力期间在锁定落点画危险范围（召唤炮台不算）。
      for (var j = 0; j < this.pool.length; j++) {
        var r = this.pool[j];
        if (!r.active || r.isSummonTurret) continue;
        if (r.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED && r.bossChargeTimer > 0) this.drawRangedChargeTelegraph(ctx, r);
      }
      this.drawBossProjectiles(ctx);
    },
    // v014 #95 远程 BOSS 蓄力落点红圈：最后 WARN_FLASH_WINDOW 秒明显前摇（更亮）。
    drawRangedChargeTelegraph: function (ctx, enemy) {
      var wx = enemy.bossTargetX - Camera.x;
      var wy = enemy.bossTargetY - Camera.y;
      var total = this.bossRangedCharge(enemy);
      var ratio = total > 0 ? 1 - enemy.bossChargeTimer / total : 1;
      var flash = ratio >= (1 - (CONFIG.BOSS_MELEE.WARN_FLASH_WINDOW || 0.5) / total) ? 1 : 0.6;
      ctx.save();
      ctx.globalAlpha = 0.32 * flash;
      ctx.fillStyle = CONFIG.COLORS.WARNING_CIRCLE;
      ctx.beginPath();
      ctx.arc(wx, wy, CONFIG.BOSS_RANGED.EXPLOSION_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85 * flash;
      ctx.lineWidth = 3;
      ctx.strokeStyle = CONFIG.COLORS.AIM_LINE;
      ctx.stroke();
      ctx.restore();
    },
    drawMeleeChargeTelegraph: function (ctx, enemy, sx, sy) {
      // v014 #95 冲锋前 1s 红色预警线：线宽 20px、半透明红，方向稳定指向锁定点（meleeTx/Ty）。
      var ax = enemy.meleeTx - Camera.x;
      var ay = enemy.meleeTy - Camera.y;
      var dx = ax - sx, dy = ay - sy;
      var d = Math.hypot(dx, dy) || 1;
      // 从 BOSS 沿锁定方向延伸约 CHARGE_RANGE_MAX，让玩家看清整条冲锋通道。
      var ext = CONFIG.BOSS_MELEE.CHARGE_RANGE_MAX;
      var ex = sx + dx / d * ext;
      var ey = sy + dy / d * ext;
      var cfg = CONFIG.BOSS_MELEE;
      // 最后 WARN_FLASH_WINDOW(0.5)s 明显动作前摇：更亮给玩家可躲避时间。
      var flash = enemy.meleeTimer <= (cfg.WARN_FLASH_WINDOW || 0.5) ? 1 : 0.6;
      ctx.save();
      ctx.strokeStyle = CONFIG.COLORS.BOSS_WARN_LINE;
      ctx.lineWidth = cfg.WARN_LINE_WIDTH || 20;
      ctx.lineCap = 'round';
      ctx.globalAlpha = (cfg.WARN_LINE_ALPHA || 0.45) * flash;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // 锁定目标点红圈
      ctx.globalAlpha = 0.5 * flash;
      ctx.fillStyle = CONFIG.COLORS.WARNING_CIRCLE;
      ctx.beginPath();
      ctx.arc(ax, ay, enemy.radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    maybeSummonTurrets: function (enemy) {
      if (enemy.typeIndex !== CONFIG.ENEMY.TYPE_BOSS_RANGED || enemy.isSummonTurret || enemy.summonedTurrets) return;
      if (enemy.hp / enemy.maxHp > CONFIG.BOSS_SUMMON.HP_RATIO) return;
      enemy.summonedTurrets = true;
      this.spawnSummonTurrets(enemy);
    },
    spawnSummonTurrets: function (boss) {
      var cfg = CONFIG.BOSS_SUMMON;
      var ang0 = Math.atan2(Player.y - boss.y, Player.x - boss.x) + Math.PI / 2;
      for (var i = 0; i < cfg.COUNT; i++) {
        if (this.activeCount >= CONFIG.ENEMY.POOL_SIZE) this.recycleOneNonBoss();
        var a = ang0 + i * Math.PI;
        var x = boss.x + Math.cos(a) * cfg.OFFSET;
        var y = boss.y + Math.sin(a) * cfg.OFFSET;
        x = Math.max(cfg.RADIUS + 20, Math.min(CONFIG.WORLD.WIDTH - cfg.RADIUS - 20, x));
        y = Math.max(cfg.RADIUS + 20, Math.min(CONFIG.WORLD.HEIGHT - cfg.RADIUS - 20, y));
        var t = this.spawn(x, y, CONFIG.ENEMY.TYPE_BOSS_RANGED, 1);
        if (!t) continue;
        t.isSummonTurret = true;
        t.maxHp = cfg.HP;
        t.hp = cfg.HP;
        t.radius = cfg.RADIUS;
        t.speed = 0;
        t.contactDamage = cfg.CONTACT;
        t.bossAttackTimer = cfg.INTERVAL * (0.4 + i * 0.3);
        t.summonerId = boss.spawnId;
        if (root.FX) root.FX.burst(t.x, t.y, CONFIG.COLORS.BOSS_RANGED_GLOW);
      }
      if (root.Field) {
        Field.eventBanner = CONFIG.TEXT.BOSS_SUMMON_BANNER;
        Field.eventBannerTimer = CONFIG.POLISH.WAVE_NOTICE_TIME;
      }
    },
    receiveDamage: function (enemy, damage) {
      if (!enemy.active) return;
      enemy.hp -= damage;
      if (enemy.hp > 0) this.maybeSummonTurrets(enemy);
      else this.kill(enemy);
    },
    // 一只敌人只记一次掉落、目标、成就及武器经验。
    recordKill: function (e) {
      var type = e.typeIndex,
        source = root.Combat.killSource,
        o = root.Objectives,
        a = root.Achievements;
      if (type < CONFIG.ENEMY.TYPE_ELITE && Player.nextMedkitDrop && Math.random() < Player.nextMedkitDrop) PowerUps.drop(e.x, e.y, CONFIG.POWERUPS.TYPE_MEDKIT);
      if (source) {
        root.RunStats.sourceKills[source] = (root.RunStats.sourceKills[source] || 0) + 1;
        if (source === 'tesla' || source === 'frost' || source === 'mortar') {
          o.add('mortar', 1);
          if (source !== 'mortar') o.add(source, 1);
          a.add('mortar', 1);
          if (source !== 'mortar') a.add(source, 1);
        } else {
          o.add(source, 1);
          a.add(source === 'flame' ? 'flameRun' : source === 'bow' ? 'bowRun' : source, 1);
        }
      }
      if (type === CONFIG.ENEMY.TYPE_ELITE) {
        o.add('elite', 1);
        a.add('elite', 1);
        if (e.affixes && e.affixes.length) a.add('affixElite', 1);
      }
      if ((type === CONFIG.ENEMY.TYPE_BOSS || type === CONFIG.ENEMY.TYPE_BOSS_RANGED) && !e.isSummonTurret) {
        o.add('boss', 1);
        a.add('boss', 1);
      }
      root.WeaponProgress.addKill(type);
    }
  };
  var BossSystem = {
    spawned: false,
    defeated: false,
    rangedSpawned: false,
    rangedDefeated: false,
    reset: function () {
      this.spawned = false;
      this.defeated = false;
      this.rangedSpawned = false;
      this.rangedDefeated = false;
    },
    update: function () {/* Boss 由 Spawner 按波次统一生成。 */},
    onBossDefeated: function () {
      this.defeated = true;
      if (root.Field) {
        root.Field.bossDefeated = true;
        root.Field.lootTimer = CONFIG.FIELD.LOOT_SECONDS;
      }
    },
    onRangedBossDefeated: function () {
      this.rangedDefeated = true;
    }
  };
  root.Enemy = Enemy;
  root.BossSystem = BossSystem;
})();

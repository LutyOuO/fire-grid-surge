'use strict';
// ============================================================
// Entities（实体模块）：Player / Enemy / Bullet / PulseGun / OrbitBlade / Weapons
// ============================================================
var root = (typeof window !== 'undefined') ? window : global;
var CONFIG = root.CONFIG;
var Input = root.Input;
var Camera = root.Camera;
var DamageText = root.DamageText;
var Combat = root.Combat;

// ---------- Player（玩家） ----------
var Player = {
  x: CONFIG.PLAYER.START_X, y: CONFIG.PLAYER.START_Y,
  hp: CONFIG.PLAYER.MAX_HP, maxHp: CONFIG.PLAYER.MAX_HP,
  moveSpeedBonus: 0, critChance: CONFIG.PLAYER.BASE_CRIT_CHANCE,
  critDamageBonus: 0, globalDamageBonus: 0, incomingDamageMultiplier: 1,
  expGainBonus: 0, killHeal: 0, enemySpeedMultiplier: 1,
  phoenixReady: false, executeChance: 0,
  pickupRadius: CONFIG.EXPERIENCE.PICKUP_RADIUS,
  invincibleTimer: 0, reviveCharges: 0,
  // 受击反馈
  renderOffsetX: 0, renderOffsetY: 0, hitScaleTimer: 0, hitShakeTimer: 0,
  // 冲刺
  dashing: false, dashTimer: 0, dashCooldown: 0,
  dashDirX: 0, dashDirY: -1,
  dashArrowTimer: 0,
  dashTrailTimer: 0, dashScaleTimer: 0, dashReadyFlash: 0, dashDustTimer: 0,
  lastMoveDirX: 0, lastMoveDirY: 1,
  dashTrails: [],
  // 血包升级：护盾 / 持续恢复 / 自动急救
  shield: 0, shieldTimer: 0, shieldFlash: 0,
  upgradeShieldMax: 0, upgradeShieldRecharge: 0,
  regenTimer: 0, regenRate: 0,
  autoMedkitUsed: false,
  // #5 射击后坐力（渲染偏移，不改真实位置）
  recoilX: 0, recoilY: 0, recoilTimer: 0, recoilReturnTimer: 0,
  // #16 朝向与移动起伏
  facingAngle: 0, bobOffset: 0,

  reset: function () {
    this.x = CONFIG.PLAYER.START_X;
    this.y = CONFIG.PLAYER.START_Y;
    this.maxHp = Math.min(CONFIG.PLAYER.MAX_HP_LIMIT,
      CONFIG.PLAYER.MAX_HP + Meta.getEffectTotal('MAX_HP'));
    this.hp = this.maxHp;
    this.moveSpeedBonus = Meta.getEffectTotal('MOVE_SPEED');
    this.critChance = CONFIG.PLAYER.BASE_CRIT_CHANCE;
    this.critDamageBonus = 0; this.globalDamageBonus = 0; this.incomingDamageMultiplier = 1;
    this.expGainBonus = 0; this.killHeal = 0; this.enemySpeedMultiplier = 1;
    this.phoenixReady = false; this.executeChance = 0;
    this.pickupRadius = Math.min(CONFIG.EXPERIENCE.MAX_PICKUP_RADIUS,
      CONFIG.EXPERIENCE.PICKUP_RADIUS + Meta.getEffectTotal('PICKUP_RADIUS'));
    this.invincibleTimer = 0;
    this.reviveCharges = Math.round(Meta.getEffectTotal('REVIVE'));
    // 受击反馈
    this.renderOffsetX = 0; this.renderOffsetY = 0;
    this.hitScaleTimer = 0; this.hitShakeTimer = 0;
    // 冲刺
    this.dashing = false; this.dashTimer = 0; this.dashCooldown = 0;
    this.dashDirX = 0; this.dashDirY = -1;
    this.dashArrowTimer = 0;
    this.dashTrailTimer = 0; this.dashScaleTimer = 0;
    this.dashReadyFlash = 0; this.dashDustTimer = 0;
    this.lastMoveDirX = 0; this.lastMoveDirY = 1;
    this.dashTrails.length = 0;
    // 血包升级
    this.shield = 0; this.shieldTimer = 0;
    this.upgradeShieldMax = 0; this.upgradeShieldRecharge = 0;
    this.regenTimer = 0; this.regenRate = 0;
    this.autoMedkitUsed = false;
    // 后坐力 / 朝向
    this.recoilX = 0; this.recoilY = 0;
    this.recoilTimer = 0; this.recoilReturnTimer = 0;
    this.facingAngle = 0; this.bobOffset = 0;
  },

  update: function (dt) {
    var move = Input.getMoveVector();
    var speed = this.getMoveSpeed();

    // 记录最近一次移动方向（用于无输入时冲刺朝向）
    var moveLen = Math.hypot(move.x, move.y);
    if (moveLen > 0.1 && !this.dashing) {
      this.lastMoveDirX = move.x;
      this.lastMoveDirY = move.y;
    }

    // 冲刺冷却
    if (this.dashCooldown > 0) {
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
      if (this.dashCooldown === 0 && !this.dashing) {
        this.dashReadyFlash = CONFIG.PLAYER.DASH_READY_FLASH;
      }
    }
    if (this.dashReadyFlash > 0) this.dashReadyFlash = Math.max(0, this.dashReadyFlash - dt);
    if (this.dashArrowTimer > 0) this.dashArrowTimer = Math.max(0, this.dashArrowTimer - dt);

    if (this.dashing) {
      // 冲刺方向锁定；最后0.1秒由高速平滑回落到正常速度。
      this.dashTimer -= dt;
      var ease = Math.min(1, Math.max(0, this.dashTimer / CONFIG.PLAYER.DASH_EASE_TIME));
      var dashMultiplier = 1 + (CONFIG.PLAYER.DASH_SPEED_MULTIPLIER - 1) * ease;
      this.x += this.dashDirX * speed * dashMultiplier * dt;
      this.y += this.dashDirY * speed * dashMultiplier * dt;
      this.clampToWorld();
      // 冲刺全程无敌（不缩短已有的更长无敌时间）
      this.invincibleTimer = Math.max(this.invincibleTimer, Math.max(0, this.dashTimer));
      // 残影拖尾
      this.dashTrailTimer -= dt;
      if (this.dashTrailTimer <= 0) {
        this.dashTrailTimer = CONFIG.PLAYER.DASH_TRAIL_INTERVAL;
        this.dashTrails.push({ x: this.x, y: this.y, life: CONFIG.PLAYER.DASH_TRAIL_LIFE });
        if (this.dashTrails.length > CONFIG.PLAYER.DASH_TRAIL_MAX) this.dashTrails.shift();
      }
      // 地面扬尘
      this.dashDustTimer -= dt;
      if (this.dashDustTimer <= 0) {
        this.dashDustTimer = CONFIG.PLAYER.DASH_DUST_INTERVAL;
        if (root.FX && root.FX.spawnDust) root.FX.spawnDust(this.x, this.y);
      }
      if (this.dashTimer <= 0) {
        this.dashing = false;
        // 结束冲击波
        if (root.FX && root.FX.spawnRing) root.FX.spawnRing(this.x, this.y);
        this.x += move.x * speed * Math.min(dt, Math.max(0, -this.dashTimer));
        this.y += move.y * speed * Math.min(dt, Math.max(0, -this.dashTimer));
        this.clampToWorld();
      }
    } else {
      // 普通移动
      this.x += move.x * speed * dt;
      this.y += move.y * speed * dt;
      this.clampToWorld();
    }

    // 无敌帧衰减
    if (this.invincibleTimer > 0) {
      this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    }
    // 护盾计时：到期护盾清空
    if (this.shieldTimer > 0) {
      this.shieldTimer = Math.max(0, this.shieldTimer - dt);
      if (this.shieldTimer <= 0) this.shield = 0;
    }
    if (this.shieldFlash > 0) this.shieldFlash = Math.max(0, this.shieldFlash - dt);
    if (this.upgradeShieldMax > 0 && this.shield <= 0) {
      this.upgradeShieldRecharge = Math.max(0, this.upgradeShieldRecharge - dt);
      if (this.upgradeShieldRecharge <= 0) this.shield = this.upgradeShieldMax;
    }
    // 持续恢复（血包 regen）
    if (this.regenTimer > 0) {
      this.regenTimer = Math.max(0, this.regenTimer - dt);
      this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt);
    }
    // 自动急救：生命低于25%且有升级、本局未用过 → 自动用血包（不耗库存）
    if (!this.autoMedkitUsed && root.Meta && Meta.getGadgetLevel('medkit', 'auto') > 0 &&
        this.hp > 0 && this.hp < this.maxHp * 0.25 && this.hp < this.maxHp) {
      if (root.PowerUps && root.PowerUps.useMedkit) {
        root.PowerUps.useMedkit();
        this.autoMedkitUsed = true;
      }
    }
    // 受击缩放/角色震动计时衰减
    if (this.hitScaleTimer > 0) this.hitScaleTimer = Math.max(0, this.hitScaleTimer - dt);
    if (this.hitShakeTimer > 0) {
      this.hitShakeTimer = Math.max(0, this.hitShakeTimer - dt);
      if (this.hitShakeTimer > 0) {
        this.renderOffsetX = (Math.random() * 2 - 1) * CONFIG.PLAYER.HIT_SHAKE_OFFSET;
        this.renderOffsetY = (Math.random() * 2 - 1) * CONFIG.PLAYER.HIT_SHAKE_OFFSET;
      } else {
        this.renderOffsetX = 0; this.renderOffsetY = 0;
      }
    } else {
      this.renderOffsetX = 0; this.renderOffsetY = 0;
    }
    // 冲刺形变恢复计时
    if (this.dashScaleTimer > 0) this.dashScaleTimer = Math.max(0, this.dashScaleTimer - dt);
    // #5 后坐力：0.05s 保持位移，随后 0.1s 平滑回弹
    if (this.recoilTimer > 0) {
      this.recoilTimer = Math.max(0, this.recoilTimer - dt);
    } else if (this.recoilReturnTimer > 0) {
      this.recoilReturnTimer = Math.max(0, this.recoilReturnTimer - dt);
      var rt = 1 - this.recoilReturnTimer / 0.1;
      var rem = 1 - rt;
      this.recoilX *= rem; this.recoilY *= rem;
      if (this.recoilReturnTimer <= 0) { this.recoilX = 0; this.recoilY = 0; }
    }
    // #16 朝向：优先最近敌人，其次移动方向；移动时 bob 起伏
    this.updateFacing();
    if (moveLen > 0.1) {
      this.bobOffset = Math.sin((root.Game ? root.Game.survivedSeconds : 0) * 8) * 2;
    } else {
      this.bobOffset = 0;
    }
    // 残影寿命衰减
    for (var i = this.dashTrails.length - 1; i >= 0; i--) {
      this.dashTrails[i].life -= dt;
      if (this.dashTrails[i].life <= 0) this.dashTrails.splice(i, 1);
    }
  },

  getMoveSpeed: function () {
    return Math.min(CONFIG.PLAYER.MAX_SPEED,
      CONFIG.PLAYER.SPEED * (1 + this.moveSpeedBonus));
  },

  canDash: function () { return !this.dashing && this.dashCooldown <= 0; },

  startDash: function () {
    if (!this.canDash()) return false;
    var move = Input.getMoveVector();
    var dx = move.x, dy = move.y;
    if (Math.hypot(dx, dy) < 0.1) { dx = this.lastMoveDirX; dy = this.lastMoveDirY; }
    if (Math.hypot(dx, dy) < 0.1) { dx = 0; dy = -1; } // 无记录时默认朝上
    var len = Math.hypot(dx, dy);
    this.dashDirX = dx / len;
    this.dashDirY = dy / len;
    this.dashing = true;
    this.dashTimer = CONFIG.PLAYER.DASH_DURATION;
    this.dashCooldown = CONFIG.PLAYER.DASH_COOLDOWN;
    this.dashTrailTimer = 0;
    this.dashDustTimer = 0;
    this.dashScaleTimer = CONFIG.PLAYER.DASH_SCALE_TIME;
    this.dashReadyFlash = 0;
    this.dashArrowTimer = CONFIG.PLAYER.DASH_ARROW_TIME;
    return true;
  },

  clampToWorld: function () {
    var r = CONFIG.PLAYER.RADIUS;
    this.x = Math.max(r, Math.min(CONFIG.WORLD.WIDTH - r, this.x));
    this.y = Math.max(r, Math.min(CONFIG.WORLD.HEIGHT - r, this.y));
  },

  // #5 后坐力：向射击反方向 2~3px 渲染位移
  applyRecoil: function (angle) {
    var dist = 2 + Math.random();
    this.recoilX = -Math.cos(angle) * dist;
    this.recoilY = -Math.sin(angle) * dist;
    this.recoilTimer = 0.05;
    this.recoilReturnTimer = 0.1;
  },

  // #16 朝向：优先最近敌人，否则移动方向
  updateFacing: function () {
    var target = root.Enemy.findNearest(this.x, this.y);
    if (target) {
      this.facingAngle = Math.atan2(target.y - this.y, target.x - this.x);
    } else if (Math.hypot(this.lastMoveDirX, this.lastMoveDirY) > 0.1) {
      this.facingAngle = Math.atan2(this.lastMoveDirY, this.lastMoveDirX);
    }
  },

  takeDamage: function (amount, source) {
    if (this.invincibleTimer > 0) return false;
    // 护盾优先吸收伤害
    if (this.shield > 0 && amount > 0) {
      var absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
      if (this.shield <= 0) {
        this.shield = 0; this.shieldTimer = 0;
        if (this.upgradeShieldMax > 0) this.upgradeShieldRecharge = 12;
      }
      if (amount <= 0) {
        // 护盾完全吸收：不扣血、不触发无敌帧与受击反馈
        this.shieldFlash = 0.2;
        return true;
      }
    }
    this.hp = Math.max(0, this.hp - amount * this.incomingDamageMultiplier);
    this.invincibleTimer = CONFIG.PLAYER.INVINCIBLE_TIME;
    if (this.hp <= 0 && this.phoenixReady) {
      this.phoenixReady = false;
      this.hp = Math.max(1, Math.ceil(this.maxHp * 0.5));
      this.invincibleTimer = 3;
      Enemy.clearScreenForRevive();
    } else if (this.hp <= 0 && this.reviveCharges > 0) {
      this.reviveCharges -= 1;
      this.hp = Math.max(1, Math.ceil(this.maxHp * CONFIG.META.IMMORTAL_HP_RATIO));
      this.invincibleTimer = CONFIG.META.IMMORTAL_INVINCIBLE_TIME;
    }
    // 受击反馈：(a) Y轴压扁始终触发；(b)(c) 受角色震动开关控制
    this.hitScaleTimer = CONFIG.PLAYER.HIT_SCALE_TIME;
    if (root.Settings && root.Settings.shake) {
      this.hitShakeTimer = CONFIG.PLAYER.HIT_SHAKE_TIME;
      var strong = source === 'elite' || source === 'boss';
      Camera.startShake(strong ? 6 : 4, strong ? 0.3 : 0.2);
    }
    return true;
  },

  increaseMaxHp: function (amount) {
    var oldMax = this.maxHp;
    this.maxHp = Math.min(CONFIG.PLAYER.MAX_HP_LIMIT, this.maxHp + amount);
    this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - oldMax));
  },

  shouldFlashWhite: function () {
    if (this.invincibleTimer <= 0) return false;
    return Math.floor(this.invincibleTimer / CONFIG.PLAYER.FLASH_INTERVAL) % 2 === 0;
  },

  draw: function (ctx) {
    // 残影拖尾
    for (var i = 0; i < this.dashTrails.length; i++) {
      var t = this.dashTrails[i];
      var a = Math.max(0, t.life / CONFIG.PLAYER.DASH_TRAIL_LIFE) * CONFIG.PLAYER.DASH_TRAIL_ALPHA;
      var tsx = t.x - Camera.x;
      var tsy = t.y - Camera.y;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(tsx, tsy, CONFIG.PLAYER.RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.COLORS.PLAYER;
      ctx.fill();
      ctx.restore();
    }

    var screenX = this.x - Camera.x + this.renderOffsetX + this.recoilX;
    var screenY = this.y - Camera.y + this.renderOffsetY + this.recoilY + this.bobOffset;
    var fillColor = this.shouldFlashWhite() ? CONFIG.COLORS.PLAYER_HIT : CONFIG.COLORS.PLAYER;
    var r = CONFIG.PLAYER.RADIUS;

    ctx.save();
    ctx.translate(screenX, screenY);

    // 形变：冲刺沿方向拉伸；受击 Y 轴压扁（二者不会同时发生，冲刺期无敌）
    if (this.dashing || this.dashScaleTimer > 0) {
      var stretch = this.dashing ? 1 : (this.dashScaleTimer / CONFIG.PLAYER.DASH_SCALE_TIME);
      var sxA = 1 + (CONFIG.PLAYER.DASH_STRETCH_X - 1) * stretch;
      var syA = 1 - (1 - CONFIG.PLAYER.DASH_STRETCH_Y) * stretch;
      var ang = Math.atan2(this.dashDirY, this.dashDirX);
      ctx.rotate(ang);
      ctx.scale(sxA, syA);
      ctx.rotate(-ang);
    } else if (this.hitScaleTimer > 0) {
      var t2 = 1 - this.hitScaleTimer / CONFIG.PLAYER.HIT_SCALE_TIME;
      var e2 = 1 - (1 - t2) * (1 - t2); // easeOutQuad
      ctx.scale(
        CONFIG.PLAYER.HIT_SCALE_X - (CONFIG.PLAYER.HIT_SCALE_X - 1) * e2,
        CONFIG.PLAYER.HIT_SCALE_Y + (1 - CONFIG.PLAYER.HIT_SCALE_Y) * e2);
    }

    // #16 低血量红色光环
    if (this.hp / this.maxHp < 0.3) {
      var pulse = 0.5 + 0.3 * Math.sin((typeof performance !== 'undefined' ? performance.now() : 0) / 150);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(0, 0, r + 10, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.COLORS.LOW_HP_AURA;
      ctx.fill();
      ctx.restore();
    }

    // 朝向旋转绘制军事幸存者
    ctx.rotate(this.facingAngle);
    var white = this.shouldFlashWhite();
    // 身体（军绿略扁椭圆）— 用 arc+scale 兼容不支持 ellipse 的真机
    ctx.save();
    ctx.scale(r * 0.95, r * 0.78);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fillStyle = white ? '#ffffff' : CONFIG.COLORS.PLAYER_BODY;
    ctx.fill();
    ctx.restore();
    // 战术背心（中部深色）
    ctx.save();
    ctx.scale(r * 0.6, r * 0.55);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fillStyle = white ? '#ffffff' : CONFIG.COLORS.PLAYER_VEST;
    ctx.fill();
    ctx.restore();
    // 头盔（朝向前方 +x）
    ctx.beginPath();
    ctx.arc(r * 0.55, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = white ? '#ffffff' : CONFIG.COLORS.PLAYER_HELMET;
    ctx.fill();
    // 手枪（朝向前方右侧伸出）
    ctx.fillStyle = white ? '#ffffff' : CONFIG.COLORS.WEAPON_GUN;
    ctx.fillRect(r * 0.7, -r * 0.12, r * 0.55, r * 0.22);
    ctx.fillStyle = CONFIG.COLORS.WEAPON_CORE;
    ctx.fillRect(r * 1.12, -r * 0.06, r * 0.1, r * 0.12);
    // 枪口闪光（#16）
    var pf = root.PulseGun;
    if (pf && pf.muzzleFlashTimer > 0) {
      var fa = pf.muzzleFlashTimer / 0.05;
      ctx.save();
      ctx.globalAlpha = 0.8 * fa;
      ctx.beginPath();
      ctx.arc(r * 1.35, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.COLORS.MUZZLE_FLASH;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 护盾环（蓝色半透明呼吸 + 更明显辉光）
    if (this.shield > 0) {
      var breathe = 1 + Math.sin((typeof performance !== 'undefined' ? performance.now() : 0) / 200) * 0.08;
      ctx.save();
      ctx.globalAlpha = (this.shieldFlash > 0 ? 0.9 : 0.45) * breathe;
      ctx.shadowColor = CONFIG.COLORS.SHIELD_GLOW;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(screenX, screenY, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = CONFIG.COLORS.SHIELD;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }
};

// ---------- Enemy（敌人） ----------
var Enemy = {
  pool: [], activeCount: 0, nextSpawnId: 1,
  bossProjectiles: [],

  initPool: function () {
    this.pool.length = 0;
    for (var i = 0; i < CONFIG.ENEMY.POOL_SIZE; i++) {
      this.pool.push({
        active: false, x: 0, y: 0, hp: 0, maxHp: 0, speed: 0, radius: 0,
        contactDamage: 0, typeIndex: CONFIG.ENEMY.TYPE_WALKER,
        bladeCooldown: 0, spawnId: 0, hitFlash: 0,
        bossAttackTimer: 0, bossChargeTimer: 0,
        bossTargetX: 0, bossTargetY: 0
      });
    }
    this.bossProjectiles.length = 0;
    for (var j = 0; j < CONFIG.BOSS_RANGED.PROJECTILE_POOL; j++) {
      this.bossProjectiles.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, life: 0
      });
    }
  },

  reset: function () {
    this.activeCount = 0;
    this.nextSpawnId = 1;
    for (var i = 0; i < this.pool.length; i++) this.pool[i].active = false;
    for (var j = 0; j < this.bossProjectiles.length; j++) this.bossProjectiles[j].active = false;
  },

  spawn: function (x, y, typeIndex, hpMultiplier) {
    for (var i = 0; i < this.pool.length; i++) {
      var enemy = this.pool[i];
      if (!enemy.active) {
        var type = CONFIG.ENEMY.TYPES[typeIndex];
        enemy.active = true;
        enemy.x = x; enemy.y = y;
        enemy.typeIndex = typeIndex;
        enemy.radius = type.RADIUS;
        enemy.speed = type.SPEED;
        enemy.contactDamage = type.DAMAGE;
        enemy.maxHp = Math.ceil(type.HP * hpMultiplier);
        enemy.hp = enemy.maxHp;
        enemy.bladeCooldown = 0;
        enemy.hitFlash = 0;
        enemy.bossAttackTimer = CONFIG.BOSS_RANGED.ATTACK_INTERVAL;
        enemy.bossChargeTimer = 0;
        enemy.bossTargetX = 0;
        enemy.bossTargetY = 0;
        enemy.spawnId = this.nextSpawnId;
        this.nextSpawnId += 1;
        this.activeCount += 1;
        return enemy;
      }
    }
    return null;
  },

  update: function (dt) {
    for (var i = 0; i < this.pool.length; i++) {
      var enemy = this.pool[i];
      if (!enemy.active) continue;
      if (!PowerUps.isFrozen()) {
        this.moveTowardPlayer(enemy, dt);
        if (enemy.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED) {
          this.updateBossRanged(enemy, dt * Player.enemySpeedMultiplier);
        }
      }
      if (enemy.bladeCooldown > 0) {
        enemy.bladeCooldown = Math.max(0, enemy.bladeCooldown - dt);
      }
      if (enemy.hitFlash > 0) {
        enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      }
    }
  },

  moveTowardPlayer: function (enemy, dt) {
    var dx = Player.x - enemy.x;
    var dy = Player.y - enemy.y;
    var distance = Math.hypot(dx, dy);
    if (distance <= 0) return;
    enemy.x += dx / distance * enemy.speed * Player.enemySpeedMultiplier * dt;
    enemy.y += dy / distance * enemy.speed * Player.enemySpeedMultiplier * dt;
  },

  // ---------- 远程Boss：畸变炮台者 ----------
  isCharging: function (enemy) { return enemy.bossChargeTimer > 0; },

  updateBossRanged: function (enemy, dt) {
    if (enemy.bossChargeTimer > 0) {
      // 蓄力中：记录玩家位置，结束后发射
      enemy.bossChargeTimer -= dt;
      enemy.bossTargetX = Player.x;
      enemy.bossTargetY = Player.y;
      if (enemy.bossChargeTimer <= 0) {
        this.fireBossProjectile(enemy);
        enemy.bossAttackTimer = CONFIG.BOSS_RANGED.ATTACK_INTERVAL;
      }
    } else {
      enemy.bossAttackTimer -= dt;
      if (enemy.bossAttackTimer <= 0) {
        enemy.bossChargeTimer = CONFIG.BOSS_RANGED.CHARGE_TIME;
        enemy.bossTargetX = Player.x;
        enemy.bossTargetY = Player.y;
      }
    }
  },

  fireBossProjectile: function (enemy) {
    var tx = enemy.bossTargetX, ty = enemy.bossTargetY;
    var dx = tx - enemy.x, dy = ty - enemy.y;
    var dist = Math.hypot(dx, dy);
    if (dist <= 0) { dx = 0; dy = -1; dist = 1; }
    var speed = CONFIG.BOSS_RANGED.PROJECTILE_SPEED;
    for (var i = 0; i < this.bossProjectiles.length; i++) {
      var p = this.bossProjectiles[i];
      if (p.active) continue;
      p.active = true;
      p.x = enemy.x; p.y = enemy.y;
      p.vx = dx / dist * speed;
      p.vy = dy / dist * speed;
      p.tx = tx; p.ty = ty;
      p.life = 0;
      return;
    }
  },

  updateBossProjectiles: function (dt) {
    for (var i = 0; i < this.bossProjectiles.length; i++) {
      var p = this.bossProjectiles[i];
      if (!p.active) continue;
      p.life += dt;
      // 朝目标点直线飞行
      var dx = p.tx - p.x, dy = p.ty - p.y;
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
      var pdx = Player.x - p.x, pdy = Player.y - p.y;
      var directHit = (pdx * pdx + pdy * pdy <= hitR * hitR);
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
      var dx = Player.x - x, dy = Player.y - y;
      if (dx * dx + dy * dy <= r * r) {
        Player.takeDamage(CONFIG.BOSS_RANGED.EXPLOSION_DAMAGE, 'boss');
      }
    }
  },

  drawRangedBossDetails: function (ctx, enemy, sx, sy) {
    // 背部酸性肿瘤炮台（深紫）
    var turretR = CONFIG.BOSS_RANGED.TURRET_RADIUS;
    var now = (typeof performance !== 'undefined') ? performance.now() / 1000 : 0;
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
    var chargeRatio = this.isCharging(enemy)
      ? 1 - enemy.bossChargeTimer / CONFIG.BOSS_RANGED.CHARGE_TIME : 0;
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
      var sx = p.x - Camera.x, sy = p.y - Camera.y;
      // 落点预警圈
      var wx = p.tx - Camera.x, wy = p.ty - Camera.y;
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

  applyDamage: function (enemy, damage) {
    if (!enemy.active) return;
    enemy.hp -= damage;
    if (enemy.hp <= 0) this.kill(enemy);
  },

  kill: function (enemy) {
    if (!enemy.active) return;
    var dropX = enemy.x, dropY = enemy.y, typeIndex = enemy.typeIndex;
    var type = CONFIG.ENEMY.TYPES[typeIndex];
    enemy.active = false;
    this.activeCount -= 1;
    RunStats.kills += 1;
    if (Player.killHeal > 0) Player.hp = Math.min(Player.maxHp, Player.hp + Player.killHeal);
    // 远程Boss：大量经验 + 金币 + 必掉主动道具，不触发近战Boss胜利
    if (typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED) {
      var gemCount = CONFIG.BOSS_RANGED.DROP_GEMS;
      for (var g = 0; g < gemCount; g++) {
        Experience.dropGem(
          dropX + (Math.random() * 2 - 1) * 100,
          dropY + (Math.random() * 2 - 1) * 100, 10);
      }
      if (type.COINS > 0) CoinDrops.drop(dropX, dropY, type.COINS);
      PowerUps.dropRandom(dropX, dropY);
      if (root.BossSystem) root.BossSystem.onRangedBossDefeated();
      return;
    }
    if (type.EXP > 0) Experience.dropGem(dropX, dropY, type.EXP);
    if (type.COINS > 0) CoinDrops.drop(dropX, dropY, type.COINS);
    PowerUps.rollDrop(dropX, dropY, typeIndex);
    if (typeIndex === CONFIG.ENEMY.TYPE_BOSS) BossSystem.onBossDefeated();
  },

  recycleOneNonBoss: function () {
    for (var i = 0; i < this.pool.length; i++) {
      var enemy = this.pool[i];
      if (enemy.active && enemy.typeIndex !== CONFIG.ENEMY.TYPE_BOSS) {
        enemy.active = false;
        this.activeCount -= 1;
        return true;
      }
    }
    return false;
  },

  clearScreenForRevive: function () {
    var left = Camera.x, right = Camera.x + CONFIG.VIEW.WIDTH;
    var top = Camera.y, bottom = Camera.y + CONFIG.VIEW.HEIGHT;
    for (var i = 0; i < this.pool.length; i++) {
      var enemy = this.pool[i];
      if (!enemy.active || enemy.typeIndex === CONFIG.ENEMY.TYPE_BOSS) continue;
      if (enemy.x + enemy.radius < left || enemy.x - enemy.radius > right ||
          enemy.y + enemy.radius < top || enemy.y - enemy.radius > bottom) continue;
      enemy.active = false;
      this.activeCount -= 1;
    }
    var boss = this.getActiveBoss();
    if (boss) {
      var dx = boss.x - Player.x, dy = boss.y - Player.y;
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
      if (e.active && (e.typeIndex === CONFIG.ENEMY.TYPE_BOSS ||
          e.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED)) list.push(e);
    }
    return list;
  },

  findNearest: function (x, y) {
    var nearest = null, nearestDistanceSquared = Infinity;
    for (var i = 0; i < this.pool.length; i++) {
      var enemy = this.pool[i];
      if (!enemy.active) continue;
      var dx = enemy.x - x, dy = enemy.y - y;
      var d2 = dx * dx + dy * dy;
      if (d2 < nearestDistanceSquared) { nearestDistanceSquared = d2; nearest = enemy; }
    }
    return nearest;
  },

  checkPlayerCollisions: function () {
    for (var i = 0; i < this.pool.length; i++) {
      var enemy = this.pool[i];
      if (!enemy.active) continue;
      var hitDistance = CONFIG.PLAYER.RADIUS + enemy.radius;
      var dx = Player.x - enemy.x, dy = Player.y - enemy.y;
      if (dx * dx + dy * dy <= hitDistance * hitDistance) {
        var src = enemy.typeIndex === CONFIG.ENEMY.TYPE_ELITE ? 'elite'
          : (enemy.typeIndex === CONFIG.ENEMY.TYPE_BOSS ||
             enemy.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED) ? 'boss' : 'normal';
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

  drawOne: function (ctx, enemy) {
    var screenX = enemy.x - Camera.x;
    var screenY = enemy.y - Camera.y;
    var margin = enemy.radius + CONFIG.SPAWNER.OUTSIDE_MARGIN;
    var type = CONFIG.ENEMY.TYPES[enemy.typeIndex];
    if (screenX < -margin || screenX > CONFIG.VIEW.WIDTH + margin ||
        screenY < -margin || screenY > CONFIG.VIEW.HEIGHT + margin) return;

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
    if (PowerUps.isFrozen()) {
      ctx.beginPath();
      ctx.arc(screenX, screenY, enemy.radius * 0.82, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.COLORS.ENEMY_FROZEN;
      ctx.fill();
    }
    ctx.restore();
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
  }
};

// ---------- Bullet（子弹） ----------
var Bullet = {
  pool: [], activeCount: 0,
  initPool: function () {
    this.pool.length = 0;
    for (var i = 0; i < CONFIG.WEAPONS.PULSE.POOL_SIZE; i++) {
      this.pool.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, damage: 0,
        pierceRemaining: 0, hitCount: 0,
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
        bullet.x = x; bullet.y = y;
        bullet.vx = Math.cos(angle) * speed;
        bullet.vy = Math.sin(angle) * speed;
        bullet.life = CONFIG.WEAPONS.PULSE.LIFE;
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
      if (this.shouldRemove(bullet)) { this.deactivate(bullet); continue; }
      this.checkEnemyHits(bullet);
    }
  },
  shouldRemove: function (bullet) {
    var r = CONFIG.WEAPONS.PULSE.RADIUS;
    return bullet.life <= 0 || bullet.x < 0 || bullet.y < 0 ||
      bullet.x > CONFIG.WORLD.WIDTH || bullet.y > CONFIG.WORLD.HEIGHT;
  },
  checkEnemyHits: function (bullet) {
    for (var i = 0; i < Enemy.pool.length; i++) {
      var enemy = Enemy.pool[i];
      if (!enemy.active || this.hasAlreadyHit(bullet, enemy.spawnId)) continue;
      var hitDistance = CONFIG.WEAPONS.PULSE.RADIUS + enemy.radius;
      var dx = bullet.x - enemy.x, dy = bullet.y - enemy.y;
      if (dx * dx + dy * dy > hitDistance * hitDistance) continue;
      Combat.hitEnemy(enemy, bullet.damage, enemy.x, enemy.y);
      bullet.hitSpawnIds[bullet.hitCount] = enemy.spawnId;
      bullet.hitCount += 1;
      if (bullet.pierceRemaining > 0) {
        bullet.pierceRemaining -= 1;
      } else {
        this.deactivate(bullet);
        return;
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
      ctx.translate(screenX, screenY); ctx.rotate(angle);
      ctx.shadowColor = '#fff36a'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffd928'; ctx.fillRect(-30, -3, 30, 6);
      ctx.fillStyle = '#fffbd2'; ctx.fillRect(-28, -1, 28, 2);
      ctx.restore(); return;
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

// ---------- PulseGun（脉冲手枪） ----------
var PulseGun = {
  cooldown: 0, damageBonus: 0, damageFlat: 0,
  fireRateBonus: 0, speedFlat: 0,
  projectileCount: CONFIG.WEAPONS.PULSE.BASE_PROJECTILES,
  penetration: CONFIG.WEAPONS.PULSE.BASE_PENETRATION,
  muzzleFlashTimer: 0, cooldownMultiplier: 1, projectileMultiplier: 1,
  damageMultiplier: 1, laserCannon: false,

  reset: function () {
    this.cooldown = 0;
    this.damageBonus = 0; this.damageFlat = 0;
    this.fireRateBonus = 0; this.speedFlat = 0;
    this.muzzleFlashTimer = 0;
    this.cooldownMultiplier = 1; this.projectileMultiplier = 1;
    this.damageMultiplier = 1; this.laserCannon = false;
    this.projectileCount = Math.min(CONFIG.WEAPONS.PULSE.MAX_PROJECTILES,
      CONFIG.WEAPONS.PULSE.BASE_PROJECTILES + Math.round(Meta.getEffectTotal('START_PROJECTILE')));
    this.penetration = CONFIG.WEAPONS.PULSE.BASE_PENETRATION;
  },

  update: function (dt) {
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
    return Math.max(CONFIG.WEAPONS.PULSE.MIN_INTERVAL,
      CONFIG.WEAPONS.PULSE.INTERVAL * this.cooldownMultiplier / (1 + this.fireRateBonus));
  },
  getBulletSpeed: function () {
    return Math.min(CONFIG.WEAPONS.PULSE.MAX_SPEED,
      (CONFIG.WEAPONS.PULSE.SPEED + this.speedFlat) * (this.laserCannon ? 1.5 : 1));
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
  }
};

// ---------- OrbitBlade（环绕飞刃） ----------
var OrbitBlade = {
  angle: 0, damageFlat: 0, count: CONFIG.WEAPONS.BLADE.COUNT, speedBonus: 0, cooldownMultiplier: 1,
  reset: function () {
    this.angle = 0; this.damageFlat = 0; this.count = CONFIG.WEAPONS.BLADE.COUNT;
    this.speedBonus = 0; this.cooldownMultiplier = 1;
  },
  update: function (dt) {
    this.angle += CONFIG.WEAPONS.BLADE.ANGULAR_SPEED * (1 + this.speedBonus) * dt;
    if (this.angle >= Math.PI * 2) this.angle -= Math.PI * 2;
    this.checkEnemyHits();
  },
  getDamage: function () { return CONFIG.WEAPONS.BLADE.DAMAGE + this.damageFlat; },
  getBladeAngle: function (index) { return this.angle + index * Math.PI * 2 / this.count; },
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
        var dx = bladeX - enemy.x, dy = bladeY - enemy.y;
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
    var ghosts = [ { off: -0.15, a: 0.30 }, { off: -0.30, a: 0.15 } ];
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

// ---------- Weapons（武器统一入口） ----------
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
  }
};

// ---------- LaserEmitter（定向激光发射器，道具 typeIndex=5） ----------
var LaserEmitter = {
  active: false, timer: 0, tickTimer: 0, angle: 0, startX: 0, startY: 0,
  duration: 0, width: 0, damagePerTick: 0, totalDamage: 0,

  reset: function () {
    this.active = false; this.timer = 0; this.tickTimer = 0;
  },

  activate: function () {
    var target = Enemy.findNearest(Player.x, Player.y);
    this.angle = target ? Math.atan2(target.y - Player.y, target.x - Player.x) : -Math.PI / 2;
    this.startX = Player.x; this.startY = Player.y;
    var dmgLv = root.Meta.getGadgetLevel('laser', 'dmg');
    var durLv = root.Meta.getGadgetLevel('laser', 'duration');
    var widLv = root.Meta.getGadgetLevel('laser', 'width');
    this.duration = CONFIG.LASER_EMITTER.BASE_DURATION + 0.3 * durLv;
    this.width = CONFIG.LASER_EMITTER.BASE_WIDTH + 10 * widLv;
    this.damagePerTick = PulseGun.getDamage() * CONFIG.LASER_EMITTER.DAMAGE_MULTIPLIER * (1 + 0.15 * dmgLv);
    this.timer = this.duration;
    this.tickTimer = 0;
    this.totalDamage = 0;
    this.active = true;
    return true;
  },

  update: function (dt) {
    if (!this.active) return;
    this.timer -= dt;
    this.tickTimer -= dt;
    if (this.tickTimer <= 0) {
      this.tickTimer = CONFIG.LASER_EMITTER.TICK_INTERVAL;
      this.dealDamage();
    }
    if (this.timer <= 0) {
      this.active = false;
      if (root.Meta.getGadgetLevel('laser', 'overload') > 0) this.explode();
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
    var end = this._endPoint();
    var halfW = this.width / 2;
    for (var i = 0; i < Enemy.pool.length; i++) {
      var e = Enemy.pool[i];
      if (!e.active) continue;
      if (pointToSegDist(e.x, e.y, this.startX, this.startY, end.x, end.y) < halfW + e.radius) {
        Combat.hitEnemy(e, this.damagePerTick, e.x, e.y);
        this.totalDamage += this.damagePerTick;
      }
    }
  },

  explode: function () {
    var end = this._endPoint();
    var r = CONFIG.LASER_EMITTER.OVERLOAD_RADIUS;
    var dmg = this.totalDamage * CONFIG.LASER_EMITTER.OVERLOAD_RATIO;
    for (var i = 0; i < Enemy.pool.length; i++) {
      var e = Enemy.pool[i];
      if (!e.active) continue;
      var dx = e.x - end.x, dy = e.y - end.y;
      if (dx * dx + dy * dy <= r * r) Combat.hitEnemyFixed(e, dmg, e.x, e.y);
    }
    if (root.FX && root.FX.burst) root.FX.burst(end.x, end.y, CONFIG.COLORS.LASER_EMITTER_BEAM);
  },

  draw: function (ctx) {
    if (!this.active) return;
    var end = this._endPoint();
    var sx = this.startX - Camera.x, sy = this.startY - Camera.y;
    var ex = end.x - Camera.x, ey = end.y - Camera.y;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.4 + Math.random() * 0.2;
    ctx.strokeStyle = CONFIG.COLORS.LASER_EMITTER_BEAM;
    ctx.lineWidth = this.width;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = CONFIG.COLORS.LASER_EMITTER_CORE;
    ctx.lineWidth = this.width * 0.3;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.restore();
  }
};

// ---------- MortarStrike（迫击炮空袭，道具 typeIndex=6） ----------
var MortarStrike = {
  shells: [],

  reset: function () { this.shells.length = 0; },

  activate: function () {
    var countLv = root.Meta.getGadgetLevel('mortar', 'count');
    var fullcover = root.Meta.getGadgetLevel('mortar', 'fullcover') > 0;
    var count = CONFIG.MORTAR.BASE_COUNT + countLv + (fullcover ? CONFIG.MORTAR.FULLCOVER_EXTRA : 0);
    var targets = this._findTargets(count, fullcover);
    for (var i = 0; i < targets.length; i++) {
      this.shells.push({
        active: true, x: targets[i].x, y: targets[i].y - CONFIG.MORTAR.FALL_HEIGHT,
        targetX: targets[i].x, targetY: targets[i].y,
        t: -i * CONFIG.MORTAR.SALVO_INTERVAL,
        exploded: false, burnTimer: 0
      });
    }
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
      var screenX = e.x - Camera.x, screenY = e.y - Camera.y;
      if (screenX < 0 || screenX > CONFIG.VIEW.WIDTH || screenY < 0 || screenY > CONFIG.VIEW.HEIGHT) continue;
      var cx = Math.floor(e.x / gs), cy = Math.floor(e.y / gs);
      var key = cx + '_' + cy;
      if (!grid[key]) grid[key] = { x: e.x, y: e.y, n: 0, elite: false };
      grid[key].x = (grid[key].x * grid[key].n + e.x) / (grid[key].n + 1);
      grid[key].y = (grid[key].y * grid[key].n + e.y) / (grid[key].n + 1);
      grid[key].n += 1;
      var isStrong = e.typeIndex === CONFIG.ENEMY.TYPE_ELITE || e.typeIndex === CONFIG.ENEMY.TYPE_BOSS ||
        e.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED;
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
    for (var k = 0; k < Math.min(n, keys.length); k++) out.push({ x: grid[keys[k]].x, y: grid[keys[k]].y });
    // 屏幕内无敌人则随机落点屏幕中央
    if (out.length === 0) out.push({ x: Camera.x + CONFIG.VIEW.WIDTH / 2, y: Camera.y + CONFIG.VIEW.HEIGHT / 2 });
    // 目标格少于请求数量时，复用落点（轻微错开）补齐到 n 发
    while (out.length < n) {
      var base = out[out.length - 1];
      out.push({ x: base.x + (Math.random() * 2 - 1) * 40, y: base.y + (Math.random() * 2 - 1) * 40 });
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
    for (var i = this.shells.length - 1; i >= 0; i--) {
      var s = this.shells[i];
      if (!s.active) continue;
      s.t += dt;
      if (s.t < 0) continue; // 齐射间隔未到
      if (!s.exploded) {
        var flightT = s.t / CONFIG.MORTAR.SHELL_FLIGHT_TIME;
        if (flightT >= 1) {
          s.exploded = true;
          this._explode(s);
          if (root.Meta.getGadgetLevel('mortar', 'burn') > 0) s.burnTimer = CONFIG.MORTAR.BURN_DURATION;
        } else {
          // 抛物线下落
          s.x = s.targetX;
          s.y = s.targetY - CONFIG.MORTAR.FALL_HEIGHT + CONFIG.MORTAR.FALL_HEIGHT * flightT
            - Math.sin(flightT * Math.PI) * 100;
        }
      }
      if (s.burnTimer > 0) {
        s.burnTimer -= dt;
        this._burnTick(s, dt);
        if (s.burnTimer <= 0) s.active = false;
      } else if (s.exploded) {
        s.active = false;
      }
    }
    for (var j = this.shells.length - 1; j >= 0; j--) {
      if (!this.shells[j].active) this.shells.splice(j, 1);
    }
  },

  _explode: function (s) {
    var r = this._radius(), dmg = this._baseDmg();
    for (var i = 0; i < Enemy.pool.length; i++) {
      var e = Enemy.pool[i];
      if (!e.active) continue;
      var dx = e.x - s.targetX, dy = e.y - s.targetY;
      if (dx * dx + dy * dy <= r * r) Combat.hitEnemy(e, dmg, e.x, e.y);
    }
    if (root.FX && root.FX.burst) root.FX.burst(s.targetX, s.targetY, CONFIG.COLORS.ITEM_MORTAR);
  },

  _burnTick: function (s, dt) {
    var r = this._radius();
    var burnLv = root.Meta.getGadgetLevel('mortar', 'burn');
    var dps = this._baseDmg() * CONFIG.MORTAR.BURN_DPS_RATIO * burnLv;
    for (var i = 0; i < Enemy.pool.length; i++) {
      var e = Enemy.pool[i];
      if (!e.active) continue;
      var dx = e.x - s.targetX, dy = e.y - s.targetY;
      if (dx * dx + dy * dy <= r * r) Combat.hitEnemyFixed(e, dps * dt, e.x, e.y);
    }
  },

  draw: function (ctx) {
    for (var i = 0; i < this.shells.length; i++) {
      var s = this.shells[i];
      if (!s.active || s.t < 0) continue;
      var tx = s.targetX - Camera.x, ty = s.targetY - Camera.y;
      var r = this._radius();
      if (!s.exploded) {
        // 预警圈（从 1.5r 缩小到 r）
        var flightT = Math.min(1, s.t / CONFIG.MORTAR.SHELL_FLIGHT_TIME);
        var warnR = r * (1 + (1 - flightT) * 0.5);
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = CONFIG.COLORS.MORTAR_WARNING;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(tx, ty, warnR, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        // 炮弹
        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x - Camera.x, s.y - Camera.y, CONFIG.MORTAR.SHELL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.COLORS.ITEM_MORTAR;
        ctx.fill();
        ctx.restore();
      }
      if (s.burnTimer > 0) {
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.random() * 0.2;
        ctx.fillStyle = CONFIG.COLORS.MORTAR_FIRE;
        ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }
};

// 点到线段距离（激光宽度判定）
function pointToSegDist(px, py, x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1;
  var len2 = dx * dx + dy * dy;
  var t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  var cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

root.Player = Player;
root.Enemy = Enemy;
root.Bullet = Bullet;
root.PulseGun = PulseGun;
root.OrbitBlade = OrbitBlade;
root.Weapons = Weapons;
root.LaserEmitter = LaserEmitter;
root.MortarStrike = MortarStrike;

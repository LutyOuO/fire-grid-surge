(function () {
  'use strict';

  // ============================================================
  // player.js — 玩家模块
  // 职责：玩家移动/冲刺/受击/属性/角色外观渲染
  // 主要对象：Player(x,y,hp,maxHp,speed/init/reset/update/draw/takeDamage/startDash/canDash)
  // 全局状态：G.player（Player 单例 x/y/hp/maxHp/speed/dashing/critChance/globalDamageBonus/reviveCharges）；读 G.input(moveX,moveY)
  // 依赖：core.js(G/Game/Camera), input.js(G.input), save.js(Meta 养成), config.js(CONFIG)
  // 加载顺序：core → input → save → player
  // ============================================================
  var root = typeof window !== 'undefined' ? window : global;
  var CONFIG = root.CONFIG;
  var Player = {
    x: CONFIG.PLAYER.START_X,
    y: CONFIG.PLAYER.START_Y,
    hp: CONFIG.PLAYER.MAX_HP,
    maxHp: CONFIG.PLAYER.MAX_HP,
    moveSpeedBonus: 0,
    critChance: CONFIG.PLAYER.BASE_CRIT_CHANCE,
    critDamageBonus: 0,
    globalDamageBonus: 0,
    incomingDamageMultiplier: 1,
    expGainBonus: 0,
    killHeal: 0,
    enemySpeedMultiplier: 1,
    phoenixReady: false,
    executeChance: 0,
    pickupRadius: CONFIG.EXPERIENCE.PICKUP_RADIUS,
    invincibleTimer: 0,
    reviveCharges: 0,
    // 受击反馈
    renderOffsetX: 0,
    renderOffsetY: 0,
    hitScaleTimer: 0,
    hitShakeTimer: 0,
    // 冲刺
    dashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: 0,
    dashDirY: -1,
    dashArrowTimer: 0,
    dashTrailTimer: 0,
    dashScaleTimer: 0,
    dashReadyFlash: 0,
    dashDustTimer: 0,
    lastMoveDirX: 0,
    lastMoveDirY: 1,
    dashTrails: [],
    // 血包升级：护盾 / 持续恢复 / 自动急救
    shield: 0,
    shieldTimer: 0,
    shieldFlash: 0,
    upgradeShieldMax: 0,
    upgradeShieldRecharge: 0,
    regenTimer: 0,
    regenRate: 0,
    autoMedkitUsed: false,
    // #5 射击后坐力（渲染偏移，不改真实位置）
    recoilX: 0,
    recoilY: 0,
    recoilTimer: 0,
    recoilReturnTimer: 0,
    // #16 朝向与移动起伏
    facingAngle: 0,
    bobOffset: 0,
    reset: function () {
      this.x = CONFIG.PLAYER.START_X;
      this.y = CONFIG.PLAYER.START_Y;
      this.maxHp = Math.min(CONFIG.PLAYER.MAX_HP_LIMIT, CONFIG.PLAYER.MAX_HP + Meta.getEffectTotal('MAX_HP'));
      this.hp = this.maxHp;
      this.moveSpeedBonus = Meta.getEffectTotal('MOVE_SPEED');
      this.critChance = CONFIG.PLAYER.BASE_CRIT_CHANCE;
      this.critDamageBonus = 0;
      this.globalDamageBonus = 0;
      this.incomingDamageMultiplier = 1;
      this.expGainBonus = 0;
      this.killHeal = 0;
      this.enemySpeedMultiplier = 1;
      this.phoenixReady = false;
      this.executeChance = 0;
      this.pickupRadius = Math.min(CONFIG.EXPERIENCE.MAX_PICKUP_RADIUS, CONFIG.EXPERIENCE.PICKUP_RADIUS + Meta.getEffectTotal('PICKUP_RADIUS'));
      this.invincibleTimer = 0;
      this.reviveCharges = Math.round(Meta.getEffectTotal('REVIVE'));
      // 受击反馈
      this.renderOffsetX = 0;
      this.renderOffsetY = 0;
      this.hitScaleTimer = 0;
      this.hitShakeTimer = 0;
      // 冲刺
      this.dashing = false;
      this.dashTimer = 0;
      this.dashCooldown = 0;
      this.dashDirX = 0;
      this.dashDirY = -1;
      this.dashArrowTimer = 0;
      this.dashTrailTimer = 0;
      this.dashScaleTimer = 0;
      this.dashReadyFlash = 0;
      this.dashDustTimer = 0;
      this.lastMoveDirX = 0;
      this.lastMoveDirY = 1;
      this.dashTrails.length = 0;
      // 血包升级
      this.shield = 0;
      this.shieldTimer = 0;
      this.upgradeShieldMax = 0;
      this.upgradeShieldRecharge = 0;
      this.regenTimer = 0;
      this.regenRate = 0;
      this.autoMedkitUsed = false;
      // 后坐力 / 朝向
      this.recoilX = 0;
      this.recoilY = 0;
      this.recoilTimer = 0;
      this.recoilReturnTimer = 0;
      this.facingAngle = 0;
      this.bobOffset = 0;
    },
    update: function (dt) {
      var startX = this.x,
        startY = this.y;
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
          this.dashTrails.push({
            x: this.x,
            y: this.y,
            life: CONFIG.PLAYER.DASH_TRAIL_LIFE
          });
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
      if (!this.autoMedkitUsed && root.Meta && Meta.getGadgetLevel('medkit', 'auto') > 0 && this.hp > 0 && this.hp < this.maxHp * 0.25 && this.hp < this.maxHp) {
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
          this.renderOffsetX = 0;
          this.renderOffsetY = 0;
        }
      } else {
        this.renderOffsetX = 0;
        this.renderOffsetY = 0;
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
        this.recoilX *= rem;
        this.recoilY *= rem;
        if (this.recoilReturnTimer <= 0) {
          this.recoilX = 0;
          this.recoilY = 0;
        }
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
      var pos = root.Field.collideWalls(this.x, this.y, CONFIG.PLAYER.RADIUS);
      this.x = pos.x;
      this.y = pos.y;
      if (this.dashing && this.nextDashSpeed) {
        this.x += (this.x - startX) * this.nextDashSpeed;
        this.y += (this.y - startY) * this.nextDashSpeed;
        this.clampToWorld();
      }
    },
    getMoveSpeed: function () {
      return Math.min(CONFIG.PLAYER.MAX_SPEED, CONFIG.PLAYER.SPEED * (1 + this.moveSpeedBonus));
    },
    canDash: function () {
      return !this.dashing && this.dashCooldown <= 0;
    },
    startDash: function () {
      if (!this.canDash()) return false;
      var move = Input.getMoveVector();
      var dx = move.x,
        dy = move.y;
      if (Math.hypot(dx, dy) < 0.1) {
        dx = this.lastMoveDirX;
        dy = this.lastMoveDirY;
      }
      if (Math.hypot(dx, dy) < 0.1) {
        dx = 0;
        dy = -1;
      } // 无记录时默认朝上
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
      if (this.nextDashTime) this.dashTimer += this.nextDashTime;
      if (this.nextDashCd) this.dashCooldown = Math.max(.5, this.dashCooldown - this.nextDashCd);
      if (this.nextDashCdRatio) this.dashCooldown *= this.nextDashCdRatio;
      root.Objectives.add('dash', 1);
      root.Achievements.add('dash', 1);
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
      if (root.DevConsole.god || this.nextGod) return false;
      if (this.invincibleTimer > 0) return false;
      // 护盾优先吸收伤害
      if (this.shield > 0 && amount > 0) {
        var absorbed = Math.min(this.shield, amount);
        this.shield -= absorbed;
        amount -= absorbed;
        if (this.shield <= 0) {
          this.shield = 0;
          this.shieldTimer = 0;
          if (this.upgradeShieldMax > 0) this.upgradeShieldRecharge = 12;
        }
        if (amount <= 0) {
          // 护盾完全吸收：不扣血、不触发无敌帧与受击反馈
          this.shieldFlash = 0.2;
          if (this.invincibleTimeBonus) this.invincibleTimer += this.invincibleTimeBonus;
          root.Objectives.onDamage();
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
        var stretch = this.dashing ? 1 : this.dashScaleTimer / CONFIG.PLAYER.DASH_SCALE_TIME;
        var sxA = 1 + (CONFIG.PLAYER.DASH_STRETCH_X - 1) * stretch;
        var syA = 1 - (1 - CONFIG.PLAYER.DASH_STRETCH_Y) * stretch;
        var ang = Math.atan2(this.dashDirY, this.dashDirX);
        ctx.rotate(ang);
        ctx.scale(sxA, syA);
        ctx.rotate(-ang);
      } else if (this.hitScaleTimer > 0) {
        var t2 = 1 - this.hitScaleTimer / CONFIG.PLAYER.HIT_SCALE_TIME;
        var e2 = 1 - (1 - t2) * (1 - t2); // easeOutQuad
        ctx.scale(CONFIG.PLAYER.HIT_SCALE_X - (CONFIG.PLAYER.HIT_SCALE_X - 1) * e2, CONFIG.PLAYER.HIT_SCALE_Y + (1 - CONFIG.PLAYER.HIT_SCALE_Y) * e2);
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
      root.CostumeView.draw.call(this, ctx);
    }
  };
  root.Player = Player;
  root.G.player = Player;
})();

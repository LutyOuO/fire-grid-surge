'use strict';
// ============================================================
// Core（核心模块）：CanvasView / Input / Camera / Combat / DamageText
// 输入已改为 Platform 统一触摸事件，支持微信 wx.onTouch* 与 H5 pointer
// ============================================================
var root = (typeof window !== 'undefined') ? window : global;
var CONFIG = root.CONFIG;
var Platform = root.Platform;

// ---------- CanvasView（画布） ----------
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

// ---------- Input（输入）：键盘 + 动态虚拟摇杆 + 界面点击 ----------
var Input = {
  keys: Object.create(null),
  moveVector: { x: 0, y: 0 },
  pointerPoint: { x: 0, y: 0 },
  pendingTap: { active: false, x: 0, y: 0 },
  tapQueueX: [], tapQueueY: [],
  movementEnabled: true,
  _activeTouchId: -1,
  joystick: {
    active: false,
    pointerId: -1,
    originX: 0, originY: 0,
    currentX: 0, currentY: 0,
    moveX: 0, moveY: 0
  },

  init: function () {
    var self = this;
    // 键盘（H5/开发者工具）
    Platform.onKeyDown(function (e) { self.onKeyDown(e); });
    Platform.onKeyUp(function (e) { self.onKeyUp(e); });
    // 触摸（微信 + H5 统一由 Platform 分发）
    Platform.onTouchStart(function (x, y, rawEvent, pointerId) {
      self.onTouchStart(x, y, pointerId);
    });
    Platform.onTouchMove(function (x, y, rawEvent, pointerId) {
      self.onTouchMove(x, y, pointerId);
    });
    Platform.onTouchEnd(function (x, y, rawEvent, pointerId) {
      self.onTouchEnd(x, y, pointerId);
    });
    Platform.onTouchCancel(function (x, y, rawEvent, pointerId) {
      if (self.onTouchCancel) self.onTouchCancel(x, y, pointerId);
      else self.onTouchEnd(x, y, pointerId);
    });
  },

  isMoveKey: function (code) {
    return code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD' ||
      code === 'ArrowUp' || code === 'ArrowLeft' || code === 'ArrowDown' || code === 'ArrowRight';
  },

  onKeyDown: function (event) {
    if (this.isMoveKey(event.code)) {
      if (event.preventDefault) event.preventDefault();
      this.keys[event.code] = true;
    }
  },

  onKeyUp: function (event) {
    if (this.isMoveKey(event.code)) {
      if (event.preventDefault) event.preventDefault();
      this.keys[event.code] = false;
    }
  },

  // 微信触摸事件：坐标已由 Platform 转为逻辑坐标
  onTouchStart: function (x, y, touchId) {
    this.pointerPoint.x = x;
    this.pointerPoint.y = y;

    if (this.canStartJoystick(this.pointerPoint)) {
      this.startJoystick(touchId, x, y);
      return;
    }

    // 按钮在 touchstart 当帧入队；不会覆盖左手摇杆的 identifier。
    this.queueTap(x, y);
  },

  onTouchMove: function (x, y, touchId) {
    if (!this.joystick.active || this.joystick.pointerId !== touchId) return;
    this.updateJoystick(x, y);
  },

  onTouchEnd: function (x, y, touchId) {
    if (this.joystick.active && this.joystick.pointerId === touchId) {
      this.stopJoystick();
    }
  },

  canStartJoystick: function (point) {
    var inLeftZone = point.x <= CONFIG.VIEW.WIDTH * CONFIG.INPUT.JOYSTICK_ZONE_X_RATIO;
    var inBottomZone = point.y >= CONFIG.VIEW.HEIGHT * CONFIG.INPUT.JOYSTICK_ZONE_Y_RATIO;
    return this.movementEnabled && !this.joystick.active && inLeftZone && inBottomZone;
  },

  startJoystick: function (pointerId, x, y) {
    this.joystick.active = true;
    this.joystick.pointerId = pointerId;
    this.joystick.originX = x;
    this.joystick.originY = y;
    this.joystick.currentX = x;
    this.joystick.currentY = y;
    this.joystick.moveX = 0;
    this.joystick.moveY = 0;
  },

  updateJoystick: function (x, y) {
    var dx = x - this.joystick.originX;
    var dy = y - this.joystick.originY;
    var distance = Math.hypot(dx, dy);
    var maxRadius = CONFIG.INPUT.JOYSTICK_MAX_RADIUS;
    var clampedDistance = Math.min(distance, maxRadius);
    var normalX = distance > 0 ? dx / distance : 0;
    var normalY = distance > 0 ? dy / distance : 0;
    var strength = clampedDistance / maxRadius;

    this.joystick.currentX = this.joystick.originX + normalX * clampedDistance;
    this.joystick.currentY = this.joystick.originY + normalY * clampedDistance;

    if (strength < CONFIG.INPUT.JOYSTICK_DEAD_ZONE) {
      this.joystick.moveX = 0;
      this.joystick.moveY = 0;
      return;
    }
    this.joystick.moveX = normalX * strength;
    this.joystick.moveY = normalY * strength;
  },

  stopJoystick: function () {
    this.joystick.active = false;
    this.joystick.pointerId = -1;
    this.joystick.moveX = 0;
    this.joystick.moveY = 0;
  },

  getMoveVector: function () {
    var x = 0, y = 0;
    if (this.keys.KeyA || this.keys.ArrowLeft) x -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) x += 1;
    if (this.keys.KeyW || this.keys.ArrowUp) y -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) y += 1;

    if (this.joystick.active) {
      x += this.joystick.moveX;
      y += this.joystick.moveY;
    }

    var length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }

    this.moveVector.x = x;
    this.moveVector.y = y;
    return this.moveVector;
  },

  consumeTap: function (outPoint) {
    if (!this.pendingTap.active) return false;
    outPoint.x = this.pendingTap.x;
    outPoint.y = this.pendingTap.y;
    this.clearTap();
    return true;
  },

  queueTap: function (x, y) {
    if (!this.pendingTap.active) {
      this.pendingTap.active = true; this.pendingTap.x = x; this.pendingTap.y = y;
      return;
    }
    // 最多缓存 6 个并发按钮触点，防止异常触摸事件无界增长。
    if (this.tapQueueX.length < 6) { this.tapQueueX.push(x); this.tapQueueY.push(y); }
  },

  setMovementEnabled: function (enabled) {
    this.movementEnabled = enabled;
    if (!enabled) this.stopJoystick();
  },

  clearTap: function () {
    if (this.tapQueueX.length) {
      this.pendingTap.x = this.tapQueueX.shift();
      this.pendingTap.y = this.tapQueueY.shift();
      this.pendingTap.active = true;
    } else this.pendingTap.active = false;
  },

  reset: function () {
    this.keys = Object.create(null);
    this.clearTap();
    this.tapQueueX.length = 0; this.tapQueueY.length = 0; this.pendingTap.active = false;
    this.stopJoystick();
    this._activeTouchId = -1;
  }
};

// ---------- Camera（摄像机） ----------
var Camera = {
  x: 0, y: 0,
  // 屏幕抖动（受击反馈 c）：抖动偏移在 effects.js 的 drawGround 补丁中统一 translate
  shakeX: 0, shakeY: 0, shakeTimer: 0, shakeSize: 4,
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

// ---------- DamageText（伤害飘字） ----------
var DamageText = {
  pool: [],
  initPool: function () {
    this.pool.length = 0;
    for (var i = 0; i < CONFIG.DAMAGE_TEXT.POOL_SIZE; i++) {
      this.pool.push({ active: false, x: 0, y: 0, life: 0, text: '', isCrit: false });
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
      ctx.font = 'bold ' +
        (item.isCrit ? CONFIG.DAMAGE_TEXT.CRIT_SIZE *
          (1 + CONFIG.POLISH.CRIT_POP * item.life / CONFIG.DAMAGE_TEXT.LIFE)
          : CONFIG.DAMAGE_TEXT.NORMAL_SIZE) +
        'px Arial, "Microsoft YaHei", sans-serif';
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

// ---------- Combat（战斗结算） ----------
var Combat = {
  hitEnemy: function (enemy, baseDamage, hitX, hitY) {
    if (!enemy.active) return;
    var isCrit = Math.random() < Player.critChance;
    var permanentMultiplier = 1 + Meta.getEffectTotal('WEAPON_DAMAGE');
    var damage = baseDamage * permanentMultiplier * (1 + Player.globalDamageBonus) *
      (isCrit ? CONFIG.PLAYER.CRIT_MULTIPLIER + Player.critDamageBonus : 1);
    DamageText.spawn(hitX, hitY, damage, isCrit);
    Enemy.applyDamage(enemy, damage);
  },
  hitEnemyFixed: function (enemy, damage, hitX, hitY) {
    if (!enemy.active) return;
    DamageText.spawn(hitX, hitY, damage, false);
    Enemy.applyDamage(enemy, damage);
  }
};

root.CanvasView = CanvasView;
root.Input = Input;
root.Camera = Camera;
root.DamageText = DamageText;
root.Combat = Combat;

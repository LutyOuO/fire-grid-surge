(function () {
  'use strict';

  // ============================================================
  // input.js — 输入模块
  // 职责：键盘 + 虚拟摇杆 + 多点触控 + 界面点击排队
  // 主要对象：Input(init/reset/clearTap/onTouchStart/onTouchMove/onTouchEnd/onTouchCancel/setMovementEnabled),
  //           Input.joystick, Input.pendingTap, Input.activeTouches
  // 全局状态：G.input（Input 单例；事件回调写入 pendingTap/moveVector，update 经 G.input 读取）
  // 依赖：core.js(root/G), platform.js(Platform 触摸事件层), config.js(CONFIG)
  // 加载顺序：core → input
  // ============================================================
  var root = typeof window !== 'undefined' ? window : global;
  var CONFIG = root.CONFIG;
  var Input = {
    keys: Object.create(null),
    moveVector: {
      x: 0,
      y: 0
    },
    pointerPoint: {
      x: 0,
      y: 0
    },
    pendingTap: {
      active: false,
      x: 0,
      y: 0
    },
    tapQueueX: [],
    tapQueueY: [],
    movementEnabled: true,
    _activeTouchId: -1,
    joystick: {
      active: false,
      pointerId: -1,
      originX: 0,
      originY: 0,
      currentX: 0,
      currentY: 0,
      moveX: 0,
      moveY: 0
    },
    init: function () {
      var self = this;
      // 键盘（H5/开发者工具）
      Platform.onKeyDown(function (e) {
        self.onKeyDown(e);
      });
      Platform.onKeyUp(function (e) {
        self.onKeyUp(e);
      });
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
        if (self.onTouchCancel) self.onTouchCancel(x, y, pointerId);else self.onTouchEnd(x, y, pointerId);
      });
    },
    isMoveKey: function (code) {
      return code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD' || code === 'ArrowUp' || code === 'ArrowLeft' || code === 'ArrowDown' || code === 'ArrowRight';
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
      root.AudioFX.unlock();
      if (root.Ads.active) return;
      this.pointerPoint.x = x;
      this.pointerPoint.y = y;
      var touch = {
        id: touchId,
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
        type: null,
        startTime: Date.now(),
        state: root.Game.state,
        offerRevision: root.ExpLevelUp.offerRevision
      };

      // #109：补给商店是模态界面。打开时仍允许产生普通点击供商店处理，
      // 但绝不能再次启动摇杆、冲刺或命中画面下方的道具按钮。
      if (root.SupplyPoint && root.SupplyPoint.open) {
        this.activeTouches.set(touchId, touch);
        return;
      }

      // #122：炸弹拖拽占用自己的 touchId，另一根摇杆触点继续工作。
      if (root.Game.state === CONFIG.GAME.STATE_PLAYING && root.PowerUps && root.UI.ITEM_SLOTS) {
        var bombSlot = root.UI.ITEM_SLOTS.indexOf(CONFIG.POWERUPS.TYPE_BOMB);
        var bombRect = bombSlot >= 0 ? root.UI.getSlotRect(bombSlot) : null;
        if (bombRect && root.PowerUps.inventory[CONFIG.POWERUPS.TYPE_BOMB] > 0 && root.UI.isPointInRect(touch, bombRect.x, bombRect.y, bombRect.w, bombRect.h)) {
          touch.type = 'bombAim'; this.activeTouches.set(touchId, touch); root.PowerUps.beginBombAim(touchId, x, y); return;
        }
      }

      // 冲刺是右下角独立按钮：按下即生效，方向在此刻锁定。
      var dashX = root.UI.mirrorX(CONFIG.UI.DASH_BUTTON_X);
      var ddx = x - dashX;
      var ddy = y - root.UI.getDashButtonY();
      if (root.Game.state === CONFIG.GAME.STATE_PLAYING && ddx * ddx + ddy * ddy <= CONFIG.UI.DASH_BUTTON_RADIUS * CONFIG.UI.DASH_BUTTON_RADIUS) {
        touch.type = 'button';
        touch.action = 'dash';
        this.activeTouches.set(touchId, touch);
        root.ButtonUI.pressedTouches.set(touchId, {
          x: dashX - CONFIG.UI.DASH_BUTTON_RADIUS,
          y: root.UI.getDashButtonY() - CONFIG.UI.DASH_BUTTON_RADIUS,
          w: CONFIG.UI.DASH_BUTTON_RADIUS * 2,
          h: CONFIG.UI.DASH_BUTTON_RADIUS * 2
        });
        if (root.Player.canDash()) root.Player.startDash();
        return;
      }

      // 分类在 touchstart 后锁定；只有第一个左下触点成为摇杆。
      if (this.canStartJoystick(this.pointerPoint)) {
        touch.type = 'joystick';
        this.activeTouches.set(touchId, touch);
        this.startJoystick(touchId, x, y);
        return;
      }

      // 检查按钮热区（从上层到下层）
      for (var i = root.ButtonUI.count - 1; i >= 0; i--) {
        var b = root.ButtonUI.pool[i];
        if (!root.UI.isPointInRect(this.pointerPoint, b.x, b.y, b.w, b.h)) continue;
        touch.type = 'button';
        touch.button = {
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h
        };
        this.activeTouches.set(touchId, touch);
        root.ButtonUI.pressedTouches.set(touchId, touch.button);
        return;
      }
      this.activeTouches.set(touchId, touch);
    },
    onTouchMove: function (x, y, touchId) {
      root.ButtonUI.hover.x = x;
      root.ButtonUI.hover.y = y;
      var touch = this.activeTouches.get(touchId);
      if (!touch) return;
      touch.currentX = x;
      touch.currentY = y;
      if (touch.type === 'joystick' && this.joystick.pointerId === touchId) this.updateJoystick(x, y);
      if (touch.type === 'bombAim') root.PowerUps.moveBombAim(touchId, x, y);
    },
    onTouchEnd: function (x, y, touchId) {
      var touch = this.activeTouches.get(touchId);
      if (!touch) return;
      // 连升/刷新后，旧卡片上尚未松开的第二根手指不能选择新卡。
      if (touch.state === CONFIG.GAME.STATE_LEVELUP && touch.offerRevision !== root.ExpLevelUp.offerRevision) {
        root.ButtonUI.pressedTouches.delete(touchId);
        this.activeTouches.delete(touchId);
        return;
      }
      if (touch.type === 'joystick' && this.joystick.pointerId === touchId) this.stopJoystick();
      if (touch.type === 'bombAim') {
        root.PowerUps.endBombAim(touchId, x, y, Date.now() - touch.startTime, Math.hypot(x - touch.startX, y - touch.startY));
        this.activeTouches.delete(touchId); return;
      }
      if (touch.type === 'button') {
        root.ButtonUI.pressedTouches.delete(touchId);
        if (touch.action !== 'dash' && touch.state === root.Game.state && touch.button && root.UI.isPointInRect({
          x: x,
          y: y
        }, touch.button.x, touch.button.y, touch.button.w, touch.button.h)) {
          root.ButtonUI.lastClick = typeof performance !== 'undefined' ? performance.now() : Date.now();
          root.AudioFX.play('button');
          this.pendingTap.active = true;
          this.pendingTap.x = x;
          this.pendingTap.y = y;
        }
      } else if (touch.type === null) {
        this.pendingTap.active = true;
        this.pendingTap.x = x;
        this.pendingTap.y = y;
      }
      this.activeTouches.delete(touchId);
    },
    canStartJoystick: function (point) {
      for (var i = 0; i < root.ButtonUI.count; i++) {
        var b = root.ButtonUI.pool[i];
        if (root.UI.isPointInRect(point, b.x, b.y, b.w, b.h)) return false;
      }
      var ratio = CONFIG.INPUT.JOYSTICK_ZONE_X_RATIO;
      var inLeftZone = root.Settings && root.Settings.mirror ? point.x >= CONFIG.VIEW.WIDTH * (1 - ratio) : point.x <= CONFIG.VIEW.WIDTH * ratio;
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
      var x = 0,
        y = 0;
      if (this.keys.KeyA || this.keys.ArrowLeft) x -= 1;
      if (this.keys.KeyD || this.keys.ArrowRight) x += 1;
      if (this.keys.KeyW || this.keys.ArrowUp) y -= 1;
      if (this.keys.KeyS || this.keys.ArrowDown) y += 1;
      if (this.joystick.active) {
        x += this.joystick.moveX;
        y += this.joystick.moveY;
      }
      var length = Math.hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }
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
        this.pendingTap.active = true;
        this.pendingTap.x = x;
        this.pendingTap.y = y;
        return;
      }
      // 最多缓存 6 个并发按钮触点，防止异常触摸事件无界增长。
      if (this.tapQueueX.length < 6) {
        this.tapQueueX.push(x);
        this.tapQueueY.push(y);
      }
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
      this.tapQueueX.length = 0;
      this.tapQueueY.length = 0;
      this.pendingTap.active = false;
      this.stopJoystick();
      this._activeTouchId = -1;
      root.ButtonUI.pressed.active = false;
      root.ButtonUI.pressedTouches.clear();
      this.activeTouches.clear();
      root.ButtonUI.hover.x = -1;
      root.ButtonUI.hover.y = -1;
    },
    onTouchCancel: function (x, y, touchId) {
      var touch = this.activeTouches.get(touchId);
      if (!touch) return;
      if (touch.type === 'joystick' && this.joystick.pointerId === touchId) this.stopJoystick();
      root.ButtonUI.pressedTouches.delete(touchId);
      this.activeTouches.delete(touchId);
    },
    // 按 identifier 区分摇杆和按钮触点。
    activeTouches: new Map()
  };
  root.Input = Input;
  root.G.input = Input;
})();

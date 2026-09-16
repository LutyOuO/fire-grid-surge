'use strict';
// ============================================================
// Platform（平台适配层）
// 统一微信小游戏与浏览器 H5 的 API 差异：
//   - 画布创建与 2D 上下文
//   - 屏幕尺寸 / DPR / 安全区
//   - 触摸事件（含逻辑坐标换算）
//   - 本地存储
//   - 前后台生命周期
//   - 激励视频广告
//   - 音频上下文
// ============================================================
var root = (typeof window !== 'undefined') ? window : global;

var Platform = {
  isWx: false,
  canvas: null,
  ctx: null,
  sysInfo: null,
  _logicalW: 750,
  _logicalH: 1334,
  _scale: 1,
  _offsetX: 0,
  _offsetY: 0,
  _touchHandlers: { start: [], move: [], end: [], cancel: [] },
  _showHandlers: [],
  _hideHandlers: [],
  _keyDownHandlers: [],
  _keyUpHandlers: [],

  // ---------- 初始化 ----------
  init: function () {
    this.isWx = (typeof wx !== 'undefined') && wx &&
      (typeof wx.createCanvas === 'function');
    this.sysInfo = this.getSystemInfo();
    this._calcLayout();
    this.initCanvas();
    this.bindTouchEvents();
    this.bindLifecycleEvents();
    this.bindKeyboardEvents();
  },

  // ---------- 系统信息 ----------
  getSystemInfo: function () {
    if (this.isWx) {
      // 微信桥接可能未就绪，加 try-catch 兜底
      var info = null;
      try {
        info = wx.getSystemInfoSync();
      } catch (e) {
        info = null;
      }
      if (!info) {
        // 兜底：iPhone X 竖屏默认值，等 onShow 时会重新获取真实值
        return {
          windowWidth: 375, windowHeight: 812, pixelRatio: 2,
          safeArea: { top: 44, bottom: 812, left: 0, right: 375, width: 375, height: 778 },
          statusBarHeight: 44, platform: 'devtools', model: ''
        };
      }
      return {
        windowWidth: info.windowWidth,
        windowHeight: info.windowHeight,
        pixelRatio: info.pixelRatio || 2,
        safeArea: info.safeArea || {
          top: 0, bottom: info.windowHeight, left: 0, right: info.windowWidth,
          width: info.windowWidth, height: info.windowHeight
        },
        statusBarHeight: info.statusBarHeight || 0,
        platform: info.platform || 'devtools',
        model: info.model || ''
      };
    }
    return {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      safeArea: {
        top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth,
        width: window.innerWidth, height: window.innerHeight
      },
      statusBarHeight: 0,
      platform: 'h5',
      model: ''
    };
  },

  // 计算逻辑分辨率到屏幕的等比缩放与居中偏移
  // 宽度固定 750，高度按设备长宽比动态计算（1100~1700），消除黑边
  _calcLayout: function () {
    var w = this.sysInfo.windowWidth;
    var h = this.sysInfo.windowHeight;
    // 动态逻辑高度：750 * (屏幕高/屏幕宽)，限制在合理范围
    this._logicalH = Math.max(1100, Math.min(1700, Math.round(750 * h / w)));
    // 同步更新全局 CONFIG.VIEW.HEIGHT，供所有 UI 模块使用
    if (root.CONFIG) {
      root.CONFIG.VIEW.HEIGHT = this._logicalH;
    }
    // 先算缩放比，安全区换算和 relayout 都需要
    this._scale = Math.min(w / this._logicalW, h / this._logicalH);
    this._offsetX = (w - this._logicalW * this._scale) / 2;
    this._offsetY = (h - this._logicalH * this._scale) / 2;
    // 安全区偏移（CSS 像素 → 游戏逻辑像素），用于避开刘海/灵动岛/底部横条
    var safeTopCss = (this.sysInfo.safeArea && this.sysInfo.safeArea.top) || 0;
    var safeBottomCss = h - ((this.sysInfo.safeArea && this.sysInfo.safeArea.bottom) || h);
    this.safeTop = safeTopCss / this._scale;
    this.safeBottom = safeBottomCss / this._scale;
    // 重新计算所有锚定的 UI 坐标（含安全区）
    if (root.UI && typeof root.UI.relayout === 'function') {
      root.UI.relayout();
    }
  },

  // ---------- 画布 ----------
  initCanvas: function () {
    if (this.isWx) {
      // 微信小游戏：createCanvas 返回主画布，自动全屏显示
      this.canvas = wx.createCanvas();
      this.ctx = this.canvas.getContext('2d');
      // 画布缓冲设为屏幕物理像素，保证清晰
      var dpr = this.sysInfo.pixelRatio;
      this.canvas.width = Math.round(this.sysInfo.windowWidth * dpr);
      this.canvas.height = Math.round(this.sysInfo.windowHeight * dpr);
      // 先缩放到 CSS 像素，再做等比缩放+偏移，使游戏绘制始终在 750×1334 逻辑坐标中
      this.ctx.scale(dpr, dpr);
    } else {
      // 浏览器 H5
      this.canvas = document.getElementById('gameCanvas');
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.canvas.width = this._logicalW;
      this.canvas.height = this._logicalH;
      document.body.style.backgroundColor = '#050807';
      this._resizeH5();
      var self = this;
      window.addEventListener('resize', function () { self._resizeH5(); });
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', function () { self._resizeH5(); });
      }
    }
  },

  _resizeH5: function () {
    this.sysInfo = this.getSystemInfo();
    this._calcLayout();
    this.canvas.width = this._logicalW;
    this.canvas.height = this._logicalH;
    var scale = this._scale;
    this.canvas.style.width = this._logicalW * scale + 'px';
    this.canvas.style.height = this._logicalH * scale + 'px';
  },

  // 每帧开始：清屏（含刘海/黑边区域），应用游戏区域变换
  beginFrame: function () {
    var ctx = this.ctx;
    if (this.isWx) {
      ctx.save();
      // 回到 identity 清全屏
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#050807';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      // 恢复 dpr 缩放 + 游戏等比变换
      var dpr = this.sysInfo.pixelRatio;
      ctx.scale(dpr, dpr);
      ctx.translate(this._offsetX, this._offsetY);
      ctx.scale(this._scale, this._scale);
    }
  },

  endFrame: function () {
    if (this.isWx) {
      this.ctx.restore();
    }
  },

  // ---------- 坐标换算 ----------
  // 屏幕 CSS 像素 → 游戏逻辑像素（750×1334）
  screenToCanvas: function (screenX, screenY) {
    if (!this.isWx) {
      // H5：canvas 元素 getBoundingClientRect
      var rect = this.canvas.getBoundingClientRect();
      return {
        x: (screenX - rect.left) * this._logicalW / rect.width,
        y: (screenY - rect.top) * this._logicalH / rect.height
      };
    }
    return {
      x: (screenX - this._offsetX) / this._scale,
      y: (screenY - this._offsetY) / this._scale
    };
  },

  // ---------- 触摸事件 ----------
  bindTouchEvents: function () {
    var self = this;
    if (this.isWx) {
      // 微信会在同一个事件中携带多个触点，必须逐个按 identifier 分发。
      function emitTouches(type, event, preferChanged) {
        if (event && event.preventDefault) event.preventDefault();
        var list = (preferChanged ? event.changedTouches : event.touches) || event.changedTouches || [];
        for (var i = 0; i < list.length; i++) {
          var t = list[i];
          var sx = t.clientX != null ? t.clientX : (t.pageX != null ? t.pageX : t.x);
          var sy = t.clientY != null ? t.clientY : (t.pageY != null ? t.pageY : t.y);
          var pt = self.screenToCanvas(sx, sy);
          self._emit(type, pt.x, pt.y, event, t.identifier != null ? t.identifier : i);
        }
      }
      wx.onTouchStart(function (e) {
        emitTouches('start', e, true);
      });
      wx.onTouchMove(function (e) {
        emitTouches('move', e, false);
      });
      wx.onTouchEnd(function (e) {
        emitTouches('end', e, true);
      });
      wx.onTouchCancel(function (e) {
        emitTouches('cancel', e, true);
      });
    } else {
      // H5：pointer 事件统一鼠标和触摸
      this.canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var pt = self.screenToCanvas(e.clientX, e.clientY);
        self._emit('start', pt.x, pt.y, e, e.pointerId);
      });
      this.canvas.addEventListener('pointermove', function (e) {
        var pt = self.screenToCanvas(e.clientX, e.clientY);
        self._emit('move', pt.x, pt.y, e, e.pointerId);
      });
      this.canvas.addEventListener('pointerup', function (e) {
        e.preventDefault();
        var pt = self.screenToCanvas(e.clientX, e.clientY);
        self._emit('end', pt.x, pt.y, e, e.pointerId);
      });
      this.canvas.addEventListener('pointercancel', function (e) {
        var pt = self.screenToCanvas(e.clientX, e.clientY);
        self._emit('cancel', pt.x, pt.y, e, e.pointerId);
      });
      this.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
  },

  onTouchStart: function (cb) { this._touchHandlers.start.push(cb); },
  onTouchMove: function (cb) { this._touchHandlers.move.push(cb); },
  onTouchEnd: function (cb) { this._touchHandlers.end.push(cb); },
  onTouchCancel: function (cb) { this._touchHandlers.cancel.push(cb); },

  _emit: function (type, x, y, rawEvent, pointerId) {
    var handlers = this._touchHandlers[type];
    for (var i = 0; i < handlers.length; i++) {
      handlers[i](x, y, rawEvent, pointerId);
    }
  },

  // ---------- 键盘事件（H5/开发者工具） ----------
  bindKeyboardEvents: function () {
    if (this.isWx) return; // 微信真机无键盘
    var self = this;
    window.addEventListener('keydown', function (e) {
      for (var i = 0; i < self._keyDownHandlers.length; i++) {
        self._keyDownHandlers[i](e);
      }
    });
    window.addEventListener('keyup', function (e) {
      for (var i = 0; i < self._keyUpHandlers.length; i++) {
        self._keyUpHandlers[i](e);
      }
    });
    window.addEventListener('blur', function () {
      // 失焦时触发一次 hide
      for (var i = 0; i < self._hideHandlers.length; i++) {
        self._hideHandlers[i]();
      }
    });
  },

  onKeyDown: function (cb) { this._keyDownHandlers.push(cb); },
  onKeyUp: function (cb) { this._keyUpHandlers.push(cb); },

  // ---------- 前后台生命周期 ----------
  onShow: function (cb) { this._showHandlers.push(cb); },
  onHide: function (cb) { this._hideHandlers.push(cb); },

  bindLifecycleEvents: function () {
    var self = this;
    if (this.isWx) {
      wx.onShow(function () {
        self.sysInfo = self.getSystemInfo();
        self._calcLayout();
        for (var i = 0; i < self._showHandlers.length; i++) {
          self._showHandlers[i]();
        }
      });
      wx.onHide(function () {
        for (var i = 0; i < self._hideHandlers.length; i++) {
          self._hideHandlers[i]();
        }
      });
    } else {
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          for (var i = 0; i < self._hideHandlers.length; i++) {
            self._hideHandlers[i]();
          }
        } else {
          self.sysInfo = self.getSystemInfo();
          self._calcLayout();
          for (var i = 0; i < self._showHandlers.length; i++) {
            self._showHandlers[i]();
          }
        }
      });
      window.addEventListener('pagehide', function () {
        for (var i = 0; i < self._hideHandlers.length; i++) {
          self._hideHandlers[i]();
        }
      });
    }
  },

  // ---------- 存储 ----------
  getStorage: function (key) {
    if (this.isWx) {
      try { return wx.getStorageSync(key); } catch (e) { return null; }
    }
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },

  setStorage: function (key, value) {
    if (this.isWx) {
      try { wx.setStorageSync(key, value); } catch (e) {}
    } else {
      try { localStorage.setItem(key, value); } catch (e) {}
    }
  },

  // ---------- 广告 ----------
  createRewardedVideoAd: function (adUnitId) {
    if (this.isWx && typeof wx.createRewardedVideoAd === 'function') {
      return wx.createRewardedVideoAd({ adUnitId: adUnitId });
    }
    return null;
  },

  // ---------- 音频 ----------
  createAudioContext: function () {
    if (this.isWx) {
      // 微信小游戏较新版本支持 WebAudio
      if (typeof wx.createWebAudioContext === 'function') {
        try { return wx.createWebAudioContext(); } catch (e) { return null; }
      }
      return null;
    }
    var Ctor = window.AudioContext || window.webkitAudioContext;
    return Ctor ? new Ctor() : null;
  },

  // ---------- 安全区辅助 ----------
  getSafeAreaTop: function () {
    return this.sysInfo.safeArea.top || 0;
  },
  getSafeAreaBottom: function () {
    return this.sysInfo.windowHeight - (this.sysInfo.safeArea.bottom || this.sysInfo.windowHeight);
  }
};

root.Platform = Platform;

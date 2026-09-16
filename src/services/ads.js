(function () {
  'use strict';

  // ============================================================
  // Ads（广告模块）
  // 微信小游戏：真实激励视频 wx.createRewardedVideoAd
  //   - 处理 onLoad / onError / onClose(isEnded)
  //   - 看完才发奖（isEnded === true）
  //   - 兼容"广告未加载好时先 load 再 show"
  // H5：模拟播放 1.5 秒（方便浏览器调玩法）
  // ============================================================
  var root = typeof window !== 'undefined' ? window : global;
  var CONFIG = root.CONFIG;
  var Platform = root.Platform;
  var Input = root.Input;
  var Ads = {
    active: false,
    placement: '',
    successCallback: null,
    failCallback: null,
    timerId: 0,
    startedAt: 0,
    _wxAd: null,
    // 微信激励视频广告实例
    _wxLoaded: false,
    // 微信广告是否已加载
    _wxLoading: false,
    // 是否正在 load

    // ---------- 统一入口 ----------
    showRewarded: function (placement, onSuccess, onFail) {
      if (this.active) {
        if (typeof onFail === 'function') onFail('busy');
        return false;
      }
      if (Platform.isWx) {
        return this._showWxAd(placement, onSuccess, onFail);
      }

      // H5 模拟
      this.active = true;
      this.placement = placement;
      this.successCallback = typeof onSuccess === 'function' ? onSuccess : null;
      this.failCallback = typeof onFail === 'function' ? onFail : null;
      this.startedAt = Date.now();
      var self = this;
      this.timerId = setTimeout(function () {
        self.finishSuccess();
      }, CONFIG.ADS.H5_DURATION_MS);
      Input.clearTap();
      return true;
    },
    // ---------- 微信激励视频 ----------
    _showWxAd: function (placement, onSuccess, onFail) {
      var self = this;

      // 懒创建广告实例（全局单例）
      if (!this._wxAd) {
        this._wxAd = Platform.createRewardedVideoAd(CONFIG.ADS.AD_UNIT_ID);
        if (!this._wxAd) {
          if (typeof onFail === 'function') onFail('wx_not_ready');
          return false;
        }

        // 广告加载成功
        this._wxAd.onLoad(function () {
          self._wxLoaded = true;
          self._wxLoading = false;
        });

        // 广告加载失败
        this._wxAd.onError(function (err) {
          self._wxLoading = false;
          self._wxLoaded = false;
          // 如果正在等待 show（有回调挂起），通知失败
          if (self._pendingShow) {
            var pending = self._pendingShow;
            self._pendingShow = null;
            self.active = false;
            if (typeof pending.onFail === 'function') {
              pending.onFail('ad_load_error');
            }
          }
        });

        // 广告关闭
        this._wxAd.onClose(function (res) {
          // res.isEnded === true 表示完整观看
          var isEnded = res && res.isEnded === true;
          if (self._pendingShow) {
            var pending = self._pendingShow;
            self._pendingShow = null;
            self.active = false;
            self._wxLoaded = false; // 看完后需要重新 load 下一次
            if (isEnded) {
              if (typeof pending.onSuccess === 'function') pending.onSuccess();
            } else {
              if (typeof pending.onFail === 'function') pending.onFail('not_finished');
            }
          }
        });
      }

      // 标记活跃，防止重复点击
      this.active = true;
      this.placement = placement;
      this._pendingShow = {
        onSuccess: onSuccess,
        onFail: onFail
      };
      Input.clearTap();

      // 如果广告已加载，直接 show
      if (this._wxLoaded && !this._wxLoading) {
        this._wxAd.show().catch(function (err) {
          // show 失败（可能广告已过期），尝试重新 load 再 show
          self._wxLoaded = false;
          self._loadAndShow();
        });
      } else {
        // 广告未加载好：先 load，加载成功后自动 show
        this._loadAndShow();
      }
      return true;
    },
    // 先 load 再 show 的兼容逻辑
    _loadAndShow: function () {
      if (this._wxLoading) return;
      this._wxLoading = true;
      var self = this;
      this._wxAd.load().then(function () {
        self._wxLoaded = true;
        self._wxLoading = false;
        // 加载成功后立即 show
        if (self._pendingShow) {
          self._wxAd.show().catch(function (err) {
            // show 仍失败，通知失败
            if (self._pendingShow) {
              var pending = self._pendingShow;
              self._pendingShow = null;
              self.active = false;
              if (typeof pending.onFail === 'function') pending.onFail('show_error');
            }
          });
        }
      }).catch(function (err) {
        self._wxLoading = false;
        self._wxLoaded = false;
        if (self._pendingShow) {
          var pending = self._pendingShow;
          self._pendingShow = null;
          self.active = false;
          if (typeof pending.onFail === 'function') pending.onFail('load_error');
        }
      });
    },
    // ---------- H5 模拟 ----------
    finishSuccess: function () {
      if (!this.active) return;
      var callback = this.successCallback;
      this.clearState();
      if (callback) callback();
    },
    clearState: function () {
      this.active = false;
      this.placement = '';
      this.successCallback = null;
      this.failCallback = null;
      this.timerId = 0;
      this.startedAt = 0;
      this._pendingShow = null;
      Input.clearTap();
    },
    cancel: function () {
      if (!this.active) return;
      if (this.timerId) {
        clearTimeout(this.timerId);
        this.timerId = 0;
      }
      this.clearState(); // 未完整观看不发奖，不扣次数
    },
    getProgress: function () {
      if (!this.active) return 0;
      return Math.max(0, Math.min(1, (Date.now() - this.startedAt) / CONFIG.ADS.H5_DURATION_MS));
    },
    // H5 模拟广告播放面板绘制（微信下广告由原生组件展示，不需要绘制）
    draw: function (ctx) {
      if (!this.active || Platform.isWx) return;
      ctx.save();
      ctx.fillStyle = CONFIG.COLORS.AD_OVERLAY;
      ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
      var x = CONFIG.UI.AD_PANEL_X,
        y = CONFIG.UI.AD_PANEL_Y;
      var width = CONFIG.UI.AD_PANEL_WIDTH,
        height = CONFIG.UI.AD_PANEL_HEIGHT;
      UI.roundedRectPath(ctx, x, y, width, height, 30);
      ctx.fillStyle = CONFIG.COLORS.AD_PANEL;
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = CONFIG.COLORS.AD_PANEL_BORDER;
      ctx.stroke();
      UI.drawCenteredText(ctx, CONFIG.TEXT.AD_PLAYING, y + 80, 45, true, CONFIG.COLORS.COIN);
      UI.drawCenteredText(ctx, CONFIG.TEXT.AD_WAIT, y + 145, 21, false, CONFIG.COLORS.TEXT);
      UI.drawCenteredText(ctx, CONFIG.TEXT.AD_H5_HINT, y + 185, 18, false, CONFIG.COLORS.HINT_TEXT);
      var barX = x + 55,
        barY = y + 235,
        barWidth = width - 110;
      UI.drawBarBackground(ctx, barX, barY, barWidth, 24, 12, CONFIG.COLORS.HP_BACKGROUND);
      UI.drawBarFill(ctx, barX, barY, barWidth, 24, this.getProgress(), 12, CONFIG.COLORS.AD_PANEL_BORDER);
      ctx.restore();
    }
  };
  root.Ads = Ads;
})();

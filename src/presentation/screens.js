// 主菜单、结算、升级与基地基础页面。
(function () {
    // ============================================================
    // 界面与内容：#31～#34 UI轨道重构。仅调整界面与交互，不改战斗数值。
    // ============================================================
    var root = typeof window !== 'undefined' ? window : global;
    var CONFIG = root.CONFIG,
      Game = root.Game,
      UI = root.UI,
      Input = root.Input,
      Meta = root.Meta;
    var Player = root.Player,
      Enemy = root.Enemy,
      ExpLevelUp = root.ExpLevelUp,
      RunStats = root.RunStats;
    var PowerUps = root.PowerUps,
      Ads = root.Ads,
      Achievements = root.Achievements,
      Wardrobe = root.Wardrobe;
    var Platform = root.Platform,
      CanvasView = root.CanvasView,
      ButtonUI = root.ButtonUI;
    function inside(p, x, y, w, h) {
      return p && UI.isPointInRect(p, x, y, w, h);
    }
    function peek() {
      return Input.pendingTap.active ? {
        x: Input.pendingTap.x,
        y: Input.pendingTap.y
      } : null;
    }
    function label(ctx, s, x, y, size, color, align, bold) {
      ctx.save();
      ctx.font = (bold ? 'bold ' : '') + size + 'px Arial,"Microsoft YaHei"';
      ctx.textAlign = align || 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color || CONFIG.COLORS.TEXT;
      ctx.shadowColor = 'rgba(0,0,0,.65)';
      ctx.shadowBlur = 4;
      ctx.fillText(s, x, y);
      ctx.restore();
    }
    function box(ctx, x, y, w, h, r, fill, stroke) {
      UI.roundedRectPath(ctx, x, y, w, h, r);
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
    }
    function drawCoin(ctx, x, y, s) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#ffd447';
      ctx.strokeStyle = '#9a6510';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9a6510';
      ctx.fillRect(-2, -s * .55, 4, s * 1.1);
      ctx.restore();
    }
    function drawDiamond(ctx, x, y, s) {
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = '#3498DB';
      ctx.shadowBlur = 5;
      ctx.fillStyle = '#3498DB';
      ctx.strokeStyle = '#2980B9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * .72, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * .72, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    function trophy(ctx, x, y, s, col) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = col || '#ffd166';
      ctx.fillRect(-s * .38, -s * .45, s * .76, s * .58);
      ctx.fillRect(-s * .1, s * .1, s * .2, s * .32);
      ctx.fillRect(-s * .38, s * .4, s * .76, s * .14);
      ctx.lineWidth = s * .12;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath();
      ctx.arc(-s * .43, -s * .18, s * .28, Math.PI * .5, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s * .43, -s * .18, s * .28, -Math.PI * .5, Math.PI * .5);
      ctx.stroke();
      ctx.restore();
    }
    function layoutMenu() {
      var c = CONFIG.SCREEN_LAYOUT.MENU,
        h = CONFIG.VIEW.HEIGHT,
        b = CONFIG.UI.BOTTOM_INSET || 0;
      if (h < 1200) {
        c.LOGO_H = 270;
        c.HISTORY_Y = 350;
        c.BUFF_Y = 378;
        c.BUTTON_Y = 400;
        c.BUTTON_W = 540;
        c.BUTTON_H = 78;
        c.SPEEDUP_H = 96;
        c.GAP = 12;
        CONFIG.POLISH.MENU_TOOL_Y = h - b - 220;
        CONFIG.UI.MENU_BUTTON_X = 105;
        CONFIG.UI.MENU_BUTTON_WIDTH = 540;
        CONFIG.UI.MENU_BUTTON_HEIGHT = 78;
      } else {
        c.LOGO_H = 340;
        c.HISTORY_Y = 430;
        c.BUFF_Y = 462;
        c.BUTTON_Y = 490;
        c.BUTTON_W = 560;
        c.BUTTON_H = 96;
        c.SPEEDUP_H = 112;
        c.GAP = 20;
        CONFIG.POLISH.MENU_TOOL_Y = 1100;
        CONFIG.UI.MENU_BUTTON_X = 145;
        CONFIG.UI.MENU_BUTTON_WIDTH = 460;
        CONFIG.UI.MENU_BUTTON_HEIGHT = 92;
      }
    }

    // ---------- 主菜单本地 Logo ----------
    // 微信小游戏和 H5 使用不同的相对路径；图片失败时保留文字标题兜底。
    var MenuLogo = {
      image: null,
      ready: false,
      failed: false,
      loading: false,
      ensure: function () {
        if (this.ready || this.failed || this.loading || !Platform.canvas) return;
        var img = null;
        try {
          if (Platform.canvas.createImage) img = Platform.canvas.createImage();else if (typeof Image !== 'undefined') img = new Image();else if (Platform.isWx && typeof wx !== 'undefined' && wx.createImage) img = wx.createImage();
        } catch (e) {
          img = null;
        }
        if (!img) {
          this.failed = true;
          return;
        }
        this.loading = true;
        this.image = img;
        var self = this;
        img.onload = function () {
          self.ready = true;
          self.loading = false;
        };
        img.onerror = function () {
          self.failed = true;
          self.loading = false;
          if (typeof console !== 'undefined' && console.warn) console.warn('[MENU LOGO] 图片加载失败');
        };
        img.src = Platform.isWx ? 'assets/logo/game_logo.png' : '../assets/logo/game_logo.png';
      },
      draw: function (ctx, c, top) {
        this.ensure();
        if (!this.ready || !this.image) return false;
        var iw = this.image.width || 1240,
          ih = this.image.height || 1240,
          sourceH = Math.max(1, Math.floor(ih * .86));
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.drawImage(this.image, 0, 0, iw, sourceH, c.LOGO_X, c.LOGO_Y + top, c.LOGO_W, c.LOGO_H);
        ctx.restore();
        return true;
      }
    };

    // ---------- #31/#32 主菜单独立分区 ----------
    UI.drawMenu = function (ctx) {
      layoutMenu();
      var c = CONFIG.SCREEN_LAYOUT.MENU,
        top = CONFIG.UI.TOP_INSET || 0;
      ctx.fillStyle = CONFIG.COLORS.MENU_BACKGROUND;
      ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
      UI.drawMenuGlow(ctx);
      // 货币胶囊：金币和钻石只占右上同一行。
      box(ctx, c.CURRENCY_X, c.CURRENCY_Y + top, c.CURRENCY_W, c.CURRENCY_H, 25, 'rgba(7,17,20,.88)', '#456258');
      drawCoin(ctx, c.CURRENCY_X + 28, c.CURRENCY_Y + top + 25, 10);
      label(ctx, String(Meta.data.coins), c.CURRENCY_X + 47, c.CURRENCY_Y + top + 25, 18, '#ffe27a', 'left', true);
      label(ctx, '|', c.CURRENCY_X + 150, c.CURRENCY_Y + top + 25, 19, '#667b72', 'center');
      drawDiamond(ctx, c.CURRENCY_X + 177, c.CURRENCY_Y + top + 25, 10);
      label(ctx, String(Meta.data.diamonds || 0), c.CURRENCY_X + 196, c.CURRENCY_Y + top + 25, 18, '#83d7ff', 'left', true);
      // Logo 完成加载前显示文字标题，避免弱网或首帧出现空白。
      if (!MenuLogo.draw(ctx, c, top)) UI.drawCenteredText(ctx, CONFIG.TEXT.GAME_TITLE, 220 + top, 66, true, CONFIG.COLORS.TEXT);
      UI.drawCenteredText(ctx, CONFIG.TEXT.HISTORY(Meta.data.bestWave, UI.formatTime(Meta.data.bestTime), Meta.data.bestKills), c.HISTORY_Y + top, 21, false, CONFIG.COLORS.HINT_TEXT);
      if (Meta.data.nextRunBuff) UI.drawCenteredText(ctx, '下一局增益：' + Meta.data.nextRunBuff.name, c.BUFF_Y + top, 20, true, Meta.data.nextRunBuff.rarity === 'LEGENDARY' ? '#ffd54a' : Meta.data.nextRunBuff.rarity === 'EPIC' ? '#E67E22' : Meta.data.nextRunBuff.rarity === 'RARE' ? '#3498DB' : '#95A5A6');
      var ready = Meta.isSpeedupReady(),
        rewardValue = Number(Meta.getSpeedupReward()),
        reward = isFinite(rewardValue) ? CONFIG.TEXT.SPEEDUP_REWARD(CONFIG.META.SPEEDUP_MINUTES, rewardValue) : '观看广告领取120分钟产出',
        cool = CONFIG.TEXT.SPEEDUP_COOLDOWN(UI.formatDuration(Meta.getSpeedupRemainingMs()));
      drawMenuButton(ctx, 0, CONFIG.TEXT.START_GAME, '');
      drawMenuButton(ctx, 1, CONFIG.TEXT.OPEN_BASE, '');
      drawMenuButton(ctx, 2, '成就', Meta.data.achievements.completed.length + '/29', true);
      drawMenuButton(ctx, 3, CONFIG.TEXT.SPEEDUP, ready ? reward : cool, ready);
      UI.drawCenteredText(ctx, CONFIG.TEXT.SPEEDUP_TODO, CONFIG.VIEW.HEIGHT - (CONFIG.UI.BOTTOM_INSET || 0) - 75, 18, false, CONFIG.COLORS.HINT_TEXT);
      if (Meta.offlinePopupActive) UI.drawOfflinePopup(ctx);
      UI.drawToast(ctx);
      if (root.DevConsole) root.DevConsole.draw(ctx);
    };
    function menuButtonY(i) {
      var c = CONFIG.SCREEN_LAYOUT.MENU;
      return c.BUTTON_Y + (CONFIG.UI.TOP_INSET || 0) + i * (c.BUTTON_H + c.GAP);
    }
    function drawMenuButton(ctx, i, title, sub, enabled) {
      var c = CONFIG.SCREEN_LAYOUT.MENU,
        x = (750 - c.BUTTON_W) / 2,
        y = menuButtonY(i),
        h = i === 3 ? c.SPEEDUP_H : c.BUTTON_H;
      if (i === 3) {
        UI.drawActionButton(ctx, x, y, c.BUTTON_W, h, '', enabled !== false, 1);
        label(ctx, title, 375, y + 39, 20, enabled === false ? '#82958b' : '#243027', 'center', true);
        var safeSub = typeof sub === 'string' && sub ? sub : '观看广告领取120分钟产出';
        label(ctx, safeSub, 375, y + 76, safeSub.length > 25 ? 12 : 13, enabled === false ? '#82958b' : 'rgba(36,48,39,.85)', 'center', false);
        return;
      }
      UI.drawActionButton(ctx, x, y, c.BUTTON_W, h, title, enabled !== false, 30);
      if (i === 2) trophy(ctx, x + 45, y + h / 2, 18, '#3c2c12');
      if (sub) label(ctx, sub, x + c.BUTTON_W - 28, y + h / 2, 16, enabled === false ? '#82958b' : '#243027', 'right', true);
    }
    UI.consumeMenuAction = function () {
      layoutMenu();
      if (!Input.consumeTap(this.tapPoint)) return -1;
      var c = CONFIG.SCREEN_LAYOUT.MENU,
        x = (750 - c.BUTTON_W) / 2;
      if (this.tapPoint.x < x || this.tapPoint.x > x + c.BUTTON_W) return -1;
      for (var i = 0; i < 4; i++) {
        var y = menuButtonY(i),
          h = i === 3 ? c.SPEEDUP_H : c.BUTTON_H;
        if (this.tapPoint.y >= y && this.tapPoint.y <= y + h) return i;
      }
      return -1;
    };

    // ---------- #31 独立全屏成就页 ----------
    Achievements.categories = [['all', '全部'], ['battle', '战斗'], ['survive', '生存'], ['collect', '收集'], ['progress', '进度'], ['special', '特殊']];
    Achievements.category = 'all';
    Achievements.page = 0;
    Achievements.detail = -1;
    Achievements.categoryOf = function (index) {
      return index < 8 ? 'battle' : index < 13 ? 'survive' : index < 18 ? 'collect' : index < 24 ? 'progress' : 'special';
    };
    Achievements.filtered = function () {
      var out = [];
      for (var i = 0; i < this.defs.length; i++) if (this.category === 'all' || this.categoryOf(i) === this.category) out.push(i);
      return out;
    };
    Achievements.perPage = function () {
      return CONFIG.VIEW.HEIGHT < 1250 ? 6 : 7;
    };
    Achievements.drawPage = function (ctx) {
      var top = CONFIG.UI.TOP_INSET || 0;
      ctx.fillStyle = '#08110e';
      ctx.fillRect(0, 0, 750, CONFIG.VIEW.HEIGHT);
      UI.drawMenuGlow(ctx);
      UI.drawActionButton(ctx, 24, 34 + top, 132, 62, '返回', true, 22);
      trophy(ctx, 375, 92 + top, 26);
      UI.drawCenteredText(ctx, '成就', 142 + top, 46, true, '#f4d58d');
      UI.drawCenteredText(ctx, '已完成 ' + Meta.data.achievements.completed.length + ' / ' + CONFIG.CONTENT.ACHIEVEMENT_COUNT, 184 + top, 18, false, '#ffd54a');
      for (var i = 0; i < this.categories.length; i++) {
        var x = 18 + i * 120,
          y = 214 + top,
          w = 110;
        UI.drawActionButton(ctx, x, y, w, 48, this.categories[i][1], this.category === this.categories[i][0], 16);
      }
      var ids = this.filtered(),
        per = this.perPage(),
        max = Math.max(0, Math.ceil(ids.length / per) - 1);
      this.page = Math.min(this.page, max);
      var first = this.page * per;
      for (var r = 0; r < per; r++) {
        var idx = ids[first + r];
        if (idx === undefined) break;
        var d = this.defs[idx],
          y = 282 + top + r * 116,
          done = Meta.data.achievements.completed.indexOf(d[0]) >= 0,
          val = Math.min(d[4], Math.floor(Meta.data.achievements.progress[d[3]] || 0));
        box(ctx, 28, y, 694, 102, 14, done ? 'rgba(91,72,25,.68)' : 'rgba(18,32,27,.96)', done ? '#d6aa55' : '#456258');
        trophy(ctx, 70, y + 50, 18, done ? '#ffd54a' : '#6f8179');
        label(ctx, d[1], 108, y + 28, 21, done ? '#ffe49a' : '#f4fff7', 'left', true);
        label(ctx, d[2], 108, y + 57, 15, '#b4c2bc');
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.fillRect(108, y + 80, 430, 7);
        ctx.fillStyle = done ? '#59e58a' : '#3498DB';
        ctx.fillRect(108, y + 80, 430 * Math.min(1, val / d[4]), 7);
        label(ctx, done ? '已完成' : val + '/' + d[4], 680, y + 50, 16, done ? '#59e58a' : '#c5d1cb', 'right', true);
      }
      var py = CONFIG.VIEW.HEIGHT - (CONFIG.UI.BOTTOM_INSET || 0) - 62;
      UI.drawActionButton(ctx, 210, py, 120, 46, '上一页', this.page > 0, 16);
      label(ctx, this.page + 1 + ' / ' + (max + 1), 375, py + 23, 16, '#b8c5bf', 'center');
      UI.drawActionButton(ctx, 420, py, 120, 46, '下一页', this.page < max, 16);
      if (this.detail >= 0) this.drawDetail(ctx, this.detail);
    };
    Achievements.drawDetail = function (ctx, idx) {
      var d = this.defs[idx],
        done = Meta.data.achievements.completed.indexOf(d[0]) >= 0,
        val = Math.min(d[4], Math.floor(Meta.data.achievements.progress[d[3]] || 0));
      ctx.fillStyle = 'rgba(0,0,0,.76)';
      ctx.fillRect(0, 0, 750, CONFIG.VIEW.HEIGHT);
      box(ctx, 90, 390, 570, 430, 24, '#14231e', '#d6aa55');
      trophy(ctx, 375, 475, 42, done ? '#ffd54a' : '#71837b');
      label(ctx, d[1], 375, 560, 31, '#ffe49a', 'center', true);
      label(ctx, d[2], 375, 615, 19, '#d1ddd7', 'center');
      label(ctx, '进度 ' + val + ' / ' + d[4], 375, 665, 18, done ? '#59e58a' : '#83d7ff', 'center', true);
      UI.drawActionButton(ctx, 210, 725, 330, 62, '关闭', true, 21);
    };
    Achievements.handlePage = function () {
      var p = peek();
      if (!p) return;
      var top = CONFIG.UI.TOP_INSET || 0;
      if (this.detail >= 0) {
        Input.clearTap();
        this.detail = -1;
        return;
      }
      if (inside(p, 24, 34 + top, 132, 62)) {
        Input.clearTap();
        Game.enterMenu();
        return;
      }
      for (var i = 0; i < this.categories.length; i++) if (inside(p, 18 + i * 120, 214 + top, 110, 48)) {
        Input.clearTap();
        this.category = this.categories[i][0];
        this.page = 0;
        return;
      }
      var ids = this.filtered(),
        per = this.perPage(),
        first = this.page * per;
      for (var r = 0; r < per; r++) if (ids[first + r] !== undefined && inside(p, 28, 282 + top + r * 116, 694, 102)) {
        Input.clearTap();
        this.detail = ids[first + r];
        return;
      }
      var py = CONFIG.VIEW.HEIGHT - (CONFIG.UI.BOTTOM_INSET || 0) - 62;
      if (inside(p, 210, py, 120, 46)) {
        Input.clearTap();
        this.page = Math.max(0, this.page - 1);
        return;
      }
      if (inside(p, 420, py, 120, 46)) {
        Input.clearTap();
        this.page = Math.min(Math.max(0, Math.ceil(ids.length / per) - 1), this.page + 1);
      }
    };

    // ---------- #33 外观仓库统一2列网格 ----------
    Wardrobe.mode = 'outfit';
    Wardrobe.weapon = 'pulse';
    Wardrobe.filters = {
      currency: 'all',
      rarity: 'all',
      status: 'all'
    };
    Wardrobe.scroll = {
      outfit: 0,
      skin: 0
    };
    Wardrobe.drag = {
      active: false,
      id: -1,
      y: 0,
      startY: 0,
      moved: false
    };
    Wardrobe.toast = '';
    Wardrobe.toastTime = 0;
    Wardrobe.rarity = function (d) {
      if (this.mode === 'outfit') return d[2];
      var id = d[0];
      if (id === 'default') return 'COMMON';
      if (id.indexOf('gold') >= 0 || id.indexOf('holy') >= 0 || id.indexOf('void') >= 0) return 'LEGENDARY';
      if (id.indexOf('blue') >= 0 || id.indexOf('thunder') >= 0 || id.indexOf('hell') >= 0 || id.indexOf('machine') >= 0) return 'EPIC';
      return 'RARE';
    };
    Wardrobe.isOwned = function (d) {
      return this.mode === 'outfit' ? Meta.data.ownedOutfits.indexOf(d[0]) >= 0 : Meta.data.ownedSkins[d[2]].indexOf(d[0]) >= 0;
    };
    Wardrobe.isEquipped = function (d) {
      return this.mode === 'outfit' ? Meta.data.currentOutfit === d[0] : Meta.data.equippedSkins[d[2]] === d[0];
    };
    Wardrobe.list = function () {
      var src = this.mode === 'outfit' ? this.outfits : this.skins,
        out = [];
      for (var i = 0; i < src.length; i++) {
        var d = src[i],
          cur = d[3],
          rar = this.rarity(d),
          owned = this.isOwned(d);
        if (this.mode === 'skin' && d[2] !== this.weapon) continue;
        if (this.filters.currency !== 'all' && cur !== this.filters.currency) continue;
        if (this.filters.rarity !== 'all' && rar !== this.filters.rarity) continue;
        if (this.filters.status === 'owned' && !owned) continue;
        if (this.filters.status === 'unowned' && owned) continue;
        out.push(d);
      }
      return out;
    };
    Wardrobe.cycle = function (key, values) {
      var i = values.indexOf(this.filters[key]);
      this.filters[key] = values[(i + 1) % values.length];
      this.scroll[this.mode] = 0;
    };
    Wardrobe.draw = function (ctx) {
      var top = CONFIG.UI.TOP_INSET || 0;
      ctx.fillStyle = '#08110e';
      ctx.fillRect(0, 0, 750, CONFIG.VIEW.HEIGHT);
      UI.drawMenuGlow(ctx);
      UI.drawActionButton(ctx, 24, 30 + top, 132, 58, '返回', true, 21);
      UI.drawCenteredText(ctx, '外观', 75 + top, 38, true, '#f4d58d');
      UI.drawActionButton(ctx, 70, 112 + top, 290, 52, '角色服装', this.mode === 'outfit', 20);
      UI.drawActionButton(ctx, 390, 112 + top, 290, 52, '武器涂装', this.mode === 'skin', 20);
      var y = 176 + top;
      if (this.mode === 'skin') {
        var ws = [['pulse', '手枪'], ['flame', '喷火器'], ['crossbow', '弩箭'], ['blade', '副武器飞刃']];
        for (var w = 0; w < 4; w++) UI.drawActionButton(ctx, 25 + w * 181, y, 158, 44, ws[w][1], this.weapon === ws[w][0], w === 3 ? 12 : 15);
        y += 56;
      }
      var cf = {
          all: '全部',
          coins: '金币',
          diamonds: '钻石'
        },
        rf = {
          all: '全部',
          WHITE: '白',
          BLUE: '蓝',
          PURPLE: '紫',
          GOLD: '金',
          RAINBOW: '彩'
        },
        sf = {
          all: '全部',
          owned: '已拥有',
          unowned: '未拥有'
        };
      UI.drawActionButton(ctx, 30, y, 216, 44, '货币 ' + cf[this.filters.currency], true, 14);
      UI.drawActionButton(ctx, 267, y, 216, 44, '品质 ' + (rf[this.filters.rarity] || '全部'), true, 14);
      UI.drawActionButton(ctx, 504, y, 216, 44, '状态 ' + sf[this.filters.status], true, 14);
      this.gridY = y + 58;
      var list = this.list(),
        scroll = this.scroll[this.mode],
        c = CONFIG.SCREEN_LAYOUT.WARDROBE,
        max = Math.max(0, Math.ceil(list.length / 2) * (c.CARD_H + c.ROW_GAP) - (CONFIG.VIEW.HEIGHT - this.gridY - (CONFIG.UI.BOTTOM_INSET || 0) - 20));
      this.scroll[this.mode] = Math.max(0, Math.min(max, scroll));
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, this.gridY, 750, CONFIG.VIEW.HEIGHT - this.gridY);
      ctx.clip();
      for (var i = 0; i < list.length; i++) {
        var x = c.LEFT + i % 2 * (c.CARD_W + c.COL_GAP),
          cy = this.gridY + Math.floor(i / 2) * (c.CARD_H + c.ROW_GAP) - this.scroll[this.mode];
        if (cy > CONFIG.VIEW.HEIGHT || cy + c.CARD_H < this.gridY) continue;
        this.drawGridCard(ctx, list[i], x, cy, c.CARD_W, c.CARD_H);
      }
      ctx.restore();
      if (this.toastTime > 0) {
        box(ctx, 180, CONFIG.VIEW.HEIGHT - 150, 390, 62, 16, 'rgba(40,18,14,.95)', '#ff8b63');
        label(ctx, this.toast, 375, CONFIG.VIEW.HEIGHT - 119, 18, '#ffd7c9', 'center', true);
      }
    };
    Wardrobe.drawGridCard = function (ctx, d, x, y, w, h) {
      var rar = this.rarity(d),
        col = rar === 'COMMON' ? '#95A5A6' : rar === 'RARE' ? '#3498DB' : rar === 'EPIC' ? '#E67E22' : '#ffd54a',
        owned = this.isOwned(d),
        equipped = this.isEquipped(d),
        locked = d[3] === 'achievement';
      box(ctx, x, y, w, h, 18, locked ? '#151918' : '#17241f', col);
      label(ctx, {
        COMMON: '普通',
        RARE: '稀有',
        EPIC: '史诗',
        LEGENDARY: '传说'
      }[rar], x + 18, y + 24, 14, col, 'left', true);
      this.drawPreview(ctx, d, x + w / 2, y + 125, 72, col);
      label(ctx, d[1], x + w / 2, y + 220, 20, '#fff', 'center', true);
      var price = d[3] === 'free' ? '初始拥有' : d[3] === 'achievement' ? '成就解锁' : d[4] + ' ' + (d[3] === 'diamonds' ? '钻石' : '金币');
      label(ctx, price, x + w / 2, y + 254, 15, d[3] === 'diamonds' ? '#83d7ff' : '#ffd166', 'center');
      var enabled = !equipped && !locked,
        txt = equipped ? '已装备' : owned ? '装备' : locked ? '尚未解锁' : '购买';
      UI.drawActionButton(ctx, x + 40, y + h - 78, w - 80, 56, txt, enabled, 18);
      if (locked) {
        ctx.save();
        ctx.globalAlpha = .42;
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, w, h);
        ctx.restore();
        label(ctx, '成就解锁', x + w / 2, y + h / 2, 18, '#fff', 'center', true);
      }
    };
    Wardrobe.drawPreview = function (ctx, d, x, y, s, col) {
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;
      if (this.mode === 'outfit') {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(0, -25, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-34, 2, 68, 80);
        ctx.fillStyle = '#202a26';
        ctx.fillRect(-25, 12, 50, 32);
      } else {
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = 10;
        if (d[2] === 'pulse') {
          ctx.fillRect(-58, -12, 105, 24);
          ctx.fillRect(-18, 10, 22, 45);
        } else if (d[2] === 'blade') {
          ctx.beginPath();
          ctx.moveTo(-65, 22);
          ctx.lineTo(60, -22);
          ctx.lineTo(20, 28);
          ctx.closePath();
          ctx.fill();
        } else if (d[2] === 'flame') {
          ctx.fillRect(-52, -25, 80, 50);
          ctx.beginPath();
          ctx.moveTo(28, -14);
          ctx.lineTo(66, 0);
          ctx.lineTo(28, 14);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(-65, 0);
          ctx.lineTo(65, 0);
          ctx.moveTo(-25, -40);
          ctx.quadraticCurveTo(35, 0, -25, 40);
          ctx.stroke();
        }
      }
      ctx.restore();
    };
    Wardrobe.activateCard = function (d) {
      if (this.isEquipped(d) || d[3] === 'achievement') return;
      if (this.isOwned(d)) {
        if (this.mode === 'outfit') Meta.data.currentOutfit = d[0];else Meta.data.equippedSkins[d[2]] = d[0];
        root.applyEquippedLooks && root.applyEquippedLooks();
        Meta.save();
        return;
      }
      var currency = d[3],
        price = d[4];
      if (currency === 'free') return;
      if ((Meta.data[currency] || 0) < price) {
        this.toast = '货币不足';
        this.toastTime = 1.2;
        return;
      }
      Meta.data[currency] -= price;
      if (this.mode === 'outfit') {
        this.ownOutfit(d[0]);
        Meta.data.currentOutfit = d[0];
      } else {
        this.ownSkin(d[0]);
        Meta.data.equippedSkins[d[2]] = d[0];
      }
      Meta.save();
    };
    Wardrobe.handleSelection = function () {
      this.toastTime = Math.max(0, this.toastTime - .016);
      var p = peek(),
        top = CONFIG.UI.TOP_INSET || 0;
      if (!p) return;
      if (inside(p, 24, 30 + top, 132, 58)) {
        Input.clearTap();
        this.open = false;
        return;
      }
      if (inside(p, 70, 112 + top, 290, 52)) {
        Input.clearTap();
        this.mode = 'outfit';
        this.scroll.outfit = 0;
        return;
      }
      if (inside(p, 390, 112 + top, 290, 52)) {
        Input.clearTap();
        this.mode = 'skin';
        this.scroll.skin = 0;
        return;
      }
      var y = 176 + top;
      if (this.mode === 'skin') {
        var ids = ['pulse', 'blade', 'flame', 'crossbow'];
        for (var w = 0; w < 4; w++) if (inside(p, 25 + w * 181, y, 158, 44)) {
          Input.clearTap();
          this.weapon = ids[w];
          this.scroll.skin = 0;
          return;
        }
        y += 56;
      }
      if (inside(p, 30, y, 216, 44)) {
        Input.clearTap();
        this.cycle('currency', ['all', 'coins', 'diamonds']);
        return;
      }
      if (inside(p, 267, y, 216, 44)) {
        Input.clearTap();
        this.cycle('rarity', ['all', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY']);
        return;
      }
      if (inside(p, 504, y, 216, 44)) {
        Input.clearTap();
        this.cycle('status', ['all', 'owned', 'unowned']);
        return;
      }
      var list = this.list(),
        c = CONFIG.SCREEN_LAYOUT.WARDROBE;
      for (var i = 0; i < list.length; i++) {
        var x = c.LEFT + i % 2 * (c.CARD_W + c.COL_GAP),
          cy = this.gridY + Math.floor(i / 2) * (c.CARD_H + c.ROW_GAP) - this.scroll[this.mode];
        if (inside(p, x + 40, cy + c.CARD_H - 78, c.CARD_W - 80, 56)) {
          Input.clearTap();
          this.activateCard(list[i]);
          return;
        }
      }
    };
    // 外观列表手势滚动；移动超过12px后清除误点击。
    Platform.onTouchStart(function (x, y, e, id) {
      if (Game.state === CONFIG.GAME.STATE_BASE && Wardrobe.open && y >= Wardrobe.gridY) {
        Wardrobe.drag.active = true;
        Wardrobe.drag.id = id;
        Wardrobe.drag.y = y;
        Wardrobe.drag.startY = y;
        Wardrobe.drag.moved = false;
      }
    });
    Platform.onTouchMove(function (x, y, e, id) {
      if (!Wardrobe.drag.active || Wardrobe.drag.id !== id) return;
      var dy = y - Wardrobe.drag.y;
      if (Math.abs(dy) > 2) {
        Wardrobe.scroll[Wardrobe.mode] -= dy;
        Wardrobe.drag.y = y;
        if (Math.abs(y - Wardrobe.drag.startY) > 12) Wardrobe.drag.moved = true;
      }
    });
    Platform.onTouchEnd(function (x, y, e, id) {
      if (Wardrobe.drag.active && Wardrobe.drag.id === id) {
        if (Wardrobe.drag.moved) Input.clearTap();
        Wardrobe.drag.active = false;
      }
    });

    // 基地移除成就入口；第三个Tab继续打开全屏外观内容。

    // ---------- #34 HUD固定轨道 ----------
    CONFIG.POLISH.TOOL_X = 20;
    CONFIG.POLISH.TOOL_Y = 20;
    CONFIG.POLISH.TOOL_W = 50;
    CONFIG.POLISH.TOOL_H = 50;
    UI.drawHud = function (ctx) {
      this.drawBoundaryWarnings(ctx);
      drawTopStats(ctx);
      drawHpLane(ctx);
      drawExpLane(ctx);
      drawBossLane(ctx);
      if (root.Objectives) root.Objectives.draw(ctx);
      if (root.DiamondFX) root.DiamondFX.draw(ctx);
      if (Achievements) Achievements.drawToast(ctx);
    };
    function drawTopStats(ctx) {
      label(ctx, UI.formatTime(Game.survivedSeconds), 375, 43, 27, '#fff', 'center', true);
      label(ctx, '击杀 ' + RunStats.kills, 730, 43, 20, '#fff', 'right', true);
    }
    function drawHpLane(ctx) {
      var x = 20,
        y = 72,
        w = 430,
        h = 32,
        r = Math.max(0, Player.hp / Player.maxHp);
      box(ctx, x, y, w, h, 12, CONFIG.COLORS.HP_BACKGROUND, CONFIG.COLORS.HP_BORDER);
      ctx.save();
      UI.roundedRectPath(ctx, x, y, w * r, h, 12);
      ctx.fillStyle = r < .3 ? CONFIG.COLORS.HP_LOW : CONFIG.COLORS.HP_FILL;
      ctx.fill();
      ctx.restore();
      label(ctx, 'HP ' + Math.ceil(Player.hp) + ' / ' + Math.ceil(Player.maxHp), x + w / 2, y + h / 2, 17, '#fff', 'center', true);
      if (Player.reviveCharges > 0) {
        label(ctx, '复活 ×' + Player.reviveCharges, 478, y + h / 2, 18, '#e0b6ff', 'left', true);
      }
    }
    function drawExpLane(ctx) {
      var x = 20,
        y = 110,
        w = 710,
        h = 24,
        r = ExpLevelUp.need ? ExpLevelUp.exp / ExpLevelUp.need : 0;
      box(ctx, x, y, w, h, 10, CONFIG.COLORS.EXP_BACKGROUND, CONFIG.COLORS.EXP_BORDER);
      ctx.save();
      UI.roundedRectPath(ctx, x, y, w * r, h, 10);
      ctx.fillStyle = CONFIG.COLORS.EXP_FILL;
      ctx.fill();
      ctx.restore();
      label(ctx, 'Lv.' + ExpLevelUp.level + '   EXP ' + Math.floor(ExpLevelUp.exp) + ' / ' + ExpLevelUp.need, x + 16, y + h / 2, 15, '#fff', 'left', true);
    }
    function drawBossLane(ctx) {
      var bs = Enemy.getActiveBosses();
      for (var i = 0; i < bs.length; i++) {
        var b = bs[i],
          y = 148 + i * 20,
          x = 20,
          w = 710,
          h = 14,
          r = b.maxHp ? b.hp / b.maxHp : 0,
          name = b.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED ? CONFIG.TEXT.BOSS_RANGED_NAME : CONFIG.TEXT.BOSS_MELEE_NAME;
        ctx.fillStyle = 'rgba(25,5,28,.9)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#d64141';
        ctx.fillRect(x, y, w * Math.max(0, r), h);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        label(ctx, name + '  ' + Math.ceil(b.hp) + ' / ' + b.maxHp, x + 6, y + h / 2, 10, '#fff', 'left', true);
      }
    }
    function ObjectivesDraw(ctx) {
      var O = root.Objectives;
      if (!O || Game.state !== CONFIG.GAME.STATE_PLAYING) return;
      var y = CONFIG.SCREEN_LAYOUT.HUD.OBJECTIVE_Y,
        x = 15,
        w = 250,
        done = 0;
      for (var i = 0; i < O.active.length; i++) if (O.active[i].done) done++;
      box(ctx, x, y, w, O.collapsed ? 44 : 182, 9, 'rgba(7,15,18,.75)', 'rgba(255,255,255,.48)');
      label(ctx, '本局目标 ' + done + '/3  ' + (O.collapsed ? '▼' : '▲'), x + 14, y + 22, 16, '#fff', 'left', true);
      if (O.collapsed) return;
      for (var j = 0; j < O.active.length; j++) {
        var o = O.active[j],
          yy = y + 44 + j * 46,
          val = Math.min(o.d[3], Math.floor(O.stats[o.d[2]] || 0)),
          ratio = val / o.d[3];
        ctx.fillStyle = o.done ? 'rgba(47,201,102,.26)' : 'rgba(20,34,38,.62)';
        ctx.fillRect(x + 5, yy, w - 10, 42);
        label(ctx, o.done ? '✓ ' + o.d[1] : o.d[1], x + 13, yy + 13, 12, o.done ? '#73f3a4' : '#eef7f2');
        label(ctx, o.done ? '已完成' : val + '/' + o.d[3], x + 13, yy + 29, 10, o.done ? '#59e58a' : '#aabbb3');
        drawDiamond(ctx, x + w - 28, yy + 17, 6);
        label(ctx, String(o.d[4]), x + w - 14, yy + 17, 10, '#83d7ff', 'center', true);
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.fillRect(x + 13, yy + 37, w - 26, 3);
        ctx.fillStyle = o.done ? '#59e58a' : '#3498DB';
        ctx.fillRect(x + 13, yy + 37, (w - 26) * Math.min(1, ratio), 3);
      }
    }
    // 目标面板移动到 y=195 后同步更新点击命中区域。
    // #56 旧版 ObjectivesDraw/旧 handle 已下线，统一使用上方 Objectives.draw / Objectives.handle。

    // ---------- #57 道具栏：右下角竖排 4 固定槽（顺序永久固定：炸弹→激光→磁铁→血包） ----------
    // 迫击炮属地图激活道具，不进道具栏；冰冻也不进固定栏。
    UI.ITEM_SLOTS = CONFIG.POWERUPS.BAR_SLOTS;
    UI.getSlotRect = function (i) {
      var s = CONFIG.UI,
        slot = s.SLOT_SIZE,
        gap = s.SLOT_GAP;
      var x = s.ITEM_BAR_X,
        bottomEdge = s.ITEM_BAR_BOTTOM,
        topOfLast = bottomEdge - slot;
      var y = topOfLast - (UI.ITEM_SLOTS.length - 1 - i) * (slot + gap);
      return {
        x: x,
        y: y,
        w: slot,
        h: slot,
        cx: x + slot / 2,
        cy: y + slot / 2
      };
    };
    UI.slotIconKey = function (type) {
      if (type === CONFIG.POWERUPS.TYPE_FREEZE) return 'icon_freeze';
      if (type === CONFIG.POWERUPS.TYPE_BOMB) return 'icon_bomb';
      if (type === CONFIG.POWERUPS.TYPE_LASER_EMITTER) return 'icon_laser';
      if (type === CONFIG.POWERUPS.TYPE_MAGNET) return 'icon_magnet';
      return 'icon_medkit';
    };
    UI.drawPowerUpButtons = function (ctx) {
      for (var i = 0; i < UI.ITEM_SLOTS.length; i++) {
        var type = UI.ITEM_SLOTS[i],
          r = UI.getSlotRect(i),
          count = PowerUps.inventory[type] || 0,
          ready = count > 0;
        ctx.save();
        var bg = root.UI.icon ? root.UI.icon('slot_bg') : null;
        if (bg) {
          ctx.drawImage(bg, r.x, r.y, r.w, r.h);
        } else {
          UI.roundedRectPath(ctx, r.x, r.y, r.w, r.h, 10);
          ctx.fillStyle = '#0A1628';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(255,255,255,.25)';
          ctx.stroke();
        }
        var is = 60,
          img = root.UI.icon ? root.UI.icon(UI.slotIconKey(type)) : null;
        if (img) {
          if (!ready) ctx.globalAlpha = .35;
          ctx.drawImage(img, r.cx - is / 2, r.cy - is / 2, is, is);
          ctx.globalAlpha = 1;
        } else {
          UI.drawPowerUpIcon(ctx, type, r.cx, r.cy, 26);
          if (!ready) {
            ctx.globalAlpha = .35;
            ctx.fillStyle = 'rgba(90,100,110,.35)';
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.globalAlpha = 1;
          }
        }
        if (!ready) {
          UI.roundedRectPath(ctx, r.x, r.y, r.w, r.h, 10);
          ctx.fillStyle = 'rgba(90,100,110,.35)';
          ctx.fill();
        }
        ctx.font = 'bold 19px Arial,"Microsoft YaHei"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,.85)';
        var lbl = String(count),
          bx = r.x + r.w - 15,
          by = r.y + r.h - 13;
        ctx.strokeText(lbl, bx, by);
        ctx.fillStyle = ready ? '#FFD700' : '#E74C3C';
        ctx.fillText(lbl, bx, by);
        ctx.restore();
        if (ready && root.ButtonUI) root.ButtonUI.register(ctx, r.x, r.y, r.w, r.h, true);
      }
      // 磁铁主动激活：玩家身上淡蓝脉动光环
      if (root.PowerUps && root.PowerUps.magnetActive && root.PowerUps.magnetActive()) {
        var sx = Player.x - Camera.x,
          sy = Player.y - Camera.y;
        ctx.save();
        ctx.globalAlpha = .5 + .3 * Math.sin(Date.now() / 120);
        ctx.beginPath();
        ctx.arc(sx, sy, 46, 0, Math.PI * 2);
        ctx.strokeStyle = '#3498DB';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, 62, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(52,152,219,.35)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }
    };
    UI.consumePowerUpButton = function () {
      if (!Input.pendingTap.active) return -1;
      var p = Input.pendingTap;
      for (var i = 0; i < UI.ITEM_SLOTS.length; i++) {
        var type = UI.ITEM_SLOTS[i];
        if ((PowerUps.inventory[type] || 0) <= 0) continue;
        var r = UI.getSlotRect(i);
        if (UI.isPointInRect(p, r.x, r.y, r.w, r.h)) {
          Input.clearTap();
          return type;
        }
      }
      return -1;
    };
    UI.getDashButtonY = function () {
      return CONFIG.UI.DASH_CY;
    };

    // 状态机和顶层渲染接入。
  })();

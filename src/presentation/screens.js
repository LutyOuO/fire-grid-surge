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
        h = CONFIG.VIEW.HEIGHT;
      // 小屏等比压缩；大屏(>=1200)使用 config.js MENU 内的 preview.png 基准值。
      if (h < 1200) {
        c.LOGO_Y = 170;
        c.LOGO_H = 210;
        c.HISTORY_Y = 480;
        c.BUFF_Y = 510;
        c.PLAY_Y = 560;
        c.PLAY_H = 110;
        c.BASE_Y = 680;
        c.BASE_H = 84;
        c.SIDE_Y = 790;
        c.SIDE_H = 78;
        c.HIST_BTN_Y = 900;
        c.HIST_BTN_H = 48;
      }
    }

    // 将带透明留白的 Logo 按内容比例放进目标区域，绝不非等比拉伸。
    function drawContainedLogo(ctx, image, x, y, width, height) {
      if (!image) return false;
      var iw = image.width || image.naturalWidth || 1254;
      var ih = image.height || image.naturalHeight || 1254;
      // 当前 Logo 的有效像素区域约为 x=2.5%..97.8%、y=11.3%..82.7%。
      // 裁去透明留白后再 contain，既保持原图比例，也不会显得过小。
      var sx = Math.round(iw * 0.025);
      var sy = Math.round(ih * 0.113);
      var sw = Math.round(iw * 0.953);
      var sh = Math.round(ih * 0.714);
      var scale = Math.min(width / sw, height / sh);
      var dw = sw * scale;
      var dh = sh * scale;
      var dx = x + (width - dw) / 2;
      var dy = y + (height - dh) / 2;
      ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
      return true;
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
        ctx.save();
        ctx.globalAlpha = 1;
        drawContainedLogo(ctx, this.image, c.LOGO_X, c.LOGO_Y + top, c.LOGO_W, c.LOGO_H);
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
      // v014：main-menu 背景切图全屏铺满；未就绪时保留底色兜底。
      var menuBg = UI.icon('menu_background');
      if (menuBg) ctx.drawImage(menuBg, 0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
      UI.drawMenuGlow(ctx);
      // 左上货币胶囊：幸存者硬币 + 分隔 + 钻石。
      box(ctx, c.CURRENCY_X, c.CURRENCY_Y + top, c.CURRENCY_W, c.CURRENCY_H, 25, 'rgba(7,17,20,.88)', '#456258');
      var survIcon = UI.icon('coin_survivor') || UI.icon('menu_coin_survivor');
      if (survIcon) ctx.drawImage(survIcon, c.CURRENCY_X + 18, c.CURRENCY_Y + top + 15, 22, 22);
      else drawCoin(ctx, c.CURRENCY_X + 28, c.CURRENCY_Y + top + 25, 10);
      label(ctx, String(Meta.data.survivorCoins), c.CURRENCY_X + 47, c.CURRENCY_Y + top + 25, 18, '#9fd6ff', 'left', true);
      label(ctx, '|', c.CURRENCY_X + 150, c.CURRENCY_Y + top + 25, 19, '#667b72', 'center');
      drawDiamond(ctx, c.CURRENCY_X + 177, c.CURRENCY_Y + top + 25, 10);
      label(ctx, String(Meta.data.diamonds || 0), c.CURRENCY_X + 196, c.CURRENCY_Y + top + 25, 18, '#83d7ff', 'left', true);
      // 右上设置齿轮（切图优先，矢量兜底）。
      UI.drawMenuGear(ctx, c, top);
      // Logo 只走统一资源预加载，避免首帧为同一路径重复创建图片对象。
      var logoImg = UI.icon('menu_logo');
      if (logoImg) drawContainedLogo(ctx, logoImg, c.LOGO_X, c.LOGO_Y + top, c.LOGO_W, c.LOGO_H);
      else UI.drawCenteredText(ctx, CONFIG.TEXT.GAME_TITLE, c.LOGO_Y + c.LOGO_H / 2 + top, 66, true, CONFIG.COLORS.TEXT);
      UI.drawCenteredText(ctx, CONFIG.TEXT.HISTORY(Meta.data.bestWave, UI.formatTime(Meta.data.bestTime), Meta.data.bestKills), c.HISTORY_Y + top, 21, false, CONFIG.COLORS.HINT_TEXT);
      if (Meta.data.nextRunBuff) UI.drawCenteredText(ctx, '下一局增益：' + Meta.data.nextRunBuff.name, c.BUFF_Y + top, 20, true, Meta.data.nextRunBuff.rarity === 'LEGENDARY' ? '#ffd54a' : Meta.data.nextRunBuff.rarity === 'EPIC' ? '#E67E22' : Meta.data.nextRunBuff.rarity === 'RARE' ? '#3498DB' : '#95A5A6');
      // 5 个按钮：0 开始战斗 / 1 幸存者基地 / 2 成就 / 3 加速补给 / 4 历史战绩。
      var ready = Meta.isSpeedupReady(),
        cool = CONFIG.TEXT.SPEEDUP_COOLDOWN(UI.formatDuration(Meta.getSpeedupRemainingMs()));
      drawMenuButton(ctx, 0, CONFIG.TEXT.START_GAME, '');
      drawMenuButton(ctx, 1, CONFIG.TEXT.OPEN_BASE, '角色强化·武器成长·炮台升级');
      drawMenuButton(ctx, 2, '成就', '');
      drawMenuButton(ctx, 3, CONFIG.TEXT.SPEEDUP, ready ? '广告·120分钟产出' : cool, ready);
      drawMenuButton(ctx, 4, '历史战绩', '');
      if (Meta.offlinePopupActive) UI.drawOfflinePopup(ctx);
      UI.drawToast(ctx);
      if (root.DevConsole) root.DevConsole.draw(ctx);
    };
    // 按钮矩形：0/1 居中大按钮；2 成就(左) / 3 加速补给(右) 并排等宽同 Y；4 底部小按钮。
    function menuButtonRect(i) {
      var c = CONFIG.SCREEN_LAYOUT.MENU,
        top = CONFIG.UI.TOP_INSET || 0,
        sideX = (750 - (c.SIDE_W * 2 + c.SIDE_GAP)) / 2,
        histX = (750 - c.HIST_BTN_W) / 2;
      if (i === 0) return { x: c.BIG_X, y: c.PLAY_Y + top, w: c.BIG_W, h: c.PLAY_H, kind: 'play' };
      if (i === 1) return { x: c.BIG_X, y: c.BASE_Y + top, w: c.BIG_W, h: c.BASE_H, kind: 'base' };
      if (i === 2) return { x: sideX, y: c.SIDE_Y + top, w: c.SIDE_W, h: c.SIDE_H, kind: 'achievement' };
      if (i === 3) return { x: sideX + c.SIDE_W + c.SIDE_GAP, y: c.SIDE_Y + top, w: c.SIDE_W, h: c.SIDE_H, kind: 'supply' };
      return { x: histX, y: c.HIST_BTN_Y + top, w: c.HIST_BTN_W, h: c.HIST_BTN_H, kind: 'history' };
    }
    function drawMenuButton(ctx, i, title, sub, enabled) {
      var rect = menuButtonRect(i),
        size = i === 4 ? 20 : i === 1 ? 26 : i === 3 ? 24 : 28;
      // 主菜单也恢复为最初的 Canvas 暖色按钮，不再使用横向按钮切图。
      UI.drawActionButton(ctx, rect.x, rect.y, rect.w, rect.h, sub ? '' : title, enabled !== false, size);
      // 左侧图标：切图优先，矢量兜底。
      if (i === 1) drawMenuIcon(ctx, 'icon_menu_base', rect, 46, drawHouseIcon);
      else if (i === 2) drawMenuIcon(ctx, 'icon_menu_achievement', rect, 36, drawTrophyIcon);
      else if (i === 3) drawMenuIcon(ctx, 'icon_menu_supply', rect, 36, drawBoxIcon);
      else if (i === 4) drawMenuIcon(ctx, 'icon_menu_history', rect, 28, drawTrophyIcon);
      // 副标题。
      if (sub) {
        var subCol = enabled === false ? '#82958b' : 'rgba(36,48,39,.82)';
        label(ctx, title, rect.x + rect.w / 2, rect.y + rect.h * 0.38, size, enabled === false ? CONFIG.COLORS.BUTTON_DISABLED_TEXT : CONFIG.COLORS.BUTTON_TEXT, 'center', true);
        label(ctx, sub, rect.x + rect.w / 2, rect.y + rect.h * 0.74, 14, subCol, 'center', false);
      }
    }
    function drawMenuIcon(ctx, key, rect, size, fallback) {
      var img = UI.icon(key);
      var ix = rect.x + (rect.w > 400 ? 26 : 20),
        iy = rect.y + rect.h / 2 - size / 2;
      if (img) ctx.drawImage(img, ix, iy, size, size);
      else fallback(ctx, ix + size / 2, rect.y + rect.h / 2, size * 0.46);
    }
    function drawHouseIcon(ctx, cx, cy, s) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#9fd6ff';
      ctx.beginPath();
      ctx.moveTo(-s, -s * 0.05);
      ctx.lineTo(0, -s);
      ctx.lineTo(s, -s * 0.05);
      ctx.lineTo(s, s);
      ctx.lineTo(-s, s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0d2a3a';
      ctx.fillRect(-s * 0.28, s * 0.2, s * 0.56, s * 0.8);
      ctx.restore();
    }
    function drawTrophyIcon(ctx, cx, cy, s) {
      trophy(ctx, cx, cy, s, '#ffd166');
    }
    function drawBoxIcon(ctx, cx, cy, s) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#e8b34a';
      ctx.strokeStyle = '#8a5a10';
      ctx.lineWidth = 2;
      ctx.fillRect(-s, -s * 0.8, s * 2, s * 1.6);
      ctx.strokeRect(-s, -s * 0.8, s * 2, s * 1.6);
      ctx.fillStyle = '#8a5a10';
      ctx.fillRect(-s, -s * 0.1, s * 2, s * 0.2);
      ctx.restore();
    }
    // 右上设置齿轮：切图优先，矢量齿轮兜底。
    UI.drawMenuGear = function (ctx, c, top) {
      var gx = c.GEAR_X,
        gy = c.GEAR_Y + top,
        gs = c.GEAR_SIZE;
      var gear = UI.icon('icon_menu_settings');
      if (gear) {
        ctx.drawImage(gear, gx, gy, gs, gs);
      } else {
        ctx.save();
        ctx.translate(gx + gs / 2, gy + gs / 2);
        ctx.fillStyle = '#9fb8c2';
        for (var k = 0; k < 8; k++) {
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-gs * 0.08, -gs * 0.48, gs * 0.16, gs * 0.2);
        }
        ctx.strokeStyle = '#5e7a86';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, gs * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0d1a1e';
        ctx.beginPath();
        ctx.arc(0, 0, gs * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };
    UI.consumeMenuAction = function () {
      layoutMenu();
      if (!Input.consumeTap(this.tapPoint)) return -1;
      for (var i = 0; i < 5; i++) {
        var r = menuButtonRect(i);
        if (this.tapPoint.x >= r.x && this.tapPoint.x <= r.x + r.w && this.tapPoint.y >= r.y && this.tapPoint.y <= r.y + r.h) return i;
      }
      return -1;
    };
    // 右上设置按钮：peek 触点，命中才消费（不命中保留给按钮）。
    UI.consumeMenuSettings = function () {
      layoutMenu();
      if (!Input.pendingTap.active) return false;
      var c = CONFIG.SCREEN_LAYOUT.MENU,
        top = CONFIG.UI.TOP_INSET || 0,
        gx = c.GEAR_X,
        gy = c.GEAR_Y + top,
        gs = c.GEAR_SIZE;
      var hit = UI.isPointInRect(Input.pendingTap, gx - 10, gy - 10, gs + 20, gs + 20);
      if (hit) Input.clearTap();
      return hit;
    };
    // 历史战绩占位页：最高波次 / 最长生存 / 总击杀 + 返回。
    UI.drawHistory = function (ctx) {
      layoutMenu();
      var top = CONFIG.UI.TOP_INSET || 0;
      ctx.fillStyle = '#08110e';
      ctx.fillRect(0, 0, 750, CONFIG.VIEW.HEIGHT);
      UI.drawMenuGlow(ctx);
      UI.drawActionButton(ctx, 24, 34 + top, 132, 62, CONFIG.TEXT.BACK, true, 22);
      var histIcon = UI.icon('icon_menu_history') || UI.icon('nav_history');
      if (histIcon) ctx.drawImage(histIcon, 340, 150 + top, 70, 70);
      var historyBadge = UI.icon('nav_history');
      if (historyBadge && historyBadge !== histIcon) ctx.drawImage(historyBadge, 174, 226 + top, 34, 34);
      UI.drawCenteredText(ctx, '历史战绩', 250 + top, 46, true, '#e8eef0');
      UI.drawCenteredText(ctx, '最高波次：第 ' + (Meta.data.bestWave || 0) + ' 波', 330 + top, 26, false, '#9fd6ff');
      UI.drawCenteredText(ctx, '最长生存：' + UI.formatTime(Meta.data.bestTime || 0), 390 + top, 26, false, '#9fd6ff');
      UI.drawCenteredText(ctx, '总击杀：' + (Meta.data.bestKills || 0), 450 + top, 26, false, '#9fd6ff');
      Ads.draw(ctx);
    };
    UI.consumeHistoryBack = function () {
      layoutMenu();
      if (!Input.consumeTap(this.tapPoint)) return false;
      var top = CONFIG.UI.TOP_INSET || 0;
      if (this.tapPoint.x >= 24 && this.tapPoint.x <= 156 && this.tapPoint.y >= 34 + top && this.tapPoint.y <= 96 + top) return true;
      return false;
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
      var achievementIcon = UI.icon('nav_achievement');
      if (achievementIcon) ctx.drawImage(achievementIcon, 345, 62 + top, 60, 60);else trophy(ctx, 375, 92 + top, 26);
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
          survivorCoins: '幸存者硬币',
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
      var price = d[3] === 'free' ? '初始拥有' : d[3] === 'achievement' ? '成就解锁' : d[4] + ' ' + (d[3] === 'diamonds' ? '钻石' : '幸存者硬币');
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
        this.cycle('currency', ['all', 'survivorCoins', 'diamonds']);
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
      if (root.Objectives) root.Objectives.draw(ctx);
      if (root.DiamondFX) root.DiamondFX.draw(ctx);
      if (Achievements) Achievements.drawToast(ctx);
    };
    function drawTopStats(ctx) {
      label(ctx, '第 ' + Math.max(1, Spawner.waveIndex) + ' 波', 20, 34, 22, '#fff', 'left', true);
      label(ctx, UI.formatTime(Game.survivedSeconds), 20, 62, 18, '#d8e0dc', 'left', true);
    }
    UI.drawPlayerStatus = function (ctx) {
      var sx = Player.x - Camera.x, sy = Player.y - Camera.y, w = 70, h = 6;
      var armorMax = Math.max(Player.armorMax || 0, Player.upgradeShieldMax || 0, Player.shield || 0);
      var targets = [ExpLevelUp.need ? ExpLevelUp.exp / ExpLevelUp.need : 0, Player.hp / Player.maxHp, armorMax ? Player.shield / armorMax : 0];
      if (!this._playerStatusSmooth) this._playerStatusSmooth = targets.slice();
      var ys = [sy - 58, sy - 46, sy - 34], colors = ['#e5bd42', '#e45656', armorMax ? '#55cfee' : '#777'], icons = ['status_xp', 'status_hp', 'status_armor'];
      for (var i = 0; i < 3; i++) {
        this._playerStatusSmooth[i] += (targets[i] - this._playerStatusSmooth[i]) * .085;
        var img = this.icon(icons[i]); if (img) ctx.drawImage(img, sx - w / 2 - 22, ys[i] - 6, 18, 18);
        ctx.fillStyle = 'rgba(4,10,12,.78)'; ctx.fillRect(sx - w / 2, ys[i], w, h);
        ctx.fillStyle = colors[i]; ctx.fillRect(sx - w / 2, ys[i], w * Math.max(0, Math.min(1, this._playerStatusSmooth[i])), h);
      }
      if (root.WeaponProgress.selected === 'pistol' && !root.PulseGun.reloading) label(ctx, Math.max(0, Math.ceil(root.PulseGun.ammo)) + '/' + root.PulseGun.getMagazineSize(), sx + 28, sy - 40, 14, '#ffd166', 'left', true);
    };
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
      var armorMax = Math.max(Player.armorMax || 0, Player.upgradeShieldMax || 0, Player.shield || 0);
      var ar = armorMax > 0 ? Math.max(0, Player.shield / armorMax) : 0;
      ctx.fillStyle = armorMax > 0 ? 'rgba(16,48,60,.95)' : 'rgba(80,84,85,.85)'; ctx.fillRect(x, y - 9, w, 6);
      if (ar > 0) { ctx.fillStyle = '#59d8f3'; ctx.fillRect(x, y - 9, w * Math.min(1, ar), 6); }
      ctx.strokeStyle = armorMax > 0 ? '#9af2ff' : '#777'; ctx.lineWidth = 1; ctx.strokeRect(x, y - 9, w, 6);
      if (Player.reviveCharges > 0) {
        label(ctx, '复活 ×' + Player.reviveCharges, 478, y + h / 2, 18, '#e0b6ff', 'left', true);
      }
      if (root.WeaponProgress.selected === 'pistol') label(ctx, '弹药 ' + Math.max(0, Math.ceil(root.PulseGun.ammo)) + '/' + root.PulseGun.getMagazineSize(), 720, y + h / 2, 17, '#ffd166', 'right', true);
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
      var x = UI.mirrorX(s.ITEM_BAR_X + slot / 2) - slot / 2,
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

    // ---------- v012 #75 选图界面：主菜单"开始战斗" → 选图 → 选武器 → 开战 ----------
    // 每张卡片 = 该 layout 的小俯视缩略图（walls/turrets/extract）+ 一句话简介；
    // 未解锁灰显并提示解锁条件（波次里程碑 / 幸存者硬币购买），解锁进度存 Meta.data.unlockedMaps。
    var MapSelect = {
      CARD_X: 40,
      CARD_W: 670,
      CARD_H: 296,
      CARD_Y0: 218,
      CARD_GAP: 18,
      THUMB: 190,
      WALL_COLORS: {
        concrete: '#5c6b66',
        container: '#7a5a3a',
        rubble: '#4a4f49'
      },
      backRect: function () {
        return {
          x: 24,
          y: 30 + (CONFIG.UI.TOP_INSET || 0),
          w: 132,
          h: 58
        };
      },
      cardRect: function (i) {
        return {
          x: this.CARD_X,
          y: this.CARD_Y0 + i * (this.CARD_H + this.CARD_GAP),
          w: this.CARD_W,
          h: this.CARD_H
        };
      },
      buyRect: function (i) {
        var c = this.cardRect(i);
        return {
          x: c.x + c.w - 200,
          y: c.y + c.h - 78,
          w: 180,
          h: 54
        };
      },
      drawThumb: function (ctx, layout, x, y, s, dim) {
        // 世界 2400×2400 → s×s 缩略图。
        var scale = s / CONFIG.WORLD.WIDTH;
        ctx.save();
        ctx.fillStyle = dim ? '#101714' : '#0c1714';
        ctx.fillRect(x, y, s, s);
        // 撤离点
        if (layout.extract) {
          ctx.strokeStyle = dim ? '#3a4a44' : '#7db392';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x + layout.extract.x * scale, y + layout.extract.y * scale, layout.extract.r * scale, 0, Math.PI * 2);
          ctx.stroke();
        }
        // 墙
        for (var i = 0; i < layout.walls.length; i++) {
          var w = layout.walls[i];
          ctx.fillStyle = dim ? '#2c3632' : (this.WALL_COLORS[w.kind] || '#5c6b66');
          ctx.fillRect(x + w.x * scale, y + w.y * scale, Math.max(2, w.w * scale), Math.max(2, w.h * scale));
        }
        // 炮台
        for (var t = 0; t < layout.turrets.length; t++) {
          var tr = layout.turrets[t];
          ctx.fillStyle = dim ? '#4a4f49' : '#3498DB';
          ctx.beginPath();
          ctx.arc(x + tr.x * scale, y + tr.y * scale, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = '#2a3a34';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, s, s);
        ctx.restore();
      },
      draw: function (ctx) {
        var top = CONFIG.UI.TOP_INSET || 0;
        ctx.fillStyle = CONFIG.COLORS.MENU_BACKGROUND;
        ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
        UI.drawMenuGlow(ctx);
        var br = this.backRect();
        UI.drawActionButton(ctx, br.x, br.y, br.w, br.h, '返回', true, 21);
        UI.drawCenteredText(ctx, CONFIG.TEXT.MAP_TITLE, 78 + top, 42, true, '#f4d58d');
        UI.drawCenteredText(ctx, CONFIG.TEXT.MAP_HINT, 124 + top, 18, false, CONFIG.COLORS.HINT_TEXT);
        // 幸存者硬币余额
        drawCoin(ctx, 560, 100 + top, 10);
        label(ctx, String(Meta.data.survivorCoins), 600, 101 + top, 18, '#ffe27a', 'left', true);
        var layouts = CONFIG.FIELD.LAYOUTS;
        for (var i = 0; i < layouts.length; i++) {
          var c = this.cardRect(i);
          var unlocked = Meta.isMapUnlocked(i);
          var selected = Meta.data.selectedMap === i;
          box(ctx, c.x, c.y, c.w, c.h, 18, selected ? 'rgba(58,74,40,.95)' : 'rgba(18,32,27,.96)', selected ? '#d6aa55' : unlocked ? '#456258' : '#2a3330');
          this.drawThumb(ctx, layouts[i], c.x + 22, c.y + 22, this.THUMB, !unlocked);
          var tx = c.x + 240;
          label(ctx, (selected ? '✓ ' : '') + CONFIG.TEXT.MAP_NAMES[i], tx, c.y + 44, 27, unlocked ? '#f4fff7' : '#7d8d85', 'left', true);
          label(ctx, CONFIG.TEXT.MAP_DESCS[i], tx, c.y + 84, 16, unlocked ? '#c2d0c9' : '#66796f', 'left', false);
          // 解锁状态 / 按钮
          if (unlocked) {
            label(ctx, selected ? CONFIG.TEXT.MAP_SELECTED : CONFIG.TEXT.MAP_UNLOCKED, tx, c.y + c.h - 34, 17, selected ? '#ffd54a' : '#7fb89a', 'left', true);
          } else {
            var def = layouts[i].unlock;
            if (def && def.kind === 'wave') {
              label(ctx, CONFIG.TEXT.MAP_LOCK_WAVE(def.wave), tx, c.y + c.h - 34, 16, '#8aa6c9', 'left', true);
            } else if (def && def.kind === 'coins') {
              var buy = this.buyRect(i);
              UI.drawActionButton(ctx, buy.x, buy.y, buy.w, buy.h, CONFIG.TEXT.MAP_BUY_UNLOCK(def.cost), Meta.canBuyMap(i), 18);
            } else {
              label(ctx, CONFIG.TEXT.MAP_LOCKED, tx, c.y + c.h - 34, 16, '#8a9a92', 'left', true);
            }
          }
        }
        UI.drawToast(ctx);
        if (root.DevConsole) root.DevConsole.draw(ctx);
      },
      update: function () {
        var p = peek();
        if (!p) return;
        var br = this.backRect();
        if (inside(p, br.x, br.y, br.w, br.h)) {
          Input.clearTap();
          Game.enterMenu();
          return;
        }
        var layouts = CONFIG.FIELD.LAYOUTS;
        for (var i = 0; i < layouts.length; i++) {
          var c = this.cardRect(i);
          var unlocked = Meta.isMapUnlocked(i);
          // 未解锁且支持硬币购买：先判购买按钮
          if (!unlocked && layouts[i].unlock && layouts[i].unlock.kind === 'coins') {
            var buy = this.buyRect(i);
            if (inside(p, buy.x, buy.y, buy.w, buy.h)) {
              Input.clearTap();
              if (Meta.buyMap(i)) Meta.showToast(CONFIG.TEXT.MAP_NAMES[i] + ' 已解锁');
              else Meta.showToast(CONFIG.TEXT.MAP_LOCK_TOAST);
              return;
            }
            continue; // 未解锁卡片本体不可点
          }
          if (inside(p, c.x, c.y, c.w, c.h)) {
            Input.clearTap();
            if (!unlocked) {
              Meta.showToast(CONFIG.TEXT.MAP_LOCK_TOAST);
              return;
            }
            Meta.selectMap(i);
            Game.state = 'WEAPON_SELECT';
            Input.reset();
            Input.setMovementEnabled(false);
            return;
          }
        }
      }
    };
    root.MapSelect = MapSelect;

    // 状态机和顶层渲染接入。
  })();

(function () {
var root = typeof window !== 'undefined' ? window : global;
var CONFIG = root.CONFIG;
var Platform = root.Platform,
  Input = root.Input,
  Player = root.Player,
  Enemy = root.Enemy,
  Bullet = root.Bullet,
  PulseGun = root.PulseGun,
  Camera = root.Camera,
  Game = root.Game,
  Meta = root.Meta,
  Settings = root.Settings,
  Ads = root.Ads,
  ExpLevelUp = root.ExpLevelUp,
  RunStats = root.RunStats;
var UI = {
    tapPoint: {
      x: 0,
      y: 0
    },
    baseTab: 'character',
    baseTabFade: 1,
    baseCharacterPage: 0,
    baseGadgetIndex: 0,
    // ---------- 动态布局适配 ----------
    // 逻辑高度变化时（不同设备长宽比），重新计算所有锚定的 UI 坐标
    // 同时应用安全区偏移（刘海/灵动岛/底部横条）
    relayout: function () {
      var h = CONFIG.VIEW.HEIGHT;
      // 安全区偏移（逻辑像素），来自 Platform 根据 safeArea 换算
      var topInset = root.Platform && root.Platform.safeTop || 0;
      var bottomInset = root.Platform && root.Platform.safeBottom || 0;
      CONFIG.UI.TOP_INSET = topInset;
      CONFIG.UI.BOTTOM_INSET = bottomInset;
      // 可用内容高度（减去上下安全区）
      var contentH = h - topInset - bottomInset;

      // === 战斗 HUD：顶部锚定，加安全区 ===
      CONFIG.UI.HP_BAR_Y = 28 + topInset;
      CONFIG.UI.EXP_BAR_Y = 78 + topInset;
      CONFIG.UI.LEVEL_Y = 72 + topInset;
      CONFIG.UI.HUD_STATS_Y = 137 + topInset;
      CONFIG.UI.BOSS_BAR_Y = 174 + topInset;

      // === 菜单 ===
      // 按钮组起始位置：必须在历史记录(405+top)下方，短屏上移但不低于 470+top
      CONFIG.UI.MENU_BUTTON_START_Y = topInset + Math.min(570, Math.max(470, contentH - 560));
      CONFIG.UI.MENU_HINT_Y = h - bottomInset - 240;

      // === 结算界面：底部锚定，减安全区 ===
      CONFIG.UI.RESTART_Y = h - bottomInset - 160;
      CONFIG.UI.SETTLEMENT_AD_Y = h - bottomInset - 290;

      // === 升级界面：底部锚定 ===
      CONFIG.UI.LEVEL_REFRESH_Y = h - bottomInset - 120;
      CONFIG.UI.CARD_HINT_Y = h - bottomInset - 200;

      // === 菜单设置按钮 ===
      if (CONFIG.POLISH) {
        CONFIG.POLISH.MENU_TOOL_Y = h - bottomInset - 160;
        // 战斗中暂停按钮（右上角），加顶部安全区
        CONFIG.POLISH.TOOL_Y = 215 + topInset;
        // 暂停/设置/帮助面板按钮起始位置
        CONFIG.POLISH.PANEL_TOP = 300 + topInset;
      }

      // === 炮塔激活按钮 ===
      if (CONFIG.FIELD) {
        CONFIG.FIELD.ACTIVATE_Y = h - bottomInset - 190;
        // 暂停界面 Boss 血条位置
        CONFIG.FIELD.BOSS_PANEL_Y = 80 + topInset;
      }

      // === 基地界面：固定每页 5 项，根据安全区和屏幕高度动态分配卡片高度 ===
      CONFIG.UI.BASE_CONTENT_Y = topInset + CONFIG.UI.BASE_TAB_Y + CONFIG.UI.BASE_TAB_HEIGHT + 22;
      CONFIG.UI.BASE_LIST_Y = CONFIG.UI.BASE_CONTENT_Y + CONFIG.UI.BASE_SECTION_HEIGHT + 12;
      var baseBottom = h - bottomInset - 24;
      var baseRowsSpace = baseBottom - CONFIG.UI.BASE_LIST_Y - CONFIG.UI.BASE_PAGER_HEIGHT - 22;
      CONFIG.UI.BASE_ROW_HEIGHT = Math.max(94, Math.min(164, Math.floor((baseRowsSpace - CONFIG.UI.BASE_ROW_GAP * (CONFIG.UI.BASE_VISIBLE_ROWS - 1)) / CONFIG.UI.BASE_VISIBLE_ROWS)));
      CONFIG.UI.BASE_PAGER_Y = CONFIG.UI.BASE_LIST_Y + CONFIG.UI.BASE_VISIBLE_ROWS * CONFIG.UI.BASE_ROW_HEIGHT + (CONFIG.UI.BASE_VISIBLE_ROWS - 1) * CONFIG.UI.BASE_ROW_GAP + 12;
      CONFIG.UI.BASE_BUY_HEIGHT = Math.max(52, Math.min(66, CONFIG.UI.BASE_ROW_HEIGHT - 40));

      // === 升级界面：短屏缩小卡片 ===
      if (contentH <= 980) {
        CONFIG.UI.CARD_HEIGHT = 195;
        CONFIG.UI.CARD_START_Y = topInset + 215;
        CONFIG.UI.CARD_GAP = 18;
      } else {
        CONFIG.UI.CARD_HEIGHT = 235;
        CONFIG.UI.CARD_START_Y = topInset + 240;
        CONFIG.UI.CARD_GAP = 26;
      }

      // === #56 暂停按钮：固定右上角，避开微信胶囊（H5 用默认右上角留空） ===
      var s = CONFIG.UI;
      var menuRect = root.Platform && root.Platform.getMenuButtonRect ? root.Platform.getMenuButtonRect() : null;
      if (menuRect && root.Platform.screenToCanvas) {
        var bl = root.Platform.screenToCanvas(menuRect.left, menuRect.bottom);
        s.PAUSE_Y = Math.round(bl.y + 8);
        // 横向始终贴游戏画面的右边，而不是跟随微信胶囊的物理坐标。
        s.PAUSE_X = CONFIG.VIEW.WIDTH - 20 - s.PAUSE_SIZE;
      } else {
        s.PAUSE_Y = 14 + topInset;
        s.PAUSE_X = CONFIG.VIEW.WIDTH - 20 - s.PAUSE_SIZE;
      }
      // 异常安全区数据也不能把暂停键推到可视范围之外。
      s.PAUSE_X = Math.max(12, Math.min(CONFIG.VIEW.WIDTH - s.PAUSE_SIZE - 12, s.PAUSE_X));
      s.PAUSE_Y = Math.max(topInset + 8, Math.min(topInset + 150, s.PAUSE_Y));

      // === #56 小目标：血条/经验条/boss 行下方，左上角，不遮挡战斗信息 ===
      s.OBJ_TOP = 168 + topInset;

      // === #57 道具栏：右下角竖排 4 固定槽（固定屏幕空间，不随相机） ===
      var slot = s.SLOT_SIZE,
        slotGap = s.SLOT_GAP;
      s.ITEM_BAR_X = CONFIG.VIEW.WIDTH - s.ITEM_BAR_RIGHT_M - slot;
      s.ITEM_BAR_BOTTOM = h - bottomInset - s.ITEM_BAR_BOTTOM_M; // 最底槽下边缘
      // === #57 冲刺键：道具栏左下方，独立圆形大按钮，与道具栏水平间隔 ≥30 ===
      s.DASH_CY = s.ITEM_BAR_BOTTOM - slot / 2; // 与最底槽垂直居中
      s.DASH_CX = s.ITEM_BAR_X - 34 - s.DASH_BUTTON_RADIUS; // 水平间隔 34 > 30
      CONFIG.UI.DASH_BUTTON_X = s.DASH_CX;
    },
    // 只镜像战斗操作组件，暂停、金币与居中面板不受影响。
    mirrorX: function (x) { return root.Settings && root.Settings.mirror ? CONFIG.VIEW.WIDTH - x : x; },
    // ---------- 主菜单 ----------

    drawMenuGlow: function (ctx) {
      var gradient = ctx.createRadialGradient(375, 180, 20, 375, 360, 560);
      root.safeStop(gradient, 0, 'rgba(61, 221, 117, 0.20)');
      root.safeStop(gradient, 1, 'rgba(5, 14, 11, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, 800);
    },
    drawMenuButton: function (ctx, index, label, enabled, subtext) {
      var x = CONFIG.UI.MENU_BUTTON_X;
      var y = CONFIG.UI.MENU_BUTTON_START_Y + index * (CONFIG.UI.MENU_BUTTON_HEIGHT + CONFIG.UI.MENU_BUTTON_GAP);
      this.drawActionButton(ctx, x, y, CONFIG.UI.MENU_BUTTON_WIDTH, CONFIG.UI.MENU_BUTTON_HEIGHT, label, enabled, 33);
      if (subtext) {
        this.drawCenteredText(ctx, subtext, y + CONFIG.UI.MENU_BUTTON_HEIGHT + 18, 17, false, enabled ? CONFIG.COLORS.HINT_TEXT : CONFIG.COLORS.BUTTON_DISABLED_TEXT);
      }
    },
    // ---------- 基地（永久升级） ----------
    getBaseContentY: function (top) {
      return CONFIG.UI.BASE_CONTENT_Y || top + CONFIG.UI.BASE_TAB_Y + CONFIG.UI.BASE_TAB_HEIGHT + 22;
    },
    updateBaseTab: function (dt) {
      if (this.baseTabFade < 1) {
        this.baseTabFade = Math.min(1, this.baseTabFade + dt / CONFIG.UI.BASE_TAB_FADE_TIME);
      }
    },
    drawBaseTabs: function (ctx, top) {
      var rects = this.getBaseTabRects(top);
      var labels = [CONFIG.TEXT.BASE_TAB_CHARACTER, CONFIG.TEXT.BASE_TAB_GADGET];
      var actives = [this.baseTab === 'character', this.baseTab === 'gadget'];
      for (var i = 0; i < 2; i++) {
        var r = rects[i];
        this.roundedRectPath(ctx, r.x, r.y, r.w, r.h, 14);
        ctx.fillStyle = actives[i] ? CONFIG.COLORS.BUTTON : CONFIG.COLORS.BASE_TAB_IDLE;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = actives[i] ? CONFIG.COLORS.BUTTON_BORDER : CONFIG.COLORS.META_CARD_BORDER;
        ctx.stroke();
        ctx.save();
        ctx.font = 'bold 24px Arial, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = actives[i] ? CONFIG.COLORS.BUTTON_TEXT : CONFIG.COLORS.HINT_TEXT;
        ctx.fillText(labels[i], r.x + r.w / 2, r.y + r.h / 2 + 1);
        ctx.restore();
        if (root.ButtonUI) root.ButtonUI.register(ctx, r.x, r.y, r.w, r.h, true);
      }
    },
    drawBaseCharacter: function (ctx, top) {
      var definitions = CONFIG.META.UPGRADES;
      var perPage = CONFIG.UI.BASE_VISIBLE_ROWS;
      var totalPages = Math.ceil(definitions.length / perPage);
      this.baseCharacterPage = Math.max(0, Math.min(totalPages - 1, this.baseCharacterPage));
      this.drawBaseSectionHeader(ctx, CONFIG.TEXT.BASE_CHARACTER_SECTION, CONFIG.TEXT.BASE_CHARACTER_HINT, this.getCharacterProgress());
      var first = this.baseCharacterPage * perPage;
      var last = Math.min(definitions.length, first + perPage);
      for (var i = first; i < last; i++) {
        this.drawBaseUpgradeRow(ctx, i - first, definitions[i], false, '', i);
      }
      this.drawBasePager(ctx, this.baseCharacterPage, totalPages, 1010, 1011);
    },
    getCharacterProgress: function () {
      var current = 0,
        total = 0;
      for (var i = 0; i < CONFIG.META.UPGRADES.length; i++) {
        current += Meta.getUpgradeLevel(CONFIG.META.UPGRADES[i].ID);
        total += CONFIG.META.UPGRADES[i].MAX_LEVEL;
      }
      return CONFIG.TEXT.BASE_LEVEL_TOTAL(current, total);
    },
    drawBaseSectionHeader: function (ctx, title, subtitle, status) {
      var x = CONFIG.UI.BASE_CARD_X;
      var y = CONFIG.UI.BASE_CONTENT_Y;
      var w = CONFIG.UI.BASE_CARD_WIDTH;
      var h = CONFIG.UI.BASE_SECTION_HEIGHT;
      this.roundedRectPath(ctx, x, y, w, h, 18);
      ctx.fillStyle = CONFIG.COLORS.BASE_HEADER_PANEL;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = CONFIG.COLORS.META_CARD_BORDER;
      ctx.stroke();
      ctx.fillStyle = CONFIG.COLORS.BASE_ACCENT;
      ctx.fillRect(x, y + 18, 6, h - 36);
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CONFIG.COLORS.TEXT;
      ctx.font = 'bold 25px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillText(title, x + 24, y + 30);
      ctx.fillStyle = CONFIG.COLORS.HINT_TEXT;
      ctx.font = '17px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillText(subtitle, x + 24, y + 65);
      ctx.textAlign = 'right';
      ctx.fillStyle = CONFIG.COLORS.COIN;
      ctx.font = 'bold 18px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillText(status, x + w - 22, y + 48);
      ctx.restore();
    },
    drawBaseGadget: function (ctx) {
      var groups = CONFIG.META.GADGET_UPGRADES;
      var ids = Object.keys(groups);
      if (this.baseGadgetFilter === 'turret') ids = ids.filter(function (id) { return id.indexOf('turret_') === 0; });
      if (this.baseGadgetFilter === 'item') ids = ids.filter(function (id) { return ['laser','bomb','medkit','magnet','freeze'].indexOf(id) >= 0; });
      this.baseGadgetIndex = Math.max(0, Math.min(ids.length - 1, this.baseGadgetIndex));
      var gadgetId = ids[this.baseGadgetIndex];
      var group = groups[gadgetId];
      this.drawGadgetSectionHeader(ctx, group, this.baseGadgetIndex, ids.length);
      for (var i = 0; i < group.items.length; i++) {
        this.drawBaseUpgradeRow(ctx, i, group.items[i], true, gadgetId, i);
      }
      this.drawGadgetDots(ctx, this.baseGadgetIndex, ids.length);
    },
    drawGadgetSectionHeader: function (ctx, group, index, total) {
      var x = CONFIG.UI.BASE_CARD_X;
      var y = CONFIG.UI.BASE_CONTENT_Y;
      var w = CONFIG.UI.BASE_CARD_WIDTH;
      var h = CONFIG.UI.BASE_SECTION_HEIGHT;
      this.roundedRectPath(ctx, x, y, w, h, 18);
      ctx.fillStyle = CONFIG.COLORS.BASE_HEADER_PANEL;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = CONFIG.COLORS.META_CARD_BORDER;
      ctx.stroke();
      var navY = y + (h - CONFIG.UI.BASE_NAV_HEIGHT) / 2;
      this.drawActionButton(ctx, x + 12, navY, CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT, CONFIG.TEXT.BASE_PREV, index > 0, 38);
      this.drawActionButton(ctx, x + w - CONFIG.UI.BASE_NAV_WIDTH - 12, navY, CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT, CONFIG.TEXT.BASE_NEXT, index < total - 1, 38);
      this.drawCenteredText(ctx, group.NAME, y + 31, 26, true, CONFIG.COLORS.TEXT);
      this.drawCenteredText(ctx, CONFIG.TEXT.BASE_GADGET_HINT, y + 64, 16, false, CONFIG.COLORS.HINT_TEXT);
    },
    drawBaseUpgradeRow: function (ctx, rowIndex, definition, isGadget, gadgetId) {
      var x = CONFIG.UI.BASE_CARD_X;
      var y = CONFIG.UI.BASE_LIST_Y + rowIndex * (CONFIG.UI.BASE_ROW_HEIGHT + CONFIG.UI.BASE_ROW_GAP);
      var width = CONFIG.UI.BASE_CARD_WIDTH;
      var height = CONFIG.UI.BASE_ROW_HEIGHT;
      var level = isGadget ? Meta.getGadgetLevel(gadgetId, definition.ID) : Meta.getUpgradeLevel(definition.ID);
      var isMax = level >= definition.MAX_LEVEL;
      var canBuy = isGadget ? Meta.canBuyGadget(gadgetId, definition.ID) : Meta.canBuy(definition);
      var price = isGadget ? Meta.getGadgetPrice(gadgetId, definition.ID) : Meta.getPrice(definition);
      this.roundedRectPath(ctx, x, y, width, height, 17);
      ctx.fillStyle = rowIndex % 2 === 0 ? CONFIG.COLORS.BASE_ROW : CONFIG.COLORS.BASE_ROW_ALT;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isMax ? CONFIG.COLORS.META_MAX : CONFIG.COLORS.META_CARD_BORDER;
      ctx.stroke();
      ctx.fillStyle = isMax ? CONFIG.COLORS.META_MAX : CONFIG.COLORS.BASE_ACCENT;
      ctx.fillRect(x, y + 15, 5, height - 30);
      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = CONFIG.COLORS.TEXT;
      ctx.font = 'bold 23px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillText(definition.NAME, x + 20, y + 27);
      ctx.font = '17px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillStyle = CONFIG.COLORS.CARD_DESCRIPTION;
      ctx.fillText(definition.DESC, x + 20, y + 58);
      ctx.textAlign = 'right';
      ctx.font = 'bold 17px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillStyle = isMax ? CONFIG.COLORS.META_MAX : CONFIG.COLORS.HINT_TEXT;
      ctx.fillText(CONFIG.TEXT.META_LEVEL(level, definition.MAX_LEVEL), x + width - 22, y + 20);
      ctx.restore();
      this.drawLevelSegments(ctx, x + 20, y + height - 22, width - CONFIG.UI.BASE_BUY_WIDTH - 54, level, definition.MAX_LEVEL, isMax);
      var buyX = x + width - CONFIG.UI.BASE_BUY_WIDTH - 15;
      var buyY = y + height - CONFIG.UI.BASE_BUY_HEIGHT - 8;
      this.drawActionButton(ctx, buyX, buyY, CONFIG.UI.BASE_BUY_WIDTH, CONFIG.UI.BASE_BUY_HEIGHT, isMax ? CONFIG.TEXT.MAX_LEVEL : CONFIG.TEXT.BUY(price), canBuy, 19);
    },
    drawLevelSegments: function (ctx, x, y, width, level, maxLevel, isMax) {
      var gap = 4;
      var segmentW = Math.max(4, (width - gap * (maxLevel - 1)) / maxLevel);
      for (var i = 0; i < maxLevel; i++) {
        this.roundedRectPath(ctx, x + i * (segmentW + gap), y, segmentW, 8, 4);
        ctx.fillStyle = i < level ? isMax ? CONFIG.COLORS.BASE_PROGRESS_MAX : CONFIG.COLORS.BASE_PROGRESS_ON : CONFIG.COLORS.BASE_PROGRESS_BG;
        ctx.fill();
      }
    },
    drawBasePager: function (ctx, page, totalPages) {
      var y = CONFIG.UI.BASE_PAGER_Y;
      var cx = CONFIG.VIEW.WIDTH / 2;
      this.drawActionButton(ctx, cx - 190, y, CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT, CONFIG.TEXT.BASE_PREV, page > 0, 38);
      this.drawActionButton(ctx, cx + 108, y, CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT, CONFIG.TEXT.BASE_NEXT, page < totalPages - 1, 38);
      this.drawCenteredText(ctx, CONFIG.TEXT.BASE_PAGE(page + 1, totalPages), y + 30, 19, true, CONFIG.COLORS.HINT_TEXT);
    },
    drawGadgetDots: function (ctx, active, total) {
      var y = CONFIG.UI.BASE_PAGER_Y + 28;
      var gap = 28;
      var startX = CONFIG.VIEW.WIDTH / 2 - (total - 1) * gap / 2;
      for (var i = 0; i < total; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * gap, y, i === active ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = i === active ? CONFIG.COLORS.BASE_ACCENT : CONFIG.COLORS.BASE_PROGRESS_BG;
        ctx.fill();
      }
    },
    consumeBaseAction: function () {
      if (!Input.consumeTap(this.tapPoint)) return -2;
      var top = CONFIG.UI.TOP_INSET || 0;
      if (this.isPointInRect(this.tapPoint, CONFIG.UI.BASE_BACK_X, CONFIG.UI.BASE_BACK_Y + top, CONFIG.UI.BASE_BACK_WIDTH, CONFIG.UI.BASE_BACK_HEIGHT)) return -1;
      // Tab 切换：1001=角色强化，1002=道具强化
      var tabRects = this.getBaseTabRects(top);
      for (var t = 0; t < tabRects.length; t++) {
        if (this.isPointInRect(this.tapPoint, tabRects[t].x, tabRects[t].y, tabRects[t].w, tabRects[t].h)) return t === 0 ? 1001 : 1002;
      }
      if (this.baseTab === 'character') {
        var totalPages = Math.ceil(CONFIG.META.UPGRADES.length / CONFIG.UI.BASE_VISIBLE_ROWS);
        var pagerY = CONFIG.UI.BASE_PAGER_Y;
        var cx = CONFIG.VIEW.WIDTH / 2;
        if (this.isPointInRect(this.tapPoint, cx - 190, pagerY, CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT) && this.baseCharacterPage > 0) return 1010;
        if (this.isPointInRect(this.tapPoint, cx + 108, pagerY, CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT) && this.baseCharacterPage < totalPages - 1) return 1011;
        var first = this.baseCharacterPage * CONFIG.UI.BASE_VISIBLE_ROWS;
        var last = Math.min(CONFIG.META.UPGRADES.length, first + CONFIG.UI.BASE_VISIBLE_ROWS);
        for (var i = first; i < last; i++) {
          var rowIndex = i - first;
          var y = CONFIG.UI.BASE_LIST_Y + rowIndex * (CONFIG.UI.BASE_ROW_HEIGHT + CONFIG.UI.BASE_ROW_GAP);
          var x = CONFIG.UI.BASE_CARD_X + CONFIG.UI.BASE_CARD_WIDTH - CONFIG.UI.BASE_BUY_WIDTH - 15;
          var buttonY = y + CONFIG.UI.BASE_ROW_HEIGHT - CONFIG.UI.BASE_BUY_HEIGHT - 8;
          if (this.isPointInRect(this.tapPoint, x, buttonY, CONFIG.UI.BASE_BUY_WIDTH, CONFIG.UI.BASE_BUY_HEIGHT)) return i;
        }
      } else {
        // 道具页左右切换：1020=上一个，1021=下一个
        var ids = Object.keys(CONFIG.META.GADGET_UPGRADES);
        if (this.baseGadgetFilter === 'turret') ids = ids.filter(function (id) { return id.indexOf('turret_') === 0; });
        if (this.baseGadgetFilter === 'item') ids = ids.filter(function (id) { return ['laser','bomb','medkit','magnet','freeze'].indexOf(id) >= 0; });
        var headerY = CONFIG.UI.BASE_CONTENT_Y + (CONFIG.UI.BASE_SECTION_HEIGHT - CONFIG.UI.BASE_NAV_HEIGHT) / 2;
        if (this.isPointInRect(this.tapPoint, CONFIG.UI.BASE_CARD_X + 12, headerY, CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT) && this.baseGadgetIndex > 0) return 1020;
        if (this.isPointInRect(this.tapPoint, CONFIG.UI.BASE_CARD_X + CONFIG.UI.BASE_CARD_WIDTH - CONFIG.UI.BASE_NAV_WIDTH - 12, headerY, CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT) && this.baseGadgetIndex < ids.length - 1) return 1021;
        var gadgetId = ids[this.baseGadgetIndex];
        var items = CONFIG.META.GADGET_UPGRADES[gadgetId].items;
        for (var ii = 0; ii < items.length; ii++) {
          var rowY = CONFIG.UI.BASE_LIST_Y + ii * (CONFIG.UI.BASE_ROW_HEIGHT + CONFIG.UI.BASE_ROW_GAP);
          var buyX = CONFIG.UI.BASE_CARD_X + CONFIG.UI.BASE_CARD_WIDTH - CONFIG.UI.BASE_BUY_WIDTH - 15;
          var buyY = rowY + CONFIG.UI.BASE_ROW_HEIGHT - CONFIG.UI.BASE_BUY_HEIGHT - 8;
          if (this.isPointInRect(this.tapPoint, buyX, buyY, CONFIG.UI.BASE_BUY_WIDTH, CONFIG.UI.BASE_BUY_HEIGHT)) return 100 + this.baseGadgetIndex * 10 + ii;
        }
      }
      return -2;
    },
    // ---------- 离线收益弹窗 ----------
    drawOfflinePopup: function (ctx) {
      this.drawOverlay(ctx);
      var x = CONFIG.UI.POPUP_X,
        y = CONFIG.UI.POPUP_Y;
      var width = CONFIG.UI.POPUP_WIDTH,
        height = CONFIG.UI.POPUP_HEIGHT;
      this.roundedRectPath(ctx, x, y, width, height, 28);
      ctx.fillStyle = CONFIG.COLORS.POPUP_BACKGROUND;
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = CONFIG.COLORS.POPUP_BORDER;
      ctx.stroke();
      this.drawCenteredText(ctx, CONFIG.TEXT.OFFLINE_TITLE, y + 80, 49, true, CONFIG.COLORS.COIN);
      var rewardCoin = this.icon('menu_coin_gold') || this.icon('icon_coin_gold');
      if (rewardCoin) ctx.drawImage(rewardCoin, x + 116, y + 139, 54, 54);
      this.drawCenteredText(ctx, CONFIG.TEXT.OFFLINE_REWARD(Meta.pendingOfflineCoins), y + 170, 29, true, CONFIG.COLORS.TEXT);
      this.drawCenteredText(ctx, CONFIG.TEXT.OFFLINE_DETAIL(Meta.pendingOfflineMinutes, Math.round(Meta.getOfflineRate() * 10) / 10), y + 225, 20, false, CONFIG.COLORS.HINT_TEXT);
      this.drawCenteredText(ctx, CONFIG.TEXT.OFFLINE_CAP, y + 265, 18, false, CONFIG.COLORS.HINT_TEXT);
      var buttonY = y + 338;
      this.drawActionButton(ctx, x + 48, buttonY, CONFIG.UI.POPUP_BUTTON_WIDTH, CONFIG.UI.POPUP_BUTTON_HEIGHT, CONFIG.TEXT.CLAIM, true, 26);
      this.drawActionButton(ctx, x + width - CONFIG.UI.POPUP_BUTTON_WIDTH - 48, buttonY, CONFIG.UI.POPUP_BUTTON_WIDTH, CONFIG.UI.POPUP_BUTTON_HEIGHT, CONFIG.TEXT.CLAIM_DOUBLE, true, 26);
      this.drawCenteredText(ctx, CONFIG.TEXT.AD_TODO, y + 465, 18, false, CONFIG.COLORS.HINT_TEXT);
    },
    consumeOfflineChoice: function () {
      if (!Input.consumeTap(this.tapPoint)) return -1;
      var x = CONFIG.UI.POPUP_X,
        y = CONFIG.UI.POPUP_Y + 338;
      if (this.isPointInRect(this.tapPoint, x + 48, y, CONFIG.UI.POPUP_BUTTON_WIDTH, CONFIG.UI.POPUP_BUTTON_HEIGHT)) return 0;
      if (this.isPointInRect(this.tapPoint, x + CONFIG.UI.POPUP_WIDTH - CONFIG.UI.POPUP_BUTTON_WIDTH - 48, y, CONFIG.UI.POPUP_BUTTON_WIDTH, CONFIG.UI.POPUP_BUTTON_HEIGHT)) return 1;
      return -1;
    },
    // ---------- 通用按钮 ----------
    // 九宫格绘制按钮切图，保留金属四角，不因短按钮或窄按钮拉伸变形。
    drawNineSlice: function (ctx, image, x, y, width, height) {
      var sw = image.width || image.naturalWidth || 512;
      var sh = image.height || image.naturalHeight || 180;
      var sx = Math.min(74, Math.floor(sw * 0.22));
      var sy = Math.min(48, Math.floor(sh * 0.32));
      var dx = Math.min(sx, Math.max(12, Math.floor(width * 0.24)));
      var dy = Math.min(sy, Math.max(10, Math.floor(height * 0.30)));
      var scw = Math.max(1, sw - sx * 2), sch = Math.max(1, sh - sy * 2);
      var dcw = Math.max(1, width - dx * 2), dch = Math.max(1, height - dy * 2);
      ctx.drawImage(image, 0, 0, sx, sy, x, y, dx, dy);
      ctx.drawImage(image, sx, 0, scw, sy, x + dx, y, dcw, dy);
      ctx.drawImage(image, sw - sx, 0, sx, sy, x + width - dx, y, dx, dy);
      ctx.drawImage(image, 0, sy, sx, sch, x, y + dy, dx, dch);
      ctx.drawImage(image, sx, sy, scw, sch, x + dx, y + dy, dcw, dch);
      ctx.drawImage(image, sw - sx, sy, sx, sch, x + width - dx, y + dy, dx, dch);
      ctx.drawImage(image, 0, sh - sy, sx, sy, x, y + height - dy, dx, dy);
      ctx.drawImage(image, sx, sh - sy, scw, sy, x + dx, y + height - dy, dcw, dy);
      ctx.drawImage(image, sw - sx, sh - sy, sx, sy, x + width - dx, y + height - dy, dx, dy);
    },
    getButtonState: function (x, y, width, height, enabled) {
      if (!enabled) return 'disabled';
      var buttons = root.ButtonUI;
      var pressed = false;
      if (buttons && buttons.pressedTouches) buttons.pressedTouches.forEach(function (p) {
        if (p.x === x && p.y === y && p.w === width && p.h === height) pressed = true;
      });
      return pressed ? 'pressed' : 'normal';
    },
    drawButtonSkin: function (ctx, x, y, width, height, kind, state) {
      var image = this.icon('btn_' + kind + '_' + state);
      if (image) {
        ctx.save();
        if (state === 'disabled') ctx.globalAlpha = 0.72;
        this.drawNineSlice(ctx, image, x, y, width, height);
        ctx.restore();
        return true;
      }
      this.roundedRectPath(ctx, x, y, width, height, Math.min(18, height / 3));
      ctx.fillStyle = state === 'disabled' ? CONFIG.COLORS.BUTTON_DISABLED : kind === 'play' ? '#e89a24' : kind === 'supply' ? '#a77d20' : '#103a57';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = state === 'disabled' ? CONFIG.COLORS.META_CARD_BORDER : kind === 'play' || kind === 'supply' ? '#ffd47a' : CONFIG.COLORS.ACCENT;
      ctx.stroke();
      return false;
    },
    buttonTextColor: function (kind, enabled) {
      if (!enabled) return CONFIG.COLORS.BUTTON_DISABLED_TEXT;
      return kind === 'play' || kind === 'supply' ? '#172028' : '#f4fbff';
    },
    drawActionButton: function (ctx, x, y, width, height, label, enabled, size) {
      // 通用页面恢复为项目原本的 Canvas 按钮。
      // 主菜单横向切图只服务主菜单，不能缩放到返回/购买/暂停等任意尺寸。
      this.roundedRectPath(ctx, x, y, width, height, Math.min(22, height / 3));
      ctx.fillStyle = enabled ? CONFIG.COLORS.BUTTON : CONFIG.COLORS.BUTTON_DISABLED;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = enabled ? CONFIG.COLORS.BUTTON_BORDER : CONFIG.COLORS.META_CARD_BORDER;
      ctx.stroke();
      ctx.save();
      ctx.font = 'bold ' + size + 'px Arial, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = enabled ? CONFIG.COLORS.BUTTON_TEXT : CONFIG.COLORS.BUTTON_DISABLED_TEXT;
      ctx.fillText(label, x + width / 2, y + height / 2 + 1, width - 24);
      ctx.restore();
      root.ButtonUI.register(ctx, x, y, width, height, enabled);
    },
    // v014 main-menu 切图按钮：kind ∈ play/base/achievement/supply/history，state ∈ normal/pressed/disabled。
    // 用 UI.icon('btn_'+kind+'_'+state) 取切图；就绪则按目标尺寸 drawImage 拉伸绘制（源 512x180）；
    // 图未就绪/加载失败走 drawActionButton 矢量圆角兜底，绝不黑屏。文字 Canvas 居中叠加。
    drawMenuButton: function (ctx, x, y, width, height, label, kind, state, size) {
      var st = state || 'normal';
      var enabled = st !== 'disabled';
      if (st === 'normal') st = this.getButtonState(x, y, width, height, enabled);
      var img = this.icon('btn_' + kind + '_' + st);
      if (img) {
        ctx.save();
        if (st === 'disabled') ctx.globalAlpha = 0.55;
        this.drawNineSlice(ctx, img, x, y, width, height);
        ctx.restore();
      } else {
        this.drawButtonSkin(ctx, x, y, width, height, kind, st);
      }
      if (label) {
        ctx.save();
        ctx.font = 'bold ' + (size || 20) + 'px Arial, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 文字按 kind 映射：橙金/金底(play/supply)用深色近黑，蓝底(base/achievement)用白，history 浅灰；disabled 统一灰化。
        var KIND_TEXT = { play: '#1a2320', supply: '#1a2320', base: '#ffffff', achievement: '#ffffff', history: '#e8eef0' };
        ctx.fillStyle = enabled ? (KIND_TEXT[kind] || CONFIG.COLORS.BUTTON_TEXT) : CONFIG.COLORS.BUTTON_DISABLED_TEXT;
        ctx.fillText(label, x + width / 2, y + height / 2 + 1, width - 24);
        ctx.restore();
      }
      root.ButtonUI.register(ctx, x, y, width, height, enabled);
    },
    drawTwoLineButton: function (ctx, x, y, width, height, title, subtitle, enabled) {
      this.roundedRectPath(ctx, x, y, width, height, 20);
      ctx.fillStyle = enabled ? CONFIG.COLORS.BUTTON : CONFIG.COLORS.BUTTON_DISABLED;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = enabled ? CONFIG.COLORS.BUTTON_BORDER : CONFIG.COLORS.META_CARD_BORDER;
      ctx.stroke();
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = enabled ? CONFIG.COLORS.BUTTON_TEXT : CONFIG.COLORS.BUTTON_DISABLED_TEXT;
      ctx.font = 'bold 23px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillText(title, x + width / 2, y + (subtitle ? height * 0.36 : height / 2), width - 24);
      if (subtitle) {
        ctx.font = '16px Arial, "Microsoft YaHei", sans-serif';
        ctx.fillText(subtitle, x + width / 2, y + height * 0.70);
      }
      ctx.restore();
      root.ButtonUI.register(ctx, x, y, width, height, enabled);
    },
    // ---------- Toast ----------
    drawToast: function (ctx) {
      if (Meta.toastTimer <= 0 || !Meta.toastText) return;
      var toastY = CONFIG.VIEW.HEIGHT - 154;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Meta.toastTimer * 2);
      this.roundedRectPath(ctx, 125, toastY, 500, 72, 22);
      ctx.fillStyle = CONFIG.COLORS.POPUP_BACKGROUND;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = CONFIG.COLORS.MENU_ACCENT;
      ctx.stroke();
      ctx.font = 'bold 23px Arial, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CONFIG.COLORS.TEXT;
      ctx.fillText(Meta.toastText, CONFIG.VIEW.WIDTH / 2, toastY + 36);
      ctx.restore();
    },
    // ---------- 工具 ----------
    isPointInRect: function (point, x, y, width, height) {
      return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
    },
    formatDuration: function (milliseconds) {
      var totalSeconds = Math.ceil(Math.max(0, milliseconds) / 1000);
      var hours = Math.floor(totalSeconds / 3600);
      var minutes = Math.floor(totalSeconds % 3600 / 60);
      var seconds = totalSeconds % 60;
      var pad = function (v) {
        return v < 10 ? '0' + v : String(v);
      };
      return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
    },
    // ---------- 地面 ----------
    drawGround: function (ctx) {
      ctx.fillStyle = CONFIG.COLORS.GROUND;
      ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
      this.drawGrid(ctx);
      this.drawWorldBorder(ctx);
    },
    drawGrid: function (ctx) {
      var size = CONFIG.GRID.SIZE;
      var startX = Math.floor(Camera.x / size) * size;
      var endX = Camera.x + CONFIG.VIEW.WIDTH;
      var startY = Math.floor(Camera.y / size) * size;
      var endY = Camera.y + CONFIG.VIEW.HEIGHT;
      for (var x = startX; x <= endX; x += size) {
        var isMajor = Math.round(x / size) % CONFIG.GRID.MAJOR_EVERY === 0;
        this.drawGridLine(ctx, x - Camera.x, 0, x - Camera.x, CONFIG.VIEW.HEIGHT, isMajor);
      }
      for (var y = startY; y <= endY; y += size) {
        var isMajorY = Math.round(y / size) % CONFIG.GRID.MAJOR_EVERY === 0;
        this.drawGridLine(ctx, 0, y - Camera.y, CONFIG.VIEW.WIDTH, y - Camera.y, isMajorY);
      }
    },
    drawGridLine: function (ctx, x1, y1, x2, y2, isMajor) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = isMajor ? CONFIG.GRID.MAJOR_LINE_WIDTH : CONFIG.GRID.THIN_LINE_WIDTH;
      ctx.strokeStyle = isMajor ? CONFIG.COLORS.GRID_MAJOR : CONFIG.COLORS.GRID_THIN;
      ctx.stroke();
    },
    drawWorldBorder: function (ctx) {
      var bx = -Camera.x,
        by = -Camera.y;
      var bw = CONFIG.WORLD.WIDTH,
        bh = CONFIG.WORLD.HEIGHT;
      var ext = CONFIG.BOUNDARY.OUTSIDE_EXTEND;

      // 边界外延伸带：深色底 + 红色45°斜纹
      ctx.save();
      ctx.fillStyle = CONFIG.COLORS.BOUNDARY_OUTSIDE;
      ctx.fillRect(bx - ext, by - ext, bw + ext * 2, ext); // 上
      ctx.fillRect(bx - ext, by + bh, bw + ext * 2, ext); // 下
      ctx.fillRect(bx - ext, by, ext, bh); // 左
      ctx.fillRect(bx + bw, by, ext, bh); // 右
      // 斜纹（裁剪到延伸带）
      ctx.beginPath();
      ctx.rect(bx - ext, by - ext, bw + ext * 2, ext);
      ctx.rect(bx - ext, by + bh, bw + ext * 2, ext);
      ctx.rect(bx - ext, by, ext, bh);
      ctx.rect(bx + bw, by, ext, bh);
      ctx.clip();
      ctx.strokeStyle = CONFIG.COLORS.BOUNDARY_STRIPE;
      ctx.lineWidth = 3;
      var spacing = CONFIG.BOUNDARY.STRIPE_SPACING;
      ctx.beginPath();
      for (var s = -(bh + ext * 2); s < bw + ext * 2; s += spacing) {
        ctx.moveTo(bx - ext + s, by - ext - ext);
        ctx.lineTo(bx - ext + s + ext * 2, by - ext + bh + ext * 2);
      }
      ctx.stroke();
      ctx.restore();

      // 8px 橙红发光边框，亮度 2s 周期脉动(0.6~1.0)
      var pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin((root.Game ? root.Game.survivedSeconds : 0) * Math.PI / CONFIG.BOUNDARY.PULSE_PERIOD));
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.shadowColor = CONFIG.COLORS.BOUNDARY_BORDER_GLOW;
      ctx.shadowBlur = 12 * pulse;
      ctx.strokeStyle = CONFIG.COLORS.BOUNDARY_BORDER;
      ctx.lineWidth = CONFIG.BOUNDARY.BORDER_WIDTH;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.restore();
    },
    // #8 玩家贴近边界时屏幕四方向红色警告渐变
    drawBoundaryWarnings: function (ctx) {
      var W = CONFIG.VIEW.WIDTH,
        H = CONFIG.VIEW.HEIGHT;
      var wd = CONFIG.BOUNDARY.WARNING_DISTANCE,
        ww = CONFIG.BOUNDARY.WARNING_WIDTH;
      var dl = Player.x,
        dr = CONFIG.WORLD.WIDTH - Player.x;
      var dt = Player.y,
        db = CONFIG.WORLD.HEIGHT - Player.y;
      var sides = [{
        d: dl,
        g: [0, 0, ww, 0]
      }, {
        d: dr,
        g: [W, 0, W - ww, 0]
      }, {
        d: dt,
        g: [0, 0, 0, ww]
      }, {
        d: db,
        g: [0, H, 0, H - ww]
      }];
      for (var i = 0; i < 4; i++) {
        var s = sides[i];
        if (s.d >= wd) continue;
        var a = (1 - s.d / wd) * 0.5;
        ctx.save();
        var grd = ctx.createLinearGradient(s.g[0], s.g[1], s.g[2], s.g[3]);
        root.safeStop(grd, 0, 'rgba(255,30,30,' + a.toFixed(3) + ')');
        root.safeStop(grd, 1, 'rgba(255,30,30,0)');
        ctx.fillStyle = grd;
        if (i === 0) ctx.fillRect(0, 0, ww, H);else if (i === 1) ctx.fillRect(W - ww, 0, ww, H);else if (i === 2) ctx.fillRect(0, 0, W, ww);else ctx.fillRect(0, H - ww, W, ww);
        ctx.restore();
      }
    },
    // ---------- HUD ----------

    drawHpBar: function (ctx) {
      var x = CONFIG.UI.HP_BAR_X,
        y = CONFIG.UI.HP_BAR_Y;
      var width = CONFIG.UI.HP_BAR_WIDTH,
        height = CONFIG.UI.HP_BAR_HEIGHT;
      var ratio = Player.hp / Player.maxHp;
      this.drawBarBackground(ctx, x, y, width, height, CONFIG.UI.HP_BAR_RADIUS, CONFIG.COLORS.HP_BACKGROUND);
      this.drawBarFill(ctx, x, y, width, height, ratio, CONFIG.UI.HP_BAR_RADIUS, ratio <= 0.3 ? CONFIG.COLORS.HP_LOW : CONFIG.COLORS.HP_FILL);
      this.drawBarBorder(ctx, x, y, width, height, CONFIG.UI.HP_BAR_RADIUS, CONFIG.UI.HP_BAR_BORDER, CONFIG.COLORS.HP_BORDER);
      this.drawBarText(ctx, CONFIG.TEXT.HP + '  ' + Math.ceil(Player.hp) + ' / ' + Math.ceil(Player.maxHp), x + width / 2, y + height / 2, CONFIG.UI.HP_TEXT_SIZE);
      // v015 #107：护甲覆盖在生命条上沿；为零时保留灰色轨道。
      var armorMax = Math.max(Player.armorMax || 0, Player.upgradeShieldMax || 0, Player.shield || 0);
      var armorRatio = armorMax > 0 ? Player.shield / armorMax : 0;
      ctx.fillStyle = armorMax > 0 ? 'rgba(17,45,54,.92)' : 'rgba(70,76,78,.75)';
      ctx.fillRect(x, y - 9, width, 6);
      if (armorRatio > 0) { ctx.fillStyle = '#59d8f3'; ctx.fillRect(x, y - 9, width * Math.min(1, armorRatio), 6); }
      ctx.strokeStyle = armorMax > 0 ? '#9af2ff' : '#777'; ctx.lineWidth = 1; ctx.strokeRect(x, y - 9, width, 6);
    },
    drawExpBar: function (ctx) {
      var x = CONFIG.UI.EXP_BAR_X,
        y = CONFIG.UI.EXP_BAR_Y;
      var width = CONFIG.UI.EXP_BAR_WIDTH,
        height = CONFIG.UI.EXP_BAR_HEIGHT;
      var ratio = ExpLevelUp.need > 0 ? ExpLevelUp.exp / ExpLevelUp.need : 0;
      this.drawBarBackground(ctx, x, y, width, height, CONFIG.UI.EXP_BAR_RADIUS, CONFIG.COLORS.EXP_BACKGROUND);
      this.drawBarFill(ctx, x, y, width, height, ratio, CONFIG.UI.EXP_BAR_RADIUS, CONFIG.COLORS.EXP_FILL);
      this.drawBarBorder(ctx, x, y, width, height, CONFIG.UI.EXP_BAR_RADIUS, CONFIG.UI.EXP_BAR_BORDER, CONFIG.COLORS.EXP_BORDER);
      this.drawBarText(ctx, CONFIG.TEXT.EXP + '  ' + Math.round(ExpLevelUp.exp * 10) / 10 + ' / ' + ExpLevelUp.need, x + width / 2, y + height / 2, CONFIG.UI.EXP_TEXT_SIZE);
    },
    drawLevelBadge: function (ctx) {
      var x = CONFIG.UI.LEVEL_X,
        y = CONFIG.UI.LEVEL_Y;
      var width = CONFIG.UI.LEVEL_WIDTH,
        height = CONFIG.UI.LEVEL_HEIGHT;
      this.roundedRectPath(ctx, x, y, width, height, CONFIG.UI.LEVEL_RADIUS);
      ctx.fillStyle = CONFIG.COLORS.LEVEL_BACKGROUND;
      ctx.fill();
      ctx.lineWidth = CONFIG.UI.EXP_BAR_BORDER;
      ctx.strokeStyle = CONFIG.COLORS.LEVEL_BORDER;
      ctx.stroke();
      this.drawBarText(ctx, CONFIG.TEXT.LEVEL(ExpLevelUp.level), x + width / 2, y + height / 2, CONFIG.UI.LEVEL_TEXT_SIZE);
    },
    drawBarBackground: function (ctx, x, y, width, height, radius, color) {
      this.roundedRectPath(ctx, x, y, width, height, radius);
      ctx.fillStyle = color;
      ctx.fill();
    },
    drawBarFill: function (ctx, x, y, width, height, ratio, radius, color) {
      var fillWidth = Math.max(0, Math.min(width, width * ratio));
      if (fillWidth <= 0) return;
      this.roundedRectPath(ctx, x, y, fillWidth, height, radius);
      ctx.fillStyle = color;
      ctx.fill();
    },
    drawBarBorder: function (ctx, x, y, width, height, radius, lineWidth, color) {
      this.roundedRectPath(ctx, x, y, width, height, radius);
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.stroke();
    },
    drawBarText: function (ctx, text, x, y, size) {
      ctx.save();
      ctx.font = 'bold ' + size + 'px Arial, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CONFIG.COLORS.TEXT;
      ctx.shadowColor = CONFIG.COLORS.TEXT_SHADOW;
      ctx.shadowBlur = 4;
      ctx.fillText(text, x, y + 1);
      ctx.restore();
    },
    drawRunStats: function (ctx) {
      ctx.save();
      ctx.font = 'bold ' + CONFIG.UI.HUD_STATS_SIZE + 'px Arial, "Microsoft YaHei", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CONFIG.COLORS.TEXT;
      ctx.shadowColor = CONFIG.COLORS.TEXT_SHADOW;
      ctx.shadowBlur = 6;
      ctx.textAlign = 'left';
      ctx.fillText(CONFIG.TEXT.SURVIVAL_HUD(this.formatTime(Game.survivedSeconds)), CONFIG.UI.HP_BAR_X, CONFIG.UI.HUD_STATS_Y);
      ctx.textAlign = 'right';
      ctx.fillText(CONFIG.TEXT.KILLS_HUD(RunStats.kills), CONFIG.VIEW.WIDTH - CONFIG.UI.HP_BAR_X, CONFIG.UI.HUD_STATS_Y);
      ctx.fillStyle = CONFIG.COLORS.TEXT;
      if (CONFIG.WEAPONS.FIREARMS[root.WeaponProgress.selected]) {
        ctx.textAlign = 'right';
        var firearm = CONFIG.WEAPONS.FIREARMS[root.WeaponProgress.selected], icon = this.icon(firearm.ICON);
        if (icon) ctx.drawImage(icon, CONFIG.VIEW.WIDTH - CONFIG.UI.HP_BAR_X - 125, CONFIG.UI.HUD_STATS_Y + 21, 26, 26);
        ctx.fillText('弹药 ' + Math.max(0, Math.ceil(root.PulseGun.ammo)) + '/' + root.PulseGun.getMagazineSize(), CONFIG.VIEW.WIDTH - CONFIG.UI.HP_BAR_X, CONFIG.UI.HUD_STATS_Y + 34);
      }
      if (Player.reviveCharges > 0 && !Enemy.getActiveBoss()) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 18px Arial, "Microsoft YaHei", sans-serif';
        ctx.fillStyle = CONFIG.COLORS.META_MAX;
        ctx.fillText(CONFIG.TEXT.REVIVES_LEFT(Player.reviveCharges), CONFIG.VIEW.WIDTH / 2, CONFIG.UI.HUD_STATS_Y + 34);
      }
      ctx.restore();
    },
    // v014 #87 局内实时金币 HUD：coin_gold 图标 + 金色数字（RunStats.gold），
    // 拾取/购买时 0.2s 从旧值滚动到新值，拾取飘 "+N" 浮字；不遮挡波次/时间/小目标/复活。
    drawGoldHud: function (ctx) {
      var f = this._goldFx;
      if (!f) {
        f = this._goldFx = {
          shown: -1,
          from: 0,
          to: 0,
          start: 0,
          floatN: 0,
          floatStart: 0
        };
      }
      var nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      var target = RunStats.gold;
      if (f.shown < 0) {
        f.shown = f.from = f.to = target;
        f.start = nowMs;
      }
      if (target !== f.to) {
        if (target > f.to) {
          f.floatN = target - f.to;
          f.floatStart = nowMs;
        }
        f.from = f.shown;
        f.to = target;
        f.start = nowMs;
      }
      var durMs = CONFIG.SUPPLY.GOLD_ROLL * 1000;
      var k = Math.max(0, Math.min(1, (nowMs - f.start) / durMs));
      f.shown = Math.round(f.from + (f.to - f.from) * k);
      // v015 #100：紧靠暂停键左侧，并避开微信胶囊安全区。
      var x = CONFIG.UI.PAUSE_X - 16;
      var y = CONFIG.UI.PAUSE_Y + CONFIG.UI.PAUSE_SIZE / 2;
      var text = String(f.shown);
      ctx.save();
      ctx.font = 'bold 26px Arial, "Microsoft YaHei", sans-serif';
      var textW = ctx.measureText ? ctx.measureText(text).width : text.length * 12;
      var img = UI.icon('coin_gold');
      if (img) {
        var s = 26;
        ctx.drawImage(img, x - textW - 8 - s, y - s / 2 - 2, s, s);
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CONFIG.COLORS.COIN;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 0;
      var age = (nowMs - f.floatStart) / 1000;
      if (f.floatN > 0 && age < 0.6) {
        ctx.globalAlpha = Math.max(0, 1 - age / 0.6);
        ctx.fillStyle = CONFIG.COLORS.COIN;
        ctx.font = 'bold 18px Arial, "Microsoft YaHei", sans-serif';
        ctx.fillText('+' + f.floatN, x, y - 26 - age * 28);
      }
      ctx.restore();
    },    // v014 #95 双 BOSS 血条：≥2 只时屏幕顶部左右分栏、颜色不同（近战红橙/远程紫）、行为提示独立；
    // 单只 BOSS 保持原居中 0.8 宽红条布局不变。
    drawBossBar: function (ctx, panelY) {
      var activeBoss = Enemy.getActiveBoss();
      if (activeBoss) root.Field.bossMax = Math.max(root.Field.bossMax, activeBoss.maxHp);
      var bosses = Enemy.getActiveBosses();
      if (bosses.length === 0) return;
      var barH = CONFIG.BOSS.BAR_HEIGHT;
      var baseY = panelY === undefined ? CONFIG.BOSS.BAR_Y : panelY;
      var dual = bosses.length >= 2;
      var margin = 16;
      for (var i = 0; i < bosses.length; i++) {
        var boss = bosses[i];
        // 双 BOSS：左右分栏各 0.44 宽；单 BOSS：居中 0.8 宽。
        var barW, x;
        if (dual) {
          barW = Math.round(CONFIG.VIEW.WIDTH * 0.44);
          x = i === 0 ? margin : CONFIG.VIEW.WIDTH - margin - barW;
        } else {
          barW = Math.round(CONFIG.VIEW.WIDTH * 0.8);
          x = (CONFIG.VIEW.WIDTH - barW) / 2;
        }
        var y = baseY; // 双 BOSS 同一顶行左右并列，不再上下堆叠
        var name = boss.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED ? CONFIG.TEXT.BOSS_RANGED_NAME : CONFIG.TEXT.BOSS_MELEE_NAME;
        var ratio = boss.maxHp > 0 ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : 0;
        // 各自独立行为提示：近战 warn→冲锋预警；远程蓄力→蓄力射击。
        var hint = '';
        if (boss.typeIndex === CONFIG.ENEMY.TYPE_BOSS && boss.meleePhase === 'warn') hint = CONFIG.TEXT.BOSS_CHARGE_WARN;
        else if (boss.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED && !boss.isSummonTurret && boss.bossChargeTimer > 0) hint = CONFIG.TEXT.BOSS_CHARGING;
        // 名称：白色 14px 左对齐血条上方
        ctx.save();
        ctx.font = 'bold 14px Arial, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(name, x, y - 3);
        ctx.restore();
        // 行为提示（血条右端上方，颜色随 BOSS 类型）
        if (hint) {
          ctx.save();
          ctx.font = 'bold 12px Arial, "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = boss.typeIndex === CONFIG.ENEMY.TYPE_BOSS ? CONFIG.COLORS.BOSS_MELEE_BAR_A : CONFIG.COLORS.BOSS_RANGED_BAR_A;
          ctx.fillText(hint, x + barW, y - 3);
          ctx.restore();
        }
        // 背景：深色半透明 #1A1A2E alpha0.8
        ctx.save();
        ctx.globalAlpha = 0.8;
        this.roundedRectPath(ctx, x, y, barW, barH, 6);
        ctx.fillStyle = '#1A1A2E';
        ctx.fill();
        ctx.restore();
        // 血量：按 BOSS 类型配色（近战红橙/远程紫），裁剪到背景圆角内
        if (ratio > 0) {
          var ca = boss.typeIndex === CONFIG.ENEMY.TYPE_BOSS ? CONFIG.COLORS.BOSS_MELEE_BAR_A : CONFIG.COLORS.BOSS_RANGED_BAR_A;
          var cb = boss.typeIndex === CONFIG.ENEMY.TYPE_BOSS ? CONFIG.COLORS.BOSS_MELEE_BAR_B : CONFIG.COLORS.BOSS_RANGED_BAR_B;
          ctx.save();
          this.roundedRectPath(ctx, x, y, barW, barH, 6);
          ctx.clip();
          var grad = ctx.createLinearGradient(x, 0, x + barW, 0);
          root.safeStop(grad, 0, ca);
          root.safeStop(grad, 1, cb);
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, barW * ratio, barH);
          ctx.restore();
        }
        // 2px 白边框
        this.roundedRectPath(ctx, x, y, barW, barH, 6);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        // HP 数值：白色 12px 右对齐
        ctx.save();
        ctx.font = '12px Arial, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(Math.max(0, Math.ceil(boss.hp)) + ' / ' + boss.maxHp, x + barW - 8, y + barH / 2);
        ctx.restore();
      }
    },
    formatTime: function (seconds) {
      var safeSeconds = Math.max(0, seconds);
      var minutes = Math.floor(safeSeconds / 60);
      var remaining = safeSeconds - minutes * 60;
      var secondText = remaining < 10 ? '0' + remaining.toFixed(1) : remaining.toFixed(1);
      return minutes + ':' + secondText;
    },
    // ---------- 摇杆 ----------
    drawJoystick: function (ctx) {
      var joystick = Input.joystick;
      // 未触摸时：仅"始终显示摇杆"开启才淡显；WASD/方向键移动时不显示摇杆
      if (!joystick.active) {
        var kbMoving = Input.keys.KeyA || Input.keys.KeyD || Input.keys.KeyW || Input.keys.KeyS || Input.keys.ArrowLeft || Input.keys.ArrowRight || Input.keys.ArrowUp || Input.keys.ArrowDown;
        if (!root.Settings || !root.Settings.alwaysShowJoystick || kbMoving) return;
        // 固定在左下角淡显底座
        var bx = 120,
          by = CONFIG.VIEW.HEIGHT - 140;
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.beginPath();
        ctx.arc(bx, by, CONFIG.INPUT.JOYSTICK_BASE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.COLORS.JOYSTICK_BASE_INNER;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = CONFIG.COLORS.JOYSTICK_RING;
        ctx.stroke();
        ctx.restore();
        return;
      }
      var baseR = CONFIG.INPUT.JOYSTICK_BASE_RADIUS;
      ctx.save();
      // 底座外圈
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(joystick.originX, joystick.originY, baseR, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.COLORS.JOYSTICK_BASE_INNER;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = CONFIG.COLORS.JOYSTICK_BASE_OUTER;
      ctx.stroke();
      // 环形刻度
      ctx.lineWidth = 2;
      ctx.strokeStyle = CONFIG.COLORS.JOYSTICK_RING;
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(joystick.originX + Math.cos(a) * (baseR - 8), joystick.originY + Math.sin(a) * (baseR - 8));
        ctx.lineTo(joystick.originX + Math.cos(a) * (baseR - 2), joystick.originY + Math.sin(a) * (baseR - 2));
        ctx.stroke();
      }
      // 方向指示线（从底座中心到旋钮）
      ctx.lineWidth = 3;
      ctx.strokeStyle = CONFIG.COLORS.JOYSTICK_RING;
      ctx.beginPath();
      ctx.moveTo(joystick.originX, joystick.originY);
      ctx.lineTo(joystick.currentX, joystick.currentY);
      ctx.stroke();
      // 旋钮
      ctx.beginPath();
      ctx.arc(joystick.currentX, joystick.currentY, CONFIG.INPUT.JOYSTICK_KNOB_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.COLORS.JOYSTICK_KNOB;
      ctx.fill();
      ctx.lineWidth = CONFIG.INPUT.JOYSTICK_LINE_WIDTH;
      ctx.strokeStyle = CONFIG.COLORS.JOYSTICK_BORDER;
      ctx.stroke();
      ctx.restore();
    },
    // ---------- 结算 ----------
    drawGameOver: function (ctx) {
      this.drawSettlement(ctx, false);
    },
    drawVictory: function (ctx) {
      this.drawSettlement(ctx, true);
    },
    drawSettlement: function (ctx, isVictory) {
      var top = CONFIG.UI.TOP_INSET || 0;
      var exitType = Game.exitType || 'death';
      // 标题按结算来源区分：death=游戏结束 / quit=本局结算 / victory=胜利 / extract=撤退成功
      var title;
      if (isVictory || exitType === 'victory') title = CONFIG.TEXT.VICTORY;else if (exitType === 'quit') title = CONFIG.TEXT.SETTLEMENT_QUIT;else if (exitType === 'extract') title = CONFIG.TEXT.SETTLEMENT_EXTRACT;else title = CONFIG.TEXT.GAME_OVER;
      this.drawOverlay(ctx);
      this.drawCenteredText(ctx, title, CONFIG.UI.GAMEOVER_TITLE_Y + top, CONFIG.UI.GAMEOVER_TITLE_SIZE, true, CONFIG.COLORS.TEXT);
      var character = root.CharacterView;
      if(!this._resultPose)this._resultPose=character.makeState();
      this._resultPose.end=exitType==='death'?'death':exitType==='extract'||isVictory?'extract':'';
      character.draw(ctx, 96, CONFIG.UI.SETTLEMENT_START_Y + top + 40, CONFIG.CHARACTER.PREVIEW.END_SCALE, Player.runLook, this._resultPose);
      if (isVictory) {
        this.drawCenteredText(ctx, CONFIG.TEXT.VICTORY_SUBTITLE, CONFIG.UI.VICTORY_SUBTITLE_Y + top, CONFIG.UI.SETTLEMENT_TEXT_SIZE, false, CONFIG.COLORS.RARITY_EPIC);
      }
      this.drawCenteredText(ctx, CONFIG.TEXT.SETTLEMENT_TIME(this.formatTime(Game.survivedSeconds)), CONFIG.UI.SETTLEMENT_START_Y + top, CONFIG.UI.SETTLEMENT_TEXT_SIZE, false, CONFIG.COLORS.TEXT);
      this.drawCenteredText(ctx, CONFIG.TEXT.SETTLEMENT_KILLS(RunStats.kills), CONFIG.UI.SETTLEMENT_START_Y + CONFIG.UI.SETTLEMENT_LINE_GAP + top, CONFIG.UI.SETTLEMENT_TEXT_SIZE, false, CONFIG.COLORS.TEXT);
      this.drawCenteredText(ctx, CONFIG.TEXT.SETTLEMENT_LEVEL(ExpLevelUp.level), CONFIG.UI.SETTLEMENT_START_Y + CONFIG.UI.SETTLEMENT_LINE_GAP * 2 + top, CONFIG.UI.SETTLEMENT_TEXT_SIZE, false, CONFIG.COLORS.TEXT);
      // v012 #72：结算大数字展示本局拾取的局内金币（RunStats.gold，局末清零）；幸存者硬币仅撤离时入账。
      // v014 #88：撤离分支改为蓝银幸存者硬币主数字 + #73 公式分项构成（coin_survivor 图标）。
      if (exitType === 'extract') {
        this.drawExtractBreakdown(ctx, top);
      } else {
        this.drawCenteredText(ctx, CONFIG.TEXT.SETTLEMENT_COINS(RunStats.gold, false), CONFIG.UI.SETTLEMENT_START_Y + CONFIG.UI.SETTLEMENT_LINE_GAP * 3 + top, CONFIG.UI.SETTLEMENT_COIN_SIZE, true, CONFIG.COLORS.SETTLEMENT_COIN);
        this.drawCenteredText(ctx, CONFIG.TEXT.TOTAL_COINS(Meta.data.survivorCoins), CONFIG.UI.SETTLEMENT_START_Y + CONFIG.UI.SETTLEMENT_LINE_GAP * 4 + top, 28, false, CONFIG.COLORS.HINT_TEXT);
      }
      this.drawSettlementAdButtons(ctx, isVictory);
      var reportY = CONFIG.UI.SETTLEMENT_START_Y + CONFIG.UI.SETTLEMENT_LINE_GAP * 5 + top;
      if (exitType !== 'extract' && reportY + CONFIG.PRODUCT.REPORT_GAP * 2 < CONFIG.UI.SETTLEMENT_AD_Y) {
        // v014 #98 结算突出三项：本局进步点 / 贡献最大武器 / 下局可尝试（其余详细统计不占主界面）。
        var prog = Game.runProgress;
        var pWave = prog && prog.wave ? prog.wave : 0;
        var progressText = CONFIG.TEXT.PRODUCT.REACH_WAVE(pWave);
        if (prog && prog.newBestWave) progressText = CONFIG.TEXT.PRODUCT.PROGRESS_NEW_WAVE(pWave);
        else if (prog && prog.firstBoss) progressText = CONFIG.TEXT.PRODUCT.PROGRESS_FIRST_BOSS;
        this.drawCenteredText(ctx, CONFIG.TEXT.PRODUCT.PROGRESS + progressText, reportY, CONFIG.PRODUCT.REPORT_SIZE, true, CONFIG.COLORS.SURVIVOR_COIN || CONFIG.COLORS.COIN);
        this.drawCenteredText(ctx, CONFIG.TEXT.PRODUCT.CONTRIBUTION + RunStats.contribution(), reportY + CONFIG.PRODUCT.REPORT_GAP, CONFIG.PRODUCT.REPORT_SIZE, false, CONFIG.COLORS.COIN);
        this.drawCenteredText(ctx, CONFIG.TEXT.PRODUCT.NEXT + RunStats.nextGoal(), reportY + CONFIG.PRODUCT.REPORT_GAP * 2, CONFIG.PRODUCT.REPORT_SIZE, false, CONFIG.COLORS.HINT_TEXT);
      }
      this.drawRestartButton(ctx);
    },
    // v014 #88 撤离结算：蓝银幸存者硬币主数字 + #73 公式分项构成。
    // 数据全部现算自 RunStats/Spawner/ExpLevelUp（与 RunStats.extractionPreview 同源），不新增数据源。
    // 返回 { total, rows:[{label,source,amount}] }，分项 amount 之和严格 == total（向下取整后余数按小数大小分配）。
    extractCoinBreakdown: function () {
      var E = CONFIG.EXTRACTION;
      var wave = (root.Spawner && root.Spawner.waveIndex) || 0;
      var level = root.ExpLevelUp ? root.ExpLevelUp.level : 0;
      var gold = RunStats.gold || 0;
      var n = RunStats.killNormal || 0,
        e = RunStats.killElite || 0,
        b = RunStats.killBoss || 0,
        s = RunStats.killSpecial || 0;
      var rows = [
        { label: CONFIG.TEXT.EXTRACT_BREAKDOWN.WAVE, source: wave, raw: wave * E.WAVE },
        { label: CONFIG.TEXT.EXTRACT_BREAKDOWN.NORMAL, source: n, raw: n * E.NORMAL },
        { label: CONFIG.TEXT.EXTRACT_BREAKDOWN.ELITE, source: e, raw: e * E.ELITE },
        { label: CONFIG.TEXT.EXTRACT_BREAKDOWN.BOSS, source: b, raw: b * E.BOSS },
        { label: CONFIG.TEXT.EXTRACT_BREAKDOWN.SPECIAL, source: s, raw: s * E.SPECIAL },
        { label: CONFIG.TEXT.EXTRACT_BREAKDOWN.LEVEL, source: level, raw: level * E.LEVEL },
        { label: CONFIG.TEXT.EXTRACT_BREAKDOWN.GOLD, source: gold, raw: gold * E.GOLD }
      ];
      var rawSum = 0;
      for (var i = 0; i < rows.length; i++) rawSum += rows[i].raw;
      var total = Math.floor(rawSum);
      var allocated = 0;
      for (var j = 0; j < rows.length; j++) {
        rows[j].amount = Math.floor(rows[j].raw);
        allocated += rows[j].amount;
      }
      var remainder = total - allocated; // 0 <= remainder < rows.length
      var order = rows.map(function (r, idx) { return { idx: idx, frac: r.raw - Math.floor(r.raw) }; })
        .sort(function (a, b2) { return b2.frac - a.frac; });
      for (var k = 0; k < remainder; k++) rows[order[k].idx].amount += 1;
      return { total: total, rows: rows };
    },
    drawExtractBreakdown: function (ctx, top) {
      var data = this.extractCoinBreakdown();
      var startY = CONFIG.UI.SETTLEMENT_START_Y + CONFIG.UI.SETTLEMENT_LINE_GAP * 3 + top;
      // 主数字：蓝银色 + coin_survivor 图标（蓝银盾牌闪电，区别于金色局内金币 coin_gold）。
      var awardText = CONFIG.TEXT.EXTRACT_AWARD(RunStats.finalCoins || data.total);
      if (RunStats.extractAdClaimed) awardText += '（广告×' + CONFIG.EXTRACTION.AD_MULTIPLIER + '）';
      this.drawCenteredCoinText(ctx, awardText, startY, 38, CONFIG.COLORS.SURVIVOR_COIN);
      var rowStart = startY + 44,
        gap = 22;
      for (var i = 0; i < data.rows.length; i++) {
        var r = data.rows[i];
        this.drawCenteredText(ctx, r.label + ' ' + r.source + ' (+' + r.amount + ')', rowStart + i * gap, 18, false, CONFIG.COLORS.HINT_TEXT);
      }
      this.drawCenteredText(ctx, CONFIG.TEXT.EXTRACT_BREAKDOWN.TOTAL + ' ' + data.total, rowStart + data.rows.length * gap, 20, true, CONFIG.COLORS.SURVIVOR_COIN);
    },
    // 居中文字左侧配 coin_survivor 图标；图片未就绪时退回纯文字（矢量兜底）。
    drawCenteredCoinText: function (ctx, text, y, size, color) {
      ctx.save();
      ctx.font = 'bold ' + size + 'px Arial, "Microsoft YaHei", sans-serif';
      ctx.textBaseline = 'middle';
      var textW = ctx.measureText ? ctx.measureText(text).width : text.length * 12;
      var cx = CONFIG.VIEW.WIDTH / 2;
      var icon = UI.icon('coin_survivor');
      var iconSize = size,
        gap = 10;
      var totalW = icon ? textW + gap + iconSize : textW;
      var startX = cx - totalW / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = color;
      ctx.shadowColor = CONFIG.COLORS.TEXT_SHADOW;
      ctx.shadowBlur = 12;
      if (icon) ctx.drawImage(icon, startX, y - iconSize / 2, iconSize, iconSize);
      ctx.fillText(text, startX + (icon ? iconSize + gap : 0), y, CONFIG.VIEW.WIDTH - CONFIG.UI.HP_BAR_X * 2);
      ctx.restore();
    },
    drawSettlementAdButtons: function (ctx, isVictory) {
      var reviveRemaining = RunStats.getReviveRemaining();
      // 仅死亡结算(exitType==='death')且有复活次数才显示复活按钮；quit/victory/extract 不显示
      var showRevive = !isVictory && (Game.exitType || 'death') === 'death' && reviveRemaining > 0;
      // 撤退结算：显示"看广告四倍"（与死亡翻倍互斥）
      if (Game.exitType === 'extract') {
        var quadEnabled = RunStats.canExtractAdQuad();
        var qx = (CONFIG.VIEW.WIDTH - CONFIG.UI.SETTLEMENT_AD_WIDTH) / 2;
        this.drawTwoLineButton(ctx, qx, CONFIG.UI.SETTLEMENT_AD_Y, CONFIG.UI.SETTLEMENT_AD_WIDTH, CONFIG.UI.SETTLEMENT_AD_HEIGHT, quadEnabled ? CONFIG.TEXT.AD_EXTRACT_QUAD : CONFIG.TEXT.AD_EXTRACT_USED, quadEnabled ? CONFIG.TEXT.AD_EXTRACT_QUAD_HINT : '', quadEnabled);
        return;
      }
      var doubleEnabled = RunStats.canDoubleCoins();
      var doubleX = showRevive ? CONFIG.UI.SETTLEMENT_AD_RIGHT_X : (CONFIG.VIEW.WIDTH - CONFIG.UI.SETTLEMENT_AD_WIDTH) / 2;
      if (showRevive) {
        this.drawTwoLineButton(ctx, CONFIG.UI.SETTLEMENT_AD_LEFT_X, CONFIG.UI.SETTLEMENT_AD_Y, CONFIG.UI.SETTLEMENT_AD_WIDTH, CONFIG.UI.SETTLEMENT_AD_HEIGHT, CONFIG.TEXT.AD_REVIVE, CONFIG.TEXT.AD_REVIVE_COUNT(reviveRemaining), true);
      }
      this.drawTwoLineButton(ctx, doubleX, CONFIG.UI.SETTLEMENT_AD_Y, CONFIG.UI.SETTLEMENT_AD_WIDTH, CONFIG.UI.SETTLEMENT_AD_HEIGHT, doubleEnabled ? CONFIG.TEXT.AD_COIN_DOUBLE : CONFIG.TEXT.AD_COIN_DOUBLED, doubleEnabled ? CONFIG.TEXT.AD_COIN_DOUBLE_HINT : '', doubleEnabled);
    },
    drawOverlay: function (ctx) {
      ctx.save();
      ctx.globalAlpha = CONFIG.UI.OVERLAY_ALPHA;
      ctx.fillStyle = CONFIG.COLORS.OVERLAY;
      ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
      ctx.restore();
    },
    drawRestartButton: function (ctx) {
      var x = CONFIG.UI.RESTART_X,
        y = CONFIG.UI.RESTART_Y;
      var width = CONFIG.UI.RESTART_WIDTH,
        height = CONFIG.UI.RESTART_HEIGHT;
      this.drawActionButton(ctx, x, y, width, height, CONFIG.TEXT.ENTER_FATE, true, CONFIG.UI.RESTART_TEXT_SIZE);
      this.drawActionButton(ctx, 245, CONFIG.UI.RESTART_Y + 112, 260, 40, '跳过抽牌', true, 17);
    },
    consumeSettlementAction: function (isVictory) {
      if (Input.pendingTap.active && this.isPointInRect(Input.pendingTap, 245, CONFIG.UI.RESTART_Y + 112, 260, 40)) {
        Input.clearTap();
        return 4;
      }
      if (!Input.consumeTap(this.tapPoint)) return -1;
      if (this.isPointInRect(this.tapPoint, CONFIG.UI.RESTART_X, CONFIG.UI.RESTART_Y, CONFIG.UI.RESTART_WIDTH, CONFIG.UI.RESTART_HEIGHT)) return 0;
      // 撤退结算：看广告四倍按钮（居中）
      if (Game.exitType === 'extract') {
        var qx = (CONFIG.VIEW.WIDTH - CONFIG.UI.SETTLEMENT_AD_WIDTH) / 2;
        if (RunStats.canExtractAdQuad() && this.isPointInRect(this.tapPoint, qx, CONFIG.UI.SETTLEMENT_AD_Y, CONFIG.UI.SETTLEMENT_AD_WIDTH, CONFIG.UI.SETTLEMENT_AD_HEIGHT)) return 3;
        return -1;
      }
      var showRevive = !isVictory && (Game.exitType || 'death') === 'death' && RunStats.getReviveRemaining() > 0;
      if (showRevive && this.isPointInRect(this.tapPoint, CONFIG.UI.SETTLEMENT_AD_LEFT_X, CONFIG.UI.SETTLEMENT_AD_Y, CONFIG.UI.SETTLEMENT_AD_WIDTH, CONFIG.UI.SETTLEMENT_AD_HEIGHT)) return 1;
      var doubleX = showRevive ? CONFIG.UI.SETTLEMENT_AD_RIGHT_X : (CONFIG.VIEW.WIDTH - CONFIG.UI.SETTLEMENT_AD_WIDTH) / 2;
      if (RunStats.canDoubleCoins() && this.isPointInRect(this.tapPoint, doubleX, CONFIG.UI.SETTLEMENT_AD_Y, CONFIG.UI.SETTLEMENT_AD_WIDTH, CONFIG.UI.SETTLEMENT_AD_HEIGHT)) return 2;
      return -1;
    },
    // ---------- 升级三选一 ----------
    drawLevelUp: function (ctx) {
      var top = CONFIG.UI.TOP_INSET || 0;
      this.drawOverlay(ctx);
      this.drawCenteredText(ctx, CONFIG.TEXT.LEVEL_UP, CONFIG.UI.LEVELUP_TITLE_Y + top, CONFIG.UI.LEVELUP_TITLE_SIZE, true, CONFIG.COLORS.TEXT);
      this.drawCenteredText(ctx, CONFIG.TEXT.PRODUCT.PENDING(ExpLevelUp.pendingChoices), CONFIG.UI.LEVELUP_SUBTITLE_Y + top, CONFIG.UI.LEVELUP_SUBTITLE_SIZE, false, CONFIG.COLORS.HINT_TEXT);
      for (var i = 0; i < ExpLevelUp.offerCount; i++) {
        this.drawUpgradeCard(ctx, i, ExpLevelUp.offers[i]);
      }
      this.drawCenteredText(ctx, CONFIG.TEXT.CARD_HINT, CONFIG.UI.CARD_HINT_Y, CONFIG.UI.CARD_HINT_SIZE, false, CONFIG.COLORS.HINT_TEXT);
      var remaining = RunStats.getRefreshRemaining();
      var free = RunStats.freeRefreshUsed < CONFIG.PRODUCT.FREE_REFRESH;
      this.drawTwoLineButton(ctx, CONFIG.UI.LEVEL_REFRESH_X, CONFIG.UI.LEVEL_REFRESH_Y, CONFIG.UI.LEVEL_REFRESH_WIDTH, CONFIG.UI.LEVEL_REFRESH_HEIGHT, free ? CONFIG.TEXT.PRODUCT.FREE_REFRESH : remaining > 0 ? CONFIG.TEXT.AD_REFRESH : CONFIG.TEXT.AD_REFRESH_USED_UP, CONFIG.TEXT.AD_REFRESH_COUNT(remaining), free || remaining > 0);
      if (root.DevConsole.active && ExpLevelUp.pendingChoices >= 10) this.drawActionButton(ctx, 245, this.getSkipLevelY(), 260, 58, '跳过剩余升级', true, 19);
    },
    drawUpgradeCard: function (ctx, index, offer) {
      var x = CONFIG.UI.CARD_X;
      var y = CONFIG.UI.CARD_START_Y + index * (CONFIG.UI.CARD_HEIGHT + CONFIG.UI.CARD_GAP);
      var width = CONFIG.UI.CARD_WIDTH,
        height = CONFIG.UI.CARD_HEIGHT;
      var rarityId = offer.rarity.ID;
      // #84 五档：白/蓝/紫/金(LEGENDARY)/彩(RAINBOW)。LEGENDARY 纯金，RAINBOW 彩虹炫彩。
      var isRainbow = rarityId === 'RAINBOW';
      var rarityColor = rarityId === 'COMMON' ? CONFIG.COLORS.CARD_COMMON_BORDER : CONFIG.COLORS[offer.rarity.COLOR_KEY];
      var cardBackground = rarityId === 'LEGENDARY' ? CONFIG.COLORS.CARD_GOLD_BG : isRainbow ? CONFIG.COLORS.CARD_RAINBOW_BG : rarityId === 'EPIC' ? CONFIG.COLORS.CARD_EPIC_BG : rarityId === 'RARE' ? CONFIG.COLORS.CARD_RARE_BG : CONFIG.COLORS.CARD_COMMON_BG;
      var textDefinition = CONFIG.TEXT.UPGRADES[offer.definition.TEXT_KEY];
      ctx.save();
      // 先画不带阴影的不透明深色卡底，防止微信真机把浅色阴影铺进卡片内部。
      this.roundedRectPath(ctx, x, y, width, height, CONFIG.UI.CARD_RADIUS);
      ctx.fillStyle = cardBackground;
      ctx.fill();
      // 稀有度只用于边框与轻量外发光；普通卡完全不发光。
      var phase = Date.now() % 2000 / 2000 * 360;
      var rainbow = null;
      if (isRainbow) {
        rainbow = ctx.createLinearGradient(x, y, x + width, y + height);
        root.safeStop(rainbow, 0, 'hsl(' + phase + ',95%,62%)');
        root.safeStop(rainbow, 0.5, 'hsl(' + (phase + 120) % 360 + ',95%,62%)');
        root.safeStop(rainbow, 1, 'hsl(' + (phase + 240) % 360 + ',95%,62%)');
      }
      // 微信 iOS Canvas 对大矩形 shadowBlur 存在驱动兼容问题：部分机型会卡面发白，
      // 随后 GPU 合成线程停滞。品质效果只使用描边，不对整张卡启用阴影。
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.lineWidth = rarityId === 'COMMON' || rarityId === 'RARE' ? 2 : 3;
      ctx.strokeStyle = rainbow || rarityColor;
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (rarityId === 'EPIC' || rarityId === 'LEGENDARY' || isRainbow) {
        this.roundedRectPath(ctx, x + 7, y + 7, width - 14, height - 14, CONFIG.UI.CARD_RADIUS - 5);
        ctx.globalAlpha = rarityId === 'EPIC' ? 0.5 : 0.78;
        ctx.lineWidth = 1;
        ctx.strokeStyle = rainbow || rarityColor;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // 左侧短色条强化稀有度识别，但不影响正文对比度。
      ctx.fillStyle = rainbow || rarityColor;
      ctx.fillRect(x + 18, y + 24, 7, height - 48);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = 'bold ' + CONFIG.UI.CARD_NAME_SIZE + 'px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillStyle = isRainbow ? rainbow : rarityId === 'EPIC' || rarityId === 'LEGENDARY' ? rarityColor : CONFIG.COLORS.CARD_TITLE;
      ctx.fillText(textDefinition.NAME, x + CONFIG.UI.CARD_NAME_X_OFFSET, y + CONFIG.UI.CARD_NAME_Y_OFFSET);
      ctx.font = 'bold ' + CONFIG.UI.CARD_RARITY_SIZE + 'px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillStyle = rainbow || rarityColor;
      // #84 品质名以五档为准（白/蓝/紫/金/彩）：优先 camp.js 注入的 QUALITY 名称，回退 CONFIG.TEXT.RARITY。
      var qKey = rarityId === 'COMMON' ? 'WHITE' : rarityId === 'RARE' ? 'BLUE' : rarityId === 'EPIC' ? 'PURPLE' : rarityId === 'LEGENDARY' ? 'GOLD' : 'RAINBOW';
      var qualityLabel = (root.CONFIG.QUALITY && root.CONFIG.QUALITY[qKey] && root.CONFIG.QUALITY[qKey].name) || (CONFIG.TEXT.RARITY && CONFIG.TEXT.RARITY[rarityId]) || '';
      ctx.fillText(qualityLabel, x + CONFIG.UI.CARD_NAME_X_OFFSET, y + CONFIG.UI.CARD_RARITY_Y_OFFSET);
      ctx.textAlign = 'right';
      ctx.fillText(CONFIG.TEXT.PRODUCT.STACK(offer.level, offer.definition.MAX_LEVEL), x + width - CONFIG.UI.CARD_LEVEL_RIGHT_OFFSET, y + CONFIG.UI.CARD_RARITY_Y_OFFSET);
      ctx.textAlign = 'left';
      ctx.font = CONFIG.UI.CARD_DESC_SIZE + 'px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillStyle = CONFIG.COLORS.CARD_DESC;
      ctx.fillText(offer.description, x + CONFIG.UI.CARD_NAME_X_OFFSET, y + CONFIG.UI.CARD_DESC_Y_OFFSET);
      // #91 关键数值前后对比（如 3 → 4）高亮显示。
      var previewText = ExpLevelUp.previewOffer(offer);
      if (previewText) {
        ctx.font = 'bold ' + CONFIG.PRODUCT.PREVIEW_SIZE + 'px Arial, "Microsoft YaHei", sans-serif';
        ctx.fillStyle = CONFIG.COLORS.BADGE_GOLD;
        ctx.textAlign = 'left';
        ctx.fillText(previewText, x + CONFIG.UI.CARD_NAME_X_OFFSET, y + height - 56, width - CONFIG.UI.CARD_NAME_X_OFFSET * 2);
      }
      // #91 搭配提示 + 已拥有关联（灰色小字一行）。
      var cardHint = this.cardHintLine(offer);
      if (cardHint) {
        ctx.font = '17px Arial, "Microsoft YaHei", sans-serif';
        ctx.fillStyle = CONFIG.COLORS.HINT_TEXT;
        ctx.textAlign = 'left';
        ctx.fillText(cardHint, x + CONFIG.UI.CARD_NAME_X_OFFSET, y + height - 18, width - CONFIG.UI.CARD_NAME_X_OFFSET * 2);
      }
      if (isRainbow) {
        for (var p = 0; p < 6; p++) {
          var px = x + 16 + (p * 113 + Date.now() / 20) % (width - 32);
          var py = y + (p % 2 ? 18 : height - 18);
          ctx.fillStyle = 'hsl(' + (phase + p * 55) % 360 + ',95%,70%)';
          ctx.fillRect(px, py, 4, 4);
        }
      }
      ctx.restore();
      root.ButtonUI.register(ctx, CONFIG.UI.CARD_X, CONFIG.UI.CARD_START_Y + index * (CONFIG.UI.CARD_HEIGHT + CONFIG.UI.CARD_GAP), CONFIG.UI.CARD_WIDTH, CONFIG.UI.CARD_HEIGHT, true);
    },
    // #91 卡片底部一行：已拥有的关联词条名（灰色）+ 搭配提示/路线。
    cardHintLine: function (offer) {
      var def = offer.definition;
      var owned = [];
      if (def.related) for (var r = 0; r < def.related.length; r++) {
        var rid = def.related[r];
        if (ExpLevelUp.levels[rid] > 0) owned.push(this.perkNameById(rid));
      }
      var parts = [];
      if (owned.length) parts.push('已拥有：' + owned.join('、'));
      if (def.synergy) parts.push(def.synergy);
      return parts.join(' · ');
    },
    perkNameById: function (id) {
      for (var i = 0; i < CONFIG.UPGRADES.DEFINITIONS.length; i++) {
        var d = CONFIG.UPGRADES.DEFINITIONS[i];
        if (d.ID === id) {
          var t = CONFIG.TEXT.UPGRADES[d.TEXT_KEY];
          return t && t.NAME ? t.NAME : id;
        }
      }
      return id;
    },
    // #92 核心词条首次横幅：屏幕中上方短横幅，Meta.perkBannerTimer 自动淡出，不暂停。
    drawPerkBanner: function (ctx) {
      if (Meta.perkBannerTimer <= 0 || !Meta.perkBannerText) return;
      var top = CONFIG.UI.TOP_INSET || 0;
      var bw = 620, bh = 76, bx = (CONFIG.VIEW.WIDTH - bw) / 2, by = 96 + top;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Meta.perkBannerTimer * 2);
      this.roundedRectPath(ctx, bx, by, bw, bh, 22);
      ctx.fillStyle = CONFIG.COLORS.PANEL_BG;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = CONFIG.COLORS.BADGE_GOLD;
      ctx.stroke();
      ctx.font = 'bold 24px Arial, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CONFIG.COLORS.TEXT;
      ctx.fillText(Meta.perkBannerText, CONFIG.VIEW.WIDTH / 2, by + bh / 2, bw - 40);
      ctx.restore();
    },
    consumeLevelUpAction: function (offerCount) {
      if (!Input.consumeTap(this.tapPoint)) return -1;
      if ((RunStats.freeRefreshUsed < CONFIG.PRODUCT.FREE_REFRESH || RunStats.getRefreshRemaining() > 0) && this.isPointInRect(this.tapPoint, CONFIG.UI.LEVEL_REFRESH_X, CONFIG.UI.LEVEL_REFRESH_Y, CONFIG.UI.LEVEL_REFRESH_WIDTH, CONFIG.UI.LEVEL_REFRESH_HEIGHT)) return -2;
      if (this.tapPoint.x < CONFIG.UI.CARD_X || this.tapPoint.x > CONFIG.UI.CARD_X + CONFIG.UI.CARD_WIDTH) return -1;
      for (var i = 0; i < offerCount; i++) {
        var y = CONFIG.UI.CARD_START_Y + i * (CONFIG.UI.CARD_HEIGHT + CONFIG.UI.CARD_GAP);
        if (this.tapPoint.y >= y && this.tapPoint.y <= y + CONFIG.UI.CARD_HEIGHT) return i;
      }
      return -1;
    },
    // ---------- 居中文字 ----------
    drawCenteredText: function (ctx, text, y, size, bold, color) {
      ctx.save();
      ctx.font = (bold ? 'bold ' : '') + size + 'px Arial, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.shadowColor = CONFIG.COLORS.TEXT_SHADOW;
      ctx.shadowBlur = 12;
      ctx.fillText(text, CONFIG.VIEW.WIDTH / 2, y, CONFIG.VIEW.WIDTH - CONFIG.UI.HP_BAR_X * 2);
      ctx.restore();
    },
    // ---------- 道具按钮 ----------

    getPowerUpButtonY: function (typeIndex) {
      return CONFIG.VIEW.HEIGHT - CONFIG.UI.POWERUP_BUTTON_BOTTOM - CONFIG.UI.POWERUP_BUTTON_HEIGHT - typeIndex * (CONFIG.UI.POWERUP_BUTTON_HEIGHT + CONFIG.UI.POWERUP_BUTTON_GAP);
    },
    drawPowerUpIcon: function (ctx, typeIndex, x, y, size) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (typeIndex === CONFIG.POWERUPS.TYPE_BOMB) {
        ctx.beginPath();
        ctx.arc(x, y + size * 0.08, size * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.COLORS.ITEM_BOMB;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + size * 0.28, y - size * 0.38);
        ctx.lineTo(x + size * 0.62, y - size * 0.72);
        ctx.lineWidth = size * 0.16;
        ctx.strokeStyle = CONFIG.COLORS.COIN;
        ctx.stroke();
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_MAGNET) {
        ctx.beginPath();
        ctx.arc(x, y, size * 0.58, 0, Math.PI);
        ctx.lineWidth = size * 0.34;
        ctx.strokeStyle = CONFIG.COLORS.ITEM_MAGNET;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - size * 0.58, y);
        ctx.lineTo(x - size * 0.58, y - size * 0.42);
        ctx.moveTo(x + size * 0.58, y);
        ctx.lineTo(x + size * 0.58, y - size * 0.42);
        ctx.strokeStyle = CONFIG.COLORS.ITEM_MAGNET_TIP;
        ctx.stroke();
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_MEDKIT) {
        ctx.fillStyle = CONFIG.COLORS.ITEM_MEDKIT;
        ctx.fillRect(x - size * 0.62, y - size * 0.5, size * 1.24, size);
        ctx.fillStyle = CONFIG.COLORS.TEXT;
        ctx.fillRect(x - size * 0.13, y - size * 0.38, size * 0.26, size * 0.76);
        ctx.fillRect(x - size * 0.4, y - size * 0.12, size * 0.8, size * 0.24);
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_FREEZE) {
        ctx.strokeStyle = CONFIG.COLORS.ITEM_FREEZE;
        ctx.lineWidth = size * 0.13;
        for (var i = 0; i < 3; i++) {
          var angle = i * Math.PI / 3;
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(angle) * size * 0.62, y - Math.sin(angle) * size * 0.62);
          ctx.lineTo(x + Math.cos(angle) * size * 0.62, y + Math.sin(angle) * size * 0.62);
          ctx.stroke();
        }
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_LASER_EMITTER) {
        // 定向激光：从中心发出的射线 + 亮芯
        ctx.strokeStyle = CONFIG.COLORS.LASER_EMITTER_BEAM;
        ctx.lineWidth = size * 0.22;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.5, y + size * 0.5);
        ctx.lineTo(x + size * 0.55, y - size * 0.55);
        ctx.stroke();
        ctx.fillStyle = CONFIG.COLORS.LASER_EMITTER_CORE;
        ctx.beginPath();
        ctx.arc(x - size * 0.5, y + size * 0.5, size * 0.18, 0, Math.PI * 2);
        ctx.fill();
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_MORTAR) {
        // 迫击炮：炮弹 + 抛物线
        ctx.fillStyle = CONFIG.COLORS.ITEM_MORTAR;
        ctx.beginPath();
        ctx.arc(x + size * 0.4, y - size * 0.3, size * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = CONFIG.COLORS.HINT_TEXT;
        ctx.lineWidth = size * 0.08;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.5, y + size * 0.5);
        ctx.quadraticCurveTo(x, y - size * 0.85, x + size * 0.4, y - size * 0.3);
        ctx.stroke();
      }
      ctx.restore();
    },
    // ---------- 冲刺按钮 ----------

    drawDashButton: function (ctx) {
      if (!root.Player) return;
      var cx = this.mirrorX(CONFIG.UI.DASH_BUTTON_X);
      var cy = this.getDashButtonY();
      var r = CONFIG.UI.DASH_BUTTON_RADIUS;
      var ready = Player.canDash();
      var scale = 1;
      if (root.ButtonUI) {
        root.ButtonUI.pressedTouches.forEach(function (p) {
          if (p.x === cx - r && p.y === cy - r) scale = 0.9;
        });
      }
      if (ready && Player.dashReadyFlash > 0) {
        var f = 1 - Player.dashReadyFlash / CONFIG.PLAYER.DASH_READY_FLASH; // 0→1
        scale = 1 + 0.12 * Math.sin(f * Math.PI);
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      // 就绪：电蓝发光边框
      if (ready) {
        ctx.beginPath();
        ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(63, 208, 229, 0.95)';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#3FD0E5';
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      var img = UI.icon('btn_dash');
      if (img) {
        if (!ready) ctx.globalAlpha = 0.45; // 冷却置灰
        ctx.drawImage(img, -r, -r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      } else {
        // 兜底：深蓝底圆 + 闪电
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = ready ? '#0A1628' : '#1a2735';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = ready ? '#3FD0E5' : '#4a6072';
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(7, -r * 0.52);
        ctx.lineTo(-7, r * 0.02);
        ctx.lineTo(-1, r * 0.02);
        ctx.lineTo(-7, r * 0.55);
        ctx.lineTo(7, -r * 0.08);
        ctx.lineTo(1, -r * 0.08);
        ctx.closePath();
        ctx.globalAlpha = ready ? 1 : 0.55;
        ctx.fillStyle = ready ? '#3FD0E5' : '#8fa6b8';
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // 冷却倒计时（向上取整秒）
      if (!ready && Player.dashCooldown > 0) {
        var n = Math.ceil(Player.dashCooldown);
        ctx.font = 'bold 28px Arial, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeText(String(n), 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(String(n), 0, 0);
      }
      ctx.restore();
    },
    // #56 暂停按钮：固定右上角（微信胶囊下方），52×52，双竖条图标
    drawPauseButton: function (ctx) {
      var x = CONFIG.UI.PAUSE_X,
        y = CONFIG.UI.PAUSE_Y,
        s = CONFIG.UI.PAUSE_SIZE;
      ctx.save();
      this.roundedRectPath(ctx, x, y, s, s, 12);
      ctx.fillStyle = CONFIG.COLORS.PANEL_BG;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = CONFIG.COLORS.ACCENT;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
      // 双竖条
      ctx.fillStyle = CONFIG.COLORS.ACCENT;
      var bw = s * 0.16,
        bh = s * 0.42,
        cx = x + s / 2;
      ctx.fillRect(cx - s * 0.18 - bw / 2, y + (s - bh) / 2, bw, bh);
      ctx.fillRect(cx + s * 0.18 - bw / 2, y + (s - bh) / 2, bw, bh);
      ctx.restore();
    },
    consumePauseButton: function () {
      if (!Input.pendingTap.active) return false;
      var x = CONFIG.UI.PAUSE_X,
        y = CONFIG.UI.PAUSE_Y,
        s = CONFIG.UI.PAUSE_SIZE;
      // 点击热区适当放大
      var pad = 10;
      if (Input.pendingTap.x < x - pad || Input.pendingTap.x > x + s + pad || Input.pendingTap.y < y - pad || Input.pendingTap.y > y + s + pad) return false;
      Input.pendingTap.active = false;
      return true;
    },
    consumeDashButton: function () {
      if (!Input.pendingTap.active) return false;
      var dx = Input.pendingTap.x - this.mirrorX(CONFIG.UI.DASH_BUTTON_X);
      var dy = Input.pendingTap.y - this.getDashButtonY();
      var r = CONFIG.UI.DASH_BUTTON_RADIUS;
      if (dx * dx + dy * dy > r * r) return false;
      Input.pendingTap.active = false;
      return true;
    },
    // ---------- 撤退点按钮 ----------
    getExtractionActivateRect: function () {
      var w = 150,
        h = 50;
      var dashX = this.mirrorX(CONFIG.UI.DASH_BUTTON_X);
      var direction = root.Settings && root.Settings.mirror ? 1 : -1;
      var cx = dashX + direction * (CONFIG.UI.DASH_BUTTON_RADIUS + 12 + w / 2);
      var cy = this.getDashButtonY();
      return {
        x: cx - w / 2,
        y: cy - h / 2,
        w: w,
        h: h
      };
    },
    getExtractionConfirmRect: function () {
      var w = 300,
        h = 80;
      return {
        x: (CONFIG.VIEW.WIDTH - w) / 2,
        y: CONFIG.VIEW.HEIGHT * 0.6,
        w: w,
        h: h
      };
    },
    drawExtractionButtons: function (ctx) {
      var ext = root.Extraction;
      if (!ext) return;
      if (ext.state === 'inactive' && ext.playerInZone) {
        var a = this.getExtractionActivateRect();
        this.drawActionButton(ctx, a.x, a.y, a.w, a.h, CONFIG.TEXT.EXTRACTION_ACTIVATE, true, 20);
      } else if (ext.state === 'extractable' && ext.playerInZone) {
        var c = this.getExtractionConfirmRect();
        this.drawActionButton(ctx, c.x, c.y, c.w, c.h, CONFIG.TEXT.EXTRACTION_EXTRACT, true, 30);
        // v014 #97 撤离界面左右对比：左=现在撤离预计，右=继续挑战下一波预计（#73 预览同源）。
        var nowTxt = CONFIG.TEXT.PRODUCT.EXTRACT_NOW(RunStats.extractionPreview());
        var nextTxt = CONFIG.TEXT.PRODUCT.CONTINUE_NEXT(RunStats.extractContinueEstimate());
        var promptY = c.y - CONFIG.PRODUCT.REPORT_GAP * 2;
        ctx.save();
        ctx.font = 'bold ' + CONFIG.PRODUCT.REPORT_SIZE + 'px Arial, "Microsoft YaHei", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillStyle = CONFIG.COLORS.COIN;
        ctx.fillText(nowTxt, 24, promptY);
        ctx.textAlign = 'right';
        ctx.fillStyle = CONFIG.COLORS.HINT_TEXT;
        ctx.fillText(nextTxt, CONFIG.VIEW.WIDTH - 24, promptY);
        ctx.restore();
      }
    },
    consumeExtractionAction: function () {
      var ext = root.Extraction;
      if (!ext) return 0;
      // 先查看点击位置，只有真正命中撤退按钮时才消费。
      // 否则把点击留给右下角道具按钮，避免所有道具点击被提前吃掉。
      if (!Input.pendingTap.active) return 0;
      this.tapPoint.x = Input.pendingTap.x;
      this.tapPoint.y = Input.pendingTap.y;
      if (ext.state === 'inactive' && ext.playerInZone) {
        var a = this.getExtractionActivateRect();
        if (this.isPointInRect(this.tapPoint, a.x, a.y, a.w, a.h)) {
          Input.clearTap();
          ext.startActivation();
          return 1;
        }
      }
      if (ext.state === 'extractable' && ext.playerInZone) {
        var c = this.getExtractionConfirmRect();
        if (this.isPointInRect(this.tapPoint, c.x, c.y, c.w, c.h)) {
          Input.clearTap();
          ext.startExtraction();
          return 2;
        }
      }
      return 0;
    },
    // 冲刺速度线（屏幕边缘放射短线）
    drawDashSpeedLines: function (ctx) {
      if (!Player.dashing) return;
      var cx = CONFIG.VIEW.WIDTH / 2,
        cy = CONFIG.VIEW.HEIGHT / 2;
      var frac = Math.max(0, Player.dashTimer / CONFIG.PLAYER.DASH_DURATION);
      ctx.save();
      ctx.strokeStyle = CONFIG.COLORS.DASH_SPEEDLINE;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (var i = 0; i < 14; i++) {
        var ang = i / 14 * Math.PI * 2 + i % 2 * 0.1;
        var len = 30 + i * 37 % 30;
        var inner = 120;
        ctx.globalAlpha = 0.5 * frac;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
        ctx.lineTo(cx + Math.cos(ang) * (inner + len), cy + Math.sin(ang) * (inner + len));
        ctx.stroke();
      }
      ctx.restore();
    },
    drawDashDirectionArrow: function (ctx) {
      if (!Player.dashing || Player.dashArrowTimer <= 0) return;
      var sx = Player.x - Camera.x,
        sy = Player.y - Camera.y;
      var len = CONFIG.PLAYER.DASH_ARROW_LENGTH;
      var ex = sx + Player.dashDirX * len,
        ey = sy + Player.dashDirY * len;
      ctx.save();
      ctx.globalAlpha = Player.dashArrowTimer / CONFIG.PLAYER.DASH_ARROW_TIME;
      ctx.strokeStyle = CONFIG.PLAYER.DASH_ARROW_COLOR;
      ctx.fillStyle = CONFIG.PLAYER.DASH_ARROW_COLOR;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      var a = Math.atan2(Player.dashDirY, Player.dashDirX);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(a - 0.6) * 10, ey - Math.sin(a - 0.6) * 10);
      ctx.lineTo(ex - Math.cos(a + 0.6) * 10, ey - Math.sin(a + 0.6) * 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    // ---------- 圆角矩形 ----------
    roundedRectPath: function (ctx, x, y, width, height, radius) {
      var safeRadius = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + safeRadius, y);
      ctx.lineTo(x + width - safeRadius, y);
      ctx.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
      ctx.lineTo(x + width, y + height - safeRadius);
      ctx.arcTo(x + width, y + height, x + width - safeRadius, y + height, safeRadius);
      ctx.lineTo(x + safeRadius, y + height);
      ctx.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
      ctx.lineTo(x, y + safeRadius);
      ctx.arcTo(x, y, x + safeRadius, y, safeRadius);
      ctx.closePath();
    },
    // 统一弹窗外框：只绘制遮罩、面板、标题栏与底部操作栏；内容调用方必须自行裁剪在 body 区内。
    drawModalChrome: function (ctx, rect, title, footerLabel, overlayAlpha) {
      ctx.fillStyle = 'rgba(0,0,0,' + (overlayAlpha == null ? 0.72 : overlayAlpha) + ')'; ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
      this.roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 26); ctx.fillStyle = 'rgba(9,17,20,.99)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#526b69'; ctx.stroke();
      ctx.fillStyle = '#16272b'; this.roundedRectPath(ctx, rect.x + 2, rect.y + 2, rect.w - 4, Math.min(88, rect.h / 3), 24); ctx.fill();
      var header = rect.header || 88, footer = rect.footer || 110;
      ctx.fillStyle = '#34484b'; ctx.fillRect(rect.x + 18, rect.y + header, rect.w - 36, 1);
      ctx.fillStyle = '#142327'; this.roundedRectPath(ctx, rect.x + 2, rect.y + rect.h - footer, rect.w - 4, footer - 2, 24); ctx.fill();
      ctx.fillStyle = '#34484b'; ctx.fillRect(rect.x + 18, rect.y + rect.h - footer, rect.w - 36, 1);
      this.drawCenteredText(ctx, title, rect.y + 44, 32, true, CONFIG.COLORS.COIN);
      if (footerLabel) this.drawActionButton(ctx, rect.x + 36, rect.y + rect.h - footer + 20, rect.w - 72, 68, footerLabel, true, 22);
      return rect;
    },
    // 由 BattleView 在世界绘制作用域内调用。
    applyWorldShake: function (ctx) {
      var ox = 0,
        oy = 0;
      if (Settings.shake) {
        if (root.FX.shake > 0) {
          ox += (Math.random() * 2 - 1) * CONFIG.POLISH.SHAKE_SIZE;
          oy += (Math.random() * 2 - 1) * CONFIG.POLISH.SHAKE_SIZE;
        }
        if (Camera.shakeTimer > 0) {
          ox += Camera.shakeX;
          oy += Camera.shakeY;
        }
      }
      ctx.translate(ox, oy);
    },
    getSkipLevelY: function () {
      return Math.min(1215, CONFIG.VIEW.HEIGHT - (CONFIG.UI.BOTTOM_INSET || 0) - 66);
    },
    consumeSkipLevelAction: function () {
      var p = Input.pendingTap;
      if (root.DevConsole.active && ExpLevelUp.pendingChoices >= 10 && p.active && this.isPointInRect(p, 245, this.getSkipLevelY(), 260, 58)) {
        Input.clearTap();
        return true;
      }
      return false;
    }
  };
root.UI = UI;
root.G.ui = UI;
})();

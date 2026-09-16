'use strict';
// ============================================================
// UI（界面绘制）：地面、HUD、摇杆、升级面板、结算、菜单、基地
// ============================================================
var root = (typeof window !== 'undefined') ? window : global;
var CONFIG = root.CONFIG;
var Player = root.Player;
var Camera = root.Camera;
var Enemy = root.Enemy;
var RunStats = root.RunStats;
var ExpLevelUp = root.ExpLevelUp;
var Meta = root.Meta;
var PowerUps = root.PowerUps;
var BossSystem = root.BossSystem;
var Input = root.Input;

var UI = {
  tapPoint: { x: 0, y: 0 },
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
    var topInset = (root.Platform && root.Platform.safeTop) || 0;
    var bottomInset = (root.Platform && root.Platform.safeBottom) || 0;
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

    // === 菜单设置按钮（effects.js）===
    if (CONFIG.POLISH) {
      CONFIG.POLISH.MENU_TOOL_Y = h - bottomInset - 160;
      // 战斗中暂停按钮（右上角），加顶部安全区
      CONFIG.POLISH.TOOL_Y = 215 + topInset;
      // 暂停/设置/帮助面板按钮起始位置
      CONFIG.POLISH.PANEL_TOP = 300 + topInset;
    }

    // === 炮塔激活按钮（field.js）===
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
    CONFIG.UI.BASE_ROW_HEIGHT = Math.max(94, Math.min(164,
      Math.floor((baseRowsSpace - CONFIG.UI.BASE_ROW_GAP * (CONFIG.UI.BASE_VISIBLE_ROWS - 1)) /
        CONFIG.UI.BASE_VISIBLE_ROWS)));
    CONFIG.UI.BASE_PAGER_Y = CONFIG.UI.BASE_LIST_Y +
      CONFIG.UI.BASE_VISIBLE_ROWS * CONFIG.UI.BASE_ROW_HEIGHT +
      (CONFIG.UI.BASE_VISIBLE_ROWS - 1) * CONFIG.UI.BASE_ROW_GAP + 12;
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

  },

  // ---------- 主菜单 ----------
  drawMenu: function (ctx) {
    var top = CONFIG.UI.TOP_INSET || 0;
    ctx.fillStyle = CONFIG.COLORS.MENU_BACKGROUND;
    ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
    this.drawMenuGlow(ctx);
    this.drawCenteredText(ctx, CONFIG.TEXT.GAME_TITLE, 170 + top, 68, true, CONFIG.COLORS.TEXT);
    this.drawCenteredText(ctx, CONFIG.TEXT.GAME_SUBTITLE, 240 + top, 23, false, CONFIG.COLORS.HINT_TEXT);
    this.drawCenteredText(ctx, CONFIG.TEXT.TOTAL_COINS(Meta.data.coins), 330 + top, 42, true, CONFIG.COLORS.COIN);
    this.drawCenteredText(ctx,
      CONFIG.TEXT.HISTORY(Meta.data.bestWave, this.formatTime(Meta.data.bestTime), Meta.data.bestKills),
      405 + top, 22, false, CONFIG.COLORS.HINT_TEXT);
    this.drawMenuButton(ctx, 0, CONFIG.TEXT.START_GAME, true, '');
    this.drawMenuButton(ctx, 1, CONFIG.TEXT.OPEN_BASE, true, '');
    var speedupReady = Meta.isSpeedupReady();
    var speedupStatus = speedupReady
      ? CONFIG.TEXT.SPEEDUP_REWARD(CONFIG.META.SPEEDUP_MINUTES, Meta.getSpeedupReward())
      : CONFIG.TEXT.SPEEDUP_COOLDOWN(this.formatDuration(Meta.getSpeedupRemainingMs()));
    this.drawMenuButton(ctx, 2, CONFIG.TEXT.SPEEDUP, speedupReady, speedupStatus);
    this.drawCenteredText(ctx, CONFIG.TEXT.SPEEDUP_TODO, CONFIG.UI.MENU_HINT_Y, 20, false, CONFIG.COLORS.HINT_TEXT);
    if (Meta.offlinePopupActive) this.drawOfflinePopup(ctx);
    this.drawToast(ctx);
  },

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
      this.drawCenteredText(ctx, subtext, y + CONFIG.UI.MENU_BUTTON_HEIGHT + 18, 17, false,
        enabled ? CONFIG.COLORS.HINT_TEXT : CONFIG.COLORS.BUTTON_DISABLED_TEXT);
    }
  },

  consumeMenuAction: function () {
    if (!Input.consumeTap(this.tapPoint)) return -1;
    var x = CONFIG.UI.MENU_BUTTON_X, width = CONFIG.UI.MENU_BUTTON_WIDTH;
    if (this.tapPoint.x < x || this.tapPoint.x > x + width) return -1;
    for (var i = 0; i < 3; i++) {
      var y = CONFIG.UI.MENU_BUTTON_START_Y + i * (CONFIG.UI.MENU_BUTTON_HEIGHT + CONFIG.UI.MENU_BUTTON_GAP);
      if (this.tapPoint.y >= y && this.tapPoint.y <= y + CONFIG.UI.MENU_BUTTON_HEIGHT) return i;
    }
    return -1;
  },

  // ---------- 基地（永久升级） ----------
  getBaseContentY: function (top) {
    return CONFIG.UI.BASE_CONTENT_Y ||
      (top + CONFIG.UI.BASE_TAB_Y + CONFIG.UI.BASE_TAB_HEIGHT + 22);
  },

  getBaseTabRects: function (top) {
    var totalW = CONFIG.UI.BASE_TAB_WIDTH * 2 + CONFIG.UI.BASE_TAB_GAP;
    var startX = (CONFIG.VIEW.WIDTH - totalW) / 2;
    var y = CONFIG.UI.BASE_TAB_Y + top;
    return [
      { x: startX, y: y, w: CONFIG.UI.BASE_TAB_WIDTH, h: CONFIG.UI.BASE_TAB_HEIGHT },
      { x: startX + CONFIG.UI.BASE_TAB_WIDTH + CONFIG.UI.BASE_TAB_GAP, y: y,
        w: CONFIG.UI.BASE_TAB_WIDTH, h: CONFIG.UI.BASE_TAB_HEIGHT }
    ];
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

  drawBase: function (ctx) {
    var top = CONFIG.UI.TOP_INSET || 0;
    ctx.fillStyle = CONFIG.COLORS.MENU_BACKGROUND;
    ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
    this.drawMenuGlow(ctx);
    this.drawActionButton(ctx, CONFIG.UI.BASE_BACK_X, CONFIG.UI.BASE_BACK_Y + top,
      CONFIG.UI.BASE_BACK_WIDTH, CONFIG.UI.BASE_BACK_HEIGHT, CONFIG.TEXT.BACK, true, 24);
    this.drawCenteredText(ctx, CONFIG.TEXT.BASE_TITLE, 68 + top, 46, true, CONFIG.COLORS.TEXT);
    this.drawCenteredText(ctx, CONFIG.TEXT.TOTAL_COINS(Meta.data.coins), 126 + top, 29, true, CONFIG.COLORS.COIN);
    this.drawBaseTabs(ctx, top);
    // 内容淡入淡出
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, this.baseTabFade));
    if (this.baseTab === 'gadget') {
      this.drawBaseGadget(ctx, top);
    } else {
      this.drawBaseCharacter(ctx, top);
    }
    ctx.restore();
    this.drawToast(ctx);
  },

  drawBaseCharacter: function (ctx, top) {
    var definitions = CONFIG.META.UPGRADES;
    var perPage = CONFIG.UI.BASE_VISIBLE_ROWS;
    var totalPages = Math.ceil(definitions.length / perPage);
    this.baseCharacterPage = Math.max(0, Math.min(totalPages - 1, this.baseCharacterPage));
    this.drawBaseSectionHeader(ctx, CONFIG.TEXT.BASE_CHARACTER_SECTION,
      CONFIG.TEXT.BASE_CHARACTER_HINT, this.getCharacterProgress());

    var first = this.baseCharacterPage * perPage;
    var last = Math.min(definitions.length, first + perPage);
    for (var i = first; i < last; i++) {
      this.drawBaseUpgradeRow(ctx, i - first, definitions[i], false, '', i);
    }
    this.drawBasePager(ctx, this.baseCharacterPage, totalPages, 1010, 1011);
  },

  getCharacterProgress: function () {
    var current = 0, total = 0;
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
    this.drawActionButton(ctx, x + 12, navY, CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT,
      CONFIG.TEXT.BASE_PREV, index > 0, 38);
    this.drawActionButton(ctx, x + w - CONFIG.UI.BASE_NAV_WIDTH - 12, navY,
      CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT, CONFIG.TEXT.BASE_NEXT, index < total - 1, 38);
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
    ctx.fillText(CONFIG.TEXT.META_LEVEL(level, definition.MAX_LEVEL),
      x + width - 22, y + 20);
    ctx.restore();

    this.drawLevelSegments(ctx, x + 20, y + height - 22,
      width - CONFIG.UI.BASE_BUY_WIDTH - 54, level, definition.MAX_LEVEL, isMax);
    var buyX = x + width - CONFIG.UI.BASE_BUY_WIDTH - 15;
    var buyY = y + height - CONFIG.UI.BASE_BUY_HEIGHT - 8;
    this.drawActionButton(ctx, buyX, buyY, CONFIG.UI.BASE_BUY_WIDTH, CONFIG.UI.BASE_BUY_HEIGHT,
      isMax ? CONFIG.TEXT.MAX_LEVEL : CONFIG.TEXT.BUY(price), canBuy, 19);
  },

  drawLevelSegments: function (ctx, x, y, width, level, maxLevel, isMax) {
    var gap = 4;
    var segmentW = Math.max(4, (width - gap * (maxLevel - 1)) / maxLevel);
    for (var i = 0; i < maxLevel; i++) {
      this.roundedRectPath(ctx, x + i * (segmentW + gap), y, segmentW, 8, 4);
      ctx.fillStyle = i < level
        ? (isMax ? CONFIG.COLORS.BASE_PROGRESS_MAX : CONFIG.COLORS.BASE_PROGRESS_ON)
        : CONFIG.COLORS.BASE_PROGRESS_BG;
      ctx.fill();
    }
  },

  drawBasePager: function (ctx, page, totalPages) {
    var y = CONFIG.UI.BASE_PAGER_Y;
    var cx = CONFIG.VIEW.WIDTH / 2;
    this.drawActionButton(ctx, cx - 190, y, CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT,
      CONFIG.TEXT.BASE_PREV, page > 0, 38);
    this.drawActionButton(ctx, cx + 108, y, CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT,
      CONFIG.TEXT.BASE_NEXT, page < totalPages - 1, 38);
    this.drawCenteredText(ctx, CONFIG.TEXT.BASE_PAGE(page + 1, totalPages), y + 30,
      19, true, CONFIG.COLORS.HINT_TEXT);
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
    if (this.isPointInRect(this.tapPoint, CONFIG.UI.BASE_BACK_X, CONFIG.UI.BASE_BACK_Y + top,
        CONFIG.UI.BASE_BACK_WIDTH, CONFIG.UI.BASE_BACK_HEIGHT)) return -1;
    // Tab 切换：1001=角色强化，1002=道具强化
    var tabRects = this.getBaseTabRects(top);
    for (var t = 0; t < tabRects.length; t++) {
      if (this.isPointInRect(this.tapPoint, tabRects[t].x, tabRects[t].y,
          tabRects[t].w, tabRects[t].h)) return t === 0 ? 1001 : 1002;
    }
    if (this.baseTab === 'character') {
      var totalPages = Math.ceil(CONFIG.META.UPGRADES.length / CONFIG.UI.BASE_VISIBLE_ROWS);
      var pagerY = CONFIG.UI.BASE_PAGER_Y;
      var cx = CONFIG.VIEW.WIDTH / 2;
      if (this.isPointInRect(this.tapPoint, cx - 190, pagerY,
          CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT) && this.baseCharacterPage > 0) return 1010;
      if (this.isPointInRect(this.tapPoint, cx + 108, pagerY,
          CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT) && this.baseCharacterPage < totalPages - 1) return 1011;
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
      var headerY = CONFIG.UI.BASE_CONTENT_Y +
        (CONFIG.UI.BASE_SECTION_HEIGHT - CONFIG.UI.BASE_NAV_HEIGHT) / 2;
      if (this.isPointInRect(this.tapPoint, CONFIG.UI.BASE_CARD_X + 12, headerY,
          CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT) && this.baseGadgetIndex > 0) return 1020;
      if (this.isPointInRect(this.tapPoint,
          CONFIG.UI.BASE_CARD_X + CONFIG.UI.BASE_CARD_WIDTH - CONFIG.UI.BASE_NAV_WIDTH - 12, headerY,
          CONFIG.UI.BASE_NAV_WIDTH, CONFIG.UI.BASE_NAV_HEIGHT) && this.baseGadgetIndex < ids.length - 1) return 1021;
      var gadgetId = ids[this.baseGadgetIndex];
      var items = CONFIG.META.GADGET_UPGRADES[gadgetId].items;
      for (var ii = 0; ii < items.length; ii++) {
        var rowY = CONFIG.UI.BASE_LIST_Y + ii * (CONFIG.UI.BASE_ROW_HEIGHT + CONFIG.UI.BASE_ROW_GAP);
        var buyX = CONFIG.UI.BASE_CARD_X + CONFIG.UI.BASE_CARD_WIDTH - CONFIG.UI.BASE_BUY_WIDTH - 15;
        var buyY = rowY + CONFIG.UI.BASE_ROW_HEIGHT - CONFIG.UI.BASE_BUY_HEIGHT - 8;
        if (this.isPointInRect(this.tapPoint, buyX, buyY,
            CONFIG.UI.BASE_BUY_WIDTH, CONFIG.UI.BASE_BUY_HEIGHT)) return 100 + this.baseGadgetIndex * 10 + ii;
      }
    }
    return -2;
  },

  // ---------- 离线收益弹窗 ----------
  drawOfflinePopup: function (ctx) {
    this.drawOverlay(ctx);
    var x = CONFIG.UI.POPUP_X, y = CONFIG.UI.POPUP_Y;
    var width = CONFIG.UI.POPUP_WIDTH, height = CONFIG.UI.POPUP_HEIGHT;
    this.roundedRectPath(ctx, x, y, width, height, 28);
    ctx.fillStyle = CONFIG.COLORS.POPUP_BACKGROUND;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = CONFIG.COLORS.POPUP_BORDER;
    ctx.stroke();
    this.drawCenteredText(ctx, CONFIG.TEXT.OFFLINE_TITLE, y + 80, 49, true, CONFIG.COLORS.COIN);
    this.drawCenteredText(ctx, CONFIG.TEXT.OFFLINE_REWARD(Meta.pendingOfflineCoins), y + 170, 29, true, CONFIG.COLORS.TEXT);
    this.drawCenteredText(ctx,
      CONFIG.TEXT.OFFLINE_DETAIL(Meta.pendingOfflineMinutes, Math.round(Meta.getOfflineRate() * 10) / 10),
      y + 225, 20, false, CONFIG.COLORS.HINT_TEXT);
    this.drawCenteredText(ctx, CONFIG.TEXT.OFFLINE_CAP, y + 265, 18, false, CONFIG.COLORS.HINT_TEXT);
    var buttonY = y + 338;
    this.drawActionButton(ctx, x + 48, buttonY, CONFIG.UI.POPUP_BUTTON_WIDTH, CONFIG.UI.POPUP_BUTTON_HEIGHT,
      CONFIG.TEXT.CLAIM, true, 26);
    this.drawActionButton(ctx, x + width - CONFIG.UI.POPUP_BUTTON_WIDTH - 48, buttonY,
      CONFIG.UI.POPUP_BUTTON_WIDTH, CONFIG.UI.POPUP_BUTTON_HEIGHT, CONFIG.TEXT.CLAIM_DOUBLE, true, 26);
    this.drawCenteredText(ctx, CONFIG.TEXT.AD_TODO, y + 465, 18, false, CONFIG.COLORS.HINT_TEXT);
  },

  consumeOfflineChoice: function () {
    if (!Input.consumeTap(this.tapPoint)) return -1;
    var x = CONFIG.UI.POPUP_X, y = CONFIG.UI.POPUP_Y + 338;
    if (this.isPointInRect(this.tapPoint, x + 48, y, CONFIG.UI.POPUP_BUTTON_WIDTH, CONFIG.UI.POPUP_BUTTON_HEIGHT)) return 0;
    if (this.isPointInRect(this.tapPoint, x + CONFIG.UI.POPUP_WIDTH - CONFIG.UI.POPUP_BUTTON_WIDTH - 48, y,
        CONFIG.UI.POPUP_BUTTON_WIDTH, CONFIG.UI.POPUP_BUTTON_HEIGHT)) return 1;
    return -1;
  },

  // ---------- 通用按钮 ----------
  drawActionButton: function (ctx, x, y, width, height, label, enabled, size) {
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
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    var pad = function (v) { return v < 10 ? '0' + v : String(v); };
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
    var bx = -Camera.x, by = -Camera.y;
    var bw = CONFIG.WORLD.WIDTH, bh = CONFIG.WORLD.HEIGHT;
    var ext = CONFIG.BOUNDARY.OUTSIDE_EXTEND;

    // 边界外延伸带：深色底 + 红色45°斜纹
    ctx.save();
    ctx.fillStyle = CONFIG.COLORS.BOUNDARY_OUTSIDE;
    ctx.fillRect(bx - ext, by - ext, bw + ext * 2, ext);        // 上
    ctx.fillRect(bx - ext, by + bh, bw + ext * 2, ext);          // 下
    ctx.fillRect(bx - ext, by, ext, bh);                          // 左
    ctx.fillRect(bx + bw, by, ext, bh);                           // 右
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
    var pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(
      (root.Game ? root.Game.survivedSeconds : 0) * Math.PI / CONFIG.BOUNDARY.PULSE_PERIOD));
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
    var W = CONFIG.VIEW.WIDTH, H = CONFIG.VIEW.HEIGHT;
    var wd = CONFIG.BOUNDARY.WARNING_DISTANCE, ww = CONFIG.BOUNDARY.WARNING_WIDTH;
    var dl = Player.x, dr = CONFIG.WORLD.WIDTH - Player.x;
    var dt = Player.y, db = CONFIG.WORLD.HEIGHT - Player.y;
    var sides = [
      { d: dl, g: [0, 0, ww, 0] },
      { d: dr, g: [W, 0, W - ww, 0] },
      { d: dt, g: [0, 0, 0, ww] },
      { d: db, g: [0, H, 0, H - ww] }
    ];
    for (var i = 0; i < 4; i++) {
      var s = sides[i];
      if (s.d >= wd) continue;
      var a = (1 - s.d / wd) * 0.5;
      ctx.save();
      var grd = ctx.createLinearGradient(s.g[0], s.g[1], s.g[2], s.g[3]);
      root.safeStop(grd, 0, 'rgba(255,30,30,' + a.toFixed(3) + ')');
      root.safeStop(grd, 1, 'rgba(255,30,30,0)');
      ctx.fillStyle = grd;
      if (i === 0) ctx.fillRect(0, 0, ww, H);
      else if (i === 1) ctx.fillRect(W - ww, 0, ww, H);
      else if (i === 2) ctx.fillRect(0, 0, W, ww);
      else ctx.fillRect(0, H - ww, W, ww);
      ctx.restore();
    }
  },

  // ---------- HUD ----------
  drawHud: function (ctx) {
    this.drawBoundaryWarnings(ctx);
    this.drawHpBar(ctx);
    this.drawExpBar(ctx);
    this.drawLevelBadge(ctx);
    this.drawRunStats(ctx);
    this.drawBossBar(ctx);
  },

  drawHpBar: function (ctx) {
    var x = CONFIG.UI.HP_BAR_X, y = CONFIG.UI.HP_BAR_Y;
    var width = CONFIG.UI.HP_BAR_WIDTH, height = CONFIG.UI.HP_BAR_HEIGHT;
    var ratio = Player.hp / Player.maxHp;
    this.drawBarBackground(ctx, x, y, width, height, CONFIG.UI.HP_BAR_RADIUS, CONFIG.COLORS.HP_BACKGROUND);
    this.drawBarFill(ctx, x, y, width, height, ratio, CONFIG.UI.HP_BAR_RADIUS,
      ratio <= 0.3 ? CONFIG.COLORS.HP_LOW : CONFIG.COLORS.HP_FILL);
    this.drawBarBorder(ctx, x, y, width, height, CONFIG.UI.HP_BAR_RADIUS, CONFIG.UI.HP_BAR_BORDER, CONFIG.COLORS.HP_BORDER);
    this.drawBarText(ctx, CONFIG.TEXT.HP + '  ' + Math.ceil(Player.hp) + ' / ' + Math.ceil(Player.maxHp),
      x + width / 2, y + height / 2, CONFIG.UI.HP_TEXT_SIZE);
  },

  drawExpBar: function (ctx) {
    var x = CONFIG.UI.EXP_BAR_X, y = CONFIG.UI.EXP_BAR_Y;
    var width = CONFIG.UI.EXP_BAR_WIDTH, height = CONFIG.UI.EXP_BAR_HEIGHT;
    var ratio = ExpLevelUp.need > 0 ? ExpLevelUp.exp / ExpLevelUp.need : 0;
    this.drawBarBackground(ctx, x, y, width, height, CONFIG.UI.EXP_BAR_RADIUS, CONFIG.COLORS.EXP_BACKGROUND);
    this.drawBarFill(ctx, x, y, width, height, ratio, CONFIG.UI.EXP_BAR_RADIUS, CONFIG.COLORS.EXP_FILL);
    this.drawBarBorder(ctx, x, y, width, height, CONFIG.UI.EXP_BAR_RADIUS, CONFIG.UI.EXP_BAR_BORDER, CONFIG.COLORS.EXP_BORDER);
    this.drawBarText(ctx, CONFIG.TEXT.EXP + '  ' + (Math.round(ExpLevelUp.exp * 10) / 10) + ' / ' + ExpLevelUp.need,
      x + width / 2, y + height / 2, CONFIG.UI.EXP_TEXT_SIZE);
  },

  drawLevelBadge: function (ctx) {
    var x = CONFIG.UI.LEVEL_X, y = CONFIG.UI.LEVEL_Y;
    var width = CONFIG.UI.LEVEL_WIDTH, height = CONFIG.UI.LEVEL_HEIGHT;
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
    ctx.fillText(CONFIG.TEXT.SURVIVAL_HUD(this.formatTime(Game.survivedSeconds)),
      CONFIG.UI.HP_BAR_X, CONFIG.UI.HUD_STATS_Y);
    ctx.textAlign = 'right';
    ctx.fillText(CONFIG.TEXT.KILLS_HUD(RunStats.kills),
      CONFIG.VIEW.WIDTH - CONFIG.UI.HP_BAR_X, CONFIG.UI.HUD_STATS_Y);
    if (Player.reviveCharges > 0 && !Enemy.getActiveBoss()) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillStyle = CONFIG.COLORS.META_MAX;
      ctx.fillText(CONFIG.TEXT.REVIVES_LEFT(Player.reviveCharges),
        CONFIG.VIEW.WIDTH / 2, CONFIG.UI.HUD_STATS_Y + 34);
    }
    ctx.restore();
  },

  drawBossBar: function (ctx, panelY) {
    var bosses = Enemy.getActiveBosses();
    if (bosses.length === 0) return;
    var barW = Math.round(CONFIG.VIEW.WIDTH * 0.8);
    var barH = CONFIG.BOSS.BAR_HEIGHT;
    var x = (CONFIG.VIEW.WIDTH - barW) / 2;
    var baseY = panelY === undefined ? CONFIG.BOSS.BAR_Y : panelY;
    var rowH = barH + CONFIG.BOSS.BAR_GAP + 22; // 预留名称行
    for (var i = 0; i < bosses.length; i++) {
      var boss = bosses[i];
      var y = baseY + i * rowH;
      var name = boss.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED
        ? CONFIG.TEXT.BOSS_RANGED_NAME : CONFIG.TEXT.BOSS_MELEE_NAME;
      var ratio = boss.maxHp > 0 ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : 0;
      // 名称：白色 14px 左对齐血条上方
      ctx.save();
      ctx.font = 'bold 14px Arial, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(name, x, y - 3);
      ctx.restore();
      // 背景：深色半透明 #1A1A2E alpha0.8
      ctx.save();
      ctx.globalAlpha = 0.8;
      this.roundedRectPath(ctx, x, y, barW, barH, 6);
      ctx.fillStyle = '#1A1A2E';
      ctx.fill();
      ctx.restore();
      // 血量：红色渐变 #E74C3C→#C0392B（裁剪到背景圆角内）
      if (ratio > 0) {
        ctx.save();
        this.roundedRectPath(ctx, x, y, barW, barH, 6);
        ctx.clip();
        var grad = ctx.createLinearGradient(x, 0, x + barW, 0);
        root.safeStop(grad, 0, '#E74C3C');
        root.safeStop(grad, 1, '#C0392B');
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
      var kbMoving = Input.keys.KeyA || Input.keys.KeyD || Input.keys.KeyW || Input.keys.KeyS ||
        Input.keys.ArrowLeft || Input.keys.ArrowRight || Input.keys.ArrowUp || Input.keys.ArrowDown;
      if (!root.Settings || !root.Settings.alwaysShowJoystick || kbMoving) return;
      // 固定在左下角淡显底座
      var bx = 120, by = CONFIG.VIEW.HEIGHT - 140;
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
  drawGameOver: function (ctx) { this.drawSettlement(ctx, false); },
  drawVictory: function (ctx) { this.drawSettlement(ctx, true); },

  drawSettlement: function (ctx, isVictory) {
    var top = CONFIG.UI.TOP_INSET || 0;
    var exitType = Game.exitType || 'death';
    // 标题按结算来源区分：death=游戏结束 / quit=本局结算 / victory=胜利 / extract=撤退成功
    var title;
    if (isVictory || exitType === 'victory') title = CONFIG.TEXT.VICTORY;
    else if (exitType === 'quit') title = CONFIG.TEXT.SETTLEMENT_QUIT;
    else if (exitType === 'extract') title = CONFIG.TEXT.SETTLEMENT_EXTRACT;
    else title = CONFIG.TEXT.GAME_OVER;
    this.drawOverlay(ctx);
    this.drawCenteredText(ctx, title,
      CONFIG.UI.GAMEOVER_TITLE_Y + top, CONFIG.UI.GAMEOVER_TITLE_SIZE, true, CONFIG.COLORS.TEXT);
    if (isVictory) {
      this.drawCenteredText(ctx, CONFIG.TEXT.VICTORY_SUBTITLE,
        CONFIG.UI.VICTORY_SUBTITLE_Y + top, CONFIG.UI.SETTLEMENT_TEXT_SIZE, false, CONFIG.COLORS.RARITY_EPIC);
    }
    this.drawCenteredText(ctx, CONFIG.TEXT.SETTLEMENT_TIME(this.formatTime(Game.survivedSeconds)),
      CONFIG.UI.SETTLEMENT_START_Y + top, CONFIG.UI.SETTLEMENT_TEXT_SIZE, false, CONFIG.COLORS.TEXT);
    this.drawCenteredText(ctx, CONFIG.TEXT.SETTLEMENT_KILLS(RunStats.kills),
      CONFIG.UI.SETTLEMENT_START_Y + CONFIG.UI.SETTLEMENT_LINE_GAP + top,
      CONFIG.UI.SETTLEMENT_TEXT_SIZE, false, CONFIG.COLORS.TEXT);
    this.drawCenteredText(ctx, CONFIG.TEXT.SETTLEMENT_LEVEL(ExpLevelUp.level),
      CONFIG.UI.SETTLEMENT_START_Y + CONFIG.UI.SETTLEMENT_LINE_GAP * 2 + top,
      CONFIG.UI.SETTLEMENT_TEXT_SIZE, false, CONFIG.COLORS.TEXT);
    this.drawCenteredText(ctx, CONFIG.TEXT.SETTLEMENT_COINS(RunStats.finalCoins, RunStats.coinDoubleClaimed),
      CONFIG.UI.SETTLEMENT_START_Y + CONFIG.UI.SETTLEMENT_LINE_GAP * 3 + top,
      CONFIG.UI.SETTLEMENT_COIN_SIZE, true, CONFIG.COLORS.SETTLEMENT_COIN);
    if (exitType === 'extract') {
      var greedMult = 1 + (Meta.getEffectTotal('GREED') || 0);
      var detail = '基础' + RunStats.baseCoins + ' × 贪婪' + greedMult.toFixed(2) +
        ' × 撤退×' + CONFIG.EXTRACTION.REWARD_MULTIPLIER;
      if (RunStats.extractAdClaimed) detail += ' × 广告×' + CONFIG.EXTRACTION.AD_MULTIPLIER;
      detail += ' = ' + RunStats.finalCoins;
      this.drawCenteredText(ctx, detail,
        CONFIG.UI.SETTLEMENT_START_Y + CONFIG.UI.SETTLEMENT_LINE_GAP * 3.5 + top,
        CONFIG.UI.SETTLEMENT_TEXT_SIZE, false, CONFIG.COLORS.HINT_TEXT);
    }
    this.drawCenteredText(ctx, CONFIG.TEXT.TOTAL_COINS(Meta.data.coins),
      CONFIG.UI.SETTLEMENT_START_Y + CONFIG.UI.SETTLEMENT_LINE_GAP * 4 + top, 28, false, CONFIG.COLORS.HINT_TEXT);
    this.drawSettlementAdButtons(ctx, isVictory);
    this.drawRestartButton(ctx);
  },

  drawSettlementAdButtons: function (ctx, isVictory) {
    var reviveRemaining = RunStats.getReviveRemaining();
    // 仅死亡结算(exitType==='death')且有复活次数才显示复活按钮；quit/victory/extract 不显示
    var showRevive = !isVictory && (Game.exitType || 'death') === 'death' && reviveRemaining > 0;
    // 撤退结算：显示"看广告四倍"（与死亡翻倍互斥）
    if (Game.exitType === 'extract') {
      var quadEnabled = RunStats.canExtractAdQuad();
      var qx = (CONFIG.VIEW.WIDTH - CONFIG.UI.SETTLEMENT_AD_WIDTH) / 2;
      this.drawTwoLineButton(ctx, qx, CONFIG.UI.SETTLEMENT_AD_Y,
        CONFIG.UI.SETTLEMENT_AD_WIDTH, CONFIG.UI.SETTLEMENT_AD_HEIGHT,
        quadEnabled ? CONFIG.TEXT.AD_EXTRACT_QUAD : CONFIG.TEXT.AD_EXTRACT_USED,
        quadEnabled ? CONFIG.TEXT.AD_EXTRACT_QUAD_HINT : '', quadEnabled);
      return;
    }
    var doubleEnabled = RunStats.canDoubleCoins();
    var doubleX = showRevive ? CONFIG.UI.SETTLEMENT_AD_RIGHT_X
      : (CONFIG.VIEW.WIDTH - CONFIG.UI.SETTLEMENT_AD_WIDTH) / 2;
    if (showRevive) {
      this.drawTwoLineButton(ctx, CONFIG.UI.SETTLEMENT_AD_LEFT_X, CONFIG.UI.SETTLEMENT_AD_Y,
        CONFIG.UI.SETTLEMENT_AD_WIDTH, CONFIG.UI.SETTLEMENT_AD_HEIGHT,
        CONFIG.TEXT.AD_REVIVE, CONFIG.TEXT.AD_REVIVE_COUNT(reviveRemaining), true);
    }
    this.drawTwoLineButton(ctx, doubleX, CONFIG.UI.SETTLEMENT_AD_Y,
      CONFIG.UI.SETTLEMENT_AD_WIDTH, CONFIG.UI.SETTLEMENT_AD_HEIGHT,
      doubleEnabled ? CONFIG.TEXT.AD_COIN_DOUBLE : CONFIG.TEXT.AD_COIN_DOUBLED,
      doubleEnabled ? CONFIG.TEXT.AD_COIN_DOUBLE_HINT : '', doubleEnabled);
  },

  drawOverlay: function (ctx) {
    ctx.save();
    ctx.globalAlpha = CONFIG.UI.OVERLAY_ALPHA;
    ctx.fillStyle = CONFIG.COLORS.OVERLAY;
    ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
    ctx.restore();
  },

  drawRestartButton: function (ctx) {
    var x = CONFIG.UI.RESTART_X, y = CONFIG.UI.RESTART_Y;
    var width = CONFIG.UI.RESTART_WIDTH, height = CONFIG.UI.RESTART_HEIGHT;
    this.roundedRectPath(ctx, x, y, width, height, CONFIG.UI.RESTART_RADIUS);
    ctx.fillStyle = CONFIG.COLORS.BUTTON;
    ctx.fill();
    ctx.lineWidth = CONFIG.UI.RESTART_BORDER;
    ctx.strokeStyle = CONFIG.COLORS.BUTTON_BORDER;
    ctx.stroke();
    ctx.font = 'bold ' + CONFIG.UI.RESTART_TEXT_SIZE + 'px Arial, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = CONFIG.COLORS.BUTTON_TEXT;
    ctx.fillText(CONFIG.TEXT.RESTART, x + width / 2, y + height / 2 + 1);
  },

  consumeSettlementAction: function (isVictory) {
    if (!Input.consumeTap(this.tapPoint)) return -1;
    if (this.isPointInRect(this.tapPoint, CONFIG.UI.RESTART_X, CONFIG.UI.RESTART_Y,
        CONFIG.UI.RESTART_WIDTH, CONFIG.UI.RESTART_HEIGHT)) return 0;
    // 撤退结算：看广告四倍按钮（居中）
    if (Game.exitType === 'extract') {
      var qx = (CONFIG.VIEW.WIDTH - CONFIG.UI.SETTLEMENT_AD_WIDTH) / 2;
      if (RunStats.canExtractAdQuad() && this.isPointInRect(this.tapPoint, qx, CONFIG.UI.SETTLEMENT_AD_Y,
          CONFIG.UI.SETTLEMENT_AD_WIDTH, CONFIG.UI.SETTLEMENT_AD_HEIGHT)) return 3;
      return -1;
    }
    var showRevive = !isVictory && (Game.exitType || 'death') === 'death' && RunStats.getReviveRemaining() > 0;
    if (showRevive && this.isPointInRect(this.tapPoint, CONFIG.UI.SETTLEMENT_AD_LEFT_X, CONFIG.UI.SETTLEMENT_AD_Y,
        CONFIG.UI.SETTLEMENT_AD_WIDTH, CONFIG.UI.SETTLEMENT_AD_HEIGHT)) return 1;
    var doubleX = showRevive ? CONFIG.UI.SETTLEMENT_AD_RIGHT_X
      : (CONFIG.VIEW.WIDTH - CONFIG.UI.SETTLEMENT_AD_WIDTH) / 2;
    if (RunStats.canDoubleCoins() && this.isPointInRect(this.tapPoint, doubleX, CONFIG.UI.SETTLEMENT_AD_Y,
        CONFIG.UI.SETTLEMENT_AD_WIDTH, CONFIG.UI.SETTLEMENT_AD_HEIGHT)) return 2;
    return -1;
  },

  // ---------- 升级三选一 ----------
  drawLevelUp: function (ctx) {
    var top = CONFIG.UI.TOP_INSET || 0;
    this.drawOverlay(ctx);
    this.drawCenteredText(ctx, CONFIG.TEXT.LEVEL_UP, CONFIG.UI.LEVELUP_TITLE_Y + top,
      CONFIG.UI.LEVELUP_TITLE_SIZE, true, CONFIG.COLORS.TEXT);
    this.drawCenteredText(ctx, CONFIG.TEXT.LEVEL_UP_SUBTITLE, CONFIG.UI.LEVELUP_SUBTITLE_Y + top,
      CONFIG.UI.LEVELUP_SUBTITLE_SIZE, false, CONFIG.COLORS.HINT_TEXT);
    for (var i = 0; i < ExpLevelUp.offerCount; i++) {
      this.drawUpgradeCard(ctx, i, ExpLevelUp.offers[i]);
    }
    this.drawCenteredText(ctx, CONFIG.TEXT.CARD_HINT, CONFIG.UI.CARD_HINT_Y,
      CONFIG.UI.CARD_HINT_SIZE, false, CONFIG.COLORS.HINT_TEXT);
    var remaining = RunStats.getRefreshRemaining();
    this.drawTwoLineButton(ctx, CONFIG.UI.LEVEL_REFRESH_X, CONFIG.UI.LEVEL_REFRESH_Y,
      CONFIG.UI.LEVEL_REFRESH_WIDTH, CONFIG.UI.LEVEL_REFRESH_HEIGHT,
      remaining > 0 ? CONFIG.TEXT.AD_REFRESH : CONFIG.TEXT.AD_REFRESH_USED_UP,
      remaining > 0 ? CONFIG.TEXT.AD_REFRESH_COUNT(remaining) : '', remaining > 0);
  },

  drawUpgradeCard: function (ctx, index, offer) {
    var x = CONFIG.UI.CARD_X;
    var y = CONFIG.UI.CARD_START_Y + index * (CONFIG.UI.CARD_HEIGHT + CONFIG.UI.CARD_GAP);
    var width = CONFIG.UI.CARD_WIDTH, height = CONFIG.UI.CARD_HEIGHT;
    var rarityId = offer.rarity.ID;
    var rarityColor = rarityId === 'COMMON'
      ? CONFIG.COLORS.CARD_COMMON_BORDER : CONFIG.COLORS[offer.rarity.COLOR_KEY];
    var cardBackground = rarityId === 'LEGENDARY' ? CONFIG.COLORS.CARD_LEGENDARY_BG
      : rarityId === 'EPIC' ? CONFIG.COLORS.CARD_EPIC_BG
      : (rarityId === 'RARE' ? CONFIG.COLORS.CARD_RARE_BG : CONFIG.COLORS.CARD_COMMON_BG);
    var textDefinition = CONFIG.TEXT.UPGRADES[offer.definition.TEXT_KEY];
    ctx.save();
    // 先画不带阴影的不透明深色卡底，防止微信真机把浅色阴影铺进卡片内部。
    this.roundedRectPath(ctx, x, y, width, height, CONFIG.UI.CARD_RADIUS);
    ctx.fillStyle = cardBackground;
    ctx.fill();
    // 稀有度只用于边框与轻量外发光；普通卡完全不发光。
    var phase = ((Date.now() % 2000) / 2000) * 360;
    var rainbow = null;
    if (rarityId === 'LEGENDARY') {
      rainbow = ctx.createLinearGradient(x, y, x + width, y + height);
      root.safeStop(rainbow, 0, 'hsl(' + phase + ',95%,62%)');
      root.safeStop(rainbow, 0.5, 'hsl(' + ((phase + 120) % 360) + ',95%,62%)');
      root.safeStop(rainbow, 1, 'hsl(' + ((phase + 240) % 360) + ',95%,62%)');
    }
    // 微信 iOS Canvas 对大矩形 shadowBlur 存在驱动兼容问题：部分机型会卡面发白，
    // 随后 GPU 合成线程停滞。品质效果只使用描边，不对整张卡启用阴影。
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.lineWidth = rarityId === 'COMMON' || rarityId === 'RARE' ? 2 : 3;
    ctx.strokeStyle = rainbow || rarityColor;
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (rarityId === 'EPIC' || rarityId === 'LEGENDARY') {
      this.roundedRectPath(ctx, x + 7, y + 7, width - 14, height - 14, CONFIG.UI.CARD_RADIUS - 5);
      ctx.globalAlpha = rarityId === 'LEGENDARY' ? 0.78 : 0.5;
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
    ctx.fillStyle = rarityId === 'LEGENDARY' ? rainbow
      : (rarityId === 'EPIC' ? rarityColor : CONFIG.COLORS.CARD_TITLE);
    ctx.fillText(textDefinition.NAME, x + CONFIG.UI.CARD_NAME_X_OFFSET, y + CONFIG.UI.CARD_NAME_Y_OFFSET);
    ctx.font = 'bold ' + CONFIG.UI.CARD_RARITY_SIZE + 'px Arial, "Microsoft YaHei", sans-serif';
    ctx.fillStyle = rarityColor;
    ctx.fillText(CONFIG.TEXT.RARITY[offer.rarity.ID],
      x + CONFIG.UI.CARD_NAME_X_OFFSET, y + CONFIG.UI.CARD_RARITY_Y_OFFSET);
    ctx.textAlign = 'right';
    ctx.fillText(CONFIG.TEXT.CARD_LEVEL(offer.level + 1, offer.definition.MAX_LEVEL),
      x + width - CONFIG.UI.CARD_LEVEL_RIGHT_OFFSET, y + CONFIG.UI.CARD_RARITY_Y_OFFSET);
    ctx.textAlign = 'left';
    ctx.font = CONFIG.UI.CARD_DESC_SIZE + 'px Arial, "Microsoft YaHei", sans-serif';
    ctx.fillStyle = CONFIG.COLORS.CARD_DESC;
    ctx.fillText(offer.description, x + CONFIG.UI.CARD_NAME_X_OFFSET, y + CONFIG.UI.CARD_DESC_Y_OFFSET);
    if (rarityId === 'LEGENDARY') {
      for (var p = 0; p < 6; p++) {
        var px = x + 16 + ((p * 113 + Date.now() / 20) % (width - 32));
        var py = y + (p % 2 ? 18 : height - 18);
        ctx.fillStyle = 'hsl(' + ((phase + p * 55) % 360) + ',95%,70%)';
        ctx.fillRect(px, py, 4, 4);
      }
    }
    ctx.restore();
  },

  consumeLevelUpAction: function (offerCount) {
    if (!Input.consumeTap(this.tapPoint)) return -1;
    if (RunStats.getRefreshRemaining() > 0 && this.isPointInRect(this.tapPoint,
        CONFIG.UI.LEVEL_REFRESH_X, CONFIG.UI.LEVEL_REFRESH_Y,
        CONFIG.UI.LEVEL_REFRESH_WIDTH, CONFIG.UI.LEVEL_REFRESH_HEIGHT)) return -2;
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
  drawPowerUpButtons: function (ctx) {
    for (var typeIndex = 0; typeIndex < PowerUps.inventory.length; typeIndex++) {
      var count = PowerUps.inventory[typeIndex];
      if (count <= 0) continue;
      var x = CONFIG.UI.POWERUP_BUTTON_X;
      var y = this.getPowerUpButtonY(typeIndex);
      var width = CONFIG.UI.POWERUP_BUTTON_WIDTH, height = CONFIG.UI.POWERUP_BUTTON_HEIGHT;
      ctx.save();
      this.roundedRectPath(ctx, x, y, width, height, CONFIG.UI.POWERUP_BUTTON_RADIUS);
      ctx.fillStyle = CONFIG.COLORS.ITEM_BUTTON;
      ctx.fill();
      ctx.lineWidth = CONFIG.UI.POWERUP_BUTTON_BORDER;
      ctx.strokeStyle = CONFIG.COLORS.ITEM_BUTTON_BORDER;
      ctx.stroke();
      this.drawPowerUpIcon(ctx, typeIndex, x + CONFIG.UI.POWERUP_ICON_SIZE, y + height / 2, CONFIG.UI.POWERUP_ICON_SIZE);
      ctx.font = 'bold ' + CONFIG.UI.POWERUP_TEXT_SIZE + 'px Arial, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CONFIG.COLORS.TEXT;
      ctx.fillText(CONFIG.TEXT.POWERUPS[typeIndex].SHORT,
        x + CONFIG.UI.POWERUP_ICON_SIZE * 2, y + height / 2);
      ctx.textAlign = 'right';
      ctx.font = 'bold ' + CONFIG.UI.POWERUP_COUNT_SIZE + 'px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillText('×' + count, x + width - 9, y + height / 2);
      ctx.restore();
    }
  },

  getPowerUpButtonY: function (typeIndex) {
    return CONFIG.VIEW.HEIGHT - CONFIG.UI.POWERUP_BUTTON_BOTTOM -
      CONFIG.UI.POWERUP_BUTTON_HEIGHT - typeIndex * (CONFIG.UI.POWERUP_BUTTON_HEIGHT + CONFIG.UI.POWERUP_BUTTON_GAP);
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
      ctx.beginPath(); ctx.moveTo(x - size * 0.5, y + size * 0.5);
      ctx.lineTo(x + size * 0.55, y - size * 0.55); ctx.stroke();
      ctx.fillStyle = CONFIG.COLORS.LASER_EMITTER_CORE;
      ctx.beginPath(); ctx.arc(x - size * 0.5, y + size * 0.5, size * 0.18, 0, Math.PI * 2); ctx.fill();
    } else if (typeIndex === CONFIG.POWERUPS.TYPE_MORTAR) {
      // 迫击炮：炮弹 + 抛物线
      ctx.fillStyle = CONFIG.COLORS.ITEM_MORTAR;
      ctx.beginPath(); ctx.arc(x + size * 0.4, y - size * 0.3, size * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = CONFIG.COLORS.HINT_TEXT;
      ctx.lineWidth = size * 0.08;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.5, y + size * 0.5);
      ctx.quadraticCurveTo(x, y - size * 0.85, x + size * 0.4, y - size * 0.3);
      ctx.stroke();
    }
    ctx.restore();
  },

  consumePowerUpButton: function () {
    if (!Input.consumeTap(this.tapPoint)) return -1;
    for (var typeIndex = 0; typeIndex < PowerUps.inventory.length; typeIndex++) {
      if (PowerUps.inventory[typeIndex] <= 0) continue;
      var y = this.getPowerUpButtonY(typeIndex);
      if (this.tapPoint.x >= CONFIG.UI.POWERUP_BUTTON_X &&
          this.tapPoint.x <= CONFIG.UI.POWERUP_BUTTON_X + CONFIG.UI.POWERUP_BUTTON_WIDTH &&
          this.tapPoint.y >= y && this.tapPoint.y <= y + CONFIG.UI.POWERUP_BUTTON_HEIGHT) {
        return typeIndex;
      }
    }
    return -1;
  },

  // ---------- 冲刺按钮 ----------
  getDashButtonY: function () {
    var topY = Infinity;
    for (var i = 0; i < PowerUps.inventory.length; i++) {
      if (PowerUps.inventory[i] > 0) topY = Math.min(topY, this.getPowerUpButtonY(i));
    }
    if (!isFinite(topY)) {
      topY = CONFIG.VIEW.HEIGHT - CONFIG.UI.POWERUP_BUTTON_BOTTOM - CONFIG.UI.POWERUP_BUTTON_HEIGHT;
    }
    return topY - CONFIG.UI.DASH_BUTTON_ABOVE - CONFIG.UI.DASH_BUTTON_RADIUS;
  },

  drawDashButton: function (ctx) {
    if (!root.Player) return;
    var cx = CONFIG.UI.DASH_BUTTON_X;
    var cy = this.getDashButtonY();
    var r = CONFIG.UI.DASH_BUTTON_RADIUS;
    var ready = Player.canDash();
    var scale = 1;
    if (root.ButtonUI) {
      root.ButtonUI.pressedTouches.forEach(function (p) {
        if (p.x === cx - r && p.y === cy - r) scale = 0.92;
      });
    }
    if (ready && Player.dashReadyFlash > 0) {
      var f = 1 - Player.dashReadyFlash / CONFIG.PLAYER.DASH_READY_FLASH; // 0→1
      scale = 1 + 0.15 * Math.sin(f * Math.PI);
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    if (scale < 1) ctx.filter = 'brightness(1.2)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = ready ? CONFIG.COLORS.DASH_BUTTON : CONFIG.COLORS.ITEM_BUTTON;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = ready ? CONFIG.COLORS.DASH_BUTTON_BORDER : CONFIG.COLORS.META_CARD_BORDER;
    ctx.stroke();
    // 冷却径向遮罩
    if (!ready && Player.dashCooldown > 0) {
      var frac = Player.dashCooldown / CONFIG.PLAYER.DASH_COOLDOWN;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 0, 0, ' + CONFIG.UI.DASH_COOLDOWN_ALPHA + ')';
      ctx.fill();
    }
    // 闪电图标
    ctx.beginPath();
    ctx.moveTo(7, -r * 0.52);
    ctx.lineTo(-7, r * 0.02);
    ctx.lineTo(-1, r * 0.02);
    ctx.lineTo(-7, r * 0.55);
    ctx.lineTo(7, -r * 0.08);
    ctx.lineTo(1, -r * 0.08);
    ctx.closePath();
    ctx.globalAlpha = ready ? 1 : 0.75;
    ctx.fillStyle = CONFIG.COLORS.DASH_ICON;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = 'bold 16px Arial, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = CONFIG.COLORS.DASH_ICON;
    ctx.fillText(Player.dashing ? CONFIG.TEXT.DASH_ACTIVE : CONFIG.TEXT.DASH_READY, 0, r * 0.66);
    ctx.restore();
  },

  consumeDashButton: function () {
    if (!Input.pendingTap.active) return false;
    var dx = Input.pendingTap.x - CONFIG.UI.DASH_BUTTON_X;
    var dy = Input.pendingTap.y - this.getDashButtonY();
    var r = CONFIG.UI.DASH_BUTTON_RADIUS;
    if (dx * dx + dy * dy > r * r) return false;
    Input.pendingTap.active = false;
    return true;
  },

  // ---------- 撤退点按钮 ----------
  getExtractionActivateRect: function () {
    var w = 150, h = 50;
    var cx = CONFIG.UI.DASH_BUTTON_X - CONFIG.UI.DASH_BUTTON_RADIUS - 12 - w / 2;
    var cy = this.getDashButtonY();
    return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
  },
  getExtractionConfirmRect: function () {
    var w = 300, h = 80;
    return { x: (CONFIG.VIEW.WIDTH - w) / 2, y: CONFIG.VIEW.HEIGHT * 0.6, w: w, h: h };
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
        Input.clearTap(); ext.startActivation(); return 1;
      }
    }
    if (ext.state === 'extractable' && ext.playerInZone) {
      var c = this.getExtractionConfirmRect();
      if (this.isPointInRect(this.tapPoint, c.x, c.y, c.w, c.h)) {
        Input.clearTap(); ext.startExtraction(); return 2;
      }
    }
    return 0;
  },

  // 冲刺速度线（屏幕边缘放射短线）
  drawDashSpeedLines: function (ctx) {
    if (!Player.dashing) return;
    var cx = CONFIG.VIEW.WIDTH / 2, cy = CONFIG.VIEW.HEIGHT / 2;
    var frac = Math.max(0, Player.dashTimer / CONFIG.PLAYER.DASH_DURATION);
    ctx.save();
    ctx.strokeStyle = CONFIG.COLORS.DASH_SPEEDLINE;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (var i = 0; i < 14; i++) {
      var ang = (i / 14) * Math.PI * 2 + (i % 2) * 0.1;
      var len = 30 + (i * 37 % 30);
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
    var sx = Player.x - Camera.x, sy = Player.y - Camera.y;
    var len = CONFIG.PLAYER.DASH_ARROW_LENGTH;
    var ex = sx + Player.dashDirX * len, ey = sy + Player.dashDirY * len;
    ctx.save(); ctx.globalAlpha = Player.dashArrowTimer / CONFIG.PLAYER.DASH_ARROW_TIME;
    ctx.strokeStyle = CONFIG.PLAYER.DASH_ARROW_COLOR; ctx.fillStyle = CONFIG.PLAYER.DASH_ARROW_COLOR;
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    var a = Math.atan2(Player.dashDirY, Player.dashDirX);
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(a - 0.6) * 10, ey - Math.sin(a - 0.6) * 10);
    ctx.lineTo(ex - Math.cos(a + 0.6) * 10, ey - Math.sin(a + 0.6) * 10); ctx.closePath(); ctx.fill(); ctx.restore();
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
  }
};

root.UI = UI;

// 营地导航、品质视觉与响应式排版。
(function () {
    // ============================================================
    // 界面与内容：营地两层导航 / 五档品质 / 主菜单排版 / 渐变崩溃双保险
    // ============================================================
    var root = typeof window !== 'undefined' ? window : global;
    var CONFIG = root.CONFIG,
      Game = root.Game,
      UI = root.UI,
      Input = root.Input,
      Meta = root.Meta;
    var Platform = root.Platform,
      Player = root.Player,
      Camera = root.Camera,
      Weapons = root.Weapons;
    var ExpLevelUp = root.ExpLevelUp,
      Wardrobe = root.Wardrobe,
      FateCards = root.FateCards;
    var QUALITY = {
      WHITE: {
        id: 'WHITE',
        name: '白',
        main: '#E8E8E8',
        edge: '#BDC3C7',
        bg: '#202725',
        rainbow: false
      },
      BLUE: {
        id: 'BLUE',
        name: '蓝',
        main: '#3498DB',
        edge: '#2471A3',
        bg: '#112a38',
        rainbow: false
      },
      PURPLE: {
        id: 'PURPLE',
        name: '紫',
        main: '#9B59B6',
        edge: '#76448A',
        bg: '#281833',
        rainbow: false
      },
      GOLD: {
        id: 'GOLD',
        name: '金',
        main: '#F1C40F',
        edge: '#B7950B',
        bg: '#31280d',
        rainbow: false
      },
      RAINBOW: {
        id: 'RAINBOW',
        name: '彩',
        main: '#ff6bcb',
        edge: '#5ee7ff',
        bg: '#251b31',
        rainbow: true
      }
    };
    CONFIG.QUALITY = QUALITY;
    CONFIG.COLORS.RARITY_COMMON = QUALITY.WHITE.edge;
    CONFIG.COLORS.RARITY_RARE = QUALITY.BLUE.main;
    CONFIG.COLORS.RARITY_EPIC = QUALITY.PURPLE.main;
    CONFIG.COLORS.RARITY_LEGENDARY = QUALITY.RAINBOW.main;
    CONFIG.COLORS.CARD_COMMON_BORDER = QUALITY.WHITE.edge;
    CONFIG.COLORS.CARD_COMMON_BG = QUALITY.WHITE.bg;
    CONFIG.COLORS.CARD_RARE_BG = QUALITY.BLUE.bg;
    CONFIG.COLORS.CARD_EPIC_BG = QUALITY.PURPLE.bg;
    CONFIG.COLORS.CARD_LEGENDARY_BG = QUALITY.RAINBOW.bg;
    CONFIG.TEXT.RARITY = {
      COMMON: '白',
      RARE: '蓝',
      EPIC: '紫',
      LEGENDARY: '彩'
    };
    function hit(p, x, y, w, h) {
      return p && UI.isPointInRect(p, x, y, w, h);
    }
    function tap() {
      return Input.pendingTap.active ? Input.pendingTap : null;
    }
    function text(ctx, s, x, y, size, color, align, bold) {
      ctx.save();
      ctx.font = (bold ? 'bold ' : '') + size + 'px Arial,"Microsoft YaHei"';
      ctx.textAlign = align || 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color || '#fff';
      ctx.fillText(s, x, y);
      ctx.restore();
    }
    function panel(ctx, x, y, w, h, r, fill, stroke) {
      UI.roundedRectPath(ctx, x, y, w, h, r);
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
    }
    function rainbow(ctx, x, y, w, h) {
      var g = ctx.createLinearGradient(x, y, x + w, y + h),
        phase = Date.now() % 2400 / 2400 * 360,
        N = 6;
      for (var i = 0; i <= N; i++) root.safeStop(g, i / N, 'hsl(' + (phase + i * 60) % 360 + ',90%,60%)');
      return g;
    }

    // ---------- #46 升级候选数据校验 ----------

    // ---------- #43 营地两层导航 ----------
    var CampNav = {
      page: 'select'
    };
    root.CampNav = CampNav;
    UI.getBaseTabRects = function (top) {
      var y = CONFIG.UI.BASE_TAB_Y + top,
        w = 330,
        g = 20;
      return [{
        x: 35,
        y: y,
        w: w,
        h: CONFIG.UI.BASE_TAB_HEIGHT
      }, {
        x: 35 + w + g,
        y: y,
        w: w,
        h: CONFIG.UI.BASE_TAB_HEIGHT
      }];
    };
    function drawBack(ctx, title) {
      var top = CONFIG.UI.TOP_INSET || 0;
      UI.drawActionButton(ctx, 24, 30 + top, 132, 60, '返回', true, 22);
      var baseIcon = UI.icon('nav_base');
      if (baseIcon) ctx.drawImage(baseIcon, 176, 42 + top, 48, 48);
      UI.drawCenteredText(ctx, title, 75 + top, 42, true, '#f4d58d');
    }
    function drawMoney(ctx) {
      var top = CONFIG.UI.TOP_INSET || 0;
      // v014 #88：幸存者硬币配 coin_survivor 图标（蓝银盾牌闪电），数字蓝银色；与右侧钻石左右分开不重叠。
      var coinTxt = String(Meta.data.survivorCoins);
      var icon = UI.icon('menu_coin_survivor') || UI.icon('coin_survivor');
      if (icon) ctx.drawImage(icon, 535 - coinTxt.length * 12 - 10 - 22, 125 + top - 11, 22, 22);
      text(ctx, coinTxt, 535, 125 + top, 20, (CONFIG.COLORS.SURVIVOR_COIN || '#9fd6ff'), 'right', true);
      var diamondTxt = String(Meta.data.diamonds || 0), diamond = UI.icon('icon_diamond');
      if (diamond) ctx.drawImage(diamond, 715 - diamondTxt.length * 12 - 12 - 24, 113 + top, 24, 24);
      text(ctx, diamondTxt, 715, 125 + top, 20, '#c995ff', 'right', true);
    }
    function drawCampSelect(ctx) {
      var top = CONFIG.UI.TOP_INSET || 0;
      ctx.fillStyle = CONFIG.COLORS.MENU_BACKGROUND;
      ctx.fillRect(0, 0, 750, CONFIG.VIEW.HEIGHT);
      UI.drawMenuGlow(ctx);
      drawBack(ctx, '幸存者营地');
      drawMoney(ctx);
      drawEntry(ctx, 75, 245 + top, '强化', '永久属性与道具升级', 'tab_enhance', '#65c7ff');
      drawEntry(ctx, 75, 565 + top, '外观', '角色服装与武器涂装', 'tab_appearance', '#f1a457');
      drawBaseObjective(ctx);
    }
    // v014 #98 局外引导：基地显示眼下最相关目标（未完成、进度最高的永久成就）+ 进度条。
    // 成就 def 元组 [id, 名称, 进度键, 目标, 积分]；用持久 achievements.progress[进度键]。
    function baseObjective() {
      var defs = (root.Achievements && root.Achievements.defs) || [];
      var data = Meta.data.achievements || { completed: [], progress: {} };
      var best = null, ratio = 0;
      for (var i = 0; i < defs.length; i++) {
        var d = defs[i];
        if (data.completed.indexOf(d[0]) >= 0) continue;
        var cur = data.progress[d[2]] || 0;
        if (cur > 0 && cur < d[3] && cur / d[3] > ratio) { best = d; ratio = cur / d[3]; }
      }
      if (!best) return null;
      return { name: best[1], cur: Math.min(best[3], data.progress[best[2]] || 0), target: best[3] };
    }
    function drawBaseObjective(ctx) {
      var top = CONFIG.UI.TOP_INSET || 0;
      var ob = baseObjective();
      var x = 75, y = 855 + top, w = 600, h = 120;
      panel(ctx, x, y, w, h, 22, 'rgba(23,35,31,.97)', '#7dd39a');
      text(ctx, CONFIG.TEXT.PRODUCT.BASE_OBJECTIVE, x + 28, y + 34, 20, '#7dd39a', 'left', true);
      if (ob) {
        text(ctx, ob.name, x + 28, y + 68, 24, '#fff', 'left', true);
        text(ctx, ob.cur + '/' + ob.target, x + w - 28, y + 68, 22, '#ffd166', 'right', true);
        var bx = x + 28, bw = w - 56, bh = 12, by = y + 94;
        UI.roundedRectPath(ctx, bx, by, bw, bh, 6);
        ctx.fillStyle = '#1c2b25';
        ctx.fill();
        var frac = Math.max(0, Math.min(1, ob.cur / ob.target));
        if (frac > 0.02) {
          UI.roundedRectPath(ctx, bx, by, Math.max(bh, bw * frac), bh, 6);
          ctx.fillStyle = '#7dd39a';
          ctx.fill();
        }
      } else {
        text(ctx, CONFIG.TEXT.PRODUCT.TRY_TURRET, x + 28, y + 72, 20, '#b7c7bf', 'left');
      }
    }
    function drawEntry(ctx, x, y, title, desc, iconKey, col) {
      panel(ctx, x, y, 600, 250, 25, 'rgba(23,35,31,.97)', col);
      ctx.save();
      ctx.globalAlpha = .16;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x + 105, y + 125, 72, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      var entryIcon = UI.icon(iconKey);
      if (entryIcon) ctx.drawImage(entryIcon, x + 57, y + 77, 96, 96);
      text(ctx, title, x + 220, y + 95, 40, '#fff', 'left', true);
      text(ctx, desc, x + 220, y + 150, 20, '#b7c7bf', 'left');
      text(ctx, '进入  ›', x + 525, y + 202, 18, col, 'right', true);
    }
    function drawEnhance(ctx) {
      var top = CONFIG.UI.TOP_INSET || 0;
      ctx.fillStyle = CONFIG.COLORS.MENU_BACKGROUND;
      ctx.fillRect(0, 0, 750, CONFIG.VIEW.HEIGHT);
      UI.drawMenuGlow(ctx);
      drawBack(ctx, '强化');
      drawMoney(ctx);
      var tabs = enhanceTabs(top), labels = ['角色/武器', '炮塔强化', '道具强化', '技能强化'], icons = ['', 'tab_turret', 'tab_item', 'tab_skill'];
      for (var i = 0; i < 4; i++) {
        var rr = tabs[i], enabled = i !== 3, active = UI.baseTab === ['character','turret','item','skill'][i];
        UI.drawActionButton(ctx, rr.x, rr.y, rr.w, rr.h, labels[i], enabled && active, 18);
        var ti = icons[i] && UI.icon(icons[i]); if (ti) ctx.drawImage(ti, rr.x + 8, rr.y + 8, 36, 36);
      }
      if (UI.baseTab === 'turret') { UI.baseGadgetFilter = 'turret'; UI.drawBaseGadget(ctx, top); }
      else if (UI.baseTab === 'item') { UI.baseGadgetFilter = 'item'; UI.drawBaseGadget(ctx, top); }
      else UI.drawBaseCharacter(ctx, top);
      if (root.DevConsole) root.DevConsole.draw(ctx);
    }
    UI.drawBase = function (ctx) {
      if (CampNav.page === 'select') drawCampSelect(ctx);else if (CampNav.page === 'enhance') drawEnhance(ctx);else if (CampNav.page === 'appearance') Wardrobe.draw(ctx);
    };
    root.MenuController = root.MenuController || {};
    root.MenuController.updateBase = function (dt) {
      var p = tap(),
        top = CONFIG.UI.TOP_INSET || 0;
      if (CampNav.page === 'select') {
        if (!p) return;
        if (hit(p, 24, 30 + top, 132, 60)) {
          Input.clearTap();
          this.enterMenu();
        } else if (hit(p, 75, 245 + top, 600, 250)) {
          Input.clearTap();
          CampNav.page = 'enhance';
          UI.baseTab = 'character';
        } else if (hit(p, 75, 565 + top, 600, 250)) {
          Input.clearTap();
          CampNav.page = 'appearance';
          Wardrobe.open = true;
        }
        return;
      }
      if (CampNav.page === 'appearance') {
        Wardrobe.handle();
        return;
      }
      updateEnhance();
    };
    function updateEnhance() {
      var p = tap(),
        top = CONFIG.UI.TOP_INSET || 0;
      if (!p) return;
      if (hit(p, 24, 30 + top, 132, 60)) {
        Input.clearTap();
        CampNav.page = 'select';
        return;
      }
      var tabs = enhanceTabs(top), modes = ['character','turret','item','skill'];
      for (var ti = 0; ti < tabs.length; ti++) if (hit(p, tabs[ti].x, tabs[ti].y, tabs[ti].w, tabs[ti].h)) {
        Input.clearTap();
        if (modes[ti] === 'skill') { Meta.showToast('功能开发中'); return; }
        UI.baseTab = modes[ti]; UI.baseGadgetIndex = 0; return;
      }
      var action = UI.consumeBaseAction();
      if (action === 1001) {
        UI.baseTab = 'character';
        UI.baseTabFade = 0;
      } else if (action === 1002) {
        UI.baseTab = 'gadget';
        UI.baseTabFade = 0;
      } else if (action === 1010) UI.baseCharacterPage = Math.max(0, UI.baseCharacterPage - 1);else if (action === 1011) UI.baseCharacterPage++;else if (action === 1020) UI.baseGadgetIndex = Math.max(0, UI.baseGadgetIndex - 1);else if (action === 1021) UI.baseGadgetIndex++;else if (action >= 0 && action < CONFIG.META.UPGRADES.length) Meta.buy(CONFIG.META.UPGRADES[action]);else if (action >= 100 && action < 200) {
        var code = action - 100,
          gi = Math.floor(code / 10),
          ii = code % 10,
          ids = Object.keys(CONFIG.META.GADGET_UPGRADES), gid;
        if (UI.baseTab === 'turret') ids = ids.filter(function (id) { return id.indexOf('turret_') === 0; });
        if (UI.baseTab === 'item') ids = ids.filter(function (id) { return ['laser','bomb','medkit','magnet','freeze'].indexOf(id) >= 0; });
        gid = ids[gi];
        if (gid && CONFIG.META.GADGET_UPGRADES[gid].items[ii]) Meta.buyGadget(gid, CONFIG.META.GADGET_UPGRADES[gid].items[ii].ID);
      }
    }
    function enhanceTabs(top) {
      var out = [], w = 320, h = 54;
      for (var i = 0; i < 4; i++) out.push({ x: 45 + (i % 2) * 340, y: CONFIG.UI.BASE_TAB_Y + top + Math.floor(i / 2) * 62, w: w, h: h });
      return out;
    }

    // 外观页返回营地选择页。

    Wardrobe.handle = function () {
      var p = tap(),
        top = CONFIG.UI.TOP_INSET || 0;
      if (p && hit(p, 24, 30 + top, 132, 58)) {
        Input.clearTap();
        Wardrobe.open = false;
        CampNav.page = 'select';
        return;
      }
      if (p && this.mode === 'skin' && p.y >= 176 + top && p.y <= 220 + top) {
        var ids = ['pulse', 'flame', 'crossbow', 'blade'];
        for (var wi = 0; wi < 4; wi++) if (hit(p, 25 + wi * 181, 176 + top, 158, 44)) {
          Input.clearTap();
          this.weapon = ids[wi];
          return;
        }
      }
      var filterY = 176 + top + (this.mode === 'skin' ? 56 : 0);
      if (p && hit(p, 267, filterY, 216, 44)) {
        Input.clearTap();
        this.cycle('rarity', ['all', 'WHITE', 'BLUE', 'PURPLE', 'GOLD', 'RAINBOW']);
        return;
      }
      this.handleSelection();
    };

    // ---------- #44 外观五档品质 ----------
    var outfitQuality = {
      default: 'WHITE',
      cowboy: 'WHITE',
      firefighter: 'WHITE',
      special: 'BLUE',
      medic: 'BLUE',
      ninja: 'BLUE',
      punk: 'BLUE',
      hunter: 'PURPLE',
      mechanic: 'PURPLE',
      necromancer: 'PURPLE',
      gold: 'GOLD',
      shadow: 'RAINBOW'
    };
    var skinQuality = {
      default: 'WHITE',
      pulse_silver: 'BLUE',
      pulse_red: 'BLUE',
      pulse_blue: 'PURPLE',
      pulse_gold: 'GOLD',
      blade_blood: 'BLUE',
      blade_thunder: 'PURPLE',
      blade_void: 'RAINBOW',
      flame_green: 'BLUE',
      flame_hell: 'PURPLE',
      flame_frost: 'RAINBOW',
      bow_hunter: 'BLUE',
      bow_machine: 'PURPLE',
      bow_holy: 'GOLD'
    };
    Wardrobe.rarity = function (d) {
      return this.mode === 'outfit' ? outfitQuality[d[0]] || 'WHITE' : skinQuality[d[0]] || 'WHITE';
    };
    Wardrobe.quality = function (d) {
      return QUALITY[this.rarity(d)] || QUALITY.WHITE;
    };
    Wardrobe.drawGridCard = function (ctx, d, x, y, w, h) {
      var q = this.quality(d),
        owned = this.isOwned(d),
        equipped = this.isEquipped(d),
        locked = d[3] === 'achievement',
        edge = q.rainbow ? rainbow(ctx, x, y, w, h) : q.edge;
      panel(ctx, x, y, w, h, 18, locked ? '#151918' : q.bg, edge);
      text(ctx, q.name, x + 18, y + 24, 14, q.main, 'left', true);
      this.drawPreview(ctx, d, x + w / 2, y + 125, 72, q.main);
      text(ctx, d[1], x + w / 2, y + 220, 20, q.rainbow ? edge : q.main, 'center', true);
      var price = d[3] === 'free' ? '初始拥有' : d[3] === 'achievement' ? '成就解锁' : d[4] + ' ' + (d[3] === 'diamonds' ? '钻石' : '幸存者硬币');
      text(ctx, price, x + w / 2, y + 254, 15, d[3] === 'diamonds' ? '#83d7ff' : '#ffd166', 'center');
      var enabled = !equipped && !locked,
        caption = equipped ? '已装备' : owned ? '装备' : locked ? '尚未解锁' : '购买';
      UI.drawActionButton(ctx, x + 40, y + h - 78, w - 80, 56, caption, enabled, 18);
      if (locked) {
        ctx.save();
        ctx.globalAlpha = .42;
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, w, h);
        ctx.restore();
        text(ctx, '成就解锁', x + w / 2, y + h / 2, 18, '#fff', 'center', true);
      }
    };

    // 固定对象池的彩档穿戴光点，不在主循环 new。
    var RainbowFX = {
      pool: [],
      time: 0,
      init: function () {
        for (var i = 0; i < 18; i++) this.pool.push({
          a: i * Math.PI * 2 / 18,
          r: 34 + i % 3 * 8,
          s: .7 + i % 5 * .08
        });
      },
      active: function () {
        return Meta.data.currentOutfit === 'shadow' || Meta.data.equippedSkins.blade === 'blade_void' || Meta.data.equippedSkins.flame === 'flame_frost';
      },
      update: function (dt) {
        if (this.active()) this.time += dt;
      },
      draw: function (ctx) {
        if (!this.active() || Game.state !== CONFIG.GAME.STATE_PLAYING) return;
        var x = Player.x - Camera.x,
          y = Player.y - Camera.y;
        ctx.save();
        for (var i = 0; i < this.pool.length; i++) {
          var p = this.pool[i],
            a = p.a + this.time * p.s;
          ctx.globalAlpha = .45 + .3 * Math.sin(this.time * 3 + i);
          ctx.fillStyle = 'hsl(' + (i * 40 + this.time * 90) % 360 + ',90%,65%)';
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * p.r, y + Math.sin(a) * p.r, 2 + i % 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    };
    RainbowFX.init();
    root.RainbowFX = RainbowFX;

    // 命运牌色板同步：白、蓝、紫、彩，不再使用橙色。
    if (FateCards) {
      FateCards.rarities = [['COMMON', 50, QUALITY.WHITE.edge], ['RARE', 30, QUALITY.BLUE.main], ['EPIC', 15, QUALITY.PURPLE.main], ['LEGENDARY', 5, QUALITY.RAINBOW.main]];
      FateCards.drawCard = function (ctx, i) {
        var c = this.cards[i],
          baseY = Math.max((CONFIG.UI.TOP_INSET || 0) + 115, Math.min(260, CONFIG.VIEW.HEIGHT - (CONFIG.UI.BOTTOM_INSET || 0) - 965)),
          x = 95 + i % 3 * 180,
          y = baseY + Math.floor(i / 3) * 240,
          progress = c.t / .3,
          scaleX = c.open ? Math.abs(Math.cos(progress * Math.PI)) : 1;
        ctx.save();
        ctx.translate(x + 80, y + 110);
        ctx.scale(Math.max(.03, scaleX), 1);
        ctx.translate(-80, -110);
        UI.roundedRectPath(ctx, 0, 0, 160, 220, 14);
        if (!c.open || progress < .5) {
          ctx.fillStyle = '#1A1A2E';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#d6aa55';
          ctx.stroke();
          ctx.fillStyle = '#d6aa55';
          ctx.font = 'bold 44px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('☠', 80, 126);
        } else {
          var d = c.def,
            id = d && d[3],
            q = id === 'COMMON' ? QUALITY.WHITE : id === 'RARE' ? QUALITY.BLUE : id === 'EPIC' ? QUALITY.PURPLE : QUALITY.RAINBOW,
            col = q.rainbow ? rainbow(ctx, 0, 0, 160, 220) : q.main;
          ctx.fillStyle = q.bg;
          ctx.fill();
          ctx.lineWidth = id === 'COMMON' ? 2 : 3;
          ctx.strokeStyle = col;
          ctx.stroke();
          ctx.fillStyle = col;
          ctx.font = 'bold 28px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(this.icon(d[4]), 80, 70);
          ctx.font = 'bold 18px Arial,"Microsoft YaHei"';
          ctx.fillText(d[1], 80, 125);
          ctx.fillStyle = '#eee8db';
          ctx.font = '14px Arial,"Microsoft YaHei"';
          this.wrap(ctx, d[2], 80, 160, 135, 20);
          if (i === this.selected) {
            ctx.strokeStyle = '#59e58a';
            ctx.lineWidth = 5;
            ctx.stroke();
          }
        }
        ctx.restore();
      };
    }
    root.CampTheme = {
      QUALITY: QUALITY,
      CampNav: CampNav,
      RainbowFX: RainbowFX
    };
  })();

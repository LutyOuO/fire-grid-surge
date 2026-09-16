(function () {
  'use strict';

  // 界面控制：菜单、基地、外观、成就、命运牌；战斗实体由各业务模块提供。
  var root = typeof window !== 'undefined' ? window : global;
  var CONFIG = root.CONFIG;
  var Game = root.Game,
    UI = root.UI,
    Input = root.Input,
    Meta = root.Meta,
    Player = root.Player,
    Enemy = root.Enemy,
    Bullet = root.Bullet,
    Camera = root.Camera,
    Combat = root.Combat,
    Weapons = root.Weapons,
    PulseGun = root.PulseGun,
    OrbitBlade = root.OrbitBlade,
    PowerUps = root.PowerUps,
    Spawner = root.Spawner,
    RunStats = root.RunStats,
    Field = root.Field,
    LaserEmitter = root.LaserEmitter,
    FX = root.FX,
    ButtonUI = root.ButtonUI,
    Panels = root.Panels,
    Settings = root.Settings,
    Ads = root.Ads,
    AudioFX = root.AudioFX,
    ExpLevelUp = root.ExpLevelUp,
    BossSystem = root.BossSystem,
    Metrics = root.Metrics,
    CanvasView = root.CanvasView,
    Platform = root.Platform;

  // ---------- 功能分区 ----------
  'use strict';
  (function () {
    // ============================================================
    // 界面与内容：隐藏开发者控制台 / 结算命运抽牌 / 迫击炮表现增强
    // ============================================================
    var root = typeof window !== 'undefined' ? window : global;
    var CONFIG = root.CONFIG,
      UI = root.UI,
      Input = root.Input,
      Game = root.Game;
    var Platform = root.Platform,
      Camera = root.Camera;
    var Player = root.Player,
      Enemy = root.Enemy,
      Spawner = root.Spawner;
    var Meta = root.Meta,
      ExpLevelUp = root.ExpLevelUp,
      PowerUps = root.PowerUps;
    var PulseGun = root.PulseGun,
      OrbitBlade = root.OrbitBlade,
      Ads = root.Ads;
    var V4C = {
      CARD_X: 95,
      CARD_Y: 260,
      CARD_W: 160,
      CARD_H: 220,
      CARD_GAP: 20,
      DEV_X: 690,
      DEV_Y: 58,
      DEV_SIZE: 40,
      PANEL_X: 55,
      PANEL_Y: 165,
      PANEL_W: 640,
      PANEL_H: 1010
    };
    function button(ctx, x, y, w, h, text, enabled, size) {
      UI.drawActionButton(ctx, x, y, w, h, text, enabled !== false, size || 20);
    }
    function inRect(p, x, y, w, h) {
      return UI.isPointInRect(p, x, y, w, h);
    }
    function centered(ctx, text, y, size, color) {
      UI.drawCenteredText(ctx, text, y, size, true, color || CONFIG.COLORS.TEXT);
    }
    function fateTop() {
      var h = CONFIG.VIEW.HEIGHT,
        top = CONFIG.UI.TOP_INSET || 0,
        bottom = CONFIG.UI.BOTTOM_INSET || 0;
      var y = Math.max(top + 115, Math.min(260, h - bottom - 965));
      V4C.CARD_Y = y;
      return y;
    }
    function devButtonY() {
      return (CONFIG.UI.TOP_INSET || 0) + 175;
    }

    // ---------- #20 隐藏式开发者控制台 ----------
    var DevConsole = {
      active: false,
      open: false,
      taps: [],
      god: false,
      timeScale: 1,
      clearConfirm: false,
      toggleActivation: function () {
        this.active = !this.active;
        this.open = false;
        this.taps.length = 0;
        this.clearConfirm = false;
        if (!this.active) {
          this.god = false;
          this.timeScale = 1;
        }
        Meta.showToast(this.active ? '开发者控制台已激活' : '开发者控制台已隐藏');
      },
      logoTap: function () {
        var now = Date.now();
        this.taps.push(now);
        while (this.taps.length && now - this.taps[0] >= 500) this.taps.shift();
        if (this.taps.length >= 5) this.toggleActivation();
      },
      handleInput: function () {
        if (!Input.pendingTap.active || Ads.active) return false;
        var p = {
          x: Input.pendingTap.x,
          y: Input.pendingTap.y
        };
        if (Game.state === CONFIG.GAME.STATE_MENU && !this.open && inRect(p, 90, 60, 570, 250)) {
          Input.clearTap();
          this.logoTap();
          return true;
        }
        if (this.active && !this.open && inRect(p, V4C.DEV_X - 20, devButtonY() - 20, 40, 40)) {
          Input.clearTap();
          this.open = true;
          return true;
        }
        if (!this.open) return false;
        Input.clearTap();
        if (!inRect(p, V4C.PANEL_X, V4C.PANEL_Y, V4C.PANEL_W, V4C.PANEL_H) || inRect(p, 635, 180, 42, 42)) {
          this.open = false;
          this.clearConfirm = false;
          return true;
        }
        this.activateAt(p);
        return true;
      },
      activateAt: function (p) {
        var levels = [10, 20, 50, 100];
        for (var i = 0; i < 4; i++) if (inRect(p, 85 + i * 145, 280, 125, 62)) this.addLevels(levels[i]);
        if (inRect(p, 85, 385, 270, 66)) this.god = !this.god;
        if (inRect(p, 395, 385, 270, 66)) {
          Meta.data.coins += 10000;
          Meta.save();
        }
        if (inRect(p, 85, 490, 270, 66)) this.maxMeta();
        if (inRect(p, 395, 490, 125, 66)) this.spawn(CONFIG.ENEMY.TYPE_ELITE);
        if (inRect(p, 540, 490, 125, 66)) this.spawn(CONFIG.ENEMY.TYPE_BOSS);
        for (var s = 0; s < 3; s++) if (inRect(p, 85 + s * 195, 595, 170, 66)) this.timeScale = [1, 2, 4][s];
        if (inRect(p, 85, 700, 270, 66)) root.Settings.debug = !root.Settings.debug;
        if (inRect(p, 395, 700, 270, 66)) {
          if (!this.clearConfirm) this.clearConfirm = true;else {
            Platform.removeStorage ? Platform.removeStorage(CONFIG.SAVE.KEY) : Platform.setStorage(CONFIG.SAVE.KEY, '');
            Meta.data = Meta.createDefaultData();
            Meta.save(false);
            this.clearConfirm = false;
          }
        }
      },
      addLevels: function (count) {
        if (Game.state !== CONFIG.GAME.STATE_PLAYING) {
          Meta.showToast('快速升级仅在战斗中可用');
          return;
        }
        NextRun.level(count);
        this.open = false;
      },
      skipLevels: function () {
        var guard = 500;
        while (ExpLevelUp.pendingChoices > 0 && guard-- > 0) {
          if (!ExpLevelUp.prepareOffers()) break;
          var pick = Math.floor(Math.random() * ExpLevelUp.offerCount);
          var o = ExpLevelUp.offers[pick];
          ExpLevelUp.applyUpgrade(o.definition, o.rarity);
          ExpLevelUp.levels[o.definition.ID] += 1;
          ExpLevelUp.pendingChoices -= 1;
        }
        ExpLevelUp.pendingChoices = 0;
        Game.resumePlaying();
      },
      maxMeta: function () {
        for (var i = 0; i < CONFIG.META.UPGRADES.length; i++) Meta.data.upg[CONFIG.META.UPGRADES[i].ID] = CONFIG.META.UPGRADES[i].MAX_LEVEL;
        for (var g in CONFIG.META.GADGET_UPGRADES) for (var j = 0; j < CONFIG.META.GADGET_UPGRADES[g].items.length; j++) {
          var d = CONFIG.META.GADGET_UPGRADES[g].items[j];
          Meta.data.upg.gadget[g][d.ID] = d.MAX_LEVEL;
        }
        Meta.save();
        Meta.showToast('局外升级已全部点满');
      },
      spawn: function (type) {
        if (Game.state !== CONFIG.GAME.STATE_PLAYING) return;
        Enemy.spawn(Math.min(CONFIG.WORLD.WIDTH - 100, Player.x + 260), Player.y, type, Spawner.getHpMultiplier(Game.survivedSeconds));
      },
      drawButton: function (ctx) {
        if (!this.active) return;
        var y = devButtonY();
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#123d2a';
        ctx.fillRect(V4C.DEV_X - 20, y - 20, 40, 40);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DEV', V4C.DEV_X, y);
        ctx.restore();
      },
      draw: function (ctx) {
        this.drawButton(ctx);
        if (!this.open) return;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,.72)';
        ctx.fillRect(0, 0, 750, 1334);
        UI.roundedRectPath(ctx, V4C.PANEL_X, V4C.PANEL_Y, V4C.PANEL_W, V4C.PANEL_H, 22);
        ctx.fillStyle = '#13231d';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#59e58a';
        ctx.stroke();
        centered(ctx, '开发者控制台', 215, 34, '#8dffb1');
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('×', 656, 207);
        centered(ctx, '快速升级（仅战斗）', 260, 21, '#ffd166');
        var lv = [10, 20, 50, 100];
        for (var i = 0; i < 4; i++) button(ctx, 85 + i * 145, 280, 125, 62, '+' + lv[i] + '级', Game.state === CONFIG.GAME.STATE_PLAYING, 19);
        button(ctx, 85, 385, 270, 66, '无敌：' + (this.god ? '开启' : '关闭'), true, 20);
        button(ctx, 395, 385, 270, 66, '金币 +10000', true, 20);
        button(ctx, 85, 490, 270, 66, '点满局外升级', true, 20);
        button(ctx, 395, 490, 125, 66, '刷精英', Game.state === CONFIG.GAME.STATE_PLAYING, 18);
        button(ctx, 540, 490, 125, 66, '刷 Boss', Game.state === CONFIG.GAME.STATE_PLAYING, 18);
        for (var s = 0; s < 3; s++) button(ctx, 85 + s * 195, 595, 170, 66, [1, 2, 4][s] + 'x', true, 22);
        button(ctx, 85, 700, 270, 66, '调试信息：' + (root.Settings.debug ? '开' : '关'), true, 19);
        button(ctx, 395, 700, 270, 66, this.clearConfirm ? '再次点击确认清档' : '清除存档', true, 18);
        centered(ctx, '倍速：' + this.timeScale + 'x · 坐标 ' + Math.round(Player.x) + ',' + Math.round(Player.y), 815, 18, '#b7c9bf');
        centered(ctx, '点击面板外或右上角关闭', 1115, 18, '#8da298');
        ctx.restore();
      }
    };

    // ---------- #21 82张命运牌 ----------
    var FateCards = {
      active: false,
      cards: [],
      selected: -1,
      shuffleUsed: false,
      flash: 0,
      particles: [],
      rarities: [['COMMON', 50, '#95A5A6'], ['RARE', 30, '#3498DB'], ['EPIC', 15, '#E67E22'], ['LEGENDARY', 5, '#ffd54a']],
      defs: [],
      initDefs: function () {
        var C = 'COMMON',
          R = 'RARE',
          E = 'EPIC',
          L = 'LEGENDARY';
        this.defs = [[1, '强健体魄', '最大生命 +20', C, 'MAX_HP', 20], [2, '轻盈步伐', '移速 +10%', C, 'MOVE', .1], [3, '武器打磨', '伤害 +10%', C, 'DAMAGE', .1], [4, '快速射击', '攻速 +10%', C, 'FIRE', .1], [5, '锐利目光', '暴击率 +5%', C, 'CRIT', .05], [6, '致命一击', '暴击伤害 +20%', C, 'CRIT_DMG', .2], [7, '磁力增强', '拾取范围 +15%', C, 'PICKUP', .15], [8, '领悟之力', '经验获取 +15%', C, 'EXP', .15], [9, '贪婪之手', '金币获取 +15%', C, 'GOLD', .15], [10, '穿透弹', '子弹穿透 +1', C, 'PIERCE', 1], [11, '多重射击', '子弹弹道 +1', C, 'PROJECTILE', 1], [12, '飞刃专精', '飞刃数量 +1', C, 'BLADE_COUNT', 1], [13, '飞刃加速', '飞刃转速 +20%', C, 'BLADE_SPEED', .2], [14, '飞刃强化', '飞刃伤害 +20%', C, 'BLADE_DAMAGE', .2], [15, '坚韧意志', '受击无敌 +0.2秒', C, 'INV_TIME', .2], [16, '生命回复', '每3秒回复2生命', C, 'REGEN', {
          n: 2,
          t: 3
        }], [17, '皮糙肉厚', '受到伤害 -5%', C, 'REDUCE', .05], [18, '先发制人', '开局等级 +2', C, 'START_LEVEL', 2], [19, '虚弱诅咒', '敌人血量 -10%', C, 'ENEMY_HP', .1], [20, '减速陷阱', '敌人速度 -10%', C, 'ENEMY_SPEED', .1], [21, '喘息空间', '刷怪间隔 +0.2秒', C, 'SPAWN_GAP', .2], [22, '经验丰收', '经验晶石价值 +20%', C, 'EXP', .2], [23, '金币丰收', '金币掉落 +20%', C, 'GOLD', .2], [24, '幸运儿', '道具掉率 +20%', C, 'DROP', .2], [25, '爆破专家', '开局炸弹 +1', C, 'ITEM', [0, 1]], [26, '磁力王', '开局磁铁 +1', C, 'ITEM', [1, 1]], [27, '医疗兵', '开局血包 +1', C, 'ITEM', [2, 1]], [28, '冰霜法师', '开局冻结 +1', C, 'ITEM', [3, 1]], [29, '冲刺大师', '冲刺冷却 -2秒', C, 'DASH_CD', 2], [30, '疾风步', '冲刺速度 +20%', C, 'DASH_SPEED', .2], [31, '持久冲刺', '冲刺时长 +0.3秒', C, 'DASH_TIME', .3], [32, '远程射击', '子弹寿命 +0.3秒', C, 'BULLET_LIFE', .3], [33, '高速弹', '弹速 +15%', C, 'BULLET_SPEED', .15], [34, '生命强化', '最大生命 +30', C, 'MAX_HP', 30], [35, '余生机会', '免费复活 +1', C, 'REVIVE', 1], [36, '短暂无敌', '开局无敌30秒', R, 'START_INV', 30], [37, '自动炮击', '每15秒自动炮击', R, 'AUTO_MORTAR', 15], [38, '弹幕开局', '开局弹道 +4', R, 'PROJECTILE', 4], [39, '急速射击', '射速 +50%', R, 'FIRE', .5], [40, '重型弹药', '伤害 +30%', R, 'DAMAGE', .3], [41, '风之疾走', '移速 +25%', R, 'MOVE', .25], [42, '鹰眼', '暴击率 +15%', R, 'CRIT', .15], [43, '毁灭打击', '暴击伤害 +50%', R, 'CRIT_DMG', .5], [44, '黑洞磁场', '拾取范围 +40%', R, 'PICKUP', .4], [45, '顿悟', '经验获取 +30%', R, 'EXP', .3], [46, '点金术', '金币获取 +30%', R, 'GOLD', .3], [47, '高位起步', '开局等级 +5', R, 'START_LEVEL', 5], [48, '瘟疫使者', '敌人血量 -20%', R, 'ENEMY_HP', .2], [49, '冰霜领域', '敌人速度 -15%', R, 'ENEMY_SPEED', .15], [50, '吸血攻击', '每击杀回复3生命', R, 'KILL_HEAL', 3], [51, '能量护盾', '20%可再生护盾', R, 'SHIELD', .2], [52, '时间加速', '武器冷却 -20%', R, 'COOLDOWN', .2], [53, '双飞刃', '飞刃数量 +2', R, 'BLADE_COUNT', 2], [54, '穿甲弹', '子弹穿透 +3', R, 'PIERCE', 3], [55, '三连射', '子弹弹道 +2', R, 'PROJECTILE', 2], [56, '道具猎人', '道具掉率 +50%', R, 'DROP', .5], [57, '冲刺狂人', '冲刺冷却 -4秒', R, 'DASH_CD', 4], [58, '钢铁之躯', '受到伤害 -20%', R, 'REDUCE', .2], [59, '全屏磁吸', '晶石自动全屏吸附', R, 'FULL_MAGNET', 1], [60, '全副武装', '四种道具各 +1', R, 'ALL_ITEMS', 1], [61, '神圣庇护', '开局无敌60秒', E, 'START_INV', 60], [62, '无冷却炮击', '每8秒自动炮击', E, 'AUTO_MORTAR', 8], [63, '枪林弹雨', '开局弹道 +7', E, 'PROJECTILE', 7], [64, '暴风射击', '射速 +80%', E, 'FIRE', .8], [65, '毁灭之力', '伤害 +60%', E, 'DAMAGE', .6], [66, '武器过载', '伤害/弹道/穿透 ×2', E, 'WEAPON_OVERLOAD', 2], [67, '暴击宗师', '暴击率+25% 暴伤+100%', E, 'CRIT_MASTER', 1], [68, '疾风剑圣', '移速+40% 冲刺冷却-50%', E, 'WIND_MASTER', 1], [69, '衰弱光环', '敌人血量 -35%', E, 'ENEMY_HP', .35], [70, '黄金时代', '金币获取 +100%', E, 'GOLD', 1], [71, '智慧之光', '经验+50% 开局等级+8', E, 'WISDOM', 1], [72, '生命汲取', '击杀回血5，10%掉血包', E, 'LIFE_DRAIN', 1], [73, '自动激光', '每20秒自动激光', E, 'AUTO_LASER', 20], [74, '永恒冰封', '每25秒自动冻结3秒', E, 'AUTO_FREEZE', 25], [75, '激光化', '主武器激光化，伤害+50%', E, 'LASER', 1], [76, '不死之身', '下一局全程无敌', L, 'GOD', 1], [77, '战神降世', '武器伤害×3，攻速×2', L, 'WAR_GOD', 1], [78, '天选之人', '开局直接50级', L, 'CHOSEN', 50], [79, '割草模式', '敌血-50%，速度-30%', L, 'MOW', 1], [80, '爆肝模式', '金币×5，经验×3', L, 'GRIND', 1], [81, '神之怒', '每10秒自动清屏', L, 'AUTO_CLEAR', 10], [82, '万物主宰', '所有道具轮流自动释放', L, 'ITEM_MASTER', 1]];
      },
      open: function () {
        this.active = true;
        this.selected = -1;
        this.picked = [];
        this.revealIndex = 0;
        this.phase = 'pick';
        this.phaseTimer = 0;
        this.shuffleUsed = false;
        this.flash = 0;
        this.deal();
        Input.clearTap();
      },
      rollRarity: function () {
        var n = Math.random() * 100;
        for (var i = 0; i < this.rarities.length; i++) {
          n -= this.rarities[i][1];
          if (n < 0) return this.rarities[i][0];
        }
        return 'COMMON';
      },
      deal: function () {
        this.cards.length = 0;
        for (var i = 0; i < 9; i++) {
          var r = this.rollRarity(),
            pool = [];
          for (var j = 0; j < this.defs.length; j++) if (this.defs[j][3] === r) pool.push(this.defs[j]);
          this.cards.push({
            def: pool[Math.floor(Math.random() * pool.length)],
            open: false,
            t: 0
          });
        }
      },
      allOpen: function () {
        for (var i = 0; i < this.cards.length; i++) if (!this.cards[i].open) return false;
        return this.cards.length === 9;
      },
      update: function (dt) {
        this.flash = Math.max(0, this.flash - dt);
        for (var i = 0; i < this.cards.length; i++) if (this.cards[i].t > 0 && this.cards[i].t < .3) this.cards[i].t = Math.min(.3, this.cards[i].t + dt);
        if (this.phase === 'pick') {
          if (!Input.pendingTap.active) return;
          var p = Input.pendingTap;
          Input.clearTap();
          var top = Math.max((CONFIG.UI.TOP_INSET || 0) + 115, Math.min(260, CONFIG.VIEW.HEIGHT - (CONFIG.UI.BOTTOM_INSET || 0) - 965));
          for (var n = 0; n < 9; n++) {
            var x = 95 + n % 3 * 180,
              y = top + Math.floor(n / 3) * 240;
            if (UI.isPointInRect(p, x, y, 160, 220)) {
              this.flip(n, true);
              return;
            }
          }
          return;
        }
        this.phaseTimer -= dt;
        if (this.phase === 'reveal' && this.phaseTimer <= 0) {
          while (this.revealIndex < 9 && this.cards[this.revealIndex].open) this.revealIndex++;
          if (this.revealIndex < 9) {
            this.flip(this.revealIndex++, false);
            this.phaseTimer = CONFIG.BALANCE.FATE_REVEAL_GAP;
          } else {
            this.phase = 'show';
            this.phaseTimer = CONFIG.BALANCE.FATE_SHOW_TIME;
          }
        } else if (this.phase === 'show' && this.phaseTimer <= 0) {
          this.phase = 'fly';
          this.phaseTimer = CONFIG.BALANCE.FATE_FLY_TIME;
        } else if (this.phase === 'fly' && this.phaseTimer <= 0) this.confirm();
      },
      flip: function (i, playerPick) {
        var c = this.cards[i];
        if (!c || c.open) return;
        if (playerPick !== false && this.picked.length >= CONFIG.BALANCE.FATE_PICK_COUNT) return;
        c.open = true;
        c.t = .001;
        if (playerPick !== false) {
          this.picked.push(i);
          if (this.selected < 0) this.selected = i;
        }
        if (c.def[3] === 'LEGENDARY') {
          this.flash = .2;
          if (root.AudioFX) root.AudioFX.play('level');
        }
        if (root.FX) root.FX.legendaryBurst(Player.x, Player.y);
        if (playerPick !== false && this.picked.length === CONFIG.BALANCE.FATE_PICK_COUNT) {
          this.phase = 'reveal';
          this.phaseTimer = CONFIG.BALANCE.FATE_REVEAL_GAP;
        }
      },
      confirm: function () {
        var buffs = [];
        for (var i = 0; i < this.picked.length; i++) {
          var d = this.cards[this.picked[i]].def;
          buffs.push({
            cardId: d[0],
            rarity: d[3],
            effectType: d[4],
            effectValue: d[5],
            name: d[1]
          });
        }
        Meta.data.nextRunBuffs = buffs;
        Meta.data.nextRunBuff = null;
        Meta.save();
        this.active = false;
        Game.enterMenu();
      },
      skip: function () {
        Meta.data.nextRunBuff = null;
        Meta.data.nextRunBuffs = [];
        Meta.save();
        this.active = false;
        Game.enterMenu();
      },
      requestShuffle: function () {
        var self = this;
        Ads.showRewarded(CONFIG.ADS.PLACEMENT_CARD_SHUFFLE, function () {
          if (!self.active || self.shuffleUsed) return;
          self.shuffleUsed = true;
          self.selected = -1;
          self.deal();
        }, Game.handleAdFail.bind(Game));
      },
      draw: function (ctx) {
        var top = Math.max((CONFIG.UI.TOP_INSET || 0) + 115, Math.min(260, CONFIG.VIEW.HEIGHT - (CONFIG.UI.BOTTOM_INSET || 0) - 965));
        ctx.save();
        ctx.fillStyle = '#090d14';
        ctx.fillRect(0, 0, 750, CONFIG.VIEW.HEIGHT);
        UI.drawCenteredText(ctx, '命运抽取', top - 78, 42, true, '#f4d58d');
        UI.drawCenteredText(ctx, '剩余翻牌：' + Math.max(0, 3 - this.picked.length) + ' / 3', top - 34, 22, true, this.picked.length < 3 ? '#77ddff' : '#59e58a');
        for (var i = 0; i < 9; i++) {
          ctx.save();
          if (this.phase === 'fly' && this.picked.indexOf(i) < 0) {
            var q = 1 - Math.max(0, this.phaseTimer) / CONFIG.BALANCE.FATE_FLY_TIME;
            ctx.translate(0, -q * 360);
            ctx.globalAlpha = 1 - q;
          }
          this.drawCard(ctx, i);
          ctx.restore();
        }
        if (this.phase === 'reveal') UI.drawCenteredText(ctx, '正在揭晓其余命运牌…', top + 735, 20, false, '#d9cfb5');else if (this.phase === 'show' || this.phase === 'fly') UI.drawCenteredText(ctx, '你翻开的3张牌将在下一局生效', top + 735, 20, true, '#59e58a');
        ctx.restore();
      },
      drawCard: function (ctx, i) {
        var c = this.cards[i],
          x = V4C.CARD_X + i % 3 * 180,
          y = V4C.CARD_Y + Math.floor(i / 3) * 240;
        var progress = c.t / .3,
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
          ctx.strokeStyle = 'rgba(214,170,85,.2)';
          for (var k = 16; k < 160; k += 24) {
            ctx.beginPath();
            ctx.moveTo(k, 0);
            ctx.lineTo(0, k);
            ctx.stroke();
          }
          ctx.fillStyle = '#d6aa55';
          ctx.font = 'bold 44px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('☠', 80, 126);
        } else {
          var d = c.def,
            r = d[3],
            col = r === 'COMMON' ? '#95A5A6' : r === 'RARE' ? '#3498DB' : r === 'EPIC' ? '#E67E22' : '#ffd54a';
          ctx.fillStyle = r === 'COMMON' ? '#222928' : r === 'RARE' ? '#132b3a' : r === 'EPIC' ? '#332317' : '#251c31';
          ctx.fill();
          ctx.lineWidth = r === 'EPIC' || r === 'LEGENDARY' ? 3 : 2;
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
      },
      icon: function (t) {
        if (t.indexOf('HP') >= 0 || t.indexOf('REGEN') >= 0) return '♥';
        if (t.indexOf('FIRE') >= 0 || t.indexOf('COOLDOWN') >= 0) return '⚡';
        if (t.indexOf('GOLD') >= 0) return '◆';
        if (t.indexOf('BLADE') >= 0) return '✦';
        return '●';
      },
      wrap: function (ctx, text, x, y, max, line) {
        var chars = text.split(''),
          s = '';
        for (var i = 0; i < chars.length; i++) {
          if (ctx.measureText(s + chars[i]).width > max) {
            ctx.fillText(s, x, y);
            s = chars[i];
            y += line;
          } else s += chars[i];
        }
        ctx.fillText(s, x, y);
      }
    };
    FateCards.initDefs();

    // ---------- 下一局增益应用与自动效果 ----------
    var NextRun = {
      buff: null,
      regen: 0,
      autoMortar: 0,
      autoLaser: 0,
      autoFreeze: 0,
      autoClear: 0,
      itemMaster: 0,
      itemStep: 0,
      reset: function () {
        this.buff = null;
        this.periods = {};
        this.regen = 0;
        this.autoMortar = 0;
        this.autoLaser = 0;
        this.autoFreeze = 0;
        this.autoClear = 0;
        this.itemMaster = 0;
        this.itemStep = 0;
      },
      apply: function (b, stack) {
        if (!stack) this.reset();
        if (!b) return;
        this.buff = b;
        var t = b.effectType,
          v = b.effectValue;
        if (t === 'MAX_HP') {
          Player.maxHp += v;
          Player.hp += v;
        } else if (t === 'MOVE') Player.moveSpeedBonus += v;else if (t === 'DAMAGE') Player.globalDamageBonus += v;else if (t === 'FIRE') PulseGun.fireRateBonus += v;else if (t === 'CRIT') Player.critChance += v;else if (t === 'CRIT_DMG') Player.critDamageBonus += v;else if (t === 'PICKUP') Player.pickupRadius *= 1 + v;else if (t === 'EXP') Player.expGainBonus += v;else if (t === 'GOLD') Player.nextGoldBonus = v;else if (t === 'PIERCE') PulseGun.penetration += v;else if (t === 'PROJECTILE') PulseGun.projectileCount += v;else if (t === 'BLADE_COUNT') OrbitBlade.count += v;else if (t === 'BLADE_SPEED') OrbitBlade.speedBonus += v;else if (t === 'BLADE_DAMAGE') OrbitBlade.damageFlat += CONFIG.WEAPONS.BLADE.DAMAGE * v;else if (t === 'INV_TIME') Player.invincibleTimeBonus = v;else if (t === 'REGEN') {
          Player.nextRegen = v;
          this.regen = v.t;
        } else if (t === 'REDUCE') Player.incomingDamageMultiplier *= 1 - v;else if (t === 'START_LEVEL') this.level(v);else if (t === 'ENEMY_HP') Player.nextEnemyHp = 1 - v;else if (t === 'ENEMY_SPEED') Player.enemySpeedMultiplier *= 1 - v;else if (t === 'SPAWN_GAP') Player.nextSpawnGap = v;else if (t === 'DROP') Player.nextDropBonus = v;else if (t === 'ITEM') PowerUps.inventory[v[0]] += v[1];else if (t === 'DASH_CD') Player.nextDashCd = v;else if (t === 'DASH_SPEED') Player.nextDashSpeed = v;else if (t === 'DASH_TIME') Player.nextDashTime = v;else if (t === 'BULLET_LIFE') Player.nextBulletLife = v;else if (t === 'BULLET_SPEED') PulseGun.speedFlat += CONFIG.WEAPONS.PULSE.SPEED * v;else if (t === 'REVIVE') Player.reviveCharges += v;else if (t === 'START_INV') Player.invincibleTimer = v;else if (t === 'AUTO_MORTAR') this.autoMortar = v;else if (t === 'KILL_HEAL') Player.killHeal += v;else if (t === 'SHIELD') {
          Player.upgradeShieldMax = Player.maxHp * v;
          Player.shield = Player.upgradeShieldMax;
        } else if (t === 'COOLDOWN') {
          PulseGun.cooldownMultiplier *= 1 - v;
          OrbitBlade.cooldownMultiplier *= 1 - v;
        } else if (t === 'FULL_MAGNET') Player.pickupRadius = 9999;else if (t === 'ALL_ITEMS') for (var i = 0; i < 4; i++) PowerUps.inventory[i]++;else if (t === 'WEAPON_OVERLOAD') {
          Player.globalDamageBonus += 1;
          PulseGun.projectileMultiplier *= 2;
          PulseGun.penetration = Math.max(1, PulseGun.penetration * 2);
        } else if (t === 'CRIT_MASTER') {
          Player.critChance += .25;
          Player.critDamageBonus += 1;
        } else if (t === 'WIND_MASTER') {
          Player.moveSpeedBonus += .4;
          Player.nextDashCdRatio = .5;
        } else if (t === 'WISDOM') {
          Player.expGainBonus += .5;
          this.level(8);
        } else if (t === 'LIFE_DRAIN') {
          Player.killHeal += 5;
          Player.nextMedkitDrop = .1;
        } else if (t === 'AUTO_LASER') this.autoLaser = v;else if (t === 'AUTO_FREEZE') this.autoFreeze = v;else if (t === 'LASER') {
          PulseGun.laserCannon = true;
          PulseGun.damageMultiplier *= 1.5;
        } else if (t === 'GOD') Player.nextGod = true;else if (t === 'WAR_GOD') {
          Player.globalDamageBonus += 2;
          PulseGun.fireRateBonus += 1;
        } else if (t === 'CHOSEN') this.level(Math.max(0, 50 - ExpLevelUp.level));else if (t === 'MOW') {
          Player.nextEnemyHp = .5;
          Player.enemySpeedMultiplier *= .7;
        } else if (t === 'GRIND') {
          Player.nextGoldBonus = 4;
          Player.expGainBonus += 2;
        } else if (t === 'AUTO_CLEAR') this.autoClear = v;else if (t === 'ITEM_MASTER') this.itemMaster = 5;
      },
      // 精确提升 N 级，不再经过经验倍率，避免“+8级”被经验加成放大为 +9级。
      level: function (n) {
        n = Math.max(0, Math.min(100, Math.floor(n)));
        for (var i = 0; i < n; i++) {
          ExpLevelUp.level += 1;
          ExpLevelUp.need = ExpLevelUp.getNeed(ExpLevelUp.level);
          ExpLevelUp.pendingChoices += 1;
        }
      },
      update: function (dt) {
        if (Game.state !== CONFIG.GAME.STATE_PLAYING) return;
        if (Player.nextRegen) {
          this.regen -= dt;
          if (this.regen <= 0) {
            Player.hp = Math.min(Player.maxHp, Player.hp + Player.nextRegen.n);
            this.regen = Player.nextRegen.t;
          }
        }
        this.tick('autoMortar', dt, function () {
          root.MortarStrike.activate();
        });
        this.tick('autoLaser', dt, function () {
          root.LaserEmitter.activate();
        });
        this.tick('autoFreeze', dt, function () {
          PowerUps.freezeTimer = Math.max(PowerUps.freezeTimer, 3);
        });
        this.tick('autoClear', dt, function () {
          PowerUps.useBomb();
        });
        if (this.itemMaster > 0) {
          this.itemMaster -= dt;
          if (this.itemMaster <= 0) {
            var idx = this.itemStep++ % 6;
            PowerUps.inventory[idx] = Math.max(1, PowerUps.inventory[idx]);
            PowerUps.activate(idx);
            this.itemMaster = 5;
          }
        }
      },
      tick: function (key, dt, fn) {
        if (this[key] > 0) {
          if (!this.periods[key]) this.periods[key] = this[key];
          this[key] -= dt;
          if (this[key] <= 0) {
            fn();
            this[key] = this.periods[key];
          }
        }
      },
      // 每局先重置一次，再应用保存的三张牌；自动效果各自保留周期。
      start: function () {
        var buffs = Meta.data.nextRunBuffs && Meta.data.nextRunBuffs.slice(0, CONFIG.BALANCE.FATE_PICK_COUNT);
        if (!buffs || !buffs.length) buffs = Meta.data.nextRunBuff ? [Meta.data.nextRunBuff] : [];
        this.reset();
        Player.nextGoldBonus = 0;
        Player.nextEnemyHp = 1;
        Player.nextSpawnGap = 0;
        Player.nextDropBonus = 0;
        Player.nextMedkitDrop = 0;
        Player.nextGod = false;
        Player.invincibleTimeBonus = 0;
        Player.nextRegen = null;
        Player.nextDashCd = 0;
        Player.nextDashCdRatio = 0;
        Player.nextDashSpeed = 0;
        Player.nextDashTime = 0;
        Player.nextBulletLife = 0;
        var chosen = false;
        for (var i = 0; i < buffs.length; i++) {
          this.apply(buffs[i], true);
          if (buffs[i].effectType === 'CHOSEN') chosen = true;
        }
        if (buffs.length) {
          Meta.data.nextRunBuffs = [];
          Meta.data.nextRunBuff = null;
          Meta.save(false);
        }
        if (chosen) DevConsole.skipLevels();else if (ExpLevelUp.hasPendingChoice()) Game.enterLevelUp();
      }
    };

    // 属性钩子

    // 冲刺/子弹时效使用局内属性，不污染全局 CONFIG。

    // 状态机与界面接入

    Platform.onKeyDown(function (e) {
      if (e.code === 'Backquote' && !e.repeat) {
        if (e.preventDefault) e.preventDefault();
        if (!DevConsole.active) DevConsole.active = true;
        DevConsole.open = !DevConsole.open;
        Input.clearTap();
      }
    });

    // ---------- #22 迫击炮对象池与完整表现 ----------

    var MenuOverlay = {
      draw: function (ctx) {
        if (Game.state === 'FATE') FateCards.draw(ctx);else if (Game.state === 'RUNTIME_ERROR') {
          ctx.save();
          ctx.fillStyle = 'rgba(5,8,7,.94)';
          ctx.fillRect(0, 0, 750, 1334);
          centered(ctx, '检测到运行异常', 430, 38, '#ff6b6b');
          centered(ctx, '游戏循环已安全暂停，没有继续卡死', 495, 22, '#fff');
          var msg = String(Game.runtimeError || '未知异常').split('\n')[0].slice(0, 70);
          centered(ctx, msg, 555, 16, '#ffd8a8');
          centered(ctx, '请截图这一页发给我', 620, 22, '#ffd166');
          centered(ctx, '点击任意位置返回主菜单', 760, 22, '#59e58a');
          ctx.restore();
        } else DevConsole.draw(ctx);
      },
      DevConsole: DevConsole,
      FateCards: FateCards,
      NextRun: NextRun,
      MortarFX: root.MortarFX
    };
    root.DevConsole = DevConsole;
    root.FateCards = FateCards;
    root.NextRun = NextRun;
    root.MenuOverlay = MenuOverlay;
  })();

  // ---------- 功能分区 ----------
  'use strict';
  (function () {
    // ============================================================
    // 界面与内容：钻石 / 局内目标 / 喷火器 / 弩箭 / 外观 / 涂装 / 永久成就
    // 所有新增实体均使用固定对象池；本模块封装作用域，兼容 H5 普通 script。
    // ============================================================
    var root = typeof window !== 'undefined' ? window : global;
    var CONFIG = root.CONFIG,
      Game = root.Game,
      UI = root.UI,
      Input = root.Input,
      Meta = root.Meta;
    var Player = root.Player,
      Enemy = root.Enemy,
      Camera = root.Camera,
      Combat = root.Combat;
    var ExpLevelUp = root.ExpLevelUp,
      RunStats = root.RunStats,
      Weapons = root.Weapons;
    root.Combat.killSource = '';
    // v005 新增可调数值统一挂在全局 CONFIG，后续平衡时无需搜索业务函数。

    function hit(p, x, y, w, h) {
      return UI.isPointInRect(p, x, y, w, h);
    }
    function tap() {
      if (!Input.pendingTap.active) return null;
      return {
        x: Input.pendingTap.x,
        y: Input.pendingTap.y
      };
    }
    function text(ctx, s, x, y, size, color, align) {
      ctx.fillStyle = color || '#fff';
      ctx.font = (size || 20) + 'px Arial,"Microsoft YaHei"';
      ctx.textAlign = align || 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(s, x, y);
    }
    function panel(ctx, x, y, w, h, r, fill, stroke) {
      UI.roundedRectPath(ctx, x, y, w, h, r || 14);
      ctx.fillStyle = fill || 'rgba(10,19,22,.96)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke || '#55766a';
      ctx.stroke();
    }
    function diamond(ctx, x, y, size) {
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = '#3498DB';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#3498DB';
      ctx.strokeStyle = '#2980B9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * .75, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * .75, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath();
      ctx.moveTo(-size * .2, -size * .45);
      ctx.lineTo(size * .25, -size * .1);
      ctx.stroke();
      ctx.restore();
    }

    // ---------- 配置追加：两把局内武器和强化词条 ----------
    var additions = [{
      ID: 'UNLOCK_FLAME',
      TEXT_KEY: 'UNLOCK_FLAME',
      RARITY: 'RARE',
      EFFECT: 'UNLOCK_FLAME',
      MAX_LEVEL: 1,
      weapon: 'flamer'
    }, {
      ID: 'FLAME_DAMAGE',
      TEXT_KEY: 'FLAME_DAMAGE',
      EFFECT: 'FLAME_DAMAGE',
      MAX_LEVEL: 5,
      weapon: 'flamer'
    }, {
      ID: 'FLAME_RATE',
      TEXT_KEY: 'FLAME_RATE',
      EFFECT: 'FLAME_RATE',
      MAX_LEVEL: 5,
      weapon: 'flamer'
    }, {
      ID: 'FLAME_ANGLE',
      TEXT_KEY: 'FLAME_ANGLE',
      EFFECT: 'FLAME_ANGLE',
      MAX_LEVEL: 3,
      weapon: 'flamer'
    }, {
      ID: 'FLAME_RANGE',
      TEXT_KEY: 'FLAME_RANGE',
      EFFECT: 'FLAME_RANGE',
      MAX_LEVEL: 3,
      weapon: 'flamer'
    }, {
      ID: 'FLAME_BURN',
      TEXT_KEY: 'FLAME_BURN',
      EFFECT: 'FLAME_BURN',
      MAX_LEVEL: 3,
      weapon: 'flamer'
    }, {
      ID: 'UNLOCK_CROSSBOW',
      TEXT_KEY: 'UNLOCK_CROSSBOW',
      RARITY: 'RARE',
      EFFECT: 'UNLOCK_CROSSBOW',
      MAX_LEVEL: 1,
      weapon: 'crossbow'
    }, {
      ID: 'BOW_DAMAGE',
      TEXT_KEY: 'BOW_DAMAGE',
      EFFECT: 'BOW_DAMAGE',
      MAX_LEVEL: 5,
      weapon: 'crossbow'
    }, {
      ID: 'BOW_RATE',
      TEXT_KEY: 'BOW_RATE',
      EFFECT: 'BOW_RATE',
      MAX_LEVEL: 5,
      weapon: 'crossbow'
    }, {
      ID: 'BOW_COUNT',
      TEXT_KEY: 'BOW_COUNT',
      EFFECT: 'BOW_COUNT',
      MAX_LEVEL: 3,
      weapon: 'crossbow'
    }, {
      ID: 'BOW_DECAY',
      TEXT_KEY: 'BOW_DECAY',
      EFFECT: 'BOW_DECAY',
      MAX_LEVEL: 3,
      weapon: 'crossbow'
    }, {
      ID: 'BOW_CRIT',
      TEXT_KEY: 'BOW_CRIT',
      EFFECT: 'BOW_CRIT',
      MAX_LEVEL: 3,
      weapon: 'crossbow'
    }];
    for (var ai = 0; ai < additions.length; ai++) CONFIG.UPGRADES.DEFINITIONS.push(additions[ai]);
    var names = {
      UNLOCK_FLAME: ['解锁喷火器', '新增自动扇形喷火武器'],
      FLAME_DAMAGE: ['烈焰强化', '喷火器伤害 +20%'],
      FLAME_RATE: ['急速喷射', '喷火器攻速 +15%'],
      FLAME_ANGLE: ['烈焰扩散', '扇形角度 +15°'],
      FLAME_RANGE: ['烈焰延伸', '射程 +30px'],
      FLAME_BURN: ['持久灼烧', '燃烧持续 +1秒'],
      UNLOCK_CROSSBOW: ['解锁弩箭', '新增无限穿透弩箭武器'],
      BOW_DAMAGE: ['精准射击', '弩箭伤害 +25%'],
      BOW_RATE: ['快速装填', '弩箭攻速 +15%'],
      BOW_COUNT: ['连弩', '弩箭数量 +1'],
      BOW_DECAY: ['穿透强化', '穿透衰减 -10%'],
      BOW_CRIT: ['重击', '弩箭暴击率 +10%']
    };
    for (var nk in names) (function (k) {
      CONFIG.TEXT.UPGRADES[k] = {
        NAME: names[k][0],
        DESC: function () {
          return names[k][1];
        }
      };
    })(nk);

    // ---------- 钻石反馈 ----------
    var DiamondFX = {
      text: '',
      timer: 0,
      add: function (n, reason) {
        n = Math.max(0, Math.floor(n));
        if (!n) return;
        Meta.data.diamonds += n;
        var p = Meta.data.achievements && Meta.data.achievements.progress;
        if (p) p.diamondsTotal = (p.diamondsTotal || 0) + n;
        Meta.save();
        this.text = (reason ? reason + '  ' : '') + '+' + n + ' 钻石';
        this.timer = 2;
      },
      update: function (dt) {
        this.timer = Math.max(0, this.timer - dt);
      },
      draw: function (ctx) {
        if (this.timer <= 0) return;
        var p = 1 - this.timer / 2,
          b = 1 + Math.sin(Math.min(1, p / .25) * Math.PI) * .18;
        ctx.save();
        ctx.translate(375, 235);
        ctx.scale(b, b);
        ctx.globalAlpha = Math.min(1, this.timer * 2);
        panel(ctx, -155, -32, 310, 64, 18, 'rgba(10,28,42,.94)', '#3498DB');
        diamond(ctx, -112, 0, 13);
        text(ctx, this.text, 18, 0, 24, '#83d7ff', 'center');
        ctx.restore();
      }
    };

    // ---------- 每局随机三个小目标 ----------
    var Objectives = {
      active: [],
      collapsed: false,
      notice: 0,
      last: {
        kills: 0,
        level: 1,
        wave: 0,
        items: 0,
        dashes: 0
      },
      defs: [['survive120', '存活120秒', 'time', 120, 5], ['kill50', '击杀50名敌人', 'kills', 50, 5], ['level10', '升到10级', 'level', 10, 5], ['exp100', '拾取100经验', 'exp', 100, 5], ['dash3', '使用3次冲刺', 'dash', 3, 5], ['item2', '使用2个道具', 'items', 2, 5], ['coin5', '拾取5金币', 'coins', 5, 5], ['elite1', '击杀1只精英', 'elite', 1, 5], ['rare1', '获得1个稀有词条', 'rare', 1, 5], ['safe30', '连续30秒不受伤', 'safe', 30, 5], ['survive300', '存活300秒', 'time', 300, 10], ['kill200', '击杀200名敌人', 'kills', 200, 10], ['level20', '升到20级', 'level', 20, 10], ['mortar30', '迫击炮击杀30', 'mortar', 30, 10], ['bomb20', '炸弹击杀20', 'bomb', 20, 10], ['dash5', '使用5次冲刺', 'dash', 5, 10], ['item5', '使用5个道具', 'items', 5, 10], ['elite3', '击杀3只精英', 'elite', 3, 10], ['epic1', '获得1个史诗词条', 'epic', 1, 10], ['wave5', '坚持到第5波', 'wave', 5, 10], ['coin500', '获得500金币', 'coins', 500, 10], ['still10', '静止10秒不受伤', 'still', 10, 10], ['survive600', '存活600秒', 'time', 600, 20], ['kill500', '击杀500名敌人', 'kills', 500, 20], ['level30', '升到30级', 'level', 30, 20], ['mortar80', '迫击炮击杀80', 'mortar', 80, 20], ['nodash120', '不冲刺存活120秒', 'nodash', 120, 20], ['boss1', '击杀Boss', 'boss', 1, 20], ['legend1', '获得1个传说词条', 'legend', 1, 20], ['wave10', '坚持到第10波', 'wave', 10, 20], ['extract1', '成功撤退', 'extract', 1, 20], ['coin2000', '获得2000金币', 'coins', 2000, 20]],
      stats: {},
      reset: function () {
        this.active.length = 0;
        this.stats = {
          kills: 0,
          level: 1,
          wave: 0,
          exp: 0,
          dash: 0,
          items: 0,
          coins: 0,
          elite: 0,
          boss: 0,
          rare: 0,
          epic: 0,
          legend: 0,
          mortar: 0,
          bomb: 0,
          extract: 0,
          safe: 0,
          still: 0,
          nodash: 0
        };
        this.collapsed = false;
        this.notice = 0;
        var pool = this.defs.slice();
        for (var i = 0; i < 3; i++) {
          var n = Math.floor(Math.random() * pool.length),
            d = pool.splice(n, 1)[0];
          this.active.push({
            d: d,
            done: false,
            flash: 0
          });
        }
      },
      add: function (k, n) {
        this.stats[k] = (this.stats[k] || 0) + (n || 1);
      },
      update: function (dt) {
        if (Game.state !== CONFIG.GAME.STATE_PLAYING) return;
        this.stats.time = Game.survivedSeconds;
        this.stats.level = ExpLevelUp.level;
        this.stats.wave = root.Spawner.waveIndex;
        if (Math.hypot(Input.moveX || 0, Input.moveY || 0) < .05) this.stats.still += dt;else this.stats.still = 0;
        this.stats.safe += dt;
        this.stats.nodash = Game.survivedSeconds - (this.stats.dash ? 120 : 0);
        for (var i = 0; i < this.active.length; i++) {
          var o = this.active[i];
          o.flash = Math.max(0, o.flash - dt);
          if (!o.done && (this.stats[o.d[2]] || 0) >= o.d[3]) {
            o.done = true;
            o.flash = .3;
            DiamondFX.add(o.d[4], '目标完成！');
          }
        }
        this.notice = Math.max(0, this.notice - dt);
      },
      onDamage: function () {
        this.stats.safe = 0;
        this.stats.still = 0;
      },
      handle: function () {
        var p = tap();
        if (!p) return false;
        var x = CONFIG.UI.OBJ_X,
          y = CONFIG.UI.OBJ_TOP,
          w = CONFIG.UI.OBJ_W,
          ch = CONFIG.UI.OBJ_COLLAPSED_H;
        if (this.collapsed) {
          if (hit(p, x, y, w, ch)) {
            this.collapsed = false;
            Input.clearTap();
            return true;
          }
          return false;
        }
        var eh = this._eh || CONFIG.UI.OBJ_EXPANDED_H;
        if (hit(p, x, y, w, eh)) {
          this.collapsed = true;
          Input.clearTap();
          return true;
        }
        if (p.x < 480) {
          this.collapsed = true;
          Input.clearTap();
          return true;
        }
        return false;
      },
      draw: function (ctx) {
        var x = CONFIG.UI.OBJ_X,
          y = CONFIG.UI.OBJ_TOP,
          w = CONFIG.UI.OBJ_W,
          i,
          o,
          val,
          yy,
          ratio,
          done = 0;
        for (i = 0; i < this.active.length; i++) if (this.active[i].done) done++;
        var topIdx = 0;
        while (topIdx < this.active.length && this.active[topIdx].done) topIdx++;
        var maxH = CONFIG.VIEW.HEIGHT * 0.4;
        ctx.save();
        if (this.collapsed) {
          var ch = CONFIG.UI.OBJ_COLLAPSED_H;
          panel(ctx, x, y, w, ch, 12, 'rgba(7,15,18,.92)', 'rgba(63,208,229,.55)');
          text(ctx, '目标', x + 16, y + ch / 2, 22, '#eaf6ff', 'left');
          ctx.font = 'bold 24px Arial,"Microsoft YaHei"';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#F1C40F';
          ctx.fillText(done + '/3', x + 66, y + ch / 2);
          if (topIdx < this.active.length) {
            o = this.active[topIdx];
            val = Math.min(o.d[3], Math.floor(this.stats[o.d[2]] || 0));
            text(ctx, o.d[1] + ' ' + val + '/' + o.d[3], x + w - 14, y + ch / 2, 20, '#cfe8ee', 'right');
          } else text(ctx, '全部完成', x + w - 14, y + ch / 2, 20, '#59e58a', 'right');
        } else {
          var eh = Math.min(CONFIG.UI.OBJ_EXPANDED_H, maxH);
          this._eh = eh;
          panel(ctx, x, y, w, eh, 12, 'rgba(7,15,18,.92)', 'rgba(255,255,255,.4)');
          text(ctx, '本局目标', x + 16, y + 26, 24, '#ffffff', 'left');
          ctx.font = 'bold 22px Arial,"Microsoft YaHei"';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#F1C40F';
          ctx.fillText(done + '/3', x + w - 16, y + 26);
          for (var j = 0; j < this.active.length; j++) {
            o = this.active[j];
            yy = y + 58 + j * 52;
            val = Math.min(o.d[3], Math.floor(this.stats[o.d[2]] || 0));
            ratio = val / o.d[3];
            ctx.fillStyle = o.done ? 'rgba(47,201,102,0.18)' : 'rgba(20,40,58,0.85)';
            ctx.fillRect(x + 10, yy - 21, w - 20, 44);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = (o.done ? 'bold ' : '') + '22px Arial,"Microsoft YaHei"';
            ctx.fillStyle = o.done ? '#59e58a' : '#f4fff7';
            ctx.fillText((o.done ? '✓ ' : '') + o.d[1], x + 22, yy - 4);
            ctx.textAlign = 'right';
            ctx.font = 'bold 20px Arial,"Microsoft YaHei"';
            ctx.fillStyle = o.done ? '#59e58a' : '#ffd54a';
            ctx.fillText(o.done ? '已完成' : val + '/' + o.d[3], x + w - 60, yy + 2);
            ctx.font = 'bold 15px Arial,"Microsoft YaHei"';
            ctx.fillStyle = '#83d7ff';
            ctx.fillText(String(o.d[4]), x + w - 34, yy + 2);
            diamond(ctx, x + w - 16, yy + 2, 8);
            ctx.fillStyle = 'rgba(255,255,255,.12)';
            ctx.fillRect(x + 22, yy + 16, w - 44, 3);
            ctx.fillStyle = o.done ? '#59e58a' : '#3498DB';
            ctx.fillRect(x + 22, yy + 16, (w - 44) * Math.min(1, ratio), 3);
          }
        }
        ctx.restore();
      }
    };
    var FlameWeapon = root.FlameWeapon,
      Crossbow = root.Crossbow;
    // 喷火器实体由 weapon.js 提供。

    // ---------- 弩箭：固定对象池，无限穿透，到世界边界回收 ----------

    // 词条应用

    // ---------- 永久成就（29项） ----------
    var Achievements = {
      open: false,
      scroll: 0,
      defs: [],
      toast: '',
      toastTime: 0,
      init: function () {
        var rows = [['A1', '初出茅庐', '累计击杀50', 'kills', 50, 'coins', 50], ['A2', '百人斩', '累计击杀100', 'kills', 100, 'skin', 'pulse_silver'], ['A3', '千人斩', '累计击杀1000', 'kills', 1000, 'diamonds', 100], ['A4', '万人斩', '累计击杀10000', 'kills', 10000, 'diamonds', 200], ['A5', '精英猎人', '击杀50精英', 'elite', 50, 'diamonds', 100], ['A6', '精英克星', '击杀200精英', 'elite', 200, 'skin', 'blade_blood'], ['A7', 'Boss终结者', '击杀10 Boss', 'boss', 10, 'skin', 'pulse_gold'], ['A8', '炮火洗礼', '迫击炮击杀500', 'mortar', 500, 'skin', 'flame_hell'], ['A9', '幸存者', '累计存活1小时', 'time', 3600, 'coins', 100], ['A10', '坚韧不拔', '累计存活10小时', 'time', 36000, 'outfit', 'special'], ['A11', '马拉松', '单局存活600秒', 'bestTime', 600, 'diamonds', 100], ['A12', '毫发无伤', '连续60秒不受伤', 'safe', 60, 'diamonds', 50], ['A13', '不死鸟', '单局复活3次', 'revives', 3, 'outfit', 'ninja'], ['A14', '小富翁', '累计获得10000金币', 'coinsTotal', 10000, 'coins', 200], ['A15', '大富翁', '累计获得100000金币', 'coinsTotal', 100000, 'skin', 'blade_thunder'], ['A16', '钻石收藏家', '累计获得100钻石', 'diamondsTotal', 100, 'diamonds', 50], ['A17', '道具猎人', '拾取100道具', 'items', 100, 'skin', 'bow_hunter'], ['A18', '经验大师', '拾取10000经验', 'exp', 10000, 'diamonds', 100], ['A19', '等级突破', '单局20级', 'bestLevel', 20, 'coins', 50], ['A20', '满级大佬', '单局50级', 'bestLevel', 50, 'diamonds', 200], ['A21', '波次征服者', '单局第10波', 'bestWave', 10, 'outfit', 'mechanic'], ['A22', '终极挑战', '单局第20波', 'bestWave', 20, 'outfit', 'gold'], ['A23', '词条收藏家', '单局5史诗', 'epicRun', 5, 'diamonds', 100], ['A24', '天选之人', '单局3传说', 'legendRun', 3, 'skin', 'bow_holy'], ['A25', '战略家', '撤退10次', 'extract', 10, 'skin', 'flame_frost'], ['A26', '神枪手', '弩箭单局击杀100', 'bowRun', 100, 'diamonds', 50], ['A27', '烈焰法师', '喷火器单局击杀200', 'flameRun', 200, 'diamonds', 100], ['A28', '服装收藏家', '拥有5套服装', 'outfits', 5, 'diamonds', 100], ['A29', '涂装收藏家', '拥有5个涂装', 'skins', 5, 'skin', 'blade_void']];
        for (var i = 0; i < rows.length; i++) this.defs.push(rows[i]);
      },
      add: function (k, n) {
        var p = Meta.data.achievements.progress;
        p[k] = (p[k] || 0) + (n || 1);
        this.check();
      },
      set: function (k, n) {
        var p = Meta.data.achievements.progress;
        p[k] = Math.max(p[k] || 0, n);
        this.check();
      },
      check: function () {
        var p = Meta.data.achievements.progress,
          c = Meta.data.achievements.completed,
          changed = false;
        for (var i = 0; i < this.defs.length; i++) {
          var d = this.defs[i];
          if (c.indexOf(d[0]) >= 0 || (p[d[3]] || 0) < d[4]) continue;
          c.push(d[0]);
          this.reward(d);
          this.toast = '成就解锁：' + d[1];
          this.toastTime = 3;
          changed = true;
        }
        if (changed) Meta.save(false);
      },
      reward: function (d) {
        var t = d[5],
          v = d[6];
        if (t === 'coins') Meta.data.coins += v;else if (t === 'diamonds') {
          Meta.data.diamonds += v;
          Meta.data.achievements.progress.diamondsTotal = (Meta.data.achievements.progress.diamondsTotal || 0) + v;
        } else if (t === 'outfit') Wardrobe.ownOutfit(v);else if (t === 'skin') Wardrobe.ownSkin(v);
      },
      drawToast: function (ctx) {
        if (this.toastTime <= 0) return;
        panel(ctx, 145, 285, 460, 75, 18, 'rgba(45,34,12,.95)', '#ffd54a');
        text(ctx, '🏆 ' + this.toast, 375, 322, 23, '#ffe49a', 'center');
      },
      draw: function (ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,.72)';
        ctx.fillRect(0, 0, 750, CONFIG.VIEW.HEIGHT);
        var y = Math.max(170, CONFIG.VIEW.HEIGHT * .22),
          h = CONFIG.VIEW.HEIGHT - y;
        panel(ctx, 30, y, 690, h, 24, '#111d1a', '#d6aa55');
        text(ctx, '永久成就', 70, y + 48, 34, '#f4d58d');
        text(ctx, '已完成 ' + Meta.data.achievements.completed.length + ' / 29', 520, y + 48, 18, '#ffd54a', 'center');
        text(ctx, '×', 680, y + 48, 34, '#fff', 'center');
        var start = Math.floor(this.scroll),
          firstY = y + 95;
        for (var i = 0; i < 7; i++) {
          var d = this.defs[start + i];
          if (!d) break;
          var yy = firstY + i * 92,
            done = Meta.data.achievements.completed.indexOf(d[0]) >= 0,
            val = Math.min(d[4], Math.floor(Meta.data.achievements.progress[d[3]] || 0));
          panel(ctx, 52, yy, 646, 80, 12, done ? 'rgba(107,84,25,.45)' : '#18231f', done ? '#d6aa55' : '#40584e');
          text(ctx, done ? '✓' : '◇', 74, yy + 40, 24, done ? '#ffd54a' : '#71837b', 'center');
          text(ctx, d[1], 103, yy + 25, 19, done ? '#ffe49a' : '#fff');
          text(ctx, d[2] + '  ' + val + '/' + d[4], 103, yy + 54, 14, '#afbeb7');
          text(ctx, done ? '已完成' : '进行中', 650, yy + 40, 15, done ? '#59e58a' : '#9eaaa4', 'right');
        }
        ctx.restore();
      },
      handle: function () {
        var p = tap();
        if (!p) return;
        if (p.y < 260 && p.x > 620) {
          Input.clearTap();
          this.open = false;
          return;
        }
        if (p.y > CONFIG.VIEW.HEIGHT * .72) {
          Input.clearTap();
          this.scroll = Math.min(this.defs.length - 7, this.scroll + 1);
        } else if (p.y > CONFIG.VIEW.HEIGHT * .22) {
          Input.clearTap();
          this.scroll = Math.max(0, this.scroll - 1);
        }
      }
    };
    Achievements.init();

    // ---------- 服装与涂装：纯外观，不改属性 ----------
    var Wardrobe = {
      open: false,
      mode: 'outfit',
      index: 0,
      outfits: [['default', '默认幸存者', 'COMMON', 'free', 0], ['cowboy', '西部牛仔', 'COMMON', 'coins', 800], ['firefighter', '消防员', 'COMMON', 'coins', 1200], ['special', '特种兵', 'RARE', 'coins', 3000], ['medic', '战地医生', 'RARE', 'coins', 3500], ['ninja', '忍者', 'RARE', 'coins', 4000], ['punk', '朋克', 'RARE', 'coins', 5000], ['hunter', '荒野猎人', 'EPIC', 'diamonds', 80], ['mechanic', '机械师', 'EPIC', 'diamonds', 100], ['necromancer', '亡灵法师', 'EPIC', 'diamonds', 120], ['gold', '黄金幸存者', 'LEGENDARY', 'diamonds', 300], ['shadow', '暗影刺客', 'LEGENDARY', 'diamonds', 500]],
      skins: [['default', '手枪默认', 'pulse', 'free', 0], ['pulse_silver', '银色杀手', 'pulse', 'coins', 2000], ['pulse_red', '烈焰红', 'pulse', 'coins', 3000], ['pulse_blue', '冰霜蓝', 'pulse', 'diamonds', 80], ['pulse_gold', '黄金沙鹰', 'pulse', 'achievement', 0], ['default', '飞刃默认', 'blade', 'free', 0], ['blade_blood', '血刃', 'blade', 'achievement', 0], ['blade_thunder', '雷霆刃', 'blade', 'achievement', 0], ['blade_void', '虚空刃', 'blade', 'achievement', 0], ['default', '喷火器默认', 'flame', 'free', 0], ['flame_green', '军用绿', 'flame', 'coins', 2500], ['flame_hell', '地狱火', 'flame', 'achievement', 0], ['flame_frost', '极寒喷射', 'flame', 'achievement', 0], ['default', '弩箭默认', 'crossbow', 'free', 0], ['bow_hunter', '猎人棕', 'crossbow', 'achievement', 0], ['bow_machine', '机械弩', 'crossbow', 'diamonds', 80], ['bow_holy', '圣光弩', 'crossbow', 'achievement', 0]],
      ownOutfit: function (id) {
        if (Meta.data.ownedOutfits.indexOf(id) < 0) Meta.data.ownedOutfits.push(id);
      },
      ownSkin: function (id) {
        for (var i = 0; i < this.skins.length; i++) if (this.skins[i][0] === id) {
          var w = this.skins[i][2],
            a = Meta.data.ownedSkins[w];
          if (a.indexOf(id) < 0) a.push(id);
        }
      },
      buyOrEquip: function () {
        if (this.mode === 'outfit') {
          var d = this.outfits[this.index],
            owned = Meta.data.ownedOutfits.indexOf(d[0]) >= 0;
          if (owned) Meta.data.currentOutfit = d[0];else if (d[3] !== 'free' && Meta.data[d[3]] >= d[4]) {
            Meta.data[d[3]] -= d[4];
            this.ownOutfit(d[0]);
            Meta.data.currentOutfit = d[0];
          }
        } else {
          var s = this.skins[this.index],
            list = Meta.data.ownedSkins[s[2]],
            own = list.indexOf(s[0]) >= 0;
          if (own) Meta.data.equippedSkins[s[2]] = s[0];else if (s[3] !== 'achievement' && Meta.data[s[3]] >= s[4]) {
            Meta.data[s[3]] -= s[4];
            this.ownSkin(s[0]);
            Meta.data.equippedSkins[s[2]] = s[0];
          }
        }
        applyEquippedLooks();
        Meta.save();
      },
      draw: function (ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,.74)';
        ctx.fillRect(0, 0, 750, CONFIG.VIEW.HEIGHT);
        panel(ctx, 38, 150, 674, CONFIG.VIEW.HEIGHT - 190, 24, '#111d1a', '#4e8067');
        text(ctx, '外观仓库', 75, 200, 34, '#f4fff7');
        text(ctx, '×', 670, 200, 34, '#fff', 'center');
        UI.drawActionButton(ctx, 85, 240, 270, 58, '角色服装', this.mode === 'outfit', 20);
        UI.drawActionButton(ctx, 395, 240, 270, 58, '武器涂装', this.mode === 'skin', 20);
        var list = this.mode === 'outfit' ? this.outfits : this.skins;
        this.index = Math.max(0, Math.min(list.length - 1, this.index));
        var d = list[this.index],
          name = d[1];
        text(ctx, '‹', 92, 530, 50, '#ffd166', 'center');
        text(ctx, '›', 658, 530, 50, '#ffd166', 'center');
        diamond(ctx, 375, 410, 50);
        text(ctx, name, 375, 505, 30, '#fff', 'center');
        text(ctx, this.index + 1 + ' / ' + list.length, 375, 552, 18, '#9fb1a8', 'center');
        var own = this.mode === 'outfit' ? Meta.data.ownedOutfits.indexOf(d[0]) >= 0 : Meta.data.ownedSkins[d[2]].indexOf(d[0]) >= 0;
        var equipped = this.mode === 'outfit' ? Meta.data.currentOutfit === d[0] : Meta.data.equippedSkins[d[2]] === d[0];
        var currency = this.mode === 'outfit' ? d[3] : d[3],
          price = this.mode === 'outfit' ? d[4] : d[4];
        var label = equipped ? '已装备' : own ? '装备' : currency === 'achievement' ? '成就解锁' : currency === 'free' ? '拥有' : '购买 ' + price + (currency === 'diamonds' ? ' 钻石' : ' 金币');
        UI.drawActionButton(ctx, 170, 620, 410, 78, label, !equipped && currency !== 'achievement', 24);
        text(ctx, '服装与涂装只改变外观，不提供属性加成', 375, 735, 17, '#aebdb6', 'center');
        ctx.restore();
      }
    };

    // 已装备外观仅改变 Canvas 绘制颜色和装饰，不参与任何数值计算。
    var OutfitColors = {
      default: '#4a5d4e',
      cowboy: '#8b5a2b',
      firefighter: '#c94b36',
      special: '#365d45',
      medic: '#e8eee8',
      ninja: '#24252d',
      punk: '#8e44ad',
      hunter: '#6b4d2e',
      mechanic: '#607d8b',
      necromancer: '#4b286d',
      gold: '#d6aa28',
      shadow: '#182038'
    };
    var defaultLooks = {
      player: CONFIG.COLORS.PLAYER_BODY,
      gun: CONFIG.COLORS.WEAPON_GUN,
      core: CONFIG.COLORS.WEAPON_CORE,
      blade: CONFIG.COLORS.WEAPON_BLADE
    };
    function applyEquippedLooks() {
      var outfit = Meta.data.currentOutfit || 'default';
      CONFIG.COLORS.PLAYER_BODY = OutfitColors[outfit] || defaultLooks.player;
      var pulse = Meta.data.equippedSkins.pulse,
        blade = Meta.data.equippedSkins.blade;
      CONFIG.COLORS.WEAPON_GUN = pulse === 'pulse_silver' ? '#d7dde2' : pulse === 'pulse_red' ? '#b9362b' : pulse === 'pulse_blue' ? '#2980b9' : pulse === 'pulse_gold' ? '#d6aa28' : defaultLooks.gun;
      CONFIG.COLORS.WEAPON_CORE = pulse === 'pulse_blue' ? '#8ee8ff' : pulse === 'pulse_red' ? '#ff8a4c' : defaultLooks.core;
      CONFIG.COLORS.WEAPON_BLADE = blade === 'blade_blood' ? '#b32635' : blade === 'blade_thunder' ? '#65c7ff' : blade === 'blade_void' ? '#8e44ad' : defaultLooks.blade;
    }
    // 供后续界面在购买或装备后立即刷新外观。
    root.applyEquippedLooks = applyEquippedLooks;
    root.CostumeView = {
      draw: function (ctx) {
        var id = Meta.data && Meta.data.currentOutfit;
        if (!id || id === 'default') return;
        var x = this.x - Camera.x + this.renderOffsetX + this.recoilX,
          y = this.y - Camera.y + this.renderOffsetY + this.recoilY + this.bobOffset;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.facingAngle);
        if (id === 'cowboy') {
          ctx.fillStyle = '#6b421f';
          ctx.fillRect(-8, -18, 16, 5);
          ctx.fillRect(-13, -15, 26, 4);
        } else if (id === 'firefighter') {
          ctx.fillStyle = '#e74c3c';
          ctx.fillRect(-9, -18, 18, 7);
          ctx.fillStyle = '#ffd54a';
          ctx.fillRect(-7, -15, 14, 2);
        } else if (id === 'ninja' || id === 'shadow') {
          ctx.fillStyle = id === 'shadow' ? '#513080' : '#111';
          ctx.beginPath();
          ctx.moveTo(-9, -4);
          ctx.lineTo(-22, -10);
          ctx.lineTo(-15, 2);
          ctx.fill();
        } else if (id === 'gold' || id === 'necromancer') {
          ctx.globalAlpha = .55 + .2 * Math.sin(Date.now() / 180);
          ctx.strokeStyle = id === 'gold' ? '#ffd54a' : '#b86bff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, 27, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = OutfitColors[id] || '#fff';
          ctx.fillRect(-10, -16, 20, 4);
        }
        ctx.restore();
      }
    };

    // ---------- 生命周期、统计与渲染接入 ----------

    // 基地第三个“服装”Tab：保留原两页逻辑，同时按文档提供独立外观入口。

    root.DiamondFX = DiamondFX;
    root.Objectives = Objectives;
    root.FlameWeapon = FlameWeapon;
    root.Crossbow = Crossbow;
    root.Achievements = Achievements;
    root.Wardrobe = Wardrobe;
  })();

  // ---------- 功能分区 ----------
  'use strict';
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
        img.src = Platform.isWx ? 'logo/game_logo.png' : '../logo/game_logo.png';
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
      UI.drawCenteredText(ctx, '已完成 ' + Meta.data.achievements.completed.length + ' / 29', 184 + top, 18, false, '#ffd54a');
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

  // ---------- 功能分区 ----------
  'use strict';
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
      UI.drawCenteredText(ctx, title, 75 + top, 42, true, '#f4d58d');
    }
    function drawMoney(ctx) {
      var top = CONFIG.UI.TOP_INSET || 0;
      text(ctx, '金币 ' + Meta.data.coins, 535, 125 + top, 20, '#ffd166', 'right', true);
      text(ctx, '钻石 ' + (Meta.data.diamonds || 0), 715, 125 + top, 20, '#83d7ff', 'right', true);
    }
    function drawCampSelect(ctx) {
      var top = CONFIG.UI.TOP_INSET || 0;
      ctx.fillStyle = CONFIG.COLORS.MENU_BACKGROUND;
      ctx.fillRect(0, 0, 750, CONFIG.VIEW.HEIGHT);
      UI.drawMenuGlow(ctx);
      drawBack(ctx, '幸存者营地');
      drawMoney(ctx);
      drawEntry(ctx, 75, 245 + top, '强化', '永久属性与道具升级', '↑', '#f1b657');
      drawEntry(ctx, 75, 565 + top, '外观', '角色服装与武器涂装', '◇', '#65c7ff');
    }
    function drawEntry(ctx, x, y, title, desc, icon, col) {
      panel(ctx, x, y, 600, 250, 25, 'rgba(23,35,31,.97)', col);
      ctx.save();
      ctx.globalAlpha = .16;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x + 105, y + 125, 72, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      text(ctx, icon, x + 105, y + 120, 78, col, 'center', true);
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
      var rs = UI.getBaseTabRects(top);
      UI.drawActionButton(ctx, rs[0].x, rs[0].y, rs[0].w, rs[0].h, '角色强化', UI.baseTab === 'character', 20);
      UI.drawActionButton(ctx, rs[1].x, rs[1].y, rs[1].w, rs[1].h, '道具强化', UI.baseTab === 'gadget', 20);
      if (UI.baseTab === 'gadget') UI.drawBaseGadget(ctx, top);else UI.drawBaseCharacter(ctx, top);
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
          gid = Object.keys(CONFIG.META.GADGET_UPGRADES)[gi];
        if (gid && CONFIG.META.GADGET_UPGRADES[gid].items[ii]) Meta.buyGadget(gid, CONFIG.META.GADGET_UPGRADES[gid].items[ii].ID);
      }
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
      var price = d[3] === 'free' ? '初始拥有' : d[3] === 'achievement' ? '成就解锁' : d[4] + ' ' + (d[3] === 'diamonds' ? '钻石' : '金币');
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

  // ---------- 功能分区 ----------
  'use strict';
  (function () {
    // ============================================================
    // 界面与内容：墙体与避障 / 三主武器成长 / 旋转激光 / 后期波次
    // ============================================================
    var root = typeof window !== 'undefined' ? window : global;
    var CONFIG = root.CONFIG,
      Game = root.Game,
      UI = root.UI,
      Input = root.Input,
      Meta = root.Meta,
      Platform = root.Platform;
    var Player = root.Player,
      Enemy = root.Enemy,
      Bullet = root.Bullet,
      Camera = root.Camera,
      Combat = root.Combat;
    var Weapons = root.Weapons,
      PulseGun = root.PulseGun,
      OrbitBlade = root.OrbitBlade,
      FlameWeapon = root.FlameWeapon,
      Crossbow = root.Crossbow;
    var Spawner = root.Spawner,
      PowerUps = root.PowerUps,
      LaserEmitter = root.LaserEmitter,
      Field = root.Field,
      RunStats = root.RunStats;

    // v008 是独立脚本闭包，不能依赖 v005/v007 闭包内的同名辅助函数。
    function hit(p, x, y, w, h) {
      return !!p && UI.isPointInRect(p, x, y, w, h);
    }
    function tap() {
      return Input.pendingTap && Input.pendingTap.active ? Input.pendingTap : null;
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

    // 新激光升级树，必须在 Meta.load 创建默认存档前完成替换。

    // 内部墙矢量细节：在原实体底面上增加明暗面、分段、裂纹与警示条。

    // ---------- #47 轻量避障 ----------

    // ---------- #48 投射物撞墙 ----------

    // ---------- #50 三主武器独立成长 ----------

    var WeaponProgress = root.WeaponProgress;
    var WeaponSelect = {
      cards: [['pistol', '脉冲手枪', '稳定射击，自动锁定最近敌人'], ['flamer', '喷火器', '近距离扇形持续灼烧'], ['crossbow', '弩箭', '直线贯穿成群敌人']],
      draw: function (ctx) {
        var top = CONFIG.UI.TOP_INSET || 0;
        ctx.fillStyle = '#08110e';
        ctx.fillRect(0, 0, 750, CONFIG.VIEW.HEIGHT);
        UI.drawMenuGlow(ctx);
        UI.drawActionButton(ctx, 24, 30 + top, 132, 60, '返回', true, 22);
        UI.drawCenteredText(ctx, '选择主武器', 105 + top, 42, true, '#f4d58d');
        for (var i = 0; i < 3; i++) {
          var c = this.cards[i],
            d = Meta.data.weaponLevel[c[0]],
            open = WeaponProgress.unlocked(c[0]),
            y = 190 + top + i * 250,
            need = WeaponProgress.need(Math.max(1, d.lv));
          UI.roundedRectPath(ctx, 70, y, 610, 210, 22);
          ctx.fillStyle = open ? '#182720' : '#161a18';
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = open ? '#e9ad58' : '#536058';
          ctx.stroke();
          text(ctx, open ? '◆' : '🔒', 120, y + 65, 34, open ? '#ffd166' : '#82958b', 'center', true);
          text(ctx, c[1], 175, y + 50, 28, open ? '#fff' : '#8d9892', 'left', true);
          text(ctx, 'Lv.' + d.lv + '  ' + d.pts + ' / ' + need, 175, y + 88, 18, open ? '#83d7ff' : '#82958b');
          text(ctx, c[2], 175, y + 128, 17, '#b4c2bc');
          if (!open) text(ctx, '脉冲手枪等级达到 Lv.' + (c[0] === 'flamer' ? 5 : 10) + ' 解锁', 175, y + 168, 16, '#ffb27a');else UI.drawActionButton(ctx, 480, y + 135, 160, 54, '选择', true, 18);
        }
      },
      update: function () {
        var p = tap(),
          top = CONFIG.UI.TOP_INSET || 0;
        if (!p) return;
        if (hit(p, 24, 30 + top, 132, 60)) {
          Input.clearTap();
          Game.enterMenu();
          return;
        }
        for (var i = 0; i < 3; i++) {
          var y = 190 + top + i * 250,
            id = this.cards[i][0];
          if (hit(p, 70, y, 610, 210) && WeaponProgress.unlocked(id)) {
            Input.clearTap();
            Meta.data.selectedWeapon = id;
            Meta.save(false);
            Game.restart();
            return;
          }
        }
      }
    };
    root.WeaponSelect = WeaponSelect;

    // ---------- #51/#59 以玩家为中心的高速旋转光束 ----------
    // #59：穿透内部墙（光束只算到 2400 世界边界，不再被 CONFIG.FIELD.WALLS 截断）；
    //      激活瞬间 0.8 圈/秒，1.5 秒内 ease-out 加速到 5 圈/秒；
    //      扇形扫掠判定（上一帧角度→本帧角度）防低帧率隧穿；
    //      直接扣血通道，无视受击无敌帧，普通怪秒杀、精英/Boss 每 tick 结算主武器×10。

    // 敌人相对玩家角度 ea，是否落在 s0→s1 正向扫掠扇形内（含光束半角 halfW）

    // ---------- #52 波次数量 ----------

    root.WorldServices = {
      WallCollision: root.WallCollision,
      WeaponProgress: WeaponProgress,
      WeaponSelect: WeaponSelect
    };
  })();
})();

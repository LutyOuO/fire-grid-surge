// 命运牌、下一局增益与开发者工具。
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
        }], [17, '皮糙肉厚', '受到伤害 -5%', C, 'REDUCE', .05], [18, '先发制人', '开局等级 +2', C, 'START_LEVEL', 2], [19, '虚弱诅咒', '敌人血量 -10%', C, 'ENEMY_HP', .1], [20, '减速陷阱', '敌人速度 -10%', C, 'ENEMY_SPEED', .1], [21, '喘息空间', '刷怪间隔 +0.2秒', C, 'SPAWN_GAP', .2], [22, '经验丰收', '经验晶石价值 +20%', C, 'EXP', .2], [23, '金币丰收', '金币掉落 +20%', C, 'GOLD', .2], [24, '幸运儿', '道具掉率 +20%', C, 'DROP', .2], [25, '爆破专家', '开局炸弹 +1', C, 'ITEM', [0, 1]], [26, '磁力王', '开局磁铁 +1', C, 'ITEM', [1, 1]], [27, '医疗兵', '开局血包 +1', C, 'ITEM', [2, 1]], [28, '冰霜法师', '开局冻结 +1', C, 'ITEM', [3, 1]], [29, '冲刺大师', '冲刺冷却 -2秒', C, 'DASH_CD', 2], [30, '疾风步', '冲刺速度 +20%', C, 'DASH_SPEED', .2], [31, '持久冲刺', '冲刺时长 +0.3秒', C, 'DASH_TIME', .3], [32, '远程射击', '子弹寿命 +0.3秒', C, 'BULLET_LIFE', .3], [33, '高速弹', '弹速 +15%', C, 'BULLET_SPEED', .15], [34, '生命强化', '最大生命 +30', C, 'MAX_HP', 30], [35, '余生机会', '免费复活 +1', C, 'REVIVE', 1], [36, '短暂无敌', '开局无敌30秒', R, 'START_INV', 30], [37, '自动炮击', '每15秒自动启动最近炮台', R, 'AUTO_MORTAR', 15], [38, '弹幕开局', '开局弹道 +4', R, 'PROJECTILE', 4], [39, '急速射击', '射速 +50%', R, 'FIRE', .5], [40, '重型弹药', '伤害 +30%', R, 'DAMAGE', .3], [41, '风之疾走', '移速 +25%', R, 'MOVE', .25], [42, '鹰眼', '暴击率 +15%', R, 'CRIT', .15], [43, '毁灭打击', '暴击伤害 +50%', R, 'CRIT_DMG', .5], [44, '黑洞磁场', '拾取范围 +40%', R, 'PICKUP', .4], [45, '顿悟', '经验获取 +30%', R, 'EXP', .3], [46, '点金术', '金币获取 +30%', R, 'GOLD', .3], [47, '高位起步', '开局等级 +5', R, 'START_LEVEL', 5], [48, '瘟疫使者', '敌人血量 -20%', R, 'ENEMY_HP', .2], [49, '冰霜领域', '敌人速度 -15%', R, 'ENEMY_SPEED', .15], [50, '吸血攻击', '每击杀回复3生命', R, 'KILL_HEAL', 3], [51, '能量护盾', '20%可再生护盾', R, 'SHIELD', .2], [52, '时间加速', '武器冷却 -20%', R, 'COOLDOWN', .2], [53, '双飞刃', '飞刃数量 +2', R, 'BLADE_COUNT', 2], [54, '穿甲弹', '子弹穿透 +3', R, 'PIERCE', 3], [55, '三连射', '子弹弹道 +2', R, 'PROJECTILE', 2], [56, '道具猎人', '道具掉率 +50%', R, 'DROP', .5], [57, '冲刺狂人', '冲刺冷却 -4秒', R, 'DASH_CD', 4], [58, '钢铁之躯', '受到伤害 -20%', R, 'REDUCE', .2], [59, '全屏磁吸', '晶石自动全屏吸附', R, 'FULL_MAGNET', 1], [60, '全副武装', '四种道具各 +1', R, 'ALL_ITEMS', 1], [61, '神圣庇护', '开局无敌60秒', E, 'START_INV', 60], [62, '无冷却炮击', '每8秒自动炮击', E, 'AUTO_MORTAR', 8], [63, '枪林弹雨', '开局弹道 +7', E, 'PROJECTILE', 7], [64, '暴风射击', '射速 +80%', E, 'FIRE', .8], [65, '毁灭之力', '伤害 +60%', E, 'DAMAGE', .6], [66, '武器过载', '伤害/弹道/穿透 ×2', E, 'WEAPON_OVERLOAD', 2], [67, '暴击宗师', '暴击率+25% 暴伤+100%', E, 'CRIT_MASTER', 1], [68, '疾风剑圣', '移速+40% 冲刺冷却-50%', E, 'WIND_MASTER', 1], [69, '衰弱光环', '敌人血量 -35%', E, 'ENEMY_HP', .35], [70, '黄金时代', '金币获取 +100%', E, 'GOLD', 1], [71, '智慧之光', '经验+50% 开局等级+8', E, 'WISDOM', 1], [72, '生命汲取', '击杀回血5，10%掉血包', E, 'LIFE_DRAIN', 1], [73, '自动激光', '每20秒自动激光', E, 'AUTO_LASER', 20], [74, '永恒冰封', '每25秒自动冻结3秒', E, 'AUTO_FREEZE', 25], [75, '激光化', '主武器激光化，伤害+50%', E, 'LASER', 1], [76, '不死之身', '下一局全程无敌', L, 'GOD', 1], [77, '战神降世', '武器伤害×3，攻速×2', L, 'WAR_GOD', 1], [78, '天选之人', '开局直接50级', L, 'CHOSEN', 50], [79, '割草模式', '敌血-50%，速度-30%', L, 'MOW', 1], [80, '爆肝模式', '金币×5，经验×3', L, 'GRIND', 1], [81, '神之怒', '每10秒自动清屏', L, 'AUTO_CLEAR', 10], [82, '万物主宰', '所有道具轮流自动释放', L, 'ITEM_MASTER', 1], [83, '先发弹药', '开局弹道 +3', R, 'AMMO_START', 3], [84, '空手求生', '不携带道具，受伤 -15%', R, 'BAREHANDS', .15], [85, '血税', '最大生命 -20%，伤害 +25%', E, 'BLOOD_TAX', .25], [86, '铁壁', '受伤 -20%，移速 -8%', E, 'IRON_WALL', .2]];
        for (var vd=0;vd<CONFIG.V20.FATE_CARDS.length;vd++) this.defs.push(CONFIG.V20.FATE_CARDS[vd]);
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
        // #74/#84 权重集中在 CONFIG.UPGRADES.RARITY_WEIGHTS_FATE（顺序：白/蓝/紫/金/彩）。
        // 五档：COMMON/RARE/EPIC/LEGENDARY(金)/RAINBOW(彩)，第五档不再折叠进 LEGENDARY。
        var weights = CONFIG.UPGRADES.RARITY_WEIGHTS_FATE;
        var ids = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'RAINBOW'];
        var total = 0;
        for (var i = 0; i < weights.length; i++) total += weights[i];
        var n = Math.random() * total;
        for (var i = 0; i < weights.length; i++) {
          n -= weights[i];
          if (n < 0) return ids[Math.min(i, ids.length - 1)];
        }
        return 'COMMON';
      },
      deal: function () {
        this.cards.length = 0;
        var used = {};
        for (var i = 0; i < 9; i++) {
          var r = this.rollRarity(),
            rainbow = r === 'RAINBOW',
            pool = [];
          // #84 第五档 RAINBOW(彩) 复用 LEGENDARY(金) 牌池：只换渲染光效，不新增牌面。
          var target = rainbow ? 'LEGENDARY' : r;
          for (var j = 0; j < this.defs.length; j++) if (this.defs[j][3] === target && !used[this.defs[j][0]]) pool.push(this.defs[j]);
          if (!pool.length) {
            r = 'COMMON'; rainbow = false;
            for (var j = 0; j < this.defs.length; j++) if (this.defs[j][3] === r && !used[this.defs[j][0]]) pool.push(this.defs[j]);
          }
          var picked = pool[Math.floor(Math.random() * pool.length)];
          used[picked[0]] = true;
          this.cards.push({
            def: picked,
            open: false,
            t: 0,
            rainbow: rainbow
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
          this.enforceMutex(c.def);
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
      enforceMutex: function (def) {
        var t = def[4], banned = {}, pairs = CONFIG.FATE_MUTEX || [];
        for (var i = 0; i < pairs.length; i++) {
          if (pairs[i][0] === t) banned[pairs[i][1]] = true;
          if (pairs[i][1] === t) banned[pairs[i][0]] = true;
        }
        if (!Object.keys(banned).length) return;
        for (var i = 0; i < this.cards.length; i++) {
          if (this.cards[i].open) continue;
          if (!banned[this.cards[i].def[4]]) continue;
          var tier=this.cards[i].def[3],used={},options=[];
          for(var u=0;u<this.cards.length;u++)if(u!==i)used[this.cards[u].def[0]]=true;
          for (var j = 0; j < this.defs.length; j++) {
            var alt=this.defs[j];
            if(alt[3]===tier && !used[alt[0]] && !banned[alt[4]] && alt[4]!==t)options.push(alt);
          }
          if(options.length)this.cards[i].def=options[Math.floor(Math.random()*options.length)];
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
          // #84 彩虹牌：彩虹渐变描边/图标；金 LEGENDARY 保持纯金 #ffd54a。
          var rainbowCard = !!c.rainbow;
          var rainbowGrad = null;
          if (rainbowCard) {
            var ph = Date.now() % 2000 / 2000 * 360;
            rainbowGrad = ctx.createLinearGradient(0, 0, 160, 220);
            root.safeStop(rainbowGrad, 0, 'hsl(' + ph + ',95%,62%)');
            root.safeStop(rainbowGrad, .5, 'hsl(' + (ph + 120) % 360 + ',95%,62%)');
            root.safeStop(rainbowGrad, 1, 'hsl(' + (ph + 240) % 360 + ',95%,62%)');
          }
          ctx.fillStyle = r === 'COMMON' ? '#222928' : r === 'RARE' ? '#132b3a' : r === 'EPIC' ? '#332317' : rainbowCard ? '#251b31' : '#251c31';
          ctx.fill();
          ctx.lineWidth = r === 'EPIC' || r === 'LEGENDARY' ? 3 : 2;
          ctx.strokeStyle = rainbowGrad || col;
          ctx.stroke();
          ctx.fillStyle = rainbowGrad || col;
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
        } else if (t === 'REDUCE') Player.incomingDamageMultiplier *= 1 - v;else if (t === 'RELOAD') PulseGun.reloadMultiplier *= 1-v;else if (t === 'START_LEVEL') this.level(v);else if (t === 'ENEMY_HP') Player.nextEnemyHp = 1 - v;else if (t === 'ENEMY_SPEED') Player.enemySpeedMultiplier *= 1 - v;else if (t === 'SPAWN_GAP') Player.nextSpawnGap = v;else if (t === 'DROP') Player.nextDropBonus = v;else if (t === 'ITEM') PowerUps.inventory[v[0]] += v[1];else if (t === 'DASH_CD') Player.nextDashCd = v;else if (t === 'DASH_SPEED') Player.nextDashSpeed = v;else if (t === 'DASH_TIME') Player.nextDashTime = v;else if (t === 'BULLET_LIFE') Player.nextBulletLife = v;else if (t === 'BULLET_SPEED') PulseGun.speedFlat += CONFIG.WEAPONS.PULSE.SPEED * v;else if (t === 'REVIVE') Player.reviveCharges += v;else if (t === 'START_INV') Player.invincibleTimer = v;else if (t === 'AUTO_MORTAR') this.autoMortar = v;else if (t === 'AMMO_START') PulseGun.projectileCount += v;else if (t === 'BAREHANDS') {
          Player.incomingDamageMultiplier *= 0.85;
          for (var bi = 0; bi < PowerUps.inventory.length; bi++) PowerUps.inventory[bi] = 0;
        } else if (t === 'BLOOD_TAX') {
          Player.maxHp = Math.max(20, Math.floor(Player.maxHp * 0.8));
          Player.hp = Math.min(Player.hp, Player.maxHp);
          Player.globalDamageBonus += v;
        } else if (t === 'IRON_WALL') {
          Player.incomingDamageMultiplier *= 0.8;
          Player.moveSpeedBonus -= 0.08;
        } else if (t === 'KILL_HEAL') Player.killHeal += v;else if (t === 'SHIELD') {
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
          if (root.Field) root.Field.activateNearestReady();
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

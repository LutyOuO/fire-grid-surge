// 局内目标、成就、外观与装扮。
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
    // 可调数值统一挂在全局 CONFIG，后续平衡时无需搜索业务函数。

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
    }, {
      ID: 'NAPALM',
      TEXT_KEY: 'NAPALM',
      RARITY: 'EPIC',
      EFFECT: 'NAPALM',
      MAX_LEVEL: 1,
      weapon: 'flamer'
    }, {
      ID: 'BACKDRAFT',
      TEXT_KEY: 'BACKDRAFT',
      RARITY: 'EPIC',
      EFFECT: 'BACKDRAFT',
      MAX_LEVEL: 1,
      weapon: 'flamer'
    }, {
      ID: 'INFERNO',
      TEXT_KEY: 'INFERNO',
      RARITY: 'LEGENDARY',
      EFFECT: 'INFERNO',
      MAX_LEVEL: 1,
      weapon: 'flamer'
    }, {
      ID: 'PILEDRIVER',
      TEXT_KEY: 'PILEDRIVER',
      RARITY: 'EPIC',
      EFFECT: 'PILEDRIVER',
      MAX_LEVEL: 1,
      weapon: 'crossbow'
    }, {
      ID: 'SCATTER_BOLT',
      TEXT_KEY: 'SCATTER_BOLT',
      RARITY: 'EPIC',
      EFFECT: 'SCATTER_BOLT',
      MAX_LEVEL: 1,
      weapon: 'crossbow'
    }, {
      ID: 'MARKSMAN',
      TEXT_KEY: 'MARKSMAN',
      RARITY: 'LEGENDARY',
      EFFECT: 'MARKSMAN',
      MAX_LEVEL: 1,
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
      BOW_CRIT: ['重击', '弩箭暴击率 +10%'],
      NAPALM: ['凝固汽油', '地面留燃烧带 3 秒，每秒 8% 喷火伤害'],
      BACKDRAFT: ['回燃', '扇形末端爆炸，半径 70，伤害 40%'],
      INFERNO: ['炼狱', '喷火时每 2 秒爆发清近身并回 4% 生命'],
      PILEDRIVER: ['贯石', '每穿透 1 个敌人，下一发伤害 +12%，最多 +60%'],
      SCATTER_BOLT: ['裂矢', '命中墙或世界边界后分裂 2 支短弩'],
      MARKSMAN: ['神射', '超过 420px 的第一目标必暴，暴击倍率 +0.5']
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
        Meta.data.totalDiamonds = (Meta.data.totalDiamonds || 0) + n;
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
      defs: [['survive120', '存活120秒', 'time', 120, 5], ['kill50', '击杀50名敌人', 'kills', 50, 5], ['level10', '升到10级', 'level', 10, 5], ['exp100', '拾取100经验', 'exp', 100, 5], ['dash3', '使用3次冲刺', 'dash', 3, 5], ['item2', '使用2个道具', 'items', 2, 5], ['coin5', '拾取5金币', 'coins', 5, 5], ['elite1', '击杀1只精英', 'elite', 1, 5], ['rare1', '获得1个稀有词条', 'rare', 1, 5], ['safe30', '连续30秒不受伤', 'safe', 30, 5], ['survive300', '存活300秒', 'time', 300, 10], ['kill200', '击杀200名敌人', 'kills', 200, 10], ['level20', '升到20级', 'level', 20, 10], ['mortar30', '炮台击杀30', 'mortar', 30, 10], ['flame30', '喷火击杀30', 'flame', 30, 10], ['bow30', '弩箭击杀30', 'bow', 30, 10], ['bomb20', '炸弹击杀20', 'bomb', 20, 10], ['dash5', '使用5次冲刺', 'dash', 5, 10], ['item5', '使用5个道具', 'items', 5, 10], ['elite3', '击杀3只精英', 'elite', 3, 10], ['epic1', '获得1个史诗词条', 'epic', 1, 10], ['wave5', '坚持到第5波', 'wave', 5, 10], ['coin500', '获得500金币', 'coins', 500, 10], ['still10', '静止10秒不受伤', 'still', 10, 10], ['survive600', '存活600秒', 'time', 600, 20], ['kill500', '击杀500名敌人', 'kills', 500, 20], ['level30', '升到30级', 'level', 30, 20], ['mortar80', '炮台击杀80', 'mortar', 80, 20], ['nodash120', '不冲刺存活120秒', 'nodash', 120, 20], ['boss1', '击杀Boss', 'boss', 1, 20], ['legend1', '获得1个传说词条', 'legend', 1, 20], ['wave10', '坚持到第10波', 'wave', 10, 20], ['extract1', '成功撤退', 'extract', 1, 20], ['coin2000', '获得2000金币', 'coins', 2000, 20]],
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
          flame: 0,
          bow: 0,
          tesla: 0,
          frost: 0,
          bomb: 0,
          extract: 0,
          safe: 0,
          still: 0,
          nodash: 0
        };
        this.collapsed = false;
        this.notice = 0;
        var sel = root.Meta && Meta.data ? Meta.data.selectedWeapon : 'pistol';
        var pool = this.defs.slice();
        for (var i = 0; i < 3 && pool.length; i++) {
          var total = 0, weights = [];
          for (var p = 0; p < pool.length; p++) {
            var w = 1;
            if (sel === 'flamer' && pool[p][2] === 'flame') w = 1.6;
            if (sel === 'crossbow' && pool[p][2] === 'bow') w = 1.6;
            weights.push(w);
            total += w;
          }
          var roll = Math.random() * total, acc = 0, n = 0;
          for (; n < pool.length; n++) {
            acc += weights[n];
            if (roll <= acc) break;
          }
          if (n >= pool.length) n = pool.length - 1;
          var d = pool.splice(n, 1)[0];
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
        var rows = [['A1', '初出茅庐', '累计击杀50', 'kills', 50, 'coins', 50], ['A2', '百人斩', '累计击杀100', 'kills', 100, 'skin', 'pulse_silver'], ['A3', '千人斩', '累计击杀1000', 'kills', 1000, 'diamonds', 100], ['A4', '万人斩', '累计击杀10000', 'kills', 10000, 'diamonds', 200], ['A5', '精英猎人', '击杀50精英', 'elite', 50, 'diamonds', 100], ['A6', '精英克星', '击杀200精英', 'elite', 200, 'skin', 'blade_blood'], ['A7', 'Boss终结者', '击杀10 Boss', 'boss', 10, 'skin', 'pulse_gold'], ['A8', '炮火洗礼', '炮台击杀500', 'mortar', 500, 'skin', 'flame_hell'], ['A9', '幸存者', '累计存活1小时', 'time', 3600, 'coins', 100], ['A10', '坚韧不拔', '累计存活10小时', 'time', 36000, 'outfit', 'special'], ['A11', '马拉松', '单局存活600秒', 'bestTime', 600, 'diamonds', 100], ['A12', '毫发无伤', '连续60秒不受伤', 'safe', 60, 'diamonds', 50], ['A13', '不死鸟', '单局复活3次', 'revives', 3, 'outfit', 'ninja'], ['A14', '小富翁', '累计获得10000金币', 'coinsTotal', 10000, 'coins', 200], ['A15', '大富翁', '累计获得100000金币', 'coinsTotal', 100000, 'skin', 'blade_thunder'], ['A16', '钻石收藏家', '累计获得100钻石', 'diamondsTotal', 100, 'diamonds', 50], ['A17', '道具猎人', '拾取100道具', 'items', 100, 'skin', 'bow_hunter'], ['A18', '经验大师', '拾取10000经验', 'exp', 10000, 'diamonds', 100], ['A19', '等级突破', '单局20级', 'bestLevel', 20, 'coins', 50], ['A20', '满级大佬', '单局50级', 'bestLevel', 50, 'diamonds', 200], ['A21', '波次征服者', '单局第10波', 'bestWave', 10, 'outfit', 'mechanic'], ['A22', '终极挑战', '单局第20波', 'bestWave', 20, 'outfit', 'gold'], ['A23', '词条收藏家', '单局5史诗', 'epicRun', 5, 'diamonds', 100], ['A24', '天选之人', '单局3传说', 'legendRun', 3, 'skin', 'bow_holy'], ['A25', '战略家', '撤退10次', 'extract', 10, 'skin', 'flame_frost'], ['A26', '神枪手', '弩箭单局击杀100', 'bowRun', 100, 'diamonds', 50], ['A27', '烈焰法师', '喷火器单局击杀200', 'flameRun', 200, 'diamonds', 100], ['A28', '服装收藏家', '拥有5套服装', 'outfits', 5, 'diamonds', 100], ['A29', '涂装收藏家', '拥有5个涂装', 'skins', 5, 'skin', 'blade_void'], ['A30', '电弧杀手', '电塔击杀200', 'tesla', 200, 'diamonds', 80], ['A31', '霜冻掌控', '霜塔击杀200', 'frost', 200, 'diamonds', 80], ['A32', '喷火大师', '喷火累计击杀500', 'flameRun', 500, 'diamonds', 120], ['A33', '神射手', '弩箭累计击杀500', 'bowRun', 500, 'diamonds', 120], ['A34', '战场建筑师', '启动炮台100次', 'turretOn', 100, 'diamonds', 80], ['A35', '词缀猎手', '击杀带词缀精英100', 'affixElite', 100, 'diamonds', 100]];
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
        if (t === 'coins') Meta.data.survivorCoins += v;else if (t === 'diamonds') {
          Meta.data.diamonds += v;
          Meta.data.totalDiamonds = (Meta.data.totalDiamonds || 0) + v;
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
        text(ctx, '已完成 ' + Meta.data.achievements.completed.length + ' / ' + CONFIG.CONTENT.ACHIEVEMENT_COUNT, 520, y + 48, 18, '#ffd54a', 'center');
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
      outfits: [['default', CONFIG.CHARACTER.SKINS.default.NAME, 'COMMON', 'free', 0], ['cowboy', '西部牛仔', 'COMMON', 'survivorCoins', 800], ['firefighter', '消防员', 'COMMON', 'survivorCoins', 1200], ['special', CONFIG.CHARACTER.SKINS.special.NAME, 'RARE', 'survivorCoins', 3000], ['medic', CONFIG.CHARACTER.SKINS.medic.NAME, 'RARE', 'survivorCoins', 3500], ['ninja', '忍者', 'RARE', 'survivorCoins', 4000], ['punk', '朋克', 'RARE', 'survivorCoins', 5000], ['hunter', '荒野猎人', 'EPIC', 'diamonds', 80], ['mechanic', '机械师', 'EPIC', 'diamonds', 100], ['necromancer', '亡灵法师', 'EPIC', 'diamonds', 120], ['gold', '黄金幸存者', 'LEGENDARY', 'diamonds', 300], ['shadow', '暗影刺客', 'LEGENDARY', 'diamonds', 500]],
      skins: [['default', '手枪默认', 'pulse', 'free', 0], ['pulse_silver', '银色杀手', 'pulse', 'survivorCoins', 2000], ['pulse_red', '烈焰红', 'pulse', 'survivorCoins', 3000], ['pulse_blue', '冰霜蓝', 'pulse', 'diamonds', 80], ['pulse_gold', '黄金沙鹰', 'pulse', 'achievement', 0], ['default', '飞刃默认', 'blade', 'free', 0], ['blade_blood', '血刃', 'blade', 'achievement', 0], ['blade_thunder', '雷霆刃', 'blade', 'achievement', 0], ['blade_void', '虚空刃', 'blade', 'achievement', 0], ['default', '喷火器默认', 'flame', 'free', 0], ['flame_green', '军用绿', 'flame', 'survivorCoins', 2500], ['flame_hell', '地狱火', 'flame', 'achievement', 0], ['flame_frost', '极寒喷射', 'flame', 'achievement', 0], ['default', '弩箭默认', 'crossbow', 'free', 0], ['bow_hunter', '猎人棕', 'crossbow', 'achievement', 0], ['bow_machine', '机械弩', 'crossbow', 'diamonds', 80], ['bow_holy', '圣光弩', 'crossbow', 'achievement', 0]],
      ownOutfit: function (id) {
        if (Meta.data.ownedOutfits.indexOf(id) < 0) Meta.data.ownedOutfits.push(id);
      },
      ownSkin: function (id) {
        for (var i = 0; i < this.skins.length; i++) if (this.skins[i][0] === id) {
          var w = this.skins[i][2],
            a = Meta.data.ownedSkins[w];
          if (a.indexOf(id) < 0) a.push(id);
        }
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
    root.OutfitColors = OutfitColors;
    // ---------- 生命周期、统计与渲染接入 ----------

    // 基地第三个“服装”Tab：保留原两页逻辑，同时按文档提供独立外观入口。

    root.DiamondFX = DiamondFX;
    root.Objectives = Objectives;
    root.FlameWeapon = FlameWeapon;
    root.Crossbow = Crossbow;
    root.Achievements = Achievements;
    // v014 #89 外观幸存者硬币价 ×CONFIG.META.PRICE_MULT.COSMETIC（默认 2）；钻石/免费/成就价不动。
    // 集中在此处一次性放大 outfits/skins 数组里的 survivorCoins 价，购买与显示统一读同一份数据。
    (function scaleCosmeticPrices() {
      var mult = (CONFIG.META.PRICE_MULT && CONFIG.META.PRICE_MULT.COSMETIC) || 1;
      if (mult === 1) return;
      var lists = [Wardrobe.outfits, Wardrobe.skins];
      for (var i = 0; i < lists.length; i++) {
        var arr = lists[i];
        for (var j = 0; j < arr.length; j++) {
          if (arr[j][3] === 'survivorCoins') arr[j][4] = Math.round(arr[j][4] * mult);
        }
      }
    })();
    root.Wardrobe = Wardrobe;
  })();

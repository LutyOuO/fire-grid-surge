// 主武器选择与武器成长入口。
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

    // 页面拥有自己的短小绘制辅助函数，不依赖其他功能闭包。
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
      cards: [['pistol', '手枪', '稳定均衡 · 7 发 · 1.5 秒换弹'], ['smg', '冲锋枪', '贴脸倾泻 · 28 发 · 高机动'], ['ar', '自动步枪', '中远精准 · 穿透 1 名敌人'], ['mg', '机枪', '120 发火力网 · 持枪减速'], ['flamer', '喷火器', '近距离扇形持续灼烧'], ['crossbow', '弩箭', '直线贯穿成群敌人']],
      scroll: 0, drag: null,
      cardRect: function (i) { var top = Math.max(145, 138 + (CONFIG.UI.TOP_INSET || 0)), h = Math.min(150, Math.max(112, (CONFIG.VIEW.HEIGHT - top - (CONFIG.UI.BOTTOM_INSET || 0) - 70 - 50) / 6 - 10)); return { x: 48, y: top + i * (h + 10) - this.scroll, w: 654, h: h }; },
      unlockText: function (id) { var m = Meta.data.weaponMastery || {}; if (id === 'smg') return '任意武器累计击杀 ' + CONFIG.WEAPONS.UNLOCKS.SMG_TOTAL + ' 解锁（当前 ' + (m.total || 0) + '）'; if (id === 'ar') return '冲锋枪熟练度 ' + CONFIG.WEAPONS.UNLOCKS.AR_SMG + ' 解锁（当前 ' + (m.smg || 0) + '）'; if (id === 'mg') return '自动步枪熟练度 ' + CONFIG.WEAPONS.UNLOCKS.MG_AR + ' 解锁（当前 ' + (m.ar || 0) + '）'; if (id === 'flamer') return '手枪等级达到 Lv.5 解锁'; if (id === 'crossbow') return '手枪等级达到 Lv.10 解锁'; return ''; },
      draw: function (ctx) {
        var top = CONFIG.UI.TOP_INSET || 0;
        ctx.fillStyle = '#08110e';
        ctx.fillRect(0, 0, 750, CONFIG.VIEW.HEIGHT);
        UI.drawMenuGlow(ctx);
        UI.drawActionButton(ctx, 24, 30 + top, 132, 60, '返回', true, 22);
        UI.drawCenteredText(ctx, '选择主武器', 88 + top, 38, true, '#f4d58d');
        var clipTop = Math.max(130, 124 + top), clipBottom = CONFIG.VIEW.HEIGHT - (CONFIG.UI.BOTTOM_INSET || 0) - 22;
        ctx.save(); ctx.beginPath(); ctx.rect(25, clipTop, 700, clipBottom - clipTop); ctx.clip();
        for (var i = 0; i < this.cards.length; i++) {
          var c = this.cards[i],
            d = Meta.data.weaponLevel[c[0]],
            open = WeaponProgress.unlocked(c[0]),
            r = this.cardRect(i), y = r.y,
            need = WeaponProgress.need(Math.max(1, d.lv));
          if (y + r.h < clipTop || y > clipBottom) continue;
          UI.roundedRectPath(ctx, r.x, y, r.w, r.h, 19);
          ctx.fillStyle = open ? '#182720' : '#161a18';
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = open ? '#e9ad58' : '#536058';
          ctx.stroke();
          var iconKeys = { pistol:'weapon_pistol', smg:'weapon_smg', ar:'weapon_ar', mg:'weapon_mg', flamer:'weapon_flamer', crossbow:'weapon_crossbow' }, icon = UI.icon(iconKeys[c[0]]);
          if (icon) { ctx.save(); ctx.globalAlpha = open ? 1 : .38; ctx.drawImage(icon, r.x + 18, y + (r.h - 70) / 2, 70, 70); ctx.restore(); }
          text(ctx, c[1], r.x + 104, y + 34, 23, open ? '#fff' : '#8d9892', 'left', true);
          var mastery = Meta.data.weaponMastery || {}, masteryLabel = c[0] === 'smg' ? '熟练度 ' + (mastery.smg || 0) + ' / ' + CONFIG.WEAPONS.UNLOCKS.AR_SMG : c[0] === 'ar' ? '熟练度 ' + (mastery.ar || 0) + ' / ' + CONFIG.WEAPONS.UNLOCKS.MG_AR : c[0] === 'mg' ? '熟练度 ' + (mastery.mg || 0) : '武器等级 Lv.' + d.lv + ' · ' + d.pts + ' / ' + need;
          text(ctx, masteryLabel, r.x + 104, y + 64, 15, open ? '#83d7ff' : '#82958b');
          text(ctx, open ? c[2] : this.unlockText(c[0]), r.x + 104, y + r.h - 23, 14, open ? '#b4c2bc' : '#ffb27a');
          if (open) UI.drawActionButton(ctx, r.x + r.w - 144, y + r.h - 62, 122, 48, '选择', true, 17);
        }
        ctx.restore();
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
        for (var i = 0; i < this.cards.length; i++) {
          var r = this.cardRect(i), id = this.cards[i][0];
          if (hit(p, r.x, r.y, r.w, r.h) && WeaponProgress.unlocked(id)) {
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
    Platform.onTouchStart(function (x, y, e, id) { if (Game.state === 'WEAPON_SELECT' && y >= Math.max(130, 124 + (CONFIG.UI.TOP_INSET || 0))) WeaponSelect.drag = { id:id, y:y, start:y, moved:false }; });
    Platform.onTouchMove(function (x, y, e, id) { if (!WeaponSelect.drag || WeaponSelect.drag.id !== id) return; var dy = WeaponSelect.drag.y - y; WeaponSelect.scroll += dy; WeaponSelect.drag.y = y; if (Math.abs(y - WeaponSelect.drag.start) > 10) WeaponSelect.drag.moved = true; var last = WeaponSelect.cardRect(5), max = Math.max(0, last.y + WeaponSelect.scroll + last.h - (CONFIG.VIEW.HEIGHT - (CONFIG.UI.BOTTOM_INSET || 0) - 22)); WeaponSelect.scroll = Math.max(0, Math.min(max, WeaponSelect.scroll)); });
    Platform.onTouchEnd(function (x, y, e, id) { if (WeaponSelect.drag && WeaponSelect.drag.id === id) { if (WeaponSelect.drag.moved) Input.clearTap(); WeaponSelect.drag = null; } });

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

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

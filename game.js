'use strict';

// ============================================================
// game.js（微信小游戏入口）#55 代码整合重构
// 按新的 11 模块结构加载，最后启动游戏。
// 保持不变：platform.js / config.js / ads.js
// 加载顺序：platform → config → core → input → save → player →
//   enemy → weapon → wave → item → fx → hud → ads → menu
// ============================================================

// 1. 平台适配层（必须最先加载）
require('./js/platform.js');

// 2. 全局配置（保持不变）
require('./js/config.js');
require('./js/collision.js');

// 3. 核心：G 全局状态 + CanvasView/Camera/DamageText/Combat + Game 主循环与状态机
require('./js/core.js');

// 4. 输入：键盘 + 虚拟摇杆 + 多点触控 + 点击排队
require('./js/input.js');

// 5. 存档：Meta 永久存档 / Settings 设置
require('./js/save.js');

// 6. 玩家：移动/冲刺/受击/属性
require('./js/player.js');

// 7. 敌人：Enemy AI / BossSystem / WallCollision
require('./js/enemy.js');

// 8. 武器：Bullet/PulseGun/OrbitBlade/Weapons/MortarStrike/LaserEmitter/WeaponProgress/WeaponSelect
require('./js/weapon.js');

// 9. 波次：Spawner 刷怪
require('./js/wave.js');

// 10. 道具/掉落：RunStats/Experience/ExpLevelUp/CoinDrops/PowerUps
require('./js/item.js');

// 11. 广告（保持独立，必须先于 fx.js：effects 加载时 var Ads=root.Ads）
require('./js/ads.js');

// 12. 特效/工具：UI 绘制库 + FX/Metrics/Spatial/ButtonUI/Panels/AudioFX + effects 层补丁
require('./js/fx.js');

// 13. 局内 HUD/战场：Field 墙壁炮塔 + Extraction 撤退点 + field 层补丁
require('./js/hud.js');

// 14. 菜单/营地/结算：主菜单/CampNav/Wardrobe/Achievements/FateCards/QUALITY + v004~v008 合并补丁
require('./js/menu.js');

// ---------- boot 启动（原 boot.js，所有模块加载完成后执行） ----------
var root = typeof window !== 'undefined' ? window : global;
root.FX.init();
root.ButtonUI.init();
try {
  root.Game.init();
} catch (error) {
  if (typeof console !== 'undefined' && console.error) console.error('[GAME BOOT]', error);
  var platform = root.Platform;
  var ctx = platform && platform.ctx;
  var canvas = platform && platform.canvas;
  if (ctx && canvas) {
    try {
      if (ctx.setTransform) ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#090d0b';
      ctx.fillRect(0, 0, canvas.width || 750, canvas.height || 1334);
      ctx.fillStyle = '#ff6b6b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 28px Arial';
      ctx.fillText('游戏启动失败', (canvas.width || 750) / 2, 260);
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px Arial';
      ctx.fillText('请截图控制台中 [GAME BOOT] 后的错误', (canvas.width || 750) / 2, 320);
    } catch (drawError) {
      if (console && console.error) console.error('[BOOT ERROR PAGE]', drawError);
    }
  }
}

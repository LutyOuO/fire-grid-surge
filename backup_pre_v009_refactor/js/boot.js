'use strict';
// ============================================================
// Boot（启动初始化）
// 所有模块加载完成后，创建对象池并启动游戏
// ============================================================
var root = (typeof window !== 'undefined') ? window : global;

// 初始化各模块的对象池
root.FX.init();
root.ButtonUI.init();

// 启动游戏。启动阶段也必须有兜底：若真机专属 API 抛错，不能只留下黑屏。
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

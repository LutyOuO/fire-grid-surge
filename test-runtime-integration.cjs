'use strict';
const assert = require('node:assert/strict');
const { createRuntime } = require('./tests/runtime-harness.cjs');

for (const mode of ['h5', 'wx']) {
  const r = createRuntime(mode), g = r.game, C = g.CONFIG;
  // 异步解码前不能画图，也不能重复创建同一路径的资源。
  r.draw();
  for (const key of Object.keys(C.ASSETS)) assert.equal(g.UI.icon(key), null);
  const count = r.images.length;
  assert.equal(new Set(r.images.map(i => i._src)).size, count, '启动时重复创建图片');
  g.Platform.retryPendingImages(); assert.equal(r.images.length, count);
  r.finishImages();
  for (const key of Object.keys(C.ASSETS)) assert(g.UI.icon(key), '未加载资源: ' + key);
  r.draw();
  for (const state of ['WEAPON_SELECT', C.GAME.STATE_BASE, 'ACHIEVEMENTS', 'FATE']) {
    if (state === 'FATE') g.FateCards.open(); else g.Game.state = state;
    r.draw();
  }
  g.Game.enterBase();
  for (const page of ['select', 'enhance', 'wardrobe']) {
    g.CampNav.page = page;
    for (const tab of ['character', 'gadget']) { g.UI.baseTab = tab; r.draw(); }
  }
  for (const weapon of ['pistol', 'flamer', 'crossbow']) {
    g.Meta.data.selectedWeapon = weapon;
    g.Game.restart(); g.Player.nextGod = true;
    for (let i = 0; i < 60; i++) { g.Game.update(1 / 60); r.draw(); }
  }
  // 真实 Input 按下/松开路径：暂停热区必须已被绘制注册。
  g.Game.restart(); r.draw();
  const pause = { x: C.UI.PAUSE_X, y: C.UI.PAUSE_Y, w: C.UI.PAUSE_SIZE, h: C.UI.PAUSE_SIZE };
  assert(pause.x >= C.VIEW.WIDTH / 2, '暂停键应在右侧');
  g.Input.onTouchStart(pause.x + 10, pause.y + 10, 90);
  g.Input.onTouchEnd(pause.x + 10, pause.y + 10, 90);
  g.Game.update(1 / 60); assert.equal(g.Game.state, 'PAUSED'); r.draw();
  g.Panels.resume(); assert.equal(g.Game.state, C.GAME.STATE_PLAYING);
  // 四档卡片实际绘制，含此前卡死的紫色/传说。
  g.ExpLevelUp.pendingChoices = 1;
  for (const rarity of C.UPGRADES.RARITIES) {
    g.Game.enterLevelUp();
    for (let i = 0; i < g.ExpLevelUp.offerCount; i++) g.ExpLevelUp.offers[i].rarity = rarity;
    r.draw();
  }
  g.Game.restart();
  // 前后台重置时间戳，不把 10 分钟后台时间变成战斗进度。
  g.Game.loop(1000); g.Game.loop(1016); const before = g.Game.survivedSeconds;
  for (const cb of g.Platform._hideHandlers) cb();
  g.Game.loop(601016);
  for (const cb of g.Platform._showHandlers) cb();
  g.Game.loop(601032);
  assert.equal(g.Game.survivedSeconds, before); assert.equal(g.Game.state, 'PAUSED');
  g.Panels.resume(); g.Game.loop(611032);
  assert(g.Game.survivedSeconds - before <= C.TIME.MAX_DT + 1e-9);
  assert(!g.Game.runtimeError, g.Game.runtimeError);
  g.PowerUps.inventory = [1, 1, 1, 1, 1, 1];
  g.MortarStrike.active = true;
  r.draw();
  assert(g.UI.icon('slot_bg') && g.UI.icon('btn_dash'), '道具栏/冲刺素材未就绪');
  // 解码失败必须返回 null，不能只因 width 非零就绘制。
  g.Platform.imageFailed.bomb = true; assert.equal(g.UI.icon('bomb'), null);
  console.log('PASS: ' + mode + ' 实际入口顺序/模块唯一归属/异步素材/页面与三武器/暂停点击/Canvas 栈/前后台');
}
for (const mode of ['h5', 'wx']) {
  const r = createRuntime(mode, { corruptSave: true });
  assert(Number.isFinite(r.game.Meta.data.coins)); r.draw();
}
console.log('PASS: H5 与微信损坏存档容错');

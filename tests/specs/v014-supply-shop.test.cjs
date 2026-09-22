'use strict';
// v014 #85/#86/#87：补给点商店交互——进入半径开面板并暂停战斗、entered 一次只弹一次、
// 关闭/点遮罩恢复、走出再进才重开、购买扣费/置灰/已满。
const assert = require('node:assert/strict');
const { createRuntime } = require('../helpers/runtime-harness.cjs');

for (const mode of ['h5', 'wx']) {
  const r = createRuntime(mode);
  r.finishImages();
  const g = r.game, C = g.CONFIG;

  g.Game.restart();

  // 直接在玩家身旁放置一个已激活的补给点。
  g.SupplyPoint.reset();
  g.SupplyPoint.active = true;
  g.SupplyPoint.x = g.Player.x + 10;
  g.SupplyPoint.y = g.Player.y;
  g.SupplyPoint.t = 999;
  g.SupplyPoint.entered = false;
  g.SupplyPoint.open = false;

  // #109 模拟玩家正按住摇杆、键盘和战斗按钮进入商店范围。
  g.Input.startJoystick(77, 80, C.VIEW.HEIGHT - 100);
  g.Input.updateJoystick(130, C.VIEW.HEIGHT - 100);
  g.Input.activeTouches.set(77, { type: 'joystick' });
  g.Input.keys.KeyD = true;
  g.Input.activeTouches.set(88, { type: 'button', action: 'dash' });
  g.ButtonUI.pressedTouches.set(88, { x: 0, y: 0, w: 1, h: 1 });

  // #85 进入半径自动开面板。
  g.Game.update(1 / 60);
  assert.equal(g.SupplyPoint.open, true, '进入半径应自动打开购买面板');
  assert.equal(g.SupplyPoint.entered, true, '打开后应写入 entered 锁定');
  // #85 打开时禁用摇杆/冲刺。
  assert.equal(g.Input.movementEnabled, false, '打开商店应禁用移动输入');
  assert.equal(g.Input.joystick.active, false, '打开商店应强制让摇杆归零');
  assert.equal(g.Input.joystick.moveX, 0, '打开商店应清除摇杆横向输入');
  assert.equal(g.Input.keys.KeyD, undefined, '打开商店应清除键盘按下状态');
  assert.equal(g.Input.activeTouches.size, 0, '打开商店应清除冲刺和道具触点');
  assert.equal(g.ButtonUI.pressedTouches.size, 0, '打开商店应清除按钮按压视觉');
  assert.equal(g.Input.pendingTap.active, false, '打开商店应清除遗留点击');

  // 商店打开期间触摸左下摇杆区域，也只能产生商店点击，不能重新启动摇杆。
  g.Input.onTouchStart(70, C.VIEW.HEIGHT - 90, 99);
  g.Input.onTouchMove(150, C.VIEW.HEIGHT - 90, 99);
  assert.equal(g.Input.joystick.active, false, '商店打开期间摇杆不得响应');
  g.Input.onTouchEnd(150, C.VIEW.HEIGHT - 90, 99);
  g.SupplyPoint.handleInput();
  assert.equal(g.SupplyPoint.open, true, '摇杆区域松手不得关闭商店');

  // #85 面板打开 = 战斗暂停：存活时间不推进（core.js updatePlaying 拦截）。
  const sBefore = g.Game.survivedSeconds;
  g.Game.update(0.5);
  assert.equal(g.Game.survivedSeconds, sBefore, '面板打开时战斗 dt 逻辑应暂停');
  assert.equal(g.SupplyPoint.open, true, '暂停期间面板保持打开');

  // #86 购买血包（第 0 行）：扣金币、道具+1。
  g.RunStats.gold = 100;
  const inv0 = g.PowerUps.inventory[C.POWERUPS.TYPE_MEDKIT];
  const br = g.SupplyPoint.buyRect(0);
  g.Input.pendingTap.active = true;
  g.Input.pendingTap.x = br.x + br.w / 2;
  g.Input.pendingTap.y = br.y + br.h / 2;
  g.Game.update(1 / 60);
  assert.equal(g.RunStats.gold, 100 - C.SUPPLY.PRICES.MEDKIT, '购买应按价扣局内金币');
  assert.equal(g.PowerUps.inventory[C.POWERUPS.TYPE_MEDKIT], inv0 + 1, '购买应使道具+1');

  // #86 金币不足：按钮置灰不可点，不扣钱不增加。
  g.RunStats.gold = 5;
  const inv1 = g.PowerUps.inventory[C.POWERUPS.TYPE_MEDKIT];
  g.Input.pendingTap.active = true;
  g.Input.pendingTap.x = br.x + br.w / 2;
  g.Input.pendingTap.y = br.y + br.h / 2;
  g.Game.update(1 / 60);
  assert.equal(g.PowerUps.inventory[C.POWERUPS.TYPE_MEDKIT], inv1, '金币不足不应购买');
  assert.equal(g.RunStats.gold, 5, '金币不足不应扣钱');

  // #86 持有上限：补满到 maxFor 后再买应被拒。
  const max = g.PowerUps.maxFor(C.POWERUPS.TYPE_MEDKIT);
  g.PowerUps.inventory[C.POWERUPS.TYPE_MEDKIT] = max;
  g.RunStats.gold = 500;
  const invMax = g.PowerUps.inventory[C.POWERUPS.TYPE_MEDKIT];
  g.Input.pendingTap.active = true;
  g.Input.pendingTap.x = br.x + br.w / 2;
  g.Input.pendingTap.y = br.y + br.h / 2;
  g.Game.update(1 / 60);
  assert.equal(g.PowerUps.inventory[C.POWERUPS.TYPE_MEDKIT], invMax, '已满不应继续购买');
  assert.equal(g.RunStats.gold, 500, '已满不应扣钱');
  g.PowerUps.inventory[C.POWERUPS.TYPE_MEDKIT] = inv1;
  g.RunStats.gold = 100;

  // #85 点"关闭"按钮关闭面板。
  const cr = g.SupplyPoint.closeRect();
  g.Input.pendingTap.active = true;
  g.Input.pendingTap.x = cr.x + cr.w / 2;
  g.Input.pendingTap.y = cr.y + cr.h / 2;
  g.Game.update(1 / 60);
  assert.equal(g.SupplyPoint.open, false, '点关闭按钮应关闭面板');
  assert.equal(g.Input.movementEnabled, true, '关闭后应恢复移动输入');
  // #85 仍在范围内：不重复弹。
  g.SupplyPoint.update(1 / 60);
  assert.equal(g.SupplyPoint.open, false, '仍在范围内不应重复弹面板');
  // #85 关闭后战斗立即恢复。
  const sAfter = g.Game.survivedSeconds;
  g.Game.update(0.5);
  assert(g.Game.survivedSeconds > sAfter, '关闭面板后战斗应立即恢复');

  // #85 走出半径才解除 entered，再进入才重新打开。
  g.Player.x = g.SupplyPoint.x + 1000;
  g.SupplyPoint.update(1 / 60);
  assert.equal(g.SupplyPoint.entered, false, '走出半径应清除 entered');
  g.Player.x = g.SupplyPoint.x;
  g.Player.y = g.SupplyPoint.y;
  g.SupplyPoint.update(1 / 60);
  assert.equal(g.SupplyPoint.open, true, '再次进入半径应重新打开面板');

  // #109 点半透明遮罩不再关闭，只能使用关闭按钮。
  const pr = g.SupplyPoint.panelRect();
  g.Input.pendingTap.active = true;
  g.Input.pendingTap.x = 10;
  g.Input.pendingTap.y = 10;
  g.SupplyPoint.handleInput();
  assert.equal(g.SupplyPoint.open, true, '点遮罩外区域不得关闭面板');
  g.Input.clearTap();

  const closeAgain = g.SupplyPoint.closeRect();
  g.Input.pendingTap.active = true;
  g.Input.pendingTap.x = closeAgain.x + closeAgain.w / 2;
  g.Input.pendingTap.y = closeAgain.y + closeAgain.h / 2;
  g.SupplyPoint.handleInput();
  assert.equal(g.SupplyPoint.open, false, '商店只能由关闭按钮关闭');

  // 走出再进入以重新打开面板，整帧绘制不崩、Canvas save/restore 平衡。
  g.Player.x = g.SupplyPoint.x + 1000;
  g.SupplyPoint.update(1 / 60);
  g.Player.x = g.SupplyPoint.x;
  g.SupplyPoint.update(1 / 60);
  assert.equal(g.SupplyPoint.open, true, '再次进入应重新打开面板');
  r.draw();

  console.log('PASS: ' + mode + ' v014 #85/#86/#87 商店暂停/锁定/关闭/购买置灰');
}

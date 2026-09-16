// #56/#57 HUD 布局与磁铁主动释放验证
// 覆盖：道具栏 4 槽固定顺序/位置、冲刺键独立固定、小目标布局、暂停按钮右上、磁铁 3 秒全图吸附。
'use strict';
var ctxStub = new Proxy({}, {
  get: function (t, k) {
    if (k in t) return t[k];
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return function () { return { addColorStop: function () {} }; };
    if (k === 'measureText') return function (s) { return { width: String(s).length * 12 }; };
    return function () {};
  },
  set: function (t, k, v) { t[k] = v; return true; }
});
var canvasEl = { width: 750, height: 1334, getContext: function () { return ctxStub; },
  style: {}, addEventListener: function () {}, getBoundingClientRect: function () { return { left: 0, top: 0, width: 750, height: 1334 }; } };
global.window = global;
global.innerWidth = 390; global.innerHeight = 844; global.devicePixelRatio = 2;
global.addEventListener = function () {};
global.document = {
  getElementById: function () { return canvasEl; },
  body: { style: {} }, addEventListener: function () {}, hidden: false
};
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
global.requestAnimationFrame = function () {};
require('../../game.js');

var Game = global.Game, UI = global.UI, CONFIG = global.CONFIG, PowerUps = global.PowerUps;
var Player = global.Player, Experience = global.Experience, Input = global.Input;
var assert = require('assert');

console.log('=== #56/#57 HUD 布局验证 ===');

// 进入战斗局
Game.enterMenu();
Game.restart();
Game.state = CONFIG.GAME.STATE_PLAYING;

// 1) 道具栏 5 槽固定顺序：炸弹→激光→磁铁→血包→冰冻
var T = CONFIG.POWERUPS;
assert.deepEqual(UI.ITEM_SLOTS, [T.TYPE_BOMB, T.TYPE_LASER_EMITTER, T.TYPE_MAGNET, T.TYPE_MEDKIT, T.TYPE_FREEZE],
  '道具栏槽顺序应为 炸弹→激光→磁铁→血包→冰冻');
console.log('1) 道具栏 5 槽固定顺序 OK:', UI.ITEM_SLOTS);

// 2) 槽位置：竖排右对齐，槽间距=16，顶槽在上、血包在最底
var r0 = UI.getSlotRect(0), r1 = UI.getSlotRect(1), r2 = UI.getSlotRect(2), r3 = UI.getSlotRect(3), r4 = UI.getSlotRect(4);
assert.strictEqual(r0.x, r4.x, '所有槽左对齐 x 相同');
assert.strictEqual(r0.w, CONFIG.UI.SLOT_SIZE, '槽宽=SLOT_SIZE');
assert(r3.y > r0.y, '底槽 y > 顶槽 y（竖排向上生长）');
var gap1 = r1.y - (r0.y + CONFIG.UI.SLOT_SIZE);
assert.strictEqual(gap1, CONFIG.UI.SLOT_GAP, '槽间距=SLOT_GAP');
// 底槽距下边缘
var bottomGap = (CONFIG.VIEW.HEIGHT - (CONFIG.UI.BOTTOM_INSET || 0)) - (r4.y + r4.h);
assert(bottomGap >= CONFIG.UI.ITEM_BAR_BOTTOM_M - 1, '最底槽距下边缘≈BOTTOM_M');
console.log('2) 道具栏竖排固定位置 OK: 顶槽 y=' + r0.y + ' 底槽 y=' + r4.y + ' 间距=' + gap1);

// 3) 冲刺键独立：位置不随持有数量变化，与道具栏水平间隔≥30
var dashY1 = UI.getDashButtonY();
PowerUps.inventory[T.TYPE_BOMB] = 3; PowerUps.inventory[T.TYPE_MAGNET] = 2;
var dashY2 = UI.getDashButtonY();
assert.strictEqual(dashY1, dashY2, '冲刺键 y 不随道具数量变化（固定位置）');
var dashCX = CONFIG.UI.DASH_BUTTON_X, dashR = CONFIG.UI.DASH_BUTTON_RADIUS;
var dashRightEdge = dashCX + dashR;
var hGap = r0.x - dashRightEdge; // 道具栏左边缘 - 冲刺键右边缘
assert(hGap >= 30, '冲刺键与道具栏水平间隔应≥30，实际 ' + hGap);
console.log('3) 冲刺键独立固定 OK: cx=' + dashCX + ' cy=' + dashY1 + ' 水平间隔=' + hGap.toFixed(1));

// 4) 暂停按钮固定右上角，且与小目标(左上)不重叠
assert(CONFIG.UI.PAUSE_X > 600, '暂停按钮应在右上');
assert(CONFIG.UI.PAUSE_Y >= 0, '暂停按钮 y≥0');
assert(CONFIG.UI.OBJ_X + CONFIG.UI.OBJ_W < CONFIG.UI.PAUSE_X, '小目标面板与暂停按钮无水平重叠');
console.log('4) 暂停按钮右上 OK: x=' + CONFIG.UI.PAUSE_X + ' y=' + CONFIG.UI.PAUSE_Y +
  '  小目标右侧=' + (CONFIG.UI.OBJ_X + CONFIG.UI.OBJ_W));

// 5) 小目标：在血条/经验条下方，展开高度≤屏高40%
assert(CONFIG.UI.OBJ_TOP >= 140, '小目标顶部应在 HUD 行下方(>=140)，实际 ' + CONFIG.UI.OBJ_TOP);
assert(CONFIG.UI.OBJ_EXPANDED_H <= CONFIG.VIEW.HEIGHT * 0.4, '展开高度不超过屏高40%');
assert(CONFIG.UI.OBJ_COLLAPSED_H >= 50 && CONFIG.UI.OBJ_COLLAPSED_H <= 60, '收起态高度 50-60');
console.log('5) 小目标布局 OK: OBJ_TOP=' + CONFIG.UI.OBJ_TOP +
  ' 展开高=' + CONFIG.UI.OBJ_EXPANDED_H + ' (40%=' + Math.round(CONFIG.VIEW.HEIGHT*0.4) + ')');

// 6) 磁铁主动释放：消耗1个、激活3秒、全图宝石高速吸附
PowerUps.inventory[T.TYPE_MAGNET] = 1;
Player.x = 400; Player.y = 400;
Experience.reset();
// 扔一颗宝石在 2000px 外（远超拾取半径）
Experience.dropGem(2400, 400, 10);
var gem = Experience.pool[0];
assert(gem.active && !gem.flying, '宝石初始静止');
var before = { x: gem.x, y: gem.y };
Experience.update(0.016); // 未激活磁铁：2000px 外不应飞
assert(!gem.flying, '磁铁未激活时远处宝石不飞');
var used = PowerUps.activate(T.TYPE_MAGNET);
assert(used === true, '磁铁主动释放应成功');
assert.strictEqual(PowerUps.inventory[T.TYPE_MAGNET], 0, '使用后磁铁-1');
assert(PowerUps.magnetActive() && Math.abs(PowerUps.magnetTimer - 3) < 0.01, '磁铁激活 3 秒');
Experience.update(0.016); // 激活后远处宝石应开始飞向玩家
assert(gem.flying, '磁铁激活后远处宝石被全图吸附');
assert(gem.x < before.x, '宝石朝玩家移动 (x:' + before.x + '->' + gem.x + ')');
console.log('6) 磁铁主动释放 OK: magnetTimer=' + PowerUps.magnetTimer +
  ' 宝石飞向玩家 (' + before.x.toFixed(0) + '->' + gem.x.toFixed(0) + ')');

// 7) 点击命中：0 态槽不可点，持有态可点
PowerUps.inventory[T.TYPE_MEDKIT] = 1;
Input.pendingTap.active = true; Input.pendingTap.x = r3.cx; Input.pendingTap.y = r3.cy; // 点血包槽
var picked = UI.consumePowerUpButton();
assert.strictEqual(picked, T.TYPE_MEDKIT, '点持有血包槽应返回血包类型，实际 ' + picked);
// 0 态槽（炸弹此时=0? 之前设了 bomb=3，改回0测）
PowerUps.inventory[T.TYPE_BOMB] = 0;
Input.pendingTap.active = true; Input.pendingTap.x = r0.cx; Input.pendingTap.y = r0.cy;
var picked0 = UI.consumePowerUpButton();
assert.strictEqual(picked0, -1, '0 态槽不应被消费（不可点）');
console.log('7) 槽位点击命中 OK: 持有态可触发, 0 态不可点');

// 8) 绘制不抛错：持有/0 态/磁铁激活/冲刺冷却/就绪 各画一遍
Game.draw();
assert(!Game.runtimeError, 'PLAYING 绘制异常: ' + Game.runtimeError);
PowerUps.magnetTimer = 1.5;
Player.dashCooldown = 4;
Game.draw();
assert(!Game.runtimeError, '磁铁激活+冲刺冷却绘制异常: ' + Game.runtimeError);
Player.dashCooldown = 0;
Game.draw();
assert(!Game.runtimeError, '冲刺就绪绘制异常: ' + Game.runtimeError);
Objectives.collapsed = false;
Game.draw();
assert(!Game.runtimeError, '小目标展开绘制异常: ' + Game.runtimeError);
console.log('8) 各状态绘制无异常 OK');

console.log('PASS: #56/#57 HUD 布局、槽位固定、磁铁主动吸附、点击命中全部通过');

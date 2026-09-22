'use strict';
// v013 #80：炮塔站立充能满后必须立即激活，不再因金币不足把 charge 清零、反复充能。
// 覆盖：玩家站入范围 charge 走满 -> 炮塔 active=1 且开始工作，余额为 0 也照常激活、不再循环。
var gradients = 0, arcs = 0, ellipses = 0, drawImages = 0;
var ctx = new Proxy({}, {
  get: function (t, k) {
    if (k in t) return t[k];
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return function () { gradients++; return { addColorStop: function () {} }; };
    if (k === 'measureText') return function (s) { return { width: String(s).length * 12 }; };
    if (k === 'arc') return function () { arcs++; };
    if (k === 'ellipse') return function () { ellipses++; };
    if (k === 'drawImage') return function () { drawImages++; };
    return function () {};
  },
  set: function (t, k, v) { t[k] = v; return true; }
});
var canvas = { width: 750, height: 1334, style: {}, getContext: function () { return ctx; }, addEventListener: function () {}, getBoundingClientRect: function () { return { left: 0, top: 0, width: 750, height: 1334 }; } };
global.window = global; global.innerWidth = 750; global.innerHeight = 1334; global.devicePixelRatio = 1; global.addEventListener = function () {}; global.requestAnimationFrame = function () {};
global.document = { getElementById: function () { return canvas; }, body: { style: {} }, addEventListener: function () {}, hidden: false };
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
global.Image = function () { var self = this; Object.defineProperty(this, 'src', { set: function () { if (self.onload) self.onload(); } }); };
require('../../game.js');

var assert = require('assert');
var C = global.CONFIG, F = global.Field, E = global.Enemy, P = global.Player, R = global.RunStats;

global.Game.restart();
assert.strictEqual(F.turrets.length, 3, '开局不是三座炮台');
var mortar = F.turrets.filter(function (t) { return t.kind === 'mortar'; })[0];
var tesla = F.turrets.filter(function (t) { return t.kind === 'tesla'; })[0];
var frost = F.turrets.filter(function (t) { return t.kind === 'frost'; })[0];

// 关闭上一座炮台，避免它干扰下一轮站位测试。
function shutDown(t) { t.active = false; t.timer = 0; t.cooldownTimer = 0; t.charge = 0; }

// 1) 迫击炮：余额 0，站入范围 charge 走满 -> 立即激活并开火（炮弹/命中）
E.reset();
var mTarget = E.spawn(mortar.x + 160, mortar.y, C.ENEMY.TYPE_WALKER, 1);
var mHp0 = mTarget.hp;
R.gold = 0; // 复现 #80：余额不足，旧逻辑会把 charge 清零导致死循环
P.x = mortar.x; P.y = mortar.y;
var sawShell = false, mActivated = false;
for (var i = 0; i < 80; i++) {
  F.update(0.1);
  if (mortar.active) mActivated = true;
  if (mActivated) {
    if (F.shells.some(function (s) { return s.active; })) sawShell = true;
    if (mTarget.hp < mHp0) break;
  }
}
assert.strictEqual(mortar.active, true, '#80 充能满后迫击炮必须立即激活，不得因金币不足清零');
assert(mortar.timer > 0, '激活后应设置持续时间');
assert.strictEqual(mortar.charge, 0, '激活后 charge 应清零');
assert(sawShell || mTarget.hp < mHp0, '激活后迫击炮应射出首轮炮弹并命中敌人');
// 不再循环：继续跑，迫击炮保持 active、charge 不反弹
for (var i = 0; i < 30; i++) F.update(0.1);
assert.strictEqual(mortar.active, true, '迫击炮激活后不应被重置回充能态');
assert.strictEqual(mortar.charge, 0, '已激活炮塔 charge 不应重新累积');
console.log('1) 迫击炮零金币充能满即激活并开火 OK');

// 2) 电弧塔：余额 0，充能满 -> 激活并自动打击周围敌人
shutDown(mortar);
E.reset();
var tA = E.spawn(tesla.x + 60, tesla.y, C.ENEMY.TYPE_WALKER, 1);
var tHp0 = tA.hp;
R.gold = 0;
P.x = tesla.x; P.y = tesla.y;
var tActivated = false;
for (var i = 0; i < 80; i++) {
  F.update(0.1);
  if (tesla.active) tActivated = true;
  if (tActivated && tA.hp < tHp0) break;
}
assert.strictEqual(tesla.active, true, '#80 电弧塔零金币也应激活');
assert(tA.hp < tHp0, '电弧塔激活后应自动打击敌人');
console.log('2) 电弧塔零金币激活后自动攻击 OK');

// 3) 霜冻塔：余额 0，充能满 -> 激活并释放冰球/冻土
shutDown(tesla);
E.reset();
var fE = E.spawn(frost.x + 50, frost.y, C.ENEMY.TYPE_WALKER, 1);
R.gold = 0;
P.x = frost.x; P.y = frost.y;
var sawFrost = false;
for (var i = 0; i < 120; i++) { // 6s：charge 3s + 进入工作
  F.update(0.05);
  if (frost.active && (F.frostOrbs.some(function (o) { return o.active; }) ||
      F.frostPatches.some(function (p) { return p.active; }) ||
      (fE.slowMul || 1) < 1 || (fE.freezeTimer || 0) > 0)) sawFrost = true;
}
assert.strictEqual(frost.active, true, '#80 霜冻塔零金币也应激活');
assert(sawFrost, '霜冻塔激活后应释放冰球/冻土或施加控制');
console.log('3) 霜冻塔零金币激活后释放冰系效果 OK');

console.log('PASS: v013 #80 炮塔充能满即激活（零金币）/持续工作/不再循环');

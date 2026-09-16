'use strict';
var assert = require('assert');
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

var C = global.CONFIG, F = global.Field, E = global.Enemy, P = global.Player;
assert(C.TURRETS && C.TURRETS.KINDS.tesla && C.TURRETS.KINDS.frost, 'CONFIG.TURRETS 三种类型未就绪');
assert.strictEqual(C.FIELD.LAYOUTS.length, 3, '应有三套地图');
assert.strictEqual(C.POWERUPS.DROP_WEIGHTS[C.POWERUPS.TYPE_MORTAR], 0, '迫击炮道具仍会掉落');
assert(C.META.GADGET_UPGRADES.turret_mortar && C.META.GADGET_UPGRADES.turret_tesla && C.META.GADGET_UPGRADES.turret_frost, '营地三棵炮台树缺失');

global.Game.restart();
assert.strictEqual(F.turrets.length, 3, '开局不是三座炮台');
var kinds = F.turrets.map(function (t) { return t.kind; }).sort().join(',');
assert.strictEqual(kinds, 'frost,mortar,tesla', '每套图必须 1+1+1');

var mortar = F.turrets.filter(function (t) { return t.kind === 'mortar'; })[0];
var tesla = F.turrets.filter(function (t) { return t.kind === 'tesla'; })[0];
var frost = F.turrets.filter(function (t) { return t.kind === 'frost'; })[0];
E.reset();
P.x = 1200; P.y = 1200;
var walker = E.spawn(mortar.x + 200, mortar.y, C.ENEMY.TYPE_WALKER, 1);
F.fireTurret(mortar);
assert(F.shells.some(function (s) { return s.active; }), '迫击炮没有炮弹');

E.reset();
var a = E.spawn(tesla.x + 80, tesla.y, C.ENEMY.TYPE_WALKER, 1);
var b = E.spawn(a.x + 80, a.y, C.ENEMY.TYPE_WALKER, 1);
var ha = a.hp, hb = b.hp;
F.fireTesla(tesla);
assert(a.hp < ha, '电塔没有打到主目标');
assert(b.hp < hb, '电塔没有连锁');
assert((a.stunTimer || 0) > 0, '电塔主目标未眩晕');

E.reset();
var f = E.spawn(frost.x + 60, frost.y, C.ENEMY.TYPE_WALKER, 1);
F.fireFrost(frost);
assert(F.frostOrbs.some(function (o) { return o.active; }), '霜塔没有冰球');
for (var i = 0; i < 40; i++) F.updateFrost(0.05);
assert(F.frostPatches.some(function (p) { return p.active; }) || (f.slowMul || 1) < 1 || (f.freezeTimer || 0) > 0, '霜塔没有冻土或控制');

F.applyLayout(1);
assert.strictEqual(F.layoutIndex, 1, '布局切换失败');
F.applyLayout(2);
assert.strictEqual(C.FIELD.TURRETS.filter(function (t) { return t.kind === 'mortar'; }).length, 1, '第三套图迫击数量不对');

console.log('PASS: 三种炮台/连锁/冻土/三套地图/掉落权重0');

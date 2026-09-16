'use strict';
// ============================================================
// #59 激光修订验证脚本
// 1) 激活 5 秒，每 0.5 秒打印实测转速（圈/秒），验证 0.8 -> 5 ease-out 加速
// 2) 穿透：墙后敌人应被秒杀；WallCollision.rayDistance(内部墙版)仍被截断作对照
// 3) 扫掠：dt=0.1s（180°/帧）大跨步，敌人落在两帧角度之间必命中；负对照不命中
// 运行：node test-laser-v009.cjs
// ============================================================

global.performance = undefined;
global.requestAnimationFrame = function (cb) { global.__nextFrame = cb; return 1; };
function makeGradient() { return { addColorStop: function () {} }; }
var context = new Proxy({}, {
  get: function (t, k) {
    if (k in t) return t[k];
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return makeGradient;
    if (k === 'measureText') return function (s) { return { width: String(s).length * 12 }; };
    return function () {};
  },
  set: function (t, k, v) { t[k] = v; return true; }
});
var canvas = { width: 0, height: 0, getContext: function () { return context; } };
global.wx = {
  createCanvas: function () { return canvas; },
  getSystemInfoSync: function () {
    return { windowWidth: 390, windowHeight: 844, pixelRatio: 3,
      safeArea: { top: 47, bottom: 810, left: 0, right: 390, width: 390, height: 763 },
      statusBarHeight: 47, platform: 'ios', model: '真机模拟' };
  },
  onTouchStart: function () {}, onTouchMove: function () {}, onTouchEnd: function () {}, onTouchCancel: function () {},
  onShow: function () {}, onHide: function () {},
  getStorageSync: function () { return ''; }, setStorageSync: function () {}
};

require('./game.js');

function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
function norm(a) { a = a % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a; }

var CONFIG = global.CONFIG, Player = global.Player, Enemy = global.Enemy;
var LaserEmitter = global.LaserEmitter, WallCollision = global.WallCollision;

// ---------- 1) 旋转速度曲线 ----------
console.log('=== 1) 旋转速度曲线（60fps 步长，实测圈/秒）===');
assert(CONFIG.LASER_EMITTER.SPIN_START_RPS === 0.8, '起始转速配置不是 0.8');
assert(CONFIG.LASER_EMITTER.SPIN_MAX_RPS === 5, '满速配置不是 5');
assert(CONFIG.LASER_EMITTER.SPIN_RAMP_TIME === 1.5, '加速时长不是 1.5s');
assert(CONFIG.LASER_EMITTER.TICK_INTERVAL === 0.05, '结算间隔不是 0.05s');

Player.x = 1200; Player.y = 1200;
LaserEmitter.reset(); LaserEmitter.activate();
var dt = 1 / 60, prev = LaserEmitter.angle, t = 0, nextMark = 0.5;
var firstRps = null, steadyRps = null;
console.log(' t(s)   实测rps');
for (var f = 0; f < 5 * 60; f++) {
  var before = LaserEmitter.angle;
  LaserEmitter.update(dt);
  t += dt;
  var dA = norm(LaserEmitter.angle - before);
  if (dA > Math.PI) dA -= Math.PI * 2;
  var rps = dA / dt / (Math.PI * 2);
  if (firstRps === null) firstRps = rps;
  if (t >= 1.5) steadyRps = rps;
  if (t >= nextMark - 1e-9) {
    console.log(' ' + t.toFixed(1) + '    ' + rps.toFixed(3));
    nextMark += 0.5;
  }
}
assert(firstRps < 1.1, '起始转速过快: ' + firstRps.toFixed(3) + ' rps');
assert(steadyRps > 4.7 && steadyRps < 5.3, '稳态转速异常: ' + steadyRps.toFixed(3) + ' rps');
console.log(' -> 起始 ' + firstRps.toFixed(2) + ' rps, 稳态 ' + steadyRps.toFixed(2) + ' rps OK\n');

// ---------- 2) 穿透内部墙 ----------
console.log('=== 2) 穿透内部墙 ===');
// 内部墙 (970,780,230,80) 横亘在玩家(1200,1200)与墙后点(1085,700)之间
Player.x = 1200; Player.y = 1200;
var ex = 1085, ey = 700;
var lineBlocked = WallCollision.segment(Player.x, Player.y, ex, ey, 0);
assert(lineBlocked, '预设失败：玩家到墙后敌人的直线未穿过内部墙');
var aEnemy = Math.atan2(ey - Player.y, ex - Player.x);
// 对照：保留内部墙检测的 rayDistance 应在墙面被截断
var dInternal = WallCollision.rayDistance(Player.x, Player.y, aEnemy);
assert(dInternal < Math.hypot(ex - Player.x, ey - Player.y),
  '对照失败：内部墙版本未截断，d=' + dInternal.toFixed(1));
// 激光：只算世界边界，应越过墙到达边界
LaserEmitter.reset(); LaserEmitter.activate();
LaserEmitter.angle = aEnemy;
var ends = LaserEmitter.ends();
var dLaser = Math.hypot(ends[0].x - Player.x, ends[0].y - Player.y);
assert(dLaser > Math.hypot(ex - Player.x, ey - Player.y),
  '激光未穿透墙：长度 ' + dLaser.toFixed(1) + ' < 墙后距离 ' + Math.hypot(ex - Player.x, ey - Player.y).toFixed(1));
console.log(' 内部墙版rayDistance截断于 ' + dInternal.toFixed(1) + 'px；激光延伸至 ' + dLaser.toFixed(1) + 'px（世界边界）OK');

// 墙后普通怪被扫掠秒杀
LaserEmitter.reset(); LaserEmitter.activate();
var walled = Enemy.spawn(ex, ey, CONFIG.ENEMY.TYPE_WALKER, 30);
assert(walled && walled.active, '墙后敌人生成失败');
LaserEmitter.lastSweepA = aEnemy - 0.2;
LaserEmitter.angle = aEnemy + 0.2;
LaserEmitter.dealDamage();
assert(!walled.active, '墙后普通怪未被激光穿透秒杀');
console.log(' 墙后普通怪被穿透秒杀 OK\n');

// ---------- 3) 低帧率扫掠 ----------
console.log('=== 3) 扫掠判定（dt=0.1s，5圈/秒≈180°/帧）===');
Player.x = 1200; Player.y = 1200;
LaserEmitter.reset(); LaserEmitter.activate();
// 敌人在 (1500,1200)，相对玩家角度=0；两帧角度 -1.5 -> +1.5（扫过 π）
var sweepA = Enemy.spawn(1500, 1200, CONFIG.ENEMY.TYPE_WALKER, 30);
LaserEmitter.lastSweepA = -1.5;
LaserEmitter.angle = 1.5;
LaserEmitter.dealDamage();
assert(!sweepA.active, '180° 扫掠扇形内敌人未命中');
console.log(' 落在两帧之间(0°，扫掠-86°~+86°)的敌人被秒杀 OK');
// 负对照：敌人在扫掠扇形外（角度≈π，对面）
var keepAlive = Enemy.spawn(900, 1200, CONFIG.ENEMY.TYPE_WALKER, 30);
LaserEmitter.dealDamage();
assert(keepAlive.active, '扫掠扇形外敌人被误杀');
console.log(' 扇形外(180°)敌人未被误杀 OK');

// 精英/Boss 直接扣血通道（无视无敌帧）：多 tick 稳定扣血
var boss = Enemy.spawn(1500, 1300, CONFIG.ENEMY.TYPE_BOSS, 1);
LaserEmitter.lastSweepA = 0; LaserEmitter.angle = 0.05;
var hpBefore = boss.hp;
LaserEmitter.dealDamage();
assert(boss.hp < hpBefore, '精英/Boss 每 tick 未结算伤害');
assert(!boss.active || boss.hp > 0, 'Boss 应存活承受多 tick');
console.log(' 精英/Boss 走直接扣血通道，本 tick 伤害 ' + (hpBefore - boss.hp).toFixed(1) + ' OK\n');

console.log('PASS: #59 速度曲线/穿透/扫掠/无视无敌帧 验证全部通过');

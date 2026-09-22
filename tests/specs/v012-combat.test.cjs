'use strict';
// ============================================================
// v012 战斗/碰撞修复验收（#69 绕墙速度 / #70 射线索敌 / #71 子弹撞墙）
// 运行：node tests/run-all.cjs
// ============================================================

global.performance = undefined;
global.requestAnimationFrame = function (callback) {
  global.__nextFrame = callback;
  return 1;
};

function makeGradient() { return { addColorStop: function () {} }; }

var context = new Proxy({}, {
  get: function (target, key) {
    if (key in target) return target[key];
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return makeGradient;
    if (key === 'measureText') return function (text) { return { width: String(text).length * 12 }; };
    return function () {};
  },
  set: function (target, key, value) { target[key] = value; return true; }
});

var canvas = { width: 0, height: 0, getContext: function () { return context; } };

global.wx = {
  createCanvas: function () { return canvas; },
  getSystemInfoSync: function () {
    return {
      windowWidth: 390, windowHeight: 844, pixelRatio: 3,
      safeArea: { top: 47, bottom: 810, left: 0, right: 390, width: 390, height: 763 },
      statusBarHeight: 47, platform: 'ios', model: '真机模拟'
    };
  },
  onTouchStart: function () {}, onTouchMove: function () {}, onTouchEnd: function () {}, onTouchCancel: function () {},
  onShow: function () {}, onHide: function () {},
  getStorageSync: function () { return ''; }, setStorageSync: function () {}
};

require('../../game.js');

function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

var CONFIG = global.CONFIG, Player = global.Player, Enemy = global.Enemy;
var WallCollision = global.WallCollision, Bullet = global.Bullet, PulseGun = global.PulseGun;
var Crossbow = global.Crossbow, WeaponProgress = global.WeaponProgress;

// 活动布局 cross_ruin 的第 5 面墙：x970-1200, y780-860
var wall = CONFIG.FIELD.WALLS[4];
assert(wall.x === 970 && wall.y === 780, '预设墙索引变动，请同步 v012 测试');

// ---------- #71 手枪子弹：墙内即销毁，空地不销毁 ----------
Bullet.reset();
assert(Bullet.shouldRemove({ life: 1, x: wall.x + wall.w / 2, y: wall.y + wall.h / 2 }),
  '#71：手枪子弹飞行中进入墙体未立即销毁');
assert(!Bullet.shouldRemove({ life: 1, x: 1200, y: 1200 }),
  '#71：手枪子弹在开阔空气被误销毁');
console.log('PASS: #71 手枪子弹墙内销毁断言');

// ---------- #71 弩箭：飞行途中碰墙立即销毁 ----------
Enemy.reset();
Crossbow.reset();
Crossbow.unlocked = true;
var bolt = Crossbow.spawn(0, { x: wall.x + wall.w / 2, y: wall.y + wall.h / 2, speed: 120, life: 5 });
assert(bolt && bolt.active, '#71：弩箭未生成');
Crossbow.update(1 / 60);
assert(!bolt.active, '#71：弩箭飞行中碰墙未在飞行途中销毁（疑似落地才销毁）');
console.log('PASS: #71 弩箭飞行碰墙销毁');

// ---------- #70 自动索敌：墙后更近的敌人被跳过，选可见敌人 ----------
Enemy.reset();
Bullet.reset();
WeaponProgress.selected = 'pistol';
Player.x = 1200; Player.y = 1000; // 墙 #5 正下方
// A：紧贴墙上方、直线被墙遮挡，且比 B 更近
var hidden = Enemy.spawn(1200, 700, CONFIG.ENEMY.TYPE_WALKER, 1);
assert(hidden.active && WallCollision.segment(Player.x, Player.y, hidden.x, hidden.y, 2),
  '#70 预设失败：hidden 敌人到玩家直线未被墙遮挡');
// B：开阔处可见，距离更远
var visible = Enemy.spawn(1800, 1000, CONFIG.ENEMY.TYPE_WALKER, 1);
assert(visible.active && !WallCollision.segment(Player.x, Player.y, visible.x, visible.y, 2),
  '#70 预设失败：visible 敌人到玩家直线竟被遮挡');

PulseGun.cooldown = 0;
PulseGun._aimCache = null;
PulseGun.update(0.01); // 首次重算并立即开火
var fired = null;
for (var bi = 0; bi < Bullet.pool.length; bi++) {
  if (Bullet.pool[bi].active) { fired = Bullet.pool[bi]; break; }
}
assert(fired, '#70：存在可见敌人时手枪未开火');
// B 在玩家 +x 方向，子弹应朝 +x 飞；旧逻辑会朝墙后 A（-y）飞
assert(fired.vx > 0 && Math.abs(fired.vx) > Math.abs(fired.vy),
  '#70：手枪仍瞄准墙后敌人而非可见敌人, vx=' + fired.vx + ' vy=' + fired.vy);
console.log('PASS: #70 索敌跳过墙后敌人、改射可见敌人');

// ---------- #70 全被墙遮挡：视为无目标，停止射击 ----------
Enemy.reset();
Bullet.reset();
Player.x = 1200; Player.y = 1000;
var onlyHidden = Enemy.spawn(1200, 700, CONFIG.ENEMY.TYPE_WALKER, 1);
PulseGun.cooldown = 0;
PulseGun._aimCache = null;
PulseGun.update(0.01);
var anyFired = false;
for (var bj = 0; bj < Bullet.pool.length; bj++) if (Bullet.pool[bj].active) { anyFired = true; break; }
assert(!anyFired, '#70：所有候选被墙遮挡时手枪仍在朝墙射击');
console.log('PASS: #70 全被墙遮挡时停止射击');

// ---------- #69 绕墙滑动速度 = 正常追击速度 ----------
Enemy.reset();
Player.x = 1200; Player.y = 700; // 玩家在墙 #5 上方
var slider = Enemy.spawn(1200, 900, CONFIG.ENEMY.TYPE_WALKER, 1); // 墙下方追击玩家
assert(slider && slider.active, '#69：滑动测试敌人生成失败');
slider.slowMul = 1;
Player.enemySpeedMultiplier = 1;
slider.avoidCheck = 0; // 强制本帧立即探测
slider.avoidTime = 0;
var expectedSpeed = slider.speed * Player.enemySpeedMultiplier * (slider.slowMul || 1);
var startX = slider.x, startY = slider.y, pathLen = 0;
var STEPS = 30, dt = 1 / 60;
for (var k = 0; k < STEPS; k++) {
  var px = slider.x, py = slider.y;
  Enemy.moveTowardPlayer(slider, dt);
  pathLen += Math.hypot(slider.x - px, slider.y - py);
}
var expectedPath = expectedSpeed * STEPS * dt; // 满速应走完的路程
assert(pathLen > expectedPath * 0.85,
  '#69：绕墙滑动过慢 path=' + pathLen.toFixed(1) + ' 期望≈' + expectedPath.toFixed(1));
assert(Math.abs(slider.x - startX) > 15,
  '#69：敌人贴墙蹭动未产生横向滑动位移');
assert(slider.y > wall.y, '#69：敌人被推穿墙内');
console.log('PASS: #69 绕墙滑动满速 path=' + pathLen.toFixed(1) + ' 期望=' + expectedPath.toFixed(1));

console.log('PASS: v012 #69/#70/#71 战斗与碰撞修复全部通过');

'use strict';
// ============================================================
// v008 验收冒烟测试（#55 重构后）
// 仅断言真实存在于源码的 v008 能力：墙体碰撞/三主武器成长/旋转激光/新波次数值/武器选择。
// 不引用尚未实现的 W8/WeaponLevels/Shop/SignIn/Season/Activity 等超前功能。
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

var CONFIG = global.CONFIG, Meta = global.Meta, Game = global.Game, UI = global.UI;
var Spawner = global.Spawner, WallCollision = global.WallCollision, Bullet = global.Bullet;
var LaserEmitter = global.LaserEmitter, WeaponProgress = global.WeaponProgress, WeaponSelect = global.WeaponSelect;
var Player = global.Player, Enemy = global.Enemy;

// ---------- #56 激光合并：LASER_ITEM 与 PowerUps 索引对齐 ----------
assert(CONFIG.FIELD.LASER_ITEM === 4, 'LASER_ITEM 常量未对齐当前值 4');
assert(CONFIG.POWERUPS.TYPE_LASER_EMITTER === 4, '激光发射器索引不是 4');
assert(CONFIG.POWERUPS.TYPE_MORTAR === 5, '迫击炮索引不是 5');
assert(global.PowerUps.inventory.length === 6, '道具库存不是 6 格');

// ---------- v008 内部墙 ----------
assert(global.WorldServices && Array.isArray(CONFIG.FIELD.WALLS) && CONFIG.FIELD.WALLS.length >= 6 && CONFIG.FIELD.WALLS.length <= 10,
  'v008 内部墙数量错误');
var wall0 = CONFIG.FIELD.WALLS[0];
assert(WallCollision.inside(wall0.x + 5, wall0.y + 5, 2), '内部墙碰撞无效');
assert(Bullet.shouldRemove({ life: 1, x: wall0.x + 5, y: wall0.y + 5 }), '手枪子弹未被墙回收');
var wallDistance = WallCollision.rayDistance(wall0.x - 100, wall0.y + wall0.h / 2, 0);
assert(wallDistance <= 105, '激光未在最近墙面截断');

// ---------- 三主武器成长存档 ----------
assert(global.Meta.data.weaponLevel && global.Meta.data.weaponLevel.pistol && global.Meta.data.weaponLevel.pistol.lv >= 1,
  '主武器成长存档未初始化');
var ptsBefore = global.Meta.data.weaponLevel.pistol.pts;
WeaponProgress.selected = 'pistol';
WeaponProgress.addKill(CONFIG.ENEMY.TYPE_TANK);
assert(global.Meta.data.weaponLevel.pistol.pts === ptsBefore + 2, '坦克武器点不是 2');

// ---------- 新波次数值 ----------
assert(Spawner.getSpawnInterval(99999) === 0.25, '刷怪间隔下限不是 0.25 秒');
Spawner.waveIndex = 5; Spawner.beginWave();
assert(Spawner.waveQuota === 8 + Spawner.waveIndex * 4, '单波普通怪公式错误');

// ---------- 旋转激光 ----------
LaserEmitter.reset();
assert(LaserEmitter.activate() && LaserEmitter.timer >= 5, '旋转激光无法激活或持续时间不足');
var laserAngle = LaserEmitter.angle;
LaserEmitter.update(0.05);
assert(LaserEmitter.angle !== laserAngle, '旋转激光没有旋转');

// ---------- #59 激光修订 ----------
// (1) 穿透内部墙：光束只算到 2400 世界边界，玩家在中心朝 +x 应止于 x=2400
Player.x = 1200; Player.y = 1200;
LaserEmitter.reset(); LaserEmitter.activate(); LaserEmitter.angle = 0;
var _end = LaserEmitter.ends()[0];
assert(Math.abs(_end.x - 2400) < 2 && Math.abs(_end.y - 1200) < 2,
  '激光未穿透内部墙延伸到世界边界, end=' + JSON.stringify(_end));
// (2) 旋转加速：起始≈0.8 圈/秒，1.5s ease-out 后≈5 圈/秒
LaserEmitter.reset(); LaserEmitter.activate();
var _a0 = LaserEmitter.angle; LaserEmitter.update(1 / 60);
var _rpsStart = normAngle(LaserEmitter.angle - _a0) / (1 / 60) / (Math.PI * 2);
assert(_rpsStart < 1.1, '激光起始旋转过快 rps=' + _rpsStart.toFixed(2));
for (var _f = 0; _f < 120; _f++) LaserEmitter.update(1 / 60);
var _a1 = LaserEmitter.angle; LaserEmitter.update(1 / 60);
var _rpsEnd = normAngle(LaserEmitter.angle - _a1) / (1 / 60) / (Math.PI * 2);
assert(_rpsEnd > 4.5 && _rpsEnd < 5.5, '激光稳态转速不在 5 圈/秒 rps=' + _rpsEnd.toFixed(2));
// (3) 扫掠秒杀：普通怪落入扫掠扇形即被秒（无视无敌帧）
LaserEmitter.reset(); LaserEmitter.activate();
LaserEmitter.angle = 0; LaserEmitter.lastSweepA = -0.2; LaserEmitter.angle = 0.2;
var _w = Enemy.spawn(1400, 1200, CONFIG.ENEMY.TYPE_WALKER, 30);
LaserEmitter.dealDamage();
assert(!_w.active, '扫掠判定未秒杀扇形内普通怪');
function normAngle(a) { a = a % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a; }

// ---------- 武器选择界面 ----------
Game.state = CONFIG.GAME.STATE_MENU;
WeaponSelect.draw(context);

// ---------- 五档品质 / 营地导航 / 命运抽牌仍在 ----------
['WHITE', 'BLUE', 'PURPLE', 'GOLD', 'RAINBOW'].forEach(function (id) {
  assert(CONFIG.QUALITY && CONFIG.QUALITY[id], '缺少品质 ' + id);
});
assert(global.CampNav, 'v007 营地导航未加载');
assert(global.FateCards && global.FateCards.defs.length === 86, '命运卡组不是 86 张');
global.FateCards.open();
assert(global.FateCards.cards.length === 9, '结算没有生成 9 张牌');

console.log('PASS: 墙体碰撞/三主武器成长/旋转激光/波次数值/武器选择冒烟全部通过');

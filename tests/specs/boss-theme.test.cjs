'use strict';
var assert = require('assert');
var ctx = new Proxy({}, {
  get: function (t, k) {
    if (k === 'measureText') return function (s) { return { width: String(s).length * 12 }; };
    if (k === 'createRadialGradient' || k === 'createLinearGradient') return function () { return { addColorStop: function () {} }; };
    return function () {};
  },
  set: function () { return true; }
});
var canvas = { width: 750, height: 1334, style: {}, getContext: function () { return ctx; }, addEventListener: function () {}, getBoundingClientRect: function () { return { left: 0, top: 0, width: 750, height: 1334 }; } };
global.window = global; global.innerWidth = 750; global.innerHeight = 1334; global.devicePixelRatio = 1; global.addEventListener = function () {}; global.requestAnimationFrame = function () {};
global.document = { getElementById: function () { return canvas; }, body: { style: {} }, addEventListener: function () {}, hidden: false };
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
global.Image = function () { var self = this; Object.defineProperty(this, 'src', { set: function () { if (self.onload) self.onload(); } }); };
require('../../game.js');

var C = global.CONFIG, E = global.Enemy, S = global.Spawner, P = global.Player;
assert(C.BOSS_MELEE && C.BOSS_MELEE.CHARGE_WARN === 1.2, '近战冲锋配置缺失');
assert(C.BOSS_SUMMON && C.BOSS_SUMMON.COUNT === 2, '召唤炮台配置缺失');
assert.deepEqual(C.WAVE_THEMES.WAVES, [4, 7, 11, 14], '主题波次不是 4/7/11/14');
assert.strictEqual(C.BALANCE.DUAL_BOSS_WAVE, 20);

global.Game.restart();
E.reset();
P.x = 1200;
P.y = 1200;
var melee = E.spawn(1200, 1500, C.ENEMY.TYPE_BOSS, 1);
melee.meleePhase = 'idle';
melee.meleeTimer = 0;
var started = E.updateBossMelee(melee, 0.05);
assert.strictEqual(melee.meleePhase, 'warn', '未进入预警');
assert.strictEqual(started, true);
E.updateBossMelee(melee, C.BOSS_MELEE.CHARGE_WARN + 0.01);
assert.strictEqual(melee.meleePhase, 'dash', '预警后没有冲锋');
var y0 = melee.y;
E.updateBossMelee(melee, 0.2);
assert(melee.y < y0, '冲锋没有向玩家加速');

E.reset();
var ranged = E.spawn(800, 800, C.ENEMY.TYPE_BOSS_RANGED, 1);
assert(ranged && ranged.maxHp > 0);
E.receiveDamage(ranged, ranged.maxHp * 0.55);
var turrets = E.pool.filter(function (e) { return e.active && e.isSummonTurret; });
assert.strictEqual(turrets.length, 2, '半血没有召唤2座小炮台');
assert(ranged.active && ranged.summonedTurrets);

S.reset();
S.waveIndex = 19;
S.beginWave();
assert.strictEqual(S.waveIndex, 20);
assert(S.bossPending && S.rangedPending, '第20波应同时待生成近战和远程Boss');
E.reset();
S.update(0.05, 600);
assert(E.getActiveMeleeBoss(), '第20波没有近战Boss');
var dualRanged = E.pool.filter(function (e) { return e.active && e.typeIndex === C.ENEMY.TYPE_BOSS_RANGED && !e.isSummonTurret; })[0];
assert(dualRanged, '第20波没有远程Boss');
var unscaled = Math.ceil(C.ENEMY.TYPES[C.ENEMY.TYPE_BOSS_RANGED].HP * S.getHpMultiplier() * (P.nextEnemyHp || 1));
assert(dualRanged.maxHp <= Math.ceil(unscaled * C.BALANCE.DUAL_RANGED_HP) + 1, '远程Boss生命未按0.7缩放');

S.reset();
S.waveIndex = 3;
S.beginWave();
assert.strictEqual(S.waveIndex, 4);
assert(S.theme && C.WAVE_THEMES.KINDS[S.theme], '第4波没有主题');
S.theme = null;
var baseInterval = S.getSpawnInterval(0);
S.theme = 'silent_hunt';
assert(S.getSpawnInterval(0) > baseInterval, '静默猎杀间隔未拉长');
S.theme = 'iron_tide';
var iron = S.normalWeights();
S.theme = 'burn_night';
var burn = S.normalWeights();
assert(burn.runner > iron.runner, '燃烧夜快跑者权重应更高');
assert(iron.tank > burn.tank, '铁壁潮坦克权重应更高');

console.log('PASS: Boss冲锋/半血召唤/第20波双Boss/波次主题权重');

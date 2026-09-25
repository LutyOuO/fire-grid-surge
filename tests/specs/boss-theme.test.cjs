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
assert(C.BOSS_MELEE && C.BOSS_MELEE.CHARGE_WARN === 0.9, '近战冲锋配置缺失');
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
assert.strictEqual(S.bossQueue.length, 3, '第20波应有三只分批 Boss');
E.reset();
S.update(0.05, 600);
var firstBoss = E.getActiveBoss();
assert(firstBoss, '第20波没有生成首只 Boss');
var bossDef = C.V20.BOSSES.filter(function(d){return d.ID===firstBoss.archetypeId;})[0];
assert.strictEqual(firstBoss.maxHp,Math.ceil(C.BALANCE.BOSS_HP*bossDef.HP*(1+20*C.V20.BOSS_HP_PER_WAVE)*2),'Boss 生命公式错误');
assert.strictEqual(S.bossQueue.length,2,'首只 Boss 出生后队列错误');
S.update(C.V20.BOSS_GAP+0.01,600);
assert.strictEqual(S.activeFamilyCount('boss'),2,'第二只 Boss 未错峰出生');
assert.strictEqual(S.bossQueue.length,1,'场上已有两只 Boss 时应保留最后一只');

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

console.log('PASS: Boss冲锋/半血召唤/第20波分批 Boss/波次主题权重');

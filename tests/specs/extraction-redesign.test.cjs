'use strict';
// v012 #73 撤离机制重做专项：第5波出现/站立激活/激活后难度惩罚/硬币公式/不撤离继续。
var assert = require('assert');
var ctx = new Proxy({}, {
  get: function (t, k) {
    if (k in t) return t[k];
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return function () { return { addColorStop: function () {} }; };
    if (k === 'measureText') return function (s) { return { width: String(s).length * 12 }; };
    return function () {};
  },
  set: function (t, k, v) { t[k] = v; return true; }
});
var canvas = { width: 750, height: 1334, style: {}, getContext: function () { return ctx; }, addEventListener: function () {}, getBoundingClientRect: function () { return { left: 0, top: 0, width: 750, height: 1334 }; } };
global.window = global; global.innerWidth = 750; global.innerHeight = 1334; global.devicePixelRatio = 1; global.addEventListener = function () {}; global.requestAnimationFrame = function () {};
global.document = { getElementById: function () { return canvas; }, body: { style: {} }, addEventListener: function () {}, hidden: false };
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
require('../../game.js');

var C = global.CONFIG, Ext = global.Extraction, S = global.Spawner, P = global.Player, E = global.Enemy, RS = global.RunStats, LU = global.ExpLevelUp;
var E2 = C.EXTRACTION;

// 开局：撤离点 hidden，未到点不出现。
global.Game.restart();
global.Game.state = C.GAME.STATE_PLAYING;
assert.strictEqual(Ext.state, 'hidden', '开局撤离点不应出现');
assert.strictEqual(S.extractionSurge, false, '开局刷怪惩罚应关闭');
assert.strictEqual(P.enemySpeedMultiplier, 1, '开局移速倍率应为1');

// 第 1~4 波不出现。
for (var w = 1; w <= 4; w++) Ext.notifyWave(w);
assert.strictEqual(Ext.state, 'hidden', '第5波前撤离点不应出现');

// 第 5 波出现并可激活。
Ext.notifyWave(5);
assert.strictEqual(Ext.state, 'inactive', '第5波撤离点未出现');

// 玩家站到撤离点范围内，点激活后站立充能 ACTIVATE_TIME。
P.x = C.EXTRACTION.X; P.y = C.EXTRACTION.Y;
S.waveIndex = 5;
Ext.update(0.001); // 计算 playerInZone
assert(Ext.playerInZone, '玩家不在撤离点范围内');
Ext.startActivation();
assert.strictEqual(Ext.state, 'activating', '未能开始激活');
for (var i = 0; i < 120; i++) Ext.update(0.1); // 累计 12s > 10s
assert.strictEqual(Ext.state, 'activated', '站立激活未完成');
assert.strictEqual(Ext.activatedWave, 5, '未记录激活波次');

// 激活后难度惩罚：移速 ×1.5、刷怪配额 ×2。
assert.strictEqual(P.enemySpeedMultiplier, E2.SPEED_PENALTY, '激活后敌人移速未×1.5');
assert.strictEqual(S.extractionSurge, true, '激活后刷怪惩罚未开启');
// 与减速词缀乘法兼容：再乘一个 0.85 减速应为 1.5*0.85。
P.enemySpeedMultiplier *= 0.85;
assert(Math.abs(P.enemySpeedMultiplier - E2.SPEED_PENALTY * 0.85) < 1e-9, '移速惩罚未与减速词缀乘法兼容');

// 激活后下一波（第6波）才可撤离；第5波内仍不能撤离。
Ext.notifyWave(5.5); // 同波不推进（_lastWave 已是5，5.5<=5 会被忽略；这里用整数波推进）
Ext.notifyWave(6);
assert.strictEqual(Ext.state, 'extractable', '第6波未变可撤离');

// 刷怪配额 ×2：beginWave 会把 waveIndex 从 5 推到 6，(8 + 6*4) * 2 = 64。
S.waveIndex = 5;
S.beginWave();
assert.strictEqual(S.waveIndex, 6, 'beginWave 未推进到第6波');
assert.strictEqual(S.waveQuota, Math.floor((8 + 6 * 4) * E2.SPAWN_QUOTA_MULT), '激活后刷怪配额未×2');

// 不撤离继续：玩家走出范围，extractable 状态停留、撤离计时清零，不自动结束。
P.x = 1500; P.y = 1200;
for (var j = 0; j < 30; j++) Ext.update(0.1);
assert.strictEqual(Ext.state, 'extractable', '不撤离应继续战斗，状态应停留可撤离');
assert.strictEqual(Ext.extractHoldTimer, 0, '离开范围应清零撤离计时');

// 按类型击杀计数器。
RS.killNormal = RS.killElite = RS.killBoss = RS.killSpecial = 0;
var walk = E.spawn(1500, 1200, C.ENEMY.TYPE_WALKER, 1);
var run = E.spawn(1510, 1200, C.ENEMY.TYPE_RUNNER, 1);
var tank = E.spawn(1520, 1200, C.ENEMY.TYPE_TANK, 1);
var elite = E.spawn(1530, 1200, C.ENEMY.TYPE_ELITE, 1);
var boss = E.spawn(1540, 1200, C.ENEMY.TYPE_BOSS, 1);
var ranged = E.spawn(1550, 1200, C.ENEMY.TYPE_BOSS_RANGED, 1);
E.kill(walk); E.kill(run); E.kill(tank); E.kill(elite); E.kill(boss); E.kill(ranged);
assert.strictEqual(RS.killNormal, 3, '普通怪计数错误');
assert.strictEqual(RS.killElite, 1, '精英计数错误');
assert.strictEqual(RS.killBoss, 1, 'BOSS计数错误');
assert.strictEqual(RS.killSpecial, 1, '特殊(远程Boss)计数错误');

// 幸存者硬币公式：wave=6, level=2, gold=100, normal=3/elite=1/boss=1/special=1。
S.waveIndex = 6; LU.level = 2; RS.gold = 100;
// floor(6*5 + 3*0.1 + 1*5 + 1*20 + 1*10 + 2*3 + 100*0.5)
// = floor(30 + 0.3 + 5 + 20 + 10 + 6 + 50) = floor(121.3) = 121
var expected = Math.floor(6 * E2.WAVE + 3 * E2.NORMAL + 1 * E2.ELITE + 1 * E2.BOSS + 1 * E2.SPECIAL + 2 * E2.LEVEL + 100 * E2.GOLD);
assert.strictEqual(expected, 121, '测试期望基准错误');
assert.strictEqual(RS.extractionPreview(), expected, '幸存者硬币公式数值错误');

// 继续挑战预估：应 >= 0，且大于现在撤离的预览（更晚撤离收益更高）。
assert(RS.extractGainIfContinue() >= 0, '继续挑战预估增量应为非负');
assert(RS.extractContinueEstimate() >= RS.extractionPreview(), '继续挑战预估不应低于现在撤离');

// 结算 extract 分支：extractBonus=true 时 finalCoins 等于公式值；广告四倍另乘。
RS.extractBonus = true;
var base = RS.extractionPreview();
RS.calculateCoins(0, LU.level, false);
assert.strictEqual(RS.finalCoins, base, '结算 extract 分支未用新公式');
RS.extractAdClaimed = true;
RS.calculateCoins(0, LU.level, false);
assert.strictEqual(RS.finalCoins, Math.floor(base * E2.AD_MULTIPLIER), '广告四倍未生效');

console.log('PASS: v012 #73 撤离重做专项（第5波出现/站立激活/×1.5×2/硬币公式/不撤离继续）全部通过');

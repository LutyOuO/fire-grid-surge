'use strict';
// v014 #94 战斗阶段起伏 + #95 BOSS 战清晰度专项。
// 覆盖：阶段机循环切换/配额倍率、BOSS 冲锋红色预警线(20px)、远程蓄力红圈、双BOSS血条左右分栏分色。
var assert = require('assert');
var calls = { lineWidths: [], strokeStyles: [], arcs: [], gradients: [], fillRects: [] };
function makeGrad() { return { addColorStop: function (o, c) { calls.gradients.push(c); } }; }
var ctx = new Proxy({}, {
  get: function (t, k) {
    if (k in t) return t[k];
    if (k === 'measureText') return function (s) { return { width: String(s).length * 12 }; };
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return makeGrad;
    if (k === 'fillRect') return function (x, y, w, h) { calls.fillRects.push({ x: x, y: y, w: w, h: h }); };
    if (k === 'arc') return function (cx, cy, r) { calls.arcs.push({ cx: cx, cy: cy, r: r }); };
    return function () {};
  },
  set: function (t, k, v) {
    t[k] = v;
    if (k === 'lineWidth') calls.lineWidths.push(v);
    if (k === 'strokeStyle') calls.strokeStyles.push(v);
    return true;
  }
});
var canvas = { width: 750, height: 1334, style: {}, getContext: function () { return ctx; }, addEventListener: function () {}, getBoundingClientRect: function () { return { left: 0, top: 0, width: 750, height: 1334 }; } };
global.window = global; global.innerWidth = 750; global.innerHeight = 1334; global.devicePixelRatio = 1; global.addEventListener = function () {}; global.requestAnimationFrame = function () {};
global.document = { getElementById: function () { return canvas; }, body: { style: {} }, addEventListener: function () {}, hidden: false };
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
require('../../game.js');

var C = global.CONFIG, S = global.Spawner, E = global.Enemy, P = global.Player, UI = global.UI;

// ---------- #94 阶段机配置 ----------
var PHASES = C.WAVE.PHASES;
assert(PHASES.normal.dur === 20 && PHASES.normal.quota === 1, 'normal 阶段应为 20s/quota1');
assert(PHASES.elite.dur === 10 && PHASES.elite.quota === 1.2, 'elite 阶段应为 10s/quota1.2');
assert(PHASES.dominant.dur === 15 && PHASES.dominant.quota === 0.7, 'dominant 阶段应为 15s/quota0.7');
assert(PHASES.boss.dur === 30 && PHASES.boss.quota === 1.5, 'boss 阶段应为 30s/quota1.5');
assert(PHASES.lull.dur === 10 && PHASES.lull.quota === 0.3, 'lull 阶段应为 10s/quota0.3');
assert.deepEqual(C.WAVE.PHASE_ORDER, ['normal', 'elite', 'dominant', 'boss', 'lull'], '阶段循环顺序错误');
console.log('1) CONFIG.WAVE.PHASES 五阶段时长/配额 OK');

// ---------- #94 阶段机切换 ----------
global.Game.restart();
E.reset();
S.reset();
assert.strictEqual(S.phase, 'normal', '开局应为 normal 阶段');
assert.strictEqual(S.getPhaseQuota(), 1, 'normal quota 应为 1');
// normal(20s) 计时耗尽后切到 elite
S.phaseTimer = 1;
S.updatePhase(1.05);
assert.strictEqual(S.phase, 'elite', 'normal 计时耗尽未切到 elite');
assert.strictEqual(S.getPhaseQuota(), 1.2, 'elite quota 应为 1.2');
// 沿顺序推进：elite→dominant→boss→lull→normal
S.advancePhase(); assert.strictEqual(S.phase, 'dominant', 'elite 后应 dominant');
assert.strictEqual(S.getPhaseQuota(), 0.7);
S.advancePhase(); assert.strictEqual(S.phase, 'boss', 'dominant 后应 boss');
assert.strictEqual(S.getPhaseQuota(), 1.5);
S.advancePhase(); assert.strictEqual(S.phase, 'lull', 'boss 后应 lull');
assert.strictEqual(S.getPhaseQuota(), 0.3);
S.advancePhase(); assert.strictEqual(S.phase, 'normal', 'lull 后应回到 normal（循环）');
console.log('2) 阶段机 normal→elite→dominant→boss→lull→normal 循环 OK');

// ---------- #94 与 extractionSurge ×2 相乘兼容 ----------
S.reset();
S.waveIndex = 5;
S.extractionSurge = true;
S.beginWave();
assert.strictEqual(S.waveIndex, 6, 'beginWave 未推进到 6');
assert.strictEqual(S.waveQuota, Math.floor((8 + 6 * 4) * C.EXTRACTION.SPAWN_QUOTA_MULT), 'extractionSurge 总配额未×2');
S.extractionSurge = false;
console.log('3) extractionSurge ×2 与阶段机兼容 OK');

// ---------- #95 BOSS 冲锋红色预警线（20px 半透明红，方向锁定） ----------
E.reset();
P.x = 1200; P.y = 1200;
var melee = E.spawn(1200, 1500, C.ENEMY.TYPE_BOSS, 1);
melee.meleePhase = 'warn';
melee.meleeTimer = C.BOSS_MELEE.CHARGE_WARN;
melee.meleeTx = 1200; melee.meleeTy = 900; // 锁定点在玩家方向
calls.lineWidths.length = 0; calls.strokeStyles.length = 0; calls.arcs.length = 0;
E.drawThreats(ctx);
assert(calls.lineWidths.indexOf(C.BOSS_MELEE.WARN_LINE_WIDTH) >= 0, '冲锋预警线线宽应为 20px，实际 ' + calls.lineWidths);
assert.strictEqual(C.BOSS_MELEE.WARN_LINE_WIDTH, 20, 'WARN_LINE_WIDTH 应为 20');
assert(calls.strokeStyles.indexOf(C.COLORS.BOSS_WARN_LINE) >= 0, '冲锋预警线应为半透明红 BOSS_WARN_LINE');
// 锁定点红圈应画在 meleeTx/Ty 处（屏幕坐标 = 世界 - Camera）
var hitArc = calls.arcs.filter(function (a) { return Math.abs(a.r - melee.radius * 0.9) < 1; })[0];
assert(hitArc, '冲锋预警未画锁定点红圈');
console.log('4) BOSS 冲锋预警线 20px 半透明红、锁定点红圈 OK');

// ---------- #95 远程 BOSS 蓄力红圈（overlay 层） ----------
var ranged = E.spawn(900, 900, C.ENEMY.TYPE_BOSS_RANGED, 1);
ranged.bossChargeTimer = 1.0;
ranged.bossTargetX = 1100; ranged.bossTargetY = 1100;
calls.arcs.length = 0;
E.drawThreats(ctx);
var warnArc = calls.arcs.filter(function (a) { return Math.abs(a.r - C.BOSS_RANGED.EXPLOSION_RADIUS) < 1; })[0];
assert(warnArc, '远程 BOSS 蓄力未画落点红圈');
assert(Math.abs(warnArc.cx - (1100 - global.Camera.x)) < 1 && Math.abs(warnArc.cy - (1100 - global.Camera.y)) < 1, '远程红圈应画在锁定落点');
console.log('5) 远程 BOSS 蓄力落点红圈 OK');

// ---------- #95 双 BOSS 血条：左右分栏、颜色不同、行为提示 ----------
calls.gradients.length = 0; calls.fillRects.length = 0;
UI.drawBossBar(ctx);
var colors = calls.gradients.slice();
assert(colors.indexOf(C.COLORS.BOSS_MELEE_BAR_A) >= 0 && colors.indexOf(C.COLORS.BOSS_MELEE_BAR_B) >= 0, '近战 BOSS 血条应使用红橙渐变');
assert(colors.indexOf(C.COLORS.BOSS_RANGED_BAR_A) >= 0 && colors.indexOf(C.COLORS.BOSS_RANGED_BAR_B) >= 0, '远程 BOSS 血条应使用紫色渐变');
// 两个血条填充矩形：一个靠左、一个靠右
var barRects = calls.fillRects.filter(function (r) { return r.h === C.BOSS.BAR_HEIGHT && r.w > 50; });
assert(barRects.length >= 2, '双 BOSS 应画两条血条，实际 ' + barRects.length);
// 左栏贴左缘、右栏贴右缘（barW≈0.44*750=330，右栏 x≈404、右缘≈734）
var left = barRects.filter(function (r) { return r.x < 100; });
var right = barRects.filter(function (r) { return r.x + r.w > C.VIEW.WIDTH - 100; });
assert(left.length >= 1 && right.length >= 1, '双 BOSS 血条应左右分栏，实际 ' + JSON.stringify(barRects.map(function (r) { return r.x + '/' + (r.x + r.w); })));
console.log('6) 双 BOSS 血条左右分栏、近战红橙/远程紫 OK');

console.log('PASS: v014 #94 阶段机循环/配额倍率/extractionSurge 兼容 + #95 冲锋预警线/蓄力红圈/双BOSS分栏分色 全部通过');

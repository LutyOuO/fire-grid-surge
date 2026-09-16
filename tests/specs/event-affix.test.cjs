'use strict';
var assert = require('assert');
var ctx = new Proxy({}, { get: function (t, k) { if (k === 'measureText') return function (s) { return { width: String(s).length * 12 }; }; if (k === 'createRadialGradient' || k === 'createLinearGradient') return function () { return { addColorStop: function () {} }; }; return function () {}; }, set: function () { return true; } });
var canvas = { width: 750, height: 1334, style: {}, getContext: function () { return ctx; }, addEventListener: function () {}, getBoundingClientRect: function () { return { left: 0, top: 0, width: 750, height: 1334 }; } };
global.window = global; global.innerWidth = 750; global.innerHeight = 1334; global.devicePixelRatio = 1; global.addEventListener = function () {}; global.requestAnimationFrame = function () {};
global.document = { getElementById: function () { return canvas; }, body: { style: {} }, addEventListener: function () {}, hidden: false };
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
global.Image = function () { var self = this; Object.defineProperty(this, 'src', { set: function () { if (self.onload) self.onload(); } }); };
require('../../game.js');

var C = global.CONFIG, E = global.Enemy, B = global.BattleEvents, P = global.Player, Exp = global.ExpLevelUp;
assert(C.EVENTS && C.EVENTS.KINDS.airdrop && C.EVENTS.KINDS.elite_rush, '事件配置缺失');
assert(C.AFFIXES && C.AFFIXES.DEFS.swift && C.AFFIXES.DEFS.blast, '词缀配置缺失');
global.Game.restart();
global.Spawner.waveIndex = 5;
B.reset();
B.start('airdrop');
assert.strictEqual(B.active.id, 'airdrop', '空投未开始');
assert(B.active.x > 0 && B.active.y > 0, '空投没有坐标');
B.start('elite_rush');
assert.strictEqual(B.active.id, 'elite_rush');

E.reset();
var elite = E.spawn(400, 400, C.ENEMY.TYPE_ELITE, 1);
assert(elite.affixes && elite.affixes.length >= 1, '精英没有词缀');
assert(elite.affixes.indexOf('shield') < 0 || elite.affixes.indexOf('blast') < 0, '护盾与自爆互斥失败');

var ids = C.UPGRADES.DEFINITIONS.map(function (d) { return d.ID; });
['NAPALM', 'BACKDRAFT', 'INFERNO', 'PILEDRIVER', 'SCATTER_BOLT', 'MARKSMAN'].forEach(function (id) {
  assert(ids.indexOf(id) >= 0, '缺少词条 ' + id);
});
global.WeaponProgress.selected = 'pistol';
for (var k in Exp.levels) Exp.levels[k] = 0;
Exp.collectEligibleDefinitions();
var pistol = {};
for (var i = 0; i < Exp.candidateIndices.length; i++) pistol[C.UPGRADES.DEFINITIONS[Exp.candidateIndices[i]].ID] = true;
assert(!pistol.NAPALM && !pistol.MARKSMAN, '手枪局抽到了喷火/弩箭专属词条');

global.WeaponProgress.selected = 'flamer';
Exp.collectEligibleDefinitions();
var flamer = {};
for (var i = 0; i < Exp.candidateIndices.length; i++) flamer[C.UPGRADES.DEFINITIONS[Exp.candidateIndices[i]].ID] = true;
assert(flamer.NAPALM && flamer.INFERNO, '喷火局缺少史诗/传说词条');

assert.strictEqual(C.CONTENT.ACHIEVEMENT_COUNT, global.Achievements.defs.length, '成就数量未跟配置走');
assert.strictEqual(global.Achievements.defs.length, 35, 'A30-A35 未加入');

console.log('PASS: 事件/词缀互斥/新词条过滤/成就35');

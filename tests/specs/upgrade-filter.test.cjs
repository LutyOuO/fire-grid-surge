'use strict';
// ============================================================
// #58 升级词条按本局主武器过滤 — 验收测试
// 运行：node tests/run-all.cjs
// 覆盖：手枪/喷火器/弩箭三种主武器局的候选词条池过滤。
//   - 他武器专属词条不出现
//   - UNLOCK_FLAME / UNLOCK_CROSSBOW 在任何局都不出现
//   - 本武器专属词条全部在池
//   - 副武器飞刃词条 + 通用词条在三种局都在池
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

require('../../game.js');

function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

var CONFIG = global.CONFIG;
var ExpLevelUp = global.ExpLevelUp;
var WeaponProgress = global.WeaponProgress;
var defs = CONFIG.UPGRADES.DEFINITIONS;

// 按 weapon 字段汇总（配置侧真实标注）
var byWeapon = { pistol: [], flamer: [], crossbow: [], blade: [], all: [] };
var unlockIds = [];
for (var i = 0; i < defs.length; i++) {
  var d = defs[i];
  if (d.EFFECT === 'UNLOCK_FLAME' || d.EFFECT === 'UNLOCK_CROSSBOW') unlockIds.push(d.ID);
  if (byWeapon[d.weapon]) byWeapon[d.weapon].push(d.ID);
  else throw new Error('词条缺少 weapon 字段: ' + d.ID + ' (weapon=' + d.weapon + ')');
}
console.log('词条总数=' + defs.length +
  '  pistol=' + byWeapon.pistol.length +
  '  flamer=' + byWeapon.flamer.length +
  '  crossbow=' + byWeapon.crossbow.length +
  '  blade=' + byWeapon.blade.length +
  '  all=' + byWeapon.all.length +
  '  unlock=' + unlockIds.length);

// 每个武器局取一次过滤后候选池
function eligibleIdsFor(weapon) {
  WeaponProgress.selected = weapon;
  // 清掉等级上限干扰，只测武器过滤
  for (var k in ExpLevelUp.levels) ExpLevelUp.levels[k] = 0;
  ExpLevelUp.collectEligibleDefinitions();
  var set = {};
  for (var c = 0; c < ExpLevelUp.candidateIndices.length; c++) {
    set[defs[ExpLevelUp.candidateIndices[c]].ID] = true;
  }
  return set;
}

var pools = {
  pistol: eligibleIdsFor('pistol'),
  flamer: eligibleIdsFor('flamer'),
  crossbow: eligibleIdsFor('crossbow')
};

// --- 1. 跨武器专属词条绝不能出现 ---
function assertAbsent(pool, ids, runName) {
  for (var i = 0; i < ids.length; i++) {
    assert(!pool[ids[i]], runName + ' 局出现了他武器专属词条: ' + ids[i]);
  }
}
// 手枪局：不能出喷火器/弩箭专属
assertAbsent(pools.pistol, byWeapon.flamer, '手枪');
assertAbsent(pools.pistol, byWeapon.crossbow, '手枪');
// 喷火器局：不能出手枪/弩箭专属
assertAbsent(pools.flamer, byWeapon.pistol, '喷火器');
assertAbsent(pools.flamer, byWeapon.crossbow, '喷火器');
// 弩箭局：不能出喷火器/手枪专属
assertAbsent(pools.crossbow, byWeapon.flamer, '弩箭');
assertAbsent(pools.crossbow, byWeapon.pistol, '弩箭');

// --- 2. UNLOCK_* 在任何局都不出现 ---
for (var w in pools) assertAbsent(pools[w], unlockIds, w);

// --- 3. 本武器专属词条（不含 unlock）必须全部在池 ---
var unlockSet = {};
unlockIds.forEach(function (id) { unlockSet[id] = true; });
function realPerks(ids) { return ids.filter(function (id) { return !unlockSet[id]; }); }
function assertPresent(pool, ids, runName) {
  for (var i = 0; i < ids.length; i++) {
    assert(pool[ids[i]], runName + ' 局缺少本武器专属词条: ' + ids[i]);
  }
}
assertPresent(pools.pistol, byWeapon.pistol, '手枪');
assertPresent(pools.flamer, realPerks(byWeapon.flamer), '喷火器');
assertPresent(pools.crossbow, realPerks(byWeapon.crossbow), '弩箭');

// --- 4. 飞刃词条在三种局都在池 ---
for (var w2 in pools) assertPresent(pools[w2], byWeapon.blade, w2);

// --- 5. 通用词条在三种局都在池 ---
for (var w3 in pools) assertPresent(pools[w3], byWeapon.all, w3);

// --- 6. 实证：多轮 prepareOffers 实际发出的三张卡里绝不出现禁用 ID ---
var forbidden = {};
byWeapon.flamer.concat(byWeapon.crossbow, unlockIds).forEach(function (id) { forbidden[id] = true; });
// 手枪局实证
WeaponProgress.selected = 'pistol';
for (var t = 0; t < 200; t++) {
  for (var k2 in ExpLevelUp.levels) ExpLevelUp.levels[k2] = 0;
  ExpLevelUp.prepareOffers();
  for (var oi = 0; oi < ExpLevelUp.offerCount; oi++) {
    var oid = ExpLevelUp.offers[oi].definition.ID;
    // 手枪局禁用：喷火器/弩箭/unlock
    assert(!forbidden[oid], '手枪局抽卡发出禁用词条: ' + oid);
  }
}

console.log('PASS: #58 词条按主武器过滤全部通过');
console.log('  手枪局池大小=' + Object.keys(pools.pistol).length);
console.log('  喷火器局池大小=' + Object.keys(pools.flamer).length);
console.log('  弩箭局池大小=' + Object.keys(pools.crossbow).length);

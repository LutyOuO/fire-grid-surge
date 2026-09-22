'use strict';
// v014 #90/#91/#92/#93 六组 build 路线词条、核心机制、首次横幅、新手保底验收。
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
  getFileSystemManager: function () { return { accessSync: function () { return true; }, readFileSync: function () { return ''; }, mkdirSync: function () {}, writeFileSync: function () {}, unlinkSync: function () {}, renameSync: function () {} }; },
  getMenuButtonBoundingClientRect: function () { return { top: 0, height: 0 }; },
  getSystemInfoSync: function () { return { windowWidth: 1280, windowHeight: 720, screenWidth: 1280, screenHeight: 720, safeArea: { top: 0, bottom: 720, left: 0, right: 1280, width: 1280, height: 720 }, statusBarHeight: 0 }; },
  getStorageSync: function () { return ''; },
  setStorageSync: function () {},
  offTouchStart: function () {}, offTouchMove: function () {}, offTouchEnd: function () {}, offTouchCancel: function () {},
  onTouchStart: function () {}, onTouchMove: function () {}, onTouchEnd: function () {}, onTouchCancel: function () {},
  onShow: function () {}, onHide: function () {}, offShow: function () {}, offHide: function () {},
  VibrateShort: function () {}, VibrateLong: function () {}, createCanvas: function () { return canvas; },
  navigateToMiniProgram: function () {}, exitMiniProgram: function () {},
  login: function () {}, getUserInfo: function (cb) { if (cb) cb({ userInfo: { nickName: 'A', avatarUrl: 'a', language: 'zh', gender: 0, city: '', province: '', country: '', year: 2024 } }); },
  showShareMenu: function () {}, showModal: function (o) { if (o && o.success) o.success({ confirm: true }); },
  createInnerAudioContext: function () { return { play: function () {}, pause: function () {}, stop: function () {}, seek: function () {}, onPlay: function () {}, onCanplay: function () {}, onError: function () {}, destroy: function () {} }; }
};
require('../../game.js');
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

var CONFIG = global.CONFIG, ExpLevelUp = global.ExpLevelUp, WeaponProgress = global.WeaponProgress;
var PulseGun = global.PulseGun, Bullet = global.Bullet, Player = global.Player;
var Crossbow = global.Crossbow, FlameWeapon = global.FlameWeapon, Enemy = global.Enemy;
var Meta = global.Meta, RunStats = global.RunStats, WallCollision = global.WallCollision;
RunStats.sourceKills = RunStats.sourceKills || {};
RunStats.damageDealt = RunStats.damageDealt || {};

var defById = {};
CONFIG.UPGRADES.DEFINITIONS.forEach(function (d) { defById[d.ID] = d; });

// ---------- #90 六组路线词条存在、weapon 标记正确、过滤正确 ----------
(function checkRoutes() {
  var routeIds = Object.keys(CONFIG.UPGRADES.BUILD_ROUTES);
  assert(routeIds.length === 6, '应有六组 build 路线, 实际=' + routeIds.length);
  routeIds.forEach(function (rid) {
    var r = CONFIG.UPGRADES.BUILD_ROUTES[rid];
    assert(r.perks.length >= 2, '路线 ' + rid + ' 至少 2 个词条');
    r.perks.forEach(function (pid) {
      assert(defById[pid], '路线 ' + rid + ' 缺少词条 ' + pid);
      assert(defById[pid].weapon === r.weapon, '词条 ' + pid + ' weapon=' + defById[pid].weapon + ' 与路线武器 ' + r.weapon + ' 不符');
    });
  });
  // 路线标志性新词条必须带 weapon 标记且走 #58 过滤
  var sig = ['FAN_SPRAY', 'PIERCE_INFINITE', 'CLOSE_BURST', 'LONG_SHOT', 'WALL_PIERCE'];
  sig.forEach(function (id) { assert(defById[id] && defById[id].weapon, id + ' 必须带 weapon 标记'); });
  // weapon 过滤：手枪词条不进喷火器局，弩箭穿墙不进手枪局
  function poolIds(weapon) {
    WeaponProgress.selected = weapon;
    for (var k in ExpLevelUp.levels) ExpLevelUp.levels[k] = 0;
    ExpLevelUp.collectEligibleDefinitions();
    return ExpLevelUp.candidateIndices.map(function (i) { return CONFIG.UPGRADES.DEFINITIONS[i].ID; });
  }
  var pistolPool = poolIds('pistol'), flamePool = poolIds('flamer'), bowPool = poolIds('crossbow');
  assert(pistolPool.indexOf('FAN_SPRAY') >= 0 && pistolPool.indexOf('PIERCE_INFINITE') >= 0, '手枪池应含新手枪路线词条');
  assert(flamePool.indexOf('CLOSE_BURST') >= 0, '喷火器池应含 CLOSE_BURST');
  assert(bowPool.indexOf('LONG_SHOT') >= 0 && bowPool.indexOf('WALL_PIERCE') >= 0, '弩箭池应含新弩箭路线词条');
  assert(pistolPool.indexOf('CLOSE_BURST') < 0 && pistolPool.indexOf('WALL_PIERCE') < 0, '手枪池不应出现其他武器专属');
  console.log('  六组路线词条存在且 weapon 过滤正确 OK');
})();

// ---------- #90 多弹道真的多发 ----------
(function multishot() {
  WeaponProgress.selected = 'pistol';
  Player.x = 1000; Player.y = 1000;
  Enemy.reset(); Bullet.reset(); PulseGun.reset();
  var t = Enemy.spawn(1400, 1000, CONFIG.ENEMY.TYPE_WALKER, 1);
  Enemy.update(0);
  PulseGun.cooldown = 0; PulseGun._aimCache = null;
  PulseGun.update(0.01);
  var n1 = Bullet.pool.filter(function (b) { return b.active; }).length;
  assert(n1 === 1, '基础射速应发 1 发, 实际=' + n1);
  // 一次拿到 2 级多重射击 → 1+2 = 3 发扇形
  ExpLevelUp.applyUpgrade({ EFFECT: 'MULTISHOT', AMOUNT: 2 }, CONFIG.UPGRADES.RARITIES[0]);
  Bullet.reset(); Enemy.update(0);
  PulseGun.cooldown = 0; PulseGun._aimCache = null;
  PulseGun.update(0.01);
  var n3 = Bullet.pool.filter(function (b) { return b.active; }).length;
  assert(n3 === 3, '多重射击应扇形发 3 发, 实际=' + n3);
  // FAN_SPRAY 真的扩大扩散角
  var before = CONFIG.WEAPONS.PULSE.SPREAD_ANGLE;
  ExpLevelUp.applyUpgrade(defById['FAN_SPRAY'], CONFIG.UPGRADES.RARITIES[1]);
  assert(PulseGun.spreadBonus > 0, 'FAN_SPRAY 应扩大扩散角');
  console.log('  多弹道真的多发 / 扩散角扩大 OK (基础1→3, 扩散角 +' + (PulseGun.spreadBonus - 0).toFixed(2) + 'rad)');
})();

// ---------- #90 穿透真穿多个敌人 / 无限穿透 ----------
(function pierce() {
  WeaponProgress.selected = 'pistol';
  Player.x = 400; Player.y = 1000;
  Enemy.reset(); Bullet.reset(); PulseGun.reset();
  PulseGun.projectileCount = 1;
  PulseGun.penetration = 1; // 穿 1 个
  var mk = function (x) { var e = Enemy.spawn(x, 1000, CONFIG.ENEMY.TYPE_WALKER, 1); e.hp = 1; return e; };
  var e1 = mk(650); var e2 = mk(800); var e3 = mk(950);
  Enemy.update(0);
  PulseGun.cooldown = 0; PulseGun._aimCache = null;
  PulseGun.update(0.01);
  for (var f = 0; f < 80; f++) Bullet.update(1 / 60);
  assert(e1.hp <= 0 && e2.hp <= 0 && e3.hp > 0, '穿透1应穿 2 个敌人、第3个无伤, 实际 hp=' + e1.hp + ',' + e2.hp + ',' + e3.hp);
  // 无限穿透（子弹寿命 1.1s ≈ 500px，敌人放在射程内成线）
  e1 = Enemy.spawn(700, 1000, CONFIG.ENEMY.TYPE_WALKER, 1); e1.hp = 1;
  e2 = Enemy.spawn(820, 1000, CONFIG.ENEMY.TYPE_WALKER, 1); e2.hp = 1;
  e3 = Enemy.spawn(900, 1000, CONFIG.ENEMY.TYPE_WALKER, 1); e3.hp = 1;
  ExpLevelUp.applyUpgrade(defById['PIERCE_INFINITE'], CONFIG.UPGRADES.RARITIES[3]);
  assert(PulseGun.infinitePierce === true, 'PIERCE_INFINITE 应标记无限穿透');
  Enemy.update(0);
  PulseGun.cooldown = 0; PulseGun._aimCache = null;
  PulseGun.update(0.01);
  for (var g = 0; g < 80; g++) Bullet.update(1 / 60);
  assert(e1.hp <= 0 && e2.hp <= 0 && e3.hp <= 0, '无限穿透应穿全部敌人, 实际 hp=' + e1.hp + ',' + e2.hp + ',' + e3.hp);
  console.log('  穿透真穿多个 / 无限穿透 OK');
})();

// ---------- #90 弩箭分裂数量 / 穿墙 ----------
(function crossbow() {
  WeaponProgress.selected = 'crossbow';
  Player.x = 1000; Player.y = 1000;
  Crossbow.reset(); Enemy.reset();
  Crossbow.scatter = true;
  // 找一个 WallCollision.inside 为真的点，触发出墙分裂
  var wx = 0, wy = 0, found = false;
  for (var gx = 0; gx < 2000 && !found; gx += 40) for (var gy = 0; gy < 1200 && !found; gy += 40) {
    if (WallCollision.inside(gx, gy, 8)) { wx = gx; wy = gy; found = true; }
  }
  assert(found, '应能找到墙内点');
  var bolt = Crossbow.spawn(0, { x: wx, y: wy, speed: 500, life: 1, scatter: false });
  var beforeCount = Crossbow.arrows.filter(function (a) { return a.active; }).length;
  Crossbow.splitBolt(bolt);
  var afterCount = Crossbow.arrows.filter(function (a) { return a.active; }).length;
  assert(afterCount - beforeCount === CONFIG.CONTENT.CROSSBOW.SCATTER_SPLITS, '分裂应出 ' + CONFIG.CONTENT.CROSSBOW.SCATTER_SPLITS + ' 支短弩, 实际差=' + (afterCount - beforeCount));
  // 穿墙箭：wallPierce 箭命中墙不销毁
  Crossbow.wallPierce = true;
  var b = Crossbow.spawn(Math.PI, { x: wx + 5, y: wy, speed: 300, life: 5, scatter: false });
  b.x = wx; b.y = wy;
  Crossbow.update(0.1);
  assert(b.active === true, '穿墙箭命中墙不应销毁');
  Crossbow.wallPierce = false;
  // LONG_SHOT：箭寿命与单发伤害提升
  Crossbow.reset();
  var lifeBefore = Crossbow.arrowLifeMul, dmgBefore = Crossbow.longShotBonus;
  ExpLevelUp.applyUpgrade(defById['LONG_SHOT'], CONFIG.UPGRADES.RARITIES[1]);
  assert(Crossbow.arrowLifeMul > lifeBefore && Crossbow.longShotBonus > dmgBefore, 'LONG_SHOT 应延长射程并提升单发伤害');
  console.log('  分裂箭数量 / 穿墙 / 远射 OK (分裂=' + CONFIG.CONTENT.CROSSBOW.SCATTER_SPLITS + ')');
})();

// ---------- #90 燃烧地面真的持续伤害 ----------
(function burnPatch() {
  WeaponProgress.selected = 'flamer';
  Player.x = 1000; Player.y = 1000;
  Enemy.reset(); FlameWeapon.reset();
  FlameWeapon.napalm = true;
  var t = Enemy.spawn(1120, 1000, CONFIG.ENEMY.TYPE_WALKER, 1);
  t.hp = 9999;
  FlameWeapon.aimTarget = t;
  FlameWeapon.fire();
  var patch = FlameWeapon.patches.filter(function (p) { return p.active; })[0];
  assert(patch, '火焰应落地产生燃烧区域');
  assert(Math.abs(patch.life - CONFIG.CONTENT.FLAME.PATCH_LIFE) < 0.01, '燃烧区域应持续 ' + CONFIG.CONTENT.FLAME.PATCH_LIFE + ' 秒, 实际=' + patch.life);
  // 把敌人放到 patch 中心，步进后应掉血（DoT）
  t.x = patch.x; t.y = patch.y;
  var hpBefore = t.hp;
  for (var i = 0; i < 10; i++) FlameWeapon.update(0.5);
  assert(t.hp < hpBefore, '燃烧区域应对其上敌人造成持续伤害, hp ' + hpBefore + '→' + t.hp);
  console.log('  燃烧地面 DoT OK (持续 ' + patch.life + 's, 敌人 hp ' + hpBefore + '→' + t.hp + ')');
})();

// ---------- #92 核心词条首次横幅只弹一次并存档 ----------
(function bannerOnce() {
  WeaponProgress.selected = 'pistol';
  Meta.data.perkBanners = {};
  Meta.perkBannerText = ''; Meta.perkBannerTimer = 0;
  // 构造一个 offer 走 selectOffer
  var Game = global.Game;
  var prevState = Game.state; Game.state = CONFIG.GAME.STATE_LEVELUP;
  ExpLevelUp.pendingChoices = 1; ExpLevelUp.offerCount = 1;
  ExpLevelUp.offers = [{ definition: defById['FAN_SPRAY'], rarity: CONFIG.UPGRADES.RARITIES[1] }];
  ExpLevelUp.selectOffer(0);
  assert(Meta.perkBannerText.length > 0, '首次获得核心词条应弹横幅');
  assert(Meta.data.perkBanners['FAN_SPRAY'] === true, '横幅记录应写入 Meta.data.perkBanners');
  // 再次获得同词条不再弹
  Meta.perkBannerText = '';
  ExpLevelUp.pendingChoices = 1;
  ExpLevelUp.offers = [{ definition: defById['FAN_SPRAY'], rarity: CONFIG.UPGRADES.RARITIES[1] }];
  ExpLevelUp.selectOffer(0);
  assert(Meta.perkBannerText === '', '同一核心词条只弹一次横幅');
  Game.state = prevState;
  console.log('  首次横幅只弹一次 / 持久化 OK');
})();

// ---------- #93 前 3 次升级保底 ≥2 张主武器专属 ----------
(function earlyGuarantee() {
  WeaponProgress.selected = 'pistol';
  for (var k in ExpLevelUp.levels) ExpLevelUp.levels[k] = 0;
  RunStats.choicesTaken = 0;
  ExpLevelUp.offers = [{}, {}, {}];
  var minWeaponCards = 99;
  for (var seed = 1; seed <= 40; seed++) {
    RunStats.choicesTaken = 0; // 前 3 次升级内
    ExpLevelUp.prepareOffers();
    var weaponCards = ExpLevelUp.offers.filter(function (o) { return o.definition.weapon === 'pistol'; }).length;
    if (weaponCards < minWeaponCards) minWeaponCards = weaponCards;
  }
  assert(minWeaponCards >= 2, '前 3 次升级每张三选一至少 2 张主武器专属, 实测最小=' + minWeaponCards);
  console.log('  前 3 次升级保底 OK (40 次抽样最少主武器专属卡=' + minWeaponCards + ' 张)');
})();

// ---------- #93 每局 1 次免费刷新 ----------
(function freeRefresh() {
  WeaponProgress.selected = 'pistol';
  Game.state = CONFIG.GAME.STATE_LEVELUP;
  ExpLevelUp.prepareOffers();
  RunStats.freeRefreshUsed = 0;
  var before = RunStats.freeRefreshUsed;
  Game.requestLevelRefresh();
  assert(RunStats.freeRefreshUsed === before + 1, '首次刷新应免费成功并计数');
  Game.requestLevelRefresh();
  assert(RunStats.freeRefreshUsed === before + 1, '免费额度用完后不再免费（走广告预留）');
  console.log('  每局 1 次免费刷新 OK');
})();

console.log('PASS: v014 #90/#91/#92/#93 六组 build 路线 / 核心机制 / 首次横幅 / 新手保底全部通过');

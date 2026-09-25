'use strict';

// 极简微信真机模拟：特意不提供 performance，验证战斗首帧不会中断。
global.performance = undefined;
global.requestAnimationFrame = function (callback) {
  global.__nextFrame = callback;
  return 1;
};

function makeGradient() {
  return { addColorStop: function () {} };
}

var context = new Proxy({}, {
  get: function (target, key) {
    if (key in target) return target[key];
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return makeGradient;
    if (key === 'measureText') return function (text) { return { width: String(text).length * 12 }; };
    return function () {};
  },
  set: function (target, key, value) {
    target[key] = value;
    return true;
  }
});

var canvas = {
  width: 0,
  height: 0,
  getContext: function () { return context; }
};

global.wx = {
  createCanvas: function () { return canvas; },
  getSystemInfoSync: function () {
    return {
      windowWidth: 390,
      windowHeight: 844,
      pixelRatio: 3,
      safeArea: { top: 47, bottom: 810, left: 0, right: 390, width: 390, height: 763 },
      statusBarHeight: 47,
      platform: 'ios',
      model: '真机模拟'
    };
  },
  onTouchStart: function (callback) { global.__touchStart = callback; },
  onTouchMove: function (callback) { global.__touchMove = callback; },
  onTouchEnd: function (callback) { global.__touchEnd = callback; },
  onTouchCancel: function (callback) { global.__touchCancel = callback; },
  onShow: function () {},
  onHide: function () {},
  getStorageSync: function () { return ''; },
  setStorageSync: function () {}
};

require('../../game.js');
global.Game.restart();
global.Game.updatePlaying(0.016);
global.Game.draw();

if (global.Game.state !== global.CONFIG.GAME.STATE_PLAYING) {
  throw new Error('开始游戏后没有进入 PLAYING 状态');
}
if (!Number.isFinite(global.Player.x) || !Number.isFinite(global.Player.y)) {
  throw new Error('玩家没有正确创建');
}

// 双指回归：左手摇杆按住时，右手冲刺不得抢走或关闭摇杆。
global.Input.onTouchStart(120, 1080, 11);
global.Input.onTouchMove(190, 1080, 11);
if (!global.Input.joystick.active || global.Input.joystick.pointerId !== 11) {
  throw new Error('第一根左下触点没有取得摇杆控制权');
}
var dashY = global.UI.getDashButtonY();
global.Input.onTouchStart(global.CONFIG.UI.DASH_BUTTON_X, dashY, 22);
if (!global.Player.dashing) throw new Error('冲刺没有在 touchstart 当帧触发');
if (!global.Input.joystick.active || global.Input.joystick.pointerId !== 11) {
  throw new Error('右手按钮触点抢走了左手摇杆');
}
global.Input.onTouchEnd(global.CONFIG.UI.DASH_BUTTON_X, dashY, 22);
if (!global.Input.joystick.active) throw new Error('松开右手按钮错误地关闭了摇杆');
global.Input.onTouchEnd(190, 1080, 11);
if (global.Input.joystick.active || global.Input.activeTouches.size !== 0) {
  throw new Error('触点结束后仍存在卡住的输入状态');
}
var s = global.Platform._scale, ox = global.Platform._offsetX, oy = global.Platform._offsetY;
global.__touchStart({ changedTouches: [
  { identifier: 31, clientX: ox + 100 * s, clientY: oy + 1080 * s },
  { identifier: 32, clientX: ox + 500 * s, clientY: oy + 700 * s }
] });
if (global.Input.activeTouches.size !== 2 || global.Input.joystick.pointerId !== 31) {
  throw new Error('Platform 没有逐个分发微信多触点 identifier');
}
global.__touchCancel({ changedTouches: [
  { identifier: 31, clientX: ox + 100 * s, clientY: oy + 1080 * s },
  { identifier: 32, clientX: ox + 500 * s, clientY: oy + 700 * s }
] });
if (global.Input.activeTouches.size !== 0 || global.Input.joystick.active) {
  throw new Error('微信 touchcancel 后仍有触点残留');
}

// 五档稀有度概率做大样本检查，并验证固定史诗/传说词条只出现在对应档（彩虹档复用传说池）。
var rarityCounts = { COMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0, RAINBOW: 0 };
for (var rarityRoll = 0; rarityRoll < 100000; rarityRoll++) {
  rarityCounts[global.ExpLevelUp.rollRarity().ID] += 1;
}
var rarityExpected = { COMMON: 0.801, RARE: 0.18, EPIC: 0.015, LEGENDARY: 0.0035, RAINBOW: 0.0005 };
Object.keys(rarityExpected).forEach(function (id) {
  var actual = rarityCounts[id] / 100000;
  if (Math.abs(actual - rarityExpected[id]) > 0.01) throw new Error(id + ' 稀有度概率偏差过大: ' + actual);
});
for (var offerRound = 0; offerRound < 200; offerRound++) {
  global.ExpLevelUp.prepareOffers();
  var ids = Object.create(null);
  for (var oi = 0; oi < global.ExpLevelUp.offerCount; oi++) {
    var offer = global.ExpLevelUp.offers[oi];
    if (ids[offer.definition.ID]) throw new Error('同次三选一出现重复词条');
    ids[offer.definition.ID] = true;
    if (offer.definition.RARITY && offer.definition.RARITY !== offer.rarity.ID && !(offer.rarity.ID === 'RAINBOW' && offer.definition.RARITY === 'LEGENDARY')) {
      throw new Error('固定高稀有词条进入错误档位');
    }
  }
}
var legendaryDef = global.CONFIG.UPGRADES.DEFINITIONS.filter(function (d) { return d.ID === 'DUAL_WIELD'; })[0];
global.ExpLevelUp.offers[0].definition = legendaryDef;
global.ExpLevelUp.offers[0].rarity = global.CONFIG.UPGRADES.RARITIES[3];
global.ExpLevelUp.offers[0].description = global.CONFIG.TEXT.UPGRADES.DUAL_WIELD.DESC();
global.ExpLevelUp.offers[0].level = 0; global.ExpLevelUp.offerCount = 1;
global.Game.state = global.CONFIG.GAME.STATE_LEVELUP;
global.Game.draw();

// #84 第五档 RAINBOW：存在、通过 validateOffers、可绘制（彩虹光效）。
var rainbowRarity = global.CONFIG.UPGRADES.RARITIES.filter(function (r) { return r.ID === 'RAINBOW'; })[0];
if (!rainbowRarity) throw new Error('CONFIG.UPGRADES.RARITIES 缺少 RAINBOW 第五档');
if (typeof global.CONFIG.COLORS[rainbowRarity.COLOR_KEY] !== 'string') throw new Error('RAINBOW 缺少稀有度颜色');
global.ExpLevelUp.offers[0].rarity = rainbowRarity;
if (!global.ExpLevelUp.validateOffers(global.ExpLevelUp.offers)) throw new Error('RAINBOW 第五档未通过 validateOffers');
global.Game.draw();

// 基地新版 UI：角色页、第二页、三个道具分页都必须能完成绘制。
global.Game.enterBase();
global.UI.baseTab = 'character';
global.UI.baseCharacterPage = 0;
global.Game.draw();
global.UI.baseCharacterPage = 1;
global.Game.draw();
global.UI.baseTab = 'gadget';
for (var gadgetPage = 0; gadgetPage < 3; gadgetPage++) {
  global.UI.baseGadgetIndex = gadgetPage;
  global.Game.draw();
}

// 最矮逻辑屏也不能让分页按钮溢出底部。
global.Platform.sysInfo = {
  windowWidth: 750, windowHeight: 1100, pixelRatio: 1,
  safeArea: { top: 30, bottom: 1070, left: 0, right: 750, width: 750, height: 1040 },
  statusBarHeight: 30, platform: 'ios', model: '短屏模拟'
};
global.Platform._calcLayout();
global.Game.draw();
if (global.CONFIG.UI.BASE_PAGER_Y + global.CONFIG.UI.BASE_PAGER_HEIGHT >
    global.CONFIG.VIEW.HEIGHT - global.CONFIG.UI.BOTTOM_INSET) {
  throw new Error('基地分页按钮在短屏上发生底部溢出');
}

// 验证角色分页与道具分页点击编码能被 Game 正确消费。
// v007 进入基地后先到选择页，测试子页功能时显式进入“强化”。
if (!global.CampNav) throw new Error('v007 营地导航未加载');
global.CampNav.page = 'enhance';
global.UI.baseTab = 'character';
global.UI.baseCharacterPage = 0;
global.Input.pendingTap.active = true;
global.Input.pendingTap.x = global.CONFIG.VIEW.WIDTH / 2 + 108 + global.CONFIG.UI.BASE_NAV_WIDTH / 2;
global.Input.pendingTap.y = global.CONFIG.UI.BASE_PAGER_Y + global.CONFIG.UI.BASE_NAV_HEIGHT / 2;
global.Game.updateBase(0.016);
if (global.UI.baseCharacterPage !== 1) throw new Error('角色强化下一页按钮无效');

global.UI.baseTab = 'gadget';
global.UI.baseGadgetIndex = 0;
global.Input.pendingTap.active = true;
global.Input.pendingTap.x = global.CONFIG.UI.BASE_CARD_X + global.CONFIG.UI.BASE_CARD_WIDTH - 12 -
  global.CONFIG.UI.BASE_NAV_WIDTH / 2;
global.Input.pendingTap.y = global.CONFIG.UI.BASE_CONTENT_Y + global.CONFIG.UI.BASE_SECTION_HEIGHT / 2;
global.Game.updateBase(0.016);
if (global.UI.baseGadgetIndex !== 1) throw new Error('道具强化下一装备按钮无效');

// 购买热区必须仍然对应当前分页中的正确强化项。
global.Meta.data.survivorCoins = 999999;
global.UI.baseTab = 'character';
global.UI.baseCharacterPage = 0;
var robustBefore = global.Meta.getUpgradeLevel('ROBUST');
global.Input.pendingTap.active = true;
global.Input.pendingTap.x = global.CONFIG.UI.BASE_CARD_X + global.CONFIG.UI.BASE_CARD_WIDTH - 20;
global.Input.pendingTap.y = global.CONFIG.UI.BASE_LIST_Y + global.CONFIG.UI.BASE_ROW_HEIGHT -
  global.CONFIG.UI.BASE_BUY_HEIGHT / 2 - 8;
global.Game.updateBase(0.016);
if (global.Meta.getUpgradeLevel('ROBUST') !== robustBefore + 1) throw new Error('角色强化购买热区错误');

global.UI.baseTab = 'gadget';
global.UI.baseGadgetIndex = 1;
var healBefore = global.Meta.getGadgetLevel('medkit', 'heal');
global.Input.pendingTap.active = true;
global.Input.pendingTap.x = global.CONFIG.UI.BASE_CARD_X + global.CONFIG.UI.BASE_CARD_WIDTH - 20;
global.Input.pendingTap.y = global.CONFIG.UI.BASE_LIST_Y + global.CONFIG.UI.BASE_ROW_HEIGHT -
  global.CONFIG.UI.BASE_BUY_HEIGHT / 2 - 8;
global.Game.updateBase(0.016);
if (global.Meta.getGadgetLevel('medkit', 'heal') !== healBefore + 1) throw new Error('道具强化购买热区错误');

// 命运牌必须完整、编号唯一、品质数量与配置一致。
if (!global.FateCards || global.FateCards.defs.length !== 106) throw new Error('命运牌池不是106张');
var cardIds = Object.create(null), cardRarity = { COMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0 };
global.FateCards.defs.forEach(function (d) {
  if (cardIds[d[0]]) throw new Error('命运牌编号重复: ' + d[0]);
  cardIds[d[0]] = true; cardRarity[d[3]] += 1;
});
if (cardRarity.COMMON !== 47 || cardRarity.RARE !== 35 ||
    cardRarity.EPIC !== 17 || cardRarity.LEGENDARY !== 7) throw new Error('命运牌品质池数量错误');

// v007：非法渐变参数必须被钳制和回退，连续300次抽取升级不得异常。
var stops = [];
global.safeStop({ addColorStop: function (o, c) {
  if (!isFinite(o) || o < 0 || o > 1 || typeof c !== 'string' || !c) throw new Error('非法渐变参数');
  stops.push([o, c]);
}}, NaN, '');
if (stops.length !== 1 || stops[0][0] !== 0 || stops[0][1] !== '#BDC3C7') throw new Error('safeStop兜底失败');
for (var offerRound = 0; offerRound < 300; offerRound++) {
  if (!global.ExpLevelUp.prepareOffers()) throw new Error('第'+offerRound+'轮升级候选生成失败');
  for (var offerIndex = 0; offerIndex < global.ExpLevelUp.offerCount; offerIndex++) {
    var testedOffer = global.ExpLevelUp.offers[offerIndex];
    if (!testedOffer.definition || !testedOffer.rarity ||
        typeof global.CONFIG.COLORS[testedOffer.rarity.COLOR_KEY] !== 'string') {
      throw new Error('升级候选数据未通过校验');
    }
    global.UI.drawUpgradeCard(context, offerIndex, testedOffer);
  }
}
var qualityIds = ['WHITE','BLUE','PURPLE','GOLD','RAINBOW'];
qualityIds.forEach(function (id) { if (!global.CONFIG.QUALITY[id]) throw new Error('缺少品质 '+id); });

// v008：内部墙、三主武器成长、旋转激光和新波次数值。
if (!global.WorldServices || global.CONFIG.FIELD.WALLS.length < 6 || global.CONFIG.FIELD.WALLS.length > 10) {
  throw new Error('v008内部墙数量错误');
}
// 回归：v008 必须自带菜单点击与绘字辅助函数，不能引用其他脚本闭包的局部变量。
global.Input.clearTap();
global.Game.state = global.CONFIG.GAME.STATE_MENU;
global.Game.updateMenu();
global.WeaponSelect.draw(context);
var wall0 = global.CONFIG.FIELD.WALLS[0];
if (!global.WallCollision.inside(wall0.x + 5, wall0.y + 5, 2)) throw new Error('内部墙碰撞无效');
if (!global.Bullet.shouldRemove({ life: 1, x: wall0.x + 5, y: wall0.y + 5 })) throw new Error('手枪子弹没有被墙回收');
var wallDistance = global.WallCollision.rayDistance(wall0.x - 100, wall0.y + wall0.h / 2, 0);
if (wallDistance > 105) throw new Error('激光没有在最近墙面截断');
if (!global.Meta.data.weaponLevel || global.Meta.data.weaponLevel.pistol.lv < 1) throw new Error('主武器成长存档未初始化');
var weaponPtsBefore = global.Meta.data.weaponLevel.pistol.pts;
global.WeaponProgress.selected = 'pistol';
global.WeaponProgress.addKill(global.CONFIG.ENEMY.TYPE_TANK);
if (global.Meta.data.weaponLevel.pistol.pts !== weaponPtsBefore + 2) throw new Error('胖子武器点数不是2');
if (global.Spawner.getSpawnInterval(99999) !== 0.25) throw new Error('刷怪间隔下限不是0.25秒');
global.Spawner.waveIndex = 5; global.Spawner.beginWave();
if (global.Spawner.waveQuota !== 8 + global.Spawner.waveIndex * 4) throw new Error('单波普通怪公式错误');
global.LaserEmitter.reset();
if (!global.LaserEmitter.activate() || global.LaserEmitter.timer < 5) throw new Error('旋转激光无法激活或持续时间不足');
var laserAngle = global.LaserEmitter.angle;
global.LaserEmitter.update(0.05);
if (global.LaserEmitter.angle === laserAngle) throw new Error('旋转激光没有旋转');
global.FateCards.open();
if (global.FateCards.cards.length !== 9) throw new Error('结算没有生成9张牌');
global.FateCards.flip(4); global.FateCards.flip(5); global.FateCards.flip(6);
if (global.FateCards.selected !== 4) throw new Error('不是第一张翻开的牌生效');
global.FateCards.confirm();
if (!global.Meta.data.nextRunBuffs || global.Meta.data.nextRunBuffs.length !== 3 ||
    global.Meta.data.nextRunBuffs[0].cardId !== global.FateCards.cards[4].def[0]) {
  throw new Error('玩家翻开的三张命运牌没有写入存档');
}

// DEV 激活不写存档，五连击可显示；快速金币与开关状态可正常使用。
for (var devTap = 0; devTap < 5; devTap++) global.DevConsole.logoTap();
if (!global.DevConsole.active) throw new Error('Logo五连击没有激活DEV');
if (Object.prototype.hasOwnProperty.call(global.Meta.data, 'devActive')) throw new Error('DEV状态被写入存档');

// 5分钟逻辑压力模拟：自动跳过升级，周期释放迫击炮并检查池上限。
global.Meta.data.nextRunBuff = null;
global.Game.restart(); global.DevConsole.god = true;
for (var stress = 0; stress < 6000; stress++) {
  if (global.Game.state === global.CONFIG.GAME.STATE_LEVELUP) global.DevConsole.skipLevels();
  if (stress % 600 === 0) global.MortarStrike.activate();
  global.Game.update(0.05);
  if (stress % 120 === 0) global.Game.draw();
  if (global.Game.runtimeError) throw new Error('长局压力模拟异常: ' + global.Game.runtimeError);
  if (global.MenuOverlay.MortarFX.groups.filter(function (g) { return g.active; }).length > 3) {
    throw new Error('迫击炮爆炸组超过3组上限');
  }
}

console.log('PASS: 首帧、双指、四档升级、106张命运牌、DEV与5分钟压力模拟均正常。');

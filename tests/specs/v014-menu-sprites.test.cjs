'use strict';
// 主菜单真实渲染核对：保留背景/Logo/图标，按钮恢复为不拉伸的 Canvas 样式。
//  1) CONFIG.ASSETS 注册全部 main-menu 按钮/图标/背景/Logo key；
//  2) 主菜单不再绘制按钮切图，4 个左侧/齿轮图标仍真的 drawImage；
//  3) 成就/补给并排同 Y（tap 命中：左=2 右=3）；基地有房子图标 + 副标题；右上齿轮可点；
//  4) 5 个按钮文字统一使用原始 Canvas 按钮文字色；
//  5) 图未就绪/加载失败 → 不抛错、走矢量兜底。
const assert = require('node:assert/strict');
const { createRuntime } = require('../helpers/runtime-harness.cjs');

// H5 平台会给 img.src 加 '../' 前缀，wx 不加；统一归一化后比较。
function norm(src) { return String(src).replace(/^\.\.\//, ''); }
function drawnHas(list, rel) { return list.some(function (s) { return norm(s) === rel; }); }

const MAIN_MENU_KEYS = [
  'btn_play_normal', 'btn_play_pressed', 'btn_play_disabled',
  'btn_base_normal', 'btn_base_pressed', 'btn_base_disabled',
  'btn_achievement_normal', 'btn_achievement_pressed', 'btn_achievement_disabled',
  'btn_supply_normal', 'btn_supply_pressed', 'btn_supply_disabled',
  'btn_history_normal', 'btn_history_pressed', 'btn_history_disabled',
  'menu_background', 'menu_logo',
  'icon_menu_base', 'icon_menu_achievement', 'icon_menu_supply', 'icon_menu_history', 'icon_menu_settings'
];

for (const mode of ['h5', 'wx']) {
  const r = createRuntime(mode);
  r.finishImages();
  const g = r.game, C = g.CONFIG;

  // ---------- 1) 注册：main-menu 全部 key 都在 CONFIG.ASSETS ----------
  for (const k of MAIN_MENU_KEYS) assert(C.ASSETS[k], 'CONFIG.ASSETS 缺少 main-menu key: ' + k);

  // ---------- 2) 主菜单帧：背景/Logo/图标真 drawImage，按钮不再使用拉伸切图 ----------
  g.Game.enterMenu();
  r.drawnImages.length = 0;
  // 装一个 fillText 颜色间谍：记录每次 fillText 的文本与当时 fillStyle。
  const colors = [];
  r.ctx.fillText = function (text) { colors.push({ t: String(text), c: r.ctx.fillStyle }); };
  r.draw();
  for (const rel of ['assets/ui/main-menu/background.png', 'assets/logo/game_logo.png']) {
    assert(drawnHas(r.drawnImages, rel), '主菜单应 drawImage 切图 ' + rel + '；实际绘制: ' + r.drawnImages.map(norm).join(','));
  }
  for (const rel of [
    'assets/ui/main-menu/btn_play_normal.png',
    'assets/ui/main-menu/btn_base_normal.png',
    'assets/ui/main-menu/btn_achievement_normal.png',
    'assets/ui/main-menu/btn_supply_normal.png',
    'assets/ui/main-menu/btn_history_normal.png'
  ]) assert(!drawnHas(r.drawnImages, rel), '主菜单按钮应使用原始 Canvas 样式，不应拉伸绘制 ' + rel);
  // 左侧图标 + 右上齿轮切图都被 drawImage。
  for (const rel of [
    'assets/ui/main-menu/icon_menu_base.png',
    'assets/ui/main-menu/icon_menu_achievement.png',
    'assets/ui/main-menu/icon_menu_supply.png',
    'assets/ui/main-menu/icon_menu_settings.png'
  ]) {
    assert(drawnHas(r.drawnImages, rel), '主菜单应 drawImage 图标 ' + rel);
  }

  // ---------- 2b) 按钮文字统一恢复为原始 Canvas 按钮颜色 ----------
  function colorOf(label) {
    const hit = colors.find(function (e) { return e.t === label; });
    assert(hit, '应绘制文字 "' + label + '"；实际 labels: ' + colors.map(function (e) { return e.t; }).join('|'));
    return hit.c;
  }
  assert.equal(colorOf('开始战斗'), C.COLORS.BUTTON_TEXT);
  assert.equal(colorOf('幸存者基地'), C.COLORS.BUTTON_TEXT);
  assert.equal(colorOf('成就'), C.COLORS.BUTTON_TEXT);
  assert.equal(colorOf('加速补给'), C.COLORS.BUTTON_TEXT);
  assert.equal(colorOf('历史战绩'), C.COLORS.BUTTON_TEXT);
  // 基地副标题灰色小字存在。
  assert(colors.some(function (e) { return e.t === '角色强化·武器成长·炮台升级'; }), '基地按钮应有副标题');

  // ---------- 2c) 并排命中：成就(左)=2，加速补给(右)=3，同 Y ----------
  const M = C.SCREEN_LAYOUT.MENU;
  const top = C.UI.TOP_INSET || 0;
  const sideX = (750 - (M.SIDE_W * 2 + M.SIDE_GAP)) / 2;
  const sideCY = M.SIDE_Y + top + M.SIDE_H / 2;
  function tap(x, y) { g.Input.pendingTap.active = true; g.Input.pendingTap.x = x; g.Input.pendingTap.y = y; }
  tap(sideX + M.SIDE_W / 2, sideCY);
  assert.equal(g.UI.consumeMenuAction(), 2, '成就(左半)应命中 i=2');
  tap(sideX + M.SIDE_W + M.SIDE_GAP + M.SIDE_W / 2, sideCY);
  assert.equal(g.UI.consumeMenuAction(), 3, '加速补给(右半)应命中 i=3');
  // 开始战斗/基地/历史命中。
  tap(375, M.PLAY_Y + top + M.PLAY_H / 2);
  assert.equal(g.UI.consumeMenuAction(), 0, '开始战斗应命中 i=0');
  tap(375, M.BASE_Y + top + M.BASE_H / 2);
  assert.equal(g.UI.consumeMenuAction(), 1, '幸存者基地应命中 i=1');
  tap(375, M.HIST_BTN_Y + top + M.HIST_BTN_H / 2);
  assert.equal(g.UI.consumeMenuAction(), 4, '历史战绩应命中 i=4');

  // ---------- 2d) 右上设置齿轮命中 → consumeMenuSettings true ----------
  tap(M.GEAR_X + M.GEAR_SIZE / 2, M.GEAR_Y + top + M.GEAR_SIZE / 2);
  assert.equal(g.UI.consumeMenuSettings(), true, '右上齿轮应命中设置');
  // 齿轮未命中时不应消费触点。
  tap(10, 10);
  assert.equal(g.UI.consumeMenuSettings(), false, '空白处不应命中设置');

  // ---------- 2e) 历史页：i=4 进入 HISTORY，drawHistory 不崩，返回回 MENU ----------
  g.Game.enterMenu();
  tap(375, M.HIST_BTN_Y + top + M.HIST_BTN_H / 2);
  g.Game.update(1 / 60);
  assert.equal(g.Game.state, C.GAME.STATE_HISTORY, '点历史战绩应进入 HISTORY 状态');
  r.drawnImages.length = 0;
  r.draw();
  assert(drawnHas(r.drawnImages, 'assets/ui/main-menu/icon_menu_history.png'), '历史页应 drawHistory 图标');
  // 点返回 → 回菜单。
  tap(90, 34 + top + 31);
  g.Game.update(1 / 60);
  assert.equal(g.Game.state, C.GAME.STATE_MENU, '历史页返回应回主菜单');

  // ---------- 3) 补给商店：购买/关闭按钮也不得再绘制主菜单切图 ----------
  g.Game.restart();
  g.SupplyPoint.reset();
  g.SupplyPoint.active = true;
  g.SupplyPoint.x = g.Player.x + 10;
  g.SupplyPoint.y = g.Player.y;
  g.SupplyPoint.t = 999;
  g.SupplyPoint.entered = false;
  g.SupplyPoint.open = false;
  g.Game.update(1 / 60);
  assert.equal(g.SupplyPoint.open, true, '进入半径应自动打开商店面板');

  g.RunStats.gold = 99999;
  r.drawnImages.length = 0;
  r.draw();
  assert(!drawnHas(r.drawnImages, 'assets/ui/main-menu/btn_supply_normal.png'));
  assert(!drawnHas(r.drawnImages, 'assets/ui/main-menu/btn_history_normal.png'));

  // 金币不足：购买按钮置灰 → disabled 态切图；关闭按钮仍 normal。
  g.RunStats.gold = 0;
  r.drawnImages.length = 0;
  r.draw();
  assert(!drawnHas(r.drawnImages, 'assets/ui/main-menu/btn_supply_disabled.png'));
  assert(!drawnHas(r.drawnImages, 'assets/ui/main-menu/btn_history_normal.png'));

  // ---------- 4) 撤离按钮同样恢复 Canvas 样式 ----------
  g.Game.restart();
  g.Extraction.state = 'inactive';
  g.Extraction.playerInZone = true;
  r.drawnImages.length = 0;
  r.draw();
  assert(!drawnHas(r.drawnImages, 'assets/ui/main-menu/btn_play_normal.png'));

  g.Extraction.state = 'extractable';
  g.Extraction.playerInZone = true;
  r.drawnImages.length = 0;
  r.draw();
  assert(!drawnHas(r.drawnImages, 'assets/ui/main-menu/btn_play_normal.png'));

  // ---------- 5) 切图加载失败：主菜单整帧不崩、走矢量兜底、不再 drawImage ----------
  g.Game.enterMenu();
  r.evaluate(
    'var ks = Object.keys(CONFIG.ASSETS);' +
    'for (var i = 0; i < ks.length; i++) {' +
    '  var k = ks[i];' +
    "  if (k.indexOf('btn_') === 0 || k === 'menu_background' || k === 'menu_logo' || k.indexOf('icon_menu_') === 0) {" +
    '    Platform.imageFailed[k] = true; Platform.imageReady[k] = false;' +
    '  }' +
    '}'
  );
  r.drawnImages.length = 0;
  r.draw();
  assert(!drawnHas(r.drawnImages, 'assets/ui/main-menu/btn_play_normal.png'), '切图 failed 时不应再 drawImage 按钮，应矢量兜底');
  assert(!drawnHas(r.drawnImages, 'assets/ui/main-menu/icon_menu_settings.png'), '齿轮切图 failed 时应矢量兜底');
  assert(!drawnHas(r.drawnImages, 'assets/ui/main-menu/menu_logo.png'), 'Logo 切图 failed 时应文字标题兜底');
  assert(!drawnHas(r.drawnImages, 'assets/ui/main-menu/background.png'), '背景切图 failed 时应底色兜底');

  // ---------- 6) 选图/结算/历史界面同样整帧不崩（失败兜底态） ----------
  g.Game.enterMapSelect();
  r.draw();
  g.Game.state = C.GAME.STATE_GAMEOVER;
  r.draw();
  g.Game.state = C.GAME.STATE_HISTORY;
  r.draw();

  console.log('PASS: ' + mode + ' 主菜单 Canvas 按钮/图标/齿轮/历史页/素材兜底不黑屏');
}

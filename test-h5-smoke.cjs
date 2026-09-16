// H5 分支最小 DOM 冒烟（window === global，与浏览器语义一致）
// #55 重构后：仅覆盖真实存在的页面与武器组合绘制，不引用未实现的 W8/Shop/SignIn/Season/Activity。
var ctxStub = new Proxy({}, {
  get: function (t, k) {
    if (k in t) return t[k];
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return function () { return { addColorStop: function () {} }; };
    if (k === 'measureText') return function (s) { return { width: String(s).length * 12 }; };
    return function () {};
  },
  set: function (t, k, v) { t[k] = v; return true; }
});
var canvasEl = { width: 750, height: 1334, getContext: function () { return ctxStub; },
  style: {}, addEventListener: function () {}, getBoundingClientRect: function () { return { left: 0, top: 0, width: 750, height: 1334 }; } };
global.window = global; // 浏览器语义：window 即全局对象
global.innerWidth = 390; global.innerHeight = 844; global.devicePixelRatio = 2;
global.addEventListener = function () {};
global.document = {
  getElementById: function () { return canvasEl; },
  body: { style: {} },
  addEventListener: function () {},
  hidden: false
};
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
global.requestAnimationFrame = function () {};
require('./game.js');
var Game = global.Game, UI = global.UI, CONFIG = global.CONFIG;
if (!Game || !UI || !CONFIG) throw new Error('H5 关键全局未就绪');

var pages = [
  function () { Game.enterMenu(); },
  function () { Game.state = CONFIG.GAME.STATE_WEAPON_SELECT || 'WEAPON_SELECT'; global.WeaponSelect.draw(canvasEl.getContext()); Game.state = CONFIG.GAME.STATE_MENU; },
  function () { Game.enterBase(); },
  function () { global.CampNav.page = 'enhance'; UI.baseTab = 'character'; },
  function () { global.CampNav.page = 'enhance'; UI.baseTab = 'gadget'; },
  function () { Game.enterMenu(); Game.restart(); Game.updatePlaying(0.016); }
];
for (var i = 0; i < pages.length; i++) {
  pages[i]();
  Game.draw();
  if (Game.runtimeError) throw new Error('H5 页面绘制异常: ' + Game.runtimeError);
}
// 主武器切换全组合绘制（真实存在的三主武器）
var ws = ['pistol', 'flamer', 'crossbow'];
for (var w = 0; w < ws.length; w++) {
  global.Meta.data.selectedWeapon = ws[w];
  Game.restart();
  Game.updatePlaying(0.016);
  Game.draw();
  if (Game.runtimeError) throw new Error('H5 武器组合绘制异常: ' + Game.runtimeError);
}
console.log('PASS: H5 分支主菜单/武器选择/营地/游玩 与三武器组合绘制正常');

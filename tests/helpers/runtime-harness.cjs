'use strict';
// 无第三方库：用隔离全局空间模拟 H5 script 和微信 CommonJS 加载。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const directory = path.resolve(__dirname, '..', '..');

function createRuntime(mode, options = {}) {
  const stack = [], imageQueue = [], images = [], errors = [], labels = [], drawnImages = [];
  const events = {}, storage = new Map(), frames = [];
  let savedState = { globalAlpha: 1 };
  const ctx = new Proxy({}, {
    get(_, key) {
      if (key in savedState) return savedState[key];
      if (key === 'save') return () => stack.push({ ...savedState });
      if (key === 'restore') return () => { assert(stack.length, 'Canvas restore 没有对应 save'); savedState = stack.pop(); };
      if (key === 'measureText') return text => ({ width: String(text).length * 12 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return (...args) => {
        checkNumbers(args);
        return { addColorStop(offset, color) { assert(Number.isFinite(offset) && offset >= 0 && offset <= 1); assert.equal(typeof color, 'string'); } };
      };
      return (...args) => {
        checkNumbers(args);
        if (key === 'arc') assert(args[2] >= 0, '负数圆半径');
        if (key === 'fillText') labels.push(String(args[0]));
        if (key === 'drawImage') { assert(args[0]._decoded, '图片解码前发生 drawImage'); drawnImages.push(args[0]._src); }
      };
    },
    set(_, key, value) { if (typeof value === 'number') assert(Number.isFinite(value), 'Canvas 属性 NaN: ' + key); savedState[key] = value; return true; }
  });
  function checkNumbers(args) { for (const a of args) if (typeof a === 'number') assert(Number.isFinite(a), 'Canvas 坐标 NaN'); }
  const canvas = { width: 750, height: 1334, style: {}, getContext: () => ctx, addEventListener: (name, fn) => { events[name] = fn; }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }) };
  function makeImage() {
    const img = { width: 0, height: 0, _decoded: false };
    Object.defineProperty(img, 'src', { get() { return this._src; }, set(src) {
      this._src = src;
      const absolute = path.resolve(directory, mode === 'h5' ? 'h5' : '', src);
      assert(fs.existsSync(absolute), '资源文件不存在: ' + absolute);
      const bytes=fs.readFileSync(absolute),png=bytes.length>24&&bytes.toString('ascii',1,4)==='PNG';
      imageQueue.push(() => { img.width=png?bytes.readUInt32BE(16):128;img.height=png?bytes.readUInt32BE(20):128;img._decoded = true; if (img.onload) img.onload(); });
    } });
    images.push(img);
    return img;
  }
  const sandbox = { console: { log() {}, warn() {}, error(...args) { errors.push(args); } }, requestAnimationFrame: fn => { frames.push(fn); return frames.length; },
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
    performance: { now: () => 100 }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 3,
    addEventListener: (name, fn) => { events[name] = fn; } };
  if (mode === 'h5') {
    sandbox.window = sandbox;
    sandbox.Image = function () { return makeImage(); };
    sandbox.document = { getElementById: () => canvas, body: { style: {} }, hidden: false, addEventListener: (name, fn) => { events[name] = fn; } };
    sandbox.localStorage = { getItem: key => options.corruptSave ? '{' : storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
  } else {
    sandbox.global = sandbox;
    sandbox.wx = { createCanvas: () => canvas, createImage: makeImage,
      getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 3, platform: 'ios', safeArea: { top: 47, bottom: 810, left: 0, right: 390 }, statusBarHeight: 47 }),
      getMenuButtonBoundingClientRect: () => ({ left: 290, top: 51, right: 378, bottom: 83, width: 88, height: 32 }),
      getStorageSync: key => options.corruptSave ? '{' : storage.get(key) || '', setStorageSync: (key, value) => storage.set(key, value) };
    for (const name of ['onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel', 'onShow', 'onHide', 'onWindowResize']) sandbox.wx[name] = fn => { events[name] = fn; };
  }
  const context = vm.createContext(sandbox);
  const owners = { Game: 'core.js', Spawner: 'wave.js', Enemy: 'enemy.js', Player: 'player.js', Input: 'input.js', Bullet: 'weapon.js', Weapons: 'weapon.js', PulseGun: 'weapon.js', FlameWeapon: 'weapon.js', Crossbow: 'weapon.js', MortarStrike: 'weapon.js', LaserEmitter: 'weapon.js', ExpLevelUp: 'item.js', PowerUps: 'item.js', Meta: 'save.js', Field: 'hud.js' };
  const methods = new Map();
  function verifyOwners(file) {
    for (const [name, owner] of Object.entries(owners)) {
      const obj = sandbox[name];
      if (!obj) continue;
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value !== 'function') continue;
        const id = name + '.' + key;
        if (methods.has(id)) assert.equal(value, methods.get(id), file + ' 非法覆盖 ' + id);
        else { assert.equal(path.basename(file), owner, file + ' 跨模块定义 ' + id); methods.set(id, value); }
      }
    }
  }
  const cache = new Map();
  function loadCommonJS(relative, parent = directory) {
    const file = path.resolve(parent, relative);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const fn = vm.runInContext('(function(require,module,exports){\n' + fs.readFileSync(file, 'utf8') + '\n})', context, { filename: file });
    fn(rel => loadCommonJS(rel, path.dirname(file)), module, module.exports);
    if (path.dirname(file) === path.join(directory, 'js')) verifyOwners(file);
    return module.exports;
  }
  if (mode === 'h5') {
    const html = fs.readFileSync(path.join(directory, 'h5/index.html'), 'utf8');
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      const src = /src="([^"]+)"/.exec(match[1]);
      const file = src ? path.resolve(directory, 'h5', src[1]) : 'h5/index.html:inline';
      vm.runInContext(src ? fs.readFileSync(file, 'utf8') : match[2], context, { filename: file });
      if (src) verifyOwners(file);
    }
  } else loadCommonJS('./game.js');
  assert.equal(errors.length, 0, '启动异常: ' + errors);
  return { game: sandbox, ctx, events, images, labels, drawnImages, storage, errors,
    finishImages() { while (imageQueue.length) imageQueue.shift()(); },
    draw() { labels.length = 0; sandbox.Game.draw(); assert.equal(stack.length, 0, mode + ' 每帧 Canvas 状态没有归零'); assert.equal(errors.length, 0); },
    evaluate(code) { return vm.runInContext(code, context); } };
}
module.exports = { createRuntime, directory };

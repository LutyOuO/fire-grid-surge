'use strict';
// ============================================================
// Effects（表现增强层）
// FX 粒子 / Metrics 性能统计 / Spatial 空间网格 /
// ButtonUI 按钮热区 / Panels 暂停设置面板
// 本文件对基础对象做 monkey-patch，必须在基础模块之后加载
// ============================================================
var root = (typeof window !== 'undefined') ? window : global;
var CONFIG = root.CONFIG;
var Platform = root.Platform;
var Input = root.Input;
var Player = root.Player;
var Enemy = root.Enemy;
var Bullet = root.Bullet;
var PulseGun = root.PulseGun;
var Camera = root.Camera;
var UI = root.UI;
var Game = root.Game;
var Meta = root.Meta;
var Settings = root.Settings;
var Ads = root.Ads;
var AudioFX = root.AudioFX;
var ExpLevelUp = root.ExpLevelUp;
var RunStats = root.RunStats;

// ---------- FX（粒子 + 震屏 + 闪光） ----------
var FX = {
  pool: [], shake: 0, flash: 0, legendaryFlash: 0, notice: 0, wave: 0, rings: [],
  init: function () {
    for (var i = 0; i < CONFIG.POLISH.PARTICLES; i++) {
      this.pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, color: '' });
    }
  },
  burst: function (x, y, color) {
    var remaining = CONFIG.POLISH.KILL_PARTICLES;
    for (var i = 0; i < this.pool.length && remaining > 0; i++) {
      var p = this.pool[i];
      if (p.active) continue;
      var a = Math.random() * Math.PI * 2;
      p.active = true; p.x = x; p.y = y; p.life = CONFIG.POLISH.PARTICLE_LIFE;
      p.vx = Math.cos(a) * CONFIG.POLISH.PARTICLE_SPEED;
      p.vy = Math.sin(a) * CONFIG.POLISH.PARTICLE_SPEED;
      p.color = color || '';
      remaining -= 1;
    }
  },
  legendaryBurst: function (x, y) {
    var made = 0;
    for (var i = 0; i < this.pool.length && made < 12; i++) {
      var p = this.pool[i];
      if (p.active) continue;
      var a = Math.PI * 2 * made / 12;
      p.active = true; p.x = x; p.y = y; p.life = CONFIG.POLISH.PARTICLE_LIFE;
      p.vx = Math.cos(a) * CONFIG.POLISH.PARTICLE_SPEED * 1.4;
      p.vy = Math.sin(a) * CONFIG.POLISH.PARTICLE_SPEED * 1.4;
      p.color = 'hsl(' + (made * 30) + ', 95%, 62%)'; made += 1;
    }
  },
  // 冲刺地面扬尘：浅灰、向上飘
  spawnDust: function (x, y) {
    var made = 0;
    for (var i = 0; i < this.pool.length && made < 4; i++) {
      var p = this.pool[i];
      if (p.active) continue;
      p.active = true;
      p.x = x + (Math.random() * 2 - 1) * 10;
      p.y = y + (Math.random() * 2 - 1) * 6;
      p.vx = (Math.random() * 2 - 1) * 30;
      p.vy = -Math.random() * 50 - 20;
      p.life = 0.4;
      p.color = CONFIG.COLORS.DUST;
      made += 1;
    }
  },
  // 冲刺结束冲击波：扩散圆环
  spawnRing: function (x, y) {
    this.rings.push({ x: x, y: y, life: 0.25, maxLife: 0.25 });
  },
  update: function (dt) {
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.legendaryFlash = Math.max(0, this.legendaryFlash - dt);
    this.notice = Math.max(0, this.notice - dt);
    for (var i = 0; i < this.pool.length; i++) {
      var p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) p.active = false;
    }
    for (var j = this.rings.length - 1; j >= 0; j--) {
      this.rings[j].life -= dt;
      if (this.rings[j].life <= 0) this.rings.splice(j, 1);
    }
  },
  draw: function (ctx) {
    ctx.save();
    for (var i = 0; i < this.pool.length; i++) {
      var p = this.pool[i];
      if (!p.active) continue;
      ctx.fillStyle = p.color || CONFIG.COLORS.PARTICLE;
      ctx.globalAlpha = p.life / CONFIG.POLISH.PARTICLE_LIFE;
      ctx.fillRect(p.x - Camera.x, p.y - Camera.y, CONFIG.POLISH.PARTICLE_SIZE, CONFIG.POLISH.PARTICLE_SIZE);
    }
    // 冲击波环
    for (var j = 0; j < this.rings.length; j++) {
      var r = this.rings[j];
      var t = 1 - r.life / r.maxLife; // 0→1
      var radius = 20 + t * 40;
      ctx.globalAlpha = (1 - t) * 0.6;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x - Camera.x, r.y - Camera.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },
  reset: function () {
    for (var i = 0; i < this.pool.length; i++) this.pool[i].active = false;
    this.rings.length = 0;
    this.shake = 0; this.flash = 0; this.legendaryFlash = 0; this.notice = 0; this.wave = 0;
  }
};

// ---------- Metrics（FPS 统计） ----------
var Metrics = {
  seconds: 0, frames: 0, fps: 0,
  sample: function (dt) {
    if (dt <= 0 || dt > 1) return;
    this.seconds += dt; this.frames += 1;
    if (this.seconds >= CONFIG.POLISH.FPS_SAMPLE) {
      this.fps = Math.round(this.frames / this.seconds);
      this.seconds = 0; this.frames = 0;
    }
  },
  count: function (pool) {
    var n = 0;
    for (var i = 0; i < pool.length; i++) if (pool[i].active) n += 1;
    return n;
  },
  draw: function (ctx) {
    if (!Settings.debug) return;
    var debugY = CONFIG.VIEW.HEIGHT - 79;
    ctx.save();
    ctx.fillStyle = CONFIG.COLORS.DEBUG_BACKGROUND;
    ctx.fillRect(20, debugY, 710, 54);
    ctx.fillStyle = CONFIG.COLORS.TEXT;
    ctx.font = '20px Arial, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      CONFIG.TEXT.DEBUG_LINE(this.fps, Enemy.activeCount, Bullet.activeCount,
        this.count(FX.pool), this.count(root.DamageText.pool)),
      32, debugY + 27);
    ctx.restore();
  }
};

// ---------- Spatial（空间网格，加速子弹碰撞） ----------
var Spatial = {
  cols: Math.ceil(CONFIG.WORLD.WIDTH / CONFIG.POLISH.GRID_CELL) + 2,
  rows: Math.ceil(CONFIG.WORLD.HEIGHT / CONFIG.POLISH.GRID_CELL) + 2,
  heads: null,
  next: new Int32Array(CONFIG.ENEMY.POOL_SIZE),
  rebuild: function () {
    this.heads.fill(-1);
    for (var i = 0; i < Enemy.pool.length; i++) {
      var e = Enemy.pool[i];
      if (!e.active) continue;
      var x = this.cell(e.x, this.cols), y = this.cell(e.y, this.rows);
      var cell = y * this.cols + x;
      this.next[i] = this.heads[cell];
      this.heads[cell] = i;
    }
  },
  cell: function (v, limit) {
    return Math.max(0, Math.min(limit - 1, Math.floor(v / CONFIG.POLISH.GRID_CELL) + 1));
  }
};
Spatial.heads = new Int32Array(Spatial.cols * Spatial.rows);

// 空间网格补丁：Enemy.update 后重建网格
var oldEnemyUpdate = Enemy.update;
Enemy.update = function (dt) {
  oldEnemyUpdate.call(this, dt);
  Spatial.rebuild();
};

// 子弹碰撞改用空间网格
Bullet.checkEnemyHits = function (bullet) {
  var maxRadius = 0;
  for (var i = 0; i < CONFIG.ENEMY.TYPES.length; i++) {
    maxRadius = Math.max(maxRadius, CONFIG.ENEMY.TYPES[i].RADIUS);
  }
  var r = maxRadius + CONFIG.WEAPONS.PULSE.RADIUS;
  var x0 = Spatial.cell(bullet.x - r, Spatial.cols);
  var x1 = Spatial.cell(bullet.x + r, Spatial.cols);
  var y0 = Spatial.cell(bullet.y - r, Spatial.rows);
  var y1 = Spatial.cell(bullet.y + r, Spatial.rows);
  for (var y = y0; y <= y1; y++) {
    for (var x = x0; x <= x1; x++) {
      for (var i = Spatial.heads[y * Spatial.cols + x]; i !== -1; i = Spatial.next[i]) {
        var e = Enemy.pool[i];
        if (!e.active || this.hasAlreadyHit(bullet, e.spawnId)) continue;
        var dx = bullet.x - e.x, dy = bullet.y - e.y;
        var hit = CONFIG.WEAPONS.PULSE.RADIUS + e.radius;
        if (dx * dx + dy * dy > hit * hit) continue;
        var normalEnemy = e.typeIndex !== CONFIG.ENEMY.TYPE_ELITE &&
          e.typeIndex !== CONFIG.ENEMY.TYPE_BOSS && e.typeIndex !== CONFIG.ENEMY.TYPE_BOSS_RANGED;
        if (normalEnemy && Player.executeChance > 0 && Math.random() < Player.executeChance) {
          root.DamageText.spawn(e.x, e.y, e.hp, true); Enemy.applyDamage(e, e.hp + 1);
        } else {
          root.Combat.hitEnemy(e, bullet.damage, e.x, e.y);
        }
        bullet.hitSpawnIds[bullet.hitCount++] = e.spawnId;
        if (bullet.pierceRemaining > 0) {
          bullet.pierceRemaining -= 1;
        } else {
          this.deactivate(bullet);
          return;
        }
      }
    }
  }
};

// 受击闪白 + 震屏 + 音效
var oldApplyDamage = Enemy.applyDamage;
Enemy.applyDamage = function (e, damage) {
  if (!e.active) return;
  e.hitFlash = CONFIG.POLISH.HIT_FLASH;
  if (Settings.shake) FX.shake = CONFIG.POLISH.SHAKE_TIME;
  AudioFX.play('hit');
  oldApplyDamage.call(this, e, damage);
};

// 击杀粒子
var oldKill = Enemy.kill;
Enemy.kill = function (e) {
  if (e.active) FX.burst(e.x, e.y);
  oldKill.call(this, e);
};

// 射击音效
var oldFire = PulseGun.fireAt;
PulseGun.fireAt = function (target) {
  AudioFX.play('shot');
  oldFire.call(this, target);
};

// ---------- ButtonUI（按钮热区 + 按下/悬停高亮） ----------
var ButtonUI = {
  pool: [], count: 0,
  hover: { x: -1, y: -1 },
  pressed: { active: false, x: 0, y: 0, w: 0, h: 0, id: -1, state: '' },
  pressedTouches: new Map(),
  lastClick: -Infinity,
  init: function () {
    for (var i = 0; i < 40; i++) {
      this.pool.push({ x: 0, y: 0, w: 0, h: 0 });
    }
  },
  register: function (ctx, x, y, w, h, enabled) {
    if (!enabled || this.count >= this.pool.length || Ads.active) return;
    var b = this.pool[this.count++];
    b.x = x; b.y = y; b.w = w; b.h = h;
    var hover = UI.isPointInRect(this.hover, x, y, w, h);
    var press = false;
    this.pressedTouches.forEach(function (p) {
      if (p.x === x && p.y === y && p.w === w && p.h === h) press = true;
    });
    if (!hover && !press) return;
    ctx.save();
    UI.roundedRectPath(ctx, x, y, w, h, 18);
    ctx.fillStyle = press ? CONFIG.COLORS.BUTTON_PRESS : CONFIG.COLORS.BUTTON_HOVER;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = CONFIG.COLORS.BUTTON_BORDER;
    ctx.stroke();
    ctx.restore();
  }
};

// 补丁：按钮绘制时注册热区
for (var nameIdx = 0; nameIdx < ['drawActionButton', 'drawTwoLineButton'].length; nameIdx++) {
  (function (name) {
    var original = UI[name];
    UI[name] = function (ctx, x, y, w, h, a, b, c) {
      original.call(this, ctx, x, y, w, h, a, b, c);
      ButtonUI.register(ctx, x, y, w, h, name === 'drawActionButton' ? b : c);
    };
  })(['drawActionButton', 'drawTwoLineButton'][nameIdx]);
}

var oldCard = UI.drawUpgradeCard;
UI.drawUpgradeCard = function (ctx, i, offer) {
  oldCard.call(this, ctx, i, offer);
  ButtonUI.register(ctx, CONFIG.UI.CARD_X,
    CONFIG.UI.CARD_START_Y + i * (CONFIG.UI.CARD_HEIGHT + CONFIG.UI.CARD_GAP),
    CONFIG.UI.CARD_WIDTH, CONFIG.UI.CARD_HEIGHT, true);
};

var oldRestartButton = UI.drawRestartButton;
UI.drawRestartButton = function (ctx) {
  oldRestartButton.call(this, ctx);
  ButtonUI.register(ctx, CONFIG.UI.RESTART_X, CONFIG.UI.RESTART_Y,
    CONFIG.UI.RESTART_WIDTH, CONFIG.UI.RESTART_HEIGHT, true);
};

var oldPowerButtons = UI.drawPowerUpButtons;
UI.drawPowerUpButtons = function (ctx) {
  oldPowerButtons.call(this, ctx);
  for (var i = 0; i < PowerUps.inventory.length; i++) {
    ButtonUI.register(ctx, CONFIG.UI.POWERUP_BUTTON_X, this.getPowerUpButtonY(i),
      CONFIG.UI.POWERUP_BUTTON_WIDTH, CONFIG.UI.POWERUP_BUTTON_HEIGHT,
      PowerUps.inventory[i] > 0);
  }
};

// 补丁：Input 触摸事件支持按钮热区
Input.activeTouches = new Map();
Input.onTouchStart = function (x, y, touchId) {
  AudioFX.unlock();
  if (Ads.active) return;
  this.pointerPoint.x = x;
  this.pointerPoint.y = y;

  var touch = { id: touchId, startX: x, startY: y, currentX: x, currentY: y,
    type: null, startTime: Date.now(), state: Game.state };

  // 冲刺是右下角独立按钮：按下即生效，方向在此刻锁定。
  var ddx = x - CONFIG.UI.DASH_BUTTON_X;
  var ddy = y - UI.getDashButtonY();
  if (Game.state === CONFIG.GAME.STATE_PLAYING && ddx * ddx + ddy * ddy <=
      CONFIG.UI.DASH_BUTTON_RADIUS * CONFIG.UI.DASH_BUTTON_RADIUS) {
    touch.type = 'button'; touch.action = 'dash';
    this.activeTouches.set(touchId, touch);
    ButtonUI.pressedTouches.set(touchId, { x: CONFIG.UI.DASH_BUTTON_X - CONFIG.UI.DASH_BUTTON_RADIUS,
      y: UI.getDashButtonY() - CONFIG.UI.DASH_BUTTON_RADIUS,
      w: CONFIG.UI.DASH_BUTTON_RADIUS * 2, h: CONFIG.UI.DASH_BUTTON_RADIUS * 2 });
    if (Player.canDash()) Player.startDash();
    return;
  }

  // 分类在 touchstart 后锁定；只有第一个左下触点成为摇杆。
  if (this.canStartJoystick(this.pointerPoint)) {
    touch.type = 'joystick';
    this.activeTouches.set(touchId, touch);
    this.startJoystick(touchId, x, y);
    return;
  }

  // 检查按钮热区（从上层到下层）
  for (var i = ButtonUI.count - 1; i >= 0; i--) {
    var b = ButtonUI.pool[i];
    if (!UI.isPointInRect(this.pointerPoint, b.x, b.y, b.w, b.h)) continue;
    touch.type = 'button'; touch.button = { x: b.x, y: b.y, w: b.w, h: b.h };
    this.activeTouches.set(touchId, touch);
    ButtonUI.pressedTouches.set(touchId, touch.button);
    return;
  }

  this.activeTouches.set(touchId, touch);
};

Input.onTouchMove = function (x, y, touchId) {
  ButtonUI.hover.x = x;
  ButtonUI.hover.y = y;
  var touch = this.activeTouches.get(touchId);
  if (!touch) return;
  touch.currentX = x; touch.currentY = y;
  if (touch.type === 'joystick' && this.joystick.pointerId === touchId) this.updateJoystick(x, y);
};

Input.onTouchEnd = function (x, y, touchId) {
  var touch = this.activeTouches.get(touchId);
  if (!touch) return;
  if (touch.type === 'joystick' && this.joystick.pointerId === touchId) this.stopJoystick();
  if (touch.type === 'button') {
    ButtonUI.pressedTouches.delete(touchId);
    if (touch.action !== 'dash' && touch.state === Game.state && touch.button &&
        UI.isPointInRect({ x: x, y: y }, touch.button.x, touch.button.y, touch.button.w, touch.button.h)) {
      ButtonUI.lastClick = (typeof performance !== 'undefined') ? performance.now() : Date.now();
      AudioFX.play('button');
      this.pendingTap.active = true;
      this.pendingTap.x = x;
      this.pendingTap.y = y;
    }
  } else if (touch.type === null) {
    this.pendingTap.active = true; this.pendingTap.x = x; this.pendingTap.y = y;
  }
  this.activeTouches.delete(touchId);
};

// 系统取消触摸只做清理，绝不触发按钮奖励或动作。
Input.onTouchCancel = function (x, y, touchId) {
  var touch = this.activeTouches.get(touchId);
  if (!touch) return;
  if (touch.type === 'joystick' && this.joystick.pointerId === touchId) this.stopJoystick();
  ButtonUI.pressedTouches.delete(touchId);
  this.activeTouches.delete(touchId);
};

// 补丁：摇杆启动时检查按钮热区
var oldCanStartJoystick = Input.canStartJoystick;
Input.canStartJoystick = function (point) {
  for (var i = 0; i < ButtonUI.count; i++) {
    var b = ButtonUI.pool[i];
    if (UI.isPointInRect(point, b.x, b.y, b.w, b.h)) return false;
  }
  return oldCanStartJoystick.call(this, point);
};

// 补丁：Input.reset 时清理按钮状态
var oldInputReset = Input.reset;
Input.reset = function () {
  oldInputReset.call(this);
  ButtonUI.pressed.active = false;
  ButtonUI.pressedTouches.clear();
  this.activeTouches.clear();
  ButtonUI.hover.x = -1;
  ButtonUI.hover.y = -1;
};

// ---------- Panels（暂停 / 设置 / 操作说明） ----------
var Panels = {
  parent: CONFIG.GAME.STATE_MENU,
  previous: CONFIG.GAME.STATE_PLAYING,
  open: function (state) {
    if (Ads.active) return;
    this.parent = Game.state;
    Game.state = state;
    Input.reset();
    Input.setMovementEnabled(false);
    ButtonUI.pressed.active = false;
  },
  pause: function () {
    if (Ads.active) return;
    if (Game.state !== CONFIG.GAME.STATE_PLAYING && Game.state !== CONFIG.GAME.STATE_LEVELUP) return;
    this.previous = Game.state;
    this.open('PAUSED');
  },
  resume: function () {
    Game.state = this.previous;
    Game.lastTimestamp = 0;
    Input.reset();
    Input.setMovementEnabled(Game.state === CONFIG.GAME.STATE_PLAYING);
  },
  button: function (ctx, row, label) {
    var c = CONFIG.POLISH;
    UI.drawActionButton(ctx, c.PANEL_X, c.PANEL_TOP + row * c.PANEL_STEP,
      c.PANEL_W, c.PANEL_H, label, true, 27);
  },
  draw: function (ctx) {
    ctx.fillStyle = CONFIG.COLORS.MENU_BACKGROUND;
    ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
    var state = Game.state;
    var text = CONFIG.TEXT;
    var title = state === 'PAUSED' ? text.PAUSE_TITLE :
      state === 'SETTINGS' ? text.SETTINGS : text.HELP;
    UI.drawCenteredText(ctx, title, 180 + (CONFIG.UI.TOP_INSET || 0), 54, true, CONFIG.COLORS.COIN);
    if (state === 'PAUSED') {
      this.button(ctx, 0, text.RESUME);
      this.button(ctx, 1, text.SETTINGS);
      this.button(ctx, 2, text.HELP);
      this.button(ctx, 3, text.ABANDON);
      this.drawSummary(ctx);
    } else if (state === 'SETTINGS') {
      var rows = [
        { key: 'sound', label: text.SOUND },
        { key: 'shake', label: text.SHAKE },
        { key: 'debug', label: text.DEBUG },
        { key: 'alwaysShowJoystick', label: text.JOYSTICK_ALWAYS }
      ];
      for (var i = 0; i < rows.length; i++) {
        var rk = rows[i].key;
        this.button(ctx, i, rows[i].label + '：' + (Settings[rk] ? text.ON : text.OFF));
      }
      this.button(ctx, rows.length, text.BACK);
    } else {
      var helpTop = CONFIG.UI.TOP_INSET || 0;
      for (var i = 0; i < text.HELP_LINES.length; i++) {
        UI.drawCenteredText(ctx, text.HELP_LINES[i], 320 + helpTop + i * 70, 25, false, CONFIG.COLORS.TEXT);
      }
      this.button(ctx, 4, text.BACK);
    }
  },
  drawSummary: function (ctx) {
    var c = CONFIG.POLISH;
    UI.drawCenteredText(ctx, CONFIG.TEXT.SUMMARY, c.SUMMARY_Y, 28, true, CONFIG.COLORS.COIN);
    var n = 0;
    for (var i = 0; i < CONFIG.UPGRADES.DEFINITIONS.length; i++) {
      var d = CONFIG.UPGRADES.DEFINITIONS[i];
      var lv = ExpLevelUp.levels[d.ID];
      if (!lv) continue;
      n += 1;
      UI.drawCenteredText(ctx, CONFIG.TEXT.UPGRADES[d.TEXT_KEY].NAME + ' × ' + lv,
        c.SUMMARY_Y + n * c.SUMMARY_STEP, 23, false, CONFIG.COLORS.TEXT);
    }
    if (!n) {
      UI.drawCenteredText(ctx, CONFIG.TEXT.EMPTY_SUMMARY,
        c.SUMMARY_Y + c.SUMMARY_STEP, 23, false, CONFIG.COLORS.HINT_TEXT);
    }
  },
  update: function () {
    if (!Input.consumeTap(UI.tapPoint)) return;
    var c = CONFIG.POLISH;
    var p = UI.tapPoint;
    if (p.x < c.PANEL_X || p.x > c.PANEL_X + c.PANEL_W) return;
    var row = Math.floor((p.y - c.PANEL_TOP) / c.PANEL_STEP);
    if (row < 0 || p.y > c.PANEL_TOP + row * c.PANEL_STEP + c.PANEL_H) return;
    if (Game.state === 'PAUSED') {
      if (row === 0) this.resume();
      if (row === 1) this.open('SETTINGS');
      if (row === 2) this.open('HELP');
      if (row === 3) {
        Game.exitType = 'quit';
        Game.state = CONFIG.GAME.STATE_GAMEOVER;
        Game.commitSettlement(false);
      }
    } else if (Game.state === 'SETTINGS') {
      var settingKeys = ['sound', 'shake', 'debug', 'alwaysShowJoystick'];
      if (row < settingKeys.length) Settings.toggle(settingKeys[row]);
      if (row === settingKeys.length) Game.state = this.parent;
    } else if (Game.state === 'HELP' && row === 4) {
      Game.state = this.parent;
    }
    Input.clearTap();
  }
};

// 键盘 Esc 暂停（H5/开发者工具）
Platform.onKeyDown(function (event) {
  AudioFX.unlock();
  if (event.code === 'Escape' && !event.repeat && !Ads.active) {
    if (event.preventDefault) event.preventDefault();
    if (Game.state === 'PAUSED') Panels.resume();
    else Panels.pause();
  }
});

// ---------- Game 补丁：升级闪光、重启重置、更新/绘制增强 ----------
var oldEnterLevel = Game.enterLevelUp;
Game.enterLevelUp = function () {
  FX.flash = CONFIG.POLISH.LEVEL_FLASH;
  AudioFX.play('level');
  oldEnterLevel.call(this);
};

var oldEffectsGameRestart = Game.restart;
Game.restart = function () {
  FX.reset();
  oldEffectsGameRestart.call(this);
};

var oldGameUpdate = Game.update;
Game.update = function (dt) {
  if (Ads.active) { Input.clearTap(); return; }
  FX.update(dt);

  // 暂停/设置/帮助面板
  if (Game.state === 'PAUSED' || Game.state === 'SETTINGS' || Game.state === 'HELP') {
    Panels.update();
    return;
  }

  // 暂停按钮（战斗中右上）
  if (Input.pendingTap.active) {
    var p = Input.pendingTap;
    var c = CONFIG.POLISH;
    if (Game.state === CONFIG.GAME.STATE_PLAYING &&
        UI.isPointInRect(p, c.TOOL_X, c.TOOL_Y, c.TOOL_W, c.TOOL_H)) {
      Panels.pause();
      Input.clearTap();
      return;
    }
    // 设置按钮（主菜单）
    if (Game.state === CONFIG.GAME.STATE_MENU && !Meta.offlinePopupActive &&
        UI.isPointInRect(p, CONFIG.UI.MENU_BUTTON_X, c.MENU_TOOL_Y,
          CONFIG.UI.MENU_BUTTON_WIDTH, CONFIG.UI.MENU_BUTTON_HEIGHT)) {
      Panels.open('SETTINGS');
      Input.clearTap();
      return;
    }
  }

  oldGameUpdate.call(this, dt);

  // 波次提示
  if (Spawner.waveIndex > FX.wave) {
    FX.wave = Spawner.waveIndex;
    FX.notice = CONFIG.POLISH.WAVE_NOTICE_TIME;
  }
};

// 使用模块唯一名称，避免 H5 全局 var 与 field.js 的补丁变量互相覆盖。
var oldEffectsGameDraw = Game.draw;
Game.draw = function () {
  ButtonUI.count = 0;
  var ctx = CanvasView.ctx;
  var c = CONFIG.POLISH;

  if (Game.state === 'PAUSED' || Game.state === 'SETTINGS' || Game.state === 'HELP') {
    Platform.beginFrame();
    Panels.draw(ctx);
    // 暂停页显示 Boss 血条
    if ((Game.state === 'PAUSED' ||
        ((Game.state === 'SETTINGS' || Game.state === 'HELP') && Panels.parent === 'PAUSED')) &&
        root.Field) {
      UI.drawBossBar(ctx, CONFIG.FIELD.BOSS_PANEL_Y);
    }
    Platform.endFrame();
    return;
  }

  oldEffectsGameDraw.call(this);

  // 战斗中暂停按钮
  if (!Ads.active && Game.state === CONFIG.GAME.STATE_PLAYING) {
    UI.drawActionButton(ctx, c.TOOL_X, c.TOOL_Y, c.TOOL_W, c.TOOL_H,
      CONFIG.TEXT.PAUSE, true, 25);
  }
  // 主菜单设置按钮
  if (Game.state === CONFIG.GAME.STATE_MENU && !Meta.offlinePopupActive && !Ads.active) {
    UI.drawActionButton(ctx, CONFIG.UI.MENU_BUTTON_X, c.MENU_TOOL_Y,
      CONFIG.UI.MENU_BUTTON_WIDTH, CONFIG.UI.MENU_BUTTON_HEIGHT,
      CONFIG.TEXT.SETTINGS, true, 30);
  }

  // 升级闪光
  if (FX.flash > 0 && Game.state === CONFIG.GAME.STATE_LEVELUP && !Ads.active) {
    ctx.save();
    ctx.globalAlpha = FX.flash / c.LEVEL_FLASH * 0.25;
    ctx.fillStyle = CONFIG.COLORS.FX_FLASH;
    ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
    ctx.restore();
  }

  // 波次提示
  if (FX.notice > 0 && Game.state === CONFIG.GAME.STATE_PLAYING) {
    UI.drawCenteredText(ctx, CONFIG.TEXT.WAVE_NOTICE(FX.wave), 310 + (CONFIG.UI.TOP_INSET || 0), 30, true, CONFIG.COLORS.COIN);
  }

  // 调试信息 + 存储警告
  if (!Ads.active) {
    Metrics.draw(ctx);
    if (Settings.storageFailed) {
      UI.drawCenteredText(ctx, CONFIG.TEXT.SAVE_WARNING, CONFIG.VIEW.HEIGHT - 104, 18, false, CONFIG.COLORS.COIN);
    }
  }
};

// 地面震屏补丁（FX.shake 击杀震屏 + Camera.shakeX/Y 受击震屏）
var oldGround = UI.drawGround;
UI.drawGround = function (ctx) {
  ctx.save();
  var ox = 0, oy = 0;
  if (Settings.shake) {
    if (FX.shake > 0) {
      ox += (Math.random() * 2 - 1) * CONFIG.POLISH.SHAKE_SIZE;
      oy += (Math.random() * 2 - 1) * CONFIG.POLISH.SHAKE_SIZE;
    }
    if (Camera.shakeTimer > 0) {
      ox += Camera.shakeX;
      oy += Camera.shakeY;
    }
  }
  ctx.translate(ox, oy);
  oldGround.call(this, ctx);
};

// HUD 前绘制粒子（在地面之后，HUD 之前）
var oldHud = UI.drawHud;
UI.drawHud = function (ctx) {
  FX.draw(ctx);
  ctx.restore(); // 对应 drawGround 的 save
  oldHud.call(this, ctx);
};

root.FX = FX;
root.Metrics = Metrics;
root.Spatial = Spatial;
root.ButtonUI = ButtonUI;
root.Panels = Panels;

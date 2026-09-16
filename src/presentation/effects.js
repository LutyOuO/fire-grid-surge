(function () {
'use strict';
var root = typeof window !== 'undefined' ? window : global;
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
var FX = {
    pool: [],
    shake: 0,
    flash: 0,
    legendaryFlash: 0,
    notice: 0,
    wave: 0,
    rings: [],
    init: function () {
      for (var i = 0; i < CONFIG.POLISH.PARTICLES; i++) {
        this.pool.push({
          active: false,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          life: 0,
          color: ''
        });
      }
    },
    burst: function (x, y, color) {
      var remaining = CONFIG.POLISH.KILL_PARTICLES;
      for (var i = 0; i < this.pool.length && remaining > 0; i++) {
        var p = this.pool[i];
        if (p.active) continue;
        var a = Math.random() * Math.PI * 2;
        p.active = true;
        p.x = x;
        p.y = y;
        p.life = CONFIG.POLISH.PARTICLE_LIFE;
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
        p.active = true;
        p.x = x;
        p.y = y;
        p.life = CONFIG.POLISH.PARTICLE_LIFE;
        p.vx = Math.cos(a) * CONFIG.POLISH.PARTICLE_SPEED * 1.4;
        p.vy = Math.sin(a) * CONFIG.POLISH.PARTICLE_SPEED * 1.4;
        p.color = 'hsl(' + made * 30 + ', 95%, 62%)';
        made += 1;
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
      this.rings.push({
        x: x,
        y: y,
        life: 0.25,
        maxLife: 0.25
      });
    },
    update: function (dt) {
      this.shake = Math.max(0, this.shake - dt);
      this.flash = Math.max(0, this.flash - dt);
      this.legendaryFlash = Math.max(0, this.legendaryFlash - dt);
      this.notice = Math.max(0, this.notice - dt);
      for (var i = 0; i < this.pool.length; i++) {
        var p = this.pool[i];
        if (!p.active) continue;
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
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
      this.shake = 0;
      this.flash = 0;
      this.legendaryFlash = 0;
      this.notice = 0;
      this.wave = 0;
    }
  };
var Metrics = {
    seconds: 0,
    frames: 0,
    fps: 0,
    sample: function (dt) {
      if (dt <= 0 || dt > 1) return;
      this.seconds += dt;
      this.frames += 1;
      if (this.seconds >= CONFIG.POLISH.FPS_SAMPLE) {
        this.fps = Math.round(this.frames / this.seconds);
        this.seconds = 0;
        this.frames = 0;
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
      ctx.fillText(CONFIG.TEXT.DEBUG_LINE(this.fps, Enemy.activeCount, Bullet.activeCount, this.count(FX.pool), this.count(root.DamageText.pool)), 32, debugY + 27);
      ctx.restore();
    }
  };
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
        var x = this.cell(e.x, this.cols),
          y = this.cell(e.y, this.rows);
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
var ButtonUI = {
    pool: [],
    count: 0,
    hover: {
      x: -1,
      y: -1
    },
    pressed: {
      active: false,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      id: -1,
      state: ''
    },
    pressedTouches: new Map(),
    lastClick: -Infinity,
    init: function () {
      for (var i = 0; i < 40; i++) {
        this.pool.push({
          x: 0,
          y: 0,
          w: 0,
          h: 0
        });
      }
    },
    register: function (ctx, x, y, w, h, enabled) {
      if (!enabled || this.count >= this.pool.length || Ads.active) return;
      var b = this.pool[this.count++];
      b.x = x;
      b.y = y;
      b.w = w;
      b.h = h;
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
      UI.drawActionButton(ctx, c.PANEL_X, c.PANEL_TOP + row * c.PANEL_STEP, c.PANEL_W, c.PANEL_H, label, true, 27);
    },
    draw: function (ctx) {
      ctx.fillStyle = CONFIG.COLORS.MENU_BACKGROUND;
      ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
      var state = Game.state;
      var text = CONFIG.TEXT;
      var title = state === 'PAUSED' ? text.PAUSE_TITLE : state === 'SETTINGS' ? text.SETTINGS : text.HELP;
      UI.drawCenteredText(ctx, title, 180 + (CONFIG.UI.TOP_INSET || 0), 54, true, CONFIG.COLORS.COIN);
      if (state === 'PAUSED') {
        this.button(ctx, 0, text.RESUME);
        this.button(ctx, 1, text.SETTINGS);
        this.button(ctx, 2, text.HELP);
        this.button(ctx, 3, text.ABANDON);
        this.drawSummary(ctx);
      } else if (state === 'SETTINGS') {
        var rows = [{
          key: 'sound',
          label: text.SOUND
        }, {
          key: 'shake',
          label: text.SHAKE
        }, {
          key: 'debug',
          label: text.DEBUG
        }, {
          key: 'alwaysShowJoystick',
          label: text.JOYSTICK_ALWAYS
        }];
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
        UI.drawCenteredText(ctx, CONFIG.TEXT.UPGRADES[d.TEXT_KEY].NAME + ' × ' + lv, c.SUMMARY_Y + n * c.SUMMARY_STEP, 23, false, CONFIG.COLORS.TEXT);
      }
      if (!n) {
        UI.drawCenteredText(ctx, CONFIG.TEXT.EMPTY_SUMMARY, c.SUMMARY_Y + c.SUMMARY_STEP, 23, false, CONFIG.COLORS.HINT_TEXT);
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
Platform.onKeyDown(function (event) {
    AudioFX.unlock();
    if (event.code === 'Escape' && !event.repeat && !Ads.active) {
      if (event.preventDefault) event.preventDefault();
      if (Game.state === 'PAUSED') Panels.resume();else Panels.pause();
    }
  });
root.FX = FX;
root.Metrics = Metrics;
root.Spatial = Spatial;
root.ButtonUI = ButtonUI;
root.Panels = Panels;
UI.icon = function (key) {
    var platform = root.Platform;
    var im = platform && platform.images && platform.images[key];
    if (platform && (platform.imageLoading[key] || platform.imageFailed[key])) return null;
    // 微信 wx.createImage 的 width/naturalWidth 行为与浏览器 Image 不完全一致，
    // 以 onload 写入的明确就绪状态为主，尺寸只作为旧环境兼容兜底。
    if (im && platform.imageReady && platform.imageReady[key] === true) return im;
    if (im && (im.width && im.width > 0 || im.naturalWidth && im.naturalWidth > 0)) return im;
    return null;
  };
var MortarExplosionFX = {
    pool: [],
    init: function () {
      this.pool.length = 0;
      for (var i = 0; i < CONFIG.TURRET_VISUAL.EXPLOSION_POOL; i++) {
        var e = {
          active: false,
          x: 0,
          y: 0,
          age: 0,
          life: CONFIG.TURRET_VISUAL.EXPLOSION_LIFE,
          seed: i * 17.31,
          fire: [],
          smoke: []
        };
        for (var f = 0; f < CONFIG.TURRET_VISUAL.FIRE_PARTICLES; f++) e.fire.push({
          a: 0,
          speed: 0,
          size: 0
        });
        for (var s = 0; s < CONFIG.TURRET_VISUAL.SMOKE_PARTICLES; s++) e.smoke.push({
          a: 0,
          dist: 0,
          size: 0,
          rise: 0
        });
        this.pool.push(e);
      }
    },
    reset: function () {
      for (var i = 0; i < this.pool.length; i++) this.pool[i].active = false;
    },
    spawn: function (x, y) {
      var e = null;
      for (var i = 0; i < this.pool.length; i++) if (!this.pool[i].active) {
        e = this.pool[i];
        break;
      }
      if (!e) e = this.pool[0];
      e.active = true;
      e.x = x;
      e.y = y;
      e.age = 0;
      e.life = CONFIG.TURRET_VISUAL.EXPLOSION_LIFE;
      e.seed = (e.seed + 37.17) % 997;
      for (var f = 0; f < e.fire.length; f++) {
        var p = e.fire[f];
        p.a = f / e.fire.length * Math.PI * 2 + e.seed * .07;
        p.speed = 90 + f % 3 * 35;
        p.size = 10 + f % 2 * 5;
      }
      for (var s = 0; s < e.smoke.length; s++) {
        var q = e.smoke[s];
        q.a = s / e.smoke.length * Math.PI * 2 + e.seed * .03;
        q.dist = 12 + s % 3 * 15;
        q.size = 14 + s % 2 * 7;
        q.rise = 28 + s % 3 * 9;
      }
    },
    update: function (dt) {
      for (var i = 0; i < this.pool.length; i++) {
        var e = this.pool[i];
        if (!e.active) continue;
        e.age += dt;
        if (e.age >= e.life) e.active = false;
      }
    },
    draw: function (ctx) {
      for (var i = 0; i < this.pool.length; i++) {
        var e = this.pool[i];
        if (!e.active) continue;
        var t = e.age,
          x = e.x - Camera.x,
          y = e.y - Camera.y;
        ctx.save();
        // 1 核心闪光 0~0.1s：白→橙黄→透明径向渐变。
        if (t <= .1) {
          var p = t / .1,
            scale = Math.sin(p * Math.PI),
            r = CONFIG.TURRET_VISUAL.EXPLOSION_RADIUS * scale;
          ctx.globalAlpha = 1 - p;
          var g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
          root.safeStop(g, 0, '#ffffff');
          root.safeStop(g, .35, '#ffe16a');
          root.safeStop(g, .7, '#ff8a24');
          root.safeStop(g, 1, 'rgba(255,65,20,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        // 2 火焰爆发 0.1~0.3s：五个固定方向火团和锯齿喷射。
        if (t >= .1 && t <= .3) {
          var fp = (t - .1) / .2;
          ctx.globalAlpha = 1 - fp;
          for (var f = 0; f < e.fire.length; f++) {
            var a = e.fire[f].a,
              d = e.fire[f].speed * fp,
              sz = e.fire[f].size * (1 + fp);
            ctx.fillStyle = f % 2 ? '#ff6928' : '#ffd24c';
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
            ctx.lineTo(x + Math.cos(a - .16) * (d + 32), y + Math.sin(a - .16) * (d + 32));
            ctx.lineTo(x + Math.cos(a + .16) * (d + 32), y + Math.sin(a + .16) * (d + 32));
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, sz, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // 3 电蓝冲击波 0.1~0.5s，最大半径与伤害半径一致。
        if (t >= .1 && t <= .5) {
          var wp = (t - .1) / .4,
            wr = CONFIG.TURRET_VISUAL.EXPLOSION_RADIUS * (.3 + .7 * (1 - Math.pow(1 - Math.max(0, Math.min(1, wp)), 3)));
          ctx.globalAlpha = .8 * (1 - wp);
          ctx.strokeStyle = '#3FD0E5';
          ctx.lineWidth = 3 + 5 * wp;
          ctx.beginPath();
          ctx.arc(x, y, wr, 0, Math.PI * 2);
          ctx.stroke();
        }
        // 4 烟雾 0.3~1s：预分配烟团缓慢上升扩大。
        if (t >= .3 && t <= 1) {
          var sp = (t - .3) / .7;
          ctx.globalAlpha = .58 * (1 - sp);
          ctx.fillStyle = '#3A3A3A';
          for (var s = 0; s < e.smoke.length; s++) {
            var q = e.smoke[s],
              sx = x + Math.cos(q.a) * q.dist * (1 + sp) - Math.sin(q.a) * 8 * sp,
              sy = y + Math.sin(q.a) * q.dist - q.rise * sp;
            ctx.beginPath();
            ctx.arc(sx, sy, q.size * (1 + .65 * sp), 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // 5 地面焦痕 0.5~2s：固定大小，深褐填充和电蓝边缘渐隐。
        if (t >= .5) {
          var bp = (t - .5) / 1.5,
            alpha = bp < .15 ? bp / .15 * .7 : .7 * (1 - (bp - .15) / .85);
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.fillStyle = '#2b1a15';
          ctx.strokeStyle = 'rgba(63,208,229,.72)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(x, y, CONFIG.TURRET_VISUAL.EXPLOSION_RADIUS * .7, CONFIG.TURRET_VISUAL.EXPLOSION_RADIUS * .38, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  };
root.MortarExplosionFX = MortarExplosionFX;
})();

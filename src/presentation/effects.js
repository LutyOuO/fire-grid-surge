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
    goldFlash: 0,
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
      this.emitBurst(x, y, color, CONFIG.POLISH.KILL_PARTICLES, 1, 1);
    },
    // v014 #96 参数化粒子喷发（固定池，无 new）。
    emitBurst: function (x, y, color, count, speedMul, lifeMul) {
      var quality = root.Settings && root.Settings.getQuality ? root.Settings.getQuality() : CONFIG.RENDER_QUALITY.LEVELS.high;
      count = Math.max(1, Math.ceil(count * quality.PARTICLES));
      var speed = CONFIG.POLISH.PARTICLE_SPEED * (speedMul || 1);
      var life = CONFIG.POLISH.PARTICLE_LIFE * (lifeMul || 1);
      var made = 0;
      for (var i = 0; i < this.pool.length && made < count; i++) {
        var p = this.pool[i];
        if (p.active) continue;
        var a = Math.random() * Math.PI * 2;
        p.active = true;
        p.x = x;
        p.y = y;
        p.life = life;
        p.vx = Math.cos(a) * speed;
        p.vy = Math.sin(a) * speed;
        p.color = color || '';
        made += 1;
      }
    },
    // v014 #96 反馈分级：普通命中只小点不震屏；暴击中粒子+重音+轻震；精英/BOSS 重（BOSS 附慢动作）。
    feedbackHit: function (x, y) {
      this.emitBurst(x, y, CONFIG.COLORS.PARTICLE, CONFIG.FEEDBACK.NORMAL_HIT_PARTICLES || 3, 0.7, 0.7);
    },
    feedbackCrit: function (x, y) {
      var F = CONFIG.FEEDBACK;
      this.emitBurst(x, y, CONFIG.COLORS.DAMAGE_CRIT || '#ffd54a', F.CRIT_PARTICLES, 1.3, 1.1);
      AudioFX.play('crit');
      if (root.Settings && root.Settings.shake) Camera.startShake(F.CRIT_SHAKE_SIZE, F.CRIT_SHAKE_TIME);
    },
    feedbackEliteKill: function (x, y) {
      var F = CONFIG.FEEDBACK;
      this.emitBurst(x, y, CONFIG.COLORS.RARITY_EPIC || '#b388ff', F.ELITE_KILL_PARTICLES, 1.6, 1.4);
      AudioFX.play('elite');
      if (root.Settings && root.Settings.shake) Camera.startShake(F.ELITE_SHAKE_SIZE, F.ELITE_SHAKE_TIME);
    },
    feedbackBossKill: function (x, y) {
      var F = CONFIG.FEEDBACK;
      this.emitBurst(x, y, CONFIG.COLORS.RARITY_GOLD || '#ffd54a', F.BOSS_KILL_PARTICLES, 1.9, 1.7);
      AudioFX.play('boss');
      if (root.Settings && root.Settings.shake) Camera.startShake(F.BOSS_SHAKE_SIZE, F.BOSS_SHAKE_TIME);
      if (root.Game && root.Game.startSlowMo) root.Game.startSlowMo(F.BOSS_SLOMO_SCALE, F.BOSS_SLOMO_TIME);
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
      this.goldFlash = Math.max(0, this.goldFlash - dt);
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
      // v014 #96 金词条获得金光全屏短暂闪烁。
      if (this.goldFlash > 0) {
        ctx.globalAlpha = 0.35 * Math.min(1, this.goldFlash / (CONFIG.FEEDBACK.RARITY_GOLD_FLASH || 0.6));
        ctx.fillStyle = '#ffd54a';
        ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
        ctx.globalAlpha = 1;
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
      this.goldFlash = 0;
      this.notice = 0;
      this.wave = 0;
    }
  };
var Metrics = {
    seconds: 0,
    frames: 0,
    fps: 0,
    lowSamples: 0,
    highSamples: 0,
    qualityCooldown: 0,
    sample: function (dt) {
      if (dt <= 0 || dt > 1) return;
      this.seconds += dt;
      this.qualityCooldown = Math.max(0, this.qualityCooldown - dt);
      this.frames += 1;
      if (this.seconds >= CONFIG.POLISH.FPS_SAMPLE) {
        this.fps = Math.round(this.frames / this.seconds);
        this.updateAutoQuality();
        this.seconds = 0;
        this.frames = 0;
      }
    },
    updateAutoQuality: function () {
      if (!Settings || Settings.quality !== 'auto' || this.qualityCooldown > 0) return;
      var q = CONFIG.RENDER_QUALITY;
      if (this.fps < q.LOW_FPS) { this.lowSamples++; this.highSamples = 0; }
      else if (this.fps >= q.HIGH_FPS) { this.highSamples++; this.lowSamples = 0; }
      else { this.lowSamples = this.highSamples = 0; }
      var levels = ['low', 'medium', 'high'], index = levels.indexOf(Settings.autoLevel);
      if (this.lowSamples >= q.LOW_SAMPLES && index > 0) { Settings.autoLevel = levels[index - 1]; this.lowSamples = 0; this.qualityCooldown = q.CHANGE_COOLDOWN; }
      if (this.highSamples >= q.HIGH_SAMPLES && index < levels.length - 1) { Settings.autoLevel = levels[index + 1]; this.highSamples = 0; this.qualityCooldown = q.CHANGE_COOLDOWN; }
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
      var visibleEnemy = 0, visibleDrops = 0;
      for (var i = 0; i < Enemy.pool.length; i++) if (Enemy.pool[i].active && Camera.isVisible(Enemy.pool[i].x, Enemy.pool[i].y, Enemy.pool[i].radius)) visibleEnemy++;
      var pools = [root.Experience.pool, root.CoinDrops.pool, root.PowerUps.pool];
      for (var pi = 0; pi < pools.length; pi++) for (var di = 0; di < pools[pi].length; di++) if (pools[pi][di].active && Camera.isVisible(pools[pi][di].x, pools[pi][di].y, 20)) visibleDrops++;
      ctx.fillText(CONFIG.TEXT.DEBUG_LINE(this.fps, Enemy.activeCount, Bullet.activeCount, this.count(FX.pool), this.count(root.DamageText.pool), visibleEnemy, visibleDrops), 32, debugY + 27);
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
    },
    // 只遍历圆形范围覆盖到的网格；实体仍以精确平方距离做最终判定。
    forEachInRadius: function (x, y, radius, callback) {
      var minCol = this.cell(x - radius, this.cols),
        maxCol = this.cell(x + radius, this.cols),
        minRow = this.cell(y - radius, this.rows),
        maxRow = this.cell(y + radius, this.rows),
        radiusSq = radius * radius;
      for (var row = minRow; row <= maxRow; row++) {
        for (var col = minCol; col <= maxCol; col++) {
          var index = this.heads[row * this.cols + col];
          var guard = 0;
          while (index >= 0 && guard++ < Enemy.pool.length) {
            var enemy = Enemy.pool[index];
            if (enemy && enemy.active) {
              var dx = enemy.x - x, dy = enemy.y - y;
              if (dx * dx + dy * dy <= radiusSq) callback(enemy, index);
            }
            index = this.next[index];
          }
        }
      }
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
      for (var i = 0; i < 96; i++) {
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
      // 仅登记点击热区。鼠标悬停不再额外绘制蓝色描边，避免 H5 与手机视觉不一致。
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
      var compact = Game.state === 'SETTINGS';
      var top = compact ? 265 : c.PANEL_TOP, step = compact ? 92 : c.PANEL_STEP, height = compact ? 66 : c.PANEL_H;
      UI.drawActionButton(ctx, c.PANEL_X, top + row * step, c.PANEL_W, height, label, true, 27);
    },
    draw: function (ctx) {
      var overBattle = Game.state === 'PAUSED' || this.parent === 'PAUSED';
      ctx.fillStyle = overBattle ? 'rgba(0,0,0,' + CONFIG.POLISH.PAUSE_OVERLAY_ALPHA + ')' : CONFIG.COLORS.MENU_BACKGROUND;
      ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
      var state = Game.state;
      var text = CONFIG.TEXT;
      var title = state === 'PAUSED' ? text.PAUSE_TITLE : state === 'SETTINGS' ? text.SETTINGS : state === 'BUILD' ? '当前构筑' : text.HELP;
      var settingsIcon = UI.icon('nav_settings');
      if (settingsIcon && state === 'SETTINGS') ctx.drawImage(settingsIcon, CONFIG.VIEW.WIDTH / 2 - 28, 105 + (CONFIG.UI.TOP_INSET || 0), 56, 56);
      UI.drawCenteredText(ctx, title, 180 + (CONFIG.UI.TOP_INSET || 0), 54, true, CONFIG.COLORS.COIN);
      if (state === 'PAUSED') {
        this.button(ctx, 0, text.RESUME);
        this.button(ctx, 1, text.SETTINGS);
        this.button(ctx, 2, text.HELP);
        this.button(ctx, 3, '当前构筑');
        this.button(ctx, 4, text.ABANDON);
        this.drawSummary(ctx);
      } else if (state === 'BUILD') {
        this.drawBuild(ctx); this.button(ctx, 5, text.BACK);
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
        }, {
          key: 'mirror',
          label: text.MIRROR
        }, {
          key: 'highFps',
          label: text.HIGH_FPS
        }];
        for (var i = 0; i < rows.length; i++) {
          var rk = rows[i].key;
          this.button(ctx, i, rows[i].label + '：' + (Settings[rk] ? text.ON : text.OFF));
        }
        this.button(ctx, rows.length, text.QUALITY + '：' + text.QUALITY_NAMES[Settings.quality]);
        this.button(ctx, rows.length + 1, text.BACK);
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
    drawBuild: function (ctx) {
      var s = root.FinalStats.get(), y = 265, lines = [
        '伤害 ' + s.damage.toFixed(1) + '    射速 ' + s.fireRate.toFixed(2) + '/秒',
        '弹匣 ' + s.magazine + '    换弹 ' + s.reload.toFixed(2) + '秒',
        '移速 ' + s.speed.toFixed(0) + '    拾取 ' + s.pickup.toFixed(0),
        '暴击 ' + Math.round(s.crit * 100) + '%    倍率 ' + s.critMultiplier.toFixed(2),
        '贯穿 ' + s.penetration + '    弹道 ' + s.projectiles,
        '生命 ' + s.maxHp + '    护甲 ' + Math.ceil(s.armor),
        '武器强化 Lv.' + s.weaponLevel + (s.ammo ? '    弹药 ' + s.ammo : ''),
        '技能：' + (s.skills.length ? s.skills.map(function (id) { for (var i=0;i<CONFIG.ARMORY.PERKS.length;i++) if(CONFIG.ARMORY.PERKS[i].ID===id)return CONFIG.ARMORY.PERKS[i].NAME; return id; }).join('、') : '无')
      ];
      for (var i = 0; i < lines.length; i++) UI.drawCenteredText(ctx, lines[i], y + i * 52, 21, i === 0, i === 0 ? CONFIG.COLORS.COIN : CONFIG.COLORS.TEXT);
      var yy = y + lines.length * 52 + 10, shown = 0;
      for (var j = 0; j < CONFIG.UPGRADES.DEFINITIONS.length && shown < 5; j++) { var d = CONFIG.UPGRADES.DEFINITIONS[j], lv = ExpLevelUp.levels[d.ID]; if (!lv) continue; shown++; UI.drawCenteredText(ctx, CONFIG.TEXT.UPGRADES[d.TEXT_KEY].NAME + '  Lv.' + lv, yy + shown * 38, 18, false, CONFIG.COLORS.HINT_TEXT); }
    },
    update: function () {
      if (!Input.consumeTap(UI.tapPoint)) return;
      var c = CONFIG.POLISH;
      var p = UI.tapPoint;
      if (p.x < c.PANEL_X || p.x > c.PANEL_X + c.PANEL_W) return;
      var compact = Game.state === 'SETTINGS', panelTop = compact ? 265 : c.PANEL_TOP, panelStep = compact ? 92 : c.PANEL_STEP, panelHeight = compact ? 66 : c.PANEL_H;
      var row = Math.floor((p.y - panelTop) / panelStep);
      if (row < 0 || p.y > panelTop + row * panelStep + panelHeight) return;
      if (Game.state === 'PAUSED') {
        if (row === 0) this.resume();
        if (row === 1) this.open('SETTINGS');
        if (row === 2) this.open('HELP');
        if (row === 3) {
          this.open('BUILD');
        }
        if (row === 4) {
          Game.exitType = 'quit';
          Game.state = CONFIG.GAME.STATE_GAMEOVER;
          Game.commitSettlement(false);
        }
      } else if (Game.state === 'SETTINGS') {
        var settingKeys = ['sound', 'shake', 'debug', 'alwaysShowJoystick', 'mirror', 'highFps'];
        if (row < settingKeys.length) Settings.toggle(settingKeys[row]);
        if (row === settingKeys.length) Settings.cycleQuality();
        if (row === settingKeys.length + 1) Game.state = this.parent;
      } else if (Game.state === 'HELP' && row === 4) {
        Game.state = this.parent;
      } else if (Game.state === 'BUILD' && row === 5) {
        Game.state = 'PAUSED';
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
  var TeslaArcFX = {
    pool: [],
    init: function () {
      this.pool.length = 0;
      for (var i = 0; i < CONFIG.TURRETS.KINDS.tesla.POOL_ARCS; i++) {
        this.pool.push({ active: false, x1: 0, y1: 0, x2: 0, y2: 0, age: 0, life: 0.18, seed: i * 13.7 });
      }
    },
    reset: function () {
      for (var i = 0; i < this.pool.length; i++) this.pool[i].active = false;
    },
    spawn: function (x1, y1, x2, y2) {
      var e = this.pool[0];
      for (var i = 0; i < this.pool.length; i++) if (!this.pool[i].active) {
        e = this.pool[i];
        break;
      }
      e.active = true;
      e.x1 = x1;
      e.y1 = y1;
      e.x2 = x2;
      e.y2 = y2;
      e.age = 0;
      e.life = 0.18;
      e.seed = (e.seed + 19.1) % 997;
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
        var a = 1 - e.age / e.life;
        ctx.save();
        ctx.strokeStyle = '#c8fbff';
        ctx.globalAlpha = a;
        ctx.lineWidth = 3;
        ctx.shadowColor = CONFIG.COLORS.TESLA;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(e.x1 - Camera.x, e.y1 - Camera.y);
        var mx = (e.x1 + e.x2) / 2, my = (e.y1 + e.y2) / 2;
        var nx = e.y2 - e.y1, ny = e.x1 - e.x2, nlen = Math.hypot(nx, ny) || 1;
        mx += nx / nlen * Math.sin(e.seed) * 18;
        my += ny / nlen * Math.cos(e.seed) * 18;
        ctx.lineTo(mx - Camera.x, my - Camera.y);
        ctx.lineTo(e.x2 - Camera.x, e.y2 - Camera.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  };
  var FrostPatchFX = {
    pool: [],
    init: function () {
      this.pool.length = 0;
      for (var i = 0; i < CONFIG.TURRETS.KINDS.frost.POOL_PATCHES; i++) {
        this.pool.push({ active: false, x: 0, y: 0, r: 0, age: 0, life: 2.4 });
      }
    },
    reset: function () {
      for (var i = 0; i < this.pool.length; i++) this.pool[i].active = false;
    },
    spawn: function (x, y, r, life) {
      var e = this.pool[0];
      for (var i = 0; i < this.pool.length; i++) if (!this.pool[i].active) {
        e = this.pool[i];
        break;
      }
      e.active = true;
      e.x = x;
      e.y = y;
      e.r = r;
      e.age = 0;
      e.life = life || 2.4;
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
        ctx.save();
        ctx.globalAlpha = 0.2 * (1 - e.age / e.life);
        ctx.strokeStyle = '#d8f4ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x - Camera.x, e.y - Camera.y, e.r * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  };
  root.TeslaArcFX = TeslaArcFX;
  root.FrostPatchFX = FrostPatchFX;
})();

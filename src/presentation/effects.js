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
    updateMs: 0,
    drawMs: 0,
    lowSamples: 0,
    highSamples: 0,
    qualityCooldown: 0,
    sample: function (dt) {
      if (dt <= 0 || dt > 1) return;
      this.seconds += dt;
      this.qualityCooldown = Math.max(0, this.qualityCooldown - dt);
      this.frames += 1;
      if (this.seconds >= CONFIG.RENDER_QUALITY.FPS_SAMPLE) {
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
      ctx.font = '16px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillText(CONFIG.TEXT.DEBUG_LINE(this.fps, Enemy.activeCount, Bullet.activeCount, this.count(FX.pool), this.count(root.DamageText.pool), visibleEnemy, visibleDrops, this.updateMs, this.drawMs), 32, debugY + 27);
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
// 离屏圆形精灵缓存：渐变/阴影只在第一次烘焙时创建，战斗帧只 drawImage。
var SpriteCache = {
  canvas: Object.create(null),
  createCanvas: function (width, height) {
    try {
      if (typeof document !== 'undefined' && document.createElement) {
        var canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas;
      }
      if (typeof wx !== 'undefined' && wx.createCanvas) {
        var offscreen = wx.createCanvas();
        if (root.Platform && offscreen === root.Platform.canvas) return null;
        offscreen.width = width; offscreen.height = height; return offscreen;
      }
    } catch (error) {}
    return null;
  },
  getCircle: function (key, radius, fill, glow, outline, core) {
    if (this.canvas[key]) return this.canvas[key];
    var side = Math.ceil(radius * CONFIG.SPRITES.CACHE_SCALE), canvas = this.createCanvas(side, side);
    if (!canvas) return null;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    var center = side / 2;
    ctx.save(); ctx.shadowColor = glow || fill; ctx.shadowBlur = radius;
    ctx.beginPath(); ctx.arc(center, center, radius, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
    ctx.shadowBlur = 0; ctx.lineWidth = Math.max(1, radius * 0.12); ctx.strokeStyle = outline || fill; ctx.stroke();
    if (core) { ctx.beginPath(); ctx.arc(center, center, radius * CONFIG.SPRITES.CIRCLE_CORE_RATIO, 0, Math.PI * 2); ctx.fillStyle = core; ctx.fill(); }
    ctx.restore(); this.canvas[key] = canvas; return canvas;
  },
  getDiamond: function (key, halfWidth, halfHeight, fill, glow, outline, core) {
    if (this.canvas[key]) return this.canvas[key];
    var width = Math.ceil(halfWidth * CONFIG.SPRITES.CACHE_SCALE), height = Math.ceil(halfHeight * CONFIG.SPRITES.CACHE_SCALE), canvas = this.createCanvas(width, height);
    if (!canvas) return null;
    var ctx = canvas.getContext('2d'), x = width / 2, y = height / 2;
    if (!ctx) return null;
    ctx.save(); ctx.shadowColor = glow || fill; ctx.shadowBlur = halfWidth;
    ctx.beginPath(); ctx.moveTo(x, y - halfHeight); ctx.lineTo(x + halfWidth, y); ctx.lineTo(x, y + halfHeight); ctx.lineTo(x - halfWidth, y); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = outline || fill; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - halfHeight * CONFIG.SPRITES.DIAMOND_CORE_TOP); ctx.lineTo(x, y + halfHeight * CONFIG.SPRITES.DIAMOND_CORE_BOTTOM); ctx.lineWidth = CONFIG.SPRITES.DIAMOND_LINE_WIDTH; ctx.strokeStyle = core || fill; ctx.stroke();
    ctx.restore(); this.canvas[key] = canvas; return canvas;
  },
  getCrossbowArrow: function () {
    var key = 'projectile_crossbow_arrow';
    if (this.canvas[key]) return this.canvas[key];
    var d = CONFIG.SPRITES.CROSSBOW_ARROW, canvas = this.createCanvas(d.WIDTH, d.HEIGHT);
    if (!canvas) return null;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.lineCap = 'round'; ctx.strokeStyle = d.SHAFT; ctx.lineWidth = d.SHAFT_W;
    ctx.beginPath(); ctx.moveTo(4, d.HEIGHT / 2); ctx.lineTo(d.WIDTH - 8, d.HEIGHT / 2); ctx.stroke();
    ctx.fillStyle = d.COLOR; ctx.beginPath(); ctx.moveTo(d.WIDTH - 3, d.HEIGHT / 2); ctx.lineTo(d.WIDTH - 13, 2); ctx.lineTo(d.WIDTH - 13, d.HEIGHT - 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = d.FEATHER; ctx.fillRect(5, d.HEIGHT / 2 - 2, d.WIDTH * 0.52, 4);
    this.canvas[key] = canvas; return canvas;
  },
  drawCircle: function (ctx, key, x, y, radius, fill, glow, outline, core) {
    var sprite = this.getCircle(key, radius, fill, glow, outline, core);
    if (sprite) ctx.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2);
    return !!sprite;
  },
  drawShape: function(ctx,key,x,y,radius,fill,outline,trace,entity,paint) {
    var sprite=this.canvas[key];
    if(!sprite){
      var side=Math.ceil(radius*CONFIG.SPRITES.CACHE_SCALE);
      sprite=this.createCanvas(side,side);
      if(!sprite)return false;
      var brush=sprite.getContext('2d');
      if(!brush)return false;
      brush.beginPath();trace(brush,entity,side/2,side/2);
      brush.fillStyle=fill;brush.fill();brush.lineWidth=CONFIG.ENEMY.OUTLINE_WIDTH;brush.strokeStyle=outline;brush.stroke();
      if(paint)paint(brush,entity,side/2,side/2,fill);
      this.canvas[key]=sprite;
    }
    ctx.drawImage(sprite,x-sprite.width/2,y-sprite.height/2);
    return true;
  },
  warm: function () {
    this.getCircle('coin_' + CONFIG.COLORS.COIN, CONFIG.COIN.RADIUS, CONFIG.COLORS.COIN, CONFIG.COLORS.COIN_GLOW, CONFIG.COLORS.COIN_OUTLINE, CONFIG.COLORS.COIN_CORE);
    this.getDiamond('gem_' + CONFIG.COLORS.GEM, CONFIG.EXPERIENCE.GEM_WIDTH / 2, CONFIG.EXPERIENCE.GEM_LENGTH / 2, CONFIG.COLORS.GEM, CONFIG.COLORS.GEM_GLOW, CONFIG.COLORS.GEM_OUTLINE, CONFIG.COLORS.GEM_CORE);
    this.getCircle('bullet_' + CONFIG.COLORS.BULLET, CONFIG.WEAPONS.PULSE.DRAW_RADIUS, CONFIG.COLORS.BULLET, CONFIG.COLORS.BULLET_GLOW, CONFIG.COLORS.BULLET, CONFIG.COLORS.BULLET_CORE);
    this.getDiamond('blade_default', CONFIG.WEAPONS.BLADE.WIDTH / 2, CONFIG.WEAPONS.BLADE.LENGTH / 2, CONFIG.COLORS.WEAPON_BLADE, CONFIG.COLORS.WEAPON_BLADE_GLOW, CONFIG.COLORS.BLADE_OUTLINE, CONFIG.COLORS.BLADE_CORE);
    this.getCrossbowArrow();
    for (var i = 0; i < CONFIG.ENEMY.TYPES.length; i++) {
      var def = CONFIG.ENEMY.TYPES[i], tier = Math.ceil(def.RADIUS / 8) * 8;
      this.getCircle('enemy_' + i + '_' + tier + '_' + CONFIG.COLORS[def.FILL_KEY], tier, CONFIG.COLORS[def.FILL_KEY], CONFIG.COLORS[def.GLOW_KEY], CONFIG.COLORS[def.OUTLINE_KEY]);
    }
    for (var d = 0; d <= CONFIG.POWERUPS.TYPE_MORTAR; d++) {
      this.getCircle('drop_' + d + '_' + CONFIG.UI.WORLD_ITEM_RADIUS, CONFIG.UI.WORLD_ITEM_RADIUS, CONFIG.COLORS.ITEM_BASE, CONFIG.COLORS.ITEM_BORDER, CONFIG.COLORS.ITEM_BORDER);
    }
  },
  clear: function () { this.canvas = Object.create(null); }
};
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
    parent: CONFIG.GAME.STATE_MENU, previous: CONFIG.GAME.STATE_PLAYING, scroll: 0, drag: null,
    layout: function () {
      var h = CONFIG.VIEW.HEIGHT, top = Math.max(0, root.Platform && root.Platform.safeTop || 0), bottom = Math.max(0, root.Platform && root.Platform.safeBottom || 0);
      var y = Math.max(12, top + 12), height = Math.max(360, h - y - bottom - 12);
      // 暂停按菜单实际高度收紧，并在安全区内居中；小屏仍允许内容滚动。
      if (Game.state === 'PAUSED') {
        var menu = CONFIG.POLISH.PAUSE_MENU, available = Math.max(0, h - y - bottom - 12);
        var width = Math.min(menu.PANEL_WIDTH, CONFIG.VIEW.WIDTH - 48);
        height = Math.min(available, 88 + 110 + this.rows('PAUSED') * menu.STEP + menu.BODY_PADDING * 2);
        y += (available - height) / 2;
        return { x: (CONFIG.VIEW.WIDTH - width) / 2, y: y, w: width, h: height, header: 88, footer: 110, bodyY: y + 88, bodyH: Math.max(0, height - 198) };
      }
      return { x: 24, y: y, w: CONFIG.VIEW.WIDTH - 48, h: height, header: 88, footer: 110, bodyY: y + 88, bodyH: height - 198 };
    },
    open: function (state) { if (Ads.active) return; this.parent = Game.state; Game.state = state; this.scroll = 0; Input.reset(); Input.setMovementEnabled(false); ButtonUI.pressed.active = false; },
    pause: function () { if (Ads.active || (Game.state !== CONFIG.GAME.STATE_PLAYING && Game.state !== CONFIG.GAME.STATE_LEVELUP)) return; this.previous = Game.state; this.open('PAUSED'); },
    resume: function () { Game.state = this.previous; Game.lastTimestamp = 0; this.scroll = 0; Input.reset(); Input.setMovementEnabled(Game.state === CONFIG.GAME.STATE_PLAYING); },
    rows: function (state) {
      if (state === 'PAUSED') return 5;
      if (state === 'SETTINGS') return 7;
      if (state === 'HELP') return CONFIG.TEXT.HELP_LINES.length;
      if (state === 'BUILD') return 6 + CONFIG.UPGRADES.DEFINITIONS.filter(function (d) { return ExpLevelUp.levels[d.ID] > 0; }).length + (root.Armory ? root.Armory.perks.length : 0) + (root.Armory && root.Armory.ammoType ? 1 : 0) + (root.Armory && root.Armory.weaponLevel ? 1 : 0);
      return 0;
    },
    rowStep: function (frame) { return Game.state === 'PAUSED' ? CONFIG.POLISH.PAUSE_MENU.STEP : Game.state === 'BUILD' ? 62 : 94; },
    // 绘制和点击共用同一矩形，按钮之间的留白不触发操作。
    pauseButtonRect: function (f, index) {
      var c = CONFIG.POLISH.PAUSE_MENU, width = Math.min(c.WIDTH, f.w - c.INSET * 2);
      var top = Math.max(0, (f.bodyH - this.rows('PAUSED') * c.STEP) / 2);
      return { x: f.x + (f.w - width) / 2, y: f.bodyY + top + index * c.STEP + (c.STEP - c.HEIGHT) / 2 - this.scroll, w: width, h: c.HEIGHT };
    },
    rowAt: function (p, frame) { return Math.floor((p.y - frame.bodyY + this.scroll) / this.rowStep(frame)); },
    drawFrame: function (ctx, title, hasClose) {
      var f = this.layout();
      UI.drawModalChrome(ctx, f, title, Game.state === 'PAUSED' ? '结束本局' : '返回', CONFIG.POLISH.PAUSE_OVERLAY_ALPHA);
      if (hasClose) { UI.drawActionButton(ctx, f.x + f.w - 70, f.y + 17, 48, 48, '×', true, 30); }
      return f;
    },
    drawRow: function (ctx, f, index, label, detail, active, color) {
      var step = this.rowStep(f), height = Game.state === 'BUILD' ? 52 : Math.min(76, step - 12), y = f.bodyY + index * step + (step - height) / 2 - this.scroll;
      if (y + height < f.bodyY || y > f.bodyY + f.bodyH) return;
      UI.roundedRectPath(ctx, f.x + 18, y, f.w - 36, height, 13); ctx.fillStyle = active ? '#163340' : '#172224'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = color || (active ? '#35bce8' : '#34494a'); ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = 'bold 21px Arial,"Microsoft YaHei",sans-serif'; ctx.fillStyle = active ? '#fff4d6' : '#e1e9e5'; ctx.fillText(label, f.x + 36, y + (detail ? height * .38 : height / 2));
      if (detail) { ctx.font = '16px Arial,"Microsoft YaHei",sans-serif'; ctx.fillStyle = '#a8bbb7'; ctx.fillText(detail, f.x + 36, y + height * .70); }
      ctx.textAlign = 'start';
    },
    clampScroll: function (f) { var total = this.rows(Game.state) * this.rowStep(f); this.scroll = Math.max(0, Math.min(Math.max(0, total - f.bodyH), this.scroll)); },
    draw: function (ctx) {
      if(Game.state==='QUIT_RUN'||Game.state==='QUIT_CONFIRM'){this.drawQuit(ctx);return;}
      var state = Game.state, f, text = CONFIG.TEXT, title = state === 'PAUSED' ? text.PAUSE_TITLE : state === 'SETTINGS' ? text.SETTINGS : state === 'BUILD' ? '当前构筑' : text.HELP;
      f = this.drawFrame(ctx, title, state !== 'PAUSED'); this.clampScroll(f);
      ctx.save(); ctx.beginPath(); ctx.rect(f.x + 8, f.bodyY, f.w - 16, f.bodyH); ctx.clip();
      if (state === 'PAUSED') {
        var labels = [text.RESUME, text.SETTINGS, text.HELP, '当前构筑',text.TUTORIAL.REPLAY];
        for (var i = 0; i < labels.length; i++) {
          var button = this.pauseButtonRect(f, i);
          UI.drawActionButton(ctx, button.x, button.y, button.w, button.h, labels[i], true, CONFIG.POLISH.PAUSE_MENU.FONT);
        }
      } else if (state === 'SETTINGS') {
        var rows = [{key:'sound',label:text.SOUND},{key:'shake',label:text.SHAKE},{key:'debug',label:text.DEBUG},{key:'alwaysShowJoystick',label:text.JOYSTICK_ALWAYS},{key:'mirror',label:text.MIRROR},{key:'highFps',label:text.HIGH_FPS}];
        for (var i = 0; i < rows.length; i++) this.drawRow(ctx, f, i, rows[i].label, Settings[rows[i].key] ? text.ON : text.OFF, true, Settings[rows[i].key] ? '#38b7df' : '#4a5958');
        this.drawRow(ctx, f, rows.length, text.QUALITY, text.QUALITY_NAMES[Settings.quality], true, '#38b7df');
      } else if (state === 'BUILD') this.drawBuildRows(ctx, f);
      else for (var i = 0; i < text.HELP_LINES.length; i++) this.drawRow(ctx, f, i, text.HELP_LINES[i], '', false);
      ctx.restore();
      if (this.rows(state) * this.rowStep(f) > f.bodyH) {
        var range = this.rows(state) * this.rowStep(f), barH = Math.max(32, f.bodyH * f.bodyH / range), track = f.bodyH - barH;
        ctx.fillStyle = '#253539'; ctx.fillRect(f.x + f.w - 9, f.bodyY + 4, 3, f.bodyH - 8); ctx.fillStyle = '#668087'; ctx.fillRect(f.x + f.w - 9, f.bodyY + 4 + track * (this.scroll / Math.max(1, range - f.bodyH)), 3, barH);
      }
    },
    drawBuildRows: function (ctx, f) {
      var s = root.FinalStats.get(), i = 0;
      var stats = [['移速', s.speed.toFixed(0)], ['拾取半径', s.pickup.toFixed(0)], ['暴击率', Math.round(s.crit * 100) + '%'], ['暴击倍率', s.critMultiplier.toFixed(2) + '×'], ['贯穿', String(s.penetration)], ['弹道数', String(s.projectiles)], ['生命', String(s.maxHp)], ['护甲', String(Math.ceil(s.armor))], ['武器强化', 'Lv.' + s.weaponLevel], ['技能数', String(s.skills.length)]];
      for (var a = 0; a < stats.length; a += 2) {
        var step = this.rowStep(f), y = f.bodyY + i * step - this.scroll;
        if (y + 52 >= f.bodyY && y <= f.bodyY + f.bodyH) {
          UI.roundedRectPath(ctx, f.x + 18, y + 5, f.w - 36, 52, 12); ctx.fillStyle = '#172224'; ctx.fill(); ctx.strokeStyle = '#4a8b98'; ctx.stroke();
          ctx.font = '14px Arial,"Microsoft YaHei",sans-serif'; ctx.fillStyle = '#91a9a6'; ctx.textAlign = 'left'; ctx.fillText(stats[a][0], f.x + 34, y + 25); ctx.fillText(stats[a + 1][0], f.x + f.w / 2 + 10, y + 25);
          ctx.font = 'bold 18px Arial,"Microsoft YaHei",sans-serif'; ctx.fillStyle = '#f3f6e8'; ctx.fillText(stats[a][1], f.x + 34, y + 47); ctx.fillText(stats[a + 1][1], f.x + f.w / 2 + 10, y + 47); ctx.textAlign = 'start';
        }
        i++;
      }
      this.drawRow(ctx, f, i++, '当前武器', (root.WeaponProgress.selected || 'pistol') + ' · 伤害 ' + s.damage.toFixed(1) + ' · 射速 ' + s.fireRate.toFixed(2) + '/秒', false, '#c99340');
      var defs = CONFIG.UPGRADES.DEFINITIONS;
      for (var j = 0; j < defs.length; j++) { var d = defs[j], lv = ExpLevelUp.levels[d.ID] || 0; if (!lv) continue; var textDef = CONFIG.TEXT.UPGRADES[d.TEXT_KEY] || {}, name = textDef.NAME || d.ID, rarityKey = 'RARITY_' + (d.RARITY || 'COMMON'); this.drawRow(ctx, f, i++, name + '  Lv.' + lv, textDef.DESC || '已生效', false, CONFIG.COLORS[rarityKey] || '#75839a'); }
      if (root.Armory) {
        if (root.Armory.weaponLevel) this.drawRow(ctx, f, i++, '武器强化  Lv.' + root.Armory.weaponLevel, '伤害与弹匣容量 ×' + Math.pow(2, root.Armory.weaponLevel), false, '#e0ad44');
        if (root.Armory.ammoType) { var ammo = root.Armory.ammoDef(root.Armory.ammoType); this.drawRow(ctx, f, i++, ammo ? ammo.NAME : root.Armory.ammoType, '特殊弹药', false, ammo && ammo.COLOR || '#58c7d7'); }
        for (var p = 0; p < root.Armory.perks.length; p++) { var pd = CONFIG.ARMORY.PERKS.filter(function (q) { return q.ID === root.Armory.perks[p]; })[0]; if (pd) this.drawRow(ctx, f, i++, pd.NAME, '被动技能已激活', false, pd.COLOR); }
      }
    },
    update: function () {
      if(Game.state==='QUIT_RUN'||Game.state==='QUIT_CONFIRM'){this.updateQuit();return;}
      if (!Input.consumeTap(UI.tapPoint)) return;
      var p = UI.tapPoint, f = this.layout();
      if (p.x >= f.x + 36 && p.x <= f.x + f.w - 36 && p.y >= f.y + f.h - f.footer + 20 && p.y <= f.y + f.h - 22) {
        if (Game.state === 'PAUSED') this.open('QUIT_RUN');
        else if (Game.state === 'BUILD') Game.state = 'PAUSED'; else Game.state = this.parent;
      } else if ((Game.state === 'SETTINGS' || Game.state === 'BUILD' || Game.state === 'HELP') && p.x >= f.x + f.w - 70 && p.x <= f.x + f.w - 22 && p.y >= f.y + 17 && p.y <= f.y + 65) {
        Game.state = Game.state === 'BUILD' || Game.state === 'HELP' ? 'PAUSED' : this.parent;
      } else if (p.x >= f.x + 18 && p.x <= f.x + f.w - 18 && p.y >= f.bodyY && p.y < f.bodyY + f.bodyH) {
        var row = this.rowAt(p, f);
        if (Game.state === 'PAUSED') {
          row = -1;
          for (var i = 0; i < this.rows('PAUSED'); i++) {
            var button = this.pauseButtonRect(f, i);
            if (UI.isPointInRect(p, button.x, button.y, button.w, button.h)) { row = i; break; }
          }
          if (row === 0) this.resume(); else if (row === 1) this.open('SETTINGS'); else if (row === 2) this.open('HELP'); else if (row === 3) this.open('BUILD');
          else if(row===4){this.resume();root.Tutorial.replay();}
        }
        else if (Game.state === 'SETTINGS') { var keys = ['sound','shake','debug','alwaysShowJoystick','mirror','highFps']; if (row < keys.length) Settings.toggle(keys[row]); else if (row === keys.length) Settings.cycleQuality(); }
      }
      Input.clearTap();
    },
    quitLayout: function () {
      var c=CONFIG.QUIT_RUN,top=CONFIG.UI.TOP_INSET||0,bottom=CONFIG.UI.BOTTOM_INSET||0;
      var w=Math.min(c.WIDTH,CONFIG.VIEW.WIDTH-c.PADDING*2),h=Math.min(c.HEIGHT,CONFIG.VIEW.HEIGHT-top-bottom-c.PADDING*2);
      return {x:(CONFIG.VIEW.WIDTH-w)/2,y:top+(CONFIG.VIEW.HEIGHT-top-bottom-h)/2,w:w,h:h,header:88,footer:0};
    },
    quitButton: function(f,index){var c=CONFIG.QUIT_RUN;return{x:f.x+c.PADDING,y:f.y+f.h-c.PADDING-c.BUTTON_H*2-c.GAP+index*(c.BUTTON_H+c.GAP),w:f.w-c.PADDING*2,h:c.BUTTON_H};},
    drawQuit: function(ctx){
      var f=this.quitLayout(),c=CONFIG.QUIT_RUN,t=CONFIG.TEXT.QUIT_RUN,confirm=Game.state==='QUIT_CONFIRM';
      UI.drawModalChrome(ctx,f,confirm?t.CONFIRM_TITLE:t.TITLE,null,CONFIG.POLISH.PAUSE_OVERLAY_ALPHA);
      var lines=confirm?t.WARNING:t.LINES;
      ctx.save();ctx.font=c.TEXT_SIZE+'px Arial,"Microsoft YaHei"';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=CONFIG.COLORS.TEXT;
      for(var i=0;i<lines.length;i++)ctx.fillText(lines[i],f.x+f.w/2,f.y+f.header+c.LINE_H/2+i*c.LINE_H);
      ctx.restore();
      for(var j=0;j<2;j++){var b=this.quitButton(f,j);UI.drawActionButton(ctx,b.x,b.y,b.w,b.h,j?t.RESUME:confirm?t.CONFIRM:t.HOME,true,c.TEXT_SIZE);}
    },
    updateQuit: function(){
      if(!Input.consumeTap(UI.tapPoint))return;
      var f=this.quitLayout(),p=UI.tapPoint;
      for(var i=0;i<2;i++){var b=this.quitButton(f,i);if(!UI.isPointInRect(p,b.x,b.y,b.w,b.h))continue;
        if(i)this.resume();else if(Game.state==='QUIT_RUN')this.open('QUIT_CONFIRM');else Game.abandonRun();break;
      }
    }
  };
Platform.onTouchStart(function (x, y, e, id) { if (Game.state === 'PAUSED' || Game.state === 'SETTINGS' || Game.state === 'HELP' || Game.state === 'BUILD') { var f = Panels.layout(); if (y >= f.bodyY && y < f.bodyY + f.bodyH) Panels.drag = { id: id, y: y, start: y, moved: false }; } });
Platform.onTouchMove(function (x, y, e, id) { if (!Panels.drag || Panels.drag.id !== id) return; var dy = Panels.drag.y - y; Panels.scroll += dy; Panels.drag.y = y; if (Math.abs(y - Panels.drag.start) > 10) Panels.drag.moved = true; var f = Panels.layout(); Panels.clampScroll(f); });
Platform.onTouchEnd(function (x, y, e, id) { if (Panels.drag && Panels.drag.id === id) { if (Panels.drag.moved) Input.clearTap(); Panels.drag = null; } });
Platform.onKeyDown(function (event) {
    AudioFX.unlock();
    if (event.code === 'Escape' && !event.repeat && !Ads.active) {
      if (event.preventDefault) event.preventDefault();
      if (Game.state === 'PAUSED'||Game.state==='QUIT_RUN'||Game.state==='QUIT_CONFIRM') Panels.resume();else Panels.pause();
    }
  });
root.FX = FX;
root.Metrics = Metrics;
root.Spatial = Spatial;
root.SpriteCache = SpriteCache;
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
        ctx.shadowBlur = 0;
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

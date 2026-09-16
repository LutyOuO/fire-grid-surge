'use strict';
// ============================================================
// Field（战场元素）：墙壁 / 炮塔 / 激光 / Boss 掉落安全拾取
// 对 Player / Enemy / PowerUps / Spawner / Game / UI 做 monkey-patch
// 必须在 effects.js 之后加载
// ============================================================
var root = (typeof window !== 'undefined') ? window : global;
var CONFIG = root.CONFIG;
var Player = root.Player;
var Enemy = root.Enemy;
var Bullet = root.Bullet;
var Camera = root.Camera;
var UI = root.UI;
var Game = root.Game;
var PowerUps = root.PowerUps;
var Spawner = root.Spawner;
var BossSystem = root.BossSystem;
var ExpLevelUp = root.ExpLevelUp;
var RunStats = root.RunStats;
var FX = root.FX;
var Combat = root.Combat;

var Field = {
  turrets: [],
  shells: [],
  bossMax: 0,
  lootTimer: 0,
  bossDefeated: false,

  reset: function () {
    this.lootTimer = 0;
    this.bossDefeated = false;
    this.turrets.length = 0;
    for (var i = 0; i < CONFIG.FIELD.TURRETS.length; i++) {
      this.turrets.push({
        x: CONFIG.FIELD.TURRETS[i].x,
        y: CONFIG.FIELD.TURRETS[i].y,
        active: false, timer: 0, cooldown: 0,
        charge: 0, cooldownTimer: 0
      });
    }
    this.shells.length = 0;
    for (var i = 0; i < CONFIG.FIELD.SHELL_POOL; i++) {
      this.shells.push({ active: false, x: 0, y: 0, tx: 0, ty: 0, t: 0 });
    }
  },

  update: function (dt) {
    for (var i = 0; i < this.turrets.length; i++) {
      var t = this.turrets[i];
      if (t.active) {
        // 激活中：倒计时，结束后进入冷却
        t.timer -= dt;
        if (t.timer <= 0) {
          t.active = false;
          t.cooldownTimer = CONFIG.FIELD.TURRET_COOLDOWN;
          continue;
        }
        t.cooldown -= dt;
        if (t.cooldown <= 0) {
          t.cooldown = CONFIG.FIELD.TURRET_INTERVAL;
          this.fireTurret(t);
        }
      } else if (t.cooldownTimer > 0) {
        // 冷却中
        t.cooldownTimer -= dt;
        if (t.cooldownTimer < 0) t.cooldownTimer = 0;
      } else {
        // 待机：玩家在范围内则充能，离开则重置
        var dx = Player.x - t.x, dy = Player.y - t.y;
        var inRange = dx * dx + dy * dy <= CONFIG.FIELD.TURRET_ACTIVATE_RADIUS * CONFIG.FIELD.TURRET_ACTIVATE_RADIUS;
        if (inRange) {
          t.charge += dt;
          if (t.charge >= CONFIG.FIELD.TURRET_CHARGE_TIME) {
            t.active = true;
            t.timer = CONFIG.FIELD.TURRET_DURATION;
            t.cooldown = 0;
            t.charge = 0;
            FX.burst(t.x, t.y);
          }
        } else {
          if (t.charge > 0) t.charge = Math.max(0, t.charge - dt * 2);
        }
      }
    }
    for (var i = 0; i < this.shells.length; i++) {
      var s = this.shells[i];
      if (!s.active) continue;
      s.t += dt;
      if (s.t >= CONFIG.FIELD.SHELL_FLIGHT) {
        s.active = false;
        this.explode(s.tx, s.ty);
      }
    }
    if (this.lootTimer > 0) {
      this.lootTimer -= dt;
      this.pullLoot(dt);
    }
  },

  fireTurret: function (t) {
    var target = Enemy.findNearest(t.x, t.y);
    if (!target) return;
    var dist = Math.hypot(target.x - t.x, target.y - t.y);
    if (dist > CONFIG.FIELD.TURRET_RANGE) return;
    for (var i = 0; i < this.shells.length; i++) {
      var s = this.shells[i];
      if (!s.active) {
        s.active = true; s.x = t.x; s.y = t.y;
        s.tx = target.x; s.ty = target.y; s.t = 0;
        return;
      }
    }
  },

  explode: function (x, y) {
    var r = CONFIG.FIELD.SHELL_RADIUS;
    for (var i = 0; i < Enemy.pool.length; i++) {
      var e = Enemy.pool[i];
      if (!e.active) continue;
      var dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= r * r) {
        Combat.hitEnemy(e, CONFIG.FIELD.TURRET_DAMAGE, e.x, e.y);
      }
    }
    FX.burst(x, y);
  },

  pullLoot: function (dt) {
    var speed = CONFIG.FIELD.LOOT_PULL_SPEED;
    for (var i = 0; i < root.Experience.pool.length; i++) {
      var g = root.Experience.pool[i];
      if (!g.active) continue;
      var dx = Player.x - g.x, dy = Player.y - g.y;
      var d = Math.hypot(dx, dy);
      if (d > 0) {
        g.x += dx / d * speed * dt;
        g.y += dy / d * speed * dt;
      }
    }
    for (var i = 0; i < root.CoinDrops.pool.length; i++) {
      var c = root.CoinDrops.pool[i];
      if (!c.active) continue;
      var dx = Player.x - c.x, dy = Player.y - c.y;
      var d = Math.hypot(dx, dy);
      if (d > 0) {
        c.x += dx / d * speed * dt;
        c.y += dy / d * speed * dt;
      }
    }
  },

  draw: function (ctx) {
    // #8 四角废墟装饰（视野裁剪）
    var ruinR = CONFIG.BOUNDARY.CORNER_RUIN_RADIUS;
    var corners = [[0, 0], [CONFIG.WORLD.WIDTH, 0], [0, CONFIG.WORLD.HEIGHT], [CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT]];
    for (var ci = 0; ci < 4; ci++) {
      var rx = corners[ci][0] - Camera.x, ry = corners[ci][1] - Camera.y;
      if (rx + ruinR < -ruinR || rx - ruinR > CONFIG.VIEW.WIDTH + ruinR ||
          ry + ruinR < -ruinR || ry - ruinR > CONFIG.VIEW.HEIGHT + ruinR) continue;
      ctx.save();
      // 倒塌混凝土
      ctx.fillStyle = CONFIG.COLORS.RUIN_COLOR;
      ctx.beginPath();
      ctx.arc(rx, ry, ruinR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = CONFIG.COLORS.RUIN_EDGE;
      ctx.stroke();
      // 钢筋
      ctx.lineWidth = 3;
      ctx.strokeStyle = CONFIG.COLORS.WALL_EDGE;
      for (var k = 0; k < 4; k++) {
        var ka = k * Math.PI / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(rx + Math.cos(ka) * ruinR * 0.3, ry + Math.sin(ka) * ruinR * 0.3);
        ctx.lineTo(rx + Math.cos(ka) * ruinR * 0.85, ry + Math.sin(ka) * ruinR * 0.85);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 墙壁
    for (var i = 0; i < CONFIG.FIELD.WALLS.length; i++) {
      var w = CONFIG.FIELD.WALLS[i];
      var sx = w.x - Camera.x, sy = w.y - Camera.y;
      if (sx + w.w < 0 || sx > CONFIG.VIEW.WIDTH || sy + w.h < 0 || sy > CONFIG.VIEW.HEIGHT) continue;
      ctx.save();
      ctx.fillStyle = CONFIG.COLORS.WALL;
      ctx.fillRect(sx, sy, w.w, w.h);
      ctx.lineWidth = 5;
      ctx.strokeStyle = CONFIG.COLORS.WALL_EDGE;
      ctx.strokeRect(sx, sy, w.w, w.h);
      ctx.restore();
    }

    // 炮塔
    for (var i = 0; i < this.turrets.length; i++) {
      var t = this.turrets[i];
      var sx = t.x - Camera.x, sy = t.y - Camera.y;
      if (sx < -120 || sx > CONFIG.VIEW.WIDTH + 120 || sy < -120 || sy > CONFIG.VIEW.HEIGHT + 120) continue;
      // 部分微信真机运行环境没有全局 performance，直接调用会让战斗首帧中断。
      // Date.now() 在微信小游戏与 H5 中都可用，因此作为安全兜底。
      var nowMs = (typeof performance !== 'undefined' && performance.now)
        ? performance.now() : Date.now();
      var now = nowMs / 1000;

      // 激活范围圈（玩家靠近待机炮塔时显示）
      if (!t.active && t.cooldownTimer <= 0) {
        var pdx = Player.x - t.x, pdy = Player.y - t.y;
        var pInRange = pdx * pdx + pdy * pdy <= CONFIG.FIELD.TURRET_ACTIVATE_RADIUS * CONFIG.FIELD.TURRET_ACTIVATE_RADIUS;
        if (pInRange || t.charge > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(sx, sy, CONFIG.FIELD.TURRET_ACTIVATE_RADIUS, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 207, 112, 0.25)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 8]);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 充能进度环（呼吸状圆圈）
      if (t.charge > 0 && !t.active) {
        var progress = t.charge / CONFIG.FIELD.TURRET_CHARGE_TIME;
        var breathe = 1 + Math.sin(now * 6) * 0.06;
        var ringR = 48 * breathe;
        ctx.save();
        // 外环呼吸光晕
        ctx.beginPath();
        ctx.arc(sx, sy, ringR + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 207, 112, ' + (0.15 + 0.1 * Math.sin(now * 6)) + ')';
        ctx.lineWidth = 4;
        ctx.stroke();
        // 进度环
        ctx.beginPath();
        ctx.arc(sx, sy, ringR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.strokeStyle = CONFIG.COLORS.COIN;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();
        // 背景环
        ctx.beginPath();
        ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.restore();
      }

      // 炮塔本体
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy, 34, 0, Math.PI * 2);
      if (t.active) {
        ctx.fillStyle = CONFIG.COLORS.TURRET;
      } else if (t.cooldownTimer > 0) {
        ctx.fillStyle = CONFIG.COLORS.TURRET_SPENT;
      } else {
        // 待机：呼吸闪烁
        var pulse = 0.6 + 0.4 * Math.sin(now * 3);
        ctx.fillStyle = 'rgba(255, 207, 112, ' + pulse + ')';
      }
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = t.active ? CONFIG.COLORS.COIN :
        (t.cooldownTimer > 0 ? CONFIG.COLORS.META_CARD_BORDER : CONFIG.COLORS.COIN);
      ctx.stroke();
      ctx.fillStyle = CONFIG.COLORS.TEXT;
      ctx.font = 'bold 18px Arial, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var label = t.active ? Math.ceil(t.timer) + 's' :
        (t.cooldownTimer > 0 ? Math.ceil(t.cooldownTimer) + 's' : '!');
      ctx.fillText(label, sx, sy);
      ctx.restore();

      // 冷却进度环
      if (t.cooldownTimer > 0) {
        var cdProgress = 1 - t.cooldownTimer / CONFIG.FIELD.TURRET_COOLDOWN;
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, sy, 42, -Math.PI / 2, -Math.PI / 2 + cdProgress * Math.PI * 2);
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 炮弹
    for (var i = 0; i < this.shells.length; i++) {
      var s = this.shells[i];
      if (!s.active) continue;
      var p = s.t / CONFIG.FIELD.SHELL_FLIGHT;
      var cx = s.x + (s.tx - s.x) * p;
      var cy = s.y + (s.ty - s.y) * p - Math.sin(p * Math.PI) * 120;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx - Camera.x, cy - Camera.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.COLORS.SHELL;
      ctx.fill();
      ctx.restore();
    }

    // Boss 掉落拾取提示
    if (this.lootTimer > 0) {
      UI.drawCenteredText(ctx, CONFIG.TEXT.LOOT_NOTICE(this.lootTimer),
        360 + (CONFIG.UI.TOP_INSET || 0), 32, true, CONFIG.COLORS.COIN);
    }
  }
};

// ---------- 墙壁碰撞补丁 ----------
Field.collideWalls = function (x, y, r) {
  for (var i = 0; i < CONFIG.FIELD.WALLS.length; i++) {
    var w = CONFIG.FIELD.WALLS[i];
    if (x + r < w.x || x - r > w.x + w.w || y + r < w.y || y - r > w.y + w.h) continue;
    var cx = Math.max(w.x, Math.min(x, w.x + w.w));
    var cy = Math.max(w.y, Math.min(y, w.y + w.h));
    var dx = x - cx, dy = y - cy;
    var d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        var d = Math.sqrt(d2);
        x = cx + dx / d * r;
        y = cy + dy / d * r;
      } else {
        x = cx + r;
      }
    }
  }
  // #8 四角废墟（圆形不可通过障碍）
  var cornerR = CONFIG.BOUNDARY.CORNER_RUIN_RADIUS + r;
  var corners = [[0, 0], [CONFIG.WORLD.WIDTH, 0], [0, CONFIG.WORLD.HEIGHT], [CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT]];
  for (var c = 0; c < 4; c++) {
    var cdx = x - corners[c][0], cdy = y - corners[c][1];
    var cd2 = cdx * cdx + cdy * cdy;
    if (cd2 < cornerR * cornerR && cd2 > 0.0001) {
      var cd = Math.sqrt(cd2);
      x = corners[c][0] + cdx / cd * cornerR;
      y = corners[c][1] + cdy / cd * cornerR;
    }
  }
  return { x: x, y: y };
};

var oldPlayerUpdate = Player.update;
Player.update = function (dt) {
  oldPlayerUpdate.call(this, dt);
  var pos = Field.collideWalls(this.x, this.y, CONFIG.PLAYER.RADIUS);
  this.x = pos.x; this.y = pos.y;
};

var oldEnemyMove = Enemy.moveTowardPlayer;
Enemy.moveTowardPlayer = function (enemy, dt) {
  oldEnemyMove.call(this, enemy, dt);
  var pos = Field.collideWalls(enemy.x, enemy.y, enemy.radius);
  enemy.x = pos.x; enemy.y = pos.y;
};

// ---------- 道具掉落补丁（v008 #56：激光道具统一为「激光发射器」） ----------
var oldRollDrop = PowerUps.rollDrop;
PowerUps.rollDrop = function (x, y, enemyTypeIndex) {
  if (enemyTypeIndex === CONFIG.ENEMY.TYPE_ELITE) {
    for (var i = 0; i < CONFIG.FIELD.ELITE_ITEMS; i++) {
      this.drop(x + (Math.random() * 2 - 1) * CONFIG.FIELD.DROP_SPREAD,
        y + (Math.random() * 2 - 1) * CONFIG.FIELD.DROP_SPREAD,
        Math.random() < 0.35 ? CONFIG.POWERUPS.TYPE_LASER_EMITTER : this.rollType());
    }
    return;
  }
  if (enemyTypeIndex === CONFIG.ENEMY.TYPE_BOSS) {
    for (var i = 0; i < CONFIG.FIELD.BOSS_ITEMS; i++) {
      this.drop(x + (Math.random() * 2 - 1) * CONFIG.FIELD.DROP_SPREAD,
        y + (Math.random() * 2 - 1) * CONFIG.FIELD.DROP_SPREAD,
        i === 0 ? CONFIG.POWERUPS.TYPE_LASER_EMITTER : this.rollType());
    }
    return;
  }
  oldRollDrop.call(this, x, y, enemyTypeIndex);
};

// ---------- Boss 击败补丁（掉落安全拾取） ----------
var oldBossDefeated = BossSystem.onBossDefeated;
BossSystem.onBossDefeated = function () {
  if (this.defeated) return;
  Field.bossDefeated = true;
  Field.lootTimer = CONFIG.FIELD.LOOT_SECONDS;
  oldBossDefeated.call(this);
};

// ---------- 刷怪器补丁（Boss 出现后停止普通刷怪） ----------
var oldSpawnerUpdate = Spawner.update;
Spawner.update = function (dt, elapsedSeconds) {
  if (BossSystem.spawned && !Field.bossDefeated) return;
  oldSpawnerUpdate.call(this, dt, elapsedSeconds);
};

// ---------- Game 补丁 ----------
var oldFieldGameRestart = Game.restart;
Game.restart = function () {
  Field.reset();
  oldFieldGameRestart.call(this);
};

var oldUpdatePlaying = Game.updatePlaying;
Game.updatePlaying = function (dt) {
  oldUpdatePlaying.call(this, dt);
  if (this.state === CONFIG.GAME.STATE_PLAYING) {
    Field.update(dt);
  }
};

// ---------- UI 补丁（战场元素绘制 + 状态提示） ----------
var oldDrawHud = UI.drawHud;
UI.drawHud = function (ctx) {
  oldDrawHud.call(this, ctx);
  // 炮塔状态（v008 #56：激光状态提示随全屏激光一并下线）
  if (Field.turrets.some(function (t) { return t.active; })) {
    var activeTurrets = Field.turrets.filter(function (t) { return t.active; }).length;
    UI.drawCenteredText(ctx, CONFIG.TEXT.FIELD_STATUS(activeTurrets),
      180 + (CONFIG.UI.TOP_INSET || 0), 20, false, CONFIG.COLORS.COIN);
  }
};

var oldBossBar = UI.drawBossBar;
UI.drawBossBar = function (ctx, panelY) {
  var boss = Enemy.getActiveBoss();
  if (boss) Field.bossMax = Math.max(Field.bossMax, boss.maxHp);
  oldBossBar.call(this, ctx, panelY);
};

// 战场元素在敌人之后、玩家之前绘制（合并 effects.js 全部增强绘制）
// 使用模块唯一名称，避免 H5 全局 var 与 effects.js 的补丁变量互相覆盖。
var oldFieldGameDraw = Game.draw;
Game.draw = function () {
  ButtonUI.count = 0;

  // 暂停/设置/帮助面板
  if (Game.state === 'PAUSED' || Game.state === 'SETTINGS' || Game.state === 'HELP') {
    Platform.beginFrame();
    Panels.draw(CanvasView.ctx);
    if ((Game.state === 'PAUSED' ||
        ((Game.state === 'SETTINGS' || Game.state === 'HELP') && Panels.parent === 'PAUSED'))) {
      UI.drawBossBar(CanvasView.ctx, CONFIG.FIELD.BOSS_PANEL_Y);
    }
    Platform.endFrame();
    return;
  }

  // 独立顶层状态不绘制战场。即使故障来自某个战斗绘制函数，错误页也能稳定显示。
  if (Game.state === 'RUNTIME_ERROR' || Game.state === 'FATE' || Game.state === 'ACHIEVEMENTS') {
    Platform.beginFrame();
    if (Game.state === 'ACHIEVEMENTS' && root.V006) root.V006.draw(CanvasView.ctx);
    else if (root.V004) root.V004.draw(CanvasView.ctx);
    Ads.draw(CanvasView.ctx);
    Platform.endFrame();
    return;
  }

  if (this.state === CONFIG.GAME.STATE_MENU || this.state === CONFIG.GAME.STATE_BASE) {
    oldFieldGameDraw.call(this);
    return;
  }

  var ctx = CanvasView.ctx;
  var c = CONFIG.POLISH;
  Platform.beginFrame();
  UI.drawGround(ctx);
  Experience.draw(ctx);
  CoinDrops.draw(ctx);
  PowerUps.drawWorldItems(ctx);
  Field.draw(ctx);
  Extraction.draw(ctx);
  Enemy.draw(ctx);
  Enemy.drawBossProjectiles(ctx);
  LaserEmitter.draw(ctx);
  MortarStrike.draw(ctx);
  Weapons.draw(ctx);
  Player.draw(ctx);
  DamageText.draw(ctx);
  UI.drawHud(ctx);

  if (this.state === CONFIG.GAME.STATE_PLAYING) {
    UI.drawJoystick(ctx);
    UI.drawPowerUpButtons(ctx);
    UI.drawDashButton(ctx);
    UI.drawDashSpeedLines(ctx);
    UI.drawDashDirectionArrow(ctx);
    UI.drawExtractionButtons(ctx);
  } else if (this.state === CONFIG.GAME.STATE_LEVELUP) {
    UI.drawLevelUp(ctx);
  } else if (this.state === CONFIG.GAME.STATE_GAMEOVER) {
    UI.drawGameOver(ctx);
  } else if (this.state === CONFIG.GAME.STATE_VICTORY) {
    UI.drawVictory(ctx);
  }
  Ads.draw(ctx);

  // 战斗中暂停按钮
  if (!Ads.active && Game.state === CONFIG.GAME.STATE_PLAYING) {
    UI.drawActionButton(ctx, c.TOOL_X, c.TOOL_Y, c.TOOL_W, c.TOOL_H,
      CONFIG.TEXT.PAUSE, true, 25);
  }

  // 升级闪光
  if (FX.flash > 0 && Game.state === CONFIG.GAME.STATE_LEVELUP && !Ads.active) {
    ctx.save();
    ctx.globalAlpha = FX.flash / c.LEVEL_FLASH * 0.25;
    ctx.fillStyle = CONFIG.COLORS.FX_FLASH;
    ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
    ctx.restore();
  }
  if (FX.legendaryFlash > 0 && Game.state === CONFIG.GAME.STATE_LEVELUP && !Ads.active) {
    ctx.save(); ctx.globalAlpha = 0.15 * FX.legendaryFlash / 0.15;
    var rainbowFlash = ctx.createLinearGradient(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
    root.safeStop(rainbowFlash, 0, '#ff4d6d'); root.safeStop(rainbowFlash, 0.33, '#ffd43b');
    root.safeStop(rainbowFlash, 0.66, '#38d9a9'); root.safeStop(rainbowFlash, 1, '#748ffc');
    ctx.fillStyle = rainbowFlash; ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT); ctx.restore();
  }

  // 波次提示
  if (FX.notice > 0 && Game.state === CONFIG.GAME.STATE_PLAYING) {
    UI.drawCenteredText(ctx, CONFIG.TEXT.WAVE_NOTICE(FX.wave), 310 + (CONFIG.UI.TOP_INSET || 0), 30, true, CONFIG.COLORS.COIN);
  }

  // 撤退点激活提示
  if (Extraction.noticeTimer > 0 && Game.state === CONFIG.GAME.STATE_PLAYING) {
    UI.drawCenteredText(ctx, CONFIG.TEXT.EXTRACTION_READY, 360 + (CONFIG.UI.TOP_INSET || 0), 26, true, CONFIG.COLORS.EXTRACTION_ACTIVE_BORDER);
  }

  // 撤离动画覆盖层（最上层）
  Extraction.drawAnim(ctx);

  // 调试信息 + 存储警告
  if (!Ads.active) {
    Metrics.draw(ctx);
    if (Settings.storageFailed) {
      UI.drawCenteredText(ctx, CONFIG.TEXT.SAVE_WARNING, CONFIG.VIEW.HEIGHT - 104, 18, false, CONFIG.COLORS.COIN);
    }
  }

  // v004 顶层界面：命运抽牌与开发者控制台。
  if (root.V004) root.V004.draw(ctx);

  Platform.endFrame();
};

root.Field = Field;

// ---------- Extraction（波次撤退点） ----------
var Extraction = {
  state: 'inactive', // inactive/activating/activated/extractable/extracting/done
  activateTimer: 0, extractHoldTimer: 0, animTimer: 0,
  noticeTimer: 0, playerInZone: false,
  _lastWave: 0,

  reset: function () {
    this.state = 'inactive';
    this.activateTimer = 0; this.extractHoldTimer = 0; this.animTimer = 0;
    this.noticeTimer = 0; this.playerInZone = false; this._lastWave = 0;
  },

  isInZone: function () {
    var dx = root.Player.x - CONFIG.EXTRACTION.X, dy = root.Player.y - CONFIG.EXTRACTION.Y;
    var r = CONFIG.EXTRACTION.RADIUS;
    return dx * dx + dy * dy <= r * r;
  },

  // 波次推进 → activated 变 extractable
  notifyWave: function (waveIndex) {
    if (waveIndex > this._lastWave) {
      this._lastWave = waveIndex;
      this.setExtractable();
    }
  },

  update: function (dt) {
    if (this.state === 'extracting') {
      this.animTimer += dt;
      var total = CONFIG.EXTRACTION.FADE_DURATION + CONFIG.EXTRACTION.TEXT_DURATION;
      if (this.animTimer >= total) this._finish();
      return;
    }
    this.playerInZone = this.isInZone();

    if (this.state === 'activating') {
      if (this.playerInZone) {
        this.activateTimer += dt;
        if (this.activateTimer >= CONFIG.EXTRACTION.ACTIVATE_TIME) {
          this.state = 'activated';
          this.noticeTimer = 2;
        }
      }
      return;
    }
    if (this.state === 'activated') {
      if (this.noticeTimer > 0) this.noticeTimer = Math.max(0, this.noticeTimer - dt);
      return;
    }
    if (this.state === 'extractable') {
      if (this.playerInZone) {
        this.extractHoldTimer += dt;
        if (this.extractHoldTimer >= CONFIG.EXTRACTION.EXTRACT_HOLD_TIME) this.startExtraction();
      } else {
        this.extractHoldTimer = 0;
      }
    }
  },

  startActivation: function () {
    if (this.state === 'inactive' && this.playerInZone) {
      this.state = 'activating';
      this.activateTimer = 0;
    }
  },

  setExtractable: function () {
    if (this.state === 'activated') {
      this.state = 'extractable';
      this.extractHoldTimer = 0;
    }
  },

  startExtraction: function () {
    if (this.state !== 'extractable') return;
    this.state = 'extracting';
    this.animTimer = 0;
    root.Input.setMovementEnabled(false);
    root.Input.clearTap();
  },

  _finish: function () {
    this.state = 'done';
    root.Game.exitType = 'extract';
    root.RunStats.extractBonus = true;
    root.Game.state = CONFIG.GAME.STATE_GAMEOVER;
    root.Game.commitSettlement(false);
  },

  draw: function (ctx) {
    var sx = CONFIG.EXTRACTION.X - root.Camera.x;
    var sy = CONFIG.EXTRACTION.Y - root.Camera.y;
    var r = CONFIG.EXTRACTION.RADIUS;
    // 视野裁剪
    if (sx + r < 0 || sx - r > CONFIG.VIEW.WIDTH || sy + r < 0 || sy - r > CONFIG.VIEW.HEIGHT) return;

    ctx.save();
    var fillColor, borderColor, dash = [];
    if (this.state === 'inactive') {
      fillColor = CONFIG.COLORS.EXTRACTION_INACTIVE;
      borderColor = CONFIG.COLORS.EXTRACTION_INACTIVE_BORDER;
      dash = [8, 8];
    } else if (this.state === 'activating') {
      fillColor = CONFIG.COLORS.EXTRACTION_ACTIVATING;
      borderColor = CONFIG.COLORS.EXTRACTION_INACTIVE_BORDER;
    } else {
      fillColor = CONFIG.COLORS.EXTRACTION_ACTIVE;
      borderColor = CONFIG.COLORS.EXTRACTION_ACTIVE_BORDER;
    }
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = fillColor; ctx.fill();
    if (dash.length) ctx.setLineDash(dash);
    ctx.lineWidth = 3; ctx.strokeStyle = borderColor; ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (this.state === 'activating') {
      var remaining = Math.max(0, CONFIG.EXTRACTION.ACTIVATE_TIME - this.activateTimer);
      ctx.font = 'bold 28px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#ffcf70';
      ctx.fillText(this.playerInZone ? remaining.toFixed(1) + 's' : '暂停', sx, sy);
    } else if (this.state === 'activated') {
      ctx.font = 'bold 22px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#3ddd75';
      ctx.fillText('已激活', sx, sy);
    } else if (this.state === 'extractable') {
      ctx.font = 'bold 22px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#3ddd75';
      var holdR = this.playerInZone ? this.extractHoldTimer / CONFIG.EXTRACTION.EXTRACT_HOLD_TIME : 0;
      ctx.fillText(this.playerInZone ? '撤离中 ' + holdR.toFixed(1) + 's' : '进入撤离', sx, sy);
    } else if (this.state === 'inactive') {
      ctx.font = 'bold 18px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(66,165,255,0.7)';
      ctx.fillText('撤退点', sx, sy);
    }
    ctx.restore();
  },

  drawAnim: function (ctx) {
    if (this.state !== 'extracting') return;
    var t = this.animTimer;
    var fadeDur = CONFIG.EXTRACTION.FADE_DURATION;
    ctx.save();
    if (t < fadeDur) {
      ctx.globalAlpha = t / fadeDur;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
    } else {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
      var textAlpha = Math.min(1, (t - fadeDur) / 0.3);
      ctx.globalAlpha = textAlpha;
      ctx.font = 'bold 72px Arial, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#2fc966';
      ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 10;
      ctx.fillText(CONFIG.TEXT.EXTRACTION_SUCCESS, CONFIG.VIEW.WIDTH / 2, CONFIG.VIEW.HEIGHT / 2);
    }
    ctx.restore();
  }
};
root.Extraction = Extraction;

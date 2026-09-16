(function () {
  'use strict';

  // 战场：Field 地图炮塔、Extraction 撤退、BattleView 战斗绘制。
  var root = typeof window !== 'undefined' ? window : global;
  var CONFIG = root.CONFIG;
  var Field = {
    turrets: [],
    shells: [],
    bossMax: 0,
    lootTimer: 0,
    bossDefeated: false,
    reset: function () {
      root.MortarExplosionFX.reset();
      this.lootTimer = 0;
      this.bossDefeated = false;
      this.turrets.length = 0;
      for (var i = 0; i < CONFIG.FIELD.TURRETS.length; i++) {
        this.turrets.push({
          x: CONFIG.FIELD.TURRETS[i].x,
          y: CONFIG.FIELD.TURRETS[i].y,
          active: false,
          timer: 0,
          cooldown: 0,
          charge: 0,
          cooldownTimer: 0,
          aimAngle: -Math.PI / 2,
          targetAngle: -Math.PI / 2,
          recoil: 0,
          muzzleFlash: 0
        });
      }
      this.shells.length = 0;
      for (var i = 0; i < CONFIG.FIELD.SHELL_POOL; i++) {
        this.shells.push({
          active: false,
          x: 0,
          y: 0,
          tx: 0,
          ty: 0,
          t: 0,
          sx: 0,
          sy: 0,
          angle: 0
        });
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
          var dx = Player.x - t.x,
            dy = Player.y - t.y;
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
      for (var i = 0; i < this.shells.length; i++) {
        var s = this.shells[i];
        if (!s.active) continue;
        var f = Math.max(0, Math.min(1, s.t / CONFIG.FIELD.SHELL_FLIGHT)),
          x = s.x + (s.tx - s.x) * f,
          y = s.y + (s.ty - s.y) * f - Math.sin(f * Math.PI) * 120;
        if (root.WallCollision.inside(x, y, 10)) s.active = false;
      }
      for (var i = 0; i < this.turrets.length; i++) {
        var t = this.turrets[i];
        t.recoil = Math.max(0, (t.recoil || 0) - dt);
        t.muzzleFlash = Math.max(0, (t.muzzleFlash || 0) - dt);
        if (t.active) {
          var target = Enemy.findNearest(t.x, t.y);
          if (target) {
            t.targetAngle = Math.atan2(target.y - t.y, target.x - t.x);
            var delta = Math.atan2(Math.sin(t.targetAngle - t.aimAngle), Math.cos(t.targetAngle - t.aimAngle));
            t.aimAngle += delta * Math.min(1, dt * 7);
          }
        }
      }
      root.MortarExplosionFX.update(dt);
    },
    fireTurret: function (t) {
      var target = Enemy.findNearest(t.x, t.y);
      if (!target) return;
      var dx = target.x - t.x,
        dy = target.y - t.y,
        dist = Math.hypot(dx, dy);
      if (dist > CONFIG.FIELD.TURRET_RANGE) return;
      t.targetAngle = Math.atan2(dy, dx);
      t.aimAngle = t.targetAngle;
      t.recoil = .16;
      t.muzzleFlash = .12;
      var mx = t.x + Math.cos(t.aimAngle) * CONFIG.TURRET_VISUAL.TUBE_LENGTH,
        my = t.y + Math.sin(t.aimAngle) * CONFIG.TURRET_VISUAL.TUBE_LENGTH;
      for (var i = 0; i < this.shells.length; i++) {
        var s = this.shells[i];
        if (s.active) continue;
        s.active = true;
        s.x = mx;
        s.y = my;
        s.sx = mx;
        s.sy = my;
        s.tx = target.x;
        s.ty = target.y;
        s.t = 0;
        s.angle = t.aimAngle;
        return;
      }
    },
    explode: function (x, y) {
      var r = CONFIG.FIELD.SHELL_RADIUS;
      for (var i = 0; i < Enemy.pool.length; i++) {
        var e = Enemy.pool[i];
        if (!e.active) continue;
        var dx = e.x - x,
          dy = e.y - y;
        if (dx * dx + dy * dy <= r * r) {
          Combat.hitEnemy(e, CONFIG.FIELD.TURRET_DAMAGE, e.x, e.y);
        }
      }
      FX.burst(x, y);
      root.MortarExplosionFX.spawn(x, y);
    },
    pullLoot: function (dt) {
      var speed = CONFIG.FIELD.LOOT_PULL_SPEED;
      for (var i = 0; i < root.Experience.pool.length; i++) {
        var g = root.Experience.pool[i];
        if (!g.active) continue;
        var dx = Player.x - g.x,
          dy = Player.y - g.y;
        var d = Math.hypot(dx, dy);
        if (d > 0) {
          g.x += dx / d * speed * dt;
          g.y += dy / d * speed * dt;
        }
      }
      for (var i = 0; i < root.CoinDrops.pool.length; i++) {
        var c = root.CoinDrops.pool[i];
        if (!c.active) continue;
        var dx = Player.x - c.x,
          dy = Player.y - c.y;
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
        var rx = corners[ci][0] - Camera.x,
          ry = corners[ci][1] - Camera.y;
        if (rx + ruinR < -ruinR || rx - ruinR > CONFIG.VIEW.WIDTH + ruinR || ry + ruinR < -ruinR || ry - ruinR > CONFIG.VIEW.HEIGHT + ruinR) continue;
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
        var sx = w.x - Camera.x,
          sy = w.y - Camera.y;
        if (sx + w.w < 0 || sx > CONFIG.VIEW.WIDTH || sy + w.h < 0 || sy > CONFIG.VIEW.HEIGHT) continue;
        ctx.save();
        ctx.fillStyle = CONFIG.COLORS.WALL;
        ctx.fillRect(sx, sy, w.w, w.h);
        ctx.lineWidth = 5;
        ctx.strokeStyle = CONFIG.COLORS.WALL_EDGE;
        ctx.strokeRect(sx, sy, w.w, w.h);
        ctx.restore();
      }
      for (var i = 0; i < CONFIG.FIELD.WALLS.length; i++) {
        var w = CONFIG.FIELD.WALLS[i],
          x = w.x - Camera.x,
          y = w.y - Camera.y;
        if (x + w.w < 0 || y + w.h < 0 || x > CONFIG.VIEW.WIDTH || y > CONFIG.VIEW.HEIGHT) continue;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,.09)';
        ctx.fillRect(x + 6, y + 6, w.w - 12, Math.max(8, w.h * .18));
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.fillRect(x + 5, y + w.h * .72, w.w - 10, w.h * .23);
        if (w.kind === 'container') {
          ctx.strokeStyle = '#8d5f3c';
          ctx.lineWidth = 4;
          for (var k = 1; k < 5; k++) {
            ctx.beginPath();
            ctx.moveTo(x + w.w * k / 5, y + 8);
            ctx.lineTo(x + w.w * k / 5, y + w.h - 8);
            ctx.stroke();
          }
          ctx.fillStyle = '#d7a145';
          ctx.fillRect(x + 8, y + 8, 24, 8);
          ctx.fillRect(x + w.w - 32, y + w.h - 16, 24, 8);
        } else {
          ctx.strokeStyle = '#242321';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x + w.w * .2, y);
          ctx.lineTo(x + w.w * .32, y + w.h * .38);
          ctx.lineTo(x + w.w * .25, y + w.h);
          ctx.moveTo(x + w.w * .68, y);
          ctx.lineTo(x + w.w * .58, y + w.h * .55);
          ctx.lineTo(x + w.w * .76, y + w.h);
          ctx.stroke();
          if (w.kind === 'rubble') {
            ctx.fillStyle = '#6b6259';
            for (var n = 0; n < 4; n++) {
              ctx.beginPath();
              ctx.arc(x + 35 + n * (w.w - 70) / 3, y + w.h / 2 + (n % 2 ? 12 : -10), 12 + n % 3 * 4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        ctx.restore();
      }
      var baseImg = UI.icon('mortar_base'),
        tubeImg = UI.icon('mortar_tube'),
        shellImg = UI.icon('mortar_shell');
      // 素材组装覆盖旧圆形炮塔：底座固定，炮管以底部中心为轴旋转。
      for (var i = 0; i < this.turrets.length; i++) {
        var t = this.turrets[i],
          x = t.x - Camera.x,
          y = t.y - Camera.y;
        if (x < -120 || x > CONFIG.VIEW.WIDTH + 120 || y < -120 || y > CONFIG.VIEW.HEIGHT + 120) continue;
        if (!baseImg || !tubeImg) continue;
        ctx.save();
        ctx.drawImage(baseImg, x - CONFIG.TURRET_VISUAL.BASE_SIZE / 2, y - CONFIG.TURRET_VISUAL.BASE_SIZE / 2, CONFIG.TURRET_VISUAL.BASE_SIZE, CONFIG.TURRET_VISUAL.BASE_SIZE);
        ctx.translate(x, y);
        ctx.rotate((Number.isFinite(t.aimAngle) ? t.aimAngle : -Math.PI / 2) + Math.PI / 2);
        var recoil = (t.recoil || 0) > 0 ? 8 * (t.recoil / .16) : 0;
        ctx.drawImage(tubeImg, -CONFIG.TURRET_VISUAL.TUBE_SIZE / 2, -CONFIG.TURRET_VISUAL.TUBE_SIZE + recoil, CONFIG.TURRET_VISUAL.TUBE_SIZE, CONFIG.TURRET_VISUAL.TUBE_SIZE);
        if ((t.muzzleFlash || 0) > 0) {
          ctx.globalAlpha = t.muzzleFlash / .12;
          ctx.fillStyle = '#ffbd4a';
          ctx.shadowColor = '#ff7b24';
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(0, -CONFIG.TURRET_VISUAL.TUBE_LENGTH, 12, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      // 炮弹素材沿抛物线切线旋转；原点来自炮口。
      for (var s = 0; s < this.shells.length; s++) {
        var sh = this.shells[s];
        if (!sh.active || !shellImg) continue;
        var p = Math.max(0, Math.min(1, sh.t / CONFIG.FIELD.SHELL_FLIGHT)),
          x0 = sh.sx + (sh.tx - sh.sx) * p,
          y0 = sh.sy + (sh.ty - sh.sy) * p - Math.sin(p * Math.PI) * 120;
        var vx = sh.tx - sh.sx,
          vy = sh.ty - sh.sy - Math.cos(p * Math.PI) * 120 * Math.PI,
          ang = Math.atan2(vy, vx);
        ctx.save();
        ctx.translate(x0 - Camera.x, y0 - Camera.y);
        ctx.rotate(ang);
        ctx.drawImage(shellImg, -CONFIG.TURRET_VISUAL.SHELL_SIZE / 2, -CONFIG.TURRET_VISUAL.SHELL_SIZE / 2, CONFIG.TURRET_VISUAL.SHELL_SIZE, CONFIG.TURRET_VISUAL.SHELL_SIZE);
        ctx.restore();
      }
      root.MortarExplosionFX.draw(ctx);
      this.drawTurretStatus(ctx);
    },
    // 激活、剩余时长与冷却提示独立于迫击炮图片。
    drawTurretStatus: function (ctx) {
      // 炮塔
      for (var i = 0; i < this.turrets.length; i++) {
        var t = this.turrets[i];
        var sx = t.x - Camera.x,
          sy = t.y - Camera.y;
        if (sx < -120 || sx > CONFIG.VIEW.WIDTH + 120 || sy < -120 || sy > CONFIG.VIEW.HEIGHT + 120) continue;
        // 部分微信真机运行环境没有全局 performance，直接调用会让战斗首帧中断。
        // Date.now() 在微信小游戏与 H5 中都可用，因此作为安全兜底。
        var nowMs = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        var now = nowMs / 1000;

        // 激活范围圈（玩家靠近待机炮塔时显示）
        if (!t.active && t.cooldownTimer <= 0) {
          var pdx = Player.x - t.x,
            pdy = Player.y - t.y;
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

        // 激活时效环：完整圆表示刚激活，随剩余使用时间顺时针缩短。
        // 即使迫击炮图片加载失败，这个环也会照常绘制，便于手机上判断剩余时长。
        if (t.active) {
          var activeProgress = Math.max(0, Math.min(1, t.timer / CONFIG.FIELD.TURRET_DURATION));
          var activeRingR = 52;
          ctx.save();
          ctx.beginPath();
          ctx.arc(sx, sy, activeRingR, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.lineWidth = 7;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(sx, sy, activeRingR, -Math.PI / 2, -Math.PI / 2 + activeProgress * Math.PI * 2);
          ctx.strokeStyle = CONFIG.COLORS.COIN;
          ctx.lineWidth = 7;
          ctx.lineCap = 'round';
          ctx.shadowColor = CONFIG.COLORS.COIN;
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.restore();
        } else if (t.cooldownTimer > 0) {
          // 冷却环从空逐步恢复为整圈，颜色与激活环区分。
          var cooldownProgress = 1 - Math.max(0, Math.min(1, t.cooldownTimer / CONFIG.FIELD.TURRET_COOLDOWN));
          ctx.save();
          ctx.beginPath();
          ctx.arc(sx, sy, 48, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(sx, sy, 48, -Math.PI / 2, -Math.PI / 2 + cooldownProgress * Math.PI * 2);
          ctx.strokeStyle = 'rgba(150, 170, 180, 0.75)';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.restore();
        }
        ctx.save();
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = CONFIG.COLORS.COIN;
        ctx.fillText(t.active ? Math.ceil(t.timer) + 's' : t.cooldownTimer > 0 ? '冷却 ' + Math.ceil(t.cooldownTimer) + 's' : t.charge > 0 ? '充能中' : '靠近激活', sx, sy + 65);
        ctx.restore();
      }
    }
  };
  Field.collideWalls = function (x, y, r) {
    for (var i = 0; i < CONFIG.FIELD.WALLS.length; i++) {
      var w = CONFIG.FIELD.WALLS[i];
      if (x + r < w.x || x - r > w.x + w.w || y + r < w.y || y - r > w.y + w.h) continue;
      var cx = Math.max(w.x, Math.min(x, w.x + w.w));
      var cy = Math.max(w.y, Math.min(y, w.y + w.h));
      var dx = x - cx,
        dy = y - cy;
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
      var cdx = x - corners[c][0],
        cdy = y - corners[c][1];
      var cd2 = cdx * cdx + cdy * cdy;
      if (cd2 < cornerR * cornerR && cd2 > 0.0001) {
        var cd = Math.sqrt(cd2);
        x = corners[c][0] + cdx / cd * cornerR;
        y = corners[c][1] + cdy / cd * cornerR;
      }
    }
    return {
      x: x,
      y: y
    };
  };

  // 撤离点状态与绘制；战斗实体仍由各自 gameplay 模块维护。

  var Extraction = {
    state: 'inactive',
    // inactive/activating/activated/extractable/extracting/done
    activateTimer: 0,
    extractHoldTimer: 0,
    animTimer: 0,
    noticeTimer: 0,
    playerInZone: false,
    _lastWave: 0,
    reset: function () {
      this.state = 'inactive';
      this.activateTimer = 0;
      this.extractHoldTimer = 0;
      this.animTimer = 0;
      this.noticeTimer = 0;
      this.playerInZone = false;
      this._lastWave = 0;
    },
    isInZone: function () {
      var dx = root.Player.x - CONFIG.EXTRACTION.X,
        dy = root.Player.y - CONFIG.EXTRACTION.Y;
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
      var fillColor,
        borderColor,
        dash = [];
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
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();
      if (dash.length) ctx.setLineDash(dash);
      ctx.lineWidth = 3;
      ctx.strokeStyle = borderColor;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
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
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#2fc966';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.fillText(CONFIG.TEXT.EXTRACTION_SUCCESS, CONFIG.VIEW.WIDTH / 2, CONFIG.VIEW.HEIGHT / 2);
      }
      ctx.restore();
    }
  };
  root.Extraction = Extraction;
  root.Field = Field;
  root.Extraction = Extraction;

  // 由 Game.draw 在同一逻辑画布变换内调用，HUD 不接管整帧。
  root.BattleView = {
    draw: function () {
      var ctx = CanvasView.ctx;
      var c = CONFIG.POLISH;
      ctx.save();
      try {
        UI.applyWorldShake(ctx);
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
        FX.draw(ctx);
      } finally {
        ctx.restore();
      }
      UI.drawHud(ctx);
      if (Game.state === CONFIG.GAME.STATE_PLAYING) {
        UI.drawJoystick(ctx);
        UI.drawPowerUpButtons(ctx);
        UI.drawDashButton(ctx);
        if (!Ads.active) UI.drawPauseButton(ctx);
        UI.drawDashSpeedLines(ctx);
        UI.drawDashDirectionArrow(ctx);
        UI.drawExtractionButtons(ctx);
      } else if (Game.state === CONFIG.GAME.STATE_LEVELUP) {
        UI.drawLevelUp(ctx);
      } else if (Game.state === CONFIG.GAME.STATE_GAMEOVER) {
        UI.drawGameOver(ctx);
      } else if (Game.state === CONFIG.GAME.STATE_VICTORY) {
        UI.drawVictory(ctx);
      }
      Ads.draw(ctx);

      // 升级闪光
      if (FX.flash > 0 && Game.state === CONFIG.GAME.STATE_LEVELUP && !Ads.active) {
        ctx.save();
        ctx.globalAlpha = FX.flash / c.LEVEL_FLASH * 0.25;
        ctx.fillStyle = CONFIG.COLORS.FX_FLASH;
        ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
        ctx.restore();
      }
      if (FX.legendaryFlash > 0 && Game.state === CONFIG.GAME.STATE_LEVELUP && !Ads.active) {
        ctx.save();
        ctx.globalAlpha = 0.15 * FX.legendaryFlash / 0.15;
        var rainbowFlash = ctx.createLinearGradient(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
        root.safeStop(rainbowFlash, 0, '#ff4d6d');
        root.safeStop(rainbowFlash, 0.33, '#ffd43b');
        root.safeStop(rainbowFlash, 0.66, '#38d9a9');
        root.safeStop(rainbowFlash, 1, '#748ffc');
        ctx.fillStyle = rainbowFlash;
        ctx.fillRect(0, 0, CONFIG.VIEW.WIDTH, CONFIG.VIEW.HEIGHT);
        ctx.restore();
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

      // 顶层界面：命运抽牌与开发者控制台。
      if (root.MenuOverlay) root.MenuOverlay.draw(ctx);
    }
  };
})();

(function () {
  'use strict';

  // 战场：Field 地图炮塔、Extraction 撤退、BattleView 战斗绘制。
  var root = typeof window !== 'undefined' ? window : global;
  var CONFIG = root.CONFIG;
  var Field = {
    turrets: [],
    shells: [],
    frostOrbs: [],
    frostPatches: [],
    layoutIndex: 0,
    bossMax: 0,
    lootTimer: 0,
    bossDefeated: false,
    eventBanner: '',
    eventBannerTimer: 0,
    applyLayout: function (index) {
      var layouts = CONFIG.FIELD.LAYOUTS;
      this.layoutIndex = ((index % layouts.length) + layouts.length) % layouts.length;
      var layout = layouts[this.layoutIndex];
      CONFIG.FIELD.WALLS = layout.walls;
      CONFIG.FIELD.TURRETS = layout.turrets;
      CONFIG.EXTRACTION.X = layout.extract.x;
      CONFIG.EXTRACTION.Y = layout.extract.y;
      CONFIG.EXTRACTION.RADIUS = layout.extract.r;
      return layout;
    },
    gadgetAmt: function (kind, id) {
      if (!root.Meta || !Meta.getGadgetLevel) return 0;
      var lv = Meta.getGadgetLevel('turret_' + kind, id);
      var def = Meta.getGadgetDef && Meta.getGadgetDef('turret_' + kind, id);
      return lv * (def && def.AMOUNT || 0);
    },
    kindStats: function (kind) {
      var k = CONFIG.TURRETS.KINDS[kind] || CONFIG.TURRETS.KINDS.mortar;
      if (kind === 'tesla') {
        return {
          interval: k.INTERVAL * Math.max(0.4, 1 - this.gadgetAmt('tesla', 'rate')),
          range: k.RANGE + this.gadgetAmt('tesla', 'range'),
          damage: k.DAMAGE * (1 + this.gadgetAmt('tesla', 'dmg')),
          chain: k.CHAIN + this.gadgetAmt('tesla', 'chain'),
          chainRange: k.CHAIN_RANGE,
          falloff: k.FALLOFF,
          stun: k.STUN,
          storm: this.gadgetAmt('tesla', 'storm')
        };
      }
      if (kind === 'frost') {
        return {
          interval: k.INTERVAL,
          range: k.RANGE,
          damage: k.DAMAGE * (1 + this.gadgetAmt('frost', 'damage')),
          orbSpeed: k.ORB_SPEED,
          patchR: k.PATCH_RADIUS + this.gadgetAmt('frost', 'patch'),
          patchLife: k.PATCH_LIFE + this.gadgetAmt('frost', 'duration'),
          slow: Math.max(0.15, k.SLOW - this.gadgetAmt('frost', 'slow')),
          freeze: k.FREEZE,
          shatter: this.gadgetAmt('frost', 'shatter')
        };
      }
      return {
        interval: k.INTERVAL,
        range: k.RANGE,
        damage: k.DAMAGE * (1 + this.gadgetAmt('mortar', 'damage')),
        radius: (CONFIG.FIELD.SHELL_RADIUS || k.RADIUS) + this.gadgetAmt('mortar', 'radius'),
        extra: this.gadgetAmt('mortar', 'count') + (Meta.getGadgetLevel && Meta.getGadgetLevel('turret_mortar', 'fullcover') > 0 ? CONFIG.MORTAR.FULLCOVER_EXTRA : 0),
        burn: this.gadgetAmt('mortar', 'burn')
      };
    },
    reset: function () {
      root.MortarExplosionFX.reset();
      if (root.TeslaArcFX) root.TeslaArcFX.reset();
      if (root.FrostPatchFX) root.FrostPatchFX.reset();
      this.lootTimer = 0;
      this.bossDefeated = false;
      this.eventBanner = '';
      this.eventBannerTimer = 0;
      // v012 #75 选图系统：开局按玩家所选地图（Meta.data.selectedMap）加载，不再随 runs 自动轮换。
      var selMap = root.Meta && Meta.data && Number.isInteger(Meta.data.selectedMap) ? Meta.data.selectedMap : 0;
      // 兜底：选中图若因存档损坏被锁死，退回第 0 张。
      if (root.Meta && Meta.isMapUnlocked && !Meta.isMapUnlocked(selMap)) selMap = 0;
      var layout = this.applyLayout(selMap);
      this.turrets.length = 0;
      for (var i = 0; i < layout.turrets.length; i++) {
        this.turrets.push({
          x: layout.turrets[i].x,
          y: layout.turrets[i].y,
          kind: layout.turrets[i].kind || 'mortar',
          active: false,
          timer: 0,
          cooldown: 0,
          charge: 0,
          cooldownTimer: 0,
          noGoldCd: 0,
          aimAngle: -Math.PI / 2,
          targetAngle: -Math.PI / 2,
          recoil: 0,
          muzzleFlash: 0,
          shotCount: 0
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
          angle: 0,
          kind: 'mortar'
        });
      }
      this.frostOrbs.length = 0;
      for (var i = 0; i < CONFIG.TURRETS.KINDS.frost.POOL_ORBS; i++) {
        this.frostOrbs.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, damage: 0 });
      }
      this.frostPatches.length = 0;
      for (var i = 0; i < CONFIG.TURRETS.KINDS.frost.POOL_PATCHES; i++) {
        this.frostPatches.push({ active: false, x: 0, y: 0, r: 0, t: 0, life: 0, slow: 0.45, freeze: 0.4, id: i + 1 });
      }
    },
    update: function (dt) {
      for (var i = 0; i < this.turrets.length; i++) {
        var t = this.turrets[i];
        var stats = this.kindStats(t.kind);
        if (t.active) {
          if (!t.endingNotified && t.timer <= CONFIG.PRODUCT.TURRET_WARNING) {
            t.endingNotified = true;
            AudioFX.play('warning');
          }
          t.timer -= dt;
          if (t.timer <= 0) {
            t.active = false;
            t.cooldownTimer = CONFIG.FIELD.TURRET_COOLDOWN;
            continue;
          }
          t.cooldown -= dt;
          if (t.cooldown <= 0) {
            t.cooldown = stats.interval;
            this.fireTurret(t);
          }
        } else if (t.cooldownTimer > 0) {
          t.cooldownTimer -= dt;
          if (t.cooldownTimer < 0) t.cooldownTimer = 0;
        } else {
          var dx = Player.x - t.x,
            dy = Player.y - t.y;
          var inRange = dx * dx + dy * dy <= CONFIG.FIELD.TURRET_ACTIVATE_RADIUS * CONFIG.FIELD.TURRET_ACTIVATE_RADIUS;
          if (inRange) {
            t.charge += dt;
            if (t.charge >= CONFIG.FIELD.TURRET_CHARGE_TIME) {
              // v013 #80：充能满必须立即激活，不再因金币不足而把 charge 清零、反复充能。
              t.active = true;
              t.timer = CONFIG.FIELD.TURRET_DURATION;
              t.cooldown = 0;
              t.charge = 0;
              t.endingNotified = false;
              AudioFX.play('turret');
              Meta.showToast(CONFIG.TEXT.PRODUCT.TURRETS[t.kind] + ' · ' + CONFIG.TEXT.PRODUCT.ACTIVE);
              FX.burst(t.x, t.y);
              if (root.Achievements) root.Achievements.add('turretOn', 1);
              // 金币作为附加消耗：有余钱则扣，余额不足也照常激活，绝不卡激活。
              root.RunStats.spendGold(CONFIG.TURRETS.ACTIVATE_COST);
            }
          } else {
            if (t.charge > 0) t.charge = Math.max(0, t.charge - dt * 2);
          }
          if (t.noGoldCd > 0) t.noGoldCd = Math.max(0, t.noGoldCd - dt);
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
      this.updateFrost(dt);
      this.applyFrostControl();
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
      if (root.TeslaArcFX) root.TeslaArcFX.update(dt);
      if (root.FrostPatchFX) root.FrostPatchFX.update(dt);
      this.eventBannerTimer = Math.max(0, this.eventBannerTimer - dt);
    },
    fireTurret: function (t) {
      if (t.kind === 'tesla') return this.fireTesla(t);
      if (t.kind === 'frost') return this.fireFrost(t);
      return this.fireMortar(t);
    },
    fireMortar: function (t) {
      var stats = this.kindStats('mortar');
      var extra = stats.extra || 0;
      var shots = 1 + extra;
      var used = {};
      for (var n = 0; n < shots; n++) {
        var target = this.pickMortarTarget(t, stats.range, extra > 0, used);
        if (!target) break;
        used[target.spawnId] = true;
        t.targetAngle = Math.atan2(target.y - t.y, target.x - t.x);
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
          s.kind = 'mortar';
          break;
        }
      }
    },
    pickMortarTarget: function (t, range, preferElite, used) {
      var best = null, bestScore = 1e15;
      for (var i = 0; i < Enemy.pool.length; i++) {
        var e = Enemy.pool[i];
        if (!e.active || used[e.spawnId]) continue;
        var d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d > range) continue;
        var score = d;
        if (preferElite && (e.typeIndex >= CONFIG.ENEMY.TYPE_ELITE)) score -= 400;
        if (score < bestScore) {
          bestScore = score;
          best = e;
        }
      }
      return best;
    },
    fireTesla: function (t) {
      var stats = this.kindStats('tesla');
      var first = null, firstD = 1e15;
      for (var i = 0; i < Enemy.pool.length; i++) {
        var e = Enemy.pool[i];
        if (!e.active) continue;
        var d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d > stats.range + e.radius) continue;
        if (root.WallCollision.segment(t.x, t.y, e.x, e.y, 4)) continue;
        if (d < firstD) {
          firstD = d;
          first = e;
        }
      }
      if (!first) return;
      t.aimAngle = Math.atan2(first.y - t.y, first.x - t.x);
      t.recoil = .1;
      t.muzzleFlash = .1;
      t.shotCount = (t.shotCount || 0) + 1;
      var hits = [first];
      var last = first;
      var hops = Math.max(1, Math.floor(stats.chain));
      for (var h = 1; h < hops; h++) {
        var nxt = null, nd = 1e15;
        for (var j = 0; j < Enemy.pool.length; j++) {
          var e2 = Enemy.pool[j];
          if (!e2.active) continue;
          var already = false;
          for (var k = 0; k < hits.length; k++) if (hits[k] === e2) already = true;
          if (already) continue;
          var d2 = Math.hypot(e2.x - last.x, e2.y - last.y);
          if (d2 > stats.chainRange) continue;
          if (d2 < nd) {
            nd = d2;
            nxt = e2;
          }
        }
        if (!nxt) break;
        hits.push(nxt);
        last = nxt;
      }
      var src = Combat.killSource;
      Combat.killSource = 'tesla';
      var dmg = stats.damage;
      for (var h = 0; h < hits.length; h++) {
        Combat.hitEnemy(hits[h], dmg, hits[h].x, hits[h].y);
        if (h === 0) hits[h].stunTimer = Math.max(hits[h].stunTimer || 0, stats.stun);
        dmg *= stats.falloff;
        var from = h === 0 ? t : hits[h - 1];
        if (root.TeslaArcFX) root.TeslaArcFX.spawn(from.x, from.y, hits[h].x, hits[h].y);
      }
      if (stats.storm > 0 && t.shotCount % CONFIG.TURRETS.KINDS.tesla.STORM_EVERY === 0) {
        var sr = stats.storm;
        for (var i = 0; i < Enemy.pool.length; i++) {
          var e = Enemy.pool[i];
          if (!e.active) continue;
          var dx = e.x - first.x, dy = e.y - first.y;
          if (dx * dx + dy * dy <= sr * sr) Combat.hitEnemy(e, stats.damage, e.x, e.y);
        }
      }
      Combat.killSource = src;
    },
    fireFrost: function (t) {
      var stats = this.kindStats('frost');
      var target = Enemy.findNearest(t.x, t.y);
      if (!target) return;
      var dist = Math.hypot(target.x - t.x, target.y - t.y);
      if (dist > stats.range) return;
      t.aimAngle = Math.atan2(target.y - t.y, target.x - t.x);
      t.recoil = .12;
      t.muzzleFlash = .1;
      for (var i = 0; i < this.frostOrbs.length; i++) {
        var o = this.frostOrbs[i];
        if (o.active) continue;
        o.active = true;
        o.x = t.x;
        o.y = t.y;
        var a = t.aimAngle;
        o.vx = Math.cos(a) * stats.orbSpeed;
        o.vy = Math.sin(a) * stats.orbSpeed;
        o.tx = target.x;
        o.ty = target.y;
        o.damage = stats.damage;
        o.shatter = stats.shatter;
        o.patchR = stats.patchR;
        o.patchLife = stats.patchLife;
        o.slow = stats.slow;
        o.freeze = stats.freeze;
        return;
      }
    },
    updateFrost: function (dt) {
      for (var i = 0; i < this.frostOrbs.length; i++) {
        var o = this.frostOrbs[i];
        if (!o.active) continue;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        var hit = false;
        for (var j = 0; j < Enemy.pool.length; j++) {
          var e = Enemy.pool[j];
          if (!e.active) continue;
          var dx = e.x - o.x, dy = e.y - o.y, r = e.radius + 10;
          if (dx * dx + dy * dy <= r * r) {
            var src = Combat.killSource;
            Combat.killSource = 'frost';
            Combat.hitEnemy(e, o.damage * ((e.freezeTimer > 0 || PowerUps.isFrozen()) ? 1 + o.shatter : 1), e.x, e.y);
            Combat.killSource = src;
            this.spawnFrostPatch(o.x, o.y, o);
            hit = true;
            break;
          }
        }
        if (hit) {
          o.active = false;
          continue;
        }
        if (root.WallCollision.inside(o.x, o.y, 8) || o.x < 0 || o.y < 0 || o.x > CONFIG.WORLD.WIDTH || o.y > CONFIG.WORLD.HEIGHT) {
          this.spawnFrostPatch(o.x, o.y, o);
          o.active = false;
        }
      }
      for (var i = 0; i < this.frostPatches.length; i++) {
        var p = this.frostPatches[i];
        if (!p.active) continue;
        p.t += dt;
        if (p.t >= p.life) p.active = false;
      }
    },
    spawnFrostPatch: function (x, y, orb) {
      for (var i = 0; i < this.frostPatches.length; i++) {
        var p = this.frostPatches[i];
        if (p.active) continue;
        p.active = true;
        p.x = x;
        p.y = y;
        p.r = orb.patchR;
        p.t = 0;
        p.life = orb.patchLife;
        p.slow = orb.slow;
        p.freeze = orb.freeze;
        p.id = (p.id || i + 1) + 17;
        if (root.FrostPatchFX) root.FrostPatchFX.spawn(x, y, p.r, p.life);
        return;
      }
    },
    applyFrostControl: function () {
      for (var i = 0; i < Enemy.pool.length; i++) {
        var e = Enemy.pool[i];
        if (!e.active) continue;
        var inPatch = false;
        for (var j = 0; j < this.frostPatches.length; j++) {
          var p = this.frostPatches[j];
          if (!p.active) continue;
          var dx = e.x - p.x, dy = e.y - p.y;
          if (dx * dx + dy * dy <= (p.r + e.radius) * (p.r + e.radius)) {
            inPatch = true;
            e.slowMul = p.slow;
            e.frostTouched = e.frostTouched || {};
            if (!e.frostTouched[p.id]) {
              e.frostTouched[p.id] = 1;
              e.freezeTimer = Math.max(e.freezeTimer || 0, p.freeze);
            }
          }
        }
        if (!inPatch) e.slowMul = 1;
      }
    },
    explode: function (x, y) {
      var stats = this.kindStats('mortar');
      var r = stats.radius;
      var src = Combat.killSource;
      Combat.killSource = 'mortar';
      for (var i = 0; i < Enemy.pool.length; i++) {
        var e = Enemy.pool[i];
        if (!e.active) continue;
        var dx = e.x - x,
          dy = e.y - y;
        if (dx * dx + dy * dy <= r * r) {
          Combat.hitEnemy(e, stats.damage, e.x, e.y);
          if (e.active && stats.burn > 0) Enemy.applyMortarBurn(e, stats.damage * stats.burn);
        }
      }
      Combat.killSource = src;
      FX.burst(x, y);
      root.MortarExplosionFX.spawn(x, y);
    },
    activateNearestReady: function () {
      var best = null, bestD = 1e15;
      for (var i = 0; i < this.turrets.length; i++) {
        var t = this.turrets[i];
        if (t.active || t.cooldownTimer > 0) continue;
        var d = (Player.x - t.x) * (Player.x - t.x) + (Player.y - t.y) * (Player.y - t.y);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
      if (!best) return false;
      best.active = true;
      best.timer = CONFIG.FIELD.TURRET_DURATION;
      best.cooldown = 0;
      best.charge = 0;
      best.endingNotified = false;
      AudioFX.play('turret');
      FX.burst(best.x, best.y);
      if (root.Achievements) root.Achievements.add('turretOn', 1);
      return true;
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
    // 在玩家前方的高墙局部半透明盖回角色，关键危险预警仍在此层之后绘制。
    drawPlayerOcclusion: function (ctx) {
      var c=CONFIG.CHARACTER.OCCLUSION;
      for(var i=0;i<CONFIG.FIELD.WALLS.length;i++) {
        var w=CONFIG.FIELD.WALLS[i];
        if(Player.x<w.x-36 || Player.x>w.x+w.w+36 || Player.y>w.y || Player.y<w.y-c.RISE)continue;
        ctx.save();ctx.globalAlpha=c.ALPHA;ctx.fillStyle=c.COLOR;
        ctx.fillRect(w.x-Camera.x,w.y-Camera.y-c.RISE,w.w,c.RISE);
        ctx.strokeStyle=c.EDGE;ctx.lineWidth=2;ctx.strokeRect(w.x-Camera.x,w.y-Camera.y-c.RISE,w.w,c.RISE);
        ctx.restore();
      }
    },
    draw: function (ctx) {
      var renderQuality = root.Settings && root.Settings.getQuality ? root.Settings.getQuality() : CONFIG.RENDER_QUALITY.LEVELS.high;
      // #8 四角废墟装饰（视野裁剪）
      var ruinR = CONFIG.BOUNDARY.CORNER_RUIN_RADIUS;
      var corners = [[0, 0], [CONFIG.WORLD.WIDTH, 0], [0, CONFIG.WORLD.HEIGHT], [CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT]];
      for (var ci = 0; ci < 4; ci++) {
        if (renderQuality.DECOR === 0 || renderQuality.DECOR < 1 && ci % 2) continue;
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
        ctx.fillStyle=CONFIG.CHARACTER.OCCLUSION.COLOR;
        ctx.fillRect(sx,sy-CONFIG.CHARACTER.OCCLUSION.RISE,w.w,CONFIG.CHARACTER.OCCLUSION.RISE);
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
      this.drawFrostPatches(ctx);
      for (var i = 0; i < this.turrets.length; i++) {
        var t = this.turrets[i],
          x = t.x - Camera.x,
          y = t.y - Camera.y;
        if (x < -120 || x > CONFIG.VIEW.WIDTH + 120 || y < -120 || y > CONFIG.VIEW.HEIGHT + 120) continue;
        if (t.kind === 'tesla') this.drawTeslaTurret(ctx, t, x, y);
        else if (t.kind === 'frost') this.drawFrostTurret(ctx, t, x, y);
        else {
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
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(0, -CONFIG.TURRET_VISUAL.TUBE_LENGTH, 12, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }
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
      this.drawFrostOrbs(ctx);
      root.MortarExplosionFX.draw(ctx);
      if (root.TeslaArcFX) root.TeslaArcFX.draw(ctx);
      if (root.FrostPatchFX) root.FrostPatchFX.draw(ctx);
      this.drawTurretStatus(ctx);
    },
    // 边缘箭头避开HUD与操作区；同时最多提示两座附近设施。
    drawDirections: function (ctx) {
      var cfg = CONFIG.PRODUCT, shown = 0;
      ctx.save(); ctx.textAlign = 'center'; ctx.font = cfg.PREVIEW_SIZE + 'px Arial';
      for (var i = 0; i < this.turrets.length && shown < cfg.GUIDE_LIMIT; i++) {
        var t = this.turrets[i];
        if (t.active || t.cooldownTimer > 0 || Math.hypot(t.x - Player.x, t.y - Player.y) > cfg.GUIDE_RANGE) continue;
        var x = Camera.worldToScreenX(t.x), y = Camera.worldToScreenY(t.y);
        if (x > cfg.GUIDE_MARGIN && x < CONFIG.VIEW.WIDTH - cfg.GUIDE_MARGIN && y > cfg.GUIDE_TOP && y < CONFIG.VIEW.HEIGHT - cfg.GUIDE_BOTTOM) continue;
        var cx = CONFIG.VIEW.WIDTH / 2, cy = CONFIG.VIEW.HEIGHT / 2, dx = x - cx, dy = y - cy;
        var tx = Math.abs(dx) > .001 ? (CONFIG.VIEW.WIDTH / 2 - cfg.GUIDE_MARGIN) / Math.abs(dx) : Infinity;
        var ty = Math.abs(dy) > .001 ? (CONFIG.VIEW.HEIGHT / 2 - Math.max(cfg.GUIDE_TOP, cfg.GUIDE_BOTTOM)) / Math.abs(dy) : Infinity;
        var edgeScale = Math.min(tx, ty), px = cx + dx * edgeScale, py = cy + dy * edgeScale;
        ctx.fillStyle = CONFIG.COLORS.COIN;
        ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(y - py, x - px));
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-9, -9); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fill(); ctx.restore();
        var guideIcon = UI.icon(t.kind === 'tesla' ? 'tower_arc' : t.kind === 'frost' ? 'tower_freeze' : 'mortar_base');
        var labelX = Math.max(100, Math.min(CONFIG.VIEW.WIDTH - 100, px));
        if (guideIcon) ctx.drawImage(guideIcon, labelX - 18, py + 10, 36, 36);
        ctx.fillText(CONFIG.TEXT.PRODUCT.TURRETS[t.kind], labelX, py + (guideIcon ? 60 : 30));
        shown++;
      }
      ctx.restore();
    },
    drawTeslaTurret: function (ctx, t, x, y) {
      var base = UI.icon('tower_arc_base');
      var tube = UI.icon('tower_arc_tube');
      var zap = UI.icon('tower_arc_zap');
      var full = UI.icon('tower_arc');
      ctx.save();
      ctx.translate(x, y);
      if (!t.active) ctx.globalAlpha = 0.72;
      if (base && tube) {
        ctx.drawImage(base, -46, -46, 92, 92);
        ctx.rotate((Number.isFinite(t.aimAngle) ? t.aimAngle : -Math.PI / 2) + Math.PI / 2);
        ctx.drawImage(tube, -43, -43, 86, 86);
        if (zap && (t.active || (t.muzzleFlash || 0) > 0)) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, 0.42 + (t.muzzleFlash || 0) / .12 * 0.58);
          ctx.drawImage(zap, -48, -48, 96, 96);
          ctx.restore();
        }
      } else if (full) {
        ctx.drawImage(full, -48, -48, 96, 96);
      } else {
        ctx.fillStyle = t.active ? '#493078' : '#2a3233';
        ctx.strokeStyle = t.active ? CONFIG.COLORS.TESLA : '#6d716e';
        ctx.lineWidth = 4;
        ctx.fillRect(-28, -28, 56, 56);
        ctx.strokeRect(-28, -28, 56, 56);
      }
      ctx.restore();
    },
    drawFrostTurret: function (ctx, t, x, y) {
      var base = UI.icon('tower_freeze_base');
      var tube = UI.icon('tower_freeze_tube');
      var ice = UI.icon('tower_freeze_ice');
      var full = UI.icon('tower_freeze');
      ctx.save();
      ctx.translate(x, y);
      if (!t.active) ctx.globalAlpha = 0.72;
      if (base && tube) {
        ctx.drawImage(base, -46, -46, 92, 92);
        ctx.rotate((Number.isFinite(t.aimAngle) ? t.aimAngle : -Math.PI / 2) + Math.PI / 2);
        ctx.drawImage(tube, -43, -43, 86, 86);
        if (ice && (t.active || (t.muzzleFlash || 0) > 0)) {
          ctx.save();
          ctx.globalAlpha = Math.min(0.9, 0.34 + (t.muzzleFlash || 0) / .12 * 0.5);
          ctx.drawImage(ice, -47, -47, 94, 94);
          ctx.restore();
        }
      } else if (full) {
        ctx.drawImage(full, -48, -48, 96, 96);
      } else {
        ctx.fillStyle = t.active ? '#22617a' : '#243038';
        ctx.strokeStyle = t.active ? CONFIG.COLORS.FROST : '#6d716e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    },
    drawFrostPatches: function (ctx) {
      for (var i = 0; i < this.frostPatches.length; i++) {
        var p = this.frostPatches[i];
        if (!p.active) continue;
        var x = p.x - Camera.x, y = p.y - Camera.y;
        ctx.save();
        ctx.globalAlpha = 0.35 * (1 - p.t / p.life);
        ctx.fillStyle = '#7eb7d8';
        ctx.beginPath();
        ctx.ellipse(x, y, p.r, p.r * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#cfefff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    },
    drawFrostOrbs: function (ctx) {
      for (var i = 0; i < this.frostOrbs.length; i++) {
        var o = this.frostOrbs[i];
        if (!o.active) continue;
        ctx.save();
        ctx.fillStyle = '#d8f4ff';
        ctx.shadowColor = '#8eb4d4';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(o.x - Camera.x, o.y - Camera.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
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
          ctx.shadowBlur = 0;
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
        ctx.fillText(CONFIG.TEXT.PRODUCT.TURRETS[t.kind], sx, sy - 70);
        ctx.fillText(t.active ? (t.timer <= CONFIG.PRODUCT.TURRET_WARNING ? CONFIG.TEXT.PRODUCT.ENDING : CONFIG.TEXT.PRODUCT.ACTIVE) + ' ' + Math.ceil(t.timer) + 's' : t.cooldownTimer > 0 ? '冷却 ' + Math.ceil(t.cooldownTimer) + 's' : t.charge > 0 ? '充能 ' + Math.ceil(t.charge / CONFIG.FIELD.TURRET_CHARGE_TIME * 100) + '%' : CONFIG.TEXT.PRODUCT.READY + ' · ' + CONFIG.TURRETS.ACTIVATE_COST + ' 金币', sx, sy + 65);
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
    // v012 #73 状态机：hidden(未出现) → inactive(每 WAVE_EVERY 波出现可激活) → activating → activated(难度惩罚) → extractable(下一波可撤离) → extracting → done
    state: 'hidden',
    activateTimer: 0,
    extractHoldTimer: 0,
    animTimer: 0,
    noticeTimer: 0,
    playerInZone: false,
    _lastWave: 0,
    activatedWave: 0,
    _difficultyApplied: false,
    blockedNoticeTimer: 0,
    reset: function () {
      this.state = 'hidden';
      this.activateTimer = 0;
      this.extractHoldTimer = 0;
      this.animTimer = 0;
      this.noticeTimer = 0;
      this.playerInZone = false;
      this._lastWave = 0;
      this.activatedWave = 0;
      this._difficultyApplied = false;
      this.blockedNoticeTimer = 0;
    },
    isInZone: function () {
      var dx = root.Player.x - CONFIG.EXTRACTION.X,
        dy = root.Player.y - CONFIG.EXTRACTION.Y;
      var r = CONFIG.EXTRACTION.RADIUS;
      return dx * dx + dy * dy <= r * r;
    },
    // v012 #73：每 WAVE_EVERY 波出现撤离点(可激活)；激活后下一波推进才变 extractable。
    notifyWave: function (waveIndex) {
      if (waveIndex <= this._lastWave) return;
      this._lastWave = waveIndex;
      var every = CONFIG.EXTRACTION.WAVE_EVERY;
      // 到点才出现；若已进入激活/撤离窗口则不打断。
      if (waveIndex % every === 0 && waveIndex > 0 && this.state === 'hidden') {
        this.state = 'inactive';
        this.activateTimer = 0;
      }
      // 激活后下一波即可撤离。
      if (this.state === 'activated' && waveIndex > this.activatedWave) {
        this.state = 'extractable';
        this.extractHoldTimer = 0;
      }
    },
    update: function (dt) {
      this.blockedNoticeTimer = Math.max(0, this.blockedNoticeTimer - dt);
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
            // v012 #73：记录激活波次（下一波才 extractable），并施加难度惩罚（移速×1.5 / 刷怪配额×2）。
            this.activatedWave = root.Spawner.waveIndex;
            this._applyDifficulty();
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
          var waveClear = root.Enemy.activeCount === 0 && root.Spawner.waveQuota <= 0 && root.Spawner.eliteQuota <= 0;
          if (!waveClear) {
            this.extractHoldTimer = 0;
            if (this.blockedNoticeTimer <= 0) { root.Meta.showToast(CONFIG.TEXT.EXTRACTION_CLEAR_FIRST); this.blockedNoticeTimer = 1.5; }
            return;
          }
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
    // v012 #73 激活后难度惩罚：敌人移速 ×SPEED_PENALTY（叠在 enemySpeedMultiplier 上，与减速词缀乘法兼容），刷怪配额 ×SPAWN_QUOTA_MULT。
    // 只施加一次；本局结束随重置清除（Player.reset 置 1、Spawner.extractionSurge 置 false）。
    _applyDifficulty: function () {
      if (this._difficultyApplied) return;
      this._difficultyApplied = true;
      root.Player.enemySpeedMultiplier *= CONFIG.EXTRACTION.SPEED_PENALTY;
      root.Spawner.extractionSurge = true;
    },
    setExtractable: function () {
      if (this.state === 'activated') {
        this.state = 'extractable';
        this.extractHoldTimer = 0;
      }
    },
    startExtraction: function () {
      if (this.state !== 'extractable') return;
      if (root.Enemy.activeCount > 0 || root.Spawner.waveQuota > 0 || root.Spawner.eliteQuota > 0) {
        root.Meta.showToast(CONFIG.TEXT.EXTRACTION_CLEAR_FIRST);
        return;
      }
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
      // v012 #73：未到点（hidden）不绘制撤离点。
      if (this.state === 'hidden') return;
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
        ctx.shadowBlur = 0;
        ctx.fillText(CONFIG.TEXT.EXTRACTION_SUCCESS, CONFIG.VIEW.WIDTH / 2, CONFIG.VIEW.HEIGHT / 2);
      }
      ctx.restore();
    }
  };
  root.Extraction = Extraction;
  root.Field = Field;
  root.Extraction = Extraction;

  // v012 #78 补给点：每 3~4 波在随机位置出现，玩家进入 NEAR_RADIUS 弹购买面板；
  // 购买走 RunStats.buySupplyItem（扣局内金币 RunStats.gold，道具+1，#72 已实装）；
  // 持有上限 #77 自然限制（满了按钮置灰）；DURATION 后消失，倒计时可见。
  // 触发方式与空投同款：update 里轮询 Spawner.waveIndex。
  // v012 #78 补给点：每 3~4 波在随机位置出现，玩家进入 NEAR_RADIUS 弹购买面板；
  // 购买走 RunStats.buySupplyItem（扣局内金币 RunStats.gold，道具+1，#72 已实装）；
  // 持有上限 #77 自然限制（满了按钮置灰）；DURATION 后消失，倒计时可见。
  // v014 #85/#86：进入半径自动开面板并暂停战斗（core.js updatePlaying 拦截）；
  // entered 锁定做到"进一次只弹一次"，关闭按钮/点遮罩关闭即恢复；面板重做为图标+金币栏。
  var SupplyPoint = {
    active: false,
    x: 0,
    y: 0,
    t: 0,
    open: false,
    // #85 进入一次只弹一次：本次在范围内开过后不重复弹，走出半径才清除。
    entered: false,
    lastWave: -1,
    nextGap: 3,
    // #86 面板内金币滚动动画状态（秒）。
    goldShown: 0,
    goldFrom: 0,
    goldTo: 0,
    goldT: 0,
    pressIndex: -1,
    pressT: 0,
    scrollY: 0,
    // 行序：血包 / 激光 / 磁铁 / 冰冻 / 炸弹（type 对齐 TYPE_*）。
    ITEMS: [{
      key: 'MEDKIT',
      colorKey: 'ITEM_MEDKIT'
    }, {
      key: 'LASER',
      colorKey: 'ITEM_LASER_EMITTER'
    }, {
      key: 'MAGNET',
      colorKey: 'ITEM_MAGNET'
    }, {
      key: 'FREEZE',
      colorKey: 'ITEM_FREEZE'
    }, {
      key: 'BOMB',
      colorKey: 'ITEM_BOMB'
    }],
    iconKey: {
      MEDKIT: 'icon_medkit',
      LASER: 'icon_laser',
      MAGNET: 'icon_magnet',
      FREEZE: 'icon_freeze',
      BOMB: 'icon_bomb'
    },
    reset: function () {
      this.active = false;
      this.open = false;
      this.entered = false;
      this.t = 0;
      this.lastWave = -1;
      this.nextGap = this.rollGap();
      this.goldShown = this.goldFrom = this.goldTo = 0;
      this.goldT = 0;
      this.pressIndex = -1;
      this.pressT = 0;
      this.scrollY = 0;
      this.category = 0;
    },
    rollGap: function () {
      var c = CONFIG.SUPPLY;
      return c.WAVE_EVERY_MIN + Math.floor(Math.random() * (c.WAVE_EVERY_MAX - c.WAVE_EVERY_MIN + 1));
    },
    typeOf: function (item) {
      switch (item.key) {
        case 'MEDKIT':
          return CONFIG.POWERUPS.TYPE_MEDKIT;
        case 'LASER':
          return CONFIG.POWERUPS.TYPE_LASER_EMITTER;
        case 'MAGNET':
          return CONFIG.POWERUPS.TYPE_MAGNET;
        case 'FREEZE':
          return CONFIG.POWERUPS.TYPE_FREEZE;
        default:
          return CONFIG.POWERUPS.TYPE_BOMB;
      }
    },
    priceOf: function (item) {
      return CONFIG.SUPPLY.PRICES[item.key] || 0;
    },
    spawn: function () {
      var c = CONFIG.SUPPLY;
      var pos = this.randomPos();
      this.active = true;
      this.x = pos.x;
      this.y = pos.y;
      this.t = c.DURATION;
      this.open = false;
      this.entered = false;
    },
    randomPos: function () {
      // 在玩家周围 380~700 范围内找不穿墙的点。
      for (var tries = 0; tries < 12; tries++) {
        var ang = Math.random() * Math.PI * 2;
        var dist = 380 + Math.random() * 320;
        var x = Math.max(160, Math.min(CONFIG.WORLD.WIDTH - 160, root.Player.x + Math.cos(ang) * dist));
        var y = Math.max(160, Math.min(CONFIG.WORLD.HEIGHT - 160, root.Player.y + Math.sin(ang) * dist));
        if (!root.WallCollision.inside(x, y, 60)) return {
          x: x,
          y: y
        };
      }
      return {
        x: root.Player.x,
        y: root.Player.y
      };
    },
    // #85 打开商店：游戏由 core.js 拦截暂停；禁用摇杆/冲刺/道具按键。
    enterShop: function () {
      this.entered = true;
      this.open = true;
      this.goldShown = this.goldFrom = this.goldTo = root.RunStats.gold;
      this.goldT = CONFIG.SUPPLY.GOLD_ROLL;
      // #109：弹窗出现的同一帧清空摇杆、键盘、冲刺/道具触点和遗留点击，
      // 防止“按住摇杆进入范围”产生的 touchend 被误判为商店点击。
      root.Input.reset();
      root.Input.setMovementEnabled(false);
    },
    // #85 关闭商店：entered 保持 true（仍在范围内不重复弹）；立即恢复操作。
    exitShop: function () {
      if (!this.open) return;
      this.open = false;
      this.pressIndex = -1;
      this.pressT = 0;
      root.Input.setMovementEnabled(true);
    },
    // #86 面板几何：屏幕居中。
    panelRect: function () {
      var safeTop = Math.max(0, root.Platform.safeTop || 0), safeBottom = Math.max(0, root.Platform.safeBottom || 0);
      var w = Math.min(CONFIG.SUPPLY.PANEL_W, CONFIG.VIEW.WIDTH - 48);
      var h = Math.min(CONFIG.SUPPLY.PANEL_H, CONFIG.VIEW.HEIGHT - safeTop - safeBottom - 24);
      var x = Math.round((CONFIG.VIEW.WIDTH - w) / 2);
      var y = Math.round(safeTop + (CONFIG.VIEW.HEIGHT - safeTop - safeBottom - h) / 2);
      return {
        x: x,
        y: y,
        w: w,
        h: h
      };
    },
    rowRect: function (i) {
      var p = this.panelRect();
      return {
        x: p.x,
        y: p.y + CONFIG.SUPPLY.CONTENT_TOP + i * CONFIG.SUPPLY.PANEL_ROW_H - this.scrollY,
        w: p.w,
        h: CONFIG.SUPPLY.PANEL_ROW_H
      };
    },
    tabRect: function (i) {
      var p = this.panelRect(), gap = 6, w = (p.w - 48 - gap * 3) / 4;
      return { x: p.x + 24 + i * (w + gap), y: p.y + 134, w: w, h: 36 };
    },
    currentEntries: function () {
      if (this.category === 1) return [1, 2, 3];
      if (this.category === 2) return CONFIG.ARMORY.AMMO;
      if (this.category === 3) return CONFIG.ARMORY.PERKS;
      return this.ITEMS;
    },
    listViewport: function () {
      var p = this.panelRect(), top = p.y + CONFIG.SUPPLY.CONTENT_TOP, bottom = p.y + p.h - CONFIG.SUPPLY.CONTENT_BOTTOM;
      return { x: p.x + CONFIG.SUPPLY.CONTENT_SIDE_PAD, y: top, w: p.w - CONFIG.SUPPLY.CONTENT_SIDE_PAD * 2, h: bottom - top };
    },
    maxScroll: function () {
      var content = this.currentEntries().length * CONFIG.SUPPLY.PANEL_ROW_H;
      return Math.max(0, content - this.listViewport().h);
    },
    scrollBy: function (delta) {
      this.scrollY = Math.max(0, Math.min(this.maxScroll(), this.scrollY + delta));
    },
    buyRect: function (i) {
      var r = this.rowRect(i);
      return {
        x: r.x + r.w - 170,
        y: r.y + 12,
        w: 150,
        h: 60
      };
    },
    closeRect: function () {
      var p = this.panelRect();
      return {
        x: p.x + 36,
        y: p.y + p.h - 110 + 20,
        w: p.w - 72,
        h: 68
      };
    },
    update: function (dt) {
      var c = CONFIG.SUPPLY;
      var wave = root.Spawner.waveIndex;
      if (!this.active) {
        if (wave >= c.MIN_WAVE && wave - this.lastWave >= this.nextGap) {
          this.spawn();
          this.lastWave = wave;
          this.nextGap = this.rollGap();
        }
        return;
      }
      // #85 商店打开（战斗暂停中）：只推进金币滚动/按钮按下动画；
      // 玩家停留期间商店时限冻结，只有补给点自然到期或点击 X 才结束面板。
      if (this.open) {
        this.tickFx(dt);
        this.t -= dt;
        if (this.t <= 0) {
          this.active = false;
          this.entered = false;
          this.exitShop();
        }
        return;
      }
      this.t -= dt;
      if (this.t <= 0) {
        this.active = false;
        this.entered = false;
        return;
      }
      var dx = root.Player.x - this.x,
        dy = root.Player.y - this.y;
      var near = dx * dx + dy * dy <= c.NEAR_RADIUS * c.NEAR_RADIUS;
      if (near) {
        // 进入一次只弹一次：本次范围内已开过就不再自动弹。
        if (!this.entered) this.enterShop();
      } else {
        // 走出半径才解除锁定，下次进入重新开面板。
        this.entered = false;
      }
    },
    // #86 面板内金币 0.2s 滚动（购买扣钱/进面板对齐当前值）+ 按钮按下动画。
    tickFx: function (dt) {
      var now = root.RunStats.gold;
      if (now !== this.goldTo) {
        this.goldFrom = this.goldShown;
        this.goldTo = now;
        this.goldT = 0;
      }
      this.goldT = Math.min(CONFIG.SUPPLY.GOLD_ROLL, this.goldT + dt);
      var k = this.goldTo === this.goldFrom ? 1 : this.goldT / CONFIG.SUPPLY.GOLD_ROLL;
      this.goldShown = Math.round(this.goldFrom + (this.goldTo - this.goldFrom) * k);
      if (this.pressT > 0) {
        this.pressT = Math.max(0, this.pressT - dt);
        if (this.pressT === 0) this.pressIndex = -1;
      }
    },
    handleInput: function () {
      if (!this.active || !this.open) return;
      if (!root.Input.pendingTap.active) return;
      var tap = root.Input.pendingTap;
      var i, r;
      for (i = 0; i < 4; i++) {
        r = this.tabRect(i);
        if (UI.isPointInRect(tap, r.x, r.y, r.w, r.h)) {
          this.category = i; this.scrollY = 0; this.pressIndex = -1; root.Input.clearTap(); return;
        }
      }
      var viewport = this.listViewport();
      if (!UI.isPointInRect(tap, viewport.x, viewport.y, viewport.w, viewport.h)) {
        r = this.closeRect();
        if (UI.isPointInRect(tap, r.x, r.y, r.w, r.h)) this.exitShop();
        root.Input.clearTap();
        return;
      }
      // #86 购买按钮（金币不足/已满自然不可点）。
      for (i = 0; i < this.currentEntries().length; i++) {
        r = this.buyRect(i);
        if (UI.isPointInRect(tap, r.x, r.y, r.w, r.h)) {
          this.tryBuy(i);
          root.Input.clearTap();
          return;
        }
      }
      // #85 关闭按钮。
      r = this.closeRect();
      if (UI.isPointInRect(tap, r.x, r.y, r.w, r.h)) {
        this.exitShop();
        root.Input.clearTap();
        return;
      }
      // #109：遮罩与面板空白处不再关闭商店；消费点击，避免透传到底层战斗按钮。
      root.Input.clearTap();
    },
    tryBuy: function (i) {
      if (this.category === 1) {
        var level = i + 1, wp = CONFIG.SUPPLY.WEAPON_UPGRADE_PRICES[i];
        if (level !== root.Armory.weaponLevel + 1) { Meta.showToast(CONFIG.TEXT.SUPPLY_LOCKED); return; }
        if (root.RunStats.gold < wp) { Meta.showToast(CONFIG.TEXT.SUPPLY_NO_GOLD); return; }
        root.RunStats.gold -= wp; root.Armory.buyWeaponLevel(level); this.pressIndex = i; this.pressT = .15; return;
      }
      if (this.category === 2) {
        var ammo = CONFIG.ARMORY.AMMO[i];
        if (!ammo || root.RunStats.gold < ammo.PRICE) { Meta.showToast(CONFIG.TEXT.SUPPLY_NO_GOLD); return; }
        root.RunStats.gold -= ammo.PRICE; root.Armory.buyAmmo(ammo.ID); this.pressIndex = i; this.pressT = .15; return;
      }
      if (this.category === 3) {
        var perk = CONFIG.ARMORY.PERKS[i];
        if (!perk || root.Armory.hasPerk(perk.ID)) { Meta.showToast(CONFIG.TEXT.SUPPLY_OWNED); return; }
        var perkPrice = root.Armory.perkPrice();
        if (root.RunStats.gold < perkPrice) { Meta.showToast(CONFIG.TEXT.SUPPLY_NO_GOLD); return; }
        root.RunStats.gold -= perkPrice; root.Armory.buyPerk(perk.ID, false); this.pressIndex = i; this.pressT = .15; return;
      }
      var item = this.ITEMS[i];
      var type = this.typeOf(item);
      var price = this.priceOf(item);
      // #77 持有上限自然限制：满了再买无效。
      if (root.PowerUps.inventory[type] >= root.PowerUps.maxFor(type)) {
        Meta.showToast(CONFIG.TEXT.SUPPLY_SOLD_MAX);
        return;
      }
      // #72 已实装：扣局内金币、道具+1；金币不足返回 false。
      if (!root.RunStats.buySupplyItem(type, price)) {
        Meta.showToast(CONFIG.TEXT.SUPPLY_NO_GOLD);
        return;
      }
      // #86 按钮按下动画 + 世界反馈。
      this.pressIndex = i;
      this.pressT = 0.15;
      FX.burst(this.x, this.y, CONFIG.COLORS.AIRDROP);
    },
    drawWorld: function (ctx) {
      if (!this.active) return;
      var sx = this.x - root.Camera.x,
        sy = this.y - root.Camera.y;
      ctx.save();
      // 可购买范围圈
      ctx.strokeStyle = 'rgba(233,173,88,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.arc(sx, sy, CONFIG.SUPPLY.NEAR_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // 补给箱
      ctx.fillStyle = '#3a2f1d';
      ctx.strokeStyle = CONFIG.COLORS.AIRDROP;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.rect(sx - 26, sy - 26, 52, 52);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = CONFIG.COLORS.AIRDROP;
      ctx.fillRect(sx - 16, sy - 4, 32, 8);
      ctx.fillRect(sx - 4, sy - 16, 8, 32);
      // 倒计时
      ctx.font = 'bold 20px Arial, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CONFIG.COLORS.TEXT;
      ctx.fillText(CONFIG.TEXT.SUPPLY_TIME(this.t), sx, sy - 46);
      ctx.restore();
    },
    drawPanel: function (ctx) {
      if (!this.active || !this.open) return;
      var p = this.panelRect();
      ctx.save();
      // 共用弹窗框架固定标题/内容/底栏，商品列表只能在内容区滚动。
      UI.drawModalChrome(ctx, p, CONFIG.TEXT.SUPPLY_TITLE, '关闭商店', 0.60);
      // 标题 / 副标题
      var supplyIcon = UI.icon('nav_supply');
      if (supplyIcon) ctx.drawImage(supplyIcon, p.x + 34, p.y + 18, 44, 44);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CONFIG.COLORS.TEXT;
      ctx.font = 'bold 30px Arial, "Microsoft YaHei", sans-serif';
      // 标题已由共用框架居中绘制；副标题留在标题栏内。
      ctx.fillStyle = CONFIG.COLORS.HINT_TEXT;
      ctx.font = '16px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillText(CONFIG.TEXT.SUPPLY_SUBTITLE, p.x + p.w / 2, p.y + 68);
      // 顶部金币栏：左"当前金币"，右 coin_gold 图标 + 金色滚动数字
      var barY = p.y + 92,
        barH = 32;
      UI.roundedRectPath(ctx, p.x + 24, barY, p.w - 48, barH, 12);
      ctx.fillStyle = 'rgba(255,212,71,0.12)';
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = CONFIG.COLORS.HINT_TEXT;
      ctx.font = 'bold 17px Arial, "Microsoft YaHei", sans-serif';
      ctx.fillText(CONFIG.TEXT.SUPPLY_GOLD_LABEL, p.x + 38, barY + barH / 2);
      var numText = String(this.goldShown);
      ctx.font = 'bold 28px Arial, "Microsoft YaHei", sans-serif';
      var numW = ctx.measureText ? ctx.measureText(numText).width : numText.length * 12;
      var numX = p.x + p.w - 38;
      ctx.textAlign = 'right';
      ctx.fillStyle = CONFIG.COLORS.COIN;
      ctx.fillText(numText, numX, barY + barH / 2 + 1);
      var coinImg = UI.icon('coin_gold');
      var iconS = 24;
      var iconX = numX - numW - 12 - iconS,
        iconY = barY + (barH - iconS) / 2;
      if (coinImg) {
        ctx.drawImage(coinImg, iconX, iconY, iconS, iconS);
      } else {
        ctx.beginPath();
        ctx.arc(iconX + iconS / 2, iconY + iconS / 2, iconS / 2, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.COLORS.COIN;
        ctx.fill();
      }
      // 四类页签：道具 / 逐级武器强化 / 单一弹药改装 / 被动技能。
      for (var ti = 0; ti < 4; ti++) {
        var tr = this.tabRect(ti), selected = ti === this.category;
        UI.roundedRectPath(ctx, tr.x, tr.y, tr.w, tr.h, 8);
        ctx.fillStyle = selected ? 'rgba(255,190,70,.28)' : 'rgba(255,255,255,.06)'; ctx.fill();
        ctx.strokeStyle = selected ? CONFIG.COLORS.COIN : CONFIG.COLORS.ITEM_BORDER; ctx.lineWidth = selected ? 2 : 1; ctx.stroke();
        ctx.textAlign = 'center'; ctx.fillStyle = selected ? CONFIG.COLORS.COIN : CONFIG.COLORS.HINT_TEXT;
        ctx.font = 'bold 15px Arial, "Microsoft YaHei", sans-serif'; ctx.fillText(CONFIG.TEXT.SUPPLY_TABS[ti], tr.x + tr.w / 2, tr.y + tr.h / 2);
      }
      var entries = this.currentEntries();
      var viewport = this.listViewport();
      ctx.save();
      ctx.beginPath(); ctx.rect(viewport.x, viewport.y, viewport.w, viewport.h); ctx.clip();
      for (var i = 0; i < entries.length; i++) {
        var item = entries[i], row = this.rowRect(i), type = -1, price = 0, maxed = false, locked = false;
        var name = '', desc = '', iconName = '', iconColor = CONFIG.COLORS.ITEM_BORDER;
        if (this.category === 0) {
          type = this.typeOf(item); price = this.priceOf(item); maxed = root.PowerUps.inventory[type] >= root.PowerUps.maxFor(type);
          name = CONFIG.TEXT.POWERUPS[type].SHORT; desc = '持有 ' + root.PowerUps.inventory[type] + '/' + root.PowerUps.maxFor(type);
          iconName = this.iconKey[item.key]; iconColor = CONFIG.COLORS[item.colorKey] || iconColor;
        } else if (this.category === 1) {
          var level = item; price = CONFIG.SUPPLY.WEAPON_UPGRADE_PRICES[i];
          name = CONFIG.TEXT.SUPPLY_WEAPON_LEVEL(level); desc = CONFIG.TEXT.SUPPLY_WEAPON_DESC;
          maxed = root.Armory.weaponLevel >= level; locked = level > root.Armory.weaponLevel + 1; iconName = 'ammo_normal'; iconColor = '#ffd166';
        } else if (this.category === 2) {
          price = item.PRICE; name = item.NAME; desc = '每30发中随机1发触发'; iconName = item.ICON; iconColor = item.COLOR;
          maxed = root.Armory.ammoType === item.ID;
        } else {
          price = root.Armory.perkPrice(); name = item.NAME; desc = item.DESC; iconName = item.ICON; iconColor = item.COLOR; maxed = root.Armory.hasPerk(item.ID);
        }
        var affordable = !maxed && !locked && root.RunStats.gold >= price;
        var slotX = row.x + 20,
          slotY = row.y + 14,
          slotS = 56;
        UI.roundedRectPath(ctx, slotX, slotY, slotS, slotS, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = CONFIG.COLORS.ITEM_BORDER;
        ctx.stroke();
        var img = iconName ? UI.icon(iconName) : null;
        if (img) {
          ctx.save();
          if (!affordable) ctx.globalAlpha = 0.45;
          ctx.drawImage(img, slotX + 5, slotY + 5, slotS - 10, slotS - 10);
          ctx.restore();
        } else {
          ctx.fillStyle = iconColor;
          ctx.fillRect(slotX + 12, slotY + 12, slotS - 24, slotS - 24);
        }
        // 名称（灰）+ 价格（金）
        ctx.textAlign = 'left';
        ctx.fillStyle = affordable ? CONFIG.COLORS.TEXT : CONFIG.COLORS.HINT_TEXT;
        ctx.font = 'bold 22px Arial, "Microsoft YaHei", sans-serif';
        ctx.fillText(name, row.x + 92, row.y + 31);
        ctx.fillStyle = CONFIG.COLORS.HINT_TEXT; ctx.font = '15px Arial, "Microsoft YaHei", sans-serif';
        ctx.fillText(desc, row.x + 92, row.y + 56);
        // 购买按钮：已满置灰显示"已满"，不足置灰；按下动画下沉 3px
        var br = this.buyRect(i);
        var label = maxed ? (this.category === 2 ? CONFIG.TEXT.SUPPLY_EQUIPPED : CONFIG.TEXT.SUPPLY_OWNED) : locked ? CONFIG.TEXT.SUPPLY_LOCKED : CONFIG.TEXT.BUY(price);
        var press = this.pressIndex === i && this.pressT > 0;
        UI.drawActionButton(ctx, br.x, br.y + (press ? 3 : 0), br.w, br.h, label, affordable, 20);
      }
      ctx.restore();
      var maxScroll = this.maxScroll();
      if (maxScroll > 0) {
        var thumbH = Math.max(48, viewport.h * viewport.h / (entries.length * CONFIG.SUPPLY.PANEL_ROW_H));
        var thumbY = viewport.y + (viewport.h - thumbH) * this.scrollY / maxScroll;
        ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(p.x + p.w - 8, viewport.y, 3, viewport.h);
        ctx.fillStyle = 'rgba(233,173,88,.75)'; ctx.fillRect(p.x + p.w - 9, thumbY, 5, thumbH);
      }
      // 唯一关闭入口由统一弹窗框架固定在底栏。
      ctx.restore();
    }
  };
  root.SupplyPoint = SupplyPoint;

  // 由 Game.draw 在同一逻辑画布变换内调用，HUD 不接管整帧。
  root.BattleView = {
    draw: function () {
      var ctx = CanvasView.ctx;
      var c = CONFIG.POLISH;
      ctx.save();
      try {
        UI.applyWorldShake(ctx);
        ctx.translate(CONFIG.VIEW.WIDTH / 2, CONFIG.VIEW.HEIGHT / 2);
        ctx.scale(Camera.zoom, Camera.zoom);
        ctx.translate(-CONFIG.VIEW.WIDTH / 2, -CONFIG.VIEW.HEIGHT / 2);
        UI.drawGround(ctx);
        Experience.draw(ctx);
        CoinDrops.draw(ctx);
        PowerUps.drawWorldItems(ctx);
        Field.draw(ctx);
        if (root.BattleEvents) root.BattleEvents.draw(ctx);
        if (root.SupplyPoint) root.SupplyPoint.drawWorld(ctx);
        Extraction.draw(ctx);
        Enemy.draw(ctx);
        LaserEmitter.draw(ctx);
        MortarStrike.draw(ctx);
        Weapons.draw(ctx);
        Player.draw(ctx);
        Field.drawPlayerOcclusion(ctx);
        root.Armory.drawPerks(ctx);
        root.PulseGun.drawReload(ctx);
        UI.drawPlayerStatus(ctx);
        DamageText.draw(ctx);
        FX.draw(ctx);
        Enemy.drawThreats(ctx);
      } finally {
        ctx.restore();
      }
      UI.drawHud(ctx);
      UI.drawGoldHud(ctx);
      if (Game.state === CONFIG.GAME.STATE_PLAYING) Field.drawDirections(ctx);
      // v012 #76 空投方向箭头（屏幕边缘）。
      if (root.BattleEvents && root.BattleEvents.drawEdgeArrow) root.BattleEvents.drawEdgeArrow(ctx);
      if (root.BattleEvents) root.BattleEvents.drawBanner(ctx);
      if (Game.state === CONFIG.GAME.STATE_PLAYING) {
        UI.drawJoystick(ctx);
        UI.drawPowerUpButtons(ctx);
        UI.drawDashButton(ctx);
        if (!Ads.active) UI.drawPauseButton(ctx);
        UI.drawDashSpeedLines(ctx);
        UI.drawDashDirectionArrow(ctx);
        UI.drawExtractionButtons(ctx);
        // v012 #78 补给点购买面板（屏幕空间，最后绘制在上层）。
        if (root.SupplyPoint) root.SupplyPoint.drawPanel(ctx);
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
      if (root.Spawner && Spawner.theme && Game.state === CONFIG.GAME.STATE_PLAYING) {
        var themeDef = CONFIG.WAVE_THEMES.KINDS[Spawner.theme];
        if (themeDef) UI.drawCenteredText(ctx, themeDef.LABEL, 348 + (CONFIG.UI.TOP_INSET || 0), 22, true, CONFIG.COLORS.WAVE_THEME);
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

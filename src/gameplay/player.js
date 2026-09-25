(function () {
  'use strict';

  // ============================================================
  // player.js — 玩家模块
  // 职责：玩家移动/冲刺/受击/属性/角色外观渲染
  // 主要对象：Player(x,y,hp,maxHp,speed/init/reset/update/draw/takeDamage/startDash/canDash)
  // 全局状态：G.player（Player 单例 x/y/hp/maxHp/speed/dashing/critChance/globalDamageBonus/reviveCharges）；读 G.input(moveX,moveY)
  // 依赖：core.js(G/Game/Camera), input.js(G.input), save.js(Meta 养成), config.js(CONFIG)
  // 加载顺序：core → input → save → player
  // ============================================================
  var root = typeof window !== 'undefined' ? window : global;
  var CONFIG = root.CONFIG;
  var Player = {
    x: CONFIG.PLAYER.START_X,
    y: CONFIG.PLAYER.START_Y,
    hp: CONFIG.PLAYER.MAX_HP,
    maxHp: CONFIG.PLAYER.MAX_HP,
    moveSpeedBonus: 0,
    critChance: CONFIG.PLAYER.BASE_CRIT_CHANCE,
    critDamageBonus: 0,
    globalDamageBonus: 0,
    incomingDamageMultiplier: 1,
    expGainBonus: 0,
    killHeal: 0,
    enemySpeedMultiplier: 1,
    phoenixReady: false,
    executeChance: 0,
    pickupRadius: CONFIG.EXPERIENCE.PICKUP_RADIUS,
    invincibleTimer: 0,
    reviveCharges: 0,
    // 受击反馈
    renderOffsetX: 0,
    renderOffsetY: 0,
    hitScaleTimer: 0,
    hitShakeTimer: 0,
    // 冲刺
    dashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: 0,
    dashDirY: -1,
    dashArrowTimer: 0,
    dashTrailTimer: 0,
    dashScaleTimer: 0,
    dashReadyFlash: 0,
    dashDustTimer: 0,
    lastMoveDirX: 0,
    lastMoveDirY: 1,
    dashTrails: [],
    // 血包升级：护盾 / 持续恢复 / 自动急救
    shield: 0,
    shieldTimer: 0,
    shieldFlash: 0,
    armorMax: 0,
    upgradeShieldMax: 0,
    upgradeShieldRecharge: 0,
    regenTimer: 0,
    regenRate: 0,
    autoMedkitUsed: false,
    // #5 射击后坐力（渲染偏移，不改真实位置）
    recoilX: 0,
    recoilY: 0,
    recoilTimer: 0,
    recoilReturnTimer: 0,
    // #16 朝向与移动起伏
    facingAngle: 0,
    bobOffset: 0,
    reset: function () {
      this.x = CONFIG.PLAYER.START_X;
      this.y = CONFIG.PLAYER.START_Y;
      this.maxHp = Math.min(CONFIG.PLAYER.MAX_HP_LIMIT, CONFIG.PLAYER.MAX_HP + Meta.getEffectTotal('MAX_HP'));
      this.hp = this.maxHp;
      this.moveSpeedBonus = Meta.getEffectTotal('MOVE_SPEED');
      this.critChance = CONFIG.PLAYER.BASE_CRIT_CHANCE;
      this.critDamageBonus = 0;
      this.globalDamageBonus = 0;
      this.incomingDamageMultiplier = 1;
      this.expGainBonus = 0;
      this.killHeal = 0;
      this.enemySpeedMultiplier = 1;
      this.phoenixReady = false;
      this.executeChance = 0;
      this.pickupRadius = Math.min(CONFIG.EXPERIENCE.MAX_PICKUP_RADIUS, CONFIG.EXPERIENCE.PICKUP_RADIUS + Meta.getEffectTotal('PICKUP_RADIUS'));
      this.invincibleTimer = 0;
      this.reviveCharges = Math.round(Meta.getEffectTotal('REVIVE'));
      // 受击反馈
      this.renderOffsetX = 0;
      this.renderOffsetY = 0;
      this.hitScaleTimer = 0;
      this.slowTimer = 0;
      this.skillCooldownMultiplier = 1;
      this.hitShakeTimer = 0;
      // 冲刺
      this.dashing = false;
      this.dashTimer = 0;
      this.dashCooldown = 0;
      this.dashDirX = 0;
      this.dashDirY = -1;
      this.dashArrowTimer = 0;
      this.dashTrailTimer = 0;
      this.dashScaleTimer = 0;
      this.dashReadyFlash = 0;
      this.dashDustTimer = 0;
      this.lastMoveDirX = 0;
      this.lastMoveDirY = 1;
      this.dashTrails.length = 0;
      // 血包升级
      this.shield = 0;
      this.armorMax = 0;
      this.shieldTimer = 0;
      this.upgradeShieldMax = 0;
      this.upgradeShieldRecharge = 0;
      this.regenTimer = 0;
      this.regenRate = 0;
      this.autoMedkitUsed = false;
      // 后坐力 / 朝向
      this.recoilX = 0;
      this.recoilY = 0;
      this.recoilTimer = 0;
      this.recoilReturnTimer = 0;
      this.facingAngle = 0;
      this.bobOffset = 0;
      this.visual = CharacterView.makeState();
      this.runLook = CharacterView.snapshot(null,root.WeaponProgress.selected);
    },
    update: function (dt) {
      var startX = this.x,
        startY = this.y;
      var move = Input.getMoveVector();
      this.slowTimer = Math.max(0,(this.slowTimer||0)-dt);
      var speed = this.getMoveSpeed();

      // 记录最近一次移动方向（用于无输入时冲刺朝向）
      var moveLen = Math.hypot(move.x, move.y);
      if (moveLen > 0.1 && !this.dashing) {
        this.lastMoveDirX = move.x;
        this.lastMoveDirY = move.y;
      }

      // 冲刺冷却
      if (this.dashCooldown > 0) {
        this.dashCooldown = Math.max(0, this.dashCooldown - dt);
        if (this.dashCooldown === 0 && !this.dashing) {
          this.dashReadyFlash = CONFIG.PLAYER.DASH_READY_FLASH;
        }
      }
      if (this.dashReadyFlash > 0) this.dashReadyFlash = Math.max(0, this.dashReadyFlash - dt);
      if (this.dashArrowTimer > 0) this.dashArrowTimer = Math.max(0, this.dashArrowTimer - dt);
      if (this.dashing) {
        // 冲刺方向锁定；最后0.1秒由高速平滑回落到正常速度。
        this.dashTimer -= dt;
        var ease = Math.min(1, Math.max(0, this.dashTimer / CONFIG.PLAYER.DASH_EASE_TIME));
        var dashMultiplier = 1 + (CONFIG.PLAYER.DASH_SPEED_MULTIPLIER - 1) * ease;
        this.x += this.dashDirX * speed * dashMultiplier * dt;
        this.y += this.dashDirY * speed * dashMultiplier * dt;
        this.clampToWorld();
        // 冲刺全程无敌（不缩短已有的更长无敌时间）
        this.invincibleTimer = Math.max(this.invincibleTimer, Math.max(0, this.dashTimer));
        // 残影拖尾
        this.dashTrailTimer -= dt;
        if (this.dashTrailTimer <= 0) {
          this.dashTrailTimer = CONFIG.PLAYER.DASH_TRAIL_INTERVAL;
          this.dashTrails.push({
            x: this.x,
            y: this.y,
            life: CONFIG.PLAYER.DASH_TRAIL_LIFE
          });
          if (this.dashTrails.length > CONFIG.PLAYER.DASH_TRAIL_MAX) this.dashTrails.shift();
        }
        // 地面扬尘
        this.dashDustTimer -= dt;
        if (this.dashDustTimer <= 0) {
          this.dashDustTimer = CONFIG.PLAYER.DASH_DUST_INTERVAL;
          if (root.FX && root.FX.spawnDust) root.FX.spawnDust(this.x, this.y);
        }
        if (this.dashTimer <= 0) {
          this.dashing = false;
          // 结束冲击波
          if (root.FX && root.FX.spawnRing) root.FX.spawnRing(this.x, this.y);
          this.x += move.x * speed * Math.min(dt, Math.max(0, -this.dashTimer));
          this.y += move.y * speed * Math.min(dt, Math.max(0, -this.dashTimer));
          this.clampToWorld();
        }
      } else {
        // 普通移动
        this.x += move.x * speed * dt;
        this.y += move.y * speed * dt;
        this.clampToWorld();
      }

      // 无敌帧衰减
      if (this.invincibleTimer > 0) {
        this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
      }
      // 护盾计时：到期护盾清空
      if (this.shieldTimer > 0) {
        this.shieldTimer = Math.max(0, this.shieldTimer - dt);
        if (this.shieldTimer <= 0) this.shield = 0;
      }
      if (this.shieldFlash > 0) this.shieldFlash = Math.max(0, this.shieldFlash - dt);
      if (this.upgradeShieldMax > 0 && this.shield <= 0) {
        this.upgradeShieldRecharge = Math.max(0, this.upgradeShieldRecharge - dt);
        if (this.upgradeShieldRecharge <= 0) this.shield = this.upgradeShieldMax;
      }
      // 持续恢复（血包 regen）
      if (this.regenTimer > 0) {
        this.regenTimer = Math.max(0, this.regenTimer - dt);
        this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt);
      }
      // 自动急救：生命低于25%且有升级、本局未用过 → 自动用血包（不耗库存）
      if (!this.autoMedkitUsed && root.Meta && Meta.getGadgetLevel('medkit', 'auto') > 0 && this.hp > 0 && this.hp < this.maxHp * 0.25 && this.hp < this.maxHp) {
        if (root.PowerUps && root.PowerUps.useMedkit) {
          root.PowerUps.useMedkit();
          this.autoMedkitUsed = true;
        }
      }
      // 受击缩放/角色震动计时衰减
      if (this.hitScaleTimer > 0) this.hitScaleTimer = Math.max(0, this.hitScaleTimer - dt);
      if (this.hitShakeTimer > 0) {
        this.hitShakeTimer = Math.max(0, this.hitShakeTimer - dt);
        if (this.hitShakeTimer > 0) {
          this.renderOffsetX = (Math.random() * 2 - 1) * CONFIG.PLAYER.HIT_SHAKE_OFFSET;
          this.renderOffsetY = (Math.random() * 2 - 1) * CONFIG.PLAYER.HIT_SHAKE_OFFSET;
        } else {
          this.renderOffsetX = 0;
          this.renderOffsetY = 0;
        }
      } else {
        this.renderOffsetX = 0;
        this.renderOffsetY = 0;
      }
      // 冲刺形变恢复计时
      if (this.dashScaleTimer > 0) this.dashScaleTimer = Math.max(0, this.dashScaleTimer - dt);
      // #5 后坐力：0.05s 保持位移，随后 0.1s 平滑回弹
      if (this.recoilTimer > 0) {
        this.recoilTimer = Math.max(0, this.recoilTimer - dt);
      } else if (this.recoilReturnTimer > 0) {
        this.recoilReturnTimer = Math.max(0, this.recoilReturnTimer - dt);
        var rt = 1 - this.recoilReturnTimer / 0.1;
        var rem = 1 - rt;
        this.recoilX *= rem;
        this.recoilY *= rem;
        if (this.recoilReturnTimer <= 0) {
          this.recoilX = 0;
          this.recoilY = 0;
        }
      }
      for (var i = this.dashTrails.length - 1; i >= 0; i--) {
        this.dashTrails[i].life -= dt;
        if (this.dashTrails[i].life <= 0) this.dashTrails.splice(i, 1);
      }
      var pos = root.Field.collideWalls(this.x, this.y, CONFIG.PLAYER.RADIUS);
      this.x = pos.x; this.y = pos.y;
      if (this.dashing && this.nextDashSpeed) {
        this.x += (this.x - startX) * this.nextDashSpeed;
        this.y += (this.y - startY) * this.nextDashSpeed;
        this.clampToWorld();
      }
      this.visual.moveX = this.x - startX;
      this.visual.moveY = this.y - startY;
    },
    getMoveSpeed: function () {
      var weapon = root.WeaponProgress && root.WeaponProgress.selected, firearm = CONFIG.WEAPONS.FIREARMS[weapon];
      return Math.min(CONFIG.PLAYER.MAX_SPEED, CONFIG.PLAYER.SPEED * (1 + this.moveSpeedBonus) * (firearm ? firearm.MOVE : 1) * (this.slowTimer>0?CONFIG.V20.ELITES[5].SLOW:1));
    },
    canDash: function () { return !this.dashing && this.dashCooldown <= 0; },
    startDash: function () {
      if (!this.canDash()) return false;
      var move=Input.getMoveVector(), dx=move.x, dy=move.y;
      if(Math.hypot(dx,dy)<.1) {dx=this.lastMoveDirX;dy=this.lastMoveDirY;}
      if(Math.hypot(dx,dy)<.1) {dx=0;dy=-1;}
      var len=Math.hypot(dx,dy); this.dashDirX=dx/len;this.dashDirY=dy/len;
      this.dashing=true;this.dashTimer=CONFIG.PLAYER.DASH_DURATION;this.dashCooldown=CONFIG.PLAYER.DASH_COOLDOWN*this.skillCooldownMultiplier;
      this.dashTrailTimer=0;this.dashDustTimer=0;this.dashScaleTimer=CONFIG.PLAYER.DASH_SCALE_TIME;this.dashReadyFlash=0;this.dashArrowTimer=CONFIG.PLAYER.DASH_ARROW_TIME;
      if(this.nextDashTime)this.dashTimer+=this.nextDashTime;
      if(this.nextDashCd)this.dashCooldown=Math.max(.5,this.dashCooldown-this.nextDashCd);
      if(this.nextDashCdRatio)this.dashCooldown*=this.nextDashCdRatio;
      root.Objectives.add('dash',1);root.Achievements.add('dash',1);if(root.Tutorial)root.Tutorial.notify('dash');return true;
    },
    clampToWorld: function () {
      var r=CONFIG.PLAYER.RADIUS;
      this.x=Math.max(r,Math.min(CONFIG.WORLD.WIDTH-r,this.x));this.y=Math.max(r,Math.min(CONFIG.WORLD.HEIGHT-r,this.y));
    },
    applyRecoil: function (angle) {
      // 后坐仅由武器表现处理，不移动角色整体或真实坐标。
      this.recoilX=0;this.recoilY=0;
    },
    // 只读取武器已选中的真实目标，不进行第二次索敌。
    updateFacing: function () {
      CharacterView.updateBattle(this, 0);
    },
    updateAppearance: function (dt) { CharacterView.updateBattle(this, dt); },
    takeDamage: function (amount, source, continuous) {
      if (root.Armory) root.Armory.onPlayerDamaged();
      if (root.DevConsole.god || this.nextGod) return false;
      if (this.invincibleTimer > 0) return false;
      // 护盾优先吸收伤害
      if (this.shield > 0 && amount > 0) {
        var absorbed = Math.min(this.shield, amount);
        this.shield -= absorbed;
        if (root.Armory) root.Armory.triggerPerk('armor');
        amount -= absorbed;
        if (this.shield <= 0) {
          this.shield = 0;
          this.shieldTimer = 0;
          if (this.upgradeShieldMax > 0) this.upgradeShieldRecharge = 12;
        }
        if (amount <= 0) {
          // 护盾完全吸收：不扣血、不触发无敌帧与受击反馈
          this.shieldFlash = 0.2;
          if (this.invincibleTimeBonus) this.invincibleTimer += this.invincibleTimeBonus;
          root.Objectives.onDamage();
          return true;
        }
      }
      this.hp = Math.max(0, this.hp - amount * this.incomingDamageMultiplier);
        if (!continuous) this.invincibleTimer = CONFIG.PLAYER.INVINCIBLE_TIME;
      if (this.hp <= 0 && this.phoenixReady) {
        this.phoenixReady = false;
        this.hp = Math.max(1, Math.ceil(this.maxHp * 0.5));
        this.invincibleTimer = 3;
        Enemy.clearScreenForRevive();
      } else if (this.hp <= 0 && this.reviveCharges > 0) {
        this.reviveCharges -= 1;
        this.hp = Math.max(1, Math.ceil(this.maxHp * CONFIG.META.IMMORTAL_HP_RATIO));
        this.invincibleTimer = CONFIG.META.IMMORTAL_INVINCIBLE_TIME;
      }
      // 受击反馈：(a) Y轴压扁始终触发；(b)(c) 受角色震动开关控制
      this.hitScaleTimer = CONFIG.PLAYER.HIT_SCALE_TIME;
      if(root.FX && root.FX.burst)root.FX.burst(this.x,this.y,CONFIG.CHARACTER.HIT_COLOR);
      if (root.Settings && root.Settings.shake) {
        this.hitShakeTimer = CONFIG.PLAYER.HIT_SHAKE_TIME;
        var strong = source === 'elite' || source === 'boss';
        Camera.startShake(strong ? 6 : 4, strong ? 0.3 : 0.2);
      }
      return true;
    },
    increaseMaxHp: function (amount) {
      var oldMax = this.maxHp;
      this.maxHp = Math.min(CONFIG.PLAYER.MAX_HP_LIMIT, this.maxHp + amount);
      this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - oldMax));
    },
    draw: function (ctx) {
      var x = this.x - Camera.x, y = this.y - Camera.y;
      for (var i = 0; i < this.dashTrails.length; i++) {
        var trail = this.dashTrails[i];
        ctx.save(); ctx.globalAlpha = trail.life / CONFIG.PLAYER.DASH_TRAIL_LIFE * CONFIG.PLAYER.DASH_TRAIL_ALPHA;
        CharacterView.draw(ctx, trail.x - Camera.x, trail.y - Camera.y, 1, this.runLook, this.visual);
        ctx.restore();
      }
      CharacterView.draw(ctx, x, y, 1, this.runLook, this.visual);
      if (this.shield > 0 || this.hp / this.maxHp < .3) {
        ctx.save(); ctx.strokeStyle = this.shield > 0 ? CONFIG.COLORS.SHIELD : CONFIG.COLORS.LOW_HP_AURA;
        ctx.lineWidth = this.shieldFlash > 0 ? 4 : 2; ctx.beginPath();
        ctx.ellipse(x, y, CONFIG.PLAYER.RADIUS + 10, 10, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      if (root.Settings && root.Settings.debug) {
        ctx.save(); ctx.strokeStyle = CONFIG.CHARACTER.OUTLINE; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, CONFIG.PLAYER.RADIUS, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
  };
  // 所有页面与战斗共用分层小人；状态与存档、战斗实体完全分离。
  var CharacterView = {
    previewState: null,
    menuState: null,
    previewAction: 0,
    previewDirection: 0,
    // 页面动画独立 dt，只改预览状态；战斗和暂停时由 core 跳过。
    updatePreview: function (dt) {
      if(!this.previewState)this.previewState=this.makeState();
      if(!this.menuState)this.menuState=this.makeState();
      this.menuState.time+=dt;
      var s=this.previewState,c=CONFIG.CHARACTER;
      s.time+=dt;s.facing=this.previewDirection;s.angle=c.DIRECTION_ANGLES[s.facing];
      var weapon=root.Wardrobe && root.Wardrobe.previewWeapon || this.menuLook().weapon;
      var profile=this.profile(weapon), phase=(s.time%c.PREVIEW.ACTION_TIME)/c.PREVIEW.ACTION_TIME;
      var shotPhase=s.time%profile.PREVIEW_INTERVAL;
      s.moving=this.previewAction===1;
      this.advanceGait(s,dt,s.moving?c.RIG.PREVIEW_SPEED:0,Math.cos(s.angle),Math.sin(s.angle));
      s.flash=this.previewAction===2 && shotPhase<c.FLASH_TIME?c.FLASH_TIME-shotPhase:0;
      s.recoil=this.previewAction===2?Math.max(0,c.RECOIL_TIME-shotPhase):0;
      s.reload=this.previewAction===3 && weapon!=='flamer'?phase:0;
      s.sustained=this.previewAction===2 && weapon==='flamer';
    },
    makeState: function () { return { time:0, step:0, pace:0, travelX:0, travelY:0, facing:0, angle:Math.PI/2, moveX:0, moveY:0, moving:false, recoil:0, flash:0, reload:0, sustained:false, hit:false, dash:false, end:'' }; },
    profile: function (weapon) { var p=CONFIG.CHARACTER.RIG.PROFILES;return p[weapon]||p.pistol; },
    advanceGait: function (s,dt,speed,dx,dy) {
      if(dt<=0)return;
      var r=CONFIG.CHARACTER.RIG, blend=1-Math.exp(-r.BLEND_RATE*dt);
      var target=Math.min(r.MAX_PACE,speed/r.SPEED_REFERENCE),old=s.pace;
      s.pace+=(target-s.pace)*blend;
      // 积分平滑速度，60/120 Hz 下有相同步幅；停步自然收回中立姿势。
      s.step+=(target*dt+(old-target)*blend/r.BLEND_RATE)*r.SPEED_REFERENCE/r.STRIDE_LENGTH*Math.PI*2;
      s.travelX+=(dx-s.travelX)*blend;s.travelY+=(dy-s.travelY)*blend;
    },
    snapshot: function (outfit, weapon) {
      var m = root.Meta.data, id = weapon || m.selectedWeapon || 'pistol', def = CONFIG.CHARACTER.WEAPONS[id] || CONFIG.CHARACTER.WEAPONS.pistol;
      return { outfit:outfit || m.currentOutfit || 'default', weapon:id, paint:m.equippedSkins[def.SKIN_KEY] || 'default' };
    },
    menuLook: function () {
      var m=root.Meta.data,d=this.weaponDef(m.selectedWeapon);
      if(!this._menuLook || this._menuLook.outfit!==m.currentOutfit || this._menuLook.weapon!==m.selectedWeapon || this._menuLook.paint!==m.equippedSkins[d.SKIN_KEY]) this._menuLook=this.snapshot();
      return this._menuLook;
    },
    setDirection: function (state, angle) {
      var angles = CONFIG.CHARACTER.DIRECTION_SECTORS || CONFIG.CHARACTER.DIRECTION_ANGLES;
      if (!Number.isInteger(state.facing) || state.facing < 0 || state.facing >= angles.length) state.facing = 0;
      var current = angles[state.facing];
      var nearest=state.facing,best=Math.abs(Math.atan2(Math.sin(angle-current),Math.cos(angle-current)));
      for(var i=0;i<angles.length;i++) {
        var d=Math.abs(Math.atan2(Math.sin(angle-angles[i]),Math.cos(angle-angles[i])));
        if(d<best){best=d;nearest=i;}
      }
      // Keep the current sprite sector in its angular dead band.
      var currentDelta=Math.abs(Math.atan2(Math.sin(angle-current),Math.cos(angle-current)));
      if(nearest!==state.facing && best < currentDelta - CONFIG.CHARACTER.HYSTERESIS) state.facing=nearest;
      state.angle=angle;
    },
    updateBattle: function (player, dt) {
      var s=player.visual, c=CONFIG.CHARACTER, aim=root.Weapons.presentation;
      if(!s) return;
      s.time += dt;
      var dist=Math.hypot(s.moveX,s.moveY);
      s.moving = dist > c.MOVE_EPS * dt;
      this.advanceGait(s,dt,s.moving && dt>0?dist/dt:0,dist?s.moveX/dist:0,dist?s.moveY/dist:0);
      var angle = aim && aim.valid ? aim.angle : s.moving ? Math.atan2(s.moveY,s.moveX) : s.angle;
      this.setDirection(s,angle);
      player.facingAngle=angle;
      s.recoil=aim ? aim.recoil : 0; s.flash=aim ? aim.flash : 0;
      this.syncWeaponCycle(s);
      s.hit=player.hitScaleTimer>0; s.dash=player.dashing; s.end=player.hp<=0?'death':'';
    },
    syncWeaponCycle: function (s) {
      s.reload=root.PulseGun.reloading && CONFIG.WEAPONS.FIREARMS[root.WeaponProgress.selected] ? 1-root.PulseGun.reloadTimer/root.PulseGun.getReloadDuration() : 0;
      s.sustained=root.WeaponProgress.selected==='flamer' && root.FlameWeapon.visual>0;
      if(root.WeaponProgress.selected==='crossbow' && root.Crossbow.timer>0) {
        var cycle=CONFIG.CONTENT.CROSSBOW.COOLDOWN/(root.Crossbow.rate*(1+(root.W8&&root.W8.rateBonusFor?root.W8.rateBonusFor('crossbow'):0)));
        s.reload=Math.max(0,Math.min(1,1-root.Crossbow.timer/cycle));
      }
    },
    // 输出到调用方提供的固定对象，避免每帧创建锚点对象。
    anchor: function (name, out) {
      var a=CONFIG.CHARACTER.ANCHORS[name];
      var scale=CONFIG.CHARACTER.HEIGHT/96;
      out.x=root.Player.x+a.x*scale; out.y=root.Player.y+a.y*scale; return out;
    },
    weaponDef: function (id) { return CONFIG.CHARACTER.WEAPONS[id] || CONFIG.CHARACTER.WEAPONS.pistol; },
    grip: function (state) { return CONFIG.CHARACTER.DIRECTION_GRIPS[state.facing]; },
    // 武器局部坐标沿朝向旋转，左半平面翻转局部 Y，保持握把朝下。
    muzzle: function (x,y,angle,weapon,facing,out,state) {
      var d=this.weaponDef(weapon), t=CONFIG.CHARACTER.TEMPLATES[d.TEMPLATE], g=CONFIG.CHARACTER.DIRECTION_GRIPS[facing];
      if(state) {g=this.weaponPose(state,weapon,this._muzzlePose||(this._muzzlePose={}),angle);angle=g.angle;}
      var dx=((d.MUZZLE_X || t.MUZZLE_X)-t.GRIP_X)*t.WIDTH, dy=(t.MUZZLE_Y-t.GRIP_Y)*t.HEIGHT*(Math.cos(angle)<0?-1:1);
      var scale=CONFIG.CHARACTER.HEIGHT/96;
      out.x=x+(g.x+Math.cos(angle)*dx-Math.sin(angle)*dy)*scale;
      out.y=y+(g.y+Math.sin(angle)*dx+Math.cos(angle)*dy)*scale; return out;
    },
    bodyPose: function (s,weapon,out) {
      var c=CONFIG.CHARACTER,r=c.RIG,p=this.profile(weapon),pace=s.pace||0;
      out.bob=Math.sin(s.time*c.BREATH_HZ)*r.IDLE_BREATH-Math.abs(Math.sin(s.step))*r.BODY_BOUNCE*pace*p.BOUNCE;
      out.sway=Math.sin(s.step)*r.BODY_SWAY*pace;
      out.lean=-(s.travelX||0)*r.LEAN*pace-Math.cos(s.angle)*p.BRACE*(s.sustained||s.recoil>0?1:0);
      out.leg=Math.sin(s.step)*r.LEG_SWING*pace*p.SWING;
      return out;
    },
    weaponPose: function (s,weapon,out,aimAngle) {
      var c=CONFIG.CHARACTER,r=c.RIG,p=this.profile(weapon),g=this.grip(s),b=this.bodyPose(s,weapon,this._weaponBody||(this._weaponBody={}));
      var reload=Math.sin(Math.PI*s.reload),kick=Math.min(1,s.recoil/c.RECOIL_TIME)*p.KICK;
      var base=aimAngle==null?s.angle:aimAngle;
      out.angle=base+reload*p.RELOAD_TILT*(Math.cos(base)<0?-1:1);
      out.x=g.x+b.sway-Math.cos(out.angle)*kick;
      out.y=g.y+b.bob*r.GRIP_BOB-Math.sin(out.angle)*kick;
      if(s.sustained)out.y+=Math.sin(s.time*r.FLAME_HZ)*r.FLAME_SHAKE;
      return out;
    },
    layer: function (ctx,img,dir,row,dy) {
      var c=CONFIG.CHARACTER;
      ctx.drawImage(img,dir*c.CELL,row*c.CELL,c.CELL,c.CELL,-c.FOOT_X,-c.FOOT_Y+dy,c.CELL,c.CELL);
    },
    draw: function (ctx,x,y,scale,look,state) {
      if(!state || !look) return;
      var c=CONFIG.CHARACTER, skin=c.SKINS[look.outfit] || c.SKINS.default;
      var img=root.Platform.characterImage(look.outfit), back=state.facing===1 || state.facing===6 || state.facing===7;
      if (img && img.width && img.width < c.CELL * (c.ATLAS_COLUMNS || 8)) img = null;
      var pose=this.bodyPose(state,look.weapon,this._bodyPose||(this._bodyPose={}));
      scale*=c.HEIGHT/96;
      ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
      if(state.hit) ctx.globalAlpha *= .6 + .25 * Math.sin(state.time * 80);
      ctx.fillStyle=c.SHADOW; ctx.beginPath(); ctx.ellipse(0,0,28,9,0,0,Math.PI*2); ctx.fill();
      // 结束表现只改变显示高度；人物始终直立，不沿瞄准方向旋转。
      if(state.end==='death') { ctx.globalAlpha *= .65; ctx.scale(1,.76); }
      if(!back)this.drawPart(ctx,img,skin,look,state,pose,0);
      if(back)this.drawWeapon(ctx,look,state);
      this.drawPart(ctx,img,skin,look,state,pose,1);
      this.drawPart(ctx,img,skin,look,state,pose,2);
      this.drawPart(ctx,img,skin,look,state,pose,3);
      if(back)this.drawPart(ctx,img,skin,look,state,pose,0);
      this.drawPart(ctx,img,skin,look,state,pose,4);
      if(!c.SKINS[look.outfit]) {
        ctx.fillStyle=root.OutfitColors && root.OutfitColors[look.outfit] || skin.ACCENT;
        ctx.fillRect(-22,-65,10,16); ctx.fillRect(-16,-90,32,5);
      }
      if(!back)this.drawWeapon(ctx,look,state);
      if(state.end==='extract') { ctx.strokeStyle=c.OUTLINE; ctx.lineWidth=2; ctx.beginPath();ctx.ellipse(0,0,34,12,0,0,Math.PI*2);ctx.stroke(); }
      ctx.restore();
    },
    drawPart: function (ctx,img,skin,look,s,p,row) {
      var r=CONFIG.CHARACTER.RIG,leg=row===1||row===2,sign=row===1?-1:1;
      var px=leg?sign*r.HIP_X:0,py=leg?r.HIP_Y:row===4?r.NECK_Y:r.CHEST_Y;
      var rotation=leg?p.leg*sign:p.lean;
      if(row===4)rotation*=-r.HEAD_COUNTER;
      if(row===0)rotation+=Math.sin(s.step-r.PACK_LAG)*(s.pace||0)*r.PACK_LAG;
      ctx.save();
      ctx.translate(px+(leg?0:p.sway),py+(leg?-Math.max(0,Math.sin(s.step)*sign)*r.FOOT_LIFT*(s.pace||0):p.bob));
      ctx.rotate(rotation);ctx.translate(-px,-py);
      if(img)this.layer(ctx,img,s.facing,row,0);
      else this.drawFallbackPart(ctx,skin,s,row);
      if(!img && row===4 && ['rainbow_pony','frog_raincoat','box_robot'].indexOf(look.outfit)>=0)this.drawThemeOverlay(ctx,look.outfit,s);
      ctx.restore();
    },
    drawFallbackPart: function (ctx,skin,state,row) {
      if(row===0)return;
      if(row===1||row===2) {ctx.fillStyle=CONFIG.CHARACTER.GLOVE;ctx.fillRect(row===1?-18:5,-29,14,29);return;}
      ctx.fillStyle=skin.COLOR;
      if(row===3){ctx.fillRect(-22,-66,44,42);return;}
      ctx.beginPath();ctx.arc(0,-77,19,0,Math.PI*2);ctx.fill();
      var back=CONFIG.CHARACTER.DIRECTION_GRIPS[state.facing].behind;
      ctx.fillStyle=skin.ACCENT;ctx.fillRect(state.facing===2||state.facing===4?-20:-15,-82,back?8:30,7);
    },
    drawThemeOverlay: function (ctx,outfit,state) {
      var back=state.facing===1 || state.facing===6 || state.facing===7, side=state.facing===2 || state.facing===3 || state.facing===4 || state.facing===5;
      if(outfit==='rainbow_pony') {
        ctx.fillStyle='#ec83cf';ctx.beginPath();ctx.ellipse(0,-76,side?18:23,18,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#ffd84f';ctx.beginPath();ctx.moveTo(-4,-91);ctx.lineTo(0,-107);ctx.lineTo(5,-91);ctx.fill();
        var mane=['#ff5d76','#ffc94d','#5bd39a','#54c8ff','#a874ee'];
        for(var i=0;i<5;i++){ctx.fillStyle=mane[i];ctx.fillRect(-18+i*8,-62+(i%2)*5,8,24);}
        ctx.fillStyle='#57d5a1';ctx.fillRect(back?-24:13,-38,12,18);
      } else if(outfit==='frog_raincoat') {
        ctx.fillStyle='#63c85c';ctx.beginPath();ctx.ellipse(0,-76,side?21:27,23,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#d9ff7a';for(var e=0;e<(side?1:2);e++){ctx.beginPath();ctx.arc(side?9:-12+e*24,-97,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(side?9:-12+e*24,-99,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d9ff7a';}
        ctx.fillStyle='#ffe269';ctx.beginPath();ctx.ellipse(0,-53,27,9,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#2d6b40';ctx.fillRect(-4,-28,8,8);
      } else if(outfit==='box_robot') {
        ctx.fillStyle='#b78552';ctx.fillRect(side?-17:-24,-96,side?34:48,39);ctx.strokeStyle='#6c543b';ctx.lineWidth=3;ctx.strokeRect(side?-17:-24,-96,side?34:48,39);
        if(!back){ctx.fillStyle='#4dd4e5';ctx.fillRect(side?2:-14,-83,side?7:9,8);if(!side)ctx.fillRect(5,-83,9,8);ctx.fillStyle='#6c543b';ctx.fillRect(-7,-69,14,3);}
        ctx.fillStyle='#91683f';ctx.fillRect(back?-30:15,-54,side?14:22,24);ctx.fillStyle='#4dd4e5';ctx.fillRect(back?-27:18,-48,side?8:15,4);
      }
    },
    drawWeapon: function (ctx,look,s) {
      var c=CONFIG.CHARACTER,r=c.RIG,d=this.weaponDef(look.weapon),t=c.TEMPLATES[d.TEMPLATE],img=root.Platform.characterWeapons();
      var g=this.weaponPose(s,look.weapon,this._drawWeaponPose||(this._drawWeaponPose={}));
      var b=this.bodyPose(s,look.weapon,this._armBody||(this._armBody={}));
      var angle=g.angle,flip=Math.cos(angle)<0?-1:1;
      var supportX=(t.SUPPORT_X-t.GRIP_X)*t.WIDTH,supportY=(t.SUPPORT_Y-t.GRIP_Y)*t.HEIGHT;
      // 支撑手离开前托、取弹/拉弦、归位。只有双臂两只手，服装无需动作帧。
      var track=r.RELOAD_HANDS[look.weapon]||r.RELOAD_HANDS.pistol;
      for(var key=1;key<track.length;key++)if(s.reload<=track[key][0]) {
        var a=track[key-1],z=track[key],u=Math.max(0,(s.reload-a[0])/(z[0]-a[0]));u=u*u*(3-2*u);
        supportX+=a[1]+(z[1]-a[1])*u;supportY+=a[2]+(z[2]-a[2])*u;break;
      }
      var hx=g.x+Math.cos(angle)*supportX-Math.sin(angle)*supportY*flip;
      var hy=g.y+Math.sin(angle)*supportX+Math.cos(angle)*supportY*flip;
      var shoulder=r.SHOULDER_X*(g.x<0?-1:1);
      this.drawArm(ctx,-shoulder+b.sway,r.SHOULDER_Y+b.bob,hx,hy,-flip);
      this.drawArm(ctx,shoulder+b.sway,r.SHOULDER_Y+b.bob,g.x,g.y,flip);
      ctx.save();ctx.translate(g.x,g.y);ctx.rotate(angle);ctx.scale(1,flip);
      if(img)ctx.drawImage(img,0,d.ROW*64,128,64,-t.GRIP_X*t.WIDTH,-t.GRIP_Y*t.HEIGHT,t.WIDTH,t.HEIGHT);
      else {ctx.fillStyle=c.WEAPON;ctx.fillRect(-12,-7,t.WIDTH*.8,13);ctx.fillRect(-6,4,9,13);}
      if(c.PAINTS[look.paint]) {ctx.fillStyle=c.PAINTS[look.paint];ctx.fillRect(2,-7,t.WIDTH*.26,4);}
      ctx.fillStyle=c.GLOVE;ctx.beginPath();ctx.arc(0,0,r.HAND_RADIUS,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(supportX,supportY,r.HAND_RADIUS,0,Math.PI*2);ctx.fill();
      ctx.restore();
      if(s.flash>0 && s.reload===0) {
        var p=this._flashPoint || (this._flashPoint={x:0,y:0});
        this.muzzle(0,0,s.angle,look.weapon,s.facing,p,s);
        var unit=c.HEIGHT/96;p.x/=unit;p.y/=unit;
        ctx.fillStyle=c.WEAPON_LIGHT;ctx.beginPath();ctx.arc(p.x,p.y,4+3*s.flash/c.FLASH_TIME,0,Math.PI*2);ctx.fill();
      }
    },
    drawArm: function (ctx,sx,sy,hx,hy,side) {
      var c=CONFIG.CHARACTER,r=c.RIG,dx=hx-sx,dy=hy-sy,len=Math.max(1,Math.hypot(dx,dy));
      var bend=Math.min(r.ELBOW_BEND,len/2);
      var ex=(sx+hx)/2-dy/len*bend*side,ey=(sy+hy)/2+dx/len*bend*side;
      ctx.save();ctx.strokeStyle=c.GLOVE;ctx.lineWidth=r.ARM_WIDTH;ctx.lineCap='round';ctx.lineJoin='round';
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.lineTo(hx,hy);ctx.stroke();ctx.restore();
    }
  };
  root.CharacterView=CharacterView;
  Player.visual=CharacterView.makeState();

  root.Player = Player;
  root.G.player = Player;
})();

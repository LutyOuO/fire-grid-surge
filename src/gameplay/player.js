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
      return Math.min(CONFIG.PLAYER.MAX_SPEED, CONFIG.PLAYER.SPEED * (1 + this.moveSpeedBonus) * (firearm ? firearm.MOVE : 1));
    },
    canDash: function () { return !this.dashing && this.dashCooldown <= 0; },
    startDash: function () {
      if (!this.canDash()) return false;
      var move=Input.getMoveVector(), dx=move.x, dy=move.y;
      if(Math.hypot(dx,dy)<.1) {dx=this.lastMoveDirX;dy=this.lastMoveDirY;}
      if(Math.hypot(dx,dy)<.1) {dx=0;dy=-1;}
      var len=Math.hypot(dx,dy); this.dashDirX=dx/len;this.dashDirY=dy/len;
      this.dashing=true;this.dashTimer=CONFIG.PLAYER.DASH_DURATION;this.dashCooldown=CONFIG.PLAYER.DASH_COOLDOWN;
      this.dashTrailTimer=0;this.dashDustTimer=0;this.dashScaleTimer=CONFIG.PLAYER.DASH_SCALE_TIME;this.dashReadyFlash=0;this.dashArrowTimer=CONFIG.PLAYER.DASH_ARROW_TIME;
      if(this.nextDashTime)this.dashTimer+=this.nextDashTime;
      if(this.nextDashCd)this.dashCooldown=Math.max(.5,this.dashCooldown-this.nextDashCd);
      if(this.nextDashCdRatio)this.dashCooldown*=this.nextDashCdRatio;
      root.Objectives.add('dash',1);root.Achievements.add('dash',1);return true;
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
    shouldFlashWhite: function () {
      if (this.invincibleTimer <= 0) return false;
      return Math.floor(this.invincibleTimer / CONFIG.PLAYER.FLASH_INTERVAL) % 2 === 0;
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
      var s=this.previewState,c=CONFIG.CHARACTER,phase=(s.time%c.PREVIEW.ACTION_TIME)/c.PREVIEW.ACTION_TIME;
      s.time+=dt;s.facing=this.previewDirection;s.angle=c.DIRECTION_ANGLES[s.facing];
      s.moving=this.previewAction===1;if(s.moving)s.step+=dt*c.WALK_HZ;
      s.flash=this.previewAction===2 && phase<.12?c.FLASH_TIME:0;
      s.recoil=this.previewAction===2?Math.max(0,c.RECOIL_TIME-phase):0;
      s.reload=this.previewAction===3?phase:0;
    },
    makeState: function () { return { time:0, step:0, facing:0, angle:Math.PI/2, moveX:0, moveY:0, moving:false, recoil:0, flash:0, reload:0, hit:false, dash:false, end:'' }; },
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
      var angles = CONFIG.CHARACTER.DIRECTION_ANGLES, current = angles[state.facing];
      var delta = Math.abs(Math.atan2(Math.sin(angle-current), Math.cos(angle-current)));
      if (delta > Math.PI/4 + CONFIG.CHARACTER.HYSTERESIS) {
        var best = Infinity;
        for(var i=0;i<angles.length;i++) {
          var d = Math.abs(Math.atan2(Math.sin(angle-angles[i]),Math.cos(angle-angles[i])));
          if(d < best) { best=d; state.facing=i; }
        }
      }
      state.angle=angle;
    },
    updateBattle: function (player, dt) {
      var s=player.visual, c=CONFIG.CHARACTER, aim=root.Weapons.presentation;
      if(!s) return;
      s.time += dt;
      var dist=Math.hypot(s.moveX,s.moveY);
      s.moving = dist > c.MOVE_EPS * dt;
      if(s.moving) s.step += dist / Math.max(1, player.getMoveSpeed()) * c.WALK_HZ;
      var angle = aim && aim.valid ? aim.angle : s.moving ? Math.atan2(s.moveY,s.moveX) : s.angle;
      this.setDirection(s,angle);
      player.facingAngle=angle;
      s.recoil=aim ? aim.recoil : 0; s.flash=aim ? aim.flash : 0;
      s.reload=root.PulseGun.reloading && CONFIG.WEAPONS.FIREARMS[root.WeaponProgress.selected] ? 1-root.PulseGun.reloadTimer/root.PulseGun.getReloadDuration() : 0;
      s.hit=player.shouldFlashWhite(); s.dash=player.dashing; s.end=player.hp<=0?'death':'';
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
    muzzle: function (x,y,angle,weapon,facing,out) {
      var d=this.weaponDef(weapon), t=CONFIG.CHARACTER.TEMPLATES[d.TEMPLATE], g=CONFIG.CHARACTER.DIRECTION_GRIPS[facing];
      var dx=((d.MUZZLE_X || t.MUZZLE_X)-t.GRIP_X)*t.WIDTH, dy=(t.MUZZLE_Y-t.GRIP_Y)*t.HEIGHT*(Math.cos(angle)<0?-1:1);
      var scale=CONFIG.CHARACTER.HEIGHT/96;
      out.x=x+(g.x+Math.cos(angle)*dx-Math.sin(angle)*dy)*scale;
      out.y=y+(g.y+Math.sin(angle)*dx+Math.cos(angle)*dy)*scale; return out;
    },
    layer: function (ctx,img,dir,row,dy) {
      var c=CONFIG.CHARACTER;
      ctx.drawImage(img,dir*c.CELL,row*c.CELL,c.CELL,c.CELL,-c.FOOT_X,-c.FOOT_Y+dy,c.CELL,c.CELL);
    },
    draw: function (ctx,x,y,scale,look,state) {
      if(!state || !look) return;
      var c=CONFIG.CHARACTER, skin=c.SKINS[look.outfit] || c.SKINS.default;
      var img=root.Platform.characterImage(look.outfit), back=state.facing===1;
      var bob=Math.sin(state.time*c.BREATH_HZ)*c.BREATH, leg=state.moving?Math.sin(state.step)*c.STRIDE:0;
      scale*=c.HEIGHT/96;
      ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
      ctx.fillStyle=c.SHADOW; ctx.beginPath(); ctx.ellipse(0,0,28,9,0,0,Math.PI*2); ctx.fill();
      // 结束表现只改变显示高度；人物始终直立，不沿瞄准方向旋转。
      if(state.end==='death') { ctx.globalAlpha *= .65; ctx.scale(1,.76); }
      if(state.dash) ctx.transform(1,0,Math.cos(state.angle)*.09,1,0,0);
      if(!back) { if(img)this.layer(ctx,img,state.facing,0,bob); }
      if(back)this.drawWeapon(ctx,look,state);
      if(img) {
        this.layer(ctx,img,state.facing,1,leg);
        this.layer(ctx,img,state.facing,2,-leg);
        this.layer(ctx,img,state.facing,3,bob);
        if(back)this.layer(ctx,img,state.facing,0,bob);
        this.layer(ctx,img,state.facing,4,bob);
      } else this.drawFallback(ctx,skin,state,leg);
      // 缺少新版素材的老皮肤保留身体和独立身份标识。
      if(!c.SKINS[look.outfit]) {
        ctx.fillStyle=root.OutfitColors && root.OutfitColors[look.outfit] || skin.ACCENT;
        ctx.fillRect(-22,-65,10,16); ctx.fillRect(-16,-90,32,5);
      }
      if(!back)this.drawWeapon(ctx,look,state);
      if(state.hit) { ctx.globalAlpha *= .65; ctx.strokeStyle=c.HIT_COLOR; ctx.lineWidth=3; ctx.strokeRect(-23,-92,46,70); }
      if(state.end==='extract') { ctx.strokeStyle=c.OUTLINE; ctx.lineWidth=2; ctx.beginPath();ctx.ellipse(0,0,34,12,0,0,Math.PI*2);ctx.stroke(); }
      ctx.restore();
    },
    drawFallback: function (ctx,skin,state,leg) {
      ctx.fillStyle=skin.COLOR; ctx.fillRect(-22,-66,44,42);
      ctx.fillStyle=CONFIG.CHARACTER.GLOVE; ctx.fillRect(-18,-25+leg,14,25); ctx.fillRect(5,-25-leg,14,25);
      ctx.fillStyle=skin.COLOR; ctx.beginPath();ctx.arc(0,-77,19,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=skin.ACCENT;ctx.fillRect(state.facing===2?-20:-15,-82,state.facing===1?8:30,7);
    },
    drawWeapon: function (ctx,look,s) {
      var c=CONFIG.CHARACTER,d=this.weaponDef(look.weapon),t=c.TEMPLATES[d.TEMPLATE],g=this.grip(s),img=root.Platform.characterWeapons();
      var flip=Math.cos(s.angle)<0?-1:1;
      var reload=s.reload>0?Math.sin(s.reload*Math.PI)*t.RELOAD_TILT:0;
      var angle=s.angle+reload*flip, recoil=s.recoil/c.RECOIL_TIME*t.RECOIL;
      // 双臂从肩部接到实际握把/前托，不把整个躯干跟随枪械旋转。
      ctx.save();ctx.strokeStyle=c.GLOVE;ctx.lineWidth=8;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(g.x<0?-23:23,-56);ctx.lineTo(g.x,g.y);ctx.stroke();
      if(d.TEMPLATE!=='short') {
        var support=(t.SUPPORT_X-t.GRIP_X)*t.WIDTH;
        ctx.beginPath();ctx.moveTo(g.x<0?20:-20,-56);ctx.lineTo(g.x+Math.cos(angle)*support,g.y+Math.sin(angle)*support);ctx.stroke();
      }
      ctx.restore();
      ctx.save();ctx.translate(g.x,g.y);ctx.rotate(angle);ctx.scale(1,flip);
      ctx.translate(-recoil,0);
      if(img)ctx.drawImage(img,0,d.ROW*64,128,64,-t.GRIP_X*t.WIDTH,-t.GRIP_Y*t.HEIGHT,t.WIDTH,t.HEIGHT);
      else {ctx.fillStyle=c.WEAPON;ctx.fillRect(-12,-7,t.WIDTH*.8,13);ctx.fillRect(-6,4,9,13);}
      if(c.PAINTS[look.paint]) {ctx.fillStyle=c.PAINTS[look.paint];ctx.fillRect(2,-7,t.WIDTH*.26,4);}
      ctx.fillStyle=c.GLOVE;ctx.beginPath();ctx.arc(0,2,5,0,Math.PI*2);ctx.fill();
      if(d.TEMPLATE!=='short') {ctx.beginPath();ctx.arc((t.SUPPORT_X-t.GRIP_X)*t.WIDTH,(t.SUPPORT_Y-t.GRIP_Y)*t.HEIGHT,5,0,Math.PI*2);ctx.fill();}
      ctx.restore();
      if(s.flash>0 && s.reload===0) {
        var p=this._flashPoint || (this._flashPoint={x:0,y:0});
        this.muzzle(0,0,s.angle,look.weapon,s.facing,p);
        ctx.fillStyle=c.WEAPON_LIGHT;ctx.beginPath();ctx.arc(p.x,p.y,4+3*s.flash/c.FLASH_TIME,0,Math.PI*2);ctx.fill();
      }
    }
  };
  root.CharacterView=CharacterView;
  Player.visual=CharacterView.makeState();

  root.Player = Player;
  root.G.player = Player;
})();

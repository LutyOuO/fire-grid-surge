'use strict';
(function(){
// ============================================================
// v008：墙体与避障 / 三主武器成长 / 旋转激光 / 后期波次
// ============================================================
var root=(typeof window!=='undefined')?window:global;
var CONFIG=root.CONFIG,Game=root.Game,UI=root.UI,Input=root.Input,Meta=root.Meta,Platform=root.Platform;
var Player=root.Player,Enemy=root.Enemy,Bullet=root.Bullet,Camera=root.Camera,Combat=root.Combat;
var Weapons=root.Weapons,PulseGun=root.PulseGun,OrbitBlade=root.OrbitBlade,FlameWeapon=root.FlameWeapon,Crossbow=root.Crossbow;
var Spawner=root.Spawner,PowerUps=root.PowerUps,LaserEmitter=root.LaserEmitter,Field=root.Field,RunStats=root.RunStats;

// v008 是独立脚本闭包，不能依赖 v005/v007 闭包内的同名辅助函数。
function hit(p,x,y,w,h){return !!p&&UI.isPointInRect(p,x,y,w,h);}
function tap(){return Input.pendingTap&&Input.pendingTap.active?Input.pendingTap:null;}
function text(ctx,s,x,y,size,color,align,bold){ctx.save();ctx.font=(bold?'bold ':'')+size+'px Arial,"Microsoft YaHei"';ctx.textAlign=align||'left';ctx.textBaseline='middle';ctx.fillStyle=color||'#fff';ctx.fillText(s,x,y);ctx.restore();}

CONFIG.BOUNDARY.CORNER_RUIN_RADIUS=0;
CONFIG.FIELD.WALLS=[
 {x:360,y:430,w:330,h:86,kind:'concrete'},{x:1530,y:390,w:105,h:350,kind:'container'},
 {x:420,y:1260,w:110,h:330,kind:'container'},{x:1430,y:1390,w:360,h:92,kind:'concrete'},
 {x:900,y:710,w:300,h:82,kind:'concrete'},{x:930,y:1920,w:360,h:100,kind:'rubble'},
 {x:1750,y:930,w:250,h:84,kind:'rubble'},{x:650,y:2130,w:100,h:230,kind:'container'}
];
CONFIG.FIELD.LASER_ITEM=CONFIG.POWERUPS.TYPE_LASER_EMITTER;
CONFIG.LASER_EMITTER.BASE_DURATION=5;
CONFIG.LASER_EMITTER.TICK_INTERVAL=.05;

// 新激光升级树，必须在 Meta.load 创建默认存档前完成替换。
CONFIG.META.GADGET_UPGRADES.laser.items=[
 {ID:'speed',NAME:'旋转加速',DESC:'旋转速度 +15%',BASE:80,MAX_LEVEL:5,AMOUNT:.15},
 {ID:'duration',NAME:'持续照射',DESC:'激光持续时间 +1秒',BASE:70,MAX_LEVEL:3,AMOUNT:1},
 {ID:'bossDamage',NAME:'致命光束',DESC:'精英/Boss伤害 +25%',BASE:100,MAX_LEVEL:5,AMOUNT:.25},
 {ID:'cooldown',NAME:'快速充能',DESC:'激活冷却 -15%',BASE:100,MAX_LEVEL:5,AMOUNT:.15},
 {ID:'overload',NAME:'过载光束',DESC:'额外增加1条对向光束',BASE:300,MAX_LEVEL:1,AMOUNT:1}
];

function insideWall(x,y,r){r=r||0;for(var i=0;i<CONFIG.FIELD.WALLS.length;i++){var w=CONFIG.FIELD.WALLS[i],cx=Math.max(w.x,Math.min(x,w.x+w.w)),cy=Math.max(w.y,Math.min(y,w.y+w.h)),dx=x-cx,dy=y-cy;if(dx*dx+dy*dy<=r*r)return true;}return false;}
function segmentHitsWall(x1,y1,x2,y2,r){var dx=x2-x1,dy=y2-y1,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/24));for(var i=1;i<=steps;i++)if(insideWall(x1+dx*i/steps,y1+dy*i/steps,r))return true;return false;}
function rayDistance(x,y,a){var dx=Math.cos(a),dy=Math.sin(a),best=99999,t;if(dx>0)best=Math.min(best,(CONFIG.WORLD.WIDTH-x)/dx);else if(dx<0)best=Math.min(best,(0-x)/dx);if(dy>0)best=Math.min(best,(CONFIG.WORLD.HEIGHT-y)/dy);else if(dy<0)best=Math.min(best,(0-y)/dy);for(var i=0;i<CONFIG.FIELD.WALLS.length;i++){var w=CONFIG.FIELD.WALLS[i],minX=w.x,maxX=w.x+w.w,minY=w.y,maxY=w.y+w.h,t0=0,t1=best;if(Math.abs(dx)<.00001){if(x<minX||x>maxX)continue;}else{var ax=(minX-x)/dx,bx=(maxX-x)/dx;if(ax>bx){t=ax;ax=bx;bx=t;}t0=Math.max(t0,ax);t1=Math.min(t1,bx);}if(Math.abs(dy)<.00001){if(y<minY||y>maxY)continue;}else{var ay=(minY-y)/dy,by=(maxY-y)/dy;if(ay>by){t=ay;ay=by;by=t;}t0=Math.max(t0,ay);t1=Math.min(t1,by);}if(t1>=Math.max(0,t0))best=Math.min(best,Math.max(0,t0));}return Math.max(0,best-2);}
root.WallCollision={inside:insideWall,segment:segmentHitsWall,rayDistance:rayDistance};

// 内部墙矢量细节：在原实体底面上增加明暗面、分段、裂纹与警示条。
var oldFieldDraw=Field.draw;
Field.draw=function(ctx){oldFieldDraw.call(this,ctx);for(var i=0;i<CONFIG.FIELD.WALLS.length;i++){var w=CONFIG.FIELD.WALLS[i],x=w.x-Camera.x,y=w.y-Camera.y;if(x+w.w<0||y+w.h<0||x>CONFIG.VIEW.WIDTH||y>CONFIG.VIEW.HEIGHT)continue;ctx.save();ctx.fillStyle='rgba(255,255,255,.09)';ctx.fillRect(x+6,y+6,w.w-12,Math.max(8,w.h*.18));ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(x+5,y+w.h*.72,w.w-10,w.h*.23);if(w.kind==='container'){ctx.strokeStyle='#8d5f3c';ctx.lineWidth=4;for(var k=1;k<5;k++){ctx.beginPath();ctx.moveTo(x+w.w*k/5,y+8);ctx.lineTo(x+w.w*k/5,y+w.h-8);ctx.stroke();}ctx.fillStyle='#d7a145';ctx.fillRect(x+8,y+8,24,8);ctx.fillRect(x+w.w-32,y+w.h-16,24,8);}else{ctx.strokeStyle='#242321';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+w.w*.2,y);ctx.lineTo(x+w.w*.32,y+w.h*.38);ctx.lineTo(x+w.w*.25,y+w.h);ctx.moveTo(x+w.w*.68,y);ctx.lineTo(x+w.w*.58,y+w.h*.55);ctx.lineTo(x+w.w*.76,y+w.h);ctx.stroke();if(w.kind==='rubble'){ctx.fillStyle='#6b6259';for(var n=0;n<4;n++){ctx.beginPath();ctx.arc(x+35+n*(w.w-70)/3,y+w.h/2+(n%2?12:-10),12+n%3*4,0,Math.PI*2);ctx.fill();}}}ctx.restore();}};

// ---------- #47 轻量避障 ----------
var oldEnemySpawn=Enemy.spawn;
Enemy.spawn=function(x,y,type,hp){var e=oldEnemySpawn.call(this,x,y,type,hp);if(e){e.avoidCheck=Math.random()*.2;e.avoidTime=0;e.avoidAngle=0;e.stuckTime=0;}return e;};
Enemy.moveTowardPlayer=function(e,dt){var dx=Player.x-e.x,dy=Player.y-e.y,base=Math.atan2(dy,dx),angle=e.avoidTime>0?e.avoidAngle:base;e.avoidCheck-=dt;e.avoidTime=Math.max(0,e.avoidTime-dt);if(e.avoidCheck<=0){e.avoidCheck=.2;var probe=Math.max(35,e.speed*.35),px=e.x+Math.cos(base)*probe,py=e.y+Math.sin(base)*probe;if(insideWall(px,py,e.radius)){var a1=base-Math.PI/4,a2=base+Math.PI/4,p1=!insideWall(e.x+Math.cos(a1)*probe,e.y+Math.sin(a1)*probe,e.radius),p2=!insideWall(e.x+Math.cos(a2)*probe,e.y+Math.sin(a2)*probe,e.radius);if(p1||p2){if(p1&&p2){var d1=Math.hypot(Player.x-(e.x+Math.cos(a1)*probe),Player.y-(e.y+Math.sin(a1)*probe)),d2=Math.hypot(Player.x-(e.x+Math.cos(a2)*probe),Player.y-(e.y+Math.sin(a2)*probe));angle=d1<d2?a1:a2;}else angle=p1?a1:a2;e.avoidAngle=angle;e.avoidTime=.3;}else{e.avoidTime=.12;angle=base+Math.PI/2;}}}var sepX=0,sepY=0;if(e.avoidCheck>.19)for(var i=0;i<Enemy.pool.length;i++){var o=Enemy.pool[i];if(!o.active||o===e)continue;var sx=e.x-o.x,sy=e.y-o.y,rr=e.radius+o.radius+5,d2=sx*sx+sy*sy;if(d2>0&&d2<rr*rr){var d=Math.sqrt(d2);sepX+=sx/d*(rr-d)/rr;sepY+=sy/d*(rr-d)/rr;}}var speed=e.speed*Player.enemySpeedMultiplier;e.x+=(Math.cos(angle)+sepX*.45)*speed*dt;e.y+=(Math.sin(angle)+sepY*.45)*speed*dt;e.x=Math.max(e.radius,Math.min(CONFIG.WORLD.WIDTH-e.radius,e.x));e.y=Math.max(e.radius,Math.min(CONFIG.WORLD.HEIGHT-e.radius,e.y));var p=Field.collideWalls(e.x,e.y,e.radius);e.x=p.x;e.y=p.y;};

// ---------- #48 投射物撞墙 ----------
var oldBulletRemove=Bullet.shouldRemove;
Bullet.shouldRemove=function(b){return oldBulletRemove.call(this,b)||insideWall(b.x,b.y,CONFIG.WEAPONS.PULSE.RADIUS);};
var oldCrossbowUpdate=Crossbow.update;
Crossbow.update=function(dt){oldCrossbowUpdate.call(this,dt);for(var i=0;i<this.arrows.length;i++){var b=this.arrows[i];if(b.active&&insideWall(b.x,b.y,8)){b.active=false;b.hitCount=0;}}};
var oldBossProjectileUpdate=Enemy.updateBossProjectiles;
Enemy.updateBossProjectiles=function(dt){for(var i=0;i<this.bossProjectiles.length;i++){var p=this.bossProjectiles[i];if(p.active&&segmentHitsWall(p.x,p.y,p.x+p.vx*dt,p.y+p.vy*dt,CONFIG.BOSS_RANGED.PROJECTILE_RADIUS)){p.active=false;if(root.FX)root.FX.burst(p.x,p.y,CONFIG.COLORS.WALL_EDGE);}}oldBossProjectileUpdate.call(this,dt);};
var oldMortarUpdate=root.MortarStrike.update;
root.MortarStrike.update=function(dt){oldMortarUpdate.call(this,dt);for(var i=0;i<this.shells.length;i++){var s=this.shells[i];if(s.active&&insideWall(s.x,s.y,CONFIG.MORTAR.SHELL_RADIUS))s.active=false;}var fx=root.V004&&root.V004.MortarFX;if(fx)for(var j=0;j<fx.shells.length;j++){var q=fx.shells[j];if(q.active&&q.t>=0&&insideWall(q.x,q.y,CONFIG.MORTAR.SHELL_RADIUS))q.active=false;}};
var oldFieldUpdate=Field.update;
Field.update=function(dt){oldFieldUpdate.call(this,dt);for(var i=0;i<this.shells.length;i++){var s=this.shells[i];if(!s.active)continue;var f=Math.max(0,Math.min(1,s.t/CONFIG.FIELD.SHELL_FLIGHT)),x=s.x+(s.tx-s.x)*f,y=s.y+(s.ty-s.y)*f-Math.sin(f*Math.PI)*120;if(insideWall(x,y,10))s.active=false;}};
var oldFlameFire=FlameWeapon.fire;
FlameWeapon.fire=function(){var original=Combat.hitEnemy;Combat.hitEnemy=function(e,d,x,y){if(!segmentHitsWall(Player.x,Player.y,e.x,e.y,2))original.call(Combat,e,d,x,y);};try{oldFlameFire.call(this);}finally{Combat.hitEnemy=original;}};

// ---------- #50 三主武器独立成长 ----------
var oldDefault=Meta.createDefaultData;
Meta.createDefaultData=function(){var d=oldDefault.call(this);d.weaponLevel={pistol:{lv:1,pts:0},flamer:{lv:0,pts:0},crossbow:{lv:0,pts:0}};d.selectedWeapon='pistol';return d;};
var oldMerge=Meta.mergeSafeData;
Meta.mergeSafeData=function(saved){oldMerge.call(this,saved);var src=saved&&saved.weaponLevel,ids=['pistol','flamer','crossbow'];for(var i=0;i<ids.length;i++){var id=ids[i],v=src&&src[id];if(v){this.data.weaponLevel[id].lv=Math.max(id==='pistol'?1:0,this.safeInt(v.lv,id==='pistol'?1:0));this.data.weaponLevel[id].pts=this.safeInt(v.pts,0);}}if(saved&&(/^(pistol|flamer|crossbow)$/).test(saved.selectedWeapon||''))this.data.selectedWeapon=saved.selectedWeapon;};
var WeaponProgress={selected:'pistol',saveTimer:0,need:function(lv){return Math.floor(40*Math.pow(1.4,Math.max(0,lv-1)));},unlocked:function(id){if(id==='pistol')return true;var lv=Meta.data.weaponLevel.pistol.lv;return id==='flamer'?lv>=5:lv>=10;},addKill:function(type){var d=Meta.data.weaponLevel[this.selected],pts=(type===CONFIG.ENEMY.TYPE_TANK?2:type===CONFIG.ENEMY.TYPE_ELITE?15:(type===CONFIG.ENEMY.TYPE_BOSS||type===CONFIG.ENEMY.TYPE_BOSS_RANGED)?100:1);d.pts+=pts;while(d.pts>=this.need(d.lv)){d.pts-=this.need(d.lv);d.lv++;}this.saveTimer=5;},update:function(dt){if(this.saveTimer>0&&(this.saveTimer-=dt)<=0)Meta.save(false);}};root.WeaponProgress=WeaponProgress;
var oldKill=Enemy.kill;Enemy.kill=function(e){var active=e.active,type=e.typeIndex;oldKill.call(this,e);if(active&&!e.active)WeaponProgress.addKill(type);};
var oldRestart=Game.restart;Game.restart=function(){WeaponProgress.selected=Meta.data.selectedWeapon||'pistol';oldRestart.call(this);FlameWeapon.unlocked=WeaponProgress.selected==='flamer';Crossbow.unlocked=WeaponProgress.selected==='crossbow';};
var oldPulseUpdate=PulseGun.update;PulseGun.update=function(dt){if(WeaponProgress.selected==='pistol')oldPulseUpdate.call(this,dt);};
var oldGameUpdate=Game.update;Game.update=function(dt){if(this.state==='WEAPON_SELECT'){WeaponSelect.update();return;}oldGameUpdate.call(this,dt);WeaponProgress.update(dt);};

var WeaponSelect={cards:[['pistol','脉冲手枪','稳定射击，自动锁定最近敌人'],['flamer','喷火器','近距离扇形持续灼烧'],['crossbow','弩箭','直线贯穿成群敌人']],draw:function(ctx){var top=CONFIG.UI.TOP_INSET||0;ctx.fillStyle='#08110e';ctx.fillRect(0,0,750,CONFIG.VIEW.HEIGHT);UI.drawMenuGlow(ctx);UI.drawActionButton(ctx,24,30+top,132,60,'返回',true,22);UI.drawCenteredText(ctx,'选择主武器',105+top,42,true,'#f4d58d');for(var i=0;i<3;i++){var c=this.cards[i],d=Meta.data.weaponLevel[c[0]],open=WeaponProgress.unlocked(c[0]),y=190+top+i*250,need=WeaponProgress.need(Math.max(1,d.lv));UI.roundedRectPath(ctx,70,y,610,210,22);ctx.fillStyle=open?'#182720':'#161a18';ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=open?'#e9ad58':'#536058';ctx.stroke();text(ctx,open?'◆':'🔒',120,y+65,34,open?'#ffd166':'#82958b','center',true);text(ctx,c[1],175,y+50,28,open?'#fff':'#8d9892','left',true);text(ctx,'Lv.'+d.lv+'  '+d.pts+' / '+need,175,y+88,18,open?'#83d7ff':'#82958b');text(ctx,c[2],175,y+128,17,'#b4c2bc');if(!open)text(ctx,'脉冲手枪等级达到 Lv.'+(c[0]==='flamer'?5:10)+' 解锁',175,y+168,16,'#ffb27a');else UI.drawActionButton(ctx,480,y+135,160,54,'选择',true,18);}},update:function(){var p=tap(),top=CONFIG.UI.TOP_INSET||0;if(!p)return;if(hit(p,24,30+top,132,60)){Input.clearTap();Game.enterMenu();return;}for(var i=0;i<3;i++){var y=190+top+i*250,id=this.cards[i][0];if(hit(p,70,y,610,210)&&WeaponProgress.unlocked(id)){Input.clearTap();Meta.data.selectedWeapon=id;Meta.save(false);Game.restart();return;}}}};root.WeaponSelect=WeaponSelect;
var oldMenuUpdate=Game.updateMenu;Game.updateMenu=function(){if(Meta.offlinePopupActive){oldMenuUpdate.call(this);return;}var p=tap(),c=CONFIG.V006.MENU;if(p){var x=(750-c.BUTTON_W)/2,y=c.BUTTON_Y+(CONFIG.UI.TOP_INSET||0);if(hit(p,x,y,c.BUTTON_W,c.BUTTON_H)){Input.clearTap();this.state='WEAPON_SELECT';Input.setMovementEnabled(false);return;}}oldMenuUpdate.call(this);};
var oldGameDraw=Game.draw;Game.draw=function(){if(this.state==='WEAPON_SELECT'){Platform.beginFrame();WeaponSelect.draw(Platform.ctx);Platform.endFrame();return;}oldGameDraw.call(this);};

// ---------- #51 以玩家为中心的高速旋转光束 ----------
LaserEmitter.reset=function(){this.active=false;this.timer=0;this.tickTimer=0;this.cooldownTimer=0;this.angle=0;};
LaserEmitter.activate=function(){if(this.active||this.cooldownTimer>0)return false;this.active=true;this.angle=-Math.PI/2;this.timer=5+Meta.getGadgetLevel('laser','duration');this.tickTimer=0;return true;};
LaserEmitter.ends=function(){var count=Meta.getGadgetLevel('laser','overload')>0?2:1,out=[];for(var i=0;i<count;i++){var a=this.angle+i*Math.PI,d=rayDistance(Player.x,Player.y,a);out.push({a:a,x:Player.x+Math.cos(a)*d,y:Player.y+Math.sin(a)*d});}return out;};
LaserEmitter.update=function(dt){this.cooldownTimer=Math.max(0,(this.cooldownTimer||0)-dt);if(!this.active)return;var speed=Math.PI*8*(1+.15*Meta.getGadgetLevel('laser','speed'));this.angle=(this.angle+speed*dt)%(Math.PI*2);this.timer-=dt;this.tickTimer-=dt;if(this.tickTimer<=0){this.tickTimer=.05;this.dealDamage();}if(this.timer<=0){this.active=false;this.cooldownTimer=CONFIG.LASER_EMITTER.COOLDOWN*(1-.15*Meta.getGadgetLevel('laser','cooldown'));}};
function selectedMainDamage(){var id=WeaponProgress.selected||Meta.data.selectedWeapon||'pistol';if(id==='flamer')return CONFIG.V005.FLAME.DAMAGE*FlameWeapon.damageMul;if(id==='crossbow')return Crossbow.damage;return PulseGun.getDamage();}
LaserEmitter.dealDamage=function(){var ends=this.ends(),bossMul=1+.25*Meta.getGadgetLevel('laser','bossDamage'),base=selectedMainDamage()*10*bossMul;for(var i=0;i<Enemy.pool.length;i++){var e=Enemy.pool[i];if(!e.active)continue;for(var k=0;k<ends.length;k++){var z=ends[k],dist=root.pointToSegDist?root.pointToSegDist(e.x,e.y,Player.x,Player.y,z.x,z.y):pointSeg(e.x,e.y,Player.x,Player.y,z.x,z.y);if(dist<=e.radius+18){var strong=e.typeIndex===CONFIG.ENEMY.TYPE_ELITE||e.typeIndex===CONFIG.ENEMY.TYPE_BOSS||e.typeIndex===CONFIG.ENEMY.TYPE_BOSS_RANGED;if(strong)Combat.hitEnemyFixed(e,base,e.x,e.y);else Combat.hitEnemyFixed(e,e.hp+1,e.x,e.y);if(root.FX)root.FX.burst(e.x,e.y,'#7ff6ff');break;}}}};
function pointSeg(px,py,x1,y1,x2,y2){var dx=x2-x1,dy=y2-y1,l=dx*dx+dy*dy;if(!l)return Math.hypot(px-x1,py-y1);var t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/l));return Math.hypot(px-(x1+t*dx),py-(y1+t*dy));}
LaserEmitter.draw=function(ctx){if(!this.active)return;var ends=this.ends(),sx=Player.x-Camera.x,sy=Player.y-Camera.y;ctx.save();ctx.lineCap='round';for(var i=0;i<ends.length;i++){var z=ends[i],ex=z.x-Camera.x,ey=z.y-Camera.y;ctx.globalAlpha=.38;ctx.shadowColor='#30dfff';ctx.shadowBlur=16;ctx.strokeStyle='#32d9ff';ctx.lineWidth=30;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.strokeStyle='#ffffff';ctx.lineWidth=7;ctx.stroke();}ctx.fillStyle='#fff';ctx.shadowColor='#39e5ff';ctx.shadowBlur=22;ctx.beginPath();ctx.arc(sx,sy,16,0,Math.PI*2);ctx.fill();ctx.restore();};
var oldPowerActivate=PowerUps.activate;
PowerUps.activate=function(type){if(type===CONFIG.POWERUPS.TYPE_LASER_EMITTER){if(this.inventory[type]<=0||!LaserEmitter.activate())return false;this.inventory[type]-=1;if(root.Objectives)root.Objectives.add('items',1);if(root.Achievements)root.Achievements.add('items',1);return true;}return oldPowerActivate.call(this,type);};

// ---------- #52 波次数量 ----------
Spawner.reset=function(){this.waveIndex=0;this.normalTimer=0;this.waveRest=2;this.waveQuota=0;this.eliteQuota=0;this.eliteTimer=60;};
Spawner.getSpawnInterval=function(t){return Math.max(.25,1.2-t/200);};
Spawner.rollNormalType=function(){var f=Math.min(1,this.waveIndex/15),w=7-2*f,r=2+f,t=1+f,n=Math.random()*(w+r+t);return n<w?CONFIG.ENEMY.TYPE_WALKER:n<w+r?CONFIG.ENEMY.TYPE_RUNNER:CONFIG.ENEMY.TYPE_TANK;};
Spawner.beginWave=function(){this.waveIndex++;this.waveQuota=8+this.waveIndex*4;this.eliteQuota=this.waveIndex>=3?1+Math.floor((this.waveIndex-3)/2):0;this.normalTimer=0;if(root.FX){root.FX.wave=this.waveIndex-1;}};
Spawner.update=function(dt,elapsed){if(this.waveRest>0){this.waveRest-=dt;if(this.waveRest<=0)this.beginWave();return;}this.normalTimer-=dt;var guard=8;while(this.waveQuota>0&&this.normalTimer<=0&&Enemy.activeCount<CONFIG.ENEMY.POOL_SIZE&&guard-->0){if(this.spawnNormal(elapsed))this.waveQuota--;this.normalTimer+=this.getSpawnInterval(elapsed);}if(this.eliteQuota>0&&Enemy.activeCount<CONFIG.ENEMY.POOL_SIZE){if(this.spawnType(CONFIG.ENEMY.TYPE_ELITE,elapsed))this.eliteQuota--;}this.eliteTimer-=dt;if(this.eliteTimer<=0){if(Enemy.activeCount<CONFIG.ENEMY.POOL_SIZE)this.spawnType(CONFIG.ENEMY.TYPE_ELITE,elapsed);this.eliteTimer=60;}if(this.waveQuota<=0&&this.eliteQuota<=0)this.waveRest=2;};

root.V008={WallCollision:root.WallCollision,WeaponProgress:WeaponProgress,WeaponSelect:WeaponSelect};
})();

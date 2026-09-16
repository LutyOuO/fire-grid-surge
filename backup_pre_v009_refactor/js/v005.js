'use strict';
(function () {
// ============================================================
// v005：钻石 / 局内目标 / 喷火器 / 弩箭 / 外观 / 涂装 / 永久成就
// 所有新增实体均使用固定对象池；本模块封装作用域，兼容 H5 普通 script。
// ============================================================
var root=(typeof window!=='undefined')?window:global;
var CONFIG=root.CONFIG,Game=root.Game,UI=root.UI,Input=root.Input,Meta=root.Meta;
var Player=root.Player,Enemy=root.Enemy,Camera=root.Camera,Combat=root.Combat;
var ExpLevelUp=root.ExpLevelUp,RunStats=root.RunStats,Weapons=root.Weapons;
var killSource='';
// v005 新增可调数值统一挂在全局 CONFIG，后续平衡时无需搜索业务函数。
CONFIG.V005={
  OBJECTIVE_COUNT:3, DIAMOND_NOTICE_TIME:2,
  FLAME:{TICK:0.1,DAMAGE:6,RANGE:150,ANGLE:Math.PI/3,BURN_TIME:2,BURN_DPS:3},
  CROSSBOW:{COOLDOWN:1.5,DAMAGE:40,SPEED:700,DECAY:0.1,POOL:48},
  ACHIEVEMENT_COUNT:29, OUTFIT_COUNT:12, SKIN_COUNT:17
};

function hit(p,x,y,w,h){return UI.isPointInRect(p,x,y,w,h);}
function tap(){if(!Input.pendingTap.active)return null;return{x:Input.pendingTap.x,y:Input.pendingTap.y};}
function text(ctx,s,x,y,size,color,align){ctx.fillStyle=color||'#fff';ctx.font=(size||20)+'px Arial,"Microsoft YaHei"';ctx.textAlign=align||'left';ctx.textBaseline='middle';ctx.fillText(s,x,y);}
function panel(ctx,x,y,w,h,r,fill,stroke){UI.roundedRectPath(ctx,x,y,w,h,r||14);ctx.fillStyle=fill||'rgba(10,19,22,.96)';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=stroke||'#55766a';ctx.stroke();}
function diamond(ctx,x,y,size){ctx.save();ctx.translate(x,y);ctx.shadowColor='#3498DB';ctx.shadowBlur=6;ctx.fillStyle='#3498DB';ctx.strokeStyle='#2980B9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.75,0);ctx.lineTo(0,size);ctx.lineTo(-size*.75,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.85)';ctx.beginPath();ctx.moveTo(-size*.2,-size*.45);ctx.lineTo(size*.25,-size*.1);ctx.stroke();ctx.restore();}

// ---------- 配置追加：两把局内武器和强化词条 ----------
var additions=[
 {ID:'UNLOCK_FLAME',TEXT_KEY:'UNLOCK_FLAME',RARITY:'RARE',EFFECT:'UNLOCK_FLAME',MAX_LEVEL:1},
 {ID:'FLAME_DAMAGE',TEXT_KEY:'FLAME_DAMAGE',EFFECT:'FLAME_DAMAGE',MAX_LEVEL:5},
 {ID:'FLAME_RATE',TEXT_KEY:'FLAME_RATE',EFFECT:'FLAME_RATE',MAX_LEVEL:5},
 {ID:'FLAME_ANGLE',TEXT_KEY:'FLAME_ANGLE',EFFECT:'FLAME_ANGLE',MAX_LEVEL:3},
 {ID:'FLAME_RANGE',TEXT_KEY:'FLAME_RANGE',EFFECT:'FLAME_RANGE',MAX_LEVEL:3},
 {ID:'FLAME_BURN',TEXT_KEY:'FLAME_BURN',EFFECT:'FLAME_BURN',MAX_LEVEL:3},
 {ID:'UNLOCK_CROSSBOW',TEXT_KEY:'UNLOCK_CROSSBOW',RARITY:'RARE',EFFECT:'UNLOCK_CROSSBOW',MAX_LEVEL:1},
 {ID:'BOW_DAMAGE',TEXT_KEY:'BOW_DAMAGE',EFFECT:'BOW_DAMAGE',MAX_LEVEL:5},
 {ID:'BOW_RATE',TEXT_KEY:'BOW_RATE',EFFECT:'BOW_RATE',MAX_LEVEL:5},
 {ID:'BOW_COUNT',TEXT_KEY:'BOW_COUNT',EFFECT:'BOW_COUNT',MAX_LEVEL:3},
 {ID:'BOW_DECAY',TEXT_KEY:'BOW_DECAY',EFFECT:'BOW_DECAY',MAX_LEVEL:3},
 {ID:'BOW_CRIT',TEXT_KEY:'BOW_CRIT',EFFECT:'BOW_CRIT',MAX_LEVEL:3}
];
for(var ai=0;ai<additions.length;ai++)CONFIG.UPGRADES.DEFINITIONS.push(additions[ai]);
var names={
 UNLOCK_FLAME:['解锁喷火器','新增自动扇形喷火武器'],FLAME_DAMAGE:['烈焰强化','喷火器伤害 +20%'],FLAME_RATE:['急速喷射','喷火器攻速 +15%'],FLAME_ANGLE:['烈焰扩散','扇形角度 +15°'],FLAME_RANGE:['烈焰延伸','射程 +30px'],FLAME_BURN:['持久灼烧','燃烧持续 +1秒'],
 UNLOCK_CROSSBOW:['解锁弩箭','新增无限穿透弩箭武器'],BOW_DAMAGE:['精准射击','弩箭伤害 +25%'],BOW_RATE:['快速装填','弩箭攻速 +15%'],BOW_COUNT:['连弩','弩箭数量 +1'],BOW_DECAY:['穿透强化','穿透衰减 -10%'],BOW_CRIT:['重击','弩箭暴击率 +10%']
};
for(var nk in names)(function(k){CONFIG.TEXT.UPGRADES[k]={NAME:names[k][0],DESC:function(){return names[k][1];}};})(nk);

// ---------- 钻石反馈 ----------
var DiamondFX={text:'',timer:0,add:function(n,reason){n=Math.max(0,Math.floor(n));if(!n)return;Meta.data.diamonds+=n;var p=Meta.data.achievements&&Meta.data.achievements.progress;if(p)p.diamondsTotal=(p.diamondsTotal||0)+n;Meta.save();this.text=(reason?reason+'  ':'')+'+'+n+' 钻石';this.timer=2;},update:function(dt){this.timer=Math.max(0,this.timer-dt);},draw:function(ctx){if(this.timer<=0)return;var p=1-this.timer/2,b=1+Math.sin(Math.min(1,p/.25)*Math.PI)*.18;ctx.save();ctx.translate(375,235);ctx.scale(b,b);ctx.globalAlpha=Math.min(1,this.timer*2);panel(ctx,-155,-32,310,64,18,'rgba(10,28,42,.94)','#3498DB');diamond(ctx,-112,0,13);text(ctx,this.text,18,0,24,'#83d7ff','center');ctx.restore();}};

// ---------- 每局随机三个小目标 ----------
var Objectives={active:[],collapsed:false,notice:0,last:{kills:0,level:1,wave:0,items:0,dashes:0},
 defs:[
  ['survive120','存活120秒','time',120,5],['kill50','击杀50名敌人','kills',50,5],['level10','升到10级','level',10,5],['exp100','拾取100经验','exp',100,5],['dash3','使用3次冲刺','dash',3,5],['item2','使用2个道具','items',2,5],['coin5','拾取5金币','coins',5,5],['elite1','击杀1只精英','elite',1,5],['rare1','获得1个稀有词条','rare',1,5],['safe30','连续30秒不受伤','safe',30,5],
  ['survive300','存活300秒','time',300,10],['kill200','击杀200名敌人','kills',200,10],['level20','升到20级','level',20,10],['mortar30','迫击炮击杀30','mortar',30,10],['bomb20','炸弹击杀20','bomb',20,10],['dash5','使用5次冲刺','dash',5,10],['item5','使用5个道具','items',5,10],['elite3','击杀3只精英','elite',3,10],['epic1','获得1个史诗词条','epic',1,10],['wave5','坚持到第5波','wave',5,10],['coin500','获得500金币','coins',500,10],['still10','静止10秒不受伤','still',10,10],
  ['survive600','存活600秒','time',600,20],['kill500','击杀500名敌人','kills',500,20],['level30','升到30级','level',30,20],['mortar80','迫击炮击杀80','mortar',80,20],['nodash120','不冲刺存活120秒','nodash',120,20],['boss1','击杀Boss','boss',1,20],['legend1','获得1个传说词条','legend',1,20],['wave10','坚持到第10波','wave',10,20],['extract1','成功撤退','extract',1,20],['coin2000','获得2000金币','coins',2000,20]
 ],stats:{},
 reset:function(){this.active.length=0;this.stats={kills:0,level:1,wave:0,exp:0,dash:0,items:0,coins:0,elite:0,boss:0,rare:0,epic:0,legend:0,mortar:0,bomb:0,extract:0,safe:0,still:0,nodash:0};this.collapsed=false;this.notice=0;var pool=this.defs.slice();for(var i=0;i<3;i++){var n=Math.floor(Math.random()*pool.length),d=pool.splice(n,1)[0];this.active.push({d:d,done:false,flash:0});}},
 add:function(k,n){this.stats[k]=(this.stats[k]||0)+(n||1);},
 update:function(dt){if(Game.state!==CONFIG.GAME.STATE_PLAYING)return;this.stats.time=Game.survivedSeconds;this.stats.level=ExpLevelUp.level;this.stats.wave=root.Spawner.waveIndex;if(Math.hypot(Input.moveX||0,Input.moveY||0)<.05)this.stats.still+=dt;else this.stats.still=0;this.stats.safe+=dt;this.stats.nodash=Game.survivedSeconds-(this.stats.dash?120:0);for(var i=0;i<this.active.length;i++){var o=this.active[i];o.flash=Math.max(0,o.flash-dt);if(!o.done&&(this.stats[o.d[2]]||0)>=o.d[3]){o.done=true;o.flash=.3;DiamondFX.add(o.d[4],'目标完成！');}}this.notice=Math.max(0,this.notice-dt);},
 onDamage:function(){this.stats.safe=0;this.stats.still=0;},
 handle:function(){var p=tap();if(!p)return false;if(hit(p,15,(CONFIG.UI.TOP_INSET||0)+118,260,52)){Input.clearTap();this.collapsed=!this.collapsed;return true;}return false;},
 draw:function(ctx){var y=(CONFIG.UI.TOP_INSET||0)+118,h=this.collapsed?52:218;ctx.save();panel(ctx,15,y,260,h,10,'rgba(7,15,18,.82)','rgba(255,255,255,.55)');text(ctx,'本局目标',34,y+26,18,'#fff');var done=0;for(var i=0;i<this.active.length;i++)if(this.active[i].done)done++;text(ctx,done+'/3',225,y+26,15,'#7dffad','center');text(ctx,this.collapsed?'＋':'－',254,y+26,22,'#fff','center');if(!this.collapsed)for(var j=0;j<this.active.length;j++){var o=this.active[j],yy=y+55+j*52,val=Math.min(o.d[3],Math.floor(this.stats[o.d[2]]||0)),ratio=val/o.d[3];ctx.fillStyle=o.done?'rgba(47,201,102,.18)':'rgba(20,34,38,.85)';ctx.fillRect(24,yy,242,45);text(ctx,o.done?'✓':'◆',36,yy+17,15,o.done?'#59e58a':'#b6c5be');text(ctx,o.d[1],53,yy+13,13,'#f4fff7');text(ctx,o.done?'已完成':val+'/'+o.d[3],53,yy+31,11,o.done?'#59e58a':'#aabbb3');diamond(ctx,225,yy+15,7);text(ctx,String(o.d[4]),244,yy+15,12,'#83d7ff','center');ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(53,yy+39,192,3);ctx.fillStyle=o.done?'#59e58a':'#3498DB';ctx.fillRect(53,yy+39,192*Math.min(1,ratio),3);}ctx.restore();}
};

// ---------- 喷火器：固定频率扇形判定，不创建临时数组 ----------
var FlameWeapon={unlocked:false,timer:0,damageMul:1,rate:1,angle:CONFIG.V005.FLAME.ANGLE,range:CONFIG.V005.FLAME.RANGE,burnLife:CONFIG.V005.FLAME.BURN_TIME,burns:[],visual:0,
 init:function(){for(var i=0;i<260;i++)this.burns.push({active:false,time:0,tick:0});},
 reset:function(){this.unlocked=false;this.timer=0;this.damageMul=1;this.rate=1;this.angle=CONFIG.V005.FLAME.ANGLE;this.range=CONFIG.V005.FLAME.RANGE;this.burnLife=CONFIG.V005.FLAME.BURN_TIME;this.visual=0;for(var i=0;i<this.burns.length;i++)this.burns[i].active=false;},
 update:function(dt){for(var i=0;i<this.burns.length;i++){var b=this.burns[i];if(!b.active)continue;b.time-=dt;b.tick-=dt;var e=Enemy.pool[i];if(!e||!e.active||b.time<=0){b.active=false;continue;}if(b.tick<=0){b.tick=.2;Combat.hitEnemyFixed(e,3*.2*(1+(root.W8&&root.W8.dmgBonusFor?root.W8.dmgBonusFor('flame'):0)),e.x,e.y);}}if(!this.unlocked)return;this.timer-=dt;this.visual=Math.max(0,this.visual-dt);if(this.timer<=0){this.timer=.1/(this.rate*(1+(root.W8&&root.W8.rateBonusFor?root.W8.rateBonusFor('flame'):0)));this.fire();}},
 fire:function(){var target=Enemy.findNearest(Player.x,Player.y);if(!target)return;var a=Math.atan2(target.y-Player.y,target.x-Player.x),half=this.angle/2;this.aim=a;this.visual=.22;killSource='flame';for(var i=0;i<Enemy.pool.length;i++){var e=Enemy.pool[i];if(!e.active)continue;var dx=e.x-Player.x,dy=e.y-Player.y,dist=Math.hypot(dx,dy);if(dist>this.range+e.radius)continue;var da=Math.atan2(Math.sin(Math.atan2(dy,dx)-a),Math.cos(Math.atan2(dy,dx)-a));if(Math.abs(da)<=half){Combat.hitEnemy(e,CONFIG.V005.FLAME.DAMAGE*this.damageMul*(1+(root.W8&&root.W8.dmgBonusFor?root.W8.dmgBonusFor('flame'):0)),e.x,e.y);var b=this.burns[i];b.active=true;b.time=this.burnLife;b.tick=.2;}}killSource='';},
 draw:function(ctx){if(!this.unlocked||this.visual<=0)return;var x=Player.x-Camera.x,y=Player.y-Camera.y,a=this.aim,half=this.angle/2;ctx.save();ctx.globalAlpha=Math.min(1,this.visual/.12);var g=ctx.createRadialGradient(x,y,5,x,y,this.range);root.safeStop(g,0,'rgba(255,245,100,.9)');root.safeStop(g,.55,'rgba(255,140,30,.65)');root.safeStop(g,1,'rgba(230,45,15,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,this.range,a-half,a+half);ctx.closePath();ctx.fill();ctx.restore();}
};FlameWeapon.init();

// ---------- 弩箭：固定对象池，无限穿透，到世界边界回收 ----------
var Crossbow={unlocked:false,timer:0,damage:CONFIG.V005.CROSSBOW.DAMAGE,rate:1,count:1,decay:CONFIG.V005.CROSSBOW.DECAY,crit:0,arrows:[],
 init:function(){for(var i=0;i<CONFIG.V005.CROSSBOW.POOL;i++)this.arrows.push({active:false,x:0,y:0,vx:0,vy:0,damage:0,angle:0,hitIds:[],hitCount:0});},reset:function(){this.unlocked=false;this.timer=0;this.damage=CONFIG.V005.CROSSBOW.DAMAGE;this.rate=1;this.count=1;this.decay=CONFIG.V005.CROSSBOW.DECAY;this.crit=0;for(var i=0;i<this.arrows.length;i++){this.arrows[i].active=false;this.arrows[i].hitCount=0;}},
 spawn:function(a){for(var i=0;i<this.arrows.length;i++){var b=this.arrows[i];if(b.active)continue;b.active=true;b.x=Player.x;b.y=Player.y;b.vx=Math.cos(a)*700;b.vy=Math.sin(a)*700;b.angle=a;b.damage=this.damage;b.hitCount=0;return;}},
 fire:function(){var e=Enemy.findNearest(Player.x,Player.y);if(!e)return;var a=Math.atan2(e.y-Player.y,e.x-Player.x);for(var n=0;n<this.count;n++)this.spawn(a+(n-(this.count-1)/2)*.08);},
 update:function(dt){if(this.unlocked){this.timer-=dt;if(this.timer<=0){this.timer=CONFIG.V005.CROSSBOW.COOLDOWN/(this.rate*(1+(root.W8&&root.W8.rateBonusFor?root.W8.rateBonusFor('crossbow'):0)));this.fire();}}for(var i=0;i<this.arrows.length;i++){var b=this.arrows[i];if(!b.active)continue;b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.x<0||b.x>CONFIG.WORLD.WIDTH||b.y<0||b.y>CONFIG.WORLD.HEIGHT){b.active=false;continue;}for(var j=0;j<Enemy.pool.length;j++){var e=Enemy.pool[j];if(!e.active||this.wasHit(b,e.spawnId))continue;var dx=e.x-b.x,dy=e.y-b.y,r=e.radius+8;if(dx*dx+dy*dy<=r*r){b.hitIds[b.hitCount++]=e.spawnId;var d=b.damage*(1+(root.W8&&root.W8.dmgBonusFor?root.W8.dmgBonusFor('crossbow'):0))*(1+Player.globalDamageBonus)*(1+Meta.getEffectTotal('WEAPON_DAMAGE'));if(Math.random()<Player.critChance+this.crit)d*=CONFIG.PLAYER.CRIT_MULTIPLIER+Player.critDamageBonus;killSource='bow';Combat.hitEnemyFixed(e,d,e.x,e.y);killSource='';b.damage*=Math.max(0,1-this.decay);}}}},
 wasHit:function(b,id){for(var i=0;i<b.hitCount;i++)if(b.hitIds[i]===id)return true;return false;},
 draw:function(ctx){ctx.save();for(var i=0;i<this.arrows.length;i++){var b=this.arrows[i];if(!b.active)continue;ctx.save();ctx.translate(b.x-Camera.x,b.y-Camera.y);ctx.rotate(b.angle);ctx.strokeStyle='#e6e6e6';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-14,0);ctx.lineTo(12,0);ctx.stroke();ctx.fillStyle='#bdc3c7';ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(7,-5);ctx.lineTo(7,5);ctx.closePath();ctx.fill();ctx.fillStyle='#8b5a2b';ctx.fillRect(-13,-2,20,4);ctx.restore();}ctx.restore();}
};Crossbow.init();

// 词条应用
var oldApply=ExpLevelUp.applyUpgrade;ExpLevelUp.applyUpgrade=function(d,r){oldApply.call(this,d,r);var e=d.EFFECT;if(e==='UNLOCK_FLAME')FlameWeapon.unlocked=true;else if(e==='FLAME_DAMAGE')FlameWeapon.damageMul*=1.2;else if(e==='FLAME_RATE')FlameWeapon.rate*=1.15;else if(e==='FLAME_ANGLE')FlameWeapon.angle+=Math.PI/12;else if(e==='FLAME_RANGE')FlameWeapon.range+=30;else if(e==='FLAME_BURN')FlameWeapon.burnLife+=1;else if(e==='UNLOCK_CROSSBOW')Crossbow.unlocked=true;else if(e==='BOW_DAMAGE')Crossbow.damage*=1.25;else if(e==='BOW_RATE')Crossbow.rate*=1.15;else if(e==='BOW_COUNT')Crossbow.count+=1;else if(e==='BOW_DECAY')Crossbow.decay=Math.max(0,Crossbow.decay-.1);else if(e==='BOW_CRIT')Crossbow.crit+=.1;var id=r&&r.ID;if(id==='RARE'||id==='EPIC'||id==='LEGENDARY')Objectives.add(id==='RARE'?'rare':id==='EPIC'?'epic':'legend',1);};

// ---------- 永久成就（29项） ----------
var Achievements={open:false,scroll:0,defs:[],toast:'',toastTime:0,
 init:function(){var rows=[
 ['A1','初出茅庐','累计击杀50','kills',50,'coins',50],['A2','百人斩','累计击杀100','kills',100,'skin','pulse_silver'],['A3','千人斩','累计击杀1000','kills',1000,'diamonds',100],['A4','万人斩','累计击杀10000','kills',10000,'diamonds',200],['A5','精英猎人','击杀50精英','elite',50,'diamonds',100],['A6','精英克星','击杀200精英','elite',200,'skin','blade_blood'],['A7','Boss终结者','击杀10 Boss','boss',10,'skin','pulse_gold'],['A8','炮火洗礼','迫击炮击杀500','mortar',500,'skin','flame_hell'],
 ['A9','幸存者','累计存活1小时','time',3600,'coins',100],['A10','坚韧不拔','累计存活10小时','time',36000,'outfit','special'],['A11','马拉松','单局存活600秒','bestTime',600,'diamonds',100],['A12','毫发无伤','连续60秒不受伤','safe',60,'diamonds',50],['A13','不死鸟','单局复活3次','revives',3,'outfit','ninja'],
 ['A14','小富翁','累计获得10000金币','coinsTotal',10000,'coins',200],['A15','大富翁','累计获得100000金币','coinsTotal',100000,'skin','blade_thunder'],['A16','钻石收藏家','累计获得100钻石','diamondsTotal',100,'diamonds',50],['A17','道具猎人','拾取100道具','items',100,'skin','bow_hunter'],['A18','经验大师','拾取10000经验','exp',10000,'diamonds',100],
 ['A19','等级突破','单局20级','bestLevel',20,'coins',50],['A20','满级大佬','单局50级','bestLevel',50,'diamonds',200],['A21','波次征服者','单局第10波','bestWave',10,'outfit','mechanic'],['A22','终极挑战','单局第20波','bestWave',20,'outfit','gold'],['A23','词条收藏家','单局5史诗','epicRun',5,'diamonds',100],['A24','天选之人','单局3传说','legendRun',3,'skin','bow_holy'],
 ['A25','战略家','撤退10次','extract',10,'skin','flame_frost'],['A26','神枪手','弩箭单局击杀100','bowRun',100,'diamonds',50],['A27','烈焰法师','喷火器单局击杀200','flameRun',200,'diamonds',100],['A28','服装收藏家','拥有5套服装','outfits',5,'diamonds',100],['A29','涂装收藏家','拥有5个涂装','skins',5,'skin','blade_void']];for(var i=0;i<rows.length;i++)this.defs.push(rows[i]);},
 add:function(k,n){var p=Meta.data.achievements.progress;p[k]=(p[k]||0)+(n||1);this.check();},set:function(k,n){var p=Meta.data.achievements.progress;p[k]=Math.max(p[k]||0,n);this.check();},
 check:function(){var p=Meta.data.achievements.progress,c=Meta.data.achievements.completed,changed=false;for(var i=0;i<this.defs.length;i++){var d=this.defs[i];if(c.indexOf(d[0])>=0||(p[d[3]]||0)<d[4])continue;c.push(d[0]);this.reward(d);this.toast='成就解锁：'+d[1];this.toastTime=3;changed=true;}if(changed)Meta.save(false);},
 reward:function(d){var t=d[5],v=d[6];if(t==='coins')Meta.data.coins+=v;else if(t==='diamonds'){Meta.data.diamonds+=v;Meta.data.achievements.progress.diamondsTotal=(Meta.data.achievements.progress.diamondsTotal||0)+v;}else if(t==='outfit')Wardrobe.ownOutfit(v);else if(t==='skin')Wardrobe.ownSkin(v);},
 drawToast:function(ctx){if(this.toastTime<=0)return;panel(ctx,145,285,460,75,18,'rgba(45,34,12,.95)','#ffd54a');text(ctx,'🏆 '+this.toast,375,322,23,'#ffe49a','center');},
 draw:function(ctx){ctx.save();ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(0,0,750,CONFIG.VIEW.HEIGHT);var y=Math.max(170,CONFIG.VIEW.HEIGHT*.22),h=CONFIG.VIEW.HEIGHT-y;panel(ctx,30,y,690,h,24,'#111d1a','#d6aa55');text(ctx,'永久成就',70,y+48,34,'#f4d58d');text(ctx,'已完成 '+Meta.data.achievements.completed.length+' / 29',520,y+48,18,'#ffd54a','center');text(ctx,'×',680,y+48,34,'#fff','center');var start=Math.floor(this.scroll),firstY=y+95;for(var i=0;i<7;i++){var d=this.defs[start+i];if(!d)break;var yy=firstY+i*92,done=Meta.data.achievements.completed.indexOf(d[0])>=0,val=Math.min(d[4],Math.floor(Meta.data.achievements.progress[d[3]]||0));panel(ctx,52,yy,646,80,12,done?'rgba(107,84,25,.45)':'#18231f',done?'#d6aa55':'#40584e');text(ctx,done?'✓':'◇',74,yy+40,24,done?'#ffd54a':'#71837b','center');text(ctx,d[1],103,yy+25,19,done?'#ffe49a':'#fff');text(ctx,d[2]+'  '+val+'/'+d[4],103,yy+54,14,'#afbeb7');text(ctx,done?'已完成':'进行中',650,yy+40,15,done?'#59e58a':'#9eaaa4','right');}ctx.restore();},
 handle:function(){var p=tap();if(!p)return;if(p.y<260&&p.x>620){Input.clearTap();this.open=false;return;}if(p.y>CONFIG.VIEW.HEIGHT*.72){Input.clearTap();this.scroll=Math.min(this.defs.length-7,this.scroll+1);}else if(p.y>CONFIG.VIEW.HEIGHT*.22){Input.clearTap();this.scroll=Math.max(0,this.scroll-1);}}
};Achievements.init();

// ---------- 服装与涂装：纯外观，不改属性 ----------
var Wardrobe={open:false,mode:'outfit',index:0,
 outfits:[['default','默认幸存者','COMMON','free',0],['cowboy','西部牛仔','COMMON','coins',800],['firefighter','消防员','COMMON','coins',1200],['special','特种兵','RARE','coins',3000],['medic','战地医生','RARE','coins',3500],['ninja','忍者','RARE','coins',4000],['punk','朋克','RARE','coins',5000],['hunter','荒野猎人','EPIC','diamonds',80],['mechanic','机械师','EPIC','diamonds',100],['necromancer','亡灵法师','EPIC','diamonds',120],['gold','黄金幸存者','LEGENDARY','diamonds',300],['shadow','暗影刺客','LEGENDARY','diamonds',500]],
 skins:[['default','手枪默认','pulse','free',0],['pulse_silver','银色杀手','pulse','coins',2000],['pulse_red','烈焰红','pulse','coins',3000],['pulse_blue','冰霜蓝','pulse','diamonds',80],['pulse_gold','黄金沙鹰','pulse','achievement',0],['default','飞刃默认','blade','free',0],['blade_blood','血刃','blade','achievement',0],['blade_thunder','雷霆刃','blade','achievement',0],['blade_void','虚空刃','blade','achievement',0],['default','喷火器默认','flame','free',0],['flame_green','军用绿','flame','coins',2500],['flame_hell','地狱火','flame','achievement',0],['flame_frost','极寒喷射','flame','achievement',0],['default','弩箭默认','crossbow','free',0],['bow_hunter','猎人棕','crossbow','achievement',0],['bow_machine','机械弩','crossbow','diamonds',80],['bow_holy','圣光弩','crossbow','achievement',0]],
 ownOutfit:function(id){if(Meta.data.ownedOutfits.indexOf(id)<0)Meta.data.ownedOutfits.push(id);},ownSkin:function(id){for(var i=0;i<this.skins.length;i++)if(this.skins[i][0]===id){var w=this.skins[i][2],a=Meta.data.ownedSkins[w];if(a.indexOf(id)<0)a.push(id);}},
 buyOrEquip:function(){if(this.mode==='outfit'){var d=this.outfits[this.index],owned=Meta.data.ownedOutfits.indexOf(d[0])>=0;if(owned)Meta.data.currentOutfit=d[0];else if(d[3]!=='free'&&Meta.data[d[3]]>=d[4]){Meta.data[d[3]]-=d[4];this.ownOutfit(d[0]);Meta.data.currentOutfit=d[0];}}else{var s=this.skins[this.index],list=Meta.data.ownedSkins[s[2]],own=list.indexOf(s[0])>=0;if(own)Meta.data.equippedSkins[s[2]]=s[0];else if(s[3]!=='achievement'&&Meta.data[s[3]]>=s[4]){Meta.data[s[3]]-=s[4];this.ownSkin(s[0]);Meta.data.equippedSkins[s[2]]=s[0];}}applyEquippedLooks();Meta.save();},
 draw:function(ctx){ctx.save();ctx.fillStyle='rgba(0,0,0,.74)';ctx.fillRect(0,0,750,CONFIG.VIEW.HEIGHT);panel(ctx,38,150,674,CONFIG.VIEW.HEIGHT-190,24,'#111d1a','#4e8067');text(ctx,'外观仓库',75,200,34,'#f4fff7');text(ctx,'×',670,200,34,'#fff','center');UI.drawActionButton(ctx,85,240,270,58,'角色服装',this.mode==='outfit',20);UI.drawActionButton(ctx,395,240,270,58,'武器涂装',this.mode==='skin',20);var list=this.mode==='outfit'?this.outfits:this.skins;this.index=Math.max(0,Math.min(list.length-1,this.index));var d=list[this.index],name=d[1];text(ctx,'‹',92,530,50,'#ffd166','center');text(ctx,'›',658,530,50,'#ffd166','center');diamond(ctx,375,410,50);text(ctx,name,375,505,30,'#fff','center');text(ctx,(this.index+1)+' / '+list.length,375,552,18,'#9fb1a8','center');var own=this.mode==='outfit'?Meta.data.ownedOutfits.indexOf(d[0])>=0:Meta.data.ownedSkins[d[2]].indexOf(d[0])>=0;var equipped=this.mode==='outfit'?Meta.data.currentOutfit===d[0]:Meta.data.equippedSkins[d[2]]===d[0];var currency=this.mode==='outfit'?d[3]:d[3],price=this.mode==='outfit'?d[4]:d[4];var label=equipped?'已装备':own?'装备':currency==='achievement'?'成就解锁':currency==='free'?'拥有':('购买 '+price+(currency==='diamonds'?' 钻石':' 金币'));UI.drawActionButton(ctx,170,620,410,78,label,!equipped&&currency!=='achievement',24);text(ctx,'服装与涂装只改变外观，不提供属性加成',375,735,17,'#aebdb6','center');ctx.restore();},
 handle:function(){var p=tap();if(!p)return;if(p.x>625&&p.y<235){Input.clearTap();this.open=false;return;}if(hit(p,85,240,270,58)){Input.clearTap();this.mode='outfit';this.index=0;return;}if(hit(p,395,240,270,58)){Input.clearTap();this.mode='skin';this.index=0;return;}if(hit(p,45,450,110,180)){Input.clearTap();this.index=Math.max(0,this.index-1);return;}if(hit(p,595,450,110,180)){Input.clearTap();var l=this.mode==='outfit'?this.outfits:this.skins;this.index=Math.min(l.length-1,this.index+1);return;}if(hit(p,170,620,410,78)){Input.clearTap();this.buyOrEquip();}}
};

// 已装备外观仅改变 Canvas 绘制颜色和装饰，不参与任何数值计算。
var OutfitColors={default:'#4a5d4e',cowboy:'#8b5a2b',firefighter:'#c94b36',special:'#365d45',medic:'#e8eee8',ninja:'#24252d',punk:'#8e44ad',hunter:'#6b4d2e',mechanic:'#607d8b',necromancer:'#4b286d',gold:'#d6aa28',shadow:'#182038'};
var defaultLooks={player:CONFIG.COLORS.PLAYER_BODY,gun:CONFIG.COLORS.WEAPON_GUN,core:CONFIG.COLORS.WEAPON_CORE,blade:CONFIG.COLORS.WEAPON_BLADE};
function applyEquippedLooks(){var outfit=Meta.data.currentOutfit||'default';CONFIG.COLORS.PLAYER_BODY=OutfitColors[outfit]||defaultLooks.player;var pulse=Meta.data.equippedSkins.pulse,blade=Meta.data.equippedSkins.blade;CONFIG.COLORS.WEAPON_GUN=pulse==='pulse_silver'?'#d7dde2':pulse==='pulse_red'?'#b9362b':pulse==='pulse_blue'?'#2980b9':pulse==='pulse_gold'?'#d6aa28':defaultLooks.gun;CONFIG.COLORS.WEAPON_CORE=pulse==='pulse_blue'?'#8ee8ff':pulse==='pulse_red'?'#ff8a4c':defaultLooks.core;CONFIG.COLORS.WEAPON_BLADE=blade==='blade_blood'?'#b32635':blade==='blade_thunder'?'#65c7ff':blade==='blade_void'?'#8e44ad':defaultLooks.blade;}
// 供后续界面在购买或装备后立即刷新外观。
root.applyEquippedLooks=applyEquippedLooks;
var oldPlayerDraw=Player.draw;Player.draw=function(ctx){oldPlayerDraw.call(this,ctx);var id=Meta.data&&Meta.data.currentOutfit;if(!id||id==='default')return;var x=this.x-Camera.x+this.renderOffsetX+this.recoilX,y=this.y-Camera.y+this.renderOffsetY+this.recoilY+this.bobOffset;ctx.save();ctx.translate(x,y);ctx.rotate(this.facingAngle);if(id==='cowboy'){ctx.fillStyle='#6b421f';ctx.fillRect(-8,-18,16,5);ctx.fillRect(-13,-15,26,4);}else if(id==='firefighter'){ctx.fillStyle='#e74c3c';ctx.fillRect(-9,-18,18,7);ctx.fillStyle='#ffd54a';ctx.fillRect(-7,-15,14,2);}else if(id==='ninja'||id==='shadow'){ctx.fillStyle=id==='shadow'?'#513080':'#111';ctx.beginPath();ctx.moveTo(-9,-4);ctx.lineTo(-22,-10);ctx.lineTo(-15,2);ctx.fill();}else if(id==='gold'||id==='necromancer'){ctx.globalAlpha=.55+.2*Math.sin(Date.now()/180);ctx.strokeStyle=id==='gold'?'#ffd54a':'#b86bff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,27,0,Math.PI*2);ctx.stroke();}else{ctx.fillStyle=OutfitColors[id]||'#fff';ctx.fillRect(-10,-16,20,4);}ctx.restore();};
var oldEnemyDrawOne=Enemy.drawOne;Enemy.drawOne=function(ctx,e){var x=e.x-Camera.x,y=e.y-Camera.y;ctx.save();ctx.globalAlpha=e.typeIndex>=CONFIG.ENEMY.TYPE_ELITE?.38:.24;ctx.fillStyle='#000';ctx.beginPath();ctx.save();ctx.translate(x,y+e.radius*.7);ctx.scale(1,.36);ctx.arc(0,0,e.radius*.85,0,Math.PI*2);ctx.restore();ctx.fill();ctx.restore();ctx.save();ctx.translate(x,y);ctx.scale(1,.85);ctx.translate(-x,-y);oldEnemyDrawOne.call(this,ctx,e);ctx.restore();};

// ---------- 生命周期、统计与渲染接入 ----------
var oldRestart=Game.restart;Game.restart=function(){applyEquippedLooks();oldRestart.call(this);Objectives.reset();FlameWeapon.reset();Crossbow.reset();};
var oldUpdatePlaying=Game.updatePlaying;Game.updatePlaying=function(dt){var hp=Player.hp,k=RunStats.kills,level=ExpLevelUp.level;oldUpdatePlaying.call(this,dt);if(Game.state===CONFIG.GAME.STATE_PLAYING){FlameWeapon.update(dt);Crossbow.update(dt);Objectives.stats.kills=RunStats.kills;Objectives.stats.level=ExpLevelUp.level;Objectives.stats.wave=root.Spawner.waveIndex;Objectives.update(dt);DiamondFX.update(dt);if(Player.hp<hp)Objectives.onDamage();if(RunStats.kills>k)Achievements.add('kills',RunStats.kills-k);Achievements.set('bestLevel',ExpLevelUp.level);Achievements.set('bestWave',root.Spawner.waveIndex);Achievements.set('safe',Objectives.stats.safe);}};
var oldDash=Player.startDash;Player.startDash=function(){var ok=oldDash.call(this);if(ok){Objectives.add('dash',1);Achievements.add('dash',1);}return ok;};
var oldDamage=Player.takeDamage;Player.takeDamage=function(a,s){var ok=oldDamage.call(this,a,s);if(ok)Objectives.onDamage();return ok;};
var oldEnemyKill=Enemy.kill;Enemy.kill=function(e){var type=e.typeIndex,source=killSource;oldEnemyKill.call(this,e);if(source){Objectives.add(source,1);Achievements.add(source==='flame'?'flameRun':source==='bow'?'bowRun':source,1);}if(type===CONFIG.ENEMY.TYPE_ELITE){Objectives.add('elite',1);Achievements.add('elite',1);}if(type===CONFIG.ENEMY.TYPE_BOSS||type===CONFIG.ENEMY.TYPE_BOSS_RANGED){Objectives.add('boss',1);Achievements.add('boss',1);}};
var oldPowerActivate=root.PowerUps.activate;root.PowerUps.activate=function(i){var before=this.inventory[i]||0,ret=oldPowerActivate.call(this,i);if((this.inventory[i]||0)<before){Objectives.add('items',1);Achievements.add('items',1);}return ret;};
var oldBomb=root.PowerUps.useBomb;root.PowerUps.useBomb=function(){killSource='bomb';var r=oldBomb.call(this);killSource='';return r;};
var oldMortarExplode=root.MortarStrike._explode;root.MortarStrike._explode=function(s){killSource='mortar';var r=oldMortarExplode.call(this,s);killSource='';return r;};
var oldPowerCollect=root.PowerUps.collect;root.PowerUps.collect=function(item){Objectives.add('items',1);Achievements.add('items',1);return oldPowerCollect.call(this,item);};
var oldCoinMove=root.CoinDrops.moveCoin;root.CoinDrops.moveCoin=function(coin,dx,dy,distance,dt){var value=coin.value||0,was=coin.active;oldCoinMove.call(this,coin,dx,dy,distance,dt);if(was&&!coin.active){Objectives.add('coins',value);Achievements.add('coinsTotal',value);}};
var oldCollectGem=root.Experience.collectGem;root.Experience.collectGem=function(g){Objectives.add('exp',g.value||1);Achievements.add('exp',g.value||1);oldCollectGem.call(this,g);};
var oldSettle=Meta.settleRun;Meta.settleRun=function(sec,k,w,c){oldSettle.call(this,sec,k,w,c);Achievements.add('time',sec);Achievements.add('coinsTotal',c);Achievements.set('bestTime',sec);Achievements.set('bestWave',w);if(Game.exitType==='extract'){Objectives.add('extract',1);Achievements.add('extract',1);}Achievements.check();Meta.save(false);};

var oldWeaponsDraw=Weapons.draw;
Weapons.draw=(function(base){return function(ctx){base.call(this,ctx);FlameWeapon.draw(ctx);Crossbow.draw(ctx);};})(oldWeaponsDraw);

var oldUIDrawHud=UI.drawHud;UI.drawHud=function(ctx){oldUIDrawHud.call(this,ctx);Objectives.draw(ctx);DiamondFX.draw(ctx);Achievements.drawToast(ctx);};
var oldDrawMenu=UI.drawMenu;UI.drawMenu=function(ctx){oldDrawMenu.call(this,ctx);diamond(ctx,438,505,10);text(ctx,String(Meta.data.diamonds),458,505,18,'#83d7ff');};
// 基地第三个“服装”Tab：保留原两页逻辑，同时按文档提供独立外观入口。
UI.getBaseTabRects=function(top){var y=CONFIG.UI.BASE_TAB_Y+top,w=222,g=12;return[{x:30,y:y,w:w,h:CONFIG.UI.BASE_TAB_HEIGHT},{x:30+w+g,y:y,w:w,h:CONFIG.UI.BASE_TAB_HEIGHT},{x:30+(w+g)*2,y:y,w:w,h:CONFIG.UI.BASE_TAB_HEIGHT}];};
var oldDrawBase=UI.drawBase;UI.drawBase=function(ctx){oldDrawBase.call(this,ctx);var top=CONFIG.UI.TOP_INSET||0,r=this.getBaseTabRects(top)[2];this.drawActionButton(ctx,r.x,r.y,r.w,r.h,'服装',true,20);diamond(ctx,500,126+top,10);text(ctx,String(Meta.data.diamonds),520,126+top,18,'#83d7ff');};
var oldUpdateBase=Game.updateBase;Game.updateBase=function(dt){if(Wardrobe.open){Wardrobe.handle();return;}var p=tap(),top=CONFIG.UI.TOP_INSET||0,r=UI.getBaseTabRects(top)[2];if(p&&hit(p,r.x,r.y,r.w,r.h)){Input.clearTap();Wardrobe.open=true;return;}oldUpdateBase.call(this,dt);};
var oldGameUpdate=Game.update;Game.update=function(dt){if(Game.state===CONFIG.GAME.STATE_PLAYING&&Objectives.handle())return;oldGameUpdate.call(this,dt);Achievements.toastTime=Math.max(0,Achievements.toastTime-dt);};

root.DiamondFX=DiamondFX;root.Objectives=Objectives;root.FlameWeapon=FlameWeapon;root.Crossbow=Crossbow;root.Achievements=Achievements;root.Wardrobe=Wardrobe;
})();

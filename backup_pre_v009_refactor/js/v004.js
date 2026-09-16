'use strict';
(function () {
// ============================================================
// v004：隐藏开发者控制台 / 结算命运抽牌 / 迫击炮表现增强
// ============================================================
var root = (typeof window !== 'undefined') ? window : global;
var CONFIG = root.CONFIG, UI = root.UI, Input = root.Input, Game = root.Game;
var Platform = root.Platform, Camera = root.Camera;
var Player = root.Player, Enemy = root.Enemy, Spawner = root.Spawner;
var Meta = root.Meta, ExpLevelUp = root.ExpLevelUp, PowerUps = root.PowerUps;
var PulseGun = root.PulseGun, OrbitBlade = root.OrbitBlade, Ads = root.Ads;

var V4C = {
  CARD_X: 95, CARD_Y: 260, CARD_W: 160, CARD_H: 220, CARD_GAP: 20,
  DEV_X: 690, DEV_Y: 58, DEV_SIZE: 40,
  PANEL_X: 55, PANEL_Y: 165, PANEL_W: 640, PANEL_H: 1010
};

function button(ctx, x, y, w, h, text, enabled, size) {
  UI.drawActionButton(ctx, x, y, w, h, text, enabled !== false, size || 20);
}
function inRect(p, x, y, w, h) { return UI.isPointInRect(p, x, y, w, h); }
function centered(ctx, text, y, size, color) {
  UI.drawCenteredText(ctx, text, y, size, true, color || CONFIG.COLORS.TEXT);
}
function fateTop() {
  var h = CONFIG.VIEW.HEIGHT, top = CONFIG.UI.TOP_INSET || 0, bottom = CONFIG.UI.BOTTOM_INSET || 0;
  var y = Math.max(top + 115, Math.min(260, h - bottom - 965));
  V4C.CARD_Y = y;
  return y;
}
function devButtonY() { return (CONFIG.UI.TOP_INSET || 0) + 175; }
function skipLevelY() { return Math.min(1215, CONFIG.VIEW.HEIGHT - (CONFIG.UI.BOTTOM_INSET || 0) - 66); }
function skipFateY() { return CONFIG.UI.RESTART_Y + 112; }

// ---------- #20 隐藏式开发者控制台 ----------
var DevConsole = {
  active: false, open: false, taps: [], god: false, timeScale: 1, clearConfirm: false,
  toggleActivation: function () {
    this.active = !this.active; this.open = false; this.taps.length = 0; this.clearConfirm = false;
    if (!this.active) { this.god = false; this.timeScale = 1; }
    Meta.showToast(this.active ? '开发者控制台已激活' : '开发者控制台已隐藏');
  },
  logoTap: function () {
    var now = Date.now(); this.taps.push(now);
    while (this.taps.length && now - this.taps[0] >= 500) this.taps.shift();
    if (this.taps.length >= 5) this.toggleActivation();
  },
  handleInput: function () {
    if (!Input.pendingTap.active || Ads.active) return false;
    var p = { x: Input.pendingTap.x, y: Input.pendingTap.y };
    if (Game.state === CONFIG.GAME.STATE_MENU && !this.open && inRect(p, 90, 60, 570, 250)) {
      Input.clearTap(); this.logoTap(); return true;
    }
    if (this.active && !this.open && inRect(p, V4C.DEV_X - 20, devButtonY() - 20, 40, 40)) {
      Input.clearTap(); this.open = true; return true;
    }
    if (!this.open) return false;
    Input.clearTap();
    if (!inRect(p, V4C.PANEL_X, V4C.PANEL_Y, V4C.PANEL_W, V4C.PANEL_H) ||
        inRect(p, 635, 180, 42, 42)) { this.open = false; this.clearConfirm = false; return true; }
    this.activateAt(p);
    return true;
  },
  activateAt: function (p) {
    var levels = [10, 20, 50, 100];
    for (var i = 0; i < 4; i++) if (inRect(p, 85 + i * 145, 280, 125, 62)) this.addLevels(levels[i]);
    if (inRect(p, 85, 385, 270, 66)) this.god = !this.god;
    if (inRect(p, 395, 385, 270, 66)) { Meta.data.coins += 10000; Meta.save(); }
    if (inRect(p, 85, 490, 270, 66)) this.maxMeta();
    if (inRect(p, 395, 490, 125, 66)) this.spawn(CONFIG.ENEMY.TYPE_ELITE);
    if (inRect(p, 540, 490, 125, 66)) this.spawn(CONFIG.ENEMY.TYPE_BOSS);
    for (var s = 0; s < 3; s++) if (inRect(p, 85 + s * 195, 595, 170, 66)) this.timeScale = [1, 2, 4][s];
    if (inRect(p, 85, 700, 270, 66)) root.Settings.debug = !root.Settings.debug;
    if (inRect(p, 395, 700, 270, 66)) {
      if (!this.clearConfirm) this.clearConfirm = true;
      else { Platform.removeStorage ? Platform.removeStorage(CONFIG.SAVE.KEY) : Platform.setStorage(CONFIG.SAVE.KEY, '');
        Meta.data = Meta.createDefaultData(); Meta.save(false); this.clearConfirm = false; }
    }
  },
  addLevels: function (count) {
    if (Game.state !== CONFIG.GAME.STATE_PLAYING) { Meta.showToast('快速升级仅在战斗中可用'); return; }
    NextRun.level(count); this.open = false;
  },
  skipLevels: function () {
    var guard = 500;
    while (ExpLevelUp.pendingChoices > 0 && guard-- > 0) {
      if (!ExpLevelUp.prepareOffers()) break;
      var pick = Math.floor(Math.random() * ExpLevelUp.offerCount);
      var o = ExpLevelUp.offers[pick];
      ExpLevelUp.applyUpgrade(o.definition, o.rarity);
      ExpLevelUp.levels[o.definition.ID] += 1; ExpLevelUp.pendingChoices -= 1;
    }
    ExpLevelUp.pendingChoices = 0;
    Game.resumePlaying();
  },
  maxMeta: function () {
    for (var i = 0; i < CONFIG.META.UPGRADES.length; i++) Meta.data.upg[CONFIG.META.UPGRADES[i].ID] = CONFIG.META.UPGRADES[i].MAX_LEVEL;
    for (var g in CONFIG.META.GADGET_UPGRADES) for (var j = 0; j < CONFIG.META.GADGET_UPGRADES[g].items.length; j++) {
      var d = CONFIG.META.GADGET_UPGRADES[g].items[j]; Meta.data.upg.gadget[g][d.ID] = d.MAX_LEVEL;
    }
    Meta.save(); Meta.showToast('局外升级已全部点满');
  },
  spawn: function (type) {
    if (Game.state !== CONFIG.GAME.STATE_PLAYING) return;
    Enemy.spawn(Math.min(CONFIG.WORLD.WIDTH - 100, Player.x + 260), Player.y, type, Spawner.getHpMultiplier(Game.survivedSeconds));
  },
  drawButton: function (ctx) {
    if (!this.active) return;
    var y = devButtonY();
    ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#123d2a'; ctx.fillRect(V4C.DEV_X - 20, y - 20, 40, 40);
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('DEV', V4C.DEV_X, y); ctx.restore();
  },
  draw: function (ctx) {
    this.drawButton(ctx); if (!this.open) return;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(0, 0, 750, 1334);
    UI.roundedRectPath(ctx, V4C.PANEL_X, V4C.PANEL_Y, V4C.PANEL_W, V4C.PANEL_H, 22);
    ctx.fillStyle = '#13231d'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#59e58a'; ctx.stroke();
    centered(ctx, '开发者控制台', 215, 34, '#8dffb1');
    ctx.fillStyle='#fff';ctx.font='bold 30px Arial';ctx.textAlign='center';ctx.fillText('×',656,207);
    centered(ctx, '快速升级（仅战斗）', 260, 21, '#ffd166');
    var lv = [10,20,50,100]; for (var i=0;i<4;i++) button(ctx,85+i*145,280,125,62,'+'+lv[i]+'级',Game.state===CONFIG.GAME.STATE_PLAYING,19);
    button(ctx,85,385,270,66,'无敌：'+(this.god?'开启':'关闭'),true,20); button(ctx,395,385,270,66,'金币 +10000',true,20);
    button(ctx,85,490,270,66,'点满局外升级',true,20); button(ctx,395,490,125,66,'刷精英',Game.state===CONFIG.GAME.STATE_PLAYING,18);
    button(ctx,540,490,125,66,'刷 Boss',Game.state===CONFIG.GAME.STATE_PLAYING,18);
    for(var s=0;s<3;s++) button(ctx,85+s*195,595,170,66,[1,2,4][s]+'x',true,22);
    button(ctx,85,700,270,66,'调试信息：'+(root.Settings.debug?'开':'关'),true,19);
    button(ctx,395,700,270,66,this.clearConfirm?'再次点击确认清档':'清除存档',true,18);
    centered(ctx,'倍速：'+this.timeScale+'x · 坐标 '+Math.round(Player.x)+','+Math.round(Player.y),815,18,'#b7c9bf');
    centered(ctx,'点击面板外或右上角关闭',1115,18,'#8da298'); ctx.restore();
  }
};

// ---------- #21 82张命运牌 ----------
var FateCards = {
  active:false, cards:[], selected:-1, shuffleUsed:false, flash:0, particles:[],
  rarities:[['COMMON',50,'#95A5A6'],['RARE',30,'#3498DB'],['EPIC',15,'#E67E22'],['LEGENDARY',5,'#ffd54a']],
  defs: [],
  initDefs: function () {
    var C='COMMON',R='RARE',E='EPIC',L='LEGENDARY';
    this.defs = [
      [1,'强健体魄','最大生命 +20',C,'MAX_HP',20],[2,'轻盈步伐','移速 +10%',C,'MOVE',.1],[3,'武器打磨','伤害 +10%',C,'DAMAGE',.1],[4,'快速射击','攻速 +10%',C,'FIRE',.1],[5,'锐利目光','暴击率 +5%',C,'CRIT',.05],[6,'致命一击','暴击伤害 +20%',C,'CRIT_DMG',.2],[7,'磁力增强','拾取范围 +15%',C,'PICKUP',.15],[8,'领悟之力','经验获取 +15%',C,'EXP',.15],[9,'贪婪之手','金币获取 +15%',C,'GOLD',.15],[10,'穿透弹','子弹穿透 +1',C,'PIERCE',1],[11,'多重射击','子弹弹道 +1',C,'PROJECTILE',1],[12,'飞刃专精','飞刃数量 +1',C,'BLADE_COUNT',1],[13,'飞刃加速','飞刃转速 +20%',C,'BLADE_SPEED',.2],[14,'飞刃强化','飞刃伤害 +20%',C,'BLADE_DAMAGE',.2],[15,'坚韧意志','受击无敌 +0.2秒',C,'INV_TIME',.2],[16,'生命回复','每3秒回复2生命',C,'REGEN',{n:2,t:3}],[17,'皮糙肉厚','受到伤害 -5%',C,'REDUCE',.05],[18,'先发制人','开局等级 +2',C,'START_LEVEL',2],[19,'虚弱诅咒','敌人血量 -10%',C,'ENEMY_HP',.1],[20,'减速陷阱','敌人速度 -10%',C,'ENEMY_SPEED',.1],[21,'喘息空间','刷怪间隔 +0.2秒',C,'SPAWN_GAP',.2],[22,'经验丰收','经验晶石价值 +20%',C,'EXP',.2],[23,'金币丰收','金币掉落 +20%',C,'GOLD',.2],[24,'幸运儿','道具掉率 +20%',C,'DROP',.2],[25,'爆破专家','开局炸弹 +1',C,'ITEM',[0,1]],[26,'磁力王','开局磁铁 +1',C,'ITEM',[1,1]],[27,'医疗兵','开局血包 +1',C,'ITEM',[2,1]],[28,'冰霜法师','开局冻结 +1',C,'ITEM',[3,1]],[29,'冲刺大师','冲刺冷却 -2秒',C,'DASH_CD',2],[30,'疾风步','冲刺速度 +20%',C,'DASH_SPEED',.2],[31,'持久冲刺','冲刺时长 +0.3秒',C,'DASH_TIME',.3],[32,'远程射击','子弹寿命 +0.3秒',C,'BULLET_LIFE',.3],[33,'高速弹','弹速 +15%',C,'BULLET_SPEED',.15],[34,'生命强化','最大生命 +30',C,'MAX_HP',30],[35,'余生机会','免费复活 +1',C,'REVIVE',1],
      [36,'短暂无敌','开局无敌30秒',R,'START_INV',30],[37,'自动炮击','每15秒自动炮击',R,'AUTO_MORTAR',15],[38,'弹幕开局','开局弹道 +4',R,'PROJECTILE',4],[39,'急速射击','射速 +50%',R,'FIRE',.5],[40,'重型弹药','伤害 +30%',R,'DAMAGE',.3],[41,'风之疾走','移速 +25%',R,'MOVE',.25],[42,'鹰眼','暴击率 +15%',R,'CRIT',.15],[43,'毁灭打击','暴击伤害 +50%',R,'CRIT_DMG',.5],[44,'黑洞磁场','拾取范围 +40%',R,'PICKUP',.4],[45,'顿悟','经验获取 +30%',R,'EXP',.3],[46,'点金术','金币获取 +30%',R,'GOLD',.3],[47,'高位起步','开局等级 +5',R,'START_LEVEL',5],[48,'瘟疫使者','敌人血量 -20%',R,'ENEMY_HP',.2],[49,'冰霜领域','敌人速度 -15%',R,'ENEMY_SPEED',.15],[50,'吸血攻击','每击杀回复3生命',R,'KILL_HEAL',3],[51,'能量护盾','20%可再生护盾',R,'SHIELD',.2],[52,'时间加速','武器冷却 -20%',R,'COOLDOWN',.2],[53,'双飞刃','飞刃数量 +2',R,'BLADE_COUNT',2],[54,'穿甲弹','子弹穿透 +3',R,'PIERCE',3],[55,'三连射','子弹弹道 +2',R,'PROJECTILE',2],[56,'道具猎人','道具掉率 +50%',R,'DROP',.5],[57,'冲刺狂人','冲刺冷却 -4秒',R,'DASH_CD',4],[58,'钢铁之躯','受到伤害 -20%',R,'REDUCE',.2],[59,'全屏磁吸','晶石自动全屏吸附',R,'FULL_MAGNET',1],[60,'全副武装','四种道具各 +1',R,'ALL_ITEMS',1],
      [61,'神圣庇护','开局无敌60秒',E,'START_INV',60],[62,'无冷却炮击','每8秒自动炮击',E,'AUTO_MORTAR',8],[63,'枪林弹雨','开局弹道 +7',E,'PROJECTILE',7],[64,'暴风射击','射速 +80%',E,'FIRE',.8],[65,'毁灭之力','伤害 +60%',E,'DAMAGE',.6],[66,'武器过载','伤害/弹道/穿透 ×2',E,'WEAPON_OVERLOAD',2],[67,'暴击宗师','暴击率+25% 暴伤+100%',E,'CRIT_MASTER',1],[68,'疾风剑圣','移速+40% 冲刺冷却-50%',E,'WIND_MASTER',1],[69,'衰弱光环','敌人血量 -35%',E,'ENEMY_HP',.35],[70,'黄金时代','金币获取 +100%',E,'GOLD',1],[71,'智慧之光','经验+50% 开局等级+8',E,'WISDOM',1],[72,'生命汲取','击杀回血5，10%掉血包',E,'LIFE_DRAIN',1],[73,'自动激光','每20秒自动激光',E,'AUTO_LASER',20],[74,'永恒冰封','每25秒自动冻结3秒',E,'AUTO_FREEZE',25],[75,'激光化','主武器激光化，伤害+50%',E,'LASER',1],
      [76,'不死之身','下一局全程无敌',L,'GOD',1],[77,'战神降世','武器伤害×3，攻速×2',L,'WAR_GOD',1],[78,'天选之人','开局直接50级',L,'CHOSEN',50],[79,'割草模式','敌血-50%，速度-30%',L,'MOW',1],[80,'爆肝模式','金币×5，经验×3',L,'GRIND',1],[81,'神之怒','每10秒自动清屏',L,'AUTO_CLEAR',10],[82,'万物主宰','所有道具轮流自动释放',L,'ITEM_MASTER',1]
    ];
  },
  open: function () { this.active=true; this.selected=-1; this.shuffleUsed=false; this.flash=0; this.deal(); Input.clearTap(); },
  rollRarity: function () { var n=Math.random()*100; for(var i=0;i<this.rarities.length;i++){n-=this.rarities[i][1];if(n<0)return this.rarities[i][0];}return'COMMON'; },
  deal: function () { this.cards.length=0; for(var i=0;i<9;i++){var r=this.rollRarity(),pool=[];for(var j=0;j<this.defs.length;j++)if(this.defs[j][3]===r)pool.push(this.defs[j]);this.cards.push({def:pool[Math.floor(Math.random()*pool.length)],open:false,t:0});} },
  allOpen:function(){for(var i=0;i<this.cards.length;i++)if(!this.cards[i].open)return false;return this.cards.length===9;},
  update: function (dt) {
    this.flash=Math.max(0,this.flash-dt); for(var i=0;i<this.cards.length;i++)if(this.cards[i].t>0&&this.cards[i].t<.3)this.cards[i].t=Math.min(.3,this.cards[i].t+dt);
    if(!Input.consumeTap(UI.tapPoint))return; var p=UI.tapPoint;
    var top=fateTop();
    for(var i=0;i<9;i++){var x=V4C.CARD_X+(i%3)*(V4C.CARD_W+V4C.CARD_GAP),y=top+Math.floor(i/3)*(V4C.CARD_H+V4C.CARD_GAP);if(inRect(p,x,y,V4C.CARD_W,V4C.CARD_H)&&!this.cards[i].open){this.flip(i);return;}}
    if(this.selected>=0&&this.allOpen()&&inRect(p,145,top+770,460,78)){this.confirm();return;}
    if(!this.shuffleUsed&&inRect(p,170,top+870,410,76))this.requestShuffle();
  },
  flip:function(i){var c=this.cards[i];c.open=true;c.t=.001;if(this.selected<0)this.selected=i;if(c.def[3]==='LEGENDARY'){this.flash=.2;if(root.AudioFX)root.AudioFX.play('level');}if(root.FX)root.FX.legendaryBurst(Player.x,Player.y);},
  confirm:function(){var d=this.cards[this.selected].def;Meta.data.nextRunBuff={cardId:d[0],rarity:d[3],effectType:d[4],effectValue:d[5],name:d[1]};Meta.save();this.active=false;Game.enterMenu();},
  skip:function(){Meta.data.nextRunBuff=null;Meta.save();this.active=false;Game.enterMenu();},
  requestShuffle:function(){var self=this;Ads.showRewarded(CONFIG.ADS.PLACEMENT_CARD_SHUFFLE,function(){if(!self.active||self.shuffleUsed)return;self.shuffleUsed=true;self.selected=-1;self.deal();},Game.handleAdFail.bind(Game));},
  draw:function(ctx){var top=fateTop();ctx.save();ctx.fillStyle='#090d14';ctx.fillRect(0,0,750,CONFIG.VIEW.HEIGHT);centered(ctx,'命运抽取',top-155,44,'#f4d58d');centered(ctx,'选择你的下一局增益',top-102,24,'#d9cfb5');for(var i=0;i<9;i++)this.drawCard(ctx,i);centered(ctx,this.selected<0?'第一张翻开的牌将在下一局生效':this.allOpen()?'全部牌面已查看，可以确认':'已选择！继续翻开其余牌查看',top+725,20,this.selected<0?'#c9c4b5':'#59e58a');if(this.selected>=0&&this.allOpen())button(ctx,145,top+770,460,78,'确认并返回',true,27);button(ctx,170,top+870,410,76,this.shuffleUsed?'本局已洗牌':'看广告重新洗牌',!this.shuffleUsed,23);if(this.flash>0){ctx.globalAlpha=.3*this.flash/.2;ctx.fillStyle='#ffd54a';ctx.fillRect(0,0,750,CONFIG.VIEW.HEIGHT);}ctx.restore();},
  drawCard:function(ctx,i){var c=this.cards[i],x=V4C.CARD_X+(i%3)*180,y=V4C.CARD_Y+Math.floor(i/3)*240;var progress=c.t/.3,scaleX=c.open?Math.abs(Math.cos(progress*Math.PI)):1;ctx.save();ctx.translate(x+80,y+110);ctx.scale(Math.max(.03,scaleX),1);ctx.translate(-80,-110);UI.roundedRectPath(ctx,0,0,160,220,14);if(!c.open||progress<.5){ctx.fillStyle='#1A1A2E';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#d6aa55';ctx.stroke();ctx.strokeStyle='rgba(214,170,85,.2)';for(var k=16;k<160;k+=24){ctx.beginPath();ctx.moveTo(k,0);ctx.lineTo(0,k);ctx.stroke();}ctx.fillStyle='#d6aa55';ctx.font='bold 44px Arial';ctx.textAlign='center';ctx.fillText('☠',80,126);}else{var d=c.def,r=d[3],col=r==='COMMON'?'#95A5A6':r==='RARE'?'#3498DB':r==='EPIC'?'#E67E22':'#ffd54a';ctx.fillStyle=r==='COMMON'?'#222928':r==='RARE'?'#132b3a':r==='EPIC'?'#332317':'#251c31';ctx.fill();ctx.lineWidth=(r==='EPIC'||r==='LEGENDARY')?3:2;ctx.strokeStyle=col;ctx.stroke();ctx.fillStyle=col;ctx.font='bold 28px Arial';ctx.textAlign='center';ctx.fillText(this.icon(d[4]),80,70);ctx.font='bold 18px Arial,"Microsoft YaHei"';ctx.fillText(d[1],80,125);ctx.fillStyle='#eee8db';ctx.font='14px Arial,"Microsoft YaHei"';this.wrap(ctx,d[2],80,160,135,20);if(i===this.selected){ctx.strokeStyle='#59e58a';ctx.lineWidth=5;ctx.stroke();}}ctx.restore();},
  icon:function(t){if(t.indexOf('HP')>=0||t.indexOf('REGEN')>=0)return'♥';if(t.indexOf('FIRE')>=0||t.indexOf('COOLDOWN')>=0)return'⚡';if(t.indexOf('GOLD')>=0)return'◆';if(t.indexOf('BLADE')>=0)return'✦';return'●';},
  wrap:function(ctx,text,x,y,max,line){var chars=text.split(''),s='';for(var i=0;i<chars.length;i++){if(ctx.measureText(s+chars[i]).width>max){ctx.fillText(s,x,y);s=chars[i];y+=line;}else s+=chars[i];}ctx.fillText(s,x,y);}
};
FateCards.initDefs();

// ---------- 下一局增益应用与自动效果 ----------
var NextRun = { buff:null, regen:0, autoMortar:0, autoLaser:0, autoFreeze:0, autoClear:0, itemMaster:0, itemStep:0,
  reset:function(){this.buff=null;this.regen=0;this.autoMortar=0;this.autoLaser=0;this.autoFreeze=0;this.autoClear=0;this.itemMaster=0;this.itemStep=0;},
  apply:function(b){this.reset();if(!b)return;this.buff=b;var t=b.effectType,v=b.effectValue;
    if(t==='MAX_HP'){Player.maxHp+=v;Player.hp+=v;}else if(t==='MOVE')Player.moveSpeedBonus+=v;else if(t==='DAMAGE')Player.globalDamageBonus+=v;else if(t==='FIRE')PulseGun.fireRateBonus+=v;else if(t==='CRIT')Player.critChance+=v;else if(t==='CRIT_DMG')Player.critDamageBonus+=v;else if(t==='PICKUP')Player.pickupRadius*=1+v;else if(t==='EXP')Player.expGainBonus+=v;else if(t==='GOLD')Player.nextGoldBonus=v;else if(t==='PIERCE')PulseGun.penetration+=v;else if(t==='PROJECTILE')PulseGun.projectileCount+=v;else if(t==='BLADE_COUNT')OrbitBlade.count+=v;else if(t==='BLADE_SPEED')OrbitBlade.speedBonus+=v;else if(t==='BLADE_DAMAGE')OrbitBlade.damageFlat+=CONFIG.WEAPONS.BLADE.DAMAGE*v;else if(t==='INV_TIME')Player.invincibleTimeBonus=v;else if(t==='REGEN'){Player.nextRegen=v;this.regen=v.t;}else if(t==='REDUCE')Player.incomingDamageMultiplier*=1-v;else if(t==='START_LEVEL')this.level(v);else if(t==='ENEMY_HP')Player.nextEnemyHp=1-v;else if(t==='ENEMY_SPEED')Player.enemySpeedMultiplier*=1-v;else if(t==='SPAWN_GAP')Player.nextSpawnGap=v;else if(t==='DROP')Player.nextDropBonus=v;else if(t==='ITEM')PowerUps.inventory[v[0]]+=v[1];else if(t==='DASH_CD')Player.nextDashCd=v;else if(t==='DASH_SPEED')Player.nextDashSpeed=v;else if(t==='DASH_TIME')Player.nextDashTime=v;else if(t==='BULLET_LIFE')Player.nextBulletLife=v;else if(t==='BULLET_SPEED')PulseGun.speedFlat+=CONFIG.WEAPONS.PULSE.SPEED*v;else if(t==='REVIVE')Player.reviveCharges+=v;else if(t==='START_INV')Player.invincibleTimer=v;else if(t==='AUTO_MORTAR')this.autoMortar=v;else if(t==='KILL_HEAL')Player.killHeal+=v;else if(t==='SHIELD'){Player.upgradeShieldMax=Player.maxHp*v;Player.shield=Player.upgradeShieldMax;}else if(t==='COOLDOWN'){PulseGun.cooldownMultiplier*=1-v;OrbitBlade.cooldownMultiplier*=1-v;}else if(t==='FULL_MAGNET')Player.pickupRadius=9999;else if(t==='ALL_ITEMS')for(var i=0;i<4;i++)PowerUps.inventory[i]++;else if(t==='WEAPON_OVERLOAD'){Player.globalDamageBonus+=1;PulseGun.projectileMultiplier*=2;PulseGun.penetration=Math.max(1,PulseGun.penetration*2);}else if(t==='CRIT_MASTER'){Player.critChance+=.25;Player.critDamageBonus+=1;}else if(t==='WIND_MASTER'){Player.moveSpeedBonus+=.4;Player.nextDashCdRatio=.5;}else if(t==='WISDOM'){Player.expGainBonus+=.5;this.level(8);}else if(t==='LIFE_DRAIN'){Player.killHeal+=5;Player.nextMedkitDrop=.1;}else if(t==='AUTO_LASER')this.autoLaser=v;else if(t==='AUTO_FREEZE')this.autoFreeze=v;else if(t==='LASER'){PulseGun.laserCannon=true;PulseGun.damageMultiplier*=1.5;}else if(t==='GOD')Player.nextGod=true;else if(t==='WAR_GOD'){Player.globalDamageBonus+=2;PulseGun.fireRateBonus+=1;}else if(t==='CHOSEN')this.level(Math.max(0,50-ExpLevelUp.level));else if(t==='MOW'){Player.nextEnemyHp=.5;Player.enemySpeedMultiplier*=.7;}else if(t==='GRIND'){Player.nextGoldBonus=4;Player.expGainBonus+=2;}else if(t==='AUTO_CLEAR')this.autoClear=v;else if(t==='ITEM_MASTER')this.itemMaster=5;},
  // 精确提升 N 级，不再经过经验倍率，避免“+8级”被经验加成放大为 +9级。
  level:function(n){n=Math.max(0,Math.min(100,Math.floor(n)));for(var i=0;i<n;i++){ExpLevelUp.level+=1;ExpLevelUp.need=ExpLevelUp.getNeed(ExpLevelUp.level);ExpLevelUp.pendingChoices+=1;}},
  update:function(dt){if(Game.state!==CONFIG.GAME.STATE_PLAYING)return;if(Player.nextRegen){this.regen-=dt;if(this.regen<=0){Player.hp=Math.min(Player.maxHp,Player.hp+Player.nextRegen.n);this.regen=Player.nextRegen.t;}}this.tick('autoMortar',dt,function(){root.MortarStrike.activate();});this.tick('autoLaser',dt,function(){root.LaserEmitter.activate();});this.tick('autoFreeze',dt,function(){PowerUps.freezeTimer=Math.max(PowerUps.freezeTimer,3);});this.tick('autoClear',dt,function(){PowerUps.useBomb();});if(this.itemMaster>0){this.itemMaster-=dt;if(this.itemMaster<=0){var idx=this.itemStep++%6;PowerUps.inventory[idx]=Math.max(1,PowerUps.inventory[idx]);PowerUps.activate(idx);this.itemMaster=5;}}},
  tick:function(key,dt,fn){if(this[key]>0){this[key]-=dt;if(this[key]<=0){var period=this.buff.effectValue;fn();this[key]=period;}}}
};

// 属性钩子
var oldTakeDamage=Player.takeDamage;Player.takeDamage=function(a,s){if(DevConsole.god||this.nextGod)return false;var hit=oldTakeDamage.call(this,a,s);if(hit&&this.invincibleTimeBonus)this.invincibleTimer+=this.invincibleTimeBonus;return hit;};
var oldEnemySpawn=Enemy.spawn;Enemy.spawn=function(x,y,t,h){return oldEnemySpawn.call(this,x,y,t,h*(Player.nextEnemyHp||1));};
var oldSpawnInterval=Spawner.getSpawnInterval;Spawner.getSpawnInterval=function(t){return oldSpawnInterval.call(this,t)+(Player.nextSpawnGap||0);};
var oldRollDrop=PowerUps.rollDrop;PowerUps.rollDrop=function(x,y,t){if(Player.nextDropBonus&&Math.random()<CONFIG.POWERUPS.NORMAL_DROP_CHANCE*Player.nextDropBonus)this.dropRandom(x,y);oldRollDrop.call(this,x,y,t);};
var oldKill=Enemy.kill;Enemy.kill=function(e){var x=e.x,y=e.y,normal=e.typeIndex<CONFIG.ENEMY.TYPE_ELITE;oldKill.call(this,e);if(normal&&Player.nextMedkitDrop&&Math.random()<Player.nextMedkitDrop)PowerUps.drop(x,y,CONFIG.POWERUPS.TYPE_MEDKIT);};
var oldCoins=root.RunStats.calculateCoins;root.RunStats.calculateCoins=function(s,l,v){oldCoins.call(this,s,l,v);if(Player.nextGoldBonus){this.undoubledCoins=Math.round(this.undoubledCoins*(1+Player.nextGoldBonus));this.finalCoins=this.coinDoubleClaimed?this.undoubledCoins*2:this.undoubledCoins;}};

// 冲刺/子弹时效使用局内属性，不污染全局 CONFIG。
var oldStartDash=Player.startDash;Player.startDash=function(){var ok=oldStartDash.call(this);if(ok){if(this.nextDashTime)this.dashTimer+=this.nextDashTime;if(this.nextDashCd)this.dashCooldown=Math.max(.5,this.dashCooldown-this.nextDashCd);if(this.nextDashCdRatio)this.dashCooldown*=this.nextDashCdRatio;}return ok;};
var oldPlayerUpdate=Player.update;Player.update=function(dt){var ox=this.x,oy=this.y;oldPlayerUpdate.call(this,dt);if(this.dashing&&this.nextDashSpeed){this.x+=(this.x-ox)*this.nextDashSpeed;this.y+=(this.y-oy)*this.nextDashSpeed;this.clampToWorld();}};
var oldBulletSpawn=root.Bullet.spawn;root.Bullet.spawn=function(x,y,a,s,d,p){var slot=-1;for(var i=0;i<this.pool.length;i++)if(!this.pool[i].active){slot=i;break;}var ok=oldBulletSpawn.call(this,x,y,a,s,d,p);if(ok&&slot>=0&&(Player.nextBulletLife||0))this.pool[slot].life+=Player.nextBulletLife;return ok;};

// 状态机与界面接入
var oldRestart=Game.restart;Game.restart=function(){var b=Meta.data&&Meta.data.nextRunBuff;oldRestart.call(this);Player.nextGoldBonus=0;Player.nextEnemyHp=1;Player.nextSpawnGap=0;Player.nextDropBonus=0;Player.nextMedkitDrop=0;Player.nextGod=false;Player.invincibleTimeBonus=0;Player.nextRegen=null;Player.nextDashCd=0;Player.nextDashCdRatio=0;Player.nextDashSpeed=0;Player.nextDashTime=0;Player.nextBulletLife=0;NextRun.apply(b);if(b){Meta.data.nextRunBuff=null;Meta.save();}if(b&&b.effectType==='CHOSEN'){DevConsole.skipLevels();return;}if(ExpLevelUp.hasPendingChoice())Game.enterLevelUp();};
var oldUpdateSettlement=Game.updateSettlement;Game.updateSettlement=function(v){var a=UI.consumeSettlementAction(v);if(a===0){FateCards.open();Game.state='FATE';}else if(a===4){FateCards.skip();}else if(a===1)this.requestAdRevive();else if(a===2)this.requestCoinDouble(v);else if(a===3)this.requestExtractQuad();};
var oldConsumeSettlement=UI.consumeSettlementAction;UI.consumeSettlementAction=function(v){var y=skipFateY();if(Input.pendingTap.active&&inRect(Input.pendingTap,245,y,260,40)){Input.clearTap();return 4;}return oldConsumeSettlement.call(this,v);};
var oldRestartDraw=UI.drawRestartButton;UI.drawRestartButton=function(ctx){var oldText=CONFIG.TEXT.RESTART;CONFIG.TEXT.RESTART='进入命运抽取';oldRestartDraw.call(this,ctx);CONFIG.TEXT.RESTART=oldText;button(ctx,245,skipFateY(),260,40,'跳过抽牌',true,17);};
var oldLevelDraw=UI.drawLevelUp;UI.drawLevelUp=function(ctx){oldLevelDraw.call(this,ctx);if(DevConsole.active&&ExpLevelUp.pendingChoices>=10)button(ctx,245,skipLevelY(),260,58,'跳过剩余升级',true,19);};
var oldExpInput=ExpLevelUp.handleInput;ExpLevelUp.handleInput=function(){var y=skipLevelY();if(DevConsole.active&&this.pendingChoices>=10&&Input.pendingTap.active&&inRect(Input.pendingTap,245,y,260,58)){Input.clearTap();DevConsole.skipLevels();return;}oldExpInput.call(this);};
var oldDrawMenu=UI.drawMenu;UI.drawMenu=function(ctx){oldDrawMenu.call(this,ctx);if(Meta.data.nextRunBuff){var b=Meta.data.nextRunBuff;centered(ctx,'下一局增益：'+b.name,1085,21,b.rarity==='LEGENDARY'?'#ffd54a':b.rarity==='EPIC'?'#E67E22':b.rarity==='RARE'?'#3498DB':'#95A5A6');}DevConsole.draw(ctx);};
var oldDrawBase=UI.drawBase;UI.drawBase=function(ctx){oldDrawBase.call(this,ctx);DevConsole.draw(ctx);};
var oldGameUpdateV004=Game.update;Game.update=function(dt){if(Game.state==='RUNTIME_ERROR'){if(Input.pendingTap.active){Input.clearTap();this.runtimeError='';this.enterMenu();}return;}if(DevConsole.handleInput())return;if(DevConsole.open)return;if(Ads.active){oldGameUpdateV004.call(this,dt);return;}if(Game.state==='FATE'){FateCards.update(dt);return;}oldGameUpdateV004.call(this,dt*DevConsole.timeScale);NextRun.update(dt*DevConsole.timeScale);};
Platform.onKeyDown(function(e){if(e.code==='Backquote'&&!e.repeat){if(e.preventDefault)e.preventDefault();if(!DevConsole.active)DevConsole.active=true;DevConsole.open=!DevConsole.open;Input.clearTap();}});

// ---------- #22 迫击炮对象池与完整表现 ----------
var MortarFX={shells:[],trails:[],groups:[],burns:[],smoke:[],sparks:[],
  init:function(){for(var i=0;i<10;i++)this.shells.push({active:false});for(var i=0;i<60;i++)this.trails.push({active:false});for(var i=0;i<3;i++)this.groups.push({active:false});for(var i=0;i<10;i++)this.burns.push({active:false});for(var i=0;i<20;i++)this.smoke.push({active:false});for(var i=0;i<30;i++)this.sparks.push({active:false});},
  reset:function(){var pools=[this.shells,this.trails,this.groups,this.burns,this.smoke,this.sparks];for(var p=0;p<pools.length;p++)for(var i=0;i<pools[p].length;i++)pools[p][i].active=false;},
  spawnShell:function(tx,ty,delay){for(var i=0;i<this.shells.length;i++){var s=this.shells[i];if(s.active)continue;s.active=true;s.tx=tx;s.ty=ty;s.t=-delay;s.duration=2;s.sx=tx-260;s.sy=ty-620;s.x=s.sx;s.y=s.sy;s.angle=0;s.trail=0;return; }},
  explode:function(s){
    s.active=false;
    for(var i=0;i<this.groups.length;i++)if(!this.groups[i].active){
      var g=this.groups[i];g.active=true;g.x=s.tx;g.y=s.ty;g.life=3;
      g.burn=Meta.getGadgetLevel('mortar','burn')>0;break;
    }
    if(Meta.getGadgetLevel('mortar','burn')>0)for(var i=0;i<this.burns.length;i++)if(!this.burns[i].active){var b=this.burns[i];b.active=true;b.x=s.tx;b.y=s.ty;b.life=3;break;}
    for(var i=0,m=0;i<this.smoke.length&&m<7;i++)if(!this.smoke[i].active){
      var q=this.smoke[i];q.active=true;q.x=s.tx+(Math.random()*2-1)*35;q.y=s.ty;
      q.vx=(Math.random()*2-1)*28;q.vy=-20-Math.random()*25;q.r=15+Math.random()*10;q.life=1;m++;
    }
    for(var i=0,m=0;i<this.sparks.length&&m<12;i++)if(!this.sparks[i].active){
      var q=this.sparks[i],a=Math.random()*Math.PI*2,sp=100+Math.random()*100;
      q.active=true;q.x=s.tx;q.y=s.ty;q.vx=Math.cos(a)*sp;q.vy=Math.sin(a)*sp-80;
      q.r=2+Math.random()*2;q.life=.5;m++;
    }
    if(root.Settings.shake)root.Camera.startShake(3,.15);
    root.MortarStrike._explode({targetX:s.tx,targetY:s.ty});
  },
  update:function(dt){for(var i=0;i<this.shells.length;i++){var s=this.shells[i];if(!s.active)continue;s.t+=dt;if(s.t<0)continue;var f=Math.min(1,s.t/s.duration);s.x=s.sx+(s.tx-s.sx)*f;s.y=s.sy+(s.ty-s.sy)*f-150*Math.sin(f*Math.PI);s.angle+=2*dt;s.trail-=dt;if(s.trail<=0){s.trail=.02;this.spawnTrail(s.x,s.y);}if(f>=1)this.explode(s);}this.updateParticles(dt);},
  spawnTrail:function(x,y){for(var i=0;i<this.trails.length;i++)if(!this.trails[i].active){var p=this.trails[i];p.active=true;p.x=x;p.y=y;p.life=.3;return;}},
  updateParticles:function(dt){for(var i=0;i<this.trails.length;i++)if(this.trails[i].active&&(this.trails[i].life-=dt)<=0)this.trails[i].active=false;for(var i=0;i<this.groups.length;i++){var g=this.groups[i];if(!g.active)continue;if((g.life-=dt)<=0)g.active=false;}for(var i=0;i<this.burns.length;i++){var b=this.burns[i];if(!b.active)continue;this.burnTick(b,dt);if((b.life-=dt)<=0)b.active=false;}for(var i=0;i<this.smoke.length;i++){var p=this.smoke[i];if(!p.active)continue;p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.life<=0)p.active=false;}for(var i=0;i<this.sparks.length;i++){var p=this.sparks[i];if(!p.active)continue;p.life-=dt;p.vy+=400*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.life<=0)p.active=false;}},
  burnTick:function(g,dt){var r=80,dmg=root.MortarStrike._baseDmg()*CONFIG.MORTAR.BURN_DPS_RATIO*Meta.getGadgetLevel('mortar','burn')*dt;for(var i=0;i<Enemy.pool.length;i++){var e=Enemy.pool[i];if(!e.active)continue;var dx=e.x-g.x,dy=e.y-g.y;if(dx*dx+dy*dy<=r*r)root.Combat.hitEnemyFixed(e,dmg,e.x,e.y);}},
  draw:function(ctx){for(var i=0;i<this.groups.length;i++){var g=this.groups[i];if(!g.active)continue;var x=g.x-Camera.x,y=g.y-Camera.y,age=3-g.life;ctx.save();if(age<.1){ctx.globalAlpha=1-age/.1;var gr=ctx.createRadialGradient(x,y,0,x,y,60);root.safeStop(gr,0,'#fff');root.safeStop(gr,1,'rgba(255,255,255,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,60,0,Math.PI*2);ctx.fill();}if(age<.3){ctx.globalAlpha=.9-age*1.7;var r=80*Math.min(1,age/.3),gr=ctx.createRadialGradient(x,y,0,x,y,r);root.safeStop(gr,0,'#F1C40F');root.safeStop(gr,1,'#E74C3C');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=.4*g.life/3;ctx.fillStyle='#111';ctx.beginPath();ctx.arc(x,y,80,0,Math.PI*2);ctx.fill();ctx.restore();}this.drawParticles(ctx);for(var i=0;i<this.shells.length;i++){var s=this.shells[i];if(!s.active||s.t<0)continue;var f=Math.min(1,s.t/s.duration),remain=s.duration-s.t,x=s.tx-Camera.x,y=s.ty-Camera.y;if(remain<=1.5){var wr=80+40*(remain/1.5);ctx.save();ctx.globalAlpha=.8;ctx.strokeStyle='#E74C3C';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,wr,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.15+.15*(1-remain/1.5);ctx.fillStyle='#E74C3C';ctx.fill();ctx.globalAlpha=.9;ctx.beginPath();ctx.moveTo(x-10,y);ctx.lineTo(x+10,y);ctx.moveTo(x,y-10);ctx.lineTo(x,y+10);ctx.stroke();ctx.font='bold 28px Arial';ctx.textAlign='center';ctx.fillText('!',x,y-wr-10+Math.sin(s.t*Math.PI*4)*5);ctx.restore();}ctx.save();ctx.translate(s.x-Camera.x,s.y-Camera.y);ctx.rotate(s.angle);ctx.fillStyle='#343a40';ctx.beginPath();ctx.ellipse(0,0,9,6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#E74C3C';ctx.globalAlpha=.5+.5*Math.sin(s.t*Math.PI*10);ctx.beginPath();ctx.arc(7,0,3,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#687078';ctx.beginPath();ctx.moveTo(-7,-3);ctx.lineTo(-13,-8);ctx.lineTo(-11,-1);ctx.fill();ctx.beginPath();ctx.moveTo(-7,3);ctx.lineTo(-13,8);ctx.lineTo(-11,1);ctx.fill();ctx.restore();}},
  drawParticles:function(ctx){for(var g=0;g<this.groups.length;g++){var z=this.groups[g];if(!z.active||!z.burn)continue;var fade=Math.min(1,z.life/.3);for(var f=0;f<10;f++){var a=f*Math.PI*2/10,rr=25+(f%3)*20,fx=z.x-Camera.x+Math.cos(a)*rr+Math.sin(Date.now()/180+f)*4,fy=z.y-Camera.y+Math.sin(a)*rr;ctx.globalAlpha=.7*fade;ctx.fillStyle=f%2?'#E74C3C':'#F39C12';ctx.beginPath();ctx.moveTo(fx-5,fy+8);ctx.quadraticCurveTo(fx,fy-10-(f%3)*5,fx+5,fy+8);ctx.fill();}}for(var i=0;i<this.trails.length;i++){var p=this.trails[i];if(!p.active)continue;ctx.globalAlpha=p.life/.3;ctx.fillStyle=p.life>.2?'#ffe066':'#ff6b35';ctx.beginPath();ctx.arc(p.x-Camera.x,p.y-Camera.y,3+p.life*12,0,Math.PI*2);ctx.fill();}for(var i=0;i<this.smoke.length;i++){var p=this.smoke[i];if(!p.active)continue;ctx.globalAlpha=.6*p.life;ctx.fillStyle='#42464b';ctx.beginPath();ctx.arc(p.x-Camera.x,p.y-Camera.y,p.r,0,Math.PI*2);ctx.fill();}for(var i=0;i<this.sparks.length;i++){var p=this.sparks[i];if(!p.active)continue;ctx.globalAlpha=p.life/.5;ctx.fillStyle='#ff6b35';ctx.beginPath();ctx.arc(p.x-Camera.x,p.y-Camera.y,p.r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
};
MortarFX.init();
var oldMortarActivateV004=root.MortarStrike.activate;root.MortarStrike.activate=function(){var full=Meta.getGadgetLevel('mortar','fullcover')>0;var count=CONFIG.MORTAR.BASE_COUNT+Meta.getGadgetLevel('mortar','count')+(full?CONFIG.MORTAR.FULLCOVER_EXTRA:0);var targets=this._findTargets(count,full);for(var i=0;i<targets.length;i++)MortarFX.spawnShell(targets[i].x,targets[i].y,i*.5);return true;};
var oldMortarReset=root.MortarStrike.reset;root.MortarStrike.reset=function(){oldMortarReset.call(this);MortarFX.reset();};
var oldMortarUpdate=root.MortarStrike.update;root.MortarStrike.update=function(dt){oldMortarUpdate.call(this,dt);MortarFX.update(dt);};
var oldMortarDraw=root.MortarStrike.draw;root.MortarStrike.draw=function(ctx){oldMortarDraw.call(this,ctx);MortarFX.draw(ctx);};

var V004={draw:function(ctx){if(Game.state==='FATE')FateCards.draw(ctx);else if(Game.state==='RUNTIME_ERROR'){ctx.save();ctx.fillStyle='rgba(5,8,7,.94)';ctx.fillRect(0,0,750,1334);centered(ctx,'检测到运行异常',430,38,'#ff6b6b');centered(ctx,'游戏循环已安全暂停，没有继续卡死',495,22,'#fff');var msg=String(Game.runtimeError||'未知异常').split('\n')[0].slice(0,70);centered(ctx,msg,555,16,'#ffd8a8');centered(ctx,'请截图这一页发给我',620,22,'#ffd166');centered(ctx,'点击任意位置返回主菜单',760,22,'#59e58a');ctx.restore();}else DevConsole.draw(ctx);},DevConsole:DevConsole,FateCards:FateCards,NextRun:NextRun,MortarFX:MortarFX};
root.DevConsole=DevConsole;root.FateCards=FateCards;root.NextRun=NextRun;root.V004=V004;
})();

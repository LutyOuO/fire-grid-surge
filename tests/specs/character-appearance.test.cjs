'use strict';
const assert=require('node:assert/strict');
const {createRuntime}=require('../helpers/runtime-harness.cjs');
for(const mode of ['h5','wx']) {
 const r=createRuntime(mode),g=r.game,C=g.CONFIG;
 r.finishImages();g.Game.restart();g.CONFIG.FIELD.WALLS=[];g.Enemy.reset();
 // 移动与瞄准相反时仍朝真实攻击方向；角色不独立索敌。
 g.Player.visual.moveX=-2;g.Player.visual.moveY=0;
 g.Weapons.presentation.valid=true;g.Weapons.presentation.angle=0;
 const nearest=g.Enemy.findNearest;g.Enemy.findNearest=()=>{throw new Error('角色不应重新索敌');};
 g.Player.updateAppearance(1/60);g.Enemy.findNearest=nearest;
 assert.equal(g.Player.visual.facing,3);assert(g.Player.visual.moving);
 const s=g.CharacterView.makeState();s.facing=3;
 for(const degrees of [43,47,52,46,50])g.CharacterView.setDirection(s,degrees*Math.PI/180);
 assert.equal(s.facing,3,'滞回角以内不应翻面');g.CharacterView.setDirection(s,60*Math.PI/180);assert.equal(s.facing,0);
 // 改外观/预览不能改变属性、出战选择、拥有记录；已开局外观保持快照。
 const snapshot=g.Player.runLook, original=JSON.stringify(g.Meta.data), hp=g.Player.hp,ammo=g.PulseGun.ammo;
 g.Wardrobe.mode='outfit';g.Wardrobe.openDetail(g.Wardrobe.outfits.find(d=>d[0]==='special'));
 g.CharacterView.previewAction=3;
 for(let i=0;i<120;i++)g.CharacterView.updatePreview(1/60);
 assert.equal(JSON.stringify(g.Meta.data),original);assert.equal(g.Player.hp,hp);assert.equal(g.PulseGun.ammo,ammo);
 assert.equal(snapshot.outfit,'default');
 // 六武器与三身体的真实绘制、缺图回退、异步加载与有界缓存。
 for(const id of ['default','special','medic','cowboy'])for(const weapon of Object.keys(C.CHARACTER.WEAPONS)) {
   const look=g.CharacterView.snapshot(id,weapon);
   for(let d=0;d<4;d++){s.facing=d;s.angle=C.CHARACTER.DIRECTION_ANGLES[d];g.CharacterView.draw(r.ctx,200,200,1,look,s);}
   r.finishImages();g.CharacterView.draw(r.ctx,200,200,1,look,s);
 }
 for(let i=0;i<24;i++){g.Platform.characterImage(['default','special','medic'][i%3]);r.finishImages();}
 assert(g.Platform.characterKeys.length<=2);assert(Object.keys(g.Platform.images).filter(k=>/^character_(default|special|medic)$/.test(k)).length<=2);
 g.Platform.imageReady.character_default=false;g.Platform.imageFailed.character_default=true;
 g.CharacterView.draw(r.ctx,200,200,1,g.CharacterView.snapshot('default'),s);
 // 普通子弹枪口与发射口一致，枪口到脚底间的细墙不可绕过。
 g.Game.restart();C.FIELD.WALLS=[];g.Enemy.reset();g.Player.x=1200;g.Player.y=1200;
 const enemy=g.Enemy.spawn(1400,1200,0,100);
 const target=enemy||g.Enemy.pool.find(e=>e.active);
 g.Weapons.aimAt(target,'pistol');const m=g.Weapons.getMuzzle(g.Weapons.presentation.angle,'pistol');const mx=m.x,my=m.y;
 g.Bullet.reset();g.PulseGun.fireAt(target);const bullet=g.Bullet.pool.find(b=>b.active);
 assert(bullet);assert(Math.abs(bullet.x-mx)<.001);assert(Math.abs(bullet.y-my)<.001);
 g.Bullet.reset();C.FIELD.WALLS=[{x:1190,y:1176,w:100,h:4}];
 const before=g.PulseGun.ammo;g.PulseGun.fireAt(target);
 assert(!g.Bullet.pool.some(b=>b.active));assert.equal(g.PulseGun.ammo,before);
 // 墙后喷火不挂燃烧。
 g.FlameWeapon.reset();g.FlameWeapon.unlocked=true;g.WeaponProgress.selected='flamer';
 g.FlameWeapon.aimTarget=target;C.FIELD.WALLS=[{x:1280,y:1080,w:20,h:250}];
 g.FlameWeapon.fire();assert(!g.FlameWeapon.burns.some(b=>b.active));
 // 暂停冻结表现、换弹与被动高亮，不因渲染推进。
 C.FIELD.WALLS=[];g.WeaponProgress.selected='pistol';g.PulseGun.startReload();g.Player.updateAppearance(.01);
 g.Game.state=C.GAME.STATE_PLAYING;g.Panels.pause();
 const time=g.Player.visual.time,reload=g.PulseGun.reloadTimer;g.Game.update(.05);r.draw();
 assert.equal(g.Player.visual.time,time);assert.equal(g.PulseGun.reloadTimer,reload);
 // 已拥有成就皮肤仍可装备；旧ID和未知拥有项保留，无效当前选择安全回退。
 const old=JSON.parse(original);old.ownedOutfits=['default','special','cowboy','future_skin'];old.currentOutfit='future_skin';old.survivorCoins=12345;
 g.Meta.mergeSafeData(old);assert.equal(g.Meta.data.currentOutfit,'default');assert(g.Meta.data.ownedOutfits.includes('future_skin'));assert.equal(g.Meta.data.survivorCoins,12345);
 old.currentOutfit='cowboy';g.Meta.mergeSafeData(old);assert.equal(g.Meta.data.currentOutfit,'cowboy');
 g.Meta.save();g.Meta.load();assert.equal(g.Meta.data.currentOutfit,'cowboy');assert.equal(g.Meta.data.survivorCoins,12345);
 // 真正页面入口：详情、返回和结算均走同一绘制接口。
 g.Game.enterBase();g.CampNav.page='appearance';g.Wardrobe.open=true;g.Wardrobe.openDetail(g.Wardrobe.outfits[0]);r.draw();r.finishImages();r.draw();
 g.Game.state=C.GAME.STATE_GAMEOVER;g.Game.exitType='death';r.draw();
 console.log('PASS: '+mode+' 角色朝向/真实枪口/细墙/喷火遮挡/预览隔离/快照/缓存上限/旧存档/暂停与各页面');
}

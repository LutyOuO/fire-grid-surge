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
 for(const degrees of [5,7,9,-5,-7])g.CharacterView.setDirection(s,degrees*Math.PI/180);
 assert.equal(s.facing,3,'滞回角以内不应翻面');g.CharacterView.setDirection(s,30*Math.PI/180);assert.equal(s.facing,5);
 for(let d=0;d<8;d++){s.facing=0;g.CharacterView.setDirection(s,C.CHARACTER.DIRECTION_ANGLES[d]);assert.equal(s.facing,d,'八向 '+d+' 均可到达');}
 // 改外观/预览不能改变属性、出战选择、拥有记录；已开局外观保持快照。
 const snapshot=g.Player.runLook, original=JSON.stringify(g.Meta.data), hp=g.Player.hp,ammo=g.PulseGun.ammo;
 g.Wardrobe.mode='outfit';g.Wardrobe.openDetail(g.Wardrobe.outfits.find(d=>d[0]==='special'));
 g.CharacterView.previewAction=3;
 for(let i=0;i<120;i++)g.CharacterView.updatePreview(1/60);
 assert.equal(JSON.stringify(g.Meta.data),original);assert.equal(g.Player.hp,hp);assert.equal(g.PulseGun.ammo,ammo);
 assert.equal(snapshot.outfit,'default');
 // 六武器与三身体的真实绘制、缺图回退、异步加载与有界缓存。
 for(const id of [...Object.keys(C.CHARACTER.SKINS),'cowboy'])for(const weapon of Object.keys(C.CHARACTER.WEAPONS)) {
   const look=g.CharacterView.snapshot(id,weapon);
   for(let d=0;d<8;d++){s.facing=d;s.angle=C.CHARACTER.DIRECTION_ANGLES[d];g.CharacterView.draw(r.ctx,200,200,1,look,s);}
   r.finishImages();g.CharacterView.draw(r.ctx,200,200,1,look,s);
 }
 for(let i=0;i<24;i++){g.Platform.characterImage(['default','special','medic'][i%3]);r.finishImages();}
 assert(g.Platform.characterKeys.length<=2);assert(Object.keys(g.Platform.images).filter(k=>/^character_(default|special|medic)$/.test(k)).length<=2);
 // 加载的图集必须走真实分层路径，不能让旧四列素材一直退回简化小人。
 for(const id of Object.keys(C.CHARACTER.SKINS)) {
   g.Platform.characterImage(id);r.finishImages();const img=g.Platform.characterImage(id);
   assert.equal(img.width,C.CHARACTER.CELL*8);assert.equal(img.height,C.CHARACTER.CELL*5);
   const count=r.drawnImages.length;
   g.CharacterView.draw(r.ctx,200,200,1,g.CharacterView.snapshot(id,'pistol'),s);
   assert(r.drawnImages.length-count>=5,'未绘制五层身体 '+id);
 }
 // 相同速度经过相同时间应产生相同步态；松开摇杆后的姿势平滑归零。
 function gait(fps) {
   const a=g.CharacterView.makeState();
   for(let i=0;i<fps;i++)g.CharacterView.advanceGait(a,1/fps,180,1,0);
   return a;
 }
 const gait60=gait(60),gait120=gait(120);
 assert(Math.abs(gait60.step-gait120.step)<1e-8);assert(Math.abs(gait60.pace-gait120.pace)<1e-8);
 const beforeStop=gait60.pace;g.CharacterView.advanceGait(gait60,1/60,0,0,0);
 assert(gait60.pace>0&&gait60.pace<beforeStop);
 for(let i=0;i<120;i++)g.CharacterView.advanceGait(gait60,1/60,0,0,0);
 assert(gait60.pace<1e-8);
 // 八方向、六武器、各动作的视觉枪口必须使用同一姿势；绘制不推进时间。
 for(const weapon of Object.keys(C.CHARACTER.WEAPONS))for(let dir=0;dir<8;dir++)for(const reload of [0,.3,.7]) {
   const a=gait(60);a.time=1;a.facing=dir;a.angle=C.CHARACTER.DIRECTION_ANGLES[dir];a.reload=reload;a.recoil=.06;
   const pose=g.CharacterView.weaponPose(a,weapon,{}),m={};
   g.CharacterView.muzzle(0,0,a.angle,weapon,dir,m,a);
   const def=C.CHARACTER.WEAPONS[weapon],t=C.CHARACTER.TEMPLATES[def.TEMPLATE];
   const dx=((def.MUZZLE_X||t.MUZZLE_X)-t.GRIP_X)*t.WIDTH,dy=(t.MUZZLE_Y-t.GRIP_Y)*t.HEIGHT*(Math.cos(pose.angle)<0?-1:1),scale=C.CHARACTER.HEIGHT/96;
   assert(Math.abs(m.x-(pose.x+Math.cos(pose.angle)*dx-Math.sin(pose.angle)*dy)*scale)<1e-8);
   assert(Math.abs(m.y-(pose.y+Math.sin(pose.angle)*dx+Math.cos(pose.angle)*dy)*scale)<1e-8);
   const saved=JSON.stringify(a);g.CharacterView.draw(r.ctx,200,200,1,g.CharacterView.snapshot('default',weapon),a);
   assert.equal(JSON.stringify(a),saved,'绘制不得推进动画');
 }
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

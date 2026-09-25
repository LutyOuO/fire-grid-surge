// 开发机可选视觉验收；不进入上传包、不参与游戏运行。
'use strict';
const {chromium}=require(process.env.CHARACTER_PLAYWRIGHT||'playwright');
const path=require('node:path'),fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const output=process.argv[2];
if(!output)throw new Error('请提供工程外的截图目录');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:450,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('file:///'+path.resolve(__dirname,'../h5/index.html').replace(/\\/g,'/'));
 await page.waitForTimeout(350);
 if(process.argv.includes('--tutorial')) {
  for(const width of [450,375]) {
   await page.setViewportSize({width,height:width===450?900:667});
   await page.evaluate(()=>{Game.restart();Game._hidden=true;Tutorial.replay();Enemy.reset();Camera.update();Game.draw();});
   await page.waitForTimeout(250);await page.evaluate(()=>Game.draw());
   await page.screenshot({path:path.join(output,'tutorial-move-'+width+'.png')});
   await page.evaluate(()=>{Panels.open(CONFIG.GAME.STATE_PAUSED);Panels.open('QUIT_RUN');Game.draw();});
   await page.screenshot({path:path.join(output,'quit-'+width+'.png')});
   await page.evaluate(()=>{Panels.open('QUIT_CONFIRM');Game.draw();});
   await page.screenshot({path:path.join(output,'quit-confirm-'+width+'.png')});
   await page.evaluate(()=>{Panels.resume();Meta.data.tutorial.step=3;Game.state=CONFIG.GAME.STATE_LEVELUP;ExpLevelUp.prepareOffers();Game.draw();});
   await page.screenshot({path:path.join(output,'tutorial-upgrade-'+width+'.png')});
  }
  console.log(JSON.stringify({errors,output}));await browser.close();if(errors.length)process.exitCode=1;return;
 }
 if(process.argv.includes('--combat')) {
  if(process.argv.includes('--notch'))await page.evaluate(()=>{
   Platform.safeTop=44/Platform._scale;
   Platform.getMenuButtonRect=()=>({left:330,top:58,right:430,bottom:94,width:100,height:36});
   UI.relayout();
  });
  await page.evaluate(()=>{
   Game.restart();Game._hidden=true;Enemy.reset();Camera.update();Spawner.waveIndex=1;Game.draw();
  });
  await page.waitForTimeout(250);await page.evaluate(()=>Game.draw());
  await page.screenshot({path:path.join(output,'combat-ammo.png')});
  await page.evaluate(()=>{PulseGun.ammo=0;PulseGun.startReload();PulseGun.reloadTimer*=.5;Game.draw();});
  await page.screenshot({path:path.join(output,'combat-reload.png')});
  for(const group of ['bomb','magnet','freeze']) {
   await page.evaluate(group=>{
    Game.enterBase();Game._hidden=true;CampNav.page='enhance';UI.baseTab='item';UI.baseGadgetFilter='item';
    Meta.data.survivorCoins=2000;
    UI.baseGadgetIndex=Object.keys(CONFIG.META.GADGET_UPGRADES).filter(id=>['laser','bomb','medkit','magnet','freeze'].includes(id)).indexOf(group);Game.draw();
   },group);
   await page.screenshot({path:path.join(output,'camp-'+group+'.png')});
  }
  const combat=await page.evaluate(()=>{
   Game.restart();Game._hidden=true;Player.invincibleTimer=1000;
   for(let frame=0;frame<1200;frame++){
    Game.update(1/60);if(Game.state===CONFIG.GAME.STATE_LEVELUP)ExpLevelUp.selectOffer(0);
    if(frame%30===0)Game.draw();
   }
   Game.draw();return{wave:Spawner.waveIndex,kills:RunStats.kills,remaining:Spawner.remaining(),state:Game.state,error:Game.runtimeError||''};
  });
  fs.writeFileSync(path.join(output,'combat-check.json'),JSON.stringify(combat,null,2));
  if(combat.error||combat.kills<1)throw new Error('实战检查异常: '+JSON.stringify(combat));
  await page.screenshot({path:path.join(output,'combat-playing.png')});
  await page.setViewportSize({width:1000,height:800});
  await page.evaluate(()=>{
   const c=document.createElement('canvas');c.id='enemyReview';c.width=1000;c.height=760;
   c.style.cssText='position:fixed;left:0;top:0;width:1000px;height:760px;z-index:99';document.body.appendChild(c);
   const ctx=c.getContext('2d');ctx.fillStyle='#14242c';ctx.fillRect(0,0,1000,760);
   Enemy.reset();Camera.x=0;Camera.y=0;const visible=Camera.isVisible;Camera.isVisible=()=>true;
   const groups=[CONFIG.V20.NORMALS,CONFIG.V20.ELITES,CONFIG.V20.BOSSES];let index=0;
   for(let family=0;family<3;family++)for(const def of groups[family]) {
    const x=100+(index%5)*200,y=90+Math.floor(index/5)*190;
    const e=Enemy.spawn(x,y,family===1?CONFIG.ENEMY.TYPE_ELITE:def.BASE,1);e.archetypeId=def.ID;Enemy.applyArchetype(e);
    e.radius=family===2?48:40;e.animTime=.4;e.affixes=[];Enemy.drawOne(ctx,e);
    ctx.font='bold 20px sans-serif';ctx.textAlign='center';ctx.fillStyle='#e0eee8';ctx.fillText(def.NAME,x,y+70);index++;
   }
   Camera.isVisible=visible;
  });
  await page.locator('#enemyReview').screenshot({path:path.join(output,'enemy-roster.png')});
  console.log(JSON.stringify({errors,output,enemies:20}));await browser.close();if(errors.length)process.exitCode=1;return;
 }
 if(process.argv.includes('--animation')) {
  const sharp=require(process.env.CHARACTER_SHARP||'sharp');
  await page.setViewportSize({width:760,height:540});
  await page.evaluate(()=>{
   Game._hidden=true;
   for(const id of ['default','rainbow_pony'])Platform.characterImage(id);
   Platform.characterWeapons();
   const c=document.createElement('canvas');c.id='rigReview';c.width=720;c.height=480;
   c.style.cssText='position:fixed;left:0;top:0;width:720px;height:480px;z-index:99';document.body.appendChild(c);
   window.rigStates=Object.keys(CONFIG.CHARACTER.WEAPONS).map(()=>CharacterView.makeState());
  });
  await page.waitForTimeout(300);
  const frames=[];
  for(let frame=0;frame<60;frame++) {
   await page.evaluate(frame=>{
    const c=document.getElementById('rigReview'),ctx=c.getContext('2d'),ids=Object.keys(CONFIG.CHARACTER.WEAPONS);
    ctx.fillStyle='#13232e';ctx.fillRect(0,0,720,480);ctx.font='18px sans-serif';ctx.textAlign='center';
    for(let i=0;i<ids.length;i++){
     const id=ids[i],s=rigStates[i],profile=CharacterView.profile(id),phase=Math.floor(frame/20),t=(frame%20)/20;
     s.time=frame/10;s.facing=5;s.angle=CONFIG.CHARACTER.DIRECTION_ANGLES[5];
     CharacterView.advanceGait(s,.1,phase===0?180:0,1,0);
     s.reload=phase===2&&id!=='flamer'?t:0;s.sustained=id==='flamer'&&phase>0;
     s.recoil=phase===1?Math.max(0,CONFIG.CHARACTER.RECOIL_TIME-s.time%profile.PREVIEW_INTERVAL):0;
     s.flash=phase===1?Math.max(0,CONFIG.CHARACTER.FLASH_TIME-s.time%profile.PREVIEW_INTERVAL):0;
     const x=120+i%3*240,y=195+Math.floor(i/3)*240;
     CharacterView.draw(ctx,x-44,y,1.3,CharacterView.snapshot('default',id),s);
     CharacterView.draw(ctx,x+44,y,1.3,CharacterView.snapshot('rainbow_pony',id),s);
     ctx.fillStyle='#daeaf0';ctx.fillText(CONFIG.TEXT.CHARACTER.WEAPONS[id]+' · '+['移动','射击','装填'][phase],x,y+30);
    }
   },frame);
   const png=await page.locator('#rigReview').screenshot();frames.push(await sharp(png).ensureAlpha().raw().toBuffer());
   if(frame===9||frame===29||frame===49)fs.writeFileSync(path.join(output,'rig-'+frame+'.png'),png);
  }
  await sharp(Buffer.concat(frames),{raw:{width:720,height:480*frames.length,channels:4,pageHeight:480}}).gif({delay:100,loop:0}).toFile(path.join(output,'shared-rig.gif'));
  console.log(JSON.stringify({errors,output,frames:frames.length}));await browser.close();if(errors.length)process.exitCode=1;return;
 }
 await page.evaluate(()=>{Game._hidden=true;CharacterView.updatePreview(.1);Game.draw();});
 await page.screenshot({path:path.join(output,'menu.png')});
 await page.evaluate(()=>{Game.restart();Game._hidden=true;Player.x=1200;Player.y=1200;Camera.update();Player.visual.facing=0;Player.visual.angle=.7;Enemy.reset();for(let i=0;i<12;i++)Enemy.spawn(1200+Math.cos(i)*180,1200+Math.sin(i)*180,0,1);Game.draw();});
 await page.waitForTimeout(100);await page.evaluate(()=>Game.draw());
 await page.screenshot({path:path.join(output,'battle.png')});
 await page.evaluate(()=>{Game.enterBase();CampNav.page='appearance';Wardrobe.open=true;Wardrobe.mode='outfit';Wardrobe.openDetail(Wardrobe.outfits[0]);CharacterView.updatePreview(.1);Game.draw();});
 await page.waitForTimeout(100);await page.evaluate(()=>Game.draw());
 await page.screenshot({path:path.join(output,'wardrobe.png')});
 // 单独渲染四方向检查图，仍调用游戏实际绘制接口。
 for(const id of ['default','special','medic']) {
  await page.evaluate(id=>{Platform.characterImage(id);Platform.characterWeapons();},id);await page.waitForTimeout(100);
  await page.evaluate(id=>{
   let c=document.getElementById('reviewCanvas');if(!c){c=document.createElement('canvas');c.id='reviewCanvas';document.body.appendChild(c);}
   c.width=960;c.height=680;c.style.cssText='position:fixed;left:0;top:0;width:450px;height:319px;z-index:10';
   let ctx=c.getContext('2d');ctx.fillStyle='#111e26';ctx.fillRect(0,0,c.width,c.height);
   const ids=['pistol','ar','flamer'];
   for(let j=0;j<3;j++)for(let i=0;i<4;i++) {
    const s=CharacterView.makeState();s.facing=i;s.angle=CONFIG.CHARACTER.DIRECTION_ANGLES[i];
    CharacterView.draw(ctx,120+i*240,205+j*220,1.6,CharacterView.snapshot(id,ids[j]),s);
   }
  },id);
  await page.locator('#reviewCanvas').screenshot({path:path.join(output,id+'-directions.png')});
 }
 // 同一场景成对测量：旧默认角色绘制 vs 当前默认角色绘制，其他模块保持本次版本。
 const legacy=execFileSync('git',['show','HEAD:src/gameplay/player.js'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
 const timing=await page.evaluate(async source=>{
  document.getElementById('reviewCanvas').remove();
  Game.restart();Game._hidden=true;CONFIG.FIELD.WALLS=[];Enemy.reset();Bullet.reset();
  for(let i=0;i<260;i++)Enemy.spawn(Player.x+Math.cos(i*2.4)*(80+i%15*22),Player.y+Math.sin(i*2.4)*(80+i%15*22),i%3,100);
  for(let i=0;i<180;i++)Bullet.spawn(Player.x+(i%18-9)*23,Player.y+(Math.floor(i/18)-5)*24,i*.13,460,12,0);
  const current=Player,currentDraw=Player.draw,currentG=G.player;
  (0,eval)(source);const legacyDraw=Player.draw;window.Player=current;G.player=currentG;
  window.CostumeView={draw:function(){}}; // 默认外观在旧版此接口为空操作。
  const measure=async draw=>{current.draw=draw;const samples=[],intervals=[];let previous=0;for(let i=0;i<140;i++){await new Promise(requestAnimationFrame);const t=performance.now();Game.draw();if(i>=20){samples.push(performance.now()-t);intervals.push(t-previous);}previous=t;}samples.sort((a,b)=>a-b);intervals.sort((a,b)=>a-b);return{medianMs:samples[60],p95Ms:samples[114],frameIntervalMedianMs:intervals[60],frameIntervalP95Ms:intervals[114]};};
  const before=await measure(legacyDraw),after=await measure(currentDraw);current.draw=currentDraw;
  return{environment:navigator.userAgent,enemyCount:Enemy.pool.filter(e=>e.active).length,bulletCount:Bullet.pool.filter(b=>b.active).length,before,after,note:'桌面Chrome Canvas绘制提交耗时，非微信真机帧率；两组仅替换默认角色绘制，其余场景保持一致。'};
 },legacy);
 fs.writeFileSync(path.join(output,'desktop-timing.json'),JSON.stringify(timing,null,2));
 const root=path.resolve(__dirname,'..'),config=JSON.parse(fs.readFileSync(path.join(root,'project.config.json'),'utf8'));
 const ignores=config.packOptions.ignore;let bytes=0,files=0;
 function count(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const absolute=path.join(folder,entry.name),rel=path.relative(root,absolute).replace(/\\/g,'/');if(rel.startsWith('.git')||ignores.some(i=>i.value===rel||(i.type==='folder'&&rel.startsWith(i.value+'/'))))continue;if(entry.isDirectory())count(absolute);else{bytes+=fs.statSync(absolute).size;files++;}}}
 count(root);fs.writeFileSync(path.join(output,'package-estimate.json'),JSON.stringify({bytes,MiB:bytes/1048576,files,note:'根据packOptions排除后的本地文件量估算，不含开发者工具编译/上传开销。'},null,2));
 console.log(JSON.stringify({errors,output}));await browser.close();
 if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

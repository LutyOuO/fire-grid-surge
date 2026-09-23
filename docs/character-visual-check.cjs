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

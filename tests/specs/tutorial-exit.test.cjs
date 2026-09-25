'use strict';
const assert=require('node:assert/strict');
const {createRuntime}=require('../helpers/runtime-harness.cjs');
for(const mode of ['h5','wx']){
 const h=createRuntime(mode);h.finishImages();const g=h.game,C=g.CONFIG,T=g.Tutorial;
 g.Game.restart();assert(T.running);assert.equal(T.step().ID,'move');
 const money=g.Meta.data.survivorCoins,runs=g.Meta.data.runs,ammo=g.PulseGun.ammo;
 function tap(rect){g.Input.pendingTap.active=true;g.Input.pendingTap.x=rect.x+rect.w/2;g.Input.pendingTap.y=rect.y+rect.h/2;g.Game.update(.016);}
 function endMenu(){g.Panels.pause();const f=g.Panels.layout();tap({x:f.x+36,y:f.y+f.h-f.footer+20,w:f.w-72,h:68});assert.equal(g.Game.state,'QUIT_RUN');h.draw();}
 function quitButton(i){tap(g.Panels.quitButton(g.Panels.quitLayout(),i));}
 endMenu();quitButton(1);assert.equal(g.Game.state,C.GAME.STATE_PLAYING);assert.equal(g.PulseGun.ammo,ammo);
 endMenu();quitButton(0);assert.equal(g.Game.state,'QUIT_CONFIRM');h.draw();quitButton(1);assert.equal(g.Game.state,C.GAME.STATE_PLAYING);
 g.RunStats.gold=500;endMenu();quitButton(0);const time=g.Game.survivedSeconds;g.Game.update(.05);assert.equal(g.Game.survivedSeconds,time);
 const fateOpen=g.FateCards.open;g.FateCards.open=()=>{throw Error('主动退出不应抽命运牌');};quitButton(0);g.FateCards.open=fateOpen;
 assert.equal(g.Game.state,C.GAME.STATE_MENU);assert.equal(g.RunStats.gold,0);assert.equal(g.Meta.data.runs,runs);assert.equal(g.Meta.data.survivorCoins,money);assert(!g.Ads.active);
 // 实际操作推进教学；暂停不增加进度，练习道具只发一次。
 g.Game.restart();g.Enemy.reset();g.Player.x+=C.TUTORIAL.MOVE_DISTANCE;T.update(.016);assert.equal(T.step().ID,'fire');
 g.RunStats.kills=1;T.update(.016);assert.equal(T.step().ID,'xp');g.ExpLevelUp.exp=1;T.update(.016);assert.equal(T.step().ID,'upgrade');
 g.ExpLevelUp.prepareOffers();g.ExpLevelUp.pendingChoices=1;g.Game.enterLevelUp();h.draw();g.ExpLevelUp.selectOffer(0);T.update(.016);assert.equal(T.step().ID,'dash');
 g.Player.startDash();T.update(.016);assert.equal(T.step().ID,'item');assert.equal(g.PowerUps.inventory[C.TUTORIAL.GIFT_TYPE],1);
 g.Panels.pause();const step=T.data().step;g.Game.update(.05);assert.equal(T.data().step,step);g.Panels.resume();
 T.tip=null;T.tipTime=0;T.gap=100;h.draw();assert(g.PowerUps.activate(C.TUTORIAL.GIFT_TYPE));T.update(.016);assert.equal(T.step().ID,'turret');
 T.replay();assert.equal(g.PowerUps.inventory[C.TUTORIAL.GIFT_TYPE],0,'重新学习不能反复领取道具');
 T.data().done=true;T.gap=0;g.Enemy.reset();g.Camera.update();const e=g.Enemy.spawn(g.Player.x+60,g.Player.y,0,1);e.archetypeId='walker';g.Enemy.applyArchetype(e);
 T.update(.016);assert(T.tip);assert(T.data().enemies.walker);T.tip=null;T.tipTime=0;T.gap=0;T.update(.016);assert.equal(T.tip,null,'同种敌人不应重复介绍');
 g.Meta.save();g.Meta.load();assert(g.Meta.data.tutorial.enemies.walker);
 T.replay();const f=T.layout();tap({x:f.x,y:f.y+f.h-C.TUTORIAL.BUTTON_H-C.TUTORIAL.PADDING,w:f.w,h:C.TUTORIAL.BUTTON_H});assert(!T.running);
 const old=JSON.parse(JSON.stringify(g.Meta.data));delete old.tutorial;old.runs=3;g.Meta.mergeSafeData(old);g.Game.restart();assert(!T.running,'老存档不强制重新教学');
 // 正常阵亡仍然结算，主动退出分支没有破坏正常流程。
 g.Player.reviveCharges=0;g.Player.hp=0;g.Game.enterGameOver();assert.equal(g.Game.state,C.GAME.STATE_GAMEOVER);assert.equal(g.Meta.data.runs,4);
 console.log('PASS: '+mode+' 退出二次确认/恢复战斗/无结算无命运/首局教程/首次遇敌/旧存档');
}

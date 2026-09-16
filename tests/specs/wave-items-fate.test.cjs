'use strict';
var assert=require('assert');
var ctx=new Proxy({}, {get:function(t,k){if(k in t)return t[k];if(k==='createLinearGradient'||k==='createRadialGradient')return function(){return{addColorStop:function(){}};};if(k==='measureText')return function(s){return{width:String(s).length*12};};return function(){};},set:function(t,k,v){t[k]=v;return true;}});
var canvas={width:750,height:1334,style:{},getContext:function(){return ctx;},addEventListener:function(){},getBoundingClientRect:function(){return{left:0,top:0,width:750,height:1334};}};
global.window=global;global.innerWidth=750;global.innerHeight=1334;global.devicePixelRatio=1;global.addEventListener=function(){};global.requestAnimationFrame=function(){};
global.document={getElementById:function(){return canvas;},body:{style:{}},addEventListener:function(){},hidden:false};
global.localStorage={getItem:function(){return null;},setItem:function(){}};
require('../../game.js');

var C=global.CONFIG,E=global.Enemy,S=global.Spawner,P=global.Player,U=global.PowerUps;
assert(C.BALANCE,'波次配置未加载');
assert.deepEqual(global.UI.ITEM_SLOTS,[0,4,1,2,3],'五槽顺序错误');
assert.strictEqual(C.POWERUPS.FREEZE_DURATION,8,'冰冻不是8秒');
assert(C.POWERUPS.NORMAL_DROP_CHANCE<.04,'普通道具掉率未下调');
assert(C.POWERUPS.DROP_WEIGHTS[2]>C.POWERUPS.DROP_WEIGHTS[0]&&C.POWERUPS.DROP_WEIGHTS[0]>C.POWERUPS.DROP_WEIGHTS[4],'道具权重顺序错误');

global.Game.restart();global.Game.state=C.GAME.STATE_PLAYING;E.reset();S.reset();S.waveIndex=9;S.beginWave();
assert.strictEqual(S.waveIndex,10,'未进入第10波');assert(S.bossPending,'第10波没有Boss待生成');
S.update(.05,300);var boss=E.getActiveBoss();assert(boss&&boss.isWaveBoss,'第10波未生成独立大Boss');
assert.strictEqual(boss.contactDamage,80,'大Boss接触伤害不是80');assert(boss.maxHp>=C.BALANCE.BOSS_HP,'大Boss血量不足');

// 炸弹分层：小怪秒杀、精英主武器×80、Boss扣当前血15%并震晕。
E.reset();P.x=1200;P.y=1200;S.waveIndex=10;
var walker=E.spawn(1210,1200,C.ENEMY.TYPE_WALKER,S.getHpMultiplier());
var elite=E.spawn(1220,1200,C.ENEMY.TYPE_ELITE,S.getHpMultiplier());
boss=E.spawn(1230,1200,C.ENEMY.TYPE_BOSS,S.getHpMultiplier());
var eliteBefore=elite.hp,bossBefore=boss.hp;U.useBomb();
assert(!walker.active,'炸弹未秒杀范围内普通怪');
assert(elite.hp<eliteBefore,'炸弹未伤害精英');
assert(Math.abs(boss.hp-bossBefore*.85)<1,'炸弹未扣Boss当前生命15%');
assert.strictEqual(boss.stunTimer,3,'Boss没有震晕3秒');

// 冰冻碰撞：玩家不掉血，敌人碎冰死亡。
E.reset();var frozen=E.spawn(P.x,P.y,C.ENEMY.TYPE_TANK,1);P.hp=P.maxHp;U.freezeTimer=8;var hp=P.hp;E.checkPlayerCollisions();
assert(!frozen.active,'碰撞冰冻敌人没有秒杀');assert.strictEqual(P.hp,hp,'碰撞冰冻敌人仍然掉血');

// 命运牌：只能玩家翻3张，并保存三张。
global.FateCards.open();global.FateCards.flip(0,true);global.FateCards.flip(1,true);global.FateCards.flip(2,true);global.FateCards.flip(3,true);
assert.strictEqual(global.FateCards.picked.length,3,'玩家可翻牌数不是3');global.FateCards.confirm();
assert.strictEqual(global.Meta.data.nextRunBuffs.length,3,'没有保存三张下一局增益');

console.log('PASS: 难度/Boss/掉率/炸弹/冰冻/五槽/三牌结算全部通过');

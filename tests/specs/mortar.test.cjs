'use strict';
var assert=require('assert');
var gradients=0,arcs=0,ellipses=0,drawImages=0;
var ctx=new Proxy({}, {get:function(t,k){if(k in t)return t[k];if(k==='createLinearGradient'||k==='createRadialGradient')return function(){gradients++;return{addColorStop:function(){}};};if(k==='measureText')return function(s){return{width:String(s).length*12};};if(k==='arc')return function(){arcs++;};if(k==='ellipse')return function(){ellipses++;};if(k==='drawImage')return function(){drawImages++;};return function(){};},set:function(t,k,v){t[k]=v;return true;}});
var canvas={width:750,height:1334,style:{},getContext:function(){return ctx;},addEventListener:function(){},getBoundingClientRect:function(){return{left:0,top:0,width:750,height:1334};}};
global.window=global;global.innerWidth=750;global.innerHeight=1334;global.devicePixelRatio=1;global.addEventListener=function(){};global.requestAnimationFrame=function(){};
global.document={getElementById:function(){return canvas;},body:{style:{}},addEventListener:function(){},hidden:false};
global.localStorage={getItem:function(){return null;},setItem:function(){}};
// 模拟微信/H5图片已onload但没有width/naturalWidth字段，验证明确就绪表。
global.Image=function(){var self=this;Object.defineProperty(this,'src',{set:function(){if(self.onload)self.onload();}});};
require('../../game.js');

var C=global.CONFIG,F=global.Field,E=global.Enemy,P=global.Player,X=global.MortarExplosionFX;
assert(C.TURRET_VISUAL&&X,'迫击炮模块未加载');
assert(global.Platform.imageReady.mortar_base&&global.UI.icon('mortar_base'),'已onload素材仍被误判不可用');
assert.strictEqual(X.pool.length,12,'爆炸池不是固定12槽');
assert(X.pool.every(function(e){return e.fire.length===5&&e.smoke.length===5;}),'粒子没有预分配');
global.Game.restart();E.reset();P.x=1200;P.y=1200;
var turret=F.turrets[0],target=E.spawn(turret.x+300,turret.y,C.ENEMY.TYPE_WALKER,1);
F.fireTurret(turret);var shell=F.shells.filter(function(s){return s.active;})[0];
assert(shell,'炮塔没有从对象池发射炮弹');
assert(shell.sx>turret.x+40,'炮弹没有从朝右炮口出生');
assert(Math.abs(turret.aimAngle)<.01,'炮管没有朝目标旋转');
F.draw(ctx);assert(drawImages>=3,'炮塔/炮管/炮弹没有使用PNG资产绘制');

// 炮塔激活后必须持续显示圆形时效进度条，不能只剩文字倒计时。
turret.active=true;turret.timer=C.FIELD.TURRET_DURATION/2;turret.charge=0;turret.cooldownTimer=0;
arcs=0;F.drawTurretStatus(ctx);
assert(arcs>=2,'炮塔激活后没有绘制背景环和剩余时间进度环');

// 爆炸半径与配置一致：149px受伤，151px不受伤。
E.reset();var inside=E.spawn(1000,1000,C.ENEMY.TYPE_WALKER,1),outside=E.spawn(1300,1000,C.ENEMY.TYPE_WALKER,1);
inside.x=1149;outside.x=1151;inside.y=outside.y=1000;var hi=inside.hp,ho=outside.hp;F.explode(1000,1000);
assert(inside.hp<hi,'视觉半径内敌人未受伤');assert.strictEqual(outside.hp,ho,'视觉半径外敌人误受伤');
assert(X.pool.some(function(e){return e.active;}),'落地没有创建爆炸池对象');

// 逐层推进并绘制，必须调用径向渐变、圆弧和焦痕ellipse。
[.05,.12,.2,.4,.7,1.2].forEach(function(dt){X.update(dt);X.draw(ctx);});
assert(gradients>0&&arcs>0&&ellipses>0,'五层Canvas爆炸绘制不完整');
console.log('PASS: 拆分素材炮塔/旋转炮管/炮口弹道/150px伤害/五层爆炸对象池全部通过');

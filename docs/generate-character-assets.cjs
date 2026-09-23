// 离线美术导出工具；游戏运行不需要此文件或 sharp，不参与微信上传。
'use strict';
const fs = require('node:fs'), path = require('node:path');
const sharp = require(process.env.CHARACTER_SHARP || 'sharp');
const out = path.resolve(__dirname, '../assets/characters');
const rect = (x,y,w,h,c,r=3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}" stroke="#14212d" stroke-width="2"/>`;
const line = (x,y,xx,yy,c,w=2) => `<path d="M${x} ${y}L${xx} ${yy}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const poly = (p,c) => `<polygon points="${p}" fill="${c}" stroke="#14212d" stroke-width="2" stroke-linejoin="round"/>`;
const palettes = {
  default: { body:'#344c65', light:'#68849b', dark:'#1c2c40', accent:'#ffac43', visor:'#ffb54c', pack:'#263d50', kind:0 },
  special: { body:'#56616a', light:'#a0a9b0', dark:'#292f39', accent:'#ff6843', visor:'#ffc04c', pack:'#3c4249', kind:1 },
  medic: { body:'#d5e2e6', light:'#f4faf9', dark:'#536d82', accent:'#57d6e6', visor:'#66e3ef', pack:'#668ea5', kind:2 }
};
// 每行一层，每列一个方向。全层共享脚底 (64,116)，头顶 y=20。
function layers(p, dir) {
  const back=dir===1, side=dir>=2, flip=dir===2;
  let pack=rect(side?37:43,48,side?19:42,p.kind===1?43:34,p.pack,7);
  pack+=rect(side?40:48,54,side?10:32,8,p.accent,2);
  if(p.kind===1) for(let i=0;i<3;i++)pack+=rect(side?40:49,68+i*6,side?10:30,3,p.accent,1);
  if(p.kind===2) pack+=rect(side?41:59,65,7,17,p.light,1)+rect(side?38:54,70,side?13:17,6,p.light,1);
  const leg=(x)=>rect(x,82,17,26,p.dark,5)+rect(x+1,89,15,10,p.body,3)+rect(x-2,104,22,12,p.dark,4)+line(x+2,109,x+16,109,p.light);
  let torso=poly(side?'51,53 72,51 81,65 75,88 50,88 45,67':'43,51 83,51 90,63 80,88 47,88 37,63',p.body);
  torso+=rect(side?51:48,57,side?22:32,22,p.dark,4)+poly(side?'52,58 70,56 73,66 54,68':'48,57 80,57 77,67 51,67',p.light);
  torso+=rect(side?55:53,69,side?15:23,5,p.accent,1)+rect(46,84,35,6,p.dark,2);
  const shoulder=p.kind===1?20:15;
  torso+=rect(side?71:32,51,shoulder,17,p.light,5);
  if(!side)torso+=rect(81,51,shoulder,17,p.light,5);
  let head=rect(side?46:42,20,side?34:44,35,p.body,11);
  head+=poly(side?'49,22 66,19 78,24 80,31 48,29':'45,22 65,18 83,23 87,32 41,32',p.light);
  if(back)head+=rect(49,33,30,13,p.dark,3)+rect(58,24,12,7,p.accent,2);
  else {head+=rect(side?64:44,33,side?21:40,12,p.dark,4)+rect(side?68:47,35,side?16:34,7,p.visor,3);head+=rect(side?66:51,46,side?13:26,10,p.dark,3);}
  head+=rect(side?43:37,33,8,15,p.dark,3);
  if(!side)head+=rect(84,33,8,15,p.dark,3);
  if(p.kind===1)head+=rect(51,17,26,5,p.accent,2);
  if(p.kind===2)head+=rect(58,21,12,6,p.accent,1);
  const ls=[pack,leg(side?54:44),leg(side?62:68),torso,head];
  return ls.map(s=>flip?`<g transform="translate(128 0) scale(-1 1)">${s}</g>`:s);
}
function gun(id) {
  let g='';
  const c='#587388',dark='#223342',light='#adc3cc',orange='#ffad42';
  if(id==='pistol')g=rect(25,22,51,16,c)+rect(75,25,20,10,dark)+poly('37,36 50,36 46,57 34,57',dark)+rect(27,19,38,4,light,1);
  else if(id==='crossbow')g=rect(15,24,76,12,c)+poly('32,34 44,34 39,53 27,53',dark)+line(74,5,98,29,light,6)+line(74,56,98,30,light,6)+line(74,5,74,56,orange,2)+line(32,30,111,30,orange,3);
  else {g=poly('7,26 27,25 32,20 75,20 83,25 83,38 27,38 7,45',c)+rect(79,25,id==='flamer'?32:35,10,dark)+poly('34,38 47,38 42,56 30,56',dark);g+=rect(52,37,20,id==='mg'?22:14,dark,2)+rect(28,17,42,4,light,1);if(id==='flamer')g+=rect(24,9,40,14,orange,6)+rect(103,21,17,18,light,3);if(id==='smg')g+=rect(74,23,12,14,light);if(id==='mg')g+=rect(49,37,33,21,orange,4)+line(87,34,92,53,light,3);}
  return g+rect(55,25,12,4,orange,1);
}
async function exportAll(){
  fs.mkdirSync(out,{recursive:true});
  for(const [id,p] of Object.entries(palettes)) {
    let body=''; for(let d=0;d<4;d++)layers(p,d).forEach((s,l)=>body+=`<g transform="translate(${d*128} ${l*128})">${s}</g>`);
    await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="640">${body}</svg>`)).png({palette:true,colours:128}).toFile(path.join(out,id+'.png'));
  }
  const ids=['pistol','smg','ar','mg','flamer','crossbow'];
  const thumbs=Object.values(palettes).map((p,i)=>`<g transform="translate(${i*128} 0)">${layers(p,0).join('')}</g>`).join('');
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="384" height="128">${thumbs}</svg>`)).png({palette:true,colours:128}).toFile(path.join(out,'portraits.png'));
  const body=ids.map((id,i)=>`<g transform="translate(0 ${i*64})">${gun(id)}</g>`).join('');
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="384">${body}</svg>`)).png({palette:true,colours:128}).toFile(path.join(out,'weapons.png'));
}
exportAll().catch(e=>{console.error(e);process.exitCode=1;});

'use strict';
const assert=require('node:assert/strict');
const {createRuntime}=require('../helpers/runtime-harness.cjs');
for(const mode of ['h5','wx']){
  const h=createRuntime(mode);h.finishImages();const g=h.game,C=g.CONFIG,S=g.Spawner,E=g.Enemy;
  g.Game.restart();
  assert.equal(C.UPGRADES.V20_CARDS.filter(c=>c[7]==='COMMON').length,16);
  assert.equal(C.UPGRADES.V20_CARDS.filter(c=>c[7]==='RARE').length,12);
  assert.equal(C.V20.FATE_CARDS.filter(c=>c[3]==='COMMON').length,12);
  assert.equal(C.V20.FATE_CARDS.filter(c=>c[3]==='RARE').length,8);
  assert.deepEqual([C.SUPPLY.PRICES.MEDKIT,C.SUPPLY.PRICES.LASER,C.SUPPLY.PRICES.MAGNET,C.SUPPLY.PRICES.FREEZE,C.SUPPLY.PRICES.BOMB],[70,160,60,100,120]);
  assert.equal(C.KILL_DROPS.GOLD_NORMAL_CHANCE,.12);
  // 战斗 HUD 只保留一处弹药；空弹/换弹时没有 0 或弹匣数字。
  h.labels.length=0;g.PulseGun.ammo=7;g.PulseGun.reloading=false;g.PulseGun.drawReload(h.ctx);
  assert.deepEqual(h.labels,['7']);
  for(const reloading of [false,true]){h.labels.length=0;g.PulseGun.ammo=0;g.PulseGun.reloading=reloading;g.PulseGun.drawReload(h.ctx);assert.equal(h.labels.length,0);}
  h.labels.length=0;g.UI.drawHud(h.ctx);
  assert(!h.labels.some(s=>/^(HP|EXP|弹药)\b/.test(s)),'顶部重复显示玩家状态');
  g.PulseGun.reset();
  // 所有敌人原型都必须有独立美术部件，包括缺图/低画质时的程序绘制。
  for(const def of [...C.V20.NORMALS,...C.V20.ELITES,...C.V20.BOSSES])assert(C.ENEMY.ART.MODELS[def.ID].length>=4);
  // 旧存档缺少新道具字段可以加载；购买扣费与局内效果同源。
  const old=JSON.parse(JSON.stringify(g.Meta.data));delete old.upg.gadget.bomb;delete old.upg.gadget.magnet;delete old.upg.gadget.freeze;
  g.Meta.mergeSafeData(old);g.Meta.data.survivorCoins=100000;
  for(const id of ['bomb','magnet','freeze'])for(const item of C.META.GADGET_UPGRADES[id].items){
    assert.equal(g.Meta.getGadgetLevel(id,item.ID),0);
    const price=g.Meta.getGadgetPrice(id,item.ID),money=g.Meta.data.survivorCoins;
    assert(g.Meta.buyGadget(id,item.ID));assert.equal(g.Meta.data.survivorCoins,money-price);
    assert.equal(g.Meta.getGadgetAmount(id,item.ID),item.AMOUNT);
  }
  g.Meta.save();g.Meta.load();assert.equal(g.Meta.getGadgetLevel('freeze','duration'),1);
  const P=g.PowerUps;
  P.inventory[C.POWERUPS.TYPE_MAGNET]=1;assert(P.activate(C.POWERUPS.TYPE_MAGNET));
  assert.equal(P.magnetTimer,C.POWERUPS.MAGNET_DURATION+.5);
  assert.equal(P.maxFor(C.POWERUPS.TYPE_MAGNET),C.POWERUPS.MAX.MAGNET+1);
  P.inventory[C.POWERUPS.TYPE_FREEZE]=1;g.Player.shield=0;assert(P.activate(C.POWERUPS.TYPE_FREEZE));
  assert.equal(P.freezeTimer,C.POWERUPS.FREEZE_DURATION+.6);assert.equal(g.Player.shield,g.Player.maxHp*.05);
  assert.equal(P.maxFor(C.POWERUPS.TYPE_FREEZE),C.POWERUPS.MAX.FREEZE+1);
  assert.equal(P.bombRadius(true),C.BOMB_THROW.RADIUS+16);
  E.reset();const target=E.spawn(g.Player.x+10,g.Player.y,C.ENEMY.TYPE_BOSS,1);target.maxHp=target.hp=1000;
  P.explodeThrownBomb({x:g.Player.x,y:g.Player.y});assert.equal(target.hp,1000-1000*C.BOMB_THROW.BOSS_RATIO*1.1);
  assert.equal(target.stunTimer,C.BOMB_THROW.BOSS_STUN+.25);
  // 点击基地实际购买热区，确认分页索引不会把炸弹/磁铁/冰冻买成别的组。
  g.Game.enterBase();g.CampNav.page='enhance';g.UI.baseTab='item';g.UI.baseGadgetFilter='item';
  const itemIds=Object.keys(C.META.GADGET_UPGRADES).filter(id=>['laser','bomb','medkit','magnet','freeze'].includes(id));
  for(const id of ['bomb','magnet','freeze']){
    g.UI.baseGadgetIndex=itemIds.indexOf(id);h.draw();
    const def=C.META.GADGET_UPGRADES[id].items[0],before=g.Meta.getGadgetLevel(id,def.ID);
    g.Input.pendingTap.active=true;g.Input.pendingTap.x=C.UI.BASE_CARD_X+C.UI.BASE_CARD_WIDTH-20;
    g.Input.pendingTap.y=C.UI.BASE_LIST_Y+C.UI.BASE_ROW_HEIGHT-C.UI.BASE_BUY_HEIGHT/2-8;
    g.Game.updateBase(.016);assert.equal(g.Meta.getGadgetLevel(id,def.ID),before+1,id+' 点击买错强化');
  }
  g.Meta.mergeSafeData(old);g.Game.restart();
  for(const [wave,quota] of [[1,12],[9,44],[10,24],[11,42],[19,26],[20,13],[21,24]]){
    S.reset();S.waveIndex=wave-1;S.beginWave();assert.equal(S.waveQuota,quota,mode+' 第'+wave+'波配额');
    assert(S.eliteQuota<=4,mode+' 精英上限');
  }
  E.reset();S.reset();S.waveIndex=19;S.beginWave();
  assert.equal(S.bossQueue.length,3);
  S.update(.05,0);
  assert.equal(S.activeFamilyCount('boss'),1);
  const first=E.getActiveBoss(),def=first.archetype;
  assert.equal(first.maxHp,Math.ceil(C.BALANCE.BOSS_HP*def.HP*2*2));
  for(const [wave,late] of [[10,1],[20,2],[30,5],[40,8]]){
    S.waveIndex=wave;
    const probe=E.spawn(g.Player.x+600,g.Player.y,C.ENEMY.TYPE_BOSS,1);
    probe.archetypeId='charger';E.applyArchetype(probe);
    assert.equal(probe.maxHp,Math.ceil(C.BALANCE.BOSS_HP*1.3*(1+.05*wave)*late),mode+' 第'+wave+'波生命系数');
    probe.active=false;E.activeCount--;
  }
  S.waveIndex=20;
  assert.equal(S.remaining(),20,'生成前后本波总剩余应守恒');
  S.update(C.V20.BOSS_GAP+.01,0);
  assert.equal(S.activeFamilyCount('boss'),2);
  assert.equal(S.bossQueue.length,1);
  for(const e of E.pool)if(e.active&&e.family==='boss'){e.active=false;E.activeCount--;break;}
  S.update(C.V20.BOSS_GAP+.01,0);
  assert.equal(S.activeFamilyCount('boss'),2);
  assert.equal(S.bossQueue.length,0);
  assert.equal(S.bossSpawnPoints.length,3);
  for(let i=0;i<3;i++)for(let j=0;j<i;j++)assert(Math.hypot(S.bossSpawnPoints[i].x-S.bossSpawnPoints[j].x,S.bossSpawnPoints[i].y-S.bossSpawnPoints[j].y)>=C.V20.BOSS_PAIR_DISTANCE);
  g.FateCards.open();
  for(let n=0;n<100;n++){g.FateCards.deal();assert.equal(new Set(g.FateCards.cards.map(c=>c.def[0])).size,9,mode+' 九宫格重复卡');}
  const ammo=g.FateCards.defs.find(d=>d[4]==='AMMO_START'),bare=g.FateCards.defs.find(d=>d[4]==='BAREHANDS');
  g.FateCards.cards=[{def:ammo,open:true},{def:bare,open:false}];
  g.FateCards.enforceMutex(ammo);
  assert.equal(g.FateCards.cards[1].def[3],bare[3],mode+' 互斥补牌改变档位');
  assert.notEqual(g.FateCards.cards[1].def[0],bare[0],mode+' 互斥补牌未替换');
  assert.notEqual(g.FateCards.cards[1].def[0],ammo[0],mode+' 互斥补牌重复');
  const rolls=20000,high={upgrade:0,fate:0};
  for(let i=0;i<rolls;i++){
    g.ExpLevelUp.prepareOffers();g.FateCards.deal();
    let u=g.ExpLevelUp.offers.slice(0,g.ExpLevelUp.offerCount).some(o=>['EPIC','LEGENDARY','RAINBOW'].includes(o.rarity.ID));
    let f=g.FateCards.cards.some(c=>c.def[3]==='EPIC'||c.def[3]==='LEGENDARY');
    if(u)high.upgrade++;if(f)high.fate++;
  }
  assert(Math.abs(high.upgrade/rolls-.0559)<.012,mode+' 三选一整组高档概率');
  assert(Math.abs(high.fate/rolls-.103)<.015,mode+' 九宫格整板高档概率');
  E.reset();
  for(const [family,list] of [['normal',C.V20.NORMALS],['elite',C.V20.ELITES],['boss',C.V20.BOSSES]]){
    for(let i=0;i<list.length;i++){
      const d=list[i],e=E.spawn(g.Player.x+(i%5-2)*110,g.Player.y+Math.floor(i/5)*110,family==='elite'?C.ENEMY.TYPE_ELITE:d.BASE,1);
      assert(e,mode+' '+d.ID+' 生成失败');e.archetypeId=d.ID;E.applyArchetype(e);
      assert.equal(e.family,family);assert(e.maxHp>0);
    }
  }
  h.draw();
  assert(h.labels.some(s=>s.includes('第 20 波 · 剩余')),mode+' HUD 缺少本波剩余窄条');
  E.reset();
  const frost=E.spawn(g.Player.x,g.Player.y,C.ENEMY.TYPE_ELITE,1);
  frost.archetypeId='frost';E.applyArchetype(frost);E.executeEliteSkill(frost,frost.archetype);
  E.update(.05);
  assert(E.frostTrails.some(t=>t.active),mode+' 冰痕未留下轨迹');
  assert(g.Player.slowTimer>0,mode+' 冰痕未减速玩家');
  function spitterAfter(fps){
    E.reset();const e=E.spawn(g.Player.x+300,g.Player.y,C.ENEMY.TYPE_WALKER,1);
    e.archetypeId='spitter';E.applyArchetype(e);e.attackState='tell';e.tellTimer=.6;
    for(let i=0;i<Math.round(.7*fps);i++)E.update(1/fps);
    return {state:e.attackState,cooldown:e.skillTimer};
  }
  const sixty=spitterAfter(60),oneTwenty=spitterAfter(120);
  assert.equal(sixty.state,'move');assert.equal(oneTwenty.state,'move');
  assert(Math.abs(sixty.cooldown-oneTwenty.cooldown)<.04,mode+' 60/120帧技能冷却不一致');
  console.log('PASS: '+mode+' v20 配额/Boss生命与错峰/九宫格去重/整组概率/双端绘制');
}

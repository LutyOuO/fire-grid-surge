'use strict';
const assert=require('node:assert/strict');
const {createRuntime}=require('../helpers/runtime-harness.cjs');
for(const mode of ['h5','wx']){
  const h=createRuntime(mode),g=h.game,C=g.CONFIG,defs=C.UPGRADES.DEFINITIONS;
  g.Game.restart();
  const scopes=['all','firearm','pistol','smg','rifle','machinegun','flamethrower','crossbow','blade'];
  for(const d of defs)assert(scopes.includes(d.weaponScope),'缺少合法 weaponScope: '+d.ID);
  for(const weapon of ['pistol','smg','ar','mg','flamer','crossbow']){
    g.WeaponProgress.selected=weapon;
    for(const id in g.ExpLevelUp.levels)g.ExpLevelUp.levels[id]=0;
    g.ExpLevelUp.collectEligibleDefinitions();
    const pool=g.ExpLevelUp.candidateIndices.map(i=>defs[i]);
    assert(pool.every(d=>C.UPGRADES.weaponEligible(d,weapon)),weapon+' 候选池包含越界词条');
    assert(pool.some(d=>d.weaponScope==='all'),weapon+' 缺少通用词条');
    if(['smg','ar','mg'].includes(weapon)){
      const scope=C.UPGRADES.WEAPON_IDS[weapon];
      assert(pool.some(d=>d.weaponScope===scope),weapon+' 缺少专属词条');
      assert(pool.some(d=>d.weaponScope==='firearm'),weapon+' 缺少枪械通用词条');
      assert(pool.every(d=>d.weaponScope!=='pistol'),weapon+' 出现手枪专属词条');
    }
    if(weapon==='flamer'||weapon==='crossbow')assert(pool.every(d=>!['RELOAD_SPEED','MAGAZINE_CAPACITY'].includes(d.EFFECT)),weapon+' 出现弹匣词条');
    for(let round=0;round<100;round++){
      g.ExpLevelUp.prepareOffers();
      const seen=new Set();
      for(let i=0;i<g.ExpLevelUp.offerCount;i++){
        const offer=g.ExpLevelUp.offers[i];
        assert(C.UPGRADES.weaponEligible(offer.definition,weapon),weapon+' 三选一出现越界词条');
        assert(!seen.has(offer.definition.ID),weapon+' 同屏重复词条');seen.add(offer.definition.ID);
      }
    }
  }
  console.log('PASS: '+mode+' 六武器 weaponScope、100组三选一、同屏去重');
}

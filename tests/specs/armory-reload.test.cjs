'use strict';
const assert = require('node:assert/strict');
const { createRuntime } = require('../helpers/runtime-harness.cjs');

for (const mode of ['h5', 'wx']) {
  const r = createRuntime(mode);
  r.finishImages();
  const g = r.game, C = g.CONFIG;
  g.Game.restart();

  // 手枪恰好 7 发进入换弹，换弹期间不补弹，1.5 秒后装满。
  const target = g.Enemy.spawn(g.Player.x + 200, g.Player.y, C.ENEMY.TYPE_TANK, 100);
  assert.equal(g.PulseGun.getMagazineSize(), 7);
  for (let i = 0; i < 7; i++) g.PulseGun.fireAt(target);
  assert.equal(g.PulseGun.ammo, 0);
  assert.equal(g.PulseGun.reloading, true);
  g.PulseGun.update(.75);
  assert.equal(g.PulseGun.ammo, 0, '换弹中不得提前补满');
  g.PulseGun.update(.75);
  assert.equal(g.PulseGun.reloading, false);
  assert.equal(g.PulseGun.ammo, 7);

  // 武器强化必须逐级，倍率同步作用于伤害与弹匣。
  assert.equal(g.Armory.buyWeaponLevel(2), false);
  assert.equal(g.Armory.buyWeaponLevel(1), true);
  assert.equal(g.PulseGun.getMagazineSize(), 14);
  assert.equal(g.Armory.damageMultiplier(), 2);
  assert.equal(g.Armory.buyWeaponLevel(2), true);
  assert.equal(g.PulseGun.getMagazineSize(), 28);
  assert.equal(g.Armory.buyWeaponLevel(3), true);
  assert.equal(g.PulseGun.getMagazineSize(), 56);

  // 一个 30 发区块只能出现一颗特殊弹；更换弹药会替换旧类型。
  g.Armory.buyAmmo('napalm');
  g.Armory.specialSlot = 17;
  let special = [];
  for (let i = 1; i <= 30; i++) if (g.Armory.nextSpecial()) special.push(i);
  assert.deepEqual(special, [17]);
  g.Armory.buyAmmo('frost');
  assert.equal(g.Armory.ammoType, 'frost');

  // 护甲优先承伤。
  g.Player.armorMax = 40; g.Player.shield = 40;
  const hp = g.Player.hp;
  g.Player.takeDamage(15, 'normal');
  assert.equal(g.Player.shield, 25);
  assert.equal(g.Player.hp, hp);

  // 拖拽炸弹：200px 钳制、取消不扣、飞行+3秒引信后按最大生命比例伤害。
  const bombType = C.POWERUPS.TYPE_BOMB;
  g.PowerUps.inventory[bombType] = 2;
  g.PowerUps.beginBombAim(7);
  g.PowerUps.moveBombAim(7, g.Player.x - g.Camera.x + 1000, g.Player.y - g.Camera.y);
  assert(Math.abs(g.PowerUps.bombAim.x - g.Player.x - C.BOMB_THROW.RANGE) < 1e-6);
  const bombSlot = g.UI.getSlotRect(g.UI.ITEM_SLOTS.indexOf(bombType));
  g.PowerUps.endBombAim(7, bombSlot.x + 2, bombSlot.y + 2, 400, 40);
  assert.equal(g.PowerUps.inventory[bombType], 2, '拖回图标取消不得扣库存');
  const ratioVictim = g.Enemy.spawn(g.Player.x + C.BOMB_THROW.RANGE, g.Player.y, C.ENEMY.TYPE_TANK, 10);
  const beforeBombHp = ratioVictim.hp;
  g.PowerUps.beginBombAim(8);
  g.PowerUps.endBombAim(8, 0, 0, 100, 0);
  assert.equal(g.PowerUps.inventory[bombType], 1);
  g.PowerUps.updateThrownBombs(C.BOMB_THROW.FLIGHT + .01);
  g.PowerUps.updateThrownBombs(C.BOMB_THROW.FUSE + .01);
  assert(ratioVictim.hp <= beforeBombHp - ratioVictim.maxHp * C.BOMB_THROW.HP_RATIO + 1e-6);

  // 炫彩品质按唯一 ID 封顶后必须退出候选池。
  const rainbowDef = C.UPGRADES.DEFINITIONS[0];
  g.ExpLevelUp.rainbowOwned[rainbowDef.ID] = true;
  assert.equal(g.ExpLevelUp.isEligible(rainbowDef), false);

  // 炸弹应扣库存并伤害范围内敌人。
  g.PowerUps.inventory[bombType] = 1;
  const victim = g.Enemy.spawn(g.Player.x + 20, g.Player.y, C.ENEMY.TYPE_WALKER, 1);
  assert.equal(g.PowerUps.activate(bombType), true);
  assert.equal(g.PowerUps.inventory[bombType], 0);
  assert.equal(victim.active, false);
}

console.log('PASS: 换弹/军械强化/特殊弹药/护甲/炸弹回归');

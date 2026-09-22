'use strict';
const assert = require('node:assert/strict');
const { createRuntime } = require('../helpers/runtime-harness.cjs');

for (const mode of ['h5', 'wx']) {
  const r = createRuntime(mode); r.finishImages();
  const g = r.game, C = g.CONFIG;
  g.Game.restart();
  const runs = g.Meta.data.runs;
  g.Game.commitSettlement(false);
  const coins = g.Meta.data.survivorCoins;
  g.Game.commitSettlement(false);
  assert.equal(g.Meta.data.survivorCoins, coins, '重复结算不重复发幸存者硬币');
  g.RunStats.coinDoubleClaimed = true; g.Game.commitSettlement(false);
  assert.equal(g.Meta.data.runs, runs + 1, '追加奖励不能再次增加局数');
  g.Game.reviveAfterAd(); g.Game.commitSettlement(false);
  assert.equal(g.Meta.data.runs, runs + 1, '复活后仍然属于同一局');
  // v012 #75：开局按玩家所选地图（Meta.data.selectedMap）加载，不再按 runs 自动轮换。
  g.Game.restart(); assert.equal(g.Field.layoutIndex, g.Meta.data.selectedMap);

  // 持续伤害必须按时间结算，暂停不推进，回收后清零。
  g.Enemy.reset();
  let e = g.Enemy.spawn(1200, 1200, C.ENEMY.TYPE_WALKER, 100);
  e.hp = e.maxHp = 10000;
  g.Enemy.applyMortarBurn(e, 60);
  const hp = e.hp;
  for (let i = 0; i < 60; i++) g.Enemy.updateMortarBurn(e, 0.05);
  assert(Math.abs(hp - e.hp - 180) < 1e-6, '燃烧3秒应结算180伤害');
  g.Enemy.applyMortarBurn(e, 60); g.Game.state = 'PAUSED';
  const burnTime = e.mortarBurnTime; g.Game.update(0.05);
  assert.equal(e.mortarBurnTime, burnTime);
  g.Enemy.reset(); e = g.Enemy.spawn(1200, 1200, C.ENEMY.TYPE_WALKER, 1);
  assert.equal(e.mortarBurnTime, 0);
  const prior = g.Meta.data.achievements.progress.mortar || 0;
  g.Enemy.applyMortarBurn(e, 10000); g.Enemy.updateMortarBurn(e, 0.5);
  assert.equal(g.Meta.data.achievements.progress.mortar, prior + 1, '迫击击杀只记一次');

  // 冰球仅对冻结目标加成，减速不算；排除随机暴击。
  function frostDamage(frozen, slow) {
    g.Game.restart(); g.Enemy.reset(); g.Player.critChance = 0;
    g.Meta.data.upg.gadget.turret_frost.shatter = 1;
    const tower = g.Field.turrets.find(t => t.kind === 'frost');
    const enemy = g.Enemy.spawn(tower.x + 40, tower.y, C.ENEMY.TYPE_WALKER, 100);
    enemy.hp = enemy.maxHp = 10000; enemy.freezeTimer = frozen; enemy.slowMul = slow;
    g.Field.fireFrost(tower); g.Field.updateFrost(0.1);
    return 10000 - enemy.hp;
  }
  const normal = frostDamage(0, 1);
  assert(normal > 0); assert.equal(frostDamage(0, 0.45), normal);
  assert.equal(frostDamage(1, 1), normal * 1.25);

  // 真实触摸选择所有品质；免费刷新不触发广告，不扣广告次数。
  g.Game.restart(); g.ExpLevelUp.pendingChoices = 1; g.Game.enterLevelUp();
  g.Game.requestLevelRefresh();
  assert.equal(g.RunStats.freeRefreshUsed, 1); assert.equal(g.RunStats.adRefreshUsed, 0);
  assert.equal(g.Ads.active, false);
  for (const rarity of C.UPGRADES.RARITIES) {
    g.Game.restart(); g.ExpLevelUp.pendingChoices = 1; g.Game.enterLevelUp();
    g.ExpLevelUp.offers[0].rarity = rarity;
    r.draw();
    const x = C.UI.CARD_X + 40, y = C.UI.CARD_START_Y + 40;
    g.Input.onTouchStart(x, y, 123); g.Input.onTouchEnd(x, y, 123); g.Game.update(1 / 60);
    assert.equal(g.Game.state, C.GAME.STATE_PLAYING, '选卡后应恢复战斗');
    assert.equal(g.RunStats.choicesTaken, 1);
    g.ExpLevelUp.selectOffer(0); assert.equal(g.RunStats.choicesTaken, 1);
  }
  g.Game.restart(); g.ExpLevelUp.pendingChoices = 3; g.Game.enterLevelUp();
  for (let n = 3; n > 0; n--) {
    r.draw(); g.ExpLevelUp.selectOffer(0); assert.equal(g.ExpLevelUp.pendingChoices, n - 1);
  }
  assert.equal(g.Game.state, C.GAME.STATE_PLAYING);

  // 电网先预警，在不受其他无敌效果影响时每秒实际扣8血。
  g.Game.restart(); g.BattleEvents.start('grid_surge');
  g.BattleEvents.active.strips = [{axis: 'x', pos: g.Player.x}];
  g.Player.invincibleTimer = 0; g.Player.shield = 0; g.Player.incomingDamageMultiplier = 1;
  const initial = g.Player.hp;
  g.BattleEvents.tickActive(C.PRODUCT.GRID_WARNING);
  assert.equal(g.Player.hp, initial);
  for (let i = 0; i < 20; i++) g.BattleEvents.tickActive(0.05);
  assert(Math.abs(initial - g.Player.hp - 8) < 1e-6);
  g.Game.state = C.GAME.STATE_LEVELUP;
  const eventTime = g.BattleEvents.active.t; g.Game.update(0.05);
  assert.equal(g.BattleEvents.active.t, eventTime);
  g.Game.state = C.GAME.STATE_GAMEOVER; r.draw();
  console.log('PASS: ' + mode + ' 局数/发奖/燃烧/碎冰/免费刷新/真实选卡/连升/事件预警与DPS');
}

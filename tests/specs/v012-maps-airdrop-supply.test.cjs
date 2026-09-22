'use strict';
// v012 #75/#76/#78：选图解锁流程、空投按波触发与站立激活掉落、补给点购买扣费。
const assert = require('node:assert/strict');
const { createRuntime } = require('../helpers/runtime-harness.cjs');

for (const mode of ['h5', 'wx']) {
  const r = createRuntime(mode); r.finishImages();
  const g = r.game, C = g.CONFIG;

  // #75 默认只解锁第 1 张；老存档无字段 → 回退只解锁 cross_ruin。
  // 注意 wx 模式游戏跑在独立 realm，数组是跨 realm 的 Array，不能用 deepEqual，逐元素断言。
  assert.equal(g.Meta.data.unlockedMaps.length, 1, '新存档默认只解锁第 1 张');
  assert.equal(g.Meta.data.unlockedMaps[0], 0);
  assert.equal(g.Meta.data.selectedMap, 0);
  assert.equal(g.Meta.isMapUnlocked(0), true);
  assert.equal(g.Meta.isMapUnlocked(1), false, 'ring_street 初始锁定');
  assert.equal(g.Meta.isMapUnlocked(2), false, 'slash_yard 初始锁定');
  g.Meta.mergeSafeData({ runs: 5, bestWave: 3 });
  assert.equal(g.Meta.data.unlockedMaps.length, 1, '老存档缺字段仍只解锁第 1 张');
  assert.equal(g.Meta.data.unlockedMaps[0], 0);
  assert.equal(g.Meta.data.selectedMap, 0, '老存档缺字段仍选第 1 张');

  // 波次里程碑解锁 ring_street：到达第 10 波自动解锁并持久化。
  g.Meta.data.bestWave = 10;
  g.Meta.refreshMapUnlocks();
  assert.equal(g.Meta.isMapUnlocked(1), true, '到达第 10 波应解锁 ring_street');
  assert.notEqual(g.Meta.data.unlockedMaps.indexOf(1), -1);
  assert.equal(g.Meta.isMapUnlocked(2), false, 'coins 类解锁不会自动解锁');

  // 幸存者硬币购买 slash_yard：扣硬币、写入 unlockedMaps、切为当前选择。
  const cost = C.FIELD.LAYOUTS[2].unlock.cost;
  g.Meta.data.survivorCoins = cost + 10;
  assert.equal(g.Meta.canBuyMap(2), true);
  const beforeCoins = g.Meta.data.survivorCoins;
  assert.equal(g.Meta.buyMap(2), true);
  assert.equal(g.Meta.data.survivorCoins, beforeCoins - cost, '购买应扣幸存者硬币');
  assert.equal(g.Meta.data.selectedMap, 2);

  // 选图状态机：主菜单 → 选图 → 选定后进入武器选择；开战加载所选地图。
  g.Game.restart();
  g.Meta.selectMap(0);
  g.Game.enterMapSelect();
  assert.equal(g.Game.state, C.GAME.STATE_MAP_SELECT);
  g.Game.restart();
  assert.equal(g.Field.layoutIndex, g.Meta.data.selectedMap, '开局应加载所选地图');

  // #76 空投：到第 2 波，BattleEvents 既有调度链按波投下空投。
  g.Spawner.waveIndex = 2;
  g.BattleEvents.active = null;
  g.BattleEvents.update(0.016);
  assert.equal(g.BattleEvents.active.id, 'airdrop', '第 2 波应投下空投');
  const ev = g.BattleEvents.active;
  const def = C.EVENTS.KINDS.airdrop;
  assert(g.Enemy.activeCount >= def.GUARD_COUNT, '落点应刷新守护敌人');
  // 玩家站到落点上站立充能 → 掉金币 + 道具，事件结束。
  g.Player.x = ev.x; g.Player.y = ev.y;
  const coinsBefore = g.CoinDrops.activeCount;
  for (let i = 0; i < 240; i++) g.BattleEvents.update(1 / 60);
  assert(g.CoinDrops.activeCount > coinsBefore, '激活后应掉局内金币');
  assert.equal(g.BattleEvents.active, null, '激活后空投事件应结束');

  // #78 补给点：第 3 波出现，靠近才开购买面板；按价扣局内金币；超时消失。
  g.Game.restart();
  g.Spawner.waveIndex = C.SUPPLY.MIN_WAVE;
  g.SupplyPoint.update(0.016);
  assert.equal(g.SupplyPoint.active, true, '第 3 波应出现补给点');
  // 远离时面板关闭。
  g.Player.x = g.SupplyPoint.x + 2000; g.Player.y = g.SupplyPoint.y + 2000;
  g.SupplyPoint.update(0.016);
  assert.equal(g.SupplyPoint.open, false, '远离补给点不应打开面板');
  // 站到旁边。
  g.Player.x = g.SupplyPoint.x; g.Player.y = g.SupplyPoint.y;
  g.SupplyPoint.update(0.016);
  assert.equal(g.SupplyPoint.open, true, '靠近补给点应打开面板');
  // 金币不足 → 购买被拒，道具不增加。
  g.RunStats.gold = 10;
  const inv0 = g.PowerUps.inventory[C.POWERUPS.TYPE_MEDKIT];
  assert.equal(g.RunStats.buySupplyItem(C.POWERUPS.TYPE_MEDKIT, C.SUPPLY.PRICES.MEDKIT), false, '金币不足应购买失败');
  assert.equal(g.PowerUps.inventory[C.POWERUPS.TYPE_MEDKIT], inv0);
  // 金币足够 → 扣金币、道具+1。
  g.RunStats.gold = 100;
  assert.equal(g.RunStats.buySupplyItem(C.POWERUPS.TYPE_MEDKIT, C.SUPPLY.PRICES.MEDKIT), true);
  assert.equal(g.PowerUps.inventory[C.POWERUPS.TYPE_MEDKIT], inv0 + 1, '购买应使道具+1');
  assert.equal(g.RunStats.gold, 100 - C.SUPPLY.PRICES.MEDKIT, '购买应按价扣局内金币');
  // 存在时限后消失。
  g.SupplyPoint.t = 0.01;
  g.SupplyPoint.update(0.1);
  assert.equal(g.SupplyPoint.active, false, '超时后补给点应消失');

  console.log('PASS: ' + mode + ' 选图解锁/空投/补给扣费');
}

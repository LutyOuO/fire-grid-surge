'use strict';
// v012 #72 双货币系统：局内金币(RunStats.gold) 与 幸存者硬币(Meta.data.survivorCoins) 完全分离。
const assert = require('node:assert/strict');
const { createRuntime } = require('../helpers/runtime-harness.cjs');

for (const mode of ['h5', 'wx']) {
  const r = createRuntime(mode); r.finishImages();
  const g = r.game, C = g.CONFIG;

  // 0) 炮塔激活花费进 CONFIG，且为正数。
  assert.equal(typeof C.TURRETS.ACTIVATE_COST, 'number');
  assert(C.TURRETS.ACTIVATE_COST > 0, 'TURRETS.ACTIVATE_COST 必须为正数');

  g.Game.restart();

  // 1) 开局局内金币清零；pickup 拾取只累加到 gold（与 pickedCoins 平行），不动持久货币。
  assert.equal(g.RunStats.gold, 0, '开局局内金币必须为 0');
  assert.equal(g.Meta.data.survivorCoins, 0, '新存档幸存者硬币为 0');
  g.CoinDrops.drop(g.Player.x, g.Player.y, 10);
  g.CoinDrops.update(0.1);
  assert.equal(g.RunStats.gold, 10, '拾取金币应累加到局内 gold');
  assert.equal(g.RunStats.pickedCoins, 10, 'pickedCoins 同步累加');
  assert.equal(g.Meta.data.survivorCoins, 0, '拾取金币绝不进持久货币');

  // 2) spendGold：余额足够才扣并返回 true，不足拒绝且不扣。
  assert.equal(g.RunStats.spendGold(4), true);
  assert.equal(g.RunStats.gold, 6);
  assert.equal(g.RunStats.spendGold(100), false);
  assert.equal(g.RunStats.gold, 6, '余额不足不得扣费');

  // 3) 阵亡结算：#98 失败保护，非撤离退出给小额基础收益 floor(wave*2 + kills*0.05)。
  //    （旧 #72 "死亡=0 幸存者硬币" 断言已被 v014 失败保护取代：这里显式验证新公式。）
  g.Spawner.waveIndex = 5;
  g.RunStats.kills = 100;
  const survBefore = g.Meta.data.survivorCoins;
  g.Game.exitType = 'death';
  g.RunStats.extractBonus = false;
  g.Game.commitSettlement(false);
  const expectedFail = Math.floor(5 * C.FAIL_REWARD.WAVE + 100 * C.FAIL_REWARD.KILL);
  assert.equal(g.Meta.data.survivorCoins, survBefore + expectedFail, '阵亡应得失败基础收益 floor(wave*2+kills*0.05)');
  assert.equal(g.RunStats.gold, 6, '阵亡结算不得改动局内 gold');

  // 4) 重开：局内金币清零，绝不继承到下一局；幸存者硬币保留跨局累积。
  g.Game.restart();
  assert.equal(g.RunStats.gold, 0, '重开局内金币必须清零');
  assert.equal(g.Meta.data.survivorCoins, survBefore + expectedFail, '重开不清空幸存者硬币');

  // 5) 撤离结算：幸存者硬币按本次撤离收益入账（公式 #73 细化，本次走现有 extract 分支）。
  g.RunStats.kills = 0;
  g.ExpLevelUp.level = 1;
  g.Game.survivedSeconds = 0;
  g.RunStats.pickedCoins = 10;
  g.RunStats.extractBonus = true;
  g.Game.exitType = 'extract';
  const survBeforeExtract = g.Meta.data.survivorCoins;
  g.Game.commitSettlement(false);
  assert(g.Meta.data.survivorCoins > survBeforeExtract, '撤离必须获得幸存者硬币');
  assert.equal(
    g.Meta.data.survivorCoins,
    survBeforeExtract + g.RunStats.finalCoins,
    '撤离入账额应等于本次撤离收益 finalCoins'
  );

  // 6) 基地升级花的是幸存者硬币：canBuy/buy 走 survivorCoins。
  g.Meta.data.survivorCoins = 1000;
  const def = C.META.UPGRADES[0];
  const price = g.Meta.getPrice(def);
  const beforeLv = g.Meta.getUpgradeLevel(def.ID);
  assert(g.Meta.canBuy(def), '余额足够应可购买');
  assert.equal(g.Meta.buy(def), true);
  assert.equal(g.Meta.data.survivorCoins, 1000 - price, '基地升级应扣幸存者硬币');
  assert.equal(g.Meta.getUpgradeLevel(def.ID), beforeLv + 1);

  console.log('PASS: ' + mode + ' 局内金币/幸存者硬币分离、炮塔花费、撤离入账、阵亡零发、重开清零');
}

'use strict';
// v013 #81/#82/#84：金币经验分离 + 磁铁吸附三类掉落 + 第五档稀有度 RAINBOW。
const assert = require('node:assert/strict');
const { createRuntime } = require('../helpers/runtime-harness.cjs');

function countActive(pool) {
  let n = 0;
  for (const it of pool) if (it.active) n++;
  return n;
}

for (const mode of ['h5', 'wx']) {
  const r = createRuntime(mode); r.finishImages();
  const g = r.game, C = g.CONFIG;
  g.Game.restart();

  // ---------- #81 拾取分离 ----------
  g.RunStats.gold = 0;
  g.ExpLevelUp.exp = 0;
  g.CoinDrops.reset(); g.Experience.reset();
  g.CoinDrops.drop(g.Player.x, g.Player.y, 7);
  g.CoinDrops.update(0.1);
  assert.equal(g.RunStats.gold, 7, mode + ' 金币拾取只加 gold');
  assert.equal(g.ExpLevelUp.exp, 0, mode + ' 金币拾取不得加经验');
  g.Experience.dropGem(g.Player.x, g.Player.y, 3);
  g.Experience.update(0.1);
  assert.equal(g.ExpLevelUp.exp, 3, mode + ' 蓝经验拾取只加经验');
  assert.equal(g.RunStats.gold, 7, mode + ' 蓝经验拾取不得加 gold');

  // ---------- #81 击杀掉落规则 ----------
  const KD = C.KILL_DROPS;
  assert(KD, '缺少 CONFIG.KILL_DROPS');
  const savedChance = KD.GOLD_NORMAL_CHANCE;

  // 普通敌人：掉率置 1 → 必掉金币；经验必掉 1
  KD.GOLD_NORMAL_CHANCE = 1;
  const walkerA = g.Enemy.spawn(1200, 1200, C.ENEMY.TYPE_WALKER, 1);
  g.CoinDrops.reset(); g.Experience.reset();
  g.Enemy.kill(walkerA);
  assert.equal(countActive(g.Experience.pool), KD.EXP_NORMAL_COUNT, mode + ' 普通敌人掉 1 蓝经验');
  assert.equal(countActive(g.CoinDrops.pool), KD.GOLD_NORMAL_COUNT, mode + ' 普通敌人掉率=1 时必掉 1 金币');

  // 普通敌人：掉率置 0 → 不掉金币，经验仍必掉
  KD.GOLD_NORMAL_CHANCE = 0;
  const walkerB = g.Enemy.spawn(1200, 1200, C.ENEMY.TYPE_WALKER, 1);
  g.CoinDrops.reset(); g.Experience.reset();
  g.Enemy.kill(walkerB);
  assert.equal(countActive(g.Experience.pool), KD.EXP_NORMAL_COUNT, mode + ' 普通敌人经验与掉币无关');
  assert.equal(countActive(g.CoinDrops.pool), 0, mode + ' 普通敌人掉率=0 不掉金币');
  KD.GOLD_NORMAL_CHANCE = savedChance;

  // 精英：经验 5，金币 5（必掉）
  const elite = g.Enemy.spawn(1200, 1200, C.ENEMY.TYPE_ELITE, 1);
  g.CoinDrops.reset(); g.Experience.reset();
  g.Enemy.kill(elite);
  assert.equal(countActive(g.Experience.pool), KD.EXP_ELITE_COUNT, mode + ' 精英掉 5 蓝经验');
  assert.equal(countActive(g.CoinDrops.pool), KD.GOLD_ELITE_COUNT, mode + ' 精英必掉 5 金币');

  // 近战 BOSS：经验 20，金币 100
  const boss = g.Enemy.spawn(1200, 1200, C.ENEMY.TYPE_BOSS, 1);
  g.CoinDrops.reset(); g.Experience.reset();
  g.Enemy.kill(boss);
  assert.equal(countActive(g.Experience.pool), KD.EXP_BOSS_COUNT, mode + ' BOSS 掉 20 蓝经验');
  assert.equal(countActive(g.CoinDrops.pool), KD.GOLD_BOSS_COUNT, mode + ' BOSS 必掉 100 金币');

  // 特殊远程 Boss：经验 20，金币 5
  const ranged = g.Enemy.spawn(1200, 1200, C.ENEMY.TYPE_BOSS_RANGED, 1);
  g.CoinDrops.reset(); g.Experience.reset();
  g.Enemy.kill(ranged);
  assert.equal(countActive(g.Experience.pool), KD.EXP_SPECIAL_COUNT, mode + ' 特殊 Boss 掉 20 蓝经验');
  assert.equal(countActive(g.CoinDrops.pool), KD.GOLD_SPECIAL_COUNT, mode + ' 特殊 Boss 掉 5 金币');

  // ---------- #82 磁铁吸附三类掉落 ----------
  g.CoinDrops.reset(); g.Experience.reset(); g.PowerUps.reset();
  const farX = g.Player.x + 600, farY = g.Player.y + 600;
  g.CoinDrops.drop(farX, farY, 1);
  g.Experience.dropGem(farX, farY, 1);
  g.PowerUps.drop(farX, farY, C.POWERUPS.TYPE_MEDKIT);
  g.PowerUps.magnetTimer = 0;
  for (let i = 0; i < 5; i++) { g.CoinDrops.update(1 / 60); g.Experience.update(1 / 60); g.PowerUps.update(1 / 60); }
  assert(countActive(g.CoinDrops.pool) > 0 && countActive(g.Experience.pool) > 0 && countActive(g.PowerUps.pool) > 0, mode + ' 未开磁铁时远处掉落物应保持不动');
  g.PowerUps.magnetTimer = C.POWERUPS.MAGNET_DURATION;
  for (let i = 0; i < 120; i++) { g.CoinDrops.update(1 / 60); g.Experience.update(1 / 60); g.PowerUps.update(1 / 60); }
  assert.equal(countActive(g.CoinDrops.pool), 0, mode + ' 磁铁吸附金币');
  assert.equal(countActive(g.Experience.pool), 0, mode + ' 磁铁吸附蓝经验');
  assert.equal(countActive(g.PowerUps.pool), 0, mode + ' 磁铁吸附世界掉落道具（血包）');

  // ---------- #84 第五档稀有度 ----------
  const rarities = C.UPGRADES.RARITIES;
  assert.equal(rarities.length, 5, mode + ' RARITIES 必须为 5 档');
  assert.equal(rarities[4].ID, 'RAINBOW', mode + ' 第五档必须是 RAINBOW');
  assert.equal(rarities[3].ID, 'LEGENDARY', mode + ' 第四档仍是 LEGENDARY(金)');
  for (let i = 0; i < 2000; i++) {
    const id = g.ExpLevelUp.rollRarity().ID;
    assert(['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'RAINBOW'].indexOf(id) >= 0, mode + ' rollRarity 只应返回 5 档之一: ' + id);
  }
  let fateSawRainbow = false;
  for (let i = 0; i < 100000; i++) if (g.FateCards.rollRarity() === 'RAINBOW') fateSawRainbow = true;
  assert(fateSawRainbow, mode + ' 命运抽牌应能抽出第五档 RAINBOW');
  g.FateCards.cards = [{ def: g.FateCards.defs[76], open: true, t: 0.3, rainbow: true }];
  g.FateCards.drawCard(r.ctx, 0);

  console.log('PASS: ' + mode + ' #81 金币/经验分离、#82 磁铁三类吸附、#84 RAINBOW 五档全部通过');
}

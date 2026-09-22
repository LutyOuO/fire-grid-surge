'use strict';
// v014 #96/#97/#98：反馈分级触发 / 失败基础收益公式 / 撤离界面左右对比数值。
const assert = require('node:assert/strict');
const { createRuntime } = require('../helpers/runtime-harness.cjs');

for (const mode of ['h5', 'wx']) {
  const r = createRuntime(mode); r.finishImages();
  const g = r.game, C = g.CONFIG;
  g.Game.restart();

  // ---- #96 反馈分级数值进 CONFIG，且 BOSS > 精英 > 普通 ----
  assert(C.FEEDBACK, 'CONFIG.FEEDBACK 必须存在');
  assert(C.FEEDBACK.BOSS_KILL_PARTICLES > C.FEEDBACK.ELITE_KILL_PARTICLES, 'BOSS 粒子应多于精英');
  assert(C.FEEDBACK.ELITE_KILL_PARTICLES > C.FEEDBACK.NORMAL_HIT_PARTICLES, '精英粒子应多于普通命中');
  assert(C.FEEDBACK.BOSS_SLOMO_SCALE < 1 && C.FEEDBACK.BOSS_SLOMO_TIME > 0, 'BOSS 慢动效应小于 1 且时长为正');
  assert.equal(C.FAIL_REWARD.WAVE, 2, '失败收益波次系数应为 2');
  assert(Math.abs(C.FAIL_REWARD.KILL - 0.05) < 1e-9, '失败收益击杀系数应为 0.05');

  // ---- #96 分级触发：普通击杀不慢动作；精英击杀震屏；BOSS 击杀震屏+慢动作 ----
  g.Camera.shakeTimer = 0; g.Game.slowMoTimer = 0;
  var normal = g.Enemy.spawn(500, 500, C.ENEMY.TYPE_WALKER, 1);
  g.Enemy.kill(normal);
  assert.equal(g.Game.slowMoTimer, 0, '普通击杀不应触发慢动作');

  var elite = g.Enemy.spawn(500, 500, C.ENEMY.TYPE_ELITE, 1);
  g.Enemy.kill(elite);
  assert(g.Camera.shakeTimer > 0, '精英击杀应震屏');

  g.Camera.shakeTimer = 0;
  var boss = g.Enemy.spawn(500, 500, C.ENEMY.TYPE_BOSS, 1);
  g.Enemy.kill(boss);
  assert(g.Game.slowMoTimer > 0, 'BOSS 击杀应触发慢动作');
  assert(g.Camera.shakeTimer > 0, 'BOSS 击杀应震屏');
  assert(g.Game.slowMoScale === C.FEEDBACK.BOSS_SLOMO_SCALE, '慢动作倍率应取 CONFIG.FEEDBACK');

  // ---- #98 失败基础收益 = floor(wave*2 + kills*0.05)；重复结算不重复发 ----
  g.Game.restart();
  g.Spawner.waveIndex = 6;
  g.RunStats.kills = 120;
  g.Game.exitType = 'death';
  g.RunStats.extractBonus = false;
  const before = g.Meta.data.survivorCoins;
  g.Game.commitSettlement(false);
  const expFail = Math.floor(6 * C.FAIL_REWARD.WAVE + 120 * C.FAIL_REWARD.KILL); // 12 + 6 = 18
  assert.equal(g.Meta.data.survivorCoins, before + expFail, '死亡应得失败基础收益 floor(wave*2+kills*0.05)');
  g.Game.commitSettlement(false);
  assert.equal(g.Meta.data.survivorCoins, before + expFail, '重复结算(翻倍/复活)不得重复发基础收益');

  // ---- #98 撤离全额公式不变（对照：extract 仍按 #73 公式全额入账）----
  g.Game.restart();
  g.RunStats.killNormal = 5; g.RunStats.killElite = 1; g.RunStats.killBoss = 0; g.RunStats.killSpecial = 0;
  g.Spawner.waveIndex = 5; g.ExpLevelUp.level = 2; g.RunStats.gold = 50;
  g.RunStats.extractBonus = true;
  g.Game.exitType = 'extract';
  const survBeforeExtract = g.Meta.data.survivorCoins;
  g.Game.commitSettlement(false);
  assert(g.Meta.data.survivorCoins > survBeforeExtract, '撤离仍应按 #73 公式全额入账');

  // ---- #97 撤离界面左右对比数值（现在撤离 vs 下一波预计）----
  g.RunStats.killNormal = 5; g.RunStats.killElite = 1;
  g.Spawner.waveIndex = 5; g.ExpLevelUp.level = 2; g.RunStats.gold = 50;
  const nowVal = g.RunStats.extractionPreview();
  const nextVal = g.RunStats.extractContinueEstimate();
  assert(nextVal >= nowVal, '下一波预计不应低于现在撤离');
  assert.equal(typeof C.TEXT.PRODUCT.EXTRACT_NOW(nowVal), 'string', '左文案存在');
  assert.equal(typeof C.TEXT.PRODUCT.CONTINUE_NEXT(nextVal), 'string', '右文案存在');

  console.log('PASS: ' + mode + ' #96 反馈分级触发 / #98 失败基础收益=wave*2+kills*0.05 / #97 撤离左右对比');
}

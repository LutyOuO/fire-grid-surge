'use strict';
// v014 #88/#89 专项：
//  #88 撤离结算幸存者硬币分项构成（分项之和 == 总额 == extractionPreview）；
//  #89 局外养成价倍率层（角色属性/道具 ×3，服装/涂装 survivorCoins 价 ×2，钻石价不动）。
const assert = require('node:assert/strict');
const { createRuntime } = require('../helpers/runtime-harness.cjs');

for (const mode of ['h5', 'wx']) {
  const r = createRuntime(mode); r.finishImages();
  const g = r.game, C = g.CONFIG;

  // ---------- #89 倍率层存在且生效 ----------
  assert(C.META.PRICE_MULT, '必须存在 CONFIG.META.PRICE_MULT');
  assert.equal(C.META.PRICE_MULT.ATTRIBUTE, 3, '角色属性升级 ×3');
  assert.equal(C.META.PRICE_MULT.GADGET, 3, '道具解锁升级 ×3');
  assert.equal(C.META.PRICE_MULT.COSMETIC, 2, '服装/涂装 ×2');

  // 角色属性：UPGRADES[0]（ROBUST BASE=60，等级 0）→ round(60*1^1.4*3)=180，即旧价 60 的 3 倍。
  const def = C.META.UPGRADES[0];
  const oldAttr = Math.round(def.BASE * Math.pow(0 + 1, C.META.PRICE_POWER));
  assert.equal(g.Meta.getPrice(def), oldAttr * C.META.PRICE_MULT.ATTRIBUTE, '角色属性价应为旧价 ×3');
  assert.equal(g.Meta.getPrice(def), 180, 'ROBUST 0 级价应为 180');

  // 道具：laser.speed（BASE=80，等级 0）→ 240，即旧价 80 的 3 倍。
  const oldGadget = Math.round(80 * Math.pow(0 + 1, C.META.PRICE_POWER));
  assert.equal(g.Meta.getGadgetPrice('laser', 'speed'), oldGadget * C.META.PRICE_MULT.GADGET, '道具价应为旧价 ×3');
  assert.equal(g.Meta.getGadgetPrice('laser', 'speed'), 240, 'laser.speed 0 级价应为 240');

  // ---------- #89 服装/涂装 survivorCoins 价 ×2，钻石价不动 ----------
  const cowboy = g.Wardrobe.outfits.find(o => o[0] === 'cowboy');
  assert(cowboy, '应存在 cowboy 服装');
  assert.equal(cowboy[3], 'survivorCoins', 'cowboy 应为幸存者硬币价');
  assert.equal(cowboy[4], 1600, 'cowboy 800 → ×2 = 1600');
  const pulseSilver = g.Wardrobe.skins.find(s => s[0] === 'pulse_silver');
  assert.equal(pulseSilver[4], 4000, 'pulse_silver 2000 → ×2 = 4000');
  const hunter = g.Wardrobe.outfits.find(o => o[0] === 'hunter');
  assert.equal(hunter[3], 'diamonds', 'hunter 应为钻石价');
  assert.equal(hunter[4], 80, '钻石价不参与 ×2，保持 80');

  // ---------- #88 结算分项构成：分项之和 == 总额 == extractionPreview ----------
  g.Game.restart();
  g.Spawner.waveIndex = 6;
  g.ExpLevelUp.level = 2;
  g.RunStats.gold = 100;
  g.RunStats.killNormal = 3;
  g.RunStats.killElite = 1;
  g.RunStats.killBoss = 1;
  g.RunStats.killSpecial = 1;
  const expectedPreview = g.RunStats.extractionPreview(); // floor(...) = 121
  assert.equal(expectedPreview, 121, '基准公式值应为 121');

  const bd = g.UI.extractCoinBreakdown();
  assert.equal(bd.total, expectedPreview, '分项总额应等于 extractionPreview');
  let sum = 0;
  for (const row of bd.rows) sum += row.amount;
  assert.equal(sum, bd.total, '各分项 amount 之和必须严格等于总额');
  assert.equal(bd.rows.length, 7, '分项应为 7 项（波次/普通/精英/BOSS/特殊/等级/剩余金币）');

  // 直接绘制撤离结算分项（图片未就绪走矢量兜底；finishImages 后图标已解码）。
  g.RunStats.extractBonus = true;
  g.RunStats.extractAdClaimed = false;
  g.RunStats.finalCoins = bd.total;
  g.UI.drawExtractBreakdown(r.ctx, 0);
  r.draw();

  console.log('PASS: ' + mode + ' v014 #88/#89 结算分项合计=总额、属性/道具×3、服装×2 钻石不动');
}

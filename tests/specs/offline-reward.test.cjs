'use strict';
// v013 #83 挂机奖励削弱：离线幸存者硬币固定约 0.5/分钟（挂机 1 小时 ≈ 30 硬币）。
// - 不再随最佳波次(waveMultiplier)/贪婪倍率(greedMultiplier)膨胀；
// - claimOffline 只入账 survivorCoins（v012 已改名），不写回旧 coins 字段；
// - OFFLINE_MAX_HOURS 上限保持不变。
const assert = require('node:assert/strict');
const { createRuntime } = require('../helpers/runtime-harness.cjs');

const r = createRuntime('h5');
const g = r.game;
const C = g.CONFIG;
const Meta = g.Meta;

// 0) 数值进 CONFIG：基础值约 0.5/分钟，时长上限仍为 12 小时。
assert.equal(C.META.OFFLINE_BASE_PER_MINUTE, 0.5, 'OFFLINE_BASE_PER_MINUTE 应为 0.5/分钟');
assert.equal(C.META.OFFLINE_MAX_HOURS, 12, 'OFFLINE_MAX_HOURS 保持 12 小时不变');

// 1) getOfflineRate 为固定值，且不随波次/贪婪膨胀。
Meta.data.bestWave = 100;
Meta.data.upg['GREED'] = 10;
assert.equal(Meta.getOfflineRate(), C.META.OFFLINE_BASE_PER_MINUTE, '离线费率应固定为 OFFLINE_BASE_PER_MINUTE');
assert.equal(Meta.getOfflineRate(), 0.5, '离线费率应为 0.5/分钟');

// 2) 挂机 60 分钟 → pendingOfflineCoins <= 30（0.5 × 60 = 30，向下取整）。
Meta.pendingOfflineCoins = 0;
Meta.pendingOfflineMinutes = 0;
const now = Date.now();
Meta.data.lastOfflineTs = now - 60 * 60 * 1000; // 离线 1 小时前
Meta.calculateOfflineReward(now);
assert.equal(Meta.pendingOfflineMinutes, 60, '应计入 60 个离线分钟');
assert.equal(Meta.pendingOfflineCoins, 30, '挂机 60 分钟应得 30 幸存者硬币');
assert(Meta.pendingOfflineCoins <= 30, '挂机 60 分钟幸存者硬币不得超过 30');

// 3) claimOffline 入账 survivorCoins，且不写回旧 coins 字段。
const survBefore = Meta.data.survivorCoins;
assert.equal(Meta.data.coins, undefined, '旧 coins 字段不应存在');
Meta.offlinePopupActive = true;
Meta.claimOffline(false);
assert.equal(Meta.data.survivorCoins, survBefore + 30, 'claimOffline 应把 30 硬币入账 survivorCoins');
assert.equal(Meta.data.coins, undefined, 'claimOffline 不得写回旧 coins 字段');
assert.equal(Meta.pendingOfflineCoins, 0, '领取后待入账硬币清零');

console.log('PASS: v013 #83 挂机奖励削弱（0.5/分钟、60分钟=30硬币、不随波次/贪婪膨胀、入账 survivorCoins）');

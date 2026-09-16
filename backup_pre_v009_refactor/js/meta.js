'use strict';
// ============================================================
// Meta（局外养成与存档）+ Settings（设置）
// 存储已通过 Platform.getStorage/setStorage 统一，
// 微信下走 wx.getStorageSync/setStorageSync，H5 下走 localStorage
// ============================================================
var root = (typeof window !== 'undefined') ? window : global;
var CONFIG = root.CONFIG;
var Platform = root.Platform;

var Meta = {
  data: null,
  pendingOfflineCoins: 0,
  pendingOfflineMinutes: 0,
  offlinePopupActive: false,
  toastText: '',
  toastTimer: 0,

  createDefaultData: function () {
    var upgrades = {};
    for (var i = 0; i < CONFIG.META.UPGRADES.length; i++) {
      upgrades[CONFIG.META.UPGRADES[i].ID] = 0;
    }
    upgrades.gadget = this.createDefaultGadget();
    return {
      version: CONFIG.SAVE.VERSION,
      coins: 0,
      upg: upgrades,
      bestWave: 0,
      bestTime: 0,
      bestKills: 0,
      lastOfflineTs: Date.now(),
      speedupCdTs: 0,
      settings: { sound: true, shake: true, debug: false, dashDoubleTap: false, alwaysShowJoystick: false },
      pendingOfflineCoins: 0,
      pendingOfflineMinutes: 0,
      nextRunBuff: null,
      // v005：高级货币、外观与永久成就（旧存档缺失时自动补默认值）
      diamonds: 0,
      ownedOutfits: ['default'],
      currentOutfit: 'default',
      ownedSkins: { pulse: ['default'], blade: ['default'], flame: ['default'], crossbow: ['default'] },
      equippedSkins: { pulse: 'default', blade: 'default', flame: 'default', crossbow: 'default' },
      achievements: { completed: [], progress: {} }
    };
  },

  createDefaultGadget: function () {
    var gadget = {};
    for (var gadgetId in CONFIG.META.GADGET_UPGRADES) {
      var items = CONFIG.META.GADGET_UPGRADES[gadgetId].items;
      gadget[gadgetId] = {};
      for (var i = 0; i < items.length; i++) gadget[gadgetId][items[i].ID] = 0;
    }
    return gadget;
  },

  load: function () {
    this.data = this.createDefaultData();
    var now = Date.now();
    try {
      var raw = Platform.getStorage(CONFIG.SAVE.KEY);
      if (raw) {
        var saved = (typeof raw === 'string') ? JSON.parse(raw) : raw;
        this.mergeSafeData(saved);
      }
    } catch (error) {
      this.data = this.createDefaultData();
    }
    this.calculateOfflineReward(now);
    this.data.lastOfflineTs = Math.max(this.data.lastOfflineTs, now);
    this.save(false);
  },

  mergeSafeData: function (saved) {
    if (!saved || typeof saved !== 'object') return;
    this.data.coins = this.safeInt(saved.coins, 0);
    this.data.diamonds = this.safeInt(saved.diamonds, 0);
    this.data.bestWave = this.safeInt(saved.bestWave, 0);
    this.data.bestTime = this.safeNumber(saved.bestTime, 0);
    this.data.bestKills = this.safeInt(saved.bestKills, 0);
    this.pendingOfflineCoins = this.safeInt(saved.pendingOfflineCoins, 0);
    this.pendingOfflineMinutes = Math.min(
      CONFIG.META.OFFLINE_MAX_HOURS * 60,
      this.safeInt(saved.pendingOfflineMinutes, 0));
    this.data.lastOfflineTs = this.safeTimestamp(saved.lastOfflineTs, Date.now());
    this.data.speedupCdTs = Math.min(
      this.safeTimestamp(saved.speedupCdTs, 0),
      Date.now() + CONFIG.META.SPEEDUP_COOLDOWN_MS);
    // 命运牌只信任固定牌库中的 cardId，效果参数从牌库重建，防止损坏存档制造超大循环。
    if (saved.nextRunBuff && typeof saved.nextRunBuff === 'object' && root.FateCards) {
      var safeCardId = this.safeInt(saved.nextRunBuff.cardId, 0);
      for (var cardIndex = 0; cardIndex < root.FateCards.defs.length; cardIndex++) {
        var card = root.FateCards.defs[cardIndex];
        if (card[0] !== safeCardId) continue;
        this.data.nextRunBuff = {
          cardId: card[0], rarity: card[3], effectType: card[4],
          effectValue: card[5], name: card[1]
        };
        break;
      }
    }
    if (saved.settings && typeof saved.settings === 'object') {
      for (var k in saved.settings) {
        if (typeof saved.settings[k] === 'boolean') {
          this.data.settings[k] = saved.settings[k];
        }
      }
    }
    if (Array.isArray(saved.ownedOutfits)) this.data.ownedOutfits = saved.ownedOutfits.filter(function(v){return typeof v==='string';});
    if (this.data.ownedOutfits.indexOf('default')<0) this.data.ownedOutfits.unshift('default');
    if (typeof saved.currentOutfit==='string'&&this.data.ownedOutfits.indexOf(saved.currentOutfit)>=0)this.data.currentOutfit=saved.currentOutfit;
    var weaponIds=['pulse','blade','flame','crossbow'];
    for(var wi=0;wi<weaponIds.length;wi++){var wid=weaponIds[wi],list=saved.ownedSkins&&saved.ownedSkins[wid];if(Array.isArray(list))this.data.ownedSkins[wid]=list.filter(function(v){return typeof v==='string';});if(this.data.ownedSkins[wid].indexOf('default')<0)this.data.ownedSkins[wid].unshift('default');var eq=saved.equippedSkins&&saved.equippedSkins[wid];if(typeof eq==='string'&&this.data.ownedSkins[wid].indexOf(eq)>=0)this.data.equippedSkins[wid]=eq;}
    if(saved.achievements&&typeof saved.achievements==='object'){
      if(Array.isArray(saved.achievements.completed))this.data.achievements.completed=saved.achievements.completed.filter(function(v){return typeof v==='string';});
      var ap=saved.achievements.progress;if(ap&&typeof ap==='object')for(var ak in ap)this.data.achievements.progress[ak]=this.safeNumber(ap[ak],0);
    }
    var savedUpgrades = saved.upg && typeof saved.upg === 'object' ? saved.upg : {};
    for (var i = 0; i < CONFIG.META.UPGRADES.length; i++) {
      var definition = CONFIG.META.UPGRADES[i];
      this.data.upg[definition.ID] = Math.min(
        definition.MAX_LEVEL, this.safeInt(savedUpgrades[definition.ID], 0));
    }
    // 道具升级（upg.gadget{}）安全合并，缺失项默认 0
    this.data.upg.gadget = this.createDefaultGadget();
    var savedGadget = savedUpgrades.gadget && typeof savedUpgrades.gadget === 'object'
      ? savedUpgrades.gadget : {};
    for (var gadgetId in CONFIG.META.GADGET_UPGRADES) {
      var items = CONFIG.META.GADGET_UPGRADES[gadgetId].items;
      var savedG = savedGadget[gadgetId] && typeof savedGadget[gadgetId] === 'object'
        ? savedGadget[gadgetId] : {};
      for (var j = 0; j < items.length; j++) {
        var def = items[j];
        this.data.upg.gadget[gadgetId][def.ID] = Math.min(
          def.MAX_LEVEL, this.safeInt(savedG[def.ID], 0));
      }
    }
  },

  safeNumber: function (value, fallback) {
    return Number.isFinite(value) ? Math.max(0, value) : fallback;
  },
  safeInt: function (value, fallback) {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
  },
  safeTimestamp: function (value, fallback) {
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  },

  getUpgradeLevel: function (id) {
    if (!this.data || !this.data.upg) return 0;
    return this.safeInt(this.data.upg[id], 0);
  },

  getEffectTotal: function (effect) {
    if (!this.data) return 0;
    var total = 0;
    for (var i = 0; i < CONFIG.META.UPGRADES.length; i++) {
      var definition = CONFIG.META.UPGRADES[i];
      if (definition.EFFECT === effect) {
        total += this.getUpgradeLevel(definition.ID) * definition.AMOUNT;
      }
    }
    return total;
  },

  getPrice: function (definition) {
    var level = this.getUpgradeLevel(definition.ID);
    return Math.round(definition.BASE * Math.pow(level + 1, CONFIG.META.PRICE_POWER));
  },

  canBuy: function (definition) {
    var level = this.getUpgradeLevel(definition.ID);
    return level < definition.MAX_LEVEL && this.data.coins >= this.getPrice(definition);
  },

  buy: function (definition) {
    if (!this.canBuy(definition)) return false;
    var price = this.getPrice(definition);
    this.data.coins -= price;
    this.data.upg[definition.ID] += 1;
    this.save();
    return true;
  },

  // ---------- 道具强化（gadget） ----------
  getGadgetDef: function (gadgetId, itemId) {
    var group = CONFIG.META.GADGET_UPGRADES[gadgetId];
    if (!group) return null;
    for (var i = 0; i < group.items.length; i++) {
      if (group.items[i].ID === itemId) return group.items[i];
    }
    return null;
  },

  getGadgetLevel: function (gadgetId, itemId) {
    if (!this.data || !this.data.upg || !this.data.upg.gadget) return 0;
    var g = this.data.upg.gadget[gadgetId];
    if (!g) return 0;
    return this.safeInt(g[itemId], 0);
  },

  getGadgetPrice: function (gadgetId, itemId) {
    var def = this.getGadgetDef(gadgetId, itemId);
    if (!def) return 0;
    var level = this.getGadgetLevel(gadgetId, itemId);
    return Math.round(def.BASE * Math.pow(level + 1, CONFIG.META.PRICE_POWER));
  },

  canBuyGadget: function (gadgetId, itemId) {
    var def = this.getGadgetDef(gadgetId, itemId);
    if (!def) return false;
    var level = this.getGadgetLevel(gadgetId, itemId);
    return level < def.MAX_LEVEL && this.data.coins >= this.getGadgetPrice(gadgetId, itemId);
  },

  buyGadget: function (gadgetId, itemId) {
    if (!this.canBuyGadget(gadgetId, itemId)) return false;
    var price = this.getGadgetPrice(gadgetId, itemId);
    this.data.coins -= price;
    this.data.upg.gadget[gadgetId][itemId] += 1;
    this.save();
    return true;
  },

  settleRun: function (seconds, kills, wave, coins) {
    this.data.coins += Math.max(0, Math.floor(coins));
    this.data.bestTime = Math.max(this.data.bestTime, seconds);
    this.data.bestKills = Math.max(this.data.bestKills, kills);
    this.data.bestWave = Math.max(this.data.bestWave, wave);
    this.save();
  },

  getOfflineRate: function () {
    var waveMultiplier = 1 + this.data.bestWave / 10;
    var greedMultiplier = 1 + this.getUpgradeLevel('GREED') * CONFIG.META.GREED_RATE_PER_LEVEL;
    return CONFIG.META.OFFLINE_BASE_PER_MINUTE * waveMultiplier * greedMultiplier;
  },

  calculateOfflineReward: function (now) {
    var elapsedMs = Math.max(0, now - this.data.lastOfflineTs);
    var maxMs = CONFIG.META.OFFLINE_MAX_HOURS * 60 * 60 * 1000;
    var creditedMs = Math.min(elapsedMs, maxMs);
    var newMinutes = Math.min(
      Math.floor(creditedMs / 60000),
      Math.max(0, CONFIG.META.OFFLINE_MAX_HOURS * 60 - this.pendingOfflineMinutes));
    this.pendingOfflineMinutes += newMinutes;
    this.pendingOfflineCoins += Math.floor(newMinutes * this.getOfflineRate());
    this.offlinePopupActive = this.pendingOfflineCoins > 0;
  },

  claimOffline: function (doubleReward) {
    if (!this.offlinePopupActive) return;
    var multiplier = doubleReward ? 2 : 1;
    var reward = this.pendingOfflineCoins * multiplier;
    this.data.coins += reward;
    this.pendingOfflineCoins = 0;
    this.pendingOfflineMinutes = 0;
    this.offlinePopupActive = false;
    this.showToast(CONFIG.TEXT.TOTAL_COINS(this.data.coins));
    this.save();
  },

  isSpeedupReady: function () { return Date.now() >= this.data.speedupCdTs; },
  getSpeedupReward: function () { return Math.floor(this.getOfflineRate() * CONFIG.META.SPEEDUP_MINUTES); },

  claimSpeedup: function () {
    if (!this.isSpeedupReady()) return false;
    var reward = this.getSpeedupReward();
    this.data.coins += reward;
    this.data.speedupCdTs = Date.now() + CONFIG.META.SPEEDUP_COOLDOWN_MS;
    this.showToast(CONFIG.TEXT.SPEEDUP_REWARD(CONFIG.META.SPEEDUP_MINUTES, reward));
    this.save();
    return true;
  },

  getSpeedupRemainingMs: function () { return Math.max(0, this.data.speedupCdTs - Date.now()); },

  markOfflineStart: function () {
    if (!this.data) return;
    this.data.lastOfflineTs = Math.max(this.data.lastOfflineTs, Date.now());
    this.save(false);
  },

  handleReturnOnline: function () {
    if (!this.data) return;
    var now = Date.now();
    this.calculateOfflineReward(now);
    this.data.lastOfflineTs = Math.max(this.data.lastOfflineTs, now);
    this.save(false);
  },

  showToast: function (text) {
    this.toastText = text;
    this.toastTimer = 2.5;
  },

  update: function (dt) {
    if (this.toastTimer > 0) {
      this.toastTimer = Math.max(0, this.toastTimer - dt);
    }
  },

  save: function (recordOfflineTime) {
    if (!this.data) return;
    if (recordOfflineTime !== false) {
      this.data.lastOfflineTs = Math.max(this.data.lastOfflineTs, Date.now());
    }
    this.data.pendingOfflineCoins = this.pendingOfflineCoins;
    this.data.pendingOfflineMinutes = this.pendingOfflineMinutes;
    if (root.Settings) {
      this.data.settings = {
        sound: root.Settings.sound,
        shake: root.Settings.shake,
        debug: root.Settings.debug,
        dashDoubleTap: !!root.Settings.dashDoubleTap,
        alwaysShowJoystick: !!root.Settings.alwaysShowJoystick
      };
    }
    try {
      Platform.setStorage(CONFIG.SAVE.KEY, JSON.stringify(this.data));
      if (root.Settings) root.Settings.storageFailed = false;
    } catch (error) {
      if (root.Settings) root.Settings.storageFailed = true;
    }
  }
};

// ---------- Settings（设置） ----------
var Settings = {
  sound: true, shake: true, debug: false, dashDoubleTap: false,
  alwaysShowJoystick: false, storageFailed: false,
  load: function () {
    try {
      var raw = Platform.getStorage(CONFIG.SAVE.KEY);
      var data = raw ? ((typeof raw === 'string') ? JSON.parse(raw) : raw) : {};
      var value = data && data.settings;
      if (value) {
        for (var key in { sound: 1, shake: 1, debug: 1, dashDoubleTap: 1, alwaysShowJoystick: 1 }) {
          if (typeof value[key] === 'boolean') this[key] = value[key];
        }
      }
    } catch (error) { /* Meta 会负责修复 */ }
  },
  toggle: function (key) {
    this[key] = !this[key];
    if (key === 'sound' && root.AudioFX) root.AudioFX.setEnabled();
    Meta.save();
  }
};

root.Meta = Meta;
root.Settings = Settings;

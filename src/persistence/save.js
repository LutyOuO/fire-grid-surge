(function () {
  'use strict';

  // ============================================================
  // save.js — 存档模块
  // 职责：Meta 永久存档读写/损坏自重置/养成数据；Settings 设置项
  // 主要对象：Meta(data/load/save/buy/buyGadget/settleRun/claimOffline/markOfflineStart/handleReturnOnline/getEffectTotal),
  //           Settings(load/save/sound)
  // 全局状态：经 Platform 持久化；Meta.data 为养成/货币/武器等级/外观主数据（供 player/item/menu 读取）
  // 依赖：core.js(root), platform.js(Platform 存储), config.js(CONFIG)
  // 加载顺序：core → input → save
  // ============================================================
  var root = typeof window !== 'undefined' ? window : global;
  var CONFIG = root.CONFIG;
  var Meta = {
    data: null,
    pendingOfflineCoins: 0,
    pendingOfflineMinutes: 0,
    offlinePopupActive: false,
    toastText: '',
    toastTimer: 0,
    perkBannerText: '',
    perkBannerTimer: 0,
    createDefaultData: function () {
      var upgrades = {};
      for (var i = 0; i < CONFIG.META.UPGRADES.length; i++) {
        upgrades[CONFIG.META.UPGRADES[i].ID] = 0;
      }
      upgrades.gadget = this.createDefaultGadget();
      return {
        version: CONFIG.SAVE.VERSION,
        tutorial: { enabled:true, done:false, step:0, gift:false, enemies:{}, items:{} },
        survivorCoins: 0,
        upg: upgrades,
        bestWave: 0,
        bestTime: 0,
        bestKills: 0,
        bestDamage: 0,
        totalKills: 0,
        totalElites: 0,
        totalBosses: 0,
        totalSurvivorCoins: 0,
        totalDiamonds: 0,
        extractCount: 0,
        recentRuns: [],
        weaponMastery: { total: 0, pistol: 0, smg: 0, ar: 0, mg: 0, flamer: 0, crossbow: 0 },
        lastOfflineTs: Date.now(),
        speedupCdTs: 0,
        settings: {
          sound: true,
          shake: true,
          debug: false,
          dashDoubleTap: false,
          alwaysShowJoystick: false,
          quality: CONFIG.RENDER_QUALITY.DEFAULT,
          highFps: false,
          mirror: false
        },
        pendingOfflineCoins: 0,
        pendingOfflineMinutes: 0,
        nextRunBuff: null,
        nextRunBuffs: [],
        weaponLevel: {
          pistol: {
            lv: 1,
            pts: 0
          },
          smg: { lv: 0, pts: 0 },
          ar: { lv: 0, pts: 0 },
          mg: { lv: 0, pts: 0 },
          flamer: {
            lv: 0,
            pts: 0
          },
          crossbow: {
            lv: 0,
            pts: 0
          }
        },
        selectedWeapon: "pistol",
        // 界面与内容：高级货币、外观与永久成就（旧存档缺失时自动补默认值）
        diamonds: 0,
        ownedOutfits: ['default'],
        currentOutfit: 'default',
        ownedSkins: {
          pulse: ['default'],
          smg: ['default'],
          ar: ['default'],
          mg: ['default'],
          blade: ['default'],
          flame: ['default'],
          crossbow: ['default']
        },
        equippedSkins: {
          pulse: 'default',
          smg: 'default',
          ar: 'default',
          mg: 'default',
          blade: 'default',
          flame: 'default',
          crossbow: 'default'
        },
        achievements: {
          completed: [],
          progress: {}
        },
        runs: 0,
        // v012 #75 选图系统：开局只解锁第 1 张；其余按 layout.unlock 条件解锁。
        // 老存档无这两个字段 → mergeSafeData 回退默认（只解锁 cross_ruin、选它），向后兼容。
        unlockedMaps: [0],
        selectedMap: 0,
        // v014 #92 核心词条首次获得横幅记录：每个核心词条 ID 记一次 true，只弹一次。
        perkBanners: {}
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
          var saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
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
      this.mergeRunBuffs(saved);
      // v012 #72 双货币：持久货币由 coins 改名为 survivorCoins；旧存档有 coins 且无 survivorCoins 时迁移过来，损坏数据回默认 0。
      this.data.survivorCoins = this.safeInt(saved.survivorCoins, this.safeInt(saved.coins, 0));
      this.data.diamonds = this.safeInt(saved.diamonds, 0);
      this.data.bestWave = this.safeInt(saved.bestWave, 0);
      this.data.bestTime = this.safeNumber(saved.bestTime, 0);
      this.data.bestKills = this.safeInt(saved.bestKills, 0);
      this.data.bestDamage = this.safeNumber(saved.bestDamage, 0);
      this.data.totalKills = this.safeInt(saved.totalKills, 0);
      this.data.totalElites = this.safeInt(saved.totalElites, 0);
      this.data.totalBosses = this.safeInt(saved.totalBosses, 0);
      this.data.totalSurvivorCoins = this.safeInt(saved.totalSurvivorCoins, 0);
      this.data.totalDiamonds = this.safeInt(saved.totalDiamonds, saved.achievements && saved.achievements.progress ? this.safeInt(saved.achievements.progress.diamondsTotal, 0) : 0);
      this.data.extractCount = this.safeInt(saved.extractCount, 0);
      if (Array.isArray(saved.recentRuns)) this.data.recentRuns = saved.recentRuns.slice(0, 30).filter(function (v) { return v && typeof v === 'object'; }).map(function (v) { return { date: typeof v.date === 'string' ? v.date : '', map: typeof v.map === 'string' ? v.map : '', wave: this.safeInt(v.wave, 0), kills: this.safeInt(v.kills, 0), damage: this.safeNumber(v.damage, 0), exit: v.exit === 'extract' ? 'extract' : 'death' }; }, this);
      var mastery = saved.weaponMastery && typeof saved.weaponMastery === 'object' ? saved.weaponMastery : {};
      for (var masteryId in this.data.weaponMastery) this.data.weaponMastery[masteryId] = this.safeInt(mastery[masteryId], 0);
      this.data.runs = this.safeInt(saved.runs, 0);
      var tutorial=saved.tutorial;
      if(tutorial && typeof tutorial==='object'){
        this.data.tutorial.enabled=tutorial.enabled!==false;
        this.data.tutorial.done=tutorial.done===true;
        this.data.tutorial.step=Math.min(CONFIG.TEXT.TUTORIAL.STEPS.length,this.safeInt(tutorial.step,0));
        this.data.tutorial.gift=tutorial.gift===true;
        for(var enemyId in CONFIG.TEXT.TUTORIAL.ENEMIES)if(tutorial.enemies&&tutorial.enemies[enemyId]===true)this.data.tutorial.enemies[enemyId]=true;
        for(var itemId in CONFIG.TEXT.TUTORIAL.ITEMS)if(tutorial.items&&tutorial.items[itemId]===true)this.data.tutorial.items[itemId]=true;
      } else if(this.data.runs>0){this.data.tutorial.enabled=false;this.data.tutorial.done=true;}
      // v012 #75 地图解锁进度：只信任 LAYOUTS 范围内的整数索引，永远保底解锁第 0 张。
      var maxMap = (CONFIG.FIELD.LAYOUTS || []).length - 1;
      var savedUnlocked = Array.isArray(saved.unlockedMaps) ? saved.unlockedMaps : [];
      var unlocked = [];
      for (var ui = 0; ui < savedUnlocked.length; ui++) {
        var mi = this.safeInt(savedUnlocked[ui], -1);
        if (mi >= 0 && mi <= maxMap && unlocked.indexOf(mi) < 0) unlocked.push(mi);
      }
      if (unlocked.indexOf(0) < 0) unlocked.unshift(0);
      this.data.unlockedMaps = unlocked;
      this.data.selectedMap = Math.max(0, Math.min(maxMap, this.safeInt(saved.selectedMap, 0)));
      // 读档即结算一次波次里程碑自动解锁（老玩家立刻补解锁 ring_street）。
      this.refreshMapUnlocks();
      this.pendingOfflineCoins = this.safeInt(saved.pendingOfflineCoins, 0);
      this.pendingOfflineMinutes = Math.min(CONFIG.META.OFFLINE_MAX_HOURS * 60, this.safeInt(saved.pendingOfflineMinutes, 0));
      this.data.lastOfflineTs = this.safeTimestamp(saved.lastOfflineTs, Date.now());
      this.data.speedupCdTs = Math.min(this.safeTimestamp(saved.speedupCdTs, 0), Date.now() + CONFIG.META.SPEEDUP_COOLDOWN_MS);
      // 命运牌只信任固定牌库中的 cardId，效果参数从牌库重建，防止损坏存档制造超大循环。
      if (saved.nextRunBuff && typeof saved.nextRunBuff === 'object' && root.FateCards) {
        var safeCardId = this.safeInt(saved.nextRunBuff.cardId, 0);
        for (var cardIndex = 0; cardIndex < root.FateCards.defs.length; cardIndex++) {
          var card = root.FateCards.defs[cardIndex];
          if (card[0] !== safeCardId) continue;
          this.data.nextRunBuff = {
            cardId: card[0],
            rarity: card[3],
            effectType: card[4],
            effectValue: card[5],
            name: card[1]
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
        if (/^(auto|high|medium|low)$/.test(saved.settings.quality || '')) this.data.settings.quality = saved.settings.quality;
      }
      if (Array.isArray(saved.ownedOutfits)) this.data.ownedOutfits = saved.ownedOutfits.filter(function (v) {
        return typeof v === 'string';
      });
      if (this.data.ownedOutfits.indexOf('default') < 0) this.data.ownedOutfits.unshift('default');
      if (typeof saved.currentOutfit === 'string' && CONFIG.CHARACTER.LEGACY_IDS.indexOf(saved.currentOutfit) >= 0 && this.data.ownedOutfits.indexOf(saved.currentOutfit) >= 0) this.data.currentOutfit = saved.currentOutfit;
      var weaponIds = ['pulse', 'blade', 'flame', 'crossbow', 'smg', 'ar', 'mg'];
      for (var wi = 0; wi < weaponIds.length; wi++) {
        var wid = weaponIds[wi],
          list = saved.ownedSkins && saved.ownedSkins[wid];
        if (Array.isArray(list)) this.data.ownedSkins[wid] = list.filter(function (v) {
          return typeof v === 'string';
        });
        if (this.data.ownedSkins[wid].indexOf('default') < 0) this.data.ownedSkins[wid].unshift('default');
        var eq = saved.equippedSkins && saved.equippedSkins[wid];
        if (typeof eq === 'string' && this.data.ownedSkins[wid].indexOf(eq) >= 0) this.data.equippedSkins[wid] = eq;
      }
      if (saved.achievements && typeof saved.achievements === 'object') {
        if (Array.isArray(saved.achievements.completed)) this.data.achievements.completed = saved.achievements.completed.filter(function (v) {
          return typeof v === 'string';
        });
        var ap = saved.achievements.progress;
        if (ap && typeof ap === 'object') for (var ak in ap) this.data.achievements.progress[ak] = this.safeNumber(ap[ak], 0);
      }
      // #92 核心词条横幅记录：只信任真值 ID，损坏数据回空对象（旧存档无此字段自动空）。
      var savedBanners = saved.perkBanners && typeof saved.perkBanners === 'object' ? saved.perkBanners : {};
      var banners = {};
      for (var bid in savedBanners) if (savedBanners[bid]) banners[bid] = true;
      this.data.perkBanners = banners;
      var savedUpgrades = saved.upg && typeof saved.upg === 'object' ? saved.upg : {};
      for (var i = 0; i < CONFIG.META.UPGRADES.length; i++) {
        var definition = CONFIG.META.UPGRADES[i];
        this.data.upg[definition.ID] = Math.min(definition.MAX_LEVEL, this.safeInt(savedUpgrades[definition.ID], 0));
      }
      // 道具升级（upg.gadget{}）安全合并，缺失项默认 0
      this.data.upg.gadget = this.createDefaultGadget();
      var savedGadget = savedUpgrades.gadget && typeof savedUpgrades.gadget === 'object' ? savedUpgrades.gadget : {};
      if (savedGadget.mortar && !savedGadget.turret_mortar) savedGadget.turret_mortar = savedGadget.mortar;
      for (var gadgetId in CONFIG.META.GADGET_UPGRADES) {
        var items = CONFIG.META.GADGET_UPGRADES[gadgetId].items;
        var savedG = savedGadget[gadgetId] && typeof savedGadget[gadgetId] === 'object' ? savedGadget[gadgetId] : {};
        for (var j = 0; j < items.length; j++) {
          var def = items[j];
          this.data.upg.gadget[gadgetId][def.ID] = Math.min(def.MAX_LEVEL, this.safeInt(savedG[def.ID], 0));
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
      // v014 #89 角色属性升级价 ×PRICE_MULT.ATTRIBUTE（默认 3）；升级数值不变，只涨价。
      var mult = (CONFIG.META.PRICE_MULT && CONFIG.META.PRICE_MULT.ATTRIBUTE) || 1;
      return Math.round(definition.BASE * Math.pow(level + 1, CONFIG.META.PRICE_POWER) * mult);
    },
    canBuy: function (definition) {
      var level = this.getUpgradeLevel(definition.ID);
      return level < definition.MAX_LEVEL && this.data.survivorCoins >= this.getPrice(definition);
    },
    buy: function (definition) {
      if (!this.canBuy(definition)) return false;
      var price = this.getPrice(definition);
      this.data.survivorCoins -= price;
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
    getGadgetAmount: function (gadgetId, itemId) {
      var def=this.getGadgetDef(gadgetId,itemId);
      return def?this.getGadgetLevel(gadgetId,itemId)*def.AMOUNT:0;
    },
    getGadgetPrice: function (gadgetId, itemId) {
      var def = this.getGadgetDef(gadgetId, itemId);
      if (!def) return 0;
      var level = this.getGadgetLevel(gadgetId, itemId);
      // v014 #89 道具解锁升级价 ×PRICE_MULT.GADGET（默认 3）；升级数值不变，只涨价。
      var mult = (CONFIG.META.PRICE_MULT && CONFIG.META.PRICE_MULT.GADGET) || 1;
      return Math.round(def.BASE * Math.pow(level + 1, CONFIG.META.PRICE_POWER) * mult);
    },
    canBuyGadget: function (gadgetId, itemId) {
      var def = this.getGadgetDef(gadgetId, itemId);
      if (!def) return false;
      var level = this.getGadgetLevel(gadgetId, itemId);
      return level < def.MAX_LEVEL && this.data.survivorCoins >= this.getGadgetPrice(gadgetId, itemId);
    },
    buyGadget: function (gadgetId, itemId) {
      if (!this.canBuyGadget(gadgetId, itemId)) return false;
      var price = this.getGadgetPrice(gadgetId, itemId);
      this.data.survivorCoins -= price;
      this.data.upg.gadget[gadgetId][itemId] += 1;
      this.save();
      return true;
    },
    // ---------- v012 #75 选图：解锁查询 / 波次里程碑自动解锁 / 幸存者硬币购买解锁 ----------
    mapDef: function (index) {
      var layouts = CONFIG.FIELD.LAYOUTS || [];
      return layouts[index] || null;
    },
    isMapUnlocked: function (index) {
      if (index === 0) return true;
      if (this.data.unlockedMaps.indexOf(index) >= 0) return true;
      return this.mapMilestoneMet(index);
    },
    mapMilestoneMet: function (index) {
      var def = this.mapDef(index);
      if (!def || !def.unlock) return false;
      if (def.unlock.kind === 'wave') return this.safeInt(this.data.bestWave, 0) >= def.unlock.wave;
      return false;
    },
    mapUnlockHint: function (index) {
      var def = this.mapDef(index);
      if (!def || !def.unlock) return '';
      return def.unlock.kind === 'wave' ? def.unlock.wave : def.unlock.cost;
    },
    // 波次里程碑达成后自动写入 unlockedMaps 并落盘（coins 类不自动解锁，只能买）。
    refreshMapUnlocks: function () {
      if (!this.data || !Array.isArray(this.data.unlockedMaps)) return;
      var changed = false;
      var layouts = CONFIG.FIELD.LAYOUTS || [];
      for (var i = 1; i < layouts.length; i++) {
        if (this.data.unlockedMaps.indexOf(i) >= 0) continue;
        if (this.mapMilestoneMet(i)) {
          this.data.unlockedMaps.push(i);
          changed = true;
        }
      }
      if (changed) this.save();
    },
    canBuyMap: function (index) {
      var def = this.mapDef(index);
      if (!def || !def.unlock || def.unlock.kind !== 'coins') return false;
      if (this.isMapUnlocked(index)) return false;
      return this.data.survivorCoins >= def.unlock.cost;
    },
    buyMap: function (index) {
      if (!this.canBuyMap(index)) return false;
      var def = this.mapDef(index);
      this.data.survivorCoins -= def.unlock.cost;
      this.data.unlockedMaps.push(index);
      this.data.selectedMap = index;
      this.save();
      return true;
    },
    selectMap: function (index) {
      if (!this.isMapUnlocked(index)) return false;
      this.data.selectedMap = index;
      this.save();
      return true;
    },
    // v012 #72：coins 入参语义为"本次撤离获得的幸存者硬币"。阵亡/未撤离由调用方传 0。
    settleRun: function (seconds, kills, wave, coins, countRun) {
      this.data.survivorCoins += Math.max(0, Math.floor(coins));
      this.data.bestTime = Math.max(this.data.bestTime, seconds);
      this.data.bestKills = Math.max(this.data.bestKills, kills);
      this.data.bestWave = Math.max(this.data.bestWave, wave);
      if (countRun) this.data.runs = (this.data.runs || 0) + 1;
      if (countRun) {
        this.data.bestDamage = Math.max(this.data.bestDamage || 0, root.RunStats.damageDone || 0);
        this.data.totalKills += kills;
        this.data.totalElites += root.RunStats.killElite || 0;
        this.data.totalBosses += (root.RunStats.killBoss || 0) + (root.RunStats.killSpecial || 0);
        this.data.totalSurvivorCoins += Math.max(0, Math.floor(coins));
        if (Game.exitType === 'extract') this.data.extractCount += 1;
        var mapName = CONFIG.TEXT.MAP_NAMES[this.data.selectedMap || 0] || '—';
        this.data.recentRuns.unshift({ date: new Date().toISOString(), map: mapName, wave: wave, kills: kills, damage: Math.floor(root.RunStats.damageDone || 0), exit: Game.exitType === 'extract' ? 'extract' : 'death' });
        if (this.data.recentRuns.length > 30) this.data.recentRuns.length = 30;
      }
      // 结算后再检查波次里程碑（如 ring_street 需到达第 10 波）。
      this.refreshMapUnlocks();
      this.save();
      this.recordRunAchievements(seconds, kills, wave, coins);
      if (root.Achievements && root.Achievements.recordRun) root.Achievements.recordRun(Game.exitType, wave);
    },
    // v013 #83 挂机奖励削弱：离线产出固定为 CONFIG.META.OFFLINE_BASE_PER_MINUTE（约 0.5/分钟）。
    // 不再按最佳波次(waveMultiplier)与贪婪倍率(greedMultiplier)放大——挂机只是补充，不随养成膨胀。
    getOfflineRate: function () {
      return CONFIG.META.OFFLINE_BASE_PER_MINUTE;
    },
    calculateOfflineReward: function (now) {
      var elapsedMs = Math.max(0, now - this.data.lastOfflineTs);
      var maxMs = CONFIG.META.OFFLINE_MAX_HOURS * 60 * 60 * 1000;
      var creditedMs = Math.min(elapsedMs, maxMs);
      var newMinutes = Math.min(Math.floor(creditedMs / 60000), Math.max(0, CONFIG.META.OFFLINE_MAX_HOURS * 60 - this.pendingOfflineMinutes));
      this.pendingOfflineMinutes += newMinutes;
      this.pendingOfflineCoins += Math.floor(newMinutes * this.getOfflineRate());
      this.offlinePopupActive = this.pendingOfflineCoins > 0;
    },
    claimOffline: function (doubleReward) {
      if (!this.offlinePopupActive) return;
      var multiplier = doubleReward ? 2 : 1;
      var reward = this.pendingOfflineCoins * multiplier;
      this.data.survivorCoins += reward;
      this.pendingOfflineCoins = 0;
      this.pendingOfflineMinutes = 0;
      this.offlinePopupActive = false;
      this.showToast(CONFIG.TEXT.TOTAL_COINS(this.data.survivorCoins));
      this.save();
    },
    isSpeedupReady: function () {
      return Date.now() >= this.data.speedupCdTs;
    },
    getSpeedupReward: function () {
      return Math.floor(this.getOfflineRate() * CONFIG.META.SPEEDUP_MINUTES);
    },
    claimSpeedup: function () {
      if (!this.isSpeedupReady()) return false;
      var reward = this.getSpeedupReward();
      this.data.survivorCoins += reward;
      this.data.speedupCdTs = Date.now() + CONFIG.META.SPEEDUP_COOLDOWN_MS;
      this.showToast(CONFIG.TEXT.SPEEDUP_REWARD(CONFIG.META.SPEEDUP_MINUTES, reward));
      this.save();
      return true;
    },
    getSpeedupRemainingMs: function () {
      return Math.max(0, this.data.speedupCdTs - Date.now());
    },
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
    // #92 核心词条首次横幅：屏幕中上方短横幅，CONFIG.PRODUCT.BANNER_TIME 秒自动消失，不暂停不打断。
    showPerkBanner: function (text) {
      this.perkBannerText = text;
      this.perkBannerTimer = CONFIG.PRODUCT.BANNER_TIME;
    },
    update: function (dt) {
      if (this.toastTimer > 0) {
        this.toastTimer = Math.max(0, this.toastTimer - dt);
      }
      if (this.perkBannerTimer > 0) {
        this.perkBannerTimer = Math.max(0, this.perkBannerTimer - dt);
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
          alwaysShowJoystick: !!root.Settings.alwaysShowJoystick,
          quality: root.Settings.quality,
          highFps: !!root.Settings.highFps,
          mirror: !!root.Settings.mirror
        };
      }
      try {
        Platform.setStorage(CONFIG.SAVE.KEY, JSON.stringify(this.data));
        if (root.Settings) root.Settings.storageFailed = false;
      } catch (error) {
        if (root.Settings) root.Settings.storageFailed = true;
      }
    },
    // 多牌也从固定牌库重建，沿用旧单牌的容错规则。
    mergeRunBuffs: function (saved) {
      this.data.nextRunBuffs = [];
      var a = saved.nextRunBuffs;
      if (Array.isArray(a) && root.FateCards) {
        for (var i = 0; i < a.length && this.data.nextRunBuffs.length < CONFIG.BALANCE.FATE_PICK_COUNT; i++) {
          var entry = a[i];
          if (!entry || typeof entry !== 'object') continue;
          for (var j = 0; j < root.FateCards.defs.length; j++) {
            var d = root.FateCards.defs[j];
            if (d[0] !== Number(entry.cardId)) continue;
            this.data.nextRunBuffs.push({
              cardId: d[0],
              rarity: d[3],
              effectType: d[4],
              effectValue: d[5],
              name: d[1]
            });
            break;
          }
        }
      }
      var src = saved.weaponLevel,
        ids = ['pistol', 'smg', 'ar', 'mg', 'flamer', 'crossbow'];
      for (var k = 0; k < ids.length; k++) {
        var id = ids[k],
          v = src && src[id];
        if (v) {
          this.data.weaponLevel[id].lv = Math.max(id === 'pistol' ? 1 : 0, this.safeInt(v.lv, id === 'pistol' ? 1 : 0));
          this.data.weaponLevel[id].pts = this.safeInt(v.pts, 0);
        }
      }
      if (/^(pistol|smg|ar|mg|flamer|crossbow)$/.test(saved.selectedWeapon || '')) {
        var selected = saved.selectedWeapon, masteryData = this.data.weaponMastery;
        var unlocked = selected === 'pistol' || selected === 'smg' && masteryData.total >= CONFIG.WEAPONS.UNLOCKS.SMG_TOTAL || selected === 'ar' && masteryData.smg >= CONFIG.WEAPONS.UNLOCKS.AR_SMG || selected === 'mg' && masteryData.ar >= CONFIG.WEAPONS.UNLOCKS.MG_AR || selected === 'flamer' && this.data.weaponLevel.pistol.lv >= 5 || selected === 'crossbow' && this.data.weaponLevel.pistol.lv >= 10;
        this.data.selectedWeapon = unlocked ? selected : 'pistol';
      }
    },
    // 结算后汇总永久成就。
    recordRunAchievements: function (sec, k, w, c) {
      root.Achievements.add('time', sec);
      root.Achievements.add('coinsTotal', c);
      root.Achievements.set('bestTime', sec);
      root.Achievements.set('bestWave', w);
      if (Game.exitType === 'extract') {
        root.Objectives.add('extract', 1);
        root.Achievements.add('extract', 1);
      }
      root.Achievements.check();
      Meta.save(false);
    }
  };
  var Settings = {
    sound: true,
    shake: true,
    debug: false,
    dashDoubleTap: false,
    alwaysShowJoystick: false,
    quality: CONFIG.RENDER_QUALITY.DEFAULT,
    highFps: false,
    mirror: false,
    autoLevel: 'high',
    storageFailed: false,
    load: function () {
      try {
        var raw = Platform.getStorage(CONFIG.SAVE.KEY);
        var data = raw ? typeof raw === 'string' ? JSON.parse(raw) : raw : {};
        var value = data && data.settings;
        if (value) {
          for (var key in {
            sound: 1,
            shake: 1,
            debug: 1,
            dashDoubleTap: 1,
            alwaysShowJoystick: 1
          }) {
            if (typeof value[key] === 'boolean') this[key] = value[key];
          }
          if (/^(auto|high|medium|low)$/.test(value.quality || '')) this.quality = value.quality;
          if (typeof value.highFps === 'boolean') this.highFps = value.highFps;
          if (typeof value.mirror === 'boolean') this.mirror = value.mirror;
        }
      } catch (error) {/* Meta 会负责修复 */}
      this.applyFrameRate();
    },
    getQualityLevel: function () { return this.quality === 'auto' ? this.autoLevel : this.quality; },
    getQuality: function () { return CONFIG.RENDER_QUALITY.LEVELS[this.getQualityLevel()] || CONFIG.RENDER_QUALITY.LEVELS.high; },
    cycleQuality: function () {
      var values = ['auto', 'high', 'medium', 'low'];
      this.quality = values[(values.indexOf(this.quality) + 1) % values.length];
      Meta.save();
    },
    applyFrameRate: function () {
      try { if (typeof wx !== 'undefined' && wx.setPreferredFramesPerSecond) wx.setPreferredFramesPerSecond(this.highFps ? CONFIG.RENDER_QUALITY.HIGH_FPS_TARGET : CONFIG.RENDER_QUALITY.DEFAULT_FPS); } catch (error) {}
    },
    toggle: function (key) {
      this[key] = !this[key];
      if (key === 'sound' && root.AudioFX) root.AudioFX.setEnabled();
      if (key === 'highFps') this.applyFrameRate();
      Meta.save();
    }
  };
  root.Meta = Meta;
  root.Settings = Settings;
})();

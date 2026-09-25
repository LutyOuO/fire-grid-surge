(function () {
  'use strict';

  // ============================================================
  // item.js — 道具与掉落模块
  // 职责：RunStats/Experience/ExpLevelUp/CoinDrops/PowerUps
  // 主要对象：RunStats(calculateCoins/canDoubleCoins/adRefreshUsed/...), Experience(update/draw/initPool),
  //           ExpLevelUp(prepareOffers/handleInput/rollRarity/refreshOffers),
  //           CoinDrops(update/draw), PowerUps(handleInput/update/useBomb/inventory)
  // 全局状态：G.run(RunStats), G.bag(PowerUps.inventory 道具栏)
  // #57 磁铁改为主动道具：3 秒全图高速吸附（magnetTimer）
  // #58 isEligible 按本局主武器 WeaponProgress.selected 过滤词条池
  // 依赖：core.js(G/Camera), player.js(G.player), enemy.js(Enemy), weapon.js(WeaponProgress/Weapons),
  //       save.js(Meta), ads.js(Ads 广告位), config.js(CONFIG)
  // 加载顺序：core → ... → wave → item
  // ============================================================
  var root = typeof window !== 'undefined' ? window : global;
  var CONFIG = root.CONFIG;
  var RunStats = {
    kills: 0,
    damageDone: 0,
    pickedCoins: 0,
    // v012 #73 按类型击杀计数：普通/精英/BOSS/特殊（远程Boss），用于幸存者硬币换算。
    killNormal: 0,
    killElite: 0,
    killBoss: 0,
    killSpecial: 0,
    // v012 #72 局内金币：击杀掉落拾取累加，花在炮塔激活/补给点，局末清零，绝不进 Meta 持久货币。
    gold: 0,
    finalCoins: 0,
    baseCoins: 0,
    greedBonus: 0,
    undoubledCoins: 0,
    committedCoins: 0,
    adRefreshUsed: 0,
    adReviveUsed: 0,
    adCoinDoubleUsed: 0,
    coinDoubleClaimed: false,
    extractBonus: false,
    extractAdClaimed: false,
    reset: function () {
      this.kills = 0;
      this.damageDone = 0;
      this.pickedCoins = 0;
      this.gold = 0;
      this.killNormal = 0;
      this.killElite = 0;
      this.killBoss = 0;
      this.killSpecial = 0;
      this.finalCoins = 0;
      this.baseCoins = 0;
      this.greedBonus = 0;
      this.undoubledCoins = 0;
      this.committedCoins = 0;
      this.runCounted = false;
      this.freeRefreshUsed = 0;
      this.choicesTaken = 0;
      this.sourceKills = Object.create(null);
      this.adRefreshUsed = 0;
      this.adReviveUsed = 0;
      this.adCoinDoubleUsed = 0;
      this.coinDoubleClaimed = false;
      this.extractBonus = false;
      this.extractAdClaimed = false;
    },
    // 收益预览不修改结算状态，不触发存档发奖。
    // v012 #73 幸存者硬币换算：存活波次 + 按类型击杀 + 局内等级 + 剩余局内金币，向下取整。
    extractRawCoins: function (wave, level, gold, nKills, eKills, bKills, sKills) {
      var E = CONFIG.EXTRACTION;
      var v = wave * E.WAVE +
        nKills * E.NORMAL +
        eKills * E.ELITE +
        bKills * E.BOSS +
        sKills * E.SPECIAL +
        level * E.LEVEL +
        gold * E.GOLD;
      return Math.floor(v);
    },
    // 实时预览：用当前进度算现在撤离能拿多少幸存者硬币。
    extractionPreview: function () {
      return this.extractRawCoins(
        root.Spawner.waveIndex, ExpLevelUp.level, this.gold,
        this.killNormal, this.killElite, this.killBoss, this.killSpecial);
    },
    // 粗估继续挑战：再撑 WAVE_EVERY 波到下一个撤离点大概能拿多少（同公式按预估增量）。
    extractContinueEstimate: function () {
      var cur = root.Spawner.waveIndex;
      var every = CONFIG.EXTRACTION.WAVE_EVERY;
      var nq=CONFIG.V20.NORMAL_QUOTA, next=cur+1;
      var perWaveNormal=next<10?nq.EARLY_BASE+nq.EARLY_STEP*next:next===10?nq.WAVE_TEN:next<20?Math.max(nq.LATE_FLOOR,nq.LATE_START-(next-10)*nq.LATE_STEP):nq.ENDGAME;
      var estNormal = this.killNormal + perWaveNormal * every;
      var estElite = this.killElite + 2;            // 粗估再撑 5 波多 2 精英
      var estLevel = ExpLevelUp.level + 1;          // 粗估再升 1 级
      var estGold = this.gold * 1.5;                 // 粗估剩余金币增长
      return this.extractRawCoins(
        cur + every, estLevel, estGold,
        estNormal, estElite, this.killBoss, this.killSpecial);
    },
    // 继续挑战相对现在撤离大概多拿的硬币（≥0）。
    extractGainIfContinue: function () {
      return Math.max(0, this.extractContinueEstimate() - this.extractionPreview());
    },
    contribution: function () {
      var best = '', count = 0;
      for (var id in this.sourceKills) if (this.sourceKills[id] > count) { best = id; count = this.sourceKills[id]; }
      return best ? CONFIG.TEXT.PRODUCT.SOURCE_COUNT(CONFIG.TEXT.PRODUCT.SOURCES[best] || best, count) : CONFIG.TEXT.SETTLEMENT_KILLS(this.kills);
    },
    nextGoal: function () {
      var defs = root.Achievements.defs || [], data = Meta.data.achievements, best = null, ratio = 0;
      for (var i = 0; i < defs.length; i++) {
        var d = defs[i];
        if (data.completed.indexOf(d[0]) >= 0) continue;
        var progress = data.progress[d[3]] || 0;
        if (progress > 0 && progress / d[4] > ratio && progress < d[4]) { best = d; ratio = progress / d[4]; }
      }
      return best ? best[1] + ' ' + (data.progress[best[3]] || 0) + '/' + best[4] : CONFIG.TEXT.PRODUCT.TRY_TURRET;
    },
    calculateCoins: function (seconds, level, isVictory) {
      var timeCoins = Math.floor(seconds / CONFIG.REWARDS.SECONDS_PER_COIN);
      var killCoins = this.kills * CONFIG.REWARDS.COINS_PER_KILL;
      var levelCoins = level * CONFIG.REWARDS.COINS_PER_LEVEL;
      this.baseCoins = timeCoins + killCoins + levelCoins + this.pickedCoins;
      var greedRate = Meta.getEffectTotal('GREED');
      var afterGreed = Math.floor(this.baseCoins * (1 + greedRate));
      this.greedBonus = afterGreed - this.baseCoins;
      if (this.extractBonus) {
        // v012 #73 幸存者硬币：按新公式（存活波次/按类型击杀/等级/剩余金币）向下取整；广告四倍另乘。
        var extractCoins = this.extractRawCoins(
          root.Spawner.waveIndex, level, this.gold,
          this.killNormal, this.killElite, this.killBoss, this.killSpecial);
        if (this.extractAdClaimed) extractCoins = Math.floor(extractCoins * CONFIG.EXTRACTION.AD_MULTIPLIER);
        this.baseCoins = extractCoins;
        this.undoubledCoins = extractCoins;
        this.finalCoins = extractCoins;
        return this.finalCoins;
      }
      var victoryCoins = isVictory ? CONFIG.REWARDS.VICTORY_BONUS : 0;
      this.undoubledCoins = afterGreed + victoryCoins;
      this.finalCoins = this.coinDoubleClaimed ? this.undoubledCoins * 2 : this.undoubledCoins;
      return this.finalCoins;
      if (Player.nextGoldBonus) {
        this.undoubledCoins = Math.round(this.undoubledCoins * (1 + Player.nextGoldBonus));
        this.finalCoins = this.coinDoubleClaimed ? this.undoubledCoins * 2 : this.undoubledCoins;
      }
    },
    getRefreshRemaining: function () {
      return Math.max(0, CONFIG.ADS.MAX_REFRESHES_PER_RUN - this.adRefreshUsed);
    },
    getReviveRemaining: function () {
      return Math.max(0, CONFIG.ADS.MAX_REVIVES_PER_RUN - this.adReviveUsed);
    },
    canDoubleCoins: function () {
      return this.adCoinDoubleUsed < CONFIG.ADS.MAX_COIN_DOUBLES_PER_RUN;
    },
    // 撤退广告四倍：与死亡翻倍互斥（同局只能用一个），每局限1次
    canExtractAdQuad: function () {
      return !this.coinDoubleClaimed && !this.extractAdClaimed;
    },
    // v012 #72 局内金币扣费：余额足够才扣并返回 true。炮塔激活走这里。
    spendGold: function (amount) {
      if (this.gold < amount) return false;
      this.gold -= amount;
      return true;
    },
    // #78 补给点预留入口：从局内金币扣费并把指定道具 +1（补给点本体在 #78 批次实现，此处仅留接口）。
    buySupplyItem: function (itemTypeIndex, cost) {
      if (!this.spendGold(cost)) return false;
      root.PowerUps.inventory[itemTypeIndex] = (root.PowerUps.inventory[itemTypeIndex] || 0) + 1;
      return true;
    }
  };
  var Experience = {
    pool: [],
    activeCount: 0,
    initPool: function () {
      this.pool.length = 0;
      for (var i = 0; i < CONFIG.EXPERIENCE.POOL_SIZE; i++) {
        this.pool.push({
          active: false,
          x: 0,
          y: 0,
          value: 0,
          flying: false
        });
      }
    },
    reset: function () {
      this.activeCount = 0;
      for (var i = 0; i < this.pool.length; i++) this.pool[i].active = false;
    },
    forceFlyAll: function () {
      for (var i = 0; i < this.pool.length; i++) {
        if (this.pool[i].active) this.pool[i].flying = true;
      }
    },
    dropGem: function (x, y, value) {
      if (this.activeCount >= CONFIG.EXPERIENCE.DROWN_CAP) {
        var nearest = null, nearestSq = Infinity;
        for (var m = 0; m < this.pool.length; m++) {
          var existing = this.pool[m];
          if (!existing.active || existing.flying) continue;
          var mdx = existing.x - x, mdy = existing.y - y, md2 = mdx * mdx + mdy * mdy;
          if (md2 < nearestSq) { nearestSq = md2; nearest = existing; }
        }
        if (nearest) { nearest.value += value; return; }
      }
      for (var i = 0; i < this.pool.length; i++) {
        var gem = this.pool[i];
        if (!gem.active) {
          gem.active = true;
          gem.x = x;
          gem.y = y;
          gem.value = value;
          gem.flying = false;
          this.activeCount += 1;
          return;
        }
      }
    },
    update: function (dt) {
      var magnet = root.PowerUps.magnetActive();
      for (var i = 0; i < this.pool.length; i++) {
        var gem = this.pool[i];
        if (!gem.active) continue;
        var dx = Player.x - gem.x,
          dy = Player.y - gem.y;
        var distanceSq = dx * dx + dy * dy;
        if (!gem.flying && (magnet || distanceSq <= Player.pickupRadius * Player.pickupRadius)) gem.flying = true;
        if (gem.flying) this.moveGem(gem, dx, dy, distanceSq, dt, magnet);
      }
    },
    moveGem: function (gem, dx, dy, distanceSq, dt, magnet) {
      if (distanceSq <= CONFIG.EXPERIENCE.COLLECT_DISTANCE * CONFIG.EXPERIENCE.COLLECT_DISTANCE) {
        this.collectGem(gem);
        return;
      }
      if (distanceSq > 0) {
        var distance = Math.sqrt(distanceSq);
        var speed = magnet ? (CONFIG.POWERUPS.MAGNET_PULL_SPEED * (1 + Meta.getGadgetAmount('magnet', 'speed'))) : CONFIG.EXPERIENCE.FLY_SPEED;
        var moveDistance = Math.min(distance, speed * dt);
        gem.x += dx / distance * moveDistance;
        gem.y += dy / distance * moveDistance;
      }
    },
    collectGem: function (gem) {
      root.Objectives.add('exp', gem.value || 1);
      root.Achievements.add('exp', gem.value || 1);
      gem.active = false;
      this.activeCount -= 1;
      ExpLevelUp.addExperience(gem.value);
    },
    draw: function (ctx) {
      for (var i = 0; i < this.pool.length; i++) {
        if (this.pool[i].active) this.drawOne(ctx, this.pool[i]);
      }
    },
    drawOne: function (ctx, gem) {
      if (!Camera.isVisible(gem.x, gem.y, CONFIG.EXPERIENCE.GEM_LENGTH)) return;
      var x = gem.x - Camera.x,
        y = gem.y - Camera.y;
      var halfWidth = CONFIG.EXPERIENCE.GEM_WIDTH / 2;
      var halfLength = CONFIG.EXPERIENCE.GEM_LENGTH / 2;
      var spriteKey = 'gem_' + CONFIG.COLORS.GEM;
      var sprite = root.SpriteCache && root.SpriteCache.getDiamond(spriteKey, halfWidth, halfLength, CONFIG.COLORS.GEM, CONFIG.COLORS.GEM_GLOW, CONFIG.COLORS.GEM_OUTLINE, CONFIG.COLORS.GEM_CORE);
      if (sprite) { ctx.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2); return; }
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, y - halfLength);
      ctx.lineTo(x + halfWidth, y);
      ctx.lineTo(x, y + halfLength);
      ctx.lineTo(x - halfWidth, y);
      ctx.closePath();
      ctx.fillStyle = CONFIG.COLORS.GEM;
      ctx.fill();
      ctx.lineWidth = CONFIG.EXPERIENCE.OUTLINE_WIDTH;
      ctx.strokeStyle = CONFIG.COLORS.GEM_OUTLINE;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - halfLength * 0.58);
      ctx.lineTo(x, y + halfLength * 0.2);
      ctx.strokeStyle = CONFIG.COLORS.GEM_CORE;
      ctx.stroke();
      ctx.restore();
    }
  };
  var ExpLevelUp = {
    level: 1,
    exp: 0,
    need: CONFIG.EXPERIENCE.BASE_NEED,
    pendingChoices: 0,
    levels: Object.create(null),
    offers: [],
    offerCount: 0,
    candidateIndices: [],
    rainbowOwned: Object.create(null),
    init: function () {
      this.offers.length = 0;
      for (var i = 0; i < CONFIG.UPGRADES.OFFER_COUNT; i++) {
        this.offers.push({
          definition: null,
          rarity: null,
          description: '',
          level: 0
        });
      }
      this.reset();
    },
    reset: function () {
      this.level = 1 + Math.round(Meta.getEffectTotal('START_LEVEL'));
      this.exp = 0;
      this.need = this.getNeed(this.level);
      this.pendingChoices = 0;
      this.offerCount = 0;
      this.rainbowOwned = Object.create(null);
      for (var i = 0; i < CONFIG.UPGRADES.DEFINITIONS.length; i++) {
        this.levels[CONFIG.UPGRADES.DEFINITIONS[i].ID] = 0;
      }
    },
    getNeed: function (level) {
      return Math.floor(CONFIG.EXPERIENCE.BASE_NEED * Math.pow(CONFIG.EXPERIENCE.NEED_GROWTH, level - 1));
    },
    addExperience: function (amount) {
      this.exp += amount * (1 + Meta.getEffectTotal('EXP_GAIN') + Player.expGainBonus);
      while (this.exp >= this.need) {
        this.exp -= this.need;
        this.level += 1;
        this.need = this.getNeed(this.level);
        this.pendingChoices += 1;
      }
    },
    hasPendingChoice: function () {
      return this.pendingChoices > 0;
    },
    prepareOffers: function () {
      this.offerRevision = (this.offerRevision || 0) + 1;
      this.collectEligibleDefinitions();
      this.offerCount = Math.min(CONFIG.UPGRADES.OFFER_COUNT, this.candidateIndices.length);
      var legendarySeen = false;
      var goldSeen = false;
      for (var i = 0; i < this.offerCount; i++) {
        var rarity = this.rollAvailableRarity();
        if (!rarity) { this.offerCount=i; break; }
        var matching = [];
        for (var c = 0; c < this.candidateIndices.length; c++) {
          var candidate = CONFIG.UPGRADES.DEFINITIONS[this.candidateIndices[c]];
          // #84 第五档 RAINBOW(彩) 复用 LEGENDARY(金) 词条池：彩虹只换视觉光效，不新增词条。
          if (candidate.RARITY === rarity.ID || (rarity.ID === 'RAINBOW' && candidate.RARITY === 'LEGENDARY')) matching.push(c);
        }
        if (!matching.length) {
          this.offerCount = i;
          break;
        }
        var curWeapon = root.WeaponProgress.selected || 'pistol';
        var early = RunStats.choicesTaken < CONFIG.PRODUCT.EARLY_CHOICES;
        var preferred = [];
        for (var m = 0; m < matching.length; m++) {
          var def = CONFIG.UPGRADES.DEFINITIONS[this.candidateIndices[matching[m]]];
          var scope=CONFIG.UPGRADES.WEAPON_IDS[curWeapon]||curWeapon;
          var isWeapon = def.weaponScope === scope || def.weaponScope === 'firearm' && !!CONFIG.WEAPONS.FIREARMS[curWeapon];
          var survival = ['MAX_HP', 'MOVE_SPEED', 'PICKUP_RADIUS'].indexOf(def.EFFECT) >= 0;
          // 前期在已抽中的品质档内倾向当前武器和生存词条；不改变品质概率。
          var wanted = early ? (i < 2 ? isWeapon : survival) :
            i === 0 ? isWeapon : i === 1 ? survival : false;
          if (wanted) preferred.push(matching[m]);
        }
        var choices = preferred.length ? preferred : matching;
        var pick = choices[Math.floor(Math.random() * choices.length)];
        var definitionIndex = this.candidateIndices[pick];
        var definition = CONFIG.UPGRADES.DEFINITIONS[definitionIndex];
        var offer = this.offers[i];
        offer.definition = definition;
        offer.rarity = rarity;
        offer.level = this.levels[definition.ID];
        offer.description = this.buildDescription(definition, rarity);
        this.candidateIndices[pick] = this.candidateIndices[this.candidateIndices.length - 1];
        this.candidateIndices.length -= 1;
        for(var mx=0;mx<CONFIG.UPGRADES.MUTEX.length;mx++){
          var pair=CONFIG.UPGRADES.MUTEX[mx],other=pair[0]===definition.ID?pair[1]:pair[1]===definition.ID?pair[0]:null;
          if(!other)continue;
          for(var ix=this.candidateIndices.length-1;ix>=0;ix--)if(CONFIG.UPGRADES.DEFINITIONS[this.candidateIndices[ix]].ID===other)this.candidateIndices.splice(ix,1);
        }
        if (rarity.ID === 'LEGENDARY' || rarity.ID === 'RAINBOW') legendarySeen = true;
        if (rarity.ID === 'LEGENDARY') goldSeen = true;
      }
      if (legendarySeen && root.FX) root.FX.legendaryFlash = 0.15;
      // v014 #96 稀有词条获得光效：金=金光(goldFlash)，彩=彩虹光(legendaryFlash 渐变，见 hud.js)。
      if (goldSeen && root.FX) root.FX.goldFlash = CONFIG.FEEDBACK.RARITY_GOLD_FLASH;
      return this.validateOffers();
    },
    collectEligibleDefinitions: function () {
      this.candidateIndices.length = 0;
      for (var i = 0; i < CONFIG.UPGRADES.DEFINITIONS.length; i++) {
        if (this.isEligible(CONFIG.UPGRADES.DEFINITIONS[i])) this.candidateIndices.push(i);
      }
    },
    isEligible: function (definition) {
      // #113：同一唯一 ID 获得炫彩后永久退出本局候选池。
      if (this.rainbowOwned[definition.ID]) return false;
      if (this.levels[definition.ID] >= definition.MAX_LEVEL) return false;
      // #58 按本局主武器过滤词条：保留通用(all) + 副武器飞刃(blade) + 当前主武器专属；
      // 排除其他主武器的专属词条。WeaponProgress.selected 在 restart 时已同步本局主武器。
      var curWeapon = root.WeaponProgress ? root.WeaponProgress.selected || 'pistol' : 'pistol';
      // #58 解锁词条(UNLOCK_FLAME/UNLOCK_CROSSBOW)已被开局武器选择取代：进喷火器/弩箭局时
      // 该武器已解锁，这两个词条在任何局都不再刷出（他武器局已被下方 weapon 规则排除，此处补本武器局）。
      if (definition.EFFECT === 'UNLOCK_FLAME' || definition.EFFECT === 'UNLOCK_CROSSBOW') return false;
      if (!CONFIG.UPGRADES.weaponEligible(definition, curWeapon)) return false;
      if (definition.EFFECT === 'MULTISHOT') return PulseGun.projectileCount < CONFIG.WEAPONS.PULSE.MAX_PROJECTILES;
      if (definition.EFFECT === 'PENETRATION') return PulseGun.penetration < CONFIG.WEAPONS.PULSE.MAX_PENETRATION;
      if (definition.EFFECT === 'CRIT_CHANCE') return Player.critChance < CONFIG.PLAYER.MAX_CRIT_CHANCE;
      if (definition.EFFECT === 'PICKUP_RADIUS') return Player.pickupRadius < CONFIG.EXPERIENCE.MAX_PICKUP_RADIUS;
      return true;
    },
    rollRarity: function () {
      // #74/#84 权重集中在 CONFIG.UPGRADES.RARITY_WEIGHTS_INRUN（顺序：白/蓝/紫/金/彩，合计100）。
      // 引擎拆成 5 档：COMMON/RARE/EPIC/LEGENDARY(金)/RAINBOW(彩)，第五档不再折叠进 LEGENDARY。
      var weights = CONFIG.UPGRADES.RARITY_WEIGHTS_INRUN;
      var tiers = CONFIG.UPGRADES.RARITIES;
      var totalWeight = 0;
      for (var i = 0; i < weights.length; i++) totalWeight += weights[i];
      var roll = Math.random() * totalWeight;
      for (var i = 0; i < weights.length; i++) {
        roll -= weights[i];
        if (roll < 0) return tiers[Math.min(i, tiers.length - 1)];
      }
      return tiers[0];
    },
    rollAvailableRarity: function () {
      var tiers=CONFIG.UPGRADES.RARITIES,weights=CONFIG.UPGRADES.RARITY_WEIGHTS_INRUN,available=[],total=0;
      for(var i=0;i<tiers.length;i++){
        var target=tiers[i].ID==='RAINBOW'?'LEGENDARY':tiers[i].ID,found=false;
        for(var j=0;j<this.candidateIndices.length;j++)if(CONFIG.UPGRADES.DEFINITIONS[this.candidateIndices[j]].RARITY===target){found=true;break;}
        available[i]=found;if(found)total+=weights[i];
      }
      if(total<=0)return null;
      var roll=Math.random()*total;
      for(var i=0;i<tiers.length;i++)if(available[i]){roll-=weights[i];if(roll<0)return tiers[i];}
      return tiers[0];
    },
    buildDescription: function (definition, rarity) {
      var text = CONFIG.TEXT.UPGRADES[definition.TEXT_KEY];
      var quality = rarity.MULTIPLIER;
      if(definition.ID.indexOf('V20_')===0){
        var value=definition.AMOUNT*quality;
        if(['MOVE_SPEED','CRIT_CHANCE','DAMAGE_REDUCTION','RELOAD_SPEED','PULSE_DAMAGE_PERCENT','FIRE_RATE','SKILL_COOLDOWN'].indexOf(definition.EFFECT)>=0)value*=100;
        if(['SPREAD_CONTROL','FLAME_ANGLE'].indexOf(definition.EFFECT)>=0)value*=180/Math.PI;
        if(['MAGAZINE_CAPACITY','PENETRATION','MULTISHOT','BOW_COUNT'].indexOf(definition.EFFECT)>=0)value=Math.round(value);
        return text.DESC(Math.round(value*100)/100);
      }
      if (definition.EFFECT === 'PULSE_DAMAGE_PERCENT' || definition.EFFECT === 'FIRE_RATE' || definition.EFFECT === 'MOVE_SPEED' || definition.EFFECT === 'CRIT_CHANCE') {
        return text.DESC(this.toCleanNumber(definition.AMOUNT * quality * 100));
      }
      if (definition.EFFECT === 'MAX_HP' || definition.EFFECT === 'PICKUP_RADIUS') {
        return text.DESC(this.toCleanNumber(definition.AMOUNT * quality));
      }
      if (definition.EFFECT === 'MULTISHOT' || definition.EFFECT === 'PENETRATION') {
        return text.DESC(this.getDiscreteAmount(definition.AMOUNT, quality));
      }
      if (definition.EFFECT === 'PULSE_TUNE') {
        return text.DESC(this.toCleanNumber(definition.DAMAGE * quality), this.toCleanNumber(definition.SPEED * quality));
      }
      if (definition.EFFECT === 'BLADE_TUNE') {
        return text.DESC(this.getDiscreteAmount(definition.COUNT, quality), this.toCleanNumber(definition.DAMAGE * quality));
      }
      // #90 新路线词条：FAN_SPRAY 用角度度数，CLOSE_BURST/LONG_SHOT 用百分比。
      if (definition.EFFECT === 'FAN_SPRAY') {
        return text.DESC(this.toCleanNumber(definition.AMOUNT * quality * 180 / Math.PI));
      }
      if (definition.EFFECT === 'CLOSE_BURST' || definition.EFFECT === 'LONG_SHOT') {
        return text.DESC(this.toCleanNumber(definition.AMOUNT * quality * 100));
      }
      return text.DESC();
    },
    getDiscreteAmount: function (amount, quality) {
      return Math.max(1, Math.round(amount * quality));
    },
    // 只展示可直接核对的属性；机制词条使用对应操作提示。
    previewOffer: function (offer) {
      var d = offer.definition, amount = (d.AMOUNT || 0) * offer.rarity.MULTIPLIER;
      var before, after;
      if (d.EFFECT === 'MAX_HP') { before = Player.maxHp; after = before + amount; }
      if (d.EFFECT === 'PICKUP_RADIUS') { before = Player.pickupRadius; after = Math.min(CONFIG.EXPERIENCE.MAX_PICKUP_RADIUS, before + amount); }
      if (d.EFFECT === 'MULTISHOT') { before = PulseGun.projectileCount; after = Math.min(CONFIG.WEAPONS.PULSE.MAX_PROJECTILES, before + this.getDiscreteAmount(d.AMOUNT, offer.rarity.MULTIPLIER)); }
      if (d.EFFECT === 'PENETRATION') { before = PulseGun.penetration; after = Math.min(CONFIG.WEAPONS.PULSE.MAX_PENETRATION, before + this.getDiscreteAmount(d.AMOUNT, offer.rarity.MULTIPLIER)); }
      if (d.EFFECT === 'CRIT_CHANCE') { before = Player.critChance * 100; after = Math.min(CONFIG.PLAYER.MAX_CRIT_CHANCE, Player.critChance + amount) * 100; }
      // #91 卡片数值前后对比：新路线词条同样给出 旧值 → 新值。
      if (d.EFFECT === 'FAN_SPRAY') {
        before = (CONFIG.WEAPONS.PULSE.SPREAD_ANGLE + PulseGun.spreadBonus) * 180 / Math.PI;
        after = before + amount * 180 / Math.PI;
      }
      if (d.EFFECT === 'LONG_SHOT') { before = root.Crossbow.longShotBonus * 100; after = before + amount * 100; }
      if (d.EFFECT === 'CLOSE_BURST') { before = root.FlameWeapon.closeBurst * 100; after = before + amount * 100; }
      if (before !== undefined) return this.toCleanNumber(before) + ' → ' + this.toCleanNumber(after);
      return CONFIG.TEXT.PRODUCT.MECHANICS[d.EFFECT] || '';
    },
    toCleanNumber: function (value) {
      return Math.round(value * 10) / 10;
    },
    refreshOffers: function () {
      return this.prepareOffers();
    },
    handleInput: function () {
      if (UI.consumeSkipLevelAction()) {
        root.DevConsole.skipLevels();
        return;
      }
      var action = UI.consumeLevelUpAction(this.offerCount);
      if (action >= 0) this.selectOffer(action);
      if (action === -2) Game.requestLevelRefresh();
    },
    selectOffer: function (index) {
      if (Game.state !== CONFIG.GAME.STATE_LEVELUP || this.pendingChoices <= 0) return;
      if (index < 0 || index >= this.offerCount) return;
      var offer = this.offers[index];
      if (offer.rarity.ID === 'RAINBOW') this.rainbowOwned[offer.definition.ID] = true;
      if ((offer.rarity.ID === 'LEGENDARY' || offer.rarity.ID === 'RAINBOW') && root.FX && root.FX.legendaryBurst) {
        root.FX.legendaryBurst(Player.x, Player.y);
      }
      this.applyUpgrade(offer.definition, offer.rarity);
      this.levels[offer.definition.ID] += 1;
      RunStats.choicesTaken += 1;
      // #92 核心词条首次获得横幅：只有标了 core 的机制词条才提示，且每个只提示一次。
      // 已见过的词条不再弹；普通数值词条不提示。记录在 Meta.data.perkBanners（新增可选字段，向后兼容）。
      var perkDef = offer.definition;
      if (perkDef.core) {
        if (!Meta.data.perkBanners) Meta.data.perkBanners = {};
        if (!Meta.data.perkBanners[perkDef.ID]) {
          var bannerText = CONFIG.TEXT.PRODUCT.MECHANICS[perkDef.EFFECT];
          if (bannerText) Meta.showPerkBanner(bannerText);
          Meta.data.perkBanners[perkDef.ID] = true;
          Meta.save(false);
        }
      }
      this.pendingChoices = Math.max(0, this.pendingChoices - 1);
      Input.clearTap();
      Game.onLevelChoiceResolved();
    },
    applyUpgrade: function (definition, rarity) {
      var quality = rarity.MULTIPLIER;
      var amount = definition.AMOUNT || 0;
      if (definition.EFFECT === 'PULSE_DAMAGE_PERCENT') {
        PulseGun.damageBonus += amount * quality;
      } else if (definition.EFFECT === 'FIRE_RATE') {
        PulseGun.fireRateBonus += amount * quality;
      } else if (definition.EFFECT === 'MOVE_SPEED') {
        Player.moveSpeedBonus += amount * quality;
      } else if (definition.EFFECT === 'MAX_HP') {
        Player.increaseMaxHp(amount * quality);
      } else if (definition.EFFECT === 'CRIT_CHANCE') {
        Player.critChance = Math.min(CONFIG.PLAYER.MAX_CRIT_CHANCE, Player.critChance + amount * quality);
      } else if (definition.EFFECT === 'MULTISHOT') {
        PulseGun.projectileCount = Math.min(CONFIG.WEAPONS.PULSE.MAX_PROJECTILES, PulseGun.projectileCount + this.getDiscreteAmount(amount, quality));
      } else if (definition.EFFECT === 'PENETRATION') {
        PulseGun.penetration = Math.min(CONFIG.WEAPONS.PULSE.MAX_PENETRATION, PulseGun.penetration + this.getDiscreteAmount(amount, quality));
      } else if (definition.EFFECT === 'PICKUP_RADIUS') {
        Player.pickupRadius = Math.min(CONFIG.EXPERIENCE.MAX_PICKUP_RADIUS, Player.pickupRadius + amount * quality);
      } else if (definition.EFFECT === 'DAMAGE_REDUCTION') {
        Player.incomingDamageMultiplier *= 1 - amount * quality;
      } else if (definition.EFFECT === 'RELOAD_SPEED') {
        PulseGun.reloadMultiplier *= 1 - amount * quality;
      } else if (definition.EFFECT === 'MAGAZINE_CAPACITY') {
        PulseGun.magazineBonus += Math.round(amount * quality);
      } else if (definition.EFFECT === 'BULLET_SPEED') {
        PulseGun.speedFlat += amount * quality;
      } else if (definition.EFFECT === 'ARMOR_SHIELD') {
        Player.upgradeShieldMax += amount * quality;
        Player.shield += amount * quality;
      } else if (definition.EFFECT === 'CRIT_DAMAGE') {
        Player.critDamageBonus += amount * quality;
      } else if (definition.EFFECT === 'SKILL_COOLDOWN') {
        Player.skillCooldownMultiplier *= 1 - amount * quality;
      } else if (definition.EFFECT === 'SPREAD_CONTROL') {
        PulseGun.spreadBonus = Math.max(-PulseGun.getSpec().SPREAD, PulseGun.spreadBonus - amount * quality);
      } else if (definition.EFFECT === 'BLADE_DAMAGE') {
        OrbitBlade.damageFlat += amount * quality;
      } else if (definition.EFFECT === 'PULSE_TUNE') {
        this.applyPulseTune(definition, quality);
      } else if (definition.EFFECT === 'BLADE_TUNE') {
        this.applyBladeTune(definition, quality);
      } else if (definition.EFFECT === 'BARRAGE') {
        PulseGun.fireRateBonus += 0.2;
        PulseGun.projectileCount += 1;
      } else if (definition.EFFECT === 'DEADLY') {
        Player.critChance = Math.min(CONFIG.PLAYER.MAX_CRIT_CHANCE, Player.critChance + 0.08);
        Player.critDamageBonus += 0.4;
      } else if (definition.EFFECT === 'HARVEST') {
        Player.killHeal += 2;
      } else if (definition.EFFECT === 'MAGNET_FIELD') {
        Player.pickupRadius *= 1.4;
        Player.expGainBonus += 0.15;
      } else if (definition.EFFECT === 'BLADE_STORM') {
        OrbitBlade.count += 1;
        OrbitBlade.speedBonus += 0.25;
      } else if (definition.EFFECT === 'ENERGY_SHIELD') {
        Player.upgradeShieldMax += Player.maxHp * 0.15;
        Player.shield = Player.upgradeShieldMax;
        Player.upgradeShieldRecharge = 12;
      } else if (definition.EFFECT === 'TIME_WARP') {
        PulseGun.cooldownMultiplier *= 0.85;
        OrbitBlade.cooldownMultiplier *= 0.85;
      } else if (definition.EFFECT === 'DUAL_WIELD') {
        PulseGun.projectileMultiplier = 2;
        PulseGun.damageMultiplier *= 0.85;
      } else if (definition.EFFECT === 'PHOENIX') {
        Player.phoenixReady = true;
      } else if (definition.EFFECT === 'ELEMENTAL') {
        Player.globalDamageBonus += 0.4;
        Player.incomingDamageMultiplier *= 1.15;
      } else if (definition.EFFECT === 'EXECUTE') {
        Player.executeChance = Math.min(0.5, Player.executeChance + 0.25);
      } else if (definition.EFFECT === 'TIME_LORD') {
        Player.enemySpeedMultiplier *= 0.85;
      } else if (definition.EFFECT === 'WAR_GOD') {
        Player.moveSpeedBonus += 0.25;
        Player.globalDamageBonus += 0.25;
        Player.pickupRadius *= 1.25;
      } else if (definition.EFFECT === 'LASER_CANNON') {
        PulseGun.laserCannon = true;
        PulseGun.damageMultiplier *= 1.8;
      } else if (definition.EFFECT === 'FAN_SPRAY') {
        // #90 手枪A 多弹道：弹道扩散角扩大（射速/多发由 RAPID/MULTI 路线词条承担）。
        PulseGun.spreadBonus += amount * quality;
      } else if (definition.EFFECT === 'PIERCE_INFINITE') {
        // #90 手枪B 穿透：子弹无限穿透，撞到敌人不再消失。
        PulseGun.infinitePierce = true;
      } else if (definition.EFFECT === 'CLOSE_BURST') {
        // #90 喷火B 近身爆发：贴脸爆炸伤害提升，射程缩短。
        root.FlameWeapon.closeBurst += amount * quality;
        root.FlameWeapon.rangeShortMul *= (1 - 0.12 * quality);
      } else if (definition.EFFECT === 'LONG_SHOT') {
        // #90 弩箭A 远程点杀：箭寿命 ×（超远射程），单发伤害提升。
        root.Crossbow.arrowLifeMul += 0.8 * amount * quality;
        root.Crossbow.longShotBonus += amount * quality;
      } else if (definition.EFFECT === 'WALL_PIERCE') {
        // #90 弩箭B 穿墙：箭命中墙不销毁，可穿墙继续飞。
        root.Crossbow.wallPierce = true;
      }
      var e = definition.EFFECT;
      if (e === 'UNLOCK_FLAME') root.FlameWeapon.unlocked = true;else if (e === 'FLAME_DAMAGE') root.FlameWeapon.damageMul *= 1.2;else if (e === 'FLAME_RATE') root.FlameWeapon.rate *= 1.15;else if (e === 'FLAME_ANGLE') root.FlameWeapon.angle += (amount || Math.PI / 12) * quality;else if (e === 'FLAME_RANGE') root.FlameWeapon.range += (amount || 30) * quality;else if (e === 'FLAME_BURN') root.FlameWeapon.burnLife += (amount || 1) * quality;else if (e === 'NAPALM') root.FlameWeapon.napalm = true;else if (e === 'BACKDRAFT') root.FlameWeapon.backdraft = true;else if (e === 'INFERNO') root.FlameWeapon.inferno = true;else if (e === 'UNLOCK_CROSSBOW') root.Crossbow.unlocked = true;else if (e === 'BOW_DAMAGE') root.Crossbow.damage *= 1.25;else if (e === 'BOW_RATE') root.Crossbow.rate *= amount ? 1 / (1 - amount * quality) : 1.15;else if (e === 'BOW_COUNT') root.Crossbow.count += Math.round((amount || 1) * quality);else if (e === 'BOW_DECAY') root.Crossbow.decay = Math.max(0, root.Crossbow.decay - .1);else if (e === 'BOW_CRIT') root.Crossbow.crit += .1;else if (e === 'PILEDRIVER') root.Crossbow.piledriver = true;else if (e === 'SCATTER_BOLT') root.Crossbow.scatter = true;else if (e === 'MARKSMAN') root.Crossbow.marksman = true;
      var id = rarity && rarity.ID;
      if (id === 'RARE' || id === 'EPIC' || id === 'LEGENDARY' || id === 'RAINBOW') root.Objectives.add(id === 'RARE' ? 'rare' : id === 'EPIC' ? 'epic' : 'legend', 1);
    },
    applyPulseTune: function (definition, quality) {
      PulseGun.damageFlat += definition.DAMAGE * quality;
      PulseGun.speedFlat = Math.min(CONFIG.WEAPONS.PULSE.MAX_SPEED - CONFIG.WEAPONS.PULSE.SPEED, PulseGun.speedFlat + definition.SPEED * quality);
    },
    applyBladeTune: function (definition, quality) {
      OrbitBlade.damageFlat += definition.DAMAGE * quality;
      OrbitBlade.count = Math.min(CONFIG.WEAPONS.BLADE.MAX_COUNT, OrbitBlade.count + this.getDiscreteAmount(definition.COUNT, quality));
    },
    validateOffers: function () {
      for (var i = 0; i < this.offerCount; i++) {
        var o = this.offers[i];
        if (!o || !o.definition || !CONFIG.TEXT.UPGRADES[o.definition.TEXT_KEY]) {
          this.offerCount = i;
          break;
        }
        var r = o.rarity;
        if (!r || !/^(COMMON|RARE|EPIC|LEGENDARY|RAINBOW)$/.test(r.ID) || !isFinite(Number(r.MULTIPLIER)) || typeof CONFIG.COLORS[r.COLOR_KEY] !== 'string') {
          o.rarity = CONFIG.UPGRADES.RARITIES[0];
          o.description = this.buildDescription(o.definition, o.rarity);
        }
      }
      return this.offerCount > 0;
    }
  };
  var CoinDrops = {
    pool: [],
    activeCount: 0,
    initPool: function () {
      this.pool.length = 0;
      for (var i = 0; i < CONFIG.COIN.POOL_SIZE; i++) {
        this.pool.push({
          active: false,
          x: 0,
          y: 0,
          value: 0,
          flying: false
        });
      }
    },
    reset: function () {
      this.activeCount = 0;
      for (var i = 0; i < this.pool.length; i++) this.pool[i].active = false;
    },
    drop: function (x, y, value) {
      if (this.activeCount >= CONFIG.COIN.DROWN_CAP) {
        var nearest = null, nearestSq = Infinity;
        for (var m = 0; m < this.pool.length; m++) {
          var existing = this.pool[m];
          if (!existing.active || existing.flying) continue;
          var mdx = existing.x - x, mdy = existing.y - y, md2 = mdx * mdx + mdy * mdy;
          if (md2 < nearestSq) { nearestSq = md2; nearest = existing; }
        }
        if (nearest) { nearest.value += value; return; }
      }
      for (var i = 0; i < this.pool.length; i++) {
        var coin = this.pool[i];
        if (!coin.active) {
          coin.active = true;
          coin.x = x;
          coin.y = y;
          coin.value = value;
          coin.flying = false;
          this.activeCount += 1;
          return;
        }
      }
    },
    forceFlyAll: function () {
      for (var i = 0; i < this.pool.length; i++) {
        if (this.pool[i].active) this.pool[i].flying = true;
      }
    },
    update: function (dt) {
      var magnet = root.PowerUps.magnetActive();
      for (var i = 0; i < this.pool.length; i++) {
        var coin = this.pool[i];
        if (!coin.active) continue;
        var dx = Player.x - coin.x,
          dy = Player.y - coin.y;
        var distanceSq = dx * dx + dy * dy;
        if (!coin.flying && (magnet || distanceSq <= CONFIG.COIN.PICKUP_RADIUS * CONFIG.COIN.PICKUP_RADIUS)) coin.flying = true;
        if (coin.flying) this.moveCoin(coin, dx, dy, distanceSq, dt);
      }
    },
    moveCoin: function (coin, dx, dy, distanceSq, dt) {
      var wasActive = coin.active,
        value = coin.value || 0;
      if (distanceSq <= CONFIG.COIN.COLLECT_DISTANCE * CONFIG.COIN.COLLECT_DISTANCE) {
        coin.active = false;
        this.activeCount -= 1;
        RunStats.pickedCoins += coin.value;
        RunStats.gold += coin.value;
        return;
      }
      if (distanceSq > 0) {
        var distance = Math.sqrt(distanceSq);
        var magnet = root.PowerUps.magnetActive();
        var speed = magnet ? (CONFIG.POWERUPS.MAGNET_PULL_SPEED * (1 + Meta.getGadgetAmount('magnet', 'speed'))) : CONFIG.COIN.FLY_SPEED;
        var movement = Math.min(distance, speed * dt);
        coin.x += dx / distance * movement;
        coin.y += dy / distance * movement;
      }
      if (wasActive && !coin.active) {
        root.Objectives.add('coins', value);
        root.Achievements.add('coinsTotal', value);
      }
    },
    draw: function (ctx) {
      for (var i = 0; i < this.pool.length; i++) {
        var coin = this.pool[i];
        if (!coin.active) continue;
        if (!Camera.isVisible(coin.x, coin.y, CONFIG.COIN.RADIUS * 2)) continue;
        var x = coin.x - Camera.x,
          y = coin.y - Camera.y;
        var coinKey = 'coin_' + CONFIG.COLORS.COIN;
        var coinSprite = root.SpriteCache && root.SpriteCache.getCircle(coinKey, CONFIG.COIN.RADIUS, CONFIG.COLORS.COIN, CONFIG.COLORS.COIN_GLOW, CONFIG.COLORS.COIN_OUTLINE, CONFIG.COLORS.COIN_CORE);
        if (coinSprite) { ctx.drawImage(coinSprite, x - coinSprite.width / 2, y - coinSprite.height / 2); continue; }
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, CONFIG.COIN.RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.COLORS.COIN;
        ctx.fill();
        ctx.lineWidth = CONFIG.COIN.OUTLINE_WIDTH;
        ctx.strokeStyle = CONFIG.COLORS.COIN_OUTLINE;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, CONFIG.COIN.RADIUS * 0.45, 0, Math.PI * 2);
        ctx.strokeStyle = CONFIG.COLORS.COIN_CORE;
        ctx.stroke();
        ctx.restore();
      }
    }
  };
  var PowerUps = {
    pool: [],
    inventory: [0, 0, 0, 0, 0, 0],
    freezeTimer: 0,
    magnetTimer: 0,
    bombAim: { active: false, touchId: -1, x: 0, y: 0 },
    thrownBombs: [],
    initPool: function () {
      this.pool.length = 0;
      for (var i = 0; i < CONFIG.POWERUPS.POOL_SIZE; i++) {
        this.pool.push({
          active: false,
          x: 0,
          y: 0,
          life: 0,
          typeIndex: 0
        });
      }
      if (!this.thrownBombs.length) for (var b = 0; b < 5; b++) this.thrownBombs.push({ active: false, state: '', sx: 0, sy: 0, x: 0, y: 0, t: 0 });
    },
    reset: function () {
      this.freezeTimer = 0;
      this.magnetTimer = 0;
      this.bombAim.active = false;
      for (var b = 0; b < this.thrownBombs.length; b++) this.thrownBombs[b].active = false;
      for (var i = 0; i < this.pool.length; i++) this.pool[i].active = false;
      for (var i = 0; i < this.inventory.length; i++) this.inventory[i] = 0;
    },
    // #57 磁铁是否激活中（全图高速吸附）
    magnetActive: function () {
      return this.magnetTimer > 0;
    },
    update: function (dt) {
      if (this.freezeTimer > 0) this.freezeTimer = Math.max(0, this.freezeTimer - dt);
      if (this.magnetTimer > 0) this.magnetTimer = Math.max(0, this.magnetTimer - dt);
      this.updateThrownBombs(dt);
      var magnet = this.magnetActive();
      var pickupDistanceSquared = CONFIG.POWERUPS.PICKUP_DISTANCE * CONFIG.POWERUPS.PICKUP_DISTANCE;
      var pullSpeed = (CONFIG.POWERUPS.MAGNET_PULL_SPEED * (1 + Meta.getGadgetAmount('magnet', 'speed')));
      for (var i = 0; i < this.pool.length; i++) {
        var item = this.pool[i];
        if (!item.active) continue;
        item.life -= dt;
        if (item.life <= 0) {
          item.active = false;
          continue;
        }
        var dx = Player.x - item.x,
          dy = Player.y - item.y;
        var d2 = dx * dx + dy * dy;
        if (d2 <= pickupDistanceSquared) {
          this.collect(item);
        } else if (magnet) {
          // 磁铁激活：全图道具高速飞向玩家
          var dist = Math.sqrt(d2);
          if (dist > 0) {
            var step = Math.min(dist, pullSpeed * dt);
            item.x += dx / dist * step;
            item.y += dy / dist * step;
          }
        }
      }
    },
    rollDrop: function (x, y, type) {
      if (type === CONFIG.ENEMY.TYPE_ELITE) {
        if (Math.random() < CONFIG.POWERUPS.ELITE_DROP_CHANCE) this.dropRandom(x, y);
        return;
      }
      if (Player.nextDropBonus && Math.random() < CONFIG.POWERUPS.NORMAL_DROP_CHANCE * Player.nextDropBonus) this.dropRandom(x, y);
      if (type === CONFIG.ENEMY.TYPE_BOSS) {
        for (var i = 0; i < CONFIG.FIELD.BOSS_ITEMS; i++) this.drop(x + (Math.random() * 2 - 1) * CONFIG.FIELD.DROP_SPREAD, y + (Math.random() * 2 - 1) * CONFIG.FIELD.DROP_SPREAD, i === 0 ? CONFIG.POWERUPS.TYPE_LASER_EMITTER : this.rollType());
        return;
      }
      var chance = type === CONFIG.ENEMY.TYPE_TANK ? CONFIG.POWERUPS.TANK_DROP_CHANCE : CONFIG.POWERUPS.NORMAL_DROP_CHANCE;
      if (Math.random() < chance) this.dropRandom(x, y);
    },
    dropRandom: function (x, y) {
      this.drop(x, y, this.rollType());
    },
    rollType: function () {
      var total = 0;
      for (var i = 0; i < CONFIG.POWERUPS.DROP_WEIGHTS.length; i++) total += CONFIG.POWERUPS.DROP_WEIGHTS[i];
      var roll = Math.random() * total;
      for (var i = 0; i < CONFIG.POWERUPS.DROP_WEIGHTS.length; i++) {
        roll -= CONFIG.POWERUPS.DROP_WEIGHTS[i];
        if (roll < 0) return i;
      }
      return CONFIG.POWERUPS.TYPE_BOMB;
    },
    drop: function (x, y, typeIndex) {
      for (var i = 0; i < this.pool.length; i++) {
        var item = this.pool[i];
        if (!item.active) {
          item.active = true;
          item.x = x;
          item.y = y;
          item.life = CONFIG.POWERUPS.DROP_LIFE;
          item.typeIndex = typeIndex;
          return true;
        }
      }
      return false;
    },
    // #77 按道具类型返回持有上限（键名对齐 TYPE_*：激光/炸弹/血包/磁铁/冰冻）。
    maxFor: function (typeIndex) {
      var M = CONFIG.POWERUPS.MAX;
      if (typeIndex === CONFIG.POWERUPS.TYPE_BOMB) return M.BOMB;
      if (typeIndex === CONFIG.POWERUPS.TYPE_MAGNET) return M.MAGNET + Meta.getGadgetAmount('magnet', 'capacity');
      if (typeIndex === CONFIG.POWERUPS.TYPE_MEDKIT) return M.MEDKIT;
      if (typeIndex === CONFIG.POWERUPS.TYPE_FREEZE) return M.FREEZE + Meta.getGadgetAmount('freeze', 'capacity');
      if (typeIndex === CONFIG.POWERUPS.TYPE_LASER_EMITTER) return M.LASER;
      return CONFIG.POWERUPS.MAX_INVENTORY_EACH;
    },
    collect: function (item) {
      // #77 达上限后拾取无效：不增加数量、不计进度、不播拾取反馈，道具留在地上。
      if (this.inventory[item.typeIndex] >= this.maxFor(item.typeIndex)) return;
      this.inventory[item.typeIndex] += 1;
      if (root.Armory) root.Armory.triggerPerk('magnet');
      item.active = false;
      root.Objectives.add('items', 1);
      root.Achievements.add('items', 1);
    },
    handleInput: function () {
      var selectedType = UI.consumePowerUpButton();
      if (selectedType >= 0) this.activate(selectedType);
    },
    beginBombAim: function (touchId) {
      this.bombAim.active = true; this.bombAim.touchId = touchId;
      this.bombAim.x = Player.x + Math.cos(Player.facingAngle || 0) * CONFIG.BOMB_THROW.RANGE;
      this.bombAim.y = Player.y + Math.sin(Player.facingAngle || 0) * CONFIG.BOMB_THROW.RANGE;
    },
    moveBombAim: function (touchId, sx, sy) {
      if (!this.bombAim.active || this.bombAim.touchId !== touchId) return;
      var wx = Camera.screenToWorldX(sx), wy = Camera.screenToWorldY(sy), dx = wx - Player.x, dy = wy - Player.y, d = Math.hypot(dx, dy) || 1;
      var len = Math.min(CONFIG.BOMB_THROW.RANGE, d);
      this.bombAim.x = Player.x + dx / d * len; this.bombAim.y = Player.y + dy / d * len;
    },
    endBombAim: function (touchId, sx, sy, ms, move) {
      if (!this.bombAim.active || this.bombAim.touchId !== touchId) return;
      var slot = UI.ITEM_SLOTS.indexOf(CONFIG.POWERUPS.TYPE_BOMB), r = UI.getSlotRect(slot);
      if (UI.isPointInRect({ x: sx, y: sy }, r.x, r.y, r.w, r.h) && !(ms < CONFIG.BOMB_THROW.QUICK_MS && move < CONFIG.BOMB_THROW.QUICK_MOVE)) { this.bombAim.active = false; return; }
      if (ms < CONFIG.BOMB_THROW.QUICK_MS && move < CONFIG.BOMB_THROW.QUICK_MOVE) this.beginBombAim(touchId);
      if (this.throwBomb(this.bombAim.x, this.bombAim.y)) this.inventory[CONFIG.POWERUPS.TYPE_BOMB] -= 1;
      this.bombAim.active = false;
    },
    throwBomb: function (x, y) {
      for (var i = 0; i < this.thrownBombs.length; i++) if (!this.thrownBombs[i].active) {
        var b = this.thrownBombs[i]; b.active = true; b.state = 'flight'; b.sx = Player.x; b.sy = Player.y; b.x = x; b.y = y; b.t = 0; if(root.Tutorial)root.Tutorial.notify('item');return true;
      }
      return false;
    },
    updateThrownBombs: function (dt) {
      for (var i = 0; i < this.thrownBombs.length; i++) {
        var b = this.thrownBombs[i]; if (!b.active) continue; b.t += dt;
        if (b.state === 'flight' && b.t >= CONFIG.BOMB_THROW.FLIGHT) { b.state = 'fuse'; b.t = 0; }
        else if (b.state === 'fuse' && b.t >= CONFIG.BOMB_THROW.FUSE) { this.explodeThrownBomb(b); b.active = false; }
      }
    },
    bombRadius: function (thrown) {
      return (thrown ? CONFIG.BOMB_THROW.RADIUS : CONFIG.BALANCE.BOMB_RADIUS) + Meta.getGadgetAmount('bomb', 'radius');
    },
    explodeThrownBomb: function (b) {
      var radius=this.bombRadius(true), r2=radius*radius, bonus=1+Meta.getGadgetAmount('bomb','damage');
      for (var i = 0; i < Enemy.pool.length; i++) { var e = Enemy.pool[i], dx, dy; if (!e.active) continue; dx = e.x - b.x; dy = e.y - b.y; if (dx * dx + dy * dy > r2) continue;
        if (e.typeIndex === CONFIG.ENEMY.TYPE_BOSS || e.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED) { e.hp -= e.maxHp * Math.min(1, CONFIG.BOMB_THROW.BOSS_RATIO * bonus); e.stunTimer = Math.max(e.stunTimer || 0, CONFIG.BOMB_THROW.BOSS_STUN + Meta.getGadgetAmount('bomb','stun')); if (e.hp <= 0) Enemy.kill(e); }
        else Combat.hitEnemyFixed(e, e.maxHp * Math.min(1, CONFIG.BOMB_THROW.HP_RATIO * bonus), e.x, e.y);
      }
      if (FX) FX.burst(b.x, b.y, '#ff8c00'); if (Camera && root.Settings.shake) Camera.startShake(8, .3);
    },
    activate: function (typeIndex) {
      if (this.inventory[typeIndex] <= 0) return false;
      if (typeIndex === CONFIG.POWERUPS.TYPE_LASER_EMITTER) {
        if (!root.LaserEmitter.activate()) return false;
        this.inventory[typeIndex]--;
        if(root.Tutorial)root.Tutorial.notify('item');
        root.Objectives.add('items', 1);
        root.Achievements.add('items', 1);
        return true;
      }
      var used = false;
      if (typeIndex === CONFIG.POWERUPS.TYPE_BOMB) {
        used = this.useBomb();
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_MAGNET) {
        // #57 主动磁铁：激活 N 秒全图高速吸附
        this.magnetTimer = CONFIG.POWERUPS.MAGNET_DURATION + Meta.getGadgetAmount('magnet', 'duration');
        used = true;
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_MEDKIT) {
        used = this.useMedkit();
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_FREEZE) {
        this.freezeTimer = CONFIG.POWERUPS.FREEZE_DURATION + Meta.getGadgetAmount('freeze', 'duration');
        var shield = Player.maxHp * Meta.getGadgetAmount('freeze', 'shield');
        if (shield > 0) { Player.shield = Math.max(Player.shield, shield); Player.shieldTimer = Math.max(Player.shieldTimer || 0, CONFIG.POWERUPS.UPGRADE_SHIELD_TIME); }
        used = true;
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_LASER_EMITTER) {
        used = root.LaserEmitter.activate();
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_MORTAR) {
        used = root.MortarStrike.activate();
      }
      if (used) {
        if(root.Tutorial)root.Tutorial.notify('item');
        this.inventory[typeIndex] -= 1;
        root.Objectives.add('items', 1);
        root.Achievements.add('items', 1);
      }
      return used;
    },
    useBomb: function () {
      var radius=this.bombRadius(false),r2=radius*radius,bonus=1+Meta.getGadgetAmount('bomb','damage');
      // 即使范围内暂时没有敌人也明确播放中心爆炸，便于确认道具已触发。
      if (FX && FX.burst) FX.burst(Player.x, Player.y, '#ffb13b');
      for (var i = 0; i < Enemy.pool.length; i++) {
        var e = Enemy.pool[i];
        if (!e.active || (e.x - Player.x) * (e.x - Player.x) + (e.y - Player.y) * (e.y - Player.y) > r2) continue;
        if (e.typeIndex === CONFIG.ENEMY.TYPE_BOSS || e.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED) {
          e.hp = Math.max(0, e.hp - e.hp * Math.min(1, CONFIG.BALANCE.BOMB_BOSS_CURRENT_HP_RATIO * bonus));
          e.stunTimer = Math.max(e.stunTimer, CONFIG.BALANCE.BOSS_STUN + Meta.getGadgetAmount('bomb','stun'));
          if (e.hp <= 0) Enemy.kill(e);
        } else if (e.typeIndex === CONFIG.ENEMY.TYPE_ELITE) {
          Combat.hitEnemyFixed(e, root.Weapons.getMainDamage() * CONFIG.BALANCE.BOMB_ELITE_MULTIPLIER * bonus, e.x, e.y);
        } else {
          e.hp = 0;
          Enemy.kill(e);
        }
        if (FX && FX.burst) FX.burst(e.x, e.y, '#ffb13b');
      }
      if (Camera && root.Settings.shake) Camera.startShake(7, .25);
      return true;
    },
    useMedkit: function () {
      if (Player.hp >= Player.maxHp) return false;
      var Meta = root.Meta;
      var healLv = Meta.getGadgetLevel('medkit', 'heal');
      var healRatio = CONFIG.POWERUPS.MEDKIT_HEAL_RATIO + 0.08 * healLv;
      var healAmount = Player.maxHp * healRatio;
      Player.hp = Math.min(Player.maxHp, Player.hp + healAmount);
      // 应急护盾：回血值20%，上限最大生命20%，持续10秒
      if (Meta.getGadgetLevel('medkit', 'shield') > 0) {
        var shieldAmount = Math.min(Player.maxHp * 0.2, healAmount * 0.2);
        Player.shield = Math.max(Player.shield, shieldAmount);
        Player.shieldTimer = 10;
      }
      // 持续恢复：5秒内每秒回复（3%基础+每级1%）
      if (Meta.getGadgetLevel('medkit', 'regen') > 0) {
        Player.regenTimer = 5;
        Player.regenRate = Player.maxHp * (0.03 + 0.01 * Meta.getGadgetLevel('medkit', 'regen'));
      }
      // 神圣治愈：2秒无敌并清除冻结
      if (Meta.getGadgetLevel('medkit', 'holy') > 0) {
        Player.invincibleTimer = Math.max(Player.invincibleTimer, 2);
        this.freezeTimer = 0;
      }
      return true;
    },
    isFrozen: function () {
      return this.freezeTimer > 0;
    },
    drawWorldItems: function (ctx) {
      this.drawBombs(ctx);
      for (var i = 0; i < this.pool.length; i++) {
        var item = this.pool[i];
        if (!item.active) continue;
        if (!Camera.isVisible(item.x, item.y, CONFIG.UI.WORLD_ITEM_RADIUS * 2)) continue;
        var x = item.x - Camera.x,
          y = item.y - Camera.y;
        ctx.save();
        var dropColor = CONFIG.COLORS.ITEM_BASE;
        var dropKey = 'drop_' + item.typeIndex + '_' + CONFIG.UI.WORLD_ITEM_RADIUS;
        var cachedDrop = root.SpriteCache && root.SpriteCache.drawCircle(ctx, dropKey, x, y, CONFIG.UI.WORLD_ITEM_RADIUS, dropColor, CONFIG.COLORS.ITEM_BORDER, CONFIG.COLORS.ITEM_BORDER);
        if (!cachedDrop) {
          ctx.beginPath();
          ctx.arc(x, y, CONFIG.UI.WORLD_ITEM_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = dropColor;
          ctx.fill();
          ctx.lineWidth = CONFIG.UI.WORLD_ITEM_OUTLINE;
          ctx.strokeStyle = CONFIG.COLORS.ITEM_BORDER;
          ctx.stroke();
        }
        // 场景掉落物与右下道具栏共用正式切图；加载失败才退回Canvas矢量图标。
        var key = item.typeIndex === CONFIG.POWERUPS.TYPE_BOMB ? 'icon_bomb' : item.typeIndex === CONFIG.POWERUPS.TYPE_LASER_EMITTER ? 'icon_laser' : item.typeIndex === CONFIG.POWERUPS.TYPE_MAGNET ? 'icon_magnet' : item.typeIndex === CONFIG.POWERUPS.TYPE_MEDKIT ? 'icon_medkit' : item.typeIndex === CONFIG.POWERUPS.TYPE_FREEZE ? 'icon_freeze' : null;
        var icon = key && UI.icon ? UI.icon(key) : null;
        var drawSize = CONFIG.UI.WORLD_ITEM_RADIUS * 1.55;
        if (icon) ctx.drawImage(icon, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);else UI.drawPowerUpIcon(ctx, item.typeIndex, x, y, CONFIG.UI.POWERUP_ICON_SIZE);
        ctx.restore();
      }
    },
    drawBombs: function (ctx) {
      var c = CONFIG.BOMB_THROW;
      if (this.bombAim.active) { var px = Player.x - Camera.x, py = Player.y - Camera.y, ax = this.bombAim.x - Camera.x, ay = this.bombAim.y - Camera.y; ctx.save(); ctx.fillStyle = 'rgba(255,140,0,.08)'; ctx.strokeStyle = '#ff8c00'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, c.RANGE, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ax, ay); ctx.stroke(); ctx.beginPath(); ctx.arc(ax, ay, 14, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      for (var i = 0; i < this.thrownBombs.length; i++) { var b = this.thrownBombs[i]; if (!b.active) continue; var x = b.x - Camera.x, y = b.y - Camera.y;
        if (b.state === 'flight') { var p = Math.min(1, b.t / c.FLIGHT), arc = Math.sin(p * Math.PI) * 35; x = (b.sx + (b.x - b.sx) * p) - Camera.x; y = (b.sy + (b.y - b.sy) * p) - Camera.y - arc; ctx.fillStyle = '#ff8c00'; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); }
        else { var pulse = 1 + .08 * (.5 + .5 * Math.sin(b.t * 7)); ctx.save(); ctx.strokeStyle = '#e74c3c'; ctx.fillStyle = 'rgba(231,76,60,.12)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, this.bombRadius(true) * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold 34px Arial'; ctx.textAlign = 'center'; ctx.fillText(String(Math.max(1, Math.ceil(c.FUSE - b.t))), x, y - this.bombRadius(true) - 12); ctx.restore(); }
      }
    }
  };
  root.RunStats = RunStats;
  root.Experience = Experience;
  root.ExpLevelUp = ExpLevelUp;
  root.CoinDrops = CoinDrops;
  root.PowerUps = PowerUps;
  root.G.run = RunStats;
  root.G.bag = PowerUps;
})();

(function () {
  'use strict';

  // ============================================================
  // item.js — 道具与掉落模块
  // 职责：RunStats/Experience/ExpLevelUp/CoinDrops/PowerUps
  // 主要对象：RunStats(calculateCoins/canDoubleCoins/adRefreshUsed/...), Experience(update/draw/initPool),
  //           ExpLevelUp(prepareOffers/handleInput/rollRarity/refreshOffersWithRareGuarantee),
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
    pickedCoins: 0,
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
      this.pickedCoins = 0;
      this.finalCoins = 0;
      this.baseCoins = 0;
      this.greedBonus = 0;
      this.undoubledCoins = 0;
      this.committedCoins = 0;
      this.adRefreshUsed = 0;
      this.adReviveUsed = 0;
      this.adCoinDoubleUsed = 0;
      this.coinDoubleClaimed = false;
      this.extractBonus = false;
      this.extractAdClaimed = false;
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
        // 撤退：无胜利奖励，贪婪后 ×2 撤退倍率
        var extractCoins = afterGreed * CONFIG.EXTRACTION.REWARD_MULTIPLIER;
        if (this.extractAdClaimed) extractCoins = extractCoins * CONFIG.EXTRACTION.AD_MULTIPLIER;
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
        var distance = Math.hypot(dx, dy);
        if (!gem.flying && (magnet || distance <= Player.pickupRadius)) gem.flying = true;
        if (gem.flying) this.moveGem(gem, dx, dy, distance, dt, magnet);
      }
    },
    moveGem: function (gem, dx, dy, distance, dt, magnet) {
      if (distance <= CONFIG.EXPERIENCE.COLLECT_DISTANCE) {
        this.collectGem(gem);
        return;
      }
      if (distance > 0) {
        var speed = magnet ? CONFIG.POWERUPS.MAGNET_PULL_SPEED : CONFIG.EXPERIENCE.FLY_SPEED;
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
      var x = gem.x - Camera.x,
        y = gem.y - Camera.y;
      var halfWidth = CONFIG.EXPERIENCE.GEM_WIDTH / 2;
      var halfLength = CONFIG.EXPERIENCE.GEM_LENGTH / 2;
      ctx.save();
      ctx.shadowColor = CONFIG.COLORS.GEM_GLOW;
      ctx.shadowBlur = CONFIG.EXPERIENCE.GEM_RADIUS * 2;
      ctx.beginPath();
      ctx.moveTo(x, y - halfLength);
      ctx.lineTo(x + halfWidth, y);
      ctx.lineTo(x, y + halfLength);
      ctx.lineTo(x - halfWidth, y);
      ctx.closePath();
      ctx.fillStyle = CONFIG.COLORS.GEM;
      ctx.fill();
      ctx.shadowBlur = 0;
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
      this.collectEligibleDefinitions();
      this.offerCount = Math.min(CONFIG.UPGRADES.OFFER_COUNT, this.candidateIndices.length);
      var legendarySeen = false;
      for (var i = 0; i < this.offerCount; i++) {
        var rarity = this.rollRarity();
        var matching = [];
        for (var c = 0; c < this.candidateIndices.length; c++) {
          var candidate = CONFIG.UPGRADES.DEFINITIONS[this.candidateIndices[c]];
          if (candidate.RARITY && candidate.RARITY === rarity.ID || !candidate.RARITY && (rarity.ID === 'COMMON' || rarity.ID === 'RARE')) matching.push(c);
        }
        // 某档固定池已满时降级抽取，保证三张卡仍可正常生成。
        if (!matching.length) {
          rarity = CONFIG.UPGRADES.RARITIES[Math.random() < 0.6875 ? 0 : 1];
          for (var c = 0; c < this.candidateIndices.length; c++) {
            if (!CONFIG.UPGRADES.DEFINITIONS[this.candidateIndices[c]].RARITY) matching.push(c);
          }
        }
        if (!matching.length) {
          this.offerCount = i;
          break;
        }
        var pick = matching[Math.floor(Math.random() * matching.length)];
        var definitionIndex = this.candidateIndices[pick];
        var definition = CONFIG.UPGRADES.DEFINITIONS[definitionIndex];
        var offer = this.offers[i];
        offer.definition = definition;
        offer.rarity = rarity;
        offer.level = this.levels[definition.ID];
        offer.description = this.buildDescription(definition, rarity);
        this.candidateIndices[pick] = this.candidateIndices[this.candidateIndices.length - 1];
        this.candidateIndices.length -= 1;
        if (rarity.ID === 'LEGENDARY') legendarySeen = true;
      }
      if (legendarySeen && root.FX) root.FX.legendaryFlash = 0.15;
      return this.validateOffers();
    },
    collectEligibleDefinitions: function () {
      this.candidateIndices.length = 0;
      for (var i = 0; i < CONFIG.UPGRADES.DEFINITIONS.length; i++) {
        if (this.isEligible(CONFIG.UPGRADES.DEFINITIONS[i])) this.candidateIndices.push(i);
      }
    },
    isEligible: function (definition) {
      if (this.levels[definition.ID] >= definition.MAX_LEVEL) return false;
      // #58 按本局主武器过滤词条：保留通用(all) + 副武器飞刃(blade) + 当前主武器专属；
      // 排除其他主武器的专属词条。WeaponProgress.selected 在 restart 时已同步本局主武器。
      var curWeapon = root.WeaponProgress ? root.WeaponProgress.selected || 'pistol' : 'pistol';
      // #58 解锁词条(UNLOCK_FLAME/UNLOCK_CROSSBOW)已被开局武器选择取代：进喷火器/弩箭局时
      // 该武器已解锁，这两个词条在任何局都不再刷出（他武器局已被下方 weapon 规则排除，此处补本武器局）。
      if (definition.EFFECT === 'UNLOCK_FLAME' || definition.EFFECT === 'UNLOCK_CROSSBOW') return false;
      var w = definition.weapon;
      if (w && w !== 'all' && w !== 'blade' && w !== curWeapon) return false;
      if (definition.EFFECT === 'MULTISHOT') return PulseGun.projectileCount < CONFIG.WEAPONS.PULSE.MAX_PROJECTILES;
      if (definition.EFFECT === 'PENETRATION') return PulseGun.penetration < CONFIG.WEAPONS.PULSE.MAX_PENETRATION;
      if (definition.EFFECT === 'CRIT_CHANCE') return Player.critChance < CONFIG.PLAYER.MAX_CRIT_CHANCE;
      if (definition.EFFECT === 'PICKUP_RADIUS') return Player.pickupRadius < CONFIG.EXPERIENCE.MAX_PICKUP_RADIUS;
      return true;
    },
    rollRarity: function () {
      var totalWeight = 0;
      for (var i = 0; i < CONFIG.UPGRADES.RARITIES.length; i++) totalWeight += CONFIG.UPGRADES.RARITIES[i].WEIGHT;
      var roll = Math.random() * totalWeight;
      for (var i = 0; i < CONFIG.UPGRADES.RARITIES.length; i++) {
        roll -= CONFIG.UPGRADES.RARITIES[i].WEIGHT;
        if (roll < 0) return CONFIG.UPGRADES.RARITIES[i];
      }
      return CONFIG.UPGRADES.RARITIES[0];
    },
    buildDescription: function (definition, rarity) {
      var text = CONFIG.TEXT.UPGRADES[definition.TEXT_KEY];
      var quality = rarity.MULTIPLIER;
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
      return text.DESC();
    },
    getDiscreteAmount: function (amount, quality) {
      return Math.max(1, Math.round(amount * quality));
    },
    toCleanNumber: function (value) {
      return Math.round(value * 10) / 10;
    },
    refreshOffersWithRareGuarantee: function () {
      if (!this.prepareOffers()) return false;
      var hasRareOrBetter = false;
      for (var i = 0; i < this.offerCount; i++) {
        if (this.offers[i].rarity.ID !== 'COMMON') {
          hasRareOrBetter = true;
          break;
        }
      }
      if (!hasRareOrBetter && this.offerCount > 0) {
        var guaranteedRarity = CONFIG.UPGRADES.RARITIES[1];
        this.offers[0].rarity = guaranteedRarity;
        this.offers[0].description = this.buildDescription(this.offers[0].definition, guaranteedRarity);
      }
      return true;
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
      if (index < 0 || index >= this.offerCount) return;
      var offer = this.offers[index];
      if (offer.rarity.ID === 'LEGENDARY' && root.FX && root.FX.legendaryBurst) {
        root.FX.legendaryBurst(Player.x, Player.y);
      }
      this.applyUpgrade(offer.definition, offer.rarity);
      this.levels[offer.definition.ID] += 1;
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
      }
      var e = definition.EFFECT;
      if (e === 'UNLOCK_FLAME') root.FlameWeapon.unlocked = true;else if (e === 'FLAME_DAMAGE') root.FlameWeapon.damageMul *= 1.2;else if (e === 'FLAME_RATE') root.FlameWeapon.rate *= 1.15;else if (e === 'FLAME_ANGLE') root.FlameWeapon.angle += Math.PI / 12;else if (e === 'FLAME_RANGE') root.FlameWeapon.range += 30;else if (e === 'FLAME_BURN') root.FlameWeapon.burnLife += 1;else if (e === 'UNLOCK_CROSSBOW') root.Crossbow.unlocked = true;else if (e === 'BOW_DAMAGE') root.Crossbow.damage *= 1.25;else if (e === 'BOW_RATE') root.Crossbow.rate *= 1.15;else if (e === 'BOW_COUNT') root.Crossbow.count += 1;else if (e === 'BOW_DECAY') root.Crossbow.decay = Math.max(0, root.Crossbow.decay - .1);else if (e === 'BOW_CRIT') root.Crossbow.crit += .1;
      var id = rarity && rarity.ID;
      if (id === 'RARE' || id === 'EPIC' || id === 'LEGENDARY') root.Objectives.add(id === 'RARE' ? 'rare' : id === 'EPIC' ? 'epic' : 'legend', 1);
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
        if (!r || !/^(COMMON|RARE|EPIC|LEGENDARY)$/.test(r.ID) || !isFinite(Number(r.MULTIPLIER)) || typeof CONFIG.COLORS[r.COLOR_KEY] !== 'string') {
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
        var distance = Math.hypot(dx, dy);
        if (!coin.flying && (magnet || distance <= CONFIG.COIN.PICKUP_RADIUS)) coin.flying = true;
        if (coin.flying) this.moveCoin(coin, dx, dy, distance, dt);
      }
    },
    moveCoin: function (coin, dx, dy, distance, dt) {
      var wasActive = coin.active,
        value = coin.value || 0;
      if (distance <= CONFIG.COIN.COLLECT_DISTANCE) {
        coin.active = false;
        this.activeCount -= 1;
        RunStats.pickedCoins += coin.value;
        return;
      }
      if (distance > 0) {
        var magnet = root.PowerUps.magnetActive();
        var speed = magnet ? CONFIG.POWERUPS.MAGNET_PULL_SPEED : CONFIG.COIN.FLY_SPEED;
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
        var x = coin.x - Camera.x,
          y = coin.y - Camera.y;
        ctx.save();
        ctx.shadowColor = CONFIG.COLORS.COIN_GLOW;
        ctx.shadowBlur = CONFIG.COIN.RADIUS;
        ctx.beginPath();
        ctx.arc(x, y, CONFIG.COIN.RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.COLORS.COIN;
        ctx.fill();
        ctx.shadowBlur = 0;
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
    },
    reset: function () {
      this.freezeTimer = 0;
      this.magnetTimer = 0;
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
      var magnet = this.magnetActive();
      var pickupDistanceSquared = CONFIG.POWERUPS.PICKUP_DISTANCE * CONFIG.POWERUPS.PICKUP_DISTANCE;
      var pullSpeed = CONFIG.POWERUPS.MAGNET_PULL_SPEED;
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
    collect: function (item) {
      root.Objectives.add('items', 1);
      root.Achievements.add('items', 1);
      var max = CONFIG.POWERUPS.MAX_INVENTORY_EACH;
      if (CONFIG.POWERUPS.MAX_INVENTORY_OVERRIDE && CONFIG.POWERUPS.MAX_INVENTORY_OVERRIDE[item.typeIndex]) {
        max = CONFIG.POWERUPS.MAX_INVENTORY_OVERRIDE[item.typeIndex];
      }
      if (this.inventory[item.typeIndex] >= max) return;
      this.inventory[item.typeIndex] += 1;
      item.active = false;
    },
    handleInput: function () {
      var selectedType = UI.consumePowerUpButton();
      if (selectedType >= 0) this.activate(selectedType);
    },
    activate: function (typeIndex) {
      if (this.inventory[typeIndex] <= 0) return false;
      if (typeIndex === CONFIG.POWERUPS.TYPE_LASER_EMITTER) {
        if (!root.LaserEmitter.activate()) return false;
        this.inventory[typeIndex]--;
        root.Objectives.add('items', 1);
        root.Achievements.add('items', 1);
        return true;
      }
      var used = false;
      if (typeIndex === CONFIG.POWERUPS.TYPE_BOMB) {
        this.useBomb();
        used = true;
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_MAGNET) {
        // #57 主动磁铁：激活 N 秒全图高速吸附
        this.magnetTimer = CONFIG.POWERUPS.MAGNET_DURATION;
        used = true;
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_MEDKIT) {
        used = this.useMedkit();
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_FREEZE) {
        this.freezeTimer = CONFIG.POWERUPS.FREEZE_DURATION;
        used = true;
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_LASER_EMITTER) {
        used = root.LaserEmitter.activate();
      } else if (typeIndex === CONFIG.POWERUPS.TYPE_MORTAR) {
        used = root.MortarStrike.activate();
      }
      if (used) {
        this.inventory[typeIndex] -= 1;
        root.Objectives.add('items', 1);
        root.Achievements.add('items', 1);
      }
      return used;
    },
    useBomb: function () {
      var r2 = CONFIG.BALANCE.BOMB_RADIUS * CONFIG.BALANCE.BOMB_RADIUS;
      for (var i = 0; i < Enemy.pool.length; i++) {
        var e = Enemy.pool[i];
        if (!e.active || (e.x - Player.x) * (e.x - Player.x) + (e.y - Player.y) * (e.y - Player.y) > r2) continue;
        if (e.typeIndex === CONFIG.ENEMY.TYPE_BOSS || e.typeIndex === CONFIG.ENEMY.TYPE_BOSS_RANGED) {
          e.hp = Math.max(0, e.hp - e.hp * CONFIG.BALANCE.BOMB_BOSS_CURRENT_HP_RATIO);
          e.stunTimer = Math.max(e.stunTimer, CONFIG.BALANCE.BOSS_STUN);
          if (e.hp <= 0) Enemy.kill(e);
        } else if (e.typeIndex === CONFIG.ENEMY.TYPE_ELITE) {
          Combat.hitEnemyFixed(e, root.Weapons.getMainDamage() * CONFIG.BALANCE.BOMB_ELITE_MULTIPLIER, e.x, e.y);
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
      for (var i = 0; i < this.pool.length; i++) {
        var item = this.pool[i];
        if (!item.active) continue;
        var x = item.x - Camera.x,
          y = item.y - Camera.y;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, CONFIG.UI.WORLD_ITEM_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.COLORS.ITEM_BASE;
        ctx.fill();
        ctx.lineWidth = CONFIG.UI.WORLD_ITEM_OUTLINE;
        ctx.strokeStyle = CONFIG.COLORS.ITEM_BORDER;
        ctx.stroke();
        // 场景掉落物与右下道具栏共用正式切图；加载失败才退回Canvas矢量图标。
        var key = item.typeIndex === CONFIG.POWERUPS.TYPE_BOMB ? 'icon_bomb' : item.typeIndex === CONFIG.POWERUPS.TYPE_LASER_EMITTER ? 'icon_laser' : item.typeIndex === CONFIG.POWERUPS.TYPE_MAGNET ? 'icon_magnet' : item.typeIndex === CONFIG.POWERUPS.TYPE_MEDKIT ? 'icon_medkit' : item.typeIndex === CONFIG.POWERUPS.TYPE_FREEZE ? 'icon_freeze' : null;
        var icon = key && UI.icon ? UI.icon(key) : null;
        var drawSize = CONFIG.UI.WORLD_ITEM_RADIUS * 1.55;
        if (icon) ctx.drawImage(icon, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);else UI.drawPowerUpIcon(ctx, item.typeIndex, x, y, CONFIG.UI.POWERUP_ICON_SIZE);
        ctx.restore();
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

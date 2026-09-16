'use strict';
// ============================================================
// Systems（系统模块）：Spawner / BossSystem / RunStats /
//   Experience / ExpLevelUp / CoinDrops / PowerUps
// ============================================================
var root = (typeof window !== 'undefined') ? window : global;
var CONFIG = root.CONFIG;
var Player = root.Player;
var Enemy = root.Enemy;
var Camera = root.Camera;
var Combat = root.Combat;

// ---------- Spawner（刷怪器） ----------
var Spawner = {
  normalTimer: CONFIG.SPAWNER.FIRST_SPAWN_DELAY,
  waveTimer: CONFIG.SPAWNER.WAVE_INTERVAL,
  eliteTimer: CONFIG.SPAWNER.ELITE_INTERVAL,
  waveIndex: 0,

  reset: function () {
    this.normalTimer = CONFIG.SPAWNER.FIRST_SPAWN_DELAY;
    this.waveTimer = CONFIG.SPAWNER.WAVE_INTERVAL;
    this.eliteTimer = CONFIG.SPAWNER.ELITE_INTERVAL;
    this.waveIndex = 0;
  },

  update: function (dt, elapsedSeconds) {
    this.updateContinuous(dt, elapsedSeconds);
    this.updateWave(dt, elapsedSeconds);
    this.updateElite(dt, elapsedSeconds);
  },

  updateContinuous: function (dt, elapsedSeconds) {
    this.normalTimer -= dt;
    while (this.normalTimer <= 0) {
      this.spawnNormal(elapsedSeconds);
      this.normalTimer += this.getSpawnInterval(elapsedSeconds);
    }
  },

  updateWave: function (dt, elapsedSeconds) {
    this.waveTimer -= dt;
    while (this.waveTimer <= 0) {
      this.waveIndex += 1;
      var count = CONFIG.SPAWNER.WAVE_BASE_COUNT + this.waveIndex;
      for (var i = 0; i < count; i++) this.spawnNormal(elapsedSeconds);
      this.waveTimer += CONFIG.SPAWNER.WAVE_INTERVAL;
    }
  },

  updateElite: function (dt, elapsedSeconds) {
    this.eliteTimer -= dt;
    while (this.eliteTimer <= 0) {
      this.spawnType(CONFIG.ENEMY.TYPE_ELITE, elapsedSeconds);
      this.eliteTimer += CONFIG.SPAWNER.ELITE_INTERVAL;
    }
  },

  getHpMultiplier: function (elapsedSeconds) {
    return 1 + elapsedSeconds / CONFIG.SPAWNER.HP_TIME_DIVISOR;
  },

  getSpawnInterval: function (elapsedSeconds) {
    return Math.max(CONFIG.SPAWNER.MIN_INTERVAL,
      CONFIG.SPAWNER.START_INTERVAL - elapsedSeconds / CONFIG.SPAWNER.INTERVAL_TIME_DIVISOR);
  },

  spawnNormal: function (elapsedSeconds) {
    return this.spawnType(this.rollNormalType(), elapsedSeconds);
  },

  rollNormalType: function () {
    var walkerWeight = Math.max(CONFIG.SPAWNER.WALKER_MIN_WEIGHT,
      CONFIG.SPAWNER.WALKER_BASE_WEIGHT - this.waveIndex * CONFIG.SPAWNER.WALKER_WAVE_DECAY);
    var runnerWeight = CONFIG.SPAWNER.RUNNER_BASE_WEIGHT + this.waveIndex * CONFIG.SPAWNER.RUNNER_WAVE_GROWTH;
    var tankWeight = CONFIG.SPAWNER.TANK_BASE_WEIGHT + this.waveIndex * CONFIG.SPAWNER.TANK_WAVE_GROWTH;
    var roll = Math.random() * (walkerWeight + runnerWeight + tankWeight);
    if (roll < walkerWeight) return CONFIG.ENEMY.TYPE_WALKER;
    if (roll < walkerWeight + runnerWeight) return CONFIG.ENEMY.TYPE_RUNNER;
    return CONFIG.ENEMY.TYPE_TANK;
  },

  spawnType: function (typeIndex, elapsedSeconds) {
    if (Enemy.activeCount >= CONFIG.ENEMY.POOL_SIZE) return null;
    var firstSide = Math.floor(Math.random() * 4);
    for (var offset = 0; offset < 4; offset++) {
      var side = (firstSide + offset) % 4;
      var enemy = this.trySpawnOnSide(side, typeIndex, elapsedSeconds);
      if (enemy) return enemy;
    }
    return null;
  },

  trySpawnOnSide: function (side, typeIndex, elapsedSeconds) {
    var margin = CONFIG.SPAWNER.OUTSIDE_MARGIN;
    var radius = CONFIG.ENEMY.TYPES[typeIndex].RADIUS;
    var x = 0, y = 0;
    if (side === 0 && Camera.y - margin >= radius) {
      x = Camera.x + Math.random() * CONFIG.VIEW.WIDTH;
      y = Camera.y - margin;
    } else if (side === 1 && Camera.x + CONFIG.VIEW.WIDTH + margin <= CONFIG.WORLD.WIDTH - radius) {
      x = Camera.x + CONFIG.VIEW.WIDTH + margin;
      y = Camera.y + Math.random() * CONFIG.VIEW.HEIGHT;
    } else if (side === 2 && Camera.y + CONFIG.VIEW.HEIGHT + margin <= CONFIG.WORLD.HEIGHT - radius) {
      x = Camera.x + Math.random() * CONFIG.VIEW.WIDTH;
      y = Camera.y + CONFIG.VIEW.HEIGHT + margin;
    } else if (side === 3 && Camera.x - margin >= radius) {
      x = Camera.x - margin;
      y = Camera.y + Math.random() * CONFIG.VIEW.HEIGHT;
    } else {
      return null;
    }
    x = Math.max(radius, Math.min(CONFIG.WORLD.WIDTH - radius, x));
    y = Math.max(radius, Math.min(CONFIG.WORLD.HEIGHT - radius, y));
    return Enemy.spawn(x, y, typeIndex, this.getHpMultiplier(elapsedSeconds));
  }
};

// ---------- BossSystem（最终 Boss） ----------
var BossSystem = {
  spawned: false, defeated: false,
  rangedSpawned: false, rangedDefeated: false,
  reset: function () {
    this.spawned = false; this.defeated = false;
    this.rangedSpawned = false; this.rangedDefeated = false;
  },
  update: function (elapsedSeconds) {
    if (!CONFIG.BOSS.ENABLED) return;
    // 远程Boss（480s 中Boss）：独立生成，不影响普通刷怪
    if (!this.rangedSpawned && elapsedSeconds >= CONFIG.BOSS.RANGED_SPAWN_TIME) {
      if (Enemy.activeCount >= CONFIG.ENEMY.POOL_SIZE) Enemy.recycleOneNonBoss();
      var ranged = Spawner.spawnType(CONFIG.ENEMY.TYPE_BOSS_RANGED, elapsedSeconds);
      if (ranged) this.rangedSpawned = true;
    }
    // 近战最终Boss
    if (this.spawned || elapsedSeconds < CONFIG.BOSS.SPAWN_TIME) return;
    if (Enemy.activeCount >= CONFIG.ENEMY.POOL_SIZE) Enemy.recycleOneNonBoss();
    var boss = Spawner.spawnType(CONFIG.ENEMY.TYPE_BOSS, elapsedSeconds);
    if (boss) this.spawned = true;
  },
  onBossDefeated: function () {
    if (this.defeated) return;
    this.defeated = true;
    Game.enterVictory();
  },
  onRangedBossDefeated: function () {
    this.rangedDefeated = true;
  }
};

// ---------- RunStats（本局统计） ----------
var RunStats = {
  kills: 0, pickedCoins: 0, finalCoins: 0, baseCoins: 0, greedBonus: 0,
  undoubledCoins: 0, committedCoins: 0,
  adRefreshUsed: 0, adReviveUsed: 0, adCoinDoubleUsed: 0, coinDoubleClaimed: false,
  extractBonus: false, extractAdClaimed: false,

  reset: function () {
    this.kills = 0; this.pickedCoins = 0; this.finalCoins = 0;
    this.baseCoins = 0; this.greedBonus = 0; this.undoubledCoins = 0;
    this.committedCoins = 0;
    this.adRefreshUsed = 0; this.adReviveUsed = 0; this.adCoinDoubleUsed = 0;
    this.coinDoubleClaimed = false;
    this.extractBonus = false; this.extractAdClaimed = false;
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

// ---------- Experience（经验晶石） ----------
var Experience = {
  pool: [], activeCount: 0,
  initPool: function () {
    this.pool.length = 0;
    for (var i = 0; i < CONFIG.EXPERIENCE.POOL_SIZE; i++) {
      this.pool.push({ active: false, x: 0, y: 0, value: 0, flying: false });
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
        gem.active = true; gem.x = x; gem.y = y;
        gem.value = value; gem.flying = false;
        this.activeCount += 1;
        return;
      }
    }
  },
  update: function (dt) {
    for (var i = 0; i < this.pool.length; i++) {
      var gem = this.pool[i];
      if (!gem.active) continue;
      var dx = Player.x - gem.x, dy = Player.y - gem.y;
      var distance = Math.hypot(dx, dy);
      if (!gem.flying && distance <= Player.pickupRadius) gem.flying = true;
      if (gem.flying) this.moveGem(gem, dx, dy, distance, dt);
    }
  },
  moveGem: function (gem, dx, dy, distance, dt) {
    if (distance <= CONFIG.EXPERIENCE.COLLECT_DISTANCE) {
      this.collectGem(gem);
      return;
    }
    if (distance > 0) {
      var moveDistance = Math.min(distance, CONFIG.EXPERIENCE.FLY_SPEED * dt);
      gem.x += dx / distance * moveDistance;
      gem.y += dy / distance * moveDistance;
    }
  },
  collectGem: function (gem) {
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
    var x = gem.x - Camera.x, y = gem.y - Camera.y;
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

// ---------- ExpLevelUp（经验与升级三选一） ----------
var ExpLevelUp = {
  level: 1, exp: 0, need: CONFIG.EXPERIENCE.BASE_NEED,
  pendingChoices: 0, levels: Object.create(null),
  offers: [], offerCount: 0, candidateIndices: [],

  init: function () {
    this.offers.length = 0;
    for (var i = 0; i < CONFIG.UPGRADES.OFFER_COUNT; i++) {
      this.offers.push({ definition: null, rarity: null, description: '', level: 0 });
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
    return Math.floor(CONFIG.EXPERIENCE.BASE_NEED *
      Math.pow(CONFIG.EXPERIENCE.NEED_GROWTH, level - 1));
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

  hasPendingChoice: function () { return this.pendingChoices > 0; },

  prepareOffers: function () {
    this.collectEligibleDefinitions();
    this.offerCount = Math.min(CONFIG.UPGRADES.OFFER_COUNT, this.candidateIndices.length);
    var legendarySeen = false;
    for (var i = 0; i < this.offerCount; i++) {
      var rarity = this.rollRarity();
      var matching = [];
      for (var c = 0; c < this.candidateIndices.length; c++) {
        var candidate = CONFIG.UPGRADES.DEFINITIONS[this.candidateIndices[c]];
        if ((candidate.RARITY && candidate.RARITY === rarity.ID) ||
            (!candidate.RARITY && (rarity.ID === 'COMMON' || rarity.ID === 'RARE'))) matching.push(c);
      }
      // 某档固定池已满时降级抽取，保证三张卡仍可正常生成。
      if (!matching.length) {
        rarity = CONFIG.UPGRADES.RARITIES[Math.random() < 0.6875 ? 0 : 1];
        for (var c = 0; c < this.candidateIndices.length; c++) {
          if (!CONFIG.UPGRADES.DEFINITIONS[this.candidateIndices[c]].RARITY) matching.push(c);
        }
      }
      if (!matching.length) { this.offerCount = i; break; }
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
    return this.offerCount > 0;
  },

  collectEligibleDefinitions: function () {
    this.candidateIndices.length = 0;
    for (var i = 0; i < CONFIG.UPGRADES.DEFINITIONS.length; i++) {
      if (this.isEligible(CONFIG.UPGRADES.DEFINITIONS[i])) this.candidateIndices.push(i);
    }
  },

  isEligible: function (definition) {
    if (this.levels[definition.ID] >= definition.MAX_LEVEL) return false;
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
    if (definition.EFFECT === 'PULSE_DAMAGE_PERCENT' || definition.EFFECT === 'FIRE_RATE' ||
        definition.EFFECT === 'MOVE_SPEED' || definition.EFFECT === 'CRIT_CHANCE') {
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

  getDiscreteAmount: function (amount, quality) { return Math.max(1, Math.round(amount * quality)); },
  toCleanNumber: function (value) { return Math.round(value * 10) / 10; },

  refreshOffersWithRareGuarantee: function () {
    if (!this.prepareOffers()) return false;
    var hasRareOrBetter = false;
    for (var i = 0; i < this.offerCount; i++) {
      if (this.offers[i].rarity.ID !== 'COMMON') { hasRareOrBetter = true; break; }
    }
    if (!hasRareOrBetter && this.offerCount > 0) {
      var guaranteedRarity = CONFIG.UPGRADES.RARITIES[1];
      this.offers[0].rarity = guaranteedRarity;
      this.offers[0].description = this.buildDescription(this.offers[0].definition, guaranteedRarity);
    }
    return true;
  },

  handleInput: function () {
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
      PulseGun.projectileCount = Math.min(CONFIG.WEAPONS.PULSE.MAX_PROJECTILES,
        PulseGun.projectileCount + this.getDiscreteAmount(amount, quality));
    } else if (definition.EFFECT === 'PENETRATION') {
      PulseGun.penetration = Math.min(CONFIG.WEAPONS.PULSE.MAX_PENETRATION,
        PulseGun.penetration + this.getDiscreteAmount(amount, quality));
    } else if (definition.EFFECT === 'PICKUP_RADIUS') {
      Player.pickupRadius = Math.min(CONFIG.EXPERIENCE.MAX_PICKUP_RADIUS, Player.pickupRadius + amount * quality);
    } else if (definition.EFFECT === 'PULSE_TUNE') {
      this.applyPulseTune(definition, quality);
    } else if (definition.EFFECT === 'BLADE_TUNE') {
      this.applyBladeTune(definition, quality);
    } else if (definition.EFFECT === 'BARRAGE') {
      PulseGun.fireRateBonus += 0.2; PulseGun.projectileCount += 1;
    } else if (definition.EFFECT === 'DEADLY') {
      Player.critChance = Math.min(CONFIG.PLAYER.MAX_CRIT_CHANCE, Player.critChance + 0.08);
      Player.critDamageBonus += 0.4;
    } else if (definition.EFFECT === 'HARVEST') {
      Player.killHeal += 2;
    } else if (definition.EFFECT === 'MAGNET_FIELD') {
      Player.pickupRadius *= 1.4; Player.expGainBonus += 0.15;
    } else if (definition.EFFECT === 'BLADE_STORM') {
      OrbitBlade.count += 1; OrbitBlade.speedBonus += 0.25;
    } else if (definition.EFFECT === 'ENERGY_SHIELD') {
      Player.upgradeShieldMax += Player.maxHp * 0.15;
      Player.shield = Player.upgradeShieldMax; Player.upgradeShieldRecharge = 12;
    } else if (definition.EFFECT === 'TIME_WARP') {
      PulseGun.cooldownMultiplier *= 0.85; OrbitBlade.cooldownMultiplier *= 0.85;
    } else if (definition.EFFECT === 'DUAL_WIELD') {
      PulseGun.projectileMultiplier = 2; PulseGun.damageMultiplier *= 0.85;
    } else if (definition.EFFECT === 'PHOENIX') {
      Player.phoenixReady = true;
    } else if (definition.EFFECT === 'ELEMENTAL') {
      Player.globalDamageBonus += 0.4; Player.incomingDamageMultiplier *= 1.15;
    } else if (definition.EFFECT === 'EXECUTE') {
      Player.executeChance = Math.min(0.5, Player.executeChance + 0.25);
    } else if (definition.EFFECT === 'TIME_LORD') {
      Player.enemySpeedMultiplier *= 0.85;
    } else if (definition.EFFECT === 'WAR_GOD') {
      Player.moveSpeedBonus += 0.25; Player.globalDamageBonus += 0.25; Player.pickupRadius *= 1.25;
    } else if (definition.EFFECT === 'LASER_CANNON') {
      PulseGun.laserCannon = true; PulseGun.damageMultiplier *= 1.8;
    }
  },

  applyPulseTune: function (definition, quality) {
    PulseGun.damageFlat += definition.DAMAGE * quality;
    PulseGun.speedFlat = Math.min(CONFIG.WEAPONS.PULSE.MAX_SPEED - CONFIG.WEAPONS.PULSE.SPEED,
      PulseGun.speedFlat + definition.SPEED * quality);
  },

  applyBladeTune: function (definition, quality) {
    OrbitBlade.damageFlat += definition.DAMAGE * quality;
    OrbitBlade.count = Math.min(CONFIG.WEAPONS.BLADE.MAX_COUNT,
      OrbitBlade.count + this.getDiscreteAmount(definition.COUNT, quality));
  }
};

// ---------- CoinDrops（金币掉落） ----------
var CoinDrops = {
  pool: [], activeCount: 0,
  initPool: function () {
    this.pool.length = 0;
    for (var i = 0; i < CONFIG.COIN.POOL_SIZE; i++) {
      this.pool.push({ active: false, x: 0, y: 0, value: 0, flying: false });
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
        coin.active = true; coin.x = x; coin.y = y;
        coin.value = value; coin.flying = false;
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
    for (var i = 0; i < this.pool.length; i++) {
      var coin = this.pool[i];
      if (!coin.active) continue;
      var dx = Player.x - coin.x, dy = Player.y - coin.y;
      var distance = Math.hypot(dx, dy);
      if (!coin.flying && distance <= CONFIG.COIN.PICKUP_RADIUS) coin.flying = true;
      if (coin.flying) this.moveCoin(coin, dx, dy, distance, dt);
    }
  },
  moveCoin: function (coin, dx, dy, distance, dt) {
    if (distance <= CONFIG.COIN.COLLECT_DISTANCE) {
      coin.active = false;
      this.activeCount -= 1;
      RunStats.pickedCoins += coin.value;
      return;
    }
    if (distance > 0) {
      var movement = Math.min(distance, CONFIG.COIN.FLY_SPEED * dt);
      coin.x += dx / distance * movement;
      coin.y += dy / distance * movement;
    }
  },
  draw: function (ctx) {
    for (var i = 0; i < this.pool.length; i++) {
      var coin = this.pool[i];
      if (!coin.active) continue;
      var x = coin.x - Camera.x, y = coin.y - Camera.y;
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

// ---------- PowerUps（即时道具） ----------
var PowerUps = {
  pool: [], inventory: [0, 0, 0, 0, 0, 0], freezeTimer: 0,

  initPool: function () {
    this.pool.length = 0;
    for (var i = 0; i < CONFIG.POWERUPS.POOL_SIZE; i++) {
      this.pool.push({ active: false, x: 0, y: 0, life: 0, typeIndex: 0 });
    }
  },

  reset: function () {
    this.freezeTimer = 0;
    for (var i = 0; i < this.pool.length; i++) this.pool[i].active = false;
    for (var i = 0; i < this.inventory.length; i++) this.inventory[i] = 0;
  },

  update: function (dt) {
    if (this.freezeTimer > 0) this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    var pickupDistanceSquared = CONFIG.POWERUPS.PICKUP_DISTANCE * CONFIG.POWERUPS.PICKUP_DISTANCE;
    for (var i = 0; i < this.pool.length; i++) {
      var item = this.pool[i];
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) { item.active = false; continue; }
      var dx = Player.x - item.x, dy = Player.y - item.y;
      if (dx * dx + dy * dy <= pickupDistanceSquared) this.collect(item);
    }
  },

  rollDrop: function (x, y, enemyTypeIndex) {
    if (enemyTypeIndex === CONFIG.ENEMY.TYPE_BOSS) return;
    if (enemyTypeIndex === CONFIG.ENEMY.TYPE_ELITE) {
      for (var i = 0; i < CONFIG.POWERUPS.ELITE_DROP_COUNT; i++) this.dropRandom(x, y);
      return;
    }
    var chance = enemyTypeIndex === CONFIG.ENEMY.TYPE_TANK
      ? CONFIG.POWERUPS.TANK_DROP_CHANCE : CONFIG.POWERUPS.NORMAL_DROP_CHANCE;
    if (Math.random() < chance) this.dropRandom(x, y);
  },

  dropRandom: function (x, y) { this.drop(x, y, this.rollType()); },

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
        item.active = true; item.x = x; item.y = y;
        item.life = CONFIG.POWERUPS.DROP_LIFE; item.typeIndex = typeIndex;
        return true;
      }
    }
    return false;
  },

  collect: function (item) {
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
    var used = false;
    if (typeIndex === CONFIG.POWERUPS.TYPE_BOMB) {
      this.useBomb(); used = true;
    } else if (typeIndex === CONFIG.POWERUPS.TYPE_MAGNET) {
      Experience.forceFlyAll(); CoinDrops.forceFlyAll(); used = true;
    } else if (typeIndex === CONFIG.POWERUPS.TYPE_MEDKIT) {
      used = this.useMedkit();
    } else if (typeIndex === CONFIG.POWERUPS.TYPE_FREEZE) {
      this.freezeTimer = CONFIG.POWERUPS.FREEZE_DURATION; used = true;
    } else if (typeIndex === CONFIG.POWERUPS.TYPE_LASER_EMITTER) {
      used = root.LaserEmitter.activate();
    } else if (typeIndex === CONFIG.POWERUPS.TYPE_MORTAR) {
      used = root.MortarStrike.activate();
    }
    if (used) this.inventory[typeIndex] -= 1;
    return used;
  },

  useBomb: function () {
    var margin = CONFIG.POWERUPS.BOMB_SCREEN_MARGIN;
    for (var i = 0; i < Enemy.pool.length; i++) {
      var enemy = Enemy.pool[i];
      if (!enemy.active) continue;
      var screenX = enemy.x - Camera.x, screenY = enemy.y - Camera.y;
      if (screenX < -margin || screenX > CONFIG.VIEW.WIDTH + margin ||
          screenY < -margin || screenY > CONFIG.VIEW.HEIGHT + margin) continue;
      var isStrong = enemy.typeIndex === CONFIG.ENEMY.TYPE_ELITE || enemy.typeIndex === CONFIG.ENEMY.TYPE_BOSS;
      var damage = isStrong ? CONFIG.POWERUPS.BOMB_ELITE_DAMAGE : CONFIG.POWERUPS.BOMB_DAMAGE;
      Combat.hitEnemyFixed(enemy, damage, enemy.x, enemy.y);
    }
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

  isFrozen: function () { return this.freezeTimer > 0; },

  drawWorldItems: function (ctx) {
    for (var i = 0; i < this.pool.length; i++) {
      var item = this.pool[i];
      if (!item.active) continue;
      var x = item.x - Camera.x, y = item.y - Camera.y;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, CONFIG.UI.WORLD_ITEM_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.COLORS.ITEM_BASE;
      ctx.fill();
      ctx.lineWidth = CONFIG.UI.WORLD_ITEM_OUTLINE;
      ctx.strokeStyle = CONFIG.COLORS.ITEM_BORDER;
      ctx.stroke();
      UI.drawPowerUpIcon(ctx, item.typeIndex, x, y, CONFIG.UI.POWERUP_ICON_SIZE);
      ctx.restore();
    }
  }
};

root.Spawner = Spawner;
root.BossSystem = BossSystem;
root.RunStats = RunStats;
root.Experience = Experience;
root.ExpLevelUp = ExpLevelUp;
root.CoinDrops = CoinDrops;
root.PowerUps = PowerUps;

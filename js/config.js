(function () {
  'use strict';

  // ============================================================
  // Config（配置）：所有可调数值、颜色和界面文案集中在这里
  // 包含 M1~M5 基础配置 + M6 表现层覆盖
  // #56 小目标HUD优化 / #57 冲刺键与道具栏（4槽固定）
  // #58 词条 weapon 归属标记（all/blade/pistol/flamer/crossbow）
  // #59 激光旋转加速参数 SPIN_START_RPS/SPIN_MAX_RPS/SPIN_RAMP_TIME
  // ============================================================
  var root = typeof window !== 'undefined' ? window : global;

  // CanvasGradient 安全入口：微信 iOS 遇到非法渐变参数会直接抛原生异常。
  root.safeStop = function (gradient, offset, color) {
    if (!gradient || typeof gradient.addColorStop !== 'function') return;
    var safeOffset = Number(offset);
    if (!isFinite(safeOffset)) safeOffset = 0;
    safeOffset = Math.max(0, Math.min(1, safeOffset));
    var safeColor = typeof color === 'string' && color.trim() ? color : '#BDC3C7';
    try {
      gradient.addColorStop(safeOffset, safeColor);
    } catch (error) {
      try {
        gradient.addColorStop(safeOffset, '#BDC3C7');
      } catch (ignored) {}
    }
  };
  var CONFIG = {
    VIEW: {
      WIDTH: 750,
      HEIGHT: 1334
    },
    WORLD: {
      WIDTH: 2400,
      HEIGHT: 2400
    },
    TIME: {
      MAX_DT: 0.05
    },
    GRID: {
      SIZE: 100,
      MAJOR_EVERY: 5,
      THIN_LINE_WIDTH: 2,
      MAJOR_LINE_WIDTH: 4,
      BORDER_WIDTH: 10
    },
    PLAYER: {
      RADIUS: 28,
      SPEED: 170,
      MAX_SPEED: 320,
      MAX_HP: 100,
      MAX_HP_LIMIT: 400,
      HIT_DAMAGE: 10,
      INVINCIBLE_TIME: 0.6,
      FLASH_INTERVAL: 0.08,
      OUTLINE_WIDTH: 6,
      START_X: 1200,
      START_Y: 1200,
      BASE_CRIT_CHANCE: 0.05,
      MAX_CRIT_CHANCE: 0.5,
      CRIT_MULTIPLIER: 1.5,
      // 受击反馈
      HIT_SCALE_TIME: 0.2,
      HIT_SCALE_X: 1.15,
      HIT_SCALE_Y: 0.7,
      HIT_SHAKE_TIME: 0.15,
      HIT_SHAKE_OFFSET: 2,
      // 冲刺（Dash）
      DASH_DURATION: 1.0,
      DASH_SPEED_MULTIPLIER: 2.0,
      DASH_COOLDOWN: 10.0,
      DASH_EASE_TIME: 0.1,
      DASH_ARROW_TIME: 0.25,
      DASH_ARROW_LENGTH: 30,
      DASH_ARROW_COLOR: '#4CAF50',
      DASH_TRAIL_INTERVAL: 0.08,
      DASH_TRAIL_LIFE: 0.3,
      DASH_TRAIL_MAX: 5,
      DASH_TRAIL_ALPHA: 0.4,
      DASH_SCALE_TIME: 0.15,
      DASH_STRETCH_X: 1.3,
      DASH_STRETCH_Y: 0.8,
      DASH_READY_FLASH: 0.2,
      DASH_DUST_INTERVAL: 0.1
    },
    ENEMY: {
      POOL_SIZE: 260,
      OUTLINE_WIDTH: 5,
      TYPE_WALKER: 0,
      TYPE_RUNNER: 1,
      TYPE_TANK: 2,
      TYPE_ELITE: 3,
      TYPE_BOSS: 4,
      TYPE_BOSS_RANGED: 5,
      TYPES: [{
        ID: 'WALKER',
        HP: 30,
        SPEED: 82,
        RADIUS: 24,
        DAMAGE: 10,
        EXP: 1,
        COINS: 0,
        FILL_KEY: 'WALKER',
        OUTLINE_KEY: 'WALKER_OUTLINE',
        GLOW_KEY: 'WALKER_GLOW'
      }, {
        ID: 'RUNNER',
        HP: 20,
        SPEED: 145,
        RADIUS: 18,
        DAMAGE: 8,
        EXP: 1,
        COINS: 0,
        FILL_KEY: 'RUNNER',
        OUTLINE_KEY: 'RUNNER_OUTLINE',
        GLOW_KEY: 'RUNNER_GLOW'
      }, {
        ID: 'TANK',
        HP: 80,
        SPEED: 50,
        RADIUS: 36,
        DAMAGE: 18,
        EXP: 3,
        COINS: 0,
        FILL_KEY: 'TANK',
        OUTLINE_KEY: 'TANK_OUTLINE',
        GLOW_KEY: 'TANK_GLOW'
      }, {
        ID: 'ELITE',
        HP: 220,
        SPEED: 72,
        RADIUS: 48,
        DAMAGE: 22,
        EXP: 24,
        COINS: 30,
        FILL_KEY: 'ELITE',
        OUTLINE_KEY: 'ELITE_OUTLINE',
        GLOW_KEY: 'ELITE_GLOW'
      }, {
        ID: 'BOSS',
        HP: 1200,
        SPEED: 58,
        RADIUS: 78,
        DAMAGE: 30,
        EXP: 0,
        COINS: 0,
        FILL_KEY: 'BOSS',
        OUTLINE_KEY: 'BOSS_OUTLINE',
        GLOW_KEY: 'BOSS_GLOW'
      }, {
        ID: 'BOSS_RANGED',
        HP: 660,
        SPEED: 35,
        RADIUS: 40,
        DAMAGE: 25,
        EXP: 50,
        COINS: 200,
        FILL_KEY: 'BOSS_RANGED',
        OUTLINE_KEY: 'BOSS_RANGED_OUTLINE',
        GLOW_KEY: 'BOSS_RANGED_GLOW'
      }]
    },
    SPAWNER: {
      START_INTERVAL: 1.2,
      MIN_INTERVAL: 0.3,
      INTERVAL_TIME_DIVISOR: 200,
      FIRST_SPAWN_DELAY: 1.2,
      HP_TIME_DIVISOR: 90,
      WAVE_INTERVAL: 30,
      WAVE_BASE_COUNT: 3,
      ELITE_INTERVAL: 60,
      OUTSIDE_MARGIN: 90,
      WALKER_BASE_WEIGHT: 7,
      RUNNER_BASE_WEIGHT: 2,
      TANK_BASE_WEIGHT: 1,
      WALKER_WAVE_DECAY: 0.12,
      RUNNER_WAVE_GROWTH: 0.07,
      TANK_WAVE_GROWTH: 0.05,
      WALKER_MIN_WEIGHT: 3
    },
    BOSS: {
      ENABLED: true,
      SPAWN_TIME: 600,
      RANGED_SPAWN_TIME: 480,
      BAR_WIDTH: 610,
      BAR_HEIGHT: 25,
      BAR_Y: 174,
      BAR_GAP: 30
    },
    // 远程Boss——畸变炮台者
    BOSS_RANGED: {
      ATTACK_INTERVAL: 5,
      CHARGE_TIME: 1.5,
      PROJECTILE_RADIUS: 20,
      PROJECTILE_SPEED: 160,
      PROJECTILE_DAMAGE: 30,
      EXPLOSION_RADIUS: 100,
      EXPLOSION_DAMAGE: 30,
      EXPLOSION_TIME: 0.3,
      PROJECTILE_POOL: 24,
      AIM_LINE_WIDTH: 3,
      AIM_DASH: 8,
      DROP_GEMS: 8,
      TURRET_RADIUS: 18
    },
    WEAPONS: {
      PULSE: {
        INTERVAL: 0.75,
        MIN_INTERVAL: 0.18,
        DAMAGE: 12,
        SPEED: 460,
        MAX_SPEED: 900,
        LIFE: 1.1,
        RADIUS: 9,
        DRAW_RADIUS: 8,
        TRAIL_LENGTH: 24,
        TRAIL_WIDTH: 7,
        SPREAD_ANGLE: 0.16,
        BASE_PROJECTILES: 1,
        MAX_PROJECTILES: 7,
        BASE_PENETRATION: 0,
        MAX_PENETRATION: 6,
        POOL_SIZE: 180
      },
      BLADE: {
        DAMAGE: 8,
        HIT_COOLDOWN: 0.4,
        COUNT: 1,
        MAX_COUNT: 9,
        ORBIT_RADIUS: 105,
        ANGULAR_SPEED: 3.25,
        HIT_RADIUS: 24,
        LENGTH: 58,
        WIDTH: 24,
        OUTLINE_WIDTH: 4
      }
    },
    EXPERIENCE: {
      BASE_NEED: 5,
      NEED_GROWTH: 1.16,
      GEM_VALUE: 1,
      PICKUP_RADIUS: 70,
      MAX_PICKUP_RADIUS: 370,
      COLLECT_DISTANCE: 22,
      FLY_SPEED: 560,
      GEM_RADIUS: 11,
      GEM_LENGTH: 26,
      GEM_WIDTH: 17,
      OUTLINE_WIDTH: 3,
      POOL_SIZE: 420
    },
    DAMAGE_TEXT: {
      POOL_SIZE: 220,
      LIFE: 0.68,
      RISE_SPEED: 62,
      RANDOM_X: 12,
      NORMAL_SIZE: 27,
      CRIT_SIZE: 36,
      SHADOW_BLUR: 7
    },
    COIN: {
      POOL_SIZE: 40,
      PICKUP_RADIUS: 90,
      COLLECT_DISTANCE: 24,
      FLY_SPEED: 620,
      RADIUS: 15,
      OUTLINE_WIDTH: 4
    },
    POWERUPS: {
      POOL_SIZE: 48,
      NORMAL_DROP_CHANCE: 0.055,
      TANK_DROP_CHANCE: 0.09,
      ELITE_DROP_COUNT: 1,
      DROP_LIFE: 35,
      PICKUP_DISTANCE: 48,
      MAX_INVENTORY_EACH: 3,
      BOMB_DAMAGE: 9999,
      BOMB_ELITE_DAMAGE: 260,
      BOMB_SCREEN_MARGIN: 80,
      MEDKIT_HEAL: 40,
      MEDKIT_HEAL_RATIO: 0.35,
      FREEZE_DURATION: 5,
      // v008 #56：全屏激光已并入激光发射器，道具共 6 种。
      // 0炸弹 1磁铁 2血包 3冻结 4激光发射器 5迫击炮（激光/迫击炮权重略低）
      // #57 道具栏只保留 4 槽（炸弹/激光/磁铁/血包），冻结/迫击炮不进栏，随机掉落权重置 0。
      DROP_WEIGHTS: [1, 1, 1, 0, 0.7, 0],
      MAX_INVENTORY_OVERRIDE: {
        4: 1
      },
      TYPE_BOMB: 0,
      TYPE_MAGNET: 1,
      TYPE_MEDKIT: 2,
      TYPE_FREEZE: 3,
      TYPE_LASER_EMITTER: 4,
      TYPE_MORTAR: 5,
      // #57 主动磁铁：点击后全图高速吸附 N 秒
      MAGNET_DURATION: 3,
      MAGNET_PULL_SPEED: 950,
      // #57 道具栏固定槽位（从上到下）：炸弹 → 激光 → 磁铁 → 血包
      BAR_SLOTS: [0, 4, 1, 2]
    },
    LASER_EMITTER: {
      BASE_DURATION: 2,
      BASE_WIDTH: 40,
      TICK_INTERVAL: 0.1,
      DAMAGE_MULTIPLIER: 3,
      RANGE: 2000,
      OVERLOAD_RADIUS: 150,
      OVERLOAD_RATIO: 0.3,
      COOLDOWN: 5,
      // #59 旋转速度：激活瞬间 0.8 圈/秒，SPIN_RAMP_TIME 秒内 ease-out 加速到 SPIN_MAX_RPS
      SPIN_START_RPS: 0.8,
      SPIN_MAX_RPS: 5,
      SPIN_RAMP_TIME: 1.5
    },
    MORTAR: {
      BASE_COUNT: 3,
      BASE_RADIUS: 80,
      DAMAGE_MULTIPLIER: 8,
      WARNING_TIME: 1,
      SHELL_FLIGHT_TIME: 0.8,
      FALL_HEIGHT: 500,
      SALVO_INTERVAL: 0.5,
      GRID_SIZE: 200,
      SHELL_RADIUS: 10,
      BURN_DURATION: 3,
      BURN_DPS_RATIO: 0.1,
      FULLCOVER_EXTRA: 2
    },
    EXTRACTION: {
      X: 1200,
      Y: 1200,
      RADIUS: 120,
      ACTIVATE_TIME: 10,
      EXTRACT_HOLD_TIME: 1.5,
      FADE_DURATION: 0.8,
      TEXT_DURATION: 1.5,
      REWARD_MULTIPLIER: 2,
      AD_MULTIPLIER: 2
    },
    BOUNDARY: {
      BORDER_WIDTH: 8,
      PULSE_PERIOD: 2,
      OUTSIDE_EXTEND: 50,
      STRIPE_SPACING: 12,
      WARNING_DISTANCE: 150,
      WARNING_WIDTH: 80,
      CORNER_RUIN_RADIUS: 80,
      DIM_ALPHA: 0.4
    },
    REWARDS: {
      SECONDS_PER_COIN: 10,
      COINS_PER_KILL: 1,
      COINS_PER_LEVEL: 3,
      VICTORY_BONUS: 500
    },
    META: {
      PRICE_POWER: 1.4,
      OFFLINE_BASE_PER_MINUTE: 10,
      OFFLINE_MAX_HOURS: 12,
      GREED_RATE_PER_LEVEL: 0.08,
      SPEEDUP_MINUTES: 120,
      SPEEDUP_COOLDOWN_MS: 1800000,
      IMMORTAL_HP_RATIO: 0.35,
      IMMORTAL_INVINCIBLE_TIME: 2,
      UPGRADES: [{
        ID: 'ROBUST',
        NAME: '强健体魄',
        DESC: '每级最大生命 +10',
        BASE: 60,
        MAX_LEVEL: 10,
        EFFECT: 'MAX_HP',
        AMOUNT: 10
      }, {
        ID: 'MASTERY',
        NAME: '武器精通',
        DESC: '每级所有武器伤害 +5%',
        BASE: 85,
        MAX_LEVEL: 10,
        EFFECT: 'WEAPON_DAMAGE',
        AMOUNT: 0.05
      }, {
        ID: 'LIGHT',
        NAME: '轻便装备',
        DESC: '每级移动速度 +3%',
        BASE: 60,
        MAX_LEVEL: 10,
        EFFECT: 'MOVE_SPEED',
        AMOUNT: 0.03
      }, {
        ID: 'GREED',
        NAME: '贪婪之心',
        DESC: '每级结算和放置金币 +8%',
        BASE: 100,
        MAX_LEVEL: 10,
        EFFECT: 'GREED',
        AMOUNT: 0.08
      }, {
        ID: 'MAGNET',
        NAME: '强力磁吸',
        DESC: '每级拾取范围 +15px',
        BASE: 55,
        MAX_LEVEL: 10,
        EFFECT: 'PICKUP_RADIUS',
        AMOUNT: 15
      }, {
        ID: 'LEARNING',
        NAME: '快速领悟',
        DESC: '每级经验获取 +5%',
        BASE: 90,
        MAX_LEVEL: 10,
        EFFECT: 'EXP_GAIN',
        AMOUNT: 0.05
      }, {
        ID: 'HEADSTART',
        NAME: '先发制人',
        DESC: '每级使开局等级 +1',
        BASE: 180,
        MAX_LEVEL: 5,
        EFFECT: 'START_LEVEL',
        AMOUNT: 1
      }, {
        ID: 'ADVANCED',
        NAME: '进阶军械',
        DESC: '每级开局脉冲子弹 +1',
        BASE: 300,
        MAX_LEVEL: 3,
        EFFECT: 'START_PROJECTILE',
        AMOUNT: 1
      }, {
        ID: 'IMMORTAL',
        NAME: '不灭意志',
        DESC: '每级每局多复活 1 次',
        BASE: 450,
        MAX_LEVEL: 3,
        EFFECT: 'REVIVE',
        AMOUNT: 1
      }],
      // 道具强化升级树（激光 / 血包 / 迫击炮）。价格公式沿用 price = round(BASE × (等级+1)^1.4)
      GADGET_UPGRADES: {
        laser: {
          NAME: '激光发射器',
          items: [{
            ID: 'dmg',
            NAME: '能量增幅',
            DESC: '激光伤害 +15%',
            BASE: 80,
            MAX_LEVEL: 5,
            AMOUNT: 0.15
          }, {
            ID: 'duration',
            NAME: '持续照射',
            DESC: '激光持续时间 +0.3s',
            BASE: 70,
            MAX_LEVEL: 5,
            AMOUNT: 0.3
          }, {
            ID: 'width',
            NAME: '光束扩展',
            DESC: '激光宽度 +10px',
            BASE: 60,
            MAX_LEVEL: 3,
            AMOUNT: 10
          }, {
            ID: 'cooldown',
            NAME: '快速充能',
            DESC: '道具刷新间隔 -12%',
            BASE: 100,
            MAX_LEVEL: 3,
            AMOUNT: 0.12
          }, {
            ID: 'overload',
            NAME: '过载爆发',
            DESC: '结束爆炸范围总伤害30%',
            BASE: 300,
            MAX_LEVEL: 1,
            AMOUNT: 0.3
          }]
        },
        medkit: {
          NAME: '急救血包',
          items: [{
            ID: 'heal',
            NAME: '高效药剂',
            DESC: '回血比例 +8%',
            BASE: 60,
            MAX_LEVEL: 5,
            AMOUNT: 0.08
          }, {
            ID: 'shield',
            NAME: '应急护盾',
            DESC: '回血值20%护盾(上限20%生命)',
            BASE: 100,
            MAX_LEVEL: 3,
            AMOUNT: 0.2
          }, {
            ID: 'regen',
            NAME: '持续恢复',
            DESC: '5秒内每秒回复3%生命',
            BASE: 80,
            MAX_LEVEL: 3,
            AMOUNT: 0.03
          }, {
            ID: 'auto',
            NAME: '自动急救',
            DESC: '血量低于25%自动使用1次',
            BASE: 250,
            MAX_LEVEL: 1,
            AMOUNT: 0.25
          }, {
            ID: 'holy',
            NAME: '神圣治愈',
            DESC: '使用时2秒无敌清负面',
            BASE: 350,
            MAX_LEVEL: 1,
            AMOUNT: 2
          }]
        },
        mortar: {
          NAME: '迫击炮空袭',
          items: [{
            ID: 'damage',
            NAME: '高爆弹头',
            DESC: '爆炸伤害 +20%',
            BASE: 80,
            MAX_LEVEL: 5,
            AMOUNT: 0.2
          }, {
            ID: 'count',
            NAME: '密集轰炸',
            DESC: '炮弹数量 +1',
            BASE: 120,
            MAX_LEVEL: 3,
            AMOUNT: 1
          }, {
            ID: 'radius',
            NAME: '扩大杀伤',
            DESC: '爆炸半径 +20px',
            BASE: 70,
            MAX_LEVEL: 3,
            AMOUNT: 20
          }, {
            ID: 'burn',
            NAME: '燃烧效应',
            DESC: '爆炸后燃烧3秒每秒10%',
            BASE: 150,
            MAX_LEVEL: 2,
            AMOUNT: 0.1
          }, {
            ID: 'fullcover',
            NAME: '全覆盖打击',
            DESC: '炮弹+2优先追踪精英/Boss',
            BASE: 400,
            MAX_LEVEL: 1,
            AMOUNT: 2
          }]
        }
      }
    },
    ADS: {
      H5_DURATION_MS: 1500,
      MAX_REFRESHES_PER_RUN: 3,
      MAX_REVIVES_PER_RUN: 2,
      MAX_COIN_DOUBLES_PER_RUN: 1,
      REVIVE_HP_RATIO: 0.5,
      REVIVE_INVINCIBLE_TIME: 3,
      // 微信激励视频广告位 ID（占位，上线前替换为真实广告位）
      AD_UNIT_ID: 'adunit-xxxx',
      PLACEMENT_LEVEL_REFRESH: 'level_refresh',
      PLACEMENT_REVIVE: 'settlement_revive',
      PLACEMENT_COIN_DOUBLE: 'settlement_coin_double',
      PLACEMENT_OFFLINE_DOUBLE: 'offline_double',
      PLACEMENT_SPEEDUP: 'menu_speedup',
      PLACEMENT_CARD_SHUFFLE: 'card_shuffle'
    },
    INPUT: {
      JOYSTICK_ZONE_X_RATIO: 0.62,
      JOYSTICK_ZONE_Y_RATIO: 0.52,
      JOYSTICK_MAX_RADIUS: 92,
      JOYSTICK_BASE_RADIUS: 98,
      JOYSTICK_KNOB_RADIUS: 42,
      JOYSTICK_DEAD_ZONE: 0.08,
      JOYSTICK_LINE_WIDTH: 5
    },
    UPGRADES: {
      OFFER_COUNT: 3,
      RARITIES: [{
        ID: 'COMMON',
        WEIGHT: 55,
        MULTIPLIER: 1,
        COLOR_KEY: 'RARITY_COMMON'
      }, {
        ID: 'RARE',
        WEIGHT: 25,
        MULTIPLIER: 1.5,
        COLOR_KEY: 'RARITY_RARE'
      }, {
        ID: 'EPIC',
        WEIGHT: 12,
        MULTIPLIER: 1,
        COLOR_KEY: 'RARITY_EPIC'
      }, {
        ID: 'LEGENDARY',
        WEIGHT: 8,
        MULTIPLIER: 1,
        COLOR_KEY: 'RARITY_LEGENDARY'
      }],
      // #58 weapon 字段：all=通用词条，blade=副武器飞刃词条，pistol/flamer/crossbow=对应主武器专属词条。
      // 抽卡器按本局主武器 WeaponProgress.selected 过滤：保留 all + blade + 当前主武器。
      DEFINITIONS: [{
        ID: 'POWER',
        TEXT_KEY: 'POWER',
        EFFECT: 'PULSE_DAMAGE_PERCENT',
        AMOUNT: 0.18,
        MAX_LEVEL: 5,
        weapon: 'pistol'
      }, {
        ID: 'RAPID',
        TEXT_KEY: 'RAPID',
        EFFECT: 'FIRE_RATE',
        AMOUNT: 0.12,
        MAX_LEVEL: 5,
        weapon: 'pistol'
      }, {
        ID: 'SPRINT',
        TEXT_KEY: 'SPRINT',
        EFFECT: 'MOVE_SPEED',
        AMOUNT: 0.08,
        MAX_LEVEL: 5,
        weapon: 'all'
      }, {
        ID: 'VITALITY',
        TEXT_KEY: 'VITALITY',
        EFFECT: 'MAX_HP',
        AMOUNT: 20,
        MAX_LEVEL: 5,
        weapon: 'all'
      }, {
        ID: 'SHARP',
        TEXT_KEY: 'SHARP',
        EFFECT: 'CRIT_CHANCE',
        AMOUNT: 0.03,
        MAX_LEVEL: 5,
        weapon: 'all'
      }, {
        ID: 'MULTI',
        TEXT_KEY: 'MULTI',
        EFFECT: 'MULTISHOT',
        AMOUNT: 1,
        MAX_LEVEL: 3,
        weapon: 'pistol'
      }, {
        ID: 'PIERCE',
        TEXT_KEY: 'PIERCE',
        EFFECT: 'PENETRATION',
        AMOUNT: 1,
        MAX_LEVEL: 3,
        weapon: 'pistol'
      }, {
        ID: 'MAGNET',
        TEXT_KEY: 'MAGNET',
        EFFECT: 'PICKUP_RADIUS',
        AMOUNT: 30,
        MAX_LEVEL: 5,
        weapon: 'all'
      }, {
        ID: 'PULSE_TUNE',
        TEXT_KEY: 'PULSE_TUNE',
        EFFECT: 'PULSE_TUNE',
        DAMAGE: 3,
        SPEED: 40,
        MAX_LEVEL: 5,
        weapon: 'pistol'
      }, {
        ID: 'BLADE_TUNE',
        TEXT_KEY: 'BLADE_TUNE',
        EFFECT: 'BLADE_TUNE',
        DAMAGE: 2,
        COUNT: 1,
        MAX_LEVEL: 4,
        weapon: 'blade'
      }, {
        ID: 'BARRAGE',
        TEXT_KEY: 'BARRAGE',
        RARITY: 'EPIC',
        EFFECT: 'BARRAGE',
        MAX_LEVEL: 3,
        weapon: 'pistol'
      }, {
        ID: 'DEADLY',
        TEXT_KEY: 'DEADLY',
        RARITY: 'EPIC',
        EFFECT: 'DEADLY',
        MAX_LEVEL: 3,
        weapon: 'all'
      }, {
        ID: 'HARVEST',
        TEXT_KEY: 'HARVEST',
        RARITY: 'EPIC',
        EFFECT: 'HARVEST',
        MAX_LEVEL: 5,
        weapon: 'all'
      }, {
        ID: 'MAGNET_FIELD',
        TEXT_KEY: 'MAGNET_FIELD',
        RARITY: 'EPIC',
        EFFECT: 'MAGNET_FIELD',
        MAX_LEVEL: 3,
        weapon: 'all'
      }, {
        ID: 'BLADE_STORM',
        TEXT_KEY: 'BLADE_STORM',
        RARITY: 'EPIC',
        EFFECT: 'BLADE_STORM',
        MAX_LEVEL: 3,
        weapon: 'blade'
      }, {
        ID: 'ENERGY_SHIELD',
        TEXT_KEY: 'ENERGY_SHIELD',
        RARITY: 'EPIC',
        EFFECT: 'ENERGY_SHIELD',
        MAX_LEVEL: 3,
        weapon: 'all'
      }, {
        ID: 'TIME_WARP',
        TEXT_KEY: 'TIME_WARP',
        RARITY: 'EPIC',
        EFFECT: 'TIME_WARP',
        MAX_LEVEL: 3,
        weapon: 'all'
      }, {
        ID: 'DUAL_WIELD',
        TEXT_KEY: 'DUAL_WIELD',
        RARITY: 'LEGENDARY',
        EFFECT: 'DUAL_WIELD',
        MAX_LEVEL: 1,
        weapon: 'pistol'
      }, {
        ID: 'PHOENIX',
        TEXT_KEY: 'PHOENIX',
        RARITY: 'LEGENDARY',
        EFFECT: 'PHOENIX',
        MAX_LEVEL: 1,
        weapon: 'all'
      }, {
        ID: 'ELEMENTAL',
        TEXT_KEY: 'ELEMENTAL',
        RARITY: 'LEGENDARY',
        EFFECT: 'ELEMENTAL',
        MAX_LEVEL: 1,
        weapon: 'all'
      }, {
        ID: 'EXECUTE',
        TEXT_KEY: 'EXECUTE',
        RARITY: 'LEGENDARY',
        EFFECT: 'EXECUTE',
        MAX_LEVEL: 2,
        weapon: 'pistol'
      }, {
        ID: 'TIME_LORD',
        TEXT_KEY: 'TIME_LORD',
        RARITY: 'LEGENDARY',
        EFFECT: 'TIME_LORD',
        MAX_LEVEL: 1,
        weapon: 'all'
      }, {
        ID: 'WAR_GOD',
        TEXT_KEY: 'WAR_GOD',
        RARITY: 'LEGENDARY',
        EFFECT: 'WAR_GOD',
        MAX_LEVEL: 1,
        weapon: 'all'
      }, {
        ID: 'LASER_CANNON',
        TEXT_KEY: 'LASER_CANNON',
        RARITY: 'LEGENDARY',
        EFFECT: 'LASER_CANNON',
        MAX_LEVEL: 1,
        weapon: 'pistol'
      }]
    },
    UI: {
      HP_BAR_X: 32,
      HP_BAR_Y: 28,
      HP_BAR_WIDTH: 686,
      HP_BAR_HEIGHT: 34,
      HP_BAR_RADIUS: 14,
      HP_BAR_BORDER: 4,
      HP_TEXT_SIZE: 22,
      EXP_BAR_X: 32,
      EXP_BAR_Y: 78,
      EXP_BAR_WIDTH: 548,
      EXP_BAR_HEIGHT: 24,
      EXP_BAR_RADIUS: 10,
      EXP_BAR_BORDER: 3,
      EXP_TEXT_SIZE: 18,
      LEVEL_X: 595,
      LEVEL_Y: 72,
      LEVEL_WIDTH: 123,
      LEVEL_HEIGHT: 38,
      LEVEL_RADIUS: 13,
      LEVEL_TEXT_SIZE: 22,
      HINT_Y: 137,
      HINT_TEXT_SIZE: 20,
      HUD_STATS_Y: 137,
      HUD_STATS_SIZE: 23,
      GAMEOVER_TITLE_Y: 225,
      GAMEOVER_TITLE_SIZE: 76,
      VICTORY_SUBTITLE_Y: 305,
      SETTLEMENT_START_Y: 385,
      SETTLEMENT_LINE_GAP: 65,
      SETTLEMENT_TEXT_SIZE: 34,
      SETTLEMENT_COIN_SIZE: 46,
      RESTART_X: 170,
      RESTART_Y: 1030,
      RESTART_WIDTH: 410,
      RESTART_HEIGHT: 104,
      RESTART_RADIUS: 24,
      RESTART_BORDER: 5,
      RESTART_TEXT_SIZE: 38,
      OVERLAY_ALPHA: 0.76,
      LEVELUP_TITLE_Y: 150,
      LEVELUP_TITLE_SIZE: 52,
      LEVELUP_SUBTITLE_Y: 202,
      LEVELUP_SUBTITLE_SIZE: 23,
      CARD_X: 45,
      CARD_START_Y: 255,
      CARD_WIDTH: 660,
      CARD_HEIGHT: 235,
      CARD_GAP: 26,
      CARD_RADIUS: 25,
      CARD_BORDER: 7,
      CARD_NAME_X_OFFSET: 34,
      CARD_NAME_Y_OFFSET: 52,
      CARD_NAME_SIZE: 36,
      CARD_RARITY_Y_OFFSET: 102,
      CARD_RARITY_SIZE: 23,
      CARD_LEVEL_RIGHT_OFFSET: 32,
      CARD_DESC_Y_OFFSET: 161,
      CARD_DESC_SIZE: 27,
      CARD_HINT_Y: 1050,
      CARD_HINT_SIZE: 23,
      LEVEL_REFRESH_X: 170,
      LEVEL_REFRESH_Y: 1120,
      LEVEL_REFRESH_WIDTH: 410,
      LEVEL_REFRESH_HEIGHT: 82,
      SETTLEMENT_AD_Y: 790,
      SETTLEMENT_AD_WIDTH: 310,
      SETTLEMENT_AD_HEIGHT: 92,
      SETTLEMENT_AD_LEFT_X: 45,
      SETTLEMENT_AD_RIGHT_X: 395,
      POWERUP_BUTTON_X: 596,
      POWERUP_BUTTON_WIDTH: 130,
      POWERUP_BUTTON_HEIGHT: 74,
      POWERUP_BUTTON_BOTTOM: 24,
      POWERUP_BUTTON_GAP: 10,
      POWERUP_BUTTON_RADIUS: 18,
      POWERUP_BUTTON_BORDER: 4,
      POWERUP_ICON_SIZE: 24,
      POWERUP_TEXT_SIZE: 18,
      POWERUP_COUNT_SIZE: 18,
      WORLD_ITEM_RADIUS: 25,
      WORLD_ITEM_OUTLINE: 4,
      MENU_BUTTON_X: 145,
      MENU_BUTTON_WIDTH: 460,
      MENU_BUTTON_HEIGHT: 92,
      MENU_BUTTON_START_Y: 570,
      MENU_BUTTON_GAP: 32,
      MENU_HINT_Y: 1030,
      BASE_CARD_X: 28,
      BASE_CARD_START_Y: 188,
      BASE_CARD_WIDTH: 694,
      BASE_CARD_HEIGHT: 103,
      BASE_CARD_GAP: 11,
      BASE_BUY_WIDTH: 174,
      BASE_BUY_HEIGHT: 62,
      BASE_BACK_X: 28,
      BASE_BACK_Y: 38,
      BASE_BACK_WIDTH: 132,
      BASE_BACK_HEIGHT: 64,
      POPUP_X: 55,
      POPUP_Y: 355,
      POPUP_WIDTH: 640,
      POPUP_HEIGHT: 560,
      POPUP_BUTTON_WIDTH: 250,
      POPUP_BUTTON_HEIGHT: 82,
      AD_PANEL_X: 100,
      AD_PANEL_Y: 490,
      AD_PANEL_WIDTH: 550,
      AD_PANEL_HEIGHT: 300,
      // 营地 Tab 栏
      BASE_TAB_Y: 196,
      BASE_TAB_HEIGHT: 54,
      BASE_TAB_WIDTH: 330,
      BASE_TAB_GAP: 24,
      BASE_TAB_FADE_TIME: 0.2,
      BASE_CONTENT_OFFSET: 76,
      GADGET_HEADER_H: 40,
      GADGET_ITEM_H: 54,
      GADGET_GROUP_GAP: 14,
      // 基地新版分页布局：每页 5 项，避免不同高度手机发生遮挡
      BASE_VISIBLE_ROWS: 5,
      BASE_SECTION_HEIGHT: 92,
      BASE_ROW_GAP: 12,
      BASE_PAGER_HEIGHT: 58,
      BASE_PAGER_GAP: 16,
      BASE_NAV_WIDTH: 82,
      BASE_NAV_HEIGHT: 58,
      // 冲刺按钮（#57：独立圆形大按钮，直径 90，位于道具栏左下方，固定不随相机）
      DASH_BUTTON_X: 581,
      DASH_BUTTON_RADIUS: 45,
      DASH_BUTTON_ABOVE: 20,
      DASH_COOLDOWN_ALPHA: 0.55,
      DASH_GAP: 20,
      // #57 道具栏：屏幕右下角竖排 4 固定槽（74×74，间距 16）
      SLOT_SIZE: 74,
      SLOT_GAP: 16,
      ITEM_BAR_RIGHT_M: 20,
      ITEM_BAR_BOTTOM_M: 24,
      ITEM_BAR_X: 656,
      ITEM_BAR_TOP: 0,
      ITEM_BAR_BOTTOM: 0,
      DASH_CENTER_Y: 0,
      DASH_CY: 0,
      // #56 暂停按钮：固定右上角（微信胶囊下方），约 52×52
      PAUSE_SIZE: 52,
      PAUSE_X: 682,
      PAUSE_Y: 30,
      // #56 小目标面板
      OBJ_X: 15,
      OBJ_W: 300,
      OBJ_TOP: 0,
      OBJ_COLLAPSED_H: 58,
      OBJ_EXPANDED_H: 220
    },
    SAVE: {
      KEY: 'survivor_save_v1',
      VERSION: 1
    },
    COLORS: {
      PAGE_BACKGROUND: '#050807',
      GROUND: '#14251f',
      GRID_THIN: 'rgba(119, 164, 137, 0.16)',
      GRID_MAJOR: 'rgba(153, 210, 172, 0.28)',
      WORLD_BORDER: '#7fa88d',
      PLAYER: '#3ddd75',
      PLAYER_OUTLINE: '#123d23',
      PLAYER_HIT: '#ffffff',
      PLAYER_GLOW: 'rgba(61, 221, 117, 0.30)',
      WALKER: '#ef4c4c',
      WALKER_OUTLINE: '#711f28',
      WALKER_GLOW: 'rgba(239, 76, 76, 0.22)',
      RUNNER: '#ff8b3d',
      RUNNER_OUTLINE: '#7d3418',
      RUNNER_GLOW: 'rgba(255, 139, 61, 0.32)',
      TANK: '#9853b8',
      TANK_OUTLINE: '#452252',
      TANK_GLOW: 'rgba(152, 83, 184, 0.32)',
      ELITE: '#f3c64f',
      ELITE_OUTLINE: '#825f10',
      ELITE_GLOW: 'rgba(243, 198, 79, 0.55)',
      BOSS: '#d85cff',
      BOSS_OUTLINE: '#5b176d',
      BOSS_GLOW: 'rgba(216, 92, 255, 0.65)',
      BOSS_RANGED: '#2d6b3f',
      BOSS_RANGED_OUTLINE: '#1a3d24',
      BOSS_RANGED_GLOW: 'rgba(45, 107, 63, 0.65)',
      BOSS_RANGED_CORE: '#7b3fa8',
      BOSS_RANGED_PROJECTILE: '#4a1a6b',
      BOSS_RANGED_PROJECTILE_GLOW: '#3ddc84',
      AIM_LINE: '#ff4d4d',
      WARNING_CIRCLE: 'rgba(255, 77, 77, 0.40)',
      DASH_BUTTON: '#4aa3e0',
      DASH_BUTTON_BORDER: '#cfeaff',
      DASH_ICON: '#eaf6ff',
      DASH_SPEEDLINE: 'rgba(200, 235, 255, 0.8)',
      DUST: '#b8b0a4',
      GADGET_LOCK: '#82958b',
      ENEMY_FROZEN: 'rgba(130, 226, 255, 0.62)',
      BULLET: '#ffe65a',
      BULLET_CORE: '#fffbd1',
      BULLET_TRAIL: 'rgba(255, 220, 55, 0.40)',
      BULLET_GLOW: 'rgba(255, 230, 90, 0.72)',
      BLADE: '#d9f4ff',
      BLADE_CORE: '#79d9ff',
      BLADE_OUTLINE: '#176f9c',
      BLADE_GLOW: 'rgba(89, 208, 255, 0.52)',
      GEM: '#42a5ff',
      GEM_CORE: '#c8efff',
      GEM_OUTLINE: '#145ab5',
      GEM_GLOW: 'rgba(66, 165, 255, 0.62)',
      COIN: '#ffd447',
      COIN_CORE: '#fff3a6',
      COIN_OUTLINE: '#9a6510',
      COIN_GLOW: 'rgba(255, 212, 71, 0.58)',
      ITEM_BASE: 'rgba(10, 18, 24, 0.92)',
      ITEM_BORDER: '#e8f4ff',
      ITEM_BOMB: '#ff6655',
      ITEM_MAGNET: '#ef5350',
      ITEM_MAGNET_TIP: '#59b8ff',
      ITEM_MEDKIT: '#64df83',
      ITEM_FREEZE: '#62d9ff',
      ITEM_LASER_EMITTER: '#ff6b9d',
      LASER_EMITTER_BEAM: '#ff6b9d',
      LASER_EMITTER_CORE: '#fff0f5',
      ITEM_MORTAR: '#ff7d38',
      MORTAR_WARNING: 'rgba(255,80,80,0.45)',
      MORTAR_FIRE: 'rgba(255,120,40,0.45)',
      SHIELD: '#59b8ff',
      EXTRACTION_INACTIVE: 'rgba(66,165,255,0.15)',
      EXTRACTION_INACTIVE_BORDER: 'rgba(66,165,255,0.5)',
      EXTRACTION_ACTIVATING: 'rgba(255,207,112,0.2)',
      EXTRACTION_ACTIVE: 'rgba(61,221,117,0.2)',
      EXTRACTION_ACTIVE_BORDER: 'rgba(61,221,117,0.6)',
      EXTRACTION_BTN: '#ff9f43',
      EXTRACTION_EXTRACT_BTN: '#2fc966',
      // #8 地图边界视觉
      BOUNDARY_BORDER: '#ff6b35',
      BOUNDARY_BORDER_GLOW: 'rgba(255,107,53,0.6)',
      BOUNDARY_OUTSIDE: '#0a0a0a',
      BOUNDARY_STRIPE: 'rgba(255,50,50,0.3)',
      BOUNDARY_WARNING: 'rgba(255,30,30,',
      RUIN_COLOR: '#4a4743',
      RUIN_EDGE: '#ac875a',
      // #16 玩家角色/武器/摇杆美术
      PLAYER_BODY: '#4a5d4e',
      PLAYER_VEST: '#3d4f3d',
      PLAYER_HELMET: '#556b55',
      PLAYER_SKIN: '#d4a574',
      WEAPON_GUN: '#3a3a3a',
      WEAPON_CORE: '#ffd700',
      WEAPON_BLADE: '#BDC3C7',
      WEAPON_BLADE_GLOW: '#85C1E9',
      JOYSTICK_BASE_OUTER: 'rgba(100,120,100,0.3)',
      JOYSTICK_BASE_INNER: 'rgba(80,100,80,0.2)',
      JOYSTICK_KNOB: 'rgba(90,200,120,0.6)',
      JOYSTICK_RING: 'rgba(150,200,150,0.4)',
      LOW_HP_AURA: 'rgba(255,50,50,0.4)',
      SHIELD_GLOW: 'rgba(80,180,255,0.5)',
      MUZZLE_FLASH: 'rgba(255,220,80,0.8)',
      ITEM_BUTTON: 'rgba(12, 27, 34, 0.92)',
      ITEM_BUTTON_BORDER: '#dff8ff',
      // #56/#57 UI 切图配色规范
      ACCENT: '#3FD0E5',
      BADGE_GOLD: '#FFD700',
      BADGE_ORANGE: '#FF8C00',
      BADGE_RED: '#E74C3C',
      PANEL_BG: 'rgba(10, 22, 40, 0.92)',
      PANEL_BG_SOLID: '#0A1628',
      LASER_ICON: '#C084FC',
      MEDKIT_GREEN: '#2ECC71',
      HP_BACKGROUND: 'rgba(8, 14, 12, 0.88)',
      HP_FILL: '#35d66f',
      HP_LOW: '#ff5252',
      HP_BORDER: '#e7f5eb',
      EXP_BACKGROUND: 'rgba(8, 14, 22, 0.88)',
      EXP_FILL: '#45aaff',
      EXP_BORDER: '#d7f0ff',
      LEVEL_BACKGROUND: 'rgba(17, 83, 132, 0.92)',
      LEVEL_BORDER: '#d7f0ff',
      BOSS_BAR_BACKGROUND: 'rgba(24, 5, 30, 0.92)',
      BOSS_BAR_FILL: '#d85cff',
      BOSS_BAR_BORDER: '#f6d9ff',
      TEXT: '#f4fff7',
      TEXT_SHADOW: 'rgba(0, 0, 0, 0.76)',
      HINT_TEXT: 'rgba(244, 255, 247, 0.72)',
      DAMAGE_NORMAL: '#fff3b0',
      DAMAGE_CRIT: '#ffb42e',
      JOYSTICK_BASE: 'rgba(226, 255, 234, 0.16)',
      JOYSTICK_BORDER: 'rgba(226, 255, 234, 0.48)',
      JOYSTICK_KNOB: 'rgba(92, 232, 133, 0.58)',
      OVERLAY: '#07100c',
      BUTTON: '#2fc966',
      BUTTON_BORDER: '#ddffe7',
      BUTTON_TEXT: '#07140b',
      SETTLEMENT_COIN: '#ffd447',
      CARD_BACKGROUND: 'rgba(15, 28, 34, 0.96)',
      CARD_INNER: 'rgba(255, 255, 255, 0.035)',
      CARD_DESCRIPTION: '#dce9e2',
      RARITY_COMMON: '#95A5A6',
      RARITY_RARE: '#3498DB',
      RARITY_EPIC: '#E67E22',
      RARITY_LEGENDARY: '#ffd54a',
      // 升级卡使用不透明深色底，避免微信真机把浅色阴影扩散成白色卡面
      CARD_COMMON_BG: '#222928',
      CARD_RARE_BG: '#132b3a',
      CARD_EPIC_BG: '#332317',
      CARD_LEGENDARY_BG: '#251c31',
      CARD_COMMON_BORDER: '#95A5A6',
      CARD_TITLE: '#fff1dd',
      CARD_DESC: '#d2cbc1',
      MENU_BACKGROUND: '#091713',
      MENU_PANEL: 'rgba(14, 35, 29, 0.94)',
      MENU_ACCENT: '#59e58a',
      META_CARD: 'rgba(17, 38, 34, 0.96)',
      META_CARD_BORDER: '#4e8067',
      META_MAX: '#e0b6ff',
      BUTTON_DISABLED: '#34463e',
      BUTTON_DISABLED_TEXT: '#82958b',
      POPUP_BACKGROUND: '#10241e',
      POPUP_BORDER: '#ffd966',
      AD_OVERLAY: 'rgba(0, 0, 0, 0.88)',
      AD_PANEL: '#15231f',
      AD_PANEL_BORDER: '#ffe074'
    },
    TEXT: {
      HP: 'HP',
      EXP: 'EXP',
      LEVEL: function (level) {
        return 'Lv.' + level;
      },
      SURVIVAL_HUD: function (timeText) {
        return '存活 ' + timeText;
      },
      KILLS_HUD: function (kills) {
        return '击杀 ' + kills;
      },
      BOSS_NAME: '最终 Boss',
      CRIT_PREFIX: '暴击 ',
      GAME_OVER: '游戏结束',
      VICTORY: '胜利！',
      VICTORY_SUBTITLE: '最终 Boss 已被击败',
      SETTLEMENT_QUIT: '本局结算',
      SETTLEMENT_EXTRACT: '撤退成功',
      EXTRACTION_ACTIVATE: '激活撤退点',
      EXTRACTION_ACTIVATING: '激活中',
      EXTRACTION_READY: '撤退点已激活，下一波可撤离',
      EXTRACTION_EXTRACT: '撤离',
      EXTRACTION_SUCCESS: '撤退成功',
      EXTRACTION_HOLD: '停留撤离中…',
      AD_EXTRACT_QUAD: '看广告四倍',
      AD_EXTRACT_QUAD_HINT: '本局限1次',
      AD_EXTRACT_USED: '四倍已使用',
      SETTLEMENT_TIME: function (timeText) {
        return '存活时长：' + timeText;
      },
      SETTLEMENT_KILLS: function (kills) {
        return '击杀数量：' + kills;
      },
      SETTLEMENT_LEVEL: function (level) {
        return '最终等级：Lv.' + level;
      },
      SETTLEMENT_COINS: function (coins, doubled) {
        return '本局金币：' + coins + (doubled ? '（已翻倍）' : '');
      },
      TOTAL_COINS: function (coins) {
        return '持有金币：' + coins;
      },
      RESTART: '返回主菜单',
      GAME_TITLE: '狂潮火力网',
      GAME_SUBTITLE: 'M6 · 绝境求生',
      START_GAME: '开始战斗',
      OPEN_BASE: '幸存者基地',
      SPEEDUP: '加速补给',
      SPEEDUP_TODO: '主动观看广告，可领取 120 分钟挂机产出',
      SPEEDUP_REWARD: function (minutes, coins) {
        return '领取 ' + coins + ' 金币（' + minutes + ' 分钟产出）';
      },
      SPEEDUP_READY: '可领取',
      SPEEDUP_COOLDOWN: function (timeText) {
        return '冷却 ' + timeText;
      },
      HISTORY: function (wave, timeText, kills) {
        return '历史最高：第 ' + wave + ' 波  ·  ' + timeText + '  ·  ' + kills + ' 击杀';
      },
      BASE_TITLE: '幸存者基地',
      BASE_SUBTITLE: '永久升级会在下一局开局时生效',
      BACK: '返回',
      BUY: function (price) {
        return '购买  ' + price;
      },
      MAX_LEVEL: '已满级',
      META_LEVEL: function (level, maxLevel) {
        return 'Lv.' + level + ' / ' + maxLevel;
      },
      OFFLINE_TITLE: '离线收益',
      OFFLINE_REWARD: function (coins) {
        return '基地为你积攒了 ' + coins + ' 金币';
      },
      OFFLINE_DETAIL: function (minutes, rate) {
        return '有效离线 ' + minutes + ' 分钟 · 每分钟 ' + rate + ' 金币';
      },
      OFFLINE_CAP: '最多累计 12 小时',
      CLAIM: '直接领取',
      CLAIM_DOUBLE: '看广告双倍',
      AD_TODO: '完整观看广告后才会发放奖励',
      AD_PLAYING: '广告播放中…',
      AD_WAIT: '请稍候，完整观看后自动发放奖励',
      AD_H5_HINT: 'H5 测试广告 · 1.5 秒',
      AD_BUSY: '已有广告正在播放',
      AD_WX_TODO: '广告加载中，请稍后再试',
      AD_REFRESH: '看广告刷新',
      AD_REFRESH_COUNT: function (remaining) {
        return '保底稀有 · 本局剩余 ' + remaining + ' 次';
      },
      AD_REFRESH_USED_UP: '本局刷新次数已用完',
      AD_REVIVE: '看广告复活',
      AD_REVIVE_COUNT: function (remaining) {
        return '50% 生命 · 剩余 ' + remaining + ' 次';
      },
      AD_COIN_DOUBLE: '看广告金币翻倍',
      AD_COIN_DOUBLE_HINT: '本局限 1 次',
      AD_COIN_DOUBLED: '本局金币已翻倍',
      REVIVES_LEFT: function (count) {
        return '复活次数 ' + count;
      },
      LEVEL_UP: '升级！选择一项强化',
      LEVEL_UP_SUBTITLE: '战斗已暂停，点击一张卡片继续',
      CARD_HINT: '不同描边颜色代表不同稀有度',
      CARD_LEVEL: function (level, maxLevel) {
        return '层数 ' + level + ' / ' + maxLevel;
      },
      RARITY: {
        COMMON: '普通',
        RARE: '稀有',
        EPIC: '史诗',
        LEGENDARY: '传说'
      },
      POWERUPS: [{
        NAME: '炸弹',
        SHORT: '炸弹'
      }, {
        NAME: '全图磁铁',
        SHORT: '磁铁'
      }, {
        NAME: '急救血包',
        SHORT: '血包'
      }, {
        NAME: '冻结装置',
        SHORT: '冻结'
      }, {
        NAME: '激光发射器',
        SHORT: '激光'
      }, {
        NAME: '迫击炮空袭',
        SHORT: '炮击'
      }],
      UPGRADES: {
        POWER: {
          NAME: '强力射击',
          DESC: function (p) {
            return '脉冲子弹伤害 +' + p + '%';
          }
        },
        RAPID: {
          NAME: '急速火力',
          DESC: function (p) {
            return '脉冲手枪射速 +' + p + '%';
          }
        },
        SPRINT: {
          NAME: '疾步',
          DESC: function (p) {
            return '玩家移动速度 +' + p + '%';
          }
        },
        VITALITY: {
          NAME: '生命强化',
          DESC: function (a) {
            return '最大生命 +' + a + '，并回复同等生命';
          }
        },
        SHARP: {
          NAME: '锐利',
          DESC: function (p) {
            return '所有武器暴击率 +' + p + ' 个百分点';
          }
        },
        MULTI: {
          NAME: '多重射击',
          DESC: function (a) {
            return '每次射击子弹数 +' + a;
          }
        },
        PIERCE: {
          NAME: '贯穿',
          DESC: function (a) {
            return '子弹额外贯穿 +' + a + ' 个敌人';
          }
        },
        MAGNET: {
          NAME: '磁吸',
          DESC: function (a) {
            return '经验晶石拾取范围 +' + a + 'px';
          }
        },
        PULSE_TUNE: {
          NAME: '脉冲校准',
          DESC: function (d, s) {
            return '脉冲伤害 +' + d + '，弹速 +' + s;
          }
        },
        BLADE_TUNE: {
          NAME: '飞刃共鸣',
          DESC: function (c, d) {
            return '环绕飞刃 +' + c + '，飞刃伤害 +' + d;
          }
        },
        BARRAGE: {
          NAME: '弹幕风暴',
          DESC: function () {
            return '脉冲射速 +20%，子弹数量 +1';
          }
        },
        DEADLY: {
          NAME: '致命连射',
          DESC: function () {
            return '暴击率 +8%，暴击伤害 +40%';
          }
        },
        HARVEST: {
          NAME: '血肉收割',
          DESC: function () {
            return '每击杀 1 个敌人回复 2 点生命';
          }
        },
        MAGNET_FIELD: {
          NAME: '磁力领域',
          DESC: function () {
            return '拾取范围 +40%，经验获取 +15%';
          }
        },
        BLADE_STORM: {
          NAME: '飞刃风暴',
          DESC: function () {
            return '飞刃数量 +1，旋转速度 +25%';
          }
        },
        ENERGY_SHIELD: {
          NAME: '能量护盾',
          DESC: function () {
            return '获得最大生命15%的护盾，破碎12秒后再生';
          }
        },
        TIME_WARP: {
          NAME: '时间扭曲',
          DESC: function () {
            return '所有武器冷却时间 -15%';
          }
        },
        DUAL_WIELD: {
          NAME: '双持射击',
          DESC: function () {
            return '脉冲弹量翻倍，但每发伤害变为85%';
          }
        },
        PHOENIX: {
          NAME: '不死鸟之翼',
          DESC: function () {
            return '首次死亡自动复活50%，清屏并无敌3秒';
          }
        },
        ELEMENTAL: {
          NAME: '元素过载',
          DESC: function () {
            return '所有伤害 ×1.4，受到伤害 ×1.15';
          }
        },
        EXECUTE: {
          NAME: '虚空斩杀',
          DESC: function () {
            return '子弹有25%概率秒杀普通敌人';
          }
        },
        TIME_LORD: {
          NAME: '时间领主',
          DESC: function () {
            return '敌人的移动与攻击速度 ×0.85';
          }
        },
        WAR_GOD: {
          NAME: '战神附体',
          DESC: function () {
            return '移动、所有伤害、拾取范围各 +25%';
          }
        },
        LASER_CANNON: {
          NAME: '激光炮',
          DESC: function () {
            return '子弹化为穿透激光，伤害+80%，弹速+50%';
          }
        }
      },
      // M6 新增文本
      PAUSE: '暂停',
      RESUME: '继续战斗',
      PAUSE_TITLE: '暂时安全',
      SETTINGS: '设置',
      HELP: '操作说明',
      SOUND: '合成音效',
      SHAKE: '震屏反馈',
      DEBUG: '调试信息',
      JOYSTICK_ALWAYS: '始终显示摇杆',
      ON: '开启',
      OFF: '关闭',
      BACK_TO_GAME: '返回暂停页',
      ABANDON: '结束本局并结算',
      SUMMARY: '本局强化记录',
      EMPTY_SUMMARY: '尚未选择单局强化',
      SAVE_WARNING: '本地存储不可用，进度仅保留在本次页面',
      HELP_LINES: ['电脑：WASD / 方向键移动，Esc 暂停', '手机：左下区域按住拖动摇杆', '武器自动攻击，靠近蓝色晶石获取经验', '右下按钮使用已拾取道具', '先强化，再挑战最终 Boss'],
      WAVE_NOTICE: function (n) {
        return '第 ' + n + ' 波 · 敌群来袭';
      },
      DEBUG_LINE: function (fps, e, b, p, d) {
        return 'FPS ' + fps + ' | 敌 ' + e + ' | 弹 ' + b + ' | 粒 ' + p + ' | 字 ' + d;
      },
      TURRET_ACTIVATE: '站立激活迫击炮 · 支援 60 秒',
      TURRET_READY: '站立 3 秒激活',
      TURRET_SPENT: '冷却中',
      FIELD_STATUS: function (turrets) {
        return '炮塔支援 ' + turrets;
      },
      LOOT_NOTICE: function (t) {
        return 'Boss 已击败 · 安全拾取 ' + Math.ceil(t) + ' 秒';
      },
      BOSS_HEALTH: function (hp, max) {
        return '最终 Boss  ' + Math.ceil(hp) + ' / ' + max;
      },
      // 营地 Tab / 道具强化
      BASE_TAB_CHARACTER: '角色强化',
      BASE_TAB_GADGET: '道具强化',
      GADGET_LOCKED: '局内拾取后解锁',
      GADGET_TAB_HINT: '强化对应战术道具，购买后永久生效',
      BASE_CHARACTER_SECTION: '生存者训练',
      BASE_CHARACTER_HINT: '永久属性 · 下一局开始时生效',
      BASE_GADGET_HINT: '战术道具专项改造 · 左右切换装备',
      BASE_PAGE: function (page, total) {
        return '第 ' + page + ' / ' + total + ' 页';
      },
      BASE_PREV: '‹',
      BASE_NEXT: '›',
      BASE_LEVEL_TOTAL: function (current, total) {
        return '强化进度  ' + current + ' / ' + total;
      },
      BASE_GADGET_INDEX: function (index, total) {
        return index + ' / ' + total;
      },
      // 冲刺
      DASH_READY: '冲刺',
      DASH_ACTIVE: '冲刺中',
      // Boss 名称
      BOSS_RANGED_NAME: '畸变炮台者',
      BOSS_MELEE_NAME: '畸变巨兽',
      BOSS_HP: function (name, hp, max) {
        return name + '  ' + Math.ceil(hp) + ' / ' + max;
      }
    },
    GAME: {
      STATE_MENU: 'MENU',
      STATE_BASE: 'BASE',
      STATE_PLAYING: 'PLAYING',
      STATE_LEVELUP: 'LEVELUP',
      STATE_GAMEOVER: 'GAMEOVER',
      STATE_VICTORY: 'VICTORY'
    },
    // M6 表现层参数
    POLISH: {
      PARTICLES: 360,
      KILL_PARTICLES: 7,
      PARTICLE_LIFE: 0.42,
      PARTICLE_SPEED: 150,
      PARTICLE_SIZE: 5,
      HIT_FLASH: 0.09,
      SHAKE_TIME: 0.1,
      SHAKE_SIZE: 3,
      LEVEL_FLASH: 0.28,
      CLICK_GAP_MS: 240,
      CRIT_POP: 0.35,
      GRID_CELL: 160,
      LOW_FX_ENEMIES: 120,
      FPS_SAMPLE: 0.5,
      VOICES: 8,
      VOLUME: 0.045,
      AUDIO_GAP: 0.045,
      TONES: {
        shot: [620, 170, 0.07],
        hit: [190, 70, 0.06],
        level: [480, 960, 0.3],
        button: [440, 600, 0.06]
      },
      TOOL_X: 590,
      TOOL_Y: 215,
      TOOL_W: 125,
      TOOL_H: 62,
      MENU_TOOL_Y: 1100,
      PANEL_X: 90,
      PANEL_W: 570,
      PANEL_TOP: 300,
      PANEL_STEP: 105,
      PANEL_H: 78,
      SUMMARY_Y: 820,
      SUMMARY_STEP: 32,
      WAVE_NOTICE_TIME: 2.2
    },
    // 战场元素配置
    FIELD: {
      WALLS: [{
        x: 480,
        y: 500,
        w: 270,
        h: 90
      }, {
        x: 1580,
        y: 520,
        w: 110,
        h: 300
      }, {
        x: 560,
        y: 1440,
        w: 100,
        h: 280
      }, {
        x: 1460,
        y: 1490,
        w: 300,
        h: 90
      }, {
        x: 970,
        y: 780,
        w: 230,
        h: 80
      }, {
        x: 1000,
        y: 1980,
        w: 300,
        h: 95
      }],
      ELITE_ITEMS: 2,
      BOSS_ITEMS: 5,
      DROP_SPREAD: 75,
      LOOT_SECONDS: 6,
      LOOT_PULL_SPEED: 900,
      BOSS_PANEL_Y: 80,
      TURRETS: [{
        x: 1040,
        y: 1120
      }, {
        x: 1820,
        y: 1160
      }, {
        x: 920,
        y: 1790
      }],
      TURRET_DURATION: 60,
      TURRET_ACTIVATE_RADIUS: 140,
      TURRET_CHARGE_TIME: 3,
      TURRET_COOLDOWN: 60,
      TURRET_RANGE: 950,
      TURRET_INTERVAL: 1.8,
      TURRET_DAMAGE: 600,
      SHELL_FLIGHT: 0.8,
      SHELL_RADIUS: 190,
      SHELL_POOL: 32,
      EXPLOSION_TIME: 0.35,
      ACTIVATE_X: 210,
      ACTIVATE_Y: 1110,
      ACTIVATE_W: 330,
      ACTIVATE_H: 74
    }
  };

  // M6 颜色覆盖
  Object.assign(CONFIG.COLORS, {
    MENU_BACKGROUND: '#171718',
    GROUND: '#252422',
    MENU_PANEL: '#252322',
    BUTTON: '#e9ad58',
    BUTTON_TEXT: '#241b12',
    BUTTON_BORDER: '#ffdb9e',
    MENU_ACCENT: '#ecae58',
    META_CARD: '#302b27',
    META_CARD_BORDER: '#78634c',
    POPUP_BACKGROUND: '#282321',
    CARD_BACKGROUND: '#282727',
    HINT_TEXT: '#c9beb0',
    TEXT: '#fff1dd',
    DAMAGE_CRIT: '#ff9c42',
    AD_PANEL: '#282321',
    ENEMY_HIT: '#fff8e8',
    PARTICLE: '#f4b35f',
    FX_FLASH: '#ffcf83',
    BUTTON_HOVER: 'rgba(255,218,153,0.20)',
    BUTTON_PRESS: 'rgba(0,0,0,0.30)',
    DEBUG_BACKGROUND: 'rgba(10,10,10,0.9)',
    WALL: '#4a4743',
    WALL_EDGE: '#ac875a',
    LASER: '#ff477b',
    LASER_CORE: '#fff0d4',
    TURRET: '#ffcf70',
    TURRET_SPENT: '#6d716e',
    SHELL: '#ff7d38',
    BASE_HEADER_PANEL: 'rgba(44, 38, 33, 0.96)',
    BASE_ROW: 'rgba(48, 43, 39, 0.96)',
    BASE_ROW_ALT: 'rgba(42, 38, 35, 0.96)',
    BASE_ACCENT: '#efb35b',
    BASE_PROGRESS_BG: '#4b443d',
    BASE_PROGRESS_ON: '#efb35b',
    BASE_PROGRESS_MAX: '#d9a7ff',
    BASE_TAB_IDLE: '#272422'
  });
  root.CONFIG = CONFIG;

  // 波次平衡、即时道具与三牌结算参数（保持现有数值）。
  CONFIG.BALANCE = {
    HP_PER_WAVE: .18,
    DAMAGE_PER_WAVE: .12,
    LATE_WAVE: 10,
    LATE_HP: 1.3,
    LATE_DAMAGE: 1.2,
    ELITE_HP: 1.35,
    ELITE_DAMAGE: 1.25,
    BOSS_EVERY: 10,
    BOSS_HP: 18000,
    BOSS_DAMAGE: 80,
    BOSS_NORMAL_QUOTA_RATIO: .55,
    BOMB_RADIUS: 200,
    BOMB_ELITE_MULTIPLIER: 80,
    BOMB_BOSS_CURRENT_HP_RATIO: .15,
    BOSS_STUN: 3,
    FREEZE_DURATION: 8,
    DROP_SCALE: .55,
    FLAME_BURN_DURATION: 5,
    FLAME_BURN_TICK: 1,
    FATE_PICK_COUNT: 3,
    FATE_REVEAL_GAP: .12,
    FATE_SHOW_TIME: 1.25,
    FATE_FLY_TIME: .65
  };
  // 地图迫击炮素材尺寸与固定爆炸池。
  CONFIG.TURRET_VISUAL = {
    BASE_SIZE: 86,
    TUBE_SIZE: 96,
    TUBE_LENGTH: 58,
    SHELL_SIZE: 38,
    EXPLOSION_RADIUS: 150,
    EXPLOSION_LIFE: 2,
    EXPLOSION_POOL: 12,
    FIRE_PARTICLES: 5,
    SMOKE_PARTICLES: 5
  };
  CONFIG.ENEMY.TYPES[CONFIG.ENEMY.TYPE_BOSS].HP = CONFIG.BALANCE.BOSS_HP;
  CONFIG.ENEMY.TYPES[CONFIG.ENEMY.TYPE_BOSS].DAMAGE = CONFIG.BALANCE.BOSS_DAMAGE;
  CONFIG.POWERUPS.NORMAL_DROP_CHANCE = 0.055 * CONFIG.BALANCE.DROP_SCALE;
  CONFIG.POWERUPS.TANK_DROP_CHANCE = 0.09 * CONFIG.BALANCE.DROP_SCALE;
  CONFIG.POWERUPS.ELITE_DROP_CHANCE = .55;
  CONFIG.POWERUPS.FREEZE_DURATION = CONFIG.BALANCE.FREEZE_DURATION;
  CONFIG.POWERUPS.DROP_WEIGHTS = [1.2, .45, 1.6, .42, .4, 0];
  CONFIG.POWERUPS.BAR_SLOTS = [0, 4, 1, 2, 3];
  CONFIG.FIELD.SHELL_RADIUS = CONFIG.TURRET_VISUAL.EXPLOSION_RADIUS;
  CONFIG.CONTENT = {
    OBJECTIVE_COUNT: 3,
    DIAMOND_NOTICE_TIME: 2,
    FLAME: {
      TICK: 0.1,
      DAMAGE: 6,
      RANGE: 150,
      ANGLE: Math.PI / 3,
      BURN_TIME: 2,
      BURN_DPS: 3
    },
    CROSSBOW: {
      COOLDOWN: 1.5,
      DAMAGE: 40,
      SPEED: 700,
      DECAY: 0.1,
      POOL: 48
    },
    ACHIEVEMENT_COUNT: 29,
    OUTFIT_COUNT: 12,
    SKIN_COUNT: 17
  };
  CONFIG.SCREEN_LAYOUT = {
    MENU: {
      CURRENCY_X: 430,
      CURRENCY_Y: 40,
      CURRENCY_W: 300,
      CURRENCY_H: 50,
      LOGO_X: 105,
      LOGO_Y: 70,
      LOGO_W: 540,
      LOGO_H: 340,
      HISTORY_Y: 408,
      BUFF_Y: 438,
      BUTTON_Y: 470,
      BUTTON_W: 560,
      BUTTON_H: 96,
      SPEEDUP_H: 112,
      GAP: 20
    },
    HUD: {
      TOP_H: 190,
      OBJECTIVE_Y: 195,
      OBJECTIVE_W: 250,
      OBJECTIVE_HEAD_H: 44,
      OBJECTIVE_ROW_H: 46,
      BOSS_Y: 148,
      BOSS_H: 14
    },
    ITEMS: {
      SIZE: 74,
      GAP: 16,
      RIGHT: 20,
      BOTTOM: 24,
      DASH_ABOVE: 28
    },
    WARDROBE: {
      CARD_W: 340,
      CARD_H: 380,
      COL_GAP: 20,
      ROW_GAP: 20,
      LEFT: 15,
      GRID_Y: 410
    }
  };

  // 项目内素材清单，微信/H5 路径差异由平台适配。
  CONFIG.ASSETS = {
    icon_bomb: 'icon/icon_bomb.png',
    icon_laser: 'icon/icon_laser.png',
    icon_magnet: 'icon/icon_magnet.png',
    icon_medkit: 'icon/icon_medkit.png',
    icon_freeze: 'icon/icon_freeze.png',
    slot_bg: 'icon/slot_bg.png',
    btn_dash: 'icon/btn_dash.png',
    mortar_base: 'icon/mortar_base.png',
    mortar_tube: 'icon/mortar_tube.png',
    mortar_shell: 'icon/mortar_shell.png'
  };
  CONFIG.BOUNDARY.CORNER_RUIN_RADIUS = 0;
  CONFIG.FIELD.WALLS = [{
    x: 360,
    y: 430,
    w: 330,
    h: 86,
    kind: 'concrete'
  }, {
    x: 1530,
    y: 390,
    w: 105,
    h: 350,
    kind: 'container'
  }, {
    x: 420,
    y: 1260,
    w: 110,
    h: 330,
    kind: 'container'
  }, {
    x: 1430,
    y: 1390,
    w: 360,
    h: 92,
    kind: 'concrete'
  }, {
    x: 900,
    y: 710,
    w: 300,
    h: 82,
    kind: 'concrete'
  }, {
    x: 930,
    y: 1920,
    w: 360,
    h: 100,
    kind: 'rubble'
  }, {
    x: 1750,
    y: 930,
    w: 250,
    h: 84,
    kind: 'rubble'
  }, {
    x: 650,
    y: 2130,
    w: 100,
    h: 230,
    kind: 'container'
  }];
  CONFIG.FIELD.LASER_ITEM = CONFIG.POWERUPS.TYPE_LASER_EMITTER;
  CONFIG.LASER_EMITTER.BASE_DURATION = 5;
  CONFIG.LASER_EMITTER.TICK_INTERVAL = .05;
  CONFIG.META.GADGET_UPGRADES.laser.items = [{
    ID: 'speed',
    NAME: '旋转加速',
    DESC: '旋转速度 +15%',
    BASE: 80,
    MAX_LEVEL: 5,
    AMOUNT: .15
  }, {
    ID: 'duration',
    NAME: '持续照射',
    DESC: '激光持续时间 +1秒',
    BASE: 70,
    MAX_LEVEL: 3,
    AMOUNT: 1
  }, {
    ID: 'bossDamage',
    NAME: '致命光束',
    DESC: '精英/Boss伤害 +25%',
    BASE: 100,
    MAX_LEVEL: 5,
    AMOUNT: .25
  }, {
    ID: 'cooldown',
    NAME: '快速充能',
    DESC: '激活冷却 -15%',
    BASE: 100,
    MAX_LEVEL: 5,
    AMOUNT: .15
  }, {
    ID: 'overload',
    NAME: '过载光束',
    DESC: '额外增加1条对向光束',
    BASE: 300,
    MAX_LEVEL: 1,
    AMOUNT: 1
  }];
  CONFIG.TEXT.ENTER_FATE = '进入命运抽取';
})();

'use strict';
// ============================================================
// game.js（微信小游戏入口）
// 按依赖顺序 require 所有模块，最后启动游戏
// 注意：meta.js / ads.js / audio.js 必须在 ui.js 之前加载，
//       否则 ui.js 顶部的 var Meta = root.Meta 会捕获到 undefined
// ============================================================

// 1. 平台适配层（必须最先加载）
require('./js/platform.js');

// 2. 配置
require('./js/config.js');

// 3. 核心模块（画布/输入/摄像机/战斗/飘字）
require('./js/core.js');

// 4. 实体模块（玩家/敌人/子弹/武器）
require('./js/entities.js');

// 5. 系统模块（刷怪/Boss/统计/经验/金币/道具）
require('./js/systems.js');

// 6. 元系统（存档/养成/设置）—— 必须在 ui.js 之前
require('./js/meta.js');

// 7. 广告（微信激励视频）
require('./js/ads.js');

// 8. 音效
require('./js/audio.js');

// 9. UI 绘制（依赖 Meta / Ads / AudioFX）
require('./js/ui.js');

// 10. 游戏主循环
require('./js/game.js');

// 11. 特效增强层（粒子/性能/空间网格/按钮/暂停面板）
require('./js/effects.js');

// 12. 战场元素（墙壁/炮塔/激光/Boss掉落）
require('./js/field.js');

// 13. 第四版功能（开发者控制台 / 命运抽牌 / 迫击炮表现）
require('./js/v004.js');

// 14. 第五版功能（钻石 / 目标 / 新武器 / 外观 / 成就）
require('./js/v005.js');

// 15. 第六版UI布局修正（主菜单 / 成就 / 外观网格 / 战斗HUD）
require('./js/v006.js');

// 16. 第七版（营地分层 / 五档品质 / 主菜单修复 / 渐变崩溃修复）
require('./js/v007.js');

// 17. 第八版（墙体AI / 三主武器成长 / 旋转激光 / 后期波次）
require('./js/v008.js');

// 18. 启动
require('./js/boot.js');

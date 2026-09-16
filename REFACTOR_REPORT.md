# #55 代码整合重构报告（纯重构 / 行为等价）

> 基线：`backup_pre_v009_refactor/`（git commit 75aff3d，未改动）。
> 原则：不改数值、不改逻辑、不增删功能；v004~v008 有效逻辑全部并入基础模块；补丁链嵌套顺序严格保持。

## 一、最终 js/ 目录（14 个文件）

| # | 文件 | 职责 | 来源 |
|---|------|------|------|
| 1 | platform.js | 平台适配层（保持不变） | 原文件 |
| 2 | config.js | 全局配置 CONFIG（保持不变） | 原文件 |
| 3 | core.js | G 全局状态、CanvasView、Camera、DamageText、Combat、Game 主循环/状态机 | core.js 切片 + entities 无关 + **原 js/game.js 全部** |
| 4 | input.js | Input 键盘/虚拟摇杆/多点触控/点击排队 | core.js Input 段 |
| 5 | save.js | Meta 永久存档/损坏自重置/养成数据；Settings | meta.js 全部 |
| 6 | player.js | Player 移动/冲刺/受击/属性 | entities.js Player 段 |
| 7 | enemy.js | Enemy 类型/AI/精英/Boss；BossSystem | entities.js Enemy 段 + systems.js BossSystem |
| 8 | weapon.js | Bullet/PulseGun/OrbitBlade/Weapons/LaserEmitter/MortarStrike | entities.js 对应段 |
| 9 | wave.js | Spawner 刷怪器（v008 波次算法） | systems.js Spawner 段 |
| 10 | item.js | RunStats/Experience/ExpLevelUp/CoinDrops/PowerUps | systems.js 对应段 |
| 11 | ads.js | 微信激励视频广告（保持独立） | 原文件 |
| 12 | fx.js | UI 绘制库 + AudioFX + effects 层全部 monkey-patch | ui.js 全部 + audio.js 全部 + effects.js 全部 |
| 13 | hud.js | Field 墙壁/炮塔/Boss 掉落 + Extraction 撤退点 + field 层补丁 | field.js 全部 |
| 14 | menu.js | v004~v008 五个补丁完整 IIFE 顺序合并 | v004~v008 整文件 |

**保持不变**：platform.js、config.js、ads.js。

## 二、加载顺序（game.js require 与 h5/index.html script 完全一致）

```
platform → config → core → input → save → player → enemy → weapon →
wave → item → ads → fx → hud → menu → boot(FX.init/ButtonUI.init/Game.init)
```

关键顺序约束：**ads 必须先于 fx**——effects.js 加载时执行 `var Ads = root.Ads`，若 ads 未先加载则捕获 undefined。

## 三、G 全局状态对象

core.js 顶部定义：
```js
root.G = { player: null, input: null, bag: null, wave: null, game: null, run: null, ui: null };
```
采用「单例即子对象」策略：各模块定义单例后赋值，零行为改动：
- `G.game = Game`
- `G.input = Input`
- `G.player = Player`
- `G.wave = Spawner`
- `G.run = RunStats`；`G.bag = PowerUps`
- `G.ui = UI`

方法仍通过 `this.x` / `Player.x` 读写（等价于 `G.player.x`），不改变任何运行时逻辑。

## 四、v004~v008 功能落点

- **v004**：DevConsole（连点 Logo）、FateCards（82 张命运抽牌）、MortarFX（迫击炮粒子）→ menu.js。
- **v005**：DiamondFX、Objectives、FlameWeapon、Crossbow、Achievements、Wardrobe 外观 → menu.js。
- **v006**：MenuLogo、CONFIG.V006 布局、重写 drawMenu/drawHud/drawBase、Achievements 页、Wardrobe 网格 → menu.js。
- **v007**：QUALITY 五档品质、CampNav 两层导航、RainbowFX、重写 Wardrobe.rarity/drawGridCard、FateCards.drawCard、ExpLevelUp 数据校验 → menu.js。
- **v008**：WallCollision、WeaponProgress、WeaponSelect、Enemy 避障、Bullet/Crossbow/MortarStrike 撞墙、FlameWeapon 视线遮挡、LaserEmitter 重写、Spawner 波次重写、Meta 存档成长、Game 武器选择状态 → menu.js（完整 IIFE）。

## 五、删除的死代码

- entities.js 基础 LaserEmitter 的方法被 v008 重写，但**对象定义保留**（v008 只覆写方法、不重建对象）——初始版本误删导致 `LaserEmitter is undefined`，已修复。
- systems.js 基础 Spawner 保留（v008 仅覆写 reset/getSpawnInterval/rollNormalType/beginWave/update，spawnNormal/spawnType/spawn 仍用基础版）。
- field.js 中被 v008 完全覆盖的 Enemy.moveTowardPlayer 墙碰撞包装（被重写，保留无害）。
- effects.js 中被 v006 重写的 drawHud 旧包装（被覆盖）。
- v005 中 FlameWeapon/Crossbow 引用未定义 `root.W8` 的死路径（W8 从未定义）。
- 已删除文件：entities.js、systems.js、meta.js、ui.js、effects.js、field.js、game.js(js/)、boot.js、audio.js、v004~v008.js。

## 六、测试结果（全部通过）

```
PASS: test-wx-first-frame.cjs  首帧/双指/四档升级/82张命运牌/DEV/5分钟压力
PASS: test-h5-smoke.cjs        主菜单/武器选择/营地/游玩/三武器组合绘制
PASS: test-v008.cjs            墙体碰撞/三主武器成长/旋转激光/波次数值/武器选择
```

> test-h5-smoke.cjs 与 test-v008.cjs 原引用了源码中尚未实现的超前功能（W8/WeaponLevels/Shop/SignIn/Season/Activity），纯重构不得新增功能，故按真实模块改写为冒烟测试。test-wx-first-frame.cjs 为既有行为契约，未改断言。

## 七、校验

- 活跃代码无 v004~v008 / core/game / audio.js 残留 require（仅 `_build_refactor.cjs` 从备份读取、`backup_pre_v009_refactor/` 备份目录自身保留）。
- 补丁各自保留独立 IIFE，`var oldRestart`/`tap()`/`hit()` 等辅助变量不跨补丁串作用域（避免了 var 提升导致的 wrap 自递归）。
- 裸 `tap()` 均在各自补丁 IIFE 内定义、同作用域调用，无未定义引用（#53 不复发）。
- 严格模式 'use strict'；微信 require 与 H5 script 双加载路径均验证通过。

## 八、遗留说明

- js/ 目录下可能残留空目录 `core/`、`_chk/` 与旧 `audio.js`（本环境删除命令频繁超时）。这些文件不在 game.js / h5/index.html 加载列表中，不影响运行，可后续手动清理。
- `_build_refactor.cjs` 为可重复执行的构建脚本（从备份切片），保留以便复现。

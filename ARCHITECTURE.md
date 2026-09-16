# 狂潮火力网：当前架构与后续开发指南

## 运行链路

```text
平台适配 → 配置/碰撞 → Game 状态机 → 输入/存档/玩家/敌人
       → 武器 → 波次 → 道具 → 广告 → 表现 → HUD → 菜单
       → Game.init() → requestAnimationFrame(dt)
```

`Game.loop` 每帧先预约下一帧，再计算并限制 `dt`。切后台时清零时间戳、清理触摸并暂停战斗；回到前台后从一帧小步长继续，不会把后台时间一次性灌入战斗。

## 状态与数据边界

- `Game.state` 只由 `core.js` 改变；界面模块通过 `Game.enterMenu/enterBase/enterLevelUp/commitSettlement` 请求状态变化。
- `Player`、`Enemy`、`Bullet`、`PulseGun`、`FlameWeapon`、`Crossbow`、`MortarStrike`、`LaserEmitter` 各自只有一个实现文件。
- `Field` 负责地图和场景炮塔，`BattleView` 负责调用顺序；世界绘制在一个 `ctx.save()`/`ctx.restore()` 区间内，HUD 在世界还原后绘制。
- 图片必须先经过 `Platform.loadImage`；加载中或失败时 `UI.icon` 返回空值，调用方使用 Canvas 兜底。相同资源在解码中不会重复创建。

## 以后如何加功能

1. 先在 `CONFIG` 增加数值、颜色或文案，并为对象池预留容量。
2. 选择唯一归属模块实现数据和行为；不要在 `menu.js` 或 `fx.js` 中“临时补丁”战斗对象。
3. 将跨模块需求设计成一个短接口（例如 `Enemy.recordKill`、`Weapons.getMainDamage`），由调用方显式调用。
4. 在 `test-*.cjs` 增加行为测试，运行 `node run-tests.cjs`。
5. 只提交正式模块和测试/文档变更。不要复制整个源码生成带版本号的运行文件。

## 当前明确的兼容策略

- `backup_pre_v009_refactor` 是历史参考资料，已从小游戏上传包排除，不参与运行；需要查看历史时用 Git 或该目录，不要继续从中复制代码。
- `project.config.json` 的 `packOptions.ignore` 排除测试和文档。`package.json` 只用于本地测试的 CommonJS 作用域，运行时不依赖 npm。
- `CONFIG.ASSETS` 是所有切图入口，包含道具栏、冲刺、迫击炮和 Logo；素材加载失败时仍保留矢量兜底，因此微信首帧不会黑屏。

## 发布前检查

- 执行 `node run-tests.cjs`，结果必须全部通过。
- 在 H5 页面验证菜单、武器选择、基地、三种主武器、升级卡四种稀有度、暂停、摇杆和素材加载。
- 在微信开发者工具分别清缓存后检查首帧、双指输入、切后台/回前台、损坏存档和长时间波次。
- 上传前确认发布目录没有新增 `v*.js`、`patch*.js` 或测试文件，且正式目录只保留唯一入口 `game.js`。


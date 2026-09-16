# fire-grid-surge 工程约定

## 维护原则

- 这是一个原生 Canvas 2D 微信小游戏，同时提供 `h5/index.html` 浏览器入口。
- 运行时禁止外部依赖、网络素材、npm 包、构建步骤和 ES Module；发布包应能由微信开发者工具直接加载。
- 未来需求只能修改正式模块，禁止新增 `v009.js`、`v010.js`、`patch.js`、`hotfix.js` 或通过运行时重新赋值覆盖旧方法。版本历史使用 Git 提交、分支和标签记录，不使用源码副本记录版本。
- 所有运行时数字进入 `js/config.js` 的 `CONFIG`，界面文案进入 `CONFIG.TEXT`；缺少配置时先补配置再写业务逻辑。
- 保持 `localStorage`/微信存档键 `survivor_save_v1` 的向后兼容。读取必须容错，损坏数据只能恢复默认存档，不能阻塞首帧。

## 模块唯一归属

| 模块 | 唯一负责的内容 |
| --- | --- |
| `platform.js` | 微信/H5 API、画布、缩放、安全区、触摸分发、图片与存储适配 |
| `config.js` | 全部配置、颜色、文案、资源路径 |
| `collision.js` | 无状态墙体几何查询 |
| `core.js` | 唯一 `Game` 状态机、重启、更新、整帧绘制、生命周期 |
| `input.js` | 键盘、摇杆、多点触摸和点击队列 |
| `save.js` | `Meta` 存档、局外升级、离线收益、设置 |
| `player.js` | 玩家属性、移动、冲刺、受击和玩家绘制入口 |
| `enemy.js` | 敌人池、AI、碰撞、伤害、Boss 和敌人绘制 |
| `weapon.js` | 子弹、手枪、飞刃、喷火器、弩箭、激光、迫击炮和武器进度 |
| `wave.js` | 唯一 `Spawner`，刷怪配额、波次、精英和 Boss |
| `item.js` | 经验、升级卡、金币、道具和局内统计 |
| `fx.js` | UI 绘制工具、粒子、飘字、音效、面板、按钮热区 |
| `hud.js` | `Field` 地图、炮塔场景表现、撤离点和 `BattleView` 战斗绘制编排 |
| `menu.js` | 主菜单、基地、外观、成就、命运牌和武器选择页面 |
| `ads.js` | 广告抽象层；H5 模拟广告，微信分支预留 |

核心实体的方法只能在上述所属模块定义。跨模块通信使用根对象公开的服务接口；不要保存 `oldX` 再包装 `X`，也不要把同一实体的方法复制到菜单、特效或 HUD 文件。

## 入口和测试

- 微信入口：`game.js` 按 `platform → config → collision → core → input → save → player → enemy → weapon → wave → item → ads → fx → hud → menu` 加载。
- H5 入口：`h5/index.html` 必须保持相同顺序，最后只调用 `window.FX.init()`、`window.ButtonUI.init()`、`window.Game.init()`。
- 完整回归：在项目目录执行 `node run-tests.cjs`。它会独立启动所有 `test-*.cjs`，任何一个失败都返回非零退出码。
- 新功能先写对应模块，再补单元/集成测试；至少覆盖微信入口、H5 入口、损坏存档、异步素材、Canvas `save/restore`、暂停/触摸和前后台时间戳。
- 测试文件与文档不应进入微信上传包；相关忽略规则维护在 `project.config.json`。

## 性能和安全底线

- 敌人、子弹、粒子、飘字必须使用固定对象池，同屏敌人上限由配置保护；主循环严禁无界 `new`。
- 移动、刷怪、冷却和生命周期都使用 `dt`，并受 `CONFIG.TIME.MAX_DT` 限制。
- 不在日志、文档或存档中写入密钥、广告 ID 以外的凭证或个人信息。
- 每次同步到正式目录前，先在当前工作副本运行完整测试，再逐个核对文件哈希；不能用整个目录覆盖 `.git` 或用户未授权的文件。


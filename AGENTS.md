# fire-grid-surge 工程约定

## 维护原则

- 这是一个原生 Canvas 2D 微信小游戏，同时提供 `h5/index.html` 浏览器入口。
- 运行时禁止外部依赖、网络素材、npm 包、构建步骤和 ES Module；发布包应能由微信开发者工具直接加载。
- 未来需求只能在现有功能模块中修改、扩展，新功能归入下文「模块唯一归属」的对应模块；禁止新增 `v009.js`、`v010.js`、`patch.js`、`hotfix.js` 等版本补丁文件，禁止通过运行时重新赋值覆盖旧方法。重写方法不得引用其他文件的局部变量，需要共享的状态统一挂到根对象的全局状态/服务接口；被覆盖的废弃代码直接删除，不保留死代码。版本历史使用 Git 提交、分支和标签记录，不使用源码副本记录版本。
- 所有运行时数字进入 `src/config/config.js` 的 `CONFIG`，界面文案进入 `CONFIG.TEXT`；缺少配置时先补配置再写业务逻辑。
- 保持 `localStorage`/微信存档键 `survivor_save_v1` 的向后兼容。读取必须容错，损坏数据只能恢复默认存档，不能阻塞首帧。

## 模块唯一归属

| 模块 | 唯一负责的内容 |
| --- | --- |
| `src/platform/platform.js` | 微信/H5 API、画布、缩放、安全区、触摸分发、图片与存储适配 |
| `src/config/config.js` | 全部配置、颜色、文案、资源路径 |
| `src/config/collision.js` | 无状态墙体几何查询 |
| `src/core/core.js` | 唯一 `Game` 状态机、重启、更新、整帧绘制、生命周期 |
| `src/core/input.js` | 键盘、摇杆、多点触摸和点击队列 |
| `src/persistence/save.js` | `Meta` 存档、局外升级、离线收益、设置 |
| `src/gameplay/player.js` | 玩家属性、移动、冲刺、受击和玩家绘制入口 |
| `src/gameplay/enemy.js` | 敌人池、AI、碰撞、伤害、Boss 和敌人绘制 |
| `src/gameplay/weapon.js` | 子弹、手枪、飞刃、喷火器、弩箭、激光、迫击炮和武器进度 |
| `src/gameplay/wave.js` | 唯一 `Spawner`，刷怪配额、波次、精英和 Boss |
| `src/gameplay/item.js` | 经验、升级卡、金币、道具和局内统计 |
| `src/presentation/ui.js` | Canvas UI 绘制工具和点击区域 |
| `src/services/audio.js` | 无外部文件的 WebAudio 合成音效 |
| `src/presentation/effects.js` | 粒子、飘字、空间索引、指标和暂停/设置面板 |
| `src/presentation/hud.js` | `Field` 地图、炮塔场景表现、撤离点和 `BattleView` 战斗绘制编排 |
| `src/features/fate.js` | 命运抽牌、下一局增益和开发者工具 |
| `src/features/progression.js` | 目标、成就、外观和装扮数据 |
| `src/presentation/screens.js` | 主菜单、结算、升级与基地基础页面 |
| `src/presentation/camp.js` | 营地导航、品质视觉和响应式排版 |
| `src/features/weapon-selection.js` | 主武器选择和武器成长入口 |
| `src/services/ads.js` | 广告抽象层；H5 模拟广告，微信分支预留 |

核心实体的方法只能在上述所属模块定义。跨模块通信使用根对象公开的服务接口；不要保存 `oldX` 再包装 `X`，也不要把同一实体的方法复制到菜单、特效或 HUD 文件。

## 入口和测试

- 微信入口：`game.js` 按 `platform → config → collision → core → input → save → gameplay → services → presentation → features` 加载。
- H5 入口：`h5/index.html` 必须保持相同顺序，最后只调用 `window.FX.init()`、`window.ButtonUI.init()`、`window.Game.init()`。
- 完整回归：在项目目录执行 `node tests/run-all.cjs`。它会独立启动 `tests/specs/*.test.cjs`，任何一个失败都返回非零退出码。
- 新功能先写对应模块，再补单元/集成测试；至少覆盖微信入口、H5 入口、损坏存档、异步素材、Canvas `save/restore`、暂停/触摸和前后台时间戳。
- 测试文件与文档不应进入微信上传包；相关忽略规则维护在 `project.config.json`。

## 性能和安全底线

- 敌人、子弹、粒子、飘字必须使用固定对象池，同屏敌人上限由配置保护；主循环严禁无界 `new`。
- 移动、刷怪、冷却和生命周期都使用 `dt`，并受 `CONFIG.TIME.MAX_DT` 限制。
- 不在日志、文档或存档中写入密钥、广告 ID 以外的凭证或个人信息。
- 每次同步到正式目录前，先在当前工作副本运行完整测试，再逐个核对文件哈希；不能用整个目录覆盖 `.git` 或用户未授权的文件。

## 资源与包体规范

- 微信小游戏主包硬上限 **4MB**，超限上传报错误码 80051；每次新增美术资源后必须重新核算进包体积并预留余量，不要等上传失败再处理。
- `assets/` 只放运行时实际加载的切图。预览图、效果总览图、PSD/AI/Sketch 源文件、设计稿、视频一律不放进 `assets/`；确需留在仓库的，必须在 `project.config.json` 的 `packOptions.ignore` 中按相对路径排除（文件可保留在磁盘，但不进包）。
- 切图按"实际显示尺寸 × 屏幕密度需要"导出，不要把远超显示尺寸的大图塞进主包（例：主界面 Logo 显示约 400px，不使用 1254px 原图）。
- PNG 上线前做近无损压缩（256 色量化或 pngquant 类工具），保持透明通道与发光边缘干净；压缩后必须贴游戏底色抽查，确认无杂边、色带后再替换，原图备份在工程外。
- 同一张图只保留一份，禁止在多个目录重复存放；所有图片路径统一在 `src/config/config.js` 注册，代码只引用注册名。删除或排除文件前先全局检索引用，避免运行时加载失败。
- 当前已忽略不进包：`tests/`、`docs/`、`AGENTS.md`、`README.md`、`package.json`、`assets/ui/main-menu/preview.png`、`assets/ui/main-menu/states-preview.png`、`assets/ui/main-menu/logo.png`（与 `assets/logo/game_logo.png` 重复）。
- 资源增长到接近 4MB 时，优先用微信小游戏分包（`subpackages`，把营地/外观/技能等非首屏资源放入分包），其次大图走 CDN 远程下载并本地缓存；不要靠删除功能或牺牲必要画质硬压。

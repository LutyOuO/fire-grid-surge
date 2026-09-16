# 狂潮火力网（fire-grid-surge）

原生 JavaScript + Canvas 2D 微信小游戏，同时保留浏览器 H5 入口。项目不需要 npm 安装、构建或外部运行时依赖。

## 目录

```text
assets/                 游戏图片资源
  icons/                道具、冲刺和迫击炮切图
  logo/                 游戏 Logo
docs/                   架构与维护文档
h5/                     浏览器入口
src/                    唯一正式源码
  platform/             微信/H5 平台适配
  config/               配置与碰撞查询
  core/                 Game 状态机与输入
  features/             命运、成长和武器选择功能
  persistence/          存档、设置、离线收益
  gameplay/             玩家、敌人、武器、波次、道具
  services/             广告等独立服务
  presentation/         UI、HUD、菜单和视觉表现
tests/                  所有自动测试（不进入微信上传包）
  helpers/              测试环境工具
  specs/                行为测试
game.js                 微信小游戏唯一入口
game.json               微信小游戏配置
project.config.json     微信开发者工具项目配置
```

## 常用操作

- 微信开发者工具直接打开项目根目录。
- 浏览器入口是 `h5/index.html`。
- 完整测试执行：`node tests/run-all.cjs`。
- 架构边界与模块职责见 `docs/ARCHITECTURE.md` 和根目录 `AGENTS.md`。

版本历史统一由 Git 管理。请勿新增 `v010.js`、`patch.js`、`hotfix.js` 或源码备份目录。

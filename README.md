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

## 可复用角色动画

角色使用八列 × 五层静态图集：背包、左腿、右腿、躯干、头部。每格 128 × 128，脚底锚点统一为 (64,116)。`CharacterView` 在运行时驱动髋部摆动、抬脚、身体重心、头部反向补偿和双臂关节；换皮肤复用同一套动作，无需导出走路或射击序列帧。旧收藏皮肤继续复用基础身体与身份标识，缺图时的程序身体也沿用同一关节。

新增皮肤在 `CONFIG.CHARACTER.SKINS` 登记图集，保持上述图层与锚点即可。所有共用关节和六武器动作参数位于 `CONFIG.CHARACTER.RIG`；武器挂点位于 `TEMPLATES` 和 `DIRECTION_GRIPS`。双手、枪口闪光、弹体起点共用武器姿势计算。动画用 `dt` 更新，绘制不推进状态，暂停自动冻结。

手枪采用紧凑双手持握，冲锋枪采用较活跃步态与短促后坐，步枪采用稳定抵肩姿势，机枪采用下沉重心与较慢装填，喷火器采用持续撑持和压力震动，弩箭射击后拉弦复位。仓库预览复用相同接口与配置。开发机可运行 `node docs/character-visual-check.cjs <工程外输出目录> --animation` 导出实际 Canvas 动画；该检查需要 Playwright 和 sharp，仅开发使用。

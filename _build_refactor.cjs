'use strict';
// 重构构建脚本：从备份读取原始源，按行切片组装为 11 个功能模块（行为等价）。
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'backup_pre_v009_refactor', 'js');
const OUT = path.join(__dirname, 'js');

function read(name) {
  return fs.readFileSync(path.join(SRC, name), 'utf8').split(/\r?\n/);
}
function sl(lines, from, to) { return lines.slice(from - 1, to).join('\n'); }
function iifeBody(lines) {
  let start = 0, end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^\(function\s*\(\s*\)\s*\{/.test(lines[i].trim())) { start = i + 1; break; }
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\}\s*\)\s*\(\s*\)\s*;?\s*$/.test(lines[i].trim())) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

const core = read('core.js'), entities = read('entities.js'), systems = read('systems.js');
const meta = read('meta.js'), ui = read('ui.js'), effects = read('effects.js');
const field = read('field.js'), gamejs = read('game.js'), boot = read('boot.js');
const audio = read('audio.js');
const v004 = read('v004.js'), v005 = read('v005.js'), v006 = read('v006.js');
const v007 = read('v007.js'), v008 = read('v008.js');

const HDR = (title, lines) =>
`'use strict';
// ============================================================
// ${title}
// ${lines.join('\n// ')}
// ============================================================
var root = (typeof window !== 'undefined') ? window : global;
var CONFIG = root.CONFIG;
`;

function w(name, content) { fs.writeFileSync(path.join(OUT, name), content); }

// 3. core.js
let c = HDR('core.js — 核心模块', [
  '职责：G 全局状态对象、CanvasView、Camera、DamageText、Combat、Game 主循环与状态机、boot 启动',
  '全局状态：root.G(game) ；Game.state/survivedSeconds',
  '依赖：platform.js, config.js；其后模块运行时经 root 访问',
  '加载顺序：1 platform → 2 config → 3 core']) + '\n';
c += 'root.G = { player: null, input: null, bag: null, wave: null, game: null, run: null, ui: null };\n';
c += sl(core, 11, 27) + '\n' + sl(core, 217, 243) + '\n' + sl(core, 246, 300) + '\n' + sl(core, 303, 318) + '\n';
c += sl(gamejs, 31, 446) + '\n';
c += 'root.CanvasView = CanvasView;\nroot.Camera = Camera;\nroot.DamageText = DamageText;\nroot.Combat = Combat;\nroot.Game = Game;\nroot.G.game = Game;\n';
w('core.js', c);

// 4. input.js
let i = HDR('input.js — 输入模块', [
  '职责：键盘 + 虚拟摇杆 + 多点触控 + 界面点击排队',
  '全局状态：G.input（Input 单例）',
  '加载顺序：core → input']) + '\n';
i += sl(core, 30, 214) + '\nroot.Input = Input;\nroot.G.input = Input;\n';
w('input.js', i);

// 5. save.js
let s = HDR('save.js — 存档模块', [
  '职责：Meta 永久存档读写/损坏自重置/养成数据；Settings 设置项',
  '加载顺序：core → input → save']) + '\n';
s += sl(meta, 11, 329) + '\n' + sl(meta, 331, 352) + '\nroot.Meta = Meta;\nroot.Settings = Settings;\n';
w('save.js', s);

// 6. player.js
let p = HDR('player.js — 玩家模块', [
  '职责：玩家移动/冲刺/受击/属性',
  '全局状态：G.player（Player 单例 x/y/hp/maxHp/speed/dashing/critChance）',
  '加载顺序：... → player']) + '\n';
p += sl(entities, 13, 417) + '\nroot.Player = Player;\nroot.G.player = Player;\n';
w('player.js', p);

// 7. enemy.js
let e = HDR('enemy.js — 敌人模块', [
  '职责：Enemy 类型/AI/精英/Boss；BossSystem；WallCollision（v008）',
  '加载顺序：... → enemy']) + '\n';
e += sl(entities, 419, 870) + '\n' + sl(systems, 120, 150) + '\nroot.Enemy = Enemy;\nroot.BossSystem = BossSystem;\n';
w('enemy.js', e);

// 8. weapon.js
let wn = HDR('weapon.js — 武器模块', [
  '职责：Bullet/PulseGun/OrbitBlade/Weapons/MortarStrike；v008 LaserEmitter/WeaponProgress/WeaponSelect',
  '加载顺序：... → weapon']) + '\n';
wn += sl(entities, 872, 992) + '\n' + sl(entities, 994, 1049) + '\n' + sl(entities, 1051, 1133) + '\n';
wn += sl(entities, 1135, 1151) + '\n';
wn += sl(entities, 1153, 1244) + '\n';  // LaserEmitter 基类（v008 覆写其方法，不重建对象）
wn += sl(entities, 1246, 1413) + '\n';
wn += 'root.Bullet = Bullet;\nroot.PulseGun = PulseGun;\nroot.OrbitBlade = OrbitBlade;\nroot.Weapons = Weapons;\nroot.LaserEmitter = LaserEmitter;\nroot.MortarStrike = MortarStrike;\n';
w('weapon.js', wn);

// 9. wave.js
let wv = HDR('wave.js — 波次模块', [
  '职责：Spawner 刷怪器（v008 波次算法）',
  '全局状态：G.wave（Spawner 单例 waveIndex/waveQuota）',
  '加载顺序：... → wave']) + '\n';
wv += sl(systems, 14, 118) + '\nroot.Spawner = Spawner;\nroot.G.wave = Spawner;\n';
w('wave.js', wv);

// 10. item.js
let it = HDR('item.js — 道具与掉落模块', [
  '职责：RunStats/Experience/ExpLevelUp/CoinDrops/PowerUps',
  '全局状态：G.run(RunStats), G.bag(PowerUps.inventory)',
  '加载顺序：... → item']) + '\n';
it += sl(systems, 152, 203) + '\n' + sl(systems, 205, 291) + '\n' + sl(systems, 293, 525) + '\n' + sl(systems, 527, 602) + '\n' + sl(systems, 604, 764) + '\n';
it += 'root.RunStats = RunStats;\nroot.Experience = Experience;\nroot.ExpLevelUp = ExpLevelUp;\nroot.CoinDrops = CoinDrops;\nroot.PowerUps = PowerUps;\nroot.G.run = RunStats;\nroot.G.bag = PowerUps;\n';
w('item.js', it);

// 11. fx.js
let fx = HDR('fx.js — 特效/工具/UI 基础模块', [
  '职责：UI 绘制工具库；FX 粒子震屏；Metrics；Spatial；ButtonUI；Panels；AudioFX；effects 层 monkey-patch',
  '全局状态：G.ui（UI 单例）',
  '加载顺序：... → fx']) + '\n';
fx += sl(ui, 17, 1400) + '\nroot.UI = UI;\nroot.G.ui = UI;\n';
fx += sl(audio, 13, 76) + '\nroot.AudioFX = AudioFX;\n';
fx += sl(effects, 8, 685) + '\n';
w('fx.js', fx);

// 12. hud.js
let hd = HDR('hud.js — 局内 HUD 与战场模块', [
  '职责：Field 墙壁/炮塔/Boss 掉落；Extraction 撤退点；field 层 monkey-patch',
  '加载顺序：... → hud']) + '\n';
hd += sl(field, 23, 313) + '\n' + sl(field, 316, 549) + '\n' + sl(field, 554, 716) + '\n';
hd += 'root.Field = Field;\nroot.Extraction = Extraction;\n';
w('hud.js', hd);

// 14. menu.js
let m = HDR('menu.js — 菜单/营地/结算/活动模块（合并 v004~v008）', [
  '职责：主菜单/营地/外观/成就/命运抽牌/品质；v004~v008 全部 late 补丁（顺序 v004<v005<v006<v007<v008）',
  '加载顺序：... → hud → ads → menu（最后）']) + '\n';
m += 'var Game=root.Game,UI=root.UI,Input=root.Input,Meta=root.Meta,Player=root.Player,Enemy=root.Enemy,Bullet=root.Bullet,Camera=root.Camera,Combat=root.Combat,Weapons=root.Weapons,PulseGun=root.PulseGun,OrbitBlade=root.OrbitBlade,PowerUps=root.PowerUps,Spawner=root.Spawner,RunStats=root.RunStats,Field=root.Field,LaserEmitter=root.LaserEmitter,FX=root.FX,ButtonUI=root.ButtonUI,Panels=root.Panels,Settings=root.Settings,Ads=root.Ads,AudioFX=root.AudioFX,ExpLevelUp=root.ExpLevelUp,BossSystem=root.BossSystem,Metrics=root.Metrics,CanvasView=root.CanvasView,Platform=root.Platform;\n';
m += '\n// ===== v004 =====\n' + fs.readFileSync(path.join(SRC,'v004.js'),'utf8') + '\n';
m += '\n// ===== v005 =====\n' + fs.readFileSync(path.join(SRC,'v005.js'),'utf8') + '\n';
m += '\n// ===== v006 =====\n' + fs.readFileSync(path.join(SRC,'v006.js'),'utf8') + '\n';
m += '\n// ===== v007 =====\n' + fs.readFileSync(path.join(SRC,'v007.js'),'utf8') + '\n';
m += '\n// ===== v008 =====\n' + fs.readFileSync(path.join(SRC,'v008.js'),'utf8') + '\n';
w('menu.js', m);

console.log('Rebuilt all modules from backup.');

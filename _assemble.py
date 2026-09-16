# -*- coding: utf-8 -*-
# 一次性重构汇编脚本：按行号切片原文件，逐字拼接出新模块（行为等价）。
import os, io

JS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'js')
OUTDIR = JS  # 直接写回 js/（旧文件稍后删除）

def lines(name):
    with io.open(os.path.join(JS, name), 'r', encoding='utf-8') as f:
        return f.read().split('\n')

SRC = {k: lines(v) for k, v in {
    'core':'core.js','ent':'entities.js','sys':'systems.js','meta':'meta.js',
    'game':'game.js','eff':'effects.js','fld':'field.js','ui':'ui.js',
    'v04':'v004.js','v05':'v005.js','v06':'v006.js','v07':'v007.js','v08':'v008.js',
}.items()}

def sl(src,a,b):
    L=SRC[src]; return '\n'.join(L[a-1:b])

FILES={}
def S(f,src,a,b): FILES.setdefault(f,[]).append(('s',(src,a,b)))
def T(f,t): FILES.setdefault(f,[]).append(('t',t))

BOIL="var root = (typeof window !== 'undefined') ? window : global;\nvar CONFIG = root.CONFIG;\n\n"

def head(f,title,body,dep):
    T(f, "'use strict';\n// ============================================================\n// %s\n// 职责：%s\n// 依赖全局：%s\n// 加载顺序：%s\n// ============================================================\n" % (title, body, dep, dep))
    T(f, BOIL)

# ============ 1. core/game.js ============
f='core_game'
head(f,'core/game.js — 主循环/状态机/全局G/摄像机/战斗结算/启动',
     'Game状态机、主循环、CanvasView/Camera/Combat、RunStats、Extraction、boot启动',
     'platform, config 之后加载；内部用裸全局引用 Meta/Player/UI 等（运行时解析）')
T(f,'var G = {}; root.G = G;\n')
S(f,'core',11,27)      # CanvasView
S(f,'core',217,243)    # Camera
S(f,'core',303,318)    # Combat
T(f,'root.CanvasView = CanvasView;\nroot.Camera = Camera;\nroot.Combat = Combat;\n')
S(f,'game',31,445)     # Game base
S(f,'sys',152,203)     # RunStats
T(f,'root.RunStats = RunStats;\n')
S(f,'v04',189,189)     # RunStats.calculateCoins wrap
S(f,'eff',543,548)     # Game.enterLevelUp wrap
S(f,'eff',550,554)     # Game.restart wrap (FX.reset)
S(f,'eff',556,594)     # Game.update wrap
S(f,'eff',597,651)     # Game.draw wrap
S(f,'fld',402,407)     # Game.restart wrap (Field.reset)
S(f,'fld',408,415)     # Game.updatePlaying wrap
S(f,'fld',554,715)     # Extraction
T(f,'root.Extraction = Extraction;\n')
S(f,'fld',437,550)     # Game.draw wrap (field battlefield ordering)
S(f,'v04',197,197)     # Game.restart wrap (NextRun.apply)
S(f,'v04',198,198)     # Game.updateSettlement wrap
S(f,'v04',205,205)     # Game.update wrap (RUNTIME_ERROR/DevConsole/FATE/timeScale)
S(f,'v05',124,124)     # Game.restart wrap (outfit/objectives reset)
S(f,'v05',125,125)     # Game.updatePlaying wrap
S(f,'v05',146,146)     # Game.update wrap (Objectives.handle)
S(f,'v06',116,116)     # Game.update wrap (ACHIEVEMENTS)
S(f,'v07',71,71)       # Game.update wrap (RainbowFX.update)
S(f,'v08',72,72)       # Game.restart wrap (weapon select)
S(f,'v08',74,74)       # Game.update wrap (WEAPON_SELECT/WeaponProgress)
T(f,'root.Game = Game;\n')
# boot 启动逻辑（原 boot.js 合并）：包成 root.boot，由入口在全部模块加载后调用
T(f,'''
// ---------- 启动初始化（原 boot.js 合并为 root.boot，入口最后调用） ----------
root.boot = function () {
root.FX.init();
root.ButtonUI.init();
try {
  root.Game.init();
} catch (error) {
  if (typeof console !== 'undefined' && console.error) console.error('[GAME BOOT]', error);
  var platform = root.Platform;
  var ctx = platform && platform.ctx;
  var canvas = platform && platform.canvas;
  if (ctx && canvas) {
    try {
      ctx.setTransform(1, 0, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#090d0b';
      ctx.fillRect(0, 0, canvas.width || 750, canvas.height || 1334);
      ctx.fillStyle = '#ff6b6b';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 28px Arial';
      ctx.fillText('游戏启动失败', (canvas.width || 750) / 2, 260);
      ctx.fillStyle = '#ffffff'; ctx.font = '18px Arial';
      ctx.fillText('请截图控制台中 [GAME BOOT] 后的错误', (canvas.width || 750) / 2, 320);
    } catch (drawError) {
      if (console && console.error) console.error('[BOOT ERROR PAGE]', drawError);
    }
  }
}
};
''')

# ============ 2. player.js ============
f='player'
head(f,'player.js — 玩家',
     'Player移动/冲刺/受击/属性/外观；含墙体碰撞、下一回合buff、外观装扮补丁',
     'core/game 之后；用裸全局 Field/Meta/Objectives/Achievements 等')
S(f,'ent',13,417)
S(f,'fld',349,355)
S(f,'v04',184,184)
S(f,'v04',192,193)
S(f,'v05',120,120)
S(f,'v05',126,127)
T(f,'root.Player = Player;\n')

# ============ 3. enemy.js ============
f='enemy'
head(f,'enemy.js — 敌人',
     'Enemy类型/AI避障(v008)/精英Boss/Boss投射物；WallCollision墙体碰撞',
     'player 之后；用裸全局 Field/Combat/WeaponProgress 等')
S(f,'v08',17,35)       # CONFIG walls/laser/gadget
T(f,'root.killSource = \'\';\n')  # v05 共享击杀来源标记（原 v005.js:11 var killSource）
S(f,'v08',37,40)       # insideWall/segmentHitsWall/rayDistance + root.WallCollision
T(f,'root.insideWall = insideWall;\nroot.segmentHitsWall = segmentHitsWall;\nroot.rayDistance = rayDistance;\n')  # 裸全局，供 weapon/item/wave 补丁调用
S(f,'ent',419,870)
S(f,'eff',183,187)     # Enemy.update spatial rebuild
S(f,'eff',228,235)     # Enemy.applyDamage
S(f,'eff',238,242)     # Enemy.kill particles
S(f,'v04',185,185)     # Enemy.spawn nextEnemyHp
S(f,'v04',188,188)     # Enemy.kill medkit drop
S(f,'v05',121,121)     # Enemy.drawOne shadow
S(f,'v05',128,128)     # Enemy.kill source tracking
S(f,'v08',47,49)       # Enemy.spawn avoidCheck + moveTowardPlayer replace (var oldEnemySpawn pair)
S(f,'v08',56,57)       # Enemy.updateBossProjectiles replace (var oldBossProjectileUpdate pair)
S(f,'v08',71,71)       # Enemy.kill weaponProgress
T(f,'root.Enemy = Enemy;\n')

# ============ 4. weapon.js ============
f='weapon'
head(f,'weapon.js — 武器',
     '脉冲枪/喷火器/弩箭/飞刃/子弹/激光发射器/武器成长/武器选择',
     'enemy 之后；用裸全局 Enemy/Player/Meta/UI/Input 等')
S(f,'v08',13,15)       # helpers hit/tap/text
S(f,'ent',872,992)     # Bullet
S(f,'ent',994,1049)    # PulseGun
S(f,'ent',1051,1133)   # OrbitBlade
S(f,'ent',1135,1151)   # Weapons
S(f,'ent',1153,1244)   # LaserEmitter base
S(f,'ent',1405,1412)   # pointToSegDist
T(f,'root.Bullet = Bullet;\nroot.PulseGun = PulseGun;\nroot.OrbitBlade = OrbitBlade;\nroot.Weapons = Weapons;\nroot.LaserEmitter = LaserEmitter;\n')  # 提前导出，供后续补丁用 root.X 引用
S(f,'v05',13,18)       # CONFIG.V005 base
S(f,'v05',27,46)       # upgrade defs/config push
S(f,'v05',67,73)       # FlameWeapon
S(f,'v05',76,83)       # Crossbow
S(f,'v04',194,194)     # Bullet.spawn wrap
S(f,'eff',245,250)     # PulseGun.fireAt sound
S(f,'eff',190,225)     # Bullet.checkEnemyHits spatial rebuild (top-level, lives with Bullet)
S(f,'v08',52,53)       # Bullet.shouldRemove wall wrap (var oldBulletRemove pair)
S(f,'v08',54,55)       # Crossbow.update wall wrap (var oldCrossbowUpdate pair)
S(f,'v08',62,63)       # FlameWeapon.fire wall wrap (var oldFlameFire pair)
S(f,'v08',81,88)       # LaserEmitter replaces + selectedMainDamage + pointSeg
S(f,'v05',137,138)     # Weapons.draw wrap
S(f,'v07',72,72)       # Weapons.draw rainbow wrap
S(f,'v08',70,70)       # WeaponProgress
S(f,'v08',76,76)       # WeaponSelect
T(f,'root.Bullet = Bullet;\nroot.PulseGun = PulseGun;\nroot.OrbitBlade = OrbitBlade;\nroot.Weapons = Weapons;\nroot.LaserEmitter = LaserEmitter;\nroot.FlameWeapon = FlameWeapon;\nroot.Crossbow = Crossbow;\nroot.WeaponProgress = WeaponProgress;\nroot.WeaponSelect = WeaponSelect;\nroot.V008 = { WallCollision: root.WallCollision, WeaponProgress: WeaponProgress, WeaponSelect: WeaponSelect };\n')

# ============ 5. wave.js ============
f='wave'
head(f,'wave.js — 波次/战场',
     'Spawner刷怪/BossSystem/Field战场墙体炮塔',
     'weapon 之后；用裸全局 Enemy/PowerUps/BossSystem/RunStats 等')
S(f,'sys',14,118)      # Spawner
S(f,'sys',120,150)     # BossSystem
S(f,'fld',23,314)      # Field object
S(f,'fld',316,347)     # Field.collideWalls
S(f,'fld',386,393)     # BossSystem.onBossDefeated wrap
S(f,'v08',43,44)       # Field.draw wall detail wrap (var oldFieldDraw pair)
S(f,'v08',60,61)       # Field.update wall wrap (var oldFieldUpdate pair)
S(f,'v08',93,97)       # Spawner replaces
T(f,'root.Spawner = Spawner;\nroot.BossSystem = BossSystem;\nroot.Field = Field;\n')

# ============ 6. item.js ============
f='item'
head(f,'item.js — 掉落/道具/升级抽卡/迫击炮',
     'PowerUps主动道具/经验宝石/金币/迫击炮/ExpLevelUp三选一',
     'wave 之后；用裸全局 Enemy/Player/Meta/root.V004 等')
S(f,'sys',205,291)     # Experience
S(f,'sys',293,525)     # ExpLevelUp
S(f,'v05',86,86)       # ExpLevelUp.applyUpgrade wrap (lives with ExpLevelUp)
S(f,'sys',527,602)     # CoinDrops
S(f,'sys',604,764)     # PowerUps
S(f,'ent',1246,1402)   # MortarStrike
T(f,'root.Experience = Experience;\nroot.ExpLevelUp = ExpLevelUp;\nroot.CoinDrops = CoinDrops;\nroot.PowerUps = PowerUps;\nroot.MortarStrike = MortarStrike;\n')  # 提前导出，供后续补丁用 root.X 引用
S(f,'fld',364,383)     # PowerUps.rollDrop elite/boss wrap
S(f,'v04',187,187)     # PowerUps.rollDrop nextDropBonus wrap
S(f,'v04',202,202)     # ExpLevelUp.handleInput wrap
S(f,'v04',240,243)     # MortarStrike wraps
S(f,'v05',129,134)     # PowerUps.activate/useBomb/_explode/collect, CoinDrops.moveCoin, Experience.collectGem
S(f,'v08',58,59)       # MortarStrike.update wall wrap (var oldMortarUpdate pair)
S(f,'v08',89,90)       # PowerUps.activate laser wrap (var oldPowerActivate pair)
S(f,'v07',37,39)       # ExpLevelUp.prepareOffers validation (+validRarity helper)
T(f,'root.Experience = Experience;\nroot.ExpLevelUp = ExpLevelUp;\nroot.CoinDrops = CoinDrops;\nroot.PowerUps = PowerUps;\nroot.MortarStrike = MortarStrike;\n')

# ============ 7. hud.js ============
f='hud'
head(f,'hud.js — 局内HUD/品质/小目标',
     'UI基础对象/血条经验条Boss条/小目标Objectives/道具栏/品质QUALITY',
     'item 之后；定义 UI 基础对象，menu 再扩展菜单部分')
S(f,'ui',17,1401)      # UI base
T(f,'root.UI = UI;\n')
S(f,'v07',11,28)       # QUALITY
T(f,'root.QUALITY = QUALITY;\n')
S(f,'v05',20,24)       # helpers hit/tap/text/panel/diamond
S(f,'v05',52,64)       # Objectives
T(f,'root.Objectives = Objectives;\n')
S(f,'v06',12,17)       # CONFIG.V006
S(f,'v06',18,25)       # v06 helpers
S(f,'v06',97,104)      # UI.drawHud + drawTopStats/drawHpLane/drawExpLane/drawBossLane/ObjectivesDraw/Objectives.handle
S(f,'v06',107,113)     # power buttons + DASH_BUTTON_X
S(f,'eff',654,670)     # UI.drawGround wrap
S(f,'v04',199,202)     # UI.consumeSettlementAction/drawRestartButton/drawLevelUp + ExpLevelUp.handleInput
S(f,'eff',295,309)     # UI.drawUpgradeCard + drawRestartButton wraps
S(f,'fld',428,436)     # UI.drawBossBar wrap

# ============ 8. menu.js ============
f='menu'
head(f,'menu.js — 主菜单/营地/成就/抽牌/DEV控制台',
     '主菜单/幸存者营地Wardrobe/成就Achievements/命运抽牌FateCards/CampNav/MenuLogo/DevConsole',
     'hud 之后；依赖 root.UI/root.Game/root.Wardrobe 等')
T(f,"var Game = root.Game, UI = root.UI, QUALITY = root.QUALITY, Objectives = root.Objectives;\n// 其余跨模块对象（Input/Meta/FX/ButtonUI/Player/Enemy/PowerUps 等）一律用裸全局名在调用时解析，禁止顶层 var 捕获（避免遮蔽后加载模块）。\n")
S(f,'v06',12,17)       # CONFIG.V006
S(f,'v06',18,25)       # helpers
S(f,'v06',29,32)       # MenuLogo
S(f,'v06',35,50)       # UI.drawMenu
S(f,'v06',51,53)       # menuButtonY/drawMenuButton/consumeMenuAction
S(f,'v06',54,54)       # Game.updateMenu
S(f,'v05',89,102)      # Achievements
S(f,'v05',105,112)     # Wardrobe base
S(f,'v05',115,119)     # OutfitColors/applyEquippedLooks
T(f,'root.Achievements = Achievements;\nroot.Wardrobe = Wardrobe;\nroot.OutfitColors = OutfitColors;\n')
S(f,'v06',73,86)       # Wardrobe v06
S(f,'v06',88,90)       # Platform drag
S(f,'v06',117,117)     # V006
S(f,'v07',30,34)       # v07 helpers
S(f,'v07',42,43)       # CampNav + getBaseTabRects
S(f,'v07',44,45)       # Game.enterBase wrap
S(f,'v07',47,53)       # drawBack/drawMoney/drawCampSelect/drawEntry/UI.drawBase
S(f,'v07',55,56)       # updateEnhance + Game.updateBase
S(f,'v07',59,60)       # Wardrobe.handle wrap
S(f,'v07',63,67)       # Wardrobe.rarity/quality/drawGridCard
S(f,'v07',75,77)       # FateCards.rarities/drawCard
S(f,'v08',77,77)       # Game.updateMenu wrap (weapon select button)
S(f,'v04',13,34)        # v04 helpers + V4C const (button/inRect/centered/fateTop/devButtonY/skipLevelY/skipFateY)
S(f,'v04',37,133)      # DevConsole
S(f,'v04',136,170)     # FateCards + initDefs
S(f,'v04',173,181)     # NextRun
S(f,'v04',206,206)     # Platform.onKeyDown
# V004 命名空间：先定义再导出；MortarFX 此时尚未加载（在 fx.js），但该属性随后由 fx.js 覆写，置 null 行为等价。
T(f,"var V004={draw:function(ctx){if(Game.state==='FATE')FateCards.draw(ctx);else if(Game.state==='RUNTIME_ERROR'){ctx.save();ctx.fillStyle='rgba(5,8,7,.94)';ctx.fillRect(0,0,750,1334);centered(ctx,'检测到运行异常',430,38,'#ff6b6b');centered(ctx,'游戏循环已安全暂停，没有继续卡死',495,22,'#fff');var msg=String(Game.runtimeError||'未知异常').split('\\n')[0].slice(0,70);centered(ctx,msg,555,16,'#ffd8a8');centered(ctx,'请截图这一页发给我',620,22,'#ffd166');centered(ctx,'点击任意位置返回主菜单',760,22,'#59e58a');ctx.restore();}else DevConsole.draw(ctx);},DevConsole:DevConsole,FateCards:FateCards,NextRun:NextRun,MortarFX:null};\n")
S(f,'v04',246,246)     # root exports (DevConsole/FateCards/NextRun/V004)

# ============ 9. save.js ============
f='save'
head(f,'save.js — 存档/离线收益',
     'Meta存档读写/损坏自重置/Settings设置/武器成长存档(v008)',
     'menu 之后；用裸全局 Game/Player/Achievements 等')
S(f,'meta',11,329)     # Meta
S(f,'meta',331,352)    # Settings
T(f,'root.Meta = Meta;\nroot.Settings = Settings;\n')
S(f,'v08',66,69)       # Meta.createDefaultData/mergeSafeData wraps
S(f,'v05',135,135)     # Meta.settleRun wrap

# ============ 10. input.js ============
f='input'
head(f,'input.js — 触控/摇杆/DEV控制台触发',
     'Input多点触控/虚拟摇杆/键盘/冲刺；原 effects.js 的 Input 补丁',
     'save 之后；用裸全局 Config/Platform/Game 等')
S(f,'core',30,214)     # Input base
T(f,'root.Input = Input;\n')
S(f,'eff',320,424)      # Input multi-touch patch (activeTouches/onTouchStart/Move/End/Cancel/canStartJoystick/reset)

# ============ 11. fx.js ============
f='fx'
head(f,'fx.js — 特效/粒子/震屏/面板',
     'FX粒子/Metrics/Spatial/ButtonUI/Panels/DamageText/DiamondFX/RainbowFX/MortarFX',
     'input 之后；用裸全局 Enemy/Player/Camera/Meta 等')
S(f,'eff',27,124)      # FX
S(f,'eff',126,158)     # Metrics
S(f,'eff',160,182)     # Spatial
S(f,'eff',252,294)     # ButtonUI
S(f,'eff',426,541)     # Panels
S(f,'core',246,300)    # DamageText
S(f,'v05',20,24)       # v05 drawing helpers (panel/text/diamond used by DiamondFX)
S(f,'v05',49,49)       # DiamondFX
S(f,'v07',70,70)       # RainbowFX
S(f,'v04',209,239)     # MortarFX
T(f,'root.FX = FX;\nroot.Metrics = Metrics;\nroot.Spatial = Spatial;\nroot.ButtonUI = ButtonUI;\nroot.Panels = Panels;\nroot.DamageText = DamageText;\nroot.DiamondFX = DiamondFX;\nroot.RainbowFX = RainbowFX;\nroot.MortarFX = MortarFX;\nroot.V004 = root.V004 || {};\nroot.V004.MortarFX = MortarFX;\nroot.V007 = { QUALITY: root.QUALITY, CampNav: root.CampNav, RainbowFX: RainbowFX };\n')

# ---- 写出 ----
import os
outcore = os.path.join(OUTDIR,'core')
os.makedirs(outcore, exist_ok=True)
name_map={'core_game':os.path.join('core','game.js'),'player':'player.js','enemy':'enemy.js',
 'weapon':'weapon.js','wave':'wave.js','item':'item.js','hud':'hud.js','menu':'menu.js',
 'save':'save.js','input':'input.js','fx':'fx.js'}
import re
def wrap_if_patched(text):
    # 含 var oldX 的块是 monkey-patch：原补丁文件各自独立作用域，拼到同一文件后
    # var oldX 会共享模块作用域导致闭包捕获错乱。包进 IIFE 恢复独立绑定。
    if re.search(r'^var\s+old', text, re.MULTILINE):
        return '(function () {\n' + text + '\n})();'
    return text

for key, chunks in FILES.items():
    buf=[]
    for kind,p in chunks:
        piece = (sl(*p) if kind=='s' else p)
        piece = wrap_if_patched(piece)
        buf.append(piece)
    txt='\n'.join(buf)
    path=os.path.join(OUTDIR,name_map[key])
    with io.open(path,'w',encoding='utf-8',newline='\n') as fh:
        fh.write(txt)
    print('wrote',path,len(txt),'chars')
print('done')

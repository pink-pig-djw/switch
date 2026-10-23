// 《茶室大乱斗》数据：物理常数、角色、招式、场地、CPU 难度
// 坐标：世界单位 = 画布像素（镜头缩放 1 时），y 向下；主平台顶面 y = 0。
// 招式里的判定框 [x, y, r] 相对角色身体中心，x 朝角色面向的方向，y 负值在上方；单位帧（60 帧 / 秒）。

export const STEP = 1 / 60;
export const KB_K = 9.5;          // 击飞单位 → 速度（像素 / 秒）
export const KB_DECAY = 2600;     // 击飞速度每秒衰减
export const STUN_GRAV = 0.25;    // 受击硬直时重力减弱，击飞弧线更漂亮
export const STOCKS = 3;
export const PLAYER_COLORS = ['#ff4b3e', '#2f8fff', '#35c46a', '#ffb21a'];
export const PLAYER_TAGS = ['1P', 'CPU', 'CPU', 'CPU'];

export const DIFFS = [
  { name: '简单', react: 22, shield: 0.06, aggro: 0.45, smash: 0.25, fail: 0.3, di: 0, combo: 0.15, mult: 1 },
  { name: '普通', react: 12, shield: 0.26, aggro: 0.72, smash: 0.5, fail: 0.05, di: 0.5, combo: 0.45, mult: 1.6 },
  { name: '困难', react: 6, shield: 0.5, aggro: 0.92, smash: 0.75, fail: 0, di: 1, combo: 0.8, mult: 2.4 },
];

// 通用招式（各角色再按体型、力量修正）
const BASE = {
  jab: { startup: 3, active: 3, recovery: 10, boxes: [[34, -6, 26]], dmg: 3, base: 18, growth: 30, angle: 40, pose: 'punch' },
  jab3: { startup: 4, active: 3, recovery: 18, boxes: [[42, -6, 30]], dmg: 5, base: 40, growth: 75, angle: 45, pose: 'kick' },
  pummel: { startup: 4, active: 1, recovery: 12, pose: 'punch', pummel: true },
  ftilt: { startup: 6, active: 4, recovery: 16, boxes: [[48, 0, 28], [24, -2, 22]], dmg: 8, base: 34, growth: 100, angle: 36, pose: 'kick' },
  utilt: { startup: 5, active: 6, recovery: 14, boxes: [[12, -52, 30], [20, -22, 22]], dmg: 7, base: 40, growth: 110, angle: 92, pose: 'uppercut' },
  dtilt: { startup: 4, active: 4, recovery: 12, boxes: [[44, 30, 24]], dmg: 6, base: 30, growth: 70, angle: 22, pose: 'lowkick' },
  dash: { startup: 6, active: 8, recovery: 18, boxes: [[32, 0, 32]], dmg: 9, base: 36, growth: 80, angle: 50, pose: 'dash', vel: { x: 420, f0: 0, f1: 14 } },
  nair: { startup: 4, active: 10, recovery: 12, boxes: [[0, 0, 44]], dmg: 8, base: 30, growth: 90, angle: 45, radial: true, pose: 'spin', landLag: 8 },
  fair: { startup: 7, active: 4, recovery: 16, boxes: [[46, -8, 30]], dmg: 10, base: 32, growth: 100, angle: 40, pose: 'kick', landLag: 12 },
  bair: { startup: 6, active: 4, recovery: 14, boxes: [[-48, -2, 30]], dmg: 11, base: 36, growth: 112, angle: 40, back: true, pose: 'back', landLag: 12 },
  uair: { startup: 5, active: 5, recovery: 12, boxes: [[4, -54, 32]], dmg: 8, base: 38, growth: 118, angle: 85, pose: 'uppercut', landLag: 8 },
  dair: { startup: 10, active: 5, recovery: 20, boxes: [[0, 48, 30]], dmg: 11, base: 30, growth: 90, angle: -75, pose: 'stomp', landLag: 16 },
  fsmash: { startup: 14, active: 4, recovery: 28, boxes: [[58, -6, 36], [30, -6, 26]], dmg: 16, base: 44, growth: 112, angle: 38, pose: 'smash', smash: true },
  usmash: { startup: 10, active: 8, recovery: 26, boxes: [[0, -62, 38], [0, -28, 28]], dmg: 15, base: 50, growth: 140, angle: 88, pose: 'usmash', smash: true },
  dsmash: { startup: 8, active: 6, recovery: 26, boxes: [[52, 28, 30], [-52, 28, 30]], dmg: 13, base: 40, growth: 108, angle: 28, radial: true, pose: 'split', smash: true },
  grab: { startup: 6, active: 3, recovery: 22, boxes: [[38, -6, 24]], grab: true, pose: 'grab' },
  ledgeAtk: { startup: 8, active: 4, recovery: 14, boxes: [[34, -4, 34]], dmg: 8, base: 40, growth: 50, angle: 40, pose: 'kick' },
  throwF: { startup: 8, active: 1, recovery: 16, dmg: 8, base: 52, growth: 70, angle: 40, pose: 'punch', throw: true },
  throwB: { startup: 10, active: 1, recovery: 16, dmg: 9, base: 54, growth: 82, angle: 40, back: true, pose: 'back', throw: true },
  throwU: { startup: 8, active: 1, recovery: 18, dmg: 7, base: 62, growth: 76, angle: 90, pose: 'uppercut', throw: true },
  throwD: { startup: 9, active: 1, recovery: 14, dmg: 6, base: 42, growth: 45, angle: 75, pose: 'stomp', throw: true },
  itemThrow: { startup: 5, active: 1, recovery: 12, pose: 'throwP', item: true },
};

// 各角色的必杀技（方向 + B）
const SPECIALS = {
  orange: {
    n: { name: '橙片飞盘', startup: 10, active: 1, recovery: 20, pose: 'throwP', proj: { kind: 'slice', vx: 980, vy: 0, life: 34, r: 18, dmg: 6, base: 22, growth: 45, angle: 30, max: 1 } },
    s: { name: '橙汁冲刺', startup: 8, active: 16, recovery: 16, boxes: [[20, 0, 36]], dmg: 10, base: 38, growth: 80, angle: 40, pose: 'dash', vel: { x: 1100, f0: 8, f1: 24, air: true }, once: 's', landLag: 10 },
    u: { name: '柑橘旋风', startup: 4, active: 24, recovery: 8, boxes: [[0, -10, 44]], dmg: 5, base: 50, growth: 70, angle: 80, pose: 'spin', multi: { every: 6, dmg: 2, base: 14, growth: 0, angle: 95 }, vel: { y: -1380, x: 0, f0: 4, f1: 22, ctrl: 260 }, helpless: true, once: 'u' },
    d: { name: '果核旋转', startup: 6, active: 24, recovery: 14, boxes: [[0, 0, 52]], dmg: 6, base: 46, growth: 80, angle: 55, radial: true, pose: 'spin', multi: { every: 6, dmg: 2, base: 16, growth: 0, angle: 70 }, float: 0.35 },
  },
  bear: {
    n: { name: '蒸汽喷射', startup: 9, active: 24, recovery: 18, boxes: [[62, -16, 40]], dmg: 4, base: 40, growth: 60, angle: 35, pose: 'punch', multi: { every: 5, dmg: 1.6, base: 10, growth: 0, angle: 30 }, steam: true, float: 0.4 },
    s: { name: '熊抱冲撞', startup: 10, active: 18, recovery: 20, boxes: [[30, -4, 40]], dmg: 13, base: 44, growth: 92, angle: 35, pose: 'dash', vel: { x: 900, f0: 10, f1: 28, air: true }, once: 's', landLag: 14 },
    u: { name: '壶盖螺旋', startup: 5, active: 22, recovery: 10, boxes: [[0, -30, 46]], dmg: 9, base: 52, growth: 80, angle: 78, pose: 'usmash', vel: { y: -1180, x: 0, f0: 5, f1: 22, ctrl: 200 }, helpless: true, once: 'u', hitOnce: true },
    d: { name: '泰山压顶', startup: 10, active: 60, recovery: 18, boxes: [[0, 40, 40]], dmg: 12, base: 40, growth: 90, angle: -80, pose: 'stomp', pound: true },
    d2: { name: '泰山压顶', startup: 1, active: 5, recovery: 20, boxes: [[64, 34, 46], [-64, 34, 46]], dmg: 9, base: 44, growth: 76, angle: 70, radial: true, pose: 'split', shock: true },
  },
  ninja: {
    n: { name: '柠檬飞镖', startup: 6, active: 1, recovery: 12, pose: 'throwP', proj: { kind: 'star', vx: 1500, vy: 0, life: 30, r: 13, dmg: 3.5, base: 12, growth: 22, angle: 22, max: 3 } },
    s: { name: '瞬步斩', startup: 7, active: 10, recovery: 18, boxes: [[10, -4, 34]], dmg: 8, base: 34, growth: 72, angle: 45, pose: 'dash', vel: { x: 1700, f0: 7, f1: 17, air: true }, once: 's', landLag: 10, pass: true },
    u: { name: '影跃', startup: 12, active: 4, recovery: 16, boxes: [[0, -4, 40]], dmg: 6, base: 40, growth: 60, angle: 75, pose: 'uppercut', teleport: 280, helpless: true, once: 'u' },
    d: { name: '替身反击', startup: 4, active: 22, recovery: 18, pose: 'shield', counter: true },
  },
  rabbit: {
    n: { name: '抹茶叶弹', startup: 12, active: 1, recovery: 18, pose: 'throwP', proj: { kind: 'leaf', vx: 760, vy: -560, grav: 1900, life: 90, r: 16, dmg: 8, base: 30, growth: 62, angle: 50, max: 2, burst: true } },
    s: { name: '茶筅回旋镖', startup: 10, active: 1, recovery: 18, pose: 'throwP', proj: { kind: 'whisk', vx: 1050, vy: 0, life: 80, r: 20, dmg: 6, base: 26, growth: 52, angle: 40, max: 1, boomerang: true } },
    u: { name: '兔耳螺旋桨', startup: 6, active: 46, recovery: 6, boxes: [[0, -58, 30]], dmg: 4, base: 40, growth: 50, angle: 85, pose: 'usmash', multi: { every: 8, dmg: 1.5, base: 12, growth: 0, angle: 90 }, vel: { y: -640, x: 0, f0: 6, f1: 50, ctrl: 330 }, helpless: true, once: 'u' },
    d: { name: '茶香地雷', startup: 12, active: 1, recovery: 16, pose: 'lowkick', mine: true },
  },
};

// 角色：属性 1~5 只用于选人界面显示
export const CHARS = [
  {
    id: 'orange', name: '橙子侠', title: '均衡全能', desc: '各方面都很均衡，飞盘能牵制，旋风回场稳',
    w: 46, h: 92, weight: 100, run: 560, air: 400, airAcc: 2600, jump: 1000, dj: 950, jumps: 2, grav: 2700, fall: 1100, ffall: 1650,
    dmg: 1, kb: 1, reach: 1, startup: 0, stats: [3, 3, 3, 3], color: '#ff8a1c', alt: '#ff5f7e',
  },
  {
    id: 'bear', name: '茶壶熊', title: '重量级力量', desc: '又重又能打，不容易被击飞，但动作偏慢',
    w: 62, h: 112, weight: 132, run: 430, air: 320, airAcc: 2000, jump: 930, dj: 820, jumps: 2, grav: 2900, fall: 1250, ffall: 1800,
    dmg: 1.28, kb: 1.08, reach: 1.18, startup: 3, stats: [2, 5, 5, 2], color: '#8b5a2b', alt: '#d9a441',
  },
  {
    id: 'ninja', name: '柠檬忍者', title: '轻快连击', desc: '速度最快、三段跳，飞镖连发；就是太轻了',
    w: 40, h: 84, weight: 78, run: 720, air: 480, airAcc: 3200, jump: 1080, dj: 980, jumps: 3, grav: 2800, fall: 1180, ffall: 1780,
    dmg: 0.82, kb: 0.95, reach: 0.92, startup: -2, stats: [5, 2, 1, 5], color: '#f5c400', alt: '#9ccc3a',
  },
  {
    id: 'rabbit', name: '抹茶兔', title: '远程牵制', desc: '飘得远、跳得高，叶弹 + 回旋镖 + 地雷放风筝',
    w: 44, h: 96, weight: 88, run: 520, air: 430, airAcc: 2600, jump: 1060, dj: 1010, jumps: 2, grav: 2300, fall: 920, ffall: 1420,
    dmg: 0.95, kb: 1, reach: 1, startup: 0, stats: [3, 2, 2, 4], color: '#7cb342', alt: '#f48fb1',
  },
];
export const STAT_NAMES = ['速度', '力量', '重量', '跳跃'];

// 根据角色修正通用招式
export function buildMoves(ch) {
  const out = {};
  const scaleBox = (b) => [b[0] * ch.reach, b[1] * ch.reach, b[2] * ch.reach];
  const fix = (name, m, isSpecial) => {
    const o = { ...m, name: m.name || name, key: name };
    if (o.boxes) o.boxes = o.boxes.map(scaleBox);
    if (!isSpecial) o.startup = Math.max(2, o.startup + (o.smash ? ch.startup : Math.round(ch.startup * 0.5)));
    if (o.dmg) o.dmg *= ch.dmg;
    if (o.base) o.base *= ch.kb;
    if (o.growth) o.growth *= ch.kb;
    if (o.multi) o.multi = { ...o.multi, dmg: o.multi.dmg * ch.dmg };
    o.total = o.startup + o.active + o.recovery;
    out[name] = o;
  };
  for (const [k, m] of Object.entries(BASE)) fix(k, m, false);
  const sp = SPECIALS[ch.id];
  fix('nspec', sp.n, true);
  fix('sspec', sp.s, true);
  fix('uspec', sp.u, true);
  fix('dspec', sp.d, true);
  if (sp.d2) fix('dspec2', sp.d2, true);
  return out;
}

export function specialNames(ch) {
  const s = SPECIALS[ch.id];
  return [['B', s.n.name], ['→B', s.s.name], ['↑B', s.u.name], ['↓B', s.d.name]];
}

// 场地：main 是实心主平台（可以抓边），plats 是可以从下面穿过的平台
export const STAGES = [
  {
    id: 'roof', name: '茶室屋顶', desc: '月夜屋顶，三块能穿过的木台',
    main: { x1: -480, x2: 480, y: 0, depth: 150 },
    plats: [{ x1: -370, x2: -150, y: -190 }, { x1: 150, x2: 370, y: -190 }, { x1: -110, x2: 110, y: -360 }],
  },
  {
    id: 'tray', name: '漂浮茶盘', desc: '夕阳云海，两只茶碟平台会漂移',
    main: { x1: -420, x2: 420, y: 0, depth: 70 },
    plats: [
      { x1: -110, x2: 110, y: -200, path: { ax: 300, ay: 0, period: 9, phase: 0 } },
      { x1: -90, x2: 90, y: -380, path: { ax: 0, ay: 70, period: 6, phase: 1.5 }, ox: 230 },
    ],
  },
  {
    id: 'dojo', name: '竹林道场', desc: '没有平台的宽擂台，硬碰硬',
    main: { x1: -540, x2: 540, y: 0, depth: 130 },
    plats: [],
  },
];
export const BLAST_SIDE = 970;    // 主平台边缘到左右爆线的距离
export const BLAST_TOP = -850;
export const BLAST_BOTTOM = 700;

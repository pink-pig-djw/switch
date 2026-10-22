// 《橙子大冒险》关卡数据：每关由若干区域（主关卡 / 隐藏奖励房间 / 出口）组成，12 行高，图块 16px
export const ROWS = 12;
export const E = 0, GROUND = 1, BRICK = 2, BOX = 3, USED = 4, HARD = 5, PIPE = 6, CLOUD = 7, BRIDGE = 8,
  SPIKE = 9, LAVA = 10, HIDDEN = 11, MULTI = 12, WALL = 13;
export const SOLID = new Set([GROUND, BRICK, BOX, USED, HARD, PIPE, MULTI, WALL]);
export const ONEWAY = new Set([CLOUD, BRIDGE]);
// 管道外观
export const P_TL = 1, P_TR = 2, P_L = 3, P_R = 4, P_HT = 5, P_HB = 6, P_HL = 7;

class Area {
  constructor(id, w, theme, music) {
    this.id = id;
    this.w = w;
    this.h = ROWS;
    this.theme = theme;
    this.music = music;
    this.grid = new Uint8Array(w * ROWS);
    this.skin = new Uint8Array(w * ROWS);
    this.content = new Map();
    this.enemies = [];
    this.coins = [];
    this.lifts = [];
    this.pipes = [];
    this.decor = [];
    this.spawns = {};
    this.flag = null;
    this.house = null;
    this.checks = [];
    this.firebars = [];
    this.boss = null;
  }
  set(x, y, v, skin = 0) {
    if (x < 0 || x >= this.w || y < 0 || y >= ROWS) return;
    this.grid[y * this.w + x] = v;
    this.skin[y * this.w + x] = skin;
  }
  ground(x0, x1, top = 10, v = GROUND) {
    for (let x = x0; x < x1; x++) for (let y = top; y < ROWS; y++) this.set(x, y, v);
    return this;
  }
  fill(x0, y0, x1, y1, v) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) this.set(x, y, v);
    return this;
  }
  row(x, y, n, v = BRICK) {
    for (let i = 0; i < n; i++) this.set(x + i, y, v);
    return this;
  }
  box(x, y, what = 'coin') {
    this.set(x, y, BOX);
    this.content.set(y * this.w + x, what);
    return this;
  }
  hidden(x, y, what = '1up') {
    this.set(x, y, HIDDEN);
    this.content.set(y * this.w + x, what);
    return this;
  }
  multi(x, y) {
    this.set(x, y, MULTI);
    this.content.set(y * this.w + x, 'multi');
    return this;
  }
  brickItem(x, y, what) {
    this.set(x, y, BRICK);
    this.content.set(y * this.w + x, what);
    return this;
  }
  column(x, h, base = 9, v = HARD) {
    for (let i = 0; i < h; i++) this.set(x, base - i, v);
    return this;
  }
  stairsUp(x, n, base = 9) {
    for (let i = 0; i < n; i++) this.column(x + i, i + 1, base);
    return this;
  }
  stairsDown(x, n, base = 9) {
    for (let i = 0; i < n; i++) this.column(x + i, n - i, base);
    return this;
  }
  pipe(x, h, opts = {}) {
    const base = opts.base ?? 9;
    const top = base - h + 1;
    for (let y = top; y <= base; y++) {
      this.set(x, y, PIPE, y === top ? P_TL : P_L);
      this.set(x + 1, y, PIPE, y === top ? P_TR : P_R);
    }
    if (opts.to || opts.exitName) this.pipes.push({ x, y: top, h, dir: opts.to ? 'down' : null, to: opts.to || null });
    if (opts.exitName) this.spawns[opts.exitName] = { x: x * 16 + 10, y: top * 16, mode: 'pipeUp' };
    return this;
  }
  // 朝左开口的横向管道（走进去），后面连一根竖管到顶
  sidePipe(x, y, to) {
    this.set(x, y, PIPE, P_HT);
    this.set(x, y + 1, PIPE, P_HB);
    for (const yy of [y, y + 1]) {
      this.set(x + 1, yy, PIPE, P_HL);
      this.set(x + 2, yy, PIPE, P_HL);
    }
    for (let yy = 0; yy <= y + 1; yy++) {
      this.set(x + 3, yy, PIPE, P_L);
      this.set(x + 4, yy, PIPE, P_R);
    }
    this.pipes.push({ x, y, h: 2, dir: 'right', to });
    return this;
  }
  coin(x, y) {
    this.coins.push({ x: x * 16, y: y * 16 });
    return this;
  }
  coinRow(x, y, n) {
    for (let i = 0; i < n; i++) this.coin(x + i, y);
    return this;
  }
  enemy(type, x, y = 9, opts = {}) {
    this.enemies.push({ type, x: x * 16, y: y * 16, ...opts });
    return this;
  }
  lift(x, y, kind = 'h', range = 32, speed = 1, w = 3) {
    this.lifts.push({ x: x * 16, y: y * 16, w: w * 16, kind, range, speed });
    return this;
  }
  firebar(x, y, len = 5, speed = 1.6) {
    this.firebars.push({ x: x * 16 + 8, y: y * 16 + 8, len, speed });
    return this;
  }
  deco(kind, x, y) {
    this.decor.push({ kind, x: x * 16, y: y * 16 });
    return this;
  }
  flagpole(x) {
    this.column(x, 1, 9);
    this.flag = { x: x * 16, top: 3 * 16, bottom: 9 * 16 };
    return this;
  }
  teahouse(x) {
    this.house = { x: x * 16, y: 10 * 16 - 80, door: x * 16 + 40 };
    return this;
  }
  spawn(name, x, y, mode = 'stand') {
    this.spawns[name] = { x: x * 16 + 2, y: y * 16, mode };
    return this;
  }
  checkpoint(x, y = 9) {
    this.checks.push({ x: x * 16, y: y * 16 });
    return this;
  }
}

// ———————————————————— 1-1 茶园小径 ————————————————————
// 布局为原创：起步教学 → 小土坡 → 木桥 + 砖拱 → 茶罐管道区（隐藏奖励房间）→ 踢壳保龄球 → 茶园梯田 → 终点阶梯
function level11() {
  const a = new Area('main', 224, 'field', 'field');
  a.spawn('start', 3, 9);
  a.ground(0, 62).ground(64, 109).ground(112, 158).ground(161, 224);
  // 背景装饰
  for (const x of [4, 58, 108, 166, 206]) a.deco('hill', x, 7.5);
  for (const x of [20, 44, 93, 131, 178, 214]) a.deco('bush', x, 9);
  for (const x of [12, 34, 74, 118, 186]) a.deco('teabush', x, 9);
  for (const [x, y] of [[6, 2.2], [17, 1.5], [31, 2.6], [45, 1.8], [61, 2.4], [79, 1.4], [94, 2.7], [108, 1.9],
    [126, 2.3], [141, 1.5], [159, 2.6], [176, 1.8], [193, 2.2], [210, 1.6]]) a.deco('cloud', x, y);

  // ① 起步：一串橙子币教跳跃，一个道具箱，一只史莱姆
  a.coinRow(8, 7, 3);
  a.box(14, 6, 'coin');
  a.enemy('slime', 21);
  // ② 小土坡，坡后高处的道具箱里是大橙子
  a.column(25, 1).column(26, 2).column(27, 2).column(28, 1);
  a.box(31, 5, 'power');
  a.enemy('slime', 35);
  // ③ 两段木桥一路往上，接一座砖拱（拱下有两只史莱姆，拱顶上方一排币）
  a.row(38, 8, 3, BRIDGE).row(42, 6, 3, BRIDGE).coinRow(42, 5, 3);
  a.row(47, 6, 8).box(49, 6, 'coin').multi(52, 6);
  a.coinRow(48, 3, 6);
  a.enemy('slime', 50).enemy('slime', 52.5);
  // ④ 第一个小坑，上方一道币弧
  a.coin(61, 7).coin(62, 6).coin(63, 6).coin(64, 7);
  // ⑤ 茶罐管道区：最高的那根能钻进去
  a.pipe(68, 3);
  a.enemy('slime', 73).enemy('slime', 74.5);
  a.pipe(77, 2);
  a.enemy('snail', 81);
  a.pipe(86, 4, { to: { area: 'bonus', spawn: 'drop' } });
  // ⑥ 高低两层砖台，台后藏着一个看不见的加命块
  a.row(91, 6, 3).box(92, 6, 'power');
  a.row(95, 3, 4).coinRow(95, 2, 4);
  a.hidden(100, 6, '1up');
  a.pipe(103, 2, { exitName: 'fromBonus' });
  // ⑦ 第二个坑
  a.coinRow(109, 6, 3);
  // ⑧ 存档点 + 踢壳保龄球：把蜗牛壳踢出去，一路撞倒砖棚下的四只史莱姆
  a.checkpoint(114);
  a.enemy('snail', 119);
  a.row(124, 6, 10).box(127, 6, 'coin').box(130, 6, 'power');
  a.coinRow(125, 2, 8);
  a.enemy('slime', 126).enemy('slime', 128).enemy('slime', 130).enemy('slime', 132);
  // ⑨ 茶园梯田：三级抬高的田埂，种满茶树
  a.fill(138, 9, 143, 9, GROUND).fill(144, 8, 149, 9, GROUND).fill(150, 7, 157, 9, GROUND);
  a.deco('teabush', 139, 8).deco('teabush', 145, 7).deco('teabush', 151, 6);
  a.enemy('snail', 147, 7);
  a.coinRow(151, 4, 4);
  // ⑩ 最后一段：茶罐、砖台、两只史莱姆，然后是终点阶梯和旗杆
  a.pipe(166, 3);
  a.enemy('slime', 171);
  a.row(174, 6, 4).box(175, 6, 'coin').multi(176, 6);
  a.enemy('slime', 180).enemy('slime', 181.5);
  a.stairsUp(186, 6).column(192, 6);
  a.coinRow(195, 3, 3);
  a.flagpole(200);
  a.teahouse(204);
  a.deco('fence', 198, 9).deco('fence', 212, 9);

  // 隐藏奖励房间：一个橙子形状的币阵 + 加命箱，按 ↓ 从茶罐回去
  const b = new Area('bonus', 22, 'cave', 'cave');
  b.ground(0, 22, 10).fill(0, 0, 0, 11, HARD).fill(21, 0, 21, 11, HARD).fill(1, 0, 20, 0, HARD);
  b.coinRow(5, 8, 12).coinRow(5, 7, 12).coinRow(6, 6, 10);
  b.box(11, 4, '1up');
  b.spawn('drop', 2, 1, 'drop');
  b.pipe(17, 2, { to: { area: 'main', spawn: 'fromBonus' } });
  return { name: '1-1', label: '茶园小径', time: 300, areas: { main: a, bonus: b }, start: { area: 'main', spawn: 'start' } };
}

// ———————————————————— 1-2 地下茶窖 ————————————————————
// 布局为原创：斜排道具箱 → 上下两条路的矮隧道 → 石柱厅（奖励房间）→ 升降台深坑 → 砖墙小屋 → 茶罐出口
function level12() {
  const a = new Area('main', 200, 'cave', 'cave');
  a.spawn('start', 2, 9);
  a.ground(0, 48).ground(51, 92).ground(110, 148).ground(150, 200);
  a.fill(0, 0, 199, 0, HARD).fill(0, 1, 0, 9, HARD);
  // ① 斜着往上排的三个道具箱
  a.box(9, 7, 'coin').box(12, 6, 'power').box(15, 5, 'coin');
  a.enemy('slime', 17).enemy('slime', 18.5);
  // ② 矮隧道：下层贴地走、捡一串币；上层在砖顶上走，有刺猬和一块多币砖
  a.row(22, 6, 23);
  a.coinRow(24, 9, 18);
  a.enemy('slime', 30).enemy('slime', 36).enemy('slime', 41);
  a.enemy('hedge', 32, 5);
  a.multi(38, 2).coinRow(26, 4, 4);
  // ③ 石柱厅：高低错落的石柱，柱顶各有币；可以钻进去的茶罐通往奖励房间
  for (const [x, h] of [[55, 3], [59, 1], [62, 3], [66, 2], [69, 3]]) a.column(x, h).coin(x, 9 - h).coin(x, 8 - h);
  a.enemy('bee', 64, 5, { range: 34 });
  a.enemy('snail', 72);
  a.pipe(76, 3, { to: { area: 'bonus', spawn: 'drop' } });
  a.enemy('slime', 81);
  a.pipe(86, 2, { exitName: 'fromBonus' });
  // ④ 深坑：三块升降台（左右 / 上下 / 左右）
  a.lift(93, 8, 'h', 24, 0.9, 4).lift(100, 7, 'v', 16, 1.0, 4).lift(105, 8, 'h', 18, 1.0, 4);
  a.coinRow(94, 6, 2).coinRow(101, 4, 2).coinRow(106, 6, 2);
  // ⑤ 存档点 + 砖墙小屋：两侧是高砖墙，踩台阶翻进去、再踩屋里的石墩翻出来
  a.checkpoint(112);
  a.stairsUp(115, 3);
  a.fill(118, 4, 119, 9, BRICK);
  a.coinRow(121, 8, 7).box(124, 6, 'power');
  a.enemy('hedge', 125);
  a.column(128, 1).column(129, 3);
  a.fill(130, 4, 131, 9, BRICK);
  a.stairsDown(132, 3);
  a.enemy('slime', 138).enemy('snail', 142);
  // ⑥ 最后一段：小坑、隐藏加命块、通往地面的茶罐
  a.row(156, 6, 5).box(158, 6, 'coin');
  a.hidden(165, 6, '1up');
  a.enemy('slime', 168).enemy('slime', 169.5).enemy('hedge', 173);
  a.pipe(178, 3, { to: { area: 'exit', spawn: 'pipe' } });
  a.fill(184, 0, 199, 11, HARD);

  const b = new Area('bonus', 22, 'cave', 'cave');
  b.ground(0, 22, 10).fill(0, 0, 0, 11, HARD).fill(21, 0, 21, 11, HARD).fill(1, 0, 20, 0, HARD);
  b.row(4, 6, 14, BRIDGE).coinRow(4, 5, 14).coinRow(5, 8, 12);
  b.box(10, 2, '1up');
  b.spawn('drop', 2, 1, 'drop');
  b.pipe(18, 2, { to: { area: 'main', spawn: 'fromBonus' } });

  // 出口：从茶罐里钻出来，走过两级田埂和小阶梯，抓住旗杆
  const e = new Area('exit', 48, 'field', 'field');
  e.ground(0, 48);
  e.deco('hill', 14, 7.5).deco('bush', 40, 9).deco('cloud', 6, 2).deco('cloud', 24, 1.6).deco('teabush', 11, 8);
  e.pipe(3, 2, { exitName: 'pipe' });
  e.fill(10, 9, 13, 9, GROUND).fill(14, 8, 16, 9, GROUND);
  e.coinRow(10, 6, 4);
  e.stairsUp(20, 4).column(24, 4);
  e.flagpole(31);
  e.teahouse(35);
  return { name: '1-2', label: '地下茶窖', time: 300, areas: { main: a, bonus: b, exit: e }, start: { area: 'main', spawn: 'start' } };
}

// ———————————————————— 1-3 天空 ————————————————————
function level13() {
  const a = new Area('main', 200, 'sky', 'sky');
  a.spawn('start', 2, 9);
  a.ground(0, 16);
  for (const [x, y] of [[6, 3], [22, 2], [38, 3.4], [56, 2.2], [74, 3], [92, 2.4], [110, 3], [128, 2.2], [146, 3], [164, 2.4], [182, 3]]) a.deco('cloud', x, y);
  a.coinRow(9, 6, 3);
  a.row(18, 8, 4, CLOUD).coinRow(18, 7, 4);
  a.ground(24, 30, 9);
  a.enemy('slime', 27, 8);
  a.row(32, 6, 3, CLOUD);
  a.ground(37, 44, 10);
  a.box(40, 6, 'power');
  a.enemy('bee', 42, 6, { range: 40 });
  a.lift(46, 8, 'h', 30, 0.8);
  a.coinRow(47, 6, 3);
  a.ground(54, 58, 8);
  a.enemy('snail', 56, 7);
  a.row(60, 7, 3, CLOUD).row(65, 5, 3, CLOUD);
  a.coinRow(65, 4, 3);
  a.enemy('bee', 70, 7, { range: 36 });
  a.ground(72, 84, 10);
  a.checkpoint(74);
  a.row(77, 6, 4).box(78, 6, 'coin').box(79, 6, 'power');
  a.enemy('slime', 82);
  a.lift(86, 7, 'v', 30, 1.0);
  a.lift(92, 6, 'h', 28, 1.1);
  a.coinRow(91, 4, 4);
  a.ground(99, 104, 9);
  a.enemy('bee', 102, 5, { range: 30 });
  a.row(106, 8, 3, CLOUD).row(111, 6, 3, CLOUD).row(116, 8, 3, CLOUD);
  a.coinRow(111, 5, 3);
  a.enemy('bee', 114, 4, { range: 44 });
  a.ground(121, 134, 10);
  a.enemy('snail', 126).enemy('slime', 130);
  a.row(124, 6, 3).multi(125, 6);
  a.lift(136, 8, 'h', 34, 0.9);
  a.lift(144, 6, 'v', 30, 1.2);
  a.ground(149, 155, 9);
  a.hidden(151, 5, '1up');
  a.row(157, 7, 2, CLOUD).row(161, 7, 2, CLOUD);
  a.enemy('bee', 160, 5, { range: 30 });
  a.ground(165, 200, 10);
  a.stairsUp(168, 6).column(174, 6);
  a.flagpole(183);
  a.teahouse(187);
  return { name: '1-3', label: '天空', time: 300, areas: { main: a }, start: { area: 'main', spawn: 'start' } };
}

// ———————————————————— 1-4 城堡 + Boss ————————————————————
function level14() {
  const a = new Area('main', 160, 'castle', 'castle');
  a.spawn('start', 2, 6);
  a.ground(0, 14, 7).fill(0, 0, 13, 2, HARD);
  a.ground(14, 22, 10).fill(14, 0, 40, 1, HARD);
  a.ground(22, 26, 10, LAVA).ground(26, 40, 10);
  a.lift(22, 8, 'h', 10, 1.2, 2);
  a.column(28, 1, 9).firebar(28, 9, 5, 1.5);
  a.enemy('hedge', 32);
  a.box(34, 6, 'power');
  a.column(38, 1, 9).firebar(38, 9, 5, -1.7);
  a.ground(40, 50, 10, LAVA);
  a.lift(41, 7, 'h', 40, 0.9);
  a.ground(50, 70, 10);
  a.fill(50, 0, 70, 3, HARD);
  a.checkpoint(52);
  a.row(54, 9, 3, SPIKE);
  a.row(54, 6, 3);
  a.enemy('slime', 60).enemy('slime', 62).enemy('hedge', 66);
  a.column(64, 1, 6).firebar(64, 6, 4, 2.0);
  a.ground(70, 76, 10, LAVA);
  a.lift(70, 8, 'v', 20, 1.3, 2);
  a.ground(76, 92, 10);
  a.row(80, 9, 2, SPIKE).row(86, 9, 2, SPIKE);
  a.coinRow(80, 6, 2).coinRow(86, 6, 2);
  a.box(83, 6, 'power');
  a.ground(92, 98, 10, LAVA);
  a.lift(92, 7, 'h', 24, 1.1, 2);
  a.ground(98, 160, 10);
  a.fill(98, 0, 106, 3, HARD);
  a.enemy('snail', 104);
  // Boss 房间：打倒 Boss 后右侧的石门打开，里面就是茶室
  a.fill(108, 0, 108, 5, HARD);
  a.fill(110, 0, 159, 1, HARD);
  a.boss = { x: 140 * 16, y: 8 * 16, arenaL: 110 * 16, arenaR: 150 * 16 };
  a.fill(150, 2, 159, 4, HARD);
  a.fill(150, 5, 150, 9, HARD);
  a.gate = { x: 150, y0: 5, y1: 9 };
  a.teahouse(153);
  return { name: '1-4', label: '城堡', time: 400, areas: { main: a }, start: { area: 'main', spawn: 'start' }, castle: true };
}

export const LEVELS = [level11, level12, level13, level14];

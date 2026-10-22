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

// ———————————————————— 1-1 草原 ————————————————————
function level11() {
  const a = new Area('main', 216, 'field', 'field');
  a.spawn('start', 3, 9);
  a.ground(0, 69).ground(71, 86).ground(89, 153).ground(155, 216);
  // 背景装饰
  for (const x of [0, 48, 96, 144, 192]) a.deco('hill', x, 7.5);
  for (const x of [11, 41, 59, 89, 107, 137, 157, 185]) a.deco('bush', x, 9);
  for (const [x, y] of [[8, 2.5], [19, 1.6], [27, 2.8], [36, 1.8], [56, 2.4], [67, 1.6], [75, 2.8], [84, 1.8], [104, 2.4], [115, 1.6], [123, 2.8], [132, 1.8], [152, 2.4], [163, 1.6], [171, 2.8], [180, 1.8]]) a.deco('cloud', x, y);
  for (const x of [24, 72, 120, 168]) a.deco('teabush', x, 9);
  a.box(10, 6, 'coin');
  a.row(16, 6, 5).box(17, 6, 'power').box(19, 6, 'coin').box(18, 2, 'coin');
  a.enemy('slime', 22);
  a.pipe(28, 2);
  a.pipe(38, 3);
  a.enemy('slime', 41).enemy('slime', 43.5);
  a.pipe(46, 4, { to: { area: 'bonus', spawn: 'drop' } });
  a.enemy('slime', 51).enemy('slime', 52.5);
  a.pipe(57, 4, { exitName: 'fromBonus' });
  a.hidden(64, 5, '1up');
  a.row(77, 6, 3).box(78, 6, 'power');
  a.row(80, 2, 8);
  a.enemy('slime', 81, 1).enemy('slime', 83, 1);
  a.row(91, 2, 3).box(94, 2, 'coin').multi(94, 6);
  a.enemy('snail', 97);
  a.row(100, 6, 2).brickItem(101, 6, 'power');
  a.checkpoint(104);
  a.box(106, 6).box(109, 6, 'coin').box(112, 6).box(109, 2, 'power');
  a.enemy('slime', 108).enemy('slime', 110);
  a.row(118, 6, 1);
  a.row(121, 2, 3);
  a.enemy('slime', 124).enemy('slime', 125.5);
  a.row(128, 2, 4).box(129, 2, 'coin').box(130, 2, 'coin');
  a.row(129, 6, 2);
  a.enemy('snail', 132);
  a.stairsUp(134, 4).stairsDown(140, 4);
  a.stairsUp(148, 4).column(152, 4).stairsDown(155, 4);
  a.pipe(163, 2);
  a.row(168, 6, 4).box(170, 6, 'coin');
  a.enemy('slime', 172).enemy('slime', 173.5);
  a.pipe(179, 2);
  a.stairsUp(183, 7).column(190, 7);
  a.coinRow(193, 5, 3);
  a.flagpole(199);
  a.teahouse(203);
  a.deco('fence', 197, 9).deco('fence', 201, 9);

  const b = new Area('bonus', 20, 'cave', 'cave');
  b.ground(0, 20, 10).fill(0, 0, 0, 11, GROUND).fill(1, 0, 19, 0, BRICK);
  b.row(3, 9, 11, BRICK);
  b.coinRow(3, 8, 11).coinRow(4, 6, 9).coinRow(5, 4, 7);
  b.spawn('drop', 2, 1, 'drop');
  b.sidePipe(15, 8, { area: 'main', spawn: 'fromBonus' });
  return { name: '1-1', label: '草原', time: 300, areas: { main: a, bonus: b }, start: { area: 'main', spawn: 'start' } };
}

// ———————————————————— 1-2 地下 ————————————————————
function level12() {
  const a = new Area('main', 196, 'cave', 'cave');
  a.spawn('start', 2, 9);
  a.ground(0, 80).ground(100, 120).ground(124, 128).ground(132, 196);
  a.fill(0, 0, 0, 9, BRICK);
  a.row(6, 1, 140).row(6, 0, 140, HARD);
  a.box(10, 6, 'power').box(11, 6).box(12, 6).box(13, 6).box(14, 6);
  a.enemy('slime', 16).enemy('slime', 17.5);
  a.column(18, 1).column(20, 2).column(22, 3).column(24, 4).column(26, 4).column(28, 3);
  a.coinRow(23, 4, 4);
  a.enemy('slime', 30);
  a.fill(32, 5, 33, 7, BRICK).fill(36, 5, 36, 7, BRICK).fill(37, 7, 38, 7, BRICK).fill(39, 5, 39, 7, BRICK);
  a.coinRow(37, 6, 2);
  a.brickItem(33, 5, 'power');
  a.enemy('hedge', 42);
  a.fill(44, 5, 45, 9, BRICK).coinRow(44, 4, 2);
  a.row(48, 6, 10).multi(52, 6);
  a.enemy('hedge', 50).enemy('slime', 54).enemy('slime', 55.5);
  a.pipe(60, 3);
  a.pipe(64, 4, { to: { area: 'bonus', spawn: 'drop' } });
  a.enemy('snail', 68);
  a.pipe(72, 2, { exitName: 'fromBonus' });
  a.coinRow(80, 5, 3);
  a.lift(84, 7, 'h', 22, 0.9);
  a.lift(90, 6, 'v', 24, 1.1);
  a.lift(96, 7, 'h', 22, 1.0);
  a.checkpoint(102);
  a.row(106, 6, 6).box(108, 6, 'power').hidden(111, 2, '1up');
  a.enemy('hedge', 109).enemy('snail', 114);
  a.row(120, 9, 4, BRIDGE).row(128, 9, 4, BRIDGE);
  a.coinRow(120, 7, 4).coinRow(128, 7, 4);
  a.enemy('slime', 134).enemy('slime', 135.5).enemy('hedge', 140);
  a.stairsUp(146, 6).column(152, 6).column(153, 6);
  a.coinRow(155, 3, 4);
  a.enemy('slime', 160).enemy('slime', 162);
  a.sidePipe(170, 8, { area: 'exit', spawn: 'pipe' });
  a.fill(175, 0, 195, 11, HARD);

  const b = new Area('bonus', 20, 'cave', 'cave');
  b.ground(0, 20, 10).fill(0, 0, 0, 11, GROUND).fill(1, 0, 19, 0, BRICK);
  b.coinRow(3, 8, 11).coinRow(3, 5, 11).row(3, 6, 11, BRICK);
  b.box(8, 2, '1up');
  b.spawn('drop', 2, 1, 'drop');
  b.sidePipe(15, 8, { area: 'main', spawn: 'fromBonus' });

  const e = new Area('exit', 44, 'field', 'field');
  e.ground(0, 44);
  e.deco('hill', 0, 7.5).deco('bush', 34, 9).deco('cloud', 6, 2).deco('cloud', 20, 1.6);
  e.pipe(2, 2, { exitName: 'pipe' });
  e.stairsUp(9, 7).column(16, 7);
  e.flagpole(25);
  e.teahouse(29);
  return { name: '1-2', label: '地下', time: 300, areas: { main: a, bonus: b, exit: e }, start: { area: 'main', spawn: 'start' } };
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

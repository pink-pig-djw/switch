// 泼彩大作战：4 对 4 的俯视角涂地对战（原创角色“果冻精灵”、原创地图与配乐）。
// 两分钟内把更多地面涂成本队颜色：喷颜料、潜进本队颜料里回墨和赶路、扔彩弹炸弹、放必杀“彩虹喷泉”。
import { GameBase, drawTitleCard, drawResult, Particles } from './common.js';
import { W, H, clamp, lerp, text, textW, fillRR, strokeRR, glyph, outlineText, makeCanvas, axisX, easeOutCubic, easeOutBack, mulberry32 } from '../ui.js';
import { parseTrack } from '../audio.js';

// ———————————————————— 尺寸与参数 ————————————————————
const TS = 40, COLS = 30, ROWS = 15;
const MW = COLS * TS, MH = ROWS * TS;          // 地图 1200 × 600
const WX = 40, WY = 104;                        // 地图左上角在屏幕上的位置
const TOPM = 12;                                // 墙顶面向上凸出的高度
const CS = 6, GC = MW / CS, GR = MH / CS;       // 涂色格 6 px：200 × 100 格
const MATCH = 120;                              // 一局 2 分钟
const T_FLOOR = 0, T_WALL = 1, T_WATER = 2, T_PAD = 3;
const INK_SHOT = 1.35, INK_BOMB = 55, SHOT_DMG = 20, SHOT_SPEED = 660;
const SP_GAIN = 0.045;                          // 每涂一格新地面增加的必杀能量
const R = 15;                                   // 角色半径

const TEAMS = [
  null,
  { id: 1, name: '橙队', color: '#ff7a1a', dark: '#c64d05', light: '#ffc28c' },
  { id: 2, name: '青队', color: '#12c2d6', dark: '#068596', light: '#93ecf4' },
];
const NAMES = [null, ['你', '小橘', '阿柚', '芒芒'], ['薄荷', '青柠', '海盐', '苏打']];
const RAINBOW = ['#ff5a5a', '#ffa23a', '#ffe14a', '#5ad16a', '#3ab8ff', '#9a6bff'];

// ———————————————————— 地图（只写左半边 15 列，右半边镜像生成，两队完全公平） ————————————————————
// #：墙  b：木箱（也挡路）  ~：水池（走不过去，颜料弹能飞过）  S：出生台  P：出生点  .：地面
const MAPS = [
  {
    name: '果园广场',
    floor: ['#f4ead6', '#ece0c6'],
    wall: { top: '#9c86c7', front: '#6f5a9e', line: '#b7a5dc' },
    left: [
      '###############',
      '#..............',
      '#...b....#.....',
      '#........#..b..',
      '#SSS...........',
      '#SSS..##....~~.',
      '#SSS..##....~~.',
      '#SPS........##.',
      '#SSS..##....~~.',
      '#SSS..##....~~.',
      '#SSS...........',
      '#........#..b..',
      '#...b....#.....',
      '#..............',
      '###############',
    ],
  },
  {
    name: '汽水码头',
    floor: ['#e3edf1', '#d6e4ea'],
    wall: { top: '#6fa0b8', front: '#4a7389', line: '#9cc6d8' },
    left: [
      '###############',
      '#.....~~~......',
      '#.....~~~..b...',
      '#SSS..~~~......',
      '#SSS.....~~~...',
      '#SSS.....~~~...',
      '#SSS..b........',
      '#SPS......##...',
      '#SSS..b........',
      '#SSS.....~~~...',
      '#SSS.....~~~...',
      '#SSS..~~~......',
      '#.....~~~..b...',
      '#.....~~~......',
      '###############',
    ],
  },
];

function buildMap(def) {
  const tile = new Uint8Array(COLS * ROWS);
  const padTeam = new Uint8Array(COLS * ROWS);
  const crate = new Uint8Array(COLS * ROWS);
  const spawn = [null, null, null];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < 15; c++) {
      const ch = def.left[r][c];
      for (const [cc, team] of [[c, 1], [COLS - 1 - c, 2]]) {
        const i = r * COLS + cc;
        if (ch === '#' || ch === 'b') { tile[i] = T_WALL; crate[i] = ch === 'b' ? 1 : 0; }
        else if (ch === '~') tile[i] = T_WATER;
        else if (ch === 'S' || ch === 'P') {
          tile[i] = T_PAD;
          padTeam[i] = team;
          if (ch === 'P') spawn[team] = { x: (cc + 0.5) * TS, y: (r + 0.5) * TS };
        } else tile[i] = T_FLOOR;
      }
    }
  }
  return { def, tile, padTeam, crate, spawn };
}

// ———————————————————— 原创配乐 ————————————————————
const LEAD = [
  'E5:2 G5:2 -:1 E5:1 G5:2 A5:2 G5:2 E5:2 D5:2', 'C5:3 D5:1 E5:2 C5:2 A4:4 -:4',
  'E5:2 G5:2 -:1 E5:1 G5:2 B5:2 A5:2 G5:2 E5:2', 'D5:3 E5:1 D5:2 B4:2 G4:4 -:4',
  'A4:2 C5:2 E5:2 A5:2 G5:3 E5:1 D5:2 C5:2', 'D5:2 E5:2 G5:2 E5:2 D5:4 C5:4',
  'F5:2 E5:2 D5:2 C5:2 D5:2 E5:2 G5:4', 'C6:4 G5:2 E5:2 C5:4 -:4',
  'A5:1 -:1 A5:2 G5:2 E5:2 G5:2 A5:2 C6:4', 'B5:2 A5:2 G5:2 E5:2 D5:6 -:2',
  'G5:1 -:1 G5:2 F5:2 D5:2 F5:2 G5:2 B5:4', 'A5:2 G5:2 F5:2 D5:2 E5:6 -:2',
  'E5:2 F5:2 G5:2 A5:2 B5:2 C6:2 D6:2 E6:2', 'D6:2 C6:2 B5:2 A5:2 G5:4 E5:4',
  'F5:2 A5:2 C6:2 A5:2 G5:2 E5:2 D5:2 B4:2', 'C5:4 E5:2 G5:2 C6:4 -:4',
].join(' ');
const CHORD = { C: ['C3', 'G3', 'C4', 'G4'], Am: ['A2', 'E3', 'A3', 'E4'], Em: ['E2', 'B2', 'E3', 'G4'], G: ['G2', 'D3', 'G3', 'B4'], F: ['F2', 'C3', 'F3', 'A4'], Dm: ['D3', 'A3', 'D4', 'F4'] };
const PROG = ['C', 'Am', 'Em', 'G', 'Am', 'G', 'F', 'C', 'Am', 'G', 'Dm', 'Am', 'F', 'G', 'F', 'C'];
const BASS = PROG.map((k) => { const [r, f, o] = CHORD[k]; return `${r}:2 -:1 ${r}:1 ${o}:2 ${r}:2 ${f}:2 ${r}:2 ${o}:2 ${f}:2`; }).join(' ');
const STAB = PROG.map((k) => { const n = CHORD[k][3]; return `-:2 ${n}:2 -:2 ${n}:2 -:2 ${n}:2 -:2 ${n}:2`; }).join(' ');
const DRUM = Array(16).fill('k:2 h:2 s:2 h:1 k:1 k:2 h:2 s:2 h:2').join(' ');
const SONG = {
  bpm: 140,
  tracks: [
    { wave: 'p25', vol: 0.12, gate: 0.82, notes: parseTrack(LEAD) },
    { wave: 'triangle', vol: 0.24, gate: 0.7, notes: parseTrack(BASS) },
    { wave: 'p12', vol: 0.045, gate: 0.4, notes: parseTrack(STAB) },
    { wave: 'noise', vol: 0.07, notes: parseTrack(DRUM) },
  ],
};

// ———————————————————— 小工具 ————————————————————
const angDiff = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

// 果冻精灵：圆滚滚的身体 + 头顶小芽 + 看向瞄准方向的眼睛（HOME 磁贴和 HUD 也用）
function drawJellyBody(c, r, team, flash) {
  const T = TEAMS[team];
  const g = c.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.12, 0, 0, r * 1.08);
  g.addColorStop(0, flash ? '#ffffff' : T.light);
  g.addColorStop(0.55, flash ? '#ffffff' : T.color);
  g.addColorStop(1, T.dark);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-r, r * 0.25);
  c.bezierCurveTo(-r, -r * 0.75, -r * 0.55, -r * 1.02, 0, -r * 1.02);
  c.bezierCurveTo(r * 0.55, -r * 1.02, r, -r * 0.75, r, r * 0.25);
  c.bezierCurveTo(r, r * 0.8, r * 0.5, r * 0.92, 0, r * 0.92);
  c.bezierCurveTo(-r * 0.5, r * 0.92, -r, r * 0.8, -r, r * 0.25);
  c.fill();
  // 头顶的小芽
  c.strokeStyle = T.dark;
  c.lineWidth = Math.max(1.5, r * 0.16);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, -r * 0.98);
  c.quadraticCurveTo(r * 0.05, -r * 1.35, r * 0.38, -r * 1.42);
  c.stroke();
  c.fillStyle = T.light;
  c.beginPath();
  c.arc(r * 0.42, -r * 1.42, r * 0.17, 0, Math.PI * 2);
  c.fill();
  // 高光
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.beginPath();
  c.ellipse(-r * 0.4, -r * 0.48, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  c.fill();
}

// 身体预先画成小图（按显示倍数缓存），每帧只做一次 drawImage，省掉渐变和曲线
const bodyCache = new Map();
function jellySprite(team, r, S, flash) {
  const key = `${team}|${r}|${S}|${flash ? 1 : 0}`;
  let e = bodyCache.get(key);
  if (!e) {
    const w = Math.ceil(r * 2.3), h = Math.ceil(r * 2.85), oy = Math.ceil(r * 1.82);
    const cv = makeCanvas(Math.ceil(w * S), Math.ceil(h * S));
    const g = cv.getContext('2d');
    g.scale(S, S);
    g.translate(w / 2, oy);
    drawJellyBody(g, r, team, flash);
    e = { cv, w, h, oy };
    bodyCache.set(key, e);
  }
  return e;
}

function drawJelly(c, x, y, r, team, o = {}) {
  const aim = o.aim ?? 0;
  const sq = o.squash || 0;
  c.save();
  c.translate(x, y);
  if (o.shadow !== false) {
    c.fillStyle = 'rgba(30,20,40,0.22)';
    c.beginPath();
    c.ellipse(0, r * 0.82, r * 0.95, r * 0.34, 0, 0, Math.PI * 2);
    c.fill();
  }
  if (o.hop) c.translate(0, -o.hop);
  c.scale(1 + sq, 1 - sq);
  if (o.S) {
    const e = jellySprite(team, r, o.S, o.flash);
    c.drawImage(e.cv, -e.w / 2, -e.oy, e.w, e.h);
  } else drawJellyBody(c, r, team, o.flash);
  // 眼睛
  const ex = Math.cos(aim) * r * 0.2, ey = Math.sin(aim) * r * 0.14;
  if (!o.dead) {
    c.fillStyle = '#ffffff';
    c.beginPath();
    for (const s of [-1, 1]) {
      const cx = s * r * 0.33 + ex * 0.6, cy = -r * 0.08 + ey * 0.6;
      c.moveTo(cx + r * 0.22, cy);
      c.ellipse(cx, cy, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
    }
    c.fill();
    c.fillStyle = '#2a1d38';
    c.beginPath();
    for (const s of [-1, 1]) {
      const cx = s * r * 0.33 + ex * 0.6 + ex * 0.45, cy = -r * 0.08 + ey * 0.6 + ey * 0.5;
      c.moveTo(cx + r * 0.11, cy);
      c.ellipse(cx, cy, r * 0.11, r * 0.15, 0, 0, Math.PI * 2);
    }
    c.fill();
  } else {
    c.strokeStyle = '#2a1d38';
    c.lineWidth = r * 0.12;
    c.beginPath();
    for (const s of [-1, 1]) {
      const cx = s * r * 0.33;
      c.moveTo(cx - r * 0.14, -r * 0.22);
      c.lineTo(cx + r * 0.14, r * 0.06);
      c.moveTo(cx + r * 0.14, -r * 0.22);
      c.lineTo(cx - r * 0.14, r * 0.06);
    }
    c.stroke();
  }
  c.restore();
}

function splatShape(c, x, y, r, color, rnd) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2, d = r * (0.85 + rnd() * 0.5), rr = r * (0.18 + rnd() * 0.25);
    c.beginPath();
    c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, 0, Math.PI * 2);
    c.fill();
  }
}

function drawTurfTile(c, s) {
  const k = s / 256;
  c.save();
  c.scale(k, k);
  const g = c.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, '#3a2a5c');
  g.addColorStop(1, '#22183a');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  const rnd = mulberry32(17);
  splatShape(c, 70, 90, 62, TEAMS[1].color, rnd);
  splatShape(c, 40, 170, 34, TEAMS[1].color, rnd);
  splatShape(c, 190, 120, 58, TEAMS[2].color, rnd);
  splatShape(c, 218, 40, 30, TEAMS[2].color, rnd);
  c.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 14; i++) {
    c.beginPath();
    c.arc(rnd() * 256, rnd() * 180, 2 + rnd() * 3, 0, Math.PI * 2);
    c.fill();
  }
  drawJelly(c, 82, 110, 30, 1, { aim: 0.2 });
  drawJelly(c, 178, 130, 30, 2, { aim: Math.PI - 0.2 });
  outlineText(c, '泼彩大作战', 128, 214, 40, '#ffffff', '#3a1f5c', 9);
  c.restore();
}

// ———————————————————— 游戏 ————————————————————
export class Turf extends GameBase {
  static meta = { id: 'turf', name: '泼彩大作战', kind: 'game', color: '#ff7a1a', tile: drawTurfTile };

  constructor(os) {
    super(os);
    this.mapIdx = clamp(Number(os.store.get('turf.map', 0)) || 0, 0, MAPS.length - 1);
    this.owner = new Uint8Array(GC * GR);
    this.paintable = new Uint8Array(GC * GR);
    this.counts = [0, 0, 0];
    this.total = 1;
    this.paintCv = makeCanvas(MW, MH);
    this.pctx = this.paintCv.getContext('2d');
    this.parts = new Particles(500);
    this.rnd = mulberry32(99);
    this.q = new Int16Array(COLS * ROWS);
    this.inp = { mx: 0, my: 0, shoot: false, dive: false, bomb: false, bombDist: 0, special: false, aimA: null };
    this.staticScale = 0;
    this.prevAx = 0;
    this._setupMatch(true);
    this.setMode('title');
  }

  close() {
    this.sfx.music.stop();
  }

  // ———————— 对局准备 ————————
  _setupMatch(demo) {
    this.demo = demo;
    this.map = buildMap(MAPS[this.mapIdx]);
    this.staticScale = 0;
    this._initPaint();
    this.chars = [];
    this.teams = [null, [], []];
    for (const team of [1, 2]) {
      for (let i = 0; i < 4; i++) {
        const ch = this._newChar(team, i, !demo && team === 1 && i === 0);
        this.chars.push(ch);
        this.teams[team].push(ch);
        this._placeAtSpawn(ch);
      }
    }
    this.player = demo ? null : this.teams[1][0];
    this.bullets = [];
    this.bombs = [];
    this.ripples = [];
    this.rings = [];
    this.feed = [];
    this.popups = [];
    this.banner = null;
    this.parts.clear();
    this.time = MATCH;
    this.last30 = false;
    this.lastBeep = 0;
    this.shake = 0;
    this.final = null;
  }

  _initPaint() {
    const M = this.map;
    this.owner.fill(0);
    this.paintable.fill(0);
    let total = 0;
    for (let gy = 0; gy < GR; gy++) {
      for (let gx = 0; gx < GC; gx++) {
        const tx = ((gx + 0.5) * CS / TS) | 0, ty = ((gy + 0.5) * CS / TS) | 0;
        const ti = ty * COLS + tx;
        const i = gy * GC + gx;
        if (M.tile[ti] === T_FLOOR) { this.paintable[i] = 1; total++; }
        else if (M.tile[ti] === T_PAD) this.owner[i] = M.padTeam[ti];
      }
    }
    this.total = Math.max(1, total);
    this.counts = [total, 0, 0];
    this.pctx.clearRect(0, 0, MW, MH);
  }

  _newChar(team, idx, isPlayer) {
    return {
      team, idx, name: NAMES[team][idx], isPlayer,
      x: 0, y: 0, vx: 0, vy: 0, kx: 0, ky: 0,
      hp: 100, ink: 100, special: 0, alive: true, respawn: 0, inv: 0,
      dive: false, sub: false, wasSub: false, onPad: true, moving: false,
      aim: team === 1 ? 0 : Math.PI, moveA: team === 1 ? 0 : Math.PI,
      fireCd: 0, bombCd: 0, noFire: 1, hurtT: 0, lastHit: -99, lastBy: null,
      kills: 0, deaths: 0, painted: 0, wob: Math.random() * 6, rippleT: 0, sp: -1, spHit: false, lowInkT: 0, denyT: 0,
      ai: isPlayer ? null : {
        mode: 'paint', goal: null, target: null, thinkT: Math.random() * 0.3, dist: new Int16Array(COLS * ROWS),
        strafe: Math.random() < 0.5 ? -1 : 1, strafeT: 0, aimErr: 0, lane: idx % 3, stuck: 0, lx: 0, ly: 0,
        react: 0, phase: Math.random() * 6, bombRoll: false, spRoll: false, burst: true, burstT: 0,
      },
    };
  }

  _placeAtSpawn(ch) {
    const s = this.map.spawn[ch.team];
    const off = [[0, 0], [0, -55], [0, 55], [0, -110]][ch.idx];
    ch.x = s.x + off[0];
    ch.y = s.y + off[1];
    ch.vx = ch.vy = ch.kx = ch.ky = 0;
    ch.hp = 100;
    ch.ink = 100;
    ch.alive = true;
    ch.inv = 1.5;
    ch.dive = ch.sub = false;
    ch.sp = -1;
    ch.aim = ch.moveA = ch.team === 1 ? 0 : Math.PI;
    if (ch.ai) { ch.ai.mode = 'paint'; ch.ai.goal = null; ch.ai.target = null; }
  }

  start() {
    this._setupMatch(false);
    this.setMode('ready');
    this.sfx.music.stop();
  }

  // ———————— 地图查询 ————————
  _tile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return T_WALL;
    return this.map.tile[ty * COLS + tx];
  }
  _solidFor(team, tx, ty) {
    const t = this._tile(tx, ty);
    if (t === T_WALL || t === T_WATER) return true;
    return t === T_PAD && this.map.padTeam[ty * COLS + tx] !== team;
  }
  _blocked(team, x, y, r) {
    const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS);
    const y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this._solidFor(team, tx, ty)) return true;
    return false;
  }
  _isWall(x, y) {
    return this._tile(Math.floor(x / TS), Math.floor(y / TS)) === T_WALL;
  }
  _cellOwner(x, y) {
    const gx = clamp((x / CS) | 0, 0, GC - 1), gy = clamp((y / CS) | 0, 0, GR - 1);
    return this.owner[gy * GC + gx];
  }
  // 视线：只有墙挡（水面上颜料弹能飞过去）
  _los(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 12);
    for (let i = 1; i < n; i++) {
      const k = i / n;
      if (this._isWall(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k)) return false;
    }
    return true;
  }
  _clearWalk(team, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 10);
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      if (this._blocked(team, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, R * 0.85)) return false;
    }
    return true;
  }

  // ———————— 涂色 ————————
  _paint(x, y, r, team, by, draw = true) {
    const r2 = r * r;
    const c0 = Math.max(0, Math.floor((x - r) / CS)), c1 = Math.min(GC - 1, Math.floor((x + r) / CS));
    const r0 = Math.max(0, Math.floor((y - r) / CS)), r1 = Math.min(GR - 1, Math.floor((y + r) / CS));
    let gained = 0;
    const own = this.owner, pt = this.paintable, cnt = this.counts;
    for (let gy = r0; gy <= r1; gy++) {
      const dy = (gy + 0.5) * CS - y;
      const row = gy * GC;
      for (let gx = c0; gx <= c1; gx++) {
        const dx = (gx + 0.5) * CS - x;
        if (dx * dx + dy * dy > r2) continue;
        const i = row + gx;
        if (!pt[i]) continue;
        const o = own[i];
        if (o === team) continue;
        cnt[o]--;
        cnt[team]++;
        own[i] = team;
        gained++;
      }
    }
    if (by && gained) {
      by.painted += gained;
      if (by.sp < 0) by.special = Math.min(100, by.special + gained * SP_GAIN);
    }
    if (draw) {
      const p = this.pctx;
      p.fillStyle = TEAMS[team].color;
      p.beginPath();
      p.arc(x, y, r, 0, Math.PI * 2);
      p.fill();
    }
    return gained;
  }

  _splat(x, y, r, team, by, sat = 4) {
    this._paint(x, y, r, team, by);
    for (let i = 0; i < sat; i++) {
      const a = this.rnd() * Math.PI * 2, d = r * (0.75 + this.rnd() * 0.6);
      this._paint(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.22 + this.rnd() * 0.28), team, by);
    }
  }

  // ———————— 主循环 ————————
  update(dt, pad) {
    this.t += dt;
    this.modeT += dt;
    this.shake = Math.max(0, this.shake - dt * 2);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
    switch (this.mode) {
      case 'title': this._updateTitle(dt, pad); break;
      case 'ready':
        this._effects(dt);
        if (this.modeT >= 1.9) {
          this.setMode('play');
          this.sfx.music.play(SONG, this);
          this._beep(true);
          this._banner('开始！', '#ffe14a', 0.9);
        } else if (Math.floor(this.modeT / 0.6) !== Math.floor((this.modeT - dt) / 0.6)) this._beep(false);
        break;
      case 'play': this._updatePlay(dt, pad); break;
      case 'finish':
        this._effects(dt);
        if (this.modeT > 2) this._judge();
        break;
      case 'judge':
        if (this.modeT > 3.8 || (this.modeT > 1.2 && pad.pressed.A)) this._toResult();
        break;
      case 'result':
        if (this.modeT > 0.6 && pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
        else if (this.modeT > 0.6 && pad.pressed.B) {
          this.sfx.play('back');
          this._setupMatch(true);
          this.setMode('title');
        }
        break;
      default: break;
    }
  }

  _updateTitle(dt, pad) {
    const ax = axisX(pad);
    const dir = pad.pressed.LEFT ? -1 : pad.pressed.RIGHT ? 1 : Math.abs(ax) > 0.6 && Math.abs(this.prevAx) <= 0.6 ? Math.sign(ax) : 0;
    this.prevAx = ax;
    if (dir) {
      this.mapIdx = (this.mapIdx + dir + MAPS.length) % MAPS.length;
      this.os.store.set('turf.map', this.mapIdx);
      this.sfx.play('tick');
      this._setupMatch(true);
    }
    // 标题背景：8 个电脑选手的表演赛，打满 50 秒就重新开始
    this._sim(dt, null);
    this.time -= dt;
    if (this.time < MATCH - 50) this._setupMatch(true);
    if (pad.pressed.A) {
      this.sfx.play('confirm');
      this.start();
    }
  }

  _updatePlay(dt, pad) {
    this._sim(dt, pad);
    const prev = this.time;
    this.time -= dt;
    if (!this.last30 && this.time <= 30) {
      this.last30 = true;
      this._banner('最后 30 秒！', '#ff5a5a', 1.8);
      this.sfx.music.rate = 1.18;
      this.sfx.tone('square', 988, 988, 0.12, 0.07);
      this.sfx.tone('square', 1318, 1318, 0.2, 0.07, 0.14);
    }
    if (this.time <= 5 && Math.ceil(this.time) !== Math.ceil(prev)) this._beep(false);
    if (this.time <= 0) {
      this.time = 0;
      this.setMode('finish');
      this.sfx.music.stop();
      this._banner('比赛结束！', '#ffffff', 2);
      this.sfx.tone('sine', 2100, 2350, 0.45, 0.09);
      this.sfx.tone('sine', 2350, 2000, 0.55, 0.07, 0.5);
    }
  }

  _beep(go) {
    if (go) this.sfx.tone('square', 1320, 1320, 0.38, 0.07);
    else this.sfx.tone('square', 880, 880, 0.12, 0.06);
  }

  _judge() {
    const a = this.counts[1] / this.total * 100, b = this.counts[2] / this.total * 100;
    const win = this.counts[1] > this.counts[2] ? 1 : this.counts[2] > this.counts[1] ? 2 : 0;
    const P = this.player;
    const score = P ? P.painted + (win === 1 ? 1000 : 0) + P.kills * 50 : 0;
    this.final = { a, b, win, score, painted: P ? P.painted : 0, kills: P ? P.kills : 0, deaths: P ? P.deaths : 0 };
    this.setMode('judge');
    this.sfx.tone('triangle', 330, 330, 0.12, 0.08);
  }

  _toResult() {
    this.submitScore(this.final.score);
    this.setMode('result');
    this.sfx.play(this.final.win === 1 ? 'win' : 'gameover');
  }

  _banner(str, color, dur = 1.6) {
    this.banner = { text: str, color, t: 0, dur };
  }

  // ———————— 模拟 ————————
  _sim(dt, pad) {
    for (const ch of this.chars) {
      if (!ch.alive) {
        ch.respawn -= dt;
        if (ch.respawn <= 0) this._placeAtSpawn(ch);
        continue;
      }
      const inp = !ch.isPlayer ? this._aiInput(ch, dt) : pad ? this._playerInput(ch, pad) : this._idleInput();
      this._stepChar(ch, inp, dt);
    }
    // 同队之间轻轻推开，不叠在一起
    const L = this.chars;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 > 900 || d2 < 0.01) continue;
        const d = Math.sqrt(d2), push = (30 - d) * 0.5;
        this._move(a, (-dx / d) * push, (-dy / d) * push);
        this._move(b, (dx / d) * push, (dy / d) * push);
      }
    }
    this._updateBullets(dt);
    this._updateBombs(dt);
    this._effects(dt);
  }

  _effects(dt) {
    this.parts.update(dt);
    for (let i = this.ripples.length - 1; i >= 0; i--) if ((this.ripples[i].t += dt) > 0.6) this.ripples.splice(i, 1);
    for (let i = this.rings.length - 1; i >= 0; i--) if ((this.rings[i].t += dt) > this.rings[i].dur) this.rings.splice(i, 1);
    for (let i = this.feed.length - 1; i >= 0; i--) if ((this.feed[i].t += dt) > 4.5) this.feed.splice(i, 1);
    for (let i = this.popups.length - 1; i >= 0; i--) if ((this.popups[i].t += dt) > 1.1) this.popups.splice(i, 1);
  }

  _move(ch, dx, dy) {
    if (dx && !this._blocked(ch.team, ch.x + dx, ch.y, R)) ch.x += dx;
    else if (dx) ch.vx *= 0.3;
    if (dy && !this._blocked(ch.team, ch.x, ch.y + dy, R)) ch.y += dy;
    else if (dy) ch.vy *= 0.3;
  }

  _stepChar(ch, inp, dt) {
    ch.inv = Math.max(0, ch.inv - dt);
    ch.fireCd -= dt;
    ch.bombCd -= dt;
    ch.noFire += dt;
    ch.hurtT = Math.max(0, ch.hurtT - dt);
    ch.lowInkT = Math.max(0, ch.lowInkT - dt);
    ch.denyT = Math.max(0, ch.denyT - dt);
    const tx = Math.floor(ch.x / TS), ty = Math.floor(ch.y / TS);
    ch.onPad = this._tile(tx, ty) === T_PAD && this.map.padTeam[ty * COLS + tx] === ch.team;
    const cell = this._cellOwner(ch.x, ch.y);
    const own = cell === ch.team, enemy = cell !== 0 && !own;

    // 必杀进行中：原地起跳、落地冲击波
    if (ch.sp >= 0) {
      ch.sp += dt;
      ch.vx = ch.vy = 0;
      if (ch.sp >= 0.38 && !ch.spHit) this._specialBlast(ch);
      if (ch.sp >= 0.38 && ch.sp < 0.95) this._paint(ch.x, ch.y, lerp(40, 165, (ch.sp - 0.38) / 0.57), ch.team, ch);
      if (ch.sp >= 1.05) ch.sp = -1;
      return;
    }

    ch.dive = inp.dive;
    ch.sub = ch.dive && own;
    if (ch.sub && !ch.wasSub && ch.isPlayer) this.sfx.play('slide');
    if (!ch.sub && ch.wasSub) this.parts.emit(ch.x, ch.y, 6, { color: TEAMS[ch.team].color, speed: 120, life: 0.3, size: 5, shape: 'circle' });
    ch.wasSub = ch.sub;
    let speed = ch.sub ? 330 : ch.dive ? 125 : inp.shoot ? 175 : 210;
    if (enemy && !ch.onPad) {
      speed *= 0.5;
      if (ch.hp > 40) ch.hp = Math.max(40, ch.hp - 16 * dt);
    }
    let mx = inp.mx, my = inp.my;
    const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }
    const k = 1 - Math.exp(-dt * 14);
    ch.vx += (mx * speed - ch.vx) * k;
    ch.vy += (my * speed - ch.vy) * k;
    const kd = Math.exp(-dt * 6);
    ch.kx *= kd;
    ch.ky *= kd;
    this._move(ch, (ch.vx + ch.kx) * dt, (ch.vy + ch.ky) * dt);
    ch.moving = Math.hypot(ch.vx, ch.vy) > 40;
    if (mag > 0.2) ch.moveA = Math.atan2(my, mx);
    if (inp.aimA != null) ch.aim = inp.aimA;

    // 回墨 / 回血
    if (ch.sub) {
      ch.ink = Math.min(100, ch.ink + 50 * dt);
      if (this.t - ch.lastHit > 1) ch.hp = Math.min(100, ch.hp + 40 * dt);
    } else {
      if (!inp.shoot && ch.noFire > 0.45) ch.ink = Math.min(100, ch.ink + (ch.dive ? 6 : 11) * dt);
      if (!enemy && this.t - ch.lastHit > 2) ch.hp = Math.min(100, ch.hp + 14 * dt);
    }

    if (inp.shoot && !ch.dive) {
      ch.noFire = 0;
      if (ch.fireCd <= 0) {
        if (ch.ink >= INK_SHOT) {
          this._fire(ch);
          ch.ink -= INK_SHOT;
          ch.fireCd = 0.105;
        } else {
          ch.lowInkT = 0.8;
          ch.fireCd = 0.25;
          if (ch.isPlayer && ch.denyT <= 0) { this.sfx.play('deny'); ch.denyT = 0.6; }
        }
      }
    }
    if (inp.bomb && ch.bombCd <= 0) {
      if (ch.ink >= INK_BOMB) this._throwBomb(ch, inp.bombDist || 250);
      else {
        ch.lowInkT = 0.8;
        if (ch.isPlayer && ch.denyT <= 0) { this.sfx.play('deny'); ch.denyT = 0.4; }
      }
    }
    if (inp.special) {
      if (ch.special >= 100) this._startSpecial(ch);
      else if (ch.isPlayer && ch.denyT <= 0) { this.sfx.play('deny'); ch.denyT = 0.4; }
    }
    ch.wob += dt * (ch.moving ? 15 : 4);
    if (ch.sub && ch.moving) {
      ch.rippleT -= dt;
      if (ch.rippleT <= 0) {
        this.ripples.push({ x: ch.x, y: ch.y, t: 0 });
        ch.rippleT = 0.2;
      }
    }
  }

  _idleInput() {
    const inp = this.inp;
    inp.mx = inp.my = 0;
    inp.shoot = inp.dive = inp.bomb = inp.special = false;
    inp.aimA = null;
    return inp;
  }

  // ———————— 玩家操作 ————————
  _playerInput(ch, pad) {
    const inp = this.inp;
    inp.mx = axisX(pad);
    inp.my = pad.down.UP && !pad.down.DOWN ? -1 : pad.down.DOWN && !pad.down.UP ? 1 : Math.abs(pad.ly) > 0.2 ? -pad.ly : 0;
    inp.shoot = !!(pad.down.A || pad.down.ZR);
    inp.dive = !!(pad.down.B || pad.down.ZL);
    inp.bomb = !!pad.pressed.R;
    inp.bombDist = 250;
    inp.special = !!pad.pressed.X;
    const rm = Math.hypot(pad.rx, pad.ry);
    if (rm > 0.35) inp.aimA = Math.atan2(-pad.ry, pad.rx);
    else {
      // 没用右摇杆：朝移动方向瞄准，并对附近的对手做一点辅助瞄准
      let base = Math.hypot(inp.mx, inp.my) > 0.2 ? Math.atan2(inp.my, inp.mx) : ch.aim;
      let best = null, bd = 0.5;
      for (const o of this.chars) {
        if (o.team === ch.team || !o.alive) continue;
        const d = Math.hypot(o.x - ch.x, o.y - ch.y);
        if (d > 330 || !this._canSee(ch, o, d)) continue;
        const da = Math.abs(angDiff(base, Math.atan2(o.y - ch.y, o.x - ch.x)));
        if (da < bd) { bd = da; best = o; }
      }
      if (best) base += angDiff(base, Math.atan2(best.y - ch.y, best.x - ch.x)) * 0.7;
      inp.aimA = base;
    }
    return inp;
  }

  // ———————— 武器 ————————
  _fire(ch) {
    const a = ch.aim + (this.rnd() - 0.5) * 0.12;
    const c = Math.cos(a), s = Math.sin(a);
    this.bullets.push({ x: ch.x + c * 16, y: ch.y + s * 16 - 2, vx: c * SHOT_SPEED, vy: s * SHOT_SPEED, team: ch.team, by: ch, life: 0.48 + this.rnd() * 0.06, drop: 12 });
    if (ch.isPlayer) this.sfx.noise(0.05, 0.05, 'bandpass', 2600, 1100);
  }

  _updateBullets(dt) {
    const B = this.bullets;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i];
      const steps = Math.max(1, Math.ceil((SHOT_SPEED * dt) / 14));
      const sdt = dt / steps;
      let dead = false;
      for (let s = 0; s < steps && !dead; s++) {
        const nx = b.x + b.vx * sdt, ny = b.y + b.vy * sdt;
        if (this._isWall(nx, ny)) {
          this._splat(b.x, b.y, 11, b.team, b.by, 2);
          dead = true;
          break;
        }
        for (const o of this.chars) {
          if (o.team === b.team || !o.alive) continue;
          const dx = o.x - nx, dy = o.y - ny;
          if (dx * dx + dy * dy < (R + 4) * (R + 4)) {
            this._paint(nx, ny, 8, b.team, b.by);
            this._damage(o, SHOT_DMG, b.by);
            dead = true;
            break;
          }
        }
        b.x = nx;
        b.y = ny;
        b.drop -= SHOT_SPEED * sdt;
        if (b.drop <= 0) {
          this._paint(b.x, b.y, 5, b.team, b.by);
          b.drop = 9;
        }
      }
      b.life -= dt;
      if (!dead && b.life <= 0) {
        this._splat(b.x, b.y, 13 + this.rnd() * 3, b.team, b.by, 3);
        dead = true;
      }
      if (dead) { B[i] = B[B.length - 1]; B.pop(); }
    }
  }

  _damage(o, dmg, by) {
    if (o.inv > 0 || o.onPad || o.sp >= 0) return;
    o.hp -= dmg;
    o.hurtT = 0.12;
    o.lastHit = this.t;
    o.lastBy = by;
    if (o.isPlayer) { this.shake = Math.max(this.shake, 0.25); this.sfx.play('hit'); }
    else if (by && by.isPlayer) this.sfx.tone('triangle', 1500, 1200, 0.05, 0.06);
    if (o.hp <= 0) this._ko(o, by);
  }

  _ko(v, by) {
    v.alive = false;
    v.hp = 0;
    v.respawn = 3;
    v.deaths++;
    v.special *= 0.75;
    v.sp = -1;
    const team = by ? by.team : (v.team === 1 ? 2 : 1);
    if (by) by.kills++;
    this._splat(v.x, v.y, 52, team, by, 8);
    this.parts.emit(v.x, v.y, 26, { color: [TEAMS[team].color, TEAMS[team].light, '#ffffff'], speed: 320, life: 0.6, size: 7, shape: 'circle', drag: 3 });
    this.feed.unshift({ a: by ? by.name : '颜料', at: team, b: v.name, bt: v.team, t: 0 });
    if (this.feed.length > 4) this.feed.pop();
    if (v.isPlayer || (by && by.isPlayer) || !this.demo) {
      this.sfx.tone('sine', 760, 150, 0.28, v.isPlayer || (by && by.isPlayer) ? 0.14 : 0.05);
      this.sfx.noise(0.2, v.isPlayer || (by && by.isPlayer) ? 0.16 : 0.05, 'lowpass', 1800, 300);
    }
    if (by && by.isPlayer) this.popups.push({ x: v.x, y: v.y - 30, text: '击倒！', color: TEAMS[1].color, t: 0 });
    if (v.isPlayer) {
      this._banner('被击倒了…3 秒后复活', '#ffffff', 1.6);
      this.shake = 0.5;
    }
  }

  _throwBomb(ch, dist) {
    const a = ch.aim, c = Math.cos(a), s = Math.sin(a);
    let d = 0;
    const maxD = clamp(dist, 60, 280);
    while (d < maxD && !this._isWall(ch.x + c * (d + 8), ch.y + s * (d + 8))) d += 8;
    ch.ink -= INK_BOMB;
    ch.bombCd = 0.7;
    ch.dive = ch.sub = false;
    this.bombs.push({
      kind: 'bomb', id: (this.bombId = (this.bombId || 0) + 1), x0: ch.x, y0: ch.y, x1: ch.x + c * d, y1: ch.y + s * d, x: ch.x, y: ch.y, h: 0,
      t: 0, dur: 0.42 + d / 900, team: ch.team, by: ch, fuse: 0.6, landed: false, r: 9,
    });
    if (ch.isPlayer || !this.demo) this.sfx.tone('sine', 300, 620, 0.14, ch.isPlayer ? 0.1 : 0.03);
  }

  _updateBombs(dt) {
    const L = this.bombs;
    for (let i = L.length - 1; i >= 0; i--) {
      const b = L[i];
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      b.x = lerp(b.x0, b.x1, k);
      b.y = lerp(b.y0, b.y1, k);
      b.h = Math.sin(k * Math.PI) * (b.kind === 'bomb' ? 70 : 110);
      if (k < 1) continue;
      if (b.kind === 'drop') {
        this._splat(b.x, b.y, b.r, b.team, b.by, 4);
        L[i] = L[L.length - 1];
        L.pop();
        continue;
      }
      if (!b.landed) {
        b.landed = true;
        this._paint(b.x, b.y, 16, b.team, b.by);
      }
      b.fuse -= dt;
      if (b.fuse <= 0) {
        this._explode(b);
        L[i] = L[L.length - 1];
        L.pop();
      }
    }
  }

  _explode(b) {
    this._splat(b.x, b.y, 68, b.team, b.by, 8);
    this.parts.emit(b.x, b.y, 30, { color: [TEAMS[b.team].color, TEAMS[b.team].light], speed: 380, life: 0.5, size: 8, shape: 'circle', drag: 4 });
    this.rings.push({ x: b.x, y: b.y, t: 0, dur: 0.35, r0: 10, r1: 90, color: TEAMS[b.team].light, w: 8 });
    for (const o of this.chars) {
      if (o.team === b.team || !o.alive) continue;
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (d > 80) continue;
      const k = 1 - d / 80;
      if (d > 1) { o.kx += ((o.x - b.x) / d) * 260 * k; o.ky += ((o.y - b.y) / d) * 260 * k; }
      this._damage(o, 24 + 46 * k, b.by);
    }
    const P = this.player;
    const near = P && Math.hypot(P.x - b.x, P.y - b.y) < 260;
    if (near || (b.by && b.by.isPlayer)) {
      this.sfx.play('explode', {});
      this.shake = Math.max(this.shake, 0.22);
    }
  }

  _startSpecial(ch) {
    ch.special = 0;
    ch.sp = 0;
    ch.spHit = false;
    ch.dive = ch.sub = false;
    if (ch.isPlayer || !this.demo) {
      const v = ch.isPlayer ? 0.12 : 0.04;
      [523, 659, 784, 1046, 1318].forEach((f, i) => this.sfx.tone('triangle', f, f, 0.12, v, i * 0.05));
    }
    if (ch.isPlayer) this._banner('彩虹喷泉！', '#ffe14a', 1.1);
  }

  _specialBlast(ch) {
    ch.spHit = true;
    this.rings.push({ x: ch.x, y: ch.y, t: 0, dur: 0.6, r0: 20, r1: 175, rainbow: true, w: 14 });
    for (const o of this.chars) {
      if (o.team === ch.team || !o.alive) continue;
      const d = Math.hypot(o.x - ch.x, o.y - ch.y);
      if (d > 140) continue;
      if (d > 1) { o.kx += ((o.x - ch.x) / d) * 420; o.ky += ((o.y - ch.y) / d) * 420; }
      this._damage(o, 85, ch);
    }
    // 彩虹雨：一圈颜料滴飞出去落地涂开
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + this.rnd() * 0.3;
      let d = 140 + this.rnd() * 190;
      const c = Math.cos(a), s = Math.sin(a);
      let dd = 0;
      while (dd < d && !this._isWall(ch.x + c * dd, ch.y + s * dd)) dd += 10;
      d = Math.max(30, dd - 10);
      this.bombs.push({ kind: 'drop', x0: ch.x, y0: ch.y, x1: ch.x + c * d, y1: ch.y + s * d, x: ch.x, y: ch.y, h: 0, t: 0, dur: 0.45 + this.rnd() * 0.3, team: ch.team, by: ch, r: 22 + this.rnd() * 8 });
    }
    const P = this.player;
    if (ch.isPlayer || (P && Math.hypot(P.x - ch.x, P.y - ch.y) < 300)) {
      this.sfx.play('explode', {});
      this.shake = Math.max(this.shake, 0.3);
    }
  }

  // ———————— 电脑选手 ————————
  _canSee(b, o, d) {
    if (o.sub && !(d < 70 || (o.moving && d < 160))) return false;
    return this._los(b.x, b.y, o.x, o.y);
  }

  _aiInput(b, dt) {
    const ai = b.ai;
    const inp = this.inp;
    inp.mx = inp.my = 0;
    inp.shoot = inp.dive = inp.bomb = inp.special = false;
    inp.aimA = null;
    inp.bombDist = 250;
    ai.thinkT -= dt;
    ai.react = Math.max(0, ai.react - dt);
    ai.strafeT -= dt;
    if (ai.strafeT <= 0) { ai.strafe = -ai.strafe; ai.strafeT = 0.6 + this.rnd() * 0.9; }
    if (ai.thinkT <= 0) {
      this._think(b);
      ai.thinkT = 0.2 + this.rnd() * 0.14;
    }
    ai.burstT -= dt;
    if (ai.burstT <= 0) { ai.burst = !ai.burst; ai.burstT = ai.burst ? 0.55 + this.rnd() * 0.5 : 0.25 + this.rnd() * 0.3; }
    const onOwn = this._cellOwner(b.x, b.y) === b.team;
    // 看到落地快炸的敌方炸弹就躲开
    for (const bb of this.bombs) {
      if (bb.kind !== 'bomb' || bb.team === b.team || bb.t < bb.dur - 0.25 || (bb.id + b.idx * 3 + b.team) % 5 < 2) continue;   // 大约六成能反应过来
      const dx = b.x - bb.x1, dy = b.y - bb.y1, d = Math.hypot(dx, dy);
      if (d < 100) {
        inp.mx = dx / (d || 1);
        inp.my = dy / (d || 1);
        inp.dive = onOwn;
        inp.aimA = b.aim;
        return inp;
      }
    }
    if (ai.mode === 'fight' && ai.target && ai.target.alive) {
      const t = ai.target;
      const dx = t.x - b.x, dy = t.y - b.y, d = Math.hypot(dx, dy) || 1;
      if (this._los(b.x, b.y, t.x, t.y)) {
        const want = b.hp < 50 ? 280 : 215;
        const kk = d > want + 50 ? 1 : d < want - 60 ? -0.9 : 0;
        const ux = dx / d, uy = dy / d;
        inp.mx = ux * kk - uy * ai.strafe * 0.85;
        inp.my = uy * kk + ux * ai.strafe * 0.85;
        const lead = (d / SHOT_SPEED) * 0.7;
        inp.aimA = Math.atan2(t.y + t.vy * lead - b.y, t.x + t.vx * lead - b.x) + ai.aimErr * (0.6 + 0.4 * Math.sin(this.t * 6 + ai.phase));
        inp.shoot = ai.react <= 0 && ai.burst && d < 310 && b.ink > 2;
        if (ai.bombRoll && b.ink >= 70 && b.bombCd <= 0 && d > 120 && d < 290) {
          inp.bomb = true;
          inp.bombDist = d;
          inp.shoot = false;
          ai.bombRoll = false;
        }
        if (ai.spRoll && b.special >= 100 && d < 150) inp.special = true;
      } else {
        this._steer(b, inp, ai.goal || t);
        inp.aimA = b.moveA;
      }
      return inp;
    }
    const goal = ai.goal;
    if (!goal) return inp;
    const dg = Math.hypot(goal.x - b.x, goal.y - b.y);
    if (ai.mode === 'refill') {
      if (onOwn) {
        inp.dive = true;
        if (dg > 50 && b.ink < 40) this._steer(b, inp, goal);
      } else this._steer(b, inp, goal);
      inp.aimA = b.moveA;
      return inp;
    }
    // 占地 / 支援：沿路一边走一边扫射涂色；在本队颜料上赶远路时潜进去
    this._steer(b, inp, goal);
    if (onOwn && dg > 160 && b.ink < 95) inp.dive = true;
    else {
      const a = b.moveA + Math.sin(this.t * 2.6 + ai.phase) * 0.6;
      inp.aimA = a;
      const px = b.x + Math.cos(a) * 80, py = b.y + Math.sin(a) * 80;
      inp.shoot = b.ink > 20 && this._notOwnAround(px, py, b.team) > 0.15;
      if (ai.bombRoll && b.ink >= 95 && b.bombCd <= 0) {
        inp.bomb = true;
        inp.bombDist = 230;
        inp.aimA = b.moveA;
        ai.bombRoll = false;
      }
      if (ai.spRoll && b.special >= 100 && this._notOwnAround(b.x, b.y, b.team) > 0.5) inp.special = true;
    }
    return inp;
  }

  _think(b) {
    const ai = b.ai;
    const moved = Math.hypot(b.x - ai.lx, b.y - ai.ly);
    ai.lx = b.x;
    ai.ly = b.y;
    if (ai.mode !== 'fight' && ai.goal && moved < 6 && !b.sub && Math.hypot(ai.goal.x - b.x, ai.goal.y - b.y) > 50) ai.stuck++;
    else ai.stuck = 0;
    let foe = null, fd = 1e9;
    for (const o of this.chars) {
      if (o.team === b.team || !o.alive || o.onPad) continue;
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (d < fd && d < 420 && this._canSee(b, o, d)) { foe = o; fd = d; }
    }
    let mode;
    if (ai.mode === 'refill' && (b.ink < 85 || b.hp < 55) && !(foe && fd < 120 && b.ink > 25)) mode = 'refill';
    else if (b.ink < 14 || (b.hp < 45 && foe && fd < 260)) mode = 'refill';
    else if (foe) mode = 'fight';
    else {
      const ally = this._allyInTrouble(b);
      if (ally) { mode = 'support'; ai.goal = { x: ally.x, y: ally.y }; }
      else mode = 'paint';
    }
    if (mode !== ai.mode) {
      ai.mode = mode;
      if (mode !== 'support') ai.goal = null;
      ai.stuck = 0;
    }
    const r = this.rnd;
    if (mode === 'fight') {
      if (ai.target !== foe) ai.react = 0.42 + r() * 0.25;
      ai.target = foe;
      ai.goal = { x: foe.x, y: foe.y };
      ai.aimErr = (r() - 0.5) * 0.5;
      ai.bombRoll = r() < 0.18;
      ai.spRoll = r() < 0.5;
    } else ai.target = null;
    if (mode === 'refill' && (!ai.goal || ai.stuck > 2)) ai.goal = this._findOwnInk(b);
    if (mode === 'paint') {
      if (!ai.goal || Math.hypot(ai.goal.x - b.x, ai.goal.y - b.y) < 45 || ai.stuck > 2 || r() < 0.04) ai.goal = this._pickPaintGoal(b);
      ai.bombRoll = r() < 0.1;
      ai.spRoll = r() < 0.15;
    }
    if (ai.stuck > 2) {
      ai.stuck = 0;
      ai.lane = (ai.lane + 1) % 3;
    }
    if (ai.goal) this._bfs(b.team, ai.goal, ai.dist);
  }

  _allyInTrouble(b) {
    let best = null, bd = 450;
    for (const o of this.teams[b.team]) {
      if (o === b || !o.alive) continue;
      const fighting = o.ai ? o.ai.mode === 'fight' : this.t - o.lastHit < 2;
      if (!fighting) continue;
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  _notOwnAround(x, y, team) {
    let n = 0, m = 0;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const gx = ((x + Math.cos(a) * 34) / CS) | 0, gy = ((y + Math.sin(a) * 34) / CS) | 0;
      if (gx < 0 || gy < 0 || gx >= GC || gy >= GR) continue;
      const k = gy * GC + gx;
      if (!this.paintable[k]) continue;
      m++;
      if (this.owner[k] !== team) n++;
    }
    return m ? n / m : 0;
  }

  _pickPaintGoal(b) {
    let best = null, bs = -1e9;
    const laneY = [MH * 0.2, MH * 0.5, MH * 0.8][b.ai.lane];
    for (let k = 0; k < 28; k++) {
      const gx = (this.rnd() * GC) | 0, gy = (this.rnd() * GR) | 0;
      const i = gy * GC + gx;
      if (!this.paintable[i]) continue;
      const x = (gx + 0.5) * CS, y = (gy + 0.5) * CS;
      if (this._blocked(b.team, x, y, R)) continue;
      const o = this.owner[i];
      let s = o === b.team ? 0 : o === 0 ? 2.2 : 3;
      s += this._notOwnAround(x, y, b.team) * 1.6;
      s += (b.team === 1 ? x / MW : 1 - x / MW) * 1.1;
      s -= (Math.abs(y - laneY) / MH) * 1.8;
      s -= Math.hypot(x - b.x, y - b.y) / 900;
      if (s > bs) { bs = s; best = { x, y }; }
    }
    return best || { ...this.map.spawn[b.team] };
  }

  _findOwnInk(b) {
    let best = null, bd = 1e9;
    for (let k = 0; k < 40; k++) {
      const a = this.rnd() * Math.PI * 2, d = 20 + this.rnd() * 280;
      const x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d;
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      if (this._cellOwner(x, y) !== b.team || this._blocked(b.team, x, y, R)) continue;
      if (d < bd) { bd = d; best = { x, y }; }
    }
    return best || { ...this.map.spawn[b.team] };
  }

  _bfs(team, goal, dist) {
    dist.fill(-1);
    let gx = clamp(Math.floor(goal.x / TS), 0, COLS - 1), gy = clamp(Math.floor(goal.y / TS), 0, ROWS - 1);
    if (this._solidFor(team, gx, gy)) {
      let found = false;
      for (let r = 1; r <= 2 && !found; r++) {
        for (let oy = -r; oy <= r && !found; oy++) for (let ox = -r; ox <= r && !found; ox++) {
          if (!this._solidFor(team, gx + ox, gy + oy)) { gx += ox; gy += oy; found = true; }
        }
      }
      if (!found) return;
    }
    const q = this.q;
    let head = 0, tail = 0;
    const g = gy * COLS + gx;
    dist[g] = 0;
    q[tail++] = g;
    while (head < tail) {
      const i = q[head++];
      const x = i % COLS, y = (i / COLS) | 0, d = dist[i] + 1;
      if (x > 0 && dist[i - 1] < 0 && !this._solidFor(team, x - 1, y)) { dist[i - 1] = d; q[tail++] = i - 1; }
      if (x < COLS - 1 && dist[i + 1] < 0 && !this._solidFor(team, x + 1, y)) { dist[i + 1] = d; q[tail++] = i + 1; }
      if (y > 0 && dist[i - COLS] < 0 && !this._solidFor(team, x, y - 1)) { dist[i - COLS] = d; q[tail++] = i - COLS; }
      if (y < ROWS - 1 && dist[i + COLS] < 0 && !this._solidFor(team, x, y + 1)) { dist[i + COLS] = d; q[tail++] = i + COLS; }
    }
  }

  // 沿着 BFS 距离场往目标走；能直接走过去的就抄近路
  _steer(b, inp, goal) {
    let tx = goal.x, ty = goal.y;
    const dg = Math.hypot(tx - b.x, ty - b.y);
    if (dg < 8) return;
    if (!(dg < 360 && this._clearWalk(b.team, b.x, b.y, tx, ty))) {
      const dist = b.ai.dist;
      let cx = Math.floor(b.x / TS), cy = Math.floor(b.y / TS);
      let wx = null, wy = null;
      for (let step = 0; step < 4; step++) {
        const here = dist[cy * COLS + cx];
        let bx = -1, by = -1, bd = here < 0 ? 1e9 : here;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const nx = cx + ox, ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
          if (ox && oy && (this._solidFor(b.team, cx + ox, cy) || this._solidFor(b.team, cx, cy + oy))) continue;
          const nd = dist[ny * COLS + nx];
          if (nd >= 0 && nd < bd) { bd = nd; bx = nx; by = ny; }
        }
        if (bx < 0) break;
        const px = (bx + 0.5) * TS, py = (by + 0.5) * TS;
        if (step > 0 && !this._clearWalk(b.team, b.x, b.y, px, py)) break;
        wx = px; wy = py;
        cx = bx; cy = by;
        if (bd === 0) break;
      }
      if (wx != null) { tx = wx; ty = wy; }
    }
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1;
    inp.mx = dx / d;
    inp.my = dy / d;
  }

  // ———————— 绘制 ————————
  _buildStatic() {
    const S = this.os.scale || 1;
    this.staticScale = S;
    const M = this.map, def = M.def;
    this.floorCv = makeCanvas(MW * S, MH * S);
    const f = this.floorCv.getContext('2d');
    f.scale(S, S);
    const rnd = mulberry32(7 + this.mapIdx);
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        f.fillStyle = def.floor[(tx + ty) & 1];
        f.fillRect(tx * TS, ty * TS, TS, TS);
      }
    }
    f.strokeStyle = 'rgba(120,100,80,0.10)';
    f.lineWidth = 1;
    for (let tx = 0; tx <= COLS; tx++) { f.beginPath(); f.moveTo(tx * TS, 0); f.lineTo(tx * TS, MH); f.stroke(); }
    for (let ty = 0; ty <= ROWS; ty++) { f.beginPath(); f.moveTo(0, ty * TS); f.lineTo(MW, ty * TS); f.stroke(); }
    f.fillStyle = 'rgba(120,100,80,0.12)';
    for (let i = 0; i < 160; i++) {
      f.beginPath();
      f.arc(rnd() * MW, rnd() * MH, 1 + rnd() * 2, 0, Math.PI * 2);
      f.fill();
    }

    this.topCv = makeCanvas(MW * S, (MH + TOPM) * S);
    const g = this.topCv.getContext('2d');
    g.scale(S, S);
    g.translate(0, TOPM);
    const at = (tx, ty) => this._tile(tx, ty);
    // 出生台
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (at(tx, ty) !== T_PAD) continue;
        const T = TEAMS[M.padTeam[ty * COLS + tx]];
        g.fillStyle = T.dark;
        g.fillRect(tx * TS, ty * TS, TS, TS);
        fillRR(g, tx * TS + 3, ty * TS + 3, TS - 6, TS - 6, 6, T.color);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(tx * TS + 6, ty * TS + 6, TS - 12, 5);
      }
    }
    for (const team of [1, 2]) {
      const s = M.spawn[team], T = TEAMS[team];
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.arc(s.x, s.y, 30, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = T.color;
      g.beginPath();
      g.arc(s.x, s.y, 24, 0, Math.PI * 2);
      g.fill();
      const dir = team === 1 ? 1 : -1;
      g.fillStyle = '#ffffff';
      for (let k = 0; k < 2; k++) {
        const x = s.x + dir * (-6 + k * 10);
        g.beginPath();
        g.moveTo(x - dir * 6, s.y - 10);
        g.lineTo(x + dir * 5, s.y);
        g.lineTo(x - dir * 6, s.y + 10);
        g.closePath();
        g.fill();
      }
    }
    // 水池
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (at(tx, ty) !== T_WATER) continue;
        const x = tx * TS, y = ty * TS;
        const wg = g.createLinearGradient(x, y, x, y + TS);
        wg.addColorStop(0, '#59c3ee');
        wg.addColorStop(1, '#3a9fd6');
        g.fillStyle = wg;
        g.fillRect(x, y, TS, TS);
        g.fillStyle = 'rgba(255,255,255,0.75)';
        if (at(tx, ty - 1) !== T_WATER) g.fillRect(x, y, TS, 4);
        if (at(tx, ty + 1) !== T_WATER) { g.fillStyle = 'rgba(20,80,130,0.35)'; g.fillRect(x, y + TS - 4, TS, 4); g.fillStyle = 'rgba(255,255,255,0.75)'; }
        if (at(tx - 1, ty) !== T_WATER) g.fillRect(x, y, 3, TS);
        if (at(tx + 1, ty) !== T_WATER) g.fillRect(x + TS - 3, y, 3, TS);
      }
    }
    // 墙与木箱：按行从上到下画，下面一排的顶面盖住上面一排的侧面
    const C = def.wall;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (at(tx, ty) !== T_WALL) continue;
        const x = tx * TS, y = ty * TS;
        const crate = M.crate[ty * COLS + tx];
        if (at(tx, ty + 1) !== T_WALL && ty < ROWS - 1) {
          g.fillStyle = 'rgba(40,30,60,0.16)';
          g.fillRect(x + 3, y + TS, TS - 2, 8);
        }
        if (crate) {
          g.fillStyle = '#9a5f2c';
          g.fillRect(x + 1, y + TS - 10, TS - 2, 10);
          fillRR(g, x + 1, y - 10, TS - 2, TS, 4, '#d99a55');
          g.strokeStyle = '#a8692f';
          g.lineWidth = 2.5;
          g.strokeRect(x + 5, y - 6, TS - 10, TS - 8);
          g.beginPath();
          g.moveTo(x + 6, y - 5);
          g.lineTo(x + TS - 6, y + TS - 15);
          g.stroke();
        } else {
          g.fillStyle = C.front;
          g.fillRect(x, y + TS - 10, TS, 10);
          g.fillStyle = C.top;
          g.fillRect(x, y - 10, TS, TS);
          g.fillStyle = C.line;
          if (at(tx, ty - 1) !== T_WALL) g.fillRect(x, y - 10, TS, 3);
          if (at(tx - 1, ty) !== T_WALL) g.fillRect(x, y - 10, 3, TS);
        }
      }
    }
    this.waterTiles = [];
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) if (at(tx, ty) === T_WATER) this.waterTiles.push([tx * TS, ty * TS]);
  }

  draw(c) {
    if (this.staticScale !== (this.os.scale || 1)) this._buildStatic();
    c.fillStyle = '#231a38';            // 纯色底（整屏渐变在软件绘制下要 3 ms）
    c.fillRect(0, 0, W, H);
    c.save();
    if (this.shake > 0) c.translate((this.rnd() - 0.5) * 12 * this.shake, (this.rnd() - 0.5) * 12 * this.shake);
    strokeRR(c, WX - 6, WY - TOPM - 6, MW + 12, MH + TOPM + 12, 14, 'rgba(255,255,255,0.08)', 4);
    c.drawImage(this.floorCv, WX, WY, MW, MH);
    c.drawImage(this.paintCv, WX, WY, MW, MH);
    c.drawImage(this.topCv, WX, WY - TOPM, MW, MH + TOPM);
    c.translate(WX, WY);
    this._drawWater(c);
    this._drawWorld(c);
    c.restore();
    this._hud(c);
    this._drawBanner(c);
    this._drawOverlay(c);
  }

  _drawWater(c) {
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 2;
    c.beginPath();
    for (const [x, y] of this.waterTiles) {
      const p = Math.sin(this.t * 1.6 + x * 0.05 + y * 0.03) * 4;
      c.moveTo(x + 8 + p, y + 16);
      c.quadraticCurveTo(x + 14 + p, y + 12, x + 20 + p, y + 16);
      c.moveTo(x + 20 - p, y + 29);
      c.quadraticCurveTo(x + 26 - p, y + 25, x + 32 - p, y + 29);
    }
    c.stroke();
  }

  _drawWorld(c) {
    const viewer = this.player ? this.player.team : 1;
    for (const r of this.ripples) {
      const k = r.t / 0.6;
      c.strokeStyle = `rgba(255,255,255,${(0.55 * (1 - k)).toFixed(3)})`;
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(r.x, r.y + 6, 6 + k * 22, 3 + k * 9, 0, 0, Math.PI * 2);
      c.stroke();
    }
    // 炸弹 / 颜料滴的影子
    for (const b of this.bombs) {
      c.fillStyle = 'rgba(30,20,40,0.25)';
      c.beginPath();
      c.ellipse(b.x, b.y + 4, b.r * (1 - b.h / 200), b.r * 0.45, 0, 0, Math.PI * 2);
      c.fill();
    }
    const list = this.chars.filter((ch) => ch.alive).sort((a, b) => a.y - b.y);
    for (const ch of list) this._drawChar(c, ch, viewer);
    for (const b of this.bombs) {
      const T = TEAMS[b.team];
      const y = b.y - b.h;
      if (b.kind === 'drop') {
        c.fillStyle = T.color;
        c.beginPath();
        c.arc(b.x, y, 6, 0, Math.PI * 2);
        c.fill();
        continue;
      }
      const blink = b.landed && Math.floor(b.fuse * 14) % 2 === 0;
      c.fillStyle = blink ? '#ffffff' : T.color;
      c.beginPath();
      c.arc(b.x, y, b.r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = T.dark;
      c.lineWidth = 2.5;
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.arc(b.x - 3, y - 3, 3, 0, Math.PI * 2);
      c.fill();
    }
    for (const b of this.bullets) {
      const T = TEAMS[b.team];
      c.strokeStyle = T.light;
      c.lineWidth = 4;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      c.lineTo(b.x, b.y);
      c.stroke();
      c.fillStyle = T.color;
      c.beginPath();
      c.arc(b.x, b.y, 4.5, 0, Math.PI * 2);
      c.fill();
    }
    this.parts.draw(c);
    for (const r of this.rings) {
      const k = easeOutCubic(r.t / r.dur);
      const rad = lerp(r.r0, r.r1, k);
      c.globalAlpha = 1 - r.t / r.dur;
      c.lineWidth = r.w * (1 - k * 0.6);
      if (r.rainbow) {
        RAINBOW.forEach((col, i) => {
          c.strokeStyle = col;
          c.beginPath();
          c.arc(r.x, r.y, Math.max(1, rad - i * r.w * 0.55), 0, Math.PI * 2);
          c.stroke();
        });
      } else {
        c.strokeStyle = r.color;
        c.beginPath();
        c.arc(r.x, r.y, rad, 0, Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    for (const p of this.popups) {
      const k = p.t / 1.1;
      c.globalAlpha = 1 - k * k;
      outlineText(c, p.text, p.x, p.y - k * 30, 24, '#ffffff', p.color, 6);
      c.globalAlpha = 1;
    }
  }

  _drawChar(c, ch, viewer) {
    const T = TEAMS[ch.team];
    const friendly = ch.team === viewer;
    if (ch.sub) {
      // 潜在颜料里：队友能看到半透明的身影，对手只能看到移动时的涟漪
      if (!friendly) return;
      c.globalAlpha = 0.55;
      c.fillStyle = T.dark;
      c.beginPath();
      c.ellipse(ch.x, ch.y + 4, R * 0.95, R * 0.42, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(ch.x - 4, ch.y + 1, 2.4, 0, Math.PI * 2);
      c.arc(ch.x + 4, ch.y + 1, 2.4, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      if (ch.isPlayer) this._drawPlayerMark(c, ch, -6);
      return;
    }
    let hop = 0, squash = ch.moving ? Math.sin(ch.wob) * 0.07 : Math.sin(ch.wob) * 0.03;
    if (ch.sp >= 0) {
      const k = Math.min(1, ch.sp / 0.38);
      hop = ch.sp < 0.38 ? Math.sin(k * Math.PI) * 34 : 0;
      squash = ch.sp < 0.38 ? -0.12 : Math.max(0, 0.25 - (ch.sp - 0.38)) * 0.9;
    }
    if (ch.dive) squash = 0.22;
    const blink = ch.inv > 0 && Math.floor(ch.inv * 12) % 2 === 0;
    c.globalAlpha = blink ? 0.45 : 1;
    // 喷枪
    const nx = Math.cos(ch.aim), ny = Math.sin(ch.aim);
    c.save();
    c.translate(ch.x, ch.y - hop + 2);
    c.rotate(ch.aim);
    fillRR(c, R * 0.55, -4.5, 15, 9, 4, '#3b3347');
    c.fillStyle = T.color;
    c.fillRect(R * 0.55 + 11, -3.5, 4, 7);
    c.restore();
    drawJelly(c, ch.x, ch.y, R, ch.team, { aim: ch.aim, squash, hop, flash: ch.hurtT > 0.06, S: this.staticScale });
    if (ny < -0.3) {
      // 朝上瞄准时喷枪画在身体前面会挡脸，改画一个小枪口
      c.fillStyle = '#3b3347';
      c.beginPath();
      c.arc(ch.x + nx * (R + 6), ch.y - hop + ny * (R + 6), 4, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    if (ch.hp < 99.5) {
      const w = 30;
      fillRR(c, ch.x - w / 2, ch.y - R - 22 - hop, w, 5, 2.5, 'rgba(20,14,30,0.6)');
      fillRR(c, ch.x - w / 2, ch.y - R - 22 - hop, Math.max(3, (w * ch.hp) / 100), 5, 2.5, ch.hp < 40 ? '#ff5a5a' : '#7cf08a');
    }
    if (ch.special >= 100 && ch.sp < 0) {
      c.strokeStyle = RAINBOW[Math.floor(this.t * 10) % RAINBOW.length];
      c.lineWidth = 3;
      c.beginPath();
      c.arc(ch.x, ch.y, R + 7 + Math.sin(this.t * 8) * 2, 0, Math.PI * 2);
      c.stroke();
    }
    if (ch.isPlayer) {
      this._drawPlayerMark(c, ch, hop);
      // 背上的墨水罐
      if (ch.ink < 99 || ch.noFire < 0.6) {
        const bx = ch.x + R + 7, by = ch.y - 14;
        fillRR(c, bx, by, 7, 28, 3, 'rgba(20,14,30,0.65)');
        const h = (26 * ch.ink) / 100;
        fillRR(c, bx + 1, by + 27 - h, 5, Math.max(1, h), 2, ch.ink < 20 ? '#ff5a5a' : T.color);
      }
      if (ch.lowInkT > 0) outlineText(c, '墨水不足！', ch.x, ch.y - R - 40, 18, '#ffffff', '#d33', 5);
    }
  }

  _drawPlayerMark(c, ch, hop) {
    const y = ch.y - R - 30 - hop + Math.sin(this.t * 5) * 2;
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#2a1d38';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(ch.x - 7, y - 6);
    c.lineTo(ch.x + 7, y - 6);
    c.lineTo(ch.x, y + 3);
    c.closePath();
    c.stroke();
    c.fill();
  }

  _hud(c) {
    fillRR(c, 16, 8, W - 32, 84, 22, 'rgba(20,14,34,0.86)');
    for (const team of [1, 2]) {
      this.teams[team].forEach((ch, i) => {
        const x = team === 1 ? 52 + i * 56 : W - 52 - i * 56;
        const y = 46;
        if (ch.alive) drawJelly(c, x, y, 17, team, { aim: team === 1 ? 0.3 : Math.PI - 0.3, shadow: false, S: this.staticScale });
        else {
          c.globalAlpha = 0.5;
          drawJelly(c, x, y, 17, team, { shadow: false, dead: true, S: this.staticScale });
          c.globalAlpha = 1;
          outlineText(c, String(Math.max(1, Math.ceil(ch.respawn))), x, y + 2, 20, '#ffffff', '#2a1d38', 5);
        }
        if (ch.special >= 100 && ch.alive) {
          c.strokeStyle = '#ffe14a';
          c.lineWidth = 2.5;
          c.beginPath();
          c.arc(x, y - 2, 22, 0, Math.PI * 2);
          c.stroke();
        }
        text(c, ch.name, x, y + 33, 13, ch.isPlayer ? '#ffe14a' : 'rgba(255,255,255,0.7)', 'center', ch.isPlayer ? 800 : 500);
      });
    }
    // 时间
    const tt = Math.max(0, Math.ceil(this.time));
    const ts = `${Math.floor(tt / 60)}:${String(tt % 60).padStart(2, '0')}`;
    text(c, ts, W / 2, 36, 38, this.time <= 30 && !this.demo ? '#ff6a6a' : '#ffffff', 'center', 900);
    // 占地条（只显示大概比例）
    const bx = W / 2 - 190, bw = 380, by = 66, bh = 12;
    fillRR(c, bx, by, bw, bh, 6, 'rgba(255,255,255,0.14)');
    const a = this.counts[1] / this.total, b = this.counts[2] / this.total;
    if (a > 0.003) fillRR(c, bx, by, Math.max(bh, bw * a), bh, 6, TEAMS[1].color);
    if (b > 0.003) fillRR(c, bx + bw - Math.max(bh, bw * b), by, Math.max(bh, bw * b), bh, 6, TEAMS[2].color);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.fillRect(W / 2 - 1, by - 3, 2, bh + 6);
    // 玩家的墨水 / 必杀
    const P = this.player;
    if (P) {
      const x0 = 262;
      text(c, '墨水', x0, 34, 15, 'rgba(255,255,255,0.75)', 'left', 700);
      fillRR(c, x0 + 40, 27, 112, 14, 7, 'rgba(255,255,255,0.14)');
      fillRR(c, x0 + 40, 27, Math.max(8, 1.12 * P.ink), 14, 7, P.ink < 20 ? '#ff5a5a' : TEAMS[1].color);
      text(c, '必杀', x0, 64, 15, 'rgba(255,255,255,0.75)', 'left', 700);
      fillRR(c, x0 + 40, 57, 112, 14, 7, 'rgba(255,255,255,0.14)');
      if (P.special >= 100) {
        const g = c.createLinearGradient(x0 + 40, 0, x0 + 152, 0);
        RAINBOW.forEach((col, i) => g.addColorStop(i / (RAINBOW.length - 1), col));
        fillRR(c, x0 + 40, 57, 112, 14, 7, g);
        const p = 0.75 + 0.25 * Math.sin(this.t * 8);
        c.globalAlpha = p;
        glyph(c, 'X', x0 + 172, 64, 11, '#ffe14a', '#2a1d38');
        c.globalAlpha = 1;
      } else fillRR(c, x0 + 40, 57, Math.max(8, 1.12 * P.special), 14, 7, '#ffe14a');
    }
    // 击倒播报
    this.feed.forEach((e, i) => {
      const y = WY + 18 + i * 30;
      const s1 = e.a, s2 = e.b;
      const w1 = textW(c, s1, 15, 800), w2 = textW(c, s2, 15, 800);
      const w = w1 + w2 + 46;
      const x = W - 52 - w;
      c.globalAlpha = Math.min(1, (4.5 - e.t) * 2);
      fillRR(c, x, y - 12, w, 24, 12, 'rgba(20,14,34,0.75)');
      text(c, s1, x + 10, y, 15, TEAMS[e.at].light, 'left', 800);
      text(c, '▶', x + 16 + w1, y, 13, '#ffffff', 'left', 700);
      text(c, s2, x + 36 + w1, y, 15, TEAMS[e.bt].light, 'left', 800);
      c.globalAlpha = 1;
    });
  }

  _drawBanner(c) {
    if (this.mode === 'ready') {
      const s = easeOutBack(Math.min(1, this.modeT / 0.4));
      c.save();
      c.translate(W / 2, 360);
      c.scale(s, s);
      outlineText(c, '准备…', 0, 0, 72, '#ffffff', '#3a1f5c', 14);
      c.restore();
      outlineText(c, '你是橙队：把更多地面涂成橙色！', W / 2, 440, 28, '#ffffff', TEAMS[1].dark, 7);
    }
    if (this.mode === 'play' && this.time <= 5 && this.time > 0) {
      const n = Math.ceil(this.time);
      const k = n - this.time;
      c.globalAlpha = 0.85 * (1 - k * 0.6);
      outlineText(c, String(n), W / 2, 400, 120 + k * 40, '#ffffff', '#c62828', 14);
      c.globalAlpha = 1;
    }
    const b = this.banner;
    if (b && !this.demo) {
      const s = easeOutBack(Math.min(1, b.t / 0.3));
      const a = Math.min(1, (b.dur - b.t) / 0.3);
      c.save();
      c.globalAlpha = a;
      c.translate(W / 2, 300);
      c.scale(s, s);
      outlineText(c, b.text, 0, 0, 58, b.color, '#2a1d38', 12);
      c.restore();
    }
  }

  _drawOverlay(c) {
    if (this.mode === 'title') {
      drawTitleCard(c, {
        t: this.modeT, title: '泼彩大作战', subtitle: '4 对 4 涂地对战：两分钟内把更多地面涂成你们的颜色！',
        best: this.best, stroke: '#3a1f5c', titleY: 236, promptY: 452,
        controls: [['STICK', '移动'], ['A', '喷颜料'], ['B', '潜入颜料'], ['R', '彩弹炸弹'], ['X', '必杀'], ['RSTICK', '瞄准']],
        extra: (cc) => {
          const y = 588;
          fillRR(cc, W / 2 - 220, y - 25, 440, 50, 25, 'rgba(0,0,0,0.45)');
          text(cc, '◀', W / 2 - 190, y + 1, 22, '#ffe14a', 'center', 900);
          text(cc, '▶', W / 2 + 190, y + 1, 22, '#ffe14a', 'center', 900);
          text(cc, `地图：${MAPS[this.mapIdx].name}`, W / 2, y + 1, 24, '#ffffff', 'center', 800);
        },
      });
    } else if (this.mode === 'judge') this._drawJudge(c);
    else if (this.mode === 'result') {
      const F = this.final;
      drawResult(c, {
        t: this.modeT, title: F.win === 1 ? '胜利！' : F.win === 2 ? '惜败…' : '平局', color: F.win === 2 ? TEAMS[2].dark : TEAMS[1].color,
        newBest: this.newBest,
        lines: [
          ['橙队 : 青队', `${F.a.toFixed(1)}% : ${F.b.toFixed(1)}%`],
          ['你的涂地', `${F.painted}p`],
          ['击倒 / 被击倒', `${F.kills} / ${F.deaths}`],
          ['得分', F.score],
        ],
        hints: [['A', '再来一局'], ['B', '标题画面']],
      });
    }
  }

  // 裁判计数：两条颜色从两边慢慢涨到最终比例
  _drawJudge(c) {
    const F = this.final;
    if (!F) return;
    const t = this.modeT;
    c.fillStyle = `rgba(10,6,20,${Math.min(0.6, t * 1.2).toFixed(3)})`;
    c.fillRect(0, 0, W, H);
    outlineText(c, '裁判计数中…', W / 2, 230, 44, '#ffffff', '#3a1f5c', 10);
    const k = easeOutCubic(clamp((t - 0.4) / 2.2, 0, 1));
    const wob = t < 2.6 ? Math.sin(t * 9) * 0.02 * (1 - k) : 0;
    const bw = 900, bx = W / 2 - bw / 2, by = 330, bh = 54;
    fillRR(c, bx, by, bw, bh, 27, 'rgba(255,255,255,0.15)');
    const wa = (bw / 2) * clamp((F.a / 50) * k + wob, 0, 2) * 0.98;
    const wb = (bw / 2) * clamp((F.b / 50) * k - wob, 0, 2) * 0.98;
    const sum = wa + wb > bw ? bw / (wa + wb) : 1;
    if (wa > 4) fillRR(c, bx, by, wa * sum, bh, 27, TEAMS[1].color);
    if (wb > 4) fillRR(c, bx + bw - wb * sum, by, wb * sum, bh, 27, TEAMS[2].color);
    drawJelly(c, bx - 40, by + 26, 26, 1, { aim: 0, shadow: false, S: this.staticScale });
    drawJelly(c, bx + bw + 40, by + 26, 26, 2, { aim: Math.PI, shadow: false, S: this.staticScale });
    if (t > 2.7) {
      const a = Math.min(1, (t - 2.7) * 3);
      c.globalAlpha = a;
      text(c, `${F.a.toFixed(1)}%`, bx + 40, by + 90, 34, TEAMS[1].light, 'left', 900);
      text(c, `${F.b.toFixed(1)}%`, bx + bw - 40, by + 90, 34, TEAMS[2].light, 'right', 900);
      const msg = F.win === 1 ? '橙队胜利！' : F.win === 2 ? '青队胜利！' : '平局！';
      const s = easeOutBack(Math.min(1, (t - 2.7) / 0.4));
      c.save();
      c.translate(W / 2, 480);
      c.scale(s, s);
      outlineText(c, msg, 0, 0, 64, '#ffffff', F.win === 2 ? TEAMS[2].dark : F.win === 1 ? TEAMS[1].dark : '#3a1f5c', 12);
      c.restore();
      c.globalAlpha = 1;
    }
  }
}

// 测试用
export const __turfTest = { MAPS, buildMap, COLS, ROWS, T_WALL, T_WATER, T_PAD };

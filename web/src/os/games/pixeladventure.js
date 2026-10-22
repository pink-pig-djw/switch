// 橙子大冒险：原创的 8-bit 风格横版闯关（主角：橙发少女）
// 画面在 320×180 的低分辨率画布上用像素绘制，再放大 4 倍到 1280×720
import { GameBase, Particles } from './common.js';
import { W, H, clamp, text, textW, fillRR, outlineText, makeCanvas, glyph, pad2, easeOutBack } from '../ui.js';
import { buildSprites, buildTiles, buildDecor, buildTeaHouse, buildParallax, THEMES } from './pixel/art.js';
import {
  LEVELS, ROWS, E, GROUND, BRICK, BOX, USED, HARD, PIPE, CLOUD, BRIDGE, SPIKE, LAVA, HIDDEN, MULTI, WALL,
  SOLID, ONEWAY, P_TL, P_TR, P_L, P_R, P_HT, P_HB, P_HL,
} from './pixel/levels.js';
import { SONG_FIELD, SONG_CAVE, SONG_SKY, SONG_CASTLE, JINGLE_CLEAR, JINGLE_DIE, JINGLE_OVER, JINGLE_ENDING } from './pixel/songs.js';

const VW = 320, VH = 180, CAM_Y = 12, TS = 16;
const STEP = 1 / 120;
const WALK = 90, RUN = 150, ACC = 230, ACC_RUN = 300, DEC = 280, SKID = 640, AIR = 210;
const JUMP = 272, JUMP_K = 0.24, G_HOLD = 560, G_FALL = 1500, MAX_FALL = 280;
const STOMP = 230, STOMP_HI = 320;
const COYOTE = 0.08, BUFFER = 0.1;
const SONGS = { field: SONG_FIELD, cave: SONG_CAVE, sky: SONG_SKY, castle: SONG_CASTLE };
const CHAIN = [100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000];
const PIPE_SKIN = { [P_TL]: 'pipeTL', [P_TR]: 'pipeTR', [P_L]: 'pipeL', [P_R]: 'pipeR', [P_HT]: 'pipeHT', [P_HB]: 'pipeHB', [P_HL]: 'pipeHL' };
const ENEMY_SIZE = { slime: [14, 12], snail: [14, 14], hedge: [14, 13], bee: [14, 10] };

// 共享美术资源（第一次用到时生成）
let ART = null;
function art() {
  if (!ART) {
    ART = { spr: buildSprites(), tiles: {}, par: {}, decor: { field: buildDecor('field'), sky: buildDecor('sky') }, house: buildTeaHouse() };
  }
  return ART;
}
const tilesFor = (th) => (art().tiles[th] ||= buildTiles(th));
const parFor = (th) => (art().par[th] ||= buildParallax(th));

// 3×5 像素小字（分数弹出用）
const FONT3 = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'], U: ['101', '101', '101', '101', '111'], P: ['111', '101', '111', '100', '100'],
};
function pixText(c, str, x, y, color) {
  c.fillStyle = '#1b1010';
  for (let pass = 0; pass < 2; pass++) {
    let cx = x;
    for (const ch of str) {
      const g = FONT3[ch];
      if (g) for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) {
        if (g[r][k] === '1') c.fillRect(cx + k + (pass ? 0 : 1), y + r + (pass ? 0 : 1), 1, 1);
      }
      cx += 4;
    }
    c.fillStyle = color;
  }
}

function drawTile(c, s) {
  const A = art();
  const t = tilesFor('field');
  const v = makeCanvas(64, 64);
  const vc = v.getContext('2d');
  vc.fillStyle = THEMES.field.sky;
  vc.fillRect(0, 0, 64, 64);
  vc.drawImage(A.decor.field.cloud, 34, 4);
  vc.drawImage(A.decor.field.hill, -30, 18);
  for (let x = 0; x < 4; x++) {
    vc.drawImage(t.ground, x * 16, 48);
  }
  vc.drawImage(t.box1, 24, 14);
  vc.drawImage(A.spr.coin0.r, 24, 0);
  vc.drawImage(A.spr.b_jump.r, 6, 14);
  vc.drawImage(A.spr.slime1.r, 44, 32);
  c.imageSmoothingEnabled = false;
  c.drawImage(v, 0, 0, s, s);
  c.imageSmoothingEnabled = true;
  const k = s / 256;
  c.save();
  c.scale(k, k);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(0, 196, 256, 60);
  outlineText(c, '橙子大冒险', 128, 226, 38, '#ffd84a', '#1b1010', 8);
  c.restore();
}

export class PixelAdventure extends GameBase {
  static meta = { id: 'orange8', name: '橙子大冒险', kind: 'game', color: '#ff8a1c', tile: drawTile };

  constructor(os) {
    super(os);
    this.A = art();
    this.view = makeCanvas(VW, VH);
    this.vc = this.view.getContext('2d');
    this.parts = new Particles(300);
    this.lives = 3;
    this.score = 0;
    this.coins = 0;
    this.power = 0;
    this.levelIdx = 0;
    this.prepareLevel(0);
    this.enterArea(this.def.start.area, this.def.start.spawn);
    this.setMode('title');
  }

  close() {
    this.sfx.music.stop();
  }

  // ———————————————————— 流程 ————————————————————
  start() {
    this.lives = 3;
    this.score = 0;
    this.coins = 0;
    this.power = 0;
    this.newBest = false;
    this.goIntro(0);
  }

  restart() {
    this.power = 0;
    this.goIntro(this.levelIdx, true);
  }

  goIntro(levelIdx, fresh = true) {
    if (fresh || levelIdx !== this.levelIdx) this.checkpointHit = false;
    this.levelIdx = levelIdx;
    this.sfx.music.stop();
    this.setMode('intro');
  }

  prepareLevel(i) {
    this.levelIdx = i;
    this.def = LEVELS[i]();
    this.time = this.def.time;
    this.timeAcc = 0;
    this.hurried = false;
    for (const a of Object.values(this.def.areas)) {
      a.coinsLeft = a.coins.map((c) => ({ ...c, got: false }));
    }
  }

  beginLevel() {
    const keepCheck = this.checkpointHit;
    this.prepareLevel(this.levelIdx);
    this.checkpointHit = keepCheck;
    const st = this.def.start;
    this.enterArea(st.area, st.spawn);
    if (this.checkpointHit && this.area.checks.length) {
      const ch = this.area.checks[0];
      this.placePlayer(ch.x + 2, ch.y + 16, 'stand');
      this.cam = clamp(ch.x - 80, 0, this.area.w * TS - VW);
    }
    this.setMode('play');
    this.playAreaMusic();
  }

  playAreaMusic() {
    const song = SONGS[this.area.music] || SONG_FIELD;
    this.sfx.music.play(song, this, { rate: this.hurried ? 1.3 : 1 });
  }

  enterArea(id, spawnName) {
    const a = this.def.areas[id];
    this.area = a;
    this.areaId = id;
    this.tiles = tilesFor(a.theme);
    this.par = parFor(a.theme);
    this.decor = this.A.decor[a.theme === 'sky' ? 'sky' : 'field'];
    if (!a.rt) {
      a.rt = { grid: a.grid.slice(), content: new Map(a.content), multi: new Map() };
      if (a.gate) for (let y = a.gate.y0; y <= a.gate.y1; y++) a.rt.grid[y * a.w + a.gate.x] = HARD;
    }
    this.grid = a.rt.grid;
    this.enemies = a.enemies.map((e) => this.makeEnemy(e));
    this.items = [];
    this.balls = [];
    this.bumps = [];
    this.pops = [];
    this.coinPops = [];
    this.bossShots = [];
    this.lifts = a.lifts.map((l) => ({ ...l, x0: l.x, y0: l.y, t: 0, dx: 0, dy: 0, h: 8 }));
    this.firebars = a.firebars.map((f) => ({ ...f, a: 0 }));
    this.boss = a.boss && !a.bossDone ? {
      x: a.boss.x, y: a.boss.y, w: 28, h: 28, vx: -30, vy: 0, hp: 5, inv: 0, t: 0, jumpT: 2.2, shotT: 3, face: -1,
      state: 'wait', onGround: false, arenaL: a.boss.arenaL, arenaR: a.boss.arenaR,
    } : null;
    this.bossActive = false;
    this.parts.clear();
    this.flagY = a.flag ? a.flag.top + 4 : 0;
    const sp = a.spawns[spawnName] || a.spawns.start || { x: 32, y: 144, mode: 'stand' };
    if (!this.p) this.p = this.newPlayer();
    this.placePlayer(sp.x, sp.mode === 'pipeUp' ? sp.y : sp.y + 16, sp.mode);
    this.cam = clamp(this.p.x - VW * 0.4, 0, a.w * TS - VW);
    this.fade = 0;
  }

  newPlayer() {
    return {
      x: 0, y: 0, w: 12, h: 14, vx: 0, vy: 0, face: 1, onGround: false, inv: 0, anim: null, animT: 0,
      walkT: 0, coyote: 0, buf: 0, lift: null, throwT: 0, dead: false, hidden: false, chain: 0, skid: false,
    };
  }

  // feetY：脚底的世界坐标
  placePlayer(x, feetY, mode) {
    const p = this.newPlayer();
    p.h = this.power > 0 ? 28 : 14;
    p.x = x;
    p.y = feetY - p.h;
    p.inv = 0;
    this.p = p;
    if (mode === 'pipeUp') {
      p.anim = 'pipeUp';
      p.animT = 0;
      p.y = feetY;
      p.targetY = feetY - p.h;
      this.sfx.play('nes_pipe');
    } else if (mode === 'drop') {
      p.y = feetY - 16 - p.h;
    } else {
      p.onGround = true;
    }
  }

  makeEnemy(e) {
    const [w, h] = ENEMY_SIZE[e.type] || [14, 14];
    return {
      type: e.type, x: e.x + 1, y: e.y + 16 - h, w, h, vx: e.type === 'bee' ? 0 : -32, vy: 0, state: e.type === 'bee' ? 'fly' : 'walk',
      t: Math.random() * 2, active: false, deadT: 0, x0: e.x, y0: e.y + 16 - h, range: e.range || 40, kickT: 0, wake: 0, onGround: false, chain: 0,
    };
  }

  // ———————————————————— 图块工具 ————————————————————
  tileAt(tx, ty) {
    const a = this.area;
    if (tx < 0 || tx >= a.w) return WALL;
    if (ty < 0 || ty >= ROWS) return E;
    return this.grid[ty * a.w + tx];
  }

  setTile(tx, ty, v) {
    const a = this.area;
    if (tx < 0 || tx >= a.w || ty < 0 || ty >= ROWS) return;
    this.grid[ty * a.w + tx] = v;
  }

  solid(tx, ty) {
    return SOLID.has(this.tileAt(tx, ty));
  }

  // ———————————————————— 更新 ————————————————————
  update(dt, pad) {
    this.t += dt;
    this.modeT += dt;
    switch (this.mode) {
      case 'title':
        if (pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
        this.cam = 0;
        return;
      case 'intro':
        if (this.modeT > 2.4) this.beginLevel();
        return;
      case 'gameover':
        if (this.modeT > 4 || (this.modeT > 1.5 && pad.pressed.A)) {
          this.sfx.music.stop();
          this.levelIdx = 0;
          this.prepareLevel(0);
          this.enterArea(this.def.start.area, this.def.start.spawn);
          this.setMode('title');
        }
        return;
      case 'ending':
        this.parts.update(dt);
        if (Math.random() < dt * 2) this.firework(40 + Math.random() * 240, 30 + Math.random() * 60);
        if (this.modeT > 3 && pad.pressed.A) {
          this.sfx.music.stop();
          this.levelIdx = 0;
          this.prepareLevel(0);
          this.enterArea(this.def.start.area, this.def.start.spawn);
          this.setMode('title');
        }
        return;
      default:
        break;
    }
    // play / dying / clear
    if (pad.pressed.A) this.p.buf = BUFFER;
    this.acc = (this.acc || 0) + dt;
    let n = 0;
    while (this.acc >= STEP && n < 14) {
      this.acc -= STEP;
      n++;
      this.step(STEP, pad);
      pad = { ...pad, pressed: NO_PRESS };
    }
    if (n >= 14) this.acc = 0;
  }

  step(dt, pad) {
    this.lastPad = pad;
    this.parts.update(dt);
    for (const b of this.bumps) b.t += dt;
    this.bumps = this.bumps.filter((b) => b.t < 0.16);
    for (const s of this.pops) s.t += dt;
    this.pops = this.pops.filter((s) => s.t < 0.8);
    for (const c of this.coinPops) { c.t += dt; c.y += c.vy * dt; c.vy += 700 * dt; }
    this.coinPops = this.coinPops.filter((c) => c.t < 0.5);
    if (this.fade > 0 && !this.fadeFn) this.fade = Math.max(0, this.fade - dt * 4);
    if (this.fadeFn) {
      this.fade += dt * 4;
      if (this.fade >= 1) {
        const fn = this.fadeFn;
        this.fadeFn = null;
        this.fade = 1;
        fn();
      }
      return;
    }
    if (this.mode === 'dying') {
      this.stepDeath(dt);
      return;
    }
    if (this.mode === 'clear') {
      this.stepClear(dt);
      return;
    }
    if (this.freeze > 0) {
      this.freeze -= dt;
      return;
    }
    const p = this.p;
    // 动画状态（管道 / 旗杆 / 走进茶室）
    if (p.anim) {
      this.stepAnim(dt, pad);
      this.stepWorld(dt, false);
      return;
    }
    // 计时
    this.timeAcc += dt;
    while (this.timeAcc >= 0.4) {
      this.timeAcc -= 0.4;
      this.time = Math.max(0, this.time - 1);
      if (this.time === 100 && !this.hurried) {
        this.hurried = true;
        this.sfx.play('nes_hurry');
        this.sfx.music.rate = 1.3;
      }
      if (this.time === 0) {
        this.die();
        return;
      }
    }
    this.stepPlayer(dt, pad);
    if (this.mode !== 'play') return;
    this.stepWorld(dt, true);
    // 镜头（经典：只向前滚动）
    const a = this.area;
    let target = p.x + p.w / 2 - VW * 0.42;
    let cam = Math.max(this.cam, target);
    if (this.bossActive && this.boss) cam = clamp(cam, this.boss.arenaL - 16, this.boss.arenaR - VW);
    this.cam = clamp(cam, 0, a.w * TS - VW);
  }

  stepPlayer(dt, pad) {
    const p = this.p;
    let ax = 0;
    if (pad.down.LEFT || pad.lx < -0.35) ax = -1;
    else if (pad.down.RIGHT || pad.lx > 0.35) ax = 1;
    const run = pad.down.B || pad.down.Y;
    const maxV = run ? RUN : WALK;
    // 扔茶叶球
    if (this.power === 2 && (pad.pressed.B || pad.pressed.Y) && this.balls.length < 2) {
      this.balls.push({ x: p.x + (p.face > 0 ? p.w : -6), y: p.y + 6, vx: p.face * 230, vy: 80, t: 0 });
      p.throwT = 0.15;
      this.sfx.play('nes_fire');
    }
    p.throwT = Math.max(0, p.throwT - dt);
    // 进管道：站在可进入的管道上按下
    if ((pad.down.DOWN || pad.ly < -0.6) && p.onGround) {
      for (const pp of this.area.pipes) {
        if (pp.dir !== 'down') continue;
        const px0 = pp.x * TS, cx = p.x + p.w / 2;
        if (Math.abs(p.y + p.h - pp.y * TS) < 1.5 && cx > px0 + 6 && cx < px0 + 26) {
          p.anim = 'pipeDown';
          p.animT = 0;
          p.vx = 0;
          p.x = px0 + 16 - p.w / 2;
          p.pipe = pp;
          this.sfx.play('nes_pipe');
          return;
        }
      }
    }
    // 横向
    if (p.onGround) {
      if (ax !== 0) {
        if (p.vx !== 0 && Math.sign(p.vx) !== ax) {
          p.vx += ax * SKID * dt;
          p.skid = Math.abs(p.vx) > 30;
        } else {
          p.vx += ax * (run ? ACC_RUN : ACC) * dt;
          p.skid = false;
        }
        p.face = ax;
      } else {
        const s = Math.sign(p.vx);
        p.vx -= s * DEC * dt;
        if (Math.sign(p.vx) !== s) p.vx = 0;
        p.skid = false;
      }
      if (Math.abs(p.vx) > maxV) p.vx = Math.sign(p.vx) * Math.max(maxV, Math.abs(p.vx) - DEC * dt);
    } else if (ax !== 0) {
      p.vx += ax * AIR * dt;
      const lim = Math.max(maxV, Math.abs(p.airMax || 0));
      p.vx = clamp(p.vx, -lim, lim);
    }
    // 跳跃
    p.coyote = p.onGround ? COYOTE : p.coyote - dt;
    p.buf -= dt;
    if (p.buf > 0 && p.coyote > 0) {
      p.vy = -(JUMP + Math.abs(p.vx) * JUMP_K);
      p.airMax = Math.abs(p.vx);
      p.onGround = false;
      p.lift = null;
      p.coyote = 0;
      p.buf = 0;
      this.sfx.play(this.power > 0 ? 'nes_jumpbig' : 'nes_jump');
    }
    const g = p.vy < 0 && pad.down.A ? G_HOLD : G_FALL;
    p.vy = Math.min(MAX_FALL, p.vy + g * dt);
    // 升降台带着走
    if (p.lift) {
      const L = p.lift;
      if (p.x + p.w <= L.x || p.x >= L.x + L.w || p.vy < 0) p.lift = null;
      else {
        p.x += L.dx;
        p.y = L.y - p.h;
        p.vy = Math.max(0, p.vy);
      }
    }
    this.moveX(p, p.vx * dt);
    // 左边界：镜头左侧
    if (p.x < this.cam) { p.x = this.cam; if (p.vx < 0) p.vx = 0; }
    const prevBottom = p.y + p.h;
    this.moveY(p, p.vy * dt, prevBottom);
    if (p.onGround) p.chain = 0;
    // 升降台着陆
    if (!p.lift && p.vy >= 0) {
      for (const L of this.lifts) {
        if (p.x + p.w > L.x + 1 && p.x < L.x + L.w - 1 && prevBottom <= L.y + 3 && p.y + p.h >= L.y) {
          p.y = L.y - p.h;
          p.vy = 0;
          p.onGround = true;
          p.lift = L;
          break;
        }
      }
    }
    if (p.lift) p.onGround = true;
    p.walkT += Math.abs(p.vx) * dt * 0.09;
    p.inv = Math.max(0, p.inv - dt);
    // 横向管道入口
    if (p.onGround && ax > 0) {
      for (const pp of this.area.pipes) {
        if (pp.dir !== 'right') continue;
        const px0 = pp.x * TS;
        if (p.x + p.w >= px0 - 1 && p.x + p.w <= px0 + 3 && p.y + p.h <= (pp.y + 2) * TS + 1 && p.y >= pp.y * TS - 4) {
          p.anim = 'pipeRight';
          p.animT = 0;
          p.pipe = pp;
          p.vx = 0;
          this.sfx.play('nes_pipe');
          return;
        }
      }
    }
    // 危险物
    const l = Math.floor((p.x + 2) / TS), r = Math.floor((p.x + p.w - 2) / TS);
    const ty0 = Math.floor((p.y + 2) / TS), ty1 = Math.floor((p.y + p.h - 1) / TS);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = l; tx <= r; tx++) {
      const t = this.tileAt(tx, ty);
      if (t === SPIKE && p.y + p.h > ty * TS + 8) this.hurt();
      if (t === LAVA && p.y + p.h > ty * TS + 4) { this.die(); return; }
    }
    if (p.y > ROWS * TS + 24) { this.die(); return; }
    // 收集橙子币
    for (const c of this.area.coinsLeft) {
      if (c.got) continue;
      if (p.x + p.w > c.x + 3 && p.x < c.x + 13 && p.y + p.h > c.y + 2 && p.y < c.y + 14) {
        c.got = true;
        this.addCoin(c.x + 8, c.y + 4, false);
      }
    }
    // 存档点
    for (const ch of this.area.checks) {
      if (!this.checkpointHit && p.x > ch.x + 4) {
        this.checkpointHit = true;
        this.sfx.play('nes_coin');
        this.parts.emit(ch.x + 9, ch.y + 6, 10, { color: ['#ffd84a', '#ffffff'], speed: 60, life: 0.5, size: 2 });
      }
    }
    // 旗杆
    const F = this.area.flag;
    if (F && p.x + p.w >= F.x - 0.5 && p.x < F.x + 12 && p.y < F.bottom + 16) {
      this.touchFlag();
      return;
    }
    // 茶室（城堡关：打倒 Boss 后直接走进门）
    const Hh = this.area.house;
    if (Hh && !F && this.area.bossDone && p.x + p.w / 2 >= Hh.door) this.reachHouse();
  }

  moveX(o, dx) {
    o.x += dx;
    const top = Math.floor((o.y + 1) / TS), bot = Math.floor((o.y + o.h - 1) / TS);
    if (dx > 0) {
      const tx = Math.floor((o.x + o.w) / TS);
      for (let ty = top; ty <= bot; ty++) if (this.solid(tx, ty)) { o.x = tx * TS - o.w; o.vx = 0; o.hitWall = 1; return true; }
    } else if (dx < 0) {
      const tx = Math.floor(o.x / TS);
      for (let ty = top; ty <= bot; ty++) if (this.solid(tx, ty)) { o.x = (tx + 1) * TS; o.vx = 0; o.hitWall = -1; return true; }
    }
    return false;
  }

  moveY(o, dy, prevBottom, isPlayer = true) {
    o.y += dy;
    o.onGround = false;
    const l = Math.floor((o.x + 1) / TS), r = Math.floor((o.x + o.w - 1) / TS);
    if (dy >= 0) {
      const ty = Math.floor((o.y + o.h) / TS);
      for (let tx = l; tx <= r; tx++) {
        const t = this.tileAt(tx, ty);
        if (SOLID.has(t) || (ONEWAY.has(t) && prevBottom <= ty * TS + 1)) {
          o.y = ty * TS - o.h;
          o.vy = 0;
          o.onGround = true;
          return;
        }
      }
    } else {
      const ty = Math.floor(o.y / TS);
      let best = -1, bestD = 99;
      for (let tx = l; tx <= r; tx++) {
        const t = this.tileAt(tx, ty);
        if (SOLID.has(t) || (isPlayer && t === HIDDEN)) {
          const d = Math.abs(tx * TS + 8 - (o.x + o.w / 2));
          if (d < bestD) { bestD = d; best = tx; }
        }
      }
      if (best >= 0) {
        // 头顶擦边时侧移一点（手感更好）
        const overlapL = best * TS + TS - o.x, overlapR = o.x + o.w - best * TS;
        if (isPlayer && l !== r) {
          const other = best === l ? r : l;
          const ot = this.tileAt(other, ty);
          const freeOther = !SOLID.has(ot) && ot !== HIDDEN;
          if (freeOther && best === l && overlapL <= 4) { o.x = (best + 1) * TS; return; }
          if (freeOther && best === r && overlapR <= 4) { o.x = best * TS - o.w; return; }
        }
        o.y = (ty + 1) * TS;
        o.vy = 40;
        if (isPlayer) this.hitBlock(best, ty);
      }
    }
  }

  // ———————————————————— 砖块 / 道具箱 ————————————————————
  hitBlock(tx, ty) {
    const a = this.area;
    const t = this.tileAt(tx, ty);
    const idx = ty * a.w + tx;
    const content = a.rt.content.get(idx);
    if (t === MULTI) {
      const m = a.rt.multi.get(idx) || { n: 0, t0: this.t };
      m.n++;
      a.rt.multi.set(idx, m);
      this.bump(tx, ty);
      this.addCoin(tx * TS + 8, ty * TS - 8, true);
      if (m.n >= 10 || this.t - m.t0 > 4) this.setTile(tx, ty, USED);
      return;
    }
    if (t === BOX || t === HIDDEN || (t === BRICK && content)) {
      this.setTile(tx, ty, USED);
      this.bump(tx, ty);
      this.spawnContent(content || 'coin', tx, ty);
      return;
    }
    if (t === BRICK) {
      if (this.power > 0) this.breakBrick(tx, ty);
      else {
        this.bump(tx, ty);
        this.sfx.play('nes_bump');
      }
      return;
    }
    this.sfx.play('nes_bump');
  }

  bump(tx, ty) {
    this.bumps.push({ tx, ty, t: 0 });
    // 顶起砖块时把上面的敌人打飞、上面的币顶出来
    const x0 = tx * TS, top = ty * TS;
    for (const e of this.enemies) {
      if (!e.active || e.state === 'dead') continue;
      if (e.x + e.w > x0 && e.x < x0 + TS && Math.abs(e.y + e.h - top) < 3) this.killEnemy(e, 100, e.x + e.w / 2 < x0 + 8 ? -1 : 1);
    }
    for (const c of this.area.coinsLeft) {
      if (!c.got && Math.abs(c.x - x0) < 8 && Math.abs(c.y + TS - top) < 4) {
        c.got = true;
        this.addCoin(c.x + 8, c.y, true);
      }
    }
    for (const it of this.items) {
      if (it.emerge <= 0 && it.x + 16 > x0 && it.x < x0 + 16 && Math.abs(it.y + 16 - top) < 3) { it.vy = -160; it.vx = it.x < x0 ? -Math.abs(it.vx || 50) : Math.abs(it.vx || 50); }
    }
  }

  breakBrick(tx, ty) {
    this.setTile(tx, ty, E);
    this.bump(tx, ty);
    this.bumps.pop();
    const x = tx * TS, y = ty * TS;
    const th = THEMES[this.area.theme].brick;
    for (const [dx, dy, vx, vy] of [[0, 0, -60, -260], [8, 0, 60, -260], [0, 8, -50, -180], [8, 8, 50, -180]]) {
      this.parts.list.push({ x: x + dx + 4, y: y + dy + 4, vx, vy, life: 1.2, max: 1.2, size: 6, color: th[0], g: 900, drag: 0, shape: 'square' });
    }
    this.score += 50;
    this.sfx.play('nes_break');
  }

  spawnContent(what, tx, ty) {
    if (what === 'coin') {
      this.addCoin(tx * TS + 8, ty * TS - 8, true);
      return;
    }
    let kind = 'leaf';
    if (what === 'power') kind = this.power > 0 ? 'tea' : 'orange';
    this.items.push({ kind, x: tx * TS, y: ty * TS, vx: 0, vy: 0, emerge: 0.6, w: 16, h: 16, onGround: false });
    this.sfx.play('nes_appear');
  }

  addCoin(x, y, popup) {
    this.coins++;
    this.score += 200;
    this.sfx.play('nes_coin', { minGap: 0.01 });
    if (popup) this.coinPops.push({ x: x - 8, y: y - 8, vy: -330, t: 0 });
    if (this.coins >= 100) {
      this.coins -= 100;
      this.oneUp(x, y);
    }
  }

  oneUp(x, y) {
    this.lives = Math.min(99, this.lives + 1);
    this.pops.push({ x, y, str: '1UP', t: 0, color: '#7bff7b' });
    this.sfx.play('nes_1up');
  }

  addScore(n, x, y) {
    this.score += n;
    this.pops.push({ x, y, str: String(n), t: 0, color: '#ffffff' });
  }

  chainScore(o, x, y) {
    if (o.chain >= CHAIN.length) {
      this.oneUp(x, y);
    } else this.addScore(CHAIN[o.chain], x, y);
    o.chain++;
  }

  // ———————————————————— 世界里的其它东西 ————————————————————
  stepWorld(dt, interact) {
    const p = this.p;
    // 升降台
    for (const L of this.lifts) {
      L.t += dt;
      const ox = L.x, oy = L.y;
      if (L.kind === 'h') L.x = L.x0 + Math.sin(L.t * L.speed) * L.range;
      else L.y = L.y0 + Math.sin(L.t * L.speed) * L.range;
      L.dx = L.x - ox;
      L.dy = L.y - oy;
    }
    // 火焰棒
    for (const f of this.firebars) {
      f.a += f.speed * dt;
      if (!interact || p.inv > 0 || p.dead) continue;
      for (let i = 1; i < f.len; i++) {
        const fx = f.x + Math.cos(f.a) * i * 7, fy = f.y + Math.sin(f.a) * i * 7;
        if (fx > p.x - 2 && fx < p.x + p.w + 2 && fy > p.y - 2 && fy < p.y + p.h + 2) { this.hurt(); break; }
      }
    }
    // 道具
    for (const it of this.items) {
      if (it.emerge > 0) {
        it.emerge -= dt;
        it.y -= (16 / 0.6) * dt;
        if (it.emerge <= 0) {
          it.y = Math.round(it.y);
          it.vx = it.kind === 'tea' ? 0 : 52;
        }
        continue;
      }
      if (it.kind !== 'tea') {
        it.vy = Math.min(MAX_FALL, it.vy + 900 * dt);
        if (this.moveX(it, it.vx * dt)) it.vx = -(it.hitWall || 1) * 52;
        this.moveY(it, it.vy * dt, it.y + it.h, false);
      }
      if (it.y > ROWS * TS + 20) it.dead = true;
      if (interact && !p.dead && p.x + p.w > it.x + 2 && p.x < it.x + 14 && p.y + p.h > it.y + 2 && p.y < it.y + 16) {
        it.dead = true;
        this.collect(it);
      }
    }
    this.items = this.items.filter((i) => !i.dead);
    // 茶叶球
    for (const b of this.balls) {
      b.t += dt;
      b.vy = Math.min(320, b.vy + 900 * dt);
      b.x += b.vx * dt;
      const tx = Math.floor((b.x + (b.vx > 0 ? 6 : 0)) / TS), tyc = Math.floor((b.y + 3) / TS);
      if (SOLID.has(this.tileAt(tx, tyc))) {
        b.dead = true;
        this.puff(b.x, b.y);
        continue;
      }
      b.y += b.vy * dt;
      const ty = Math.floor((b.y + 6) / TS);
      const tb = this.tileAt(Math.floor((b.x + 3) / TS), ty);
      if (b.vy > 0 && (SOLID.has(tb) || ONEWAY.has(tb))) {
        b.y = ty * TS - 6;
        b.vy = -170;
      }
      if (b.t > 3 || b.x < this.cam - 16 || b.x > this.cam + VW + 16 || b.y > ROWS * TS) b.dead = true;
      for (const e of this.enemies) {
        if (b.dead || !e.active || e.state === 'dead' || e.state === 'flat') continue;
        if (b.x + 6 > e.x && b.x < e.x + e.w && b.y + 6 > e.y && b.y < e.y + e.h) {
          b.dead = true;
          this.puff(b.x, b.y);
          this.killEnemy(e, 200, Math.sign(b.vx));
        }
      }
      const B = this.boss;
      if (!b.dead && B && this.bossActive && B.state !== 'dying' && b.x + 6 > B.x && b.x < B.x + B.w && b.y + 6 > B.y && b.y < B.y + B.h) {
        b.dead = true;
        this.puff(b.x, b.y);
        this.hitBoss(0.34);
      }
    }
    this.balls = this.balls.filter((b) => !b.dead);
    // 敌人
    for (const e of this.enemies) this.stepEnemy(e, dt, interact);
    this.enemies = this.enemies.filter((e) => !e.gone);
    if (this.boss) this.stepBoss(dt, interact);
    // Boss 的炮弹
    for (const s of this.bossShots) {
      s.vy = Math.min(300, s.vy + 700 * dt);
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const ty = Math.floor((s.y + 8) / TS);
      if (s.vy > 0 && SOLID.has(this.tileAt(Math.floor((s.x + 4) / TS), ty))) { s.y = ty * TS - 8; s.vy = -220; }
      if (s.x < this.cam - 20 || s.x > this.cam + VW + 20) s.dead = true;
      if (interact && !p.dead && p.inv <= 0 && s.x + 8 > p.x && s.x < p.x + p.w && s.y + 8 > p.y && s.y < p.y + p.h) this.hurt();
      for (const b of this.balls) {
        if (!b.dead && Math.abs(b.x - s.x) < 8 && Math.abs(b.y - s.y) < 8) { b.dead = true; s.dead = true; this.puff(s.x, s.y); }
      }
    }
    this.bossShots = this.bossShots.filter((s) => !s.dead);
  }

  collect(it) {
    const p = this.p;
    if (it.kind === 'leaf') {
      this.oneUp(it.x + 8, it.y);
      return;
    }
    this.addScore(1000, it.x + 8, it.y);
    if (it.kind === 'orange' || this.power === 0) {
      if (this.power === 0) this.setPower(1);
      else this.sfx.play('nes_power');
    } else if (it.kind === 'tea') {
      if (this.power < 2) this.setPower(2);
      else this.sfx.play('nes_power');
    }
  }

  setPower(v) {
    const p = this.p;
    const was = this.power;
    this.power = v;
    const feet = p.y + p.h;
    p.h = v > 0 ? 28 : 14;
    p.y = feet - p.h;
    // 变大时如果头顶有方块，往下挪不了就保持（卡住也没关系，下一帧会被推出）
    this.freeze = 0.7;
    this.growFrom = was;
    this.growT = 0;
    this.sfx.play(v >= was ? 'nes_power' : 'nes_shrink');
  }

  hurt() {
    const p = this.p;
    if (p.inv > 0 || p.dead || this.mode !== 'play') return;
    if (this.power > 0) {
      this.setPower(0);
      p.inv = 2.2;
    } else this.die();
  }

  die() {
    const p = this.p;
    if (p.dead || this.mode !== 'play') return;
    p.dead = true;
    p.anim = null;
    p.vy = 0;
    p.vx = 0;
    this.power = 0;
    p.deadT = 0;
    this.sfx.music.stop();
    this.sfx.music.play(JINGLE_DIE, this, { loop: false });
    this.setMode('dying');
  }

  stepDeath(dt) {
    const p = this.p;
    p.deadT += dt;
    if (p.deadT > 0.5) {
      if (!p.popped) { p.popped = true; p.vy = -300; }
      p.vy += 900 * dt;
      p.y += p.vy * dt;
    }
    if (p.deadT > 3.2) {
      this.lives--;
      if (this.lives <= 0) {
        this.submitScore(this.score);
        this.sfx.music.play(JINGLE_OVER, this, { loop: false });
        this.setMode('gameover');
      } else {
        this.goIntro(this.levelIdx, false);
      }
    }
  }

  puff(x, y) {
    this.parts.list.push({ x: x + 3, y: y + 3, vx: 0, vy: -10, life: 0.25, max: 0.25, size: 8, color: '#ffffff', g: 0, drag: 0, shape: 'puff' });
  }

  firework(x, y) {
    const cols = ['#ffd84a', '#ff6fa8', '#7bd94f', '#4aa0ff', '#ffffff'];
    this.parts.emit(x, y, 24, { color: cols[(Math.random() * cols.length) | 0], speed: 70, life: 0.9, size: 2, gravity: 40, drag: 1.5 });
    this.sfx.play('nes_firework', { minGap: 0.1 });
  }

  // ———————————————————— 敌人 ————————————————————
  stepEnemy(e, dt, interact) {
    const p = this.p;
    if (!e.active) {
      if (e.x < this.cam + VW + 24) e.active = true;
      else return;
    }
    e.t += dt;
    if (e.state === 'dead') {
      e.vy += 900 * dt;
      e.y += e.vy * dt;
      e.x += e.vx * dt;
      if (e.y > ROWS * TS + 40) e.gone = true;
      return;
    }
    if (e.state === 'flat') {
      e.deadT += dt;
      if (e.deadT > 0.5) e.gone = true;
      return;
    }
    if (e.x < this.cam - 64 || e.y > ROWS * TS + 32) { e.gone = true; return; }
    e.kickT = Math.max(0, e.kickT - dt);
    if (e.state === 'fly') {
      e.x = e.x0 + Math.sin(e.t * 1.2) * e.range;
      e.y = e.y0 + Math.sin(e.t * 3.1) * 6;
      e.face = Math.cos(e.t * 1.2) > 0 ? 1 : -1;
    } else {
      if (e.state === 'shell') {
        e.vx = 0;
        e.wake += dt;
        if (e.wake > 7) { e.state = 'walk'; e.vx = -32; e.h = 14; }
      }
      e.vy = Math.min(MAX_FALL, e.vy + 900 * dt);
      const sp = e.vx;
      if (this.moveX(e, e.vx * dt)) {
        e.vx = -sp;
        if (e.state === 'shellMove' && e.x > this.cam - 16 && e.x < this.cam + VW + 16) this.sfx.play('nes_bump');
      }
      this.moveY(e, e.vy * dt, e.y + e.h, false);
      // 走路的敌人互相碰到就掉头
      if (e.state === 'walk') {
        for (const o of this.enemies) {
          if (o === e || !o.active || o.state !== 'walk') continue;
          if (e.x + e.w > o.x && e.x < o.x + o.w && e.y + e.h > o.y && e.y < o.y + o.h) {
            if ((e.vx < 0 && o.x < e.x) || (e.vx > 0 && o.x > e.x)) e.vx = -e.vx;
          }
        }
      }
      // 踢出去的壳会撞飞其它敌人
      if (e.state === 'shellMove') {
        for (const o of this.enemies) {
          if (o === e || !o.active || o.state === 'dead' || o.state === 'flat') continue;
          if (e.x + e.w > o.x && e.x < o.x + o.w && e.y + e.h > o.y && e.y < o.y + o.h) {
            this.killEnemy(o, 0, Math.sign(e.vx));
            this.chainScore(e, o.x + 8, o.y);
          }
        }
      }
      if (e.state === 'walk' || e.state === 'shellMove') e.face = e.vx > 0 ? 1 : -1;
    }
    if (!interact || p.dead || p.anim) return;
    // 与玩家
    if (p.x + p.w > e.x + 1 && p.x < e.x + e.w - 1 && p.y + p.h > e.y + 1 && p.y < e.y + e.h) {
      const prevBottom = p.y + p.h - p.vy * STEP;
      const fromAbove = p.vy > 0 && prevBottom <= e.y + 6;
      if (fromAbove && e.type !== 'hedge') {
        this.stomp(e);
      } else if (e.state === 'shell') {
        this.kickShell(e);
      } else if (e.state === 'shellMove' && e.kickT > 0) {
        // 刚踢出去的一瞬间不伤人
      } else if (p.inv <= 0) {
        this.hurt();
      }
    }
  }

  stomp(e) {
    const p = this.p;
    p.vy = -(this.lastPad && this.lastPad.down.A ? STOMP_HI : STOMP);
    p.y = e.y - p.h;
    this.chainScore(p, e.x + 8, e.y - 4);
    this.sfx.play('nes_stomp');
    if (e.type === 'slime') {
      e.state = 'flat';
      e.deadT = 0;
    } else if (e.type === 'snail') {
      if (e.state === 'walk' || e.state === 'shellMove') {
        e.state = 'shell';
        e.vx = 0;
        e.wake = 0;
        e.h = 14;
      } else if (e.state === 'shell') this.kickShell(e);
    } else if (e.type === 'bee') {
      this.killEnemy(e, 0, p.face);
    }
  }

  kickShell(e) {
    const p = this.p;
    e.state = 'shellMove';
    e.vx = (p.x + p.w / 2 < e.x + e.w / 2 ? 1 : -1) * 200;
    e.kickT = 0.25;
    e.chain = 0;
    this.addScore(400, e.x + 8, e.y);
    this.sfx.play('nes_kick');
  }

  killEnemy(e, pts, dir = 1) {
    e.state = 'dead';
    e.vy = -200;
    e.vx = 40 * (dir || 1);
    if (pts) this.addScore(pts, e.x + 8, e.y);
    this.sfx.play('nes_kick');
  }

  // ———————————————————— Boss ————————————————————
  stepBoss(dt, interact) {
    const B = this.boss, p = this.p;
    B.t += dt;
    B.inv = Math.max(0, B.inv - dt);
    if (!this.bossActive) {
      if (p.x > B.arenaL + 24) {
        this.bossActive = true;
        B.state = 'walk';
        this.sfx.play('boss');
      } else return;
    }
    if (B.state === 'dying') {
      B.vy += 700 * dt;
      B.y += B.vy * dt;
      if (B.y > ROWS * TS + 60 && !this.area.bossDone) this.bossDefeated();
      return;
    }
    B.vy = Math.min(MAX_FALL, B.vy + 900 * dt);
    const dir = p.x + p.w / 2 < B.x + B.w / 2 ? -1 : 1;
    B.face = dir;
    if (B.onGround) B.vx = dir * (B.hp <= 2 ? 48 : 30);
    B.jumpT -= dt;
    B.shotT -= dt;
    if (B.jumpT <= 0 && B.onGround) {
      B.jumpT = 2 + Math.random() * 1.5;
      B.vy = -300;
      B.vx = dir * 70;
      B.onGround = false;
    }
    if (B.shotT <= 0) {
      B.shotT = B.hp <= 2 ? 1.6 : 2.6;
      this.bossShots.push({ x: B.x + (dir > 0 ? B.w : -8), y: B.y + 10, vx: dir * 110, vy: -120, dead: false });
      this.sfx.play('nes_fire');
    }
    const wasAir = !B.onGround;
    this.moveX(B, B.vx * dt);
    B.x = clamp(B.x, B.arenaL, B.arenaR - B.w);
    this.moveY(B, B.vy * dt, B.y + B.h, false);
    if (wasAir && B.onGround) {
      this.shake = 0.25;
      this.sfx.play('nes_bump');
    }
    if (!interact || p.dead || p.anim) return;
    if (p.x + p.w > B.x + 2 && p.x < B.x + B.w - 2 && p.y + p.h > B.y + 2 && p.y < B.y + B.h) {
      const prevBottom = p.y + p.h - p.vy * STEP;
      if (p.vy > 0 && prevBottom <= B.y + 8) {
        p.vy = -STOMP_HI;
        p.y = B.y - p.h;
        if (B.inv <= 0) this.hitBoss(1);
      } else if (p.inv <= 0 && B.inv <= 0.6) this.hurt();
    }
  }

  hitBoss(n) {
    const B = this.boss;
    if (!B || B.state === 'dying' || B.inv > 0) return;
    B.hp -= n;
    B.inv = n >= 1 ? 1.0 : 0.25;
    this.sfx.play('nes_bossHit');
    if (B.hp <= 0) {
      B.state = 'dying';
      B.vy = -200;
      this.addScore(5000, B.x + 14, B.y);
      this.sfx.music.stop();
    }
  }

  bossDefeated() {
    const a = this.area;
    a.bossDone = true;
    this.boss = null;
    this.bossActive = false;
    if (a.gate) {
      for (let y = a.gate.y0; y <= a.gate.y1; y++) {
        this.setTile(a.gate.x, y, E);
        this.puff(a.gate.x * TS + 4, y * TS + 4);
      }
    }
    this.sfx.play('nes_break');
    this.sfx.music.play(JINGLE_CLEAR, this, { loop: false });
  }

  // ———————————————————— 管道 / 旗杆 / 通关 ————————————————————
  stepAnim(dt, pad) {
    const p = this.p;
    p.animT += dt;
    if (p.anim === 'pipeDown') {
      p.y += 34 * dt;
      if (p.animT > 0.95) {
        const to = p.pipe.to;
        p.anim = 'hold';
        this.fadeFn = () => this.switchArea(to);
      }
    } else if (p.anim === 'pipeRight') {
      p.x += 30 * dt;
      p.walkT += dt * 3;
      if (p.animT > 0.8) {
        const to = p.pipe.to;
        p.anim = 'hold';
        this.fadeFn = () => this.switchArea(to);
      }
    } else if (p.anim === 'pipeUp') {
      p.y -= 34 * dt;
      if (p.y <= p.targetY) {
        p.y = p.targetY;
        p.anim = null;
        p.onGround = true;
      }
    } else if (p.anim === 'pole') {
      const F = this.area.flag;
      const bottom = F.bottom - p.h;
      if (p.y < bottom) p.y = Math.min(bottom, p.y + 110 * dt);
      if (this.flagY < F.bottom - 16) this.flagY = Math.min(F.bottom - 16, this.flagY + 110 * dt);
      if (p.y >= bottom && this.flagY >= F.bottom - 16) {
        p.poleWait = (p.poleWait || 0) + dt;
        if (p.poleWait > 0.35 && !p.flipped) {
          p.flipped = true;
          p.x = F.x + 10;
          p.face = -1;
          this.sfx.music.play(JINGLE_CLEAR, this, { loop: false });
        }
        if (p.poleWait > 0.8) {
          p.anim = 'walkout';
          p.face = 1;
          p.vy = -80;
        }
      }
    } else if (p.anim === 'walkout') {
      p.vx = 60;
      p.walkT += dt * 4;
      p.vy = Math.min(MAX_FALL, p.vy + G_FALL * dt);
      this.moveX(p, p.vx * dt);
      this.moveY(p, p.vy * dt, p.y + p.h);
      const Hh = this.area.house;
      if (Hh && p.x + p.w / 2 >= Hh.door) this.reachHouse();
      this.cam = clamp(Math.max(this.cam, p.x + p.w / 2 - VW * 0.42), 0, this.area.w * TS - VW);
    }
  }

  switchArea(to) {
    this.enterArea(to.area, to.spawn);
    this.playAreaMusic();
  }

  touchFlag() {
    const p = this.p, F = this.area.flag;
    const span = F.bottom - F.top;
    const hgt = clamp((F.bottom - (p.y + p.h)) / span, 0, 1);
    const pts = hgt > 0.9 ? 5000 : hgt > 0.7 ? 2000 : hgt > 0.45 ? 800 : hgt > 0.2 ? 400 : 100;
    this.addScore(pts, F.x + 12, p.y);
    p.anim = 'pole';
    p.animT = 0;
    p.vx = 0;
    p.vy = 0;
    p.x = F.x + 8 - p.w;
    p.face = 1;
    this.sfx.music.stop();
    this.sfx.play('nes_flag');
  }

  reachHouse() {
    const p = this.p;
    p.hidden = true;
    p.anim = 'hold';
    p.vx = 0;
    this.setMode('clear');
    this.clearT = 0;
  }

  stepClear(dt) {
    this.clearT += dt;
    if (this.time > 0 && this.clearT > 0.6) {
      const n = Math.min(this.time, Math.max(1, Math.round(dt * 160)));
      this.time -= n;
      this.score += n * 50;
      this.tickAcc = (this.tickAcc || 0) + n;
      if (this.tickAcc >= 3) { this.tickAcc = 0; this.sfx.play('nes_tick', { minGap: 0.02 }); }
      if (this.time === 0) this.doneT = this.clearT;
      return;
    }
    if (this.doneT == null) this.doneT = this.clearT;
    const since = this.clearT - this.doneT;
    if (since > 0.3 && since < 2 && Math.random() < dt * 4) this.firework(this.cam + 60 + Math.random() * 200, 40 + Math.random() * 50);
    if (since > 2.6) {
      this.doneT = null;
      if (this.levelIdx + 1 < LEVELS.length) {
        this.checkpointHit = false;
        this.goIntro(this.levelIdx + 1, true);
      } else {
        this.submitScore(this.score);
        this.sfx.music.play(JINGLE_ENDING, this, { loop: false });
        this.setMode('ending');
      }
    }
  }

  // ———————————————————— 绘制 ————————————————————
  draw(ctx) {
    const c = this.vc;
    c.imageSmoothingEnabled = false;
    if (this.mode === 'intro' || this.mode === 'gameover') {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      this.drawHUD(ctx);
      if (this.mode === 'intro') {
        const L = LEVELS[this.levelIdx]();
        outlineText(ctx, `世界 ${L.name}`, W / 2, 300, 56, '#ffffff', '#000', 2, 'center', 800);
        text(ctx, L.label, W / 2, 360, 28, '#ffd84a', 'center', 700);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.A.spr.s_stand.r, W / 2 - 110, 420, 64, 64);
        text(ctx, `×  ${this.lives}`, W / 2 + 10, 454, 40, '#ffffff', 'left', 800);
      } else {
        outlineText(ctx, '游戏结束', W / 2, 340, 64, '#ffffff', '#000', 2, 'center', 800);
        text(ctx, `最终得分 ${this.score}`, W / 2, 420, 26, '#ffd84a', 'center', 700);
      }
      return;
    }
    if (this.mode === 'ending') {
      this.drawEnding(ctx);
      return;
    }
    this.renderWorld(c);
    ctx.imageSmoothingEnabled = false;
    let sx = 0, sy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - 1 / 60);
      sx = (Math.random() - 0.5) * 12;
      sy = (Math.random() - 0.5) * 12;
    }
    ctx.drawImage(this.view, sx, sy, W, H);
    ctx.imageSmoothingEnabled = true;
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${clamp(this.fade, 0, 1).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.mode === 'title') this.drawTitle(ctx);
    else this.drawHUD(ctx);
  }

  renderWorld(c) {
    const a = this.area;
    const cam = Math.floor(this.cam);
    const th = THEMES[a.theme];
    c.fillStyle = th.sky;
    c.fillRect(0, 0, VW, VH);
    const pxo = -(Math.floor(cam * 0.3) % VW);
    c.drawImage(this.par, pxo, 0);
    c.drawImage(this.par, pxo + VW, 0);
    c.save();
    c.translate(-cam, -CAM_Y);
    // 装饰
    for (const d of a.decor) {
      const img = this.decor[d.kind];
      if (!img || d.x + img.width < cam || d.x > cam + VW) continue;
      c.drawImage(img, Math.round(d.x), Math.round(d.y));
    }
    if (a.house) c.drawImage(this.A.house, a.house.x, a.house.y);
    // 存档点
    for (const ch of a.checks) c.drawImage(this.tiles[this.checkpointHit ? 'check1' : 'check0'], ch.x, ch.y);
    // 正在冒出来的道具（在方块后面）
    for (const it of this.items) if (it.emerge > 0) this.drawItem(c, it);
    const p = this.p;
    const inPipe = p.anim === 'pipeDown' || p.anim === 'pipeUp' || p.anim === 'pipeRight';
    if (inPipe) this.drawPlayer(c);
    // 图块
    const t0 = Math.max(0, Math.floor(cam / TS) - 1), t1 = Math.min(a.w - 1, Math.floor((cam + VW) / TS) + 1);
    const T = this.tiles;
    const boxF = [0, 0, 1, 2, 1][Math.floor(this.t * 7) % 5];
    const lavaF = Math.floor(this.t * 3) % 2;
    for (let ty = 0; ty < ROWS; ty++) for (let tx = t0; tx <= t1; tx++) {
      const v = this.grid[ty * a.w + tx];
      if (!v || v === HIDDEN || v === WALL) continue;
      let img;
      switch (v) {
        case GROUND: img = ty > 0 && this.grid[(ty - 1) * a.w + tx] === GROUND ? T.dirt : T.ground; break;
        case BRICK: case MULTI: img = T.brick; break;
        case BOX: img = T['box' + boxF]; break;
        case USED: img = T.used; break;
        case HARD: img = T.hard; break;
        case PIPE: img = T[PIPE_SKIN[a.skin[ty * a.w + tx]] || 'pipeL']; break;
        case CLOUD: img = T.cloud; break;
        case BRIDGE: img = T.bridge; break;
        case SPIKE: img = T.spike; break;
        case LAVA: img = T['lava' + lavaF]; break;
        default: img = null;
      }
      if (!img) continue;
      let off = 0;
      for (const b of this.bumps) if (b.tx === tx && b.ty === ty) off = Math.round(Math.sin((b.t / 0.16) * Math.PI) * 5);
      c.drawImage(img, tx * TS, ty * TS - off);
    }
    // 旗杆
    if (a.flag) {
      const F = a.flag;
      c.drawImage(T.poleTop, F.x, F.top - 16);
      for (let y = F.top; y < F.bottom; y += 16) c.drawImage(T.pole, F.x, y);
      c.drawImage(this.A.spr.flag.r, F.x - 8, Math.round(this.flagY));
    }
    // 升降台
    for (const L of this.lifts) {
      for (let i = 0; i < L.w; i += 16) c.drawImage(T.bridge, Math.round(L.x + i), Math.round(L.y));
    }
    // 火焰棒
    for (const f of this.firebars) {
      for (let i = 0; i < f.len; i++) {
        const fx = Math.round(f.x + Math.cos(f.a) * i * 7), fy = Math.round(f.y + Math.sin(f.a) * i * 7);
        c.fillStyle = '#ff5a1a';
        c.fillRect(fx - 3, fy - 3, 6, 6);
        c.fillStyle = '#ffd84a';
        c.fillRect(fx - 2, fy - 2, 4, 4);
        c.fillStyle = '#ffffff';
        c.fillRect(fx - 1, fy - 1, 2, 2);
      }
    }
    // 橙子币
    const coinF = [0, 1, 2, 1][Math.floor(this.t * 6) % 4];
    for (const cn of a.coinsLeft) {
      if (cn.got || cn.x < cam - 16 || cn.x > cam + VW) continue;
      c.drawImage(this.A.spr['coin' + coinF].r, cn.x, cn.y);
    }
    for (const cp of this.coinPops) c.drawImage(this.A.spr['coin' + [0, 1, 2, 1][Math.floor(cp.t * 16) % 4]].r, Math.round(cp.x), Math.round(cp.y));
    // 道具
    for (const it of this.items) if (it.emerge <= 0) this.drawItem(c, it);
    // 敌人
    for (const e of this.enemies) if (e.active) this.drawEnemy(c, e);
    if (this.boss && (this.bossActive || this.boss.x < cam + VW + 40)) this.drawBoss(c, this.boss);
    for (const s of this.bossShots) {
      c.fillStyle = '#1b1010';
      c.fillRect(Math.round(s.x), Math.round(s.y) + 1, 8, 6);
      c.fillRect(Math.round(s.x) + 1, Math.round(s.y), 6, 8);
      c.fillStyle = '#5a3a6a';
      c.fillRect(Math.round(s.x) + 1, Math.round(s.y) + 1, 6, 6);
      c.fillStyle = '#c9a0ff';
      c.fillRect(Math.round(s.x) + 2, Math.round(s.y) + 2, 2, 2);
    }
    // 茶叶球
    for (const b of this.balls) c.drawImage(this.A.spr['teaball' + (Math.floor(b.t * 12) % 2)].r, Math.round(b.x), Math.round(b.y));
    if (!inPipe) this.drawPlayer(c);
    // 粒子
    for (const q of this.parts.list) {
      if (q.shape === 'puff') {
        c.drawImage(this.A.spr[q.life > q.max / 2 ? 'puff0' : 'puff1'].r, Math.round(q.x) - 8, Math.round(q.y) - 8);
      } else {
        c.fillStyle = q.color;
        const s = Math.max(1, Math.round(q.size * (q.shape === 'square' ? 1 : 0.5 + 0.5 * q.life / q.max)));
        c.fillRect(Math.round(q.x - s / 2), Math.round(q.y - s / 2), s, s);
      }
    }
    for (const s of this.pops) pixText(c, s.str, Math.round(s.x - s.str.length * 2), Math.round(s.y - 8 - s.t * 30), s.color);
    c.restore();
  }

  drawItem(c, it) {
    const name = it.kind === 'orange' ? 'bigorange' : it.kind === 'tea' ? 'teacup' : 'leaf1up';
    c.drawImage(this.A.spr[name].r, Math.round(it.x), Math.round(it.y));
  }

  drawEnemy(c, e) {
    const S = this.A.spr;
    let name;
    if (e.type === 'slime') name = e.state === 'flat' ? 'slime_flat' : Math.floor(e.t * 4) % 2 ? 'slime2' : 'slime1';
    else if (e.type === 'snail') name = e.state === 'walk' ? (Math.floor(e.t * 3) % 2 ? 'snail2' : 'snail1') : 'shell';
    else if (e.type === 'hedge') name = Math.floor(e.t * 4) % 2 ? 'hedge2' : 'hedge1';
    else name = Math.floor(e.t * 10) % 2 ? 'bee2' : 'bee1';
    const spr = S[name];
    const img = e.face > 0 ? spr.l : spr.r;
    const x = Math.round(e.x - 1), y = Math.round(e.y + e.h - 16);
    if (e.state === 'dead') {
      c.save();
      c.translate(x + 8, y + 8);
      c.scale(1, -1);
      c.drawImage(img, -8, -8);
      c.restore();
    } else {
      let shakeX = 0;
      if (e.state === 'shell' && e.wake > 5.5) shakeX = Math.floor(e.t * 20) % 2 ? 1 : -1;
      c.drawImage(img, x + shakeX, y);
    }
  }

  drawBoss(c, B) {
    if (B.inv > 0 && Math.floor(this.t * 20) % 2 && B.state !== 'dying') return;
    const spr = this.A.spr.boss;
    const img = B.face > 0 ? spr.l : spr.r;
    const x = Math.round(B.x - 2), y = Math.round(B.y - 4);
    if (B.state === 'dying') {
      c.save();
      c.translate(x + 16, y + 16);
      c.scale(1, -1);
      c.drawImage(img, -16, -16);
      c.restore();
    } else c.drawImage(img, x, y);
    // 血条
    if (this.bossActive && B.state !== 'dying') {
      c.fillStyle = '#1b1010';
      c.fillRect(Math.round(B.x) - 2, Math.round(B.y) - 10, 32, 4);
      c.fillStyle = '#ff5a5a';
      c.fillRect(Math.round(B.x) - 1, Math.round(B.y) - 9, Math.round(30 * Math.max(0, B.hp) / 5), 2);
    }
  }

  drawPlayer(c) {
    const p = this.p;
    if (p.hidden) return;
    if (!p.dead && p.inv > 0 && Math.floor(this.t * 30) % 2) return;
    const S = this.A.spr;
    let form = this.power;
    if (this.freeze > 0 && this.growFrom != null) {
      // 变身闪烁：在新旧形态之间切换
      const k = Math.floor(this.freeze * 14) % 2;
      form = k ? this.growFrom : this.power;
    }
    const big = form > 0;
    const pre = form === 2 ? 'tea_' : '';
    let name;
    if (p.dead) name = 's_dead';
    else if (p.anim === 'pole') name = big ? 'b_climb' : 's_climb';
    else if (p.anim === 'pipeDown' || p.anim === 'pipeUp' || p.anim === 'hold') name = big ? 'b_stand' : 's_stand';
    else if (!p.onGround && p.anim !== 'walkout' && p.anim !== 'pipeRight') name = big ? 'b_jump' : 's_jump';
    else if (p.throwT > 0 && big) name = 'b_throw';
    else if (Math.abs(p.vx) > 4 || p.anim === 'walkout' || p.anim === 'pipeRight') {
      const f = ['walk1', 'walk2', 'walk3'][Math.floor(p.walkT) % 3];
      name = (big ? 'b_' : 's_') + (p.skid ? 'walk2' : f);
    } else name = big ? 'b_stand' : 's_stand';
    const spr = S[(name === 's_dead' ? '' : pre) + name] || S[name];
    const img = p.face < 0 ? spr.l : spr.r;
    const h = spr.h;
    c.drawImage(img, Math.round(p.x - 2), Math.round(p.y + p.h - h));
  }

  drawHUD(ctx) {
    const y1 = 26, y2 = 56;
    const lab = (s, x) => outlineText(ctx, s, x, y1, 20, '#ffffff', 'rgba(0,0,0,0.7)', 5, 'center', 700);
    const val = (s, x) => {
      ctx.font = '800 30px "DejaVu Sans Mono","Menlo","Consolas",monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(s, x, y2);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(s, x, y2);
    };
    lab('分数', 150);
    val(String(this.score).padStart(6, '0'), 150);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.A.spr.coin0.r, 352, 34, 40, 40);
    ctx.imageSmoothingEnabled = true;
    lab('橙子币', 430);
    val('×' + pad2(this.coins), 432);
    lab('世界', 690);
    val(this.def ? this.def.name : '1-1', 690);
    lab('时间', 920);
    val(this.mode === 'title' ? '   ' : String(Math.max(0, this.time)).padStart(3, '0'), 920);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.A.spr.s_stand.r, 1086, 30, 40, 40);
    ctx.imageSmoothingEnabled = true;
    lab('生命', 1160);
    val('×' + this.lives, 1160);
  }

  drawTitle(ctx) {
    const t = this.modeT;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, W, H);
    const s = easeOutBack(clamp(t / 0.6, 0, 1));
    // 标题牌
    ctx.save();
    ctx.translate(W / 2, 220);
    ctx.scale(s, s);
    ctx.fillStyle = '#1b1010';
    ctx.fillRect(-372, -104, 744, 200);
    ctx.fillStyle = '#c9580b';
    ctx.fillRect(-364, -96, 728, 184);
    ctx.fillStyle = '#ff8a1c';
    ctx.fillRect(-356, -88, 712, 168);
    ctx.fillStyle = '#ffd84a';
    for (const [x, y] of [[-348, -80], [340, -80], [-348, 72], [340, 72]]) ctx.fillRect(x, y, 8, 8);
    outlineText(ctx, '橙子大冒险', 0, -16, 92, '#fff3dc', '#1b1010', 14, 'center', 900);
    text(ctx, '原创 8-bit 平台闯关 · 前往茶室', 0, 56, 24, '#1b1010', 'center', 700);
    ctx.restore();
    const blink = Math.floor(t * 2) % 2 === 0;
    if (blink) outlineText(ctx, '按 A 开始游戏', W / 2, 452, 32, '#ffffff', '#1b1010', 8, 'center', 800);
    outlineText(ctx, `最高分  ${String(this.best).padStart(6, '0')}`, W / 2, 506, 24, '#ffd84a', '#1b1010', 6, 'center', 800);
    // 操作说明
    const items = [['STICK', '移动'], ['A', '跳（按久跳高）'], ['B', '跑 / 扔茶叶球'], ['DPAD', '↓ 进茶罐管道'], ['PLUS', '暂停']];
    let total = 0;
    const ws = items.map(([g, l]) => 34 + textW(ctx, l, 19, 600) + 26);
    total = ws.reduce((a, b) => a + b, 0) - 26;
    let x = W / 2 - total / 2;
    fillRR(ctx, x - 22, 646, total + 44, 44, 22, 'rgba(0,0,0,0.55)');
    items.forEach(([g, l], i) => {
      glyph(ctx, g, x + 12, 668, 12, '#ffffff', '#222');
      text(ctx, l, x + 32, 669, 19, '#ffffff', 'left', 600);
      x += ws[i];
    });
  }

  drawEnding(ctx) {
    const c = this.vc;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#2a1a2e';
    c.fillRect(0, 0, VW, VH);
    // 星空 + 烟花
    for (let i = 0; i < 40; i++) {
      c.fillStyle = i % 5 ? '#6a5a8a' : '#ffffff';
      c.fillRect((i * 73) % VW, (i * 37) % 90, 1, 1);
    }
    for (const q of this.parts.list) {
      c.fillStyle = q.color;
      c.fillRect(Math.round(q.x), Math.round(q.y), 2, 2);
    }
    // 茶室内景
    c.fillStyle = '#f6dfba';
    c.fillRect(40, 96, 240, 84);
    c.fillStyle = '#d9a36a';
    c.fillRect(40, 150, 240, 30);
    c.fillStyle = '#3f4458';
    c.fillRect(30, 88, 260, 10);
    for (let i = 0; i < 4; i++) {
      c.fillStyle = '#fff3dc';
      c.fillRect(58 + i * 56, 104, 40, 34);
      c.fillStyle = '#b07440';
      c.fillRect(58 + i * 56 + 19, 104, 2, 34);
    }
    c.fillStyle = '#8a5a3a';
    c.fillRect(120, 148, 80, 8);
    c.fillRect(126, 156, 6, 14);
    c.fillRect(188, 156, 6, 14);
    c.drawImage(this.A.spr.b_stand.r, 100, 138);
    c.drawImage(this.A.spr.boss.l, 200, 140);
    c.fillStyle = '#ffffff';
    c.fillRect(150, 142, 8, 6);
    c.fillRect(164, 142, 8, 6);
    c.fillStyle = '#7bc043';
    c.fillRect(151, 143, 6, 2);
    c.fillRect(165, 143, 6, 2);
    c.drawImage(this.A.spr.coin0.r, 140, 128);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.view, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    const s = easeOutBack(clamp(this.modeT / 0.8, 0, 1));
    ctx.save();
    ctx.translate(W / 2, 150);
    ctx.scale(s, s);
    outlineText(ctx, '感谢游玩！', 0, 0, 76, '#ffd84a', '#1b1010', 12, 'center', 900);
    ctx.restore();
    outlineText(ctx, '大团子王也被请来一起喝茶啦～', W / 2, 240, 28, '#ffffff', '#1b1010', 7, 'center', 700);
    outlineText(ctx, `最终得分 ${this.score}`, W / 2, 292, 26, '#ffd84a', '#1b1010', 6, 'center', 800);
    if (this.modeT > 3 && Math.floor(this.modeT * 2) % 2 === 0) outlineText(ctx, '按 A 返回标题', W / 2, 690, 24, '#ffffff', '#1b1010', 6, 'center', 700);
  }
}

const NO_PRESS = new Proxy({}, { get: () => false });

// 茶室大乱斗：原创 2D 平台格斗（灵感来自主机上的派对格斗游戏，角色、招式、场地、音乐全部原创）
// 百分比伤害越高飞得越远，打出场外扣一条命；每人 3 条命，留到最后的赢。
import { GameBase, drawTitleCard, drawResult, controlsBar } from './common.js';
import { W, H, clamp, text, outlineText, fillRR, strokeRR, rrect, makeCanvas, easeOutBack, easeOutCubic, Nav, mulberry32 } from '../ui.js';
import { parseTrack } from '../audio.js';
import { STEP, CHARS, STAGES, DIFFS, STAT_NAMES, PLAYER_COLORS, specialNames } from './brawl/data.js';
import { Match } from './brawl/world.js';
import {
  drawFighter, drawCharStatic, drawItem, drawProj, drawMine, drawSaucer, makeBackdrop, makeStageArt, drawPlatform, star, BACK_W, BACK_H,
} from './brawl/art.js';

const ORANGE = '#ff7a1a';

// ———————————————— 原创配乐 ————————————————
const T = (s) => parseTrack(s.replace(/\|/g, ' '));
const rep = (s, n) => Array(n).fill(s).join(' ');
const bar = (r, f, o) => `${r}:2 ${f}:2 ${o}:2 ${f}:2 ${r}:2 ${f}:2 ${o}:2 ${f}:2`;
const CH = {
  Am: ['A2', 'E3', 'A3'], F: ['F2', 'C3', 'F3'], G: ['G2', 'D3', 'G3'], Em: ['E2', 'B2', 'E3'], E: ['E2', 'B2', 'E3'],
  Dm: ['D3', 'A3', 'D4'], Bb: ['Bb2', 'F3', 'Bb3'], C: ['C3', 'G3', 'C4'],
};
const bass = (list) => list.map((k) => bar(...CH[k])).join(' ');

const SONG_BATTLE = {
  bpm: 168,
  tracks: [
    {
      wave: 'p25', vol: 0.12, notes: T(`
        A4:2 C5:2 E5:2 A5:4 G5:2 E5:2 D5:2 | E5:2 D5:2 C5:2 B4:2 A4:4 E4:4 |
        F4:2 A4:2 C5:2 F5:4 E5:2 C5:2 A4:2 | B4:2 D5:2 G5:4 F5:2 E5:2 D5:4 |
        A4:2 C5:2 E5:2 A5:4 B5:2 C6:2 B5:2 | A5:2 G5:2 E5:2 G5:2 A5:6 -:2 |
        F5:2 E5:2 D5:2 C5:2 D5:2 E5:2 F5:2 G5:2 | E5:4 B4:4 E5:4 G#5:4`),
    },
    { wave: 'triangle', vol: 0.24, gate: 0.7, notes: T(bass(['Am', 'Am', 'F', 'G', 'Am', 'Em', 'F', 'E'])) },
    { wave: 'noise', vol: 0.07, notes: T(rep('k:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2', 8)) },
  ],
};

const SONG_MENU = {
  bpm: 112,
  tracks: [
    {
      wave: 'triangle', vol: 0.16, notes: T(`
        F4:4 A4:2 C5:2 F5:4 E5:2 C5:2 | D5:4 C5:2 A4:2 C5:8 |
        Bb4:4 D5:2 F5:2 A5:4 G5:2 F5:2 | E5:4 G5:2 E5:2 C5:8 |
        F4:4 A4:2 C5:2 F5:4 G5:2 A5:2 | Bb5:4 A5:2 G5:2 F5:4 D5:4 |
        C5:2 D5:2 E5:2 F5:2 G5:4 E5:4 | F5:8 -:8`),
    },
    { wave: 'sine', vol: 0.22, gate: 0.6, notes: T(bass(['F', 'Dm', 'Bb', 'C', 'F', 'Bb', 'C', 'F'])) },
    { wave: 'noise', vol: 0.05, notes: T(rep('k:4 h:4 s:4 h:4', 8)) },
  ],
};

// ———————————————— 磁贴 ————————————————
function drawBrawlTile(c, s) {
  const k = s / 256;
  c.save();
  c.scale(k, k);
  const g = c.createRadialGradient(128, 110, 10, 128, 128, 190);
  g.addColorStop(0, '#ffcf6b');
  g.addColorStop(0.45, '#ff7a1a');
  g.addColorStop(1, '#7a1f2b');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  c.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 12; i++) {
    c.save();
    c.translate(128, 108);
    c.rotate((i * Math.PI) / 6);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(200, -16); c.lineTo(200, 16); c.closePath(); c.fill();
    c.restore();
  }
  c.fillStyle = 'rgba(40,10,10,0.35)';
  c.fillRect(0, 158, 256, 6);
  drawCharStatic(c, CHARS[0], CHARS[0].color, 82, 160, 0.95, 0, 1, 'charge');
  drawCharStatic(c, CHARS[1], CHARS[1].color, 184, 160, 0.82, 0, -1, 'idle');
  star(c, 132, 104, 20, '#ffffff');
  star(c, 132, 104, 10, '#fff2a8');
  outlineText(c, '茶室大乱斗', 128, 212, 40, '#ffffff', '#7a1f2b', 9);
  c.restore();
}

export class Brawl extends GameBase {
  static meta = { id: 'brawl', name: '茶室大乱斗', kind: 'game', color: ORANGE, tile: drawBrawlTile };

  constructor(os) {
    super(os);
    const saved = os.store.get('brawl.cfg', null);
    this.cfg = { char: 0, cpus: 1, diff: 1, stage: 0 };
    if (saved && typeof saved === 'object') {
      for (const k of Object.keys(this.cfg)) if (Number.isInteger(saved[k])) this.cfg[k] = saved[k];
      this.cfg.char = clamp(this.cfg.char, 0, CHARS.length - 1);
      this.cfg.cpus = clamp(this.cfg.cpus, 1, 3);
      this.cfg.diff = clamp(this.cfg.diff, 0, 2);
      this.cfg.stage = clamp(this.cfg.stage, 0, STAGES.length - 1);
    }
    this.row = 0;
    this.nav = new Nav(0.3, 0.12);
    this.match = null;
    this.acc = 0;
    this.art = {};
    this.press = {};
    this.rel = {};
    this.heldPad = { down: null, pressed: {}, released: {}, lx: 0, ly: 0, rx: 0, ry: 0 };
    this.mergedPad = { down: null, pressed: {}, released: {}, lx: 0, ly: 0, rx: 0, ry: 0 };
    this.result = null;
    this.rng = mulberry32((Date.now() & 0xffff) + 7);
    this.setMode('title');
    this.sfx.music.play(SONG_MENU, this);
  }

  close() { this.sfx.music.stop(); }

  stageArt(i) {
    if (!this.art[i]) {
      const S = STAGES[i];
      this.art[i] = { back: makeBackdrop(S), stage: makeStageArt(S) };
    }
    return this.art[i];
  }

  // ———————————————— 声音 ————————————————
  sound(name) {
    const s = this.sfx;
    switch (name) {
      case 'jump': s.play('jump'); break;
      case 'djump': s.tone('sine', 520, 980, 0.1, 0.09); break;
      case 'dodge': s.noise(0.09, 0.14, 'bandpass', 2600, 900, 0, 1.4); break;
      case 'whoosh': case 'swing': s.noise(0.07, 0.1, 'bandpass', 2000, 700, 0, 1.6); break;
      case 'swingBig': case 'smash': s.noise(0.14, 0.18, 'bandpass', 1400, 400, 0, 1.4); break;
      case 'tap': s.noise(0.03, 0.12, 'highpass', 3000); break;
      case 'hitLight': s.noise(0.05, 0.22, 'highpass', 2200); s.tone('square', 620, 320, 0.05, 0.05); break;
      case 'hitMid': s.noise(0.1, 0.34, 'lowpass', 3200, 500); s.tone('square', 340, 120, 0.09, 0.09); break;
      case 'hitHeavy':
        s.noise(0.28, 0.55, 'lowpass', 2800, 120);
        s.tone('sawtooth', 240, 50, 0.3, 0.14);
        s.tone('sine', 110, 38, 0.36, 0.32);
        break;
      case 'shieldHit': s.tone('triangle', 980, 760, 0.07, 0.12); break;
      case 'shieldBreak': [880, 660, 494, 370].forEach((f, i) => s.tone('square', f, f * 0.9, 0.12, 0.08, i * 0.07)); break;
      case 'grab': s.tone('square', 320, 220, 0.06, 0.08); break;
      case 'poof': s.noise(0.18, 0.2, 'bandpass', 1400, 4200, 0, 1.2); break;
      case 'pound': s.play('explode', {}); break;
      case 'steam': s.noise(0.45, 0.1, 'highpass', 3200); break;
      case 'thud': s.tone('sine', 150, 60, 0.12, 0.26); break;
      case 'ledge': s.tone('triangle', 420, 520, 0.05, 0.08); break;
      case 'ko':
        s.noise(0.9, 0.5, 'lowpass', 3400, 80);
        s.tone('sawtooth', 900, 110, 0.6, 0.1);
        s.tone('sine', 120, 40, 0.7, 0.3);
        break;
      case 'respawn': [523, 659, 784].forEach((f, i) => s.tone('triangle', f, f, 0.1, 0.1, i * 0.06)); break;
      case 'count': s.tone('square', 660, 660, 0.14, 0.11); break;
      case 'go': [784, 1046].forEach((f, i) => s.tone('square', f, f, 0.18, 0.11, i * 0.09)); s.noise(0.3, 0.2, 'highpass', 2000, 0, 0.12); break;
      case 'game': [523, 659, 784, 1046].forEach((f, i) => s.tone('square', f, f, 0.5 - i * 0.05, 0.08, i * 0.05)); break;
      case 'throw': s.tone('triangle', 640, 1100, 0.07, 0.1); break;
      case 'star': s.tone('square', 1600, 900, 0.04, 0.05); break;
      case 'boom': s.play('explode', {}); break;
      case 'shatter': s.noise(0.2, 0.25, 'highpass', 4000); s.tone('triangle', 2400, 1800, 0.08, 0.08); break;
      case 'pick': s.tone('sine', 700, 1050, 0.07, 0.12); break;
      case 'heal': s.play('powerup'); break;
      case 'mine': s.tone('square', 220, 330, 0.06, 0.08); break;
      case 'counter': s.tone('sawtooth', 1400, 300, 0.14, 0.1); s.noise(0.12, 0.25, 'bandpass', 2400, 600); break;
      default: break;
    }
  }

  // ———————————————— 流程 ————————————————
  start() {
    const cfg = this.cfg;
    const pool = [0, 1, 2, 3].filter((i) => i !== cfg.char);
    const cpuChars = [];
    for (let i = 0; i < cfg.cpus; i++) {
      if (!pool.length) pool.push(0, 1, 2, 3);
      cpuChars.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
    }
    this.match = new Match(this, { ...cfg, cpuChars, seed: Math.floor(this.rng() * 1e6), rng: this.rng });
    this.stageArt(cfg.stage);
    this.acc = 0;
    this.result = null;
    this.os.store.set('brawl.cfg', cfg);
    this.setMode('play');
    this.sfx.music.play(SONG_BATTLE, this);
  }

  finish() {
    const m = this.match, p = m.player;
    const won = p.place === 1;
    const d = DIFFS[this.cfg.diff];
    const time = m.frame / 60;
    let score = 0;
    if (won) score = Math.round((p.stocks * 1000 + p.kos * 400 + Math.max(0, 240 - time) * 4) * d.mult * (1 + 0.35 * (this.cfg.cpus - 1)));
    else score = Math.round(p.kos * 200 * d.mult);
    this.submitScore(score);
    this.result = { won, place: p.place || 1, kos: p.kos, dmg: Math.round(p.dmgDone), time, score, falls: p.falls };
    this.sfx.music.stop();
    this.sfx.play(won ? 'win' : 'gameover');
    this.setMode('result');
  }

  update(dt, pad) {
    this.t += dt;
    this.modeT += dt;
    if (this.mode === 'title') {
      if (pad.pressed.A || pad.pressed.X) { this.sfx.play('confirm'); this.row = 0; this.nav.suppress = true; this.setMode('select'); }
      return;
    }
    if (this.mode === 'select') { this.updateSelect(dt, pad); return; }
    if (this.mode === 'result') {
      if (this.modeT > 0.8 && pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      else if (this.modeT > 0.8 && pad.pressed.B) { this.sfx.play('back'); this.toTitle(); }
      return;
    }
    // 对战：固定 60 帧步长；按下的键先攒着，保证每次“按下”都会被某一步读到
    const m = this.match;
    for (const k in pad.pressed) if (pad.pressed[k]) this.press[k] = true;
    for (const k in pad.released) if (pad.released[k]) this.rel[k] = true;
    let scale = 1;
    if (m.phase === 'end' && (m.phaseT2 || 0) < 70) scale = 0.35;
    this.acc += dt * scale;
    let n = 0;
    while (this.acc >= STEP && n < 4) {
      const p = n === 0 ? this.merge(pad) : this.held(pad);
      m.step(p);
      this.acc -= STEP;
      n++;
    }
    if (n === 4) this.acc = 0;
    if (m.phase === 'end' && (m.phaseT2 || 0) > 160) this.finish();
  }

  merge(pad) {
    const o = this.mergedPad;
    o.down = pad.down;
    for (const k in pad.pressed) o.pressed[k] = !!this.press[k];
    for (const k in pad.released) o.released[k] = !!this.rel[k];
    o.lx = pad.lx; o.ly = pad.ly; o.rx = pad.rx; o.ry = pad.ry;
    this.press = {};
    this.rel = {};
    return o;
  }

  held(pad) {
    const o = this.heldPad;
    o.down = pad.down;
    for (const k in pad.pressed) { o.pressed[k] = false; o.released[k] = false; }
    o.lx = pad.lx; o.ly = pad.ly; o.rx = pad.rx; o.ry = pad.ry;
    return o;
  }

  toTitle() {
    this.match = null;
    this.setMode('title');
    this.sfx.music.play(SONG_MENU, this);
  }

  updateSelect(dt, pad) {
    const d = this.nav.update(dt, pad);
    const cfg = this.cfg;
    if (d === 'up' && this.row > 0) { this.row--; this.sfx.play('tick'); }
    if (d === 'down' && this.row < 4) { this.row++; this.sfx.play('tick'); }
    if (d === 'left' || d === 'right') {
      const s = d === 'left' ? -1 : 1;
      const before = JSON.stringify(cfg);
      if (this.row === 0) cfg.char = (cfg.char + s + CHARS.length) % CHARS.length;
      else if (this.row === 1) cfg.cpus = clamp(cfg.cpus + s, 1, 3);
      else if (this.row === 2) cfg.diff = clamp(cfg.diff + s, 0, 2);
      else if (this.row === 3) cfg.stage = (cfg.stage + s + STAGES.length) % STAGES.length;
      if (JSON.stringify(cfg) !== before) this.sfx.play('move');
    }
    if (pad.pressed.A) { this.sfx.play('launch'); this.start(); return; }
    if (pad.pressed.B) { this.sfx.play('back'); this.setMode('title'); }
  }

  tap(x, y) {
    if (this.mode === 'title') { this.sfx.play('confirm'); this.row = 0; this.setMode('select'); return true; }
    if (this.mode === 'result') { if (this.modeT > 0.8) { this.sfx.play('confirm'); this.start(); } return true; }
    if (this.mode !== 'select') return false;
    for (let i = 0; i < CHARS.length; i++) {
      const cx = 130 + i * 260;
      if (x >= cx && x <= cx + 240 && y >= 80 && y <= 370) {
        if (this.cfg.char === i && this.row === 0) { this.sfx.play('launch'); this.start(); return true; }
        this.cfg.char = i;
        this.row = 0;
        this.sfx.play('move');
        return true;
      }
    }
    const rows = this.optionRects();
    for (const r of rows) {
      if (y < r.y || y > r.y + r.h || x < r.x || x > r.x + r.w) continue;
      this.row = r.row;
      if (r.row === 4) { this.sfx.play('launch'); this.start(); return true; }
      const s = x < r.x + r.w / 2 ? -1 : 1;
      const cfg = this.cfg;
      if (r.row === 1) cfg.cpus = clamp(cfg.cpus + s, 1, 3);
      if (r.row === 2) cfg.diff = clamp(cfg.diff + s, 0, 2);
      if (r.row === 3) cfg.stage = (cfg.stage + s + STAGES.length) % STAGES.length;
      this.sfx.play('move');
      return true;
    }
    return true;
  }

  optionRects() {
    return [
      { row: 1, x: 70, y: 552, w: 300, h: 64 },
      { row: 2, x: 390, y: 552, w: 300, h: 64 },
      { row: 3, x: 710, y: 552, w: 300, h: 64 },
      { row: 4, x: 1030, y: 548, w: 190, h: 72 },
    ];
  }

  // ———————————————— 绘制 ————————————————
  draw(c) {
    if (this.mode === 'title') { this.drawTitle(c); return; }
    if (this.mode === 'select') { this.drawSelect(c); return; }
    if (this.match) this.drawMatch(c);
    if (this.mode === 'result' && this.result) this.drawResultCard(c);
  }

  drawBackdrop(c, art, camX, camY) {
    const ox = clamp(-(BACK_W - W) / 2 - camX * 0.08, W - BACK_W, 0);
    const oy = clamp(-(BACK_H - H) / 2 - (camY + 170) * 0.04, H - BACK_H, 0);
    c.drawImage(art.back.img, Math.round(ox), Math.round(oy));   // 整数像素对齐：不用插值，画得更快
  }

  // 头像缓存：HUD 和场外提示每帧都要画，画成小图后只需 drawImage
  portrait(f) {
    if (f._portrait) return f._portrait;
    const cv = makeCanvas(136, 136);
    const c = cv.getContext('2d');
    c.scale(2, 2);
    c.beginPath(); c.arc(34, 34, 34, 0, Math.PI * 2);
    c.fillStyle = f.color; c.fill();
    c.beginPath(); c.arc(34, 34, 30, 0, Math.PI * 2);
    c.fillStyle = '#fff6ea'; c.fill();
    c.clip();
    drawCharStatic(c, f.ch, f.tint, 34, 66, 0.62, 0);
    f._portrait = cv;
    return cv;
  }

  drawTitle(c) {
    const art = this.stageArt(0);
    this.drawBackdrop(c, art, Math.sin(this.t * 0.2) * 300, 0);
    const sa = art.stage;
    c.save();
    c.translate(W / 2, 560);
    c.scale(0.62, 0.62);
    c.drawImage(sa.cv, sa.x, sa.y, sa.w, sa.h);
    const poses = ['idle', 'charge', 'idle', 'idle'];
    CHARS.forEach((ch, i) => {
      const x = -330 + i * 220;
      drawCharStatic(c, ch, ch.color, x, 0, 1.25, this.t * 60 + i * 20, i < 2 ? 1 : -1, poses[i]);
    });
    c.restore();
    drawTitleCard(c, {
      t: this.modeT, title: '茶室大乱斗', subtitle: '原创平台格斗 · 把对手打出场外！', best: this.best, stroke: '#7a1f2b',
      titleY: 170, promptY: 330, fill: '#ffe2b8',
      controls: [['STICK', '移动'], ['A', '攻击'], ['Y', '蓄力重击'], ['B', '必杀技'], ['X', '跳跃'], ['ZR', '防御 / 闪避']],
    });
  }

  drawSelect(c) {
    const cfg = this.cfg, t = this.t;
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#2b1a33');
    g.addColorStop(1, '#5a2027');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = -4; i < 20; i++) {
      const x = i * 90 + ((t * 30) % 90);
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 40, 0); c.lineTo(x - 200, H); c.lineTo(x - 240, H); c.closePath(); c.fill();
    }
    outlineText(c, '选择角色', 70, 44, 34, '#ffffff', '#7a1f2b', 7, 'left');
    text(c, '左右选角色 · 上下切换选项 · A 开战', W - 60, 44, 18, 'rgba(255,255,255,0.7)', 'right', 600);
    // 角色卡
    CHARS.forEach((ch, i) => {
      const sel = cfg.char === i;
      const x = 130 + i * 260, y = 80 - (sel ? 10 : 0), w = 240, h = 290;
      const cg = c.createLinearGradient(0, y, 0, y + h);
      cg.addColorStop(0, sel ? '#ffe9c8' : '#3d2a40');
      cg.addColorStop(1, sel ? '#ffb36b' : '#2a1d2d');
      fillRR(c, x, y, w, h, 18, cg);
      if (sel) {
        strokeRR(c, x - 4, y - 4, w + 8, h + 8, 22, PLAYER_COLORS[0], this.row === 0 ? 5 : 3);
        fillRR(c, x + 12, y + 12, 48, 28, 14, PLAYER_COLORS[0]);
        text(c, '1P', x + 36, y + 27, 18, '#fff', 'center', 800);
      }
      c.save();
      c.beginPath();
      c.rect(x, y, w, h);
      c.clip();
      c.fillStyle = sel ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.06)';
      c.beginPath(); c.ellipse(x + w / 2, y + 222, 80, 16, 0, 0, Math.PI * 2); c.fill();
      drawCharStatic(c, ch, ch.color, x + w / 2, y + 222, sel ? 1.65 : 1.45, t * 60 + i * 13, 1, sel && Math.floor(t * 0.7) % 3 === 2 ? 'charge' : 'idle');
      c.restore();
      text(c, ch.name, x + w / 2, y + 250, 28, sel ? '#5a2027' : '#ffffff', 'center', 900);
      text(c, ch.title, x + w / 2, y + 276, 17, sel ? '#8a4a2a' : 'rgba(255,255,255,0.6)', 'center', 600);
    });
    // 角色说明
    const ch = CHARS[cfg.char];
    fillRR(c, 70, 392, W - 140, 140, 18, 'rgba(0,0,0,0.32)');
    text(c, ch.desc, 100, 424, 20, '#ffe2b8', 'left', 600);
    ch.stats.forEach((v, i) => {
      const x = 100 + i * 150, y = 466;
      text(c, STAT_NAMES[i], x, y, 17, 'rgba(255,255,255,0.75)', 'left', 600);
      for (let k = 0; k < 5; k++) fillRR(c, x + 44 + k * 18, y - 7, 14, 14, 4, k < v ? ORANGE : 'rgba(255,255,255,0.15)');
    });
    specialNames(ch).forEach(([k, name], i) => {
      const x = 100 + (i % 4) * 270, y = 506;
      fillRR(c, x, y - 15, 44, 30, 15, 'rgba(255,255,255,0.14)');
      text(c, k, x + 22, y + 1, 16, '#fff', 'center', 800);
      text(c, name, x + 54, y + 1, 18, '#ffffff', 'left', 600);
    });
    // 选项
    const opts = [
      ['对手数量', `${cfg.cpus} 名 CPU`],
      ['CPU 难度', DIFFS[cfg.diff].name],
      ['场地', STAGES[cfg.stage].name],
    ];
    const rects = this.optionRects();
    const art = this.stageArt(cfg.stage);
    opts.forEach(([label, value], i) => {
      const r = rects[i], sel = this.row === i + 1;
      fillRR(c, r.x, r.y, r.w, r.h, 16, sel ? '#ffffff' : 'rgba(255,255,255,0.12)');
      if (i === 2) {
        // 场地选项的背景是场地缩略图
        c.save();
        rrect(c, r.x + 4, r.y + 4, r.w - 8, r.h - 8, 13);
        c.clip();
        c.globalAlpha = sel ? 0.35 : 0.55;
        c.drawImage(art.back.far, r.x, r.y - 60, r.w, (r.w * 9) / 16);
        c.restore();
      }
      text(c, label, r.x + 18, r.y + 20, 15, sel ? '#a0522d' : 'rgba(255,255,255,0.65)', 'left', 700);
      text(c, value, r.x + r.w / 2, r.y + 44, 22, sel ? '#3a1d22' : '#ffffff', 'center', 800);
      c.fillStyle = sel ? ORANGE : 'rgba(255,255,255,0.4)';
      for (const [ax, s] of [[r.x + 22, -1], [r.x + r.w - 22, 1]]) {
        c.beginPath(); c.moveTo(ax + s * 8, r.y + 44); c.lineTo(ax - s * 6, r.y + 35); c.lineTo(ax - s * 6, r.y + 53); c.closePath(); c.fill();
      }
    });
    const go = rects[3], gsel = this.row === 4;
    const pulse = 1 + Math.sin(t * 5) * 0.03;
    c.save();
    c.translate(go.x + go.w / 2, go.y + go.h / 2);
    c.scale(pulse, pulse);
    fillRR(c, -go.w / 2, -go.h / 2, go.w, go.h, 22, gsel ? '#ffffff' : ORANGE);
    text(c, '开战！', 0, 2, 32, gsel ? ORANGE : '#ffffff', 'center', 900);
    c.restore();
    controlsBar(c, [['DPAD', '选择'], ['A', '开战'], ['B', '返回']], 676);
  }

  drawMatch(c) {
    const m = this.match, art = this.stageArt(m.cfg.stage), cam = m.cam;
    this.drawBackdrop(c, art, cam.x, cam.y);
    c.save();
    c.translate(640 + m.shakeX, 330 + m.shakeY);
    c.scale(cam.z, cam.z);
    c.translate(-cam.x, -cam.y);
    const sa = art.stage;
    c.drawImage(sa.cv, sa.x, sa.y, sa.w, sa.h);
    for (const p of m.stage.plats) drawPlatform(c, p, m.stage.def, m.frame);
    for (const it of m.items) drawItem(c, it);
    for (const mi of m.mines) drawMine(c, mi);
    for (const f of m.fighters) if (f.alive && f.state === 'respawn') drawSaucer(c, f.x, f.y, m.frame);
    for (let i = m.fighters.length - 1; i >= 0; i--) drawFighter(c, m.fighters[i]);
    for (const p of m.projs) drawProj(c, p);
    m.fx.drawWorld(c);
    c.restore();
    m.fx.drawScreen(c);
    this.drawOffscreen(c, m);
    this.drawHud(c, m);
    if (this.mode === 'play') this.drawBanner(c, m);
  }

  drawOffscreen(c, m) {
    for (const f of m.fighters) {
      if (!f.alive) continue;
      const [sx, sy] = m.toScreen(f.x, f.cy);
      if (sx > 10 && sx < W - 10 && sy > 10 && sy < 590) continue;
      const x = clamp(sx, 44, W - 44), y = clamp(sy, 44, 560);
      const a = Math.atan2(sy - y, sx - x);
      c.save();
      c.translate(x, y);
      c.fillStyle = f.color;
      c.beginPath(); c.moveTo(Math.cos(a) * 42, Math.sin(a) * 42); c.lineTo(Math.cos(a + 0.5) * 30, Math.sin(a + 0.5) * 30); c.lineTo(Math.cos(a - 0.5) * 30, Math.sin(a - 0.5) * 30); c.closePath(); c.fill();
      c.drawImage(this.portrait(f), -30, -30, 60, 60);
      c.restore();
    }
  }

  drawHud(c, m) {
    const F = m.fighters, n = F.length, cw = 232, gap = 18;
    const x0 = W / 2 - (n * cw + (n - 1) * gap) / 2;
    F.forEach((f, i) => {
      const x = x0 + i * (cw + gap), y = 612;
      const outGame = f.stocks <= 0 && !f.alive;
      c.save();
      if (outGame) c.globalAlpha = 0.45;
      fillRR(c, x, y, cw, 92, 18, 'rgba(10,8,16,0.62)');
      fillRR(c, x, y, 8, 92, 4, f.color);
      c.drawImage(this.portrait(f), x + 18, y + 12, 68, 68);
      text(c, `${f.tag} · ${f.ch.name}`, x + 96, y + 20, 15, 'rgba(255,255,255,0.75)', 'left', 700);
      // 百分比：越高越红，挨打时跳一下
      const p = Math.round(f.dispPct);
      const k = clamp(f.percent / 150, 0, 1);
      const col = `rgb(255,${Math.round(255 - 150 * k)},${Math.round(255 - 230 * Math.min(1, k * 1.6))})`;
      const sc = 1 + f.pctPulse * 0.35;
      const jx = f.pctPulse > 0.5 ? (Math.random() - 0.5) * 6 : 0;
      c.save();
      c.translate(x + 96 + jx, y + 56);
      c.scale(sc, sc);
      outlineText(c, outGame ? '出局' : `${p}%`, 0, 0, outGame ? 32 : 40, outGame ? '#bbbbbb' : col, 'rgba(0,0,0,0.75)', 6, 'left', 900);
      c.restore();
      for (let s = 0; s < 3; s++) {
        c.fillStyle = s < f.stocks ? f.color : 'rgba(255,255,255,0.15)';
        c.beginPath(); c.arc(x + 104 + s * 20, y + 80, 6.5, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    });
  }

  drawBanner(c, m) {
    if (m.phase === 'ready') {
      const n = 3 - Math.floor(m.phaseT / 50);
      const k = (m.phaseT % 50) / 50;
      const s = easeOutBack(Math.min(1, k * 2.5)) * (1 - Math.max(0, k - 0.8) * 2);
      c.save();
      c.translate(W / 2, 300);
      c.scale(s * 1.4, s * 1.4);
      outlineText(c, String(Math.max(1, n)), 0, 0, 120, '#ffffff', '#7a1f2b', 14);
      c.restore();
    } else if (m.phase === 'fight' && m.phaseT < 55) {
      const k = m.phaseT / 55;
      const s = easeOutBack(Math.min(1, k * 3)) * (k > 0.75 ? 1 - (k - 0.75) * 4 : 1);
      c.save();
      c.translate(W / 2, 300);
      c.scale(s * 1.3, s * 1.3);
      outlineText(c, '开战！', 0, 0, 110, '#ffd34a', '#7a1f2b', 14);
      c.restore();
    } else if (m.phase === 'end') {
      const k = Math.min(1, (m.phaseT2 || 0) / 25);
      c.save();
      c.globalAlpha = Math.min(1, k * 1.5);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(0, 230, W, 150);
      c.translate(W / 2 + (1 - easeOutCubic(k)) * 600, 305);
      outlineText(c, '胜负已分！', 0, 0, 100, '#ffffff', '#c0392b', 14);
      c.restore();
    }
  }

  drawResultCard(c) {
    const r = this.result;
    const order = ['', '第 1 名', '第 2 名', '第 3 名', '第 4 名'];
    const mm = Math.floor(r.time / 60), ss = Math.floor(r.time % 60);
    drawResult(c, {
      t: this.modeT, title: r.won ? '胜利！' : '惜败…', color: r.won ? '#ff7a1a' : '#5a6b8c', newBest: this.newBest,
      lines: [['名次', order[r.place] || `第 ${r.place} 名`], ['击倒 / 被击倒', `${r.kos} / ${r.falls}`], ['造成伤害', `${r.dmg}%`], ['用时', `${mm}:${String(ss).padStart(2, '0')}`], ['得分', r.score]],
      hints: [['A', '再来一局'], ['B', '标题画面']],
    });
  }
}

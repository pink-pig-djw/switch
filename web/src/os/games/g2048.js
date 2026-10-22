// 2048：合并方块，带滑动 / 合并 / 出现动画，Y 撤销一步
import { GameBase, drawResult, drawTitleCard, controlsBar, promptLine } from './common.js';
import { W, H, clamp, lerp, text, textW, fillRR, strokeRR, EdgeDir, outlineText, easeOutCubic, easeOutBack } from '../ui.js';

const N = 4, CELL = 124, GAP = 14;
const BOARD = N * CELL + (N + 1) * GAP; // 566
const BX = (W - BOARD) / 2, BY = 112;
const SLIDE = 0.1, POP = 0.16;

const COLORS = {
  2: ['#fbf4e8', '#6b5646'], 4: ['#f6e5c6', '#6b5646'], 8: ['#ffc98a', '#ffffff'], 16: ['#ffad66', '#ffffff'],
  32: ['#ff8f52', '#ffffff'], 64: ['#ff6d3f', '#ffffff'], 128: ['#f4d06f', '#ffffff'], 256: ['#efc350', '#ffffff'],
  512: ['#e6b030', '#ffffff'], 1024: ['#8fcf7f', '#ffffff'], 2048: ['#3fae6a', '#ffffff'],
};
const colorOf = (v) => COLORS[v] || ['#2f6f75', '#ffffff'];

function drawTile2048(c, s) {
  const k = s / 256;
  c.save();
  c.scale(k, k);
  c.fillStyle = '#f7efe3';
  c.fillRect(0, 0, 256, 256);
  fillRR(c, 22, 22, 212, 212, 16, '#c9b49b');
  const vals = [[2, 4, 8, 16], [32, 64, 128, 256], [512, 1024, 2048, 4], [8, 2, 16, 32]];
  for (let r = 0; r < 4; r++) for (let cc = 0; cc < 4; cc++) {
    const v = vals[r][cc];
    const [bg, fg] = colorOf(v);
    const x = 30 + cc * 50, y = 30 + r * 50;
    fillRR(c, x, y, 44, 44, 6, bg);
    text(c, String(v), x + 22, y + 23, v >= 1000 ? 13 : v >= 100 ? 16 : 20, fg, 'center', 800);
  }
  c.fillStyle = 'rgba(247,239,227,0.82)';
  c.fillRect(0, 150, 256, 106);
  outlineText(c, '2048', 128, 200, 64, '#ff7a1a', '#ffffff', 10);
  c.restore();
}

let nextId = 1;

export class Game2048 extends GameBase {
  static meta = { id: '2048', name: '2048', kind: 'game', color: '#ff8f52', tile: drawTile2048 };

  constructor(os) {
    super(os);
    this.edge = new EdgeDir();
    this.start();
    this.setMode('title');
  }

  start() {
    this.grid = Array.from({ length: N }, () => new Array(N).fill(null));
    this.ghosts = [];
    this.score = 0;
    this.undo = null;
    this.won = false;
    this.keepGoing = false;
    this.animT = 10;
    this.addScore = [];
    this.spawn(true);
    this.spawn(true);
    this.setMode('play');
  }

  spawn(instant) {
    const empty = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!this.grid[r][c]) empty.push([r, c]);
    if (!empty.length) return;
    const [r, c] = empty[(Math.random() * empty.length) | 0];
    this.grid[r][c] = { id: nextId++, v: Math.random() < 0.9 ? 2 : 4, r, c, fr: r, fc: c, born: instant ? -1 : this.t + SLIDE, merged: false };
  }

  snapshot() {
    return { cells: this.grid.map((row) => row.map((t) => (t ? t.v : 0))), score: this.score };
  }

  restore(s) {
    this.grid = s.cells.map((row, r) => row.map((v, c) => (v ? { id: nextId++, v, r, c, fr: r, fc: c, born: this.t, merged: false } : null)));
    this.score = s.score;
    this.ghosts = [];
  }

  move(dir) {
    const vec = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir];
    const before = this.snapshot();
    const order = [0, 1, 2, 3];
    const rows = vec[0] === 1 ? [...order].reverse() : order;
    const cols = vec[1] === 1 ? [...order].reverse() : order;
    let moved = false, gained = 0, maxMerge = 0;
    const mergedHere = new Set();
    this.ghosts = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const t = this.grid[r][c];
      if (t) { t.fr = r; t.fc = c; t.merged = false; }
    }
    for (const r of rows) for (const c of cols) {
      const t = this.grid[r][c];
      if (!t) continue;
      let nr = r, nc = c;
      while (true) {
        const tr = nr + vec[0], tc = nc + vec[1];
        if (tr < 0 || tr >= N || tc < 0 || tc >= N) break;
        const o = this.grid[tr][tc];
        if (!o) { nr = tr; nc = tc; continue; }
        if (o.v === t.v && !mergedHere.has(tr * N + tc)) {
          // 合并
          this.grid[r][c] = null;
          const nt = { id: nextId++, v: t.v * 2, r: tr, c: tc, fr: tr, fc: tc, born: this.t + SLIDE, merged: true };
          this.ghosts.push({ v: t.v, fr: r, fc: c, r: tr, c: tc }, { v: o.v, fr: o.fr, fc: o.fc, r: tr, c: tc });
          this.grid[tr][tc] = nt;
          mergedHere.add(tr * N + tc);
          gained += nt.v;
          maxMerge = Math.max(maxMerge, nt.v);
          moved = true;
          nr = -1;
        }
        break;
      }
      if (nr === -1) continue;
      if (nr !== r || nc !== c) {
        this.grid[r][c] = null;
        this.grid[nr][nc] = t;
        t.r = nr;
        t.c = nc;
        moved = true;
      }
    }
    if (!moved) return false;
    this.undo = before;
    this.score += gained;
    if (gained) {
      this.addScore.push({ v: gained, t: 0 });
      this.sfx.play('merge', { f: 300 + Math.log2(maxMerge) * 60 });
    } else this.sfx.play('slide');
    this.animT = 0;
    this.spawn(false);
    if (maxMerge >= 2048 && !this.won) {
      this.won = true;
      this.sfx.play('win');
      this.submitScore(this.score);
      this.setMode('win');
    } else if (!this.canMove()) {
      this.submitScore(this.score);
      this.sfx.play('gameover');
      this.setMode('over');
    }
    return true;
  }

  canMove() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const t = this.grid[r][c];
      if (!t) return true;
      if (c + 1 < N && this.grid[r][c + 1] && this.grid[r][c + 1].v === t.v) return true;
      if (r + 1 < N && this.grid[r + 1][c] && this.grid[r + 1][c].v === t.v) return true;
    }
    return false;
  }

  update(dt, pad) {
    this.t += dt;
    this.modeT += dt;
    this.animT += dt;
    for (const a of this.addScore) a.t += dt;
    this.addScore = this.addScore.filter((a) => a.t < 0.8);
    if (this.mode === 'title') {
      if (pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      return;
    }
    if (this.mode === 'win') {
      if (this.modeT > 0.6 && pad.pressed.A) { this.keepGoing = true; this.setMode('play'); this.sfx.play('confirm'); }
      else if (this.modeT > 0.6 && pad.pressed.X) { this.sfx.play('confirm'); this.start(); }
      return;
    }
    if (this.mode === 'over') {
      if (this.modeT > 0.6 && pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      else if (this.modeT > 0.6 && pad.pressed.Y && this.undo) { this.restore(this.undo); this.undo = null; this.setMode('play'); this.sfx.play('back'); }
      return;
    }
    const d = this.edge.update(pad);
    if (d) this.move(d);
    if (pad.pressed.Y && this.undo) {
      this.restore(this.undo);
      this.undo = null;
      this.sfx.play('back');
    }
    if (pad.pressed.X) {
      this.sfx.play('confirm');
      this.submitScore(this.score);
      this.start();
    }
  }

  cellXY(r, c) {
    return [BX + GAP + c * (CELL + GAP), BY + GAP + r * (CELL + GAP)];
  }

  drawTile(c, v, x, y, s) {
    const [bg, fg] = colorOf(v);
    const w = CELL * s;
    const ox = x + (CELL - w) / 2, oy = y + (CELL - w) / 2;
    if (v >= 2048) {
      c.fillStyle = 'rgba(63,174,106,0.35)';
      fillRR(c, ox - 6, oy - 6, w + 12, w + 12, 14, 'rgba(63,174,106,0.3)');
    }
    fillRR(c, ox, oy + 4 * s, w, w, 10 * s, 'rgba(0,0,0,0.08)');
    fillRR(c, ox, oy, w, w, 10 * s, bg);
    const str = String(v);
    const size = (str.length >= 4 ? 42 : str.length === 3 ? 50 : 60) * s;
    text(c, str, ox + w / 2, oy + w / 2 + 3 * s, size, fg, 'center', 800);
  }

  draw(c) {
    c.fillStyle = '#f7efe3';
    c.fillRect(0, 0, W, H);
    // 背景点缀
    c.fillStyle = 'rgba(255,170,90,0.08)';
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.arc((i * 173 + 60) % W, (i * 97 + 80) % H, 40 + (i % 3) * 30, 0, Math.PI * 2);
      c.fill();
    }
    // 左栏
    outlineText(c, '2048', 180, 170, 76, '#ff7a1a', '#ffffff', 10);
    text(c, '合并相同的数字', 180, 238, 22, '#8a6f58', 'center', 600);
    text(c, '凑出 2048 吧！', 180, 270, 22, '#8a6f58', 'center', 600);
    const tips = [['DPAD', '滑动方块'], ['Y', '撤销一步'], ['X', '新游戏'], ['PLUS', '暂停']];
    tips.forEach(([g, l], i) => {
      const y = 360 + i * 54;
      promptLine(c, [{ g }, ' ' + l], 180, y, 22, '#6b5646', '#6b5646', '#fff');
    });
    // 右栏：分数
    const box = (x, y, label, val) => {
      fillRR(c, x, y, 220, 96, 14, '#c9b49b');
      text(c, label, x + 110, y + 28, 20, '#f7efe3', 'center', 700);
      text(c, String(val), x + 110, y + 64, 36, '#ffffff', 'center', 800);
    };
    box(990, 140, '得分', this.score);
    box(990, 256, '最高分', Math.max(this.best, this.score));
    for (const a of this.addScore) {
      c.globalAlpha = 1 - a.t / 0.8;
      text(c, `+${a.v}`, 1100, 122 - a.t * 40, 26, '#ff7a1a', 'center', 800);
    }
    c.globalAlpha = 1;
    let maxV = 0;
    for (let r = 0; r < N; r++) for (let cc = 0; cc < N; cc++) if (this.grid[r][cc]) maxV = Math.max(maxV, this.grid[r][cc].v);
    text(c, `当前最大方块：${maxV}`, 1100, 400, 20, '#8a6f58', 'center', 600);

    // 棋盘
    fillRR(c, BX, BY + 6, BOARD, BOARD, 18, 'rgba(0,0,0,0.08)');
    fillRR(c, BX, BY, BOARD, BOARD, 18, '#c9b49b');
    for (let r = 0; r < N; r++) for (let cc = 0; cc < N; cc++) {
      const [x, y] = this.cellXY(r, cc);
      fillRR(c, x, y, CELL, CELL, 10, '#dccab2');
    }
    const k = easeOutCubic(this.animT / SLIDE);
    if (this.animT < SLIDE) {
      for (const g of this.ghosts) {
        const [x0, y0] = this.cellXY(g.fr, g.fc), [x1, y1] = this.cellXY(g.r, g.c);
        this.drawTile(c, g.v, lerp(x0, x1, k), lerp(y0, y1, k), 1);
      }
    }
    for (let r = 0; r < N; r++) for (let cc = 0; cc < N; cc++) {
      const t = this.grid[r][cc];
      if (!t) continue;
      if (t.born > this.t) {
        if (t.merged) continue; // 合并结果在滑动结束后再出现
        continue;
      }
      const [x0, y0] = this.cellXY(t.fr, t.fc), [x1, y1] = this.cellXY(t.r, t.c);
      let s = 1;
      const age = this.t - t.born;
      if (t.born >= 0 && age < POP) s = t.merged ? 1 + 0.18 * Math.sin((age / POP) * Math.PI) : easeOutBack(age / POP);
      const x = this.animT < SLIDE && !t.merged ? lerp(x0, x1, k) : x1;
      const y = this.animT < SLIDE && !t.merged ? lerp(y0, y1, k) : y1;
      this.drawTile(c, t.v, x, y, s);
    }

    if (this.mode === 'title') {
      drawTitleCard(c, {
        t: this.modeT, title: '2048', subtitle: '滑动合并相同数字，凑出 2048', best: this.best,
        fill: '#ff7a1a', stroke: '#ffffff', titleY: 300, promptY: 470, subColor: '#5a4636', promptColor: '#5a4636', shade: false,
        controls: [['DPAD', '滑动'], ['Y', '撤销'], ['X', '新游戏'], ['PLUS', '暂停']],
      });
    } else if (this.mode === 'win') {
      drawResult(c, {
        t: this.modeT, title: '合成 2048！', color: '#3fae6a', newBest: this.newBest,
        lines: [['得分', this.score], ['最高分', this.best]],
        hints: [['A', '继续挑战'], ['X', '新游戏']],
      });
    } else if (this.mode === 'over') {
      drawResult(c, {
        t: this.modeT, title: '没有可以移动的方块了', color: '#ff7a1a', newBest: this.newBest,
        lines: [['得分', this.score], ['最高分', this.best]],
        hints: this.undo ? [['A', '再来一次'], ['Y', '撤销']] : [['A', '再来一次']],
      });
    }
  }
}

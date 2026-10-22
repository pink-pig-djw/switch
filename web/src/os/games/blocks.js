// 方块消除：七种四格方块下落消行（原创配色与外观）
import { GameBase, drawTitleCard, drawResult, Particles } from './common.js';
import { W, H, clamp, text, fillRR, strokeRR, rrect, outlineText, makeCanvas, easeOutBack, glyph } from '../ui.js';
import { drawLeaf } from '../icons.js';

const COLS = 10, ROWS = 22, HIDDEN = 2;
const CELL = 31;
const BX = Math.round((W - COLS * CELL) / 2), BY = 48;

const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};
// 原创配色（茶室暖色系）
const COLORS = {
  I: '#ff7a8a', O: '#8fd3c1', T: '#ffb347', S: '#6aa8ff', Z: '#c39bff', J: '#f2d16b', L: '#7bd389',
};
const TYPES = Object.keys(SHAPES);
const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1], [-2, 0], [2, 0], [0, -2]];
const LINE_SCORE = [0, 100, 300, 500, 800];

function rotateCW(m) {
  const n = m.length;
  return m.map((row, r) => row.map((_, c) => m[n - 1 - c][r]));
}
function rotateCCW(m) {
  const n = m.length;
  return m.map((row, r) => row.map((_, c) => m[c][n - 1 - r]));
}

function drawCell(c, x, y, s, color, alpha = 1) {
  c.globalAlpha = alpha;
  fillRR(c, x + 1, y + 1, s - 2, s - 2, s * 0.22, color);
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.fillRect(x + s * 0.2, y + s * 0.14, s * 0.6, s * 0.14);
  c.fillStyle = 'rgba(0,0,0,0.14)';
  c.fillRect(x + s * 0.2, y + s * 0.74, s * 0.6, s * 0.1);
  c.globalAlpha = 1;
}

function drawBlocksTile(c, s) {
  const k = s / 256;
  c.save();
  c.scale(k, k);
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#4a3328');
  g.addColorStop(1, '#241914');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  const cs = 28;
  const cells = [
    ['T', 2, 0], ['T', 3, 0], ['T', 4, 0], ['T', 3, 1],
    ['S', 5, 2], ['S', 6, 2], ['S', 4, 3], ['S', 5, 3],
    ['L', 1, 3], ['L', 1, 4], ['L', 1, 5], ['L', 2, 5],
    ['I', 3, 5], ['I', 4, 5], ['I', 5, 5], ['I', 6, 5],
    ['O', 7, 4], ['O', 8, 4], ['O', 7, 5], ['O', 8, 5],
    ['J', 0, 5], ['Z', 6, 4],
  ];
  for (const [t, x, y] of cells) drawCell(c, 2 + x * cs, 18 + y * cs, cs, COLORS[t]);
  outlineText(c, '方块消除', 128, 222, 42, '#ffffff', '#7a4a2a', 9);
  c.restore();
}

export class Blocks extends GameBase {
  static meta = { id: 'blocks', name: '方块消除', kind: 'game', color: '#ffb347', tile: drawBlocksTile };

  constructor(os) {
    super(os);
    this.parts = new Particles(400);
    this.bg = this._makeBg();
    this.resetGame();
    this.setMode('title');
  }

  _makeBg() {
    const cv = makeCanvas(W, H);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#3b2a22');
    g.addColorStop(1, '#1d1512');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      const x = (i * 211) % W, y = (i * 137) % H;
      c.globalAlpha = 0.07;
      drawLeaf(c, x, y, 26, i * 0.7, '#9be27a');
    }
    c.globalAlpha = 1;
    // 棋盘框
    fillRR(c, BX - 16, BY - 16, COLS * CELL + 32, (ROWS - HIDDEN) * CELL + 32, 18, '#8a5a3c');
    fillRR(c, BX - 8, BY - 8, COLS * CELL + 16, (ROWS - HIDDEN) * CELL + 16, 12, '#5a3a28');
    fillRR(c, BX, BY, COLS * CELL, (ROWS - HIDDEN) * CELL, 6, '#221a17');
    c.strokeStyle = 'rgba(255,255,255,0.045)';
    c.lineWidth = 1;
    for (let x = 1; x < COLS; x++) { c.beginPath(); c.moveTo(BX + x * CELL + 0.5, BY); c.lineTo(BX + x * CELL + 0.5, BY + (ROWS - HIDDEN) * CELL); c.stroke(); }
    for (let y = 1; y < ROWS - HIDDEN; y++) { c.beginPath(); c.moveTo(BX, BY + y * CELL + 0.5); c.lineTo(BX + COLS * CELL, BY + y * CELL + 0.5); c.stroke(); }
    // 侧边面板
    const panel = (x, y, w, h, title) => {
      fillRR(c, x, y, w, h, 16, 'rgba(255,240,225,0.08)');
      strokeRR(c, x, y, w, h, 16, 'rgba(255,220,190,0.18)', 2);
      text(c, title, x + w / 2, y + 26, 20, '#ffd9b8', 'center', 700);
    };
    panel(BX - 230, BY, 190, 170, '暂存');
    panel(BX + COLS * CELL + 40, BY, 190, 430, '下一个');
    panel(BX - 230, BY + 200, 190, 316, '');
    return cv;
  }

  resetGame() {
    this.grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    this.bag = [];
    this.queue = [];
    this.hold = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.piece = null;
    this.clearing = null;
    this.dropT = 0;
    this.lockT = 0;
    this.lockResets = 0;
    this.das = { dir: 0, t: 0 };
    this.lastClear = null;
    this.parts.clear();
    while (this.queue.length < 5) this.queue.push(this._fromBag());
  }

  start() {
    this.resetGame();
    this._spawn();
    this.setMode('play');
  }

  _fromBag() {
    if (!this.bag.length) {
      this.bag = [...TYPES];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }

  _spawn(type) {
    type = type || this.queue.shift();
    while (this.queue.length < 5) this.queue.push(this._fromBag());
    const m = SHAPES[type].map((r) => [...r]);
    const x = Math.floor((COLS - m.length) / 2);
    this.piece = { type, m, x, y: 1 };
    this.dropT = 0;
    this.lockT = 0;
    this.lockResets = 0;
    if (this._collide(m, x, 1)) {
      this.piece.y = 0;
      if (this._collide(m, x, 0)) this._gameOver();
    }
  }

  _collide(m, px, py) {
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) {
      if (!m[r][c]) continue;
      const x = px + c, y = py + r;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && this.grid[y][x]) return true;
    }
    return false;
  }

  _move(dx) {
    const p = this.piece;
    if (!p || this._collide(p.m, p.x + dx, p.y)) return false;
    p.x += dx;
    this._touchLock();
    this.sfx.play('tick', { minGap: 0.03 });
    return true;
  }

  _rotate(cw) {
    const p = this.piece;
    if (!p || p.type === 'O') return;
    const m = cw ? rotateCW(p.m) : rotateCCW(p.m);
    for (const [kx, ky] of KICKS) {
      if (!this._collide(m, p.x + kx, p.y + ky)) {
        p.m = m;
        p.x += kx;
        p.y += ky;
        this._touchLock();
        this.sfx.play('move', { minGap: 0.03 });
        return;
      }
    }
  }

  _touchLock() {
    if (this.lockT > 0 && this.lockResets < 15) {
      this.lockT = 0;
      this.lockResets++;
    }
  }

  _ghostY() {
    const p = this.piece;
    let y = p.y;
    while (!this._collide(p.m, p.x, y + 1)) y++;
    return y;
  }

  _hardDrop() {
    const p = this.piece;
    const gy = this._ghostY();
    const dist = gy - p.y;
    this.score += dist * 2;
    for (let r = 0; r < p.m.length; r++) for (let c = 0; c < p.m.length; c++) {
      if (!p.m[r][c]) continue;
      const x = BX + (p.x + c) * CELL + CELL / 2;
      this.parts.emit(x, BY + (gy + r - HIDDEN) * CELL, 2, { color: COLORS[p.type], speed: 80, life: 0.35, size: 5, vy: -120 });
    }
    p.y = gy;
    this.sfx.play('stomp');
    this._lock();
  }

  _lock() {
    const p = this.piece;
    let above = true;
    for (let r = 0; r < p.m.length; r++) for (let c = 0; c < p.m.length; c++) {
      if (!p.m[r][c]) continue;
      const y = p.y + r;
      if (y >= 0) this.grid[y][p.x + c] = p.type;
      if (y >= HIDDEN) above = false;
    }
    this.piece = null;
    this.canHold = true;
    if (above) {
      this._gameOver();
      return;
    }
    const full = [];
    for (let y = 0; y < ROWS; y++) if (this.grid[y].every((v) => v)) full.push(y);
    if (full.length) {
      this.clearing = { rows: full, t: 0 };
      const n = full.length;
      this.score += LINE_SCORE[n] * this.level;
      this.lines += n;
      this.lastClear = { n, t: 0 };
      this.sfx.play(n >= 4 ? 'clear' : 'coin');
      for (const y of full) {
        for (let x = 0; x < COLS; x++) {
          this.parts.emit(BX + x * CELL + CELL / 2, BY + (y - HIDDEN) * CELL + CELL / 2, 3,
            { color: [COLORS[this.grid[y][x]], '#ffffff'], speed: 260, life: 0.6, size: 6, gravity: 500 });
        }
      }
      const lv = Math.min(20, 1 + Math.floor(this.lines / 10));
      if (lv > this.level) {
        this.level = lv;
        this.sfx.play('oneup');
      }
    } else {
      this.sfx.play('bounce', { f: 220 });
      this._spawn();
    }
  }

  _gameOver() {
    this.piece = null;
    this.submitScore(this.score);
    this.sfx.play('gameover');
    this.setMode('over');
  }

  _hold() {
    if (!this.canHold || !this.piece) return;
    const cur = this.piece.type;
    this.canHold = false;
    this.sfx.play('confirm');
    if (this.hold) {
      const h = this.hold;
      this.hold = cur;
      this._spawn(h);
    } else {
      this.hold = cur;
      this._spawn();
    }
  }

  gravity() {
    return Math.max(0.016, Math.pow(0.8 - (this.level - 1) * 0.007, this.level - 1));
  }

  update(dt, pad) {
    this.t += dt;
    this.modeT += dt;
    this.parts.update(dt);
    if (this.lastClear) {
      this.lastClear.t += dt;
      if (this.lastClear.t > 1.2) this.lastClear = null;
    }
    if (this.mode === 'title') {
      if (pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      return;
    }
    if (this.mode === 'over') {
      if (this.modeT > 0.8 && pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      else if (this.modeT > 0.8 && pad.pressed.B) { this.sfx.play('back'); this.resetGame(); this.setMode('title'); }
      return;
    }
    if (this.clearing) {
      this.clearing.t += dt;
      if (this.clearing.t > 0.32) {
        const rows = new Set(this.clearing.rows);
        const keep = this.grid.filter((_, y) => !rows.has(y));
        while (keep.length < ROWS) keep.unshift(new Array(COLS).fill(null));
        this.grid = keep;
        this.clearing = null;
        this._spawn();
      }
      return;
    }
    if (!this.piece) return;

    if (pad.pressed.L || pad.pressed.R || pad.pressed.ZL) { this._hold(); if (!this.piece) return; }
    if (pad.pressed.A || pad.pressed.X) this._rotate(true);
    if (pad.pressed.B || pad.pressed.Y) this._rotate(false);

    // 横移（DAS/ARR）
    let dir = 0;
    if (pad.down.LEFT || pad.lx < -0.5) dir = -1;
    else if (pad.down.RIGHT || pad.lx > 0.5) dir = 1;
    if (dir !== this.das.dir) {
      this.das.dir = dir;
      this.das.t = 0;
      if (dir) this._move(dir);
    } else if (dir) {
      this.das.t += dt;
      if (this.das.t > 0.16) {
        while (this.das.t > 0.16 + 0.045) {
          this.das.t -= 0.045;
          if (!this._move(dir)) break;
        }
      }
    }
    const upNow = pad.down.UP || pad.ly > 0.7;
    if ((pad.pressed.UP || (upNow && !this.upHeld)) || pad.pressed.ZR) {
      this.upHeld = upNow;
      this._hardDrop();
      return;
    }
    this.upHeld = upNow;
    const soft = pad.down.DOWN || pad.ly < -0.5;
    const g = soft ? Math.min(this.gravity(), 0.04) : this.gravity();
    const p = this.piece;
    if (this._collide(p.m, p.x, p.y + 1)) {
      this.lockT += dt;
      if (this.lockT >= 0.5) this._lock();
    } else {
      this.lockT = 0;
      this.dropT += dt;
      while (this.dropT >= g && this.piece) {
        this.dropT -= g;
        if (this._collide(this.piece.m, this.piece.x, this.piece.y + 1)) {
          this.dropT = 0;
          break;
        }
        this.piece.y++;
        if (soft) this.score += 1;
      }
    }
  }

  _drawMini(c, type, cx, cy, s) {
    if (!type) return;
    const m = SHAPES[type];
    let minR = 9, maxR = -1, minC = 9, maxC = -1;
    m.forEach((row, r) => row.forEach((v, cc) => {
      if (!v) return;
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minC = Math.min(minC, cc); maxC = Math.max(maxC, cc);
    }));
    const w = (maxC - minC + 1) * s, h = (maxR - minR + 1) * s;
    m.forEach((row, r) => row.forEach((v, cc) => {
      if (v) drawCell(c, cx - w / 2 + (cc - minC) * s, cy - h / 2 + (r - minR) * s, s, COLORS[type], this.canHold || type !== this.hold ? 1 : 0.4);
    }));
  }

  draw(c) {
    c.drawImage(this.bg, 0, 0);
    // 已落下的方块
    const clearRows = this.clearing ? new Set(this.clearing.rows) : null;
    for (let y = HIDDEN; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const v = this.grid[y][x];
      if (!v) continue;
      const px = BX + x * CELL, py = BY + (y - HIDDEN) * CELL;
      if (clearRows && clearRows.has(y)) {
        const k = this.clearing.t / 0.32;
        drawCell(c, px, py, CELL, Math.floor(k * 10) % 2 ? '#ffffff' : COLORS[v], 1 - k * 0.7);
      } else drawCell(c, px, py, CELL, COLORS[v]);
    }
    // 当前方块 + 落点预览
    const p = this.piece;
    if (p && this.mode === 'play') {
      const gy = this._ghostY();
      for (let r = 0; r < p.m.length; r++) for (let cc = 0; cc < p.m.length; cc++) {
        if (!p.m[r][cc]) continue;
        const gyy = gy + r;
        if (gyy >= HIDDEN) {
          strokeRR(c, BX + (p.x + cc) * CELL + 3, BY + (gyy - HIDDEN) * CELL + 3, CELL - 6, CELL - 6, 6, COLORS[p.type], 2);
        }
      }
      for (let r = 0; r < p.m.length; r++) for (let cc = 0; cc < p.m.length; cc++) {
        if (!p.m[r][cc]) continue;
        const y = p.y + r;
        if (y < HIDDEN) continue;
        drawCell(c, BX + (p.x + cc) * CELL, BY + (y - HIDDEN) * CELL, CELL, COLORS[p.type]);
      }
    }
    this.parts.draw(c);

    // 暂存 / 下一个
    this._drawMini(c, this.hold, BX - 135, BY + 100, 26);
    this.queue.slice(0, 5).forEach((t, i) => this._drawMini(c, t, BX + COLS * CELL + 135, BY + 92 + i * 76, i === 0 ? 28 : 22));
    // 记录
    const sx = BX - 135;
    const stat = (label, v, y) => {
      text(c, label, sx, y, 18, '#d9b89a', 'center', 600);
      text(c, String(v), sx, y + 32, 30, '#ffffff', 'center', 800);
    };
    stat('得分', this.score, BY + 230);
    stat('等级', this.level, BY + 310);
    stat('消除行数', this.lines, BY + 390);
    text(c, `最高 ${Math.max(this.best, this.score)}`, sx, BY + 482, 17, '#d9b89a', 'center', 600);

    if (this.lastClear && this.mode === 'play') {
      const n = this.lastClear.n;
      const label = ['', '单消', '双消', '三消', '四消！'][n];
      const s = easeOutBack(this.lastClear.t / 0.3);
      c.save();
      c.globalAlpha = clamp(1.2 - this.lastClear.t, 0, 1);
      c.translate(BX + COLS * CELL / 2, BY + 260);
      c.scale(s, s);
      outlineText(c, label, 0, 0, n >= 4 ? 64 : 48, n >= 4 ? '#ffe08a' : '#ffffff', '#7a4a2a', 10);
      c.restore();
    }

    // 操作提示
    const tips = [['DPAD', '移动 / ↓软降 ↑硬降'], ['A', '旋转'], ['B', '反向旋转'], ['L', '暂存']];
    tips.forEach(([g, l], i) => {
      const y = BY + 470 + i * 34;
      const x = BX + COLS * CELL + 60;
      glyph(c, g, x + 12, y, 11, '#f0d9c4', '#2a1d17');
      text(c, l, x + 34, y + 1, 16, '#f0d9c4', 'left', 500);
    });

    if (this.mode === 'title') {
      drawTitleCard(c, {
        t: this.modeT, title: '方块消除', subtitle: '把下落的方块拼满一整行就能消除', best: this.best,
        stroke: '#7a4a2a', titleY: 300, promptY: 460,
        controls: [['DPAD', '移动'], ['A', '旋转'], ['L', '暂存'], ['PLUS', '暂停']],
      });
    } else if (this.mode === 'over') {
      drawResult(c, {
        t: this.modeT, title: '游戏结束', color: '#c0703a', newBest: this.newBest,
        lines: [['得分', this.score], ['消除行数', this.lines], ['等级', this.level], ['最高分', this.best]],
        hints: [['A', '再来一次'], ['B', '标题画面']],
      });
    }
  }
}


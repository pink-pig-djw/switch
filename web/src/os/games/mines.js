// 扫雷：9×9 / 16×16，首次翻开保证安全
import { GameBase, drawResult, Particles, controlsBar, promptLine } from './common.js';
import { W, H, clamp, text, fillRR, strokeRR, rrect, Nav, outlineText, glyph, easeOutBack, easeOutCubic } from '../ui.js';

const DIFFS = [
  { n: 9, mines: 10, cell: 60, label: '初级', key: 'mines9' },
  { n: 16, mines: 40, cell: 38, label: '高级', key: 'mines16' },
];
const NUM_COLORS = ['', '#3d7dd8', '#3a9b5a', '#e0503a', '#6a4bc4', '#b5533c', '#2a9d9d', '#3a3a3a', '#8a8a8a'];

function drawMine(c, x, y, r) {
  c.fillStyle = '#2b2b2e';
  c.strokeStyle = '#2b2b2e';
  c.lineWidth = Math.max(2, r * 0.22);
  c.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    c.beginPath();
    c.moveTo(x - Math.cos(a) * r * 1.35, y - Math.sin(a) * r * 1.35);
    c.lineTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35);
    c.stroke();
  }
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.beginPath();
  c.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2);
  c.fill();
}

function drawFlag(c, x, y, s) {
  c.fillStyle = '#5a4636';
  c.fillRect(x - s * 0.05, y - s * 0.38, s * 0.08, s * 0.72);
  c.fillRect(x - s * 0.22, y + s * 0.3, s * 0.42, s * 0.08);
  c.fillStyle = '#ff4b3e';
  c.beginPath();
  c.moveTo(x + s * 0.03, y - s * 0.4);
  c.lineTo(x + s * 0.36, y - s * 0.24);
  c.lineTo(x + s * 0.03, y - s * 0.06);
  c.closePath();
  c.fill();
}

function drawMinesTile(c, s) {
  const k = s / 256;
  c.save();
  c.scale(k, k);
  c.fillStyle = '#e9f3dc';
  c.fillRect(0, 0, 256, 256);
  const cs = 42;
  const layout = [
    'hhhhhh',
    'h1122h',
    'h1F2*h',
    'h112hh',
    'hhhhhh',
  ];
  layout.forEach((row, r) => [...row].forEach((ch, i) => {
    const x = 2 + i * cs, y = 10 + r * cs;
    if (ch === 'h') {
      fillRR(c, x + 2, y + 2, cs - 4, cs - 4, 7, '#8cc65a');
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.fillRect(x + 7, y + 6, cs - 14, 5);
    } else {
      fillRR(c, x + 2, y + 2, cs - 4, cs - 4, 7, '#f4ead7');
      if (ch === 'F') drawFlag(c, x + cs / 2, y + cs / 2, cs);
      else if (ch === '*') drawMine(c, x + cs / 2, y + cs / 2, 9);
      else text(c, ch, x + cs / 2, y + cs / 2 + 2, 24, NUM_COLORS[+ch], 'center', 800);
    }
  }));
  outlineText(c, '扫雷', 128, 226, 48, '#ffffff', '#4d7d2c', 9);
  c.restore();
}

export class Mines extends GameBase {
  static meta = { id: 'mines', name: '扫雷', kind: 'game', color: '#6aa84f', tile: drawMinesTile };

  constructor(os) {
    super(os);
    this.diff = 0;
    this.nav = new Nav(0.2, 0.055);
    this.titleNav = new Nav();
    this.parts = new Particles(400);
    this.bestTimes = DIFFS.map((d) => Number(os.store.get('best.' + d.key, 0)) || 0);
    this.setup();
    this.setMode('title');
  }

  setup() {
    const d = DIFFS[this.diff];
    this.n = d.n;
    this.mineCount = d.mines;
    this.cell = d.cell;
    this.cells = Array.from({ length: d.n * d.n }, () => ({ mine: false, open: false, flag: false, num: 0, openT: 0 }));
    this.first = true;
    this.cx = d.n >> 1;
    this.cy = d.n >> 1;
    this.time = 0;
    this.opened = 0;
    this.flags = 0;
    this.boom = null;
    this.revealQ = [];
    this.won = false;
    this.parts.clear();
  }

  start() {
    this.setup();
    this.setMode('play');
  }

  idx(x, y) {
    return y * this.n + x;
  }

  neighbors(x, y) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < this.n && ny < this.n) out.push([nx, ny]);
    }
    return out;
  }

  placeMines(sx, sy) {
    const banned = new Set([this.idx(sx, sy), ...this.neighbors(sx, sy).map(([x, y]) => this.idx(x, y))]);
    const pool = [];
    for (let i = 0; i < this.n * this.n; i++) if (!banned.has(i)) pool.push(i);
    for (let k = 0; k < this.mineCount; k++) {
      const j = k + ((Math.random() * (pool.length - k)) | 0);
      [pool[k], pool[j]] = [pool[j], pool[k]];
      this.cells[pool[k]].mine = true;
    }
    for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) {
      this.cells[this.idx(x, y)].num = this.neighbors(x, y).filter(([a, b]) => this.cells[this.idx(a, b)].mine).length;
    }
  }

  reveal(x, y) {
    const c0 = this.cells[this.idx(x, y)];
    if (c0.open || c0.flag) return;
    if (this.first) {
      this.first = false;
      this.placeMines(x, y);
    }
    if (c0.mine) {
      this.lose(x, y);
      return;
    }
    // 广度优先展开空白区域
    const q = [[x, y]];
    let count = 0;
    while (q.length) {
      const [qx, qy] = q.shift();
      const cell = this.cells[this.idx(qx, qy)];
      if (cell.open || cell.flag) continue;
      cell.open = true;
      cell.openT = this.t + count * 0.004;
      this.opened++;
      count++;
      if (cell.num === 0) for (const [nx, ny] of this.neighbors(qx, qy)) {
        const nc = this.cells[this.idx(nx, ny)];
        if (!nc.open && !nc.flag) q.push([nx, ny]);
      }
    }
    this.sfx.play(count > 1 ? 'slide' : 'tick');
    if (this.opened === this.n * this.n - this.mineCount) this.win();
  }

  chord(x, y) {
    const cell = this.cells[this.idx(x, y)];
    if (!cell.open || cell.num === 0) return;
    const nb = this.neighbors(x, y);
    const f = nb.filter(([a, b]) => this.cells[this.idx(a, b)].flag).length;
    if (f !== cell.num) {
      this.sfx.play('deny');
      return;
    }
    for (const [a, b] of nb) {
      if (this.mode !== 'play') return;
      this.reveal(a, b);
    }
  }

  lose(x, y) {
    this.boom = { x, y };
    this.sfx.play('explode', { big: true });
    const px = this.bx() + x * this.cell + this.cell / 2, py = this.by() + y * this.cell + this.cell / 2;
    this.parts.emit(px, py, 40, { color: ['#ff8a3d', '#ffd166', '#ffffff', '#555'], speed: 360, life: 0.8, size: 8, drag: 2, shape: 'circle' });
    this.revealQ = [];
    for (let yy = 0; yy < this.n; yy++) for (let xx = 0; xx < this.n; xx++) {
      const c = this.cells[this.idx(xx, yy)];
      if (c.mine && !(xx === x && yy === y)) this.revealQ.push([xx, yy, Math.hypot(xx - x, yy - y)]);
    }
    this.revealQ.sort((a, b) => a[2] - b[2]);
    this.cells[this.idx(x, y)].open = true;
    this.setMode('dying');
  }

  win() {
    this.won = true;
    this.sfx.play('win');
    for (const c of this.cells) if (c.mine) c.flag = true;
    this.flags = this.mineCount;
    const t = Math.round(this.time * 10) / 10;
    const b = this.bestTimes[this.diff];
    this.newBest = !b || t < b;
    if (this.newBest) {
      this.bestTimes[this.diff] = t;
      this.os.store.set('best.' + DIFFS[this.diff].key, t);
    }
    this.setMode('over');
  }

  update(dt, pad) {
    this.t += dt;
    this.modeT += dt;
    this.parts.update(dt);
    if (this.mode === 'title') {
      const d = this.titleNav.update(dt, pad);
      if ((d === 'left' || d === 'up') && this.diff > 0) { this.diff--; this.sfx.play('tick'); }
      if ((d === 'right' || d === 'down') && this.diff < DIFFS.length - 1) { this.diff++; this.sfx.play('tick'); }
      if (pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      return;
    }
    if (this.mode === 'dying') {
      if (this.revealQ.length && this.modeT > 0.4) {
        const step = Math.max(1, Math.ceil(this.revealQ.length * dt * 4));
        for (let i = 0; i < step && this.revealQ.length; i++) {
          const [x, y] = this.revealQ.shift();
          const c = this.cells[this.idx(x, y)];
          if (!c.flag) c.open = true;
          this.sfx.play('hit', { minGap: 0.05 });
        }
      }
      if (!this.revealQ.length && this.modeT > 1.2) {
        this.newBest = false;
        this.sfx.play('gameover');
        this.setMode('over');
      }
      return;
    }
    if (this.mode === 'over') {
      if (this.modeT > 0.6 && pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      else if (this.modeT > 0.6 && pad.pressed.B) { this.sfx.play('back'); this.setup(); this.setMode('title'); }
      return;
    }
    // play
    if (!this.first) this.time += dt;
    const d = this.nav.update(dt, pad);
    const old = this.cx + this.cy * 100;
    if (d === 'left') this.cx = (this.cx + this.n - 1) % this.n;
    if (d === 'right') this.cx = (this.cx + 1) % this.n;
    if (d === 'up') this.cy = (this.cy + this.n - 1) % this.n;
    if (d === 'down') this.cy = (this.cy + 1) % this.n;
    if (old !== this.cx + this.cy * 100) this.sfx.play('move', { minGap: 0.03 });
    const cell = this.cells[this.idx(this.cx, this.cy)];
    if (pad.pressed.A) {
      if (cell.open) this.chord(this.cx, this.cy);
      else if (!cell.flag) this.reveal(this.cx, this.cy);
      else this.sfx.play('deny');
    } else if ((pad.pressed.B || pad.pressed.Y) && !cell.open) {
      cell.flag = !cell.flag;
      this.flags += cell.flag ? 1 : -1;
      this.sfx.play(cell.flag ? 'confirm' : 'back');
    }
  }

  bx() {
    return Math.round((W - this.n * this.cell) / 2);
  }
  by() {
    return Math.round(96 + (600 - this.n * this.cell) / 2);
  }

  _drawBoard(c) {
    const n = this.n, cs = this.cell, bx = this.bx(), by = this.by();
    fillRR(c, bx - 14, by - 14, n * cs + 28, n * cs + 28, 18, '#6f9a4a');
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const cell = this.cells[this.idx(x, y)];
      const px = bx + x * cs, py = by + y * cs;
      if (!cell.open) {
        fillRR(c, px + 1.5, py + 1.5, cs - 3, cs - 3, cs * 0.16, (x + y) % 2 ? '#93cc61' : '#8cc65a');
        c.fillStyle = 'rgba(255,255,255,0.28)';
        c.fillRect(px + cs * 0.16, py + cs * 0.12, cs * 0.68, cs * 0.1);
        if (cell.flag) drawFlag(c, px + cs / 2, py + cs / 2, cs * 0.9);
      } else {
        const age = clamp((this.t - cell.openT) / 0.15, 0, 1);
        const boom = this.boom && this.boom.x === x && this.boom.y === y;
        fillRR(c, px + 1.5, py + 1.5, cs - 3, cs - 3, cs * 0.16, boom ? '#ff6b5a' : (x + y) % 2 ? '#f6eddc' : '#f1e6d2');
        if (cell.mine) drawMine(c, px + cs / 2, py + cs / 2, cs * 0.22);
        else if (cell.num) {
          const s = 0.6 + 0.4 * easeOutBack(age);
          text(c, String(cell.num), px + cs / 2, py + cs / 2 + 2, cs * 0.6 * s, NUM_COLORS[cell.num], 'center', 800);
        }
        if (cell.flag && !cell.mine && this.mode !== 'play') {
          drawFlag(c, px + cs / 2, py + cs / 2, cs * 0.9);
          c.strokeStyle = '#d33';
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(px + 8, py + 8);
          c.lineTo(px + cs - 8, py + cs - 8);
          c.stroke();
        }
      }
    }
    if (this.mode === 'play') {
      const px = bx + this.cx * cs, py = by + this.cy * cs;
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 6);
      c.globalAlpha = pulse;
      strokeRR(c, px - 3, py - 3, cs + 6, cs + 6, cs * 0.22, '#ff7a1a', 5);
      c.globalAlpha = 1;
      strokeRR(c, px, py, cs, cs, cs * 0.18, '#ffffff', 2);
    }
  }

  draw(c) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#eaf4dd');
    g.addColorStop(1, '#cfe3b8');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    if (this.mode === 'title') {
      this._drawTitle(c);
      return;
    }
    this._drawBoard(c);
    this.parts.draw(c);
    // 左侧信息
    const lx = 150;
    outlineText(c, '扫雷', lx, 130, 56, '#ffffff', '#4d7d2c', 9);
    text(c, `${DIFFS[this.diff].label} ${this.n}×${this.n}`, lx, 184, 20, '#4d6b38', 'center', 700);
    const info = (y, label, val) => {
      fillRR(c, lx - 100, y, 200, 86, 16, 'rgba(255,255,255,0.7)');
      text(c, label, lx, y + 24, 18, '#6b7f5a', 'center', 600);
      text(c, val, lx, y + 58, 32, '#2f3d24', 'center', 800);
    };
    info(226, '剩余地雷', String(this.mineCount - this.flags));
    info(330, '用时', `${Math.floor(this.time)} 秒`);
    const bt = this.bestTimes[this.diff];
    info(434, '最佳纪录', bt ? `${bt} 秒` : '—');
    // 右侧操作说明
    const rx = W - 150;
    const tips = [['DPAD', '移动光标'], ['A', '翻开 / 快速展开'], ['B', '插旗'], ['Y', '插旗'], ['PLUS', '暂停']];
    fillRR(c, rx - 120, 226, 240, 40 + tips.length * 46, 16, 'rgba(255,255,255,0.7)');
    tips.forEach(([gname, l], i) => {
      const y = 256 + i * 46;
      glyph(c, gname, rx - 86, y, 13, '#3a4a2e', '#fff');
      text(c, l, rx - 62, y + 1, 18, '#3a4a2e', 'left', 600);
    });
    if (this.first && this.mode === 'play') {
      c.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 4);
      text(c, '第一次翻开一定是安全的哦', W / 2, 706, 18, '#4d6b38', 'center', 600);
      c.globalAlpha = 1;
    }
    if (this.mode === 'over') {
      drawResult(c, {
        t: this.modeT, title: this.won ? '扫雷成功！' : '踩到地雷了！', color: this.won ? '#4d9b2c' : '#e0503a',
        newBest: this.won && this.newBest,
        lines: this.won
          ? [['难度', `${DIFFS[this.diff].label} ${this.n}×${this.n}`], ['用时', `${Math.round(this.time * 10) / 10} 秒`], ['最佳纪录', `${this.bestTimes[this.diff]} 秒`]]
          : [['难度', `${DIFFS[this.diff].label} ${this.n}×${this.n}`], ['已翻开', `${this.opened} 格`], ['用时', `${Math.floor(this.time)} 秒`]],
        hints: [['A', '再来一局'], ['B', '选择难度']],
      });
    }
  }

  _drawTitle(c) {
    // 背景装饰格子
    for (let y = 0; y < 8; y++) for (let x = 0; x < 15; x++) {
      c.fillStyle = (x + y) % 2 ? 'rgba(140,198,90,0.12)' : 'rgba(140,198,90,0.06)';
      c.fillRect(x * 88, y * 92, 88, 92);
    }
    const s = easeOutBack(this.modeT / 0.6);
    c.save();
    c.translate(W / 2, 170);
    c.scale(s, s);
    outlineText(c, '扫雷', 0, 0, 104, '#ffffff', '#4d7d2c', 16);
    c.restore();
    text(c, '根据数字推理出所有地雷的位置', W / 2, 252, 24, '#4d6b38', 'center', 600);
    DIFFS.forEach((d, i) => {
      const w = 300, h = 190;
      const x = W / 2 - w - 30 + i * (w + 60), y = 300;
      const sel = i === this.diff;
      fillRR(c, x + 2, y + 6, w, h, 20, 'rgba(0,0,0,0.08)');
      fillRR(c, x, y, w, h, 20, sel ? '#ffffff' : 'rgba(255,255,255,0.65)');
      text(c, d.label, x + w / 2, y + 50, 36, sel ? '#ff7a1a' : '#4d6b38', 'center', 800);
      text(c, `${d.n} × ${d.n} · ${d.mines} 颗地雷`, x + w / 2, y + 100, 22, '#4d6b38', 'center', 600);
      const bt = this.bestTimes[i];
      text(c, bt ? `最佳纪录 ${bt} 秒` : '还没有纪录', x + w / 2, y + 146, 18, '#7a8f68', 'center', 500);
      if (sel) {
        c.globalAlpha = 0.55 + 0.45 * Math.sin(this.t * 4.2);
        strokeRR(c, x - 7, y - 7, w + 14, h + 14, 24, '#ff7a1a', 5);
        c.globalAlpha = 1;
      }
    });
    c.globalAlpha = 0.6 + 0.4 * Math.sin(this.t * 4);
    promptLine(c, ['按 ', { g: 'A' }, ' 开始游戏'], W / 2, 560, 30, '#3a4a2e', '#3a4a2e', '#fff');
    c.globalAlpha = 1;
    controlsBar(c, [['DPAD', '选择难度 / 移动'], ['A', '翻开'], ['B', '插旗'], ['PLUS', '暂停']], 664, '#ffffff', 'rgba(60,90,40,0.75)');
  }
}

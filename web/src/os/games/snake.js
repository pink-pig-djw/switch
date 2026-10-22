// 贪吃蛇
import { GameBase, drawTitleCard, drawResult, Particles } from './common.js';
import { W, H, clamp, lerp, text, fillRR, strokeRR, rrect, EdgeDir, outlineText, makeCanvas } from '../ui.js';
import { drawOrange, drawLeaf } from '../icons.js';

const CELL = 40, COLS = 28, ROWS = 14;
const OX = (W - COLS * CELL) / 2; // 80
const OY = 112;
const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

function drawSnakeTile(c, s) {
  const k = s / 256;
  c.save();
  c.scale(k, k);
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#9ad16a');
  g.addColorStop(1, '#5aa53f');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if ((x + y) % 2) { c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x * 32, y * 32, 32, 32); }
  }
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = '#3554d8';
  c.lineWidth = 30;
  c.beginPath();
  c.moveTo(40, 200);
  c.lineTo(40, 120);
  c.lineTo(120, 120);
  c.lineTo(120, 70);
  c.lineTo(190, 70);
  c.stroke();
  c.strokeStyle = '#5d7bff';
  c.lineWidth = 22;
  c.stroke();
  c.fillStyle = '#3554d8';
  c.beginPath();
  c.arc(196, 70, 20, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(202, 62, 6, 0, Math.PI * 2);
  c.arc(202, 79, 6, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#222';
  c.beginPath();
  c.arc(204, 62, 3, 0, Math.PI * 2);
  c.arc(204, 79, 3, 0, Math.PI * 2);
  c.fill();
  drawOrange(c, 200, 160, 22);
  outlineText(c, '贪吃蛇', 128, 222, 44, '#ffffff', '#2f6b25', 9);
  c.restore();
}

export class Snake extends GameBase {
  static meta = { id: 'snake', name: '贪吃蛇', kind: 'game', color: '#4caf50', tile: drawSnakeTile };

  constructor(os) {
    super(os);
    this.edge = new EdgeDir();
    this.parts = new Particles(300);
    this.board = this._makeBoard();
    this.reset();
  }

  _makeBoard() {
    const cv = makeCanvas(W, H);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#24452c');
    g.addColorStop(1, '#16301d');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    fillRR(c, OX - 14, OY - 14, COLS * CELL + 28, ROWS * CELL + 28, 18, '#3e6f34');
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      c.fillStyle = (x + y) % 2 ? '#a9d672' : '#b4de7c';
      c.fillRect(OX + x * CELL, OY + y * CELL, CELL, CELL);
    }
    strokeRR(c, OX - 3, OY - 3, COLS * CELL + 6, ROWS * CELL + 6, 6, '#2f5a27', 6);
    return cv;
  }

  reset() {
    const cy = 7;
    this.snake = [{ x: 8, y: cy }, { x: 7, y: cy }, { x: 6, y: cy }, { x: 5, y: cy }];
    this.prevTail = null;
    this.dir = DIRS.right;
    this.queue = [];
    this.timer = 0;
    this.interval = 0.14;
    this.score = 0;
    this.eaten = 0;
    this.grow = 0;
    this.golden = null;
    this.goldenT = 0;
    this.food = null;
    this.deadT = 0;
    this.pop = 0;
    this.spawnFood();
    this.parts.clear();
  }

  start() {
    this.reset();
    this.setMode('play');
  }

  update(dt, pad) {
    this.t += dt;
    this.modeT += dt;
    this.parts.update(dt);
    this.pop = Math.max(0, this.pop - dt * 4);
    if (this.mode === 'title') {
      if (pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      return;
    }
    if (this.mode === 'over') {
      if (this.modeT > 0.6 && pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      else if (this.modeT > 0.6 && pad.pressed.B) { this.sfx.play('back'); this.reset(); this.setMode('title'); }
      return;
    }
    if (this.mode === 'dying') {
      this.deadT += dt;
      if (this.deadT > 1.1) {
        this.submitScore(this.score);
        this.setMode('over');
        this.sfx.play('gameover');
      }
      return;
    }
    const d = this.edge.update(pad);
    if (d) this.pushDir(DIRS[d]);
    if (this.golden) {
      this.goldenT -= dt;
      if (this.goldenT <= 0) this.golden = null;
    }
    this.timer += dt;
    while (this.timer >= this.interval && this.mode === 'play') {
      this.timer -= this.interval;
      this.step();
    }
  }

  pushDir(v) {
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (v.x === -last.x && v.y === -last.y) return;
    if (v.x === last.x && v.y === last.y) return;
    if (this.queue.length < 3) this.queue.push(v);
  }

  step() {
    if (this.queue.length) this.dir = this.queue.shift();
    const head = this.snake[0];
    const nx = head.x + this.dir.x, ny = head.y + this.dir.y;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return this.die();
    const tailMoves = this.grow === 0;
    for (let i = 0; i < this.snake.length - (tailMoves ? 1 : 0); i++) {
      const s = this.snake[i];
      if (s.x === nx && s.y === ny) return this.die();
    }
    this.snake.unshift({ x: nx, y: ny });
    if (this.grow > 0) {
      this.grow--;
      this.prevTail = null;
    } else {
      this.prevTail = this.snake.pop();
    }
    const cx = OX + nx * CELL + CELL / 2, cy = OY + ny * CELL + CELL / 2;
    if (this.food && nx === this.food.x && ny === this.food.y) {
      this.score += 10;
      this.grow += 1;
      this.eaten++;
      this.pop = 1;
      this.sfx.play('eat');
      this.parts.emit(cx, cy, 14, { color: ['#ff9a2e', '#ffd166', '#fff'], speed: 220, life: 0.5, size: 6, drag: 3 });
      this.spawnFood();
      if (this.eaten % 5 === 0) this.spawnGolden();
      this.interval = Math.max(0.065, 0.14 - this.eaten * 0.0032);
    }
    if (this.golden && nx === this.golden.x && ny === this.golden.y) {
      this.score += 50;
      this.grow += 3;
      this.pop = 1;
      this.sfx.play('golden');
      this.parts.emit(cx, cy, 26, { color: ['#ffe066', '#fff3b0', '#ffffff'], speed: 300, life: 0.7, size: 7, drag: 2.5, shape: 'circle' });
      this.golden = null;
    }
    return null;
  }

  die() {
    this.mode = 'dying';
    this.deadT = 0;
    this.sfx.play('hurt');
    const h = this.snake[0];
    this.parts.emit(OX + h.x * CELL + 20, OY + h.y * CELL + 20, 30, { color: ['#5d7bff', '#ffffff', '#ff6b6b'], speed: 320, life: 0.8, size: 7, drag: 2 });
  }

  _free() {
    const occ = new Set(this.snake.map((s) => s.x + s.y * COLS));
    if (this.food) occ.add(this.food.x + this.food.y * COLS);
    if (this.golden) occ.add(this.golden.x + this.golden.y * COLS);
    const free = [];
    for (let i = 0; i < COLS * ROWS; i++) if (!occ.has(i)) free.push(i);
    if (!free.length) return null;
    const i = free[(Math.random() * free.length) | 0];
    return { x: i % COLS, y: (i / COLS) | 0 };
  }

  spawnFood() {
    this.food = this._free();
  }

  spawnGolden() {
    this.golden = this._free();
    this.goldenT = 6;
  }

  draw(c) {
    c.drawImage(this.board, 0, 0);
    // HUD
    text(c, '贪吃蛇', OX, 56, 34, '#ffffff', 'left', 800);
    text(c, `得分 ${this.score}`, W / 2, 56, 30, '#ffe08a', 'center', 800);
    text(c, `最高 ${Math.max(this.best, this.score)}   长度 ${this.snake.length}`, W - OX, 56, 22, '#cfe8c0', 'right', 600);

    // 食物
    const bob = Math.sin(this.t * 5) * 2.5;
    if (this.food) drawOrange(c, OX + this.food.x * CELL + 20, OY + this.food.y * CELL + 22 + bob, 13);
    if (this.golden) {
      const gx = OX + this.golden.x * CELL + 20, gy = OY + this.golden.y * CELL + 21;
      const blink = this.goldenT < 2 ? (Math.sin(this.t * 20) > 0 ? 1 : 0.35) : 1;
      c.globalAlpha = blink;
      c.fillStyle = 'rgba(255,230,90,0.45)';
      c.beginPath();
      c.arc(gx, gy, 19 + Math.sin(this.t * 8) * 2, 0, Math.PI * 2);
      c.fill();
      const g = c.createRadialGradient(gx - 4, gy - 5, 2, gx, gy, 14);
      g.addColorStop(0, '#fff7c2');
      g.addColorStop(1, '#f2b705');
      c.fillStyle = g;
      c.beginPath();
      c.arc(gx, gy, 13, 0, Math.PI * 2);
      c.fill();
      drawLeaf(c, gx + 5, gy - 13, 6, -0.4, '#3fae4a');
      c.strokeStyle = '#ffffff';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(gx, gy, 18, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * this.goldenT) / 6);
      c.stroke();
      c.globalAlpha = 1;
    }

    this._drawSnake(c);
    this.parts.draw(c);

    if (this.mode === 'title') {
      drawTitleCard(c, {
        t: this.modeT, title: '贪吃蛇', subtitle: '吃橙子变长，别撞到墙和自己', best: this.best,
        stroke: '#2f6b25', titleY: 300, promptY: 470,
        controls: [['STICK', '转向'], ['DPAD', '转向'], ['PLUS', '暂停']],
      });
    } else if (this.mode === 'over') {
      drawResult(c, {
        t: this.modeT, title: '游戏结束', color: '#3f9b35', newBest: this.newBest,
        lines: [['得分', this.score], ['长度', this.snake.length], ['最高分', this.best]],
        hints: [['A', '再来一次'], ['B', '标题画面']],
      });
    }
  }

  _drawSnake(c) {
    const s = this.snake;
    if (!s.length) return;
    const p = this.mode === 'play' ? clamp(this.timer / this.interval / 0.45, 0, 1) : 1;
    const ctr = (q) => [OX + q.x * CELL + CELL / 2, OY + q.y * CELL + CELL / 2];
    const pts = [];
    if (s.length > 1) {
      const a = ctr(s[1]), b = ctr(s[0]);
      pts.push([lerp(a[0], b[0], p), lerp(a[1], b[1], p)]);
    } else pts.push(ctr(s[0]));
    for (let i = 1; i < s.length; i++) pts.push(ctr(s[i]));
    if (this.prevTail && this.mode === 'play') {
      const a = ctr(this.prevTail), b = ctr(s[s.length - 1]);
      pts.push([lerp(a[0], b[0], p), lerp(a[1], b[1], p)]);
    }
    const dying = this.mode === 'dying';
    const flash = dying && Math.sin(this.deadT * 30) > 0;
    const body = flash ? '#ffffff' : '#3554d8';
    const light = flash ? '#ffd0d0' : '#5d7bff';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = 'rgba(0,0,0,0.18)';
    c.lineWidth = 32;
    c.save();
    c.translate(2, 4);
    c.stroke();
    c.restore();
    c.strokeStyle = body;
    c.lineWidth = 32;
    c.stroke();
    c.strokeStyle = light;
    c.lineWidth = 20;
    c.stroke();
    // 花纹
    c.fillStyle = flash ? '#fff' : '#90a6ff';
    for (let i = 2; i < pts.length - 1; i += 2) {
      c.beginPath();
      c.arc(pts[i][0], pts[i][1], 4.5, 0, Math.PI * 2);
      c.fill();
    }
    // 头
    const [hx, hy] = pts[0];
    const pop = 1 + this.pop * 0.25;
    c.fillStyle = body;
    c.beginPath();
    c.arc(hx, hy, 19 * pop, 0, Math.PI * 2);
    c.fill();
    const d = this.queue.length && this.mode === 'play' ? this.dir : this.dir;
    const px = -d.y, py = d.x;
    for (const side of [-1, 1]) {
      const ex = hx + d.x * 6 + px * 8 * side, ey = hy + d.y * 6 + py * 8 * side;
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(ex, ey, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#1b1b1b';
      c.beginPath();
      c.arc(ex + d.x * 2, ey + d.y * 2, 3.2, 0, Math.PI * 2);
      c.fill();
    }
    if (Math.sin(this.t * 3) > 0.6 && !dying) {
      c.strokeStyle = '#ff4b5c';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(hx + d.x * 18, hy + d.y * 18);
      c.lineTo(hx + d.x * 28, hy + d.y * 28);
      c.stroke();
    }
  }
}

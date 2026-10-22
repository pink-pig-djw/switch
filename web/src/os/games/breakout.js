// 打砖块
import { GameBase, drawTitleCard, drawResult, Particles } from './common.js';
import { W, H, clamp, damp, text, fillRR, strokeRR, rrect, axisX, outlineText, makeCanvas, easeOutBack } from '../ui.js';

const FL = 40, FR = 1240, FT = 92;
const PY = 652, PH = 18;
const BW = 80, BH = 30, BG = 4, BCOLS = 14;
const BX0 = FL + (FR - FL - (BCOLS * BW + (BCOLS - 1) * BG)) / 2;
const BY0 = 132;
const ROW_COLORS = ['#ff6b6b', '#ff9f43', '#feca57', '#1dd1a1', '#54a0ff', '#8e6bff', '#ff8ad8', '#48dbfb'];

const LEVELS = [
  [
    '11111111111111',
    '11111111111111',
    '1111*1111*1111',
    '11111111111111',
    '11111111111111',
  ],
  [
    '......22......',
    '.....2112.....',
    '....211112....',
    '...21111112...',
    '..211*11*112..',
    '.211111111112.',
    '33333333333333',
  ],
  [
    '#............#',
    '#.3333333333.#',
    '#.2111111112.#',
    '#.21*1111*12.#',
    '#.2111111112.#',
    '#.2222222222.#',
    '#............#',
  ],
  [
    '1.1.1.1.1.1.1.',
    '.2.2.2.2.2.2.2',
    '3.3.3.*.3.3.3.',
    '.2.2.2.2.2.2.2',
    '1.1.1.1.1.1.1.',
    '##..######..##',
  ],
  [
    '*............*',
    '33.33.33.33.33',
    '22.22.22.22.22',
    '11.11.11.11.11',
    '##.##.##.##.##',
    '11111111111111',
  ],
];

const ITEMS = {
  W: { color: '#2ecc71', label: '宽' },
  M: { color: '#3c9bff', label: '多' },
  S: { color: '#f1c40f', label: '慢' },
  L: { color: '#ff4d4d', label: '光' },
  P: { color: '#ff6cc8', label: '命' },
};
const ITEM_KEYS = ['W', 'M', 'S', 'L', 'W', 'M', 'S', 'P'];

function drawBreakoutTile(c, s) {
  const k = s / 256;
  c.save();
  c.scale(k, k);
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#2a1a63');
  g.addColorStop(1, '#130b33');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) {
    if ((r === 2 && i === 3) || (r === 3 && (i === 1 || i === 4))) continue;
    fillRR(c, 14 + i * 39, 28 + r * 22, 35, 17, 4, ROW_COLORS[r]);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(17 + i * 39, 30 + r * 22, 29, 4);
  }
  fillRR(c, 92, 196, 80, 14, 7, '#ff9a3c');
  c.fillStyle = 'rgba(255,255,255,0.25)';
  c.beginPath();
  c.arc(150, 140, 16, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(150, 140, 8, 0, Math.PI * 2);
  c.fill();
  outlineText(c, '打砖块', 128, 230, 40, '#ffffff', '#5b2fd0', 8);
  c.restore();
}

export class Breakout extends GameBase {
  static meta = { id: 'breakout', name: '打砖块', kind: 'game', color: '#7a5cff', tile: drawBreakoutTile };

  constructor(os) {
    super(os);
    this.parts = new Particles(500);
    this.bg = this._makeBg();
    this.resetGame();
    this.setMode('title');
  }

  _makeBg() {
    const cv = makeCanvas(W, H);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#22155a');
    g.addColorStop(1, '#0e0a26');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(140,120,255,0.07)';
    c.lineWidth = 1;
    for (let x = FL; x <= FR; x += 40) { c.beginPath(); c.moveTo(x, FT); c.lineTo(x, H); c.stroke(); }
    for (let y = FT; y <= H; y += 40) { c.beginPath(); c.moveTo(FL, y); c.lineTo(FR, y); c.stroke(); }
    // 墙
    const wall = (x, y, w, h) => {
      const wg = c.createLinearGradient(x, y, x + w, y + h);
      wg.addColorStop(0, '#6a5acd');
      wg.addColorStop(1, '#3b2c8a');
      c.fillStyle = wg;
      c.fillRect(x, y, w, h);
    };
    wall(FL - 14, FT - 14, 14, H - FT + 14);
    wall(FR, FT - 14, 14, H - FT + 14);
    wall(FL - 14, FT - 14, FR - FL + 28, 14);
    return cv;
  }

  resetGame() {
    this.score = 0;
    this.lives = 3;
    this.level = 0;
    this.loadLevel(0);
    this.resetPaddle();
  }

  start() {
    this.resetGame();
    this.setMode('play');
  }

  loadLevel(i) {
    const pat = LEVELS[i % LEVELS.length];
    this.speedMul = 1 + Math.floor(i / LEVELS.length) * 0.12;
    this.bricks = [];
    pat.forEach((row, r) => {
      for (let col = 0; col < BCOLS; col++) {
        const ch = row[col] || '.';
        if (ch === '.') continue;
        const steel = ch === '#';
        const hp = steel ? 1 : ch === '*' ? 1 : Number(ch);
        this.bricks.push({
          x: BX0 + col * (BW + BG), y: BY0 + r * (BH + BG), w: BW, h: BH,
          hp, max: hp, steel, bonus: ch === '*', row: r, hit: 0, dead: false,
        });
      }
    });
    this.items = [];
    this.lasers = [];
    this.parts.clear();
  }

  resetPaddle() {
    this.paddle = { x: W / 2, w: 160 };
    this.ballSpeed = 470 * this.speedMul;
    this.balls = [this.newBall(true)];
    this.wideT = 0;
    this.slowT = 0;
    this.laserT = 0;
    this.laserCd = 0;
    this.combo = 0;
  }

  newBall(stuck) {
    return { x: this.paddle.x, y: PY - 10, vx: 0, vy: 0, r: 9, stuck, off: (Math.random() - 0.5) * 30, trail: [], dead: false };
  }

  curSpeed() {
    return this.ballSpeed * (this.slowT > 0 ? 0.68 : 1);
  }

  update(dt, pad) {
    this.t += dt;
    this.modeT += dt;
    this.parts.update(dt);
    for (const b of this.bricks) if (b.hit > 0) b.hit = Math.max(0, b.hit - dt * 5);
    if (this.mode === 'title') {
      this._movePaddle(dt, pad);
      if (pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      return;
    }
    if (this.mode === 'over') {
      if (this.modeT > 0.6 && pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      else if (this.modeT > 0.6 && pad.pressed.B) { this.sfx.play('back'); this.resetGame(); this.setMode('title'); }
      return;
    }
    if (this.mode === 'clear') {
      if (this.modeT > 2.2) {
        this.level++;
        this.loadLevel(this.level);
        this.resetPaddle();
        this.setMode('play');
      }
      return;
    }
    // —— play ——
    this._movePaddle(dt, pad);
    this.wideT = Math.max(0, this.wideT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.laserT = Math.max(0, this.laserT - dt);
    this.laserCd = Math.max(0, this.laserCd - dt);
    this.paddle.w = damp(this.paddle.w, this.wideT > 0 ? 240 : 160, 10, dt);

    if (pad.pressed.A) {
      let launched = false;
      for (const b of this.balls) {
        if (!b.stuck) continue;
        const ang = clamp(b.off / (this.paddle.w / 2), -0.6, 0.6) + (Math.random() - 0.5) * 0.2;
        const s = this.curSpeed();
        b.vx = Math.sin(ang) * s;
        b.vy = -Math.cos(ang) * s;
        b.stuck = false;
        launched = true;
      }
      if (launched) this.sfx.play('bounce', { f: 520 });
      else if (this.laserT > 0 && this.laserCd <= 0) {
        this.laserCd = 0.22;
        const p = this.paddle;
        this.lasers.push({ x: p.x - p.w / 2 + 10, y: PY - 4, dead: false }, { x: p.x + p.w / 2 - 10, y: PY - 4, dead: false });
        this.sfx.play('laser');
      }
    }

    for (const b of this.balls) {
      if (b.stuck) {
        b.x = this.paddle.x + b.off;
        b.y = PY - b.r - 1;
        continue;
      }
      const spd = this.curSpeed();
      const m = Math.hypot(b.vx, b.vy) || 1;
      b.vx = (b.vx / m) * spd;
      b.vy = (b.vy / m) * spd;
      const steps = Math.max(1, Math.ceil((spd * dt) / 5));
      const sdt = dt / steps;
      for (let i = 0; i < steps && !b.dead; i++) {
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        this._collide(b);
      }
      b.trail.push(b.x, b.y);
      if (b.trail.length > 16) b.trail.splice(0, 2);
    }
    this.balls = this.balls.filter((b) => !b.dead);
    this.bricks = this.bricks.filter((b) => !b.dead);

    // 激光
    for (const l of this.lasers) {
      l.y -= 980 * dt;
      if (l.y < FT) l.dead = true;
      for (const br of this.bricks) {
        if (br.dead || l.dead) continue;
        if (l.x >= br.x && l.x <= br.x + br.w && l.y >= br.y && l.y <= br.y + br.h) {
          l.dead = true;
          this._hitBrick(br);
        }
      }
    }
    this.lasers = this.lasers.filter((l) => !l.dead);
    this.bricks = this.bricks.filter((b) => !b.dead);

    // 道具
    const p = this.paddle;
    for (const it of this.items) {
      it.y += 170 * dt;
      if (it.y + 11 >= PY && it.y - 11 <= PY + PH && Math.abs(it.x - p.x) <= p.w / 2 + 22) {
        it.dead = true;
        this._applyItem(it.k);
      } else if (it.y > H + 20) it.dead = true;
    }
    this.items = this.items.filter((i) => !i.dead);

    if (this.balls.length === 0) {
      this.lives--;
      this.sfx.play('hurt');
      if (this.lives <= 0) {
        this.submitScore(this.score);
        this.sfx.play('gameover');
        this.setMode('over');
      } else {
        this.items = [];
        this.lasers = [];
        this.resetPaddle();
      }
      return;
    }
    if (!this.bricks.some((b) => !b.steel)) {
      this.score += 1000 * (this.level + 1);
      this.sfx.play('clear');
      this.setMode('clear');
    }
  }

  _movePaddle(dt, pad) {
    const p = this.paddle;
    p.x += axisX(pad) * 1150 * dt;
    p.x = clamp(p.x, FL + p.w / 2, FR - p.w / 2);
    if (this.mode === 'title') for (const b of this.balls) if (b.stuck) b.x = p.x + b.off;
  }

  _collide(b) {
    if (b.x - b.r < FL) { b.x = FL + b.r; b.vx = Math.abs(b.vx); this.sfx.play('bounce', { f: 300 }); }
    if (b.x + b.r > FR) { b.x = FR - b.r; b.vx = -Math.abs(b.vx); this.sfx.play('bounce', { f: 300 }); }
    if (b.y - b.r < FT) { b.y = FT + b.r; b.vy = Math.abs(b.vy); this.sfx.play('bounce', { f: 300 }); }
    const p = this.paddle;
    if (b.vy > 0 && b.y + b.r >= PY && b.y + b.r <= PY + PH + 10 && b.x >= p.x - p.w / 2 - b.r && b.x <= p.x + p.w / 2 + b.r) {
      const rel = clamp((b.x - p.x) / (p.w / 2), -1, 1);
      const ang = rel * 1.08;
      const spd = Math.hypot(b.vx, b.vy);
      b.vx = spd * Math.sin(ang);
      b.vy = -spd * Math.cos(ang);
      b.y = PY - b.r;
      this.combo = 0;
      this.sfx.play('bounce', { f: 392 });
      this.parts.emit(b.x, PY, 6, { color: '#ffd29a', speed: 120, life: 0.3, size: 4, vy: -60 });
    }
    if (b.y - b.r > H) {
      b.dead = true;
      return;
    }
    for (const br of this.bricks) {
      if (br.dead) continue;
      const cx = clamp(b.x, br.x, br.x + br.w), cy = clamp(b.y, br.y, br.y + br.h);
      const dx = b.x - cx, dy = b.y - cy;
      if (dx * dx + dy * dy > b.r * b.r) continue;
      const ox = Math.min(b.x + b.r - br.x, br.x + br.w - (b.x - b.r));
      const oy = Math.min(b.y + b.r - br.y, br.y + br.h - (b.y - b.r));
      if (ox < oy) {
        const left = b.x < br.x + br.w / 2;
        b.vx = left ? -Math.abs(b.vx) : Math.abs(b.vx);
        b.x += left ? -ox : ox;
      } else {
        const up = b.y < br.y + br.h / 2;
        b.vy = up ? -Math.abs(b.vy) : Math.abs(b.vy);
        b.y += up ? -oy : oy;
      }
      this._hitBrick(br);
      break;
    }
  }

  _hitBrick(br) {
    br.hit = 1;
    if (br.steel) {
      this.sfx.play('steel');
      return;
    }
    br.hp--;
    this.combo++;
    this.score += 10;
    const color = this._brickColor(br);
    if (br.hp <= 0) {
      br.dead = true;
      this.score += br.max * 50 + Math.min(this.combo, 20) * 5;
      this.sfx.play('brick', { f: 480 + br.row * 50 + Math.min(this.combo, 12) * 25, minGap: 0.01 });
      this.parts.emit(br.x + br.w / 2, br.y + br.h / 2, 16, { color: [color, '#ffffff'], speed: 260, life: 0.6, size: 7, gravity: 600, drag: 1 });
      if (br.bonus || Math.random() < 0.12) {
        const k = br.bonus ? ['M', 'L', 'W'][(Math.random() * 3) | 0] : ITEM_KEYS[(Math.random() * ITEM_KEYS.length) | 0];
        this.items.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, k, dead: false });
      }
    } else {
      this.sfx.play('brick', { f: 300 + br.row * 30, minGap: 0.01 });
      this.parts.emit(br.x + br.w / 2, br.y + br.h / 2, 5, { color: '#ffffff', speed: 150, life: 0.3, size: 4 });
    }
    this.ballSpeed = Math.min(this.ballSpeed + 3.5, 820 * this.speedMul);
  }

  _applyItem(k) {
    this.score += 100;
    this.sfx.play('powerup');
    const p = this.paddle;
    this.parts.emit(p.x, PY, 20, { color: ITEMS[k].color, speed: 240, life: 0.5, size: 6, vy: -120 });
    if (k === 'W') this.wideT = 12;
    else if (k === 'S') this.slowT = 10;
    else if (k === 'L') this.laserT = 10;
    else if (k === 'P') this.lives = Math.min(9, this.lives + 1);
    else if (k === 'M') {
      const add = [];
      for (const b of this.balls) {
        if (this.balls.length + add.length >= 8) break;
        if (b.stuck) continue;
        for (const da of [-0.35, 0.35]) {
          const a = Math.atan2(b.vy, b.vx) + da;
          const s = Math.hypot(b.vx, b.vy);
          add.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: b.r, stuck: false, off: 0, trail: [], dead: false });
        }
      }
      if (!add.length) {
        const s = this.curSpeed();
        for (const a of [-0.5, 0.5]) add.push({ x: p.x, y: PY - 12, vx: Math.sin(a) * s, vy: -Math.cos(a) * s, r: 9, stuck: false, off: 0, trail: [], dead: false });
      }
      this.balls.push(...add);
    }
  }

  _brickColor(br) {
    if (br.steel) return '#9aa4b1';
    if (br.bonus) return `hsl(${(this.t * 120 + br.x) % 360},90%,62%)`;
    if (br.max >= 3) return '#f6c945';
    return ROW_COLORS[br.row % ROW_COLORS.length];
  }

  draw(c) {
    c.drawImage(this.bg, 0, 0);
    // HUD
    text(c, '打砖块', FL, 46, 32, '#ffffff', 'left', 800);
    text(c, String(this.score), W / 2, 46, 34, '#ffe08a', 'center', 800);
    text(c, `最高 ${Math.max(this.best, this.score)}`, W / 2 + 150, 48, 18, '#b9b0e8', 'left', 600);
    text(c, `第 ${this.level + 1} 关`, FR - 170, 46, 22, '#ffffff', 'right', 700);
    for (let i = 0; i < Math.min(this.lives, 6); i++) {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(FR - 140 + i * 24, 46, 8, 0, Math.PI * 2);
      c.fill();
    }
    let ix = 250;
    for (const [k, tm] of [['W', this.wideT], ['S', this.slowT], ['L', this.laserT]]) {
      if (tm <= 0) continue;
      fillRR(c, ix, 32, 70, 28, 14, ITEMS[k].color);
      text(c, `${ITEMS[k].label} ${Math.ceil(tm)}`, ix + 35, 47, 17, '#fff', 'center', 700);
      ix += 80;
    }

    // 砖块
    for (const br of this.bricks) {
      const col = this._brickColor(br);
      const x = br.x, y = br.y;
      if (br.steel) {
        const g = c.createLinearGradient(x, y, x, y + br.h);
        g.addColorStop(0, '#c9d0da');
        g.addColorStop(1, '#6f7884');
        fillRR(c, x, y, br.w, br.h, 4, g);
        c.fillStyle = 'rgba(0,0,0,0.35)';
        for (const [rx, ry] of [[6, 6], [br.w - 6, 6], [6, br.h - 6], [br.w - 6, br.h - 6]]) {
          c.beginPath();
          c.arc(x + rx, y + ry, 2.2, 0, Math.PI * 2);
          c.fill();
        }
      } else {
        fillRR(c, x, y, br.w, br.h, 5, col);
        c.fillStyle = 'rgba(255,255,255,0.32)';
        c.fillRect(x + 4, y + 3, br.w - 8, 6);
        c.fillStyle = 'rgba(0,0,0,0.18)';
        c.fillRect(x + 4, y + br.h - 6, br.w - 8, 3);
        if (br.max >= 2) strokeRR(c, x + 3, y + 3, br.w - 6, br.h - 6, 4, 'rgba(255,255,255,0.7)', 2);
        if (br.hp < br.max) {
          c.strokeStyle = 'rgba(40,20,0,0.55)';
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(x + br.w * 0.3, y + 2);
          c.lineTo(x + br.w * 0.42, y + br.h * 0.5);
          c.lineTo(x + br.w * 0.35, y + br.h - 2);
          c.moveTo(x + br.w * 0.42, y + br.h * 0.5);
          c.lineTo(x + br.w * 0.62, y + br.h * 0.42);
          c.stroke();
        }
        if (br.bonus) text(c, '★', x + br.w / 2, y + br.h / 2 + 1, 18, '#ffffff', 'center', 700);
      }
      if (br.hit > 0) {
        c.globalAlpha = br.hit * 0.7;
        fillRR(c, x, y, br.w, br.h, 5, '#ffffff');
        c.globalAlpha = 1;
      }
    }

    // 道具
    for (const it of this.items) {
      const d = ITEMS[it.k];
      fillRR(c, it.x - 24, it.y - 11, 48, 22, 11, d.color);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(it.x - 18, it.y - 8, 36, 5);
      text(c, d.label, it.x, it.y + 1, 15, '#ffffff', 'center', 800);
    }
    // 激光
    c.fillStyle = '#ff6b6b';
    for (const l of this.lasers) {
      c.fillRect(l.x - 2, l.y - 16, 4, 18);
    }

    // 挡板
    const p = this.paddle;
    const px = p.x - p.w / 2;
    fillRR(c, px, PY + 5, p.w, PH, 9, 'rgba(0,0,0,0.35)');
    const pg = c.createLinearGradient(0, PY, 0, PY + PH);
    pg.addColorStop(0, '#ffc06b');
    pg.addColorStop(1, '#ff7a1a');
    fillRR(c, px, PY, p.w, PH, 9, pg);
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fillRect(px + 12, PY + 3, p.w - 24, 4);
    if (this.laserT > 0) {
      c.fillStyle = '#ff4d4d';
      c.fillRect(px + 6, PY - 8, 8, 10);
      c.fillRect(px + p.w - 14, PY - 8, 8, 10);
    }

    // 球
    for (const b of this.balls) {
      for (let i = 0; i < b.trail.length; i += 2) {
        const a = i / b.trail.length;
        c.fillStyle = `rgba(255,220,180,${(a * 0.35).toFixed(3)})`;
        c.beginPath();
        c.arc(b.trail[i], b.trail[i + 1], b.r * (0.4 + a * 0.6), 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.beginPath();
      c.arc(b.x, b.y, b.r + 5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      c.fill();
    }
    this.parts.draw(c);

    if (this.mode === 'play' && this.balls.some((b) => b.stuck)) {
      const a = 0.6 + 0.4 * Math.sin(this.t * 5);
      c.globalAlpha = a;
      text(c, '按 A 发球', W / 2, 560, 26, '#ffffff', 'center', 700);
      c.globalAlpha = 1;
    }
    if (this.mode === 'clear') {
      const s = easeOutBack(this.modeT / 0.5);
      c.save();
      c.translate(W / 2, 400);
      c.scale(s, s);
      outlineText(c, `第 ${this.level + 1} 关 完成！`, 0, 0, 72, '#ffe08a', '#5b2fd0', 12);
      c.restore();
    }
    if (this.mode === 'title') {
      drawTitleCard(c, {
        t: this.modeT, title: '打砖块', subtitle: '接住小球，击碎所有砖块', best: this.best,
        stroke: '#5b2fd0', titleY: 330, promptY: 500,
        controls: [['STICK', '移动挡板'], ['A', '发球 / 激光'], ['PLUS', '暂停']],
      });
    } else if (this.mode === 'over') {
      drawResult(c, {
        t: this.modeT, title: '游戏结束', color: '#6a4cff', newBest: this.newBest,
        lines: [['得分', this.score], ['到达关卡', `第 ${this.level + 1} 关`], ['最高分', this.best]],
        hints: [['A', '再来一次'], ['B', '标题画面']],
      });
    }
  }
}

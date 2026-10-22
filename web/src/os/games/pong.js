// 双人乒乓：左 Joy-Con 控制左拍，右 Joy-Con 控制右拍；右边没人时 AI 接管
import { GameBase, drawTitleCard, drawResult, Particles } from './common.js';
import { W, H, clamp, damp, text, fillRR, strokeRR, axisY, outlineText, makeCanvas, easeOutBack } from '../ui.js';

const TOP = 112, BOTTOM = 684, LEFT = 50, RIGHT = 1230;
const PX_L = 96, PX_R = 1184, PW = 18, PH = 124;
const WIN = 7;
const BLUE = '#0ab9e6', RED = '#ff4b3e';

function drawPongTile(c, s) {
  const k = s / 256;
  c.save();
  c.scale(k, k);
  const g = c.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, '#0d2430');
  g.addColorStop(1, '#1a1030');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.setLineDash([8, 10]);
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(128, 10);
  c.lineTo(128, 170);
  c.stroke();
  c.setLineDash([]);
  fillRR(c, 24, 50, 14, 70, 7, BLUE);
  fillRR(c, 218, 80, 14, 70, 7, RED);
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(150, 92, 9, 0, Math.PI * 2);
  c.fill();
  text(c, '3', 90, 40, 34, BLUE, 'center', 900);
  text(c, '5', 166, 40, 34, RED, 'center', 900);
  outlineText(c, '双人乒乓', 128, 214, 42, '#ffffff', '#1d3a66', 9);
  c.restore();
}

export class Pong extends GameBase {
  static meta = { id: 'pong', name: '双人乒乓', kind: 'game', color: BLUE, tile: drawPongTile };

  constructor(os) {
    super(os);
    this.parts = new Particles(300);
    this.bg = this._makeBg();
    this.reset();
    this.setMode('title');
  }

  _makeBg() {
    const cv = makeCanvas(W, H);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0b1d27');
    g.addColorStop(1, '#170d29');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const lg = c.createLinearGradient(LEFT, 0, RIGHT, 0);
    lg.addColorStop(0, 'rgba(10,185,230,0.10)');
    lg.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    lg.addColorStop(1, 'rgba(255,75,62,0.10)');
    c.fillStyle = lg;
    c.fillRect(LEFT, TOP, RIGHT - LEFT, BOTTOM - TOP);
    strokeRR(c, LEFT, TOP, RIGHT - LEFT, BOTTOM - TOP, 14, 'rgba(255,255,255,0.35)', 3);
    c.strokeStyle = 'rgba(255,255,255,0.28)';
    c.setLineDash([14, 16]);
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(W / 2, TOP + 10);
    c.lineTo(W / 2, BOTTOM - 10);
    c.stroke();
    c.setLineDash([]);
    c.beginPath();
    c.arc(W / 2, (TOP + BOTTOM) / 2, 70, 0, Math.PI * 2);
    c.stroke();
    return cv;
  }

  reset() {
    this.left = { y: (TOP + BOTTOM) / 2, vy: 0, hit: 0 };
    this.right = { y: (TOP + BOTTOM) / 2, vy: 0, hit: 0 };
    this.score = [0, 0];
    this.ball = null;
    this.trail = [];
    this.serveT = 1.3;
    this.serveDir = Math.random() < 0.5 ? -1 : 1;
    this.rally = 0;
    this.maxRally = 0;
    this.aiRight = true;
    this.rightIdle = 99;
    this.winner = -1;
    this.flash = [0, 0];
    this.aiErr = 0;
    this.parts.clear();
  }

  start() {
    this.reset();
    this.setMode('play');
  }

  _serve() {
    const a = (Math.random() - 0.5) * 0.7;
    const sp = 520;
    this.ball = { x: W / 2, y: (TOP + BOTTOM) / 2, vx: Math.cos(a) * sp * this.serveDir, vy: Math.sin(a) * sp, r: 11, sp };
    this.trail = [];
    this.rally = 0;
    this.sfx.play('bounce', { f: 660 });
  }

  update(dt, pad) {
    this.t += dt;
    this.modeT += dt;
    this.parts.update(dt);
    this.flash[0] = Math.max(0, this.flash[0] - dt * 2);
    this.flash[1] = Math.max(0, this.flash[1] - dt * 2);
    this.left.hit = Math.max(0, this.left.hit - dt * 4);
    this.right.hit = Math.max(0, this.right.hit - dt * 4);
    if (this.mode === 'title') {
      this._paddles(dt, pad);
      if (pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      return;
    }
    if (this.mode === 'over') {
      if (this.modeT > 0.8 && pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      else if (this.modeT > 0.8 && pad.pressed.B) { this.sfx.play('back'); this.reset(); this.setMode('title'); }
      return;
    }
    this._paddles(dt, pad);
    if (!this.ball) {
      this.serveT -= dt;
      if (this.serveT <= 0) this._serve();
      return;
    }
    const b = this.ball;
    const steps = Math.max(1, Math.ceil((b.sp * dt) / 8));
    const sdt = dt / steps;
    for (let i = 0; i < steps && this.ball; i++) {
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      if (b.y - b.r < TOP) { b.y = TOP + b.r; b.vy = Math.abs(b.vy); this.sfx.play('bounce', { f: 300 }); }
      if (b.y + b.r > BOTTOM) { b.y = BOTTOM - b.r; b.vy = -Math.abs(b.vy); this.sfx.play('bounce', { f: 300 }); }
      this._hitPaddle(b, this.left, PX_L, 1);
      this._hitPaddle(b, this.right, PX_R, -1);
      if (b.x < LEFT - 20) this._point(1);
      else if (b.x > RIGHT + 20) this._point(0);
    }
    if (this.ball) {
      this.trail.push(b.x, b.y);
      if (this.trail.length > 24) this.trail.splice(0, 2);
    }
  }

  _paddles(dt, pad) {
    const sp = 640;
    // 左拍：左摇杆 / 十字键
    const ly = axisY(pad);
    const oldL = this.left.y;
    this.left.y = clamp(this.left.y - ly * sp * dt, TOP + PH / 2, BOTTOM - PH / 2);
    this.left.vy = (this.left.y - oldL) / Math.max(dt, 1e-3);
    // 右拍：右摇杆 / X（上）B（下）
    let ry = 0;
    if (pad.down.X && !pad.down.B) ry = 1;
    else if (pad.down.B && !pad.down.X) ry = -1;
    else if (Math.abs(pad.ry) > 0.2) ry = pad.ry;
    const oldR = this.right.y;
    if (ry !== 0) {
      this.rightIdle = 0;
      if (this.aiRight && this.mode === 'play') this.os.toast('玩家 2 加入：右 Joy-Con', { silent: true });
      this.aiRight = false;
      this.right.y -= ry * sp * dt;
    } else {
      this.rightIdle += dt;
      if (this.rightIdle > 4 && !this.aiRight) {
        this.aiRight = true;
        if (this.mode === 'play') this.os.toast('右拍已由 AI 接管', { silent: true });
      }
      if (this.aiRight) this._ai(dt);
    }
    this.right.y = clamp(this.right.y, TOP + PH / 2, BOTTOM - PH / 2);
    this.right.vy = (this.right.y - oldR) / Math.max(dt, 1e-3);
  }

  _ai(dt) {
    const b = this.ball;
    let target = (TOP + BOTTOM) / 2;
    if (b && b.vx > 0) {
      // 预测落点（考虑上下反弹）
      const tHit = (PX_R - b.x) / b.vx;
      let y = b.y + b.vy * tHit;
      const span = BOTTOM - TOP - 2 * b.r;
      let rel = (y - TOP - b.r) % (2 * span);
      if (rel < 0) rel += 2 * span;
      y = rel > span ? TOP + b.r + 2 * span - rel : TOP + b.r + rel;
      target = y + this.aiErr;
    } else if (b) target = damp((TOP + BOTTOM) / 2, b.y, 1, 0.3);
    const maxSp = 470 + Math.min(this.score[0], 6) * 25;
    const d = target - this.right.y;
    this.right.y += clamp(d * 8, -maxSp, maxSp) * dt;
  }

  _hitPaddle(b, p, px, dir) {
    const inX = dir > 0 ? b.vx < 0 && b.x - b.r <= px + PW / 2 && b.x + b.r >= px - PW / 2
      : b.vx > 0 && b.x + b.r >= px - PW / 2 && b.x - b.r <= px + PW / 2;
    if (!inX) return;
    if (Math.abs(b.y - p.y) > PH / 2 + b.r) return;
    const rel = clamp((b.y - p.y) / (PH / 2), -1, 1);
    b.sp = Math.min(1150, b.sp + 34);
    const ang = rel * 0.95;
    b.vx = Math.cos(ang) * b.sp * dir;
    b.vy = Math.sin(ang) * b.sp + clamp(p.vy, -900, 900) * 0.18;
    b.x = px + (PW / 2 + b.r + 1) * dir;
    p.hit = 1;
    this.rally++;
    this.maxRally = Math.max(this.maxRally, this.rally);
    this.aiErr = (Math.random() - 0.5) * (40 + this.rally * 6);
    this.sfx.play('bounce', { f: dir > 0 ? 520 : 620 });
    this.parts.emit(b.x, b.y, 10, { color: dir > 0 ? [BLUE, '#ffffff'] : [RED, '#ffffff'], speed: 220, life: 0.4, size: 5, angle: dir > 0 ? 0 : Math.PI, spread: 1.6 });
  }

  _point(who) {
    const b = this.ball;
    this.score[who]++;
    this.flash[who] = 1;
    this.parts.emit(b.x < W / 2 ? LEFT : RIGHT, clamp(b.y, TOP, BOTTOM), 36, { color: who === 0 ? [BLUE, '#ffffff'] : [RED, '#ffffff'], speed: 380, life: 0.7, size: 7, drag: 2, shape: 'circle' });
    this.ball = null;
    this.serveDir = who === 0 ? 1 : -1;
    this.serveT = 1.1;
    if (this.score[who] >= WIN) {
      this.winner = who;
      if (this.maxRally > this.best) this.submitScore(this.maxRally);
      else this.newBest = false;
      this.sfx.play('win');
      this.setMode('over');
    } else this.sfx.play('coin');
  }

  draw(c) {
    c.drawImage(this.bg, 0, 0);
    // 比分
    const sl = 1 + this.flash[0] * 0.4, sr = 1 + this.flash[1] * 0.4;
    c.save();
    c.translate(W / 2 - 120, 58);
    c.scale(sl, sl);
    text(c, String(this.score[0]), 0, 0, 64, BLUE, 'center', 900);
    c.restore();
    c.save();
    c.translate(W / 2 + 120, 58);
    c.scale(sr, sr);
    text(c, String(this.score[1]), 0, 0, 64, RED, 'center', 900);
    c.restore();
    text(c, ':', W / 2, 54, 48, 'rgba(255,255,255,0.6)', 'center', 800);
    text(c, '左 Joy-Con · 玩家 1', LEFT + 10, 58, 20, '#bdefff', 'left', 700);
    text(c, this.aiRight ? '右 Joy-Con · AI 托管' : '右 Joy-Con · 玩家 2', RIGHT - 10, 58, 20, '#ffd0cb', 'right', 700);
    text(c, `先得 ${WIN} 分获胜`, W / 2, 96, 15, 'rgba(255,255,255,0.5)', 'center', 500);

    // 球拍
    const paddle = (x, p, color) => {
      fillRR(c, x - PW / 2 - 6 - p.hit * 4, p.y - PH / 2 - 6, PW + 12 + p.hit * 8, PH + 12, 14, color === BLUE ? 'rgba(10,185,230,0.25)' : 'rgba(255,75,62,0.25)');
      fillRR(c, x - PW / 2, p.y - PH / 2, PW, PH, 9, color);
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.fillRect(x - PW / 2 + 4, p.y - PH / 2 + 10, 4, PH - 20);
    };
    paddle(PX_L, this.left, BLUE);
    paddle(PX_R, this.right, RED);

    // 球
    for (let i = 0; i < this.trail.length; i += 2) {
      const a = i / this.trail.length;
      c.fillStyle = `rgba(255,255,255,${(a * 0.3).toFixed(3)})`;
      c.beginPath();
      c.arc(this.trail[i], this.trail[i + 1], 11 * (0.3 + a * 0.7), 0, Math.PI * 2);
      c.fill();
    }
    if (this.ball) {
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.beginPath();
      c.arc(this.ball.x, this.ball.y, 17, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(this.ball.x, this.ball.y, 11, 0, Math.PI * 2);
      c.fill();
    } else if (this.mode === 'play') {
      const k = Math.ceil(this.serveT);
      text(c, k > 0 ? String(k) : '', W / 2, (TOP + BOTTOM) / 2, 56, 'rgba(255,255,255,0.8)', 'center', 900);
    }
    this.parts.draw(c);
    if (this.mode === 'play' && this.rally >= 3) {
      text(c, `连续回合 ${this.rally}`, W / 2, BOTTOM - 26, 20, 'rgba(255,255,255,0.65)', 'center', 700);
    }
    if (this.mode === 'play' && this.aiRight && this.t % 6 < 3.5) {
      text(c, '右侧玩家：推右摇杆或按 X / B 加入', W / 2, TOP + 26, 18, 'rgba(255,208,203,0.85)', 'center', 600);
    }

    if (this.mode === 'title') {
      drawTitleCard(c, {
        t: this.modeT, title: '双人乒乓', subtitle: '把两只 Joy-Con 分给朋友：左手柄 vs 右手柄', best: this.best,
        bestLabel: '最长回合', stroke: '#1d3a66', titleY: 290, promptY: 470,
        controls: [['LSTICK', '左拍'], ['DPAD', '左拍'], ['RSTICK', '右拍'], ['X', '右拍上'], ['B', '右拍下']],
      });
    } else if (this.mode === 'over') {
      const blue = this.winner === 0;
      drawResult(c, {
        t: this.modeT, title: blue ? '蓝方获胜！' : '红方获胜！', color: blue ? '#079cc2' : '#e23b2e', newBest: this.newBest,
        lines: [['比分', `${this.score[0]} : ${this.score[1]}`], ['本局最长回合', `${this.maxRally} 次`], ['历史最长回合', `${this.best} 次`]],
        hints: [['A', '再来一局'], ['B', '标题画面']],
      });
    }
  }
}

// 《茶室大乱斗》特效：命中火花、防御涟漪、烟尘、爆炸、出界击倒光柱、闪白
import { Particles } from '../common.js';

const TAU = Math.PI * 2;

export class Effects {
  constructor(m) {
    this.m = m;
    this.list = [];
    this.parts = new Particles(500);
    this.screen = [];
    this.flashA = 0;
  }

  add(e) {
    e.t = 0;
    this.list.push(e);
    if (this.list.length > 80) this.list.shift();
  }

  step() {
    const dt = 1 / 60;
    this.parts.update(dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.t++;
      if (e.vx) { e.x += e.vx * dt; e.y += (e.vy || 0) * dt; if (e.g) e.vy += e.g * dt; }
      if (e.t >= e.life) this.list.splice(i, 1);
    }
    for (let i = this.screen.length - 1; i >= 0; i--) {
      const e = this.screen[i];
      if (++e.t >= e.life) this.screen.splice(i, 1);
    }
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - 0.04);
  }

  // ———— 生成 ————
  spark(x, y, dmg, strong, color) {
    this.add({ type: 'spark', x, y, life: strong ? 20 : 12, size: 18 + dmg * 3.2, strong, color, rot: Math.random() * TAU });
    this.parts.emit(x, y, strong ? 16 : 6, { color: ['#ffffff', '#fff2a8', color], speed: strong ? 520 : 300, life: 0.35, size: strong ? 7 : 5, drag: 4 });
  }
  shieldHit(x, y, color) { this.add({ type: 'ring', x, y, life: 12, r0: 10, r1: 46, color }); }
  dust(x, y, n) { this.parts.emit(x, y - 4, n, { color: ['#d9cbb4', '#bfae94', '#ffffff'], speed: 160, life: 0.4, size: 7, drag: 3, angle: -Math.PI / 2, spread: 2.6, shape: 'circle' }); }
  jumpPuff(x, y, air) {
    if (air) this.add({ type: 'ellipse', x, y: y + 4, life: 14, r0: 10, r1: 44 });
    else this.dust(x, y, 5);
  }
  smoke(x, y) {
    for (let i = 0; i < 7; i++) this.add({ type: 'puff', x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 50, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 60, life: 26 + Math.random() * 10, r: 14 + Math.random() * 12, color: '#e8e8ef' });
  }
  steam(x, y, dir) {
    this.add({ type: 'puff', x, y: y + (Math.random() - 0.5) * 16, vx: dir * (320 + Math.random() * 160), vy: -30 - Math.random() * 50, life: 22, r: 12 + Math.random() * 10, color: '#ffffff', grow: 1.8 });
  }
  shock(x, y) { this.add({ type: 'shock', x, y, life: 22 }); this.dust(x, y, 16); }
  burst(x, y, color, n) { this.parts.emit(x, y, n, { color: [color, '#ffffff', '#9fdcff'], speed: 560, life: 0.7, size: 8, drag: 2 }); this.add({ type: 'ring', x, y, life: 18, r0: 30, r1: 120, color }); }
  boom(x, y, r) {
    this.add({ type: 'boom', x, y, life: 20, r });
    this.parts.emit(x, y, 18, { color: ['#ffcf4a', '#ff8a1c', '#ffffff', '#7a4a1e'], speed: 420, life: 0.5, size: 8, drag: 2.5 });
  }
  poof(x, y) { this.add({ type: 'puff', x, y, vx: 0.01, vy: -30, life: 16, r: 14, color: '#f4f4f4' }); }
  shards(x, y) { this.parts.emit(x, y, 12, { color: ['#ffffff', '#cfe8ff', '#5a8fd8'], speed: 360, life: 0.6, size: 6, gravity: 1200 }); }
  heal(x, y) {
    for (let i = 0; i < 6; i++) this.add({ type: 'heart', x: x + (Math.random() - 0.5) * 50, y: y + (Math.random() - 0.5) * 30, vx: 0.01, vy: -90 - Math.random() * 60, life: 40, s: 8 + Math.random() * 6 });
  }
  slash(x, y, color) { this.add({ type: 'slash', x, y, life: 14, color }); }
  decoy(x, y, color) { this.add({ type: 'decoy', x, y, vx: (Math.random() - 0.5) * 120, vy: -360, g: 1500, life: 40, color, rot: 0 }); }
  flash(a) { this.flashA = Math.max(this.flashA, a); }

  // 出界：在角色飞出的屏幕边缘炸开一束彩色光柱
  ko(f) {
    const m = this.m;
    const [sx, sy] = m.toScreen(f.x, f.cy);
    const x = Math.max(0, Math.min(1280, sx)), y = Math.max(0, Math.min(720, sy));
    const ang = Math.atan2(360 - y, 640 - x);
    this.screen.push({ type: 'ko', x, y, ang, life: 48, t: 0, color: f.color });
    this.flash(0.4);
  }

  // ———— 绘制 ————
  drawWorld(c) {
    for (const e of this.list) {
      const k = e.t / e.life;
      switch (e.type) {
        case 'spark': {
          const s = e.size * (0.5 + k * 0.9);
          c.save();
          c.translate(e.x, e.y);
          c.rotate(e.rot);
          c.globalAlpha = 1 - k;
          c.fillStyle = '#ffffff';
          c.beginPath();
          const n = e.strong ? 10 : 7;
          for (let i = 0; i < n * 2; i++) {
            const r = i % 2 ? s * 0.3 : s;
            const a = (i / (n * 2)) * TAU;
            c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          c.closePath();
          c.fill();
          if (e.strong) {
            c.strokeStyle = e.color;
            c.lineWidth = 6 * (1 - k);
            c.beginPath();
            c.arc(0, 0, s * 1.35, 0, TAU);
            c.stroke();
          }
          c.fillStyle = '#fff6b0';
          c.beginPath();
          c.arc(0, 0, s * 0.32, 0, TAU);
          c.fill();
          c.restore();
          break;
        }
        case 'ring':
          c.globalAlpha = 1 - k;
          c.strokeStyle = e.color;
          c.lineWidth = 6 * (1 - k) + 1;
          c.beginPath();
          c.arc(e.x, e.y, e.r0 + (e.r1 - e.r0) * k, 0, TAU);
          c.stroke();
          break;
        case 'ellipse':
          c.globalAlpha = 0.8 * (1 - k);
          c.strokeStyle = '#ffffff';
          c.lineWidth = 4;
          c.beginPath();
          c.ellipse(e.x, e.y, e.r0 + (e.r1 - e.r0) * k, (e.r0 + (e.r1 - e.r0) * k) * 0.3, 0, 0, TAU);
          c.stroke();
          break;
        case 'puff':
          c.globalAlpha = 0.75 * (1 - k);
          c.fillStyle = e.color;
          c.beginPath();
          c.arc(e.x, e.y, e.r * (1 + k * (e.grow || 0.6)), 0, TAU);
          c.fill();
          break;
        case 'shock':
          c.globalAlpha = 1 - k;
          c.strokeStyle = '#fff1c9';
          c.lineWidth = 8 * (1 - k) + 2;
          for (const s of [-1, 1]) {
            c.beginPath();
            c.ellipse(e.x + s * 40 * k, e.y, 30 + 130 * k, 14 + 26 * k, 0, Math.PI, TAU);
            c.stroke();
          }
          break;
        case 'boom': {
          const r = e.r * (0.4 + k * 0.9);
          c.globalAlpha = 1 - k;
          const g = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.35, '#ffd34a');
          g.addColorStop(0.7, 'rgba(255,120,30,0.8)');
          g.addColorStop(1, 'rgba(255,90,20,0)');
          c.fillStyle = g;
          c.beginPath();
          c.arc(e.x, e.y, r, 0, TAU);
          c.fill();
          break;
        }
        case 'heart': {
          c.globalAlpha = 1 - k;
          c.fillStyle = '#ff5c8a';
          const s = e.s;
          c.beginPath();
          c.moveTo(e.x, e.y + s * 0.9);
          c.bezierCurveTo(e.x - s * 1.6, e.y - s * 0.2, e.x - s * 0.6, e.y - s * 1.3, e.x, e.y - s * 0.4);
          c.bezierCurveTo(e.x + s * 0.6, e.y - s * 1.3, e.x + s * 1.6, e.y - s * 0.2, e.x, e.y + s * 0.9);
          c.fill();
          break;
        }
        case 'slash':
          c.globalAlpha = 1 - k;
          c.strokeStyle = '#ffffff';
          c.lineCap = 'round';
          c.lineWidth = 12 * (1 - k) + 2;
          c.beginPath();
          c.moveTo(e.x - 70, e.y - 50 + k * 20);
          c.lineTo(e.x + 70, e.y + 40 - k * 20);
          c.stroke();
          c.strokeStyle = e.color;
          c.lineWidth = 4;
          c.stroke();
          break;
        case 'decoy':
          e.rot += 0.2;
          c.globalAlpha = 1 - k * 0.6;
          c.save();
          c.translate(e.x, e.y);
          c.rotate(e.rot);
          c.fillStyle = e.color;
          c.beginPath();
          c.ellipse(0, 0, 22, 14, 0, 0, TAU);
          c.fill();
          c.fillStyle = '#fff8cf';
          c.beginPath();
          c.ellipse(0, 0, 15, 8, 0, 0, TAU);
          c.fill();
          c.restore();
          break;
        default:
          break;
      }
    }
    c.globalAlpha = 1;
    this.parts.draw(c);
  }

  drawScreen(c) {
    for (const e of this.screen) {
      const k = e.t / e.life;
      c.save();
      c.translate(e.x, e.y);
      c.rotate(e.ang);
      c.globalAlpha = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85;
      const len = 600 + k * 500;
      const cols = [e.color, '#ffffff', '#ffd34a', e.color];
      for (let i = 0; i < 4; i++) {
        c.fillStyle = cols[i];
        const wdt = (80 - i * 18) * (1 - k * 0.6);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(len, -wdt);
        c.lineTo(len, wdt);
        c.closePath();
        c.fill();
      }
      for (let i = 0; i < 9; i++) {
        const a = (i - 4) * 0.22;
        c.strokeStyle = i % 2 ? '#ffffff' : e.color;
        c.lineWidth = 6 * (1 - k);
        c.beginPath();
        c.moveTo(Math.cos(a) * 40, Math.sin(a) * 40);
        c.lineTo(Math.cos(a) * (300 + k * 400), Math.sin(a) * (300 + k * 400));
        c.stroke();
      }
      c.restore();
    }
    if (this.flashA > 0) {
      c.fillStyle = `rgba(255,255,255,${this.flashA.toFixed(3)})`;
      c.fillRect(0, 0, 1280, 720);
    }
  }
}

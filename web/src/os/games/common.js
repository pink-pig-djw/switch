// 游戏通用：基类、标题页、结算面板、提示行
import { W, H, clamp, text, textW, outlineText, fillRR, strokeRR, glyph, easeOutBack, easeOutCubic } from '../ui.js';

export class GameBase {
  constructor(os) {
    this.os = os;
    this.sfx = os.sfx;
    this.t = 0;
    this.mode = 'title';
    this.modeT = 0;
    const b = Number(os.store.get('best.' + this.constructor.meta.id, 0));
    this.best = Number.isFinite(b) ? b : 0;
    this.newBest = false;
  }

  setMode(m) {
    this.mode = m;
    this.modeT = 0;
  }

  submitScore(score) {
    this.newBest = false;
    if (score > this.best) {
      this.best = score;
      this.newBest = true;
      this.os.store.set('best.' + this.constructor.meta.id, score);
    }
    return this.newBest;
  }

  // 暂停菜单里的“重新开始”
  restart() {
    this.start();
  }
}

// 一行带按键图标的文字：parts 里字符串是文字，{g:'A'} 是按键图标
export function promptLine(c, parts, cx, y, size, color, glyphBg = '#ffffff', glyphFg = '#222222') {
  const r = size * 0.62;
  let total = 0;
  const widths = parts.map((p) => {
    if (typeof p === 'string') return textW(c, p, size, 600);
    const g = p.g;
    return (g === 'L' || g === 'R' ? r * 2.1 : g.length === 2 && g[0] === 'Z' ? r * 2.5 : r * 2) + 10;
  });
  for (const w of widths) total += w;
  let x = cx - total / 2;
  parts.forEach((p, i) => {
    const w = widths[i];
    if (typeof p === 'string') text(c, p, x, y, size, color, 'left', 600);
    else glyph(c, p.g, x + w / 2, y, r, glyphBg, glyphFg);
    x += w;
  });
}

// 底部操作说明：items = [['STICK','移动'], ['A','跳跃']]
export function controlsBar(c, items, y = 672, color = '#ffffff', bg = 'rgba(0,0,0,0.38)') {
  const size = 19, r = 12;
  const widths = items.map(([g, label]) => {
    const gw = g === 'L' || g === 'R' ? r * 2.1 : g.length === 2 && g[0] === 'Z' ? r * 2.5 : r * 2;
    return gw + 8 + textW(c, label, size, 500) + 30;
  });
  const total = widths.reduce((a, b) => a + b, 0) - 30;
  const x0 = W / 2 - total / 2;
  fillRR(c, x0 - 24, y - 22, total + 48, 44, 22, bg);
  let x = x0;
  items.forEach(([g, label], i) => {
    const gw = g === 'L' || g === 'R' ? r * 2.1 : g.length === 2 && g[0] === 'Z' ? r * 2.5 : r * 2;
    glyph(c, g, x + gw / 2, y, r, color, '#222');
    text(c, label, x + gw + 8, y + 1, size, color, 'left', 500);
    x += widths[i];
  });
}

// 标题页覆盖层
export function drawTitleCard(c, o) {
  const t = o.t || 0;
  const a = easeOutCubic(t / 0.5);
  c.save();
  c.globalAlpha = a;
  if (o.shade !== false) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }
  const s = easeOutBack(t / 0.6);
  c.save();
  c.translate(W / 2, o.titleY || 230);
  c.scale(s, s);
  outlineText(c, o.title, 0, 0, o.titleSize || 96, o.fill || '#ffffff', o.stroke || '#333', o.strokeW || 14);
  c.restore();
  if (o.subtitle) text(c, o.subtitle, W / 2, (o.titleY || 230) + 78, 26, o.subColor || '#ffffff', 'center', 600);
  const blink = 0.78 + 0.22 * Math.sin(t * 4);
  const py = o.promptY || 480;
  if (!o.promptColor) fillRR(c, W / 2 - 170, py - 30, 340, 60, 30, 'rgba(0,0,0,0.38)');
  c.globalAlpha = a * blink;
  const pc = o.promptColor || '#ffffff';
  promptLine(c, ['按 ', { g: 'A' }, ' 开始游戏'], W / 2, py, 30, pc, pc, o.promptColor ? '#ffffff' : '#222');
  c.globalAlpha = a;
  if (o.best != null) outlineText(c, `${o.bestLabel || '最高分'}  ${o.best}`, W / 2, py + 58, 22, o.promptColor ? o.promptColor : '#ffffff', o.promptColor ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)', 5, 'center', 700);
  if (o.extra) o.extra(c);
  if (o.controls) controlsBar(c, o.controls, o.controlsY || 664);
  c.restore();
}

// 结算面板（游戏结束 / 过关）
export function drawResult(c, o) {
  const t = o.t || 0;
  const a = easeOutCubic(t / 0.35);
  c.save();
  c.fillStyle = `rgba(0,0,0,${(0.5 * a).toFixed(3)})`;
  c.fillRect(0, 0, W, H);
  const lines = o.lines || [];
  const w = 560, h = 210 + lines.length * 52;
  const x = (W - w) / 2, y = (H - h) / 2 + (1 - a) * 40;
  c.globalAlpha = a;
  fillRR(c, x, y, w, h, 26, 'rgba(255,255,255,0.96)');
  strokeRR(c, x + 6, y + 6, w - 12, h - 12, 22, o.color || '#ff7a1a', 3);
  text(c, o.title, W / 2, y + 62, 46, o.color || '#ff7a1a', 'center', 900);
  lines.forEach(([label, value], i) => {
    const ly = y + 128 + i * 52;
    text(c, label, x + 70, ly, 26, '#666', 'left', 600);
    text(c, String(value), x + w - 70, ly, 30, '#2d2d2d', 'right', 800);
    if (i < lines.length - 1) {
      c.fillStyle = '#eee';
      c.fillRect(x + 60, ly + 26, w - 120, 2);
    }
  });
  if (o.newBest) {
    const p = 1 + 0.06 * Math.sin(t * 6);
    c.save();
    c.translate(x + w - 70, y + 34);
    c.rotate(0.18);
    c.scale(p, p);
    fillRR(c, -62, -20, 124, 40, 20, '#ff4b3e');
    text(c, '新纪录！', 0, 1, 22, '#fff', 'center', 800);
    c.restore();
  }
  if (t > 0.6) {
    const hy = y + h - 46;
    const hints = o.hints || [['A', '再来一次']];
    let total = 0;
    const ws = hints.map(([g, l]) => 34 + textW(c, l, 22, 600) + 34);
    total = ws.reduce((p, q) => p + q, 0) - 34;
    let hx = W / 2 - total / 2;
    hints.forEach(([g, l], i) => {
      glyph(c, g, hx + 14, hy, 14, '#2d2d2d', '#fff');
      text(c, l, hx + 36, hy + 1, 22, '#2d2d2d', 'left', 600);
      hx += ws[i];
    });
  }
  c.restore();
}

// 简易粒子系统
export class Particles {
  constructor(max = 400) {
    this.list = [];
    this.max = max;
  }
  emit(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = o.angle != null ? o.angle + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2) : Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 200) * (0.4 + Math.random() * 0.8);
      this.list.push({
        x, y,
        vx: Math.cos(a) * sp + (o.vx || 0),
        vy: Math.sin(a) * sp + (o.vy || 0),
        life: (o.life ?? 0.6) * (0.6 + Math.random() * 0.6),
        max: 0,
        size: (o.size ?? 4) * (0.6 + Math.random() * 0.8),
        color: Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : o.color || '#fff',
        g: o.gravity ?? 0,
        drag: o.drag ?? 0,
        shape: o.shape || 'square',
      });
      const p = this.list[this.list.length - 1];
      p.max = p.life;
    }
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) {
        L.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  draw(c, ox = 0, oy = 0) {
    for (const p of this.list) {
      const k = clamp(p.life / p.max, 0, 1);
      c.globalAlpha = k;
      c.fillStyle = p.color;
      const s = p.size * (0.4 + 0.6 * k);
      if (p.shape === 'circle') {
        c.beginPath();
        c.arc(p.x - ox, p.y - oy, s, 0, Math.PI * 2);
        c.fill();
      } else c.fillRect(p.x - ox - s / 2, p.y - oy - s / 2, s, s);
    }
    c.globalAlpha = 1;
  }
  clear() {
    this.list.length = 0;
  }
}

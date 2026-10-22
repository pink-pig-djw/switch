// 绘图与界面通用工具：主题、圆角矩形、文字、按键图标、导航重复器、缓动函数
export const W = 1280;
export const H = 720;
export const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",sans-serif';

export const THEMES = {
  light: {
    id: 'light',
    bg: '#ebebeb',
    bg2: '#f7f7f7',
    text: '#2d2d2d',
    sub: '#7d7d7d',
    line: '#cdcdcd',
    card: '#ffffff',
    iconBg: '#ffffff',
    iconFg: '#555555',
    accent: '#ff7a1a',
    accent2: '#24a88f',
    sel: '#00c3e3',
    selText: '#00a2c7',
    glyphBg: '#2d2d2d',
    glyphFg: '#ffffff',
    panel: '#f4f4f4',
    panelLine: '#dedede',
    selBg: '#e3f7fb',
    shadow: 'rgba(0,0,0,0.12)',
  },
  dark: {
    id: 'dark',
    bg: '#2b2b2d',
    bg2: '#363638',
    text: '#ffffff',
    sub: '#a5a5a9',
    line: '#4a4a4e',
    card: '#454548',
    iconBg: '#4a4a4e',
    iconFg: '#f0f0f0',
    accent: '#ff8a2e',
    accent2: '#38d0b2',
    sel: '#00c3e3',
    selText: '#1fd0f0',
    glyphBg: '#ffffff',
    glyphFg: '#2b2b2d',
    panel: '#323234',
    panelLine: '#48484c',
    selBg: '#2f4a52',
    shadow: 'rgba(0,0,0,0.35)',
  },
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInCubic = (t) => Math.pow(clamp(t, 0, 1), 3);
export const easeInOut = (t) => {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOutBack = (t) => {
  t = clamp(t, 0, 1);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export function font(size, weight = 500) {
  return `${weight} ${size}px ${FONT}`;
}

export function rrect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function fillRR(ctx, x, y, w, h, r, style) {
  rrect(ctx, x, y, w, h, r);
  ctx.fillStyle = style;
  ctx.fill();
}

export function strokeRR(ctx, x, y, w, h, r, style, lw = 2) {
  rrect(ctx, x, y, w, h, r);
  ctx.strokeStyle = style;
  ctx.lineWidth = lw;
  ctx.stroke();
}

export function text(ctx, str, x, y, size, color, align = 'left', weight = 500, baseline = 'middle') {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
}

export function textW(ctx, str, size, weight = 500) {
  ctx.font = font(size, weight);
  return ctx.measureText(str).width;
}

// 带描边的标题字（游戏标题页用）
export function outlineText(ctx, str, x, y, size, fill, stroke, lw = 8, align = 'center', weight = 900) {
  ctx.font = font(size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

// 按键图标：A/B/X/Y 圆形，+/− 圆形，L/R/ZL/ZR 圆角矩形，十字键 / 摇杆
export function glyph(ctx, name, cx, cy, r, bg = '#2d2d2d', fg = '#ffffff') {
  ctx.save();
  if (name === 'L' || name === 'R' || name === 'ZL' || name === 'ZR' || name === 'SL' || name === 'SR') {
    const w = r * (name.length > 1 ? 2.5 : 2.1), h = r * 1.6;
    fillRR(ctx, cx - w / 2, cy - h / 2, w, h, h * 0.42, bg);
    text(ctx, name, cx, cy + 1, r * 1.05, fg, 'center', 700);
  } else if (name === 'DPAD') {
    ctx.fillStyle = bg;
    const a = r * 0.42;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fg;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((i * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.78);
      ctx.lineTo(a * 0.75, -r * 0.36);
      ctx.lineTo(-a * 0.75, -r * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else if (name === 'STICK' || name === 'LSTICK' || name === 'RSTICK') {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = fg;
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
    ctx.stroke();
    if (name !== 'STICK') text(ctx, name[0], cx, cy + 1, r * 0.75, fg, 'center', 700);
  } else if (name === 'HOME') {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    drawHouse(ctx, cx, cy + r * 0.05, r * 0.95, fg);
  } else {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    const label = name === 'PLUS' ? '+' : name === 'MINUS' ? '−' : name;
    text(ctx, label, cx, cy + (label === '+' || label === '−' ? 0 : 1), r * (label.length > 1 ? 0.8 : 1.2), fg, 'center', 700);
  }
  ctx.restore();
}

export function drawHouse(ctx, cx, cy, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.55);
  ctx.lineTo(cx + s * 0.55, cy - s * 0.02);
  ctx.lineTo(cx + s * 0.38, cy - s * 0.02);
  ctx.lineTo(cx + s * 0.38, cy + s * 0.48);
  ctx.lineTo(cx + s * 0.1, cy + s * 0.48);
  ctx.lineTo(cx + s * 0.1, cy + s * 0.18);
  ctx.lineTo(cx - s * 0.1, cy + s * 0.18);
  ctx.lineTo(cx - s * 0.1, cy + s * 0.48);
  ctx.lineTo(cx - s * 0.38, cy + s * 0.48);
  ctx.lineTo(cx - s * 0.38, cy - s * 0.02);
  ctx.lineTo(cx - s * 0.55, cy - s * 0.02);
  ctx.closePath();
  ctx.fill();
}

// 右下角按键提示条：items = [['A','开始'], ['B','返回']]，从右往左排
export function drawHints(ctx, items, theme, right = 1236, y = 686, size = 21) {
  let x = right;
  const r = size * 0.62;
  for (let i = items.length - 1; i >= 0; i--) {
    const [g, label] = items[i];
    const tw = textW(ctx, label, size, 500);
    text(ctx, label, x, y, size, theme.text, 'right', 500);
    x -= tw + 8;
    const gw = g === 'L' || g === 'R' || g === 'SL' || g === 'SR' ? r * 2.1 : g.length === 2 && g[0] === 'Z' ? r * 2.5 : r * 2;
    glyph(ctx, g, x - gw / 2, y, r, theme.glyphBg, theme.glyphFg);
    x -= gw + 26;
  }
}

// 导航重复器：十字键或摇杆，按住时先等一下再连续触发
export class Nav {
  constructor(first = 0.36, rep = 0.085) {
    this.dir = null;
    this.timer = 0;
    this.first = first;
    this.rep = rep;
  }
  update(dt, pad) {
    let d = this.read(pad);
    if (this.suppress) {
      // 刚打开菜单时，之前就按住的方向不立即触发
      this.suppress = false;
      this.dir = d;
      this.timer = this.first;
      return null;
    }
    if (d !== this.dir) {
      this.dir = d;
      this.timer = this.first;
      return d;
    }
    if (!d) return null;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.rep;
      return d;
    }
    return null;
  }
  read(pad) {
    let d = null;
    if (pad.down.UP) d = 'up';
    else if (pad.down.DOWN) d = 'down';
    else if (pad.down.LEFT) d = 'left';
    else if (pad.down.RIGHT) d = 'right';
    else {
      const ax = Math.abs(pad.lx), ay = Math.abs(pad.ly);
      if (Math.max(ax, ay) > 0.55) {
        if (ax > ay) d = pad.lx > 0 ? 'right' : 'left';
        else d = pad.ly > 0 ? 'up' : 'down';
      }
    }
    return d;
  }
  reset() {
    this.suppress = true;
  }
}

// 只在“刚推到某个方向”时触发一次（2048、贪吃蛇用）
export class EdgeDir {
  constructor() {
    this.stickDir = null;
  }
  update(pad) {
    if (pad.pressed.UP) return 'up';
    if (pad.pressed.DOWN) return 'down';
    if (pad.pressed.LEFT) return 'left';
    if (pad.pressed.RIGHT) return 'right';
    const ax = Math.abs(pad.lx), ay = Math.abs(pad.ly);
    let d = null;
    if (Math.max(ax, ay) > 0.6) {
      if (ax > ay) d = pad.lx > 0 ? 'right' : 'left';
      else d = pad.ly > 0 ? 'up' : 'down';
    } else if (Math.max(ax, ay) > 0.3) {
      return null; // 处于死区边缘，保持原状态
    }
    if (d !== this.stickDir) {
      this.stickDir = d;
      return d;
    }
    return null;
  }
}

// 统一的“横向输入”：十字键优先，否则用摇杆模拟量
export function axisX(pad) {
  if (pad.down.LEFT && !pad.down.RIGHT) return -1;
  if (pad.down.RIGHT && !pad.down.LEFT) return 1;
  return Math.abs(pad.lx) > 0.2 ? pad.lx : 0;
}
export function axisY(pad) {
  if (pad.down.UP && !pad.down.DOWN) return 1;
  if (pad.down.DOWN && !pad.down.UP) return -1;
  return Math.abs(pad.ly) > 0.2 ? pad.ly : 0;
}

// 简单可复现的伪随机
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

export const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

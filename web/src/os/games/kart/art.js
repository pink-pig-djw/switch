// 《茶杯卡丁车》美术：卡丁车用几个小方块现场做 3D 投影（任意角度都能看），
// 车手是原创的水果 / 茶饮角色；路边装饰、道具、天空都是程序绘制。
import { makeCanvas, mulberry32, clamp } from '../../ui.js';

export const CHARS = [
  { id: 'orange', name: '橙子', color: '#ff8a1c', dark: '#c95f08', shirt: '#fff4e2', head: '#ff9a2e', headDark: '#e06a0c' },
  { id: 'lemon', name: '柠檬', color: '#ffd23a', dark: '#c79a10', shirt: '#4a8f3c', head: '#ffe25a', headDark: '#e0b520' },
  { id: 'grape', name: '葡萄', color: '#9a5ae0', dark: '#62309e', shirt: '#e8dcff', head: '#a467e8', headDark: '#6c34a8' },
  { id: 'matcha', name: '抹茶', color: '#58b04a', dark: '#2f7a2a', shirt: '#f4f0dc', head: '#8fcf6a', headDark: '#4f9a3e' },
  { id: 'berry', name: '蓝莓', color: '#3f63e0', dark: '#22379a', shirt: '#dde6ff', head: '#4a5fc8', headDark: '#26307a' },
  { id: 'peach', name: '桃子', color: '#ff8fa8', dark: '#d25a78', shirt: '#ffffff', head: '#ffb0b8', headDark: '#ef7f8e' },
];

function hexRgb(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
const shadeCache = new Map();
function shade(hex, k) {
  const q = Math.round(k * 20);
  const key = hex + q;
  let s = shadeCache.get(key);
  if (!s) {
    const [r, g, b] = hexRgb(hex);
    const f = q / 20;
    s = `rgb(${Math.min(255, Math.round(r * f))},${Math.min(255, Math.round(g * f))},${Math.min(255, Math.round(b * f))})`;
    shadeCache.set(key, s);
  }
  return s;
}

// —— 卡丁车模型（单位：地图像素；x 右、y 前、z 上）——
function kartBoxes(ch) {
  return [
    // [x0,x1, y0,y1, z0,z1, 颜色, 细节等级（越大越近才画）]
    [-3.4, 3.4, -4.6, 4.8, 0.9, 2.1, ch.color, 0],       // 车身底盘
    [-2.3, 2.3, 4.8, 7.2, 0.8, 1.8, ch.color, 0],        // 车头
    [-1.6, 1.6, 5.2, 6.8, 1.8, 1.95, '#ffffff', 2],      // 车头号码牌
    [-3.0, 3.0, -6.1, -4.6, 0.9, 2.7, '#3a3a40', 0],     // 发动机
    [-3.9, 3.9, -6.7, -5.4, 3.3, 3.8, ch.dark, 1],       // 尾翼
    [-2.9, -2.4, -6.1, -5.6, 2.7, 3.3, '#2a2a30', 2],    // 尾翼支架
    [2.4, 2.9, -6.1, -5.6, 2.7, 3.3, '#2a2a30', 2],
    [-1.9, 1.9, -3.6, -1.0, 2.1, 4.1, ch.dark, 1],       // 座椅
    [-1.7, 1.7, -2.4, 0.2, 2.1, 5.3, ch.shirt, 0],       // 车手身体
    [-0.9, 0.9, 1.2, 1.6, 2.8, 4.3, '#2a2a30', 2],       // 方向盘
    [3.3, 4.9, 2.4, 5.4, 0, 2.8, '#26262b', 0],          // 前轮
    [-4.9, -3.3, 2.4, 5.4, 0, 2.8, '#26262b', 0],
    [3.3, 5.3, -5.6, -2.4, 0, 3.3, '#26262b', 0],        // 后轮
    [-5.3, -3.3, -5.6, -2.4, 0, 3.3, '#26262b', 0],
    [4.9, 5.05, 3.3, 4.5, 0.9, 1.9, '#b8b8c0', 2],       // 轮毂
    [-5.05, -4.9, 3.3, 4.5, 0.9, 1.9, '#b8b8c0', 2],
    [5.3, 5.45, -4.6, -3.4, 1.1, 2.3, '#b8b8c0', 2],
    [-5.45, -5.3, -4.6, -3.4, 1.1, 2.3, '#b8b8c0', 2],
  ];
}
const BOX_CACHE = new Map();
const FACES = [
  // 法线, 顶点索引（顶点顺序：x0/x1 × y0/y1 × z0/z1，位 0=x 1=y 2=z）
  [[1, 0, 0], [1, 3, 7, 5]], [[-1, 0, 0], [0, 4, 6, 2]],
  [[0, 1, 0], [2, 6, 7, 3]], [[0, -1, 0], [0, 1, 5, 4]],
  [[0, 0, 1], [4, 5, 7, 6]], [[0, 0, -1], [0, 2, 3, 1]],
];
const LIGHT = (() => { const l = [-0.45, -0.55, 0.7]; const m = Math.hypot(...l); return l.map((v) => v / m); })();

// 复用的面池和顶点缓冲，避免每帧分配
const pool = [];
const order = [];
const vx = new Float32Array(8), vy = new Float32Array(8), vd = new Float32Array(8);
let poolN = 0;
function face() {
  if (poolN >= pool.length) pool.push({ pts: new Float32Array(8), depth: 0, color: '', kind: 0, n: 4 });
  return pool[poolN++];
}

// 画一辆车：sx,sy 地面接触点（主画布像素），s 每地图像素对应的屏幕像素，
// phi 车头相对“视线方向”的角度（0 = 背对镜头），elev 俯视角
export function drawKart(c, ch, sx, sy, s, phi, elev, o = {}) {
  if (s < 0.6) {
    // 很远：简化成色块
    c.fillStyle = ch.color;
    c.fillRect(sx - 5 * s, sy - 3 * s, 10 * s, 3 * s);
    c.fillStyle = ch.head;
    c.beginPath();
    c.arc(sx, sy - 7 * s, 2.6 * s, 0, Math.PI * 2);
    c.fill();
    return;
  }
  let boxes = BOX_CACHE.get(ch.id);
  if (!boxes) { boxes = kartBoxes(ch); BOX_CACHE.set(ch.id, boxes); }
  const lod = s > 5 ? 2 : s > 2 ? 1 : 0;
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const ce = Math.cos(elev), se = Math.sin(elev);
  const lift = o.z || 0;
  const tilt = o.tilt || 0;                 // 漂移时车身侧倾
  poolN = 0;
  for (const b of boxes) {
    if (b[7] > lod) continue;
    for (let k = 0; k < 8; k++) {
      const x = k & 1 ? b[1] : b[0];
      const y = k & 2 ? b[3] : b[2];
      let z = (k & 4 ? b[5] : b[4]) + lift;
      z += x * tilt;
      // 绕 z 轴转到视线坐标：x' 右，y' 远离镜头
      const xr = x * cp + y * sp;
      const yr = -x * sp + y * cp;
      vx[k] = sx + xr * s;
      vy[k] = sy - (yr * se + z * ce) * s;
      vd[k] = yr * ce - z * se;
    }
    for (const [nrm, idx] of FACES) {
      const nx = nrm[0] * cp + nrm[1] * sp;
      const ny = -nrm[0] * sp + nrm[1] * cp;
      const nz = nrm[2];
      // 朝向镜头的面才画（镜头前向 = (0, ce, -se)）
      if (ny * ce - nz * se >= -0.02) continue;
      const lit = 0.62 + 0.42 * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const f = face();
      f.kind = 0;
      f.n = 4;
      let dsum = 0;
      for (let q = 0; q < 4; q++) {
        const v = idx[q];
        f.pts[q * 2] = vx[v];
        f.pts[q * 2 + 1] = vy[v];
        dsum += vd[v];
      }
      f.depth = dsum / 4;
      f.color = shade(b[6], lit);
    }
  }
  // 头：一个球（深度按球心算）
  const hx = 0, hy = -1.1, hz = 7.6 + lift;
  const hxr = hx * cp + hy * sp, hyr = -hx * sp + hy * cp;
  const head = face();
  head.kind = 1;
  head.pts[0] = sx + hxr * s;
  head.pts[1] = sy - (hyr * se + hz * ce) * s;
  head.depth = hyr * ce - hz * se - 1.5;
  // 排序（远的先画）
  order.length = 0;
  for (let i = 0; i < poolN; i++) order.push(pool[i]);
  order.sort((a, b) => b.depth - a.depth);
  for (const f of order) {
    if (f.kind === 1) {
      drawHead(c, ch, f.pts[0], f.pts[1], 2.9 * s, phi, elev, o);
      continue;
    }
    c.fillStyle = f.color;
    c.beginPath();
    c.moveTo(f.pts[0], f.pts[1]);
    c.lineTo(f.pts[2], f.pts[3]);
    c.lineTo(f.pts[4], f.pts[5]);
    c.lineTo(f.pts[6], f.pts[7]);
    c.closePath();
    c.fill();
  }
}

// 车手的头：按角色画不同的水果，眼睛随朝向移动（转到背面时看不到）
function drawHead(c, ch, x, y, r, phi, elev, o) {
  const fx = Math.sin(phi), fy = Math.cos(phi);          // 脸朝向（视线坐标）
  const toward = -fy;                                     // >0 表示脸朝镜头
  c.save();
  if (ch.id === 'grape') {
    c.fillStyle = ch.headDark;
    for (const [dx, dy] of [[-0.45, 0.15], [0.45, 0.15], [0, -0.35], [-0.25, 0.55], [0.25, 0.55]]) {
      c.beginPath();
      c.arc(x + dx * r, y + dy * r, r * 0.62, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = ch.head;
    c.beginPath();
    c.arc(x, y, r * 0.92, 0, Math.PI * 2);
    c.fill();
  } else {
    const rx = ch.id === 'lemon' ? r * (1.0 + 0.16 * Math.abs(Math.cos(phi))) : r;
    c.fillStyle = ch.headDark;
    c.beginPath();
    c.ellipse(x, y + r * 0.06, rx, r, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = ch.head;
    c.beginPath();
    c.ellipse(x - r * 0.08, y - r * 0.04, rx * 0.9, r * 0.9, 0, 0, Math.PI * 2);
    c.fill();
    if (ch.id === 'lemon') {
      // 两头的小尖
      const ex = Math.cos(phi) * rx;
      c.fillStyle = ch.headDark;
      for (const sgn of [-1, 1]) {
        c.beginPath();
        c.arc(x + sgn * ex, y, r * 0.22, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (ch.id === 'peach') {
      c.strokeStyle = ch.headDark;
      c.lineWidth = Math.max(1, r * 0.1);
      c.beginPath();
      c.moveTo(x + fx * r * 0.2, y - r * 0.9);
      c.quadraticCurveTo(x + fx * r * 0.6, y - r * 0.1, x + fx * r * 0.15, y + r * 0.85);
      c.stroke();
    }
    if (ch.id === 'matcha') {
      // 头顶一圈奶泡
      c.fillStyle = '#f3f8e4';
      c.beginPath();
      c.ellipse(x, y - r * 0.62, r * 0.75, r * 0.36, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  // 高光
  c.fillStyle = 'rgba(255,255,255,0.45)';
  c.beginPath();
  c.ellipse(x - r * 0.38, y - r * 0.42, r * 0.26, r * 0.15, -0.6, 0, Math.PI * 2);
  c.fill();
  // 头顶：叶子 / 花萼
  if (ch.id === 'berry') {
    c.fillStyle = '#1a2160';
    star(c, x, y - r * 0.92, r * 0.42, r * 0.18, 5);
  } else if (ch.id !== 'matcha') {
    c.fillStyle = '#7a4a1e';
    c.fillRect(x - r * 0.08, y - r * 1.22, r * 0.16, r * 0.4);
    c.fillStyle = '#3fae4a';
    c.beginPath();
    c.ellipse(x + r * 0.35, y - r * 1.12, r * 0.42, r * 0.18, -0.5, 0, Math.PI * 2);
    c.fill();
  }
  // 眼睛和嘴
  if (toward > -0.15) {
    const k = clamp((toward + 0.15) / 0.5, 0, 1);
    const ex = fx * r * 0.55;
    const ey = y + r * 0.02 + Math.sin(elev) * r * 0.1;
    c.globalAlpha = k;
    c.fillStyle = '#2a1a12';
    const ew = r * 0.13 * (0.4 + 0.6 * Math.abs(toward));
    for (const sgn of [-1, 1]) {
      const px = x + ex + sgn * r * 0.34 * Math.abs(fy);
      c.beginPath();
      c.ellipse(px, ey, ew, r * 0.2, 0, 0, Math.PI * 2);
      c.fill();
    }
    if (o.ouch) {
      c.strokeStyle = '#2a1a12';
      c.lineWidth = Math.max(1, r * 0.09);
      c.beginPath();
      c.arc(x + ex, ey + r * 0.5, r * 0.16, 0, Math.PI * 2);
      c.stroke();
    } else {
      c.strokeStyle = '#2a1a12';
      c.lineWidth = Math.max(1, r * 0.08);
      c.beginPath();
      c.arc(x + ex, ey + r * 0.28, r * 0.2, 0.2 * Math.PI, 0.8 * Math.PI);
      c.stroke();
    }
    c.fillStyle = 'rgba(255,110,110,0.45)';
    for (const sgn of [-1, 1]) {
      c.beginPath();
      c.arc(x + ex + sgn * r * 0.55 * Math.abs(fy), ey + r * 0.3, r * 0.12, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }
  c.restore();
}

function star(c, x, y, R, r, n) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i * Math.PI) / n - Math.PI / 2;
    const rr = i % 2 ? r : R;
    if (i === 0) c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

// 角色头像（标题页 / 名次表用）
export function drawFace(c, ch, x, y, r) {
  drawHead(c, ch, x, y, r, Math.PI, 0.2, {});
}

// —— 路边装饰（预渲染，底边中点为锚点）——
function sprite(w, h, fn) {
  const cv = makeCanvas(w, h);
  fn(cv.getContext('2d'), w, h);
  return cv;
}
const DECO_SIZE = { bush: 13, teatree: 34, lantern: 14, pavilion: 42, palm: 50, umbrella: 22, rock: 12, lanternpole: 34, stall: 30, neonsign: 36 };
let decoSprites = null;
export function decoSprite(type) {
  if (!decoSprites) decoSprites = makeDecos();
  return decoSprites[type];
}
export function decoHeight(type) { return DECO_SIZE[type] || 30; }

function makeDecos() {
  const S = {};
  S.bush = sprite(96, 72, (g, w, h) => {
    g.fillStyle = '#2f7a2a';
    for (const [x, y, r] of [[26, 46, 22], [50, 38, 26], [72, 46, 21]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#4fa63e';
    for (const [x, y, r] of [[24, 40, 15], [48, 31, 18], [70, 40, 14]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffffff';
    for (const [x, y] of [[30, 30], [56, 22], [66, 38], [40, 44]]) { g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill(); }
    g.fillRect(0, h - 4, 0, 0);
  });
  S.teatree = sprite(96, 160, (g) => {
    g.fillStyle = '#6b4424';
    g.fillRect(42, 90, 12, 70);
    g.fillStyle = '#2f7a2a';
    g.beginPath(); g.arc(48, 64, 42, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4fa63e';
    g.beginPath(); g.arc(40, 54, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffb3c4';
    for (const [x, y] of [[30, 44], [62, 50], [48, 78], [70, 72], [24, 70]]) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
  });
  S.lantern = sprite(48, 96, (g) => {
    g.fillStyle = '#8c8c86';
    g.fillRect(14, 70, 20, 26);
    g.fillRect(6, 30, 36, 10);
    g.fillStyle = '#fff1b8';
    g.fillRect(12, 40, 24, 30);
    g.fillStyle = '#6f6f6a';
    g.beginPath(); g.moveTo(2, 30); g.lineTo(24, 10); g.lineTo(46, 30); g.fill();
  });
  S.pavilion = sprite(200, 200, (g) => {
    g.fillStyle = '#8a3a2a';
    g.fillRect(36, 96, 12, 100);
    g.fillRect(152, 96, 12, 100);
    g.fillStyle = '#c94a32';
    g.beginPath(); g.moveTo(0, 100); g.quadraticCurveTo(100, 70, 200, 100); g.lineTo(150, 40); g.lineTo(50, 40); g.closePath(); g.fill();
    g.fillStyle = '#e0a83a';
    g.fillRect(94, 10, 12, 32);
    g.fillStyle = '#d8c7a0';
    g.fillRect(20, 186, 160, 14);
  });
  S.palm = sprite(160, 220, (g) => {
    g.strokeStyle = '#8a5a2e';
    g.lineWidth = 12;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(80, 220); g.quadraticCurveTo(70, 130, 92, 60); g.stroke();
    g.fillStyle = '#2f9a3e';
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.55;
      g.save(); g.translate(92, 60); g.rotate(a);
      g.beginPath(); g.ellipse(36, 0, 40, 11, 0.2, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.fillStyle = '#7a4a1e';
    for (const [x, y] of [[86, 66], [98, 68], [92, 76]]) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
  });
  S.umbrella = sprite(120, 120, (g) => {
    g.fillStyle = '#ddd';
    g.fillRect(57, 40, 6, 80);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : '#ff6a3d';
      g.beginPath(); g.moveTo(60, 20);
      g.arc(60, 46, 56, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6);
      g.closePath(); g.fill();
    }
  });
  S.rock = sprite(80, 60, (g) => {
    g.fillStyle = '#8a8070';
    g.beginPath(); g.ellipse(40, 40, 36, 22, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a69c8a';
    g.beginPath(); g.ellipse(32, 32, 22, 12, -0.2, 0, Math.PI * 2); g.fill();
  });
  S.lanternpole = sprite(80, 180, (g) => {
    g.fillStyle = '#2a2230';
    g.fillRect(36, 40, 8, 140);
    g.fillRect(14, 36, 52, 6);
    for (const x of [18, 62]) {
      const gr = g.createRadialGradient(x, 64, 2, x, 64, 26);
      gr.addColorStop(0, 'rgba(255,120,60,0.8)');
      gr.addColorStop(1, 'rgba(255,60,60,0)');
      g.fillStyle = gr;
      g.fillRect(x - 26, 38, 52, 52);
      g.fillStyle = '#ff3b3b';
      g.beginPath(); g.ellipse(x, 64, 12, 16, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffd36b';
      g.fillRect(x - 6, 47, 12, 3);
      g.fillRect(x - 6, 78, 12, 3);
    }
  });
  S.stall = sprite(180, 160, (g) => {
    g.fillStyle = '#3a2c48';
    g.fillRect(10, 70, 160, 90);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#ff3fb4'; g.fillRect(4 + i * 21.5, 50, 21.5, 26); }
    g.fillStyle = '#ffd36b';
    g.fillRect(24, 96, 132, 8);
    g.fillStyle = '#fff4c8';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(34 + i * 28, 120, 8, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#25e6ff';
    g.font = '900 30px sans-serif';
    g.textAlign = 'center';
    g.fillText('茶', 90, 40);
  });
  S.neonsign = sprite(120, 190, (g) => {
    g.fillStyle = '#231a30';
    g.fillRect(56, 80, 8, 110);
    g.shadowColor = '#25e6ff';
    g.shadowBlur = 12;
    g.strokeStyle = '#25e6ff';
    g.lineWidth = 5;
    g.strokeRect(14, 10, 92, 70);
    g.shadowColor = '#ff3fb4';
    g.fillStyle = '#ff7ad0';
    g.font = '900 40px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('夜市', 60, 46);
  });
  return S;
}

// —— 道具 ——
let itemSprites = null;
export function itemSprite(name) {
  if (!itemSprites) itemSprites = makeItems();
  return itemSprites[name];
}
function makeItems() {
  const S = {};
  // 道具箱：半透明的礼盒 + 丝带
  S.box = sprite(96, 96, (g) => {
    const gr = g.createLinearGradient(0, 0, 96, 96);
    gr.addColorStop(0, 'rgba(255,214,120,0.95)');
    gr.addColorStop(0.5, 'rgba(255,140,60,0.9)');
    gr.addColorStop(1, 'rgba(255,90,140,0.9)');
    g.fillStyle = gr;
    rr(g, 8, 14, 80, 74, 14);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(42, 14, 12, 74);
    g.fillRect(8, 44, 80, 12);
    g.beginPath(); g.ellipse(36, 12, 14, 9, -0.5, 0, Math.PI * 2); g.ellipse(60, 12, 14, 9, 0.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 3;
    rr(g, 8, 14, 80, 74, 14);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(16, 22, 18, 8);
  });
  // 鲜橙汁：一杯插吸管的橙汁
  S.juice = sprite(96, 96, (g) => {
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.moveTo(22, 22); g.lineTo(74, 22); g.lineTo(66, 88); g.lineTo(30, 88); g.closePath(); g.fill();
    g.fillStyle = '#ff9a1c';
    g.beginPath(); g.moveTo(25, 36); g.lineTo(71, 36); g.lineTo(65, 84); g.lineTo(31, 84); g.closePath(); g.fill();
    g.strokeStyle = '#ff4b3e'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(56, 40); g.lineTo(66, 6); g.stroke();
    g.fillStyle = '#ffd23a';
    g.beginPath(); g.arc(28, 28, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff4d0';
    g.beginPath(); g.arc(28, 28, 8, 0, Math.PI * 2); g.fill();
  });
  // 茶叶包：丢在地上的陷阱
  S.bag = sprite(96, 96, (g) => {
    g.strokeStyle = '#d8c7a0'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(48, 20); g.lineTo(66, 4); g.stroke();
    g.fillStyle = '#ff7a1a'; g.fillRect(58, 0, 18, 12);
    g.fillStyle = '#f2e8cf';
    rr(g, 20, 20, 56, 66, 10); g.fill();
    g.fillStyle = '#5b8f3a';
    rr(g, 26, 40, 44, 40, 8); g.fill();
    g.fillStyle = '#3f6e2a';
    for (const [x, y] of [[36, 52], [52, 60], [42, 70], [60, 48]]) { g.beginPath(); g.ellipse(x, y, 6, 3, 0.6, 0, Math.PI * 2); g.fill(); }
  });
  // 红茶罐：会追前车
  S.can = sprite(96, 96, (g) => {
    g.fillStyle = '#b8262a';
    rr(g, 22, 12, 52, 76, 12); g.fill();
    g.fillStyle = '#e8463c';
    rr(g, 26, 12, 22, 76, 10); g.fill();
    g.fillStyle = '#d0d0d6';
    g.fillRect(22, 10, 52, 8);
    g.fillRect(22, 82, 52, 8);
    g.fillStyle = '#ffd36b';
    g.font = '900 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('茶', 48, 52);
  });
  // 薄荷冰霜：冻住前面所有人
  S.frost = sprite(96, 96, (g) => {
    g.strokeStyle = '#bff4ff'; g.lineWidth = 7; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      g.beginPath(); g.moveTo(48 - Math.cos(a) * 36, 48 - Math.sin(a) * 36); g.lineTo(48 + Math.cos(a) * 36, 48 + Math.sin(a) * 36); g.stroke();
    }
    g.fillStyle = '#4fd18a';
    g.beginPath(); g.ellipse(48, 48, 15, 9, -0.6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2f9a5a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(38, 56); g.lineTo(58, 40); g.stroke();
  });
  return S;
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// —— 天空 / 远景：按镜头角度现场画，任意分辨率都清楚 ——
export function makeSky(theme) {
  const rnd = mulberry32(theme.length * 999);
  const clouds = [];
  for (let i = 0; i < 14; i++) clouds.push({ a: rnd() * Math.PI * 2, h: 0.25 + rnd() * 0.55, s: 0.6 + rnd() * 0.8 });
  const builds = [];
  for (let i = 0; i < 70; i++) builds.push({ a: (i / 70) * Math.PI * 2 + rnd() * 0.05, w: 0.04 + rnd() * 0.06, h: 0.25 + rnd() * 0.75, c: rnd(), win: (rnd() * 1e6) | 0 });
  const stars = [];
  for (let i = 0; i < 90; i++) stars.push({ a: rnd() * Math.PI * 2, h: rnd(), s: rnd() });
  return { theme, clouds, builds, stars };
}

// 周期函数做的山脊（保证转一圈接得上）
function ridge(a, seed, amp) {
  return amp * (0.5 + 0.22 * Math.sin(a * 3 + seed) + 0.16 * Math.sin(a * 7 + seed * 2.1) + 0.08 * Math.sin(a * 13 + seed * 0.7) + 0.04 * Math.sin(a * 29 + seed));
}

export function drawSky(c, sky, th, camA, focal, horY, W) {
  const g = c.createLinearGradient(0, 0, 0, horY);
  g.addColorStop(0, th.skyTop);
  g.addColorStop(1, th.skyBottom);
  c.fillStyle = g;
  c.fillRect(0, 0, W, horY + 2);
  const cx = W / 2;
  const angAt = (x) => camA + Math.atan((x - cx) / focal);
  const proj = (a) => {
    let d = a - camA;
    d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    if (Math.abs(d) > 1.2) return null;
    return cx + Math.tan(d) * focal;
  };
  if (sky.theme === 'night') {
    for (const s of sky.stars) {
      const x = proj(s.a);
      if (x == null) continue;
      c.fillStyle = `rgba(255,255,255,${(0.3 + s.s * 0.6).toFixed(2)})`;
      c.fillRect(x, s.h * horY * 0.8, 2, 2);
    }
    const mx = proj(1.1);
    if (mx != null) {
      c.fillStyle = '#fff3c8';
      c.beginPath(); c.arc(mx, horY * 0.28, 26, 0, Math.PI * 2); c.fill();
      c.fillStyle = th.skyTop;
      c.beginPath(); c.arc(mx + 10, horY * 0.25, 22, 0, Math.PI * 2); c.fill();
    }
    // 城市剪影 + 霓虹窗户
    for (const b of sky.builds) {
      const x0 = proj(b.a), x1 = proj(b.a + b.w);
      if (x0 == null || x1 == null || x1 < x0) continue;
      const h = b.h * horY * 0.55;
      c.fillStyle = b.c < 0.5 ? '#1a1230' : '#22183c';
      c.fillRect(x0, horY - h, x1 - x0, h + 2);
      const rnd = mulberry32(b.win);
      for (let yy = horY - h + 6; yy < horY - 6; yy += 9) {
        for (let xx = x0 + 4; xx < x1 - 4; xx += 8) {
          if (rnd() < 0.35) {
            c.fillStyle = rnd() < 0.5 ? 'rgba(255,90,200,0.8)' : 'rgba(80,230,255,0.75)';
            c.fillRect(xx, yy, 4, 3);
          }
        }
      }
    }
    return;
  }
  // 太阳
  const sx = proj(sky.theme === 'beach' ? 2.4 : 0.6);
  if (sx != null) {
    const sy = horY * 0.3;
    const sg = c.createRadialGradient(sx, sy, 4, sx, sy, 90);
    sg.addColorStop(0, 'rgba(255,250,220,0.95)');
    sg.addColorStop(0.3, 'rgba(255,240,180,0.45)');
    sg.addColorStop(1, 'rgba(255,240,180,0)');
    c.fillStyle = sg;
    c.fillRect(sx - 90, sy - 90, 180, 180);
  }
  // 云
  for (const cl of sky.clouds) {
    const x = proj(cl.a);
    if (x == null) continue;
    const y = cl.h * horY * 0.7;
    const s = cl.s * 34;
    c.fillStyle = 'rgba(255,255,255,0.88)';
    c.beginPath();
    c.arc(x, y, s, 0, Math.PI * 2);
    c.arc(x + s * 1.1, y + s * 0.2, s * 0.8, 0, Math.PI * 2);
    c.arc(x - s * 1.1, y + s * 0.25, s * 0.7, 0, Math.PI * 2);
    c.fill();
  }
  // 远山 / 远岛
  const layers = sky.theme === 'beach'
    ? [{ seed: 1.3, amp: 0.16, col: '#7fb8d8' }, { seed: 4.1, amp: 0.1, col: '#5aa0c8' }]
    : [{ seed: 0.7, amp: 0.42, col: '#9cc8a8' }, { seed: 2.9, amp: 0.3, col: '#6faa6a' }, { seed: 5.2, amp: 0.18, col: '#4f9442' }];
  for (const L of layers) {
    c.fillStyle = L.col;
    c.beginPath();
    c.moveTo(0, horY + 2);
    for (let x = 0; x <= W; x += 16) {
      let h = ridge(angAt(x), L.seed, L.amp) * horY;
      if (sky.theme === 'beach') h = Math.max(0, h - L.amp * horY * 0.55) * 2.2;   // 只露出几座小岛
      c.lineTo(x, horY - h);
    }
    c.lineTo(W, horY + 2);
    c.closePath();
    c.fill();
  }
  if (sky.theme === 'beach') {
    // 海平线
    c.fillStyle = '#3a9fd0';
    c.fillRect(0, horY - 6, W, 8);
  }
}

// 《茶岛生活》的小岛：海岸线、河流、池塘都是解析函数，地图图片和碰撞用的是同一套函数，所以边缘严丝合缝。
import { makeCanvas, mulberry32, fillRR } from '../../ui.js';

export const WORLD_W = 2240;
export const WORLD_H = 1720;
const CX = 1120, CY = 820, RX = 960, RY = 650;

// —— 可复现的值噪声 ——
function hash(ix, iy) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// 岛屿的“半径”：< 1 是陆地，> 1 是海
// 海岸的起伏 = 几个不同频率的正弦叠加；用复数乘方代替 atan2 / sin（这个函数每像素都要算）
const K1 = [Math.cos(1), Math.sin(1)], K2 = [Math.cos(2.2), Math.sin(2.2)], K3 = [Math.cos(0.5), Math.sin(0.5)];
export function islandR(x, y) {
  const dx = (x - CX) / RX, dy = (y - CY) / RY;
  const base = Math.sqrt(dx * dx + dy * dy) || 1e-6;
  const c1 = dx / base, s1 = dy / base;
  const c2 = c1 * c1 - s1 * s1, s2 = 2 * c1 * s1;
  const c3 = c2 * c1 - s2 * s1, s3 = s2 * c1 + c2 * s1;
  const c4 = c2 * c2 - s2 * s2, s4 = 2 * c2 * s2;
  const c5 = c3 * c2 - s3 * s2, s5 = s3 * c2 + c3 * s2;
  const c9 = c5 * c4 - s5 * s4, s9 = s5 * c4 + c5 * s4;
  // sin(n·a + k) = sin(n·a)·cos k + cos(n·a)·sin k
  const wob = 1 + 0.06 * (s3 * K1[0] + c3 * K1[1]) + 0.04 * (s5 * K2[0] + c5 * K2[1]) + 0.025 * (s9 * K3[0] + c9 * K3[1]);
  return base / wob + (noise2(x / 110, y / 110) - 0.5) * 0.05;
}

// 河：泉眼 → 东海岸
const RIVER = [[1180, 250], [1150, 420], [1240, 560], [1420, 640], [1600, 720], [1780, 820], [1960, 880], [2160, 930]];
const SPRING = { x: 1180, y: 250, r: 58 };
const POND = { x: 520, y: 960, rx: 150, ry: 100 };
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  const qx = ax + vx * t - px, qy = ay + vy * t - py;
  return Math.sqrt(qx * qx + qy * qy);
}
// 到河岸的有符号距离（负数 = 在水里）
export function riverD(x, y) {
  if (x < 1050 || y < 150 || y > 1020) return 999;
  let d = 1e9;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const s = segDist(x, y, RIVER[i][0], RIVER[i][1], RIVER[i + 1][0], RIVER[i + 1][1]);
    if (s < d) d = s;
  }
  const hw = 34 + (noise2(x / 70, y / 70) - 0.5) * 12 + Math.max(0, (x - 1850) * 0.09);
  const sp = Math.hypot(x - SPRING.x, y - SPRING.y) - SPRING.r;
  return Math.min(d - hw, sp);
}
export function pondD(x, y) {
  const dx = (x - POND.x) / POND.rx, dy = (y - POND.y) / POND.ry;
  return (Math.sqrt(dx * dx + dy * dy) - 1) * 110 + (noise2(x / 50, y / 50) - 0.5) * 12;
}

// 桥和码头（旋转矩形）
function rect(cx, cy, len, wid, ang) { return { cx, cy, len, wid, ang, c: Math.cos(ang), s: Math.sin(ang) }; }
export const BRIDGES = [rect(1330, 598, 150, 64, Math.atan2(-180, 80)), rect(1795, 826, 150, 64, Math.atan2(-180, 60))];
export const PIER = { x0: 1004, x1: 1060, y0: 1380, y1: 1610 };
function inRot(r, x, y, pad = 0) {
  const dx = x - r.cx, dy = y - r.cy;
  const u = dx * r.c + dy * r.s, v = -dx * r.s + dy * r.c;
  return Math.abs(u) <= r.len / 2 + pad && Math.abs(v) <= r.wid / 2 + pad;
}
export function onDeck(x, y) {
  if (x >= PIER.x0 && x <= PIER.x1 && y >= PIER.y0 && y <= PIER.y1) return true;
  for (const b of BRIDGES) if (inRot(b, x, y)) return true;
  return false;
}

// 地面类型：'deep' 'sea' 'river' 'pond' 'sand' 'grass'
export function ground(x, y) {
  const r = islandR(x, y);
  if (r >= 1) return r > 1.27 ? 'deep' : 'sea';
  if (riverD(x, y) < 0) return 'river';
  if (pondD(x, y) < 0) return 'pond';
  const sandEdge = 0.86 + (noise2(x / 60, y / 60) - 0.5) * 0.07;
  return r > sandEdge ? 'sand' : 'grass';
}
export const isWaterType = (g) => g === 'deep' || g === 'sea' || g === 'river' || g === 'pond';

// —— 地标（世界坐标，像素）——
export const PLAZA = { x0: 820, y0: 880, x1: 1300, y1: 1110 };
export const SHOP = { x: 950, y: 880, w: 210, h: 120, door: [950, 892] };          // x,y = 底边中点
export const MUSEUM = { x: 1190, y: 880, w: 220, h: 130, door: [1190, 892] };
export const HOUSE = { x: 1500, y: 1010 };
export const HOUSE_SIZE = [[130, 80], [180, 110], [220, 130]];
export const MAILBOX = { x: 1600, y: 1030 };
export const FOUNTAIN = { x: 1060, y: 1000, r: 46 };
export const LAMPS = [[840, 905], [1282, 905], [840, 1092], [1282, 1092], [1040, 1372], [1420, 1060]];
export const SIGN = { x: 1080, y: 1378 };
const PATHS = [
  [[1300, 1000], [1380, 1020], [1440, 1040]],
  [[1032, 1110], [1032, 1250], [1032, 1390]],
  [[820, 1000], [720, 990], [665, 975]],
  [[830, 890], [760, 760], [680, 640], [620, 560]],
  [[1290, 890], [1320, 760], [1330, 650]],
  [[1330, 545], [1360, 420], [1480, 360]],
  [[1555, 1040], [1700, 1080], [1800, 1100]],
  [[1795, 880], [1800, 960], [1800, 1100]],
];

// 树、花、石头：用固定种子摆放，避开水、建筑和小路
export function buildObjects() {
  const rnd = mulberry32(20240607);
  const trees = [], flowers = [], rocks = [];
  const free = (x, y, rad) => {
    const g = ground(x, y);
    if (isWaterType(g)) return false;
    if (riverD(x, y) < rad || pondD(x, y) < rad * 0.9 || islandR(x, y) > 0.97) return false;
    if (x > PLAZA.x0 - rad && x < PLAZA.x1 + rad && y > 700 && y < PLAZA.y1 + rad) return false;
    if (Math.abs(x - HOUSE.x) < 170 && y > HOUSE.y - 190 && y < HOUSE.y + 70) return false;
    if (x > PIER.x0 - 40 && x < PIER.x1 + 40 && y > 1300) return false;
    for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) if (segDist(x, y, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]) < 26 + rad * 0.6) return false;
    for (const t of trees) if (Math.hypot(t.x - x, t.y - y) < 78) return false;
    for (const r of rocks) if (Math.hypot(r.x - x, r.y - y) < 60) return false;
    return true;
  };
  const add = (kind, x, y) => { if (free(x, y, 30)) { trees.push({ kind, x, y }); return true; } return false; };
  // 西北的森林
  for (let i = 0; i < 400 && trees.length < 30; i++) {
    const x = 260 + rnd() * 640, y = 260 + rnd() * 420;
    add(rnd() < 0.82 ? 'cedar' : 'peach', x, y);
  }
  // 果树：家门口的橙子林、东北的苹果、池塘边的桃树
  [[1660, 900], [1740, 980], [1690, 1180], [1610, 1250]].forEach(([x, y]) => add('orange', x, y));
  [[1480, 300], [1620, 400], [1700, 300], [1560, 520]].forEach(([x, y]) => add('apple', x, y));
  [[380, 820], [660, 820], [420, 1110], [700, 1120]].forEach(([x, y]) => add('peach', x, y));
  // 零散的杉树
  for (let i = 0; i < 300; i++) {
    const x = 200 + rnd() * 1850, y = 220 + rnd() * 1150;
    if (trees.length > 62) break;
    if (islandR(x, y) < 0.8 && rnd() < 0.5) add(rnd() < 0.85 ? 'cedar' : 'orange', x, y);
  }
  // 沙滩上的椰子树
  for (const a of [0.35, 0.9, 1.35, 2.0, 2.6, 3.4, 4.0, 5.5, 6.0]) {
    let lo = 0, hi = 1200;
    for (let k = 0; k < 24; k++) {
      const m = (lo + hi) / 2;
      if (islandR(CX + Math.cos(a) * m, CY + Math.sin(a) * m * (RY / RX)) < 0.93) lo = m; else hi = m;
    }
    const x = CX + Math.cos(a) * lo, y = CY + Math.sin(a) * lo * (RY / RX);
    if (!isWaterType(ground(x, y)) && !(x > PIER.x0 - 80 && x < PIER.x1 + 80 && y > 1300)) trees.push({ kind: 'palm', x, y });
  }
  // 石头
  [[300, 1100], [1930, 600], [1330, 1390], [820, 1260], [600, 420], [1880, 1200], [470, 640]].forEach(([x, y]) => {
    if (!isWaterType(ground(x, y)) && riverD(x, y) > 30) rocks.push({ x, y, s: 0.8 + rnd() * 0.5 });
  });
  // 花丛
  const palette = ['#ff5a7a', '#ffd23f', '#ffffff', '#ff9ad5', '#b58cff', '#ff7a3a'];
  const cluster = (cx, cy, n, spread) => {
    const col = palette[(rnd() * palette.length) | 0];
    for (let i = 0; i < n; i++) {
      const x = cx + (rnd() - 0.5) * spread, y = cy + (rnd() - 0.5) * spread * 0.7;
      if (!isWaterType(ground(x, y)) && riverD(x, y) > 14 && pondD(x, y) > 14 && ground(x, y) === 'grass') {
        let ok = true;
        for (const t of trees) if (Math.hypot(t.x - x, t.y - y) < 34) ok = false;
        if (ok) flowers.push({ x, y, c: rnd() < 0.8 ? col : palette[(rnd() * palette.length) | 0], ph: rnd() * 6 });
      }
    }
  };
  [[1700, 1060, 7, 120], [1860, 1020, 6, 110], [1780, 1200, 7, 120], [1950, 1100, 5, 90], [760, 1060, 6, 90],
    [880, 1180, 5, 80], [1220, 1180, 6, 100], [420, 960, 5, 80], [640, 1060, 5, 80], [1400, 1140, 5, 90],
    [1460, 760, 6, 110], [940, 640, 6, 100], [1640, 600, 5, 90], [560, 1260, 5, 90]].forEach((a) => cluster(...a));
  return { trees, flowers, rocks };
}

// 碰撞：只检查脚底一个点（主角半径交给调用方采样）
export function walkableGround(x, y) {
  if (x < 20 || y < 20 || x > WORLD_W - 20 || y > WORLD_H - 20) return false;
  if (onDeck(x, y)) return true;
  if (islandR(x, y) >= 0.995) return false;
  if (riverD(x, y) < 2 || pondD(x, y) < 2) return false;
  return true;
}

// —— 预渲染整张地图（只算一次，整个页面共用）——
let MAP = null;
export function mapCanvas() {
  if (MAP) return MAP;
  const S = 2;                                  // 先按半分辨率逐像素算颜色，再放大
  const w = WORLD_W / S, h = WORLD_H / S;
  const low = makeCanvas(w, h);
  const lc = low.getContext('2d');
  const img = lc.createImageData(w, h);
  const d = img.data;
  const mix = (a, b, t) => a + (b - a) * t;
  let i = 0;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++, i += 4) {
      const x = px * S + 1, y = py * S + 1;
      const n = noise2(x / 23, y / 23);
      const r = islandR(x, y);
      let R, G, B;
      if (r >= 1) {
        const t = Math.min(1, (r - 1) / 0.3);
        R = mix(126, 38, t); G = mix(218, 140, t); B = mix(234, 206, t);
        if (r < 1.016) { const f = 1 - (r - 1) / 0.016; R = mix(R, 236, f); G = mix(G, 250, f); B = mix(B, 252, f); }
        const k = (n - 0.5) * 10; R += k; G += k; B += k;
      } else {
        const rd = x > 1040 && y < 1040 ? riverD(x, y) : 999;
        const pd = Math.abs(x - POND.x) < 230 && Math.abs(y - POND.y) < 170 ? pondD(x, y) : 999;
        const wd = Math.min(rd, pd);
        if (wd < 0) {
          const t = Math.min(1, -wd / 30);
          R = mix(122, 70, t); G = mix(214, 176, t); B = mix(238, 222, t);
          if (wd > -4) { R = 226; G = 246; B = 250; }
          const k = (n - 0.5) * 8; R += k; G += k; B += k;
        } else {
          const sandEdge = 0.86 + (noise2(x / 60, y / 60) - 0.5) * 0.07;
          if (r > sandEdge) {
            R = 243; G = 224; B = 166;
            if (r > 0.975) { const f = (r - 0.975) / 0.025; R = mix(R, 224, f); G = mix(G, 200, f); B = mix(B, 142, f); }
            const k = (n - 0.5) * 14; R += k; G += k * 0.9; B += k * 0.7;
          } else {
            const m = noise2(x / 140, y / 140);
            const forest = x < 940 && y < 700 ? 1 : 0;
            R = mix(150, 112, m * 0.6 + forest * 0.4); G = mix(212, 186, m * 0.6 + forest * 0.4); B = mix(102, 82, m * 0.6 + forest * 0.4);
            const k = (n - 0.5) * 16; R += k * 0.6; G += k; B += k * 0.5;
            if (r > sandEdge - 0.012) { R = mix(R, 196, 0.5); G = mix(G, 206, 0.5); B = mix(B, 128, 0.5); }
          }
          if (wd < 7) { const f = 1 - wd / 7; R = mix(R, 150, f * 0.7); G = mix(G, 130, f * 0.7); B = mix(B, 92, f * 0.7); }
        }
      }
      d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = 255;
    }
  }
  lc.putImageData(img, 0, 0);
  const cv = makeCanvas(WORLD_W, WORLD_H);
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.drawImage(low, 0, 0, WORLD_W, WORLD_H);

  const rnd = mulberry32(77);
  // 小路
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const p of PATHS) {
    c.beginPath();
    c.moveTo(p[0][0], p[0][1]);
    for (let k = 1; k < p.length; k++) c.lineTo(p[k][0], p[k][1]);
    c.strokeStyle = 'rgba(170,140,90,0.55)';
    c.lineWidth = 50;
    c.stroke();
    c.strokeStyle = '#e2cd9c';
    c.lineWidth = 42;
    c.stroke();
  }
  // 草丛小细节
  for (let k = 0; k < 1300; k++) {
    const x = rnd() * WORLD_W, y = rnd() * WORLD_H;
    const g = ground(x, y);
    if (g === 'grass') {
      c.strokeStyle = rnd() < 0.5 ? 'rgba(70,140,60,0.55)' : 'rgba(190,235,140,0.6)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x - 4, y); c.lineTo(x - 2, y - 7);
      c.moveTo(x, y); c.lineTo(x + 1, y - 9);
      c.moveTo(x + 4, y); c.lineTo(x + 5, y - 6);
      c.stroke();
    } else if (g === 'sand' && rnd() < 0.5) {
      c.fillStyle = rnd() < 0.3 ? '#fff4e4' : 'rgba(190,160,110,0.5)';
      c.beginPath();
      c.arc(x, y, 1.5 + rnd() * 2, 0, Math.PI * 2);
      c.fill();
    }
  }
  // 广场石板
  fillRR(c, PLAZA.x0 - 6, PLAZA.y0 - 6, PLAZA.x1 - PLAZA.x0 + 12, PLAZA.y1 - PLAZA.y0 + 12, 46, 'rgba(150,130,100,0.5)');
  fillRR(c, PLAZA.x0, PLAZA.y0, PLAZA.x1 - PLAZA.x0, PLAZA.y1 - PLAZA.y0, 40, '#eadfc8');
  c.save();
  c.beginPath();
  c.roundRect ? c.roundRect(PLAZA.x0, PLAZA.y0, PLAZA.x1 - PLAZA.x0, PLAZA.y1 - PLAZA.y0, 40) : c.rect(PLAZA.x0, PLAZA.y0, PLAZA.x1 - PLAZA.x0, PLAZA.y1 - PLAZA.y0);
  c.clip();
  for (let yy = PLAZA.y0; yy < PLAZA.y1; yy += 32) {
    for (let xx = PLAZA.x0 + ((yy / 32) % 2) * 24; xx < PLAZA.x1; xx += 48) {
      c.fillStyle = rnd() < 0.5 ? '#e2d5ba' : '#f1e7d3';
      c.fillRect(xx + 2, yy + 2, 44, 28);
    }
  }
  c.restore();
  // 码头
  const P = PIER;
  c.fillStyle = 'rgba(30,60,90,0.25)';
  c.fillRect(P.x0 + 6, P.y0 + 10, P.x1 - P.x0, P.y1 - P.y0);
  for (let y = P.y0; y < P.y1; y += 14) {
    c.fillStyle = (y / 14) % 2 ? '#b98652' : '#c99561';
    c.fillRect(P.x0, y, P.x1 - P.x0, 13);
    c.fillStyle = 'rgba(90,55,30,0.35)';
    c.fillRect(P.x0, y + 12, P.x1 - P.x0, 1.5);
  }
  c.fillStyle = '#8a5a32';
  for (const [x, y] of [[P.x0 - 4, P.y0 + 60], [P.x1 - 4, P.y0 + 60], [P.x0 - 4, P.y0 + 150], [P.x1 - 4, P.y0 + 150], [P.x0 - 4, P.y1 - 8], [P.x1 - 4, P.y1 - 8]]) {
    fillRR(c, x, y, 9, 12, 3, '#7a4d2a');
  }
  // 桥
  for (const b of BRIDGES) {
    c.save();
    c.translate(b.cx, b.cy);
    c.rotate(b.ang);
    c.fillStyle = 'rgba(30,60,90,0.25)';
    c.fillRect(-b.len / 2 + 5, -b.wid / 2 + 8, b.len, b.wid);
    for (let u = -b.len / 2; u < b.len / 2; u += 13) {
      c.fillStyle = Math.round(u / 13) % 2 ? '#c08a56' : '#d39d66';
      c.fillRect(u, -b.wid / 2, 12, b.wid);
    }
    c.fillStyle = '#8a5a32';
    c.fillRect(-b.len / 2, -b.wid / 2 - 4, b.len, 6);
    c.fillRect(-b.len / 2, b.wid / 2 - 2, b.len, 6);
    c.restore();
  }
  MAP = cv;
  return cv;
}

// 海浪：沿海岸线均匀取点（每帧画会动的白色浪花）
export function coastPoints() {
  const pts = [];
  for (let a = 0; a < Math.PI * 2; a += 0.012) {
    let lo = 0, hi = 1300;
    for (let k = 0; k < 22; k++) {
      const m = (lo + hi) / 2;
      if (islandR(CX + Math.cos(a) * m, CY + Math.sin(a) * m * (RY / RX)) < 1) lo = m; else hi = m;
    }
    const x = CX + Math.cos(a) * lo, y = CY + Math.sin(a) * lo * (RY / RX);
    const nx = Math.cos(a) / RX, ny = Math.sin(a) / RY;
    const nl = Math.hypot(nx, ny);
    pts.push({ x, y, nx: nx / nl, ny: ny / nl, ph: a * 7 });
  }
  return pts;
}

// 水面上闪烁的波光
export function glintPoints() {
  const rnd = mulberry32(99);
  const pts = [];
  for (let k = 0; k < 2600 && pts.length < 700; k++) {
    const x = rnd() * WORLD_W, y = rnd() * WORLD_H;
    if (isWaterType(ground(x, y))) pts.push({ x, y, ph: rnd() * 6.28, s: 6 + rnd() * 10 });
  }
  return pts;
}

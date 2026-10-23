// 《茶杯卡丁车》赛道：中心线控制点 → 闭合样条 → 等距采样；再把赛道“画”成一张 1024×1024 的地面贴图
// （伪 3D 渲染时逐像素采样），附带小地图、路边装饰、加速带、道具箱的位置。全部原创。
import { makeCanvas, mulberry32 } from '../../ui.js';

export const MAP = 1024;
export const STEP = 4;            // 采样间距（地图像素）
export const CURB = 5;            // 路肩宽度
export const VERGE = 26;          // 路面外侧草地宽度，再往外是看不见的墙

// 赛道定义：pts 中心线控制点（地图像素），width 半宽，boosts [位置 0..1, 横向偏移（半宽倍数）, 长度]
export const TRACKS = [
  {
    id: 'garden', name: '茶园环道', diff: 1, width: 42, theme: 'garden', skill: 0.88,
    desc: '平缓的茶园小路，适合练习漂移',
    pts: [[190, 760], [180, 470], [250, 270], [420, 175], [610, 215], [770, 165], [900, 260], [895, 450],
      [770, 545], [610, 530], [525, 600], [555, 690], [650, 745], [665, 840], [580, 905], [330, 900]],
    boosts: [[0.075, 0, 1], [0.37, -0.45, 1], [0.66, 0.4, 1]],
    items: [0.17, 0.47, 0.8],
  },
  {
    id: 'beach', name: '橙子海滩', diff: 2, width: 44, theme: 'beach', skill: 0.95,
    desc: '海边的长弯道，冲出路面会陷进沙子',
    pts: [[170, 700], [150, 440], [260, 215], [480, 130], [710, 160], [870, 310], [850, 520], [690, 600],
      [560, 510], [420, 560], [445, 720], [630, 790], [800, 755], [915, 820], [870, 925], [610, 935], [300, 905]],
    boosts: [[0.12, 0.35, 1], [0.43, -0.4, 1], [0.72, 0, 1], [0.9, 0.35, 1]],
    items: [0.2, 0.52, 0.83],
  },
  {
    id: 'night', name: '夜市霓虹', diff: 3, width: 36, theme: 'night', skill: 0.99,
    desc: '霓虹夜市里的急弯和发夹弯，难度最高',
    pts: [[130, 860], [125, 610], [250, 545], [340, 640], [455, 610], [450, 420], [305, 380], [190, 255],
      [295, 120], [515, 135], [570, 265], [655, 280], [730, 195], [855, 140], [920, 215], [915, 330], [790, 425], [860, 570],
      [905, 765], [770, 890], [575, 815], [425, 905], [255, 915]],
    boosts: [[0.05, 0, 1], [0.3, 0.35, 1], [0.55, -0.35, 1], [0.8, 0, 1]],
    items: [0.15, 0.42, 0.68, 0.9],
  },
];

export const THEMES = {
  garden: {
    ground: '#5aa845', groundDark: '#4b953b', groundLight: '#6cba55', verge: '#7dcb61', hedge: '#2f6b2b',
    road: '#8a8781', roadNoise: 26, curbA: '#ef4a3d', curbB: '#ffffff', fog: [205, 232, 246],
    skyTop: '#5fb7f0', skyBottom: '#cfeaf8', deco: ['bush', 'bush', 'teatree', 'lantern', 'bush', 'pavilion'],
  },
  beach: {
    ground: '#2fa7d6', groundDark: '#2593c2', groundLight: '#5cc4e8', verge: '#efd796', hedge: '#fff3d6',
    road: '#8e8c92', roadNoise: 22, curbA: '#ff8a1c', curbB: '#ffffff', fog: [210, 238, 250],
    skyTop: '#3ca9ee', skyBottom: '#d8f1fb', deco: ['palm', 'palm', 'umbrella', 'palm', 'rock'],
  },
  night: {
    ground: '#1c1430', groundDark: '#160f27', groundLight: '#2c2150', verge: '#2b2046', hedge: '#ff3fb4',
    road: '#3a3552', roadNoise: 16, curbA: '#25e6ff', curbB: '#1d1733', fog: [44, 24, 72],
    skyTop: '#07051a', skyBottom: '#3b1d5c', deco: ['lanternpole', 'stall', 'lanternpole', 'neonsign', 'stall'],
  },
};

// 闭合 Catmull-Rom 样条
function spline(pts, perSeg = 40) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  return out;
}

// 按弧长等距重新采样
function resample(dense, step) {
  const L = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1], b = dense[i % dense.length];
    L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = L[L.length - 1];
  const n = Math.round(total / step);
  const xs = new Float32Array(n), ys = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = (i / n) * total;
    while (L[j + 1] < s) j++;
    const a = dense[j], b = dense[(j + 1) % dense.length];
    const k = (s - L[j]) / Math.max(1e-6, L[j + 1] - L[j]);
    xs[i] = a[0] + (b[0] - a[0]) * k;
    ys[i] = a[1] + (b[1] - a[1]) * k;
  }
  return { xs, ys, n, total };
}

function pathOf(c, T) {
  c.beginPath();
  c.moveTo(T.xs[0], T.ys[0]);
  for (let i = 1; i < T.n; i++) c.lineTo(T.xs[i], T.ys[i]);
  c.closePath();
}

function noisePattern(c, base, amp, seed, size = 64) {
  const cv = makeCanvas(size, size);
  const g = cv.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const rnd = mulberry32(seed);
  for (let i = 0; i < size * size * 0.35; i++) {
    const v = (rnd() - 0.5) * amp;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${(v / 255).toFixed(3)})` : `rgba(0,0,0,${(-v / 255).toFixed(3)})`;
    g.fillRect((rnd() * size) | 0, (rnd() * size) | 0, 1 + (rnd() < 0.2 ? 1 : 0), 1);
  }
  return c.createPattern(cv, 'repeat');
}

// 地面花纹（地图外也用它平铺）
function groundTile(theme) {
  const th = THEMES[theme];
  const S = 64;
  const cv = makeCanvas(S, S);
  const g = cv.getContext('2d');
  g.fillStyle = th.ground;
  g.fillRect(0, 0, S, S);
  const rnd = mulberry32(theme.length * 77);
  if (theme === 'garden') {
    // 一垄一垄的茶树
    for (let row = 0; row < 4; row++) {
      const y = row * 16 + 4;
      g.fillStyle = th.groundDark;
      g.fillRect(0, y, S, 9);
      for (let x = 0; x < S; x += 8) {
        g.fillStyle = th.groundLight;
        g.beginPath();
        g.arc(x + 4, y + 3, 3.2, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (theme === 'beach') {
    // 海浪
    for (let i = 0; i < 26; i++) {
      g.fillStyle = rnd() < 0.5 ? th.groundLight : th.groundDark;
      g.fillRect((rnd() * S) | 0, (rnd() * S) | 0, 6 + ((rnd() * 8) | 0), 1);
    }
  } else {
    // 霓虹地砖
    g.fillStyle = th.groundLight;
    g.fillRect(0, 0, S, 1);
    g.fillRect(0, 0, 1, S);
    g.fillRect(0, 32, S, 1);
    g.fillRect(32, 0, 1, S);
    for (let i = 0; i < 18; i++) {
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect((rnd() * S) | 0, (rnd() * S) | 0, 1, 1);
    }
  }
  return cv;
}

function readPixels(cv) {
  const g = cv.getContext('2d');
  const d = g.getImageData(0, 0, cv.width, cv.height);
  return new Uint32Array(d.data.buffer.slice(0));
}

// 2 倍降采样（远处地面用，减少闪烁）
function downsample(src, size) {
  const h = size >> 1;
  const out = new Uint32Array(h * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < h; x++) {
      const i = y * 2 * size + x * 2;
      const a = src[i], b = src[i + 1], c = src[i + size], d = src[i + size + 1];
      let r = 0, gg = 0, bb = 0;
      for (const v of [a, b, c, d]) { r += v & 255; gg += (v >>> 8) & 255; bb += (v >>> 16) & 255; }
      out[y * h + x] = 0xff000000 | ((bb >> 2) << 16) | ((gg >> 2) << 8) | (r >> 2);
    }
  }
  return out;
}

const cache = new Map();

export function buildTrack(index) {
  if (cache.has(index)) return cache.get(index);
  const def = TRACKS[index];
  const th = THEMES[def.theme];
  const { xs, ys, n, total } = resample(spline(def.pts), STEP);
  const T = { def, th, n, total, xs, ys, w: def.width };
  T.tx = new Float32Array(n); T.ty = new Float32Array(n);
  T.rx = new Float32Array(n); T.ry = new Float32Array(n);
  T.curv = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n;
    let dx = xs[b] - xs[a], dy = ys[b] - ys[a];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    T.tx[i] = dx; T.ty[i] = dy;
    T.rx[i] = -dy; T.ry[i] = dx;       // “右手边”（y 轴朝下的坐标系）
  }
  for (let i = 0; i < n; i++) {
    const b = (i + 1) % n;
    let d = Math.atan2(T.ty[b], T.tx[b]) - Math.atan2(T.ty[i], T.tx[i]);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    T.curv[i] = d;                      // 每个采样点的转角（正 = 右转）
  }

  // —— 地面贴图 ——
  const cv = makeCanvas(MAP, MAP);
  const g = cv.getContext('2d');
  const tileCv = groundTile(def.theme);
  g.fillStyle = g.createPattern(tileCv, 'repeat');
  g.fillRect(0, 0, MAP, MAP);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const W0 = def.width;
  pathOf(g, T);
  g.strokeStyle = th.hedge;
  g.lineWidth = (W0 + VERGE + 6) * 2;
  g.stroke();
  if (def.theme === 'night') {
    g.strokeStyle = 'rgba(255,63,180,0.35)';
    g.lineWidth = (W0 + VERGE + 12) * 2;
    g.stroke();
    g.strokeStyle = th.hedge;
    g.lineWidth = (W0 + VERGE + 6) * 2;
    g.stroke();
  }
  g.strokeStyle = noisePattern(g, th.verge, 30, 11);
  g.lineWidth = (W0 + VERGE) * 2;
  g.stroke();
  // 路肩：白底 + 彩色条纹
  g.strokeStyle = th.curbB;
  g.lineWidth = (W0 + CURB) * 2;
  g.stroke();
  g.strokeStyle = th.curbA;
  g.setLineDash([10, 10]);
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = noisePattern(g, th.road, th.roadNoise, 5);
  g.lineWidth = W0 * 2;
  g.stroke();
  // 夜市：路面两侧的发光细线
  if (def.theme === 'night') {
    for (const side of [-1, 1]) {
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const k = i % n;
        const x = xs[k] + T.rx[k] * side * (W0 - 4), y = ys[k] + T.ry[k] * side * (W0 - 4);
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokeStyle = side < 0 ? 'rgba(255,90,200,0.75)' : 'rgba(80,230,255,0.75)';
      g.lineWidth = 2;
      g.stroke();
    }
  } else {
    // 中央虚线
    g.beginPath();
    pathOf(g, T);
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = 2;
    g.setLineDash([14, 22]);
    g.stroke();
    g.setLineDash([]);
  }
  // 起点线：黑白格
  {
    const i = 0;
    g.save();
    g.translate(xs[i], ys[i]);
    g.rotate(Math.atan2(T.ty[i], T.tx[i]));
    const cells = 10, cw = (W0 * 2) / cells;
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < cells; k++) {
        g.fillStyle = (r + k) % 2 ? '#ffffff' : '#1d1d1d';
        g.fillRect(r * cw - cw, -W0 + k * cw, cw, cw);
      }
    }
    g.restore();
  }
  // 加速带
  T.boosts = [];
  for (const [f, off, len] of def.boosts) {
    const i0 = Math.floor(f * n);
    const nSamp = Math.round((26 * len) / STEP);
    const lat = off * W0;
    const half = 12;
    T.boosts.push({ i0, i1: (i0 + nSamp) % n, lat, half, len: nSamp });
    for (let k = 0; k < nSamp; k++) {
      const i = (i0 + k) % n;
      const x = xs[i] + T.rx[i] * lat, y = ys[i] + T.ry[i] * lat;
      g.save();
      g.translate(x, y);
      g.rotate(Math.atan2(T.ty[i], T.tx[i]));
      g.fillStyle = k % 2 ? '#ffb020' : '#ff7a1a';
      g.fillRect(-STEP / 2 - 0.5, -half, STEP + 1, half * 2);
      g.restore();
    }
    // 白色箭头
    for (let k = 1; k < nSamp - 1; k += 2) {
      const i = (i0 + k) % n;
      const x = xs[i] + T.rx[i] * lat, y = ys[i] + T.ry[i] * lat;
      g.save();
      g.translate(x, y);
      g.rotate(Math.atan2(T.ty[i], T.tx[i]));
      g.strokeStyle = '#fff6d8';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-3, -half + 3);
      g.lineTo(3, 0);
      g.lineTo(-3, half - 3);
      g.stroke();
      g.restore();
    }
  }

  T.tex = readPixels(cv);
  T.mip1 = downsample(T.tex, MAP);
  T.mip2 = downsample(T.mip1, MAP >> 1);
  T.tile = readPixels(tileCv);
  // 地平线雾色（ABGR）
  T.fog = th.fog;

  // —— 道具箱 ——
  T.itemRows = def.items.map((f) => {
    const i = Math.floor(f * n);
    return [-0.6, -0.2, 0.2, 0.6].map((o) => ({ x: xs[i] + T.rx[i] * o * W0, y: ys[i] + T.ry[i] * o * W0, i }));
  });

  // —— 路边装饰（不能落在别的路段上）——
  const rnd = mulberry32(index * 131 + 7);
  T.decos = [];
  const clearOf = (x, y, r) => {
    for (let k = 0; k < n; k += 2) {
      const dx = x - xs[k], dy = y - ys[k];
      if (dx * dx + dy * dy < r * r) return false;
    }
    return true;
  };
  const decoTypes = th.deco;
  for (let i = 0; i < n; i += 7) {
    for (const side of [-1, 1]) {
      if (rnd() < 0.25) continue;
      const d = W0 + VERGE + 14 + rnd() * 34;
      const x = xs[i] + T.rx[i] * d * side, y = ys[i] + T.ry[i] * d * side;
      if (x < 8 || y < 8 || x > MAP - 8 || y > MAP - 8) continue;
      if (!clearOf(x, y, W0 + VERGE + 10)) continue;
      T.decos.push({ x, y, type: decoTypes[(rnd() * decoTypes.length) | 0], s: 0.85 + rnd() * 0.4 });
    }
  }
  // 远一点的零散装饰，让场景不空
  for (let k = 0; k < 90; k++) {
    const x = 20 + rnd() * (MAP - 40), y = 20 + rnd() * (MAP - 40);
    if (!clearOf(x, y, W0 + VERGE + 40)) continue;
    T.decos.push({ x, y, type: decoTypes[(rnd() * decoTypes.length) | 0], s: 1 + rnd() * 0.6 });
  }

  // —— 小地图 ——
  const M = 200;
  const mini = makeCanvas(M, M);
  const mg = mini.getContext('2d');
  mg.scale(M / MAP, M / MAP);
  mg.lineJoin = 'round';
  pathOf(mg, T);
  mg.strokeStyle = 'rgba(0,0,0,0.55)';
  mg.lineWidth = W0 * 2 + 34;
  mg.stroke();
  mg.strokeStyle = '#ffffff';
  mg.lineWidth = W0 * 2 - 6;
  mg.stroke();
  mg.save();
  mg.translate(xs[0], ys[0]);
  mg.rotate(Math.atan2(T.ty[0], T.tx[0]));
  mg.fillStyle = '#ff7a1a';
  mg.fillRect(-8, -W0 - 6, 16, W0 * 2 + 12);
  mg.restore();
  T.mini = mini;
  T.miniSize = M;

  cache.set(index, T);
  return T;
}

// 在 hint 附近找最近的中心线采样点；返回 [索引, 横向偏移（右为正）]
export function locate(T, x, y, hint) {
  const n = T.n;
  let best = hint, bd = Infinity;
  for (let k = -14; k <= 14; k++) {
    const i = (hint + k + n) % n;
    const dx = x - T.xs[i], dy = y - T.ys[i];
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = i; }
  }
  // 离开搜索窗口边缘时再往前 / 往后走几步
  for (let guard = 0; guard < 40; guard++) {
    const a = (best + 1) % n, b = (best - 1 + n) % n;
    const da = (x - T.xs[a]) ** 2 + (y - T.ys[a]) ** 2;
    const db = (x - T.xs[b]) ** 2 + (y - T.ys[b]) ** 2;
    if (da < bd) { best = a; bd = da; } else if (db < bd) { best = b; bd = db; } else break;
  }
  const lat = (x - T.xs[best]) * T.rx[best] + (y - T.ys[best]) * T.ry[best];
  return [best, lat];
}

// 全局最近点（只在初始化 / 重置时用）
export function locateGlobal(T, x, y) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < T.n; i++) {
    const d = (x - T.xs[i]) ** 2 + (y - T.ys[i]) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// 《茶室大乱斗》美术：程序绘制的 4 名原创角色、3 个场地、背景、道具、飞行道具
import { makeCanvas, mulberry32 } from '../../ui.js';

const PI = Math.PI, TAU = PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - (1 - t) * (1 - t);

// 颜色加深 / 提亮
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const WHITE = new Proxy({}, { get: () => '#ffffff' });

export function paletteFor(id, tint) {
  switch (id) {
    case 'orange': return { main: tint, dark: shade(tint, -0.25), light: shade(tint, 0.35), limb: '#3d6b2f', glove: '#ffffff', cape: '#2f6fe0', capeDark: '#2152a8', leaf: '#4caf50', eye: '#2b1b0e' };
    case 'bear': return { main: tint, dark: shade(tint, -0.28), light: shade(tint, 0.3), belly: '#f3e1c0', lid: '#f6efe0', rim: '#5b8fd8', eye: '#20140a', nose: '#2b1b0e' };
    case 'ninja': return { main: tint, dark: shade(tint, -0.2), light: shade(tint, 0.4), limb: '#24304a', band: '#e53935', eye: '#111111' };
    default: return { main: tint, dark: shade(tint, -0.25), light: shade(tint, 0.35), belly: '#fff3dc', inner: '#ffb3c6', whisk: '#d8b26a', eye: '#1a1a1a' };
  }
}

// ———————————————— 姿势 ————————————————
const P = { armF: 1.25, armB: 1.9, legF: 1.45, legB: 1.7, lean: 0, bob: 0, crouch: 0, spin: 0, ext: 1, extL: 1, face: 'normal', rise: false };

function phase(mv) {
  const d = mv.def, t = mv.t;
  if (t <= d.startup) return { k: d.startup ? t / d.startup : 1, ph: 0 };
  if (t <= d.startup + d.active) return { k: 1, ph: 1 };
  return { k: Math.max(0, 1 - (t - d.startup - d.active) / Math.max(1, d.recovery)), ph: 2 };
}

export function computePose(f) {
  const t = f.anim, st = f.state;
  P.armF = 1.25 + Math.sin(t * 0.08) * 0.08;
  P.armB = 1.9 - Math.sin(t * 0.08) * 0.08;
  P.legF = 1.45; P.legB = 1.7;
  P.lean = 0; P.bob = Math.sin(t * 0.1) * 1.5; P.crouch = 0; P.spin = 0; P.ext = 1; P.extL = 1; P.face = 'normal'; P.rise = false;
  switch (st) {
    case 'run': {
      const ph = t * 0.36;
      P.legF = PI / 2 + 0.8 * Math.sin(ph);
      P.legB = PI / 2 - 0.8 * Math.sin(ph);
      P.armF = PI / 2 - 0.9 * Math.sin(ph);
      P.armB = PI / 2 + 0.9 * Math.sin(ph);
      P.lean = 0.16;
      P.bob = -Math.abs(Math.sin(ph)) * 4;
      break;
    }
    case 'squat': P.crouch = 0.4; break;
    case 'land': P.crouch = 0.3 * Math.max(0, 1 - f.stateT / Math.max(1, f.lag)); break;
    case 'air': case 'helpless': case 'respawn':
      if (f.vy < 0 && st !== 'respawn') { P.legF = 0.9; P.legB = 2.1; P.armF = -0.5; P.armB = 3.6; P.rise = true; }
      else { P.legF = 1.35; P.legB = 1.85; P.armF = 0.3; P.armB = 2.8; }
      if (st === 'helpless') { P.face = 'tired'; P.armF = -1.0; P.armB = -2.2; }
      break;
    case 'charge': {
      const k = Math.min(1, f.charge / 20);
      P.armF = lerp(1.2, PI - 0.25, k);
      P.lean = -0.15 * k;
      P.crouch = 0.2 * k;
      P.bob = (Math.random() - 0.5) * 2 * Math.min(1, f.charge / 30);
      P.face = 'angry';
      if (f.chargeKey === 'usmash') { P.armF = 1.6; P.armB = 1.6; P.crouch = 0.35; }
      if (f.chargeKey === 'dsmash') { P.legF = 1.2; P.legB = 1.9; P.crouch = 0.3; }
      break;
    }
    case 'shield': P.crouch = 0.15; P.armF = 0.45; P.armB = 0.8; break;
    case 'roll': P.spin = (f.stateT / 24) * TAU * (f.rollDir === f.dir ? 1 : -1); P.crouch = 0.3; break;
    case 'spot': P.lean = -0.15; P.crouch = 0.2; break;
    case 'adodge': P.spin = (f.stateT / 30) * TAU * 0.5; break;
    case 'hitstun': case 'grabbed':
      P.armF = -2.1 + Math.sin(t * 0.6) * 0.35;
      P.armB = -1.0 + Math.cos(t * 0.6) * 0.35;
      P.legF = 0.9; P.legB = 2.2;
      P.face = 'hurt';
      P.spin = f.spin;
      break;
    case 'ledge': P.armF = -PI / 2 + 0.25; P.armB = -PI / 2 - 0.1; P.legF = 1.5; P.legB = 1.75; P.lean = 0.05; break;
    case 'climb': P.crouch = 0.4; P.armF = -0.6; break;
    case 'dizzy': P.lean = Math.sin(t * 0.15) * 0.25; P.face = 'dizzy'; P.armF = 1.6; P.armB = 1.6; break;
    case 'grabbing': P.armF = 0.05; P.armB = 0.2; P.ext = 1.25; break;
    case 'move': {
      const mv = f.move, d = mv.def;
      const { k, ph } = phase(mv);
      const e = ph === 0 ? ease(k) * 0.2 : k;
      if (d.boxes || d.proj || d.throw) P.face = 'angry';
      switch (d.pose) {
        case 'punch':
          P.armF = ph === 0 ? lerp(1.25, PI - 0.5, k) : lerp(1.25, 0, k);
          P.ext = 1 + 0.4 * (ph === 0 ? 0 : k);
          P.lean = 0.12 * k;
          break;
        case 'kick':
          P.legF = lerp(1.45, 0.05, ph === 0 ? k * 0.3 : k);
          P.extL = 1 + 0.35 * (ph === 0 ? 0 : k);
          P.lean = -0.22 * k;
          P.armF = lerp(1.25, 2.4, k);
          break;
        case 'uppercut':
          P.armF = lerp(1.3, -PI / 2 + 0.2, ph === 0 ? k * 0.2 : k);
          P.ext = 1 + 0.35 * (ph === 0 ? 0 : k);
          P.lean = -0.1 * k;
          break;
        case 'lowkick':
          P.crouch = 0.45 * Math.max(k, ph === 2 ? k : 0.5);
          P.legF = lerp(1.4, 0.2, ph === 0 ? 0 : k);
          P.extL = 1 + 0.4 * (ph === 0 ? 0 : k);
          break;
        case 'dash':
          P.lean = 0.42 * Math.max(0.4, k);
          P.armF = lerp(1.3, 0.1, k);
          P.ext = 1 + 0.25 * k;
          P.legB = 2.5; P.legF = 1.0;
          break;
        case 'spin': {
          const span = d.startup + d.active;
          P.spin = Math.min(1, mv.t / span) * TAU * (d.multi ? 3 : 1.5);
          P.armF = 0.1; P.armB = PI - 0.1; P.ext = 1.2;
          P.legF = 1.1; P.legB = 2.0;
          break;
        }
        case 'back':
          P.legB = lerp(1.8, PI - 0.05, ph === 0 ? k * 0.3 : k);
          P.extL = 1 + 0.35 * (ph === 0 ? 0 : k);
          P.lean = 0.25 * k;
          break;
        case 'stomp':
          P.legF = lerp(1.45, PI / 2 - 0.08, k); P.legB = lerp(1.7, PI / 2 + 0.08, k);
          P.extL = 1 + 0.3 * k;
          P.armF = -1.2; P.armB = -1.9;
          break;
        case 'smash':
          if (ph === 0) { P.armF = PI - 0.25; P.lean = -0.15; P.crouch = 0.2; }
          else { P.armF = lerp(1.2, -0.05, k); P.ext = 1 + 0.6 * k; P.lean = 0.3 * k; }
          break;
        case 'usmash':
          P.armF = lerp(1.4, -PI / 2 + 0.25, ph === 0 ? 0 : k);
          P.armB = lerp(1.7, -PI / 2 - 0.25, ph === 0 ? 0 : k);
          P.ext = 1 + 0.35 * (ph === 0 ? 0 : k);
          P.crouch = ph === 0 ? 0.35 * k : 0;
          break;
        case 'split':
          P.legF = lerp(1.45, 0.2, k); P.legB = lerp(1.7, PI - 0.2, k);
          P.extL = 1 + 0.3 * k;
          P.crouch = 0.4 * k;
          P.armF = 0.6; P.armB = 2.5;
          break;
        case 'grab':
          P.armF = lerp(1.2, 0.05, k); P.armB = lerp(1.8, 0.2, k); P.ext = 1 + 0.3 * k;
          break;
        case 'throwP':
          P.armF = ph === 0 ? lerp(1.25, -2.2, k) : lerp(-2.2, 0.1, Math.min(1, (mv.t - d.startup) / 4 + 0.5));
          P.ext = 1.2;
          P.lean = ph === 0 ? -0.1 : 0.15;
          break;
        case 'shield':
          P.crouch = 0.25; P.armF = 0.4; P.armB = 0.9; P.face = 'angry';
          break;
        default: break;
      }
      void e;
      break;
    }
    default: break;
  }
  return P;
}

function limb(c, x, y, ang, len, w, col) {
  const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
  c.strokeStyle = col;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(ex, ey);
  c.stroke();
  return [ex, ey];
}

function eyes(c, x1, x2, y, r, p, mode, col) {
  if (mode === 'hurt') {
    c.strokeStyle = col;
    c.lineWidth = 2.6;
    for (const x of [x1, x2]) {
      c.beginPath();
      c.moveTo(x - r * 0.7, y - r * 0.7); c.lineTo(x + r * 0.7, y + r * 0.7);
      c.moveTo(x + r * 0.7, y - r * 0.7); c.lineTo(x - r * 0.7, y + r * 0.7);
      c.stroke();
    }
    return;
  }
  if (mode === 'dizzy') {
    c.strokeStyle = col;
    c.lineWidth = 2;
    for (const x of [x1, x2]) { c.beginPath(); c.arc(x, y, r * 0.8, 0, PI * 1.6); c.stroke(); }
    return;
  }
  c.fillStyle = p.white || '#ffffff';
  for (const x of [x1, x2]) { c.beginPath(); c.ellipse(x, y, r * 0.85, r, 0, 0, TAU); c.fill(); }
  c.fillStyle = col;
  const lid = mode === 'tired' ? 0.4 : 1;
  for (const x of [x1, x2]) { c.beginPath(); c.ellipse(x + r * 0.25, y + (1 - lid) * r * 0.4, r * 0.45, r * 0.55 * lid, 0, 0, TAU); c.fill(); }
  if (mode === 'angry') {
    c.strokeStyle = col;
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(x1 - r, y - r * 1.5); c.lineTo(x1 + r, y - r * 1.0);
    c.moveTo(x2 - r, y - r * 1.0); c.lineTo(x2 + r, y - r * 1.5);
    c.stroke();
  }
}

// ———————————————— 四名角色（本地坐标：脚底为原点、朝右） ————————————————
const DRAW = {
  orange(c, P, p, f) {
    const by = -52 + P.crouch * 12 + P.bob, hy = -26 + P.crouch * 10;
    const t = f ? f.anim : 0;
    // 披风
    const wave = Math.sin(t * 0.25) * 5 + (P.lean > 0.1 ? 8 : 0);
    c.fillStyle = p.cape;
    c.beginPath();
    c.moveTo(-6, by - 22);
    c.quadraticCurveTo(-36, by - 4 + wave * 0.5, -34 - wave, by + 24);
    c.lineTo(-14, by + 16);
    c.quadraticCurveTo(-8, by, -2, by - 14);
    c.closePath();
    c.fill();
    const [lbx, lby] = limb(c, -6, hy, P.legB, 26 * P.extL, 9, p.limb);
    c.fillStyle = p.dark; c.beginPath(); c.ellipse(lbx + 3, lby, 8, 5, 0, 0, TAU); c.fill();
    const [abx, aby] = limb(c, -9, by + 2, P.armB, 22, 8, p.limb);
    c.fillStyle = p.glove; c.beginPath(); c.arc(abx, aby, 6, 0, TAU); c.fill();
    const [lfx, lfy] = limb(c, 6, hy, P.legF, 26 * P.extL, 9, p.limb);
    c.fillStyle = p.dark; c.beginPath(); c.ellipse(lfx + 3, lfy, 8, 5, 0, 0, TAU); c.fill();
    // 身体
    c.fillStyle = p.main;
    c.beginPath(); c.arc(0, by, 30, 0, TAU); c.fill();
    c.fillStyle = p.dark;
    c.globalAlpha *= 0.35;
    c.beginPath(); c.arc(4, by + 6, 26, 0.2, PI - 0.3); c.fill();
    c.globalAlpha /= 0.35;
    c.fillStyle = p.light;
    c.beginPath(); c.ellipse(-11, by - 13, 9, 6, -0.6, 0, TAU); c.fill();
    c.fillStyle = p.dark;
    for (const [dx, dy] of [[-14, 6], [-4, 18], [8, -18], [-18, -6], [2, 8]]) { c.beginPath(); c.arc(dx, by + dy, 1.4, 0, TAU); c.fill(); }
    // 叶子
    c.fillStyle = '#7a4a1e'; c.fillRect(-2, by - 36, 4, 9);
    c.fillStyle = p.leaf;
    c.beginPath(); c.ellipse(9, by - 36, 10, 5, -0.5, 0, TAU); c.fill();
    // 围巾（英雄感）
    c.fillStyle = p.capeDark;
    c.beginPath(); c.ellipse(2, by - 22, 16, 5, 0, 0, TAU); c.fill();
    eyes(c, 11, 22, by - 4, 6, p, P.face, p.eye);
    c.strokeStyle = p.eye; c.lineWidth = 2;
    c.beginPath();
    if (P.face === 'hurt' || P.face === 'dizzy') c.arc(18, by + 13, 4, PI + 0.3, TAU - 0.3);
    else c.arc(17, by + 9, 4, 0.2, PI - 0.2);
    c.stroke();
    const [afx, afy] = limb(c, 8, by + 4, P.armF, 22 * P.ext, 8, p.limb);
    c.fillStyle = p.glove; c.beginPath(); c.arc(afx, afy, 7, 0, TAU); c.fill();
    return [afx, afy];
  },

  bear(c, P, p, f) {
    const by = -56 + P.crouch * 14 + P.bob, hy = -28 + P.crouch * 12, head = by - 40;
    const [lbx, lby] = limb(c, -12, hy, P.legB, 26 * P.extL, 15, p.dark);
    c.fillStyle = p.dark; c.beginPath(); c.ellipse(lbx + 4, lby, 12, 7, 0, 0, TAU); c.fill();
    const [abx, aby] = limb(c, -16, by - 12, P.armB, 30, 14, p.dark);
    c.fillStyle = p.dark; c.beginPath(); c.arc(abx, aby, 10, 0, TAU); c.fill();
    const [lfx, lfy] = limb(c, 12, hy, P.legF, 26 * P.extL, 15, p.dark);
    c.fillStyle = p.dark; c.beginPath(); c.ellipse(lfx + 4, lfy, 12, 7, 0, 0, TAU); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.ellipse(0, by, 34, 37, 0, 0, TAU); c.fill();
    c.fillStyle = p.belly;
    c.beginPath(); c.ellipse(8, by + 5, 22, 26, 0, 0, TAU); c.fill();
    // 肚子上的小茶壶图案
    c.strokeStyle = p.rim; c.lineWidth = 2.5;
    c.beginPath(); c.arc(8, by + 8, 8, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(16, by + 6); c.lineTo(22, by + 1); c.stroke();
    c.beginPath(); c.arc(0, by + 8, 4, PI * 0.5, PI * 1.5); c.stroke();
    // 头
    c.fillStyle = p.main;
    for (const ex of [-12, 22]) { c.beginPath(); c.arc(ex, head - 19, 10, 0, TAU); c.fill(); }
    c.fillStyle = p.belly;
    for (const ex of [-12, 22]) { c.beginPath(); c.arc(ex, head - 19, 5, 0, TAU); c.fill(); }
    c.fillStyle = p.main;
    c.beginPath(); c.arc(6, head, 25, 0, TAU); c.fill();
    c.fillStyle = p.belly;
    c.beginPath(); c.ellipse(21, head + 9, 13, 10, 0, 0, TAU); c.fill();
    c.fillStyle = p.nose;
    c.beginPath(); c.ellipse(29, head + 4, 5, 4, 0, 0, TAU); c.fill();
    eyes(c, 9, 21, head - 5, 4.6, p, P.face, p.eye);
    // 壶盖帽
    c.fillStyle = p.lid;
    c.beginPath(); c.ellipse(5, head - 22, 21, 6, 0, 0, TAU); c.fill();
    c.beginPath(); c.arc(5, head - 23, 13, PI, TAU); c.fill();
    c.fillStyle = p.rim;
    c.fillRect(-16, head - 24, 42, 3);
    c.beginPath(); c.arc(5, head - 37, 4.5, 0, TAU); c.fill();
    const [afx, afy] = limb(c, 14, by - 12, P.armF, 30 * P.ext, 14, p.dark);
    c.fillStyle = p.dark; c.beginPath(); c.arc(afx, afy, 11, 0, TAU); c.fill();
    void f;
    return [afx, afy];
  },

  ninja(c, P, p, f) {
    const by = -50 + P.crouch * 10 + P.bob, hy = -26 + P.crouch * 9;
    const t = f ? f.anim : 0;
    // 头带飘带
    c.strokeStyle = p.band; c.lineWidth = 5; c.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      c.beginPath();
      c.moveTo(-18, by - 18);
      for (let i = 1; i <= 5; i++) c.lineTo(-18 - i * 7, by - 18 + i * (3 + k * 3) + Math.sin(t * 0.3 + i + k) * 3);
      c.stroke();
    }
    const [lbx, lby] = limb(c, -6, hy, P.legB, 24 * P.extL, 8, p.limb);
    c.fillStyle = p.limb; c.beginPath(); c.ellipse(lbx + 3, lby, 7, 4, 0, 0, TAU); c.fill();
    limb(c, -8, by + 2, P.armB, 22, 7, p.limb);
    const [lfx, lfy] = limb(c, 6, hy, P.legF, 24 * P.extL, 8, p.limb);
    c.fillStyle = p.limb; c.beginPath(); c.ellipse(lfx + 3, lfy, 7, 4, 0, 0, TAU); c.fill();
    // 柠檬身体
    c.fillStyle = p.main;
    c.beginPath(); c.ellipse(0, by, 24, 31, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(0, by - 31, 5, 5, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(0, by + 31, 5, 4, 0, 0, TAU); c.fill();
    c.fillStyle = p.light;
    c.beginPath(); c.ellipse(-9, by - 12, 6, 10, -0.3, 0, TAU); c.fill();
    c.fillStyle = p.dark;
    for (const [dx, dy] of [[-12, 8], [6, 18], [-4, 22], [12, -20]]) { c.beginPath(); c.arc(dx, by + dy, 1.3, 0, TAU); c.fill(); }
    // 面罩 + 头带
    c.fillStyle = p.limb;
    c.beginPath(); c.ellipse(4, by - 7, 22, 8, 0, 0, TAU); c.fill();
    c.fillStyle = p.band;
    c.fillRect(-22, by - 22, 44, 6);
    eyes(c, 9, 19, by - 7, 4, p, P.face === 'normal' ? 'angry' : P.face, p.eye);
    const [afx, afy] = limb(c, 8, by + 3, P.armF, 22 * P.ext, 7, p.limb);
    if (f && f.state === 'move' && f.move.def.boxes) {
      c.fillStyle = '#d7dde8';
      c.beginPath(); c.moveTo(afx, afy - 4); c.lineTo(afx + 16, afy); c.lineTo(afx, afy + 4); c.closePath(); c.fill();
    }
    return [afx, afy];
  },

  rabbit(c, P, p, f) {
    const by = -38 + P.crouch * 10 + P.bob, hy = -18 + P.crouch * 8, head = by - 32;
    const t = f ? f.anim : 0;
    const flop = P.rise ? 0.35 : Math.sin(t * 0.12) * 0.05;
    // 耳朵
    for (const [ex, rot] of [[-4, -0.3 + flop], [8, -0.12 + flop * 0.6]]) {
      c.save();
      c.translate(ex, head - 14);
      c.rotate(rot);
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(0, -22, 7, 24, 0, 0, TAU); c.fill();
      c.fillStyle = p.inner;
      c.beginPath(); c.ellipse(1, -20, 3.5, 17, 0, 0, TAU); c.fill();
      c.restore();
    }
    const [lbx, lby] = limb(c, -7, hy, P.legB, 18 * P.extL, 10, p.dark);
    c.fillStyle = p.belly; c.beginPath(); c.ellipse(lbx + 5, lby, 12, 6, 0, 0, TAU); c.fill();
    limb(c, -9, by - 4, P.armB, 18, 8, p.dark);
    const [lfx, lfy] = limb(c, 7, hy, P.legF, 18 * P.extL, 10, p.dark);
    c.fillStyle = p.belly; c.beginPath(); c.ellipse(lfx + 5, lfy, 12, 6, 0, 0, TAU); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.ellipse(0, by, 23, 24, 0, 0, TAU); c.fill();
    c.fillStyle = p.belly;
    c.beginPath(); c.ellipse(6, by + 4, 14, 16, 0, 0, TAU); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.arc(4, head, 21, 0, TAU); c.fill();
    c.fillStyle = p.light;
    c.beginPath(); c.ellipse(-6, head - 9, 6, 4, -0.5, 0, TAU); c.fill();
    c.fillStyle = p.inner;
    c.beginPath(); c.arc(18, head + 8, 4, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(24, head + 2, 3, 2.4, 0, 0, TAU); c.fill();
    eyes(c, 10, 20, head - 2, 4.4, p, P.face, p.eye);
    const [afx, afy] = limb(c, 8, by - 4, P.armF, 18 * P.ext, 8, p.dark);
    // 茶筅
    c.save();
    c.translate(afx, afy);
    c.rotate(P.armF - PI / 2);
    c.fillStyle = p.whisk;
    c.fillRect(-2, -2, 4, 14);
    c.beginPath(); c.moveTo(-6, 12); c.lineTo(6, 12); c.lineTo(3, 24); c.lineTo(-3, 24); c.closePath(); c.fill();
    c.restore();
    return [afx, afy];
  },
};

export function drawFighter(c, f, opts = {}) {
  if (!f.alive || f.hidden) return;
  const pal = (f._pal ||= paletteFor(f.ch.id, f.tint));
  const P = computePose(f);
  const s = f.h / ({ orange: 92, bear: 112, ninja: 84, rabbit: 96 }[f.ch.id]);
  // 击飞拖尾
  if (f.trail.length >= 4) {
    c.strokeStyle = f.color;
    c.lineCap = 'round';
    for (let i = 2; i < f.trail.length; i += 2) {
      const k = i / f.trail.length;
      c.globalAlpha = k * 0.5;
      c.lineWidth = 4 + k * 16;
      c.beginPath();
      c.moveTo(f.trail[i - 2], f.trail[i - 1]);
      c.lineTo(f.trail[i], f.trail[i + 1]);
      c.stroke();
    }
    c.globalAlpha = 1;
  }
  const blink = f.invuln > 0 && (f.state === 'respawn' || f.state === 'ledge' || f.state === 'adodge' || f.state === 'roll' || f.state === 'spot') && Math.floor(f.anim / 3) % 2 === 0;
  c.save();
  c.translate(f.x, f.y);
  c.scale(f.dir, 1);
  if (P.spin) { c.translate(0, -f.h / 2); c.rotate(P.spin); c.translate(0, f.h / 2); }
  if (P.lean) { c.translate(0, -f.h * 0.3); c.rotate(P.lean); c.translate(0, f.h * 0.3); }
  c.scale(s, s);
  if (blink) c.globalAlpha = 0.55;
  if (f.state === 'helpless') c.globalAlpha *= 0.85;
  const hand = DRAW[f.ch.id](c, P, pal, f);
  if (f.item && hand) drawCup(c, hand[0] + 6, hand[1] - 4, 0.8, 0);
  if (f.flash > 0) {
    c.globalAlpha = Math.min(1, f.flash / 5) * 0.85;
    DRAW[f.ch.id](c, P, WHITE, f);
  }
  c.restore();
  c.globalAlpha = 1;
  // 防御罩
  if (f.state === 'shield') {
    const r = f.h * 0.62 * (0.35 + 0.65 * Math.max(0, f.shield) / 60);
    c.fillStyle = f.color;
    c.globalAlpha = 0.28 + (f.shieldStun > 0 ? 0.2 : 0);
    c.beginPath(); c.arc(f.x, f.cy, r, 0, TAU); c.fill();
    c.globalAlpha = 0.8;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    c.beginPath(); c.arc(f.x, f.cy, r, 0, TAU); c.stroke();
    c.globalAlpha = 1;
  }
  // 头顶的眩晕星星
  if (f.state === 'dizzy') {
    for (let i = 0; i < 3; i++) {
      const a = f.anim * 0.12 + (i * TAU) / 3;
      star(c, f.x + Math.cos(a) * 26, f.top - 12 + Math.sin(a) * 7, 7, '#ffd34a');
    }
  }
  // 蓄力光
  if (f.state === 'charge' && f.charge % 10 < 5) {
    c.globalAlpha = 0.5;
    star(c, f.x + f.dir * f.w * 0.6, f.cy - 10, 10 + f.charge * 0.15, '#fff6b0');
    c.globalAlpha = 1;
  }
  // 玩家标记
  if (!opts.noTag) {
    const tx = f.x, ty = f.top - 22;
    c.fillStyle = f.color;
    c.beginPath(); c.moveTo(tx - 9, ty - 8); c.lineTo(tx + 9, ty - 8); c.lineTo(tx, ty + 3); c.closePath(); c.fill();
    c.font = '800 16px "PingFang SC","Microsoft YaHei",sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(0,0,0,0.55)';
    c.strokeText(f.tag, tx, ty - 20);
    c.fillStyle = f.color;
    c.fillText(f.tag, tx, ty - 20);
  }
}

// 选人界面 / 头像用的静态角色
const FAKE = { anim: 0, state: 'idle', vy: 0, stateT: 0 };
export function drawCharStatic(c, ch, tint, x, y, scale, t = 0, dir = 1, pose = 'idle') {
  FAKE.anim = t;
  FAKE.state = pose;
  FAKE.vy = 0;
  FAKE.ch = ch;
  FAKE.charge = 30;
  FAKE.chargeKey = 'fsmash';
  const pal = paletteFor(ch.id, tint);
  const P = computePose(FAKE);
  const s = scale * (ch.h / ({ orange: 92, bear: 112, ninja: 84, rabbit: 96 }[ch.id]));
  c.save();
  c.translate(x, y);
  c.scale(dir * s, s);
  DRAW[ch.id](c, P, pal, FAKE);
  c.restore();
}

export function star(c, x, y, r, col) {
  c.fillStyle = col;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -PI / 2 + (i * PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

// ———————————————— 道具 / 飞行道具 ————————————————
export function drawCup(c, x, y, s, rot) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(s, s);
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.moveTo(-14, -12); c.lineTo(14, -12); c.lineTo(10, 10); c.quadraticCurveTo(0, 16, -10, 10); c.closePath();
  c.fill();
  c.strokeStyle = '#ffffff'; c.lineWidth = 4;
  c.beginPath(); c.arc(15, -2, 6, -PI / 2, PI / 2); c.stroke();
  c.fillStyle = '#3f78c8';
  c.fillRect(-13, -6, 26, 4);
  c.fillStyle = '#8bc34a';
  c.beginPath(); c.ellipse(0, -12, 14, 3, 0, 0, TAU); c.fill();
  c.restore();
}

function drawSnack(c, x, y, t) {
  c.save();
  c.translate(x, y + Math.sin(t * 0.1) * 2);
  c.strokeStyle = '#c99a5b'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(0, 14); c.lineTo(0, -40); c.stroke();
  for (const [yy, col] of [[-30, '#ffb3c6'], [-16, '#ffffff'], [-2, '#9ccc65']]) {
    c.fillStyle = col;
    c.beginPath(); c.arc(0, yy, 8, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 1.5; c.stroke();
  }
  c.restore();
}

export function drawItem(c, it) {
  const blink = it.life < 120 && Math.floor(it.t / 5) % 2 === 0;
  if (blink) c.globalAlpha = 0.4;
  if (!it.ground) {
    // 小降落伞
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(it.x - 18, it.y - 50); c.lineTo(it.x, it.y - 14); c.lineTo(it.x + 18, it.y - 50); c.stroke();
    c.fillStyle = '#ff7a1a';
    c.beginPath(); c.arc(it.x, it.y - 50, 20, PI, TAU); c.fill();
  }
  if (it.type === 'cup') drawCup(c, it.x, it.y - 12, 1, 0);
  else drawSnack(c, it.x, it.y - 14, it.t);
  c.globalAlpha = 1;
}

export function drawProj(c, p) {
  c.save();
  c.translate(p.x, p.y);
  switch (p.kind) {
    case 'slice':
      c.rotate(p.spin);
      c.fillStyle = '#ff8a1c'; c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.fill();
      c.fillStyle = '#fff3d6'; c.beginPath(); c.arc(0, 0, 15, 0, TAU); c.fill();
      c.fillStyle = '#ffb347';
      for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 13, (i * TAU) / 8 + 0.06, ((i + 1) * TAU) / 8 - 0.06); c.closePath(); c.fill(); }
      break;
    case 'star':
      c.rotate(p.spin * 2);
      c.fillStyle = '#c9d2e0';
      c.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i * PI) / 4, r = i % 2 ? 5 : 15; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fill();
      c.fillStyle = '#f5c400'; c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill();
      break;
    case 'leaf':
      c.rotate(Math.atan2(p.vy, p.vx));
      c.fillStyle = '#5d9b2c'; c.beginPath(); c.ellipse(0, 0, 18, 9, 0, 0, TAU); c.fill();
      c.strokeStyle = '#c5e1a5'; c.lineWidth = 2; c.beginPath(); c.moveTo(-14, 0); c.lineTo(14, 0); c.stroke();
      break;
    case 'whisk':
      c.rotate(p.spin * 1.5);
      c.fillStyle = '#d8b26a';
      c.fillRect(-3, -20, 6, 16);
      c.beginPath(); c.moveTo(-10, -4); c.lineTo(10, -4); c.lineTo(6, 18); c.lineTo(-6, 18); c.closePath(); c.fill();
      c.strokeStyle = '#a8813f'; c.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 3, -2); c.lineTo(i * 2, 16); c.stroke(); }
      break;
    case 'cup':
      c.restore();
      drawCup(c, p.x, p.y, 1, p.spin);
      return;
    default: break;
  }
  c.restore();
}

export function drawMine(c, m) {
  c.fillStyle = '#5d7d3a';
  c.beginPath(); c.ellipse(m.x, m.y - 6, 16, 9, 0, 0, TAU); c.fill();
  c.fillStyle = '#7cb342';
  c.beginPath(); c.arc(m.x, m.y - 12, 9, PI, TAU); c.fill();
  const on = m.t > 30 && Math.floor(m.t / 12) % 2 === 0;
  c.fillStyle = on ? '#ff3b30' : '#7a2a24';
  c.beginPath(); c.arc(m.x, m.y - 20, 3.5, 0, TAU); c.fill();
}

export function drawSaucer(c, x, y, t) {
  const g = 0.5 + 0.5 * Math.sin(t * 0.15);
  c.fillStyle = `rgba(255,214,90,${(0.25 + g * 0.2).toFixed(3)})`;
  c.beginPath(); c.ellipse(x, y + 6, 70, 20, 0, 0, TAU); c.fill();
  c.fillStyle = '#f4ecdc';
  c.beginPath(); c.ellipse(x, y + 4, 56, 12, 0, 0, TAU); c.fill();
  c.strokeStyle = '#d4a63a'; c.lineWidth = 3;
  c.beginPath(); c.ellipse(x, y + 4, 56, 12, 0, 0, TAU); c.stroke();
}

// ———————————————— 场地 ————————————————
// 远景背景（固定 1280×720）+ 中景（随镜头视差）
export function makeBackdrop(stage) {
  const far = makeCanvas(1280, 720);
  const c = far.getContext('2d');
  const rnd = mulberry32(stage.id.length * 97 + 13);
  const mid = makeCanvas(2400, 720);
  const m = mid.getContext('2d');
  if (stage.id === 'roof') {
    const g = c.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, '#0b1430'); g.addColorStop(0.6, '#26285a'); g.addColorStop(1, '#4b3a6b');
    c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
    for (let i = 0; i < 140; i++) {
      c.fillStyle = `rgba(255,255,255,${(0.3 + rnd() * 0.7).toFixed(2)})`;
      const s = rnd() < 0.1 ? 2.4 : 1.3;
      c.fillRect(rnd() * 1280, rnd() * 430, s, s);
    }
    const mg = c.createRadialGradient(1010, 150, 30, 1010, 150, 200);
    mg.addColorStop(0, 'rgba(255,240,200,0.55)'); mg.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = mg; c.fillRect(780, 0, 460, 380);
    c.fillStyle = '#fff3d1'; c.beginPath(); c.arc(1010, 150, 62, 0, TAU); c.fill();
    c.fillStyle = 'rgba(220,200,160,0.35)';
    for (const [dx, dy, r] of [[-18, -10, 12], [14, 18, 9], [20, -20, 6]]) { c.beginPath(); c.arc(1010 + dx, 150 + dy, r, 0, TAU); c.fill(); }
    // 中景：远山 + 塔影 + 屋顶剪影
    const ridge = (y0, amp, col, seed) => {
      const r2 = mulberry32(seed);
      m.fillStyle = col;
      m.beginPath(); m.moveTo(0, 720);
      for (let x = 0; x <= 2400; x += 60) m.lineTo(x, y0 - r2() * amp - Math.sin(x / 300) * amp * 0.5);
      m.lineTo(2400, 720); m.closePath(); m.fill();
    };
    ridge(470, 120, '#2a2752', 3);
    for (let i = 0; i < 9; i++) {
      const x = 120 + i * 270 + rnd() * 80, h = 90 + rnd() * 80;
      m.fillStyle = '#1d1c3d';
      m.fillRect(x - 6, 560 - h, 12, h);
      for (let k = 0; k < 4; k++) {
        const w = 70 - k * 12, y = 560 - h + k * (h / 4);
        m.beginPath(); m.moveTo(x - w / 2, y + 12); m.quadraticCurveTo(x, y - 8, x + w / 2, y + 12); m.lineTo(x + w / 2 - 6, y + 16); m.lineTo(x - w / 2 + 6, y + 16); m.closePath(); m.fill();
      }
    }
    ridge(600, 40, '#171631', 9);
    for (let i = 0; i < 40; i++) {
      m.fillStyle = `rgba(255,190,90,${(0.4 + rnd() * 0.5).toFixed(2)})`;
      m.fillRect(rnd() * 2400, 600 + rnd() * 100, 3, 3);
    }
  } else if (stage.id === 'tray') {
    const g = c.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, '#5b3f8c'); g.addColorStop(0.45, '#e9748a'); g.addColorStop(0.75, '#ffb36b'); g.addColorStop(1, '#ffd89a');
    c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
    const sg = c.createRadialGradient(640, 560, 40, 640, 560, 380);
    sg.addColorStop(0, 'rgba(255,245,200,0.9)'); sg.addColorStop(0.25, 'rgba(255,220,140,0.5)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = sg; c.fillRect(0, 160, 1280, 560);
    c.fillStyle = '#fff2c4'; c.beginPath(); c.arc(640, 560, 80, 0, TAU); c.fill();
    const cloud = (ctx, x, y, s, col) => {
      ctx.fillStyle = col;
      for (const [dx, dy, r] of [[0, 0, 40], [40, -14, 34], [80, 0, 38], [-36, 8, 28], [116, 10, 26]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU); ctx.fill(); }
    };
    for (let i = 0; i < 12; i++) cloud(m, rnd() * 2400, 120 + rnd() * 260, 0.6 + rnd() * 0.8, 'rgba(255,214,222,0.55)');
    for (let i = 0; i < 14; i++) cloud(m, rnd() * 2400, 520 + rnd() * 160, 1 + rnd() * 1.2, 'rgba(255,240,235,0.85)');
    m.strokeStyle = 'rgba(80,50,90,0.6)'; m.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const x = rnd() * 2400, y = 160 + rnd() * 200;
      m.beginPath(); m.moveTo(x - 8, y - 3); m.quadraticCurveTo(x - 4, y - 7, x, y); m.quadraticCurveTo(x + 4, y - 7, x + 8, y - 3); m.stroke();
    }
  } else {
    const g = c.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, '#dff0e4'); g.addColorStop(0.7, '#f3f8ea'); g.addColorStop(1, '#e4efd5');
    c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
    const sg = c.createRadialGradient(300, 120, 20, 300, 120, 420);
    sg.addColorStop(0, 'rgba(255,255,230,0.9)'); sg.addColorStop(1, 'rgba(255,255,230,0)');
    c.fillStyle = sg; c.fillRect(0, 0, 900, 600);
    const bamboo = (x, w, col, joint) => {
      m.fillStyle = col;
      m.fillRect(x, 0, w, 720);
      m.fillStyle = joint;
      for (let y = 40 + rnd() * 80; y < 720; y += 90 + rnd() * 40) m.fillRect(x - 1, y, w + 2, 4);
    };
    for (let i = 0; i < 34; i++) bamboo(rnd() * 2400, 10 + rnd() * 8, 'rgba(150,190,140,0.45)', 'rgba(120,160,110,0.5)');
    for (let i = 0; i < 18; i++) bamboo(rnd() * 2400, 18 + rnd() * 10, 'rgba(96,150,88,0.75)', 'rgba(70,120,64,0.8)');
    m.fillStyle = 'rgba(80,140,70,0.6)';
    for (let i = 0; i < 60; i++) {
      const x = rnd() * 2400, y = rnd() * 500;
      m.save(); m.translate(x, y); m.rotate(rnd() * PI);
      m.beginPath(); m.ellipse(0, 0, 18, 4, 0, 0, TAU); m.fill(); m.restore();
    }
    const fog = m.createLinearGradient(0, 480, 0, 720);
    fog.addColorStop(0, 'rgba(240,248,235,0)'); fog.addColorStop(1, 'rgba(240,248,235,0.9)');
    m.fillStyle = fog; m.fillRect(0, 480, 2400, 240);
  }
  // 远景 + 中景合成一张稍大的图，对战时整体随镜头轻微平移（视差），每帧只画一次
  const img = makeCanvas(BACK_W, BACK_H);
  const ic = img.getContext('2d');
  ic.drawImage(far, 0, 0, BACK_W, BACK_H);
  ic.drawImage(mid, (2400 - BACK_W) / 2, 0, BACK_W, 720, 0, BACK_H - 720, BACK_W, 720);
  return { far, img };
}
export const BACK_W = 1540, BACK_H = 760;

// 主平台：预先画到离屏画布上（2 倍分辨率）
export function makeStageArt(stage) {
  const M = stage.main;
  const pad = 160, top = 140, bottom = M.depth + 220;
  const w = M.x2 - M.x1 + pad * 2, h = top + bottom;
  const cv = makeCanvas(w * 2, h * 2);
  const c = cv.getContext('2d');
  c.scale(2, 2);
  c.translate(pad - M.x1, top - M.y);
  const rnd = mulberry32(7);
  const L = M.x1, R = M.x2, D = M.depth;
  if (stage.id === 'roof') {
    // 墙体（往下渐隐）
    const wg = c.createLinearGradient(0, 70, 0, D + 200);
    wg.addColorStop(0, '#6d4630'); wg.addColorStop(1, 'rgba(60,38,28,0)');
    c.fillStyle = wg;
    c.fillRect(L + 60, 70, R - L - 120, D + 130);
    c.fillStyle = 'rgba(255,214,140,0.85)';
    for (let x = L + 100; x < R - 120; x += 120) c.fillRect(x, 108, 70, 50);
    c.strokeStyle = '#4a2e1e'; c.lineWidth = 4;
    for (let x = L + 100; x < R - 120; x += 120) { c.strokeRect(x, 108, 70, 50); c.beginPath(); c.moveTo(x + 35, 108); c.lineTo(x + 35, 158); c.moveTo(x, 133); c.lineTo(x + 70, 133); c.stroke(); }
    // 屋檐（两端上翘）
    c.fillStyle = '#2b2f3f';
    c.beginPath();
    c.moveTo(L - 26, 58);
    c.quadraticCurveTo(L - 4, 74, L + 40, 76);
    c.lineTo(R - 40, 76);
    c.quadraticCurveTo(R + 4, 74, R + 26, 58);
    c.lineTo(R + 10, 84);
    c.lineTo(L - 10, 84);
    c.closePath();
    c.fill();
    // 瓦面
    const tg = c.createLinearGradient(0, 0, 0, 78);
    tg.addColorStop(0, '#5b6178'); tg.addColorStop(1, '#3a3f52');
    c.fillStyle = tg;
    c.beginPath();
    c.moveTo(L, 0); c.lineTo(R, 0); c.lineTo(R + 20, 66); c.lineTo(L - 20, 66); c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(20,22,34,0.55)'; c.lineWidth = 2;
    for (let x = L - 10; x <= R + 10; x += 22) { c.beginPath(); c.moveTo(x * 0.98, 8); c.lineTo(x * 1.03, 64); c.stroke(); }
    for (let y = 18; y < 66; y += 14) { c.beginPath(); c.moveTo(L - y * 0.3, y); c.lineTo(R + y * 0.3, y); c.stroke(); }
    // 屋脊（站立面）
    c.fillStyle = '#7c839c';
    c.fillRect(L, -2, R - L, 12);
    c.fillStyle = '#9aa2bb';
    c.fillRect(L, -2, R - L, 3);
    c.fillStyle = '#c94a3a';
    for (const x of [L + 14, R - 14]) { c.beginPath(); c.arc(x, -2, 12, PI, TAU); c.fill(); }
    // 灯笼
    for (const x of [L + 50, R - 50, (L + R) / 2]) {
      c.strokeStyle = '#2b2f3f'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, 84); c.lineTo(x, 100); c.stroke();
      c.fillStyle = '#e8473a';
      c.beginPath(); c.ellipse(x, 118, 15, 19, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,220,140,0.45)';
      c.beginPath(); c.ellipse(x - 3, 114, 6, 10, 0, 0, TAU); c.fill();
      c.fillStyle = '#2b2f3f'; c.fillRect(x - 8, 98, 16, 4); c.fillRect(x - 8, 135, 16, 4);
    }
  } else if (stage.id === 'tray') {
    // 托盘下的云
    c.fillStyle = 'rgba(255,240,235,0.95)';
    for (let i = 0; i < 16; i++) {
      const x = L + (i / 15) * (R - L), r = 34 + rnd() * 30;
      c.beginPath(); c.arc(x, D + 30 + rnd() * 30, r, 0, TAU); c.fill();
    }
    // 托盘
    const tg = c.createLinearGradient(0, 0, 0, D);
    tg.addColorStop(0, '#9c3f2c'); tg.addColorStop(1, '#5e2116');
    c.fillStyle = tg;
    c.beginPath();
    c.moveTo(L, 0); c.lineTo(R, 0); c.lineTo(R - 24, D); c.lineTo(L + 24, D); c.closePath(); c.fill();
    c.fillStyle = '#b8503a';
    c.fillRect(L, -4, R - L, 14);
    c.fillStyle = '#e0b04a';
    c.fillRect(L, -4, R - L, 3);
    c.fillRect(L + 10, 24, R - L - 20, 3);
    c.strokeStyle = '#e0b04a'; c.lineWidth = 2;
    for (let x = L + 80; x < R - 60; x += 120) { c.beginPath(); c.arc(x, 44, 10, 0, TAU); c.stroke(); }
    // 把手
    c.fillStyle = '#5e2116';
    for (const x of [L + 30, R - 30]) c.fillRect(x - 16, 30, 32, 10);
  } else {
    // 擂台：木地板 + 石台基
    const sg = c.createLinearGradient(0, 18, 0, D + 120);
    sg.addColorStop(0, '#9a9a8c'); sg.addColorStop(1, 'rgba(110,110,100,0)');
    c.fillStyle = sg;
    c.beginPath(); c.moveTo(L + 10, 18); c.lineTo(R - 10, 18); c.lineTo(R - 60, D + 120); c.lineTo(L + 60, D + 120); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(70,70,60,0.4)'; c.lineWidth = 2;
    for (let y = 40; y < D + 100; y += 26) { c.beginPath(); c.moveTo(L + 10 + y * 0.4, y); c.lineTo(R - 10 - y * 0.4, y); c.stroke(); }
    const wg = c.createLinearGradient(0, -4, 0, 20);
    wg.addColorStop(0, '#e4c08a'); wg.addColorStop(1, '#b98a52');
    c.fillStyle = wg;
    c.fillRect(L, -2, R - L, 22);
    c.strokeStyle = 'rgba(120,80,40,0.45)'; c.lineWidth = 2;
    for (let x = L + 60; x < R; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 20); c.stroke(); }
    c.fillStyle = '#c0392b';
    c.fillRect(L, 16, R - L, 5);
    c.fillStyle = '#f7e4bd';
    c.fillRect(L, -2, R - L, 2);
  }
  return { cv, x: M.x1 - pad, y: M.y - top, w, h };
}

export function drawPlatform(c, p, stage, t) {
  if (stage.id === 'tray') {
    const cx = (p.x1 + p.x2) / 2, w = (p.x2 - p.x1) / 2;
    c.fillStyle = 'rgba(80,40,60,0.18)';
    c.beginPath(); c.ellipse(cx, p.y + 18, w * 0.9, 9, 0, 0, TAU); c.fill();
    c.fillStyle = '#f6f1e6';
    c.beginPath(); c.ellipse(cx, p.y + 4, w, 12, 0, 0, TAU); c.fill();
    c.strokeStyle = '#3f78c8'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(cx, p.y + 4, w - 6, 9, 0, 0, TAU); c.stroke();
    c.fillStyle = '#e4dccb';
    c.beginPath(); c.ellipse(cx, p.y + 2, w * 0.45, 5, 0, 0, TAU); c.fill();
    return;
  }
  // 屋顶上的木台
  c.fillStyle = '#7a5134';
  c.fillRect(p.x1, p.y - 2, p.x2 - p.x1, 12);
  c.fillStyle = '#a9774c';
  c.fillRect(p.x1, p.y - 2, p.x2 - p.x1, 4);
  c.fillStyle = '#5a3a24';
  c.fillRect(p.x1 + 12, p.y + 10, 8, 18);
  c.fillRect(p.x2 - 20, p.y + 10, 8, 18);
  // 小灯串
  for (let x = p.x1 + 16, i = 0; x < p.x2 - 8; x += 26, i++) {
    const on = (Math.floor(t / 20) + i) % 3 !== 0;
    c.fillStyle = on ? '#ffd56b' : '#b88a3c';
    c.beginPath(); c.arc(x, p.y + 14 + Math.sin(i) * 2, 3, 0, TAU); c.fill();
  }
}

// 《茶岛生活》美术：全部用 Canvas 矢量现场绘制（原创角色与物件）
import { makeCanvas, fillRR, strokeRR, text } from '../../ui.js';

const TAU = Math.PI * 2;
function ell(c, x, y, rx, ry, color, rot = 0) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  c.fill();
}
function circ(c, x, y, r, color) { ell(c, x, y, r, r, color); }
function poly(c, pts, color) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fill();
}

// 预渲染的小图：一份 1 倍、一份 2 倍，按系统画布的分辨率挑一份，按整像素贴上去（不用每帧缩放，省很多时间）
let RES = 1;
export function setRes(scale) { RES = scale >= 1.5 ? 2 : 1; }
export function sprite(w, h, ox, oy, fn) {
  const make = (k) => {
    const cv = makeCanvas(Math.ceil(w * k), Math.ceil(h * k));
    const c = cv.getContext('2d');
    c.scale(k, k);
    c.translate(ox, oy);
    fn(c);
    return cv;
  };
  const cv2 = make(2);
  return { cv: cv2, cv1: make(1), cv2, w, h, ox, oy };
}
export function blit(c, sp, x, y) {
  const k = RES;
  const px = Math.round((x - sp.ox) * k) / k, py = Math.round((y - sp.oy) * k) / k;
  c.drawImage(k === 2 ? sp.cv2 : sp.cv1, px, py, sp.w, sp.h);
}

// ———————————————— 树 ————————————————
export const FRUIT_SLOTS = {
  orange: [[-26, -72], [8, -98], [26, -62]], peach: [[-26, -72], [8, -98], [26, -62]], apple: [[-26, -72], [8, -98], [26, -62]],
  palm: [[22, -124], [34, -118], [27, -112]],
};
export function treeSprites() {
  const S = {};
  S.cedar = sprite(120, 180, 60, 168, (c) => {
    ell(c, 0, 0, 40, 12, 'rgba(30,60,30,0.28)');
    fillRR(c, -7, -34, 14, 36, 4, '#7a4d2a');
    const tiers = [[-62, 52, 58], [-98, 42, 50], [-130, 30, 42]];
    for (const [y, rw, h] of tiers) {
      poly(c, [0, y - h, rw, y + 4, -rw, y + 4], '#2c7a4c');
      poly(c, [0, y - h, rw * 0.15, y - h * 0.2, -rw * 0.85, y + 2], '#3f9a5c');
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.beginPath();
      c.ellipse(-rw * 0.3, y - h * 0.35, rw * 0.18, h * 0.12, -0.6, 0, TAU);
      c.fill();
    }
  });
  const round = (leaf, dark, light) => sprite(140, 160, 70, 150, (c) => {
    ell(c, 0, 0, 46, 13, 'rgba(30,60,30,0.28)');
    c.fillStyle = '#86562f';
    c.beginPath();
    c.moveTo(-9, 2); c.quadraticCurveTo(-5, -30, -10, -50); c.lineTo(10, -50); c.quadraticCurveTo(5, -30, 9, 2);
    c.closePath();
    c.fill();
    circ(c, -24, -62, 30, dark);
    circ(c, 26, -60, 30, dark);
    circ(c, 0, -88, 38, leaf);
    circ(c, -28, -76, 28, leaf);
    circ(c, 28, -74, 28, leaf);
    circ(c, 0, -60, 32, leaf);
    circ(c, -10, -100, 18, light);
    circ(c, 14, -92, 12, light);
  });
  S.orange = round('#4fae55', '#3a8f47', '#80cd6c');
  S.peach = round('#5ab86a', '#40975a', '#8ed780');
  S.apple = round('#47a650', '#367f42', '#7cc96a');
  S.palm = sprite(150, 190, 45, 178, (c) => {
    ell(c, 10, 0, 40, 11, 'rgba(60,50,20,0.25)');
    c.strokeStyle = '#a77a48';
    c.lineWidth = 13;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(0, -2);
    c.quadraticCurveTo(4, -70, 28, -118);
    c.stroke();
    c.strokeStyle = 'rgba(90,60,30,0.5)';
    c.lineWidth = 2;
    for (let k = 1; k < 9; k++) {
      const t = k / 9, x = 2 * (1 - t) * t * 4 + t * t * 28, y = -2 * (1 - t) * (1 - t) - 2 * (1 - t) * t * 70 - t * t * 118;
      c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 6, y - 2); c.stroke();
    }
    const fr = (a, len, col) => {
      c.save();
      c.translate(28, -122);
      c.rotate(a);
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(len * 0.5, -18, len, 8);
      c.quadraticCurveTo(len * 0.5, -2, 0, 6);
      c.closePath();
      c.fill();
      c.restore();
    };
    fr(-2.9, 62, '#3f9a4c'); fr(-0.3, 64, '#3f9a4c'); fr(-1.9, 56, '#4fae55'); fr(-1.1, 58, '#4fae55'); fr(0.6, 50, '#5fbf62'); fr(3.5, 52, '#5fbf62');
  });
  return S;
}
export function drawFruit(c, kind, x, y, s = 1) {
  if (kind === 'coconut') {
    circ(c, x, y, 7 * s, '#7a4f2a');
    circ(c, x - 2 * s, y - 2 * s, 2.2 * s, 'rgba(255,255,255,0.25)');
    return;
  }
  const col = kind === 'orange' ? '#ff8a1c' : kind === 'peach' ? '#ffaaa0' : '#e8423a';
  circ(c, x, y, 8 * s, col);
  if (kind === 'peach') ell(c, x + 2 * s, y, 3 * s, 7 * s, 'rgba(255,120,120,0.45)');
  circ(c, x - 3 * s, y - 3 * s, 2.5 * s, 'rgba(255,255,255,0.45)');
  c.fillStyle = '#3f9a4c';
  c.beginPath();
  c.ellipse(x + 3 * s, y - 8 * s, 4 * s, 2 * s, -0.5, 0, TAU);
  c.fill();
}

// ———————————————— 建筑 ————————————————
export function buildingSprites() {
  const B = {};
  // 小松茶铺
  B.shop = sprite(240, 210, 120, 196, (c) => {
    ell(c, 0, 2, 118, 14, 'rgba(40,40,30,0.25)');
    fillRR(c, -102, -100, 204, 100, 6, '#e8c08c');
    c.fillStyle = 'rgba(140,90,50,0.25)';
    for (let y = -92; y < 0; y += 12) c.fillRect(-102, y, 204, 1.5);
    poly(c, [-122, -96, 122, -96, 96, -170, -96, -170], '#3f9a5c');
    poly(c, [-122, -96, 122, -96, 112, -110, -112, -110], '#2e7d48');
    for (let x = -110; x < 110; x += 22) poly(c, [x, -110, x + 22, -110, x + 18, -168, x + 4, -168], 'rgba(255,255,255,0.06)');
    // 招牌
    fillRR(c, -50, -160, 100, 34, 8, '#fff4dc');
    strokeRR(c, -50, -160, 100, 34, 8, '#8a5a32', 3);
    text(c, '小松茶铺', 0, -142, 18, '#6a3f1f', 'center', 800);
    // 遮阳棚
    for (let i = 0; i < 9; i++) poly(c, [-90 + i * 20, -86, -70 + i * 20, -86, -72 + i * 20, -66, -88 + i * 20, -66], i % 2 ? '#ffffff' : '#ff8a3c');
    for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#ff8a3c'; c.beginPath(); c.arc(-80 + i * 20, -66, 10, 0, Math.PI); c.fill(); }
    // 门窗
    fillRR(c, -20, -52, 40, 52, 6, '#8a5a32');
    fillRR(c, -15, -47, 30, 44, 4, '#a8754a');
    circ(c, 9, -24, 2.5, '#ffd27a');
    for (const x of [-78, 46]) {
      fillRR(c, x, -50, 32, 28, 4, '#8a5a32');
      fillRR(c, x + 3, -47, 26, 22, 3, '#bfe8f2');
      c.fillStyle = '#8a5a32';
      c.fillRect(x + 15, -47, 2, 22);
    }
    // 门口的小茶罐
    fillRR(c, 66, -16, 18, 16, 4, '#5aa66a');
    fillRR(c, 64, -20, 22, 6, 3, '#3f8a52');
  });
  // 岛屿博物馆
  B.museum = sprite(250, 230, 125, 214, (c) => {
    ell(c, 0, 2, 120, 14, 'rgba(40,40,30,0.25)');
    fillRR(c, -108, -12, 216, 14, 3, '#d9d2c2');
    fillRR(c, -100, -110, 200, 100, 4, '#f6f1e6');
    for (const x of [-86, -50, 34, 70]) {
      fillRR(c, x, -104, 16, 92, 3, '#ffffff');
      c.fillStyle = 'rgba(0,0,0,0.07)';
      c.fillRect(x + 11, -104, 5, 92);
    }
    poly(c, [-118, -108, 118, -108, 0, -176], '#4f8fd0');
    poly(c, [-100, -114, 100, -114, 0, -166], '#f6f1e6');
    circ(c, 0, -134, 15, '#4f8fd0');
    // 叶子徽章（原创）
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(0, -134, 9, 5, -0.6, 0, TAU);
    c.fill();
    fillRR(c, -50, -100, 100, 22, 6, '#4f8fd0');
    text(c, '岛屿博物馆', 0, -89, 15, '#ffffff', 'center', 800);
    fillRR(c, -22, -64, 44, 54, 20, '#5b4a3a');
    fillRR(c, -17, -59, 34, 49, 16, '#7a654f');
    fillRR(c, -28, -10, 56, 10, 2, '#e6dfcf');
  });
  // 自己的家：帐篷 → 小木屋 → 两层茶屋
  B.house0 = sprite(170, 140, 85, 128, (c) => {
    ell(c, 0, 2, 72, 12, 'rgba(40,40,30,0.25)');
    poly(c, [0, -98, 70, 0, -70, 0], '#ff8a3c');
    poly(c, [0, -98, 18, 0, -18, 0], '#ffffff');
    poly(c, [0, -98, 70, 0, 52, 0], '#ff7020');
    poly(c, [0, -60, 14, 0, -14, 0], '#6a3f1f');
    c.strokeStyle = '#8a5a32';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, -98); c.lineTo(0, -112); c.stroke();
    poly(c, [0, -112, 16, -106, 0, -100], '#3fae5a');
  });
  B.house1 = sprite(220, 190, 110, 176, (c) => {
    ell(c, 0, 2, 100, 14, 'rgba(40,40,30,0.25)');
    fillRR(c, -86, -92, 172, 92, 5, '#c98a52');
    c.fillStyle = 'rgba(90,50,20,0.35)';
    for (let y = -84; y < 0; y += 13) c.fillRect(-86, y, 172, 2);
    fillRR(c, 44, -158, 18, 40, 3, '#9a9a9a');
    poly(c, [-104, -88, 104, -88, 0, -160], '#e8523a');
    poly(c, [-104, -88, 104, -88, 92, -100, -92, -100], '#c43c28');
    fillRR(c, -18, -56, 36, 56, 6, '#7a4a26');
    circ(c, 9, -28, 2.5, '#ffd27a');
    for (const x of [-68, 36]) {
      fillRR(c, x, -62, 32, 30, 4, '#7a4a26');
      fillRR(c, x + 3, -59, 26, 24, 3, '#fff2c0');
      c.fillStyle = '#7a4a26';
      c.fillRect(x + 15, -59, 2, 24);
    }
    fillRR(c, -40, -122, 30, 24, 12, '#fff2c0');
    strokeRR(c, -40, -122, 30, 24, 12, '#7a4a26', 3);
  });
  B.house2 = sprite(260, 260, 130, 244, (c) => {
    ell(c, 0, 2, 122, 16, 'rgba(40,40,30,0.25)');
    fillRR(c, -100, -104, 200, 104, 5, '#f1e3c6');
    c.fillStyle = '#8a5a32';
    for (const x of [-100, -36, 32, 96]) c.fillRect(x, -104, 5, 104);
    c.fillRect(-100, -54, 200, 4);
    // 一楼屋檐
    poly(c, [-124, -100, 124, -100, 108, -122, -108, -122], '#3c6e8f');
    c.fillStyle = '#3c6e8f';
    c.beginPath(); c.moveTo(-124, -100); c.quadraticCurveTo(-134, -104, -136, -114); c.lineTo(-108, -122); c.fill();
    c.beginPath(); c.moveTo(124, -100); c.quadraticCurveTo(134, -104, 136, -114); c.lineTo(108, -122); c.fill();
    // 二楼
    fillRR(c, -72, -184, 144, 64, 4, '#f1e3c6');
    c.fillStyle = '#8a5a32';
    for (const x of [-72, 68]) c.fillRect(x, -184, 5, 64);
    circ(c, 0, -152, 18, '#8a5a32');
    circ(c, 0, -152, 14, '#fff2c0');
    c.fillStyle = '#8a5a32';
    c.fillRect(-1, -166, 2, 28);
    c.fillRect(-14, -153, 28, 2);
    poly(c, [-98, -180, 98, -180, 60, -222, -60, -222], '#2f5c7a');
    c.fillStyle = '#2f5c7a';
    c.beginPath(); c.moveTo(-98, -180); c.quadraticCurveTo(-112, -184, -114, -196); c.lineTo(-80, -200); c.fill();
    c.beginPath(); c.moveTo(98, -180); c.quadraticCurveTo(112, -184, 114, -196); c.lineTo(80, -200); c.fill();
    fillRR(c, -8, -236, 16, 16, 4, '#ff8a1c');
    // 门窗与灯笼
    fillRR(c, -22, -50, 44, 50, 4, '#7a4a26');
    c.fillStyle = '#a8754a';
    c.fillRect(-18, -46, 17, 46);
    c.fillRect(1, -46, 17, 46);
    for (const x of [-84, 48]) {
      fillRR(c, x, -46, 36, 30, 3, '#8a5a32');
      fillRR(c, x + 3, -43, 30, 24, 2, '#fff2c0');
      c.strokeStyle = '#8a5a32';
      c.lineWidth = 1.5;
      for (let k = 1; k < 3; k++) { c.beginPath(); c.moveTo(x + 3 + k * 10, -43); c.lineTo(x + 3 + k * 10, -19); c.stroke(); }
    }
    for (const x of [-112, 112]) {
      c.strokeStyle = '#6a3f1f'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x, -100); c.lineTo(x, -88); c.stroke();
      ell(c, x, -78, 9, 12, '#ff5a3a');
      c.fillStyle = '#6a3f1f'; c.fillRect(x - 5, -91, 10, 3); c.fillRect(x - 5, -68, 10, 3);
    }
  });
  return B;
}
// 夜里亮灯的窗户位置（相对房子底边中点）
export const WINDOWS = {
  shop: [[-62, -36], [62, -36]], museum: [[0, -40]], house0: [[0, -24]], house1: [[-52, -47], [52, -47], [-25, -110]],
  house2: [[-66, -31], [66, -31], [0, -152]],
};

export function drawFountain(c, x, y, t) {
  ell(c, x, y + 6, 54, 18, 'rgba(40,40,30,0.2)');
  ell(c, x, y, 50, 22, '#cfc3ab');
  ell(c, x, y - 4, 44, 18, '#e9e0cc');
  ell(c, x, y - 4, 38, 14, '#79cfe8');
  for (let k = 0; k < 3; k++) {
    const r = ((t * 14 + k * 12) % 36);
    c.strokeStyle = `rgba(255,255,255,${(0.5 * (1 - r / 36)).toFixed(3)})`;
    c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(x, y - 4, r, r * 0.38, 0, 0, TAU); c.stroke();
  }
  // 中间的茶壶喷泉
  fillRR(c, x - 6, y - 34, 12, 30, 4, '#cfc3ab');
  ell(c, x, y - 42, 16, 13, '#f3efe6');
  ell(c, x, y - 54, 7, 4, '#d9cfbb');
  c.strokeStyle = '#f3efe6';
  c.lineWidth = 5;
  c.beginPath(); c.moveTo(x + 12, y - 42); c.lineTo(x + 24, y - 50); c.stroke();
  c.strokeStyle = 'rgba(160,220,240,0.9)';
  c.lineWidth = 3;
  c.beginPath(); c.moveTo(x + 25, y - 51); c.quadraticCurveTo(x + 36, y - 54, x + 30 + Math.sin(t * 8) * 1.5, y - 8); c.stroke();
}
export function drawLampPost(c, x, y, night) {
  ell(c, x, y + 1, 10, 4, 'rgba(0,0,0,0.2)');
  fillRR(c, x - 3, y - 58, 6, 58, 2, '#4a4f5a');
  fillRR(c, x - 10, y - 74, 20, 18, 5, night > 0.3 ? '#fff1b8' : '#e8edf2');
  strokeRR(c, x - 10, y - 74, 20, 18, 5, '#4a4f5a', 2.5);
  poly(c, [x - 13, y - 74, x + 13, y - 74, x, y - 84], '#4a4f5a');
}
export function drawMailbox(c, x, y, flag) {
  ell(c, x, y + 1, 12, 4, 'rgba(0,0,0,0.2)');
  fillRR(c, x - 3, y - 26, 6, 26, 2, '#8a5a32');
  fillRR(c, x - 13, y - 44, 26, 20, 8, '#4f8fd0');
  if (flag) { c.fillStyle = '#e8423a'; c.fillRect(x + 12, y - 48, 3, 14); c.fillRect(x + 12, y - 48, 9, 6); }
}
export function drawSign(c, x, y, str) {
  ell(c, x, y + 1, 26, 5, 'rgba(0,0,0,0.2)');
  c.fillStyle = '#8a5a32';
  c.fillRect(x - 22, y - 30, 5, 30);
  c.fillRect(x + 17, y - 30, 5, 30);
  fillRR(c, x - 34, y - 52, 68, 28, 6, '#d8a868');
  strokeRR(c, x - 34, y - 52, 68, 28, 6, '#8a5a32', 2.5);
  text(c, str, x, y - 38, 13, '#5a3416', 'center', 800);
}
export function drawRock(c, x, y, s) {
  ell(c, x, y + 2, 24 * s, 7 * s, 'rgba(0,0,0,0.2)');
  c.fillStyle = '#9aa0a8';
  c.beginPath();
  c.moveTo(x - 22 * s, y);
  c.quadraticCurveTo(x - 24 * s, y - 20 * s, x - 6 * s, y - 24 * s);
  c.quadraticCurveTo(x + 18 * s, y - 26 * s, x + 22 * s, y - 6 * s);
  c.quadraticCurveTo(x + 22 * s, y + 2 * s, x, y + 2 * s);
  c.closePath();
  c.fill();
  ell(c, x - 6 * s, y - 16 * s, 8 * s, 4 * s, 'rgba(255,255,255,0.3)', -0.3);
}
// 花：每种颜色预渲染三帧（左摆 / 正 / 右摆）
const FLOWER_CACHE = new Map();
export function flowerSprite(c, x, y, color, t, ph) {
  let fr = FLOWER_CACHE.get(color);
  if (!fr) {
    fr = [-2, 0, 2].map((sw) => sprite(28, 34, 14, 30, (g) => drawFlowerShape(g, 0, 0, color, sw, ph)));
    FLOWER_CACHE.set(color, fr);
  }
  const sw = Math.sin(t * 2 + ph);
  blit(c, fr[sw < -0.35 ? 0 : sw > 0.35 ? 2 : 1], x, y);
}
export function drawFlower(c, x, y, color, t, ph) { drawFlowerShape(c, x, y, color, Math.sin(t * 2 + ph) * 2, ph); }
function drawFlowerShape(c, x, y, color, sway, ph) {
  c.strokeStyle = '#3f8a3a';
  c.lineWidth = 2;
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + sway * 0.4, y - 7, x + sway, y - 13); c.stroke();
  ell(c, x - 4, y - 5, 4, 2, '#4fae55', -0.5);
  const fx = x + sway, fy = y - 15;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + ph;
    circ(c, fx + Math.cos(a) * 4.2, fy + Math.sin(a) * 4.2, 3.6, color);
  }
  circ(c, fx, fy, 2.6, color === '#ffd23f' ? '#ff8a1c' : '#ffd23f');
}

// ———————————————— 人物 ————————————————
// dir：0 下 1 左 2 上 3 右
export function drawPlayer(c, x, y, o) {
  const { dir = 0, walk = 0, moving = false, tool = 0, swing = 0, swollen = false, run = false, holdRod = false } = o;
  const bob = moving ? Math.abs(Math.sin(walk)) * (run ? 3.5 : 2) : 0;
  const leg = moving ? Math.sin(walk) * (run ? 5 : 3.5) : 0;
  ell(c, x, y, 15, 5, 'rgba(0,0,0,0.22)');
  c.save();
  c.translate(x, y - bob);
  const side = dir === 1 || dir === 3;
  const flip = dir === 1 ? -1 : 1;
  // 腿
  fillRR(c, -7 + (side ? leg * 0.6 : 0), -12 + (side ? 0 : Math.max(0, leg) * 0.4), 6, 12, 3, '#5a4a3f');
  fillRR(c, 1 - (side ? leg * 0.6 : 0), -12 + (side ? 0 : Math.max(0, -leg) * 0.4), 6, 12, 3, '#5a4a3f');
  // 裙子 / 身体
  c.fillStyle = '#2fae8c';
  c.beginPath();
  c.moveTo(-10, -12); c.lineTo(10, -12); c.lineTo(7, -30); c.lineTo(-7, -30); c.closePath();
  c.fill();
  c.fillStyle = '#ffffff';
  c.fillRect(-7, -30, 14, 3);
  // 工具（画在身后还是身前看方向）
  const drawTool = () => {
    if (tool === 1) {
      c.save();
      c.scale(flip, 1);
      const a = holdRod ? -0.9 : -0.4 - swing * 1.2;
      c.translate(8, -22);
      c.rotate(a);
      c.strokeStyle = '#8a5a32'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -34); c.stroke();
      c.restore();
    } else if (tool === 2) {
      c.save();
      c.scale(flip, 1);
      const a = -0.5 + swing * 2.2;
      c.translate(8, -22);
      c.rotate(a);
      c.strokeStyle = '#8a5a32'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -26); c.stroke();
      c.strokeStyle = '#ffffff'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(0, -34, 9, 8, 0, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.fill();
      c.restore();
    }
  };
  if (dir === 2) drawTool();
  // 手臂
  const arm = moving && !swing ? Math.sin(walk) * 3 : 0;
  ell(c, -10, -22 + arm, 3, 6, '#ffe0c4');
  ell(c, 10, -22 - arm, 3, 6, '#ffe0c4');
  // 头
  const hy = -42;
  if (dir === 2) {
    circ(c, 0, hy, 14, '#ff7a1a');
    ell(c, 0, hy + 12, 8, 6, '#ff7a1a');
    ell(c, 9, hy - 9, 5, 3, '#3fae5a', 0.6);
  } else {
    // 后发
    ell(c, 0, hy + 2, 15, 14, '#ff7a1a');
    if (side) ell(c, -flip * 12, hy + 6, 5, 9, '#ff7a1a');
    circ(c, side ? flip * 2 : 0, hy + 2, 11.5, '#ffe0c4');
    // 刘海
    c.fillStyle = '#ff7a1a';
    c.beginPath();
    if (side) {
      c.ellipse(-flip * 2, hy - 6, 14, 8, 0, Math.PI, TAU);
      c.fill();
    } else {
      c.ellipse(0, hy - 5, 14.5, 9, 0, Math.PI, TAU);
      c.fill();
      ell(c, -8, hy - 2, 5, 4, '#ff7a1a');
    }
    ell(c, (side ? -flip : 1) * 9, hy - 10, 5, 3, '#3fae5a', 0.6);
    // 脸
    c.fillStyle = '#3a2a22';
    if (side) {
      ell(c, flip * 7, hy + 2, 1.8, 2.6, '#3a2a22');
    } else {
      ell(c, -4.5, hy + 2, 1.8, 2.6, '#3a2a22');
      ell(c, 4.5, hy + 2, 1.8, 2.6, '#3a2a22');
      ell(c, -7.5, hy + 6, 2.2, 1.3, 'rgba(255,120,120,0.45)');
      ell(c, 7.5, hy + 6, 2.2, 1.3, 'rgba(255,120,120,0.45)');
    }
    if (swollen) ell(c, side ? flip * 6 : 4.5, hy + 1, 5.5, 5, '#ff6a6a');
  }
  if (dir !== 2) drawTool();
  c.restore();
}

// 岛民（场景里的小人）
export function drawNPC(c, id, x, y, dir, walk, moving, t) {
  const bob = moving ? Math.abs(Math.sin(walk)) * 2 : Math.sin(t * 2) * 0.6;
  ell(c, x, y, 15, 5, 'rgba(0,0,0,0.22)');
  c.save();
  c.translate(x, y - bob);
  if (dir === 1) c.scale(-1, 1);
  if (id === 'dango') catBody(c, t, dir);
  else if (id === 'elder') teapotBody(c, t, dir);
  else if (id === 'kuri') deerBody(c, t, dir, walk, moving);
  c.restore();
}
function catBody(c, t, dir) {
  const sw = Math.sin(t * 3) * 0.3;
  c.strokeStyle = '#ff9a3c'; c.lineWidth = 5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-8, -10); c.quadraticCurveTo(-22, -14 + sw * 10, -18, -30 + sw * 6); c.stroke();
  ell(c, 0, -12, 12, 10, '#ff9a3c');
  ell(c, 0, -9, 7, 5, '#fff1de');
  catHead(c, 0, -32, 1, dir === 2);
}
function catHead(c, x, y, s, back) {
  poly(c, [x - 13 * s, y - 4 * s, x - 9 * s, y - 20 * s, x - 2 * s, y - 10 * s], '#ff9a3c');
  poly(c, [x + 13 * s, y - 4 * s, x + 9 * s, y - 20 * s, x + 2 * s, y - 10 * s], '#ff9a3c');
  ell(c, x, y, 15 * s, 13 * s, '#ff9a3c');
  c.fillStyle = '#e8781e';
  for (const k of [-1, 0, 1]) c.fillRect(x + k * 5 * s - 1.5 * s, y - 13 * s, 3 * s, 6 * s);
  if (back) return;
  ell(c, x, y + 5 * s, 8 * s, 5 * s, '#fff1de');
  ell(c, x - 6 * s, y, 2 * s, 2.6 * s, '#2a2a2a');
  ell(c, x + 6 * s, y, 2 * s, 2.6 * s, '#2a2a2a');
  ell(c, x, y + 3.5 * s, 1.8 * s, 1.2 * s, '#ff6a8a');
  c.strokeStyle = '#7a4a2a'; c.lineWidth = Math.max(1, s);
  c.beginPath(); c.moveTo(x - 3 * s, y + 6.5 * s); c.quadraticCurveTo(x, y + 8 * s, x + 3 * s, y + 6.5 * s); c.stroke();
}
function teapotBody(c, t, dir) {
  ell(c, -6, -2, 4, 3, '#8a6a4a');
  ell(c, 6, -2, 4, 3, '#8a6a4a');
  teapotHead(c, 0, -22, 1, dir === 2, t);
}
function teapotHead(c, x, y, s, back, t = 0) {
  c.strokeStyle = '#e8dcc6'; c.lineWidth = 5 * s; c.lineCap = 'round';
  c.beginPath(); c.arc(x - 18 * s, y, 8 * s, Math.PI * 0.5, Math.PI * 1.5); c.stroke();
  c.beginPath(); c.moveTo(x + 14 * s, y + 2 * s); c.quadraticCurveTo(x + 24 * s, y, x + 26 * s, y - 10 * s); c.stroke();
  ell(c, x, y, 18 * s, 16 * s, '#f4ead6');
  c.strokeStyle = '#6fa8dc'; c.lineWidth = 2 * s;
  c.beginPath(); c.ellipse(x, y + 4 * s, 13 * s, 5 * s, 0, 0, Math.PI); c.stroke();
  ell(c, x, y - 15 * s, 11 * s, 4 * s, '#e8dcc6');
  circ(c, x, y - 20 * s, 3.5 * s, '#6fa8dc');
  if (back) return;
  ell(c, x - 6 * s, y - 3 * s, 1.8 * s, 2.4 * s, '#2a2a2a');
  ell(c, x + 6 * s, y - 3 * s, 1.8 * s, 2.4 * s, '#2a2a2a');
  // 白胡子
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.moveTo(x - 9 * s, y + 2 * s);
  c.quadraticCurveTo(x - 4 * s, y + 10 * s + Math.sin(t * 2) * s, x, y + 3 * s);
  c.quadraticCurveTo(x + 4 * s, y + 10 * s + Math.sin(t * 2) * s, x + 9 * s, y + 2 * s);
  c.quadraticCurveTo(x, y - 1 * s, x - 9 * s, y + 2 * s);
  c.fill();
  c.strokeStyle = '#8a7a6a'; c.lineWidth = 1.2 * s;
  c.beginPath(); c.moveTo(x - 9 * s, y - 8 * s); c.lineTo(x - 3 * s, y - 7 * s); c.moveTo(x + 9 * s, y - 8 * s); c.lineTo(x + 3 * s, y - 7 * s); c.stroke();
}
function deerBody(c, t, dir, walk, moving) {
  const leg = moving ? Math.sin(walk) * 3 : 0;
  fillRR(c, -6, -12 + Math.max(0, leg) * 0.4, 4, 12, 2, '#8a5a32');
  fillRR(c, 2, -12 + Math.max(0, -leg) * 0.4, 4, 12, 2, '#8a5a32');
  ell(c, 0, -20, 10, 11, '#c98a4a');
  ell(c, 0, -17, 6, 7, '#f6e2c4');
  for (const [px, py] of [[-6, -25], [5, -27], [7, -18]]) circ(c, px, py, 1.6, '#f6e2c4');
  deerHead(c, 0, -40, 1, dir === 2);
}
function deerHead(c, x, y, s, back) {
  ell(c, x - 15 * s, y - 6 * s, 8 * s, 4 * s, '#c98a4a', -0.5);
  ell(c, x + 15 * s, y - 6 * s, 8 * s, 4 * s, '#c98a4a', 0.5);
  ell(c, x - 15 * s, y - 6 * s, 5 * s, 2 * s, '#f3c9a4', -0.5);
  ell(c, x + 15 * s, y - 6 * s, 5 * s, 2 * s, '#f3c9a4', 0.5);
  c.strokeStyle = '#8a5a32'; c.lineWidth = 2.5 * s; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - 5 * s, y - 11 * s); c.lineTo(x - 8 * s, y - 20 * s); c.lineTo(x - 12 * s, y - 22 * s);
  c.moveTo(x + 5 * s, y - 11 * s); c.lineTo(x + 8 * s, y - 20 * s); c.lineTo(x + 12 * s, y - 22 * s); c.stroke();
  ell(c, x, y, 12 * s, 12 * s, '#c98a4a');
  if (back) return;
  ell(c, x, y + 5 * s, 7 * s, 5.5 * s, '#f6e2c4');
  ell(c, x - 5 * s, y - 1 * s, 2.2 * s, 3 * s, '#2a2a2a');
  ell(c, x + 5 * s, y - 1 * s, 2.2 * s, 3 * s, '#2a2a2a');
  circ(c, x - 4.4 * s, y - 2 * s, 0.8 * s, '#ffffff');
  circ(c, x + 5.6 * s, y - 2 * s, 0.8 * s, '#ffffff');
  ell(c, x, y + 3.5 * s, 2.2 * s, 1.6 * s, '#5a3a2a');
  ell(c, x - 8 * s, y + 4 * s, 2.4 * s, 1.4 * s, 'rgba(255,120,120,0.4)');
  ell(c, x + 8 * s, y + 4 * s, 2.4 * s, 1.4 * s, 'rgba(255,120,120,0.4)');
}
function squirrelHead(c, x, y, s) {
  c.fillStyle = '#c97a32';
  c.beginPath();
  c.moveTo(x + 14 * s, y + 20 * s);
  c.quadraticCurveTo(x + 40 * s, y + 10 * s, x + 30 * s, y - 24 * s);
  c.quadraticCurveTo(x + 22 * s, y - 34 * s, x + 18 * s, y - 14 * s);
  c.quadraticCurveTo(x + 22 * s, y + 4 * s, x + 6 * s, y + 14 * s);
  c.fill();
  poly(c, [x - 12 * s, y - 6 * s, x - 9 * s, y - 22 * s, x - 2 * s, y - 10 * s], '#d98a3a');
  poly(c, [x + 12 * s, y - 6 * s, x + 9 * s, y - 22 * s, x + 2 * s, y - 10 * s], '#d98a3a');
  ell(c, x, y, 14 * s, 13 * s, '#d98a3a');
  ell(c, x, y + 5 * s, 8 * s, 6 * s, '#fbe6cc');
  ell(c, x - 5 * s, y - 1 * s, 2 * s, 2.8 * s, '#2a2a2a');
  ell(c, x + 5 * s, y - 1 * s, 2 * s, 2.8 * s, '#2a2a2a');
  ell(c, x, y + 3 * s, 1.8 * s, 1.3 * s, '#6a3a2a');
  fillRR(c, x - 2.5 * s, y + 6 * s, 5 * s, 4 * s, 1 * s, '#ffffff');
  // 小围裙
  fillRR(c, x - 10 * s, y + 13 * s, 20 * s, 8 * s, 3 * s, '#3fae5a');
}
function tortoiseHead(c, x, y, s) {
  ell(c, x, y + 18 * s, 22 * s, 14 * s, '#6f9a52');
  c.strokeStyle = '#4f7a3a'; c.lineWidth = 2 * s;
  c.beginPath(); c.moveTo(x - 10 * s, y + 8 * s); c.lineTo(x - 6 * s, y + 28 * s); c.moveTo(x + 10 * s, y + 8 * s); c.lineTo(x + 6 * s, y + 28 * s); c.stroke();
  ell(c, x, y - 2 * s, 12 * s, 11 * s, '#a9c98a');
  ell(c, x - 4.5 * s, y - 3 * s, 1.8 * s, 1.2 * s, '#2a2a2a');
  ell(c, x + 4.5 * s, y - 3 * s, 1.8 * s, 1.2 * s, '#2a2a2a');
  // 小眼镜
  c.strokeStyle = '#6a4a2a'; c.lineWidth = 1.4 * s;
  c.beginPath(); c.arc(x - 4.5 * s, y - 3 * s, 3.6 * s, 0, TAU); c.arc(x + 4.5 * s, y - 3 * s, 3.6 * s, 0, TAU); c.stroke();
  c.beginPath(); c.moveTo(x - 2 * s, y + 4 * s); c.quadraticCurveTo(x, y + 6 * s, x + 2 * s, y + 4 * s); c.stroke();
  // 小帽子
  fillRR(c, x - 8 * s, y - 17 * s, 16 * s, 6 * s, 2 * s, '#4a3a6a');
  fillRR(c, x - 11 * s, y - 12 * s, 22 * s, 3 * s, 1.5 * s, '#4a3a6a');
}
// 对话框里的头像
export function portrait(c, id, cx, cy, s, t) {
  const b = Math.sin(t * 3) * 1.5 * s;
  c.save();
  if (id === 'dango') catHead(c, cx, cy + b, s * 1.4, false);
  else if (id === 'elder') teapotHead(c, cx, cy + b, s * 1.25, false, t);
  else if (id === 'kuri') deerHead(c, cx, cy + b + 4 * s, s * 1.35, false);
  else if (id === 'shop') squirrelHead(c, cx, cy + b - 4 * s, s * 1.25);
  else if (id === 'curator') tortoiseHead(c, cx, cy + b - 6 * s, s * 1.2);
  else if (id === 'player') {
    circ(c, cx, cy + b, 16 * s, '#ff7a1a');
    circ(c, cx, cy + b + 2 * s, 12.5 * s, '#ffe0c4');
    c.fillStyle = '#ff7a1a';
    c.beginPath(); c.ellipse(cx, cy + b - 5 * s, 15.5 * s, 9 * s, 0, Math.PI, TAU); c.fill();
    ell(c, cx - 4.5 * s, cy + b + 2 * s, 1.8 * s, 2.6 * s, '#3a2a22');
    ell(c, cx + 4.5 * s, cy + b + 2 * s, 1.8 * s, 2.6 * s, '#3a2a22');
  }
  c.restore();
}

// ———————————————— 图标（背包、图鉴、弹窗共用）————————————————
// s = 图标边长；sil = 剪影（还没抓到）
export function drawFishIcon(c, f, cx, cy, s, sil = false) {
  const k = s / 64;
  const C = (col) => (sil ? '#a3abb5' : col);
  c.save();
  c.translate(cx, cy);
  c.scale(k, k);
  const shape = f.shape;
  if (shape === 'can') {
    fillRR(c, -14, -22, 28, 44, 5, C('#b8c0c8'));
    fillRR(c, -14, -10, 28, 18, 2, C('#e8523a'));
    ell(c, 0, -22, 14, 4, C('#d9dee3'));
  } else if (shape === 'slipper') {
    c.rotate(-0.4);
    fillRR(c, -12, -26, 24, 52, 12, C('#5aa0e0'));
    fillRR(c, -12, -12, 24, 8, 3, C('#ffffff'));
  } else if (shape === 'crayfish') {
    ell(c, 2, 4, 18, 9, C(f.body));
    for (let i = 0; i < 4; i++) ell(c, -16 - i * 5, 4, 4, 7 - i, C(f.belly));
    for (const sy of [-1, 1]) {
      c.strokeStyle = C(f.body); c.lineWidth = 3;
      c.beginPath(); c.moveTo(14, 4 + sy * 4); c.lineTo(24, 4 + sy * 14); c.stroke();
      ell(c, 28, 4 + sy * 18, 7, 4, C(f.body), sy * 0.5);
      c.strokeStyle = C('#8a2a1a'); c.lineWidth = 1;
      c.beginPath(); c.moveTo(20, 2); c.lineTo(30, -12 * sy + 4); c.stroke();
    }
    if (!sil) { circ(c, 16, 0, 1.8, '#2a2a2a'); circ(c, 16, 8, 1.8, '#2a2a2a'); }
  } else if (shape === 'puffer') {
    c.fillStyle = C(f.body);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      poly(c, [Math.cos(a) * 18, Math.sin(a) * 18, Math.cos(a + 0.12) * 25, Math.sin(a + 0.12) * 25, Math.cos(a + 0.24) * 18, Math.sin(a + 0.24) * 18], C('#a8955a'));
    }
    circ(c, 0, 0, 20, C(f.body));
    ell(c, 0, 8, 14, 9, C(f.belly));
    poly(c, [-20, 0, -30, -8, -30, 8], C(f.body));
    if (!sil) { circ(c, 9, -5, 4, '#ffffff'); circ(c, 10, -5, 2, '#2a2a2a'); }
    for (const [x, y] of [[-6, -10], [2, -14], [-10, -2]]) circ(c, x, y, 2, C('#7a6a3a'));
  } else if (shape === 'goldfish') {
    c.fillStyle = C('#ffb46a');
    c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(-30, -22, -30, -6); c.quadraticCurveTo(-24, 0, -30, 6); c.quadraticCurveTo(-30, 22, -10, 0); c.fill();
    ell(c, 4, 0, 16, 13, C(f.body));
    ell(c, 6, 4, 10, 6, C(f.belly));
    poly(c, [0, -12, 8, -20, 10, -11], C('#ffb46a'));
    if (!sil) { circ(c, 12, -3, 3.5, '#ffffff'); circ(c, 13, -3, 1.8, '#2a2a2a'); }
  } else {
    // 普通鱼形 / 鲶鱼 / 金枪鱼 / 鲨鱼 / 皇带鱼
    let L = 26, Hh = 10;
    if (shape === 'tuna') { L = 28; Hh = 12; }
    if (shape === 'shark') { L = 30; Hh = 9; }
    if (shape === 'oarfish') { L = 30; Hh = 5; }
    if (shape === 'catfish') { L = 27; Hh = 9; }
    if (shape === 'oarfish') {
      c.fillStyle = C(f.body);
      c.beginPath();
      c.moveTo(28, 0);
      for (let x = 28; x >= -30; x -= 4) c.lineTo(x, Math.sin(x / 8) * 4 - 4);
      for (let x = -30; x <= 28; x += 4) c.lineTo(x, Math.sin(x / 8) * 4 + 4);
      c.fill();
      c.fillStyle = C('#ff5a5a');
      c.beginPath();
      c.moveTo(26, -4);
      for (let x = 26; x >= -28; x -= 4) c.lineTo(x, Math.sin(x / 8) * 4 - 9 - (x > 18 ? 6 : 0));
      c.lineTo(-28, Math.sin(-28 / 8) * 4 - 4);
      c.fill();
      if (!sil) circ(c, 22, -1, 1.8, '#2a2a2a');
    } else {
      poly(c, [-L + 4, 0, -L - 10, -Hh - 2, -L - 6, 0, -L - 10, Hh + 2], C(shape === 'tuna' ? '#e8c43a' : f.body));
      if (shape === 'shark' || f.fin) poly(c, [-2, -Hh + 1, 8, -Hh - 14, 12, -Hh + 2], C(f.body));
      else poly(c, [-8, -Hh + 2, 2, -Hh - 7, 8, -Hh + 2], C(f.body));
      ell(c, 0, 0, L, Hh, C(f.body));
      c.save();
      c.beginPath(); c.ellipse(0, 0, L, Hh, 0, 0, TAU); c.clip();
      ell(c, 2, Hh * 0.6, L, Hh * 0.6, C(f.belly));
      if (!sil && f.pat === 'line') { c.fillStyle = f.patC; c.fillRect(-L, -1, L * 2, 2.4); }
      if (!sil && f.pat === 'rainbow') { c.fillStyle = f.patC; c.globalAlpha = 0.7; c.fillRect(-L, -2, L * 2, 5); c.globalAlpha = 1; }
      if (!sil && f.pat === 'dot') for (let i = 0; i < 7; i++) circ(c, -16 + i * 5.5, -3 + (i % 2) * 3, 1.5, f.patC);
      if (!sil && f.pat === 'bands') for (const bx of [-12, 2, 14]) { c.fillStyle = '#2a2a2a'; c.fillRect(bx - 4, -Hh, 8, Hh * 2); c.fillStyle = f.patC; c.fillRect(bx - 3, -Hh, 6, Hh * 2); }
      if (!sil && f.pat === 'koi') { ell(c, -6, -3, 8, 6, f.patC); ell(c, 10, -2, 6, 5, f.patC); }
      c.restore();
      if (shape === 'tuna' && !sil) for (let i = 0; i < 4; i++) poly(c, [-10 - i * 5, Hh - 1, -12 - i * 5, Hh + 4, -14 - i * 5, Hh - 2], '#e8c43a');
      if (shape === 'catfish') {
        c.strokeStyle = C('#3a3a32'); c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(L - 4, 2); c.quadraticCurveTo(L + 8, 6, L + 10, 14); c.moveTo(L - 4, 3); c.quadraticCurveTo(L + 4, 10, L + 2, 16); c.stroke();
      }
      if (!sil) { circ(c, L - 8, -2, 3, '#ffffff'); circ(c, L - 7.5, -2, 1.6, '#2a2a2a'); }
    }
  }
  c.restore();
}

export function drawBugIcon(c, b, cx, cy, s, sil = false, t = 0) {
  const k = s / 64;
  const C = (col) => (sil ? '#a3abb5' : col);
  c.save();
  c.translate(cx, cy);
  c.scale(k, k);
  const id = b.id;
  const flap = 0.75 + 0.25 * Math.sin(t * 18);
  const wings = (col, col2, w, h, tail) => {
    for (const sx of [-1, 1]) {
      ell(c, sx * w * 0.55 * flap, -6, w * 0.6 * flap, h * 0.7, C(col), sx * 0.4);
      ell(c, sx * w * 0.45 * flap, 9, w * 0.45 * flap, h * 0.5, C(col2), -sx * 0.5);
      if (tail) poly(c, [sx * 8 * flap, 14, sx * 14 * flap, 28, sx * 12 * flap, 14], C(col2));
    }
  };
  if (id === 'white') {
    wings('#ffffff', '#f2f2ea', 30, 26);
    if (!sil) { circ(c, -12 * flap, -10, 2.5, '#8a8a8a'); circ(c, 12 * flap, -10, 2.5, '#8a8a8a'); }
    ell(c, 0, 0, 3, 13, C('#4a4a4a'));
  } else if (id === 'swallowtail') {
    wings('#ffd84a', '#ffcf3a', 32, 28, true);
    if (!sil) { c.strokeStyle = '#2a2a2a'; c.lineWidth = 2.5; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(0, -4); c.lineTo(sx * 22 * flap, -16); c.moveTo(0, 2); c.lineTo(sx * 18 * flap, 4); c.stroke(); } circ(c, 10 * flap, 14, 2.5, '#4f8fd0'); circ(c, -10 * flap, 14, 2.5, '#4f8fd0'); }
    ell(c, 0, 0, 3, 15, C('#2a2a2a'));
  } else if (id === 'bee') {
    ell(c, -10, -12, 10 * flap, 7, C('rgba(220,240,255,0.85)'), -0.5);
    ell(c, 10, -12, 10 * flap, 7, C('rgba(220,240,255,0.85)'), 0.5);
    ell(c, 0, 2, 13, 11, C('#ffcf3a'));
    if (!sil) { c.fillStyle = '#2a2a2a'; c.fillRect(-4, -8, 3, 20); c.fillRect(4, -8, 3, 20); }
    circ(c, 0, -10, 6, C('#2a2a2a'));
    poly(c, [-3, 12, 3, 12, 0, 18], C('#2a2a2a'));
  } else if (id === 'ladybug') {
    circ(c, 0, -14, 7, C('#2a2a2a'));
    circ(c, 0, 2, 17, C('#e8323a'));
    if (!sil) {
      c.fillStyle = '#2a2a2a'; c.fillRect(-1, -14, 2, 32);
      for (const [x, y] of [[-8, -4], [8, -4], [-10, 7], [10, 7], [-4, 13], [4, 13], [0, -10]]) circ(c, x, y, 3, '#2a2a2a');
      circ(c, -6, -8, 2, 'rgba(255,255,255,0.6)');
    }
  } else if (id === 'mantis') {
    c.strokeStyle = C('#6fbf4a'); c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -8); c.lineTo(-10, -16); c.lineTo(-6, -4); c.moveTo(0, -8); c.lineTo(10, -16); c.lineTo(6, -4); c.stroke();
    ell(c, 0, 10, 6, 18, C('#7fcf5a'));
    poly(c, [-9, -20, 9, -20, 0, -10], C('#7fcf5a'));
    if (!sil) { circ(c, -7, -19, 2.5, '#2a6a2a'); circ(c, 7, -19, 2.5, '#2a6a2a'); }
    c.beginPath(); c.moveTo(-4, 14); c.lineTo(-14, 26); c.moveTo(4, 14); c.lineTo(14, 26); c.stroke();
  } else if (id === 'dragonfly') {
    for (const sy of [-1, 1]) {
      ell(c, -16, -6 + sy * 0, 18 * flap, 4, C('rgba(200,235,255,0.85)'), sy * 0.15);
      ell(c, 16, -6, 18 * flap, 4, C('rgba(200,235,255,0.85)'), -sy * 0.15);
    }
    ell(c, -15, 2, 16 * flap, 3.5, C('rgba(200,235,255,0.8)'), 0.2);
    ell(c, 15, 2, 16 * flap, 3.5, C('rgba(200,235,255,0.8)'), -0.2);
    fillRR(c, -2.5, -6, 5, 34, 2.5, C('#3a8fd0'));
    circ(c, -4, -12, 5, C('#4fc0e8'));
    circ(c, 4, -12, 5, C('#4fc0e8'));
  } else if (id === 'firefly') {
    if (!sil) { c.fillStyle = 'rgba(220,255,120,0.35)'; c.beginPath(); c.arc(0, 10, 16 + Math.sin(t * 5) * 3, 0, TAU); c.fill(); }
    ell(c, -8, -4, 8, 12, C('rgba(60,60,60,0.9)'), -0.3);
    ell(c, 8, -4, 8, 12, C('rgba(60,60,60,0.9)'), 0.3);
    ell(c, 0, 0, 6, 14, C('#3a3a3a'));
    circ(c, 0, -14, 5, C('#ff7a5a'));
    ell(c, 0, 12, 6, 6, C('#e8ff7a'));
  } else if (id === 'cicada') {
    ell(c, -8, 4, 10, 22, C('rgba(200,220,210,0.85)'), -0.2);
    ell(c, 8, 4, 10, 22, C('rgba(200,220,210,0.85)'), 0.2);
    ell(c, 0, 0, 9, 16, C('#6a5a3a'));
    ell(c, 0, -14, 10, 6, C('#5a4a2a'));
    if (!sil) { circ(c, -8, -15, 3, '#3a2a1a'); circ(c, 8, -15, 3, '#3a2a1a'); }
  } else if (id === 'stag') {
    c.strokeStyle = C('#7a3a1a'); c.lineWidth = 3.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-5, -16); c.quadraticCurveTo(-16, -26, -6, -34); c.moveTo(5, -16); c.quadraticCurveTo(16, -26, 6, -34); c.stroke();
    ell(c, 0, -12, 9, 6, C('#5a2a12'));
    ell(c, 0, 8, 13, 16, C('#6a3418'));
    if (!sil) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-0.8, -6, 1.6, 30); ell(c, -5, 2, 3, 6, 'rgba(255,255,255,0.25)'); }
  } else if (id === 'rhino') {
    c.strokeStyle = C('#3a2a1a'); c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -16); c.quadraticCurveTo(0, -30, -6, -36); c.stroke();
    ell(c, 0, -12, 10, 7, C('#2a1e14'));
    ell(c, 0, 8, 14, 17, C('#3a2a1a'));
    if (!sil) { c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(-0.8, -6, 1.6, 30); ell(c, -5, 2, 3, 7, 'rgba(255,255,255,0.22)'); }
  } else if (id === 'cricket') {
    c.strokeStyle = C('#5a3a1a'); c.lineWidth = 2.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-6, 8); c.lineTo(-16, -2); c.lineTo(-20, 14); c.moveTo(6, 8); c.lineTo(16, -2); c.lineTo(20, 14); c.stroke();
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(-3, -14); c.quadraticCurveTo(-14, -30, -22, -28); c.moveTo(3, -14); c.quadraticCurveTo(14, -30, 22, -28); c.stroke();
    ell(c, 0, 4, 9, 16, C('#4a2e14'));
    circ(c, 0, -12, 6, C('#3a2210'));
  } else if (id === 'snail') {
    ell(c, 2, 12, 24, 7, C('#d9c8a8'));
    circ(c, -2, 0, 15, C('#c98a4a'));
    if (!sil) { c.strokeStyle = '#8a5a2a'; c.lineWidth = 2.5; c.beginPath(); for (let a = 0; a < 12; a += 0.3) { const r = 13 - a; c.lineTo(-2 + Math.cos(a) * r, Math.sin(a) * r); } c.stroke(); }
    c.strokeStyle = C('#d9c8a8'); c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(20, 8); c.lineTo(24, -6); c.moveTo(16, 8); c.lineTo(17, -4); c.stroke();
  } else if (id === 'hermit') {
    c.strokeStyle = C('#e8523a'); c.lineWidth = 3; c.lineCap = 'round';
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 6, 10); c.lineTo(sx * 16, 18); c.stroke(); }
    ell(c, -14, 4, 7, 5, C('#e8523a'));
    poly(c, [-6, 14, 24, 14, 10, -20], C('#f3e3c6'));
    if (!sil) { c.strokeStyle = '#c9a87a'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 6); c.lineTo(18, 6); c.moveTo(4, -2); c.lineTo(15, -2); c.stroke(); }
    if (!sil) { circ(c, -18, -2, 2, '#2a2a2a'); circ(c, -12, -3, 2, '#2a2a2a'); }
  } else if (id === 'moth') {
    wings('#c9b48a', '#b8a378', 28, 24);
    if (!sil) { circ(c, -12 * flap, -8, 3, '#8a6a4a'); circ(c, 12 * flap, -8, 3, '#8a6a4a'); }
    ell(c, 0, 0, 4, 12, C('#8a7a5a'));
  }
  c.restore();
}

export function drawItemIcon(c, it, cx, cy, s, data, t = 0) {
  const k = s / 64;
  if (it.k === 'fish') return drawFishIcon(c, data.fish[it.id] || data.junk[it.id], cx, cy, s);
  if (it.k === 'bug') return drawBugIcon(c, data.bug[it.id], cx, cy, s, false, t);
  if (it.k === 'fruit') {
    if (it.id === 'coconut') { circ(c, cx, cy, 20 * k, '#7a4f2a'); circ(c, cx - 6 * k, cy - 6 * k, 6 * k, 'rgba(255,255,255,0.2)'); return; }
    drawFruit(c, it.id, cx, cy + 2 * k, 2.4 * k);
    return;
  }
  if (it.k === 'misc' && it.id === 'hive') {
    ell(c, cx, cy, 18 * k, 22 * k, '#d9a84a');
    c.strokeStyle = '#a8782a'; c.lineWidth = 2 * k;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(cx, cy + i * 8 * k, 17 * k * Math.cos(i * 0.35), 3 * k, 0, 0, Math.PI); c.stroke(); }
    circ(c, cx, cy + 10 * k, 4 * k, '#5a3a1a');
    return;
  }
  if (it.k === 'furn') return drawFurniture(c, it.id, cx, cy + s * 0.32, s * 0.95, t);
}

// 家具：x, y = 格子底部中点，s = 格子边长
export function drawFurniture(c, id, x, y, s, t = 0) {
  const k = s / 64;
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  ell(c, 0, -2, 26, 6, 'rgba(0,0,0,0.15)');
  switch (id) {
    case 'teatable':
      fillRR(c, -26, -26, 52, 10, 4, '#a8754a');
      c.fillStyle = '#7a4a26'; c.fillRect(-22, -16, 6, 16); c.fillRect(16, -16, 6, 16);
      ell(c, -6, -30, 6, 4, '#ffffff'); ell(c, 8, -30, 5, 3, '#9fd8b0');
      break;
    case 'chair':
      fillRR(c, -18, -56, 36, 30, 6, '#c9b06a');
      c.strokeStyle = '#a8904a'; c.lineWidth = 2; for (let i = -12; i <= 12; i += 6) { c.beginPath(); c.moveTo(i, -54); c.lineTo(i, -28); c.stroke(); }
      fillRR(c, -20, -28, 40, 10, 4, '#d9c07a');
      c.fillStyle = '#a8904a'; c.fillRect(-18, -18, 4, 18); c.fillRect(14, -18, 4, 18);
      break;
    case 'plant':
      fillRR(c, -14, -22, 28, 22, 5, '#d9774a');
      for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.42; ell(c, Math.cos(a) * 16, -30 + Math.sin(a) * 18, 9, 5, i % 2 ? '#4fae55' : '#6fcf6a', a); }
      break;
    case 'rug':
      ell(c, 0, -14, 30, 13, '#ff9a5a');
      ell(c, 0, -14, 22, 9, '#ffd08a');
      ell(c, 0, -14, 12, 5, '#ff7a3a');
      break;
    case 'lamp':
      fillRR(c, -10, -10, 20, 10, 4, '#8a5a32');
      fillRR(c, -2, -40, 4, 30, 2, '#8a5a32');
      circ(c, 0, -48, 15, '#ff9a3c');
      c.fillStyle = 'rgba(255,240,180,0.6)'; c.beginPath(); c.arc(-4, -52, 5, 0, TAU); c.fill();
      ell(c, 4, -63, 6, 3, '#3fae5a', -0.5);
      break;
    case 'luckycat': {
      const w = Math.sin(t * 5) * 0.35;
      ell(c, 0, -18, 16, 18, '#ffffff');
      circ(c, 0, -42, 14, '#ffffff');
      poly(c, [-12, -48, -9, -62, -2, -54], '#ffffff'); poly(c, [12, -48, 9, -62, 2, -54], '#ffffff');
      ell(c, -5, -43, 1.8, 2.4, '#2a2a2a'); ell(c, 5, -43, 1.8, 2.4, '#2a2a2a');
      ell(c, 0, -38, 2, 1.4, '#ff6a8a');
      fillRR(c, -10, -30, 20, 5, 2, '#e8323a');
      circ(c, 0, -24, 4, '#ffd23f');
      c.save(); c.translate(12, -32); c.rotate(-0.4 + w); ell(c, 0, -10, 5, 9, '#ffffff'); c.restore();
      ell(c, 0, -10, 10, 6, '#ffd23f');
      break;
    }
    case 'bookshelf':
      fillRR(c, -26, -70, 52, 70, 4, '#8a5a32');
      fillRR(c, -22, -66, 44, 62, 2, '#6a3f1f');
      for (let r = 0; r < 3; r++) {
        c.fillStyle = '#8a5a32'; c.fillRect(-22, -46 + r * 21, 44, 3);
        const cols = ['#e8523a', '#4f8fd0', '#ffd23f', '#3fae5a', '#b58cff'];
        for (let i = 0; i < 6; i++) { c.fillStyle = cols[(i + r * 2) % 5]; c.fillRect(-20 + i * 7, -64 + r * 21, 5, 17 - (i % 3) * 2); }
      }
      break;
    case 'fishtank':
      fillRR(c, -24, -12, 48, 12, 3, '#6a4a32');
      fillRR(c, -24, -54, 48, 42, 4, 'rgba(120,210,240,0.75)');
      strokeRR(c, -24, -54, 48, 42, 4, '#e8f6fb', 2.5);
      for (let i = 0; i < 2; i++) {
        const fx = Math.sin(t * (1 + i * 0.4) + i * 2) * 12, fy = -40 + i * 14;
        ell(c, fx, fy, 6, 3.5, i ? '#ff7a2a' : '#ffd23f');
        poly(c, [fx - 5, fy, fx - 10, fy - 4, fx - 10, fy + 4], i ? '#ff7a2a' : '#ffd23f');
      }
      ell(c, -10, -16, 6, 3, '#4fae55');
      break;
    case 'bed':
      fillRR(c, -28, -40, 56, 40, 6, '#a8754a');
      fillRR(c, -24, -36, 48, 30, 5, '#ffffff');
      fillRR(c, -24, -24, 48, 20, 5, '#ff9a5a');
      fillRR(c, -18, -36, 18, 10, 4, '#fff4e0');
      break;
    case 'record': {
      fillRR(c, -24, -22, 48, 22, 4, '#8a5a32');
      ell(c, -2, -26, 18, 7, '#2a2a2a');
      ell(c, -2, -26, 5, 2, '#ff7a3a');
      c.strokeStyle = '#d9c07a'; c.lineWidth = 3; c.beginPath(); c.moveTo(18, -24); c.lineTo(8, -30); c.stroke();
      const n = (t * 1.2) % 1;
      c.fillStyle = `rgba(80,60,160,${(1 - n).toFixed(2)})`;
      text(c, '♪', 18 + n * 8, -40 - n * 22, 16, c.fillStyle, 'center', 700);
      break;
    }
    case 'cattower':
      fillRR(c, -4, -70, 8, 70, 2, '#c9a87a');
      fillRR(c, -24, -14, 48, 14, 4, '#d9b88a');
      fillRR(c, -22, -48, 30, 10, 4, '#d9b88a');
      fillRR(c, -10, -78, 32, 10, 4, '#d9b88a');
      circ(c, 12, -84, 7, '#ff9a3c');
      break;
    case 'globe':
      fillRR(c, -12, -8, 24, 8, 3, '#8a5a32');
      c.fillStyle = '#8a5a32'; c.fillRect(-2, -20, 4, 14);
      circ(c, 0, -38, 18, '#4f8fd0');
      ell(c, -5, -42, 8, 6, '#6fcf6a'); ell(c, 8, -32, 6, 4, '#6fcf6a');
      c.strokeStyle = '#d9c07a'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, -38, 21, -2.4, 0.8); c.stroke();
      break;
    case 'specimen':
      fillRR(c, -22, -62, 44, 54, 3, '#8a5a32');
      fillRR(c, -18, -58, 36, 46, 2, '#fff4e0');
      drawBugIcon(c, { id: 'swallowtail' }, -6, -42, 18);
      drawBugIcon(c, { id: 'stag' }, 8, -24, 16);
      break;
    case 'stove':
      fillRR(c, -16, -26, 32, 26, 6, '#7a6a5a');
      ell(c, 0, -10, 8, 5, '#ff7a2a');
      ell(c, 0, -34, 14, 10, '#d9cfbb');
      c.strokeStyle = `rgba(255,255,255,${(0.5 + 0.3 * Math.sin(t * 3)).toFixed(2)})`; c.lineWidth = 2;
      c.beginPath(); c.moveTo(14, -38); c.quadraticCurveTo(20 + Math.sin(t * 4) * 3, -48, 16, -58); c.stroke();
      break;
    default:
      fillRR(c, -20, -30, 40, 30, 4, '#c9b06a');
  }
  c.restore();
}

// 场景里的虫子：x, y = 地面位置，h = 离地高度
export function drawBugWorld(c, b, x, y, h, t, night) {
  if (b.def.glow && night > 0.3) {
    const a = 0.35 + 0.35 * Math.sin(t * 4 + b.ph);
    c.fillStyle = `rgba(220,255,120,${(a * night).toFixed(3)})`;
    c.beginPath(); c.arc(x, y - h, 12, 0, TAU); c.fill();
  }
  if (h > 4) ell(c, x, y, 5, 2, 'rgba(0,0,0,0.15)');
  const id = b.def.id;
  const s = id === 'stag' || id === 'rhino' ? 26 : id === 'cicada' ? 22 : id === 'hermit' || id === 'snail' ? 22 : 20;
  drawBugIcon(c, b.def, x, y - h, s, false, t + b.ph);
}

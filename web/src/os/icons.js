// 矢量图标（全部用 Canvas 路径绘制）
import { fillRR, rrect } from './ui.js';

// 橙发少女头像
export function drawAvatar(ctx, cx, cy, r, bg = '#fff0df') {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.clip();
  const s = r / 34;
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  // 后发
  ctx.fillStyle = '#ff7a1a';
  ctx.beginPath();
  ctx.ellipse(0, 4, 27, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-27, 4, 54, 34);
  // 脸
  ctx.fillStyle = '#ffe1c9';
  ctx.beginPath();
  ctx.ellipse(0, 10, 18.5, 17.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 脖子+衣服
  ctx.fillStyle = '#ffe1c9';
  ctx.fillRect(-6, 24, 12, 8);
  ctx.fillStyle = '#2fae8c';
  ctx.beginPath();
  ctx.ellipse(0, 42, 26, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-8, 30);
  ctx.lineTo(0, 37);
  ctx.lineTo(8, 30);
  ctx.closePath();
  ctx.fill();
  // 刘海
  ctx.fillStyle = '#ff7a1a';
  ctx.beginPath();
  ctx.moveTo(-21, 6);
  ctx.quadraticCurveTo(-20, -16, 0, -17);
  ctx.quadraticCurveTo(20, -16, 21, 6);
  ctx.lineTo(15, 0);
  ctx.lineTo(11, 5);
  ctx.lineTo(6, -2);
  ctx.lineTo(1, 4);
  ctx.lineTo(-5, -2);
  ctx.lineTo(-10, 5);
  ctx.lineTo(-15, 0);
  ctx.closePath();
  ctx.fill();
  // 高光发丝
  ctx.strokeStyle = 'rgba(255,214,150,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-4, -4, 13, Math.PI * 1.1, Math.PI * 1.45);
  ctx.stroke();
  // 眼睛
  ctx.fillStyle = '#3b2620';
  ctx.beginPath();
  ctx.ellipse(-7.5, 11, 3, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(7.5, 11, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-6.5, 9.5, 1.2, 0, Math.PI * 2);
  ctx.arc(8.5, 9.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
  // 腮红 + 嘴
  ctx.fillStyle = 'rgba(255,120,120,0.45)';
  ctx.beginPath();
  ctx.ellipse(-12, 17, 3.5, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(12, 17, 3.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c0574a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 17, 3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // 茶叶发夹
  drawLeaf(ctx, 15, -10, 7, 0.6, '#3cb371');
  ctx.restore();
}

export function drawLeaf(ctx, x, y, s, rot = 0, color = '#3cb371') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.quadraticCurveTo(0, -s * 0.9, s, 0);
  ctx.quadraticCurveTo(0, s * 0.9, -s, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(0.8, s * 0.12);
  ctx.beginPath();
  ctx.moveTo(-s * 0.8, 0);
  ctx.lineTo(s * 0.8, 0);
  ctx.stroke();
  ctx.restore();
}

// 橙子
export function drawOrange(ctx, x, y, r, shine = true) {
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffc36b');
  g.addColorStop(0.55, '#ff8f1f');
  g.addColorStop(1, '#e8650a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (shine) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.38, y - r * 0.4, r * 0.22, r * 0.13, -0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#7a4a1e';
  ctx.fillRect(x - r * 0.06, y - r * 1.12, r * 0.12, r * 0.3);
  drawLeaf(ctx, x + r * 0.32, y - r * 0.98, r * 0.42, -0.35, '#3fae4a');
  ctx.restore();
}

export function iconAlbum(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.07;
  rrect(ctx, cx - s * 0.42, cy - s * 0.32, s * 0.84, s * 0.64, s * 0.08);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.34, cy + s * 0.22);
  ctx.lineTo(cx - s * 0.1, cy - s * 0.05);
  ctx.lineTo(cx + s * 0.06, cy + s * 0.1);
  ctx.lineTo(cx + s * 0.16, cy + s * 0.02);
  ctx.lineTo(cx + s * 0.34, cy + s * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.18, cy - s * 0.14, s * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function iconGamepad(ctx, cx, cy, s, color, bg = '#ffffff') {
  ctx.save();
  // 两只竖着的手柄
  const w = s * 0.24, h = s * 0.66;
  ctx.fillStyle = color;
  fillRR(ctx, cx - w - s * 0.05, cy - h / 2, w, h, w * 0.5, color);
  fillRR(ctx, cx + s * 0.05, cy - h / 2, w, h, w * 0.5, color);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx - w / 2 - s * 0.05, cy - h * 0.18, w * 0.26, 0, Math.PI * 2);
  ctx.arc(cx + w / 2 + s * 0.05, cy + h * 0.12, w * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function iconTheme(ctx, cx, cy, s, color, dark, bg = '#ffffff') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (dark) {
    // 月亮
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx + s * 0.14, cy - s * 0.12, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 太阳
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = s * 0.07;
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * s * 0.27, cy + Math.sin(a) * s * 0.27);
      ctx.lineTo(cx + Math.cos(a) * s * 0.37, cy + Math.sin(a) * s * 0.37);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function iconGear(ctx, cx, cy, s, color, bg = '#ffffff') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const teeth = 8, r1 = s * 0.36, r2 = s * 0.27;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i * Math.PI) / teeth - Math.PI / teeth / 2;
    const r = i % 2 === 0 ? r1 : r2;
    const a1 = a0 + Math.PI / teeth;
    ctx.lineTo(cx + Math.cos(a0 + 0.08) * r, cy + Math.sin(a0 + 0.08) * r);
    ctx.lineTo(cx + Math.cos(a1 - 0.08) * r, cy + Math.sin(a1 - 0.08) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function iconPower(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.08;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.03, s * 0.28, -Math.PI * 0.32, Math.PI * 1.32);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.33);
  ctx.lineTo(cx, cy - s * 0.02);
  ctx.stroke();
  ctx.restore();
}

export function iconSpeaker(ctx, cx, cy, s, color, level = 1) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.4, cy - s * 0.14);
  ctx.lineTo(cx - s * 0.2, cy - s * 0.14);
  ctx.lineTo(cx + s * 0.04, cy - s * 0.36);
  ctx.lineTo(cx + s * 0.04, cy + s * 0.36);
  ctx.lineTo(cx - s * 0.2, cy + s * 0.14);
  ctx.lineTo(cx - s * 0.4, cy + s * 0.14);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  if (level <= 0) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.16, cy - s * 0.14);
    ctx.lineTo(cx + s * 0.42, cy + s * 0.14);
    ctx.moveTo(cx + s * 0.42, cy - s * 0.14);
    ctx.lineTo(cx + s * 0.16, cy + s * 0.14);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx + s * 0.06, cy, s * 0.18, -0.9, 0.9);
    ctx.stroke();
    if (level > 0.5) {
      ctx.beginPath();
      ctx.arc(cx + s * 0.06, cy, s * 0.34, -0.9, 0.9);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function iconBattery(ctx, x, y, w, h, color, level = 1, charging = false) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  rrect(ctx, x, y, w, h, 3);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(x + w, y + h * 0.3, 3, h * 0.4);
  const fillW = (w - 6) * level;
  ctx.fillStyle = level < 0.2 ? '#ff4b3e' : color;
  ctx.fillRect(x + 3, y + 3, fillW, h - 6);
  if (charging) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.55, y + 1);
    ctx.lineTo(x + w * 0.36, y + h * 0.55);
    ctx.lineTo(x + w * 0.5, y + h * 0.55);
    ctx.lineTo(x + w * 0.44, y + h - 1);
    ctx.lineTo(x + w * 0.66, y + h * 0.42);
    ctx.lineTo(x + w * 0.52, y + h * 0.42);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function iconWifi(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.1;
  ctx.lineCap = 'round';
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.32, s * 0.16 * i + s * 0.02, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.32, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 掌机模式小图标：中间屏幕 + 两侧手柄（拆下的一侧画成虚线）
export function iconHandheld(ctx, cx, cy, s, color, left = true, right = true, docked = false) {
  ctx.save();
  if (docked) {
    // 电视
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    rrect(ctx, cx - s * 0.5, cy - s * 0.3, s, s * 0.56, 3);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(cx - s * 0.18, cy + s * 0.32, s * 0.36, 2.5);
    ctx.restore();
    return;
  }
  const bw = s * 0.62, bh = s * 0.4, jw = s * 0.17;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  rrect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 2);
  ctx.stroke();
  const joy = (x, on, flip) => {
    ctx.save();
    if (!on) ctx.setLineDash([3, 3]);
    ctx.beginPath();
    if (flip) {
      ctx.moveTo(x, cy - bh / 2);
      ctx.lineTo(x + jw * 0.5, cy - bh / 2);
      ctx.arcTo(x + jw, cy - bh / 2, x + jw, cy, jw * 0.6);
      ctx.arcTo(x + jw, cy + bh / 2, x, cy + bh / 2, jw * 0.6);
      ctx.lineTo(x, cy + bh / 2);
    } else {
      ctx.moveTo(x, cy - bh / 2);
      ctx.lineTo(x - jw * 0.5, cy - bh / 2);
      ctx.arcTo(x - jw, cy - bh / 2, x - jw, cy, jw * 0.6);
      ctx.arcTo(x - jw, cy + bh / 2, x, cy + bh / 2, jw * 0.6);
      ctx.lineTo(x, cy + bh / 2);
    }
    if (on) ctx.fill();
    else ctx.stroke();
    ctx.restore();
  };
  joy(cx - bw / 2 - (left ? 1 : 4), left, false);
  joy(cx + bw / 2 + (right ? 1 : 4), right, true);
  ctx.restore();
}

// 一只竖放的 Joy-Con 小图标（提示用），side: 'L' | 'R'
export function iconJoyCon(ctx, cx, cy, s, side) {
  ctx.save();
  const w = s * 0.36, h = s * 0.9;
  const color = side === 'L' ? '#0ab9e6' : '#ff4b3e';
  ctx.fillStyle = color;
  ctx.beginPath();
  const x0 = cx - w / 2, y0 = cy - h / 2;
  const r = w * 0.9;
  if (side === 'L') {
    ctx.moveTo(x0 + w, y0);
    ctx.lineTo(x0 + r, y0);
    ctx.arcTo(x0, y0, x0, y0 + r, r);
    ctx.lineTo(x0, y0 + h - r);
    ctx.arcTo(x0, y0 + h, x0 + r, y0 + h, r);
    ctx.lineTo(x0 + w, y0 + h);
  } else {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + w - r, y0);
    ctx.arcTo(x0 + w, y0, x0 + w, y0 + r, r);
    ctx.lineTo(x0 + w, y0 + h - r);
    ctx.arcTo(x0 + w, y0 + h, x0 + w - r, y0 + h, r);
    ctx.lineTo(x0, y0 + h);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a2a2c';
  ctx.beginPath();
  ctx.arc(cx, cy + (side === 'L' ? -h * 0.2 : h * 0.15), w * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

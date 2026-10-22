// 开机动画：原创“茶室 OS”标志 —— 一颗橙子 + 袅袅茶香
import { W, H, clamp, text, easeOutCubic, easeOutBack, lerp } from './ui.js';
import { drawLeaf } from './icons.js';

function bounceOut(t) {
  t = clamp(t, 0, 1);
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

export class Boot {
  constructor(os) {
    this.os = os;
    this.reset();
  }

  reset() {
    this.t = 0;
    this.sound = false;
    this.done = false;
  }

  update(dt, pad) {
    this.t += dt;
    if (!this.sound && this.t > 0.5) {
      this.sound = true;
      this.os.sfx.play('boot');
    }
    const skip = this.t > 1.4 && (pad.pressed.A || pad.pressed.B);
    if (!this.done && (this.t > 3.1 || skip)) {
      this.done = true;
      this.os.finishBoot();
    }
  }

  draw(c) {
    const t = this.t;
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    const bgA = clamp((t - 0.05) / 0.35, 0, 1);
    if (bgA <= 0) return;
    c.globalAlpha = bgA;
    const g = c.createRadialGradient(640, 300, 40, 640, 360, 760);
    g.addColorStop(0, '#fffaf3');
    g.addColorStop(1, '#ffe9d2');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.globalAlpha = 1;

    const cx = 640, cy = 290, r = 70;
    // 橙子落下并弹跳
    const dropT = clamp((t - 0.35) / 0.85, 0, 1);
    if (dropT > 0) {
      const y = lerp(-120, cy, bounceOut(dropT));
      // 投影
      const shadowS = clamp(1 - (cy - y) / 400, 0.2, 1);
      c.fillStyle = `rgba(160,90,40,${(0.18 * shadowS).toFixed(3)})`;
      c.beginPath();
      c.ellipse(cx, cy + r + 18, r * 0.9 * shadowS, 12 * shadowS, 0, 0, Math.PI * 2);
      c.fill();
      // 橙子本体
      const squash = dropT < 1 ? 1 : 1;
      c.save();
      c.translate(cx, y);
      c.scale(squash, 1 / squash);
      const og = c.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      og.addColorStop(0, '#ffc46e');
      og.addColorStop(0.6, '#ff8a1c');
      og.addColorStop(1, '#ec6608');
      c.fillStyle = og;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fill();
      // 橙瓣纹理（切面感的白色细线）
      const sliceA = clamp((t - 1.0) / 0.4, 0, 1);
      if (sliceA > 0) {
        c.globalAlpha = sliceA * 0.55;
        c.strokeStyle = '#fff4e0';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(0, 0, r * 0.72, 0, Math.PI * 2);
        c.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + 0.2;
          c.beginPath();
          c.moveTo(Math.cos(a) * r * 0.12, Math.sin(a) * r * 0.12);
          c.lineTo(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66);
          c.stroke();
        }
        c.globalAlpha = 1;
      }
      // 高光
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.beginPath();
      c.ellipse(-r * 0.4, -r * 0.42, r * 0.2, r * 0.11, -0.7, 0, Math.PI * 2);
      c.fill();
      // 叶子（弹出）
      const leafT = easeOutBack(clamp((t - 0.95) / 0.35, 0, 1));
      if (leafT > 0) {
        c.fillStyle = '#7a4a1e';
        c.fillRect(-3, -r - 12, 6, 16);
        drawLeaf(c, 18, -r - 12, 22 * leafT, -0.45, '#3fae4a');
      }
      c.restore();
    }

    // 茶香热气
    const steamA = clamp((t - 1.2) / 0.5, 0, 1);
    if (steamA > 0) {
      c.lineCap = 'round';
      c.lineWidth = 5;
      for (let k = 0; k < 2; k++) {
        const x0 = cx - 26 + k * 52;
        const phase = t * 1.6 + k * 1.3;
        c.strokeStyle = `rgba(200,140,90,${(0.35 * steamA).toFixed(3)})`;
        c.beginPath();
        for (let i = 0; i <= 20; i++) {
          const u = i / 20;
          const yy = cy - r - 30 - u * 70;
          const xx = x0 + Math.sin(u * 5 + phase) * 9 * (1 - u * 0.3);
          if (i === 0) c.moveTo(xx, yy);
          else c.lineTo(xx, yy);
        }
        c.stroke();
      }
    }

    // 文字
    const ta = easeOutCubic(clamp((t - 1.05) / 0.5, 0, 1));
    if (ta > 0) {
      c.globalAlpha = ta;
      text(c, '茶室 OS', cx, 440 + (1 - ta) * 24, 62, '#4a2f1d', 'center', 800);
      c.globalAlpha = 1;
    }
    const sa = easeOutCubic(clamp((t - 1.35) / 0.5, 0, 1));
    if (sa > 0) {
      c.globalAlpha = sa;
      c.save();
      c.font = `600 22px ${'"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",sans-serif'}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#c0703a';
      const letters = 'T E A R O O M';
      c.fillText(letters, cx, 498);
      c.restore();
      text(c, '来茶室坐坐，一起玩会儿游戏吧', cx, 560, 20, '#a88468', 'center', 500);
      c.globalAlpha = 1;
    }
  }
}

// 开机动画：原创“茶室 OS”标志 —— 八瓣橙子从四周飞来拼成一片橙子切面，果皮描边、叶子弹出、
// 光泽扫过，文字逐字落下，最后是袅袅茶香和加载点。整段约 4.2 秒，1.4 秒后可以按 A / B 跳过。
import { W, H, FONT, clamp, text, easeOutCubic, easeOutBack, easeInOut, lerp } from './ui.js';
import { drawLeaf } from './icons.js';

const DURATION = 4.2;
const CX = 640, CY = 268, R = 92;
const WEDGES = 8;

// 0 → 1 的局部进度
const span = (t, a, d) => clamp((t - a) / d, 0, 1);

function bounceOut(t) {
  t = clamp(t, 0, 1);
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

// 一瓣果肉：圆环扇形，两侧留出缝隙
function wedgePath(c, r0, r1, a0, a1) {
  const k = 0.06;
  c.beginPath();
  c.arc(0, 0, r1, a0 + k * 0.6, a1 - k * 0.6);
  c.arc(0, 0, r0, a1 - k * 2.2, a0 + k * 2.2, true);
  c.closePath();
}

export class Boot {
  constructor(os) {
    this.os = os;
    this.reset();
  }

  reset() {
    this.t = 0;
    this.sound = false;
    this.chime = false;
    this.done = false;
  }

  update(dt, pad) {
    this.t += dt;
    if (!this.sound && this.t > 0.45) {
      this.sound = true;
      this.os.sfx.play('boot');
    }
    if (!this.chime && this.t > 1.45) {
      this.chime = true;
      this.os.sfx.play('bootChime');
    }
    const skip = this.t > 1.4 && (pad.pressed.A || pad.pressed.B);
    if (!this.done && (this.t > DURATION || skip)) {
      this.done = true;
      this.os.finishBoot(true);
    }
  }

  draw(c) {
    const t = this.t;
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);

    // 背景：奶油色从中心圆形展开
    const bg = easeOutCubic(span(t, 0.18, 0.6));
    if (bg <= 0) return;
    c.save();
    c.beginPath();
    c.arc(CX, CY, 40 + bg * 1100, 0, Math.PI * 2);
    c.clip();
    const g = c.createRadialGradient(CX, CY, 30, CX, 360, 820);
    g.addColorStop(0, '#fffaf3');
    g.addColorStop(0.55, '#fff1e2');
    g.addColorStop(1, '#ffdcbc');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.restore();

    const logoOut = easeInOut(span(t, DURATION - 0.35, 0.35));   // 结尾轻轻放大淡出，交给系统转场
    c.save();
    c.globalAlpha = 1 - logoOut * 0.6;
    c.translate(CX, CY);
    c.scale(1 + logoOut * 0.04, 1 + logoOut * 0.04);
    this._drawLogo(c, t);
    c.restore();

    this._drawTitle(c, t, 1 - logoOut * 0.6);
    this._drawLoading(c, t);
  }

  _drawLogo(c, t) {
    // 落地阴影（随拼合程度变实）
    const settle = easeOutCubic(span(t, 0.5, 1.0));
    c.fillStyle = `rgba(170,96,40,${(0.16 * settle).toFixed(3)})`;
    c.beginPath();
    c.ellipse(0, R + 26, R * 0.95 * (0.6 + 0.4 * settle), 13, 0, 0, Math.PI * 2);
    c.fill();

    // 白色内皮底盘（果瓣拼好后出现）
    const pith = easeOutCubic(span(t, 1.0, 0.35));
    if (pith > 0) {
      c.fillStyle = `rgba(255,246,230,${pith.toFixed(3)})`;
      c.beginPath();
      c.arc(0, 0, R * 0.95, 0, Math.PI * 2);
      c.fill();
    }

    // 八瓣果肉：从四周旋转飞入
    const pulp = c.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 0.86);
    pulp.addColorStop(0, '#ffd27a');
    pulp.addColorStop(0.55, '#ffab3d');
    pulp.addColorStop(1, '#ff8a1c');
    for (let i = 0; i < WEDGES; i++) {
      const e = span(t, 0.42 + i * 0.06, 0.62);
      if (e <= 0) continue;
      const k = easeOutBack(e);
      const a0 = (i / WEDGES) * Math.PI * 2 - Math.PI / 2;
      const a1 = a0 + (Math.PI * 2) / WEDGES;
      const mid = (a0 + a1) / 2;
      const fly = (1 - k) * 330;
      c.save();
      c.globalAlpha *= clamp(e * 2.2, 0, 1);
      c.translate(Math.cos(mid) * fly, Math.sin(mid) * fly);
      c.rotate((1 - k) * (i % 2 ? 1.1 : -1.1));
      wedgePath(c, R * 0.13, R * 0.84, a0, a1);
      c.fillStyle = pulp;
      c.fill();
      // 果粒的细纹
      c.globalAlpha *= 0.35;
      c.strokeStyle = '#fff3d6';
      c.lineWidth = 2;
      for (let j = 1; j <= 2; j++) {
        const aa = a0 + ((a1 - a0) * j) / 3;
        c.beginPath();
        c.moveTo(Math.cos(aa) * R * 0.3, Math.sin(aa) * R * 0.3);
        c.lineTo(Math.cos(aa) * R * 0.72, Math.sin(aa) * R * 0.72);
        c.stroke();
      }
      c.restore();
    }

    // 果皮：沿圆周画一圈
    const rind = easeInOut(span(t, 1.02, 0.45));
    if (rind > 0) {
      c.lineCap = 'round';
      c.strokeStyle = '#f07210';
      c.lineWidth = R * 0.11;
      c.beginPath();
      c.arc(0, 0, R * 0.995, -Math.PI / 2, -Math.PI / 2 + rind * Math.PI * 2);
      c.stroke();
      c.strokeStyle = 'rgba(255,190,110,0.8)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, R * 1.03, -Math.PI / 2, -Math.PI / 2 + rind * Math.PI * 2);
      c.stroke();
    }

    // 果心
    const core = easeOutBack(span(t, 1.15, 0.3));
    if (core > 0) {
      c.fillStyle = '#fff6e6';
      c.beginPath();
      c.arc(0, 0, R * 0.1 * core, 0, Math.PI * 2);
      c.fill();
    }

    // 叶子和梗
    const leaf = easeOutBack(span(t, 1.38, 0.38));
    if (leaf > 0) {
      c.fillStyle = '#7a4a1e';
      c.fillRect(-3.5, -R - 18 * leaf, 7, 20 * leaf);
      drawLeaf(c, 22, -R - 14, 27 * leaf, -0.42, '#3fae4a');
    }

    // 光泽扫过（只在橙子范围内）
    const sweep = span(t, 1.75, 0.7);
    if (sweep > 0 && sweep < 1) {
      c.save();
      c.beginPath();
      c.arc(0, 0, R * 1.06, 0, Math.PI * 2);
      c.clip();
      c.rotate(-0.5);
      const x = lerp(-R * 1.8, R * 1.8, easeInOut(sweep));
      const lg = c.createLinearGradient(x - 40, 0, x + 40, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = lg;
      c.fillRect(-R * 2, -R * 2, R * 4, R * 4);
      c.restore();
    }

    // 茶香热气
    const steam = span(t, 1.7, 0.6);
    if (steam > 0) {
      c.lineCap = 'round';
      c.lineWidth = 5;
      for (let k = 0; k < 2; k++) {
        const x0 = -34 + k * 68;
        const phase = t * 1.6 + k * 1.3;
        c.strokeStyle = `rgba(200,140,90,${(0.32 * steam).toFixed(3)})`;
        c.beginPath();
        for (let i = 0; i <= 20; i++) {
          const u = (i / 20) * steam;
          const yy = -R - 38 - u * 74;
          const xx = x0 + Math.sin(u * 5 + phase) * 9 * (1 - u * 0.3);
          if (i === 0) c.moveTo(xx, yy);
          else c.lineTo(xx, yy);
        }
        c.stroke();
      }
    }
  }

  _drawTitle(c, t, alpha) {
    // “茶室 OS”：逐字从上方落下
    const title = ['茶', '室', ' ', 'O', 'S'];
    const size = 64;
    c.save();
    c.font = `800 ${size}px ${FONT}`;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    const widths = title.map((ch) => (ch === ' ' ? size * 0.3 : c.measureText(ch).width));
    let x = CX - widths.reduce((a, b) => a + b, 0) / 2;
    title.forEach((ch, i) => {
      const e = span(t, 1.45 + i * 0.07, 0.55);
      if (e > 0 && ch !== ' ') {
        c.globalAlpha = alpha * clamp(e * 3, 0, 1);
        c.fillStyle = '#4a2f1d';
        c.fillText(ch, x, 440 - (1 - bounceOut(e)) * 46);
      }
      x += widths[i];
    });

    // 英文副标：字距从宽收拢
    const s = easeOutCubic(span(t, 1.95, 0.7));
    if (s > 0) {
      const letters = 'TEAROOM';
      c.font = `600 22px ${FONT}`;
      const gap = lerp(34, 13, s);
      const ws = [...letters].map((ch) => c.measureText(ch).width);
      let lx = CX - (ws.reduce((a, b) => a + b, 0) + gap * (letters.length - 1)) / 2;
      c.globalAlpha = alpha * s;
      c.fillStyle = '#c0703a';
      [...letters].forEach((ch, i) => {
        c.fillText(ch, lx, 500);
        lx += ws[i] + gap;
      });
    }
    c.restore();

    const tag = easeOutCubic(span(t, 2.3, 0.6));
    if (tag > 0) {
      c.globalAlpha = alpha * tag;
      text(c, '来茶室坐坐，一起玩会儿游戏吧', CX, 556 + (1 - tag) * 10, 20, '#a88468', 'center', 500);
      c.globalAlpha = 1;
    }
  }

  _drawLoading(c, t) {
    const a = span(t, 2.6, 0.4) * (1 - span(t, DURATION - 0.3, 0.3));
    if (a <= 0) return;
    for (let i = 0; i < 3; i++) {
      const p = 0.5 + 0.5 * Math.sin(t * 6 - i * 0.9);
      c.fillStyle = `rgba(240,114,16,${(a * (0.25 + 0.6 * p)).toFixed(3)})`;
      c.beginPath();
      c.arc(CX - 22 + i * 22, 648, 5 + p * 1.5, 0, Math.PI * 2);
      c.fill();
    }
  }
}

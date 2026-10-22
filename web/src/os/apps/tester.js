// 手柄测试：实时显示所有按键与摇杆状态
import { W, H, clamp, text, textW, fillRR, strokeRR, rrect, drawHints, glyph, drawHouse } from '../ui.js';

const NAMES = {
  A: 'A', B: 'B', X: 'X', Y: 'Y', L: 'L', R: 'R', ZL: 'ZL', ZR: 'ZR',
  PLUS: '+', MINUS: '−', HOME: 'HOME', CAPTURE: '截图', LS: 'L 摇杆按下', RS: 'R 摇杆按下',
  UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→',
  SL_L: 'SL（左）', SR_L: 'SR（左）', SL_R: 'SL（右）', SR_R: 'SR（右）',
};
const ORDER = Object.keys(NAMES);

// 布局（像素）：Joy-Con 宽 140、高 400，主机 678×400
const JH = 400, JW = 140, CW = 678, GAP = 18;
const TOTAL = JW * 2 + CW + GAP * 2;
const X0 = (W - TOTAL) / 2;
const Y0 = 180;
const LX = X0, CX = X0 + JW + GAP, RX = CX + CW + GAP;

const BLUE = '#0ab9e6', RED = '#ff4b3e', HI = '#ffe14d';

function drawTesterTile(c, s) {
  const k = s / 256;
  c.save();
  c.scale(k, k);
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#f2f2f4');
  g.addColorStop(1, '#d9d9de');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  const joy = (x, color, left) => {
    c.fillStyle = color;
    c.beginPath();
    const y = 34, w = 62, h = 150, r = 30;
    if (left) {
      c.moveTo(x + w, y);
      c.lineTo(x + r, y);
      c.arcTo(x, y, x, y + r, r);
      c.lineTo(x, y + h - r);
      c.arcTo(x, y + h, x + r, y + h, r);
      c.lineTo(x + w, y + h);
    } else {
      c.moveTo(x, y);
      c.lineTo(x + w - r, y);
      c.arcTo(x + w, y, x + w, y + r, r);
      c.lineTo(x + w, y + h - r);
      c.arcTo(x + w, y + h, x + w - r, y + h, r);
      c.lineTo(x, y + h);
    }
    c.closePath();
    c.fill();
  };
  joy(52, BLUE, true);
  joy(142, RED, false);
  c.fillStyle = '#26262a';
  c.beginPath();
  c.arc(84, 82, 16, 0, Math.PI * 2);
  c.arc(172, 140, 16, 0, Math.PI * 2);
  c.fill();
  for (const [x, y] of [[84, 124], [72, 136], [96, 136], [84, 148]]) {
    c.beginPath();
    c.arc(x, y, 6.5, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = HI;
  for (const [x, y] of [[172, 68], [160, 80], [184, 80], [172, 92]]) {
    c.beginPath();
    c.arc(x, y, 6.5, 0, Math.PI * 2);
    c.fill();
  }
  text(c, '手柄测试', 128, 218, 34, '#3a3a3e', 'center', 800);
  c.restore();
}

export class Tester {
  static meta = { id: 'tester', name: '手柄测试', kind: 'system', color: '#ff4b3e', tile: drawTesterTile };

  constructor(os) {
    this.os = os;
    this.t = 0;
    this.pad = null;
    this.hold = 0;
    this.log = [];
    this.flash = {};
  }

  update(dt, pad) {
    this.t += dt;
    this.pad = pad;
    for (const b of ORDER) {
      if (pad.pressed[b]) {
        this.log.unshift(NAMES[b]);
        if (this.log.length > 8) this.log.pop();
        this.flash[b] = 1;
        this.os.sfx.play('tick', { minGap: 0 });
      }
      if (this.flash[b]) this.flash[b] = Math.max(0, this.flash[b] - dt * 3);
    }
    if (pad.down.PLUS && pad.down.MINUS) {
      this.hold += dt;
      if (this.hold >= 1) {
        this.hold = -10;
        this.os.sfx.play('back');
        this.os.exitApp();
      }
    } else if (this.hold > 0) this.hold = 0;
  }

  draw(c) {
    const th = this.os.theme;
    const p = this.pad || { down: {}, lx: 0, ly: 0, rx: 0, ry: 0 };
    const dn = p.down;
    c.fillStyle = th.bg;
    c.fillRect(0, 0, W, H);
    text(c, '手柄测试', 60, 56, 32, th.text, 'left', 700);
    text(c, '按下任意按键或推动摇杆，示意图会实时高亮', 230, 58, 19, th.sub, 'left', 500);

    this._shoulders(c, dn);
    this._joyL(c, dn, p);
    this._joyR(c, dn, p);
    this._rails(c, dn);
    this._console(c, dn, p, th);

    // 退出提示
    c.fillStyle = th.line;
    c.fillRect(32, 642, W - 64, 2);
    const hx = 60, hy = 686;
    glyph(c, 'PLUS', hx + 12, hy, 13, th.glyphBg, th.glyphFg);
    text(c, '+', hx + 30, hy, 19, th.text, 'left', 500);
    glyph(c, 'MINUS', hx + 58, hy, 13, th.glyphBg, th.glyphFg);
    text(c, '同时按住 1 秒退出', hx + 80, hy + 1, 19, th.text, 'left', 500);
    if (this.hold > 0) {
      c.strokeStyle = th.accent;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(hx + 270, hy, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(this.hold, 0, 1));
      c.stroke();
    }
    drawHints(c, [['HOME', '返回 HOME']], th);
  }

  _btn(c, on, flash, x, y, r, label, base = '#1f1f22') {
    if (on) {
      c.fillStyle = 'rgba(255,225,77,0.35)';
      c.beginPath();
      c.arc(x, y, r + 7, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = on ? HI : base;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    if (label) text(c, label, x, y + 1, r * 0.95, on ? '#222' : '#e8e8e8', 'center', 700);
  }

  _arrow(c, x, y, dir, color) {
    c.save();
    c.translate(x, y);
    c.rotate({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[dir]);
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, -6);
    c.lineTo(6, 4);
    c.lineTo(-6, 4);
    c.closePath();
    c.fill();
    c.restore();
  }

  _stick(c, x, y, sx, sy, pressed) {
    c.fillStyle = '#18181a';
    c.beginPath();
    c.arc(x, y, 40, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(x, y, 34, 0, Math.PI * 2);
    c.stroke();
    const ox = x + sx * 14, oy = y - sy * 14;
    if (pressed) {
      c.fillStyle = 'rgba(255,225,77,0.4)';
      c.beginPath();
      c.arc(ox, oy, 36, 0, Math.PI * 2);
      c.fill();
    }
    const g = c.createRadialGradient(ox - 8, oy - 8, 4, ox, oy, 28);
    g.addColorStop(0, pressed ? '#fff3a0' : '#4a4a4e');
    g.addColorStop(1, pressed ? HI : '#2a2a2d');
    c.fillStyle = g;
    c.beginPath();
    c.arc(ox, oy, 28, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = pressed ? '#c9a800' : 'rgba(255,255,255,0.15)';
    c.lineWidth = 2;
    for (const rr of [10, 18]) {
      c.beginPath();
      c.arc(ox, oy, rr, 0, Math.PI * 2);
      c.stroke();
    }
  }

  _body(c, x, color, left) {
    const r = 62;
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.save();
    c.translate(0, 6);
    this._bodyPath(c, x, r, left);
    c.fill();
    c.restore();
    this._bodyPath(c, x, r, left);
    c.fillStyle = color;
    c.fill();
  }

  _bodyPath(c, x, r, left) {
    const y = Y0;
    c.beginPath();
    if (left) {
      c.moveTo(x + JW, y);
      c.lineTo(x + r, y);
      c.arcTo(x, y, x, y + r, r);
      c.lineTo(x, y + JH - r);
      c.arcTo(x, y + JH, x + r, y + JH, r);
      c.lineTo(x + JW, y + JH);
    } else {
      c.moveTo(x, y);
      c.lineTo(x + JW - r, y);
      c.arcTo(x + JW, y, x + JW, y + r, r);
      c.lineTo(x + JW, y + JH - r);
      c.arcTo(x + JW, y + JH, x + JW - r, y + JH, r);
      c.lineTo(x, y + JH);
    }
    c.closePath();
  }

  _shoulders(c, dn) {
    const r = 62;
    const sh = (left, off, on, label) => {
      const x = left ? LX : RX, y = Y0;
      c.save();
      c.lineWidth = 15;
      c.lineCap = 'round';
      c.strokeStyle = on ? HI : '#2a2a2d';
      c.beginPath();
      if (left) {
        c.arc(x + r, y + r, r + off, Math.PI * 1.1, Math.PI * 1.5);
        c.lineTo(x + JW - 10, y - off);
      } else {
        c.moveTo(x + 10, y - off);
        c.lineTo(x + JW - r, y - off);
        c.arc(x + JW - r, y + r, r + off, Math.PI * 1.5, Math.PI * 1.9);
      }
      c.stroke();
      c.restore();
      text(c, label, left ? x + JW - 34 : x + 34, y - off + 1, 13, on ? '#222' : '#e8e8e8', 'center', 800);
    };
    sh(true, 40, dn.ZL, 'ZL');
    sh(true, 16, dn.L, 'L');
    sh(false, 40, dn.ZR, 'ZR');
    sh(false, 16, dn.R, 'R');
  }

  _joyL(c, dn, p) {
    const x = LX, y = Y0;
    this._body(c, x, BLUE, true);
    // − 键
    const mOn = dn.MINUS;
    fillRR(c, x + JW - 44, y + 30, 26, 10, 5, mOn ? HI : '#1f1f22');
    this._stick(c, x + 66, y + 112, p.lx, p.ly, dn.LS);
    // 方向键
    const dx = x + 66, dy = y + 258, off = 34;
    const dirs = [['UP', 0, -1, 'up'], ['DOWN', 0, 1, 'down'], ['LEFT', -1, 0, 'left'], ['RIGHT', 1, 0, 'right']];
    for (const [b, ox, oy, d] of dirs) {
      this._btn(c, dn[b], 0, dx + ox * off, dy + oy * off, 15, '');
      this._arrow(c, dx + ox * off, dy + oy * off, d, dn[b] ? '#222' : '#d8d8d8');
    }
    // 截图键
    const cOn = dn.CAPTURE;
    fillRR(c, x + JW - 50, y + 338, 24, 24, 5, cOn ? HI : '#1f1f22');
    c.strokeStyle = cOn ? '#222' : '#777';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(x + JW - 38, y + 350, 6, 0, Math.PI * 2);
    c.stroke();
  }

  _joyR(c, dn, p) {
    const x = RX, y = Y0;
    this._body(c, x, RED, false);
    // + 键
    const pOn = dn.PLUS;
    c.fillStyle = pOn ? HI : '#1f1f22';
    c.fillRect(x + 20, y + 30, 24, 9);
    c.fillRect(x + 27.5, y + 22.5, 9, 24);
    // ABXY
    const ax = x + 74, ay = y + 112, off = 34;
    this._btn(c, dn.X, 0, ax, ay - off, 16, 'X');
    this._btn(c, dn.A, 0, ax + off, ay, 16, 'A');
    this._btn(c, dn.B, 0, ax, ay + off, 16, 'B');
    this._btn(c, dn.Y, 0, ax - off, ay, 16, 'Y');
    this._stick(c, x + 74, y + 258, p.rx, p.ry, dn.RS);
    // HOME
    const hOn = dn.HOME;
    c.fillStyle = '#1f1f22';
    c.beginPath();
    c.arc(x + 38, y + 350, 16, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = hOn ? HI : '#55555a';
    c.lineWidth = 2.5;
    c.stroke();
    drawHouse(c, x + 38, y + 350, 15, hOn ? HI : '#d8d8d8');
  }

  _rails(c, dn) {
    const pill = (x, y, on, label) => {
      fillRR(c, x, y, 12, 54, 6, on ? HI : '#3a3a3e');
      c.save();
      c.translate(x + 6, y + 27);
      c.rotate(-Math.PI / 2);
      text(c, label, 0, 1, 11, on ? '#222' : '#ccc', 'center', 700);
      c.restore();
    };
    const lx = LX + JW + 3, rx = RX - 15;
    pill(lx, Y0 + 46, dn.SL_L, 'SL');
    pill(lx, Y0 + JH - 100, dn.SR_L, 'SR');
    pill(rx, Y0 + 46, dn.SR_R, 'SR');
    pill(rx, Y0 + JH - 100, dn.SL_R, 'SL');
  }

  _console(c, dn, p, th) {
    const x = CX, y = Y0, w = CW, h = JH;
    fillRR(c, x, y + 6, w, h, 8, 'rgba(0,0,0,0.15)');
    fillRR(c, x, y, w, h, 8, '#1b1b1d');
    const sx = x + 66, sy = y + 46, sw = w - 132, sh = h - 92;
    fillRR(c, sx, sy, sw, sh, 4, '#0f1012');
    // 摇杆数值
    const gauge = (gx, gy, vx, vy, label, pressed) => {
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(gx, gy, 62, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(gx - 62, gy);
      c.lineTo(gx + 62, gy);
      c.moveTo(gx, gy - 62);
      c.lineTo(gx, gy + 62);
      c.stroke();
      const px = gx + vx * 62, py = gy - vy * 62;
      c.strokeStyle = th.accent;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(gx, gy);
      c.lineTo(px, py);
      c.stroke();
      c.fillStyle = pressed ? HI : th.accent;
      c.beginPath();
      c.arc(px, py, 9, 0, Math.PI * 2);
      c.fill();
      text(c, label, gx, gy - 84, 18, '#ddd', 'center', 600);
      text(c, `X ${vx >= 0 ? ' ' : ''}${vx.toFixed(2)}   Y ${vy >= 0 ? ' ' : ''}${vy.toFixed(2)}`, gx, gy + 88, 16, '#bbb', 'center', 500);
    };
    gauge(sx + sw * 0.25, sy + 132, p.lx, p.ly, '左摇杆', dn.LS);
    gauge(sx + sw * 0.75, sy + 132, p.rx, p.ry, '右摇杆', dn.RS);
    // 当前按住
    const held = ORDER.filter((b) => dn[b]).map((b) => NAMES[b]);
    const line = held.length ? held.join('  ') : '（没有按住的按键）';
    text(c, '按住中：', sx + 20, sy + sh - 52, 16, '#999', 'left', 500);
    text(c, line, sx + 92, sy + sh - 52, 16, held.length ? HI : '#666', 'left', 600);
    text(c, '最近：', sx + 20, sy + sh - 24, 16, '#999', 'left', 500);
    text(c, this.log.join('  ') || '—', sx + 92, sy + sh - 24, 16, '#ccc', 'left', 500);
  }
}

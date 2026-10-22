// 系统设置：亮度 / 音量 / 主题 / 按键说明 / 关于
import { KEY_HELP } from '../../input.js';
import { W, H, clamp, damp, text, textW, fillRR, strokeRR, rrect, drawHints, Nav, glyph } from '../ui.js';
import { iconGear, iconSpeaker, iconTheme, drawOrange, drawAvatar } from '../icons.js';

const ITEMS = [
  { id: 'brightness', label: '屏幕亮度' },
  { id: 'volume', label: '音量' },
  { id: 'theme', label: '主题' },
  { id: 'keys', label: '按键说明' },
  { id: 'about', label: '关于本机' },
];

const SIDE_W = 380;

export class Settings {
  static meta = { id: 'settings', name: '系统设置', kind: 'system' };

  constructor(os) {
    this.os = os;
    this.sel = 0;
    this.nav = new Nav(0.34, 0.07);
    this.t = 0;
    this.selY = 0;
    this.changeT = 0;
  }

  update(dt, pad) {
    this.t += dt;
    this.changeT = Math.max(0, this.changeT - dt);
    const os = this.os;
    const d = this.nav.update(dt, pad);
    if (d === 'up' && this.sel > 0) { this.sel--; os.sfx.play('tick'); }
    if (d === 'down' && this.sel < ITEMS.length - 1) { this.sel++; os.sfx.play('tick'); }
    const id = ITEMS[this.sel].id;
    if (d === 'left' || d === 'right') {
      const dir = d === 'left' ? -1 : 1;
      if (id === 'brightness') {
        const v = clamp(Math.round((os.settings.brightness + dir * 0.05) * 100) / 100, 0.1, 1);
        if (v !== os.settings.brightness) { os.setSetting('brightness', v); os.sfx.play('tick'); this.changeT = 0.3; }
      } else if (id === 'volume') {
        const v = clamp(os.settings.volume + dir, 0, 16);
        if (v !== os.settings.volume) { os.setSetting('volume', v); os.sfx.play('vol', { minGap: 0 }); this.changeT = 0.3; }
      } else if (id === 'theme') {
        const want = dir < 0 ? 'light' : 'dark';
        if (want !== os.settings.theme) { os.setSetting('theme', want); os.sfx.play('confirm'); }
      }
    }
    if (pad.pressed.A && id === 'theme') {
      os.setSetting('theme', os.settings.theme === 'dark' ? 'light' : 'dark');
      os.sfx.play('confirm');
    }
    if (pad.pressed.B) {
      os.sfx.play('back');
      os.exitApp();
    }
    this.selY = damp(this.selY, this.sel, 20, dt);
  }

  draw(c) {
    const os = this.os;
    const th = os.theme;
    c.fillStyle = th.bg;
    c.fillRect(0, 0, W, H);
    // 侧栏
    c.fillStyle = th.panel;
    c.fillRect(0, 0, SIDE_W, H);
    c.fillStyle = th.line;
    c.fillRect(SIDE_W, 0, 2, H);
    iconGear(c, 62, 62, 46, th.iconFg, th.panel);
    text(c, '系统设置', 98, 62, 30, th.text, 'left', 700);
    c.fillStyle = th.line;
    c.fillRect(30, 108, SIDE_W - 60, 2);
    const iy0 = 136, ih = 70;
    const sy = iy0 + this.selY * ih;
    fillRR(c, 24, sy, SIDE_W - 48, 58, 10, th.selBg);
    c.fillStyle = th.accent;
    fillRR(c, 30, sy + 12, 5, 34, 3, th.accent);
    for (let i = 0; i < ITEMS.length; i++) {
      const sel = i === this.sel;
      text(c, ITEMS[i].label, 56, iy0 + i * ih + 30, 24, sel ? th.accent : th.text, 'left', sel ? 700 : 500);
    }

    // 右侧内容
    const px = SIDE_W + 60, pw = W - SIDE_W - 120;
    const id = ITEMS[this.sel].id;
    text(c, ITEMS[this.sel].label, px, 62, 30, th.text, 'left', 700);
    c.fillStyle = th.line;
    c.fillRect(px, 108, pw, 2);
    if (id === 'brightness') this._slider(c, px, 220, pw, (os.settings.brightness - 0.1) / 0.9,
      `${Math.round(os.settings.brightness * 100)}%`, '调整屏幕的明亮程度。在 3D 查看器里，屏幕发光强度会随之变化。', th, 'sun');
    else if (id === 'volume') this._slider(c, px, 220, pw, os.settings.volume / 16,
      `${os.settings.volume} / 16`, '调整系统与游戏音效的音量。也可以随时按机身顶部的音量键（键盘 ] / [）。', th, 'speaker');
    else if (id === 'theme') this._theme(c, px, 160, pw, th);
    else if (id === 'keys') this._keys(c, px, 128, pw, th);
    else if (id === 'about') this._about(c, px, 140, pw, th);

    c.fillStyle = th.line;
    c.fillRect(SIDE_W + 30, 642, W - SIDE_W - 60, 2);
    const hints = [];
    if (id === 'brightness' || id === 'volume' || id === 'theme') hints.push(['DPAD', '调整']);
    if (id === 'theme') hints.push(['A', '切换']);
    hints.push(['B', '返回']);
    drawHints(c, hints, th);
  }

  _slider(c, x, y, w, v, label, desc, th, icon) {
    text(c, desc, x, y - 60, 20, th.sub, 'left', 500);
    const bx = x + 70, bw = w - 200, by = y + 40;
    if (icon === 'sun') {
      iconTheme(c, x + 24, by, 34, th.sub, false, th.bg);
      iconTheme(c, bx + bw + 50, by, 52, th.text, false, th.bg);
    } else {
      iconSpeaker(c, x + 24, by, 40, th.sub, 0.3);
      iconSpeaker(c, bx + bw + 50, by, 48, th.text, 1);
    }
    fillRR(c, bx, by - 6, bw, 12, 6, th.line);
    fillRR(c, bx, by - 6, Math.max(12, bw * v), 12, 6, th.accent);
    const kx = bx + bw * v;
    const s = 1 + this.changeT * 0.6;
    c.fillStyle = th.shadow;
    c.beginPath();
    c.arc(kx, by + 3, 20 * s, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(kx, by, 20 * s, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = th.accent;
    c.lineWidth = 4;
    c.stroke();
    text(c, label, bx + bw / 2, by + 74, 34, th.text, 'center', 700);
  }

  _theme(c, x, y, w, th) {
    text(c, '选择 HOME 菜单与系统界面的配色。', x, y - 10, 20, th.sub, 'left', 500);
    const cw = 300, ch = 210, gap = 40;
    const opts = [
      { id: 'light', label: '白色', bg: '#ebebeb', fg: '#2d2d2d', card: '#fff' },
      { id: 'dark', label: '黑色', bg: '#2b2b2d', fg: '#fff', card: '#454548' },
    ];
    opts.forEach((o, i) => {
      const cx = x + i * (cw + gap);
      const cy = y + 30;
      fillRR(c, cx + 2, cy + 6, cw, ch, 14, th.shadow);
      fillRR(c, cx, cy, cw, ch, 14, o.bg);
      // 迷你 HOME 预览
      drawAvatar(c, cx + 34, cy + 30, 14);
      for (let k = 0; k < 4; k++) fillRR(c, cx + 22 + k * 68, cy + 62, 58, 58, 6, k === 0 ? '#ff9a3c' : o.card);
      for (let k = 0; k < 5; k++) {
        c.fillStyle = o.card;
        c.beginPath();
        c.arc(cx + 70 + k * 40, cy + 156, 13, 0, Math.PI * 2);
        c.fill();
      }
      text(c, o.label, cx + cw / 2, cy + ch + 36, 24, th.text, 'center', 700);
      if (this.os.settings.theme === o.id) {
        const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(this.t * 4.2));
        c.globalAlpha = pulse;
        strokeRR(c, cx - 7, cy - 7, cw + 14, ch + 14, 18, th.accent, 5);
        c.globalAlpha = 1;
        c.fillStyle = th.accent;
        c.beginPath();
        c.arc(cx + cw - 22, cy + 22, 14, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#fff';
        c.lineWidth = 3.5;
        c.beginPath();
        c.moveTo(cx + cw - 29, cy + 22);
        c.lineTo(cx + cw - 24, cy + 28);
        c.lineTo(cx + cw - 15, cy + 16);
        c.stroke();
      }
    });
  }

  _keys(c, x, y, w, th) {
    text(c, '在 3D 查看器里，键盘按键会映射为手柄按键（也可以直接用鼠标点 3D 模型上的按键）。', x, y + 18, 17, th.sub, 'left', 500);
    const half = Math.ceil(KEY_HELP.length / 2);
    const colW = (w - 30) / 2;
    const rowH = 51;
    for (let i = 0; i < KEY_HELP.length; i++) {
      const col = i < half ? 0 : 1;
      const row = i < half ? i : i - half;
      const cx = x + col * (colW + 30);
      const cy = y + 50 + row * rowH;
      fillRR(c, cx, cy, colW, rowH - 8, 10, th.panel);
      const [btn, keys] = KEY_HELP[i];
      text(c, btn, cx + 16, cy + (rowH - 8) / 2 + 1, 18, th.accent, 'left', 700);
      let size = 18;
      while (textW(c, keys, size, 500) > colW - 150 && size > 12) size--;
      text(c, keys, cx + colW - 16, cy + (rowH - 8) / 2 + 1, size, th.text, 'right', 500);
    }
  }

  _about(c, x, y, w, th) {
    drawOrange(c, x + 60, y + 70, 46);
    text(c, '茶室 OS', x + 140, y + 50, 40, th.text, 'left', 800);
    text(c, '版本 1.0 · 运行在 three.js 3D 模型的屏幕纹理上', x + 140, y + 96, 20, th.sub, 'left', 500);
    const lines = [
      ['屏幕', '1280 × 720（与原版掌机屏幕分辨率相同）'],
      ['内置软件', '橙子冒险、星际射击、打砖块、贪吃蛇、2048'],
      ['系统工具', '相册、手柄测试、系统设置'],
      ['美术与音效', '全部由代码实时绘制 / 合成，没有使用任何图片或音频文件'],
    ];
    lines.forEach(([k, v], i) => {
      const ly = y + 170 + i * 56;
      text(c, k, x, ly, 20, th.sub, 'left', 600);
      text(c, v, x + 130, ly, 20, th.text, 'left', 500);
      c.fillStyle = th.line;
      c.fillRect(x, ly + 26, w, 1);
    });
    fillRR(c, x, y + 400, w, 76, 12, th.selBg);
    text(c, '非官方粉丝作品，与任天堂无关；所有游戏与美术均为原创程序绘制。', x + 24, y + 426, 19, th.text, 'left', 600);
    text(c, '“Nintendo Switch”及相关名称是任天堂的商标，此处仅用于描述外观参照。', x + 24, y + 456, 16, th.sub, 'left', 500);
  }
}

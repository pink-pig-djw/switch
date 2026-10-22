// HOME 菜单：顶部状态栏 + 横向游戏磁贴 + 圆形系统图标 + 底部提示
import { GAMES, SYSTEM_APPS } from './registry.js';
import {
  W, H, clamp, damp, text, fillRR, strokeRR, rrect, drawHints, Nav, makeCanvas, pad2, easeOutCubic,
} from './ui.js';
import {
  drawAvatar, iconAlbum, iconTheme, iconGear, iconPower, iconWifi, iconHandheld,
} from './icons.js';

const TILE = 252;
const GAP = 22;
const ROW_X = 96;
const ROW_Y = 150;
const ICON_Y = 534;
const ICON_R = 40;
const ICON_GAP = 112;
const CACHE = 272;

export class Home {
  constructor(os) {
    this.os = os;
    this.t = 0;
    this.enterT = 1;
    this.row = 0;
    this.sel = 0;
    this.iconSel = 0;
    this.scroll = 0;
    this.nav = new Nav();
    this.bump = 0;
    this.bumpDir = 0;
    this.tileScale = GAMES.map(() => 1);
    this.iconScale = [];
    this.icons = [
      { id: 'album', name: '相册', color: '#2f8fff', draw: (c, x, y, s, th) => iconAlbum(c, x, y, s, '#2f8fff') },
      { id: 'theme', name: '切换主题', color: '#ffae00', draw: (c, x, y, s, th) => iconTheme(c, x, y, s, '#ffae00', th.id === 'dark', th.iconBg) },
      { id: 'settings', name: '系统设置', color: '#8e8e93', draw: (c, x, y, s, th) => iconGear(c, x, y, s, th.iconFg, th.iconBg) },
      { id: 'sleep', name: '睡眠模式', color: '#8e8e93', draw: (c, x, y, s, th) => iconPower(c, x, y, s, th.iconFg) },
    ];
    this.iconScale = this.icons.map(() => 1);
    this.tiles = GAMES.map((cls) => {
      const cv = makeCanvas(CACHE, CACHE);
      const cc = cv.getContext('2d');
      try {
        cls.meta.tile(cc, CACHE);
      } catch (e) {
        cc.fillStyle = cls.meta.color || '#888';
        cc.fillRect(0, 0, CACHE, CACHE);
      }
      return cv;
    });
  }

  onEnter() {
    this.enterT = 0;
    this.nav.reset();
  }

  update(dt, pad) {
    this.t += dt;
    this.enterT += dt;
    const os = this.os;
    const d = this.nav.update(dt, pad);
    if (this.row === 0) {
      if (d === 'left') {
        if (this.sel > 0) { this.sel--; os.sfx.play('tick'); } else this._bump(-1);
      } else if (d === 'right') {
        if (this.sel < GAMES.length - 1) { this.sel++; os.sfx.play('tick'); } else this._bump(1);
      } else if (d === 'down') {
        this.row = 1;
        os.sfx.play('tick');
      } else if (d === 'up') this._bump(0);
      if (pad.pressed.A) os.launch(GAMES[this.sel]);
      else if (pad.pressed.X && os.suspended && os.suspended.constructor === GAMES[this.sel]) os.closeSuspended();
    } else {
      if (d === 'left') {
        if (this.iconSel > 0) { this.iconSel--; os.sfx.play('tick'); } else this._bump(-1);
      } else if (d === 'right') {
        if (this.iconSel < this.icons.length - 1) { this.iconSel++; os.sfx.play('tick'); } else this._bump(1);
      } else if (d === 'up') {
        this.row = 0;
        os.sfx.play('tick');
      }
      if (pad.pressed.A) this._activate(this.icons[this.iconSel]);
    }
    if (pad.pressed.B && !pad.pressed.A) os.sfx.play('move');

    // 让选中的磁贴保持在可视范围内
    const x = ROW_X + this.sel * (TILE + GAP);
    let target = this.scroll;
    const left = ROW_X, right = W - ROW_X;
    if (x - target < left) target = x - left;
    if (x + TILE - target > right) target = x + TILE - right;
    const maxScroll = Math.max(0, ROW_X + GAMES.length * (TILE + GAP) - GAP - right);
    target = clamp(target, 0, maxScroll);
    this.scroll = damp(this.scroll, target, 14, dt);
    for (let i = 0; i < GAMES.length; i++) {
      const want = this.row === 0 && i === this.sel ? 1.045 : 1;
      this.tileScale[i] = damp(this.tileScale[i], want, 18, dt);
    }
    for (let i = 0; i < this.icons.length; i++) {
      const want = this.row === 1 && i === this.iconSel ? 1.1 : 1;
      this.iconScale[i] = damp(this.iconScale[i], want, 18, dt);
    }
    this.bump = Math.max(0, this.bump - dt * 5);
  }

  _bump(dir) {
    this.bump = 1;
    this.bumpDir = dir;
  }

  _activate(icon) {
    const os = this.os;
    switch (icon.id) {
      case 'album': os.launch(SYSTEM_APPS.album); break;
      case 'settings': os.launch(SYSTEM_APPS.settings); break;
      case 'theme': {
        const next = os.settings.theme === 'dark' ? 'light' : 'dark';
        os.setSetting('theme', next);
        os.sfx.play('confirm');
        os.toast(next === 'dark' ? '已切换为黑色主题' : '已切换为白色主题', { silent: true });
        break;
      }
      case 'sleep': os.sleep(); break;
      default: break;
    }
  }

  draw(c) {
    const os = this.os;
    const th = os.theme;
    c.fillStyle = th.bg;
    c.fillRect(0, 0, W, H);
    const enter = easeOutCubic(this.enterT / 0.35);
    const bumpX = this.bump > 0 ? Math.sin(this.bump * Math.PI) * 10 * this.bumpDir : 0;
    const bumpY = this.bump > 0 && this.bumpDir === 0 ? -Math.sin(this.bump * Math.PI) * 8 : 0;

    // —— 顶部状态栏 ——
    drawAvatar(c, 80, 62, 36);
    strokeRR(c, 44, 26, 72, 72, 36, th.id === 'dark' ? '#5a5a5e' : '#ffffff', 3);
    const now = new Date();
    const hr = now.getHours();
    const greet = hr < 6 ? '夜深了，早点休息哦' : hr < 11 ? '早上好' : hr < 14 ? '中午好' : hr < 18 ? '下午好' : '晚上好';
    text(c, greet, 136, 54, 22, th.text, 'left', 600);
    text(c, '欢迎回到茶室', 136, 82, 17, th.sub, 'left', 500);

    const timeStr = `${pad2(hr)}:${pad2(now.getMinutes())}`;
    let bx = 1196;
    os._drawBattery(c, bx, 51, th.text);
    const tw = 74;
    text(c, timeStr, bx - 72, 62, 28, th.text, 'right', 500);
    iconWifi(c, bx - 72 - tw - 22, 60, 30, th.text);

    // —— 游戏磁贴 ——
    c.save();
    c.globalAlpha = enter;
    const rowY = ROW_Y + (1 - enter) * 16;
    for (let i = 0; i < GAMES.length; i++) {
      const sel = i === this.sel;
      const s = this.tileScale[i];
      const x0 = ROW_X + i * (TILE + GAP) - this.scroll + (sel && this.row === 0 ? bumpX : 0);
      const cx = x0 + TILE / 2, cy = rowY + TILE / 2 + (sel && this.row === 0 ? bumpY : 0);
      const ts = TILE * s;
      const x = cx - ts / 2, y = cy - ts / 2;
      if (x > W + 20 || x + ts < -20) continue;
      // 阴影
      fillRR(c, x + 2, y + 6, ts, ts, 10, th.shadow);
      c.save();
      rrect(c, x, y, ts, ts, 10);
      c.clip();
      c.drawImage(this.tiles[i], x, y, ts, ts);
      c.restore();
      const susp = os.suspended && os.suspended.constructor === GAMES[i];
      if (susp) {
        fillRR(c, x + 12, y + 12, 104, 34, 17, 'rgba(0,0,0,0.62)');
        c.fillStyle = '#fff';
        c.fillRect(x + 26, y + 21, 5, 16);
        c.fillRect(x + 35, y + 21, 5, 16);
        text(c, '暂停中', x + 50, y + 30, 17, '#fff', 'left', 600);
      }
      if (sel && this.row === 0) {
        const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(this.t * 4.2));
        strokeRR(c, x - 4, y - 4, ts + 8, ts + 8, 13, '#ffffff', 3);
        c.globalAlpha = enter * pulse;
        strokeRR(c, x - 8, y - 8, ts + 16, ts + 16, 16, th.accent, 5);
        c.globalAlpha = enter;
      }
    }
    // 选中游戏的名字
    if (this.row === 0) {
      const x0 = ROW_X + this.sel * (TILE + GAP) - this.scroll;
      const meta = GAMES[this.sel].meta;
      text(c, meta.name, clamp(x0 + TILE / 2, 160, W - 160), rowY + TILE + 42, 26, th.accent, 'center', 700);
    } else {
      const meta = GAMES[this.sel].meta;
      const x0 = ROW_X + this.sel * (TILE + GAP) - this.scroll;
      text(c, meta.name, clamp(x0 + TILE / 2, 160, W - 160), rowY + TILE + 42, 22, th.sub, 'center', 500);
    }
    c.restore();

    // —— 系统图标 ——
    const n = this.icons.length;
    const startX = W / 2 - ((n - 1) * ICON_GAP) / 2;
    for (let i = 0; i < n; i++) {
      const ic = this.icons[i];
      const sel = this.row === 1 && i === this.iconSel;
      const s = this.iconScale[i];
      const cx = startX + i * ICON_GAP + (sel ? bumpX : 0);
      const cy = ICON_Y + (1 - enter) * 20;
      const r = ICON_R * s;
      c.fillStyle = th.shadow;
      c.beginPath();
      c.arc(cx, cy + 4, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = th.iconBg;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();
      ic.draw(c, cx, cy, r * 1.25, th);
      if (sel) {
        const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(this.t * 4.2));
        c.strokeStyle = '#ffffff';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(cx, cy, r + 4, 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = pulse;
        c.strokeStyle = th.accent;
        c.lineWidth = 5;
        c.beginPath();
        c.arc(cx, cy, r + 9, 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 1;
        text(c, ic.name, cx, cy + r + 28, 20, th.accent, "center", 700);
      }
    }

    // —— 底栏 ——
    c.fillStyle = th.line;
    c.fillRect(32, 642, W - 64, 2);
    iconHandheld(c, 74, 684, 54, th.text, os.joycon.L, os.joycon.R, os.docked);
    const mode = os.docked ? 'TV 模式' : (!os.joycon.L || !os.joycon.R) ? '手柄已拆下' : '掌机模式';
    text(c, mode, 112, 685, 19, th.sub, 'left', 500);
    const hints = [];
    if (this.row === 0) {
      const susp = os.suspended && os.suspended.constructor === GAMES[this.sel];
      if (susp) hints.push(['X', '关闭软件']);
      hints.push(['A', susp ? '继续' : '开始']);
    } else hints.push(['A', '打开']);
    hints.push(['B', '返回']);
    drawHints(c, hints, th);
  }
}

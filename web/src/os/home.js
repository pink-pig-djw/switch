// HOME 菜单（参照真机布局，图标与美术均为原创）：
// 顶栏头像 + 时间/Wi-Fi/电量，中间一排大磁贴，下方一排圆形系统按钮，底栏手柄图标 + 按键提示
import { GAMES, SYSTEM_APPS } from './registry.js';
import { W, H, clamp, damp, text, fillRR, strokeRR, rrect, drawHints, Nav, makeCanvas, pad2, easeOutCubic } from './ui.js';
import {
  drawAvatar, drawAvatarTea, drawAvatarCat, lineNews, lineAlbum, lineControllers, lineGear, linePower, iconWifi, iconHandheld,
} from './icons.js';

const TILE = 256;
const GAP = 12;
const ROW_X = 100;
const ROW_Y = 150;
const BTN_Y = 528;
const BTN_R = 35;
const BTN_GAP = 92;

export class Home {
  constructor(os) {
    this.os = os;
    this.t = 0;
    this.enterT = 1;
    this.row = 0;
    this.sel = 0;
    this.btnSel = 0;
    this.scroll = 0;
    this.nav = new Nav();
    this.bump = 0;
    this.bumpDir = 0;
    this.tileScale = GAMES.map(() => 1);
    this.buttons = [
      { id: 'news', name: '新闻', color: '#e8453c', draw: lineNews },
      { id: 'album', name: '相册', color: '#2f8fff', draw: lineAlbum },
      { id: 'tester', name: '手柄', color: null, draw: lineControllers },
      { id: 'settings', name: '系统设置', color: null, draw: lineGear },
      { id: 'sleep', name: '睡眠模式', color: null, draw: linePower },
    ];
    this.btnScale = this.buttons.map(() => 1);
    this.tiles = GAMES.map((cls) => {
      const cv = makeCanvas(TILE, TILE);
      const cc = cv.getContext('2d');
      try {
        cls.meta.tile(cc, TILE);
      } catch (e) {
        console.error(e);
        cc.fillStyle = cls.meta.color || '#888';
        cc.fillRect(0, 0, TILE, TILE);
      }
      return cv;
    });
  }

  onEnter() {
    this.enterT = 0;
    this.nav.reset();
  }

  tileX(i) {
    return ROW_X + i * (TILE + GAP) - this.scroll;
  }

  btnX(i) {
    return W / 2 + (i - (this.buttons.length - 1) / 2) * BTN_GAP;
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
        if (this.btnSel > 0) { this.btnSel--; os.sfx.play('tick'); } else this._bump(-1);
      } else if (d === 'right') {
        if (this.btnSel < this.buttons.length - 1) { this.btnSel++; os.sfx.play('tick'); } else this._bump(1);
      } else if (d === 'up') {
        this.row = 0;
        os.sfx.play('tick');
      }
      if (pad.pressed.A) this.activate(this.buttons[this.btnSel]);
    }

    // 让选中的磁贴保持在可视范围内
    const x = ROW_X + this.sel * (TILE + GAP);
    let target = this.scroll;
    const left = ROW_X, right = W - ROW_X;
    if (x - target < left) target = x - left;
    if (x + TILE - target > right) target = x + TILE - right;
    const maxScroll = Math.max(0, ROW_X + GAMES.length * (TILE + GAP) - GAP - right);
    this.scroll = damp(this.scroll, clamp(target, 0, maxScroll), 14, dt);
    for (let i = 0; i < GAMES.length; i++) {
      this.tileScale[i] = damp(this.tileScale[i], this.row === 0 && i === this.sel ? 1.025 : 1, 18, dt);
    }
    for (let i = 0; i < this.buttons.length; i++) {
      this.btnScale[i] = damp(this.btnScale[i], this.row === 1 && i === this.btnSel ? 1.08 : 1, 18, dt);
    }
    this.bump = Math.max(0, this.bump - dt * 5);
  }

  // 触摸：点磁贴 = 选中，再点一次 = 启动；点圆形按钮 = 打开
  tap(x, y) {
    const os = this.os;
    for (let i = 0; i < GAMES.length; i++) {
      const tx = this.tileX(i);
      if (x >= tx && x <= tx + TILE && y >= ROW_Y && y <= ROW_Y + TILE) {
        if (this.row === 0 && this.sel === i) os.launch(GAMES[i]);
        else {
          this.row = 0;
          this.sel = i;
          os.sfx.play('tick');
        }
        return true;
      }
    }
    for (let i = 0; i < this.buttons.length; i++) {
      const bx = this.btnX(i);
      if (Math.hypot(x - bx, y - BTN_Y) <= BTN_R + 8) {
        this.row = 1;
        this.btnSel = i;
        this.activate(this.buttons[i]);
        return true;
      }
    }
    return false;
  }

  _bump(dir) {
    this.bump = 1;
    this.bumpDir = dir;
  }

  activate(btn) {
    const os = this.os;
    switch (btn.id) {
      case 'news': os.launch(SYSTEM_APPS.news); break;
      case 'album': os.launch(SYSTEM_APPS.album); break;
      case 'tester': os.launch(SYSTEM_APPS.tester); break;
      case 'settings': os.launch(SYSTEM_APPS.settings); break;
      case 'sleep': os.sfx.play('confirm'); os.sleep(); break;
      default: break;
    }
  }

  draw(c) {
    const os = this.os;
    const th = os.theme;
    const dark = th.id === 'dark';
    c.fillStyle = th.bg;
    c.fillRect(0, 0, W, H);
    const enter = easeOutCubic(this.enterT / 0.32);
    const bumpX = this.bump > 0 ? Math.sin(this.bump * Math.PI) * 9 * this.bumpDir : 0;
    const bumpY = this.bump > 0 && this.bumpDir === 0 ? -Math.sin(this.bump * Math.PI) * 7 : 0;

    // —— 顶栏：用户头像 ——
    const avatars = [drawAvatar, drawAvatarTea, drawAvatarCat];
    avatars.forEach((fn, i) => {
      const ax = 76 + i * 82, ay = 62;
      c.fillStyle = th.shadow;
      c.beginPath();
      c.arc(ax, ay + 3, 34, 0, Math.PI * 2);
      c.fill();
      fn(c, ax, ay, 33);
      c.strokeStyle = dark ? '#5a5a5e' : '#ffffff';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(ax, ay, 33, 0, Math.PI * 2);
      c.stroke();
    });
    // —— 顶栏：时间 / Wi-Fi / 电量 ——
    const now = new Date();
    os._drawBattery(c, 1196, 51, th.text);
    iconWifi(c, 1110, 60, 28, th.text);
    text(c, `${pad2(now.getHours())}:${pad2(now.getMinutes())}`, 1082, 62, 28, th.text, 'right', 500);

    // —— 磁贴 ——
    c.save();
    c.globalAlpha = enter;
    const rowY = ROW_Y + (1 - enter) * 12;
    for (let i = 0; i < GAMES.length; i++) {
      const focus = this.row === 0 && i === this.sel;
      const s = this.tileScale[i];
      const x0 = this.tileX(i) + (focus ? bumpX : 0);
      const cx = x0 + TILE / 2, cy = rowY + TILE / 2 + (focus ? bumpY : 0);
      const ts = TILE * s;
      const x = cx - ts / 2, y = cy - ts / 2;
      if (x > W + 20 || x + ts < -20) continue;
      fillRR(c, x + 1, y + 4, ts, ts, 4, th.shadow);
      c.save();
      rrect(c, x, y, ts, ts, 4);
      c.clip();
      c.drawImage(this.tiles[i], x, y, ts, ts);
      c.restore();
      if (os.suspended && os.suspended.constructor === GAMES[i]) {
        fillRR(c, x + 10, y + ts - 44, 100, 32, 16, 'rgba(0,0,0,0.66)');
        c.fillStyle = '#fff';
        c.fillRect(x + 24, y + ts - 36, 5, 16);
        c.fillRect(x + 33, y + ts - 36, 5, 16);
        text(c, '暂停中', x + 46, y + ts - 27, 16, '#fff', 'left', 600);
      }
      if (focus) {
        const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(this.t * 4.4));
        strokeRR(c, x - 3.5, y - 3.5, ts + 7, ts + 7, 6, dark ? '#2d2d2d' : '#ffffff', 3);
        c.globalAlpha = enter * pulse * 0.35;
        strokeRR(c, x - 10, y - 10, ts + 20, ts + 20, 12, th.sel, 6);
        c.globalAlpha = enter * (0.75 + 0.25 * pulse);
        strokeRR(c, x - 7, y - 7, ts + 14, ts + 14, 9, th.sel, 4);
        c.globalAlpha = enter;
        text(c, GAMES[i].meta.name, x, y - 22, 22, th.selText, 'left', 600);
      }
    }
    c.restore();

    // —— 圆形系统按钮 ——
    for (let i = 0; i < this.buttons.length; i++) {
      const b = this.buttons[i];
      const focus = this.row === 1 && i === this.btnSel;
      const s = this.btnScale[i];
      const cx = this.btnX(i) + (focus ? bumpX : 0);
      const cy = BTN_Y + (1 - enter) * 16;
      const r = BTN_R * s;
      c.fillStyle = th.shadow;
      c.beginPath();
      c.arc(cx, cy + 3, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = dark ? '#464649' : '#ffffff';
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();
      b.draw(c, cx, cy, r * 1.5, b.color || (dark ? '#e6e6e6' : '#5c5c60'));
      if (focus) {
        const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(this.t * 4.4));
        c.strokeStyle = dark ? '#2d2d2d' : '#ffffff';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(cx, cy, r + 3.5, 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 0.75 + 0.25 * pulse;
        c.strokeStyle = th.sel;
        c.lineWidth = 4;
        c.beginPath();
        c.arc(cx, cy, r + 7, 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 1;
        text(c, b.name, cx, cy + r + 30, 20, th.selText, 'center', 600);
      }
    }

    // —— 底栏 ——
    c.fillStyle = th.line;
    c.fillRect(30, 640, W - 60, 1.5);
    iconHandheld(c, 76, 682, 56, th.text, os.joycon.L, os.joycon.R, os.docked);
    const hints = [];
    if (this.row === 0) {
      const susp = os.suspended && os.suspended.constructor === GAMES[this.sel];
      if (susp) hints.push(['X', '关闭软件']);
      hints.push(['A', '开始']);
    } else hints.push(['A', '确定']);
    drawHints(c, hints, th);
  }
}

// 相册：浏览截图
import { W, H, clamp, damp, text, fillRR, strokeRR, rrect, drawHints, Nav, pad2 } from '../ui.js';
import { iconAlbum } from '../icons.js';

const COLS = 4, TW = 256, TH = 144, GX = 24, GY = 30;
const X0 = (W - (COLS * TW + (COLS - 1) * GX)) / 2;
const Y0 = 128;

export class Album {
  static meta = { id: 'album', name: '相册', kind: 'system' };

  constructor(os) {
    this.os = os;
    this.sel = 0;
    this.view = false;
    this.nav = new Nav();
    this.scroll = 0;
    this.t = 0;
    this.viewT = 0;
  }

  update(dt, pad) {
    this.t += dt;
    const list = this.os.album;
    const n = list.length;
    const d = this.nav.update(dt, pad);
    if (this.view) {
      this.viewT += dt;
      if (d === 'left' && this.sel > 0) { this.sel--; this.os.sfx.play('tick'); this.viewT = 0; }
      if (d === 'right' && this.sel < n - 1) { this.sel++; this.os.sfx.play('tick'); this.viewT = 0; }
      if (pad.pressed.B) { this.view = false; this.os.sfx.play('back'); }
      return;
    }
    if (n > 0) {
      const old = this.sel;
      if (d === 'left' && this.sel % COLS > 0) this.sel--;
      if (d === 'right' && this.sel % COLS < COLS - 1 && this.sel < n - 1) this.sel++;
      if (d === 'up' && this.sel >= COLS) this.sel -= COLS;
      if (d === 'down' && this.sel + COLS < n) this.sel += COLS;
      if (old !== this.sel) this.os.sfx.play('tick');
      this.sel = clamp(this.sel, 0, n - 1);
      if (pad.pressed.A) {
        this.view = true;
        this.viewT = 0;
        this.os.sfx.play('confirm');
      }
    }
    if (pad.pressed.B) {
      this.os.sfx.play('back');
      this.os.exitApp();
    }
    const row = Math.floor(this.sel / COLS);
    const target = Math.max(0, (row - 2) * (TH + GY + 26));
    this.scroll = damp(this.scroll, target, 14, dt);
  }

  draw(c) {
    const th = this.os.theme;
    const list = this.os.album;
    c.fillStyle = th.bg;
    c.fillRect(0, 0, W, H);
    if (this.view && list[this.sel]) {
      this._drawView(c, list[this.sel], th);
      return;
    }
    iconAlbum(c, 66, 58, 46, '#2f8fff');
    text(c, '相册', 102, 58, 32, th.text, 'left', 700);
    text(c, `共 ${list.length} 张截图`, W - 60, 60, 20, th.sub, 'right', 500);
    c.fillStyle = th.line;
    c.fillRect(32, 100, W - 64, 2);

    if (list.length === 0) {
      iconAlbum(c, W / 2, 300, 150, th.line);
      text(c, '还没有截图哦', W / 2, 420, 30, th.text, 'center', 700);
      text(c, '在游戏或 HOME 菜单里按下截图键（键盘 C），精彩瞬间就会保存在这里', W / 2, 468, 20, th.sub, 'center', 500);
    } else {
      c.save();
      c.beginPath();
      c.rect(0, 104, W, 536);
      c.clip();
      for (let i = 0; i < list.length; i++) {
        const col = i % COLS, row = Math.floor(i / COLS);
        const x = X0 + col * (TW + GX);
        const y = Y0 + row * (TH + GY + 26) - this.scroll;
        if (y > 660 || y + TH < 100) continue;
        const e = list[i];
        fillRR(c, x + 2, y + 5, TW, TH, 8, th.shadow);
        c.save();
        rrect(c, x, y, TW, TH, 8);
        c.clip();
        c.drawImage(e.thumb, x, y, TW, TH);
        c.restore();
        const tm = e.time;
        text(c, `${tm.getMonth() + 1}/${tm.getDate()} ${pad2(tm.getHours())}:${pad2(tm.getMinutes())}:${pad2(tm.getSeconds())}`,
          x + 4, y + TH + 16, 15, th.sub, 'left', 500);
        if (i === this.sel) {
          const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(this.t * 4.2));
          strokeRR(c, x - 4, y - 4, TW + 8, TH + 8, 11, '#ffffff', 3);
          c.globalAlpha = pulse;
          strokeRR(c, x - 8, y - 8, TW + 16, TH + 16, 14, th.accent, 5);
          c.globalAlpha = 1;
        }
      }
      c.restore();
    }
    c.fillStyle = th.line;
    c.fillRect(32, 642, W - 64, 2);
    drawHints(c, list.length ? [['A', '查看'], ['B', '返回']] : [['B', '返回']], th);
  }

  _drawView(c, e, th) {
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    if (!e.img) {
      e.img = new Image();
      e.img.src = e.url;
    }
    if (e.img.complete && e.img.naturalWidth > 0) c.drawImage(e.img, 0, 0, W, H);
    else c.drawImage(e.thumb, 0, 0, W, H);
    const a = clamp(2.5 - this.viewT, 0, 1);
    if (a > 0) {
      c.globalAlpha = a;
      const g = c.createLinearGradient(0, H - 110, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.75)');
      c.fillStyle = g;
      c.fillRect(0, H - 110, W, 110);
      const tm = e.time;
      text(c, `${e.app || ''}   ${tm.getFullYear()}年${tm.getMonth() + 1}月${tm.getDate()}日 ${pad2(tm.getHours())}:${pad2(tm.getMinutes())}`,
        40, H - 36, 20, '#fff', 'left', 500);
      text(c, `${this.sel + 1} / ${this.os.album.length}`, W / 2, H - 36, 20, '#fff', 'center', 600);
      drawHints(c, [['DPAD', '切换'], ['B', '返回']], { text: '#fff', glyphBg: '#fff', glyphFg: '#222' }, W - 40, H - 36, 19);
      c.globalAlpha = 1;
    }
  }
}

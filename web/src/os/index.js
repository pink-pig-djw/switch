// 茶室 OS —— 运行在 1280×720 画布上的掌机“系统”
// 负责：开机 / HOME / 应用切换与挂起 / 暂停菜单 / 睡眠与锁屏 / 电源菜单 / 音量与截图 / 系统提示
import { BUTTONS } from '../input.js';
import { Sfx } from './audio.js';
import { store } from './storage.js';
import {
  THEMES, W, H, clamp, text, textW, fillRR, strokeRR, rrect, drawHints, Nav,
  easeOutCubic, easeOutBack, pad2, WEEK,
} from './ui.js';
import { iconSpeaker, iconBattery, iconJoyCon, iconHandheld, drawOrange } from './icons.js';
import { Boot } from './boot.js';
import { Home } from './home.js';

const EMPTY_PAD = (() => {
  const z = {};
  for (const b of BUTTONS) z[b] = false;
  Object.freeze(z);
  return Object.freeze({ down: z, pressed: z, released: z, lx: 0, ly: 0, rx: 0, ry: 0 });
})();

const UNLOCK_BUTTONS = BUTTONS.filter((b) => b !== 'POWER' && b !== 'VOL_UP' && b !== 'VOL_DOWN');

const POWER_ITEMS = [
  { id: 'sleep', label: '睡眠模式' },
  { id: 'restart', label: '重新启动' },
  { id: 'off', label: '关机' },
  { id: 'cancel', label: '取消' },
];

const PAUSE_ITEMS = ['继续游戏', '重新开始', '退出到 HOME'];

export class ConsoleOS {
  constructor({ canvas }) {
    this.canvas = canvas;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    this.ctx = canvas.getContext('2d');
    this.sfx = new Sfx();
    this.store = store;
    const b = Number(store.get('brightness', 0.85));
    const v = Math.round(Number(store.get('volume', 10)));
    this.settings = {
      brightness: clamp(Number.isFinite(b) ? b : 0.85, 0.1, 1),
      volume: clamp(Number.isFinite(v) ? v : 10, 0, 16),
      theme: store.get('theme', 'light') === 'dark' ? 'dark' : 'light',
    };
    this.sfx.setVolume(this.settings.volume);

    this.t = 0;
    this.state = 'boot'; // off | boot | home | app | sleep | lock
    this.prevState = 'home';
    this.app = null; // 前台应用
    this.suspended = null; // 挂起中的游戏
    this.paused = false;
    this.pauseSel = 0;
    this.pauseT = 0;
    this.pauseNav = new Nav();
    this.powerMenu = null;
    this.powerNav = new Nav();
    this.power = { down: false, t: 0, long: false, ignore: false };
    this.lock = { last: null, count: 0, t: 0, enterT: 0 };
    this.toasts = [];
    this.volShow = 0;
    this.volRepeat = 0;
    this.flash = 0;
    this.fade = null;
    this.album = [];
    this.joycon = { L: true, R: true };
    this.docked = false;
    this.captureReq = false;
    this.onCapture = null;
    this.battery = null;
    this.pendingTap = null;
    this.joyNotice = null;

    try {
      if (navigator.getBattery) {
        navigator.getBattery().then((bt) => { this.battery = bt; }).catch(() => {});
      }
    } catch (e) {
      // 没有电池 API 就用假的满电
    }

    this.boot = new Boot(this);
    this.home = new Home(this);
  }

  // ———————————————————— 对外接口 ————————————————————
  get theme() {
    return THEMES[this.settings.theme] || THEMES.light;
  }
  get screenOn() {
    return this.state !== 'off' && this.state !== 'sleep';
  }
  get brightness() {
    return this.settings.brightness;
  }
  get appName() {
    switch (this.state) {
      case 'off': return '关机';
      case 'boot': return '开机中';
      case 'home': return 'HOME 菜单';
      case 'sleep': return '睡眠模式';
      case 'lock': return '锁屏';
      case 'app':
        if (!this.app) return 'HOME 菜单';
        return this.app.constructor.meta.name + (this.paused ? '（暂停）' : '');
      default: return '';
    }
  }

  unlockAudio() {
    this.sfx.unlock();
  }

  setJoyCon(side, attached) {
    if (side !== 'L' && side !== 'R') return;
    attached = !!attached;
    if (this.joycon[side] === attached) return;
    this.joycon[side] = attached;
    this.sfx.play('click', { minGap: 0 });
    // 参照真机：从屏幕左 / 右边缘滑出手柄小图标
    this.joyNotice = { side, attached, t: 0 };
  }

  // 触摸屏：x / y 为 1280×720 画布像素坐标
  tap(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.pendingTap = { x, y };
  }

  setDocked(docked) {
    docked = !!docked;
    if (this.docked === docked) return;
    this.docked = docked;
    this.sfx.play('click', { minGap: 0 });
    this.toast(docked ? '已切换到 TV 模式' : '已切换到掌机模式', { icon: docked ? 'tv' : 'handheld', silent: true });
  }

  notify(textStr) {
    this.toast(String(textStr));
  }

  setSetting(key, value) {
    this.settings[key] = value;
    store.set(key, value);
    if (key === 'volume') this.sfx.setVolume(value);
  }

  toast(str, opts = {}) {
    this.toasts.push({ text: str, t: 0, dur: opts.dur || 2.8, thumb: opts.thumb || null, icon: opts.icon || null });
    if (this.toasts.length > 4) this.toasts.shift();
    if (!opts.silent) this.sfx.play('toast');
  }

  // ———————————————————— 主循环 ————————————————————
  update(dt, pad) {
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    pad = pad || EMPTY_PAD;
    this.t += dt;

    this._power(dt, pad);
    this._volume(dt, pad);

    const p = this.fade ? EMPTY_PAD : pad;
    let consumed = false;
    if ((this.state === 'home' || this.state === 'app') && !this.powerMenu) {
      if (p.pressed.CAPTURE) this.captureReq = true;
      if (p.pressed.HOME) {
        this.goHome();
        consumed = true;
      }
    }
    const tap = this.pendingTap;
    this.pendingTap = null;
    if (tap && !consumed && !this.fade) consumed = this._tap(tap.x, tap.y);
    if (!consumed) {
      if (this.powerMenu) this._updatePowerMenu(dt, p);
      else {
        switch (this.state) {
          case 'boot': this.boot.update(dt, p); break;
          case 'home': this.home.update(dt, p); break;
          case 'app': this._updateApp(dt, p); break;
          case 'lock': this._updateLock(dt, p); break;
          default: break;
        }
      }
    }

    this._updateFade(dt);
    // 背景音乐只在它所属的软件处于前台运行时播放（暂停菜单 / HOME / 睡眠时自动暂停）
    this.sfx.updateMusic(this.state === 'app' && !this.paused && !this.powerMenu ? this.app : null);
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.t += dt;
      if (t.t >= t.dur) this.toasts.splice(i, 1);
    }
    this.volShow = Math.max(0, this.volShow - dt);
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.joyNotice) {
      this.joyNotice.t += dt;
      if (this.joyNotice.t > 2.1) this.joyNotice = null;
    }

    this.draw();
  }

  // ———————————————————— 应用管理 ————————————————————
  launch(cls) {
    if (this.fade) return;
    if (this.suspended && this.suspended.constructor === cls) {
      this.resumeSuspended();
      return;
    }
    this.sfx.play('launch');
    this.transition(() => {
      if (cls.meta.kind === 'game' && this.suspended) this._closeSuspended();
      try {
        this.app = new cls(this);
      } catch (e) {
        console.error(e);
        this.app = null;
        this.state = 'home';
        this.toast('软件启动失败');
        return;
      }
      this.paused = false;
      this.state = 'app';
    }, 0.2, 0.3);
  }

  resumeSuspended() {
    const app = this.suspended;
    if (!app || this.fade) return;
    this.sfx.play('launch');
    this.transition(() => {
      this.suspended = null;
      this.app = app;
      this.state = 'app';
      this.paused = !!app.__osPaused;
      if (app.onResume) app.onResume();
    }, 0.16, 0.25);
  }

  closeSuspended() {
    if (!this.suspended) return;
    const name = this.suspended.constructor.meta.name;
    this._closeSuspended();
    this.sfx.play('back');
    this.toast(`已关闭“${name}”`, { silent: true });
  }

  _closeSuspended() {
    if (this.suspended && this.suspended.close) this.suspended.close();
    this.suspended = null;
  }

  goHome() {
    if (this.fade) return;
    if (this.state === 'home') {
      if (this.suspended) this.resumeSuspended();
      return;
    }
    if (this.state !== 'app' || !this.app) return;
    const app = this.app;
    this.sfx.play('back');
    this.transition(() => {
      if (app.constructor.meta.kind === 'game') {
        app.__osPaused = this.paused;
        this.suspended = app;
        if (app.onSuspend) app.onSuspend();
      } else if (app.close) {
        app.close();
      }
      this.app = null;
      this.paused = false;
      this.state = 'home';
      this.home.onEnter();
    }, 0.16, 0.26);
  }

  exitApp() {
    if (this.fade) return;
    const app = this.app;
    this.transition(() => {
      if (app && app.close) app.close();
      if (this.suspended === app) this.suspended = null;
      this.app = null;
      this.paused = false;
      this.state = 'home';
      this.home.onEnter();
    }, 0.16, 0.26);
  }

  finishBoot() {
    this.transition(() => {
      this.state = 'home';
      this.home.onEnter();
    }, 0.3, 0.4);
  }

  _updateApp(dt, p) {
    const app = this.app;
    if (!app) {
      this.state = 'home';
      return;
    }
    if (this.paused) {
      this._updatePause(dt, p);
      return;
    }
    if (app.constructor.meta.kind === 'game' && p.pressed.PLUS) {
      this.paused = true;
      this.pauseSel = 0;
      this.pauseT = 0;
      this.pauseNav.reset();
      this.sfx.play('pause');
      return;
    }
    app.update(dt, p);
  }

  _updatePause(dt, p) {
    this.pauseT += dt;
    const d = this.pauseNav.update(dt, p);
    const n = PAUSE_ITEMS.length;
    if (d === 'up') { this.pauseSel = (this.pauseSel + n - 1) % n; this.sfx.play('tick'); }
    if (d === 'down') { this.pauseSel = (this.pauseSel + 1) % n; this.sfx.play('tick'); }
    if (p.pressed.B || p.pressed.PLUS) {
      this.paused = false;
      this.sfx.play('back');
      return;
    }
    if (p.pressed.A) {
      if (this.pauseSel === 0) {
        this.paused = false;
        this.sfx.play('confirm');
      } else if (this.pauseSel === 1) {
        this.sfx.play('confirm');
        this.transition(() => {
          this.paused = false;
          if (this.app && this.app.restart) this.app.restart();
        }, 0.15, 0.2);
      } else {
        this.sfx.play('back');
        this.exitApp();
      }
    }
  }

  // ———————————————————— 电源 / 睡眠 / 锁屏 ————————————————————
  _power(dt, pad) {
    const P = this.power;
    if (pad.pressed.POWER) {
      P.down = true;
      P.t = 0;
      P.long = false;
      P.ignore = false;
      if (this.state === 'off') {
        P.ignore = true;
        this._bootUp();
      }
    }
    if (!P.down) return;
    if (pad.down.POWER) {
      P.t += dt;
      if (!P.long && !P.ignore && P.t >= 2 && !this.fade &&
          (this.state === 'home' || this.state === 'app' || this.state === 'lock')) {
        P.long = true;
        this.openPowerMenu();
      }
    } else {
      P.down = false;
      if (!P.long && !P.ignore && P.t < 1.5) this._shortPower();
    }
  }

  _shortPower() {
    if (this.powerMenu) {
      this.powerMenu = null;
      this.sleep();
      return;
    }
    if (this.state === 'home' || this.state === 'app' || this.state === 'lock') this.sleep();
    else if (this.state === 'sleep') this.wake();
  }

  sleep() {
    if (this.state === 'sleep' || this.state === 'off' || this.state === 'boot') return;
    this._finishFade();
    if (this.state === 'home' || this.state === 'app') this.prevState = this.state;
    if (this.state === 'app' && this.app && this.app.constructor.meta.kind === 'game') {
      this.paused = true;
      this.pauseSel = 0;
    }
    this.powerMenu = null;
    this.volShow = 0;
    this.state = 'sleep';
    this.sfx.play('sleep');
  }

  wake() {
    if (this.state !== 'sleep') return;
    this.state = 'lock';
    this.lock = { last: null, count: 0, t: 0, enterT: 0 };
    this.fade = { phase: 'in', t: 0, outDur: 0, inDur: 0.45, fn: null };
    this.sfx.play('wake');
  }

  _updateLock(dt, p) {
    const L = this.lock;
    L.t += dt;
    L.enterT += dt;
    if (L.last && L.t > 1.6) {
      L.last = null;
      L.count = 0;
    }
    for (const b of UNLOCK_BUTTONS) {
      if (!p.pressed[b]) continue;
      this._lockPress(b);
      break;
    }
  }

  _lockPress(b) {
    const L = this.lock;
    if (b === L.last) L.count++;
    else {
      L.last = b;
      L.count = 1;
    }
    L.t = 0;
    if (L.count >= 3) this._unlock();
    else this.sfx.play('lockstep', { n: L.count - 1, minGap: 0 });
  }

  _tap(x, y) {
    if (this.powerMenu) {
      for (let i = 0; i < POWER_ITEMS.length; i++) {
        const iy = 254 + i * 66;
        if (x >= 448 && x <= 832 && y >= iy && y <= iy + 56) {
          this.powerMenu.sel = i;
          this._updatePowerMenu(0, { ...EMPTY_PAD, pressed: { ...EMPTY_PAD.pressed, A: true } });
          return true;
        }
      }
      return true;
    }
    switch (this.state) {
      case 'lock':
        if (this.lock.count < 3) this._lockPress('TOUCH');
        return true;
      case 'home':
        return this.home.tap(x, y);
      case 'app':
        if (this.paused) {
          for (let i = 0; i < PAUSE_ITEMS.length; i++) {
            const iy = 286 + i * 70;
            if (x >= 428 && x <= 852 && y >= iy && y <= iy + 58) {
              this.pauseSel = i;
              this._updatePause(0, { ...EMPTY_PAD, pressed: { ...EMPTY_PAD.pressed, A: true } });
              return true;
            }
          }
          return true;
        }
        if (this.app && this.app.tap) {
          try {
            return !!this.app.tap(x, y);
          } catch (e) {
            console.error(e);
          }
        }
        return false;
      default:
        return false;
    }
  }

  _unlock() {
    this.sfx.play('unlock');
    const target = this.prevState;
    this.transition(() => {
      if (target === 'app' && this.app) this.state = 'app';
      else {
        this.state = 'home';
        this.home.onEnter();
      }
    }, 0.16, 0.26);
  }

  openPowerMenu() {
    this.powerMenu = { sel: 0, t: 0 };
    this.powerNav.reset();
    this.sfx.play('confirm');
  }

  _updatePowerMenu(dt, p) {
    const M = this.powerMenu;
    M.t += dt;
    const d = this.powerNav.update(dt, p);
    const n = POWER_ITEMS.length;
    if (d === 'up') { M.sel = (M.sel + n - 1) % n; this.sfx.play('tick'); }
    if (d === 'down') { M.sel = (M.sel + 1) % n; this.sfx.play('tick'); }
    if (p.pressed.B) {
      this.powerMenu = null;
      this.sfx.play('back');
      return;
    }
    if (p.pressed.A) {
      const id = POWER_ITEMS[M.sel].id;
      this.powerMenu = null;
      if (id === 'sleep') this.sleep();
      else if (id === 'restart') this.restartSystem();
      else if (id === 'off') this.shutdown();
      else this.sfx.play('back');
    }
  }

  restartSystem() {
    this.sfx.play('sleep');
    this.transition(() => {
      this._killApps();
      this.state = 'boot';
      this.boot.reset();
    }, 0.45, 0.05);
  }

  shutdown() {
    this.sfx.play('sleep');
    this.transition(() => {
      this._killApps();
      this.state = 'off';
    }, 0.55, 0.05);
  }

  _killApps() {
    if (this.app && this.app.close) this.app.close();
    if (this.suspended && this.suspended.close) this.suspended.close();
    this.app = null;
    this.suspended = null;
    this.paused = false;
    this.powerMenu = null;
    this.toasts.length = 0;
  }

  _bootUp() {
    this.fade = null;
    this.state = 'boot';
    this.boot.reset();
  }

  // ———————————————————— 音量 / 截图 ————————————————————
  _volume(dt, pad) {
    if (!this.screenOn || this.state === 'boot') return;
    let dir = 0;
    if (pad.down.VOL_UP && !pad.down.VOL_DOWN) dir = 1;
    else if (pad.down.VOL_DOWN && !pad.down.VOL_UP) dir = -1;
    if ((pad.pressed.VOL_UP || pad.pressed.VOL_DOWN) && dir) {
      this._volStep(dir);
      this.volRepeat = 0.42;
    } else if (dir) {
      this.volShow = Math.max(this.volShow, 1.4);
      this.volRepeat -= dt;
      if (this.volRepeat <= 0) {
        this._volStep(dir);
        this.volRepeat = 0.09;
      }
    }
  }

  _volStep(dir) {
    const v = clamp(this.settings.volume + dir, 0, 16);
    if (v !== this.settings.volume) this.setSetting('volume', v);
    this.volShow = 1.6;
    this.sfx.play('vol', { minGap: 0 });
  }

  _doCapture() {
    this.captureReq = false;
    let url;
    try {
      url = this.canvas.toDataURL('image/jpeg', 0.9);
    } catch (e) {
      this.toast('截图失败');
      return;
    }
    const thumb = document.createElement('canvas');
    thumb.width = 320;
    thumb.height = 180;
    const tc = thumb.getContext('2d');
    tc.imageSmoothingQuality = 'high';
    tc.drawImage(this.canvas, 0, 0, 320, 180);
    this.album.unshift({ url, thumb, time: new Date(), img: null, app: this.appName });
    if (this.album.length > 30) this.album.length = 30;
    this.flash = 1;
    this.sfx.play('shutter', { minGap: 0 });
    this.toast('已保存截图', { thumb, silent: true });
    if (this.onCapture) {
      try {
        this.onCapture(url);
      } catch (e) {
        console.error(e);
      }
    }
  }

  // ———————————————————— 转场 ————————————————————
  transition(fn, outDur = 0.18, inDur = 0.24) {
    if (this.fade && this.fade.phase === 'out') return;
    this.fade = { phase: 'out', t: 0, outDur, inDur, fn };
  }

  _finishFade() {
    const f = this.fade;
    if (!f) return;
    this.fade = null;
    if (f.phase === 'out' && f.fn) f.fn();
  }

  _updateFade(dt) {
    const f = this.fade;
    if (!f) return;
    f.t += dt;
    if (f.phase === 'out') {
      if (f.t >= f.outDur) {
        const fn = f.fn;
        f.fn = null;
        f.phase = 'in';
        f.t = 0;
        if (fn) fn();
      }
    } else if (f.t >= f.inDur) {
      this.fade = null;
    }
  }

  _fadeAlpha() {
    const f = this.fade;
    if (!f) return 0;
    if (f.phase === 'out') return f.outDur > 0 ? clamp(f.t / f.outDur, 0, 1) : 1;
    return f.inDur > 0 ? 1 - clamp(f.t / f.inDur, 0, 1) : 0;
  }

  // ———————————————————— 绘制 ————————————————————
  draw() {
    const c = this.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    switch (this.state) {
      case 'off':
      case 'sleep':
        c.fillStyle = '#000';
        c.fillRect(0, 0, W, H);
        break;
      case 'boot':
        this.boot.draw(c);
        break;
      case 'home':
        this.home.draw(c);
        break;
      case 'app':
        if (this.app) {
          c.save();
          try {
            this.app.draw(c);
          } catch (e) {
            console.error(e);
          }
          c.restore();
          if (this.paused) this._drawPause(c);
        }
        break;
      case 'lock':
        this._drawLock(c);
        break;
      default:
        break;
    }
    c.restore();

    if (this.captureReq) this._doCapture();

    if (this.screenOn) {
      c.save();
      if (this.powerMenu) this._drawPowerMenu(c);
      this._drawVolume(c);
      this._drawJoyNotice(c);
      this._drawToasts(c);
      if (this.flash > 0) {
        c.fillStyle = `rgba(255,255,255,${(this.flash * 0.8).toFixed(3)})`;
        c.fillRect(0, 0, W, H);
      }
      c.restore();
    }
    const fa = this._fadeAlpha();
    if (fa > 0) {
      c.fillStyle = `rgba(0,0,0,${fa.toFixed(3)})`;
      c.fillRect(0, 0, W, H);
    }
  }

  _drawPause(c) {
    const th = this.theme;
    const a = easeOutCubic(this.pauseT / 0.2);
    c.fillStyle = `rgba(0,0,0,${(0.55 * a).toFixed(3)})`;
    c.fillRect(0, 0, W, H);
    const w = 480, h = 380;
    const x = (W - w) / 2, y = (H - h) / 2 + (1 - a) * 30;
    c.globalAlpha = a;
    fillRR(c, x, y, w, h, 22, th.bg2);
    text(c, '暂停', x + 36, y + 52, 34, th.text, 'left', 700);
    text(c, this.app ? this.app.constructor.meta.name : '', x + w - 36, y + 54, 20, th.sub, 'right');
    c.fillStyle = th.line;
    c.fillRect(x + 28, y + 92, w - 56, 2);
    for (let i = 0; i < PAUSE_ITEMS.length; i++) {
      const iy = y + 116 + i * 70;
      const sel = i === this.pauseSel;
      if (sel) {
        fillRR(c, x + 28, iy, w - 56, 58, 10, th.selBg);
        const pulse = 0.65 + 0.35 * Math.sin(this.t * 5);
        c.globalAlpha = a * pulse;
        strokeRR(c, x + 26, iy - 2, w - 52, 62, 12, th.sel, 4);
        c.globalAlpha = a;
      }
      text(c, PAUSE_ITEMS[i], x + 56, iy + 30, 26, sel ? th.selText : th.text, 'left', sel ? 700 : 500);
    }
    drawHints(c, [['A', '确定'], ['B', '继续']], th, x + w - 30, y + h - 34, 19);
    c.globalAlpha = 1;
  }

  _drawLock(c) {
    // 参照真机锁屏：深色背景，左下角大号时间与日期，右上角电量，底部中间提示
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0f0f11');
    g.addColorStop(1, '#25252a');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const rg = c.createRadialGradient(260, 600, 10, 260, 600, 560);
    rg.addColorStop(0, 'rgba(255,138,46,0.16)');
    rg.addColorStop(1, 'rgba(255,138,46,0)');
    c.fillStyle = rg;
    c.fillRect(0, 0, W, H);
    this._drawBattery(c, 1196, 40, '#ffffff');
    const now = new Date();
    const a = easeOutCubic(this.lock.enterT / 0.5);
    c.globalAlpha = a;
    text(c, `${pad2(now.getHours())}:${pad2(now.getMinutes())}`, 84, 486 + (1 - a) * 20, 156, '#ffffff', 'left', 300);
    text(c, `${now.getMonth() + 1}月${now.getDate()}日 ${WEEK[now.getDay()]}`, 92, 590, 30, 'rgba(255,255,255,0.82)', 'left', 500);
    c.globalAlpha = 1;
    const L = this.lock;
    for (let i = 0; i < 3; i++) {
      const filled = i < L.count;
      const cx = 640 + (i - 1) * 40;
      c.beginPath();
      c.arc(cx, 640, filled ? 9 : 7, 0, Math.PI * 2);
      if (filled) {
        c.fillStyle = this.theme.sel;
        c.fill();
      } else {
        c.strokeStyle = 'rgba(255,255,255,0.75)';
        c.lineWidth = 2;
        c.stroke();
      }
    }
    c.globalAlpha = 0.78 + 0.22 * Math.sin(this.t * 3);
    text(c, '请连续按 3 次同一按键', 640, 684, 24, '#ffffff', 'center', 500);
    c.globalAlpha = 1;
  }

  _drawJoyNotice(c) {
    const n = this.joyNotice;
    if (!n) return;
    const tin = easeOutBack(clamp(n.t / 0.35, 0, 1));
    const tout = clamp((n.t - 1.75) / 0.3, 0, 1);
    const k = tin * (1 - tout);
    const w = 150, h = 230, y = (H - h) / 2;
    const left = n.side === 'L';
    const x = left ? -w + k * (w + 20) : W - k * (w + 20);
    fillRR(c, x, y, w, h, 22, 'rgba(28,28,30,0.92)');
    const ix = x + w / 2, iy = y + 92;
    const slide = n.attached ? (1 - clamp(n.t / 0.6, 0, 1)) * 18 : clamp(n.t / 0.6, 0, 1) * 18;
    iconJoyCon(c, ix + (left ? -slide : slide), iy, 130, n.side);
    // 玩家指示灯
    for (let i = 0; i < 4; i++) {
      c.fillStyle = n.attached && i === 0 ? '#5dff8a' : 'rgba(255,255,255,0.2)';
      c.fillRect(ix - 21 + i * 12, y + 168, 8, 4);
    }
    text(c, n.attached ? '已连接' : '已断开', ix, y + 200, 20, '#ffffff', 'center', 600);
  }

  _drawBattery(c, x, y, color) {
    let level = 1, charging = false;
    if (this.battery) {
      level = clamp(this.battery.level, 0, 1);
      charging = !!this.battery.charging;
    }
    if (this.docked) charging = true;
    const pct = `${Math.round(level * 100)}%`;
    text(c, pct, x - 10, y + 11, 20, color, 'right', 500);
    iconBattery(c, x, y, 40, 22, color, level, charging);
  }

  _drawPowerMenu(c) {
    const M = this.powerMenu;
    const th = this.theme;
    const a = easeOutCubic(M.t / 0.2);
    c.fillStyle = `rgba(0,0,0,${(0.6 * a).toFixed(3)})`;
    c.fillRect(0, 0, W, H);
    const w = 440, h = 420;
    const x = (W - w) / 2, y = (H - h) / 2;
    c.globalAlpha = a;
    fillRR(c, x, y, w, h, 22, th.bg2);
    text(c, '电源选项', x + w / 2, y + 50, 30, th.text, 'center', 700);
    c.fillStyle = th.line;
    c.fillRect(x + 28, y + 86, w - 56, 2);
    for (let i = 0; i < POWER_ITEMS.length; i++) {
      const iy = y + 104 + i * 66;
      const sel = i === M.sel;
      if (sel) {
        fillRR(c, x + 28, iy, w - 56, 56, 10, th.selBg);
        c.globalAlpha = a * (0.65 + 0.35 * Math.sin(this.t * 5));
        strokeRR(c, x + 26, iy - 2, w - 52, 60, 12, th.sel, 4);
        c.globalAlpha = a;
      }
      text(c, POWER_ITEMS[i].label, x + w / 2, iy + 29, 25, sel ? th.selText : th.text, 'center', sel ? 700 : 500);
    }
    drawHints(c, [['A', '确定'], ['B', '取消']], th, x + w - 28, y + h - 28, 18);
    c.globalAlpha = 1;
  }

  _drawVolume(c) {
    if (this.volShow <= 0) return;
    const a = clamp(this.volShow / 0.3, 0, 1);
    const x = 32, y = 32, w = 62, h = 312;
    const level = this.settings.volume;
    c.globalAlpha = a;
    fillRR(c, x, y, w, h, 31, 'rgba(28,28,30,0.9)');
    const n = 16, top = y + 22, bottom = y + h - 70;
    const segH = (bottom - top) / n;
    for (let i = 0; i < n; i++) {
      const yy = bottom - (i + 1) * segH;
      fillRR(c, x + 17, yy + 1.5, w - 34, segH - 3, 3, i < level ? '#ffffff' : 'rgba(255,255,255,0.16)');
    }
    iconSpeaker(c, x + w / 2 + 2, y + h - 38, 34, '#ffffff', level / 16);
    c.globalAlpha = 1;
  }

  _drawToasts(c) {
    let y = 24;
    for (let i = 0; i < this.toasts.length; i++) {
      const t = this.toasts[i];
      const appear = easeOutBack(t.t / 0.32);
      const vanish = clamp((t.dur - t.t) / 0.3, 0, 1);
      const tw = textW(c, t.text, 22, 500);
      const lead = t.thumb ? 108 : t.icon ? 52 : 0;
      const w = tw + 52 + lead;
      const h = t.thumb ? 78 : 60;
      const x = W - 24 - w + (1 - clamp(appear, 0, 1.2)) * (w + 40);
      c.globalAlpha = vanish;
      fillRR(c, x, y, w, h, 16, 'rgba(28,28,30,0.93)');
      let tx = x + 26;
      if (t.thumb) {
        c.save();
        rrect(c, x + 12, y + 10, 96, 58, 8);
        c.clip();
        c.drawImage(t.thumb, x + 12, y + 10, 96, 58);
        c.restore();
        tx = x + 12 + 96 + 16;
      } else if (t.icon) {
        this._toastIcon(c, t.icon, x + 34, y + h / 2);
        tx = x + 62;
      }
      text(c, t.text, tx, y + h / 2 + 1, 22, '#ffffff', 'left', 500);
      c.globalAlpha = 1;
      y += h + 12;
    }
  }

  _toastIcon(c, icon, cx, cy) {
    if (icon === 'joyconL') iconJoyCon(c, cx, cy, 40, 'L');
    else if (icon === 'joyconR') iconJoyCon(c, cx, cy, 40, 'R');
    else if (icon === 'tv') iconHandheld(c, cx, cy, 38, '#ffffff', true, true, true);
    else if (icon === 'handheld') iconHandheld(c, cx, cy, 40, '#ffffff', true, true, false);
  }
}

// 输入层：把键盘 / 鼠标点击 3D 按键 / 实体手柄统一成一个“虚拟 Switch 手柄”状态。
//
// 每帧调用 input.poll() 得到快照：
//   {
//     down:     { A: true, ... }   当前按住的按键
//     pressed:  { A: true, ... }   本帧刚按下
//     released: { A: true, ... }   本帧刚松开
//     lx, ly, rx, ry               摇杆轴，范围 [-1, 1]，+x 向右，+y 向上
//   }

export const BUTTONS = [
  'A', 'B', 'X', 'Y',
  'L', 'R', 'ZL', 'ZR',
  'PLUS', 'MINUS', 'HOME', 'CAPTURE',
  'LS', 'RS',
  'UP', 'DOWN', 'LEFT', 'RIGHT',
  'SL_L', 'SR_L', 'SL_R', 'SR_R',
  // 主机本体上的硬件按键（不属于手柄，由 viewer 转交给系统处理）
  'POWER', 'VOL_UP', 'VOL_DOWN',
];

// 键盘映射（KeyboardEvent.code → 按键）。ABXY 用 I/J/K/L 菱形，和手柄上的位置一一对应。
export const KEYMAP = {
  KeyL: 'A', Space: 'A', Enter: 'A', NumpadEnter: 'A',
  KeyK: 'B', Backspace: 'B',
  KeyI: 'X',
  KeyJ: 'Y',
  KeyQ: 'L', KeyE: 'ZL',
  KeyO: 'R', KeyU: 'ZR',
  Equal: 'PLUS', NumpadAdd: 'PLUS',
  Minus: 'MINUS', NumpadSubtract: 'MINUS',
  KeyH: 'HOME',
  KeyC: 'CAPTURE',
  ShiftLeft: 'LS',
  ShiftRight: 'RS', Numpad0: 'RS',
  ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  KeyZ: 'SL_L', KeyX: 'SR_L',
  KeyN: 'SL_R', KeyM: 'SR_R',
  KeyP: 'POWER',
  BracketRight: 'VOL_UP', BracketLeft: 'VOL_DOWN',
};

// 摇杆方向键
const STICK_KEYS = {
  KeyW: ['L', 0, 1], KeyS: ['L', 0, -1], KeyA: ['L', -1, 0], KeyD: ['L', 1, 0],
  Numpad8: ['R', 0, 1], Numpad5: ['R', 0, -1], Numpad2: ['R', 0, -1],
  Numpad4: ['R', -1, 0], Numpad6: ['R', 1, 0],
};

// 给帮助面板用的说明
export const KEY_HELP = [
  ['左摇杆', 'W A S D'],
  ['左摇杆按下', '左 Shift'],
  ['十字键', '↑ ↓ ← →'],
  ['A', 'L / 空格 / 回车'],
  ['B', 'K / 退格'],
  ['X', 'I'],
  ['Y', 'J'],
  ['右摇杆', '小键盘 8 4 5 6（或鼠标拖动摇杆）'],
  ['右摇杆按下', '右 Shift / 小键盘 0'],
  ['L / ZL', 'Q / E'],
  ['R / ZR', 'O / U'],
  ['+ / −', '= / -'],
  ['HOME', 'H'],
  ['截图键', 'C'],
  ['SL / SR（左）', 'Z / X'],
  ['SL / SR（右）', 'N / M'],
  ['电源键', 'P'],
  ['音量 + / −', '] / ['],
];

// 实体手柄（标准映射）按“位置”对应到 Switch 布局：下=B，右=A，左=Y，上=X
const GAMEPAD_BUTTONS = {
  0: 'B', 1: 'A', 2: 'Y', 3: 'X',
  4: 'L', 5: 'R', 6: 'ZL', 7: 'ZR',
  8: 'MINUS', 9: 'PLUS', 10: 'LS', 11: 'RS',
  12: 'UP', 13: 'DOWN', 14: 'LEFT', 15: 'RIGHT',
  16: 'HOME', 17: 'CAPTURE',
};

export class Input {
  constructor(target = window) {
    this.keys = new Set();          // 按住的键盘 code
    this.virtual = new Map();       // 鼠标点住的 3D 按键（按键名 → 计数）
    this.virtualStick = { L: [0, 0], R: [0, 0] };
    this.prev = {};
    this.enabled = true;

    target.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (!(e.code in KEYMAP) && !(e.code in STICK_KEYS)) return;
      e.preventDefault();
      this.keys.add(e.code);
    });
    target.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.virtual.clear(); });
  }

  press(btn) {
    this.virtual.set(btn, (this.virtual.get(btn) || 0) + 1);
    (this.fresh ||= new Set()).add(btn);
  }
  release(btn) {
    // 按下和松开落在同一帧之间（快速点击）时，推迟到下一次 poll 之后再松开，保证至少被读到一次
    if (this.fresh?.has(btn)) { (this.deferred ||= []).push(btn); return; }
    const n = (this.virtual.get(btn) || 0) - 1;
    if (n > 0) this.virtual.set(btn, n); else this.virtual.delete(btn);
  }
  setStick(side, x, y) { this.virtualStick[side] = [x, y]; }

  poll() {
    const down = {};
    for (const b of BUTTONS) down[b] = false;
    let lx = 0, ly = 0, rx = 0, ry = 0;

    if (this.enabled) {
      for (const code of this.keys) {
        if (KEYMAP[code]) down[KEYMAP[code]] = true;
        const s = STICK_KEYS[code];
        if (s) {
          if (s[0] === 'L') { lx += s[1]; ly += s[2]; } else { rx += s[1]; ry += s[2]; }
        }
      }
      for (const b of this.virtual.keys()) down[b] = true;
      lx += this.virtualStick.L[0]; ly += this.virtualStick.L[1];
      rx += this.virtualStick.R[0]; ry += this.virtualStick.R[1];

      // 实体手柄
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of pads) {
        if (!gp || !gp.connected) continue;
        gp.buttons.forEach((bt, i) => {
          const name = GAMEPAD_BUTTONS[i];
          if (name && (bt.pressed || bt.value > 0.5)) down[name] = true;
        });
        const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
        lx += dz(gp.axes[0] || 0); ly -= dz(gp.axes[1] || 0);
        rx += dz(gp.axes[2] || 0); ry -= dz(gp.axes[3] || 0);
      }
    }

    const clampStick = (x, y) => {
      const m = Math.hypot(x, y);
      return m > 1 ? [x / m, y / m] : [x, y];
    };
    [lx, ly] = clampStick(lx, ly);
    [rx, ry] = clampStick(rx, ry);

    const pressed = {}, released = {};
    for (const b of BUTTONS) {
      pressed[b] = down[b] && !this.prev[b];
      released[b] = !down[b] && !!this.prev[b];
    }
    this.prev = down;
    // 这一帧已经读到了新按下的虚拟按键，执行被推迟的松开
    this.fresh?.clear();
    const later = this.deferred || [];
    this.deferred = [];
    for (const b of later) this.release(b);
    return { down, pressed, released, lx, ly, rx, ry };
  }
}

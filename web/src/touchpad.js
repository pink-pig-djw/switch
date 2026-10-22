// 触屏手柄浮层：手机上 3D 按键太小，提供一套大按钮（左摇杆、十字键、ABXY、L/R、+/−、HOME）。
// 直接驱动和键盘相同的虚拟手柄（Input.press / release / setStick）。
const LAYOUT = `
  <div class="tp-side tp-left">
    <button class="tp-sh" data-b="L">L</button>
    <button class="tp-sh tp-z" data-b="ZL">ZL</button>
    <div class="tp-stick" data-stick="L"><div class="tp-knob"></div></div>
    <div class="tp-dpad">
      <button data-b="UP">▲</button><button data-b="LEFT">◀</button>
      <button data-b="RIGHT">▶</button><button data-b="DOWN">▼</button>
    </div>
  </div>
  <div class="tp-mid">
    <button data-b="MINUS">−</button><button data-b="CAPTURE">◉</button>
    <button data-b="HOME">⌂</button><button data-b="PLUS">+</button>
  </div>
  <div class="tp-side tp-right">
    <button class="tp-sh" data-b="R">R</button>
    <button class="tp-sh tp-z" data-b="ZR">ZR</button>
    <div class="tp-abxy">
      <button data-b="X">X</button><button data-b="Y">Y</button>
      <button data-b="A">A</button><button data-b="B">B</button>
    </div>
    <div class="tp-stick tp-small" data-stick="R"><div class="tp-knob"></div></div>
  </div>`;

const CSS = `
.tp { position: fixed; inset: 0; pointer-events: none; z-index: 7; user-select: none; -webkit-user-select: none; }
.tp button { pointer-events: auto; border: 1px solid rgba(255,255,255,.35); background: rgba(20,22,28,.42); color: #fff;
  font: 700 15px/1 system-ui, sans-serif; border-radius: 50%; width: 46px; height: 46px; padding: 0; touch-action: none;
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.tp button.on { background: rgba(255,106,31,.85); }
.tp-side { position: absolute; bottom: 18px; width: 190px; height: 230px; }
.tp-left { left: 14px; } .tp-right { right: 14px; }
.tp-sh { position: absolute; top: 0; width: 62px !important; height: 30px !important; border-radius: 12px !important; font-size: 13px !important; }
.tp-left .tp-sh { left: 0; } .tp-left .tp-z { left: 70px; }
.tp-right .tp-sh { right: 0; } .tp-right .tp-z { right: 70px; }
.tp-stick { pointer-events: auto; position: absolute; width: 104px; height: 104px; border-radius: 50%; touch-action: none;
  background: rgba(20,22,28,.28); border: 1px solid rgba(255,255,255,.3); left: 0; top: 42px; }
.tp-stick.tp-small { width: 78px; height: 78px; left: auto; right: 112px; top: 150px; }
.tp-knob { position: absolute; left: 50%; top: 50%; width: 46%; height: 46%; margin: -23% 0 0 -23%; border-radius: 50%;
  background: rgba(255,255,255,.75); box-shadow: 0 2px 8px rgba(0,0,0,.3); }
.tp-dpad { position: absolute; left: 96px; top: 140px; width: 96px; height: 96px; }
.tp-dpad button { position: absolute; width: 34px; height: 34px; font-size: 11px; }
.tp-dpad [data-b=UP] { left: 31px; top: 0; } .tp-dpad [data-b=DOWN] { left: 31px; bottom: 0; }
.tp-dpad [data-b=LEFT] { left: 0; top: 31px; } .tp-dpad [data-b=RIGHT] { right: 0; top: 31px; }
.tp-abxy { position: absolute; right: 0; top: 40px; width: 140px; height: 140px; }
.tp-abxy button { position: absolute; }
.tp-abxy [data-b=X] { left: 47px; top: 0; } .tp-abxy [data-b=B] { left: 47px; bottom: 0; }
.tp-abxy [data-b=Y] { left: 0; top: 47px; } .tp-abxy [data-b=A] { right: 0; top: 47px; }
.tp-mid { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); display: flex; gap: 10px; }
.tp-mid button { width: 38px; height: 38px; font-size: 16px; }
@media (min-width: 761px) { .tp-right { right: 290px; } }
@media (max-height: 460px) { .tp-side { transform: scale(.82); transform-origin: bottom left; } .tp-right { transform-origin: bottom right; } }
`;

export function createTouchPad(input) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'tp';
  el.innerHTML = LAYOUT;
  el.hidden = true;
  document.body.appendChild(el);

  el.querySelectorAll('button[data-b]').forEach((b) => {
    const btn = b.dataset.b;
    const down = (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); input.press(btn); b.classList.add('on'); };
    const up = (e) => { e.preventDefault(); input.release(btn); b.classList.remove('on'); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  el.querySelectorAll('.tp-stick').forEach((s) => {
    const side = s.dataset.stick;
    const knob = s.querySelector('.tp-knob');
    let id = null;
    const move = (e) => {
      const r = s.getBoundingClientRect();
      const R = r.width / 2;
      let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R;
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      knob.style.transform = `translate(${x * R * 0.55}px, ${y * R * 0.55}px)`;
      input.setStick(side, x, -y);
    };
    s.addEventListener('pointerdown', (e) => { e.preventDefault(); id = e.pointerId; s.setPointerCapture(id); move(e); });
    s.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      knob.style.transform = '';
      input.setStick(side, 0, 0);
    };
    s.addEventListener('pointerup', end);
    s.addEventListener('pointercancel', end);
  });

  return {
    el,
    get visible() { return !el.hidden; },
    set visible(v) { el.hidden = !v; },
  };
}

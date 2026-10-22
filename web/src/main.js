// 入口：加载 Blender 导出的模型，接上主机系统（屏幕里的游戏）、键盘 / 鼠标 / 手柄输入和界面。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import glbData from '../assets/switch.glb';
import { createStage, CameraTween, fitDistance, GROUND_Y } from './scene.js';
import { Device } from './device.js';
import { Input, KEY_HELP } from './input.js';
import { ConsoleOS } from './os/index.js';
import { createTouchPad } from './touchpad.js';

// 每个按键在 3D 上的提示：键盘键位
const KEY_OF = {
  A: 'L / 空格 / 回车', B: 'K / 退格', X: 'I', Y: 'J',
  UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→',
  L: 'Q', ZL: 'E', R: 'O', ZR: 'U', PLUS: '=', MINUS: '-', HOME: 'H', CAPTURE: 'C',
  LS: 'W A S D 推动 · 左 Shift 按下', RS: '小键盘 8 4 5 6 推动 · 右 Shift 按下',
  SL_L: 'Z', SR_L: 'X', SL_R: 'N', SR_R: 'M', POWER: 'P（长按 2 秒：电源菜单）', VOL_UP: ']', VOL_DOWN: '[',
};
const TAG_OF = {
  A: 'L', B: 'K', X: 'I', Y: 'J', UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→',
  L: 'Q', ZL: 'E', R: 'O', ZR: 'U', PLUS: '=', MINUS: '-', HOME: 'H', CAPTURE: 'C',
  SL_L: 'Z', SR_L: 'X', SL_R: 'N', SR_R: 'M', POWER: 'P', VOL_UP: ']', VOL_DOWN: '[',
  LSTICK: 'WASD', RSTICK: '8456',
};

const $ = (s) => document.querySelector(s);
const stageEl = $('#stage');
const { renderer, scene, camera, controls, onResize } = createStage(stageEl);
const tween = new CameraTween(camera, controls);
const input = new Input(window);
const raycaster = new THREE.Raycaster();

let device = null;
let os = null;
let tv = null;
let screenTex = null;
let tagsOn = false;
const touchpad = createTouchPad(input);
touchpad.visible = matchMedia('(pointer: coarse)').matches;
const ui = {
  app: $('#appName'), live: $('#liveDot'), tooltip: $('#tooltip'), tags: $('#tags'), shots: $('#shots'),
  hint: $('#hint'), panel: $('#panel'),
};

// ------------------------------------------------------------------ 模型
function loadModel() {
  const buf = glbData.buffer.slice(glbData.byteOffset, glbData.byteOffset + glbData.byteLength);
  new GLTFLoader().parse(buf, '', (gltf) => {
    device = new Device(gltf.scene);
    scene.add(device.root);
    setupScreen();
    setupTV();
    device.on('dock', onDockChange);
    device.on('joycon', () => syncChips());
    device.on('toggle', () => syncChips());
    view('hero', 0.01);
    requestAnimationFrame(() => $('#loading').classList.add('done'));
  }, (err) => {
    console.error(err);
    $('#loading .box').textContent = '模型加载失败：' + err.message;
  });
}

function setupScreen() {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  os = new ConsoleOS({ canvas });
  os.onCapture = addShot;
  screenTex = new THREE.CanvasTexture(canvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.flipY = false;                    // glTF 的 UV 约定
  screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  screenTex.minFilter = THREE.LinearMipmapLinearFilter;
  device.bindScreen(screenTex);
}

// TV 模式时，画面显示在后面的电视上
function setupTV() {
  tv = new THREE.Group();
  const W = 4.6, H = (W * 9) / 16, LIFT = 1.15;     // 屏幕底边比地面高 LIFT，避免被底座上的主机挡住
  const dark = new THREE.MeshStandardMaterial({ color: 0x121317, roughness: 0.38, metalness: 0.25 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, H + 0.1, 0.07), dark);
  const geo = new THREE.PlaneGeometry(W, H);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const tvMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: 0x000000 });
  const panel = new THREE.Mesh(geo, tvMat);
  panel.position.z = 0.036;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.16, LIFT + 0.1, 0.05), dark);
  neck.position.set(0, -H / 2 - LIFT / 2 + 0.05, -0.03);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.035, 0.55), dark);
  foot.position.set(0, -H / 2 - LIFT + 0.0175, 0.05);
  tv.add(frame, panel, neck, foot);
  for (const m of [frame, neck, foot]) m.castShadow = true;
  tv.position.set(0, GROUND_Y + H / 2 + LIFT, -2.3);
  tv.userData = { mat: tvMat, t: 0, panel };
  tv.visible = false;
  scene.add(tv);
}

function onDockChange(docked) {
  syncChips();
  if (docked) {
    tv.visible = true;
    setTimeout(() => device.docked && view('tv'), 500);
  } else {
    setTimeout(() => !device.docked && view('hero'), 300);
  }
}

// ------------------------------------------------------------------ 视角
function handheldCenter() {
  const p = new THREE.Vector3();
  device.handheld.getWorldPosition(p);
  return p;
}

// 每个视角：相机相对目标点的方向 + 需要装进画面的物体尺寸（宽, 高），距离按当前窗口比例自动算
const VIEWS = {
  play: { dir: [0, 0, 1], target: [0, 0, 0], size: [2.45, 1.08], margin: 1.07 },
  front: { dir: [0, 0.06, 1], target: [0, 0, 0], size: [2.45, 1.08], margin: 1.3 },
  back: { dir: [0.28, 0.25, -1], target: [0, 0, 0], size: [2.45, 1.08], margin: 1.3 },
  hero: { dir: [-0.46, 0.25, 0.85], target: [0, -0.03, 0], size: [2.45, 1.08], margin: 1.22 },
  top: { dir: [0.05, 1, 0.45], target: [0, 0.42, 0], size: [2.5, 0.7], margin: 1.1 },
  bottom: { dir: [0.05, -1, 0.55], target: [0, -0.45, 0], size: [2.45, 0.5], margin: 1.15 },
  side: { dir: [-1, 0.15, 0.32], target: [-0.6, 0, 0], size: [0.9, 1.1], margin: 1.35 },
  joyl: { dir: [-0.3, 0.22, 1], target: [-1.0, 0.02, 0], size: [0.62, 1.12], margin: 1.12 },
  joyr: { dir: [0.3, 0.2, 1], target: [1.0, -0.02, 0], size: [0.62, 1.12], margin: 1.12 },
  sticks: { dir: [-0.1, 0.45, 1], target: [-1.03, 0.22, 0.08], size: [0.42, 0.42], margin: 1.2 },
  explode: { dir: [-0.42, 0.32, 0.85], target: [0, 0.05, 0], size: [3.55, 1.6], margin: 1.12 },
  fill: { dir: [0, 0, 1], target: [0, 0, 0], size: [2.4, 1.03], margin: 1.02 },   // 整台主机铺满窗口
};

let lastView = 'hero';
function view(name, duration = 0.9) {
  if (!device) return;
  lastView = name;
  if (name === 'tv') {
    const d = fitDistance(camera, 4.9, 3.5, 1.1);
    tween.to([0, 1.25, -1.0 + d], [0, 0.95, -1.0], duration);
    return;
  }
  const v = VIEWS[name];
  if (!v) return;
  const c = handheldCenter();
  const dir = new THREE.Vector3(...v.dir).normalize();
  const dist = fitDistance(camera, v.size[0], v.size[1], v.margin);
  const tgt = new THREE.Vector3(...v.target).add(c);
  tween.to(tgt.clone().addScaledVector(dir, dist).toArray(), tgt.toArray(), duration);
}

// ------------------------------------------------------------------ 拾取 & 鼠标操作
const ndc = new THREE.Vector2();
function pick(x, y) {
  if (!device) return null;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const list = tv && tv.visible ? [...device.pickables, tv.userData.panel] : device.pickables;
  const hits = raycaster.intersectObjects(list, false);
  for (const h of hits) {
    if (!h.object.visible || !visibleUp(h.object)) continue;
    return h;
  }
  return null;
}
// 点到的是不是屏幕（掌机屏幕或电视），是的话返回画布像素坐标
function screenPoint(hit) {
  if (!hit || !hit.uv) return null;
  const isScreen = hit.object.material === device.screenMaterial || hit.object === tv?.userData.panel;
  if (!isScreen) return null;
  if (hit.object.material === device.screenMaterial && device.docked) return null;
  return { x: hit.uv.x * 1280, y: hit.uv.y * 720 };
}
function visibleUp(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

const pointers = new Map();
stageEl.addEventListener('pointerdown', (e) => {
  os?.unlockAudio();
  tween.cancel();
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const hit = pick(e.clientX, e.clientY);
  const sp = screenPoint(hit);
  if (sp) screenTaps.set(e.pointerId, { ...sp, x0: e.clientX, y0: e.clientY });
  const part = hit && device.partOf(hit.object);
  if (!part || part.kind === 'info') return;      // 交给 OrbitControls 旋转视角
  e.stopPropagation();
  e.preventDefault();
  stageEl.setPointerCapture(e.pointerId);
  const p = { part, x0: e.clientX, y0: e.clientY, moved: 0 };
  pointers.set(e.pointerId, p);
  if (part.kind === 'button') input.press(part.btn);
  hideTooltip();
}, { capture: true });

stageEl.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) {
    if (e.pointerType === 'mouse' && e.buttons === 0) { hover.x = e.clientX; hover.y = e.clientY; hover.dirty = true; }
    return;
  }
  const dx = e.clientX - p.x0, dy = e.clientY - p.y0;
  p.moved = Math.max(p.moved, Math.hypot(dx, dy));
  if (p.part.kind === 'stick') {
    const k = 1 / 55;
    let sx = dx * k, sy = -dy * k;
    const m = Math.hypot(sx, sy);
    if (m > 1) { sx /= m; sy /= m; }
    input.setStick(p.part.side, sx, sy);
  }
}, { capture: true });

// 触摸屏：在屏幕上点一下（没有拖动）就把点击位置交给主机系统
const screenTaps = new Map();
function endScreenTap(e) {
  const t = screenTaps.get(e.pointerId);
  if (!t) return;
  screenTaps.delete(e.pointerId);
  if (e.type === 'pointerup' && Math.hypot(e.clientX - t.x0, e.clientY - t.y0) < 6) os?.tap?.(t.x, t.y);
}

function endPointer(e) {
  endScreenTap(e);
  const p = pointers.get(e.pointerId);
  if (!p) return;
  pointers.delete(e.pointerId);
  const part = p.part;
  const tap = p.moved < 6;
  if (part.kind === 'button') input.release(part.btn);
  if (part.kind === 'stick') {
    input.setStick(part.side, 0, 0);
    if (tap && part.btn) { input.press(part.btn); setTimeout(() => input.release(part.btn), 140); }
  }
  if (tap && part.kind === 'toggle') device.toggle(part.toggle);
  if (tap && part.kind === 'release') device.toggleJoyCon(part.side);
  if (tap && part.kind === 'dock') device.setDocked(!device.docked);
}
stageEl.addEventListener('pointerup', endPointer, { capture: true });
stageEl.addEventListener('pointercancel', endPointer, { capture: true });
stageEl.addEventListener('pointerleave', () => { hover.dirty = true; hover.x = -1e4; });
stageEl.addEventListener('contextmenu', (e) => e.preventDefault());

// 双击：拉近到点击的位置
stageEl.addEventListener('dblclick', (e) => {
  const hit = pick(e.clientX, e.clientY);
  if (!hit || screenPoint(hit)) return;
  const part = device.partOf(hit.object);
  if (part && part.kind !== 'info') return;        // 连点按键时不要拉近镜头
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = Math.max(0.35, Math.min(0.9, camera.position.distanceTo(hit.point) * 0.45));
  const pos = hit.point.clone().addScaledVector(dir, dist);
  tween.to(pos.toArray(), hit.point.toArray(), 0.7);
});

// ------------------------------------------------------------------ 悬停提示
const hover = { x: -1e4, y: 0, dirty: false, part: null };
function updateHover() {
  if (!hover.dirty || !device) return;
  hover.dirty = false;

  const hit = pointers.size ? null : pick(hover.x, hover.y);
  let part = hit ? device.partOf(hit.object) : null;
  if (!part && hit && hit.object === tv?.userData.panel) part = { kind: 'info', label: '电视（TV 模式画面）' };
  device.setHover(part && part.kind !== 'info' ? device.highlightMeshes(part) : []);
  stageEl.style.cursor = (part && part.kind !== 'info') || screenPoint(hit) ? 'pointer' : '';
  if (!part) return hideTooltip();
  let sub = '';
  if (screenPoint(hit)) {
    // 屏幕提示只出现前两次，之后玩游戏时不再挡画面
    if (hover.part !== 'screen') hover.screenHints = (hover.screenHints || 0) + 1;
    hover.part = 'screen';
    if (hover.screenHints > 2) return hideTooltip();
    sub = '触摸屏：点击屏幕上的磁贴 / 按钮即可操作';
  } else hover.part = part.kind;
  if (part.kind === 'button') sub = `键盘：${KEY_OF[part.btn] || '—'} · 点击即可按下`;
  else if (part.kind === 'stick') sub = `键盘：${KEY_OF[part.btn]} · 鼠标拖动可推动`;
  else if (part.kind === 'toggle' || part.kind === 'release' || part.kind === 'dock') sub = '点击操作';
  ui.tooltip.innerHTML = `${escapeHTML(part.label || '')}${sub ? `<small>${escapeHTML(sub)}</small>` : ''}`;
  ui.tooltip.style.left = Math.min(window.innerWidth - 270, hover.x + 16) + 'px';
  ui.tooltip.style.top = Math.min(window.innerHeight - 60, hover.y + 18) + 'px';
  if (!document.body.classList.contains('clean')) ui.tooltip.classList.add('show');   // 隐藏文字模式下不弹提示
}
function hideTooltip() { ui.tooltip.classList.remove('show'); }
function escapeHTML(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ------------------------------------------------------------------ 键位标注
const tagEls = new Map();
const tmpV = new THREE.Vector3();
function updateTags() {
  if (!device) return;
  if (!tagsOn) { if (tagEls.size) { tagEls.forEach((el) => el.remove()); tagEls.clear(); } return; }
  const r = renderer.domElement.getBoundingClientRect();
  for (const a of device.buttonAnchors()) {
    let el = tagEls.get(a.name);
    if (!el) {
      el = document.createElement('div');
      el.className = 'tag';
      el.textContent = TAG_OF[a.name] || a.name;
      ui.tags.appendChild(el);
      tagEls.set(a.name, el);
    }
    const toCam = tmpV.copy(camera.position).sub(a.pos).normalize();
    const facing = toCam.dot(a.normal);
    const p = a.pos.clone().addScaledVector(a.normal, 0.04).project(camera);
    // SL / SR 藏在滑轨里，只有拆下 Joy-Con 时才显示
    const rail = /^S[LR]_([LR])$/.exec(a.name);
    const hidden = rail && device.joycons[rail[1]].t < 0.6;
    const show = !hidden && facing > 0.12 && p.z < 1;
    el.style.opacity = show ? String(Math.min(1, (facing - 0.12) * 4)) : '0';
    el.style.left = (r.left + (p.x * 0.5 + 0.5) * r.width + 13) + 'px';
    el.style.top = (r.top + (-p.y * 0.5 + 0.5) * r.height - 13) + 'px';
  }
}

// ------------------------------------------------------------------ 面板
const chips = [...document.querySelectorAll('[data-act]')];
function syncChips() {
  if (!device) return;
  const state = {
    joyL: !device.joycons.L?.attached, joyR: !device.joycons.R?.attached,
    kickstand: !!device.toggles.kickstand?.open, cardcover: !!device.toggles.cardcover?.open,
    dock: device.docked, explode: device.exploded, tags: tagsOn, spin: controls.autoRotate, wire: !!device.wire, touch: touchpad.visible,
  };
  const labels = {
    joyL: ['拆下左 Joy-Con', '装上左 Joy-Con'], joyR: ['拆下右 Joy-Con', '装上右 Joy-Con'],
    kickstand: ['打开支架', '收起支架'], cardcover: ['打开卡槽盖', '合上卡槽盖'],
    dock: ['放入底座', '取出主机'], explode: ['爆炸视图', '合上部件'],
  };
  for (const c of chips) {
    const k = c.dataset.act;
    if (k in state) c.setAttribute('aria-pressed', String(state[k]));
    if (labels[k]) c.textContent = labels[k][state[k] ? 1 : 0];
  }
}
for (const c of chips) {
  c.addEventListener('click', () => {
    if (!device) return;
    const k = c.dataset.act;
    if (k === 'joyL') device.toggleJoyCon('L');
    if (k === 'joyR') device.toggleJoyCon('R');
    if (k === 'kickstand') { device.toggle('kickstand'); if (device.toggles.kickstand.open) view('back'); }
    if (k === 'cardcover') { device.toggle('cardcover'); if (device.toggles.cardcover.open) view('top'); }
    if (k === 'dock') device.setDocked(!device.docked);
    if (k === 'explode') { device.setExploded(!device.exploded); view(device.exploded ? 'explode' : 'hero'); }
    if (k === 'tags') tagsOn = !tagsOn;
    if (k === 'spin') controls.autoRotate = !controls.autoRotate;
    if (k === 'wire') { device.wire = !device.wire; device.setWireframe(device.wire); }
    if (k === 'theme') toggleTheme();
    if (k === 'touch') touchpad.visible = !touchpad.visible;
    if (k === 'photo') savePhoto();
    if (k === 'full') toggleFullscreen();
    if (k === 'help') openHelp();
    syncChips();
    c.blur();
  });
}
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
  view(b.dataset.view);
  b.blur();
  if (window.innerWidth <= 760) setPanel(false);
}));

function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('switch3d-theme', root.dataset.theme); } catch (e) { /* 无痕模式等 */ }
}
try {
  const t = localStorage.getItem('switch3d-theme');
  if (t) document.documentElement.dataset.theme = t;
} catch (e) { /* ignore */ }

// 面板：手机上是底部抽屉（.open），桌面上可以收起到右侧（.collapsed）
const menuBtn = $('#menuBtn');
const isNarrow = () => window.innerWidth <= 760;
function setPanel(open) {
  if (isNarrow()) {
    ui.panel.classList.toggle('open', open);
    menuBtn.textContent = open ? '收起' : '菜单';
  } else {
    ui.panel.classList.toggle('collapsed', !open);
    menuBtn.classList.toggle('show', !open);
    menuBtn.textContent = '菜单';
    onResize();
    view(lastView, 0.5);
  }
  menuBtn.setAttribute('aria-expanded', String(open));
}
menuBtn.addEventListener('click', () => {
  setPanel(isNarrow() ? !ui.panel.classList.contains('open') : ui.panel.classList.contains('collapsed'));
});
$('#collapseBtn').addEventListener('click', () => setPanel(false));

// 帮助
const help = $('#help');
$('#helpKeys').innerHTML = KEY_HELP.map(([k, v]) => `<span>${escapeHTML(k)}</span><span>${v.split(' / ').map((x) => `<kbd>${escapeHTML(x)}</kbd>`).join(' / ')}</span>`).join('');
function openHelp() { if (!help.open) help.showModal(); }
$('#helpClose').addEventListener('click', () => help.close());
window.addEventListener('keydown', (e) => {
  if (e.key === '?' || e.key === 'F1') { e.preventDefault(); help.open ? help.close() : openHelp(); }
  os?.unlockAudio();
});

// 网页以 Artifact 形式发布时，查看器的沙箱不允许下载文件：隐藏下载类功能
const IN_ARTIFACT = !!window.__ARTIFACT__;
if (IN_ARTIFACT) {
  document.querySelector('[data-act=photo]')?.remove();
  document.querySelector('[data-act=help]')?.classList.add('wide');
}

function toggleFullscreen() {
  const el = document.documentElement;
  const p = document.fullscreenElement ? document.exitFullscreen?.() : el.requestFullscreen?.();
  p?.catch?.(() => {});
}

// 3D 画面截图（在同一帧里先渲染再读取，不需要 preserveDrawingBuffer）
function savePhoto() {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = 'switch-3d.png';
  a.click();
}

// 游戏截图（主机的截图键）
function addShot(url) {
  const a = document.createElement(IN_ARTIFACT ? 'div' : 'a');
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  a.className = 'shot';
  if (!IN_ARTIFACT) {
    a.href = url;
    a.download = `switch-截图-${stamp}.png`;
    a.title = '点击保存截图';
  }
  a.innerHTML = `<img alt="游戏截图"><span>${IN_ARTIFACT ? '已截图 · 在主机相册里查看' : '已截图 · 点击保存'}</span>`;
  a.querySelector('img').src = url;
  ui.shots.prepend(a);
  while (ui.shots.children.length > 3) ui.shots.lastChild.remove();
  setTimeout(() => a.style.opacity = '0.85', 4000);
}

// ------------------------------------------------------------------ 隐藏文字 / 放大游戏机
const tText = $('#tText'), tFill = $('#tFill');
function setClean(on) {
  document.body.classList.toggle('clean', on);
  tText.setAttribute('aria-pressed', String(on));
  tText.textContent = on ? '显示文字' : '隐藏文字';
  hideTooltip();
  onResize();          // 面板隐藏后画面中心回到窗口正中
}
let fillBack = null;    // 放大前的相机位置，再按一次恢复
function setFill(on) {
  if (!device) return;
  if (on) {
    fillBack = { pos: camera.position.toArray(), tgt: controls.target.toArray(), panel: false };
    // 桌面端先把右侧面板收起来，主机才能用上整个窗口
    if (!isNarrow() && !ui.panel.classList.contains('collapsed')) {
      ui.panel.classList.add('collapsed');
      menuBtn.classList.add('show');
      fillBack.panel = true;
      onResize();
    }
    if (device.docked && tv) {
      // TV 模式：让电视画面铺满窗口
      const c = tv.position.clone();
      const d = fitDistance(camera, 4.6, (4.6 * 9) / 16, 1.0);
      tween.to([c.x, c.y, c.z + 0.04 + d], [c.x, c.y, c.z], 0.8);
    } else view('fill', 0.8);
  } else if (fillBack) {
    if (fillBack.panel) {
      ui.panel.classList.remove('collapsed');
      menuBtn.classList.remove('show');
      onResize();
    }
    tween.to(fillBack.pos, fillBack.tgt, 0.7);
    fillBack = null;
  }
  tFill.setAttribute('aria-pressed', String(on));
  tFill.textContent = on ? '恢复视角' : '放大游戏机';
}
function zoomStep(k) {
  const off = camera.position.clone().sub(controls.target);
  const d = THREE.MathUtils.clamp(off.length() * k, controls.minDistance, controls.maxDistance);
  off.setLength(d);
  tween.to(controls.target.clone().add(off).toArray(), controls.target.toArray(), 0.3);
}
tText.addEventListener('click', () => { setClean(!document.body.classList.contains('clean')); tText.blur(); });
tFill.addEventListener('click', () => { setFill(tFill.getAttribute('aria-pressed') !== 'true'); tFill.blur(); });
$('#tZoomIn').addEventListener('click', (e) => { zoomStep(0.8); e.currentTarget.blur(); });
$('#tZoomOut').addEventListener('click', (e) => { zoomStep(1.25); e.currentTarget.blur(); });
window.addEventListener('keydown', (e) => {
  if (help.open || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'KeyT') setClean(!document.body.classList.contains('clean'));
  if (e.code === 'KeyF') setFill(tFill.getAttribute('aria-pressed') !== 'true');
});

// ------------------------------------------------------------------ 主循环
let last = performance.now();
let lastApp = '';
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  input.enabled = !help.open;
  const pad = input.poll();
  if (device && os) {
    os.update(dt, pad);
    if (os.screenOn || (device.screenLevel ?? 1) > 0.005) screenTex.needsUpdate = true;
    device.update(dt, pad, os);
    // 屏幕亮度：睡眠 / 插入底座（TV 模式）时熄屏
    const level = os.screenOn ? Math.min(1, 0.25 + 0.88 * os.brightness) : 0;   // 默认亮度 0.85 ≈ 满亮
    const handheldLevel = device.docked && device.dockT > 0.97 ? 0 : level;
    device.screenLevel = THREE.MathUtils.lerp(device.screenLevel ?? 0, handheldLevel, 1 - Math.exp(-dt * 10));
    device.setScreenLevel(device.screenLevel);
    if (tv) {
      const want = device.docked && device.dockT > 0.98 ? 1 : 0;
      tv.userData.t = THREE.MathUtils.lerp(tv.userData.t, want, 1 - Math.exp(-dt * 6));
      tv.scale.set(1, Math.max(0.001, tv.userData.t), 1);
      tv.visible = tv.userData.t > 0.002;
      tv.userData.mat.color.setScalar(level * Math.min(1, tv.userData.t * 1.5));
    }
    if (os.appName !== lastApp) {
      lastApp = os.appName;
      ui.app.textContent = lastApp;
    }
    ui.live.classList.toggle('off', !os.screenOn);
  }
  updateHover();
  tween.update(dt);
  controls.update(dt);
  updateTags();
  renderer.render(scene, camera);
}

loadModel();
requestAnimationFrame(frame);
// 调试 / 自动化测试用
window.__switch = { get device() { return device; }, get os() { return os; }, camera, controls, view, input };
syncChips();

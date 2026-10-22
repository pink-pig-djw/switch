// 把 Blender 导出的 GLB 变成一台“会动”的主机：按键按下、摇杆倾斜、Joy-Con 拆装、
// 支架 / 卡槽盖开合、底座插拔、指示灯、屏幕贴图。
// GLB 里的可交互节点通过 extras（three.js 中的 userData）描述：
//   btn + press | pressAxis/pressAngle  按键        stick + tilt      摇杆
//   toggle + openAxis/openAngle          开合部件    joycon            Joy-Con 根节点
//   release                              解锁按钮    led / ledIndex    玩家指示灯
//   label / info                         悬停提示文字
import * as THREE from 'three';
import { GROUND_Y } from './scene.js';

const MM = 0.01;                       // GLB 单位是毫米，场景里 1 = 100 mm
const PRESS_GLOW = new THREE.Color(0xff7a1a);
const HOVER_GLOW = new THREE.Color(0x3aa0ff);
const LED_ON = new THREE.Color(0x3dff7a);
const HOME_GLOW = new THREE.Color(0x58b6ff);
const DOCK_GREEN = new THREE.Color(0x46ff6a);

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

function meshesOf(node) {
  const out = [];
  node.traverse((o) => { if (o.isMesh) out.push(o); });
  return out;
}

export class Device {
  constructor(gltfScene) {
    this.model = gltfScene;
    this.model.scale.setScalar(MM);
    this.root = new THREE.Group();
    this.root.name = 'DeviceRoot';
    this.root.add(this.model);

    this.buttons = new Map();
    this.sticks = {};
    this.toggles = {};
    this.joycons = {};
    this.leds = { L: [], R: [] };
    this.pickables = [];
    this.fx = new Map();                // mesh → { press, hover, base }
    this.screenMaterial = null;
    this.glassMeshes = [];
    this.docked = false;
    this.dockT = 0;
    this.dockAnim = null;
    this.listeners = {};

    // 每个网格一份独立材质，方便单独高亮
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = false;
      o.material = o.material.clone();
      if (o.material.name === 'Screen') this.screenMaterial = o.material;
      this.pickables.push(o);
    });

    const console_ = this.model.getObjectByName('Console');
    const jl = this.model.getObjectByName('JoyCon_L');
    const jr = this.model.getObjectByName('JoyCon_R');
    // 主机 + 两只 Joy-Con 放进同一个“掌机”组，插底座时一起移动
    this.handheld = new THREE.Group();
    this.handheld.name = 'Handheld';
    this.model.add(this.handheld);
    for (const n of [console_, jl, jr]) this.handheld.attach(n);

    this.dock = this.model.getObjectByName('Dock');
    this.dockLed = this.model.getObjectByName('Dock_LED');
    this.homeRing = this.model.getObjectByName('HomeRing');

    this.model.traverse((o) => {
      const u = o.userData || {};
      if (u.btn && (u.press || u.pressAxis) && !u.stick) {
        this.buttons.set(u.btn, {
          node: o, meshes: meshesOf(o), restPos: o.position.clone(), restQuat: o.quaternion.clone(),
          press: u.press ? new THREE.Vector3(...u.press) : null,
          axis: u.pressAxis ? new THREE.Vector3(...u.pressAxis) : null,
          angle: THREE.MathUtils.degToRad(u.pressAngle || 0),
          t: 0, virtual: 0,
        });
      }
      if (u.stick && u.tilt) {
        this.sticks[u.stick] = {
          node: o, meshes: meshesOf(o), restPos: o.position.clone(), btn: u.btn,
          press: new THREE.Vector3(...u.press), tilt: THREE.MathUtils.degToRad(u.tilt), x: 0, y: 0, t: 0,
        };
      }
      if (u.toggle && u.openAxis) {
        this.toggles[u.toggle] = {
          node: o, restQuat: o.quaternion.clone(), axis: new THREE.Vector3(...u.openAxis),
          angle: THREE.MathUtils.degToRad(u.openAngle), open: false, t: 0,
        };
      }
      if (u.joycon) {
        this.joycons[u.joycon] = { node: o, restPos: o.position.clone(), attached: true, t: 0, target: 0, notified: true };
      }
      if (u.led) this.leds[u.led][u.ledIndex - 1] = o;
    });

    // 底座默认收起：放在主机正下方的地面上，隐藏
    if (this.dock) {
      this.dockRest = new THREE.Vector3(0, (GROUND_Y / MM) + 14.0, 0);
      this.dockSeat = this.dock.userData.seat || 1.2;
      this.dock.position.copy(this.dockRest);
      this.dock.visible = false;
    }
    this.handheldRest = this.handheld.position.clone();

    // 按键网格的中心（节点局部坐标），用于键位标注定位
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const bb = new THREE.Box3();
    const inv = new THREE.Matrix4();
    for (const b of this.buttons.values()) {
      box.makeEmpty();
      inv.copy(b.node.matrixWorld).invert();
      for (const m of b.meshes) {
        m.geometry.computeBoundingBox();
        bb.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
        box.union(bb);
      }
      b.center = box.getCenter(new THREE.Vector3());
    }

    this.ledBlink = { L: 0, R: 0 };
    this.homeGlow = 0;
    this.buildExplode();
  }

  // 爆炸视图：每个部件沿“离开机身”的方向分开（单位 mm，父节点坐标系）
  buildExplode() {
    const items = [];
    const add = (node, dir) => node && items.push({ node, rest: node.position.clone(), dir: new THREE.Vector3(...dir) });
    const byName = (n) => this.model.getObjectByName(n);
    for (const b of this.buttons.values()) {
      if (b.press) b.explode = b.press.clone().normalize().multiplyScalar(-15);
      else b.explode = new THREE.Vector3(b.node.position.x > 0 ? 7 : -7, 11, -9);   // ZL / ZR：往上往后
    }
    for (const s of Object.values(this.sticks)) s.explode = new THREE.Vector3(0, 0, 24);
    add(byName('Console_Glass'), [0, 0, 22]);
    add(byName('GameCardCover'), [0, 12, 0]);
    add(byName('Kickstand'), [0, 0, -14]);
    add(byName('Console_GameCard'), [0, 36, 0]);
    add(byName('Console_Vent'), [0, 8, 0]);
    add(byName('Console_Jack'), [0, 10, 0]);
    add(byName('Console_USBC'), [0, -10, 0]);
    add(byName('Console_Screws'), [0, 0, -8]);
    add(byName('Console_TopPrint'), [0, 3, 0]);
    add(byName('HomeRing'), [0, 0, 9]);
    add(byName('IRCamera'), [0, -9, 0]);
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;                // 滑轨朝向主机
      add(byName(`JoyCon_${side}_Rail`), [sx * 4, 0, 0]);
      add(byName(`JoyCon_${side}_RailPrint`), [sx * 10, 0, 0]);
      add(byName(`JoyCon_${side}_Pins`), [sx * 10, 0, 0]);
      add(byName(`JoyCon_${side}_Latch`), [sx * 10, 0, 0]);
      add(byName(`Sync_${side}`), [sx * 10, 0, 0]);
      this.leds[side].forEach((m) => add(m, [sx * 10, 0, 0]));
    }
    this.explodeItems = items;
    this.explodeT = 0;
    this.exploded = false;
  }

  setExploded(on) {
    this.exploded = on;
    this.emit('explode', on);
  }

  on(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, ...args) { (this.listeners[name] || []).forEach((fn) => fn(...args)); }

  // ---------- 查询 ----------
  partOf(object) {
    // 从被射线命中的网格往上找，返回最近的“有意义”的节点信息
    let o = object;
    while (o && o !== this.model) {
      const u = o.userData || {};
      if (u.stick) return { kind: 'stick', side: u.stick, node: o, label: u.label, btn: this.sticks[u.stick]?.btn };
      if (u.btn) return { kind: 'button', btn: u.btn, node: o, label: u.label };
      if (u.toggle) return { kind: 'toggle', toggle: u.toggle, node: o, label: u.label };
      if (u.release) return { kind: 'release', side: u.release, node: o, label: u.label };
      if (u.dock) return { kind: 'dock', node: o, label: u.label };
      if (u.info) return { kind: 'info', node: o, label: u.info };
      o = o.parent;
    }
    return null;
  }

  highlightMeshes(part) {
    if (!part) return [];
    if (part.kind === 'button') return this.buttons.get(part.btn)?.meshes || meshesOf(part.node);
    if (part.kind === 'stick') return this.sticks[part.side].meshes;
    if (part.kind === 'toggle') return meshesOf(this.toggles[part.toggle].node);
    return meshesOf(part.node);
  }

  setHover(meshes) {
    for (const [m, f] of this.fx) f.hover = 0;
    for (const m of meshes) this.fxOf(m).hover = 1;
  }

  fxOf(mesh) {
    let f = this.fx.get(mesh);
    if (!f) {
      f = { press: 0, hover: 0, glow: null, base: mesh.material.emissive ? mesh.material.emissive.clone() : null,
            baseI: mesh.material.emissiveIntensity ?? 1 };
      this.fx.set(mesh, f);
    }
    return f;
  }

  // ---------- 动作 ----------
  toggle(name, open) {
    const t = this.toggles[name];
    if (!t) return;
    if (name === 'kickstand' && this.docked && (open ?? !t.open)) return;   // 插在底座里时支架打不开
    t.open = open ?? !t.open;
    this.emit('toggle', name, t.open);
  }

  toggleJoyCon(side, attach) {
    const j = this.joycons[side];
    if (!j || this.dockAnim) return;
    const want = attach ?? !j.attached;
    if (want === j.attached && j.t === j.target) return;
    j.attached = want;
    j.target = want ? 0 : 1;
    j.notified = false;
    this.pulseButton(`release_${side}`);
  }

  setDocked(docked) {
    if (!this.dock || this.dockAnim || docked === this.docked) return;
    // 插底座前先把拆下的 Joy-Con 装回去、收起支架
    if (docked) {
      for (const s of ['L', 'R']) if (!this.joycons[s].attached) this.toggleJoyCon(s, true);
      if (this.toggles.kickstand?.open) this.toggle('kickstand', false);
    }
    this.dockAnim = { from: this.dockT, to: docked ? 1 : 0, time: 0, duration: 1.7 };
    this.docked = docked;
    this.dock.visible = true;
    this.emit('dock', docked);
  }

  pulseButton(key) {
    // 解锁按钮之类的装饰性按键，点一下动一下
    const node = this.model.getObjectByName(key === 'release_L' ? 'Release_L' : key === 'release_R' ? 'Release_R' : key);
    if (!node) return;
    node.userData._pulse = 0.25;
  }

  // ---------- 每帧 ----------
  update(dt, pad, os) {
    const down = pad.down;
    this.explodeT = approach(this.explodeT, this.exploded ? 1 : 0, 4.5, dt);
    const ex = ease(Math.min(1, this.explodeT * 1.02));
    for (const it of this.explodeItems) it.node.position.copy(it.rest).addScaledVector(it.dir, ex);
    // 按键
    for (const [name, b] of this.buttons) {
      const target = down[name] ? 1 : 0;
      b.t = approach(b.t, target, target ? 45 : 28, dt);
      b.node.position.copy(b.restPos).addScaledVector(b.explode, ex);
      if (b.press) b.node.position.addScaledVector(b.press, b.t);
      if (b.axis) {
        b.node.quaternion.copy(b.restQuat).multiply(new THREE.Quaternion().setFromAxisAngle(b.axis, b.angle * b.t));
      }
      for (const m of b.meshes) this.fxOf(m).press = b.t;
    }
    // 摇杆
    for (const side of ['L', 'R']) {
      const s = this.sticks[side];
      if (!s) continue;
      const tx = side === 'L' ? pad.lx : pad.rx;
      const ty = side === 'L' ? pad.ly : pad.ry;
      s.x = approach(s.x, tx, 30, dt);
      s.y = approach(s.y, ty, 30, dt);
      s.node.rotation.set(-s.y * s.tilt, s.x * s.tilt, 0);
      const pt = down[s.btn] ? 1 : 0;
      s.t = approach(s.t, pt, 40, dt);
      s.node.position.copy(s.restPos).addScaledVector(s.press, s.t).addScaledVector(s.explode, ex);
      for (const m of s.meshes) this.fxOf(m).press = s.t * 0.8;
    }
    // 开合部件
    for (const t of Object.values(this.toggles)) {
      t.t = approach(t.t, t.open ? 1 : 0, 7, dt);
      t.node.quaternion.copy(t.restQuat).multiply(new THREE.Quaternion().setFromAxisAngle(t.axis, t.angle * t.t));
    }
    // 解锁按钮的小动画
    this.releaseNodes ||= ['Release_L', 'Release_R'].map((n) => this.model.getObjectByName(n)).filter(Boolean);
    for (const n of this.releaseNodes) {
      n.userData._rest ||= n.position.clone();
      const p = n.userData._pulse || 0;
      n.userData._pulse = Math.max(0, p - dt);
      const k = p > 0 ? Math.sin((p / 0.25) * Math.PI) : 0;
      n.position.copy(n.userData._rest).addScaledVector(new THREE.Vector3(...n.userData.press), k - 18 * ex);
    }
    this.updateJoyCons(dt, os);
    this.updateDock(dt, os);
    this.updateLights(dt, pad, os);
    this.updateFx();
  }

  updateJoyCons(dt, os) {
    for (const side of ['L', 'R']) {
      const j = this.joycons[side];
      if (!j) continue;
      const speed = 1 / 1.15;
      if (j.t < j.target) j.t = Math.min(j.target, j.t + dt * speed);
      if (j.t > j.target) j.t = Math.max(j.target, j.t - dt * speed);
      const sx = side === 'L' ? -1 : 1;
      // 先沿滑轨向上滑出，再向外侧移开并落回原来的高度
      const a = Math.min(1, j.t / 0.55);
      const b = Math.max(0, (j.t - 0.55) / 0.45);
      const up = 112 * ease(a) * (1 - ease(b));
      const out = 42 * ease(b);
      const spread = 46 * ease(Math.min(1, this.explodeT * 1.02));
      j.node.position.set(j.restPos.x + sx * (out + spread), j.restPos.y + up, j.restPos.z + 6 * Math.sin(Math.PI * b));
      j.node.rotation.z = -sx * 0.06 * Math.sin(Math.PI * b);
      // 滑出一半时通知系统“已拆下”，装回到底时通知“已连接”
      if (!j.notified) {
        if (!j.attached && j.t > 0.45) { j.notified = true; os?.setJoyCon(side, false); this.ledBlink[side] = 1.2; this.emit('joycon', side, false); }
        if (j.attached && j.t === 0) { j.notified = true; os?.setJoyCon(side, true); this.ledBlink[side] = 1.2; this.emit('joycon', side, true); }
      }
    }
  }

  updateDock(dt, os) {
    if (!this.dock) return;
    const a = this.dockAnim;
    if (a) {
      a.time += dt;
      const k = Math.min(1, a.time / a.duration);
      this.dockT = a.from + (a.to - a.from) * k;
      if (k >= 1) {
        this.dockAnim = null;
        os?.setDocked(this.docked);
        if (!this.docked) this.dock.visible = false;
      }
    }
    const t = this.dockT;
    // 0 → 0.35：底座从后方滑入、主机抬高；0.35 → 1：主机落进插槽
    const s1 = ease(Math.min(1, t / 0.35));
    const s2 = ease(Math.max(0, (t - 0.35) / 0.65));
    const dockedY = this.dockRest.y + this.dockSeat + 51.0;   // 主机中心离插槽底 51 mm
    const lift = 150 * s1;
    const y = s2 > 0 ? lift * (1 - s2) + dockedY * s2 : lift;
    this.handheld.position.set(this.handheldRest.x, this.handheldRest.y + y, this.handheldRest.z);
    this.dock.position.set(this.dockRest.x, this.dockRest.y, this.dockRest.z - 380 * (1 - s1));
  }

  updateLights(dt, pad, os) {
    const t = performance.now() / 1000;
    for (const side of ['L', 'R']) {
      this.ledBlink[side] = Math.max(0, this.ledBlink[side] - dt);
      const blinking = this.ledBlink[side] > 0;
      const powered = os ? os.screenOn : true;
      this.leds[side].forEach((m, i) => {
        if (!m) return;
        const on = blinking ? i === Math.floor(t * 10) % 4 : powered && i === 0;
        this.fxOf(m).glow = on ? { color: LED_ON, intensity: 2.2 } : null;
      });
    }
    if (pad.pressed.HOME) this.homeGlow = 1.6;
    this.homeGlow = Math.max(0, this.homeGlow - dt);
    if (this.homeRing) {
      const f = this.fxOf(this.homeRing);
      const k = Math.min(1, this.homeGlow);
      f.glow = k > 0 ? { color: HOME_GLOW, intensity: 2.5 * k } : null;
    }
    if (this.dockLed) {
      const f = this.fxOf(this.dockLed);
      f.glow = this.docked && this.dockT > 0.99 ? { color: DOCK_GREEN, intensity: 2.0 } : null;
    }
  }

  updateFx() {
    const c = new THREE.Color();
    for (const [m, f] of this.fx) {
      const mat = m.material;
      if (!mat.emissive) continue;
      c.copy(f.base || new THREE.Color(0, 0, 0)).multiplyScalar(f.baseI);
      let intensity = 1;
      if (f.glow) { c.copy(f.glow.color); intensity = f.glow.intensity; }
      if (f.press > 0.01) c.lerp(PRESS_GLOW, Math.min(1, f.press) * 0.35);
      if (f.hover > 0) c.lerp(HOVER_GLOW, 0.22);
      mat.emissive.copy(c);
      mat.emissiveIntensity = intensity;
    }
  }

  // ---------- 屏幕 ----------
  bindScreen(texture) {
    const m = this.screenMaterial;
    if (!m) return;
    m.emissiveMap = texture;
    m.emissive.setRGB(1, 1, 1);
    m.emissiveIntensity = 1;
    m.toneMapped = false;
    m.roughness = 0.25;
    m.envMapIntensity = 0.12;           // 屏幕上留一点玻璃反光
    // 清漆层会按观察角度压暗下面的自发光（斜着看时画面发灰），屏幕上不用它
    if ('clearcoat' in m) m.clearcoat = 0;
    m.needsUpdate = true;
    // 黑色玻璃边框的环境反射也压一压
    for (const p of this.pickables) if (p.material.name === 'Glass') p.material.envMapIntensity = 0.55;
    // 屏幕材质不参与悬停/按压特效
    this.fx.delete(this.pickables.find((p) => p.material === m));
  }

  setScreenLevel(level) {
    if (this.screenMaterial) this.screenMaterial.emissiveIntensity = level;
  }

  // 每个按键节点在世界空间中的位置和“朝外”方向（键位标注用）
  buttonAnchors() {
    const out = [];
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (const [name, b] of this.buttons) {
      p.copy(b.center);
      b.node.localToWorld(p);
      if (b.press) n.copy(b.press).negate().normalize().transformDirection(b.node.parent.matrixWorld);
      else n.set(0, 0.4, -1).normalize().transformDirection(b.node.parent.matrixWorld);
      out.push({ name, pos: p.clone(), normal: n.clone() });
    }
    for (const side of ['L', 'R']) {
      const s = this.sticks[side];
      if (!s) continue;
      s.node.getWorldPosition(p);
      n.set(0, 0, 1).transformDirection(s.node.parent.matrixWorld);
      p.addScaledVector(n, 0.205);
      out.push({ name: side === 'L' ? 'LSTICK' : 'RSTICK', pos: p.clone(), normal: n.clone() });
    }
    return out;
  }

  setWireframe(on) {
    for (const m of this.pickables) m.material.wireframe = on;
  }
}

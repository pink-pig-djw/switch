// 渲染器、相机、灯光、环境、地面阴影，以及平滑的相机过渡。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const GROUND_Y = -0.72;   // 地面高度（场景单位：1 = 100 mm）

export function createStage(container) {
  // 对数深度缓冲：既能贴近到几毫米看细节，远处也不会出现 0.03 mm 印字 / 0.2 mm 缝隙的深度闪烁
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(32, container.clientWidth / container.clientHeight, 0.002, 80);
  camera.position.set(-2.2, 1.1, 4.6);

  // 灯光：主光投影 + 侧光 + 半球光
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-2.5, 4.5, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3.2;
  key.shadow.camera.right = 3.2;
  key.shadow.camera.top = 3.2;
  key.shadow.camera.bottom = -3.2;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 14;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  key.shadow.radius = 6;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55);
  fill.position.set(3.5, 1.2, 2.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7);
  rim.position.set(0.5, 2.5, -4);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 0.35));

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.22 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y;
  ground.receiveShadow = true;
  scene.add(ground);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.zoomToCursor = true;
  controls.zoomSpeed = 1.1;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.12;
  controls.maxDistance = 14;
  controls.autoRotateSpeed = 1.2;
  controls.target.set(0, 0, 0);

  // 右侧面板会挡住一部分画面：用 setViewOffset 把画面中心往左挪，让主机落在空白区域正中
  const onResize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    const panel = document.getElementById('panel');
    const hidden = !panel || panel.classList.contains('collapsed') || document.body.classList.contains('clean');
    const shift = w > 760 && !hidden ? Math.round((panel.offsetWidth + 16) / 2) : 0;
    camera.aspect = (w + shift * 2) / h;
    camera.userData.freeAspect = (w - shift * 2) / h;   // 面板左侧空白区域的宽高比
    if (shift) camera.setViewOffset(w + shift * 2, h, shift * 2, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  onResize();

  return { renderer, scene, camera, controls, key, ground, onResize };
}

// 相机平滑过渡
export class CameraTween {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.active = null;
  }
  to(position, target, duration = 0.9) {
    this.active = {
      p0: this.camera.position.clone(), t0: this.controls.target.clone(),
      p1: new THREE.Vector3(...position), t1: new THREE.Vector3(...target),
      start: performance.now(), duration,
    };
  }
  cancel() { this.active = null; }
  update() {
    // 用真实时间而不是帧时间，低帧率设备上过渡也不会拖慢
    const a = this.active;
    if (!a) return false;
    const k = Math.min(1, (performance.now() - a.start) / 1000 / a.duration);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    this.camera.position.lerpVectors(a.p0, a.p1, e);
    this.controls.target.lerpVectors(a.t0, a.t1, e);
    if (k >= 1) this.active = null;
    return true;
  }
}

// 让宽 w、高 h 的物体刚好填满视野所需的相机距离
export function fitDistance(camera, w, h, margin = 1.12) {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (camera.userData.freeAspect || camera.aspect));
  const dv = (h * margin) / 2 / Math.tan(vfov / 2);
  const dh = (w * margin) / 2 / Math.tan(hfov / 2);
  return Math.max(dv, dh);
}

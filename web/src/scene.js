// 渲染器、相机、灯光、环境、地面阴影、后期（环境光遮蔽）、画质分档，以及平滑的相机过渡。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { studioEnvironment, backgroundTexture } from './look.js';

export const GROUND_Y = -0.72;   // 地面高度（场景单位：1 = 100 mm）

// 画质档位：像素密度上限、环境光遮蔽（缝隙里的柔和阴影）的分辨率、阴影贴图尺寸、屏幕画面的最高清晰度
export const QUALITY = {
  high: { label: '高', pixelRatio: 2, ao: 1, aoSamples: 16, shadow: 4096, screen: 2 },
  medium: { label: '中', pixelRatio: 1.5, ao: 0.5, aoSamples: 12, shadow: 2048, screen: 2 },
  low: { label: '低', pixelRatio: 1, ao: 0, aoSamples: 0, shadow: 1024, screen: 1 },
};
const TIERS = ['high', 'medium', 'low'];
const QUALITY_KEY = 'switch3d-quality';

// 环境光遮蔽：画面和物体都没动时沿用上一帧的结果，只做最后的混合
class CachedGTAOPass extends GTAOPass {
  constructor(...args) {
    super(...args);
    this.resScale = 1;
    this.refresh = true;
  }
  setSize(w, h) {
    super.setSize(Math.max(1, Math.round(w * this.resScale)), Math.max(1, Math.round(h * this.resScale)));
    this.refresh = true;
  }
  // 地面、接触阴影这类大平面不参与（掠射角下的远处地面会算出一条假的“地平线”阴影）
  _overrideVisibility() {
    super._overrideVisibility();
    this.scene.traverse((o) => {
      if (o.userData.noAO && o.visible) { o.visible = false; this._visibilityCache.push(o); }
    });
  }
  render(renderer, writeBuffer, readBuffer, dt, mask) {
    if (this.refresh || this.output !== GTAOPass.OUTPUT.Default) {
      this.refresh = false;
      super.render(renderer, writeBuffer, readBuffer, dt, mask);
      return;
    }
    const out = this.renderToScreen ? null : writeBuffer;
    this.copyMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    this.copyMaterial.blending = THREE.NoBlending;
    this._renderPass(renderer, this.copyMaterial, out);
    this.blendMaterial.uniforms.intensity.value = this.blendIntensity;
    this.blendMaterial.uniforms.tDiffuse.value = this.pdRenderTarget.texture;
    this._renderPass(renderer, this.blendMaterial, out);
  }
}

// 最后一步只做 sRGB 输出：色调映射已经在各个材质里做过了（见下面 composer 的说明）
class DisplayPass extends OutputPass {
  render(renderer, writeBuffer, readBuffer, dt, mask) {
    const tm = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;
    super.render(renderer, writeBuffer, readBuffer, dt, mask);
    renderer.toneMapping = tm;
  }
}

function detectTier(renderer) {
  // 软件渲染（没有显卡加速）直接用低画质；手机、平板用中画质
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|software|basic render/i.test(name)) return 'low';
  } catch (e) { /* ignore */ }
  if (matchMedia('(pointer: coarse)').matches) return 'medium';
  return 'high';
}

// 物体位置 / 显隐的“指纹”：没变化就不用重画阴影贴图和环境光遮蔽
function sceneSignature(scene) {
  let h = 0, i = 1;
  scene.traverseVisible((o) => {
    if (!o.isMesh) return;
    const e = o.matrixWorld.elements;
    h += i * (e[12] * 1.31 + e[13] * 1.73 + e[14] * 2.11 + e[0] * 0.7 + e[5] * 0.9 + e[9] * 1.1 + e[2] * 1.3 + e[6] * 1.7 + e[1] * 0.5);
    i++;
  });
  return h + i * 1e-3;
}

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;     // 物体动了才重画阴影
  renderer.shadowMap.needsUpdate = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.9;
  scene.background = backgroundTexture();

  const camera = new THREE.PerspectiveCamera(32, container.clientWidth / container.clientHeight, 0.01, 80);
  camera.position.set(-2.2, 1.1, 4.6);

  // 灯光：主光投影 + 侧光 + 轮廓光 + 半球光
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-2.5, 4.5, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3.2;
  key.shadow.camera.right = 3.2;
  key.shadow.camera.top = 3.2;
  key.shadow.camera.bottom = -3.2;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 14;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.008;
  key.shadow.radius = 5;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5);
  fill.position.set(3.5, 1.2, 2.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.75);
  rim.position.set(0.5, 2.5, -4);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 0.25));

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.2 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y;
  ground.receiveShadow = true;
  ground.userData.noAO = true;
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

  // 后期：先渲染到多重采样的浮点缓冲，再叠加环境光遮蔽。
  // 把缓冲标成 isXRRenderTarget，three.js 就会像直接画到屏幕一样在每个材质里做色调映射，
  // 屏幕画面（toneMapped = false）因此能保持和画布一模一样的颜色；最后一步只做 sRGB 输出。
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const composer = new EffectComposer(renderer, rt);
  for (const t of [composer.renderTarget1, composer.renderTarget2]) t.isXRRenderTarget = true;
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new CachedGTAOPass(scene, camera, 1, 1);
  gtao.updateGtaoMaterial({ radius: 0.05, distanceExponent: 1.6, thickness: 0.8, distanceFallOff: 1, scale: 1.15, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  gtao.blendIntensity = 0.92;
  composer.addPass(gtao);
  composer.addPass(new DisplayPass());

  // ---------- 画质 ----------
  let mode = 'auto';
  try {
    const q = new URLSearchParams(location.search).get('q') || localStorage.getItem(QUALITY_KEY);
    if (q === 'auto' || q in QUALITY) mode = q;
  } catch (e) { /* ignore */ }
  let tier = mode === 'auto' ? detectTier(renderer) : mode;
  let aoAllowed = true;           // 线框模式下关掉
  const listeners = [];

  function applyTier() {
    const q = QUALITY[tier];
    const pr = Math.min(window.devicePixelRatio || 1, q.pixelRatio);
    renderer.setPixelRatio(pr);
    composer.setPixelRatio(pr);
    key.shadow.mapSize.set(q.shadow, q.shadow);
    if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    renderer.shadowMap.needsUpdate = true;
    gtao.resScale = q.ao || 1;
    if (q.ao) {
      gtao.updateGtaoMaterial({ samples: q.aoSamples });
      gtao.updatePdMaterial({ radius: q.ao < 1 ? 4 : 6 });
    } else {
      // 低画质不走后期，把占用的显存还回去
      composer.renderTarget1.dispose();
      composer.renderTarget2.dispose();
      gtao.dispose();
    }
    onResize();
    listeners.forEach((fn) => fn(tier, mode));
  }

  // 右侧面板会挡住一部分画面：用 setViewOffset 把画面中心往左挪，让主机落在空白区域正中
  function onResize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    gtao.refresh = true;
    const panel = document.getElementById('panel');
    const body = document.body.classList;
    const hidden = !panel || panel.classList.contains('collapsed') || body.contains('clean') || body.contains('play');
    const shift = w > 760 && !hidden ? Math.round((panel.offsetWidth + 16) / 2) : 0;
    camera.aspect = (w + shift * 2) / h;
    camera.userData.freeAspect = (w - shift * 2) / h;   // 面板左侧空白区域的宽高比
    if (shift) camera.setViewOffset(w + shift * 2, h, shift * 2, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  // 自动画质：连续两段时间帧率偏低就降一档
  const perf = { start: 0, frames: 0, slow: 0, warm: performance.now() + 4000 };
  function watchFps(now) {
    if (mode !== 'auto' || document.hidden) { perf.start = 0; return; }
    if (now < perf.warm) return;
    if (!perf.start) { perf.start = now; perf.frames = 0; return; }
    perf.frames++;
    const span = now - perf.start;
    if (span < 2500) return;
    const ms = span / perf.frames;
    perf.start = 0;
    perf.slow = ms > 26 ? perf.slow + 1 : 0;
    const i = TIERS.indexOf(tier);
    if (perf.slow >= 2 && i < TIERS.length - 1) {
      perf.slow = 0;
      perf.warm = now + 3000;
      tier = TIERS[i + 1];
      applyTier();
    }
  }

  // 近裁剪面跟着观察距离走：贴近看细节时够近，平时深度精度又足够（0.03 mm 的印字也不闪）
  function updateClip() {
    const d = camera.position.distanceTo(controls.target);
    const near = THREE.MathUtils.clamp(d * 0.012, 0.002, 0.05);
    const far = Math.max(40, d * 12);
    if (Math.abs(near - camera.near) > near * 0.05 || far !== camera.far) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  }

  const lastCam = new THREE.Matrix4(), lastProj = new THREE.Matrix4();
  let lastSig = NaN;
  function render(now = performance.now()) {
    watchFps(now);
    updateClip();
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    const sig = sceneSignature(scene);
    const moved = sig !== lastSig;
    if (moved) { lastSig = sig; renderer.shadowMap.needsUpdate = true; }
    const useAO = QUALITY[tier].ao > 0 && aoAllowed;
    if (!useAO) {
      renderer.render(scene, camera);
      gtao.refresh = true;
      return;
    }
    if (moved || !lastCam.equals(camera.matrixWorld) || !lastProj.equals(camera.projectionMatrix)) {
      gtao.refresh = true;
      lastCam.copy(camera.matrixWorld);
      lastProj.copy(camera.projectionMatrix);
    }
    composer.render();
  }

  function setQuality(m) {
    mode = m === 'auto' || m in QUALITY ? m : 'auto';
    try { localStorage.setItem(QUALITY_KEY, mode); } catch (e) { /* ignore */ }
    tier = mode === 'auto' ? detectTier(renderer) : mode;
    perf.slow = 0;
    perf.start = 0;
    perf.warm = performance.now() + 3000;
    applyTier();
  }

  function refreshBackground() {
    scene.background = backgroundTexture(scene.background);
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', refreshBackground);

  applyTier();

  return {
    renderer, scene, camera, controls, key, ground, onResize, render, setQuality, refreshBackground,
    get quality() { return { mode, tier, ...QUALITY[tier] }; },
    onQuality(fn) { listeners.push(fn); },
    setAO(on) { aoAllowed = on; gtao.refresh = true; },
    markDirty() { lastSig = NaN; gtao.refresh = true; },
  };
}

// 相机平滑过渡
export class CameraTween {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.active = null;
  }
  to(position, target, duration = 0.9, ease = null) {
    this.active = {
      p0: this.camera.position.clone(), t0: this.controls.target.clone(),
      p1: new THREE.Vector3(...position), t1: new THREE.Vector3(...target),
      start: performance.now(), duration, ease,
    };
  }
  cancel() { this.active = null; }
  update() {
    // 用真实时间而不是帧时间，低帧率设备上过渡也不会拖慢
    const a = this.active;
    if (!a) return false;
    const k = Math.min(1, (performance.now() - a.start) / 1000 / a.duration);
    const e = a.ease ? a.ease(k) : k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
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

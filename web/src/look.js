// 质感：程序生成的表面纹理（塑料颗粒 / 橡胶 / 金属拉丝）、各部件材质参数、摄影棚环境光、背景。
// 模型的 UV 是 Blender 里做的盒投影：1 个 UV 单位 = 10 mm，所以一张贴图正好铺 10 mm。
import * as THREE from 'three';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 可无缝平铺的分形值噪声（cx × cy 为最低频的格子数，可以不等以做出拉丝那样的条纹）
function tileNoise(size, cx, cy, octaves, seed) {
  const out = new Float32Array(size * size);
  const rnd = mulberry32(seed);
  let amp = 1, sum = 0;
  for (let o = 0; o < octaves; o++) {
    const gx = cx << o, gy = cy << o;
    const g = new Float32Array(gx * gy);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * gy, iy = Math.floor(fy);
      let ty = fy - iy;
      ty = ty * ty * (3 - 2 * ty);
      const y0 = iy % gy, y1 = (iy + 1) % gy;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * gx, ix = Math.floor(fx);
        let tx = fx - ix;
        tx = tx * tx * (3 - 2 * tx);
        const x0 = ix % gx, x1 = (ix + 1) % gx;
        const a = g[y0 * gx + x0], b = g[y0 * gx + x1], c = g[y1 * gx + x0], d = g[y1 * gx + x1];
        out[y * size + x] += amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty);
      }
    }
    sum += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

function dataTexture(data, size, maxAniso) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function normalMap(h, size, strength, maxAniso) {
  const d = new Uint8Array(size * size * 4);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = -(at(x + 1, y) - at(x - 1, y)) * strength;
      const ny = -(at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      d[i] = ((nx / l) * 0.5 + 0.5) * 255;
      d[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      d[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  return dataTexture(d, size, maxAniso);
}

// 粗糙度贴图：three.js 用绿色通道乘以材质的 roughness
function roughnessMap(h, size, lo, hi, maxAniso) {
  const d = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = (lo + (hi - lo) * h[i]) * 255;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  return dataTexture(d, size, maxAniso);
}

export function makeSurfaces(renderer) {
  const an = renderer.capabilities.getMaxAnisotropy();
  const S = 256;
  return {
    grain: normalMap(tileNoise(S, 64, 64, 2, 7), S, 2.6, an),          // 磨砂塑料：约 0.15 mm 的细颗粒
    rubber: normalMap(tileNoise(S, 20, 20, 3, 11), S, 5.0, an),        // 摇杆帽的橡胶颗粒
    brushed: normalMap(tileNoise(S, 2, 96, 2, 23), S, 2.5, an),         // 金属拉丝
    smudge: roughnessMap(tileNoise(S, 3, 3, 4, 31), S, 0.82, 1.0, an),  // 大面积的细微光泽变化
  };
}

// 各材质的“手感”：粗糙度、清漆、表面纹理
const LOOK = {
  JoyBlue: { roughness: 0.48, normal: 'grain', scale: 0.11, rough: true },
  JoyRed: { roughness: 0.48, normal: 'grain', scale: 0.11, rough: true },
  Body: { roughness: 0.6, normal: 'grain', scale: 0.16, rough: true },
  BodyEdge: { roughness: 0.55, normal: 'grain', scale: 0.25 },
  Dock: { roughness: 0.64, normal: 'grain', scale: 0.16, rough: true },
  DockGloss: { roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.12 },
  ButtonGrey: { roughness: 0.42, normal: 'grain', scale: 0.08 },
  Button: { roughness: 0.3, clearcoat: 0.45, clearcoatRoughness: 0.18 },
  Plastic: { roughness: 0.5, normal: 'grain', scale: 0.1 },
  StickCap: { roughness: 0.86, normal: 'rubber', scale: 0.4 },
  StickDome: { roughness: 0.55, normal: 'grain', scale: 0.12 },
  RailMetal: { roughness: 0.3, metalness: 1, normal: 'brushed', scale: 0.3 },
  MetalDark: { roughness: 0.38, metalness: 1, normal: 'brushed', scale: 0.25 },
  Gold: { roughness: 0.22, metalness: 1 },
  Glass: { roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.55 },
  Print: { roughness: 0.6 },
  PrintDim: { roughness: 0.6 },
  Card: { roughness: 0.55, normal: 'grain', scale: 0.1 },
};

export function applyLook(meshes, surfaces) {
  for (const m of meshes) {
    const mat = m.material;
    const L = LOOK[mat.name];
    if (!L) continue;
    if (L.roughness !== undefined) mat.roughness = L.roughness;
    if (L.metalness !== undefined) mat.metalness = L.metalness;
    if ('clearcoat' in mat) {
      mat.clearcoat = L.clearcoat ?? 0;
      if (L.clearcoatRoughness !== undefined) mat.clearcoatRoughness = L.clearcoatRoughness;
    }
    if (L.envMapIntensity !== undefined) mat.envMapIntensity = L.envMapIntensity;
    if (L.normal && m.geometry.attributes.uv) {
      mat.normalMap = surfaces[L.normal];
      mat.normalScale.set(L.scale, L.scale);
    }
    if (L.rough && m.geometry.attributes.uv) mat.roughnessMap = surfaces.smudge;
    mat.needsUpdate = true;
  }
}

// 摄影棚环境：渐变的大背景 + 几块柔光箱 / 灯条，玻璃和按键上会出现干净的条形高光
export function studioEnvironment(renderer) {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(20, 64, 32);
  const col = [];
  const top = new THREE.Color(0.82, 0.84, 0.88), mid = new THREE.Color(0.42, 0.44, 0.48), bot = new THREE.Color(0.1, 0.105, 0.115);
  const p = geo.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 20;
    if (y > 0) c.copy(mid).lerp(top, Math.pow(y, 0.7));
    else c.copy(mid).lerp(bot, Math.pow(-y, 0.5));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, pos, k) => {
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    m.color.multiplyScalar(k);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.set(...pos);
    mesh.lookAt(0, 0, 0);
    s.add(mesh);
  };
  panel(9, 6, [-6, 9, 8], 5.5);     // 主光：左前上方的大柔光箱
  panel(1.6, 11, [11, 2, 4], 4.0);  // 右侧竖灯条
  panel(1.6, 11, [-11, 2, -4], 2.6); // 左后竖灯条（轮廓光）
  panel(12, 2.2, [0, 12, -6], 2.2); // 顶部后方的长灯条
  panel(6, 3, [5, -2, 10], 0.8);    // 前下方补光，压一压暗部
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(s, 0.02).texture;
  pmrem.dispose();
  return tex;
}

// 背景：和页面配色一致的柔和径向渐变（读取 CSS 变量，切换明暗主题时重新生成）
export function backgroundTexture(old) {
  const cs = getComputedStyle(document.documentElement);
  const c1 = cs.getPropertyValue('--bg-1').trim() || '#f4f5f8';
  const c2 = cs.getPropertyValue('--bg-2').trim() || '#d9dde5';
  const S = 1024;
  const cv = old?.image || document.createElement('canvas');
  cv.width = cv.height = S;
  const g2 = cv.getContext('2d', { willReadFrequently: true });
  // 和 CSS 的 radial-gradient(120% 90% at 50% 28%) 一样：画布会被拉伸到整个窗口
  const rx = 1.2 * S, ry = 0.9 * S, cx = 0.5 * S, cy = 0.28 * S;
  g2.setTransform(rx, 0, 0, ry, cx, cy);
  const g = g2.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  g2.fillStyle = g;
  g2.fillRect(-cx / rx, -cy / ry, S / rx, S / ry);
  g2.setTransform(1, 0, 0, 1, 0, 0);
  // 加一点抖动噪点，大面积渐变不会出现色带
  const img = g2.getImageData(0, 0, S, S);
  const rnd = mulberry32(5);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() + rnd() - 1) * 1.6;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g2.putImageData(img, 0, 0);
  const tex = old || new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// 地面上的柔和接触阴影（和平行光阴影叠在一起，让主机“落地”）
export function contactShadow() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(128, 64, 4, 128, 64, 126);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.22)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.save();
  g.scale(1, 0.5);
  g.translate(0, 64);
  g.fillRect(0, 0, 256, 256);
  g.restore();
  const tex = new THREE.CanvasTexture(cv);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 1.2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.55 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  mesh.userData.noAO = true;
  return mesh;
}

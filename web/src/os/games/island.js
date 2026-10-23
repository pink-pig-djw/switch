// 《茶岛生活》：原创的小岛慢生活游戏。钓鱼、捉虫、摇果子，卖给小松茶铺换茶币，
// 找壶爷爷贷款把帐篷升级成小木屋、两层茶屋，把第一次抓到的鱼和虫捐给博物馆，慢慢填满图鉴。
import { GameBase, Particles, controlsBar } from './common.js';
import {
  W, H, clamp, lerp, text, textW, outlineText, fillRR, strokeRR, glyph, axisX, axisY, Nav, mulberry32,
  easeOutBack, easeOutCubic, pad2,
} from '../ui.js';
import {
  FISH, JUNK, BUGS, FRUITS, MISC, FURNITURE, FURN, UPGRADES, HOUSES, NPCS, CHAT,
  SONG_DAY, SONG_EVENING, SONG_NIGHT, SONG_INDOOR, JINGLE_CATCH, JINGLE_HOUSE,
} from './island/data.js';
import {
  WORLD_W, WORLD_H, mapCanvas, coastPoints, glintPoints, buildObjects, walkableGround, ground, isWaterType,
  riverD, pondD, islandR, onDeck, PLAZA, SHOP, MUSEUM, HOUSE, HOUSE_SIZE, MAILBOX, FOUNTAIN, LAMPS, SIGN,
} from './island/world.js';
import {
  treeSprites, buildingSprites, blit, FRUIT_SLOTS, drawFruit, WINDOWS, drawFountain, drawLampPost, drawMailbox,
  drawSign, drawRock, drawFlower, drawPlayer, drawNPC, portrait, drawFishIcon, drawBugIcon, drawItemIcon,
  drawFurniture, drawBugWorld, sprite, setRes, flowerSprite,
} from './island/art.js';

const SAVE_KEY = 'island.save';
const TAU = Math.PI * 2;
const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const DATA = { fish: byId(FISH), junk: byId(JUNK), bug: byId(BUGS) };
const DEX_TOTAL = FISH.length + BUGS.length;
const DIRS = [[0, 1], [-1, 0], [0, -1], [1, 0]];
const FOOT = [[0, 0], [-9, 0], [9, 0], [0, -5], [0, 4]];
const SIZE_PX = { S: 14, M: 20, L: 28, XL: 40 };
const SIZE_NAME = { S: '小', M: '中', L: '大', XL: '特大' };
const WHERE_NAME = { river: '河流', pond: '池塘', sea: '大海', deep: '码头尽头的深海', fly: '花丛上空', flower: '花上', tree: '树干上', grass: '草地', water: '水边', beach: '沙滩', lamp: '路灯旁', rock: '石头旁（雨天）' };
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const inHours = (h, [a, b]) => (a <= b ? h >= a && h < b : h >= a || h < b);
const hoursText = ([a, b]) => (a === 0 && b === 24 ? '全天' : `${a}:00 — ${b}:00`);

// —— 素材只生成一次（磁贴只用到便宜的小图，地图等进游戏才生成）——
let SPR = null;
function sprites() {
  if (!SPR) SPR = { trees: treeSprites(), blds: buildingSprites() };
  return SPR;
}
let ASSETS = null;
function assets() {
  if (ASSETS) return ASSETS;
  const glow = (r, g, b, R) => sprite(R * 2, R * 2, R, R, (c) => {
    const gr = c.createRadialGradient(0, 0, 2, 0, 0, R);
    gr.addColorStop(0, `rgba(${r},${g},${b},0.85)`);
    gr.addColorStop(0.4, `rgba(${r},${g},${b},0.35)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = gr;
    c.fillRect(-R, -R, R * 2, R * 2);
  });
  ASSETS = {
    map: mapCanvas(), coast: coastPoints(), glints: glintPoints(), ...sprites(),
    objs: buildObjects(), warm: glow(255, 196, 110, 102), warmS: glow(255, 196, 110, 52), green: glow(190, 255, 120, 30),
  };
  return ASSETS;
}

// —— 天色：一天里不同时刻叠加的颜色 ——
const SKY = [[0, [86, 94, 168]], [4.5, [86, 94, 168]], [6, [255, 196, 176]], [7.5, [255, 255, 255]], [16.5, [255, 255, 255]],
  [18, [255, 192, 138]], [19.5, [150, 118, 168]], [21, [86, 94, 168]], [24, [86, 94, 168]]];
function skyTint(h) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, c0] = SKY[i], [h1, c1] = SKY[i + 1];
    if (h >= h0 && h <= h1) {
      const t = (h - h0) / (h1 - h0 || 1);
      return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
    }
  }
  return [255, 255, 255];
}
function nightLevel(h) {
  if (h >= 21 || h < 4.5) return 1;
  if (h >= 18.5) return (h - 18.5) / 2.5;
  if (h < 6.2) return 1 - (h - 4.5) / 1.7;
  return 0;
}
export function rainyDay(day) {
  if (day <= 1) return null;
  const r = mulberry32(day * 7919 + 13);
  if (r() > 0.27) return null;
  return { start: 5 + Math.floor(r() * 10), dur: 4 + Math.floor(r() * 10) };
}
export function isRaining(day, h) {
  const a = rainyDay(day), b = rainyDay(day - 1);
  if (a && h >= a.start && h < a.start + a.dur) return true;
  if (b && b.start + b.dur > 24 && h < b.start + b.dur - 24) return true;
  return false;
}

function wrapText(c, str, maxW, size, weight = 600) {
  const out = [];
  for (const para of String(str).split('\n')) {
    let cur = '';
    for (const ch of para) {
      if (cur && textW(c, cur + ch, size, weight) > maxW && !'，。！？、；：”）…'.includes(ch)) { out.push(cur); cur = ch; } else cur += ch;
    }
    out.push(cur);
  }
  return out;
}

function drawTile(c, s) {
  const k = s / 256;
  c.save();
  c.scale(k, k);
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#6fd3ea');
  g.addColorStop(1, '#2f8fd0');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6; i++) { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 3; c.beginPath(); c.arc(30 + i * 40, 30 + (i % 3) * 20, 8, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  c.fillStyle = '#f3e0a6';
  c.beginPath(); c.ellipse(128, 128, 104, 76, -0.1, 0, TAU); c.fill();
  c.fillStyle = '#8fcf63';
  c.beginPath(); c.ellipse(124, 120, 86, 58, -0.1, 0, TAU); c.fill();
  c.fillStyle = '#79d2ef';
  c.beginPath(); c.ellipse(76, 132, 20, 13, 0, 0, TAU); c.fill();
  const T = sprites().trees, B = sprites().blds;
  blitScaled(c, B.house1, 150, 128, 0.42);
  blitScaled(c, T.palm, 206, 156, 0.55);
  blitScaled(c, T.orange, 58, 104, 0.5);
  blitScaled(c, T.cedar, 92, 96, 0.42);
  drawFruit(c, 'orange', 52, 76, 0.9);
  // 跳出水面的小鱼
  c.save();
  c.translate(206, 60);
  c.rotate(-0.5);
  drawFishIcon(c, FISH[11], 0, 0, 46);
  c.restore();
  drawPlayer(c, 150, 158, { dir: 0, tool: 2 });
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.fillRect(0, 196, 256, 60);
  outlineText(c, '茶岛生活', 128, 226, 42, '#ffffff', '#2a6a3a', 9);
  c.restore();
}
function blitScaled(c, sp, x, y, s) {
  c.drawImage(s < 0.75 ? sp.cv1 : sp.cv2, x - sp.ox * s, y - sp.oy * s, sp.w * s, sp.h * s);
}

export class Island extends GameBase {
  static meta = { id: 'island', name: '茶岛生活', kind: 'game', color: '#4fae55', tile: drawTile };

  constructor(os) {
    super(os);
    this.A = assets();
    this.parts = new Particles(260);
    this.fx2 = new Particles(160);      // 屏幕坐标的特效（彩纸）
    this.nav = new Nav(0.3, 0.09);
    this.s = this.load();
    this.titleSel = 0;
    this.confirmNew = false;
    this.camX = 0;
    this.camY = 0;
    this.setMode('title');
  }

  // ———————————————— 存档 ————————————————
  newState() {
    const trees = this.A.objs.trees;
    return {
      v: 1, coins: 300, debt: 0, house: 0, day: 1, min: 7 * 60 + 30, inv: [], bag: 12, rod: 0, net: 0, tool: 1,
      caught: {}, donated: {}, donations: 0, gifts: {},
      fruit: trees.map((t) => (t.kind === 'cedar' ? 0 : 3)), regrow: trees.map(() => 0),
      room: { f1: [], f2: [] }, quests: {}, questsDone: { dango: 0, kuri: 0 }, px: HOUSE.x, py: HOUSE.y + 70, dir: 0,
      stats: { fish: 0, bug: 0, shake: 0, earned: 0 }, done: false,
    };
  }
  load() {
    const raw = this.os.store.get(SAVE_KEY, null);
    if (!raw || raw.v !== 1) return null;
    const s = Object.assign(this.newState(), raw);
    if (!Array.isArray(s.inv)) s.inv = [];
    if (s.fruit.length !== this.A.objs.trees.length) { s.fruit = this.newState().fruit; s.regrow = this.newState().regrow; }
    return s;
  }
  persist() {
    if (!this.s || this.mode !== 'play') return;
    this.s.px = Math.round(this.p.x);
    this.s.py = Math.round(this.p.y);
    this.s.dir = this.p.dir;
    this.os.store.set(SAVE_KEY, this.s);
  }
  close() {
    this.persist();
    this.sfx.music.stop();
  }
  // 暂停菜单的“重新开始”：存档后回到标题页（不删存档）
  restart() {
    this.persist();
    this.sfx.music.stop();
    this.curSong = null;
    this.s = this.load();
    this.titleSel = 0;
    this.setMode('title');
  }

  // ———————————————— 开始 ————————————————
  start(fresh = false) {
    if (fresh || !this.s) {
      this.s = this.newState();
      this.os.store.set(SAVE_KEY, this.s);
      this.isNew = true;
    } else this.isNew = false;
    const s = this.s;
    this.p = { x: s.px, y: s.py, dir: s.dir || 0, walk: 0, moving: false, speed: 0, swing: 0, swollen: 0, run: false };
    this.npcs = null;
    this.buildSolids();
    [this.p.x, this.p.y] = this.findStand(this.p.x, this.p.y);
    this.fish = null;
    this.shadows = [];
    this.bugs = [];
    this.drops = [];
    this.swarm = null;
    this.toasts = [];
    this.floaters = [];
    this.popup = null;
    this.dlg = null;
    this.menu = null;
    this.shake = new Map();
    this.spawnT = 0;
    this.saveT = 0;
    this.secT = 0;
    this.hint = '';
    this.curSong = null;
    this.rain = Array.from({ length: 150 }, () => ({ x: Math.random() * W, y: Math.random() * H, l: 10 + Math.random() * 14 }));
    this.ripples = [];
    this.sleepT = 0;
    this.buildSolids();
    this.spawnNPCs();
    this.snapCamera();
    this.setMode('play');
    if (this.isNew) this.introDialog();
    else this.toast(`第 ${s.day} 天 · 欢迎回来`);
  }

  introDialog() {
    const e = this.npcs.find((n) => n.id === 'elder');
    [e.x, e.y] = this.findStand(this.p.x + 60, this.p.y - 6, e);
    e.tx = e.x; e.ty = e.y; e.wait = 6; e.dir = 1;
    this.p.dir = 3;
    this.say('elder', [
      '哎呀，你就是新来的岛民吧？欢迎来到茶岛！我是壶爷爷，呵呵。',
      '先在这顶帐篷里住下吧。这根鱼竿和捕虫网，送给你。',
      '钓鱼、捉虫、摇树上的果子，拿去广场上的小松茶铺卖掉，就能换茶币。',
      '第一次抓到的鱼和虫，记得捐给岛屿博物馆，慢慢馆长会很高兴的。',
      '攒到茶币以后……来找我，帮你把房子盖得更好，呵呵。',
    ], () => {
      this.toast('获得了 鱼竿、捕虫网');
      this.toast('L / R 切换工具 · X 背包 · Y 图鉴');
    });
  }

  // ———————————————— 世界 ————————————————
  buildSolids() {
    const o = [];
    for (const t of this.A.objs.trees) o.push({ c: true, x: t.x, y: t.y - 4, r: t.kind === 'palm' ? 12 : 15 });
    for (const r of this.A.objs.rocks) o.push({ c: true, x: r.x, y: r.y - 6, r: 18 * r.s });
    o.push({ c: true, x: FOUNTAIN.x, y: FOUNTAIN.y - 4, r: FOUNTAIN.r });
    for (const [x, y] of LAMPS) o.push({ c: true, x, y, r: 6 });
    o.push({ c: true, x: MAILBOX.x, y: MAILBOX.y, r: 9 });
    o.push({ x0: SIGN.x - 26, x1: SIGN.x + 26, y0: SIGN.y - 6, y1: SIGN.y + 2 });
    o.push({ x0: SHOP.x - SHOP.w / 2, x1: SHOP.x + SHOP.w / 2, y0: SHOP.y - SHOP.h, y1: SHOP.y });
    o.push({ x0: MUSEUM.x - MUSEUM.w / 2, x1: MUSEUM.x + MUSEUM.w / 2, y0: MUSEUM.y - MUSEUM.h, y1: MUSEUM.y });
    const [hw, hh] = HOUSE_SIZE[this.s.house];
    o.push({ x0: HOUSE.x - hw / 2, x1: HOUSE.x + hw / 2, y0: HOUSE.y - hh, y1: HOUSE.y });
    this.solids = o;
  }
  blocked(x, y, ignoreNpc = null) {
    for (const o of this.solids) {
      if (o.c) { const dx = x - o.x, dy = (y - o.y) * 1.3; if (dx * dx + dy * dy < (o.r + 9) * (o.r + 9)) return true; }
      else if (x > o.x0 - 9 && x < o.x1 + 9 && y > o.y0 - 2 && y < o.y1 + 6) return true;
    }
    if (this.npcs) for (const n of this.npcs) if (n !== ignoreNpc && Math.abs(n.x - x) < 18 && Math.abs(n.y - y) < 12) return true;
    return false;
  }
  canStand(x, y, ignoreNpc) {
    for (const [ox, oy] of FOOT) if (!walkableGround(x + ox, y + oy)) return false;
    return !this.blocked(x, y, ignoreNpc);
  }
  houseDoor() { return [HOUSE.x, HOUSE.y + 8]; }

  findStand(x, y, ignore) {
    if (this.canStand(x, y, ignore)) return [x, y];
    for (let r = 12; r < 300; r += 12) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU, nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
        if (this.canStand(nx, ny, ignore)) return [nx, ny];
      }
    }
    return [HOUSE.x, HOUSE.y + 70];
  }
  spawnNPCs() {
    const mk = (id, x, y, reg, speed) => ({ id, x, y, reg, speed, tx: x, ty: y, wait: 1 + Math.random() * 2, dir: 0, walk: 0, moving: false, stuck: 0 });
    this.npcs = [
      mk('dango', 1150, 1150, [820, 1120, 1380, 1420], 55),
      mk('elder', 1000, 1050, [880, 930, 1250, 1090], 30),
      mk('kuri', 600, 700, [300, 320, 900, 1000], 60),
    ];
    for (const n of this.npcs) [n.x, n.y] = this.findStand(n.x, n.y, n);
    for (const n of this.npcs) { n.tx = n.x; n.ty = n.y; }
  }

  // ———————————————— 物品 ————————————————
  usedSlots() { return this.s.inv.length; }
  addItem(it) {
    const inv = this.s.inv;
    if (it.k === 'fruit') {
      const st = inv.find((x) => x.k === 'fruit' && x.id === it.id && (x.n || 1) < 10);
      if (st) { st.n = (st.n || 1) + 1; return true; }
    }
    if (inv.length >= this.s.bag) return false;
    inv.push(it.k === 'fruit' ? { k: 'fruit', id: it.id, n: 1 } : { k: it.k, id: it.id });
    return true;
  }
  itemDef(it) {
    if (it.k === 'fish') return DATA.fish[it.id] || DATA.junk[it.id];
    if (it.k === 'bug') return DATA.bug[it.id];
    if (it.k === 'fruit') return FRUITS[it.id];
    if (it.k === 'misc') return MISC[it.id];
    if (it.k === 'furn') return FURN[it.id];
    return null;
  }
  itemName(it) { const d = this.itemDef(it); return (d ? d.name : '?') + (it.n > 1 ? ` ×${it.n}` : ''); }
  sellPrice(it) {
    const d = this.itemDef(it);
    if (!d) return 0;
    if (it.k === 'furn') return Math.round((d.price || 400) * 0.25);
    return d.price * (it.n || 1);
  }
  dexKey(k, id) { return (k === 'fish' ? 'f:' : 'b:') + id; }
  dexCount() { return Object.keys(this.s.caught).length; }
  addCoins(n, x, y) {
    this.s.coins += n;
    if (n > 0) this.s.stats.earned += n;
    this.floaters.push({ text: (n >= 0 ? '+' : '') + fmt(n), t: 0, x: x ?? 140, y: y ?? 92 });
  }
  toast(str) {
    if (this.toasts.some((t) => t.text === str && t.t < 1)) return;
    this.toasts.push({ text: str, t: 0 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  get hour() { return this.s.min / 60; }
  get absMin() { return this.s.day * 1440 + this.s.min; }

  // ———————————————— 音效 ————————————————
  sSplash(v = 0.18) { this.sfx.noise(0.3, v, 'lowpass', 1400, 260); }
  sBlip() { this.sfx.chip('p25', 620 + Math.random() * 120, 0, 0.03, 0.04); }
  sSwing() { this.sfx.noise(0.14, 0.12, 'highpass', 1800, 6000); }
  sRustle() { this.sfx.noise(0.35, 0.14, 'bandpass', 2400, 900, 0, 1.2); }
  sThud() { this.sfx.tone('sine', 200, 90, 0.12, 0.2); }
  sNibble() { this.sfx.chip('triangle', 760, 520, 0.06, 0.12); }

  // ———————————————— 主循环 ————————————————
  update(dt, pad) {
    this.t += dt;
    this.modeT += dt;
    if (this.mode === 'title') return this.updateTitle(dt, pad);
    this.parts.update(dt);
    this.fx2.update(dt);
    if (this.menu !== 'inv' && this.menu !== 'dex') for (const tt of this.toasts) tt.t += dt;
    this.toasts = this.toasts.filter((tt) => tt.t < 2.6);
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < 1.2);
    this.updateMusic();
    if (this.sleepT > 0) { this.updateSleep(dt); return; }
    if (this.popup) { this.updatePopup(dt, pad); return; }
    if (this.dlg) { this.updateDialog(dt, pad); this.animNPCs(dt); return; }
    if (this.menu) { this.updateMenu(dt, pad); return; }
    this.updateField(dt, pad);
  }

  updateMusic() {
    if (this.jingle) {
      if (this.sfx.music.playing && this.sfx.music.song === this.jingle) return;
      this.jingle = null;
      this.curSong = null;
    }
    let song;
    let rate = 1;
    if (this.menu === 'shop' || this.menu === 'museum') song = SONG_INDOOR;
    else if (this.menu === 'room') { song = SONG_EVENING; rate = 0.92; }
    else {
      const h = this.hour;
      song = h >= 5 && h < 17 ? SONG_DAY : h >= 17 && h < 20 ? SONG_EVENING : SONG_NIGHT;
      if (song === SONG_DAY && this.raining) rate = 0.9;
    }
    if (song !== this.curSong || rate !== this.curRate) {
      this.curSong = song;
      this.curRate = rate;
      this.sfx.music.play(song, this, { rate });
    }
  }
  playJingle(j) {
    this.jingle = j;
    this.sfx.music.play(j, this, { loop: false });
  }

  // ———————————————— 时间 ————————————————
  tickTime(dt) {
    const s = this.s;
    s.min += dt;
    if (s.min >= 1440) { s.min -= 1440; s.day++; this.newDay(); }
    this.raining = isRaining(s.day, this.hour);
    this.secT += dt;
    if (this.secT > 1) {
      this.secT = 0;
      const now = this.absMin;
      this.A.objs.trees.forEach((t, i) => {
        if (t.kind !== 'cedar' && s.fruit[i] === 0 && s.regrow[i] && now >= s.regrow[i]) { s.fruit[i] = 3; s.regrow[i] = 0; }
      });
    }
  }
  newDay() {
    this.toast(`第 ${this.s.day} 天${rainyDay(this.s.day) ? ' · 今天会下雨' : ''}`);
    this.spawnNPCs();
  }

  // ———————————————— 野外 ————————————————
  updateField(dt, pad) {
    this.tickTime(dt);
    this.saveT += dt;
    if (this.saveT > 20) { this.saveT = 0; this.persist(); }
    const p = this.p;
    p.swollen = Math.max(0, p.swollen - dt);
    if (pad.pressed.X && !this.fish) { this.openMenu('inv'); return; }
    if (pad.pressed.Y && !this.fish) { this.openMenu('dex'); return; }
    if ((pad.pressed.L || pad.pressed.R) && !this.fish && p.swing <= 0) {
      this.s.tool = (this.s.tool + (pad.pressed.R ? 1 : 2)) % 3;
      this.sfx.play('tick');
      this.toast(['空手', '鱼竿', '捕虫网'][this.s.tool]);
    }
    if (this.fish) this.updateFishing(dt, pad);
    else this.updateWalk(dt, pad);
    this.animNPCs(dt);
    this.updateCritters(dt);
    this.updateDrops(dt);
    this.updateSwarm(dt);
    this.updateRain(dt);
    for (const [i, v] of this.shake) { const nv = v - dt; if (nv <= 0) this.shake.delete(i); else this.shake.set(i, nv); }
    this.updateCamera(dt);
  }

  updateWalk(dt, pad) {
    const p = this.p;
    if (p.swing > 0) {
      const before = p.swing;
      p.swing = Math.max(0, p.swing - dt);
      if (before > 0.2 && p.swing <= 0.2) this.netHit();
      return;
    }
    let ax = axisX(pad), ay = -axisY(pad);
    const mag = Math.min(1, Math.hypot(ax, ay));
    p.run = pad.down.B && mag > 0.2;
    if (mag > 0.15) {
      if (mag > 1) { ax /= mag; ay /= mag; }
      p.dir = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 1 : 3) : ay < 0 ? 2 : 0;
      const sp = (p.run ? 270 : 150) * Math.max(0.45, mag) * (p.swollen > 0 ? 0.85 : 1);
      const nx = p.x + ax * sp * dt, ny = p.y + ay * sp * dt;
      if (this.canStand(nx, ny)) { p.x = nx; p.y = ny; }
      else if (this.canStand(nx, p.y)) p.x = nx;
      else if (this.canStand(p.x, ny)) p.y = ny;
      p.speed = sp;
      p.moving = true;
      p.walk += dt * (p.run ? 15 : 10);
      if (p.run && Math.random() < dt * 14) this.parts.emit(p.x, p.y, 1, { color: 'rgba(200,180,140,0.6)', size: 6, speed: 30, life: 0.4, shape: 'circle' });
    } else { p.moving = false; p.speed = 0; }
    this.hint = this.contextHint();
    if (pad.pressed.A) this.actA();
  }

  front(dist = 34) {
    const [dx, dy] = DIRS[this.p.dir];
    return [this.p.x + dx * dist, this.p.y + dy * dist * 0.8 - (dy < 0 ? 8 : 0)];
  }
  nearNPC() {
    const [fx, fy] = this.front(30);
    let best = null, bd = 1e9;
    for (const n of this.npcs) {
      const dp = Math.hypot(n.x - this.p.x, (n.y - this.p.y) * 1.2), df = Math.hypot(n.x - fx, (n.y - fy) * 1.2);
      if ((df < 44 || dp < 34) && dp < bd) { bd = dp; best = n; }
    }
    return best;
  }
  nearDoor() {
    const p = this.p;
    const doors = [['shop', SHOP.door], ['museum', MUSEUM.door], ['house', this.houseDoor()]];
    for (const [id, [dx, dy]] of doors) if (Math.abs(p.x - dx) < 34 && p.y - dy > -4 && p.y - dy < 40 && p.dir === 2) return id;
    if (Math.hypot(p.x - MAILBOX.x, p.y - MAILBOX.y) < 44) return 'mailbox';
    if (Math.hypot(p.x - SIGN.x, p.y - SIGN.y) < 50) return 'sign';
    return null;
  }
  treeInFront() {
    const [fx, fy] = this.front(30);
    let best = -1, bd = 40;
    this.A.objs.trees.forEach((t, i) => { const d = Math.hypot(t.x - fx, (t.y - fy) * 1.3); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  waterTarget() {
    const [dx, dy] = DIRS[this.p.dir];
    for (let d = 46; d <= 130; d += 12) {
      const x = this.p.x + dx * d, y = this.p.y + dy * d - (dy !== 0 ? 0 : 6);
      if (isWaterType(ground(x, y)) && !this.onDeckPoint(x, y)) {
        const d2 = Math.min(130, d + 34);
        const x2 = this.p.x + dx * d2, y2 = this.p.y + dy * d2;
        return isWaterType(ground(x2, y2)) ? [x2, y2] : [x, y];
      }
    }
    return null;
  }
  onDeckPoint(x, y) { return onDeck(x, y); }
  contextHint() {
    const d = this.nearDoor();
    if (this.nearNPC() && (!d || d === 'mailbox' || d === 'sign')) return '对话';
    if (d === 'shop') return '进入小松茶铺';
    if (d === 'museum') return '进入博物馆';
    if (d === 'house') return '回家';
    if (d === 'mailbox') return '查看信箱';
    if (d === 'sign') return '看告示牌';
    const tool = this.s.tool;
    if (tool === 1 && this.waterTarget()) return '甩竿';
    if (tool === 2) return '挥网';
    if (this.treeInFront() >= 0) return '摇树';
    return '';
  }

  actA() {
    const d = this.nearDoor();
    const n = this.nearNPC();
    if (n && (!d || d === 'mailbox' || d === 'sign')) return this.talk(n);
    if (d === 'shop') {
      if (this.hour < 6) { this.say('shop', ['（门上挂着牌子：营业时间 6:00 — 24:00）']); return; }
      return this.openMenu('shop');
    }
    if (d === 'museum') return this.openMenu('museum');
    if (d === 'house') return this.openMenu('room');
    if (d === 'mailbox') {
      const s = this.s;
      this.say(null, [s.debt > 0 ? `信箱里有一封壶爷爷的信：“房子的贷款还剩 ${fmt(s.debt)} 茶币，不着急，慢慢来，呵呵。”` : s.house < 2 ? '信箱里有一封壶爷爷的信：“攒到茶币了吗？房子还能再升级哦，呵呵。”' : '信箱里有一张明信片：“茶屋真漂亮！——团子”']);
      return;
    }
    if (d === 'sign') return this.say(null, ['告示牌：「茶岛码头」——站在码头最外面，往深海里甩竿试试吧！']);
    const tool = this.s.tool;
    if (tool === 1) {
      const wt = this.waterTarget();
      if (wt) return this.cast(wt);
    }
    if (tool === 2) { this.p.swing = 0.36; this.sSwing(); return; }
    const ti = this.treeInFront();
    if (ti >= 0) return this.shakeTree(ti);
    if (tool === 1) this.toast('前面没有水，钓不了鱼');
  }

  // ———————————————— 钓鱼 ————————————————
  cast([x, y]) {
    this.fish = { phase: 'cast', t: 0, x0: this.p.x, y0: this.p.y - 30, bx: x, by: y, shadow: null, look: 0.6 + Math.random() * 0.8, idle: 0, dip: 0 };
    this.sSwing();
  }
  updateFishing(dt, pad) {
    const F = this.fish;
    F.t += dt;
    F.dip = Math.max(0, F.dip - dt);
    this.p.moving = false;
    this.hint = F.phase === 'bite' ? '收竿！' : '收线';
    if (pad.pressed.B && F.phase !== 'reel') { this.endFishing(null); return; }
    if (F.phase === 'cast') {
      if (F.t > 0.4) { F.phase = 'wait'; F.t = 0; this.sSplash(0.12); this.ripple(F.bx, F.by, 26); }
      return;
    }
    if (F.phase === 'reel') {
      if (F.t > 0.55) this.landFish(F.shadow);
      return;
    }
    const sh = F.shadow;
    if (pad.pressed.A) {
      if (F.phase === 'bite') { F.phase = 'reel'; F.t = 0; this.sSplash(0.22); this.parts.emit(F.bx, F.by, 14, { color: ['#ffffff', '#bfefff'], speed: 160, life: 0.5, gravity: 500, size: 5, shape: 'circle' }); return; }
      if (sh) { this.toast('太早了……鱼被吓跑了'); sh.state = 'flee'; sh.t = 0; }
      this.endFishing(null);
      return;
    }
    if (F.phase === 'wait') {
      F.idle += dt;
      if (F.t > F.look) {
        F.t = 0;
        F.look = 0.4 + Math.random() * 0.6;
        let best = null, bd = 175;
        for (const s of this.shadows) if (s.state === 'swim') { const d = Math.hypot(s.x - F.bx, s.y - F.by); if (d < bd) { bd = d; best = s; } }
        if (best && Math.random() < 0.75) { best.state = 'approach'; F.shadow = best; F.phase = 'approach'; }
      }
      return;
    }
    if (F.phase === 'approach') {
      const dx = F.bx - sh.x, dy = F.by - sh.y, d = Math.hypot(dx, dy);
      sh.ang = Math.atan2(dy, dx);
      if (d > 15) { const sp = 46 * dt; sh.x += (dx / d) * sp; sh.y += (dy / d) * sp; }
      else { F.phase = 'nibble'; F.t = 0; F.nibbles = 1 + Math.floor(Math.random() * (3 - this.s.rod)) + (Math.random() < 0.3 ? 1 : 0); F.next = 0.6 + Math.random() * 0.7; }
      return;
    }
    if (F.phase === 'nibble') {
      if (F.t > F.next) {
        F.t = 0;
        if (F.nibbles > 0) {
          F.nibbles--;
          F.dip = 0.18;
          this.sNibble();
          this.ripple(F.bx, F.by, 14);
          F.next = 0.55 + Math.random() * 0.9;
        } else {
          F.phase = 'bite';
          F.window = 0.5 + this.s.rod * 0.16;
          F.dip = F.window;
          this.sSplash(0.25);
          this.sfx.chip('square', 330, 160, 0.12, 0.08);
          this.ripple(F.bx, F.by, 32);
        }
      }
      return;
    }
    if (F.phase === 'bite') {
      if (F.t > F.window) { this.toast('鱼跑掉了……'); sh.state = 'flee'; sh.t = 0; this.endFishing(null); }
    }
  }
  endFishing() { this.fish = null; }
  landFish(sh) {
    this.fish = null;
    if (!sh) return;
    this.shadows = this.shadows.filter((x) => x !== sh);
    const def = sh.def;
    const junk = !!DATA.junk[def.id] && !DATA.fish[def.id];
    const it = { k: 'fish', id: def.id };
    let isNew = false;
    if (!junk) {
      const key = this.dexKey('fish', def.id);
      if (!this.s.caught[key]) { this.s.caught[key] = 1; isNew = true; this.submitScore(this.dexCount()); }
      this.s.stats.fish++;
    }
    const ok = this.addItem(it);      // 背包满了就放回水里（图鉴照样记上）
    this.playJingle(JINGLE_CATCH);
    this.popup = {
      t: 0, it, isNew,
      title: junk ? `钓到了……${def.name}` : `钓到了${def.name}！`,
      sub: def.quip + (ok ? '' : '\n（背包满了，只好放回水里）'),
      extra: junk ? '' : `${SIZE_NAME[def.size]}型 · 卖 ${fmt(def.price)} 茶币`,
    };
  }

  ripple(x, y, r) { this.ripples.push({ x, y, r, t: 0 }); }

  // ———————————————— 捕虫网 ————————————————
  netHit() {
    const [fx, fy] = this.front(40);
    const R = this.s.net ? 62 : 48;
    let best = null, bd = R;
    for (const b of this.bugs) {
      if (b.state === 'flee') continue;
      const d = Math.hypot(b.x - fx, (b.y - fy) * 1.2);
      if (d < bd && b.h < 80) { bd = d; best = b; }
    }
    if (this.swarm && this.swarm.t > 0.4 && Math.hypot(this.swarm.x - fx, this.swarm.y - fy) < R + 10) {
      this.swarm = null;
      this.catchBug({ def: DATA.bug.bee }, '眼疾手快！一网兜住了蜜蜂！');
      return;
    }
    if (best) {
      this.bugs = this.bugs.filter((b) => b !== best);
      this.catchBug(best);
      return;
    }
    for (const b of this.bugs) if (Math.hypot(b.x - this.p.x, b.y - this.p.y) < 130 && Math.random() < 0.7) this.spook(b);
  }
  catchBug(b, title) {
    const def = b.def;
    const key = this.dexKey('bug', def.id);
    let isNew = false;
    if (!this.s.caught[key]) { this.s.caught[key] = 1; isNew = true; this.submitScore(this.dexCount()); }
    this.s.stats.bug++;
    const it = { k: 'bug', id: def.id };
    const ok = this.addItem(it);
    this.playJingle(JINGLE_CATCH);
    this.popup = { t: 0, it, isNew, title: title || `抓到了${def.name}！`, sub: def.quip + (ok ? '' : '\n（背包满了，只好放走了）'), extra: `卖 ${fmt(def.price)} 茶币` };
  }
  spook(b) {
    if (b.state === 'flee') return;
    b.state = 'flee';
    b.t = 0;
    const a = Math.atan2(b.y - this.p.y, b.x - this.p.x);
    b.vx = Math.cos(a) * 160;
    b.vy = Math.sin(a) * 120;
  }

  // ———————————————— 摇树 ————————————————
  shakeTree(i) {
    const t = this.A.objs.trees[i];
    const s = this.s;
    this.shake.set(i, 0.55);
    this.sRustle();
    s.stats.shake++;
    this.parts.emit(t.x, t.y - 80, 8, { color: ['#4fae55', '#7cc96a', '#3a8f47'], speed: 90, life: 0.9, gravity: 160, size: 6 });
    for (const b of this.bugs) if (b.tree === i) this.spook(b);
    const fruitKind = t.kind === 'palm' ? 'coconut' : t.kind;
    if (t.kind !== 'cedar' && s.fruit[i] > 0) {
      const n = s.fruit[i];
      for (let k = 0; k < n; k++) {
        const a = -0.9 + k * 0.9;
        this.drops.push({ it: { k: 'fruit', id: fruitKind }, x: t.x + Math.sin(a) * 34, y: t.y + 16 + Math.cos(a) * 8, h: 70 + k * 10, vh: 0, t: 0 });
      }
      s.fruit[i] = 0;
      s.regrow[i] = this.absMin + 1440;
      return;
    }
    const r = Math.random();
    if (r < 0.1) {
      this.drops.push({ coins: 100 + Math.round(Math.random() * 30) * 10, x: t.x + 20, y: t.y + 18, h: 80, vh: 0, t: 0 });
    } else if (r < 0.17 && (!this.lastHive || this.t - this.lastHive > 60)) {
      this.lastHive = this.t;
      this.drops.push({ it: { k: 'misc', id: 'hive' }, x: t.x - 18, y: t.y + 18, h: 80, vh: 0, t: 0, hive: true });
      this.swarmAt = { x: t.x - 18, y: t.y + 18, t: 0.7 };
    }
  }
  updateDrops(dt) {
    const p = this.p;
    for (const d of this.drops) {
      d.t += dt;
      if (d.h > 0 || d.vh !== 0) {
        d.vh -= 900 * dt;
        d.h += d.vh * dt;
        if (d.h <= 0) {
          d.h = 0;
          if (d.vh < -120) { d.vh = -d.vh * 0.35; this.sThud(); } else d.vh = 0;
        }
      }
      if (d.h <= 1 && d.t > 0.5 && Math.hypot(d.x - p.x, d.y - p.y) < 26) {
        if (d.coins) { this.addCoins(d.coins); this.sfx.play('coin'); this.toast(`捡到了茶币袋：${fmt(d.coins)} 茶币`); d.gone = true; }
        else if (this.addItem(d.it)) { this.sfx.play('coin'); this.toast(`获得了 ${this.itemName({ ...d.it, n: 1 })}`); d.gone = true; }
        else { if (!d.warned) this.toast('背包满了'); d.warned = true; }
      }
    }
    this.drops = this.drops.filter((d) => !d.gone);
    if (this.swarmAt) {
      this.swarmAt.t -= dt;
      if (this.swarmAt.t <= 0) { this.swarm = { x: this.swarmAt.x, y: this.swarmAt.y - 20, t: 0 }; this.swarmAt = null; this.toast('糟糕，是蜂窝！快跑！'); }
    }
  }
  updateSwarm(dt) {
    const S = this.swarm;
    if (!S) return;
    S.t += dt;
    const p = this.p;
    const dx = p.x - S.x, dy = p.y - 24 - S.y, d = Math.hypot(dx, dy);
    const sp = 182 + Math.sin(this.t * 3) * 20;
    if (d > 1) { S.x += (dx / d) * sp * dt; S.y += (dy / d) * sp * dt; }
    if (Math.random() < dt * 5) this.sfx.tone('sawtooth', 210, 240, 0.12, 0.02);
    if (d < 20) {
      this.swarm = null;
      p.swollen = 120;
      this.sfx.play('hurt');
      this.toast('哎哟！被蜇了……');
      return;
    }
    if (S.t > 7) { this.swarm = null; this.toast('蜜蜂们飞走了……呼。'); }
  }

  // ———————————————— 虫子和鱼影的生成 ————————————————
  rollFish(type) {
    const h = this.hour, rain = this.raining;
    if (Math.random() < 0.05) return JUNK[Math.random() < 0.5 ? 0 : 1];
    const pool = [];
    let total = 0;
    for (const f of FISH) {
      const okWhere = f.where === type || (type === 'deep' && f.where === 'sea');
      if (!okWhere || !inHours(h, f.hours)) continue;
      if (f.rain === 'only' && !rain) continue;
      let w = f.w * (f.rain === 'more' && rain ? 3 : 1);
      if (this.s.rod === 2 && f.w < 2) w *= 1.7;
      if (type === 'deep' && f.where === 'deep') w *= 2;
      pool.push([f, w]);
      total += w;
    }
    let r = Math.random() * total;
    for (const [f, w] of pool) { r -= w; if (r <= 0) return f; }
    return pool.length ? pool[0][0] : JUNK[0];
  }
  updateCritters(dt) {
    const p = this.p;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.5;
      this.trySpawnShadow();
      this.trySpawnBug();
    }
    // 鱼影
    for (const s of this.shadows) {
      s.t += dt;
      if (s.state === 'swim') {
        const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
        if (d < 6 || s.t > 6) {
          s.t = 0;
          for (let k = 0; k < 6; k++) {
            const a = Math.random() * TAU, r = 30 + Math.random() * 90;
            const tx = s.x + Math.cos(a) * r, ty = s.y + Math.sin(a) * r;
            if (this.waterKind(tx, ty) === s.where) { s.tx = tx; s.ty = ty; break; }
          }
        } else {
          const want = Math.atan2(dy, dx);
          let da = want - s.ang;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          s.ang += clamp(da, -2 * dt, 2 * dt);
          const sp = 24 * dt;
          const nx = s.x + Math.cos(s.ang) * sp, ny = s.y + Math.sin(s.ang) * sp;
          if (this.waterKind(nx, ny) === s.where) { s.x = nx; s.y = ny; } else s.t = 99;
        }
      } else if (s.state === 'flee') {
        s.x += Math.cos(s.ang + Math.PI) * 130 * dt;
        s.y += Math.sin(s.ang + Math.PI) * 130 * dt;
        if (s.t > 1) s.gone = true;
      }
      if (Math.hypot(s.x - p.x, s.y - p.y) > 950) s.gone = true;
    }
    this.shadows = this.shadows.filter((s) => !s.gone);
    // 虫子
    const running = p.run && p.moving;
    const spookR = (this.s.net ? 120 : 150);
    for (const b of this.bugs) {
      b.t += dt;
      if (b.state === 'flee') {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.h += (b.def.fly || b.tree != null ? 90 : 0) * dt;
        if (b.t > 1.2) b.gone = true;
        continue;
      }
      if (b.def.fly) {
        const w = b.def.id === 'dragonfly' ? 0.9 : 1.6;
        b.x = b.ax + Math.cos(b.t * w + b.ph) * b.rad + Math.sin(b.t * 2.3 + b.ph) * 8;
        b.y = b.ay + Math.sin(b.t * w * 0.8 + b.ph) * b.rad * 0.5;
        b.h = b.h0 + Math.sin(b.t * 3 + b.ph) * 6;
      } else if (b.def.hop) {
        b.hopT -= dt;
        if (b.hopT <= 0) {
          b.hopT = 1 + Math.random() * 2.5;
          const a = Math.random() * TAU, nx = b.x + Math.cos(a) * 34, ny = b.y + Math.sin(a) * 22;
          if (walkableGround(nx, ny)) { b.hx = nx; b.hy = ny; b.hopA = 0; }
        }
        if (b.hx != null) {
          b.hopA = Math.min(1, b.hopA + dt * 3);
          b.x = lerp(b.x, b.hx, b.hopA);
          b.y = lerp(b.y, b.hy, b.hopA);
          b.h = Math.sin(b.hopA * Math.PI) * (b.def.id === 'cricket' ? 18 : 3);
          if (b.hopA >= 1) b.hx = null;
        }
      }
      const d = Math.hypot(b.x - p.x, (b.y - p.y) * 1.2);
      if (running && d < spookR) this.spook(b);
      else if (b.def.shy && p.moving && p.speed > 110 && d < (this.s.net ? 42 : 56)) this.spook(b);
      if (d > 950) b.gone = true;
      if (!this.bugOk(b.def)) b.leaveT = (b.leaveT || 0) + dt;
      if (b.leaveT > 3) this.spook(b);
    }
    this.bugs = this.bugs.filter((b) => !b.gone);
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < 1);
  }
  waterKind(x, y) {
    const g = ground(x, y);
    if (!isWaterType(g)) return null;
    if (this.onDeckPoint(x, y)) return null;
    return g === 'deep' || g === 'sea' ? 'sea' : g;
  }
  trySpawnShadow() {
    if (this.shadows.length >= 7) return;
    const p = this.p;
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * TAU, r = 140 + Math.random() * 520;
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r * 0.75;
      const g = ground(x, y);
      if (!isWaterType(g) || this.onDeckPoint(x, y)) continue;
      const where = g === 'deep' || g === 'sea' ? 'sea' : g;
      const near = (q) => this.waterKind(x + q[0], y + q[1]) === where;
      if (![[20, 0], [-20, 0], [0, 16], [0, -16]].every(near)) continue;
      if (this.shadows.some((s) => Math.hypot(s.x - x, s.y - y) < 60)) continue;
      const def = this.rollFish(g);
      const size = def.size ? SIZE_PX[def.size] : 16;
      this.shadows.push({ x, y, tx: x, ty: y, ang: Math.random() * TAU, def, size, where, state: 'swim', t: 99, fade: 0 });
      return;
    }
  }
  bugOk(def) {
    const h = this.hour, rain = this.raining;
    if (!inHours(h, def.hours)) return false;
    if (def.rain === 'only' && !rain) return false;
    if (def.rain === 'no' && rain) return false;
    return true;
  }
  trySpawnBug() {
    if (this.bugs.length >= 7) return;
    const pool = BUGS.filter((b) => this.bugOk(b));
    if (!pool.length) return;
    let total = 0;
    for (const b of pool) total += b.w;
    let r = Math.random() * total, def = pool[0];
    for (const b of pool) { r -= b.w; if (r <= 0) { def = b; break; } }
    const p = this.p;
    const inRange = (x, y) => { const d = Math.hypot(x - p.x, y - p.y); return d > 230 && d < 700; };
    const pick = (list) => { const c = list.filter((o) => inRange(o.x, o.y)); return c.length ? c[(Math.random() * c.length) | 0] : null; };
    const O = this.A.objs;
    let b = null;
    const base = { def, state: 'idle', t: 0, ph: Math.random() * 6, h: 0 };
    if (def.where === 'fly' || def.where === 'flower') {
      const f = pick(O.flowers);
      if (!f) return;
      if (def.fly) b = { ...base, x: f.x, y: f.y, ax: f.x, ay: f.y, rad: 26 + Math.random() * 30, h0: 26 + Math.random() * 16 };
      else b = { ...base, x: f.x, y: f.y + 1, h: 16 };
    } else if (def.where === 'tree') {
      const cand = O.trees.map((t, i) => ({ ...t, i })).filter((t) => t.kind !== 'palm' && (def.id === 'cicada' || t.kind === 'cedar'));
      const t = pick(cand);
      if (!t || this.bugs.some((x) => x.tree === t.i)) return;
      b = { ...base, x: t.x + (Math.random() < 0.5 ? -4 : 4), y: t.y + 2, h: 30 + Math.random() * 12, tree: t.i };
    } else if (def.where === 'lamp') {
      const L = pick(LAMPS.map(([x, y]) => ({ x, y })));
      if (!L) return;
      b = { ...base, x: L.x, y: L.y + 2, ax: L.x, ay: L.y + 2, rad: 22, h0: 66 };
    } else if (def.where === 'rock') {
      const t = pick([...O.rocks, ...O.flowers.filter((_, i) => i % 3 === 0)]);
      if (!t) return;
      b = { ...base, x: t.x + 14, y: t.y + 4, h: 0 };
    } else {
      for (let k = 0; k < 10 && !b; k++) {
        const a = Math.random() * TAU, rr = 240 + Math.random() * 420;
        const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr * 0.75;
        const g = ground(x, y);
        if (def.where === 'grass' && g === 'grass' && walkableGround(x, y) && !this.blocked(x, y)) b = { ...base, x, y, hopT: 1 };
        if (def.where === 'beach' && g === 'sand' && walkableGround(x, y) && !this.blocked(x, y)) b = { ...base, x, y, hopT: 1 };
        if (def.where === 'water') {
          const wd = Math.min(riverD(x, y), pondD(x, y));
          if (wd > -30 && wd < 30 && islandR(x, y) < 0.95) b = { ...base, x, y, ax: x, ay: y, rad: 30 + Math.random() * 40, h0: 24 + Math.random() * 14 };
        }
      }
    }
    if (b) this.bugs.push(b);
  }

  // ———————————————— 岛民 ————————————————
  animNPCs(dt) {
    for (const n of this.npcs) {
      if (this.dlg && this.dlg.npc === n) {
        n.moving = false;
        const dx = this.p.x - n.x, dy = this.p.y - n.y;
        n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 3) : dy < 0 ? 2 : 0;
        continue;
      }
      if (this.dlg || this.mode !== 'play') { n.moving = false; continue; }
      if (n.wait > 0) { n.wait -= dt; n.moving = false; continue; }
      const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
      if (d < 4) {
        n.wait = 2 + Math.random() * 4;
        const [x0, y0, x1, y1] = n.reg;
        for (let k = 0; k < 8; k++) {
          const tx = x0 + Math.random() * (x1 - x0), ty = y0 + Math.random() * (y1 - y0);
          if (this.canStand(tx, ty, n)) { n.tx = tx; n.ty = ty; break; }
        }
        continue;
      }
      const sp = n.speed * dt;
      const nx = n.x + (dx / d) * sp, ny = n.y + (dy / d) * sp;
      const nearPlayer = Math.hypot(nx - this.p.x, ny - this.p.y) < 26;
      if (!nearPlayer && this.canStand(nx, ny, n)) { n.x = nx; n.y = ny; n.moving = true; n.walk += dt * 9; n.stuck = 0; }
      else { n.stuck += dt; n.moving = false; if (n.stuck > 1.2) { n.tx = n.x; n.ty = n.y; n.stuck = 0; } }
      n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 3) : dy < 0 ? 2 : 0;
    }
  }
  chatCtx() { return { hour: this.hour, rain: this.raining, house: this.s.house, dex: this.dexCount(), debt: this.s.debt }; }
  chatLine(id) {
    const opts = CHAT[id].map((f) => f(this.chatCtx())).filter(Boolean);
    return opts[(Math.random() * opts.length) | 0];
  }
  questFor(id) {
    const q = this.s.quests[id];
    if (q && q.active) return q;
    return null;
  }
  newQuest(id) {
    const h = this.hour;
    if (id === 'dango') {
      if (Math.random() < 0.5) {
        const kinds = ['orange', 'peach', 'apple', 'coconut'];
        const fid = kinds[(Math.random() * kinds.length) | 0];
        return { type: 'fruit', id: fid, n: 2 + ((Math.random() * 2) | 0) };
      }
      const pool = FISH.filter((f) => f.w >= 3 && f.where !== 'deep' && inHours(h, f.hours) && !f.rain);
      const f = pool[(Math.random() * pool.length) | 0];
      return { type: 'fish', id: f.id, n: 1 };
    }
    const pool = BUGS.filter((b) => b.w >= 4 && this.bugOk(b));
    const b = pool.length ? pool[(Math.random() * pool.length) | 0] : DATA.bug.white;
    return { type: 'bug', id: b.id, n: 1 };
  }
  questName(q) {
    if (q.type === 'fruit') return `${FRUITS[q.id].name} ×${q.n}`;
    if (q.type === 'fish') return DATA.fish[q.id].name;
    return DATA.bug[q.id].name;
  }
  questHave(q) {
    const inv = this.s.inv;
    if (q.type === 'fruit') return inv.filter((x) => x.k === 'fruit' && x.id === q.id).reduce((a, x) => a + (x.n || 1), 0) >= q.n;
    return inv.some((x) => x.k === (q.type === 'fish' ? 'fish' : 'bug') && x.id === q.id);
  }
  questTake(q) {
    const inv = this.s.inv;
    if (q.type === 'fruit') {
      let left = q.n;
      for (let i = inv.length - 1; i >= 0 && left > 0; i--) {
        const x = inv[i];
        if (x.k !== 'fruit' || x.id !== q.id) continue;
        const take = Math.min(left, x.n || 1);
        x.n = (x.n || 1) - take;
        left -= take;
        if (x.n <= 0) inv.splice(i, 1);
      }
      return;
    }
    const k = q.type === 'fish' ? 'fish' : 'bug';
    const i = inv.findIndex((x) => x.k === k && x.id === q.id);
    if (i >= 0) inv.splice(i, 1);
  }
  questReward(q) {
    const base = q.type === 'fruit' ? FRUITS[q.id].price * q.n : (q.type === 'fish' ? DATA.fish[q.id] : DATA.bug[q.id]).price;
    return Math.round((base * 1.6 + 200) / 10) * 10;
  }
  hasBubble(n) {
    if (n.id === 'elder') return this.s.house < 2 && this.s.debt === 0;
    const q = this.s.quests[n.id];
    if (q && q.active) return this.questHave(q);
    return !q || q.day !== this.s.day;
  }

  talk(n) {
    const id = n.id;
    const s = this.s;
    this.sfx.play('confirm');
    if (id === 'elder') {
      if (s.debt > 0) {
        const choices = [];
        if (s.coins >= s.debt) choices.push({ label: `全部还清（${fmt(s.debt)}）`, fn: () => this.payDebt(s.debt) });
        const part = Math.min(1000, s.debt);
        if (s.coins >= part && part < s.debt) choices.push({ label: `还 ${fmt(part)} 茶币`, fn: () => this.payDebt(part) });
        choices.push({ label: '下次吧', fn: () => this.say('elder', ['不着急，不着急，呵呵。']) });
        this.say('elder', [{ t: `${HOUSES[s.house].name}住得还习惯吗？贷款还剩 ${fmt(s.debt)} 茶币，要还一点吗？`, choices }], null, n);
        return;
      }
      if (s.house < 2) {
        const next = HOUSES[s.house + 1];
        this.say('elder', [
          this.chatLine('elder'),
          { t: `对了，想把房子升级成「${next.name}」吗？贷款 ${fmt(next.loan)} 茶币，盖好以后慢慢还就行。`, choices: [
            { label: '拜托了！', fn: () => this.upgradeHouse() },
            { label: '再想想', fn: () => this.say('elder', ['想好了随时来找我，呵呵。']) },
          ] },
        ], null, n);
        return;
      }
      this.say('elder', [this.chatLine('elder')], null, n);
      return;
    }
    const q = this.s.quests[id];
    const nm = NPCS[id].name;
    if (q && q.active) {
      if (this.questHave(q)) {
        this.say(id, [{ t: id === 'dango' ? `哇！是${this.questName(q)}喵！可以给我吗？` : `是${this.questName(q)}！可以给我吗？我想把它画下来！`, choices: [
          { label: '给你！', fn: () => this.finishQuest(id, q) },
          { label: '再等等', fn: () => this.say(id, ['好吧……我会等你的！']) },
        ] }], null, n);
      } else {
        this.say(id, [id === 'dango' ? `还记得吗？我想要${this.questName(q)}喵～` : `${this.questName(q)}找到了吗？不着急哦！`], null, n);
      }
      return;
    }
    if (!q || q.day !== s.day) {
      const nq = this.newQuest(id);
      const ask = id === 'dango'
        ? (nq.type === 'fruit' ? `那个……我突然好想吃${this.questName(nq)}喵，你能帮我摘吗？` : `我想看看${this.questName(nq)}长什么样喵！帮我钓一条好不好？`)
        : `${nm}有个请求！帮我抓一只${this.questName(nq)}好不好？我的虫子图册还差这一页！`;
      this.say(id, [this.chatLine(id), { t: ask, choices: [
        { label: '交给我吧！', fn: () => { s.quests[id] = { ...nq, active: true, day: s.day }; this.say(id, [id === 'dango' ? '太好了喵！我等你哦～' : '耶！谢谢你！']); this.toast(`任务：${this.questName(nq)} → ${nm}`); } },
        { label: '下次吧', fn: () => { s.quests[id] = { day: s.day, active: false }; this.say(id, ['那好吧，下次再说～']); } },
      ] }], null, n);
      return;
    }
    this.say(id, [this.chatLine(id)], null, n);
  }
  finishQuest(id, q) {
    const s = this.s;
    this.questTake(q);
    const reward = this.questReward(q);
    this.addCoins(reward);
    this.sfx.play('coin');
    s.quests[id] = { day: s.day, active: false };
    s.questsDone[id] = (s.questsDone[id] || 0) + 1;
    const lines = [id === 'dango' ? `谢谢你喵！这是 ${fmt(reward)} 茶币，收下吧～` : `太感谢了！这是谢礼：${fmt(reward)} 茶币！`];
    const gift = id === 'dango' ? 'cattower' : 'specimen';
    if (!s.gifts[gift]) {
      lines.push(id === 'dango' ? '还有这个！我用不着的猫爬架……其实是我最喜欢的，送给你喵。' : '还有这个！我自己做的昆虫标本框，送给你！');
      this.say(id, lines, () => this.giveGift(gift));
    } else this.say(id, lines);
  }
  giveGift(id) {
    this.s.gifts[id] = 1;
    const it = { k: 'furn', id };
    const ok = this.addItem(it);
    if (!ok) this.placeAnywhere(id);
    this.popup = { t: 0, it, isNew: false, title: `获得了${FURN[id].name}！`, sub: ok ? '放在家里试试吧（回家后按 A 摆放）。' : '背包满了，已经直接摆进家里。', extra: '' };
    this.sfx.play('powerup');
  }
  placeAnywhere(id) {
    const [gw, gh] = HOUSES[this.s.house].grid;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (!this.s.room.f1.some((f) => f.x === x && f.y === y)) { this.s.room.f1.push({ id, x, y }); return; }
  }
  upgradeHouse() {
    const s = this.s;
    s.house++;
    s.debt = HOUSES[s.house].loan;
    this.buildSolids();
    if (!this.canStand(this.p.x, this.p.y)) this.p.y = HOUSE.y + 60;
    this.playJingle(JINGLE_HOUSE);
    for (let k = 0; k < 4; k++) this.parts.emit(HOUSE.x + (k - 1.5) * 50, HOUSE.y - 30, 10, { color: ['#ffffff', '#e8e0d0'], speed: 120, life: 0.9, size: 10, shape: 'circle', drag: 2 });
    this.popup = { t: 0, house: s.house, title: `房子升级成了${HOUSES[s.house].name}！`, sub: `房间变成 ${HOUSES[s.house].grid.join(' × ')} 格${HOUSES[s.house].upstairs ? '，还多了一个二楼' : ''}。\n贷款 ${fmt(s.debt)} 茶币，找壶爷爷慢慢还就好。`, extra: '' };
    this.persist();
  }
  payDebt(n) {
    const s = this.s;
    n = Math.min(n, s.debt, s.coins);
    s.coins -= n;
    s.debt -= n;
    this.floaters.push({ text: '-' + fmt(n), t: 0, x: 140, y: 92 });
    this.sfx.play('coin');
    if (s.debt > 0) { this.say('elder', [`收到 ${fmt(n)} 茶币，还剩 ${fmt(s.debt)}。慢慢来，呵呵。`]); this.persist(); return; }
    if (s.house === 1) {
      this.say('elder', ['贷款全部还清了！了不起，了不起。', '这个小茶炉送给你，冬天泡茶用，呵呵。'], () => this.giveGift('stove'));
    } else {
      s.done = true;
      this.say('elder', ['两层茶屋的贷款也还清了……你已经是真正的茶岛岛民了，呵呵。'], () => {
        this.playJingle(JINGLE_HOUSE);
        this.popup = { t: 0, house: 2, title: '茶屋是你的了！', sub: '恭喜！你在茶岛上有了真正属于自己的家。\n接下来，试着把图鉴全部填满吧！', extra: `图鉴 ${this.dexCount()} / ${DEX_TOTAL}`, party: true };
      });
    }
    this.persist();
  }

  // ———————————————— 对话 ————————————————
  say(who, lines, onEnd = null, npc = null) {
    this.dlg = { who, npc, lines, i: 0, shown: 0, sel: 0, onEnd, wrapped: null };
    this.nav.reset();
  }
  updateDialog(dt, pad) {
    const d = this.dlg;
    const line = d.lines[d.i];
    const str = typeof line === 'string' ? line : line.t;
    const speed = d.who === 'curator' ? 14 : 42;
    const before = Math.floor(d.shown);
    d.shown = Math.min(str.length, d.shown + dt * speed);
    if (d.who && Math.floor(d.shown) !== before && Math.floor(d.shown) % 2 === 0 && d.shown < str.length) this.sBlip();
    const done = d.shown >= str.length;
    if (done && line.choices) {
      const nv = this.nav.update(dt, pad);
      if (nv === 'up') { d.sel = (d.sel + line.choices.length - 1) % line.choices.length; this.sfx.play('tick'); }
      if (nv === 'down') { d.sel = (d.sel + 1) % line.choices.length; this.sfx.play('tick'); }
      if (pad.pressed.A) {
        const ch = line.choices[d.sel];
        this.dlg = null;
        this.sfx.play('confirm');
        ch.fn();
        return;
      }
      if (pad.pressed.B) {
        const ch = line.choices[line.choices.length - 1];
        this.dlg = null;
        this.sfx.play('back');
        ch.fn();
      }
      return;
    }
    if (pad.pressed.A || pad.pressed.B) {
      if (!done) { d.shown = str.length; return; }
      d.i++;
      d.shown = 0;
      d.sel = 0;
      d.wrapped = null;
      this.nav.reset();
      if (d.i >= d.lines.length) {
        this.dlg = null;
        if (d.onEnd) d.onEnd();
      }
    }
  }

  updatePopup(dt, pad) {
    const P = this.popup;
    P.t += dt;
    if (P.party && Math.random() < dt * 20) this.fx2.emit(W / 2 + (Math.random() - 0.5) * 700, 90, 2, { color: ['#ff8a1c', '#ffd23f', '#4fae55', '#4f8fd0', '#ff6a8a'], speed: 140, life: 1.6, gravity: 260, size: 8 });
    if (P.t > 0.45 && (pad.pressed.A || pad.pressed.B)) {
      this.popup = null;
      this.sfx.play('confirm');
      this.persist();
    }
  }

  updateSleep(dt) {
    this.sleepT += dt;
    if (this.sleepT > 1.2 && !this.slept) {
      this.slept = true;
      if (this.s.min >= 7 * 60) this.s.day++;     // 半夜睡下的话，醒来还是同一天的早上
      this.s.min = 7 * 60;
      this.raining = isRaining(this.s.day, 7);
      this.newDay();
      this.persist();
    }
    if (this.sleepT > 2.6) { this.sleepT = 0; this.slept = false; this.toast('早上好！新的一天开始了'); }
  }

  // ———————————————— 菜单 ————————————————
  openMenu(m) {
    this.menu = m;
    this.msel = 0;
    this.mtab = 0;
    this.mscroll = 0;
    this.mT = 0;
    this.sub = null;
    this.nav.reset();
    this.sfx.play(m === 'inv' || m === 'dex' ? 'confirm' : 'launch');
    if (m === 'shop') this.shopLine = this.hour >= 20 ? '这么晚还来呀，欢迎欢迎！要卖点什么吗？' : '欢迎光临小松茶铺！要卖东西，还是买东西？';
    if (m === 'museum') {
      this.museumView = 'menu';
      this.say('curator', ['欢……迎……来到……岛屿……博物馆……']);
    }
    if (m === 'room') { this.room = { cx: 0, cy: 0, floor: 1, pick: null }; }
  }
  closeMenu() {
    if (this.menu === 'shop' || this.menu === 'museum' || this.menu === 'room') {
      const door = this.menu === 'shop' ? SHOP.door : this.menu === 'museum' ? MUSEUM.door : this.houseDoor();
      this.p.x = door[0];
      this.p.y = door[1] + 28;
      this.p.dir = 0;
      this.swarm = null;
    }
    this.menu = null;
    this.sfx.play('back');
    this.persist();
  }
  updateMenu(dt, pad) {
    this.mT += dt;
    const m = this.menu;
    if (m === 'inv') return this.updateInv(dt, pad);
    if (m === 'dex') return this.updateDex(dt, pad);
    if (m === 'shop') return this.updateShop(dt, pad);
    if (m === 'museum') return this.updateMuseum(dt, pad);
    if (m === 'room') return this.updateRoom(dt, pad);
  }
  gridNav(dt, pad, cols, n) {
    const d = this.nav.update(dt, pad);
    if (!d || n <= 0) return;
    let i = this.msel;
    if (d === 'left') i = Math.max(0, i - 1);
    if (d === 'right') i = Math.min(n - 1, i + 1);
    if (d === 'up') i = i - cols >= 0 ? i - cols : i;
    if (d === 'down') i = i + cols < n ? i + cols : i;
    if (i !== this.msel) { this.msel = i; this.sfx.play('tick'); }
  }
  listNav(dt, pad, n) {
    const d = this.nav.update(dt, pad);
    if (!n) return;
    if (d === 'up') { this.msel = (this.msel + n - 1) % n; this.sfx.play('tick'); }
    if (d === 'down') { this.msel = (this.msel + 1) % n; this.sfx.play('tick'); }
  }

  // 背包
  updateInv(dt, pad) {
    const inv = this.s.inv;
    if (this.sub) {
      const opts = this.sub.opts;
      this.listNavSub(dt, pad, opts.length);
      if (pad.pressed.A) { const o = opts[this.sub.sel]; this.sub = null; o.fn(); this.sfx.play('confirm'); }
      else if (pad.pressed.B) { this.sub = null; this.sfx.play('back'); }
      return;
    }
    if (pad.pressed.B || pad.pressed.X) { this.closeMenu(); return; }
    this.gridNav(dt, pad, 6, this.s.bag);
    if (pad.pressed.A && inv[this.msel]) {
      const it = inv[this.msel];
      const i = this.msel;
      const opts = [];
      if (it.k === 'fish' || it.k === 'bug') opts.push({ label: '放生', fn: () => { inv.splice(i, 1); this.toast(`${this.itemName(it)}回到了大自然`); } });
      if (it.k === 'fruit') opts.push({ label: '吃掉一个', fn: () => { it.n = (it.n || 1) - 1; if (it.n <= 0) inv.splice(i, 1); this.toast('好吃！'); this.parts.emit(this.p.x, this.p.y - 50, 6, { color: '#ff6a8a', speed: 60, life: 0.8, size: 6, shape: 'circle' }); } });
      if (it.k === 'furn') opts.push({ label: '回家才能摆放', fn: () => {} });
      if (it.k !== 'furn') opts.push({ label: '丢掉', fn: () => { inv.splice(i, 1); } });
      opts.push({ label: '取消', fn: () => {} });
      this.sub = { opts, sel: 0 };
      this.nav.reset();
    }
  }
  listNavSub(dt, pad, n) {
    const d = this.nav.update(dt, pad);
    if (d === 'up') { this.sub.sel = (this.sub.sel + n - 1) % n; this.sfx.play('tick'); }
    if (d === 'down') { this.sub.sel = (this.sub.sel + 1) % n; this.sfx.play('tick'); }
  }

  // 图鉴
  updateDex(dt, pad) {
    if (pad.pressed.B || pad.pressed.Y) { this.closeMenu(); return; }
    if (pad.pressed.L || pad.pressed.R || pad.pressed.ZL || pad.pressed.ZR) { this.mtab = 1 - this.mtab; this.msel = 0; this.sfx.play('tick'); }
    this.gridNav(dt, pad, 6, this.mtab ? BUGS.length : FISH.length);
  }

  // 商店
  shopList() {
    if (this.mtab === 0) return this.s.inv.map((it, i) => ({ it, i, price: this.sellPrice(it) }));
    const s = this.s;
    const ups = UPGRADES.filter((u) => u.need(s)).map((u) => ({ up: u, price: u.price }));
    const furn = FURNITURE.filter((f) => f.shop).map((f) => ({ furn: f, price: f.price }));
    return [...ups, ...furn];
  }
  updateShop(dt, pad) {
    if (pad.pressed.B) { this.closeMenu(); return; }
    if (pad.pressed.L || pad.pressed.R || pad.pressed.ZL || pad.pressed.ZR) { this.mtab = 1 - this.mtab; this.msel = 0; this.mscroll = 0; this.sfx.play('tick'); }
    const list = this.shopList();
    this.listNav(dt, pad, list.length);
    this.msel = clamp(this.msel, 0, Math.max(0, list.length - 1));
    const s = this.s;
    if (this.mtab === 0 && pad.pressed.Y) {
      let sum = 0, n = 0;
      s.inv = s.inv.filter((it) => { if (it.k === 'furn') return true; sum += this.sellPrice(it); n++; return false; });
      if (n) { this.addCoins(sum, 1120, 150); this.sfx.play('coin'); this.shopLine = `全部收下啦！一共 ${fmt(sum)} 茶币，谢谢惠顾！`; this.persist(); }
      else this.shopLine = '背包里好像没有能卖的东西哦。';
      return;
    }
    if (!pad.pressed.A || !list.length) return;
    const e = list[this.msel];
    if (this.mtab === 0) {
      s.inv.splice(e.i, 1);
      this.addCoins(e.price, 1120, 150);
      this.sfx.play('coin');
      const d = this.itemDef(e.it);
      this.shopLine = e.price >= 1500 ? `哇！${d.name}！这个可值钱了，${fmt(e.price)} 茶币！` : `${d.name}，${fmt(e.price)} 茶币收下了！`;
      this.persist();
      return;
    }
    if (s.coins < e.price) { this.sfx.play('deny'); this.shopLine = '茶币好像不太够呢……再去钓钓鱼吧！'; return; }
    if (e.up) {
      s.coins -= e.price;
      e.up.apply(s);
      this.sfx.play('powerup');
      this.shopLine = `${e.up.name}，好好用哦！`;
      this.floaters.push({ text: '-' + fmt(e.price), t: 0, x: 1120, y: 150 });
    } else {
      if (!this.addItem({ k: 'furn', id: e.furn.id })) { this.sfx.play('deny'); this.shopLine = '背包满了，先腾点地方吧！'; return; }
      s.coins -= e.price;
      this.sfx.play('coin');
      this.shopLine = `${e.furn.name}，已经放进背包了！回家按 A 就能摆。`;
      this.floaters.push({ text: '-' + fmt(e.price), t: 0, x: 1120, y: 150 });
    }
    this.persist();
  }

  // 博物馆
  donatable() {
    return this.s.inv.map((it, i) => ({ it, i })).filter(({ it }) => (it.k === 'fish' && DATA.fish[it.id]) || it.k === 'bug')
      .filter(({ it }) => !this.s.donated[this.dexKey(it.k, it.id)])
      .filter((e, idx, arr) => arr.findIndex((x) => x.it.k === e.it.k && x.it.id === e.it.id) === idx);
  }
  updateMuseum(dt, pad) {
    const v = this.museumView;
    if (v === 'menu') {
      if (pad.pressed.B) { this.closeMenu(); return; }
      this.listNav(dt, pad, 3);
      if (pad.pressed.A) {
        this.sfx.play('confirm');
        if (this.msel === 0) {
          if (!this.donatable().length) this.say('curator', ['背包里……没有……新的……展品……呢……']);
          else { this.museumView = 'donate'; this.msel = 0; }
        } else if (this.msel === 1) { this.museumView = 'gallery'; this.mtab = 0; }
        else this.closeMenu();
      }
      return;
    }
    if (v === 'gallery') {
      if (pad.pressed.B || pad.pressed.A) { this.museumView = 'menu'; this.msel = 1; this.sfx.play('back'); }
      if (pad.pressed.L || pad.pressed.R) { this.mtab = 1 - this.mtab; this.sfx.play('tick'); }
      return;
    }
    const list = this.donatable();
    if (pad.pressed.B || !list.length) { this.museumView = 'menu'; this.msel = 0; this.sfx.play('back'); return; }
    this.listNav(dt, pad, list.length);
    this.msel = clamp(this.msel, 0, list.length - 1);
    if (pad.pressed.A) {
      const { it, i } = list[this.msel];
      const s = this.s;
      s.inv.splice(i, 1);
      s.donated[this.dexKey(it.k, it.id)] = 1;
      s.donations++;
      const d = this.itemDef(it);
      const reward = Math.round(d.price * 0.2 / 10) * 10 + 50;
      this.addCoins(reward, 640, 140);
      this.sfx.play('checkpoint');
      const lines = [`哦……是${d.name}……谢……谢……你……这是……${fmt(reward)}……茶币……谢礼……`];
      if (s.donations === 5 && !s.gifts.globe) this.say('curator', [...lines, '你……已经……捐了……五件……展品……了……这个……地球仪……送给……你……'], () => this.giveGift('globe'));
      else if (s.donations === 15 && !s.gifts.bonus15) { s.gifts.bonus15 = 1; this.say('curator', [...lines, '十五……件……了……博物馆……热闹……多了……再送你……3,000……茶币……'], () => this.addCoins(3000, 640, 140)); }
      else if (s.donations === DEX_TOTAL) this.say('curator', [...lines, '全部……展品……都……齐了……你是……茶岛……最棒的……博物学家……']);
      else this.say('curator', lines);
      this.msel = 0;
      this.persist();
    }
  }

  // 自己的家
  roomGrid() {
    const h = HOUSES[this.s.house];
    return this.room.floor === 2 && h.upstairs ? h.upstairs : h.grid;
  }
  roomList() { return this.room.floor === 2 ? this.s.room.f2 : this.s.room.f1; }
  updateRoom(dt, pad) {
    const R = this.room;
    const [gw, gh] = this.roomGrid();
    const list = this.roomList();
    if (R.pick) {
      const furn = this.s.inv.map((it, i) => ({ it, i })).filter(({ it }) => it.k === 'furn');
      if (pad.pressed.B || !furn.length) { R.pick = null; this.sfx.play('back'); return; }
      const d = this.nav.update(dt, pad);
      if (d === 'left' || d === 'up') { R.pick.sel = (R.pick.sel + furn.length - 1) % furn.length; this.sfx.play('tick'); }
      if (d === 'right' || d === 'down') { R.pick.sel = (R.pick.sel + 1) % furn.length; this.sfx.play('tick'); }
      R.pick.sel = clamp(R.pick.sel, 0, furn.length - 1);
      if (pad.pressed.A) {
        const { it, i } = furn[R.pick.sel];
        this.s.inv.splice(i, 1);
        list.push({ id: it.id, x: R.cx, y: R.cy });
        R.pick = null;
        this.sfx.play('stomp');
        this.persist();
      }
      return;
    }
    if (pad.pressed.B) { this.closeMenu(); return; }
    if ((pad.pressed.L || pad.pressed.R) && HOUSES[this.s.house].upstairs) {
      R.floor = R.floor === 1 ? 2 : 1;
      R.cx = 0; R.cy = 0;
      this.sfx.play('slide');
      return;
    }
    const d = this.nav.update(dt, pad);
    if (d === 'left') R.cx = Math.max(0, R.cx - 1);
    if (d === 'right') R.cx = Math.min(gw - 1, R.cx + 1);
    if (d === 'up') R.cy = Math.max(0, R.cy - 1);
    if (d === 'down') R.cy = Math.min(gh - 1, R.cy + 1);
    if (d) this.sfx.play('tick');
    if (pad.pressed.Y) {
      this.say('player', [{ t: '要睡觉吗？会一直睡到明天早上 7 点。', choices: [
        { label: '睡觉', fn: () => { this.sleepT = 0.001; this.slept = false; this.sfx.play('sleep'); } },
        { label: '还不困', fn: () => {} },
      ] }]);
      return;
    }
    if (pad.pressed.A) {
      const at = list.findIndex((f) => f.x === R.cx && f.y === R.cy);
      if (at >= 0) {
        const f = list[at];
        if (this.addItem({ k: 'furn', id: f.id })) { list.splice(at, 1); this.sfx.play('back'); this.toast(`收起了${FURN[f.id].name}`); this.persist(); }
        else this.toast('背包满了，收不起来');
        return;
      }
      if (this.s.inv.some((it) => it.k === 'furn')) { R.pick = { sel: 0 }; this.nav.reset(); this.sfx.play('confirm'); }
      else this.toast('背包里没有家具。去小松茶铺看看吧！');
    }
  }

  // ———————————————— 标题页 ————————————————
  updateTitle(dt, pad) {
    if (this.confirmNew) {
      const d = this.nav.update(dt, pad);
      if (d === 'left' || d === 'right' || d === 'up' || d === 'down') { this.confirmSel = 1 - this.confirmSel; this.sfx.play('tick'); }
      if (pad.pressed.A) {
        this.confirmNew = false;
        if (this.confirmSel === 0) { this.sfx.play('confirm'); this.start(true); } else this.sfx.play('back');
      } else if (pad.pressed.B) { this.confirmNew = false; this.sfx.play('back'); }
      return;
    }
    const n = this.s ? 2 : 1;
    const d = this.nav.update(dt, pad);
    if (d === 'up' || d === 'down') { this.titleSel = (this.titleSel + 1) % n; this.sfx.play('tick'); }
    if (pad.pressed.A && this.modeT > 0.3) {
      if (this.s && this.titleSel === 0) { this.sfx.play('confirm'); this.start(false); }
      else if (this.s) { this.confirmNew = true; this.confirmSel = 1; this.nav.reset(); this.sfx.play('confirm'); }
      else { this.sfx.play('confirm'); this.start(true); }
    }
  }

  // 触摸屏：点一下 = 按 A（只用于翻对话、关弹窗）
  tap() {
    if (this.mode !== 'play') return false;
    if (this.popup) { if (this.popup.t > 0.45) { this.popup = null; this.persist(); } return true; }
    const d = this.dlg;
    if (d && !d.lines[d.i].choices) { this.updateDialog(0, { pressed: { A: true }, down: {}, lx: 0, ly: 0 }); return true; }
    return false;
  }

  // ———————————————— 相机 ————————————————
  snapCamera() {
    this.camX = clamp(this.p.x - W / 2, 0, WORLD_W - W);
    this.camY = clamp(this.p.y - 30 - H / 2, 0, WORLD_H - H);
  }
  updateCamera(dt) {
    let tx = this.p.x - W / 2, ty = this.p.y - 30 - H / 2;
    if (this.fish) { tx = (this.p.x + this.fish.bx) / 2 - W / 2; ty = (this.p.y + this.fish.by) / 2 - H / 2; }
    tx = clamp(tx, 0, WORLD_W - W);
    ty = clamp(ty, 0, WORLD_H - H);
    const k = 1 - Math.exp(-dt * 6);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
  }

  updateRain(dt) {
    if (!this.raining) return;
    for (const r of this.rain) {
      r.y += 950 * dt;
      r.x -= 170 * dt;
      if (r.y > H) { r.y -= H + 20; r.x = Math.random() * (W + 200); }
      if (r.x < -20) r.x += W + 40;
    }
    if (Math.random() < dt * 4) this.sfx.noise(0.4, 0.012, 'highpass', 3000);
  }

  // ———————————————— 绘制 ————————————————
  draw(c) {
    setRes(this.os.scale || 1);
    if (this.mode === 'title') return this.drawTitle(c);
    if (this.menu === 'room') this.drawRoom(c);
    else if (this.menu === 'shop') this.drawShop(c);
    else if (this.menu === 'museum') this.drawMuseum(c);
    else {
      this.drawWorld(c, this.camX, this.camY);
      this.parts.draw(c, this.camX, this.camY);
      this.drawHUD(c);
      if (this.menu === 'inv') this.drawInv(c);
      if (this.menu === 'dex') this.drawDex(c);
    }
    this.drawToasts(c);
    if (this.dlg) this.drawDialog(c);
    if (this.popup) this.drawPopup(c);
    if (this.sleepT > 0) {
      const a = this.sleepT < 1.2 ? this.sleepT / 1.2 : this.sleepT > 1.8 ? Math.max(0, 1 - (this.sleepT - 1.8) / 0.8) : 1;
      c.fillStyle = `rgba(10,12,30,${a.toFixed(3)})`;
      c.fillRect(0, 0, W, H);
      if (a > 0.5) text(c, 'Zzz……', W / 2, H / 2, 40, `rgba(255,255,255,${(a * 0.9).toFixed(2)})`, 'center', 800);
    }
  }

  drawWorld(c, cx, cy) {
    const A = this.A, t = this.t;
    const h = this.s ? this.hour : 10;
    const night = nightLevel(h);
    const ix = Math.round(cx), iy = Math.round(cy);
    c.drawImage(A.map, ix, iy, W, H, 0, 0, W, H);
    // 波光
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 2;
    c.lineCap = 'butt';
    c.beginPath();
    for (const g of A.glints) {
      const x = g.x - ix, y = g.y - iy;
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      const k = Math.sin(t * 1.4 + g.ph);
      if (k < 0.55) continue;
      const len = g.s * (k - 0.55) * 2;
      c.moveTo(x - len, y);
      c.lineTo(x + len, y);
    }
    c.stroke();
    // 海浪
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 3;
    c.beginPath();
    for (let ci = 0; ci < A.coast.length; ci += 2) {
      const p = A.coast[ci];
      const k = (Math.sin(t * 1.1 + p.ph) + 1) / 2;
      const x = p.x + p.nx * (8 + k * 12) - ix, y = p.y + p.ny * (8 + k * 12) - iy;
      if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
      c.moveTo(x - p.ny * 12, y + p.nx * 12);
      c.lineTo(x + p.ny * 12, y - p.nx * 12);
    }
    c.stroke();
    // 水面涟漪
    for (const r of this.ripples || []) {
      c.strokeStyle = `rgba(255,255,255,${(0.8 * (1 - r.t)).toFixed(3)})`;
      c.lineWidth = 2;
      c.beginPath(); c.ellipse(r.x - ix, r.y - iy, r.r * (0.4 + r.t), r.r * 0.45 * (0.4 + r.t), 0, 0, TAU); c.stroke();
    }
    // 鱼影
    for (const s of this.shadows || []) {
      const x = s.x - ix, y = s.y - iy;
      if (x < -60 || y < -60 || x > W + 60 || y > H + 60) continue;
      s.fade = Math.min(1, (s.fade || 0) + 0.03);
      const a = (s.state === 'flee' ? Math.max(0, 1 - s.t) : 1) * s.fade;
      c.save();
      c.translate(x, y);
      c.rotate(s.ang);
      c.fillStyle = `rgba(20,40,60,${(0.32 * a).toFixed(3)})`;
      c.beginPath(); c.ellipse(0, 0, s.size, s.size * 0.42, 0, 0, TAU); c.fill();
      const wag = Math.sin(t * 8 + s.x) * 0.3;
      c.beginPath(); c.moveTo(-s.size * 0.8, 0); c.lineTo(-s.size * 1.35, -s.size * 0.38 + wag * 4); c.lineTo(-s.size * 1.35, s.size * 0.38 + wag * 4); c.closePath(); c.fill();
      c.restore();
      if (s.def.fin) {
        c.fillStyle = `rgba(90,104,120,${(0.9 * a).toFixed(3)})`;
        c.beginPath(); c.moveTo(x - 6, y - 2); c.lineTo(x + 2, y - 20); c.lineTo(x + 8, y - 2); c.closePath(); c.fill();
      }
    }
    // 浮标
    const F = this.fish;
    if (F) {
      const k = F.phase === 'cast' ? Math.min(1, F.t / 0.4) : 1;
      const bx = lerp(F.x0, F.bx, k) - ix, by = lerp(F.y0, F.by, k) - iy - Math.sin(k * Math.PI) * 70;
      const sink = F.phase === 'bite' ? 7 : F.dip > 0 ? 4 : Math.sin(t * 3) * 1.2;
      const [dx] = DIRS[this.p.dir];
      const rx = this.p.x - ix + (dx || 0.4) * 22, ry = this.p.y - iy - 58;
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(rx, ry); c.quadraticCurveTo((rx + bx) / 2, Math.max(ry, by) + 20, bx, by + sink); c.stroke();
      if (k >= 1 && F.phase !== 'bite') { c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(bx, by + 4, 9, 3, 0, 0, TAU); c.fill(); }
      c.fillStyle = '#e8323a';
      c.beginPath(); c.arc(bx, by + sink - 3, 5, Math.PI, TAU); c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(bx, by + sink - 3, 5, 0, Math.PI); c.fill();
      if (F.phase === 'bite') outlineText(c, '！', bx, by - 30, 34, '#ffffff', '#e8323a', 6);
    }
    // 花（地面装饰）
    for (const f of A.objs.flowers) {
      const x = f.x - ix, y = f.y - iy;
      if (x < -20 || y < -30 || x > W + 20 || y > H + 20) continue;
      flowerSprite(c, x, y, f.c, t, f.ph);
    }
    // 掉在地上的东西
    for (const d of this.drops || []) {
      const x = d.x - ix, y = d.y - iy;
      if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.beginPath(); c.ellipse(x, y, 10, 4, 0, 0, TAU); c.fill();
      if (d.coins) {
        fillRR(c, x - 11, y - 22 - d.h, 22, 20, 8, '#e8c45a');
        text(c, '币', x, y - 12 - d.h, 12, '#8a5a12', 'center', 900);
      } else drawItemIcon(c, d.it, x, y - 10 - d.h, 26, DATA, t);
    }
    // 按 y 排序画的东西
    const L = [];
    const vis = (x, y, m = 200) => x - ix > -m && x - ix < W + m && y - iy > -40 && y - iy < H + 260;
    A.objs.trees.forEach((tr, i) => { if (vis(tr.x, tr.y)) L.push([tr.y, 1, tr, i]); });
    for (const r of A.objs.rocks) if (vis(r.x, r.y)) L.push([r.y, 2, r]);
    for (const [x, y] of LAMPS) if (vis(x, y)) L.push([y, 3, x]);
    if (vis(SHOP.x, SHOP.y, 300)) L.push([SHOP.y, 4, 'shop']);
    if (vis(MUSEUM.x, MUSEUM.y, 300)) L.push([MUSEUM.y, 4, 'museum']);
    if (vis(HOUSE.x, HOUSE.y, 300)) L.push([HOUSE.y, 4, 'house' + (this.s ? this.s.house : 1)]);
    if (vis(FOUNTAIN.x, FOUNTAIN.y)) L.push([FOUNTAIN.y, 5]);
    if (vis(MAILBOX.x, MAILBOX.y)) L.push([MAILBOX.y, 6]);
    if (vis(SIGN.x, SIGN.y)) L.push([SIGN.y, 7]);
    for (const n of this.npcs || []) if (vis(n.x, n.y)) L.push([n.y, 8, n]);
    for (const b of this.bugs || []) if (vis(b.x, b.y)) L.push([b.y + (b.tree != null ? 1 : 0), 9, b]);
    if (this.p && this.mode === 'play') L.push([this.p.y, 10]);
    L.sort((a, b) => a[0] - b[0]);
    for (const e of L) {
      const type = e[1];
      if (type === 1) this.drawTree(c, e[2], e[3], ix, iy);
      else if (type === 2) drawRock(c, e[2].x - ix, e[2].y - iy, e[2].s);
      else if (type === 3) drawLampPost(c, e[2] - ix, e[0] - iy, night);
      else if (type === 4) {
        const key = e[2];
        const pos = key === 'shop' ? SHOP : key === 'museum' ? MUSEUM : HOUSE;
        const sp = A.blds[key];
        const behind = this.p && this.mode === 'play' && Math.abs(this.p.x - pos.x) < sp.w / 2 && this.p.y < pos.y - 10 && this.p.y > pos.y - sp.h + 10;
        if (behind) c.globalAlpha = 0.55;
        blit(c, sp, pos.x - ix, pos.y - iy);
        c.globalAlpha = 1;
      } else if (type === 5) drawFountain(c, FOUNTAIN.x - ix, FOUNTAIN.y - iy, t);
      else if (type === 6) drawMailbox(c, MAILBOX.x - ix, MAILBOX.y - iy, this.s && this.s.debt > 0);
      else if (type === 7) drawSign(c, SIGN.x - ix, SIGN.y - iy, '茶岛码头');
      else if (type === 8) {
        const n = e[2];
        drawNPC(c, n.id, n.x - ix, n.y - iy, n.dir, n.walk, n.moving, t);
        if (this.mode === 'play' && this.hasBubble(n) && !this.dlg) {
          const by = n.y - iy - 70 + Math.sin(t * 4) * 3;
          fillRR(c, n.x - ix - 12, by - 14, 24, 24, 12, '#ffffff');
          text(c, '!', n.x - ix, by - 1, 18, '#ff7a1a', 'center', 900);
        }
      } else if (type === 9) {
        const b = e[2];
        drawBugWorld(c, b, b.x - ix, b.y - iy, b.h, t, night);
      } else if (type === 10) {
        const p = this.p;
        drawPlayer(c, p.x - ix, p.y - iy, { dir: p.dir, walk: p.walk, moving: p.moving, tool: this.s.tool, swing: p.swing > 0 ? 1 - p.swing / 0.36 : 0, swollen: p.swollen > 0, run: p.run, holdRod: !!this.fish });
      }
    }
    // 蜂群
    if (this.swarm) {
      const S = this.swarm;
      for (let k = 0; k < 7; k++) {
        const a = t * 9 + k * 0.9, r = 10 + (k % 3) * 6;
        drawBugIcon(c, DATA.bug.bee, S.x - ix + Math.cos(a) * r, S.y - iy + Math.sin(a * 1.3) * r * 0.6, 16, false, t + k);
      }
    }
    // 雨
    if (this.raining) {
      c.strokeStyle = 'rgba(220,235,255,0.55)';
      c.lineWidth = 1.5;
      c.beginPath();
      for (const r of this.rain) { c.moveTo(r.x, r.y); c.lineTo(r.x - r.l * 0.18, r.y + r.l); }
      c.stroke();
    }
    // 天色
    const tint = skyTint(h);
    let [r, g, b] = tint;
    if (this.raining) { r *= 0.8; g *= 0.82; b *= 0.88; }
    if (r < 254 || g < 254 || b < 254) {
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'source-over';
    }
    if (night > 0.05) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = night * 0.9;
      for (const [x, y] of LAMPS) if (vis(x, y, 120)) blit(c, A.warm, x - ix, y - iy - 66);
      const win = (key, pos) => { for (const [wx, wy] of WINDOWS[key]) if (vis(pos.x + wx, pos.y + wy, 80)) blit(c, A.warmS, pos.x + wx - ix, pos.y + wy - iy); };
      win('shop', SHOP);
      win('museum', MUSEUM);
      if (this.s) win('house' + this.s.house, HOUSE);
      for (const bg of this.bugs || []) if (bg.def.glow) { c.globalAlpha = night * (0.5 + 0.4 * Math.sin(t * 4 + bg.ph)); blit(c, A.green, bg.x - ix, bg.y - iy - bg.h); }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
  }
  drawTree(c, tr, i, ix, iy) {
    const A = this.A;
    const sp = A.trees[tr.kind];
    const shake = this.shake ? this.shake.get(i) || 0 : 0;
    const x = tr.x - ix, y = tr.y - iy;
    const p = this.p;
    const behind = p && this.mode === 'play' && Math.abs(p.x - tr.x) < 46 && p.y < tr.y - 6 && p.y > tr.y - 120;
    c.save();
    let ox = x, oy = y;
    if (shake > 0) {
      c.translate(x, y);
      c.rotate(Math.sin(shake * 40) * 0.035 * (shake / 0.55));
      ox = 0; oy = 0;
    }
    if (behind) c.globalAlpha = 0.6;
    blit(c, sp, ox, oy);
    if (this.s && tr.kind !== 'cedar') {
      const n = this.s.fruit[i];
      const slots = FRUIT_SLOTS[tr.kind];
      for (let k = 0; k < n && k < slots.length; k++) drawFruit(c, tr.kind === 'palm' ? 'coconut' : tr.kind, ox + slots[k][0], oy + slots[k][1]);
    }
    c.restore();
  }

  drawHUD(c) {
    const s = this.s;
    const h = Math.floor(s.min / 60), m = Math.floor(s.min % 60);
    const period = h < 5 ? '深夜' : h < 9 ? '早上' : h < 12 ? '上午' : h < 17 ? '下午' : h < 20 ? '傍晚' : '晚上';
    fillRR(c, 22, 20, 320, 92, 20, 'rgba(255,252,244,0.92)');
    text(c, `第 ${s.day} 天 · ${period}`, 44, 44, 19, '#7a5a3a', 'left', 700);
    text(c, `${pad2(h)}:${pad2(m)}`, 318, 46, 26, '#4a3a2a', 'right', 800);
    this.weatherIcon(c, 214, 44);
    fillRR(c, 36, 64, 22, 22, 11, '#e8c45a');
    text(c, '币', 47, 75, 12, '#8a5a12', 'center', 900);
    text(c, fmt(s.coins), 66, 76, 24, '#3a2a1a', 'left', 800);
    if (s.debt > 0) text(c, `贷款 ${fmt(s.debt)}`, 318, 77, 15, '#c0603a', 'right', 700);
    // 工具
    const names = ['空手', '鱼竿', '捕虫网'];
    fillRR(c, W - 236, 20, 214, 66, 20, 'rgba(255,252,244,0.92)');
    for (let i = 0; i < 3; i++) {
      const x = W - 196 + i * 66, sel = s.tool === i;
      if (sel) fillRR(c, x - 26, 28, 52, 50, 14, '#ffe0b8');
      this.toolIcon(c, i, x, 53, sel);
    }
    glyph(c, 'L', W - 236 + 4, 53, 11, '#4a3a2a', '#fff');
    glyph(c, 'R', W - 22 - 4, 53, 11, '#4a3a2a', '#fff');
    text(c, names[s.tool], W - 130, 100, 16, '#ffffff', 'center', 700);
    // 右下角提示
    const items = [];
    if (this.hint) items.push(['A', this.hint]);
    if (!this.fish) { items.push(['X', '背包']); items.push(['Y', '图鉴']); }
    else items.push(['B', '收回']);
    if (!this.fish && this.p.moving) items.push(['B', '按住奔跑']);
    let x = W - 24;
    for (let i = items.length - 1; i >= 0; i--) {
      const [g, label] = items[i];
      const tw = textW(c, label, 18, 700);
      x -= tw;
      outlineText(c, label, x, 690, 18, '#ffffff', 'rgba(40,30,20,0.6)', 5, 'left', 700);
      x -= 20;
      glyph(c, g, x, 690, 13, '#ffffff', '#3a2a1a');
      x -= 26;
    }
    if (this.p.swollen > 0) text(c, '（脸肿了一块……过一会儿就好）', 24, 690, 16, '#ffffff', 'left', 600);
  }
  weatherIcon(c, x, y) {
    if (this.raining) {
      c.fillStyle = '#8a9aaa';
      c.beginPath(); c.arc(x - 6, y, 8, 0, TAU); c.arc(x + 6, y - 2, 10, 0, TAU); c.arc(x + 14, y + 2, 7, 0, TAU); c.fill();
      c.strokeStyle = '#4f8fd0'; c.lineWidth = 2;
      c.beginPath(); for (const dx of [-6, 2, 10]) { c.moveTo(x + dx, y + 10); c.lineTo(x + dx - 3, y + 17); } c.stroke();
      return;
    }
    const n = nightLevel(this.hour);
    if (n > 0.6) {
      c.fillStyle = '#ffd86a';
      c.beginPath(); c.arc(x, y, 10, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,252,244,1)';
      c.beginPath(); c.arc(x + 5, y - 4, 9, 0, TAU); c.fill();
      return;
    }
    c.fillStyle = '#ffb02e';
    c.beginPath(); c.arc(x, y, 8, 0, TAU); c.fill();
    c.strokeStyle = '#ffb02e'; c.lineWidth = 2.5;
    c.beginPath();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + this.t * 0.4; c.moveTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); c.lineTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15); }
    c.stroke();
  }
  toolIcon(c, i, x, y, sel) {
    const col = sel ? '#6a3f1f' : '#a89a8a';
    c.strokeStyle = col;
    c.lineWidth = 3;
    c.lineCap = 'round';
    if (i === 0) {
      c.fillStyle = sel ? '#ffe0c4' : '#e8dccc';
      c.beginPath(); c.arc(x, y + 2, 11, 0, TAU); c.fill();
      c.beginPath(); for (let k = 0; k < 4; k++) { c.moveTo(x - 9 + k * 6, y - 4); c.lineTo(x - 9 + k * 6, y - 14 + Math.abs(k - 1.5) * 2); } c.stroke();
    } else if (i === 1) {
      c.beginPath(); c.moveTo(x - 14, y + 14); c.lineTo(x + 12, y - 14); c.stroke();
      c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x + 12, y - 14); c.quadraticCurveTo(x + 18, y, x + 14, y + 10); c.stroke();
      c.fillStyle = '#e8323a'; c.beginPath(); c.arc(x + 14, y + 12, 3.5, 0, TAU); c.fill();
      if (this.s.rod) { c.fillStyle = this.s.rod === 2 ? '#e8c43a' : '#8a5a32'; c.beginPath(); c.arc(x - 10, y + 10, 4, 0, TAU); c.fill(); }
    } else {
      c.beginPath(); c.moveTo(x - 12, y + 14); c.lineTo(x + 2, y - 2); c.stroke();
      c.lineWidth = 2;
      c.beginPath(); c.arc(x + 7, y - 7, this.s.net ? 11 : 9, 0, TAU); c.stroke();
    }
  }

  drawToasts(c) {
    this.fx2.draw(c);
    for (const f of this.floaters) {
      const a = 1 - f.t / 1.2;
      c.globalAlpha = Math.max(0, Math.min(1, a * 1.5));
      outlineText(c, f.text, f.x + 40, f.y - f.t * 30, 22, f.text[0] === '-' ? '#ff6a5a' : '#ffd23f', 'rgba(60,40,20,0.8)', 5, 'center', 900);
      c.globalAlpha = 1;
    }
    if (this.menu === 'inv' || this.menu === 'dex') return;
    this.toasts.forEach((tt, i) => {
      const a = Math.min(1, tt.t / 0.2, (2.6 - tt.t) / 0.4);
      const y = 140 + i * 46 - (1 - Math.min(1, tt.t / 0.25)) * 14;
      c.globalAlpha = Math.max(0, a);
      const w = textW(c, tt.text, 19, 700) + 44;
      fillRR(c, W / 2 - w / 2, y - 19, w, 38, 19, 'rgba(60,44,30,0.82)');
      text(c, tt.text, W / 2, y + 1, 19, '#fff6e6', 'center', 700);
      c.globalAlpha = 1;
    });
  }

  drawDialog(c) {
    const d = this.dlg;
    const line = d.lines[d.i];
    const str = typeof line === 'string' ? line : line.t;
    const info = d.who && NPCS[d.who];
    const x = 150, y = 516, w = 980, hgt = 170;
    const appear = easeOutBack(Math.min(1, (d.i === 0 ? d.shown / 6 : 1)));
    c.save();
    c.translate(0, (1 - appear) * 40);
    fillRR(c, x, y, w, hgt, 30, 'rgba(255,252,244,0.97)');
    strokeRR(c, x + 6, y + 6, w - 12, hgt - 12, 25, info ? info.color : '#c9b48a', 3);
    if (d.who) {
      circ2(c, x + 20, y + 10, 70, '#ffffff', info ? info.color : '#c9b48a');
      portrait(c, d.who, x + 20, y + 14, 1.6, this.t);
      if (info) {
        const nw = textW(c, info.name, 22, 800) + 36;
        fillRR(c, x + 100, y - 20, nw, 40, 20, info.color);
        text(c, info.name, x + 100 + nw / 2, y + 1, 22, '#ffffff', 'center', 800);
      }
    }
    if (!d.wrapped) d.wrapped = wrapText(c, str, w - 200, 26);
    let left = Math.floor(d.shown);
    d.wrapped.forEach((ln, k) => {
      const shown = ln.slice(0, Math.max(0, left));
      left -= ln.length;
      text(c, shown, x + 120, y + 56 + k * 40, 26, '#4a3a2a', 'left', 600);
    });
    if (d.shown >= str.length && !line.choices && Math.sin(this.t * 6) > -0.3) poly2(c, [x + w - 56, y + hgt - 40, x + w - 40, y + hgt - 40, x + w - 48, y + hgt - 30], '#c9a06a');
    c.restore();
    if (line.choices && d.shown >= str.length) {
      const cw = 320, ch = line.choices.length * 56 + 20;
      const cx0 = x + w - cw - 10, cy0 = y - ch - 18;
      fillRR(c, cx0, cy0, cw, ch, 22, 'rgba(255,252,244,0.98)');
      strokeRR(c, cx0 + 4, cy0 + 4, cw - 8, ch - 8, 18, '#e0cfae', 2);
      line.choices.forEach((o, k) => {
        const yy = cy0 + 38 + k * 56;
        if (k === d.sel) { fillRR(c, cx0 + 14, yy - 22, cw - 28, 44, 14, '#ffe0b8'); poly2(c, [cx0 + 26, yy - 8, cx0 + 38, yy, cx0 + 26, yy + 8], '#ff7a1a'); }
        text(c, o.label, cx0 + 48, yy + 1, 22, '#4a3a2a', 'left', 700);
      });
    }
  }

  drawPopup(c) {
    const P = this.popup;
    const a = easeOutCubic(P.t / 0.3);
    c.fillStyle = `rgba(30,20,10,${(0.45 * a).toFixed(3)})`;
    c.fillRect(0, 0, W, H);
    const s = easeOutBack(Math.min(1, P.t / 0.45));
    c.save();
    c.translate(W / 2, H / 2);
    c.scale(s, s);
    // 光芒
    c.save();
    c.rotate(this.t * 0.4);
    c.fillStyle = 'rgba(255,230,160,0.35)';
    for (let k = 0; k < 12; k++) { c.rotate(TAU / 12); c.beginPath(); c.moveTo(0, 0); c.lineTo(-30, -330); c.lineTo(30, -330); c.closePath(); c.fill(); }
    c.restore();
    fillRR(c, -300, -170, 600, 340, 34, 'rgba(255,252,244,0.98)');
    strokeRR(c, -292, -162, 584, 324, 28, '#ffb46a', 3);
    const bounce = Math.abs(Math.sin(P.t * 3)) * 8;
    fillRR(c, -78, -150, 156, 140, 30, '#fff1dc');
    if (P.it) drawItemIcon(c, P.it, 0, -80 - bounce, 118, DATA, this.t);
    else if (P.house != null) blitScaled(c, this.A.blds['house' + P.house], 0, -20 - bounce, 0.55);
    if (P.isNew) {
      c.save();
      c.translate(200, -132);
      c.rotate(0.16);
      fillRR(c, -70, -20, 140, 40, 20, '#ff4b3e');
      text(c, '★ 新发现 ★', 0, 1, 20, '#ffffff', 'center', 800);
      c.restore();
    }
    text(c, P.title, 0, 22, 34, '#4a3a2a', 'center', 900);
    const lines = wrapText(c, P.sub, 520, 20, 600);
    lines.forEach((ln, k) => text(c, ln, 0, 66 + k * 30, 20, '#7a6a5a', 'center', 600));
    if (P.extra) text(c, P.extra, 0, 70 + lines.length * 30 + 4, 18, '#c0703a', 'center', 800);
    c.restore();
    if (P.t > 0.45) {
      glyph(c, 'A', W / 2 - 30, 662, 14, '#ffffff', '#3a2a1a');
      text(c, '好的', W / 2 - 10, 663, 20, '#ffffff', 'left', 700);
    }
  }

  // 背包界面
  drawInv(c) {
    const s = this.s;
    c.fillStyle = 'rgba(30,20,10,0.45)';
    c.fillRect(0, 0, W, H);
    const pw = 860, ph = 560, x0 = (W - pw) / 2, y0 = 84;
    fillRR(c, x0, y0, pw, ph, 34, '#fff8ec');
    strokeRR(c, x0 + 6, y0 + 6, pw - 12, ph - 12, 28, '#e8cfa6', 3);
    text(c, '背包', x0 + 40, y0 + 46, 30, '#6a3f1f', 'left', 900);
    text(c, `${s.inv.length} / ${s.bag}`, x0 + 120, y0 + 48, 20, '#a8906a', 'left', 700);
    text(c, `茶币 ${fmt(s.coins)}`, x0 + pw - 40, y0 + 48, 22, '#6a3f1f', 'right', 800);
    const goal = s.debt > 0 ? `目标：还清贷款（还差 ${fmt(s.debt)} 茶币）` : s.house < 2 ? `目标：找壶爷爷，把房子升级成「${HOUSES[s.house + 1].name}」` : `目标：填满图鉴（${this.dexCount()} / ${DEX_TOTAL}）`;
    fillRR(c, x0 + 40, y0 + 76, pw - 80, 38, 19, '#ffe9c8');
    text(c, goal, x0 + 60, y0 + 96, 18, '#8a5a2a', 'left', 700);
    const cols = 6, cell = 92, gx = x0 + (pw - cols * cell) / 2, gy = y0 + 134;
    const ch = Math.min(cell * 0.86, 370 / Math.ceil(s.bag / cols));
    for (let i = 0; i < s.bag; i++) {
      const cx = gx + (i % cols) * cell, cy = gy + Math.floor(i / cols) * ch;
      const sel = i === this.msel;
      fillRR(c, cx + 6, cy + 3, cell - 12, ch - 6, 16, sel ? '#ffd9a8' : '#f4e8d4');
      if (sel) strokeRR(c, cx + 6, cy + 3, cell - 12, ch - 6, 16, '#ff8a3c', 3);
      const it = s.inv[i];
      if (it) {
        drawItemIcon(c, it, cx + cell / 2, cy + ch / 2, Math.min(50, ch - 14), DATA, this.t);
        if (it.n > 1) text(c, `×${it.n}`, cx + cell - 14, cy + ch - 15, 15, '#6a3f1f', 'right', 800);
      }
    }
    const it = s.inv[this.msel];
    const iy = y0 + ph - 52;
    if (it) {
      const d = this.itemDef(it);
      text(c, this.itemName(it), x0 + 50, iy, 22, '#4a3a2a', 'left', 800);
      text(c, it.k === 'furn' ? '家具' : `卖 ${fmt(this.sellPrice(it))} 茶币`, x0 + 50 + textW(c, this.itemName(it), 22, 800) + 20, iy + 1, 18, '#a8906a', 'left', 700);
      if (d && d.quip) text(c, d.quip.length > 22 ? d.quip.slice(0, 22) + '…' : d.quip, x0 + pw - 50, iy + 1, 16, '#a8906a', 'right', 600);
    } else text(c, '空格子', x0 + 50, iy, 20, '#c0b090', 'left', 700);
    const toolsTxt = `鱼竿 ${['普通', '结实', '金色'][s.rod]} · 捕虫网 ${s.net ? '大号' : '普通'}`;
    text(c, toolsTxt, x0 + pw - 40, y0 + ph + 26, 16, '#ffffff', 'right', 700);
    if (this.sub) this.drawSub(c, x0 + pw - 280, y0 + 150);
    controlsBar(c, [['A', '选择'], ['B', '关闭']], 690);
  }
  drawSub(c, x, y) {
    const o = this.sub.opts;
    const w = 230, h = o.length * 50 + 20;
    fillRR(c, x, y, w, h, 20, '#ffffff');
    strokeRR(c, x + 3, y + 3, w - 6, h - 6, 17, '#e8cfa6', 2);
    o.forEach((op, k) => {
      const yy = y + 34 + k * 50;
      if (k === this.sub.sel) fillRR(c, x + 12, yy - 20, w - 24, 40, 12, '#ffe0b8');
      text(c, op.label, x + 30, yy + 1, 20, '#4a3a2a', 'left', 700);
    });
  }

  // 图鉴界面
  drawDex(c) {
    const s = this.s;
    c.fillStyle = 'rgba(20,30,20,0.5)';
    c.fillRect(0, 0, W, H);
    const pw = 1080, ph = 580, x0 = (W - pw) / 2, y0 = 70;
    fillRR(c, x0, y0, pw, ph, 34, '#f6fbef');
    strokeRR(c, x0 + 6, y0 + 6, pw - 12, ph - 12, 28, '#bfdca6', 3);
    text(c, '茶岛图鉴', x0 + 40, y0 + 46, 30, '#2f6a3a', 'left', 900);
    const n = this.dexCount();
    text(c, `收集 ${n} / ${DEX_TOTAL}（${Math.round((n / DEX_TOTAL) * 100)}%）`, x0 + 200, y0 + 48, 19, '#6a9a5a', 'left', 700);
    fillRR(c, x0 + 470, y0 + 40, 260, 14, 7, '#dcebd0');
    fillRR(c, x0 + 470, y0 + 40, Math.max(14, 260 * (n / DEX_TOTAL)), 14, 7, '#6fbf5a');
    ['鱼', '虫'].forEach((tab, i) => {
      const tx = x0 + pw - 240 + i * 110;
      fillRR(c, tx, y0 + 26, 100, 42, 21, this.mtab === i ? '#4fae55' : '#dcebd0');
      text(c, tab, tx + 50, y0 + 48, 20, this.mtab === i ? '#ffffff' : '#4a7a4a', 'center', 800);
    });
    glyph(c, 'L', x0 + pw - 262, y0 + 47, 11, '#4a7a4a', '#fff');
    glyph(c, 'R', x0 + pw - 18, y0 + 47, 11, '#4a7a4a', '#fff');
    const list = this.mtab ? BUGS : FISH;
    const kind = this.mtab ? 'bug' : 'fish';
    const cols = 6, cell = 104, gx = x0 + 34, gy = y0 + 90;
    list.forEach((d, i) => {
      const cx = gx + (i % cols) * cell, cy = gy + Math.floor(i / cols) * 104;
      const key = this.dexKey(kind, d.id);
      const got = !!s.caught[key];
      const sel = i === this.msel;
      fillRR(c, cx + 4, cy + 4, cell - 8, 96, 18, sel ? '#e3f4d6' : '#ffffff');
      if (sel) strokeRR(c, cx + 4, cy + 4, cell - 8, 96, 18, '#4fae55', 3);
      if (kind === 'fish') drawFishIcon(c, d, cx + cell / 2, cy + 44, 58, !got);
      else drawBugIcon(c, d, cx + cell / 2, cy + 44, 52, !got, this.t);
      text(c, got ? d.name : '？？？', cx + cell / 2, cy + 86, 14, got ? '#3a5a3a' : '#a8b4a8', 'center', 700);
      if (s.donated[key]) { fillRR(c, cx + cell - 30, cy + 10, 20, 20, 10, '#4f8fd0'); text(c, '馆', cx + cell - 20, cy + 21, 11, '#fff', 'center', 900); }
    });
    const d = list[this.msel];
    const key = this.dexKey(kind, d.id);
    const got = !!s.caught[key];
    const dx = x0 + 680, dy = y0 + 90, dw = 360, dh = 460;
    fillRR(c, dx, dy, dw, dh, 24, '#ffffff');
    fillRR(c, dx + 20, dy + 20, dw - 40, 180, 20, kind === 'fish' ? '#d9f1fb' : '#eef7e0');
    if (kind === 'fish') drawFishIcon(c, d, dx + dw / 2, dy + 110, 150, !got);
    else drawBugIcon(c, d, dx + dw / 2, dy + 110, 130, !got, this.t);
    text(c, got ? d.name : '？？？', dx + dw / 2, dy + 236, 30, '#2f4a2f', 'center', 900);
    const rows = [
      ['出没', WHERE_NAME[d.where] + (d.rain === 'only' ? '（只在雨天）' : d.rain === 'more' ? '（雨天更多）' : d.rain === 'no' ? '（晴天）' : '')],
      ['时间', hoursText(d.hours)],
      ['价格', got ? `${fmt(d.price)} 茶币` : '？？？'],
    ];
    if (kind === 'fish') rows.splice(1, 0, ['大小', `${SIZE_NAME[d.size]}型鱼影`]);
    rows.forEach(([k, v], i) => {
      text(c, k, dx + 30, dy + 288 + i * 36, 17, '#8aa08a', 'left', 700);
      text(c, v, dx + 90, dy + 288 + i * 36, 17, '#3a4a3a', 'left', 700);
    });
    const st = s.donated[key] ? '已捐给博物馆' : got ? '已收集 · 还没捐赠' : '还没有发现';
    fillRR(c, dx + 30, dy + dh - 56, dw - 60, 38, 19, s.donated[key] ? '#4f8fd0' : got ? '#6fbf5a' : '#c9d4c9');
    text(c, st, dx + dw / 2, dy + dh - 36, 17, '#ffffff', 'center', 800);
    controlsBar(c, [['L', '鱼 / 虫'], ['B', '关闭']], 690);
  }

  // 茶铺
  drawShop(c) {
    const s = this.s;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#f7e3c2');
    g.addColorStop(1, '#e8c898');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // 货架
    c.fillStyle = '#c9965a';
    for (const y of [150, 300]) c.fillRect(0, y, 420, 12);
    for (let i = 0; i < 6; i++) { fillRR(c, 30 + i * 64, 102, 40, 48, 8, ['#5aa66a', '#e8823a', '#4f8fd0', '#d9534f', '#f0c040', '#8a6ab8'][i]); fillRR(c, 26 + i * 64, 96, 48, 10, 4, '#7a4a26'); }
    for (let i = 0; i < 5; i++) drawFruit(c, ['orange', 'peach', 'apple', 'orange', 'apple'][i], 60 + i * 74, 286, 1.6);
    // 柜台和店长
    fillRR(c, 40, 470, 380, 250, 20, '#a8754a');
    fillRR(c, 40, 470, 380, 24, 10, '#c9965a');
    portrait(c, 'shop', 230, 400, 3.2, this.t);
    // 店长的话
    fillRR(c, 60, 560, 340, 120, 20, 'rgba(255,252,244,0.96)');
    const lines = wrapText(c, this.shopLine || '', 300, 19, 600);
    lines.slice(0, 3).forEach((ln, k) => text(c, ln, 80, 594 + k * 30, 19, '#5a3a1a', 'left', 600));
    // 列表
    const x0 = 470, y0 = 40, pw = 770, ph = 620;
    fillRR(c, x0, y0, pw, ph, 30, '#fffaf0');
    ['出售', '购买'].forEach((tab, i) => {
      const tx = x0 + 30 + i * 130;
      fillRR(c, tx, y0 + 22, 118, 46, 23, this.mtab === i ? '#ff8a3c' : '#f4e2c8');
      text(c, tab, tx + 59, y0 + 46, 22, this.mtab === i ? '#ffffff' : '#8a5a2a', 'center', 800);
    });
    text(c, `茶币 ${fmt(s.coins)}`, x0 + pw - 30, y0 + 46, 24, '#6a3f1f', 'right', 900);
    const list = this.shopList();
    const rowH = 62, vis = 8;
    if (this.msel < this.mscroll) this.mscroll = this.msel;
    if (this.msel >= this.mscroll + vis) this.mscroll = this.msel - vis + 1;
    if (!list.length) text(c, this.mtab === 0 ? '背包是空的。去钓鱼、捉虫、摇果子吧！' : '暂时没有可以买的东西。', x0 + pw / 2, y0 + 300, 22, '#b8a080', 'center', 700);
    for (let k = 0; k < vis; k++) {
      const i = this.mscroll + k;
      const e = list[i];
      if (!e) break;
      const yy = y0 + 92 + k * rowH;
      const sel = i === this.msel;
      fillRR(c, x0 + 24, yy, pw - 48, rowH - 8, 16, sel ? '#ffe0b8' : '#fbf1e0');
      if (sel) strokeRR(c, x0 + 24, yy, pw - 48, rowH - 8, 16, '#ff8a3c', 2.5);
      let name, desc = '', icon;
      if (e.it) { name = this.itemName(e.it); icon = e.it; desc = e.it.k === 'furn' ? '家具（回收价）' : ''; }
      else if (e.up) { name = e.up.name; desc = e.up.desc; }
      else { name = e.furn.name; icon = { k: 'furn', id: e.furn.id }; desc = '家具'; }
      if (icon) drawItemIcon(c, icon, x0 + 64, yy + (rowH - 8) / 2, 40, DATA, this.t);
      else { fillRR(c, x0 + 44, yy + 8, 40, 38, 12, '#ffd08a'); text(c, '↑', x0 + 64, yy + 28, 22, '#8a5a2a', 'center', 900); }
      text(c, name, x0 + 104, yy + 20, 21, '#4a3a2a', 'left', 800);
      if (desc) text(c, desc, x0 + 104, yy + 42, 15, '#a8906a', 'left', 600);
      const afford = this.mtab === 0 || s.coins >= e.price;
      text(c, `${this.mtab === 0 ? '+' : ''}${fmt(e.price)}`, x0 + pw - 50, yy + 28, 22, afford ? '#c0703a' : '#c8b8a8', 'right', 900);
    }
    if (list.length > vis) text(c, `${this.msel + 1} / ${list.length}`, x0 + pw - 40, y0 + ph - 18, 15, '#b8a080', 'right', 700);
    const bar = this.mtab === 0 ? [['A', '卖掉'], ['Y', '全部卖掉'], ['L', '切换'], ['B', '离开']] : [['A', '购买'], ['L', '切换'], ['B', '离开']];
    controlsBar(c, bar, 692);
  }

  // 博物馆
  drawMuseum(c) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#eef3f6');
    g.addColorStop(1, '#d6dee4');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#c8d2da';
    for (let x = 0; x < W; x += 160) c.fillRect(x, 0, 18, H);
    const v = this.museumView;
    if (v === 'gallery') return this.drawGallery(c);
    portrait(c, 'curator', 250, 380, 4, this.t);
    fillRR(c, 90, 520, 320, 200, 20, '#8a6a4a');
    if (v === 'menu') {
      const opts = ['捐赠展品', '参观展厅', '离开'];
      const x0 = 640, y0 = 240;
      fillRR(c, x0 - 40, y0 - 70, 520, 330, 30, '#ffffff');
      text(c, `已捐赠 ${this.s.donations} / ${DEX_TOTAL}`, x0 + 220, y0 - 30, 22, '#4f6f8f', 'center', 800);
      opts.forEach((o, i) => {
        const yy = y0 + 30 + i * 70;
        if (i === this.msel) { fillRR(c, x0, yy - 28, 440, 56, 18, '#dbe9f6'); poly2(c, [x0 + 18, yy - 9, x0 + 32, yy, x0 + 18, yy + 9], '#4f8fd0'); }
        text(c, o, x0 + 50, yy + 1, 26, '#2f4a6a', 'left', 800);
      });
      controlsBar(c, [['A', '确定'], ['B', '离开']], 692);
      return;
    }
    const list = this.donatable();
    const x0 = 560, y0 = 80, pw = 660, ph = 560;
    fillRR(c, x0, y0, pw, ph, 30, '#ffffff');
    text(c, '要捐赠哪一件？', x0 + 40, y0 + 46, 26, '#2f4a6a', 'left', 900);
    list.slice(0, 8).forEach(({ it }, k) => {
      const yy = y0 + 84 + k * 58;
      const sel = k === this.msel;
      fillRR(c, x0 + 24, yy, pw - 48, 50, 14, sel ? '#dbe9f6' : '#f3f6f9');
      drawItemIcon(c, it, x0 + 60, yy + 25, 38, DATA, this.t);
      text(c, this.itemName(it), x0 + 100, yy + 26, 22, '#2f4a6a', 'left', 800);
      text(c, it.k === 'fish' ? '鱼类' : '昆虫', x0 + pw - 50, yy + 26, 17, '#8aa0b8', 'right', 700);
    });
    controlsBar(c, [['A', '捐赠'], ['B', '返回']], 692);
  }
  drawGallery(c) {
    const s = this.s;
    const t = this.t;
    if (this.mtab === 0) {
      const g = c.createLinearGradient(0, 80, 0, 640);
      g.addColorStop(0, '#7fd3ee');
      g.addColorStop(1, '#2a6fa8');
      fillRR(c, 60, 70, W - 120, 570, 30, g);
      c.save();
      c.beginPath(); c.roundRect ? c.roundRect(60, 70, W - 120, 570, 30) : c.rect(60, 70, W - 120, 570); c.clip();
      for (let k = 0; k < 12; k++) { c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.moveTo(100 + k * 110 + Math.sin(t + k) * 20, 70); c.lineTo(160 + k * 110, 70); c.lineTo(60 + k * 110, 640); c.lineTo(20 + k * 110, 640); c.fill(); }
      FISH.forEach((f, i) => {
        if (!s.donated[this.dexKey('fish', f.id)]) return;
        const lane = 120 + (i % 8) * 64;
        const sp = 40 + (i * 13) % 30;
        const span = W - 260;
        const u = ((t * sp + i * 173) % (span * 2));
        const dir = u < span ? 1 : -1;
        const x = 130 + (u < span ? u : span * 2 - u);
        c.save();
        c.translate(x, lane + Math.sin(t * 2 + i) * 6);
        c.scale(dir, 1);
        drawFishIcon(c, f, 0, 0, f.size === 'XL' ? 110 : f.size === 'L' ? 80 : 60);
        c.restore();
      });
      for (let k = 0; k < 20; k++) { const bx = 100 + (k * 97) % (W - 200), by = 640 - ((t * 40 + k * 53) % 560); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(bx, by, 3 + (k % 3), 0, TAU); c.stroke(); }
      c.restore();
    } else {
      fillRR(c, 60, 70, W - 120, 570, 30, '#e9f5dc');
      c.fillStyle = '#cfe6b8';
      c.fillRect(60, 520, W - 120, 120);
      BUGS.forEach((b, i) => {
        const col = i % 7, row = Math.floor(i / 7);
        const x = 160 + col * 160, y = 220 + row * 220;
        c.strokeStyle = '#6fae55'; c.lineWidth = 4;
        c.beginPath(); c.moveTo(x, y + 90); c.quadraticCurveTo(x - 10, y + 40, x, y + 10); c.stroke();
        for (const sx of [-1, 1]) { c.fillStyle = '#7fcf5a'; c.beginPath(); c.ellipse(x + sx * 14, y + 50, 14, 6, sx * 0.5, 0, TAU); c.fill(); }
        if (s.donated[this.dexKey('bug', b.id)]) {
          const fy = b.fly ? Math.sin(t * 2 + i) * 10 - 20 : 0;
          drawBugIcon(c, b, x, y + fy, 70, false, t + i);
          text(c, b.name, x, y + 116, 16, '#3a5a3a', 'center', 800);
        } else {
          fillRR(c, x - 34, y - 34, 68, 68, 20, 'rgba(255,255,255,0.6)');
          text(c, '？', x, y, 30, '#b8c8b0', 'center', 900);
        }
      });
    }
    const label = this.mtab === 0 ? '水族厅' : '昆虫园';
    fillRR(c, W / 2 - 110, 40, 220, 52, 26, '#ffffff');
    text(c, label, W / 2, 66, 26, '#2f4a6a', 'center', 900);
    controlsBar(c, [['L', '水族厅 / 昆虫园'], ['B', '返回']], 692);
  }

  // 家里
  drawRoom(c) {
    const s = this.s, R = this.room;
    const lvl = s.house;
    const [gw, gh] = this.roomGrid();
    const cell = Math.min(100, Math.floor(820 / gw), Math.floor(380 / gh));
    const rw = gw * cell, rh = gh * cell;
    const x0 = (W - rw) / 2, y0 = 210 + (380 - rh) / 2;
    const wallC = lvl === 0 ? '#ff9a5a' : lvl === 1 ? '#d9a86a' : '#f1e3c6';
    const floorC = lvl === 0 ? '#e8c898' : lvl === 1 ? '#b98652' : '#d9c48a';
    c.fillStyle = '#2a2420';
    c.fillRect(0, 0, W, H);
    // 墙
    fillRR(c, x0 - 30, y0 - 150, rw + 60, 160, 16, wallC);
    if (lvl === 0) { c.fillStyle = 'rgba(255,255,255,0.25)'; for (let x = x0 - 30; x < x0 + rw + 30; x += 40) c.fillRect(x, y0 - 150, 18, 160); }
    if (lvl === 1) { c.fillStyle = 'rgba(90,50,20,0.25)'; for (let y = y0 - 140; y < y0; y += 18) c.fillRect(x0 - 30, y, rw + 60, 3); }
    // 窗户（外面的天色）
    const tint = skyTint(this.hour);
    fillRR(c, x0 + rw / 2 - 70, y0 - 122, 140, 92, 10, '#8a5a32');
    fillRR(c, x0 + rw / 2 - 62, y0 - 114, 124, 76, 6, `rgb(${tint[0] * 0.55 | 0},${tint[1] * 0.75 | 0},${tint[2] | 0})`);
    c.fillStyle = '#8a5a32';
    c.fillRect(x0 + rw / 2 - 2, y0 - 114, 4, 76);
    // 地板
    fillRR(c, x0 - 30, y0, rw + 60, rh + 30, 16, floorC);
    c.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i <= gw; i++) c.fillRect(x0 + i * cell - 1, y0, 2, rh);
    for (let j = 0; j <= gh; j++) c.fillRect(x0, y0 + j * cell - 1, rw, 2);
    // 门
    fillRR(c, W / 2 - 40, y0 + rh + 10, 80, 20, 6, '#6a3f1f');
    // 睡袋（帐篷自带）
    if (lvl === 0 && R.floor === 1) { fillRR(c, x0 + rw - cell * 0.9, y0 + 10, cell * 0.8, cell * 1.6, 20, '#4f8fd0'); fillRR(c, x0 + rw - cell * 0.85, y0 + 16, cell * 0.7, cell * 0.4, 14, '#ffffff'); }
    // 家具
    const list = [...this.roomList()].sort((a, b) => a.y - b.y);
    for (const f of list) drawFurniture(c, f.id, x0 + f.x * cell + cell / 2, y0 + f.y * cell + cell - 6, cell * 1.3, this.t);
    // 光标
    const blink = 0.6 + 0.4 * Math.sin(this.t * 6);
    strokeRR(c, x0 + R.cx * cell + 4, y0 + R.cy * cell + 4, cell - 8, cell - 8, 12, `rgba(255,138,60,${blink.toFixed(2)})`, 4);
    // 主角站在门口
    drawPlayer(c, W / 2, y0 + rh + 8, { dir: 2, tool: 0 });
    // 夜里暗一点
    const n = nightLevel(this.hour);
    if (n > 0.05) { c.fillStyle = `rgba(20,20,50,${(n * 0.25).toFixed(3)})`; c.fillRect(0, 0, W, H); }
    fillRR(c, 40, 30, 520, 60, 30, 'rgba(255,252,244,0.95)');
    const floorTxt = HOUSES[lvl].upstairs ? (R.floor === 1 ? ' · 一楼' : ' · 二楼') : '';
    text(c, `我的${HOUSES[lvl].name}${floorTxt}`, 70, 61, 26, '#6a3f1f', 'left', 900);
    const here = this.roomList().find((f) => f.x === R.cx && f.y === R.cy);
    text(c, here ? FURN[here.id].name : '空位', 540, 61, 19, '#a8906a', 'right', 700);
    if (R.pick) {
      const furn = s.inv.filter((it) => it.k === 'furn');
      const pw = Math.min(1100, furn.length * 120 + 40), px = (W - pw) / 2, py = 560;
      fillRR(c, px, py, pw, 110, 24, '#fffaf0');
      furn.forEach((it, i) => {
        const x = px + 20 + i * 120;
        if (i === R.pick.sel) fillRR(c, x, py + 10, 110, 90, 18, '#ffe0b8');
        drawFurniture(c, it.id, x + 55, py + 80, 60, this.t);
        text(c, FURN[it.id].name, x + 55, py + 94, 13, '#6a3f1f', 'center', 700);
      });
      controlsBar(c, [['A', '摆在这里'], ['B', '取消']], 694);
    } else {
      const bar = [['A', here ? '收起' : '摆放家具'], ['Y', '睡觉'], ['B', '出门']];
      if (HOUSES[lvl].upstairs) bar.splice(2, 0, ['L', '上下楼']);
      controlsBar(c, bar, 694);
    }
  }

  // 标题页
  drawTitle(c) {
    const t = this.t;
    const cx = 1120 + Math.sin(t * 0.08) * 300, cy = 820 + Math.cos(t * 0.06) * 200;
    c.fillStyle = '#2f8fd0';
    c.fillRect(0, 0, W, H);
    c.save();
    const sc = 0.8;
    c.scale(sc, sc);
    c.translate(-(cx - W / sc / 2), -(cy - H / sc / 2));
    const vx = cx - W / sc / 2, vy = cy - H / sc / 2;
    c.drawImage(this.A.map, vx, vy, W / sc, H / sc, vx, vy, W / sc, H / sc);
    c.restore();
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,248,230,0.15)');
    g.addColorStop(1, 'rgba(40,70,40,0.55)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const a = easeOutBack(Math.min(1, this.modeT / 0.6));
    c.save();
    c.translate(W / 2, 200);
    c.scale(a, a);
    outlineText(c, '茶岛生活', 0, 0, 108, '#ffffff', '#2f6a3a', 16);
    c.restore();
    drawFruit(c, 'orange', W / 2 + 250, 150 + Math.sin(t * 2) * 6, 3);
    text(c, '钓鱼、捉虫、摇果子，在小岛上慢慢生活', W / 2, 290, 26, '#ffffff', 'center', 700);
    const opts = this.s ? [`继续生活（第 ${this.s.day} 天）`, '新的生活'] : ['开始新的生活'];
    opts.forEach((o, i) => {
      const y = 400 + i * 74;
      const sel = i === this.titleSel;
      fillRR(c, W / 2 - 220, y - 30, 440, 60, 30, sel ? '#ffffff' : 'rgba(255,255,255,0.35)');
      if (sel) glyph(c, 'A', W / 2 - 180, y, 14, '#ff7a1a', '#ffffff');
      text(c, o, W / 2 + (sel ? 14 : 0), y + 1, 26, sel ? '#3a5a2a' : '#ffffff', 'center', 800);
    });
    if (this.s) {
      const st = `茶币 ${fmt(this.s.coins)} · ${HOUSES[this.s.house].name} · 图鉴 ${Object.keys(this.s.caught).length} / ${DEX_TOTAL}`;
      text(c, st, W / 2, 400 + opts.length * 74 + 10, 20, '#ffffff', 'center', 700);
    }
    if (this.confirmNew) {
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.fillRect(0, 0, W, H);
      fillRR(c, W / 2 - 300, 230, 600, 260, 30, '#fffaf0');
      text(c, '开始新的生活？', W / 2, 290, 32, '#6a3f1f', 'center', 900);
      text(c, '现在的存档（茶币、房子、图鉴）会被清除。', W / 2, 340, 20, '#a8906a', 'center', 600);
      ['确定', '取消'].forEach((o, i) => {
        const x = W / 2 - 120 + i * 240;
        fillRR(c, x - 90, 400, 180, 56, 28, this.confirmSel === i ? '#ff8a3c' : '#f4e2c8');
        text(c, o, x, 429, 24, this.confirmSel === i ? '#ffffff' : '#8a5a2a', 'center', 800);
      });
    }
    controlsBar(c, [['STICK', '移动'], ['A', '互动'], ['B', '奔跑'], ['X', '背包'], ['Y', '图鉴'], ['L', '换工具']], 664);
  }
}

function circ2(c, x, y, r, fill, stroke) {
  c.fillStyle = fill;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.strokeStyle = stroke;
  c.lineWidth = 4;
  c.stroke();
}
function poly2(c, pts, color) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fill();
}

// 茶杯卡丁车：伪 3D（mode-7 式）卡丁车赛车。6 名原创水果 / 茶饮车手、3 条赛道、3 圈，
// 漂移攒火花加速、道具箱（鲜橙汁 / 茶叶包 / 红茶罐 / 薄荷冰霜）、AI 对手、小地图。
import { GameBase, drawTitleCard, Particles, promptLine } from './common.js';
import {
  W, H, clamp, lerp, text, textW, fillRR, strokeRR, outlineText, makeCanvas, axisX, easeOutBack, easeOutCubic, glyph,
} from '../ui.js';
import { TRACKS, MAP, STEP, CURB, VERGE, buildTrack, locate } from './kart/tracks.js';
import { CHARS, drawKart, drawFace, decoSprite, decoHeight, itemSprite, makeSky, drawSky } from './kart/art.js';
import { SONGS, JINGLE_WIN, JINGLE_LOSE } from './kart/songs.js';

const IW = 427, IH = 240, HOR = 80, GH = IH - HOR;   // 低分辨率地面缓冲；地平线所在行
const KX = W / IW, KY = H / IH;
const LAPS = 3;
const VMAX = 172;          // 最高速度（地图像素 / 秒）
const TURN = 2.2;          // 最大转向角速度（弧度 / 秒）
const KART_R = 4.6;
const ZFAR = 2600;
const TAU = Math.PI * 2;
const ITEM_NAMES = { juice: '鲜橙汁', bag: '茶叶包', can: '红茶罐', frost: '薄荷冰霜' };
const ITEM_POOL = ['juice', 'bag', 'can', 'frost'];
const SPARK = [null, '#4fc3ff', '#ff9a2e', '#c86bff'];
const RANK_COLOR = ['#ffd23a', '#e4e8ef', '#f0a060', '#ffffff', '#ffffff', '#ffffff'];

const wrapA = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const angDiff = (to, from) => wrapA(to - from);
const toward = (a, b, k) => a + angDiff(b, a) * Math.min(1, k);
function fmt(t) {
  if (!Number.isFinite(t) || t <= 0) return '—';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

function drawKartTile(c, s) {
  const k = s / 256;
  c.save();
  c.scale(k, k);
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#4fb0f0');
  g.addColorStop(0.42, '#d4eefa');
  g.addColorStop(0.42, '#58ad46');
  g.addColorStop(1, '#3f8f35');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  c.fillStyle = '#9cc8a8';
  c.beginPath();
  c.moveTo(0, 108);
  for (let x = 0; x <= 256; x += 16) c.lineTo(x, 100 - 14 * Math.sin(x / 30) - 8 * Math.sin(x / 11));
  c.lineTo(256, 108);
  c.fill();
  // 路面（透视梯形 + 路肩条纹）
  c.fillStyle = '#ffffff';
  c.beginPath(); c.moveTo(112, 108); c.lineTo(144, 108); c.lineTo(276, 256); c.lineTo(-20, 256); c.fill();
  c.fillStyle = '#ef4a3d';
  for (let i = 0; i < 6; i++) {
    const y0 = 108 + Math.pow(i / 6, 2) * 148, y1 = 108 + Math.pow((i + 0.5) / 6, 2) * 148;
    const l0 = 112 - (y0 - 108) * 0.89, l1 = 112 - (y1 - 108) * 0.89;
    c.beginPath(); c.moveTo(l0, y0); c.lineTo(l1, y1); c.lineTo(l1 + 8, y1); c.lineTo(l0 + 3, y0); c.fill();
    const r0 = 144 + (y0 - 108) * 0.89, r1 = 144 + (y1 - 108) * 0.89;
    c.beginPath(); c.moveTo(r0, y0); c.lineTo(r1, y1); c.lineTo(r1 - 8, y1); c.lineTo(r0 - 3, y0); c.fill();
  }
  c.fillStyle = '#8a8781';
  c.beginPath(); c.moveTo(116, 108); c.lineTo(140, 108); c.lineTo(262, 256); c.lineTo(-6, 256); c.fill();
  // 远处的对手
  drawKart(c, CHARS[2], 152, 128, 1.6, 0.25, 0.25, {});
  drawKart(c, CHARS[1], 104, 138, 2.2, -0.3, 0.25, {});
  // 加速火焰
  c.fillStyle = 'rgba(255,170,60,0.85)';
  c.beginPath(); c.ellipse(108, 196, 10, 6, 0, 0, TAU); c.ellipse(148, 196, 10, 6, 0, 0, TAU); c.fill();
  drawKart(c, CHARS[0], 128, 196, 7.4, 0.18, 0.32, { tilt: -0.03 });
  // 速度线
  c.strokeStyle = 'rgba(255,255,255,0.7)';
  c.lineWidth = 3;
  for (const [x0, y0, x1, y1] of [[10, 140, 50, 150], [12, 180, 56, 182], [246, 140, 206, 150], [244, 178, 200, 182]]) {
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
  outlineText(c, '茶杯卡丁车', 128, 226, 38, '#ffffff', '#b8401a', 9);
  c.restore();
}

// 引擎声：一个锯齿波 + 低通滤波；update 停止调用（暂停 / 退出）后会自己在 0.25 秒内静音
class Engine {
  constructor(sfx) { this.sfx = sfx; this.nodes = null; }
  _ensure() {
    const c = this.sfx.ctx;
    if (!c || !this.sfx.master) return null;
    if (!this.nodes) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      const o2 = c.createOscillator();
      o2.type = 'square';
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 2;
      const g = c.createGain();
      g.gain.value = 0;
      const g2 = c.createGain();
      g2.gain.value = 0.35;
      o.connect(f);
      o2.connect(g2);
      g2.connect(f);
      f.connect(g);
      g.connect(this.sfx.master);
      o.start();
      o2.start();
      this.nodes = { o, o2, f, g };
    }
    return c;
  }
  update(speed, boost, on) {
    const c = this._ensure();
    if (!c) return;
    const { o, o2, f, g } = this.nodes;
    const now = c.currentTime;
    const sp = clamp(Math.abs(speed), 0, 1.4);
    const fr = 48 + 92 * sp + (boost ? 18 : 0);
    o.frequency.setTargetAtTime(fr, now, 0.05);
    o2.frequency.setTargetAtTime(fr * 0.5, now, 0.05);
    f.frequency.setTargetAtTime(300 + 1500 * sp + (boost ? 900 : 0), now, 0.05);
    const vol = on ? 0.03 + 0.02 * sp : 0;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.05);
    g.gain.setValueAtTime(vol, now + 0.12);
    g.gain.linearRampToValueAtTime(0, now + 0.28);
  }
  stop() {
    if (!this.nodes) return;
    try {
      this.nodes.o.stop();
      this.nodes.o2.stop();
      this.nodes.g.disconnect();
    } catch (e) { /* 已停止 */ }
    this.nodes = null;
  }
}

export class Kart extends GameBase {
  static meta = { id: 'kart', name: '茶杯卡丁车', kind: 'game', color: '#ff7a1a', tile: drawKartTile };

  constructor(os) {
    super(os);
    this.trackIdx = clamp(Number(os.store.get('kart.track', 0)) | 0, 0, TRACKS.length - 1);
    this.charIdx = clamp(Number(os.store.get('kart.char', 0)) | 0, 0, CHARS.length - 1);
    this.gcv = makeCanvas(IW, GH);
    this.gctx = this.gcv.getContext('2d');
    this.gimg = this.gctx.createImageData(IW, GH);
    this.gbuf = new Uint32Array(this.gimg.data.buffer);
    this.parts = new Particles(500);
    this.engine = new Engine(this.sfx);
    this.drawList = [];
    this.navT = 0;
    this.setupRace(true);
    this.setMode('title');
    this._music();
  }

  // ———————————————————— 比赛初始化 ————————————————————
  setupRace(demo) {
    this.demo = demo;
    const T = (this.T = buildTrack(this.trackIdx));
    this.sky = makeSky(T.def.theme);
    const n = T.n;
    // 发车格：玩家排在第 5 位（最后一排），一路追上去更有意思
    const order = [0, 1, 2, 3, 4, 5].filter((i) => i !== this.charIdx);
    const chars = [];
    let ai = 0;
    for (let s = 0; s < 6; s++) chars[s] = demo ? s : s === 4 ? this.charIdx : order[ai++];
    this.racers = [];
    for (let s = 0; s < 6; s++) {
      const row = Math.floor(s / 2), col = s % 2;
      // 标题页的演示比赛：车分散在整条赛道上
      const idx = demo ? (n - 6 - s * Math.floor(n / 9)) % n : (n - 6 - row * 6) % n;
      const lat = (col ? 0.4 : -0.4) * T.w;
      const isPlayer = !demo && chars[s] === this.charIdx;
      const a = Math.atan2(T.ty[idx], T.tx[idx]);
      const skill = T.def.skill * (0.965 + (0.035 * ((s * 37) % 7)) / 6);
      this.racers.push({
        ch: CHARS[chars[s]], isPlayer, auto: !isPlayer,
        x: T.xs[idx] + T.rx[idx] * lat, y: T.ys[idx] + T.ry[idx] * lat, a, ma: a, v: 0, idx, lat,
        prog: idx - n, lapsDone: 0, lapStart: 0, lapTimes: [], finished: false, finishT: 0, finishOrder: 0,
        drift: 0, driftHeld: false, charge: 0, hop: 0, boostT: 0, spinT: 0, spinA: 0, frostT: 0, stallT: 0, ouch: 0,
        item: null, roulette: 0, rouletteTick: 0, wrongT: 0, onPad: false, rank: s + 1, startA: -1,
        skill: isPlayer ? 1 : skill, mul: 1,
        ai: { lane: (col ? 0.3 : -0.3), laneT: 1 + s * 0.4, useT: 0, wantDrift: false, startBoost: ((s * 5) % 3) !== 0 },
      });
    }
    this.player = this.racers.find((r) => r.isPlayer) || null;
    this.focusR = this.player || this.racers[0];
    this.camDist = demo ? 62 : 30;
    this.camH = demo ? 21 : 12.5;
    this.boxes = [];
    for (const row of T.itemRows) for (const b of row) this.boxes.push({ x: b.x, y: b.y, t: 0, i: b.i });
    this.objs = [];
    this.parts.clear();
    this.camA = this.focusR.a;
    this.focal = 300;
    this.shake = 0;
    this.raceT = 0;
    this.cd = demo ? -1 : 3.0;
    this.cdLast = 4;
    this.phase = demo ? 'race' : 'count';
    this.doneT = 0;
    this.finishCount = 0;
    this.msg = null;
    this.lapFlash = null;
    this.frostFlash = 0;
    this.finalLap = false;
    if (demo) for (const r of this.racers) r.v = VMAX * 0.6;
    this._camera(0);
  }

  start() {
    this.setupRace(false);
    this.setMode('play');
    this._music();
    this.sfx.play('confirm');
  }

  _music() {
    this.sfx.music.play(SONGS[this.T.def.theme], this, { rate: 1 });
  }

  close() {
    this.sfx.music.stop();
    this.engine.stop();
  }

  _best(trackIdx = this.trackIdx) {
    const v = Number(this.os.store.get('kart.best.' + TRACKS[trackIdx].id, 0));
    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  // ———————————————————— 主循环 ————————————————————
  update(dt, pad) {
    this.t += dt;
    this.modeT += dt;
    this.navT = Math.max(0, this.navT - dt);
    if (this.mode === 'title') {
      this._titleInput(pad);
      this._sim(dt, null);
      this.engine.update(0, false, false);
      return;
    }
    if (this.mode === 'result') {
      this._sim(dt, null);
      this.engine.update(0, false, false);
      if (this.modeT > 0.8) {
        if (pad.pressed.A) this.start();
        else if (pad.pressed.X) { this.trackIdx = (this.trackIdx + 1) % TRACKS.length; this.os.store.set('kart.track', this.trackIdx); this.start(); }
        else if (pad.pressed.B) { this.sfx.play('back'); this.setupRace(true); this.setMode('title'); this._music(); }
      }
      return;
    }
    // 比赛中
    if (this.phase === 'count') {
      const prev = this.cd;
      this.cd -= dt;
      const p = this.player;
      if (pad.down.A && p.startA < 0) p.startA = this.cd;
      if (!pad.down.A) p.startA = -1;
      const k = Math.ceil(this.cd);
      if (k !== this.cdLast && k >= 1 && k <= 3) { this.cdLast = k; this.sfx.chip('square', 523, 523, 0.18, 0.12); }
      if (this.cd <= 0 && prev > 0) this._go();
      this.engine.update(pad.down.A ? 0.5 + 0.2 * Math.sin(this.t * 30) : 0.05, false, true);
      this._sim(0, null);
      return;
    }
    this.raceT += dt;
    this._sim(dt, pad);
    const p = this.player;
    this.engine.update(p.v / VMAX, p.boostT > 0, true);
    if (this.phase === 'done') {
      this.doneT += dt;
      if (this.doneT > 3.6) this._toResult();
    }
  }

  _go() {
    this.phase = 'race';
    this.msg = { text: '开始！', t: 0, color: '#ffd23a' };
    this.sfx.chip('square', 1046, 1046, 0.5, 0.14);
    for (const r of this.racers) {
      r.lapStart = 0;
      if (r.isPlayer) {
        // 倒计时“2”过后、“1”快结束前按住油门 = 起步加速；按得太早会熄火
        if (r.startA > 0.25 && r.startA < 1.3) { r.boostT = 1.3; this.msg.sub = '完美起步！'; this.sfx.play('powerup'); }
        else if (r.startA >= 2.2) { r.stallT = 0.6; this.msg.sub = '起步太早，熄火了…'; }
      } else if (r.ai.startBoost) r.boostT = 0.8 + Math.random() * 0.4;
    }
  }

  _titleInput(pad) {
    let dx = 0, dy = 0;
    if (pad.pressed.LEFT) dx = -1;
    if (pad.pressed.RIGHT) dx = 1;
    if (pad.pressed.UP) dy = -1;
    if (pad.pressed.DOWN) dy = 1;
    if (!dx && !dy && this.navT <= 0) {
      if (Math.abs(pad.lx) > 0.65) dx = Math.sign(pad.lx);
      else if (Math.abs(pad.ly) > 0.65) dy = -Math.sign(pad.ly);
      if (dx || dy) this.navT = 0.3;
    }
    if (dx) {
      this.trackIdx = (this.trackIdx + dx + TRACKS.length) % TRACKS.length;
      this.os.store.set('kart.track', this.trackIdx);
      this.sfx.play('tick');
      this.setupRace(true);
      this._music();
    }
    if (dy) {
      this.charIdx = (this.charIdx + dy + CHARS.length) % CHARS.length;
      this.os.store.set('kart.char', this.charIdx);
      this.sfx.play('move');
    }
    if (pad.pressed.A && this.modeT > 0.3) this.start();
  }

  // ———————————————————— 模拟 ————————————————————
  _sim(dt, pad) {
    const T = this.T;
    this.parts.update(dt);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.frostFlash = Math.max(0, this.frostFlash - dt);
    if (this.msg) { this.msg.t += dt; if (!this.msg.long && this.msg.t > 1.6) this.msg = null; }
    if (this.lapFlash) { this.lapFlash.t += dt; if (this.lapFlash.t > 2.6) this.lapFlash = null; }
    for (const b of this.boxes) b.t = Math.max(0, b.t - dt);
    if (dt > 0) {
      // 名次
      const ord = this.racers.slice().sort((a, b) => (a.finished && b.finished ? a.finishOrder - b.finishOrder
        : a.finished ? -1 : b.finished ? 1 : b.prog - a.prog));
      ord.forEach((r, i) => { r.rank = i + 1; });
      this.order = ord;
      const steps = Math.max(1, Math.ceil(dt / 0.02));
      const h = dt / steps;
      for (let s = 0; s < steps; s++) {
        for (const r of this.racers) {
          const ctl = r.auto ? this._ai(r, h) : this._playerCtl(r, pad);
          this._step(r, ctl, h);
        }
        this._collide();
        this._objects(h);
      }
    }
    this._camera(dt);
  }

  _playerCtl(r, pad) {
    if (!pad) return { steer: 0, thr: false, brk: false, drift: false, use: false };
    return {
      steer: axisX(pad), thr: !!pad.down.A, brk: !!pad.down.B,
      drift: !!(pad.down.R || pad.down.ZR), use: !!(pad.pressed.L || pad.pressed.ZL),
    };
  }

  _step(r, ctl, dt) {
    const T = this.T, n = T.n;
    let { steer, thr, brk } = ctl;
    r.ouch = Math.max(0, r.ouch - dt);
    if (r.spinT > 0) {
      r.spinT -= dt;
      r.spinA += dt * 15;
      thr = brk = false;
      steer = 0;
      r.v *= Math.exp(-2.8 * dt);
      if (r.spinT <= 0) r.spinA = 0;
    }
    if (r.stallT > 0) { r.stallT -= dt; thr = false; }
    if (r.frostT > 0) r.frostT -= dt;
    const off = Math.abs(r.lat) > T.w + CURB - 1;
    // —— 速度 ——
    let vt = VMAX * r.skill * r.mul;
    if (off) vt *= r.boostT > 0 ? 0.85 : 0.42;
    if (r.frostT > 0) vt *= 0.5;
    if (r.boostT > 0) {
      r.boostT -= dt;
      vt = Math.max(vt, VMAX * 1.34 * (off ? 0.86 : 1));
      thr = true;
    }
    if (thr) {
      if (r.v < vt) r.v += ((vt - r.v) * (r.boostT > 0 ? 3.4 : 0.95) + 6) * dt;
      else r.v += (vt - r.v) * 2.4 * dt;
    } else if (brk) {
      if (r.v > 0) r.v = Math.max(-1, r.v - 240 * dt);
      else r.v = Math.max(-44, r.v - 70 * dt);
    } else {
      r.v *= Math.exp(-0.75 * dt);
      if (Math.abs(r.v) > vt) r.v += (vt * Math.sign(r.v) - r.v) * 2.4 * dt;
    }
    // —— 漂移 ——
    const pressed = ctl.drift && !r.driftHeld;
    r.driftHeld = ctl.drift;
    if (pressed && r.spinT <= 0 && r.v > 40) {
      r.hop = 0.22;
      if (r.isPlayer) this.sfx.chip('p25', 300, 520, 0.1, 0.07);
    }
    if (!r.drift && ctl.drift && r.hop > 0.05 && Math.abs(steer) > 0.3 && r.v > 55 && r.spinT <= 0) {
      r.drift = Math.sign(steer);
      r.charge = 0;
    }
    let turn;
    if (r.drift) {
      if (!ctl.drift || r.v < 35 || r.spinT > 0) {
        const lvl = this._sparkLevel(r);
        if (lvl && r.spinT <= 0) {
          r.boostT = Math.max(r.boostT, [0, 0.55, 1.0, 1.6][lvl]);
          if (r.isPlayer) { this.sfx.noise(0.35, 0.18, 'bandpass', 900, 2600); this.sfx.chip('square', 660, 990, 0.12, 0.06); }
        }
        r.drift = 0;
        r.charge = 0;
        turn = 0;
      } else {
        const k = clamp(steer * r.drift, -1, 1);
        turn = r.drift * TURN * (0.6 + 0.45 * k) * 1.05;
        r.charge += dt * (off ? 0.2 : 0.8 + 0.6 * Math.max(0, k));
      }
    }
    if (!r.drift) {
      const sp = clamp(Math.abs(r.v) / 70, 0, 1);
      turn = steer * TURN * sp * Math.sign(r.v || 1) * (1 - 0.2 * clamp(r.v / VMAX, 0, 1.3));
    }
    if (r.spinT > 0) turn = 0;
    if (r.frostT > 0) turn *= 0.7;
    r.a = wrapA(r.a + turn * dt);
    const grip = r.drift ? 2.6 : off ? 5 : 9;
    r.ma = wrapA(toward(r.ma, r.a, grip * dt));
    if (r.hop > 0) r.hop -= dt;
    // —— 移动 ——
    r.x += Math.cos(r.ma) * r.v * dt;
    r.y += Math.sin(r.ma) * r.v * dt;
    const [idx, lat] = locate(T, r.x, r.y, r.idx);
    let di = idx - r.idx;
    if (di < -n / 2) di += n;
    else if (di > n / 2) di -= n;
    r.prog += di;
    r.idx = idx;
    r.lat = lat;
    // —— 墙 ——
    const lim = T.w + VERGE;
    if (Math.abs(lat) > lim) {
      const s = Math.sign(lat);
      const nx = T.rx[idx] * s, ny = T.ry[idx] * s;
      const push = Math.abs(lat) - lim;
      r.x -= nx * push;
      r.y -= ny * push;
      r.lat = lim * s;
      const vx = Math.cos(r.ma) * r.v, vy = Math.sin(r.ma) * r.v;
      const vn = vx * nx + vy * ny;
      if (vn > 0) {
        const wx = vx - nx * vn * 1.35, wy = vy - ny * vn * 1.35;
        const sp2 = Math.hypot(wx, wy);
        if (sp2 > 1) r.ma = r.v >= 0 ? Math.atan2(wy, wx) : Math.atan2(-wy, -wx);
        r.v = Math.sign(r.v || 1) * sp2 * 0.8;
        r.a = wrapA(r.a - s * 0.06);
        r.drift = 0;
        r.charge = 0;
        if (r.isPlayer && vn > 25) { this.shake = Math.min(1, vn / 120); this.sfx.play('bounce', { f: 160 }); this.sfx.noise(0.12, 0.2, 'lowpass', 900); }
      }
    }
    // —— 加速带 ——
    let onPad = false;
    for (const b of T.boosts) {
      const k = (idx - b.i0 + n) % n;
      if (k < b.len && Math.abs(r.lat - b.lat) < b.half + 3) { onPad = true; break; }
    }
    if (onPad) {
      if (r.boostT < 0.9) r.boostT = 0.9;
      if (!r.onPad && r.isPlayer) { this.sfx.noise(0.4, 0.2, 'bandpass', 700, 2800); this.sfx.chip('square', 523, 1046, 0.14, 0.06); }
    }
    r.onPad = onPad;
    // —— 道具箱 ——
    for (const b of this.boxes) {
      if (b.t > 0) continue;
      const dx = r.x - b.x, dy = r.y - b.y;
      if (dx * dx + dy * dy < 49) {
        b.t = 2.6;
        if (!r.item && r.roulette <= 0) {
          r.roulette = r.isPlayer ? 1.1 : 0.9;
          r.pending = this._pickItem(r.rank);
        }
        if (r.isPlayer) this.sfx.play('coin');
      }
    }
    if (r.roulette > 0) {
      r.roulette -= dt;
      if (r.isPlayer) {
        r.rouletteTick -= dt;
        if (r.rouletteTick <= 0 && r.roulette > 0) { r.rouletteTick = 0.08; this.sfx.play('tick'); }
      }
      if (r.roulette <= 0) {
        r.item = r.pending;
        r.ai.useT = 0.6 + Math.random() * 2.5;
        if (r.isPlayer) this.sfx.chip('triangle', 880, 1320, 0.12, 0.12);
      }
    }
    if (ctl.use && r.item && r.spinT <= 0) this._useItem(r);
    // —— 圈数 ——
    if (!this.demo && this.phase !== 'count') {
      const laps = Math.floor(r.prog / n);
      if (laps > r.lapsDone && laps >= 1) {
        r.lapsDone = laps;
        const lt = this.raceT - r.lapStart;
        r.lapStart = this.raceT;
        r.lapTimes.push(lt);
        if (r.lapsDone >= LAPS && !r.finished) {
          r.finished = true;
          r.finishT = this.raceT;
          r.finishOrder = ++this.finishCount;
          if (r.isPlayer) this._playerFinished(r);
        } else if (r.isPlayer) {
          this.lapFlash = { text: `第 ${r.lapsDone} 圈  ${fmt(lt)}`, t: 0 };
          if (r.lapsDone === LAPS - 1) {
            this.msg = { text: '最后一圈！', t: 0, color: '#ff6a3d' };
            this.sfx.play('oneup');
            this.sfx.music.rate = 1.12;
            this.finalLap = true;
          } else this.sfx.play('checkpoint');
        }
      }
    }
    // —— 逆行 ——
    const dot = Math.cos(r.a) * T.tx[idx] + Math.sin(r.a) * T.ty[idx];
    r.wrongT = dot < -0.35 && r.v > 15 ? r.wrongT + dt : 0;
    // —— 粒子（只给镜头跟着的车）——
    if (r === this.focusR && dt > 0) this._kartFx(r, off);
  }

  _sparkLevel(r) {
    return r.charge >= 3.0 ? 3 : r.charge >= 1.8 ? 2 : r.charge >= 0.9 ? 1 : 0;
  }

  _pickItem(rank) {
    const w = rank <= 1 ? [30, 60, 10, 0] : rank <= 3 ? [35, 30, 35, 0] : rank <= 5 ? [40, 10, 40, 10] : [35, 5, 35, 25];
    let x = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < 4; i++) { x -= w[i]; if (x < 0) return ITEM_POOL[i]; }
    return 'juice';
  }

  _useItem(r) {
    const it = r.item;
    r.item = null;
    const ca = Math.cos(r.a), sa = Math.sin(r.a);
    if (it === 'juice') {
      r.boostT = Math.max(r.boostT, 1.6);
      if (this._near(r)) this.sfx.play('powerup');
    } else if (it === 'bag') {
      this.objs.push({ type: 'bag', x: r.x - ca * 11, y: r.y - sa * 11, owner: r, t: 0, life: 45 });
      if (this._near(r)) this.sfx.play('slide');
    } else if (it === 'can') {
      const ahead = this.order ? this.order[r.rank - 2] : null;
      this.objs.push({ type: 'can', x: r.x + ca * 10, y: r.y + sa * 10, idx: r.idx, lat: r.lat, prog: r.prog, owner: r, target: ahead || null,
        t: 0, life: 9, sp: Math.max(r.v + 80, 250), a: r.a });
      if (this._near(r)) this.sfx.play('laser');
    } else if (it === 'frost') {
      let hitPlayer = false;
      for (const o of this.racers) {
        if (o === r || o.rank >= r.rank || o.finished) continue;
        o.frostT = 2.8;
        o.v *= 0.7;
        o.drift = 0;
        if (o.isPlayer) hitPlayer = true;
      }
      if (hitPlayer || r.isPlayer) {
        this.frostFlash = 0.6;
        this.sfx.tone('sine', 1760, 880, 0.5, 0.12);
        this.sfx.tone('sine', 2637, 1318, 0.4, 0.06, 0.05);
      }
      if (hitPlayer) this.msg = { text: '被冻住了！', t: 0, color: '#8fe8ff' };
    }
  }

  _near(r) {
    const f = this.focusR;
    return r === f || Math.hypot(r.x - f.x, r.y - f.y) < 220;
  }

  _spin(r) {
    if (r.spinT > 0) return;
    r.spinT = 1.05;
    r.spinA = 0;
    r.drift = 0;
    r.charge = 0;
    r.v *= 0.5;
    r.ouch = 1.6;
    if (r.isPlayer) { this.sfx.play('hurt'); this.shake = 0.6; }
    else if (this._near(r)) this.sfx.play('hit');
  }

  _collide() {
    const L = this.racers;
    for (let i = 0; i < L.length; i++) {
      for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const R = KART_R * 2;
        if (d2 >= R * R || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        const push = (R - d) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rel = (Math.cos(a.ma) * a.v - Math.cos(b.ma) * b.v) * nx + (Math.sin(a.ma) * a.v - Math.sin(b.ma) * b.v) * ny;
        if (rel > 0) {
          // 互相顶一下：快的减速，慢的被推着走
          const k = rel * 0.35;
          a.v = Math.max(0, a.v - k);
          b.v += k * 0.5;
          if ((a.isPlayer || b.isPlayer) && rel > 25) { this.sfx.play('bounce', { f: 220 }); this.shake = Math.max(this.shake, 0.3); }
        }
      }
    }
  }

  _objects(dt) {
    const T = this.T, n = T.n;
    for (const o of this.objs) {
      if (o.dead) continue;
      o.t += dt;
      if (o.t > o.life) { o.dead = true; continue; }
      if (o.type === 'can') {
        let tx, ty;
        const tg = o.target;
        const gap = tg ? (tg.prog - o.prog) * STEP : 0;
        if (tg && !tg.finished && gap < 140 && gap > -30) { tx = tg.x; ty = tg.y; }
        else {
          const j = (o.idx + 6) % n;
          const lat = tg ? clamp(tg.lat, -T.w * 0.7, T.w * 0.7) : o.lat * 0.9;
          tx = T.xs[j] + T.rx[j] * lat; ty = T.ys[j] + T.ry[j] * lat;
        }
        const want = Math.atan2(ty - o.y, tx - o.x);
        o.a = toward(o.a, want, 9 * dt);
        o.x += Math.cos(o.a) * o.sp * dt;
        o.y += Math.sin(o.a) * o.sp * dt;
        const [idx, lat] = locate(T, o.x, o.y, o.idx);
        let di = idx - o.idx;
        if (di < -n / 2) di += n; else if (di > n / 2) di -= n;
        o.prog += di;
        o.idx = idx;
        o.lat = lat;
        if (Math.abs(lat) > T.w + VERGE) { o.dead = true; continue; }
      }
      // 碰撞
      const rad = o.type === 'can' ? 7 : 6.5;
      let hit = false;
      for (const r of this.racers) {
        if (o.type === 'can' && r === o.owner && o.t < 0.8) continue;
        if (o.type === 'bag' && r === o.owner && o.t < 0.6) continue;
        const dx = r.x - o.x, dy = r.y - o.y;
        if (dx * dx + dy * dy < rad * rad) {
          this._spin(r);
          hit = true;
          if (this._near(r)) {
            const pp = this._proj(o.x, o.y);
            if (pp) this.parts.emit(pp.sx, pp.sy - 10, 18, { color: o.type === 'can' ? ['#e8463c', '#ffd36b', '#fff'] : ['#5b8f3a', '#f2e8cf'], speed: 260, life: 0.6, size: 7, gravity: 500 });
          }
          break;
        }
      }
      if (hit) { o.dead = true; continue; }
      // 红茶罐撞上茶叶包：两个一起消失
      if (o.type === 'can') {
        for (const q of this.objs) {
          if (q.dead || q.type !== 'bag') continue;
          if ((q.x - o.x) ** 2 + (q.y - o.y) ** 2 < 100) { q.dead = o.dead = true; break; }
        }
      }
    }
    if (this.objs.some((o) => o.dead)) this.objs = this.objs.filter((o) => !o.dead);
  }

  // ———————————————————— AI ————————————————————
  _ai(r, dt) {
    const T = this.T, n = T.n;
    const A = r.ai;
    // 橡皮筋：落后太多就快一点，领先太多就慢一点
    const ref = this.player && !this.player.finished ? this.player : null;
    if (ref && !this.demo) r.mul = 1 + clamp(((ref.prog - r.prog) * STEP) / 1700, -0.07, 0.11);
    else r.mul = 1;
    A.laneT -= dt;
    if (A.laneT <= 0) { A.lane = (Math.random() - 0.5) * 0.9; A.laneT = 2 + Math.random() * 3; }
    let cs = 0, cn = 0;
    for (let k = 4; k < 32; k++) cs += T.curv[(r.idx + k) % n];
    for (let k = 1; k < 12; k++) cn += T.curv[(r.idx + k) % n];
    const look = 9 + Math.round(Math.max(0, r.v) * 0.1);
    const j = (r.idx + look) % n;
    let off = A.lane * T.w * 0.55 + clamp(cs * 30, -T.w * 0.6, T.w * 0.6);
    // 躲开路上的茶叶包
    for (const o of this.objs) {
      if (o.type !== 'bag') continue;
      const dx = o.x - r.x, dy = o.y - r.y;
      const ahead = dx * Math.cos(r.a) + dy * Math.sin(r.a);
      if (ahead < 0 || ahead > 60) continue;
      const side = -dx * Math.sin(r.a) + dy * Math.cos(r.a);
      if (Math.abs(side) < 12) off += side > 0 ? -16 : 16;
    }
    off = clamp(off, -T.w * 0.8, T.w * 0.8);
    const tx = T.xs[j] + T.rx[j] * off, ty = T.ys[j] + T.ry[j] * off;
    const want = Math.atan2(ty - r.y, tx - r.x);
    const d = angDiff(want, r.a);
    const steer = clamp(d * 2.6, -1, 1);
    // 漂移：前面是大弯就跳起来漂，弯快结束时松开拿加速
    let drift;
    if (r.drift) drift = !(Math.abs(cn) < 0.1 || Math.sign(cn) !== r.drift);
    // 上一帧还按着就先松开，下一帧才算一次新的“按下”
    else drift = !r.driftHeld && Math.abs(cs) > 0.5 && r.v > VMAX * 0.66 && Math.sign(cs) === Math.sign(steer) && Math.abs(steer) > 0.3;
    // 道具
    let use = false;
    if (r.item) {
      A.useT -= dt;
      if (r.item === 'frost') use = true;
      else if (A.useT <= 0) {
        if (r.item === 'juice') use = Math.abs(cs) < 0.3 || A.useT < -3;
        else if (r.item === 'bag') use = this.racers.some((o) => o !== r && r.prog - o.prog > 0 && r.prog - o.prog < 14) || A.useT < -6;
        else if (r.item === 'can') use = r.rank > 1 || A.useT < -4;
      }
    }
    return { steer, thr: Math.abs(d) < 1.3 || r.v < 40, brk: Math.abs(d) > 1.3 && r.v > 60, drift, use };
  }

  _playerFinished(r) {
    this.phase = 'done';
    this.doneT = 0;
    r.auto = true;
    const good = r.finishOrder <= 3;
    this.msg = { text: '完成！', t: -0.4, color: good ? '#ffd23a' : '#ffffff', sub: `第 ${r.finishOrder} 名`, long: true };
    this.sfx.music.play(good ? JINGLE_WIN : JINGLE_LOSE, this, { loop: false });
    this.sfx.play(good ? 'win' : 'checkpoint');
  }

  _toResult() {
    // 还没跑完的对手按当前进度估一个成绩
    const p = this.player;
    for (const r of this.racers) {
      if (r.finished) continue;
      const left = Math.max(0, LAPS * this.T.n - r.prog) * STEP;
      r.estT = this.raceT + left / (VMAX * 0.85);
    }
    const ord = this.racers.slice().sort((a, b) => (a.finished ? a.finishT : a.estT) - (b.finished ? b.finishT : b.estT));
    this.final = ord;
    const key = 'kart.best.' + this.T.def.id;
    const best = this._best();
    this.newBest = !best || p.finishT < best;
    if (this.newBest) this.os.store.set(key, Number(p.finishT.toFixed(2)));
    this.bestShown = this._best();
    this.msg = null;
    this.lapFlash = null;
    this.setMode('result');
  }

  // ———————————————————— 镜头 / 投影 ————————————————————
  _camera(dt) {
    const p = this.focusR;
    const k = clamp(dt * 6, 0, 1);
    const want = p.v < -5 ? p.a : wrapA(p.ma + angDiff(p.a, p.ma) * 0.4);
    this.camA = wrapA(toward(this.camA, want, dt > 0 ? k : 1));
    const spd = clamp(p.v / VMAX, 0, 1.4);
    const ft = 300 - 34 * spd - (p.boostT > 0 ? 26 : 0);
    this.focal = lerp(this.focal, ft, clamp(dt * 4, 0, 1));
    const dist = this.camDist + spd * 2;
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 3 : 0;
    this.camX = p.x - Math.cos(this.camA) * dist + Math.sin(this.camA) * sx;
    this.camY = p.y - Math.sin(this.camA) * dist - Math.cos(this.camA) * sx;
    this.fx = Math.cos(this.camA);
    this.fy = Math.sin(this.camA);
  }

  _proj(x, y, out = {}) {
    const dx = x - this.camX, dy = y - this.camY;
    const f = dx * this.fx + dy * this.fy;
    if (f < 3) return null;
    const side = -dx * this.fy + dy * this.fx;
    const s = this.focal / f;
    out.f = f;
    out.sx = (IW / 2 + side * s) * KX;
    out.sy = (HOR + this.camH * s) * KY;
    out.s = s * KX;
    return out;
  }

  // ———————————————————— 绘制 ————————————————————
  _renderGround() {
    const T = this.T;
    const buf = this.gbuf, tex = T.tex, m1 = T.mip1, m2 = T.mip2, tile = T.tile;
    const fx = this.fx, fy = this.fy, rx = -fy, ry = fx;
    const f = this.focal, h = this.camH, half = IW / 2;
    const fog = 0xff000000 | (T.fog[2] << 16) | (T.fog[1] << 8) | T.fog[0];
    for (let j = 0; j < GH; j++) {
      const z = (h * f) / (j + 0.5);
      const row = j * IW;
      if (z > ZFAR) { buf.fill(fog, row, row + IW); continue; }
      const k = z / f;
      let wx = this.camX + fx * z + rx * (0.5 - half) * k;
      let wy = this.camY + fy * z + ry * (0.5 - half) * k;
      const dx = rx * k, dy = ry * k;
      const sh = k < 1.4 ? 0 : k < 2.8 ? 1 : 2;
      const src = sh === 0 ? tex : sh === 1 ? m1 : m2;
      const size = MAP >> sh;
      for (let i = 0; i < IW; i++) {
        if (wx >= 0 && wy >= 0 && wx < MAP && wy < MAP) buf[row + i] = src[((wy | 0) >> sh) * size + ((wx | 0) >> sh)];
        else buf[row + i] = tile[(((wy | 0) & 63) << 6) | ((wx | 0) & 63)];
        wx += dx;
        wy += dy;
      }
    }
    this.gctx.putImageData(this.gimg, 0, 0);
  }

  draw(c) {
    const T = this.T, th = T.th;
    const horY = HOR * KY;
    drawSky(c, this.sky, th, this.camA, this.focal * KX, horY, W);
    this._renderGround();
    c.imageSmoothingEnabled = false;
    c.drawImage(this.gcv, 0, 0, IW, GH, 0, horY, W, H - horY);
    c.imageSmoothingEnabled = true;
    // 地平线雾
    const fg = c.createLinearGradient(0, horY - 2, 0, horY + 70);
    const [fr, fgc, fb] = T.fog;
    fg.addColorStop(0, `rgba(${fr},${fgc},${fb},1)`);
    fg.addColorStop(1, `rgba(${fr},${fgc},${fb},0)`);
    c.fillStyle = fg;
    c.fillRect(0, horY - 2, W, 72);
    this._drawSprites(c);
    this.parts.draw(c);
    this._speedLines(c);
    if (this.frostFlash > 0) {
      c.fillStyle = `rgba(160,235,255,${(this.frostFlash * 0.5).toFixed(3)})`;
      c.fillRect(0, 0, W, H);
    }
    if (this.mode === 'title') this._drawTitle(c);
    else {
      this._drawHud(c);
      if (this.mode === 'result') this._drawResult(c);
    }
  }

  _drawSprites(c) {
    const L = this.drawList;
    let n = 0;
    const push = (f, kind, ref, p) => {
      let e = L[n];
      if (!e) { e = {}; L[n] = e; }
      e.f = f; e.kind = kind; e.ref = ref; e.sx = p.sx; e.sy = p.sy; e.s = p.s;
      n++;
    };
    const tmp = {};
    for (const d of this.T.decos) {
      const p = this._proj(d.x, d.y, tmp);
      if (!p || p.f > 1700 || p.sx < -300 || p.sx > W + 300) continue;
      push(p.f, 0, d, p);
    }
    for (const b of this.boxes) {
      if (b.t > 0) continue;
      const p = this._proj(b.x, b.y, tmp);
      if (!p || p.f > 1400 || p.sx < -100 || p.sx > W + 100) continue;
      push(p.f, 1, b, p);
    }
    for (const o of this.objs) {
      const p = this._proj(o.x, o.y, tmp);
      if (!p || p.f > 1400 || p.sx < -100 || p.sx > W + 100) continue;
      push(p.f, 2, o, p);
    }
    for (const r of this.racers) {
      const p = this._proj(r.x, r.y, tmp);
      if (!p || p.f > 1800 || p.sx < -200 || p.sx > W + 200) continue;
      push(p.f, 3, r, p);
    }
    const list = L.slice(0, n).sort((a, b) => b.f - a.f);
    for (const e of list) {
      const fade = clamp(1 - (e.f - 1100) / 600, 0, 1);
      if (fade <= 0) continue;
      c.globalAlpha = fade;
      if (e.kind === 0) {
        const d = e.ref;
        const img = decoSprite(d.type);
        const hh = decoHeight(d.type) * d.s * e.s;
        const ww = (hh * img.width) / img.height;
        if (hh < 1.5) continue;
        c.drawImage(img, e.sx - ww / 2, e.sy - hh, ww, hh);
      } else if (e.kind === 1) {
        const img = itemSprite('box');
        const sz = 8 * e.s;
        const bob = Math.sin(this.t * 3 + e.ref.i) * 0.8 * e.s;
        c.fillStyle = 'rgba(0,0,0,0.18)';
        c.beginPath(); c.ellipse(e.sx, e.sy, sz * 0.4, sz * 0.12, 0, 0, TAU); c.fill();
        const wob = 1 + 0.06 * Math.sin(this.t * 5 + e.ref.i);
        c.drawImage(img, e.sx - (sz * wob) / 2, e.sy - sz * 1.45 + bob, sz * wob, sz);
      } else if (e.kind === 2) {
        const o = e.ref;
        const img = itemSprite(o.type);
        const sz = (o.type === 'can' ? 7 : 6) * e.s;
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.beginPath(); c.ellipse(e.sx, e.sy, sz * 0.45, sz * 0.13, 0, 0, TAU); c.fill();
        const lift = o.type === 'can' ? (1.2 + Math.sin(o.t * 12) * 0.4) * e.s : 0;
        c.drawImage(img, e.sx - sz / 2, e.sy - sz - lift, sz, sz);
      } else {
        this._drawRacer(c, e.ref, e);
      }
    }
    c.globalAlpha = 1;
  }

  _drawRacer(c, r, e) {
    const dx = r.x - this.camX, dy = r.y - this.camY;
    const phi = wrapA(r.a + r.spinA - Math.atan2(dy, dx));
    const elev = Math.atan2(this.camH, e.f);
    const s = e.s;
    const hop = r.hop > 0 ? Math.sin((r.hop / 0.22) * Math.PI) * 2.2 : 0;
    // 影子
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath();
    c.ellipse(e.sx, e.sy + 0.5 * s, 6.4 * s, 2.4 * s, 0, 0, TAU);
    c.fill();
    // 加速火焰（车尾）
    if (r.boostT > 0 && s > 1) {
      const bx = e.sx - Math.sin(phi) * 6 * s, by = e.sy - Math.cos(phi) * Math.sin(elev) * 6 * s - 1.6 * s;
      const fl = 0.8 + 0.3 * Math.sin(this.t * 40 + r.x);
      const gr = c.createRadialGradient(bx, by, 0, bx, by, 4.5 * s * fl);
      gr.addColorStop(0, 'rgba(255,255,220,0.95)');
      gr.addColorStop(0.4, 'rgba(255,170,60,0.8)');
      gr.addColorStop(1, 'rgba(255,90,40,0)');
      c.fillStyle = gr;
      c.beginPath(); c.arc(bx, by, 4.5 * s * fl, 0, TAU); c.fill();
    }
    const tilt = r.drift ? -r.drift * 0.05 : 0;
    drawKart(c, r.ch, e.sx, e.sy, s, phi, elev, { z: hop, tilt, ouch: r.ouch > 0 });
    if (r.frostT > 0) {
      c.fillStyle = 'rgba(170,235,255,0.35)';
      c.beginPath(); c.ellipse(e.sx, e.sy - 5 * s, 8 * s, 7 * s, 0, 0, TAU); c.fill();
    }
    // 漂移火花（车后轮两侧）
    const lvl = r.drift ? this._sparkLevel(r) : 0;
    if (r.drift && s > 1) {
      const col = SPARK[lvl] || 'rgba(255,255,255,0.7)';
      for (const side of [-1, 1]) {
        const wx = Math.cos(phi) * side * 4.6 - Math.sin(phi) * 4.2;
        const px = e.sx + wx * s, py = e.sy + 0.2 * s;
        c.fillStyle = col;
        for (let i = 0; i < 3; i++) {
          const a = this.t * 50 + i * 2.1 + side;
          c.beginPath();
          c.arc(px + Math.cos(a) * 1.5 * s, py - Math.abs(Math.sin(a)) * 1.6 * s, (lvl ? 0.7 : 0.4) * s, 0, TAU);
          c.fill();
        }
      }
    }
    // 名字牌（近处的对手）
    if (!r.isPlayer && e.f < 260 && this.mode !== 'title') {
      const y = e.sy - 13 * s;
      const label = r.ch.name;
      const w = textW(c, label, 16, 700) + 16;
      c.globalAlpha *= 0.85;
      fillRR(c, e.sx - w / 2, y - 13, w, 26, 13, 'rgba(0,0,0,0.45)');
      text(c, label, e.sx, y + 1, 16, '#ffffff', 'center', 700);
      c.globalAlpha = 1;
    }
  }

  _kartFx(r, off) {
    const p = this._proj(r.x, r.y);
    if (!p) return;
    const back = p.sy + 0.5 * p.s;
    if (r.drift) {
      const lvl = this._sparkLevel(r);
      if (lvl) {
        for (const side of [-1, 1]) {
          if (Math.random() < 0.7) this.parts.emit(p.sx + side * 4.6 * p.s, back, 1, { color: [SPARK[lvl], '#ffffff'], speed: 160, life: 0.3, size: 5, angle: -Math.PI / 2 + side * 0.9, spread: 1.4, gravity: 600 });
        }
      }
    }
    if (off && Math.abs(r.v) > 30 && Math.random() < 0.6) {
      const col = this.T.def.theme === 'beach' ? ['#e8cf88', '#f6e6b4'] : this.T.def.theme === 'night' ? ['#6a5a8a', '#9a88c0'] : ['#8a6a3a', '#7dcb61'];
      this.parts.emit(p.sx + (Math.random() - 0.5) * 10 * p.s, back, 1, { color: col, speed: 90, life: 0.5, size: 8, angle: -Math.PI / 2, spread: 2, drag: 2, shape: 'circle' });
    }
    if (r.boostT > 0 && Math.random() < 0.5) {
      this.parts.emit(p.sx + (Math.random() - 0.5) * 3 * p.s, back - 2 * p.s, 1, { color: ['#ffd36b', '#ff8a1c', '#ffffff'], speed: 120, life: 0.25, size: 6, angle: Math.PI / 2, spread: 1.2 });
    }
  }

  _speedLines(c) {
    const p = this.focusR;
    const k = clamp((p.v / VMAX - 0.85) * 4, 0, 1) + (p.boostT > 0 ? 0.6 : 0);
    if (k <= 0.05 || this.mode === 'title') return;
    c.save();
    c.strokeStyle = `rgba(255,255,255,${Math.min(0.55, k * 0.4).toFixed(3)})`;
    c.lineWidth = 3;
    const seed = Math.floor(this.t * 30);
    for (let i = 0; i < 18; i++) {
      const h = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
      const r1 = h - Math.floor(h);
      const a = r1 * TAU;
      const R0 = 420 + ((i * 97) % 120), R1 = R0 + 160 + r1 * 140;
      const cx = W / 2, cy = HOR * KY + 40;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * R0 * 1.4, cy + Math.sin(a) * R0 * 0.8);
      c.lineTo(cx + Math.cos(a) * R1 * 1.4, cy + Math.sin(a) * R1 * 0.8);
      c.stroke();
    }
    c.restore();
  }

  _drawHud(c) {
    const p = this.player;
    if (!p) return;
    // 道具栏（左上）
    const ix = 36, iy = 28, isz = 112;
    fillRR(c, ix, iy, isz, isz, 22, 'rgba(0,0,0,0.42)');
    strokeRR(c, ix + 3, iy + 3, isz - 6, isz - 6, 19, 'rgba(255,255,255,0.9)', 4);
    let name = '';
    if (p.roulette > 0) {
      const k = Math.floor(this.t * 14) % 4;
      c.drawImage(itemSprite(ITEM_POOL[k]), ix + 16, iy + 16, isz - 32, isz - 32);
    } else if (p.item) {
      const pulse = 1 + 0.05 * Math.sin(this.t * 8);
      const s2 = (isz - 28) * pulse;
      c.drawImage(itemSprite(p.item), ix + isz / 2 - s2 / 2, iy + isz / 2 - s2 / 2, s2, s2);
      name = ITEM_NAMES[p.item];
    }
    if (name) {
      outlineText(c, name, ix + isz / 2, iy + isz + 20, 20, '#ffffff', 'rgba(0,0,0,0.6)', 5);
      glyph(c, 'L', ix + isz + 22, iy + isz - 18, 13, '#ffffff', '#222');
    }
    // 圈数 + 用时（右上）
    const lap = clamp(Math.floor(Math.max(0, p.prog) / this.T.n) + 1, 1, LAPS);
    outlineText(c, `第 ${lap}/${LAPS} 圈`, W - 40, 52, 34, this.finalLap ? '#ffb36b' : '#ffffff', 'rgba(0,0,0,0.6)', 7, 'right', 900);
    const tt = p.finished ? p.finishT : this.raceT;
    outlineText(c, tt > 0 ? fmt(tt) : '0:00.00', W - 40, 98, 32, '#ffffff', 'rgba(0,0,0,0.6)', 7, 'right', 800);
    if (this.lapFlash) {
      const a = clamp(Math.min(this.lapFlash.t * 4, (2.6 - this.lapFlash.t) * 3), 0, 1);
      c.globalAlpha = a;
      outlineText(c, this.lapFlash.text, W - 40, 140, 24, '#ffe28a', 'rgba(0,0,0,0.6)', 6, 'right', 800);
      c.globalAlpha = 1;
    }
    // 名次（右下）
    const rank = p.finished ? p.finishOrder : p.rank;
    c.save();
    c.translate(W - 120, H - 92);
    const pop = this._rankPop ? 1 + 0.25 * Math.max(0, 1 - (this.t - this._rankPop) * 4) : 1;
    c.scale(pop, pop);
    outlineText(c, String(rank), 0, 0, 116, RANK_COLOR[rank - 1], 'rgba(0,0,0,0.65)', 12, 'center', 900);
    c.restore();
    if (this._lastRank !== rank) { if (this._lastRank) this._rankPop = this.t; this._lastRank = rank; }
    outlineText(c, '名', W - 54, H - 64, 30, '#ffffff', 'rgba(0,0,0,0.6)', 6, 'center', 800);
    const kmh = Math.round((Math.abs(p.v) / 6.8) * 3.6);
    outlineText(c, `${kmh} km/h`, W - 112, H - 22, 22, '#ffffff', 'rgba(0,0,0,0.55)', 5, 'center', 700);
    // 小地图（左下）
    const M = this.T.miniSize, mx = 26, my = H - M - 26;
    fillRR(c, mx - 8, my - 8, M + 16, M + 16, 22, 'rgba(0,0,0,0.32)');
    c.globalAlpha = 0.9;
    c.drawImage(this.T.mini, mx, my);
    c.globalAlpha = 1;
    const sc = M / MAP;
    for (const o of this.objs) {
      if (o.type !== 'can') continue;
      c.fillStyle = '#ff3b3b';
      c.fillRect(mx + o.x * sc - 3, my + o.y * sc - 3, 6, 6);
    }
    for (const r of this.racers) {
      if (r.isPlayer) continue;
      c.fillStyle = r.ch.color;
      c.beginPath(); c.arc(mx + r.x * sc, my + r.y * sc, 6, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1.5; c.stroke();
    }
    c.fillStyle = p.ch.color;
    c.beginPath(); c.arc(mx + p.x * sc, my + p.y * sc, 9, 0, TAU); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.stroke();
    // 中央提示：倒计时 / 开始 / 最后一圈 / 逆行
    if (this.phase === 'count') {
      const k = Math.ceil(this.cd);
      const fr = this.cd - Math.floor(this.cd);
      if (k >= 1 && k <= 3) {
        const s = 1 + (fr > 0.7 ? (fr - 0.7) * 3 : 0);
        c.save();
        c.translate(W / 2, 300);
        c.scale(s, s);
        outlineText(c, String(k), 0, 0, 180, ['#ff5a4a', '#ffb020', '#ffe14a'][3 - k], 'rgba(0,0,0,0.7)', 16);
        c.restore();
      }
      promptLine(c, ['倒计时快结束时按住 ', { g: 'A' }, ' 可以起步加速'], W / 2, 470, 24, '#ffffff', '#ffffff', '#222');
    }
    if (this.msg && this.msg.t >= 0) {
      const t = this.msg.t;
      const s = easeOutBack(clamp(t / 0.35, 0, 1));
      const a = this.msg.long ? 1 : clamp((1.6 - t) * 3, 0, 1);
      c.save();
      c.globalAlpha = a;
      c.translate(W / 2, 290);
      c.scale(s, s);
      outlineText(c, this.msg.text, 0, 0, 110, this.msg.color, 'rgba(0,0,0,0.7)', 14);
      c.restore();
      if (this.msg.sub) {
        c.globalAlpha = a;
        outlineText(c, this.msg.sub, W / 2, 380, 40, '#ffffff', 'rgba(0,0,0,0.65)', 8);
        c.globalAlpha = 1;
      }
    }
    if (p.wrongT > 1.2 && !p.finished && Math.floor(this.t * 3) % 2 === 0) {
      fillRR(c, W / 2 - 150, 140, 300, 64, 32, 'rgba(220,40,30,0.85)');
      text(c, '逆行！请掉头', W / 2, 172, 34, '#ffffff', 'center', 900);
    }
  }

  _drawTitle(c) {
    const T = TRACKS[this.trackIdx];
    const best = this._best();
    drawTitleCard(c, {
      t: this.modeT, title: '茶杯卡丁车', subtitle: T.desc, titleY: 150, titleSize: 92, stroke: '#b8401a',
      promptY: 500, best: best ? fmt(best) : '—', bestLabel: `${T.name} 纪录`,
      controls: [['A', '油门'], ['B', '刹车'], ['STICK', '转向'], ['R', '漂移'], ['L', '道具']],
      extra: (cc) => this._drawPickers(cc),
    });
  }

  _drawPickers(c) {
    const T = TRACKS[this.trackIdx];
    const y1 = 322, y2 = 400;
    // 赛道
    fillRR(c, W / 2 - 260, y1 - 34, 520, 68, 34, 'rgba(0,0,0,0.42)');
    glyph(c, 'DPAD', W / 2 - 220, y1, 16, '#ffffff', '#222');
    text(c, '◀', W / 2 - 180, y1 + 1, 22, '#ffd36b', 'center', 900);
    text(c, '▶', W / 2 + 220, y1 + 1, 22, '#ffd36b', 'center', 900);
    text(c, `赛道  ${T.name}`, W / 2 - 10, y1 + 1, 30, '#ffffff', 'center', 800);
    text(c, '★'.repeat(T.diff) + '☆'.repeat(3 - T.diff), W / 2 + 150, y1 + 1, 22, '#ffd23a', 'center', 700);
    // 车手
    const ch = CHARS[this.charIdx];
    fillRR(c, W / 2 - 260, y2 - 34, 520, 68, 34, 'rgba(0,0,0,0.42)');
    text(c, '▲', W / 2 - 180, y2 - 12, 16, '#ffd36b', 'center', 900);
    text(c, '▼', W / 2 - 180, y2 + 14, 16, '#ffd36b', 'center', 900);
    drawFace(c, ch, W / 2 - 110, y2 + 2, 24);
    text(c, `车手  ${ch.name}`, W / 2 + 20, y2 + 1, 30, '#ffffff', 'center', 800);
    // 小地图预览
    const tr = buildTrack(this.trackIdx);
    c.globalAlpha = 0.85;
    c.drawImage(tr.mini, W - 250, 210, 200, 200);
    c.globalAlpha = 1;
  }

  _drawResult(c) {
    const t = this.modeT;
    const a = easeOutCubic(t / 0.35);
    const p = this.player;
    c.save();
    c.fillStyle = `rgba(0,0,0,${(0.5 * a).toFixed(3)})`;
    c.fillRect(0, 0, W, H);
    const w = 620, h = 560, x = (W - w) / 2, y = (H - h) / 2 + (1 - a) * 40;
    c.globalAlpha = a;
    fillRR(c, x, y, w, h, 26, 'rgba(255,255,255,0.96)');
    const place = this.final.indexOf(p) + 1;
    const col = place === 1 ? '#e8a400' : place <= 3 ? '#ff7a1a' : '#5a6270';
    strokeRR(c, x + 6, y + 6, w - 12, h - 12, 22, col, 3);
    text(c, place === 1 ? '冠军！' : `第 ${place} 名`, W / 2, y + 54, 46, col, 'center', 900);
    text(c, TRACKS[this.trackIdx].name, W / 2, y + 96, 20, '#888', 'center', 600);
    this.final.forEach((r, i) => {
      const ry = y + 140 + i * 50;
      if (r === p) fillRR(c, x + 30, ry - 22, w - 60, 44, 12, '#fff1e0');
      text(c, String(i + 1), x + 66, ry, 28, RANK_COLOR[i] === '#ffffff' ? '#9aa0a8' : RANK_COLOR[i] === '#e4e8ef' ? '#8a929e' : RANK_COLOR[i], 'center', 900);
      drawFace(c, r.ch, x + 118, ry + 1, 16);
      text(c, r.ch.name + (r === p ? '（你）' : ''), x + 148, ry + 1, 24, '#2d2d2d', 'left', r === p ? 800 : 600);
      text(c, r.finished ? fmt(r.finishT) : `约 ${fmt(r.estT)}`, x + w - 56, ry + 1, 24, r.finished ? '#2d2d2d' : '#999', 'right', 700);
    });
    const ly = y + 140 + 6 * 50 + 8;
    c.fillStyle = '#eee';
    c.fillRect(x + 40, ly - 18, w - 80, 2);
    const fastest = p.lapTimes.length ? Math.min(...p.lapTimes) : 0;
    text(c, `最快单圈 ${fmt(fastest)}`, x + 60, ly + 12, 22, '#666', 'left', 600);
    text(c, `赛道纪录 ${fmt(this.bestShown)}`, x + w - 60, ly + 12, 22, '#666', 'right', 600);
    if (this.newBest) {
      const pp = 1 + 0.06 * Math.sin(t * 6);
      c.save();
      c.translate(x + w - 76, y + 40);
      c.rotate(0.18);
      c.scale(pp, pp);
      fillRR(c, -62, -20, 124, 40, 20, '#ff4b3e');
      text(c, '新纪录！', 0, 1, 22, '#fff', 'center', 800);
      c.restore();
    }
    if (t > 0.6) {
      const hy = y + h - 34;
      const hints = [['A', '再来一次'], ['X', '下一条赛道'], ['B', '标题画面']];
      const ws = hints.map(([, l]) => 34 + textW(c, l, 22, 600) + 30);
      let hx = W / 2 - (ws.reduce((q, z) => q + z, 0) - 30) / 2;
      hints.forEach(([g, l], i) => {
        glyph(c, g, hx + 14, hy, 14, '#2d2d2d', '#fff');
        text(c, l, hx + 36, hy + 1, 22, '#2d2d2d', 'left', 600);
        hx += ws[i];
      });
    }
    c.restore();
  }
}

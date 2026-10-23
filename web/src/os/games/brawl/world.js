// 《茶室大乱斗》一局比赛：场地、角色、判定、飞行道具、道具、出界、镜头
import { STEP, KB_K, STAGES, BLAST_SIDE, BLAST_TOP, BLAST_BOTTOM, CHARS, PLAYER_COLORS, DIFFS } from './data.js';
import { Fighter, emptyCtrl } from './fighter.js';
import { Brain } from './ai.js';
import { Effects } from './fx.js';

const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (a, b, k) => a + (b - a) * (1 - Math.exp(-k * STEP));
const EMPTY = emptyCtrl();

function circleBox(cx, cy, r, x1, y1, x2, y2) {
  const nx = clamp(cx, x1, x2), ny = clamp(cy, y1, y2);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

export class Match {
  constructor(game, cfg) {
    this.g = game;
    this.cfg = cfg;
    this.rng = cfg.rng || Math.random;
    const S = STAGES[cfg.stage];
    const main = { ...S.main, solid: true, main: true, dx: 0 };
    const plats = S.plats.map((p) => {
      const ox = p.ox || 0;
      return { ...p, bx1: p.x1 + ox, bx2: p.x2 + ox, by: p.y, x1: p.x1 + ox, x2: p.x2 + ox, solid: false, dx: 0 };
    });
    this.stage = {
      def: S, main, plats, surfaces: [main, ...plats],
      ledges: [{ x: main.x1, y: main.y, side: -1, who: null }, { x: main.x2, y: main.y, side: 1, who: null }],
      blast: { l: main.x1 - BLAST_SIDE, r: main.x2 + BLAST_SIDE, t: BLAST_TOP, b: BLAST_BOTTOM },
    };
    this.frame = 0;
    this.phase = 'ready';
    this.phaseT = 0;
    this.fx = new Effects(this);
    this.projs = [];
    this.items = [];
    this.mines = [];
    this.itemT = 540 + Math.floor(this.rng() * 360);
    this.cam = { x: 0, y: -170, z: 0.78 };
    this.shakeA = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.out = [];
    this.winner = null;

    const n = 1 + cfg.cpus;
    const half = (main.x2 - main.x1) / 2;
    const slots = n === 2 ? [-0.55, 0.55] : n === 3 ? [-0.62, 0.62, 0] : [-0.68, 0.68, -0.24, 0.24];
    const used = new Map();
    this.fighters = [];
    this.brains = [];
    for (let i = 0; i < n; i++) {
      const ci = i === 0 ? cfg.char : cfg.cpuChars[i - 1];
      const ch = CHARS[ci];
      const k = used.get(ci) || 0;
      used.set(ci, k + 1);
      const f = new Fighter(this, i, ch, {
        cpu: i > 0, color: PLAYER_COLORS[i], tag: i === 0 ? '1P' : `CPU${n > 2 ? i : ''}`, tint: k % 2 ? ch.alt : ch.color,
      });
      f.spawn(slots[i] * half, main.y);
      f.ground = main;
      f.state = 'idle';
      f.dir = slots[i] <= 0 ? 1 : -1;
      this.fighters.push(f);
      this.brains.push(i > 0 ? new Brain(f, this, DIFFS[cfg.diff], i * 7919 + (cfg.seed || 1)) : null);
    }
    this.player = this.fighters[0];
  }

  sfx(name, o) { this.g.sound(name, o); }
  shake(a) { this.shakeA = Math.max(this.shakeA, a); }
  get time() { return this.frame / 60; }

  // ———————————————— 每帧 ————————————————
  step(pad) {
    this.frame++;
    this.phaseT++;
    this.movePlatforms();
    if (this.phase === 'ready') {
      if (this.phaseT === 1 || this.phaseT === 50 || this.phaseT === 100) this.sfx('count');
      if (this.phaseT >= 150) { this.phase = 'fight'; this.phaseT = 0; this.sfx('go'); }
    }
    const live = this.phase !== 'ready';
    for (const f of this.fighters) {
      if (!f.alive) {
        if (f.stocks > 0 && --f.respawnT <= 0) this.respawn(f);
        continue;
      }
      if (!live) Object.assign(f.ctrl, EMPTY);
      else if (f.cpu) this.brains[f.idx].think();
      else if (this.phase === 'end') Object.assign(f.ctrl, EMPTY);
      else f.readPad(pad);
      f.step();
      f.dispPct += (f.percent - f.dispPct) * 0.3;
      if (f.pctPulse > 0) f.pctPulse = Math.max(0, f.pctPulse - 0.06);
      this.checkBlast(f);
    }
    this.separate();
    this.stepProjs();
    this.stepItems();
    this.stepMines();
    this.fx.step();
    this.updateCamera();
    if (this.shakeA > 0) {
      this.shakeA = Math.max(0, this.shakeA - 0.9);
      this.shakeX = (this.rng() - 0.5) * this.shakeA * 2;
      this.shakeY = (this.rng() - 0.5) * this.shakeA * 2;
    } else this.shakeX = this.shakeY = 0;
    if (this.phase === 'end') this.phaseT2 = (this.phaseT2 || 0) + 1;
  }

  movePlatforms() {
    const t = this.frame / 60;
    for (const p of this.stage.plats) {
      if (!p.path) continue;
      const a = (Math.PI * 2 * t) / p.path.period + p.path.phase;
      const ox = Math.sin(a) * p.path.ax, oy = Math.sin(a * (p.path.ay ? 1 : 0)) * p.path.ay;
      const nx1 = p.bx1 + ox;
      p.dx = nx1 - p.x1;
      p.x1 = nx1;
      p.x2 = p.bx2 + ox;
      p.y = p.by + oy;
    }
  }

  separate() {
    const F = this.fighters;
    for (let i = 0; i < F.length; i++) {
      const a = F[i];
      if (!a.alive || !a.ground || a.state === 'grabbed' || a.state === 'grabbing') continue;
      for (let j = i + 1; j < F.length; j++) {
        const b = F[j];
        if (!b.alive || b.ground !== a.ground || b.state === 'grabbed' || b.state === 'grabbing') continue;
        const dx = b.x - a.x, min = (a.w + b.w) * 0.32;
        if (Math.abs(dx) < min) {
          const s = dx === 0 ? (i % 2 ? 1 : -1) : sign(dx);
          a.x -= s * 1.6;
          b.x += s * 1.6;
        }
      }
    }
  }

  // ———————————————— 出界 / 复活 / 结束 ————————————————
  checkBlast(f) {
    const b = this.stage.blast;
    const overTop = f.y - f.h < b.t;
    if (overTop && f.hitstun <= 0) { f.y = b.t + f.h; f.vy = Math.max(0, f.vy); }
    if (f.x < b.l || f.x > b.r || f.y > b.b || (overTop && f.hitstun > 0)) this.ko(f);
  }

  ko(f) {
    f.alive = false;
    f.stocks--;
    f.falls++;
    f.respawnT = 80;
    if (f.lastHit && f.lastHit !== f && this.frame - f.lastHitT < 600) f.lastHit.kos++;
    if (f.holding) this.release(f, false);
    if (f.heldBy) { f.heldBy.holding = null; f.heldBy.setState('idle'); f.heldBy = null; }
    if (f.ledge) { f.ledge.who = null; f.ledge = null; }
    f.item = null;
    f.trail.length = 0;
    this.fx.ko(f);
    this.shake(24);
    this.sfx('ko');
    if (f.stocks <= 0) {
      const remain = this.fighters.filter((o) => o.stocks > 0).length;
      f.place = remain + 1;
      this.out.push(f);
    }
    this.checkEnd();
  }

  respawn(f) {
    f.spawn(0, -430, true);
    this.sfx('respawn');
  }

  checkEnd() {
    if (this.phase !== 'fight') return;
    const left = this.fighters.filter((o) => o.stocks > 0);
    const playerOut = this.player.stocks <= 0;
    if (left.length <= 1 || playerOut) {
      // 剩下的人按命数、百分比排名
      left.sort((a, b) => b.stocks - a.stocks || a.percent - b.percent);
      left.forEach((o, i) => { o.place = i + 1; });
      this.winner = left[0] || null;
      this.phase = 'end';
      this.phaseT = 0;
      this.phaseT2 = 0;
      this.sfx('game');
    }
  }

  // ———————————————— 判定 ————————————————
  resolveHits(att, mv, final) {
    const d = mv.def;
    for (const t of this.fighters) {
      if (t === att || !t.alive || mv.hit.has(t) || t.invuln > 0 || t.hidden || t.state === 'respawn') continue;
      const x1 = t.x - t.w / 2, x2 = t.x + t.w / 2, y1 = t.y - t.h, y2 = t.y;
      let hx = 0, hy = 0, ok = false;
      for (const b of d.boxes) {
        const bx = att.x + b[0] * att.dir, by = att.cy + b[1];
        if (circleBox(bx, by, b[2], x1, y1, x2, y2)) { ok = true; hx = bx; hy = by; break; }
      }
      if (!ok) continue;
      mv.hit.add(t);
      if (d.grab) {
        if (t.state !== 'grabbed' && !t.ledge && t.ground && att.state === 'move') this.grab(att, t);
        continue;
      }
      const p = d.multi && !final ? d.multi : d;
      const dirX = d.radial ? (sign(t.x - att.x) || att.dir) : d.back ? -att.dir : att.dir;
      this.applyHit(att, t, {
        dmg: p.dmg * mv.mult, base: p.base, growth: p.growth, angle: p.angle, dirX,
        x: (hx + t.x) / 2, y: (hy + t.cy) / 2, multi: d.multi && !final,
      });
    }
  }

  applyHit(att, t, h) {
    if (t.countering && att && att !== t) { this.counter(t, att, h.dmg); return 'counter'; }
    if (t.state === 'shield' && !h.unblockable) {
      t.shield -= h.dmg * 1.25 + 1;
      t.shieldStun = Math.round(4 + h.dmg * 0.55);
      t.vx = h.dirX * (120 + h.dmg * 16);
      const hs = Math.round(3 + h.dmg * 0.3);
      t.hitstop = hs;
      if (att && !h.proj) { att.hitstop = hs; att.vx = -h.dirX * 60; }
      this.fx.shieldHit(h.x, h.y, t.color);
      this.sfx('shieldHit');
      if (t.shield <= 0) t.breakShield();
      return 'shield';
    }
    t.percent = Math.min(999, t.percent + h.dmg);
    t.pctPulse = 1;
    const units = (h.base + h.growth * (t.percent / 100) * (0.5 + h.dmg / 24)) * (100 / (t.ch.weight * 0.5 + 50));
    let ang = (h.angle * Math.PI) / 180;
    if (ang < 0 && t.ground) ang = 0.7;     // 地面上挨了下砸：弹起
    let lx = Math.cos(ang) * h.dirX, ly = -Math.sin(ang);
    // 受击方向修正（DI）：推摇杆可以把飞出的角度偏 ±13°
    const diSkill = t.cpu ? this.brains[t.idx].diSkill() : 1;
    const sx = t.ctrl.x, sy = -t.ctrl.y;
    if (diSkill > 0 && (sx || sy)) {
      const perp = clamp(lx * sy - ly * sx, -1, 1);
      const rot = perp * 0.23 * diSkill;
      const c = Math.cos(rot), s = Math.sin(rot);
      [lx, ly] = [lx * c - ly * s, lx * s + ly * c];
    }
    const speed = units * KB_K;
    t.kbx = lx * speed;
    t.kby = ly * speed;
    t.vx = 0;
    t.vy = 0;
    if (t.holding) this.release(t, false);
    if (t.heldBy) { const g = t.heldBy; g.holding = null; if (g.state === 'grabbing') g.setState('idle'); t.heldBy = null; }
    if (t.ledge) { t.ledge.who = null; t.ledge = null; }
    if (t.item) this.dropItem(t);
    if (t.ground && (ly < -0.08 || speed > 700)) t.ground = null;
    if (t.ground) t.kby = 0;
    t.move = null;
    t.countering = false;
    t.fastFall = false;
    t.charge = 0;
    t.hitstun = Math.max(h.multi ? 8 : 6, Math.round(units * 0.42));
    t.setState('hitstun');
    t.lastHit = att;
    t.lastHitT = this.frame;
    t.flash = 7;
    const hs = Math.min(16, Math.round(3 + h.dmg * 0.45 + units * 0.02));
    t.hitstop = hs;
    if (att && !h.proj) att.hitstop = hs;
    if (att) att.dmgDone += h.dmg;
    const strong = units > 115;
    this.fx.spark(h.x, h.y, h.dmg, strong, att ? att.color : '#fff');
    this.shake(Math.min(20, units * 0.07));
    this.sfx(strong ? 'hitHeavy' : h.dmg >= 7 ? 'hitMid' : 'hitLight');
    if (strong && t.percent > 80) this.fx.flash(0.35);
    return 'hit';
  }

  counter(t, att, dmg) {
    this.fx.smoke(t.x, t.cy);
    this.fx.decoy(t.x, t.cy, t.tint);
    t.x = att.x - att.dir * (att.w / 2 + t.w / 2 + 12);
    t.y = att.y;
    t.ground = att.ground;
    t.kbx = t.kby = t.vx = t.vy = 0;
    t.dir = sign(att.x - t.x) || 1;
    t.move = null;
    t.countering = false;
    t.invuln = 14;
    t.setState(t.ground ? 'idle' : 'air');
    this.sfx('counter');
    this.applyHit(t, att, { dmg: Math.max(8, dmg * 1.3), base: 46, growth: 96, angle: 40, dirX: t.dir, x: att.x, y: att.cy, unblockable: true });
    this.fx.slash(att.x, att.cy, t.color);
  }

  grab(att, t) {
    att.setState('grabbing');
    att.move = null;
    att.holding = t;
    att.vx = 0;
    att.pummelCD = 0;
    t.setState('grabbed');
    t.heldBy = att;
    t.move = null;
    t.hitstun = 0;
    t.kbx = t.kby = t.vx = t.vy = 0;
    t.countering = false;
    t.escape = 60 + t.percent * 0.4;
    if (t.item) this.dropItem(t);
    if (att.cpu) att.aiThrow = this.brains[att.idx].pickThrow(t);
    this.sfx('grab');
  }

  release(att, escaped) {
    const t = att.holding;
    att.holding = null;
    if (att.state === 'grabbing') att.setState('idle');
    if (!t) return;
    t.heldBy = null;
    t.setState(t.ground ? 'idle' : 'air');
    if (escaped) {
      att.vx = -att.dir * 380;
      t.vx = att.dir * 380;
      t.invuln = 10;
      this.sfx('dodge');
    }
  }

  doThrow(att, d, mult) {
    const t = att.holding;
    if (!t) return;
    att.holding = null;
    t.heldBy = null;
    t.setState('air');
    t.y = att.y - 4;
    if (d.back) att.dir = -att.dir;
    const dirX = d.back ? att.dir : att.dir;
    this.applyHit(att, t, { dmg: d.dmg, base: d.base, growth: d.growth, angle: d.angle, dirX, x: t.x, y: t.cy, unblockable: true });
  }

  pummel(att) {
    const t = att.holding;
    if (!t) return;
    t.percent += 1.5;
    t.pctPulse = 1;
    t.flash = 4;
    t.hitstop = 3;
    att.hitstop = 3;
    att.dmgDone += 1.5;
    this.fx.spark(t.x, t.cy, 2, false, att.color);
    this.sfx('hitLight');
  }

  tryLedge(f) {
    for (const L of this.stage.ledges) {
      if (L.who && L.who !== f && L.who.alive && L.who.ledge === L) continue;
      const handX = f.x - L.side * (f.w / 2);
      const outside = L.side < 0 ? f.x < L.x : f.x > L.x;
      if (!outside || Math.abs(handX - L.x) > 42) continue;
      const handY = f.y - f.h;
      if (handY < L.y - 40 || handY > L.y + 46) continue;
      L.who = f;
      f.ledge = L;
      if (f.move) f.move = null;
      f.vx = f.vy = f.kbx = f.kby = 0;
      f.jumps = f.ch.jumps - 1;
      f.used = {};
      f.airDodged = false;
      f.fastFall = false;
      f.invuln = Math.max(f.invuln, 36);
      f.setState('ledge');
      this.sfx('ledge');
      return true;
    }
    return false;
  }

  // ———————————————— 飞行道具 ————————————————
  countProj(f, kind) {
    let n = 0;
    for (const p of this.projs) if (p.owner === f && p.kind === kind) n++;
    return n;
  }

  spawnProj(f, d) {
    this.projs.push({
      owner: f, kind: d.kind, x: f.x + f.dir * (f.w / 2 + 8), y: f.cy - 8, vx: d.vx * f.dir, vy: d.vy, grav: d.grav || 0,
      life: d.life, r: d.r, dmg: d.dmg * f.ch.dmg, base: d.base, growth: d.growth, angle: d.angle, burst: d.burst, boomerang: d.boomerang,
      t: 0, hit: new Set(), spin: 0, dir: f.dir, back: false,
    });
    this.sfx(d.kind === 'star' ? 'star' : 'throw');
  }

  stepProjs() {
    const P = this.projs;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.t++;
      p.spin += 0.35 * p.dir;
      if (p.boomerang) {
        if (p.t > 18) {
          const o = p.owner;
          const ax = sign(o.x - p.x) * 2800, ay = sign(o.cy - p.y) * 900;
          p.vx = clamp(p.vx + ax * STEP, -1200, 1200);
          p.vy = clamp(p.vy + ay * STEP, -500, 500);
          const back = sign(p.vx) !== p.dir;
          if (back && !p.back) { p.back = true; p.hit.clear(); }
          if (p.t > 26 && Math.abs(o.x - p.x) < 40 && Math.abs(o.cy - p.y) < 60) { P.splice(i, 1); continue; }
        }
      }
      p.vy += p.grav * STEP;
      p.x += p.vx * STEP;
      p.y += p.vy * STEP;
      let dead = --p.life <= 0 && !p.boomerang;
      if (p.boomerang && p.t > 150) dead = true;
      // 打中人
      for (const t of this.fighters) {
        if (dead) break;
        if (t === p.owner || !t.alive || p.hit.has(t) || t.invuln > 0 || t.hidden || t.state === 'respawn') continue;
        if (!circleBox(p.x, p.y, p.r, t.x - t.w / 2, t.y - t.h, t.x + t.w / 2, t.y)) continue;
        p.hit.add(t);
        if (p.burst) { this.explode(p.owner, p.x, p.y, 60, p); dead = true; break; }
        const r = this.applyHit(p.owner, t, { dmg: p.dmg, base: p.base, growth: p.growth, angle: p.angle, dirX: sign(p.vx) || p.dir, x: p.x, y: p.y, proj: true });
        if (!p.boomerang || r === 'shield') dead = true;
      }
      // 撞到平台
      if (!dead && p.vy >= 0) {
        for (const s of this.stage.surfaces) {
          if (p.x >= s.x1 && p.x <= s.x2 && p.y >= s.y - 2 && p.y - p.vy * STEP <= s.y + 2) {
            if (p.burst || p.kind === 'cup' || p.kind === 'slice') { if (p.burst) this.explode(p.owner, p.x, s.y - 10, 60, p); dead = true; }
            break;
          }
        }
      }
      const M = this.stage.main;
      if (!dead && p.x > M.x1 && p.x < M.x2 && p.y > M.y + 4 && p.y < M.y + M.depth) dead = true;
      const b = this.stage.blast;
      if (p.x < b.l || p.x > b.r || p.y > b.b || p.y < b.t) dead = true;
      if (dead) {
        if (p.kind === 'cup') { this.fx.shards(p.x, p.y); this.sfx('shatter'); }
        else if (!p.burst) this.fx.poof(p.x, p.y, p.kind);
        P.splice(i, 1);
      }
    }
  }

  explode(owner, x, y, r, src) {
    this.fx.boom(x, y, r);
    this.sfx('boom');
    this.shake(8);
    for (const t of this.fighters) {
      if (t === owner || !t.alive || t.invuln > 0 || t.hidden || t.state === 'respawn') continue;
      if (!circleBox(x, y, r, t.x - t.w / 2, t.y - t.h, t.x + t.w / 2, t.y)) continue;
      this.applyHit(owner, t, { dmg: src.dmg, base: src.base, growth: src.growth, angle: src.angle, dirX: sign(t.x - x) || 1, x: (x + t.x) / 2, y: (y + t.cy) / 2, proj: true });
    }
  }

  // ———————————————— 道具：茶杯（可投掷）、小点心（回复） ————————————————
  stepItems() {
    if (this.phase === 'fight' && this.cfg.items !== false && --this.itemT <= 0) {
      this.itemT = 660 + Math.floor(this.rng() * 480);
      if (this.items.length < 3) this.spawnItem();
    }
    const I = this.items;
    for (let i = I.length - 1; i >= 0; i--) {
      const it = I[i];
      it.t++;
      if (!it.ground) {
        it.vy = Math.min(900, it.vy + 1500 * STEP);
        const ny = it.y + it.vy * STEP;
        for (const s of this.stage.surfaces) {
          if (it.x >= s.x1 && it.x <= s.x2 && it.y <= s.y + 1 && ny >= s.y) { it.ground = s; it.vy = 0; this.fx.dust(it.x, s.y, 4); break; }
        }
        it.y = it.ground ? it.ground.y : ny;
        if (it.y > this.stage.blast.b) { I.splice(i, 1); continue; }
      } else {
        it.x += it.ground.dx || 0;
        it.y = it.ground.y;
        it.life--;
      }
      if (it.life <= 0) { this.fx.poof(it.x, it.y - 12, 'item'); I.splice(i, 1); continue; }
      if (it.type === 'snack') {
        for (const f of this.fighters) {
          if (!f.alive || f.state === 'respawn') continue;
          if (Math.abs(f.x - it.x) < f.w / 2 + 16 && it.y > f.y - f.h - 10 && it.y < f.y + 20) {
            f.percent = Math.max(0, f.percent - 20);
            f.pctPulse = 1;
            this.fx.heal(f.x, f.cy);
            this.sfx('heal');
            I.splice(i, 1);
            break;
          }
        }
      }
    }
  }

  spawnItem() {
    const M = this.stage.main;
    const type = this.rng() < 0.62 ? 'cup' : 'snack';
    const x = M.x1 + 80 + this.rng() * (M.x2 - M.x1 - 160);
    this.items.push({ type, x, y: -760, vy: 0, ground: null, t: 0, life: 900 });
  }

  tryPickItem(f) {
    if (f.item || !f.ground) return false;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it.type !== 'cup' || !it.ground) continue;
      if (Math.abs(it.x - f.x) < f.w / 2 + 26 && Math.abs(it.y - f.y) < 30) {
        f.item = 'cup';
        this.items.splice(i, 1);
        this.sfx('pick');
        f.lag = 6;
        f.setState('land');
        return true;
      }
    }
    return false;
  }

  dropItem(f) {
    if (!f.item) return;
    this.items.push({ type: f.item, x: f.x, y: f.y - 20, vy: -300, ground: null, t: 0, life: 600 });
    f.item = null;
  }

  throwItem(f) {
    if (!f.item) return;
    f.item = null;
    const c = f.ctrl;
    let vx = f.dir * 1350, vy = -140;
    if (c.y > 0.5) { vx = c.x * 200; vy = -1300; }
    else if (c.y < -0.5) { vx = c.x * 200; vy = f.ground ? -300 : 1500; }
    else if (Math.abs(c.x) > 0.3) { f.dir = sign(c.x); vx = f.dir * 1350; }
    this.projs.push({
      owner: f, kind: 'cup', x: f.x + f.dir * 24, y: f.cy - 16, vx, vy, grav: 1400, life: 80, r: 18,
      dmg: 10, base: 36, growth: 72, angle: c.y > 0.5 ? 85 : 42, t: 0, hit: new Set(), spin: 0, dir: f.dir,
    });
    this.sfx('throw');
  }

  // ———————————————— 地雷（抹茶兔下必杀） ————————————————
  placeMine(f) {
    this.mines = this.mines.filter((m) => m.owner !== f);
    this.mines.push({ owner: f, x: f.x + f.dir * 30, y: f.y - 4, vy: f.ground ? 0 : 200, ground: f.ground, t: 0 });
    this.sfx('mine');
  }

  stepMines() {
    const L = this.mines;
    for (let i = L.length - 1; i >= 0; i--) {
      const m = L[i];
      m.t++;
      if (!m.ground) {
        m.vy = Math.min(1200, m.vy + 2200 * STEP);
        const ny = m.y + m.vy * STEP;
        for (const s of this.stage.surfaces) {
          if (m.x >= s.x1 && m.x <= s.x2 && m.y <= s.y + 1 && ny >= s.y) { m.ground = s; m.vy = 0; break; }
        }
        m.y = m.ground ? m.ground.y : ny;
        if (m.y > this.stage.blast.b) { L.splice(i, 1); continue; }
      } else {
        m.x += m.ground.dx || 0;
        m.y = m.ground.y;
      }
      if (m.t > 1200) { this.fx.poof(m.x, m.y - 8, 'item'); L.splice(i, 1); continue; }
      if (m.t < 30) continue;
      for (const t of this.fighters) {
        if (t === m.owner || !t.alive || t.state === 'respawn' || t.hidden) continue;
        if (Math.abs(t.x - m.x) < t.w / 2 + 14 && m.y > t.y - t.h && m.y < t.y + 10) {
          this.explode(m.owner, m.x, m.y - 20, 80, { dmg: 12 * m.owner.ch.dmg, base: 44, growth: 92, angle: 80 });
          L.splice(i, 1);
          break;
        }
      }
    }
  }

  // ———————————————— 镜头 ————————————————
  updateCamera() {
    const b = this.stage.blast, M = this.stage.main;
    let x1 = M.x1 + 120, x2 = M.x2 - 120, y1 = -260, y2 = M.y + 40;
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const fx = clamp(f.x, b.l + 260, b.r - 260), fy = clamp(f.cy, b.t + 220, b.b - 200);
      x1 = Math.min(x1, fx);
      x2 = Math.max(x2, fx);
      y1 = Math.min(y1, fy);
      y2 = Math.max(y2, fy);
    }
    const padX = 260, padY = 200;
    const spanX = x2 - x1 + padX * 2, spanY = y2 - y1 + padY * 2;
    const z = clamp(Math.min(1280 / spanX, 560 / spanY), 0.42, 1.0);
    const cx = (x1 + x2) / 2, cy = Math.min((y1 + y2) / 2, M.y - 40);
    const cam = this.cam;
    const k = this.phase === 'end' ? 2 : 3.2;
    cam.x = damp(cam.x, cx, k);
    cam.y = damp(cam.y, cy, k);
    cam.z = damp(cam.z, z, 2.4);
  }

  // 世界坐标 → 屏幕坐标
  toScreen(x, y) {
    const c = this.cam;
    return [(x - c.x) * c.z + 640 + this.shakeX, (y - c.y) * c.z + 330 + this.shakeY];
  }
}

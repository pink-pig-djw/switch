// 《茶室大乱斗》角色：输入 → 状态机 → 物理（固定 60 帧步长）
import { STEP, KB_DECAY, STUN_GRAV, STOCKS, buildMoves } from './data.js';

const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

export function emptyCtrl() {
  return { x: 0, y: 0, atk: false, atkP: false, sp: false, spP: false, str: false, strP: false, strR: false, jmp: false, jmpP: false, shd: false, shdP: false, anyP: false };
}

// 可以自由行动的状态
const FREE = new Set(['idle', 'run', 'air']);

export class Fighter {
  constructor(match, idx, ch, opts) {
    this.m = match;
    this.idx = idx;
    this.ch = ch;
    this.moves = buildMoves(ch);
    this.cpu = !!opts.cpu;
    this.color = opts.color;
    this.tint = opts.tint || ch.color;
    this.tag = opts.tag;
    this.w = ch.w;
    this.h = ch.h;
    this.stocks = STOCKS;
    this.percent = 0;
    this.dispPct = 0;
    this.pctPulse = 0;
    this.kos = 0;
    this.falls = 0;
    this.dmgDone = 0;
    this.place = 0;
    this.outAt = -1;
    this.ctrl = emptyCtrl();
    this.prevCx = 0;
    this.prevCy = 0;
    this.alive = true;
    this.respawnT = 0;
    this.lastHit = null;
    this.lastHitT = 0;
    this.trail = [];
    this.anim = 0;
    this.spin = 0;
  }

  get cx() { return this.x; }
  get cy() { return this.y - this.h / 2; }
  get top() { return this.y - this.h; }
  get airborne() { return !this.ground; }

  spawn(x, y, respawn = false) {
    this.x = x;
    this.y = y;
    this.vx = this.vy = this.kbx = this.kby = 0;
    this.dir = x > 0 ? -1 : 1;
    this.ground = null;
    this.state = respawn ? 'respawn' : 'air';
    this.stateT = 0;
    this.move = null;
    this.jumps = this.ch.jumps - 1;
    this.shield = 60;
    this.shieldStun = 0;
    this.hitstun = 0;
    this.hitstop = 0;
    this.invuln = respawn ? 150 : 0;
    this.ledge = null;
    this.ledgeCD = 0;
    this.dropT = 0;
    this.fastFall = false;
    this.used = {};
    this.airDodged = false;
    this.holding = null;
    this.heldBy = null;
    this.item = null;
    this.flash = 0;
    this.dizzy = 0;
    this.charge = 0;
    this.chargeKey = null;
    this.jabN = 0;
    this.pummelCD = 0;
    this.runT = 0;
    this.upPending = 0;
    this.lag = 0;
    this.spin = 0;
    this.trail.length = 0;
    this.alive = true;
    this.countering = false;
    this.hidden = false;
    this.percent = respawn ? 0 : this.percent;
    if (!respawn) this.land();
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  land(plat) {
    if (plat) this.ground = plat;
    this.used = {};
    this.airDodged = false;
    this.fastFall = false;
    this.jumps = this.ch.jumps - 1;
  }

  // ———————————————— 输入读取（玩家用手柄，CPU 由 AI 填 ctrl） ————————————————
  readPad(pad) {
    const c = this.ctrl;
    const ax = (pad.down.LEFT && !pad.down.RIGHT) ? -1 : (pad.down.RIGHT && !pad.down.LEFT) ? 1 : (Math.abs(pad.lx) > 0.25 ? pad.lx : 0);
    const ay = (pad.down.UP && !pad.down.DOWN) ? 1 : (pad.down.DOWN && !pad.down.UP) ? -1 : (Math.abs(pad.ly) > 0.25 ? pad.ly : 0);
    c.x = ax;
    c.y = ay;
    c.atk = pad.down.A;
    c.atkP = pad.pressed.A;
    c.sp = pad.down.B;
    c.spP = pad.pressed.B;
    c.str = pad.down.Y;
    c.strP = pad.pressed.Y;
    c.strR = pad.released.Y;
    c.shd = pad.down.ZL || pad.down.ZR || pad.down.L || pad.down.R;
    c.shdP = pad.pressed.ZL || pad.pressed.ZR || pad.pressed.L || pad.pressed.R;
    c.jmp = pad.down.X;
    c.jmpP = pad.pressed.X;
    c.anyP = pad.pressed.A || pad.pressed.B || pad.pressed.X || pad.pressed.Y;
    // 轻推“上”也能跳；为了不和“上 + A / B”冲突，等 4 帧，期间按了攻击键就不跳
    if (ay > 0.6 && this.prevCy <= 0.6) this.upPending = 4;
    if (this.upPending > 0) {
      if (c.atkP || c.spP || c.strP) this.upPending = 0;
      else if (--this.upPending === 0) { c.jmpP = true; this.tapJump = true; }
    }
    if (c.jmpP && pad.pressed.X) this.tapJump = false;
    if (this.tapJump) c.jmp = ay > 0.5;
  }

  // ———————————————— 每帧 ————————————————
  step() {
    const c = this.ctrl;
    if (this.hitstop > 0) {
      this.hitstop--;
      this.endInput();
      return;
    }
    this.stateT++;
    this.anim++;
    if (this.invuln > 0) this.invuln--;
    if (this.ledgeCD > 0) this.ledgeCD--;
    if (this.dropT > 0) this.dropT--;
    if (this.flash > 0) this.flash--;
    if (this.state !== 'shield' && this.shield < 60) this.shield = Math.min(60, this.shield + 0.17);
    const downTap = c.y < -0.6 && this.prevCy >= -0.6;
    const ch = this.ch;

    // 移动平台带着角色走
    if (this.ground && this.ground.dx) { this.x += this.ground.dx; }
    if (this.ground) this.y = this.ground.y;

    switch (this.state) {
      case 'idle':
      case 'run':
        this.groundControl(downTap);
        break;
      case 'squat':
        this.vx = approach(this.vx, 0, 1800 * STEP);
        if (this.stateT >= 4) {
          const full = c.jmp || this.ctrl.y > 0.5;
          this.vy = -ch.jump * (full ? 1 : 0.68);
          this.ground = null;
          this.setState('air');
          this.m.fx.jumpPuff(this.x, this.y, false);
          this.m.sfx('jump');
        }
        break;
      case 'land':
        this.vx = approach(this.vx, 0, 3600 * STEP);
        if (this.stateT >= this.lag) this.setState('idle');
        break;
      case 'air':
        this.airControl(downTap, true);
        break;
      case 'helpless':
        this.airControl(downTap, false);
        break;
      case 'move':
        this.stepMove(downTap);
        break;
      case 'charge':
        this.stepCharge();
        break;
      case 'shield':
        this.stepShield();
        break;
      case 'roll': {
        const k = this.stateT;
        this.vx = k >= 3 && k <= 17 ? this.rollDir * 880 : approach(this.vx, 0, 6000 * STEP);
        if (k >= 24) { this.dir = -this.rollDir; this.setState('idle'); }
        break;
      }
      case 'spot':
        this.vx = approach(this.vx, 0, 6000 * STEP);
        if (this.stateT >= 20) this.setState('idle');
        break;
      case 'adodge': {
        const k = this.stateT;
        if (k <= 12) { this.vx = this.adx * 1000; this.vy = this.ady * 1000; }
        else if (k <= 16) { this.vx *= 0.8; this.vy *= 0.8; }
        if (k >= 30) this.setState('air');
        break;
      }
      case 'hitstun':
        this.vx *= 0.96;
        if (--this.hitstun <= 0) {
          this.hitstun = 0;
          this.setState(this.ground ? 'idle' : 'air');
        }
        break;
      case 'ledge':
        this.stepLedge();
        break;
      case 'climb':
        if (this.stateT >= 14) {
          const L = this.ledge;
          this.x = L.x + L.side * -(this.w / 2 + 8);
          this.y = L.y;
          this.ground = this.m.stage.main;
          this.ledge = null;
          this.land();
          if (this.climbAtk) { this.climbAtk = false; this.startMove('ledgeAtk'); } else this.setState('idle');
        }
        break;
      case 'dizzy':
        this.vx = approach(this.vx, 0, 2000 * STEP);
        if (c.anyP) this.dizzy -= 4;
        if (--this.dizzy <= 0) this.setState(this.ground ? 'idle' : 'air');
        break;
      case 'grabbing':
        this.stepGrabbing();
        break;
      case 'grabbed':
        this.stepGrabbed();
        break;
      case 'respawn':
        this.vx = this.vy = 0;
        if (this.stateT > 30 && (Math.abs(c.x) > 0.3 || c.jmpP || c.atkP || c.spP || c.y < -0.5 || this.stateT > 200)) {
          this.setState('air');
          this.jumps = this.ch.jumps - 1;
        }
        break;
      default:
        break;
    }
    if (this.state !== 'respawn' && this.state !== 'ledge' && this.state !== 'climb' && this.state !== 'grabbed') this.physics();
    this.endInput();
  }

  endInput() {
    this.prevCx = this.ctrl.x;
    this.prevCy = this.ctrl.y;
  }

  groundControl(downTap) {
    const c = this.ctrl, ch = this.ch;
    if (c.shd) { this.setState('shield'); return; }
    if (c.jmpP) { this.setState('squat'); return; }
    if (c.strP) { this.startCharge(); return; }
    if (c.atkP) { this.groundAttack(); return; }
    if (c.spP) { this.special(); return; }
    if (downTap && this.ground && !this.ground.solid) {
      this.dropT = 14;
      this.ground = null;
      this.y += 2;
      this.setState('air');
      return;
    }
    if (Math.abs(c.x) > 0.2) {
      const d = sign(c.x);
      if (d !== this.dir) { this.dir = d; this.runT = 0; }
      this.vx = approach(this.vx, c.x * ch.run, 5200 * STEP);
      if (this.state !== 'run') this.setState('run');
      this.runT++;
    } else {
      this.vx = approach(this.vx, 0, 4200 * STEP);
      if (this.state !== 'idle') this.setState('idle');
      this.runT = 0;
    }
  }

  airControl(downTap, free) {
    const c = this.ctrl, ch = this.ch;
    if (free) {
      if (c.jmpP && this.jumps > 0) {
        this.jumps--;
        this.vy = -ch.dj;
        this.vx = c.x * ch.air * 0.9;
        this.fastFall = false;
        this.m.fx.jumpPuff(this.x, this.y, true);
        this.m.sfx('djump');
        return;
      }
      if (c.atkP || c.strP) { this.airAttack(); return; }
      if (c.spP) { this.special(); return; }
      if (c.shdP && !this.airDodged) {
        this.airDodged = true;
        const m = Math.hypot(c.x, c.y);
        this.adx = m > 0.3 ? c.x / m : 0;
        this.ady = m > 0.3 ? -c.y / m : 0;
        this.invuln = Math.max(this.invuln, 20);
        this.setState('adodge');
        this.m.sfx('dodge');
        return;
      }
    }
    if (downTap && this.vy > -150 && !this.fastFall) {
      this.fastFall = true;
      this.vy = Math.max(this.vy, ch.ffall * 0.85);
    }
    const maxV = ch.air * (free ? 1 : 0.6);
    if (Math.abs(c.x) > 0.2) this.vx = approach(this.vx, c.x * maxV, ch.airAcc * STEP);
    else this.vx *= 0.985;
  }

  // ———————————————— 出招 ————————————————
  startMove(key, opts = {}) {
    const def = this.moves[key];
    if (!def) return;
    this.move = { def, key, t: 0, hit: new Set(), mult: opts.mult || 1, multiN: -1, landed: false };
    this.countering = false;
    this.setState('move');
    if (def.pose === 'dash' && !def.vel?.air) this.m.sfx('whoosh');
  }

  groundAttack() {
    const c = this.ctrl;
    if (this.item) { this.startMove('itemThrow'); return; }
    if (this.m.tryPickItem(this)) return;
    if (this.state === 'run' && this.runT > 5 && Math.abs(c.x) > 0.5) { this.startMove('dash'); return; }
    if (c.y > 0.5) { this.startMove('utilt'); return; }
    if (c.y < -0.5) { this.startMove('dtilt'); return; }
    if (Math.abs(c.x) > 0.5) { this.dir = sign(c.x); this.startMove('ftilt'); return; }
    this.jabN = 1;
    this.startMove('jab');
  }

  airAttack() {
    const c = this.ctrl;
    if (this.item) { this.startMove('itemThrow'); return; }
    const fx = c.x * this.dir;
    if (c.y > 0.5 && c.y >= Math.abs(c.x)) this.startMove('uair');
    else if (c.y < -0.5 && -c.y >= Math.abs(c.x)) this.startMove('dair');
    else if (fx > 0.5) this.startMove('fair');
    else if (fx < -0.5) this.startMove('bair');
    else this.startMove('nair');
  }

  special() {
    const c = this.ctrl;
    let key = 'nspec';
    if (c.y > 0.5 && c.y >= Math.abs(c.x)) key = 'uspec';
    else if (c.y < -0.5 && -c.y >= Math.abs(c.x)) key = 'dspec';
    else if (Math.abs(c.x) > 0.5) { key = 'sspec'; this.dir = sign(c.x); }
    const def = this.moves[key];
    if (def.once && this.used[def.once] && !this.ground) return;
    if (def.proj && this.m.countProj(this, def.proj.kind) >= def.proj.max) return;
    if (def.once && !this.ground) this.used[def.once] = true;
    this.startMove(key);
  }

  startCharge() {
    const c = this.ctrl;
    this.chargeKey = c.y > 0.5 ? 'usmash' : c.y < -0.5 ? 'dsmash' : 'fsmash';
    if (Math.abs(c.x) > 0.3 && this.chargeKey === 'fsmash') this.dir = sign(c.x);
    this.charge = 0;
    this.setState('charge');
  }

  stepCharge() {
    this.vx = approach(this.vx, 0, 4000 * STEP);
    this.charge++;
    if (this.charge % 8 === 0) this.flash = 3;
    if (!this.ctrl.str || this.charge >= 60) {
      this.startMove(this.chargeKey, { mult: 1 + (this.charge / 60) * 0.5 });
      this.m.sfx('smash');
    }
    if (!this.ground) { this.charge = 0; this.setState('air'); }
  }

  stepMove(downTap) {
    const mv = this.move, d = mv.def, c = this.ctrl, ch = this.ch;
    mv.t++;
    const f = mv.t;
    const air = !this.ground;
    // 招式自带的位移
    if (d.vel && f >= d.vel.f0 && f <= d.vel.f1) {
      if (d.vel.x) this.vx = d.vel.x * this.dir;
      if (d.vel.y) { this.vy = d.vel.y; this.ground = null; }
      if (d.vel.x && d.vel.air && air) this.vy = Math.min(this.vy, 0) * 0.5;
      if (d.vel.ctrl) this.vx = c.x * d.vel.ctrl;
    } else if (this.ground) {
      this.vx = approach(this.vx, 0, 3000 * STEP);
    } else {
      if (Math.abs(c.x) > 0.2) this.vx = approach(this.vx, c.x * ch.air, ch.airAcc * 0.7 * STEP);
      if (downTap && this.vy > -150) { this.fastFall = true; this.vy = Math.max(this.vy, ch.ffall * 0.85); }
    }
    if (d.float && air && f > d.startup && f <= d.startup + d.active) this.vy = Math.min(this.vy, 160);
    // 各种特殊招
    if (d.teleport) {
      if (f < d.startup) { this.hidden = f > 3; this.invuln = Math.max(this.invuln, 2); this.vx *= 0.8; this.vy = Math.min(this.vy, 0) * 0.5; }
      if (f === d.startup) {
        let tx = c.x, ty = -c.y;
        const m = Math.hypot(tx, ty);
        if (m < 0.3) { tx = 0; ty = -1; } else { tx /= m; ty /= m; }
        this.m.fx.smoke(this.x, this.cy);
        this.x += tx * d.teleport;
        this.y += ty * d.teleport;
        this.ground = null;
        this.vx = tx * 200;
        this.vy = ty * 200;
        if (tx) this.dir = sign(tx);
        this.hidden = false;
        this.m.fx.smoke(this.x, this.cy);
        this.m.sfx('poof');
      }
    }
    if (d.pound && f > d.startup) {
      if (f === d.startup + 1 && this.ground) { this.vy = -620; this.ground = null; }
      else if (!this.ground) this.vy = Math.max(this.vy, f > d.startup + 6 ? 1750 : this.vy);
      else if (f > d.startup + 2) { this.m.fx.shock(this.x, this.y); this.m.shake(10); this.m.sfx('pound'); this.startMove('dspec2'); return; }
    }
    if (d.counter) this.countering = f >= d.startup && f < d.startup + d.active;
    if (d.throw && this.holding && f < d.startup) {
      this.holding.x = this.x + this.dir * (this.w / 2 + this.holding.w / 2 - 8);
      this.holding.y = this.y;
    }
    if (f === d.startup) {
      if (d.proj) this.m.spawnProj(this, d.proj);
      if (d.mine) this.m.placeMine(this);
      if (d.item) this.m.throwItem(this);
      if (d.throw) this.m.doThrow(this, d, mv.mult);
      if (d.pummel) this.m.pummel(this);
      if (d.steam) this.m.sfx('steam');
      if (d.boxes && !d.multi) this.m.sfx(d.smash ? 'swingBig' : 'swing');
    }
    if (d.steam && f > d.startup && f <= d.startup + d.active && f % 3 === 0) this.m.fx.steam(this.x + this.dir * 40 * ch.reach, this.cy - 14, this.dir);
    // 判定
    if (d.boxes && f > d.startup && f <= d.startup + d.active) {
      if (d.multi) {
        const n = Math.floor((f - d.startup - 1) / d.multi.every);
        if (n !== mv.multiN) { mv.multiN = n; mv.hit.clear(); if (f + d.multi.every <= d.startup + d.active) this.m.sfx('tap'); }
      }
      this.m.resolveHits(this, mv, f > d.startup + d.active - (d.multi ? d.multi.every : 0));
    }
    // 连续按 A 出三段拳
    if (mv.key === 'jab' && c.atkP && f > d.startup + 1 && this.jabN < 3) {
      this.jabN++;
      this.startMove(this.jabN === 3 ? 'jab3' : 'jab');
      return;
    }
    if (f >= d.total) {
      this.move = null;
      this.countering = false;
      if (d.helpless && !this.ground) this.setState('helpless');
      else this.setState(this.ground ? 'idle' : 'air');
    }
  }

  stepShield() {
    const c = this.ctrl;
    this.vx = approach(this.vx, 0, 5000 * STEP);
    if (this.shieldStun > 0) { this.shieldStun--; return; }
    this.shield -= 0.13;
    if (this.shield <= 0) { this.breakShield(); return; }
    if (c.jmpP) { this.setState('squat'); return; }
    if (c.atkP) { this.startMove('grab'); return; }
    const xTap = Math.abs(c.x) > 0.6 && Math.abs(this.prevCx) <= 0.6;
    if (xTap) {
      this.rollDir = sign(c.x);
      this.invuln = Math.max(this.invuln, 16);
      this.setState('roll');
      this.m.sfx('dodge');
      return;
    }
    if (c.y < -0.6 && this.prevCy >= -0.6) {
      this.invuln = Math.max(this.invuln, 14);
      this.setState('spot');
      this.m.sfx('dodge');
      return;
    }
    if (!c.shd && this.stateT > 4) this.setState('idle');
  }

  breakShield() {
    this.shield = 30;
    this.dizzy = 150;
    this.vy = -900;
    this.ground = null;
    this.setState('dizzy');
    this.m.fx.burst(this.x, this.cy, this.color, 40);
    this.m.sfx('shieldBreak');
    this.m.shake(12);
  }

  stepLedge() {
    const c = this.ctrl, L = this.ledge, inward = -L.side;
    this.vx = this.vy = this.kbx = this.kby = 0;
    this.x = L.x + L.side * (this.w / 2 - 4);
    this.y = L.y + this.h * 0.62;
    this.dir = inward;
    if (this.stateT < 8) return;
    if (c.jmpP || c.y > 0.6) {
      this.ledge = null;
      this.vy = -this.ch.jump * 1.05;
      this.vx = inward * 120;
      this.setState('air');
      this.m.sfx('jump');
    } else if (c.atkP) {
      this.climbAtk = true;
      this.setState('climb');
    } else if (c.x * inward > 0.6) {
      this.setState('climb');
    } else if (c.y < -0.6 || c.x * inward < -0.6 || this.stateT > 200) {
      this.ledge = null;
      this.ledgeCD = 30;
      this.setState('air');
    }
  }

  stepGrabbing() {
    const c = this.ctrl, t = this.holding;
    this.vx = 0;
    if (this.pummelCD > 0) this.pummelCD--;
    if (!t || t.heldBy !== this) { this.holding = null; this.setState('idle'); return; }
    t.x = this.x + this.dir * (this.w / 2 + t.w / 2 - 8);
    t.y = this.y;
    if (this.stateT < 8) return;
    const fx = c.x * this.dir;
    let key = null;
    if (c.y > 0.6) key = 'throwU';
    else if (c.y < -0.6) key = 'throwD';
    else if (fx > 0.6) key = 'throwF';
    else if (fx < -0.6) key = 'throwB';
    else if (c.atkP && this.pummelCD <= 0) { this.pummelCD = 14; this.m.pummel(this); }
    if (this.cpu && this.stateT > 30 && !key) key = this.aiThrow || 'throwF';
    if (key) this.startMove(key);
  }

  stepGrabbed() {
    const g = this.heldBy;
    if (!g || g.holding !== this || !g.alive) { this.heldBy = null; this.setState('air'); return; }
    if (this.ctrl.anyP || Math.abs(this.ctrl.x - this.prevCx) > 0.8) this.escape -= 8;
    if (--this.escape <= 0 && g.state === 'grabbing') this.m.release(g, true);
  }

  // ———————————————— 物理与碰撞 ————————————————
  physics() {
    const ch = this.ch, st = this.m.stage;
    const velMove = this.state === 'move' && this.move.def.vel && this.move.t >= this.move.def.vel.f0 && this.move.t <= this.move.def.vel.f1 && this.move.def.vel.y;
    const frozen = this.state === 'adodge' && this.stateT <= 14;
    if (!this.ground && !velMove && !frozen) {
      const g = ch.grav * (this.hitstun > 0 ? STUN_GRAV : 1);
      const maxFall = this.fastFall ? ch.ffall : ch.fall;
      if (this.vy < maxFall) this.vy = Math.min(maxFall, this.vy + g * STEP);
    }
    if (this.kbx || this.kby) {
      const m = Math.hypot(this.kbx, this.kby);
      const nm = Math.max(0, m - KB_DECAY * STEP);
      this.kbx *= nm / m;
      this.kby *= nm / m;
      if (nm < 1) this.kbx = this.kby = 0;
    }
    const px = this.x, py = this.y;
    let nx = px + (this.vx + this.kbx) * STEP;
    let ny = py + (this.vy + this.kby) * STEP;
    const fallV = this.vy + this.kby;

    if (this.ground) {
      ny = this.ground.y;
      const g = this.ground;
      if (nx < g.x1 - 2 || nx > g.x2 + 2) {
        this.ground = null;
        if (this.state === 'idle' || this.state === 'run') this.setState('air');
      }
    } else if (fallV >= 0) {
      // 落地：主平台 + 可穿透平台
      for (const p of st.surfaces) {
        if (!p.solid && (this.dropT > 0 || (this.ctrl.y < -0.6 && this.hitstun <= 0 && this.state !== 'hitstun'))) continue;
        if (py <= p.y + 1 && ny >= p.y && nx >= p.x1 - 4 && nx <= p.x2 + 4) {
          if (this.hitstun > 0 && fallV > 900 && this.kby > 300) {
            // 重摔在地面弹起
            ny = p.y;
            this.kby = -this.kby * 0.45;
            this.vy = Math.min(this.vy, 0);
            this.m.fx.dust(nx, p.y, 10);
            this.m.sfx('thud');
            break;
          }
          ny = p.y;
          this.onLand(p);
          break;
        }
      }
    }
    // 主平台侧面 / 底面（和地形碰撞时用比身体窄的碰撞盒，走出边缘时不会被“托”回平台上）
    const M = st.main, hw = this.w * 0.3;
    if (!this.ground && ny > M.y + 2 && ny - this.h < M.y + M.depth && nx + hw > M.x1 && nx - hw < M.x2) {
      if (py <= M.y + 2 && nx >= M.x1 && nx <= M.x2) { ny = M.y; this.onLand(M); }
      else if (py - this.h >= M.y + M.depth - 4) { ny = M.y + M.depth + this.h; this.vy = Math.max(0, this.vy); this.kby = Math.abs(this.kby) * 0.3; }
      else if (nx < (M.x1 + M.x2) / 2) { nx = M.x1 - hw; this.vx = Math.min(0, this.vx); this.kbx = -Math.abs(this.kbx) * 0.3; }
      else { nx = M.x2 + hw; this.vx = Math.max(0, this.vx); this.kbx = Math.abs(this.kbx) * 0.3; }
    }
    this.x = nx;
    this.y = ny;
    // 抓边
    if (!this.ground && this.ledgeCD === 0 && this.hitstun === 0 && (this.state === 'air' || this.state === 'helpless' || (this.state === 'move' && this.move.def.helpless && this.vy > -200))) {
      if (this.vy + this.kby > -250) this.m.tryLedge(this);
    }
    // 击飞拖尾
    const sp = Math.hypot(this.kbx, this.kby);
    if (this.hitstun > 0 && sp > 900) {
      this.trail.push(this.x, this.cy);
      if (this.trail.length > 24) this.trail.splice(0, 2);
      this.spin += this.dir * Math.min(0.5, sp / 9000);
    } else if (this.trail.length) this.trail.splice(0, 2);
    if (this.hitstun <= 0) this.spin = 0;
  }

  onLand(p) {
    const wasAir = !this.ground;
    this.ground = p;
    this.vy = 0;
    this.kby = 0;
    this.kbx *= 0.4;
    if (!wasAir) return;
    this.land();
    const s = this.state;
    if (s === 'move') {
      const d = this.move.def;
      if (d.landLag) { this.move = null; this.lag = d.landLag; this.setState('land'); }
      else if (d.helpless) { this.move = null; this.lag = 14; this.setState('land'); }
    } else if (s === 'helpless') { this.lag = 14; this.setState('land'); }
    else if (s === 'hitstun') { this.hitstun = 0; this.lag = 10; this.setState('land'); }
    else if (s === 'adodge') { this.lag = 10; this.setState('land'); }
    else if (s === 'air') { this.lag = 3; this.setState('land'); this.m.fx.dust(this.x, this.y, 4); }
  }
}

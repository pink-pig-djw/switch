// 《茶室大乱斗》CPU：只往角色的 ctrl 里“按键”，和玩家走同一套规则，不偷看、不作弊。
// 难度决定反应时间、防御概率、连招 / 蓄力意愿和回场失误率。
import { mulberry32 } from '../../ui.js';

const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const RECOVER_REACH = { orange: 360, bear: 300, ninja: 280, rabbit: 500 };
const HAS_PROJ = { orange: true, ninja: true, rabbit: true, bear: false };

export class Brain {
  constructor(f, m, d, seed) {
    this.f = f;
    this.m = m;
    this.d = d;
    this.rng = mulberry32(seed);
    this.target = null;
    this.retarget = 0;
    this.wait = Math.floor(this.rng() * 20);
    this.plan = null;
    this.hold = { x: 0, y: 0, shd: false, str: false, jmp: false };
    this.recov = null;
    this.ledgeWait = 0;
    this.respawnWait = 0;
    this.dangerSeen = null;
  }

  diSkill() { return this.d.di; }

  pickThrow(t) {
    const M = this.m.stage.main, f = this.f;
    const nearEdge = Math.min(Math.abs(f.x - M.x1), Math.abs(f.x - M.x2)) < 220;
    const kill = t.percent > 95 * (t.ch.weight / 100);
    if ((kill || nearEdge) && this.rng() < 0.7) {
      const edgeDir = Math.abs(f.x - M.x1) < Math.abs(f.x - M.x2) ? -1 : 1;
      return edgeDir === f.dir ? 'throwF' : 'throwB';
    }
    if (t.percent < 60 && this.rng() < this.d.combo) return this.rng() < 0.5 ? 'throwD' : 'throwU';
    return this.rng() < 0.5 ? 'throwF' : 'throwU';
  }

  pickTarget() {
    const f = this.f;
    let best = null, bd = Infinity;
    for (const o of this.m.fighters) {
      if (o === f || !o.alive || o.stocks <= 0) continue;
      let d = Math.hypot(o.x - f.x, o.cy - f.cy);
      if (o.state === 'respawn' || o.invuln > 60) d += 900;
      if (o === this.target) d *= 0.75;
      if (d < bd) { bd = d; best = o; }
    }
    this.target = best;
  }

  think() {
    const f = this.f, c = f.ctrl, d = this.d, m = this.m;
    c.atkP = c.spP = c.strP = c.strR = c.jmpP = c.shdP = c.anyP = false;
    const M = m.stage.main;
    if (f.ground) this.recov = null;

    // ——— 不需要反应时间的“本能” ———
    if (f.state === 'grabbed' || f.state === 'dizzy') {
      c.x = 0; c.y = 0;
      if (this.rng() < 0.15 + d.aggro * 0.3) c.anyP = c.atkP = true;
      return;
    }
    if (f.state === 'hitstun') {
      // 受击方向修正：往回、往上推
      const r = this.rng() < d.di;
      c.x = r ? -sign(f.kbx) : 0;
      c.y = r ? 1 : 0;
      c.shd = c.str = c.jmp = false;
      return;
    }
    if (f.state === 'respawn') {
      if (!this.respawnWait) this.respawnWait = 25 + Math.floor(this.rng() * 70);
      if (--this.respawnWait <= 0) { c.y = -1; this.respawnWait = 0; } else c.y = 0;
      c.x = 0;
      return;
    }
    if (f.state === 'ledge') {
      c.x = 0; c.y = 0;
      if (!this.ledgeWait) this.ledgeWait = 6 + Math.floor(this.rng() * (12 + d.react * 1.5));
      if (--this.ledgeWait <= 0) {
        this.ledgeWait = 0;
        const r = this.rng();
        if (r < 0.55) c.x = -f.ledge.side;
        else if (r < 0.8) c.jmpP = true;
        else c.atkP = true;
      }
      return;
    }
    if (f.state === 'grabbing') {
      c.x = 0; c.y = 0;
      if (f.stateT > 8 && f.stateT < 26 && this.rng() < 0.12 * d.combo) c.atkP = true;
      return;
    }
    if (f.state === 'charge' && this.plan && this.plan.type === 'charge') {
      if (--this.plan.t <= 0) { c.str = false; c.strR = true; this.plan = null; } else c.str = true;
      return;
    }
    // 瞬移（影跃）的方向：对准边缘
    if (f.state === 'move' && f.move.key === 'uspec' && f.move.def.teleport) {
      const ex = f.x < 0 ? M.x1 + 10 : M.x2 - 10;
      const dx = ex - f.x, dy = (M.y - 30) - f.cy, l = Math.hypot(dx, dy) || 1;
      const offstage = f.x < M.x1 || f.x > M.x2 || f.y > M.y;
      if (offstage) { c.x = dx / l; c.y = -dy / l; } else { c.x = 0; c.y = 1; }
      return;
    }

    // ——— 回场 ———
    const offstage = !f.ground && (f.x < M.x1 - 6 || f.x > M.x2 + 6 || f.y > M.y + 24);
    if (offstage && (f.state === 'air' || f.state === 'helpless' || f.state === 'move' || f.state === 'adodge')) {
      this.recover();
      return;
    }

    if (!this.target || --this.retarget <= 0 || !this.target.alive) {
      this.pickTarget();
      this.retarget = 45 + Math.floor(this.rng() * 60);
    }
    const t = this.target;
    if (!t) { c.x = 0; c.y = 0; c.shd = false; return; }

    // ——— 正在执行的计划 ———
    if (this.plan) {
      if (this.runPlan(t)) return;
    }

    // ——— 防守：看到对手出招 / 飞行道具 ———
    if (f.ground && (f.state === 'idle' || f.state === 'run' || f.state === 'shield')) {
      const danger = this.danger();
      if (danger && danger !== this.dangerSeen) {
        this.dangerSeen = danger;
        if (this.rng() < d.shield) {
          if (f.shield < 22) {
            c.shd = true;
            this.plan = { type: 'roll', t: 2, dir: -sign(danger.x - f.x) || 1 };
          } else {
            this.plan = { type: 'shield', t: 10 + Math.floor(this.rng() * 14) };
          }
          c.shd = true;
          return;
        }
      }
    }
    c.shd = false;

    if (this.wait > 0) {
      this.wait--;
      c.x = this.hold.x;
      c.y = this.hold.y;
      this.safety();
      return;
    }
    this.decide(t);
    this.hold.x = c.x;
    this.hold.y = c.y;
    this.safety();
  }

  // 站在主平台边上时不要自己走下去
  safety() {
    const f = this.f, c = f.ctrl, M = this.m.stage.main;
    if (f.ground === M) {
      if ((c.x < 0 && f.x - 30 < M.x1 + 6) || (c.x > 0 && f.x + 30 > M.x2 - 6)) {
        if (!this.plan || this.plan.type !== 'edgeJump') c.x = 0;
      }
    }
  }

  danger() {
    const f = this.f;
    for (const o of this.m.fighters) {
      if (o === f || !o.alive) continue;
      const dx = f.x - o.x, dy = f.cy - o.cy;
      if (Math.abs(dx) > 200 || Math.abs(dy) > 150) continue;
      if (o.state === 'move' && o.move.def.boxes && !o.move.def.grab) {
        const mv = o.move, dd = mv.def;
        if (mv.t < dd.startup + dd.active && (dd.radial || sign(dx) === o.dir || dd.back)) return o;
      }
      if (o.state === 'charge' && Math.abs(dx) < 140) return o;
    }
    for (const p of this.m.projs) {
      if (p.owner === f) continue;
      const dx = f.x - p.x;
      if (Math.abs(dx) < 260 && Math.abs(f.cy - p.y) < 90 && sign(p.vx) === sign(dx)) return p;
    }
    return null;
  }

  runPlan(t) {
    const f = this.f, c = f.ctrl, p = this.plan;
    p.t--;
    switch (p.type) {
      case 'shield':
        c.shd = true; c.x = 0; c.y = 0;
        if (p.t <= 0) { this.plan = null; c.shd = false; this.wait = Math.floor(this.d.react * 0.4); }
        return true;
      case 'roll':
        c.shd = true;
        c.x = p.t <= 0 ? p.dir : 0;
        if (p.t <= -1) { this.plan = null; c.shd = false; c.x = 0; }
        return true;
      case 'grab':
        c.shd = true; c.x = 0; c.y = 0;
        if (p.t <= 0) { c.atkP = true; this.plan = null; this.wait = this.d.react; }
        return true;
      case 'proj':
        if (p.t > 0) { c.x = p.face; c.y = 0; }
        else { c.x = 0; c.y = 0; c.spP = true; this.plan = null; this.wait = Math.floor(this.d.react * 1.2); }
        return true;
      case 'jumpAtk': {
        const dx = t.x - f.x, dy = t.cy - f.cy;
        c.x = sign(dx);
        if (f.ground && p.t > 10) return true;
        if (!f.ground && (Math.hypot(dx, dy) < 110 || p.t <= 0)) {
          this.aerial(t);
          this.plan = null;
          this.wait = Math.floor(this.d.react * 0.7);
        } else if (p.t <= -20) this.plan = null;
        return true;
      }
      case 'edgeJump':
        c.x = p.dir;
        if (p.t === 6) c.jmpP = true;
        if (p.t <= 0) { this.plan = { type: 'jumpAtk', t: 14 }; }
        return true;
      default:
        this.plan = null;
        return false;
    }
  }

  aerial(t) {
    const f = this.f, c = f.ctrl;
    const dx = t.x - f.x, dy = t.cy - f.cy;
    c.atkP = true;
    if (dy < -50 && Math.abs(dx) < 70) { c.y = 1; c.x = 0; }
    else if (dy > 50 && Math.abs(dx) < 70) { c.y = -1; c.x = 0; }
    else if (sign(dx) === f.dir) { c.x = f.dir; c.y = 0; }
    else if (Math.abs(dx) > 20) { c.x = -f.dir; c.y = 0; }
    else { c.x = 0; c.y = 0; }
  }

  decide(t) {
    const f = this.f, c = f.ctrl, d = this.d, m = this.m, M = m.stage.main;
    const r = this.rng;
    const dx = t.x - f.x, dy = t.cy - f.cy, adx = Math.abs(dx), face = sign(dx) || f.dir;
    const reach = f.ch.reach;
    const killPct = 105 * (t.ch.weight / 100) - (Math.min(Math.abs(t.x - M.x1), Math.abs(t.x - M.x2)) < 200 ? 25 : 0);
    const free = f.state === 'idle' || f.state === 'run' || f.state === 'air';
    c.x = 0; c.y = 0;
    if (!free) { this.wait = 2; return; }
    const tOff = t.x < M.x1 || t.x > M.x2 || t.y > M.y + 20;

    if (f.ground) {
      if (r() > d.aggro && adx > 160) { this.wait = Math.floor(d.react * (1 + r())); return; }   // 偶尔观望
      if (t.state === 'shield' && adx < 80 * reach && Math.abs(dy) < 60 && r() < 0.35 + d.combo * 0.4) {
        this.plan = { type: 'grab', t: 2 };
        c.shd = true;
        return;
      }
      if (adx < 78 * reach && Math.abs(dy) < 60) {
        if (t.percent > killPct && r() < d.smash) {
          c.x = face;
          c.strP = true;
          c.str = true;
          this.plan = { type: 'charge', t: 2 + Math.floor(r() * 22 * (1.2 - d.combo)) };
          return;
        }
        const k = r();
        if (t.ground == null && dy < -20) { c.y = 1; c.atkP = true; }
        else if (k < 0.32) { c.x = 0; c.atkP = true; if (f.dir !== face) { c.x = face; c.atkP = false; } }
        else if (k < 0.62) { c.x = face; c.atkP = true; }
        else if (k < 0.82) { c.y = -1; c.atkP = true; }
        else { this.plan = { type: 'grab', t: 2 }; c.shd = true; return; }
        this.wait = Math.floor(d.react * (0.6 + r() * 0.6));
        return;
      }
      if (adx < 95 && dy < -60 && dy > -230) {
        if (t.percent > killPct + 10 && r() < d.smash) { c.y = 1; c.strP = true; c.str = true; this.plan = { type: 'charge', t: 2 + Math.floor(r() * 10) }; return; }
        if (dy > -140) { c.y = 1; c.atkP = true; this.wait = d.react; return; }
      }
      if (dy < -150 && adx < 200 || (adx < 140 && dy < -40 && r() < d.combo)) {
        c.x = face;
        c.jmpP = true;
        c.jmp = r() < 0.7;
        this.plan = { type: 'jumpAtk', t: 26 };
        return;
      }
      if (f.state === 'run' && adx < 190 && adx > 80 && Math.abs(dy) < 60 && r() < 0.3) {
        c.x = face;
        c.atkP = true;
        this.wait = d.react;
        return;
      }
      // 远处：飞行道具 / 地雷 / 冲刺
      if (adx > 220 && adx < 720 && Math.abs(dy) < 140 && HAS_PROJ[f.ch.id] && r() < 0.06 + d.aggro * 0.06) {
        this.plan = { type: 'proj', t: f.dir === face ? 0 : 1, face };
        c.x = face;
        return;
      }
      if (f.ch.id === 'rabbit' && adx > 260 && r() < 0.015 && !this.m.mines.some((q) => q.owner === f)) {
        c.y = -1;
        c.spP = true;
        this.wait = d.react;
        return;
      }
      if (adx > 300 && adx < 560 && Math.abs(dy) < 40 && f.ch.id !== 'rabbit' && r() < 0.012) {
        c.x = face;
        c.spP = true;
        this.wait = d.react;
        return;
      }
      // 守边：对手在场外下方时跳出去打一下（困难才会）
      if (tOff && adx < 260 && d.combo > 0.6 && r() < 0.03 && t.y > M.y - 40) {
        this.plan = { type: 'edgeJump', t: 10, dir: face };
        return;
      }
      // 平台：对手在下面就穿下去
      if (dy > 110 && f.ground && !f.ground.solid && adx < 300) {
        c.y = -1;
        this.wait = 4;
        return;
      }
      // 接近
      c.x = tOff ? (adx > 120 ? face * 0.6 : 0) : face;
      this.wait = Math.floor(d.react * 0.5) + 2;
      return;
    }

    // 空中（场内）
    const dist = Math.hypot(dx, dy);
    c.x = face;
    if (dist < 105 && r() < 0.6 + d.aggro * 0.3) {
      this.aerial(t);
      this.wait = Math.floor(d.react * 0.8);
      return;
    }
    if (f.jumps > 0 && dy < -120 && adx < 220 && f.vy > -100 && r() < 0.3) { c.jmpP = true; c.jmp = true; this.plan = { type: 'jumpAtk', t: 18 }; return; }
    if (dy > 140 && adx < 120 && f.vy > -50 && r() < 0.4) c.y = -1;   // 快速下落
    this.wait = 3;
  }

  recover() {
    const f = this.f, c = f.ctrl, d = this.d, M = this.m.stage.main;
    const left = f.x < (M.x1 + M.x2) / 2;
    const edgeX = left ? M.x1 : M.x2;
    const toward = left ? 1 : -1;
    const dist = Math.abs(edgeX - f.x);
    const below = f.y - M.y;
    c.x = toward;
    c.y = 0;
    c.shd = c.str = false;
    c.jmp = true;
    if (!this.recov) this.recov = { fail: this.rng() < d.fail, t: 0 };
    this.recov.t++;
    // 被打到平台正下方：先往外侧绕出来，不然往上冲会撞到平台底面
    const hw = f.w * 0.3 + 6;
    const under = f.x > M.x1 - hw && f.x < M.x2 + hw && f.y - f.h > M.y + 6;
    if (under) {
      const out = f.x < (M.x1 + M.x2) / 2 ? -1 : 1;
      c.x = out;
      if (f.state === 'helpless' || f.state === 'move' || f.state === 'adodge') return;
      if (f.jumps > 0 && f.vy > 300 && f.y > M.y + M.depth + 260) c.jmpP = true;
      return;
    }
    if (f.state === 'helpless' || f.state === 'move' || f.state === 'adodge') return;
    if (this.recov.fail && this.recov.t > 20) return;
    const reach = RECOVER_REACH[f.ch.id];
    // 先用侧必杀拉近水平距离，二段跳留到快掉到平台高度时再用，最后上必杀
    if (dist > 240 && below < 160 && below > -500 && !f.used.s && f.ch.id !== 'rabbit' && f.vy > -300 && f.kbx * toward >= -100) {
      c.x = toward;
      c.spP = true;
      return;
    }
    if (f.jumps > 0 && f.vy > -60 && (below > -140 || (dist > 480 && below > -320))) { c.jmpP = true; return; }
    if (f.jumps === 0 && !f.used.u && f.vy > -150 && (below > -60 || dist > reach * 0.8)) {
      c.y = 1;
      c.x = 0;
      c.spP = true;
    }
  }
}

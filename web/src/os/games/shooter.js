// 星际射击：横版射击，敌人波次 + Boss
import { GameBase, drawTitleCard, drawResult, Particles } from './common.js';
import { W, H, clamp, damp, lerp, text, fillRR, strokeRR, axisX, axisY, outlineText, makeCanvas, easeOutBack, easeOutCubic, mulberry32 } from '../ui.js';

const SPEED = 430;

function drawShip(c, x, y, s = 1, tilt = 0, flame = 1) {
  c.save();
  c.translate(x, y);
  c.rotate(tilt * 0.18);
  c.scale(s, s);
  // 尾焰
  const fl = 10 + flame * 10 + Math.random() * 6;
  const fg = c.createLinearGradient(-18 - fl, 0, -14, 0);
  fg.addColorStop(0, 'rgba(255,120,30,0)');
  fg.addColorStop(1, 'rgba(255,200,80,0.95)');
  c.fillStyle = fg;
  c.beginPath();
  c.moveTo(-14, -6);
  c.lineTo(-18 - fl, 0);
  c.lineTo(-14, 6);
  c.closePath();
  c.fill();
  // 机身
  c.fillStyle = '#f4f6fb';
  c.beginPath();
  c.moveTo(30, 0);
  c.lineTo(6, -8);
  c.lineTo(-10, -20);
  c.lineTo(-18, -20);
  c.lineTo(-12, -7);
  c.lineTo(-18, -6);
  c.lineTo(-18, 6);
  c.lineTo(-12, 7);
  c.lineTo(-18, 20);
  c.lineTo(-10, 20);
  c.lineTo(6, 8);
  c.closePath();
  c.fill();
  c.fillStyle = '#ff7a1a';
  c.beginPath();
  c.moveTo(-10, -20);
  c.lineTo(-2, -12);
  c.lineTo(-8, -10);
  c.lineTo(-18, -20);
  c.closePath();
  c.moveTo(-10, 20);
  c.lineTo(-2, 12);
  c.lineTo(-8, 10);
  c.lineTo(-18, 20);
  c.closePath();
  c.fill();
  c.fillRect(-6, -2, 26, 4);
  c.fillStyle = '#39c6ff';
  c.beginPath();
  c.ellipse(8, 0, 8, 4.5, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.beginPath();
  c.ellipse(10, -1.5, 3, 1.5, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function drawShooterTile(c, s) {
  const k = s / 256;
  c.save();
  c.scale(k, k);
  const g = c.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, '#0b1030');
  g.addColorStop(1, '#2a1150');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  const rnd = mulberry32(7);
  for (let i = 0; i < 70; i++) {
    c.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`;
    c.fillRect(rnd() * 256, rnd() * 256, rnd() < 0.2 ? 2 : 1, rnd() < 0.2 ? 2 : 1);
  }
  const pg = c.createRadialGradient(196, 58, 4, 196, 70, 54);
  pg.addColorStop(0, '#ffb36b');
  pg.addColorStop(1, '#a03a6a');
  c.fillStyle = pg;
  c.beginPath();
  c.arc(200, 70, 44, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(255,220,180,0.6)';
  c.lineWidth = 4;
  c.beginPath();
  c.ellipse(200, 70, 70, 14, -0.3, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = '#ffde7a';
  for (let i = 0; i < 4; i++) c.fillRect(110 + i * 26, 128, 14, 4);
  drawShip(c, 70, 130, 1.7, 0, 1);
  c.fillStyle = '#ff5fa2';
  for (const [x, y] of [[196, 140], [214, 122], [214, 158]]) {
    c.beginPath();
    c.arc(x, y, 5, 0, Math.PI * 2);
    c.fill();
  }
  outlineText(c, '星际射击', 128, 220, 42, '#ffffff', '#3b2a8a', 8);
  c.restore();
}

export class Shooter extends GameBase {
  static meta = { id: 'shooter', name: '星际射击', kind: 'game', color: '#3b2a8a', tile: drawShooterTile };

  constructor(os) {
    super(os);
    this.parts = new Particles(800);
    this.rings = [];
    const rnd = mulberry32(42);
    this.stars = [0, 1, 2].map((layer) => Array.from({ length: 50 + layer * 25 }, () => ({
      x: rnd() * W, y: rnd() * H, s: layer + 1, a: 0.3 + rnd() * 0.7,
    })));
    this.nebula = this._makeNebula();
    this.resetGame();
    this.setMode('title');
  }

  _makeNebula() {
    const cv = makeCanvas(W, H);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#070a1f');
    g.addColorStop(1, '#140a2c');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const rnd = mulberry32(9);
    const cols = ['rgba(120,60,200,', 'rgba(40,120,200,', 'rgba(200,60,140,', 'rgba(40,180,170,'];
    for (let i = 0; i < 14; i++) {
      const x = rnd() * W, y = rnd() * H, r = 120 + rnd() * 260;
      const col = cols[i % cols.length];
      for (const ox of [-W, 0, W]) {
        const rg = c.createRadialGradient(x + ox, y, 0, x + ox, y, r);
        rg.addColorStop(0, col + '0.16)');
        rg.addColorStop(1, col + '0)');
        c.fillStyle = rg;
        c.fillRect(x + ox - r, y - r, r * 2, r * 2);
      }
    }
    return cv;
  }

  resetGame() {
    this.score = 0;
    this.lives = 3;
    this.bombs = 3;
    this.power = 1;
    this.loop = 0;
    this.player = { x: 170, y: 380, inv: 2, dead: false, respawn: 0, fireCd: 0, tilt: 0 };
    this.bullets = [];
    this.ebullets = [];
    this.enemies = [];
    this.items = [];
    this.rings = [];
    this.boss = null;
    this.bossPending = 0;
    this.bombT = 0;
    this.flashT = 0;
    this.shake = 0;
    this.banner = null;
    this.scroll = 0;
    this._newStage();
    this.parts.clear();
  }

  _newStage() {
    this.stageT = 0;
    this.script = this._makeScript();
    this.scriptIdx = 0;
  }

  start() {
    this.resetGame();
    this.setMode('play');
    this.banner = { text: '第 1 区域 出击！', t: 0, dur: 2 };
  }

  _makeScript() {
    const s = [];
    let t = 1.6;
    const at = (dt, fn, wait = false) => { t += dt; s.push({ at: t, fn, wait }); };
    const L = this.loop;
    for (let i = 0; i < 6; i++) at(0.3, () => this.spawn('drone', 1330, 190, { phase: i * 0.5 }));
    at(1.4, () => {});
    for (let i = 0; i < 6; i++) at(0.3, () => this.spawn('drone', 1330, 530, { phase: i * 0.5 + Math.PI }));
    at(1.8, () => this.spawn('swooper', 1330, 140));
    at(0.5, () => this.spawn('swooper', 1330, 600));
    at(0.5, () => this.spawn('swooper', 1330, 260));
    at(0.5, () => this.spawn('swooper', 1330, 480));
    at(1.5, () => { this.spawn('turret', 1330, 200, { tx: 1060 }); this.spawn('turret', 1330, 520, { tx: 1060 }); });
    for (let i = 0; i < 8; i++) at(0.22, () => this.spawn('drone', 1330, 360 + (i % 2 ? 1 : -1) * (40 + i * 22), { amp: 30 }));
    at(2.2, () => this.spawn('heavy', 1360, 360));
    for (let i = 0; i < 5; i++) at(0.5, () => this.spawn('swooper', 1330, 120 + i * 120));
    at(2.5, () => { this.spawn('turret', 1330, 130, { tx: 1100 }); this.spawn('turret', 1330, 360, { tx: 980 }); this.spawn('turret', 1330, 590, { tx: 1100 }); });
    for (let i = 0; i < 10; i++) at(0.25, () => this.spawn('drone', 1330, 120 + ((i * 97) % 480), { amp: 80 }));
    at(2.5, () => { this.spawn('heavy', 1360, 220); this.spawn('heavy', 1360, 520); });
    if (L > 0) for (let i = 0; i < 6; i++) at(0.35, () => this.spawn('swooper', 1330, 100 + i * 100));
    at(2, () => this._bossWarning(), true);
    return s;
  }

  spawn(type, x, y, o = {}) {
    const e = { type, x, y, y0: y, t: 0, phase: 0, amp: 60, fireT: 0.8 + Math.random() * 0.8, hit: 0, ...o };
    switch (type) {
      case 'drone': e.hp = 2; e.r = 18; e.score = 100; break;
      case 'swooper': e.hp = 3; e.r = 20; e.score = 150; break;
      case 'turret': e.hp = 10; e.r = 24; e.score = 300; break;
      case 'heavy': e.hp = 34; e.r = 42; e.score = 1000; break;
      default: e.hp = 2; e.r = 18; e.score = 100;
    }
    e.hp *= 1 + this.loop * 0.45;
    e.max = e.hp;
    this.enemies.push(e);
    return e;
  }

  _bossWarning() {
    this.banner = { text: '警告：巨型战舰接近！', t: 0, dur: 2.6, warn: true };
    this.bossPending = 2.6;
    this.sfx.play('boss');
  }

  _spawnBoss() {
    const hp = 460 * (1 + this.loop * 0.6);
    this.boss = { x: 1520, y: 360, t: 0, hp, max: hp, fireA: 0, fireB: 0, spin: 0, hit: 0, dead: false, deathT: 0 };
  }

  update(dt, pad) {
    this.t += dt;
    this.modeT += dt;
    this.scroll += dt;
    this.parts.update(dt);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.dur);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
    if (this.mode === 'title') {
      this.player.y = 380 + Math.sin(this.t * 1.5) * 30;
      if (pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      return;
    }
    if (this.mode === 'over') {
      if (this.modeT > 0.6 && pad.pressed.A) { this.sfx.play('confirm'); this.start(); }
      else if (this.modeT > 0.6 && pad.pressed.B) { this.sfx.play('back'); this.resetGame(); this.setMode('title'); }
      return;
    }
    this._play(dt, pad);
    if (this.mode === 'dying') {
      if (this.modeT > 1.6) {
        this.submitScore(this.score);
        this.sfx.play('gameover');
        this.setMode('over');
      }
    }
  }

  _play(dt, pad) {
    const P = this.player;
    this.stageT += dt;
    // 脚本
    while (this.scriptIdx < this.script.length && this.stageT >= this.script[this.scriptIdx].at) {
      const ev = this.script[this.scriptIdx];
      if (ev.wait && this.enemies.length > 0) {
        this.stageT = ev.at;
        break;
      }
      this.scriptIdx++;
      ev.fn();
    }
    if (this.bossPending > 0) {
      this.bossPending -= dt;
      if (this.bossPending <= 0) this._spawnBoss();
    }

    // 玩家
    if (P.dead) {
      P.respawn -= dt;
      if (P.respawn <= 0 && this.mode === 'play') {
        P.dead = false;
        P.inv = 2.4;
        P.x = 150;
        P.y = 380;
      }
    } else if (this.mode === 'play') {
      let mx = axisX(pad), my = -axisY(pad);
      const m = Math.hypot(mx, my);
      if (m > 1) { mx /= m; my /= m; }
      P.x = clamp(P.x + mx * SPEED * dt, 34, W - 40);
      P.y = clamp(P.y + my * SPEED * dt, 96, H - 26);
      P.tilt = damp(P.tilt, my, 10, dt);
      P.inv = Math.max(0, P.inv - dt);
      P.fireCd -= dt;
      if (pad.down.A && P.fireCd <= 0) {
        P.fireCd = 0.085;
        this._fire();
      }
      if (pad.pressed.B && this.bombs > 0 && this.bombT <= 0) this._bomb();
    }
    this.bombT = Math.max(0, this.bombT - dt);

    // 子弹
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x > W + 30 || b.y < 60 || b.y > H + 20) b.dead = true;
    }
    for (const b of this.ebullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -30 || b.x > W + 30 || b.y < 40 || b.y > H + 30) b.dead = true;
      if (this.bombT > 0.35) {
        b.dead = true;
        this.parts.emit(b.x, b.y, 1, { color: '#ffe08a', speed: 40, life: 0.3, size: 4 });
      }
    }

    // 敌人
    for (const e of this.enemies) this._enemy(e, dt);
    if (this.boss) this._boss(dt);

    // 子弹命中
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = b.x - e.x, dy = b.y - e.y;
        if (dx * dx + dy * dy < (e.r + 6) * (e.r + 6)) {
          b.dead = true;
          this._damage(e, 1);
          break;
        }
      }
      const B = this.boss;
      if (!b.dead && B && !B.dead && B.x < W + 60) {
        const dx = (b.x - B.x) / 120, dy = (b.y - B.y) / 78;
        if (dx * dx + dy * dy < 1) {
          b.dead = true;
          B.hp -= 1;
          B.hit = 1;
          this.score += 10;
          this.parts.emit(b.x, b.y, 2, { color: '#9fe8ff', speed: 160, life: 0.2, size: 3 });
          if (B.hp <= 0) this._killBoss();
        }
      }
    }

    // 玩家受伤
    if (!P.dead && P.inv <= 0 && this.mode === 'play') {
      let hit = false;
      for (const b of this.ebullets) {
        if (b.dead) continue;
        const dx = b.x - P.x, dy = b.y - P.y;
        if (dx * dx + dy * dy < (b.r * 0.75 + 5) ** 2) { hit = true; b.dead = true; break; }
      }
      if (!hit) for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = e.x - P.x, dy = e.y - P.y;
        if (dx * dx + dy * dy < (e.r * 0.8 + 10) ** 2) { hit = true; this._damage(e, 12); break; }
      }
      const B = this.boss;
      if (!hit && B && !B.dead) {
        const dx = (P.x - B.x) / 110, dy = (P.y - B.y) / 66;
        if (dx * dx + dy * dy < 1) hit = true;
      }
      if (hit) this._playerHit();
    }

    // 道具
    for (const it of this.items) {
      it.t += dt;
      it.x -= 110 * dt;
      it.y += Math.sin(it.t * 3) * 30 * dt;
      if (it.x < -30) it.dead = true;
      if (!P.dead) {
        const dx = it.x - P.x, dy = it.y - P.y;
        if (dx * dx + dy * dy < 34 * 34) {
          it.dead = true;
          this.sfx.play('powerup');
          if (it.k === 'P') {
            if (this.power < 3) this.power++;
            else this.score += 1000;
          } else this.bombs = Math.min(5, this.bombs + 1);
          this.parts.emit(it.x, it.y, 14, { color: it.k === 'P' ? '#ffb347' : '#ff5f7e', speed: 200, life: 0.4, size: 5 });
        }
      }
    }

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.ebullets = this.ebullets.filter((b) => !b.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.items = this.items.filter((i) => !i.dead);
  }

  _fire() {
    const P = this.player;
    const add = (dy, ang) => this.bullets.push({ x: P.x + 26, y: P.y + dy, vx: Math.cos(ang) * 1150, vy: Math.sin(ang) * 1150, dead: false });
    if (this.power === 1) add(0, 0);
    else if (this.power === 2) { add(-7, 0); add(7, 0); }
    else { add(-8, 0); add(8, 0); add(-4, -0.12); add(4, 0.12); }
    this.sfx.play('shoot', { minGap: 0.07 });
  }

  _bomb() {
    this.bombs--;
    this.bombT = 1.0;
    this.flashT = 0.35;
    this.shake = 0.7;
    this.player.inv = Math.max(this.player.inv, 1.4);
    this.sfx.play('bomb');
    this.rings.push({ x: this.player.x, y: this.player.y, t: 0, dur: 0.7, r: 900, color: '255,240,200' });
    for (const e of this.enemies) this._damage(e, 26);
    if (this.boss && !this.boss.dead && this.boss.x < W) {
      this.boss.hp -= 60;
      this.boss.hit = 1;
      if (this.boss.hp <= 0) this._killBoss();
    }
  }

  _damage(e, n) {
    if (e.dead) return;
    e.hp -= n;
    e.hit = 1;
    if (e.hp <= 0) {
      e.dead = true;
      this.score += Math.round(e.score * (1 + this.loop * 0.5));
      const big = e.type === 'heavy';
      this._explode(e.x, e.y, big ? 1.6 : 0.8);
      if (big || Math.random() < 0.07) this.items.push({ x: e.x, y: e.y, k: big || Math.random() < 0.6 ? 'P' : 'B', t: 0, dead: false });
    } else {
      this.sfx.play('hit', { minGap: 0.05 });
    }
  }

  _explode(x, y, size = 1) {
    this.parts.emit(x, y, Math.round(18 * size), { color: ['#ffd166', '#ff8a3d', '#ffffff', '#ff5f5f'], speed: 260 * size, life: 0.55, size: 6 * size, drag: 2.5, shape: 'circle' });
    this.rings.push({ x, y, t: 0, dur: 0.4, r: 60 * size, color: '255,200,120' });
    this.sfx.play('explode', { big: size > 1.2, minGap: 0.04 });
  }

  _playerHit() {
    const P = this.player;
    this._explode(P.x, P.y, 1.5);
    this.shake = 0.6;
    P.dead = true;
    P.respawn = 1.3;
    this.lives--;
    this.power = Math.max(1, this.power - 1);
    this.bombs = Math.max(this.bombs, 2);
    this.ebullets = [];
    if (this.lives <= 0) this.setMode('dying');
  }

  _aim(x, y) {
    return Math.atan2(this.player.y - y, this.player.x - x);
  }

  _shoot(x, y, ang, sp, r = 6, color = 'pink') {
    this.ebullets.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r, color, dead: false });
  }

  _enemy(e, dt) {
    e.t += dt;
    e.hit = Math.max(0, e.hit - dt * 6);
    const L = this.loop;
    if (e.type === 'drone') {
      e.x -= (250 + L * 25) * dt;
      e.y = e.y0 + Math.sin(e.t * 3 + e.phase) * e.amp;
      if (L > 0) {
        e.fireT -= dt;
        if (e.fireT <= 0) { e.fireT = 2.2; this._shoot(e.x, e.y, this._aim(e.x, e.y), 240); }
      }
    } else if (e.type === 'swooper') {
      e.x -= 330 * dt;
      if (e.x < 1000) e.y = damp(e.y, this.player.y, 1.3, dt);
      e.fireT -= dt;
      if (e.fireT <= 0 && e.x < 1150) { e.fireT = 99; this._shoot(e.x, e.y, this._aim(e.x, e.y), 280 + L * 30); }
    } else if (e.type === 'turret') {
      if (e.x > e.tx) e.x = Math.max(e.tx, e.x - 320 * dt);
      if (e.t > 7.5) e.y += (e.y0 < 360 ? -1 : 1) * 220 * dt;
      e.fireT -= dt;
      if (e.fireT <= 0 && e.x <= e.tx + 2 && e.t < 7.5) {
        e.fireT = 1.15 - Math.min(0.4, L * 0.15);
        const a = this._aim(e.x, e.y);
        const n = L > 0 ? 3 : 1;
        for (let i = 0; i < n; i++) this._shoot(e.x - 20, e.y, a + (i - (n - 1) / 2) * 0.16, 270 + L * 30);
      }
    } else if (e.type === 'heavy') {
      e.x -= (e.x > 1000 ? 120 : 34) * dt;
      e.y = e.y0 + Math.sin(e.t * 0.8) * 70;
      e.fireT -= dt;
      if (e.fireT <= 0 && e.x < W - 40) {
        e.fireT = 1.7 - Math.min(0.5, L * 0.2);
        const a = this._aim(e.x, e.y);
        for (let i = -2; i <= 2; i++) this._shoot(e.x - 34, e.y, a + i * 0.2, 230 + L * 25, 7, 'orange');
      }
    }
    if (e.x < -90 || e.y < -120 || e.y > H + 120) e.dead = true;
  }

  _boss(dt) {
    const B = this.boss;
    B.t += dt;
    B.hit = Math.max(0, B.hit - dt * 6);
    if (B.dead) {
      B.deathT += dt;
      if (Math.random() < dt * 18) this._explode(B.x + (Math.random() - 0.5) * 220, B.y + (Math.random() - 0.5) * 140, 0.6 + Math.random() * 0.8);
      B.x += 30 * dt;
      if (B.deathT > 2.2) {
        this._explode(B.x, B.y, 3);
        this.flashT = 0.4;
        this.shake = 1;
        this.boss = null;
        this.loop++;
        this.banner = { text: `任务完成！进入第 ${this.loop + 1} 区域`, t: 0, dur: 3 };
        this.sfx.play('clear');
        this._newStage();
        this.stageT = -2.5;
      }
      return;
    }
    B.x = damp(B.x, 1050, 1.2, dt);
    B.y = 380 + Math.sin(B.t * 0.6) * 190;
    if (B.x > W - 20) return;
    const ratio = B.hp / B.max;
    const L = this.loop;
    const sp = 1 + L * 0.12;
    const cx = B.x - 70, cy = B.y;
    B.fireA -= dt;
    B.fireB -= dt;
    if (ratio > 0.66) {
      if (B.fireA <= 0) {
        B.fireA = 1.0;
        const a = this._aim(cx, cy);
        for (let i = -2; i <= 2; i++) this._shoot(cx, cy, a + i * 0.13, 300 * sp, 7);
      }
      if (B.fireB <= 0) {
        B.fireB = 2.6;
        for (let i = 0; i < 18; i++) this._shoot(cx, cy, (i / 18) * Math.PI * 2 + B.t, 190 * sp, 7, 'blue');
      }
    } else if (ratio > 0.33) {
      if (B.fireA <= 0) {
        B.fireA = 0.075;
        B.spin += 0.32;
        this._shoot(cx, cy, B.spin, 230 * sp, 6, 'blue');
        this._shoot(cx, cy, B.spin + Math.PI, 230 * sp, 6, 'blue');
      }
      if (B.fireB <= 0) {
        B.fireB = 3.6;
        this.spawn('drone', 1330, 160, { amp: 40 });
        this.spawn('drone', 1330, 600, { amp: 40 });
      }
    } else {
      if (B.fireA <= 0) {
        B.fireA = 0.6;
        const a = this._aim(cx, cy);
        for (let i = -3; i <= 3; i++) this._shoot(cx, cy, a + i * 0.12, 330 * sp, 7);
      }
      if (B.fireB <= 0) {
        B.fireB = 1.6;
        for (let i = 0; i < 24; i++) this._shoot(cx, cy, (i / 24) * Math.PI * 2 + B.t * 0.7, 240 * sp, 6, 'orange');
      }
    }
  }

  _killBoss() {
    const B = this.boss;
    if (!B || B.dead) return;
    B.dead = true;
    B.deathT = 0;
    this.ebullets = [];
    this.score += 20000 * (this.loop + 1);
    for (let i = 0; i < 3; i++) this.items.push({ x: B.x - 40 * i, y: B.y + (i - 1) * 60, k: i === 1 ? 'B' : 'P', t: 0, dead: false });
  }

  // ———————————————————— 绘制 ————————————————————
  draw(c) {
    c.save();
    if (this.shake > 0) c.translate((Math.random() - 0.5) * 16 * this.shake, (Math.random() - 0.5) * 16 * this.shake);
    // 背景
    const nx = -((this.scroll * 14) % W);
    c.drawImage(this.nebula, nx, 0);
    c.drawImage(this.nebula, nx + W, 0);
    this.stars.forEach((layer, li) => {
      const sp = [30, 90, 220][li];
      for (const s of layer) {
        const x = (((s.x - this.scroll * sp) % W) + W) % W;
        c.fillStyle = `rgba(255,255,255,${s.a})`;
        if (li === 2) c.fillRect(x, s.y, 6, 1.5);
        else c.fillRect(x, s.y, s.s, s.s);
      }
    });
    // 远处行星
    const px = 1000 - ((this.scroll * 6) % (W + 600));
    const pg = c.createRadialGradient(px - 40, 150, 10, px, 180, 130);
    pg.addColorStop(0, '#ffb36b');
    pg.addColorStop(1, '#7a2f5c');
    c.fillStyle = pg;
    c.beginPath();
    c.arc(px, 180, 110, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255,210,170,0.35)';
    c.lineWidth = 6;
    c.beginPath();
    c.ellipse(px, 180, 190, 34, -0.25, 0, Math.PI * 2);
    c.stroke();

    // 道具
    for (const it of this.items) {
      const col = it.k === 'P' ? '#ff9f1c' : '#ff4f6d';
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.beginPath();
      c.arc(it.x, it.y, 22, 0, Math.PI * 2);
      c.fill();
      fillRR(c, it.x - 17, it.y - 14, 34, 28, 9, col);
      text(c, it.k, it.x, it.y + 1, 20, '#fff', 'center', 900);
    }
    // 敌人
    for (const e of this.enemies) this._drawEnemy(c, e);
    if (this.boss) this._drawBoss(c, this.boss);
    // 玩家子弹
    c.fillStyle = '#ffe9a8';
    for (const b of this.bullets) {
      fillRR(c, b.x - 12, b.y - 2.5, 24, 5, 2.5, '#ffe9a8');
    }
    // 玩家
    const P = this.player;
    if (!P.dead && (this.mode !== 'over')) {
      const blink = P.inv > 0 && Math.floor(this.t * 16) % 2 === 0;
      if (!blink) drawShip(c, P.x, P.y, 1, P.tilt, 1);
      if (this.mode === 'play') {
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(P.x, P.y, 3.5, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(255,80,120,0.9)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(P.x, P.y, 6, 0, Math.PI * 2);
        c.stroke();
      }
    }
    // 敌方子弹
    for (const b of this.ebullets) {
      const outer = b.color === 'blue' ? 'rgba(80,170,255,0.45)' : b.color === 'orange' ? 'rgba(255,150,60,0.45)' : 'rgba(255,80,160,0.45)';
      const inner = b.color === 'blue' ? '#bfe6ff' : b.color === 'orange' ? '#ffe0b0' : '#ffd0ea';
      c.fillStyle = outer;
      c.beginPath();
      c.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = inner;
      c.beginPath();
      c.arc(b.x, b.y, b.r * 0.6, 0, Math.PI * 2);
      c.fill();
    }
    this.parts.draw(c);
    for (const r of this.rings) {
      const k = r.t / r.dur;
      c.strokeStyle = `rgba(${r.color},${(1 - k).toFixed(3)})`;
      c.lineWidth = 6 * (1 - k) + 1;
      c.beginPath();
      c.arc(r.x, r.y, r.r * easeOutCubic(k), 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
    if (this.flashT > 0) {
      c.fillStyle = `rgba(255,255,240,${(this.flashT * 1.8).toFixed(3)})`;
      c.fillRect(0, 0, W, H);
    }

    if (this.mode !== 'title') this._hud(c);
    if (this.banner) {
      const b = this.banner;
      const a = Math.min(1, b.t / 0.25, (b.dur - b.t) / 0.4);
      c.globalAlpha = clamp(a, 0, 1);
      if (b.warn) {
        c.fillStyle = 'rgba(255,40,60,0.25)';
        c.fillRect(0, 300, W, 120);
        c.fillStyle = 'rgba(255,60,80,0.9)';
        c.fillRect(0, 300, W, 4);
        c.fillRect(0, 416, W, 4);
        const blink = Math.floor(b.t * 4) % 2 === 0 ? 1 : 0.6;
        c.globalAlpha = clamp(a, 0, 1) * blink;
        outlineText(c, b.text, W / 2, 360, 54, '#ffffff', '#b0102a', 10);
      } else outlineText(c, b.text, W / 2, 360, 50, '#ffffff', '#3b2a8a', 10);
      c.globalAlpha = 1;
    }

    if (this.mode === 'title') {
      drawTitleCard(c, {
        t: this.modeT, title: '星际射击', subtitle: '击退敌机波次，打倒巨型战舰', best: this.best,
        stroke: '#3b2a8a', titleY: 250, promptY: 470,
        controls: [['STICK', '移动'], ['A', '射击（按住连发）'], ['B', '炸弹'], ['PLUS', '暂停']],
      });
    } else if (this.mode === 'over') {
      drawResult(c, {
        t: this.modeT, title: '游戏结束', color: '#4b3ab0', newBest: this.newBest,
        lines: [['得分', this.score], ['到达区域', `第 ${this.loop + 1} 区域`], ['最高分', this.best]],
        hints: [['A', '再来一次'], ['B', '标题画面']],
      });
    }
  }

  _hud(c) {
    text(c, `得分 ${this.score}`, 30, 34, 26, '#ffffff', 'left', 800);
    text(c, `最高 ${Math.max(this.best, this.score)}`, W / 2, 34, 20, '#b8c4ff', 'center', 600);
    for (let i = 0; i < Math.max(0, this.lives); i++) drawShip(c, W - 40 - i * 46, 34, 0.6, 0, 0);
    for (let i = 0; i < this.bombs; i++) {
      c.fillStyle = '#ff4f6d';
      c.beginPath();
      c.arc(40 + i * 30, H - 30, 10, 0, Math.PI * 2);
      c.fill();
      text(c, 'B', 40 + i * 30, H - 29, 12, '#fff', 'center', 900);
    }
    text(c, `火力 Lv.${this.power}`, 40 + Math.max(1, this.bombs) * 30 + 16, H - 29, 18, '#ffd28a', 'left', 700);
    const B = this.boss;
    if (B && !B.dead && B.x < W) {
      const w = 600, x = (W - w) / 2, y = 64;
      fillRR(c, x - 4, y - 4, w + 8, 20, 10, 'rgba(0,0,0,0.5)');
      fillRR(c, x, y, Math.max(0, w * (B.hp / B.max)), 12, 6, B.hp / B.max < 0.33 ? '#ff4d4d' : '#ff9f1c');
      text(c, '巨型战舰', x - 14, y + 6, 16, '#ffffff', 'right', 700);
    }
  }

  _drawEnemy(c, e) {
    c.save();
    c.translate(e.x, e.y);
    const flash = e.hit > 0.5;
    if (e.type === 'drone') {
      c.fillStyle = flash ? '#fff' : '#8a5cff';
      c.beginPath();
      c.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = flash ? '#fff' : '#c7b3ff';
      c.beginPath();
      c.ellipse(0, -5, 10, 7, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = '#ff3b6b';
      c.beginPath();
      c.arc(-10, 2, 3.5, 0, Math.PI * 2);
      c.fill();
    } else if (e.type === 'swooper') {
      c.fillStyle = flash ? '#fff' : '#36d399';
      c.beginPath();
      c.moveTo(-24, 0);
      c.lineTo(12, -16);
      c.lineTo(4, 0);
      c.lineTo(12, 16);
      c.closePath();
      c.fill();
      c.fillStyle = '#0f5f44';
      c.beginPath();
      c.arc(-4, 0, 4, 0, Math.PI * 2);
      c.fill();
    } else if (e.type === 'turret') {
      const a = this._aim(e.x, e.y);
      c.fillStyle = flash ? '#fff' : '#9aa6b8';
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        c.lineTo(Math.cos(ang) * 24, Math.sin(ang) * 24);
      }
      c.closePath();
      c.fill();
      c.fillStyle = '#4a5466';
      c.beginPath();
      c.arc(0, 0, 13, 0, Math.PI * 2);
      c.fill();
      c.rotate(a);
      c.fillStyle = '#ff9f1c';
      c.fillRect(6, -4, 24, 8);
    } else if (e.type === 'heavy') {
      c.fillStyle = flash ? '#fff' : '#b23a48';
      fillRR(c, -46, -30, 92, 60, 22, flash ? '#fff' : '#b23a48');
      fillRR(c, -30, -40, 50, 16, 8, flash ? '#fff' : '#7d2433');
      fillRR(c, -30, 24, 50, 16, 8, flash ? '#fff' : '#7d2433');
      c.fillStyle = '#ffcf5a';
      c.beginPath();
      c.arc(-22, 0, 9, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3a1016';
      c.fillRect(-60, -12, 18, 6);
      c.fillRect(-60, 6, 18, 6);
      // 血条
      fillRR(c, -40, -54, 80, 6, 3, 'rgba(0,0,0,0.5)');
      fillRR(c, -40, -54, 80 * clamp(e.hp / e.max, 0, 1), 6, 3, '#ff9f1c');
    }
    c.restore();
  }

  _drawBoss(c, B) {
    c.save();
    c.translate(B.x, B.y);
    const flash = B.hit > 0.5;
    const hull = flash ? '#ffffff' : '#4a536b';
    const dark = flash ? '#eeeeee' : '#2c3245';
    // 机翼
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(-40, -60);
    c.lineTo(80, -120);
    c.lineTo(120, -100);
    c.lineTo(60, -40);
    c.closePath();
    c.moveTo(-40, 60);
    c.lineTo(80, 120);
    c.lineTo(120, 100);
    c.lineTo(60, 40);
    c.closePath();
    c.fill();
    // 主体
    c.fillStyle = hull;
    c.beginPath();
    c.moveTo(-140, 0);
    c.lineTo(-80, -62);
    c.lineTo(110, -70);
    c.lineTo(140, -30);
    c.lineTo(140, 30);
    c.lineTo(110, 70);
    c.lineTo(-80, 62);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.15)';
    c.lineWidth = 2;
    for (let i = -40; i <= 100; i += 35) {
      c.beginPath();
      c.moveTo(i, -60);
      c.lineTo(i, 60);
      c.stroke();
    }
    // 核心
    const pulse = 0.6 + 0.4 * Math.sin(B.t * 6);
    const cg = c.createRadialGradient(-70, 0, 4, -70, 0, 34);
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(0.4, `rgba(255,80,90,${pulse})`);
    cg.addColorStop(1, 'rgba(255,40,60,0)');
    c.fillStyle = cg;
    c.beginPath();
    c.arc(-70, 0, 34, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ff9f1c';
    c.fillRect(-150, -42, 30, 10);
    c.fillRect(-150, 32, 30, 10);
    c.fillStyle = 'rgba(120,200,255,0.8)';
    c.fillRect(140, -18, 16 + Math.random() * 10, 10);
    c.fillRect(140, 8, 16 + Math.random() * 10, 10);
    c.restore();
  }
}

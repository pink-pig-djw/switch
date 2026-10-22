// WebAudio 合成音效：全部现场合成，不使用任何音频文件。
// AudioContext 只在 unlock()（第一次用户手势）时创建，避免浏览器的自动播放警告。

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.level = 10; // 0..16
    this.noiseBuf = null;
    this.lastPlay = new Map();
    this.pulses = null;
    this.music = new Music(this);
  }

  // NES 风格的脉冲波（占空比 12.5% / 25%）
  pulseWave(duty) {
    if (!this.ctx) return null;
    if (!this.pulses) this.pulses = {};
    if (this.pulses[duty]) return this.pulses[duty];
    const n = 32;
    const real = new Float32Array(n), imag = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      real[k] = 0;
      imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    }
    const w = this.ctx.createPeriodicWave(real, imag);
    this.pulses[duty] = w;
    return w;
  }

  // 8-bit 音：type 可以是 'p12' / 'p25' / 'square' / 'triangle'
  chip(type, f0, f1, dur, vol = 0.2, delay = 0) {
    const c = this.ctx;
    if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    if (type === 'p12' || type === 'p25') o.setPeriodicWave(this.pulseWave(type === 'p12' ? 0.125 : 0.25));
    else o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.setValueAtTime(vol, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // 由系统每帧调用：只有 owner 应用在前台运行时音乐才播放
  updateMusic(activeApp) {
    this.music.update(activeApp);
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -12;
        comp.ratio.value = 4;
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 1.2);
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.applyVolume(true);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      this.ctx = null;
    }
  }

  setVolume(level) {
    this.level = level;
    this.applyVolume();
  }

  applyVolume(immediate) {
    if (!this.master) return;
    const v = this.level / 16;
    const g = v * v * 0.55;
    if (immediate) this.master.gain.value = g;
    else this.master.gain.setTargetAtTime(g, this.ctx.currentTime, 0.015);
  }

  // 简单的振荡器音：type 波形，f0→f1 频率滑动，dur 时长
  tone(type, f0, f1, dur, vol = 0.25, delay = 0, attack = 0.004) {
    const c = this.ctx;
    if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  // 滤波噪声：用来做爆炸、快门、咔哒声
  noise(dur, vol = 0.25, ftype = 'lowpass', f0 = 2000, f1 = 0, delay = 0, q = 0.8) {
    const c = this.ctx;
    if (!c || !this.noiseBuf) return;
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = ftype;
    f.frequency.setValueAtTime(f0, t0);
    f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0, Math.random() * 0.2);
    src.stop(t0 + dur + 0.03);
  }

  play(name, opt = {}) {
    if (!this.ctx || this.level <= 0 || this.ctx.state !== 'running') return;
    const fn = SOUNDS[name];
    if (!fn) return;
    // 同一音效极短时间内重复触发时做个节流，避免叠爆
    const now = this.ctx.currentTime;
    const last = this.lastPlay.get(name) || 0;
    if (now - last < (opt.minGap ?? 0.025)) return;
    this.lastPlay.set(name, now);
    try {
      fn(this, opt);
    } catch (e) {
      // 忽略合成错误
    }
  }
}

// ———————————————————— 音乐（原创 8-bit 风格曲子，由简单的音序器实时合成） ————————————————————
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteFreq(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 0;
  const midi = (Number(m[3]) + 1) * 12 + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}
// "C5:2 E5:2 -:4 k:2" → [[freq或鼓, 16 分音符数], ...]
export function parseTrack(str) {
  return str.trim().split(/\s+/).map((tok) => {
    const [n, l] = tok.split(':');
    const len = Number(l || 1);
    if (n === '-') return [0, len];
    if (n === 'k' || n === 's' || n === 'h') return [n, len];
    return [noteFreq(n), len];
  });
}

export class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.song = null;
    this.owner = null;
    this.tracks = null;
    this.paused = false;
    this.gain = null;
    this.rate = 1;
  }

  _ctx() {
    const c = this.sfx.ctx;
    if (!c || !this.sfx.master) return null;
    if (!this.gain) {
      this.gain = c.createGain();
      this.gain.gain.value = 0.5;
      this.gain.connect(this.sfx.master);
    }
    return c;
  }

  play(song, owner, opts = {}) {
    this.stop();
    this.song = song;
    this.owner = owner || null;
    this.loop = opts.loop !== false;
    this.rate = opts.rate || 1;
    this.paused = false;
    this.done = false;
    const c = this._ctx();
    this.tracks = song.tracks.map((tr) => ({ tr, i: 0, time: 0, queue: [] }));
    this.started = false;
    if (c) this._start(c);
  }

  _start(c) {
    const t0 = c.currentTime + 0.06;
    for (const tk of this.tracks) tk.time = t0;
    this.started = true;
  }

  stop() {
    const c = this.sfx.ctx;
    if (this.tracks && c) {
      for (const tk of this.tracks) for (const q of tk.queue) {
        try { q.o.stop(c.currentTime + 0.01); } catch (e) { /* 已停止 */ }
      }
    }
    this.song = null;
    this.tracks = null;
    this.owner = null;
  }

  get playing() {
    return !!this.song && !this.done;
  }

  _pause(c) {
    if (this.paused || !this.tracks) return;
    this.paused = true;
    const now = c.currentTime;
    for (const tk of this.tracks) {
      let rewound = false;
      for (const q of tk.queue) {
        if (q.start > now) {
          if (!rewound) { tk.i = q.idx; tk.time = q.start; rewound = true; }
          try { q.o.stop(0); } catch (e) { /* ignore */ }
        } else {
          try { q.g.gain.setTargetAtTime(0.0001, now, 0.01); } catch (e) { /* ignore */ }
        }
      }
      tk.queue = [];
      tk.off = Math.max(0, tk.time - now);
    }
  }

  _resume(c) {
    if (!this.paused) return;
    this.paused = false;
    const now = c.currentTime + 0.05;
    for (const tk of this.tracks) tk.time = now + (tk.off || 0);
  }

  update(activeApp) {
    if (!this.song) return;
    const c = this._ctx();
    if (!c) return;
    if (!this.started) this._start(c);
    const active = !this.owner || this.owner === activeApp;
    if (!active) { this._pause(c); return; }
    if (this.paused) this._resume(c);
    const ahead = c.currentTime + 0.22;
    const sixteenth = 60 / (this.song.bpm * this.rate) / 4;
    let allDone = true;
    for (const tk of this.tracks) {
      const notes = tk.tr.notes;
      tk.queue = tk.queue.filter((q) => q.end > c.currentTime);
      while (tk.time < ahead && tk.i < notes.length) {
        const [f, len] = notes[tk.i];
        const dur = len * sixteenth;
        if (f) this._note(c, tk, f, tk.time, dur, tk.i);
        tk.time += dur;
        tk.i++;
        if (tk.i >= notes.length && this.loop) tk.i = 0;
      }
      if (tk.i < notes.length || tk.queue.length) allDone = false;
    }
    if (!this.loop && allDone) this.done = true;
  }

  _note(c, tk, f, start, dur, idx) {
    const tr = tk.tr;
    const vol = tr.vol || 0.15;
    const g = c.createGain();
    g.connect(this.gain);
    let o;
    if (typeof f === 'string') {
      // 鼓：k 低音鼓 / s 军鼓 / h 镲
      if (f === 'k') {
        o = c.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, start);
        o.frequency.exponentialRampToValueAtTime(45, start + 0.12);
        g.gain.setValueAtTime(vol * 2.2, start);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
        o.connect(g);
      } else {
        o = c.createBufferSource();
        o.buffer = this.sfx.noiseBuf;
        const flt = c.createBiquadFilter();
        flt.type = f === 'h' ? 'highpass' : 'bandpass';
        flt.frequency.value = f === 'h' ? 7000 : 1800;
        const d = f === 'h' ? 0.04 : 0.12;
        g.gain.setValueAtTime(vol * (f === 'h' ? 0.7 : 1.4), start);
        g.gain.exponentialRampToValueAtTime(0.0001, start + d);
        o.connect(flt);
        flt.connect(g);
      }
      o.start(start);
      o.stop(start + 0.16);
      tk.queue.push({ o, g, start, end: start + 0.16, idx });
      return;
    }
    o = c.createOscillator();
    const w = tr.wave || 'square';
    if (w === 'p12' || w === 'p25') o.setPeriodicWave(this.sfx.pulseWave(w === 'p12' ? 0.125 : 0.25));
    else o.type = w;
    o.frequency.setValueAtTime(f, start);
    const len = Math.max(0.03, dur * (tr.gate || 0.88));
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.006);
    g.gain.exponentialRampToValueAtTime(vol * (tr.sustain ?? 0.55), start + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, start + len);
    o.connect(g);
    o.start(start);
    o.stop(start + len + 0.02);
    tk.queue.push({ o, g, start, end: start + len + 0.02, idx });
  }
}

const arp = (s, type, notes, step, dur, vol, delay = 0) =>
  notes.forEach((f, i) => s.tone(type, f, f, dur, vol, delay + i * step));

const SOUNDS = {
  // —— 系统 ——
  tick: (s) => s.tone('triangle', 1320, 1250, 0.035, 0.16),
  move: (s) => s.tone('sine', 900, 860, 0.045, 0.2),
  confirm: (s) => {
    s.tone('triangle', 740, 740, 0.06, 0.2);
    s.tone('triangle', 1110, 1110, 0.11, 0.2, 0.055);
  },
  back: (s) => {
    s.tone('triangle', 820, 820, 0.05, 0.18);
    s.tone('triangle', 540, 540, 0.09, 0.18, 0.05);
  },
  launch: (s) => arp(s, 'sine', [587, 740, 880, 1175], 0.045, 0.2, 0.18),
  deny: (s) => s.tone('square', 196, 160, 0.14, 0.09),
  pause: (s) => {
    s.tone('sine', 988, 988, 0.06, 0.18);
    s.tone('sine', 740, 740, 0.09, 0.18, 0.06);
  },
  vol: (s) => s.tone('sine', 1046, 1046, 0.05, 0.22),
  click: (s) => {
    s.noise(0.025, 0.5, 'highpass', 3500);
    s.tone('square', 2400, 1600, 0.025, 0.06);
    s.noise(0.02, 0.3, 'highpass', 5000, 0, 0.06);
  },
  shutter: (s) => {
    s.noise(0.045, 0.45, 'bandpass', 5200, 1800, 0, 1.4);
    s.noise(0.06, 0.35, 'bandpass', 3600, 1400, 0.075, 1.4);
  },
  boot: (s) => {
    arp(s, 'sine', [392, 587, 784, 1175], 0.11, 0.9, 0.12);
    s.tone('triangle', 196, 196, 1.4, 0.06, 0.05, 0.2);
  },
  sleep: (s) => {
    s.tone('sine', 660, 660, 0.12, 0.16);
    s.tone('sine', 440, 440, 0.2, 0.16, 0.09);
  },
  wake: (s) => {
    s.tone('sine', 440, 440, 0.1, 0.16);
    s.tone('sine', 660, 660, 0.16, 0.16, 0.08);
  },
  lockstep: (s, o) => s.tone('sine', 620 + (o.n || 0) * 180, 620 + (o.n || 0) * 180, 0.08, 0.18),
  unlock: (s) => arp(s, 'triangle', [784, 988, 1318], 0.06, 0.18, 0.18),
  toast: (s) => s.tone('sine', 1250, 1250, 0.07, 0.1),

  // —— 游戏通用 ——
  jump: (s) => s.tone('square', 300, 680, 0.12, 0.08),
  coin: (s) => {
    s.tone('triangle', 1046, 1046, 0.05, 0.16);
    s.tone('triangle', 1568, 1568, 0.13, 0.16, 0.045);
  },
  tea: (s) => arp(s, 'sine', [1318, 1661, 1976, 2637], 0.05, 0.22, 0.14),
  stomp: (s) => {
    s.tone('square', 240, 70, 0.12, 0.13);
    s.noise(0.07, 0.2, 'lowpass', 1400);
  },
  hurt: (s) => s.tone('sawtooth', 460, 120, 0.3, 0.12),
  die: (s) => arp(s, 'square', [523, 415, 330, 262, 196], 0.11, 0.14, 0.09),
  spring: (s) => s.tone('sine', 180, 980, 0.24, 0.22),
  checkpoint: (s) => arp(s, 'triangle', [659, 880, 1175], 0.07, 0.16, 0.15),
  oneup: (s) => arp(s, 'square', [659, 784, 1318, 1046, 1175, 1568], 0.07, 0.1, 0.07),
  clear: (s) => {
    arp(s, 'square', [523, 659, 784], 0.11, 0.12, 0.09);
    s.tone('square', 1046, 1046, 0.45, 0.09, 0.36);
    s.tone('triangle', 523, 523, 0.6, 0.12, 0.36);
  },
  gameover: (s) => arp(s, 'triangle', [587, 523, 440, 349, 294], 0.17, 0.26, 0.17),
  explode: (s, o) => {
    const big = !!o.big;
    s.noise(big ? 1.0 : 0.38, big ? 0.55 : 0.32, 'lowpass', big ? 2600 : 3200, 70);
    s.tone('sine', big ? 110 : 160, 35, big ? 0.7 : 0.3, big ? 0.32 : 0.18);
  },
  shoot: (s) => s.tone('square', 1300, 420, 0.06, 0.045),
  laser: (s) => s.tone('sawtooth', 1800, 600, 0.08, 0.05),
  hit: (s) => s.noise(0.04, 0.16, 'highpass', 2400),
  powerup: (s) => arp(s, 'square', [523, 659, 784, 1046, 1318], 0.05, 0.1, 0.08),
  bomb: (s) => {
    s.noise(1.3, 0.6, 'lowpass', 1800, 50);
    s.tone('sine', 90, 30, 1.0, 0.35);
    s.tone('sawtooth', 600, 60, 0.6, 0.08);
  },
  bounce: (s, o) => s.tone('square', o.f || 440, o.f || 440, 0.05, 0.08),
  brick: (s, o) => s.tone('triangle', o.f || 660, (o.f || 660) * 1.25, 0.07, 0.18),
  steel: (s) => s.tone('square', 1800, 1700, 0.05, 0.06),
  eat: (s) => s.tone('sine', 480, 960, 0.09, 0.26),
  golden: (s) => arp(s, 'sine', [880, 1175, 1480, 1760], 0.045, 0.16, 0.18),
  merge: (s, o) => s.tone('sine', o.f || 520, (o.f || 520) * 1.5, 0.1, 0.22),
  slide: (s) => s.noise(0.06, 0.1, 'bandpass', 1600, 700, 0, 1.2),
  win: (s) => {
    arp(s, 'triangle', [523, 659, 784, 1046, 784, 1046, 1318], 0.1, 0.22, 0.16);
  },
  // —— 8-bit 平台游戏专用 ——
  nes_jump: (s) => s.chip('p25', 380, 820, 0.16, 0.13),
  nes_jumpbig: (s) => s.chip('p25', 300, 700, 0.18, 0.13),
  nes_coin: (s) => {
    s.chip('p25', 1318, 1318, 0.05, 0.12);
    s.chip('p25', 1975, 1975, 0.22, 0.12, 0.05);
  },
  nes_stomp: (s) => {
    s.chip('square', 700, 180, 0.1, 0.12);
  },
  nes_bump: (s) => s.chip('triangle', 160, 90, 0.08, 0.35),
  nes_break: (s) => {
    s.noise(0.18, 0.4, 'lowpass', 2400, 200);
    s.chip('square', 220, 70, 0.12, 0.1);
  },
  nes_appear: (s) => {
    for (let i = 0; i < 8; i++) s.chip('p25', 300 + i * 90, 300 + i * 90, 0.04, 0.09, i * 0.035);
  },
  nes_power: (s) => {
    for (let i = 0; i < 10; i++) s.chip('p25', 400 + i * 120 + (i % 2) * 200, 400 + i * 120, 0.05, 0.1, i * 0.045);
  },
  nes_shrink: (s) => {
    for (let i = 0; i < 8; i++) s.chip('p25', 900 - i * 80 - (i % 2) * 150, 800 - i * 80, 0.05, 0.1, i * 0.05);
  },
  nes_1up: (s) => {
    [1318, 1568, 2637, 2093, 2349, 3136].forEach((f, i) => s.chip('p25', f, f, 0.08, 0.1, i * 0.08));
  },
  nes_pipe: (s) => {
    for (let i = 0; i < 3; i++) s.chip('square', 320 - i * 60, 180 - i * 40, 0.09, 0.1, i * 0.14);
  },
  nes_kick: (s) => s.chip('square', 900, 400, 0.06, 0.12),
  nes_fire: (s) => {
    s.chip('square', 1200, 300, 0.07, 0.08);
    s.noise(0.05, 0.12, 'highpass', 3000);
  },
  nes_flag: (s) => s.chip('p25', 1600, 200, 0.9, 0.1),
  nes_tick: (s) => s.chip('p25', 1760, 1760, 0.03, 0.07),
  nes_hurry: (s) => {
    [880, 988, 880, 988, 1175].forEach((f, i) => s.chip('p25', f, f, 0.09, 0.1, i * 0.1));
  },
  nes_firework: (s) => {
    s.noise(0.5, 0.35, 'lowpass', 1800, 120);
  },
  nes_bossHit: (s) => {
    s.chip('square', 220, 110, 0.2, 0.15);
    s.noise(0.2, 0.25, 'bandpass', 900, 300);
  },
  boss: (s) => {
    s.tone('sawtooth', 110, 110, 0.5, 0.12);
    s.tone('sawtooth', 116, 116, 0.5, 0.12, 0.5);
    s.tone('sawtooth', 110, 110, 0.7, 0.12, 1.0);
  },
};

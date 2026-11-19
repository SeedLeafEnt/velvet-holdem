'use strict';
/* Velvet Hold'em: 02-audio.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Sound: synthesized with Web Audio
   ========================================================= */
const Sound = {
  ctx: null, on: true,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0.85;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      this.master.connect(comp); comp.connect(c.destination);
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      const irLen = Math.floor(c.sampleRate * 1.1), ir = c.createBuffer(2, irLen, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const x = ir.getChannelData(ch); for (let i = 0; i < irLen; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2); }
      this.verb = c.createConvolver(); this.verb.buffer = ir;
      const vg = c.createGain(); vg.gain.value = 0.22; this.verb.connect(vg); vg.connect(this.master);
      this.far = c.createBiquadFilter(); this.far.type = 'lowpass'; this.far.frequency.value = 1600;
      const fg = c.createGain(); fg.gain.value = 0.22; this.far.connect(fg); fg.connect(this.verb); fg.connect(this.master);
      if (c.state === 'suspended') c.resume().catch(() => {});
    } catch (e) { this.ctx = null; }
  },
  ok() { return this.on && this.ctx && this.ctx.state === 'running' && !S.test; },
  route(node, wet, far) {
    if (far) { node.connect(this.far); return; }
    node.connect(this.master);
    if (wet > 0) { const s = this.ctx.createGain(); s.gain.value = wet; node.connect(s); s.connect(this.verb); }
  },
  noise(t, dur, o = {}) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 3000, t); f.Q.value = o.q ?? 1;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const g = c.createGain(), a = o.attack || 0.002;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); this.route(g, o.wet ?? 0.12, o.far);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },
  tone(t, freq, dur, o = {}) {
    const c = this.ctx, osc = c.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const g = c.createGain(), a = o.attack || 0.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.15, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); this.route(g, o.wet ?? 0.15, o.far);
    osc.start(t); osc.stop(t + dur + 0.05);
  },
  now() { return this.ctx.currentTime + 0.005; },
  card() { if (!this.ok()) return; const t = this.now();
    this.noise(t, 0.075, { f: rand(2400, 3600), to: 1500, q: 0.9, gain: 0.3, attack: 0.003 });
    this.noise(t + 0.05, 0.05, { type: 'lowpass', f: 1100, gain: 0.22, wet: 0.05 });
    this.tone(t + 0.05, 150, 0.05, { gain: 0.08, to: 80, wet: 0 }); },
  flip() { if (!this.ok()) return; const t = this.now();
    this.noise(t, 0.03, { type: 'highpass', f: 2600, gain: 0.18 });
    this.noise(t + 0.045, 0.06, { f: 1700, q: 1.3, gain: 0.26, to: 1100 }); },
  clack(t, g = 1, far = false) {
    const f = rand(3000, 5400);
    this.tone(t, f, 0.04, { gain: 0.08 * g, attack: 0.0008, wet: 0.14, far });
    this.tone(t, f * 1.47, 0.028, { gain: 0.045 * g, attack: 0.0008, wet: 0.1, far });
    this.noise(t, 0.022, { f: rand(5200, 7600), q: 2.5, gain: 0.2 * g, attack: 0.0008, wet: 0.08, far });
  },
  chips(n = 4, g = 1) { if (!this.ok()) return; let t = this.now();
    n = clamp(Math.round(n), 1, 16);
    for (let i = 0; i < n; i++) { this.clack(t, rand(0.55, 1) * g); t += rand(0.022, 0.055) * (i > 3 ? 0.75 : 1); } },
  riffle() { if (!this.ok()) return; let t = this.now();
    for (let r = 0; r < 3; r++) { for (let i = 0; i < 8; i++) { this.clack(t, rand(0.18, 0.34)); t += rand(0.028, 0.04); } t += rand(0.16, 0.26); } },
  slide() { if (!this.ok()) return; const t = this.now();
    this.noise(t, 0.2, { f: 1400, to: 3200, q: 0.7, gain: 0.08, attack: 0.04 }); },
  knock() { if (!this.ok()) return; const t = this.now();
    for (const k of [0, 0.12]) { this.tone(t + k, 165, 0.1, { gain: 0.32, to: 70, attack: 0.002, wet: 0.08 }); this.noise(t + k, 0.05, { type: 'lowpass', f: 700, gain: 0.28, wet: 0.05 }); } },
  fold() { if (!this.ok()) return; const t = this.now();
    this.noise(t, 0.22, { f: 900, to: 3000, q: 0.8, gain: 0.13, attack: 0.03 }); },
  shuffle() { if (!this.ok()) return; const t0 = this.now();
    for (let i = 0; i < 34; i++) { const t = t0 + i * 0.017 * (1 - i / 90); this.noise(t, 0.016, { f: rand(2600, 4800), q: 1.4, gain: rand(0.06, 0.13), wet: 0.06 }); }
    this.noise(t0 + 0.62, 0.26, { type: 'lowpass', f: 3200, to: 500, gain: 0.12, attack: 0.02 }); },
  turn() { if (!this.ok()) return; const t = this.now();
    this.tone(t, 784, 0.3, { gain: 0.06, wet: 0.45 }); this.tone(t + 0.1, 1175, 0.45, { gain: 0.05, wet: 0.45 }); },
  pop() { if (!this.ok()) return; const t = this.now(); this.tone(t, 920, 0.08, { gain: 0.03, to: 700, wet: 0.1 }); },
  bell(t, f, g = 1) { this.tone(t, f, 1.1, { gain: 0.08 * g, wet: 0.45 }); this.tone(t, f * 2.76, 0.45, { gain: 0.022 * g, wet: 0.4 }); this.tone(t, f * 5.4, 0.2, { gain: 0.008 * g, wet: 0.3 }); },
  win() { if (!this.ok()) return; const t = this.now();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.bell(t + i * 0.085, f));
    setTimeout(() => this.chips(10, 0.9), 240); },
  bigWin() { if (!this.ok()) return; const t = this.now();
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => this.bell(t + i * 0.08, f, 1.1));
    this.noise(t + 0.3, 1.2, { type: 'highpass', f: 7000, gain: 0.03, attack: 0.4, wet: 0.6 });
    setTimeout(() => this.chips(16, 1), 260); },
  lose() { if (!this.ok()) return; const t = this.now();
    this.tone(t, 330, 0.4, { type: 'triangle', gain: 0.07, to: 262, wet: 0.35 }); this.tone(t + 0.3, 247, 0.7, { type: 'triangle', gain: 0.06, to: 196, wet: 0.35 }); },
  allin() { if (!this.ok()) return; const t = this.now();
    this.tone(t, 72, 1.0, { gain: 0.42, to: 38, attack: 0.006, wet: 0.35 });
    this.noise(t, 0.7, { type: 'lowpass', f: 180, to: 2400, gain: 0.1, attack: 0.3, wet: 0.3 });
    setTimeout(() => this.chips(14, 1), 60); },
  heart() { if (!this.ok()) return; const t = this.now();
    this.tone(t, 62, 0.14, { gain: 0.3, to: 44, wet: 0.1 }); this.tone(t + 0.21, 56, 0.16, { gain: 0.22, to: 40, wet: 0.1 }); },
  level() { if (!this.ok()) return; const t = this.now();
    this.tone(t, 392, 0.35, { type: 'triangle', gain: 0.07, wet: 0.4 }); this.tone(t + 0.14, 523, 0.6, { type: 'triangle', gain: 0.07, wet: 0.4 }); },
  thud() { if (!this.ok()) return; const t = this.now();
    this.tone(t, 95, 0.28, { gain: 0.5, to: 42, attack: 0.002, wet: 0.2 }); this.noise(t, 0.12, { type: 'lowpass', f: 600, gain: 0.35, wet: 0.15 }); },
  ignite() { if (!this.ok()) return; const t = this.now();
    this.noise(t, 0.55, { f: 300, to: 2600, q: 0.8, gain: 0.22, attack: 0.05, wet: 0.3 });
    this.tone(t, 70, 0.6, { gain: 0.22, to: 45, attack: 0.03, wet: 0.25 });
    for (let i = 0; i < 6; i++) this.noise(t + 0.15 + i * rand(0.05, 0.11), 0.03, { type: 'highpass', f: 3000, gain: 0.06, wet: 0.1 }); },
  slap() { if (!this.ok()) return; const t = this.now(); this.noise(t, 0.09, { type: 'bandpass', f: 1500, q: 0.6, gain: 0.32, attack: 0.002, wet: 0.2 }); this.tone(t, 160, 0.08, { gain: 0.1, to: 90 }); },
  hiss() { if (!this.ok()) return; const t = this.now(); this.noise(t, 0.7, { type: 'highpass', f: 2600, to: 5200, gain: 0.07, attack: 0.02, wet: 0.2 }); },
  tick() { if (!this.ok()) return; this.noise(this.now(), 0.014, { type: 'highpass', f: 4500, gain: 0.07, wet: 0 }); },
  amb: null,
  setAmbience(on) {
    if (!this.ctx) return;
    if (on && !this.amb) {
      const c = this.ctx, len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      const g = c.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.11, c.currentTime + 1.5);
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      const timer = setInterval(() => { if (this.ok()) { const t = this.now(); const n = 2 + (Math.random() * 4 | 0); for (let i = 0; i < n; i++) this.clack(t + i * rand(0.03, 0.07), rand(0.5, 1), true); } }, 3200);
      this.amb = { src, g, timer };
    } else if (!on && this.amb) {
      const { src, g, timer } = this.amb; clearInterval(timer);
      try { g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4); src.stop(this.ctx.currentTime + 0.5); } catch (e) {}
      this.amb = null;
    }
  }
};

/* =========================================================
   Background music: an original lounge-jazz trio generated live
   (electric piano, upright bass, brushed drums, a little vibes).
   Nothing is sampled or recorded, so there is no copyright to worry about.
   ========================================================= */
const Music = {
  want: false, ready: false, bus: null, timer: 0, level: 0.25, beat: 0, nextT: 0, tune: null, lastVoicing: null, lastBass: 40, mel: null, lastMel: 74,
  VOICING: { m9: [3, 7, 10, 14], m7: [3, 7, 10, 15], '13': [4, 10, 14, 21], '7b9': [4, 10, 13, 19], '7alt': [4, 10, 15, 20], maj9: [4, 7, 11, 14], '69': [4, 9, 14, 19], m7b5: [3, 6, 10, 15] },
  SCALE: { m9: [0, 2, 3, 5, 7, 9, 10], m7: [0, 2, 3, 5, 7, 9, 10], '13': [0, 2, 4, 5, 7, 9, 10], '7b9': [0, 1, 3, 4, 7, 9, 10], '7alt': [0, 1, 3, 4, 6, 8, 10], maj9: [0, 2, 4, 5, 7, 9, 11], '69': [0, 2, 4, 7, 9, 11], m7b5: [0, 1, 3, 5, 6, 8, 10] },
  TONES: { m9: [0, 3, 7, 10], m7: [0, 3, 7, 10], '13': [0, 4, 7, 10], '7b9': [0, 4, 7, 10], '7alt': [0, 4, 8, 10], maj9: [0, 4, 7, 11], '69': [0, 4, 7, 9], m7b5: [0, 3, 6, 10] },
  SECTIONS: {
    A: [
      [[2, 'm9', 4], [7, '13', 4], [0, 'maj9', 4], [9, '7b9', 4], [2, 'm9', 4], [7, '13', 4], [0, '69', 4], [0, '69', 4]],
      [[0, 'maj9', 4], [9, 'm9', 4], [2, 'm9', 4], [7, '13', 4], [4, 'm9', 2], [9, '7b9', 2], [2, 'm9', 2], [7, '13', 2], [0, 'maj9', 4], [0, 'maj9', 4]],
      [[2, 'm7b5', 4], [7, '7alt', 4], [0, 'm9', 4], [0, 'm9', 4], [5, 'm9', 4], [10, '13', 4], [3, 'maj9', 4], [7, '7alt', 4]],
    ],
    B: [
      [[5, 'maj9', 4], [5, 'm9', 2], [10, '13', 2], [4, 'm9', 4], [9, '7alt', 4], [2, 'm9', 4], [7, '13', 4], [4, 'm9', 2], [9, '7b9', 2], [2, 'm9', 2], [7, '13', 2]],
      [[4, 'm7b5', 4], [9, '7alt', 4], [2, 'm9', 4], [2, 'm9', 4], [7, 'm9', 4], [0, '13', 4], [5, 'maj9', 4], [7, '13', 4]],
    ],
  },
  COMP: [[0], [3], [2, 6], [1, 4], [3, 7], [0, 5], [6], [2], [1, 5], [0, 3, 6]],
  ctx() { return Sound.ctx; },
  init() {
    const c = this.ctx(); if (!c || this.ready) return !!this.ready;
    this.bus = c.createGain(); this.bus.gain.value = 0;
    const warm = c.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 7000;
    this.bus.connect(warm); warm.connect(c.destination);
    const irLen = Math.floor(c.sampleRate * 2.4), ir = c.createBuffer(2, irLen, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const x = ir.getChannelData(ch); for (let i = 0; i < irLen; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.6) * (i < 400 ? i / 400 : 1); }
    const verb = c.createConvolver(); verb.buffer = ir; const wet = c.createGain(); wet.gain.value = 0.32;
    this.send = c.createGain(); this.send.gain.value = 1; this.send.connect(verb); verb.connect(wet); wet.connect(warm);
    // electric piano bus with a gentle stereo tremolo
    this.keys = c.createGain(); this.keys.gain.value = 1;
    let out = this.keys;
    if (c.createStereoPanner) { const pan = c.createStereoPanner(); const lfo = c.createOscillator(), dep = c.createGain(); lfo.frequency.value = 4.2; dep.gain.value = 0.32; lfo.connect(dep); dep.connect(pan.pan); lfo.start(); this.keys.connect(pan); out = pan; }
    out.connect(this.bus); out.connect(this.send);
    this.dry = c.createGain(); this.dry.connect(this.bus); this.dry.connect(this.send);
    const nl = c.sampleRate, nb = c.createBuffer(1, nl, c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
    document.addEventListener('visibilitychange', () => this.sync());
    this.ready = true; return true;
  },
  set(on) { this.want = !!on; this.sync(); },
  sync() {
    const c = this.ctx(); if (!c) return;
    const play = this.want && !document.hidden && !S.test;
    if (play) {
      if (!this.init()) return;
      if (!this.timer) { this.nextT = c.currentTime + 0.15; if (!this.tune || this.beat >= this.tune.beats.length) this.newTune(); this.timer = setInterval(() => this.pump(), 60); }
      this.bus.gain.cancelScheduledValues(c.currentTime); this.bus.gain.setTargetAtTime(this.level, c.currentTime, 1.2);
    } else if (this.ready) {
      this.bus.gain.cancelScheduledValues(c.currentTime); this.bus.gain.setTargetAtTime(0, c.currentTime, 0.25);
      clearInterval(this.timer); this.timer = 0;
    }
  },
  duck(secs) {
    if (!this.ready || !this.timer) return; const c = this.ctx(), t = c.currentTime;
    this.bus.gain.cancelScheduledValues(t); this.bus.gain.setTargetAtTime(this.level * 0.5, t, 0.06); this.bus.gain.setTargetAtTime(this.level, t + secs + 0.2, 0.5);
  },
  newTune() {
    const S_ = this.SECTIONS, A = pick(S_.A), B = pick(S_.B), key = pick([5, 10, 3, 0, 7, 2, 8]);
    this.tempo = rand(80, 94); this.swing = 0.64;
    const beats = [];
    for (const sec of [A, A, B, A]) for (const [r, q, n] of sec) { const ch = { root: (r + key) % 12, q }; for (let k = 0; k < n; k++) beats.push({ ch, first: k === 0 }); }
    this.tune = { beats }; this.beat = 0; this.mel = null;
  },
  pump() {
    const c = this.ctx(); if (!c) return;
    while (this.nextT < c.currentTime + 0.35) {
      if (this.beat >= this.tune.beats.length) this.newTune();
      this.playBeat(this.beat, this.nextT);
      this.nextT += 60 / this.tempo; this.beat++;
    }
  },
  hz: m => 440 * Math.pow(2, (m - 69) / 12),
  env(g, t, a, peak, dec, end) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0.0001, t + a, dec); if (end) g.gain.setTargetAtTime(0.0001, end, 0.06); },
  playBeat(b, t) {
    const beats = this.tune.beats, cur = beats[b], nxt = beats[(b + 1) % beats.length], bd = 60 / this.tempo, inBar = b % 4;
    const sw = t + bd * this.swing; // the swung "and"
    // ---- bass: walking quarters
    const ch = cur.ch;
    let note;
    if (cur.first) note = this.near(ch.root, this.lastBass, 31, 50);
    else if (nxt.first && nxt.ch !== ch) { const tgt = this.near(nxt.ch.root, this.lastBass, 31, 50); note = Math.random() < 0.65 ? tgt + (Math.random() < 0.5 ? 1 : -1) : this.near((nxt.ch.root + 7) % 12, this.lastBass, 31, 50); }
    else { const tones = this.TONES[ch.q].concat(this.SCALE[ch.q]); const opts = tones.map(iv => this.near((ch.root + iv) % 12, this.lastBass, 31, 50)).filter(n => n !== this.lastBass); note = opts.sort((x, y) => Math.abs(x - this.lastBass) - Math.abs(y - this.lastBass))[Math.random() < 0.7 ? 0 : 1] || this.lastBass; }
    this.bass(t, note, bd * 0.92); this.lastBass = note;
    if (inBar === 3 && Math.random() < 0.12) this.bass(sw, note + (Math.random() < 0.5 ? 2 : -1), bd * 0.3, 0.55);
    // ---- drums: ride "ding, ding-ga", feathered kick, hat on 2 & 4, brush swishes
    this.ride(t, inBar % 2 ? 0.8 : 1);
    if (inBar % 2 === 1) this.ride(sw, 0.5);
    if (inBar % 2 === 1) this.hat(t);
    if (inBar % 2 === 0) this.kick(t);
    this.swish(t, bd, inBar);
    if (inBar === 3 && Math.random() < 0.3) this.snare(sw, 0.6);
    // ---- piano comping, chosen per bar
    if (inBar === 0) {
      const pat = pick(this.COMP);
      for (const pos of pat) {
        const bb = b + (pos >> 1); if (bb >= beats.length) continue;
        const at = t + (pos >> 1) * bd + (pos & 1 ? bd * this.swing : 0);
        const len = (pos & 1 ? 0.9 : 1.4) * bd * rand(0.8, 1.2);
        this.chord(at, beats[bb].ch, len);
      }
    }
    // ---- vibes: an occasional short phrase built from a recurring motif
    if (b % 8 === 0) {
      if (!this.mel || b % 32 === 0) this.mel = this.motif();
      if (Math.random() < 0.5) this.phrase(b, t, bd);
    }
  },
  near(pc, ref, lo, hi) { let best = null; for (let m = lo; m <= hi; m++) if (m % 12 === pc && (best === null || Math.abs(m - ref) < Math.abs(best - ref))) best = m; return best ?? ref; },
  voicing(ch) {
    const iv = this.VOICING[ch.q], prev = this.lastVoicing; const cands = [];
    for (let inv = 0; inv < 4; inv++) for (let oct = 4; oct <= 5; oct++) {
      const notes = iv.map((x, k) => ch.root + x + (k < inv ? 12 : 0) + oct * 12).sort((a, b) => a - b);
      if (notes[0] < 52 || notes[3] > 79) continue;
      const cost = prev ? notes.reduce((a, n, k) => a + Math.abs(n - prev[k]), 0) : Math.abs(notes[0] - 58);
      cands.push({ notes, cost });
    }
    cands.sort((a, b) => a.cost - b.cost); const v = (cands[0] || { notes: iv.map(x => ch.root + 48 + x) }).notes;
    this.lastVoicing = v; return v;
  },
  chord(t, ch, len) {
    const v = this.voicing(ch), vel = rand(0.75, 1);
    v.forEach((m, k) => this.ep(t + k * rand(0.004, 0.012), m, len, vel * (k === 0 ? 0.9 : 1)));
  },
  ep(t, m, len, vel) { // FM electric piano
    const c = this.ctx(), f = this.hz(m);
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain(), lp = c.createBiquadFilter();
    car.frequency.value = f; mod.frequency.value = f; mod.connect(mg); mg.connect(car.frequency);
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.setTargetAtTime(f * 0.25, t, 0.12);
    lp.type = 'lowpass'; lp.frequency.value = 2600 + m * 10;
    car.connect(lp); lp.connect(g); g.connect(this.keys);
    this.env(g, t, 0.004, 0.12 * vel, 0.9, t + len);
    car.start(t); mod.start(t); car.stop(t + len + 0.5); mod.stop(t + len + 0.5);
  },
  bass(t, m, len, vel = 1) {
    const c = this.ctx(), f = this.hz(m);
    const o1 = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o1.type = 'sine'; o2.type = 'triangle'; o1.frequency.value = f; o2.frequency.value = f;
    o1.frequency.setValueAtTime(f * 1.02, t); o1.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(380, t + 0.25);
    const g2 = c.createGain(); g2.gain.value = 0.45;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(this.dry);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.24 * vel, t + 0.008); g.gain.setTargetAtTime(0.0001, t + 0.008, 0.3); g.gain.setTargetAtTime(0.0001, t + len, 0.05);
    o1.start(t); o2.start(t); o1.stop(t + len + 0.4); o2.stop(t + len + 0.4);
  },
  noiseHit(t, dur, { type = 'bandpass', f = 8000, q = 0.8, gain = 0.05, attack = 0.002, pan = 0 } = {}) {
    const c = this.ctx(), s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.playbackRate.value = rand(0.9, 1.1); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    s.connect(fl); fl.connect(g);
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.dry); } else g.connect(this.dry);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.setTargetAtTime(0.0001, t + attack, dur / 3);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.3);
  },
  ride(t, v) {
    this.noiseHit(t, 0.5 * v, { type: 'highpass', f: 6500, gain: 0.16 * v, pan: 0.35 });
    const c = this.ctx();
    for (const f of [3150, 4720, 6080]) { const o = c.createOscillator(), g = c.createGain(), hp = c.createBiquadFilter(); o.type = 'square'; o.frequency.value = f * rand(0.995, 1.005); hp.type = 'highpass'; hp.frequency.value = 5000; o.connect(hp); hp.connect(g); g.connect(this.dry); this.env(g, t, 0.001, 0.01 * v, 0.12); o.start(t); o.stop(t + 0.6); }
  },
  hat(t) { this.noiseHit(t, 0.06, { type: 'highpass', f: 7500, gain: 0.06, pan: -0.3 }); },
  kick(t) { const c = this.ctx(), o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(68, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12); o.connect(g); g.connect(this.dry); this.env(g, t, 0.004, 0.07, 0.06); o.start(t); o.stop(t + 0.4); },
  snare(t, v) { this.noiseHit(t, 0.12, { f: 1900, q: 0.7, gain: 0.06 * v, pan: -0.15 }); },
  swish(t, bd, k) { this.noiseHit(t + bd * 0.05, bd * 0.8, { f: 2600, q: 0.6, gain: 0.03, attack: bd * 0.35, pan: k % 2 ? 0.25 : -0.25 }); },
  motif() {
    const n = 4 + ((Math.random() * 4) | 0), slots = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).slice(0, n).sort((a, b) => a - b);
    let s = 0; return slots.map((pos, k) => { s += k ? pick([-2, -1, -1, 1, 1, 2, 3, -3]) : 0; return { pos, step: s, long: k === n - 1 }; });
  },
  phrase(b, t, bd) {
    const beats = this.tune.beats; let ref = this.lastMel, base = null;
    for (const nt of this.mel) {
      const bb = b + (nt.pos >> 1); if (bb >= beats.length) break;
      const ch = beats[bb].ch, sc = this.SCALE[ch.q];
      const pool = []; for (let m = 64; m <= 86; m++) if (sc.includes((m - ch.root + 120) % 12)) pool.push(m);
      if (base === null) { base = pool.reduce((a, m) => Math.abs(m - ref) < Math.abs(a - ref) ? m : a, pool[0]); }
      const idx = clamp(pool.indexOf(pool.reduce((a, m) => Math.abs(m - base) < Math.abs(a - base) ? m : a, pool[0])) + nt.step, 0, pool.length - 1);
      let m = pool[idx];
      if (nt.long) { const tones = this.TONES[ch.q]; while (!tones.includes((m - ch.root + 120) % 12) && m > 64) m--; }
      const at = t + (nt.pos >> 1) * bd + (nt.pos & 1 ? bd * this.swing : 0);
      this.vibe(at, m, nt.long ? bd * 1.8 : bd * 0.7);
      ref = m;
    }
    this.lastMel = ref;
  },
  vibe(t, m, len) {
    const c = this.ctx(), f = this.hz(m), o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain(), trem = c.createGain(), lfo = c.createOscillator(), ld = c.createGain();
    o.frequency.value = f; o2.frequency.value = f * 4; g2.gain.value = 0.12;
    lfo.frequency.value = 5.5; ld.gain.value = 0.35; lfo.connect(ld); ld.connect(trem.gain); trem.gain.value = 0.75;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(trem); trem.connect(this.keys);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.075 * rand(0.8, 1), t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.004, len * 0.6);
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + len * 3 + 0.3); }
  },
};

/* =========================================================
   Dealer voice: the device's built-in speech synthesis
   ========================================================= */
const Voice = {
  v: null, unlocked: false,
  supported: typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined',
  init() {
    if (!this.supported) return;
    const bad = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|fred|kathy|princess|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i;
    const choose = () => {
      const vs = speechSynthesis.getVoices(); if (!vs.length) return;
      const pref = ['Google UK English Male', 'Daniel', 'Arthur', 'Oliver', 'Microsoft Ryan', 'Google UK English Female', 'Serena', 'Martha', 'Microsoft Sonia', 'Samantha', 'Google US English', 'Microsoft Guy', 'Microsoft Aria', 'Alex'];
      let v = null;
      for (const n of pref) { v = vs.find(x => x.name.startsWith(n) && !bad.test(x.name)); if (v) break; }
      if (!v) v = vs.find(x => /^en[-_]GB/i.test(x.lang) && !bad.test(x.name)) || vs.find(x => /^en/i.test(x.lang) && !bad.test(x.name)) || null;
      this.v = v;
    };
    choose();
    try { speechSynthesis.addEventListener('voiceschanged', choose); } catch (e) {}
  },
  unlock() {
    if (this.unlocked || !this.supported) return; this.unlocked = true;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {}
  },
  say(text, priority = false) {
    if (!this.supported || !settings.voice || !settings.sound || S.test) return;
    try {
      const ss = speechSynthesis;
      if (priority && (ss.speaking || ss.pending)) ss.cancel();
      else if (ss.pending) return;
      const u = new SpeechSynthesisUtterance(text);
      if (this.v) { u.voice = this.v; u.lang = this.v.lang; } else u.lang = 'en-GB';
      u.rate = 1.04; u.pitch = 0.94; u.volume = 1;
      ss.speak(u);
    } catch (e) {}
  },
  stop() { try { if (this.supported) speechSynthesis.cancel(); } catch (e) {} }
};

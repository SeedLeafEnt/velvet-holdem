'use strict';
/* Velvet Hold'em: 03-fx.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Particles (gold sparks & confetti) on a 2D canvas above the 3D view
   ========================================================= */
const FX = {
  cv: null, cx: null, parts: [], raf: 0, dpr: 1,
  init() { this.cv = $('#fx'); this.cx = this.cv.getContext('2d'); this.resize(); },
  resize() { const r = this.cv.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1); this.cv.width = r.width * this.dpr; this.cv.height = r.height * this.dpr; },
  burst(x, y, n = 40, power = 1) {
    if (reducedMotion || S.test) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rand(1.5, 5.5) * power;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2.2 * power, g: 0.12, life: 0, max: rand(45, 85), s: rand(1.2, 3.2), k: 'spark', hue: rand(38, 50) });
    }
    this.start();
  },
  confetti(n = 140) {
    if (reducedMotion || S.test) return;
    const W = this.cv.width / this.dpr; const cols = ['#e9c56e', '#f6efe1', '#1f8a74', '#9c2a3c', '#ffe7a3'];
    for (let i = 0; i < n; i++) this.parts.push({ x: rand(0, W), y: rand(-200, -10), vx: rand(-1, 1), vy: rand(1.5, 3.5), g: 0.03, life: 0, max: rand(160, 260), s: rand(5, 9), k: 'conf', c: cols[i % cols.length], rot: rand(0, 6), vr: rand(-0.2, 0.2) });
    this.start();
  },
  start() { if (!this.raf) this.raf = requestAnimationFrame(() => this.step()); },
  step() {
    const c = this.cx, d = this.dpr; c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height);
    this.parts = this.parts.filter(p => p.life < p.max);
    for (const p of this.parts) {
      p.life++; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.985;
      const a = 1 - p.life / p.max;
      if (p.k === 'spark') {
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = `hsla(${p.hue}, 95%, ${60 + a * 25}%, ${a})`;
        c.beginPath(); c.arc(p.x, p.y, p.s * (0.6 + a * 0.6), 0, 7); c.fill();
      } else {
        c.globalCompositeOperation = 'source-over';
        p.rot += p.vr; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = Math.min(1, a * 2);
        c.fillStyle = p.c; c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * (0.4 + Math.abs(Math.sin(p.life * 0.15)))); c.restore();
      }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    this.raf = this.parts.length ? requestAnimationFrame(() => this.step()) : 0;
    if (!this.raf) c.clearRect(0, 0, this.cv.width, this.cv.height);
  }
};

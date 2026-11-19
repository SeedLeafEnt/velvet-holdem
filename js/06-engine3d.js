'use strict';
/* Velvet Hold'em: 06-engine3d.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   3D engine
   ========================================================= */
const V3 = THREE.Vector3;
const CARD_W = 0.14, CARD_H = 0.196, CARD_R = 0.012;
const CHIP_R = 0.034, CHIP_H = 0.007;
let HERO_S = 1.32, HERO_TILT = 0.5;
const OPP_S = 0.72, REV_S = 0.92;
let BOARD_S = 1.35;
const G = { W: 300, H: 400, portrait: true, table: { W: 1.5, D: 2.45 }, felt: { W: 1, D: 1 }, av: 44, plateW: 84, maxAniso: 4, ok: false };
const A = { seats: [], board: [], pot: new V3(), deck: new V3(), muck: new V3(), boardZ: 0, banner: new V3(), logoZ: 0 };
let renderer, scene, camera, spot, tableGroup = null, dealerPuck, deckMesh;
const MAT = {};
const TEX = {};
const liveCards = new Set();

/* --- Animation loop helpers --- */
const anims = [];
function animate(dur, fn, ease = easeOut, delayMs = 0) {
  if (S.test || dur <= 0 || !G.ok) { fn(1, 1); return Promise.resolve(); }
  const d = Math.max(16, dur * spd());
  return new Promise(res => anims.push({ t0: performance.now() + delayMs * spd(), d, fn, ease, res }));
}
function stepAnims(now) {
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i]; if (now < a.t0) continue;
    const k = Math.min(1, (now - a.t0) / a.d);
    a.fn(a.ease(k), k);
    if (k >= 1) { anims.splice(i, 1); a.res(); }
  }
}
function flushAnims() { for (const a of anims.splice(0)) { try { a.fn(1, 1); } catch (e) {} a.res(); } }

/* --- Geometry helpers --- */
function stadiumShape(w, d, shape = new THREE.Shape()) {
  /* Sampled outline with no repeated closing point: keeps extrude bevels smooth at the arc/straight seams. */
  const r = Math.min(w, d) / 2, half = Math.abs(w - d) / 2, N = 40, pts = [];
  if (w >= d) {
    for (let k = 0; k < N; k++) { const a = -Math.PI / 2 + k / N * Math.PI; pts.push([half + r * Math.cos(a), r * Math.sin(a)]); }
    pts.push([half, r]);
    for (let k = 0; k < N; k++) { const a = Math.PI / 2 + k / N * Math.PI; pts.push([-half + r * Math.cos(a), r * Math.sin(a)]); }
    pts.push([-half, -r]);
  } else {
    for (let k = 0; k < N; k++) { const a = k / N * Math.PI; pts.push([r * Math.cos(a), half + r * Math.sin(a)]); }
    pts.push([-r, half]);
    for (let k = 0; k < N; k++) { const a = Math.PI + k / N * Math.PI; pts.push([r * Math.cos(a), -half + r * Math.sin(a)]); }
    pts.push([r, -half]);
  }
  const clean = pts.filter((p, i) => { const q = pts[(i + pts.length - 1) % pts.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });
  clean.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  return shape;
}
function stadiumEdge(angDeg, w, h) {
  const a = angDeg * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
  const r = Math.min(w, h) / 2, half = Math.abs(w - h) / 2, horiz = w >= h;
  const inside = (x, y) => { const px = horiz ? clamp(x, -half, half) : 0, py = horiz ? 0 : clamp(y, -half, half); return Math.hypot(x - px, y - py) <= r; };
  let lo = 0, hi = Math.max(w, h);
  for (let k = 0; k < 28; k++) { const m = (lo + hi) / 2; if (inside(m * dx, m * dy)) lo = m; else hi = m; }
  return { x: lo * dx, z: lo * dy };
}
function stadiumSide(side, z, w, d) {
  /* Portrait table: a point on the long left/right edge at depth z, with the edge's outward normal. */
  const r = w / 2, half = Math.max(0, (d - w) / 2);
  if (Math.abs(z) <= half) return { x: side * r, z, nx: side, nz: 0 };
  const c = Math.sign(z) * half, dz = clamp(z - c, -r * 0.98, r * 0.98), x = side * Math.sqrt(r * r - dz * dz);
  return { x, z: c + dz, nx: x / r, nz: dz / r };
}
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function boxUV(geo, w, h) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  uv.needsUpdate = true;
}
function ctxStadium(x, cx, cy, w, h) {
  const r = Math.min(w, h) / 2, half = Math.abs(w - h) / 2; x.beginPath();
  if (w >= h) { x.moveTo(cx - half, cy - r); x.lineTo(cx + half, cy - r); x.arc(cx + half, cy, r, -Math.PI / 2, Math.PI / 2); x.lineTo(cx - half, cy + r); x.arc(cx - half, cy, r, Math.PI / 2, Math.PI * 1.5); }
  else { x.moveTo(cx + r, cy - half); x.lineTo(cx + r, cy + half); x.arc(cx, cy + half, r, 0, Math.PI); x.lineTo(cx - r, cy - half); x.arc(cx, cy - half, r, Math.PI, Math.PI * 2); }
  x.closePath();
}
function canvasTex(cv, srgb = true) { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = G.maxAniso; return t; }
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function grain(x, w, h, amt) { const id = x.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(id, 0, 0); }

/* --- Procedural textures --- */
function noiseTex(size, amt, blobs = 0) {
  const [cv, x] = mkCanvas(size, size); x.fillStyle = '#808080'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < blobs; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${rand(.04, .12)})`; x.beginPath(); x.arc(rand(0, size), rand(0, size), rand(1, 4), 0, 7); x.fill(); }
  grain(x, size, size, amt);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function woodTex() {
  const [cv, x] = mkCanvas(512, 512); x.fillStyle = '#4c2614'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 170; i++) {
    const y0 = Math.random() * 512, amp = rand(1, 5), ph = rand(0, 6);
    x.strokeStyle = `rgba(${rand(20, 100) | 0},${rand(8, 46) | 0},${rand(2, 18) | 0},${rand(.12, .45)})`; x.lineWidth = rand(.6, 3.2);
    x.beginPath(); for (let xx = 0; xx <= 512; xx += 16) { const yy = y0 + Math.sin(xx * 0.0123 + ph) * amp; xx === 0 ? x.moveTo(xx, yy) : x.lineTo(xx, yy); } x.stroke();
  }
  grain(x, 512, 512, 10);
  const t = canvasTex(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.6, 2.6); return t;
}
function carpetTex() {
  const [cv, x] = mkCanvas(256, 256); x.fillStyle = '#0c0f14'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(150,110,60,.12)'; x.lineWidth = 2;
  for (const [cx, cy] of [[0, 128], [128, 0], [256, 128], [128, 256], [128, 128], [0, 0], [256, 0], [0, 256], [256, 256]]) {
    for (let r = 18; r <= 64; r += 15) { x.beginPath(); x.arc(cx, cy, r, Math.PI, Math.PI * 2); x.stroke(); }
  }
  x.fillStyle = 'rgba(110,30,45,.25)'; for (const [cx, cy] of [[64, 64], [192, 192], [64, 192], [192, 64]]) { x.beginPath(); x.moveTo(cx, cy - 12); x.lineTo(cx + 12, cy); x.lineTo(cx, cy + 12); x.lineTo(cx - 12, cy); x.fill(); }
  grain(x, 256, 256, 16);
  const t = canvasTex(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); return t;
}
function glowTex() {
  const [cv, x] = mkCanvas(128, 128); const g = x.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.55, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return canvasTex(cv);
}
function feltTexture() {
  const fW = G.felt.W, fD = G.felt.D, asp = fW / fD, M = 2048;
  const cw = asp >= 1 ? M : Math.round(M * asp), ch = asp >= 1 ? Math.round(M / asp) : M;
  const [cv, x] = mkCanvas(cw, ch); const m2p = cw / fW;
  const toPx = (wx, wz) => [(wx + fW / 2) * m2p, (wz + fD / 2) * m2p];
  const g = x.createRadialGradient(cw / 2, ch * 0.47, 0, cw / 2, ch / 2, Math.max(cw, ch) * 0.62);
  const TH = (typeof THEME !== 'undefined' && THEME) || { felt: ['#1b8174', '#11685d', '#0a4740'], logo: 'VELVET', sub: "NO LIMIT TEXAS HOLD'EM" };
  g.addColorStop(0, TH.felt[0]); g.addColorStop(0.5, TH.felt[1]); g.addColorStop(1, TH.felt[2]);
  x.fillStyle = g; x.fillRect(0, 0, cw, ch);
  grain(x, cw, ch, 12);
  x.strokeStyle = 'rgba(224,192,124,.30)'; x.lineWidth = 0.0065 * m2p;
  ctxStadium(x, cw / 2, ch / 2, (fW - 0.42) * m2p, (fD - 0.42) * m2p); x.stroke();
  const [lx, ly] = toPx(0, A.logoZ);
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(224,192,124,.20)';
  try { x.letterSpacing = `${0.025 * m2p}px`; } catch (e) {}
  x.font = `${0.085 * Math.min(1, 7 / TH.logo.length) * m2p}px Limelight, Didot, Georgia, serif`; x.fillText(TH.logo, lx, ly);
  try { x.letterSpacing = `${0.012 * m2p}px`; } catch (e) {}
  x.font = `600 ${0.026 * m2p}px "Barlow Condensed", "Arial Narrow", sans-serif`; x.fillText(TH.sub, lx, ly + 0.07 * m2p);
  return canvasTex(cv);
}

/* --- Card faces (canvas textures) --- */
const CWpx = 360, CHpx = Math.round(360 * CARD_H / CARD_W);
const SUIT_D = [
  'M50 4C58 20 96 40 96 64C96 80 84 88 71 88C63 88 56 84 53 78C54 87 58 93 66 97L34 97C42 93 46 87 47 78C44 84 37 88 29 88C16 88 4 80 4 64C4 40 42 20 50 4Z',
  'M50 92C46 84 4 62 4 32C4 16 15 6 29 6C39 6 46 12 50 21C54 12 61 6 71 6C85 6 96 16 96 32C96 62 54 84 50 92Z',
  'M50 3C60 20 74 36 88 50C74 64 60 80 50 97C40 80 26 64 12 50C26 36 40 20 50 3Z',
  'M30 27a20 20 0 1 0 40 0a20 20 0 1 0-40 0ZM6 58a20 20 0 1 0 40 0a20 20 0 1 0-40 0ZM54 58a20 20 0 1 0 40 0a20 20 0 1 0-40 0ZM38 52a12 12 0 1 0 24 0a12 12 0 1 0-24 0ZM46 60L54 60C55 78 59 89 67 97L33 97C41 89 45 78 46 60Z'
];
let SUIT_P = null;
/* Classic: traditional two-corner deck with a large, heavy serif index and full pip layouts.
   Jumbo: one oversized index plus a single big suit, for the smallest screens. */
const SERIF = s => `800 ${s}px "Source Serif 4", "Iowan Old Style", Georgia, "Times New Roman", serif`;
const CARD_STYLES = {
  classic: { font: SERIF, probe: '800 40px "Source Serif 4"', idx: .22, idxSuit: .13, mx: .045, my: .03, idxW: .29, gap: .014, mirror: true, layout: 'pips', box: [.38, .62, .29, .71], pip: .125, ace: .42, court: [.31, .69, .27, .73] },
  jumbo:   { font: SERIF, probe: '800 40px "Source Serif 4"', idx: .27, idxSuit: .14, mx: .05, my: .03, idxW: .36, gap: .016, mirror: false, layout: 'big', big: .56 },
};
const capCache = {};
function capRatio(x, st) {
  const key = st.probe; if (capCache[key]) return capCache[key];
  x.font = st.font(100); const m = x.measureText('A');
  const r = m.actualBoundingBoxAscent ? m.actualBoundingBoxAscent / 100 : 0.68;
  if (document.fonts && document.fonts.check && document.fonts.check(st.probe)) capCache[key] = r;
  return r;
}
const suitColor = s => s === 0 ? '#121316' : s === 1 ? '#cf1430' : s === 2 ? (settings.deck4 ? '#1658c9' : '#cf1430') : (settings.deck4 ? '#0f7d3a' : '#121316');
function drawSuit(x, s, cx, cy, size, flip) {
  if (!SUIT_P) SUIT_P = SUIT_D.map(d => new Path2D(d));
  x.save(); x.translate(cx, cy); if (flip) x.rotate(Math.PI); const k = size / 100; x.scale(k, k); x.translate(-50, -50); x.fill(SUIT_P[s]); x.restore();
}
const PIPS = {
  2: [[.5, 0], [.5, 1]], 3: [[.5, 0], [.5, .5], [.5, 1]], 4: [[0, 0], [1, 0], [0, 1], [1, 1]], 5: [[0, 0], [1, 0], [.5, .5], [0, 1], [1, 1]],
  6: [[0, 0], [1, 0], [0, .5], [1, .5], [0, 1], [1, 1]], 7: [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [0, 1], [1, 1]],
  8: [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [.5, .75], [0, 1], [1, 1]],
  9: [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [.5, .5], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1]],
  10: [[0, 0], [1, 0], [.5, 1 / 6], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [.5, 5 / 6], [0, 1], [1, 1]],
};
function drawIndex(x, st, r, s, col) {
  const rh = st.idx * CHpx, R = RANK_CH[r];
  x.font = st.font(rh / capRatio(x, st)); x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = col;
  const cxI = (st.mx + st.idxW / 2) * CWpx, top = st.my * CHpx;
  const w = x.measureText(R).width, maxW = st.idxW * CWpx * (R === '10' ? 1.12 : 0.95);
  x.save(); x.translate(cxI + (R === '10' ? 0.01 * CWpx : 0), top + rh); if (w > maxW) x.scale(maxW / w, 1); x.fillText(R, 0, 0); x.restore();
  if (st.idxSuit) drawSuit(x, s, cxI, top + rh + st.gap * CHpx + st.idxSuit * CHpx / 2, st.idxSuit * CHpx, false);
}
function goldFill(x, y0, y1) { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#f2d27e'); g.addColorStop(.5, '#cf9a36'); g.addColorStop(1, '#9e6c20'); return g; }
function drawEmblem(x, r, s, col, w, hh) {
  const S = Math.min(w * 0.95, hh * 1.2); x.save(); x.translate(0, -hh * 0.5);
  x.lineJoin = 'round'; x.lineWidth = Math.max(2, S * 0.026); x.strokeStyle = '#4a300a'; x.fillStyle = goldFill(x, -S * .45, S * .1);
  const P = (pts) => { x.beginPath(); pts.forEach(([a, b], k) => k ? x.lineTo(a * S, b * S) : x.moveTo(a * S, b * S)); x.closePath(); x.fill(); x.stroke(); };
  if (r === 13) {
    P([[-.4, .02], [-.4, -.34], [-.29, -.08], [-.2, -.27], [-.1, -.08], [0, -.42], [.1, -.08], [.2, -.27], [.29, -.08], [.4, -.34], [.4, .02]]);
    x.fillStyle = col; for (const [a, b] of [[-.4, -.36], [-.2, -.29], [0, -.44], [.2, -.29], [.4, -.36]]) { x.beginPath(); x.arc(a * S, b * S, S * .045, 0, 7); x.fill(); }
  } else if (r === 12) {
    x.beginPath(); x.moveTo(-.42 * S, .04 * S); x.quadraticCurveTo(0, -.12 * S, .42 * S, .04 * S); x.lineTo(.4 * S, -.06 * S); x.quadraticCurveTo(0, -.22 * S, -.4 * S, -.06 * S); x.closePath(); x.fill(); x.stroke();
    const leaf = (cx, tip, base, wd) => { x.beginPath(); x.moveTo(cx * S, tip * S); x.bezierCurveTo((cx + wd) * S, (tip + .1) * S, (cx + wd * .8) * S, (base - .04) * S, cx * S, base * S); x.bezierCurveTo((cx - wd * .8) * S, (base - .04) * S, (cx - wd) * S, (tip + .1) * S, cx * S, tip * S); x.fill(); x.stroke(); };
    x.fillStyle = goldFill(x, -S * .45, 0); leaf(0, -.46, -.14, .14); leaf(-.24, -.32, -.1, .1); leaf(.24, -.32, -.1, .1);
    x.fillStyle = col; x.beginPath(); x.arc(0, -.28 * S, S * .06, 0, 7); x.fill();
  } else {
    x.beginPath(); x.moveTo(-.08 * S, .04 * S); x.bezierCurveTo(-.38 * S, -.08 * S, -.24 * S, -.42 * S, .2 * S, -.47 * S); x.bezierCurveTo(.06 * S, -.32 * S, .14 * S, -.12 * S, -.08 * S, .04 * S); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(-.06 * S, .02 * S); x.quadraticCurveTo(-.06 * S, -.22 * S, .16 * S, -.44 * S); x.stroke();
    x.fillStyle = col; x.beginPath(); x.arc(-.07 * S, .03 * S, S * .065, 0, 7); x.fill();
  }
  x.fillStyle = col; drawSuit(x, s, 0, S * .3, S * .36, false);
  x.restore();
}
function drawCourt(x, r, s, col, box) {
  const x0 = box[0] * CWpx, x1 = box[1] * CWpx, y0 = box[2] * CHpx, y1 = box[3] * CHpx, w = x1 - x0, h = y1 - y0;
  x.fillStyle = (s === 1 || (s === 2 && !settings.deck4)) ? '#fdf0ee' : '#f1f2f4'; x.fillRect(x0, y0, w, h);
  for (const flip of [false, true]) { x.save(); x.translate(x0 + w / 2, y0 + h / 2); if (flip) x.rotate(Math.PI); drawEmblem(x, r, s, col, w, h / 2); x.restore(); }
  x.strokeStyle = col; x.globalAlpha = .35; x.lineWidth = 2; x.beginPath(); x.moveTo(x0 + 8, y0 + h / 2); x.lineTo(x1 - 8, y0 + h / 2); x.stroke(); x.globalAlpha = 1;
  x.lineWidth = 5; x.strokeStyle = col; x.strokeRect(x0 + 2.5, y0 + 2.5, w - 5, h - 5);
  x.lineWidth = 2; x.strokeStyle = '#b8862e'; x.strokeRect(x0 + 9, y0 + 9, w - 18, h - 18);
}
function paper(x) {
  const g = x.createLinearGradient(0, 0, 0, CHpx); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f6f3ec');
  x.fillStyle = g; x.fillRect(0, 0, CWpx, CHpx);
  grain(x, CWpx, CHpx, 4);
  const rr = CARD_R / CARD_W * CWpx; x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 3;
  x.beginPath(); x.roundRect ? x.roundRect(1.5, 1.5, CWpx - 3, CHpx - 3, rr) : x.rect(1.5, 1.5, CWpx - 3, CHpx - 3); x.stroke();
}
function drawFace(c) {
  const [cv, x] = mkCanvas(CWpx, CHpx); const st = CARD_STYLES[settings.cardStyle] || CARD_STYLES.classic;
  const r = rankOf(c), s = suitOf(c), col = suitColor(s);
  paper(x);
  drawIndex(x, st, r, s, col);
  if (st.mirror) { x.save(); x.translate(CWpx, CHpx); x.rotate(Math.PI); drawIndex(x, st, r, s, col); x.restore(); }
  x.fillStyle = col;
  if (st.layout === 'big') {
    const size = st.big * CWpx, cx = CWpx * .66, cy = CHpx * .7;
    if (r >= 11 && r <= 13) {
      x.save(); x.strokeStyle = '#b8862e'; x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, size * .6, 0, 7); x.stroke();
      x.fillStyle = 'rgba(214,178,100,.16)'; x.fill(); x.restore(); x.fillStyle = col; drawSuit(x, s, cx, cy, size * .8, false);
    } else drawSuit(x, s, cx, cy, size, false);
  } else if (r === 14) {
    const size = st.ace * CWpx;
    if (s === 0) { x.save(); x.strokeStyle = '#b8862e'; x.lineWidth = 3; x.beginPath(); x.arc(CWpx / 2, CHpx / 2, size * .6, 0, 7); x.stroke(); x.restore(); x.fillStyle = col; }
    drawSuit(x, s, CWpx / 2, CHpx / 2, size, false);
  } else if (r >= 11) {
    drawCourt(x, r, s, col, st.court);
  } else {
    const [bx0, bx1, by0, by1] = st.box, pip = st.pip * CWpx;
    for (const [px, py] of PIPS[r]) drawSuit(x, s, (bx0 + (bx1 - bx0) * px) * CWpx, (by0 + (by1 - by0) * py) * CHpx, pip, py > 0.5);
  }
  return cv;
}
function drawBack() {
  const [cv, x] = mkCanvas(CWpx, CHpx);
  x.fillStyle = '#f3eee2'; x.fillRect(0, 0, CWpx, CHpx);
  const m = CWpx * .06, w = CWpx - 2 * m, h = CHpx - 2 * m;
  const g = x.createRadialGradient(CWpx / 2, CHpx / 2, 10, CWpx / 2, CHpx / 2, CHpx * .6); g.addColorStop(0, '#a82e43'); g.addColorStop(1, '#5a1221');
  x.fillStyle = g; x.beginPath(); x.roundRect ? x.roundRect(m, m, w, h, 10) : x.rect(m, m, w, h); x.fill();
  x.save(); x.clip(); x.strokeStyle = 'rgba(236,200,126,.28)'; x.lineWidth = 1.4;
  for (let k = -CHpx; k < CWpx + CHpx; k += 14) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + CHpx, CHpx); x.stroke(); x.beginPath(); x.moveTo(k, CHpx); x.lineTo(k + CHpx, 0); x.stroke(); }
  x.restore();
  x.strokeStyle = 'rgba(214,178,100,.85)'; x.lineWidth = 2; x.strokeRect(m + 8, m + 8, w - 16, h - 16);
  const cx = CWpx / 2, cy = CHpx / 2, R = CWpx * .19;
  x.fillStyle = '#5c1220'; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
  x.strokeStyle = '#d6b264'; x.lineWidth = 3; x.stroke(); x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, R * .82, 0, 7); x.stroke();
  x.fillStyle = goldFill(x, cy - R * .6, cy + R * .6); x.beginPath(); x.moveTo(cx, cy - R * .62); x.lineTo(cx + R * .42, cy); x.lineTo(cx, cy + R * .62); x.lineTo(cx - R * .42, cy); x.closePath(); x.fill();
  x.fillStyle = '#5c1220'; x.beginPath(); x.moveTo(cx, cy - R * .3); x.lineTo(cx + R * .2, cy); x.lineTo(cx, cy + R * .3); x.lineTo(cx - R * .2, cy); x.closePath(); x.fill();
  return cv;
}
const Cards = {
  cache: new Map(),
  tex(c) { let t = this.cache.get(c); if (!t) { t = canvasTex(drawFace(c)); this.cache.set(c, t); } return t; },
  refresh() {
    for (const t of this.cache.values()) t.dispose(); this.cache.clear();
    for (const k of Object.keys(capCache)) delete capCache[k];
    for (const card of liveCards) if (card.c >= 0) { card.frontMat.map = this.tex(card.c); card.frontMat.needsUpdate = true; }
  }
};

/* --- Chip textures --- */
const DEN = [5, 25, 100, 500, 1000, 5000];
const DEN_LBL = ['5', '25', '100', '500', '1K', '5K'];
const CHIP_COL = [['#c3323a', '#f3ece0', '#c3323a'], ['#1c875a', '#f3ece0', '#1c875a'], ['#1f2126', '#e1bf75', '#1f2126'], ['#6a3d9e', '#f3ece0', '#6a3d9e'], ['#dfae36', '#4a3008', '#6b4a0c'], ['#d6632a', '#fff2dc', '#a2421a']];
function chipFace(di) {
  const N = 256, c = N / 2, [base, acc, txt] = CHIP_COL[di]; const [cv, x] = mkCanvas(N, N);
  x.fillStyle = base; x.fillRect(0, 0, N, N);
  x.save(); x.translate(c, c); x.fillStyle = acc;
  for (let k = 0; k < 8; k++) { x.save(); x.rotate(k * Math.PI / 4); x.fillRect(-N * .055, -c, N * .11, N * .14); x.restore(); }
  x.restore();
  x.strokeStyle = acc; x.globalAlpha = .75; x.lineWidth = 3; x.setLineDash([6, 5]); x.beginPath(); x.arc(c, c, c * .76, 0, 7); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
  x.fillStyle = di === 2 ? '#2a2c31' : '#f5eddc'; x.beginPath(); x.arc(c, c, c * .6, 0, 7); x.fill();
  x.strokeStyle = di === 2 ? '#e1bf75' : base; x.lineWidth = 2; x.stroke();
  x.fillStyle = di === 2 ? '#e1bf75' : txt; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `700 ${N * .26}px "Barlow Condensed", "Arial Narrow", sans-serif`; x.fillText(DEN_LBL[di], c, c - N * .02);
  try { x.letterSpacing = '2px'; } catch (e) {}
  x.font = `600 ${N * .065}px "Barlow Condensed", "Arial Narrow", sans-serif`; x.fillText('VELVET', c, c + N * .15);
  grain(x, N, N, 8);
  return canvasTex(cv);
}
function chipEdge(di) {
  const [base, acc] = CHIP_COL[di]; const [cv, x] = mkCanvas(512, 32);
  x.fillStyle = base; x.fillRect(0, 0, 512, 32); x.fillStyle = acc;
  for (let k = 0; k < 8; k++) x.fillRect(k * 64 + 4, 0, 20, 32);
  x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, 512, 3); x.fillRect(0, 29, 512, 3);
  return canvasTex(cv);
}
function puckFace() {
  const N = 256, c = N / 2; const [cv, x] = mkCanvas(N, N);
  x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, N, N);
  x.strokeStyle = '#1b1b1b'; x.lineWidth = 4; x.beginPath(); x.arc(c, c, c * .82, 0, 7); x.stroke();
  x.fillStyle = '#1b1b1b'; x.textAlign = 'center'; x.textBaseline = 'middle';
  try { x.letterSpacing = '4px'; } catch (e) {}
  x.font = `700 ${N * .2}px "Barlow Condensed", "Arial Narrow", sans-serif`; x.fillText('DEALER', c + 2, c);
  return canvasTex(cv);
}
function paperEdge() { const [cv, x] = mkCanvas(64, 64); x.fillStyle = '#ebe5d8'; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < 64; y += 3) x.fillRect(0, y, 64, 1); return canvasTex(cv); }

/* --- Card objects --- */
const GEO = {};
class Card3D {
  constructor(c, slot, up = false) {
    this.c = c; this.slot = slot; this.up = up;
    this.g = new THREE.Group(); this.tiltG = new THREE.Group(); this.flipG = new THREE.Group();
    this.g.add(this.tiltG); this.tiltG.add(this.flipG);
    this.frontMat = new THREE.MeshStandardMaterial({ map: c >= 0 ? Cards.tex(c) : null, roughness: .62, metalness: 0, color: 0xffffff, emissive: 0x000000, envMapIntensity: .6 });
    this.front = new THREE.Mesh(GEO.cardFront, this.frontMat);
    this.back = new THREE.Mesh(GEO.cardBack, MAT.back);
    this.front.castShadow = this.back.castShadow = true; this.front.receiveShadow = this.back.receiveShadow = true;
    this.flipG.add(this.front, this.back);
    this.glow = new THREE.Mesh(GEO.glow, MAT.glow); this.glow.visible = false; this.glow.position.y = -0.0025; this.glow.renderOrder = -1;
    this.tiltG.add(this.glow);
    this.st = { x: 0, y: 0, z: 0, yaw: 0, tilt: 0, flip: Math.PI, s: 1, lift: 0 };
    Object.assign(this.st, pose(slot, up));
    scene.add(this.g); liveCards.add(this); this.apply();
  }
  apply() {
    const s = this.st;
    this.g.position.set(s.x, s.y, s.z); this.g.rotation.set(0, s.yaw, 0); this.g.scale.setScalar(s.s);
    this.tiltG.rotation.x = s.tilt; this.tiltG.position.y = Math.sin(s.tilt) * CARD_H / 2 + (s.lift || 0) / s.s;
    this.flipG.rotation.z = s.flip;
  }
  setWin(on) { this.glow.visible = on; this.st.lift = on ? 0.012 : 0; this.frontMat.color.setScalar(1); this.apply(); }
  setDim(on) { this.frontMat.color.setScalar(on ? 0.45 : 1); }
  dispose() { scene.remove(this.g); this.frontMat.dispose(); liveCards.delete(this); }
}
function pose(slot, up) {
  const flip = up ? 0 : Math.PI;
  switch (slot.k) {
    case 'deck': return { x: A.deck.x, y: Math.max(0.03, A.deck.y + 0.01), z: A.deck.z, yaw: dealerP ? dealerP.root.rotation.y : 0, tilt: 0, flip: Math.PI, s: 0.9 };
    case 'board': { const b = A.board[slot.i]; return { x: b.x, y: 0.0012, z: b.z, yaw: slot.r || 0, tilt: 0, flip, s: BOARD_S }; }
    case 'muck': return { x: A.muck.x + slot.ox, y: 0.0012 + (slot.n || 0) * 0.0006, z: A.muck.z + slot.oz, yaw: slot.r, tilt: 0, flip: Math.PI, s: 0.9 };
    case 'hole': {
      const st = A.seats[slot.seat], k = slot.n - 0.5;
      if (slot.seat === 0) return { x: st.card.x + k * CARD_W * HERO_S * 0.62, y: 0.002 + slot.n * 0.003, z: st.card.z + slot.n * 0.002, yaw: -k * 0.1, tilt: HERO_TILT, flip, s: HERO_S };
      if (slot.rev) return { x: st.rev.x + k * CARD_W * REV_S * 1.05, y: 0.0015, z: st.rev.z, yaw: 0, tilt: 0, flip, s: REV_S };
      return { x: st.card.x + st.t.x * k * CARD_W * OPP_S * 0.62, y: 0.0015 + slot.n * 0.0012, z: st.card.z + st.t.z * k * CARD_W * OPP_S * 0.62, yaw: st.cardYaw - k * 0.22, tilt: 0, flip, s: OPP_S };
    }
  }
  return { x: 0, y: 0, z: 0, yaw: 0, tilt: 0, flip, s: 1 };
}
function placeNow(card) { Object.assign(card.st, pose(card.slot, card.up)); card.apply(); }
function moveCard(card, slot, o = {}) {
  const r = RUN;
  card.slot = slot; if (o.up != null) card.up = o.up;
  const a = { ...card.st }, b = pose(slot, card.up);
  const arc = o.arc ?? 0.04, spin = o.spin || 0, flipping = Math.abs(a.flip - b.flip) > 0.01;
  return animate(o.dur ?? 380, e => {
    const s = card.st;
    s.x = lerp(a.x, b.x, e); s.z = lerp(a.z, b.z, e); s.s = lerp(a.s, b.s, e); s.tilt = lerp(a.tilt, b.tilt, e);
    s.y = lerp(a.y, b.y, e) + Math.sin(e * Math.PI) * (arc + (flipping ? CARD_W * 0.55 * b.s : 0));
    s.yaw = lerpAngle(a.yaw, b.yaw, e) + spin * (1 - e) * (1 - e);
    s.flip = lerp(a.flip, b.flip, e);
    card.apply();
  }, o.ease || easeOut, o.delay || 0).then(() => { if (r !== RUN) throw ABORT; });
}
function clearCards() { for (const c of [...liveCards]) c.dispose(); S.boardCards = []; S.muckCards = []; S.players.forEach(p => p.cards = []); }

/* --- Chip piles (instanced) --- */
const MAXC = 700;
let chipMeshes = [];
const piles = new Map();
const flying = new Set();
let chipsDirty = true;
function breakdown(a, style) {
  a = Math.max(0, Math.round(a)); const out = [];
  if (a <= 0) return out;
  if (style === 'stack') {
    const avail = []; for (let k = 0; k < DEN.length; k++) if (DEN[k] <= Math.max(5, a / 5)) avail.push(k);
    let rem = a;
    for (let j = avail.length - 1; j >= 0; j--) {
      const k = avail[j], v = DEN[k]; let n = Math.floor(rem / v);
      if (j > 0 && n > 3) n -= Math.min(n - 3, Math.max(1, Math.round(n * 0.15)));
      if (n > 0) out.push([k, n]); rem -= n * v;
    }
    if (rem > 0) out.push([0, Math.ceil(rem / 5)]);
  } else {
    let rem = a;
    for (let k = DEN.length - 1; k >= 0; k--) { const n = Math.floor(rem / DEN[k]); if (n) { out.push([k, n]); rem -= n * DEN[k]; } }
    if (rem > 0) out.push([0, 1]);
  }
  return out;
}
const HEX = [[0, 0], [1, 0], [-1, 0], [.5, .87], [-.5, .87], [.5, -.87], [-.5, -.87], [2, 0], [-2, 0], [1.5, .87], [-1.5, .87], [1.5, -.87], [-1.5, -.87]];
function layoutPile(p) {
  const comp = breakdown(p.amount, p.style);
  const maxCol = p.style === 'stack' ? 12 : p.style === 'pot' ? 9 : 7;
  const cols = [];
  for (const [di, n] of comp) { let left = n; while (left > 0) { const k = Math.min(maxCol, left); cols.push([di, k]); left -= k; } }
  cols.splice(p.style === 'pot' ? 13 : 8);
  const D = CHIP_R * 2.08, n = cols.length, offs = [];
  if (p.style === 'stack') {
    const perRow = n > 5 ? Math.ceil(n / 2) : n;
    for (let k = 0; k < n; k++) { const row = Math.floor(k / perRow), col = k % perRow, inRow = row ? n - perRow : perRow;
      const u = (col - (inRow - 1) / 2) * D, v = row * D;
      offs.push({ x: p.t.x * u + p.d.x * v, z: p.t.z * u + p.d.z * v }); }
  } else {
    let cx = 0, cz = 0; for (let k = 0; k < n; k++) { cx += HEX[k][0]; cz += HEX[k][1]; } cx /= n || 1; cz /= n || 1;
    for (let k = 0; k < n; k++) offs.push({ x: (HEX[k][0] - cx) * D, z: (HEX[k][1] - cz) * D });
  }
  const seed = hashStr(p.key), jit = p.style === 'bet' ? 0.0028 : 0.0013;
  p.chips = [];
  cols.forEach(([di, k], ci) => {
    const o = offs[ci];
    for (let j = 0; j < k; j++) {
      const r1 = prand(seed + ci * 131 + j * 7), r2 = prand(seed + ci * 17 + j * 53 + 3), r3 = prand(seed + ci * 29 + j * 11 + 9);
      p.chips.push({ d: di, x: p.pos.x + o.x + (r1 - .5) * 2 * jit, y: CHIP_H / 2 + j * CHIP_H, z: p.pos.z + o.z + (r2 - .5) * 2 * jit, yaw: r3 * 6.28 });
    }
  });
  chipsDirty = true;
}
function pile(key) { return piles.get(key); }
function setPile(key, amount) { const p = piles.get(key); if (!p) return; amount = Math.max(0, Math.round(amount)); if (p.amount === amount && p.chips) return; p.amount = amount; layoutPile(p); }
function initPiles() {
  for (let i = 0; i < 6; i++) {
    for (const kind of ['stack', 'bet']) { const key = kind + i; if (!piles.has(key)) piles.set(key, { key, style: kind, amount: 0, chips: [], pos: new V3(), t: new V3(1, 0, 0), d: new V3(0, 0, -1) }); }
  }
  if (!piles.has('pot')) piles.set('pot', { key: 'pot', style: 'pot', amount: 0, chips: [], pos: new V3(), t: new V3(1, 0, 0), d: new V3(0, 0, -1) });
}
function positionPiles() {
  for (let i = 0; i < 6; i++) {
    const s = A.seats[i]; if (!s) continue;
    const ps = piles.get('stack' + i), pb = piles.get('bet' + i);
    ps.pos.copy(s.stack); ps.t.copy(s.t); ps.d.copy(s.d);
    pb.pos.copy(s.bet); pb.t.copy(s.t); pb.d.copy(s.d);
  }
  piles.get('pot').pos.copy(A.pot);
  for (const p of piles.values()) layoutPile(p);
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new V3(), _sc = new V3(1, 1, 1);
function renderChips() {
  const counts = [0, 0, 0, 0, 0, 0];
  const put = c => {
    const m = chipMeshes[c.d]; if (!m || counts[c.d] >= MAXC) return;
    _e.set(c.rx || 0, c.yaw, c.rz || 0); _q.setFromEuler(_e); _p.set(c.x, c.y, c.z); _m4.compose(_p, _q, _sc);
    m.setMatrixAt(counts[c.d]++, _m4);
  };
  for (const p of piles.values()) for (const c of p.chips) put(c);
  for (const c of flying) put(c);
  chipMeshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });
}
function flyChips(amount, from, to, o = {}) {
  if (amount <= 0) return Promise.resolve();
  const r = RUN, dur = o.dur ?? 420, arc = o.arc ?? 0.05;
  const comp = breakdown(amount, 'bet'), list = [];
  comp.forEach(([di, n]) => { for (let j = 0; j < Math.min(n, 6); j++) list.push(di); });
  list.splice(12);
  const chips = list.map((d, k) => ({ d, x: from.x + rand(-.012, .012), y: CHIP_H / 2 + k * CHIP_H, z: from.z + rand(-.012, .012), yaw: rand(0, 6.28), rx: 0, rz: 0 }));
  if (S.test || !G.ok) return Promise.resolve();
  chips.forEach(c => flying.add(c)); chipsDirty = true;
  const tasks = chips.map((c, k) => {
    const sx = c.x, sy = c.y, sz = c.z, ex = to.x + rand(-.02, .02), ez = to.z + rand(-.02, .02), ey = CHIP_H / 2 + k * CHIP_H * 0.6, ry = c.yaw, tilt = rand(-.5, .5);
    return animate(dur, e => {
      c.x = lerp(sx, ex, e); c.z = lerp(sz, ez, e); c.y = lerp(sy, ey, e) + Math.sin(e * Math.PI) * arc;
      c.yaw = ry + e * 2.5; c.rx = Math.sin(e * Math.PI) * tilt; chipsDirty = true;
    }, easeSlide, k * 16);
  });
  return Promise.all(tasks).then(() => { chips.forEach(c => flying.delete(c)); chipsDirty = true; if (r !== RUN) throw ABORT; });
}

/* --- Scene setup --- */
function initGL() {
  const canvas = $('#gl');
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return false; }
  if (!renderer.getContext()) return false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  G.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x05070a); scene.fog = new THREE.Fog(0x05070a, 3.4, 8.5);
  camera = new THREE.PerspectiveCamera(40, 1, 0.05, 40);
  try {
    const pmrem = new THREE.PMREMGenerator(renderer); const env = new RoomEnvironment();
    scene.environment = pmrem.fromScene(env, 0.04).texture; scene.environmentIntensity = 0.2;
    if (env.dispose) env.dispose(); pmrem.dispose();
  } catch (e) {}
  spot = new THREE.SpotLight(0xffe2bf, 34, 0, Math.PI / 4.1, 0.7, 2);
  spot.position.set(0, 2.55, 0.12); spot.target.position.set(0, 0, 0);
  const smallScreen = Math.min(screen.width || 9999, screen.height || 9999) < 700;
  spot.castShadow = true; spot.shadow.mapSize.set(smallScreen ? 1024 : 2048, smallScreen ? 1024 : 2048); spot.shadow.bias = -0.00025; spot.shadow.normalBias = 0.012;
  spot.shadow.camera.near = 1.2; spot.shadow.camera.far = 4.2; spot.shadow.radius = 3;
  scene.add(spot, spot.target);
  scene.add(new THREE.HemisphereLight(0xa9bcc8, 0x1a1110, 0.42));
  const fill = new THREE.DirectionalLight(0xd2ddff, 0.8); fill.position.set(0.5, 1.5, 3.4); scene.add(fill);

  TEX.feltBump = noiseTex(256, 60); TEX.leather = noiseTex(256, 40, 260); TEX.wood = woodTex(); TEX.carpet = carpetTex(); TEX.glow = glowTex();
  MAT.felt = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0, bumpMap: TEX.feltBump, bumpScale: 0.35 });
  TEX.leather.repeat.set(9, 9);
  MAT.rail = new THREE.MeshPhysicalMaterial({ color: 0x3d1711, roughness: 0.46, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.45, sheen: 0.5, sheenColor: new THREE.Color(0x7a3a2c), sheenRoughness: 0.6, bumpMap: TEX.leather, bumpScale: 0.6 });
  MAT.wood = new THREE.MeshPhysicalMaterial({ map: TEX.wood, roughness: 0.32, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.18 });
  MAT.brass = new THREE.MeshStandardMaterial({ color: 0xd2a756, metalness: 1, roughness: 0.3 });
  MAT.apron = new THREE.MeshStandardMaterial({ color: 0x150b08, roughness: 0.55, metalness: 0 });
  MAT.floor = new THREE.MeshStandardMaterial({ map: TEX.carpet, roughness: 0.96, metalness: 0 });
  MAT.glow = new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xffc860, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), MAT.floor); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.78; floor.receiveShadow = true; scene.add(floor);

  // Cards
  GEO.cardFront = new THREE.ShapeGeometry(roundedRectShape(CARD_W, CARD_H, CARD_R), 5); boxUV(GEO.cardFront, CARD_W, CARD_H); GEO.cardFront.rotateX(-Math.PI / 2); GEO.cardFront.translate(0, 0.0003, 0);
  GEO.cardBack = new THREE.ShapeGeometry(roundedRectShape(CARD_W, CARD_H, CARD_R), 5); boxUV(GEO.cardBack, CARD_W, CARD_H); GEO.cardBack.rotateX(Math.PI / 2); GEO.cardBack.translate(0, -0.0003, 0);
  GEO.glow = new THREE.PlaneGeometry(CARD_W * 1.32, CARD_H * 1.24); GEO.glow.rotateX(-Math.PI / 2);
  TEX.back = canvasTex(drawBack());
  MAT.back = new THREE.MeshStandardMaterial({ map: TEX.back, roughness: .55, metalness: 0, envMapIntensity: .7 });

  // Chips
  const chipGeo = new THREE.CylinderGeometry(CHIP_R, CHIP_R, CHIP_H, 40, 1, false);
  chipMeshes = DEN.map((_, di) => {
    const side = new THREE.MeshStandardMaterial({ map: chipEdge(di), roughness: .55, metalness: 0 });
    const top = new THREE.MeshStandardMaterial({ map: chipFace(di), roughness: .5, metalness: 0 });
    const m = new THREE.InstancedMesh(chipGeo, [side, top, top], MAXC);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0;
    scene.add(m); return m;
  });

  // Dealer puck & deck
  const puckGeo = new THREE.CylinderGeometry(0.046, 0.046, 0.016, 44);
  const puckSide = new THREE.MeshStandardMaterial({ color: 0xf1ece0, roughness: .35 });
  MAT.puckTop = new THREE.MeshStandardMaterial({ map: puckFace(), roughness: .35 });
  dealerPuck = new THREE.Mesh(puckGeo, [puckSide, MAT.puckTop, puckSide]); dealerPuck.castShadow = true; dealerPuck.receiveShadow = true;
  dealerPuck.position.y = 0.008; scene.add(dealerPuck);
  const edge = new THREE.MeshStandardMaterial({ map: paperEdge(), roughness: .7 });
  deckMesh = new THREE.Mesh(new THREE.BoxGeometry(CARD_W * 0.9, 0.022, CARD_H * 0.9), [edge, edge, MAT.back, edge, edge, edge]);
  deckMesh.castShadow = true; deckMesh.receiveShadow = true; deckMesh.position.y = 0.011; scene.add(deckMesh);

  initPiles();
  initPeopleGeo();
  dealerP = new Person('dealer', 7, true); scene.add(dealerP.root);
  Bar.init();
  G.ok = true;
  return true;
}
function disposeGroup(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); scene.remove(g); }
function buildTable() {
  if (tableGroup) disposeGroup(tableGroup);
  tableGroup = new THREE.Group(); scene.add(tableGroup);
  const { W, D } = G.table, railW = G.railW || 0.15, trackW = G.trackW || 0.045;
  const inW = W - 2 * railW, inD = D - 2 * railW, fW = inW - 2 * trackW, fD = inD - 2 * trackW;
  G.felt = { W: fW, D: fD, inW, inD };
  const curve = 72;
  const fg = new THREE.ShapeGeometry(stadiumShape(fW, fD), curve); boxUV(fg, fW, fD); fg.rotateX(-Math.PI / 2);
  if (MAT.felt.map) MAT.felt.map.dispose();
  MAT.felt.map = feltTexture(); MAT.felt.needsUpdate = true;
  TEX.feltBump.repeat.set(fW / 0.035, fD / 0.035);
  const felt = new THREE.Mesh(fg, MAT.felt); felt.receiveShadow = true; tableGroup.add(felt);

  const ts = stadiumShape(inW, inD); ts.holes.push(stadiumShape(fW, fD, new THREE.Path()));
  const tg = new THREE.ExtrudeGeometry(ts, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: curve }); tg.rotateX(-Math.PI / 2);
  const track = new THREE.Mesh(tg, MAT.wood); track.receiveShadow = true; tableGroup.add(track);

  const bs = stadiumShape(fW + 0.016, fD + 0.016); bs.holes.push(stadiumShape(fW, fD, new THREE.Path()));
  const bgm = new THREE.ExtrudeGeometry(bs, { depth: 0.0135, bevelEnabled: false, curveSegments: curve }); bgm.rotateX(-Math.PI / 2);
  tableGroup.add(new THREE.Mesh(bgm, MAT.brass));

  const b = 0.05, rs = stadiumShape(W - 2 * b, D - 2 * b); rs.holes.push(stadiumShape(inW + 2 * b, inD + 2 * b, new THREE.Path()));
  const rg = new THREE.ExtrudeGeometry(rs, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.04, bevelSize: b, bevelSegments: 10, curveSegments: curve }); rg.rotateX(-Math.PI / 2);
  const rail = new THREE.Mesh(rg, MAT.rail); rail.position.y = 0.03; rail.castShadow = true; rail.receiveShadow = true; tableGroup.add(rail);

  const ag = new THREE.ExtrudeGeometry(stadiumShape(W - 0.06, D - 0.06), { depth: 0.2, bevelEnabled: false, curveSegments: 48 }); ag.rotateX(-Math.PI / 2);
  const apron = new THREE.Mesh(ag, MAT.apron); apron.position.y = -0.215; apron.castShadow = true; tableGroup.add(apron);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 0.56, 32), MAT.apron); ped.position.y = -0.5; tableGroup.add(ped);
}

/* --- Anchors: every 3D spot the game uses, computed per orientation --- */
function computeAnchors() {
  const { W, D } = G.table, fW = G.felt.W, fD = G.felt.D, P = G.portrait;
  const angs = P ? [90, 118, 242, 298, 62] : [90, 152, 208, 332, 28];
  BOARD_S = P ? 1.24 : 1.14; HERO_S = P ? 1.42 : 1.18; HERO_TILT = P ? 0.5 : 0.32;
  const boardZ = P ? -0.04 : 0.02; A.boardZ = boardZ;
  A.board = [0, 1, 2, 3, 4].map(k => new V3((k - 2) * (CARD_W * BOARD_S + 0.012), 0, boardZ));
  const potZ = boardZ - CARD_H * BOARD_S / 2 - (P ? 0.15 : 0.075);
  A.pot.set(0, 0, potZ);
  // The dealer sits across from you; the deck and the muck rest in front of the dealer
  const dOut = stadiumEdge(270, W, D), dInn = stadiumEdge(270, fW, fD);
  A.dealerBody = new V3(dOut.x, 0, dOut.z - 0.3);
  A.dealerHead = new V3(dOut.x, 0.62, dOut.z - 0.3);
  A.tipSpot = new V3(0.02, 0, dInn.z + 0.09);
  A.deckRest = new V3(-0.17, 0, dInn.z + 0.16); A.muck.set(0.18, 0, dInn.z + 0.16);
  A.deck.copy(A.deckRest);
  A.banner.set(0, 0.06, boardZ - CARD_H * BOARD_S * 0.1);
  A.seats.length = 0;
  for (let i = 0; i < NS; i++) {
    const a = angs[i], ar = a * Math.PI / 180;
    let dir = { x: Math.cos(ar), z: Math.sin(ar) }, out = stadiumEdge(a, W, D), inn = stadiumEdge(a, fW, fD);
    if (P && i > 0) {
      // Portrait: two players down each long side, evenly spaced, well clear of you and the dealer
      const side = (i === 1 || i === 2) ? -1 : 1, zf = (i === 1 || i === 4) ? 0.205 : -0.205;
      const e = stadiumSide(side, zf * D, W, D), rail = (W - fW) / 2;
      dir = { x: e.nx, z: e.nz }; out = { x: e.x, z: e.z }; inn = { x: e.x - e.nx * rail, z: e.z - e.nz * rail };
    }
    const d = new V3(-dir.x, 0, -dir.z), t = new V3(-d.z, 0, d.x);
    const at = (base, dd, tt, y = 0) => new V3(base.x + d.x * dd + t.x * tt, y, base.z + d.z * dd + t.z * tt);
    const rInn = Math.hypot(inn.x, inn.z);
    const s = { d, t, cardYaw: Math.atan2(dir.x, dir.z) };
    if (i === 0) {
      s.pos = new V3(out.x + dir.x * 0.045, 0.1, out.z + dir.z * 0.045);
      const hh = CARD_H * HERO_S * Math.cos(HERO_TILT);
      s.card = at(inn, 0.035 + hh / 2, 0);
      s.stack = at(inn, 0.085, P ? 0.36 : 0.4); s.dealer = at(inn, 0.08, P ? -0.36 : -0.5);
      s.drink = P ? at(inn, 0.05, -0.245) : at(inn, 0.05, 0.62);
      s.bet = P ? at(inn, 0.035 + hh + 0.09, 0) : at(inn, 0.13, -0.27);
      s.rev = s.card;
      A.heroCardTop = at(inn, 0.035 + hh, 0, Math.sin(HERO_TILT) * CARD_H * HERO_S);
    } else {
      s.pos = new V3(out.x - dir.x * 0.07, 0.1, out.z - dir.z * 0.07);
      const bo = P ? 0.2 : 0.3;
      s.body = new V3(out.x + dir.x * bo, 0, out.z + dir.z * bo);
      s.face = new V3(s.body.x - dir.x, 0, s.body.z - dir.z);
      s.headTop = new V3(s.body.x, 0.66, s.body.z);
      s.card = at(inn, 0.06 + CARD_H * OPP_S / 2, 0);
      s.rev = at(inn, 0.06 + CARD_H * REV_S / 2, 0);
      if (P) { const sg = Math.sign(t.z * out.z) || 1; s.stack = at(inn, 0.075, 0.2 * sg); s.dealer = at(inn, 0.09, -0.14 * sg); s.drink = at(inn, 0.05, -0.26 * sg); } // chips toward the near end, clear of the board
      else { s.stack = at(inn, 0.075, 0.22); s.dealer = at(inn, 0.09, -0.22); s.drink = at(inn, 0.06, -0.36); }
      s.bet = at(inn, P ? 0.3 : Math.min(0.36, rInn * 0.5), 0);
    }
    A.seats[i] = s;
  }
  const heroBet = A.seats[0].bet;
  A.logoZ = P ? (boardZ + CARD_H * BOARD_S / 2 + heroBet.z) / 2 : boardZ;
  if (deckMesh) deckMesh.position.set(A.deck.x, 0.011, A.deck.z);
}

/* --- Camera fitting: binary search distance, then lens-shift to center --- */
const CAM = { blend: 0, focus: 0, base: null, sway: !reducedMotion };
const _v = new V3();
function camParams() {
  const P = G.portrait, b = CAM.blend;
  const seated = { pitch: (P ? 60 : 43) * Math.PI / 180, fov: P ? 40 : 34, tz: P ? 0.1 : 0.06 };
  const over = { pitch: (P ? 82 : 74) * Math.PI / 180, fov: P ? 40 : 34, tz: 0 };
  return { pitch: lerp(seated.pitch, over.pitch, b), fov: lerp(seated.fov, over.fov, b), tz: lerp(seated.tz, over.tz, b) };
}
function fitPoints() {
  const pts = [], { W, D } = G.table;
  for (let k = 0; k < 36; k++) { const e = stadiumEdge(k * 10, W, D); pts.push({ v: new V3(e.x, 0.09, e.z), l: 2, r: 2, t: 2, b: 2 }); }
  const pw = G.plateW;
  for (let i = 1; i < NS; i++) {
    pts.push({ v: A.seats[i].pos, l: pw / 2 + 4, r: pw / 2 + 4, t: 18, b: 22 });
    if (G.portrait) pts.push({ v: A.seats[i].headTop, l: 8, r: 8, t: 0, b: 0 }); // side players stay on screen
    else pts.push({ v: A.seats[i].headTop, l: 30, r: 30, t: 26, b: 0 }); // landscape: everyone fully in frame
  }
  if (A.dealerHead) pts.push({ v: A.dealerHead, l: 34, r: 34, t: 10, b: 0 });
  pts.push({ v: A.seats[0].pos, l: 70, r: 70, t: 4, b: 26 });
  if (A.heroCardTop) pts.push({ v: A.heroCardTop, l: 4, r: 4, t: 6, b: 0 });
  return pts;
}
function measure(dist, dir, target, pts) {
  camera.position.copy(target).addScaledVector(dir, dist); camera.lookAt(target); camera.updateMatrixWorld();
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (const p of pts) {
    _v.copy(p.v).project(camera); if (_v.z > 1 || _v.z < -1) return null;
    const sx = (_v.x + 1) / 2 * G.W, sy = (1 - _v.y) / 2 * G.H;
    minx = Math.min(minx, sx - p.l); maxx = Math.max(maxx, sx + p.r); miny = Math.min(miny, sy - p.t); maxy = Math.max(maxy, sy + p.b);
  }
  return { minx, maxx, miny, maxy };
}
function fitCamera() {
  if (!G.ok) return;
  const { pitch, fov, tz } = camParams();
  camera.fov = fov; camera.aspect = G.W / G.H; camera.clearViewOffset(); camera.updateProjectionMatrix();
  const dir = new V3(0, Math.sin(pitch), Math.cos(pitch)), target = new V3(0, 0, tz), pts = fitPoints();
  const availW = G.W - 8, availH = G.H - 8;
  let lo = 0.6, hi = 14;
  for (let k = 0; k < 26; k++) {
    const mid = (lo + hi) / 2, m = measure(mid, dir, target, pts);
    if (m && m.maxx - m.minx <= availW && m.maxy - m.miny <= availH) hi = mid; else lo = mid;
  }
  const m = measure(hi, dir, target, pts) || { minx: 0, maxx: G.W, miny: 0, maxy: G.H };
  const dx = G.W / 2 - (m.minx + m.maxx) / 2, dy = G.H / 2 - (m.miny + m.maxy) / 2;
  camera.setViewOffset(G.W, G.H, -dx, -dy, G.W, G.H);
  CAM.base = { dist: hi, dir, target: target.clone() };
  updateEdgeClasses();
}
function updateCamera(now) {
  if (!CAM.base) return;
  const { dist, dir, target } = CAM.base, f = CAM.focus;
  const tgt = _tgt.copy(target).lerp(_board.set(0, 0, A.boardZ), f * 0.45);
  camera.position.copy(tgt).addScaledVector(dir, dist * (1 - 0.13 * f));
  if (CAM.sway) { const t = now / 1000; camera.position.x += Math.sin(t * 0.31) * 0.008; camera.position.y += Math.sin(t * 0.23) * 0.004; }
  camera.lookAt(tgt); camera.updateMatrixWorld();
}
const _tgt = new V3(), _board = new V3();
function focusCamera(on) { if (reducedMotion) return; const a = CAM.focus, b = on ? 1 : 0; bg(animate(900, e => { CAM.focus = lerp(a, b, e); }, easeInOut)); }

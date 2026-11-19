'use strict';
/* Velvet Hold'em: 18c-places.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Places: 3D interiors you step into from the city (bank hall, card club lounge,
   casino floor, jail cell block). The menu floats over the room. Drawn by the city's
   renderer and bloom (City.renderer / City.composer); each interior is built on first visit.
   Units are metres: floor at y = -0.78, table tops near y = 0, seated people at y = 0.
   ========================================================= */
const FLOOR_Y = -0.78, STAND_Y = FLOOR_Y + 1.2; // a standing figure's root sits 1.2 m above its feet
const Places = {
  cur: null, built: {},

  /* ---------- shared helpers ---------- */
  tex(w, h, draw, srgb = true, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  },
  glow() { return this._glow || (this._glow = this.tex(128, 128, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); })); },
  std(o) { return new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0 }, o)); },
  box(w, h, d, mat, parent, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; },
  cyl(rt, rb, h, mat, parent, x = 0, y = 0, z = 0, seg = 20) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); parent.add(m); return m; },
  neon(text, color, { font = 'Limelight', size = 120, w = 1024, h = 256, plain = false } = {}) {
    return this.tex(w, h, (x) => {
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `${size}px ${font}`; x.lineJoin = 'round';
      if (plain) { x.fillStyle = color; x.fillText(text, w / 2, h / 2 + 6); return; }
      x.shadowColor = color; x.shadowBlur = 26; x.strokeStyle = color; x.lineWidth = size * 0.07; x.strokeText(text, w / 2, h / 2 + 6);
      x.shadowBlur = 0; x.globalAlpha = 0.18; x.fillStyle = color; x.fillText(text, w / 2, h / 2 + 6);
      x.globalAlpha = 0.55; x.strokeStyle = '#fff4ec'; x.lineWidth = size * 0.022; x.strokeText(text, w / 2, h / 2 + 6);
    });
  },
  sign(tex, w, h, parent, x, y, z, k = 1.6, ry = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(k, k, k) })); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; },
  halo(parent, x, y, z, color, size, op = 0.5) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow(), color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(x, y, z); s.scale.setScalar(size); parent.add(s); return s; },
  floorPool(parent, x, z, color, size, op = 0.4) { const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: this.glow(), color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, FLOOR_Y + 0.01, z); parent.add(m); return m; },
  // a room: floor, three walls and a ceiling around the origin, open toward the camera (+z)
  room(scene, w, d, h, floorMat, wallMat, ceilMat) {
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat); fl.rotation.x = -Math.PI / 2; fl.position.set(0, FLOOR_Y, 0); scene.add(fl);
    const ce = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat); ce.rotation.x = Math.PI / 2; ce.position.set(0, FLOOR_Y + h, 0); scene.add(ce);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat); back.position.set(0, FLOOR_Y + h / 2, -d / 2); scene.add(back);
    for (const s of [-1, 1]) { const wl = new THREE.Mesh(new THREE.PlaneGeometry(d, h), wallMat); wl.rotation.y = -s * Math.PI / 2; wl.position.set(s * w / 2, FLOOR_Y + h / 2, 0); scene.add(wl); }
  },
  person(scene, look, seed, x, z, faceX, faceZ, standing = false, scale = 1) {
    const p = new Person(look, seed, false); p.root.scale.setScalar(scale);
    p.root.position.set(x, standing ? FLOOR_Y + 1.2 * scale : 0, z); p.root.lookAt(faceX, p.root.position.y, faceZ); scene.add(p.root);
    return p;
  },
  base(fog, bg) {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(bg); scene.fog = new THREE.Fog(fog, 14, 42);
    scene.environment = City.scene.environment; scene.environmentIntensity = 0.35;
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
    return { scene, camera, people: [], tick: [] };
  },

  /* ---------- Velvet Bank: marble hall, teller windows, a vault door, chandeliers ---------- */
  bank() {
    const P = this.base(0x14100a, 0x0c0906), { scene } = P;
    const marble = this.tex(1024, 1024, (x, w, h) => {
      const n = 8, c = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 ? '#e9e2d2' : '#24342e'; x.fillRect(i * c, j * c, c, c); }
      x.globalAlpha = 0.22; for (let k = 0; k < 140; k++) { x.strokeStyle = Math.random() < 0.5 ? '#8a8272' : '#ffffff'; x.lineWidth = Math.random() * 2 + 0.5; x.beginPath(); let px = Math.random() * w, py = Math.random() * h; x.moveTo(px, py); for (let s = 0; s < 6; s++) { px += (Math.random() - 0.5) * 120; py += Math.random() * 60; x.lineTo(px, py); } x.stroke(); }
      x.globalAlpha = 1; x.strokeStyle = 'rgba(20,16,10,.5)'; x.lineWidth = 2; for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * c, 0); x.lineTo(i * c, h); x.stroke(); x.beginPath(); x.moveTo(0, i * c); x.lineTo(w, i * c); x.stroke(); }
    }, true, [3, 3]);
    const wall = this.tex(512, 512, (x, w, h) => { x.fillStyle = '#3a2a1c'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a1e14'; x.fillRect(0, h * 0.62, w, h * 0.38); x.fillStyle = '#b08a4a'; x.fillRect(0, h * 0.6, w, 6); for (let i = 0; i < 4; i++) { x.strokeStyle = 'rgba(176,138,74,.5)'; x.lineWidth = 3; x.strokeRect(i * w / 4 + 16, h * 0.66, w / 4 - 32, h * 0.28); } }, true, [4, 1]);
    this.room(scene, 18, 16, 6.5, this.std({ map: marble, roughness: 0.12, metalness: 0.05, envMapIntensity: 1.4 }), this.std({ map: wall, roughness: 0.8 }), this.std({ color: 0x1c140c, roughness: 0.9 }));
    const stone = this.std({ color: 0xb8ad94, roughness: 0.5 }), brass = this.std({ color: 0xc9a24f, metalness: 0.9, roughness: 0.3 }), wood = this.std({ color: 0x3b2414, roughness: 0.5 });
    for (const x of [-6.5, -3.4, 3.4, 6.5]) for (const z of [-2.2]) { this.cyl(0.42, 0.48, 6.5, stone, scene, x, FLOOR_Y + 3.25, z, 24); this.box(1.2, 0.3, 1.2, stone, scene, x, FLOOR_Y + 0.15, z); this.box(1.1, 0.3, 1.1, stone, scene, x, FLOOR_Y + 6.35, z); }
    // teller counter with brass grilles and glass
    this.box(10, 1.15, 0.9, wood, scene, 0, FLOOR_Y + 0.58, -4.6); this.box(10.2, 0.08, 1.05, this.std({ color: 0xd8cdb2, roughness: 0.25 }), scene, 0, FLOOR_Y + 1.19, -4.6);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfd8e8, roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.25, metalness: 0 });
    for (let k = 0; k < 3; k++) {
      const x = -3.2 + k * 3.2;
      this.box(2.4, 1.3, 0.04, glass, scene, x, FLOOR_Y + 1.9, -4.62);
      for (let b = 0; b < 9; b++) this.cyl(0.012, 0.012, 1.3, brass, scene, x - 1.1 + b * 0.275, FLOOR_Y + 1.9, -4.58, 6);
      this.box(2.6, 0.12, 0.12, brass, scene, x, FLOOR_Y + 2.6, -4.6);
      this.sign(this.neon(`WINDOW ${k + 1}`, '#c9a24f', { font: 'Barlow Condensed', size: 90, plain: true }), 1.1, 0.28, scene, x, FLOOR_Y + 2.82, -4.55, 1);
    }
    this.box(10, 3.2, 0.2, wood, scene, 0, FLOOR_Y + 4.3, -4.7);
    this.sign(this.neon('VELVET BANK', '#d9b25a', { size: 120, plain: true }), 6, 1.5, scene, 0, FLOOR_Y + 4.4, -4.58, 1.3);
    P.people.push(this.person(scene, 'croupier', 12, 0, -5.4, 0, 0, true));
    P.people.push(this.person(scene, 'croupierF', 23, -3.2, -5.4, -3.2, 0, true));
    // the vault door on the back wall
    const vault = new THREE.Group(); vault.position.set(5.2, FLOOR_Y + 2.2, -7.85); scene.add(vault);
    const steel = this.std({ color: 0x9aa0a8, metalness: 0.95, roughness: 0.28 });
    const disc = this.cyl(1.7, 1.7, 0.35, steel, vault, 0, 0, 0, 48); disc.rotation.x = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.12, 12, 48), brass); vault.add(ring);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, b = this.cyl(0.07, 0.07, 0.25, steel, vault, Math.cos(a) * 1.45, Math.sin(a) * 1.45, 0.2, 10); b.rotation.x = Math.PI / 2; }
    const wheel = new THREE.Group(); wheel.position.z = 0.3; vault.add(wheel);
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 32), brass));
    for (let k = 0; k < 3; k++) { const s = this.box(1.0, 0.06, 0.06, brass, wheel); s.rotation.z = k * Math.PI / 3; }
    P.tick.push((dt, t) => { wheel.rotation.z = Math.sin(t * 0.3) * 0.4; });
    // chandeliers
    for (const x of [-4.5, 0, 4.5]) {
      const g = new THREE.Group(); g.position.set(x, FLOOR_Y + 5.2, -1.2); scene.add(g);
      this.cyl(0.02, 0.02, 1.2, brass, g, 0, 0.6, 0, 6);
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 8, 32), brass); hoop.rotation.x = Math.PI / 2; g.add(hoop);
      const bulb = this.std({ color: 0xfff0d0, emissive: 0xffd28a, emissiveIntensity: 5 });
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; this.cyl(0.03, 0.03, 0.18, this.std({ color: 0xf2ead8 }), g, Math.cos(a) * 0.7, 0.1, Math.sin(a) * 0.7, 8); const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bulb); b.position.set(Math.cos(a) * 0.7, 0.24, Math.sin(a) * 0.7); g.add(b); }
      this.halo(g, 0, 0.2, 0, 0xffd28a, 3.2, 0.5);
      const l = new THREE.PointLight(0xffd8a0, 10, 11, 1.7); l.position.set(0, -0.2, 0); g.add(l);
      this.floorPool(scene, x, -1.2, 0xffd8a0, 6, 0.2);
    }
    scene.add(new THREE.HemisphereLight(0xffe6c0, 0x2a1c10, 0.3));
    P.view = { pos: [-0.6, 0.85, 3.6], look: [0.8, 0.95, -4.6], sway: 0.5 };
    return P;
  },

  /* ---------- Riverside Card Club: wood panels, poker tables, pendant lamps, a bar ---------- */
  club() {
    const P = this.base(0x0d0806, 0x070504), { scene } = P;
    const carpet = this.tex(512, 512, (x, w, h) => { x.fillStyle = '#3a0e14'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(201,162,79,.35)'; x.lineWidth = 3; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const cx = i * 64 + 32, cy = j * 64 + 32; x.beginPath(); x.moveTo(cx, cy - 20); x.lineTo(cx + 20, cy); x.lineTo(cx, cy + 20); x.lineTo(cx - 20, cy); x.closePath(); x.stroke(); } for (let k = 0; k < 4000; k++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, true, [6, 6]);
    const panel = this.tex(512, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, i % 2 ? '#4a2a16' : '#3a2010'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 4; for (let i = 0; i < 4; i++) x.strokeRect(i * w / 4 + 14, 30, w / 4 - 28, h * 0.5); x.fillStyle = '#2a170b'; x.fillRect(0, h * 0.62, w, h * 0.38); x.fillStyle = '#8a6630'; x.fillRect(0, h * 0.6, w, 5); }, true, [5, 1]);
    this.room(scene, 20, 16, 4.2, this.std({ map: carpet, roughness: 0.95 }), this.std({ map: panel, roughness: 0.55 }), this.std({ color: 0x120c08, roughness: 0.9 }));
    const felt = this.std({ color: 0x0f5a50, roughness: 0.9 }), rail = this.std({ color: 0x2a0f0b, roughness: 0.45 }), wood = this.std({ color: 0x2c180c, roughness: 0.5 }), brass = this.std({ color: 0xc9a24f, metalness: 0.9, roughness: 0.3 });
    const personas = ['rock', 'shark', 'maniac', 'station', 'pro'];
    const tables = [[-3.6, -1.2], [3.6, -2.2]];
    tables.forEach(([tx, tz], ti) => {
      const g = new THREE.Group(); g.position.set(tx, 0, tz); scene.add(g);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.06, 40), felt); top.scale.set(1.5, 1, 1); top.position.y = 0.02; g.add(top);
      const rl = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.09, 10, 48), rail); rl.rotation.x = Math.PI / 2; rl.scale.set(1.5, 1, 1); rl.position.y = 0.07; g.add(rl);
      this.cyl(0.25, 0.4, 0.78, wood, g, 0, FLOOR_Y + 0.39, 0);
      // chips and cards on the felt
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3; this.cyl(0.03, 0.03, 0.04 + Math.random() * 0.06, this.std({ color: [0xb81e2e, 0x1e5bb8, 0x161616, 0x2e8b4e][k % 4], roughness: 0.4 }), g, Math.cos(a) * 1.3, 0.09, Math.sin(a) * 0.82, 16); }
      for (let k = 0; k < 3; k++) this.box(0.09, 0.004, 0.13, this.std({ color: 0xf4f0e6, roughness: 0.4 }), g, -0.15 + k * 0.15, 0.06, 0);
      // seated players around it
      [0.9, 2.3, 3.9].forEach((a, k) => { const px = tx + Math.cos(a) * 2.25, pz = tz + Math.sin(a) * 1.55 * -1; P.people.push(this.person(scene, personas[(ti * 3 + k) % 5], 300 + ti * 17 + k * 5, px, pz, tx, tz)); });
      // pendant lamp
      const lamp = new THREE.Group(); lamp.position.set(tx, FLOOR_Y + 3.1, tz); scene.add(lamp);
      this.cyl(0.01, 0.01, 1.1, brass, lamp, 0, 0.55, 0, 6);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.75, 0.38, 32, 1, true), this.std({ color: 0x0f3a2c, roughness: 0.4, side: THREE.DoubleSide })); lamp.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), this.std({ color: 0xfff0d0, emissive: 0xffd08a, emissiveIntensity: 6 })); bulb.position.y = -0.05; lamp.add(bulb);
      const s = new THREE.SpotLight(0xffd8a0, 60, 6, 0.75, 0.55, 1.4); s.position.set(0, -0.1, 0); s.target.position.set(0, -2, 0); lamp.add(s, s.target);
    });
    // the bar along the back wall, bottles lit from behind
    this.box(7, 1.1, 0.8, wood, scene, -2, FLOOR_Y + 0.55, -6.9); this.box(7.2, 0.06, 0.95, this.std({ color: 0x1a0f08, roughness: 0.2, metalness: 0.2 }), scene, -2, FLOOR_Y + 1.13, -6.9);
    this.box(7, 1.8, 0.05, this.std({ color: 0x1a0c06, emissive: 0x9a4a18, emissiveIntensity: 0.28 }), scene, -2, FLOOR_Y + 2.4, -7.95);
    const bottleCols = [0x2a6a3a, 0x7a3a10, 0xd8c8a0, 0x3a2a6a, 0x8a1a1a, 0xc9a24f];
    for (const y of [1.75, 2.45]) for (let k = 0; k < 22; k++) { const b = this.cyl(0.05, 0.06, 0.32, new THREE.MeshPhysicalMaterial({ color: bottleCols[k % 6], roughness: 0.1, transmission: 0.3, transparent: true, opacity: 0.85 }), scene, -5.2 + k * 0.3, FLOOR_Y + y, -7.8, 10); b.scale.y = 0.8 + (k % 3) * 0.15; }
    for (const y of [1.55, 2.25]) this.box(6.8, 0.04, 0.3, wood, scene, -2, FLOOR_Y + y, -7.8);
    P.people.push(this.person(scene, 'waitress', 31, -2, -7.35, -2, 0, true, 0.95));
    this.sign(this.neon('CARD CLUB', '#2fe6cf', { size: 130 }), 4.2, 1.05, scene, 4.5, FLOOR_Y + 2.9, -7.9, 1.8);
    this.halo(scene, 4.5, FLOOR_Y + 2.9, -7.7, 0x2fe6cf, 5, 0.25);
    // wall sconces
    for (const x of [-8.5, 8.5]) for (const z of [-4, 2]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), this.std({ color: 0xfff0d0, emissive: 0xffc070, emissiveIntensity: 4 })); s.position.set(x * 1.17, FLOOR_Y + 2.4, z); scene.add(s); this.halo(scene, x * 1.17, FLOOR_Y + 2.4, z, 0xffc070, 1.6, 0.4); }
    scene.add(new THREE.HemisphereLight(0xffd8b0, 0x1a0c08, 0.32));
    const bl = new THREE.PointLight(0xffa860, 14, 8, 1.6); bl.position.set(-2, FLOOR_Y + 2.4, -6.8); scene.add(bl);
    P.view = { pos: [-0.3, 1.25, 6.4], look: [0, 0.25, -2.4], sway: 0.7 };
    return P;
  },

  /* ---------- The Golden Strip: slot machines, roulette and blackjack, neon ---------- */
  casino() {
    const P = this.base(0x12060a, 0x080305), { scene } = P;
    const carpet = this.tex(512, 512, (x, w, h) => { x.fillStyle = '#4a0a18'; x.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { const cx = i * 85 + 42, cy = j * 85 + 42; x.strokeStyle = 'rgba(232,180,80,.5)'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, 24, 0, Math.PI * 2); x.stroke(); x.strokeStyle = 'rgba(40,160,150,.45)'; x.beginPath(); x.arc(cx, cy, 12, 0, Math.PI * 2); x.stroke(); x.fillStyle = 'rgba(232,180,80,.4)'; x.fillRect(cx - 2, cy - 38, 4, 76); x.fillRect(cx - 38, cy - 2, 76, 4); } }, true, [7, 7]);
    const wall = this.tex(512, 512, (x, w, h) => { x.fillStyle = '#1a0a10'; x.fillRect(0, 0, w, h); x.fillStyle = '#c9a24f'; for (let i = 0; i < 8; i++) x.fillRect(i * w / 8, 0, 3, h); x.fillStyle = 'rgba(201,162,79,.25)'; x.fillRect(0, h * 0.7, w, 4); }, true, [6, 1]);
    this.room(scene, 24, 18, 5, this.std({ map: carpet, roughness: 0.95 }), this.std({ map: wall, roughness: 0.6 }), this.std({ color: 0x14070b, roughness: 0.9 }));
    const gold = this.std({ color: 0xd9b25a, metalness: 0.95, roughness: 0.25 }), felt = this.std({ color: 0x0f5a3a, roughness: 0.9 }), wood = this.std({ color: 0x3a1a0c, roughness: 0.45 });
    // slot machine rows: screens and reels glow and spin
    const reelTex = this.tex(128, 512, (x, w, h) => { x.fillStyle = '#f6efe0'; x.fillRect(0, 0, w, h); const sy = ['7', 'BAR', '$', '7', 'BAR', '$', '7', '♣']; x.textAlign = 'center'; x.textBaseline = 'middle'; sy.forEach((s, i) => { x.fillStyle = ['#c81e2e', '#1a1a1a', '#1e8a3a', '#c81e2e'][i % 4]; x.font = `700 ${s.length > 1 ? 40 : 64}px Barlow Condensed`; x.fillText(s, w / 2, 32 + i * 64); }); });
    reelTex.wrapT = THREE.RepeatWrapping; reelTex.repeat.set(1, 0.38);
    const slots = [];
    for (const side of [-1, 1]) for (let k = 0; k < 6; k++) {
      const g = new THREE.Group(); g.position.set(side * 10.6, 0, -6 + k * 1.5); g.rotation.y = -side * Math.PI / 2; scene.add(g);
      this.box(1.1, 1.5, 0.8, this.std({ color: [0x7a1020, 0x1a2a6a, 0x5a1a6a][k % 3], roughness: 0.35, metalness: 0.4 }), g, 0, FLOOR_Y + 0.75, 0);
      this.box(1.1, 0.7, 0.6, this.std({ color: 0x14141a, roughness: 0.3 }), g, 0, FLOOR_Y + 1.85, -0.1);
      const top = this.box(1.12, 0.3, 0.82, this.std({ color: 0xffc860, emissive: [0xff3a50, 0x3a7aff, 0xd84aff][k % 3], emissiveIntensity: 2.4 }), g, 0, FLOOR_Y + 2.35, 0);
      for (let r = 0; r < 3; r++) { const t = reelTex.clone(); t.needsUpdate = true; t.offset.y = Math.random(); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.42), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); m.position.set(-0.3 + r * 0.3, FLOOR_Y + 1.85, 0.21); g.add(m); slots.push({ t, sp: 0, stop: 0 }); }
      slots.push({ light: top.material, ph: Math.random() * 6 });
      this.box(0.9, 0.05, 0.3, gold, g, 0, FLOOR_Y + 1.25, 0.45);
    }
    P.tick.push((dt, t) => {
      for (const s of slots) {
        if (s.light) { s.light.emissiveIntensity = 1.6 + Math.sin(t * 3 + s.ph) * 1.2; continue; }
        if (s.sp <= 0 && Math.random() < dt * 0.25) { s.sp = 3 + Math.random() * 3; s.stop = t + 1 + Math.random() * 1.5; }
        if (s.sp > 0) { s.t.offset.y = (s.t.offset.y + s.sp * dt) % 1; if (t > s.stop) { s.sp = 0; s.t.offset.y = Math.round(s.t.offset.y * 8) / 8; } }
      }
    });
    // roulette table with a spinning wheel, and a blackjack table
    const rt = new THREE.Group(); rt.position.set(-3.2, 0, -1.8); scene.add(rt);
    this.box(3.6, 0.1, 1.7, felt, rt, 0, 0.02, 0); this.box(3.8, 0.78, 1.9, wood, rt, 0, FLOOR_Y + 0.39 - 0.02, 0);
    const wheel = new THREE.Group(); wheel.position.set(-1.1, 0.12, 0); rt.add(wheel);
    this.cyl(0.62, 0.66, 0.12, wood, wheel, 0, 0, 0, 40);
    const disc = this.tex(256, 256, (x, w, h) => { for (let i = 0; i < 37; i++) { x.fillStyle = i === 0 ? '#1e8a3a' : i % 2 ? '#c81e2e' : '#151515'; x.beginPath(); x.moveTo(w / 2, h / 2); x.arc(w / 2, h / 2, w / 2, i / 37 * Math.PI * 2, (i + 1) / 37 * Math.PI * 2); x.fill(); } x.fillStyle = '#c9a24f'; x.beginPath(); x.arc(w / 2, h / 2, w * 0.22, 0, Math.PI * 2); x.fill(); });
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.55, 40), this.std({ map: disc, roughness: 0.35 })); face.rotation.x = -Math.PI / 2; face.position.y = 0.065; wheel.add(face);
    this.cyl(0.04, 0.06, 0.18, gold, wheel, 0, 0.15, 0, 12);
    P.tick.push((dt) => { wheel.rotation.y += dt * 0.9; });
    const board = this.tex(512, 256, (x, w, h) => { x.fillStyle = '#0f5a3a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#e8dcc0'; x.lineWidth = 2; for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) { x.fillStyle = (i + j) % 2 ? '#c81e2e' : '#151515'; x.fillRect(40 + i * 38, 30 + j * 52, 34, 46); x.strokeRect(40 + i * 38, 30 + j * 52, 34, 46); } });
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), this.std({ map: board, roughness: 0.9 })); bm.rotation.x = -Math.PI / 2; bm.position.set(0.5, 0.075, 0); rt.add(bm);
    P.people.push(this.person(scene, 'croupierF', 23, -3.2, -2.9, -3.2, 0, true));
    const bj = new THREE.Group(); bj.position.set(3.6, 0, -2.6); scene.add(bj);
    const bjTop = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.08, 40, 1, false, 0, Math.PI), felt); bjTop.rotation.y = Math.PI / 2; bjTop.position.y = 0.02; bj.add(bjTop);
    this.cyl(0.3, 0.45, 0.78, wood, bj, 0, FLOOR_Y + 0.39, 0.4);
    for (let k = 0; k < 4; k++) this.box(0.09, 0.004, 0.13, this.std({ color: 0xf4f0e6, roughness: 0.4 }), bj, -0.5 + k * 0.35, 0.07, 0.6);
    P.people.push(this.person(scene, 'croupier', 7, 3.6, -3.4, 3.6, 0, true));
    P.people.push(this.person(scene, 'station', 410, 2.6, -1.0, 3.4, -2.6)); P.people.push(this.person(scene, 'maniac', 420, 4.6, -1.0, 3.8, -2.6));
    // gold columns, neon signs, a ceiling full of small lights
    for (const x of [-7, 7]) for (const z of [-5, 2]) this.cyl(0.35, 0.35, 5, gold, scene, x, FLOOR_Y + 2.5, z, 24);
    this.sign(this.neon('ROULETTE', '#ff3355', { size: 120 }), 3.6, 0.9, scene, -3.2, FLOOR_Y + 3.4, -8.9, 1.9);
    this.sign(this.neon('BLACKJACK', '#ffc94a', { size: 120 }), 3.6, 0.9, scene, 3.6, FLOOR_Y + 3.4, -8.9, 1.9);
    this.halo(scene, -3.2, FLOOR_Y + 3.4, -8.7, 0xff3355, 5, 0.22); this.halo(scene, 3.6, FLOOR_Y + 3.4, -8.7, 0xffc94a, 5, 0.22);
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 6, 4), this.std({ color: 0xfff0d0, emissive: 0xffd08a, emissiveIntensity: 5 }), 160), mtx = new THREE.Matrix4();
    for (let i = 0; i < 160; i++) { mtx.setPosition(-11 + (i % 20) * 1.15, FLOOR_Y + 4.95, -8 + Math.floor(i / 20) * 1.6); dots.setMatrixAt(i, mtx); } scene.add(dots);
    for (const [x, z, c] of [[-3.2, -1.8, 0xffd0a0], [3.6, -2.6, 0xffd0a0]]) { const s = new THREE.SpotLight(c, 26, 9, 0.6, 0.6, 1.5); s.position.set(x, FLOOR_Y + 4.8, z + 1.2); s.target.position.set(x, 0, z); scene.add(s, s.target); }
    for (const side of [-1, 1]) { const l = new THREE.PointLight(side < 0 ? 0xff4a6a : 0x6a7aff, 16, 9, 1.6); l.position.set(side * 9.4, FLOOR_Y + 2, -2); scene.add(l); }
    scene.add(new THREE.HemisphereLight(0xffc8d0, 0x200810, 0.28));
    P.view = { pos: [0, 1.35, 6.6], look: [0, 0.35, -3], sway: 1.0 };
    return P;
  },

  /* ---------- County Jail: a cell block, flickering strip lights, a guard at his desk ---------- */
  jail() {
    const P = this.base(0x0a0d12, 0x05070a), { scene } = P;
    const concrete = this.tex(512, 512, (x, w, h) => { x.fillStyle = '#5a5e64'; x.fillRect(0, 0, w, h); for (let k = 0; k < 6000; k++) { const v = Math.random() < 0.5 ? 0 : 255; x.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.06})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); } for (let k = 0; k < 12; k++) { const g = x.createRadialGradient(Math.random() * w, Math.random() * h, 0, Math.random() * w, Math.random() * h, 80); g.addColorStop(0, 'rgba(40,30,20,.25)'); g.addColorStop(1, 'rgba(40,30,20,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); } x.fillStyle = '#2e3b4a'; x.fillRect(0, h * 0.62, w, h * 0.38); x.fillStyle = '#c9b23a'; x.fillRect(0, h * 0.6, w, 8); }, true, [5, 1]);
    const floor = this.tex(512, 512, (x, w, h) => { x.fillStyle = '#3a3e44'; x.fillRect(0, 0, w, h); for (let k = 0; k < 5000; k++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } x.fillStyle = 'rgba(201,178,58,.6)'; x.fillRect(0, h * 0.46, w, 10); }, true, [4, 4]);
    this.room(scene, 20, 16, 4.4, this.std({ map: floor, roughness: 0.4, metalness: 0.1, envMapIntensity: 0.8 }), this.std({ map: concrete, roughness: 0.85 }), this.std({ color: 0x2a2d32, roughness: 0.9 }));
    const bars = this.std({ color: 0x2a2d32, metalness: 0.85, roughness: 0.35 }), cellWall = this.std({ map: concrete, roughness: 0.85 });
    // a row of cells along the back
    for (let c = 0; c < 4; c++) {
      const cx = -6.6 + c * 4.4;
      for (let b = 0; b < 16; b++) this.cyl(0.025, 0.025, 3.4, bars, scene, cx - 1.9 + b * 0.25, FLOOR_Y + 1.7, -4.2, 8);
      for (const y of [0.15, 1.7, 3.3]) this.box(4.1, 0.08, 0.06, bars, scene, cx, FLOOR_Y + y, -4.2);
      this.box(0.25, 4.4, 3.8, cellWall, scene, cx + 2.2, FLOOR_Y + 2.2, -6.1);
      this.box(1.8, 0.12, 0.7, this.std({ color: 0x5a6068, roughness: 0.6 }), scene, cx - 0.8, FLOOR_Y + 0.5, -7.5); // bunk
      this.sign(this.neon(`C-${c + 1}`, '#d8dde5', { font: 'Barlow Condensed', size: 140, plain: true, w: 256, h: 256 }), 0.5, 0.5, scene, cx - 1.6, FLOOR_Y + 3.7, -4.15, 0.9);
    }
    P.people.push(this.person(scene, 'maniac', 77, -2.4, -6.9, -2.4, 0)); // someone already inside
    // the guard's desk
    this.box(2.6, 0.8, 1.1, this.std({ color: 0x3a3e46, roughness: 0.5, metalness: 0.3 }), scene, 4.6, FLOOR_Y + 0.4, 0.6);
    this.box(2.7, 0.05, 1.2, this.std({ color: 0x8a8f96, roughness: 0.4, metalness: 0.5 }), scene, 4.6, FLOOR_Y + 0.82, 0.6);
    const mon = this.box(0.6, 0.4, 0.05, this.std({ color: 0x0a1418, emissive: 0x2a6acc, emissiveIntensity: 0.55 }), scene, 4.2, FLOOR_Y + 1.15, 0.35); mon.rotation.y = -0.3;
    P.people.push(this.person(scene, 'cop', 41, 4.6, 1.35, 4.6, 0));
    this.sign(this.neon('COUNTY JAIL', '#e6ecf5', { font: 'Barlow Condensed', size: 130, plain: true }), 4, 1, scene, -7.5, FLOOR_Y + 3.4, -1, 1, Math.PI / 2);
    // fluorescent strip lights that flicker
    const tubes = [];
    for (const x of [-5, 0, 5]) { const m = this.box(2.4, 0.06, 0.18, this.std({ color: 0xe8f0ff, emissive: 0xcfe0ff, emissiveIntensity: 2.2 }), scene, x, FLOOR_Y + 4.35, -1); const l = new THREE.PointLight(0xcfe0ff, 9, 9, 1.7); l.position.set(x, FLOOR_Y + 4, -1); scene.add(l); tubes.push({ m, l, base: 9 }); this.floorPool(scene, x, -1, 0xcfe0ff, 6, 0.18); }
    const red = new THREE.PointLight(0xff2030, 0, 10, 1.6); red.position.set(7, FLOOR_Y + 3.6, -3); scene.add(red);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), this.std({ color: 0x400008, emissive: 0xff1020, emissiveIntensity: 0 })); beacon.position.set(7.5, FLOOR_Y + 3.6, -3.9); scene.add(beacon);
    P.tick.push((dt, t) => {
      const bad = tubes[1]; const f = (Math.sin(t * 37) > 0.93 || (t % 7) < 0.15) ? 0.15 : 1; bad.m.material.emissiveIntensity = 2.2 * f; bad.l.intensity = bad.base * f;
      const on = Math.sin(t * 4) > 0.5; beacon.material.emissiveIntensity = on ? 6 : 0.2; red.intensity = on ? 10 : 0;
    });
    scene.add(new THREE.HemisphereLight(0xb8c8e0, 0x14181e, 0.18));
    P.view = { pos: [1.6, 1.15, 6.4], look: [-0.6, 0.6, -4.2], sway: 0.5 };
    return P;
  },

  /* ---------- entering and leaving ---------- */
  enter(id) {
    if (!City.built || !this[id]) return false;
    try { if (!this.built[id]) this.built[id] = this[id](); } catch (e) { console.error(e); return false; }
    this.cur = id; const P = this.built[id];
    City.renderPass.scene = P.scene; City.renderPass.camera = P.camera;
    City.bloom.threshold = 0.9; City.bloom.strength = 0.55;
    document.body.classList.add('in-place'); cityEl.classList.add('inside');
    this.resize(); return true;
  },
  leave() {
    if (!this.cur) return; this.cur = null;
    City.renderPass.scene = City.scene; City.renderPass.camera = City.camera;
    City.bloom.threshold = 0.86; City.bloom.strength = 0.7;
    document.body.classList.remove('in-place'); cityEl.classList.remove('inside');
  },
  resize() {
    const P = this.cur && this.built[this.cur]; if (!P) return;
    const w = innerWidth, h = innerHeight, portrait = w / h < 1, cam = P.camera;
    cam.aspect = w / h; cam.fov = portrait ? 62 : 46;
    // keep the room in view beside the menu: on a phone the menu covers the bottom, on a computer the right side
    if (portrait) cam.setViewOffset(w, h, 0, h * 0.24, w, h); else cam.setViewOffset(w, h, w > 900 ? w * 0.16 : 0, 0, w, h);
    cam.updateProjectionMatrix();
  },
  frame(dt, t) {
    const P = this.built[this.cur], v = P.view, cam = P.camera;
    cam.position.set(v.pos[0] + Math.sin(t * 0.17) * v.sway, v.pos[1] + Math.sin(t * 0.23) * 0.08, v.pos[2] + Math.sin(t * 0.11) * 0.3);
    cam.lookAt(v.look[0] + Math.sin(t * 0.13) * v.sway * 0.4, v.look[1], v.look[2]);
    for (const p of P.people) { // now and then someone glances at you, then back
      if (!(p._lt > t)) { p._lt = t + rand(2.5, 6); p.look = Math.random() < 0.35 ? cam.position.clone() : null; }
      p.update(dt, t);
    }
    for (const f of P.tick) f(dt, t);
  },
};

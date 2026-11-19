'use strict';
/* Velvet Hold'em: 18b-city.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   City: the 3D home screen. A night street with the places you can go:
   Velvet Bank, Riverside Card Club (poker), The Golden Strip (casino), County Jail.
   It has its own canvas and renderer, sits above the table and below the menus,
   and only draws while it is showing. Under test automation the classic start
   screen is used instead, unless the page URL has ?city=1.
   ========================================================= */
const cityEl = document.createElement('div'); cityEl.id = 'city'; cityEl.hidden = true;
cityEl.innerHTML = `<canvas id="cityGl"></canvas><div class="cvig"></div>
<div class="ctop"><div class="cbrand">Velvet<small>CITY</small></div><div class="cstat"><span id="cDate"></span><b id="cBank"></b></div></div>
<div id="cPins"></div>
<div class="ccard" id="cCard"><h2 id="cCardT"></h2><p id="cCardP"></p><button class="go" id="cCardGo">Enter</button></div>
<button class="ccont" id="cCont" hidden></button>
<div class="cdock"><button id="cPrev" aria-label="Previous place">‹</button><button id="cQuick">Quick game</button><button class="cphone" id="cPhone"><i></i>Phone<em id="cBadge" hidden></em></button><button id="cNext" aria-label="Next place">›</button></div>`;
document.body.appendChild(cityEl);

const CITY_PLACES = [
  { id: 'bank', name: 'Velvet Bank', x: -27, top: 15.8 },
  { id: 'club', name: 'Riverside Card Club', x: -9, top: 12.8 },
  { id: 'casino', name: 'The Golden Strip', x: 9, top: 33 },
  { id: 'jail', name: 'County Jail', x: 27, top: 12 },
];

const City = {
  active: false, built: false, failed: false, focusI: 1, focusX: -9, camX: -9, cardOn: false, portrait: false, raf: 0, lastUi: 0,
  enabled() { return !navigator.webdriver || /[?&]city=1/.test(location.search); },
  show() {
    if (!this.enabled() || !this.build()) return false;
    cityEl.hidden = false; this.active = true; document.body.classList.add('in-city');
    this.resize(); this.refresh(); this.card(false);
    if (!this.raf) this.loop();
    return true;
  },
  hide() { this.active = false; cityEl.hidden = true; document.body.classList.remove('in-city'); this.card(false); },
  loop() { this.raf = requestAnimationFrame(t => { this.raf = 0; if (!this.active) return; this.frame(t); this.loop(); }); },

  /* ---------- what each place says and does ---------- */
  text(id) {
    const d = Career.load(), j = Jail.data(), l = d.bank && d.bank.loan;
    if (id === 'bank') return l && l.due > 0 ? `Payment due: ${money(Math.ceil(l.due))} by ${Cal.dateText(l.dueBy - 1)}. Loans, savings and your credit score.` : 'Loans, savings and your credit score.';
    if (id === 'jail') return j ? `You are locked up. Pay ${money(j.bail)} bail, or beat the guard heads-up.` : `Clean for now. Arrests so far: ${d.arrests || 0}. Your heat: ${d.heat || 0}. Bribe too often and the police bring you in.`;
    if (j) return 'Closed to you while you are in jail.';
    if (id === 'club') return 'Your hometown card room and the rooms around the world. Cash games, Sit & Gos and bounties.';
    return 'Blackjack and roulette in every room you have unlocked.';
  },
  open(id) {
    unlockAudio(); Sound.tick();
    const j = Jail.data();
    if (id === 'bank') return openLobby({ tab: 'bank', title: 'Velvet Bank' });
    if (id === 'phone') return openLobby({ tab: 'daily', title: 'Phone' });
    if (j || id === 'jail') { if (j) openLobby({ tab: 'rooms', title: 'County Jail' }); return; }
    if (id === 'club') return openLobby({ tab: 'rooms', filter: 'poker', title: 'Riverside Card Club' });
    if (id === 'casino') return openLobby({ tab: 'rooms', filter: 'casino', title: 'The Golden Strip' });
  },
  refresh() {
    const d = Career.load(), j = Jail.data(), l = d.bank && d.bank.loan;
    $('#cDate').textContent = Cal.short(); $('#cBank').textContent = money(d.bankroll);
    for (const p of CITY_PLACES) if (p.el) {
      const locked = (j && p.id !== 'bank') || (p.id === 'bank' && l && l.due > 0);
      p.el.classList.toggle('locked', !!locked);
    }
    const n = (d.bonusDay !== Career.today() ? 1 : 0) + (l && l.due > 0 ? 1 : 0), badge = $('#cBadge');
    badge.hidden = !n; badge.textContent = n;
    const saved = loadSave(), cont = $('#cCont');
    cont.hidden = !(saved && saved.players);
    if (!cont.hidden) cont.textContent = `Continue · Hand ${saved.handNo} · ${fmt(saved.players[0].chips)} chips`;
    if (this.cardOn) $('#cCardP').textContent = this.text(CITY_PLACES[this.focusI].id);
  },
  focus(i, open) {
    this.focusI = (i + CITY_PLACES.length) % CITY_PLACES.length; const p = CITY_PLACES[this.focusI]; this.focusX = p.x;
    CITY_PLACES.forEach((q, k) => q.el && q.el.classList.toggle('on', k === this.focusI && open));
    this.card(open);
  },
  card(on) {
    this.cardOn = !!on; const c = $('#cCard'); c.classList.toggle('show', this.cardOn); if (!on) return;
    const p = CITY_PLACES[this.focusI], j = Jail.data();
    $('#cCardT').textContent = p.name; $('#cCardP').textContent = this.text(p.id);
    const go = $('#cCardGo'); go.hidden = p.id === 'jail' && !j;
    go.textContent = j && p.id !== 'bank' ? 'Go to the jail' : p.id === 'bank' ? 'Go inside' : 'Enter';
    Sound.tick();
  },

  /* ---------- the 3D street (built once, on first show) ---------- */
  build() {
    if (this.built) return true; if (this.failed) return false;
    try { this.make(); this.built = true; return true; } catch (e) { console.error(e); this.failed = true; return false; }
  },
  make() {
    const T = THREE, FX = window.THREE_FX, canvas = $('#cityGl');
    let sd = 7; const pr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95; renderer.outputColorSpace = T.SRGBColorSpace;
    const scene = new T.Scene(); scene.fog = new T.FogExp2(0x0b1224, 0.016);
    const pmrem = new T.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.12;
    const camera = new T.PerspectiveCamera(40, 1, 0.1, 400);
    Object.assign(this, { renderer, scene, camera });

    const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
    // a facade: wall colour and a window grid; some windows lit (with blinds or curtains), dark ones reflect the sky
    const facade = ({ cols, rows, base, frame, lit = 0.45, warm = ['#ffd38a', '#ffe9b8', '#ffc56b'], brick = false, seedOff = 0, size = 512 }) => {
      sd = 11 + seedOff; const pattern = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pattern.push(pr() < lit ? warm[Math.floor(pr() * warm.length)] : null);
      const cells = (ctx, w, h, glow) => {
        const cw = w / cols, ch = h / rows;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const x = c * cw + cw * 0.22, y = r * ch + ch * 0.2, ww = cw * 0.56, hh = ch * 0.6, on = pattern[r * cols + c], style = ((r * cols + c) * 7919) % 10;
          if (glow) {
            if (!on) continue;
            const g = ctx.createLinearGradient(0, y, 0, y + hh); g.addColorStop(0, on); g.addColorStop(1, 'rgba(120,70,20,.55)'); ctx.fillStyle = g; ctx.fillRect(x, y, ww, hh);
            if (style < 3) { ctx.fillStyle = 'rgba(0,0,0,.45)'; for (let b = y; b < y + hh; b += Math.max(2, hh / 7)) ctx.fillRect(x, b, ww, Math.max(1, hh / 18)); }
            else if (style < 6) { ctx.fillStyle = 'rgba(40,10,10,.75)'; ctx.fillRect(x, y, ww * 0.22, hh); ctx.fillRect(x + ww * 0.78, y, ww * 0.22, hh); }
            if (style === 9) { ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x + ww * 0.3, y + hh * 0.35, ww * 0.18, hh * 0.65); }
            ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x + ww / 2 - 0.75, y, 1.5, hh);
          } else {
            ctx.fillStyle = frame; ctx.fillRect(x - 2, y - 2, ww + 4, hh + 4);
            if (on) { ctx.fillStyle = '#4a3a22'; ctx.fillRect(x, y, ww, hh); }
            else { const g = ctx.createLinearGradient(x, y, x + ww, y + hh); g.addColorStop(0, '#1a2436'); g.addColorStop(0.45, '#0a0f18'); g.addColorStop(0.5, '#1c2638'); g.addColorStop(0.56, '#090d15'); ctx.fillStyle = g; ctx.fillRect(x, y, ww, hh); }
            ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 2, y + hh + 1, ww + 4, 2);
          }
        }
      };
      const map = canvasTex(size, size, (ctx, w, h) => {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        if (brick) { ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; for (let y = 0; y < h; y += 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); for (let x = (y / 8) % 2 ? 0 : 8; x < w; x += 16) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 8); ctx.stroke(); } } }
        for (let i = 0; i < 700; i++) { ctx.fillStyle = `rgba(${pr() < .5 ? '0,0,0' : '255,255,255'},${pr() * 0.05})`; ctx.fillRect(pr() * w, pr() * h, 2 + pr() * 6, 2 + pr() * 6); }
        cells(ctx, w, h, false);
      });
      const emissiveMap = canvasTex(size, size, (ctx, w, h) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); cells(ctx, w, h, true); });
      return { map, emissiveMap };
    };
    const facadeMat = (o) => { const f = facade(o); return new T.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissiveMap, emissive: 0xffffff, emissiveIntensity: o.glow ?? 0.8, roughness: 0.85, metalness: 0.05 }); };
    const neonText = (text, { color = '#ff3b55', font = 'Limelight', size = 120, w = 1024, h = 256, glow = 26, plain = false } = {}) => canvasTex(w, h, (ctx) => {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${size}px ${font}`; ctx.lineJoin = 'round';
      if (plain) { ctx.fillStyle = color; ctx.fillText(text, w / 2, h / 2 + 6); return; }
      ctx.shadowColor = color; ctx.shadowBlur = glow; ctx.strokeStyle = color; ctx.lineWidth = size * 0.07; ctx.strokeText(text, w / 2, h / 2 + 6);
      ctx.shadowBlur = 0; ctx.globalAlpha = 0.18; ctx.fillStyle = color; ctx.fillText(text, w / 2, h / 2 + 6);
      ctx.globalAlpha = 0.55; ctx.strokeStyle = '#fff4ec'; ctx.lineWidth = size * 0.022; ctx.strokeText(text, w / 2, h / 2 + 6);
    });
    const glowTex = canvasTex(128, 128, (ctx, w, h) => { const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); });
    const sideMat = c => new T.MeshStandardMaterial({ color: c, roughness: 0.9 });
    const box = (w, h, d, mat, parent, x = 0, y = 0, z = 0) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
    const sign = (tex, w, h, parent, x, y, z, k = 1.6) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, color: new T.Color(k, k, k) })); m.position.set(x, y, z); parent.add(m); return m; };
    const pool = (x, z, color, size = 9, op = 0.55) => { const m = new T.Mesh(new T.PlaneGeometry(size, size), new T.MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.33, z); scene.add(m); return m; };

    // sky, stars, moon
    scene.add(new T.Mesh(new T.SphereGeometry(300, 32, 16), new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new T.Color('#03050d') }, mid: { value: new T.Color('#0e1838') }, low: { value: new T.Color('#3a2446') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.6, h)) : mix(low, mid, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
    })));
    {
      const n = 700, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = rand(0.18, 1.2); pos.set([Math.cos(a) * Math.cos(e) * 280, Math.sin(e) * 280, Math.sin(a) * Math.cos(e) * 280], i * 3); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
      scene.add(new T.Points(g, new T.PointsMaterial({ color: 0xcfd8ff, size: 0.9, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.75 })));
      const moon = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xfff1d0, fog: false, transparent: true, depthWrite: false })); moon.position.set(-70, 95, -230); moon.scale.setScalar(26); scene.add(moon);
      const disc = new T.Mesh(new T.CircleGeometry(4.2, 40), new T.MeshBasicMaterial({ color: 0xfff4dc, fog: false })); disc.position.copy(moon.position).add(new V3(0, 0, 1)); disc.lookAt(0, 0, 0); scene.add(disc);
    }
    scene.add(new T.HemisphereLight(0x5a6ea8, 0x120c10, 0.55));
    const ml = new T.DirectionalLight(0x9fb4ff, 0.55); ml.position.set(-40, 60, 30); scene.add(ml);

    // wet street, sidewalks, road lines
    const asphalt = canvasTex(512, 512, (ctx, w, h) => { ctx.fillStyle = '#16181c'; ctx.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = 20 + Math.random() * 40; ctx.fillStyle = `rgba(${v},${v},${v + 4},${Math.random() * 0.5})`; ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } });
    asphalt.wrapS = asphalt.wrapT = T.RepeatWrapping; asphalt.repeat.set(30, 4);
    const wet = canvasTex(512, 512, (ctx, w, h) => { ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 70; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#0a0a0a'); g.addColorStop(1, 'rgba(10,10,10,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); } }, false);
    wet.wrapS = wet.wrapT = T.RepeatWrapping; wet.repeat.set(10, 2);
    const road = new T.Mesh(new T.PlaneGeometry(240, 16), new T.MeshStandardMaterial({ map: asphalt, roughnessMap: wet, roughness: 1, metalness: 0.15, envMapIntensity: 1.2 })); road.rotation.x = -Math.PI / 2; scene.add(road);
    const walkMat = new T.MeshStandardMaterial({ color: 0x2a2b2f, roughness: 0.55, metalness: 0.05 });
    for (const z of [-10, 10]) box(240, 0.3, 4, walkMat, scene, 0, 0.15, z);
    const back = new T.Mesh(new T.PlaneGeometry(400, 300), new T.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.9 })); back.rotation.x = -Math.PI / 2; back.position.set(0, -0.02, -150); scene.add(back);
    const near = new T.Mesh(new T.PlaneGeometry(400, 120), new T.MeshStandardMaterial({ map: asphalt, roughnessMap: wet, roughness: 1, metalness: 0.1, color: 0x8a8a90 })); near.rotation.x = -Math.PI / 2; near.position.set(0, 0.29, 72); scene.add(near);
    const lineMat = new T.MeshBasicMaterial({ color: 0xc9a24f }), lineGeo = new T.PlaneGeometry(3, 0.18);
    for (let x = -110; x < 110; x += 6) { const l = new T.Mesh(lineGeo, lineMat); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.01, 0); scene.add(l); }

    // street lamps (real light only on the ones in view)
    const poleMat = new T.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.4, metalness: 0.8 }), bulbMat = new T.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc46a, emissiveIntensity: 6 });
    for (let x = -60; x <= 60; x += 15) {
      const g = new T.Group(); g.position.set(x, 0.3, 8.8); scene.add(g);
      const p = new T.Mesh(new T.CylinderGeometry(0.09, 0.13, 6.2, 10), poleMat); p.position.y = 3.1; g.add(p);
      box(0.1, 0.1, 1.4, poleMat, g, 0, 6.1, -0.6);
      const head = new T.Mesh(new T.CylinderGeometry(0.32, 0.18, 0.3, 14), poleMat); head.position.set(0, 6.0, -1.2); g.add(head);
      const b = new T.Mesh(new T.SphereGeometry(0.16, 12, 8), bulbMat); b.position.set(0, 5.83, -1.2); g.add(b);
      pool(x, 7.6, 0xffc070, 8, 0.42);
      if (Math.abs(x) <= 30) { const l = new T.PointLight(0xffc27a, 26, 18, 1.6); l.position.set(x, 5.6, 7.6); scene.add(l); }
    }

    const groups = [];
    const place = (g, id) => { g.traverse(o => { o.userData.place = id; }); groups.push(g); scene.add(g); };
    // Velvet Bank
    {
      const g = new T.Group(); g.position.set(-27, 0.3, -18);
      const stone = new T.MeshStandardMaterial({ color: 0xcabf9f, roughness: 0.7 });
      const body = new T.Mesh(new T.BoxGeometry(16, 11, 10), [sideMat(0x6e6656), sideMat(0x6e6656), stone, stone, facadeMat({ cols: 5, rows: 2, base: '#b9ad8c', frame: '#8a7f62', lit: 0.7, seedOff: 3 }), stone]); body.position.y = 5.5; g.add(body);
      for (let i = 0; i < 3; i++) box(17.5 - i * 0.9, 0.35, 3 - i * 0.7, stone, g, 0, 0.17 + i * 0.35, 6.2 - i * 0.35);
      for (let i = 0; i < 6; i++) { const c = new T.Mesh(new T.CylinderGeometry(0.45, 0.52, 8.6, 18), stone); c.position.set(-6.5 + i * 2.6, 5.4, 6); g.add(c); }
      box(17, 0.8, 2.6, stone, g, 0, 10, 6);
      const tri = new T.Shape(); tri.moveTo(-8.7, 0); tri.lineTo(8.7, 0); tri.lineTo(0, 3); tri.closePath();
      const ped = new T.Mesh(new T.ExtrudeGeometry(tri, { depth: 2.4, bevelEnabled: false }), stone); ped.position.set(0, 10.4, 4.8); g.add(ped);
      sign(neonText('VELVET BANK', { color: '#3a2e18', size: 110, plain: true }), 9, 2.2, g, 0, 11.4, 7.25, 1);
      for (const x of [-7, 7]) { const s = new T.SpotLight(0xffd9a0, 120, 22, 0.55, 0.6, 1.4); s.position.set(x, 0.6, 9.5); s.target.position.set(x * 0.6, 9, 6); g.add(s, s.target); }
      pool(-27, -10.5, 0xffd9a0, 14, 0.25);
      place(g, 'bank');
    }
    // Riverside Card Club
    {
      const g = new T.Group(); g.position.set(-9, 0.3, -16);
      const body = new T.Mesh(new T.BoxGeometry(14, 10, 10), [sideMat(0x3a1c16), sideMat(0x3a1c16), sideMat(0x2a1410), sideMat(0x2a1410), facadeMat({ cols: 6, rows: 3, base: '#4a241c', frame: '#1e0e0a', brick: true, lit: 0.6, seedOff: 9 }), sideMat(0x3a1c16)]); body.position.y = 5; g.add(body);
      const awn = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 8, 20, 1, false, 0, Math.PI), new T.MeshStandardMaterial({ color: 0x11685d, roughness: 0.6, side: T.DoubleSide })); awn.rotation.z = Math.PI / 2; awn.position.set(0, 3.6, 5.6); g.add(awn);
      box(2.6, 3.4, 0.25, new T.MeshStandardMaterial({ color: 0x24130a, roughness: 0.6 }), g, 0, 1.7, 5.02);
      for (const x of [-0.6, 0.6]) box(0.9, 2.2, 0.1, new T.MeshStandardMaterial({ color: 0x1e1208, emissive: 0xc8742a, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.3 }), g, x, 1.9, 5.16);
      sign(neonText('CARD CLUB', { color: '#2fe6cf', size: 130 }), 8.4, 2.1, g, 0, 7.6, 5.12, 1.9);
      const l = new T.PointLight(0x2fe0c0, 30, 16, 1.6); l.position.set(0, 7, 8); g.add(l);
      pool(-9, -10.5, 0x2fe0c0, 12, 0.35);
      place(g, 'club');
    }
    // The Golden Strip
    const bulbs = [];
    {
      const g = new T.Group(); g.position.set(9, 0.3, -20);
      const body = new T.Mesh(new T.BoxGeometry(15, 30, 12), [sideMat(0x24160f), sideMat(0x24160f), sideMat(0x1a0f0a), sideMat(0x1a0f0a), facadeMat({ cols: 14, rows: 30, base: '#21150e', frame: '#4a3214', lit: 0.5, warm: ['#ffcf73', '#ffe0a0', '#ffb44d'], seedOff: 21, glow: 1.0, size: 1024 }), sideMat(0x24160f)]); body.position.y = 15; g.add(body);
      box(15.6, 0.6, 12.6, new T.MeshStandardMaterial({ color: 0xd9b25a, metalness: 0.9, roughness: 0.3 }), g, 0, 30.2, 0);
      box(17, 1.6, 4, new T.MeshStandardMaterial({ color: 0x5a0e1a, roughness: 0.5, emissive: 0x3a0610, emissiveIntensity: 1 }), g, 0, 5.2, 7.6);
      const bulbGeo = new T.SphereGeometry(0.12, 8, 6);
      for (let i = 0; i < 52; i++) { const m = new T.Mesh(bulbGeo, new T.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffc860, emissiveIntensity: 4 })); m.position.set(-8.3 + i / 52 * 16.6, 6.05, 9.65); g.add(m); bulbs.push(m); const m2 = m.clone(); m2.position.y = 4.35; g.add(m2); }
      sign(neonText('GOLDEN STRIP', { color: '#ff3355', size: 118 }), 13.5, 3.4, g, 0, 5.2, 9.62, 1.9);
      box(3.2, 15, 0.5, new T.MeshStandardMaterial({ color: 0x1a0a0e, roughness: 0.5, metalness: 0.4 }), g, 7.2, 17, 6.4);
      const vtex = canvasTex(256, 1280, (ctx, w) => { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '170px Limelight'; ctx.lineJoin = 'round';
        'CASINO'.split('').forEach((ch, i) => { const y = 120 + i * 205; ctx.shadowColor = '#ffc94a'; ctx.shadowBlur = 24; ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 11; ctx.strokeText(ch, w / 2, y); ctx.shadowBlur = 0; ctx.globalAlpha = 0.55; ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = 3.5; ctx.strokeText(ch, w / 2, y); ctx.globalAlpha = 1; }); });
      sign(vtex, 2.8, 14, g, 7.2, 17, 6.7, 1.9);
      for (const x of [-1.6, 0, 1.6]) box(1.3, 2.6, 0.15, new T.MeshStandardMaterial({ color: 0x1e1508, emissive: 0xd08a3a, emissiveIntensity: 0.45, roughness: 0.12, metalness: 0.4 }), g, x, 1.6, 6.08);
      const l = new T.PointLight(0xff4a5a, 50, 22, 1.5); l.position.set(0, 6, 12); g.add(l);
      pool(9, -10.5, 0xff4060, 16, 0.4);
      place(g, 'casino');
    }
    // County Jail with a police car
    const police = {};
    {
      const g = new T.Group(); g.position.set(27, 0.3, -17);
      const body = new T.Mesh(new T.BoxGeometry(16, 9, 10), [sideMat(0x44474c), sideMat(0x44474c), sideMat(0x34373b), sideMat(0x34373b), facadeMat({ cols: 12, rows: 3, base: '#4c5056', frame: '#2c2f33', lit: 0.25, warm: ['#cfe2ff', '#e8f0ff'], seedOff: 33, glow: 0.6 }), sideMat(0x44474c)]); body.position.y = 4.5; g.add(body);
      const barM = new T.MeshStandardMaterial({ color: 0x1b1d20, metalness: 0.7, roughness: 0.4 }), barGeo = new T.BoxGeometry(0.06, 2.2, 0.06), wireGeo = new T.TorusGeometry(0.22, 0.02, 4, 10);
      for (let i = 0; i < 30; i++) { const b = new T.Mesh(barGeo, barM); b.position.set(-7.6 + i * 0.52, 4.6, 5.06); g.add(b); }
      for (let i = 0; i < 40; i++) { const r = new T.Mesh(wireGeo, barM); r.position.set(-7.8 + i * 0.4, 9.3, 4.6); r.rotation.y = Math.PI / 2; g.add(r); }
      sign(neonText('COUNTY JAIL', { color: '#e6ecf5', font: 'Barlow Condensed', size: 120, plain: true }), 7.5, 1.8, g, 0, 7.6, 5.1, 0.9);
      const car = new T.Group(); car.position.set(-3, 0.3, 8.2); car.rotation.y = 0.12; g.add(car);
      box(4.4, 0.8, 1.9, new T.MeshStandardMaterial({ color: 0x0e1424, metalness: 0.6, roughness: 0.35 }), car, 0, 0.7, 0);
      box(2.3, 0.7, 1.7, new T.MeshStandardMaterial({ color: 0xe8ecf2, metalness: 0.5, roughness: 0.3 }), car, -0.2, 1.4, 0);
      police.red = box(0.5, 0.18, 1.2, new T.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff1020, emissiveIntensity: 6 }), car, -0.2, 1.85, -0.3);
      police.blue = box(0.5, 0.18, 1.2, new T.MeshStandardMaterial({ color: 0x2060ff, emissive: 0x1040ff, emissiveIntensity: 6 }), car, -0.2, 1.85, 0.3);
      const wheel = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.3, 16), new T.MeshStandardMaterial({ color: 0x0a0a0a })); wheel.rotation.x = Math.PI / 2;
      for (const z of [-0.95, 0.95]) for (const x of [-1.4, 1.4]) { const w = wheel.clone(); w.position.set(x, 0.42, z); car.add(w); }
      police.light = new T.PointLight(0xff2030, 40, 16, 1.5); police.light.position.set(24, 3, -7); scene.add(police.light);
      police.pool = pool(25, -8, 0xff2030, 12, 0.3);
      place(g, 'jail');
    }
    // skyline: a few shared facade looks, repeated to fit each building (keeps phone memory low)
    const blinkers = [];
    {
      const looks = [['#1c2230', '#2a3346'], ['#22202a', '#34303f'], ['#1a1e1c', '#2c322e']].flatMap(([base, frame], k) => [0.18, 0.34].map((lit, j) => {
        const f = facade({ cols: 8, rows: 8, base, frame, lit, seedOff: 60 + k * 2 + j });
        for (const t of [f.map, f.emissiveMap]) t.wrapS = t.wrapT = T.RepeatWrapping;
        return new T.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.85 });
      }));
      const dark = [sideMat(0x111520), sideMat(0x111520), sideMat(0x0b0e16), sideMat(0x0b0e16)];
      for (let i = 0; i < 34; i++) {
        const w = rand(8, 16), h = rand(18, 70), d = rand(8, 14), x = -150 + i * 9 + rand(-3, 3), z = rand(-55, -95); if (Math.abs(x) > 140) continue;
        const front = looks[i % looks.length], rx = Math.max(1, Math.round(w / 10)), ry = Math.max(1, Math.round(h / 17));
        const geo = new T.BoxGeometry(w, h, d), uv = geo.attributes.uv; // tile the shared window picture to fit this building
        for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * rx, uv.getY(k) * ry);
        const m = new T.Mesh(geo, [dark[0], dark[1], dark[2], dark[3], front, dark[0]]); m.position.set(x, h / 2, z); scene.add(m);
        if (h > 45) { const b = new T.Mesh(new T.SphereGeometry(0.4, 8, 6), new T.MeshBasicMaterial({ color: 0xff2020, fog: false })); b.position.set(x, h + 0.6, z); scene.add(b); blinkers.push(b); }
      }
    }
    // traffic and parked cars
    const cars = [];
    const makeCar = (color, lane, speed, x0) => {
      const c = new T.Group(); c.position.set(x0, 0.3, lane);
      box(4.2, 0.75, 1.85, new T.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3 }), c, 0, 0.65, 0);
      box(2.2, 0.65, 1.65, new T.MeshStandardMaterial({ color: 0x0b0d12, metalness: 0.4, roughness: 0.15 }), c, -0.2, 1.3, 0);
      const dir = Math.sign(speed) || 1;
      if (speed) {
        for (const z of [-0.6, 0.6]) { box(0.08, 0.18, 0.4, new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d8, emissiveIntensity: 8 }), c, 2.1 * dir, 0.75, z); box(0.08, 0.16, 0.38, new T.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 5 }), c, -2.1 * dir, 0.8, z); }
        const beam = new T.Mesh(new T.PlaneGeometry(9, 3.4), new T.MeshBasicMaterial({ map: glowTex, color: 0xfff0d0, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false })); beam.rotation.x = -Math.PI / 2; beam.position.set(6 * dir, 0.04, 0); c.add(beam);
      }
      scene.add(c); cars.push({ c, speed });
    };
    makeCar(0x8a1020, -3.2, -9, 40); makeCar(0x2a2f38, 6.6, 0, -16); makeCar(0x5a1418, 6.6, 0, 21); makeCar(0x1d2b40, 3.2, 7, -50); makeCar(0xc9c4b8, -3.2, -11, -20); makeCar(0x0c3a2c, 3.2, 8, 70);

    // glow
    const composer = new FX.EffectComposer(renderer);
    composer.addPass(new FX.RenderPass(scene, camera));
    const bloom = new FX.UnrealBloomPass(new T.Vector2(256, 256), 0.7, 0.5, 0.86); composer.addPass(bloom);
    composer.addPass(new FX.OutputPass());
    Object.assign(this, { composer, bloom, groups, bulbs, police, blinkers, cars, ray: new T.Raycaster(), ndc: new T.Vector2(), t0: performance.now() });

    // labels over each place
    for (const p of CITY_PLACES) {
      const el = document.createElement('div'); el.className = 'cpin'; el.innerHTML = `<span class="ctag"><i class="cdot"></i>${p.name}</span><div class="cstem"></div>`;
      el.addEventListener('click', e => { e.stopPropagation(); this.focus(CITY_PLACES.indexOf(p), true); });
      $('#cPins').appendChild(el); p.el = el;
    }
    // controls
    $('#cPrev').onclick = () => this.focus(this.focusI - 1, true);
    $('#cNext').onclick = () => this.focus(this.focusI + 1, true);
    $('#cCardGo').onclick = () => this.open(CITY_PLACES[this.focusI].id);
    $('#cPhone').onclick = () => this.open('phone');
    $('#cQuick').onclick = () => { unlockAudio(); Sound.tick(); openOverlay('startScreen'); };
    $('#cCont').onclick = () => $('#btnContinue').click();
    let downX = null, dragX = 0;
    canvas.addEventListener('pointerdown', e => { downX = e.clientX; dragX = 0; });
    canvas.addEventListener('pointermove', e => { if (downX == null) return; const dx = e.clientX - downX; dragX += dx; this.focusX -= dx * 0.05; downX = e.clientX; });
    canvas.addEventListener('pointerup', e => {
      const moved = Math.abs(dragX) > 6; downX = null;
      if (moved) { let best = 0; CITY_PLACES.forEach((p, k) => { if (Math.abs(p.x - this.focusX) < Math.abs(CITY_PLACES[best].x - this.focusX)) best = k; }); this.focus(best, false); return; }
      const r = canvas.getBoundingClientRect(); this.ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.ray.setFromCamera(this.ndc, camera);
      const hit = this.ray.intersectObjects(groups, true)[0];
      if (hit) this.focus(CITY_PLACES.findIndex(p => p.id === hit.object.userData.place), true); else this.card(false);
    });
    canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || downX != null) return; const r = canvas.getBoundingClientRect(); this.ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.ray.setFromCamera(this.ndc, camera); canvas.style.cursor = this.ray.intersectObjects(groups, true).length ? 'pointer' : ''; });
    addEventListener('resize', () => { if (this.active) this.resize(); });
  },
  resize() {
    if (!this.built) return;
    const w = innerWidth, h = innerHeight; this.portrait = w / h < 1;
    this.renderer.setSize(w, h, false); this.composer.setSize(w, h); this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h; this.camera.fov = this.portrait ? 50 : 38; this.camera.updateProjectionMatrix();
  },
  frame(now) {
    const t = (now - this.t0) / 1000, dt = Math.min(0.05, this.lastT ? t - this.lastT : 0.016); this.lastT = t;
    const cam = this.camera, P = this.portrait;
    const target = P ? this.focusX : this.focusX * 0.35;
    this.camX += (target - this.camX) * Math.min(1, dt * 2.2);
    cam.position.set(this.camX + Math.sin(t * 0.13) * 1.2, (P ? 7.5 : 8) + Math.sin(t * 0.21) * 0.35, P ? 40 : 50);
    cam.lookAt(this.camX * (P ? 1 : 0.9), P ? 9 : 7, -16);
    this.bulbs.forEach((b, i) => { b.material.emissiveIntensity = ((i + Math.floor(t * 12)) % 4 === 0) ? 9 : 2.2; });
    const flash = Math.floor(t * 3.2) % 2, pc = this.police;
    pc.red.material.emissiveIntensity = flash ? 9 : 0.5; pc.blue.material.emissiveIntensity = flash ? 0.5 : 9;
    pc.light.color.setHex(flash ? 0xff2030 : 0x2050ff); pc.pool.material.color.setHex(flash ? 0xff2030 : 0x2050ff);
    this.blinkers.forEach((b, i) => b.visible = Math.sin(t * 2 + i) > 0.6);
    for (const k of this.cars) { if (!k.speed) continue; k.c.position.x += k.speed * dt; if (k.c.position.x > 110) k.c.position.x = -110; if (k.c.position.x < -110) k.c.position.x = 110; }
    const v = new V3();
    for (const p of CITY_PLACES) {
      v.set(p.x, p.top, p.id === 'casino' ? -20 : -17).project(cam);
      const x = (v.x + 1) / 2 * innerWidth, y = Math.max(118, (1 - v.y) / 2 * innerHeight), off = v.z > 1 || x < 40 || x > innerWidth - 40;
      p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`; p.el.style.opacity = off ? 0 : 1; p.el.style.pointerEvents = off ? 'none' : '';
    }
    if (now - this.lastUi > 1000) { this.lastUi = now; this.refresh(); }
    this.composer.render();
  },
};

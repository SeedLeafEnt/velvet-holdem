'use strict';
/* Velvet Hold'em: 14-render.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Layout & render loop
   ========================================================= */
function layout(force) {
  const r = stageEl.getBoundingClientRect(); const W = Math.round(r.width), H = Math.round(r.height);
  if (W < 50 || H < 50 || !G.ok) return;
  const portrait = W < 640 || W / H < 1.1;
  const av = Math.round(portrait ? clamp(Math.min(W * 0.105, H * 0.08), 34, 48) : clamp(Math.min(W * 0.045, H * 0.1), 42, 58));
  const plateW = Math.round(av * 1.9);
  document.documentElement.style.setProperty('--av', av + 'px'); document.documentElement.style.setProperty('--plateW', plateW + 'px');
  const wantD = portrait ? Math.round(clamp(1.32 * (H / W) * 1.3, 2.1, 2.8) * 20) / 20 : 1.5;
  const oriChanged = portrait !== G.portrait || !tableGroup || Math.abs(wantD - G.table.D) > 0.04;
  Object.assign(G, { W, H, av, plateW, portrait });
  renderer.setPixelRatio(settings.quality === 'saver' ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false); TFX.resize(W, H);
  if (oriChanged || force) {
    // Portrait: a slimmer table leaves room for two players down each side
    G.table = portrait ? { W: 1.32, D: wantD } : { W: 2.7, D: 1.5 };
    G.railW = portrait ? 0.13 : 0.15; G.trackW = portrait ? 0.035 : 0.045;
    const rim = G.railW + G.trackW, fW = G.table.W - 2 * rim, fD = G.table.D - 2 * rim; G.felt = { W: fW, D: fD };
    computeAnchors(); buildTable(); positionPiles(); placePeople(); Bar.layout();
    for (const c of liveCards) placeNow(c);
    placeDealer(true); TFX.neighbours();
  }
  fitCamera();
  FX.resize();
}
let lastBusy = 0, frameN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!G.ok || S.test) return;
  if (City.active) return; // the city draws on its own canvas
  if (Casino.active) { Casino.frame(now); return; }
  if (anims.length || flying.size || chipsDirty || (dealerP && dealerP.gest) || people.some(q => q && q.gest)) lastBusy = now;
  if (now - lastBusy > 2500 && (frameN++ % 2)) return; // idle: ~30 fps to save battery
  stepAnims(now);
  updatePeople(now);
  updateCamera(now);
  if (chipsDirty) { renderChips(); chipsDirty = false; }
  updateOverlay();
  TFX.update(now);
  TFX.render();
}

/* =========================================================
   Table light and cinema: a soft bloom glow, a vignette, dimming the room for all-in
   run-outs and big rivers, a spotlight on the winner, and neighbouring tables at the edges
   of the floor so the room feels full. 'Battery saver' quality skips the glow.
   ========================================================= */
const TFX = {
  composer: null, bloom: null, dim: 1, dimTo: 1, win: 0, winTo: 0, winUntil: 0, lastT: 0, group: null,
  init() {
    const FX2 = window.THREE_FX;
    if (FX2) {
      this.composer = new FX2.EffectComposer(renderer);
      this.composer.addPass(new FX2.RenderPass(scene, camera));
      this.bloom = new FX2.UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.4, 2.4); // only real highlights glow: lit white cards must stay readable this.composer.addPass(this.bloom);
      this.composer.addPass(new FX2.OutputPass());
    }
    const s = new THREE.SpotLight(0xfff0d6, 0, 5.5, 0.3, 0.6, 1.6); s.position.set(0, 2.6, 0.2); scene.add(s, s.target); this.spot = s;
    const v = document.createElement('div'); v.className = 'tvig'; stageEl.insertBefore(v, overlayEl);
    this.group = new THREE.Group(); scene.add(this.group);
  },
  resize(W, H) { if (!this.composer) return; this.composer.setPixelRatio(renderer.getPixelRatio()); this.composer.setSize(W, H); this.bloom.resolution.set(W / 2, H / 2); },
  render() { if (this.composer && settings.quality !== 'saver') this.composer.render(); else renderer.render(scene, camera); },
  update(now) {
    const dt = Math.min(0.1, this.lastT ? (now - this.lastT) / 1000 : 0.016); this.lastT = now;
    this.dim += (this.dimTo - this.dim) * Math.min(1, dt * 2.4);
    if (G.hemi) G.hemi.intensity = 0.36 * this.dim; if (G.fill) G.fill.intensity = 0.65 * (0.35 + 0.65 * this.dim);
    if (this.winUntil && now > this.winUntil) { this.winTo = 0; this.winUntil = 0; }
    this.win += (this.winTo - this.win) * Math.min(1, dt * 3); this.spot.intensity = this.win;
  },
  // all-in run-outs and big rivers: the room goes dark around the table
  dimRoom(on) { if (S.test || !G.ok) return; this.dimTo = on ? 0.38 : 1; stageEl.classList.toggle('cine', !!on); },
  // a spotlight swings onto the winner's chips, with a burst of sparkle for opponents (yours has its own)
  spotOn(p) {
    if (S.test || !G.ok || !p || !A.seats[p.i]) return;
    const s = A.seats[p.i], at = s.stack || s.card;
    this.spot.target.position.set(at.x, 0, at.z); this.spot.position.set(at.x * 0.55, 2.4, at.z * 0.55 + 0.2);
    this.winTo = 14; this.winUntil = performance.now() + 2600;
    if (!p.isHero) { const pt = proj(s.stack, 0, 0.05, 0); FX.burst(pt.x, pt.y, 26, 0.7); }
  },
  reset() { this.dimTo = 1; this.winTo = 0; this.winUntil = 0; stageEl.classList.remove('cine'); },
  // the edges of other tables, each under its own lamp, just inside the view
  neighbours() {
    const g = this.group; if (!g) return;
    while (g.children.length) { const c = g.children.pop(); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    const spots = G.portrait ? [[-2.5, 3.2], [2.5, 3.2], [-2.3, -3.4], [2.3, -3.4]] : [[-4.5, -0.3], [4.5, -0.3], [-3.6, 2.9], [3.6, 2.9]];
    const felt = new THREE.MeshStandardMaterial({ color: 0x0f5a50, roughness: 0.9 }), rail = new THREE.MeshStandardMaterial({ color: 0x2a0f0b, roughness: 0.45 });
    const chipCols = [0xb81e2e, 0x1e5bb8, 0x161616, 0x2e8b4e, 0xd8c070];
    for (const [x, z] of spots) {
      const t = new THREE.Group(); t.position.set(x, 0, z); t.rotation.y = Math.atan2(x, z) + Math.PI / 2; g.add(t);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.05, 40), felt); top.scale.set(1.8, 1, 1); t.add(top);
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.08, 10, 48), rail); r.rotation.x = Math.PI / 2; r.scale.set(1.8, 1, 1); r.position.y = 0.05; t.add(r);
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03 + (k % 3) * 0.02, 14), new THREE.MeshStandardMaterial({ color: chipCols[k], roughness: 0.4 })); c.position.set(Math.cos(a) * 1.0, 0.06, Math.sin(a) * 0.5); t.add(c); }
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3), new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xffc888, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.04; t.add(pool);
      const floorPool = pool.clone(); floorPool.material = pool.material.clone(); floorPool.material.opacity = 0.14; floorPool.scale.setScalar(1.6); floorPool.position.y = -0.77; t.add(floorPool);
    }
  },
};
function applyQuality() {
  if (!G.ok) return;
  const hi = settings.quality !== 'saver';
  renderer.shadowMap.enabled = hi; spot.castShadow = hi;
  scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  layout();
}
function placeDealer(instant) {
  const d = A.seats[S.button] && A.seats[S.button].dealer; if (!d || !dealerPuck) return;
  if (instant || S.test) { dealerPuck.position.set(d.x, 0.008, d.z); return; }
  const a = dealerPuck.position.clone();
  bg(animate(650, e => { dealerPuck.position.set(lerp(a.x, d.x, e), 0.008 + Math.sin(e * Math.PI) * 0.03, lerp(a.z, d.z, e)); dealerPuck.rotation.y = e * Math.PI * 2; }, easeInOut));
}

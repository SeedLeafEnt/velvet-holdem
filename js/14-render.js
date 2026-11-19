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
  renderer.setSize(W, H, false);
  if (oriChanged || force) {
    // Portrait: a slimmer table leaves room for two players down each side
    G.table = portrait ? { W: 1.32, D: wantD } : { W: 2.7, D: 1.5 };
    G.railW = portrait ? 0.13 : 0.15; G.trackW = portrait ? 0.035 : 0.045;
    const rim = G.railW + G.trackW, fW = G.table.W - 2 * rim, fD = G.table.D - 2 * rim; G.felt = { W: fW, D: fD };
    computeAnchors(); buildTable(); positionPiles(); placePeople(); Bar.layout();
    for (const c of liveCards) placeNow(c);
    placeDealer(true);
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
  renderer.render(scene, camera);
}
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

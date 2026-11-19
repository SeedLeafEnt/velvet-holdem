'use strict';
/* Velvet Hold'em: 19-boot.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Persistence (between hands only)
   ========================================================= */
const SET_KEY = 'velvet3d-settings-v1', SAVE_KEY = 'velvet3d-save-v2';
function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch (e) {} }
function loadSettings() { try { const s = JSON.parse(localStorage.getItem(SET_KEY) || 'null'); if (s) Object.assign(settings, s); } catch (e) {} if (!CARD_STYLES[settings.cardStyle]) settings.cardStyle = 'classic'; }
function snapshotBetween(finished) {
  if (finished) { S.saved = null; clearSave(); return; }
  S.saved = {
    v: 2, mode: S.mode, level: S.level, structure: S.structure, handNo: S.handNo, blindIdx: S.blindIdx, button: S.button, heroBuyin: S.heroBuyin, career: S.career || null, ko: S.ko || 0,
    stats: S.stats, hm: S.hm, ann: S.ann, clockLeft: Clock.left,
    players: S.players.map(p => ({ name: p.name, persona: p.persona, chips: p.chips + p.total, colorIdx: p.colorIdx, isHero: p.isHero, out: p.out, place: p.place, st: p.st, bounty: p.bounty || 0 }))
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S.saved)); } catch (e) {}
}
function loadSave() {
  if (S.saved) return S.saved;
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
}
function clearSave() { S.saved = null; try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

/* =========================================================
   Lobby preview scene
   ========================================================= */
function preview() {
  resetTableVisuals();
  const names = ['Otto', 'Mei', 'Diego', 'Ruth'], pers = ['rock', 'shark', 'maniac', 'station'];
  S.players = [makePlayer(0, 'You', 'pro', 1500, 0, true)].concat(names.map((n, k) => makePlayer(k + 1, n, pers[k], [1460, 1720, 980, 1505][k], k + 1)));
  S.inHand = false; S.mode = 'sng'; S.blindIdx = 0; setBlinds(); S.button = 3; S.handNo = 0; S.board = []; S.pot = 0;
  layout(); syncPeople(); renderSeats(); lookAt(-1);
  const c = (r, s) => (r - 2) * 4 + s;
  [c(14, 0), c(13, 0), c(7, 1)].forEach((card, k) => S.boardCards.push(new Card3D(card, { k: 'board', i: k }, true)));
  [c(12, 0), c(11, 0)].forEach((card, k) => new Card3D(card, { k: 'hole', seat: 0, n: k }, true));
  [1, 2, 3, 4].forEach(i => [0, 1].forEach(k => new Card3D(-1, { k: 'hole', seat: i, n: k })));
  S.pot = 150; renderPot(); S.pot = 0;
  setPile('bet2', 60); setPile('bet3', 60);
  placeDealer(true);
  $('#handName').textContent = 'Take a seat to begin'; $('#odds').hidden = true;
  btnFold.disabled = btnCall.disabled = btnRaise.disabled = true; midRow.className = 'msg'; midRow.textContent = '';
}

/* =========================================================
   Boot
   ========================================================= */
let resizeT = 0;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { layout(); Casino.resize(); if (Casino.active === 'bj') BJ.labels(); }, 80); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && Sound.ctx && Sound.ctx.state === 'suspended' && settings.sound) Sound.ctx.resume().catch(() => {}); Clock.last = performance.now(); });
document.addEventListener('pointerdown', () => { if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume().catch(() => {}); }, { passive: true });

async function loadFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const faces = ['800 40px "Source Serif 4"', '40px Limelight', '700 40px "Barlow Condensed"', '600 40px "Barlow Condensed"'];
  await Promise.race([Promise.all(faces.map(f => document.fonts.load(f).catch(() => {}))), sleep(3500)]);
}
function refreshTextures() {
  if (!G.ok) return;
  Cards.refresh();
  if (TEX.back) { TEX.back.image = drawBack(); TEX.back.needsUpdate = true; }
  chipMeshes.forEach((m, di) => { m.material[0].map = chipEdge(di); m.material[1].map = chipFace(di); m.material.forEach(x => x.needsUpdate = true); });
  if (MAT.puckTop) { MAT.puckTop.map = puckFace(); MAT.puckTop.needsUpdate = true; }
  if (MAT.felt.map) { MAT.felt.map.dispose(); MAT.felt.map = feltTexture(); MAT.felt.needsUpdate = true; }
}
async function boot(data) {
  loadSettings();
  if (data && data.settings) Object.assign(settings, data.settings);
  if (data && data.game && !S.saved) S.saved = data.game;
  Voice.init();
  FX.init(); syncSettingsUI(); applySpeedVar();
  await loadFonts();
  if (!initGL()) {
    $('#loadMsg').textContent = 'This device or browser has 3D graphics (WebGL) turned off, so the table cannot be shown. Try another browser, or turn on hardware acceleration.';
    const sp = $('#loading .spin'); if (sp) sp.style.display = 'none';
    window.__velvetBooted = true; return;
  }
  CAM.blend = settings.view === 'overhead' ? 1 : 0;
  applyQuality();
  requestAnimationFrame(frame);
  window.__velvetBooted = true;
  showStart();
  setTimeout(() => $('#loading').classList.add('done'), 150);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (document.fonts.check('800 40px "Source Serif 4"')) refreshTextures(); });
}
try { window.claude?.hot?.snapshot?.(() => ({ game: S.saved, settings })); } catch (e) {}
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});

try { VO.prefetch(); } catch (e) {}
// Offline support for the installed app (skipped under test automation so tests always load fresh files)
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !navigator.webdriver) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
window.__velvet = { Act, Casino, BJ, RL, Career, Cal, Bar, heroOrder, sendDrink, cam: () => camera, Music, Sound, tipDealer, taunt, setAngry, isAngry, calmDown, renderTalk, applyRigBoard, applyRigHole, people: () => people, dealer: () => dealerP, react, VO, run: () => RUN, anims: () => anims.length, S, evaluate, handName, buildPots, newGame, runoutEquity, equity, settings, Cards, setView, G, A, piles, liveCards, Clock, showBubble, layout };

'use strict';
/* Velvet Hold'em: 12-casino.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Stage 4: the casino floor. Blackjack and roulette in every room,
   played with your career bankroll.
   ========================================================= */
const TABLE_LIMITS = { club: [5, 200, [5, 25, 50, 100]], vegas: [25, 1000, [25, 100, 250, 500]], macau: [100, 5000, [100, 500, 1000, 2500]], monaco: [500, 25000, [500, 2500, 5000, 10000]] };
LOOKS.croupier = { g: 'm', hair: 'short', dealer: true, top: '#141418', top2: '#f4f4f2', hairCol: '#1d1714', standing: true };
LOOKS.croupierF = { g: 'f', hair: 'bun', dealer: true, top: '#141418', top2: '#f4f4f2', hairCol: '#2b1a12', standing: true };
ACHV_LIST.push(['natural', 'Natural', 'Get dealt a blackjack'], ['bj10', 'Card counter', 'Win 10 hands of blackjack'], ['double', 'Double trouble', 'Win a doubled blackjack hand'],
  ['straight', 'Straight up', 'Hit a single number at roulette'], ['spin1k', 'Big spin', 'Win $1,000 or more on one roulette spin']);
for (const [id, n, desc] of ACHV_LIST.slice(-5)) ACHV_BY[id] = { n, desc };
CHALLENGES.push({ id: 'bj3', text: 'Win 3 hands of blackjack', goal: 3, ev: 'bjWin', reward: 200 },
  { id: 'rlnum', text: 'Hit a single number at roulette', goal: 1, ev: 'rlWin', test: e => e.straight, reward: 300 },
  { id: 'rl3', text: 'Win 3 roulette spins', goal: 3, ev: 'rlWin', reward: 150 });
function casinoButtons(card, r) {
  const d = Career.load(), [mn, mx] = TABLE_LIMITS[r.id];
  const row = document.createElement('div'); row.className = 'games casino';
  for (const [k, label] of [['bj', 'Blackjack'], ['rl', 'Roulette']]) {
    const b = document.createElement('button'); b.innerHTML = `${label}<small>${money(mn)} – ${money(mx)} bets</small>`;
    b.disabled = d.bankroll < mn; b.addEventListener('click', () => Casino.enter(k, r.id)); row.appendChild(b);
  }
  card.appendChild(row);
}
const secureInt = n => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch (e) { return Math.floor(Math.random() * n); } };

/* ---------- shared casino scene ---------- */
const CS = 1.25; // casino cards are dealt a little larger
class CCard {
  constructor(c, pos, up = false) {
    this.c = c; this.g = new THREE.Group(); this.flipG = new THREE.Group(); this.g.add(this.flipG);
    this.mat = new THREE.MeshStandardMaterial({ map: Cards.tex(c), roughness: .6, metalness: 0, envMapIntensity: .6 });
    const f = new THREE.Mesh(GEO.cardFront, this.mat), b = new THREE.Mesh(GEO.cardBack, MAT.back); f.castShadow = b.castShadow = true; f.receiveShadow = true;
    this.flipG.add(f, b); this.g.scale.setScalar(CS); this.g.position.copy(pos); this.flipG.rotation.z = up ? 0 : Math.PI; this.up = up;
    Casino.sc.add(this.g);
  }
  to(pos, { up = this.up, dur = 420, delay = 0, yaw = 0, arc = 0.06 } = {}) {
    const a = this.g.position.clone(), b = pos.clone(), f0 = this.flipG.rotation.z, f1 = up ? 0 : Math.PI, y0 = this.g.rotation.y; this.up = up;
    return animate(dur, e => { this.g.position.lerpVectors(a, b, e); this.g.position.y += Math.sin(e * Math.PI) * arc; this.flipG.rotation.z = lerp(f0, f1, e); this.g.rotation.y = lerp(y0, yaw, e); }, easeInOut, delay);
  }
  dispose() { Casino.sc.remove(this.g); this.mat.dispose(); }
}
const Casino = {
  active: null, room: null, ready: false, sc: null, cam: null, chip: 0, people: [], lastT: 0,
  init() {
    if (this.ready || !G.ok) return !!this.ready;
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x05070a); sc.fog = new THREE.Fog(0x05070a, 3.8, 10);
    sc.environment = scene.environment; sc.environmentIntensity = 0.22;
    const sp = new THREE.SpotLight(0xffe2bf, 30, 0, Math.PI / 4, 0.75, 2); sp.position.set(0, 2.6, 0.15); sp.target.position.set(0, 0, -0.15);
    sp.castShadow = settings.quality !== 'saver'; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0003; sp.shadow.normalBias = 0.012; sp.shadow.camera.near = 1.2; sp.shadow.camera.far = 4.6;
    sc.add(sp, sp.target, new THREE.HemisphereLight(0xa9bcc8, 0x1a1110, 0.48));
    const fill = new THREE.DirectionalLight(0xd2ddff, 0.7); fill.position.set(0.4, 1.6, 3); sc.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), MAT.floor); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.78; floor.receiveShadow = true; sc.add(floor);
    this.sc = sc; this.spot = sp; this.cam = new THREE.PerspectiveCamera(42, 1, 0.05, 40);
    this.chipGeo = new THREE.CylinderGeometry(CHIP_R, CHIP_R, CHIP_H, 32);
    this.chipMats = DEN.map((_, di) => { const side = new THREE.MeshStandardMaterial({ map: chipEdge(di), roughness: .55 }), top = new THREE.MeshStandardMaterial({ map: chipFace(di), roughness: .5 }); return [side, top, top]; });
    this.ready = true; return true;
  },
  stack(amount) { // a chip stack for an amount, biggest chips at the bottom
    const g = new THREE.Group(); let rem = amount, n = 0;
    for (let di = DEN.length - 1; di >= 0; di--) while (rem >= DEN[di] && n < 30) { const m = new THREE.Mesh(this.chipGeo, this.chipMats[di]); m.position.y = CHIP_H * (n + 0.5); m.rotation.y = Math.random() * 6; m.castShadow = true; g.add(m); rem -= DEN[di]; n++; }
    g.userData.amount = amount; return g;
  },
  enter(kind, roomId) {
    if (!this.init()) { toast('3D graphics are unavailable', 2000); return; }
    const d = Career.load(); this.room = roomById(roomId); const lim = TABLE_LIMITS[this.room.id];
    if (d.bankroll < lim[0]) { toast('Not enough in your bankroll', 2000); return; }
    if (S.heroReject) { const rj = S.heroReject; S.heroResolve = S.heroReject = null; try { rj(ABORT); } catch (e) {} }
    autoCashOutSaved(); clearSave(); S.started = false; RUN++; Clock.stop(); Voice.stop();
    ['lobby', 'startScreen', 'endScreen', 'menuScreen'].forEach(closeOverlay); unlockAudio();
    applyTheme(this.room);
    this.leaveAll(); this.active = kind; this.chip = 0; d.visited[this.room.id] = true; Career.save();
    document.body.classList.add('in-casino'); $('#cUI').hidden = false; $('#cdock').hidden = false;
    $('#cUI').dataset.kind = kind; $('#cdock').dataset.kind = kind;
    syncLeaveLabel();
    (kind === 'bj' ? BJ : RL).build();
    this.resize(); this.renderTop();
  },
  exit() {
    if (!this.active) return;
    (this.active === 'bj' ? BJ : RL).teardown();
    this.active = null; document.body.classList.remove('in-casino'); $('#cUI').hidden = true; $('#cdock').hidden = true;
    syncLeaveLabel(); showStart(); openLobby();
  },
  leaveAll() { for (const g of [BJ, RL]) if (g.built) g.teardown(); },
  renderTop() {
    if (!this.active) return;
    $('#blinds').textContent = this.active === 'bj' ? 'Blackjack' : 'Roulette';
    const lim = TABLE_LIMITS[this.room.id];
    $('#substatus').textContent = `${this.room.place} · ${money(lim[0])}–${money(lim[1])} · Bankroll ${money(Career.load().bankroll)}`;
  },
  resize() {
    if (!this.active || !this.cam) return;
    this.cam.aspect = G.W / Math.max(1, G.H); this.cam.updateProjectionMatrix();
    (this.active === 'bj' ? BJ : RL).frameCam();
  },
  proj(v) { const p = v.clone().project(this.cam); return { x: (p.x + 1) / 2 * G.W, y: (1 - p.y) / 2 * G.H }; },
  frame(now) {
    const t = now / 1000, dt = Math.min(0.05, this.lastT ? t - this.lastT : 0.016); this.lastT = t;
    stepAnims(now);
    for (const p of this.people) p.update(dt, t);
    (this.active === 'bj' ? BJ : RL).tick(dt, t);
    renderer.render(this.sc, this.cam);
  },
  bubble(text, who) {
    const b = $('#cBubble'); if (!who) return;
    b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), clamp(1600 + text.length * 50, 2200, 4000));
    who.talk(clamp(0.4 + text.length * 0.05, 0.6, 2.4)); Sound.pop();
  },
  placeBubble(who) { if (!who) return; const p = this.proj(who.headTopWorld(new V3())); $('#cBubble').style.transform = `translate(${p.x.toFixed(1)}px, ${Math.max(16, p.y).toFixed(1)}px)`; },
  chips() { return TABLE_LIMITS[this.room.id][2]; },
  renderChips(onPick) {
    const row = $('#cChips'); row.innerHTML = '';
    this.chips().forEach((v, k) => { const b = document.createElement('button'); b.className = 'cchip' + (k === this.chip ? ' on' : ''); b.dataset.d = DEN.indexOf(v) >= 0 ? DEN.indexOf(v) : 6; b.textContent = v >= 1000 ? (v / 1000) + 'K' : v; b.addEventListener('click', () => { this.chip = k; Sound.tick(); this.renderChips(onPick); if (onPick) onPick(); }); row.appendChild(b); });
  },
  standDealer(look, x, z, yaw = 0) {
    const p = new Person(look, look === 'croupierF' ? 23 : 7, false);
    p.root.position.set(x, 0.3, z); p.root.rotation.y = yaw; p.rest[0].set(0.15, -0.28, 0.3); p.rest[1].set(-0.15, -0.28, 0.3); p.handC[0].copy(p.rest[0]); p.handC[1].copy(p.rest[1]);
    this.sc.add(p.root); this.people.push(p); return p;
  },
  dropPeople() { for (const p of this.people) { this.sc.remove(p.root); p.dispose(); } this.people = []; },
};

/* ---------- Blackjack ---------- */
const BJ = {
  built: false, grp: null, shoe: [], cards: [], dealer: null, phase: 'bet', bet: 0, lastBet: 0, hands: [], dHand: [], cur: 0, betStack: null,
  SHOE_POS: new V3(0.56, 0.06, -0.4), DISCARD: new V3(-0.6, 0.03, -0.38), CIRCLE: new V3(0, 0, 0.32),
  build() {
    const sc = Casino.sc, g = new THREE.Group(); this.grp = g; sc.add(g);
    const R = 1.05, Z0 = -0.5;
    const shape = new THREE.Shape(); shape.moveTo(-R, 0); shape.absarc(0, 0, R, Math.PI, 0, true); shape.lineTo(-R, 0);
    // felt
    const fGeo = new THREE.ShapeGeometry(shape, 48); fGeo.rotateX(Math.PI / 2); fGeo.translate(0, 0, Z0);
    this.feltMat = new THREE.MeshStandardMaterial({ map: this.feltTex(R), roughness: 0.94, bumpMap: TEX.feltBump, bumpScale: 0.3, side: THREE.DoubleSide });
    // UVs: map table plane x/z to the felt canvas
    const pos = fGeo.attributes.position, uv = fGeo.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + R) / (2 * R), 1 - (pos.getZ(i) - Z0) / R);
    const felt = new THREE.Mesh(fGeo, this.feltMat); felt.receiveShadow = true; g.add(felt);
    // padded rail along the curve, wooden edge along the dealer side
    const rs = new THREE.Shape(); rs.moveTo(-R - 0.1, 0); rs.absarc(0, 0, R + 0.1, Math.PI, 0, true); rs.lineTo(R, 0); rs.absarc(0, 0, R, 0, Math.PI, false); rs.lineTo(-R - 0.1, 0);
    const rGeo = new THREE.ExtrudeGeometry(rs, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 4, curveSegments: 48 });
    rGeo.rotateX(Math.PI / 2); rGeo.translate(0, 0.07, Z0);
    const rail = new THREE.Mesh(rGeo, MAT.rail); rail.castShadow = rail.receiveShadow = true; g.add(rail);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(2 * R + 0.2, 0.05, 0.08), MAT.wood); edge.position.set(0, 0.02, Z0 - 0.04); edge.castShadow = true; g.add(edge);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.08, R + 0.08, 0.7, 48, 1, false, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1a0f0b, roughness: 0.6 })); body.position.set(0, -0.38, Z0); g.add(body);
    // chip tray and shoe
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.025, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.5 })); tray.position.set(0, 0.014, Z0 + 0.08); g.add(tray);
    for (let k = 0; k < 8; k++) { const st = Casino.stack([5, 25, 100, 500][k % 4] * 6); st.position.set(-0.26 + k * 0.074, 0.026, Z0 + 0.08); st.rotation.z = Math.PI / 2; st.scale.setScalar(0.9); g.add(st); }
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.26), new THREE.MeshStandardMaterial({ color: 0x0f1012, roughness: 0.35, metalness: 0.2 })); shoe.position.set(0.56, 0.045, -0.36); shoe.rotation.y = -0.35; shoe.castShadow = true; g.add(shoe);
    this.dealer = Casino.standDealer('croupier', 0, -0.86, 0);
    this.shuffle(true); this.phase = 'bet'; this.bet = 0; this.hands = []; this.dHand = [];
    this.built = true; this.ui(); setTimeout(() => this.say('Place your bets, please.'), 600);
  },
  teardown() { this.clearCards(); if (this.betStack) this.grp.remove(this.betStack); Casino.sc.remove(this.grp); Casino.dropPeople(); this.built = false; this.dealer = null; $('#cLabels').innerHTML = ''; },
  feltTex(R) {
    const W = 2048, H = 1024, [cv, x] = mkCanvas(W, H), T = THEME;
    const g = x.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.6); g.addColorStop(0, T.felt[0]); g.addColorStop(0.55, T.felt[1]); g.addColorStop(1, T.felt[2]);
    x.fillStyle = g; x.fillRect(0, 0, W, H); grain(x, W, H, 12);
    const cx = W / 2, cy = 0, s = W / (2 * R);
    x.strokeStyle = 'rgba(232,200,130,.55)'; x.lineWidth = 6;
    x.beginPath(); x.arc(cx, cy, 0.62 * s, 0.12 * Math.PI, 0.88 * Math.PI); x.stroke();
    x.beginPath(); x.arc(cx, cy, 0.48 * s, 0.12 * Math.PI, 0.88 * Math.PI); x.stroke();
    const arcText = (txt, r, size, col) => { x.save(); x.fillStyle = col; x.font = `700 ${size}px "Barlow Condensed", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; const ang = (x.measureText(txt).width + txt.length * 4) / r; let a = Math.PI / 2 + ang / 2; for (const ch of txt) { const w = x.measureText(ch).width + 4; a -= w / r / 2; x.save(); x.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.rotate(a - Math.PI / 2); x.fillText(ch, 0, 0); x.restore(); a -= w / r / 2; } x.restore(); };
    arcText('BLACKJACK PAYS 3 TO 2', 0.55 * s, 54, 'rgba(240,214,150,.92)');
    arcText('DEALER MUST STAND ON ALL 17s', 0.42 * s, 34, 'rgba(240,214,150,.7)');
    // your betting circle
    x.lineWidth = 7; x.strokeStyle = 'rgba(240,214,150,.85)'; x.beginPath(); x.arc(cx, cy + 0.82 * s, 0.075 * s, 0, Math.PI * 2); x.stroke();
    x.font = `600 ${0.03 * s}px "Barlow Condensed", sans-serif`; x.fillStyle = 'rgba(240,214,150,.55)'; x.textAlign = 'center'; x.fillText(T.logo, cx, 0.16 * s);
    return canvasTex(cv);
  },
  frameCam() {
    const c = Casino.cam, port = G.H > G.W * 1.1;
    c.clearViewOffset();
    if (port) { c.fov = 44; c.position.set(0, 2.45, 1.8); c.lookAt(0, -0.12, -0.06); c.setViewOffset(G.W, G.H, 0, -G.H * 0.1, G.W, G.H); }
    else { c.fov = 38; c.position.set(0, 1.75, 2.05); c.lookAt(0, 0.16, -0.3); }
    c.updateProjectionMatrix();
  },
  shuffle(silent) {
    const s = []; for (let d = 0; d < 6; d++) for (let c = 0; c < 52; c++) s.push(c);
    for (let i = s.length - 1; i > 0; i--) { const j = secureInt(i + 1); [s[i], s[j]] = [s[j], s[i]]; }
    this.shoe = s; this.cut = Math.floor(s.length * 0.25);
    if (!silent) { this.say('Shuffling a new shoe.'); Sound.slide(); }
  },
  draw() { return this.shoe.pop(); },
  val(cards) { let t = 0, a = 0; for (const c of cards) { const r = rankOf(c); if (r === 14) { a++; t += 11; } else t += Math.min(10, r); } while (t > 21 && a) { t -= 10; a--; } return { t, soft: a > 0 }; },
  isBJ(cards) { return cards.length === 2 && this.val(cards).t === 21; },
  say(text) { if (this.dealer) Casino.bubble(text, this.dealer); },
  handPos(hi, k) { const n = this.hands.length, bx = n > 1 ? (hi ? 0.22 : -0.22) : 0; return new V3(bx + k * 0.062, 0.002 + k * 0.0012, 0.16 - k * 0.028); },
  dPos(k) { return new V3(-0.06 + k * 0.125, 0.002, -0.24); },
  async deal(to, up, i, k) {
    const c = this.draw(), dst = to === 'd' ? this.dPos(k) : this.handPos(i, k);
    const card = new CCard(c, this.SHOE_POS.clone(), false); card.g.rotation.y = -0.35; this.cards.push(card);
    if (this.dealer) this.dealer.gesture('reach', 0.5, { world: dst, side: 1 });
    Sound.card(); await card.to(dst, { up, dur: 380 }); if (up) Sound.flip();
    if (to === 'd') this.dHand.push(c), this.dCards.push(card); else this.hands[i].cards.push(c), this.hands[i].cc.push(card);
    this.labels(); return card;
  },
  clearCards() { for (const c of this.cards) c.dispose(); this.cards = []; },
  async gather() {
    const cs = this.cards.slice(); if (!cs.length) return; Sound.slide();
    if (this.dealer) this.dealer.gesture('sweep', 0.8);
    await Promise.all(cs.map((c, k) => c.to(this.DISCARD, { up: false, dur: 380, delay: k * 18, arc: 0.03 })));
    this.clearCards();
  },
  addBet() {
    if (this.phase !== 'bet') return;
    const v = Casino.chips()[Casino.chip], lim = TABLE_LIMITS[Casino.room.id], bank = Career.load().bankroll;
    if (this.bet + v > lim[1]) { toast(`Table maximum is ${money(lim[1])}`, 1600); return; }
    if (this.bet + v > bank) { toast('Not enough in your bankroll', 1600); return; }
    this.bet += v; Sound.chips(1, 0.6); this.showBet(); this.ui();
  },
  showBet() {
    if (this.betStack) this.grp.remove(this.betStack); this.betStack = null;
    const total = this.hands.length ? this.hands.reduce((a, h) => a + h.bet, 0) : this.bet; if (!total) return;
    const g = new THREE.Group();
    if (this.hands.length > 1) this.hands.forEach((h, i) => { const st = Casino.stack(h.bet); st.position.set(i ? 0.22 : -0.22, 0, this.CIRCLE.z); g.add(st); });
    else { const st = Casino.stack(total); st.position.copy(this.CIRCLE); g.add(st); }
    this.betStack = g; this.grp.add(g);
  },
  async start() {
    if (this.phase !== 'bet' || !this.bet) return;
    const lim = TABLE_LIMITS[Casino.room.id];
    if (this.bet < lim[0]) { toast(`Table minimum is ${money(lim[0])}`, 1600); return; }
    if (!Career.spend(this.bet)) { toast('Not enough in your bankroll', 1600); return; }
    Casino.renderTop(); this.lastBet = this.bet;
    if (this.shoe.length < this.cut) this.shuffle();
    this.phase = 'deal'; this.ui();
    this.hands = [{ cards: [], cc: [], bet: this.bet, done: false, doubled: false }]; this.dHand = []; this.dCards = []; this.cur = 0;
    await this.deal('p', true, 0, 0); await this.deal('d', true, 0, 0); await this.deal('p', true, 0, 1); this.hole = await this.deal('d', false, 0, 1);
    const up = rankOf(this.dHand[0]), dealerBJ = this.isBJ(this.dHand), heroBJ = this.isBJ(this.hands[0].cards);
    if (heroBJ) Achv.ev('natural'), Achv.unlock('natural');
    if ((up === 14 || up >= 10) && dealerBJ) { await delay(400); this.say('Dealer has blackjack.'); await this.reveal(); return this.settle(); }
    if (heroBJ) { this.say('Blackjack!'); await delay(500); await this.reveal(); return this.settle(); }
    this.phase = 'play'; this.ui(); this.labels();
  },
  can(act) {
    const h = this.hands[this.cur]; if (this.phase !== 'play' || !h) return false;
    const bank = Career.load().bankroll;
    if (act === 'double') return h.cards.length === 2 && bank >= h.bet;
    if (act === 'split') return this.hands.length === 1 && h.cards.length === 2 && Math.min(10, rankOf(h.cards[0]) === 14 ? 11 : rankOf(h.cards[0])) === Math.min(10, rankOf(h.cards[1]) === 14 ? 11 : rankOf(h.cards[1])) && bank >= h.bet;
    return true;
  },
  async act(a) {
    if (!this.can(a) || this.busy) return; this.busy = true;
    const h = this.hands[this.cur];
    try {
      if (a === 'hit') { await this.deal('p', true, this.cur, h.cards.length); const v = this.val(h.cards).t; if (v > 21) { this.say('Bust.'); Sound.lose(); h.done = true; } else if (v === 21) h.done = true; }
      else if (a === 'stand') h.done = true;
      else if (a === 'double') { Career.spend(h.bet); h.bet *= 2; h.doubled = true; this.bet = this.hands.reduce((s, x) => s + x.bet, 0); this.showBet(); Sound.chips(3); await this.deal('p', true, this.cur, h.cards.length); h.done = true; if (this.val(h.cards).t > 21) { this.say('Bust.'); Sound.lose(); } }
      else if (a === 'split') {
        Career.spend(h.bet); const c2 = h.cards.pop(), cc2 = h.cc.pop();
        this.hands.push({ cards: [c2], cc: [cc2], bet: h.bet, done: false, doubled: false, fromAces: rankOf(c2) === 14 }); h.fromAces = rankOf(h.cards[0]) === 14;
        this.showBet(); Sound.chips(3);
        await Promise.all([h.cc[0].to(this.handPos(0, 0), { up: true, dur: 300 }), cc2.to(this.handPos(1, 0), { up: true, dur: 300 })]);
        await this.deal('p', true, 0, 1); await this.deal('p', true, 1, 1);
        if (h.fromAces) { h.done = true; this.hands[1].done = true; }
      }
      Casino.renderTop();
      while (this.cur < this.hands.length && this.hands[this.cur].done) this.cur++;
      if (this.cur >= this.hands.length) await this.dealerPlay();
    } finally { this.busy = false; this.ui(); this.labels(); }
  },
  async reveal() { if (this.hole && !this.hole.up) { if (this.dealer) this.dealer.gesture('place', 0.5, { world: this.dPos(1) }); await this.hole.to(this.dPos(1), { up: true, dur: 340, arc: 0.02 }); Sound.flip(); this.labels(); } },
  async dealerPlay() {
    this.phase = 'dealer'; this.ui();
    await this.reveal();
    const live = this.hands.some(h => this.val(h.cards).t <= 21);
    while (live) { const v = this.val(this.dHand); if (v.t >= 17) break; await delay(350); await this.deal('d', true, 0, this.dHand.length); }
    const dv = this.val(this.dHand).t;
    this.say(dv > 21 ? 'Dealer busts.' : `Dealer has ${dv}.`);
    await delay(500); return this.settle();
  },
  async settle() {
    this.phase = 'done'; this.ui();
    const dv = this.val(this.dHand).t, dBJ = this.isBJ(this.dHand); let back = 0, wins = 0, losses = 0;
    for (const h of this.hands) {
      const v = this.val(h.cards).t, bj = this.isBJ(h.cards) && this.hands.length === 1;
      let res;
      if (v > 21) res = 'lose'; else if (bj && !dBJ) res = 'bj'; else if (dBJ && !bj) res = 'lose'; else if (dv > 21 || v > dv) res = 'win'; else if (v === dv) res = 'push'; else res = 'lose';
      h.res = res;
      if (res === 'bj') back += h.bet * 2.5; else if (res === 'win') back += h.bet * 2; else if (res === 'push') back += h.bet;
      if (res === 'win' || res === 'bj') { wins++; Achv.ev('bjWin'); if (Achv.count('bjWins') >= 10) Achv.unlock('bj10'); if (h.doubled) Achv.unlock('double'); } else if (res === 'lose') losses++;
    }
    this.labels(true);
    if (back > 0) { Career.add(Math.round(back)); if (wins) Sound.win(); }
    else Sound.lose();
    const net = back - this.hands.reduce((s, h) => s + h.bet, 0);
    showResult(net > 0 ? `You win ${money(net)}` : net === 0 ? 'Push' : `You lose ${money(-net)}`, net > 0 ? 'win' : net === 0 ? 'push' : 'lose');
    Casino.renderTop();
    // chips: winners slide to you, losers go to the tray
    if (this.betStack) { const st = this.betStack, to = net >= 0 ? new V3(0, 0, 0.7) : new V3(0, 0.02, -0.74); this.betStack = null; await animate(520, e => st.position.lerpVectors(new V3(), to, e), easeInOut); this.grp.remove(st); }
    await delay(900);
    await this.gather();
    this.hands = []; this.dHand = []; this.bet = 0; this.phase = 'bet'; this.labels(); this.ui();
    if (Career.load().bankroll < TABLE_LIMITS[Casino.room.id][0]) toast('Your bankroll is below the table minimum', 2600);
  },
  labels(final) {
    const L = $('#cLabels'); L.innerHTML = '';
    const mk = (pos, txt, cls) => { const p = Casino.proj(pos); const d = document.createElement('div'); d.className = 'clabel ' + (cls || ''); d.textContent = txt; d.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`; L.appendChild(d); };
    if (this.dHand.length) { const v = this.val(this.hole && !this.hole.up ? this.dHand.slice(0, 1) : this.dHand); mk(new V3(0.06, 0, -0.42), v.t > 21 ? 'Bust' : this.isBJ(this.dHand) && (!this.hole || this.hole.up) ? 'Blackjack' : (v.soft && v.t < 21 ? 'Soft ' : '') + v.t, v.t > 21 ? 'bust' : ''); }
    this.hands.forEach((h, i) => {
      if (!h.cards.length) return; const v = this.val(h.cards), p = this.handPos(i, 0); p.z += 0.2;
      const res = final && h.res ? { win: 'Win', bj: 'Blackjack!', push: 'Push', lose: v.t > 21 ? 'Bust' : 'Lose' }[h.res] : null;
      mk(p, res || (v.t > 21 ? 'Bust' : this.isBJ(h.cards) && this.hands.length === 1 ? 'Blackjack' : (v.soft && v.t < 21 ? 'Soft ' : '') + v.t), (res ? h.res : v.t > 21 ? 'bust' : '') + (this.phase === 'play' && i === this.cur && this.hands.length > 1 ? ' cur' : ''));
    });
  },
  ui() {
    const dock = $('#cdock'), ph = this.phase, bank = Career.load().bankroll;
    $('#cInfo').textContent = ph === 'bet' ? (this.bet ? `Bet ${money(this.bet)} · tap chips to add` : 'Tap a chip to bet') : ph === 'play' ? `Your move${this.hands.length > 1 ? ` · hand ${this.cur + 1} of 2` : ''} · bet ${money(this.hands.reduce((s, h) => s + h.bet, 0))}` : ph === 'dealer' ? "Dealer's turn" : ph === 'deal' ? 'Dealing…' : '';
    Casino.renderChips(() => this.addBet());
    $('#cChipsRow').hidden = ph !== 'bet';
    const acts = $('#cActs'); acts.innerHTML = '';
    const btn = (label, cls, fn, dis) => { const b = document.createElement('button'); b.className = 'act ' + cls; b.textContent = label; b.disabled = !!dis; b.addEventListener('click', fn); acts.appendChild(b); };
    if (ph === 'bet') {
      btn('Clear', 'fold', () => { this.bet = 0; this.showBet(); this.ui(); Sound.tick(); }, !this.bet);
      btn(this.lastBet ? `Rebet ${money(this.lastBet)}` : 'Rebet', 'call', () => { const lim = TABLE_LIMITS[Casino.room.id]; this.bet = Math.min(this.lastBet, bank, lim[1]); this.showBet(); this.ui(); Sound.chips(2); }, !this.lastBet || this.bet);
      btn('Deal', 'raise', () => this.start(), !this.bet);
    } else if (ph === 'play') {
      btn('Hit', 'call', () => this.act('hit')); btn('Stand', 'fold', () => this.act('stand'));
      if (this.can('split')) btn('Split', 'call', () => this.act('split'));
      btn('Double', 'raise', () => this.act('double'), !this.can('double'));
    } else btn('…', 'call', () => {}, true);
  },
  tick() { if (this.dealer) Casino.placeBubble(this.dealer); },
};
document.addEventListener('keydown', e => {
  if (Casino.active !== 'bj' || e.target.closest('input')) return;
  const k = e.key.toLowerCase();
  if (k === 'h') BJ.act('hit'); else if (k === 's') BJ.act('stand'); else if (k === 'd' && BJ.phase === 'play') BJ.act('double'); else if (k === 'p') BJ.act('split'); else if ((k === 'enter' || k === ' ') && BJ.phase === 'bet') BJ.start();
});
function showResult(text, kind) { const r = $('#cResult'); r.textContent = text; r.className = 'show ' + kind; clearTimeout(r._t); r._t = setTimeout(() => r.className = '', 1900); }

/* ---------- Roulette (single zero) ---------- */
const RL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RL_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const rlColor = n => n === 0 ? 'green' : RL_RED.has(n) ? 'red' : 'black';
const TAU = Math.PI * 2, POCKET = TAU / 37;
const RL = {
  built: false, grp: null, rotor: null, ball: null, beta: 0, omega: 0.45, phase: 'bet', bets: {}, lastBets: null, history: [], spin: null, croupier: null, lock: 0,
  W0: new V3(0, 0, -0.02),
  build() {
    const g = new THREE.Group(); this.grp = g; Casino.sc.add(g);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.06, 56), MAT.wood); top.position.set(0, -0.03, this.W0.z); top.receiveShadow = true; g.add(top);
    const felt = new THREE.Mesh(new THREE.CylinderGeometry(0.69, 0.69, 0.004, 56), new THREE.MeshStandardMaterial({ color: THEME.felt[1], roughness: 0.95 })); felt.position.set(0, 0.002, this.W0.z); felt.receiveShadow = true; g.add(felt);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.72, 24), new THREE.MeshStandardMaterial({ color: 0x1a0f0b, roughness: 0.6 })); leg.position.set(0, -0.42, this.W0.z); g.add(leg);
    const V2 = a => a.map(([x, y]) => new THREE.Vector2(x, y));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(V2([[0.36, 0.02], [0.4, 0.034], [0.47, 0.074], [0.5, 0.085], [0.53, 0.08], [0.54, 0.05], [0.54, 0.0]]), 72), MAT.wood); bowl.position.copy(this.W0); bowl.castShadow = bowl.receiveShadow = true; g.add(bowl);
    const track = new THREE.Mesh(new THREE.LatheGeometry(V2([[0.395, 0.033], [0.435, 0.052], [0.472, 0.075]]), 72), new THREE.MeshStandardMaterial({ color: 0xd9cbb0, roughness: 0.22, metalness: 0.1 })); track.position.copy(this.W0); track.position.y += 0.001; g.add(track);
    const rotor = new THREE.Group(); rotor.position.copy(this.W0); g.add(rotor); this.rotor = rotor;
    this.discMat = new THREE.MeshStandardMaterial({ map: this.wheelTex(), roughness: 0.35, metalness: 0.05 });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.37, 74).rotateX(-Math.PI / 2), this.discMat); disc.position.y = 0.022; disc.receiveShadow = true; rotor.add(disc);
    const brass = new THREE.MeshStandardMaterial({ color: 0xd8c08a, roughness: 0.25, metalness: 0.85 });
    const fretGeo = new THREE.BoxGeometry(0.075, 0.012, 0.003);
    for (let k = 0; k < 37; k++) { const a = (k + 0.5) * POCKET, f = new THREE.Mesh(fretGeo, brass); f.position.set(Math.cos(a) * 0.272, 0.029, -Math.sin(a) * 0.272); f.rotation.y = a; rotor.add(f); }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.065, 48), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.3, metalness: 0.15 })); cone.position.y = 0.054; rotor.add(cone);
    const tur = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.026, 0.085, 16), brass); tur.position.y = 0.11; rotor.add(tur);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.15, 8), brass); arm.rotation.set(0, a, Math.PI / 2); arm.position.y = 0.135; rotor.add(arm);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), brass); knob.position.set(Math.cos(a) * 0.075, 0.135, -Math.sin(a) * 0.075); rotor.add(knob);
    }
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.013, 18, 12), new THREE.MeshStandardMaterial({ color: 0xfaf8f2, roughness: 0.12, metalness: 0.05 })); this.ball.castShadow = true; g.add(this.ball);
    this.lock = RL_ORDER.indexOf(this.history[0] ?? 0);
    this.croupier = Casino.standDealer('croupierF', 0, -0.72, 0);
    this.phase = 'bet'; this.bets = {}; this.built = true; this.buildBoard(); this.ui(); this.renderHistory();
    setTimeout(() => this.say('Place your bets.'), 600);
  },
  teardown() { this.stopRoll(); Casino.sc.remove(this.grp); Casino.dropPeople(); this.built = false; this.croupier = null; this.spin = null; $('#rlBoard').innerHTML = ''; },
  wheelTex() {
    const N = 1024, [cv, x] = mkCanvas(N, N), c = N / 2, s = c / 0.37;
    x.fillStyle = '#3a2414'; x.beginPath(); x.arc(c, c, c, 0, TAU); x.fill();
    for (let k = 0; k < 37; k++) {
      const n = RL_ORDER[k], a0 = -(k + 0.5) * POCKET, a1 = -(k - 0.5) * POCKET, col = n === 0 ? '#1f8a4c' : RL_RED.has(n) ? '#b3202a' : '#141414';
      x.fillStyle = col; x.beginPath(); x.arc(c, c, 0.37 * s, a0, a1); x.arc(c, c, 0.2 * s, a1, a0, true); x.closePath(); x.fill();
      x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.arc(c, c, 0.31 * s, a0, a1); x.arc(c, c, 0.2 * s, a1, a0, true); x.closePath(); x.fill();
      const am = -k * POCKET; x.save(); x.translate(c + Math.cos(am) * 0.34 * s, c + Math.sin(am) * 0.34 * s); x.rotate(am + Math.PI / 2);
      x.fillStyle = '#f4ead2'; x.font = `700 ${0.034 * s}px "Barlow Condensed", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 0, 0); x.restore();
    }
    x.strokeStyle = '#d8c08a'; x.lineWidth = 0.006 * s; for (const r of [0.2, 0.31, 0.37]) { x.beginPath(); x.arc(c, c, r * s - 2, 0, TAU); x.stroke(); }
    return canvasTex(cv);
  },
  frameCam() {
    const cm = Casino.cam, port = G.H > G.W * 1.05;
    cm.clearViewOffset();
    const k = Math.max(1, (G.H / G.W) / 1.6); // tall phones need a little more distance
    if (port) { cm.fov = 38; cm.position.set(0, 3.5 * k, 3.1 * k); cm.lookAt(0, 0.22, -0.38); cm.setViewOffset(G.W, G.H, 0, G.H * 0.27, G.W, G.H); }
    else { cm.fov = 38; cm.position.set(0, 2.25, 1.85); cm.lookAt(0, 0.12, -0.3); cm.setViewOffset(G.W, G.H, G.W * 0.23, -G.H * 0.04, G.W, G.H); }
    cm.updateProjectionMatrix();
  },
  say(text) { if (this.croupier) Casino.bubble(text, this.croupier); },
  ballAt(a, r, y) { this.ball.position.set(this.W0.x + Math.cos(a) * r, this.W0.y + y, this.W0.z - Math.sin(a) * r); },
  trackY: r => 0.033 + (r - 0.395) * (0.042 / 0.077) + 0.013,
  tick(dt, t) {
    if (!this.built) return;
    this.omega += ((this.spin ? 1.25 : 0.42) - this.omega) * Math.min(1, dt * 0.7);
    this.beta += this.omega * dt; this.rotor.rotation.y = this.beta;
    const sp = this.spin;
    if (!sp) { this.ballAt(this.beta + this.lock * POCKET, 0.285, 0.036); }
    else {
      const e = Math.max(0, t - sp.t0), tau = 2.3, free = sp.a0 + sp.w0 * tau * (1 - Math.exp(-e / tau));
      if (e < sp.T1) { const r = 0.452 - 0.012 * (e / sp.T1); this.ballAt(free, r, this.trackY(r)); this.roll(1 - e / (sp.T1 * 1.35)); }
      else if (e < sp.T1 + sp.T2) {
        const u = (e - sp.T1) / sp.T2, tgt = this.beta + sp.k * POCKET;
        if (sp.n == null) sp.n = Math.floor((free - tgt) / TAU);
        const sm = u * u * (3 - 2 * u), a = lerp(free, tgt + TAU * sp.n, sm);
        const bounce = Math.abs(Math.sin(u * 16)) * (1 - u) ** 1.5;
        const r = lerp(0.44, 0.285, Math.min(1, u * 1.25)) + bounce * 0.025, y = lerp(this.trackY(0.44), 0.036, Math.min(1, u * 1.3)) + bounce * 0.016;
        this.ballAt(a, r, y); this.roll(0.25 * (1 - u));
        const ph = Math.floor(u * 16 / Math.PI); if (ph !== sp.lastPh) { sp.lastPh = ph; if (u < 0.85) Sound.knock(); }
      } else { this.spin = null; this.lock = sp.k; this.stopRoll(); this.result(sp.res); }
    }
    if (this.croupier) Casino.placeBubble(this.croupier);
  },
  /* rolling sound: filtered noise whose pitch falls as the ball slows */
  roll(v) {
    const c = Sound.ctx; if (!c || !Sound.on) return;
    if (!this.rollSrc) {
      const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = nb; s.loop = true; f.type = 'bandpass'; f.Q.value = 1.4; g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(Sound.master); s.start(); this.rollSrc = { s, f, g };
    }
    const v2 = clamp(v, 0, 1); this.rollSrc.f.frequency.setTargetAtTime(900 + 2200 * v2, c.currentTime, 0.1); this.rollSrc.g.gain.setTargetAtTime(0.02 + 0.07 * v2, c.currentTime, 0.1);
  },
  stopRoll() { if (this.rollSrc) { const r = this.rollSrc, c = Sound.ctx; r.g.gain.setTargetAtTime(0, c.currentTime, 0.08); setTimeout(() => { try { r.s.stop(); } catch (e) {} }, 400); this.rollSrc = null; } },
  total() { return Object.values(this.bets).reduce((a, b) => a + b, 0); },
  addBet(key) {
    if (this.phase !== 'bet') return;
    const v = Casino.chips()[Casino.chip], lim = TABLE_LIMITS[Casino.room.id], bank = Career.load().bankroll;
    if (this.total() + v > lim[1]) { toast(`Table maximum is ${money(lim[1])}`, 1500); return; }
    if (this.total() + v > bank) { toast('Not enough in your bankroll', 1500); return; }
    this.bets[key] = (this.bets[key] || 0) + v; this.undo = (this.undo || []).concat([[key, v]]);
    Sound.chips(1, 0.55); this.renderBets(); this.ui();
  },
  wins(key, n) {
    if (key[0] === 'n') return +key.slice(1) === n;
    if (n === 0) return false;
    return { red: RL_RED.has(n), black: !RL_RED.has(n), odd: n % 2 === 1, even: n % 2 === 0, low: n <= 18, high: n >= 19, d1: n <= 12, d2: n >= 13 && n <= 24, d3: n >= 25, c1: n % 3 === 1, c2: n % 3 === 2, c3: n % 3 === 0 }[key];
  },
  mult: key => key[0] === 'n' ? 35 : (key[0] === 'd' || key[0] === 'c') ? 2 : 1,
  go() {
    if (this.phase !== 'bet') return;
    const tot = this.total(), lim = TABLE_LIMITS[Casino.room.id];
    if (!tot) return; if (tot < lim[0]) { toast(`Table minimum is ${money(lim[0])}`, 1500); return; }
    if (!Career.spend(tot)) { toast('Not enough in your bankroll', 1500); return; }
    Casino.renderTop(); this.lastBets = { ...this.bets }; this.phase = 'spin'; this.undo = [];
    const res = secureInt(37), k = RL_ORDER.indexOf(res), now = performance.now() / 1000;
    this.spin = { t0: now + 0.45, res, k, a0: this.beta + this.lock * POCKET, w0: -(10.5 + Math.random() * 2.5), T1: 3.4 + Math.random() * 0.7, T2: 1.9 };
    if (this.croupier) this.croupier.gesture('reach', 0.9, { world: new V3(0.36, 0.06, this.W0.z + 0.3), side: 1 });
    Sound.slide(); setTimeout(() => { if (this.phase === 'spin') this.say('No more bets.'); }, 1700);
    this.ui();
  },
  result(n) {
    this.phase = 'result'; this.history.unshift(n); this.history = this.history.slice(0, 14); this.renderHistory();
    let back = 0, straight = false;
    for (const [key, amt] of Object.entries(this.bets)) if (this.wins(key, n)) { back += amt * (this.mult(key) + 1); if (key[0] === 'n') straight = true; }
    const tot = this.total(), net = back - tot;
    this.say(`${n}, ${rlColor(n)}.`);
    document.querySelectorAll('#rlBoard [data-k]').forEach(el => { const k = el.dataset.k; el.classList.toggle('hit', k === 'n' + n); el.classList.toggle('won', !!this.bets[k] && this.wins(k, n)); el.classList.toggle('lost', !!this.bets[k] && !this.wins(k, n)); });
    if (back > 0) { Career.add(back); Sound.win(); Achv.ev('rlWin', { straight }); if (straight) Achv.unlock('straight'); if (net >= 1000) Achv.unlock('spin1k'); }
    else Sound.lose();
    showResult(`${n} ${rlColor(n)} · ${net > 0 ? 'you win ' + money(net) : net === 0 ? 'you break even' : 'you lose ' + money(-net)}`, net > 0 ? 'win' : net === 0 ? 'push' : 'lose');
    Casino.renderTop();
    setTimeout(() => {
      if (!this.built) return;
      this.bets = {}; this.phase = 'bet'; this.renderBets(); this.ui();
      document.querySelectorAll('#rlBoard [data-k]').forEach(el => el.classList.remove('won', 'lost'));
      setTimeout(() => document.querySelectorAll('#rlBoard .hit').forEach(el => el.classList.remove('hit')), 2500);
      this.say('Place your bets.');
    }, 2800);
  },
  buildBoard() {
    const b = $('#rlBoard'); b.innerHTML = '';
    const cell = (k, label, cls, col, row) => { const d = document.createElement('button'); d.className = 'rc ' + (cls || ''); d.dataset.k = k; d.style.gridColumn = col; d.style.gridRow = row; d.innerHTML = `<span>${label}</span>`; d.addEventListener('click', () => this.addBet(k)); b.appendChild(d); };
    cell('n0', '0', 'green', '3 / 6', '1');
    for (let r = 0; r < 12; r++) for (let c = 0; c < 3; c++) { const n = r * 3 + c + 1; cell('n' + n, String(n), rlColor(n), String(c + 3), String(r + 2)); }
    cell('d1', '1st 12', 'out', '2', '2 / 6'); cell('d2', '2nd 12', 'out', '2', '6 / 10'); cell('d3', '3rd 12', 'out', '2', '10 / 14');
    [['low', '1–18'], ['even', 'Even'], ['red', '<i class="dia red"></i>'], ['black', '<i class="dia black"></i>'], ['odd', 'Odd'], ['high', '19–36']].forEach(([k, l], i) => cell(k, l, 'out', '1', `${2 + i * 2} / ${4 + i * 2}`));
    ['c1', 'c2', 'c3'].forEach((k, i) => cell(k, '2:1', 'out', String(i + 3), '14'));
    this.renderBets();
  },
  renderBets() {
    document.querySelectorAll('#rlBoard [data-k]').forEach(el => {
      const v = this.bets[el.dataset.k]; let ch = el.querySelector('.bchip');
      if (v) { if (!ch) { ch = document.createElement('b'); ch.className = 'bchip'; el.appendChild(ch); } ch.textContent = v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'K' : v; }
      else if (ch) ch.remove();
    });
  },
  renderHistory() { $('#rlHist').innerHTML = this.history.map((n, i) => `<i class="${rlColor(n)}${i === 0 ? ' last' : ''}">${n}</i>`).join(''); },
  ui() {
    const ph = this.phase, tot = this.total();
    $('#cInfo').textContent = ph === 'bet' ? (tot ? `Total bet ${money(tot)} · tap the board to add` : 'Pick a chip, then tap the board') : ph === 'spin' ? 'No more bets' : '';
    Casino.renderChips(); $('#cChipsRow').hidden = ph !== 'bet';
    const acts = $('#cActs'); acts.innerHTML = '';
    const btn = (label, cls, fn, dis) => { const b = document.createElement('button'); b.className = 'act ' + cls; b.textContent = label; b.disabled = !!dis; b.addEventListener('click', fn); acts.appendChild(b); };
    if (ph === 'bet') {
      btn('Undo', 'fold', () => { const u = (this.undo || []).pop(); if (u) { this.bets[u[0]] -= u[1]; if (this.bets[u[0]] <= 0) delete this.bets[u[0]]; this.renderBets(); this.ui(); Sound.tick(); } }, !(this.undo && this.undo.length));
      const lt = this.lastBets ? Object.values(this.lastBets).reduce((a, b) => a + b, 0) : 0;
      btn(lt ? `Rebet ${money(lt)}` : 'Rebet', 'call', () => { if (lt > Career.load().bankroll) { toast('Not enough in your bankroll', 1500); return; } this.bets = { ...this.lastBets }; this.undo = []; this.renderBets(); this.ui(); Sound.chips(3); }, !lt || tot);
      btn('Spin', 'raise', () => this.go(), !tot);
    } else btn(ph === 'spin' ? 'Spinning…' : '…', 'call', () => {}, true);
  },
};

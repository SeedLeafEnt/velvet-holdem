'use strict';
/* Velvet Hold'em: 10-bar.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Stage 2: the bar. Drinks at every seat, a waitress who brings them,
   players who sip between hands, and drinks you can order or send.
   ========================================================= */
const DRINKS = {
  whisky:   { label: 'Whisky', glass: 'tumbler', liquid: '#b56a22', ice: true },
  martini:  { label: 'Martini', glass: 'martini', liquid: '#e9edcf', olive: true },
  beer:     { label: 'Beer', glass: 'pint', liquid: '#e0a128', foam: true },
  mocktail: { label: 'Mocktail', glass: 'highball', liquid: '#e2493c', lime: true },
  water:    { label: 'Sparkling water', glass: 'highball', liquid: '#d6eef6' },
};
const FAV_DRINK = { rock: 'whisky', shark: 'martini', maniac: 'beer', station: 'mocktail', pro: 'water' };
Object.assign(EXTRA_LINES.maniac,  { cheers: ['Ha! Cheers, pal!', "Now we're talking!"], order: ['Another beer over here!'], orderAngry: ['Whisky. Make it a double.'] });
Object.assign(EXTRA_LINES.shark,   { cheers: ['...Thanks.', 'How thoughtful.'], order: ['Another martini, please.'], orderAngry: ['Something stronger. Now.'] });
Object.assign(EXTRA_LINES.rock,    { cheers: ['Much obliged.', '@r_thanks:0'], order: ['Same again.'], orderAngry: ['Leave the bottle.'] });
Object.assign(EXTRA_LINES.station, { cheers: ['Aww, thank you!', 'You\'re so sweet!'], order: ['Ooh, another one of these!'], orderAngry: ['I need a drink!'] });
Object.assign(EXTRA_LINES.pro,     { cheers: ['Cheers.', 'Appreciated.'], order: ['Just water, thanks.'], orderAngry: ['Coffee. Black.'] });
Object.assign(CAT_FACE, { cheers: 'happy', order: 'neutral', orderAngry: 'angry' });

let DGEO = null, DMAT = null;
function initDrinkGeo() {
  if (DGEO) return;
  const lathe = (pts, seg = 22) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  DGEO = {
    tumbler: lathe([[0, 0], [0.027, 0], [0.029, 0.003], [0.031, 0.062], [0.028, 0.062], [0.026, 0.009], [0, 0.009]]),
    martini: lathe([[0, 0], [0.024, 0], [0.024, 0.003], [0.004, 0.006], [0.0035, 0.05], [0.04, 0.09], [0.038, 0.09], [0.003, 0.053], [0, 0.053]]),
    pint: lathe([[0, 0], [0.026, 0], [0.028, 0.004], [0.034, 0.118], [0.031, 0.118], [0.025, 0.01], [0, 0.01]]),
    highball: lathe([[0, 0], [0.024, 0], [0.025, 0.004], [0.026, 0.108], [0.023, 0.108], [0.022, 0.01], [0, 0.01]]),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 20), cone: new THREE.ConeGeometry(1, 1, 20).rotateX(Math.PI).translate(0, 0.5, 0),
    ice: new THREE.BoxGeometry(0.016, 0.014, 0.016), olive: new THREE.SphereGeometry(0.0075, 10, 8), pick: new THREE.CylinderGeometry(0.0012, 0.0012, 0.06, 5),
    lime: new THREE.CylinderGeometry(0.014, 0.014, 0.004, 14, 1, false, 0, Math.PI), straw: new THREE.CylinderGeometry(0.0022, 0.0022, 0.14, 6),
    tray: new THREE.CylinderGeometry(0.1, 0.1, 0.007, 28), trayRim: new THREE.TorusGeometry(0.1, 0.004, 6, 32).rotateX(Math.PI / 2),
  };
  DMAT = {
    glass: new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.24, roughness: 0.04, metalness: 0, envMapIntensity: 1.8, side: THREE.DoubleSide, depthWrite: false }),
    ice: new THREE.MeshStandardMaterial({ color: '#eaf6ff', transparent: true, opacity: 0.55, roughness: 0.1 }),
    olive: new THREE.MeshStandardMaterial({ color: '#6f8a2c', roughness: 0.5 }), pick: new THREE.MeshStandardMaterial({ color: '#c8a35a', roughness: 0.4 }),
    lime: new THREE.MeshStandardMaterial({ color: '#8fc43a', roughness: 0.6 }), straw: new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.5 }),
    foam: new THREE.MeshStandardMaterial({ color: '#fbf6e8', roughness: 0.9 }), tray: new THREE.MeshStandardMaterial({ color: '#c9ccd2', roughness: 0.25, metalness: 0.85 }),
    liquid: {},
  };
  for (const [k, d] of Object.entries(DRINKS)) DMAT.liquid[k] = new THREE.MeshStandardMaterial({ color: d.liquid, transparent: true, opacity: k === 'water' ? 0.45 : 0.86, roughness: 0.12, depthWrite: true });
}
const DRINK_S = 1.5; // real glasses are about twice a chip across
const GLASS_DIM = { tumbler: { r: 0.025, y0: 0.009, h: 0.045 }, pint: { r0: 0.024, r: 0.03, y0: 0.01, h: 0.095 }, highball: { r: 0.022, y0: 0.01, h: 0.085 }, martini: { cone: true, y0: 0.053, h: 0.033, r: 0.035 } };
class Drink {
  constructor(type, level = 1) {
    initDrinkGeo();
    this.type = type; const d = DRINKS[type]; this.g = new THREE.Group(); this.dim = GLASS_DIM[d.glass];
    this.liq = new THREE.Mesh(this.dim.cone ? DGEO.cone : DGEO.cyl, DMAT.liquid[type]); this.g.add(this.liq);
    const gl = new THREE.Mesh(DGEO[d.glass], DMAT.glass); gl.renderOrder = 4; this.g.add(gl);
    this.extras = new THREE.Group(); this.g.add(this.extras);
    if (d.ice) for (let k = 0; k < 2; k++) { const c = new THREE.Mesh(DGEO.ice, DMAT.ice); c.position.set(k ? 0.007 : -0.008, 0, k ? -0.004 : 0.006); c.rotation.set(rand(0, 1), rand(0, 3), rand(0, 1)); this.extras.add(c); }
    if (d.olive) { const o = new THREE.Mesh(DGEO.olive, DMAT.olive); o.position.set(0.004, 0.068, 0); this.g.add(o); const pk = new THREE.Mesh(DGEO.pick, DMAT.pick); pk.position.set(0.008, 0.075, 0); pk.rotation.z = -0.5; this.g.add(pk); }
    if (d.lime) { const l = new THREE.Mesh(DGEO.lime, DMAT.lime); l.position.set(0.02, 0.104, 0); l.rotation.set(0, 0, 1.2); this.g.add(l); }
    if (d.glass === 'highball') { const s = new THREE.Mesh(DGEO.straw, DMAT.straw); s.position.set(-0.008, 0.08, 0.004); s.rotation.set(0.12, 0, 0.18); this.g.add(s); }
    if (d.foam) { this.foam = new THREE.Mesh(DGEO.cyl, DMAT.foam); this.g.add(this.foam); }
    this.g.traverse(o => { o.castShadow = true; });
    this.g.scale.setScalar(DRINK_S); scene.add(this.g); this.setLevel(level);
  }
  setLevel(v) {
    this.level = clamp(v, 0, 1); const D = this.dim, L = Math.max(0.0001, this.level);
    if (D.cone) { const s = Math.cbrt(L); this.liq.scale.set(D.r * s, D.h * s, D.r * s); this.liq.position.y = D.y0; }
    else { const h = D.h * L, r = D.r0 ? lerp(D.r0, D.r, L * 0.8) : D.r; this.liq.scale.set(r, h, r); this.liq.position.y = D.y0 + h / 2; }
    this.liq.visible = this.level > 0.02;
    this.extras.position.y = D.cone ? 0 : D.y0 + Math.max(0.006, D.h * L - 0.004);
    if (this.foam) { const top = D.y0 + D.h * L; this.foam.scale.set(D.r * lerp(0.85, 1, L), 0.008, D.r * lerp(0.85, 1, L)); this.foam.position.y = top + 0.003; this.foam.visible = this.level > 0.04; }
  }
  dispose() { scene.remove(this.g); }
}

/* ---------- Bar manager: drinks per seat, sipping, the waitress ---------- */
const _bv = new V3(), _bw = new V3(), _bq = new THREE.Quaternion();
const WAIT_S = 0.88, WAIT_Y = -0.78 + (0.24 + 0.96) * WAIT_S; // a touch smaller, standing on the floor
const Bar = {
  drinks: [], sips: [], waitress: null, tray: null, queue: [], job: null, nextSip: 4, ready: false,
  init() {
    if (this.ready || typeof scene === "undefined" || !scene) return; initDrinkGeo();
    const w = new Person('waitress', 31, false); scene.add(w.root); this.waitress = w; w.root.visible = false; w.tray = true; w.root.scale.setScalar(WAIT_S);
    w.rest[0].set(0.17, 0.12, 0.22); w.rest[1].set(-0.18, -0.22, 0.05); w.handC[0].copy(w.rest[0]); w.handC[1].copy(w.rest[1]);
    this.tray = new THREE.Group(); const t = new THREE.Mesh(DGEO.tray, DMAT.tray), rim = new THREE.Mesh(DGEO.trayRim, DMAT.tray); this.tray.add(t, rim); t.castShadow = true; scene.add(this.tray); this.tray.visible = false;
    this.ready = true;
  },
  reset() {
    for (const d of this.drinks) if (d) d.dispose();
    this.drinks = []; this.sips = []; this.queue = []; this.job = null;
    if (this.waitress) { this.waitress.root.visible = false; this.tray.visible = false; if (this.carry) { this.carry.dispose(); this.carry = null; } }
  },
  seatOf(i) { return A.seats && A.seats[i]; },
  place(i, type, level = 1) {
    if (!this.ready || S.test) return;
    if (this.drinks[i]) this.drinks[i].dispose();
    const d = new Drink(type, level); this.drinks[i] = d; this.rest(i); return d;
  },
  rest(i) { const d = this.drinks[i], s = this.seatOf(i); if (!d || !s || !s.drink) return; d.g.position.copy(s.drink); d.g.quaternion.identity(); },
  layout() { for (let i = 0; i < NS; i++) if (!this.sips.some(x => x.i === i)) this.rest(i); },
  stock() { // a drink in front of every player as the game starts
    if (!this.ready || S.test) return;
    this.reset();
    for (const p of S.players) if (!p.isHero && !p.out) this.place(p.i, FAV_DRINK[p.persona] || 'water', rand(0.45, 1));
  },
  sip(i) {
    const pp = people[i], d = this.drinks[i]; if (!pp || !d || d.level < 0.05 || pp.gest) return false;
    pp.gesture('sip', 1.9); this.sips.push({ i, t0: performance.now() / 1000, dur: 1.9 * spd(), took: false });
    return true;
  },
  order(i, type, opts = {}) {
    if (!this.ready || S.test) { if (opts.done) opts.done(); return; }
    this.queue.push({ i, type, ...opts });
  },
  update(dt, t) {
    if (!this.ready) return;
    // drinks follow the hand during a sip, and tilt toward the mouth
    for (let k = this.sips.length - 1; k >= 0; k--) {
      const s = this.sips[k], d = this.drinks[s.i], pp = people[s.i], kk = (t - s.t0) / s.dur;
      if (!d || !pp || kk >= 1 || !pp.root.visible) { this.sips.splice(k, 1); if (d) { this.rest(s.i); if (!s.took) d.setLevel(d.level - rand(0.12, 0.2)); this.afterSip(s.i); } continue; }
      const e = smoothEnv(kk, 0.28, 0.28);
      pp.handWorld(1, _bv); _bv.y -= 0.06;
      d.g.position.copy(this.seatOf(s.i).drink).lerp(_bv, e);
      const tilt = Math.max(0, Math.sin(Math.PI * clamp((kk - 0.3) / 0.4, 0, 1))) * 1.1 * e;
      _bw.set(1, 0, 0).applyQuaternion(pp.root.quaternion); _bq.setFromAxisAngle(_bw, -tilt); d.g.quaternion.copy(_bq);
      if (kk > 0.55 && !s.took) { s.took = true; d.setLevel(d.level - rand(0.12, 0.2)); }
    }
    // the odd sip between decisions
    this.nextSip -= dt;
    if (this.nextSip <= 0) {
      this.nextSip = rand(3.5, 7.5);
      const c = shuffled(S.players.filter(p => !p.isHero && !p.out && p.i !== S.toAct && this.drinks[p.i] && this.drinks[p.i].level > 0.05));
      if (c.length) { const p = c[0]; if (this.sip(p.i) && isAngry(p)) this.nextSip *= 0.5; }
    }
    this.walk(dt, t);
  },
  afterSip(i) {
    const d = this.drinks[i], p = S.players[i];
    if (d && p && !p.out && d.level < 0.12 && !this.queue.some(q => q.i === i) && !(this.job && this.job.i === i)) {
      const angry = isAngry(p);
      sayExtra(p, angry ? 'orderAngry' : 'order', 300);
      const type = angry && p.persona !== 'pro' ? 'whisky' : FAV_DRINK[p.persona] || 'water';
      this.order(i, type, { done: () => { if (S.players[i] === p && !p.out) drinkUp(p, type); } });
    }
  },
  /* ---- the waitress walks an oval outside the chairs, never across your side of the room ---- */
  ang(v) { let a = Math.atan2(v.z, v.x) * 180 / Math.PI; return (a + 360) % 360; },
  oval(a, k = 1) { const rx = G.table.W / 2 + (G.portrait ? 0.8 : 0.95), rz = G.table.D / 2 + (G.portrait ? 0.62 : 1.25), r = a * Math.PI / 180; return new V3(Math.cos(r) * rx * k, 0, Math.sin(r) * rz * k); },
  route(target) {
    const ENTRY = 252, ta = this.ang(target);
    // travel the short way round the back (top) of the room, staying clear of the bottom arc where you sit
    let dir = ta > 90 && ta < 252 ? -1 : 1, pts = [this.oval(ENTRY, 1.45), this.oval(ENTRY)];
    let a = ENTRY;
    const goal = dir < 0 ? ta : (ta < 90 ? ta + 360 : ta);
    for (let n = 0; n < 40; n++) { const nxt = a + dir * 18; if ((dir < 0 && nxt <= goal) || (dir > 0 && nxt >= goal)) break; a = nxt; pts.push(this.oval(a % 360)); }
    pts.push(target.clone());
    return pts;
  },
  approach(i) {
    const s = this.seatOf(i);
    if (i === 0) { // she hands it to the dealer, who slides it across to you
      const db = A.dealerBody; return { stand: new V3(db.x + 0.6, 0, db.z + 0.1), spot: new V3(0.32, 0, A.tipSpot.z + 0.03), slide: true, to: s.drink };
    }
    const out = new V3(s.body.x, 0, s.body.z), dir = out.clone().setY(0).normalize();
    const t = new V3(-dir.z, 0, dir.x), toBoard = Math.sign(-out.z) || 1;
    const stand = out.clone().addScaledVector(dir, 0.18).addScaledVector(t, 0.36 * (t.z * toBoard > 0 ? 1 : -1));
    return { stand, spot: s.drink };
  },
  walk(dt, t) {
    const w = this.waitress; if (!w) return;
    if (this.slides) { const s = this.slides, kk = clamp((t - s.t0) / 0.9, 0, 1); if (kk > 0) { s.d.g.position.copy(s.from).lerp(s.to, easeOut(kk)); s.d.g.position.y = 0; } if (kk >= 1) this.slides = null; }
    if (!this.job && this.queue.length) {
      const q = this.queue.shift(), ap = this.approach(q.i);
      this.job = { ...q, ap, path: this.route(ap.stand), k: 0, phase: 'in', t0: t };
      w.root.position.copy(this.job.path[0]); w.root.position.y = WAIT_Y; w.root.visible = true; this.tray.visible = true; w.alpha = 1;
      if (this.carry) this.carry.dispose();
      this.carry = new Drink(q.type, 1);
    }
    const j = this.job; if (!j) return;
    const pos = w.root.position;
    if (j.phase === 'in' || j.phase === 'out') {
      const tgt = j.path[j.k]; _bv.set(tgt.x - pos.x, 0, tgt.z - pos.z); const dist = _bv.length(), step = 0.95 * dt * (this.speedMul || 1);
      if (dist <= step) { pos.x = tgt.x; pos.z = tgt.z; j.k++; if (j.k >= j.path.length) { if (j.phase === 'in') { j.phase = 'serve'; j.t0 = t; } else { this.job = null; w.root.visible = false; this.tray.visible = false; if (this.carry) { this.carry.dispose(); this.carry = null; } return; } } }
      else { pos.x += _bv.x / dist * step; pos.z += _bv.z / dist * step; const yaw = Math.atan2(_bv.x, _bv.z); w.root.rotation.y = lerpAngle(w.root.rotation.y, yaw, Math.min(1, dt * 8)); }
      w.walkPh = (w.walkPh || 0) + step * 13; w.walkAmt = Math.min(1, (w.walkAmt || 0) + dt * 4);
      pos.y = WAIT_Y + Math.abs(Math.sin(w.walkPh)) * 0.012;
    } else if (j.phase === 'serve') {
      w.walkAmt = Math.max(0, (w.walkAmt || 0) - dt * 5); pos.y = WAIT_Y;
      const spot = j.ap.spot; _bv.set(spot.x - pos.x, 0, spot.z - pos.z); w.root.rotation.y = lerpAngle(w.root.rotation.y, Math.atan2(_bv.x, _bv.z), Math.min(1, dt * 8));
      const el = t - j.t0;
      if (el > 0.25 && !j.reached) { j.reached = true; w.gesture('reach', 1.3, { world: spot, side: 1 }); w.look = spot.clone(); }
      if (el > 0.85 && !j.placed) {
        j.placed = true;
        if (this.drinks[j.i]) this.drinks[j.i].dispose();
        const d = this.carry; this.carry = null; this.drinks[j.i] = d;
        if (j.ap.slide) { d.g.position.copy(spot); const from = spot.clone(), to = j.ap.to.clone(); setTimeout(() => { dGest('push', 0.7, { world: from }); this.slides = { d, from, to, t0: performance.now() / 1000 + 0.25 }; setTimeout(() => Sound.slide(), 250); }, 700); }
        else { this.rest(j.i); Sound.chips(1, 0.4); }
        if (j.done) j.done();
      }
      if (el > 1.7) { j.phase = 'out'; j.path = j.path.slice().reverse(); j.k = 1; w.look = null; }
    }
    w.update(dt, t);
    // tray and the drink riding on it
    w.handWorld(0, _bw); this.tray.position.copy(_bw); this.tray.position.y += 0.015; this.tray.rotation.y = w.root.rotation.y;
    if (this.carry) { this.carry.g.position.copy(this.tray.position); this.carry.g.position.y += 0.004; }
  },
};

/* ---------- Ordering from the Bar tab ---------- */
const drinkPrice = () => Math.max(5, r5(S.bb));
function heroOrder(type) {
  const h = S.players[0], cost = drinkPrice(); if (h.out || h.chips <= cost * 3) return;
  h.chips -= cost; S.bar = (S.bar || 0) + cost; renderSeat(0); renderDock();
  toast(`${DRINKS[type].label} on its way`, 1600); Sound.chips(1, 0.4);
  Bar.order(0, type, { done: () => {
    if (isAngry(h) && Math.random() < 0.6) { calmDown(h); toast('You cool off.', 1600); }
    drinkUp(h, type);
    Achv.ev('drink', { type });
  } });
}
function sendDrink(p) {
  const h = S.players[0], cost = drinkPrice(); if (h.out || p.out || h.chips <= cost * 3) return;
  h.chips -= cost; S.bar = (S.bar || 0) + cost; renderSeat(0); renderDock();
  showBubble(0, `A drink for ${p.name}, on me.`); Sound.chips(1, 0.4);
  const type = FAV_DRINK[p.persona] || 'whisky';
  Bar.order(p.i, type, { done: () => {
    if (p.out) return;
    drinkUp(p, type);
    Rivals.bump(p.persona, 'grudge', -1); updateRivalBadges();
    const wasAngry = isAngry(p);
    if (wasAngry && Math.random() < 0.65) { calmDown(p); toast(`${p.name} cools off`, 1800); }
    sayExtra(p, 'cheers', 250); setTimeout(() => Bar.sip(p.i), 900);
    const pp = people[p.i]; if (pp) { pp.look = seatHeadWorld(0, new V3()); pp.glareUntil = performance.now() + 2500; pp.emote('happy', 2.5); }
    Achv.ev('sendDrink', { calmed: wasAngry && !isAngry(p) });
  } });
}

/* =========================================================
   Buzz: a drink or two helps, too many hurt.
   p.buzz rises with each drink delivered (ALCOHOL) and falls by BUZZ.decay every hand.
   Stage 1 Buzzed: sometimes a luckier deal. Stage 2 Tipsy: a little luck, some mistakes.
   Stage 3 Drunk: no luck, many mistakes (fold good hands, wild raises, call anything).
   ========================================================= */
const ALCOHOL = { whisky: 1.2, martini: 1, beer: 0.8, mocktail: -0.6, water: -0.6 };
const BUZZ = { decay: 0.3, max: 6, at: [0, 0.8, 2.4, 3.8] };
const BUZZ_NAME = ['Sober', 'Buzzed', 'Tipsy', 'Drunk'];
const BUZZ_LUCK = [0, 0.22, 0.1, 0];      // chance per hand of the luckier deal
const BUZZ_SLIP = [0, 0, 0.1, 0.3];       // chance a decision goes wrong
Object.assign(EXTRA_LINES.maniac,  { drinkOffer: ['Drinks on me! You look thirsty.', 'Loosen up, pal. Have one on me!'], refused: ['Your loss, buddy!', 'Boring!'], drunk: ['I feel GREAT! All in!', 'Who dealt this? ...Me? No.'] });
Object.assign(EXTRA_LINES.shark,   { drinkOffer: ['Have a drink. You seem tense.', 'Relax. This one is on me.'], refused: ['Suit yourself.', 'Smart. Maybe.'], drunk: ['I am perfectly... fine.', 'The cards are moving.'] });
Object.assign(EXTRA_LINES.rock,    { drinkOffer: ['Let me buy you one, partner.'], refused: ['Fair enough.'], drunk: ['Might have had one too many.', 'Room is spinning a bit.'] });
Object.assign(EXTRA_LINES.station, { drinkOffer: ['Ooh, let me buy you a drink!', "You should try one, they're yummy!"], refused: ['Aww, okay!', 'More for me!'], drunk: ['Wheee! I love everyone!', 'Is it my turn? Is it?'] });
Object.assign(EXTRA_LINES.pro,     { drinkOffer: ['Can I get you something?'], refused: ['No problem.'], drunk: ['Should not have had that.'] });
Object.assign(CAT_FACE, { drinkOffer: 'happy', refused: 'annoyed', drunk: 'happy' });

function buzzStage(p) { const b = (p && p.buzz) || 0; return b >= BUZZ.at[3] ? 3 : b >= BUZZ.at[2] ? 2 : b >= BUZZ.at[1] ? 1 : 0; }
function drinkUp(p, type) {
  if (!p || p.out) return;
  const before = buzzStage(p);
  p.buzz = clamp((p.buzz || 0) + (ALCOHOL[type] ?? 0.8), 0, BUZZ.max);
  const after = buzzStage(p); renderBuzz(p.i);
  if (S.test || after === before) return;
  if (p.isHero) {
    if (after > before) toast(['', 'You feel good. Lady Luck is smiling.', "You're getting tipsy. Careful now.", "You're drunk! Your hands are not listening."][after], 3000);
    else toast(after ? `Clearer head: ${BUZZ_NAME[after].toLowerCase()} now` : 'You feel sober again', 2200);
  } else if (after === 3) { toast(`${p.name} is drunk`, 2200); sayExtra(p, 'drunk', 600); }
}
function buzzTick() { for (const p of S.players) if (p && p.buzz) { p.buzz = Math.max(0, p.buzz - BUZZ.decay); renderBuzz(p.i); } }
function renderBuzz(i) {
  const p = S.players[i], el = seatEls[i] && seatEls[i].querySelector('.buzzb'), st = p && !p.out ? buzzStage(p) : 0;
  if (el) { el.hidden = !st; el.className = 'buzzb s' + st; el.textContent = BUZZ_NAME[st]; }
  if (people[i]) people[i].drunk = st >= 2 ? st - 1 : 0;
  if (i === 0) { stageEl.classList.toggle('tipsy', st === 2 && !S.test); stageEl.classList.toggle('drunk', st === 3 && !S.test); }
}
/* A buzzed player sometimes gets the best of three random two-card hands. The deck stays a full shuffle:
   only cards swap places. Dealing pops from the end, so seat k's cards sit at L-1-k and L-1-n-k. */
function applyBuzzLuck(dealt, skip = -1) {
  const lucky = dealt.filter(i => i !== skip && Math.random() < BUZZ_LUCK[buzzStage(S.players[i])]);
  if (!lucky.length) return -1;
  const who = pick(lucky), k = dealt.indexOf(who), deck = S.deck, L = deck.length, n = dealt.length;
  const pa = L - 1 - k, pb = L - 1 - n - k;
  let best = [deck[pa], deck[pb]], bestS = CHEN[best[0] * 52 + best[1]];
  for (let t = 0; t < 2; t++) {
    const x = (Math.random() * L) | 0, y = (Math.random() * L) | 0; if (x === y) continue;
    const s = CHEN[deck[x] * 52 + deck[y]]; if (s > bestS) { bestS = s; best = [deck[x], deck[y]]; }
  }
  const put = (pos, card) => { const j = deck.indexOf(card); [deck[pos], deck[j]] = [deck[j], deck[pos]]; };
  put(pa, best[0]); put(pb, best[1]);
  return who;
}
/* Drunk decisions */
function drunkAdjust(p, a) {
  const st = buzzStage(p); if (Math.random() >= BUZZ_SLIP[st]) return a;
  const toCall = Math.max(0, S.currentBet - p.bet), cr = canRaise(p), strong = !!(p._info && p._info.str > 0.55), r = Math.random();
  let b;
  if (strong && toCall > 0 && r < 0.4) b = A_('fold');
  else if (cr && r < 0.75) b = A_('raise', S.currentBet + Math.max(S.minRaise, (S.pot + sumBets()) * rand(0.8, 1.6)));
  else b = toCall > 0 ? A_('call') : A_('check');
  if (b.type !== a.type && !S.test && Math.random() < 0.5) setTimeout(() => showBubble(p.i, pick(['*hic*', '*sways*', 'Whoops.'])), 200);
  return b;
}
function drunkHero(a) {
  const h = S.players[0], st = buzzStage(h); if (!a || Math.random() >= BUZZ_SLIP[st]) return a;
  const toCall = Math.max(0, S.currentBet - h.bet), cr = canRaise(h), r = Math.random();
  let b = a;
  if ((a.type === 'call' || a.type === 'check') && cr && r < 0.55) b = { type: 'raise', to: S.currentBet + S.minRaise };
  else if (a.type === 'call' && r < 0.8) b = { type: 'fold' };
  else if (a.type === 'fold' && toCall > 0) b = { type: 'call' };
  else if (a.type === 'raise') b = { type: toCall > 0 ? 'call' : 'check' };
  if (b !== a && !S.test) {
    showBubble(0, '*hic*');
    toast(`Your hand slipped: ${b.type === 'raise' ? 'you raised' : b.type === 'fold' ? 'you folded' : b.type === 'call' ? 'you called' : 'you checked'}`, 2600);
  }
  return b;
}

/* ---------- An opponent offers you a drink: accept or refuse ---------- */
const offerEl = document.createElement('div'); offerEl.className = 'drinkoffer'; offerEl.hidden = true; stageEl.appendChild(offerEl);
const DrinkOffer = {
  cur: null,
  maybe() { // between hands, now and then
    if (S.test || this.cur || !S.started) return;
    const h = S.players[0], cost = drinkPrice(); if (!h || h.out) return;
    const cands = S.players.filter(p => !p.isHero && !p.out && p.chips > cost * 4);
    if (!cands.length || Math.random() > 0.06) return;
    const p = pick(cands); this.show(p, FAV_DRINK[p.persona] === 'water' ? 'martini' : (FAV_DRINK[p.persona] || 'whisky'));
  },
  show(p, type) {
    if (this.cur) return;
    const run = RUN; this.cur = { p, type, run };
    offerEl.innerHTML = `<p><b>${escH(p.name)}</b> wants to buy you a <b>${DRINKS[type].label.toLowerCase()}</b>.</p><div><button class="ok">Accept</button><button class="no">No thanks</button></div><i class="tm"></i>`;
    offerEl.hidden = false; offerEl.classList.remove('show'); void offerEl.offsetWidth; offerEl.classList.add('show');
    offerEl.querySelector('.ok').onclick = () => this.answer(true);
    offerEl.querySelector('.no').onclick = () => this.answer(false);
    sayExtra(p, 'drinkOffer'); Sound.pop();
    clearTimeout(this._t); this._t = setTimeout(() => this.answer(false, true), 12000);
  },
  answer(yes, timedOut) {
    const c = this.cur; if (!c) return; this.cur = null; clearTimeout(this._t);
    offerEl.classList.remove('show'); setTimeout(() => { if (!this.cur) offerEl.hidden = true; }, 300);
    const { p, type, run } = c, h = S.players[0], cost = drinkPrice();
    if (run !== RUN || p.out || h.out || S.players[p.i] !== p) return;
    if (!yes) { if (!timedOut) { sayExtra(p, 'refused', 200); showBubble(0, 'No thanks.'); } return; }
    if (p.chips <= cost) return;
    p.chips -= cost; S.bar = (S.bar || 0) + cost; renderSeat(p.i); // they pay
    showBubble(0, 'Cheers!'); Sound.chips(1, 0.4);
    Rivals.bump(p.persona, 'grudge', -1); updateRivalBadges();
    Bar.order(0, type, { done: () => { drinkUp(h, type); if (isAngry(h) && Math.random() < 0.5) { calmDown(h); toast('You cool off.', 1600); } } });
  },
  clear() { this.cur = null; clearTimeout(this._t); offerEl.hidden = true; offerEl.classList.remove('show'); },
};

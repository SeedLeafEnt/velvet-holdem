'use strict';
/* Velvet Hold'em: 07-people.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   3D people: players and the dealer, built from primitives and posed every frame
   (two-bone arm IK, head look, breathing, blinks, expressions, gestures)
   ========================================================= */
const HIP_Y = -0.24, UA = 0.27, FA = 0.26, SH_X = 0.165, SH_Y = 0.47;
const LOOKS = {
  rock:    { g: 'm', hair: 'none', hat: 'cowboy', beard: true, top: '#6b4a2e', top2: '#3c2a1c', hairCol: '#bdb6aa', hatCol: '#4a3423' },
  shark:   { g: 'f', hair: 'long', shades: true, top: '#1d1f27', top2: '#ece7dd', hairCol: '#1b1412' },
  maniac:  { g: 'm', hair: 'short', cap: true, top: '#b8322a', top2: '#f2efe8', hairCol: '#2a1a10', hatCol: '#16181d' },
  station: { g: 'f', hair: 'bun', top: '#2a8f84', top2: '#f4e9d8', hairCol: '#7a3e1d' },
  pro:     { g: 'm', hair: 'short', glasses: true, top: '#24324c', top2: '#dfe6ee', hairCol: '#2b2420' },
  dealer:  { g: 'm', hair: 'short', dealer: true, top: '#141418', top2: '#f4f4f2', hairCol: '#1d1714' },
  waitress: { g: 'f', hair: 'bun', top: '#7a1630', top2: '#f4efe6', hairCol: '#2a1810', standing: true },
};
const SKINS = ['#f2c9a8', '#e3b08a', '#c98f66', '#a46c47', '#7c4d30', '#f6dcc6'];
const FACES = {
  neutral:   { brow: 0, up: 0, mouth: 'flat', squint: 0 },
  happy:     { brow: 0, up: 0.25, mouth: 'smile', squint: 0.15 },
  joy:       { brow: -0.2, up: 0.8, mouth: 'open', squint: 0 },
  sad:       { brow: -1, up: 0.1, mouth: 'frown', squint: 0.1 },
  angry:     { brow: 1, up: 0, mouth: 'frown', squint: 0.4 },
  furious:   { brow: 1, up: 0, mouth: 'open', squint: 0.55 },
  annoyed:   { brow: 0.6, up: 0, mouth: 'flat', squint: 0.3 },
  surprised: { brow: 0, up: 1, mouth: 'open', squint: 0 },
  smug:      { brow: 0.35, up: 0, mouth: 'smile', squint: 0.35 },
  worried:   { brow: -0.75, up: 0.35, mouth: 'flat', squint: 0 },
  focused:   { brow: 0.3, up: 0, mouth: 'flat', squint: 0.2 },
  wink:      { brow: 0.25, up: 0.1, mouth: 'smile', squint: 0.1, wink: true },
};
const PGEO = {};
function initPeopleGeo() {
  const torso = (sh, ws) => new THREE.LatheGeometry([
    new THREE.Vector2(0.001, -0.02), new THREE.Vector2(ws, 0), new THREE.Vector2(ws * 1.05, 0.13), new THREE.Vector2(sh * 0.95, 0.3),
    new THREE.Vector2(sh, 0.41), new THREE.Vector2(sh * 0.9, 0.49), new THREE.Vector2(0.078, 0.55), new THREE.Vector2(0.001, 0.565)], 28);
  PGEO.torsoM = torso(0.178, 0.152); PGEO.torsoF = torso(0.152, 0.122);
  PGEO.neck = new THREE.CylinderGeometry(0.041, 0.047, 0.1, 16);
  PGEO.collar = new THREE.TorusGeometry(0.056, 0.014, 8, 20);
  PGEO.head = new THREE.SphereGeometry(0.095, 32, 24);
  PGEO.eye = new THREE.SphereGeometry(0.0165, 14, 10);
  PGEO.pupil = new THREE.SphereGeometry(0.0088, 10, 8);
  PGEO.brow = new THREE.BoxGeometry(0.038, 0.0078, 0.009);
  PGEO.nose = new THREE.ConeGeometry(0.0125, 0.034, 10);
  PGEO.ear = new THREE.SphereGeometry(0.02, 10, 8);
  PGEO.smile = new THREE.TorusGeometry(0.02, 0.0036, 6, 14, Math.PI * 0.7);
  PGEO.mouthO = new THREE.CircleGeometry(0.0135, 18);
  PGEO.mouthFlat = new THREE.BoxGeometry(0.032, 0.005, 0.005);
  PGEO.upper = new THREE.CapsuleGeometry(0.047, UA - 0.045, 6, 12);
  PGEO.fore = new THREE.CapsuleGeometry(0.039, FA - 0.035, 6, 12);
  PGEO.hand = new THREE.SphereGeometry(0.042, 14, 10);
  PGEO.shoulder = new THREE.SphereGeometry(0.06, 14, 10);
  PGEO.cap = new THREE.SphereGeometry(0.1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.47);
  PGEO.ball = new THREE.SphereGeometry(0.1, 20, 14);
  PGEO.bun = new THREE.SphereGeometry(0.04, 14, 10);
  PGEO.beard = new THREE.SphereGeometry(0.097, 24, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.3);
  PGEO.brim = new THREE.CylinderGeometry(0.17, 0.17, 0.008, 28);
  PGEO.crown = new THREE.CylinderGeometry(0.072, 0.088, 0.09, 20);
  PGEO.bill = new THREE.BoxGeometry(0.1, 0.008, 0.075);
  PGEO.lens = new THREE.TorusGeometry(0.019, 0.0028, 6, 16);
  PGEO.shade = new THREE.SphereGeometry(0.022, 14, 10);
  PGEO.bowWing = new THREE.ConeGeometry(0.02, 0.032, 4);
  PGEO.knot = new THREE.SphereGeometry(0.009, 8, 6);
  const tri = new THREE.Shape(); tri.moveTo(-0.055, 0.11); tri.lineTo(0.055, 0.11); tri.lineTo(0, -0.13); tri.closePath();
  PGEO.shirtFront = new THREE.ShapeGeometry(tri);
  PGEO.chairBack = new THREE.BoxGeometry(0.46, 0.52, 0.07);
  PGEO.chairSeat = new THREE.BoxGeometry(0.46, 0.08, 0.42);
}
const _Y = new THREE.Vector3(0, 1, 0);
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _T = new THREE.Vector3(), _d = new THREE.Vector3(), _pl = new THREE.Vector3();
const _lv = new THREE.Vector3(), _hx = new THREE.Vector3(), _hz = new THREE.Vector3(), _mb = new THREE.Matrix4();
const _h0 = new THREE.Vector3(), _h1 = new THREE.Vector3(), _H = [_h0, _h1];
const smoothEnv = (k, a = 0.2, b = 0.25) => Math.max(0, Math.min(1, k / a, (1 - k) / b));
function placeSeg(mesh, a, b) {
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  _d.subVectors(b, a).normalize(); mesh.quaternion.setFromUnitVectors(_Y, _d);
}

class Person {
  constructor(persona, seed, isDealer = false) {
    const L = LOOKS[isDealer ? 'dealer' : persona] || LOOKS.pro;
    this.persona = persona; this.L = L; this.seed = seed % 1000; this.isDealer = isDealer;
    const rr = k => prand(seed + k * 97);
    const skin = isDealer ? '#e6b896' : SKINS[Math.floor(rr(1) * SKINS.length)];
    this.mats = [];
    const M = (col, rough = 0.8, extra = {}) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: rough, metalness: 0 }, extra)); this.mats.push(m); return m; };
    const mSkin = M(skin, 0.58, { emissive: new THREE.Color(skin).multiplyScalar(0.14) }), mTop = M(L.top, 0.86), mTop2 = M(L.top2, 0.8), mHair = M(L.hairCol, 0.55);
    const mDark = M('#121212', 0.35), mWhite = M('#f5f3ee', 0.3), mLeather = M('#2a1612', 0.55), mHat = M(L.hatCol || '#222', 0.7);
    const mLips = M(new THREE.Color(skin).multiplyScalar(0.55).getStyle(), 0.6);
    const mesh = (geo, mat, parent, x = 0, y = 0, z = 0, cast = true) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = cast; parent.add(o); return o; };
    this.root = new THREE.Group();
    if (!L.standing) {
      const back = mesh(PGEO.chairBack, mLeather, this.root, 0, -0.04, -0.22); back.rotation.x = -0.12;
      mesh(PGEO.chairSeat, mLeather, this.root, 0, -0.37, -0.05, false);
    } else {
      // standing figure: skirt, legs and shoes, with a walk cycle
      if (!PGEO.skirt) {
        PGEO.skirt = new THREE.LatheGeometry([[0, 0.02], [0.104, 0.02], [0.118, -0.1], [0.148, -0.43], [0, -0.43]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
        PGEO.leg = new THREE.CylinderGeometry(0.027, 0.021, 0.94, 10); PGEO.shoe = new THREE.BoxGeometry(0.05, 0.03, 0.1);
      }
      const sk = mesh(PGEO.skirt, M('#16161b', 0.85), this.root, 0, HIP_Y, -0.02);
      const mLeg = M('#3a2c2a', 0.45), mShoe = M('#0e0e10', 0.35);
      this.legs = [1, -1].map(sg => { const g = new THREE.Group(); g.position.set(sg * 0.055, HIP_Y - 0.02, -0.02); this.root.add(g); mesh(PGEO.leg, mLeg, g, 0, -0.47, 0); mesh(PGEO.shoe, mShoe, g, 0, -0.945, 0.03); return g; });
      this.walkPh = 0; this.walkAmt = 0;
    }
    // Torso
    this.torso = new THREE.Group(); this.torso.position.set(0, HIP_Y, -0.03); this.root.add(this.torso);
    const sleeve = L.dealer ? mWhite : mTop;
    const t = mesh(L.g === 'f' ? PGEO.torsoF : PGEO.torsoM, mTop, this.torso); t.scale.set(1, 1, 0.62);
    if (L.dealer) {
      const sf = mesh(PGEO.shirtFront, mWhite, this.torso, 0, 0.43, 0.093, false); sf.rotation.x = -0.18;
      for (const s of [1, -1]) { const w = mesh(PGEO.bowWing, M('#7d1626', 0.5), this.torso, s * 0.02, 0.535, 0.075, false); w.rotation.z = s * Math.PI / 2; }
      mesh(PGEO.knot, M('#5c0f1b', 0.5), this.torso, 0, 0.535, 0.08, false);
    } else {
      const c = mesh(PGEO.collar, mTop2, this.torso, 0, 0.545, 0.0, false); c.rotation.x = Math.PI / 2; c.scale.set(1, 0.85, 1);
    }
    mesh(PGEO.neck, mSkin, this.torso, 0, 0.59, 0);
    // Head
    this.head = new THREE.Group(); this.head.position.set(0, 0.625, 0.005); this.torso.add(this.head);
    const hd = mesh(PGEO.head, mSkin, this.head, 0, 0.1, 0); hd.scale.set(L.g === 'f' ? 0.96 : 1, 1.17, 1.04);
    for (const s of [1, -1]) { const e = mesh(PGEO.ear, mSkin, this.head, s * 0.093, 0.1, -0.005, false); e.scale.set(0.45, 1, 0.8); }
    const nose = mesh(PGEO.nose, mSkin, this.head, 0, 0.084, 0.103, false); nose.rotation.x = Math.PI / 2;
    this.eyes = []; this.pupils = []; this.brows = [];
    for (const s of [1, -1]) {
      const e = mesh(PGEO.eye, mWhite, this.head, s * 0.034, 0.112, 0.085, false); e.scale.set(1, 1, 0.55); this.eyes.push(e);
      const p = mesh(PGEO.pupil, mDark, this.head, s * 0.034, 0.112, 0.094, false); p.scale.set(1, 1, 0.5); this.pupils.push(p);
      const b = mesh(PGEO.brow, mHair, this.head, s * 0.034, 0.142, 0.093, false); this.brows.push(b);
    }
    this.mouth = new THREE.Group(); this.mouth.position.set(0, 0.046, 0.088); this.head.add(this.mouth);
    this.mSmile = mesh(PGEO.smile, mLips, this.mouth, 0, 0.012, 0, false); this.mSmile.rotation.z = -Math.PI / 2 - Math.PI * 0.35;
    this.mFrown = mesh(PGEO.smile, mLips, this.mouth, 0, -0.018, 0, false); this.mFrown.rotation.z = Math.PI / 2 - Math.PI * 0.35;
    this.mFlat = mesh(PGEO.mouthFlat, mLips, this.mouth, 0, 0, 0, false);
    this.mOpen = mesh(PGEO.mouthO, M('#3a1414', 0.7), this.mouth, 0, -0.004, 0.002, false); this.mOpen.scale.set(1, 1.25, 1);
    // Hair and accessories
    const capHair = () => { const c = mesh(PGEO.cap, mHair, this.head, 0, 0.1, -0.006); c.scale.set(1.05, 1.19, 1.1); c.rotation.x = -0.6; return c; };
    if (L.hair === 'short') capHair();
    if (L.hair === 'long') { capHair(); const b = mesh(PGEO.ball, mHair, this.head, 0, 0.03, -0.045); b.scale.set(1.04, 1.45, 0.62); }
    if (L.hair === 'bun') { capHair(); mesh(PGEO.bun, mHair, this.head, 0, 0.215, -0.06); }
    if (L.beard) { const b = mesh(PGEO.beard, mHair, this.head, 0, 0.1, 0.004); b.scale.set(1.03, 1.18, 1.07); }
    if (L.hat === 'cowboy') {
      const g = new THREE.Group(); g.position.set(0, 0.2, -0.005); g.rotation.x = -0.12; this.head.add(g);
      const br = mesh(PGEO.brim, mHat, g, 0, 0, 0); br.scale.set(1, 1, 0.86);
      mesh(PGEO.crown, mHat, g, 0, 0.045, 0);
      const band = mesh(PGEO.collar, mDark, g, 0, 0.012, 0, false); band.rotation.x = Math.PI / 2; band.scale.set(1.45, 1.45, 0.4);
    }
    if (L.cap) {
      const c = mesh(PGEO.cap, mHat, this.head, 0, 0.1, -0.004); c.scale.set(1.08, 1.21, 1.12); c.rotation.x = -0.42;
      const bill = mesh(PGEO.bill, mHat, this.head, 0, 0.165, -0.125); bill.rotation.x = -0.32;
    }
    if (L.glasses) {
      for (const s of [1, -1]) mesh(PGEO.lens, mDark, this.head, s * 0.034, 0.112, 0.1, false);
      const br = mesh(PGEO.mouthFlat, mDark, this.head, 0, 0.114, 0.101, false); br.scale.set(0.45, 0.6, 0.6);
    }
    if (L.shades) {
      for (const s of [1, -1]) { const g = mesh(PGEO.shade, M('#0a0a0c', 0.15, { metalness: 0.4 }), this.head, s * 0.034, 0.112, 0.096, false); g.scale.set(1.15, 0.8, 0.35); }
      const br = mesh(PGEO.mouthFlat, mDark, this.head, 0, 0.116, 0.104, false); br.scale.set(0.45, 0.6, 0.6);
    }
    // Arms live on the root and are solved each frame
    const thin = L.g === 'f' ? 0.86 : 1;
    this.arms = [1, -1].map(sgn => {
      const sh = mesh(PGEO.shoulder, L.dealer ? mTop : mTop, this.root); sh.scale.setScalar(thin);
      const up = mesh(PGEO.upper, sleeve, this.root); up.scale.set(thin, 1, thin);
      const fo = mesh(PGEO.fore, sleeve, this.root); fo.scale.set(thin, 1, thin);
      const ha = mesh(PGEO.hand, mSkin, this.root); ha.scale.set(0.95 * thin, 1.28, 0.55);
      return { sgn, sh, up, fo, ha };
    });
    // State
    this.rest = [new THREE.Vector3(0.13, 0.115, 0.36), new THREE.Vector3(-0.13, 0.115, 0.36)];
    if (isDealer) { this.rest[0].set(0.16, 0.11, 0.4); this.rest[1].set(-0.16, 0.11, 0.4); }
    this.handC = [this.rest[0].clone(), this.rest[1].clone()];
    this.cur = { lean: 0.05, twist: 0, hy: 0, hp: 0.1, hr: 0 };
    this.gest = null; this.emo = null; this.mood = 'neutral'; this.look = null;
    this.talkUntil = 0; this.blinkUntil = 0; this.nextBlink = 1 + rr(3) * 3; this.holding = false; this.alpha = 1;
    this.root.traverse(o => { o.userData.person = this; });
  }
  gesture(name, dur, opts = {}) {
    const t = performance.now() / 1000;
    this.gest = Object.assign({ name, t0: t, dur: Math.max(0.15, dur * spd()), fired: false }, opts);
    if (opts.world) { this.gest.local = this.root.worldToLocal(opts.world.clone()); }
    if (opts.world2) { this.gest.local2 = this.root.worldToLocal(opts.world2.clone()); }
  }
  emote(face, secs) { this.emo = { face, until: performance.now() / 1000 + secs }; }
  talk(secs) { this.talkUntil = performance.now() / 1000 + secs; }
  reachLimit(v, sgn) {
    // Clamp a hand target to arm's reach; return the forward lean needed to get closer
    _S.set(sgn * SH_X, HIP_Y + SH_Y, 0);
    _d.subVectors(v, _S); const L = _d.length(), max = UA + FA - 0.02;
    if (L <= max) return 0;
    const over = L - max; v.copy(_S).addScaledVector(_d.normalize(), max + Math.min(over, 0.22));
    return Math.min(0.42, over * 0.75);
  }
  update(dt, t) {
    const P = { lean: 0.05, twist: 0, hy: 0, hp: 0.12, hr: 0, breath: 1 };
    _h0.copy(this.rest[0]); _h1.copy(this.rest[1]);
    if (this.holding) _h0.set(0.12, 0.17, 0.33);
    if (this.legs) { const sw = Math.sin(this.walkPh) * 0.42 * this.walkAmt; this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw; P.breath = 1.4; }
    const face = Object.assign({}, FACES[(this.emo && t < this.emo.until) ? this.emo.face : this.mood] || FACES.neutral);
    if (this.look) {
      this.root.worldToLocal(_lv.copy(this.look));
      const dx = _lv.x, dy = _lv.y - (HIP_Y + 0.73), dz = _lv.z;
      P.hy = clamp(Math.atan2(dx, dz), -1.15, 1.15); P.hp = clamp(Math.atan2(-dy, Math.hypot(dx, dz)), -0.35, 0.8) - 0.04;
    }
    const g = this.gest;
    if (g) {
      const k = (t - g.t0) / g.dur;
      if (k >= 1) { this.gest = null; } else { const fn = GESTURES[g.name]; if (fn) fn(k, P, _H, face, this, g); }
    }
    if (this.drunk) { // tipsy (1) or drunk (2): a slow sway and a lolling head
      const d = this.drunk, s = this.seed || 0;
      P.twist += Math.sin(t * 0.9 + s) * 0.07 * d; P.lean += Math.sin(t * 0.6 + s * 2) * 0.04 * d;
      P.hr += Math.sin(t * 1.1 + s) * 0.09 * d; P.hp += 0.04 * d;
      if (d > 1 && face.squint == null) face.squint = 0.45;
    }
    const fast = g && g.snap;
    const a = 1 - Math.exp(-dt * (fast ? 13 : 6.5)), ah = 1 - Math.exp(-dt * (fast ? 20 : 9));
    for (const key of ['lean', 'twist', 'hy', 'hp', 'hr']) this.cur[key] += (P[key] - this.cur[key]) * a;
    this.handC[0].lerp(_h0, ah); this.handC[1].lerp(_h1, ah);
    const br = Math.sin(t * 1.7 + this.seed) * P.breath;
    this.torso.rotation.set(this.cur.lean + br * 0.014, this.cur.twist, 0);
    this.torso.updateMatrix();
    this.head.rotation.set(this.cur.hp + br * 0.01, this.cur.hy, this.cur.hr, 'YXZ');
    // Face
    if (t > this.nextBlink) { this.blinkUntil = t + 0.12; this.nextBlink = t + 2.4 + Math.random() * 3.2; }
    const ey = t < this.blinkUntil ? 0.12 : 1 - (face.squint || 0) * 0.5;
    for (let s = 0; s < 2; s++) {
      const es = face.wink && s === 1 ? 0.08 : ey;
      this.eyes[s].scale.y = es; this.pupils[s].scale.y = es;
      const sgn = s === 0 ? 1 : -1;
      this.brows[s].rotation.z = face.brow * 0.42 * sgn;
      this.brows[s].position.y = 0.142 + (face.up || 0) * 0.013 - Math.max(0, face.brow) * 0.004;
    }
    let m = face.mouth;
    if (t < this.talkUntil) m = Math.sin(t * 34 + this.seed) > -0.15 ? 'open' : (face.mouth === 'open' ? 'flat' : face.mouth);
    this.mSmile.visible = m === 'smile'; this.mFrown.visible = m === 'frown'; this.mFlat.visible = m === 'flat'; this.mOpen.visible = m === 'open';
    this.mOpen.scale.y = m === 'open' && t < this.talkUntil ? 0.9 + Math.abs(Math.sin(t * 21)) * 0.6 : 1.25;
    for (let s = 0; s < 2; s++) this.solveArm(s);
    if (this.fire) this.fire.update(dt);
  }
  solveArm(s) {
    const arm = this.arms[s], sgn = arm.sgn;
    _S.set(sgn * SH_X, SH_Y, 0).applyMatrix4(this.torso.matrix);
    arm.sh.position.copy(_S);
    _T.copy(this.handC[s]);
    _d.subVectors(_T, _S); let L = _d.length(); const a = UA, b = FA;
    L = clamp(L, 0.08, a + b - 0.002); _d.normalize();
    const cosA = clamp((a * a + L * L - b * b) / (2 * a * L), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    _pl.set(sgn * 0.75, -1, -0.45); _pl.addScaledVector(_d, -_pl.dot(_d)).normalize();
    _E.copy(_S).addScaledVector(_d, a * cosA).addScaledVector(_pl, a * sinA);
    _T.copy(_S).addScaledVector(_d, L);
    placeSeg(arm.up, _S, _E); placeSeg(arm.fo, _E, _T);
    // Hand: along the forearm, palm facing down
    _d.subVectors(_T, _E).normalize();
    arm.ha.position.copy(_T).addScaledVector(_d, 0.04);
    _hx.crossVectors(_d, _lv.set(0, -1, 0)); if (_hx.lengthSq() < 1e-4) _hx.set(1, 0, 0); _hx.normalize();
    _hz.crossVectors(_hx, _d).normalize();
    _mb.makeBasis(_hx, _d, _hz); arm.ha.quaternion.setFromRotationMatrix(_mb);
  }
  handWorld(s, out) { return out.copy(this.arms[s].ha.position).applyMatrix4(this.root.matrixWorld); }
  headTopWorld(out) { out.set(0, 0.1, 0).applyMatrix4(this.head.matrixWorld); out.y += (this.L.hat ? 0.2 : 0.16); return out; }
  fade(to, dur) {
    for (const m of this.mats) { m.transparent = true; m.needsUpdate = true; }
    const from = this.alpha;
    return animate(dur, e => { this.alpha = lerp(from, to, e); for (const m of this.mats) m.opacity = this.alpha; this.root.visible = this.alpha > 0.02; }, easeInOut)
      .then(() => { if (this.alpha >= 0.99) for (const m of this.mats) { m.transparent = false; m.opacity = 1; m.needsUpdate = true; } });
  }
  setFire(on) {
    if (!on && !this.fire) return;
    if (!this.fire) this.fire = new HeadFire(this);
    this.fire.set(on);
  }
  fireBase(out) {
    // Top of the hat or hair, in world space; flames rise straight up from here
    out.set(0, 0.1, 0).applyMatrix4(this.head.matrixWorld);
    const L = this.L; out.y += L.hat === 'cowboy' ? 0.145 : L.cap ? 0.1 : L.hair === 'bun' ? 0.125 : 0.09;
    return out;
  }
  dispose() { scene.remove(this.root); for (const m of this.mats) m.dispose(); if (this.fire) this.fire.dispose(); }
}

/* Flames on an angry player's hat: GPU points, one draw call for flames and one for smoke */
let FIRE_TEX = null, FIRE_MAT = null, SMOKE_MAT = null;
function fireMats() {
  if (FIRE_MAT) return;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.75)'); gr.addColorStop(0.65, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  FIRE_TEX = new THREE.CanvasTexture(cv);
  const vs = `attribute float size; attribute vec4 col; varying vec4 vC; uniform float scale;
    void main() { vC = col; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
  const fs = `uniform sampler2D map; varying vec4 vC; void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a); }`;
  const mk = blending => new THREE.ShaderMaterial({ uniforms: { map: { value: FIRE_TEX }, scale: { value: 600 } }, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, blending });
  FIRE_MAT = mk(THREE.AdditiveBlending); SMOKE_MAT = mk(THREE.NormalBlending);
}
function fireScale() {
  if (!FIRE_MAT) return;
  const px = G.H * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360));
  FIRE_MAT.uniforms.scale.value = px; SMOKE_MAT.uniforms.scale.value = px;
}
const FLAME_N = 56, SMOKE_N = 14;
class HeadFire {
  constructor(person) {
    fireMats();
    this.p = person; this.on = false; this.level = 0; this.base = new V3(); this.t = 0;
    this.r = person.L.hat === 'cowboy' ? 0.12 : 0.088;
    const mk = (n, mat) => {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('col', new THREE.BufferAttribute(col, 4)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 6; pts.visible = false; scene.add(pts);
      return { g, pos, col, size, pts, parts: Array.from({ length: n }, () => ({ life: 1, dur: 1, x: 0, z: 0, ph: Math.random() * 6.28, sp: 1, live: false })) };
    };
    this.fl = mk(FLAME_N, FIRE_MAT); this.sm = mk(SMOKE_N, SMOKE_MAT);
    this.puff = 0;
  }
  set(on) {
    if (on === this.on) return;
    this.on = on;
    if (on) { for (const q of this.fl.parts) { q.life = Math.random(); q.dur = rand(0.42, 0.75); this.spawnFlame(q, true); } }
    else this.puff = 1.4; // burst of smoke as the fire goes out
  }
  spawnFlame(q, keepLife) {
    const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * this.r;
    q.x = Math.cos(a) * d; q.z = Math.sin(a) * d; q.sp = rand(0.8, 1.25); q.ph = Math.random() * 6.28; q.live = true;
    if (!keepLife) { q.life = 0; q.dur = rand(0.42, 0.75); }
  }
  spawnSmoke(q) { q.x = rand(-this.r, this.r) * 0.6; q.z = rand(-this.r, this.r) * 0.6; q.life = 0; q.dur = rand(1.1, 1.8); q.sp = rand(0.7, 1.2); q.ph = Math.random() * 6.28; q.live = true; }
  update(dt) {
    const p = this.p; this.t += dt;
    this.level += ((this.on ? 1 : 0) - this.level) * Math.min(1, dt * (this.on ? 5 : 3));
    const vis = p.root.visible && (this.level > 0.02 || this.puff > 0 || this.sm.parts.some(q => q.live));
    this.fl.pts.visible = vis && this.level > 0.02; this.sm.pts.visible = vis;
    if (!vis) return;
    p.fireBase(this.base); const b = this.base, A = p.alpha;
    const F = this.fl;
    for (let i = 0; i < FLAME_N; i++) {
      const q = F.parts[i], k = i * 3, c = i * 4;
      if (i === FLAME_N - 1) { // soft glow that lights up the hat
        F.pos[k] = b.x; F.pos[k + 1] = b.y + 0.03; F.pos[k + 2] = b.z; F.size[i] = 0.42 * this.level;
        F.col[c] = 1; F.col[c + 1] = 0.42; F.col[c + 2] = 0.08; F.col[c + 3] = (0.16 + Math.sin(this.t * 19) * 0.03 + Math.sin(this.t * 7.3) * 0.03) * this.level * A; continue;
      }
      q.life += dt / q.dur;
      if (q.life >= 1) { if (this.on) this.spawnFlame(q); else q.live = false; }
      const L = Math.min(1, q.life);
      const sway = Math.sin(this.t * 7 + q.ph) * 0.014 * L + Math.sin(this.t * 13 + q.ph * 2) * 0.006;
      F.pos[k] = b.x + q.x * (1 - L * 0.75) + sway; F.pos[k + 1] = b.y + L * 0.3 * q.sp; F.pos[k + 2] = b.z + q.z * (1 - L * 0.75) + sway * 0.6;
      const edge = 1 - Math.hypot(q.x, q.z) / (this.r + 1e-3);
      F.size[i] = q.live ? (0.11 + 0.08 * edge) * (1 - L * 0.6) * (0.6 + 0.4 * this.level) : 0;
      // white-yellow core, orange body, red tips
      const r = 1, g = L < 0.3 ? lerp(0.78, 0.5, L / 0.3) : lerp(0.5, 0.16, (L - 0.3) / 0.7), bl = L < 0.2 ? lerp(0.35, 0.08, L / 0.2) : 0.04;
      F.col[c] = r; F.col[c + 1] = g; F.col[c + 2] = bl;
      F.col[c + 3] = q.live ? Math.min(1, L * 8) * Math.pow(1 - L, 0.7) * 0.85 * this.level * A : 0; // brightest at the base, fading as it rises
    }
    const Sm = this.sm;
    if (this.puff > 0) this.puff -= dt;
    for (let i = 0; i < SMOKE_N; i++) {
      const q = Sm.parts[i];
      if (q.live) { q.life += dt / q.dur; if (q.life >= 1) q.live = false; }
      if (!q.live && ((this.puff > 0 && Math.random() < dt * 14) || (this.on && Math.random() < dt * 2.2))) this.spawnSmoke(q);
      const L = Math.min(1, q.life), k = i * 3, c = i * 4;
      Sm.pos[k] = b.x + q.x + Math.sin(this.t * 2 + q.ph) * 0.03 * L; Sm.pos[k + 1] = b.y + 0.08 + L * 0.34 * q.sp; Sm.pos[k + 2] = b.z + q.z;
      Sm.size[i] = q.live ? 0.07 + L * 0.2 : 0;
      Sm.col[c] = Sm.col[c + 1] = Sm.col[c + 2] = 0.28;
      Sm.col[c + 3] = q.live ? Math.sin(Math.PI * L) * (this.on ? 0.28 : 0.5) * A : 0;
    }
    for (const o of [F, Sm]) { o.g.attributes.position.needsUpdate = true; o.g.attributes.col.needsUpdate = true; o.g.attributes.size.needsUpdate = true; }
  }
  dispose() { for (const o of [this.fl, this.sm]) { scene.remove(o.pts); o.g.dispose(); } }
}

/* Gestures: k runs 0..1 over the gesture; they adjust pose targets P, hand targets H and the face F */
const GESTURES = {
  reach(k, P, H, F, me, g) { const e = smoothEnv(k, 0.35, 0.4); const v = _lv.copy(g.local); const lean = me.reachLimit(v, g.side === 0 ? 1 : -1); H[g.side].lerp(v, e); P.lean += lean * e; g.snap = true; },
  bet(k, P, H, F, me, g) { const e = smoothEnv(k, 0.35, 0.4); const v = _lv.copy(g.local); const lean = me.reachLimit(v, -1); H[1].lerp(v, e); P.lean += lean * e; P.hp += 0.15 * e; g.snap = true; },
  push(k, P, H, F, me, g) { const e = smoothEnv(k, 0.3, 0.35); for (let s = 0; s < 2; s++) { const v = _lv.copy(g.local); v.x += (s ? -0.09 : 0.09); const lean = me.reachLimit(v, s ? -1 : 1); H[s].lerp(v, e); P.lean += lean * e * 0.5; } Object.assign(F, FACES.focused); g.snap = true; },
  fold(k, P, H, F, me, g) { const v = _lv.copy(g.local); if (k > 0.45) v.z += (k - 0.45) * 0.35; const lean = me.reachLimit(v, -1); H[1].lerp(v, smoothEnv(k, 0.3, 0.3)); P.lean += lean * 0.6 * smoothEnv(k); g.snap = true; },
  think(k, P, H, F, me) { const e = smoothEnv(k, 0.15, 0.15); H[1].lerp(_lv.set(-0.02, 0.37, 0.15), e); P.hr += 0.12 * e; P.hp -= 0.05 * e; F.brow = 0.25; F.squint = 0.2; },
  riffle(k, P, H, F, me, g) { const e = smoothEnv(k, 0.15, 0.2); const v = _lv.copy(g.local); me.reachLimit(v, -1); v.y += 0.03 + Math.abs(Math.sin(k * 60)) * 0.015; H[1].lerp(v, e); },
  still(k, P) { P.breath = 0.1; P.hp += 0.1; },
  stare(k, P, H, F) { const e = smoothEnv(k, 0.2, 0.2); P.lean += 0.16 * e; P.breath = 0.3; F.brow = 0.45; F.squint = 0.35; },
  nervous(k, P, H, F) { const e = smoothEnv(k, 0.15, 0.2), w = Math.sin(k * 40) * 0.025; H[0].lerp(_lv.set(0.05 + w, 0.13, 0.31), e); H[1].lerp(_lv.set(-0.05 - w, 0.13, 0.31), e); P.hy += Math.sin(k * 13) * 0.12 * e; Object.assign(F, FACES.worried); },
  celebrate(k, P, H, F) { const e = smoothEnv(k, 0.15, 0.25), pump = Math.sin(k * Math.PI * 6) * 0.05; H[0].lerp(_lv.set(0.24, 0.78 + pump, 0.06), e); H[1].lerp(_lv.set(-0.24, 0.78 - pump, 0.06), e); P.lean -= 0.1 * e; P.hp -= 0.3 * e; Object.assign(F, FACES.joy); },
  fistpump(k, P, H, F) { const e = smoothEnv(k, 0.15, 0.25), pump = Math.max(0, Math.sin(k * Math.PI * 5)) * 0.08; H[1].lerp(_lv.set(-0.15, 0.4 + pump, 0.2), e); Object.assign(F, FACES.happy); P.hp -= 0.08 * e; },
  smug(k, P, H, F) { const e = smoothEnv(k, 0.2, 0.25); H[0].lerp(_lv.set(0.1, 0.64, -0.05), e); H[1].lerp(_lv.set(-0.1, 0.64, -0.05), e); P.lean -= 0.16 * e; P.hp -= 0.06 * e; Object.assign(F, FACES.smug); },
  slump(k, P, H, F) { const e = smoothEnv(k, 0.2, 0.2); H[0].lerp(_lv.set(0.12, -0.08, 0.15), e); H[1].lerp(_lv.set(-0.12, -0.08, 0.15), e); P.lean -= 0.12 * e; P.hp += 0.5 * e; P.breath = 2; Object.assign(F, FACES.sad); },
  headInHands(k, P, H, F) { const e = smoothEnv(k, 0.2, 0.2); P.lean += 0.32 * e; P.hp += 0.38 * e; H[0].lerp(_lv.set(0.06, 0.47, 0.2), e); H[1].lerp(_lv.set(-0.06, 0.47, 0.2), e); Object.assign(F, FACES.sad); },
  facepalm(k, P, H, F) { const e = smoothEnv(k, 0.2, 0.25); H[1].lerp(_lv.set(-0.01, 0.56, 0.16), e); P.hp += 0.28 * e; P.lean += 0.08 * e; P.hy += Math.sin(k * Math.PI * 4) * 0.12 * e; Object.assign(F, FACES.annoyed); F.mouth = 'frown'; },
  slam(k, P, H, F, me, g) {
    g.snap = true; Object.assign(F, FACES.furious);
    const up = k < 0.42 ? smoothEnv(k / 0.42, 0.4, 0.01) : 0, down = k >= 0.42 ? smoothEnv((k - 0.42) / 0.58, 0.05, 0.4) : 0;
    for (let s = 0; s < 2; s++) { const x = s ? -0.13 : 0.13; if (up) H[s].lerp(_lv.set(x, 0.42, 0.28), up); if (down) H[s].lerp(_lv.set(x, 0.1, 0.38), down); }
    P.lean += 0.12 * (up + down); P.hp += 0.15 * down;
    if (k >= 0.45 && !g.fired) { g.fired = true; if (g.onImpact) g.onImpact(); }
  },
  tap(k, P, H, F, me, g) { g.snap = true; const e = smoothEnv(k, 0.2, 0.25), bob = Math.abs(Math.sin(k * Math.PI * 4)) * 0.055; H[1].lerp(_lv.set(-0.06, 0.1 + bob, 0.37), e); P.lean += 0.05 * e; },
  throwCards(k, P, H, F, me, g) { g.snap = true; const e = smoothEnv(k, 0.15, 0.35); const v = k < 0.4 ? _lv.set(-0.05, 0.12, 0.36) : _lv.set(-0.01, 0.34, 0.5); H[1].lerp(v, e); P.lean += 0.1 * e; Object.assign(F, FACES.furious); },
  sip(k, P, H, F, me, g) { const e = smoothEnv(k, 0.3, 0.3); H[1].lerp(_lv.set(-0.035, 0.6, 0.15), e); P.hp -= 0.22 * Math.max(0, Math.sin(k * Math.PI)) * e; },
  nod(k, P, H, F) { const e = smoothEnv(k, 0.1, 0.2); P.hp += Math.sin(k * Math.PI * 4) * 0.2 * e; Object.assign(F, FACES.wink); },
  headShake(k, P, H, F) { const e = smoothEnv(k, 0.15, 0.2); P.hy += Math.sin(k * Math.PI * 6) * 0.36 * e; P.hp += 0.12 * e; Object.assign(F, FACES.annoyed); F.mouth = 'frown'; },
  shrug(k, P, H, F) { const e = smoothEnv(k, 0.2, 0.25); H[0].lerp(_lv.set(0.3, 0.22, 0.22), e); H[1].lerp(_lv.set(-0.3, 0.22, 0.22), e); P.hr += 0.16 * e; Object.assign(F, FACES.worried); F.mouth = 'flat'; },
  clap(k, P, H, F) { const e = smoothEnv(k, 0.15, 0.2), o = (Math.sin(k * Math.PI * 14) * 0.5 + 0.5) * 0.08 + 0.015; H[0].lerp(_lv.set(o, 0.3, 0.26), e); H[1].lerp(_lv.set(-o, 0.3, 0.26), e); Object.assign(F, FACES.happy); },
  wave(k, P, H, F) { const e = smoothEnv(k, 0.15, 0.2); H[1].lerp(_lv.set(-0.26 + Math.sin(k * Math.PI * 8) * 0.05, 0.58, 0.14), e); Object.assign(F, FACES.happy); },
  // Dealer moves
  pitch(k, P, H, F, me, g) {
    g.snap = true; const deck = _lv.set(0.08, 0.2, 0.34);
    if (k < 0.32) H[1].lerp(deck, smoothEnv(k / 0.32, 0.6, 0.01));
    else if (k < 0.62) { const v = _T.copy(g.local); me.reachLimit(v, -1); v.y = Math.max(v.y, 0.14); H[1].copy(deck).lerp(v, smoothEnv((k - 0.32) / 0.3, 0.7, 0.01) * 0.75); }
    else { const v = _T.copy(g.local); me.reachLimit(v, -1); v.y = Math.max(v.y, 0.14); H[1].copy(deck).lerp(v, 0.75 * (1 - (k - 0.62) / 0.38)); }
    P.twist = clamp(Math.atan2(g.local.x, g.local.z), -0.5, 0.5) * 0.35;
  },
  place(k, P, H, F, me, g) { const e = smoothEnv(k, 0.4, 0.35); const v = _lv.copy(g.local); const lean = me.reachLimit(v, -1); v.y = Math.max(v.y, 0.06); H[1].lerp(v, e); P.lean += lean * e; g.snap = true; },
  sweep(k, P, H, F, me, g) {
    const e = smoothEnv(k, 0.25, 0.3), m = Math.min(1, k / 0.75);
    H[0].lerp(_lv.set(lerp(0.42, 0.1, m), 0.09, lerp(0.42, 0.6, m)), e); H[1].lerp(_lv.set(lerp(-0.42, -0.1, m), 0.09, lerp(0.42, 0.6, m)), e);
    P.lean += 0.22 * e; g.snap = true;
  },
  pushTo(k, P, H, F, me, g) {
    const e = smoothEnv(k, 0.25, 0.3), m = Math.min(1, k / 0.8);
    const a = _T.copy(g.local), b = _E.copy(g.local2); me.reachLimit(a, 1); me.reachLimit(b, 1);
    const v = _lv.copy(a).lerp(b, m * 0.7); v.y = 0.09;
    H[0].lerp(_hx.copy(v).setX(v.x + 0.08), e); H[1].lerp(_hz.copy(v).setX(v.x - 0.08), e);
    P.lean += 0.28 * e; Object.assign(F, FACES.neutral); g.snap = true;
  },
  gather(k, P, H, F, me, g) { const e = smoothEnv(k, 0.3, 0.3), m = Math.min(1, k / 0.8); for (let s = 0; s < 2; s++) H[s].lerp(_lv.set(s ? -0.12 : 0.12, 0.09, lerp(0.7, 0.42, m)), e); P.lean += 0.25 * e * (1 - m); g.snap = true; },
};

/* --- People at the table --- */
const people = [];
let dealerP = null;
const _hw = new V3(), _hw2 = new V3(), _boardPt = new V3();
const personKey = p => p ? p.name + '|' + p.persona : '';
function syncPeople() {
  if (!G.ok) return;
  for (let i = 1; i < NS; i++) {
    const p = S.players[i], cur = people[i];
    if (!p) { if (cur) { cur.dispose(); people[i] = null; } continue; }
    if (!cur || cur.key !== personKey(p)) {
      if (cur) cur.dispose();
      const np = new Person(p.persona, hashStr(p.name)); np.key = personKey(p);
      scene.add(np.root); people[i] = np;
    }
    const pp = people[i];
    if (p.out) pp.root.visible = false;
    else if (!pp.root.visible || pp.alpha < 1) { pp.root.visible = true; pp.alpha = 1; for (const m of pp.mats) { m.opacity = 1; m.transparent = false; m.needsUpdate = true; } }
    pp.emo = null; pp.gest = null;
  }
  placePeople();
}
function placePeople() {
  for (let i = 1; i < NS; i++) { const pp = people[i], s = A.seats[i]; if (!pp || !s) continue; pp.root.position.copy(s.body); pp.root.lookAt(s.face || new V3()); pp.root.updateMatrixWorld(true); }
  if (dealerP && A.dealerBody) { dealerP.root.position.copy(A.dealerBody); dealerP.root.lookAt(0, 0, 0); dealerP.root.updateMatrixWorld(true); }
}
let lastPT = 0;
function updatePeople(now) {
  const t = now / 1000, dt = Math.min(0.05, lastPT ? t - lastPT : 0.016); lastPT = t;
  fireScale();
  for (let i = 1; i < NS; i++) { const q = people[i]; if (!q) continue; if (q.root.visible) q.update(dt, t); else if (q.fire) { q.fire.fl.pts.visible = q.fire.sm.pts.visible = false; } }
  Bar.update(dt, t);
  if (dealerP) {
    dealerP.update(dt, t);
    if (dealerP.holding && deckMesh) { dealerP.handWorld(0, _hw); deckMesh.position.set(_hw.x, _hw.y + 0.028, _hw.z); deckMesh.rotation.y = dealerP.root.rotation.y; A.deck.copy(deckMesh.position); }
  }
}
function dealerHold(on) {
  if (!dealerP || S.test || !deckMesh) return;
  dealerP.holding = on;
  if (!on) {
    const a = deckMesh.position.clone(), b = new V3(A.deckRest.x, 0.011, A.deckRest.z);
    bg(animate(360, e => { deckMesh.position.lerpVectors(a, b, e); }, easeInOut).then(() => { A.deck.copy(A.deckRest); deckMesh.rotation.y = 0; }));
  }
}
const pGest = (i, name, dur, opts) => { const pp = people[i]; if (pp && pp.root.visible && !S.test) pp.gesture(name, dur, opts); };
const pEmote = (i, face, secs) => { const pp = people[i]; if (pp && !S.test) pp.emote(face, secs); };
const dGest = (name, dur, opts) => { if (dealerP && !S.test) dealerP.gesture(name, dur, opts); };
function seatHeadWorld(i, out) {
  if (i === 0) return out.copy(A.seats[0].pos).setY(0.42);
  const pp = people[i]; if (pp) { pp.headTopWorld(out); out.y -= 0.12; return out; }
  return out.copy(A.seats[i].pos);
}
function lookAt(i) {
  if (S.test || !G.ok) return;
  const tgt = i < 0 ? _boardPt.set(0, 0, A.boardZ) : seatHeadWorld(i, new V3());
  for (let k = 1; k < NS; k++) { const pp = people[k]; if (!pp || (pp.glareUntil && performance.now() < pp.glareUntil)) continue; pp.look = k === i ? A.seats[k].card.clone() : tgt.clone(); }
  if (dealerP) dealerP.look = tgt.clone();
}
function dealerSay(id, fallback, priority = false) {
  if (S.test) return;
  let dur = 0;
  const pool = LINES.dealer && LINES.dealer[id];
  if (settings.voice && settings.sound && pool && pool.length && VO.has('dealer')) dur = VO.play(pick(pool).id, 1);
  if (!dur && fallback && !VO.has('dealer')) { Voice.say(fallback, priority); dur = settings.voice && settings.sound ? clamp(fallback.length * 0.065, 0.6, 3.5) : 0; }
  if (dur && dealerP) dealerP.talk(dur);
}
const REACT = {
  badBeat:      { maniac: ['slam', 2.2], station: ['headInHands', 2.6], rock: ['headShake', 1.8], shark: ['stare', 2.2], pro: ['shrug', 1.8] },
  missDraw:     { maniac: ['facepalm', 2.0], station: ['slump', 2.4], rock: ['headShake', 1.6], shark: ['headShake', 1.6], pro: ['shrug', 1.6] },
  lose:         { maniac: ['facepalm', 1.8], station: ['slump', 2.2], rock: ['slump', 2.0], shark: ['headShake', 1.5], pro: ['shrug', 1.5] },
  foldedWinner: { maniac: ['headInHands', 2.2], station: ['facepalm', 2.0], rock: ['facepalm', 1.8], shark: ['facepalm', 1.6], pro: ['shrug', 1.6] },
  winBig:       { maniac: ['celebrate', 2.4], station: ['celebrate', 2.2], rock: ['fistpump', 1.6], shark: ['smug', 2.4], pro: ['fistpump', 1.4] },
  winSmall:     { maniac: ['fistpump', 1.2] },
  suckout:      { maniac: ['celebrate', 2.0], station: ['clap', 1.6], rock: ['fistpump', 1.2], shark: ['smug', 2.0], pro: ['shrug', 1.4] },
  bust:         { maniac: ['headInHands', 2.4], station: ['headInHands', 2.4], rock: ['slump', 2.4], shark: ['headShake', 2.0], pro: ['shrug', 2.0] },
};
function react(p, kind, o = {}) {
  if (!p || p.isHero || S.test) return;
  const pp = people[p.i]; if (!pp) return;
  const g = (REACT[kind] || {})[p.persona], run = RUN;
  setTimeout(() => {
    if (run !== RUN || people[p.i] !== pp) return;
    pp.emote(faceFor(p.persona, kind), 4.5);
    if (g) {
      const opts = g[0] === 'slam' ? { onImpact: () => { Sound.thud(); Sound.chips(3, 0.5); } } : {};
      pp.gesture(g[0], g[1], opts);
      if (g[0] === 'stare') pp.look = seatHeadWorld(0, new V3());
    }
  }, (o.delay || 0) * spd());
  if (o.say !== false) Chat.say(p, kind, { prob: o.prob ?? 0.85, delay: (o.delay || 0) + 250 });
}
function reactToHand(live, winners, potTotal) {
  if (S.test) return;
  const big = potTotal >= S.bb * 20, wl = [...winners], w = wl[0];
  const best = Math.max(...wl.map(x => x.score || 0));
  let d = 350;
  for (const p of live) {
    if (p.isHero || winners.has(p)) continue;
    let kind = big ? 'lose' : null;
    if (S.board.length === 5 && w) {
      const eq = p.eqAllin != null ? p.eqAllin : runoutEquity([p.hole, w.hole], S.board.slice(0, 4))[0];
      if (eq >= 0.65) kind = 'badBeat'; else if (eq >= 0.12 && eq <= 0.45) kind = 'missDraw';
    }
    if (kind) { react(p, kind, { delay: d }); d += 650; } else pEmote(p.i, 'annoyed', 3);
  }
  for (const p of wl) {
    if (p.isHero) continue;
    const lucky = p.eqAllin != null && p.eqAllin <= 0.3;
    react(p, lucky ? 'suckout' : big ? 'winBig' : 'winSmall', { delay: 150, prob: lucky ? 0.8 : big ? 0.55 : 0.18 });
  }
  if (S.board.length === 5) for (const p of S.players) {
    if (p.isHero || p.out || !p.folded || !dealtIn(p)) continue;
    if (evaluate([...p.hole, ...S.board]) > best) { react(p, 'foldedWinner', { delay: d + 300, prob: 0.9 }); d += 700; }
  }
  for (const p of wl) if (!p.isHero) maybeAITaunt(p, 1.5, live.filter(q => !winners.has(q)));
  if (wl.some(x => x.isHero) && big) {
    const o = shuffled(S.players.filter(q => !q.isHero && !q.out && !live.includes(q)))[0];
    if (o) { Chat.say(o, 'niceHand', { prob: 0.5, delay: 1300 }); if (o.persona === 'station') pGest(o.i, 'clap', 1.6); }
    for (const p of live) if (!p.isHero && !winners.has(p)) pEmote(p.i, p.persona === 'maniac' ? 'angry' : 'annoyed', 4);
  }
}

/* =========================================================
   DOM: seats, labels
   ========================================================= */
const stageEl = $('#stage'), overlayEl = $('#overlay'), potLbl = $('#potLbl'), bannerEl = $('#banner'), toastEl = $('#toast'), dockEl = $('#dock');
const seatEls = [], betLbls = [], headEls = [];
for (let i = 0; i < NS; i++) {
  const s = document.createElement('div'); s.className = 'seat' + (i === 0 ? ' hero' : ''); s.dataset.i = i;
  s.innerHTML = i === 0
    ? `<div class="flames" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="bubble"></div><div class="plate"><div class="nm"></div><div class="stk"></div></div><div class="bty" hidden></div><div class="buzzb" hidden></div><div class="tag"></div><div class="eqb"></div>`
    : `<div class="plate"><div class="nm"></div><div class="stk"></div><i class="tbar"></i></div><div class="fume" aria-hidden="true">Fuming</div><div class="rivb" aria-hidden="true">Rival</div><div class="bty" hidden></div><div class="buzzb" hidden></div><div class="eqb"></div>`;
  s.querySelector('.plate').addEventListener('click', e => { e.stopPropagation(); if (typeof plateTap === 'function') plateTap(i, e.currentTarget); else openPlayer(i); });
  overlayEl.appendChild(s); seatEls.push(s);
  const h = document.createElement('div'); h.className = 'head';
  if (i > 0) h.innerHTML = '<div class="bubble"></div><div class="tag"></div>'; else h.hidden = true;
  overlayEl.appendChild(h); headEls.push(h);
  const l = document.createElement('div'); l.className = 'lbl off'; overlayEl.appendChild(l); betLbls.push(l);
}
const tagEl = i => (i === 0 ? seatEls[0] : headEls[i]).querySelector('.tag');
const bubbleEl = i => (i === 0 ? seatEls[0] : headEls[i]).querySelector('.bubble');

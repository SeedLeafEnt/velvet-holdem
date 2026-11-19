'use strict';
/* Velvet Hold'em: 08b-police.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Police: every bribe offer adds heat. Now and then a cop patrols the room.
   A bribe can be spotted (more likely with high heat, and while the cop is around);
   the arrest happens at the end of the hand. Opponents lose their stack and leave.
   You go to jail in Career mode (pay bail or beat the guard heads-up), or lose a quick game.
   ========================================================= */
const HEAT = { small: 22, big: 35, decay: 2, from: 30, span: 100, maxP: 0.85, patrolMul: 1.8 };
// the jail guard: a persona that is never dealt into normal games (not enumerable)
Object.defineProperty(PERSONAS, 'cop', { enumerable: false, value: { label: 'Prison guard', desc: 'Plays it by the book. Hard to bluff.', tight: .58, aggr: .55, bluff: .08, sticky: false, trap: .15, adapt: .8, read: 'Calm and steady. Bets firmly when strong.' } });
EXTRA_LINES.cop = { taunt: ['Nice try, inmate.', 'You are not going anywhere.'], angry: ['Watch it.', 'Careful now.'], shrug: ['Nope.', 'Not today.'], tipOffer: [] };
const JAIL_THEME = { felt: ['#5d6b6a', '#4a5655', '#2f3837'], logo: 'COUNTY JAIL', sub: 'HEADS-UP · WIN TO WALK FREE', rail: '#2b2e33', sheen: '#646b75', spot: 0xe4ecff, floor: '#aeb7c2' };

function addHeat(p, n) {
  if (!p) return;
  p.heat = clamp(Math.round((p.heat || 0) + n), 0, 100);
  if (p.isHero && S.career && !S.test) { const d = Career.load(); d.heat = p.heat; Career.save(); }
  renderHeat(p.i);
}
function heatTick() { for (const p of S.players) if (p && p.heat > 0) addHeat(p, -HEAT.decay); }
function renderHeat(i) {
  const p = S.players[i], el = seatEls[i] && seatEls[i].querySelector('.heatb'); if (!el) return;
  const h = p && !p.out ? p.heat || 0 : 0;
  el.hidden = h < 10; if (el.hidden) return;
  el.className = 'heatb ' + (h >= 60 ? 'hot' : h >= 30 ? 'warm' : '');
  el.textContent = `Heat ${h}`;
}
const policeChip = document.createElement('div'); policeChip.className = 'policechip'; policeChip.hidden = true; policeChip.innerHTML = '<i></i>Police on patrol'; overlayEl.appendChild(policeChip);

const _pv = new V3();
const Police = {
  patrol: 0, wanted: new Set(), cop: null, mode: 'off', move: null, face: null, pause: 0, leg: 0, Y: 0,
  catchChance(p) { const h = (p && p.heat) || 0; return Math.min(0.95, clamp((h - HEAT.from) / HEAT.span, 0, HEAT.maxP) * (this.patrol > 0 ? HEAT.patrolMul : 1)); },
  onBribe(p, size) {
    addHeat(p, HEAT[size] || HEAT.small);
    if (S.jail || p.out) return;
    if (Math.random() < this.catchChance(p)) {
      this.wanted.add(p);
      if (!S.test) toast(p.isHero ? 'Someone saw that...' : `${p.name}'s bribe was spotted`, 2400);
    }
  },
  handStart() {
    if (S.jail) { this.patrol = 0; this.renderChip(); return; }
    if (this.patrol > 0) this.patrol--;
    else if (Math.random() < 0.12) this.patrol = 2 + ((Math.random() * 2) | 0);
    this.renderChip();
    if (S.test || !G.ok) return;
    if (this.patrol > 0 && this.mode === 'off') this.startPatrol();
    if (this.patrol === 0 && this.mode === 'patrol') this.endPatrol();
  },
  renderChip() { policeChip.hidden = !(this.patrol > 0 && S.started && !S.test && !Casino.active); },
  reset() {
    this.patrol = 0; this.wanted.clear(); this.move = null; this.mode = 'off'; this.face = null;
    if (this.cop) this.cop.root.visible = false;
    stageEl.classList.remove('siren', 'busted'); this.renderChip();
  },

  /* ---------- the walking officer ---------- */
  ensureCop() {
    if (this.cop || !G.ok) return this.cop;
    const c = new Person('copWalk', 41, false); scene.add(c.root); c.root.visible = false; c.root.scale.setScalar(WAIT_S);
    c.rest[0].set(0.2, -0.05, 0.12); c.rest[1].set(-0.2, -0.05, 0.12); c.handC[0].copy(c.rest[0]); c.handC[1].copy(c.rest[1]);
    this.cop = c; this.Y = WAIT_Y; return c;
  },
  appear(at) { const c = this.ensureCop(); if (!c) return; if (!c.root.visible) { c.root.position.copy(at); c.root.position.y = this.Y; c.root.visible = true; c.alpha = 1; } },
  walkPath(path, speed = 1.1) { return new Promise(res => { this.move = { path, k: 0, speed, done: res }; }); },
  // patrol spots: just behind the dealer, where the officer shows on phones and computers alike
  // patrol spots: in the gap between the dealer and the player to his right, a step further back, so the officer never stands over a chair
  beat(k) {
    const db = A.dealerBody, right = [1, 2, 3, 4].map(i => A.seats[i]).filter(s => s && s.body.x > 0.2).sort((a, b) => a.body.z - b.body.z)[0];
    const gx = right ? (db.x + right.body.x) / 2 : db.x + 0.7, gz = Math.min(db.z, right ? right.body.z : db.z) - 0.5;
    return k ? new V3(gx + 0.25, 0, gz - 0.2) : new V3(gx - 0.1, 0, gz);
  },
  startPatrol() { this.mode = 'patrol'; this.appear(Bar.oval(288, 1.45)); this.leg = 0; this.pause = 0; this.walkPath([this.beat(0)], 0.9); },
  endPatrol() { this.mode = 'leaving'; this.walkPath([Bar.oval(288, 1.45)], 1).then(() => { if (this.mode === 'leaving') { this.mode = 'off'; if (this.cop) this.cop.root.visible = false; } }); },
  update(dt, t) {
    const c = this.cop; if (!c || !c.root.visible) return;
    const pos = c.root.position, m = this.move;
    if (m) {
      const tgt = m.path[m.k];
      if (tgt) {
        _pv.set(tgt.x - pos.x, 0, tgt.z - pos.z);
        const dist = _pv.length(), step = m.speed * dt;
        if (dist <= step) { pos.x = tgt.x; pos.z = tgt.z; m.k++; }
        else { pos.x += _pv.x / dist * step; pos.z += _pv.z / dist * step; c.root.rotation.y = lerpAngle(c.root.rotation.y, Math.atan2(_pv.x, _pv.z), Math.min(1, dt * 8)); }
        c.walkPh = (c.walkPh || 0) + step * 13; c.walkAmt = Math.min(1, (c.walkAmt || 0) + dt * 4);
        pos.y = this.Y + Math.abs(Math.sin(c.walkPh)) * 0.012;
      }
      if (m.k >= m.path.length) { this.move = null; m.done(); }
    } else {
      c.walkAmt = Math.max(0, (c.walkAmt || 0) - dt * 5); pos.y = this.Y;
      if (this.face) { _pv.set(this.face.x - pos.x, 0, this.face.z - pos.z); c.root.rotation.y = lerpAngle(c.root.rotation.y, Math.atan2(_pv.x, _pv.z), Math.min(1, dt * 8)); }
      if (this.mode === 'patrol') { // pace slowly along the back of the room, stopping to watch the table
        this.pause -= dt;
        if (this.pause <= 0) { this.leg ^= 1; this.pause = rand(2.5, 4.5); this.walkPath([this.beat(this.leg)], 0.45); }
        this.face = new V3(0, 0, A.boardZ || 0);
      }
    }
    c.update(dt, t);
  },
  siren() {
    if (!Sound.ok()) return;
    const c = Sound.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 1700;
    for (let k = 0; k < 6; k++) { o.frequency.setValueAtTime(660, t + k * 0.55); o.frequency.linearRampToValueAtTime(950, t + k * 0.55 + 0.27); o.frequency.linearRampToValueAtTime(660, t + k * 0.55 + 0.55); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.35); g.gain.setValueAtTime(0.05, t + 2.9); g.gain.linearRampToValueAtTime(0, t + 3.3);
    o.connect(f); f.connect(g); Sound.route(g, 0.15, true); o.start(t); o.stop(t + 3.4);
  },

  /* ---------- arrests, at the end of a hand ---------- */
  async arrests() {
    if (!this.wanted.size) return false;
    const list = [...this.wanted].filter(p => !p.out && S.players[p.i] === p); this.wanted.clear();
    let hero = false;
    for (const p of list) { if (p.isHero) hero = true; await this.arrest(p); }
    return hero;
  },
  async arrest(p) {
    const run = RUN;
    logLine(`${p.name} is arrested for bribing the dealer`);
    if (!S.test && G.ok) { try { await Promise.race([this.animate(p), sleep(12000)]); } catch (e) {} stageEl.classList.remove('siren'); }
    if (run !== RUN) throw ABORT;
    p.heat = 0; renderHeat(p.i);
    if (!p.isHero) {
      S.house = (S.house || 0) + p.chips; p.chips = 0; p.arrested = true; // the stack is seized
      if (Bar.drinks[p.i]) { Bar.drinks[p.i].dispose(); Bar.drinks[p.i] = null; }
      if (!S.test) toast(`${p.name} was arrested. Their chips were seized.`, 3000);
      renderSeat(p.i);
    }
  },
  async animate(p) {
    const c = this.ensureCop(); if (!c) return;
    const prev = this.mode; this.mode = 'arrest'; this.face = null;
    stageEl.classList.add('siren'); this.siren();
    this.appear(Bar.oval(252, 1.45));
    // stand at the player's shoulder, on the side toward the table, so the arrest is in view
    let stand = Bar.approach(p.i).stand;
    if (!p.isHero) { const s = A.seats[p.i], out = new V3(s.body.x, 0, s.body.z), dir = out.clone().normalize(), t = new V3(-dir.z, 0, dir.x), toBoard = Math.sign(-out.z) || 1;
      stand = out.clone().addScaledVector(dir, -0.15).addScaledVector(t, 0.36 * (t.z * toBoard > 0 ? 1 : -1)); }
    const path = Bar.route(stand).slice(1);
    dealerLine('Officer.'); lookAt(p.i);
    await this.walkPath(path, 1.7);
    const target = p.isHero ? A.seats[0].pos.clone().setY(0.35) : seatHeadWorld(p.i, new V3());
    this.face = target; c.look = target.clone();
    c.gesture('reach', 1.3, { world: target, side: 1 });
    const pp = people[p.i];
    if (pp) { pp.emote('sad', 5); pp.look = c.root.position.clone().setY(0.45); pp.gesture('headShake', 1); }
    if (p.isHero) showBubble(0, 'Wait, what?!');
    Sound.thud && Sound.thud();
    bg(banner('Arrested', p.isHero ? 'You were caught bribing the dealer' : `${p.name} · bribing the dealer`, 1700));
    await sleep(1000);
    if (p.isHero) { stageEl.classList.add('busted'); await sleep(1400); return; }
    if (pp) await pp.fade(0, 900).catch(() => {});
    this.face = null; c.look = null;
    await this.walkPath(path.slice().reverse().concat([Bar.oval(252, 1.45)]), 1.7);
    stageEl.classList.remove('siren');
    if (this.patrol > 0 && prev === 'patrol') { this.mode = 'patrol'; this.pause = 0; }
    else { this.mode = 'off'; c.root.visible = false; }
  },
  /* you were arrested: called by afterHand, which then stops the game */
  async heroCaught() {
    const h = S.players[0];
    S.house = (S.house || 0) + h.chips; h.chips = 0; h.out = true; renderSeat(0);
    Clock.stop(); snapshotBetween(true);
    if (S.career) Jail.lockUp();
    await delay(300);
    showArrested(!!S.career);
    return false;
  },
};

function showArrested(career) {
  $('#endKicker').textContent = 'Police';
  $('#endTitle').textContent = 'Arrested';
  $('#endText').textContent = career
    ? `You were caught bribing the dealer. Your chips at this table were seized. Pay ${money(Jail.data().bail)} bail, or beat the guard at heads-up poker to walk free.`
    : 'You were caught bribing the dealer. Your chips were seized and this game is over.';
  $('#endPrize').hidden = true; $('#endStats').innerHTML = statBoxes(sessionStats());
  const ep = $('#endPrimary'), es = $('#endSecondary'); ep.disabled = false;
  if (career) {
    ep.textContent = 'Go to jail'; ep.onclick = () => { closeOverlay('endScreen'); stageEl.classList.remove('busted'); Police.reset(); leaveToLobby(); };
    es.textContent = 'Main menu'; es.onclick = () => { closeOverlay('endScreen'); stageEl.classList.remove('busted'); Police.reset(); clearSave(); showStart(); };
  } else {
    ep.textContent = 'Play again'; ep.onclick = () => { closeOverlay('endScreen'); stageEl.classList.remove('busted'); clearSave(); newGame(S.mode, S.level, null, S.structure); };
    es.textContent = 'Back to lobby'; es.onclick = () => { closeOverlay('endScreen'); stageEl.classList.remove('busted'); Police.reset(); clearSave(); showStart(); };
  }
  Sound.lose(); openOverlay('endScreen');
}

/* =========================================================
   Jail (Career mode): no rooms or casino until you pay bail or beat the guard heads-up.
   Career.load().jail = { since, bail, games }. Career.load().arrests counts arrests.
   ========================================================= */
const Jail = {
  data() { return Career.load().jail || null; },
  bailFor() { const d = Career.load(); return Math.max(200, Math.round((300 + d.bankroll * 0.2 + (d.arrests || 0) * 150) / 50) * 50); },
  lockUp() {
    const d = Career.load(); d.arrests = (d.arrests || 0) + 1;
    d.jail = { since: Cal.min(), bail: this.bailFor(), games: 0 }; d.heat = 0; Career.save();
  },
  pay() {
    const j = this.data(); if (!j) return false;
    if (!Career.spend(j.bail)) { toast('Not enough in your bankroll. The bank may lend you the bail.', 2600); return false; }
    this.release('Bail paid'); return true;
  },
  release(why) { const d = Career.load(); d.jail = null; Career.save(); toast(`${why}. You are free.`, 2800); },
  play() {
    if (!this.data()) return;
    const j = this.data(); j.games++; Career.save();
    ['lobby', 'startScreen', 'endScreen'].forEach(closeOverlay); unlockAudio(); autoCashOutSaved(); clearSave();
    S.career = null; applyTheme(JAIL_THEME);
    newGame('sng', 'sharp', null, 'turbo', { jail: true });
    setTimeout(() => toast('Beat the guard heads-up to walk free', 3200), 1200);
  },
  // newGame calls this for a jail game: you against the guard, the other seats are empty
  seat() {
    const hero = S.players[0];
    S.players = [hero];
    for (let k = 1; k < NS; k++) {
      if (k === 2) { S.players.push(makePlayer(2, 'Sgt. Malone', 'cop', SNG_STACK, 3)); continue; }
      S.players.push(Object.assign(makePlayer(k, `empty${k}`, 'pro', 0, k), { out: true, gone: true, place: k + 1 }));
    }
    S.ann = { bubble: true, hu: true, itm: true };
    BUYIN = 0;
  },
  end(kind) {
    const ep = $('#endPrimary'), es = $('#endSecondary'), j = this.data();
    $('#endKicker').textContent = 'County Jail · heads-up';
    $('#endPrize').hidden = true; $('#endStats').innerHTML = statBoxes(sessionStats()); ep.disabled = false;
    const leave = () => { closeOverlay('endScreen'); applyTheme(null); leaveToLobby(); };
    if (kind === 'champ') {
      this.release('You beat the guard');
      $('#endTitle').textContent = 'Free!'; $('#endText').textContent = 'You beat the guard heads-up. The cell door swings open.';
      FX.confetti(160); Sound.bigWin();
      ep.textContent = 'Career lobby'; ep.onclick = leave;
      es.textContent = 'Main menu'; es.onclick = () => { closeOverlay('endScreen'); applyTheme(null); clearSave(); showStart(); };
    } else {
      $('#endTitle').textContent = 'Still locked up';
      $('#endText').textContent = `The guard won this one. Play again, or pay ${money(j ? j.bail : this.bailFor())} bail from the lobby.`;
      Sound.lose();
      ep.textContent = 'Play the guard again'; ep.onclick = () => { closeOverlay('endScreen'); this.play(); };
      es.textContent = 'Back to the cell'; es.onclick = leave;
    }
    openOverlay('endScreen');
  },
  render(root) {
    const j = this.data(), d = Career.load();
    const card = document.createElement('div'); card.className = 'jailcard';
    card.innerHTML = `<div class="jh"><i class="bars" aria-hidden="true"></i><div><b>County Jail</b><span>Arrested for bribing the dealer · since ${Cal.dateText(j.since)}</span></div></div>
      <p>While you are locked up, the rooms and the casino are closed to you. There are two ways out:</p>
      <div class="games jail"></div>
      <p class="talk-note">Games against the guard so far: ${j.games}. Each one takes game time like any hand. The bank is still open if you need a loan for bail.</p>`;
    const row = card.querySelector('.games');
    const b1 = document.createElement('button'); b1.innerHTML = `Pay bail<small>${money(j.bail)}</small>`; b1.disabled = d.bankroll < j.bail;
    b1.addEventListener('click', () => { Sound.tick(); if (this.pay()) renderLobby(); });
    const b2 = document.createElement('button'); b2.innerHTML = 'Play the guard<small>Heads-up · win to walk free</small>';
    b2.addEventListener('click', () => { Sound.tick(); this.play(); });
    row.append(b1, b2); root.appendChild(card);
  },
};

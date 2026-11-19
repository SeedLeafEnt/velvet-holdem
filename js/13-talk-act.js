'use strict';
/* Velvet Hold'em: 13-talk-act.js. Part of one shared script; see CLAUDE.md for the load order. */

/* ---------- Table talk sheet ---------- */
function renderTalk() {
  const h = S.players[0], cd = Math.max(0, HERO_TAUNT_CD - (performance.now() - heroTauntAt));
  const tg = $('#tauntGrid'); tg.innerHTML = '';
  for (const p of S.players) {
    if (p.isHero || p.out) continue;
    const b = document.createElement('button');
    b.innerHTML = `${escH(p.name)}<small>${isAngry(p) ? 'Already fuming' : PERSONAS[p.persona].label}</small>`;
    b.disabled = h.out || cd > 0;
    b.addEventListener('click', () => { closeOverlay('chatScreen'); taunt(h, p); });
    tg.appendChild(b);
  }
  $('#tauntNote').textContent = h.out ? '' : cd > 0 ? `Ready again in ${Math.ceil(cd / 1000)}s` : 'Hotheads anger easily. Steady players rarely.';
  const pg = $('#tipGrid'); pg.innerHTML = '';
  for (const [size, label, note] of [['small', 'Tip', 'works half the time'], ['big', 'Slip', 'usually works']]) {
    const b = document.createElement('button'), amt = tipAmount(size);
    b.innerHTML = `${label} ${fmt(amt)}<small>${note}</small>`;
    b.disabled = !canTip(h, size);
    b.addEventListener('click', () => { closeOverlay('chatScreen'); Sound.tick(); tipDealer(h, size); });
    pg.appendChild(b);
  }
  $('#tipNote').textContent = h.out ? '' : h.tippedHand === S.handNo ? 'You already tipped this hand' : (h.chips <= tipAmount('small') * 2 ? 'Not enough chips' : `If the dealer bites, your next cards get better. Every bribe adds police heat${(h.heat || 0) ? ` (now ${h.heat})` : ''}${Police.patrol > 0 ? ', and a cop is watching' : ''}. Too much and you get arrested.`);
  renderTalkMore();
}
/* ---------- Tap a person to act: dealer, opponents, and your own seat ---------- */
const actEl = document.createElement('div'); actEl.className = 'actpop'; actEl.hidden = true; stageEl.appendChild(actEl);
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), glCanvas = document.getElementById('gl');
function heroSayTo(p, cat, text) {
  showBubble(0, `${text}, ${p.name}`); Sound.pop();
  const pool = (LINES[p.persona] || {})['r_' + cat] || [];
  if (!pool.length || Math.random() > 0.85) return;
  const run = RUN, line = pick(pool);
  setTimeout(() => { if (run === RUN && S.players[p.i] === p && !p.out) speakLine(p, line, 'reply'); }, rand(800, 1400));
}
const Act = {
  open: null,
  close() { actEl.hidden = true; this.open = null; },
  btn(grid, html, disabled, fn, cls = '') {
    const b = document.createElement('button'); b.innerHTML = html; b.disabled = !!disabled; if (cls) b.className = cls;
    b.addEventListener('click', e => { e.stopPropagation(); this.close(); fn(); }); grid.appendChild(b); return b;
  },
  show(kind, i, x, y) {
    if (!S.started || Casino.active) return;
    const h = S.players[0], now = performance.now(); actEl.innerHTML = '';
    const head = document.createElement('header'), grid = document.createElement('div'); grid.className = 'ag';
    actEl.append(head, grid);
    if (kind === 'opp') {
      const p = S.players[i]; if (!p || p.out) return;
      const g = Rivals.grudge(p.persona), cd = Math.max(0, HERO_TAUNT_CD - (now - heroTauntAt)), price = drinkPrice();
      head.innerHTML = `<b>${escH(p.name)}</b><span>${PERSONAS[p.persona].label}${isAngry(p) ? ' · <em class="hot">Fuming</em>' : g >= 3 ? ' · <em class="riv">Rival</em>' : ''}</span>`;
      this.btn(grid, `Taunt<small>${isAngry(p) ? 'Already fuming' : cd > 0 ? `Ready in ${Math.ceil(cd / 1000)}s` : 'Might make them angry'}</small>`, h.out || cd > 0, () => taunt(h, p));
      this.btn(grid, `Send a drink<small>${DRINKS[FAV_DRINK[p.persona] || 'whisky'].label} · ${fmt(price)}</small>`, h.out || h.chips <= price * 3, () => sendDrink(p));
      this.btn(grid, 'Good luck', false, () => heroSayTo(p, 'goodLuck', 'Good luck'));
      this.btn(grid, 'Nice hand', false, () => heroSayTo(p, 'niceHand', 'Nice hand'));
      this.btn(grid, `Profile &amp; history<small>Their style, your record together</small>`, false, () => openPlayer(i), 'wide');
    } else if (kind === 'dealer') {
      head.innerHTML = `<b>Dealer</b><span>Tips, drinks and side bets${Police.patrol > 0 ? ' · <em class="hot">Police watching</em>' : (h.heat || 0) >= 30 ? ` · <em class="hot">Heat ${h.heat}</em>` : ''}</span>`;
      for (const [size, label, note] of [['small', 'Tip', 'works half the time'], ['big', 'Slip', 'usually works']]) this.btn(grid, `${label} ${fmt(tipAmount(size))}<small>${h.tippedHand === S.handNo ? 'Already tipped this hand' : note}</small>`, !canTip(h, size), () => { Sound.tick(); tipDealer(h, size); });
      const price = drinkPrice(), broke = h.out || h.chips <= price * 3;
      const dr = document.createElement('div'); dr.className = 'ag4'; actEl.appendChild(dr);
      const lab = document.createElement('p'); lab.className = 'anote'; lab.textContent = `Order a drink · ${fmt(price)}`; actEl.insertBefore(lab, dr);
      for (const k of ['whisky', 'martini', 'beer', 'mocktail']) this.btn(dr, DRINKS[k].label, broke, () => heroOrder(k));
      const g2 = document.createElement('div'); g2.className = 'ag'; actEl.appendChild(g2);
      this.btn(g2, `Side bets &amp; jackpot<small>${S.sideFlop ? 'Flop bet placed' : 'Flop colour, bad-beat jackpot'}</small>`, false, () => { setTalkTab('bets'); renderTalk(); openOverlay('chatScreen'); }, 'wide');
    } else {
      head.innerHTML = '<b>You</b><span>React at the table</span>';
      const myTurn = !!S.heroResolve, toCall = Math.max(0, S.currentBet - h.bet);
      this.btn(grid, `Tap the table<small>${myTurn && toCall === 0 ? 'Checks' : 'Just a knock'}</small>`, h.out, heroTap);
      this.btn(grid, 'Celebrate<small>After you win a pot</small>', now - Hero.winAt > 12000, heroCelebrate);
      const canThrow = myTurn || (now - Hero.lossAt < 12000 && (h.cards || []).some(c => liveCards.has(c)));
      this.btn(grid, `Throw your cards<small>${myTurn ? 'Folds your hand' : 'After a lost showdown'}</small>`, !canThrow, heroThrow);
      const srOn = S.heroSlowRoll === S.handNo;
      this.btn(grid, `Slow-roll${srOn ? ' · on' : ''}<small>${srOn ? 'Tap to cancel' : 'If you win this hand'}</small>`, !(S.inHand && inHand(h)), heroSlowRollToggle, srOn ? 'on' : '');
      const sr = document.createElement('div'); sr.className = 'ag3'; const lab = document.createElement('p'); lab.className = 'anote'; lab.textContent = 'Say to the table';
      actEl.append(lab, sr);
      for (const [cat, text] of HERO_PHRASES) this.btn(sr, text, false, () => heroSay(cat, text));
    }
    // place it next to where you tapped, kept inside the table area
    actEl.hidden = false; this.open = { kind, i };
    const W = stageEl.clientWidth, H = stageEl.clientHeight, w = actEl.offsetWidth, hh = actEl.offsetHeight;
    let left = clamp(x - w / 2, 8, W - w - 8), top = y + 14;
    if (top + hh > H - 8) top = y - hh - 14;
    actEl.style.left = left + 'px'; actEl.style.top = clamp(top, 8, Math.max(8, H - hh - 8)) + 'px';
    Sound.tick();
  },
};
// tap on the 3D table: find the person under your finger
stageEl.addEventListener('click', e => {
  if (e.target !== glCanvas || !S.started || Casino.active || !G.ok) return;
  const r = glCanvas.getBoundingClientRect();
  _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  _ray.setFromCamera(_ndc, camera);
  const roots = [];
  for (let k = 1; k < NS; k++) if (people[k] && people[k].root.visible && S.players[k] && !S.players[k].out) roots.push(people[k].root);
  if (dealerP) roots.push(dealerP.root);
  const hit = _ray.intersectObjects(roots, true)[0];
  const sr = stageEl.getBoundingClientRect(), x = e.clientX - sr.left, y = e.clientY - sr.top;
  if (!hit) { if (Act.open) Act.close(); return; }
  const who = hit.object.userData.person;
  if (who === dealerP) Act.show('dealer', -1, x, y);
  else { const k = people.indexOf(who); if (k > 0) Act.show('opp', k, x, y); }
});
document.addEventListener('pointerdown', e => { if (Act.open && !actEl.contains(e.target) && !e.target.closest('.plate') && e.target !== glCanvas) Act.close(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && Act.open) Act.close(); });
// on a computer, show a hand cursor over anyone you can tap
let _hoverAt = 0;
glCanvas.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || !S.started || Casino.active || !G.ok) return;
  const t = performance.now(); if (t - _hoverAt < 90) return; _hoverAt = t;
  const r = glCanvas.getBoundingClientRect();
  _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  _ray.setFromCamera(_ndc, camera);
  const roots = [];
  for (let k = 1; k < NS; k++) if (people[k] && people[k].root.visible && S.players[k] && !S.players[k].out) roots.push(people[k].root);
  if (dealerP) roots.push(dealerP.root);
  glCanvas.style.cursor = _ray.intersectObjects(roots, true).length ? 'pointer' : '';
});
function plateTap(i, el) {
  const sr = stageEl.getBoundingClientRect(), r = el.getBoundingClientRect();
  Act.show(i === 0 ? 'hero' : 'opp', i, r.left + r.width / 2 - sr.left, r.top + r.height / 2 - sr.top);
}
function actHint() {
  try { if (localStorage.getItem('velvet3d-hint-act')) return; localStorage.setItem('velvet3d-hint-act', '1'); } catch (e) { return; }
  setTimeout(() => { if (S.started) toast('Tip: tap a player or the dealer to interact', 4200); }, 4500);
}

let talkTab = 'talk';
function setTalkTab(t) {
  talkTab = t;
  document.querySelectorAll('#talkTabs button').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  document.querySelectorAll('#chatScreen .pane').forEach(pn => pn.hidden = pn.dataset.pane !== t);
}
document.querySelectorAll('#talkTabs button').forEach(b => b.addEventListener('click', () => { Sound.tick(); setTalkTab(b.dataset.tab); renderTalk(); }));
function talkBtn(grid, html, disabled, fn, keepOpen) {
  const b = document.createElement('button'); b.innerHTML = html; b.disabled = !!disabled;
  b.addEventListener('click', () => { if (!keepOpen) closeOverlay('chatScreen'); fn(); if (keepOpen) renderTalk(); });
  grid.appendChild(b); return b;
}
function renderTalkMore() {
  const h = S.players[0], now = performance.now(), myTurn = !!S.heroResolve, toCall = Math.max(0, S.currentBet - h.bet);
  // React
  const rg = $('#reactGrid'); rg.innerHTML = '';
  talkBtn(rg, `Tap the table<small>${myTurn && toCall === 0 ? 'Checks' : 'Just a knock'}</small>`, h.out, heroTap);
  talkBtn(rg, `Celebrate<small>After you win a pot</small>`, now - Hero.winAt > 12000, heroCelebrate);
  const canThrow = myTurn || (now - Hero.lossAt < 12000 && (h.cards || []).some(c => liveCards.has(c)));
  talkBtn(rg, `Throw your cards<small>${myTurn ? 'Folds your hand' : 'After a lost showdown'}</small>`, !canThrow, heroThrow);
  const srOn = S.heroSlowRoll === S.handNo;
  const sb = talkBtn(rg, `Slow-roll${srOn ? ' · on' : ''}<small>${srOn ? 'Tap to cancel' : 'If you win this hand'}</small>`, !(S.inHand && inHand(h)), heroSlowRollToggle, true);
  sb.classList.toggle('on', srOn);
  $('#reactNote').textContent = 'Celebrating or slow-rolling can tilt the players you beat, and they remember it.';
  // Side bet
  const seg = $('#sideSize'); seg.innerHTML = '';
  for (const n of [2, 5, 10]) { const b = document.createElement('button'); b.textContent = fmt(r5(S.bb * n)); b.className = SIDE.size === n ? 'on' : ''; b.addEventListener('click', () => { SIDE.size = n; Sound.tick(); renderTalk(); }); seg.appendChild(b); }
  const amt = r5(S.bb * SIDE.size), noBet = !!S.sideFlop || h.out || h.chips <= amt * 2;
  const sg = $('#sideGrid'); sg.innerHTML = '';
  talkBtn(sg, `<i class="dot red"></i>Red<small>pays 1 to 1</small>`, noBet, () => placeFlopBet('red'), true);
  talkBtn(sg, `<i class="dot black"></i>Black<small>pays 1 to 1</small>`, noBet, () => placeFlopBet('black'), true);
  talkBtn(sg, `<i class="dot mono"></i>Same colour<small>pays 3 to 1</small>`, noBet, () => placeFlopBet('mono'), true);
  const b = S.sideFlop;
  $('#sideNote').textContent = b ? `Your bet: ${b.pick === 'mono' ? 'all one colour' : b.pick} · ${fmt(b.amt)}. It settles on the next flop.` : 'Guess the colour of the next flop. Mostly red or mostly black pays even money; all three the same colour pays 3 to 1.';
  // Jackpot
  $('#jpBox').innerHTML = `<div><span>Jackpot</span><b>${fmt(Jackpot.pool)}</b></div>`;
  const jb = document.createElement('button'); jb.className = 'jpbtn' + (Jackpot.on ? ' on' : ''); jb.textContent = Jackpot.on ? 'Joined · tap to leave' : `Join · ${fmt(JACKPOT_FEE)} a hand`;
  jb.addEventListener('click', () => { Jackpot.on = !Jackpot.on; Sound.tick(); renderTalk(); }); $('#jpBox').appendChild(jb);
  // Bar
  const price = drinkPrice(), broke = h.out || h.chips <= price * 3, busy = (Bar.queue.length + (Bar.job ? 1 : 0)) >= 3;
  const bg2 = $('#barGrid'); bg2.innerHTML = '';
  for (const k of ['whisky', 'martini', 'beer', 'mocktail']) talkBtn(bg2, `${DRINKS[k].label}<small>${fmt(price)}</small>`, broke || busy, () => heroOrder(k));
  $('#barNote').textContent = broke ? 'Not enough chips.' : busy ? 'The waitress is busy. Try again in a moment.' : "Your drink comes via the dealer. It helps you cool off if you're fuming.";
  const sgd = $('#sendGrid'); sgd.innerHTML = '';
  for (const p of S.players) { if (p.isHero || p.out) continue; talkBtn(sgd, `${escH(p.name)}<small>${DRINKS[FAV_DRINK[p.persona] || 'whisky'].label} · ${fmt(price)}</small>`, broke || busy, () => sendDrink(p)); }
  $('#sendNote').textContent = 'A drink softens a grudge, and often cools an angry player down.';
  $('#jpNote').textContent = 'If anyone loses at showdown with a full house or better, it pays out: half to that player, a quarter to the winner, the rest shared by everyone dealt in. You get a share only while you\'re in.';
}

function proj(v, x = 0, y = 0, z = 0) { _v.set(v.x + x, v.y + y, v.z + z).project(camera); return { x: (_v.x + 1) / 2 * G.W, y: (1 - _v.y) / 2 * G.H }; }
function updateOverlay() {
  if (!A.seats[0]) return;
  for (let i = 0; i < NS; i++) {
    const s = A.seats[i]; if (!s) continue;
    const p = proj(s.pos);
    const y = i === 0 ? Math.min(p.y, G.H - 20) : p.y;
    seatEls[i].style.transform = `translate(${p.x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    if (i > 0) {
      const pp = people[i], vis = pp && pp.root.visible;
      const hp = vis ? proj(pp.headTopWorld(_hw)) : proj(s.headTop);
      headEls[i].style.transform = `translate(${clamp(hp.x, 44, G.W - 44).toFixed(1)}px, ${Math.max(hp.y, 26).toFixed(1)}px)`;
      headEls[i].style.visibility = vis || !people[i] ? '' : 'hidden';
    }
    const l = betLbls[i];
    if (!l.classList.contains('off')) { const q = proj(s.bet, s.d.x * -0.055, 0, s.d.z * -0.055); l.style.transform = `translate(${q.x.toFixed(1)}px, ${(q.y + 2).toFixed(1)}px) translate(-50%, -50%)`; }
  }
  if (dealerP) { const dh = proj(dealerP.headTopWorld(_hw)); dealerHeadEl.style.transform = `translate(${dh.x.toFixed(1)}px, ${Math.max(dh.y, 20).toFixed(1)}px)`; }
  const pp = proj(A.pot, 0, 0, -0.085); potLbl.style.transform = `translate(${pp.x.toFixed(1)}px, ${(pp.y - 4).toFixed(1)}px) translate(-50%, -100%)`;
  const bp = proj(A.banner); bannerEl.style.left = bp.x.toFixed(1) + 'px'; bannerEl.style.top = bp.y.toFixed(1) + 'px';
}
function updateEdgeClasses() {
  for (let i = 1; i < NS; i++) {
    if (!A.seats[i]) continue;
    const p = proj(A.seats[i].headTop), el = headEls[i];
    el.classList.toggle('al', p.x < 100); el.classList.toggle('ar', p.x > G.W - 100);
    el.classList.toggle('bb', p.y < 110);
  }
}

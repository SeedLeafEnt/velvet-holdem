'use strict';
/* Velvet Hold'em: 15-hud.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Seats & HUD
   ========================================================= */
function renderSeat(i) {
  const p = S.players[i], el = seatEls[i];
  if (!p || p.gone) { el.hidden = true; if (i) headEls[i].hidden = true; return; }
  el.hidden = false; if (i) headEls[i].hidden = false;
  el.querySelector('.nm').textContent = p.isHero ? 'You' : p.name;
  el.querySelector('.stk').textContent = p.out ? (S.mode === 'sng' && p.place ? `Out · ${ordinal(p.place)}` : 'Out') : (p.allIn && S.inHand ? 'All-in' : fmt(p.chips));
  el.classList.toggle('out', p.out);
  el.classList.toggle('folded', S.inHand && !p.out && p.folded);
  setPile('stack' + i, p.out ? 0 : p.chips);
  renderBuzz(i); renderHeat(i);
}
function renderBet(i) {
  const p = S.players[i], l = betLbls[i];
  const amt = p ? p.bet : 0;
  setPile('bet' + i, amt);
  if (amt > 0) { l.textContent = fmt(amt); l.classList.remove('off'); } else l.classList.add('off');
}
function renderSeats() { for (let i = 0; i < NS; i++) { renderSeat(i); renderBet(i); } }
function renderPot() {
  setPile('pot', S.pot);
  if (S.pot <= 0) { potLbl.classList.add('off'); return; }
  potLbl.classList.remove('off');
  potLbl.querySelector('.main').textContent = `Pot ${fmt(S.pot)}`;
  const pots = buildPots(S.players).filter(x => x.amount > 0);
  potLbl.querySelector('.side').textContent = pots.length > 1 ? pots.map((x, k) => (k === 0 ? 'Main ' : 'Side ') + fmt(x.amount)).join(' · ') : '';
}
function setTag(i, text, cls) {
  const t = tagEl(i);
  t.className = 'tag'; void t.offsetWidth;
  if (!text) { t.textContent = ''; return; }
  t.textContent = text; t.className = 'tag show ' + cls;
}
function clearTags(keep) {
  for (let i = 0; i < NS; i++) {
    const t = tagEl(i);
    if (keep && (t.classList.contains('fold') || t.classList.contains('allin'))) continue;
    t.className = 'tag'; t.textContent = '';
  }
}
function setActive(i) { seatEls.forEach((el, k) => el.classList.toggle('active', k === i)); lookAt(i); }
function setEq(i, v) { const b = seatEls[i].querySelector('.eqb'); if (v == null) { b.classList.remove('show'); return; } b.textContent = Math.round(v * 100) + '%'; b.classList.add('show'); }
function animateNumber(el, from, to, dur) {
  if (S.test) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), d = Math.max(1, dur * spd());
  const step = now => { const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function toast(msg, ms = 2400) {
  if (S.test) return;
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove('show'), ms);
}
async function banner(t1, t2, hold = 1500) {
  bannerEl.querySelector('.b1').textContent = t1;
  const b2 = bannerEl.querySelector('.b2'); b2.textContent = t2 || ''; b2.style.display = t2 ? '' : 'none';
  bannerEl.className = ''; void bannerEl.offsetWidth; bannerEl.className = 'show';
  potLbl.style.opacity = '0';
  try { await delay(hold); } catch (e) { /* new game started */ }
  bannerEl.className = 'hide'; potLbl.style.opacity = '';
}

/* =========================================================
   Table talk
   ========================================================= */
const Chat = {
  lastAt: 0, seatAt: new Array(NS).fill(0),
  say(p, cat, o = {}) {
    if (!settings.chat || S.test || !p || p.isHero) return false;
    const pool = linesFor(p.persona, cat); if (!pool.length) return false;
    const now = performance.now();
    if (!o.force && (Math.random() > (o.prob ?? 1) || now - this.lastAt < 2600 || now - this.seatAt[p.i] < 7000)) return false;
    this.lastAt = now; this.seatAt[p.i] = now;
    const line = pick(pool), run = RUN;
    setTimeout(() => { if (run === RUN && S.players[p.i] === p) speakLine(p, line, cat); }, (o.delay || 0) * (o.raw ? 1 : spd()));
    return true;
  }
};
function speakLine(p, line, cat) {
  showBubble(p.i, line.t);
  if (line.act) return;
  let dur = VO.play(line.id, 1);
  const silent = !dur;
  if (silent) dur = clamp(0.45 + line.t.length * 0.055, 0.7, 3);
  if (silent) Sound.pop();
  const pp = people[p.i];
  if (pp) { pp.talk(dur); pp.emote(faceFor(p.persona, cat), Math.max(2.4, dur + 1.2)); }
}
function showBubble(i, text, ms) {
  const b = bubbleEl(i); if (!b) return;
  const act = /^\*.*\*$/.test(text);
  b.textContent = act ? text.slice(1, -1) : text; b.classList.toggle('act', act);
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), ms || clamp(1700 + text.length * 50, 2200, 4400));
}
function clearBubbles() { for (let i = 0; i < NS; i++) { const b = bubbleEl(i); if (!b) continue; clearTimeout(b._t); b.classList.remove('show'); } }
function heroSay(cat, text) {
  showBubble(0, text); Sound.pop();
  const cands = S.players.filter(p => !p.isHero && !p.out);
  if (!cands.length || Math.random() > 0.8) return;
  const p = pick(cands), pool = (LINES[p.persona] || {})['r_' + cat] || [];
  if (!pool.length) return;
  const run = RUN, line = pick(pool);
  setTimeout(() => { if (run === RUN && S.players[p.i] === p) speakLine(p, line, 'reply'); }, rand(900, 1600));
}

/* =========================================================
   Tournament clock
   ========================================================= */
const levelMs = () => LEVEL_MS[S.structure] || LEVEL_MS.turbo;
const Clock = {
  left: 0, last: 0, iv: 0, warned: false, shown: '',
  start() { this.last = performance.now(); clearInterval(this.iv); this.iv = setInterval(() => this.tick(), 500); },
  stop() { clearInterval(this.iv); this.iv = 0; },
  paused() { return S.mode !== 'sng' || !S.started || S.test || document.hidden || !!document.querySelector('.overlay:not([hidden])'); },
  tick() {
    const now = performance.now(), dt = now - this.last; this.last = now;
    if (this.paused() || this.left <= 0) return;
    this.left = Math.max(0, this.left - dt);
    if (this.left <= 10000 && !this.warned && S.blindIdx < SNG_LEVELS.length - 1) { this.warned = true; toast('Blinds go up in 10 seconds'); }
    renderTop();
  }
};
function setBlinds() {
  if (S.mode === 'sng') { [S.sb, S.bb, S.ante] = SNG_LEVELS[Math.min(S.blindIdx, SNG_LEVELS.length - 1)]; }
  else { S.sb = 10; S.bb = 20; S.ante = 0; }
}
function checkLevel() {
  if (S.mode !== 'sng' || S.blindIdx >= SNG_LEVELS.length - 1) return;
  const due = S.test ? (S.handNo > 1 && (S.handNo - 1) % HANDS_PER_LEVEL === 0) : Clock.left <= 0;
  if (!due) return;
  const hadAnte = S.ante > 0;
  S.blindIdx++; setBlinds(); Clock.left = levelMs(); Clock.warned = false;
  Sound.level();
  toast(`Level ${S.blindIdx + 1} · Blinds ${fmt(S.sb)}/${fmt(S.bb)}${S.ante ? ' · Ante ' + fmt(S.ante) : ''}`, 3000);
  dealerSay(S.ante && !hadAnte ? 'antes' : 'blindsUp', `Blinds are now ${S.sb}, ${S.bb}.${S.ante && !hadAnte ? ` Antes of ${S.ante} are now in play.` : ''}`);
  logLine(`Level ${S.blindIdx + 1}: blinds ${fmt(S.sb)}/${fmt(S.bb)}${S.ante ? ', ante ' + fmt(S.ante) : ''}`, 'st');
}

/* =========================================================
   Top bar
   ========================================================= */
function renderTop() {
  const blinds = $('#blinds'), sub = $('#substatus');
  if (!S.started) { blinds.textContent = 'Blinds 10/20'; sub.textContent = 'No-Limit · 5 seats'; return; }
  const b = `Blinds ${fmt(S.sb)}/${fmt(S.bb)}${S.ante ? ' · Ante ' + fmt(S.ante) : ''}`;
  if (blinds.textContent !== b) blinds.textContent = b;
  let html;
  if (S.mode === 'sng') {
    const left = S.players.filter(p => !p.out).length;
    const last = S.blindIdx >= SNG_LEVELS.length - 1;
    const clock = last ? 'final level' : (Clock.left <= 0 ? '<span class="warn">up next hand</span>' : `<span class="${Clock.left <= 30000 ? 'warn' : ''}">${fmtClock(Clock.left)}</span>`);
    html = `Lvl ${S.blindIdx + 1} · ${clock} · ${left} left`;
  } else {
    const hero = S.players[0]; const net = hero.chips + hero.bet - S.heroBuyin;
    html = `Hand ${S.handNo} · Session <span class="${net >= 0 ? 'up' : 'down'}">${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}</span>`;
  }
  if (Clock.shown !== html) { sub.innerHTML = html; Clock.shown = html; }
}

/* =========================================================
   Hero dock
   ========================================================= */
const btnFold = $('#btnFold'), btnCall = $('#btnCall'), btnRaise = $('#btnRaise'), midRow = $('#midRow'), slider = $('#raiseSlider');
let heroEq = null;
function heroHandText() {
  const h = S.players[0];
  if (!h || !dealtIn(h)) return S.started ? (h && h.out ? 'You are out' : 'Waiting for the next hand') : 'Take a seat to begin';
  if (S.board.length === 0) return preflopName(h.hole);
  return handName(evaluate([...h.hole, ...S.board]));
}
function renderInfo() {
  const h = S.players[0];
  let txt = heroHandText();
  if (h && dealtIn(h) && h.folded) txt = `<em>Folded ·</em> ${txt}`;
  $('#handName').innerHTML = txt;
  const show = settings.odds && h && dealtIn(h) && !h.folded && heroEq != null && S.inHand;
  $('#odds').hidden = !show;
  if (show) { $('#oddsVal').textContent = Math.round(heroEq * 100) + '%'; $('#odds .odds-bar i').style.width = Math.round(heroEq * 100) + '%'; }
}
function updateHeroOdds() {
  const h = S.players[0];
  if (!h || !dealtIn(h) || h.folded || S.test) { heroEq = null; renderInfo(); return; }
  const opps = S.players.filter(q => q !== h && inHand(q));
  const filters = opps.map(q => q.pf === 'raise' ? 9 : q.pf === 'call' ? 6 : 0);
  setTimeout(() => { if (!dealtIn(h) || h.folded) return; heroEq = equity(h.hole, S.board, filters, 1500); renderInfo(); }, 30);
}
function raiseBounds(p) { const maxTo = p.bet + p.chips; return { minTo: Math.min(maxTo, S.currentBet + S.minRaise), maxTo }; }
function presets(p) {
  const { minTo, maxTo } = raiseBounds(p);
  const potTotal = S.pot + sumBets(), toCall = S.currentBet - p.bet;
  const unopened = S.board.length === 0 && S.currentBet <= S.bb && S.frc === 0;
  const list = unopened
    ? [['2.5×', S.bb * 2.5], ['3×', S.bb * 3], ['4×', S.bb * 4], ['Pot', S.currentBet + potTotal + toCall]]
    : [['Min', minTo], ['½ Pot', S.currentBet + 0.5 * (potTotal + toCall)], ['¾ Pot', S.currentBet + 0.75 * (potTotal + toCall)], ['Pot', S.currentBet + potTotal + toCall]];
  list.push(['All-in', maxTo]);
  return list.map(([l, v]) => [l, clamp(r5(v), minTo, maxTo)]);
}
function renderDock() {
  const h = S.players[0];
  const myTurn = S.heroResolve && h && S.toAct === 0;
  dockEl.classList.toggle('myturn', !!myTurn && !S.raising);
  dockEl.classList.toggle('raising', !!S.raising);
  $('#sliderRow').hidden = !S.raising; $('#infoRow').hidden = !!S.raising;
  renderInfo();
  midRow.className = ''; midRow.innerHTML = '';
  if (myTurn) {
    const toCall = Math.min(S.currentBet - h.bet, h.chips);
    const cr = canRaise(h);
    btnFold.innerHTML = S.raising ? 'Cancel' : 'Fold';
    btnFold.disabled = S.raising ? false : toCall <= 0;
    btnCall.disabled = false;
    btnCall.innerHTML = toCall <= 0 ? 'Check' : (toCall >= h.chips ? `All-in<small>${fmt(toCall)}</small>` : `Call<small>${fmt(toCall)}</small>`);
    btnRaise.disabled = !cr; btnRaise.classList.toggle('hot', cr && isAngry(h));
    if (S.raising) renderDockRaiseLabel(); else btnRaise.innerHTML = S.currentBet === 0 ? 'Bet' : 'Raise';
    if (cr) {
      presets(h).forEach(([label, v]) => {
        const b = document.createElement('button'); b.className = 'chipbtn' + (S.raising && S.raiseTo === v ? ' on' : '') + (label === 'All-in' && isAngry(h) ? ' hot' : ''); b.textContent = label;
        b.addEventListener('click', () => { Sound.tick(); enterRaise(v); });
        midRow.appendChild(b);
      });
    } else { midRow.className = 'msg'; midRow.textContent = toCall > 0 ? 'Call or fold' : ''; }
  } else {
    btnFold.innerHTML = 'Fold'; btnCall.innerHTML = 'Check'; btnRaise.innerHTML = 'Raise';
    btnFold.disabled = btnCall.disabled = btnRaise.disabled = true; btnRaise.classList.remove('hot');
    if (S.inHand && h && dealtIn(h) && !h.folded && !h.allIn) {
      midRow.className = 'pre';
      [['checkfold', 'Check / Fold'], ['check', 'Check'], ['callany', 'Call any']].forEach(([k, l]) => {
        const b = document.createElement('button'); b.className = 'chipbtn' + (S.pre === k ? ' on' : ''); b.textContent = l;
        b.addEventListener('click', () => { S.pre = S.pre === k ? null : k; Sound.tick(); renderDock(); });
        midRow.appendChild(b);
      });
    } else {
      midRow.className = 'msg';
      midRow.textContent = !S.started ? '' : (h && h.allIn && S.inHand && !h.folded) ? 'You are all-in' : (h && h.folded && S.inHand) ? 'Fast-forwarding to the next hand' : '';
    }
  }
}
function enterRaise(v) {
  const h = S.players[0]; const { minTo, maxTo } = raiseBounds(h);
  S.raising = true; S.raiseTo = clamp(r5(v), minTo, maxTo);
  slider.min = minTo; slider.max = maxTo; slider.step = 5; slider.value = S.raiseTo; syncSliderFill();
  renderDock();
}
function syncSliderFill() { const mn = +slider.min, mx = +slider.max; slider.style.setProperty('--fill', (mx > mn ? (slider.value - mn) / (mx - mn) * 100 : 100) + '%'); }
function renderDockRaiseLabel() {
  const h = S.players[0]; const allin = S.raiseTo >= h.bet + h.chips; const verb = S.currentBet === 0 ? 'Bet' : 'Raise';
  btnRaise.innerHTML = allin ? `All-in<small>${fmt(S.raiseTo)}</small>` : `${verb}<small>${S.currentBet === 0 ? '' : 'to '}${fmt(S.raiseTo)}</small>`;
  const ps = presets(h);
  midRow.querySelectorAll('.chipbtn').forEach((b, k) => b.classList.toggle('on', !!ps[k] && ps[k][1] === S.raiseTo));
}
function heroAct(a) {
  if (!S.heroResolve) return;
  a = drunkHero(a); // when tipsy or drunk your hand sometimes slips
  const r = S.heroResolve; S.heroResolve = null; S.heroReject = null; S.raising = false;
  clearTimeout(heroTurn._slow); clearTimeout(heroTurn._dealer);
  renderDock(); r(a);
}
btnFold.addEventListener('click', () => { if (S.raising) { S.raising = false; Sound.tick(); renderDock(); return; } heroAct({ type: 'fold' }); });
btnCall.addEventListener('click', () => { const h = S.players[0]; heroAct({ type: S.currentBet - h.bet > 0 ? 'call' : 'check' }); });
btnRaise.addEventListener('click', () => {
  const h = S.players[0];
  if (!S.raising) { const ps = presets(h); Sound.tick(); enterRaise(isAngry(h) ? ps[Math.max(0, ps.length - 2)][1] : (S.board.length === 0 && S.frc === 0 ? ps[0][1] : (ps[2] ? ps[2][1] : ps[0][1]))); return; }
  heroAct({ type: 'raise', to: S.raiseTo });
});
slider.addEventListener('input', () => { S.raiseTo = +slider.value; syncSliderFill(); renderDockRaiseLabel(); });
function nudgeRaise(dir) {
  if (!S.raising) return; const h = S.players[0]; const { minTo, maxTo } = raiseBounds(h);
  const step = Math.max(5, S.bb); S.raiseTo = clamp(r5(S.raiseTo + dir * step), minTo, maxTo);
  slider.value = S.raiseTo; syncSliderFill(); renderDockRaiseLabel(); Sound.tick();
}
$('#btnMinus').addEventListener('click', () => nudgeRaise(-1));
$('#btnPlus').addEventListener('click', () => nudgeRaise(1));

function heroTurn() {
  return new Promise((resolve, reject) => {
    S.heroResolve = resolve; S.heroReject = reject; S.raising = false;
    renderDock(); Sound.turn();
    clearTimeout(heroTurn._slow);
    const run = RUN;
    clearTimeout(heroTurn._dealer);
    heroTurn._dealer = setTimeout(() => { if (run === RUN && S.heroResolve && Math.random() < 0.6) dealerSay('heroTurn', 'Action is on you.'); }, 11000);
    heroTurn._slow = setTimeout(() => {
      if (run !== RUN || !S.heroResolve) return;
      const opps = S.players.filter(p => !p.isHero && inHand(p)); const sorted = opps.sort((a, b) => (b.persona === 'maniac' || b.persona === 'shark') - (a.persona === 'maniac' || a.persona === 'shark'));
      if (sorted[0]) Chat.say(sorted[0], 'heroSlow', { force: true, raw: true });
    }, 15000);
  });
}
function consumePre(p) {
  const pre = S.pre; if (!pre) return null; S.pre = null;
  const toCall = S.currentBet - p.bet;
  if (pre === 'checkfold') return toCall > 0 ? { type: 'fold' } : { type: 'check' };
  if (pre === 'check') return toCall > 0 ? null : { type: 'check' };
  if (pre === 'callany') return toCall > 0 ? { type: 'call' } : { type: 'check' };
  return null;
}

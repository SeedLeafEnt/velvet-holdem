'use strict';
/* Velvet Hold'em: 11-stage1.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Stage 1: tilt after bad beats, celebrations, side bets, rivalries
   ========================================================= */
Object.assign(EXTRA_LINES.maniac,  { rivalGreet: ["You! I've been waiting for this.", 'Round two. Let\'s go!'], revenge: ["That's what you get!", 'Payback, baby!'], slowroll: ['Hmm... I dunno, I might have something...', 'Oh, these? Let me see...'], throw: ['Unbelievable!'] });
Object.assign(EXTRA_LINES.shark,   { rivalGreet: ['We meet again.', 'I remember you.'], revenge: ['Revenge is sweet.', 'Now we\'re even.'], slowroll: ['Let me check my cards...', 'Hmm. Is this good?'], throw: ['Disgusting.'] });
Object.assign(EXTRA_LINES.rock,    { rivalGreet: ['Back for more, huh?'], revenge: ["We're square now."], slowroll: ['Well now...'], throw: ['Dang it.'] });
Object.assign(EXTRA_LINES.station, { rivalGreet: ["Oh! It's you again!"], revenge: ['Sorry! ...Not sorry!'], slowroll: ['Oh! I think I win?'], throw: ['Noooo!'] });
Object.assign(EXTRA_LINES.pro,     { rivalGreet: ['Rematch. Good.'], revenge: ['Payback.'], slowroll: ['Hm.'], throw: ['Unreal.'] });
Object.assign(CAT_FACE, { rivalGreet: 'smug', revenge: 'joy', slowroll: 'smug', throw: 'furious' });

/* ---------- Rival badges ---------- */
function updateRivalBadges() {
  for (let i = 1; i < NS; i++) { const p = S.players[i]; if (seatEls[i]) seatEls[i].classList.toggle('rival', !!p && !p.out && !S.test && Rivals.grudge(p.persona) >= 3); }
}
function grudgeWords(g) { return g >= 5 ? 'Out for revenge' : g >= 3 ? 'Heated rivalry' : g >= 1 ? 'Holds a grudge' : 'No hard feelings'; }

/* Players with a grudge against you call your bets lighter and come after you more */
function rivalAdjust(p, a) {
  if (p.isHero) return a;
  const g = Rivals.grudge(p.persona), hero = S.players[0];
  if (g < 2 || !inHand(hero)) return a;
  const toCall = Math.max(0, S.currentBet - p.bet), cr = canRaise(p), r = Math.random();
  if (a.type === 'fold' && S.lastRaiserI === 0 && toCall <= p.chips * 0.4 && r < 0.12 * g) return A_('call');
  if (a.type === 'check' && cr && r < 0.06 * g) return A_('raise', Math.max(S.bb * 2, Math.round((S.pot + sumBets()) * rand(0.5, 0.8))));
  return a;
}
function rivalShowdown(live, winners, potTotal) {
  if (S.test) return;
  const hero = S.players[0], heroIn = live.includes(hero), big = potTotal >= S.bb * 20;
  if (!heroIn) return;
  for (const p of live) {
    if (p.isHero) continue;
    if (winners.has(hero) && !winners.has(p)) { Rivals.bump(p.persona, 'w'); if (big) Rivals.bump(p.persona, 'grudge', 1); }
    else if (winners.has(p) && !winners.has(hero)) { Rivals.bump(p.persona, 'l'); if (big) Rivals.bump(p.persona, 'grudge', -1); }
  }
  updateRivalBadges();
}
function rivalBusts(busted) {
  if (S.test) return;
  const hero = S.players[0], lw = S.lastWinners || new Set();
  for (const p of busted) {
    if (p.isHero) { const k = [...lw].find(q => !q.isHero); if (k) { Rivals.bump(k.persona, 'bustedBy'); Rivals.bump(k.persona, 'grudge', -2); sayExtra(k, 'revenge', 500); } continue; }
    if (lw.has(hero)) { Rivals.bump(p.persona, 'busts'); Rivals.bump(p.persona, 'grudge', 2); }
  }
  updateRivalBadges();
}

/* ---------- Tilt after bad beats (and slow-rolls) ---------- */
const TILT_CHANCE = { maniac: 0.7, shark: 0.35, station: 0.35, rock: 0.25, pro: 0.15, hero: 0.35 };
function tiltCheck(live, winners) {
  const w = [...winners][0]; if (!w) return;
  const sr = S.slowRoller && winners.has(S.slowRoller) ? S.slowRoller : null;
  for (const p of live) {
    if (winners.has(p) || p.out) continue;
    const base = TILT_CHANCE[p.isHero ? 'hero' : p.persona] || 0.3;
    let ch = 0, bad = false;
    if (S.board.length === 5 && p.hole.length === 2 && w.hole.length === 2) {
      const eq = p.eqAllin != null ? p.eqAllin : runoutEquity([p.hole, w.hole], S.board.slice(0, 4))[0];
      if (eq >= 0.65) { ch = base; bad = true; }
    }
    if (!ch && p.total >= Math.max(S.bb * 15, (p.chips + p.total) * 0.35)) ch = base * 0.35;
    if (sr) ch = Math.max(ch, 0.45); // nobody likes being slow-rolled
    if (bad && !p.isHero && !S.test && Math.random() < (p.persona === 'maniac' ? 0.6 : 0.25)) throwCards(p);
    if (ch && Math.random() < ch) { if (S.test) setAngry(p, sr || w); else setTimeout(() => { if (!p.out) setAngry(p, sr || w); }, bad ? 1900 : 1200); }
  }
  S.slowRoller = null;
}

/* ---------- Celebrations ---------- */
function throwCards(p) {
  const cards = (p.cards || []).filter(c => liveCards.has(c)); if (!cards.length) return;
  if (!p.isHero) { pGest(p.i, 'throwCards', 0.7); pEmote(p.i, 'furious', 3); sayExtra(p, 'throw', 150); }
  setTimeout(() => {
    Sound.slap();
    for (const card of cards) { S.muckCards.push(card); bg(moveCard(card, { k: 'muck', ox: rand(-.12, .12), oz: rand(-.1, .1), r: rand(-3, 3), n: S.muckCards.length }, { up: Math.random() < 0.5, dur: 380, arc: 0.16, spin: rand(-9, 9) })); }
  }, p.isHero ? 0 : 260);
  if (dealerP && Math.random() < 0.6) setTimeout(() => { dealerP.gesture('headShake', 1); dealerLine('Easy on the cards, please.'); }, 900);
}
function shouldSlowRoll(p, live) {
  if (p.isHero || !live.some(q => q.isHero)) return false;
  const sc = evaluate([...p.hole, ...S.board]);
  if ((sc >> 20) < 4 || live.some(q => q !== p && evaluate([...q.hole, ...S.board]) >= sc)) return false;
  return Math.random() < ({ maniac: 0.45, shark: 0.3 }[p.persona] || 0.06);
}
const Hero = { winAt: -1e9, lossAt: -1e9, losers: [] };
function heroTap() {
  const h = S.players[0];
  if (S.heroResolve && S.currentBet - h.bet === 0) { Sound.knock(); showBubble(0, '*taps the table*'); heroAct({ type: 'check' }); return; }
  Sound.knock(); setTimeout(() => Sound.knock(), 140); showBubble(0, '*taps the table*');
}
function heroCelebrate() {
  if (performance.now() - Hero.winAt > 12000) return;
  Hero.winAt = -1e9; FX.confetti(90); Sound.win(); showBubble(0, pick(['Yes!', 'Ship it!', "Let's go!", 'Read you like a book!']));
  for (const p of Hero.losers) { if (p.out || p.isHero) continue; if (Math.random() < 0.3) setAngry(p, S.players[0]); else { pEmote(p.i, 'annoyed', 3); pGest(p.i, 'headShake', 1.1); } }
  Achv.ev('celebrate');
}
function heroThrow() {
  const h = S.players[0];
  if (S.heroResolve) { S.throwFold = true; heroAct({ type: 'fold' }); return; }
  if (performance.now() - Hero.lossAt > 12000) return;
  Hero.lossAt = -1e9; showBubble(0, pick(['Ugh!', 'Unbelievable!', 'Every time!'])); throwCards(h);
}
function heroSlowRollToggle() { S.heroSlowRoll = S.heroSlowRoll === S.handNo ? -1 : S.handNo; }

/* ---------- Side bets: flop colour, bad-beat jackpot ---------- */
const SIDE = { size: 2 };
const JACKPOT_SEED = 2500, JACKPOT_FEE = 5;
const isRedCard = c => { const s = suitOf(c); return s === 1 || s === 2; };
function placeFlopBet(pick) {
  const h = S.players[0], amt = r5(S.bb * SIDE.size);
  if (S.sideFlop || h.out || h.chips <= amt * 2) return;
  h.chips -= amt; S.house = (S.house || 0) + amt;
  S.sideFlop = { pick, amt, hand: S.inHand && S.board.length === 0 ? S.handNo : S.handNo + (S.inHand ? 1 : 0) };
  Sound.chips(chipCount(amt)); renderSeat(0); renderDock(); renderSideChip();
  toast(`Side bet: ${pick === 'mono' ? 'all one colour' : pick} on the flop · ${fmt(amt)}`, 2000);
}
function settleFlopBet() {
  const b = S.sideFlop; if (!b || S.board.length < 3) return;
  if (b.hand > S.handNo) return;
  S.sideFlop = null; renderSideChip();
  const reds = S.board.slice(0, 3).filter(c => isRedCard(c)).length;
  const win = b.pick === 'red' ? reds >= 2 : b.pick === 'black' ? reds <= 1 : (reds === 3 || reds === 0);
  const h = S.players[0];
  if (win) {
    const pay = b.amt * (b.pick === 'mono' ? 4 : 2);
    h.chips += pay; S.house -= pay; renderSeat(0);
    if (!S.test) { toast(`Side bet wins! +${fmt(pay - b.amt)}`, 2200); Sound.win(); }
    Achv.ev('sideWin', { mono: b.pick === 'mono' });
  } else if (!S.test) toast(`Side bet lost (${reds === 3 ? 'all red' : reds === 0 ? 'all black' : reds === 2 ? 'mostly red' : 'mostly black'})`, 1800);
}
const sideChipEl = document.createElement('div'); sideChipEl.className = 'sidechip'; overlayEl.appendChild(sideChipEl);
function renderSideChip() {
  const b = S.sideFlop;
  sideChipEl.classList.toggle('show', !!b && !S.test);
  if (b) sideChipEl.innerHTML = `<i class="${b.pick}"></i>${b.pick === 'mono' ? 'Same colour' : b.pick === 'red' ? 'Red' : 'Black'} flop · ${fmt(b.amt)}`;
}
const Jackpot = {
  pool: JACKPOT_SEED, on: false,
  fee() { // charged when you're dealt in
    if (S.test) { this.pool += 10; return; }
    const h = S.players[0];
    this.pool += Math.round(rand(5, 15) / 5) * 5; // other tables pay in too
    if (!this.on || h.out || h.chips <= JACKPOT_FEE * 4) return;
    h.chips -= JACKPOT_FEE; S.house = (S.house || 0) + JACKPOT_FEE; this.pool += JACKPOT_FEE; h.inJackpot = S.handNo;
  },
  check(live, winners) {
    const losers = live.filter(p => !winners.has(p) && p.score != null && (p.score >> 20) >= 6);
    if (!losers.length) return;
    const loser = losers.sort((a, b) => b.score - a.score)[0], winner = [...winners][0], pool = this.pool, h = S.players[0];
    this.pool = JACKPOT_SEED;
    if (!S.test) {
      setTimeout(() => { banner('BAD BEAT JACKPOT!', `${loser.isHero ? 'You' : loser.name} lost with ${handName(loser.score)}`, 2600); FX.confetti(140); Sound.bigWin(); dealerLine('Bad beat jackpot! Congratulations, everyone.'); }, 2200);
    }
    if (h.inJackpot !== S.handNo) return;
    const dealt = S.players.filter(p => dealtIn(p)).length;
    const share = h === loser ? 0.5 : h === winner ? 0.25 : 0.25 / Math.max(1, dealt - 2);
    const amt = Math.max(5, r5(pool * share));
    h.chips += amt; S.house -= amt; renderSeat(0);
    if (!S.test) setTimeout(() => toast(`Your jackpot share: +${fmt(amt)}`, 3200), 3200);
    Achv.ev('jackpot', { amt });
  },
};

'use strict';
/* Velvet Hold'em: 17-flow.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Game flow
   ========================================================= */
function logLine(html, cls) { S.log.push({ html, cls }); }
function seatOrderFrom(start) { const o = []; for (let k = 0; k < NS; k++) o.push((start + k) % NS); return o; }
const nameOf = p => p.isHero ? 'You' : p.name;

function resetTableVisuals() {
  flushAnims(); clearCards(); flying.clear();
  for (const p of piles.values()) { p.amount = 0; p.chips = []; }
  chipsDirty = true;
  clearTags(); clearBubbles(); setActive(-1); seatEls.forEach(e => e.classList.remove('winner', 'thinking')); for (let i = 0; i < NS; i++) setEq(i, null);
  bannerEl.className = ''; potLbl.classList.add('off'); betLbls.forEach(l => l.classList.add('off'));
  CAM.focus = 0; TFX.reset();
  if (dealerP) { dealerP.gest = null; dealerP.emo = null; dealerP.holding = false; }
  if (deckMesh && A.deckRest) { deckMesh.position.set(A.deckRest.x, 0.011, A.deckRest.z); deckMesh.rotation.y = 0; A.deck.copy(A.deckRest); }
}
function newGame(mode, level, restore, structure, opts) {
  RUN++; City.hide();
  if (S.heroReject) { const rj = S.heroReject; S.heroResolve = S.heroReject = null; try { rj(ABORT); } catch (e) {} }
  clearTimeout(heroTurn._slow);
  resetTableVisuals(); FX.parts = []; Voice.stop();
  clearAnger(); DrinkOffer.clear(); Police.reset(); S.sideFlop = null; S.house = 0; S.bar = 0; S.heroSlowRoll = -1; S.koCount = 0; S.koWon = 0;
  if (opts) S.ko = opts.ko || 0; else if (restore) S.ko = restore.ko || 0;
  S.jail = !!(opts && opts.jail);
  if (!restore && !S.career && !S.jail) BUYIN = 20;
  if (restore) { S.career = restore.career || null; BUYIN = S.career ? S.career.buyin : 20; applyTheme(S.career ? roomById(S.career.room) : null); }
  Object.assign(S, { mode, level, board: [], pot: 0, currentBet: 0, frc: 0, inHand: false, betweenHands: true, toAct: -1, pre: null, raising: false, runout: false, started: true, log: [], tips: 0, rig: null, bribedHand: -1 });
  lastTauntAt = 0;
  if (restore) {
    S.structure = restore.structure || 'turbo';
    S.handNo = restore.handNo; S.blindIdx = restore.blindIdx; S.button = restore.button; S.heroBuyin = restore.heroBuyin || 0;
    S.stats = Object.assign({ hands: 0, won: 0, biggest: 0, best: -1 }, restore.stats || {});
    S.hm = Object.assign({ faced: 0, foldFaced: 0, aggr: 0, pass: 0 }, restore.hm || {});
    S.ann = restore.ann || {};
    S.players = restore.players.map((d, i) => Object.assign(makePlayer(i, d.name, d.persona, d.chips, d.colorIdx, d.isHero), { out: d.out, place: d.place || 0, st: d.st || { hands: 0, vpip: 0, pfr: 0, won: 0 }, bounty: d.bounty || 0 }));
    S.history = [];
    Clock.left = restore.clockLeft ?? levelMs();
  } else {
    S.structure = structure || 'turbo';
    const stack = mode === 'sng' ? SNG_STACK : CASH_STACK;
    const pers = shuffled(Object.keys(PERSONAS)).slice(0, NS - 1), cols = shuffled([...Array(AV_COLORS.length).keys()]), used = new Set();
    S.players = [makePlayer(0, 'You', 'pro', stack, 0, true)].concat(pers.map((ps, k) => { const n = nameFor(ps, used); used.add(n); return makePlayer(k + 1, n, ps, stack, cols[k]); }));
    if (S.ko && mode === 'sng') S.players.forEach(p => p.bounty = S.ko);
    if (S.jail) Jail.seat(); // you against the guard
    if (S.career) S.players[0].heat = Career.load().heat || 0; // heat follows you between career games
    S.handNo = 0; S.blindIdx = 0; S.button = Math.floor(Math.random() * NS); S.heroBuyin = stack;
    S.stats = { hands: 0, won: 0, biggest: 0, best: -1 }; S.history = []; S.ann = {};
    S.hm = { faced: 0, foldFaced: 0, aggr: 0, pass: 0 };
    Clock.left = levelMs();
  }
  Clock.warned = false; Clock.shown = '';
  if (mode === 'sng') Clock.start(); else Clock.stop();
  setBlinds();
  S.players.forEach(p => { p.folded = true; p.hole = []; p.bet = 0; p.total = 0; p.allIn = false; });
  layout(); syncPeople(); renderSeats(); renderPot(); renderTop(); renderDock(); placeDealer(true); lookAt(-1); renderSideChip(); updateRivalBadges(); Bar.stock(); renderBounties(); renderCareerChip(); syncLeaveLabel(); Act.close(); if (!S.test) actHint();
  snapshotBetween();
  if (!restore && !S.test) {
    dealerSay('shuffle', 'Shuffle up and deal.');
    const bots = shuffled(S.players.filter(p => !p.isHero));
    const rv = bots.find(b => Rivals.grudge(b.persona) >= 2);
    if (rv) { const k = bots.indexOf(rv); bots.splice(k, 1); bots.unshift(rv); sayExtra(rv, 'rivalGreet', 1600); }
    else Chat.say(bots[0], 'greet', { force: true, delay: 1600, raw: true });
    setTimeout(() => Chat.say(bots[1], 'greet', { force: true, raw: true }), 3600);
  }
  gameLoop();
}
async function gameLoop() {
  const my = RUN;
  try {
    await delay(700);
    while (my === RUN) {
      let cont = true;
      try {
        await playHand();
        cont = await afterHand();
      } catch (e) {
        // An unexpected error used to end this loop for good: the table froze while the
        // 3D scene kept running. Now the hand is called off, chips go back, and play goes on.
        if (e === ABORT || my !== RUN) throw e;
        console.error(e);
        recoverHand();
      }
      if (!cont || my !== RUN) break;
      await delay(500);
    }
  } catch (e) { if (e !== ABORT) console.error(e); }
}
/* Undo a hand that broke part-way. Chips still on the table go back so the totals balance:
   if nothing was paid out yet, everyone gets back what they put in; otherwise what is left
   of the pot is shared by the players still in the hand. Busted players are handled by the
   next afterHand(), as usual. */
function recoverHand() {
  const left = S.pot + sumBets(), committed = S.players.reduce((a, p) => a + p.total, 0);
  if (left > 0) {
    if (left === committed) for (const p of S.players) p.chips += p.total;
    else {
      let to = S.players.filter(p => inHand(p) && p.total > 0);
      if (!to.length) to = S.players.filter(p => !p.out);
      const base = Math.floor(left / (to.length * 5)) * 5; let rem = left - base * to.length;
      for (const p of to) { const x = Math.min(5, rem); p.chips += base + x; rem -= x; }
      if (rem > 0) to[0].chips += rem;
    }
  }
  S.pot = 0; S.currentBet = 0;
  S.players.forEach(p => { p.bet = 0; p.total = 0; p.hole = []; p.cards = []; p.allIn = false; p.folded = true; });
  S.toAct = -1; S.inHand = false; S.betweenHands = true; S.runout = false; S.raising = false; S.pre = null; S.board = [];
  S.heroResolve = S.heroReject = null; clearTimeout(heroTurn._slow); clearTimeout(heroTurn._dealer);
  logLine('Misdeal: the hand was called off and the chips were returned');
  if (!S.test) {
    resetTableVisuals(); dealerHold(false);
    renderSeats(); renderPot(); renderTop(); renderDock();
    toast('Misdeal. The hand is called off and the chips go back.', 3200);
  }
}

async function playHand() {
  S.betweenHands = false; S.inHand = true; S.runout = false; S.pre = null; S.raising = false; heroEq = null;
  S.handNo++; S.board = []; S.boardCards = []; S.muckCards = []; S.pot = 0; S.currentBet = 0; S.frc = 0; S.log = []; S.lastRaiserI = -1;
  checkLevel();
  S.minRaise = S.bb;
  for (const p of S.players) {
    Object.assign(p, { hole: [], cards: [], bet: 0, total: 0, allIn: false, acted: false, afrc: -1, pf: '', vpipHand: false, pfrHand: false, score: 0, eqAllin: null });
    p.folded = !(!p.out && p.chips > 0);
    if (!p.folded) { p.startStack = p.chips; p.st.hands++; }
  }
  const hero = S.players[0]; if (!hero.out) { S.stats.hands++; Achv.ev('hand'); }
  angerTick(); buzzTick(); heatTick(); Police.handStart();
  seatEls.forEach(e => e.classList.remove('winner')); clearTags(); for (let i = 0; i < NS; i++) setEq(i, null);
  applySpeedVar(); renderSeats(); renderPot(); renderTop(); renderDock();

  const act = S.players.filter((p, i) => isActiveSeat(i));
  if (S.mode === 'sng') {
    if (act.length === 3 && !S.ann.bubble) { S.ann.bubble = true; toast('Money bubble · top 2 get paid', 3000); dealerSay('bubble', "We're on the money bubble."); }
    if (act.length === 2 && !S.ann.hu && !S.jail) { S.ann.hu = true; toast('Heads-up for the title', 3000); setTimeout(() => dealerSay('headsUp', "We're heads up."), 2600); }
  }
  S.button = nextFrom(S.button, isActiveSeat);
  placeDealer(false);
  if (act.length === 2) { S.sbI = S.button; S.bbI = nextFrom(S.sbI, isActiveSeat); }
  else { S.sbI = nextFrom(S.button, isActiveSeat); S.bbI = nextFrom(S.sbI, isActiveSeat); }
  logLine(`Dealer: ${S.players[S.button].name}`);

  Sound.shuffle(); lookAt(-1);
  if (dealerP && !S.test) { dealerP.holding = true; dGest('gather', 0.7); }
  if (deckMesh && !S.test && !dealerP) bg(animate(640, (e, k) => { deckMesh.position.y = 0.011 + Math.abs(Math.sin(k * Math.PI * 4)) * 0.012 * (1 - k); deckMesh.rotation.y = Math.sin(k * Math.PI * 4) * 0.08 * (1 - k); }, t => t));
  await delay(700);
  S.deck = secureShuffle([...Array(52).keys()]);
  if (S.ante > 0) await postAntes(act);
  await postBlind(S.sbI, S.sb, 'SB');
  await postBlind(S.bbI, S.bb, 'BB');
  S.currentBet = S.bb; S.minRaise = S.bb; S.frc = 0;
  Jackpot.fee();
  await aiBribes('hole');
  await dealHole();
  updateHeroOdds();

  const first = act.length === 2 ? S.sbI : nextFrom(S.bbI, i => canActP(S.players[i]));
  await bettingRound(first);
  await collectBets();

  for (const n of [3, 4, 5]) {
    if (liveCount() <= 1) break;
    const actors = S.players.filter(canActP);
    if (actors.length <= 1 && !S.runout) await revealRunout();
    await aiBribes('board');
    await dealStreet(n);
    if (S.runout) showRunoutEquity();
    if (S.players.filter(canActP).length >= 2) {
      S.currentBet = 0; S.minRaise = S.bb; S.frc = 0; S.lastRaiserI = -1;
      clearTags(true);
      await bettingRound(nextFrom(S.button, i => canActP(S.players[i])));
      await collectBets();
    }
  }
  if (liveCount() === 1) await winUncontested();
  else await showdown();
  focusCamera(false); TFX.dimRoom(false);
  S.inHand = false; S.betweenHands = true;
}

async function postAntes(act) {
  const flights = [];
  for (const p of act) {
    const a = Math.min(S.ante, p.chips); if (a <= 0) continue;
    p.chips -= a; p.total += a; S.pot += a;
    if (p.chips === 0) p.allIn = true;
    renderSeat(p.i);
    flights.push(flyChips(a, A.seats[p.i].stack, A.pot, { dur: 460, arc: 0.04 }));
  }
  logLine(`Antes of ${fmt(S.ante)} posted`);
  Sound.chips(10, 0.7);
  await Promise.all(flights);
  renderPot();
  for (const p of act) if (p.allIn) setTag(p.i, 'All-in', 'allin');
}
async function postBlind(i, amt, label) {
  const p = S.players[i]; const a = Math.min(amt, p.chips);
  await putChips(p, a);
  if (p.chips === 0) { p.allIn = true; setTag(i, 'All-in', 'allin'); } else setTag(i, label, 'blind');
  logLine(`${p.name} posts ${label === 'SB' ? 'small' : 'big'} blind ${fmt(a)}`);
}
async function putChips(p, amt) {
  if (amt <= 0) return;
  if (!p.isHero) pGest(p.i, amt >= p.chips ? 'push' : 'bet', amt >= p.chips ? 0.85 : 0.6, { world: A.seats[p.i].bet });
  p.chips -= amt; p.bet += amt; p.total += amt;
  renderSeat(p.i);
  Sound.chips(chipCount(amt));
  await flyChips(amt, A.seats[p.i].stack, A.seats[p.i].bet, { dur: 380, arc: 0.035 });
  renderBet(p.i); renderTop();
}
const chipCount = amt => clamp(Math.round(Math.log2(amt / S.bb + 1) * 2.4), 2, 12);

async function dealHole() {
  const order = seatOrderFrom(S.sbI).filter(i => isActiveSeat(i) || (S.players[i].allIn && !S.players[i].out && S.players[i].total > 0));
  const dealt = order.filter(i => !S.players[i].folded);
  const rigI = S.rig ? S.rig.i : -1;
  applyRigHole(dealt);
  applyBuzzLuck(dealt, rigI); // a buzzed player may get a luckier deal
  if (dealerP && !S.test) dealerP.holding = true;
  for (const i of dealt) if (people[i]) people[i].look = A.seats[i].card.clone();
  for (let round = 0; round < 2; round++) {
    for (const i of dealt) {
      const p = S.players[i]; const c = S.deck.pop(); p.hole.push(c);
      const tgt = A.seats[i].card;
      dGest('pitch', 0.36, { world: tgt });
      if (dealerP) dealerP.look = new V3(tgt.x, 0.25, tgt.z);
      await delay(110);
      const card = new Card3D(c, { k: 'deck' });
      p.cards.push(card);
      bg(moveCard(card, { k: 'hole', seat: i, n: round }, { dur: 440, arc: 0.07, spin: rand(2, 4) * (Math.random() < .5 ? -1 : 1) }));
      Sound.card();
      await delay(130);
    }
  }
  dealerHold(false); lookAt(-1);
  await delay(420);
  const h = S.players[0];
  if (dealtIn(h)) { await Promise.all(h.cards.map((c, k) => moveCard(c, c.slot, { up: true, dur: 460, arc: 0.02, delay: k * 90 }))); Sound.flip(); }
  renderDock();
  await delay(200);
}
async function burnCard() {
  S.deck.pop();
  if (dealerP && !S.test) dealerP.holding = true;
  dGest('place', 0.4, { world: A.muck });
  await delay(120);
  const card = new Card3D(-1, { k: 'deck' });
  S.muckCards.push(card);
  bg(moveCard(card, { k: 'muck', ox: rand(-.04, .04), oz: rand(-.04, .04), r: rand(-1, 1), n: S.muckCards.length }, { dur: 360, arc: 0.03 }));
}
async function dealStreet(n) {
  await burnCard();
  applyRigBoard(n);
  const bigRiver = n === 5 && !S.runout && liveCount() >= 2 && S.pot >= S.bb * 25; // a big pot: slow, dramatic river
  const drama = (S.runout && n >= 4) || bigRiver;
  if (bigRiver) TFX.dimRoom(true);
  await delay(drama ? 600 : 240);
  if (n === 3) {
    const cs = [S.deck.pop(), S.deck.pop(), S.deck.pop()];
    dGest('place', 0.9, { world: A.board[1] }); lookAt(-1);
    await delay(160);
    const cards = cs.map(c => new Card3D(c, { k: 'deck' }));
    await Promise.all(cards.map((card, k) => { Sound.card(); return moveCard(card, { k: 'board', i: 1, r: (k - 1) * 0.04 }, { dur: 380, arc: 0.05, delay: k * 70 }); }));
    await delay(120);
    await Promise.all(cards.map(card => moveCard(card, card.slot, { up: true, dur: 440, arc: 0.01 })));
    Sound.flip();
    await delay(220);
    Sound.slide();
    await Promise.all(cards.map((card, k) => moveCard(card, { k: 'board', i: k }, { dur: 420, arc: 0.004, ease: easeInOut })));
    S.board.push(...cs); S.boardCards.push(...cards);
    settleFlopBet();
    dealerHold(false);
    await delay(260);
  } else {
    const c = S.deck.pop();
    dGest('place', drama ? 0.9 : 0.6, { world: A.board[n - 1] }); lookAt(-1);
    await delay(150);
    const card = new Card3D(c, { k: 'deck' });
    Sound.card();
    await moveCard(card, { k: 'board', i: n - 1 }, { dur: drama ? 600 : 380, arc: 0.05 });
    if (drama) { Sound.heart(); await delay(600); }
    await moveCard(card, card.slot, { up: true, dur: drama ? 700 : 440, arc: 0.01 });
    Sound.flip();
    S.board.push(c); S.boardCards.push(card);
    dealerHold(false);
    await delay(drama ? 500 : 320);
  }
  logLine(`${n === 3 ? 'Flop' : n === 4 ? 'Turn' : 'River'}: ${S.board.map(cardTxt).join(' ')}`, 'st');
  updateHeroOdds(); renderDock();
}

async function bettingRound(start) {
  for (const p of S.players) { p.afrc = -1; if (canActP(p)) p.acted = false; }
  if (start < 0) return;
  let idx = start, guard = 0;
  while (guard++ < 400) {
    if (liveCount() <= 1) return;
    const actors = S.players.filter(canActP);
    if (!actors.length) return;
    if (actors.every(p => p.acted && p.bet === S.currentBet)) return;
    if (actors.length === 1 && actors[0].bet >= S.currentBet) return;
    const p = S.players[idx];
    if (canActP(p) && (!p.acted || p.bet < S.currentBet)) await takeTurn(p);
    idx = (idx + 1) % NS;
  }
}
async function takeTurn(p) {
  S.toAct = p.i; setActive(p.i);
  let a;
  if (p.isHero && !S.test) {
    a = consumePre(p);
    if (!a) a = await heroTurn(p);
    if (S.toAct !== p.i) throw ABORT;
  } else {
    const t0 = performance.now();
    a = aiDecide(p);
    const plan = thinkPlan(p, a);
    const think = plan.ms * spd();
    const el = seatEls[p.i]; el.style.setProperty('--think', think + 'ms');
    if (!p.isHero) el.classList.add('thinking');
    renderDock();
    if (plan.tell) Chat.say(p, plan.tell, { force: true, delay: think * 0.3, raw: true });
    if (plan.riffle && !S.test) setTimeout(() => { if (S.toAct === p.i) Sound.riffle(); }, think * 0.25);
    const pp = people[p.i], secs = plan.ms / 1000;
    if (pp && !S.test) {
      if (plan.tell === 'tellStrong' && p.persona === 'rock') pp.gesture('still', secs);
      else if (plan.tell && p.persona === 'shark') { pp.gesture('stare', secs); pp.look = seatHeadWorld(0, new V3()); }
      else if (plan.tell === 'tellStrong' && p.persona === 'station') pp.gesture('nervous', secs);
      else if (plan.tell === 'tellWeak' && p.persona === 'maniac') pp.gesture('smug', Math.min(secs, 2.2));
      else if (plan.tell && p.persona === 'pro') pp.gesture('shrug', Math.min(secs, 1.4));
      else if (plan.riffle) pp.gesture('riffle', secs * 0.9, { world: A.seats[p.i].stack });
      else if (secs > 1.3) pp.gesture('think', secs * 0.9);
    }
    const r = RUN; await sleep(Math.max(0, think - (performance.now() - t0))); if (r !== RUN) throw ABORT;
    el.classList.remove('thinking');
  }
  S.toAct = -1; setActive(-1);
  await applyAction(p, a);
  renderDock();
}
async function applyAction(p, a) {
  const toCall = S.currentBet - p.bet, maxTo = p.bet + p.chips;
  let type = a.type, to = a.to;
  if (type === 'fold' && toCall <= 0) type = 'check';
  if (type === 'check' && toCall > 0) type = 'fold';
  if (type === 'raise' && !canRaise(p)) type = toCall > 0 ? 'call' : 'check';
  if (type === 'raise') {
    to = r5(to);
    const minTo = S.currentBet + S.minRaise;
    if (to < minTo) to = minTo;
    if (to >= maxTo) to = maxTo;
    if (to <= S.currentBet) type = 'call';
  }
  const pre = S.board.length === 0;
  if (p.isHero) {
    if (toCall > 0) { S.hm.faced++; if (type === 'fold') S.hm.foldFaced++; }
    if (type === 'raise') S.hm.aggr++; else if (type === 'call') S.hm.pass++;
  }
  p.acted = true;
  if (type === 'fold') {
    p.folded = true; setTag(p.i, 'Fold', 'fold'); Sound.fold();
    if (!p.isHero) { pGest(p.i, 'fold', 0.6, { world: A.seats[p.i].card }); pEmote(p.i, faceFor(p.persona, 'fold'), 1.6); }
    const angry = p.isHero && S.throwFold; S.throwFold = false;
    if (angry) { Sound.slap(); showBubble(0, pick(['Ugh!', 'Garbage!', 'Every time!'])); if (dealerP && Math.random() < 0.6) setTimeout(() => { dealerP.gesture('headShake', 1); dealerLine('Easy on the cards, please.'); }, 700); }
    for (const card of p.cards) {
      S.muckCards.push(card);
      bg(moveCard(card, { k: 'muck', ox: rand(-.05, .05) * (angry ? 2.4 : 1), oz: rand(-.05, .05) * (angry ? 2 : 1), r: rand(-1.2, 1.2) * (angry ? 2.5 : 1), n: S.muckCards.length }, { up: angry && Math.random() < 0.5, dur: angry ? 360 : 420, arc: angry ? 0.16 : 0.04, spin: rand(-2, 2) * (angry ? 4.5 : 1) }));
    }
    p.cards = [];
    logLine(`${p.name} folds`);
    if (p.isHero) applySpeedVar();
    else Chat.say(p, 'fold', { prob: p.persona === 'maniac' ? .2 : .05 });
    renderSeat(p.i); updateHeroOdds();
    await delay(260);
  } else if (type === 'check') {
    setTag(p.i, 'Check', 'check'); Sound.knock(); logLine(`${p.name} checks`);
    if (!p.isHero) pGest(p.i, 'tap', 0.55);
    await delay(240);
  } else if (type === 'call') {
    const amt = Math.min(toCall, p.chips);
    if (pre) { p.pf = p.pf || 'call'; if (!p.vpipHand) { p.vpipHand = true; p.st.vpip++; } }
    await putChips(p, amt);
    if (p.chips === 0) { p.allIn = true; setTag(p.i, 'All-in', 'allin'); Sound.allin(); logLine(`${p.name} calls ${fmt(amt)} and is all-in`); dealerSay(p.isHero ? 'heroAllin' : 'allin', `${p.isHero ? 'You call' : p.name + ' calls'}, all in.`); if (!p.isHero) pEmote(p.i, faceFor(p.persona, 'allin'), 3); }
    else { setTag(p.i, `Call ${fmt(amt)}`, 'call'); logLine(`${p.name} calls ${fmt(amt)}`); if (!p.isHero) Chat.say(p, 'call', { prob: p.persona === 'station' ? .16 : .05 }); }
  } else {
    const amt = to - p.bet, raiseBy = to - S.currentBet, wasBet = S.currentBet === 0;
    if (raiseBy >= S.minRaise) { S.minRaise = raiseBy; S.frc++; }
    S.currentBet = to; S.lastRaiserI = p.i;
    for (const q of S.players) if (q !== p && canActP(q) && q.bet < to) q.acted = false;
    if (pre) { p.pf = 'raise'; if (!p.vpipHand) { p.vpipHand = true; p.st.vpip++; } if (!p.pfrHand) { p.pfrHand = true; p.st.pfr++; } }
    await putChips(p, amt);
    if (p.chips === 0) {
      p.allIn = true; setTag(p.i, 'All-in', 'allin'); Sound.allin(); logLine(`${p.name} ${wasBet ? 'bets' : 'raises to'} ${fmt(to)} and is all-in`);
      dealerSay(p.isHero ? 'heroAllin' : 'allin', p.isHero ? "You're all in." : `${p.name} is all in.`);
      if (!p.isHero) pEmote(p.i, faceFor(p.persona, 'allin'), 3);
      if (!p.isHero) Chat.say(p, 'allin', { prob: .55 });
      if (!p.isHero) maybeAITaunt(p, 0.5, S.players.filter(q => q !== p && inHand(q)));
      if (!p.isHero && isAngry(p) && Math.random() < 0.45) { sayExtra(p, 'angry', 350); pEmote(p.i, 'furious', 2.5); }
    } else {
      setTag(p.i, `${wasBet ? 'Bet' : 'Raise'} ${fmt(to)}`, 'raise'); logLine(`${p.name} ${wasBet ? 'bets' : 'raises to'} ${fmt(to)}`);
      const potNow = S.pot + sumBets();
      if (!p.isHero && amt >= potNow * 0.45 && amt >= S.bb * 4) Chat.say(p, 'raiseBig', { prob: p.persona === 'maniac' ? .45 : .16 });
      if (!p.isHero) maybeAITaunt(p, 0.6, S.players.filter(q => q !== p && inHand(q)));
      if (!p.isHero && isAngry(p) && Math.random() < 0.3) { sayExtra(p, 'angry', 350); pEmote(p.i, 'furious', 2.5); }
    }
  }
  p.afrc = S.frc;
  renderSeat(p.i);
}
async function collectBets() {
  const betting = S.players.filter(p => p.bet > 0);
  if (!betting.length) return;
  const sorted = betting.map(p => p.bet).sort((a, b) => b - a);
  const top = betting.find(p => p.bet === sorted[0]);
  const second = sorted[1] || 0;
  if (top && top.bet > second) {
    const back = top.bet - second;
    top.bet -= back; top.total -= back; top.chips += back;
    if (top.allIn && top.chips > 0) top.allIn = false;
    logLine(`Uncalled ${fmt(back)} returned to ${top.name}`);
    renderBet(top.i);
    await flyChips(back, A.seats[top.i].bet, A.seats[top.i].stack, { dur: 320, arc: 0.03 });
    renderSeat(top.i);
  }
  await delay(120);
  const flights = [];
  let sum = 0;
  for (const p of S.players) {
    if (p.bet <= 0) continue;
    sum += p.bet; const amt = p.bet; p.bet = 0; renderBet(p.i);
    flights.push(flyChips(amt, A.seats[p.i].bet, A.pot, { dur: 460, arc: 0.03 }));
  }
  if (flights.length) { Sound.slide(); Sound.chips(Math.min(12, 3 + flights.length * 2), 0.8); dGest('sweep', 0.8); }
  await Promise.all(flights);
  S.pot += sum; S.currentBet = 0;
  renderPot();
  await delay(160);
}
async function revealRunout() {
  S.runout = true;
  const live = S.players.filter(inHand);
  dealerSay('allinCall', 'All in and a call. Cards up, please.', true);
  for (const q of live) if (!q.isHero) pEmote(q.i, q.persona === 'station' || q.persona === 'rock' ? 'worried' : 'focused', 6);
  focusCamera(true); TFX.dimRoom(true);
  for (const p of live) {
    if (p.isHero) continue;
    await Promise.all(p.cards.map((card, k) => moveCard(card, { k: 'hole', seat: p.i, n: k, rev: true }, { up: true, dur: 480, arc: 0.03, delay: k * 60 })));
    Sound.flip(); await delay(160);
  }
  logLine(`All-in: ${live.map(p => `${p.name} ${p.hole.map(cardTxt).join(' ')}`).join(' · ')}`, 'st');
  const eqs = showRunoutEquity();
  live.forEach((p, k) => { p.eqAllin = eqs[k]; });
  await delay(600);
}
function showRunoutEquity() {
  const live = S.players.filter(inHand);
  const eqs = runoutEquity(live.map(p => p.hole), S.board);
  live.forEach((p, k) => setEq(p.i, eqs[k]));
  if (live.some(p => p.isHero)) { heroEq = eqs[live.findIndex(p => p.isHero)]; renderInfo(); }
  return eqs;
}
function highlightWin(winners) {
  const set = new Set(); winners.forEach(w => bestFive([...w.hole, ...S.board]).forEach(c => set.add(c)));
  const winCards = new Set(winners.flatMap(w => w.cards));
  const all = [...S.boardCards, ...S.players.flatMap(p => inHand(p) ? p.cards : [])];
  for (const card of all) {
    const own = winCards.has(card) || S.boardCards.includes(card);
    const on = own && set.has(card.c);
    card.setWin(on); card.setDim(!on);
  }
}
function clearHighlight() { for (const c of liveCards) { c.setWin(false); c.setDim(false); } }
async function payout(winners, amount) {
  const n = winners.length, base = Math.floor(amount / (n * 5)) * 5; let rem = amount - base * n;
  const order = seatOrderFrom((S.button + 1) % NS).map(i => S.players[i]).filter(p => winners.includes(p));
  const shares = new Map(order.map(p => [p, base]));
  for (const p of order) { if (rem <= 0) break; const x = Math.min(5, rem); shares.set(p, shares.get(p) + x); rem -= x; }
  S.pot -= amount; renderPot();
  Sound.chips(12, 0.9);
  if (order[0]) { dGest('pushTo', 0.95, { world: A.pot, world2: A.seats[order[0].i].stack }); TFX.dimRoom(false); TFX.spotOn(order[0]); }
  await Promise.all(order.map(p => {
    const share = shares.get(p);
    return flyChips(share, A.pot, A.seats[p.i].stack, { dur: 640, arc: 0.12 }).then(() => {
      const from = p.chips; p.chips += share; p.st.won++;
      setPile('stack' + p.i, p.chips);
      animateNumber(seatEls[p.i].querySelector('.stk'), from, p.chips, 500);
    });
  }));
  renderTop();
  return shares;
}
function celebrate(p, amount, score) {
  const big = score != null && (score >> 20) >= 7;
  if (p.isHero) Achv.ev('winPot', { cat: score == null ? null : score >> 20, royal: score != null && (score >> 20) === 8 && ((score >> 16) & 15) === 14, bb: amount / S.bb, uncontested: score == null, angry: isAngry(p) });
  if (p.isHero) {
    S.stats.won++; if (amount > S.stats.biggest) S.stats.biggest = amount;
    if (score != null && score > S.stats.best) S.stats.best = score;
    const pt = proj(A.seats[0].card, 0, 0.08, 0);
    FX.burst(pt.x, pt.y, big ? 120 : (amount > S.bb * 30 ? 70 : 40), big ? 1.5 : 1);
    if (big) { FX.confetti(120); Sound.bigWin(); } else Sound.win();
  }
}
async function winUncontested() {
  const w = S.players.find(inHand);
  S.lastWinners = new Set(w ? [w] : []); if (w && w.isHero) { Hero.winAt = performance.now(); Hero.losers = []; }
  const amount = S.pot;
  seatEls[w.i].classList.add('winner'); TFX.spotOn(w);
  logLine(`${w.name} wins ${fmt(amount)}`, 'res');
  bg(banner(`${w.isHero ? 'You win' : w.name + ' wins'} ${fmt(amount)}`, '', 1300));
  await payout([w], amount);
  celebrate(w, amount, null);
  if (!w.isHero) react(w, amount >= S.bb * 25 ? 'winBig' : 'winSmall', { delay: 200, prob: amount >= S.bb * 25 ? .4 : .12 });
  await delay(1100);
}
async function showdown() {
  const live = S.players.filter(inHand);
  const potTotal = S.players.reduce((a, q) => a + q.total, 0);
  lookAt(-1);
  if (!S.runout) {
    const order = seatOrderFrom((S.button + 1) % NS).map(i => S.players[i]).filter(inHand);
    for (const p of order) {
      if (p.isHero) continue;
      if (!S.test && shouldSlowRoll(p, order)) { // takes their sweet time with the winning hand
        S.slowRoller = p; pGest(p.i, 'think', 1.9); pEmote(p.i, 'smug', 3.5); sayExtra(p, 'slowroll'); await delay(1900);
      }
      await Promise.all(p.cards.map((card, k) => moveCard(card, { k: 'hole', seat: p.i, n: k, rev: true }, { up: true, dur: 460, arc: 0.03, delay: k * 60 })));
      Sound.flip(); await delay(300);
    }
  }
  for (const p of live) {
    p.score = evaluate([...p.hole, ...S.board]);
    setTag(p.i, shortName(p.score), 'hand');
    logLine(`${p.name} shows ${p.hole.map(cardTxt).join(' ')} · ${handName(p.score)}`);
  }
  for (let i = 0; i < NS; i++) setEq(i, null);
  const hero0 = S.players[0];
  if (!S.test && S.heroSlowRoll === S.handNo && live.includes(hero0) && live.every(q => q === hero0 || q.score < hero0.score)) {
    S.slowRoller = hero0; showBubble(0, pick(['Hmm... do I win?', 'Let me see here...', 'Is this any good?'])); Sound.tick(); await delay(1900);
  }
  await delay(500);
  const pots = buildPots(S.players).filter(x => x.amount > 0);
  const heroIn = live.some(p => p.isHero); let heroWon = false;
  const winnersAll = new Set();
  for (let k = pots.length - 1; k >= 0; k--) {
    const pot = pots[k];
    const best = Math.max(...pot.eligible.map(p => p.score));
    const winners = pot.eligible.filter(p => p.score === best);
    winners.forEach(w => winnersAll.add(w));
    if (pot.eligible.length === 1) { await payout(winners, Math.min(pot.amount, S.pot)); continue; }
    highlightWin(winners);
    seatEls.forEach(e => e.classList.remove('winner')); winners.forEach(w => { seatEls[w.i].classList.add('winner'); setTag(w.i, shortName(best), 'hand best'); });
    const label = pots.length > 1 ? (k === 0 ? 'Main pot' : 'Side pot') : '';
    const amt = Math.min(pot.amount, S.pot);
    const t1 = winners.length > 1 ? `Split pot · ${fmt(amt)}` : `${winners[0].isHero ? 'You win' : winners[0].name + ' wins'} ${fmt(amt)}`;
    bg(banner(t1, (label ? label + ' · ' : '') + handName(best), 1700));
    if (k === 0 || pots.length === 1) dealerSay(winners.length > 1 ? 'split' : 'hand' + (best >> 20 === 8 && ((best >> 16) & 15) === 14 ? 9 : best >> 20), winners.length > 1 ? 'Split pot.' : `${winners[0].isHero ? 'You win' : winners[0].name + ' wins'}, with ${spokenHand(best)}.`);
    logLine(`${winners.map(w => w.name).join(' & ')} ${winners.length > 1 ? 'split' : 'wins'} ${fmt(amt)}${label ? ' (' + label.toLowerCase() + ')' : ''} with ${handName(best)}`, 'res');
    await payout(winners, amt);
    winners.forEach(w => { if (w.isHero) { heroWon = true; celebrate(w, amt, best); } });
    await delay(1500);
    clearHighlight();
  }
  if (heroIn && !heroWon) Sound.lose();
  if (S.pot > 0) { const w = live[0]; w.chips += S.pot; S.pot = 0; renderPot(); renderSeat(w.i); }
  S.lastWinners = winnersAll;
  if (heroWon) { Hero.winAt = performance.now(); Hero.losers = live.filter(q => !winnersAll.has(q)); }
  else if (heroIn) Hero.lossAt = performance.now();
  if (S.slowRoller && S.slowRoller.isHero && heroWon) Achv.ev('slowroll');
  rivalShowdown(live, winnersAll, potTotal);
  Jackpot.check(live, winnersAll);
  tiltCheck(live, winnersAll);
  reactToHand(live, winnersAll, potTotal);
}
function showdownTalk(live, winners) {
  const big = S.players.reduce((a, p) => a + p.total, 0) >= S.bb * 25;
  for (const p of live) {
    if (p.isHero) continue;
    const won = winners.has(p);
    if (p.eqAllin != null) {
      if (!won && p.eqAllin >= 0.7 && Chat.say(p, 'badBeat', { prob: .85 })) return;
      if (won && p.eqAllin <= 0.3 && Chat.say(p, 'suckout', { prob: .8 })) return;
    }
  }
  const botWinner = [...winners].find(p => !p.isHero);
  if (botWinner && Chat.say(botWinner, big ? 'winBig' : 'winSmall', { prob: big ? .5 : .2 })) return;
  const loser = live.find(p => !p.isHero && !winners.has(p));
  if (loser && Chat.say(loser, 'lose', { prob: .3 })) return;
  if ([...winners].some(p => p.isHero) && big) {
    const other = shuffled(S.players.filter(p => !p.isHero && !p.out))[0];
    if (other) Chat.say(other, 'niceHand', { prob: .4, delay: 900 });
  }
}

async function clearTable() {
  const cards = [...liveCards];
  if (cards.length) { Sound.slide(); dGest('gather', 0.8); }
  await Promise.all(cards.map((c, k) => moveCard(c, { k: 'deck' }, { up: false, dur: 420, arc: 0.03, delay: k * 12 }).catch(() => {})));
  clearCards(); clearTags(); setActive(-1);
  seatEls.forEach(e => e.classList.remove('winner')); for (let i = 0; i < NS; i++) setEq(i, null);
  bannerEl.className = '';
  S.players.forEach(p => { p.hole = []; p.bet = 0; p.total = 0; p.allIn = false; p.folded = true; });
  S.board = []; heroEq = null;
}
async function afterHand() {
  S.history.unshift({ no: S.handNo, blinds: `${fmt(S.sb)}/${fmt(S.bb)}${S.ante ? ' · ante ' + fmt(S.ante) : ''}`, lines: S.log.slice() });
  if (S.history.length > 40) S.history.pop();
  if (S.career) {
    const h = S.players[0]; // career play style, for the bank's credit check
    if (h && dealtIn(h)) { Achv.count('chands'); if (h.vpipHand) Achv.count('cvpip'); if (h.pfrHand) Achv.count('cpfr'); }
    Cal.advance('hand'); // game time: 4 hours a hand
  } else if (S.jail) Cal.advance('hand');
  await clearTable();
  if (await Police.arrests()) return Police.heroCaught(); // arrests for bribing happen between hands
  const hero = S.players[0];
  const busted = S.players.filter(p => !p.out && p.chips <= 0);
  for (const p of busted) calmDown(p, true);
  rivalBusts(busted);
  if (S.mode === 'sng') { if (!S.ko) { const lw = S.lastWinners || new Set(); if (lw.has(hero)) busted.forEach(p => { if (!p.isHero) Achv.ev('ko', {}); }); } else settleBounties(busted); }
  if (S.mode === 'sng') {
    const remaining = S.players.filter(p => !p.out && p.chips > 0).length;
    busted.sort((a, b) => b.startStack - a.startStack).forEach((p, k) => {
      p.out = true; p.place = remaining + k + 1;
      if (!p.isHero) {
        toast(`${p.name} ${p.arrested ? 'was arrested and finishes' : 'is out in'} ${ordinal(p.place)} place${prizeFor(p.place) ? ` · wins $${prizeFor(p.place)}` : ''}`, 3000);
        dealerSay('eliminated', `${p.name} is out, in ${ordinal(p.place)} place.`);
        react(p, 'bust', { say: false }); Chat.say(p, 'bust', { force: true, raw: true });
        const pp = people[p.i]; if (pp && !S.test) setTimeout(() => { pp.gesture('wave', 1.2); setTimeout(() => { bg(pp.fade(0, 900)); setTimeout(() => { if (Bar.drinks[p.i] && S.players[p.i] && S.players[p.i].out) { Bar.drinks[p.i].dispose(); Bar.drinks[p.i] = null; } }, 900); }, 1300); }, 2200);
      }
    });
    renderSeats(); renderTop(); renderDock();
    if (busted.length && remaining === 2 && !S.ann.itm && !hero.out) { S.ann.itm = true; setTimeout(() => { toast("You're in the money!", 3000); dealerSay('itm', 'Everyone left is in the money.'); }, 1800); }
    if (hero.out) { snapshotBetween(true); await delay(500); showEnd('bust'); return false; }
    if (remaining === 1) { snapshotBetween(true); await delay(400); showEnd('champ'); return false; }
  } else {
    for (const p of busted) {
      if (p.isHero) continue;
      react(p, 'bust', { say: false }); Chat.say(p, 'bust', { force: true, raw: true });
      const leaving = people[p.i];
      await delay(2000);
      if (leaving && !S.test && !p.arrested) { leaving.gesture('wave', 1); await delay(900); await leaving.fade(0, 800).catch(() => {}); }
      const seated = new Set(S.players.map(q => q.name));
      const pers = shuffled(Object.keys(PERSONAS))[0];
      const name = nameFor(pers, seated);
      const usedCols = new Set(S.players.map(q => q.colorIdx));
      const col = [...Array(AV_COLORS.length).keys()].find(c => !usedCols.has(c)) ?? p.colorIdx;
      S.players[p.i] = makePlayer(p.i, name, pers, CASH_STACK, col);
      toast(`${p.name} leaves · ${name} sits down`);
      syncPeople(); const arriving = people[p.i]; if (Bar.drinks[p.i]) { Bar.drinks[p.i].dispose(); Bar.drinks[p.i] = null; } Bar.place(p.i, FAV_DRINK[pers] || 'water', 1);
      if (arriving && !S.test) { arriving.alpha = 0; for (const m of arriving.mats) { m.transparent = true; m.opacity = 0; } bg(arriving.fade(1, 800)); }
      renderSeat(p.i);
      Chat.say(S.players[p.i], 'greet', { force: true, delay: 600, raw: true });
    }
    renderSeats();
    if (hero.chips <= 0) {
      renderTop(); renderDock();
      const choice = await askRebuy();
      if (choice !== 'rebuy') return false;
      hero.chips = CASH_STACK; S.heroBuyin += CASH_STACK; renderSeat(0); Sound.chips(10);
    }
  }
  if (Math.random() < 0.12) { const b = shuffled(S.players.filter(p => !p.isHero && !p.out))[0]; if (b) Chat.say(b, 'idle', { prob: 1 }); }
  DrinkOffer.maybe();
  renderTop(); renderDock();
  snapshotBetween();
  return true;
}

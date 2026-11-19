'use strict';
/* Velvet Hold'em: 08-tricks.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Table tricks: tipping the dealer, and needling opponents
   ========================================================= */
const escH = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]);
const TIP_SIZES = { small: { bb: 2, chance: 0.5 }, big: { bb: 5, chance: 0.8 } }; // the police keep this in check (08b-police.js)
const BRIBE_RATE = { maniac: 0.1, shark: 0.065, station: 0.05, rock: 0.018, pro: 0.012 };
const TAUNT_RATE = { maniac: 0.4, shark: 0.26, station: 0.06, rock: 0.05, pro: 0.045 };
const ANGER_CHANCE = { maniac: 0.62, shark: 0.36, station: 0.3, rock: 0.16, pro: 0.12, hero: 0.35 };
/* '@cat:k' reuses the k-th recorded line of that category, so it plays in the character's real voice */
const EXTRA_LINES = {
  maniac:  { taunt: ['@tellWeak:0', '@tellWeak:1', '@r_goodLuck:0', "Scared money don't make money!", 'Fold already, chicken!'],
             angry: ['@badBeat:0', "Oh, it's ON now!", 'You want a war? You got one!'], shrug: ['Ha! Nice try.', 'Whatever, pal.'],
             tipOffer: ['Here, buddy. Hook me up!', 'A little something. Make it a good one!'] },
  shark:   { taunt: ['@greet:0', '@heroSlow:1', '@r_gamble:0', "Is that all you've got?", "You're out of your depth."],
             angry: ["You'll regret that.", "Now you've done it."], shrug: ['@r_goodLuck:0', 'Cute.'],
             tipOffer: ['For your trouble.', "Let's keep this between us."] },
  rock:    { taunt: ["Son, you're bluffing.", '@r_gamble:0'], angry: ["That's it. Gloves are off.", 'Alright. You asked for it.'],
             shrug: ['@r_thanks:0', '@r_unlucky:0'], tipOffer: ['For you, partner.'] },
  station: { taunt: ['Hehe, are you nervous?', "I think you're bluffing!"], angry: ["Hey! That's not nice!", "Okay, now I'm mad!"],
             shrug: ["Aww, you're funny!", 'Nope, still happy!'], tipOffer: ["Here's a little something for you!"] },
  pro:     { taunt: ['Interesting play. Very interesting.', 'Sure you want to do that?'], angry: ["Fine. Let's dance.", 'Alright. No more Mr. Nice Guy.'],
             shrug: ['Nice try.', '@r_unlucky:0'], tipOffer: ['For the dealer.'] },
};
const HERO_TAUNTS = ['Scared?', "You're bluffing!", "Is that all you've got?", 'Easy money.', 'Your tell is showing.'];
const DEALER_TIP = { yes: ['Much appreciated.', "Very kind. I'll see what I can do.", 'Thank you kindly.'], no: ['Thank you, but I deal it straight.', 'Appreciated. The cards decide.', 'Nice try.'] };
Object.assign(CAT_FACE, { taunt: 'smug', angry: 'furious', shrug: 'smug', tipOffer: 'happy' });

function extraLine(persona, cat) {
  const list = (EXTRA_LINES[persona] || {})[cat]; if (!list || !list.length) return null;
  const raw = pick(list);
  if (raw[0] === '@') { const [c, k] = raw.slice(1).split(':'); return ((LINES[persona] || {})[c] || [])[+k] || null; }
  return { t: raw };
}
function sayExtra(p, cat, ms = 0) {
  if (S.test || !p || p.isHero || !settings.chat) return;
  const line = extraLine(p.persona, cat); if (!line) return;
  const run = RUN;
  setTimeout(() => { if (run === RUN && S.players[p.i] === p && !p.out) speakLine(p, line, cat); }, ms);
}

/* ---------- The dealer's speech bubble (lines that have no recording) ---------- */
const dealerHeadEl = document.createElement('div'); dealerHeadEl.className = 'head dealerhead'; dealerHeadEl.innerHTML = '<div class="bubble"></div>';
overlayEl.appendChild(dealerHeadEl);
function dealerLine(text) {
  if (S.test) return;
  const b = dealerHeadEl.querySelector('.bubble');
  b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), clamp(1800 + text.length * 50, 2400, 4200));
  if (dealerP) dealerP.talk(clamp(0.45 + text.length * 0.05, 0.7, 2.6));
  Sound.pop();
}

/* ---------- Anger ---------- */
const isAngry = p => !!p && !p.out && p.angryUntil != null && p.angryUntil >= S.handNo;
let angerTipShown = false;
function setAngry(p, src) {
  const was = isAngry(p);
  p.angryUntil = S.handNo + 1; // the rest of this hand and all of the next
  if (was) return;
  logLine(`${p.name} is fuming`);
  if (src && src.isHero && !p.isHero) Achv.ev('anger');
  if (S.test) return;
  Sound.ignite();
  if (p.isHero) {
    seatEls[0].classList.add('angry');
    toast(angerTipShown ? "You're fuming!" : "You're fuming! Bigger raises are lined up while you're angry", 3200);
    angerTipShown = true; renderDock();
  } else {
    seatEls[p.i].classList.add('angry');
    toast(`${p.name} is fuming!`, 2200);
    const pp = people[p.i];
    if (pp) {
      pp.mood = 'angry'; pp.emote('furious', 4); pp.setFire(true);
      // turn and glare at whoever set them off (you, if it was your taunt)
      pp.look = src && !src.isHero ? seatHeadWorld(src.i, new V3()) : camera.position.clone(); pp.glareUntil = performance.now() + 3800;
      pp.gesture(p.persona === 'maniac' || p.persona === 'rock' ? 'slam' : 'stare', 1.6, { onImpact: () => { Sound.thud(); Sound.chips(3, 0.5); } });
    }
    sayExtra(p, 'angry', 450);
  }
}
function calmDown(p, quiet) {
  if (p.angryUntil == null) return;
  p.angryUntil = null;
  if (p.isHero) { seatEls[0].classList.remove('angry'); renderDock(); return; }
  if (seatEls[p.i]) seatEls[p.i].classList.remove('angry');
  const pp = people[p.i];
  if (pp) { pp.mood = 'neutral'; pp.setFire(false); if (!quiet && !S.test) Sound.hiss(); }
}
function angerTick() { for (const p of S.players) if (p.angryUntil != null && (p.out || p.angryUntil < S.handNo)) calmDown(p); }
function clearAnger() { for (const p of S.players || []) { if (p.angryUntil != null) calmDown(p, true); } for (const el of seatEls) el.classList.remove('angry'); for (const pp of people) if (pp && pp.fire) pp.setFire(false); }

/* An angry player bets bigger, calls lighter and shoves more often */
function tiltAdjust(p, a) {
  if (!isAngry(p)) return a;
  const toCall = Math.max(0, S.currentBet - p.bet), cr = canRaise(p), stackTo = p.chips + p.bet, pot = S.pot + sumBets(), r = Math.random();
  const shove = () => A_('raise', stackTo);
  const big = mul => A_('raise', Math.max(S.currentBet * 2.6, S.currentBet + pot * mul, S.bb * 3));
  if (a.type === 'fold') { if (cr && r < 0.12) return shove(); if (r < 0.5) return A_('call'); return a; }
  if (a.type === 'check') { if (cr && r < 0.2) return shove(); if (cr && r < 0.65) return big(rand(0.8, 1.3)); return a; }
  if (a.type === 'call') { if (cr && r < 0.25) return shove(); if (cr && r < 0.55) return big(rand(0.9, 1.4)); return a; }
  if (a.type === 'raise') { if (r < 0.35) return shove(); return A_('raise', Math.min(stackTo, a.to * rand(1.5, 2.2))); }
  return a;
}

/* ---------- Taunts ---------- */
let lastTauntAt = 0, heroTauntAt = -1e9;
const HERO_TAUNT_CD = 15000;
function taunt(from, to) {
  if (!from || !to || from === to || from.out || to.out) return;
  const run = RUN;
  if (from.isHero) { heroTauntAt = performance.now(); if (!S.test) { showBubble(0, pick(HERO_TAUNTS)); Sound.pop(); } }
  else if (!S.test) {
    sayExtra(from, 'taunt');
    const pp = people[from.i]; if (pp) { pp.look = seatHeadWorld(to.i, new V3()); pp.gesture('smug', 1.6); }
  }
  const resolve = () => {
    if (run !== RUN || to.out || from.out) return;
    if (isAngry(to)) { to.angryUntil = S.handNo + 1; return; } // fuel on the fire
    const ch = to.isHero ? ANGER_CHANCE.hero : (ANGER_CHANCE[to.persona] ?? 0.3);
    if (Math.random() < ch) setAngry(to, from);
    else if (!S.test) {
      if (to.isHero) showBubble(0, '*Shrugs it off*');
      else { sayExtra(to, 'shrug', 200); pGest(to.i, 'shrug', 1.2); pEmote(to.i, 'smug', 2); }
    }
  };
  if (S.test) resolve(); else setTimeout(resolve, from.isHero ? 1100 : 1700);
}
function maybeAITaunt(p, mult, targets) {
  if (!p || p.isHero || p.out) return;
  const now = S.test ? S.handNo * 20000 : performance.now();
  if (now - lastTauntAt < 11000) return;
  if (Math.random() > (TAUNT_RATE[p.persona] || 0.03) * mult * (isAngry(p) ? 1.6 : 1)) return;
  let pool = (targets || S.players).filter(q => q !== p && !q.out);
  if (!pool.length) return;
  const hero = pool.find(q => q.isHero);
  const to = hero && Math.random() < 0.45 ? hero : pick(pool);
  lastTauntAt = now;
  if (S.test) taunt(p, to); else setTimeout(() => taunt(p, to), 900);
}

/* ---------- Tipping the dealer ---------- */
const tipAmount = size => Math.max(5, r5(S.bb * TIP_SIZES[size].bb));
const canTip = (p, size) => !!p && !p.out && S.started && !S.jail && p.chips > tipAmount(size) * 2 && p.tippedHand !== S.handNo;
let tipBusy = Promise.resolve();
function tipDealer(p, size) {
  if (!canTip(p, size)) return Promise.resolve(false);
  const amt = tipAmount(size);
  p.chips -= amt; S.tips = (S.tips || 0) + amt; p.tippedHand = S.handNo;
  const ok = !S.rig && Math.random() < TIP_SIZES[size].chance;
  if (ok) S.rig = { i: p.i };
  if (ok && p.isHero) Achv.ev('tipOk');
  Police.onBribe(p, size); // every bribe offer adds heat and may be spotted
  logLine(`${p.name} tips the dealer ${fmt(amt)}`);
  renderSeat(p.i); renderTop(); if (p.isHero) renderDock();
  if (S.test) return Promise.resolve(ok);
  const run = RUN;
  const show = async () => {
    // wait for the dealer's hands to be free
    for (let k = 0; k < 30 && dealerP && dealerP.gest && run === RUN; k++) await sleep(100);
    if (run !== RUN) return;
    if (p.isHero) { showBubble(0, size === 'big' ? 'For you. Make it a good one.' : 'For the dealer.'); Sound.pop(); }
    else { sayExtra(p, 'tipOffer'); pGest(p.i, 'bet', 0.7, { world: A.tipSpot }); }
    if (dealerP) dealerP.look = seatHeadWorld(p.i, new V3());
    await sleep(p.isHero ? 150 : 350);
    Sound.chips(chipCount(amt));
    await flyChips(amt, A.seats[p.i].stack, A.tipSpot, { dur: 560, arc: 0.07 });
    if (run !== RUN) return;
    dGest('reach', 0.7, { world: A.tipSpot, side: 1 });
    await sleep(500);
    if (run !== RUN || !dealerP) return;
    if (ok) { dealerP.gesture('nod', 1.2); dealerP.emote('wink', 1.6); dealerLine(pick(DEALER_TIP.yes)); }
    else { dealerP.gesture('headShake', 1.1); dealerP.emote('neutral', 1.2); dealerLine(pick(DEALER_TIP.no)); }
    await sleep(1300); lookAt(S.toAct >= 0 ? S.toAct : -1);
  };
  tipBusy = tipBusy.then(show).catch(() => {});
  return tipBusy.then(() => ok);
}
async function aiBribes(mode) {
  if (S.rig || S.bribedHand === S.handNo) return;
  if (mode === 'board' && S.pot + sumBets() < S.bb * 4) return;
  const cands = shuffled(S.players.filter(p => !p.isHero && !p.out && p.chips > 0 && (mode === 'hole' || (inHand(p) && !p.allIn))));
  for (const p of cands) {
    const rate = (BRIBE_RATE[p.persona] || 0.02) * (mode === 'hole' ? 0.5 : 1) * (isAngry(p) ? 1.5 : 1);
    if (Math.random() >= rate) continue;
    const size = p.persona === 'maniac' || Math.random() < 0.3 ? 'big' : 'small';
    if (!canTip(p, size)) continue;
    S.bribedHand = S.handNo;
    await tipDealer(p, size);
    if (!S.test) await delay(300);
    return;
  }
}
/* A paid-off dealer quietly stacks the next card(s) in the tipper's favour. Not a sure thing: one of their best options, not always the best. */
function applyRigBoard(n) {
  const r = S.rig; if (!r) return;
  const p = S.players[r.i]; if (!p || !inHand(p) || !dealtIn(p)) return;
  S.rig = null;
  const deck = S.deck, need = n === 3 ? 3 : 1, cands = [];
  if (need === 1) for (let j = 0; j < deck.length; j++) cands.push([j]);
  else for (let k = 0; k < 140; k++) { const a = (Math.random() * deck.length) | 0, b = (Math.random() * deck.length) | 0, c = (Math.random() * deck.length) | 0; if (a !== b && b !== c && a !== c) cands.push([a, b, c]); }
  if (!cands.length) return;
  for (const c of cands) c.score = evaluate([...p.hole, ...S.board, ...c.map(j => deck[j])]);
  cands.sort((x, y) => y.score - x.score);
  const chosen = pick(cands.slice(0, Math.max(1, Math.ceil(cands.length * 0.15)))).map(j => deck[j]);
  S.deck = deck.filter(c => !chosen.includes(c)).concat(chosen);
}
function applyRigHole(dealt) {
  const r = S.rig; if (!r) return;
  const k = dealt.indexOf(r.i); if (k < 0) return;
  S.rig = null;
  const deck = S.deck, pairs = [];
  for (let t = 0; t < 80; t++) { const a = (Math.random() * deck.length) | 0, b = (Math.random() * deck.length) | 0; if (a !== b) pairs.push([deck[a], deck[b]]); }
  pairs.sort((x, y) => CHEN[y[0] * 52 + y[1]] - CHEN[x[0] * 52 + x[1]]);
  const chosen = pick(pairs.slice(0, Math.max(1, Math.ceil(pairs.length * 0.12))));
  const L = deck.length, len = dealt.length, t1 = L - 1 - k, t2 = L - 1 - len - k;
  const rest = deck.filter(c => !chosen.includes(c));
  rest.splice(t2, 0, chosen[1]); rest.splice(t1, 0, chosen[0]);
  S.deck = rest;
}

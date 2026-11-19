'use strict';
/* Velvet Hold'em: 16-ai.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   AI with adaptive reads and timing tells
   ========================================================= */
const A_ = (type, to) => ({ type, to });
function posScore(p) {
  const order = []; for (let k = 0; k < NS; k++) { const j = (S.sbI + k) % NS; if (dealtIn(S.players[j])) order.push(j); }
  const n = order.length, idx = order.indexOf(p.i);
  if (n === 2) return p.i === S.button ? 1 : 0.6;
  if (idx === 0) return 0.3; if (idx === 1) return 0.45;
  return n <= 3 ? 1 : 0.05 + 0.95 * (idx - 2) / (n - 3);
}
function heroRead() {
  const h = S.players[0], n = h ? h.st.hands : 0, hm = S.hm;
  return {
    conf: clamp(n / 25, 0, 1),
    vpip: n ? h.st.vpip / n : 0.3, pfr: n ? h.st.pfr / n : 0.15,
    ftb: hm.faced >= 5 ? hm.foldFaced / hm.faced : 0.45,
    af: hm.aggr + hm.pass >= 6 ? hm.aggr / Math.max(1, hm.pass) : 1,
  };
}
function oppFilter(q) {
  if (q.isHero) {
    const r = heroRead();
    if (q.pf === 'raise') return clamp(Math.round(11 - r.pfr * 14), 5, 10);
    if (q.pf === 'call') return clamp(Math.round(8 - r.vpip * 8), 3, 7);
    return 0;
  }
  return q.pf === 'raise' ? 9 : q.pf === 'call' ? 6 : 0;
}
function aiDecide(p) {
  const toCall = Math.max(0, S.currentBet - p.bet);
  const cr = canRaise(p);
  return drunkAdjust(p, tiltAdjust(p, rivalAdjust(p, S.board.length === 0 ? aiPreflop(p, toCall, cr) : aiPostflop(p, toCall, cr))));
}
function aiPreflop(p, toCall, cr) {
  const Pp = P(p), bb = S.bb, sharp = S.level === 'sharp';
  let s = CHEN[p.hole[0] * 52 + p.hole[1]];
  const hi = Math.max(rankOf(p.hole[0]), rankOf(p.hole[1])), lo = Math.min(rankOf(p.hole[0]), rankOf(p.hole[1]));
  if (hi === 14 && lo === 13) s += 2;
  const raw = s;
  s += (Math.random() * 2 - 1) * (sharp ? 0.8 : 1.8);
  const pos = posScore(p), tightAdj = (Pp.tight - 0.5) * 5, posAdj = pos * 2.2;
  const stackTo = p.chips + p.bet;
  const others = S.players.filter(q => q !== p && inHand(q));
  const maxOther = Math.max(0, ...others.map(q => q.chips + q.bet));
  const effBB = Math.min(stackTo, maxOther) / bb;
  const raises = Math.max(S.frc, S.currentBet > bb ? 1 : 0);
  const callAmt = Math.min(toCall, p.chips);
  const hero = S.players[0], heroRaised = hero && inHand(hero) && hero.pf === 'raise';
  const rd = heroRead(), adapt = Pp.adapt * (sharp ? 1 : 0.6) * rd.conf;
  const vsLoose = heroRaised ? adapt * clamp((rd.pfr - 0.2) * 6, -1, 1.5) : 0;
  const str = clamp((raw - 3) / 13, 0, 1);
  const info = { str, hard: 0, big: callAmt > stackTo * 0.25 };
  p._info = info;
  if (effBB <= 13) {
    if (raises === 0) {
      const pushT = 8.5 + tightAdj * 0.6 - posAdj * 0.7 - (13 - effBB) * 0.3;
      info.hard = clamp(1 - Math.abs(s - pushT) / 2, 0, 1) * 0.5;
      if (s >= pushT && cr) { info.big = true; return A_('raise', stackTo); }
      if (toCall === 0) return A_('check');
      if (callAmt <= bb / 2 && s >= pushT - 2.5) return A_('call');
      return A_('fold');
    }
    const committed = callAmt / Math.max(1, p.chips);
    const callT = 10 + tightAdj * 0.6 - (committed < 0.3 ? 1.5 : 0) - (Pp.sticky ? 1 : 0) - vsLoose;
    info.hard = clamp(1 - Math.abs(s - callT) / 2, 0, 1); info.big = true;
    if (s >= callT + 2 && cr) return A_('raise', stackTo);
    if (s >= callT) return A_('call');
    return toCall === 0 ? A_('check') : A_('fold');
  }
  if (raises === 0) {
    const limpers = S.players.filter(q => q !== p && q.pf === 'call').length;
    const openT = 8.5 + tightAdj - posAdj;
    if (s >= openT) {
      if (cr && Math.random() < 0.55 + 0.45 * Pp.aggr) return A_('raise', bb * (rand(2.2, 3) + limpers));
      return toCall === 0 ? A_('check') : A_('call');
    }
    if (toCall === 0) return A_('check');
    const isSB = p.i === S.sbI && S.players.filter(dealtIn).length > 2;
    if (isSB && s >= openT - 2.5) return A_('call');
    if (Pp.aggr < 0.5 && s >= openT - 1.5 && Math.random() < 0.7) return A_('call');
    if (Pp.tight < 0.35 && s >= openT - 3 && Math.random() < 0.55) return A_('call');
    return A_('fold');
  }
  const raiseBB = S.currentBet / bb;
  const callT = 9 + tightAdj * 0.8 - posAdj * 0.4 + Math.min(4, Math.max(0, raiseBB - 2.5) * 0.45) + (raises - 1) * 1.8 + (Pp.sticky ? -1.5 : 0) - vsLoose;
  const threeT = 12 + tightAdj * 0.5 + (raises - 1) * 2 - vsLoose * 0.6;
  const cheap = callAmt <= bb * 1.5;
  info.hard = clamp(1 - Math.abs(s - callT) / 2, 0, 1);
  if (cr && s >= threeT && Math.random() < 0.45 + 0.5 * Pp.aggr) {
    let to = raises >= 2 ? S.currentBet * 2.3 : S.currentBet * 3 + others.filter(q => q.pf === 'call').length * S.currentBet;
    if (to >= stackTo * 0.42) { to = stackTo; info.big = true; }
    return A_('raise', to);
  }
  if (s >= callT || (cheap && s >= callT - 2.5)) return A_('call');
  if (cr && raises === 1 && pos > 0.6 && s >= 6 && Math.random() < Pp.bluff * 0.5) return A_('raise', S.currentBet * 3);
  return toCall === 0 ? A_('check') : A_('fold');
}
function aiPostflop(p, toCall, cr) {
  const Pp = P(p), sharp = S.level === 'sharp';
  const opps = S.players.filter(q => q !== p && inHand(q));
  const filters = opps.map(oppFilter);
  let eq = equity(p.hole, S.board, filters, sharp ? 650 : 320);
  const trueEq = eq;
  eq = clamp(eq + (Math.random() * 2 - 1) * (sharp ? 0.03 : 0.08), 0, 1);
  const n = opps.length, fair = 1 / (n + 1), str = eq / fair;
  const pot = S.pot + sumBets(), stackTo = p.chips + p.bet, street = S.board.length;
  const heroIn = opps.some(q => q.isHero);
  const rd = heroRead(), adapt = heroIn ? Pp.adapt * (sharp ? 1 : 0.6) * rd.conf : 0;
  const bluffMul = lerp(1, rd.ftb > 0.55 ? 1.8 : rd.ftb < 0.3 ? 0.45 : 1, adapt);
  const callMul = lerp(1, rd.af > 2.2 ? 0.84 : rd.af < 0.6 ? 1.12 : 1, adapt);
  const info = { str: trueEq, hard: 0, big: false }; p._info = info;
  if (toCall === 0) {
    let pb;
    if (eq > 0.78) pb = (Math.random() < Pp.trap && street < 5) ? 0.15 : 0.75 + 0.2 * Pp.aggr;
    else if (eq > 0.55 && str > 1.3) pb = 0.35 + 0.5 * Pp.aggr;
    else if (str > 1.15) pb = 0.12 + 0.3 * Pp.aggr;
    else pb = Pp.bluff * bluffMul * (n === 1 ? 1.6 : n === 2 ? 0.8 : 0.3) * (street === 5 ? 1.2 : 1);
    info.hard = clamp(1 - Math.abs(eq - 0.5) * 3, 0, 0.5);
    if (cr && Math.random() < pb) {
      const f = eq > 0.78 ? rand(0.6, 1.05) : eq > 0.5 ? rand(0.45, 0.8) : rand(0.4, 0.7);
      let to = Math.max(S.bb, pot * f);
      if (to >= p.chips * 0.62 || (p.chips < pot * 1.2 && eq > 0.6)) { to = stackTo; info.big = true; }
      return A_('raise', to);
    }
    return A_('check');
  }
  const callAmt = Math.min(toCall, p.chips);
  const potOdds = callAmt / (pot + callAmt);
  const commit = callAmt / Math.max(1, stackTo);
  let need = (potOdds * (0.8 + 0.5 * Pp.tight) + commit * 0.12 * Pp.tight) * callMul;
  if (Pp.sticky) need *= 0.72;
  info.hard = clamp(1 - Math.abs(eq - need) * 5, 0, 1); info.big = callAmt > stackTo * 0.3;
  if (eq < need) {
    if (cr && n === 1 && street < 5 && Math.random() < Pp.bluff * 0.3 * bluffMul) { let to = S.currentBet * 2.6 + pot * 0.25; if (to >= stackTo * 0.6) to = stackTo; return A_('raise', to); }
    return A_('fold');
  }
  let pr = 0;
  if (eq > 0.8) pr = 0.4 + 0.5 * Pp.aggr;
  else if (eq > 0.62 && str > 1.5) pr = 0.12 + 0.35 * Pp.aggr;
  if (Pp.sticky) pr *= 0.4;
  if (cr && Math.random() < pr) {
    let to = S.currentBet + Math.max(S.minRaise, (pot + callAmt) * rand(0.6, 1.0));
    if (to >= stackTo * 0.55) { to = stackTo; info.big = true; }
    return A_('raise', to);
  }
  return A_('call');
}
/* How long a player thinks, and what they give away while doing it */
function thinkPlan(p, a) {
  const inf = p._info || { str: .4, hard: 0, big: false };
  const strong = inf.str > (S.board.length ? .72 : .62), weak = inf.str < (S.board.length ? .35 : .3);
  const acting = a.type !== 'fold';
  let ms, tell = null, riffle = false;
  switch (p.persona) {
    case 'maniac':
      ms = rand(320, 780);
      if (strong && acting) { ms = rand(1500, 2600); if (Math.random() < .45) tell = 'tellStrong'; }
      else if (weak && a.type === 'raise' && Math.random() < .45) tell = 'tellWeak';
      break;
    case 'station':
      ms = rand(600, 1100);
      if (strong && acting) { ms = rand(1400, 2400); if (Math.random() < .5) tell = 'tellStrong'; }
      else if (weak) { ms = rand(420, 800); if (Math.random() < .3) tell = 'tellWeak'; }
      break;
    case 'rock':
      ms = a.type === 'fold' ? rand(260, 520) : rand(800, 1400);
      if (strong && acting) { ms = rand(1500, 2500); if (Math.random() < .3) tell = 'tellStrong'; }
      else if (weak && acting && Math.random() < .2) tell = 'tellWeak';
      break;
    case 'shark':
      ms = rand(900, 1400); if (Math.random() < .12) tell = 'tellStrong';
      break;
    default:
      ms = rand(700, 2100); if (Math.random() < .12) tell = Math.random() < .5 ? 'tellStrong' : 'tellWeak';
  }
  if (S.board.length) ms += 200;
  if (inf.big && inf.hard > .4) { ms += rand(1400, 2800); riffle = p.persona !== 'rock' && p.persona !== 'shark'; }
  else if (inf.hard > .6) ms += rand(400, 1000);
  if (S.level === 'sharp') ms *= 1.08;
  return { ms, tell, riffle };
}

/* =========================================================
   Pots
   ========================================================= */
function buildPots(players) {
  const levels = [...new Set(players.filter(p => p.total > 0 && !p.folded && !p.out).map(p => p.total))].sort((a, b) => a - b);
  const pots = []; let prev = 0;
  for (const L of levels) {
    let amt = 0; for (const p of players) amt += Math.max(0, Math.min(p.total, L) - prev);
    const elig = players.filter(p => !p.folded && !p.out && p.total >= L);
    if (amt > 0) {
      const last = pots[pots.length - 1];
      if (last && last.eligible.length === elig.length) last.amount += amt; else pots.push({ amount: amt, eligible: elig });
    }
    prev = L;
  }
  const accounted = pots.reduce((a, x) => a + x.amount, 0), total = players.reduce((a, p) => a + p.total, 0);
  if (pots.length && total > accounted) pots[pots.length - 1].amount += total - accounted;
  return pots;
}

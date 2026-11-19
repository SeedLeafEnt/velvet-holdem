'use strict';
/* Velvet Hold'em: 01-core.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Utilities
   ========================================================= */
const $ = (s, el = document) => el.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = n => Math.round(n).toLocaleString('en-US');
const r5 = n => Math.round(n / 5) * 5;
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)] || 'th');
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeSlide = t => 1 - Math.pow(1 - t, 4);
function lerpAngle(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }
function shuffled(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function secureShuffle(a) {
  const buf = new Uint32Array(a.length);
  try { crypto.getRandomValues(buf); } catch (e) { for (let i = 0; i < buf.length; i++) buf[i] = Math.random() * 4294967296; }
  for (let i = a.length - 1; i > 0; i--) { const j = buf[i] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function prand(seed) { let t = (seed + 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmtClock = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* =========================================================
   Cards & hand evaluation
   card int c: rank = (c >> 2) + 2 (2..14), suit = c & 3 (0♠ 1♥ 2♦ 3♣)
   ========================================================= */
const RANK_CH = ['', '', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RN = ['', '', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'];
const PL = ['', '', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes', 'Sevens', 'Eights', 'Nines', 'Tens', 'Jacks', 'Queens', 'Kings', 'Aces'];
const SUIT_TXT = ['♠︎', '♥︎', '♦︎', '♣︎'];
const rankOf = c => (c >> 2) + 2, suitOf = c => c & 3;

function straightHi(m) {
  if (m & (1 << 14)) m |= 2;
  for (let hi = 14; hi >= 5; hi--) if (((m >> (hi - 4)) & 31) === 31) return hi;
  return 0;
}
function evaluate(cards) {
  const rc = new Uint8Array(15), sc = [0, 0, 0, 0], sm = [0, 0, 0, 0];
  let rm = 0;
  for (let i = 0; i < cards.length; i++) { const c = cards[i], r = (c >> 2) + 2, s = c & 3; rc[r]++; sc[s]++; sm[s] |= 1 << r; rm |= 1 << r; }
  let fs = -1; for (let s = 0; s < 4; s++) if (sc[s] >= 5) fs = s;
  if (fs >= 0) { const sf = straightHi(sm[fs]); if (sf) return (8 << 20) | (sf << 16); }
  let quad = 0; const trips = [], pairs = [], singles = [];
  for (let r = 14; r >= 2; r--) { const n = rc[r]; if (n === 4) quad = r; else if (n === 3) trips.push(r); else if (n === 2) pairs.push(r); else if (n === 1) singles.push(r); }
  if (quad) { let k = 0; for (let r = 14; r >= 2; r--) if (r !== quad && rc[r]) { k = r; break; } return (7 << 20) | (quad << 16) | (k << 12); }
  if (trips.length && (trips.length > 1 || pairs.length)) { const t = trips[0]; const p = trips.length > 1 ? Math.max(trips[1], pairs[0] || 0) : pairs[0]; return (6 << 20) | (t << 16) | (p << 12); }
  if (fs >= 0) { let v = 5 << 20, sh = 16; const m = sm[fs]; for (let r = 14; r >= 2 && sh >= 0; r--) if (m & (1 << r)) { v |= r << sh; sh -= 4; } return v; }
  const st = straightHi(rm); if (st) return (4 << 20) | (st << 16);
  if (trips.length) return (3 << 20) | (trips[0] << 16) | (singles[0] << 12) | (singles[1] << 8);
  if (pairs.length >= 2) { const p1 = pairs[0], p2 = pairs[1]; let k = 0; for (let r = 14; r >= 2; r--) if (rc[r] && r !== p1 && r !== p2) { k = r; break; } return (2 << 20) | (p1 << 16) | (p2 << 12) | (k << 8); }
  if (pairs.length === 1) return (1 << 20) | (pairs[0] << 16) | (singles[0] << 12) | (singles[1] << 8) | (singles[2] << 4);
  return (singles[0] << 16) | (singles[1] << 12) | (singles[2] << 8) | (singles[3] << 4) | singles[4];
}
function handName(score) {
  const cat = score >> 20, r1 = (score >> 16) & 15, r2 = (score >> 12) & 15;
  switch (cat) {
    case 8: return r1 === 14 ? 'Royal Flush' : `Straight Flush, ${RN[r1]} high`;
    case 7: return `Four of a Kind, ${PL[r1]}`;
    case 6: return `Full House, ${PL[r1]} full of ${PL[r2]}`;
    case 5: return `Flush, ${RN[r1]} high`;
    case 4: return `Straight, ${RN[r1]} high`;
    case 3: return `Three of a Kind, ${PL[r1]}`;
    case 2: return `Two Pair, ${PL[r1]} and ${PL[r2]}`;
    case 1: return `Pair of ${PL[r1]}`;
    default: return `High Card, ${RN[r1]}`;
  }
}
function shortName(score) {
  const cat = score >> 20, r1 = (score >> 16) & 15;
  return cat === 8 && r1 === 14 ? 'Royal Flush' : ['High Card', 'Pair', 'Two Pair', 'Trips', 'Straight', 'Flush', 'Full House', 'Quads', 'Straight Flush'][cat];
}
function spokenHand(score) {
  const cat = score >> 20, r1 = (score >> 16) & 15;
  return ['ace high', `a pair of ${PL[r1].toLowerCase()}`, 'two pair', `three ${PL[r1].toLowerCase()}`, 'a straight', 'a flush', 'a full house', `four ${PL[r1].toLowerCase()}`, r1 === 14 ? 'a royal flush' : 'a straight flush'][cat].replace('ace high', `${RN[r1].toLowerCase()} high`);
}
function bestFive(cards) {
  let best = -1, combo = null; const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
    const h = [cards[a], cards[b], cards[c], cards[d], cards[e]]; const s = evaluate(h);
    if (s > best) { best = s; combo = h; }
  }
  return combo || cards.slice(0, 5);
}
function preflopName(h) {
  let a = rankOf(h[0]), b = rankOf(h[1]); if (a < b) [a, b] = [b, a];
  if (a === b) return `Pocket ${PL[a]}`;
  return `${RN[a]}-${RN[b]} ${suitOf(h[0]) === suitOf(h[1]) ? 'suited' : 'offsuit'}`;
}
function cardTxt(c) {
  const s = suitOf(c), cls = s === 1 ? 'r' : s === 2 ? (settings.deck4 ? 'b' : 'r') : s === 3 ? (settings.deck4 ? 'g' : 'k') : 'k';
  return `<span class="${cls}">${RANK_CH[rankOf(c)]}${SUIT_TXT[s]}</span>`;
}

const CHEN = new Float32Array(52 * 52);
(function buildChen() {
  const base = r => r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2;
  for (let x = 0; x < 52; x++) for (let y = 0; y < 52; y++) {
    if (x === y) continue;
    let r1 = rankOf(x), r2 = rankOf(y); if (r1 < r2) [r1, r2] = [r2, r1];
    let s = base(r1);
    if (r1 === r2) s = Math.max(5, s * 2);
    else {
      if (suitOf(x) === suitOf(y)) s += 2;
      const gap = r1 - r2 - 1;
      s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
      if (gap <= 1 && r1 < 12) s += 1;
    }
    CHEN[x * 52 + y] = Math.ceil(s);
  }
})();

function equity(hole, board, filters, iters) {
  const used = new Uint8Array(52);
  for (const c of hole) used[c] = 1; for (const c of board) used[c] = 1;
  const deck = []; for (let c = 0; c < 52; c++) if (!used[c]) deck.push(c);
  const n = filters.length, L = deck.length, bl = board.length;
  if (n === 0) return 1;
  const mine = new Array(7), opp = new Array(7), oh = new Array(n * 2);
  mine[0] = hole[0]; mine[1] = hole[1];
  for (let k = 0; k < bl; k++) { mine[2 + k] = board[k]; opp[2 + k] = board[k]; }
  let win = 0, top = L;
  const draw = () => { const j = (Math.random() * top) | 0; const c = deck[j]; deck[j] = deck[top - 1]; deck[top - 1] = c; top--; return c; };
  for (let it = 0; it < iters; it++) {
    top = L;
    for (let o = 0; o < n; o++) {
      let a, b, tries = 0;
      for (;;) {
        a = draw(); b = draw();
        if (!filters[o] || CHEN[a * 52 + b] >= filters[o] || tries++ > 10 || Math.random() < 0.1) break;
        top += 2;
      }
      oh[o * 2] = a; oh[o * 2 + 1] = b;
    }
    for (let k = bl; k < 5; k++) { const c = draw(); mine[2 + k] = c; opp[2 + k] = c; }
    const my = evaluate(mine);
    let best = -1, ties = 0;
    for (let o = 0; o < n; o++) { opp[0] = oh[o * 2]; opp[1] = oh[o * 2 + 1]; const v = evaluate(opp); if (v > best) { best = v; ties = 1; } else if (v === best) ties++; }
    if (my > best) win += 1; else if (my === best) win += 1 / (ties + 1);
  }
  return win / iters;
}
function runoutEquity(hands, board) {
  const used = new Uint8Array(52); hands.forEach(h => h.forEach(c => used[c] = 1)); board.forEach(c => used[c] = 1);
  const rest = []; for (let c = 0; c < 52; c++) if (!used[c]) rest.push(c);
  const n = hands.length, need = 5 - board.length, wins = new Float64Array(n); let total = 0;
  const cards = hands.map(h => [h[0], h[1], ...board, 0, 0, 0, 0, 0].slice(0, 7));
  const score = extra => {
    let best = -1; const sc = new Array(n);
    for (let i = 0; i < n; i++) { for (let k = 0; k < extra.length; k++) cards[i][2 + board.length + k] = extra[k]; sc[i] = evaluate(cards[i]); if (sc[i] > best) best = sc[i]; }
    let w = 0; for (let i = 0; i < n; i++) if (sc[i] === best) w++;
    for (let i = 0; i < n; i++) if (sc[i] === best) wins[i] += 1 / w;
    total++;
  };
  if (need === 0) score([]);
  else if (need === 1) for (const a of rest) score([a]);
  else if (need === 2) { for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) score([rest[i], rest[j]]); }
  else {
    const R = rest.slice();
    for (let it = 0; it < 2500; it++) {
      const ex = []; let top = R.length;
      for (let k = 0; k < need; k++) { const j = (Math.random() * top) | 0; ex.push(R[j]); [R[j], R[top - 1]] = [R[top - 1], R[j]]; top--; }
      score(ex);
    }
  }
  return Array.from(wins, w => w / total);
}

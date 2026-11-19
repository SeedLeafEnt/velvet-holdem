'use strict';
/* Velvet Hold'em: 05-state.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   State
   ========================================================= */
const settings = { sound: true, music: true, amb: false, odds: true, deck4: false, speed: 'normal', voice: true, chat: true, cardStyle: 'classic', view: 'seated', quality: 'high' };
const SPEEDS = { relaxed: 1.4, normal: 1, fast: 0.55 };
const S = {
  players: [], mode: 'sng', level: 'relaxed', structure: 'turbo', handNo: 0, blindIdx: 0, sb: 10, bb: 20, ante: 0, button: 0, sbI: 0, bbI: 0,
  deck: [], board: [], boardCards: [], muckCards: [], pot: 0, currentBet: 0, minRaise: 20, frc: 0,
  log: [], history: [], stats: { hands: 0, won: 0, biggest: 0, best: -1 }, heroBuyin: 0,
  inHand: false, betweenHands: true, toAct: -1, pre: null, raising: false, raiseTo: 0,
  heroResolve: null, heroReject: null, runout: false, saved: null, test: false, started: false, ann: {},
  hm: { faced: 0, foldFaced: 0, aggr: 0, pass: 0 },
};
let RUN = 0;
const ABORT = new Error('abort');
const bg = p => { if (p && p.catch) p.catch(() => {}); };
function spd() {
  if (S.test) return 0.004;
  let f = SPEEDS[settings.speed] || 1;
  const hero = S.players[0];
  if (S.inHand && hero && (hero.folded || hero.out)) f *= 0.55;
  return f;
}
function applySpeedVar() { document.documentElement.style.setProperty('--t', spd()); }
async function delay(ms) { const r = RUN; await sleep(ms * spd()); if (r !== RUN) throw ABORT; }

const inHand = p => p && !p.out && !p.folded;
const canActP = p => inHand(p) && !p.allIn;
const dealtIn = p => p && p.hole.length === 2;
const isActiveSeat = i => { const p = S.players[i]; return p && !p.out && p.chips > 0; };
function nextFrom(i, pred) { for (let k = 1; k <= NS; k++) { const j = (i + k) % NS; if (pred(j)) return j; } return -1; }
const liveCount = () => S.players.filter(inHand).length;
const sumBets = () => S.players.reduce((a, p) => a + p.bet, 0);
function canRaise(p) {
  if (!canActP(p)) return false;
  if (p.chips <= S.currentBet - p.bet) return false;
  if (p.afrc === S.frc) return false;
  return S.players.some(q => q !== p && canActP(q));
}

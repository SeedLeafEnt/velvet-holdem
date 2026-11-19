'use strict';
/* Velvet Hold'em: 09-career.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Stage 3: career bankroll, rooms around the world, bounty Sit & Gos,
   achievements and daily challenges
   ========================================================= */
const ROOMS = [
  { id: 'club', name: 'Riverside Card Club', place: 'Your hometown', level: 'relaxed', need: 0, cash: 100, sng: 50, ko: [50, 20],
    felt: ['#1b8174', '#11685d', '#0a4740'], logo: 'RIVERSIDE', sub: 'CARD CLUB', rail: '#3d1711', sheen: '#7a3a2c', spot: 0xffe2bf, floor: '#ffffff', accent: '#2f9e8e' },
  { id: 'vegas', name: 'The Golden Strip', place: 'Las Vegas', level: 'sharp', need: 1500, cash: 500, sng: 250, ko: [250, 100],
    felt: ['#b02634', '#86182a', '#520c17'], logo: 'GOLDEN STRIP', sub: 'LAS VEGAS', rail: '#161316', sheen: '#6b4b7a', spot: 0xffd8ee, floor: '#ffd3ec', accent: '#e0455a' },
  { id: 'macau', name: 'Dragon Pearl', place: 'Macau', level: 'sharp', need: 6000, cash: 2500, sng: 1000, ko: [1000, 400],
    felt: ['#2a64b4', '#1b4a8a', '#0d2b55'], logo: 'DRAGON PEARL', sub: 'MACAU', rail: '#5e3f0e', sheen: '#d4a646', spot: 0xffe3b5, floor: '#ffcdb0', accent: '#d4a646' },
  { id: 'monaco', name: 'Riviera Grand', place: 'Monte Carlo', level: 'sharp', need: 25000, cash: 10000, sng: 5000, ko: [5000, 2000],
    felt: ['#6a2a5e', '#4c1d45', '#2b0f27'], logo: 'RIVIERA', sub: 'MONTE CARLO', rail: '#1c2338', sheen: '#8fa4d4', spot: 0xeef1ff, floor: '#d6defc', accent: '#a98bd6' },
];
const THEME_DEFAULT = { felt: ['#1b8174', '#11685d', '#0a4740'], logo: 'VELVET', sub: "NO LIMIT TEXAS HOLD'EM", rail: '#3d1711', sheen: '#7a3a2c', spot: 0xffe2bf, floor: '#ffffff' };
let THEME = THEME_DEFAULT;
function applyTheme(t) {
  THEME = t || THEME_DEFAULT;
  if (!MAT || !MAT.rail) return;
  MAT.rail.color.set(THEME.rail); if (MAT.rail.sheenColor) MAT.rail.sheenColor.set(THEME.sheen);
  if (spot) spot.color.set(THEME.spot);
  if (MAT.floor) MAT.floor.color.set(THEME.floor);
  if (MAT.felt && G.felt) { if (MAT.felt.map) MAT.felt.map.dispose(); MAT.felt.map = feltTexture(); MAT.felt.needsUpdate = true; }
}
const money = n => '$' + fmt(Math.round(n));

/* ---------- Career store ---------- */
const CAREER_KEY = 'velvet3d-career-v1';
const Career = {
  d: null,
  load() {
    if (this.d) return this.d;
    let d = null; try { d = JSON.parse(localStorage.getItem(CAREER_KEY) || 'null'); } catch (e) {}
    this.d = Object.assign({ bankroll: 1000, xp: 0, rooms: { club: true }, visited: {}, ach: {}, counters: {}, daily: null, bonusDay: '', streak: 0, lastBail: 0, cal: { min: 0 } }, d || {});
    return this.d;
  },
  save() { try { localStorage.setItem(CAREER_KEY, JSON.stringify(this.d)); } catch (e) {} },
  level(xp = this.load().xp) { return Math.floor(Math.sqrt(xp / 40)) + 1; },
  xpAt(l) { return 40 * (l - 1) * (l - 1); },
  addXP(n) { if (S.test) return; const d = this.load(), before = this.level(); d.xp += Math.round(n); this.save(); const after = this.level(); if (after > before) toast(`Level ${after}!`, 2400); },
  add(n, why) {
    if (S.test || !n) return; const d = this.load(); d.bankroll = Math.max(0, Math.round(d.bankroll + n)); this.save();
    if (why) toast(`${n > 0 ? '+' : ''}${money(n)} · ${why}`, 2600);
    this.checkUnlocks(); renderCareerChip();
  },
  spend(n) { const d = this.load(); if (d.bankroll < n) return false; d.bankroll -= n; this.save(); renderCareerChip(); return true; },
  checkUnlocks() {
    const d = this.load();
    for (const r of ROOMS) if (!d.rooms[r.id] && d.bankroll >= r.need) { d.rooms[r.id] = true; this.save(); setTimeout(() => toast(`New room unlocked: ${r.place}`, 3200), 1200); if (r.id !== 'club') Achv.unlock(r.id); }
    if (d.bankroll >= 100000) Achv.unlock('bank100k');
  },
  today() { const t = new Date(); return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`; },
  yesterday() { const t = new Date(Date.now() - 864e5); return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`; },
  dailyBonus() { const d = this.load(); const st = d.bonusDay === this.yesterday() ? d.streak + 1 : 1; return { amt: 200 + 50 * Math.min(st - 1, 6), streak: st }; },
  claimDaily() { const d = this.load(); if (d.bonusDay === this.today()) return; const b = this.dailyBonus(); d.bonusDay = this.today(); d.streak = b.streak; this.save(); this.add(b.amt, `Daily chips · day ${b.streak}`); Sound.win(); },
};

/* ---------- Calendar: game time that only moves while you play in Career mode ----------
   One poker hand = 4 hours, one blackjack round or roulette spin = 2 hours.
   It starts on Monday 1 January, Year 1, at 8 PM (2024 is used for the date maths because it starts on a Monday).
   Other systems (the bank, later) listen with Cal.on(fn); fn gets { type: 'day'|'week'|'month', from, to }. */
const CAL_BASE = Date.UTC(2024, 0, 1, 20, 0), CAL_YEAR0 = 2023;
const CAL_STEP = { hand: 240, casino: 120 };
const CAL_DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CAL_MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const Cal = {
  subs: [],
  min() { const d = Career.load(); return (d.cal && d.cal.min) || 0; },
  parts(min = this.min()) {
    const t = new Date(CAL_BASE + min * 60000), day = t.getUTCDate();
    return { year: t.getUTCFullYear() - CAL_YEAR0, month: t.getUTCMonth(), day, dow: t.getUTCDay(), hour: t.getUTCHours(), firstWeek: day <= 7, dayNo: Math.floor((min + 20 * 60) / 1440) + 1 };
  },
  hourText(h) { return h === 0 ? 'Midnight' : h === 12 ? 'Noon' : `${h % 12} ${h < 12 ? 'AM' : 'PM'}`; },
  short(min) { const p = this.parts(min); return `${CAL_DOW[p.dow].slice(0, 3)} ${p.day} ${CAL_MON[p.month].slice(0, 3)} · ${this.hourText(p.hour)}`; },
  long(min) { const p = this.parts(min); return `${CAL_DOW[p.dow]} ${p.day} ${CAL_MON[p.month]}, Year ${p.year} · ${this.hourText(p.hour)}`; },
  dateText(min) { const p = this.parts(min); return `${CAL_DOW[p.dow].slice(0, 3)} ${p.day} ${CAL_MON[p.month].slice(0, 3)}`; },
  // minutes at midnight starting day `day` of the month `addMon` months after `min`'s month
  monthDay(min, day, addMon = 0) { const t = new Date(CAL_BASE + min * 60000); return (Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + addMon, day) - CAL_BASE) / 60000; },
  addMonths(min, n) { const t = new Date(CAL_BASE + min * 60000); t.setUTCMonth(t.getUTCMonth() + n); return (t.getTime() - CAL_BASE) / 60000; },
  on(fn) { this.subs.push(fn); },
  advance(kind) {
    if (S.test || !CAL_STEP[kind]) return;
    const d = Career.load(); if (!d.cal) d.cal = { min: 0 };
    const from = this.parts(d.cal.min);
    d.cal.min += CAL_STEP[kind]; Career.save();
    const to = this.parts(d.cal.min);
    let type = null;
    if (to.month !== from.month || to.year !== from.year) type = 'month';
    else if (to.day !== from.day) type = to.dow === 1 ? 'week' : 'day';
    if (type) {
      if (type === 'month') showAchv(CAL_MON[to.month], `A new month begins · Year ${to.year}`, 'Calendar');
      else toast(`${CAL_DOW[to.dow]} ${to.day} ${CAL_MON[to.month]}`, 1800);
      for (const fn of this.subs) { try { fn({ type, from, to }); } catch (e) { console.error(e); } }
    }
    renderCareerChip();
  },
};

/* ---------- Achievements ---------- */
const ACHV_LIST = [
  ['first', 'First blood', 'Win your first pot'], ['flush', 'Flush rush', 'Win with a flush'], ['fullhouse', 'Full house', 'Win with a full house'],
  ['quads', 'Four of a kind', 'Win with quads'], ['sflush', 'Straight flush', 'Win with a straight flush'], ['royal', 'Royal flush', 'Win with a royal flush'],
  ['champ', 'Champion', 'Win a Sit & Go'], ['bounty3', 'Bounty hunter', 'Knock out 3 players in one bounty Sit & Go'],
  ['hothead', 'Instigator', 'Make 10 opponents fume'], ['peace', 'Peacemaker', 'Cool an angry player down with a drink'],
  ['bribe', 'Greased palm', 'Get the dealer to take a bribe'], ['bribe5', 'On the payroll', 'Get 5 bribes accepted'],
  ['slowroll', 'Slow-roller', 'Win after slow-rolling'], ['showboat', 'Showboat', 'Celebrate 5 wins'], ['mono', 'Colour blind', 'Win a same-colour side bet'],
  ['jackpot', 'Jackpot!', 'Collect a bad-beat jackpot share'], ['nemesis', 'Nemesis', 'Push a rival to a full grudge'], ['tiltwin', 'Fuelled by rage', 'Win a pot while fuming'],
  ['hands100', 'Grinder', 'Play 100 hands'], ['hands1000', 'Regular', 'Play 1,000 hands'],
  ['vegas', 'Viva Las Vegas', 'Unlock The Golden Strip'], ['macau', "Dragon's luck", 'Unlock Dragon Pearl'], ['monaco', 'High roller', 'Unlock Riviera Grand'],
  ['bank100k', 'Six figures', 'Reach a $100,000 bankroll'],
];
const ACHV_BY = Object.fromEntries(ACHV_LIST.map(([id, n, desc]) => [id, { n, desc }]));
const achvEl = document.createElement('div'); achvEl.className = 'achv'; document.getElementById('app').appendChild(achvEl);
const achvQueue = [];
function showAchv(title, sub, kind = 'Achievement unlocked') {
  achvQueue.push([title, sub, kind]); if (achvQueue.length === 1) nextAchv();
}
function nextAchv() {
  const a = achvQueue[0]; if (!a) return;
  achvEl.innerHTML = `<i class="trophy" aria-hidden="true"></i><div><span>${a[2]}</span><b>${escH(a[0])}</b><em>${escH(a[1])}</em></div>`;
  achvEl.classList.remove('show'); void achvEl.offsetWidth; achvEl.classList.add('show'); Sound.bigWin && Sound.win();
  setTimeout(() => { achvEl.classList.remove('show'); setTimeout(() => { achvQueue.shift(); nextAchv(); }, 450); }, 3200);
}
const Achv = {
  unlock(id) {
    if (S.test) return; const d = Career.load(); if (d.ach[id] || !ACHV_BY[id]) return;
    d.ach[id] = Date.now(); Career.save(); showAchv(ACHV_BY[id].n, ACHV_BY[id].desc); Career.addXP(50);
  },
  count(k, n = 1) { const c = Career.load().counters; c[k] = (c[k] || 0) + n; Career.save(); return c[k]; },
  ev(name, e = {}) {
    if (S.test) return;
    switch (name) {
      case 'winPot': {
        this.unlock('first'); Career.addXP(3);
        const cat = e.cat == null ? -1 : e.cat;
        if (cat === 5) this.unlock('flush'); if (cat === 6) this.unlock('fullhouse'); if (cat === 7) this.unlock('quads');
        if (cat === 8) this.unlock(e.royal ? 'royal' : 'sflush');
        if (e.angry) this.unlock('tiltwin');
        break;
      }
      case 'hand': { const n = this.count('hands'); Career.addXP(1); if (n >= 100) this.unlock('hands100'); if (n >= 1000) this.unlock('hands1000'); break; }
      case 'anger': if (this.count('angered') >= 10) this.unlock('hothead'); break;
      case 'tipOk': this.unlock('bribe'); if (this.count('bribes') >= 5) this.unlock('bribe5'); break;
      case 'sendDrink': if (e.calmed) this.unlock('peace'); break;
      case 'celebrate': if (this.count('celebrations') >= 5) this.unlock('showboat'); break;
      case 'slowroll': this.unlock('slowroll'); break;
      case 'sideWin': if (e.mono) this.unlock('mono'); break;
      case 'jackpot': this.unlock('jackpot'); break;
      case 'grudge': if (e.g >= 5) this.unlock('nemesis'); break;
      case 'sngPlace': if (e.place === 1) this.unlock('champ'); Career.addXP(e.place === 1 ? 60 : e.place === 2 ? 25 : 5); break;
      case 'ko': if (S.ko && (S.koCount || 0) >= 3) this.unlock('bounty3'); break;
    }
    Daily.ev(name, e);
  },
};

/* ---------- Daily challenges: three a day, the same for everyone on that date ---------- */
const CHALLENGES = [
  { id: 'win5', text: 'Win 5 pots', goal: 5, ev: 'winPot', reward: 150 },
  { id: 'flush', text: 'Win a pot with a flush or better', goal: 1, ev: 'winPot', test: e => e.cat >= 5, reward: 250 },
  { id: 'big', text: 'Win a pot of 40 big blinds or more', goal: 1, ev: 'winPot', test: e => e.bb >= 40, reward: 250 },
  { id: 'steal', text: 'Win 3 pots without a showdown', goal: 3, ev: 'winPot', test: e => e.uncontested, reward: 150 },
  { id: 'ko2', text: 'Knock out 2 players', goal: 2, ev: 'ko', reward: 300 },
  { id: 'fume2', text: 'Make 2 opponents fume', goal: 2, ev: 'anger', reward: 200 },
  { id: 'tip', text: 'Get the dealer to take your bribe', goal: 1, ev: 'tipOk', reward: 200 },
  { id: 'drink', text: 'Send a drink to an opponent', goal: 1, ev: 'sendDrink', reward: 100 },
  { id: 'side', text: 'Win a flop colour side bet', goal: 1, ev: 'sideWin', reward: 150 },
  { id: 'itm', text: 'Finish in the money in a Sit & Go', goal: 1, ev: 'sngPlace', test: e => e.place <= 2, reward: 350 },
  { id: 'hands30', text: 'Play 30 hands', goal: 30, ev: 'hand', reward: 150 },
  { id: 'cool', text: 'Cool down an angry player with a drink', goal: 1, ev: 'sendDrink', test: e => e.calmed, reward: 250 },
];
const Daily = {
  list() {
    const d = Career.load(), day = Career.today();
    if (!d.daily || d.daily.day !== day) {
      let seed = 0; for (const ch of day) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      const pool = CHALLENGES.map(c => c.id), pickN = [];
      while (pickN.length < 3) { seed = (seed * 1103515245 + 12345) >>> 0; const k = seed % pool.length; pickN.push(pool.splice(k, 1)[0]); }
      d.daily = { day, list: pickN.map(id => ({ id, n: 0, done: false })) }; Career.save();
    }
    return d.daily.list;
  },
  ev(name, e) {
    for (const it of this.list()) {
      const c = CHALLENGES.find(x => x.id === it.id); if (!c || it.done || c.ev !== name || (c.test && !c.test(e))) continue;
      it.n++;
      if (it.n >= c.goal) { it.done = true; Career.save(); showAchv(c.text, `+${money(c.reward)} to your bankroll`, 'Challenge complete'); Career.add(c.reward); Career.addXP(c.reward / 10); }
      else Career.save();
    }
  },
};

/* ---------- Starting and finishing career games ---------- */
function roomById(id) { return ROOMS.find(r => r.id === id) || ROOMS[0]; }
function careerCost(r, kind) { return kind === 'cash' ? r.cash : kind === 'sng' ? r.sng : r.ko[0] + r.ko[1]; }
function startCareerGame(roomId, kind) {
  const r = roomById(roomId), cost = careerCost(r, kind);
  if (Jail.data()) { toast('You are in jail', 2000); return false; }
  if (!Career.spend(cost)) { toast('Not enough in your bankroll', 2000); return false; }
  Achv.count('cbuyin', cost);
  S.career = { room: r.id, kind, buyin: kind === 'cash' ? r.cash : kind === 'sng' ? r.sng : r.ko[0], bounty: kind === 'ko' ? r.ko[1] : 0 };
  BUYIN = S.career.buyin; const d = Career.load(); d.visited[r.id] = true; Career.save();
  applyTheme(r);
  ['lobby', 'startScreen', 'endScreen'].forEach(closeOverlay); unlockAudio(); autoCashOutSaved(); clearSave();
  newGame(kind === 'cash' ? 'cash' : 'sng', r.level, null, 'turbo', { ko: S.career.bounty });
  return true;
}
const careerRate = () => S.career && S.career.kind === 'cash' ? S.career.buyin / CASH_STACK : 0;
function careerCashOut() {
  const h = S.players[0]; if (!S.career || S.career.kind !== 'cash' || !h) return 0;
  const amt = Math.round(h.chips * careerRate());
  if (amt > 0) Career.add(amt, 'Cashed out');
  h.chips = 0; return amt;
}
function leaveToLobby() { clearSave(); showStart(); openLobby(); }

/* ---------- Bounties ---------- */
function settleBounties(busted) {
  if (!S.ko || S.mode !== 'sng') return;
  const lw = [...(S.lastWinners || [])].filter(q => !busted.includes(q));
  for (const p of busted) {
    const hunter = lw[0]; if (!hunter) continue;
    const amt = p.bounty || S.ko; p.bounty = 0;
    if (hunter.isHero) {
      S.koCount = (S.koCount || 0) + 1; S.koWon = (S.koWon || 0) + amt;
      if (S.career) Career.add(amt, `Bounty on ${p.name}`); else toast(`+$${fmt(amt)} bounty on ${p.name}`, 2400);
      if (!S.test) { FX.burst(G.W / 2, G.H * 0.55, 50, 1); Sound.win(); }
      Achv.ev('ko', { amt });
    } else hunter.koWon = (hunter.koWon || 0) + amt;
  }
  renderBounties();
}
function renderBounties() {
  for (let i = 0; i < NS; i++) {
    const p = S.players[i], el = seatEls[i] && seatEls[i].querySelector('.bty'); if (!el) continue;
    const on = !!(S.ko && S.mode === 'sng' && p && !p.out && p.bounty);
    el.hidden = !on; if (on) el.textContent = `$${fmt(p.bounty)}`;
  }
}

/* ---------- Lobby ---------- */
const careerChip = document.createElement('div'); careerChip.className = 'careerchip'; careerChip.hidden = true; overlayEl.appendChild(careerChip);
function renderCareerChip() {
  const on = !!S.career && S.started; careerChip.hidden = !on;
  if (on) {
    const r = roomById(S.career.room), l = Career.load().bank && Career.load().bank.loan;
    careerChip.innerHTML = `<b>${Cal.short()}</b> · ${escH(r.place)} · ${money(Career.load().bankroll)}${l && l.due > 0 ? ` · <span class="due">Bank due ${money(Math.ceil(l.due))}</span>` : ''}`;
  }
}
let lobTab = 'rooms';
function openLobby() {
  Career.load(); Career.checkUnlocks(); renderLobby(); openOverlay('lobby');
}
function renderLobby() {
  const d = Career.load(), lvl = Career.level(), lo = Career.xpAt(lvl), hi = Career.xpAt(lvl + 1);
  $('#lobBank').textContent = money(d.bankroll); $('#lobLvl').textContent = lvl; $('#lobDate').textContent = Cal.long();
  $('#lobXp').style.width = `${clamp((d.xp - lo) / (hi - lo), 0, 1) * 100}%`;
  const db = $('#lobDaily'), claimed = d.bonusDay === Career.today(), b = Career.dailyBonus();
  db.disabled = claimed; db.textContent = claimed ? 'Daily chips claimed · come back tomorrow' : `Claim daily chips · ${money(b.amt)}${b.streak > 1 ? ` · day ${b.streak} streak` : ''}`;
  const bail = $('#lobBail'); bail.hidden = !(d.bankroll < 50 && Date.now() - d.lastBail > 2 * 3600e3);
  document.querySelectorAll('#lobTabs button').forEach(bt => bt.classList.toggle('on', bt.dataset.tab === lobTab));
  document.querySelectorAll('#lobby .pane').forEach(pn => pn.hidden = pn.dataset.pane !== lobTab);
  // bank
  const bt = document.querySelector('#lobTabs button[data-tab=bank]'), dueNow = Bank.data().loan && Bank.data().loan.due > 0;
  bt.classList.toggle('alert', !!dueNow);
  if (lobTab === 'bank') Bank.render($('#lobBankPane'));
  // rooms
  const rooms = $('#lobRooms'); rooms.innerHTML = '';
  if (Jail.data()) Jail.render(rooms); // locked up: no rooms, no casino
  else for (const r of ROOMS) {
    const open = !!d.rooms[r.id], card = document.createElement('div'); card.className = 'room' + (open ? '' : ' locked'); card.style.setProperty('--acc', r.accent);
    card.style.setProperty('--felt', r.felt[1]);
    card.innerHTML = `<div class="rh"><i class="sw"></i><div><b>${r.name}</b><span>${r.place} · ${r.level === 'sharp' ? 'Sharp players' : 'Relaxed players'}</span></div></div>`;
    if (!open) { const p = document.createElement('p'); p.className = 'lockmsg'; p.textContent = `Unlocks when your bankroll reaches ${money(r.need)}`; card.appendChild(p); }
    else {
      const row = document.createElement('div'); row.className = 'games';
      for (const [kind, label] of [['cash', 'Cash game'], ['sng', 'Sit & Go'], ['ko', 'Bounty']]) {
        const cost = careerCost(r, kind), bt = document.createElement('button');
        bt.innerHTML = `${label}<small>${kind === 'ko' ? `${money(r.ko[0])} + ${money(r.ko[1])}` : money(cost)}</small>`;
        bt.disabled = d.bankroll < cost; bt.addEventListener('click', () => startCareerGame(r.id, kind));
        row.appendChild(bt);
      }
      card.appendChild(row);
      if (typeof casinoButtons === 'function') casinoButtons(card, r);
    }
    rooms.appendChild(card);
  }
  // challenges
  const dl = $('#lobDailyList'); dl.innerHTML = '<p class="talk-note" style="margin-top:0">Three new challenges every day. Rewards go straight to your bankroll.</p>';
  for (const it of Daily.list()) {
    const c = CHALLENGES.find(x => x.id === it.id); if (!c) continue;
    const row = document.createElement('div'); row.className = 'chal' + (it.done ? ' done' : '');
    row.innerHTML = `<div><b>${c.text}</b><i class="bar"><i style="width:${Math.min(1, it.n / c.goal) * 100}%"></i></i></div><span>${it.done ? 'Done' : `${Math.min(it.n, c.goal)}/${c.goal}`}<em>${money(c.reward)}</em></span>`;
    dl.appendChild(row);
  }
  // trophies
  const tl = $('#lobTrophies'), got = ACHV_LIST.filter(([id]) => d.ach[id]).length;
  tl.innerHTML = `<p class="talk-note" style="margin-top:0">${got} of ${ACHV_LIST.length} unlocked</p>`;
  const grid = document.createElement('div'); grid.className = 'trophies';
  for (const [id, n, desc] of ACHV_LIST) { const t = document.createElement('div'); t.className = 'tro' + (d.ach[id] ? ' got' : ''); t.innerHTML = `<i class="trophy"></i><b>${n}</b><span>${desc}</span>`; grid.appendChild(t); }
  tl.appendChild(grid);
}
document.querySelectorAll('#lobTabs button').forEach(b => b.addEventListener('click', () => { lobTab = b.dataset.tab; Sound.tick(); renderLobby(); }));
$('#lobDaily').addEventListener('click', () => { Career.claimDaily(); renderLobby(); });
$('#lobBail').addEventListener('click', () => { const d = Career.load(); d.lastBail = Date.now(); Career.save(); Career.add(200, 'From the house'); renderLobby(); });
$('#btnCareer').addEventListener('click', () => { unlockAudio(); openLobby(); });
function renderStartCareer() { const d = Career.load(); $('#btnCareer').innerHTML = `Career mode<small>${d.jail ? 'In jail · ' : ''}${money(d.bankroll)} bankroll · Level ${Career.level()}</small>`; }

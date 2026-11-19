'use strict';
/* Velvet Hold'em: 18-overlays.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Overlays
   ========================================================= */
function openOverlay(id) { const o = $('#' + id); o.hidden = false; const f = o.querySelector('button'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 50); }
function closeOverlay(id) { $('#' + id).hidden = true; }
document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o && o.id !== 'startScreen' && o.id !== 'endScreen') o.hidden = true; });
  o.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => o.hidden = true));
});
function statBoxes(list) { return list.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join(''); }
function sessionStats() {
  const s = S.stats;
  return [[fmt(s.hands), 'Hands'], [s.hands ? Math.round(s.won / s.hands * 100) + '%' : '—', 'Won'], [s.biggest ? fmt(s.biggest) : '—', 'Best pot']];
}
function payoutBoxes() { return `<div class="payouts" style="grid-template-columns:repeat(2,1fr)">${PRIZES.map((_, j) => j + 1).map(k => `<div class="stat"><b>$${prizeFor(k)}</b><span>${ordinal(k)} place</span></div>`).join('')}</div>`; }
function showEnd(kind) {
  const hero = S.players[0];
  Clock.stop();
  const place = kind === 'champ' ? 1 : hero.place;
  Achv.ev('sngPlace', { place });
  if (S.career && prizeFor(place)) Career.add(prizeFor(place), place === 1 ? 'Tournament win' : 'Prize money');
  $('#endKicker').textContent = S.mode === 'sng' ? `${S.career ? roomById(S.career.room).place + ' · ' : ''}${S.ko ? 'Bounty ' : ''}Sit & Go · $${fmt(BUYIN)} buy-in · ${S.level === 'sharp' ? 'Sharp' : 'Relaxed'}` : 'Cash game';
  const prize = $('#endPrize');
  if (kind === 'champ') {
    $('#endTitle').textContent = 'Champion';
    $('#endText').textContent = `You took every chip at the table in ${S.handNo} hands.`;
    prize.hidden = false; prize.textContent = `You won $${prizeFor(1)}`;
    FX.confetti(200); Sound.bigWin(); dealerSay('champHero', 'Congratulations. You win the tournament!', true);
  } else {
    $('#endTitle').textContent = `${ordinal(hero.place)} place`;
    const pz = prizeFor(hero.place);
    $('#endText').textContent = hero.place === 2 ? 'So close. You made it heads-up before going out.' : pz ? `You finished in the money on hand ${S.handNo}.` : `You went out on hand ${S.handNo}, one step ${hero.place === 3 ? 'from the money' : 'short of the payouts'}.`;
    prize.hidden = !pz; prize.textContent = pz ? `You won $${pz}` : '';
    if (pz) Sound.win(); else Sound.lose();
  }
  if (S.ko && S.koWon) $('#endText').textContent += ` Bounties collected: $${fmt(S.koWon)}.`;
  $('#endStats').innerHTML = statBoxes(sessionStats());
  const ep = $('#endPrimary'); ep.disabled = false;
  if (S.career) {
    const r = roomById(S.career.room), cost = careerCost(r, S.career.kind);
    ep.textContent = `Play again · ${money(cost)}`; ep.disabled = Career.load().bankroll < cost; $('#endSecondary').textContent = 'Back to lobby';
    ep.onclick = () => { closeOverlay('endScreen'); startCareerGame(r.id, S.career.kind); };
    $('#endSecondary').onclick = () => { closeOverlay('endScreen'); leaveToLobby(); };
  } else {
    ep.textContent = 'Play again'; $('#endSecondary').textContent = 'Back to lobby';
    ep.onclick = () => { closeOverlay('endScreen'); clearSave(); newGame(S.mode, S.level, null, S.structure); };
    $('#endSecondary').onclick = () => { closeOverlay('endScreen'); clearSave(); showStart(); };
  }
  openOverlay('endScreen');
}
function askRebuy() {
  return new Promise(res => {
    $('#endKicker').textContent = 'Cash game';
    $('#endTitle').textContent = 'Out of chips';
    const car = S.career, bank = car ? Career.load().bankroll : 0;
    $('#endText').textContent = car ? `Rebuy for ${money(car.buyin)} from your bankroll (${money(bank)}) to keep playing.` : `You have bought in for ${fmt(S.heroBuyin)} this session. Rebuy for ${fmt(CASH_STACK)} to keep playing.`;
    $('#endPrize').hidden = true;
    $('#endStats').innerHTML = statBoxes(sessionStats());
    const ep = $('#endPrimary'); ep.disabled = !!car && bank < car.buyin;
    ep.textContent = car ? `Rebuy · ${money(car.buyin)}` : `Rebuy ${fmt(CASH_STACK)}`; $('#endSecondary').textContent = 'Leave table';
    ep.onclick = () => { if (car && !Career.spend(car.buyin)) return; closeOverlay('endScreen'); res('rebuy'); };
    $('#endSecondary').onclick = () => { closeOverlay('endScreen'); if (car) leaveToLobby(); else { clearSave(); showStart(); } res('leave'); };
    openOverlay('endScreen');
  });
}
const esc1 = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
function openPlayer(i) {
  const p = S.players[i]; if (!p || !S.started) return;
  const [a1, a2] = AV_COLORS[p.colorIdx % AV_COLORS.length];
  const m = $('#popMono'); m.style.setProperty('--a1', a1); m.style.setProperty('--a2', a2);
  m.innerHTML = p.isHero ? '' : avatarSVG(p); m.style.display = p.isHero ? 'none' : '';
  $('#popName').textContent = p.isHero ? 'You' : p.name;
  $('#popStyle').textContent = p.isHero ? 'Your numbers' : P(p).label;
  $('#popDesc').textContent = p.isHero ? 'The opponents track these too, and adjust to how you play.' : P(p).desc;
  const readEl = $('#popRead');
  if (p.isHero) {
    const r = heroRead();
    readEl.className = 'read'; readEl.innerHTML = `<b>How they see you</b>${r.conf < 0.4 ? 'Still figuring you out.' : `${r.vpip > 0.4 ? 'Loose' : r.vpip < 0.2 ? 'Tight' : 'Solid'} and ${r.af > 2 ? 'aggressive' : r.af < 0.7 ? 'passive' : 'balanced'}. ${r.ftb > 0.55 ? 'You fold to bets often, so expect more bluffs.' : r.ftb < 0.3 ? 'You rarely fold to bets, so expect fewer bluffs.' : ''}`}`;
  } else if (p.st.hands >= 12) { readEl.className = 'read'; readEl.innerHTML = `<b>Your read</b>${P(p).read}`; }
  else { readEl.className = 'read locked'; readEl.innerHTML = `<b>Your read</b>Watch how they act. A read unlocks after ${12 - p.st.hands} more hands together.`; }
  const rvEl = $('#popRival');
  if (p.isHero) rvEl.hidden = true;
  else {
    const r = Rivals.rec(p.persona), g = r.grudge || 0; rvEl.hidden = false;
    rvEl.innerHTML = `<b>Your history</b>Showdowns: you won ${r.w || 0}, ${esc1(p.name)} won ${r.l || 0}. You knocked them out ${r.busts || 0}×, they knocked you out ${r.bustedBy || 0}×.<span class="grudge">${'<i class="on"></i>'.repeat(g)}${'<i></i>'.repeat(5 - g)}<em>${grudgeWords(g)}</em></span>`;
  }
  const h = p.st.hands;
  $('#popStats').innerHTML = statBoxes([[p.out ? 'Out' : fmt(p.chips), 'Stack'], [h ? Math.round(p.st.vpip / h * 100) + '%' : '—', 'Plays'], [h ? Math.round(p.st.pfr / h * 100) + '%' : '—', 'Raises']]);
  openOverlay('playerPop');
}
function renderHistory() {
  const list = $('#historyList');
  if (!S.history.length) { list.innerHTML = '<p class="empty-note">Finished hands will appear here.</p>'; return; }
  list.innerHTML = S.history.map(h => `<div class="hh"><header>Hand #${h.no}<span>Blinds ${h.blinds}</span></header>${h.lines.map(l => `<p class="${l.cls || ''}">${l.html}</p>`).join('')}</div>`).join('');
}
function renderTourneyBox() {
  const box = $('#tourneyBox');
  if (S.mode !== 'sng' || !S.started) { box.innerHTML = ''; return; }
  const nxt = SNG_LEVELS[S.blindIdx + 1];
  box.innerHTML = `<h3 style="margin-top:0">Sit &amp; Go · $${BUYIN} buy-in · prize pool $${BUYIN * NS}</h3>${payoutBoxes()}
    <p class="keys" style="margin-top:8px">Level ${S.blindIdx + 1} of ${SNG_LEVELS.length}. ${nxt ? `Next: ${fmt(nxt[0])}/${fmt(nxt[1])}${nxt[2] ? ' with ' + fmt(nxt[2]) + ' ante' : ''}, in ${fmtClock(Math.max(0, Clock.left))}.` : 'Final level.'}</p>`;
}
function showStart() {
  S.started = false; RUN++; Clock.stop(); Voice.stop();
  if (S.heroReject) { const rj = S.heroReject; S.heroResolve = S.heroReject = null; try { rj(ABORT); } catch (e) {} }
  preview();
  const saved = loadSave();
  const cb = $('#btnContinue');
  if (saved && saved.players) {
    const hero = saved.players[0];
    cb.hidden = false; cb.textContent = `Continue · Hand ${saved.handNo} · ${fmt(hero.chips)} chips`;
    cb.onclick = () => { unlockAudio(); closeOverlay('startScreen'); newGame(saved.mode, saved.level, saved); };
  } else cb.hidden = true;
  renderTop(); renderStartCareer(); renderCareerChip();
  openOverlay('startScreen');
}

let pickMode = 'sng', pickLevel = 'relaxed', pickStruct = 'turbo';
function segBind(id, cb) {
  const seg = $('#' + id);
  seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    Sound.tick(); cb(b.dataset.v);
  }));
}
function segSet(id, v) { $('#' + id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === v ? 'true' : 'false')); }
const MODE_DESC = {
  sng: `$${BUYIN} buy-in, ${fmt(SNG_STACK)} chips each. Blinds rise on a clock, antes from level 4. Top 2 paid: $${prizeFor(1)} and $${prizeFor(2)}.`,
  cash: `Blinds stay at 10/20 with a ${fmt(CASH_STACK)} buy-in. Rebuy whenever you run out. New players fill empty seats.`,
  ko: `Sit & Go with a $8 bounty on every player. Knock someone out and their bounty is yours on the spot.`
};
segBind('segMode', v => { pickMode = v; $('#modeDesc').textContent = MODE_DESC[v]; $('#structWrap').hidden = v === 'cash'; });
segBind('segLevel', v => { pickLevel = v; });
segBind('segStruct', v => { pickStruct = v; });
$('#modeDesc').textContent = MODE_DESC.sng;
function unlockAudio() { Sound.init(); syncAudio(); Voice.unlock(); VO.preload(); }
$('#btnStart').addEventListener('click', () => { unlockAudio(); closeOverlay('startScreen'); autoCashOutSaved(); clearSave(); S.career = null; BUYIN = 20; applyTheme(null); newGame(pickMode === 'ko' ? 'sng' : pickMode, pickLevel, null, pickStruct, { ko: pickMode === 'ko' ? 8 : 0 }); });

function setSwitch(id, v) { $('#' + id).setAttribute('aria-checked', v ? 'true' : 'false'); }
function syncSettingsUI() {
  setSwitch('swSound', settings.sound); setSwitch('swMusic', settings.music); setSwitch('swAmb', settings.amb); setSwitch('swOdds', settings.odds);
  setSwitch('swVoice', settings.voice); setSwitch('swChat', settings.chat); setSwitch('swDeck4', settings.deck4);
  segSet('segCards', settings.cardStyle); segSet('segSpeed', settings.speed); segSet('segView', settings.view); segSet('segQuality', settings.quality);
  $('#btnSound').classList.toggle('off', !settings.sound);
  $('#btnSound').setAttribute('aria-label', settings.sound ? 'Mute sound' : 'Turn sound on');
  $('#btnSound .w').style.display = settings.sound ? '' : 'none';
  const anyVoice = Voice.supported || VO.has('dealer'); $('#swVoice').disabled = !anyVoice; if (!anyVoice) setSwitch('swVoice', false);
}
function syncAudio() { Sound.on = settings.sound; Sound.setAmbience(settings.sound && settings.amb); Music.set(settings.sound && settings.music); if (!settings.sound) Voice.stop(); }
function toggleSetting(key, after) { settings[key] = !settings[key]; syncSettingsUI(); saveSettings(); if (after) after(); }
$('#swSound').addEventListener('click', () => toggleSetting('sound', () => { Sound.init(); syncAudio(); Sound.tick(); }));
$('#swAmb').addEventListener('click', () => toggleSetting('amb', () => { Sound.init(); syncAudio(); }));
$('#swMusic').addEventListener('click', () => toggleSetting('music', () => { Sound.init(); syncAudio(); }));
$('#swOdds').addEventListener('click', () => toggleSetting('odds', renderInfo));
$('#swVoice').addEventListener('click', () => toggleSetting('voice', () => { Voice.unlock(); VO.preload(); if (settings.voice) dealerSay('voiceOn', 'Dealer voice is on.', true); else Voice.stop(); }));
$('#swChat').addEventListener('click', () => toggleSetting('chat', () => { if (!settings.chat) clearBubbles(); }));
$('#swDeck4').addEventListener('click', () => toggleSetting('deck4', () => Cards.refresh()));
segBind('segCards', v => { settings.cardStyle = v; saveSettings(); Cards.refresh(); });
segBind('segSpeed', v => { settings.speed = v; applySpeedVar(); saveSettings(); });
segBind('segView', v => setView(v));
segBind('segQuality', v => { settings.quality = v; saveSettings(); applyQuality(); });
$('#btnSound').addEventListener('click', () => toggleSetting('sound', () => { Sound.init(); syncAudio(); Sound.tick(); }));
$('#btnMenu').addEventListener('click', () => { $('#statsBox').innerHTML = statBoxes(sessionStats()); renderTourneyBox(); openOverlay('menuScreen'); });
$('#btnHistory').addEventListener('click', () => { closeOverlay('menuScreen'); renderHistory(); openOverlay('historyScreen'); });
$('#btnNewGame').addEventListener('click', () => { closeOverlay('menuScreen'); if (Casino.active) { Casino.exit(); return; } if (S.career) { if (S.career.kind === 'cash') careerCashOut(); leaveToLobby(); } else { clearSave(); showStart(); } });
function syncLeaveLabel() { const b = $('#btnNewGame'); b.textContent = Casino.active ? 'Leave table' : !S.career ? 'Leave table and start over' : S.career.kind === 'cash' ? 'Cash out and leave' : 'Leave tournament (forfeits buy-in)'; }
function autoCashOutSaved() { const sv = loadSave(); if (sv && sv.career && sv.career.kind === 'cash' && sv.players && sv.players[0]) { const amt = Math.round(sv.players[0].chips * sv.career.buyin / CASH_STACK); if (amt > 0) Career.add(amt, 'Cashed out'); } }
$('#btnView').addEventListener('click', () => { Sound.tick(); setView(settings.view === 'seated' ? 'overhead' : 'seated'); });
$('#btnChat').addEventListener('click', () => { if (S.started) { setTalkTab(talkTab); renderTalk(); openOverlay('chatScreen'); } });
$('#chatGrid').innerHTML = HERO_PHRASES.map(([k, t]) => `<button data-k="${k}">${t}</button>`).join('');
$('#chatGrid').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { closeOverlay('chatScreen'); heroSay(b.dataset.k, b.textContent); }));
function setView(v) {
  settings.view = v; saveSettings(); segSet('segView', v);
  const a = CAM.blend, b = v === 'overhead' ? 1 : 0;
  bg(animate(800, e => { CAM.blend = lerp(a, b, e); fitCamera(); }, easeInOut));
  if (S.test || !G.ok) { CAM.blend = b; fitCamera(); }
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && !['Enter', 'Escape'].includes(e.key)) return;
  if (document.querySelector('.overlay:not([hidden])')) { if (e.key === 'Escape') document.querySelectorAll('.overlay:not([hidden])').forEach(o => { if (o.id !== 'startScreen' && o.id !== 'endScreen') o.hidden = true; }); return; }
  const k = e.key.toLowerCase();
  if (k === 'v' && S.started) { setView(settings.view === 'seated' ? 'overhead' : 'seated'); return; }
  if (S.heroResolve) {
    if (k === 'f' && !btnFold.disabled && !S.raising) btnFold.click();
    else if (k === 'c' || k === ' ') { e.preventDefault(); btnCall.click(); }
    else if (k === 'r' && !btnRaise.disabled) btnRaise.click();
    else if (k === 'enter' && S.raising) btnRaise.click();
    else if (k === 'escape' && S.raising) btnFold.click();
    else if (k === 'arrowup' || k === 'arrowright') { e.preventDefault(); nudgeRaise(1); }
    else if (k === 'arrowdown' || k === 'arrowleft') { e.preventDefault(); nudgeRaise(-1); }
  }
});

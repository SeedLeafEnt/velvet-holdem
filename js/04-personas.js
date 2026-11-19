'use strict';
/* Velvet Hold'em: 04-personas.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Players, personas, tells and table talk
   ========================================================= */
const PERSONAS = {
  rock:    { label: 'The Rock',        desc: 'Waits for big hands and almost never bluffs.',  tight: .80, aggr: .35, bluff: .03, sticky: false, trap: .10, adapt: .5,
             read: 'Folds fast when weak. Slows down and sits very still when holding a big hand.' },
  shark:   { label: 'Shark',           female: true, desc: 'Tight and aggressive. Bets hard when ahead.',   tight: .62, aggr: .80, bluff: .12, sticky: false, trap: .10, adapt: 1,
             read: 'Same timing and the same stare whatever they hold. Very hard to read.' },
  maniac:  { label: 'Maniac',          desc: 'Raises constantly and bluffs often.',           tight: .18, aggr: .92, bluff: .30, sticky: false, trap: .02, adapt: .4,
             read: 'Loud and fast when bluffing. Goes quiet and slow when they really have it.' },
  station: { label: 'Calling Station', female: true, desc: 'Calls far too often and seldom raises.',        tight: .30, aggr: .20, bluff: .04, sticky: true,  trap: .05, adapt: .15,
             read: 'Chatty and hesitant with a strong hand. Sighs and calls quickly when weak.' },
  pro:     { label: 'Pro',             desc: 'Balanced and patient. Likes to set traps.',     tight: .52, aggr: .62, bluff: .15, sticky: false, trap: .30, adapt: 1,
             read: 'Mixes up timing on purpose. A long think tells you very little.' },
};
const NS = 5; // seats: you + 4 opponents (the dealer sits opposite you)
/* Every spoken line, in the exact order it was recorded for ElevenLabs. Tags in [brackets] direct the delivery. */
const SCRIPT = {"dealer":[["shuffle","[professional] Shuffle up and deal."],["heroTurn","[politely] Action is on you."],["allin","[firm] All in."],["heroAllin","[firm] You're all in."],["allinCall","[calm] All in, and a call. Cards up, please."],["winHero","[warmly] You win the pot."],["winHero","[warmly] Nice hand. The pot is yours."],["winOther","[professional] The pot goes to the winner."],["split","[professional] Split pot."],["hand0","[professional] High card wins."],["hand1","[professional] Pair wins."],["hand2","[professional] Two pair wins."],["hand3","[professional] Three of a kind wins."],["hand4","[professional] Straight wins."],["hand5","[professional] Flush wins."],["hand6","[professional] Full house wins."],["hand7","[surprised] Four of a kind!"],["hand8","[excited] Straight flush!"],["hand9","[excited] A royal flush!"],["blindsUp","[professional] Blinds are going up."],["antes","[professional] Antes are now in play."],["eliminated","[professional] A player has been eliminated."],["bubble","[professional] We're on the money bubble."],["itm","[pleased] Everyone left is in the money."],["headsUp","[professional] We're heads up."],["champHero","[excited] Congratulations! You win the tournament!"],["champOther","[professional] We have a champion."],["voiceOn","[politely] Dealer voice is on."]],"rock":[["greet","[gruff] Evening."],["greet","[gruff] Let's play some cards."],["raiseBig","[firm] Raise."],["allin","[calm] I'm all in."],["call","[flat] Call."],["fold","[flat] Fold."],["winSmall","[gruff] I'll take it."],["winBig","[satisfied] Patience pays."],["winBig","[chuckles] Waited all night for that one."],["lose","[sighs] Fair enough."],["badBeat","[frustrated sigh] Of course."],["badBeat","[muttering] That's poker, I suppose."],["suckout","[sheepish] Lucky card. Sorry, partner."],["missDraw","[grumbles] Missed."],["foldedWinner","[annoyed] Huh. I folded that."],["foldedWinner","[sighs] Should've stayed in."],["bust","[tired] Good game, everyone."],["idle","[gruff] Quiet table tonight."],["heroSlow","[patient] Take your time."],["niceHand","[warmly] Well played."],["r_goodLuck","[gruff] You too."],["r_niceHand","[gruff] Thank you kindly."],["r_unlucky","[sighs] Yep."],["r_wow","[chuckles] Somethin' else, huh?"],["r_thanks","[gruff] Mm-hm."],["r_gamble","[dry] We'll see."]],"shark":[["greet","[sarcastic] Good luck. You'll need it."],["greet","[confident] Shuffle up. Let's go."],["raiseBig","[confident] Price just went up."],["raiseBig","[coolly] Let's make this interesting."],["allin","[coolly] I'm all in. Your move."],["call","[flat] I'll see that."],["fold","[dismissive] Take it."],["winSmall","[dry] Thanks for the chips."],["winBig","[laughs softly] Pleasure doing business."],["winBig","[smug] That's how it's done."],["lose","[flatly] Nice hand. This time."],["badBeat","[irritated] You called with THAT?"],["badBeat","[cold] Enjoy it while it lasts."],["suckout","[smug] Sometimes the deck helps."],["missDraw","[annoyed] Missed. Fine."],["foldedWinner","[frustrated] I had you. I won't fold that again."],["bust","[icy] Well played. I'll be back."],["idle","[dry] Tight table. I like it."],["heroSlow","[impatient] Clock, please."],["heroSlow","[sarcastic] Tick tock."],["niceHand","[grudging] Not bad."],["r_goodLuck","[sarcastic] I don't need luck."],["r_niceHand","[dry] I know."],["r_unlucky","[coolly] Luck had nothing to do with it."],["r_wow","[dry] Pay attention."],["r_thanks","[flat] Sure."],["r_gamble","[mischievously] Careful what you wish for."]],"maniac":[["greet","[excited] Let's gamble!"],["greet","[laughs] Who's ready to lose some chips?"],["raiseBig","[shouting] Raise! Always raise!"],["raiseBig","[excited] Too cheap! Let's go bigger!"],["allin","[shouting] ALL IN, baby!"],["allin","[excited] Ship it!"],["call","[annoyed] Fine, I call."],["fold","[groans] Ugh. Fine."],["winSmall","[laughs] Mine!"],["winBig","[ecstatic] WHOO! Pay the man!"],["winBig","[laughing] Told you I had it!"],["lose","[frustrated] Unbelievable!"],["badBeat","[furious] ARE YOU SERIOUS?!"],["badBeat","[angry] That river should be illegal!"],["suckout","[laughs] Never in doubt!"],["missDraw","[frustrated] One card! I needed ONE card!"],["foldedWinner","[shouting] I FOLDED THAT?!"],["foldedWinner","[groans] Why do I ever fold?!"],["bust","[groans] Worth it. Totally worth it."],["idle","[bored] Somebody raise already."],["heroSlow","[impatient] Any day now!"],["niceHand","[grudgingly] Lucky."],["tellWeak","[taunting] You don't have anything!"],["tellWeak","[cocky] Just fold. I've got you."],["r_goodLuck","[laughs] Luck is for the weak!"],["r_niceHand","[cocky] Obviously!"],["r_unlucky","[frustrated] Tell me about it!"],["r_wow","[excited] WOW is right!"],["r_thanks","[laughs] You owe me!"],["r_gamble","[excited] NOW we're talking!"]],"station":[["greet","[cheerful] Hi everyone! Good luck!"],["raiseBig","[giggles] Ooh, I'll raise!"],["allin","[nervous laugh] Why not? All in!"],["call","[curious] I'll call. I just have to see it!"],["call","[happy] Call! I'm curious."],["fold","[sighs] Okay, okay, I fold."],["winSmall","[happy] Oh, nice!"],["winBig","[excited] No way! That's my biggest pot ever!"],["lose","[disappointed] Aww, so close!"],["badBeat","[upset] Oh no, not the river!"],["badBeat","[whiny] I had you! Didn't I?"],["suckout","[giggles] Sorry! I had to see one more card."],["missDraw","[sad] Aww, I needed just one more card!"],["foldedWinner","[gasps] Wait, I would have won that!"],["bust","[sad] Aww. That was fun. Good luck, everyone!"],["idle","[cheerful] Anyone else hungry?"],["idle","[curious] Wait, does a flush beat a straight?"],["heroSlow","[warmly] Take your time, friend!"],["niceHand","[warmly] Nice hand!"],["tellStrong","[hesitant] Hmm, what should I do?"],["tellStrong","[nervous] Ooh. Okay, okay."],["tellWeak","[sighs] Hmm."],["r_goodLuck","[warmly] Aww, you too!"],["r_niceHand","[giggles] Thanks! I got lucky!"],["r_unlucky","[sad] I know, right?"],["r_wow","[excited] So exciting!"],["r_thanks","[cheerful] Any time, friend!"],["r_gamble","[excited] Yes! Let's play!"]],"pro":[["greet","[warmly] Evening, all. Good luck."],["raiseBig","[calm] I'll put some pressure on."],["allin","[calm] I'm all in."],["call","[calm] Call."],["fold","[calm] Good bet. I fold."],["winSmall","[calm] Thanks."],["winBig","[pleased] Good hand, everyone."],["lose","[calm] Nice hand. Well played."],["badBeat","[sighs] Variance. It happens."],["badBeat","[resigned] That's the game."],["suckout","[apologetic] Lucky river. Sorry about that."],["missDraw","[calm] Didn't get there."],["foldedWinner","[wry laugh] Disciplined fold. Wrong result."],["bust","[warmly] Good game. Well played, all."],["idle","[curious] Interesting table tonight."],["heroSlow","[curious] Tough spot?"],["niceHand","[warmly] Nicely done."],["r_goodLuck","[warmly] Good luck to you."],["r_niceHand","[warmly] Thanks. You too."],["r_unlucky","[calm] That's poker."],["r_wow","[chuckles] Quite a hand."],["r_thanks","[warmly] Of course."],["r_gamble","[chuckles] Within reason."]]};
const stripTags = t => t.replace(/\[[^\]]*\]\s*/g, '').trim();
const LINES = {};
for (const [who, list] of Object.entries(SCRIPT)) { LINES[who] = {}; list.forEach(([cat, txt], idx) => { (LINES[who][cat] = LINES[who][cat] || []).push({ t: stripTags(txt), id: who + ':' + idx }); }); }
/* Silent tells, shown as actions */
const ACTS = { rock: { tellStrong: ['*sits very still*'], tellWeak: ['*glances at their chips*'] }, shark: { tellStrong: ['*stares you down*'], tellWeak: ['*stares you down*'] }, maniac: { tellStrong: ['*goes quiet*'] }, station: {}, pro: { tellStrong: ['*shrugs*'], tellWeak: ['*shrugs*'] } };
function linesFor(persona, cat) { return [...((LINES[persona] || {})[cat] || []), ...(((ACTS[persona] || {})[cat]) || []).map(t => ({ t, act: true }))]; }
const CAT_FACE = { greet: 'happy', raiseBig: 'smug', allin: 'focused', call: 'neutral', fold: 'annoyed', winSmall: 'happy', winBig: 'joy', lose: 'sad', badBeat: 'angry', suckout: 'happy', missDraw: 'annoyed', foldedWinner: 'annoyed', bust: 'sad', idle: 'neutral', heroSlow: 'annoyed', niceHand: 'happy', tellStrong: 'worried', tellWeak: 'smug', reply: 'happy' };
const FACE_OVR = { maniac: { badBeat: 'furious', foldedWinner: 'furious', missDraw: 'furious' }, station: { badBeat: 'sad', allin: 'worried', heroSlow: 'happy', fold: 'sad' }, rock: { heroSlow: 'neutral', winBig: 'happy' }, pro: { heroSlow: 'neutral', badBeat: 'sad', winBig: 'happy' }, shark: { winBig: 'smug', reply: 'smug', badBeat: 'angry' } };
const faceFor = (persona, cat) => (FACE_OVR[persona] && FACE_OVR[persona][cat]) || CAT_FACE[cat] || 'neutral';
/* ElevenLabs voice clips: one recording per character, cut into lines. Filled in once the recordings are added. */
const VOICE_DATA = window.VELVET_VOICES || {"dealer":{"src":"voice/dealer.mp3","seg":[[0.0,1.417],[1.497,2.671],[2.751,3.497],[3.577,4.521],[4.601,7.408],[7.488,8.75],[8.83,10.914],[10.994,12.49],[12.57,13.484],[13.564,14.827],[14.907,15.897],[15.977,17.154],[17.234,18.869],[18.949,20.114],[20.194,21.365],[21.445,22.864],[22.944,24.39],[24.47,25.842],[25.922,27.33],[27.41,28.537],[28.617,30.312],[30.392,32.129],[32.209,33.407],[33.487,35.249],[35.329,36.247],[36.327,39.053],[39.133,40.387],[40.467,41.711]],"gain":1},"rock":{"src":"voice/rock.mp3","seg":[[0.0,1.046],[1.126,2.62],[2.7,3.583],[3.663,4.773],[4.853,5.494],[5.574,6.351],[6.431,7.451],[7.531,8.868],[8.948,11.524],[11.604,13.408],[13.488,15.191],[15.271,17.158],[17.238,19.95],[20.03,21.555],[21.635,23.45],[23.53,25.499],[25.579,26.985],[27.065,28.541],[28.621,29.69],[29.77,30.817],[30.897,31.817],[31.897,33.107],[33.187,34.648],[34.728,36.615],[36.695,37.565],[37.645,38.567]],"gain":1},"shark":{"src":"voice/shark.mp3","seg":[[0.0,2.25],[2.33,3.991],[4.071,5.386],[5.466,7.386],[7.466,9.312],[9.392,10.272],[10.352,11.205],[11.285,12.551],[12.631,14.797],[14.877,16.448],[16.528,18.45],[18.53,20.147],[20.227,21.944],[22.024,23.955],[24.035,25.663],[25.743,28.356],[28.436,30.376],[30.456,32.383],[32.463,33.641],[33.721,34.874],[34.954,35.825],[35.905,37.415],[37.495,38.216],[38.296,40.329],[40.409,41.656],[41.736,42.256],[42.336,44.064]],"gain":1},"maniac":{"src":"voice/maniac.mp3","seg":[[0.0,1.306],[1.386,3.891],[3.971,6.151],[6.231,8.348],[8.428,9.738],[9.818,10.714],[10.794,12.549],[12.629,14.189],[14.269,15.711],[15.791,17.68],[17.76,19.586],[19.666,21.067],[21.147,22.704],[22.784,24.685],[24.765,26.588],[26.668,29.653],[29.733,31.209],[31.289,33.991],[34.071,37.016],[37.096,38.786],[38.866,40.124],[40.204,41.029],[41.109,42.404],[42.484,44.214],[44.294,46.348],[46.428,47.519],[47.599,48.978],[49.058,50.51],[50.59,52.198],[52.278,53.576]],"gain":1},"station":{"src":"voice/station.mp3","seg":[[0.0,1.962],[2.042,4.48],[4.56,6.932],[7.012,9.509],[9.589,11.25],[11.33,14.069],[14.149,15.326],[15.406,18.686],[18.766,20.828],[20.908,23.125],[23.205,25.255],[25.335,28.447],[28.527,31.403],[31.483,33.97],[34.05,37.274],[37.354,38.458],[38.538,41.108],[41.188,42.593],[42.673,43.629],[43.709,45.485],[45.565,47.475],[47.555,48.682],[48.762,50.233],[50.313,52.443],[52.523,53.77],[53.85,55.32],[55.4,56.52],[56.6,58.206]],"gain":1},"pro":{"src":"voice/pro.mp3","seg":[[0.0,1.949],[2.029,3.38],[3.46,4.358],[4.438,4.977],[5.057,6.873],[6.953,7.586],[7.666,9.061],[9.141,10.917],[10.997,13.676],[13.756,14.812],[14.892,17.125],[17.205,18.223],[18.303,21.43],[21.51,23.497],[23.577,25.023],[25.103,25.916],[25.996,27.149],[27.229,28.134],[28.214,29.513],[29.593,30.587],[30.667,32.255],[32.335,33.384],[33.464,35.021]],"gain":1}};
const VO = {
  bufs: {}, loading: {}, failed: {}, tries: {}, pending: {}, raw: {},
  prefetchOne(w) { const d = VOICE_DATA && VOICE_DATA[w]; if (!d || !d.src || this.raw[w]) return; this.raw[w] = fetch(d.src).then(r => { if (!r.ok) throw new Error('voice ' + r.status); return r.arrayBuffer(); }); this.raw[w].catch(() => {}); },
  prefetch() { if (!VOICE_DATA || S.test) return; for (const w of Object.keys(VOICE_DATA)) if (!this.bufs[w] && !this.loading[w]) this.prefetchOne(w); },
  has(who) { return !!(VOICE_DATA && VOICE_DATA[who]) && !this.failed[who]; },
  ready(who) { return !!this.bufs[who]; },
  ensure(who) {
    if (!this.has(who) || this.bufs[who] || this.loading[who] || !Sound.ctx) return;
    this.loading[who] = true;
    const d = VOICE_DATA[who], ctx = Sound.ctx;
    const decode = ab => new Promise((res, rej) => { try { const pr = ctx.decodeAudioData(ab, res, rej); if (pr && pr.then) pr.then(res, rej); } catch (e) { rej(e); } });
    let bytes;
    if (d.src) { if (!this.raw[who]) this.prefetchOne(who); bytes = this.raw[who] || Promise.reject(new Error('no voice')); this.raw[who] = null; }
    else bytes = Promise.resolve().then(() => { const bin = atob(d.b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8.buffer; });
    bytes.then(decode).then(b => {
      this.bufs[who] = b; this.loading[who] = false;
      const pd = this.pending[who]; this.pending[who] = null;
      if (pd && performance.now() - pd.at < 3000) this.play(pd.id, pd.gain);
    }).catch(() => { this.loading[who] = false; const n = (this.tries[who] || 0) + 1; this.tries[who] = n; if (n < 3) setTimeout(() => this.ensure(who), 2500 * n); else this.failed[who] = true; });
  },
  preload() { if (VOICE_DATA) ['dealer', ...Object.keys(VOICE_DATA).filter(w => w !== 'dealer')].forEach(w => this.ensure(w)); },
  play(id, gain = 1) {
    if (!id || !settings.sound || !settings.voice || !Sound.ctx || S.test) return 0;
    const [who, idx] = id.split(':'), d = VOICE_DATA && VOICE_DATA[who];
    if (!d || !this.has(who)) return 0;
    const seg = d.seg[+idx]; if (!seg) return 0;
    const buf = this.bufs[who];
    if (!buf) { this.ensure(who); if (!this.loading[who]) return 0; this.pending[who] = { id, gain, at: performance.now() }; return seg[1] - seg[0]; }
    try {
      if (Sound.ctx.state === 'suspended') Sound.ctx.resume();
      const src = Sound.ctx.createBufferSource(), g = Sound.ctx.createGain(); src.buffer = buf; g.gain.value = gain * (d.gain || 1);
      src.connect(g); g.connect(Sound.master); src.start(0, seg[0], seg[1] - seg[0]); Music.duck(seg[1] - seg[0]);
    } catch (e) { return 0; }
    return seg[1] - seg[0];
  }
};
const HERO_PHRASES = [['goodLuck', 'Good luck'], ['niceHand', 'Nice hand'], ['unlucky', 'Unlucky'], ['wow', 'Wow'], ['thanks', 'Thanks'], ['gamble', "Let's gamble"]];
const MALE_NAMES = ['Viktor', 'Diego', 'Kenji', 'Luca', 'Otto', 'Hassan', 'Rafael', 'Tomas', 'Bruno', 'Farid'];
const FEMALE_NAMES = ['Mei', 'Ruth', 'Amara', 'Priya', 'Sofia', 'Ingrid', 'Yuki', 'Nadia', 'Elena', 'Aisha'];
/* Rivalries: each character keeps the same name for you, and remembers your history together */
const RIVAL_KEY = 'velvet3d-rivals-v1';
const Rivals = {
  d: null,
  load() { if (this.d) return this.d; try { this.d = JSON.parse(localStorage.getItem(RIVAL_KEY) || 'null') || {}; } catch (e) { this.d = {}; } return this.d; },
  save() { try { localStorage.setItem(RIVAL_KEY, JSON.stringify(this.d)); } catch (e) {} },
  rec(persona) { const d = this.load(); return d[persona] || (d[persona] = { name: null, w: 0, l: 0, busts: 0, bustedBy: 0, grudge: 0 }); },
  grudge(persona) { const r = this.load()[persona]; return r ? r.grudge || 0 : 0; },
  bump(persona, k, n = 1) { if (S.test) return; const r = this.rec(persona); r[k] = (r[k] || 0) + n; if (k === 'grudge') { r.grudge = clamp(r.grudge, 0, 5); if (typeof Achv !== 'undefined') Achv.ev('grudge', { g: r.grudge }); } this.save(); },
};
function nameFor(persona, used) {
  const pool = PERSONAS[persona] && PERSONAS[persona].female ? FEMALE_NAMES : MALE_NAMES;
  const r = S.test ? null : Rivals.rec(persona);
  if (r && r.name && !used.has(r.name)) return r.name;
  const n = shuffled(pool).find(x => !used.has(x)) || pool[0];
  if (r && !r.name) { r.name = n; Rivals.save(); }
  return n;
}
const NAMES = ['Viktor', 'Mei', 'Diego', 'Ruth', 'Kenji', 'Amara', 'Luca', 'Priya', 'Otto', 'Sofia', 'Hassan', 'Ingrid', 'Rafael', 'Yuki', 'Nadia', 'Farid', 'Elena', 'Tomas', 'Aisha', 'Bruno'];
const AV_COLORS = [['#c8624a', '#5b1d14'], ['#4b86c8', '#13284d'], ['#9466cc', '#2b1748'], ['#3fae8a', '#0f3d30'], ['#cfa246', '#4d3510'], ['#c84a82', '#4a1230'], ['#6a9a3e', '#1f3511'], ['#4fa8bd', '#123a44'], ['#c27a3a', '#4a2510'], ['#7a86d0', '#1d2350']];
const SNG_LEVELS = [[10, 20, 0], [15, 30, 0], [25, 50, 0], [50, 100, 10], [75, 150, 15], [100, 200, 25], [150, 300, 25], [200, 400, 50], [300, 600, 75], [400, 800, 100], [600, 1200, 150], [1000, 2000, 200], [1500, 3000, 300], [2000, 4000, 500], [3000, 6000, 600]];
const HANDS_PER_LEVEL = 6; // used only by the automated test mode
const LEVEL_MS = { turbo: 180000, regular: 360000 };
const SNG_STACK = 1500, CASH_STACK = 2000, PRIZES = [0.65, 0.35];
let BUYIN = 20; // career rooms change it
const prizeFor = place => place >= 1 && place <= PRIZES.length ? BUYIN * NS * PRIZES[place - 1] : 0;

function makePlayer(i, name, persona, chips, colorIdx, isHero = false) {
  return { i, name, persona, chips, colorIdx, isHero, out: false, place: 0, hole: [], cards: [], bet: 0, total: 0, folded: true, allIn: false, acted: false, afrc: -1, pf: '', startStack: chips, st: { hands: 0, vpip: 0, pfr: 0, won: 0 }, vpipHand: false, pfrHand: false, eqAllin: null };
}
const P = p => PERSONAS[p.persona] || PERSONAS.pro;

function avatarSVG(p) {
  const h = hashStr(p.name + p.persona), hair = h % 6, glasses = ((h >> 4) % 4) === 0, beard = hair !== 1 && ((h >> 7) % 4) === 0;
  const sil = '#0d0a08', hl = 'rgba(255,232,196,.28)';
  const hairs = [
    '<path d="M35 41C34 26 42 21 50 21C59 21 66 26 65 41C62 32 57 29 50 29C43 29 38 32 35 41Z"/>',
    '<path d="M33 45C31 24 41 19 50 19C60 19 69 24 67 45L69 68C64 72 60 68 60 62L60 36C56 31 44 31 40 36L40 62C40 68 36 72 31 68Z"/>',
    '<path d="M35 41C34 26 42 21 50 21C59 21 66 26 65 41C62 32 57 29 50 29C43 29 38 32 35 41Z"/><circle cx="50" cy="18" r="7.5"/>',
    '',
    '<ellipse cx="50" cy="30" rx="25" ry="4.5"/><path d="M37 30C37 18 42 14 50 14C58 14 63 18 63 30Z"/>',
    '<circle cx="38" cy="31" r="7.5"/><circle cx="44" cy="24" r="7.5"/><circle cx="51" cy="22" r="7.5"/><circle cx="58" cy="25" r="7.5"/><circle cx="63" cy="32" r="7"/>'
  ];
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="${sil}">
    <path d="M12 104C14 80 31 71 50 71C69 71 86 80 88 104Z"/><path d="M43 55h14v20H43z"/><ellipse cx="50" cy="43" rx="15" ry="18"/>${hairs[hair]}
    ${beard ? '<path d="M36 46C37 61 44 65 50 65C56 65 63 61 64 46C61 55 56 57 50 57C44 57 39 55 36 46Z"/>' : ''}</g>
    <path d="M62 33C66 38 66 49 61 56" stroke="${hl}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M70 76C78 79 83 86 85 96" stroke="${hl}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${glasses ? '<g stroke="rgba(236,214,170,.6)" stroke-width="1.6" fill="none"><circle cx="44" cy="44" r="4.6"/><circle cx="56" cy="44" r="4.6"/><path d="M48.6 44h2.8"/></g>' : ''}
  </svg>`;
}

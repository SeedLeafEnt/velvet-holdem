'use strict';
/* Velvet Hold'em: 09b-bank.js. Part of one shared script; see CLAUDE.md for the load order. */

/* =========================================================
   Bank: loans priced from your record and play style, and savings at a rate you choose.
   Money moves through the career bankroll (Career.add / Career.spend).
   Interest builds every game day (Cal events). On the 1st of each month the loan
   interest becomes due; pay it by the end of day 7, or a late fee is charged.
   ========================================================= */
const LOAN_TIERS = [ // monthly rate; limit = base + bankroll × mult
  { min: 750, name: 'Excellent', rate: 0.02, base: 5000, mult: 3 },
  { min: 650, name: 'Very good', rate: 0.03, base: 2500, mult: 2 },
  { min: 550, name: 'Good', rate: 0.045, base: 1000, mult: 1 },
  { min: 450, name: 'Fair', rate: 0.07, base: 400, mult: 0.5 },
  { min: 0, name: 'Poor', rate: 0, base: 0, mult: 0 },
];
const SAVE_PLANS = [ // monthly rates stay below the best loan rate, so borrowing to save never pays
  { id: 'flex', name: 'Easy access', rate: 0.004, months: 0 },
  { id: 'm1', name: '1-month fixed', rate: 0.008, months: 1 },
  { id: 'm3', name: '3-month fixed', rate: 0.012, months: 3 },
  { id: 'm6', name: '6-month fixed', rate: 0.016, months: 6 },
];
const LOAN_MIN = 100, SAVE_MIN = 100, LATE_FEE = 0.25, EARLY_FEE = 0.05;
const pct = r => `${+(r * 100).toFixed(1)}%`;

const Bank = {
  ui: { applying: false, plan: 'm3', borrow: null, save: null, pay: null },
  data() {
    const d = Career.load();
    if (!d.bank) d.bank = { loan: null, deposits: [], ontime: 0, missed: 0, seq: 0, offerDay: -1 };
    return d.bank;
  },
  owed() { const l = this.data().loan; return l ? l.bal + l.acc + l.due : 0; },
  savings() { return this.data().deposits.reduce((s, x) => s + x.amt + x.acc, 0); },

  /* ---------- play style and credit score ---------- */
  style() {
    const c = Career.load().counters || {}, n = c.chands || 0;
    const casino = (c.cwager || 0) / Math.max(1, (c.cwager || 0) + (c.cbuyin || 0));
    if ((c.cwager || 0) > 500 && casino > 0.6) return { label: 'Casino gambler', pts: -60, note: 'Most of your money goes on blackjack and roulette' };
    if (n < 30) return { label: 'Too new to judge', pts: 0, note: `Play ${30 - n} more career hands for a style rating` };
    const vpip = (c.cvpip || 0) / n, pfr = (c.cpfr || 0) / n, aggr = vpip > 0 ? pfr / vpip : 0;
    const tight = vpip < 0.25, loose = vpip > 0.42, pv = `You play ${Math.round(vpip * 100)}% of hands`;
    if (loose && aggr > 0.55) return { label: 'Loose and wild', pts: -50, note: `${pv} and raise a lot` };
    if (loose) return { label: 'Calls too much', pts: -30, note: `${pv}, mostly calling` };
    if (tight && aggr > 0.5) return { label: 'Tight and sharp', pts: 40, note: `${pv} and raise when you play` };
    if (tight) return { label: 'Careful', pts: 25, note: `${pv}` };
    return { label: 'Balanced', pts: 10, note: `${pv}` };
  },
  score() {
    const d = Career.load(), c = d.counters || {}, b = this.data(), f = [];
    const add = (label, pts) => { if (pts) f.push([label, Math.round(pts)]); };
    const n = c.chands || 0;
    add(`Experience · ${fmt(n)} career hands`, Math.min(90, n / 4));
    const st = this.style(); add(`Play style · ${st.label}`, st.pts);
    if ((c.csng || 0) >= 3) add(`Sit & Go cashes · ${c.citm || 0} of ${c.csng}`, ((c.citm || 0) / c.csng - 0.4) * 150);
    add(`Career level ${Career.level()}`, Math.min(40, Career.level() * 4));
    add(`Bankroll ${money(d.bankroll)}`, Math.min(60, d.bankroll / 400));
    add(`Payments on time · ${b.ontime}`, Math.min(120, b.ontime * 15));
    add(`Missed payments · ${b.missed}`, -70 * b.missed);
    if (b.loan && b.loan.late) add('Behind on your loan', -50);
    if (this.owed() > d.bankroll + this.savings()) add('You owe more than you have', -30);
    const total = clamp(Math.round(560 + f.reduce((s, x) => s + x[1], 0)), 300, 850);
    return { total, factors: f.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])), style: st, tier: LOAN_TIERS.find(t => total >= t.min) };
  },
  offer() {
    const sc = this.score(), t = sc.tier, l = this.data().loan, bank = Career.load().bankroll;
    if (l && l.late) return { ok: false, sc, why: 'You are behind on your loan. Pay what is due first.' };
    if (!t.rate) return { ok: false, sc, why: 'Your credit score is too low. Play steady career poker and build your record.' };
    const max = Math.min(250000, Math.floor((t.base + bank * t.mult) / 50) * 50) - Math.ceil(l ? l.bal : 0);
    if (max < LOAN_MIN) return { ok: false, sc, why: 'You have reached your borrowing limit for now.' };
    return { ok: true, sc, min: LOAN_MIN, max: Math.floor(max / 50) * 50, rate: t.rate };
  },

  /* ---------- loans ---------- */
  borrow(amt) {
    const o = this.offer(); amt = Math.round(amt);
    if (!o.ok || amt < o.min || amt > o.max) return false;
    const b = this.data();
    if (!b.loan) b.loan = { bal: 0, acc: 0, due: 0, dueBy: 0, rate: o.rate, late: false, since: Cal.min() };
    b.loan.bal += amt; b.loan.rate = o.rate; // a top-up is priced at today's rate
    Career.save(); Career.add(amt, 'Loan from the bank'); Sound.chips(6, 0.6);
    return true;
  },
  pay(amt) {
    const b = this.data(), l = b.loan; if (!l) return 0;
    amt = Math.min(Math.round(amt), Math.ceil(this.owed()));
    if (amt <= 0 || !Career.spend(amt)) return 0;
    let left = amt;
    const take = k => { const x = Math.min(left, l[k]); l[k] -= x; left -= x; };
    const hadDue = l.due > 0;
    take('due'); take('acc'); take('bal');
    if (hadDue && l.due <= 0.5) { l.due = 0; b.ontime++; l.late = false; toast('Payment received on time', 2200); }
    if (l.bal + l.acc + l.due < 0.5) { b.loan = null; toast('Loan paid off. Well done.', 2600); Sound.win(); }
    Career.save(); renderCareerChip();
    return amt;
  },

  /* ---------- savings ---------- */
  deposit(planId, amt) {
    const p = SAVE_PLANS.find(x => x.id === planId); amt = Math.round(amt);
    if (!p || amt < SAVE_MIN || !Career.spend(amt)) return false;
    const b = this.data(), now = Cal.min();
    b.deposits.push({ id: ++b.seq, plan: p.id, amt, acc: 0, start: now, until: p.months ? Cal.addMonths(now, p.months) : 0 });
    Career.save(); toast(`${money(amt)} saved · ${p.name}`, 2200); Sound.chips(4, 0.5);
    return true;
  },
  locked(dep) { return dep.until > 0 && Cal.min() < dep.until; },
  withdraw(id) {
    const b = this.data(), k = b.deposits.findIndex(x => x.id === id); if (k < 0) return 0;
    const dep = b.deposits[k], early = this.locked(dep);
    const out = Math.max(0, Math.round(early ? dep.amt * (1 - EARLY_FEE) : dep.amt + dep.acc));
    b.deposits.splice(k, 1); Career.save();
    Career.add(out, early ? 'Early withdrawal' : 'Savings withdrawn');
    return out;
  },

  /* ---------- the calendar drives interest ---------- */
  onTime(e) {
    if (S.test) return;
    const b = this.data(), l = b.loan, now = Cal.min();
    // every new day: interest builds (a month's rate spread over 30 days)
    if (l) l.acc += l.bal * l.rate / 30;
    for (const dep of b.deposits) dep.acc += dep.amt * SAVE_PLANS.find(p => p.id === dep.plan).rate / 30;
    // a deadline passed without payment
    if (l && l.due > 0 && now >= l.dueBy) {
      const fee = Math.max(25, Math.round(l.due * LATE_FEE)), total = Math.ceil(l.due) + fee;
      b.missed++; l.late = true; l.due = 0;
      if (Career.load().bankroll >= total * 2) { Career.spend(total); toast(`Missed bank payment: ${money(total)} taken, with a late fee`, 3600); }
      else { l.bal += total; toast(`Missed bank payment: ${money(total)} added to your loan`, 3600); }
      Sound.lose();
    }
    if (e.type === 'month') {
      if (l) {
        const interest = Math.ceil(l.acc); l.acc = 0;
        if (interest > 0) {
          l.due += interest; l.dueBy = Cal.monthDay(now, 8);
          showAchv(`Bank payment due: ${money(Math.ceil(l.due))}`, `Pay by ${Cal.dateText(l.dueBy - 1)} in the lobby's Bank tab`, 'Bank');
        }
      }
      for (const dep of b.deposits) {
        const gain = Math.floor(dep.acc); dep.amt += gain; dep.acc -= gain; // monthly compounding
        if (dep.until && !dep.notified && now >= dep.until) { dep.notified = true; toast(`Your ${SAVE_PLANS.find(p => p.id === dep.plan).name} savings are unlocked`, 3000); }
      }
    }
    Career.save(); renderCareerChip();
  },

  /* ---------- the Bank tab in the career lobby ---------- */
  render(root) {
    const d = Career.load(), b = this.data(), l = b.loan, sc = this.score(), now = Cal.min(), ui = this.ui;
    root.innerHTML = '';
    const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
    const btn = (parent, html, fn, cls = 'secondary', disabled = false) => { const x = el('button', cls, html); x.disabled = disabled; x.addEventListener('click', () => { Sound.tick(); fn(); }); parent.appendChild(x); return x; };
    const slider = (parent, min, max, val, step, onInput) => {
      const wrap = el('div', 'bk-amt'), r = el('input', 'bk-range'), out = el('b', null, money(val));
      r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = val;
      r.addEventListener('input', () => { out.textContent = money(+r.value); onInput(+r.value); });
      const presets = el('div', 'bk-pre');
      for (const [lab, f] of [['Min', 0], ['¼', 0.25], ['½', 0.5], ['Max', 1]]) {
        const v = f === 0 ? min : Math.max(min, Math.floor(max * f / step) * step);
        btn(presets, lab, () => { r.value = v; out.textContent = money(v); onInput(v); }, 'bk-chip');
      }
      wrap.append(out, r, presets); parent.appendChild(wrap); return wrap;
    };

    // net worth
    const nw = d.bankroll + this.savings() - this.owed();
    root.appendChild(el('div', 'bk-sum', `<div><span>Bankroll</span><b>${money(d.bankroll)}</b></div><div><span>Savings</span><b>${money(this.savings())}</b></div><div><span>Loan</span><b class="${l ? 'neg' : ''}">${l ? '−' + money(this.owed()) : '$0'}</b></div><div><span>Net worth</span><b>${money(nw)}</b></div>`));

    // credit score
    const card = el('div', 'bk-card');
    const k = (sc.total - 300) / 550;
    card.innerHTML = `<div class="bk-score"><div><span class="k">Credit score</span><b>${sc.total}</b><em>${sc.tier.name}</em></div><div class="bk-style"><span class="k">Your play style</span><b>${escH(sc.style.label)}</b><em>${escH(sc.style.note)}</em></div></div>
      <i class="bk-meter"><i style="width:${(k * 100).toFixed(1)}%"></i></i>
      <details class="bk-why"><summary>Why this score</summary><ul>${sc.factors.map(([t, p]) => `<li><span>${escH(t)}</span><em class="${p > 0 ? 'up' : 'down'}">${p > 0 ? '+' : '−'}${Math.abs(p)}</em></li>`).join('') || '<li><span>No record yet: the bank starts everyone at 560</span></li>'}</ul></details>`;
    root.appendChild(card);

    // loan
    root.appendChild(el('h3', 'bk-h', 'Loan'));
    const lo = el('div', 'bk-card'); root.appendChild(lo);
    if (l) {
      const dueTxt = l.due > 0 ? `<b class="neg">${money(Math.ceil(l.due))}</b><em>by ${Cal.dateText(l.dueBy - 1)}</em>` : `<b>$0</b><em>next bill on ${Cal.dateText(Cal.monthDay(now, 1, 1))}</em>`;
      lo.appendChild(el('div', 'bk-rows', `<div><span>Balance</span><b>${money(Math.ceil(l.bal))}</b></div><div><span>Rate</span><b>${pct(l.rate)}</b><em>a month</em></div><div><span>Interest this month</span><b>${money(Math.ceil(l.acc))}</b><em>so far</em></div><div><span>Due now</span>${dueTxt}</div>`));
      if (l.late) lo.appendChild(el('p', 'bk-warn', 'You missed a payment. Your score has dropped and the bank will not lend more until you catch up.'));
      const row = el('div', 'bk-btns'); lo.appendChild(row);
      if (l.due > 0) btn(row, `Pay what's due<small>${money(Math.ceil(l.due))}</small>`, () => { this.pay(Math.ceil(l.due)); renderLobby(); }, 'primary', d.bankroll < Math.ceil(l.due));
      btn(row, `Repay everything<small>${money(Math.ceil(this.owed()))}</small>`, () => { this.pay(Math.ceil(this.owed())); renderLobby(); }, 'secondary', d.bankroll < Math.ceil(this.owed()));
      const maxPay = Math.min(d.bankroll, Math.ceil(this.owed()));
      if (maxPay >= 50) {
        const part = el('div', 'bk-sub'); lo.appendChild(part);
        part.appendChild(el('p', 'bk-label', 'Or pay part of it'));
        if (ui.pay == null || ui.pay > maxPay) ui.pay = Math.min(maxPay, 500);
        slider(part, Math.min(50, maxPay), maxPay, ui.pay, 10, v => { ui.pay = v; payB.innerHTML = `Pay ${money(v)}`; });
        const payB = btn(part, `Pay ${money(ui.pay)}`, () => { this.pay(ui.pay); ui.pay = null; renderLobby(); });
      }
    }
    if (!l || !l.late) {
      const o = this.offer();
      const ap = el('div', l ? 'bk-sub' : ''); lo.appendChild(ap);
      if (b.offerDay !== Cal.parts().dayNo) {
        // like a real bank: you apply, they check your record, then they make an offer
        ap.appendChild(el('p', 'bk-label', l ? 'Need more? The bank will check your record again.' : 'The bank checks your play record and history, then offers a range you can borrow.'));
        btn(ap, ui.applying ? '<span class="bk-spin"></span>Checking your record…' : (l ? 'Ask to borrow more' : 'Apply for a loan'), () => {
          if (ui.applying) return; ui.applying = true; renderLobby();
          setTimeout(() => { ui.applying = false; b.offerDay = Cal.parts().dayNo; ui.borrow = null; Career.save(); renderLobby(); Sound.pop(); }, S.test ? 0 : 1300);
        }, 'primary', ui.applying);
      } else if (!o.ok) {
        ap.appendChild(el('div', 'bk-result no', `<b>Declined</b><span>${escH(o.why)}</span><em>Ask again tomorrow (game time).</em>`));
      } else {
        ap.appendChild(el('div', 'bk-result yes', `<b>Approved</b><span>Borrow ${money(o.min)} to ${money(o.max)} at ${pct(o.rate)} a month</span><em>Interest builds daily. In the first week of each month, pay at least that month's interest. Miss it and a ${Math.round(LATE_FEE * 100)}% late fee is added and your score drops.</em>`));
        if (ui.borrow == null || ui.borrow > o.max || ui.borrow < o.min) ui.borrow = Math.min(o.max, Math.max(o.min, Math.floor(o.max / 2 / 50) * 50));
        slider(ap, o.min, o.max, ui.borrow, 50, v => { ui.borrow = v; bb.innerHTML = `Borrow ${money(v)}<small>about ${money(v * o.rate)} interest a month</small>`; });
        const bb = btn(ap, `Borrow ${money(ui.borrow)}<small>about ${money(ui.borrow * o.rate)} interest a month</small>`, () => { if (this.borrow(ui.borrow)) { b.offerDay = -1; ui.borrow = null; renderLobby(); } }, 'primary');
      }
    }

    // savings
    root.appendChild(el('h3', 'bk-h', 'Savings'));
    const sv = el('div', 'bk-card'); root.appendChild(sv);
    for (const dep of b.deposits) {
      const p = SAVE_PLANS.find(x => x.id === dep.plan), lk = this.locked(dep);
      const r = el('div', 'bk-dep', `<div><b>${money(dep.amt)}</b><span>${p.name} · ${pct(p.rate)} a month</span><em>+${money(dep.acc)} this month · ${lk ? 'locked until ' + Cal.dateText(dep.until) : 'free to take out'}</em></div>`);
      btn(r, lk ? `Take out early<small>you get ${money(dep.amt * (1 - EARLY_FEE))}</small>` : `Take out<small>${money(dep.amt + dep.acc)}</small>`, () => {
        if (lk && !confirm(`Take this out early? You lose this month's interest and pay a ${Math.round(EARLY_FEE * 100)}% fee, so you get ${money(dep.amt * (1 - EARLY_FEE))}.`)) return;
        this.withdraw(dep.id); renderLobby();
      }, 'bk-take');
      sv.appendChild(r);
    }
    sv.appendChild(el('p', 'bk-label', 'Choose your rate: a higher rate locks your money for longer.'));
    const plans = el('div', 'bk-plans'); sv.appendChild(plans);
    for (const p of SAVE_PLANS) {
      const x = btn(plans, `${pct(p.rate)}<small>${p.months ? p.months + (p.months === 1 ? ' month' : ' months') + ' locked' : 'take out any time'}</small>`, () => { ui.plan = p.id; renderLobby(); }, 'bk-plan' + (ui.plan === p.id ? ' on' : ''));
      x.setAttribute('aria-pressed', ui.plan === p.id);
    }
    if (d.bankroll >= SAVE_MIN) {
      const plan = SAVE_PLANS.find(p => p.id === ui.plan);
      if (ui.save == null || ui.save > d.bankroll) ui.save = Math.min(d.bankroll, Math.max(SAVE_MIN, Math.floor(d.bankroll / 4 / 50) * 50));
      slider(sv, SAVE_MIN, d.bankroll, ui.save, 50, v => { ui.save = v; db.innerHTML = `Save ${money(v)}<small>${plan.name} · about ${money(v * plan.rate)} a month</small>`; });
      const db = btn(sv, `Save ${money(ui.save)}<small>${plan.name} · about ${money(ui.save * plan.rate)} a month</small>`, () => { if (this.deposit(ui.plan, ui.save)) { ui.save = null; renderLobby(); } }, 'primary');
    } else sv.appendChild(el('p', 'bk-label', `You need at least ${money(SAVE_MIN)} in your bankroll to save.`));

    root.appendChild(el('details', 'bk-help', `<summary>How the bank works</summary><p>Game time only moves while you play career games: 4 hours a poker hand, 2 hours a casino round.</p><p><b>Loans:</b> your credit score sets how much you can borrow and the rate. Interest builds every game day. On the 1st of each month that interest becomes due; pay it by the 7th. You can repay any amount at any time. Paying on time raises your score; missing a payment adds a late fee and lowers it.</p><p><b>Savings:</b> interest is added on the 1st of each month. Fixed plans pay more but lock your money; taking it out early loses this month's interest and costs ${Math.round(EARLY_FEE * 100)}%.</p>`));
  },
};
Cal.on(e => Bank.onTime(e));

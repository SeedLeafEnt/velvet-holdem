"""Bank: credit score, loan offer, borrowing, monthly interest due in the first week, on-time and
missed payments, savings plans, early withdrawal. Usage: python bank.py 0 (phone) / 1 (desktop).
Prints 'bank ok' when everything passes. Screenshots: tests/out/bank_*.png"""
import asyncio, sys, json
from playwright.async_api import async_playwright
from common import *

SEED = {"bankroll": 3000, "xp": 300, "rooms": {"club": True},
        "counters": {"chands": 240, "cvpip": 50, "cpfr": 32, "csng": 6, "citm": 3, "cbuyin": 900, "cwager": 100}}

STEPS = """async () => {
  const V = window.__velvet, B = V.Bank, C = V.Cal, K = V.Career, out = {}, d = K.load();
  const hands = n => { for (let i = 0; i < n; i++) C.advance('hand'); };
  const goTo = (day, addMon = 0) => { const target = C.monthDay(C.min(), day, addMon); for (let i = 0; i < 400 && C.min() < target; i++) C.advance('hand'); };
  const sc = B.score(); out.score = sc.total; out.style = sc.style.label; out.tier = sc.tier.name;
  const o = B.offer(); out.offer = { ok: o.ok, min: o.min, max: o.max, rate: o.rate };
  // borrow 2,000 on Mon 1 Jan
  const bank0 = d.bankroll; out.borrowed = B.borrow(2000); out.bankAfterBorrow = d.bankroll - bank0;
  // play into February: interest becomes due on 1 Feb
  goTo(1, 1);
  const l = B.data().loan; out.feb = { date: C.long(), due: Math.ceil(l.due), dueBy: C.dateText(l.dueBy - 1) };
  // pay it on time
  const before = B.data().ontime; B.pay(Math.ceil(l.due)); out.ontime = B.data().ontime - before; out.dueAfterPay = l.due;
  // March: do not pay, let the week pass
  goTo(1, 1); const marchDue = Math.ceil(B.data().loan.due); const br = d.bankroll;
  goTo(9); out.missed = B.data().missed; out.late = B.data().loan.late; out.lateTaken = br - d.bankroll; out.marchDue = marchDue;
  out.offerWhenLate = B.offer().ok;
  // savings: 3-month fixed and easy access
  B.deposit('m3', 1000); B.deposit('flex', 500);
  const deps = B.data().deposits; out.locked = B.locked(deps[0]); out.flexLocked = B.locked(deps[1]);
  goTo(1, 1); out.depAfterMonth = deps.map(x => x.amt);
  const br2 = d.bankroll; B.withdraw(deps[0].id); out.earlyGot = d.bankroll - br2;
  // repay everything
  const owed = Math.ceil(B.owed()); B.pay(owed); out.loanAfterRepay = B.data().loan;
  out.final = { bankroll: d.bankroll, score: B.score().total, date: C.long() };
  return out;
}"""


async def main():
    W, H, D, name = [(393, 730, 2, "bank_phone"), (1280, 760, 1, "bank_desk")][int(sys.argv[1]) if len(sys.argv) > 1 else 0]
    async with async_playwright() as pw:
        b = await launch(pw)
        ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=D)
        await ctx.add_init_script(f"if (!localStorage.getItem('velvet3d-career-v1')) localStorage.setItem('velvet3d-career-v1', JSON.stringify({json.dumps(SEED)}))")
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
        pg.on("dialog", lambda dlg: asyncio.ensure_future(dlg.accept()))
        await pg.goto(URL); await pg.wait_for_function("() => window.__velvetBooted", timeout=30000)
        # the Bank tab, before and after applying
        await pg.click("#btnCareer"); await pg.wait_for_timeout(500)
        await pg.click("#lobTabs button[data-tab=bank]"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=shot(f"{name}_1_tab.png"))
        await pg.click("#lobBankPane .bk-card button.primary"); await pg.wait_for_timeout(1700)
        await pg.screenshot(path=shot(f"{name}_2_offer.png"))
        sheet = await pg.query_selector("#lobby .lobsheet")
        await sheet.evaluate("e => e.scrollTop = 420"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=shot(f"{name}_3_offer_scrolled.png"))
        # borrow through the button, then save through the button
        await pg.click("#lobBankPane .bk-result.yes ~ .bk-amt ~ button.primary"); await pg.wait_for_timeout(400)
        loan = await pg.evaluate("() => window.__velvet.Bank.data().loan && Math.round(window.__velvet.Bank.data().loan.bal)")
        await pg.evaluate("() => { window.__velvet.Bank.data().loan = null; window.__velvet.Career.load().bankroll = 3000; window.__velvet.Career.save(); window.__velvet.Bank.data().offerDay = -1; }")
        r = await pg.evaluate(STEPS)
        print(json.dumps(r, indent=1))
        await pg.evaluate("() => { const V = window.__velvet; V.Bank.borrow(1500); V.Bank.deposit('m6', 800); for (let i = 0; i < 200 && !(V.Bank.data().loan.due > 0); i++) V.Cal.advance('hand'); }")
        await pg.wait_for_timeout(4500)
        await pg.evaluate("() => { document.querySelector('#lobTabs button[data-tab=rooms]').click(); document.querySelector('#lobTabs button[data-tab=bank]').click(); }")
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=shot(f"{name}_4_loan_due.png"))
        await sheet.evaluate("e => e.scrollTop = 600"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=shot(f"{name}_5_savings.png"))
        checks = {
            "offer ok": r["offer"]["ok"] and r["offer"]["min"] == 100 and r["offer"]["max"] >= 2000,
            "ui borrow": loan and loan > 0,
            "borrowed": r["borrowed"] and r["bankAfterBorrow"] == 2000,
            "feb due": r["feb"]["due"] > 0 and r["feb"]["date"].startswith("Thursday 1 February") and r["feb"]["dueBy"] == "Wed 7 Feb",
            "on time": r["ontime"] == 1 and r["dueAfterPay"] == 0,
            "missed": r["missed"] == 1 and r["late"] and r["lateTaken"] >= r["marchDue"] + 25 and not r["offerWhenLate"],
            "savings": r["locked"] and not r["flexLocked"] and r["depAfterMonth"][0] > 1000 and r["depAfterMonth"][1] > 500,
            "early fee": r["earlyGot"] == round(r["depAfterMonth"][0] * 0.95),
            "repaid": r["loanAfterRepay"] is None,
            "no errors": not errs,
        }
        bad = [k for k, v in checks.items() if not v]
        print("checks:", "all ok" if not bad else bad, errs[:4])
        assert not bad
        print("bank ok")
        await b.close()
asyncio.run(main())

"""Calendar: date maths, day/week/month events, 4 hours per poker hand, 2 hours per casino round.
Usage: python calendar.py 0 (phone) / 1 (desktop). Prints 'calendar ok' when everything passes."""
import asyncio, sys
from playwright.async_api import async_playwright
from common import *

CHECKS = """() => {
  const C = window.__velvet.Cal, out = {};
  out.start = C.short(0); out.startLong = C.long(0);
  out.midnight = C.short(240); out.noon = C.short(240 * 4);
  out.jan31 = C.short(30 * 1440); out.feb1 = C.short(30 * 1440 + 240);
  out.leap = C.short((31 + 28) * 1440); out.mar1 = C.short((31 + 29) * 1440);
  out.year2 = C.long(366 * 1440);
  const d = window.__velvet.Career.load(), seen = [];
  C.on(e => seen.push(e.type + ':' + e.to.day + '/' + (e.to.month + 1) + (e.to.firstWeek ? ':first' : '')));
  window.__velvet.S.test = false;
  d.cal.min = 0; C.advance('hand');                  // Mon 8 PM -> Tue midnight: day
  d.cal.min = 6 * 1440; C.advance('hand');           // Sun 7 Jan 8 PM -> Mon 8 Jan: week
  d.cal.min = 30 * 1440; C.advance('hand');          // Wed 31 Jan -> Thu 1 Feb: month
  d.cal.min = 30 * 1440 + 240; C.advance('casino');  // Thu midnight -> 2 AM: nothing
  out.events = seen; out.after = C.min();
  d.cal.min = 0; window.__velvet.Career.save();
  return out;
}"""
EXPECT = {
    "start": "Mon 1 Jan · 8 PM", "startLong": "Monday 1 January, Year 1 · 8 PM",
    "midnight": "Tue 2 Jan · Midnight", "noon": "Tue 2 Jan · Noon",
    "jan31": "Wed 31 Jan · 8 PM", "feb1": "Thu 1 Feb · Midnight",
    "leap": "Thu 29 Feb · 8 PM", "mar1": "Fri 1 Mar · 8 PM", "year2": "Wednesday 1 January, Year 2 · 8 PM",
    "events": ["day:2/1:first", "week:8/1", "month:1/2:first"], "after": 30 * 1440 + 360,
}


async def main():
    W, H, D, name = [(393, 730, 2, "cal_phone"), (1280, 760, 1, "cal_desk")][int(sys.argv[1]) if len(sys.argv) > 1 else 0]
    async with async_playwright() as pw:
        b = await launch(pw)
        ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=D)
        await ctx.add_init_script("if (!localStorage.getItem('velvet3d-career-v1')) localStorage.setItem('velvet3d-career-v1', JSON.stringify({bankroll: 4200, xp: 300, rooms: {club: true, vegas: true}}))")
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
        await pg.goto(URL); await pg.wait_for_function("() => window.__velvetBooted", timeout=30000)
        got = await pg.evaluate(CHECKS)
        bad = {k: (got.get(k), v) for k, v in EXPECT.items() if got.get(k) != v}
        print("date maths", "ok" if not bad else bad)

        # lobby shows the date (wait for the test's own month notice to clear first)
        await pg.wait_for_timeout(4500)
        await pg.click("#btnCareer"); await pg.wait_for_timeout(600)
        lob = await pg.text_content("#lobDate")
        await pg.screenshot(path=shot(f"{name}_lobby.png"))
        # a real career cash game: the hero folds every hand, the clock moves 4 hours a hand
        await pg.evaluate("() => { const btns = [...document.querySelectorAll('#lobRooms .room')][0].querySelectorAll('.games button'); btns[0].click(); }")
        await pg.evaluate("() => { window.__velvet.settings.speed = 'fast'; setInterval(() => { const S = window.__velvet.S; if (S.heroResolve) { const r = S.heroResolve; S.heroResolve = S.heroReject = null; r({ type: 'fold' }); } }, 200); }")
        for _ in range(400):
            if await pg.evaluate("() => window.__velvet.S.handNo >= 4"): break
            await pg.wait_for_timeout(250)
        st = await pg.evaluate("() => ({ hands: window.__velvet.S.handNo, min: window.__velvet.Cal.min(), chip: document.querySelector('.careerchip').textContent })")
        await pg.screenshot(path=shot(f"{name}_table.png"))
        hand_ok = st["min"] == (st["hands"] - 1) * 240 and st["chip"].startswith(await pg.evaluate("() => window.__velvet.Cal.short()"))
        print("table", st, "ok" if hand_ok else "WRONG")
        # roulette: one spin = 2 hours, and the casino top bar shows the date
        cas = await pg.evaluate("""async () => {
          const V = window.__velvet, before = V.Cal.min();
          V.Casino.enter('rl', 'club'); await new Promise(r => setTimeout(r, 1500));
          V.RL.result(7); await new Promise(r => setTimeout(r, 300));
          return { step: V.Cal.min() - before, sub: document.querySelector('#substatus').textContent, short: V.Cal.short() };
        }""")
        await pg.screenshot(path=shot(f"{name}_casino.png"))
        cas_ok = cas["step"] == 120 and cas["sub"].startswith(cas["short"])
        print("casino", cas, "ok" if cas_ok else "WRONG")
        assert not bad and lob == "Monday 1 January, Year 1 · 8 PM" and hand_ok and cas_ok and not errs, (bad, lob, st, cas, errs)
        print("calendar ok")
        await b.close()
asyncio.run(main())

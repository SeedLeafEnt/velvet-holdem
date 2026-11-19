import asyncio
from playwright.async_api import async_playwright
from common import *
async def main():
    async with async_playwright() as pw:
        b = await launch(pw)
        ctx = await b.new_context(viewport={"width": 393, "height": 730}); await setup_routes(ctx)
        await ctx.add_init_script("if (!localStorage.getItem('velvet3d-career-v1')) localStorage.setItem('velvet3d-career-v1', JSON.stringify({bankroll: 2000, xp: 0, rooms: {club: true}}))")
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(3000)
        await pg.evaluate("() => window.__velvet.Casino.enter('bj', 'club')")
        await pg.wait_for_timeout(1200)
        log = []
        for hnd in range(6):
            before = await pg.evaluate("() => window.__velvet.Career.load().bankroll")
            await pg.evaluate("() => { const B = window.__velvet.BJ; B.addBet(); B.addBet(); B.start(); }")
            for _ in range(80):
                st = await pg.evaluate("() => { const B = window.__velvet.BJ; return { ph: B.phase, busy: !!B.busy, v: B.hands[B.cur] ? B.val(B.hands[B.cur].cards).t : 0 } }")
                if st['ph'] == 'bet' and _ > 2: break
                if st['ph'] == 'play' and not st['busy']:
                    await pg.evaluate(f"() => window.__velvet.BJ.act('{'hit' if st['v'] < 13 else 'stand'}')")
                await pg.wait_for_timeout(400)
            after = await pg.evaluate("() => window.__velvet.Career.load().bankroll")
            log.append(after - before)
        print('bj nets', log)
        await pg.click('#btnMenu'); await pg.wait_for_timeout(300)
        lbl = await pg.evaluate("() => document.getElementById('btnNewGame').textContent")
        await pg.click('#btnNewGame'); await pg.wait_for_timeout(800)
        state = await pg.evaluate("() => ({ active: window.__velvet.Casino.active, lobby: !document.getElementById('lobby').hidden, cdock: document.getElementById('cdock').hidden, dock: getComputedStyle(document.getElementById('dock')).display })")
        print('leave label:', lbl, state)
        await pg.evaluate("() => window.__velvet.Casino.enter('rl', 'club')")
        await pg.wait_for_timeout(1000)
        rl = []
        for sp in range(3):
            before = await pg.evaluate("() => window.__velvet.Career.load().bankroll")
            await pg.evaluate("() => { const R = window.__velvet.RL; R.addBet('black'); R.addBet('n17'); R.addBet('c1'); R.go(); }")
            for _ in range(60):
                ph = await pg.evaluate("() => window.__velvet.RL.phase")
                if ph == 'result': break
                await pg.wait_for_timeout(400)
            n = await pg.evaluate("() => window.__velvet.RL.history[0]")
            after = await pg.evaluate("() => window.__velvet.Career.load().bankroll")
            rl.append((n, after - before))
            for _ in range(20):
                if await pg.evaluate("() => window.__velvet.RL.phase") == 'bet': break
                await pg.wait_for_timeout(400)
        print('rl (number, net)', rl, errs[:5])
        await b.close()
asyncio.run(main())

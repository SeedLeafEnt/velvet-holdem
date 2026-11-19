import asyncio, sys
from playwright.async_api import async_playwright
from common import *
async def main():
    W, H, D, name = [(393, 730, 2, "c_phone"), (1280, 760, 1, "c_desk")][int(sys.argv[1])]
    async with async_playwright() as pw:
        b = await launch(pw)
        ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=D); await setup_routes(ctx)
        await ctx.add_init_script("if (!localStorage.getItem('velvet3d-career-v1')) localStorage.setItem('velvet3d-career-v1', JSON.stringify({bankroll: 5000, xp: 300, rooms: {club: true, vegas: true}}))")
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(3500)
        await pg.click("#btnCareer"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=shot(f"{name}_lobby.png"))
        await pg.evaluate("() => window.__velvet.Casino.enter('bj', 'vegas')")
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=shot(f"{name}_bj0.png"))
        await pg.evaluate("() => { const B = window.__velvet.BJ; B.addBet(); B.addBet(); B.start(); }")
        await pg.wait_for_timeout(6000)
        await pg.screenshot(path=shot(f"{name}_bj1.png"))
        st = await pg.evaluate("() => { const B = window.__velvet.BJ; return { phase: B.phase, hands: B.hands.map(h => h.cards), d: B.dHand } }")
        print('bj', st)
        if st['phase'] == 'play':
            await pg.evaluate("() => window.__velvet.BJ.act('stand')")
        await pg.wait_for_timeout(7000)
        await pg.screenshot(path=shot(f"{name}_bj2.png"))
        st = await pg.evaluate("() => ({ phase: window.__velvet.BJ.phase, bank: window.__velvet.Career.load().bankroll })")
        print('bj2', st)
        await pg.evaluate("() => { const V = window.__velvet; V.Casino.exit(); V.Casino.enter('rl', 'vegas'); }")
        await pg.wait_for_timeout(1500)
        await pg.evaluate("() => { const R = window.__velvet.RL; R.addBet('red'); R.addBet('n17'); R.addBet('d2'); }")
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=shot(f"{name}_rl0.png"))
        await pg.evaluate("() => window.__velvet.RL.go()")
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=shot(f"{name}_rl1.png"))
        for _ in range(40):
            ph = await pg.evaluate("() => window.__velvet.RL.phase")
            if ph == 'result': break
            await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=shot(f"{name}_rl2.png"))
        st = await pg.evaluate("() => ({ phase: window.__velvet.RL.phase, hist: window.__velvet.RL.history, bank: window.__velvet.Career.load().bankroll })")
        print('rl', st, errs[:6])
        await b.close()
asyncio.run(main())

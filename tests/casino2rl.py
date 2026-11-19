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

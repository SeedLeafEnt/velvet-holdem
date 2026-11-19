import asyncio, sys
from playwright.async_api import async_playwright
from common import *
async def main():
    W, H, D, name = [(1280, 760, 1, "s2_desk"), (393, 730, 2, "s2_phone")][int(sys.argv[1])]
    async with async_playwright() as pw:
        b = await launch(pw)
        ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=D); await setup_routes(ctx)
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(4000); await pg.click("#btnStart")
        for _ in range(200):
            if await pg.evaluate("() => window.__velvet.S.toAct === 0"): break
            await pg.wait_for_timeout(150)
        await pg.evaluate("() => { const V = window.__velvet; const opp = V.S.players.filter(p => !p.isHero); V.Bar.speedMul = 8; V.Bar.sip(opp[1].i); V.heroOrder('martini'); V.sendDrink(opp[3]); }")
        await pg.wait_for_timeout(1100)
        await pg.screenshot(path=shot(f"{name}_a.png"))
        for k in range(3):
            await pg.wait_for_timeout(1500)
            w = await pg.evaluate("() => { const B = window.__velvet.Bar; return B.job ? [B.job.phase, B.job.i, B.waitress.root.position.toArray().map(x => +x.toFixed(2))] : null }")
            print(w)
            await pg.screenshot(path=shot(f"{name}_w{k}.png"))
        await pg.wait_for_timeout(9000)
        st = await pg.evaluate("() => { const B = window.__velvet.Bar; return { drinks: B.drinks.map(d => d ? d.type + ':' + d.level.toFixed(2) : null), job: !!B.job, q: B.queue.length } }")
        print(st, errs[:4])
        await pg.screenshot(path=shot(f"{name}_end.png"))
        await b.close()
asyncio.run(main())

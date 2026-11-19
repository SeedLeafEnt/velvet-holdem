import asyncio
from playwright.async_api import async_playwright
from common import *
async def main():
    async with async_playwright() as pw:
        b = await launch(pw)
        import sys
        W,H,D,name = [(1280,760,1,"ang_desk"),(393,730,3,"ang_phone")][int(sys.argv[1])]
        ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=D); await setup_routes(ctx); pg = await ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(4000); await pg.click("#btnStart")
        for _ in range(200):
            if await pg.evaluate("() => window.__velvet.S.toAct === 0"): break
            await pg.wait_for_timeout(150)
        # force the dice so the taunt lands
        await pg.evaluate("() => { window.__rnd = Math.random; Math.random = () => 0.01; }")
        await pg.click("#btnChat"); await pg.wait_for_timeout(500)
        await pg.click("#tauntGrid button:not([disabled])"); 
        await pg.evaluate("() => { setTimeout(() => { Math.random = window.__rnd; }, 2500); }")
        await pg.wait_for_timeout(2600)
        await pg.screenshot(path=shot(f"{name}_a.png"))
        hp = await pg.evaluate("() => { const V = window.__velvet, S = V.S; const p = S.players.find(q => V.isAngry(q) && !q.isHero); const el = document.querySelectorAll('.head')[p.i - 1]; const r = el.getBoundingClientRect(); return [r.x, r.y] }")
        x, y = max(0, hp[0] - 120), max(0, hp[1] - 110)
        await pg.screenshot(path=shot(f"{name}_zoom.png"), clip={"x": x, "y": y, "width": 240, "height": 240})
        await pg.wait_for_timeout(2400)
        r = await pg.evaluate("""() => { const V = window.__velvet, S = V.S; return S.players.map(p => ({ n: p.name, angry: V.isAngry(p), fire: !!(V.people()[p.i] && V.people()[p.i].fire && V.people()[p.i].fire.on), mood: V.people()[p.i] ? V.people()[p.i].mood : '-' })) }""")
        print(r); print(errs)
        await pg.screenshot(path=shot(f"{name}_b.png"))
        await b.close()
asyncio.run(main())

import asyncio, sys
from playwright.async_api import async_playwright
from common import *
SIZES = [(1920, 1000, "tk_desk", 1), (1366, 700, "tk_lap", 1), (393, 730, "tk_phone", 3)]
async def main():
    async with async_playwright() as pw:
        b = await launch(pw)
        for (w, h, name, dpr) in SIZES[:int(sys.argv[1]) if len(sys.argv) > 1 else 3]:
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr)
            await setup_routes(ctx); pg = await ctx.new_page()
            errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "fetch" not in m.text and "ERR_FAILED" not in m.text else None)
            await pg.goto(URL); await pg.wait_for_timeout(4000)
            await pg.click("#btnStart")
            for _ in range(200):
                if await pg.evaluate("() => window.__velvet.S.toAct === 0"): break
                await pg.wait_for_timeout(150)
            await pg.wait_for_timeout(600)
            await pg.screenshot(path=shot(f"{name}_0.png"))
            # make two opponents fume, the hero too, and tip the dealer
            await pg.evaluate("""() => { const V = window.__velvet, S = V.S;
                const opp = S.players.filter(p => !p.isHero && !p.out);
                V.setAngry(opp[0]); V.setAngry(opp[2]); V.setAngry(S.players[0]);
                S.players[0].tippedHand = -1; S.rig = null; window.__tip = V.tipDealer(S.players[0], 'big'); }""")
            await pg.wait_for_timeout(1300)
            await pg.screenshot(path=shot(f"{name}_1.png"))
            await pg.wait_for_timeout(1700)
            await pg.screenshot(path=shot(f"{name}_2.png"))
            await pg.click("#btnChat"); await pg.wait_for_timeout(500)
            await pg.screenshot(path=shot(f"{name}_talk.png"))
            print(name, errs[:5])
            await ctx.close()
        await b.close()
asyncio.run(main())

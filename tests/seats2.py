import asyncio, sys
from playwright.async_api import async_playwright
from common import *
SIZES = [(393, 730, "sb_phone", 3), (1100, 680, "sb_desk", 1)]
async def main():
    async with async_playwright() as pw:
        b = await launch(pw)
        for (w, h, name, dpr) in SIZES:
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr)
            await setup_routes(ctx); pg = await ctx.new_page()
            errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
            await pg.goto(URL); await pg.wait_for_timeout(4000)
            await pg.click("#btnStart")
            got = False; pitch = False
            for _ in range(600):
                st = await pg.evaluate("() => { const V = window.__velvet, S = V.S, d = V.dealer(); return { act: S.toAct === 0 && S.heroResolve ? 1 : 0, board: S.board.length, g: d && d.gest ? d.gest.name : '' } }")
                if st['g'] == 'pitch' and not pitch and w < 600:
                    await pg.wait_for_timeout(120); await pg.screenshot(path=shot(f"{name}_pitch.png")); pitch = True
                if st['board'] >= 4: got = True; break
                if st['act']:
                    try: await pg.click("#btnCall", timeout=1500)
                    except Exception: pass
                await pg.wait_for_timeout(150)
            await pg.wait_for_timeout(1500)
            await pg.screenshot(path=shot(f"{name}.png"))
            print(name, "board", got, "pitch", pitch, errs[:4])
            await ctx.close()
        await b.close()
asyncio.run(main())

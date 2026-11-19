import asyncio, sys
from playwright.async_api import async_playwright
from common import *
async def main():
    W, H, D = [(393, 730, 2), (1280, 760, 1), (430, 820, 2)][int(sys.argv[1])]
    async with async_playwright() as pw:
        b = await launch(pw)
        ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=D); await setup_routes(ctx)
        await ctx.add_init_script("if (!localStorage.getItem('velvet3d-career-v1')) localStorage.setItem('velvet3d-career-v1', JSON.stringify({bankroll: 5000, xp: 300, rooms: {club: true, vegas: true, macau: true}}))")
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(3500)
        for kind in sys.argv[2:]:
            await pg.evaluate(f"() => {{ const V = window.__velvet; if (V.Casino.active) V.Casino.exit(); V.Casino.enter('{kind}', 'macau'); }}")
            await pg.wait_for_timeout(1800)
            await pg.screenshot(path=shot(f"cam_{kind}_{sys.argv[1]}.png"))
        print(errs[:4])
        await b.close()
asyncio.run(main())

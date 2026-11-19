import asyncio, sys
from playwright.async_api import async_playwright
from common import *
async def main():
    async with async_playwright() as pw:
        b = await launch(pw)
        ctx = await b.new_context(viewport={"width": 393, "height": 730}, device_scale_factor=2); await setup_routes(ctx)
        await ctx.add_init_script("if (!localStorage.getItem('velvet3d-career-v1')) localStorage.setItem('velvet3d-career-v1', JSON.stringify({bankroll: 4200, xp: 300, rooms: {club: true}}))")
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(3500)
        await pg.screenshot(path=shot("s3_start.png"))
        await pg.click("#btnCareer"); await pg.wait_for_timeout(600)
        await pg.screenshot(path=shot("s3_lobby.png"))
        await pg.click("#lobDaily"); await pg.wait_for_timeout(400)
        await pg.click("#lobTabs button[data-tab=daily]"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=shot("s3_daily.png"))
        await pg.click("#lobTabs button[data-tab=rooms]"); await pg.wait_for_timeout(300)
        # Vegas bounty
        await pg.evaluate("() => { const btns = [...document.querySelectorAll('#lobRooms .room')][1].querySelectorAll('.games button'); btns[2].click(); }")
        for _ in range(200):
            if await pg.evaluate("() => window.__velvet.S.toAct === 0"): break
            await pg.wait_for_timeout(150)
        await pg.wait_for_timeout(800)
        await pg.screenshot(path=shot("s3_vegas.png"))
        st = await pg.evaluate("() => ({ career: window.__velvet.S.career, ko: window.__velvet.S.ko, bank: JSON.parse(localStorage.getItem('velvet3d-career-v1')).bankroll })")
        print(st, errs[:5])
        await b.close()
asyncio.run(main())

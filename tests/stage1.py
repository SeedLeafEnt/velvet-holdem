import asyncio, json
from playwright.async_api import async_playwright
from common import *
async def main():
    async with async_playwright() as pw:
        b = await launch(pw)
        ctx = await b.new_context(viewport={"width": 393, "height": 730}, device_scale_factor=2); await setup_routes(ctx)
        await ctx.add_init_script("localStorage.setItem('velvet3d-rivals-v1', JSON.stringify({maniac:{name:'Rico',w:2,l:1,busts:1,bustedBy:0,grudge:3}, shark:{name:'Vera',w:0,l:3,busts:0,bustedBy:1,grudge:1}}))")
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(4000); await pg.click("#btnStart")
        for _ in range(200):
            if await pg.evaluate("() => window.__velvet.S.toAct === 0"): break
            await pg.wait_for_timeout(150)
        await pg.wait_for_timeout(800)
        names = await pg.evaluate("() => window.__velvet.S.players.map(p => p.name + ':' + p.persona)")
        print(names)
        await pg.screenshot(path=shot("s1_table.png"))
        await pg.click("#btnChat"); await pg.wait_for_timeout(400)
        await pg.click("#talkTabs button[data-tab=bets]"); await pg.wait_for_timeout(300)
        await pg.click("#sideGrid button:first-child"); await pg.wait_for_timeout(300)
        await pg.click(".jpbtn"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=shot("s1_bets.png"))
        await pg.click("#talkTabs button[data-tab=react]"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=shot("s1_react.png"))
        await pg.click("#chatScreen [data-close]"); await pg.wait_for_timeout(300)
        i = await pg.evaluate("() => window.__velvet.S.players.findIndex(p => p.persona === 'maniac')")
        if i > 0:
            await pg.evaluate(f"() => document.querySelectorAll('.seat')[{i}].querySelector('.plate').click()")
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=shot("s1_pop.png"))
        st = await pg.evaluate("() => ({ side: window.__velvet.S.sideFlop, chips: window.__velvet.S.players[0].chips, house: window.__velvet.S.house })")
        print(st, errs)
        await b.close()
asyncio.run(main())

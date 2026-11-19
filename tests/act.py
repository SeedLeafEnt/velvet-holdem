import asyncio, sys
from playwright.async_api import async_playwright
from common import *
async def main():
    W, H, D, name = [(393, 730, 2, "act_phone"), (1280, 760, 1, "act_desk")][int(sys.argv[1])]
    async with async_playwright() as pw:
        b = await launch(pw)
        ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=D); await setup_routes(ctx)
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(3500); await pg.click("#btnStart")
        for _ in range(200):
            if await pg.evaluate("() => window.__velvet.S.toAct === 0"): break
            await pg.wait_for_timeout(150)
        await pg.wait_for_timeout(500)
        # screen position of the dealer's chest and of opponent 2's head
        pts = await pg.evaluate("""() => { const V = window.__velvet, cam = V.cam(), st = document.getElementById('stage').getBoundingClientRect();
          const pr = v => { const p = v.project(cam); return [st.left + (p.x + 1) / 2 * st.width, st.top + (1 - p.y) / 2 * st.height]; };
          const d = V.dealer(), o = V.people()[2];
          const dc = new THREE_V(d); return null; }""".replace("const dc = new THREE_V(d); return null;", "const a = d.head.getWorldPosition(d.root.position.clone()); a.y -= 0.25; const b = o.head.getWorldPosition(o.root.position.clone()); return [pr(a), pr(b)];"))
        print(pts)
        await pg.mouse.click(*pts[0]); await pg.wait_for_timeout(500)
        await pg.screenshot(path=shot(f"{name}_dealer.png"))
        o1 = await pg.evaluate("() => window.__velvet.Act.open")
        await pg.mouse.click(*pts[1]); await pg.wait_for_timeout(500)
        await pg.screenshot(path=shot(f"{name}_opp.png"))
        o2 = await pg.evaluate("() => window.__velvet.Act.open")
        c0 = await pg.evaluate("() => window.__velvet.S.players[0].chips")
        await pg.click(".actpop button:has-text('Taunt')"); await pg.wait_for_timeout(1500)
        await pg.mouse.click(*pts[0]); await pg.wait_for_timeout(400)
        await pg.click(".actpop button:has-text('Tip')"); await pg.wait_for_timeout(1500)
        await pg.mouse.click(*pts[1]); await pg.wait_for_timeout(400)
        await pg.screenshot(path=shot(f"{name}_opp2.png"))
        await pg.click(".actpop button:has-text('Send a drink')"); await pg.wait_for_timeout(800)
        st = await pg.evaluate("() => { const V = window.__velvet, S = V.S, h = S.players[0]; return {tipped: h.tippedHand === S.handNo, chips: h.chips, open: V.Act.open, bubbles: document.querySelectorAll('.bubble').length}; }")
        print('chips before', c0, st)
        await pg.evaluate("() => document.querySelector('.seat.hero .plate').click()"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=shot(f"{name}_hero.png"))
        o3 = await pg.evaluate("() => window.__velvet.Act.open")
        print(o1, o2, o3, errs[:4])
        await b.close()
asyncio.run(main())

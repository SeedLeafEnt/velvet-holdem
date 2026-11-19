"""The 3D city home screen: places open the right menus, a game hides the city and leaving
brings it back, jail closes the club and casino, Quick game and Phone work.
Usage: python city.py 0 (phone) / 1 (desktop). Prints 'city ok'. Screenshots: tests/out/city_*.png"""
import asyncio, sys, json
from playwright.async_api import async_playwright
from common import *

CITY = URL + "?city=1"


async def main():
    W, H, D, name = [(393, 730, 2, "city_phone"), (1280, 760, 1, "city_desk")][int(sys.argv[1]) if len(sys.argv) > 1 else 0]
    async with async_playwright() as pw:
        b = await launch(pw)
        ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=D)
        await ctx.add_init_script("if (!localStorage.getItem('velvet3d-career-v1')) localStorage.setItem('velvet3d-career-v1', JSON.stringify({bankroll: 3000, xp: 300, rooms: {club: true, vegas: true}}))")
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
        pg.on("console", lambda m: errs.append("CONSOLE " + m.text) if m.type == "error" else None)
        await pg.goto(CITY); await pg.wait_for_function("() => window.__velvetBooted", timeout=30000)
        await pg.wait_for_timeout(2500)
        home = await pg.evaluate("() => ({ city: window.__velvet.City.active, shown: !document.querySelector('#city').hidden, start: !document.querySelector('#startScreen').hidden, pins: document.querySelectorAll('#city .cpin').length, date: document.querySelector('#cDate').textContent, bank: document.querySelector('#cBank').textContent, badge: document.querySelector('#cBadge').textContent })")
        await pg.screenshot(path=shot(f"{name}_1_home.png"))
        L = "() => ({ open: !document.querySelector('#lobby').hidden, title: document.querySelector('#lobby h2').textContent, tab: [...document.querySelectorAll('#lobTabs button')].find(b => b.classList.contains('on')).dataset.tab, poker: [...document.querySelectorAll('#lobRooms .games:not(.casino)')].filter(e => !e.hidden).length, casino: document.querySelectorAll('#lobRooms .games.casino').length, jail: !!document.querySelector('#lobRooms .jailcard'), place: window.__velvet.Places.cur })"
        async def visit(i):
            await pg.evaluate(f"() => window.__velvet.City.focus({i}, true)"); await pg.wait_for_timeout(700)
            await pg.click("#cCardGo"); await pg.wait_for_timeout(500)
            r = await pg.evaluate(L)
            return r
        await pg.evaluate("() => window.__velvet.City.focus(1, true)"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=shot(f"{name}_2_card.png"))
        club = await visit(1)
        await pg.screenshot(path=shot(f"{name}_3_club_lobby.png"))
        await pg.click("#lobby .close-x"); await pg.wait_for_timeout(500)
        street = await pg.evaluate("() => window.__velvet.Places.cur")
        casino = await visit(2); await pg.click("#lobby .close-x"); await pg.wait_for_timeout(300)
        bank = await visit(0); await pg.click("#lobby .close-x"); await pg.wait_for_timeout(300)
        await pg.click("#cPhone"); await pg.wait_for_timeout(400); phone = await pg.evaluate(L); await pg.click("#lobby .close-x"); await pg.wait_for_timeout(300)
        await pg.click("#cQuick"); await pg.wait_for_timeout(400); quick = await pg.evaluate("() => !document.querySelector('#startScreen').hidden")
        await pg.evaluate("() => { document.querySelector('#startScreen').hidden = true; }")
        # play: start a cash game from the club, the city hides; leave, it returns
        await visit(1)
        await pg.evaluate("() => { const btns = [...document.querySelectorAll('#lobRooms .room')][0].querySelectorAll('.games button'); btns[0].click(); }")
        await pg.wait_for_function("() => window.__velvet.S.started && window.__velvet.S.handNo >= 1", timeout=30000)
        await pg.wait_for_timeout(1500)
        ingame = await pg.evaluate("() => ({ city: window.__velvet.City.active, hidden: document.querySelector('#city').hidden })")
        await pg.screenshot(path=shot(f"{name}_4_table.png"))
        await pg.evaluate("() => leaveToLobby()"); await pg.wait_for_timeout(1200)
        back = await pg.evaluate("() => ({ city: window.__velvet.City.active, lobby: !document.querySelector('#lobby').hidden })")
        await pg.click("#lobby .close-x"); await pg.wait_for_timeout(300)
        # jail: club and casino closed, their door leads to the jail
        await pg.evaluate("() => { window.__velvet.Jail.lockUp(); window.__velvet.City.refresh(); }"); await pg.wait_for_timeout(1200)
        locked = await pg.evaluate("() => [...document.querySelectorAll('#city .cpin')].map(p => p.classList.contains('locked'))")
        await pg.evaluate("() => window.__velvet.City.focus(2, true)"); await pg.wait_for_timeout(900)
        jail_text = await pg.text_content("#cCardP")
        await pg.screenshot(path=shot(f"{name}_5_jailed.png"))
        await pg.click("#cCardGo"); await pg.wait_for_timeout(500); jail = await pg.evaluate(L)
        print(json.dumps({"home": home, "club": club, "casino": casino, "bank": bank, "phone": phone, "quick": quick, "ingame": ingame, "back": back, "locked": locked, "jail_text": jail_text, "jail": jail}, indent=1))
        checks = {
            "home": home["city"] and home["shown"] and not home["start"] and home["pins"] == 4 and home["date"].startswith("Mon 1 Jan") and home["bank"] == "$3,000",
            "club": club["open"] and club["title"] == "Riverside Card Club" and club["poker"] >= 2 and club["casino"] == 0,
            "inside places": club["place"] == "club" and casino["place"] == "casino" and bank["place"] == "bank" and jail["place"] == "jail" and phone["place"] is None and street is None,
            "casino": casino["open"] and casino["title"] == "The Golden Strip" and casino["poker"] == 0 and casino["casino"] >= 2,
            "bank": bank["open"] and bank["tab"] == "bank" and bank["title"] == "Velvet Bank",
            "phone": phone["open"] and phone["tab"] == "daily",
            "quick": quick,
            "game hides city": not ingame["city"] and ingame["hidden"],
            "leaving shows city": back["city"] and back["lobby"],
            "jail": locked == [False, True, True, True] and "jail" in jail_text and jail["jail"],
            "no errors": not errs,
        }
        bad = [k for k, v in checks.items() if not v]
        print("checks:", "all ok" if not bad else bad, errs[:5])
        assert not bad
        print("city ok")
        await b.close()
asyncio.run(main())

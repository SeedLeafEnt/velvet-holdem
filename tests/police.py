"""Police: catch odds, an opponent arrested (stack seized, chips still balance), the patrol,
the hero arrested in a quick game, and Career jail (blocked rooms and casino, bail, the guard game).
Usage: python police.py 0 (phone) / 1 (desktop). Prints 'police ok' when everything passes."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from common import *

BAL = "() => { const S = window.__velvet.S; return S.players.reduce((a, p) => a + p.chips, 0) + S.pot + (S.tips || 0) + (S.house || 0) + (S.bar || 0); }"
FOLD = "() => { const V = window.__velvet; V.settings.speed = 'fast'; if (window.__fold) return; window.__fold = setInterval(() => { const S = V.S; if (S.heroResolve) { const r = S.heroResolve; S.heroResolve = S.heroReject = null; r({ type: 'fold' }); } }, 150); }"


async def wait(pg, js, secs=60):
    for _ in range(int(secs * 5)):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False


async def main():
    W, H, D, name = [(393, 730, 2, "police_phone"), (1280, 760, 1, "police_desk")][int(sys.argv[1]) if len(sys.argv) > 1 else 0]
    async with async_playwright() as pw:
        b = await launch(pw)
        ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=D)
        await ctx.add_init_script("if (!localStorage.getItem('velvet3d-career-v1')) localStorage.setItem('velvet3d-career-v1', JSON.stringify({bankroll: 2500, xp: 300, rooms: {club: true}}))")
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
        await pg.goto(URL); await pg.wait_for_function("() => window.__velvetBooted", timeout=30000)
        odds = await pg.evaluate("() => { const P = window.__velvet.Police; P.patrol = 0; const a = [0, 30, 80].map(h => +P.catchChance({ heat: h }).toFixed(2)); P.patrol = 2; a.push(+P.catchChance({ heat: 80 }).toFixed(2), +P.catchChance({ heat: 100 }).toFixed(2)); P.patrol = 0; return a; }")
        # quick Sit & Go: an opponent is caught
        await pg.click("#btnStart"); await pg.evaluate(FOLD)
        await wait(pg, "() => window.__velvet.S.handNo >= 1 && window.__velvet.S.inHand")
        bal0 = await pg.evaluate(BAL)
        await pg.evaluate("() => { const V = window.__velvet; V.Police.patrol = 3; V.Police.startPatrol(); V.Police.renderChip(); V.addHeat(V.S.players[1], 70); V.Police.wanted.add(V.S.players[1]); }")
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=shot(f"{name}_1_patrol.png"))
        sir = await wait(pg, "() => document.querySelector('#stage').classList.contains('siren')", 60)
        await pg.wait_for_timeout(2600)
        await pg.screenshot(path=shot(f"{name}_2_arrest.png"))
        await wait(pg, "() => window.__velvet.S.players[1].arrested && window.__velvet.S.players[1].out", 40)
        st = await pg.evaluate("() => { const S = window.__velvet.S, p = S.players[1]; return { chips: p.chips, out: p.out, arrested: !!p.arrested, house: S.house }; }")
        await wait(pg, "() => window.__velvet.S.betweenHands", 20)
        bal1 = await pg.evaluate(BAL)
        # the hero is caught in a quick game: game over
        await pg.evaluate("() => window.__velvet.Police.wanted.add(window.__velvet.S.players[0])")
        over = await wait(pg, "() => !document.querySelector('#endScreen').hidden && document.querySelector('#endTitle').textContent === 'Arrested'", 60)
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=shot(f"{name}_3_quick_arrested.png"))
        quick_btn = await pg.text_content("#endPrimary")
        # Career: arrested in a cash game -> jail
        await pg.evaluate("() => { document.querySelector('#endScreen').hidden = true; window.__velvet.Police.reset(); }")
        await pg.evaluate("() => { document.querySelector('#btnCareer').click(); }"); await pg.wait_for_timeout(500)
        await pg.evaluate("() => { const btns = [...document.querySelectorAll('#lobRooms .room')][0].querySelectorAll('.games button'); btns[0].click(); }")
        await wait(pg, "() => window.__velvet.S.career && window.__velvet.S.inHand")
        await pg.evaluate("() => { const V = window.__velvet; V.addHeat(V.S.players[0], 40); V.Police.wanted.add(V.S.players[0]); }")
        jailed = await wait(pg, "() => !document.querySelector('#endScreen').hidden && document.querySelector('#endPrimary').textContent === 'Go to jail'", 60)
        heat_after = await pg.evaluate("() => window.__velvet.Career.load().heat")
        await pg.click("#endPrimary"); await pg.wait_for_timeout(700)
        await pg.screenshot(path=shot(f"{name}_4_jail_lobby.png"))
        j = await pg.evaluate("""() => { const V = window.__velvet, d = V.Career.load();
          const blockedRoom = V.Career && !document.querySelector('#lobRooms .room') && !!document.querySelector('#lobRooms .jailcard');
          return { jail: d.jail, arrests: d.arrests, blockedRoom, career: document.querySelector('#btnCareer').textContent }; }""")
        # play the guard
        await pg.click("#lobRooms .jailcard .games button:nth-child(2)")
        await wait(pg, "() => window.__velvet.S.jail && window.__velvet.S.inHand")
        g = await pg.evaluate("() => { const S = window.__velvet.S; return { live: S.players.filter(p => !p.out).map(p => p.name + ':' + p.persona), seatsShown: [...document.querySelectorAll('.seat')].filter(s => !s.hidden).length, logo: S.career }; }")
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=shot(f"{name}_5_jail_game.png"))
        cas_blocked = await pg.evaluate("() => { const V = window.__velvet; V.Casino.enter('rl', 'club'); return !V.Casino.active; }")
        # lose: still in jail; then win: free
        await pg.evaluate("() => window.__velvet.Jail.end('bust')")
        still = await pg.evaluate("() => !!window.__velvet.Career.load().jail && document.querySelector('#endTitle').textContent")
        await pg.screenshot(path=shot(f"{name}_6_jail_lost.png"))
        await pg.evaluate("() => { document.querySelector('#endScreen').hidden = true; window.__velvet.Jail.end('champ'); }")
        freed = await pg.evaluate("() => !window.__velvet.Career.load().jail && document.querySelector('#endTitle').textContent")
        # bail: lock up again and pay
        bail = await pg.evaluate("() => { const V = window.__velvet, d = V.Career.load(); V.Jail.lockUp(); const b0 = d.bankroll, bail = d.jail.bail; const ok = V.Jail.pay(); return { ok, paid: b0 - d.bankroll, bail, jail: d.jail, arrests: d.arrests }; }")
        print(json.dumps({"odds": odds, "siren": sir, "arrest": st, "bal": [bal0, bal1], "quick": [over, quick_btn], "jailed": jailed, "heat_after": heat_after, "jail": j, "game": g, "casino_blocked": cas_blocked, "still": still, "freed": freed, "bail": bail}, indent=1))
        checks = {
            "odds": odds == [0, 0, 0.5, 0.9, 0.95],
            "opponent arrested": sir and st["arrested"] and st["chips"] == 0 and st["out"] and st["house"] > 0,
            "balance": bal0 == 7500 and bal1 == 7500,
            "quick game over": over and quick_btn == "Play again",
            "career jail": jailed and heat_after == 0 and j["jail"] and j["arrests"] == 1 and j["blockedRoom"] and "In jail" in j["career"],
            "guard game": len(g["live"]) == 2 and any(x.endswith(":cop") for x in g["live"]) and g["seatsShown"] == 2,
            "casino blocked": cas_blocked,
            "lose keeps jail": still == "Still locked up",
            "win frees": freed == "Free!",
            "bail": bail["ok"] and bail["paid"] == bail["bail"] and bail["jail"] is None and bail["arrests"] == 2,
            "no errors": not errs,
        }
        bad = [k for k, v in checks.items() if not v]
        print("checks:", "all ok" if not bad else bad, errs[:5])
        assert not bad
        print("police ok")
        await b.close()
asyncio.run(main())

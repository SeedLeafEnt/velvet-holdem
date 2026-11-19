"""Drinks with effects: buzz stages, the luckier deal, drunk mistakes (AI and hero), opponents offering
the hero a drink (accept / refuse), chips still balance. Usage: python drinks.py 0 (phone) / 1 (desktop).
Prints 'drinks ok' when everything passes. Screenshots: tests/out/drinks_*.png"""
import asyncio, sys, json
from playwright.async_api import async_playwright
from common import *

UNIT = """() => {
  const V = window.__velvet, S = V.S, out = {}, h = S.players[0], ai = S.players[1];
  const save = { deck: S.deck.slice(), hb: h.buzz || 0, ab: ai.buzz || 0, players: S.players.map(p => p.buzz || 0) };
  out.stages = [0, 1, 2.5, 4].map(b => V.buzzStage({ buzz: b }));
  h.buzz = 0; V.drinkUp(h, 'whisky'); out.afterWhisky = +h.buzz.toFixed(2); V.buzzTick(); out.afterTick = +h.buzz.toFixed(2);
  V.drinkUp(h, 'mocktail'); out.afterMocktail = +h.buzz.toFixed(2);
  // luck: best of three for a buzzed player, deck stays a full shuffle
  const chen = d => V.CHEN[d[51] * 52 + d[46]]; // seat 0 of 5 dealt: positions L-1 and L-1-5
  const trial = (buzz, n) => { let sum = 0, lucky = 0, perm = true;
    for (let t = 0; t < n; t++) {
      S.players.forEach(p => p.buzz = 0); h.buzz = buzz;
      const d = [...Array(52).keys()]; for (let i = 51; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
      S.deck = d; if (V.applyBuzzLuck([0, 1, 2, 3, 4]) === 0) lucky++;
      if (S.deck.slice().sort((a, b) => a - b).some((c, k) => c !== k)) perm = false;
      sum += chen(S.deck);
    } return { avg: +(sum / n).toFixed(2), rate: +(lucky / n).toFixed(3), perm }; };
  out.sober = trial(0, 4000); out.buzzed = trial(1.5, 4000); out.drunk = trial(5, 2000);
  // drunk mistakes
  const slips = (p, buzz, a, n) => { p.buzz = buzz; let c = 0; for (let t = 0; t < n; t++) if (V.drunkAdjust(p, a).type !== a.type) c++; return c / n; };
  out.aiSober = slips(ai, 0, { type: 'check' }, 2000); out.aiDrunk = +slips(ai, 5, { type: 'check' }, 2000).toFixed(3); out.aiTipsy = +slips(ai, 3, { type: 'check' }, 2000).toFixed(3);
  const hs = (buzz, n) => { h.buzz = buzz; let c = 0; for (let t = 0; t < n; t++) if (V.drunkHero({ type: 'call' }) && V.drunkHero({ type: 'call' }).type !== 'call') c++; return c / n; };
  out.heroSober = hs(0, 500); out.heroDrunk = +hs(5, 500).toFixed(3);
  S.deck = save.deck; S.players.forEach((p, k) => p.buzz = save.players[k]);
  return out;
}"""
BALANCE = "() => { const S = window.__velvet.S; return S.players.reduce((a, p) => a + p.chips, 0) + S.pot + (S.tips || 0) + (S.house || 0) + (S.bar || 0); }"


async def main():
    W, H, D, name = [(393, 730, 2, "drinks_phone"), (1280, 760, 1, "drinks_desk")][int(sys.argv[1]) if len(sys.argv) > 1 else 0]
    async with async_playwright() as pw:
        b = await launch(pw)
        ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=D)
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
        await pg.goto(URL); await pg.wait_for_function("() => window.__velvetBooted", timeout=30000)
        await pg.click("#btnStart")
        await pg.wait_for_function("() => window.__velvet.S.toAct === 0 && !!window.__velvet.S.heroResolve", timeout=60000)
        u = await pg.evaluate(UNIT)
        print(json.dumps(u))
        # looks: buzzed, tipsy and drunk opponents; a drunk hero
        await pg.evaluate("() => { const V = window.__velvet, S = V.S; S.players[1].buzz = 1; S.players[2].buzz = 3; S.players[3].buzz = 5; S.players[0].buzz = 5; for (let i = 0; i < 5; i++) V.renderBuzz(i); }")
        await pg.wait_for_timeout(1800)
        await pg.screenshot(path=shot(f"{name}_1_drunk.png"))
        badges = await pg.evaluate("() => [...document.querySelectorAll('.seat')].map(s => { const b = s.querySelector('.buzzb'); return b && !b.hidden ? b.textContent : ''; })")
        stage_cls = await pg.evaluate("() => document.querySelector('#stage').className")
        # an opponent offers a drink: accept
        await pg.evaluate("() => { const V = window.__velvet; V.Bar.speedMul = 8; V.S.players[0].buzz = 0; V.renderBuzz(0); V.DrinkOffer.show(V.S.players[4], 'whisky'); }")
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=shot(f"{name}_2_offer.png"))
        before = await pg.evaluate("() => { const S = window.__velvet.S; return { chips: S.players[4].chips, bar: S.bar || 0, cost: Math.max(5, Math.round(S.bb / 5) * 5) }; }")
        bal0 = await pg.evaluate(BALANCE)
        await pg.click(".drinkoffer .ok")
        after = await pg.evaluate("() => { const S = window.__velvet.S; return { chips: S.players[4].chips, bar: S.bar || 0, queued: window.__velvet.Bar.queue.some(q => q.i === 0) || (window.__velvet.Bar.job && window.__velvet.Bar.job.i === 0) }; }")
        bal1 = await pg.evaluate(BALANCE)
        got = False
        for _ in range(240):
            if await pg.evaluate("() => (window.__velvet.S.players[0].buzz || 0) > 1"): got = True; break
            await pg.wait_for_timeout(250)
        # refuse
        await pg.evaluate("() => window.__velvet.DrinkOffer.show(window.__velvet.S.players[2], 'beer')")
        c2 = await pg.evaluate("() => window.__velvet.S.players[2].chips")
        await pg.wait_for_timeout(400); await pg.click(".drinkoffer .no"); await pg.wait_for_timeout(400)
        c2b = await pg.evaluate("() => window.__velvet.S.players[2].chips")
        # keep playing a few hands with drunk opponents; chips must still balance between hands
        await pg.evaluate("() => { const V = window.__velvet; V.settings.speed = 'fast'; V.S.players.forEach(p => { if (!p.isHero) p.buzz = 5; }); setInterval(() => { const S = V.S; if (S.heroResolve) { const r = S.heroResolve; S.heroResolve = S.heroReject = null; r({ type: Math.random() < .5 ? 'fold' : 'call' }); } }, 200); }")
        start = await pg.evaluate("() => window.__velvet.S.handNo"); bals = []
        for _ in range(600):
            st = await pg.evaluate("() => ({ n: window.__velvet.S.handNo, between: window.__velvet.S.betweenHands })")
            if st["between"]: bals.append(await pg.evaluate(BALANCE))
            if st["n"] >= start + 4: break
            await pg.wait_for_timeout(200)
        # on a slow machine the poll can miss the short gap between hands: wait for one and check the totals there
        for _ in range(300):
            if await pg.evaluate("() => window.__velvet.S.betweenHands"): bals.append(await pg.evaluate(BALANCE)); break
            await pg.wait_for_timeout(100)
        await pg.screenshot(path=shot(f"{name}_3_play.png"))
        checks = {
            "stages": u["stages"] == [0, 1, 2, 3],
            "drink math": u["afterWhisky"] == 1.2 and u["afterTick"] == 0.9 and u["afterMocktail"] == 0.3,
            "deck intact": u["sober"]["perm"] and u["buzzed"]["perm"] and u["drunk"]["perm"],
            "luck rate": u["sober"]["rate"] == 0 and 0.18 <= u["buzzed"]["rate"] <= 0.26 and u["drunk"]["rate"] == 0,
            "luck helps": u["buzzed"]["avg"] > u["sober"]["avg"] + 0.3,
            "ai slips": u["aiSober"] == 0 and 0.2 <= u["aiDrunk"] <= 0.4 and 0.05 <= u["aiTipsy"] <= 0.15,
            "hero slips": u["heroSober"] == 0 and u["heroDrunk"] > 0.1,
            "badges": badges[1:4] == ["Buzzed", "Tipsy", "Drunk"] and badges[0] == "Drunk" and "drunk" in stage_cls,
            "they pay": after["chips"] == before["chips"] - before["cost"] and after["bar"] == before["bar"] + before["cost"] and after["queued"] and bal0 == bal1,
            "delivered": got,
            "refuse free": c2 == c2b,
            "balance": len(bals) > 0 and all(x == 7500 for x in bals),
            "no errors": not errs,
        }
        bad = [k for k, v in checks.items() if not v]
        print("badges", badges, "stage", stage_cls, "offer", before, after, "balances", sorted(set(bals)))
        print("checks:", "all ok" if not bad else bad, errs[:4])
        assert not bad
        print("drinks ok")
        await b.close()
asyncio.run(main())

import asyncio, json
from playwright.async_api import async_playwright
from common import *
EVAL = r"""
() => {
  const V = window.__velvet; const c = (r, s) => (r - 2) * 4 + s; const out = [];
  const cases = [
    [[c(14,0),c(13,0),c(12,0),c(11,0),c(10,0),c(2,1),c(3,2)], 'Royal Flush'],
    [[c(14,0),c(2,1),c(3,1),c(4,2),c(5,3),c(9,0),c(9,1)], 'Straight, Five high'],
    [[c(8,0),c(8,1),c(8,2),c(5,3),c(5,1),c(5,2),c(2,2)], 'Full House, Eights full of Fives'],
    [[c(11,0),c(11,1),c(4,2),c(4,3),c(9,1),c(9,0),c(2,2)], 'Two Pair, Jacks and Nines'],
  ];
  for (const [h, w] of cases) { const g = V.handName(V.evaluate(h)); if (g !== w) out.push(w + ' -> ' + g); }
  const P = (total, folded=false) => ({ total, folded, out:false });
  const pots = V.buildPots([P(100), P(300), P(300), P(50, true)]).map(p => [p.amount, p.eligible.length]);
  if (JSON.stringify(pots) !== '[[350,3],[400,2]]') out.push('pots ' + JSON.stringify(pots));
  return out;
}
"""
async def main():
    async with async_playwright() as pw:
        b = await launch(pw)
        ctx = await b.new_context(viewport={"width": 360, "height": 640})
        await setup_routes(ctx)
        pg = await ctx.new_page()
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        await pg.goto(URL)
        await pg.wait_for_timeout(3500)
        print("eval failures:", await pg.evaluate(EVAL))
        for mode, games, target in [("sng", 2, 400), ("cash", 1, 80)]:
            for g in range(games):
                await pg.evaluate(f"""() => {{
                  const V = window.__velvet; V.S.test = true; window.__viol = []; window.__last = performance.now();
                  document.getElementById('startScreen').hidden = true; document.getElementById('endScreen').hidden = true;
                  V.newGame('{mode}', '{'sharp' if g % 2 else 'relaxed'}', null, 'turbo');
                  let lastHand = -1, maxAnte = 0; clearInterval(window.__iv);
                  window.__iv = setInterval(() => {{
                    const S = V.S;
                    if (S.handNo !== lastHand) {{ lastHand = S.handNo; window.__last = performance.now(); }}
                    if (S.ante > maxAnte) {{ maxAnte = S.ante; window.__maxAnte = maxAnte; }}
                    if (S.betweenHands && !S.inHand && S.mode === 'sng') {{
                      const tot = S.players.reduce((a,p)=>a+p.chips,0) + S.pot + (S.tips||0) + (S.house||0) + (S.bar||0);
                      if (tot !== 7500 && S.players.every(p=>p.bet===0 && p.total===0)) window.__viol.push([S.handNo, tot]);
                    }}
                    for (const p of S.players) if (p.chips < 0 || p.chips % 5 !== 0) window.__viol.push(['bad', S.handNo, p.name, p.chips]);
                    if (V.liveCards.size > 40) window.__viol.push(['cards leak', V.liveCards.size]);
                  }}, 2);
                }}""")
                for _ in range(900):
                    await pg.wait_for_timeout(200)
                    st = await pg.evaluate("""() => { const S = window.__velvet.S; return { hand: S.handNo, end: !document.getElementById('endScreen').hidden,
                       stalled: performance.now() - window.__last, viol: window.__viol.slice(0,5), lvl: S.blindIdx + 1, maxAnte: window.__maxAnte || 0,
                       stacks: S.players.map(p => p.out ? 'out' + p.place : p.chips) } }""")
                    if st["end"] or st["hand"] >= target or st["stalled"] > 5000: break
                print(mode, g, json.dumps(st))
        print("errors:", errors[:8])
        await b.close()
asyncio.run(main())

"""Installable app check: manifest and icons load, the service worker caches the game,
and the table still starts after going offline. Prints 'pwa ok' when everything passes."""
import asyncio
from playwright.async_api import async_playwright
from common import *


async def main():
    async with async_playwright() as pw:
        b = await launch(pw)
        ctx = await b.new_context(viewport={"width": 393, "height": 730}, device_scale_factor=2)
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(3000)
        man = await pg.evaluate("""async () => {
          const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json();
          const icons = await Promise.all(m.icons.map(async i => [i.src, (await fetch(i.src)).status]));
          return { name: m.name, display: m.display, icons };
        }""")
        print("manifest", man)
        assert all(s == 200 for _, s in man["icons"]), man
        # the game skips registration under automation, so register it here
        await pg.evaluate("async () => { await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; }")
        for _ in range(50):
            if await pg.evaluate("() => !!navigator.serviceWorker.controller"): break
            await pg.wait_for_timeout(200)
        n = await pg.evaluate("async () => (await (await caches.open((await caches.keys())[0])).keys()).length")
        print("cached files", n)
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_timeout(4000)
        booted = await pg.evaluate("() => !!window.__velvetBooted && !!window.__velvet && window.__velvet.G.ok")
        print("offline boot", booted)
        await pg.click("#btnStart"); await pg.wait_for_timeout(5000)
        hand = await pg.evaluate("() => window.__velvet.S.handNo")
        await pg.screenshot(path=shot("pwa_offline_phone.png"))
        print("offline hand", hand, errs[:4])
        assert booted and hand >= 1 and n >= 30 and not errs
        print("pwa ok")
        await b.close()
asyncio.run(main())

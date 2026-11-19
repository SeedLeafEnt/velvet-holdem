# Velvet Hold'em

A 3D poker game with blackjack and roulette, made with Claude.

## Play it

Double-click **start-game.bat**. A black window opens and the game opens in your
browser at http://localhost:8000. Keep the black window open while you play,
and close it when you are done.

This needs Python. If the window says Python is not found, install it from
python.org and tick "Add Python to PATH" during setup.

Double-clicking `index.html` does not work any more: the game is now split into
several files, and browsers only load those through a web server.

Once the game is hosted online, you can install it on a phone or PC: open the
link, then use "Add to Home Screen" (iPhone, Safari share menu) or the install
icon in the address bar (Chrome or Edge on a PC). It then opens full screen and
also works offline.

## Work on it in Claude Code

1. Open the Claude desktop app and click the **Code** tab.
   The first time on Windows, Claude Code needs Git for Windows
   (https://git-scm.com/downloads/win). Install it, then restart the app.
2. Choose **Local** and pick this `velvet-holdem` folder as the project folder.
3. Describe what you want changed, for example:

   > Read CLAUDE.md. (Describe the change or the problem.) Then run the tests.

Claude Code reads `CLAUDE.md` by itself. That file explains how the game is
built, how to test it, and how you like to work.

If you prefer the terminal: open this folder in a terminal and type `claude`.

## What is inside

- `index.html` — the page: screens, menus and buttons
- `css/` — the look (colours, layout, fonts)
- `js/` — the game code, in numbered parts that load in order
- `vendor/three/`, `fonts/` — the 3D engine and the fonts, stored here so no internet is needed
- `icons/`, `manifest.webmanifest`, `sw.js` — what makes it installable and work offline
- `voice/` — the recorded voices
- `tests/` — automatic tests that play many hands and check the chips balance
- `tools/voice/` — how the voices were made (reference only)
- `CLAUDE.md` — notes for Claude Code

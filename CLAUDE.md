# Velvet Hold'em — notes for Claude Code

A realistic 3D Texas Hold'em game in the browser, plus blackjack and roulette.
It started as a claude.ai artifact, moved to Claude Code on 2026-11-19, and on
the same day became an installable web app (PWA) in `C:\Users\User\velvet-holdem`.

- The old copy in `Documents\velvet-holdem` is a backup only. Windows
  "Controlled folder access" is on, and it blocks Python, PowerShell and other
  tools from creating files inside Documents. Do not move the project back there.
- Git and GitHub CLI are installed (winget, 2026-11-19); Node is not. There is
  no build step. Shells opened before the install may not have them on PATH:
  `C:\Program Files\Git\cmd\git.exe`, `C:\Program Files\GitHub CLI\gh.exe`.

## Run it

- Windows: double-click `start-game.bat`. It serves the folder at
  http://localhost:8000 and opens the browser.
- Any OS: `python -m http.server 8000` in this folder, then open http://localhost:8000.
- Opening `index.html` straight from disk does **not** work any more: module
  scripts do not load on `file://`. The loading screen says so.
- Everything is local: three.js 0.169 is in `vendor/three/`, the fonts in
  `fonts/`. Playing needs no internet.

## How the code is split (read this before adding code)

`index.html` holds the markup only. The game code is in `js/`, loaded in this order:

1. `js/00-three.js` is an ES module. It imports three.js through the importmap
   in `index.html` and sets `window.THREE` and `window.RoomEnvironment`.
2. `js/01-core.js` … `js/19-boot.js` are **classic `defer` scripts**, each starting
   with `'use strict'`. Module and deferred scripts run in document order, so
   THREE exists before `01` runs.

The classic scripts share **one global scope**, the same as when they were one
module, which is why `RUN++` or `S` work across files. What changed:

- Function declarations are hoisted only inside their own file. Code that runs
  at load time (top level, not inside a function or callback) can only use
  things from the same or an earlier file. Calls inside functions and event
  handlers can use anything.
- Every top-level name must be unique across all files. Never use `top`,
  `window`, `document` or `location` as top-level names (a syntax error in
  classic scripts).
- A new file needs a `<script defer src>` tag in `index.html` **and** an entry in
  `sw.js` (the `JS` list). Then bump `VERSION` in `sw.js`.

| File | Section | What lives there |
|---|---|---|
| `css/style.css` | Styles | Layout, top bar, seats, dock, overlays, `.actpop` (tap menu). |
| `css/fonts.css` | Fonts | Self-hosted Limelight, Barlow Condensed, Source Serif 4 (latin). |
| `01-core.js` | Utilities, cards | `$`, `sleep`, `clamp`, `rand`, `pick`, `fmt`; `evaluate`, `handName`, equity. |
| `02-audio.js` | Sound, music, voice | `Sound` (Web Audio), `Music` (generated jazz), `Voice` (device speech fallback). |
| `03-fx.js` | Particles | `FX`: sparks and confetti on a 2D canvas. |
| `04-personas.js` | Players | `PERSONAS`, `LINES`, `HERO_PHRASES`, `Rivals`, `VOICE_DATA` + `VO` (recorded clips). |
| `05-state.js` | State | `S` (all game state), `settings`, `RUN`, `ABORT`, `delay`, `spd`. |
| `06-engine3d.js` | 3D engine | Scene, camera fit, table (`G`), cards, chips, `animate`, `HeadFire`. |
| `07-people.js` | 3D people | `Person` (body, face, IK arms, gestures), dealer, waitress, seat labels. |
| `08-tricks.js` | Table tricks | Anger, `taunt`, `tipDealer`, AI bribes, the rig. |
| `09-career.js` | Stage 3 | `ROOMS`, `Career`, `Cal` (game calendar), `Achv`, `Daily`, bounties, lobby. |
| `09b-bank.js` | Bank | `Bank`: credit score, play style, loans, savings, the lobby's Bank tab. |
| `10-bar.js` | Stage 2 | `DRINKS`, `Bar` (waitress), `heroOrder`, `sendDrink`. |
| `11-stage1.js` | Stage 1 | Tilt, celebrations, `heroTap`, `heroThrow`, slow-roll, side bets, `Jackpot`. |
| `12-casino.js` | Stage 4 | `Casino` (own scene/camera), `BJ` blackjack, `RL` roulette. |
| `13-talk-act.js` | Talk & tap | Table-talk sheet; `Act` tap-a-person popover. |
| `14-render.js` | Render loop | `layout()`, `frame(now)` (hands off to `Casino.frame` in the casino). |
| `15-hud.js` | HUD | Seats, table talk, tournament clock, top bar, hero dock, `heroAct`. |
| `16-ai.js` | AI, pots | Decisions, reads, timing tells; `buildPots`. |
| `17-flow.js` | Game flow | `newGame`, `gameLoop`, `playHand`, `bettingRound`, `takeTurn`, `showdown`, `afterHand`. |
| `18-overlays.js` | Overlays | `openOverlay`, `closeOverlay`, menus. |
| `19-boot.js` | Persistence, boot | `SET_KEY`, `SAVE_KEY`; start-up; service-worker registration; `window.__velvet` test hook. |

Other files: `voice/*.mp3` (recorded voices; `VOICE_DATA` has every clip's
start/end), `icons/`, `manifest.webmanifest`, `sw.js` (offline cache: code is
network-first, everything else cache-first), `tools/voice/` (how the voices
were made; reference only).

`window.claude?.hot` in `19-boot.js` is the old artifact hot-reload hook. It does
nothing here.

## Rules the code relies on

- **Chips must balance.** In a Sit & Go, between hands:
  `sum(player chips) + S.pot + S.tips + S.house + S.bar` = starting total (7,500).
  Chip amounts are multiples of 5 and never negative.
- **Long actions check `RUN`.** Async work captures `const run = RUN` and
  stops if it changed, so an old hand never touches a new game.
- **The table must never stop.** `gameLoop` treats any error other than
  `ABORT` as a misdeal: it logs it, returns the chips and deals the next hand.
  (A crash in the showdown "throw cards" code used to freeze the table.)
- **`S.test = true`** (set by the tests) skips rendering, sound, music and
  voices, and lets the AI play every seat.
- **Saved data in localStorage:** `velvet3d-settings-v1`, `velvet3d-save-v2`,
  `velvet3d-rivals-v1`, `velvet3d-career-v1`, `velvet3d-hint-act`. Bump the
  version in a key if you change its shape. Saves are per web address, so the
  hosted app does not see saves from the claude.ai artifact or from localhost.
- **Seating:** 2 opponents on the left, 2 on the right, nobody next to the
  dealer, the hero at the near side. The camera fit keeps every head on screen.

## Test it

```
pip install playwright
python -m playwright install chromium
cd tests
python run_all.py           # every test, with a summary at the end
python selfplay3d.py        # main check: hand ranks, side pots, 2 Sit & Gos + 80 cash hands, chips balance
```

| Test | Checks |
|---|---|
| `selfplay3d.py` | Main regression. Must print `viol: []` for every game and no page errors. |
| `selfplay_ko.py` | Same for bounty Sit & Gos. |
| `pwa.py` | Manifest and icons load, the service worker caches the game, the table starts offline. |
| `gamecal.py 0` / `gamecal.py 1` | Calendar: date maths, day/week/month events, 4 h per hand, 2 h per casino round (phone / desktop). |
| `bank.py 0` / `bank.py 1` | Bank: score, offer, borrow, interest due in week 1, on-time and missed payments, savings, early withdrawal; screenshots. |
| `act.py 0` / `act.py 1` | Tap menus on phone (0) / desktop (1); screenshots of each. |
| `casino.py`, `casino2.py`, `casino2rl.py`, `rlcam.py` | Blackjack and roulette: payouts, cameras, exit to lobby. |
| `stage1.py`, `stage2s.py`, `stage3.py` | Side bets and reactions; the waitress; career lobby. |
| `angertest.py`, `tricks.py` | Anger, flames, tips. |
| `seats2.py` | Seat layout on several screen sizes. |

Tests serve the folder on a local port. Software WebGL is very slow; on this PC
set `VELVET_GPU=1` (PowerShell: `$env:VELVET_GPU="1"`) to use the graphics card.
The game skips service-worker registration under test automation
(`navigator.webdriver`); `pwa.py` registers it by hand.

## Working with this user

- Explain in plain, simple language and keep updates short.
- Guide them one question at a time.
- They play on an iPhone and on a Windows PC. Check every visual change on
  both a phone size (393×730) and a desktop size (1280×760), with screenshots.
- Run `selfplay3d.py` (or `run_all.py`) before calling a change done.

## Where it lives

- Live at **https://seedleafent.github.io/velvet-holdem/** (GitHub Pages, public
  repo https://github.com/SeedLeafEnt/velvet-holdem, branch `main`, root folder).
  The user installs it with "Add to Home Screen" on the iPhone.
- To publish a change: run the tests, commit, `git push`. Pages rebuilds in about
  a minute. Installed copies pick up new code on their next online start
  (code is network-first in `sw.js`). Ask the user before pushing.
- Commits use the GitHub no-reply address set in the repo's local git config.
- The old claude.ai artifact "Velvet Hold'em"
  (https://claude.ai/artifact/4pxB58D35P128yb7xXy2GW) is the single-file version
  from before the split. It is not updated any more.

## Calendar (`Cal` in `09-career.js`)

- Runs in Career mode only and moves only while you play: `Cal.advance('hand')`
  in `afterHand` (4 hours), `Cal.advance('casino')` after each blackjack round and
  roulette spin (2 hours). Skipped when `S.test`.
- Stored as minutes since the start in the career save: `Career.load().cal.min`.
  Minute 0 = Monday 1 January, Year 1, 8 PM (date maths uses 2024, which starts
  on a Monday). `Cal.parts()` gives year, month, day, weekday, hour, `firstWeek`.
- Shown in the career chip on the table, the casino top bar and the lobby.
  A new day shows a toast, a new month a banner.
- Other systems subscribe with `Cal.on(fn)`; `fn({ type: 'day'|'week'|'month', from, to })`.
- Daily chips and daily challenges still follow the real date (not changed yet).

## Bank (`Bank` in `09b-bank.js`)

- Lives in the career save: `Career.load().bank` = `{ loan, deposits, ontime, missed, seq, offerDay }`.
  Money moves only through `Career.add` / `Career.spend`.
- Credit score 300–850 = 560 + factors (shown to the player under "Why this score"):
  career hands, play style, Sit & Go cash rate, level, bankroll, on-time and missed
  payments, being behind, owing more than you have. Play style comes from career
  counters `chands`, `cvpip`, `cpfr` (counted in `afterHand`), `csng`/`citm`
  (`showEnd`), `cbuyin` (`startCareerGame`), `cwager` (blackjack and roulette).
- `LOAN_TIERS`: the score sets the monthly rate (2–7%) and the limit
  (base + bankroll × multiple). Below 450: declined. You apply, it "checks your
  record", and the offer lasts for that game day (`offerDay`).
- Interest builds every game day (rate / 30 of the balance). On the 1st of a month
  it becomes `due`, payable by the end of day 7 (`dueBy`). Missed: a 25% late fee
  (min $25), `missed++`, `late = true` (no new loans until a later on-time payment
  or full repayment); the bank takes it from the bankroll if you have twice the amount,
  otherwise it is added to the loan.
- `SAVE_PLANS`: easy access 0.4%, fixed 1/3/6 months at 0.8/1.2/1.6% a month.
  Savings rates stay below the best loan rate (2%) so borrowing to save never pays.
  Interest compounds on the 1st. Early withdrawal: no interest and a 5% fee.
- The career chip on the table shows "Bank due $X" in red while a payment is due,
  and the lobby's Bank tab gets a red dot.

## Upgrade plan (agreed order)

1. ~~Calendar that runs while you play~~ — done (see above).
2. ~~Bank: loans, interest due in the first week, savings with a chosen rate~~ — done (see above).
3. Drinks with effects: a buzz meter (a small boost), drunk mistakes for AI and
   hero, opponents can send the hero a drink to accept or refuse.
4. Bribes and police: higher bribe acceptance, a heat meter, a patrolling cop,
   an arrest animation, jail (pay bail or win a game against the cops).
5. UI/UX: city-map menu, an in-game phone (calendar, bank, messages), livelier
   characters, cinematic all-in and river moments, day/night lighting.
6. Voices last (ElevenLabs, about 14,600 credits): write and approve the lines
   first, count characters, then record the most-heard lines first.

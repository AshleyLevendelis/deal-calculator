# Deal Calculator — operations map

Ashley's phone app for working out property deals: the calculator part of her Deal Analyser app, on its own, with no
daily deal feed. Keep this file current when something changes.

NOTE: the whole repo is served publicly by Vercel. Never commit private material here (email addresses, her buying
rules). The .vercelignore keeps this file, the README and the tests off the site, but keep secrets out anyway.

## Where it came from
Copied on 4 Oct 2026 from GitHub AshleyLevendelis/deal-analyser (branch main, commit f6a01f1). That repo is read-only from
here: never change or push to it. What was copied, and how:
- calc.js, pdf.js, icon.svg, fonts/, test.js, test-calcs.js, test-pdf.js: byte for byte, unchanged at the copy.
  calc.js still holds a few helpers only the deal feed used (saleLabel, feedOrder, valueNote...). They are left in on
  purpose. Since the copy, calc.js has had ONE addition (4 Oct 2026, design 6c): dealVerdict + LET_TARGETS. Nothing that
  existed was edited, so every figure is still identical to the Deal Analyser's (checked: 364 figures on the main screen,
  every exit, bridging off and on). Ashley chose to put 6c into this app only; the Deal Analyser keeps design 3a.
- index.html: the same CSS with only the deal-feed rules deleted; the bottom tab bar has two columns instead of three;
  title "Deal Calculator"; no Deals tab, no property screen, no geo.js.
- app.js: the same code with only the deal feed deleted (Deals tab, property page, "How sure is the end value?",
  "Check this deal", the "Checking <deal>" card, notes on a property, dismiss / viewed, postcode "Nearest first").
  An empty address (#) now opens the Calculator. The note on a SAVED deal ("Add a note" under each saved deal) is kept.
  localStorage keys keep the "deal-analyser:" prefix (the app lives on its own web address, so nothing is shared).
- sw.js: same worker, own cache name (deal-calculator-vN), no geo.js in the precache list.
- manifest.webmanifest: "Deal Calculator", short name "Deal Calc".
Proved the same on 4 Oct 2026 (before the 6c redesign of the main screen): both apps driven side by side in Chromium (end value 230,000, price 125,000, refurb
30,000, legal 1,500; every exit with bridging off and on; every other calculator; Compare; Client report; Saved and
saved compare; My usual figures; Settings; onboarding) at 360px and 390px, light and dark: every figure on screen,
every box and all three PDFs identical; pixels identical outside the app name and the tab bar, apart from faint
anti-aliasing noise (at most 5 of 255 shades) on the Save bar at 360px; no sideways scrolling.

## The pieces
| Piece | Where it lives | What it does |
|---|---|---|
| The app | GitHub AshleyLevendelis/deal-calculator -> Vercel project deal-calculator, live at deal-calculator-eight.vercel.app | Plain HTML/CSS/JS PWA, no build step, no framework. Push to main = live. |

- Files: index.html (all CSS + skeleton), app.js (all screens and routing), calc.js (all maths, pure), pdf.js, sw.js.
- Tests: `node test.js`, `node test-calcs.js`, `node test-pdf.js`, `node test-sw.js`, `node test-app.js`,
  `node test-verdict.js`, `node test-browser.js` — all must pass. New logic gets mutation-tested (break it on purpose,
  check a test fails, put it back). test-app.js checks the app shell: every element the code looks up exists, two tabs,
  the app name, and no deal-feed code, page parts or styles left. test-verdict.js checks Calc.dealVerdict and its edges.
  test-browser.js drives the main screen in Chromium (it serves the folder itself; skips if Playwright is missing):
  slider bubble, drag, snap tick once per entry, Set price, arrow keys, Reset, one fold open at a time, remembered exit
  and bridging, 44px tap targets.
- Every change that touches a precached file bumps the cache name in sw.js (deal-calculator-v1, v2, ...).
- Push straight to main is fine. Do the tests first.
- The live site and the Vercel project cannot be read from a cloud session (the egress proxy blocks *.vercel.app and the
  Vercel connection may not grant read access to the project). Ask Ashley to check on her phone.

## The app
Two tabs: Calculator and Saved. Compare is a screen reached from the Calculator ("Compare side by side" on the ledger,
"Compare every strategy" on the other calculators), and Settings (gear) holds theme, explanations, "My usual figures"
and "Redo the setup questions" (onboarding: how you will use it, then price, end value and letting type).
Routes: (empty) or #calculators = Calculator, #c/<key> (brr, recycle, btl, hmo, sabtl, r2rhmo, r2rsa, bridging; old
#c/flip, #c/hmobrr, #c/sabrr land on the ledger with the right exit), #compare, #report, #saved, #saved-compare, #usual.
- Calculator primary screen = design 6c "Verdict docked" (4 Oct 2026, from Ashley's hand-off bundle "Design Requirements
  Inquiry.zip" / design_handoff_calculator_6c; only phone 6c was approved). A restyle and rearrangement of the 3a Live
  ledger: every field, formula, slider behaviour, target and colour rule from 3a is unchanged. Top to bottom:
  - pinned answer panel (sticky, rounded bottom): "Calculator", a Reset text button (only when one of the four figures
    differs from the start; puts all four back), the exit pill (Flip / BRR → BTL / BRR → HMO / BRR → SA), the eyebrow,
    the hero (cash left in / pulled out, or flip profit), the ROI or margin chip, the money bar, "Includes £X bridging".
  - exit row: Flip, BTL, HMO, SA side by side, each with its headline % in its verdict colour.
  - The deal: one card per figure (end value, price, refurb, legal): typed number, 42px round −/+ and the custom slider,
    a sub line (drag hint, "✓ Snapped to …", or "Lender pays …") with the "+£X from £Y ↺" reset. The price card holds
    the "Recycle all your cash ≤ £X · Set price" button and stamp duty (worked out, read-only).
  - Lender pays / Deposit cards. "How {exit} does": result tiles in 3a's order (7 for a let, 3 for the flip).
  - More detail: three fold cards, ONLY ONE OPEN AT A TIME (openFold in app.js), each with a one-line summary when closed:
    "{exit} figures" (the letting fields, 36px −/+ with a 44px hit area, custom sliders; lets only), "Your own money in",
    "Paying for it" (own cash / bridging toggle and the whole bridging block).
  - Verdict dock: fixed just above the Save / Compare bar. Calc.dealVerdict(exit, v) in calc.js. Lets score 4 targets,
    each judged as its figure is coloured: £500 a month (monthlyProfitVerdict), 50% ROI or nothing left in, money back
    in 6 months (paybackVerdict; nothing left in = 0, never = never), all cash recycled (shown cash left ≤ £0). 4 Strong,
    3 Good, 2 Borderline (amber), 0-1 Weak (bad); 3-4 good colour. Misses listed in that order. Flip: Good flip (25%+),
    Thin flip (amber, profit > 0), Loss-making flip. Lets use the bridged figures when bridging is on.
  - Custom slider (scrubber in app.js): 3a's pointer handling kept exactly (relative drag, slide down for finer steps,
    magnets at level 0, tap jumps); drawn as a 20px track, accent fill, 34px thumb (centre at 20px + (100% − 40px) × p),
    recycle marker, value bubble while the finger is down. A visually hidden range input keeps keyboard / screen reader
    access; its arrow keys step like −/+. Snap tick when it settles on a magnet (once per entry during a drag; starting
    on one is not an entry), on a tap that lands on one, and on Set price: navigator.vibrate(12) (iPhones ignore it), a
    900ms green glow on that thumb only, and "✓ Snapped to the recycle price / the starting figure" in its sub line.
  - Colours: the 6c palette is the DARK theme for the whole app (bg #0d1714, card #14211d, accent --mint #7fd3b0,
    --good #8fdcae for verdicts, amber #f2c66d, bad #ff7a7a). Light theme = the original tokens, with --good = --mint.
    The main screen is Geist only, bold figures; other screens keep their own look.
  All numbers come from Calc.ledger(deal, bridgeOn); renderLedger only draws and refreshLedger updates in place (never
  rebuild the DOM under a finger). State: brrLet ('none' = Flip), brrBridge (bridging on/off), ledgerStart (figures when
  the deal opened: Reset, the "from" deltas and the magnets), openFold. Saved deals remember exit and bridging.
- The other calculators (Max price, BTL, HMO BTL, SA BTL, R2R HMO, R2R SA, Bridging) keep their own screens with the pill
  row, reached from "Rent to rent →" at the bottom of the ledger, from Compare cards, or by #c/<key>. Max price has
  "Test an offer" (cash left in or pulled out at that price; minus = pulled out). The app header is not sticky on the ledger.
- Compare: the deal through every calculator, sortable by ROI / monthly profit / money in, Download PDF and Client report
  (prepared for / by, paper preview, same PDF). Saved: tick two or more to compare side by side ("Run every deal as"),
  with its own PDF and client report.
- Offline: sw.js stores the whole app when installed and every good same-site answer after, so it opens with no signal
  (test-sw.js). The browser pane cannot run service workers; offline is tested by test-sw.js.
- Local-only data on the phone: the deal, usual figures, saved deals (with their notes), exit, bridging, theme,
  explanations, onboarding answers, client report names.

## Ashley's rules (all kept from the Deal Analyser)
- Only the YELLOW cells in her spreadsheets are editable fields. Never add an input that is not a yellow cell.
  test-calcs.js holds the yellow-cell list per calculator (YELLOW) and fails on any extra field. Max price and Bridging
  have no spreadsheet; their fields are her own design.
- STAMP DUTY IS CALCULATED ONLY: no box anywhere, Max price included; a stored stampDutyOverride is ignored. The flip has
  no selling / holding extras.
- Flip target 25% of end value (Calc.FLIP_TARGET).
- ROI on cash left in: red below 50%, green at 50%+.
- Every let (BTL, HMO, SA) needs £500 a month profit (Calc.MONTHLY_PROFIT_TARGET, monthlyProfitVerdict; annual uses the
  same verdict).
- Months to get money back: green <= 6, amber <= 24, red beyond or never (Calc.paybackVerdict).
- Money sliders (end value, price, refurb, legal) cover a window of 60%-140% of the figure (valueWindow), re-centred when
  left near an end or typed outside; a figure of 0 uses the usual range. Rent sliders: stretchTop, capped at 4x the usual
  top. Typing is never limited.
- Tap targets are 44px or more.
- Figures are shared by id across every calculator (mortgage rate, rooms, purchase figures...), so each is typed once.
  Figures layer: spreadsheet example < My usual figures < typed for this deal (Calc.withUsual). Saved deals keep their
  numbers.
- Exit names: Flip, BTL, HMO, SA (pinned panel: Flip, BRR → BTL, BRR → HMO, BRR → SA).

## Things worth remembering
- The shell here breaks on apostrophes inside heredocs: write scripts to a file with the Write tool, then run them.
- Browser preview: a fresh tab has empty storage and shows onboarding; HTTP-cache the page with ?v=N when re-testing.
- Ashley is non-technical: plain words, short summary at the end of every message, no file names unless asked.

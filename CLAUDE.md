# BRR Calculator (was Deal Calculator) — operations map

Ashley's phone app for working out property deals, named BRR Calculator since 5 Oct 2026 (repo, Vercel project and
web address keep the deal-calculator name; the service worker cache stays deal-calculator-vN): the calculator part of her Deal Analyser app, on its own, with no
daily deal feed. Keep this file current when something changes.

NOTE: the whole repo is served publicly by Vercel. Never commit private material here (email addresses, her buying
rules). The .vercelignore keeps this file, the README and the tests off the site, but keep secrets out anyway.

## Where it came from
Copied on 4 Oct 2026 from GitHub AshleyLevendelis/deal-analyser (branch main, commit f6a01f1). That repo is read-only from
here: never change or push to it. What was copied, and how:
- calc.js, pdf.js, icon.svg, fonts/, test.js, test-calcs.js, test-pdf.js: byte for byte, unchanged at the copy.
  calc.js still holds a few helpers only the deal feed used (saleLabel, feedOrder, valueNote...). They are left in on
  purpose. Since the copy, calc.js has had: (4 Oct 2026, design 6c) dealVerdict, dealEntered and LET_TARGETS added; and
  (5 Oct 2026, Ashley) the FLIP BANDS changed flipVerdict and its tests in test-calcs.js (see the rules below); and
  (5 Oct 2026, her third 6c hand-off) OWN TARGETS (setTargets) and STAMP DUTY BY PLACE AND BUYER (propertyTax), which
  replaced the sheet's stampDuty formula. At the default setting every figure up to a £1.5m price is unchanged. And (6 Oct
  2026, design 7a) "Any other costs" (otherUpfront) added to the flip, BTL, SA BTL, BRR to HMO and BRR to SA totals, the
  recycle price and the ledger; at £0 nothing changes. Every
  money figure is still identical to the Deal Analyser's (checked: 364 figures on the main screen, every exit, bridging
  off and on); only the colour and wording of a flip between 20% and 25% now differ. Ashley chose to put 6c and the flip
  bands into THIS app only. (Another session has since put 6c into the Deal Analyser as well, with the old flip rule;
  that repo is still read-only from here.)
- index.html: the same CSS with only the deal-feed rules deleted; the bottom tab bar has two columns instead of three;
  title "Deal Calculator"; no Deals tab, no property screen, no geo.js.
- app.js: the same code with only the deal feed deleted (Deals tab, property page, "How sure is the end value?",
  "Check this deal", the "Checking <deal>" card, notes on a property, dismiss / viewed, postcode "Nearest first").
  An empty address (#) now opens the Calculator. The note on a SAVED deal ("Add a note" under each saved deal) is kept.
  localStorage keys keep the "deal-analyser:" prefix (the app lives on its own web address, so nothing is shared).
- sw.js: same worker, own cache name (deal-calculator-vN), no geo.js in the precache list.
- manifest.webmanifest: "BRR Calculator", short name "BRR Calc" (renamed 5 Oct 2026 from Deal Calculator).
- ICONS (5 Oct 2026, Ashley's logo: white buildings, teal arrow, £ on navy; the original logo file is not in the repo):
  icon-192.png, icon-512.png (mark at 68% of the width), icon-maskable-512.png (mark at 56%, safe for Android's round and
  shaped icons), apple-touch-icon.png (180, iPhone home screen), favicon-32.png (browser tab). icon.svg was removed.
  test-app.js checks each PNG is the size the manifest says. Store listings will also want a 1024 icon (Apple) and a
  512 icon (Google), cut from the original logo the same way.
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
  `node test-verdict.js`, `node test-tax-targets.js`, `node test-other-costs.js`, `node test-browser.js` — all must
  pass. test-other-costs.js checks £1,000 of other costs adds exactly £1,000 everywhere and comes off the recycle price. test-tax-targets.js
  checks every place x buyer at the band edges (figures worked out by hand) and that every verdict and label follows the
  targets. New logic gets mutation-tested (break it on purpose,
  check a test fails, put it back). test-app.js checks the app shell: every element the code looks up exists, two tabs,
  the app name, and no deal-feed code, page parts or styles left. test-verdict.js checks Calc.dealVerdict and its edges.
  test-browser.js drives the main screen in Chromium (it serves the folder itself; skips if Playwright is missing):
  slider bubble, drag, snap tick once per entry, Set price, arrow keys, Reset, one fold open at a time, remembered exit
  and bridging, the verdict strip and its chips, Save in the panel, no action bar, Clear figures and the empty state,
  nothing behind the tab bar, 44px tap targets.
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
- Calculator primary screen = design 7a (6c "Verdict docked" with the 7a deal order, 6 Oct 2026; see "Design 7a" below) =
  design 6c "Verdict docked" (4 Oct 2026, from Ashley's hand-off bundle "Design Requirements
  Inquiry.zip" / design_handoff_calculator_6c; only phone 6c was approved; built, then rebuilt the same day from her
  REVISED bundle, which moved the verdict into the panel and dropped the fixed action bar). A restyle and rearrangement of the 3a Live
  ledger: every field, formula, slider behaviour, target and colour rule from 3a is unchanged. Top to bottom:
  - pinned answer panel (sticky, rounded bottom, 229px like the design; the design's own wording can wrap it to ~250):
    "Calculator", a Reset text button (only when one of the four figures differs from the start; puts all four back), a
    small outlined Save pill (the existing Save; 44px hit area), the exit pill (Flip / BRR → BTL / BRR → HMO / BRR → SA),
    the eyebrow, the hero, the ROI or margin chip, the money bar, "Includes £X bridging", then the VERDICT STRIP: one 40px
    row (44px hit area) with the score circle, "Good deal · hits 3 of 4 targets" and "Targets ▾"; tapping it shows a ✓/✗
    chip per target (lets: £500 a month, 50% ROI, Money back in 6 months, All cash recycled; flip: 25% margin) and
    "Hide ▴". Starts shut; open/shut is remembered for the session (sessionStorage deal-analyser:targetsOpen).
  - NO fixed action bar and NO "Compare side by side" on this screen (Ashley's revised hand-off). Only the tab bar is
    fixed; the page's bottom padding just clears it. Compare stays reachable from the other calculators ("Compare all
    strategies" bar button, "Compare every strategy for this deal →"). The other calculators keep their Save / Compare bar.
  - exit row: Flip, BTL, HMO, SA side by side, each with its headline % in its verdict colour.
  - The deal, with a "× Clear figures" pill beside the heading: it sets end value, price and refurb to 0 (shown blank;
    legal and every other figure stay; Reset brings the start figures back). One card per figure (end value, price,
    refurb, legal): typed number, 42px round −/+ and the custom slider, a sub line (drag hint, "✓ Snapped to …", or
    "Lender pays …") with the "+£X from £Y ↺" reset. The price card holds the recycle card button ("RECYCLE PRICE",
    the amount, "Pay this or less to get every pound back", a solid "Set price →" pill; the whole card sets the price)
    and stamp duty (worked out, read-only).
  - EMPTY STATE whenever end value or price is blank or 0 (Calc.dealEntered): "No deal entered yet", dashes for the hero,
    chip, exit tiles and every result tile, "Add end value and price", empty money bar with "Lender pays —", the strip
    says "Enter the deal figures · add end value and purchase price" with score "–" and no targets, recycle card and
    marker hidden. Never scored (a blank deal would otherwise show a let at 640% ROI). No NaN anywhere (test-browser.js).
  - Lender pays / Deposit cards. "How {exit} does": result tiles in 3a's order (7 for a let, 3 for the flip).
  - More detail: three fold cards, ONLY ONE OPEN AT A TIME (openFold in app.js), each with a one-line summary when closed:
    "{exit} figures" (the letting fields, 36px −/+ with a 44px hit area, custom sliders; lets only), "Your own money in",
    "Paying for it" (own cash / bridging toggle and the whole bridging block).
  - The verdict (in the strip): Calc.dealVerdict(exit, v, ps) in calc.js; ps gives the empty state. Lets score 4 targets,
    each judged as its figure is coloured: £500 a month (monthlyProfitVerdict), 50% ROI or nothing left in, money back
    in 6 months (paybackVerdict; nothing left in = 0, never = never), all cash recycled (shown cash left ≤ £0). 4 Strong,
    3 Good, 2 Borderline (amber), 0-1 Weak (bad); 3-4 good colour. Misses listed in that order. Flip: Good flip (25%+,
    green, 1/1), OK flip (20% to under 25%, amber, 0/1, chip ~ amber), Thin flip (below 20% with a profit, red), Loss-making
    flip (no profit, red). "Weak flip" is no longer used (6 Oct 2026). Lets use the bridged figures when bridging is on.
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

## Own targets, stamp duty choices, disclaimer and privacy (5 Oct 2026, third 6c hand-off)
- TARGETS: localStorage 'deal-analyser:targets' = {flip, monthly, roi, payback}; start 25 / 500 / 50 / 6. calc.js
  setTargets (clamped: flip 1-100, monthly >= 0, roi 1-1000, payback 1-24) drives flipVerdict, cashRoiVerdict,
  monthlyProfitVerdict, paybackVerdict and dealVerdict; letTargets() and targetsSummary() name them. Amber for a flip is
  the 5 points below the flip target (20-25% at the start); payback amber stays at 24 months (PAYBACK_OK). Never write 25
  / 500 / 50 / 6 anywhere else (test-tax-targets.js checks dealVerdict). Every label follows them. Entry points: the
  "Edit targets" pill in the verdict strip, "Edit targets →" under the chips, "Your targets" in the footer, a Settings row.
  The targets sheet (and the privacy sheet) draw in the settings sheet's place (class big-sheet); changes redraw the
  screen in place (redraw()).
- STAMP DUTY: localStorage 'deal-analyser:tax' = {region: eng|sco|wal, buyer: add|main|ftb}; default eng + add. calc.js
  propertyTax(price, region, buyer); stampDuty(price) uses the current setting (setTax), so every calculator, the
  recycle price, cash left at a price, payback price and max price follow it. Bands (TAX_RATES) checked on 5 Oct 2026
  against published 2026-27 rates via several secondary sources (gov.uk, Revenue Scotland and gov.wales are blocked from
  cloud sessions): SDLT 0/2/5/10/12 at 125k/250k/925k/1.5m, first-time buyer 0% to 300k and 5% to 500k (none above
  500k), +5% on the whole price for additional homes; LBTT 0/2/5/10/12 at 145k/250k/325k/750k, first-time buyer nil band
  175k, ADS 8% of the whole price; LTT main 0/6/7.5/10/12 at 225k/400k/750k/1.5m, higher 5/8.5/10/12.5/15/17 at
  180k/250k/400k/750k/1.5m, no first-time buyer relief (worked out as a main home). No extra charge for an additional
  home under £40,000 anywhere. CORRECTED from the sheet: over £1.5m the sheet charged 17% on the whole price; tax is
  per slice (£2m: £253,750, not £340,000). Re-check the bands whenever a UK, Scottish or Welsh budget changes them.
  The price card's stamp duty block is tappable (Change / Done): where is the property, who is buying, a note, "Rates as
  at October 2026. Your conveyancer confirms the final figure." The other calculators' stamp duty row and the client
  report name the basis, e.g. "Stamp duty (Scotland, main home)".
- DISCLAIMER under the Calculator ("Estimates only, not financial, tax or legal advice...") with Privacy policy and Your
  targets links. PRIVACY policy: PRIVACY in app.js (sheet) and privacy.html (standalone, precached, for store listings);
  test-app.js checks they say the same. Written for what THIS app does (no deal list, postcode search or listing links,
  unlike the design's draft). BEFORE LAUNCH Ashley must add a contact email (placeholder "[CONTACT EMAIL TO BE ADDED
  BEFORE LAUNCH]") and have the text reviewed.

## Design 7a (6 Oct 2026, fourth hand-off; supersedes 6c's input order)
- The deal, all full cards, in this order: End value (with "Lender pays X% = £…"), Refurb, Legal, ANY OTHER COSTS (new:
  otherUpfront, £0-£20,000 window at 0, slider steps £50, −/+ £100, sub line "Survey, valuation, broker: anything else
  up front", default 0), STAMP DUTY as its own card (tax-card: basis summary, amount, Change / Done, the region and buyer
  choices), then Purchase price last (slider, recycle marker and the Recycle price card). DEAL_ORDER in app.js.
- The "Edit targets" pill is gone from the verdict strip (confirmed again by Ashley on 6 Oct 2026, and the 6px gap it
  left was closed); the collapsed row is one tap target (score, verdict, ▾; 40px + 2px hit area each side = 44px) filling
  the strip. "Edit targets →" under the chips, the footer "Your targets" link and the Settings row remain
  (test-browser.js checks all three open the sheet).
- otherUpfront is in every buy calculator's totalIn (flip, btl, sabtl, hmobrr, sabrr; hmo, r2rhmo, r2rsa already had it),
  so it reaches the flip profit and margin, cash left in, ROI, payback, payback price (legalRefurb), the recycle price
  (recyclePrice no longer zeroes it), cash left at a price, Max price, and the ledger's own money (own.other). It is NOT
  the monthly "other" running cost. "Your own money in" shows an "Other costs" row when above £0; Clear figures sets it
  to 0; Reset restores the start (0); saved deals keep it; the client report lists "Other costs" after Legal costs when
  above £0. "My usual figures" already had it (Other costs up front), so a usual figure there now counts everywhere.
- YELLOW-CELL EXCEPTION (Ashley, 6 Oct 2026): otherUpfront is a yellow cell only in her HMO and R2R sheets; she allowed
  it in every buy calculator. test-calcs.js names it in NOT_YELLOW for flip, btl, sabtl, hmobrr, sabrr. No other
  exception: any further non-yellow box still fails the test.

## Ashley's rules (all kept from the Deal Analyser)
- Only the YELLOW cells in her spreadsheets are editable fields. Never add an input that is not a yellow cell (one
  named exception, approved by Ashley on 6 Oct 2026: "Any other costs", see Design 7a).
  test-calcs.js holds the yellow-cell list per calculator (YELLOW) and fails on any extra field. Max price and Bridging
  have no spreadsheet; their fields are her own design.
- STAMP DUTY IS CALCULATED ONLY: no box anywhere, Max price included; a stored stampDutyOverride is ignored. The flip has
  no selling / holding extras.
- Flip target 25% of end value to start (Calc.FLIP_TARGET; now the person's own, see Own targets). FLIP BANDS (Ashley, 5 Oct 2026), everywhere a flip margin is coloured
  (hero, % chip, exit tile, Compare, the other calculators' working, the PDF): 25%+ green ✓; 20% up to 25% amber, "an
  OK flip", ~ (Calc.FLIP_OK); below 20% red ✗, "Thin flip". Judged on the figure shown (one decimal), so
  19.96% shows 20.0% and is amber.
  FLIP VERDICT (Ashley, 6 Oct 2026; replaces the 5 Oct bands): Calc.flipVerdict(margin, target) returns 'good' at the target or more (green ✓), 'ok' from target - 5 points (Calc.flipOkFrom, never below 0%; amber ~), 'bad' below (red ✗), null for a non-number; target defaults to the saved deal-analyser:targets.flip (25 to start). Judged on the figure shown (one decimal): 24.96% shows 25.0% and is good. Titles: Good flip, OK flip (amber), Thin flip (red, with a profit), Loss-making flip (profit £0 or less, red, whatever the target). The verdict chip reads "25% margin (amber from 20%)" when ok; ok counts as a miss (0/1) but its chip is amber (dealVerdict targets carry a tone). The targets sheet's flip hint reads "Profit as a share of end value · amber from Y%" and follows the target live. app.js flipCls turns 'ok' into the amber colour class. A deal saved on the Flip exit shows its margin (✓ ~ ✗) on its saved card. Done in both apps the same day (Ashley chose both).
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

# Deal Calculator

The property deal calculators from Deal Analyser as a standalone phone app: the Live ledger (flip and
buy-refurb-refinance to BTL, HMO or SA, with or without bridging), Max price, BTL, HMO BTL, SA BTL, rent-to-rent
HMO and SA, and a bridging loan calculator, all sharing one deal so a figure typed once applies everywhere.
Compare every strategy, save deals and compare them side by side, and export a PDF client report.

Static site, no build step. Installable on a phone and works offline. Deployed to Vercel from this repo's `main` branch.

Tests: `node test.js && node test-calcs.js && node test-pdf.js && node test-sw.js && node test-app.js && node test-verdict.js && node test-tax-targets.js && node test-browser.js`

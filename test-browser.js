// Drives the Calculator's main screen (design 6c) in a real browser: the slider's bubble, drag and snap tick, Set price,
// the arrow keys, Reset, the fold cards (one open at a time), the remembered exit and bridging, the verdict strip, Save in
// the panel, Clear figures and the empty state, nothing hidden behind the panel or tab bar, and 44px tap targets.
// Needs Playwright with Chromium (installed in Claude's cloud sessions). Run: node test-browser.js
const http = require('http'), fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { try { pw = require('/opt/node-tools/node_modules/playwright'); } catch (e2) { console.log('skipped: Playwright is not installed here'); process.exit(0); } }
const { chromium } = pw;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => { const f = path.join(__dirname, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(__dirname) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'ok:   ' : 'FAIL: ') + n + (c ? '' : ' ' + (x || ''))); if (!c) fails++; };
server.listen(0, '127.0.0.1', async () => { const BASE = 'http://127.0.0.1:' + server.address().port; const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', hasTouch: false });
  await ctx.addInitScript(() => { localStorage.setItem('deal-analyser:onboarded', 'true'); if (!sessionStorage.getItem('fm')) { sessionStorage.setItem('fm', '1'); localStorage.setItem('deal-analyser:fundMode', '"mortgage"'); } window.__buzz = 0; navigator.vibrate = () => { window.__buzz++; return true; }; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/index.html#c/brr'); await p.waitForTimeout(300);
  for (const [id, v] of [['lg-endValue', 230000], ['lg-purchasePrice', 125000], ['lg-refurb', 30000], ['lg-legal', 1500]]) await p.fill('#' + id, String(v));
  await p.evaluate(() => document.activeElement.blur());
  await p.click('.exit-tile:has(.nm:text-is("BTL"))'); await p.waitForTimeout(100);
  const val = id => p.$eval('#lg-' + id, e => e.value);
  // Reopen to set the start figures to the typed deal (as opening a saved deal does): Reset and "from" use them.
  // Drag the price slider: the bubble shows while the finger is down, and the value moves relatively.
  const price = p.locator('.deal-card:has(#lg-purchasePrice)'), sl = price.locator('.scrub'); await sl.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(100); let bb = await sl.boundingBox();
  const y = bb.y + bb.height / 2, x0 = bb.x + bb.width * 0.5;
  await p.mouse.move(x0, y); await p.mouse.down(); await p.mouse.move(x0 + 30, y, { steps: 5 }); await p.waitForTimeout(50);
  ok('the value bubble shows while dragging, with the price', await price.locator('.scrub-bubble').isVisible() && /^£\d{2,3},\d{3}$/.test(await price.locator('.scrub-bubble').textContent()), await price.locator('.scrub-bubble').textContent());
  ok('the drag hint shows in the sub line', (await price.locator('.lg-sub').textContent()).includes('Slide your finger down'));
  await p.mouse.up(); await p.waitForTimeout(50);
  ok('the bubble hides when the finger lifts', !(await price.locator('.scrub-bubble').isVisible()));
  ok('the drag moved the price (relative, not a jump)', (await val('purchasePrice')) !== '125,000', await val('purchasePrice'));
  // Set price: snaps to the recycle price with a tick, glow and the snapped text.
  const buzz0 = await p.evaluate(() => window.__buzz);
  const recBox = () => price.locator('.rec-btn').evaluate(e => ({ h: e.getBoundingClientRect().height, below: e.closest('.deal-card').nextElementSibling.getBoundingClientRect().top - e.getBoundingClientRect().top, pill: getComputedStyle(e.querySelector('.rec-set')).visibility, off: e.disabled }));
  const recBefore = await recBox();
  ok('away from the recycle price the Set price pill shows and the card is a button', recBefore.pill === 'visible' && !recBefore.off, JSON.stringify(recBefore));
  await price.locator('.rec-btn').click(); await p.waitForTimeout(60);
  const rec = await price.locator('.rec-amt').textContent();
  ok('Set price sets the recycle price', '£' + (await val('purchasePrice')) === rec, (await val('purchasePrice')) + ' vs ' + rec);
  ok('Set price buzzes once', (await p.evaluate(() => window.__buzz)) === buzz0 + 1);
  ok('the thumb glows', await sl.evaluate(e => e.classList.contains('snapped')));
  ok('the sub line says it snapped to the recycle price, in the good colour', (await price.locator('.lg-sub').textContent()) === '✓ Snapped to the recycle price' && await price.locator('.lg-sub').evaluate(e => e.classList.contains('good')));
  ok('only that slider glows', (await p.locator('.scrub.snapped').count()) === 1);
  await p.waitForTimeout(1000);
  ok('the glow and text go after 900ms', !(await sl.evaluate(e => e.classList.contains('snapped'))) && (await price.locator('.lg-sub').textContent()) === '');
  // At the recycle price: the pill hides (its space kept) and the card stops being a button until the price moves.
  const recAt = await recBox();
  ok('at the recycle price the Set price pill is hidden', recAt.pill === 'hidden', JSON.stringify(recAt));
  ok('... and the card is no longer a button', recAt.off && (await price.locator('.rec-btn').getAttribute('aria-label')).endsWith('The price is set to it'));
  ok('... and the card keeps its height, so nothing below moves', recAt.h === recBefore.h && recAt.below === recBefore.below, JSON.stringify([recBefore, recAt]));
  ok('the card keeps its label, amount and helper line', (await price.locator('.rec-eye').isVisible()) && (await price.locator('.rec-amt').isVisible()) && (await price.locator('.rec-note').textContent()) === 'Pay this or less to get every pound back');
  const recN = Number(rec.replace(/[£,]/g, ''));
  await p.fill('#lg-purchasePrice', String(recN + 1)); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(60);
  const recMoved = await recBox();
  ok('£1 off the recycle price: the pill is back and the card is a button again', recMoved.pill === 'visible' && !recMoved.off && recMoved.h === recBefore.h, JSON.stringify(recMoved));
  await p.fill('#lg-purchasePrice', String(recN)); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(60);
  ok('typing the recycle price by hand hides it again', (await recBox()).pill === 'hidden' && (await recBox()).off);
  await sl.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(100);
  const px = await sl.evaluate(w => { const r = w.getBoundingClientRect(), i = w.querySelector('.scrub-in'), q = (125000 - Number(i.min)) / (Number(i.max) - Number(i.min)); return r.x + 20 + (r.width - 40) * q; });
  const pb = await sl.boundingBox(); await p.mouse.click(px, pb.y + pb.height / 2); await p.waitForTimeout(40);
  ok('the price snapping to its starting figure says so (not the recycle price)', (await val('purchasePrice')) === '125,000' && (await price.locator('.lg-sub').textContent()) === '✓ Snapped to the starting figure', await val('purchasePrice') + ' ' + await price.locator('.lg-sub').textContent());
  await p.waitForTimeout(950);
  // A slow level-0 drag across the starting figure snaps once per entry.
  const ev = p.locator('.deal-card >> nth=0'), esl = ev.locator('.scrub'); await esl.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(100); bb = await esl.boundingBox();
  const ey = bb.y + bb.height / 2, thumbX = await ev.locator('.scrub-thumb').evaluate(t => { const r = t.getBoundingClientRect(); return r.x + r.width / 2; });
  const b1 = await p.evaluate(() => window.__buzz);
  await p.mouse.move(thumbX, ey); await p.mouse.down(); await p.mouse.move(thumbX + 40, ey, { steps: 20 });
  const b2 = await p.evaluate(() => window.__buzz);
  await p.mouse.move(thumbX + 2, ey, { steps: 20 }); await p.mouse.move(thumbX + 4, ey, { steps: 4 });
  const b3 = await p.evaluate(() => window.__buzz); await p.mouse.up();
  ok('leaving the magnet does not buzz', b2 === b1, `${b1} ${b2}`);
  ok('coming back onto the starting figure buzzes once, not on every move', b3 === b2 + 1, `${b2} ${b3}`);
  ok('the end value is back on its starting figure', (await val('endValue')) === '230,000', await val('endValue'));
  // A tap that lands on a magnet ticks.
  await p.fill('#lg-endValue', '250000'); await p.evaluate(() => document.activeElement.blur());
  await esl.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(100);
  const tapX = await esl.evaluate(w => { const r = w.getBoundingClientRect(), i = w.querySelector('.scrub-in'), q = (230000 - Number(i.min)) / (Number(i.max) - Number(i.min)); return r.x + 20 + (r.width - 40) * q; });
  const bt = await p.evaluate(() => window.__buzz); const eb = await esl.boundingBox();
  await p.mouse.click(tapX + 1, eb.y + eb.height / 2); await p.waitForTimeout(40);
  ok('a tap that lands near the starting figure snaps onto it and ticks', (await val('endValue')) === '230,000' && (await p.evaluate(() => window.__buzz)) === bt + 1 && (await ev.locator('.lg-sub').textContent()) === '✓ Snapped to the starting figure', await val('endValue'));
  await p.fill('#lg-endValue', '250000'); await p.evaluate(() => document.activeElement.blur());
  // Keyboard: the hidden range steps like − and +.
  await ev.locator('.scrub-in').focus(); const before = await val('endValue'); await p.keyboard.press('ArrowRight');
  ok('the right arrow key steps the end value up by £1,000', (await val('endValue')) === '251,000', before + ' -> ' + (await val('endValue')));
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
  ok('the left arrow key steps it down', (await val('endValue')) === '249,000');
  ok('the slider is reachable by keyboard with a label', await ev.locator('.scrub-in').evaluate(e => e.type === 'range' && !!e.getAttribute('aria-label') && /£/.test(e.getAttribute('aria-valuetext') || '')));
  // Reset in the panel brings back the starting figures.
  ok('Reset shows once a figure has changed', await p.locator('.pin-reset').isVisible());
  await p.click('.pin-reset'); await p.waitForTimeout(60);
  ok('Reset puts the four figures back', (await val('endValue')) === '230,000' && !(await p.locator('.pin-reset').isVisible()), await val('endValue'));
  // Folds: one at a time, summary when closed.
  const fold = n => p.locator(`.lg-fold:has(.fold-txt b:text-is("${n}"))`);
  await fold('BTL figures').locator('.fold-head').click();
  ok('opening BTL figures shows its sliders', await fold('BTL figures').locator('.fold-body').isVisible() && (await fold('BTL figures').locator('.rent-row').count()) === 4);
  ok('More detail now holds only the letting figures (design 11a)', (await p.locator('.lg-figures .lg-fold').count()) === 1);
  await fold('BTL figures').locator('.fold-head').click(); await p.waitForTimeout(40);
  ok('a closed card shows a one-line summary', /^Monthly income £1,000 · Mortgage rate 5%$/.test(await fold('BTL figures').locator('small').textContent()), await fold('BTL figures').locator('small').textContent());
  // How you'll pay (design 11a): the switch, the tiles, the bridge figures and your own money in, in one card
  // How you'll pay: the switch, the tiles, the bridge figures, and (11 Oct 2026) your own money against the loan
  const parts = () => p.$$eval('.fund11-seg', ss => ss.map(e => e.className.replace('fund11-seg k-', '') + ':' + parseFloat(e.style.width)));
  const rowsNow = () => p.$$eval('.fund11-own .fund11-row', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')).join('|'));
  ok('11a: How you’ll pay comes straight after the purchase price, with the switch, Lender pays / Deposit and your own money in', await p.evaluate(() => { const hd = [...document.querySelectorAll('.lg-figures .lg-h')].find(x => x.textContent === 'How you’ll pay'), f = document.querySelector('.fund11'); return !!(hd && hd.previousElementSibling.querySelector('#lg-purchasePrice') && hd.nextElementSibling === f && f.querySelector('.lg-seg') && f.querySelector('#lg-ltv') && f.querySelector('#lg-depositPct') && f.querySelector('.fund11-own')); }));
  ok('own vs loan: your own money £85,500 beside the mortgage £93,750, no bridging figures', (await p.textContent('.fund11-total')) === '£85,500' && (await p.textContent('.fund11-loan .fund11-l')) === 'Mortgage' && (await p.textContent('.fund11-loanv')) === '£93,750' && !(await p.locator('.fund11 .bridge-grid').count()));
  const bar0 = await parts();
  ok('own vs loan: a two-part bar, yours then borrowed, in proportion (47.7% / 52.3%)', bar0.join() === 'own:47.7,loan:52.3', JSON.stringify(bar0));
  ok('own vs loan: the caption says it in words', (await p.textContent('.fund11-cap')) === 'Total to pay £179,250: £85,500 from you, £93,750 from the mortgage.');
  ok('11a: the breakdown starts shut', !(await p.isVisible('.fund11-rows')) && (await p.textContent('.fund11-btn')) === 'Breakdown');
  await p.click('.fund11-btn'); await p.waitForTimeout(40);
  ok('own vs loan: Breakdown adds up: every cost, the total to pay, less the mortgage, your own money; the button says Hide', (await rowsNow()) === 'Purchase price £125,000|Stamp duty £6,250|Legal costs £3,000|Refurb costs £45,000|Total to pay £179,250|Less: Mortgage (75% of the price) −£93,750|From your own money £85,500' && (await p.textContent('.fund11-btn')) === 'Hide' && (await p.textContent('.fund11-own .fund11-note')).startsWith('Your money covers the 25% deposit (£31,250)'), await rowsNow());
  // Design 2b (Ashley, 15 Oct 2026): Lender pays and Deposit are one slider
  ok('2b: one linked slider: Lender pays 75% (= £93,750 of the price) and Deposit 25% (= £31,250 from you)', (await p.inputValue('#lg-ltv')) === '75' && (await p.inputValue('#lg-depositPct')) === '25'
    && (await p.$$eval('.lk2b-amt span', ss => ss.map(x => x.textContent).join('|'))) === '= £93,750 of the price|= £31,250 from you' && (await p.locator('.lk2b .scrub').count()) === 1 && (await p.locator('.lk2b .nudge').count()) === 2);
  await p.locator('.lk2b .nudge >> nth=1').click(); await p.waitForTimeout(60);
  ok('2b: + moves the lender to 76% and the deposit to 24% together; both are saved', (await p.inputValue('#lg-ltv')) === '76' && (await p.inputValue('#lg-depositPct')) === '24' && (await p.textContent('.lk2b-amt .amb')) === '= £30,000 from you'
    && (await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('deal-analyser:deal')); return d.ltv + '|' + d.depositPct; })) === '76|24');
  await p.fill('#lg-depositPct', '20'); await p.waitForTimeout(1000);   // past any snap message on the end value line
  ok('2b: typing a 20% deposit makes the lender 80%, and the refinance follows (£184,000)', (await p.inputValue('#lg-ltv')) === '80' && (await p.textContent('.lk2b-amt .acc')) === '= £100,000 of the price' && (await p.textContent('.deal-card:has(#lg-endValue) .lg-sub')).includes('Lender pays 80% = £184,000'), [await p.inputValue('#lg-ltv'), await p.textContent('.lk2b-amt .acc'), await p.textContent('.deal-card:has(#lg-endValue) .lg-sub')].join('|'));
  await p.fill('#lg-ltv', '75'); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(60);
  ok('2b: back to 75 / 25', (await p.inputValue('#lg-depositPct')) === '25' && (await p.textContent('.fund11-total')) === '£85,500');
  ok('1b: the switch reads No funding | Mortgage | Bridging', (await p.$$eval('.fund11 .lg-seg button', bs => bs.map(b => b.textContent).join('|'))) === 'No funding|Mortgage|Bridging');
  await p.click('.lg-seg button:text-is("Bridging")'); await p.waitForTimeout(100);
  // Design 1b (14 Oct 2026) with Ashley's choices of 15 Oct: six figures; the net loan starts at 75% of the price
  const bIds = ['bridgeNet', 'bridgeRatePct', 'bridgeMonths', 'bridgeArrangePct', 'bridgeExitPct', 'bridgeLegal', 'bridgeValuation', 'bridgeBroker'];
  ok('1b: bridging on: eight rows (net loan, interest, months, arrangement, exit, legal, valuation, broker) with the starting figures; no Lender pays / Deposit', (await p.$$eval('.b1-row label', ls => ls.map(l => l.textContent).join('|'))) === 'Net loan|Interest|Months|Arrangement fee|Exit fee|Legal fees|Valuation fee|Broker fee'
    && (await Promise.all(bIds.map(id => p.inputValue('#lg-' + id)))).join('|') === '93,750|0.85|9|2|1|1,200|350|1,000' && !(await p.locator('#lg-ltv').count()) && !(await p.locator('#lg-depositPct').count()) && (await p.locator('.b1-row .scrub').count()) === 8 && (await p.locator('.b1-row .nudge').count()) === 16);
  ok('1b: each row says what it is (75% of the price, £797 a month, the months, paid upfront)', (await p.$$eval('.b1-sub', ss => ss.map(x => x.textContent).join('|'))) === 'The cash sent at completion: 75% of the price until you change it|Per month, compounding. £797 in the first month, all rolled up and repaid at the end|How long you’ll have the bridge. Interest is charged for each month|Paid upfront: £1,875 (a share of the net loan)|Paid when you repay: £938 (a share of the net loan)|Paid upfront|Paid upfront|Paid upfront');
  ok('1b: the gross loan is worked out: £93,750 + 9 months of compounding interest (£7,421) = £101,171', (await p.textContent('.b1-gross-r b')) === '£101,171' && (await p.textContent('.b1-gross small')) === '£93,750 + 9 months of interest (£7,421)' && (await p.textContent('.b1-wo')) === 'Worked out');
  ok('1b: the cost of the bridge £12,783 in amber, 13.6% of the net loan; lender sends / first month / you repay (gross + the £938 exit fee)', (await p.textContent('.b1-cost')) === '£12,783' && (await p.textContent('.b1-pct')) === '13.6% of the net loan, over 9 months' && (await p.$$eval('.b1-three b', bs => bs.map(b => b.textContent).join('|'))) === '£93,750|£797|£102,108');
  const bar1 = await p.$$eval('.fund11-own .fund11-seg', ss => ss.map(e => e.className.replace('fund11-seg ', '')).join());
  ok('1b: your own money £89,925 (price less the net loan, the costs and the four upfront fees) beside the bridging loan £93,750', (await p.textContent('.fund11-total')) === '£89,925' && (await p.textContent('.fund11-loan .fund11-l')) === 'Bridging loan' && (await p.textContent('.fund11-loanv')) === '£93,750');
  ok('1b: the bar shows what your money pays for, bridge fees last; the caption says the interest is repaid from the refinance', bar1 === 'sg-deposit,sg-sdlt,sg-legal,sg-refurb,sg-bridge' && (await p.textContent('.fund11-cap')) === 'The rolled-up interest (£7,421) is repaid from the refinance.', bar1);
  ok('1b: Breakdown adds up: the four fees, the total, less the net loan, your own money; the gross and the exit fee are repaid at the end', (await rowsNow()).endsWith('Bridge arrangement fee £1,875|Bridge legal fees £1,200|Bridge valuation fee £350|Bridge broker fee £1,000|Total to pay £183,675|Less: Bridging loan (the net the lender sends) −£93,750|From your own money £89,925')
    && (await p.textContent('.fund11-own .fund11-note')) === 'At the end you repay £102,108 (the net plus £7,421 rolled-up interest and a £938 exit fee), out of the refinance or the sale.', await rowsNow());
  ok('1b: the pinned panel includes the bridge’s cost', (await p.textContent('.pin-tag')) === 'Includes £12,783 bridging');
  await p.click('.b1-fold .fold-head'); await p.waitForTimeout(40);
  ok('1b: How it adds up opens (and the letting figures fold shuts: one at a time)', await p.isVisible('.b1-fold .fold-body') && !(await fold('BTL figures').locator('.fold-body').isVisible()) && (await p.textContent('.b1-fold small')) === 'Interest £7,421 · fees £5,363'
    && (await p.$$eval('.b1-fold .lg-stat', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')).join('|'))) === 'Net loan £93,750|Interest (0.85% a month, compounding, × 9 months on £93,750) £7,421|Gross loan (net + interest) £101,171|Exit fee (paid when you repay) £938|You repay at the end £102,108|Arrangement fee £1,875|Legal fees £1,200|Valuation fee £350|Broker fee £1,000|Total cost of the bridge (interest + fees) £12,783|Price less the net loan (your deposit) £31,250');
  await p.click('.b1-fold .fold-head'); await p.waitForTimeout(40);
  await p.locator('.b1-row:has(#lg-bridgeRatePct) .nudge >> nth=1').click(); await p.waitForTimeout(60);
  ok('1b: + on the interest steps by 0.01 (0.86%), not 0.05, so rates like 0.87 and 0.88 are one tap apart', (await p.inputValue('#lg-bridgeRatePct')) === '0.86' && (await p.textContent('.b1-row:has(#lg-bridgeRatePct) .b1-sub')).startsWith('Per month, compounding. £806 in the first month'), await p.inputValue('#lg-bridgeRatePct'));
  await p.click('.pin-reset'); await p.waitForTimeout(60);
  await p.locator('.b1-row:has(#lg-bridgeMonths) .nudge >> nth=1').click(); await p.waitForTimeout(60);
  ok('1b: + on months: 10 months of interest (£8,281), and the cost follows (£13,643)', (await p.inputValue('#lg-bridgeMonths')) === '10' && (await p.textContent('.b1-gross small')) === '£93,750 + 10 months of interest (£8,281)' && (await p.textContent('.b1-cost')) === '£13,643');
  await p.click('.pin-reset'); await p.waitForTimeout(60);
  await p.locator('.b1-row:has(#lg-bridgeNet) .nudge >> nth=1').click(); await p.waitForTimeout(60);
  ok('1b: + on the net loan steps to the next £500 (£94,500): it is now yours (no longer 75% of the price), everything follows, and Reset appears', (await p.inputValue('#lg-bridgeNet')) === '94,500' && (await p.textContent('.b1-gross-r b')) === '£101,980' && (await p.textContent('.fund11-total')) === '£89,190' && await p.isVisible('.pin-reset')
    && (await p.textContent('.b1-row:has(#lg-bridgeNet) .b1-sub')) === 'The cash sent at completion. Covers 76% of the price', [await p.inputValue('#lg-bridgeNet'), await p.textContent('.b1-gross-r b'), await p.textContent('.fund11-total')].join());
  await p.click('.pin-reset'); await p.waitForTimeout(60);
  ok('1b: Reset puts the bridge figures back as they were (the net loan follows the price again)', (await p.inputValue('#lg-bridgeNet')) === '93,750' && (await p.inputValue('#lg-bridgeMonths')) === '9' && !(await p.isVisible('.pin-reset'))
    && (await p.evaluate(() => !('bridgeNet' in JSON.parse(localStorage.getItem('deal-analyser:deal')) || 'bridgeMonths' in JSON.parse(localStorage.getItem('deal-analyser:deal'))))));
  await p.fill('#lg-purchasePrice', '130000'); await p.waitForTimeout(60);
  ok('1b: an untyped net loan follows the price (75% of £130,000 = £97,500)', (await p.inputValue('#lg-bridgeNet')) === '97,500');
  await p.fill('#lg-purchasePrice', '125000'); await p.waitForTimeout(60);
  await p.fill('#lg-bridgeNet', '0'); await p.fill('#lg-bridgeRatePct', '4'); await p.waitForTimeout(80);
  ok('1b: messages for a net loan of £0 and a rate above 3% a month; no NaN', (await p.$$eval('.b1-msg', ms => ms.map(m => m.textContent).join('|'))) === 'Enter the net loan: the cash the lender sends at completion.|Above 3% a month is very high for a bridge: check it is per month, not per year.' && (await p.textContent('.b1-pct')) === 'Enter the net loan' && !/NaN|Infinity|undefined/.test(await p.textContent('#v-home')));
  await p.fill('#lg-bridgeNet', '90000'); await p.fill('#lg-bridgeRatePct', '0.85'); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(80);
  ok('1b: the bridge figures are kept with the deal', (await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('deal-analyser:deal')); return d.bridgeNet + '|' + d.bridgeRatePct; })) == '90000|0.85');
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('deal-analyser:deal')); delete d.bridgeNet; localStorage.setItem('deal-analyser:deal', JSON.stringify(d)); });
  for (const old of ['#bridge', '#c/bridging']) {
    await p.goto(BASE + '/index.html' + old); await p.waitForTimeout(250);
    ok('1b: the old ' + old + ' address lands on the Calculator', (await p.url()).endsWith('#c/brr') && await p.isVisible('.fund11'));
  }
  ok('11a: the breakdown stays open across the redraw (kept for the session)', await p.isVisible('.fund11-rows'));
  ok('11a: the pinned panel says it includes the bridging', /^Includes £[\d,]+ bridging$/.test(await p.textContent('.pin-tag')));
  await p.reload(); await p.waitForTimeout(300);
  ok('11a: the breakdown is still open after a reload (kept for the session)', await p.isVisible('.fund11-rows') && (await p.textContent('.fund11-btn')) === 'Hide');
  await p.click('.fund11-btn'); await p.waitForTimeout(40);
  // A rent nudge and slider in the open let fold
  if (!(await fold('BTL figures').locator('.fold-body').isVisible())) await fold('BTL figures').locator('.fold-head').click();
  const rent = await p.$eval('#lg-monthlyRent', e => e.value); await fold('BTL figures').locator('.nudge >> nth=1').click(); await p.waitForTimeout(50);
  ok('a rent + nudge steps the rent by £25', Number(await p.$eval('#lg-monthlyRent', e => e.value)) === Number(rent) + 25);
  // Exit switch keeps the remembered choice
  await p.click('.exit-tile:has(.nm:text-is("SA"))'); await p.waitForTimeout(80);
  ok('switching exit relabels the pill, heading and fold', (await p.locator('.pin-exit').textContent()) === 'BRR → SA' && (await p.locator('.lg-results .lg-h').textContent()) === 'How SA does' && (await fold('SA figures').count()) === 1);
  await p.reload(); await p.waitForTimeout(300);
  ok('the exit and bridging choice are remembered', (await p.locator('.pin-exit').textContent()) === 'BRR → SA' && (await p.locator('.pin-tag').isVisible()));
  // Tap targets on this screen
  const small = await p.evaluate(() => [...document.querySelectorAll('#v-home button, #v-home input:not(.scrub-in), #sticky-bar button')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e, '::after'); let w = r.width, h = r.height; if (cs.content !== 'none' && cs.position === 'absolute') { const i = parseFloat(cs.top) || 0; w -= 2 * i; h -= 2 * i; } return { t: (e.textContent || e.id || e.className).slice(0, 30), w: Math.round(w), h: Math.round(h) }; }).filter(x => x.h < 44));
  ok('every tap target is 44px tall or more', !small.length, JSON.stringify(small));
  // ---- the revised panel: verdict strip, Save, no fixed action bar ----
  await p.evaluate(() => { sessionStorage.clear(); scrollTo(0, 0); }); await p.reload(); await p.waitForTimeout(300);
  ok('no fixed Save / Compare bar on this screen, and no Compare button', !(await p.isVisible('#sticky-bar')) && !(await p.locator('#v-home button:has-text("Compare side by side")').count()));
  ok('the collapsed panel is no taller than the design (229px)', (await p.evaluate(() => document.querySelector('.pin').offsetHeight)) <= 230 || (await p.isVisible('.pin-tag')), String(await p.evaluate(() => document.querySelector('.pin').offsetHeight)));
  ok('the verdict strip starts shut, saying "Targets ▾"', (await p.locator('.vs-lab').textContent()) === 'Targets ▾' && !(await p.isVisible('.vs-chips')));
  await p.click('.vs-row'); await p.waitForTimeout(50);
  const chips = await p.locator('.vs-chip').allTextContents();
  ok('tapping it shows a ✓ or ✗ chip for each of the four targets, and "Hide ▴"', chips.length === 4 && chips.every(c => /^[✓✗]/.test(c)) && (await p.locator('.vs-lab').textContent()) === 'Hide ▴', JSON.stringify(chips));
  ok('each chip tick or cross is readable (not the same colour as its circle)', await p.evaluate(() => [...document.querySelectorAll('.vs-mark')].every(m => { const cs = getComputedStyle(m); return cs.color !== cs.backgroundColor; })));
  ok('the chips agree with the score', (await p.locator('.vs-score').textContent()) === chips.filter(c => c[0] === '✓').length + '/4');
  ok('chip labels are never cut off', await p.evaluate(() => [...document.querySelectorAll('.vs-chip span:last-child')].every(e => e.scrollWidth <= e.clientWidth + 1 && getComputedStyle(e).textOverflow !== 'ellipsis')));
  await p.click('.exit-tile:has(.nm:text-is("Flip"))'); await p.waitForTimeout(80);
  ok('it stays open when the exit changes (remembered), and a flip has one chip: 25% margin', await p.isVisible('.vs-chips') && /25% margin/.test((await p.locator('.vs-chip').allTextContents()).join()) && (await p.locator('.vs-chip').count()) === 1);
  await p.reload(); await p.waitForTimeout(300);
  ok('open or shut is remembered for the session', await p.isVisible('.vs-chips'));
  await p.click('.vs-row'); await p.waitForTimeout(50); ok('tapping again shuts it', !(await p.isVisible('.vs-chips')));
  await p.click('.exit-tile:has(.nm:text-is("BTL"))'); await p.waitForTimeout(80);
  let saidSaved = false; const onDialog = d => { if (d.type() === 'prompt') d.accept('Panel save test'); else { saidSaved = /Saved/.test(d.message()); d.accept(); p.off('dialog', onDialog); } }; p.on('dialog', onDialog);
  await p.click('.pin-save'); await p.waitForTimeout(150);
  ok('Save in the panel saves the deal', saidSaved && (await p.evaluate(() => JSON.parse(localStorage.getItem('deal-analyser:deals') || '[]').some(d => d.name === 'Panel save test' && d.letting === 'btl'))));
  // ---- Clear figures and the empty state ----
  await p.click('.vs-row'); await p.waitForTimeout(30);                      // targets open, then clear: no empty chip area left behind
  await p.click('.clear-pill'); await p.waitForTimeout(100);
  ok('Clear figures empties end value, price and refurb, and leaves legal', (await val('endValue')) === '' && (await val('purchasePrice')) === '' && (await val('refurb')) === '' && (await val('legal')) !== '', [await val('endValue'), await val('purchasePrice'), await val('refurb'), await val('legal')].join('|'));
  ok('empty state: "No deal entered yet", dashes, "Add end value and price"', (await p.locator('.pin-eye').textContent()) === 'No deal entered yet' && (await p.locator('.pin-fig').textContent()) === '—' && (await p.locator('.pin-side-fig').textContent()) === '—' && (await p.locator('.pin-side-cap').textContent()) === 'Add end value and price');
  ok('empty state: money bar empty, "Lender pays —"', (await p.locator('.pin-caps span >> nth=0').textContent()) === 'Lender pays —' && (await p.evaluate(() => [...document.querySelectorAll('.pin-bar i')].every(i => i.style.width === '0%'))));
  ok('empty state: the strip asks for the figures, score "–", no targets', (await p.locator('.vs-score').textContent()) === '–' && (await p.locator('.vs-txt').textContent()) === 'Enter the deal figures · add end value and purchase price' && !(await p.isVisible('.vs-lab')) && !(await p.locator('.vs-chip').count()));
  ok('empty state: every exit tile and result tile shows a dash', (await p.locator('.exit-tile .big').allTextContents()).every(t => t === '—') && (await p.locator('.lg-tile b').allTextContents()).every(t => t === '—'));
  ok('empty state: the recycle card and marker are hidden', !(await p.isVisible('.rec-btn')) && !(await p.isVisible('.rec-mark')));
  ok('empty state: no target chips or empty chip area, even with the targets left open', !(await p.isVisible('.vs-chips')) && !(await p.locator('.vs-chip').count()));
  ok('empty state: no NaN, undefined or Infinity anywhere', !(await p.evaluate(() => /NaN|undefined|Infinity/.test(document.body.innerText + [...document.querySelectorAll('input')].map(i => i.value).join(' ')))));
  await p.fill('#lg-endValue', '230000'); await p.evaluate(() => document.activeElement.blur());
  ok('one figure is not enough: still the empty state, and no recycle price offered', (await p.locator('.pin-eye').textContent()) === 'No deal entered yet' && !(await p.isVisible('.rec-btn')));
  await p.click('.pin-reset'); await p.waitForTimeout(80);
  ok('Reset brings the starting figures back and the deal is scored again', (await val('purchasePrice')) !== '' && /\d\/4/.test(await p.locator('.vs-score').textContent()));
  // ---- nothing hidden behind the panel or the tab bar ----
  await p.evaluate(() => scrollTo(0, 1e6)); await p.waitForTimeout(80);
  const clear = await p.evaluate(() => { const last = [...document.querySelectorAll('#v-home > *')].filter(e => e.offsetParent).pop().getBoundingClientRect().bottom; return { last, tabs: document.getElementById('tabs').getBoundingClientRect().top }; });
  ok('the last thing on the page clears the tab bar', clear.last <= clear.tabs, JSON.stringify(clear));
  await p.evaluate(() => { location.hash = '#c/recycle'; }); await p.waitForTimeout(150);
  ok('Max price keeps Save and Use as my offer in its bar', await p.isVisible('#sticky-bar') && (await p.$$eval('#sticky-bar button', bs => bs.map(b => b.textContent).join())) === 'Save,Use as my offer');
  await p.evaluate(() => { location.hash = '#c/btl'; }); await p.waitForTimeout(150);
  ok('the other calculators: Save is the one full-width button (Compare all strategies is gone)', (await p.$$eval('#sticky-bar button', bs => bs.map(b => b.className + ':' + b.textContent).join())) === 'primary:Save' && Math.abs((await p.$eval('#sticky-bar button', e => e.getBoundingClientRect().width)) - 358) < 2 && !(await p.locator('text=Compare every strategy').count()));
  // ---- your targets ----
  await p.evaluate(() => { location.hash = '#c/brr'; }); await p.waitForTimeout(200);
  await p.click('.exit-tile:has(.nm:text-is("BTL"))'); await p.waitForTimeout(80);
  ok('there is no Edit targets pill on the strip any more (design 7a)', !(await p.locator('.vs-edit').count()));
  if (!(await p.isVisible('.vs-chips'))) await p.click('.vs-row');
  await p.click('.vs-link'); await p.waitForTimeout(80);
  ok('"Edit targets →" under the chips opens the targets sheet with four rows', await p.isVisible('.big-sheet') && (await p.locator('.tg-row').count()) === 4 && !(await p.isVisible('.tg-back')));
  await p.locator('.tg-row >> nth=1 >> .nudge >> nth=0').click(); await p.locator('.tg-row >> nth=1 >> .nudge >> nth=0').click(); await p.waitForTimeout(60);
  ok('two taps on − take the monthly target from £500 to £400, saved on the phone', (await p.$eval('#tg-monthly', e => e.value)) === '400' && JSON.parse(await p.evaluate(() => localStorage.getItem('deal-analyser:targets'))).monthly === 400);
  ok('the screen follows at once: "Monthly profit (target £400)" and the summary', (await p.locator('.lg-tile span:text-matches("^Monthly profit")').textContent()) === 'Monthly profit (target £400)' && (await p.locator('.vs-sum').textContent()) === '25% flip · £400/mo · 50% ROI · 6 mo back');
  ok('"Back to 25% · £500 · 50% · 6 mo" shows once something has changed', await p.isVisible('.tg-back') && (await p.locator('.tg-back').textContent()) === 'Back to 25% · £500 · 50% · 6 mo');
  await p.fill('#tg-flip', '30'); await p.waitForTimeout(60);
  ok('typing a flip target of 30% is used straight away', (await p.evaluate(() => Calc.targets().flip)) === 30);
  await p.click('.bs-done'); await p.waitForTimeout(60);
  ok('Done closes the sheet', !(await p.isVisible('.big-sheet')));
  await p.reload(); await p.waitForTimeout(300);
  ok('the targets are still there after reopening the app', JSON.stringify(await p.evaluate(() => Calc.targets())) === '{"flip":30,"monthly":400,"roi":50,"payback":6}');
  await p.click('#gear'); await p.waitForTimeout(60);
  ok('Settings has Your targets and Privacy policy (design 9a)', (await p.locator('#settings-sheet .st9-link b').allTextContents()).join('|') === 'Your targets|My usual figures|Privacy policy');
  await p.click('#settings-sheet .st9-link:has-text("Your targets")'); await p.waitForTimeout(60);
  await p.click('.tg-back'); await p.waitForTimeout(60);
  ok('Back to the starting targets', JSON.stringify(await p.evaluate(() => Calc.targets())) === '{"flip":25,"monthly":500,"roi":50,"payback":6}' && !(await p.isVisible('.tg-back')));
  await p.click('#settings-overlay', { position: { x: 20, y: 20 } }); await p.waitForTimeout(60);
  ok('tapping the dimmed background closes the sheet', !(await p.isVisible('.big-sheet')));
  // ---- stamp duty: where and who ----
  const sd = () => p.locator('.tax-r b').textContent();
  ok('stamp duty starts as SDLT, England & NI, additional property, £6,250 on £125,000', (await p.locator('.tax-l small').textContent()) === 'SDLT · England & NI · Additional property' && (await sd()) === '£6,250' && (await p.locator('.tax-chev').textContent()) === 'Change');
  await p.click('.tax-head'); await p.waitForTimeout(40);
  await p.click('.tax-buyers button:has-text("Main home")'); await p.waitForTimeout(60);
  ok('main home in England: no tax on £125,000, and the verdict and figures move with it', (await sd()) === '£0' && (await p.locator('.tax-l small').textContent()) === 'SDLT · England & NI · Main home');
  await p.click('.tax-seg button:has-text("Scotland")'); await p.click('.tax-buyers button:has-text("Additional property")'); await p.waitForTimeout(60);
  ok('Scotland, additional property: LBTT plus 8% ADS = £10,000', (await sd()) === '£10,000');
  await p.click('.tax-buyers button:has-text("First-time buyer")'); await p.click('.tax-seg button:has-text("Wales")'); await p.waitForTimeout(60);
  ok('Wales: first-time buyer greyed out, worked out as a main home (£0 on £125,000)', await p.locator('.tax-buyers button:has-text("First-time buyer")').isDisabled() && (await sd()) === '£0' && (await p.locator('.tax-note').textContent()).includes('no first-time buyer relief'));
  await p.reload(); await p.waitForTimeout(300); await p.click('.tax-head'); await p.waitForTimeout(40);
  ok('the choice is kept after reopening', JSON.parse(await p.evaluate(() => localStorage.getItem('deal-analyser:tax'))).region === 'wal' && (await p.locator('.tax-seg button[aria-pressed=true]').textContent()) === 'Wales');
  await p.click('.tax-seg button:has-text("England & NI")'); await p.click('.tax-buyers button:has-text("Additional property")'); await p.waitForTimeout(60);
  ok('and back to England & NI, additional property', (await sd()) === '£6,250');
  // ---- disclaimer and privacy ----
  await p.evaluate(() => scrollTo(0, 1e6)); await p.waitForTimeout(60);
  ok('the disclaimer is under the page', (await p.locator('.legal-foot').textContent()).startsWith('Estimates only, not financial, tax or legal advice.'));
  await p.click('.legal-links button:has-text("Privacy policy")'); await p.waitForTimeout(60);
  ok('Privacy policy opens with its seven headings', (await p.locator('.bs-h').count()) === 7 && (await p.locator('.big-sheet h2').textContent()) === 'Privacy policy');
  const sheetTaps = await p.evaluate(() => [...document.querySelectorAll('#settings-sheet button')].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().height)).filter(h => h < 44));
  ok('sheet buttons are 44px tall or more', !sheetTaps.length, JSON.stringify(sheetTaps));
  await p.click('.bs-done');
  await p.goto(BASE + '/privacy.html'); await p.waitForTimeout(150);
  ok('the standalone privacy page opens with the same seven headings', (await p.locator('h2').count()) === 7 && (await p.locator('h1').textContent()) === 'Privacy policy');
  // ---- the verdict strip without the Edit targets pill: one tap target, and three ways to the targets sheet ----
  await p.goto(BASE + '/index.html#c/brr'); await p.waitForTimeout(300);
  await p.evaluate(() => { sessionStorage.removeItem('deal-analyser:targetsOpen'); }); await p.reload(); await p.waitForTimeout(300);
  ok('the collapsed row holds only the score, the verdict and the ▾ toggle', (await p.locator('.vs-head').evaluate(h => [...h.querySelectorAll('button')].length)) === 1 && (await p.locator('.vs-head .vs-score, .vs-head .vs-txt, .vs-head .vs-lab').count()) === 3 && !(await p.locator('.vs-edit').count()));
  const rowBox = await p.locator('.vs-row').boundingBox(), headBox = await p.locator('.vs-head').boundingBox();
  ok('the row fills the whole strip width (no gap left by the pill)', Math.abs(rowBox.width - headBox.width) < 1, rowBox.width + ' vs ' + headBox.width);
  ok('the row is one tap target at least 44px tall', (await p.locator('.vs-row').evaluate(r => r.getBoundingClientRect().height - 2 * parseFloat(getComputedStyle(r, '::after').top))) >= 44);
  await p.click('.vs-score'); await p.waitForTimeout(40);
  const openedFromScore = await p.isVisible('.vs-chips');
  await p.click('.vs-txt'); await p.waitForTimeout(40);
  ok('tapping anywhere on the row opens the strip, and again closes it', openedFromScore && !(await p.isVisible('.vs-chips')));
  const opens = {};
  await p.click('.vs-lab'); await p.click('.vs-link'); await p.waitForTimeout(60); opens.strip = await p.isVisible('.big-sheet .tg-row'); await p.click('.bs-done');
  await p.evaluate(() => scrollTo(0, 1e6)); await p.click('.legal-links button:has-text("Your targets")'); await p.waitForTimeout(60); opens.footer = await p.isVisible('.big-sheet .tg-row'); await p.click('.bs-done');
  await p.evaluate(() => scrollTo(0, 0)); await p.click('#gear'); await p.click('#settings-sheet .st9-link:has-text("Your targets")'); await p.waitForTimeout(60); opens.settings = await p.isVisible('.big-sheet .tg-row'); await p.click('.bs-done');
  ok('the targets sheet opens from "Edit targets →", the footer and Settings', opens.strip && opens.footer && opens.settings, JSON.stringify(opens));

  // ---- design 7a: the order of the deal and "Any other costs" ----
  await p.goto(BASE + '/index.html#c/brr'); await p.waitForTimeout(300);
  const order = await p.evaluate(() => [...document.querySelectorAll('#v-home .lg-figures > .lg-card:not(.fund11)')].map(c => c.classList.contains('tax-card') ? 'stamp duty' : (c.querySelector('.lg-label') || {}).textContent));
  ok('The deal reads: End value, Refurb, Legal, Any other costs, Stamp duty (its own card), Purchase price', order.join(' | ') === 'End value (GDV) | Refurb costs | Legal costs | Any other costs | stamp duty | Purchase price', order.join(' | '));
  ok('the purchase price card no longer holds the stamp duty', !(await p.locator('.deal-card:has(#lg-purchasePrice) .tax-block').count()) && (await p.locator('.deal-card:has(#lg-purchasePrice) .rec-btn').count()) === 1);
  const oc = p.locator('.deal-card:has(#lg-otherUpfront)');
  ok('Any other costs starts at £0 with its own explanation', (await p.$eval('#lg-otherUpfront', e => e.value)) === '' && (await oc.locator('.lg-sub').textContent()) === 'Survey, valuation, broker: anything else up front');
  await oc.locator('.nudge >> nth=1').click(); await p.waitForTimeout(40);
  ok('+ adds £100', (await p.$eval('#lg-otherUpfront', e => e.value)) === '100');
  await p.fill('#lg-otherUpfront', '1000'); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(60);
  if (!(await p.isVisible('.exit-tile.on:has(.nm:text-is("Flip"))'))) { await p.click('.exit-tile:has(.nm:text-is("Flip"))'); await p.waitForTimeout(80); }
  if (!(await p.isVisible('.fund11-rows'))) { await p.click('.fund11-btn'); await p.waitForTimeout(40); }
  ok('"Your own money in" counts Other costs £1,000: its own row after the refurb, and £1,000 more from you', (await p.$$eval('.fund11-own .fund11-row span', ss => ss.map(x => x.textContent).join('|'))).includes('Legal costs|Refurb costs|Other costs|') && (await p.textContent('.fund11-own .fund11-row:has(span:text-is("Other costs")) b')) === '£1,000', await p.$$eval('.fund11-own .fund11-row span', ss => ss.map(x => x.textContent).join('|')));
  await p.click('.clear-pill'); await p.waitForTimeout(60);
  ok('Clear figures empties any other costs too', (await p.$eval('#lg-otherUpfront', e => e.value)) === '');
  await p.click('.pin-reset'); await p.waitForTimeout(60);
  ok('Reset puts it back to its starting £0', (await p.$eval('#lg-otherUpfront', e => e.value)) === '');
  // ---- design 8a: Figures | Results under the exit tiles ----
  {
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await c2.addInitScript(() => { localStorage.setItem('deal-analyser:onboarded', 'true'); if (!sessionStorage.getItem('fm')) { sessionStorage.setItem('fm', '1'); localStorage.setItem('deal-analyser:fundMode', '"mortgage"'); } });
    const q = await c2.newPage(); q.on('pageerror', e => errs.push(e.message));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(300);
    for (const [id, v] of [['lg-endValue', 230000], ['lg-purchasePrice', 125000], ['lg-refurb', 45000], ['lg-legal', 3000]]) await q.fill('#' + id, String(v));
    await q.evaluate(() => document.activeElement.blur()); await q.click('.exit-tile:has(.nm:text-is("BTL"))'); await q.waitForTimeout(100);
    const pressed = () => q.$$eval('.lg-switch button', bs => bs.map(x => x.textContent + ':' + x.getAttribute('aria-pressed')).join());
    ok('8a: the switch sits right under the exit tiles and starts on Figures', await q.evaluate(() => document.querySelector('.lg-exits').nextElementSibling.classList.contains('lg-switch')) && (await pressed()) === 'Figures:true,Results:false', await pressed());
    ok('8a: Figures holds The deal, its cards, Lender pays / Deposit and More detail; Results is hidden', await q.evaluate(() => { const f = document.querySelector('.lg-figures'); return !!(f.querySelector('.clear-pill') && f.querySelector('#lg-endValue') && f.querySelector('.tax-card') && f.querySelector('.rec-btn') && f.querySelector('.lk2b') && f.querySelector('.fund11') && f.querySelectorAll('.lg-fold').length === 1) && document.querySelector('.lg-results').hidden; }));
    ok('8a: each switch button is at least 44px tall', (await q.$$eval('.lg-switch button', bs => bs.every(x => x.getBoundingClientRect().height >= 44))));
    await q.click('.lg-switch button:text-is("Results")'); await q.waitForTimeout(100);
    const sw = await q.evaluate(() => ({ sw: document.querySelector('.lg-switch').getBoundingClientRect().top, pin: document.querySelector('.pin').getBoundingClientRect().bottom }));
    ok('8a: Results shows How BTL does, the 7 tiles, Your own money in and Change the figures; Figures is hidden', (await q.isVisible('.lg-results .lg-h:text-is("How BTL does")')) && (await q.locator('.lg-results .lg-tile').count()) === 7 && (await q.isVisible('.own-card')) && (await q.isVisible('.lg-back')) && !(await q.isVisible('#lg-endValue')));
    ok('8a: switching puts the switch just under the pinned panel', sw.sw >= sw.pin && sw.sw - sw.pin <= 16, JSON.stringify(sw));
    ok('8a: Results tiles are larger (22px figures, 14px padding)', await q.$eval('.lg-results .lg-tile', t => getComputedStyle(t.querySelector('b')).fontSize === '22px' && getComputedStyle(t).paddingTop === '14px'));
    const ownCard = await q.$$eval('.own-card .fund11-row', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')).join('|'));
    ok('8a: the Results own money card adds up the same way: costs, total, less the mortgage, your own money', ownCard === 'Purchase price £125,000|Stamp duty £6,250|Legal costs £3,000|Refurb costs £45,000|Total to pay £179,250|Less: Mortgage (75% of the price) −£93,750|From your own money £85,500', ownCard);
    ok('8a: ... with the same figures as the How you’ll pay card', (await q.textContent('.own-card-head small')) === '£85,500 yours · £93,750 borrowed' && (await q.textContent('.fund11-total')) === '£85,500');
    // a change on Figures shows straight away in Results and the panel
    const before = await q.textContent('.lg-results .lg-tile >> nth=4');
    await q.click('.lg-switch button:text-is("Figures")'); await q.fill('#lg-purchasePrice', '115000'); await q.evaluate(() => document.activeElement.blur()); await q.waitForTimeout(80);
    await q.click('.lg-switch button:text-is("Results")'); await q.waitForTimeout(80);
    ok('8a: a figure changed under Figures shows at once in Results and in the own money card', (await q.textContent('.lg-results .lg-tile >> nth=4')) !== before && (await q.textContent('.own-card-head small')).includes('£86,250 borrowed'), await q.textContent('.own-card-head small'));
    // the exit tiles stay above the switch: changing strategy keeps Results
    await q.click('.exit-tile:has(.nm:text-is("Flip"))'); await q.waitForTimeout(100);
    ok('8a: changing exit keeps Results, now for the flip (3 tiles)', (await pressed()) === 'Figures:false,Results:true' && (await q.locator('.lg-results .lg-tile').count()) === 3 && (await q.textContent('.lg-results .lg-h')) === 'How Flip does');
    // remembered for the session, not per deal
    await q.reload(); await q.waitForTimeout(300);
    ok('8a: the choice is remembered for the session (after a reload)', (await pressed()) === 'Figures:false,Results:true');
    await q.click('.lg-back'); await q.waitForTimeout(100);
    ok('8a: "← Change the figures" goes back to Figures', (await pressed()) === 'Figures:true,Results:false' && (await q.isVisible('#lg-endValue')));
    const sw2 = await q.evaluate(() => ({ sw: document.querySelector('.lg-switch').getBoundingClientRect().top, pin: document.querySelector('.pin').getBoundingClientRect().bottom }));
    ok('8a: ... with the switch just under the pinned panel', sw2.sw >= sw2.pin && sw2.sw - sw2.pin <= 16, JSON.stringify(sw2));
    await q.click('.lg-switch button:text-is("Results")'); await q.waitForTimeout(60);
    const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await c3.addInitScript(() => { localStorage.setItem('deal-analyser:onboarded', 'true'); if (!sessionStorage.getItem('fm')) { sessionStorage.setItem('fm', '1'); localStorage.setItem('deal-analyser:fundMode', '"mortgage"'); } });
    const r = await c3.newPage(); await r.goto(BASE + '/index.html#c/brr'); await r.waitForTimeout(300);
    ok('8a: a new session starts on Figures', (await r.$$eval('.lg-switch button', bs => bs.map(x => x.getAttribute('aria-pressed')).join())) === 'true,false');
    ok('8a: no sideways scroll in either view', await q.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await c3.close(); await c2.close();
  }
  // ---- Rent to rent (design 7b with the 8b switch) ----
  {
    const c4 = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await c4.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('deal-analyser:onboarded', 'true'); });
    const q = await c4.newPage(); q.on('pageerror', e => errs.push(e.message));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(300);
    await q.evaluate(() => scrollTo(0, 1e6)); await q.click('.lg-foot .lg-link:text-is("Rent to rent →")'); await q.waitForTimeout(250);
    const txt = sel => q.textContent(sel);
    ok('r2r: the panel reads Rent to rent, Save and the R2R HMO pill, monthly profit after the rent', (await q.url()).endsWith('#c/r2rhmo') && (await txt('.pin-back .pin-title')) === 'Rent to rent' && (await txt('.pin-exit')) === 'R2R HMO' && (await q.isVisible('.pin-save')) && (await txt('.pin-eye')) === 'Monthly profit, after the rent you pay');
    ok('r2r: the sheet example: £700 a month, 117.8% ROI on money in, In £3,000 / Out £2,300', (await txt('.pin-fig')) === '£700' && (await txt('.pin-side-fig')) === '117.8%' && (await q.$$eval('.pin-caps span', s => s.map(x => x.textContent).join(' / '))) === 'In £3,000 a month / Out £2,300');
    ok('r2r: the verdict strip: 2/3, Good deal, amber', (await txt('.vs-score')) === '2/3' && (await txt('.vs-txt')) === 'Good deal · hits 2 of 3 targets' && await q.$eval('.vstrip', e => e.classList.contains('amber')));
    await q.click('.vs-row'); await q.waitForTimeout(60);
    ok('r2r: its chips: £500 a month ✓, 50% ROI ✓, Money back in 6 months ✗', (await q.$$eval('.vs-chip', cs => cs.map(c => c.textContent).join(' | '))) === '✓£500 a month | ✓50% ROI | ✗Money back in 6 months', await q.$$eval('.vs-chip', cs => cs.map(c => c.textContent).join(' | ')));
    await q.click('.vs-row'); await q.waitForTimeout(60);
    ok('r2r: R2R HMO and R2R SA side by side, with their monthly profit', (await q.$$eval('.r2r-tile', ts => ts.map(t => t.innerText.replace(/\s+/g, ' ')).join(' | '))) === 'R2R HMO By the room £700/mo | R2R SA Nightly stays £695/mo');
    ok('r2r: Figures first: Money in, five money cards in order, Total money in', await q.evaluate(() => [...document.querySelectorAll('.lg-figures .deal-card .lg-label')].map(l => l.textContent).join(' | ')) === 'Deposit / up-front rent | Refurbishment costs | Furnishing costs | Any other costs | Rent you pay' && (await txt('.r2r-total b')) === '£7,132');
    ok('r2r: More detail: Room income (open) and Running costs, with their summaries', (await q.$$eval('.lg-fold .fold-txt', fs => fs.map(f => f.innerText.replace(/\s+/g, ' ')).join(' | '))) === 'Room income 4 rooms at £750 · £3,000 a month | Running costs £600 a month on top of the rent' && await q.isVisible('#lg-roomRate') && !(await q.isVisible('#lg-council')));
    ok('r2r: every tap target on the new parts is 44px or more', await q.evaluate(() => [...document.querySelectorAll('.r2r-tile, .lg-switch button, .pin-back')].every(e => { const r = e.getBoundingClientRect(), a = getComputedStyle(e, '::after'); return r.height >= 44 || (a.content !== 'none' && r.height + 16 >= 44); })));
    // a change shows straight away everywhere, and Reset brings the start back
    await q.fill('#lg-roomRate', '800'); await q.evaluate(() => document.activeElement.blur()); await q.waitForTimeout(80);
    ok('r2r: a room rate of £800: £900 a month, In £3,200, the tile and summary follow', (await txt('.pin-fig')) === '£900' && (await txt('.pin-caps span')) === 'In £3,200 a month' && (await txt('.r2r-tile.on .big')) === '£900/mo' && (await txt('.lg-fold .fold-txt small')) === '4 rooms at £800 · £3,200 a month');
    ok('r2r: Reset shows once a figure changes', await q.isVisible('.pin-reset'));
    await q.fill('#lg-rentPaid', '1900'); await q.evaluate(() => document.activeElement.blur()); await q.waitForTimeout(80);
    ok('r2r: the rent card shows how far it moved from the start', (await txt('.deal-card:has(#lg-rentPaid) .lg-reset')) === '+£200 from £1,700 ↺' && (await txt('.pin-fig')) === '£680', (await txt('.deal-card:has(#lg-rentPaid) .lg-reset')) + ' ' + (await txt('.pin-fig')));
    await q.click('.pin-reset'); await q.waitForTimeout(80);
    ok('r2r: Reset puts every figure back', (await txt('.pin-fig')) === '£700' && !(await q.isVisible('.pin-reset')));
    ok('r2r: ... untyped again, so nothing carries over to the other kind or the Calculator', await q.evaluate(() => { const d = JSON.parse(localStorage.getItem('deal-analyser:deal')) || {}; return !('roomRate' in d) && !('rentPaid' in d) && !('rooms' in d); }), await q.evaluate(() => localStorage.getItem('deal-analyser:deal')));
    // Results
    await q.click('.lg-switch button:text-is("Results")'); await q.waitForTimeout(100);
    const tiles = await q.$$eval('.lg-results .lg-tile', ts => ts.map(t => t.innerText.replace(/\s+/g, ' ')).join(' | '));
    ok('r2r: Results: the six tiles', tiles === '£700.00 ✓ Monthly profit (target £500) | £8,400 ✓ Annual profit (target £6,000) | 10.2 months Money back (green ≤ 6, amber ≤ 24) | 117.8% ✓ ROI on money in (target 50%) | £3,000 Income a month | £2,300 Costs a month, incl. rent', tiles);
    ok('r2r: Results: the monthly breakdown', (await q.$$eval('.r2r-brk .lg-stat', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')).join(' | '))) === 'Income £3,000 | Rent you pay −£1,700 | Other running costs −£600 | Monthly profit £700 | Total money in £7,132');
    ok('r2r: money back is amber (10.2 months), monthly profit green', await q.$eval('.lg-results .lg-tile:nth-child(3) b', e => e.classList.contains('amber')) && await q.$eval('.lg-results .lg-tile:nth-child(1) b', e => e.classList.contains('good')));
    // the other kind keeps the view
    await q.click('.r2r-tile:has(.nm:text-is("R2R SA"))'); await q.waitForTimeout(250);
    ok('r2r: R2R SA: its own figures, 3/3 Strong deal, still on Results', (await q.url()).endsWith('#c/r2rsa') && (await txt('.pin-exit')) === 'R2R SA' && (await txt('.vs-score')) === '3/3' && (await q.$$eval('.lg-switch button', bs => bs.map(x => x.getAttribute('aria-pressed')).join())) === 'false,true');
    await q.click('.lg-back'); await q.waitForTimeout(100);
    ok('r2r: R2R SA figures: Nightly income and Running costs (with the channel manager)', (await q.$$eval('.lg-fold .fold-txt b', fs => fs.map(f => f.textContent).join(' | '))) === 'Nightly income | Running costs' && (await txt('.lg-fold .fold-txt small')) === '1 room at £135 a night · 70% full', (await q.$$eval('.lg-fold .fold-txt', fs => fs.map(f => f.innerText).join(' | '))));
    await q.click('.lg-fold:has(b:text-is("Running costs")) .fold-head'); await q.waitForTimeout(60);
    ok('r2r: one fold open at a time', await q.isVisible('#lg-channel') && !(await q.isVisible('#lg-nightlyRate')));
    ok('r2r: no sideways scroll', await q.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    // no income: nothing to score
    await q.fill('#lg-rooms', '0').catch(() => {});
    await q.click('.lg-fold:has(b:text-is("Nightly income")) .fold-head'); await q.waitForTimeout(60); await q.fill('#lg-rooms', '0'); await q.evaluate(() => document.activeElement.blur()); await q.waitForTimeout(80);
    ok('r2r: no rooms: the strip asks for the rent figures and scores nothing; no NaN', (await txt('.vs-txt')).startsWith('Enter the rent figures') && (await txt('.vs-score')) === '–' && !(await q.evaluate(() => /NaN/.test(document.body.innerText))));
    await q.click('.pin-reset'); await q.waitForTimeout(80);
    // Save remembers it is a rent to rent deal and opens back on this screen
    q.on('dialog', d => d.type() === 'prompt' ? d.accept('R2R test') : d.accept());
    await q.click('.pin-save'); await q.waitForTimeout(150);
    const saved = await q.evaluate(() => JSON.parse(localStorage.getItem('deal-analyser:deals'))[0]);
    ok('r2r: Save keeps it as an R2R SA deal', saved && saved.name === 'R2R test' && saved.calc === 'r2rsa', JSON.stringify(saved && { calc: saved.calc, view: saved.view }));
    await q.goto(BASE + '/index.html#saved'); await q.waitForTimeout(250); await q.click('.d6-open'); await q.waitForTimeout(250);
    ok('r2r: opening the saved deal comes back to this screen', (await q.url()).endsWith('#c/r2rsa') && await q.isVisible('.r2r-tile.on:has(.nm:text-is("R2R SA"))'));
    // the ways back
    await q.click('.pin-back'); await q.waitForTimeout(250);
    ok('r2r: ‹ Rent to rent goes back to the Calculator', (await q.url()).endsWith('#c/brr') && (await txt('.pin-title')) === 'Calculator');
    await q.goto(BASE + '/index.html#c/r2rhmo'); await q.waitForTimeout(250); await q.evaluate(() => scrollTo(0, 1e6)); await q.click('.lg-link:text-is("Buy, refurb & refinance →")'); await q.waitForTimeout(250);
    ok('r2r: "Buy, refurb & refinance →" goes to the Calculator', (await q.url()).endsWith('#c/brr'));
    await q.goto(BASE + '/index.html#c/r2rhmo'); await q.waitForTimeout(250);
    ok('r2r: its disclaimer asks you to check the landlord’s consent', (await txt('.legal-foot')).includes('Check your landlord’s consent and the contract before you sign.'));
    await c4.close();
  }
  // ---- My usual figures (design 9b) ----
  {
    const c5 = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await c5.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('deal-analyser:onboarded', 'true'); });
    const q = await c5.newPage(); q.on('pageerror', e => errs.push(e.message));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(200);
    await q.goto(BASE + '/index.html#usual'); await q.waitForTimeout(250);
    const usual = () => q.evaluate(() => JSON.parse(localStorage.getItem('deal-analyser:usual') || '{}'));
    const look = await q.evaluate(() => ({ fonts: [...new Set([...document.querySelectorAll('#v-usual *')].filter(e => e.type !== 'range').map(e => getComputedStyle(e).fontFamily.split(',')[0].replace(/"/g, '')))].join(), pinned: getComputedStyle(document.querySelector('#v-usual .pin')).position, heads: [...document.querySelectorAll('#v-usual .lg-h')].map(e => e.textContent).join('|'), cards: document.querySelectorAll('#v-usual .u9-card').length, fields: document.querySelectorAll('#v-usual .u9-field').length, sliders: document.querySelectorAll('#v-usual .scrub').length, nudges: document.querySelectorAll('#v-usual .nudge').length, tabs: !document.getElementById('tabs').hidden, calcTab: document.getElementById('t-home').getAttribute('aria-selected') }));
    ok('usual 9b: pinned header card, four group cards (the bridging loan added by design 1b), twelve figures each with − / slider / +, one font, tab bar with Calculator', look.fonts === 'Geist' && look.pinned === 'sticky' && look.heads === 'Buying costs|Finance|Letting|Bridging loan' && look.cards === 4 && look.fields === 12 && look.sliders === 12 && look.nudges === 24 && look.tabs && look.calcTab === 'true', JSON.stringify(look));
    ok('usual 9b: nothing set: every figure shows its example, "All figures are spreadsheet examples", no Clear all', (await q.textContent('.u9-count')) === 'All figures are spreadsheet examples' && !(await q.isVisible('.u9-clear')) && (await q.$eval('#u-legal', e => e.value)) === '3,000' && await q.$eval('#u-legal', e => e.classList.contains('ex')) && (await q.$$eval('.u9-tag', ts => ts.map(t => t.textContent).join('|'))) === 'Example from the spreadsheet|'.repeat(6) + 'Example figure|'.repeat(5) + 'Example figure' && (await q.inputValue('#u-bridgeRatePct')) === '0.85');
    const legal = q.locator('.u9-field:has(#u-legal)');
    await legal.locator('.nudge >> nth=0').click(); await q.waitForTimeout(40);
    ok('usual 9b: − on legal makes it yours: £2,950, "Yours", "Example £3,000 ↺", saved at once', (await q.$eval('#u-legal', e => e.value)) === '2,950' && (await legal.locator('.u9-tag').textContent()) === 'Yours' && (await legal.locator('.u9-reset').textContent()) === 'Example £3,000 ↺' && (await usual()).legal === '2950' && (await q.textContent('.u9-count')) === '1 of 12 figures are yours' && await q.isVisible('.u9-clear'));
    await legal.locator('.u9-reset').click(); await q.waitForTimeout(40);
    ok('usual 9b: "Example £3,000 ↺" puts the example back (the key is deleted)', !('legal' in (await usual())) && (await q.$eval('#u-legal', e => e.value)) === '3,000' && (await legal.locator('.u9-tag').textContent()) === 'Example from the spreadsheet');
    await q.fill('#u-mortgageRate', '6.25'); await q.waitForTimeout(40);
    ok('usual 9b: typing a figure saves it as yours', (await usual()).mortgageRate === '6.25' && (await q.locator('.u9-field:has(#u-mortgageRate) .u9-tag').textContent()) === 'Yours');
    await q.fill('#u-mortgageRate', ''); await q.waitForTimeout(40);
    ok('usual 9b: clearing the typed box goes back to the example', !('mortgageRate' in (await usual())));
    // the slider: a tap sets it
    const sl = q.locator('.u9-field:has(#u-ltv) .scrub'); await sl.scrollIntoViewIfNeeded(); const bb = await sl.boundingBox();
    await q.mouse.click(bb.x + bb.width - 1, bb.y + bb.height / 2); await q.waitForTimeout(60);
    ok('usual 9b: tapping the end of the LTV slider sets 85%', (await usual()).ltv === '85' && (await q.$eval('#u-ltv', e => e.value)) === '85', JSON.stringify(await usual()) + ' ' + (await q.$eval('#u-ltv', e => e.value)));
    await q.fill('#u-ltv', '90'); await q.waitForTimeout(40);
    ok('usual 9b: a typed figure may go past the slider (90%)', (await usual()).ltv === '90');
    await q.evaluate(() => scrollTo(0, 0)); await q.click('.u9-clear'); await q.waitForTimeout(60);
    ok('usual 9b: Clear all empties them', JSON.stringify(await usual()) === '{}' && !(await q.isVisible('.u9-clear')));
    ok('usual 9b: every box and button 44px or more (or a 44px hit area)', await q.evaluate(() => [...document.querySelectorAll('#v-usual button, #v-usual input')].filter(e => e.offsetParent).every(e => { const r = e.getBoundingClientRect(), a = getComputedStyle(e, '::after'); return r.height >= 44 || (a.content !== 'none' && a.position === 'absolute' && r.height + 2 * Math.abs(parseFloat(a.top) || 0) >= 44); })));
    ok('usual 9b: a usual figure reaches the Calculator', await (async () => { await q.fill('#u-legal', '2000'); await q.waitForTimeout(40); await q.click('.pin-back'); await q.waitForTimeout(250); return (await q.$eval('#lg-legal', e => e.value)) === '2,000'; })());
    ok('usual 9b: no sideways scroll', await q.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await c5.close();
  }
  // ---- Settings (design 9a) ----
  {
    const c6 = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await c6.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('deal-analyser:onboarded', 'true'); });
    const q = await c6.newPage(); q.on('pageerror', e => errs.push(e.message));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(250); await q.click('#gear'); await q.waitForTimeout(100);
    const look = await q.evaluate(() => { const s = document.getElementById('settings-sheet'); return { title: s.querySelector('.bs-head h2').textContent, done: !!s.querySelector('.bs-done'), close: !!s.querySelector('.sheet-close'), labels: [...s.querySelectorAll('.st9-label')].map(e => e.textContent).join('|'), cards: s.querySelectorAll('.st9-card').length, themes: [...s.querySelectorAll('.st9-theme small')].map(e => e.textContent).join('|'), links: [...s.querySelectorAll('.st9-link')].map(e => e.innerText.replace(/\s+/g, ' ')).join('|'), foot: s.querySelector('.st9-foot').textContent, fonts: [...new Set([...s.querySelectorAll('*')].map(e => getComputedStyle(e).fontFamily.split(',')[0].replace(/"/g, '')))].join() }; });
    ok('settings 9a + 10d: title and Done, no ×, About you / Appearance / Your figures labels, five cards, one font', look.title === 'Settings' && look.done && !look.close && look.labels === 'About you|Appearance|Your figures' && look.cards === 5 && look.fonts === 'Geist', JSON.stringify(look));
    ok('settings 9a: the theme subtitles', look.themes === 'Deep green, light ink.|Cream paper, dark ink.|Follows your phone’s setting.', look.themes);
    ok('settings 9a: the link rows and the footer', look.links === 'Your targets Monthly profit, ROI, money back, flip margin ›|My usual figures Using the spreadsheet examples ›|Privacy policy ›' && look.foot === 'Estimates only, not financial, tax or legal advice. Your figures, targets and saved deals stay on this phone.', look.links);
    const exp = () => q.$eval('.st9-switch', e => e.getAttribute('aria-checked'));
    const before = await exp(); await q.click('.st9-switch'); await q.waitForTimeout(60);
    ok('settings 9a: the Explanations switch flips and is saved', (await exp()) === String(before !== 'true') && String(await q.evaluate(() => JSON.parse(localStorage.getItem('deal-analyser:explanations')))) === (await exp()));
    await q.click('.st9-theme:has(b:text-is("Light"))'); await q.waitForTimeout(80);
    ok('settings 9a: choosing Light switches the theme and ticks it', (await q.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'light' && (await q.$eval('.st9-theme:has(b:text-is("Light"))', e => e.getAttribute('aria-pressed'))) === 'true');
    ok('settings 9a: rows are 56px or more; buttons 44px or more (or a 44px hit area)', await q.evaluate(() => [...document.querySelectorAll('#settings-sheet .st9-row')].every(e => e.getBoundingClientRect().height >= 56) && [...document.querySelectorAll('#settings-sheet button')].every(e => { const r = e.getBoundingClientRect(), a = getComputedStyle(e, '::after'); return r.height >= 44 || (a.content !== 'none' && a.position === 'absolute'); })));
    await q.evaluate(() => localStorage.setItem('deal-analyser:usual', JSON.stringify({ legal: '1500', ltv: '75' }))); await q.reload(); await q.waitForTimeout(250); await q.click('#gear'); await q.waitForTimeout(80);
    ok('settings 9a: My usual figures says how many are set', (await q.textContent('.st9-link:has(b:text-is("My usual figures")) small')) === '2 of 12 set, used on every new deal');
    await q.click('.st9-link:has(b:text-is("My usual figures"))'); await q.waitForTimeout(200);
    ok('settings 9a: My usual figures opens its screen and closes the sheet', (await q.url()).endsWith('#usual') && !(await q.isVisible('#settings-sheet')));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(250); await q.click('#gear'); await q.waitForTimeout(80); await q.click('.bs-done'); await q.waitForTimeout(60);
    ok('settings 9a: Done closes it', !(await q.isVisible('#settings-sheet')));
    await q.click('#gear'); await q.waitForTimeout(80); await q.click('#settings-overlay', { position: { x: 20, y: 20 } }); await q.waitForTimeout(60);
    ok('settings 9a: tapping the dimmed page closes it', !(await q.isVisible('#settings-sheet')));
    await c6.close();
  }
  // ---- Setup answers that count (design 10) ----
  {
    const fresh = async (seed) => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await c.addInitScript(sd => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); Object.keys(Object.assign({ fundMode: 'mortgage' }, sd)).forEach(k => localStorage.setItem('deal-analyser:' + k, JSON.stringify(Object.assign({ fundMode: 'mortgage' }, sd)[k]))); }, seed || {});
      const q = await c.newPage(); q.on('pageerror', e => errs.push(e.message)); return { c, q }; };
    // the whole setup, as a sourcer who lets by the room
    let { c, q } = await fresh();
    await q.goto(BASE + '/index.html'); await q.waitForTimeout(300);
    ok('setup 10a: first launch shows step 1, two bars (one filled), three cards', await q.isVisible('#v-onboard') && (await q.textContent('.ob10-h')) === 'How will you use it?' && (await q.locator('.ob10-bars i').count()) === 2 && (await q.locator('.ob10-bars i.on').count()) === 1 && (await q.locator('.ob10-card').count()) === 3);
    await q.click('.ob10-card:has-text("I source deals")'); await q.waitForTimeout(60);
    ok('setup 10a: the chosen card says what it switches on', (await q.$$eval('.ob10-card[aria-checked=true] .ob10-do', ds => ds.map(d => d.textContent).join('|'))) === '✓Deal pack button on every saved deal|✓Deal pack at the top of Settings|✓Explanations off: just the numbers');
    await q.click('.ob10-go'); await q.waitForTimeout(60);
    ok('setup 10b: step 2, both bars filled, four letting cards with "Opens on" tags', (await q.locator('.ob10-bars i.on').count()) === 2 && (await q.$$eval('.ob10-tag', ts => ts.map(t => t.textContent).join('|'))) === 'Opens on BRR → BTL|Opens on BRR → HMO|Opens on BRR → SA|Opens on BRR → BTL');
    await q.fill('#ob-price', '60000'); await q.fill('#ob-end', '225000'); await q.click('.ob10-let:has(b:text-is("By the room"))'); await q.waitForTimeout(60);
    ok('setup 10b: typed figures survive choosing a letting card', (await q.$eval('#ob-price', e => e.value)) === '60000' && (await q.$eval('.ob10-let[aria-checked=true] b', e => e.textContent)) === 'By the room');
    await q.click('.ob10-go'); await q.waitForTimeout(60);
    ok('setup 10c: You’re set up, with what changed', (await q.textContent('.ob10-h')) === 'You’re set up' && (await q.$$eval('.ob10-sr b', bs => bs.map(x => x.textContent).join('|'))) === 'Calculator opens on BRR → HMO|Explanations off|Deal packs on|Your first deal is started' && (await q.isVisible('.ob10-brand')));
    ok('setup 10c: the branding card is for deal packs', (await q.textContent('.ob10-brand b')) === 'Brand your deal packs' && (await q.textContent('.ob10-brand-go')) === 'Set up branding →');
    ok('setup 10c: the button says where it opens', (await q.textContent('.ob10-go')) === 'Open the calculator on BRR → HMO');
    await q.click('.ob10-go'); await q.waitForTimeout(300);
    ok('setup: finishing opens the main Calculator with HMO chosen, answers saved', !(await q.isVisible('#v-onboard')) && (await q.url()).endsWith('#c/brr') && (await q.textContent('.pin-exit')) === 'BRR → HMO' && (await q.evaluate(() => [localStorage.getItem('deal-analyser:persona'), localStorage.getItem('deal-analyser:lettingType')].join())) === '"source","hmo"' && (await q.$eval('#lg-purchasePrice', e => e.value)) === '60,000');
    // sourcer: a Deal pack on saved deals and after saving
    q.on('dialog', d => d.type() === 'prompt' ? d.accept('Test house') : d.dismiss());
    await q.click('.pin-save'); await q.waitForTimeout(150);
    ok('sourcer: Save offers Make a deal pack (PRO) only', (await q.$$eval('#settings-sheet .st9-link b', bs => bs.map(b => b.textContent).join('|'))) === 'Make a deal packPRO');
    await q.click('#settings-sheet .bs-done'); await q.waitForTimeout(80);
    await q.goto(BASE + '/index.html#saved'); await q.waitForTimeout(250);
    ok('sourcer: every saved deal has a Deal pack button (no Client report)', (await q.$$eval('.rep10', bs => bs.map(b => b.textContent).join())) === 'Deal pack' && (await q.$eval('.rep10', e => e.getBoundingClientRect().height)) >= 44);
    await q.click('.rep10'); await q.waitForTimeout(250);
    ok('sourcer: it opens the deal pack for that deal (setup first, as there is no template yet)', (await q.url()).endsWith('#pack-setup'));
    // Settings > About you
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(250); await q.click('#gear'); await q.waitForTimeout(80);
    ok('settings 10d: About you first, with both answers chosen, Report branding under it for a sourcer, no setup questions', (await q.$eval('.st9-label', e => e.textContent)) === 'About you' && (await q.$$eval('.ab10-seg button[aria-pressed=true]', bs => bs.map(x => x.textContent).join())) === 'Sourcer,HMO' && (await q.$eval('.ab10 + .st9-card .st9-link b', e => e.textContent)) === 'Deal packPRO' && !(await q.locator('text=Report branding').count()) && !(await q.locator('text=Redo the setup questions').count()));
    ok('settings 10d: the notes say what each answer does', (await q.$$eval('.ab10-n', ns => ns.map(n => n.textContent).join('|'))) === 'Deal pack button on every saved deal · Deal pack at the top of Settings · Explanations off: just the numbers.|Opens on BRR → HMO. Shown first: HMO BTL and R2R HMO.');
    await q.click('.st9-switch'); await q.waitForTimeout(60); const expl = await q.evaluate(() => localStorage.getItem('deal-analyser:explanations'));
    await q.click('.ab10-seg button:text-is("New")'); await q.waitForTimeout(80);
    ok('settings 10d: changing who you are never overwrites an explicit Explanations choice', (await q.evaluate(() => localStorage.getItem('deal-analyser:explanations'))) === expl && (await q.evaluate(() => localStorage.getItem('deal-analyser:persona'))) === '"new"');
    ok('settings 10d: not a sourcer any more: no Report branding row', !(await q.locator('.st9-link:has(b:text-is("Report branding"))').count()));
    await q.click('.ab10-seg button:text-is("SA")'); await q.waitForTimeout(150);
    ok('settings 10d: changing how you let does not move the open Calculator', (await q.url()).endsWith('#c/brr') && (await q.textContent('.pin-exit')) === 'BRR → HMO');
    await q.click('.bs-done'); await q.waitForTimeout(60);
    await q.goto(BASE + '/index.html#saved'); await q.waitForTimeout(250);
    ok('settings 10d: not a sourcer: no Deal pack buttons', !(await q.locator('.rep10').count()));
    await q.click('#t-home'); await q.waitForTimeout(250);
    ok('the Calculator tab (no calculator in the address) opens where you let: BRR → SA', (await q.textContent('.pin-exit')) === 'BRR → SA');
    await q.goto(BASE + '/index.html#c/r2rhmo'); await q.waitForTimeout(250);
    ok('an address that names a calculator wins', (await q.textContent('.pin-exit')) === 'R2R HMO');
    ok('rent to rent: R2R SA comes first for nightly lets', (await q.$$eval('.r2r-tile .nm', ns => ns.map(n => n.textContent).join())) === 'R2R SA,R2R HMO');
    await q.goto(BASE + '/index.html#c/btl'); await q.waitForTimeout(250);
    if (await q.locator('.strat-pill.more').count()) { await q.click('.strat-pill.more').catch(() => {}); await q.waitForTimeout(80); }
    ok('the strategy list puts SA BTL and R2R SA first', (await q.$$eval('.strat-pill:not(.more)', ps => ps.slice(0, 2).map(p => p.textContent).join())) === 'SA BTL,R2R SA', await q.$$eval('.strat-pill:not(.more)', ps => ps.map(p => p.textContent).join()));
    await c.close();
    // Skip: an investor, straight in, where the app opens normally
    ({ c, q } = await fresh());
    await q.goto(BASE + '/index.html'); await q.waitForTimeout(300); await q.click('.ob10-skip'); await q.waitForTimeout(250);
    ok('setup: Skip makes you an investor and goes straight in', !(await q.isVisible('#v-onboard')) && (await q.evaluate(() => localStorage.getItem('deal-analyser:persona'))) === '"invest"' && (await q.evaluate(() => localStorage.getItem('deal-analyser:explanations'))) === 'false' && (await q.textContent('.pin-exit')) === 'Flip', await q.evaluate(() => [localStorage.getItem('deal-analyser:persona'), localStorage.getItem('deal-analyser:explanations'), document.querySelector('.pin-exit') && document.querySelector('.pin-exit').textContent, document.getElementById('v-onboard').hidden].join(' ')));
    await c.close();
    ({ c, q } = await fresh());
    await q.goto(BASE + '/index.html'); await q.waitForTimeout(300); await q.click('.ob10-card:has-text("I invest")'); await q.click('.ob10-go'); await q.click('.ob10-let:has(b:text-is("Not sure yet"))'); await q.click('.ob10-go'); await q.waitForTimeout(60);
    const ctaText = await q.textContent('.ob10-go'); await q.click('.ob10-go'); await q.waitForTimeout(300);
    ok('setup, not sure: "Open the calculator on BRR → BTL" does just that', ctaText === 'Open the calculator on BRR → BTL' && (await q.textContent('.pin-exit')) === 'BRR → BTL');
    await c.close();
    // opening with and without a calculator in the address, when setup is done
    ({ c, q } = await fresh({ onboarded: true, lettingType: 'hmo', brrlet: 'none' }));
    await q.goto(BASE + '/index.html'); await q.waitForTimeout(300);
    ok('no calculator in the address: opens on BRR → HMO', (await q.textContent('.pin-exit')) === 'BRR → HMO');
    await c.close();
    ({ c, q } = await fresh({ onboarded: true, lettingType: 'hmo', brrlet: 'none' }));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(300);
    ok('an explicit #c/brr keeps the way out you were on (Flip)', (await q.textContent('.pin-exit')) === 'Flip');
    await c.close();
    ({ c, q } = await fresh({ onboarded: true, lettingType: 'unsure', brrlet: 'none' }));
    await q.goto(BASE + '/index.html'); await q.waitForTimeout(300);
    ok('not sure: today’s start (where you were)', (await q.textContent('.pin-exit')) === 'Flip');
    await c.close();
    // ---- 11a Mortgage payments in the How you'll pay card (second 11a hand-off) ----
    ({ c, q } = await fresh({ onboarded: true, brrlet: 'btl', deal: { endValue: 230000, purchasePrice: 125000, refurb: 30000, legal: 1500 } }));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(300);
    const mort = () => q.$$eval('.fund11-mtile', ts => ts.map(t => t.innerText.replace(/\s+/g, ' ').trim()).join('|'));
    ok('11a mortgage payments: between the bridge figures and your own money in, at the letting rate (5%)', (await q.evaluate(() => { const m = document.querySelector('.fund11-mort'); return m.previousElementSibling.classList.contains('fund11-bridge') && m.nextElementSibling.classList.contains('fund11-own'); })) && (await q.inputValue('#lg-mortRate11')) === '5' && (await q.textContent('.fund11-mort .fund11-l')) === 'Mortgage payments');
    ok('11a: until the refinance £391 a month on £93,750; after it £719 on £172,500 (amber); £8,625 a year', (await mort()) === 'Until the refinance £391 /mo On £93,750 borrowed at purchase|After the refinance £719 /mo On £172,500 after the refinance' && (await q.textContent('.fund11-my')) === '£8,625 a year after the refinance. Already taken off your monthly profit.' && (await q.$eval('.fund11-mtile b.amber', e => !!e)), await mort());
    const tiles0 = await q.$$eval('.lg-results .lg-tile, .lg-results .tile', ts => ts.map(t => t.textContent).join('|')), profit0 = tiles0;
    await q.fill('#lg-mortRate11', '6'); await q.waitForTimeout(100);
    ok('11a: typing 6% changes both payments and the profit, and the letting figures’ own rate', (await mort()).includes('After the refinance £863 /mo') && (await mort()).includes('Until the refinance £469 /mo') && (await q.evaluate(() => JSON.parse(localStorage.getItem('deal-analyser:deal')).mortgageRate)) == 6 && (await q.$eval('#lg-mortgageRate', e => e.value)) === '6' && (await q.$$eval('.lg-results .lg-tile, .lg-results .tile', ts => ts.map(t => t.textContent).join('|'))) !== tiles0, (await mort()) + ' ' + profit0);
    await q.click('.lg-seg button:text-is("Bridging")'); await q.waitForTimeout(150);
    ok('11a: with bridging, the first tile says Bridge instead', (await mort()).startsWith('Until the refinance Bridge instead Bridge interest is in its cost above|After the refinance £863'));
    ok('11a: the rate box is 44px tall', (await q.$eval('#lg-mortRate11', e => e.getBoundingClientRect().height)) >= 44);
    await c.close();
    // ---- 11 Oct 2026: a flip shows the flip price and no lender wording; buying a home to live in ----
    ({ c, q } = await fresh({ onboarded: true, brrlet: 'none', deal: { endValue: 1100000, refurb: 200000, legal: 3000, purchasePrice: 724545, ltv: 90, depositPct: 10 } }));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(300);
    ok('flip: the price card offers the flip price £574,545 for a 25% margin (not the recycle price)', (await q.textContent('.rec-eye')) === 'Flip price' && (await q.textContent('.rec-amt')) === '£574,545' && (await q.textContent('.rec-note')) === 'Pay this or less for a 25% margin when you sell');
    ok('flip: the top bar is the sale price against the cost, with no lender', (await q.textContent('.pin-caps')) === 'Sale price £1,100,000Cost £990,000' && !/Lender pays/.test(await q.textContent('.pin')) && (await q.textContent('#lg-endValue >> xpath=ancestor::section[1] >> .lg-sub')) === 'What you sell it for after the works');
    ok('flip: How you’ll pay has the deposit only (no “Lender pays” tile) and “While you own it” (no after-the-refinance)', !(await q.locator('#lg-ltv').count()) && (await q.locator('#lg-depositPct').count()) === 1 && (await q.textContent('.fund11-mtile >> nth=0 >> span')) === 'While you own it' && !(await q.isVisible('.fund11-mtile >> nth=1')));
    await q.click('.rec-btn'); await q.waitForTimeout(150);
    ok('flip: Set price makes it a 25% flip: price £574,545, margin 25.0%, "✓ Snapped to the flip price"', (await q.inputValue('#lg-purchasePrice')) === '574,545' && (await q.textContent('.pin-side-fig')) === '25.0%' && (await q.textContent('#lg-purchasePrice >> xpath=ancestor::section[1] >> .lg-sub')) === '✓ Snapped to the flip price');
    await q.click('.exit-tile:has(.nm:text-is("BTL"))'); await q.waitForTimeout(150);
    await q.click('.exit-tile:has(.nm:text-is("SA"))'); await q.waitForTimeout(150);
    ok('SA: your own money counts the furnishing too (its own row)', (await q.$$eval('.fund11-own .fund11-row span', ss => ss.map(x => x.textContent).join('|'))).includes('Refurb costs|Furnishing|Total to pay'), await q.$$eval('.fund11-own .fund11-row span', ss => ss.map(x => x.textContent).join('|')));
    await q.click('.exit-tile:has(.nm:text-is("BTL"))'); await q.waitForTimeout(150);
    ok('BTL: the recycle price is back, with the lender', (await q.textContent('.rec-eye')) === 'Recycle price' && (await q.textContent('.rec-amt')) === '£724,545' && /^Lender pays/.test(await q.textContent('.pin-caps')) && (await q.locator('#lg-ltv').count()) === 1);
    await c.close();
    ({ c, q } = await fresh({ onboarded: true }));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(300);
    await q.click('.lg-link:text-is("What you’d pay →")'); await q.waitForTimeout(250);
    const hbOwn = () => q.textContent('.hb .pin-fig'), hbRows = () => q.$$eval('.hb-bd .fund11-row', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')).join('|'));
    ok('home: "Buying a home to live in? What you’d pay →" opens it, with the tab bar (Calculator)', (await q.url()).endsWith('#home') && await q.isVisible('#tabs') && (await q.getAttribute('#t-home', 'aria-selected')) === 'true' && (await q.textContent('.hb .pin-title')) === 'Buying a home');
    ok('home: a £250,000 first home in England: £27,999 of your own money, £225,000 borrowed, no stamp duty', (await hbOwn()) === '£27,999' && (await q.textContent('.hb-loan')) === '£225,000' && (await q.textContent('.hb-sd b')) === '£0');
    ok('home: the breakdown adds up: price and costs, total, less the mortgage, your own money', (await hbRows()) === 'Purchase price £250,000|Stamp duty £0|Legal costs £1,500|Survey £500|Mortgage fees £999|Total to buy £252,999|Less: Mortgage (90% of the price) −£225,000|From your own money £27,999', await hbRows());
    ok('home: the monthly repayment £1,251 over 25 years', (await q.textContent('.hb-mt .fund11-mtile >> nth=0 >> b')) === '£1,251 /mo');
    await q.click('.hb-who button:text-is("Moving home")'); await q.waitForTimeout(80);
    ok('home: moving home pays £2,500 stamp duty and your own money goes up by it', (await q.textContent('.hb-sd b')) === '£2,500' && (await hbOwn()) === '£30,499');
    await q.click('.hb-who button:text-is("Scotland")'); await q.waitForTimeout(80);
    ok('home: in Scotland it is LBTT (£2,100 moving home)', (await q.textContent('.hb-sd span')) === 'LBTT (Scotland’s stamp duty)' && (await q.textContent('.hb-sd b')) === '£2,100');
    await q.fill('#hb-depositPct', '25'); await q.waitForTimeout(80);
    ok('home: a 25% deposit: £62,500 deposit, £187,500 borrowed', (await q.textContent('.hb-loan')) === '£187,500' && (await q.textContent('#hb-depositPct >> xpath=ancestor::div[contains(@class,"u9-field")][1] >> small')) === '= £62,500 of the price');
    await q.reload(); await q.waitForTimeout(300);
    ok('home: kept on the phone, apart from the investment deal', (await q.textContent('.hb-loan')) === '£187,500' && (await q.evaluate(() => JSON.parse(localStorage.getItem('deal-analyser:home')).depositPct)) === 25 && !(await q.evaluate(() => (localStorage.getItem('deal-analyser:deal') || '').includes('depositPct":25'))));
    await q.click('.u9-clear:text-is("Start again")'); await q.waitForTimeout(80);
    ok('home: Start again goes back to the starting figures', (await hbOwn()) === '£27,999');
    const hbSmall = await q.$$eval('.hb button, .hb input', es => es.filter(e => e.offsetParent && !e.classList.contains('u9-clear') && !e.classList.contains('pin-back') && e.getBoundingClientRect().height + (e.classList.contains('nudge') ? 12 : 0) < 44).map(e => e.className + ':' + e.getBoundingClientRect().height));
    ok('home: tap targets 44px or more (the 38px −/+ have a 6px invisible margin all round)', !hbSmall.length && (await q.$eval('.hb .nudge', e => getComputedStyle(e, '::after').top)) === '-6px', JSON.stringify(hbSmall));
    for (const w of [360, 430]) { await q.setViewportSize({ width: w, height: 800 }); await q.waitForTimeout(80); ok('home: no sideways scrolling at ' + w + 'px', (await q.evaluate(() => document.documentElement.scrollWidth)) <= w); }
    await c.close();
    // ---- Every strategy (#compare) and the old Client report (#report) removed (7 Oct 2026) ----
    ({ c, q } = await fresh({ onboarded: true, persona: 'source', report: { by: 'Levendelis Property' }, deals: [{ id: 'a1', v: 2, calc: 'flip', view: 'brr', letting: 'btl', name: 'A', data: { endValue: 200000, purchasePrice: 100000 }, savedAt: 1 }, { id: 'b2', v: 2, calc: 'flip', view: 'brr', letting: 'btl', name: 'B', data: { endValue: 250000, purchasePrice: 140000 }, savedAt: 2 }] }));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(250);
    const hl = await q.evaluate(() => history.length);
    await q.evaluate(() => { location.hash = '#compare'; }); await q.waitForTimeout(250);
    ok('old #compare link lands on the Calculator, replacing itself (Back cannot land on it)', (await q.url()).endsWith('#calculators') && (await q.evaluate(() => history.length)) === hl + 1 && await q.isVisible('#v-home') && !(await q.locator('#v-compare').count()));
    await q.goBack(); await q.waitForTimeout(250);
    ok('... and Back from there goes to where you were, not to #compare', (await q.url()).endsWith('#c/brr'));
    await q.evaluate(() => { location.hash = '#report'; }); await q.waitForTimeout(250);
    ok('old #report link lands on Saved', (await q.url()).endsWith('#saved') && await q.isVisible('#v-saved') && !(await q.locator('#v-report').count()));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(250); await q.click('#t-saved'); await q.waitForTimeout(200); await q.goBack(); await q.waitForTimeout(250);
    ok('calculator → Saved → Back ends on the calculator', (await q.url()).endsWith('#c/brr') && await q.isVisible('#v-home'));
    await q.click('#t-saved'); await q.waitForTimeout(200);
    await q.$$eval('.d6 input[type=checkbox]', cs => cs.forEach(c => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }));
    await q.waitForTimeout(80); await q.click('#sticky-bar .primary'); await q.waitForTimeout(250);
    ok('Saved → compare saved deals: Download PDF only, no Client report', (await q.url()).endsWith('#saved-compare') && (await q.$$eval('#v-scompare .btns button', bs => bs.map(b => b.textContent).join())) === 'Download PDF');
    await q.click('#back'); await q.waitForTimeout(250);
    ok('... and Back ends on Saved', (await q.url()).endsWith('#saved'));
    await q.goto(BASE + '/index.html#saved-compare'); await q.reload(); await q.waitForTimeout(250); await q.click('#back'); await q.waitForTimeout(250);
    ok('... even when the comparison was opened straight from its address', (await q.url()).endsWith('#saved'));
    await q.goto(BASE + '/index.html#pack-brand'); await q.waitForTimeout(250);
    ok('the old Report branding name carries into the deal pack’s business name', (await q.inputValue('.pk-field:has(span:text-is("Business name")) input')) === 'Levendelis Property');
    await c.close();
    // ---- Deal pack (design 12a / 12b / 12d / 14c, 7 Oct 2026; sourcers only) ----
    ({ c, q } = await fresh({ onboarded: true, persona: 'source', brrlet: 'btl', deal: { endValue: 230000, purchasePrice: 125000, refurb: 30000, legal: 1500 } }));
    let copied = ''; q.on('dialog', d => { if (d.message() === 'Copy this link') { copied = d.defaultValue(); d.dismiss(); } else if (d.type() === 'prompt') d.accept('12 Albert Road'); else d.accept(); });
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(300);
    await q.click('.pin-save'); await q.waitForTimeout(150);
    await q.click('#settings-sheet .st9-link:has-text("Make a deal pack")'); await q.waitForTimeout(250);
    ok('pack: Make a deal pack with no template yet opens setup step 1 of 5, without the tab bar', (await q.url()).endsWith('#pack-setup') && (await q.textContent('.pk14-h')) === 'Pick a look' && (await q.textContent('.pk14-step')) === 'Step 1 of 5' && (await q.locator('.pk14-bars i').count()) === 5 && (await q.locator('.pk14-bars i.on').count()) === 1 && !(await q.isVisible('#tabs')));
    ok('pack 14c: four looks with real cover thumbnails, Classic chosen', (await q.$$eval('.pk14-lrow b', bs => bs.map(b => b.textContent).join())) === 'Classic,Editorial,Bold,Memo' && (await q.locator('.pk14-look .dp-page').count()) === 4 && (await q.textContent('.pk14-look[aria-pressed=true] .pk14-lrow b')) === 'Classic');
    ok('pack 14c: a Preview pack pill beside Step 1 of 5', (await q.textContent('.pk14-pvb')) === 'Preview pack' && (await q.$eval('.pk14-pvb', e => e.getBoundingClientRect().height)) >= 36);
    await q.click('.pk14-pvb'); await q.waitForTimeout(150);
    ok('pack 14c preview: the real pages over the flow, with the look, page count and this deal’s figures', await q.isVisible('.pk14-pv') && (await q.locator('.pk14-pv .dp-page').count()) === 5 && (await q.textContent('.pk14-pvh small')) === 'Classic look · 5 pages · this deal’s figures' && (await q.$$eval('.pk14-pv .dp-page', ps => ps[0].innerText)).includes('£125,000') && !(await q.$$eval('.pk14-pv .dp-page', ps => ps.map(p => p.innerText).join(' '))).includes('Margate'));
    await q.click('.pk14-pvs button:text-is("Memo")'); await q.waitForTimeout(100);
    ok('pack 14c preview: the look switch changes the pages live', (await q.getAttribute('.pk14-pv .dp-page >> nth=0', 'data-look')) === 'memo' && (await q.textContent('.pk14-pvh small')).startsWith('Memo look') && (await q.getAttribute('.pk14-pvs button:text-is("Memo")', 'aria-pressed')) === 'true');
    ok('pack 14c preview: no sideways scrolling', (await q.evaluate(() => document.documentElement.scrollWidth)) <= 390 && (await q.$eval('.pk14-pv .pk-page', e => e.getBoundingClientRect().right)) <= 390);
    await q.click('.pk14-done'); await q.waitForTimeout(100);
    ok('pack 14c preview: Done returns to the same step, with the look picked there', !(await q.isVisible('.pk14-pv')) && (await q.textContent('.pk14-h')) === 'Pick a look' && (await q.textContent('.pk14-look[aria-pressed=true] .pk14-lrow b')) === 'Memo');
    ok('pack 14c: Memo’s subtitle says it has no cover photo', (await q.textContent('.pk14-look:has(.pk14-lrow b:text-is("Memo")) .pk14-lrow small')) === 'Figure-led, no cover photo');
    await q.click('.pk14-look:has(b:text-is("Bold"))'); await q.waitForTimeout(60);
    ok('pack 14c: tapping a look chooses it; the footer names it', (await q.textContent('.pk14-look[aria-pressed=true] .pk14-lrow b')) === 'Bold' && (await q.textContent('.pk14-fl')) === 'Bold');
    await q.click('.pk14-next'); await q.waitForTimeout(60);
    ok('pack 14c step 2: nine sections, all in', (await q.locator('.pk14-sec').count()) === 9 && (await q.textContent('.pk14-fl')) === '9 of 9 sections');
    await q.click('.pk14-sec:has-text("EPC and size")'); await q.waitForTimeout(60);
    ok('pack 14c step 2: tapping takes one out', (await q.textContent('.pk14-fl')) === '8 of 9 sections' && (await q.getAttribute('.pk14-sec:has-text("EPC and size")', 'aria-pressed')) === 'false');
    await q.click('.pk14-next'); await q.waitForTimeout(60);
    ok('pack 14c step 3 (new): Add your photos, step 3 of 5, a cover spot and a 3 x 2 gallery, Back · Skip for now · Next', (await q.textContent('.pk14-h')) === 'Add your photos' && (await q.textContent('.pk14-step')) === 'Step 3 of 5' && (await q.textContent('.pk14-sub')) === 'Your own photos only. The first is the cover. You can change them for each deal.' && (await q.locator('.pk14-ph .pk-slot.cover').count()) === 1 && (await q.locator('.pk14-ph .pk-grid .pk-slot').count()) === 6 && (await q.$$eval('.pk14-foot button', bs => bs.map(b => b.textContent).join('|'))) === 'Back|Skip for now|Next');
    ok('pack 14c photos: the cover spot is 190px, the gallery spots 96px, all dashed', Math.round(await q.$eval('.pk14-ph .pk-slot.cover', e => e.getBoundingClientRect().height)) === 190 && Math.round(await q.$eval('.pk14-ph .pk-grid .pk-slot', e => e.getBoundingClientRect().height)) === 96 && (await q.$eval('.pk14-ph .pk-add', e => getComputedStyle(e).borderStyle)) === 'dashed');
    const png0 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
    await q.setInputFiles('.pk14-ph .pk-slot.small >> nth=0 >> input[type=file]', { name: 'g.png', mimeType: 'image/png', buffer: png0 }); await q.waitForTimeout(300);
    ok('pack 14c photos: a gallery photo added in setup is kept for this deal (by its id)', (await q.locator('.pk14-ph .pk-grid img').count()) === 1 && (await q.evaluate(() => { const id = JSON.parse(localStorage.getItem('deal-analyser:pack')).savedId; const v = JSON.parse(localStorage.getItem('deal-analyser:packPhotos:' + id)); return !!id && /^data:image\/jpeg/.test(v.photos[0]); })));
    await q.click('.pk14-pvb'); await q.waitForTimeout(150);
    ok('pack 14c photos: Preview pack shows it straight away, and an empty cover says "Your cover photo goes here"', (await q.locator('.pk14-pv img').count()) >= 1 && (await q.locator('.pk14-pv :text("Your cover photo goes here")').count()) >= 1);
    await q.click('.pk14-done'); await q.waitForTimeout(80);
    await q.click('.pk14-back'); await q.waitForTimeout(60); await q.click('.pk14-sec:has-text("Photos gallery")'); await q.waitForTimeout(40); await q.click('.pk14-next'); await q.waitForTimeout(60);
    ok('pack 14c photos: with the Photos section off, an amber row says only the cover is used, with Turn on', (await q.textContent('.pk14-phoff span')) === 'The Photos gallery section is off, so only the cover is used.' && (await q.textContent('.pk14-phoff b')) === 'Turn on');
    await q.click('.pk14-phoff'); await q.waitForTimeout(60);
    ok('pack 14c photos: Turn on puts the section back', !(await q.locator('.pk14-phoff').count()) && (await q.textContent('.pk14-h')) === 'Add your photos');
    await q.click('.pk14-skip'); await q.waitForTimeout(60);
    ok('pack 14c: Skip for now goes on to branding (step 4 of 5)', (await q.textContent('.pk14-h')) === 'Add your branding' && (await q.textContent('.pk14-step')) === 'Step 4 of 5');
    for (const [l, v] of [['Business name', 'Palmer Property Sourcing'], ['Your name', 'Ashley Palmer'], ['Phone', '07700 900123'], ['Email', 'ash@example.com']]) await q.fill('.pk-field:has(span:text-is("' + l + '")) input', v);
    await q.click('.pk-sw >> nth=1'); await q.waitForTimeout(60);
    ok('pack 14c step 4: branding saved on the phone as typed, with the colour', JSON.stringify(await q.evaluate(() => { const b = JSON.parse(localStorage.getItem('deal-analyser:packBrand')); return [b.company, b.name, b.phone, b.email, b.color]; })) === JSON.stringify(['Palmer Property Sourcing', 'Ashley Palmer', '07700 900123', 'ash@example.com', '#1e3a5f']));
    await q.click('.pk14-next'); await q.waitForTimeout(60);
    ok('pack 14c step 5: a Preview the full pack button', (await q.textContent('.pk14-pvfull')) === 'Preview the full pack · 5 pages');
    ok('pack 14c step 5: the mini cover with 8 sections; the name starts as “Standard pack”, so Save works straight away', (await q.locator('.pk14-chips span').count()) === 8 && (await q.textContent('.pk14-mt span')) === '5 pages · Bold' && (await q.inputValue('.pk14-name')) === 'Standard pack' && !(await q.isDisabled('.pk14-foot .pk14-next')));
    await q.fill('.pk14-name', ''); await q.waitForTimeout(40);
    ok('pack 14c step 5: an emptied name turns Save off', await q.isDisabled('.pk14-foot .pk14-next'));
    await q.fill('.pk14-name', 'Standard pack'); await q.click('.pk14-foot .pk14-next'); await q.waitForTimeout(100);
    ok('pack 14c step 5: saving shows “✓ Saved. Used on every new deal pack.”', (await q.isVisible('.pk14-flash')) && (await q.textContent('.pk14-flash')) === '✓ Saved. Used on every new deal pack.');
    await q.waitForTimeout(1400);
    ok('pack: saving the first template makes it the default and opens the builder with it', (await q.url()).endsWith('#pack') && (await q.textContent('.pk-tpl b')) === 'Standard pack' && (await q.evaluate(() => { const t = JSON.parse(localStorage.getItem('deal-analyser:packTemplates')); return t.list.length === 1 && t.def === t.list[0].id && t.list[0].look === 'bold' && t.list[0].off.epc; })));
    ok('pack 12a: the tab bar shows, Saved selected; PRO marked', await q.isVisible('#tabs') && (await q.getAttribute('#t-saved', 'aria-selected')) === 'true' && (await q.textContent('.pk-pin .pk-pro')) === 'PRO');
    ok('pack 12a: From your saved deal · Saved as BRR → BTL (mint, 600 11.5px)', (await q.textContent('.pk-saved .pk-card-h')) === 'From your saved deal' && (await q.textContent('.pk-savedas')) === 'Saved as BRR → BTL' && (await q.$eval('.pk-savedas', e => { const c = getComputedStyle(e); return c.fontWeight + ' ' + c.fontSize; })) === '600 11.5px');
    ok('pack 12a: every figure from the saved deal', (await q.$$eval('.pk-row', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')).join('|'))) === 'End value £230,000|Refurb £30,000|Legal £1,500|Other costs £0|Stamp duty £6,250|Purchase price £125,000|Rent £1,000/mo|Lender pays / deposit 75% / 25%', await q.$$eval('.pk-row', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')).join('|')));
    ok('pack 12a: the address starts as the saved deal’s name', (await q.inputValue('.pk-field:has(span:text-is("Street address")) input')) === '12 Albert Road');
    for (const [l, v] of [['Town', 'Margate'], ['Postcode', 'CT9 1AA'], ['Bedrooms', '3'], ['Property type', 'terraced house'], ['Prepared for', 'Sarah Reed']]) await q.fill('.pk-field:has(span:text-is("' + l + '")) input', v);
    ok('pack 12a: hide the address is on, and says what shows', (await q.getAttribute('.pk-switch-row .st9-switch', 'aria-checked')) === 'true' && (await q.textContent('.pk-switch-row small')) === 'Shows “Margate CT9” until the client reserves.');
    ok('pack 12a: sections: cover, the nine in order with EPC out, disclaimer; 5 pages', (await q.locator('.pk-sec').count()) === 11 && (await q.getAttribute('.pk-tick-b[aria-label="EPC and size"]', 'aria-checked')) === 'false' && (await q.textContent('.pk-go')) === 'Preview the pack · 5 pages');
    await q.click('.pk-tick-b[aria-label="Photos gallery"]'); await q.click('.pk-tick-b[aria-label="Area map"]'); await q.waitForTimeout(60);
    ok('pack 12a: taking two more out: 4 pages', (await q.textContent('.pk-go')) === 'Preview the pack · 4 pages' && (await q.textContent('.pk-h small:text-matches("pages")')) === '4 pages');
    ok('pack 12a: Photos off: "Photos are off in this pack · Turn on" under Your photos', await q.isVisible('.pk-phoff') && (await q.textContent('.pk-phoff span')) === 'Photos are off in this pack' && (await q.textContent('.pk-phoff button')) === 'Turn on' && (await q.evaluate(() => { const o = document.querySelector('.pk-phoff'); return o.previousElementSibling.textContent.startsWith('Your photos') && o.nextElementSibling.classList.contains('pk-photos'); })));
    await q.click('.pk-phoff button'); await q.waitForTimeout(80);
    ok('pack 12a: Turn on ticks Photos back in and the line goes', !(await q.isVisible('.pk-phoff')) && (await q.getAttribute('.pk-tick-b[aria-label="Photos gallery"]', 'aria-checked')) === 'true' && (await q.textContent('.pk-go')) === 'Preview the pack · 5 pages');
    await q.click('.pk-tick-b[aria-label="Photos gallery"]'); await q.waitForTimeout(80);
    ok('pack 12a: ticking Photos off again brings the line back', await q.isVisible('.pk-phoff') && (await q.textContent('.pk-go')) === 'Preview the pack · 4 pages');
    await q.click('.pk-mv[aria-label="Move up Next steps"]'); await q.waitForTimeout(60);
    ok('pack 12a: ↑ moves a section up; the first can’t go up, the last can’t go down', (await q.evaluate(() => JSON.parse(localStorage.getItem('deal-analyser:pack')).order.slice(-2).join())) === 'next,fee' && await q.isDisabled('.pk-mv[aria-label="Move up Deal summary"]') && await q.isDisabled('.pk-mv[aria-label="Move down Your fee and terms"]'));
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
    await q.setInputFiles('.pk-slot.cover input[type=file]', { name: 'c.png', mimeType: 'image/png', buffer: png }); await q.waitForTimeout(300);
    ok('pack 12a: a cover photo is made smaller and kept on the phone for this deal', (await q.locator('.pk-slot.cover img').count()) === 1 && (await q.evaluate(() => { const id = JSON.parse(localStorage.getItem('deal-analyser:pack')).savedId; return /^data:image\/jpeg/.test(JSON.parse(localStorage.getItem('deal-analyser:packPhotos:' + id)).cover); })));
    const big = await q.$$eval('.pk12 button, .pk12 .pk-field input, .pk12 .pk-add', es => es.filter(e => e.offsetParent && !e.classList.contains('pk-more') && !e.classList.contains('st9-switch') && !e.classList.contains('pin-back') && e.getBoundingClientRect().height < 44).map(e => e.className + ':' + e.getBoundingClientRect().height));
    ok('pack 12a: tap targets 44px or more (text links and the switch have a bigger hit area)', !big.length, JSON.stringify(big));
    await q.reload(); await q.waitForTimeout(300);
    ok('pack 12a: everything typed is still there after a reload', (await q.inputValue('.pk-field:has(span:text-is("Town")) input')) === 'Margate' && (await q.textContent('.pk-go')) === 'Preview the pack · 4 pages' && (await q.locator('.pk-slot.cover img').count()) === 1);
    await q.click('.pk-go'); await q.waitForTimeout(400);
    ok('pack 12b: the preview shows 4 pages in the Bold look, cover first with its photo', (await q.url()).endsWith('#pack-preview') && (await q.locator('.pk-page .dp-page').count()) === 4 && (await q.getAttribute('.pk-page .dp-page >> nth=0', 'data-look')) === 'bold' && (await q.locator('.pk-page >> nth=0 >> img').count()) >= 1 && (await q.textContent('.pk-count')) === '4 pages');
    const pv = await q.$$eval('.pk-page .dp-page', ps => ps.map(p => p.innerText).join(' '));
    ok('pack 12b: the address is hidden; the title is the kind of house; no verdict or score', !pv.includes('Albert Road') && pv.includes('3-bed terraced house, Margate') && !/Good deal|verdict|hits \d of|Strong|Weak|Borderline/.test(pv));
    ok('pack 12b: the sections in the chosen order, with page numbers', (await q.$$eval('.pk-page .dp-block', bs => bs.map(b => b.dataset.sec).join())) === 'summary,figures,exits,evidence,next,fee' && (await q.$$eval('.pk-page .dp-num', ns => ns.map(n => n.textContent).join())) === '1 / 4,2 / 4,3 / 4,4 / 4');
    ok('pack 12b: PDF, Copy link and Share', (await q.$$eval('.pk-act', bs => bs.map(b => b.innerText.replace(/\s+/g, ' ').trim()).join('|'))) === '↓ PDF|⧉ Copy link|↗ Share');
    // the PDF: the print view holds only the pages, one A4 sheet each
    ok('pack 12b: a Look switch above the buttons: "Look", "This pack only · template unchanged", four looks, Bold chosen, 44px', (await q.textContent('.pk-look-h span')) === 'Look' && (await q.textContent('.pk-look-h small')) === 'This pack only · template unchanged' && (await q.$$eval('.pk-look button', bs => bs.map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join())) === 'Classic,Editorial,Bold*,Memo' && (await q.$eval('.pk-look button', e => e.getBoundingClientRect().height)) >= 44);
    await q.evaluate(() => window.scrollTo(0, 600)); await q.waitForTimeout(80); const y0 = await q.evaluate(() => window.scrollY);
    await q.click('.pk-look button:text-is("Memo")'); await q.waitForTimeout(150);
    ok('pack 12b: tapping Memo redraws the pages in Memo where you were (scroll kept)', (await q.$$eval('.pk-page .dp-page', ps => ps.every(p => p.dataset.look === 'memo'))) && (await q.evaluate(() => window.scrollY)) === y0 && y0 > 0 && (await q.getAttribute('.pk-look button:text-is("Memo")', 'aria-pressed')) === 'true');
    ok('pack 12b: ... saved on this pack (and its saved deal) only; the template stays Bold', (await q.evaluate(() => { const p = JSON.parse(localStorage.getItem('deal-analyser:pack')); const t = JSON.parse(localStorage.getItem('deal-analyser:packTemplates')); const d = JSON.parse(localStorage.getItem('deal-analyser:deals')).find(x => x.id === p.savedId); return p.look === 'memo' && d.pack.look === 'memo' && t.list[0].look === 'bold'; })));
    const gap = await q.evaluate(() => { scrollTo(0, 1e6); const pg = [...document.querySelectorAll('.pk-page')].pop().getBoundingClientRect().bottom, bar = document.querySelector('.pk-acts').getBoundingClientRect().top; return bar - pg; });
    ok('pack 12b: the last page clears the taller bar, with a small gap (not a big empty space)', gap >= 8 && gap <= 60, gap);
    await q.click('.pk-act:has-text("Copy link")'); await q.waitForTimeout(300);
    const memoLink = copied;
    const mc = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' }), mp = await mc.newPage();
    await mp.goto(memoLink); await mp.waitForTimeout(400);
    ok('pack link: carries the pack’s look, and the page follows it (Memo headings)', (await mp.evaluate(() => document.body.className)) === 'look-memo' && (await mp.$eval('.card h2', e => getComputedStyle(e).fontFamily)).includes('monospace'));
    await mc.close();
    await q.click('.pk-look button:text-is("Bold")'); await q.waitForTimeout(150);
    ok('pack 12b: the note says photos and the logo go in the PDF only', (await q.textContent('.pk-acts-note')) === 'Photos and your logo go in the PDF only. Send the PDF as well as the link.');
    // Print waits for every photo: decoding is slowed to 500ms here, and print must not start before it ends
    await q.evaluate(() => {
      window.print = () => { window.__printed = (window.__printed || 0) + 1; window.__allLoaded = [...document.querySelectorAll('#pack-print img')].every(i => i.complete && i.naturalWidth > 0); };
      const real = HTMLImageElement.prototype.decode; window.__realDecode = real;
      HTMLImageElement.prototype.decode = function () { return new Promise(ok => setTimeout(ok, 500)).then(() => real.call(this)); };
    });
    await q.click('.pk-act:has-text("PDF")'); await q.waitForTimeout(150);
    ok('pack PDF: while the photos load the button says "Preparing PDF…" and print has not started', (await q.textContent('.pk-act >> nth=0')).includes('Preparing PDF…') && !(await q.evaluate(() => window.__printed)) && await q.isDisabled('.pk-act >> nth=0'));
    await q.waitForTimeout(700);
    ok('pack PDF: then print opens once, every photo in the pages already loaded, and the button says PDF again', (await q.evaluate(() => window.__printed)) === 1 && (await q.evaluate(() => window.__allLoaded)) === true && (await q.locator('#pack-print img').count()) >= 1 && (await q.textContent('.pk-act >> nth=0')).trim().endsWith('PDF') && !(await q.isDisabled('.pk-act >> nth=0')));
    ok('pack PDF: every picture in the print is loading="eager"', await q.$$eval('#pack-print img', is => is.length > 0 && is.every(i => i.getAttribute('loading') === 'eager')));
    // a photo that never finishes: print still opens, after 3 seconds
    await q.evaluate(() => { window.__printed = 0; HTMLImageElement.prototype.decode = () => new Promise(() => {}); });
    await q.click('.pk-act:has-text("PDF")'); await q.waitForTimeout(2500);
    const notYet = await q.evaluate(() => window.__printed);
    await q.waitForTimeout(800);
    ok('pack PDF: a photo that never loads does not block it: print opens after 3 seconds', notYet === 0 && (await q.evaluate(() => window.__printed)) === 1);
    await q.evaluate(() => { HTMLImageElement.prototype.decode = window.__realDecode; });
    ok('pack PDF: Print is opened with the four pages ready', (await q.locator('#pack-print .pk-print-page').count()) === 4);
    await q.emulateMedia({ media: 'print' });
    ok('pack PDF: in print only the pages show', (await q.evaluate(() => getComputedStyle(document.querySelector('main')).display)) === 'none' && (await q.evaluate(() => getComputedStyle(document.getElementById('pack-print')).display)) === 'block');
    const pdf = await q.pdf({ preferCSSPageSize: true, printBackground: true });
    ok('pack PDF: a real print makes exactly 4 A4 pages', (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length === 4 && /\/MediaBox \[0 0 59[45]\.\d* 841\.\d*\]/.test(pdf.toString('latin1')), (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length + ' ' + (/\/MediaBox \[[^\]]*\]/.exec(pdf.toString('latin1')) || [''])[0]);
    await q.emulateMedia({ media: 'screen' });
    // the link: words and figures only, opened on another phone
    await q.click('.pk-act:has-text("Copy link")'); await q.waitForTimeout(300);
    ok('pack link: one address holding the whole pack (no server), shorter than 2,500 characters', /\/p\.html#z[A-Za-z0-9_-]+$/.test(copied) && copied.length < 2500, copied.length);
    const lc = await b.newContext({ viewport: { width: 360, height: 780 }, serviceWorkers: 'block' }), lp = await lc.newPage(); lp.on('pageerror', e => errs.push('link: ' + e.message));
    await lp.goto(copied); await lp.waitForTimeout(400);
    ok('pack 12d: the client sees the pack in the sourcer’s colour, the same sections, no address', (await lp.textContent('h1')) === '3-bed terraced house, Margate' && (await lp.$$eval('.card', cs => cs.map(x => x.dataset.sec).join())) === 'photos,summary,figures,exits,evidence,next,fee' && !(await lp.content()).includes('Albert Road') && (await lp.$eval('.reserve', e => getComputedStyle(e).backgroundColor)) === 'rgb(30, 58, 95)');
    ok('pack 12d: the PDF has a cover photo, so a Photos card says to ask for the PDF (the gallery is off, so it comes first)', (await lp.textContent('.card[data-sec=photos] h2')) === 'Photos' && (await lp.textContent('.card[data-sec=photos] p')) === 'Photos are in the PDF. Ask Palmer Property Sourcing to send it.' && !(await lp.locator('img').count()));
    ok('pack 12d: no sideways scrolling at 360px; Call and Reserve 44px+', (await lp.evaluate(() => document.documentElement.scrollWidth)) <= 360 && (await lp.$eval('.call', e => e.getBoundingClientRect().height)) >= 44 && (await lp.getAttribute('.call', 'href')) === 'tel:07700900123');
    await lp.click('.reserve'); await lp.waitForTimeout(100);
    ok('pack 12d: Reserve asks for name, phone and email; can’t send until name and phone are in', (await lp.locator('.sheet input').count()) === 3 && (await lp.locator('.sends a.off').count()) === 3);
    await lp.fill('input[data-k=name]', 'Sarah Reed'); await lp.fill('input[data-k=phone]', '07700 111222'); await lp.waitForTimeout(60);
    const hrefs = await lp.$$eval('.sends a', as => as.map(a => a.getAttribute('href')));
    ok('pack 12d: ... then text, WhatsApp or email to the sourcer, with the client’s details written in', hrefs.length === 3 && hrefs[0].startsWith('sms:07700900123?&body=') && hrefs[1].startsWith('https://wa.me/447700900123?text=') && hrefs[2].startsWith('mailto:ash@example.com?') && decodeURIComponent(hrefs[0]).includes('Name: Sarah Reed\nPhone: 07700 111222'), JSON.stringify(hrefs));
    const noPh = await lp.evaluate(async (base) => { const P = DealPack.linkPayload(DealPack.data({ figs: { price: 100000, endValue: 160000, refurb: 20000, legal: 1500, other: 0, sdlt: 5000, totalIn: 126500, ltv: 75, depositPct: 25, deposit: 25000, newMortgage: 120000, cashLeft: 6500, monthly: 300, roi: 0.5, margin: 0.2, rent: 900, bridgeCost: 0 }, prop: { town: 'Hull' } }), {}, { company: 'Acme' }, 'classic', false); return base + '#' + await DealPack.encode(P); }, copied.split('#')[0]).catch(() => null);
    if (noPh) { await lp.goto(noPh); await lp.waitForTimeout(600); }      // a new hash: the page reloads itself
    ok('pack 12d: no photos in the PDF: no Photos card, even with the gallery section in', !!noPh && (await lp.locator('.card').count()) === 8 && !(await lp.locator('.card[data-sec=photos]').count()));
    await lp.goto(copied.slice(0, copied.length - 60)); await lp.waitForTimeout(300);
    ok('pack 12d: a link cut short says so instead of showing half a pack', /This link is incomplete/.test(await lp.textContent('main')));
    await lc.close();
    // templates sheet and Settings
    await q.goto(BASE + '/index.html#pack'); await q.waitForTimeout(250); await q.click('.pk-tpl'); await q.waitForTimeout(100);
    ok('pack: Change › lists the templates, the default marked, with New template and Branding', (await q.textContent('.pk-trow b')) === 'Standard pack · in use' && (await q.textContent('.pk-def')) === 'Default' && (await q.locator('.pk-wide:has-text("New template")').count()) === 1 && (await q.locator('.pk-wide:has-text("Branding")').count()) === 1);
    await q.click('#settings-sheet .bs-done'); await q.waitForTimeout(60); await q.click('#gear'); await q.waitForTimeout(80);
    ok('pack: Settings has a Deal pack row (PRO) for a sourcer', (await q.locator('.st9-link:has(b:text-matches("^Deal pack"))').count()) === 1);
    await q.click('.st9-link:has(b:text-matches("^Deal pack"))'); await q.waitForTimeout(100); await q.click('.pk-wide:has-text("New template")'); await q.waitForTimeout(200);
    await q.click('.pk14-pvb'); await q.waitForTimeout(150);
    ok('pack: setup from Settings starts at step 1 and previews with example figures', (await q.textContent('.pk14-step')) === 'Step 1 of 5' && (await q.textContent('.pk14-pvh small')).endsWith('· example figures'));
    await q.click('.pk14-done'); await q.waitForTimeout(60);
    // a second deal gets its own pack; the first deal's pack comes back from Saved
    await q.click('#settings-sheet .bs-done').catch(() => {}); await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(250);
    q.removeAllListeners('dialog'); q.on('dialog', d => d.type() === 'prompt' ? d.accept('7 Kent Street') : d.accept());
    await q.click('.pin-save'); await q.waitForTimeout(150); await q.click('#settings-sheet .st9-link:has-text("Make a deal pack")'); await q.waitForTimeout(300);
    ok('pack: a second saved deal starts its own pack from the default template (no details or photos from the first)', (await q.url()).endsWith('#pack') && (await q.inputValue('.pk-field:has(span:text-is("Street address")) input')) === '7 Kent Street' && (await q.inputValue('.pk-field:has(span:text-is("Town")) input')) === '' && !(await q.locator('.pk-slot.cover img').count()) && (await q.textContent('.pk-go')) === 'Preview the pack · 5 pages');
    await q.goto(BASE + '/index.html#saved'); await q.waitForTimeout(250);
    await q.click('.rep10[aria-label="Deal pack for 12 Albert Road"]'); await q.waitForTimeout(300);
    ok('pack: the first deal’s Deal pack button brings its pack back, photo and all', (await q.inputValue('.pk-field:has(span:text-is("Town")) input')) === 'Margate' && (await q.locator('.pk-slot.cover img').count()) === 1 && (await q.textContent('.pk-go')) === 'Preview the pack · 4 pages');
    for (const w of [360, 430]) for (const scheme of ['dark', 'light']) {
      await q.setViewportSize({ width: w, height: 800 }); await q.emulateMedia({ colorScheme: scheme });
      for (const hsh of ['#pack', '#pack-preview', '#pack-setup']) { await q.goto(BASE + '/index.html' + hsh); await q.waitForTimeout(200);
        ok('pack: no sideways scrolling on ' + hsh + ' at ' + w + 'px, ' + scheme, (await q.evaluate(() => document.documentElement.scrollWidth)) <= w); }
    }
    await c.close();
    // ---- deal pack fixes (8 Oct 2026): the saved deal decides the figures; the address comes from the deal ----
    const tplSeed = { list: [{ id: 't1', name: 'Standard pack', look: 'classic', order: ['summary', 'figures', 'exits', 'evidence', 'epc', 'area', 'photos', 'fee', 'next'], off: {}, hide: false, fee: 3000, terms: 'x' }], def: 't1' };
    ({ c, q } = await fresh({ onboarded: true, persona: 'source', brrlet: 'none', packTemplates: tplSeed, deal: { endValue: 230000, purchasePrice: 125000, refurb: 30000, legal: 1500 } }));
    q.on('dialog', d => d.type() === 'prompt' ? d.accept('36 Kellet Avenue, Leyland PR25 5TE') : d.accept());
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(300);
    await q.click('.pin-save'); await q.waitForTimeout(150); await q.click('#settings-sheet .st9-link:has-text("Make a deal pack")'); await q.waitForTimeout(300);
    const fld = l => q.inputValue('.pk-field:has(span:text-is("' + l + '")) input');
    ok('fixes: the address comes from the saved deal: 36 Kellet Avenue / Leyland / PR25 5TE (never Margate)', (await q.url()).endsWith('#pack') && (await fld('Street address')) === '36 Kellet Avenue' && (await fld('Town')) === 'Leyland' && (await fld('Postcode')) === 'PR25 5TE');
    ok('fixes: a deal saved on Flip is a flip pack: Saved as Flip, no rent or lender rows, Rent figures off', (await q.textContent('.pk-savedas')) === 'Saved as Flip' && !(await q.locator('.pk-row:has-text("Lender pays")').count()) && (await q.getAttribute('.pk-tick-b[aria-label="Rent figures"]', 'aria-checked')) === 'false');
    await q.click('.pk-go'); await q.waitForTimeout(400);
    const fp = await q.$$eval('.pk-page .dp-page', ps => ps.map(p => p.innerText).join(' '));
    ok('fixes: the flip pack leads with the flip profit (£67,250), with no refinance anywhere', fp.includes('Profit if sold') && fp.includes('£67,250') && fp.includes('Margin on sale price') && !/refinance/i.test(fp) && /Flip · buy, refurb, sell/i.test(fp) && fp.includes('Leyland'), fp.slice(0, 300));
    await c.close();
    ({ c, q } = await fresh({ onboarded: true, persona: 'source', packTemplates: tplSeed, deal: { purchasePrice: 90000 } }));
    q.on('dialog', d => d.type() === 'prompt' ? d.accept('5 Mill Lane, Preston') : d.accept());
    await q.goto(BASE + '/index.html#c/hmo'); await q.waitForTimeout(300);
    await q.click('#sticky-bar button:text-is("Save")'); await q.waitForTimeout(150); await q.click('#settings-sheet .st9-link:has-text("Make a deal pack")'); await q.waitForTimeout(300);
    ok('fixes: a deal saved from HMO BTL: Saved as HMO BTL, its own figures (income, mortgage rate), no refinance rows', (await q.textContent('.pk-savedas')) === 'Saved as HMO BTL' && (await q.locator('.pk-row:has-text("Monthly income")').count()) === 1 && !(await q.locator('.pk-row:has-text("End value")').count()) && (await fld('Town')) === 'Preston');
    await q.click('.pk-go'); await q.waitForTimeout(400);
    const hp = await q.$$eval('.pk-page .dp-page', ps => ps.map(p => p.innerText).join(' '));
    ok('fixes: the HMO pack leads with monthly profit and return on money in, not a refinance', hp.includes('Monthly profit') && hp.includes('Return on money in') && hp.includes('Mortgage at 5% (interest only)') && !/refinance/i.test(hp) && /HMO BTL · buy and let by the room/i.test(hp), hp.slice(0, 300));
    await q.click('.pk-pin .pin-back'); await q.waitForTimeout(250); await q.click('.pk-more:text-is("Edit in calculator ›")'); await q.waitForTimeout(250);
    ok('fixes: Edit in calculator opens the screen the deal was saved from', (await q.url()).endsWith('#c/hmo'));
    await c.close();
    ({ c, q } = await fresh({ onboarded: true, persona: 'invest', pack: { look: 'classic', order: [], off: {}, hide: true, fee: 0, terms: '', prop: {}, client: '', note: '' } }));
    await q.goto(BASE + '/index.html#pack'); await q.waitForTimeout(300);
    ok('pack: not a sourcer: the deal pack is not there (address goes to the Calculator; no Deal pack buttons)', (await q.url()).endsWith('#calculators') && !(await q.locator('.pk12').count()));
    await c.close();
  }
  // ---- No funding to start with (Ashley, 15 Oct 2026): the BRR results on their own; Mortgage or Bridging if wanted ----
  {
    const fresh2 = async (seed) => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await c.addInitScript(sd => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); Object.keys(sd).forEach(k => localStorage.setItem('deal-analyser:' + k, JSON.stringify(sd[k]))); }, seed);
      const q = await c.newPage(); q.on('pageerror', e => errs.push(e.message)); return { c, q }; };
    let { c, q } = await fresh2({ onboarded: true, brrlet: 'btl', deal: { endValue: 230000, purchasePrice: 125000, refurb: 30000, legal: 1500 } });
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(300);
    ok('no funding: a new phone starts on No funding, selected, beside Mortgage and Bridging', (await q.$$eval('.fund11 .lg-seg button', bs => bs.map(b => b.textContent + ':' + b.getAttribute('aria-pressed')).join('|'))) === 'No funding:true|Mortgage:false|Bridging:false');
    ok('no funding: no mortgage or bridge figures; only the share the lender pays at the REFINANCE (75% = £172,500)', !(await q.locator('#lg-depositPct').count()) && !(await q.locator('.b1-row').count()) && (await q.inputValue('#lg-ltv')) === '75' && (await q.textContent('.fund11 .lg-chip .amt')) === '= £172,500 refinance' && !(await q.locator('.lk2b').count()));
    ok('no funding: your own money is the whole £162,750, no loan beside it, and it says so', (await q.textContent('.fund11-total')) === '£162,750' && !(await q.isVisible('.fund11-loan')) && (await q.textContent('.fund11-cap')) === 'Total to pay £162,750, all from you.');
    ok('no funding: the mortgage payments block says there is no loan until the refinance (£719 after it)', (await q.$$eval('.fund11-mtile', ts => ts.map(t => t.innerText.replace(/\s+/g, ' ').trim()).join('|'))) === 'Until the refinance No loan You buy with your own cash until the refinance|After the refinance £719 /mo On £172,500 after the refinance');
    ok('no funding: the answer is the BRR on its own: £9,750 pulled out, no bridging tag', /9,750/.test(await q.textContent('.pin')) && !(await q.isVisible('.pin-tag')));
    await q.click('.lg-seg button:text-is("Mortgage")'); await q.waitForTimeout(100);
    ok('choosing Mortgage brings the linked Lender pays / Deposit slider and a £69,000 own money with £93,750 borrowed; the results do not change', await q.isVisible('.lk2b') && (await q.textContent('.fund11-total')) === '£69,000' && (await q.textContent('.fund11-loanv')) === '£93,750' && /9,750/.test(await q.textContent('.pin')));
    await q.reload(); await q.waitForTimeout(300);
    ok('the choice is remembered', (await q.$eval('.fund11 .lg-seg button[aria-pressed=true]', e => e.textContent)) === 'Mortgage');
    await q.click('.lg-seg button:text-is("No funding")'); await q.waitForTimeout(100);
    await q.click('.exit-tile:has(.nm:text-is("Flip"))'); await q.waitForTimeout(100);
    ok('no funding on a flip: nothing to ask under How you’ll pay (no tiles, no mortgage payments), just your own money', !(await q.locator('.fund11 .lg-chip, .fund11 .lk2b, .fund11-mort').count()) && (await q.textContent('.fund11-total')) === '£162,750');
    await q.click('.lg-seg button:text-is("Bridging")'); await q.waitForTimeout(100);
    ok('choosing Bridging shows the bridge figures; going back to No funding hides them', (await q.locator('.b1-row').count()) === 8);
    await q.click('.lg-seg button:text-is("No funding")'); await q.waitForTimeout(100);
    ok('... and the bridge cost leaves the answer', !(await q.locator('.b1-row').count()) && !(await q.isVisible('.pin-tag')));
    await c.close();
    ({ c, q } = await fresh2({ onboarded: true, brrBridge: true, deal: { endValue: 230000, purchasePrice: 125000, refurb: 30000, legal: 1500 } }));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(300);
    ok('a phone that already had bridging on keeps it', (await q.$eval('.fund11 .lg-seg button[aria-pressed=true]', e => e.textContent)) === 'Bridging');
    await c.close();
  }
  ok('no page errors', !errs.length, JSON.stringify(errs));
  await b.close(); server.close(); console.log(fails ? fails + ' failed' : 'all browser checks passed'); process.exit(fails ? 1 : 0); });

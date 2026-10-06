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
  await ctx.addInitScript(() => { localStorage.setItem('deal-analyser:onboarded', 'true'); window.__buzz = 0; navigator.vibrate = () => { window.__buzz++; return true; }; });
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
  await price.locator('.rec-btn').click(); await p.waitForTimeout(60);
  const rec = await price.locator('.rec-amt').textContent();
  ok('Set price sets the recycle price', '£' + (await val('purchasePrice')) === rec, (await val('purchasePrice')) + ' vs ' + rec);
  ok('Set price buzzes once', (await p.evaluate(() => window.__buzz)) === buzz0 + 1);
  ok('the thumb glows', await sl.evaluate(e => e.classList.contains('snapped')));
  ok('the sub line says it snapped to the recycle price, in the good colour', (await price.locator('.lg-sub').textContent()) === '✓ Snapped to the recycle price' && await price.locator('.lg-sub').evaluate(e => e.classList.contains('good')));
  ok('only that slider glows', (await p.locator('.scrub.snapped').count()) === 1);
  await p.waitForTimeout(1000);
  ok('the glow and text go after 900ms', !(await sl.evaluate(e => e.classList.contains('snapped'))) && (await price.locator('.lg-sub').textContent()) === '');
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
  await fold('Your own money in').locator('.fold-head').click();
  ok('opening another closes the first', !(await fold('BTL figures').locator('.fold-body').isVisible()) && await fold('Your own money in').locator('.fold-body').isVisible());
  ok('closed cards show a one-line summary', /^Monthly income £1,000 · Mortgage rate 5%$/.test(await fold('BTL figures').locator('small').textContent()), await fold('BTL figures').locator('small').textContent());
  await fold('Paying for it').locator('.fold-head').click(); await p.click('.lg-seg button:has-text("Bridging loan")'); await p.waitForTimeout(100);
  ok('turning bridging on keeps Paying for it open', await fold('Paying for it').locator('.fold-body').isVisible() && (await fold('Paying for it').locator('.bridge-grid').count()) === 1);
  ok('its summary names the bridging cost', /^Bridging loan · £[\d,]+ cost$/.test(await fold('Paying for it').locator('small').textContent()));
  // A rent nudge and slider in the open let fold
  await fold('BTL figures').locator('.fold-head').click();
  const rent = await p.$eval('#lg-monthlyRent', e => e.value); await fold('BTL figures').locator('.nudge >> nth=1').click(); await p.waitForTimeout(50);
  ok('a rent + nudge steps the rent by £25', Number(await p.$eval('#lg-monthlyRent', e => e.value)) === Number(rent) + 25);
  // Exit switch keeps the remembered choice
  await p.click('.exit-tile:has(.nm:text-is("SA"))'); await p.waitForTimeout(80);
  ok('switching exit relabels the pill, heading and fold', (await p.locator('.pin-exit').textContent()) === 'BRR → SA' && (await p.locator('.lg-h >> nth=1').textContent()) === 'How SA does' && (await fold('SA figures').count()) === 1);
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
  ok('it stays open when the exit changes (remembered), and a flip has one chip: 25% margin', await p.isVisible('.vs-chips') && (await p.locator('.vs-chip').allTextContents()).join() .endsWith('25% margin') && (await p.locator('.vs-chip').count()) === 1);
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
  ok('the other calculators keep their Save / Compare bar', await p.isVisible('#sticky-bar') && (await p.locator('#sticky-bar button').count()) === 2);
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
  ok('Settings has Your targets (with the summary), Stamp duty and Privacy policy', (await p.locator('#settings-sheet .pick').allTextContents()).join('|').includes('Your targets30% flip · £400/mo · 50% ROI · 6 mo back'));
  await p.click('#settings-sheet .pick:has-text("Your targets")'); await p.waitForTimeout(60);
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
  ok('Privacy policy opens with its six headings', (await p.locator('.bs-h').count()) === 6 && (await p.locator('.big-sheet h2').textContent()) === 'Privacy policy');
  const sheetTaps = await p.evaluate(() => [...document.querySelectorAll('#settings-sheet button')].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().height)).filter(h => h < 44));
  ok('sheet buttons are 44px tall or more', !sheetTaps.length, JSON.stringify(sheetTaps));
  await p.click('.bs-done');
  await p.goto(BASE + '/privacy.html'); await p.waitForTimeout(150);
  ok('the standalone privacy page opens with the same six headings', (await p.locator('h2').count()) === 6 && (await p.locator('h1').textContent()) === 'Privacy policy');
  // ---- design 7a: the order of the deal and "Any other costs" ----
  await p.goto(BASE + '/index.html#c/brr'); await p.waitForTimeout(300);
  const order = await p.evaluate(() => [...document.querySelectorAll('#v-home > .lg-card')].map(c => c.classList.contains('tax-card') ? 'stamp duty' : (c.querySelector('.lg-label') || {}).textContent));
  ok('The deal reads: End value, Refurb, Legal, Any other costs, Stamp duty (its own card), Purchase price', order.join(' | ') === 'End value (GDV) | Refurb costs | Legal costs | Any other costs | stamp duty | Purchase price', order.join(' | '));
  ok('the purchase price card no longer holds the stamp duty', !(await p.locator('.deal-card:has(#lg-purchasePrice) .tax-block').count()) && (await p.locator('.deal-card:has(#lg-purchasePrice) .rec-btn').count()) === 1);
  const oc = p.locator('.deal-card:has(#lg-otherUpfront)');
  ok('Any other costs starts at £0 with its own explanation', (await p.$eval('#lg-otherUpfront', e => e.value)) === '' && (await oc.locator('.lg-sub').textContent()) === 'Survey, valuation, broker: anything else up front');
  await oc.locator('.nudge >> nth=1').click(); await p.waitForTimeout(40);
  ok('+ adds £100', (await p.$eval('#lg-otherUpfront', e => e.value)) === '100');
  await p.fill('#lg-otherUpfront', '1000'); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(60);
  if (!(await p.isVisible('.exit-tile.on:has(.nm:text-is("Flip"))'))) { await p.click('.exit-tile:has(.nm:text-is("Flip"))'); await p.waitForTimeout(80); }
  await fold('Your own money in').locator('.fold-head').click(); await p.waitForTimeout(40);
  ok('"Your own money in" lists Other costs £1,000, after Legal costs', (await fold('Your own money in').locator('.lg-stat span').allTextContents()).join('|').includes('Legal costs|Other costs|Refurb costs') && (await fold('Your own money in').locator('.lg-stat:has(span:text-is("Other costs")) b').textContent()) === '£1,000');
  await p.click('.clear-pill'); await p.waitForTimeout(60);
  ok('Clear figures empties any other costs too', (await p.$eval('#lg-otherUpfront', e => e.value)) === '');
  await p.click('.pin-reset'); await p.waitForTimeout(60);
  ok('Reset puts it back to its starting £0', (await p.$eval('#lg-otherUpfront', e => e.value)) === '');
  ok('no page errors', !errs.length, JSON.stringify(errs));
  await b.close(); server.close(); console.log(fails ? fails + ' failed' : 'all browser checks passed'); process.exit(fails ? 1 : 0); });

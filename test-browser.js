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
  ok('Settings has Your targets (with the summary), Stamp duty and Privacy policy', (await p.locator('#settings-sheet .s6-link').allTextContents()).join('|').includes('Your targets30% flip · £400/mo · 50% ROI · 6 mo back'));
  await p.click('#settings-sheet .s6-link:has-text("Your targets")'); await p.waitForTimeout(60);
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
  await p.evaluate(() => scrollTo(0, 0)); await p.click('#gear'); await p.click('#settings-sheet .s6-link:has-text("Your targets")'); await p.waitForTimeout(60); opens.settings = await p.isVisible('.big-sheet .tg-row'); await p.click('.bs-done');
  ok('the targets sheet opens from "Edit targets →", the footer and Settings', opens.strip && opens.footer && opens.settings, JSON.stringify(opens));

  // ---- design 7a: the order of the deal and "Any other costs" ----
  await p.goto(BASE + '/index.html#c/brr'); await p.waitForTimeout(300);
  const order = await p.evaluate(() => [...document.querySelectorAll('#v-home .lg-figures > .lg-card')].map(c => c.classList.contains('tax-card') ? 'stamp duty' : (c.querySelector('.lg-label') || {}).textContent));
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
  // ---- design 8a: Figures | Results under the exit tiles ----
  {
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await c2.addInitScript(() => { localStorage.setItem('deal-analyser:onboarded', 'true'); });
    const q = await c2.newPage(); q.on('pageerror', e => errs.push(e.message));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(300);
    for (const [id, v] of [['lg-endValue', 230000], ['lg-purchasePrice', 125000], ['lg-refurb', 45000], ['lg-legal', 3000]]) await q.fill('#' + id, String(v));
    await q.evaluate(() => document.activeElement.blur()); await q.click('.exit-tile:has(.nm:text-is("BTL"))'); await q.waitForTimeout(100);
    const pressed = () => q.$$eval('.lg-switch button', bs => bs.map(x => x.textContent + ':' + x.getAttribute('aria-pressed')).join());
    ok('8a: the switch sits right under the exit tiles and starts on Figures', await q.evaluate(() => document.querySelector('.lg-exits').nextElementSibling.classList.contains('lg-switch')) && (await pressed()) === 'Figures:true,Results:false', await pressed());
    ok('8a: Figures holds The deal, its cards, Lender pays / Deposit and More detail; Results is hidden', await q.evaluate(() => { const f = document.querySelector('.lg-figures'); return !!(f.querySelector('.clear-pill') && f.querySelector('#lg-endValue') && f.querySelector('.tax-card') && f.querySelector('.rec-btn') && f.querySelector('.lg-chips') && f.querySelectorAll('.lg-fold').length === 3) && document.querySelector('.lg-results').hidden; }));
    ok('8a: each switch button is at least 44px tall', (await q.$$eval('.lg-switch button', bs => bs.every(x => x.getBoundingClientRect().height >= 44))));
    await q.click('.lg-switch button:text-is("Results")'); await q.waitForTimeout(100);
    const sw = await q.evaluate(() => ({ sw: document.querySelector('.lg-switch').getBoundingClientRect().top, pin: document.querySelector('.pin').getBoundingClientRect().bottom }));
    ok('8a: Results shows How BTL does, the 7 tiles, Your own money in and Change the figures; Figures is hidden', (await q.isVisible('.lg-results .lg-h:text-is("How BTL does")')) && (await q.locator('.lg-results .lg-tile').count()) === 7 && (await q.isVisible('.own-card')) && (await q.isVisible('.lg-back')) && !(await q.isVisible('#lg-endValue')));
    ok('8a: switching puts the switch just under the pinned panel', sw.sw >= sw.pin && sw.sw - sw.pin <= 16, JSON.stringify(sw));
    ok('8a: Results tiles are larger (22px figures, 14px padding)', await q.$eval('.lg-results .lg-tile', t => getComputedStyle(t.querySelector('b')).fontSize === '22px' && getComputedStyle(t).paddingTop === '14px'));
    const ownCard = await q.$$eval('.own-card .lg-stat', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')).join('|'));
    const ownFold = await q.$$eval('.lg-fold .lg-stat', rs => rs.map(r => r.textContent).length);
    ok('8a: the own money card lists deposit, stamp duty, legal, refurb, mortgage and total', /Deposit \(25% of £125,000\) £31,250\|Stamp duty £6,250\|Legal costs £3,000\|Refurb costs £45,000\|Mortgage covers £93,750\|Total money in/.test(ownCard), ownCard);
    ok('8a: ... with the same summary as the fold', (await q.textContent('.own-card-head small')) === '£85,500 · total in £179,250' && ownFold > 0);
    // a change on Figures shows straight away in Results and the panel
    const before = await q.textContent('.lg-results .lg-tile >> nth=4');
    await q.click('.lg-switch button:text-is("Figures")'); await q.fill('#lg-purchasePrice', '115000'); await q.evaluate(() => document.activeElement.blur()); await q.waitForTimeout(80);
    await q.click('.lg-switch button:text-is("Results")'); await q.waitForTimeout(80);
    ok('8a: a figure changed under Figures shows at once in Results and in the own money card', (await q.textContent('.lg-results .lg-tile >> nth=4')) !== before && (await q.textContent('.own-card-head small')).includes('total in £16'), await q.textContent('.own-card-head small'));
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
    await c3.addInitScript(() => { localStorage.setItem('deal-analyser:onboarded', 'true'); });
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
    await q.goto(BASE + '/index.html#saved'); await q.waitForTimeout(250); await q.click('.deal .open'); await q.waitForTimeout(250);
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
  // ---- My usual figures in the Calculator's look ----
  {
    const c5 = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await c5.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('deal-analyser:onboarded', 'true'); });
    const q = await c5.newPage(); q.on('pageerror', e => errs.push(e.message));
    await q.goto(BASE + '/index.html#usual'); await q.waitForTimeout(250);
    const look = await q.evaluate(() => ({ fonts: [...new Set([...document.querySelectorAll('#v-usual *')].map(e => getComputedStyle(e).fontFamily.split(',')[0].replace(/"/g, '')))], heads: [...document.querySelectorAll('#v-usual .lg-h')].map(e => e.textContent).join('|'), cards: document.querySelectorAll('#v-usual .u6-card').length, rows: document.querySelectorAll('#v-usual .u6-row').length, oldBits: document.querySelectorAll('#v-usual .hero, #v-usual .eyebrow, #v-usual .fig-card, #v-usual .pick').length, small: [...document.querySelectorAll('#v-usual input, #v-usual button')].filter(e => e.getBoundingClientRect().height < 44).length }));
    ok('usual figures: one font (Geist), section headings like the Calculator, rounded cards, no serif title', look.fonts.join() === 'Geist' && look.heads === 'Buying costs|Finance|Letting' && look.cards === 3 && look.rows === 6 && look.oldBits === 0, JSON.stringify(look));
    ok('usual figures: every box and button 44px or more', look.small === 0);
    await q.fill('#u-legal', '2500'); await q.waitForTimeout(40);
    ok('usual figures: a typed figure is saved', (await q.evaluate(() => JSON.parse(localStorage.getItem('deal-analyser:usual')).legal)) === '2500');
    await q.click('.u6-clear'); await q.waitForTimeout(60);
    ok('usual figures: Clear empties them and shows the examples again', (await q.$eval('#u-legal', e => e.value)) === '' && (await q.$eval('#u-legal', e => e.placeholder)) !== '' && (await q.evaluate(() => localStorage.getItem('deal-analyser:usual'))) === '{}');
    ok('usual figures: no sideways scroll', await q.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await c5.close();
  }
  // ---- Settings in the Calculator's look ----
  {
    const c6 = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await c6.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('deal-analyser:onboarded', 'true'); });
    const q = await c6.newPage(); q.on('pageerror', e => errs.push(e.message));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(250); await q.click('#gear'); await q.waitForTimeout(100);
    const look = await q.evaluate(() => { const s = document.getElementById('settings-sheet'); return { big: s.classList.contains('big-sheet'), title: s.querySelector('.bs-head h2').textContent, done: !!s.querySelector('.bs-done'), heads: [...s.querySelectorAll('.s6-h')].map(e => e.textContent).join('|'), groups: s.querySelectorAll('.s6-group').length, links: [...s.querySelectorAll('.s6-link b')].map(e => e.textContent).join('|'), fonts: [...new Set([...s.querySelectorAll('*')].map(e => getComputedStyle(e).fontFamily.split(',')[0].replace(/"/g, '')))].join(), small: [...s.querySelectorAll('button')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).length }; });
    ok('Settings: drawn like the targets sheet (heading and Done, three groups of rounded rows, one font)', look.big && look.title === 'Settings' && look.done && look.heads === 'Appearance|Your figures|About' && look.groups === 3 && look.links === 'My usual figures|Your targets|Stamp duty|Privacy policy|Redo the setup questions' && look.fonts === 'Geist' && look.small === 0, JSON.stringify(look));
    const expRow = () => q.$eval('.s6-row:has(b:text-is("Explanations"))', e => e.getAttribute('aria-checked'));
    const before = await expRow(); await q.click('.s6-row:has(b:text-is("Explanations"))'); await q.waitForTimeout(60);
    ok('Settings: tapping the Explanations row switches it (and saves it)', (await expRow()) === String(before !== 'true') && String(await q.evaluate(() => JSON.parse(localStorage.getItem('deal-analyser:explanations')))) === (await expRow()), before + ' -> ' + (await expRow()));
    await q.click('.theme-row:has(b:text-is("Light"))'); await q.waitForTimeout(80);
    ok('Settings: choosing Light switches the theme and ticks it', (await q.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'light' && (await q.$eval('.theme-row:has(b:text-is("Light"))', e => e.getAttribute('aria-pressed'))) === 'true');
    await q.click('.s6-link:has(b:text-is("My usual figures"))'); await q.waitForTimeout(150);
    ok('Settings: My usual figures opens its screen and closes the sheet', (await q.url()).endsWith('#usual') && !(await q.isVisible('#settings-sheet')));
    await q.goto(BASE + '/index.html#c/brr'); await q.waitForTimeout(250); await q.click('#gear'); await q.waitForTimeout(80); await q.click('.bs-done'); await q.waitForTimeout(60);
    ok('Settings: Done closes it', !(await q.isVisible('#settings-sheet')));
    await c6.close();
  }
  ok('no page errors', !errs.length, JSON.stringify(errs));
  await b.close(); server.close(); console.log(fails ? fails + ' failed' : 'all browser checks passed'); process.exit(fails ? 1 : 0); });

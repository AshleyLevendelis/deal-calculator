// Checks every calculator, at its default (spreadsheet example) values, against the numbers cached in each spreadsheet.
const Calc = require('./calc.js');
let fail = 0, ran = 0;
const eq = (name, got, want) => {
  ran++; const ok = typeof want === 'string' || got === want ? got === want : Math.abs(got - want) < 1e-6;
  if (!ok) fail++; console.log((ok ? 'ok:   ' : 'FAIL: ') + name, got, ok ? '' : '(want ' + want + ')');
};
const run = (id, over) => { const c = Calc.find(id); return c.compute(Object.assign({}, Calc.defaults(c), over || {})).v; };

// [calculator, spreadsheet cell values]
let v = run('btl');
eq('BTL total cash required', v.totalIn, 189250); eq('BTL expenses', v.expenses, 1969.375); eq('BTL monthly', v.monthly, -969.375);
eq('BTL annual', v.annual, -11632.5); eq('BTL ROI', v.roi, -0.061466314398943199);
v = run('hmo');
eq('HMO income', v.income, 1620); eq('HMO total in', v.totalIn, 29000); eq('HMO expenses', v.expenses, 996.25); eq('HMO monthly', v.monthly, 623.75);
eq('HMO annual', v.annual, 7485); eq('HMO ROI', v.roi, 0.25810344827586207); eq('HMO breakeven', v.breakeven, 46.492985971943888);
v = run('hmobrr');
eq('BRR-HMO total in', v.totalIn, 159000); eq('BRR-HMO new mortgage', v.newMortgage, 165000); eq('BRR-HMO money left in', v.cashLeft, -6000);
eq('BRR-HMO expenses', v.expenses, 2113.5); eq('BRR-HMO monthly', v.monthly, 266.5); eq('BRR-HMO annual', v.annual, 3198);
eq('BRR-HMO ROI when money is out', v.roi, '∞ (no cash left in)');
v = run('hmobrr', { endValue: 150000 });   // money left in, so ROI is a real number: annual / cash left
eq('BRR-HMO ROI with cash left in', v.roi, v.annual / v.cashLeft);
v = run('sabrr');
eq('BRR-SA total in', v.totalIn, 175350); eq('BRR-SA cash left', v.cashLeft, 25350); eq('BRR-SA income', v.income, 2701);
eq('BRR-SA expenses', v.expenses, 1637.15); eq('BRR-SA monthly', v.monthly, 1063.85); eq('BRR-SA annual', v.annual, 12766.2);
eq('BRR-SA ROI', v.roi, 0.50359763313609462); eq('BRR-SA breakeven', v.breakeven, 23.828547257602107);
v = run('sabtl');
eq('SA BTL total in', v.totalIn, 108250); eq('SA BTL income', v.income, 5398.958333333333); eq('SA BTL expenses', v.expenses, 2590.21875);
eq('SA BTL monthly', v.monthly, 2808.739583333333); eq('SA BTL annual', v.annual, 33704.875);
eq('SA BTL ROI', v.roi, 0.31136143187066972); eq('SA BTL breakeven', v.breakeven, 38.540418856322717);
v = run('r2rhmo');
eq('R2R-HMO total in', v.totalIn, 7132); eq('R2R-HMO income', v.income, 3000); eq('R2R-HMO expenses', v.expenses, 2300);
eq('R2R-HMO monthly', v.monthly, 700); eq('R2R-HMO annual', v.annual, 8400); eq('R2R-HMO ROI', v.roi, 1.1777902411665733);
v = run('r2rsa');
eq('R2R-SA total in', v.totalIn, 3834); eq('R2R-SA income', v.income, 2874.375); eq('R2R-SA expenses', v.expenses, 2179.15625);
eq('R2R-SA monthly', v.monthly, 695.21875); eq('R2R-SA annual', v.annual, 8342.625); eq('R2R-SA ROI', v.roi, 2.1759585289514867);

// Not-profitable case: breakeven says so instead of a negative number of months
eq('BTL breakeven when loss-making', run('btl').breakeven, 'Not at this profit');
// Stamp duty override flows into money in
eq('a typed stamp duty is ignored: it is always worked out, as in the sheet', run('btl', { stampDutyOverride: 1000 }).totalIn, run('btl', {}).totalIn);

// Every calculator: every result row and summary value the screen asks for exists and is a real number or text (never NaN/undefined)
for (const c of Calc.calcs) {
  const val = run(c.id); let bad = [];
  c.layout.forEach(sec => sec.items.forEach(it => { if (it.calc && (val[it.calc.id] === undefined || (typeof val[it.calc.id] === 'number' && !isFinite(val[it.calc.id])))) bad.push(it.calc.id); }));
  c.summary.forEach(s => { if (val[s[1]] === undefined) bad.push('summary:' + s[1]); });
  eq(c.id + ': every screen value is computed (' + bad.join(',') + ')', bad.length, 0);
  // blank inputs must not produce NaN anywhere
  const blank = {}; Object.keys(Calc.defaults(c)).forEach(k => blank[k] = '');
  const bv = c.compute(blank).v; const nan = Object.keys(bv).filter(k => typeof bv[k] === 'number' && !isFinite(bv[k]));
  eq(c.id + ': blank inputs give no NaN (' + nan.join(',') + ')', nan.length, 0);
}
// ---- One deal, entered once, read by every calculator that has the field ----
const idsOf = c => Object.keys(Calc.defaults(c));
const users = {}; Calc.calcs.forEach(c => idsOf(c).forEach(id => (users[id] = users[id] || []).push(c.id)));
const shared = {}; Object.keys(users).filter(id => users[id].length > 1).sort().forEach(id => shared[id] = users[id].join(','));
// The exact set of shared ids is pinned: an id is shared only where the sheets mean the same thing by it.
// Maintenance is three different ids because the sheets take it off income, off the mortgage, or off the rent you pay.
const wantShared = {
  purchasePrice: 'flip,btl,hmo,sabtl,hmobrr,sabrr', depositPct: 'flip,btl,hmo,sabtl,hmobrr,sabrr',
  legal: 'flip,btl,hmo,sabtl,hmobrr,sabrr', refurb: 'flip,btl,hmo,sabtl,hmobrr,sabrr,r2rhmo,r2rsa',
  furnishing: 'sabtl,hmobrr,sabrr,r2rhmo,r2rsa', otherUpfront: 'flip,btl,hmo,sabtl,hmobrr,sabrr,r2rhmo,r2rsa',   // every buy calculator since 6 Oct 2026 (design 7a)
  endValue: 'flip,hmobrr,sabrr', ltv: 'flip,hmobrr,sabrr',
  mortgageRate: 'flip,btl,hmo,sabtl,hmobrr,sabrr', mgmtPct: 'flip,btl,hmo,hmobrr,r2rhmo', monthlyRent: 'flip,btl',
  roomRate: 'hmo,hmobrr,r2rhmo', rooms: 'hmo,sabtl,hmobrr,sabrr,r2rhmo,r2rsa', nightlyRate: 'sabtl,sabrr,r2rsa', occupancyPct: 'sabtl,sabrr,r2rsa',
  council: 'hmo,sabtl,hmobrr,sabrr,r2rhmo,r2rsa', utilities: 'hmo,sabtl,hmobrr,sabrr,r2rhmo,r2rsa', other: 'btl,hmo,hmobrr',
  maintPct: 'hmo,hmobrr', maintOnMortgagePct: 'sabtl,sabrr', maintOnRentPct: 'r2rhmo,r2rsa', commPct: 'sabtl,sabrr,r2rsa', channel: 'sabtl,sabrr,r2rsa',
  voidsPct: 'flip,btl', rentPaid: 'r2rhmo,r2rsa', upfront: 'r2rhmo,r2rsa'
};
eq('the set of shared fields is exactly the designed one', JSON.stringify(shared), JSON.stringify(Object.keys(wantShared).sort().reduce((o, k) => (o[k] = wantShared[k], o), {})));

// Typing a purchase price + deposit once changes the deposit in every calculator that buys a property
const deal = { purchasePrice: 200000, depositPct: 20 };
const buyers = Calc.calcs.filter(c => idsOf(c).includes('purchasePrice'));
buyers.forEach(c => eq(c.id + ': shared deal sets the deposit (40,000)', c.compute(Calc.stateFor(c, deal)).v.deposit, 40000));
eq('six calculators buy a property', buyers.length, 6);
// ...and does nothing to a calculator that has no purchase (rent-to-rent)
['r2rhmo', 'r2rsa'].forEach(id => { const c = Calc.find(id); eq(id + ': unaffected by purchase price', c.compute(Calc.stateFor(c, deal)).v.totalIn, run(id).totalIn); });
// Room rate typed once reaches every by-the-room calculator; nightly rate every serviced-accommodation one
['hmo', 'hmobrr', 'r2rhmo'].forEach(id => { const c = Calc.find(id); eq(id + ': room rate x rooms', c.compute(Calc.stateFor(c, { roomRate: 500, rooms: 5 })).v.income, 2500); });
['sabtl', 'sabrr', 'r2rsa'].forEach(id => { const c = Calc.find(id); eq(id + ': nightly x rooms x occupancy', c.compute(Calc.stateFor(c, { nightlyRate: 100, rooms: 2, occupancyPct: 50 })).v.income, 100 * 2 * 365 * 0.5 / 12); });
// Maintenance typed for an HMO does not leak into SA or rent-to-rent (different bases in the sheets)
const before = run('sabtl').expenses, leak = Calc.find('sabtl').compute(Calc.stateFor(Calc.find('sabtl'), { maintPct: 99, maintOnRentPct: 99 })).v.expenses;
eq('HMO / R2R maintenance % does not change SA BTL', leak, before);
// Extra keys in a deal that a calculator does not use are ignored
eq('unrelated deal keys ignored', Calc.find('btl').compute(Calc.stateFor(Calc.find('btl'), { nightlyRate: 999, upfront: 5 })).v.totalIn, 189250);
// Older saved deals keep working: per-calculator ids are renamed to the shared ones
eq('migrate flip gdv', JSON.stringify(Calc.migrate('flip', { gdv: 1, remortgageLtv: 2, managementPct: 3, legal: 4 })), JSON.stringify({ endValue: 1, ltv: 2, mgmtPct: 3, legal: 4 }));
eq('migrate r2rsa', JSON.stringify(Calc.migrate('r2rsa', { rent: 1, maintPct: 2, deposit: 3, staging: 4 })), JSON.stringify({ rentPaid: 1, maintOnRentPct: 2, upfront: 3, furnishing: 4 }));
eq('migrated old flip deal gives the old answer', Calc.find('flip').compute(Calc.stateFor(Calc.find('flip'), Calc.migrate('flip', { gdv: 300000 }))).v.profit, 300000 - 179250);

// ---- Compare ----
const cmp = Calc.compareAll({});
eq('compare has a row for every calculator', cmp.rows.map(r => r.id).join(','), Calc.calcs.map(c => c.id).join(','));
// each row is exactly that calculator's own answer
const row = id => cmp.rows.find(r => r.id === id);
eq('compare HMO BTL ROI = sheet', row('hmo').roi, 0.25810344827586207); eq('compare HMO BTL monthly = sheet', row('hmo').monthly, 623.75);
eq('compare R2R SA ROI = sheet', row('r2rsa').roi, 2.1759585289514867); eq('compare SA BTL money in = sheet', row('sabtl').moneyIn, 108250);
eq('compare BRR to SA left in = sheet', row('sabrr').cashLeft, 25350); eq('compare BRR to SA ROI = sheet', row('sabrr').roi, 0.50359763313609462);
eq('compare BRR to BTL ROI = sheet', row('flip').roi, 0.14444444444444443); eq('compare BTL breakeven text', row('btl').breakeven, 'Not at this profit');
eq('compare flip profit (one-off) = sheet', cmp.flip.profit, 50750); eq('compare flip margin = sheet', cmp.flip.margin, 0.22065217391304348);
eq('only the refinance calculators report cash left in', cmp.rows.filter(r => r.refinance).map(r => r.id).sort().join(','), 'flip,hmobrr,sabrr');
// ranking: no cash left in beats any number, a real number beats "no ROI", and higher beats lower
eq('rank: no cash left in is top', Calc.rank('∞ (no cash left in)'), Infinity); eq('rank: dash is bottom', Calc.rank('—'), -Infinity);
eq('rank: numbers rank as themselves', Calc.rank(0.25), 0.25);
eq('BRR to HMO (money out) ranks above every number', cmp.rows.slice().sort((a, b) => Calc.rank(b.roi) - Calc.rank(a.roi) || 0)[0].id, 'hmobrr');
// the shared deal drives the comparison: a bigger deposit changes buy calculators, never rent-to-rent
const cmp2 = Calc.compareAll({ purchasePrice: 200000, depositPct: 50 });
eq('compare: BTL money in follows the shared deal', cmp2.rows.find(r => r.id === 'btl').moneyIn, 100000 + Calc.stampDuty(200000) + 3000 + 2000);
eq('compare: R2R HMO ignores the purchase', cmp2.rows.find(r => r.id === 'r2rhmo').moneyIn, row('r2rhmo').moneyIn);
eq('compare: nothing is NaN', cmp2.rows.filter(r => [r.moneyIn, r.monthly, r.annual].some(x => !isFinite(x))).length, 0);

// ---- Compare saved deals ----
const dealA = { id: 'a', name: '1 High St', calc: 'btl', data: { purchasePrice: 150000, depositPct: 25, monthlyRent: 1200 } };
const dealB = { id: 'b', name: '9 Mill Rd', calc: 'hmo', data: { purchasePrice: 90000, roomRate: 405, rooms: 4 } };
const dealC = { id: 'c', name: 'Flat 3', calc: 'r2rsa', data: {} };
const own = Calc.compareDeals([dealA, dealB, dealC]);
eq('one row per saved deal, in the order given', own.map(r => r.name).join(','), '1 High St,9 Mill Rd,Flat 3');
eq('each deal goes through the calculator it was saved from', own.map(r => r.calcName).join(','), 'BTL,HMO BTL,R2R SA');
eq('a deal row is that calculator\'s own answer (BTL)', own[0].moneyIn, Calc.find('btl').compute(Calc.stateFor(Calc.find('btl'), dealA.data)).v.totalIn);
eq('HMO deal row = the HMO sheet answer', own[1].roi, Calc.find('hmo').compute(Calc.stateFor(Calc.find('hmo'), dealB.data)).v.roi);
eq('R2R deal with no typed details = the R2R sheet example', own[2].roi, 2.1759585289514867);
eq('rows carry the key that identifies the saved deal', own.map(r => r.key).join(','), 'a,b,c');
// Judge two properties as the same strategy
const asBtl = Calc.compareDeals([dealA, dealB], 'btl');
eq('"as BTL" runs every deal through BTL', asBtl.map(r => r.calcName).join(','), 'BTL,BTL');
eq('"as BTL": the second deal now uses its own price (90,000)', asBtl[1].moneyIn, Calc.find('btl').compute(Calc.stateFor(Calc.find('btl'), dealB.data)).v.totalIn);
eq('"as BTL": the two deals give different answers', asBtl[0].moneyIn !== asBtl[1].moneyIn, true);
eq('a deal keeps its own name whatever calculator it is run as', asBtl[1].name, '9 Mill Rd');
eq('an unknown calculator falls back rather than crashing', Calc.compareDeals([{ id: 'x', name: 'Old', calc: 'gone', data: {} }])[0].calcId, 'flip');
eq('ranking works on deal rows', Calc.compareDeals([dealA, dealB, dealC]).slice().sort((a, b) => Calc.rank(b.roi) - Calc.rank(a.roi))[0].name, 'Flat 3');
eq('compareAll still returns the flip block', Calc.compareAll({}).flip.profit, 50750);

// ---- Flip target: 25% net profit (of end value) is acceptable; at or above is good, below is bad ----
eq('flip target is 25%', Calc.FLIP_TARGET, 0.25);
eq('exactly 25% is acceptable', Calc.flipVerdict(0.25), 'good');
eq('24.9% is an OK flip (amber)', Calc.flipVerdict(0.249), 'ok');
eq('exactly 20% is an OK flip (amber), not a pass', Calc.flipVerdict(0.2), 'ok');
eq('19.9% is weak (red)', Calc.flipVerdict(0.199), 'bad');
eq('19.96% shows as 20.0%, so it is amber', Calc.flipVerdict(0.1996), 'ok');
eq('19.94% shows as 19.9%, so it is red', Calc.flipVerdict(0.1994), 'bad');
eq('the OK band starts at 20%', Calc.FLIP_OK, 0.2);
eq('25.1% is acceptable', Calc.flipVerdict(0.251), 'good');
eq('a shown 25.0% is never coloured as a miss (24.96% rounds to 25.0%)', Calc.flipVerdict(0.2496), 'good');
eq('24.94% shows as 24.9%: below the target, so amber', Calc.flipVerdict(0.2494), 'ok');
eq('a loss is bad', Calc.flipVerdict(-0.05), 'bad');
eq('zero profit is bad', Calc.flipVerdict(0), 'bad');
eq('no figure gives no verdict', String(Calc.flipVerdict(null)) + String(Calc.flipVerdict('—')) + String(Calc.flipVerdict(NaN)), 'nullnullnull');
// through the real calculator: the sheet's example flip is 22.1% (good); a lower end value makes it bad
const flipCalc = Calc.find('flip');
const marginAt = endValue => flipCalc.compute(Calc.stateFor(flipCalc, { endValue })).v.margin;
eq('sheet example flip (22.1%) is below the 25% target but an OK flip (amber)', Calc.flipVerdict(marginAt(230000)), 'ok');
eq('the same deal at 250,000 end value (28.4%) is good', Calc.flipVerdict(marginAt(250000)), 'good');
eq('same deal at 200,000 end value (10.4%) is bad', Calc.flipVerdict(marginAt(200000)), 'bad');
eq('the flip margin row is the one marked for the target', JSON.stringify(flipCalc.layout.flatMap(s => s.items).filter(i => i.calc && i.calc.verdict === 'flip').map(i => i.calc.id)), '["margin"]');
eq('no other calculator marks a row for the flip target', Calc.calcs.filter(c => c.id !== 'flip').flatMap(c => c.layout.flatMap(s => s.items)).filter(i => i.calc && i.calc.verdict === 'flip').length, 0);
eq('compare tab flip block carries the margin the verdict is judged on', Calc.compareAll({ endValue: 200000 }).flip.margin, marginAt(200000));

// ---- Field registry (the "Your deal" screen) ----
const reg = Calc.fieldRegistry();
eq('27 distinct fields across all calculators', reg.total, 27);
eq('every field appears in exactly one group', reg.groups.reduce((n, g) => n + g.fields.length, 0), reg.total);
eq('no group named "Other" is needed (every field was placed)', reg.groups.some(g => g.id === 'other'), false);
eq('seven groups', reg.groups.length, 7);
eq('purchase price is used by every buying calculator', reg.byId.purchasePrice.usedBy.sort().join(','), ['flip', 'btl', 'hmo', 'sabtl', 'hmobrr', 'sabrr'].sort().join(','));
eq('a rent-to-rent-only field lists only the two rent-to-rent calculators', reg.byId.rentPaid.usedBy.sort().join(','), 'r2rhmo,r2rsa');
eq('an unshared field (insurance) lists only its one calculator', reg.byId.insurance.usedBy.join(','), 'btl');
eq('adding usedBy is derived, not hand-written: BTL is not credited with a field it does not have', reg.byId.roomRate.usedBy.includes('btl'), false);
eq('every group has at least one field', reg.groups.every(g => g.fields.length > 0), true);

// ---- Bridging loan: a cost tool, not a ranked strategy ----
eq('bridging is not one of the 8 ranked calculators', Calc.calcs.some(c => c.id === 'bridging'), false);
eq('bridging is found via Calc.find, like any calculator', Calc.find('bridging').id, 'bridging');
eq('the tools are bridging and recycle', Calc.tools.map(t => t.id).join(','), 'bridging,recycle');
eq('bridging fields do not leak into the 27-field "Your deal" registry', Calc.fieldRegistry().total, 27);
const bridge = Calc.find('bridging'), runBridge = over => bridge.compute(Object.assign({}, Calc.defaults(bridge), over)).v;
let hand = 150000; for (let i = 0; i < 9; i++) hand += hand * 0.0085;
const def = runBridge({});
eq('rolled-up interest compounds monthly (hand-calculated)', def.totalInterest, hand - 150000);
eq('redemption = loan + rolled interest + exit fee', def.redemption, hand - 150000 + 150000 + 1500);
eq('total cost = every fee + interest', def.totalCost, 3000 + 350 + 1200 + 0 + def.totalInterest + 1500);
eq('net advance = loan minus arrangement, valuation and broker fee only (not interest, not legal)', def.netAdvance, 150000 - 3000 - 350 - 0);
eq('no monthly payment shown when interest is rolled up', def.monthlyPayment, null);
const monthly = runBridge({ interestType: 'monthly' });
eq('paid-monthly: simple (non-compounding) interest', monthly.totalInterest, 150000 * 0.0085 * 9);
eq('paid-monthly: monthly payment shown', monthly.monthlyPayment, 150000 * 0.0085);
eq('paid-monthly: redemption is just the loan + exit fee (interest already paid)', monthly.redemption, 150000 + 1500);
eq('paid-monthly redemption is lower than rolled-up redemption (no compounding added to the balance)', monthly.redemption < def.redemption, true);
eq('zero-term loan has no interest', runBridge({ termMonths: 0 }).totalInterest, 0);
eq('a zero loan produces no NaN, no divide-by-zero crash', runBridge({ grossLoan: 0 }).costPct, null);
eq('blank inputs give no NaN', Object.values(runBridge({ grossLoan: '', termMonths: '', monthlyRatePct: '' })).every(v => typeof v !== 'number' || isFinite(v)), true);
eq('bridging card headline is Net advance, not an ROI', bridge.summary[2][0], 'Total cost');
eq('bridging is marked cost-only so the screen shows a cost verdict, not an ROI one', bridge.costOnly, true);
eq('the interest-type choice defaults to rolled up', Calc.defaults(bridge).interestType, 'rolled');

// ---- Your own money: distinct from total money in wherever a mortgage is included in that total ----
eq('flip: own money excludes the mortgage (sheet example: 179,250 - 93,750)', run('flip').ownMoney, 179250 - 93750);
eq('BRR to HMO: own money excludes the mortgage', run('hmobrr').ownMoney, run('hmobrr').totalIn - run('hmobrr').mortgage);
eq('BRR to SA: own money excludes the mortgage', run('sabrr').ownMoney, run('sabrr').totalIn - run('sabrr').mortgage);
['btl', 'hmo', 'sabtl', 'r2rhmo', 'r2rsa'].forEach(id => eq(id + ': own money equals total money in (no mortgage rolled into that total)', run(id).ownMoney, run(id).totalIn));
eq('own money is always less than or equal to total money in', Calc.calcs.every(c => run(c.id).ownMoney <= run(c.id).totalIn + 1e-9), true);

// ---- Bridging's effect on a deal that refinances ----
const eff = Calc.bridgingEffect({});
eq('effect covers exactly the three refinance calculators', eff.map(e => e.id).join(','), 'flip,hmobrr,sabrr');
const flipBefore = run('flip'), bridgeCost = Calc.find('bridging').compute(Calc.defaults(Calc.find('bridging'))).v.totalCost;
eq('cash left after = cash left before + the bridge’s total cost (the cash-flow identity)', eff[0].cashLeftAfter, flipBefore.cashLeft + bridgeCost);
eq('bridge cost reported matches the bridging tool’s own total cost', eff[0].bridgeCost, bridgeCost);
eq('ROI after is annual profit over the new, larger cash-left figure', eff[0].roiAfter, flipBefore.annual / eff[0].cashLeftAfter);
// A refinance that already pays out more than was put in (money out) stays money-out once a bridge's cost is small
// enough not to flip it back to money-in; a bridge cost bigger than the surplus flips it to a real, positive figure.
const bigSurplus = Calc.bridgingEffect({ endValue: 500000, ltv: 90 });      // deliberately generous refinance
eq('a deal deep in money-out stays money-out after a normal-sized bridge cost', bigSurplus[0].moneyOutAfter, true);
eq('bridging a deal never changes its rent, sale price or annual profit — only what is left trapped', eff[0].cashLeftAfter - eff[0].cashLeftBefore, eff[0].bridgeCost);
eq('a zero-cost bridge (every fee and rate at 0) leaves the deal completely unaffected', Calc.bridgingEffect({ grossLoan: 0, arrangementFeePct: 0, exitFeePct: 0, valuationFee: 0, bridgeLegal: 0, brokerFeePct: 0, monthlyRatePct: 0 })[0].cashLeftAfter, flipBefore.cashLeft);

eq('compareAll rows carry ownMoney too', Calc.compareAll({}).rows.every(r => typeof r.ownMoney === 'number'), true);
eq('compareAll flip block carries ownMoney', Calc.compareAll({}).flip.ownMoney, run('flip').ownMoney);

// ---- Recycle Price: the price at which the refinance pays back every pound ----
const rec = Calc.find('recycle'), recRun = d => rec.compute(Calc.stateFor(rec, d)).v;
const r0 = recRun({});
eq('recycle is a tool, not one of the ranked calculators', Calc.calcs.indexOf(rec), -1);
eq('recycle: at the found price the refinance covers everything put in (cash left <= 0)', r0.cashLeft <= 0, true);
eq('recycle: one pound more and it no longer does (so this really is the highest price)', recRun({ purchasePrice: 0 }).cashLeft <= 0 && (r0.maxPrice + 1 + Calc.stampDuty(r0.maxPrice + 1) + 45000 + 3000 - 150000) > 0, true);
eq('recycle: the answer is within a few pounds of zero cash left', Math.abs(r0.cashLeft) < 2, true);
eq('recycle: default deal (GDV 200k, refurb 45k, legals 3k, 75% LTV) prices at 97,142 (by hand: 97,142 + 5% = 101,999 <= 102,000; one pound more is over)', r0.maxPrice, 97142);
eq('recycle: stamp duty is the app’s own figure at that price', r0.sdlt, Calc.stampDuty(r0.maxPrice));
eq('recycle: equity is end value minus everything in', r0.equity, 200000 - r0.totalIn);
eq('recycle: the stamp duty and money in it reports are the worked-out ones, whatever was typed', [recRun({ stampDutyOverride: 5000 }).sdlt, recRun({ stampDutyOverride: 5000 }).totalIn].join(), [recRun({}).sdlt, recRun({}).totalIn].join());
eq('recycle: the stamp duty reported is the duty on the price found', recRun({}).sdlt, Calc.stampDuty(recRun({}).maxPrice));
eq('recycle: a typed stamp duty is ignored; it is always worked out at the price found', recRun({ stampDutyOverride: 5000 }).maxPrice, recRun({}).maxPrice);
eq('recycle: a higher LTV raises the price', recRun({ ltv: 80 }).maxPrice > r0.maxPrice, true);
eq('recycle: more refurb lowers the price', recRun({ refurb: 60000 }).maxPrice < r0.maxPrice, true);
eq('recycle: other costs come off the price', recRun({ otherUpfront: 6000 }).maxPrice < r0.maxPrice - 5000, true);
eq('recycle: costs bigger than the refinance flag it impossible', recRun({ refurb: 200000 }).impossible, true);
eq('recycle: brute force agrees across price bands (GDV 100k..1.6m)', [100000, 180000, 260000, 400000, 900000, 1600000].every(g => {
  const v = recRun({ endValue: g, refurb: 20000, legal: 2500 }), loan = g * 0.75, cost = P => P + Calc.stampDuty(P) + 22500;
  let best = 0; for (let P = Math.max(0, v.maxPrice - 3); P <= v.maxPrice + 3; P++) if (cost(P) <= loan) best = P;
  return v.maxPrice === best;
}), true);

// Cash left in at a chosen price (negative = cash pulled out)
const herFig = { endValue: 275000, ltv: 75, refurb: 50000, legal: 2000, otherUpfront: 14600 };
const herMax = Calc.find('recycle').compute(Calc.stateFor(Calc.find('recycle'), herFig)).v.maxPrice;
// 206,250 back - 50,000 - 2,000 - 14,600 = 139,650 to cover price + stamp duty; price + 6,250 + 7% x (price - 125,000) = 139,650 -> 132,850
eq('her figures with stamp duty worked out: max price is 132,850', herMax, 132850);
eq('at the max price nothing is left in (to the pound)', Calc.cashKind(Calc.cashLeftAtPrice(herFig, herMax).cashLeft), 'even');
eq('one pound over the max leaves cash in', Calc.cashLeftAtPrice(herFig, herMax + 1).cashLeft > 0, true);
eq('600 under the max pulls out 600 plus the stamp duty saved on it (7%)', Calc.cashLeftAtPrice(herFig, herMax - 600).cashLeft, Calc.cashLeftAtPrice(herFig, herMax).cashLeft - 600 * 1.07);
eq('950 over the max leaves in 950 plus the extra stamp duty (7%)', Calc.cashLeftAtPrice(herFig, herMax + 950).cashLeft, Calc.cashLeftAtPrice(herFig, herMax).cashLeft + 950 * 1.07);
eq('stamp duty is worked out at the price paid, not the max', Calc.cashLeftAtPrice(herFig, 100000).sdlt, Calc.stampDuty(100000));
eq('a typed stamp duty is ignored there too', Calc.cashLeftAtPrice(Object.assign({}, herFig, { stampDutyOverride: 6600 }), 100000).sdlt, Calc.stampDuty(100000));
const autoFig = { endValue: 200000, ltv: 75, refurb: 45000, legal: 3000, otherUpfront: 0, stampDutyOverride: '' };
const autoMax = Calc.find('recycle').compute(Calc.stateFor(Calc.find('recycle'), autoFig)).v.maxPrice;
eq('auto stamp duty: at the max nothing is left in (to rounding)', Calc.cashLeftAtPrice(autoFig, autoMax).cashLeft <= 0 && Calc.cashLeftAtPrice(autoFig, autoMax).cashLeft > -10, true);
eq('auto stamp duty: one pound over the max leaves cash in', Calc.cashLeftAtPrice(autoFig, autoMax + 1).cashLeft > 0, true);
eq('a lower LTV leaves more cash in (60% LTV, pay 100,000)', Calc.cashLeftAtPrice(Object.assign({}, herFig, { ltv: 60 }), 100000).cashLeft, 100000 + Calc.stampDuty(100000) + 50000 + 2000 + 14600 - 275000 * 0.6);
eq('cash kind: in / out / even', [Calc.cashKind(1200), Calc.cashKind(-600), Calc.cashKind(0), Calc.cashKind(0.4), Calc.cashKind(-0.4)].join(), 'in,out,even,even,even');

// My usual figures: example < usual < typed
const flipC = Calc.find('flip');
eq('usual figures replace the spreadsheet example', Calc.stateFor(flipC, Calc.withUsual({}, { legal: 1500 })).legal, 1500);
eq('what is typed for this deal beats the usual figure', Calc.stateFor(flipC, Calc.withUsual({ legal: 2500 }, { legal: 1500 })).legal, 2500);
eq('a figure that is neither usual nor typed stays the example', Calc.stateFor(flipC, Calc.withUsual({}, { legal: 1500 })).refurb, 45000);
eq('a blank usual figure is ignored, not treated as zero', Calc.stateFor(flipC, Calc.withUsual({}, { legal: '' })).legal, 3000);
eq('a typed zero still beats a usual figure', Calc.stateFor(flipC, Calc.withUsual({ legal: 0 }, { legal: 1500 })).legal, 0);
const dBefore = { legal: 2500 }, uBefore = { legal: 1500, ltv: 70 };
Calc.withUsual(dBefore, uBefore);
eq('withUsual changes neither input', JSON.stringify([dBefore, uBefore]), JSON.stringify([{ legal: 2500 }, { legal: 1500, ltv: 70 }]));
eq('usual LTV changes the max price (70% vs 75%)', Calc.find('recycle').compute(Calc.stateFor(Calc.find('recycle'), Calc.withUsual({}, { ltv: 70 }))).v.maxPrice < Calc.find('recycle').compute(Calc.stateFor(Calc.find('recycle'), {})).v.maxPrice, true);

// ROI on cash left in: green at 50% or more, red below
eq('49% on cash left in is red', Calc.cashRoiVerdict(0.49), 'bad');
eq('exactly 50% is green', Calc.cashRoiVerdict(0.5), 'good');
eq('80% is green', Calc.cashRoiVerdict(0.8), 'good');
eq('49.96% shows as 50.0%, so it counts as green (the colour follows the figure shown)', Calc.cashRoiVerdict(0.4996), 'good');
eq('49.94% shows as 49.9%, so it is red', Calc.cashRoiVerdict(0.4994), 'bad');
eq('zero and negative returns are red', [Calc.cashRoiVerdict(0), Calc.cashRoiVerdict(-0.2)].join(), 'bad,bad');
eq('no cash left in (everything came back out) is green', Calc.cashRoiVerdict('∞ (no cash left in)'), 'good');
eq('missing or unusable figures get no colour', [Calc.cashRoiVerdict(null), Calc.cashRoiVerdict(undefined), Calc.cashRoiVerdict(NaN), Calc.cashRoiVerdict(Infinity)].map(String).join(), 'null,null,null,null');
eq('the target is 50%', Calc.CASH_ROI_TARGET, 0.5);
// Only the strategies that refinance carry the rule; money-in strategies keep their own colouring
const roiItem = c => { for (const sec of c.layout) for (const it of sec.items) if (it.calc && it.calc.id === 'roi') return it.calc; return null; };
const refi = Calc.calcs.filter(c => { const v = c.compute(Calc.stateFor(c, {})).v; return v.cashLeft != null; }).map(c => c.id).sort();
eq('the refinance strategies are flip, hmobrr and sabrr', refi.join(), 'flip,hmobrr,sabrr');
eq('every refinance strategy marks its ROI row with the cash-left-in rule', refi.every(id => roiItem(Calc.find(id)) && roiItem(Calc.find(id)).verdict === 'cashRoi'), true);
eq('no money-in strategy carries the cash-left-in rule', Calc.calcs.filter(c => !refi.includes(c.id)).every(c => !roiItem(c) || roiItem(c).verdict !== 'cashRoi'), true);

// The primary BRR & Flip screen: five figures, optional extras, then one strategy module (BTL, HMO or SA)
const fieldIdsOf = id => Calc.find(id).layout.flatMap(sec => sec.items).filter(i => i.field).map(i => i.field.id);
const letTypes = ['none', 'btl', 'hmo', 'sa'];
const planOf = l => Calc.simplePlan('brr', l), allOf = p => p.basic.concat(p.optional, p.rental);
eq('the primary form asks for five figures (any other costs since 6 Oct 2026); stamp duty is worked out, not asked for', planOf('none').basic.join(), 'purchasePrice,refurb,legal,otherUpfront,endValue');
eq('the basics and the optional extras are all figures of the flip calculator, which computes them', letTypes.every(l => planOf(l).basic.concat(planOf(l).optional).every(f => fieldIdsOf('flip').includes(f))) && planOf('hmo').primaryCalcId === 'flip', true);
eq('each strategy module asks only for figures its own calculator uses', letTypes.every(l => planOf(l).rental.every(f => fieldIdsOf(planOf(l).calcId).includes(f))), true);
eq('no figure is asked for twice on one screen', letTypes.every(l => new Set(allOf(planOf(l))).size === allOf(planOf(l)).length), true);
eq('the basics with the BTL module reach every figure of the flip / BRR to BTL calculator', [...fieldIdsOf('flip')].sort().join(), [...new Set(allOf(planOf('btl')))].sort().join());
eq('the basics with the HMO module reach every figure of the BRR to HMO calculator', fieldIdsOf('hmobrr').filter(f => !allOf(planOf('hmo')).includes(f)).join(), '');
eq('the basics with the SA module reach every figure of the BRR to SA calculator', fieldIdsOf('sabrr').filter(f => !allOf(planOf('sa')).includes(f)).join(), '');
eq('the basic form is the same whichever strategy is chosen (typed figures never move)', letTypes.every(l => JSON.stringify(planOf(l).basic) === JSON.stringify(planOf('none').basic) && JSON.stringify(planOf(l).optional) === JSON.stringify(planOf('none').optional)), true);
eq('with no strategy chosen no rental figures are asked for', planOf('none').rental.length, 0);
eq('an unknown strategy is treated as none', (() => { try { return Calc.simplePlan('brr', 'castle').letting; } catch (e) { return 'threw'; } })(), 'none');
eq('the strategy picks the calculator: BTL flip, HMO hmobrr, SA sabrr', ['btl', 'hmo', 'sa'].map(l => planOf(l).calcId).join(), 'flip,hmobrr,sabrr');
eq('the SA module asks for rooms, nightly rate and occupancy', ['rooms', 'nightlyRate', 'occupancyPct'].every(f => planOf('sa').rental.includes(f)), true);
eq('the HMO module asks for rooms and rent, utilities, council tax and management', ['rooms', 'roomRate', 'utilities', 'council', 'mgmtPct'].every(f => planOf('hmo').rental.includes(f)), true);
eq('the BTL module asks for the rent and the maintenance / voids allowance', ['monthlyRent', 'voidsPct'].every(f => planOf('btl').rental.includes(f)), true);
// shared figures: one id, entered once, read by every module that uses it
eq('the mortgage rate is one shared figure across BTL, HMO and SA', ['btl', 'hmo', 'sa'].every(l => planOf(l).rental.includes('mortgageRate')), true);
eq('the number of rooms is one shared figure across HMO and SA', planOf('hmo').rental.includes('rooms') && planOf('sa').rental.includes('rooms'), true);
const sharedDeal = { purchasePrice: 150000, endValue: 250000, refurb: 40000, mortgageRate: 6.5, rooms: 5 };
eq('a shared figure typed once is used by every calculator that has it', ['flip', 'hmobrr', 'sabrr'].map(id => Calc.stateFor(Calc.find(id), sharedDeal).mortgageRate).join(), '6.5,6.5,6.5');
eq('the purchase figures carry into every strategy', ['flip', 'hmobrr', 'sabrr'].map(id => Calc.stateFor(Calc.find(id), sharedDeal).purchasePrice).join(), '150000,150000,150000');

// Total initial investment = purchase + refurb + legal + stamp duty, exactly as the brief defines it
const tii = Calc.find('flip').compute(Calc.stateFor(Calc.find('flip'), { purchasePrice: 150000, refurb: 40000, legal: 2500, endValue: 250000 })).v;
eq('stamp duty is worked out from the price and reported', tii.sdlt, Calc.stampDuty(150000));
eq('total initial investment is purchase + refurb + legal + stamp duty', tii.totalIn, 150000 + 40000 + 2500 + Calc.stampDuty(150000));
eq('money left in is that total less the refinance', tii.cashLeft, tii.totalIn - 250000 * 0.75);
eq('flip profit is end value less total money in, as in the sheet (no selling or holding costs)', tii.profit, 250000 - tii.totalIn);
eq('typing selling or holding costs changes nothing: they are not figures of the flip', Calc.find('flip').compute(Calc.stateFor(Calc.find('flip'), { purchasePrice: 150000, refurb: 40000, legal: 2500, endValue: 250000, sellingPct: 2, holdingMonths: 3, holdingMonthly: 500 })).v.profit, tii.profit);

// How a listing is sold: never "Private sale" unless that is known
eq('a known private sale says so', Calc.saleLabel({ listingType: 'OPEN' }), 'Private sale');
eq('an auction says Auction even with no date', Calc.saleLabel({ listingType: 'AUCTION' }), 'Auction');
eq('a modern-method auction says so', Calc.saleLabel({ listingType: 'MMOA' }), 'Modern auction');
eq('an unchecked sale type is never called a private sale', Calc.saleLabel({ listingType: 'UNKNOWN' }), 'Sale type not checked');
eq('a listing with no sale type at all is not called a private sale either', Calc.saleLabel({}), 'Sale type not checked');
eq('unchecked + guide price is flagged as a likely auction', Calc.saleLabel({ listingType: 'UNKNOWN', priceQualifier: 'Guide price' }), 'Guide price \u00b7 may be an auction');
eq('unchecked + starting bid is flagged too', Calc.saleLabel({ listingType: 'UNKNOWN', priceQualifier: 'Starting bid' }), 'Guide price \u00b7 may be an auction');
eq('unchecked + offers over is just unchecked', Calc.saleLabel({ listingType: 'UNKNOWN', priceQualifier: 'Offers over' }), 'Sale type not checked');
eq('a known private sale with a guide price stays a private sale', Calc.saleLabel({ listingType: 'OPEN', priceQualifier: 'Guide price' }), 'Private sale');

// ---- Only what is yellow in Ashley's spreadsheets is an editable field (her rule, 2 Oct 2026) ----
// The yellow input cells, read from the .xlsx files in "Calculators" on 2 Oct 2026, mapped to the app's field ids.
const YELLOW = {
  flip: ['purchasePrice', 'depositPct', 'ltv', 'mortgageRate', 'legal', 'mgmtPct', 'refurb', 'voidsPct', 'endValue', 'monthlyRent'],                       // FLIP ROI Calculator
  hmobrr: ['purchasePrice', 'ltv', 'depositPct', 'mortgageRate', 'mgmtPct', 'maintPct', 'legal', 'council', 'refurb', 'utilities', 'furnishing', 'other', 'endValue', 'roomRate', 'rooms'],   // BRRR to HMO
  sabrr: ['purchasePrice', 'depositPct', 'ltv', 'mortgageRate', 'legal', 'commPct', 'refurb', 'maintOnMortgagePct', 'furnishing', 'council', 'utilities', 'channel', 'endValue', 'nightlyRate', 'rooms', 'occupancyPct'],   // BRRR to SA
  btl: ['purchasePrice', 'depositPct', 'mortgageRate', 'mgmtPct', 'voidsPct', 'legal', 'insurance', 'refurb', 'other', 'monthlyRent'],                      // BTL ROI Calculator
  hmo: ['purchasePrice', 'mortgageRate', 'depositPct', 'mgmtPct', 'maintPct', 'council', 'legal', 'utilities', 'refurb', 'other', 'otherUpfront', 'roomRate', 'rooms'],   // HMO BTL
  r2rhmo: ['upfront', 'rentPaid', 'refurb', 'mgmtPct', 'furnishing', 'maintOnRentPct', 'otherUpfront', 'council', 'utilities', 'roomRate', 'rooms'],       // R2R2HMO
  r2rsa: ['upfront', 'rentPaid', 'refurb', 'commPct', 'furnishing', 'maintOnRentPct', 'otherUpfront', 'council', 'utilities', 'channel', 'nightlyRate', 'rooms', 'occupancyPct'],   // R2RSA
  sabtl: ['purchasePrice', 'mortgageRate', 'depositPct', 'commPct', 'maintOnMortgagePct', 'council', 'legal', 'utilities', 'refurb', 'channel', 'furnishing', 'nightlyRate', 'rooms', 'occupancyPct']   // SA BTL
};
// Editable fields that are NOT yellow cells. Each is listed by name so adding another one fails this test.
// None left: on 2 Oct 2026 Ashley chose to have stamp duty worked out only (as the sheets do) and to drop the flip's selling / holding extras.
// 6 Oct 2026: Ashley allowed ONE exception, "Any other costs" (otherUpfront, a yellow cell in her HMO and R2R sheets), in every
// buy calculator (design 7a). Nothing else.
const NOT_YELLOW = { flip: ['otherUpfront'], btl: ['otherUpfront'], hmo: [], sabtl: ['otherUpfront'], hmobrr: ['otherUpfront'], sabrr: ['otherUpfront'], r2rhmo: [], r2rsa: [] };
const editableOf = c => c.layout.flatMap(sec => sec.items).filter(i => i.field || i.choice).map(i => (i.field || i.choice).id);
eq('every spreadsheet calculator has its yellow-cell list', Calc.calcs.every(c => Array.isArray(YELLOW[c.id]) && Array.isArray(NOT_YELLOW[c.id])), true);
Calc.calcs.forEach(c => {
  const app = editableOf(c), y = YELLOW[c.id] || [], extra = app.filter(f => !y.includes(f));
  eq(c.id + ': every yellow cell in the spreadsheet is an editable field', y.filter(f => !app.includes(f)).join(), '');
  eq(c.id + ': no editable field beyond the yellow cells, except the named ones', extra.sort().join(), (NOT_YELLOW[c.id] || []).slice().sort().join());
});
eq('the primary form and its optional figures are all yellow cells of the FLIP sheet, apart from the one named exception', planOf('none').basic.concat(planOf('none').optional).filter(f => !YELLOW.flip.includes(f)).join(), NOT_YELLOW.flip.join());
eq('Max price asks for no stamp duty figure', Calc.find('recycle').layout.flatMap(sec => sec.items).filter(i => i.field).map(i => i.field.id).join(), 'endValue,refurb,legal,otherUpfront,ltv');
eq('the strategy modules ask for nothing that is not a yellow cell', letTypes.every(l => planOf(l).rental.every(f => YELLOW[planOf(l).calcId].includes(f))), true);

// "Buy at this price to recycle all your money" on the primary screen
const flipAt = d => Calc.find('flip').compute(Calc.stateFor(Calc.find('flip'), d)).v;
const basicsFig = { purchasePrice: 150000, refurb: 40000, legal: 2500, endValue: 250000 };
const rpx = Calc.recyclePrice(Calc.stateFor(Calc.find('flip'), basicsFig));
// 187,500 back - 40,000 - 2,500 = 145,000 to cover price + stamp duty: price + 6,250 + 7% x (price - 125,000) = 145,000 -> 137,850
eq('the recycle price on those figures is 137,850', rpx, 137850);
eq('buying at that price leaves nothing in on the primary screen (to the pound)', Calc.cashKind(flipAt(Object.assign({}, basicsFig, { purchasePrice: rpx })).cashLeft), 'even');
eq('one pound more leaves cash in', flipAt(Object.assign({}, basicsFig, { purchasePrice: rpx + 1 })).cashLeft > 0, true);
eq('the recycle price does not depend on the price typed', Calc.recyclePrice(Calc.stateFor(Calc.find('flip'), Object.assign({}, basicsFig, { purchasePrice: 90000 }))), rpx);
// Since 6 Oct 2026 (design 7a) any other up-front costs are part of the deal on the primary screen, so they come off the recycle price.
eq('other up-front costs come off it, so buying at it still leaves nothing in', (r => r < rpx && Calc.cashKind(flipAt(Object.assign({}, basicsFig, { otherUpfront: 14600, purchasePrice: r })).cashLeft) === 'even')(Calc.recyclePrice(Calc.stateFor(Calc.find('flip'), Object.assign({}, basicsFig, { otherUpfront: 14600 })))), true);
eq('a lower refinance LTV lowers it', Calc.recyclePrice(Calc.stateFor(Calc.find('flip'), Object.assign({}, basicsFig, { ltv: 70 }))) < rpx, true);
eq('when the refurb alone is more than the refinance pays, no price works (not a price of 0)', String(Calc.recyclePrice(Calc.stateFor(Calc.find('flip'), Object.assign({}, basicsFig, { refurb: 400000 })))), 'null');

// ---- The Live ledger (Calculator primary screen, design 3a) ----
const lcNear = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6;
const LD = { purchasePrice: 125000, refurb: 45000, legal: 3000, endValue: 230000, furnishing: 5000 };
const L0 = Calc.ledger(LD, false), L1 = Calc.ledger(LD, true);
const calcOwn = id => Calc.find(id).compute(Calc.stateFor(Calc.find(id), LD)).v;
eq('ledger: four exits, sell first', Object.keys(L0.exits).join(), 'none,btl,hmo,sa');
eq('ledger: each exit is computed by the calculator it always was', ['none', 'btl', 'hmo', 'sa'].map(k => L0.exits[k].calcId).join(), 'flip,flip,hmobrr,sabrr');
// bridging off: nothing differs from the calculators themselves
eq('no bridging: single let is the flip calculator, figure for figure', ['cashLeft', 'roi', 'monthly', 'annual', 'breakeven', 'paybackPrice', 'totalIn', 'profit', 'margin'].every(k => L0.exits.btl.v[k] === calcOwn('flip')[k]), true);
eq('no bridging: by the room is the BRR to HMO calculator, figure for figure', ['cashLeft', 'roi', 'monthly', 'annual', 'breakeven', 'paybackPrice', 'totalIn'].every(k => L0.exits.hmo.v[k] === calcOwn('hmobrr')[k]), true);
eq('no bridging: nightly stays is the BRR to SA calculator, figure for figure', ['cashLeft', 'roi', 'monthly', 'annual', 'breakeven', 'paybackPrice', 'totalIn'].every(k => L0.exits.sa.v[k] === calcOwn('sabrr')[k]), true);
const LDbig = Object.assign({}, LD, { refurb: 400000, roomRate: 900 });
eq('no bridging: even in an unworkable deal every figure is still the one the calculator gives (nothing is recomputed)', JSON.stringify(Calc.ledger(LDbig, false).exits.hmo.v), JSON.stringify(Calc.find('hmobrr').compute(Calc.stateFor(Calc.find('hmobrr'), LDbig)).v));
eq('no bridging: no bridging cost anywhere', [L0.bridgeCost, L0.exits.none.own.bridge, String(L0.bridge)].join(), '0,0,null');
// the deal figures are one set: an exit never falls back to its own sheet's example price
const Lblank = Calc.ledger({}, false);
eq('with nothing typed every exit still uses the same price, refurb, legal and end value', ['btl', 'hmo', 'sa'].every(k => ['purchasePrice', 'refurb', 'legal', 'endValue', 'ltv', 'depositPct'].every(f => Lblank.exits[k].state[f] === Lblank.ps[f])), true);
// bridging on: its whole cost is extra cash left in
const BCOST = Calc.find('bridging').compute(Calc.stateFor(Calc.find('bridging'), LD)).v.totalCost;
eq('bridging: the cost is the bridging calculator\'s total cost of borrowing', L1.bridgeCost, BCOST);
eq('bridging: cash left in rises by exactly the cost, on every exit', ['none', 'btl', 'hmo', 'sa'].every(k => lcNear(L1.exits[k].v.cashLeft, L0.exits[k].v.cashLeft + BCOST)), true);
eq('bridging: total money in rises by exactly the cost', ['none', 'btl', 'hmo', 'sa'].every(k => lcNear(L1.exits[k].v.totalIn, L0.exits[k].v.totalIn + BCOST)), true);
eq('bridging: ROI is the same annual profit over the larger cash left in', lcNear(L1.exits.hmo.v.roi, L0.exits.hmo.v.annual / (L0.exits.hmo.v.cashLeft + BCOST)), true);
eq('bridging: the rent is unchanged (a bridge only changes how it is funded)', ['btl', 'hmo', 'sa'].every(k => L1.exits[k].v.monthly === L0.exits[k].v.monthly), true);
eq('bridging: months to get money back uses the larger cash left in', lcNear(L1.exits.sa.v.breakeven, (L0.exits.sa.v.cashLeft + BCOST) / L0.exits.sa.v.monthly), true);
eq('bridging: flip profit falls by the cost', lcNear(L1.exits.none.v.profit, L0.exits.none.v.profit - BCOST), true);
eq('bridging: flip margin is the reduced profit over the end value', lcNear(L1.exits.none.v.margin, (L0.exits.none.v.profit - BCOST) / 230000), true);
eq('bridging: flip return is the reduced profit over the larger money in', lcNear(L1.exits.none.v.flipRoi, (L0.exits.none.v.profit - BCOST) / (L0.exits.none.v.totalIn + BCOST)), true);
eq('bridging does not alter the figures when it is off', JSON.stringify(Calc.ledger(LD, false).exits.hmo.v), JSON.stringify(L0.exits.hmo.v));
const Lout = Calc.ledger(Object.assign({}, LD, { purchasePrice: 60000 }), true);
eq('when more comes out than went in even after the bridge, ROI is infinite and there is nothing to get back', String(Lout.exits.btl.v.roi).charAt(0) + '|' + Lout.exits.btl.v.breakeven + '|' + Lout.exits.btl.v.moneyOut, '\u221e|0|true');
// own money and total money in
const o0 = L0.exits.none.own, oh = L0.exits.hmo.own, o1 = L1.exits.hmo.own;
eq('own money: deposit is the deposit share of the price', o0.deposit, 125000 * 0.25);
eq('own money: stamp duty is worked out from the price', o0.sdlt, Calc.stampDuty(125000));
eq('own money in = deposit + stamp duty + legal + refurb', o0.total, 31250 + Calc.stampDuty(125000) + 3000 + 45000);
eq('own money: furnishing counts only when letting by the room or nightly', [L0.exits.none.own.furnishing, L0.exits.btl.own.furnishing, oh.furnishing, L0.exits.sa.own.furnishing].join(), '0,0,5000,5000');
eq('own money by the room includes the furnishing', oh.total, o0.total + 5000);
eq('own money with a bridge includes its cost', lcNear(o1.total, oh.total + BCOST), true);
eq('the mortgage covers the rest of the price', o0.mortgage, 125000 - 31250);
eq('total money in = own money + mortgage', o0.totalIn, o0.total + o0.mortgage);
eq('total money in on the card agrees with each calculator\'s own total', ['none', 'btl', 'hmo', 'sa'].every(k => lcNear(L0.exits[k].own.totalIn, L0.exits[k].v.totalIn) && lcNear(L1.exits[k].own.totalIn, L1.exits[k].v.totalIn)), true);
// the price at which every pound comes back
eq('recycle price: selling or single let with no bridge is the plain recycle price', [L0.exits.none.recyclePrice, L0.exits.btl.recyclePrice].join(), [Calc.recyclePrice(L0.ps), Calc.recyclePrice(L0.ps)].join());
eq('recycle price: furnishing lowers it', L0.exits.hmo.recyclePrice < L0.exits.none.recyclePrice, true);
eq('recycle price: a bridge lowers it further', L1.exits.hmo.recyclePrice < L0.exits.hmo.recyclePrice, true);
const atRec = (k, on, extra) => Calc.ledger(Object.assign({}, LD, { purchasePrice: (on ? L1 : L0).exits[k].recyclePrice + (extra || 0) }), on).exits[k].v.cashLeft;
const nothingIn = x => x <= 0 && x > -2;                       // the price is rounded down to a pound, so up to about a pound comes back
eq('buying at the recycle price leaves nothing in: every exit, with and without a bridge', ['none', 'btl', 'hmo', 'sa'].every(k => nothingIn(atRec(k, false)) && nothingIn(atRec(k, true))), true);
eq('two pounds over the recycle price leaves cash in', ['none', 'hmo', 'sa'].every(k => atRec(k, false, 2) > 0 && atRec(k, true, 2) > 0), true);
eq('recycle price: none when the costs are more than the lender pays', String(Calc.ledger(Object.assign({}, LD, { refurb: 400000 }), true).exits.hmo.recyclePrice), 'null');
eq('priceForBudget: the price plus its stamp duty fits the budget, and one pound more does not', (p => p + Calc.stampDuty(p) <= 150000 && p + 1 + Calc.stampDuty(p + 1) > 150000)(Calc.priceForBudget(150000)), true);
eq('priceForBudget: no budget, no price', [String(Calc.priceForBudget(0)), String(Calc.priceForBudget(-5))].join(), 'null,null');
// most you can pay and get it back in 2 years, with a bridge
const pb = L1.exits.hmo.v.paybackPrice, monthsAt = P => { const x = Calc.ledger(Object.assign({}, LD, { purchasePrice: P }), true).exits.hmo.v; return x.cashLeft / x.monthly; };
eq('bridging: at the 2-year price the rent returns the cash in 24 months, and two pounds more does not', monthsAt(pb) <= 24 && monthsAt(pb + 2) > 24, true);
eq('bridging: the 2-year price is lower than without the bridge', pb < L0.exits.hmo.v.paybackPrice, true);
// nightly stays: the 500 a month target
// every let: the 500 a month target
eq('the monthly profit target is 500 for every let', Calc.MONTHLY_PROFIT_TARGET, 500);
eq('499.99 a month misses the target', Calc.monthlyProfitVerdict(499.99), 'bad');
eq('499.995 shows as 500.00, so it meets it', Calc.monthlyProfitVerdict(499.995), 'good');
eq('exactly 500 meets it', Calc.monthlyProfitVerdict(500), 'good');
eq('500.01 meets it; a loss does not', [Calc.monthlyProfitVerdict(500.01), Calc.monthlyProfitVerdict(-20)].join(), 'good,bad');
eq('no figure, no verdict', [String(Calc.monthlyProfitVerdict(null)), String(Calc.monthlyProfitVerdict('x')), String(Calc.monthlyProfitVerdict(NaN))].join(), 'null,null,null');
// months to get the money back: green 6 or under, amber up to 24, red beyond or never
eq('6 months is green', Calc.paybackVerdict(6, 1000), 'good');
eq('6.04 shows as 6 months, so green', Calc.paybackVerdict(6.04, 1000), 'good');
eq('6.1 months is amber', Calc.paybackVerdict(6.1, 1000), 'amber');
eq('24 months is amber', Calc.paybackVerdict(24, 1000), 'amber');
eq('24.1 months is red', Calc.paybackVerdict(24.1, 1000), 'bad');
eq('never (no profit) is red', [Calc.paybackVerdict('Not at this profit', 1000), Calc.paybackVerdict(Infinity, 1000), Calc.paybackVerdict(null, 1000)].join(), 'bad,bad,bad');
eq('nothing left in the deal is green, whatever the months', [Calc.paybackVerdict(0, 0), Calc.paybackVerdict('Not at this profit', -500)].join(), 'good,good');

// Deals: the auction / not-auction filter
eq('an auction lot is an auction', Calc.isAuction({ listingType: 'AUCTION' }), true);
eq('a modern-method auction is an auction', Calc.isAuction({ listingType: 'MMOA' }), true);
eq('anything with an auction date is an auction, whatever its label', Calc.isAuction({ listingType: 'OPEN', auctionDate: '2026-10-21' }), true);
eq('a private sale is not an auction', Calc.isAuction({ listingType: 'OPEN', auctionDate: null }), false);
eq('an unchecked sale type is not called an auction', [Calc.isAuction({ listingType: 'UNKNOWN' }), Calc.isAuction({}), Calc.isAuction(null)].join(), 'false,false,false');
const saleSet = [{ id: 'a', listingType: 'AUCTION' }, { id: 'm', listingType: 'MMOA' }, { id: 'o', listingType: 'OPEN' }, { id: 'u', listingType: 'UNKNOWN' }, { id: 'd', listingType: 'OPEN', auctionDate: '2026-11-01' }];
const pick = f => saleSet.filter(p => Calc.saleMatches(p, f)).map(p => p.id).join('');
eq('filter "all" keeps everything', pick('all'), 'amoud');
eq('filter "auction" keeps only auctions', pick('auction'), 'amd');
eq('filter "other" keeps only the non-auctions', pick('other'), 'ou');
// A guide price with an unchecked sale type counts as a likely auction in the filter
const gp = { id: 'g', listingType: 'UNKNOWN', priceQualifier: 'Guide price' }, sb = { listingType: 'UNKNOWN', priceQualifier: 'Starting bid' };
eq('a guide price or starting bid of unknown type may be an auction', [Calc.maybeAuction(gp), Calc.maybeAuction(sb), Calc.maybeAuction({ priceQualifier: 'Guide Price' })].join(), 'true,true,true');
eq('a guide price on a known private sale is not', Calc.maybeAuction({ listingType: 'OPEN', priceQualifier: 'Guide price' }), false);
eq('offers over, a plain price, and nothing at all are not', [Calc.maybeAuction({ listingType: 'UNKNOWN', priceQualifier: 'Offers over' }), Calc.maybeAuction({ listingType: 'UNKNOWN' }), Calc.maybeAuction(null)].join(), 'false,false,false');
eq('a known auction is an auction, not a maybe', Calc.maybeAuction({ listingType: 'AUCTION', priceQualifier: 'Guide price' }), false);
eq('"Not auction" hides the guide-price listing', [Calc.saleMatches(gp, 'other'), Calc.saleMatches(gp, 'auction'), Calc.saleMatches(gp, 'all')].join(), 'false,true,true');
eq('"Not auction" keeps a guide price that is a known private sale', Calc.saleMatches({ listingType: 'OPEN', priceQualifier: 'Guide price' }, 'other'), true);
// Deal list order
const D = (id, verdict, endValueScore) => ({ id, verdict, endValueScore });
const ord = list => list.slice().sort(Calc.feedOrder).map(x => x.id).join('');
eq('pursue, then watch, then reject', ord([D('r', 'REJECT', 90), D('w', 'WATCH', 10), D('p', 'PURSUE', 50)]), 'pwr');
eq('inside a verdict the surest end value comes first', ord([D('a', 'WATCH', 22), D('b', 'WATCH', 87), D('c', 'WATCH', 52)]), 'bca');
eq('a high score never lifts a watch above a pursue', ord([D('w', 'WATCH', 99), D('p', 'PURSUE', 1)]), 'pw');
eq('unrated deals go after rated ones, including a score of 0', ord([D('n', 'WATCH'), D('z', 'WATCH', 0), D('h', 'WATCH', 60)]), 'hzn');
eq('a score of 0 still beats unrated, whichever came first', ord([D('n', 'WATCH'), D('z', 'WATCH', 0)]) + ord([D('z', 'WATCH', 0), D('n', 'WATCH')]), 'znzn');
eq('an unknown verdict goes last and nothing crashes on gaps', ord([D('x', 'ODD', 99), D('r', 'REJECT', 1), null].filter(Boolean)), 'rx');
eq('equal deals keep their order', ord([D('a', 'WATCH', 50), D('b', 'WATCH', 50)]), 'ab');
// Price cuts
eq('a cut with an amount', Calc.reducedLabel({ reducedBy: 15000 }), 'Reduced by \u00a315,000');
eq('a cut with no amount', Calc.reducedLabel({ reduced: true }), 'Price reduced');
eq('no cut', String([Calc.reducedLabel({}), Calc.reducedLabel({ reducedBy: 0 }), Calc.reducedLabel(null)]), ',,');
// End value: how sure, in one line
eq('rating and range', JSON.stringify(Calc.valueNote({ endValue: 135000, endValueConfidence: 'MEDIUM', endValueLow: 120000, endValueHigh: 150000 })), JSON.stringify({ level: 'MEDIUM', text: 'Medium confidence \u00b7 likely \u00a3120,000 \u2013 \u00a3150,000' }));
eq('rating with no range (older reports)', Calc.valueNote({ endValue: 135000, endValueConfidence: 'high' }).text, 'High confidence');
eq('MED is read as medium', Calc.valueNote({ endValue: 1, endValueConfidence: 'MED' }).level, 'MEDIUM');
eq('half a range is not shown', Calc.valueNote({ endValue: 1, endValueConfidence: 'LOW', endValueLow: 5 }).text, 'Low confidence');
eq('no end value or no rating gives nothing', String([Calc.valueNote({ endValueConfidence: 'HIGH' }), Calc.valueNote({ endValue: 1 }), Calc.valueNote({ endValue: 1, endValueConfidence: 'odd' }), Calc.valueNote(null)]), ',,,');
eq('the two halves together are everything, with nothing in both', pick('auction').length + pick('other').length, saleSet.length);
eq('an unknown filter value hides nothing', pick('nonsense'), 'amoud');

eq('eight calculators', Calc.calcs.length, 8);
console.log(ran + ' checks ran');
// BRR 2-year rule: cash left in is fine if the rent returns it within 24 months
(function () {
  var c = Calc.find('flip'), st = { purchasePrice: 100000, endValue: 100000, refurb: 0, legal: 0, ltv: 75, depositPct: 100, mortgageRate: 0, mgmtPct: 0, voidsPct: 0 };
  var run = function (rent) { return c.compute(Calc.stateFor(c, Object.assign({}, st, { monthlyRent: rent }))).v; };
  var left = run(0).cashLeft;
  eq('2yr rule: exactly 24 months counts', run(left / 24).paybackOk, true);
  eq('2yr rule: a little over 24 months fails', run(left / 24 - 1).paybackOk, false);
  eq('2yr rule: no profit fails', run(0).paybackOk, false);
  eq('2yr rule: months shown', run(left / 20).breakeven, 20);
})();
// Most you can pay for a 2-year payback: at that price the cash left in is just under 24 months of profit, one pound more is over
['flip', 'hmobrr', 'sabrr'].forEach(id => {
  const c = Calc.find(id), v = run(id), top = v.paybackPrice;
  const at = pr => { const w = c.compute(Calc.stateFor(c, { purchasePrice: pr })).v; return w.cashLeft <= 24 * w.monthly; };
  eq(id + ': 2yr max price works', at(top), true); eq(id + ': 2yr max price is the top', at(top + 2), false);
});
// ---- The flip verdict against any target (6 Oct 2026): good at the target, ok (amber) from 5 points under, bad below ----
{
  const edges = { 25: [[0.25, 'good'], [0.249, 'ok'], [0.20, 'ok'], [0.199, 'bad']], 30: [[0.30, 'good'], [0.299, 'ok'], [0.25, 'ok'], [0.249, 'bad']], 15: [[0.15, 'good'], [0.149, 'ok'], [0.10, 'ok'], [0.099, 'bad']] };
  Object.keys(edges).forEach(t => edges[t].forEach(([m, want]) => eq('target ' + t + '%: ' + (m * 100).toFixed(1) + '% is ' + want + ' (passed in)', Calc.flipVerdict(m, Number(t)), want)));
  Object.keys(edges).forEach(t => { Calc.setTargets({ flip: Number(t) }); edges[t].forEach(([m, want]) => eq('target ' + t + '%: ' + (m * 100).toFixed(1) + '% is ' + want + ' (saved target)', Calc.flipVerdict(m), want)); });
  Calc.setTargets(Calc.defaultTargets());
  eq('rounding: 24.96% shows as 25.0% and is good; 24.94% is ok', [Calc.flipVerdict(0.2496, 25), Calc.flipVerdict(0.2494, 25)].join(), 'good,ok');
  eq('rounding at the amber line: 19.96% shows as 20.0% and is ok; 19.94% is bad', [Calc.flipVerdict(0.1996, 25), Calc.flipVerdict(0.1994, 25)].join(), 'ok,bad');
  eq('no number, no verdict', [Calc.flipVerdict(null, 25), Calc.flipVerdict(undefined), Calc.flipVerdict('25%'), Calc.flipVerdict(NaN), Calc.flipVerdict(Infinity)].map(String).join(), 'null,null,null,null,null');
  eq('amber never starts below 0%', [Calc.flipOkFrom(25), Calc.flipOkFrom(15), Calc.flipOkFrom(3), Calc.flipOkFrom(5)].join(), '20,10,0,0');
  eq('a 3% target: a loss is bad, not ok', [Calc.flipVerdict(-0.01, 3), Calc.flipVerdict(0.01, 3), Calc.flipVerdict(0.03, 3)].join(), 'bad,ok,good');
  eq('the start figures follow the default target', [Calc.FLIP_TARGET, Calc.FLIP_OK].join(), '0.25,0.2');
  // the overall verdict: ok is a miss with an amber chip; a thin flip is red; no profit is loss-making whatever the target
  const chip = (m, p) => { const r = Calc.dealVerdict('none', { margin: m, profit: p }); return [r.score, r.title, r.tone, r.hits[0], r.tones[0], r.targets[0]].join(' | '); };
  eq('chip: good is a hit, green', chip(0.26, 50000), '1 | Good flip | good | true | good | 25% margin');
  eq('chip: ok is a miss, amber, and says where amber starts', chip(0.22, 40000), '0 | OK flip | amber | false | amber | 25% margin (amber from 20%)');
  eq('chip: bad with a profit is a thin flip, red', chip(0.1, 20000), '0 | Thin flip | bad | false | bad | 25% margin');
  eq('chip: no profit is loss-making, red', [chip(0, 0), chip(-0.05, -9000)].join(' / '), '0 | Loss-making flip | bad | false | bad | 25% margin / 0 | Loss-making flip | bad | false | bad | 25% margin');
  Calc.setTargets({ flip: 3 });
  eq('chip: no profit is loss-making even when the target is tiny', chip(0, 0), '0 | Loss-making flip | bad | false | bad | 3% margin');
  Calc.setTargets({ flip: 30 });
  eq('chip: the amber note follows the target', chip(0.27, 50000), '0 | OK flip | amber | false | amber | 30% margin (amber from 25%)');
  Calc.setTargets(Calc.defaultTargets());
  eq('let chips carry a tone too (hit green, miss red)', Calc.dealVerdict('btl', { monthly: 600, roi: 0.1, breakeven: 3, cashLeft: 5000 }).tones.join(), 'good,bad,good,bad');
}
process.exit(fail ? 1 : 0);

// Bridging quotes (bridge.js): each loan structure (A, B, C), each fee payment method, each interest treatment, stamp
// duty band edges and the maximum bid. Every figure worked out by hand. Run: node test-bridge.js
var Calc = require('./calc.js'), B = require('./bridge.js');
var fails = 0, count = 0;
function ok(name, cond, info) { count++; if (!cond) { fails++; console.log('FAIL ' + name + (info !== undefined ? ' :: ' + info : '')); } }
var near = function (a, b) { return Math.abs(a - b) < 0.01; };
var cfg = B.defaultTax(Calc);
var X = function (o) { return Object.assign({}, o); };

// ---- stamp duty: marginal bands, surcharge, edges, edits, override ----
ok('the default bands are the app’s England & NI rates (0% / 2% / 5% / 10% / 12%) with a 5% surcharge from £40,000', JSON.stringify(cfg.bands) === JSON.stringify([[125000, 0], [250000, 2], [925000, 5], [1500000, 10], ['', 12]]) && cfg.surchargePct === 5 && cfg.surchargeFrom === 40000);
ok('band edges: £125,000 → £0; £125,001 → 2p; £250,000 → £2,500; £925,000 → £36,250', B.stampDuty(125000, cfg) === 0 && near(B.stampDuty(125001, cfg), 0.02) && B.stampDuty(250000, cfg) === 2500 && B.stampDuty(925000, cfg) === 36250);
ok('marginal, not slab: £1,600,000 = £2,500 + £33,750 + £57,500 + 12% of £100,000 = £105,750 (not 12% of it all)', B.stampDuty(1600000, cfg) === 105750, B.stampDuty(1600000, cfg));
ok('additional property: + 5% of the whole price, from £40,000 (not at £39,999)', B.stampDuty(200000, cfg, true) === 1500 + 10000 && B.stampDuty(39999, cfg, true) === 0 && B.stampDuty(40000, cfg, true) === 2000);
ok('matches the app’s own stamp duty at every edge', [125000, 125001, 250000, 250001, 925000, 1500000, 2000000].every(function (p) { return near(B.stampDuty(p, cfg, true), Calc.propertyTax(p, 'eng', 'add')) && near(B.stampDuty(p, cfg, false), Calc.propertyTax(p, 'eng', 'main')); }));
var edited = { bands: [[150000, 0], [300000, 3], ['', 8]], surchargePct: 4, surchargeFrom: 50000 };
ok('edited bands are used as typed (£400,000: 3% of £150,000 + 8% of £100,000 = £12,500; + 4% = £28,500)', B.stampDuty(400000, edited) === 12500 && B.stampDuty(400000, edited, true) === 28500);
ok('a band typed out of order is skipped, never negative; no price, no tax', B.stampDuty(400000, { bands: [[300000, 3], [100000, 9], ['', 8]] }) === 9000 + 8000 && B.stampDuty(0, cfg) === 0 && B.stampDuty(-5, cfg) === 0);

// ---- the project used below (hand-worked) ----
var P = { price: 200000, refurb: 50000, contMode: '£', cont: 0, cash: 120000, auction: 0, legal: 1500, additional: true, endValue: 320000, exit: 'sale', selling: 4000, term: 12 };
ok('the project’s stamp duty: 2% of £75,000 + 5% of £200,000 = £11,500', B.quote(P, { structure: 'A', mode: 'quoted', net: 140000, gross: 140000, rate: 0, interest: 'retained', term: 12 }, cfg).sdlt === 11500);
var S = B.quote(X(Object.assign({}, P, { sdltOverride: true, sdltManual: 9000 })), { structure: 'A', mode: 'quoted', net: 140000, gross: 140000, rate: 0, term: 12 }, cfg);
ok('stamp duty typed by hand overrides the bands', S.sdlt === 9000);

// ---- A: day-one only, quoted figures, retained interest, fees paid each way ----
var qA = { name: 'Lender A', structure: 'A', mode: 'quoted', net: 140000, gross: 150000, rate: 0.8, interest: 'retained', term: 12, security: 'Purchase property only',
  fees: [{ name: 'Valuation fee', amount: 500, unit: '£', pay: 'cash' }, { name: 'Arrangement fee', amount: 2, unit: '%', basis: 'gross', pay: 'added' }, { name: 'Exit fee', amount: 1, unit: '%', basis: 'gross', pay: 'exit' }] };
var A = B.quote(P, qA, cfg);
ok('A: funds received = the net advance £140,000; the lender keeps £10,000 (gross £150,000 − net)', A.received === 140000 && A.gap === 10000 && A.drawn === 0);
ok('A: the 2% arrangement fee added to the loan (£3,000) is shown but NOT counted again (it is in the gap)', A.feeAdded === 3000 && A.totalCost === 10000 + 500 + 1500);
ok('A: total cost £12,000 = £10,000 gap + £500 valuation paid in cash + £1,500 exit fee; 8.57% of funds, £1,000 a month', A.totalCost === 12000 && near(A.costPct, 12000 / 140000) && A.perMonth === 1000);
ok('A: cash needed = £60,000 deposit + £11,500 stamp duty + £1,500 legal + £500 fee + £50,000 refurb (all of it on A) = £123,500', A.deposit === 60000 && A.userRefurb === 50000 && A.required === 123500);
ok('A: £120,000 available leaves a £3,500 shortfall', A.headroom === -3500);
ok('A: exit: £320,000 − £4,000 selling − £150,000 loan − £1,500 exit fee = £164,500 back; £161,000 left; £41,000 profit', A.cashBack === 164500 && A.moneyLeft === 161000 && A.profit === 41000);
ok('A: cross-check: end value − every cost − the finance cost = the same £41,000', A.profitCheck === A.profit && A.costs === 267000);
ok('A: no risk flag for "Purchase property only"', !A.risks.length);

// ---- interest treatments ----
var base = { structure: 'A', mode: 'quoted', net: 140000, gross: 140000, rate: 1, term: 12 };
var R = B.quote(P, Object.assign({}, base, { interest: 'rolled' }), cfg);
ok('rolled up: 1% × 12 months on £140,000 = £16,800 added and repaid at the end (in the gap, not in cash)', R.rolled === 16800 && R.repay === 156800 && R.gap === 16800 && R.serviced === 0 && R.required === 60000 + 11500 + 1500 + 50000);
var Ri = B.quote(P, Object.assign({}, base, { interest: 'rolled', inclRolled: true, gross: 156800 }), cfg);
ok('rolled up, already in the quoted gross: not added twice', Ri.rolled === 0 && Ri.repay === 156800 && Ri.gap === 16800);
var Sv = B.quote(P, Object.assign({}, base, { interest: 'serviced' }), cfg);
ok('serviced: the £16,800 is paid monthly from your cash (in cash needed and in the cost; nothing rolled)', Sv.serviced === 16800 && Sv.rolled === 0 && Sv.gap === 0 && Sv.totalCost === 16800 && Sv.required === R.required + 16800);
var Rt = B.quote(P, Object.assign({}, base, { interest: 'retained', net: 123200 }), cfg);
ok('retained (quoted): the lender keeps it up front, so the net is lower: £16,800 gap, deposit £76,800', Rt.gap === 16800 && Rt.deposit === 76800 && Rt.serviced === 0 && Rt.rolled === 0);
ok('the same £16,800 costs the same in every treatment; only when and from where it is paid differ', R.totalCost === Sv.totalCost && Sv.totalCost === Rt.totalCost && R.profit === Sv.profit && Sv.profit === Rt.profit);

// ---- C: day-one + refurb on day one ----
var qC = { structure: 'C', mode: 'quoted', net: 140000, gross: 190000, facility: 50000, rate: 1, interest: 'rolled', term: 12 };
var C = B.quote(P, qC, cfg);
ok('C: the refurb £50,000 is released at completion and drawn in full: funds £190,000; no refurb from your cash', C.drawn === 50000 && C.received === 190000 && C.userRefurb === 0);
ok('C: interest on all of it for 12 months: £140,000 and £50,000 × 12% = £22,800', C.rolled === 22800 && C.repay === 212800 && C.gap === 22800);
ok('C: cash needed = £60,000 + £11,500 + £1,500 = £73,000', C.required === 73000 && C.peak === C.required);
var C2 = B.quote(P, Object.assign({}, qC, { facility: 60000, gross: 200000 }), cfg);
ok('C: a facility bigger than the works: the unused £10,000 is not drawn and not counted (repay less, no interest on it)', C2.drawn === 50000 && C2.unused === 10000 && C2.repay === 200000 - 10000 + 22800 && C2.gap === C.gap && C2.risks.some(function (t) { return /£10,000 of the refurb facility is not needed/.test(t); }));
var C3 = B.quote(P, Object.assign({}, qC, { facility: 40000, gross: 180000 }), cfg);
ok('C: a facility smaller than the works: you pay the other £10,000', C3.drawn === 40000 && C3.userRefurb === 10000 && C3.required === 83000);

// ---- B: refurb in arrears, in stages ----
var qB = { structure: 'B', mode: 'quoted', net: 140000, gross: 190000, facility: 50000, rate: 1, interest: 'rolled', term: 12, drawMode: 'stages', stages: 4, refurbMonths: 4 };
var Bq = B.quote(P, qB, cfg);
ok('B: 4 releases of £12,500 at months 1-4, interest only from each release: 11+10+9+8 months × £125 = £4,750', Bq.tranches.length === 4 && Bq.tranches[0].at === 1 && near(Bq.rolled - 16800, 4750));
ok('B: cash at the end £73,000, but at the peak you fund a stage first: £12,500 more = £85,500', Bq.required === 73000 && Bq.prefund === 12500 && Bq.peak === 85500);
var Bu = B.quote(P, Object.assign({}, qB, { drawMode: 'upfront', upfrontPct: 30 }), cfg);
ok('B: "30% of the refurb before the first release": peak = £73,000 + £15,000', Bu.prefund === 15000 && Bu.peak === 88000);
ok('B is cheaper than C here (less interest on the refurb money)', Bq.totalCost < C.totalCost && near(C.totalCost - Bq.totalCost, 22800 - 16800 - 4750));

// ---- worked out from the LTV, with fees as % of gross and net ----
var qD = { structure: 'A', mode: 'derive', ltv: 70, rate: 1, interest: 'retained', term: 12,
  fees: [{ name: 'Arrangement / facility fee', amount: 2, unit: '%', basis: 'gross', pay: 'added' }, { name: 'Valuation fee', amount: 500, unit: '£', pay: 'deducted' }] };
var D = B.quote(P, qD, cfg);
ok('derived: day-one loan 70% of £200,000 = £140,000; 2% of the gross added: gross £142,857.14 (fee £2,857.14)', near(D.gross, 140000 / 0.98) && near(D.feeAdded, 140000 / 0.98 * 0.02));
ok('derived: retained interest 12% of the gross (£17,142.86) and the £500 come off: net £122,357.14', near(D.retained, 140000 / 0.98 * 0.12) && near(D.net, 140000 - 500 - 140000 / 0.98 * 0.12));
ok('derived: the gap is exactly the added fee + deducted fee + retained interest (£20,500); none counted twice', near(D.gap, 20500) && near(D.totalCost, 20500));
var Dn = B.quote(P, { structure: 'A', mode: 'derive', ltv: 70, rate: 0, interest: 'rolled', term: 12, fees: [{ name: 'Broker fee', amount: 1, unit: '%', basis: 'net', pay: 'deducted' }] }, cfg);
ok('derived: a fee as 1% of the net, taken off the net, settles (net £138,613.86 = £140,000 ÷ 1.01)', near(Dn.net, 140000 / 1.01) && near(Dn.feeDeducted, 140000 / 1.01 * 0.01));
var Df = B.quote(P, { structure: 'C', mode: 'derive', ltv: 70, facility: 50000, rate: 0, interest: 'rolled', term: 12, fees: [{ name: 'Arrangement / facility fee', amount: 1, unit: '%', basis: 'facility', pay: 'cash' }] }, cfg);
ok('derived: 1% of the facility (£140,000 + £50,000) paid in cash = £1,900, in cash needed and in the cost', Df.feeCash === 1900 && Df.totalCost === 1900 && Df.required === 60000 + 11500 + 1500 + 1900);

// ---- fees: each payment method, blanks and estimates ----
var fee = function (pay, extra) { return B.quote(P, Object.assign({}, base, { interest: 'rolled', rate: 0, fees: [Object.assign({ name: 'Broker fee', amount: 1000, unit: '£', pay: pay }, extra || {})] }), cfg); };
var F0 = B.quote(P, Object.assign({}, base, { interest: 'rolled', rate: 0 }), cfg);
ok('paid in cash: +£1,000 to cash needed and to the cost', fee('cash').required - F0.required === 1000 && fee('cash').totalCost === 1000);
ok('added / deducted (quoted): shown for information only; cash and cost unchanged (already in the gross-net gap)', fee('added').required === F0.required && fee('added').totalCost === 0 && fee('deducted').totalCost === 0 && fee('added').feeAdded === 1000 && fee('deducted').feeDeducted === 1000);
ok('paid at exit: in the cost and out of the exit money, not in cash needed', fee('exit').required === F0.required && fee('exit').totalCost === 1000 && F0.cashBack - fee('exit').cashBack === 1000);
ok('a fee left blank or marked estimate is flagged to confirm with the broker', fee('cash', { amount: '' }).warnings.some(function (w) { return /Broker fee has no amount/.test(w); }) && fee('cash', { estimate: true }).warnings.some(function (w) { return /Broker fee is an estimate/.test(w); }));

// ---- checks ----
ok('net more than gross is flagged', B.quote(P, Object.assign({}, base, { net: 150000 }), cfg).warnings.some(function (w) { return /net advance is more than the gross/.test(w); }));
ok('a monthly rate over 3% and a missing term are flagged', B.quote(P, Object.assign({}, base, { rate: 4 }), cfg).warnings.some(function (w) { return /outside the usual range/.test(w); }) && B.quote(Object.assign({}, P, { term: '' }), Object.assign({}, base, { term: '' }), cfg).warnings.some(function (w) { return /loan term/.test(w); }));
ok('a negative amount is flagged', B.quote(Object.assign({}, P, { refurb: -1 }), base, cfg).warnings.some(function (w) { return /refurb cannot be negative/.test(w); }));
ok('security over a second property is a risk flag; the purchase property only is not', B.quote(P, Object.assign({}, base, { security: 'purchase property + main residence' }), cfg).risks.length === 1 && B.securityRisk('Purchase property only') === false);
ok('the quote’s own term wins; blank uses the project’s expected term', B.quote(P, Object.assign({}, base, { term: 6 }), cfg).term === 6 && B.quote(P, Object.assign({}, base, { term: '' }), cfg).term === 12);
ok('contingency as £ or % of the refurb is in cash needed and a cost', B.quote(Object.assign({}, P, { contMode: '%', cont: 10 }), base, cfg).required - B.quote(P, base, cfg).required === 5000 && B.quote(Object.assign({}, P, { cont: 2000 }), base, cfg).profit === B.quote(P, base, cfg).profit - 2000);
ok('auction fees are in cash needed; selling costs only when selling', B.quote(Object.assign({}, P, { auction: 3000 }), base, cfg).required - B.quote(P, base, cfg).required === 3000 && B.quote(Object.assign({}, P, { exit: 'refinance' }), base, cfg).selling === 0);
ok('nothing typed: no NaN anywhere', JSON.stringify(B.quote({}, {}, cfg)).indexOf('NaN') < 0);

// ---- comparing quotes ----
var cmp = B.compare(P, [qA, qC, qB, Object.assign({}, base, { name: 'Cheap but short', interest: 'rolled', rate: 0.5 })], cfg, 5000);
ok('compare: the cheapest finance, the least own cash and the most money left each name their winner', cmp.cheapest.name === 'Cheap but short' && cmp.leastCash.i === 1 && cmp.mostLeft.name === 'Cheap but short', [cmp.cheapest.name, cmp.leastCash.i, cmp.mostLeft.name].join());
ok('compare: a shortfall is flagged red; little headroom amber; a B quote short at its peak is flagged', cmp.alerts.some(function (a) { return a.i === 0 && a.level === 'bad' && /£3,500 short/.test(a.text); }) && cmp.alerts.some(function (a) { return a.i === 3 && a.level === 'bad'; }));
var cmp2 = B.compare(Object.assign({}, P, { cash: 80000 }), [qC, qB], cfg, 10000);
ok('compare: £7,000 spare under a £10,000 threshold is a warning; the B quote’s peak £85,500 is over the £80,000', cmp2.alerts.some(function (a) { return a.i === 0 && a.level === 'warn' && /only £7,000 spare/.test(a.text); }) && cmp2.alerts.some(function (a) { return a.i === 1 && /£85,500 at the peak/.test(a.text); }));

// ---- maximum bid ----
var mbA = B.maxBid(P, qA, cfg, { kind: 'gbp', value: 41000 }, { step: 250, keepLoan: true });
ok('max bid, fixed loan, £41,000 profit: £200,000 (that is the profit at £200,000)', mbA.price === 200000 && mbA.result.profit >= 41000);
var mbG = B.maxBid(P, qA, cfg, { kind: 'gdv', value: 10 }, { step: 250, keepLoan: true });
ok('max bid, 10% of the £320,000 end value (£32,000): each £1 more costs £1.07 (plus 7% stamp duty) → £208,250', mbG.price === 208250 && mbG.targetProfit === 32000 && B.quote(P, qA, cfg, { price: 208250, keepLoan: true }).profit >= 32000 && B.quote(P, qA, cfg, { price: 208500, keepLoan: true }).profit < 32000, mbG.price);
var mbC = B.maxBid(P, qA, cfg, { kind: 'cost', value: 20 }, { step: 500, keepLoan: true });
ok('max bid, 20% of the total cost: meets it, the next £500 does not; rounded to £500', mbC.price % 500 === 0 && B.meets(mbC.result, { kind: 'cost', value: 20 }) && !B.meets(B.quote(P, qA, cfg, { price: mbC.price + 500, keepLoan: true }), { kind: 'cost', value: 20 }));
ok('the three bases give three different answers ("20%" means different things)', new Set([B.maxBid(P, qA, cfg, { kind: 'gdv', value: 20 }, { step: 250, keepLoan: true }).price, B.maxBid(P, qA, cfg, { kind: 'cost', value: 20 }, { step: 250, keepLoan: true }).price, B.maxBid(P, qA, cfg, { kind: 'gbp', value: 20 }, { step: 250, keepLoan: true }).price]).size === 3);
var mbS = B.maxBid(P, qA, cfg, { kind: 'gdv', value: 10 }, { step: 250, keepLoan: false });
ok('max bid with the loan scaling with the price (LTV): the loan and the lender’s cut grow with it, so the bid is lower (£207,750)', mbS.price === 207750 && mbS.price < mbG.price && near(mbS.result.net, 140000 * 207750 / 200000) && near(mbS.result.gross, 150000 * 207750 / 200000));
var mbD = B.maxBid(P, qD, cfg, { kind: 'gbp', value: 30000 }, { step: 250 });
ok('max bid on a derived quote recalculates the loan, fees and stamp duty at the bid', mbD.result.price === mbD.price && near(mbD.result.sdlt, B.stampDuty(mbD.price, cfg, true)) && mbD.result.profit >= 30000 && B.quote(P, qD, cfg, { price: mbD.price + 250 }).profit < 30000);
ok('the % of total cost target counts the finance too: 20% of (£400 costs + £100 finance) = £100 profit needed', B.meets({ profit: 100, costs: 400, totalCost: 100, endValue: 0 }, { kind: 'cost', value: 20 }) && !B.meets({ profit: 90, costs: 400, totalCost: 100, endValue: 0 }, { kind: 'cost', value: 20 }));
var qL = { structure: 'A', mode: 'derive', ltv: 70, rate: 0, interest: 'rolled', term: 12 };
ok('a loan worked out from the LTV: kept fixed it stays 70% of the asking (£140,000) at another price; scaling, 70% of the bid (£175,000)', B.quote(P, qL, cfg, { price: 250000, keepLoan: true }).net === 140000 && B.quote(P, qL, cfg, { price: 250000, keepLoan: false }).net === 175000);
ok('max bid: a target no price can reach gives no bid', B.maxBid(P, qA, cfg, { kind: 'gbp', value: 999999 }, { step: 250 }) === null);
ok('max bid: its breakdown adds up (profit = end value − costs − finance)', near(mbG.result.profit, mbG.result.profitCheck));

console.log((fails ? fails + ' FAILED of ' : 'all ') + count + ' bridging checks' + (fails ? '' : ' passed'));
process.exit(fails ? 1 : 0);

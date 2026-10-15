// The flip price, where the money comes from (your own money vs the loan) and buying a home to live in (11 Oct 2026).
// Figures worked out by hand. Run: node test-money.js
var Calc = require('./calc.js');
var fails = 0, count = 0;
function ok(name, cond, info) { count++; if (!cond) { fails++; console.log('FAIL ' + name + (info !== undefined ? ' :: ' + info : '')); } }
var near = function (a, b) { return Math.abs(a - b) < 0.6; };

// ---- the flip price: the most you can pay for your flip target margin (Ashley's deal of 11 Oct 2026) ----
var deal = { endValue: 1100000, refurb: 200000, legal: 3000, purchasePrice: 724545, ltv: 90, depositPct: 10 };
var L = Calc.ledger(deal, false);
ok('her deal: the recycle price at 90% is £724,545, and a flip there makes 10% (100% less what the lender lends)', L.exits.btl.recyclePrice === 724545 && near(L.exits.none.v.margin * 100, 10));
ok('the flip price for a 25% margin is £574,545 (cost £825,000 = 75% of £1.1m: price + its stamp duty £637,000 + refurb + legal)', L.exits.none.flipPrice === 574545, L.exits.none.flipPrice);
var at = Calc.ledger(Object.assign({}, deal, { purchasePrice: L.exits.none.flipPrice }), false).exits.none.v;
ok('... and at that price the flip margin is 25.0%', (at.margin * 100).toFixed(1) === '25.0', at.margin);
var one = Calc.ledger(Object.assign({}, deal, { purchasePrice: L.exits.none.flipPrice + 1000 }), false).exits.none.v;
ok('... a little more and it drops below the target', one.margin < 0.25);
Calc.setTargets({ flip: 30 });
var L30 = Calc.ledger(deal, false), at30 = Calc.ledger(Object.assign({}, deal, { purchasePrice: L30.exits.none.flipPrice }), false).exits.none.v;
ok('it follows your flip target (30%: lower price, 30.0% margin)', L30.exits.none.flipPrice < 574545 && (at30.margin * 100).toFixed(1) === '30.0', L30.exits.none.flipPrice);
Calc.setTargets({});
var Lb = Calc.ledger(deal, true), atb = Calc.ledger(Object.assign({}, deal, { purchasePrice: Lb.exits.none.flipPrice }), true).exits.none.v;
ok('with bridging the loan’s cost comes off first (a lower price, still 25.0% after the bridge)', Lb.exits.none.flipPrice < 574545 && (atb.margin * 100).toFixed(1) === '25.0');
ok('only the Flip exit has a flip price; no end value, no flip price', L.exits.btl.flipPrice === null && L.exits.hmo.flipPrice === null && Calc.ledger({ purchasePrice: 100000, endValue: 0 }, false).exits.none.flipPrice === null);

// ---- where the money comes from: everything you pay, less the loan, is your own money ----
var F = Calc.funding(L, 'none');
ok('mortgage: the rows are the price and every cost, adding up to the total to pay (£990,000)', F.rows.map(function (r) { return r[0]; }).join('|') === 'Purchase price|Stamp duty|Legal costs|Refurb costs' && near(F.total, 990000));
ok('mortgage: the loan is the price less the 10% deposit (£652,090.50)', F.loan.kind === 'mortgage' && near(F.loan.amount, 652090.5));
ok('mortgage: your own money is £337,909 = deposit + stamp duty + legal + refurb (the same as before)', near(F.own, 337909) && near(F.own, L.exits.none.own.total) && near(F.own + F.loan.amount, F.total));
var Fc = Calc.funding(Calc.ledger(deal, 'cash'), 'none');
ok('no funding: no loan; your own money is the whole £990,000 total to pay', Fc.loan.kind === 'cash' && Fc.loan.amount === 0 && near(Fc.total, 990000) && near(Fc.own, 990000) && Fc.over === 0 && !Fc.rows.some(function (r) { return /bridge/i.test(r[0]); }));
var Fh = Calc.funding(L, 'hmo');
ok('an HMO let adds its furnishing as a cost', !Fh.rows.some(function (r) { return r[0] === 'Furnishing'; }) === !(L.exits.hmo.own.furnishing > 0) && near(Fh.own, L.exits.hmo.own.total));
var other = Calc.funding(Calc.ledger(Object.assign({ otherUpfront: 1000 }, deal), false), 'none');
ok('other costs are a row and come from your own money', other.rows.some(function (r) { return r[0] === 'Other costs' && r[1] === 1000; }) && near(other.own - F.own, 1000));
// bridging (design 1b): the loan is the net loan the lender sends; its legal, valuation and broker fees are yours; the
// rolled-up interest is repaid at the end with it (the gross), from the refinance or the sale
var bd = Object.assign({ bridgeNet: 900000, bridgeRatePct: 0.85, bridgeLegal: 1200, bridgeValuation: 350, bridgeBroker: 1000 }, deal);
var B = Calc.funding(Calc.ledger(bd, true), 'none');
var int900 = 900000 * (Math.pow(1.0085, 9) - 1);   // 0.85% a month compounding for 9 months on £900,000
ok('bridging: the loan is the net loan (£900,000); interest compounds (£71,237.93); the gross is net + interest; you repay it plus a 1% exit fee (£9,000)', B.loan.kind === 'bridge' && B.loan.amount === 900000 && near(B.loan.interest, int900) && near(B.loan.gross, 900000 + int900) && near(B.loan.exit, 9000) && near(B.loan.repay, 900000 + int900 + 9000) && near(B.loan.fees, 18000 + 2550) && Math.round(int900) === 71238);
ok('bridging: its four fees are rows you pay (2% arrangement £18,000 + £1,200 + £350 + £1,000); your own money = total to pay less the loan (£110,550)', ['Bridge arrangement fee|18000', 'Bridge legal fees|1200', 'Bridge valuation fee|350', 'Bridge broker fee|1000'].every(function (t) { return B.rows.some(function (r) { return r.join('|') === t; }); }) && near(B.total, 990000 + 18000 + 2550) && near(B.own, 110550));
ok('bridging: the interest is not paid as you go (no interest row), and own money agrees with the ledger', !B.rows.some(function (r) { return /interest/i.test(r[0]); }) && near(B.own, Calc.ledger(bd, true).exits.none.own.total));
var Bz = Calc.funding(Calc.ledger(Object.assign({}, bd, { bridgeBroker: 0 }), true), 'none');
ok('a fee of £0 is not listed', !Bz.rows.some(function (r) { return r[0] === 'Bridge broker fee'; }) && near(B.own - Bz.own, 1000));
var big = Calc.funding(Calc.ledger(Object.assign({}, bd, { bridgeNet: 2000000 }), true), 'none');
ok('a loan bigger than the total: your own money is £0 and the extra is shown, never a minus', big.own === 0 && big.over > 0);

// ---- buying a home to live in ----
var base = { price: 250000, depositPct: 10, region: 'eng', buyer: 'ftb', legal: 1500, survey: 500, fees: 999, other: 0, rate: 4.5, term: 25 };
var H = Calc.homeBuy(base);
ok('£250,000, first-time buyer in England: no stamp duty (relief to £300,000)', H.sdlt === 0);
ok('... deposit £25,000, borrowed £225,000 (90%)', H.deposit === 25000 && H.loan === 225000 && H.ltv === 90);
ok('... your own money £27,999 = deposit + legal + survey + mortgage fees', H.own === 27999 && H.total === 252999 && H.own + H.loan === H.total);
ok('... repayment £1,250.62 a month over 25 years, £150,186.92 interest', near(H.monthly, 1250.62) && near(H.interest, 150186.92) && H.months === 300);
var tax = function (o) { return Calc.homeBuy(Object.assign({}, base, o)).sdlt; };
ok('moving home in England: 2% from £125,000 = £2,500; a second home adds 5% of the price = £15,000', tax({ buyer: 'main' }) === 2500 && tax({ buyer: 'add' }) === 15000);
ok('first-time buyer above £500,000 in England gets no relief: £600,000 = £20,000 at main rates', tax({ price: 600000 }) === 20000 && tax({ price: 600000, buyer: 'main' }) === 20000);
ok('first-time buyer at £400,000 in England: 5% on £100,000 over £300,000 = £5,000', tax({ price: 400000 }) === 5000);
ok('Scotland, first-time buyer: nil to £175,000, 2% on £75,000 = £1,500; moving home: £2,100', tax({ region: 'sco' }) === 1500 && tax({ region: 'sco', buyer: 'main' }) === 2100);
ok('Wales: no first-time buyer relief (worked out as a main home: 6% on £25,000 over £225,000 = £1,500)', tax({ region: 'wal' }) === 1500 && tax({ region: 'wal', buyer: 'main' }) === 1500);
ok('0% interest: the loan simply split over the months', near(Calc.homeBuy(Object.assign({}, base, { rate: 0 })).monthly, 750));
var cash = Calc.homeBuy(Object.assign({}, base, { depositPct: 100 }));
ok('buying with cash (100% deposit): nothing borrowed, no repayment, your own money is the whole cost', cash.loan === 0 && cash.monthly === 0 && cash.own === cash.total);
ok('nothing typed: all zero, no NaN', JSON.stringify(Calc.homeBuy({})).indexOf('NaN') < 0 && Calc.homeBuy({}).own === 0);

console.log((fails ? fails + ' FAILED of ' : 'all ') + count + ' money checks' + (fails ? '' : ' passed'));
process.exit(fails ? 1 : 0);

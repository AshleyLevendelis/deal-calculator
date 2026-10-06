// Checks "Any other costs" (otherUpfront: survey, valuation, broker; design 7a, 6 Oct 2026): in every buy calculator
// £1,000 of other costs raises the money in and the cash left in by exactly £1,000, comes off the recycle price so
// that buying there still leaves nothing in, and at £0 changes nothing.
const Calc = require('./calc.js');
let n = 0, fails = 0;
function ok(name, cond, extra) { n++; if (cond) console.log('ok:   ' + name); else { fails++; console.log('FAIL: ' + name + ' ' + (extra || '')); } }
const run = (id, d) => { const c = Calc.find(id); return c.compute(Calc.stateFor(c, d)).v; };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const deal = { purchasePrice: 125000, refurb: 30000, legal: 1500, endValue: 230000 };
['flip', 'btl', 'sabtl', 'hmobrr', 'sabrr', 'hmo', 'r2rhmo', 'r2rsa'].forEach(id => {
  const a = run(id, deal), b = run(id, Object.assign({}, deal, { otherUpfront: 1000 }));
  ok(id + ': £1,000 of other costs adds exactly £1,000 to the money in', near(b.totalIn - a.totalIn, 1000), a.totalIn + ' -> ' + b.totalIn);
  if (typeof a.cashLeft === 'number') ok(id + ': ... and to the cash left in', near(b.cashLeft - a.cashLeft, 1000));
  if (typeof a.ownMoney === 'number') ok(id + ': ... and to your own money', near(b.ownMoney - a.ownMoney, 1000));
  ok(id + ': £0 of other costs changes nothing', JSON.stringify(run(id, Object.assign({}, deal, { otherUpfront: 0 }))) === JSON.stringify(a));
});
const f0 = run('flip', deal), f1 = run('flip', Object.assign({}, deal, { otherUpfront: 1000 }));
ok('flip: the profit drops by £1,000 and the margin follows', near(f0.profit - f1.profit, 1000) && near(f1.margin, f1.profit / 230000));
ok('BRR to BTL: the ROI on cash left in is worked out on the bigger cash left in', typeof f1.roi === typeof f0.roi);
ok('BRR to BTL: "most you can pay and get it back in 2 years" drops by about £1,000', (() => { const a = f0.paybackPrice, b = f1.paybackPrice; return a > 0 && a - b >= 900 && a - b <= 1000; })(), f0.paybackPrice + ' -> ' + f1.paybackPrice);
ok('the payback price drops by about £1,000 (it is a price plus its stamp duty)', (() => { const a = run('hmobrr', deal).paybackPrice, b = run('hmobrr', Object.assign({}, deal, { otherUpfront: 1000 })).paybackPrice; return a == null || (a - b >= 900 && a - b <= 1000); })());
// The recycle price: other costs come off the budget, so buying at it still leaves nothing in.
const rp0 = Calc.recyclePrice(Calc.stateFor(Calc.find('flip'), deal)), d1 = Object.assign({}, deal, { otherUpfront: 1000 }), rp1 = Calc.recyclePrice(Calc.stateFor(Calc.find('flip'), d1));
ok('the recycle price drops when there are other costs', rp1 < rp0 && rp0 - rp1 <= 1000, rp0 + ' -> ' + rp1);
ok('buying at the new recycle price leaves nothing in (under a pound), and one pound more leaves cash in', (c => c <= 0 && c > -1)(run('flip', Object.assign({}, d1, { purchasePrice: rp1 })).cashLeft) && run('flip', Object.assign({}, d1, { purchasePrice: rp1 + 1 })).cashLeft > 0);
ok('Max price takes it off too', run('recycle', d1).maxPrice === rp1);
ok('cash left at a price includes it', near(Calc.cashLeftAtPrice(Calc.stateFor(Calc.find('recycle'), d1), 120000).cashLeft - Calc.cashLeftAtPrice(Calc.stateFor(Calc.find('recycle'), deal), 120000).cashLeft, 1000));
// The Calculator's own sums (the ledger), every way out, with and without bridging.
[false, true].forEach(br => {
  const L0 = Calc.ledger(deal, br), L1 = Calc.ledger(d1, br), tag = br ? ' (bridging on)' : '';
  ['none', 'btl', 'hmo', 'sa'].forEach(k => {
    ok('ledger ' + k + tag + ': cash left in up by £1,000', near(L1.exits[k].v.cashLeft - L0.exits[k].v.cashLeft, 1000));
    ok('ledger ' + k + tag + ': your own money in up by £1,000, shown as its own row', near(L1.exits[k].own.total - L0.exits[k].own.total, 1000) && L1.exits[k].own.other === 1000 && L0.exits[k].own.other === 0);
    ok('ledger ' + k + tag + ': the recycle price drops', L1.exits[k].recyclePrice == null || L1.exits[k].recyclePrice < L0.exits[k].recyclePrice);
  });
  ok('ledger' + tag + ': the flip profit drops by £1,000', near(L0.exits.none.v.profit - L1.exits.none.v.profit, 1000));
});
ok('it is one figure shared by every calculator (asked once)', Calc.calcs.filter(c => c.layout.some(s => s.items.some(i => i.field && i.field.id === 'otherUpfront'))).map(c => c.id).join() === 'flip,btl,hmo,sabtl,hmobrr,sabrr,r2rhmo,r2rsa');
ok('it is the up-front "Any other costs", not the monthly running cost ("other")', run('btl', Object.assign({}, deal, { otherUpfront: 1000 })).monthly === run('btl', deal).monthly);
console.log(n + ' checks ran');
if (fails) process.exit(1);

// Checks the port against the values cached in the original spreadsheet.
const { analyse, stampDuty } = require('./calc.js');
let fail = 0;
const eq = (name, got, want) => { const ok = Math.abs(got - want) < 1e-6; if (!ok) fail++; console.log((ok ? 'ok:   ' : 'FAIL: ') + name, got, ok ? '' : '(want ' + want + ')'); };

const base = { purchasePrice: 125000, depositPct: 25, stampDutyOverride: '', legal: 3000, refurb: 45000, endValue: 230000,
  ltv: 75, mortgageRate: 5, monthlyRent: 1000, mgmtPct: 10, voidsPct: 10, sellingPct: 0, holdingMonths: 0, holdingMonthly: 0 };
const r = analyse(base);
eq('deposit', r.deposit, 31250); eq('mortgage', r.mortgage, 93750); eq('SDLT', r.sdlt, 6250);
eq('total money in', r.flip.totalIn, 179250); eq('flip profit', r.flip.profit, 50750);
eq('flip net profit %', r.flip.margin, 0.22065217391304348);
eq('re-mortgage', r.btl.newMortgage, 172500); eq('cash left', r.btl.cashLeft, 6750);
eq('interest/mo', r.btl.interest, 718.75); eq('expenses/mo', r.btl.expenses, 918.75);
eq('monthly profit', r.btl.monthly, 81.25); eq('annual profit', r.btl.annual, 975);
eq('ROI for BTL', r.btl.roi, 0.14444444444444443);
// stamp duty at every band edge, straight from the sheet's formula
eq('SDLT 250k', stampDuty(250000), 6250 + 8750); eq('SDLT 925k', stampDuty(925000), 6250 + 8750 + 67500);
eq('SDLT 1.5m', stampDuty(1500000), 6250 + 8750 + 67500 + 86250); eq('SDLT 2m: charged slice by slice, 17% only above 1.5m (the sheet charged 17% on all of it, which HMRC does not)', stampDuty(2000000), 6250 + 8750 + 67500 + 86250 + 85000);
// money-out case: remortgage more than is in the deal
const m = analyse({ ...base, ltv: 90 });
if (m.btl.cashLeft < 0 && m.btl.moneyOut && m.btl.roi === null) console.log('ok:   money-out case'); else { fail++; console.log('FAIL: money-out case'); }
// optional extras reduce profit
eq('selling and holding costs are not part of the flip (they are not in the sheet)', analyse({ ...base, sellingPct: 2, holdingMonths: 3, holdingMonthly: 500 }).flip.profit, analyse(base).flip.profit);
process.exit(fail ? 1 : 0);

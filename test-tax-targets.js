// Checks stamp duty for every place and buyer at the edges of each band, and the person's own targets: every verdict
// and every target's name follows them, and nothing is left fixed at 25 / 500 / 50 / 6.
const Calc = require('./calc.js');
let n = 0, fails = 0;
function ok(name, cond, extra) { n++; if (cond) console.log('ok:   ' + name); else { fails++; console.log('FAIL: ' + name + ' ' + (extra || '')); } }
const near = (a, b) => Math.abs(a - b) < 0.005;

// ---- Stamp duty: worked out by hand from the published bands (2026-27), slice by slice ----
const CASES = {
  'eng add': [[39999, 0], [40000, 2000], [125000, 6250], [250000, 15000], [925000, 82500], [1500000, 168750], [2000000, 253750]],
  'eng main': [[125000, 0], [125001, 0.02], [250000, 2500], [925000, 36250], [1500000, 93750], [2000000, 153750]],
  'eng ftb': [[300000, 0], [300001, 0.05], [500000, 10000], [500001, 15000.05], [800000, 30000]],
  'sco main': [[145000, 0], [250000, 2100], [325000, 5850], [750000, 48350], [1000000, 78350]],
  'sco ftb': [[175000, 0], [250000, 1500], [325000, 5250], [750000, 47750]],
  'sco add': [[39999, 0], [40000, 3200], [145000, 11600], [200000, 17100], [750000, 108350]],
  'wal main': [[225000, 0], [400000, 10500], [750000, 36750], [1500000, 111750], [2000000, 171750]],
  'wal add': [[39999, 0], [40000, 2000], [180000, 9000], [250000, 14950], [400000, 29950], [750000, 73700], [1500000, 186200], [2000000, 271200]],
  'wal ftb': [[225000, 0], [400000, 10500]]                        // no first-time buyer relief in Wales: the main rates
};
Object.keys(CASES).forEach(k => {
  const [r, b] = k.split(' '), bad = CASES[k].filter(([p, want]) => !near(Calc.propertyTax(p, r, b), want));
  ok(k + ': every band edge', !bad.length, bad.map(([p, want]) => p + ' gave ' + Calc.propertyTax(p, r, b) + ' want ' + want).join('; '));
});
ok('no price, a zero price or nonsense gives no tax', [0, -5, '', null, NaN, 'abc'].every(p => Calc.propertyTax(p, 'eng', 'add') === 0));
ok('an unknown place or buyer falls back to England & NI, additional property', Calc.propertyTax(300000, 'xx', 'yy') === Calc.propertyTax(300000, 'eng', 'add'));
ok('the default setting is England & NI, additional property (as the app always assumed)', JSON.stringify(Calc.taxSetting()) === '{"region":"eng","buyer":"add"}' && Calc.stampDuty(250000) === 15000);
// The setting reaches every calculator, because they all work out stamp duty through it.
const deal = { endValue: 230000, purchasePrice: 125000, refurb: 30000, legal: 1500 };
const before = Calc.ledger(deal, false);
Calc.setTax({ region: 'sco', buyer: 'main' });
const after = Calc.ledger(deal, false);
ok('switching to Scotland, main home: stamp duty on 125,000 is 0 everywhere', Calc.stampDuty(125000) === 0 && after.exits.none.v.sdlt === 0 && after.exits.btl.own.sdlt === 0);
ok('... so more profit on the flip, and a higher recycle price', after.exits.none.v.profit === before.exits.none.v.profit + 6250 && after.exits.btl.recyclePrice > before.exits.btl.recyclePrice);
ok('... and the other calculators follow (BTL money in drops by the 6,250)', Calc.find('btl').compute(Calc.stateFor(Calc.find('btl'), deal)).v.totalIn === Calc.find('btl').compute(Calc.stateFor(Calc.find('btl'), deal)).v.totalIn && (() => {
  const c = Calc.find('btl'), now = c.compute(Calc.stateFor(c, deal)).v.totalIn; Calc.setTax({ region: 'eng', buyer: 'add' }); const was = c.compute(Calc.stateFor(c, deal)).v.totalIn; Calc.setTax({ region: 'sco', buyer: 'main' }); return was - now === 6250; })());
ok('... and the recycle price search uses it (price + its tax fits the budget, one pound more does not)', (() => { const p = Calc.priceForBudget(150000); return p + Calc.stampDuty(p) <= 150000 && p + 1 + Calc.stampDuty(p + 1) > 150000; })());
ok('a first-time buyer in Wales is treated as a main home', JSON.stringify(Calc.setTax({ region: 'wal', buyer: 'ftb' })) === '{"region":"wal","buyer":"main"}');
ok('labels name the basis, e.g. "Scotland, main home" and LBTT', Calc.taxLabel({ region: 'sco', buyer: 'main' }).short === 'Scotland, main home' && Calc.taxLabel({ region: 'sco', buyer: 'main' }).tax === 'LBTT' && Calc.taxLabel({ region: 'eng', buyer: 'add' }).short === 'England & NI, additional property');
Calc.setTax({ region: 'eng', buyer: 'add' });

// ---- Targets ----
ok('the targets start at 25% flip, £500 a month, 50% ROI, 6 months back', JSON.stringify(Calc.targets()) === '{"flip":25,"monthly":500,"roi":50,"payback":6}' && Calc.targetsSummary() === '25% flip · £500/mo · 50% ROI · 6 mo back');
const t = Calc.setTargets({ flip: 20, monthly: 300, roi: 40, payback: 12 });
ok('setting them is reflected straight back', JSON.stringify(t) === '{"flip":20,"monthly":300,"roi":40,"payback":12}' && Calc.targetsSummary() === '20% flip · £300/mo · 40% ROI · 12 mo back');
ok('flip: green from the new target (20%), amber 5 points below it (15%), red below that', Calc.flipVerdict(0.2) === 'good' && Calc.flipVerdict(0.15) === 'ok' && Calc.flipVerdict(0.149) === 'bad' && Calc.FLIP_TARGET === 0.2 && Calc.FLIP_OK === 0.15);
ok('monthly profit judged against £300', Calc.monthlyProfitVerdict(300) === 'good' && Calc.monthlyProfitVerdict(299.99) === 'bad' && Calc.MONTHLY_PROFIT_TARGET === 300);
ok('ROI on cash left in judged against 40%', Calc.cashRoiVerdict(0.4) === 'good' && Calc.cashRoiVerdict(0.399) === 'bad' && Calc.CASH_ROI_TARGET === 0.4);
ok('money back: green to 12 months, amber still to 24', Calc.paybackVerdict(12, 1) === 'good' && Calc.paybackVerdict(12.1, 1) === 'amber' && Calc.paybackVerdict(24, 1) === 'amber' && Calc.paybackVerdict(24.1, 1) === 'bad');
ok('the target names follow: £300 a month, 40% ROI, Money back in 12 months', Calc.letTargets().join('|') === '£300 a month|40% ROI|Money back in 12 months|All cash recycled');
const vl = Calc.dealVerdict('btl', { monthly: 350, roi: 0.45, cashLeft: 3000, breakeven: 10 });
ok('the verdict scores against them (3 of 4: only the cash left in misses)', vl.score === 3 && vl.line === 'Misses: All cash recycled', JSON.stringify(vl));
const vf = Calc.dealVerdict('none', { margin: 0.17, profit: 30000 });
ok('the flip verdict names the new target and band: "OK: between 15% and the 20% target"', vf.title === 'OK flip' && vf.detail === '17.0% margin · target 20%' && vf.targets[0] === '20% margin (amber from 15%)' && vf.line === 'OK: between 15% and the 20% target', JSON.stringify(vf));
ok('pounds are written with commas (£1,250 a month)', (Calc.setTargets({ flip: 20, monthly: 1250, roi: 40, payback: 12 }), Calc.letTargets()[0] === '£1,250 a month'));
ok('one month is "1 month"', (Calc.setTargets({ payback: 1 }), Calc.letTargets()[2] === 'Money back in 1 month'));
ok('anything missing or nonsense goes back to the starting figure', JSON.stringify(Calc.setTargets({ flip: 'x', monthly: '', roi: null })) === '{"flip":25,"monthly":500,"roi":50,"payback":6}');
ok('limits: flip 1-100%, ROI 1-1000%, payback 1-24 months (the amber limit), monthly not below 0', JSON.stringify(Calc.setTargets({ flip: 500, monthly: -50, roi: 0, payback: 60 })) === '{"flip":100,"monthly":0,"roi":1,"payback":24}');
ok('decimals are kept to 2 places (22.5% flip)', Calc.setTargets({ flip: 22.456 }).flip === 22.46);
Calc.setTargets(Calc.defaultTargets());
ok('back to the starting targets restores every rule', Calc.flipVerdict(0.25) === 'good' && Calc.flipVerdict(0.2) === 'ok' && Calc.monthlyProfitVerdict(500) === 'good' && Calc.cashRoiVerdict(0.5) === 'good' && Calc.paybackVerdict(6, 1) === 'good' && Calc.paybackVerdict(6.1, 1) === 'amber');
// No fixed target figures are left in the verdict code: every one comes from the targets.
const src = require('fs').readFileSync(__dirname + '/calc.js', 'utf8'), vd = src.slice(src.indexOf('function dealVerdict'), src.indexOf('var api = '));
ok('dealVerdict has no hard-coded 25 / 500 / 50 / 6', !/'(?:\\u00a3|£)500|25%|50%|6 months/.test(vd));
console.log(n + ' checks ran');
if (fails) process.exit(1);

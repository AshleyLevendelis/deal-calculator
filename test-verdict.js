// Checks the verdict docked above the Calculator's buttons (Calc.dealVerdict, design 6c): the four let targets, the flip
// target, the titles and colours, and the edges (exactly 500 a month, exactly 6 months, nothing left in, never paying back).
const Calc = require('./calc.js');
let n = 0, fails = 0;
function ok(name, cond, extra) { n++; if (cond) console.log('ok:   ' + name); else { fails++; console.log('FAIL: ' + name + ' ' + (extra || '')); } }
const V = Calc.dealVerdict;
// A let that hits every target, then each target broken on its own.
const best = { monthly: 600, roi: 0.8, cashLeft: -100, breakeven: 0 };
const left = (o) => Object.assign({ monthly: 600, roi: 0.8, cashLeft: 2000, breakeven: 2000 / 600 }, o);
let r = V('btl', best);
ok('all four targets: Strong deal, 4/4, good, "Every target met"', r.score === 4 && r.of === 4 && r.title === 'Strong deal' && r.tone === 'good' && r.detail === 'hits all 4 targets' && r.line === 'Every target met' && r.misses.length === 0, JSON.stringify(r));
r = V('hmo', left());
ok('cash left in (but ROI, payback and profit fine): Good deal, 3/4, misses only "All cash recycled"', r.score === 3 && r.title === 'Good deal' && r.tone === 'good' && r.line === 'Misses: All cash recycled' && r.detail === 'hits 3 of 4 targets', JSON.stringify(r));
r = V('sa', left({ monthly: 499.99, breakeven: 2000 / 499.99 }));
ok('£499.99 a month misses the £500 target', !r.hits[0] && r.misses[0] === '£500 a month', JSON.stringify(r));
ok('exactly £500 a month hits it', V('btl', left({ monthly: 500, breakeven: 4 })).hits[0]);
ok('£499.995 shows as £500.00, so it hits it (judged on the pence shown)', V('btl', left({ monthly: 499.995, breakeven: 4 })).hits[0]);
ok('ROI exactly 50% hits it', V('btl', left({ roi: 0.5 })).hits[1]);
ok('ROI 49.9% misses it', !V('btl', left({ roi: 0.499 })).hits[1]);
ok('ROI shown as infinity (nothing left in) hits it', V('btl', { monthly: 600, roi: '∞ (no cash left in)', cashLeft: -5, breakeven: 0 }).hits[1]);
ok('a low ROI still passes when no cash is left in', V('btl', { monthly: 600, roi: 0.01, cashLeft: 0, breakeven: 0 }).hits[1]);
ok('exactly 6 months back hits it', V('btl', left({ breakeven: 6 })).hits[2]);
ok('6.04 months shows as 6 months, so it hits it', V('btl', left({ breakeven: 6.04 })).hits[2]);
ok('6.1 months misses it', !V('btl', left({ breakeven: 6.1 })).hits[2]);
ok('never paying back misses it', !V('btl', left({ monthly: -50, breakeven: 'Not at this profit' })).hits[2]);
ok('nothing left in counts as 0 months back', V('btl', { monthly: 100, roi: 0.1, cashLeft: 0, breakeven: 'Not at this profit' }).hits[2]);
ok('cash left exactly 0 is all cash recycled', V('btl', { monthly: 600, roi: 'x', cashLeft: 0, breakeven: 0 }).hits[3]);
ok('cash left of 40p shows as £0, so it is all cash recycled', V('btl', { monthly: 600, roi: 1500, cashLeft: 0.4, breakeven: 0.0007 }).hits[3]);
ok('cash left of £1 is not recycled', !V('btl', left({ cashLeft: 1, breakeven: 1 / 600, roi: 7200 })).hits[3]);
// Titles and colours by score, and the order of the misses.
r = V('btl', left({ monthly: 100, roi: 0.6, breakeven: 5 }));
ok('2 of 4: Borderline, amber', r.score === 2 && r.title === 'Borderline' && r.tone === 'amber', JSON.stringify(r));
r = V('btl', left({ monthly: 100, roi: 0.1, breakeven: 5 }));
ok('1 of 4: Weak deal, bad', r.score === 1 && r.title === 'Weak deal' && r.tone === 'bad' && r.detail === 'hits 1 of 4 targets', JSON.stringify(r));
r = V('btl', left({ monthly: -10, roi: -0.06, breakeven: 'Not at this profit' }));
ok('0 of 4: Weak deal, bad, every miss listed in order', r.score === 0 && r.tone === 'bad' && r.line === 'Misses: £500 a month, 50% ROI, Money back in 6 months, All cash recycled', JSON.stringify(r));
ok('the score counts the hits', [best, left(), left({ monthly: 100, roi: 0.1, breakeven: 20 })].every(v => { const x = V('btl', v); return x.score === x.hits.filter(Boolean).length; }));
// The flip.
r = V('none', { margin: 0.274, profit: 63000 });
ok('flip at 27.4%: Good flip, 1/1, good, "27.4% margin · target 25%"', r.score === 1 && r.of === 1 && r.title === 'Good flip' && r.tone === 'good' && r.detail === '27.4% margin · target 25%' && r.line === 'Clears the 25% flip target', JSON.stringify(r));
ok('flip at exactly 25%: Good flip', V('none', { margin: 0.25, profit: 1 }).title === 'Good flip');
ok('flip at 24.9%: OK flip, amber, 0/1 (25% target not met)', (r = V('none', { margin: 0.249, profit: 50000 })).title === 'OK flip' && r.tone === 'amber' && r.score === 0 && r.line === 'OK: between 20% and the 25% target', JSON.stringify(r));
ok('flip at exactly 20%: OK flip, amber', (r = V('none', { margin: 0.2, profit: 40000 })).title === 'OK flip' && r.tone === 'amber', JSON.stringify(r));
ok('flip at 19.9%: Weak flip, red', (r = V('none', { margin: 0.199, profit: 40000 })).title === 'Weak flip' && r.tone === 'bad' && r.score === 0 && r.line === 'Below 20%: misses the 25% flip target', JSON.stringify(r));
ok('flip at 5% with a small profit: Weak flip, red', (r = V('none', { margin: 0.05, profit: 9000 })).title === 'Weak flip' && r.tone === 'bad');
ok('no flip is ever called "Thin" any more', [0.3, 0.25, 0.22, 0.2, 0.1, 0, -0.1].every(m => V('none', { margin: m, profit: m * 100000 }).title !== 'Thin flip'));
ok('flip breaking even: Loss-making flip, bad', (r = V('none', { margin: 0, profit: 0 })).title === 'Loss-making flip' && r.tone === 'bad', JSON.stringify(r));
ok('flip losing money: Loss-making flip', V('none', { margin: -0.1, profit: -20000 }).title === 'Loss-making flip');
ok('flip with no end value: no crash, Loss-making, dash for the margin', (r = V('none', { margin: null, profit: -5 })).detail === '— margin · target 25%', JSON.stringify(r));
// On the real screen figures: bridging moves the verdict, because the lets use the bridged figures.
const deal = { endValue: 230000, purchasePrice: 125000, refurb: 30000, legal: 1500 };
const off = Calc.ledger(deal, false), on = Calc.ledger(deal, true);
ok('the example deal: Flip good, BTL 3/4, HMO 3/4, SA 4/4', V('none', off.exits.none.v).title === 'Good flip' && V('btl', off.exits.btl.v).score === 3 && V('hmo', off.exits.hmo.v).score === 3 && V('sa', off.exits.sa.v).score === 4);
ok('with bridging on, the BTL leaves cash in at a low ROI, so it drops to 0/4', V('btl', on.exits.btl.v).score === 0 && V('btl', on.exits.btl.v).misses.indexOf('All cash recycled') >= 0, JSON.stringify(V('btl', on.exits.btl.v)));
ok('the verdict agrees with the colours on screen (monthly, ROI, months back)', ['btl', 'hmo', 'sa'].every(k => [off, on].every(L => {
  const v = L.exits[k].v, x = V(k, v), out = Calc.cashKind(v.cashLeft) !== 'in';
  return x.hits[0] === (Calc.monthlyProfitVerdict(v.monthly) === 'good') && x.hits[1] === (out || Calc.cashRoiVerdict(v.roi) === 'good') && x.hits[2] === (Calc.paybackVerdict(v.breakeven, v.cashLeft) === 'good' || out);
})));
ok('the targets are listed in the order the screen names them', Calc.LET_TARGETS.join('|') === '£500 a month|50% ROI|Money back in 6 months|All cash recycled');
// The targets the strip shows as chips, and the empty state (no end value or no purchase price).
ok('a let lists its four targets as chips, ticked as scored', JSON.stringify(V('btl', left()).targets) === JSON.stringify(Calc.LET_TARGETS) && V('btl', left()).hits.join() === 'true,true,true,false');
ok('a flip lists one target, 25% margin', V('none', { margin: 0.3, profit: 1 }).targets.join() === '25% margin');
const empties = [{ endValue: 0, purchasePrice: 125000 }, { endValue: 230000, purchasePrice: 0 }, { endValue: '', purchasePrice: 125000 }, { endValue: 230000, purchasePrice: '' }, {}];
ok('no end value or no price: "Enter the deal figures", no score, no targets, no misses line, for every exit',
  empties.every(ps => ['none', 'btl', 'hmo', 'sa'].every(x => { const e = V(x, best, ps); return e.kind === 'empty' && e.score === null && e.of === null && e.title === 'Enter the deal figures' && e.detail === 'add end value and purchase price' && e.tone === 'none' && !e.targets.length && !e.hits.length && e.line === ''; })));
ok('with both figures entered the deal is scored as normal', V('btl', best, { endValue: 1, purchasePrice: 1 }).kind === 'let' && V('none', { margin: 0.3, profit: 1 }, { endValue: 1, purchasePrice: 1 }).kind === 'flip');
ok('dealEntered needs both figures above 0', Calc.dealEntered({ endValue: 5, purchasePrice: 5 }) && !Calc.dealEntered({ endValue: 5 }) && !Calc.dealEntered({ endValue: -5, purchasePrice: 5 }) && !Calc.dealEntered(null));
const blank = Calc.ledger({ endValue: 0, purchasePrice: 0, refurb: 0, legal: 1500 }, false);
ok('a blank deal would otherwise score a let (640% ROI): the empty state stops that', V('btl', blank.exits.btl.v).kind === 'let' && V('btl', blank.exits.btl.v, blank.ps).kind === 'empty');
console.log(n + ' checks ran');
if (fails) process.exit(1);

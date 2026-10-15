// An independent audit of the maths (15 Oct 2026, Ashley: "check all the maths"). It re-works every figure from first
// principles, with its own copy of the tax slices and its own formulas, and compares with calc.js over thousands of random
// deals: stamp duty / LBTT / LTT at every band edge, every exit (single let, HMO, SA, flip) with No funding, Mortgage and
// Bridging, the bridge cost, your own money, the cash-left identity, the recycle / flip / payback prices (found by trying
// £1 either side), the Max price tool, rent to rent and buying a home. Run: node test-audit.js
let __fail = 0;
(function(){
// Independent audit: re-works the maths from first principles (never calling calc.js internals) and compares.
const Calc = require('./calc.js');
let bad = 0, checks = 0; const fails = [];
const near = (a, b, tol = 0.01) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tol;
function eq(name, got, want, tol) { checks++; const ok = (typeof want === 'number') ? near(got, want, tol) : got === want; if (!ok) { bad++; if (fails.length < 40) fails.push(name + ' :: got ' + got + ' want ' + want); } }
// deterministic random
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (lo, hi, step) => lo + Math.round(rnd() * (hi - lo) / step) * step;

// ---- 1. stamp duty / LBTT / LTT by slice, written fresh ----
const slice = (P, lo, hi, r) => Math.max(0, Math.min(P, hi) - lo) * r;
const SD = {
  engMain: P => slice(P, 125e3, 250e3, .02) + slice(P, 250e3, 925e3, .05) + slice(P, 925e3, 1.5e6, .10) + slice(P, 1.5e6, 1e12, .12),
  engFtb: P => P > 500e3 ? SD.engMain(P) : slice(P, 300e3, 500e3, .05),
  scoMain: P => slice(P, 145e3, 250e3, .02) + slice(P, 250e3, 325e3, .05) + slice(P, 325e3, 750e3, .10) + slice(P, 750e3, 1e12, .12),
  scoFtb: P => slice(P, 175e3, 250e3, .02) + slice(P, 250e3, 325e3, .05) + slice(P, 325e3, 750e3, .10) + slice(P, 750e3, 1e12, .12),
  walMain: P => slice(P, 225e3, 400e3, .06) + slice(P, 400e3, 750e3, .075) + slice(P, 750e3, 1.5e6, .10) + slice(P, 1.5e6, 1e12, .12),
  walHigher: P => slice(P, 0, 180e3, .05) + slice(P, 180e3, 250e3, .085) + slice(P, 250e3, 400e3, .10) + slice(P, 400e3, 750e3, .125) + slice(P, 750e3, 1.5e6, .15) + slice(P, 1.5e6, 1e12, .17)
};
const want = (region, buyer, P) => {
  if (!(P > 0)) return 0; const hi = buyer === 'add' && P >= 40000;
  if (region === 'eng') return buyer === 'ftb' ? SD.engFtb(P) : SD.engMain(P) + (hi ? .05 * P : 0);
  if (region === 'sco') return buyer === 'ftb' ? SD.scoFtb(P) : SD.scoMain(P) + (hi ? .08 * P : 0);
  return hi ? SD.walHigher(P) : SD.walMain(P);   // Wales: no FTB relief
};
const PRICES = [0, 1, 39999, 40000, 100000, 124999, 125000, 125001, 145000, 175000, 180000, 225000, 249999, 250000, 250001, 299999, 300000, 325000, 400000, 499999, 500000, 500001, 750000, 925000, 925001, 1500000, 1500001, 2000000];
for (const rg of ['eng', 'sco', 'wal']) for (const by of ['add', 'main', 'ftb']) for (const P of PRICES) eq('tax ' + rg + by + P, Calc.propertyTax(P, rg, by), want(rg, by, P), 1e-6);
// well-known published figures
eq('SDLT £300k main = £5,000', Calc.propertyTax(300000, 'eng', 'main'), 5000);
eq('SDLT £500k second home = £40,000', Calc.propertyTax(500000, 'eng', 'add'), 40000);
eq('SDLT £300k first-time buyer = £0', Calc.propertyTax(300000, 'eng', 'ftb'), 0);
eq('SDLT £400k FTB = £5,000', Calc.propertyTax(400000, 'eng', 'ftb'), 5000);
eq('LBTT £300k main = £4,600', Calc.propertyTax(300000, 'sco', 'main'), 4600);
eq('LTT £300k main = £4,500', Calc.propertyTax(300000, 'wal', 'main'), 4500);

// ---- 2. the ledger, every exit, every funding mode, 400 random deals ----
Calc.setTax({ region: 'eng', buyer: 'add' });
const interest = (loan, rate) => loan * rate / 100 / 12;
const DEF = { mortgageRate: 5, mgmtPct: 10, voidsPct: 10, monthlyRent: 1000, roomRate: 595, rooms: 4, maintPct: 10, council: 150, utilities: 400, other: 0,
  nightlyRate: 120, occupancyPct: 74, commPct: 15, maintOnMortgagePct: 10, channel: 35, furnishing: 4500, otherUpfront: 0 };
for (let t = 0; t < 400; t++) {
  const d = { endValue: pick(100e3, 600e3, 5000), purchasePrice: pick(50e3, 400e3, 2500), refurb: pick(0, 120e3, 2500), legal: pick(0, 6e3, 250), otherUpfront: pick(0, 4e3, 250),
    ltv: pick(50, 85, 5), mortgageRate: pick(2, 8, 0.25), monthlyRent: pick(500, 2500, 25), roomRate: pick(300, 800, 5), rooms: pick(3, 8, 1), nightlyRate: pick(60, 250, 5), occupancyPct: pick(40, 90, 5), furnishing: pick(0, 15e3, 500) };
  const S = Object.assign({}, DEF, d), E = S.endValue, P = S.purchasePrice, sd = want('eng', 'add', P);
  const bridge = { bridgeNet: pick(30e3, 300e3, 500), bridgeRatePct: pick(0.5, 1.5, 0.01), bridgeMonths: pick(3, 18, 1), bridgeArrangePct: pick(0, 3, 0.25), bridgeExitPct: pick(0, 2, 0.25), bridgeLegal: pick(0, 3e3, 50), bridgeValuation: pick(0, 1e3, 25), bridgeBroker: pick(0, 3e3, 50) };
  const refi = E * S.ltv / 100;
  for (const mode of ['cash', 'mortgage', 'bridge']) {
    const deal = Object.assign({}, d, mode === 'bridge' ? bridge : {}), L = Calc.ledger(deal, mode);
    // bridge by hand
    const b = mode === 'bridge' ? (() => { const int = bridge.bridgeNet * (Math.pow(1 + bridge.bridgeRatePct / 100, bridge.bridgeMonths) - 1), up = bridge.bridgeNet * bridge.bridgeArrangePct / 100 + bridge.bridgeLegal + bridge.bridgeValuation + bridge.bridgeBroker, ex = bridge.bridgeNet * bridge.bridgeExitPct / 100; return { int, gross: bridge.bridgeNet + int, up, ex, repay: bridge.bridgeNet + int + ex, cost: int + up + ex }; })() : { int: 0, up: 0, ex: 0, repay: 0, cost: 0, gross: 0 };
    const tag = t + mode;
    eq('bridge cost ' + tag, L.bridgeCost, b.cost);
    // BTL exit (flip calc's rental half)
    const exits = {
      btl: { fixed: S.legal + S.refurb + S.otherUpfront, income: S.monthlyRent, exp: interest(refi, S.mortgageRate) + S.monthlyRent * (S.mgmtPct + S.voidsPct) / 100 },
      hmo: { fixed: S.legal + S.refurb + S.otherUpfront + S.furnishing, income: S.rooms * S.roomRate, exp: null },
      sa: { fixed: S.legal + S.refurb + S.otherUpfront + S.furnishing, income: S.nightlyRate * S.rooms * 365 * S.occupancyPct / 100 / 12, exp: null } };
    exits.hmo.exp = interest(refi, S.mortgageRate) + exits.hmo.income * (10 + 10) / 100 + 150 + 400 + 400;   // BRR to HMO's own starting running costs
    exits.sa.exp = interest(refi, S.mortgageRate) + exits.sa.income * 15 / 100 + interest(refi, S.mortgageRate) * 10 / 100 + 132 + 240 + 35;   // BRR to SA's own starting running costs
    for (const k of ['btl', 'hmo', 'sa']) {
      const X = L.exits[k], v = X.v, ex = exits[k], totalIn = P + sd + ex.fixed, cashLeft = totalIn + b.cost - refi, monthly = ex.income - ex.exp;
      eq('monthly ' + k + tag, v.monthly, monthly); eq('annual ' + k + tag, v.annual, monthly * 12);
      eq('cashLeft ' + k + tag, v.cashLeft, cashLeft); eq('totalIn ' + k + tag, v.totalIn, totalIn + b.cost);
      if (cashLeft > 0 && monthly !== 0) eq('roi ' + k + tag, v.roi, monthly * 12 / cashLeft, 1e-9);
      if (cashLeft > 0 && monthly > 0) eq('breakeven ' + k + tag, v.breakeven, cashLeft / monthly, 1e-9);
      // own money: what you actually pay out of pocket at the start
      const own = mode === 'cash' ? totalIn : mode === 'mortgage' ? totalIn - P * (1 - (100 - S.ltv) / 100) : Math.max(0, totalIn + b.up - bridge.bridgeNet);
      eq('own ' + k + tag, X.own.total, mode === 'mortgage' ? P * (100 - S.ltv) / 100 + sd + ex.fixed : own);
      // money borrowed + own = everything paid at the start
      const F = Calc.funding(L, k);
      eq('funding adds up ' + k + tag, F.own + F.loan.amount - F.over, F.total, 0.005);
      // the cash left in after everything = own money at the start less what the refinance hands back after repaying the loan
      const handBack = refi - (mode === 'bridge' ? b.repay : mode === 'mortgage' ? P * (1 - (100 - S.ltv) / 100) : 0);
      if (F.over === 0) eq('cash-left identity ' + k + tag, X.own.total - handBack, cashLeft, 0.01);   // (a loan bigger than the whole purchase is clamped to £0 own money)
      // the recycle price: £1 over leaves cash in, at it nothing left in (brute force on the same ledger)
      if (X.recyclePrice != null) {
        const at = Calc.ledger(Object.assign({}, deal, { purchasePrice: X.recyclePrice }), mode).exits[k].v.cashLeft, up = Calc.ledger(Object.assign({}, deal, { purchasePrice: X.recyclePrice + 1 }), mode).exits[k].v.cashLeft;
        eq('recycle at ' + k + tag, at <= 0.01 && up > 0, true);
      }
    }
    // flip
    const fx = L.exits.none, flipTotal = P + sd + S.legal + S.refurb + S.otherUpfront, profit = E - flipTotal - b.cost;
    eq('flip profit ' + tag, fx.v.profit, profit); eq('flip margin ' + tag, fx.v.margin, profit / E, 1e-9);
    if (fx.flipPrice != null) {
      const at = Calc.ledger(Object.assign({}, deal, { purchasePrice: fx.flipPrice }), mode).exits.none.v.margin, up = Calc.ledger(Object.assign({}, deal, { purchasePrice: fx.flipPrice + 1 }), mode).exits.none.v.margin;
      eq('flip price ' + tag, at >= 0.25 - 1e-9 && up < 0.25 + 1e-9, true);
    }
  }
}

// ---- 3. buying a home to live in ----
for (const price of [150000, 250000, 480000]) for (const rate of [0, 3.5, 5.25]) for (const term of [10, 25, 35]) {
  const o = { price, depositPct: 10, region: 'eng', buyer: 'ftb', legal: 1500, survey: 500, fees: 999, other: 0, rate, term }, h = Calc.homeBuy(o);
  const loan = price * 0.9, r = rate / 1200, m = term * 12, pay = r ? loan * r / (1 - Math.pow(1 + r, -m)) : loan / m;
  eq('home pay', h.monthly, pay, 1e-6); eq('home interest', h.interest, pay * m - loan, 1e-4); eq('home own', h.own, price * 0.1 + want('eng', 'ftb', price) + 2999, 1e-6); eq('home total', h.total, price + want('eng', 'ftb', price) + 2999, 1e-6);
}
console.log(checks + ' independent checks, ' + bad + ' disagree'); if (bad) process.exitCode = 1;
fails.forEach(f => console.log('  ' + f));

})();
(function(){
const Calc = require('./calc.js');
let bad = 0, checks = 0; const fails = [];
const near = (a, b, tol = 0.01) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tol;
function eq(name, got, want, tol) { checks++; const ok = typeof want === 'number' ? near(got, want, tol) : got === want; if (!ok) { bad++; if (fails.length < 30) fails.push(name + ' :: got ' + got + ' want ' + want); } }
let seed = 99; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (lo, hi, step) => lo + Math.round(rnd() * (hi - lo) / step) * step;
Calc.setTax({ region: 'eng', buyer: 'add' });
for (let t = 0; t < 300; t++) {
  const d = { endValue: pick(120e3, 500e3, 5000), purchasePrice: pick(60e3, 300e3, 2500), refurb: pick(0, 90e3, 2500), legal: pick(500, 5e3, 250), ltv: pick(60, 80, 5), mortgageRate: pick(3, 7, 0.25), monthlyRent: pick(600, 2200, 25), furnishing: pick(0, 10e3, 500) };
  for (const mode of ['cash', 'mortgage', 'bridge']) for (const k of ['btl', 'hmo', 'sa']) {
    // untyped net loan (follows the price) must still land the prices exactly
    const L = Calc.ledger(d, mode), X = L.exits[k], v = X.v;
    if (v.paybackPrice != null && v.monthly > 0) {
      const at = Calc.ledger(Object.assign({}, d, { purchasePrice: v.paybackPrice }), mode).exits[k].v, up = Calc.ledger(Object.assign({}, d, { purchasePrice: v.paybackPrice + 1 }), mode).exits[k].v;
      // at the payback price the cash left in is paid back from the rent in exactly 24 months or less; £1 more is over 24 months (or the price solver hit £0)
      if (v.paybackPrice > 0) eq('payback at ' + k + mode + t, at.cashLeft <= at.monthly * 24 + 0.01 && up.cashLeft > up.monthly * 24 - 0.01, true);
    }
    if (X.recyclePrice != null) {
      const at = Calc.ledger(Object.assign({}, d, { purchasePrice: X.recyclePrice }), mode).exits[k].v.cashLeft, up = Calc.ledger(Object.assign({}, d, { purchasePrice: X.recyclePrice + 1 }), mode).exits[k].v.cashLeft;
      eq('recycle(follow) ' + k + mode + t, at <= 0.01 && up > -0.01, true);
    }
  }
  // the Max price tool vs the ledger (no bridge): recycle for the BTL exit
  const R = Calc.find('recycle').compute(Calc.stateFor(Calc.find('recycle'), { endValue: d.endValue, refurb: d.refurb, legal: d.legal, ltv: d.ltv })).v;
  if (!R.impossible) { const at = Calc.ledger({ endValue: d.endValue, refurb: d.refurb, legal: d.legal, ltv: d.ltv, purchasePrice: R.maxPrice, depositPct: 100 - d.ltv }, 'cash').exits.btl.v.cashLeft; eq('max price tool ' + t, at <= 0.01, true); }
  // R2R
  const r = { upfront: pick(500, 5e3, 100), refurb: pick(0, 9e3, 500), furnishing: pick(0, 4e3, 250), otherUpfront: 0, roomRate: pick(450, 800, 5), rooms: pick(3, 7, 1), rentPaid: pick(900, 2200, 25), mgmtPct: 0, maintOnRentPct: 10, council: 150, utilities: 280 };
  const rv = Calc.find('r2rhmo').compute(Calc.stateFor(Calc.find('r2rhmo'), r)).v, inc = r.roomRate * r.rooms, tin = r.upfront + r.refurb + r.furnishing;
  const mo = inc - (r.rentPaid + r.rentPaid * .1 + 150 + 280);
  eq('r2r monthly ' + t, rv.monthly, mo); eq('r2r roi ' + t, rv.roi, mo * 12 / tin, 1e-9);
}
// the single-let rate / months rounding: bridge months & rate
const B = Calc.bridgeOf({ bridgeNet: 100000, bridgeRatePct: 0.87, bridgeMonths: 12, bridgeArrangePct: 2, bridgeExitPct: 1, bridgeLegal: 1000, bridgeValuation: 400, bridgeBroker: 600 });
const i12 = 100000 * (Math.pow(1.0087, 12) - 1);   // compounding monthly
eq('bridge 0.87% x12 on £100k compounding', B.interest, i12, 1e-6); eq('bridge ~£10,954 (more than simple £10,440)', Math.round(B.interest), 10954); eq('bridge gross', B.gross, 100000 + i12, 1e-6); eq('bridge repay (+1% exit)', B.repay, 100000 + i12 + 1000, 1e-6); eq('bridge cost = interest + 2% arrangement + fees + exit', B.cost, i12 + 2000 + 2000 + 1000, 1e-6);
console.log(checks + ' more checks, ' + bad + ' disagree'); if (bad) process.exitCode = 1; fails.forEach(f => console.log('  ' + f));

})();

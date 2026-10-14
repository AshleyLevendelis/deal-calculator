// Bridging loan quotes (14 Oct 2026, Ashley's spec): the true cost of each quote, the own cash it needs, the money left
// at the end, a side-by-side comparison and a maximum bid. Pure functions only (no page, no storage): app.js draws the
// screen, test-bridge.js tests every structure, fee method, interest treatment, stamp duty edge and the max-bid solver.
// Every amount, rate and fee comes from what the person types. The only built-in figures are the stamp duty bands, and
// those are an editable starting point (Bridge.defaultTax), copied from the app's published England & NI rates.
(function (root) {
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function blank(v) { return v === '' || v == null || (typeof v === 'number' && !isFinite(v)); }

  // ---- stamp duty: marginal bands (each rate only on the slice of the price inside its band) ----
  // cfg: { bands: [[up to (£, blank = no limit), rate %]], surchargePct, surchargeFrom }.
  function defaultTax(Calc) {
    var R = Calc && Calc.TAX_RATES ? Calc.TAX_RATES.eng : null;
    var bands = R ? R.main.map(function (b) { return [isFinite(b[0]) ? b[0] : '', Math.round(b[1] * 10000) / 100]; }) : [];
    return { bands: bands, surchargePct: R ? R.surcharge * 100 : '', surchargeFrom: 40000 };
  }
  function stampDuty(price, cfg, additional) {
    price = num(price); if (!(price > 0)) return 0;
    var tax = 0, lower = 0, bands = (cfg && cfg.bands) || [];
    for (var i = 0; i < bands.length; i++) {
      var upper = blank(bands[i][0]) ? Infinity : num(bands[i][0]), rate = num(bands[i][1]) / 100;
      if (upper <= lower) continue;                                      // a band out of order is skipped, never negative
      if (price > lower) tax += (Math.min(price, upper) - lower) * rate;
      lower = upper; if (!isFinite(lower)) break;
    }
    if (additional && price >= num(cfg && cfg.surchargeFrom)) tax += price * num(cfg && cfg.surchargePct) / 100;
    return tax;
  }

  // ---- the fee presets (names only: amounts are always typed) ----
  var FEE_PRESETS = ['Arrangement / facility fee', 'Valuation fee', 'Lender legal fees', 'Broker fee', 'Assessment / admin fee', 'Documentation fee',
    'Telegraphic transfer (CHAPS) fee', 'Title insurance', 'Monitoring surveyor fee', 'Exit fee'];
  var PAY = { cash: 'Paid from your own cash up front', added: 'Added to the loan (increases the gross)', deducted: 'Deducted from the advance (reduces the net)', exit: 'Paid at the end, from the sale or refinance' };
  function feeAmount(f, base) { return f.unit === '%' ? num(f.amount) / 100 * num(base[f.basis || 'gross']) : num(f.amount); }

  // ---- one quote ----
  // p (the project): { price, refurb, contMode '£'|'%', cont, cash, auction, legal, additional, sdltOverride, sdltManual,
  //   endValue, exit 'sale'|'refinance', selling, term }.
  // q (a quote): { name, structure 'A'|'B'|'C', mode 'quoted'|'derive', net, gross, inclRolled, ltv, facility, rate (% a
  //   month), interest 'retained'|'rolled'|'serviced', term, security, drawMode 'stages'|'upfront', stages, upfrontPct,
  //   refurbMonths, fees: [{ name, amount, unit '£'|'%', basis 'gross'|'net'|'facility', pay 'cash'|'added'|'deducted'|'exit', estimate }] }.
  // o: { price (a different purchase price, for the max bid), keepLoan (true: the loan stays as quoted; false: it scales
  //   with the price as an LTV %) }.
  // Interest is simple monthly interest (rate x months) on what is owed, the refurb money only from when it is drawn.
  function quote(p, q, cfg, o) {
    p = p || {}; q = q || {}; o = o || {};
    var P0 = num(p.price), P = o.price != null ? num(o.price) : P0, scale = o.price != null && !o.keepLoan && P0 > 0 ? P / P0 : 1;
    var T = blank(q.term) ? num(p.term) : num(q.term), r = num(q.rate) / 100, S = q.structure === 'B' || q.structure === 'C' ? q.structure : 'A';
    var refurb = num(p.refurb), cont = p.contMode === '%' ? refurb * num(p.cont) / 100 : num(p.cont);
    var F = S === 'A' ? 0 : num(q.facility), drawn = Math.min(F, refurb), unused = F - drawn;
    // the refurb money: C all on day one; B in stages, in arrears, spread evenly over the works
    var stages = Math.max(1, Math.round(num(q.stages)) || 1), months = num(q.refurbMonths), tranches = [];
    if (S === 'C' && drawn > 0) tranches.push({ amount: drawn, at: 0 });
    if (S === 'B' && drawn > 0) for (var k = 1; k <= stages; k++) tranches.push({ amount: drawn / stages, at: Math.min(T, months * k / stages) });
    var trancheInt = tranches.reduce(function (t, x) { return t + x.amount * r * Math.max(0, T - x.at); }, 0);
    var fees = q.fees || [], derive = q.mode === 'derive';
    var N1, G, Gd, retained = 0, sum = { cash: 0, added: 0, deducted: 0, exit: 0 }, lines = [];
    var feeLines = function (base) {
      sum = { cash: 0, added: 0, deducted: 0, exit: 0 }; lines = [];
      fees.forEach(function (f) { var a = Math.max(0, feeAmount(f, base)); sum[PAY[f.pay] ? f.pay : 'cash'] += a; lines.push({ name: f.name || 'Fee', amount: a, pay: PAY[f.pay] ? f.pay : 'cash', blank: blank(f.amount), estimate: !!f.estimate }); });
    };
    if (derive) {
      // Worked out from the LTV: the day-one loan is LTV % of the price; added fees go on top (the gross), deducted fees
      // and retained interest come off what is released (the net). Fees set as a % of the gross or net depend on those,
      // so the figures are settled by repeating until they stop changing.
      var LP = num(q.ltv) / 100 * (o.keepLoan ? P0 : P);
      feeLines({ gross: LP + F, net: LP + drawn, facility: LP + F });
      for (var i = 0; i < 80; i++) {
        Gd = LP + sum.added; G = Gd + F;
        retained = q.interest === 'retained' ? Gd * r * T + trancheInt : 0;
        N1 = LP - sum.deducted - retained;
        feeLines({ gross: G, net: N1 + drawn, facility: LP + F });
      }
      Gd = LP + sum.added; G = Gd + F; retained = q.interest === 'retained' ? Gd * r * T + trancheInt : 0; N1 = LP - sum.deducted - retained;
    } else {
      // The lender's own figures are the truth: their gap already holds the added and deducted fees and any retained
      // interest, so those are shown but never counted again.
      N1 = num(q.net) * scale; Gd = (num(q.gross) - F) * scale; G = Gd + F;
      feeLines({ gross: G, net: N1 + drawn, facility: G });
    }
    var accrued = Gd * r * T + trancheInt;
    var rolled = q.interest === 'rolled' && !(!derive && q.inclRolled) ? accrued : 0;
    var serviced = q.interest === 'serviced' ? accrued : 0;
    var received = N1 + drawn, repay = G - unused + rolled, gap = repay - received;
    var totalCost = gap + sum.cash + serviced + sum.exit;
    var sdlt = p.sdltOverride && !blank(p.sdltManual) ? num(p.sdltManual) : stampDuty(P, cfg, !!p.additional);
    var deposit = P - N1, userRefurb = S === 'A' ? refurb : Math.max(0, refurb - F);
    var required = deposit + num(p.auction) + sdlt + num(p.legal) + sum.cash + userRefurb + serviced + cont;
    var prefund = S !== 'B' || !drawn ? 0 : q.drawMode === 'upfront' ? Math.min(drawn, refurb * num(q.upfrontPct) / 100) : drawn / stages;
    var cash = num(p.cash), headroom = cash - required, E = num(p.endValue), sell = p.exit === 'sale' ? num(p.selling) : 0;
    var cashBack = E - sell - repay - sum.exit, moneyLeft = cashBack + headroom, profit = moneyLeft - cash;
    var costs = P + sdlt + num(p.auction) + num(p.legal) + refurb + cont + sell;
    // checks: what must be confirmed or is not possible
    var warn = [], risk = [];
    if (!derive && num(q.net) > num(q.gross)) warn.push('The net advance is more than the gross loan: check the quote.');
    if (derive && num(q.ltv) > 100) warn.push('An LTV over 100% is not a normal bridge: check the figure.');
    if (!(T > 0)) warn.push('Enter the loan term in months.');
    if (num(q.rate) < 0 || num(q.rate) > 3) warn.push('A monthly rate of ' + num(q.rate) + '% is outside the usual range (0% to 3% a month).');
    [['price', p.price], ['refurb', p.refurb], ['cash', p.cash], ['end value', p.endValue]].concat([['net', q.net], ['gross', q.gross], ['refurb facility', q.facility], ['rate', q.rate]])
      .forEach(function (x) { if (num(x[1]) < 0) warn.push('The ' + x[0] + ' cannot be negative.'); });
    lines.forEach(function (l) { if (l.blank) warn.push(l.name + ' has no amount: confirm it with your broker.'); else if (l.estimate) warn.push(l.name + ' is an estimate: confirm it with your broker.'); });
    if (unused > 0) risk.push(money(unused) + ' of the refurb facility is not needed for the works, so it is not drawn and not counted.');
    if (securityRisk(q.security)) risk.push('Security includes more than the purchase property: ' + q.security + '. That property is at risk if the loan is not repaid.');
    return { structure: S, term: T, refurb: refurb, cont: cont, price: P, sdlt: sdlt,
      net: N1, gross: G, grossDayOne: Gd, facility: F, drawn: drawn, unused: unused, tranches: tranches, retained: retained,
      fees: lines, feeCash: sum.cash, feeAdded: sum.added, feeDeducted: sum.deducted, feeExit: sum.exit,
      received: received, gap: gap, rolled: rolled, serviced: serviced, repay: repay,
      totalCost: totalCost, costPct: received > 0 ? totalCost / received : null, perMonth: T > 0 ? totalCost / T : null,
      deposit: deposit, userRefurb: userRefurb, auction: num(p.auction), legal: num(p.legal),
      required: required, headroom: headroom, peak: required + prefund, prefund: prefund,
      endValue: E, selling: sell, cashBack: cashBack, moneyLeft: moneyLeft, profit: profit,
      costs: costs, profitCheck: E - costs - totalCost, warnings: warn, risks: risk };
  }
  // "purchase property + main residence", "and my home", "second charge"...: more than the purchase property at risk
  function securityRisk(s) { return /\+|&|\band\b|\bplus\b|residen|\bhome\b|second|additional|another|other propert|portfolio/i.test(String(s || '')); }
  function money(v) { v = num(v); return (v < 0 ? '−' : '') + '£' + Math.round(Math.abs(v)).toLocaleString('en-GB'); }

  // ---- comparing quotes: the winner for each question, and who runs short ----
  function compare(p, quotes, cfg, threshold) {
    var rows = (quotes || []).map(function (q, i) { return { i: i, name: (q && q.name) || 'Quote ' + (i + 1), q: q, r: quote(p, q, cfg) }; });
    var best = function (key, low) { var ok = rows.filter(function (x) { return isFinite(x.r[key]); }); if (!ok.length) return null; return ok.reduce(function (a, b) { return (low ? b.r[key] < a.r[key] : b.r[key] > a.r[key]) ? b : a; }); };
    var t = num(threshold), alerts = [];
    rows.forEach(function (x) {
      if (x.r.headroom < 0) alerts.push({ i: x.i, level: 'bad', text: x.name + ' leaves you ' + money(-x.r.headroom) + ' short.' });
      else if (x.r.headroom < t) alerts.push({ i: x.i, level: 'warn', text: x.name + ' leaves only ' + money(x.r.headroom) + ' spare (under your ' + money(t) + ').' });
      if (x.q && x.q.structure === 'B' && cashOf(p) - x.r.peak < 0) alerts.push({ i: x.i, level: 'bad', text: x.name + ' needs ' + money(x.r.peak) + ' at the peak of the works: ' + money(x.r.peak - cashOf(p)) + ' more than you have.' });
    });
    return { rows: rows, cheapest: best('totalCost', true), leastCash: best('required', true), mostLeft: best('moneyLeft', false), alerts: alerts };
  }
  function cashOf(p) { return num(p && p.cash); }

  // ---- maximum bid: the highest price that still meets the target profit ----
  // target: { kind 'gbp' (a fixed £), 'gdv' (% of the end value), 'cost' (% of the total cost), value }.
  // Stamp duty is tiered, so the price is found by halving the gap (profit only falls as the price rises), then rounded
  // down to the step (e.g. £250 or £500) and checked.
  function meets(r, target) {
    var v = num(target.value);
    if (target.kind === 'gdv') return r.profit >= v / 100 * r.endValue;
    if (target.kind === 'cost') return r.profit >= v / 100 * (r.costs + r.totalCost);
    return r.profit >= v;
  }
  function maxBid(p, q, cfg, target, o) {
    o = o || {}; var step = num(o.step) > 0 ? num(o.step) : 1;
    var at = function (price) { return quote(p, q, cfg, { price: price, keepLoan: !!o.keepLoan }); };
    var hi = Math.max(num(p.endValue), num(p.price)) * 2 + 1, lo = 0;
    if (!meets(at(0), target)) return null;
    if (meets(at(hi), target)) return { price: Math.floor(hi / step) * step, result: at(Math.floor(hi / step) * step), capped: true };
    for (var i = 0; i < 70; i++) { var mid = (lo + hi) / 2; if (meets(at(mid), target)) lo = mid; else hi = mid; }
    var price = Math.floor(lo / step) * step;
    while (price > 0 && !meets(at(price), target)) price -= step;
    var r = at(price), need = target.kind === 'gdv' ? num(target.value) / 100 * r.endValue : target.kind === 'cost' ? num(target.value) / 100 * (r.costs + r.totalCost) : num(target.value);
    return { price: price, result: r, targetProfit: need };
  }

  var api = { stampDuty: stampDuty, defaultTax: defaultTax, FEE_PRESETS: FEE_PRESETS, PAY: PAY, quote: quote, compare: compare, maxBid: maxBid, meets: meets, securityRisk: securityRisk, money: money };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Bridge = api;
})(this);

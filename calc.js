// Deal maths for every calculator, ported from the spreadsheets in "Calculators".
// Pure functions and plain data: no DOM, so the same file runs in the app and in test.js.
// Each calculator is a spec: a layout (what the screen shows) and compute(state) -> { v: values by id }.
(function (root) {
  // ---- Property tax on the purchase: where the property is and who is buying (5 Oct 2026) ----------------------
  // England & NI: Stamp Duty Land Tax. Scotland: Land and Buildings Transaction Tax plus the Additional Dwelling
  // Supplement. Wales: Land Transaction Tax. Rates as at October 2026 (checked against the published 2026-27 rates:
  // SDLT unchanged since 1 April 2025, the 5% surcharge since 31 October 2024; LBTT and the 8% ADS kept for 2026-27;
  // LTT main rates since 10 October 2022 and higher rates since 11 December 2024, kept for 2026-27). Each band is
  // [upper limit, rate] and is charged only on the slice of the price inside it.
  var TAX_RATES = {
    eng: { name: 'England & NI', tax: 'SDLT', main: [[125000, 0], [250000, 0.02], [925000, 0.05], [1500000, 0.10], [Infinity, 0.12]],
      ftb: [[300000, 0], [500000, 0.05]], ftbCap: 500000, surcharge: 0.05 },
    sco: { name: 'Scotland', tax: 'LBTT', main: [[145000, 0], [250000, 0.02], [325000, 0.05], [750000, 0.10], [Infinity, 0.12]],
      ftb: [[175000, 0], [250000, 0.02], [325000, 0.05], [750000, 0.10], [Infinity, 0.12]], surcharge: 0.08 },
    wal: { name: 'Wales', tax: 'LTT', main: [[225000, 0], [400000, 0.06], [750000, 0.075], [1500000, 0.10], [Infinity, 0.12]],
      higher: [[180000, 0.05], [250000, 0.085], [400000, 0.10], [750000, 0.125], [1500000, 0.15], [Infinity, 0.17]], ftb: null }
  };
  // The extra charge for an additional home (surcharge, ADS or higher rates) never applies to a price under 40,000.
  var HIGHER_RATES_FROM = 40000;
  var BUYERS = { add: 'Additional property', main: 'Main home', ftb: 'First-time buyer' };
  function bandsTax(price, bands) {
    var tax = 0, lower = 0;
    for (var i = 0; i < bands.length; i++) { var upper = bands[i][0]; if (price > lower) tax += (Math.min(price, upper) - lower) * bands[i][1]; lower = upper; }
    return tax;
  }
  // Wales has no first-time buyer relief, so a first-time buyer there pays the main rates.
  function taxBasis(region, buyer) {
    var r = TAX_RATES.hasOwnProperty(region) ? region : 'eng', b = BUYERS.hasOwnProperty(buyer) ? buyer : 'add';
    if (b === 'ftb' && !TAX_RATES[r].ftb) b = 'main';
    return { region: r, buyer: b };
  }
  function propertyTax(price, region, buyer) {
    price = Number(price); if (!(price > 0) || !isFinite(price)) return 0;
    var k = taxBasis(region, buyer), R = TAX_RATES[k.region], higher = k.buyer === 'add' && price >= HIGHER_RATES_FROM;
    if (k.region === 'wal') return bandsTax(price, higher ? R.higher : R.main);
    if (k.buyer === 'ftb') return k.region === 'eng' && price > R.ftbCap ? bandsTax(price, R.main) : bandsTax(price, R.ftb);
    return bandsTax(price, R.main) + (higher ? price * R.surcharge : 0);
  }
  // The setting every calculator uses (one per phone; the app sets it from what was chosen). Default: England & NI,
  // additional property, as the app always assumed.
  var TAX = { region: 'eng', buyer: 'add' };
  function setTax(t) { TAX = taxBasis(t && t.region, t && t.buyer); return { region: TAX.region, buyer: TAX.buyer }; }
  function taxSetting() { return { region: TAX.region, buyer: TAX.buyer }; }
  // e.g. { tax: 'LBTT', place: 'Scotland', buyer: 'Main home', short: 'Scotland, main home' }
  function taxLabel(t) {
    var k = taxBasis(t ? t.region : TAX.region, t ? t.buyer : TAX.buyer), R = TAX_RATES[k.region];
    return { tax: R.tax, place: R.name, buyer: BUYERS[k.buyer], short: R.name + ', ' + BUYERS[k.buyer].toLowerCase() };
  }
  // Every caller in this file works out stamp duty through this, so the setting reaches every calculator.
  function stampDuty(price) { return propertyTax(price, TAX.region, TAX.buyer); }

  function n(v) { v = Number(v); return isFinite(v) ? v : 0; }
  var NO_CASH = '∞ (no cash left in)';

  // ---- shared pieces --------------------------------------------------------------------------
  function purchase(s) {
    var price = n(s.purchasePrice), dp = n(s.depositPct) / 100;
    // Stamp duty is always worked out from the price, as in the spreadsheets: it is not a figure the person types.
    return { deposit: price * dp, mortgage: price * (1 - dp), sdlt: stampDuty(price) };
  }
  function roomsIncome(s) { return n(s.rooms) * n(s.roomRate); }                        // rooms x monthly rate
  function saIncome(s) { return n(s.nightlyRate) * n(s.rooms) * 365 * n(s.occupancyPct) / 100 / 12; }
  function ratio(annual, base) { return base > 0 ? annual / base : '—'; }
  function breakeven(cash, monthly) { return monthly > 0 ? cash / monthly : 'Not at this profit'; }
  // A refinance deal is still fine if the cash left in comes back out of the rent within this many months.
  var PAYBACK_MONTHS = 24;
  // Legal, refurb and any other up-front costs (survey, valuation, broker): the fixed costs besides the price and its tax.
  function legalRefurb(s) { return n(s.legal) + n(s.refurb) + n(s.otherUpfront); }
  function paybackOk(cashLeft, monthly) { return cashLeft > 0 && monthly > 0 && cashLeft / monthly <= PAYBACK_MONTHS; }
  // The highest purchase price at which the rent still returns the cash left in within PAYBACK_MONTHS.
  // Monthly profit does not depend on the price (the new mortgage is a share of the end value), so this is the
  // recycle sum with the refinance loan topped up by that many months of profit. null when there is no profit.
  function paybackPrice(s, loan, monthly, fixed) {
    if (!(monthly > 0)) return null;
    var budget = loan + monthly * PAYBACK_MONTHS - fixed, price = 0;
    if (budget <= 0) return 0;
    var lo = 0, hi = budget; for (var i = 0; i < 80; i++) { var mid = (lo + hi) / 2; if (mid + stampDuty(mid) <= budget) lo = mid; else hi = mid; } price = lo;
    return Math.floor(price);
  }
  function interestOnly(mortgage, ratePct) { return mortgage * n(ratePct) / 100 / 12; }

  // ---- layout helpers ---------------------------------------------------------------------------
  function F(id, label, unit, def, note) { return { field: { id: id, label: label, unit: unit, def: def, note: note } }; }
  function C(id, label, fmt, o) { var c = { id: id, label: label, fmt: fmt }; for (var k in (o || {})) c[k] = o[k]; return { calc: c }; }
  // A choice field (pills), for something that isn't a number or a percentage — e.g. how the interest is charged.
  function Ch(id, label, options, def, note) { return { choice: { id: id, label: label, options: options, def: def, note: note } }; }
  function purchaseItems(defPrice) {
    return [F('purchasePrice', 'Purchase price', '£', defPrice),
      F('depositPct', 'Deposit', '%', 25),
      C('deposit', 'Deposit', 'gbp'), C('mortgage', 'Mortgage', 'gbp'),
      C('sdlt', 'Stamp duty', 'gbp', { note: 'Worked out for an additional property (England/NI)' })];
  }
  function cashflowResults(o) {
    o = o || {};
    var items = [];
    if (!o.noIncomeRow) items.push(C('income', 'Monthly income', 'gbp2'));
    items.push(C('expenses', 'Total expenses / month', 'gbp2'), C('monthly', 'Monthly profit', 'gbp2', { tone: true }),
      C('annual', 'Annual profit', 'gbp', { tone: true }), C('roi', o.roiLabel || 'Return on investment', 'pct', o.roiVerdict ? { bold: true, verdict: o.roiVerdict } : { bold: true }));
    if (!o.noBreakeven) items.push(C('breakeven', 'Months to breakeven', 'months'));
    if (o.paybackPrice) items.push(C('paybackPrice', 'Most you can pay and get it back in 2 years', 'gbp'));
    return { title: o.title || 'Results', items: items };
  }
  function finish(v, income, expenses, base) {
    v.income = income; v.expenses = expenses; v.monthly = income - expenses; v.annual = v.monthly * 12;
    v.breakeven = breakeven(base, v.monthly);
    return { v: v };
  }
  var SUMMARY = [['Money in', 'totalIn', 'gbp'], ['Monthly profit', 'monthly', 'gbp2'], ['ROI', 'roi', 'pct']];

  var CALCS = [];

  // ---- 1. Flip / BRR to BTL  ("FLIP ROI Calculator") -------------------------------------------
  function analyse(i) {
    var gdv = n(i.endValue);
    var p = purchase(i);
    var legal = n(i.legal), refurb = n(i.refurb), other = n(i.otherUpfront);
    // Sheet: Total Money In = deposit + mortgage + SDLT + legal + refurb (i.e. total cost of the deal), plus any other
    // up-front costs (not in the sheet; added 6 Oct 2026, 0 unless typed).
    var totalIn = p.deposit + p.mortgage + p.sdlt + legal + refurb + other;
    var profit = gdv - totalIn;                                           // sheet: profit = end value - total money in
    var flip = { totalIn: totalIn, profit: profit,
      margin: gdv ? profit / gdv : null,                                   // sheet "Flip Net Profit" = profit / GDV
      roi: totalIn ? profit / totalIn : null };
    var newMortgage = gdv * n(i.ltv) / 100, cashLeft = totalIn - newMortgage, rent = n(i.monthlyRent);
    var interest = interestOnly(newMortgage, i.mortgageRate);
    var mgmt = rent * n(i.mgmtPct) / 100, voids = rent * n(i.voidsPct) / 100;
    var expenses = interest + mgmt + voids, monthly = rent - expenses, annual = monthly * 12;
    var btl = { newMortgage: newMortgage, cashLeft: cashLeft, interest: interest, mgmt: mgmt, voids: voids, expenses: expenses,
      monthly: monthly, annual: annual, roi: cashLeft > 0 ? annual / cashLeft : null, moneyOut: cashLeft <= 0 };
    return { deposit: p.deposit, mortgage: p.mortgage, sdlt: p.sdlt, flip: flip, btl: btl };
  }
  CALCS.push({
    id: 'flip', name: 'Flip / BRR to BTL', group: 'Buy, refurb & refinance', blurb: 'Profit if you sell, or cash left in if you refinance and rent',
    layout: [
      { title: 'Money invested', items: purchaseItems(125000).concat([F('legal', 'Legal costs', '£', 3000), F('refurb', 'Refurb costs', '£', 45000), F('otherUpfront', 'Any other costs', '£', 0, 'Survey, valuation, broker: anything else up front'), C('totalIn', 'Total money in', 'gbp', { bold: true }),
        C('ownMoney', 'Your own money', 'gbp', { bold: true, note: 'Total money in minus the mortgage — the bank’s share is not your cash' })]) },
      { title: 'Sale', items: [F('endValue', 'End value (GDV)', '£', 230000)] },
      { title: 'If you flip', items: [C('totalIn2', 'Total money in', 'gbp'),
        C('profit', 'Profit', 'gbp', { tone: true }), C('margin', 'Net profit (of GDV)', 'pct', { verdict: 'flip' }), C('flipRoi', 'Return on money in', 'pct')] },
      { title: 'Refinance', items: [F('ltv', 'Re-mortgage LTV', '%', 75), C('newMortgage', 'New mortgage', 'gbp'),
        C('cashLeft', 'Cash remaining in deal', 'gbp', { bold: true }),
        { banner: { id: 'moneyOut', text: 'You would take out more than you put in. A negative cash left is a good thing.' } },
        { banner: { id: 'paybackOk', text: 'The cash left in comes back from the rent within 2 years, so this still works as a BRR.' } }] },
      { title: 'If you keep and rent', items: [F('monthlyRent', 'Monthly income', '£', 1000), F('mortgageRate', 'Mortgage rate', '%', 5, 'Interest-only'),
        F('mgmtPct', 'Management', '%', 10, '% of rent'), F('voidsPct', 'Maintenance / voids', '%', 10, '% of rent'),
        C('interest', 'Mortgage interest / month', 'gbp2'), C('expenses', 'Total expenses / month', 'gbp2'),
        C('monthly', 'Monthly profit', 'gbp2', { tone: true }), C('annual', 'Annual profit', 'gbp', { tone: true }),
        C('roi', 'ROI for BTL', 'pct', { bold: true, verdict: 'cashRoi' }), C('breakeven', 'Months to get your money back', 'months'), C('paybackPrice', 'Most you can pay and get it back in 2 years', 'gbp')] }],
    summary: [['Money in', 'totalIn', 'gbp'], ['Flip profit', 'profit', 'gbp'], ['BTL ROI', 'roi', 'pct']],
    compute: function (s) {
      var r = analyse(s), f = r.flip, b = r.btl;
      // Your own money: the sheet's totalIn is the WHOLE purchase price (deposit + mortgage), because that is what
      // it takes to complete before any refinance. What is actually yours — the bank's share is not your cash —
      // is that total minus the mortgage.
      return { v: { deposit: r.deposit, mortgage: r.mortgage, sdlt: r.sdlt, totalIn: f.totalIn, ownMoney: f.totalIn - r.mortgage, totalIn2: f.totalIn, profit: f.profit,
        margin: f.margin, flipRoi: f.roi, newMortgage: b.newMortgage, cashLeft: b.cashLeft, moneyOut: b.moneyOut, interest: b.interest,
        expenses: b.expenses, monthly: b.monthly, annual: b.annual, roi: b.moneyOut ? NO_CASH : b.roi,
        breakeven: b.cashLeft > 0 ? breakeven(b.cashLeft, b.monthly) : 0, paybackOk: paybackOk(b.cashLeft, b.monthly),
        paybackPrice: paybackPrice(s, b.newMortgage, b.monthly, legalRefurb(s)) } };
    }
  });

  // ---- 2. BTL  ("BTL ROI Calculator") -------------------------------------------------------------
  CALCS.push({
    id: 'btl', name: 'BTL', group: 'Buy to let', blurb: 'A standard mortgaged rental',
    layout: [
      { title: 'Money invested', items: purchaseItems(555000).concat([F('legal', 'Legal fees', '£', 3000), F('refurb', 'Refurbishment', '£', 2000), F('otherUpfront', 'Any other costs', '£', 0, 'Survey, valuation, broker: anything else up front'), C('totalIn', 'Total cash required', 'gbp', { bold: true })]) },
      { title: 'Income', items: [F('monthlyRent', 'Monthly rent', '£', 1000), C('annualRent', 'Annual rent', 'gbp')] },
      { title: 'Expenses', items: [F('mortgageRate', 'Mortgage rate', '%', 5, 'Interest-only'), F('mgmtPct', 'Management', '%', 10, '% of rent'),
        F('voidsPct', 'Maintenance / voids', '%', 10, '% of rent'), F('insurance', 'Insurance', '£', 35, 'per month'), F('other', 'Any other costs', '£', 0, 'per month'),
        C('interest', 'Mortgage payment / month', 'gbp2')] },
      cashflowResults({ noIncomeRow: true })],
    summary: SUMMARY,
    compute: function (s) {
      var p = purchase(s), rent = n(s.monthlyRent), totalIn = p.deposit + p.sdlt + n(s.legal) + n(s.refurb) + n(s.otherUpfront);
      var interest = interestOnly(p.mortgage, s.mortgageRate);
      var exp = interest + rent * n(s.mgmtPct) / 100 + rent * n(s.voidsPct) / 100 + n(s.insurance) + n(s.other);
      var out = finish({ deposit: p.deposit, mortgage: p.mortgage, sdlt: p.sdlt, totalIn: totalIn, ownMoney: totalIn, annualRent: rent * 12, interest: interest }, rent, exp, totalIn);
      out.v.roi = ratio(out.v.annual, totalIn); return out;
    }
  });

  // ---- 3. HMO BTL  ("HMO BTL ROI Calculator") -----------------------------------------------------
  CALCS.push({
    id: 'hmo', name: 'HMO BTL', group: 'Buy to let', blurb: 'A mortgaged HMO let by the room',
    layout: [
      { title: 'Money invested', items: purchaseItems(90000).concat([F('legal', 'Legal fees', '£', 2000), F('refurb', 'Refurbishment costs', '£', 0),
        F('otherUpfront', 'Any other costs', '£', 0), C('totalIn', 'Total money in', 'gbp', { bold: true })]) },
      { title: 'Income', items: [F('roomRate', 'Room rate', '£', 405, 'per room, per month'), F('rooms', 'Number of rooms', '', 4), C('income', 'Total per month', 'gbp'), C('annualIncome', 'Total per annum', 'gbp')] },
      { title: 'Expenses', items: [F('mortgageRate', 'Mortgage rate', '%', 5, 'Interest-only'), F('mgmtPct', 'Management', '%', 10, '% of income'),
        F('maintPct', 'Maintenance', '%', 10, '% of income'), F('council', 'Council tax', '£', 136, 'per month'), F('utilities', 'Utility bills', '£', 255, 'per month'),
        F('other', 'Any other costs', '£', 0, 'per month')] },
      cashflowResults({ noIncomeRow: true })],
    summary: SUMMARY,
    compute: function (s) {
      var p = purchase(s), inc = roomsIncome(s), totalIn = p.deposit + p.sdlt + n(s.legal) + n(s.refurb) + n(s.otherUpfront);
      var exp = interestOnly(p.mortgage, s.mortgageRate) + inc * n(s.mgmtPct) / 100 + inc * n(s.maintPct) / 100 + n(s.council) + n(s.utilities) + n(s.other);
      var out = finish({ deposit: p.deposit, mortgage: p.mortgage, sdlt: p.sdlt, totalIn: totalIn, ownMoney: totalIn, annualIncome: inc * 12 }, inc, exp, totalIn);
      out.v.roi = ratio(out.v.annual, totalIn); return out;
    }
  });

  // ---- 4. SA BTL  ("SA BTL ROI Calculator", sheet "BTL to SA") --------------------------------------
  CALCS.push({
    id: 'sabtl', name: 'SA BTL', group: 'Buy to let', blurb: 'A mortgaged serviced accommodation (nightly lets)',
    layout: [
      { title: 'Money invested', items: purchaseItems(315000).concat([F('legal', 'Legal fees', '£', 3000), F('refurb', 'Refurbishment costs', '£', 2000),
        F('furnishing', 'Staging and furnishing', '£', 3000), F('otherUpfront', 'Any other costs', '£', 0, 'Survey, valuation, broker: anything else up front'), C('totalIn', 'Total money in', 'gbp', { bold: true })]) },
      { title: 'Income', items: [F('nightlyRate', 'Room rate', '£', 250, 'per night'), F('rooms', 'Number of rooms', '', 1), F('occupancyPct', 'Occupancy rate', '%', 71),
        C('income', 'Total per month', 'gbp2'), C('annualIncome', 'Total per annum', 'gbp')] },
      { title: 'Expenses', items: [F('mortgageRate', 'Mortgage payments', '%', 6, 'Interest-only'), F('commPct', 'Commissions', '%', 15, '% of income'),
        F('maintOnMortgagePct', 'Maintenance', '%', 10, '% of the mortgage payment, as in your sheet'), F('council', 'Council tax', '£', 166, 'per month'),
        F('utilities', 'Utility bills', '£', 280, 'per month'), F('channel', 'Channel manager', '£', 35, 'per month'), C('interest', 'Mortgage payment / month', 'gbp2')] },
      cashflowResults({ noIncomeRow: true })],
    summary: SUMMARY,
    compute: function (s) {
      var p = purchase(s), inc = saIncome(s), totalIn = p.deposit + n(s.refurb) + n(s.furnishing) + p.sdlt + n(s.legal) + n(s.otherUpfront);
      var interest = interestOnly(p.mortgage, s.mortgageRate);
      var exp = interest + inc * n(s.commPct) / 100 + interest * n(s.maintOnMortgagePct) / 100 + n(s.council) + n(s.utilities) + n(s.channel);
      var out = finish({ deposit: p.deposit, mortgage: p.mortgage, sdlt: p.sdlt, totalIn: totalIn, ownMoney: totalIn, annualIncome: inc * 12, interest: interest }, inc, exp, totalIn);
      out.v.roi = ratio(out.v.annual, totalIn); return out;
    }
  });

  // ---- 5. BRR to HMO  ("BRRR to HMO ROI Calculator") -------------------------------------------------
  CALCS.push({
    id: 'hmobrr', name: 'BRR to HMO', group: 'Buy, refurb & refinance', blurb: 'Refurb an HMO, refinance, and see the cash left in',
    layout: [
      { title: 'Money invested', items: purchaseItems(120000).concat([F('legal', 'Legal fees', '£', 3000), F('refurb', 'Refurbishment costs', '£', 30000),
        F('furnishing', 'Furnishing costs', '£', 0), F('otherUpfront', 'Any other costs', '£', 0, 'Survey, valuation, broker: anything else up front'), C('totalIn', 'Total money in', 'gbp', { bold: true }),
        C('ownMoney', 'Your own money', 'gbp', { bold: true, note: 'Total money in minus the mortgage — the bank’s share is not your cash' })]) },
      { title: 'Refinance', items: [F('endValue', 'End value', '£', 220000), F('ltv', 'Mortgage LTV', '%', 75), C('newMortgage', 'New mortgage', 'gbp'),
        C('cashLeft', 'Money left in', 'gbp', { bold: true }),
        { banner: { id: 'moneyOut', text: 'You would take out more than you put in. A negative amount left in is a good thing.' } },
        { banner: { id: 'paybackOk', text: 'The cash left in comes back from the rent within 2 years, so this still works as a BRR.' } }] },
      { title: 'Income', items: [F('roomRate', 'Room rate', '£', 595, 'per room, per month'), F('rooms', 'Number of rooms', '', 4), C('income', 'Total per month', 'gbp'), C('annualIncome', 'Total per annum', 'gbp')] },
      { title: 'Expenses', items: [F('mortgageRate', 'Mortgage rate', '%', 5, 'Interest-only'), F('mgmtPct', 'Management', '%', 10, '% of income'),
        F('maintPct', 'Maintenance / voids', '%', 10, '% of income'), F('council', 'Council tax', '£', 150, 'per month'), F('utilities', 'Utility bills', '£', 400, 'per month'),
        F('other', 'Any other costs', '£', 400, 'per month')] },
      cashflowResults({ noIncomeRow: true, roiLabel: 'ROI (on money left in)', roiVerdict: 'cashRoi', paybackPrice: true })],
    summary: [['Money in', 'totalIn', 'gbp'], ['Money left in', 'cashLeft', 'gbp'], ['ROI', 'roi', 'pct']],
    compute: function (s) {
      var p = purchase(s), inc = roomsIncome(s);
      var totalIn = p.deposit + p.mortgage + p.sdlt + n(s.legal) + n(s.refurb) + n(s.furnishing) + n(s.otherUpfront); // sheet counts the whole purchase
      var newMortgage = n(s.endValue) * n(s.ltv) / 100, cashLeft = totalIn - newMortgage;
      var exp = interestOnly(newMortgage, s.mortgageRate) + inc * n(s.mgmtPct) / 100 + inc * n(s.maintPct) / 100 + n(s.council) + n(s.utilities) + n(s.other);
      var out = finish({ deposit: p.deposit, mortgage: p.mortgage, sdlt: p.sdlt, totalIn: totalIn, ownMoney: totalIn - p.mortgage, newMortgage: newMortgage, cashLeft: cashLeft, moneyOut: cashLeft < 0, annualIncome: inc * 12 }, inc, exp, cashLeft);
      out.v.roi = cashLeft > 0 ? out.v.annual / cashLeft : NO_CASH; out.v.paybackOk = paybackOk(cashLeft, out.v.monthly); out.v.paybackPrice = paybackPrice(s, newMortgage, out.v.monthly, totalIn - p.deposit - p.mortgage - p.sdlt); return out;
    }
  });

  // ---- 6. BRR to SA  ("BRRR to SA ROI Calculator") -------------------------------------------------
  CALCS.push({
    id: 'sabrr', name: 'BRR to SA', group: 'Buy, refurb & refinance', blurb: 'Refurb, refinance and run it as serviced accommodation',
    layout: [
      { title: 'Money invested', items: purchaseItems(117000).concat([F('legal', 'Legal costs', '£', 3000), F('refurb', 'Refurb costs', '£', 45000),
        F('furnishing', 'Furniture and staging', '£', 4500), F('otherUpfront', 'Any other costs', '£', 0, 'Survey, valuation, broker: anything else up front'), C('totalIn', 'Total money in', 'gbp', { bold: true }),
        C('ownMoney', 'Your own money', 'gbp', { bold: true, note: 'Total money in minus the mortgage — the bank’s share is not your cash' })]) },
      { title: 'Refinance', items: [F('endValue', 'End value (GDV)', '£', 200000), F('ltv', 'Re-mortgage LTV', '%', 75), C('newMortgage', 'New mortgage', 'gbp'),
        C('cashLeft', 'Cash remaining in deal', 'gbp', { bold: true }),
        { banner: { id: 'moneyOut', text: 'You would take out more than you put in. A negative cash left is a good thing.' } },
        { banner: { id: 'paybackOk', text: 'The cash left in comes back from the rent within 2 years, so this still works as a BRR.' } }] },
      { title: 'Income', items: [F('nightlyRate', 'Room rate', '£', 120, 'per night'), F('rooms', 'Number of rooms', '', 1), F('occupancyPct', 'Occupancy rate', '%', 74),
        C('income', 'Total per month', 'gbp2'), C('annualIncome', 'Total per annum', 'gbp')] },
      { title: 'Expenses', items: [F('mortgageRate', 'Mortgage rate', '%', 6, 'Interest-only'), F('commPct', 'Commissions', '%', 15, '% of income'),
        F('maintOnMortgagePct', 'Maintenance', '%', 10, '% of the mortgage interest, as in your sheet'), F('council', 'Council tax', '£', 132, 'per month'),
        F('utilities', 'Utility bills', '£', 240, 'per month'), F('channel', 'Channel manager', '£', 35, 'per month'), C('interest', 'Mortgage interest / month', 'gbp2')] },
      cashflowResults({ noIncomeRow: true, roiLabel: 'ROI (on cash left in)', roiVerdict: 'cashRoi', paybackPrice: true })],
    summary: [['Money in', 'totalIn', 'gbp'], ['Monthly profit', 'monthly', 'gbp2'], ['ROI', 'roi', 'pct']],
    compute: function (s) {
      var p = purchase(s), inc = saIncome(s);
      var totalIn = p.deposit + p.mortgage + p.sdlt + n(s.legal) + n(s.refurb) + n(s.furnishing) + n(s.otherUpfront);
      var newMortgage = n(s.endValue) * n(s.ltv) / 100, cashLeft = totalIn - newMortgage, interest = interestOnly(newMortgage, s.mortgageRate);
      var exp = interest + inc * n(s.commPct) / 100 + interest * n(s.maintOnMortgagePct) / 100 + n(s.council) + n(s.utilities) + n(s.channel);
      var out = finish({ deposit: p.deposit, mortgage: p.mortgage, sdlt: p.sdlt, totalIn: totalIn, ownMoney: totalIn - p.mortgage, newMortgage: newMortgage, cashLeft: cashLeft, moneyOut: cashLeft < 0, annualIncome: inc * 12, interest: interest }, inc, exp, cashLeft);
      out.v.roi = cashLeft > 0 ? out.v.annual / cashLeft : NO_CASH; out.v.paybackOk = paybackOk(cashLeft, out.v.monthly); out.v.paybackPrice = paybackPrice(s, newMortgage, out.v.monthly, totalIn - p.deposit - p.mortgage - p.sdlt); return out;
    }
  });

  // ---- 7. R2R HMO  ("R2R2HMO ROI Calculator") ---------------------------------------------------------
  CALCS.push({
    id: 'r2rhmo', name: 'R2R HMO', group: 'Rent to rent', blurb: 'Rent a property and let it by the room',
    layout: [
      { title: 'Money invested', items: [F('upfront', 'Deposit / up-front rent', '£', 2132), F('refurb', 'Refurbishment costs', '£', 5000), F('furnishing', 'Furnishing costs', '£', 0),
        F('otherUpfront', 'Any other costs', '£', 0), C('totalIn', 'Total money in', 'gbp', { bold: true })] },
      { title: 'Income', items: [F('roomRate', 'Room rate', '£', 750, 'per room, per month'), F('rooms', 'Number of rooms', '', 4), C('income', 'Total per month', 'gbp'), C('annualIncome', 'Total per annum', 'gbp')] },
      { title: 'Expenses', items: [F('rentPaid', 'Rent you pay', '£', 1700, 'per month'), F('mgmtPct', 'Management', '%', 0, '% of income'),
        F('maintOnRentPct', 'Maintenance', '%', 10, '% of the rent you pay'), F('council', 'Council tax', '£', 150, 'per month'), F('utilities', 'Utility bills', '£', 280, 'per month')] },
      cashflowResults({ noIncomeRow: true, noBreakeven: true })],
    summary: SUMMARY,
    compute: function (s) {
      var inc = roomsIncome(s), rent = n(s.rentPaid), totalIn = n(s.upfront) + n(s.refurb) + n(s.furnishing) + n(s.otherUpfront);
      var exp = rent + inc * n(s.mgmtPct) / 100 + rent * n(s.maintOnRentPct) / 100 + n(s.council) + n(s.utilities);
      var out = finish({ totalIn: totalIn, ownMoney: totalIn, annualIncome: inc * 12 }, inc, exp, totalIn);
      out.v.roi = ratio(out.v.annual, totalIn); return out;
    }
  });

  // ---- 8. R2R SA  ("R2RSA ROI Calculator") --------------------------------------------------------------
  CALCS.push({
    id: 'r2rsa', name: 'R2R SA', group: 'Rent to rent', blurb: 'Rent a property and run it as serviced accommodation',
    layout: [
      { title: 'Money invested', items: [F('upfront', 'Deposit / up-front rent', '£', 334), F('refurb', 'Refurbishment costs', '£', 3500), F('furnishing', 'Staging and furnishing costs', '£', 0),
        F('otherUpfront', 'Any other costs', '£', 0), C('totalIn', 'Total money in', 'gbp', { bold: true })] },
      { title: 'Income', items: [F('nightlyRate', 'Room rate', '£', 135, 'per night'), F('rooms', 'Number of rooms', '', 1), F('occupancyPct', 'Occupancy rate', '%', 70),
        C('income', 'Total per month', 'gbp2'), C('annualIncome', 'Total per annum', 'gbp')] },
      { title: 'Expenses', items: [F('rentPaid', 'Rent you pay', '£', 1200, 'per month'), F('commPct', 'Commissions', '%', 15, '% of income'),
        F('maintOnRentPct', 'Maintenance', '%', 5, '% of the rent you pay'), F('council', 'Council tax', '£', 173, 'per month'), F('utilities', 'Utility bills', '£', 280, 'per month'),
        F('channel', 'Channel manager', '£', 35, 'per month')] },
      cashflowResults({ noIncomeRow: true, noBreakeven: true })],
    summary: SUMMARY,
    compute: function (s) {
      var inc = saIncome(s), rent = n(s.rentPaid), totalIn = n(s.upfront) + n(s.refurb) + n(s.furnishing) + n(s.otherUpfront);
      var exp = rent + inc * n(s.commPct) / 100 + rent * n(s.maintOnRentPct) / 100 + n(s.council) + n(s.utilities) + n(s.channel);
      var out = finish({ totalIn: totalIn, ownMoney: totalIn, annualIncome: inc * 12 }, inc, exp, totalIn);
      out.v.roi = ratio(out.v.annual, totalIn); return out;
    }
  });

  // ---- Tools: things that cost money rather than return it, so they never carry a "ROI" and are kept out of the
  // compare-every-strategy ranking (CALCS). They still use the same field/compute/summary shape, so the ordinary
  // calculator screen, Save, and the "Your deal" screen's exclusion of their fields (they are not in CALCS) all
  // work without any special-casing. costOnly: true tells the screen to show a plain "total cost" verdict instead
  // of an ROI one. No spreadsheet exists for this one; the defaults are a representative UK bridging loan, not a
  // quote — every figure is editable and stated as an estimate.
  var TOOLS = [];
  TOOLS.push({
    id: 'bridging', name: 'Bridging Loan', group: 'Financing costs', costOnly: true, showsEffect: true,
    blurb: 'What a short-term bridging loan would cost to arrange, hold and repay',
    layout: [
      { title: 'The loan', items: [F('grossLoan', 'Loan amount', '£', 150000, 'The gross amount the lender advances'),
        F('termMonths', 'Term', '', 9, 'Months'), F('monthlyRatePct', 'Interest rate', '%', 0.85, 'Per month, not per year'),
        Ch('interestType', 'How the interest is charged', [['rolled', 'Rolled up'], ['monthly', 'Paid monthly']], 'rolled',
          'Rolled up: added to what you owe each month and repaid in one sum at the end. Paid monthly: paid out of pocket, so the balance never grows.')] },
      { title: 'Fees', items: [F('arrangementFeePct', 'Arrangement fee', '%', 2, '% of the loan, deducted when it is drawn'),
        F('exitFeePct', 'Exit fee', '%', 1, '% of the loan, paid when you repay it'),
        F('valuationFee', 'Valuation fee', '£', 350, 'Deducted when the loan is drawn'),
        F('bridgeLegal', 'Legal fees', '£', 1200, 'Paid to your solicitor directly, not deducted from the loan'),
        F('brokerFeePct', 'Broker fee', '%', 0, '% of the loan, if you used one')] },
      { title: 'What you receive', items: [C('netAdvance', 'Net advance', 'gbp', { bold: true }), C('arrangement', 'Arrangement fee', 'gbp'),
        C('valuation', 'Valuation fee', 'gbp'), C('broker', 'Broker fee', 'gbp', { hideZero: true })] },
      { title: 'Cost of the loan', items: [C('monthlyPayment', 'Monthly payment', 'gbp2', { hideZero: true }),
        C('totalInterest', 'Total interest over the term', 'gbp'), C('exit', 'Exit fee', 'gbp'),
        C('redemption', 'Repaid at the end', 'gbp', { bold: true }), C('totalCost', 'Total cost of borrowing', 'gbp', { bold: true }),
        C('costPct', 'Cost of borrowing, as % of the loan', 'pct')] }],
    summary: [['Net advance', 'netAdvance', 'gbp'], ['Total interest', 'totalInterest', 'gbp'], ['Total cost', 'totalCost', 'gbp']],
    compute: function (s) {
      var gross = n(s.grossLoan), months = Math.max(0, n(s.termMonths)), rate = n(s.monthlyRatePct) / 100;
      var arrangement = gross * n(s.arrangementFeePct) / 100, exit = gross * n(s.exitFeePct) / 100;
      var valuation = n(s.valuationFee), legal = n(s.bridgeLegal), broker = gross * n(s.brokerFeePct) / 100;
      var rolled = s.interestType !== 'monthly', totalInterest, monthlyPayment = null, redemption;
      if (rolled) {
        var bal = gross;
        for (var i = 0; i < months; i++) bal += bal * rate;          // compounds monthly, added to what is owed
        totalInterest = bal - gross; redemption = gross + totalInterest + exit;
      } else {
        totalInterest = gross * rate * months;                        // paid out each month; the balance never grows
        monthlyPayment = gross * rate; redemption = gross + exit;      // interest already paid, so only principal + exit fee remain
      }
      var netAdvance = gross - arrangement - valuation - broker;       // fees taken off the advance; interest and exit fee are not
      var totalCost = arrangement + valuation + legal + broker + totalInterest + exit;
      return { v: { grossLoan: gross, totalIn: gross, netAdvance: netAdvance, arrangement: arrangement, valuation: valuation, broker: broker,
        monthlyPayment: monthlyPayment, totalInterest: totalInterest, exit: exit, redemption: redemption, totalCost: totalCost,
        costPct: gross ? totalCost / gross : null } };
    }
  });

  // ---- Recycle price: the reverse of the BRR calculators --------------------------------------------------
  // Those take a purchase price and say how much cash is left in after the refinance. This takes the end value,
  // refurb and costs and works out the highest purchase price that leaves NOTHING in: price + stamp duty + refurb
  // + legals + other costs = the refinance loan (LTV x end value). Stamp duty is itself a function of the price, so
  // with the automatic figure the price is found by search; with a typed figure it is plain subtraction.
  TOOLS.push({
    id: 'recycle', name: 'Recycle Price', group: 'Work out the price', solver: true,
    blurb: 'The most you can pay for the property and still get every pound back when you refinance',
    layout: [
      { title: 'The deal', items: [F('endValue', 'End value (GDV)', '£', 200000, 'What it will be worth once done, and what the lender values it at'),
        F('refurb', 'Refurb costs', '£', 45000), F('legal', 'Legal costs', '£', 3000),
        F('otherUpfront', 'Any other costs', '£', 0, 'Survey, broker, finance fees — anything else you pay up front'),
        F('ltv', 'Re-mortgage LTV', '%', 75, 'How much of the end value the lender pays out')] },
      { title: 'The answer', items: [C('maxPrice', 'Buy at up to', 'gbp', { bold: true }), C('pctOfGdv', 'That price as % of end value', 'pct'),
        C('sdlt', 'Stamp duty at that price', 'gbp'), C('totalIn', 'Total money in', 'gbp'), C('newMortgage', 'The refinance pays out', 'gbp'),
        C('cashLeft', 'Cash left in the deal', 'gbp'), C('equity', 'Equity you keep', 'gbp', { bold: true }),
        { banner: { id: 'impossible', text: 'The refurb and costs alone come to more than the refinance pays out, so no purchase price gets all your money back.' } }] }],
    summary: [['Total money in', 'totalIn', 'gbp'], ['Equity you keep', 'equity', 'gbp'], ['Buy at up to', 'maxPrice', 'gbp']],
    compute: function (s) {
      var gdv = n(s.endValue), loan = gdv * n(s.ltv) / 100, fixed = n(s.refurb) + n(s.legal) + n(s.otherUpfront);
      var budget = loan - fixed, price = 0;
      if (budget > 0) {
        var lo = 0, hi = budget;                                        // price + stampDuty(price) rises with price, so search
        for (var i = 0; i < 80; i++) { var mid = (lo + hi) / 2; if (mid + stampDuty(mid) <= budget) lo = mid; else hi = mid; }
        price = Math.floor(lo);                                         // whole pounds, rounded DOWN so it never overshoots
      }
      var impossible = budget <= 0, sdlt = stampDuty(price);
      var totalIn = price + sdlt + fixed;
      return { v: { maxPrice: impossible ? 0 : price, pctOfGdv: gdv > 0 && !impossible ? price / gdv : null, sdlt: sdlt, totalIn: totalIn, newMortgage: loan,
        cashLeft: totalIn - loan, equity: gdv - totalIn, impossible: impossible } };
    }
  });

  // ---- What a bridging loan does to a deal that refinances (flip, BRR to HMO, BRR to SA) -------------------
  // A bridge does not change the rent or the sale price — only how the purchase+refurb is funded until the
  // refinance. Whatever the loan is sized at, the cash-flow identity (money in = money out, across drawdown and
  // redemption) reduces to one simple fact: using a bridge adds EXACTLY its own total cost (every fee plus the
  // interest) to what is left trapped in the deal once refinanced. Nothing else about the deal moves.
  var REFINANCE_IDS = ['flip', 'hmobrr', 'sabrr'];
  function bridgingEffect(deal) {
    var bridge = find('bridging'), bv = bridge.compute(stateFor(bridge, deal)).v;
    return REFINANCE_IDS.map(function (id) {
      var c = find(id), v = c.compute(stateFor(c, deal)).v;
      var cashLeftAfter = v.cashLeft + bv.totalCost, moneyOutAfter = cashLeftAfter <= 0;
      var roiAfter = moneyOutAfter ? NO_CASH : v.annual / cashLeftAfter;
      return { id: id, name: c.name, cashLeftBefore: v.cashLeft, roiBefore: v.roi, moneyOutBefore: v.moneyOut,
        cashLeftAfter: cashLeftAfter, roiAfter: roiAfter, moneyOutAfter: moneyOutAfter, bridgeCost: bv.totalCost };
    });
  }

  function defaults(calc) {
    var d = {};
    calc.layout.forEach(function (sec) { sec.items.forEach(function (it) { if (it.field) d[it.field.id] = it.field.def; if (it.choice) d[it.choice.id] = it.choice.def; }); });
    return d;
  }
  // A deal is the values the person has typed. Every calculator reads the same deal, so a field
  // with the same id in two calculators is one number entered once. Ids are only shared where the
  // meaning is the same as in the sheets (e.g. maintenance % of income vs of the mortgage vs of the rent are three ids).
  function stateFor(calc, deal) { return Object.assign(defaults(calc), deal || {}); }
  var RENAMES = {
    flip: { gdv: 'endValue', remortgageLtv: 'ltv', managementPct: 'mgmtPct' },
    btl: { rent: 'monthlyRent' },
    sabtl: { maintPct: 'maintOnMortgagePct', staging: 'furnishing' },
    sabrr: { maintPct: 'maintOnMortgagePct' },
    r2rhmo: { rent: 'rentPaid', maintPct: 'maintOnRentPct', deposit: 'upfront' },
    r2rsa: { rent: 'rentPaid', maintPct: 'maintOnRentPct', deposit: 'upfront', staging: 'furnishing' }
  };
  // Deals saved before fields were shared used per-calculator ids; bring them across.
  function migrate(calcId, data) {
    var map = RENAMES[calcId] || {}, out = {};
    for (var k in (data || {})) out[map[k] || k] = data[k];
    return out;
  }
  // Searches the 8 ROI calculators first, then the cost-only tools, so a single #c/<id> route and Save button
  // work for either kind without the caller needing to know which list a given id lives in.
  function find(id) {
    for (var i = 0; i < CALCS.length; i++) if (CALCS[i].id === id) return CALCS[i];
    for (var j = 0; j < TOOLS.length; j++) if (TOOLS[j].id === id) return TOOLS[j];
    return null;
  }

  // ---- Compare: the same deal through every calculator ------------------------------------------------
  // Each row is that calculator's own answer, taken straight from its compute(). Nothing is recalculated here.
  // ROI is the sheet's own ROI: on money in for buy-to-let / rent-to-rent, on cash left in for the refinance ones.
  function rank(roi) { return typeof roi === 'number' ? roi : (typeof roi === 'string' && roi.charAt(0) === '∞') ? Infinity : -Infinity; }
  // A flip's net profit (profit as a share of the end value), judged against the flip target (6 Oct 2026): 'good'
  // (green) at the target or more, 'ok' (amber) from 5 points below it (never below 0%), 'bad' (red) under that.
  // The test is made on the figure as it is shown (one decimal place), so 24.96% shows as 25.0% and is good.
  // target: a flip target in % (optional; the person's own target, setTargets, when left out). null for a non-number.
  var FLIP_OK_GAP = 5;
  function flipOkFrom(target) { return Math.max(0, (target == null ? TG.flip : Number(target)) - FLIP_OK_GAP); }
  var FLIP_TARGET, FLIP_OK;                       // the current target and amber line as fractions (set by setTargets)
  function flipVerdict(margin, target) {
    if (typeof margin !== 'number' || !isFinite(margin)) return null;
    var t = target == null ? TG.flip : Number(target), m = Math.round(margin * 1000) / 10;
    return m >= t ? 'good' : m >= flipOkFrom(t) ? 'ok' : 'bad';
  }
  // ROI on cash left in (the refinance strategies) is acceptable at 50% or more, red below. Tested on the figure as shown
  // (one decimal), like the flip target. "No cash left in" means everything came back out, which is as good as it gets.
  var CASH_ROI_TARGET = 0.5;
  function cashRoiVerdict(roi) {
    if (typeof roi === 'string' && roi.charAt(0) === '∞') return 'good';
    if (typeof roi !== 'number' || !isFinite(roi)) return null;
    return Math.round(roi * 1000) / 1000 >= CASH_ROI_TARGET ? 'good' : 'bad';
  }
  function rowFor(c, deal) {
    var v = c.compute(stateFor(c, deal)).v;
    return { id: c.id, name: c.id === 'flip' ? 'BRR to BTL' : c.name, group: c.group, moneyIn: v.totalIn, ownMoney: v.ownMoney,
      cashLeft: v.cashLeft != null ? v.cashLeft : null, monthly: v.monthly, annual: v.annual, roi: v.roi,
      breakeven: v.breakeven !== undefined ? v.breakeven : null, refinance: v.cashLeft != null,
      flip: c.id === 'flip' ? { moneyIn: v.totalIn, ownMoney: v.ownMoney, profit: v.profit, margin: v.margin, roi: v.flipRoi } : null };
  }
  function compareAll(deal) {
    var rows = CALCS.map(function (c) { return rowFor(c, deal); });
    return { rows: rows, flip: rows.filter(function (r) { return r.id === 'flip'; })[0].flip };
  }

  // ---- Compare saved deals: different deals, each through one calculator ------------------------------
  // deals: [{ id, name, calc, data }]. With no asId each deal goes through the calculator it was saved from;
  // with asId every deal goes through that one, so two properties can be judged as the same strategy.
  function compareDeals(deals, asId) {
    return deals.map(function (d) {
      var c = find(asId || d.calc) || find('flip'), r = rowFor(c, d.data);
      r.key = d.id; r.dealName = d.name; r.calcId = c.id; r.calcName = r.name; r.name = d.name;
      return r;
    });
  }

  // ---- Field registry: one entry per distinct field id, for the "Your deal" screen ---------------------
  // usedBy is DERIVED from the calculators' own layouts, never hand-written, so a new field or calculator
  // is picked up automatically. Only the GROUP a field sits under is a design choice and stays a hand map.
  // Group order matches the 31-input, 8-group structure the design was built around.
  var FIELD_GROUPS = [
    ['property', 'Money invested', ['purchasePrice', 'depositPct', 'legal', 'refurb', 'furnishing', 'otherUpfront', 'upfront']],
    ['refinance', 'Refinance', ['endValue', 'ltv']],
    ['mortgage', 'Mortgage', ['mortgageRate', 'insurance']],
    ['letting', 'Rental income', ['monthlyRent', 'roomRate', 'rooms', 'nightlyRate', 'occupancyPct']],
    ['r2r', 'Rent you pay', ['rentPaid']],
    ['costs', 'Management & maintenance', ['mgmtPct', 'voidsPct', 'maintPct', 'maintOnMortgagePct', 'maintOnRentPct', 'commPct']],
    ['running', 'Running costs', ['council', 'utilities', 'channel', 'other']]
  ];
  function fieldRegistry() {
    var byId = {}, order = [];
    CALCS.forEach(function (c) {
      c.layout.forEach(function (sec) {
        sec.items.forEach(function (it) {
          if (!it.field) return;
          var f = it.field;
          if (!byId[f.id]) { byId[f.id] = { id: f.id, label: f.label, unit: f.unit, def: f.def, note: f.note, usedBy: [] }; order.push(f.id); }
          if (byId[f.id].usedBy.indexOf(c.id) < 0) byId[f.id].usedBy.push(c.id);
        });
      });
    });
    var grouped = FIELD_GROUPS.map(function (g) {
      return { id: g[0], name: g[1], fields: g[2].filter(function (id) { return byId[id]; }).map(function (id) { return byId[id]; }) };
    });
    var placed = {}; grouped.forEach(function (g) { g.fields.forEach(function (f) { placed[f.id] = true; }); });
    var leftover = order.filter(function (id) { return !placed[id]; });
    if (leftover.length) grouped.push({ id: 'other', name: 'Other', fields: leftover.map(function (id) { return byId[id]; }) });
    return { groups: grouped, byId: byId, total: order.length };
  }

  // Cash left in a recycle deal if the property is bought at `price`: what goes in, less what the refinance pays out.
  // Negative means the refinance pays out MORE than went in, i.e. cash pulled out of the deal. Uses the same inputs
  // (and the same stamp duty rule: a typed figure is used as it is, blank is worked out at this price) as the recycle calculator.
  function cashLeftAtPrice(s, price) {
    var loan = n(s.endValue) * n(s.ltv) / 100, fixed = n(s.refurb) + n(s.legal) + n(s.otherUpfront);
    var sdlt = stampDuty(price), totalIn = price + sdlt + fixed;
    return { cashLeft: totalIn - loan, totalIn: totalIn, sdlt: sdlt, loan: loan };
  }
  // 'in' = cash still in the deal, 'out' = cash pulled out, 'even' = nothing either way (to the nearest pound).
  function cashKind(left) { return Math.round(left) > 0 ? 'in' : Math.round(left) < 0 ? 'out' : 'even'; }

  // The person's usual figures sit UNDER what they have typed for this deal and OVER the spreadsheet examples:
  // example < usual < typed. Returns a new object; neither input is changed. A blank usual figure is not a figure.
  function withUsual(deal, usual) {
    var out = {};
    for (var k in (usual || {})) if (usual[k] !== '' && usual[k] != null) out[k] = usual[k];
    for (var j in (deal || {})) out[j] = deal[j];
    return out;
  }
  // ---- The simple Flip / BRR screens ---------------------------------------------------------------------
  // Flip and BRR start with a handful of basic figures. For a BRR the rental part (BTL, HMO or SA) is chosen afterwards and
  // brings only its own fields. This is only a plan for the screen: every figure is still computed by the same calculators
  // (flip for BTL, hmobrr for HMO, sabrr for SA), so no result changes. test-calcs.js proves no field is left unreachable.
  var BRR_LETTING = { none: 'flip', btl: 'flip', hmo: 'hmobrr', sa: 'sabrr' };
  // The five figures the primary screen asks for, in the order it asks. They are read by the flip calculator, which gives both
  // the flip profit and the refinance, so one small form answers both questions.
  var BASIC = ['purchasePrice', 'refurb', 'legal', 'otherUpfront', 'endValue'];
  var OPTIONAL = ['ltv', 'depositPct'];
  var RENTAL = {
    none: [],
    btl: ['monthlyRent', 'mortgageRate', 'mgmtPct', 'voidsPct'],
    hmo: ['rooms', 'roomRate', 'furnishing', 'mortgageRate', 'mgmtPct', 'maintPct', 'council', 'utilities', 'other'],
    sa: ['rooms', 'nightlyRate', 'occupancyPct', 'furnishing', 'mortgageRate', 'commPct', 'maintOnMortgagePct', 'council', 'utilities', 'channel']
  };
  // letting: 'none' | 'btl' | 'hmo' | 'sa'; anything else is 'none'. primaryCalcId computes the basics; calcId computes the chosen strategy.
  function simplePlan(kind, letting) {
    var l = BRR_LETTING.hasOwnProperty(letting) ? letting : 'none';
    return { primaryCalcId: 'flip', calcId: BRR_LETTING[l], letting: l, basic: BASIC.slice(), optional: OPTIONAL.slice(), rental: RENTAL[l].slice() };
  }
  // How a listing is being sold, in the words shown on a deal card. "Private sale" is only said when it is known:
  // a listing whose sale type was never checked says so, and a guide price is flagged as a likely auction.
  function saleLabel(p) {
    var t = p && p.listingType;
    if (t === 'MMOA') return 'Modern auction';
    if (t === 'AUCTION') return 'Auction';
    if (t === 'OPEN') return 'Private sale';
    return /guide price|starting bid/i.test(String((p && p.priceQualifier) || '')) ? 'Guide price \u00b7 may be an auction' : 'Sale type not checked';
  }
  // "Buy at this price to recycle all your money", on the primary screen's own figures: end value, refurb, legal and the
  // refinance LTV and any other up-front costs, with stamp duty worked out at the price found. It is the Max price
  // calculation, so at this price the primary screen's own "cash left in" comes to nothing. null when no price works.
  function recyclePrice(s) {
    var rc = find('recycle'), v = rc.compute(stateFor(rc, s)).v;
    return v.impossible ? null : v.maxPrice;
  }
  // ---- The Live ledger: the Calculator's primary screen (design 3a) ---------------------------------------
  // One deal, four ways out: sell it ('none'), single let ('btl'), by the room ('hmo'), nightly stays ('sa'). Each exit is
  // computed by the calculator it always was (flip, flip, hmobrr, sabrr); nothing here changes those. What is added is the
  // optional bridging loan, whose whole cost is extra cash left in the deal (the rule bridgingEffect already states), plus
  // the screen's own sums: own money in, total money in, and the price at which every pound comes back.

  // Every let (single let, by the room, nightly stays) is only worth running at 500 a month profit or more; the annual
  // figure is judged by the same verdict (500 x 12 = 6,000).
  var MONTHLY_PROFIT_TARGET = 500;
  function monthlyProfitVerdict(monthly) {
    if (typeof monthly !== 'number' || !isFinite(monthly)) return null;
    return Math.round(monthly * 100) / 100 >= MONTHLY_PROFIT_TARGET ? 'good' : 'bad';     // judged on the pence shown
  }
  // Months for the rent to pay back the cash left in: 6 or under good, up to 24 amber, longer or never bad. Nothing
  // left in the deal is as good as it gets. Judged on the figure shown (one decimal place).
  var PAYBACK_GOOD = 6, PAYBACK_OK = 24;
  function paybackVerdict(months, cashLeft) {
    if (typeof cashLeft === 'number' && cashLeft <= 0) return 'good';
    if (typeof months !== 'number') return 'bad';                              // 'Not at this profit': never
    var m = Math.round(months * 10) / 10;
    return m <= PAYBACK_GOOD ? 'good' : m <= PAYBACK_OK ? 'amber' : 'bad';
  }
  // The largest whole-pound price P with P + stampDuty(P) <= budget. null when no price fits.
  function priceForBudget(budget) {
    if (!(budget > 0)) return null;
    var lo = 0, hi = budget;
    for (var i = 0; i < 80; i++) { var mid = (lo + hi) / 2; if (mid + stampDuty(mid) <= budget) lo = mid; else hi = mid; }
    return Math.floor(lo);
  }
  // deal: the figures as typed, already layered with the usual figures. bridgeOn: is a bridging loan paying for it.
  // Returns { ps, ltv, bridgeCost, bridge, exits: { none, btl, hmo, sa } }; each exit is
  //   { exit, calcId, state, v, furnishing, recyclePrice, own: { deposit, sdlt, legal, refurb, other, furnishing, bridge, total, mortgage, totalIn } }.
  function ledger(deal, bridgeOn) {
    var fc = find('flip'), ps = stateFor(fc, deal), pv = fc.compute(ps).v;
    var bridge = null, cost = 0;
    if (bridgeOn) { var bc = find('bridging'); bridge = bc.compute(stateFor(bc, deal)).v; cost = n(bridge.totalCost); }
    var E = n(ps.endValue), ltv = n(ps.ltv), legal = n(ps.legal), refurb = n(ps.refurb), other = n(ps.otherUpfront), P0 = n(ps.purchasePrice);
    // The four deal figures and the two lender figures are one set, shown once; every exit is worked out on them.
    var shared = { purchasePrice: ps.purchasePrice, refurb: ps.refurb, legal: ps.legal, otherUpfront: ps.otherUpfront, endValue: ps.endValue, ltv: ps.ltv, depositPct: ps.depositPct };
    function withBridge(v, furn) {
      if (!bridgeOn) return v;
      var out = {}; for (var k in v) out[k] = v[k];
      var cl = v.cashLeft + cost;
      out.cashLeft = cl; out.totalIn = v.totalIn + cost; out.moneyOut = cl <= 0;
      if (v.annual != null) {
        out.roi = cl > 0 ? v.annual / cl : NO_CASH;
        out.breakeven = cl > 0 ? breakeven(cl, v.monthly) : 0;
        out.paybackOk = paybackOk(cl, v.monthly);
      }
      if (v.monthly > 0) out.paybackPrice = priceForBudget(v.newMortgage + v.monthly * PAYBACK_MONTHS - legal - refurb - other - furn - cost);
      return out;
    }
    function exitOf(key) {
      var calcId = BRR_LETTING[key], isFlipCalc = calcId === 'flip';
      var c = find(calcId), s = isFlipCalc ? ps : stateFor(c, Object.assign({}, deal, shared)), raw = isFlipCalc ? pv : c.compute(s).v;
      var furn = key === 'hmo' || key === 'sa' ? n(s.furnishing) : 0, v = withBridge(raw, furn);
      if (bridgeOn && isFlipCalc) {                                  // selling: the loan's cost comes straight off the profit
        v.profit = raw.profit - cost; v.margin = E ? v.profit / E : null; v.flipRoi = v.totalIn ? v.profit / v.totalIn : null;
      }
      var dep = P0 * n(ps.depositPct) / 100, sdlt = stampDuty(P0), total = dep + sdlt + legal + refurb + other + furn + cost;
      return { exit: key, calcId: calcId, state: s, v: v, furnishing: furn,
        recyclePrice: furn || cost ? priceForBudget(E * ltv / 100 - refurb - legal - other - furn - cost) : recyclePrice(ps),
        own: { deposit: dep, sdlt: sdlt, legal: legal, refurb: refurb, other: other, furnishing: furn, bridge: cost, total: total, mortgage: P0 - dep, totalIn: total + (P0 - dep) } };
    }
    return { ps: ps, ltv: ltv, bridgeCost: cost, bridge: bridge, exits: { none: exitOf('none'), btl: exitOf('btl'), hmo: exitOf('hmo'), sa: exitOf('sa') } };
  }

  // Is a listing an auction? Traditional and modern-method auctions both count, and so does anything with an auction date.
  // A listing whose sale type was never checked is NOT called an auction (and is not called a private sale either: saleLabel).
  function isAuction(p) { var t = p && p.listingType; return t === 'AUCTION' || t === 'MMOA' || !!(p && p.auctionDate); }
  // The Deals filter: 'all' shows everything, 'auction' only auctions, 'other' everything that is not an auction.
  // A listing of unknown sale type priced as a guide price or starting bid is probably an auction. It is grouped with
  // the auctions in the filter, so "Not auction" leaves only listings with nothing pointing to an auction.
  function maybeAuction(p) { return !isAuction(p) && !!p && p.listingType !== 'OPEN' && /guide price|starting bid/i.test(String(p.priceQualifier || '')); }
  function saleMatches(p, filter) { var a = isAuction(p) || maybeAuction(p); return filter === 'auction' ? a : filter === 'other' ? !a : true; }
  // The order of the deal list: Pursue, Watch, Reject, and inside each the end values we are surest of come first, so
  // a "watch" built on three distant sales sits below one built on the street's own sales. Unrated ones go last.
  var VERDICT_RANK = { PURSUE: 0, WATCH: 1, REJECT: 2 };
  function feedOrder(a, b) {
    var va = VERDICT_RANK[a && a.verdict], vb = VERDICT_RANK[b && b.verdict];
    va = va == null ? 9 : va; vb = vb == null ? 9 : vb;
    if (va !== vb) return va - vb;
    var sa = a && typeof a.endValueScore === 'number' ? a.endValueScore : -1, sb = b && typeof b.endValueScore === 'number' ? b.endValueScore : -1;
    return sb - sa;
  }
  // A price cut, in the words shown on a deal card; null when the listing was not reduced.
  function reducedLabel(p) {
    if (p && p.reducedBy > 0) return 'Reduced by \u00a3' + Math.round(p.reducedBy).toLocaleString('en-GB');
    return p && p.reduced ? 'Price reduced' : null;
  }
  // How far to trust the end value, in one line for the deal card: the rating and the likely range. null when unrated.
  function valueNote(p) {
    var cf = String((p && p.endValueConfidence) || '').toUpperCase(); if (cf === 'MED') cf = 'MEDIUM';
    if (!p || p.endValue == null || ['HIGH', 'MEDIUM', 'LOW'].indexOf(cf) < 0) return null;
    var g = function (n) { return '\u00a3' + Math.round(n).toLocaleString('en-GB'); };
    var range = p.endValueLow != null && p.endValueHigh != null ? g(p.endValueLow) + ' \u2013 ' + g(p.endValueHigh) : null;
    return { level: cf, text: cf.charAt(0) + cf.slice(1).toLowerCase() + ' confidence' + (range ? ' \u00b7 likely ' + range : '') };
  }
  // ---- The verdict docked above the Calculator's buttons (design 6c) ---------------------------------------
  // One plain-words judgement of the chosen exit. A let (BTL, HMO, SA) is scored against four targets, each judged the way
  // its own figure is coloured on screen: 500 a month profit; 50% ROI on the cash left in (or nothing left in); the money
  // back within 6 months (nothing left in counts as 0 months, never paying back as never); and all the cash recycled
  // (the figure shown as left in is 0 or less). A flip is judged on the 25% target alone. v is the exit's figures from
  // ledger(): monthly, roi, cashLeft, breakeven for a let; margin and profit for a flip. ps (optional) is the deal's
  // figures: with no end value or no purchase price there is no deal to score, so the verdict asks for them instead.
  // ---- The person's own targets (5 Oct 2026): every verdict, colour and label reads these, never fixed figures ----
  var DEFAULT_TARGETS = { flip: 25, monthly: 500, roi: 50, payback: 6 }, TG = { flip: 25, monthly: 500, roi: 50, payback: 6 };
  var TARGET_LIMITS = { flip: [1, 100], monthly: [0, 100000], roi: [1, 1000], payback: [1, PAYBACK_OK] };
  function setTargets(t) {
    var c = {};
    Object.keys(DEFAULT_TARGETS).forEach(function (k) {
      var v = Number(t && t[k]), lim = TARGET_LIMITS[k];
      c[k] = t && t[k] !== '' && t[k] != null && isFinite(v) ? Math.min(lim[1], Math.max(lim[0], Math.round(v * 100) / 100)) : DEFAULT_TARGETS[k];
    });
    TG = c;
    FLIP_TARGET = c.flip / 100; FLIP_OK = flipOkFrom(c.flip) / 100; CASH_ROI_TARGET = c.roi / 100; MONTHLY_PROFIT_TARGET = c.monthly; PAYBACK_GOOD = c.payback;
    if (typeof api !== 'undefined') { api.FLIP_TARGET = FLIP_TARGET; api.FLIP_OK = FLIP_OK; api.CASH_ROI_TARGET = CASH_ROI_TARGET; api.MONTHLY_PROFIT_TARGET = MONTHLY_PROFIT_TARGET; api.PAYBACK_GOOD = PAYBACK_GOOD; }
    return targets();
  }
  function targets() { return { flip: TG.flip, monthly: TG.monthly, roi: TG.roi, payback: TG.payback }; }
  function defaultTargets() { return { flip: DEFAULT_TARGETS.flip, monthly: DEFAULT_TARGETS.monthly, roi: DEFAULT_TARGETS.roi, payback: DEFAULT_TARGETS.payback }; }
  function poundsText(v) { return '\u00a3' + Number(v).toLocaleString('en-GB', { maximumFractionDigits: 2 }); }
  // The targets as the screen names them, e.g. '25% flip · £500/mo · 50% ROI · 6 mo back'.
  function targetsSummary(t) { t = t || TG; return t.flip + '% flip \u00b7 ' + poundsText(t.monthly) + '/mo \u00b7 ' + t.roi + '% ROI \u00b7 ' + t.payback + ' mo back'; }
  // The four let targets, named from the current figures: £500 a month, 50% ROI, Money back in 6 months, All cash recycled.
  function letTargets() { return [poundsText(TG.monthly) + ' a month', TG.roi + '% ROI', 'Money back in ' + TG.payback + (TG.payback === 1 ? ' month' : ' months'), 'All cash recycled']; }
  function dealEntered(ps) { return Number(ps && ps.endValue) > 0 && Number(ps && ps.purchasePrice) > 0; }
  function dealVerdict(exit, v, ps) {
    v = v || {};
    if (ps && !dealEntered(ps)) return { kind: 'empty', score: null, of: null, hits: [], targets: [], tone: 'none', title: 'Enter the deal figures',
      detail: 'add end value and purchase price', misses: [], line: '' };
    if (exit === 'none' || exit === 'flip') {
      // A profit of 0 or less is always a loss-making flip (red), whatever the target. 'ok' (amber) still misses the target.
      var fv = v.profit > 0 ? flipVerdict(v.margin) : 'bad', ok = fv === 'good', tone = fv === 'ok' ? 'amber' : ok ? 'good' : 'bad';
      var m = typeof v.margin === 'number' && isFinite(v.margin) ? (v.margin * 100).toFixed(1) + '%' : '\u2014', tp = TG.flip + '%', okp = flipOkFrom() + '%';
      return { kind: 'flip', score: ok ? 1 : 0, of: 1, hits: [ok], tones: [tone], targets: [tp + ' margin' + (fv === 'ok' ? ' (amber from ' + okp + ')' : '')], tone: tone,
        title: ok ? 'Good flip' : fv === 'ok' ? 'OK flip' : v.profit > 0 ? 'Thin flip' : 'Loss-making flip',
        detail: m + ' margin \u00b7 target ' + tp, misses: ok ? [] : [tp + ' margin'],
        line: ok ? 'Clears the ' + tp + ' flip target' : fv === 'ok' ? 'OK: between ' + okp + ' and the ' + tp + ' target' : 'Below ' + okp + ': misses the ' + tp + ' flip target' };
    }
    var recycled = typeof v.cashLeft === 'number' && cashKind(v.cashLeft) !== 'in';
    var hits = [monthlyProfitVerdict(v.monthly) === 'good', recycled || cashRoiVerdict(v.roi) === 'good',
      paybackVerdict(v.breakeven, recycled ? 0 : v.cashLeft) === 'good', recycled];
    var names = letTargets(), n = hits.filter(Boolean).length, misses = names.filter(function (t, i) { return !hits[i]; });
    return { kind: 'let', score: n, of: 4, hits: hits, tones: hits.map(function (x) { return x ? 'good' : 'bad'; }), targets: names, tone: n >= 3 ? 'good' : n === 2 ? 'amber' : 'bad',
      title: n === 4 ? 'Strong deal' : n === 3 ? 'Good deal' : n === 2 ? 'Borderline' : 'Weak deal',
      detail: n === 4 ? 'hits all 4 targets' : 'hits ' + n + ' of 4 targets', misses: misses,
      line: misses.length ? 'Misses: ' + misses.join(', ') : 'Every target met' };
  }

  var api = { propertyTax: propertyTax, setTax: setTax, taxSetting: taxSetting, taxLabel: taxLabel, TAX_RATES: TAX_RATES, setTargets: setTargets, targets: targets, defaultTargets: defaultTargets, targetsSummary: targetsSummary, letTargets: letTargets, PAYBACK_GOOD: PAYBACK_GOOD, PAYBACK_OK: PAYBACK_OK, dealVerdict: dealVerdict, dealEntered: dealEntered, feedOrder: feedOrder, isAuction: isAuction, maybeAuction: maybeAuction, reducedLabel: reducedLabel, valueNote: valueNote, saleMatches: saleMatches, ledger: ledger, monthlyProfitVerdict: monthlyProfitVerdict, MONTHLY_PROFIT_TARGET: MONTHLY_PROFIT_TARGET, paybackVerdict: paybackVerdict, priceForBudget: priceForBudget, recyclePrice: recyclePrice, saleLabel: saleLabel, simplePlan: simplePlan, BRR_LETTING: BRR_LETTING, withUsual: withUsual, cashLeftAtPrice: cashLeftAtPrice, cashKind: cashKind, analyse: analyse, stampDuty: stampDuty, calcs: CALCS, tools: TOOLS, find: find, defaults: defaults, stateFor: stateFor, migrate: migrate, compareAll: compareAll, compareDeals: compareDeals, rank: rank, flipVerdict: flipVerdict, flipOkFrom: flipOkFrom, cashRoiVerdict: cashRoiVerdict, CASH_ROI_TARGET: CASH_ROI_TARGET, FLIP_TARGET: FLIP_TARGET, FLIP_OK: FLIP_OK, fieldRegistry: fieldRegistry, bridgingEffect: bridgingEffect };
  setTargets(DEFAULT_TARGETS);
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Calc = api;
})(this);

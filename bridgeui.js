// Bridging quotes screen (#bridge, 14 Oct 2026, Ashley's spec): the project, one or more lenders' quotes side by side,
// what each really costs and how much of your own cash it needs, a comparison with the winners, and a maximum bid.
// All the maths is in bridge.js (pure, tested by test-bridge.js); this file only draws and stores what is typed.
// Every figure starts blank: nothing is assumed. Kept on the phone in deal-analyser:bridgeTool.
function BridgeUI(ctx) {
  var h = ctx.h, B = window.Bridge, KEY = 'deal-analyser:bridgeTool', money = B.money;
  var S, box, R = [];
  var blankQuote = function () { return { name: '', structure: 'A', mode: 'quoted', net: '', gross: '', inclRolled: false, ltv: '', facility: '', rate: '', interest: 'retained', term: '', security: '', drawMode: 'stages', stages: '', upfrontPct: '', refurbMonths: '', fees: [] }; };
  function start() {
    return { p: { price: '', refurb: '', contMode: '£', cont: '', cash: '', auction: '', legal: '', additional: (ctx.taxBuyer() || 'add') === 'add', sdltOverride: false, sdltManual: '', endValue: '', exit: 'sale', selling: '', term: '' },
      quotes: [blankQuote()], threshold: '', tax: null, mb: { i: 0, keepLoan: true, step: '', gbp: '', gdv: '', cost: '' } };
  }
  function loadState() {
    var s = ctx.load(KEY, null), d = start();
    if (!s || typeof s !== 'object') return d;
    s.p = Object.assign(d.p, s.p || {}); s.mb = Object.assign(d.mb, s.mb || {});
    s.quotes = Array.isArray(s.quotes) && s.quotes.length ? s.quotes.map(function (q) { return Object.assign(blankQuote(), q, { fees: Array.isArray(q.fees) ? q.fees : [] }); }) : d.quotes;
    if (s.threshold == null) s.threshold = '';
    return s;
  }
  var save = function () { ctx.store(KEY, S); };
  var cfg = function () { return S.tax || B.defaultTax(ctx.Calc); };
  var refresh = function () { R.forEach(function (f) { try { f(); } catch (e) {} }); };
  var change = function () { save(); refresh(); };
  var rebuild = function () { var y = window.scrollY; render(box); window.scrollTo(0, y); };
  var qName = function (q, i) { return (q.name || '').trim() || 'Quote ' + (i + 1); };
  var pct = function (v, d) { return v == null || !isFinite(v) ? '—' : (Math.round(v * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)) + '%'; };
  var entered = function () { return Number(S.p.price) > 0; };

  // ---- small parts ----
  function tip(text) {                                   // a "?" that shows a plain-words explanation under the field
    var b = h('button', 'bq-tip', '?'), p = h('p', 'bq-help', text); b.type = 'button'; p.hidden = true;
    b.setAttribute('aria-label', 'What is this?'); b.setAttribute('aria-expanded', 'false');
    b.onclick = function () { p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden)); };
    return { b: b, p: p };
  }
  // a typed field: label (+ tip), the box with £ / % / months, and an optional live note under it
  function field(card, label, help, obj, key, unit, o) {
    o = o || {};
    var f = h('div', 'u9-field bq-f'), top = h('div', 'u9-top'), txt = h('span', 'u9-txt'), id = 'bq-' + (o.id || key) + '-' + Math.random().toString(36).slice(2, 7);
    var lab = h('label', '', label); lab.setAttribute('for', id); txt.appendChild(lab);
    var t = help ? tip(help) : null; if (t) txt.appendChild(t.b);
    var sub = h('small', '', o.sub || ''); txt.appendChild(sub);
    var val = h('span', 'u9-val'), input = h('input'); input.id = id; input.setAttribute('inputmode', 'decimal'); input.setAttribute('autocomplete', 'off');
    input.placeholder = o.placeholder || '—';
    var show = function (v) { return v === '' || v == null ? '' : unit === '£' ? Number(v).toLocaleString('en-GB', { maximumFractionDigits: 2 }) : String(v); };
    input.value = show(obj[key]);
    input.addEventListener('input', function () {
      var raw = input.value.replace(/[^0-9.\-]/g, '');
      obj[key] = raw === '' || raw === '-' || raw === '.' ? '' : Number(raw);
      if (o.onChange) o.onChange(); change();
    });
    input.addEventListener('blur', function () { input.value = show(obj[key]); });
    if (unit === '£') val.appendChild(h('span', 'u', '£')); val.appendChild(input);
    if (unit && unit !== '£') val.appendChild(h('span', 'u', unit === '%' ? '%' : unit === '%/mo' ? '% a month' : ' ' + unit));
    if (unit === '%/mo' || unit === 'months') val.classList.add('bq-wide');
    top.appendChild(txt); top.appendChild(val); f.appendChild(top); if (t) f.appendChild(t.p);
    card.appendChild(f); return { f: f, sub: sub, input: input };
  }
  // a segmented choice that rebuilds the screen (it shows or hides fields)
  function seg(card, label, obj, key, opts, help, keepDom) {
    var q = h('div', 'ab10-q bq-q'), sg = h('div', 'ab10-seg n' + opts.length); sg.setAttribute('role', 'group'); sg.setAttribute('aria-label', label);
    var l = h('div', 'ab10-l', label); var t = help ? tip(help) : null; if (t) l.appendChild(t.b); q.appendChild(l);
    opts.forEach(function (o) {
      var b = h('button', '', o[1]); b.type = 'button'; b.setAttribute('aria-pressed', String(obj[key] === o[0]));
      b.onclick = function () { obj[key] = o[0]; save(); if (keepDom) { [].forEach.call(sg.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); }); refresh(); } else rebuild(); };
      sg.appendChild(b);
    });
    q.appendChild(sg); if (t) q.appendChild(t.p); card.appendChild(q); return q;
  }
  function rows(el, list) {                               // [label, value, cls] rows that add up, like the funding card
    el.innerHTML = '';
    list.forEach(function (x) { if (!x) return; var r = h('div', 'fund11-row' + (x[2] ? ' ' + x[2] : '')); r.appendChild(h('span', '', x[0])); r.appendChild(h('b', 'fig', x[1])); el.appendChild(r); });
  }
  function fold(parent, label, startOpen) {
    var b = h('button', 'bq-fold', ''), body = h('div', 'bq-fold-body'); b.type = 'button';
    var set = function (open) { body.hidden = !open; b.textContent = (open ? 'Hide ' : 'Show ') + label + (open ? ' ▴' : ' ▾'); b.setAttribute('aria-expanded', String(open)); };
    b.onclick = function () { set(body.hidden); }; set(!!startOpen); parent.appendChild(b); parent.appendChild(body); return body;
  }

  // ---- the stamp duty bands sheet (the only built-in figures, all editable) ----
  function openBands() {
    if (!S.tax) S.tax = JSON.parse(JSON.stringify(B.defaultTax(ctx.Calc)));
    ctx.openSheet(function (sheet) {
      ctx.sheetHead(sheet, 'Stamp duty bands', 'Done');
      sheet.appendChild(h('p', 'bs-intro', 'Each rate is charged only on the slice of the price inside its band. They start as the app’s England & NI rates; change them if the rates change or the property is elsewhere. Leave the last “up to” blank for no limit.'));
      var list = h('div', 'bq-bands'); sheet.appendChild(list);
      var draw = function () {
        list.innerHTML = '';
        S.tax.bands.forEach(function (bd, i) {
          var row = h('div', 'bq-band'), from = i ? S.tax.bands[i - 1][0] : 0;
          row.appendChild(h('span', 'bq-band-from', i && (from === '' || from == null) ? '' : 'From ' + money(from || 0) + ' up to'));
          var up = h('input'), rate = h('input'), x = h('button', 'bq-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove this band');
          up.setAttribute('inputmode', 'decimal'); rate.setAttribute('inputmode', 'decimal'); up.placeholder = 'no limit'; up.setAttribute('aria-label', 'Band ' + (i + 1) + ' up to (£)'); rate.setAttribute('aria-label', 'Band ' + (i + 1) + ' rate (%)');
          up.value = bd[0] === '' ? '' : String(bd[0]); rate.value = String(bd[1]);
          up.oninput = function () { var v = up.value.replace(/[^0-9.]/g, ''); bd[0] = v === '' ? '' : Number(v); change(); };
          up.onblur = draw;
          rate.oninput = function () { var v = rate.value.replace(/[^0-9.]/g, ''); bd[1] = v === '' ? 0 : Number(v); change(); };
          x.onclick = function () { S.tax.bands.splice(i, 1); change(); draw(); };
          var u = h('span', 'bq-band-in'); u.appendChild(h('span', 'u', '£')); u.appendChild(up);
          var r = h('span', 'bq-band-in'); r.appendChild(rate); r.appendChild(h('span', 'u', '%'));
          row.appendChild(u); row.appendChild(r); row.appendChild(x); list.appendChild(row);
        });
        var add = h('button', 'bq-add', '+ Add a band'); add.type = 'button';
        add.onclick = function () { S.tax.bands.push(['', 0]); change(); draw(); }; list.appendChild(add);
        var sur = h('div', 'u9-card bq-sur');
        field(sur, 'Additional property surcharge', 'Added on the WHOLE price when the buyer already owns a home (or buys through a company).', S.tax, 'surchargePct', '%');
        field(sur, 'Surcharge starts at', 'No surcharge below this price.', S.tax, 'surchargeFrom', '£');
        list.appendChild(sur);
        var back = h('button', 'bq-add', 'Back to the app’s rates'); back.type = 'button';
        back.onclick = function () { S.tax = null; change(); S.tax = JSON.parse(JSON.stringify(B.defaultTax(ctx.Calc))); draw(); }; list.appendChild(back);
      };
      draw();
    });
  }

  // ---- the screen ----
  function render(el) {
    box = el; S = S || loadState(); R = []; box.innerHTML = ''; box.className = 'u9 bq';
    pinned(); project(); S.quotes.forEach(function (q, i) { quoteCard(q, i); });
    var add = h('button', 'bq-add bq-addq', '+ Add another quote'); add.type = 'button';
    add.onclick = function () { S.quotes.push(blankQuote()); save(); rebuild(); }; box.appendChild(add);
    comparison(); maxBidCard();
    box.appendChild(h('p', 'u9-note', 'Interest is simple monthly interest from the day each amount is drawn. Estimates only, not financial advice: ask your broker to confirm every figure. Kept on this phone.'));
    refresh();
  }
  function pinned() {
    var pin = h('div', 'pin u9-pin bq-pin'), head = h('div', 'pin-head'), back = h('button', 'pin-back'), reset = h('button', 'u9-clear', 'Start again');
    back.type = 'button'; reset.type = 'button'; back.setAttribute('aria-label', 'Back');
    back.appendChild(h('span', 'chev', '‹')); back.appendChild(h('span', 'pin-title', 'Bridging quotes')); back.onclick = ctx.goBack;
    reset.onclick = function () { if (window.confirm('Clear the project and every quote?')) { S = start(); save(); rebuild(); } };
    head.appendChild(back); head.appendChild(reset); pin.appendChild(head);
    var eye = h('div', 'pin-eye'), row = h('div', 'pin-row'), fig = h('div', 'pin-fig fig'), side = h('div', 'pin-side'), sFig = h('div', 'pin-side-fig fig'), sCap = h('div', 'pin-side-cap');
    side.appendChild(sFig); side.appendChild(sCap); row.appendChild(fig); row.appendChild(side); pin.appendChild(eye); pin.appendChild(row);
    var cap = h('div', 'hb-cap'); pin.appendChild(cap); box.appendChild(pin);
    R.push(function () {
      var c = B.compare(S.p, S.quotes, cfg(), S.threshold), ok = entered() && c.cheapest;
      eye.textContent = ok ? 'Cheapest finance · ' + c.cheapest.name : 'Cheapest finance';
      fig.textContent = ok ? money(c.cheapest.r.totalCost) : '—';
      sFig.textContent = ok ? money(c.leastCash.r.required) : '—'; sCap.textContent = ok ? 'Least own cash · ' + c.leastCash.name : 'Least own cash';
      cap.textContent = ok ? (c.alerts.some(function (a) { return a.level === 'bad'; }) ? '⚠ ' + c.alerts.filter(function (a) { return a.level === 'bad'; }).length + (c.alerts.filter(function (a) { return a.level === 'bad'; }).length > 1 ? ' quotes leave' : ' quote leaves') + ' you short: see below.' : 'Most money left: ' + c.mostLeft.name + ', ' + money(c.mostLeft.r.moneyLeft) + '.')
        : 'Enter the purchase price and a quote to compare.';
    });
  }
  function project() {
    var hd = h('div', 'lg-hrow bq-hrow'); hd.appendChild(h('p', 'lg-h', 'The project'));
    var use = h('button', 'lg-link', 'Use my calculator deal'); use.type = 'button';
    use.onclick = function () { var d = ctx.deal(); ['price', 'refurb', 'legal', 'endValue'].forEach(function (k) { var v = d[k === 'price' ? 'purchasePrice' : k]; if (Number(v) > 0) S.p[k] = Number(v); }); save(); rebuild(); };
    hd.appendChild(use); box.appendChild(hd);
    var p = S.p, c = h('section', 'u9-card');
    field(c, 'Purchase price', 'What you agree to pay for the property.', p, 'price', '£');
    field(c, 'Refurb cost', 'The works, before any contingency.', p, 'refurb', '£');
    seg(c, 'Contingency as', p, 'contMode', [['£', 'An amount (£)'], ['%', '% of the refurb']], 'Money set aside for surprises in the works. It is in your own cash and in the costs.');
    var ct = field(c, 'Contingency', null, p, 'cont', p.contMode === '%' ? '%' : '£', { id: 'cont' });
    R.push(function () { ct.sub.textContent = p.contMode === '%' && Number(p.cont) > 0 ? '= ' + money(Number(p.refurb || 0) * Number(p.cont) / 100) : ''; });
    field(c, 'Cash you have available', 'All the money you can put in, for the deposit, fees, works and interest.', p, 'cash', '£');
    field(c, 'Auction fees', 'Buyer’s premium, admin fee and the like. Leave blank if it is not an auction.', p, 'auction', '£');
    field(c, 'Your solicitor’s legal fees', 'Your own conveyancing. The lender’s legal fees go in the quote’s fees.', p, 'legal', '£');
    box.appendChild(c);
    // stamp duty
    box.appendChild(h('p', 'lg-h', 'Stamp duty'));
    var sd = h('section', 'u9-card');
    seg(sd, 'Rates', p, 'additional', [[false, 'Standard'], [true, 'Additional property']], 'Additional property: you already own a home, or buy through a company. It adds the surcharge on the whole price.', true);
    var mode = h('div', 'hb-sd'), sdTxt = h('span', '', 'Stamp duty'), sdVal = h('b', 'fig'); mode.appendChild(sdTxt); mode.appendChild(sdVal); sd.appendChild(mode);
    var acts = h('div', 'bq-acts'), ov = h('button', 'lg-link', p.sdltOverride ? 'Work it out for me' : 'Type it myself'), eb = h('button', 'lg-link', 'Edit the bands');
    ov.type = 'button'; eb.type = 'button'; ov.onclick = function () { p.sdltOverride = !p.sdltOverride; save(); rebuild(); }; eb.onclick = openBands;
    acts.appendChild(ov); acts.appendChild(eb); sd.appendChild(acts);
    if (p.sdltOverride) field(sd, 'Stamp duty (typed)', 'Use the figure your solicitor gave you.', p, 'sdltManual', '£');
    R.push(function () { var t = B.quote(p, {}, cfg()).sdlt; sdVal.textContent = entered() || p.sdltOverride ? money(t) : '—'; sdTxt.textContent = p.sdltOverride && p.sdltManual !== '' ? 'Stamp duty (typed)' : 'Stamp duty (worked out)'; });
    box.appendChild(sd);
    // the exit
    box.appendChild(h('p', 'lg-h', 'The exit'));
    var ex = h('section', 'u9-card');
    field(ex, 'End value', 'What it is worth after the works (the sale price, or the refinance valuation).', p, 'endValue', '£');
    seg(ex, 'Exit by', p, 'exit', [['sale', 'Selling it'], ['refinance', 'Refinancing']], 'How the bridge is paid off at the end.');
    if (p.exit === 'sale') field(ex, 'Selling costs', 'Agent and legal fees when you sell.', p, 'selling', '£');
    field(ex, 'Expected term', 'How long you expect to keep the bridge. A quote’s own term, if typed, is used for that quote.', p, 'term', 'months');
    box.appendChild(ex);
  }

  function quoteCard(q, i) {
    var hd = h('div', 'lg-hrow bq-hrow'), title = h('p', 'lg-h', qName(q, i)); hd.appendChild(title);
    var tools = h('span', 'bq-tools'), dup = h('button', 'lg-link', 'Duplicate'), rm = h('button', 'lg-link bq-rm', 'Remove'); dup.type = 'button'; rm.type = 'button';
    dup.onclick = function () { var c = JSON.parse(JSON.stringify(q)); c.name = qName(q, i) + ' (copy)'; S.quotes.splice(i + 1, 0, c); save(); rebuild(); };
    rm.onclick = function () { if (S.quotes.length > 1 ? window.confirm('Remove ' + qName(q, i) + '?') : false) { S.quotes.splice(i, 1); if (S.mb.i >= S.quotes.length) S.mb.i = 0; save(); rebuild(); } };
    rm.hidden = S.quotes.length < 2; tools.appendChild(dup); tools.appendChild(rm); hd.appendChild(tools); box.appendChild(hd);
    var c = h('section', 'u9-card bq-quote');
    // name and structure
    var nf = h('div', 'u9-field bq-f'), nl = h('label', 'bq-namel', 'Lender'), ni = h('input', 'bq-name'), nid = 'bq-name-' + i; nl.setAttribute('for', nid); ni.id = nid; ni.placeholder = 'Lender name';
    ni.value = q.name || ''; ni.oninput = function () { q.name = ni.value; title.textContent = qName(q, i); change(); }; nf.appendChild(nl); nf.appendChild(ni); c.appendChild(nf);
    seg(c, 'Structure', q, 'structure', [['A', 'A · Day one only'], ['B', 'B · Works in arrears'], ['C', 'C · Works up front']],
      'A: one loan on day one; you pay for the works yourself. B: the lender releases the works money in stages after each stage is done, so you pay for each stage first. C: the works money is released on day one with the purchase.');
    seg(c, 'The loan figures', q, 'mode', [['quoted', 'As quoted (net / gross)'], ['derive', 'From the LTV']],
      'As quoted: type the net (paid out) and gross (owed) from the lender’s offer. From the LTV: the loan is that % of the price, and the fees and retained interest are worked out from it.');
    if (q.mode === 'derive') {
      field(c, 'Loan to value (day one)', 'The day-one loan as a % of the purchase price, before fees.', q, 'ltv', '%');
    } else {
      field(c, 'Net advance (day one)', 'What the lender actually pays out at completion, after its deductions.', q, 'net', '£');
      field(c, 'Gross loan', 'Everything you owe the lender at the start' + ' (including any refurb facility on B or C).', q, 'gross', '£');
      var ir = h('label', 'bq-check'), cb = h('input'); cb.type = 'checkbox'; cb.checked = !!q.inclRolled; cb.onchange = function () { q.inclRolled = cb.checked; change(); };
      ir.appendChild(cb); ir.appendChild(h('span', '', 'The gross already includes the rolled-up interest')); c.appendChild(ir);
    }
    if (q.structure !== 'A') {
      field(c, 'Refurb facility', 'The most the lender will release for the works. Only what the works need is drawn; the rest is not counted.', q, 'facility', '£');
      if (q.structure === 'B') {
        seg(c, 'How the works money comes', q, 'drawMode', [['stages', 'In equal stages'], ['upfront', 'You fund a % first']], 'In stages: you pay for each stage, then the lender repays it. You fund a %: you pay that share of the works before the first release.');
        field(c, 'Works take', 'How long the works take. The releases are spread over this time, and interest on each starts when it is paid.', q, 'refurbMonths', 'months');
        if (q.drawMode === 'upfront') field(c, 'You fund first', 'The share of the refurb you pay before the lender releases anything.', q, 'upfrontPct', '%');
        else field(c, 'Number of stages', 'How many releases (drawdowns) of the works money.', q, 'stages', '', { placeholder: '1' });
      }
    }
    field(c, 'Interest rate', 'The monthly rate from the quote (for example 0.85).', q, 'rate', '%/mo');
    seg(c, 'Interest', q, 'interest', [['retained', 'Retained'], ['rolled', 'Rolled up'], ['serviced', 'Paid monthly']],
      'Retained: kept back from the advance up front. Rolled up: added to the loan and repaid at the end. Paid monthly (serviced): you pay it each month from your own cash.', true);
    var tf = field(c, 'Term', 'The quote’s term. Leave blank to use the project’s expected term.', q, 'term', 'months');
    R.push(function () { tf.input.placeholder = S.p.term !== '' && S.p.term != null ? String(S.p.term) : '—'; tf.sub.textContent = q.term === '' || q.term == null ? (S.p.term !== '' && S.p.term != null ? 'Using the expected term' : '') : ''; });
    var sec = h('div', 'u9-field bq-f'), sl = h('label', 'bq-namel', 'Security'), si = h('input', 'bq-name'), sid = 'bq-sec-' + i; sl.setAttribute('for', sid); si.id = sid;
    si.placeholder = 'e.g. Purchase property only'; si.value = q.security || ''; si.oninput = function () { q.security = si.value; change(); };
    var st = tip('What the lender takes a charge over. If it includes another property (your home, say), that property is at risk too.'); sl.appendChild(st.b);
    sec.appendChild(sl); sec.appendChild(si); sec.appendChild(st.p); c.appendChild(sec);
    // fees
    c.appendChild(h('div', 'bq-sub', 'Fees'));
    q.fees.forEach(function (f, j) { feeRow(c, q, f, j); });
    var af = h('button', 'bq-add', '+ Add a fee'); af.type = 'button'; af.onclick = function () { q.fees.push({ name: '', amount: '', unit: '£', basis: 'gross', pay: 'cash', estimate: false }); save(); rebuild(); };
    c.appendChild(af);
    // results
    var res = h('div', 'bq-res'), rl = h('div', 'fund11-rows'), warn = h('ul', 'bq-warn'), risk = h('ul', 'bq-risk'); res.appendChild(h('div', 'bq-sub', 'What it costs, what you put in'));
    res.appendChild(rl); var cashB = fold(res, 'your cash line by line'), cashR = h('div', 'fund11-rows'); cashB.appendChild(cashR); res.appendChild(risk); res.appendChild(warn); c.appendChild(res);
    R.push(function () {
      var r = B.quote(S.p, q, cfg());
      if (!entered()) { rows(rl, [['Enter the purchase price above', '—']]); rows(cashR, []); warn.innerHTML = ''; risk.innerHTML = ''; return; }
      var short = r.headroom < 0;
      rows(rl, [
        ['Funds received (paid out' + (r.drawn > 0 ? ', incl. ' + money(r.drawn) + ' for the works' : '') + ')', money(r.received)],
        ['Repaid to the lender at the end', money(r.repay)],
        ['Total cost of the finance', money(r.totalCost), 'f-sum'],
        ['… as a share of the funds received', pct(r.costPct != null ? r.costPct * 100 : null, 2)],
        ['… per month', r.perMonth != null ? money(r.perMonth) : '—'],
        ['Your own cash needed', money(r.required), 'f-own'],
        r.structure === 'B' && r.prefund > 0 ? ['Peak cash need (paying a stage before its release)', money(r.peak), r.peak > Number(S.p.cash || 0) ? 'bq-bad' : ''] : null,
        [short ? 'Short by' : 'Headroom (cash to spare)', money(Math.abs(r.headroom)), short ? 'bq-bad' : 'bq-ok'],
        ['Back from the ' + (S.p.exit === 'sale' ? 'sale' : 'refinance') + ' after repaying', money(r.cashBack)],
        ['Money left at the end', money(r.moneyLeft)],
        ['Profit', money(r.profit) + (Math.abs(r.profit - r.profitCheck) < 1 ? ' ✓' : ' ?'), r.profit >= 0 ? 'bq-ok' : 'bq-bad']
      ]);
      rows(cashR, [
        ['Deposit (price less the net advance)', money(r.deposit)], ['Stamp duty', money(r.sdlt)],
        r.auction > 0 ? ['Auction fees', money(r.auction)] : null, r.legal > 0 ? ['Your legal fees', money(r.legal)] : null,
        r.feeCash > 0 ? ['Fees paid from your cash', money(r.feeCash)] : null,
        r.userRefurb > 0 ? ['Refurb you pay' + (r.structure === 'A' ? '' : ' (more than the facility)'), money(r.userRefurb)] : null,
        r.cont > 0 ? ['Contingency', money(r.cont)] : null, r.serviced > 0 ? ['Interest paid monthly', money(r.serviced)] : null,
        ['Your own cash needed', money(r.required), 'f-own'],
        r.feeAdded > 0 ? ['Fees added to the loan (in the gross, not your cash)', money(r.feeAdded)] : null,
        r.feeDeducted > 0 ? ['Fees taken off the advance (in the net, not your cash)', money(r.feeDeducted)] : null,
        r.retained > 0 ? ['Interest retained by the lender', money(r.retained)] : null,
        r.rolled > 0 ? ['Interest rolled up, repaid at the end', money(r.rolled)] : null,
        r.feeExit > 0 ? ['Fees paid at the end', money(r.feeExit)] : null,
        ['Profit check: end value − every cost − the finance', money(r.profitCheck)]
      ]);
      risk.innerHTML = ''; r.risks.forEach(function (t) { risk.appendChild(h('li', '', t)); });
      warn.innerHTML = ''; r.warnings.forEach(function (t) { warn.appendChild(h('li', '', t)); });
    });
    box.appendChild(c);
  }
  function feeRow(c, q, f, j) {
    var w = h('div', 'bq-fee'), top = h('div', 'bq-fee-top'), name = h('input', 'bq-name'), x = h('button', 'bq-x', '×');
    name.setAttribute('list', 'bq-presets'); name.placeholder = 'Fee name (pick or type)'; name.value = f.name || ''; name.setAttribute('aria-label', 'Fee name');
    name.oninput = function () { f.name = name.value; change(); };
    x.type = 'button'; x.setAttribute('aria-label', 'Remove this fee'); x.onclick = function () { q.fees.splice(j, 1); save(); rebuild(); };
    top.appendChild(name); top.appendChild(x); w.appendChild(top);
    var amt = field(w, 'Amount', null, f, 'amount', f.unit === '%' ? '%' : '£', { id: 'fee' + j, placeholder: 'blank' });
    seg(w, 'Charged as', f, 'unit', [['£', '£ amount'], ['%', '% of a figure']]);
    if (f.unit === '%') seg(w, 'A % of', f, 'basis', [['gross', 'Gross loan'], ['net', 'Net advance'], ['facility', 'Whole facility']]);
    seg(w, 'Paid', f, 'pay', [['cash', 'From your cash'], ['added', 'Added to loan'], ['deducted', 'Off the advance'], ['exit', 'At the end']],
      'From your cash: paid up front by you. Added to the loan: increases what you owe. Off the advance: the lender pays out less. At the end: paid with the loan from the sale or refinance. Added and deducted fees are counted once, in the gap between what you get and what you repay.', true);
    var est = h('label', 'bq-check'), cb = h('input'); cb.type = 'checkbox'; cb.checked = !!f.estimate; cb.onchange = function () { f.estimate = cb.checked; change(); };
    est.appendChild(cb); est.appendChild(h('span', '', 'This is an estimate (confirm with the broker)')); w.appendChild(est);
    R.push(function () { var r = B.quote(S.p, q, cfg()), l = r.fees[j]; amt.sub.textContent = l && f.unit === '%' ? '= ' + money(l.amount) : ''; });
    c.appendChild(w);
  }

  function comparison() {
    box.appendChild(h('p', 'lg-h', 'Compare the quotes'));
    var c = h('section', 'u9-card bq-cmp');
    field(c, 'Warn me when the cash to spare is under', 'A safety margin: any quote that leaves you less than this is flagged.', S, 'threshold', '£');
    var wrap = h('div', 'bq-tw'), tbl = h('table', 'bq-table'); wrap.appendChild(tbl); wrap.setAttribute('tabindex', '0'); wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'Quotes side by side');
    c.appendChild(wrap); var wins = h('div', 'bq-wins'), alerts = h('ul', 'bq-warn bq-alerts'); c.appendChild(wins); c.appendChild(alerts); box.appendChild(c);
    R.push(function () {
      tbl.innerHTML = ''; wins.innerHTML = ''; alerts.innerHTML = '';
      if (!entered()) { wins.appendChild(h('p', 'hb-note', 'Enter the purchase price to compare.')); return; }
      var cmp = B.compare(S.p, S.quotes, cfg(), S.threshold), bad = {};
      cmp.alerts.forEach(function (a) { if (a.level === 'bad') bad[a.i] = 1; });
      var hr = h('tr'); hr.appendChild(h('th', '', '')); cmp.rows.forEach(function (x) { hr.appendChild(h('th', bad[x.i] ? 'bq-bad' : '', x.name)); }); tbl.appendChild(hr);
      var line = function (label, f, win, cls) {
        var tr = h('tr'); tr.appendChild(h('th', '', label));
        cmp.rows.forEach(function (x) { var td = h('td', 'fig' + (win && win.i === x.i && cmp.rows.length > 1 ? ' bq-win' : '') + (cls ? ' ' + cls(x.r) : ''), f(x.r) + (win && win.i === x.i && cmp.rows.length > 1 ? ' ★' : '')); tr.appendChild(td); });
        tbl.appendChild(tr);
      };
      line('Structure', function (r) { return r.structure; });
      line('Funds received', function (r) { return money(r.received); });
      line('Finance cost', function (r) { return money(r.totalCost); }, cmp.cheapest);
      line('… of funds', function (r) { return pct(r.costPct != null ? r.costPct * 100 : null, 2); });
      line('… a month', function (r) { return r.perMonth != null ? money(r.perMonth) : '—'; });
      line('Own cash needed', function (r) { return money(r.required); }, cmp.leastCash);
      if (cmp.rows.some(function (x) { return x.r.structure === 'B' && x.r.prefund > 0; })) line('Peak cash need', function (r) { return r.structure === 'B' ? money(r.peak) : '—'; });
      line('Headroom', function (r) { return money(r.headroom); }, null, function (r) { return r.headroom < 0 ? 'bq-bad' : ''; });
      line('Money left at the end', function (r) { return money(r.moneyLeft); }, cmp.mostLeft);
      line('Profit', function (r) { return money(r.profit); }, null, function (r) { return r.profit < 0 ? 'bq-bad' : ''; });
      if (cmp.rows.length > 1) {
        [['Cheapest finance', cmp.cheapest, 'totalCost'], ['Least own cash', cmp.leastCash, 'required'], ['Most money left at the end', cmp.mostLeft, 'moneyLeft']].forEach(function (w) {
          if (!w[1]) return; var d = h('div', 'fund11-row'); d.appendChild(h('span', '', '★ ' + w[0])); d.appendChild(h('b', '', w[1].name + ' · ' + money(w[1].r[w[2]]))); wins.appendChild(d);
        });
      }
      cmp.alerts.forEach(function (a) { alerts.appendChild(h('li', a.level === 'bad' ? 'bq-badli' : '', a.text)); });
    });
  }

  function maxBidCard() {
    box.appendChild(h('p', 'lg-h', 'Maximum bid'));
    var c = h('section', 'u9-card bq-mb'), mb = S.mb;
    c.appendChild(h('p', 'hb-note bq-lede', 'The most you could pay and still make your target profit, with stamp duty worked out again at every price. Leave a target blank to skip it.'));
    if (S.quotes.length > 1) {
      var q = h('div', 'ab10-q bq-q'), sg = h('div', 'bq-pick'); q.appendChild(h('div', 'ab10-l', 'Using the quote')); sg.setAttribute('role', 'group'); sg.setAttribute('aria-label', 'Using the quote');
      S.quotes.forEach(function (x, i) { var b = h('button', '', qName(x, i)); b.type = 'button'; b.setAttribute('aria-pressed', String(mb.i === i)); b.onclick = function () { mb.i = i; save(); rebuild(); }; sg.appendChild(b); });
      q.appendChild(sg); c.appendChild(q);
    }
    seg(c, 'The loan as the price changes', mb, 'keepLoan', [[true, 'Stays as quoted'], [false, 'Scales (same LTV)']], 'Stays as quoted: the loan amounts do not change with your bid. Scales: the loan stays the same % of the price, so it grows or shrinks with the bid (a quote worked out from the LTV always follows the bid).', true);
    field(c, 'Round down to the nearest', 'For example 250 or 1,000: the bid is rounded down to this.', mb, 'step', '£', { placeholder: '1' });
    var tg = [['gbp', 'Target profit', '£', 'A fixed profit in pounds.'], ['gdv', 'Target profit, % of end value', '%', 'Profit as a share of the end value (GDV).'], ['cost', 'Target profit, % of total cost', '%', 'Profit as a share of everything you spend, the finance included. 20% of cost is a smaller profit than 20% of the end value.']];
    var outs = {};
    tg.forEach(function (t) {
      field(c, t[1], t[3], mb, t[0], t[2]);
      var o = h('div', 'bq-mbr'), line = h('div', 'fund11-row f-own'), lab = h('span'), val = h('b', 'fig'); line.appendChild(lab); line.appendChild(val); o.appendChild(line);
      var body = fold(o, 'the breakdown at this bid'), rr = h('div', 'fund11-rows'); body.appendChild(rr); o.hidden = true; c.appendChild(o); outs[t[0]] = { o: o, lab: lab, val: val, rr: rr };
    });
    box.appendChild(c);
    R.push(function () {
      var q = S.quotes[mb.i] || S.quotes[0];
      tg.forEach(function (t) {
        var o = outs[t[0]], v = mb[t[0]];
        if (v === '' || v == null || !entered()) { o.o.hidden = true; return; }
        o.o.hidden = false;
        var res = B.maxBid(S.p, q, cfg(), { kind: t[0], value: v }, { step: mb.step, keepLoan: mb.keepLoan });
        if (!res) { o.lab.textContent = 'No price reaches this target'; o.val.textContent = '—'; rows(o.rr, []); return; }
        var r = res.result;
        o.lab.textContent = 'Max bid for ' + money(res.targetProfit) + ' profit'; o.val.textContent = money(res.price);
        rows(o.rr, [['Purchase price', money(r.price)], ['Stamp duty at this price', money(r.sdlt)], r.auction > 0 ? ['Auction fees', money(r.auction)] : null,
          r.legal > 0 ? ['Your legal fees', money(r.legal)] : null, ['Refurb', money(r.refurb)], r.cont > 0 ? ['Contingency', money(r.cont)] : null,
          r.selling > 0 ? ['Selling costs', money(r.selling)] : null, ['Finance cost', money(r.totalCost)], ['Total cost', money(r.costs + r.totalCost), 'f-sum'],
          ['End value', money(r.endValue)], ['Profit', money(r.profit), 'f-own'], ['Your own cash needed', money(r.required)],
          [r.headroom < 0 ? 'Short by' : 'Headroom', money(Math.abs(r.headroom)), r.headroom < 0 ? 'bq-bad' : '']]);
      });
    });
  }

  // the fee presets, once, for every fee name box
  function presets() {
    if (document.getElementById('bq-presets')) return;
    var dl = document.createElement('datalist'); dl.id = 'bq-presets';
    B.FEE_PRESETS.forEach(function (n) { var o = document.createElement('option'); o.value = n; dl.appendChild(o); });
    document.body.appendChild(dl);
  }
  return { render: function (el) { presets(); S = loadState(); render(el); } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = BridgeUI;

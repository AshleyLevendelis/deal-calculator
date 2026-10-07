(function () {
  var DEALS = 'deal-analyser:deals', DEAL = 'deal-analyser:deal';
  var THEME = 'deal-analyser:theme', EXPLAIN = 'deal-analyser:explanations', PERSONA = 'deal-analyser:persona';
  var LETTING = 'deal-analyser:lettingType', ONBOARDED = 'deal-analyser:onboarded', REPORT = 'deal-analyser:report';
  var $ = function (id) { return document.getElementById(id); };
  var gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
  var gbp2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 });
  var money = function (v) { return (v < 0 ? '-' : '') + gbp.format(Math.abs(v)); };
  var money2 = function (v) { return (v < 0 ? '-' : '') + gbp2.format(Math.abs(v)); };
  function fmt(f, v) {
    if (v == null) return '—';
    if (typeof v === 'string') return v;
    if (f === 'gbp') return money(v);
    if (f === 'gbp2') return money2(v);
    if (f === 'pct') return (v * 100).toFixed(1) + '%';
    if (f === 'months') return (Math.round(v * 10) / 10) + ' months';
    return String(v);
  }
  function load(k, d) { try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function tone(el, v) {
    el.classList.remove('good', 'bad');
    if (typeof v === 'number' && v !== 0) el.classList.add(v > 0 ? 'good' : 'bad');
  }
  // The person's own targets and stamp duty setting (Settings and the Calculator). Applied before anything is drawn;
  // every verdict, colour and label then reads them from calc.js.
  var TARGETS_STORE = 'deal-analyser:targets', TAX_STORE = 'deal-analyser:tax';
  Calc.setTargets(load(TARGETS_STORE, null) || {}); Calc.setTax(load(TAX_STORE, null) || {});
  function flipPct() { return Calc.targets().flip + '%'; }
  // Flip net profit: green at the flip target or more, amber ('ok') from 5 points under it, red below. A mark goes with
  // each colour (✓ ~ ✗) so it does not rely on colour alone. flipCls turns the verdict into the colour class.
  function flipOkPct() { return Calc.flipOkFrom() + '%'; }
  function flipCls(m) { var v = Calc.flipVerdict(m); return v === 'ok' ? 'amber' : v || ''; }
  function roiPct() { return Calc.targets().roi + '%'; }
  function flipMarginText(m) { var t = fmt('pct', m), v = Calc.flipVerdict(m); return v === 'good' ? t + ' ✓' : v === 'bad' ? t + ' ✗' : v === 'ok' ? t + ' ~' : t; }
  function setVerdict(el, m) { el.classList.remove('good', 'bad', 'amber'); var c = flipCls(m); if (c) el.classList.add(c); }
  function flipNote(v) { return v === 'good' ? ' (meets the ' + flipPct() + ' target)' : v === 'ok' ? ' (OK: between ' + flipOkPct() + ' and the ' + flipPct() + ' target)' : v === 'bad' ? ' (thin, below ' + flipOkPct() + ')' : ''; }
  // ROI on cash left in: green at the target (50% to start) or more, red below. A tick or cross goes with the colour so it does not rely on colour alone.
  function cashRoiText(r) { var t = fmt('pct', r), v = Calc.cashRoiVerdict(r); return typeof r === 'number' ? (v === 'good' ? t + ' \u2713' : v === 'bad' ? t + ' \u2717' : t) : t; }
  function setCashRoi(el, r) { el.classList.remove('good', 'bad', 'amber'); var v = Calc.cashRoiVerdict(r); if (v) el.classList.add(v); }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  // ---- Settings: theme, explanations, persona, letting type -------------------------------------------
  function theme() { return load(THEME, 'system'); }
  function applyTheme() {
    var t = theme();
    if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  }
  function explanationsOn() { var v = load(EXPLAIN, null); return v == null ? load(PERSONA, '') === 'new' : !!v; }
  var PERSONAS = [
    ['new', "I'm new to property", 'Plain-English explanations next to every result.'],
    ['invest', 'I invest already', 'Just the numbers, laid out to scan fast.'],
    ['source', 'I source deals for clients', 'Client-ready reports with your name on them.']
  ];
  var LETTINGS = [['single', 'Single let', ['btl']], ['hmo', 'By the room (HMO)', ['hmo', 'hmobrr', 'r2rhmo']], ['sa', 'Nightly (SA)', ['sabtl', 'sabrr', 'r2rsa']], ['unsure', 'Not sure yet', []]];

  // The deal is only what the person has typed. Every calculator reads it, so a value entered once
  // appears in every calculator that has that field. Anything not typed shows the sheet's example.
  var deal = load(DEAL, {});
  var current = null, nodes = {};
  // The figures reused on every deal (legal costs, LTV...). Stored apart from the deal, applied under whatever is typed.
  var USUAL_KEY = 'deal-analyser:usual', usual = load(USUAL_KEY, {});
  function eff(d) { return Calc.withUsual(d, usual); }

  function newDeal() {
    if (Object.keys(deal).length && !confirm('Clear the details you have entered and start a new deal?')) return;
    deal = {}; store(DEAL, deal); route();
  }

  // A note on a saved deal (viewing booked, what the agent said...), kept with the deal on this phone.
  function noteArea(initial, onChange) {
    var ta = h('textarea', 'note-input'); ta.rows = 3; ta.placeholder = 'Viewing booked, what the agent said, things to check...'; ta.value = initial || '';
    ta.setAttribute('aria-label', 'Notes'); ta.addEventListener('input', function () { onChange(ta.value); }); return ta;
  }
  function ledgerRow(label, value, cls) {
    var row = h('div', 'calc'); row.appendChild(h('span', '', label)); row.appendChild(h('b', 'fig' + (cls ? ' ' + cls : ''), value)); return row;
  }
  // ---- Calculators list --------------------------------------------------------------------------
  function exampleCount(c, only) {
    var n = 0; c.layout.forEach(function (sec) { sec.items.forEach(function (it) {
      var id = it.field ? it.field.id : it.choice ? it.choice.id : null;
      if (only && only.indexOf(id) < 0) return;
      if (id && !Object.prototype.hasOwnProperty.call(deal, id) && !(Object.prototype.hasOwnProperty.call(usual, id) && usual[id] !== '')) n++;
    }); });
    return n;
  }
  // ---- The Calculator tab: one screen, a strategy picker, the result, then the figures ------------------------
  // The design's picker plus HMO BTL and SA BTL, which it leaves out. "brr" is the flip calculator read as a refinance.
  var STRATS = [
    { key: 'brr', name: 'Calculator', calc: 'flip' }, { key: 'recycle', name: 'Max price', calc: 'recycle' },
    { key: 'btl', name: 'BTL', calc: 'btl' }, { key: 'hmo', name: 'HMO BTL', calc: 'hmo' }, { key: 'sabtl', name: 'SA BTL', calc: 'sabtl' },
    { key: 'r2rhmo', name: 'R2R HMO', calc: 'r2rhmo' }, { key: 'r2rsa', name: 'R2R SA', calc: 'r2rsa' }, { key: 'bridging', name: 'Bridging', calc: 'bridging' }
  ];
  var MAIN_STRATS = ['brr', 'recycle'], stratMore = false;
  // One plain sentence per strategy, so the abbreviations never have to be known.
  var STRAT_HELP = {
    recycle: 'Max price: the most you can pay and still get all your money back when you refinance.',
    brr: 'Five figures give both answers: what a refinance leaves in the deal (BRR) and the profit if you sell (flip). Add a strategy below for the rental return.',
    btl: 'BTL (buy to let): a normal rental bought with a mortgage.',
    hmo: 'HMO BTL: a house let by the room, bought with a mortgage.',
    sabtl: 'SA BTL: serviced accommodation (nightly lets), bought with a mortgage.',
    r2rhmo: 'R2R HMO (rent to rent): you rent the house and let it by the room.',
    r2rsa: 'R2R SA (rent to rent): you rent the house and run it as nightly lets.',
    bridging: 'Bridging: a short-term loan used to buy and refurbish.'
  };
  // BRR: after the refinance, how it will be let. Chosen from a dropdown; the rental figures asked for follow the choice.
  var LET_KEY = 'deal-analyser:brrlet', brrLet = load(LET_KEY, 'none');
  if (!Calc.BRR_LETTING.hasOwnProperty(brrLet)) brrLet = 'none';
  function setLet(v) { brrLet = v; store(LET_KEY, v); }
  // The three refinance calculators now live inside BRR. Anything that points at one of them lands there with its letting type chosen.
  function goCalc(id) {
    var l = id === 'flip' ? 'btl' : id === 'hmobrr' ? 'hmo' : id === 'sabrr' ? 'sa' : null;
    if (l) { setLet(l); location.hash = '#c/brr'; } else location.hash = '#c/' + id;
  }
  var STRAT_KEY = 'deal-analyser:strategy', calcKey = load(STRAT_KEY, null), offerText = '';
  function stratByKey(k) { return STRATS.filter(function (x) { return x.key === k; })[0]; }
  // What each strategy shows up top: a one-line description, the headline figure and three result rows.
  var RESULTS = {
    btl: { desc: 'A standard mortgaged rental', hero: { key: 'roi', kind: 'roi', cap: 'Return on money in' }, rows: [['Monthly profit', 'monthly', 'gbp2', true], ['Money in', 'totalIn', 'gbp'], ['Breakeven', 'breakeven', 'months']] },
    hmo: { desc: 'Let by the room, with a mortgage', hero: { key: 'roi', kind: 'roi', cap: 'Return on money in' }, rows: [['Monthly profit', 'monthly', 'gbp2', true], ['Money in', 'totalIn', 'gbp'], ['Breakeven', 'breakeven', 'months']] },
    sabtl: { desc: 'Nightly lets, with a mortgage', hero: { key: 'roi', kind: 'roi', cap: 'Return on money in' }, rows: [['Monthly profit', 'monthly', 'gbp2', true], ['Money in', 'totalIn', 'gbp'], ['Breakeven', 'breakeven', 'months']] },
    sabrr: { desc: 'Refurb, refinance, nightly lets', hero: { key: 'roi', kind: 'cashroi', cap: 'ROI on cash left in' }, rows: [['Left in after refinance', 'cashLeft', 'gbp'], ['Monthly profit', 'monthly', 'gbp2', true], ['New mortgage', 'newMortgage', 'gbp']] },
    r2rhmo: { desc: 'Rent it, let by the room', hero: { key: 'roi', kind: 'roi', cap: 'Return on money in' }, rows: [['Monthly profit', 'monthly', 'gbp2', true], ['Money in', 'totalIn', 'gbp'], ['Breakeven', 'breakeven', 'months']] },
    r2rsa: { desc: 'Rent it, run as serviced accommodation', hero: { key: 'roi', kind: 'roi', cap: 'Return on money in' }, rows: [['Monthly profit', 'monthly', 'gbp2', true], ['Money in', 'totalIn', 'gbp'], ['Breakeven', 'breakeven', 'months']] },
    bridging: { desc: 'Short-term loan to buy and refurb', hero: { key: 'totalCost', kind: 'cost', cap: 'Total cost of the loan' }, rows: [['Interest', 'totalInterest', 'gbp'], ['Net advance', 'netAdvance', 'gbp'], ['Repaid at the end', 'redemption', 'gbp']] }
  };
  // BRR result: before a letting type is chosen it is the refinance on its own (cash left in or pulled out);
  // once one is chosen it is the return on the cash left in, with the rent figures behind it.
  function heroOf(def, v) {
    var val = v[def.key];
    if (def.kind === 'cashleft') {
      var ck = typeof val === 'number' ? Calc.cashKind(val) : null;
      return { text: ck === 'out' ? '\u2212' + money(Math.abs(Math.round(val))) : ck ? money(Math.round(val)) : '\u2014', cls: ck === 'in' ? 'amber' : ck ? 'good' : '',
        cap: ck === 'in' ? 'Cash left in after the refinance' : ck === 'out' ? 'Cash pulled out by the refinance (minus = pulled out)' : ck === 'even' ? 'All your money back in the refinance' : '' };
    }
    if (def.kind === 'cost') return { text: fmt('gbp', val), cls: '', cap: def.cap };
    if (def.kind === 'flip') { var fv = Calc.flipVerdict(val); return { text: fmt('pct', val), cls: typeof val !== 'number' ? '' : val < 0 ? 'bad' : flipCls(val), cap: def.cap + (fv ? ' \u2014' + flipNote(fv).replace(/[()]/g, '') : '') }; }
    if (typeof val === 'string' && val.charAt(0) === '\u221e') return { text: '\u221e', cls: 'good', cap: 'No cash left in' };
    if (def.kind === 'cashroi') {
      var cv = Calc.cashRoiVerdict(val);
      return { text: typeof val === 'number' ? fmt('pct', val) : '\u2014', cls: cv || '', cap: def.cap + (cv === 'good' ? ' \u2014 meets the ' + roiPct() + ' target' : cv === 'bad' ? ' \u2014 below the ' + roiPct() + ' target' : '') };
    }
    if (typeof val !== 'number') return { text: '\u2014', cls: '', cap: def.cap };
    return { text: fmt('pct', val), cls: val < 0 ? 'bad' : val < 0.08 ? 'amber' : 'good', cap: def.cap };
  }
  function fieldDef(calc, id) {
    for (var i = 0; i < calc.layout.length; i++) for (var k = 0; k < calc.layout[i].items.length; k++) { var it = calc.layout[i].items[k]; if (it.field && it.field.id === id) return it.field; }
    return null;
  }
  var FLIP_CALC = Calc.find('flip');
  // A worked-out figure shown among the inputs, so nothing in the sum is hidden: stamp duty is not typed, but it is seen.
  // It is filled by update() like a working row ('p' = from the primary screen's flip calculator).
  function readonlyRow(card, k, src) {
    var row = h('div', 'row ro-row'), lab = h('label', '', k.label), note = k.id === 'sdlt' ? 'Worked out for ' + Calc.taxLabel().short + ' (' + Calc.taxLabel().tax + ')' : k.note;
    if (note) lab.appendChild(h('small', '', note));
    var val = h('b', 'fig ro-val'); row.appendChild(lab); row.appendChild(val); card.appendChild(row);
    nodes.calcs.push([k, val, row, src]);
  }
  // ---- The Live ledger (design 6c "Verdict docked"): the Calculator's primary screen ---------------------------
  // One screen: a pinned answer, the four ways out side by side, the deal with sliders, how the chosen way out does, the
  // detail folded into cards, and a plain-words verdict docked above the buttons. Every number comes from
  // Calc.ledger; this file only draws it. The DOM is built once and refreshLedger() updates figures in place, so a slider
  // being dragged or a number being typed is never rebuilt under the finger.
  var BRIDGE_KEY = 'deal-analyser:brrBridge', bridgeOn = !!load(BRIDGE_KEY, false), ledgerStart = null, holdT = null, holdI = null;
  var DEAL_ORDER = ['endValue', 'refurb', 'legal', 'otherUpfront', 'purchasePrice'];   // design 7a
  var DEAL_ROWS = {
    endValue: { range: [80000, 400000], levels: [1000, 200, 50], nudge: 1000, grow: 10000 },
    purchasePrice: { range: [50000, 300000], levels: [1000, 200, 50], nudge: 500, grow: 10000 },
    refurb: { range: [0, 120000], levels: [500, 100, 25], nudge: 250, grow: 10000 },
    legal: { range: [0, 10000], levels: [100, 20, 5], nudge: 50, grow: 1000 },
    otherUpfront: { range: [0, 20000], levels: [50, 20, 5], nudge: 100, grow: 1000 }
  };
  var RENT_RANGE = { monthlyRent: [300, 3000, 25], mortgageRate: [2, 10, 0.05], mgmtPct: [0, 20, 0.5], voidsPct: [0, 20, 0.5], rooms: [1, 10, 1], roomRate: [200, 1200, 5],
    furnishing: [0, 20000, 250], maintPct: [0, 20, 0.5], council: [0, 400, 1], utilities: [0, 800, 5], other: [0, 800, 5], nightlyRate: [40, 400, 5], occupancyPct: [30, 100, 1],
    commPct: [0, 30, 0.5], maintOnMortgagePct: [0, 30, 0.5], channel: [0, 100, 1], maintOnRentPct: [0, 20, 0.5] };
  var EXIT_CARDS = [['none', 'Flip'], ['btl', 'BTL'], ['hmo', 'HMO'], ['sa', 'SA']];
  var EXIT_NAME = { none: 'Flip', btl: 'BRR → BTL', hmo: 'BRR → HMO', sa: 'BRR → SA' };
  var BRIDGE_FIELDS = ['grossLoan', 'termMonths', 'monthlyRatePct', 'arrangementFeePct', 'exitFeePct', 'valuationFee', 'bridgeLegal', 'brokerFeePct'];
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function isInf(v) { return typeof v === 'string' && v.charAt(0) === '∞'; }
  function cashText(v) { return Calc.cashKind(v) === 'out' ? '−' + money(Math.abs(Math.round(v))) : money(Math.round(v)); }
  function signedMoney(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(Math.round(v))); }
  function minusMoney(v) { return (v < 0 ? '−' : '') + money(Math.abs(v)); }
  function pctText(v) { return typeof v === 'number' && isFinite(v) ? fmt('pct', v) : isInf(v) ? '∞' : '—'; }
  function tickOf(verdict) { return verdict === 'good' ? ' ✓' : verdict === 'bad' ? ' ✗' : ''; }
  function isTyped(id) { return Object.prototype.hasOwnProperty.call(deal, id) || (Object.prototype.hasOwnProperty.call(usual, id) && usual[id] !== ''); }
  function holdEnd() { clearTimeout(holdT); clearInterval(holdI); }
  function setFig(id, v) { deal[id] = v; store(DEAL, deal); refreshLedger(); }
  function refreshLedger() {
    if (nodes.r2r) { refreshR2R(); return; }
    if (!nodes.ledger) return;
    var L = Calc.ledger(eff(deal), bridgeOn), X = L.exits[brrLet] || L.exits.none;
    nodes.ledger.forEach(function (f) { f(L, X); });
  }

  // A number that can be tapped and typed over. While it has focus its text is left alone; figures still update around it.
  function numBox(o) {
    var input = h('input', o.cls || ''); input.setAttribute('inputmode', o.decimal ? 'decimal' : 'numeric'); input.setAttribute('autocomplete', 'off');
    if (o.label) input.setAttribute('aria-label', o.label); if (o.id) input.id = o.id;
    input.addEventListener('focus', function () { setTimeout(function () { try { input.select(); } catch (e) {} }, 0); });
    input.addEventListener('input', function () {
      var raw = input.value.replace(o.decimal ? /[^0-9.]/g : /[^0-9]/g, '');
      if (input.value !== raw) input.value = raw;                      // letters and symbols never stay in the box
      input.classList.remove('ex'); o.set(o.decimal ? raw : (Number(raw) || 0));
    });
    input.addEventListener('blur', function () { input.value = o.show(o.get()); });
    input._sync = function () { if (document.activeElement !== input) input.value = o.show(o.get()); input.classList.toggle('ex', !!o.example && o.example()); };
    return input;
  }
  // The small − and + beside a slider: one step a tap, repeating while held.
  function nudge(dir, o, cls) {
    var b = h('button', 'nudge' + (cls ? ' ' + cls : ''), dir < 0 ? '−' : '+'); b.type = 'button'; b.setAttribute('aria-label', (dir < 0 ? 'Less: ' : 'More: ') + o.label);
    var bump = function () { var v = Number((Math.round((o.get() + dir * o.step) / o.step) * o.step).toFixed(4)); o.set(Math.max(minOf(o), Math.min(o.max(), v))); };
    b.addEventListener('pointerdown', function () { holdEnd(); bump(); holdT = setTimeout(function () { holdI = setInterval(bump, 70); }, 380); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, holdEnd); });
    b.addEventListener('click', function (e) { if (e.detail === 0) bump(); });            // keyboard (Enter / Space) has no pointer
    return b;
  }
  // The precision slider (design 6c). The finger is tracked by the wrapper exactly as before: dragging is relative (nothing
  // jumps on touch), sliding the finger DOWN gives finer steps, and at full speed it snaps to magnets (the start figure, the
  // recycle price). A tap with no movement jumps to that point. What is drawn is new: a 20px track, a fill, a 34px thumb,
  // a value bubble while the finger is on it, and a green glow with a small vibration whenever it settles on a magnet.
  // A visually hidden range input keeps it reachable by keyboard and screen readers; its arrow keys step like − and +.
  function scrubber(o) {
    var wrap = h('div', 'scrub'), r = h('input'); r.type = 'range'; r.className = 'scrub-in'; r.min = minOf(o); r.step = 'any'; r.setAttribute('aria-label', o.label);
    var track = h('div', 'scrub-track'), fill = h('i', 'scrub-fill'), thumb = h('div', 'scrub-thumb'), bubble = h('div', 'scrub-bubble');
    track.appendChild(fill); bubble.hidden = true;
    wrap.appendChild(r); wrap.appendChild(track); wrap.appendChild(thumb); wrap.appendChild(bubble);
    var rt = function (v, st) { return Number((Math.round(v / st) * st).toFixed(4)); };
    var clampV = function (v) { return Math.max(minOf(o), Math.min(o.max(), v)); };
    var magnet = function (v) { var s = o.snaps ? o.snaps() : [], span = o.max() - minOf(o); for (var i = 0; i < s.length; i++) if (s[i] != null && Math.abs(v - s[i]) <= span * 0.015) return s[i]; return null; };
    var snapT = null;
    // The snap tick: a short buzz (phones that allow it), the thumb glows and the caller can say what it snapped to.
    wrap._snap = function (to) {
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
      wrap.classList.add('snapped'); if (o.onSnap) o.onSnap(to);
      clearTimeout(snapT); snapT = setTimeout(function () { wrap.classList.remove('snapped'); if (o.onSnap) o.onSnap(null); }, 900);
    };
    // Where a value sits along the track: the thumb's centre runs from 20px in at the left to 20px in at the right.
    wrap._at = function (v) { var lo = minOf(o), span = (o.max() - lo) || 1, p = Math.max(0, Math.min(1, (v - lo) / span)); return 'calc(20px + (100% - 40px) * ' + p.toFixed(4) + ')'; };
    var sc = null;
    wrap.addEventListener('pointerdown', function (e) {
      e.preventDefault(); try { wrap.setPointerCapture(e.pointerId); } catch (x) {}
      scrubbing = true;
      var b = wrap.getBoundingClientRect();
      sc = { x: e.clientX, y: e.clientY, lastX: e.clientX, v: o.get(), w: b.width || 1, left: b.left, moved: false, level: 0, snapAt: magnet(o.get()) };   // starting on a magnet is not arriving at it
      wrap.classList.add('dragging'); bubble.hidden = false; wrap._sync();
      if (o.onLevel) o.onLevel(0);
    });
    wrap.addEventListener('pointermove', function (e) {
      if (!sc) return;
      var dx = e.clientX - sc.lastX; sc.lastX = e.clientX; if (Math.abs(e.clientX - sc.x) > 3) sc.moved = true; if (!sc.moved) return;
      var dy = Math.abs(e.clientY - sc.y), level = dy < 40 ? 0 : dy < 100 ? 1 : 2, span = o.max() - minOf(o);
      sc.v = clampV(sc.v + dx / sc.w * span * [1, 0.25, 0.08][level]);
      var out = rt(sc.v, o.levels[level]);
      if (level === 0) { var m = magnet(sc.v); if (m != null) { out = m; if (sc.snapAt !== m) { sc.snapAt = m; wrap._snap(m); } } else sc.snapAt = null; }   // once per entry
      if (sc.level !== level) { sc.level = level; if (o.onLevel) o.onLevel(level); }
      o.set(clampV(out));
    });
    var end = function (e) {
      if (!sc) return;
      if (!sc.moved && e.type === 'pointerup') { var v = minOf(o) + Math.max(0, Math.min(1, (e.clientX - sc.left) / sc.w)) * (o.max() - minOf(o)), m = magnet(v); if (m != null) wrap._snap(m); o.set(m != null ? m : clampV(rt(v, o.levels[0]))); }
      sc = null; scrubbing = false; wrap.classList.remove('dragging'); bubble.hidden = true; if (o.onLevel) o.onLevel(null);
      if (o.onEnd) o.onEnd();                                  // e.g. let the slider's window move now the finger is off
    };
    wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
    var step = function (dir) { var v = Number((Math.round((o.get() + dir * o.step) / o.step) * o.step).toFixed(4)); o.set(clampV(v)); if (o.onEnd) o.onEnd(); };
    r.addEventListener('keydown', function (e) {
      var dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      if (dir) { e.preventDefault(); step(dir); }
    });
    r.addEventListener('input', function () { o.set(clampV(rt(Number(r.value), o.levels[0]))); });   // assistive tech setting a value
    wrap._sync = function () {
      var v = o.get(), at = wrap._at(v);
      r.min = minOf(o); r.max = o.max(); r.value = v; if (o.bubble) r.setAttribute('aria-valuetext', o.bubble(v));
      fill.style.width = at; thumb.style.left = at; bubble.style.left = at;
      if (!bubble.hidden && o.bubble) bubble.textContent = o.bubble(v);
    };
    return wrap;
  }
  // A slider's top that is never a ceiling: it starts at the usual top or 1.5 times the figure the deal opened with, and
  // once the figure reaches it (and the finger is off the slider) it stretches to 1.5 times the figure, up to 4 times the usual
  // top. Typing is never limited. (Used by the rent sliders; the money sliders use valueWindow.)
  var scrubbing = false;
  function minOf(o) { return typeof o.min === 'function' ? o.min() : o.min; }
  // The money sliders (end value, price, refurb, legal) cover a window round the figure: 60% to 140% of it,
  // so a step means the same share of the figure at 150k or 1.5m. When the figure is left near either end (or typed
  // outside), the window moves to centre on it once the finger is off. A figure of 0 uses the usual range.
  function valueWindow(cfg, start, get) {
    var u = cfg.grow, fit = function (v) { v = Number(v) || 0; return v > 0 ? [Math.max(0, Math.floor(v * 0.6 / u) * u), Math.ceil(v * 1.4 / u) * u] : cfg.range.slice(); };
    var w = fit(start);
    return { lo: function () { return Math.min(w[0], get()); }, hi: function () { return Math.max(w[1], get()); },
      settle: function () { if (scrubbing) return; var v = get(), edge = (w[1] - w[0]) * 0.1; if (v < w[0] + edge || v > w[1] - edge) { var n = fit(v); if (n[0] !== w[0] || n[1] !== w[1]) w = n; } } };
  }
  function stretchTop(base, start, unit, get) {
    var up = function (v) { return Math.ceil(v / unit) * unit; }, top = Math.max(base, up(1.5 * (Number(start) || 0)));
    return { hi: function () { return Math.max(top, get()); },
      grow: function () { if (!scrubbing && get() >= top * 0.97) top = Math.max(top, Math.min(up(get() * 1.5), base * 4)); } };   // never runs away: at most 4x the usual top unless typed
  }
  function statRow(label, cls) { var row = h('div', 'lg-stat'), l = h('span', '', label), v = h('b', 'fig ' + (cls || '')); row.appendChild(l); row.appendChild(v); return { row: row, label: l, val: v }; }
  // A result tile under "How {exit} does": the figure in its verdict colour, the label underneath.
  function tile(label) { var t = h('div', 'lg-tile'), v = h('b', 'fig'), l = h('span', '', label); t.appendChild(v); t.appendChild(l); return { el: t, val: v, label: l }; }
  function blankTiles(T) { Object.keys(T).forEach(function (k) { T[k].val.textContent = '—'; T[k].val.className = 'fig faint'; }); }
  // The verdict strip's targets: shut to start with, then open or shut as last left for the rest of the session.
  var TARGETS_KEY = 'deal-analyser:targetsOpen', targetsOpen = false;
  try { targetsOpen = !!sessionStorage.getItem(TARGETS_KEY); } catch (e) {}
  // Design 8a: the page under the exit tiles shows Figures (everything you enter) or Results (the answer). Figures to
  // start with, then whichever was last chosen for the rest of the session (not per deal).
  var VIEW_KEY = 'deal-analyser:ledgerView', ledgerView = 'figures';
  try { ledgerView = sessionStorage.getItem(VIEW_KEY) === 'results' ? 'results' : 'figures'; } catch (e) {}
  // "Your own money in": the rows (deposit, stamp duty, legal, other costs, refurb, furnishing, bridging when above 0, the
  // mortgage and the total), a one-line summary and the caption. Drawn in the fold under Figures and the card under Results.
  function ownMoney(R, rowsEl, sumEl, capEl) {
    R.push(function (L, X) {
      var w = X.own, P0 = num(L.ps.purchasePrice);
      sumEl.textContent = money(w.total) + ' · total in ' + money(w.totalIn);
      capEl.textContent = w.bridge ? 'Includes the loan’s cost. If the bridge covers the deposit, this is lower.' : 'Deposit plus costs. The mortgage covers the rest.';
      var rows = [['Deposit (' + num(L.ps.depositPct) + '% of ' + money(P0) + ')', w.deposit], ['Stamp duty', w.sdlt], ['Legal costs', w.legal]].concat(w.other > 0 ? [['Other costs', w.other]] : []).concat([['Refurb costs', w.refurb]]);
      if (w.furnishing) rows.push(['Furnishing', w.furnishing]); if (w.bridge) rows.push(['Bridging cost', w.bridge]);
      rowsEl.innerHTML = '';
      rows.forEach(function (r) { var s = statRow(r[0]); s.val.textContent = money(r[1]); rowsEl.appendChild(s.row); });
      var m = statRow('Mortgage covers', 'faint'); m.row.classList.add('solid'); m.val.textContent = money(w.mortgage); rowsEl.appendChild(m.row);
      var t = statRow('Total money in (deposit, mortgage, stamp duty, legal, refurb' + (w.furnishing ? ', furniture' : '') + (w.bridge ? ', bridging' : '') + ')'); t.row.classList.add('solid'); t.val.textContent = money(w.totalIn); rowsEl.appendChild(t.row);
    });
  }
  // A fold card under "More detail": a header that opens it (only one open at a time) with a one-line summary when closed.
  var openFold = null, folds = [];
  function fold(key, title) {
    var card = h('section', 'lg-fold'), head = h('button', 'fold-head'), txt = h('span', 'fold-txt'), tt = h('b', '', title), sum = h('small'), sign = h('span', 'fold-sign');
    head.type = 'button'; txt.appendChild(tt); txt.appendChild(sum); head.appendChild(txt); head.appendChild(sign); card.appendChild(head);
    var body = h('div', 'fold-body'); card.appendChild(body);
    var f = { key: key, card: card, body: body, sum: sum, title: tt, head: head, sign: sign };
    head.onclick = function () { openFold = openFold === key ? null : key; folds.forEach(drawFold); };
    folds.push(f); drawFold(f); return f;
  }
  function drawFold(f) { var on = openFold === f.key; f.body.hidden = !on; f.sign.textContent = on ? '−' : '+'; f.head.setAttribute('aria-expanded', on); f.card.classList.toggle('open', on); }

  // The verdict strip, inside a pinned panel: one row (score, verdict, Targets), tapped open to show a chip per target.
  // Returns draw(verdict). Shared by the Calculator and Rent to rent.
  function verdictStrip(pin) {
    var strip = h('div', 'vstrip'), sbtn = h('button', 'vs-row'), score = h('span', 'vs-score'), vtxt = h('span', 'vs-txt'), vtitle = h('span'), vdet = h('span', 'vs-detail'), vlab = h('span', 'vs-lab');
    var chipsBox = h('div', 'vs-chips');
    sbtn.type = 'button'; vtxt.appendChild(vtitle); vtxt.appendChild(vdet); sbtn.appendChild(score); sbtn.appendChild(vtxt); sbtn.appendChild(vlab);
    var shead = h('div', 'vs-head'); shead.appendChild(sbtn);
    var tfoot = h('div', 'vs-foot'), tsum = h('span', 'vs-sum'), tlink = h('button', 'vs-link', 'Edit targets →'); tlink.type = 'button'; tlink.onclick = openTargets;
    tfoot.appendChild(tsum); tfoot.appendChild(tlink);
    strip.appendChild(shead); strip.appendChild(chipsBox); strip.appendChild(tfoot); pin.appendChild(strip);
    var drawStrip = function (vd) {
      var any = vd.targets.length > 0, open = any && targetsOpen;
      strip.className = 'vstrip ' + vd.tone; score.textContent = vd.score == null ? '–' : vd.score + '/' + vd.of;
      vtitle.textContent = vd.title; vdet.textContent = ' · ' + vd.detail;
      vlab.hidden = !any; vlab.textContent = open ? 'Hide ▴' : 'Targets ▾';
      sbtn.setAttribute('aria-expanded', open); sbtn.disabled = !any;
      chipsBox.hidden = !open; tfoot.hidden = !open; tsum.textContent = Calc.targetsSummary(); chipsBox.innerHTML = '';
      vd.targets.forEach(function (t, i) {
        // ✓ green when met, ~ amber for an OK flip (still a miss), ✗ red otherwise
        var tn = (vd.tones && vd.tones[i]) || (vd.hits[i] ? 'good' : 'bad'), c = h('span', 'vs-chip'), m = h('span', 'vs-mark ' + tn, tn === 'good' ? '✓' : tn === 'amber' ? '~' : '✗');
        m.setAttribute('aria-label', vd.hits[i] ? 'Met:' : tn === 'amber' ? 'Nearly:' : 'Missed:'); c.appendChild(m); c.appendChild(h('span', '', t)); chipsBox.appendChild(c);
      });
    };
    var lastVerdict = null;
    sbtn.onclick = function () { targetsOpen = !targetsOpen; try { sessionStorage.setItem(TARGETS_KEY, targetsOpen ? '1' : ''); } catch (e) {} if (lastVerdict) drawStrip(lastVerdict); };
    return function (vd) { lastVerdict = vd; drawStrip(vd); };
  }

  // Design 8a / 8b: the Figures | Results switch and its two views, added to the page. Returns { fig, res, set(view, scroll) }.
  // The choice is kept for the session; switching scrolls so the switch sits just under the pinned panel.
  function viewSwitch(page) {
    var sw = h('div', 'lg-switch'), figView = h('div', 'lg-view lg-figures'), resView = h('div', 'lg-view lg-results'), swBtns = {};
    sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', 'Show');
    var setView = function (v, scroll) {
      ledgerView = v; try { sessionStorage.setItem(VIEW_KEY, v); } catch (e) {}
      figView.hidden = v !== 'figures'; resView.hidden = v !== 'results';
      Object.keys(swBtns).forEach(function (k) { swBtns[k].setAttribute('aria-pressed', k === v); });
      if (scroll) { var pinEl = page.querySelector('.pin'); window.scrollTo(0, Math.max(0, sw.getBoundingClientRect().top + window.scrollY - (pinEl ? pinEl.offsetHeight : 0) - 8)); }
    };
    [['figures', 'Figures'], ['results', 'Results']].forEach(function (o) {
      var b = h('button', '', o[1]); b.type = 'button'; b.onclick = function () { if (ledgerView !== o[0]) setView(o[0], true); }; sw.appendChild(b); swBtns[o[0]] = b;
    });
    page.appendChild(sw); page.appendChild(figView); page.appendChild(resView);
    return { fig: figView, res: resView, set: setView };
  }

  function renderLedger(box) {
    var R = []; nodes.ledger = R; folds = [];
    var exit = Calc.BRR_LETTING.hasOwnProperty(brrLet) ? brrLet : 'none', isLet = exit !== 'none';
    var L0 = Calc.ledger(eff(deal), bridgeOn);
    current = Calc.find(L0.exits[exit].calcId);
    if (!ledgerStart) { ledgerStart = {}; DEAL_ORDER.forEach(function (id) { ledgerStart[id] = num(L0.ps[id]); }); }
    var cur = function (id) { return num(Calc.stateFor(FLIP_CALC, eff(deal))[id]); };
    var exitName = EXIT_CARDS.filter(function (e) { return e[0] === exit; })[0][1];
    if (openFold === 'let' && !isLet) openFold = null;

    // ---- 1. the pinned answer ----
    var pin = h('div', 'pin'), head = h('div', 'pin-head'), right = h('span', 'pin-right'), resetAll = h('button', 'pin-reset', 'Reset'), savePin = h('button', 'pin-save', 'Save');
    resetAll.type = 'button'; savePin.type = 'button'; savePin.onclick = saveDeal;
    right.appendChild(resetAll); right.appendChild(savePin); right.appendChild(h('span', 'pin-exit', EXIT_NAME[exit]));
    head.appendChild(h('span', 'pin-title', 'Calculator')); head.appendChild(right); pin.appendChild(head);
    resetAll.onclick = function () { DEAL_ORDER.forEach(function (id) { deal[id] = ledgerStart[id]; }); store(DEAL, deal); refreshLedger(); };
    R.push(function () { resetAll.hidden = !DEAL_ORDER.some(function (id) { return cur(id) !== ledgerStart[id]; }); });
    var eye = h('div', 'pin-eye'); pin.appendChild(eye);
    var heroRow = h('div', 'pin-row'), hero = h('div', 'pin-fig fig'), side = h('div', 'pin-side'), sideFig = h('div', 'pin-side-fig fig'), sideCap = h('div', 'pin-side-cap');
    side.appendChild(sideFig); side.appendChild(sideCap); heroRow.appendChild(hero); heroRow.appendChild(side); pin.appendChild(heroRow);
    var bar = h('div', 'pin-bar'), barA = h('i', 'a'), barB = h('i', 'b'); bar.appendChild(barA); bar.appendChild(barB); pin.appendChild(bar);
    var caps = h('div', 'pin-caps'), capL = h('span'), capR = h('span'); caps.appendChild(capL); caps.appendChild(capR); pin.appendChild(caps);
    var tag = h('div', 'pin-tag'); pin.appendChild(tag);
    box.appendChild(pin);
    R.push(function (L, X) {
      var v = X.v, loan = num(v.newMortgage), tin = num(v.totalIn), big = Math.max(tin, loan) || 1;
      tag.hidden = !bridgeOn; tag.textContent = bridgeOn ? 'Includes ' + money(L.bridgeCost) + ' bridging' : '';
      if (!Calc.dealEntered(L.ps)) {                                   // no end value or no price: nothing to show yet
        eye.textContent = 'No deal entered yet'; hero.textContent = '—'; hero.className = 'pin-fig fig faint';
        sideFig.textContent = '—'; sideFig.className = 'pin-side-fig fig faint'; sideCap.textContent = 'Add end value and price';
        barA.style.width = '0%'; barB.style.width = '0%'; capL.textContent = 'Lender pays —'; capR.textContent = '';
        return;
      }
      if (isLet) {
        var k = Calc.cashKind(v.cashLeft), out = v.cashLeft <= 0;
        eye.textContent = k === 'in' ? 'Left in after the refinance' : k === 'out' ? 'Pulled out by the refinance' : 'All your money back';
        hero.textContent = cashText(v.cashLeft); hero.className = 'pin-fig fig ' + (k === 'in' ? 'amber' : 'good');
        sideFig.textContent = out ? '∞' : pctText(v.roi); sideFig.className = 'pin-side-fig fig ' + (Calc.cashRoiVerdict(v.roi) || '');
        sideCap.textContent = out ? 'You pull out more than you put in' : 'ROI on cash left in';
        capR.textContent = X.recyclePrice == null ? 'No price gets all your money back' : 'Buy at ' + money(X.recyclePrice) + ' or less';
      } else {
        var fv = flipCls(v.margin);
        eye.textContent = 'Flip profit'; hero.textContent = minusMoney(Math.round(v.profit)); hero.className = 'pin-fig fig ' + (v.profit < 0 ? 'bad' : fv || '');
        sideFig.textContent = pctText(v.margin); sideFig.className = 'pin-side-fig fig ' + (fv || ''); sideCap.textContent = 'of end value · ' + flipPct() + ' target';
        capR.textContent = 'In ' + money(tin);
      }
      barA.style.width = (Math.min(loan, tin) / big * 100).toFixed(1) + '%'; barB.style.width = (Math.abs(tin - loan) / big * 100).toFixed(1) + '%';
      barB.className = 'b ' + (tin > loan ? 'in' : 'out');
      capL.textContent = 'Lender pays ' + money(loan);
    });

    // ---- the verdict strip, inside the pinned panel: one row, tap for the targets ----
    var drawVerdict = verdictStrip(pin);
    R.push(function (L, X) { drawVerdict(Calc.dealVerdict(exit, X.v, L.ps)); });

    // ---- 2. the four exits, side by side ----
    var exits = h('div', 'lg-exits');
    EXIT_CARDS.forEach(function (ec) {
      var key = ec[0], on = key === exit, b = h('button', 'exit-tile' + (on ? ' on' : '')), big = h('span', 'big fig');
      b.type = 'button'; b.setAttribute('aria-pressed', on); b.appendChild(h('span', 'nm', ec[1])); b.appendChild(big);
      b.onclick = function () { if (on) return; setLet(key); renderCalculator(); };
      R.push(function (L) {
        var v = L.exits[key].v, vd = key === 'none' ? flipCls(v.margin) : Calc.cashRoiVerdict(v.roi), none = !Calc.dealEntered(L.ps);
        big.textContent = none ? '—' : pctText(key === 'none' ? v.margin : v.roi); big.className = 'big fig ' + (none ? 'faint' : vd || '');
        b.setAttribute('aria-label', ec[1] + ', ' + (key === 'none' ? 'margin ' : 'ROI ') + big.textContent);
      });
      exits.appendChild(b);
    });
    box.appendChild(exits);

    // ---- 8a: Figures | Results ----
    var page = box, VS = viewSwitch(page), figView = VS.fig, resView = VS.res, setView = VS.set; box = figView;

    // ---- 3. the deal: one card per figure ----
    var dh = h('div', 'lg-hrow'), clr = h('button', 'clear-pill'); clr.type = 'button';
    clr.appendChild(h('span', 'x', '×')); clr.appendChild(document.createTextNode('Clear figures'));
    // Empties end value, price, refurb and any other costs (legal and the rest stay), ready for a new deal. Reset brings them back.
    clr.onclick = function () { ['endValue', 'purchasePrice', 'refurb', 'otherUpfront'].forEach(function (id) { deal[id] = 0; }); store(DEAL, deal); refreshLedger(); };
    dh.appendChild(h('p', 'lg-h', 'The deal')); dh.appendChild(clr); box.appendChild(dh);
    DEAL_ORDER.forEach(function (id) {
      if (id === 'purchasePrice') {                                   // stamp duty sits in its own card, just above the price
        var tc = h('section', 'lg-card tax-card'), tv = h('b', 'fig'); tc.appendChild(taxBlock(tv)); box.appendChild(tc);
        R.push(function (L, X) { tv.textContent = money(X.own.sdlt); });
      }
      var cfg = DEAL_ROWS[id], f = fieldDef(FLIP_CALC, id), card = h('section', 'lg-card deal-card'), isPrice = id === 'purchasePrice', recP = null, hint = null, snapTo = null;
      var win = valueWindow(cfg, ledgerStart[id], function () { return cur(id); }), lo = win.lo, hi = win.hi;
      var lab = h('label', 'lg-label', f.label); lab.setAttribute('for', 'lg-' + id); card.appendChild(lab);
      var numWrap = h('div', 'lg-num'); numWrap.appendChild(h('span', 'cur', '£'));
      var box1 = numBox({ id: 'lg-' + id, cls: 'big-num fig', label: f.label, get: function () { return cur(id); }, show: function (v) { return v ? v.toLocaleString('en-GB') : ''; },
        set: function (v) { setFig(id, v); }, example: function () { return !isTyped(id); } });
      numWrap.appendChild(box1); card.appendChild(numWrap);
      var o = { label: f.label, get: function () { return cur(id); }, set: function (v) { setFig(id, v); }, min: lo, max: hi, step: cfg.nudge, levels: cfg.levels,
        snaps: function () { return [isPrice ? recP : null, ledgerStart[id]]; }, onLevel: function (lv) { hint = lv; drawSub(); }, onEnd: refreshLedger,
        bubble: function (v) { return money(v); }, onSnap: function (to) { snapTo = to; drawSub(); } };
      var l2 = h('div', 'lg-l2'), sl = scrubber(o), mark = null; l2.appendChild(nudge(-1, o)); l2.appendChild(sl); l2.appendChild(nudge(1, o)); card.appendChild(l2);
      if (isPrice) { mark = h('div', 'rec-mark'); sl.appendChild(mark); }
      var l3 = h('div', 'lg-l3'), sub = h('span', 'lg-sub'), reset = h('button', 'lg-reset'); reset.type = 'button'; l3.appendChild(sub); l3.appendChild(reset); card.appendChild(l3);
      reset.onclick = function () { setFig(id, ledgerStart[id]); };
      // The recycle price as its own full-width button below the slider, so nothing tappable sits in the slider's way.
      var recBtn = null, recTxt = null;
      if (isPrice) {
        recBtn = h('button', 'rec-btn'); recBtn.type = 'button'; recBtn.appendChild(h('i', 'rec-tick'));
        var rs = h('span', 'rec-txt'); rs.appendChild(h('span', 'rec-eye', 'Recycle price')); recTxt = h('b', 'rec-amt fig'); rs.appendChild(recTxt); rs.appendChild(h('span', 'rec-note', 'Pay this or less to get every pound back'));
        var set = h('span', 'rec-set', 'Set price '); set.appendChild(h('span', 'arr', '→')); recBtn.appendChild(rs); recBtn.appendChild(set);
        card.appendChild(recBtn);
        recBtn.onclick = function () { if (recP != null) { setFig(id, recP); sl._snap(recP); } };
      }
      var subBase = '';
      var drawSub = function () {
        var snapped = hint == null && snapTo != null;
        sub.classList.toggle('good', snapped);
        sub.textContent = hint != null ? ['Slide your finger down for finer steps', 'Finer: ' + money(cfg.levels[1]) + ' steps', 'Finest: ' + money(cfg.levels[2]) + ' steps'][hint]
          : snapped ? (isPrice && snapTo === recP ? '✓ Snapped to the recycle price' : '✓ Snapped to the starting figure') : subBase;
      };
      box.appendChild(card);
      R.push(function (L, X) {
        var c = cur(id), d = c - ledgerStart[id];
        win.settle(); box1._sync(); sl._sync();
        subBase = id === 'endValue' ? 'Lender pays ' + L.ltv + '% = ' + money(num(X.v.newMortgage)) : id === 'otherUpfront' ? 'Survey, valuation, broker: anything else up front' : ''; drawSub();
        reset.hidden = d === 0; reset.textContent = signedMoney(d) + ' from ' + money(ledgerStart[id]) + ' ↺';
        if (isPrice) {
          recP = Calc.dealEntered(L.ps) ? X.recyclePrice : null;
          var p = recP == null ? -1 : (recP - lo()) / ((hi() - lo()) || 1), show = p >= 0 && p <= 1;
          mark.hidden = !show; recBtn.hidden = recP == null;
          if (show) mark.style.left = sl._at(recP);
          // Already at the recycle price (to the nearest £1): the pill is hidden (its space kept, so nothing moves) and the
          // card is not a button until the price moves again.
          var atRec = recP != null && Math.round(c) === Math.round(recP);
          set.style.visibility = atRec ? 'hidden' : ''; recBtn.disabled = atRec;
          if (recP != null) { recTxt.textContent = money(recP); recBtn.setAttribute('aria-label', 'Recycle price ' + money(recP) + (atRec ? '. The price is set to it' : '. Set price')); }
        }
      });
    });

    // ---- 4. lender pays / deposit ----
    var chips = h('div', 'lg-chips');
    [['ltv', 'Lender pays'], ['depositPct', 'Deposit']].forEach(function (c) {
      var id = c[0], chip = h('div', 'lg-chip'), amt = h('div', 'amt'), w = h('div', 'pct');
      var lab = h('label', '', c[1]); lab.setAttribute('for', 'lg-' + id);
      var inp = numBox({ id: 'lg-' + id, decimal: true, label: c[1] + ' percent', get: function () { return Calc.stateFor(FLIP_CALC, eff(deal))[id]; }, show: function (v) { return String(v); },
        set: function (v) { setFig(id, v); }, example: function () { return !isTyped(id); } });
      w.appendChild(inp); w.appendChild(h('span', '', '%')); chip.appendChild(lab); chip.appendChild(w); chip.appendChild(amt); chips.appendChild(chip);
      R.push(function (L, X) { inp._sync(); amt.textContent = id === 'ltv' ? '= ' + money(num(L.ps.endValue) * L.ltv / 100) + ' refinance' : '= ' + money(X.own.deposit) + ' of the price'; });
    });
    box.appendChild(chips);

    // ---- 5. how the chosen exit does ----
    resView.appendChild(h('p', 'lg-h', 'How ' + exitName + ' does'));
    var tiles = h('div', 'lg-tiles'); resView.appendChild(tiles);
    if (isLet) {
      var T = { income: tile('Monthly income'), expenses: tile('Monthly expenses'), monthly: tile('Monthly profit (target ' + money(Calc.MONTHLY_PROFIT_TARGET) + ')'), annual: tile('Annual profit (target ' + money(Calc.MONTHLY_PROFIT_TARGET * 12) + ')'),
        back: tile('Months to get money back (green\u00a0≤\u00a0' + Calc.targets().payback + ', amber\u00a0≤\u00a0' + Calc.PAYBACK_OK + ')'), roi: tile('ROI on cash left in (target ' + roiPct() + ')'), pay: tile('Most you can pay and get it back in 2 years') };
      ['income', 'expenses', 'monthly', 'annual', 'back', 'roi', 'pay'].forEach(function (k) { tiles.appendChild(T[k].el); });
      R.push(function (L) {
        if (!Calc.dealEntered(L.ps)) { blankTiles(T); return; }
        var v = L.exits[exit].v, mv = Calc.monthlyProfitVerdict(v.monthly), bv = Calc.paybackVerdict(v.breakeven, v.cashLeft);
        T.income.val.textContent = money2(v.monthly + v.expenses); T.expenses.val.textContent = '−' + money2(v.expenses);
        T.monthly.val.textContent = money2(v.monthly) + tickOf(mv); T.monthly.val.className = 'fig ' + (mv || '');
        T.annual.val.textContent = money(v.annual) + tickOf(mv); T.annual.val.className = 'fig ' + (mv || '');
        T.back.val.textContent = v.cashLeft <= 0 ? '—' : typeof v.breakeven === 'number' && isFinite(v.breakeven) ? fmt('months', v.breakeven) : 'Never at this rent'; T.back.val.className = 'fig ' + bv;
        var rv = Calc.cashRoiVerdict(v.roi); T.roi.val.textContent = pctText(v.roi) + tickOf(rv); T.roi.val.className = 'fig ' + (rv || '');
        T.pay.val.textContent = v.paybackPrice == null ? '—' : money(v.paybackPrice);
      });
    } else {
      var F = { tin: tile('Total in'), sell: tile('Sell for'), ret: tile('Return on money in') };
      ['tin', 'sell', 'ret'].forEach(function (k) { tiles.appendChild(F[k].el); });
      R.push(function (L) { if (!Calc.dealEntered(L.ps)) { blankTiles(F); return; } var v = L.exits.none.v; F.tin.val.textContent = money(v.totalIn); F.sell.val.textContent = money(num(L.ps.endValue)); F.ret.val.textContent = pctText(v.flipRoi); });
    }

    // ---- 6. more detail: three fold cards, one open at a time ----
    box.appendChild(h('p', 'lg-h', 'More detail'));
    if (isLet) {
      var lf = fold('let', exitName + ' figures'), EC = Calc.find(Calc.BRR_LETTING[exit]), shown = [];
      var val = function (id) { return Calc.ledger(eff(deal), bridgeOn).exits[exit].state[id]; };
      Calc.simplePlan('brr', exit).rental.forEach(function (id) {
        var f = fieldDef(EC, id); if (!f) return;
        shown.push(f);
        var rr = RENT_RANGE[id] || [0, 1000, 1], sp = rr[2], rtop = stretchTop(rr[1], val(id), Math.max(sp, rr[1] / 10), function () { return num(val(id)); }), hi = rtop.hi;
        var lv = [sp, sp / 5, sp / 25].map(function (q) { return sp < 1 ? Math.max(q, 0.01) : Math.max(q, 1); });
        var o = { label: f.label, get: function () { return num(val(id)); }, set: function (v) { setFig(id, v); }, min: rr[0], max: hi, step: sp, levels: lv, snaps: function () { return [f.def]; }, onEnd: refreshLedger,
          bubble: function (v) { return (f.unit === '£' ? '£' : '') + v + (f.unit === '%' ? '%' : ''); } };
        var row = h('div', 'rent-row'), l1 = h('div', 'rent-l1'), lab = h('label', '', f.label); lab.setAttribute('for', 'lg-' + id);
        if (/per month|per night|per room/.test(f.note || '')) lab.appendChild(h('span', 'unit', ' · ' + f.note.replace('per room, per month', 'per room/month')));
        var w = h('div', 'rent-in'), inp = numBox({ id: 'lg-' + id, decimal: true, label: f.label, get: function () { return val(id); }, show: function (v) { return String(v); }, set: function (v) { setFig(id, v); }, example: function () { return !isTyped(id); } });
        if (f.unit === '£') w.appendChild(h('span', '', '£')); w.appendChild(inp); if (f.unit === '%') w.appendChild(h('span', '', '%'));
        l1.appendChild(lab); l1.appendChild(w); row.appendChild(l1);
        var l2 = h('div', 'lg-l2'), sl = scrubber(o); l2.appendChild(nudge(-1, o, 'sm')); l2.appendChild(sl); l2.appendChild(nudge(1, o, 'sm')); row.appendChild(l2);
        lf.body.appendChild(row);
        R.push(function () { rtop.grow(); inp._sync(); sl._sync(); });
      });
      R.push(function (L) {
        var st = L.exits[exit].state;
        lf.sum.textContent = shown.slice(0, 2).map(function (f) { var v = st[f.id]; return f.label + ' ' + (f.unit === '£' ? money2(num(v)).replace(/\.00$/, '') : v + (f.unit === '%' ? '%' : '')); }).join(' · ');
      });
    }
    var of = fold('own', 'Your own money in'), ownRows = h('div'), ownCap = h('div', 'own-cap'); of.body.appendChild(ownRows); of.body.appendChild(ownCap);
    ownMoney(R, ownRows, of.sum, ownCap);
    var oc = h('section', 'lg-card own-card'), ocHead = h('div', 'own-card-head'), ocSum = h('small'), ocRows = h('div'), ocCap = h('div', 'own-cap');
    ocHead.appendChild(h('b', '', 'Your own money in')); ocHead.appendChild(ocSum); oc.appendChild(ocHead); oc.appendChild(ocRows); oc.appendChild(ocCap); resView.appendChild(oc);
    ownMoney(R, ocRows, ocSum, ocCap);
    var back = h('button', 'lg-back', '← Change the figures'); back.type = 'button'; back.onclick = function () { setView('figures', true); }; resView.appendChild(back);
    var pf = fold('pay', 'Paying for it');
    var seg = h('div', 'segmented lg-seg');
    [[false, 'Own cash / mortgage'], [true, 'Bridging loan']].forEach(function (m) {
      var b = h('button', '', m[1]); b.type = 'button'; b.setAttribute('aria-pressed', bridgeOn === m[0]);
      b.onclick = function () { if (bridgeOn === m[0]) return; bridgeOn = m[0]; store(BRIDGE_KEY, bridgeOn); renderCalculator(); };
      seg.appendChild(b);
    });
    pf.body.appendChild(seg);
    R.push(function (L) { pf.sum.textContent = bridgeOn ? 'Bridging loan · ' + money(num(L.bridgeCost)) + ' cost' : 'Own cash / mortgage'; });
    if (bridgeOn) {
      var BC = Calc.find('bridging'), bst = function () { return Calc.stateFor(BC, eff(deal)); };
      var bh = h('div', 'own-head'), bl = h('div'), bTotal = h('div', 'own-total fig amber');
      bl.appendChild(h('div', 'lg-label', 'Total cost of borrowing')); bl.appendChild(bTotal); bh.appendChild(bl); bh.appendChild(h('div', 'own-cap', 'Added to the cash left in, and taken off the flip profit')); pf.body.appendChild(bh);
      var match = h('button', 'lg-link block'); match.type = 'button'; pf.body.appendChild(match);
      match.onclick = function () { var ps = Calc.stateFor(FLIP_CALC, eff(deal)); setFig('grossLoan', num(ps.purchasePrice) + num(ps.refurb)); };
      var grid = h('div', 'bridge-grid'), syncs = [];
      BRIDGE_FIELDS.forEach(function (id) {
        var f = fieldDef(BC, id), cell = h('div', 'bridge-cell'), lab = h('label', '', id === 'monthlyRatePct' ? 'Interest a month' : f.label), w = h('div', 'bridge-in'); lab.setAttribute('for', 'lg-' + id);
        var inp = numBox({ id: 'lg-' + id, decimal: true, label: f.label, get: function () { return bst()[id]; }, show: function (v) { return String(v); }, set: function (v) { setFig(id, v); }, example: function () { return !isTyped(id); } });
        if (f.unit === '£') w.appendChild(h('span', '', '£')); w.appendChild(inp);
        if (f.unit === '%') w.appendChild(h('span', '', '%')); if (id === 'termMonths') w.appendChild(h('span', '', 'mo'));
        cell.appendChild(lab); cell.appendChild(w); grid.appendChild(cell); syncs.push(inp);
      });
      pf.body.appendChild(grid);
      pf.body.appendChild(h('div', 'bridge-q', 'How the interest is charged'));
      var types = h('div', 'pills'), typeBtns = [];
      [['rolled', 'Rolled up'], ['monthly', 'Paid monthly']].forEach(function (t) {
        var b = h('button', '', t[1]); b.type = 'button'; b.onclick = function () { setFig('interestType', t[0]); }; types.appendChild(b); typeBtns.push([t[0], b]);
      });
      pf.body.appendChild(types);
      var typeNote = h('p', 'note'); pf.body.appendChild(typeNote);
      var bRows = h('div'); pf.body.appendChild(bRows);
      R.push(function (L) {
        var bv = L.bridge || {}, s = bst(), it = s.interestType || 'rolled', ps = L.ps;
        bTotal.textContent = money(num(bv.totalCost)); match.textContent = 'Use price + refurb (' + money(num(ps.purchasePrice) + num(ps.refurb)) + ')';
        syncs.forEach(function (i) { i._sync(); });
        typeBtns.forEach(function (t) { t[1].setAttribute('aria-pressed', t[0] === it); });
        typeNote.textContent = it === 'monthly' ? 'Paid out of pocket each month, so the balance never grows.' : 'Added to what you owe each month and repaid in one sum at the end.';
        var rows = [['Net advance', money(num(bv.netAdvance))], ['Total interest over the term', money(num(bv.totalInterest))]];
        if (bv.monthlyPayment) rows.push(['Monthly payment', money2(bv.monthlyPayment)]);
        rows.push(['Repaid at the end', money(num(bv.redemption))], ['Cost as % of the loan', pctText(bv.costPct)]);
        bRows.innerHTML = ''; rows.forEach(function (r) { var st = statRow(r[0]); st.val.textContent = r[1]; bRows.appendChild(st.row); });
      });
    }
    folds.forEach(function (f) { box.appendChild(f.card); });
    var foot = h('p', 'lg-foot', 'Renting it from someone else? '), r2r = h('button', 'lg-link', 'Rent to rent →'); r2r.type = 'button'; r2r.onclick = function () { location.hash = '#c/r2rhmo'; }; foot.appendChild(r2r); page.appendChild(foot);
    var ul = h('button', 'text-link', 'Set my usual figures →'); ul.onclick = function () { location.hash = '#usual'; }; page.appendChild(ul);
    page.appendChild(legalFooter());
    setView(ledgerView, false);

    // ---- no fixed action bar on this screen: Save sits in the panel; only the tab bar stays fixed ----
    var sbar = $('sticky-bar'); sbar.innerHTML = ''; sbar.hidden = true;
    refreshLedger();
  }

  // ---- Rent to rent (design 7b with the 8b Figures | Results switch, 7 Oct 2026) ----------------------------------------
  // The same look as the Calculator: a pinned answer (monthly profit after the rent you pay, ROI on money in, money in
  // and out a month, the 3-target verdict), the two kinds side by side (R2R HMO, R2R SA), then Figures (the money in and
  // the rent you pay as cards, income and running costs folded) or Results (the stat grid and the monthly breakdown).
  // Every figure is the R2R HMO / R2R SA calculator's own (no new maths); fields are its yellow cells, shared by id.
  var R2R_MODES = { r2rhmo: { name: 'R2R HMO', sub: 'By the room', let: ['roomRate', 'rooms'], run: ['mgmtPct', 'maintOnRentPct', 'council', 'utilities'], letTitle: 'Room income' },
    r2rsa: { name: 'R2R SA', sub: 'Nightly stays', let: ['nightlyRate', 'rooms', 'occupancyPct'], run: ['commPct', 'maintOnRentPct', 'council', 'utilities', 'channel'], letTitle: 'Nightly income' } };
  var R2R_MONEY = ['upfront', 'refurb', 'furnishing', 'otherUpfront', 'rentPaid'];
  var R2R_RANGE = { upfront: [0, 10000, 50], refurb: [0, 30000, 250], furnishing: [0, 20000, 250], otherUpfront: [0, 10000, 50], rentPaid: [300, 5000, 25] };
  var R2R_SUBS = { upfront: 'Deposit and any rent you pay in advance', refurb: 'Getting it ready to let', furnishing: 'Beds, furniture, linen', otherUpfront: 'Agreement, legal, compliance: anything else up front', rentPaid: 'Paid to the landlord every month' };
  var r2rStart = null;                 // the figures when the screen opened: Reset and the "from" deltas
  function r2rRun(key) { var c = Calc.find(key), st = Calc.stateFor(c, eff(deal)); return { state: st, v: c.compute(st).v }; }
  function refreshR2R() { var k = nodes.r2rKey, cur = r2rRun(k), both = { r2rhmo: r2rRun('r2rhmo'), r2rsa: r2rRun('r2rsa') }; nodes.r2r.forEach(function (f) { f(cur.v, cur.state, both); }); }
  function renderR2R(box, key) {
    var R = []; nodes.r2r = R; nodes.r2rKey = key; folds = [];
    var M = R2R_MODES[key], C = Calc.find(key), all = R2R_MONEY.concat(M.let, M.run);
    if (!r2rStart || r2rStart._key !== key) {
      var st0 = Calc.stateFor(C, eff(deal)); r2rStart = { _key: key, _typed: {} };
      all.forEach(function (id) { r2rStart[id] = num(st0[id]); r2rStart._typed[id] = Object.prototype.hasOwnProperty.call(deal, id) ? deal[id] : undefined; });
    }
    // Back to the start exactly: a figure that was not typed then is untyped again, so Reset never pushes one kind's
    // example figures (4 rooms) into the other kind or the Calculator (figures are shared by id).
    var restore = function (id) { var t = r2rStart._typed[id]; if (t === undefined) delete deal[id]; else deal[id] = t; };
    if (openFold !== 'let' && openFold !== 'run') openFold = 'let';
    var cur = function (id) { return num(Calc.stateFor(C, eff(deal))[id]); };

    // ---- the pinned answer ----
    var pin = h('div', 'pin'), head = h('div', 'pin-head'), right = h('span', 'pin-right'), resetAll = h('button', 'pin-reset', 'Reset'), savePin = h('button', 'pin-save', 'Save');
    var back = h('button', 'pin-back'); back.type = 'button'; back.setAttribute('aria-label', 'Back to the Calculator'); back.appendChild(h('span', 'chev', '‹')); back.appendChild(h('span', 'pin-title', 'Rent to rent'));
    back.onclick = function () { location.hash = '#c/brr'; };
    resetAll.type = 'button'; savePin.type = 'button'; savePin.onclick = saveDeal;
    right.appendChild(resetAll); right.appendChild(savePin); right.appendChild(h('span', 'pin-exit', M.name));
    head.appendChild(back); head.appendChild(right); pin.appendChild(head);
    resetAll.onclick = function () { all.forEach(restore); store(DEAL, deal); refreshLedger(); };
    R.push(function () { resetAll.hidden = !all.some(function (id) { return cur(id) !== r2rStart[id]; }); });
    pin.appendChild(h('div', 'pin-eye', 'Monthly profit, after the rent you pay'));
    var heroRow = h('div', 'pin-row'), hero = h('div', 'pin-fig fig'), side = h('div', 'pin-side'), sideFig = h('div', 'pin-side-fig fig'), sideCap = h('div', 'pin-side-cap', 'ROI on money in');
    side.appendChild(sideFig); side.appendChild(sideCap); heroRow.appendChild(hero); heroRow.appendChild(side); pin.appendChild(heroRow);
    var bar = h('div', 'pin-bar'), barA = h('i', 'a'), barB = h('i', 'b cost'); bar.appendChild(barA); bar.appendChild(barB); pin.appendChild(bar);
    var caps = h('div', 'pin-caps'), capL = h('span'), capR = h('span'); caps.appendChild(capL); caps.appendChild(capR); pin.appendChild(caps);
    var drawVerdict = verdictStrip(pin);
    box.appendChild(pin);
    R.push(function (v) {
      var mv = Calc.monthlyProfitVerdict(v.monthly), none = num(v.totalIn) <= 0, rv = none ? 'good' : Calc.cashRoiVerdict(v.roi), big = Math.max(num(v.income), num(v.expenses)) || 1;
      hero.textContent = minusMoney(Math.round(num(v.monthly))); hero.className = 'pin-fig fig ' + (mv || '');
      sideFig.textContent = none ? '∞' : pctText(v.roi); sideFig.className = 'pin-side-fig fig ' + (rv || '');
      barA.style.width = (num(v.income) / big * 100).toFixed(1) + '%'; barB.style.width = (num(v.expenses) / big * 100).toFixed(1) + '%';
      capL.textContent = 'In ' + money(num(v.income)) + ' a month'; capR.textContent = 'Out ' + money(num(v.expenses));
      drawVerdict(Calc.r2rVerdict(v));
    });

    // ---- the two kinds, side by side ----
    var modes = h('div', 'r2r-modes');
    Object.keys(R2R_MODES).forEach(function (k) {
      var on = k === key, b = h('button', 'exit-tile r2r-tile' + (on ? ' on' : '')), big = h('span', 'big fig'); b.type = 'button'; b.setAttribute('aria-pressed', on);
      b.appendChild(h('span', 'nm', R2R_MODES[k].name)); b.appendChild(h('span', 'r2r-sub', R2R_MODES[k].sub)); b.appendChild(big);
      b.onclick = function () { if (!on) location.hash = '#c/' + k; };
      R.push(function (v, st, both) { var w = both[k].v; big.textContent = minusMoney(Math.round(num(w.monthly))) + '/mo'; big.className = 'big fig ' + (Calc.monthlyProfitVerdict(w.monthly) || ''); b.setAttribute('aria-label', R2R_MODES[k].name + ', ' + big.textContent + ' profit'); });
      modes.appendChild(b);
    });
    box.appendChild(modes);

    var page = box, VS = viewSwitch(page), fig = VS.fig, res = VS.res;

    // ---- Figures: money in, the rent you pay, then the income and running costs folded ----
    fig.appendChild(h('p', 'lg-h', 'Money in'));
    R2R_MONEY.forEach(function (id) {
      var f = fieldDef(C, id), rr = R2R_RANGE[id], step = rr[2], hint = null, snapTo = null;
      var rtop = stretchTop(rr[1], r2rStart[id], Math.max(step, rr[1] / 10), function () { return cur(id); });
      var card = h('section', 'lg-card deal-card'), lab = h('label', 'lg-label', id === 'otherUpfront' ? 'Any other costs' : f.label); lab.setAttribute('for', 'lg-' + id); card.appendChild(lab);
      var numWrap = h('div', 'lg-num'); numWrap.appendChild(h('span', 'cur', '£'));
      var box1 = numBox({ id: 'lg-' + id, cls: 'big-num fig', label: f.label, get: function () { return cur(id); }, show: function (v) { return v ? v.toLocaleString('en-GB') : ''; },
        set: function (v) { setFig(id, v); }, example: function () { return !isTyped(id); } });
      numWrap.appendChild(box1); card.appendChild(numWrap);
      var o = { label: f.label, get: function () { return cur(id); }, set: function (v) { setFig(id, v); }, min: rr[0], max: rtop.hi, step: step, levels: [step, Math.max(1, step / 5), Math.max(1, step / 25)],
        snaps: function () { return [r2rStart[id]]; }, onLevel: function (lv) { hint = lv; drawSub(); }, onEnd: refreshLedger, bubble: function (v) { return money(v); }, onSnap: function (to) { snapTo = to; drawSub(); } };
      var l2 = h('div', 'lg-l2'), sl = scrubber(o); l2.appendChild(nudge(-1, o)); l2.appendChild(sl); l2.appendChild(nudge(1, o)); card.appendChild(l2);
      var l3 = h('div', 'lg-l3'), sub = h('span', 'lg-sub'), reset = h('button', 'lg-reset'); reset.type = 'button'; l3.appendChild(sub); l3.appendChild(reset); card.appendChild(l3);
      reset.onclick = function () { restore(id); store(DEAL, deal); refreshLedger(); };
      var drawSub = function () {
        sub.classList.toggle('good', hint == null && snapTo != null);
        sub.textContent = hint != null ? ['Slide your finger down for finer steps', 'Finer: ' + money(o.levels[1]) + ' steps', 'Finest: ' + money(o.levels[2]) + ' steps'][hint]
          : snapTo != null ? '✓ Snapped to the starting figure' : R2R_SUBS[id];
      };
      fig.appendChild(card);
      R.push(function () { var d = cur(id) - r2rStart[id]; rtop.grow(); box1._sync(); sl._sync(); drawSub(); reset.hidden = d === 0; reset.textContent = signedMoney(d) + ' from ' + money(r2rStart[id]) + ' ↺'; });
    });
    var tot = h('div', 'r2r-total'), totV = h('b', 'fig'); tot.appendChild(h('span', '', 'Total money in')); tot.appendChild(totV); fig.appendChild(tot);
    R.push(function (v) { totV.textContent = money(num(v.totalIn)); });
    fig.appendChild(h('p', 'lg-h', 'More detail'));
    var rentFold = function (fk, title, ids, summary) {
      var fd = fold(fk, title);
      ids.forEach(function (id) {
        var f = fieldDef(C, id); if (!f) return;
        var rr = RENT_RANGE[id] || [0, 1000, 1], sp = rr[2], rtop = stretchTop(rr[1], r2rStart[id], Math.max(sp, rr[1] / 10), function () { return cur(id); });
        var lv = [sp, sp / 5, sp / 25].map(function (q) { return sp < 1 ? Math.max(q, 0.01) : Math.max(q, 1); });
        var o = { label: f.label, get: function () { return cur(id); }, set: function (v) { setFig(id, v); }, min: rr[0], max: rtop.hi, step: sp, levels: lv, snaps: function () { return [r2rStart[id]]; }, onEnd: refreshLedger,
          bubble: function (v) { return (f.unit === '£' ? '£' : '') + v + (f.unit === '%' ? '%' : ''); } };
        var row = h('div', 'rent-row'), l1 = h('div', 'rent-l1'), lab = h('label', '', f.label); lab.setAttribute('for', 'lg-' + id);
        if (f.note) lab.appendChild(h('span', 'unit', ' · ' + f.note.replace('per room, per month', 'per room/month')));
        var w = h('div', 'rent-in'), inp = numBox({ id: 'lg-' + id, decimal: true, label: f.label, get: function () { return cur(id); }, show: function (v) { return String(v); }, set: function (v) { setFig(id, v); }, example: function () { return !isTyped(id); } });
        if (f.unit === '£') w.appendChild(h('span', '', '£')); w.appendChild(inp); if (f.unit === '%') w.appendChild(h('span', '', '%'));
        l1.appendChild(lab); l1.appendChild(w); row.appendChild(l1);
        var l2 = h('div', 'lg-l2'), sl = scrubber(o); l2.appendChild(nudge(-1, o, 'sm')); l2.appendChild(sl); l2.appendChild(nudge(1, o, 'sm')); row.appendChild(l2);
        fd.body.appendChild(row);
        R.push(function () { rtop.grow(); inp._sync(); sl._sync(); });
      });
      R.push(function (v, st) { fd.sum.textContent = summary(v, st); });
      fig.appendChild(fd.card);
    };
    rentFold('let', M.letTitle, M.let, key === 'r2rhmo'
      ? function (v, st) { return num(st.rooms) + ' rooms at ' + money(num(st.roomRate)) + ' · ' + money(num(v.income)) + ' a month'; }
      : function (v, st) { var r = num(st.rooms); return r + ' room' + (r === 1 ? '' : 's') + ' at ' + money(num(st.nightlyRate)) + ' a night · ' + num(st.occupancyPct) + '% full'; });
    rentFold('run', 'Running costs', M.run, function (v, st) { return money(num(v.expenses) - num(st.rentPaid)) + ' a month on top of the rent'; });

    // ---- Results: the stat grid, the monthly breakdown, back to the figures ----
    var tiles = h('div', 'lg-tiles'); res.appendChild(tiles);
    var T = { monthly: tile('Monthly profit (target ' + money(Calc.MONTHLY_PROFIT_TARGET) + ')'), annual: tile('Annual profit (target ' + money(Calc.MONTHLY_PROFIT_TARGET * 12) + ')'),
      back: tile('Money back (green ≤ ' + Calc.targets().payback + ', amber ≤ ' + Calc.PAYBACK_OK + ')'), roi: tile('ROI on money in (target ' + roiPct() + ')'),
      income: tile('Income a month'), costs: tile('Costs a month, incl. rent') };
    ['monthly', 'annual', 'back', 'roi', 'income', 'costs'].forEach(function (k) { tiles.appendChild(T[k].el); });
    var brk = h('section', 'lg-card r2r-brk'); res.appendChild(brk);
    R.push(function (v, st) {
      var mv = Calc.monthlyProfitVerdict(v.monthly), none = num(v.totalIn) <= 0, bv = Calc.paybackVerdict(v.breakeven, none ? 0 : v.totalIn), rv = none ? 'good' : Calc.cashRoiVerdict(v.roi);
      T.monthly.val.textContent = money2(num(v.monthly)) + tickOf(mv); T.monthly.val.className = 'fig ' + (mv || '');
      T.annual.val.textContent = money(num(v.annual)) + tickOf(mv); T.annual.val.className = 'fig ' + (mv || '');
      T.back.val.textContent = none ? '—' : typeof v.breakeven === 'number' && isFinite(v.breakeven) ? fmt('months', v.breakeven) : 'Never at this profit'; T.back.val.className = 'fig ' + bv;
      T.roi.val.textContent = (none ? '∞' : pctText(v.roi)) + tickOf(rv); T.roi.val.className = 'fig ' + (rv || '');
      T.income.val.textContent = money(num(v.income)); T.costs.val.textContent = money(num(v.expenses));
      var rent = num(st.rentPaid), rows = [['Income', money(num(v.income)), ''], ['Rent you pay', minusMoney(-rent), ''], ['Other running costs', minusMoney(-(num(v.expenses) - rent)), ''],
        ['Monthly profit', minusMoney(Math.round(num(v.monthly))), 'strong ' + (mv || '')], ['Total money in', money(num(v.totalIn)), '']];
      brk.innerHTML = ''; rows.forEach(function (r) { var sr = statRow(r[0], r[2]); sr.val.textContent = r[1]; if (/strong/.test(r[2])) sr.row.classList.add('strong'); brk.appendChild(sr.row); });
    });
    var backBtn = h('button', 'lg-back', '← Change the figures'); backBtn.type = 'button'; backBtn.onclick = function () { VS.set('figures', true); }; res.appendChild(backBtn);

    var foot = h('p', 'lg-foot', 'Buying it instead? '), brr = h('button', 'lg-link', 'Buy, refurb & refinance →'); brr.type = 'button'; brr.onclick = function () { location.hash = '#c/brr'; }; foot.appendChild(brr); page.appendChild(foot);
    page.appendChild(legalFooter('Check your landlord’s consent and the contract before you sign.'));
    VS.set(ledgerView, false);
    var sbar = $('sticky-bar'); sbar.innerHTML = ''; sbar.hidden = true;
    refreshLedger();
  }

  function renderCalculator() {
    var box = $('v-home'); box.innerHTML = ''; nodes = { calcs: [], banners: [], res: null, mp: null, plan: null, ledger: null };
    var st = stratByKey(calcKey) || stratByKey('brr'); calcKey = st.key;
    var plan = st.key === 'brr' ? Calc.simplePlan('brr', brrLet) : null;
    current = Calc.find(plan ? plan.calcId : st.calc); nodes.plan = plan;
    document.body.classList.toggle('ledger', !!plan || !!R2R_MODES[st.key]);
    if (plan) { renderLedger(box); return; }
    if (R2R_MODES[st.key]) { renderR2R(box, st.key); return; }
    box.appendChild(h('p', 'eyebrow', 'Calculator'));
    box.appendChild(h('h1', 'hero', st.key === 'recycle' ? 'What can you pay?' : 'Run the numbers'));
    box.appendChild(h('p', 'lede', st.key === 'recycle' ? 'The most you can pay and still pull every pound back out when you refinance.' : plan ? 'Five figures. The result updates as you type.' : 'Pick a strategy and enter your figures. The result updates as you type.'));

    // Calculator and Max price come first; the rent-based ones sit behind "More".
    var inMain = MAIN_STRATS.indexOf(st.key) >= 0, open = stratMore || !inMain;
    var picker = h('div', 'strat-pills' + (open ? ' open' : ''));
    STRATS.forEach(function (x) {
      if (open ? false : MAIN_STRATS.indexOf(x.key) < 0) return;
      var b = h('button', 'strat-pill', x.name); b.setAttribute('aria-pressed', x.key === st.key);
      b.onclick = function () { location.hash = '#c/' + x.key; };
      picker.appendChild(b);
    });
    var more = h('button', 'strat-pill more', open ? 'Fewer' : 'More (' + (STRATS.length - MAIN_STRATS.length) + ')'); more.setAttribute('aria-expanded', open);
    more.onclick = function () { stratMore = !open; renderCalculator(); };
    picker.appendChild(more); box.appendChild(picker);
    box.appendChild(h('p', 'strat-help', STRAT_HELP[st.key]));

    // ---- the result card ----
    var card = h('section', 'result-card');
    if (st.key === 'recycle') {
      var top = h('div', 'vc-top'), chip = h('span', 'verdict-chip', ''), ltv = h('span', 'faint', '');
      top.appendChild(chip); top.appendChild(ltv); card.appendChild(top);
      var hero = h('div', 'hero-fig fig'), cap = h('div', 'vc-cap'); card.appendChild(hero); card.appendChild(cap);
      var rowsBox = h('div'); card.appendChild(rowsBox);
      nodes.mp = { chip: chip, ltv: ltv, hero: hero, cap: cap, rows: rowsBox };
    } else {
      var hero2 = h('div', 'hero-fig fig'), cap2 = h('div', 'vc-cap'), line = h('p', 'rc-line'); card.appendChild(hero2); card.appendChild(cap2); card.appendChild(line);
      var resDef = RESULTS[st.key];
      var rows = resDef.rows.map(function (r) { var el = ledgerRow(r[0], '', ''); card.appendChild(el); return { el: el, val: el.querySelector('b'), def: r }; });
      nodes.res = { hero: hero2, cap: cap2, line: line, rows: rows, def: resDef };
    }
    box.appendChild(card);

    // ---- the figures (inputs only; the working sits below) ----
    var working = [];
    box.appendChild(h('p', 'eyebrow sect', 'Your figures'));
    current.layout.forEach(function (sec, idx) {
      var fig = h('section', 'fig-card'), any = false;
      if (current.layout.length > 1 && !(st.key === 'recycle')) fig.appendChild(h('h2', '', sec.title));
      sec.items.forEach(function (it) {
        if (it.field) { fig.appendChild(buildField(it.field)); any = true; }
        else if (it.choice) { fig.appendChild(buildChoice(it.choice)); any = true; }
        else if (it.note) fig.appendChild(h('p', 'note', it.note));
        else if (it.banner) { var bn = h('div', 'banner', it.banner.text); bn.hidden = true; fig.appendChild(bn); nodes.banners.push([it.banner.id, bn]); }
        else if (it.calc.id === 'sdlt') readonlyRow(fig, it.calc);
        else working.push([sec.title, it.calc]);
      });
      if (any) box.appendChild(fig);
    });
    nodes.note = h('p', 'note fig-note'); box.appendChild(nodes.note);
    var ul = h('button', 'text-link', 'Set my usual figures \u2192'); ul.onclick = function () { location.hash = '#usual'; }; box.appendChild(ul);
    var cl = h('button', 'text-link', 'Compare every strategy for this deal \u2192'); cl.onclick = function () { location.hash = '#compare'; }; box.appendChild(cl);

    if (st.key === 'recycle') {
      box.appendChild(h('p', 'eyebrow sect', 'Test an offer'));
      var oc = h('section', 'fig-card'), orow = h('div', 'row'), olab = h('label', '', 'If you pay'); olab.setAttribute('for', 'f-offer'); olab.appendChild(h('small', '', 'Optional'));
      var owrap = h('div', 'f pre'), oin = h('input'); oin.id = 'f-offer'; oin.setAttribute('inputmode', 'decimal'); oin.setAttribute('autocomplete', 'off'); oin.value = offerText;
      oin.addEventListener('input', function () { offerText = oin.value; update(); }); oin.addEventListener('focus', function () { oin.select(); });
      owrap.appendChild(h('span', '', '\u00a3')); owrap.appendChild(oin); orow.appendChild(olab); orow.appendChild(owrap); oc.appendChild(orow);
      var ores = ledgerRow('Enter a price to test', '\u2014', ''); ores.classList.add('total'); oc.appendChild(ores); box.appendChild(oc);
      nodes.mp.offerLabel = ores.querySelector('span'); nodes.mp.offerVal = ores.querySelector('b');
      box.appendChild(h('p', 'note fig-note', 'Max price = LTV \u00d7 end value \u2212 refurb \u2212 legal \u2212 stamp duty. Stamp duty is worked out at the price the calculator finds.'));
    }
    // the working: every computed row the old calculator screens showed, tucked away
    if (working.length) {
      var det = h('details', 'working'), sum = h('summary', '', 'Show the working'); det.appendChild(sum);
      var body = h('section', 'fig-card'), last = null;
      working.forEach(function (w) {
        if (w[0] !== last) { body.appendChild(h('h2', '', w[0])); last = w[0]; }
        var k = w[1], row = h('div', 'calc'), lab = h('span'), val = h('b', 'fig');
        if (k.bold) lab.appendChild(h('b', '', k.label)); else lab.textContent = k.label;
        if (k.note) lab.appendChild(h('small', '', k.note));
        row.appendChild(lab); row.appendChild(val); body.appendChild(row); nodes.calcs.push([k, val, row, w[2]]);
      });
      det.appendChild(body); box.appendChild(det);
    }
    if (current.showsEffect) buildEffectSection(box);

    // ---- the bar above the tabs ----
    var bar = $('sticky-bar'); bar.innerHTML = '';
    var save = h('button', 'sec', 'Save'), go = h('button', 'primary', st.key === 'recycle' ? 'Use as my offer' : 'Compare all strategies');
    save.onclick = saveDeal;
    go.onclick = function () {
      if (st.key !== 'recycle') { location.hash = '#compare'; return; }
      var v = current.compute(Calc.stateFor(current, eff(deal))).v;
      if (v.impossible) return;
      deal.purchasePrice = v.maxPrice; store(DEAL, deal); location.hash = '#c/brr';
    };
    bar.appendChild(save); bar.appendChild(go); bar.hidden = false; nodes.go = go;
    update();
  }

  // ---- a calculator, built from its spec -------------------------------------------------------
  function buildField(f) {
    var row = h('div', 'row'), lab = h('label', '', f.label); lab.setAttribute('for', 'f-' + f.id);
    if (f.note) lab.appendChild(h('small', '', f.note));
    var wrap = h('div', 'f' + (f.unit === '£' ? ' pre' : f.unit === '%' ? ' suf' : ''));
    var input = h('input'); input.id = 'f-' + f.id; input.setAttribute('inputmode', 'decimal'); input.setAttribute('autocomplete', 'off');
    var mine = Object.prototype.hasOwnProperty.call(deal, f.id);
    var usualHere = !mine && Object.prototype.hasOwnProperty.call(usual, f.id) && usual[f.id] !== '';
    input.value = mine ? deal[f.id] : usualHere ? usual[f.id] : (f.def === '' ? '' : f.def);
    if (!mine && !usualHere && f.def !== '') input.classList.add('ex');
    input.addEventListener('input', function () {
      deal[f.id] = input.value; input.classList.remove('ex'); store(DEAL, deal); update();
    });
    input.addEventListener('focus', function () { input.select(); });
    if (f.unit === '£') wrap.appendChild(h('span', '', '£'));
    wrap.appendChild(input);
    if (f.unit === '%') wrap.appendChild(h('span', '', '%'));
    row.appendChild(lab); row.appendChild(wrap);
    return row;
  }
  // A choice field (pills), e.g. how a bridging loan's interest is charged. Toggling a pill updates the pressed
  // state of just this row and recomputes, rather than rebuilding the screen — nothing else on the page loses
  // focus or scroll position (the onboarding letting-type pills lost typed figures this way; see its own fix).
  function buildChoice(ch) {
    var wrap = h('div', 'choice'), lab = h('label', '', ch.label);
    if (ch.note) lab.appendChild(h('small', '', ch.note));
    wrap.appendChild(lab);
    var pills = h('div', 'pills'), have = Object.prototype.hasOwnProperty.call(deal, ch.id) ? deal[ch.id] : ch.def;
    ch.options.forEach(function (o) {
      var b = h('button', '', o[1]); b.setAttribute('aria-pressed', have === o[0]);
      b.onclick = function () {
        deal[ch.id] = o[0]; store(DEAL, deal);
        var kids = pills.children; for (var i = 0; i < kids.length; i++) kids[i].setAttribute('aria-pressed', kids[i] === b);
        update();
      };
      pills.appendChild(b);
    });
    wrap.appendChild(pills); return wrap;
  }
  // A short, plain sentence for the verdict panel. Built from the calculator's own numbers, not invented copy.
  function verdictSentence(c, v) {
    var roiTxt = fmt('pct', v.roi);
    if (v.cashLeft != null) {
      if (v.moneyOut) return 'You would take more out in the refinance than you put in, so there is nothing left in the deal to measure a return against.';
      return 'Once refinanced, this leaves ' + money(v.cashLeft) + ' in the deal, returning ' + roiTxt + ' a year on that money.'
        + (v.paybackOk ? ' The rent gets that cash back in ' + fmt('months', v.breakeven) + ', inside the 2 years a BRR is allowed.' : '');
    }
    if (typeof v.roi !== 'number') return 'Not enough is entered yet to work out a return.';
    return 'This returns ' + roiTxt + ' a year on the ' + money(v.totalIn) + ' you put in.';
  }
  // The bridging screen's "effect on your deal": for each strategy that refinances, what happens to the cash
  // left in the deal and its ROI if this bridge funds it. Live nodes are kept so update() can refresh them
  // on every keystroke, on this screen or on the deal's own screen, without rebuilding the section.
  function buildEffectSection(box) {
    box.appendChild(h('h3', '', 'Effect on your deal'));
    box.appendChild(h('p', 'lede', 'If one of these funds its purchase and refurb with this bridge, here is what changes once it refinances. Nothing else about the deal moves — only what is left trapped.'));
    nodes.effect = [];
    Calc.bridgingEffect({}).forEach(function (e) {
      var card = h('button', 'cmp'), top = h('div', 'top'), nm = h('span', 'nm', e.name);
      var right = h('div'), big = h('div', 'big fig'), cap = h('div', 'cap', 'ROI once refinanced, with this bridge');
      right.appendChild(big); right.appendChild(cap); top.appendChild(nm); top.appendChild(right); card.appendChild(top);
      var st = h('div', 'st');
      var cashBefore = stat('Cash left, without a bridge', ''), cashAfter = stat('Cash left, with this bridge', '');
      var roiBefore = stat('ROI, without a bridge', ''), cost = stat('Extra cost of bridging', '');
      st.appendChild(cashBefore); st.appendChild(cashAfter); st.appendChild(roiBefore); st.appendChild(cost);
      card.appendChild(st); card.onclick = function () { goCalc(e.id); }; box.appendChild(card);
      nodes.effect.push({ id: e.id, big: big, cap: cap, cashBefore: cashBefore.querySelector('b'), cashAfter: cashAfter.querySelector('b'), roiBefore: roiBefore.querySelector('b'), cost: cost.querySelector('b') });
    });
  }
  function updateEffectSection() {
    if (!nodes.effect) return;
    var rows = Calc.bridgingEffect(deal), byId = {}; rows.forEach(function (r) { byId[r.id] = r; });
    nodes.effect.forEach(function (n) {
      var e = byId[n.id]; if (!e) return;
      n.big.textContent = e.moneyOutAfter ? '—' : fmt('pct', e.roiAfter); if (e.moneyOutAfter) tone(n.big, null); else setCashRoi(n.big, e.roiAfter);
      n.cap.textContent = e.moneyOutAfter ? 'Still money out even with this bridge' : 'ROI once refinanced, with this bridge';
      n.cashBefore.textContent = money(e.cashLeftBefore); n.cashAfter.textContent = money(e.cashLeftAfter);
      n.roiBefore.textContent = e.moneyOutBefore ? '—' : fmt('pct', e.roiBefore); n.cost.textContent = money(e.bridgeCost);
    });
  }
  function update() {
    if (nodes.ledger) { refreshLedger(); return; }
    if (!current || (!nodes.res && !nodes.mp)) return;
    var s = Calc.stateFor(current, eff(deal)), v = current.compute(s).v;
    nodes.calcs.forEach(function (x) {
      var k = x[0], val = v[k.id];
      x[1].textContent = k.verdict === 'flip' ? flipMarginText(val) : k.verdict === 'cashRoi' ? cashRoiText(val) : fmt(k.fmt, val); if (k.tone) tone(x[1], val);
      if (k.verdict === 'flip') setVerdict(x[1], val);
      if (k.verdict === 'cashRoi') setCashRoi(x[1], val);
      if (k.hideZero) x[2].hidden = !val;
    });
    nodes.banners.forEach(function (x) { x[1].hidden = !v[x[0]]; });
    updateEffectSection();
    if (nodes.res) {
      var hv = heroOf(nodes.res.def.hero, v);
      nodes.res.hero.textContent = hv.text; nodes.res.hero.className = 'hero-fig fig ' + hv.cls; nodes.res.cap.textContent = hv.cap;
      nodes.res.rows.forEach(function (r) {
        var val = v[r.def[1]]; r.val.textContent = typeof val === 'string' && val.charAt(0) === '\u221e' ? '\u221e' : fmt(r.def[2], val);
        r.val.className = 'fig'; if (r.def[3]) tone(r.val, val);
        // Nothing left in the deal means nothing to get back, so there is no payback time to show.
        if (r.def[1] === 'breakeven' && typeof v.cashLeft === 'number' && v.cashLeft <= 0) r.val.textContent = '\u2014';
      });
      nodes.res.line.hidden = !explanationsOn() || current.costOnly || !!nodes.res.def.noLine;
      if (!nodes.res.line.hidden) nodes.res.line.textContent = verdictSentence(current, v);
    } else if (nodes.mp) {
      var ok = !v.impossible, mp = nodes.mp, loan = v.newMortgage, refurb = Number(s.refurb) || 0, legal = Number(s.legal) || 0, other = Number(s.otherUpfront) || 0;
      var offer = Number(String(offerText).replace(/[^0-9.]/g, '')) || 0, left = null, kind = null;
      if (offer) { left = Calc.cashLeftAtPrice(s, offer).cashLeft; kind = Calc.cashKind(left); }
      // With a price entered the chip says what that price does; otherwise it describes the max price.
      var chipText = !ok ? 'Doesn\u2019t recycle' : kind === 'in' ? money(Math.round(left)) + ' left in' : kind === 'out' ? money(Math.round(-left)) + ' pulled out' : 'All capital back';
      mp.chip.textContent = chipText; mp.chip.className = 'verdict-chip ' + (!ok ? 'REJECT' : kind === 'in' ? 'WATCH' : 'PURSUE');
      mp.ltv.textContent = 'at ' + (Number(s.ltv) || 0) + '% LTV';
      mp.hero.textContent = ok ? money(v.maxPrice) : '\u2014'; mp.hero.className = 'hero-fig fig ' + (ok ? 'good' : 'bad');
      mp.cap.textContent = ok ? 'Pay this or less and you leave nothing in the deal' : 'Refurb and costs exceed the refinance \u2014 no price works';
      mp.rows.innerHTML = '';
      mp.rows.appendChild(ledgerRow('End value (GDV)', money(Number(s.endValue) || 0), ''));
      mp.rows.appendChild(ledgerRow('Refinance at ' + (Number(s.ltv) || 0) + '% of end value', money(loan), ''));
      mp.rows.appendChild(ledgerRow('Less refurb', '\u2212' + money(refurb), ''));
      mp.rows.appendChild(ledgerRow('Less legal fees', '\u2212' + money(legal), ''));
      if (other) mp.rows.appendChild(ledgerRow('Less other costs', '\u2212' + money(other), ''));
      mp.rows.appendChild(ledgerRow('Less stamp duty (worked out at this price)', '\u2212' + money(v.sdlt), ''));
      var tot = ledgerRow('Max purchase price', ok ? money(v.maxPrice) : '\u2014', ok ? 'good' : 'bad'); tot.classList.add('total'); mp.rows.appendChild(tot);
      // The signed figure: plus = cash still in the deal, minus = cash pulled out (e.g. -\u00a3600). Shown in the card and under "Test an offer".
      var signed = left == null ? '\u2014' : (kind === 'out' ? '\u2212' : '') + money(Math.abs(Math.round(left))), tone2 = kind === 'in' ? 'amber' : 'good';
      var sLabel = left == null ? 'Enter a price to test' : 'Cash left in the deal' + (kind === 'out' ? ' (minus = pulled out)' : '');
      if (left != null) { var orow = ledgerRow('Cash left at ' + money(offer), signed, tone2); orow.classList.add('total'); mp.rows.appendChild(orow); }
      mp.offerLabel.textContent = sLabel; mp.offerVal.textContent = signed; mp.offerVal.className = 'fig ' + (left == null ? '' : tone2);
      if (nodes.go) nodes.go.disabled = !ok;
    }
    if (nodes.note) {
      var n = exampleCount(current); nodes.note.textContent = n ? plural(n, 'figure') + ' still the spreadsheet example (grey italics) \u2014 type over them to use your own. Figures carry across strategies, so you only type a price once.' : 'Every figure here is yours. Figures carry across strategies, so you only type a price once.';
    }
  }

  // ---- saved deals -----------------------------------------------------------------------------
  // A saved deal is the whole shared deal plus the calculator it was saved from.
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  // Every saved deal needs a stable id so it can be ticked for comparison; deals saved before that get one here.
  function getDeals() {
    var list = load(DEALS, []), changed = false;
    list.forEach(function (d) { if (!d.id) { d.id = newId(); changed = true; } if (!d.savedAt) { d.savedAt = Date.now(); changed = true; } });
    if (changed) store(DEALS, list);
    return list;
  }
  function saveDeal() {
    var name = prompt('Name this deal (e.g. the address)'); if (!name) return;
    var list = getDeals(); list.unshift({ id: newId(), v: 2, calc: current.id, view: calcKey, letting: brrLet, bridge: bridgeOn, name: name.trim(), data: eff(deal), savedAt: Date.now() }); store(DEALS, list);
    alert('Saved. Find it under Saved.');
  }
  function dealData(d) { return d.v === 2 ? d.data : Calc.migrate(d.calc || 'flip', d.data); }
  function relTime(ms) {
    var days = Math.floor((Date.now() - ms) / 86400000);
    if (days <= 0) return 'today'; if (days === 1) return 'yesterday'; if (days < 30) return plural(days, 'day') + ' ago';
    var months = Math.floor(days / 30); if (months < 12) return plural(months, 'month') + ' ago';
    return plural(Math.floor(months / 12), 'year') + ' ago';
  }
  var sel = {};                                   // ticked saved deals, by id (kept while the app is open)
  var savedAs = '';                               // '' = each deal through the calculator it was saved from
  function openDeal(d, calcId) {
    deal = Object.assign({}, dealData(d)); store(DEAL, deal); ledgerStart = null;
    if (typeof d.bridge === 'boolean') { bridgeOn = d.bridge; store(BRIDGE_KEY, bridgeOn); }
    if (d.view === 'flip' || d.view === 'brr') { setLet(d.view === 'brr' && d.letting ? d.letting : 'none'); location.hash = '#c/brr'; }
    else if (calcId === 'flip') { setLet('none'); location.hash = '#c/brr'; }     // saved before the screens merged: the basics show both flip and refinance
    else goCalc(calcId);
  }
  function renderDeals() {
    var list = getDeals(), box = $('deals'); box.innerHTML = '';
    box.appendChild(h('p', 'eyebrow', 'SAVED')); box.appendChild(h('h1', 'hero', 'Your deals'));
    box.appendChild(h('p', 'lede', 'Kept on this device. Tick two or more to put them side by side.'));
    Object.keys(sel).forEach(function (id) { if (!list.some(function (d) { return d.id === id; })) delete sel[id]; });
    var listBox = h('div'); box.appendChild(listBox);
    if (!list.length) { listBox.appendChild(h('p', 'note', 'No saved deals yet. Open a calculator and tap Save this deal.')); return; }
    var bar = h('div', 'btns'), go = h('button', 'primary'); bar.appendChild(go); listBox.appendChild(bar);
    function refreshBar() {
      var n = Object.keys(sel).length; go.textContent = n >= 2 ? plural(n, 'deal') + ' selected · Compare' : 'Compare deals (tick 2 or more)'; go.disabled = n < 2;
    }
    go.onclick = function () { location.hash = '#saved-compare'; };
    list.forEach(function (d, i) {
      var c = Calc.find(d.calc || 'flip'); if (!c) return;
      var v = c.compute(Calc.stateFor(c, dealData(d))).v, row = h('div', 'deal'), open = h('button', 'open');
      var left = h('div'), name = h('div', '', d.name); left.appendChild(name);
      left.appendChild(h('div', 'meta', c.name + ' · ' + relTime(d.savedAt || Date.now())));
      var figs = h('div', 'figs'), roi = h('span', 'roi fig', fmt(c.summary[2][2], v[c.summary[2][1]]));
      // A cost figure (e.g. Bridging Loan's total cost) is never "good", so it is never coloured green — only an actual ROI is.
      if (!c.costOnly && !c.solver) { if (v.cashLeft != null) setCashRoi(roi, v[c.summary[2][1]]); else tone(roi, typeof v[c.summary[2][1]] === 'number' ? v[c.summary[2][1]] : null); }
      // A deal saved on the Flip exit shows its flip margin, coloured by the flip verdict, in place of the BTL ROI.
      if (c.id === 'flip' && (d.letting === 'none' || (!d.letting && d.view === 'flip'))) { roi.textContent = flipMarginText(v.margin); roi.className = 'roi fig ' + flipCls(v.margin); }
      figs.appendChild(roi); figs.appendChild(h('span', 'money fig', money(v.totalIn)));
      // Your own cash, only shown when a mortgage rolled into "money in" makes it a different number.
      if (typeof v.ownMoney === 'number' && Math.abs(v.ownMoney - v.totalIn) > 0.5) figs.appendChild(h('span', 'own fig', 'Own: ' + money(v.ownMoney)));
      var chk = h('label', 'chk'), box2 = h('input'); box2.type = 'checkbox'; box2.checked = !!sel[d.id]; box2.setAttribute('aria-label', 'Compare ' + d.name);
      box2.onchange = function () { if (box2.checked) sel[d.id] = true; else delete sel[d.id]; refreshBar(); };
      chk.appendChild(box2);
      open.appendChild(left); open.appendChild(figs);
      open.onclick = function () { openDeal(d, c.id); };
      var del = h('button', 'del', '×'); del.setAttribute('aria-label', 'Delete ' + d.name);
      del.onclick = function () { if (confirm('Delete "' + d.name + '"?')) { list.splice(i, 1); store(DEALS, list); delete sel[d.id]; renderDeals(); } };
      row.appendChild(chk); row.appendChild(open); row.appendChild(del); listBox.appendChild(row);
      var nr = h('div', 'note-row');
      var drawNote = function (editing) {
        nr.innerHTML = '';
        if (editing) {
          nr.appendChild(noteArea(d.note, function (v) { d.note = v; store(DEALS, list); }));
          var done = h('button', 'note-btn', 'Done'); done.onclick = function () { drawNote(false); }; nr.appendChild(done);
        } else {
          var nb = h('button', 'note-btn' + (d.note ? ' has' : ''), d.note ? d.note : 'Add a note'); nb.onclick = function () { drawNote(true); }; nr.appendChild(nb);
        }
      };
      drawNote(false); listBox.appendChild(nr);
    });
    refreshBar();
  }

  // ---- compare: the shared deal through every calculator ------------------------------------------
  var sortBy = 'roi';
  var SORTS = [['roi', 'ROI'], ['monthly', 'Monthly profit'], ['moneyIn', 'Money in']];
  function sortRows(rows) {
    var key = {
      roi: function (r) { return -Calc.rank(r.roi); },          // highest ROI first; "no cash left in" ranks top
      monthly: function (r) { return -r.monthly; },
      moneyIn: function (r) { return r.moneyIn; }               // least money in first
    }[sortBy];
    return rows.slice().sort(function (a, b) { var x = key(a), y = key(b); return x === y ? 0 : x < y ? -1 : 1; });
  }
  // ---- PDF export ----------------------------------------------------------------------------------
  // Short, unambiguous names for the PDF (the screen labels rely on the note beside them, which a list cannot show).
  var PDF_LABELS = { depositPct: 'Deposit %', endValue: 'End value', ltv: 'Refinance LTV %', mortgageRate: 'Mortgage rate %',
    monthlyRent: 'Monthly rent received', rentPaid: 'Rent you pay (monthly)', upfront: 'Deposit / up-front rent', roomRate: 'Room rate (per month)', nightlyRate: 'Room rate (per night)',
    occupancyPct: 'Occupancy %', mgmtPct: 'Management %', voidsPct: 'Maintenance / voids % of rent', maintPct: 'Maintenance % of income', maintOnMortgagePct: 'Maintenance % of mortgage',
    maintOnRentPct: 'Maintenance % of rent paid', commPct: 'Commission %', other: 'Other costs (monthly)', otherUpfront: 'Other costs', council: 'Council tax (monthly)',
    utilities: 'Utility bills (monthly)', channel: 'Channel manager (monthly)', insurance: 'Insurance (monthly)' };
  function fieldFor(id) {
    for (var i = 0; i < Calc.calcs.length; i++) for (var s = 0; s < Calc.calcs[i].layout.length; s++) {
      var items = Calc.calcs[i].layout[s].items;
      for (var k = 0; k < items.length; k++) if (items[k].field && items[k].field.id === id) return items[k].field;
    }
    return null;
  }
  function detailLines() {
    var out = [];
    // Other costs sit straight after legal costs, and only when there are any.
    var ids = Object.keys(deal).filter(function (id) { return id !== 'otherUpfront' || num(deal[id]) > 0; }), oi = ids.indexOf('otherUpfront'), li = ids.indexOf('legal');
    if (oi >= 0 && li >= 0) { ids.splice(oi, 1); ids.splice(ids.indexOf('legal') + 1, 0, 'otherUpfront'); }
    ids.forEach(function (id) {
      var f = fieldFor(id), v = deal[id]; if (!f || v === '' || v == null) return;
      out.push([PDF_LABELS[id] || f.label, f.unit === '£' ? money2(Number(v) || 0).replace(/\.00$/, '') : f.unit === '%' ? v + '%' : String(v)]);
    });
    var P = num(Calc.stateFor(FLIP_CALC, eff(deal)).purchasePrice);
    if (P > 0) out.push(['Stamp duty (' + Calc.taxLabel().short + ')', money(Calc.stampDuty(P))]);
    return out;
  }
  function sortLabel() { return SORTS.filter(function (s) { return s[0] === sortBy; })[0][1]; }
  function today() { return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function pdfRow(r, sub) {
    return { name: r.name, sub: sub, refinance: r.refinance, roi: fmt('pct', r.roi), monthly: money2(r.monthly), annual: money(r.annual), moneyIn: money(r.moneyIn),
      extra: r.refinance ? 'Left in ' + money(r.cashLeft) : (r.breakeven == null ? '-' : fmt('months', r.breakeven)) };
  }
  function pdfInput(data) {
    var f = data.flip;
    return {
      title: 'Deal comparison', sortLabel: sortLabel(), details: detailLines(), date: today(),
      rows: sortRows(data.rows).map(function (r) { return pdfRow(r); }),
      flip: { profit: money(f.profit), roi: fmt('pct', f.roi), moneyIn: money(f.moneyIn), marginVerdict: flipCls(f.margin) || null,
        margin: fmt('pct', f.margin) + flipNote(Calc.flipVerdict(f.margin)) }
    };
  }
  function savedPdfInput(rows) {
    return {
      title: 'Saved deals comparison', sortLabel: sortLabel(), details: null, flip: null, date: today(), tableTitle: 'SAVED DEALS', nameHeading: 'Deal',
      note: savedAs ? 'Every deal is run as ' + Calc.find(savedAs).name + ', using the figures saved with each deal.'
        : 'Each deal is run through the calculator it was saved from, using the figures saved with it. Estimates only.',
      rows: sortRows(rows).map(function (r) { return pdfRow(r, r.calcName); })
    };
  }
  function exportPdf(input, base) {
    var bytes;
    try { bytes = Pdf.build(input); } catch (e) { alert('Could not create the PDF.'); return; }
    var d = new Date(), pad = function (x) { return (x < 10 ? '0' : '') + x; };
    var name = base + '-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.pdf';
    var blob = new Blob([bytes], { type: 'application/pdf' });
    function download() {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    }
    var file = null; try { file = new File([blob], name, { type: 'application/pdf' }); } catch (e) {}
    // On a phone the share sheet lets you save to Files, email or message it; anywhere else it downloads.
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: input.title }).catch(function (e) { if (!e || e.name !== 'AbortError') download(); });
    } else download();
  }
  function stat(label, value, cls) { var d = h('div', '', label), b = h('b', cls || '', value); b.classList.add('fig'); d.insertBefore(b, d.firstChild); return d; }
  // One ranked card, used for strategies and for saved deals alike. sub is a small line under the name.
  function cardFor(r, i, sub, onOpen) {
    var card = h('button', 'cmp' + (i === 0 ? ' best' : '')), top = h('div', 'top'), nm = h('span', 'nm');
    nm.appendChild(h('small', '', '#' + (i + 1))); nm.appendChild(document.createTextNode(r.name));
    if (sub) nm.appendChild(h('div', 'sub', sub));
    var right = h('div'), big = h('div', 'big fig', r.refinance ? cashRoiText(r.roi) : fmt('pct', r.roi));
    if (r.refinance) setCashRoi(big, r.roi); else tone(big, typeof r.roi === 'number' ? r.roi : (Calc.rank(r.roi) === Infinity ? 1 : 0));
    right.appendChild(big); right.appendChild(h('div', 'cap', r.refinance ? 'ROI on cash left in' : 'ROI on money in'));
    top.appendChild(nm); top.appendChild(right); card.appendChild(top);
    var st = h('div', 'st');
    st.appendChild(stat('Monthly profit', money2(r.monthly), r.monthly < 0 ? 'bad' : ''));
    st.appendChild(stat('Annual profit', money(r.annual), r.annual < 0 ? 'bad' : ''));
    st.appendChild(stat('Money in', money(r.moneyIn)));
    st.appendChild(r.refinance ? stat('Left in after refinance', money(r.cashLeft)) : stat('Months to breakeven', r.breakeven == null ? '—' : fmt('months', r.breakeven)));
    // Only shown where it differs from Money in (a mortgage rolled into that figure) — elsewhere it would just repeat it.
    if (typeof r.ownMoney === 'number' && Math.abs(r.ownMoney - r.moneyIn) > 0.5) st.appendChild(stat('Your own money', money(r.ownMoney)));
    card.appendChild(st); card.onclick = onOpen;
    return card;
  }
  // ---- compare saved deals: the ticked deals side by side ---------------------------------------------
  var lastSavedRows = [];
  function renderSavedCompare() {
    var box = $('v-scompare'); box.innerHTML = '';
    box.appendChild(h('p', 'eyebrow', 'COMPARE')); box.appendChild(h('h1', 'hero', 'Deal against deal'));
    var ticked = getDeals().filter(function (d) { return sel[d.id]; });
    // Bridging Loan and Recycle Price are tools, not strategies: they have no monthly profit or ROI to rank.
    var picked = ticked.filter(function (d) { return Calc.calcs.indexOf(Calc.find(d.calc || 'flip')) >= 0; });
    if (picked.length < 2) {
      box.appendChild(h('p', 'lede', 'Tick two or more saved deals first, then tap Compare.' + (ticked.length > picked.length ? ' Deals saved from the Bridging Loan and Recycle Price tools cannot be ranked against strategies.' : '')));
      var back = h('button', 'pick', 'Go to saved deals'); back.onclick = function () { location.hash = '#saved'; }; box.appendChild(back); return;
    }
    if (ticked.length > picked.length) box.appendChild(h('p', 'note', (ticked.length - picked.length) + ' ticked deal(s) from the Bridging Loan or Recycle Price tools are left out — they are not strategies.'));
    box.appendChild(h('p', 'lede', 'Each deal runs through the calculator it was saved from. Different strategies measure ROI on different amounts, so pick one strategy for a like-for-like view.'));
    var row = h('div', 'row'), lab = h('label', '', 'Run every deal as'), pick = h('select'); lab.setAttribute('for', 'saved-as'); pick.id = 'saved-as';
    var o0 = h('option', '', 'Each as saved'); o0.value = ''; pick.appendChild(o0);
    Calc.calcs.forEach(function (c) { var o = h('option', '', c.name); o.value = c.id; pick.appendChild(o); });
    pick.value = savedAs; pick.onchange = function () { savedAs = pick.value; renderSavedCompare(); };
    row.appendChild(lab); row.appendChild(pick); box.appendChild(row);
    var chips = h('div', 'segmented');
    SORTS.forEach(function (s) {
      var b = h('button', '', s[1]); b.setAttribute('aria-pressed', sortBy === s[0]);
      b.onclick = function () { sortBy = s[0]; renderSavedCompare(); }; chips.appendChild(b);
    });
    box.appendChild(chips);
    var rows = Calc.compareDeals(picked.map(function (d) { return { id: d.id, name: d.name, calc: d.calc || 'flip', data: dealData(d) }; }), savedAs || undefined);
    lastSavedRows = rows;
    var exp = h('div', 'btns'), eb = h('button', '', 'Download PDF'), rb = h('button', 'primary', 'Client report');
    eb.onclick = function () { exportPdf(savedPdfInput(rows), 'saved-deals-comparison'); };
    rb.onclick = function () { openReport('saved'); };
    exp.appendChild(eb); exp.appendChild(rb); box.appendChild(exp);
    sortRows(rows).forEach(function (r, i) {
      var d = picked.filter(function (x) { return x.id === r.key; })[0];
      box.appendChild(cardFor(r, i, r.calcName, function () { openDeal(d, r.calcId); }));
    });
  }
  var lastDealData = null;
  function renderCompare() {
    var box = $('v-compare'); box.innerHTML = '';
    box.appendChild(h('p', 'eyebrow', 'COMPARE')); box.appendChild(h('h1', 'hero', 'Every strategy, one deal'));
    var entered = Object.keys(deal).length;
    box.appendChild(h('p', 'lede', entered
      ? 'Your ' + plural(entered, 'figure') + ' run through every calculator. Where a strategy needs something you have not entered, it uses the spreadsheet example, so fill those in for a fair fight.'
      : 'You have not entered a deal yet, so this compares the examples from your spreadsheets. Open a calculator and type your details in, then come back.'));
    var chips = h('div', 'segmented');
    SORTS.forEach(function (s) {
      var b = h('button', '', s[1]); b.setAttribute('aria-pressed', sortBy === s[0]);
      b.onclick = function () { sortBy = s[0]; renderCompare(); }; chips.appendChild(b);
    });
    box.appendChild(chips);
    var data = Calc.compareAll(eff(deal)); lastDealData = data;
    var exp = h('div', 'btns'), eb = h('button', '', 'Download PDF'), rb = h('button', 'primary', 'Client report');
    eb.onclick = function () { exportPdf(pdfInput(data), 'deal-comparison'); };
    rb.onclick = function () { openReport('deal'); };
    exp.appendChild(eb); exp.appendChild(rb); box.appendChild(exp);
    sortRows(data.rows).forEach(function (r, i) { box.appendChild(cardFor(r, i, null, function () { goCalc(r.id); })); });
    // A flip is a one-off profit, not income each year, so it is shown apart rather than ranked against them.
    var f = data.flip, fc = h('button', 'cmp'), ft = h('div', 'top'), fn = h('span', 'nm', 'Flip (sell after refurb)');
    fn.appendChild(h('span', 'tag', 'one-off'));
    var fr = h('div'), fb = h('div', 'big fig', money(f.profit)); tone(fb, f.profit); fr.appendChild(fb); fr.appendChild(h('div', 'cap', 'profit, not per year'));
    ft.appendChild(fn); ft.appendChild(fr); fc.appendChild(ft);
    var fs = h('div', 'st');
    fs.appendChild(stat('Net profit (of GDV)', flipMarginText(f.margin), flipCls(f.margin))); fs.appendChild(stat('Return on money in', fmt('pct', f.roi)));
    fs.appendChild(stat('Money in', money(f.moneyIn))); fs.appendChild(stat('Your own money', money(f.ownMoney)));
    fc.appendChild(fs); fc.onclick = function () { location.hash = '#c/flip'; }; box.appendChild(fc);
  }

  // ---- Client report: prepared for/by, a live paper preview, then the same PDF -------------------------
  var reportSource = 'deal';
  function openReport(source) { reportSource = source; location.hash = '#report'; }
  function reportRows() {
    if (reportSource === 'saved') return { rows: lastSavedRows, flip: null, base: savedPdfInput(lastSavedRows), kind: 'saved' };
    var data = lastDealData || Calc.compareAll(deal);
    return { rows: sortRows(data.rows), flip: data.flip, base: pdfInput(data), kind: 'deal' };
  }
  function paperPreview(input) {
    var p = h('div', 'paper');
    p.appendChild(h('div', 'p-eyebrow', input.tableTitle || 'DEAL COMPARISON'));
    p.appendChild(h('div', 'p-title', input.title));
    var meta = input.date + '   |   Ranked by ' + input.sortLabel;
    if (input.preparedFor) meta += '   |   Prepared for ' + input.preparedFor;
    p.appendChild(h('div', 'p-meta', meta));
    var head = h('div', 'p-row head');
    [input.nameHeading || 'Strategy', 'ROI', 'Monthly', 'Money in'].forEach(function (t) { head.appendChild(h('span', '', t)); });
    p.appendChild(head);
    input.rows.slice(0, 8).forEach(function (r, i) {
      var row = h('div', 'p-row' + (i === 0 ? ' p-best' : ''));
      [r.name, r.roi, r.monthly, r.moneyIn].forEach(function (t) { row.appendChild(h('span', '', t)); });
      p.appendChild(row);
    });
    if (input.rows.length > 8) p.appendChild(h('div', 'p-meta', '+ ' + (input.rows.length - 8) + ' more on the PDF'));
    return p;
  }
  function renderReport() {
    var box = $('v-report'); box.innerHTML = '';
    box.appendChild(h('p', 'eyebrow', 'CLIENT REPORT')); box.appendChild(h('h1', 'hero', 'Deal against deal, on paper'));
    box.appendChild(h('p', 'lede', 'A one-page appraisal to send with the deal. What you see is what goes in the PDF.'));
    var forField = h('div', 'report-field'), forLab = h('label', '', 'Prepared for'), forIn = h('input');
    forLab.setAttribute('for', 'rep-for'); forIn.id = 'rep-for'; forIn.placeholder = 'Client name'; forIn.value = load(REPORT, {}).for || '';
    forField.appendChild(forLab); forField.appendChild(forIn); box.appendChild(forField);
    var byField = h('div', 'report-field'), byLab = h('label', '', 'Prepared by'), byIn = h('input');
    byLab.setAttribute('for', 'rep-by'); byIn.id = 'rep-by'; byIn.placeholder = 'Your name or company'; byIn.value = load(REPORT, {}).by || '';
    byField.appendChild(byLab); byField.appendChild(byIn); box.appendChild(byField);
    function saved() { return { for: forIn.value, by: byIn.value }; }
    [forIn, byIn].forEach(function (el) { el.addEventListener('input', function () { store(REPORT, saved()); renderPreview(); }); });
    var btns = h('div', 'btns'), dl = h('button', 'primary', 'Download PDF'); btns.appendChild(dl); box.appendChild(btns);
    var previewBox = h('div'); box.appendChild(previewBox);
    function renderPreview() {
      previewBox.innerHTML = '';
      var r = reportRows(), input = Object.assign({}, r.base, { preparedFor: forIn.value, preparedBy: byIn.value });
      previewBox.appendChild(paperPreview(input));
      dl.onclick = function () { exportPdf(input, r.kind === 'saved' ? 'client-report-saved-deals' : 'client-report'); };
    }
    renderPreview();
  }

  // ---- Onboarding: who you are, then the property basics -----------------------------------------------
  var onbStep = 0, onbPersona = load(PERSONA, ''), onbLetting = load(LETTING, '');
  function onbStep1() {
    var box = h('div', 'in');
    box.appendChild(dots(0));
    box.appendChild(h('h1', 'hero', 'How will you use it?'));
    box.appendChild(h('p', 'lede', 'This sets how much explanation you see. Change it any time.'));
    PERSONAS.forEach(function (p) {
      var opt = h('button', 'opt'); opt.setAttribute('aria-pressed', onbPersona === p[0]);
      var inner = h('div', 'opt-row'), radio = h('span', 'radio'), txt = h('div');
      txt.appendChild(h('b', '', p[1])); txt.appendChild(h('small', '', p[2]));
      inner.appendChild(radio); inner.appendChild(txt); opt.appendChild(inner);
      opt.onclick = function () { onbPersona = p[0]; renderOnboard(); };
      box.appendChild(opt);
    });
    var nav = h('div', 'onb-nav'), skip = h('button', 'link-btn', 'Skip'), cont = h('button', 'primary', 'Continue');
    cont.style.flex = '0 0 auto'; cont.style.padding = '0 28px';
    skip.onclick = finishOnboarding; cont.onclick = function () { if (!onbPersona) onbPersona = 'invest'; onbStep = 1; renderOnboard(); };
    nav.appendChild(skip); nav.appendChild(cont); box.appendChild(nav);
    return box;
  }
  function onbStep2() {
    var box = h('div', 'in');
    box.appendChild(dots(1));
    box.appendChild(h('h1', 'hero', 'Start with the property'));
    box.appendChild(h('p', 'lede', 'A few figures are enough to start comparing. Anything you leave uses the example from your spreadsheets, shown in grey italics.'));
    var s = h('section');
    var priceRow = h('div', 'row'), priceLab = h('label', '', 'Purchase price'), priceWrap = h('div', 'f pre'), priceIn = h('input');
    priceLab.setAttribute('for', 'ob-price'); priceIn.id = 'ob-price'; priceIn.inputMode = 'decimal'; priceIn.value = deal.purchasePrice || '';
    priceIn.placeholder = String(Calc.defaults(Calc.find('flip')).purchasePrice);
    // Written to the shared deal on every keystroke (not just at Continue) so a later re-render — e.g. tapping a
    // letting-type pill below, which rebuilds this whole step to update its pressed state â€” never loses it.
    priceIn.addEventListener('input', function () { if (priceIn.value !== '') deal.purchasePrice = priceIn.value; else delete deal.purchasePrice; store(DEAL, deal); });
    priceWrap.appendChild(h('span', '', '£')); priceWrap.appendChild(priceIn); priceRow.appendChild(priceLab); priceRow.appendChild(priceWrap); s.appendChild(priceRow);
    var endRow = h('div', 'row'), endLab = h('label', '', 'End value after any refurb'), endWrap = h('div', 'f pre'), endIn = h('input');
    endLab.setAttribute('for', 'ob-end'); endIn.id = 'ob-end'; endIn.inputMode = 'decimal'; endIn.value = deal.endValue || '';
    endIn.placeholder = String(Calc.defaults(Calc.find('flip')).endValue);
    endIn.addEventListener('input', function () { if (endIn.value !== '') deal.endValue = endIn.value; else delete deal.endValue; store(DEAL, deal); });
    endWrap.appendChild(h('span', '', '£')); endWrap.appendChild(endIn); endRow.appendChild(endLab); endRow.appendChild(endWrap); s.appendChild(endRow);
    box.appendChild(s);
    box.appendChild(h('p', '', 'How would you let it?')).style.fontWeight = '600';
    var pills = h('div', 'pills');
    LETTINGS.forEach(function (l) {
      var b = h('button', '', l[1]); b.setAttribute('aria-pressed', onbLetting === l[0]); b.onclick = function () { onbLetting = l[0]; renderOnboard(); }; pills.appendChild(b);
    });
    box.appendChild(pills);
    var note = LETTINGS.filter(function (l) { return l[0] === onbLetting; })[0];
    box.appendChild(h('p', 'note', note && note[0] === 'hmo' ? 'Rent per room each month. Used by HMO BTL, BRR to HMO and R2R HMO. Renting it rather than buying? The rent-to-rent calculators ask what you pay the landlord.'
      : note && note[0] === 'sa' ? 'Nightly rate and occupancy. Used by SA BTL, BRR to SA and R2R SA.'
        : note && note[0] === 'single' ? 'Monthly rent. Used by BTL and Flip / BRR to BTL.' : 'You can try every calculator either way — nothing here locks you in.'));
    var nav = h('div', 'onb-nav'), back = h('button', 'link-btn', 'Back'), cont = h('button', 'primary', 'Continue');
    cont.style.flex = '0 0 auto'; cont.style.padding = '0 28px';
    back.onclick = function () { onbStep = 0; renderOnboard(); };
    cont.onclick = finishOnboarding;
    nav.appendChild(back); nav.appendChild(cont); box.appendChild(nav);
    return box;
  }
  function dots(activeIdx) { var d = h('div', 'dots'); for (var i = 0; i < 3; i++) d.appendChild(h('i', i <= activeIdx ? 'on' : '')); return d; }
  function renderOnboard() {
    var box = $('v-onboard'); box.innerHTML = '';
    box.appendChild(onbStep === 0 ? onbStep1() : onbStep2());
  }
  function finishOnboarding() {
    store(PERSONA, onbPersona || ''); store(LETTING, onbLetting || '');
    if (load(EXPLAIN, null) == null) store(EXPLAIN, onbPersona === 'new');
    store(ONBOARDED, true);
    $('v-onboard').hidden = true; document.body.classList.remove('locked');
    route();
  }
  function startOnboarding() {
    onbStep = 0; onbPersona = load(PERSONA, ''); onbLetting = load(LETTING, '');
    closeSettings(); $('v-onboard').hidden = false; document.body.classList.add('locked'); renderOnboard();
  }

  // ---- My usual figures: set once, applied to every deal until a deal has its own ----------------------------
  var USUAL_FIELDS = [
    ['Buying costs', [['legal', 'Legal costs', '£', 'Your solicitor, per purchase'], ['otherUpfront', 'Other costs up front', '£', 'Survey, broker, finance fees']]],
    ['Finance', [['ltv', 'Re-mortgage LTV', '%', 'How much of the end value the lender pays out'], ['depositPct', 'Deposit', '%', 'Of the purchase price, on a mortgaged purchase'], ['mortgageRate', 'Mortgage rate', '%', 'Interest rate on your mortgage']]],
    ['Letting', [['mgmtPct', 'Management', '%', 'Letting agent fee, % of rent']]]];
  // ---- My usual figures (design 9b, 7 Oct 2026): a pinned header card like the Calculator's answer panel, then the
  // same three groups as cards, each figure with its typed value and the Calculator's − / slider / + . An unset figure
  // shows the spreadsheet example in faint ink with a muted slider ("Example from the spreadsheet"); touching it makes it
  // yours ("Yours", and "Example £X ↺" puts the example back). Saved to USUAL_KEY on every change, as before.
  var USUAL_RANGE = { legal: [0, 5000, 50, [50, 10, 5]], otherUpfront: [0, 10000, 50, [50, 10, 5]], ltv: [50, 85, 1, [1, 1, 1]], depositPct: [5, 40, 1, [1, 1, 1]],
    mortgageRate: [0, 10, 0.05, [0.05, 0.01, 0.01]], mgmtPct: [0, 20, 0.5, [0.5, 0.1, 0.1]] };
  var USUAL_IDS = []; USUAL_FIELDS.forEach(function (g) { g[1].forEach(function (f) { USUAL_IDS.push(f[0]); }); });
  function usualSet(id) { return Object.prototype.hasOwnProperty.call(usual, id) && String(usual[id]).trim() !== ''; }
  function usualCount() { return USUAL_IDS.filter(usualSet).length; }
  function usualExample(id) {
    var example = Calc.defaults(Calc.find('flip'))[id];
    if (example === undefined) example = Calc.defaults(Calc.find(id === 'otherUpfront' ? 'recycle' : 'btl'))[id];
    return num(example);
  }
  function renderUsual() {
    var box = $('v-usual'); box.innerHTML = ''; box.className = 'u9';
    var R = [], refresh = function () { R.forEach(function (f) { f(); }); };
    var save = function (id, v) { if (v === '' || v == null) delete usual[id]; else usual[id] = String(v); store(USUAL_KEY, usual); refresh(); };
    // the pinned header card
    var pin = h('div', 'pin u9-pin'), head = h('div', 'pin-head'), back = h('button', 'pin-back'), clear = h('button', 'u9-clear', 'Clear all');
    back.type = 'button'; clear.type = 'button'; back.setAttribute('aria-label', 'Back');
    back.appendChild(h('span', 'chev', '‹')); back.appendChild(h('span', 'pin-title', 'My usual figures')); back.onclick = goBack;
    clear.onclick = function () { usual = {}; store(USUAL_KEY, usual); refresh(); };
    head.appendChild(back); head.appendChild(clear); pin.appendChild(head);
    pin.appendChild(h('div', 'u9-lede', 'Set these once and every new deal starts with them. A figure you type on a deal still wins for that deal.'));
    var count = h('span', 'u9-count'); pin.appendChild(count); box.appendChild(pin);
    R.push(function () { var n = usualCount(); clear.hidden = !n; count.textContent = n ? n + ' of ' + USUAL_IDS.length + ' figures are yours' : 'All figures are spreadsheet examples'; count.classList.toggle('on', !!n); });
    USUAL_FIELDS.forEach(function (g) {
      box.appendChild(h('p', 'lg-h', g[0]));
      var card = h('section', 'u9-card');
      g[1].forEach(function (f) {
        var id = f[0], rr = USUAL_RANGE[id], unit = f[2], ex = usualExample(id), field = h('div', 'u9-field');
        var cur = function () { return usualSet(id) ? num(usual[id]) : ex; };
        var show = function (v) { return unit === '£' ? Math.round(v).toLocaleString('en-GB') : String(Number(Number(v).toFixed(2))); };
        var top = h('div', 'u9-top'), txt = h('span', 'u9-txt'), lab = h('label', '', f[1]); lab.setAttribute('for', 'u-' + id); txt.appendChild(lab); txt.appendChild(h('small', '', f[3]));
        var val = h('span', 'u9-val'), input = h('input'); input.id = 'u-' + id; input.setAttribute('inputmode', 'decimal'); input.setAttribute('autocomplete', 'off');
        input.addEventListener('focus', function () { setTimeout(function () { try { input.select(); } catch (e) {} }, 0); });
        input.addEventListener('input', function () { var raw = input.value.replace(/[^0-9.]/g, ''); save(id, raw === '' ? '' : raw); });   // an empty box goes back to the example
        input.addEventListener('blur', function () { input.value = show(cur()); });
        if (unit === '£') val.appendChild(h('span', 'u', '£')); val.appendChild(input); if (unit === '%') val.appendChild(h('span', 'u', '%'));
        top.appendChild(txt); top.appendChild(val); field.appendChild(top);
        var o = { label: f[1], get: cur, set: function (v) { save(id, Number(Number(v).toFixed(2))); }, min: rr[0], max: function () { return Math.max(rr[1], cur()); }, step: rr[2], levels: rr[3],
          snaps: function () { return [ex]; }, bubble: function (v) { return (unit === '£' ? '£' : '') + show(v) + (unit === '%' ? '%' : ''); } };
        var l2 = h('div', 'lg-l2'), sl = scrubber(o); l2.appendChild(nudge(-1, o, 'u9n')); l2.appendChild(sl); l2.appendChild(nudge(1, o, 'u9n')); field.appendChild(l2);
        var foot = h('div', 'u9-foot'), tag = h('span', 'u9-tag'), reset = h('button', 'u9-reset'); reset.type = 'button';
        reset.onclick = function () { save(id, ''); };
        foot.appendChild(tag); foot.appendChild(reset); field.appendChild(foot); card.appendChild(field);
        R.push(function () {
          var on = usualSet(id);
          if (document.activeElement !== input) input.value = show(cur());
          input.classList.toggle('ex', !on); sl.classList.toggle('ex', !on); sl._sync();
          tag.textContent = on ? 'Yours' : 'Example from the spreadsheet'; tag.classList.toggle('on', on);
          reset.hidden = !on; reset.textContent = 'Example ' + (unit === '£' ? money(ex) : show(ex) + '%') + ' ↺';
        });
      });
      box.appendChild(card);
    });
    box.appendChild(h('p', 'u9-note', 'Deals you have already saved keep the figures they were saved with.'));
    refresh();
  }

  // ---- Redraw the screen in place (after targets or the tax setting change), keeping the scroll position ----
  function redraw() { var y = window.scrollY; route(); window.scrollTo(0, y); }

  // ---- The stamp duty block: the amount, the basis, and (tapped) where the property is and who is buying ----------
  var taxOpen = false;
  var TAX_NOTES = {
    eng: { add: 'SDLT with the 5% surcharge on the whole price for additional homes (none under £40,000).', main: 'Standard SDLT rates for a home you will live in.', ftb: 'First-time buyer relief: nothing to pay up to £300,000, then 5% to £500,000. No relief above £500,000.' },
    sco: { add: 'LBTT plus the 8% Additional Dwelling Supplement on the whole price (none under £40,000).', main: 'Standard LBTT rates for a home you will live in.', ftb: 'LBTT with the first-time buyer nil band up to £175,000.' },
    wal: { add: 'LTT higher rates for additional homes (none under £40,000).', main: 'Standard LTT rates for a home you will live in.' } };
  function taxBlock(sdVal) {
    var wrap = h('div', 'tax-block'), head = h('button', 'tax-head'), left = h('span', 'tax-l'), sum = h('small'), right = h('span', 'tax-r'), chev = h('span', 'tax-chev');
    head.type = 'button'; left.appendChild(h('b', '', 'Stamp duty')); left.appendChild(sum); right.appendChild(sdVal); right.appendChild(chev);
    head.appendChild(left); head.appendChild(right); wrap.appendChild(head);
    var body = h('div', 'tax-body'); wrap.appendChild(body);
    function draw() {
      var t = Calc.taxSetting(), lab = Calc.taxLabel();
      sum.textContent = lab.tax + ' · ' + lab.place + ' · ' + lab.buyer; chev.textContent = taxOpen ? 'Done' : 'Change';
      head.setAttribute('aria-expanded', taxOpen); body.hidden = !taxOpen; body.innerHTML = '';
      if (!taxOpen) return;
      body.appendChild(h('div', 'tax-q', 'Where is the property?'));
      var regs = h('div', 'segmented tax-seg');
      [['eng', 'England & NI'], ['sco', 'Scotland'], ['wal', 'Wales']].forEach(function (r) {
        var b = h('button', '', r[1]); b.type = 'button'; b.setAttribute('aria-pressed', t.region === r[0]);
        b.onclick = function () { setTax({ region: r[0], buyer: load(TAX_STORE, {}).buyer || t.buyer }); }; regs.appendChild(b);
      });
      body.appendChild(regs);
      body.appendChild(h('div', 'tax-q', 'Who is buying?'));
      var buyers = h('div', 'tax-buyers'), wanted = load(TAX_STORE, {}).buyer || t.buyer;
      [['add', 'Additional property'], ['main', 'Main home'], ['ftb', 'First-time buyer']].forEach(function (k) {
        var dis = k[0] === 'ftb' && t.region === 'wal', b = h('button', '', k[1]); b.type = 'button'; b.disabled = dis;
        b.setAttribute('aria-pressed', !dis && t.buyer === k[0]);
        b.onclick = function () { if (!dis) setTax({ region: t.region, buyer: k[0] }); }; buyers.appendChild(b);
      });
      body.appendChild(buyers);
      body.appendChild(h('p', 'tax-note', TAX_NOTES[t.region][t.buyer] + (t.region === 'wal' ? ' Wales has no first-time buyer relief.' : '') + (t.region === 'wal' && wanted === 'ftb' ? ' Worked out as a main home.' : '')));
      body.appendChild(h('p', 'tax-rates', 'Rates as at October 2026. Your conveyancer confirms the final figure.'));
    }
    // The choice is kept as asked (a first-time buyer stays one), and calc.js works out what it means for that place.
    function setTax(t) { store(TAX_STORE, t); Calc.setTax(t); draw(); refreshLedger(); }
    head.onclick = function () { taxOpen = !taxOpen; draw(); };
    draw(); return wrap;
  }

  // ---- Footer under the Calculator: the disclaimer, the privacy policy and the targets ----
  function legalFooter(check) {
    var f = h('div', 'legal-foot'); f.appendChild(document.createTextNode('Estimates only, not financial, tax or legal advice. Results depend on the figures you enter. ' + (check || 'Check them with a qualified adviser before you buy.')));
    var row = h('div', 'legal-links'), pp = h('button', '', 'Privacy policy'), yt = h('button', '', 'Your targets');
    pp.type = 'button'; yt.type = 'button'; pp.onclick = openPrivacy; yt.onclick = openTargets; row.appendChild(pp); row.appendChild(yt); f.appendChild(row);
    return f;
  }

  // ---- Bottom sheets: your targets, the privacy policy (drawn in the settings sheet's place) ----
  function openSheet(fill) {
    var sheet = $('settings-sheet'); sheet.innerHTML = ''; sheet.className = 'sheet big-sheet';
    sheet.appendChild(h('div', 'grab'));
    fill(sheet); $('settings-overlay').hidden = false; sheet.hidden = false;
  }
  function sheetHead(sheet, title, btn) {
    var hd = h('div', 'bs-head'), done = h('button', 'bs-done', btn); done.type = 'button'; done.onclick = closeSettings;
    hd.appendChild(h('h2', '', title)); hd.appendChild(done); sheet.appendChild(hd);
  }
  var TARGET_ROWS = [['flip', 'Flip margin', '%', 1, 'Profit as a share of end value'], ['monthly', 'Monthly profit', '£', 50, 'BTL, HMO and SA, after all costs'],
    ['roi', 'ROI on cash left in', '%', 5, 'Yearly profit ÷ cash left in'], ['payback', 'Money back within', 'mo', 1, 'Amber up to ' + Calc.PAYBACK_OK + ' months']];
  function openTargets() {
    openSheet(function (sheet) {
      sheetHead(sheet, 'Your targets', 'Done');
      sheet.appendChild(h('p', 'bs-intro', 'The verdict, the colours and every ✓ / ✗ use these. They start from the app’s figures; change them to suit how you invest.'));
      var list = h('div', 'tg-list'), foot = h('div', 'tg-foot'), back = h('button', 'tg-back'); back.type = 'button';
      var D = Calc.defaultTargets(), inputs = {}, hints = [];
      function save(t) { t = Calc.setTargets(t); store(TARGETS_STORE, t); sync(t); redraw(); }
      function sync(t) {
        Object.keys(inputs).forEach(function (k) { if (document.activeElement !== inputs[k]) inputs[k].value = String(t[k]); });
        var changed = Object.keys(D).some(function (k) { return t[k] !== D[k]; });
        hints.forEach(function (f) { f(); });   // e.g. the flip row: amber from (target - 5)%
        back.hidden = !changed; back.textContent = 'Back to ' + D.flip + '% · £' + D.monthly + ' · ' + D.roi + '% · ' + D.payback + ' mo';
      }
      TARGET_ROWS.forEach(function (r) {
        var k = r[0], row = h('div', 'tg-row'), txt = h('span', 'tg-txt'), ctl = h('span', 'tg-ctl'), val = h('span', 'tg-val');
        var lab = h('label', '', r[1]), hint = h('small', '', r[4]); lab.setAttribute('for', 'tg-' + k); txt.appendChild(lab); txt.appendChild(hint);
        if (k === 'flip') hints.push(function () { hint.textContent = r[4] + ' · amber from ' + flipOkPct(); });
        var inp = h('input'); inp.id = 'tg-' + k; inp.setAttribute('inputmode', 'decimal'); inp.setAttribute('autocomplete', 'off'); inputs[k] = inp;
        inp.addEventListener('focus', function () { setTimeout(function () { try { inp.select(); } catch (e) {} }, 0); });
        inp.addEventListener('input', function () { var raw = inp.value.replace(/[^0-9.]/g, ''); if (raw !== inp.value) inp.value = raw; if (raw !== '' && raw !== '.') { var t = Calc.targets(); t[k] = Number(raw); save(t); } });
        inp.addEventListener('blur', function () { sync(Calc.targets()); });
        var step = function (d) { return function () { var t = Calc.targets(); t[k] = Math.round((t[k] + d * r[3]) * 100) / 100; save(t); }; };
        var minus = h('button', 'nudge sm', '−'), plus = h('button', 'nudge sm', '+'); minus.type = plus.type = 'button';
        minus.setAttribute('aria-label', 'Less: ' + r[1]); plus.setAttribute('aria-label', 'More: ' + r[1]); minus.onclick = step(-1); plus.onclick = step(1);
        if (r[2] === '£') val.appendChild(h('span', 'u', '£')); val.appendChild(inp); if (r[2] !== '£') val.appendChild(h('span', 'u', r[2] === 'mo' ? ' mo' : '%'));
        ctl.appendChild(minus); ctl.appendChild(val); ctl.appendChild(plus); row.appendChild(txt); row.appendChild(ctl); list.appendChild(row);
      });
      sheet.appendChild(list);
      foot.appendChild(h('span', '', 'Saved on this phone')); foot.appendChild(back); sheet.appendChild(foot);
      back.onclick = function () { save(Calc.defaultTargets()); };
      sync(Calc.targets());
    });
  }
  function openPrivacy() {
    openSheet(function (sheet) {
      sheetHead(sheet, 'Privacy policy', 'Close');
      sheet.appendChild(h('div', 'bs-date', 'Last updated ' + PRIVACY.updated));
      PRIVACY.sections.forEach(function (sec) { sheet.appendChild(h('h3', 'bs-h', sec[0])); sheet.appendChild(h('p', 'bs-p', sec[1])); });
    });
  }
  // The privacy policy. The same words are on the standalone privacy page; keep the two the same (test-app.js checks).
  // It describes only what this app does: no account, no server of its own, no tracking.
  var PRIVACY = { updated: '5 October 2026', sections: [
    ['What stays on your phone', 'Your deal figures, targets, stamp duty settings, saved deals and notes are stored only on this phone, in your browser. They are not sent to us.'],
    ['What we don’t collect', 'No account, no name or email address, no advertising or tracking cookies, no analytics. We never sell or share data.'],
    ['Loading the app', 'The app’s files are delivered by our hosting provider. Like any website, it may briefly log your IP address and device type to keep the service running and secure.'],
    ['Sharing a report', 'When you download or share a PDF report, your phone creates it on the phone and you choose where it goes.'],
    ['Your choices', 'Clear everything at any time by clearing this site’s data in your browser settings, or by uninstalling the app.'],
    ['Contact', '[CONTACT EMAIL TO BE ADDED BEFORE LAUNCH]']] };

  // ---- Settings sheet: theme, explanations, replay onboarding --------------------------------------------
  function closeSettings() { $('settings-overlay').hidden = true; $('settings-sheet').hidden = true; }
  // ---- Settings (design 9a, 7 Oct 2026): the targets sheet's shell (grab, title, Done), then cards: Appearance (three
  // themes), Explanations, Your figures (links), the setup questions and privacy, and a short footer. Same stores.
  function renderSettings() {
    var sheet = $('settings-sheet'); sheet.innerHTML = ''; sheet.className = 'sheet big-sheet st9';
    sheet.appendChild(h('div', 'grab')); sheetHead(sheet, 'Settings', 'Done');
    var body = h('div', 'st9-body'); sheet.appendChild(body);
    var label = function (t) { body.appendChild(h('p', 'st9-label', t)); };
    var card = function () { var c = h('div', 'st9-card'); body.appendChild(c); return c; };
    label('Appearance');
    var look = card();
    [['dark', 'Dark', 'Deep green, light ink.'], ['light', 'Light', 'Cream paper, dark ink.'], ['system', 'Match my phone', 'Follows your phone’s setting.']].forEach(function (t) {
      var row = h('button', 'st9-row st9-theme'); row.type = 'button'; row.setAttribute('aria-pressed', theme() === t[0]);
      row.appendChild(h('span', 'st9-swatch sw-' + t[0]));
      var tt = h('span', 'st9-txt'); tt.appendChild(h('b', '', t[1])); tt.appendChild(h('small', '', t[2])); row.appendChild(tt);
      var radio = h('span', 'st9-radio'); radio.appendChild(h('i')); row.appendChild(radio);
      row.onclick = function () { store(THEME, t[0]); applyTheme(); renderSettings(); };
      look.appendChild(row);
    });
    var expCard = card(); expCard.classList.add('st9-exp');
    var et = h('span', 'st9-txt'); et.appendChild(h('b', '', 'Explanations')); et.appendChild(h('small', '', 'Plain-English sentences next to results.')); expCard.appendChild(et);
    var sw = h('button', 'st9-switch'); sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', explanationsOn()); sw.setAttribute('aria-label', 'Explanations'); sw.appendChild(h('i'));
    sw.onclick = function () { store(EXPLAIN, !explanationsOn()); renderSettings(); if (current) update(); };
    expCard.appendChild(sw);
    var link = function (c, title, sub, go, mark) {
      var b = h('button', 'st9-row st9-link'), tt = h('span', 'st9-txt'); b.type = 'button';
      tt.appendChild(h('b', '', title)); if (sub) tt.appendChild(h('small', '', sub)); b.appendChild(tt);
      b.appendChild(h('span', mark ? 'st9-mark' : 'st9-chev', mark || '›')); b.onclick = go; c.appendChild(b);
    };
    label('Your figures');
    var yours = card(), n = usualCount();
    link(yours, 'Your targets', 'Monthly profit, ROI, money back, flip margin', openTargets);
    link(yours, 'My usual figures', n ? n + ' of ' + USUAL_IDS.length + ' set, used on every new deal' : 'Using the spreadsheet examples', function () { closeSettings(); location.hash = '#usual'; });
    var more = card();
    link(more, 'Redo the setup questions', '', startOnboarding, '↺');
    link(more, 'Privacy policy', '', openPrivacy, '›');
    body.appendChild(h('p', 'st9-foot', 'Estimates only, not financial, tax or legal advice. Your figures, targets and saved deals stay on this phone.'));
  }
  function openSettings() { renderSettings(); $('settings-overlay').hidden = false; $('settings-sheet').hidden = false; }
  $('gear').onclick = openSettings;
  $('settings-overlay').onclick = closeSettings;

  // ---- routing: (empty = calculator)  #calculators  #deal  #compare  #saved  #saved-compare  #report  #usual  #c/<id> ---
  var curHash = null, prevHash = null;
  function goBack() {
    var hash = location.hash;
    // Back returns to wherever this screen was opened from (the calculator, a saved deal), not always to the Calculator.
    if (hash !== '#report' && hash !== '#saved-compare' && prevHash != null && prevHash !== hash) { location.hash = prevHash; return; }
    location.hash = hash === '#saved-compare' ? '#saved' : hash === '#report' ? (reportSource === 'saved' ? '#saved-compare' : '#compare') : '';
  }
  function route() {
    var hash = location.hash, m = /^#c\/(\w+)$/.exec(hash), c = m && stratByKey(m[1]);
    if (m && !c && (m[1] === 'hmobrr' || m[1] === 'sabrr')) { goCalc(m[1]); return; }          // old links to the BRR calculators
    if (m && !c && m[1] === 'flip') { location.hash = '#c/brr'; return; }                      // Flip is part of the primary screen now
    if (hash !== curHash) { prevHash = curHash; curHash = hash; }
    if (c) { calcKey = c.key; store(STRAT_KEY, calcKey); }
    var view = c ? 'home' : hash === '#saved' ? 'saved' : hash === '#compare' ? 'compare' : hash === '#saved-compare' ? 'scompare'
      : hash === '#usual' ? 'usual' : hash === '#report' ? 'report' : 'home';
    $('v-home').hidden = view !== 'home'; $('v-saved').hidden = view !== 'saved';
    $('v-compare').hidden = view !== 'compare'; $('v-scompare').hidden = view !== 'scompare'; $('v-report').hidden = view !== 'report'; $('v-usual').hidden = view !== 'usual';
    if (view === 'compare') renderCompare();
    if (view === 'scompare') renderSavedCompare();
    if (view === 'report') renderReport();
    if (view === 'usual') renderUsual();
    if (view !== 'home') document.body.classList.toggle('ledger', view === 'usual');            // usual figures: the Calculator's look
    var overlayView = view === 'compare' || view === 'scompare' || view === 'report';
    $('tabs').hidden = overlayView; $('back').hidden = !overlayView; $('sticky-bar').hidden = view !== 'home';
    document.body.classList.toggle('has-tabs', !overlayView);
    document.body.classList.toggle('has-bar', view === 'home');
    $('t-home').setAttribute('aria-selected', view === 'home' || view === 'usual'); $('t-saved').setAttribute('aria-selected', view === 'saved');
    $('title').textContent = view === 'scompare' ? 'Compare saved deals' : view === 'report' ? 'Client report' : view === 'compare' ? 'Every strategy' : 'BRR Calculator';
    $('tagline').hidden = overlayView;
    if (view === 'saved') renderDeals();
    if (view === 'home') renderCalculator();
    window.scrollTo(0, 0);
  }
  $('back').onclick = goBack;
  $('t-home').onclick = function () { location.hash = '#calculators'; };
  $('t-saved').onclick = function () { location.hash = '#saved'; };
  window.addEventListener('hashchange', route);

  applyTheme();
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  route();
  if (!load(ONBOARDED, false)) startOnboarding();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(function () {});
})();

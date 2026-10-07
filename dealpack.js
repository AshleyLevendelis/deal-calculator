// The deal pack (design 12-15, 7 Oct 2026; for sourcers): a branded A4 pack for a client, built only from the
// calculator's current figures plus a few property details. Pure: no storage, no page. app.js keeps the drafts,
// templates and branding; p.html shows the shared link; test-dealpack.js checks it.
// No verdict or score anywhere in the pack (the hand-off's rule): figures and colours only.
(function (root) {
  var SECS = {
    summary: ['Deal summary', 'Your note and the key numbers'],
    figures: ['Figures and costs', 'Costs, refinance, cash left in'],
    exits: ['Exit strategies compared', 'Flip and BRR → BTL, from the calculator'],
    evidence: ['Rent figures', 'Rent and yield from the calculator'],
    epc: ['EPC and size', 'Rating, floor area, £ per sqm'],
    area: ['Area map', 'Town and postcode area'],
    photos: ['Photos gallery', 'Your photos'],
    fee: ['Your fee and terms', 'Fee as its own line, your terms'],
    next: ['Next steps', 'How to reserve']
  };
  var ORDER = Object.keys(SECS);
  var LOOK_LIST = [['classic', 'Classic', 'Photo, serif title, clean'], ['editorial', 'Editorial', 'Full-bleed photo, magazine feel'],
    ['bold', 'Bold', 'Your colour, big headline number'], ['memo', 'Memo', 'Figure-led, no-nonsense']];
  // The values from the hand-off's Deal Pack Page (null = the brand colour).
  var LOOKS = {
    classic: { hdrBg: '#ffffff', hdrInk: '#1d1b18', hdrMute: '#5b554e', chipBg: null, chipInk: '#ffffff', ruleH: '3px', shFont: "700 11.5px 'Geist'", shLs: '.12em', shCase: 'uppercase', shInk: null, shBg: 'transparent', shPad: '0', quote: "400 17px/1.4 'Instrument Serif',Georgia,serif", footRule: '#ece8df', footInk: '#77716a', footBg: '#ffffff' },
    editorial: { hdrBg: '#ffffff', hdrInk: '#1d1b18', hdrMute: '#5b554e', chipBg: null, chipInk: '#ffffff', ruleH: '1px', shFont: "400 28px/1.1 'Instrument Serif',Georgia,serif", shLs: '0', shCase: 'none', shInk: '#1d1b18', shBg: 'transparent', shPad: '0', quote: "400 20px/1.35 'Instrument Serif',Georgia,serif", footRule: '#ece8df', footInk: '#77716a', footBg: '#ffffff' },
    bold: { hdrBg: null, hdrInk: '#ffffff', hdrMute: 'rgba(255,255,255,.75)', chipBg: '#ffffff', chipInk: null, ruleH: '0px', shFont: "800 13px 'Geist'", shLs: '.04em', shCase: 'uppercase', shInk: '#ffffff', shBg: null, shPad: '6px 12px', quote: "600 15px/1.45 'Geist'", footRule: '#1d1b18', footInk: '#d9d3c7', footBg: '#1d1b18' },
    memo: { hdrBg: '#ffffff', hdrInk: '#1d1b18', hdrMute: '#77716a', chipBg: null, chipInk: '#ffffff', ruleH: '2px', shFont: "500 11px ui-monospace,monospace", shLs: '.08em', shCase: 'uppercase', shInk: '#77716a', shBg: 'transparent', shPad: '0', quote: "500 14px/1.5 'Geist'", footRule: '#d9d3c7', footInk: '#77716a', footBg: '#ffffff' }
  };
  var SWATCHES = ['#1f5c4a', '#1e3a5f', '#7a2e2e', '#2b2b2b', '#6b4f1d', '#4a2f6b'];
  var INK = { good: '#2f8a5b', amber: '#b7791f', red: '#c0392b', ink: '#1d1b18' };
  var DEFAULT_TERMS = 'Fee payable on exchange of contracts.\nA £500 reservation deposit secures the deal and comes off the fee. Refundable if the vendor withdraws.';
  var DEFAULT_FEE = 3000;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function money(v) { v = n(v); return (v < 0 ? '−' : '') + '£' + Math.round(Math.abs(v)).toLocaleString('en-GB'); }
  function pct(v) { return typeof v === 'number' && isFinite(v) ? (v * 100).toFixed(1) + '%' : '∞'; }
  function colourOk(c) { return /^#[0-9a-f]{6}$/i.test(String(c || '')) ? c : SWATCHES[0]; }
  function initials(b) { return String((b && (b.company || b.name)) || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || '?'; }
  function dateText(d) { d = d || new Date(); return d.getDate() + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()] + ' ' + d.getFullYear(); }

  // The figures the pack shows, from the calculator's ledger (Calc.ledger(deal, bridging)): BRR → BTL and the flip.
  function figsFromLedger(L) {
    var b = L.exits.btl, v = b.v, f = L.exits.none.v, ps = L.ps;
    return { price: n(ps.purchasePrice), endValue: n(ps.endValue), refurb: n(ps.refurb), legal: n(ps.legal), other: n(ps.otherUpfront), sdlt: n(b.own.sdlt),
      totalIn: n(v.totalIn), ltv: n(L.ltv), depositPct: n(ps.depositPct), deposit: n(b.own.deposit), newMortgage: n(v.newMortgage), cashLeft: n(v.cashLeft),
      monthly: n(v.monthly), roi: v.roi, margin: f.margin, rent: n(b.state.monthlyRent), bridgeCost: n(L.bridgeCost) };
  }
  // Which sections are in, in order. cfg: { order, off }.
  function sectionsOn(cfg) {
    var order = (cfg && cfg.order && cfg.order.length ? cfg.order : ORDER).filter(function (k) { return SECS.hasOwnProperty(k); });
    ORDER.forEach(function (k) { if (order.indexOf(k) < 0) order.push(k); });                       // a template from before keeps every section
    return order.filter(function (k) { return !(cfg && cfg.off && cfg.off[k]); });
  }
  // Cover on its own page, then two sections a page; every page numbered.
  function paginate(on) {
    var pages = [{ cover: true, blocks: [] }];
    for (var i = 0; i < on.length; i += 2) pages.push({ cover: false, blocks: on.slice(i, i + 2) });
    pages.forEach(function (p, i) { p.num = i + 1; p.total = pages.length; });
    return pages;
  }
  // Everything a page or the link needs, in words and figures. o: { figs, prop, brand, client, hide, fee, terms, note, date,
  // link, flipTarget, monthlyTarget, exitName }.
  function data(o) {
    var F = o.figs || {}, pr = o.prop || {}, B = o.brand || {}, hide = !!o.hide, out = F.cashLeft <= 0;
    var town = String(pr.town || '').trim(), pc = String(pr.postcode || '').trim().toUpperCase(), outward = pc.split(/\s+/)[0] || '';
    var kind = (pr.beds ? pr.beds + '-bed ' : '') + (String(pr.type || '').trim() || 'property');
    var district = (town + ' ' + outward).trim() || 'Location on request';
    var address = String(pr.address || '').trim();
    var Kind = kind.charAt(0).toUpperCase() + kind.slice(1), title = hide || !address ? Kind + (town ? ', ' + town : '') : address;
    var sqm = n(String(pr.sqm || '').replace(/[^0-9.]/g, '')), yld = F.endValue ? F.rent * 12 / F.endValue : 0;
    var flipT = n(o.flipTarget) || 25, monthT = o.monthlyTarget == null ? 500 : n(o.monthlyTarget);
    var marginPct = typeof F.margin === 'number' ? Math.round(F.margin * 1000) / 10 : null;
    var link = o.link || '';
    return {
      title: title, sub: hide ? district + ' · exact address once reserved' : ([town, pc].filter(Boolean).join(' ') ? [[town, pc].filter(Boolean).join(' '), kind] : [Kind]).join(' · '),
      short: hide ? district : (address || district), district: district, eyebrow: 'Calculator · ' + (o.exitName || 'BRR → BTL'),
      client: String(o.client || '').trim() || 'you', date: o.date || dateText(), note: String(o.note || '').trim(),
      stats: [{ label: 'Purchase price', val: money(F.price), color: INK.ink }, { label: 'Value after works', val: money(F.endValue), color: INK.ink },
        { label: 'Refurb', val: money(F.refurb), color: INK.ink }, { label: out ? 'Pulled out at refinance' : 'Left in after refinance', val: money(Math.abs(F.cashLeft)), color: out ? INK.good : INK.amber }],
      costs: [['Purchase price', F.price], ['Stamp duty', F.sdlt], ['Refurbishment', F.refurb], ['Legal costs', F.legal]].concat(F.other ? [['Other costs', F.other]] : [])
        .concat(F.bridgeCost ? [['Bridging cost', F.bridgeCost]] : []).map(function (r) { return { label: r[0], val: money(r[1]), strong: false }; })
        .concat([{ label: 'Total cost', val: money(F.totalIn), strong: true }]).concat(n(o.fee) ? [{ label: 'Plus sourcing fee', val: money(o.fee), strong: false }] : []),
      after: [{ label: 'Value after works', val: money(F.endValue) }, { label: 'Refinance at ' + F.ltv + '%', val: money(F.newMortgage) }, { label: 'Deposit at purchase (' + F.depositPct + '%)', val: money(F.deposit) }],
      keyLabel: out ? 'Cash pulled out at refinance' : 'Cash left in after refinance', keyVal: money(Math.abs(F.cashLeft)),
      exits: [{ name: 'Flip', head: pct(F.margin) + ' margin', detail: 'Sell at ' + money(F.endValue) + ' after the works.', color: marginPct == null ? INK.ink : marginPct >= flipT ? INK.good : marginPct >= Math.max(0, flipT - 5) ? INK.amber : INK.red },
        { name: 'BRR → BTL', head: money(F.monthly) + '/mo', detail: 'Rent ' + money(F.rent) + ' a month. ' + (out ? money(-F.cashLeft) + ' comes back at refinance.' : money(F.cashLeft) + ' left in, ' + pct(F.roi) + ' return on it.'), color: F.monthly >= monthT ? INK.good : INK.red }],
      evidence: [{ label: 'Monthly rent', big: money(F.rent) + ' a month', detail: money(F.rent * 12) + ' a year.' }, { label: 'Gross yield on value', big: (yld * 100).toFixed(1) + '%', detail: 'Annual rent ÷ value after works.' }],
      evidenceSrc: 'Figures as worked out on ' + (o.date || dateText()) + '.',
      epc: [{ val: String(pr.epc || '').trim() || 'Not provided', label: 'EPC rating' }, { val: sqm ? sqm + ' sqm' : 'Not provided', label: 'Floor area' },
        { val: pr.beds ? pr.beds + '-bed' : '–', label: String(pr.type || '').trim() || 'Property' }, { val: sqm ? money(F.endValue / sqm) : '–', label: 'Value per sqm after works' }],
      epcNote: 'Entered by ' + (B.name || B.company || 'the sourcer') + '.',
      areaNote: hide || !address ? 'Exact address shared once you reserve.' : [address, town, pc].filter(Boolean).join(', '),
      fee: money(o.fee), terms: String(o.terms == null ? DEFAULT_TERMS : o.terms),
      steps: [{ n: 1, text: link ? 'Reserve with the button on the link sent with this pack. No payment yet.' : 'Reserve by calling or emailing ' + (B.name || 'us') + '. No payment yet.' },
        { n: 2, text: (B.name || 'We') + ' will call you within one working day and send the reservation agreement.' },
        { n: 3, text: 'Pay the reservation deposit and you get the address and an introduction to the agent.' }],
      contact: [B.phone, B.email].filter(Boolean).join(' · '), link: link
    };
  }

  // ---- the A4 page (600 x 848 in the design), one of the four looks ----
  function look(name, color) {
    var t = Object.assign({}, LOOKS[name] || LOOKS.classic);
    ['hdrBg', 'chipBg', 'shInk', 'shBg', 'chipInk'].forEach(function (k) { if (t[k] === null) t[k] = color; });
    return t;
  }
  function chip(B, color, size, radius, font, bg, ink) {
    if (B.logo) return '<span style="flex:none;width:' + size + 'px;height:' + size + 'px;border-radius:' + radius + ';background:#ffffff;display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="' + esc(B.logo) + '" alt="" style="max-width:100%;max-height:100%;object-fit:contain"></span>';
    return '<span style="flex:none;width:' + size + 'px;height:' + size + 'px;border-radius:' + radius + ';display:flex;align-items:center;justify-content:center;font:' + font + ";color:" + ink + ';background:' + bg + '">' + esc(initials(B)) + '</span>';
  }
  function photo(src, label) {
    return src ? '<img src="' + esc(src) + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">'
      : '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:500 11px \'Geist\';color:#a49d92">' + esc(label || '') + '</span>';
  }
  function statsGrid(d, cell) { return d.stats.map(cell).join(''); }
  function cover(lk, d, B, color, P) {
    var c = P && P.cover;
    if (lk === 'editorial') return '<div style="position:absolute;inset:0;background:#2b2722">' + photo(c, '') + '</div>' +
      '<div style="position:absolute;left:0;right:0;bottom:0;height:520px;background:linear-gradient(to top,rgba(20,17,14,.92) 0%,rgba(20,17,14,.75) 45%,rgba(20,17,14,0) 100%)"></div>' +
      '<div style="position:relative;display:flex;align-items:center;gap:10px;padding:28px 40px">' + chip(B, color, 36, '50%', "700 13px 'Geist'", '#ffffff', color) +
      '<span style="font:600 13px \'Geist\';color:#ffffff;text-shadow:0 1px 6px rgba(0,0,0,.5)">' + esc(B.company) + '</span></div><div style="flex:1"></div>' +
      '<div style="position:relative;padding:0 40px 18px;color:#ffffff"><div style="font:500 11px \'Geist\';letter-spacing:.2em;text-transform:uppercase;opacity:.85">' + esc(d.eyebrow) + '</div>' +
      '<div style="font:400 58px/1 \'Instrument Serif\',Georgia,serif;margin-top:10px">' + esc(d.title) + '</div><div style="font-size:13.5px;opacity:.85;margin-top:8px">' + esc(d.sub) + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:22px;border-top:1px solid rgba(255,255,255,.35)">' +
      statsGrid(d, function (s) { return '<div style="padding:12px 10px 0 0"><div style="font:400 26px/1 \'Instrument Serif\',Georgia,serif">' + esc(s.val) + '</div><div style="font-size:10.5px;opacity:.8;margin-top:4px">' + esc(s.label) + '</div></div>'; }) +
      '</div><div style="font-size:11px;opacity:.75;margin-top:20px">Prepared for ' + esc(d.client) + ' · ' + esc(d.date) + '</div></div>';
    if (lk === 'bold') return '<div style="flex:none;padding:28px 36px 30px;color:#ffffff;background:' + color + '"><div style="display:flex;align-items:center;gap:10px">' +
      chip(B, color, 36, '9px', "800 13px 'Geist'", '#ffffff', color) + '<span style="flex:1;font:700 14px \'Geist\'">' + esc(B.company) + '</span>' +
      '<span style="font:700 10.5px \'Geist\';letter-spacing:.14em;text-transform:uppercase;padding:5px 10px;border-radius:999px;border:1.5px solid rgba(255,255,255,.6)">Deal pack</span></div>' +
      '<div style="font:800 34px/1.05 \'Geist\';letter-spacing:-.035em;margin-top:30px">' + esc(d.title) + '</div><div style="font-size:13px;opacity:.85;margin-top:6px">' + esc(d.sub) + '</div>' +
      '<div style="margin-top:24px;font:600 12.5px \'Geist\';opacity:.85">' + esc(d.keyLabel) + '</div><div style="font:800 64px/1 \'Geist\';letter-spacing:-.05em;margin-top:4px">' + esc(d.keyVal) + '</div></div>' +
      '<div style="position:relative;flex:1;min-height:0;background:#f1ede4">' + photo(c, '') + '</div>' +
      '<div style="flex:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:#1d1b18;color:#ffffff">' +
      statsGrid(d, function (s) { return '<div style="padding:14px 16px;border-right:1px solid rgba(255,255,255,.12)"><div style="font:800 17px \'Geist\';letter-spacing:-.02em">' + esc(s.val) + '</div><div style="font-size:10px;opacity:.7;margin-top:2px">' + esc(s.label) + '</div></div>'; }) + '</div>';
    if (lk === 'memo') return '<div style="display:flex;align-items:center;gap:10px;padding:32px 44px 0">' + chip(B, color, 30, '6px', "700 11px 'Geist'", color, '#ffffff') +
      '<span style="flex:1;font:600 13px \'Geist\'">' + esc(B.company) + '</span><span style="font:500 11px ui-monospace,monospace;color:#77716a">' + esc(d.date) + '</span></div>' +
      '<div style="padding:56px 44px 0"><div style="font:500 11px ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;color:#77716a">Investment memo · ' + esc(d.eyebrow.replace(/^Calculator · /, '')) + '</div>' +
      '<div style="font:600 32px/1.1 \'Geist\';letter-spacing:-.03em;margin-top:12px">' + esc(d.title) + '</div><div style="font-size:13px;color:#5b554e;margin-top:6px">' + esc(d.sub) + '</div></div>' +
      '<div style="margin:40px 44px 0;padding:22px 0;border-top:2px solid #1d1b18;border-bottom:1px solid #d9d3c7"><div style="font:600 12px \'Geist\';color:#5b554e">' + esc(d.keyLabel) + '</div>' +
      '<div style="font:600 72px/1 \'Geist\';letter-spacing:-.05em;margin-top:6px;color:' + color + '">' + esc(d.keyVal) + '</div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin:0 44px">' +
      statsGrid(d, function (s) { return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:14px 16px 14px 0;border-bottom:1px solid #ece8df"><span style="font-size:12px;color:#5b554e">' + esc(s.label) + '</span><b style="font:600 17px \'Geist\'">' + esc(s.val) + '</b></div>'; }) +
      '</div><div style="flex:1"></div><div style="padding:0 44px 14px;font-size:11.5px;color:#5b554e">Prepared for ' + esc(d.client) + (B.name ? ' by ' + esc(B.name) : '') + '</div>';
    // classic
    return '<div style="display:flex;align-items:center;gap:12px;padding:22px 36px 16px">' + chip(B, color, 40, '10px', "700 15px 'Geist'", color, '#ffffff') +
      '<span style="flex:1;min-width:0"><span style="display:block;font:700 15px \'Geist\'">' + esc(B.company) + '</span><span style="display:block;font-size:11.5px;color:#5b554e">' + esc([B.name, B.phone].filter(Boolean).join(' · ')) + '</span></span>' +
      '<span style="font:600 10.5px \'Geist\';letter-spacing:.14em;text-transform:uppercase;color:#5b554e">Deal pack</span></div>' +
      '<div style="position:relative;height:400px;margin:0 36px;border-radius:14px;overflow:hidden;background:#f1ede4">' + photo(c, '') + '</div>' +
      '<div style="padding:22px 36px 0;display:flex;flex-direction:column;gap:4px"><div style="font:600 11px \'Geist\';letter-spacing:.14em;text-transform:uppercase;color:' + color + '">' + esc(d.eyebrow) + '</div>' +
      '<div style="font:400 40px/1.05 \'Instrument Serif\',Georgia,serif">' + esc(d.title) + '</div><div style="font-size:13px;color:#5b554e">' + esc(d.sub) + '</div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:18px 36px 0">' +
      statsGrid(d, function (s) { return '<div style="background:#f6f3ec;border-radius:10px;padding:10px 12px"><div style="font:700 17px \'Geist\';letter-spacing:-.02em;color:' + s.color + '">' + esc(s.val) + '</div><div style="font-size:10.5px;color:#5b554e;margin-top:2px">' + esc(s.label) + '</div></div>'; }) +
      '</div><div style="flex:1"></div><div style="padding:0 36px 14px;font-size:11.5px;color:#5b554e">Prepared for ' + esc(d.client) + ' · ' + esc(d.date) + '</div>';
  }
  function row(l, v, strong) { return '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid #ece8df;font-size:12px;color:#3d3933;font-weight:' + (strong ? 700 : 400) + '"><span>' + esc(l) + '</span><span style="white-space:nowrap">' + esc(v) + '</span></div>'; }
  function block(k, d, B, t, color, P) {
    var h = '';
    if (k === 'summary') h = (d.note ? '<div style="font:' + t.quote + ';color:#3d3933">“' + esc(d.note) + '”</div>' : '') +
      '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px">' + d.stats.map(function (s) { return '<div style="border:1px solid #ece8df;border-radius:10px;padding:9px 11px"><div style="font:700 15px \'Geist\';color:' + s.color + '">' + esc(s.val) + '</div><div style="font-size:10px;color:#5b554e;margin-top:2px">' + esc(s.label) + '</div></div>'; }).join('') + '</div>';
    if (k === 'figures') h = '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px"><div>' + d.costs.map(function (r) { return row(r.label, r.val, r.strong); }).join('') + '</div><div>' +
      d.after.map(function (r) { return row(r.label, r.val); }).join('') + '<div style="margin-top:8px;background:#f6f3ec;border-radius:10px;padding:10px 12px"><div style="font:600 11px \'Geist\';color:#5b554e">' + esc(d.keyLabel) + '</div><div style="font:700 24px/1.1 \'Geist\';letter-spacing:-.03em;color:' + color + '">' + esc(d.keyVal) + '</div></div></div></div>';
    if (k === 'exits') h = d.exits.map(function (x) { return '<div style="display:grid;grid-template-columns:120px 110px minmax(0,1fr);gap:12px;align-items:baseline;padding:9px 0;border-top:1px solid #ece8df"><b style="font:700 13px \'Geist\'">' + esc(x.name) + '</b><span style="font:700 15px \'Geist\';color:' + x.color + '">' + esc(x.head) + '</span><span style="font-size:11.5px;color:#5b554e;line-height:1.4">' + esc(x.detail) + '</span></div>'; }).join('');
    if (k === 'evidence') h = '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">' + d.evidence.map(function (e) { return '<div style="background:#f6f3ec;border-radius:12px;padding:12px 14px"><div style="font:600 11.5px \'Geist\';color:#5b554e">' + esc(e.label) + '</div><div style="font:700 24px/1.15 \'Geist\';letter-spacing:-.03em;margin-top:2px">' + esc(e.big) + '</div><div style="font-size:11.5px;color:#5b554e;margin-top:4px;line-height:1.4">' + esc(e.detail) + '</div></div>'; }).join('') +
      '</div><div style="font-size:10.5px;color:#77716a;margin-top:8px">' + esc(d.evidenceSrc) + '</div>';
    if (k === 'epc') h = '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">' + d.epc.map(function (e) { return '<div style="border:1px solid #ece8df;border-radius:10px;padding:10px 11px"><div style="font:700 16px \'Geist\';letter-spacing:-.01em">' + esc(e.val) + '</div><div style="font-size:10.5px;color:#5b554e;margin-top:2px">' + esc(e.label) + '</div></div>'; }).join('') +
      '</div><div style="font-size:10.5px;color:#77716a;margin-top:8px">' + esc(d.epcNote) + '</div>';
    if (k === 'area') h = '<div style="flex:1;min-height:150px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(45deg,#f1ede4 0 8px,#f8f5ef 8px 16px)"><span style="font:500 11px ui-monospace,monospace;color:#77716a;background:#ffffff;padding:4px 8px;border-radius:6px">' + esc(d.district) + '</span></div>' +
      '<div style="font-size:11.5px;color:#5b554e;margin-top:8px">' + esc(d.areaNote) + '</div>';
    if (k === 'photos') {
      var ph = ((P && P.photos) || []).filter(Boolean).slice(0, 6);
      h = ph.length ? '<div style="flex:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:8px;min-height:200px">' + ph.map(function (s) { return '<div style="position:relative;border-radius:10px;overflow:hidden;background:#f1ede4">' + photo(s) + '</div>'; }).join('') + '</div>'
        : '<div style="font-size:12.5px;color:#5b554e">More photos on request.</div>';
    }
    if (k === 'fee') h = '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:10px 0;border-top:1px solid #ece8df;border-bottom:1px solid #ece8df"><span style="font:600 13px \'Geist\'">Sourcing fee</span><span style="font:700 22px \'Geist\';letter-spacing:-.02em;color:' + color + '">' + esc(d.fee) + '</span></div>' +
      '<div style="font-size:12px;line-height:1.55;color:#3d3933;margin-top:10px;white-space:pre-line">' + esc(d.terms) + '</div>';
    if (k === 'next') h = d.steps.map(function (s) { return '<div style="display:flex;gap:12px;align-items:flex-start;padding:7px 0"><span style="flex:none;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 11.5px \'Geist\';color:#ffffff;background:' + color + '">' + s.n + '</span><span style="font-size:12.5px;line-height:1.45;color:#3d3933;padding-top:2px">' + esc(s.text) + '</span></div>'; }).join('') +
      '<div style="margin-top:8px;border-radius:10px;padding:10px 12px;border:1.5px dashed ' + color + ';font:600 12px \'Geist\'">' + (d.link ? 'Reserve online with the link sent with this pack' + (d.contact ? ', or contact <span style="color:' + color + '">' + esc(d.contact) + '</span>' : '') : 'Contact: <span style="color:' + color + '">' + esc(d.contact || B.company || '') + '</span>') + '</div>';
    return h;
  }
  // One page as HTML (inline styles, so the preview, the print and the thumbnails all look the same).
  function pageHTML(page, lookName, B, d, P) {
    B = B || {}; var color = colourOk(B.color), t = look(lookName, color);
    var body = page.cover ? cover(lookName, d, B, color, P) :
      '<div style="display:flex;align-items:center;gap:10px;padding:18px 36px 14px;background:' + t.hdrBg + '">' + chip(B, color, 28, '7px', "700 11px 'Geist'", t.chipBg, t.chipInk) +
      '<span style="flex:1;font:700 12.5px \'Geist\';color:' + t.hdrInk + '">' + esc(B.company) + '</span><span style="font-size:11px;color:' + t.hdrMute + '">' + esc(d.short) + '</span></div>' +
      '<div style="height:' + t.ruleH + ';margin:0 36px;background:' + color + '"></div><div style="flex:1;display:flex;flex-direction:column;padding:6px 36px 0;min-height:0">' +
      page.blocks.map(function (k, j) {
        return '<div class="dp-block" data-sec="' + k + '" style="flex:1;display:flex;flex-direction:column;padding:16px 0 12px;border-top:' + (j ? '1px solid #ece8df' : '0') + ';min-height:0">' +
          '<div style="align-self:flex-start;margin-bottom:12px;font:' + t.shFont + ';letter-spacing:' + t.shLs + ';text-transform:' + t.shCase + ';color:' + t.shInk + ';background:' + t.shBg + ';padding:' + t.shPad + ';border-radius:6px">' + esc(SECS[k][0]) + '</div>' +
          block(k, d, B, t, color, P) + '</div>';
      }).join('') + '</div>';
    var foot = '<div style="position:relative;flex:none;display:flex;justify-content:space-between;gap:16px;padding:10px 36px 16px;border-top:1px solid ' + t.footRule + ';font-size:9px;line-height:1.45;color:' + t.footInk + ';background:' + t.footBg + '">' +
      '<span style="max-width:440px">Estimates only, not financial, tax or legal advice. Figures based on information available on ' + esc(d.date) + '. ' + esc([B.company, B.email].filter(Boolean).join(' · ')) + '</span>' +
      '<span style="white-space:nowrap" class="dp-num">' + page.num + ' / ' + page.total + '</span></div>';
    return '<div class="dp-page" data-look="' + esc(lookName) + '" style="width:600px;height:848px;background:#ffffff;color:#1d1b18;font-family:\'Geist\',system-ui,sans-serif;position:relative;display:flex;flex-direction:column;overflow:hidden">' + body + foot + '</div>';
  }

  // ---- the link: the pack's words and figures in the address itself (no server). Photos and the logo stay on the phone.
  function linkPayload(d, cfg, B, lookName) {
    return { v: 1, look: lookName, on: sectionsOn(cfg), d: { title: d.title, sub: d.sub, short: d.short, district: d.district, eyebrow: d.eyebrow, client: d.client, date: d.date, note: d.note,
      stats: d.stats, costs: d.costs, after: d.after, keyLabel: d.keyLabel, keyVal: d.keyVal, exits: d.exits, evidence: d.evidence, evidenceSrc: d.evidenceSrc, epc: d.epc, epcNote: d.epcNote,
      areaNote: d.areaNote, fee: d.fee, terms: d.terms, steps: d.steps }, b: { company: B.company || '', name: B.name || '', phone: B.phone || '', email: B.email || '', web: B.web || '', color: colourOk(B.color) } };
  }
  // A message the client sends to reserve: by text, WhatsApp or email. Only what they typed; nothing is stored anywhere.
  function reserveMessage(p, r) {
    var name = String(r.name || '').trim(), phone = String(r.phone || '').trim(), email = String(r.email || '').trim();
    var body = 'Hello' + (p.b.name ? ' ' + p.b.name.split(' ')[0] : '') + ', I would like to reserve ' + p.d.title + (p.d.client && p.d.client !== 'you' ? ' (pack prepared for ' + p.d.client + ')' : '') + '.\nName: ' + name + '\nPhone: ' + phone + (email ? '\nEmail: ' + email : '');
    var digits = String(p.b.phone || '').replace(/[^0-9+]/g, ''), wa = digits.replace(/^\+/, '').replace(/^0/, '44');
    return { body: body, ok: !!(name && phone), sms: digits ? 'sms:' + digits + '?&body=' + encodeURIComponent(body) : '', whatsapp: digits ? 'https://wa.me/' + wa + '?text=' + encodeURIComponent(body) : '',
      email: p.b.email ? 'mailto:' + p.b.email + '?subject=' + encodeURIComponent('Reserve: ' + p.d.title) + '&body=' + encodeURIComponent(body) : '' };
  }

  // The link's code: the payload as JSON, squeezed (deflate) when the browser can, in URL-safe base64. 'z' = squeezed,
  // 'j' = plain. Both are read back by decode, so an old phone's link still opens.
  function b64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var s = atob(t), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  function pipe(bytes, stream) { return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function (a) { return new Uint8Array(a); }); }
  function encode(payload, plain) {
    var bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (plain || typeof CompressionStream === 'undefined') return Promise.resolve('j' + b64(bytes));
    return pipe(bytes, new CompressionStream('deflate-raw')).then(function (z) { return 'z' + b64(z); }, function () { return 'j' + b64(bytes); });
  }
  function decode(code) {
    code = String(code || '').replace(/^#/, '');
    try {
      var kind = code.charAt(0), bytes = unb64(code.slice(1));
      var text = kind === 'j' ? Promise.resolve(bytes) : kind === 'z' && typeof DecompressionStream !== 'undefined' ? pipe(bytes, new DecompressionStream('deflate-raw')) : Promise.reject(new Error('unreadable'));
      return text.then(function (b) { var p = JSON.parse(new TextDecoder().decode(b)); if (!p || p.v !== 1 || !p.d || !p.b) throw new Error('unreadable'); return p; });
    } catch (e) { return Promise.reject(e); }
  }

  var api = { encode: encode, decode: decode, DEFAULT_FEE: DEFAULT_FEE, SECS: SECS, ORDER: ORDER, LOOKS: LOOKS, LOOK_LIST: LOOK_LIST, SWATCHES: SWATCHES, DEFAULT_TERMS: DEFAULT_TERMS, esc: esc, money: money, initials: initials, dateText: dateText,
    figsFromLedger: figsFromLedger, sectionsOn: sectionsOn, paginate: paginate, data: data, pageHTML: pageHTML, block: block, look: look, colourOk: colourOk, linkPayload: linkPayload, reserveMessage: reserveMessage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DealPack = api;
})(this);

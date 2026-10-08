// The deal pack's pure parts (dealpack.js): figures from the calculator, sections and pages, hiding the address, the
// four looks, no verdict anywhere, the link's code and the reserve message. Run: node test-dealpack.js
var Calc = require('./calc.js'), DP = require('./dealpack.js');
var fails = 0, count = 0;
function ok(name, cond, info) { count++; if (!cond) { fails++; console.log('FAIL ' + name + (info !== undefined ? ' :: ' + info : '')); } }

var deal = { endValue: 230000, purchasePrice: 125000, refurb: 30000, legal: 1500 };
var L = Calc.ledger(deal, false), F = DP.figsFromLedger(L), X = L.exits.btl;
ok('figures come straight from the calculator', F.price === 125000 && F.endValue === 230000 && F.refurb === 30000 && F.legal === 1500 && F.sdlt === X.own.sdlt && F.totalIn === X.v.totalIn && F.cashLeft === X.v.cashLeft && F.newMortgage === X.v.newMortgage && F.rent === X.state.monthlyRent && F.margin === L.exits.none.v.margin, JSON.stringify(F));
ok('... stamp duty is the calculator’s (England, additional home)', F.sdlt === Calc.stampDuty(125000) && F.sdlt === 6250);

var brand = { company: 'Acme Sourcing', name: 'Jo Smith', phone: '07700 900123', email: 'jo@example.com', color: '#1e3a5f' };
var prop = { address: '12 Albert Road', town: 'Margate', postcode: 'ct9 1aa', beds: 3, type: 'terraced house', sqm: '85', epc: 'D' };
var base = { figs: F, prop: prop, brand: brand, client: 'Sarah Reed', fee: 3000, date: '7 October 2026', note: 'Bought well under value.' };
var d = DP.data(Object.assign({ hide: true }, base));
ok('hide address: the title is the kind of house and the town', d.title === '3-bed terraced house, Margate', d.title);
ok('... the area reads the town and outward code until reserved', d.sub === 'Margate CT9 · exact address once reserved' && d.short === 'Margate CT9' && d.district === 'Margate CT9', d.sub);
ok('... and the street address appears nowhere', JSON.stringify(d).indexOf('Albert Road') < 0);
var dShow = DP.data(Object.assign({ hide: false }, base));
ok('address shown: the title is the address, with the postcode under it', dShow.title === '12 Albert Road' && dShow.sub === 'Margate CT9 1AA · 3-bed terraced house' && /Albert Road/.test(dShow.areaNote), dShow.sub);
ok('no address typed: the title falls back to the kind of house even when shown', DP.data(Object.assign({}, base, { prop: { town: 'Hull', beds: 2, type: 'semi' }, hide: false })).title === '2-bed semi, Hull');

ok('the four key figures: price, value after works, refurb, cash pulled out (green)', d.stats.map(function (s) { return s.label + ' ' + s.val; }).join('|') === 'Purchase price £125,000|Value after works £230,000|Refurb £30,000|Pulled out at refinance £9,750' && d.stats[3].color === '#2f8a5b', d.stats.map(function (s) { return s.val; }).join());
ok('costs: price, stamp duty, refurb, legal, total, then the fee on its own line', d.costs.map(function (r) { return r.label + ' ' + r.val; }).join('|') === 'Purchase price £125,000|Stamp duty £6,250|Refurbishment £30,000|Legal costs £1,500|Total cost £162,750|Plus sourcing fee £3,000', d.costs.map(function (r) { return r.label + ' ' + r.val; }).join('|'));
ok('... the total is the calculator’s total money in', d.costs.filter(function (r) { return r.strong; })[0].val === '£' + Math.round(X.v.totalIn).toLocaleString('en-GB'));
ok('after works: value, refinance at 75%, deposit at 25%', d.after.map(function (r) { return r.label + ' ' + r.val; }).join('|') === 'Value after works £230,000|Refinance at 75% £172,500|Deposit at purchase (25%) £31,250');
ok('rent figures: a month, a year and the gross yield on value', d.evidence[0].big === '£1,000 a month' && d.evidence[0].detail === '£12,000 a year.' && d.evidence[1].big === '5.2%');
ok('EPC and size: rating, floor area, beds, value per sqm', d.epc.map(function (e) { return e.val; }).join('|') === 'D|85 sqm|3-bed|£2,706');
ok('flip at 29.2% is green; BRR → BTL at £81 a month is red (under £500)', d.exits[0].head === '29.2% margin' && d.exits[0].color === '#2f8a5b' && d.exits[1].head === '£81/mo' && d.exits[1].color === '#c0392b', JSON.stringify(d.exits));
ok('flip colours follow the target: 32% target makes 29.2% amber, 36% makes it red', DP.data(Object.assign({}, base, { flipTarget: 32 })).exits[0].color === '#b7791f' && DP.data(Object.assign({}, base, { flipTarget: 36 })).exits[0].color === '#c0392b');
ok('no verdict or score anywhere in the words', !/verdict|score|good deal|strong|weak|borderline|hits \d of/i.test(JSON.stringify(d, function (k, v) { return k === 'strong' ? undefined : v; })));
ok('nothing typed: plain words, no stray dashes', DP.data({ figs: F }).sub === 'Property' && DP.data({ figs: F }).epc[2].val === '–');

// Other costs and bridging appear only when there are any; the total includes them (no double counting)
var Lb = Calc.ledger(Object.assign({ otherUpfront: 1000 }, deal), true), Fb = DP.figsFromLedger(Lb), db = DP.data(Object.assign({}, base, { figs: Fb }));
ok('other costs and the bridge get their own lines and the total is the calculator’s', db.costs.map(function (r) { return r.label; }).join('|') === 'Purchase price|Stamp duty|Refurbishment|Legal costs|Other costs|Bridging cost|Total cost|Plus sourcing fee' && db.costs[6].val === DP.money(Lb.exits.btl.v.totalIn), db.costs[6].val + ' vs ' + Lb.exits.btl.v.totalIn);
ok('cash left in (bridged) is amber and says left in', db.stats[3].label === 'Left in after refinance' && db.stats[3].color === '#b7791f' && db.keyLabel === 'Cash left in after refinance');
var edge = function (m, t) { return DP.data(Object.assign({}, base, { figs: Object.assign({}, F, { margin: m }), flipTarget: t })).exits[0].color; };
ok('flip colour at the edges: exactly the target is green, just under is amber, 5 points under is still amber, below that red', edge(0.25, 25) === '#2f8a5b' && edge(0.2495, 25) === '#2f8a5b' && edge(0.2494, 25) === '#b7791f' && edge(0.20, 25) === '#b7791f' && edge(0.1994, 25) === '#c0392b');
var zero = DP.data(Object.assign({}, base, { figs: Object.assign({}, F, { cashLeft: 0 }) })), one = DP.data(Object.assign({}, base, { figs: Object.assign({}, F, { cashLeft: 1 }) }));
ok('cash left exactly £0 counts as all pulled out (green); £1 left in is amber', zero.stats[3].color === '#2f8a5b' && one.stats[3].color === '#b7791f' && one.stats[3].label === 'Left in after refinance');
ok('a full postcode shows only its first half when hidden', DP.data(Object.assign({}, base, { hide: true, prop: Object.assign({}, prop, { postcode: 'CT9 1AA' }) })).district === 'Margate CT9');
ok('a fee of 0 leaves the fee line out of the costs', DP.data(Object.assign({}, base, { fee: 0 })).costs.every(function (r) { return r.label !== 'Plus sourcing fee'; }));

// Sections and pages
ok('all nine sections by default, in the design’s order', DP.sectionsOn({}).join() === 'summary,figures,exits,evidence,epc,area,photos,fee,next');
ok('switched-off sections leave; a re-ordered list keeps its order', DP.sectionsOn({ order: ['next', 'summary', 'fee'], off: { fee: true } }).join() === 'next,summary,figures,exits,evidence,epc,area,photos');
ok('unknown names in a template are dropped', DP.sectionsOn({ order: ['summary', 'bogus'] }).indexOf('bogus') < 0);
var pg = DP.paginate(DP.sectionsOn({}));
ok('cover, then two sections a page: 9 sections = 6 pages', pg.length === 6 && pg[0].cover && pg[1].blocks.join() === 'summary,figures' && pg[5].blocks.join() === 'next' && pg.every(function (p, i) { return p.num === i + 1 && p.total === 6; }));
ok('two sections = 2 pages; none = the cover alone', DP.paginate(['summary', 'fee']).length === 2 && DP.paginate([]).length === 1);

// The page HTML, in every look
DP.LOOK_LIST.forEach(function (l) {
  pg.forEach(function (p) {
    var html = DP.pageHTML(p, l[0], brand, d, {});
    ok(l[0] + ' page ' + p.num + ': footer disclaimer, company and email, and n / total', html.indexOf('Estimates only, not financial, tax or legal advice') > 0 && html.indexOf('Acme Sourcing · jo@example.com') > 0 && html.indexOf(p.num + ' / 6') > 0);
    ok(l[0] + ' page ' + p.num + ': no street address when hidden', html.indexOf('Albert Road') < 0);
    if (!p.cover) ok(l[0] + ' page ' + p.num + ': its two sections with their headings', p.blocks.every(function (k) { return html.indexOf('data-sec="' + k + '"') > 0 && html.indexOf(DP.SECS[k][0]) > 0; }));
  });
});
var cov = function (look) { return DP.pageHTML(pg[0], look, brand, d, { cover: 'data:image/jpeg;base64,AAAA' }); };
ok('classic cover: the photo, the serif title, the four figures and prepared for', /<img src="data:image\/jpeg;base64,AAAA"/.test(cov('classic')) && cov('classic').indexOf('3-bed terraced house, Margate') > 0 && cov('classic').indexOf('£9,750') > 0 && cov('classic').indexOf('Prepared for Sarah Reed · 7 October 2026') > 0);
ok('memo cover has no photo; the others do', cov('memo').indexOf('<img') < 0 && ['classic', 'editorial', 'bold'].every(function (l) { return cov(l).indexOf('<img') > 0; }));
ok('the brand colour is used (and a bad colour falls back to the first swatch)', cov('bold').indexOf('#1e3a5f') > 0 && DP.pageHTML(pg[0], 'bold', Object.assign({}, brand, { color: 'red;x' }), d, {}).indexOf('#1f5c4a') > 0 && DP.pageHTML(pg[0], 'bold', Object.assign({}, brand, { color: 'red;x' }), d, {}).indexOf('red;x') < 0);
ok('initials when there is no logo; the logo when there is', DP.initials(brand) === 'AS' && cov('classic').indexOf('>AS<') > 0 && DP.pageHTML(pg[0], 'classic', Object.assign({ logo: 'data:image/png;base64,BBBB' }, brand), d, {}).indexOf('data:image/png;base64,BBBB') > 0);
ok('typed words are escaped', DP.pageHTML(pg[1], 'classic', brand, DP.data(Object.assign({}, base, { note: '<b>x</b>' })), {}).indexOf('<b>x</b>') < 0);
var photos = DP.pageHTML(DP.paginate(['photos'])[1], 'classic', brand, d, { photos: ['data:image/jpeg;base64,P1', '', 'data:image/jpeg;base64,P3'] });
ok('the gallery shows the photos given (blanks skipped); none = "More photos on request."', (photos.match(/<img/g) || []).length === 2 && DP.pageHTML(DP.paginate(['photos'])[1], 'classic', brand, d, {}).indexOf('More photos on request.') > 0);
ok('next steps point to the link when there is one, else to calling', DP.data(Object.assign({ link: true }, base)).steps[0].text === 'Reserve with the button on the link sent with this pack. No payment yet.' && /^Reserve by calling or emailing Jo Smith/.test(d.steps[0].text));
ok('the fee section has the fee on its own and the terms', DP.pageHTML(DP.paginate(['fee'])[1], 'memo', brand, d, {}).indexOf('£3,000') > 0 && d.terms === DP.DEFAULT_TERMS);
ok('looks: four, each with the hand-off values', DP.LOOK_LIST.length === 4 && DP.look('bold', '#123456').hdrBg === '#123456' && DP.look('bold', '#123456').shBg === '#123456' && DP.look('classic', '#123456').shInk === '#123456' && DP.look('editorial', '#123456').shFont.indexOf('28px') > 0 && DP.look('memo', '#123456').shFont.indexOf('monospace') > 0 && DP.look('nope', '#123456').ruleH === '3px');

// The link: words and figures only (no photos, no logo), read back exactly
var pay = DP.linkPayload(d, { off: { epc: true } }, Object.assign({ logo: 'data:image/png;base64,LOGO' }, brand), 'bold');
ok('the link carries no photos or logo, and the sections chosen', JSON.stringify(pay).indexOf('data:image') < 0 && pay.on.indexOf('epc') < 0 && pay.on.length === 8 && pay.look === 'bold');
ok('the link says there are photos only when told to (hasPhotos), and never carries them', pay.hasPhotos === false && DP.linkPayload(d, {}, brand, 'classic', true).hasPhotos === true && JSON.stringify(DP.linkPayload(d, {}, brand, 'classic', true)).indexOf('data:image') < 0);
ok('the PDF has photos: a cover (not on Memo, which has none) or a gallery photo with the Photos section in', DP.pdfHasPhotos({ cover: 'c' }, {}, 'classic') && !DP.pdfHasPhotos({ cover: 'c' }, {}, 'memo') && DP.pdfHasPhotos({ photos: ['', 'g'] }, {}, 'memo') && !DP.pdfHasPhotos({ photos: ['', 'g'] }, { off: { photos: true } }, 'classic') && !DP.pdfHasPhotos({ photos: ['', ''] }, {}, 'classic') && !DP.pdfHasPhotos({}, {}, 'bold'));
var gal = DP.pageHTML(DP.paginate(['photos'])[1], 'classic', Object.assign({ logo: 'data:image/png;base64,LG' }, brand), d, { photos: ['data:image/jpeg;base64,P1', 'data:image/jpeg;base64,P2'] });
var imgs = function (html) { return html.match(/<img [^>]*>/g) || []; };
ok('every photo in the gallery, and the logo, loads at once (loading="eager")', imgs(gal).length === 3 && imgs(gal).every(function (t) { return t.indexOf('loading="eager"') > 0; }));
ok('the cover photo loads at once in every look that has one', ['classic', 'editorial', 'bold'].every(function (l) { var t = imgs(DP.pageHTML(pg[0], l, brand, d, { cover: 'data:image/jpeg;base64,C' })); return t.length === 1 && t[0].indexOf('loading="eager"') > 0; }));
ok('Memo’s subtitle says it has no cover photo', DP.LOOK_LIST[3][2] === 'Figure-led, no cover photo');
var rm = DP.reserveMessage(pay, { name: 'Sarah Reed', phone: '07700 111222', email: '' });
ok('reserve message: name and phone, to the sourcer by text, WhatsApp or email', rm.ok && /^Hello Jo, I would like to reserve 3-bed terraced house, Margate \(pack prepared for Sarah Reed\)\.\nName: Sarah Reed\nPhone: 07700 111222$/.test(rm.body) && rm.sms.indexOf('sms:07700900123?&body=') === 0 && rm.whatsapp.indexOf('https://wa.me/447700900123?text=') === 0 && rm.email.indexOf('mailto:jo@example.com?subject=') === 0, rm.body);
ok('... needs a name and a phone', !DP.reserveMessage(pay, { name: 'Sarah', phone: ' ' }).ok && !DP.reserveMessage(pay, { name: '', phone: '0770' }).ok);
ok('... a +44 number goes to WhatsApp as it is', DP.reserveMessage(Object.assign({}, pay, { b: Object.assign({}, pay.b, { phone: '+44 7700 900123' }) }), { name: 'a', phone: 'b' }).whatsapp.indexOf('https://wa.me/447700900123') === 0);

Promise.all([DP.encode(pay), DP.encode(pay, true)]).then(function (codes) {
  ok('the squeezed code starts with z and is shorter than the plain one', codes[0].charAt(0) === 'z' && codes[1].charAt(0) === 'j' && codes[0].length < codes[1].length, codes[0].length + ' vs ' + codes[1].length);
  ok('the code is safe in an address (no + / =)', /^[A-Za-z0-9_-]+$/.test(codes[0]) && /^[A-Za-z0-9_-]+$/.test(codes[1]));
  ok('a full pack fits a short link (under 2,500 characters)', codes[0].length < 2500, codes[0].length);
  return Promise.all([DP.decode(codes[0]), DP.decode('#' + codes[1]), DP.decode('zNOTVALID'), DP.decode('xx'), DP.decode('j' + Buffer.from('{"x":1}').toString('base64').replace(/=+$/, '')), DP.decode(codes[0].slice(0, 40))].map(function (p) { return p.then(function (v) { return v; }, function () { return 'ERR'; }); }));
}).then(function (r) {
  ok('both codes read back exactly (accents, £ and → included)', JSON.stringify(r[0]) === JSON.stringify(pay) && JSON.stringify(r[1]) === JSON.stringify(pay));
  ok('a broken or cut-off code is refused, not shown half-read', r[2] === 'ERR' && r[3] === 'ERR' && r[4] === 'ERR' && r[5] === 'ERR');
  console.log((fails ? fails + ' FAILED of ' : 'all ') + count + ' deal pack checks' + (fails ? '' : ' passed'));
  process.exit(fails ? 1 : 0);
});

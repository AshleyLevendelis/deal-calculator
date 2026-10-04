// Checks the hand-built PDF is a well-formed file and says what it was given.
// Pass a path as the first argument to also write the PDF out (used to read it back with a real PDF tool).
const Pdf = require('./pdf.js');
let fail = 0, ran = 0;
const ok = (name, cond, extra) => { ran++; if (!cond) fail++; console.log((cond ? 'ok:   ' : 'FAIL: ') + name + (cond ? '' : ' ' + (extra || ''))); };

const row = (name, o) => Object.assign({ name, refinance: false, roi: '10.0%', monthly: '£100.00', annual: '£1,200', moneyIn: '£12,000', extra: '120 months' }, o || {});
const input = (over) => Object.assign({
  title: 'Deal comparison', date: '26 September 2026', sortLabel: 'ROI',
  details: [['Purchase price', '£200,000'], ['Deposit %', '20%'], ['Legal costs', '£1,500']],
  rows: [row('BRR to HMO', { refinance: true, roi: '∞ (no cash left in)', extra: 'Left in -£6,000' }), row('R2R SA', { roi: '217.6%' }), row('BTL', { roi: '-6.1%', monthly: '-£969.38', extra: 'Not at this profit' })],
  flip: { profit: '£50,750', margin: '22.1%', roi: '28.3%', moneyIn: '£179,250' }
}, over || {});

const text = b => Buffer.from(b).toString('latin1');
const bytes = Pdf.build(input());
const s = text(bytes);
ok('starts as a PDF and ends with EOF', s.startsWith('%PDF-1.4') && s.trimEnd().endsWith('%%EOF'));
// Every cross-reference offset must point at the start of its object, or viewers reject the file.
const xrefAt = +/startxref\n(\d+)/.exec(s)[1];
ok('startxref points at the xref table', s.slice(xrefAt, xrefAt + 4) === 'xref');
const entries = [...s.slice(xrefAt).matchAll(/(\d{10}) 00000 n /g)].map(m => +m[1]);
ok('xref lists every object', entries.length === (s.match(/\d+ 0 obj/g) || []).length, entries.length);
ok('every xref offset lands on its object', entries.every((off, i) => s.slice(off).startsWith((i + 1) + ' 0 obj')));
// Every stream's declared length is its real length
const streams = [...s.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)];
ok('every stream length is exact', streams.length > 0 && streams.every(m => +m[1] === m[2].length));
ok('the pound sign is a single WinAnsi byte', bytes.includes(0xA3) && !s.includes('Â'));
ok('infinity is written as words, not corrupted', s.includes('No cash left in') && !/∞/.test(s));
ok('the content the caller supplied is in the file', ['Deal comparison', 'BRR to HMO *', 'R2R SA', 'Purchase price', '200,000', 'Left in -', '50,750', 'Ranked by ROI'].every(t => s.includes(t)));
ok('the best row is the first one given', s.indexOf('BRR to HMO') < s.indexOf('R2R SA') && s.indexOf('R2R SA') < s.indexOf('BTL'));
ok('one page for a short comparison', (s.match(/\/Type \/Page /g) || []).length === 1 && /\/Count 1 /.test(s));

// Hostile text cannot break the file: brackets and backslashes are escaped, non-Latin-1 becomes '?'
const evil = Pdf.build(input({ details: [['Name (x) \\ 中', 'a)b']] }));
const es = text(evil);
ok('brackets and backslashes are escaped', es.includes('Name \\(x\\) \\\\ ?') && es.includes('a\\)b'));
ok('still well-formed with awkward text', +/startxref\n(\d+)/.exec(es)[1] > 0 && [...es.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)].every(m => +m[1] === m[2].length));

// Many details flow onto a second page instead of running off the bottom
const many = Pdf.build(input({ details: Array.from({ length: 150 }, (_, i) => ['Detail ' + i, '£' + i]) }));
const ms = text(many);
ok('a long list paginates', (ms.match(/\/Type \/Page /g) || []).length >= 2 && /Page 2 of/.test(ms));
// Nothing may be drawn below the bottom margin (the page number sits at y=36; content must stay above y=64)
const ys = str => [...str.matchAll(/ (-?[\d.]+) (-?[\d.]+) Td \(/g)].map(m => +m[2]).filter(y => y > 36 || y < 36 - 1e-9 && false);
const lows = [...ms.matchAll(/BT \/F\d \d+ Tf [\d. ]+g ([\d.]+) (-?[\d.]+) Td \(([^)]*)\)/g)].filter(m => !/^Page \d+ of/.test(m[3])).map(m => +m[2]);
ok('nothing is drawn off the bottom of any page', lows.length > 100 && Math.min(...lows) >= 40, 'lowest y=' + Math.min(...lows));
ok('paginated file keeps exact offsets', [...ms.slice(+/startxref\n(\d+)/.exec(ms)[1]).matchAll(/(\d{10}) 00000 n /g)].every((m, i) => ms.slice(+m[1]).startsWith((i + 1) + ' 0 obj')));
// Empty deal says so
ok('empty deal says examples are used', text(Pdf.build(input({ details: [] }))).includes('No details entered'));

// ---- Flip target colour: green at/above target, red below, black when no verdict ----
const flipText = v => text(Pdf.build(input({ flip: { profit: '£50,750', margin: '22.1% (meets the 20% target)', marginVerdict: v, roi: '28.3%', moneyIn: '£179,250' } })));
const colourOf = (s, needle) => { const m = new RegExp('BT /F2 9 Tf ([\\d. ]+ r?g) [\\d.]+ [\\d.]+ Td \\(' + needle.replace(/[()]/g, '\\\\$&')).exec(s); return m && m[1]; };
ok('margin is drawn green when it meets the target', colourOf(flipText('good'), '22.1%') === '0.08 0.5 0.2 rg', colourOf(flipText('good'), '22.1%'));
ok('margin is drawn red when it is below the target', colourOf(flipText('bad'), '22.1%') === '0.75 0.1 0.1 rg', colourOf(flipText('bad'), '22.1%'));
ok('margin is black when there is no verdict', colourOf(flipText(null), '22.1%') === '0 g', colourOf(flipText(null), '22.1%'));
ok('only the margin line is coloured', (flipText('good').match(/0\.08 0\.5 0\.2 rg/g) || []).length === 1 && !/rg/.test(text(Pdf.build(input()))));
ok('the words say it too, so colour is not the only signal', flipText('good').includes('meets the 20% target'));

// ---- Saved-deals variant: no single "your deal", no flip block, a small calculator line under each deal name ----
const saved = Pdf.build(input({ title: 'Saved deals comparison', details: null, flip: null, tableTitle: 'SAVED DEALS', nameHeading: 'Deal', note: 'Each deal is run through the calculator shown under its name.',
  rows: [row('12 Wellington Terrace Extension', { sub: 'BTL', roi: '12.0%' }), row('9 Mill Rd', { sub: 'HMO BTL' }), row('Flat 3', { sub: 'BRR to SA', refinance: true })] }));
const ss = text(saved);
ok('saved deals: no "YOUR DEAL" block', !ss.includes('YOUR DEAL') && !ss.includes('No details entered'));
ok('saved deals: no flip block', !ss.includes('IF YOU FLIP'));
ok('saved deals: own table title and column heading', ss.includes('SAVED DEALS') && ss.includes('(Deal) Tj'));
ok('saved deals: calculator line under each name', ['(BTL)', '(HMO BTL)', '(BRR to SA)'].every(t => ss.includes(t)));
ok('saved deals: a long name is cut to fit its column', ss.includes('12 Wellington T..') && !ss.includes('12 Wellington Terrace Extension'));
ok('saved deals: own closing note', ss.includes('run through the calculator shown'));
ok('saved deals: refinance footnote shown only when a refinance row exists', ss.includes('cash left in after refinancing') && !text(Pdf.build(input({ details: null, flip: null, rows: [row('A'), row('B')] }))).includes('after refinancing'));
ok('saved deals: file is well-formed', [...ss.slice(+/startxref\n(\d+)/.exec(ss)[1]).matchAll(/(\d{10}) 00000 n /g)].every((m, i) => ss.slice(+m[1]).startsWith((i + 1) + ' 0 obj')));
// Many saved deals paginate and repeat the column headings on the new page
const lots = text(Pdf.build(input({ details: null, flip: null, rows: Array.from({ length: 40 }, (_, i) => row('Deal ' + i, { sub: 'BTL' })) })));
ok('40 saved deals paginate with headings repeated', (lots.match(/\/Type \/Page /g) || []).length >= 2 && (lots.match(/\(Strategy\) Tj/g) || []).length >= 2);
const lowRows = [...lots.matchAll(/BT \/F\d \d+ Tf [\d. ]+g ([\d.]+) (-?[\d.]+) Td \(([^)]*)\)/g)].filter(m => !/^Page \d+ of/.test(m[3])).map(m => +m[2]);
ok('40 saved deals: nothing is drawn off the bottom', Math.min(...lowRows) >= 40, 'lowest y=' + Math.min(...lowRows));

// ---- Client report header: prepared for/by ----
ok('no header line when neither is given', !text(Pdf.build(input())).includes('Prepared for'));
const both = text(Pdf.build(input({ preparedFor: 'Jane Client', preparedBy: 'Ashley' })));
ok('both names appear when both are given', both.includes('Prepared for Jane Client') && both.includes('Prepared by Ashley'));
ok('only "for" appears when only "for" is given', text(Pdf.build(input({ preparedFor: 'Jane Client' }))).includes('Prepared for Jane Client') && !text(Pdf.build(input({ preparedFor: 'Jane Client' }))).includes('Prepared by'));
ok('a name with brackets is escaped like any other text', text(Pdf.build(input({ preparedFor: 'Smith (Ltd)' }))).includes('Smith \\(Ltd\\)'));
ok('adding the header keeps the file well-formed', (() => { const s2 = text(Pdf.build(input({ preparedFor: 'A', preparedBy: 'B' }))); return [...s2.slice(+/startxref\n(\d+)/.exec(s2)[1]).matchAll(/(\d{10}) 00000 n /g)].every((m, i) => s2.slice(+m[1]).startsWith((i + 1) + ' 0 obj')); })());

if (process.argv[2]) require('fs').writeFileSync(process.argv[2], Buffer.from(bytes));
console.log(ran + ' checks ran');
process.exit(fail ? 1 : 0);

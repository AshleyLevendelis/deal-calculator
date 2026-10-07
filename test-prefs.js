// node test-prefs.js — what the setup answers change (design 10): where the Calculator opens, the order of every
// strategy list, client reports for sourcers, and the "You're set up" summary.
const P = require('./prefs.js');
let n = 0, fail = 0;
const eq = (name, got, want) => { n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log((ok ? 'ok:   ' : 'FAIL: ') + name + (ok ? '' : ' got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want))); };

// the Calculator tab's strategies in their usual order (app.js STRATS)
const IDS = ['brr', 'recycle', 'btl', 'hmo', 'sabtl', 'r2rhmo', 'r2rsa', 'bridging'];
eq('single let: BTL first, the rest as usual', P.order('single', IDS), ['btl', 'brr', 'recycle', 'hmo', 'sabtl', 'r2rhmo', 'r2rsa', 'bridging']);
eq('by the room: HMO BTL and R2R HMO first, in their own order', P.order('hmo', IDS), ['hmo', 'r2rhmo', 'brr', 'recycle', 'btl', 'sabtl', 'r2rsa', 'bridging']);
eq('nightly: SA BTL and R2R SA first', P.order('sa', IDS), ['sabtl', 'r2rsa', 'brr', 'recycle', 'btl', 'hmo', 'r2rhmo', 'bridging']);
eq('not sure: the usual order', P.order('unsure', IDS), IDS);
eq('no answer: the usual order', P.order('', IDS), IDS);
eq('the rent to rent pair: R2R SA first for nightly, R2R HMO first otherwise', [P.order('sa', ['r2rhmo', 'r2rsa']), P.order('hmo', ['r2rhmo', 'r2rsa']), P.order('single', ['r2rhmo', 'r2rsa'])], [['r2rsa', 'r2rhmo'], ['r2rhmo', 'r2rsa'], ['r2rhmo', 'r2rsa']]);
eq('a list in another order keeps its order inside each part', P.order('hmo', ['bridging', 'r2rhmo', 'btl', 'hmobrr', 'hmo']), ['r2rhmo', 'hmobrr', 'hmo', 'bridging', 'btl']);
eq('the list given is not changed', (() => { const l = IDS.slice(); P.order('sa', l); return l; })(), IDS);

// where the Calculator opens when nothing in the address says: the main screen with that way out chosen
eq('opens on: single BRR to BTL, by the room BRR to HMO, nightly BRR to SA', ['single', 'hmo', 'sa'].map(P.opening), [{ calc: 'brr', exit: 'btl' }, { calc: 'brr', exit: 'hmo' }, { calc: 'brr', exit: 'sa' }]);
eq('not sure / no answer: nothing changes', ['unsure', '', undefined].map(P.opening), [null, null, null]);
eq('and says so', ['single', 'hmo', 'sa', 'unsure'].map(P.openingName), ['BRR → BTL', 'BRR → HMO', 'BRR → SA', 'BRR → BTL']);
eq('the Settings line', [P.letNote('hmo'), P.letNote('unsure')], ['Opens on BRR → HMO. Shown first: HMO BTL and R2R HMO.', 'Opens on BRR → BTL. Every strategy, in the usual order.']);

// who you are
eq('only a sourcer gets client reports', ['new', 'invest', 'source', '', undefined].map(P.clientReports), [false, false, true, false, false]);
eq('what each switches on', [P.does('new').length, P.does('invest')[0], P.does('source')[0]], [2, 'Explanations off: just the numbers', 'Client report button on every deal']);
eq('no answer reads as an investor', P.does(''), P.does('invest'));

// "You're set up"
const s1 = P.summary('source', 'hmo', false, { price: '60000', end: '225000' });
eq('sourcer, HMO, typed figures', s1.map(r => [r.ok, r.title]), [[true, 'Calculator opens on BRR → HMO'], [false, 'Explanations off'], [true, 'Client reports on'], [true, 'Your first deal is started']]);
eq('the figures as typed', s1[3].sub, 'Price £60,000, end value £225,000.');
const s2 = P.summary('new', 'unsure', true, {});
eq('new, not sure, nothing typed: no client reports row', s2.map(r => [r.ok, r.title]), [[false, 'Calculator opens on BRR → BTL'], [true, 'Explanations on'], [false, 'Using the example deal']]);
eq('only the end value typed', P.summary('invest', 'sa', false, { end: '150000' })[2].sub, 'end value £150,000.');
eq('a price of 0 is not a typed figure', P.summary('invest', 'sa', false, { price: '0', end: '' })[2].title, 'Using the example deal');
eq('an odd stored answer is treated as no answer', [P.opening('constructor'), P.order('toString', ['btl', 'hmo']), P.openingName('__proto__'), P.does('constructor')], [null, ['btl', 'hmo'], 'BRR → BTL', P.does('invest')]);
console.log(n + ' checks ran');
process.exit(fail ? 1 : 0);

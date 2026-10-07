// Checks the app shell after the deal feed was taken out of the Deal Analyser: every element the code looks up exists,
// there are exactly two tabs (Calculator, Saved), the app has its own name, and nothing from the deal feed is left.
const fs = require('fs');
let n = 0, fails = 0;
function ok(name, cond, extra) { n++; if (cond) console.log('ok:   ' + name); else { fails++; console.log('FAIL: ' + name + ' ' + (extra || '')); } }
const app = fs.readFileSync(__dirname + '/app.js', 'utf8'), html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync(__dirname + '/manifest.webmanifest', 'utf8'));
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));

const wanted = [...new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]))];
const missing = wanted.filter(id => !ids.has(id));
ok('every element the app looks up is on the page', wanted.length > 10 && !missing.length, missing.join(', '));
const tabs = [...html.matchAll(/role="tab" id="([^"]+)"/g)].map(m => m[1]);
ok('two tabs: Calculator then Saved', tabs.join(',') === 't-home,t-saved', tabs.join(','));
ok('the tab bar has two columns, one per tab', /\.tabs\{[^}]*grid-template-columns:repeat\(2,1fr\)/.test(html));
ok('the Calculator tab starts selected and its screen starts shown', /id="t-home" aria-selected="true"/.test(html) && /<div id="v-home"><\/div>/.test(html));
ok('an empty address opens the Calculator', /: hash === '#report' \? 'report' : 'home';/.test(app));
ok('the page title is BRR Calculator', /<title>BRR Calculator<\/title>/.test(html) && /<h1 id="title">BRR Calculator<\/h1>/.test(html));
ok('the header falls back to BRR Calculator', /: view === 'compare' \? 'Every strategy' : 'BRR Calculator';/.test(app));
ok('the manifest names the app BRR Calculator', manifest.name === 'BRR Calculator' && manifest.short_name && manifest.short_name.length <= 12 && manifest.display === 'standalone');
ok('the manifest icons exist', manifest.icons.every(i => fs.existsSync(__dirname + '/' + i.src)));
// A PNG's width and height sit at bytes 16-23; an install or store listing rejects an icon whose size is wrong.
const pngSize = f => { const b = fs.readFileSync(__dirname + '/' + f); return b.toString('latin1', 1, 4) === 'PNG' ? b.readUInt32BE(16) + 'x' + b.readUInt32BE(20) : 'not a PNG'; };
ok('every manifest icon is a PNG of the size it says', manifest.icons.every(i => pngSize(i.src) === i.sizes), manifest.icons.map(i => i.src + ' ' + pngSize(i.src)).join(', '));
ok('icons for installing: 192, 512 and a maskable 512 (Android shapes)', ['192x192', '512x512'].every(z => manifest.icons.some(i => i.sizes === z && i.purpose === 'any')) && manifest.icons.some(i => i.purpose === 'maskable' && i.sizes === '512x512'));
ok('an iPhone home-screen icon (180) and a 32px tab icon are linked', /rel="apple-touch-icon" href="apple-touch-icon.png"/.test(html) && pngSize('apple-touch-icon.png') === '180x180' && /rel="icon" href="favicon-32.png"/.test(html) && pngSize('favicon-32.png') === '32x32');
ok('the home-screen name is BRR Calc / BRR Calculator', manifest.short_name === 'BRR Calc' && /apple-mobile-web-app-title" content="BRR Calculator"/.test(html));
const scripts = [...html.matchAll(/<script src="([^"]+)">/g)].map(m => m[1]);
ok('the page loads calc.js, pdf.js, prefs.js and app.js only', scripts.join(',') === 'calc.js,pdf.js,prefs.js,app.js', scripts.join(','));

// Nothing that only served the deal feed is left behind.
const feed = ['deals.json', 'history/', 'Geo.', 'geo.js', 'postcodes.io', '#property', '#day/', 'v-today', 'v-property', 't-today', 'renderToday',
  'openDealFromFeed', 'dealContext', 'ctxCard', 'Check this deal', 'Checking', 'dismiss', 'Dismiss', 'markViewed', 'Nearest first', 'endValueSection',
  'How sure is the end value', 'NOTES_KEY', 'savePropertyAsDeal', 'has-actions'];
const leftJs = feed.filter(w => app.includes(w)), leftHtml = feed.filter(w => html.includes(w));
ok('no deal-feed code in the app', !leftJs.length, leftJs.join(', '));
ok('no deal-feed parts on the page', !leftHtml.length, leftHtml.join(', '));
const feedCss = ['.deal-card', '.day-tile', '.fbox', '.near-row', '.ctx-card', '.card-actions', '.ev-reasons', '.agent-card', '.action-bar', '.sure-note', '.route-card', '.tally-row'];
const leftCss = feedCss.filter(c => html.includes(c));
ok('no deal-feed styles', !leftCss.length, leftCss.join(', '));
for (const f of ['geo.js', 'deals.json', 'archive.js', 'history', 'pipeline', '.github']) ok('no ' + f + ' in the repo', !fs.existsSync(__dirname + '/' + f));
// The privacy policy: the standalone page says exactly what the app's sheet says.
const priv = fs.readFileSync(__dirname + '/privacy.html', 'utf8'), P = eval('(' + /var PRIVACY = (\{ updated:[\s\S]*?\]\] \});/.exec(app)[1] + ')');
const unesc = t => t.replace(/&lt;/g, '<').replace(/&amp;/g, '&');
const pageSecs = [...priv.matchAll(/<h2>([^<]*)<\/h2>\n<p>([^<]*)<\/p>/g)].map(m => [unesc(m[1]), unesc(m[2])]);
ok('privacy.html has the same sections and words as the app', JSON.stringify(pageSecs) === JSON.stringify(P.sections) && priv.includes('last updated ' + P.updated), JSON.stringify(pageSecs).slice(0, 200));
ok('the privacy policy does not describe things this app does not do (deal list, postcode search, listing links)', !/deal list|postcode|listing/i.test(JSON.stringify(P.sections)));
ok('the contact email is a clearly marked placeholder until it is filled in', /\[CONTACT EMAIL TO BE ADDED BEFORE LAUNCH\]/.test(JSON.stringify(P.sections)) || /@/.test(P.sections[P.sections.length - 1][1]));
ok('the disclaimer is in the app', app.includes('Estimates only, not financial, tax or legal advice.'));
console.log(n + ' checks ran');
if (fails) process.exit(1);

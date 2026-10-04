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
ok('the page title is Deal Calculator', /<title>Deal Calculator<\/title>/.test(html) && /<h1 id="title">Deal Calculator<\/h1>/.test(html));
ok('the header falls back to Deal Calculator', /: view === 'compare' \? 'Every strategy' : 'Deal Calculator';/.test(app));
ok('the manifest names the app Deal Calculator', manifest.name === 'Deal Calculator' && manifest.short_name && manifest.short_name.length <= 12 && manifest.display === 'standalone');
ok('the manifest icon exists', manifest.icons.every(i => fs.existsSync(__dirname + '/' + i.src)));
const scripts = [...html.matchAll(/<script src="([^"]+)">/g)].map(m => m[1]);
ok('the page loads calc.js, pdf.js and app.js only', scripts.join(',') === 'calc.js,pdf.js,app.js', scripts.join(','));

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
console.log(n + ' checks ran');
if (fails) process.exit(1);

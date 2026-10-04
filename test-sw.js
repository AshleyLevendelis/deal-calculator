// Runs sw.js against a small fake browser (caches, fetch, events) to prove the offline behaviour:
// the last good answers are kept, found again with no signal whatever the "?_=" throwaway was, and nothing else is touched.
// Also checks the app's own files are stored when it is installed, so it works offline from the first visit.
const fs = require('fs'), vm = require('vm');
let n = 0, fails = 0;
function ok(name, cond, extra) { n++; if (cond) console.log('ok:   ' + name); else { fails++; console.log('FAIL: ' + name + ' ' + (extra || '')); } }

function makeWorld(online) {
  const stores = {}, listeners = {}, world = { online, fetched: [], installed: null };
  const caches = {
    open: async name => { const s = stores[name] = stores[name] || {}; return { put: async (k, v) => { s[typeof k === 'string' ? k : k.url] = v; }, addAll: async list => { world.installed = { name, list }; } }; },
    match: async k => { for (const name of Object.keys(stores)) { const v = stores[name][typeof k === 'string' ? k : k.url]; if (v) return v; } return undefined; },
    keys: async () => Object.keys(stores), delete: async () => true
  };
  const res = (body, status) => ({ ok: status < 400, status, body, clone() { return res(body, status); } });
  world.respond = {};                                                     // url -> [status, body]
  const fetch = async req => {
    world.fetched.push(req.url);
    if (!world.online) throw new TypeError('offline');
    const r = world.respond[req.url.split('?')[0]] || [200, 'ok:' + req.url];
    return res(r[1], r[0]);
  };
  const self = { location: { origin: 'https://app.example' }, addEventListener: (t, f) => { listeners[t] = f; } };
  vm.runInNewContext(fs.readFileSync(__dirname + '/sw.js', 'utf8'), { self, caches, fetch, URL, Promise });
  world.send = async (url, method) => {                                   // returns { handled, response }
    const req = { url, method: method || 'GET' }; let answered = null, handled = false;
    listeners.fetch({ request: req, respondWith: p => { handled = true; answered = p; } });
    if (!handled) return { handled: false };
    try { return { handled: true, response: await answered }; } catch (e) { return { handled: true, error: String(e) }; }
  };
  world.flush = () => new Promise(r => setTimeout(r, 10));
  world.install = async () => { let p; listeners.install({ waitUntil: x => { p = x; } }); await p; return world.installed; };
  return world;
}

(async () => {
  const w = makeWorld(true);
  const a = await w.send('https://app.example/app.js?_=111'); await w.flush();
  ok('online: the answer is passed straight through', a.handled && a.response?.body === 'ok:https://app.example/app.js?_=111');
  w.online = false;
  const b = await w.send('https://app.example/app.js?_=222');
  ok('offline: the app comes from the stored copy, whatever the throwaway query was', b.handled && b.response?.body === 'ok:https://app.example/app.js?_=111', JSON.stringify(b));

  const h = makeWorld(true); await h.send('https://app.example/index.html?v=1'); await h.flush(); h.online = false;
  const hb = await h.send('https://app.example/index.html?v=2');
  ok('offline: a page opened before is still there', !!hb.response?.body?.includes('index.html?v=1'));
  const miss = await h.send('https://app.example/never-opened.json?_=2');
  ok('offline: a file never opened is simply missing (no made-up answer)', miss.handled && miss.response === undefined, JSON.stringify(miss));

  const e = makeWorld(true); e.respond['https://app.example/app.js'] = [500, 'broken']; await e.send('https://app.example/app.js?_=1'); await e.flush(); e.online = false;
  const eb = await e.send('https://app.example/app.js?_=2');
  ok('a failed answer (HTTP 500) is not stored over a good one', eb.response === undefined, JSON.stringify(eb));

  const x = makeWorld(true); const cross = await x.send('https://other.example/anything.js');
  ok('other sites are not touched by the worker', cross.handled === false);
  const post = await x.send('https://app.example/app.js', 'POST');
  ok('only GET requests are handled', post.handled === false);

  const f = makeWorld(true); await f.send('https://app.example/app.js?_=1'); await f.flush(); await f.send('https://app.example/app.js?_=2'); await f.flush();
  f.online = false; const fb = await f.send('https://app.example/app.js?_=3');
  ok('the newest good answer replaces the older stored one', fb.response?.body === 'ok:https://app.example/app.js?_=2', JSON.stringify(fb));
  // Installing stores the whole app under this app's own cache name, so it opens offline from the first visit.
  const inst = await makeWorld(true).install();
  ok('the cache name is this app\'s own, not the Deal Analyser\'s', !!inst && /^deal-calculator-v\d+$/.test(inst.name), inst && inst.name);
  const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const needed = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map(m => m[1]).concat([...html.matchAll(/url\('([^']+)'\)/g)].map(m => m[1]));
  ok('every file the page loads is stored on install', needed.length > 5 && needed.every(f => inst.list.includes(f)), needed.filter(f => !inst.list.includes(f)).join(', '));
  ok('every stored file exists (a missing one would stop the install)', inst.list.every(f => f === './' || fs.existsSync(__dirname + '/' + f)), inst.list.filter(f => f !== './' && !fs.existsSync(__dirname + '/' + f)).join(', '));
  ok('nothing from the deal feed is stored', !inst.list.some(f => /geo\.js|deals\.json|history/.test(f)));
  console.log(n + ' checks ran');
  if (fails) process.exit(1);
})();

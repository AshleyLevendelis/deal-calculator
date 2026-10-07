// What the two setup answers change (design 10, 7 Oct 2026). Pure: no storage, no page. app.js reads the answers
// (deal-analyser:persona, deal-analyser:lettingType) and passes them in; test-prefs.js checks every case.
// In this app the Calculator opens on its main screen with the matching way out already chosen (Ashley, 7 Oct 2026):
// single let -> BRR to BTL, by the room -> BRR to HMO, nightly -> BRR to SA; not sure keeps today's start.
(function (root) {
  // How you let -> the strategies that go first in any list (their own order) and the way out the Calculator opens on.
  var LETS = {
    single: { group: ['btl'], exit: 'btl', short: 'BRR → BTL', first: 'BTL' },
    hmo: { group: ['hmo', 'hmobrr', 'r2rhmo'], exit: 'hmo', short: 'BRR → HMO', first: 'HMO BTL and R2R HMO' },
    sa: { group: ['sabtl', 'sabrr', 'r2rsa'], exit: 'sa', short: 'BRR → SA', first: 'SA BTL and R2R SA' }
  };
  function letOf(letting) { return Object.prototype.hasOwnProperty.call(LETS, letting) ? LETS[letting] : null; }
  // ids: strategy ids in their usual order. Returns a new list with the letting's group first; each part keeps its
  // own order. Not sure / no answer: the usual order.
  function order(letting, ids) {
    var l = letOf(letting), list = (ids || []).slice();
    if (!l) return list;
    return list.filter(function (id) { return l.group.indexOf(id) >= 0; }).concat(list.filter(function (id) { return l.group.indexOf(id) < 0; }));
  }
  // Where the Calculator opens when nothing else says (no calculator in the address, after setup): the main screen
  // with this way out chosen. null for not sure / no answer: leave things as they are.
  function opening(letting) { var l = letOf(letting); return l ? { calc: 'brr', exit: l.exit } : null; }
  function openingName(letting) { var l = letOf(letting); return l ? l.short : 'BRR → BTL'; }
  function letNote(letting) {
    var l = letOf(letting);
    return l ? 'Opens on ' + l.short + '. Shown first: ' + l.first + '.' : 'Opens on BRR → BTL. Every strategy, in the usual order.';
  }
  // Who you are -> what it switches on. Only a sourcer gets client reports (and branding near the top of Settings).
  var PERSONA_DOES = {
    'new': ['Explanations switched on next to every result', 'Targets and verdicts explained in words'],
    invest: ['Explanations off: just the numbers', 'Verdict strip stays collapsed'],
    source: ['Client report button on every deal', 'Report branding at the top of Settings', 'Explanations off: just the numbers']
  };
  function does(persona) { return (Object.prototype.hasOwnProperty.call(PERSONA_DOES, persona) ? PERSONA_DOES[persona] : PERSONA_DOES.invest).slice(); }
  function clientReports(persona) { return persona === 'source'; }
  // "You're set up": what the answers changed, in order. figs: { price, end } as typed (blank = the example deal).
  function summary(persona, letting, explanations, figs) {
    var l = letOf(letting), g = function (n) { return '£' + Number(n).toLocaleString('en-GB'); }, out = [];
    out.push(l ? { ok: true, title: 'Calculator opens on ' + l.short, sub: 'Shown first: ' + l.first + '.' }
      : { ok: false, title: 'Calculator opens on BRR → BTL', sub: 'Every strategy, in the usual order.' });
    out.push(explanations ? { ok: true, title: 'Explanations on', sub: 'A plain-English line next to each result.' }
      : { ok: false, title: 'Explanations off', sub: 'Just the numbers. Switch on in Settings.' });
    if (clientReports(persona)) out.push({ ok: true, title: 'Client reports on', sub: 'A Client report button on every saved deal.' });
    var p = figs && Number(figs.price) > 0 ? figs.price : null, e = figs && Number(figs.end) > 0 ? figs.end : null;
    out.push(p || e ? { ok: true, title: 'Your first deal is started', sub: [p && 'Price ' + g(p), e && 'end value ' + g(e)].filter(Boolean).join(', ') + '.' }
      : { ok: false, title: 'Using the example deal', sub: 'Type your own figures on the calculator.' });
    return out;
  }
  var api = { order: order, opening: opening, openingName: openingName, letNote: letNote, does: does, clientReports: clientReports, summary: summary, LETS: LETS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Prefs = api;
})(this);

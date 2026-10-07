// Deal pack screens (design 12a builder, 12b preview, 14c setup; 7 Oct 2026; sourcers only, marked PRO). Loaded after
// dealpack.js and before app.js; app.js calls PackUI(ctx) with the helpers and state it owns. Everything is kept on this
// phone: branding (with the logo), templates, the pack being built and its photos. The link carries words and figures only.
(function (root) {
  root.PackUI = function (X) {
    var h = X.h, load = X.load, store = X.store, $ = function (id) { return document.getElementById(id); };
    var DP = root.DealPack;
    var BRAND = 'deal-analyser:packBrand', TPLS = 'deal-analyser:packTemplates', PACK = 'deal-analyser:pack', PHOTOS = 'deal-analyser:packPhotos:';
    var S = null;                                   // the setup screen's choices while it is open
    var fromDeal = false;                           // setup opened from a deal (its figures) or from Settings (example figures)
    function openSetup(deal) { S = null; fromDeal = !!deal; location.hash = '#pack-setup'; }

    function brand() { return Object.assign({ company: '', name: '', phone: '', email: '', web: '', color: DP.SWATCHES[0], logo: '' }, load(BRAND, {})); }
    function tpls() { var t = load(TPLS, null); return t && t.list ? t : { list: [], def: null }; }
    function tplById(id) { return tpls().list.filter(function (t) { return t.id === id; })[0] || null; }
    function defTpl() { var t = tpls(); return tplById(t.def) || t.list[0] || null; }
    function blankCfg() { return { look: 'classic', order: DP.ORDER.slice(), off: {}, hide: true, fee: DP.DEFAULT_FEE, terms: DP.DEFAULT_TERMS }; }
    function cfgOf(o) { return { look: o.look, order: o.order.slice(), off: Object.assign({}, o.off), hide: !!o.hide, fee: o.fee, terms: o.terms }; }
    function pack() { return load(PACK, null); }
    function photoKey(p) { return PHOTOS + ((p && p.savedId) || 'current'); }
    function photos(p) { var v = load(photoKey(p), null); return { cover: (v && v.cover) || '', photos: (v && v.photos) || [] }; }
    function savePack(p) {
      store(PACK, p);
      if (p.savedId) { var list = X.getDeals(), d = list.filter(function (x) { return x.id === p.savedId; })[0]; if (d) { d.pack = Object.assign({}, p); X.saveDeals(list); } }
    }
    function pagesOf(cfg) { return DP.paginate(DP.sectionsOn(cfg)); }
    function figs() { return DP.figsFromLedger(X.ledger()); }
    function packData(p, B) {
      return DP.data({ figs: figs(), prop: p.prop, brand: B, client: p.client, hide: p.hide, fee: p.fee, terms: p.terms, note: p.note, link: true,
        flipTarget: X.targets().flip, monthlyTarget: X.targets().monthly, exitName: 'BRR → BTL' });
    }
    function pro(cls) { return h('span', 'pk-pro' + (cls ? ' ' + cls : ''), 'PRO'); }
    function btn(cls, text, go) { var b = h('button', cls, text); b.type = 'button'; if (go) b.onclick = go; return b; }

    // ---- start a pack (Save → Make a deal pack, a saved deal's Deal pack button) ----
    function start(savedId) {
      var list = X.getDeals(), sd = list.filter(function (d) { return d.id === savedId; })[0];
      var keep = {}; list.forEach(function (d) { keep[PHOTOS + d.id] = 1; });         // photos of deleted deals are let go
      try { for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && k.indexOf(PHOTOS) === 0 && k !== PHOTOS + 'current' && !keep[k]) localStorage.removeItem(k); } } catch (e) {}
      var p = sd && sd.pack ? Object.assign({}, sd.pack) : pack();
      if (!p || (p.savedId || null) !== (savedId || null)) {
        var t = defTpl();
        p = Object.assign(cfgOf(t || blankCfg()), { tid: t ? t.id : null, savedId: savedId || null, prop: { address: sd ? sd.name : '', town: '', postcode: '', beds: '', type: '', epc: '', sqm: '' }, client: '', note: '' });
      }
      if (sd) X.loadDeal(sd);
      savePack(p);
      if (tpls().list.length) location.hash = '#pack'; else openSetup(true);
    }

    // ---- 14c setup: pick a look, what goes in, branding, save as a template ----
    function setupFrom() { var p = pack(), t = defTpl(); return Object.assign(cfgOf(p || t || blankCfg()), { step: 0, name: '', saved: false }); }
    function renderSetup(box, brandOnly) {
      if (!S || S.brandOnly !== brandOnly) { S = setupFrom(); S.brandOnly = brandOnly; if (brandOnly) S.step = 2; }
      box.innerHTML = ''; box.className = 'pk14';
      var B = brand(), sample = sampleData(B), top = h('div', 'pk14-top');
      var pvBtn = btn('pk14-pvb', 'Preview pack', function () { S.pv = true; renderSetup(box, brandOnly); });
      if (!brandOnly) {
        var bars = h('div', 'pk14-bars'); for (var i = 0; i < 4; i++) bars.appendChild(h('i', i <= S.step ? 'on' : ''));
        top.appendChild(bars); var sr = h('div', 'pk14-sr'); sr.appendChild(h('span', 'pk14-step', 'Step ' + (S.step + 1) + ' of 4')); sr.appendChild(pvBtn); top.appendChild(sr);
      } else { var sr2 = h('div', 'pk14-sr'); sr2.appendChild(h('span', 'pk14-step', 'Deal pack')); sr2.appendChild(pvBtn); top.appendChild(sr2); }
      box.appendChild(top);
      var body = h('div', 'pk14-body'), foot = h('div', 'pk14-foot'); box.appendChild(body); box.appendChild(foot);
      var head = function (t, sub) { body.appendChild(h('h1', 'pk14-h', t)); if (sub) body.appendChild(h('p', 'pk14-sub', sub)); };
      if (S.pv) setupPreview(box, B, sample, brandOnly);
      var go = function (n) { S.step = n; renderSetup(box, brandOnly); window.scrollTo(0, 0); };
      var back = btn('pk14-back', 'Back', function () { if (brandOnly || !S.step) { S = null; X.goBack(); } else go(S.step - 1); });
      var next = btn('pk14-next', 'Next', function () { go(S.step + 1); });
      if (S.step === 0) {
        head('Pick a look', 'Your colour and logo go on whichever you choose. Change it any time.');
        var grid = h('div', 'pk14-looks'); body.appendChild(grid);
        DP.LOOK_LIST.forEach(function (l) {
          var b = btn('pk14-look', null, function () { S.look = l[0]; renderSetup(box, brandOnly); }); b.setAttribute('aria-pressed', S.look === l[0]);
          b.appendChild(thumb(DP.pageHTML(pagesOf(S)[0], l[0], B, sample, {}), 0.252, 'pk14-thumb'));
          var row = h('span', 'pk14-lrow'), tt = h('span', 'pk14-ltxt'); tt.appendChild(h('b', '', l[1])); tt.appendChild(h('small', '', l[2])); row.appendChild(tt);
          var r = h('span', 'st9-radio'); r.appendChild(h('i')); row.appendChild(r); b.appendChild(row); grid.appendChild(b);
        });
        foot.appendChild(h('span', 'pk14-fl', DP.LOOK_LIST.filter(function (l) { return l[0] === S.look; })[0][1])); foot.appendChild(next);
      } else if (S.step === 1) {
        head('What goes in your pack?', 'Tap to add or remove. Cover and disclaimer are always in.');
        var list = h('div', 'pk14-secs'); body.appendChild(list);
        S.order.forEach(function (k) {
          var on = !S.off[k], b = btn('pk14-sec', null, function () { S.off[k] = on; renderSetup(box, brandOnly); }); b.setAttribute('aria-pressed', on);
          var tt = h('span', 'pk14-ltxt'); tt.appendChild(h('b', '', DP.SECS[k][0])); tt.appendChild(h('small', '', DP.SECS[k][1])); b.appendChild(tt);
          b.appendChild(h('span', 'pk-tick', on ? '✓' : '')); list.appendChild(b);
        });
        foot.appendChild(back); foot.appendChild(h('span', 'pk14-fl r', DP.sectionsOn(S).length + ' of ' + DP.ORDER.length + ' sections')); foot.appendChild(next);
      } else if (S.step === 2) {
        head('Add your branding', brandOnly ? 'On every deal pack and its link. Kept on this phone.' : '');
        brandEditor(body, function () { renderSetup(box, brandOnly); });
        foot.appendChild(back);
        if (brandOnly) foot.appendChild(btn('pk14-next', 'Done', function () { S = null; X.goBack(); })); else foot.appendChild(next);
      } else {
        head('Save as a template', 'Every new deal pack starts from this. Change it any time in Settings.');
        var mini = h('div', 'pk14-mini'), mh = h('div', 'pk14-mh'), on = DP.sectionsOn(S);
        mh.appendChild(chipEl(B, 36)); var mt = h('span', 'pk14-mt'); mt.appendChild(h('b', '', B.company || 'Your business name')); mt.appendChild(h('span', '', pagesOf(S).length + ' pages · ' + DP.LOOK_LIST.filter(function (l) { return l[0] === S.look; })[0][1])); mh.appendChild(mt);
        mini.appendChild(mh); var rule = h('div', 'pk14-rule'); rule.style.background = DP.colourOk(B.color); mini.appendChild(rule);
        var chips = h('div', 'pk14-chips'); on.forEach(function (k) { chips.appendChild(h('span', '', DP.SECS[k][0])); }); mini.appendChild(chips); body.appendChild(mini);
        body.appendChild(btn('pk14-pvfull', 'Preview the full pack · ' + pagesOf(S).length + ' pages', function () { S.pv = true; renderSetup(box, brandOnly); }));
        var name = h('input', 'pk14-name'); name.placeholder = 'e.g. Standard pack'; name.value = S.name; name.setAttribute('aria-label', 'Template name'); body.appendChild(name);
        var flash = h('div', 'pk14-flash', '✓ Saved. Used on every new deal pack.'); flash.hidden = !S.saved; body.appendChild(flash);
        var save = btn('pk14-next', 'Save template', function () {
          var nm = name.value.trim(); if (!nm) { name.focus(); return; }
          var t = tpls(), id = 't' + Date.now().toString(36), tpl = Object.assign({ id: id, name: nm }, cfgOf(S));
          t.list.push(tpl); if (!t.def || !tplById(t.def)) t.def = id; store(TPLS, t);    // the first template is the default
          var p = pack(); if (p) { Object.assign(p, cfgOf(S), { tid: id }); savePack(p); }
          flash.hidden = false; save.disabled = true; name.disabled = true; save.textContent = '✓ Saved';     // the design's confirmation, then on
          setTimeout(function () { S = null; location.hash = p ? '#pack' : '#calculators'; }, 1200);
        });
        name.addEventListener('input', function () { S.name = name.value; save.disabled = !name.value.trim(); });
        save.disabled = !S.name.trim();
        foot.appendChild(back); foot.appendChild(save);
      }
    }
    function brandEditor(body, redraw) {
      var B = brand(), set = function (k, v) { var b = brand(); b[k] = v; store(BRAND, b); };
      var logo = h('label', 'pk-logo'), file = h('input'); file.type = 'file'; file.accept = 'image/*'; file.className = 'pk-file';
      if (B.logo) { var im = h('img'); im.src = B.logo; im.alt = 'Your logo'; logo.appendChild(im); } else { logo.appendChild(h('span', 'pk-ph-ic', '▣')); logo.appendChild(h('span', '', 'Tap to add your logo')); }
      logo.appendChild(file); body.appendChild(logo);
      file.onchange = function () { var f = file.files && file.files[0]; if (!f) return; shrink(f, 400, 'image/png').then(function (u) { if (keep(function () { set('logo', u); })) redraw(); }); };
      if (B.logo) body.appendChild(btn('pk-link', 'Remove the logo', function () { set('logo', ''); redraw(); }));
      var cc = h('div', 'pk-card'); cc.appendChild(h('b', 'pk-card-h', 'Brand colour')); var sw = h('div', 'pk-swatches');
      DP.SWATCHES.forEach(function (c) { var b = btn('pk-sw', null, function () { set('color', c); redraw(); }); b.setAttribute('aria-label', 'Colour ' + c); b.setAttribute('aria-pressed', DP.colourOk(B.color) === c); var i = h('i'); i.style.background = c; b.appendChild(i); sw.appendChild(b); });
      cc.appendChild(sw); body.appendChild(cc);
      var fc = h('div', 'pk-card pk-fields');
      [['company', 'Business name', 'text', 'organization'], ['name', 'Your name', 'text', 'name'], ['phone', 'Phone', 'tel', 'tel'], ['email', 'Email', 'email', 'email'], ['web', 'Website', 'url', 'url']].forEach(function (f) {
        fc.appendChild(field(f[1], B[f[0]], function (v) { set(f[0], v); }, { type: f[2], auto: f[3] }));
      });
      body.appendChild(fc);
    }
    function field(label, value, onInput, o) {
      o = o || {};
      var l = h('label', 'pk-field'), inp = h(o.area ? 'textarea' : 'input');
      l.appendChild(h('span', '', label)); if (!o.area) inp.type = o.type || 'text'; if (o.mode) inp.setAttribute('inputmode', o.mode);
      if (o.auto) inp.setAttribute('autocomplete', o.auto); if (o.ph) inp.placeholder = o.ph; if (o.area) inp.rows = o.rows || 3;
      inp.value = value == null ? '' : value; inp.addEventListener('input', function () { onInput(inp.value); }); l.appendChild(inp); return l;
    }
    function chipEl(B, size) {
      var c = h('span', 'pk-chip'); c.style.width = c.style.height = size + 'px';
      if (B.logo) { var im = h('img'); im.src = B.logo; im.alt = ''; c.appendChild(im); c.classList.add('img'); } else { c.textContent = DP.initials(B); c.style.background = DP.colourOk(B.color); }
      return c;
    }
    // Setup's preview (third 14c hand-off): the real pages over the flow, Done, and a look switch that changes the look live.
    function setupPreview(box, B, sample, brandOnly) {
      var ov = h('div', 'pk14-pv'), hd = h('div', 'pk14-pvh'), tt = h('span', 'pk-ltxt'), pages = pagesOf(S), lk = DP.LOOK_LIST.filter(function (l) { return l[0] === S.look; })[0];
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Preview');
      tt.appendChild(h('b', '', 'Preview')); tt.appendChild(h('small', '', lk[1] + ' look · ' + pages.length + ' pages · ' + (fromDeal ? 'this deal’s figures' : 'example figures'))); hd.appendChild(tt);
      hd.appendChild(btn('pk14-done', 'Done', function () { S.pv = false; renderSetup(box, brandOnly); })); ov.appendChild(hd);
      var list = h('div', 'pk14-pvl'), scale = Math.min(0.56, (Math.min(window.innerWidth, 480) - 40) / 600);
      pages.forEach(function (pg) { list.appendChild(thumb(DP.pageHTML(pg, S.look, B, sample, {}), scale, 'pk-page')); }); ov.appendChild(list);
      var sw = h('div', 'pk14-pvs'); sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', 'Look');
      DP.LOOK_LIST.forEach(function (l) { var b = btn('', l[1], function () { S.look = l[0]; renderSetup(box, brandOnly); }); b.setAttribute('aria-pressed', S.look === l[0]); sw.appendChild(b); });
      ov.appendChild(sw); box.appendChild(ov);
    }
    function sampleData(B) {
      var p = fromDeal ? pack() : null, prop = p && p.prop && (p.prop.town || p.prop.beds) ? p.prop : { town: 'Margate', postcode: 'CT9 2AB', beds: 3, type: 'terraced house' };
      return DP.data({ figs: fromDeal ? figs() : DP.figsFromLedger(Calc.ledger({}, false)), prop: prop, brand: B, client: (p && p.client) || 'your client', hide: true, fee: DP.DEFAULT_FEE, link: true });
    }
    // A page drawn small: the real page in a box scaled down (the preview and the look thumbnails)
    function thumb(html, scale, cls) {
      var w = h('div', 'pk-thumb ' + (cls || '')), inner = h('div', 'pk-thumb-in'); w.style.height = Math.round(848 * scale) + 'px'; w.style.width = Math.round(600 * scale) + 'px';
      inner.style.transform = 'scale(' + scale + ')'; inner.innerHTML = html; w.appendChild(inner); return w;
    }

    // ---- photos and the logo: made smaller on the phone and kept there ----
    function shrink(file, max, type) {
      return new Promise(function (ok, no) {
        var url = URL.createObjectURL(file), im = new Image();
        im.onload = function () {
          var k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
          ok(c.toDataURL(type || 'image/jpeg', 0.78));
        };
        im.onerror = function () { URL.revokeObjectURL(url); alert('That file could not be read as a picture.'); no(); };
        im.src = url;
      });
    }
    function keep(fn) {                               // store, or say plainly the phone's space for the app is full
      try { fn(); return true; } catch (e) { alert('This could not be kept: the space this app has on your phone is full. Remove a photo and try again.'); return false; }
    }
    function savePhotos(p, v) { localStorage.setItem(photoKey(p), JSON.stringify(v)); }

    // ---- 12a the builder ----
    function renderBuilder(box) {
      var p = pack(); if (!p) { location.hash = '#calculators'; return; }
      var B = brand(), L = X.ledger(), F = DP.figsFromLedger(L), t = tplById(p.tid), hint = null, refreshCount = function () {};
      box.innerHTML = ''; box.className = 'pk12';
      var pin = h('div', 'pin pk-pin'), ph = h('div', 'pin-head'), back = btn('pin-back', null, X.goBack); back.setAttribute('aria-label', 'Back');
      back.appendChild(h('span', 'chev', '‹')); var bt = h('span', 'pk-ttl'); bt.appendChild(h('span', 'pin-title', 'Deal pack')); bt.appendChild(h('small', '', 'From your calculator · BRR → BTL')); back.appendChild(bt);
      ph.appendChild(back); ph.appendChild(pro()); pin.appendChild(ph); box.appendChild(pin);
      var save = function () { savePack(p); refreshCount(); if (hint) hint(); };
      // template
      var tr = btn('pk-tpl', null, function () { openTemplates(true); }), tt = h('span', 'pk-tpl-t');
      tt.appendChild(h('small', '', 'Template')); tt.appendChild(h('b', '', t ? t.name : 'No template')); tr.appendChild(tt); tr.appendChild(h('span', 'pk-more', 'Change ›')); box.appendChild(tr);
      // from your calculator
      var fc = h('section', 'pk-card'), fh = h('div', 'pk-card-top'); fh.appendChild(h('b', 'pk-card-h', 'From your calculator'));
      fh.appendChild(btn('pk-more', 'Edit in calculator ›', function () { location.hash = '#c/brr'; })); fc.appendChild(fh);
      fc.appendChild(h('p', 'pk-card-sub', 'Every figure in the pack comes from here. Change a figure in the calculator and the pack updates.'));
      var entered = Calc.dealEntered(L.ps);
      [['Strategy', 'BRR → BTL'], ['End value', X.money(F.endValue)], ['Refurb', X.money(F.refurb)], ['Legal', X.money(F.legal)], ['Other costs', X.money(F.other)], ['Stamp duty', X.money(F.sdlt)],
        ['Purchase price', X.money(F.price)], ['Rent', X.money(F.rent) + '/mo'], ['Lender pays / deposit', F.ltv + '% / ' + F.depositPct + '%']].concat(F.bridgeCost ? [['Bridging cost', X.money(F.bridgeCost)]] : []).forEach(function (r) {
        var row = h('div', 'pk-row'); row.appendChild(h('span', '', r[0])); row.appendChild(h('b', 'fig', r[1])); fc.appendChild(row);
      });
      if (!entered) fc.appendChild(h('p', 'pk-warn', 'Add the end value and purchase price in the calculator first.'));
      box.appendChild(fc);
      // property details
      var sh = function (t2, aside) { var d = h('div', 'pk-h'); d.appendChild(h('h2', '', t2)); if (aside) d.appendChild(aside); box.appendChild(d); return d; };
      sh('Property details', h('small', '', 'Not in the calculator'));
      var pc = h('section', 'pk-card pk-fields'), pr = p.prop || (p.prop = {});
      [['address', 'Street address', 'street-address'], ['town', 'Town', 'address-level2'], ['postcode', 'Postcode', 'postal-code'], ['beds', 'Bedrooms', '', 'numeric'], ['type', 'Property type', ''], ['epc', 'EPC rating (optional)', ''], ['sqm', 'Floor area, sqm (optional)', '', 'decimal']].forEach(function (f) {
        pc.appendChild(field(f[1], pr[f[0]], function (v) { pr[f[0]] = f[0] === 'beds' ? v.replace(/[^0-9]/g, '') : v; save(); }, { auto: f[2] || 'off', mode: f[3] }));
      });
      box.appendChild(pc);
      var cc = h('section', 'pk-card pk-fields');
      cc.appendChild(field('Prepared for', p.client, function (v) { p.client = v; save(); }, { ph: 'Your client’s name' }));
      cc.appendChild(field('Your note (in the deal summary)', p.note, function (v) { p.note = v; save(); }, { area: true, ph: 'Why this deal is worth a look' }));
      var hr = h('div', 'pk-switch-row'), ht = h('span', 'pk-ltxt'); ht.appendChild(h('b', '', 'Hide the address'));
      var hs = h('small'); ht.appendChild(hs); hr.appendChild(ht);
      var sw = btn('st9-switch', null, function () { p.hide = !p.hide; sw.setAttribute('aria-checked', p.hide); hint(); save(); });
      sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', !!p.hide); sw.setAttribute('aria-label', 'Hide the address'); sw.appendChild(h('i')); hr.appendChild(sw); cc.appendChild(hr);
      hint = function () { var d = packData(p, B); hs.textContent = 'Shows “' + d.district + '” until the client reserves.'; };
      hint(); box.appendChild(cc);
      // sections
      var count = h('small'); sh('Sections', count);
      var sc = h('section', 'pk-card pk-secs'); box.appendChild(sc);
      var fixedRow = function (name, sub) { var r = h('div', 'pk-sec fixed'); r.appendChild(h('span', 'pk-tick dim', '✓')); var tx = h('span', 'pk-ltxt'); tx.appendChild(h('b', '', name)); tx.appendChild(h('small', '', sub)); r.appendChild(tx); return r; };
      var drawSecs = function () {
        sc.innerHTML = ''; sc.appendChild(fixedRow('Cover with photo', 'Always first'));
        p.order = DP.sectionsOn({ order: p.order }).slice();   // every section, in this pack's order
        p.order.forEach(function (k, i) {
          var on = !p.off[k], r = h('div', 'pk-sec' + (on ? '' : ' off')), tk = btn('pk-tick-b', null, function () { p.off[k] = on; save(); drawSecs(); });
          tk.setAttribute('role', 'checkbox'); tk.setAttribute('aria-checked', on); tk.setAttribute('aria-label', DP.SECS[k][0]); tk.appendChild(h('span', 'pk-tick', on ? '✓' : ''));
          var tx = h('span', 'pk-ltxt'); tx.appendChild(h('b', '', DP.SECS[k][0])); tx.appendChild(h('small', '', DP.SECS[k][1]));
          var mv = function (d, lab, glyph) { var b = btn('pk-mv', glyph, function () { var j = i + d; p.order.splice(j, 0, p.order.splice(i, 1)[0]); save(); drawSecs(); }); b.setAttribute('aria-label', lab + ' ' + DP.SECS[k][0]); b.disabled = i + d < 0 || i + d >= p.order.length; return b; };
          r.appendChild(tk); r.appendChild(tx); r.appendChild(mv(-1, 'Move up', '↑')); r.appendChild(mv(1, 'Move down', '↓')); sc.appendChild(r);
        });
        sc.appendChild(fixedRow('Disclaimer', 'On every page, can’t be removed'));
      };
      drawSecs();
      // photos
      sh('Your photos', h('small', '', 'Cover + up to 6'));
      var phc = h('section', 'pk-card pk-photos'); box.appendChild(phc);
      var drawPhotos = function () {
        phc.innerHTML = ''; var P = photos(p);
        var slot = function (src, label, cls, put) {
          var s = h('div', 'pk-slot ' + cls);
          if (src) {
            var im = h('img'); im.src = src; im.alt = label; s.appendChild(im);
            var rm = btn('pk-rm', '×', function () { put(''); }); rm.setAttribute('aria-label', 'Remove ' + label.toLowerCase()); s.appendChild(rm);
          } else {
            var l = h('label', 'pk-add'), f = h('input'); f.type = 'file'; f.accept = 'image/*'; f.className = 'pk-file'; f.setAttribute('aria-label', 'Add ' + label.toLowerCase());
            l.appendChild(h('span', 'pk-ph-ic', '▣')); l.appendChild(h('span', '', label)); l.appendChild(f); s.appendChild(l);
            f.onchange = function () { var file = f.files && f.files[0]; if (file) shrink(file, cls === 'cover' ? 1400 : 1000).then(put); };
          }
          return s;
        };
        phc.appendChild(slot(P.cover, 'Cover photo', 'cover', function (u) { var v = photos(p); v.cover = u; if (keep(function () { savePhotos(p, v); })) drawPhotos(); }));
        var g = h('div', 'pk-grid'); phc.appendChild(g);
        for (var i = 0; i < 6; i++) (function (i) {
          g.appendChild(slot(P.photos[i], 'Photo ' + (i + 1), 'small', function (u) { var v = photos(p); v.photos[i] = u; if (keep(function () { savePhotos(p, v); })) drawPhotos(); }));
        })(i);
        phc.appendChild(h('p', 'pk-card-sub', 'Your own photos only. They go in the PDF and stay on this phone; the link does not carry them.'));
      };
      drawPhotos();
      // fee and terms
      sh('Fee and terms');
      var ft = h('section', 'pk-card pk-fields');
      ft.appendChild(field('Sourcing fee (£)', p.fee, function (v) { p.fee = Number(String(v).replace(/[^0-9.]/g, '')) || 0; save(); }, { mode: 'numeric' }));
      ft.appendChild(field('Terms', p.terms, function (v) { p.terms = v; save(); }, { area: true, rows: 4 }));
      box.appendChild(ft);
      // branding
      sh('Branding');
      var br = btn('pk-brand', null, function () { location.hash = '#pack-brand'; }), bx = h('span', 'pk-ltxt');
      br.appendChild(chipEl(B, 40)); bx.appendChild(h('b', '', B.company || 'Add your business name')); bx.appendChild(h('small', '', [B.name, B.phone].filter(Boolean).join(' · ') || 'Logo, colour and contact details')); br.appendChild(bx); br.appendChild(h('span', 'pk-more', 'Edit ›'));
      box.appendChild(br);
      // the fixed preview button
      var bar = h('div', 'pk-bar'), go = btn('pk-go', '', function () { location.hash = '#pack-preview'; }); bar.appendChild(go); box.appendChild(bar);
      refreshCount = function () { var n = pagesOf(p).length; count.textContent = n + ' pages'; go.textContent = 'Preview the pack · ' + n + ' pages'; go.disabled = !entered; };
      refreshCount();
    }

    // ---- 12b preview: the pages, then PDF / Copy link / Share ----
    function linkFor(p, B) {
      var base = location.href.split('#')[0].replace(/[^/]*$/, '');
      return DP.encode(DP.linkPayload(packData(p, B), p, B, p.look)).then(function (code) { return base + 'p.html#' + code; });
    }
    function renderPreview(box) {
      var p = pack(); if (!p) { location.hash = '#calculators'; return; }
      var B = brand(), d = packData(p, B), pages = pagesOf(p), P = photos(p);
      box.innerHTML = ''; box.className = 'pk12b';
      var pin = h('div', 'pin pk-pin'), ph = h('div', 'pin-head'), back = btn('pin-back', null, X.goBack); back.setAttribute('aria-label', 'Back');
      back.appendChild(h('span', 'chev', '‹')); back.appendChild(h('span', 'pin-title', 'Preview')); ph.appendChild(back); ph.appendChild(h('span', 'pk-count', pages.length + ' pages')); pin.appendChild(ph); box.appendChild(pin);
      var list = h('div', 'pk-pages'); box.appendChild(list);
      var scale = Math.min(0.62, (Math.min(window.innerWidth, 480) - 32) / 600);
      pages.forEach(function (pg) { list.appendChild(thumb(DP.pageHTML(pg, p.look, B, d, P), scale, 'pk-page')); });
      var bar = h('div', 'pk-acts'), row = h('div', 'pk-acts-row'), note = h('p', 'pk-acts-note', 'The link carries the words and figures, not the photos or your logo.');
      var link = null, getLink = function () { return link ? Promise.resolve(link) : linkFor(p, B).then(function (u) { link = u; return u; }); };
      var pdf = btn('pk-act', null, function () { printPack(pages, p.look, B, d, P); }); pdf.appendChild(h('span', 'pk-act-ic', '↓')); pdf.appendChild(h('span', '', 'PDF'));
      var copy = btn('pk-act', null, function () {
        getLink().then(function (u) {
          var done = function () { cl.textContent = 'Copied'; setTimeout(function () { cl.textContent = 'Copy link'; }, 1800); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { prompt('Copy this link', u); });
          else prompt('Copy this link', u);
        });
      });
      copy.appendChild(h('span', 'pk-act-ic', '⧉')); var cl = h('span', '', 'Copy link'); copy.appendChild(cl);
      var share = btn('pk-act main', null, function () {
        getLink().then(function (u) {
          var text = 'Deal pack: ' + d.title + (B.company ? ', from ' + B.company : '');
          if (navigator.share) navigator.share({ title: d.title, text: text, url: u }).catch(function () {});
          else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(function () { alert('Link copied. Paste it into WhatsApp or an email.'); });
          else prompt('Copy this link', u);
        });
      });
      share.appendChild(h('span', 'pk-act-ic', '↗')); share.appendChild(h('span', '', 'Share'));
      row.appendChild(pdf); row.appendChild(copy); row.appendChild(share); bar.appendChild(row); bar.appendChild(note); box.appendChild(bar);
    }
    // The PDF: the browser's own print to PDF, one A4 page a sheet, every page at full size.
    function printPack(pages, look, B, d, P) {
      var old = $('pack-print'); if (old) old.remove();
      var pr = h('div'); pr.id = 'pack-print';
      pr.innerHTML = pages.map(function (pg) { return '<div class="pk-print-page">' + DP.pageHTML(pg, look, B, d, P) + '</div>'; }).join('');
      document.body.appendChild(pr);
      var title = document.title; document.title = (B.company ? B.company + ' · ' : '') + d.title;
      var done = function () { document.title = title; var x = $('pack-print'); if (x) x.remove(); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      setTimeout(function () { window.print(); }, 60);
    }

    // ---- templates: Settings → Deal pack, and the builder's Change › ----
    function openTemplates(inBuilder) {
      X.openSheet(function (sheet) {
        X.sheetHead(sheet, 'Deal pack', 'Done');
        sheet.appendChild(h('p', 'bs-intro', 'Templates hold the look, the sections, hiding the address, your fee and terms. Your branding goes on all of them.'));
        var draw = function () {
          list.innerHTML = '';
          var T = tpls(), p = pack();
          if (!T.list.length) list.appendChild(h('p', 'pk-card-sub', 'No templates yet.'));
          T.list.forEach(function (t) {
            var r = h('div', 'pk-trow'), use = btn('pk-trow-main', null, inBuilder ? function () { Object.assign(p, cfgOf(t), { tid: t.id }); savePack(p); X.closeSettings(); X.redraw(); } : null);
            if (!inBuilder) use.disabled = true;
            var tx = h('span', 'pk-ltxt'); tx.appendChild(h('b', '', t.name + (inBuilder && p && p.tid === t.id ? ' · in use' : '')));
            tx.appendChild(h('small', '', DP.sectionsOn(t).length + ' sections · ' + (t.hide ? 'address hidden' : 'address shown') + ' · ' + DP.LOOK_LIST.filter(function (l) { return l[0] === t.look; })[0][1])); use.appendChild(tx); r.appendChild(use);
            var def = btn('pk-def' + (T.def === t.id ? ' on' : ''), T.def === t.id ? 'Default' : 'Make default', function () { var T2 = tpls(); T2.def = t.id; store(TPLS, T2); draw(); });
            def.setAttribute('aria-pressed', T.def === t.id); r.appendChild(def);
            var del = btn('pk-del', '×', function () {
              if (!confirm('Delete the template “' + t.name + '”? Packs you have made keep their settings.')) return;
              var T2 = tpls(); T2.list = T2.list.filter(function (x) { return x.id !== t.id; }); if (T2.def === t.id) T2.def = T2.list[0] ? T2.list[0].id : null; store(TPLS, T2); draw();
            });
            del.setAttribute('aria-label', 'Delete ' + t.name); r.appendChild(del); list.appendChild(r);
          });
          var cur = inBuilder && p && tplById(p.tid);
          if (cur) list.appendChild(btn('pk-wide', 'Save this pack’s choices to “' + cur.name + '”', function () {
            var T2 = tpls(); T2.list = T2.list.map(function (x) { return x.id === cur.id ? Object.assign({}, x, cfgOf(p)) : x; }); store(TPLS, T2); this.textContent = '✓ Saved to “' + cur.name + '”';
          }));
        };
        var list = h('div', 'st9-card pk-tlist'); sheet.appendChild(list); draw();
        sheet.appendChild(btn('pk-wide main', '+ New template', function () { X.closeSettings(); openSetup(inBuilder); }));
        sheet.appendChild(btn('pk-wide', 'Branding: logo, colour, contact details', function () { X.closeSettings(); S = null; location.hash = '#pack-brand'; }));
      });
    }

    return {
      start: start, openSetup: openSetup, openTemplates: openTemplates, hasTemplates: function () { return tpls().list.length > 0; }, pro: pro,
      render: function (view, box) { if (view === 'packsetup') renderSetup(box, false); else if (view === 'packbrand') renderSetup(box, true); else if (view === 'packprev') renderPreview(box); else renderBuilder(box); }
    };
  };
})(this);

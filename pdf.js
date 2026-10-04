// Builds the comparison PDF by hand (no libraries, so it works offline and adds nothing to download).
// Pure: takes plain data, returns bytes. Standard Helvetica, A4 portrait, WinAnsi text (so £ works).
(function (root) {
  var W = 595, H = 842, M = 40;

  // Text in the PDF is single-byte. Anything outside Latin-1 is replaced rather than corrupting the file.
  function clean(s) {
    s = String(s == null ? '' : s).replace(/∞ \(no cash left in\)/g, 'No cash left in').replace(/∞/g, 'No cash left in').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
    return s.replace(/[^\x20-\x7e\xa3]/g, '?');
  }
  function esc(s) { return clean(s).replace(/([\\()])/g, '\\$1'); }
  function num(v) { return (Math.round(v * 100) / 100).toString(); }

  function Doc() {
    this.pages = [[]]; this.y = H - M;
  }
  Doc.prototype.page = function () { return this.pages[this.pages.length - 1]; };
  Doc.prototype.newPage = function () { this.pages.push([]); this.y = H - M; };
  Doc.prototype.ensure = function (h) { if (this.y - h < M + 24) this.newPage(); };
  // colour: true = grey; 'good' = green; 'bad' = red; anything else = black
  var COLOURS = { good: '0.08 0.5 0.2 rg', bad: '0.75 0.1 0.1 rg' };
  Doc.prototype.text = function (x, y, str, size, bold, colour) {
    this.page().push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + (COLOURS[colour] || (colour === true ? '0.4 g' : '0 g')) + ' ' + num(x) + ' ' + num(y) + ' Td (' + esc(str) + ') Tj ET');
  };
  Doc.prototype.rule = function (y, grey) { this.page().push((grey || 0.75) + ' G 0.5 w ' + M + ' ' + num(y) + ' m ' + (W - M) + ' ' + num(y) + ' l S'); };
  Doc.prototype.fill = function (x, y, w, h, g) { this.page().push(g + ' g ' + num(x) + ' ' + num(y) + ' ' + num(w) + ' ' + num(h) + ' re f'); };

  // Serialise. Every character in the file is one byte, so offsets are just string lengths.
  Doc.prototype.bytes = function () {
    var self = this, objs = [], n = self.pages.length;
    // 1 catalog, 2 pages, 3 F1, 4 F2, then per page: page object and content stream
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    var kids = []; for (var i = 0; i < n; i++) kids.push((5 + i * 2) + ' 0 R');
    objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    self.pages.forEach(function (ops, i) {
      var footer = 'BT /F1 8 Tf 0.5 g ' + M + ' ' + (M - 4) + ' Td (' + esc('Page ' + (i + 1) + ' of ' + n) + ') Tj ET';
      var content = ops.join('\n') + '\n' + footer;
      objs[5 + i * 2] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (6 + i * 2) + ' 0 R >>';
      objs[6 + i * 2] = '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream';
    });
    var out = '%PDF-1.4\n', offsets = [];
    for (var k = 1; k < objs.length; k++) { offsets[k] = out.length; out += k + ' 0 obj\n' + objs[k] + '\nendobj\n'; }
    var xref = out.length;
    out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
    for (var j = 1; j < objs.length; j++) out += ('0000000000' + offsets[j]).slice(-10) + ' 00000 n \n';
    out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    var bytes = new Uint8Array(out.length);
    for (var b = 0; b < out.length; b++) bytes[b] = out.charCodeAt(b) & 255;
    return bytes;
  };

  // input: { title, date, details:[[label,value],...], rows:[{name,roi,monthly,annual,moneyIn,extra,refinance}], flip:{...}, sortLabel }
  // Every value arrives already formatted as text, so the PDF says exactly what the screen says.
  function build(d) {
    var doc = new Doc();
    doc.text(M, doc.y - 14, d.title, 20, true); doc.y -= 24;
    doc.text(M, doc.y - 10, d.date + '   |   Ranked by ' + d.sortLabel, 9, false, true); doc.y -= 18;
    // A client report names who it is for and from; a plain export carries neither.
    if (d.preparedFor || d.preparedBy) {
      var bits = [];
      if (d.preparedFor) bits.push('Prepared for ' + d.preparedFor);
      if (d.preparedBy) bits.push('Prepared by ' + d.preparedBy);
      doc.text(M, doc.y - 10, bits.join('   |   '), 9, false, true); doc.y -= 4;
    }
    doc.y -= 4;

    // details is null for a comparison of saved deals: each deal carries its own details, so there is no single "your deal" block
    if (d.details) doc.text(M, doc.y - 10, 'YOUR DEAL', 9, true, true);
    if (d.details) doc.y -= 16;
    if (d.details && !d.details.length) {
      doc.text(M, doc.y - 10, 'No details entered. Every figure below uses the examples from the spreadsheets.', 9); doc.y -= 16;
    } else if (d.details) {
      var colW = (W - 2 * M) / 2;
      for (var i = 0; i < d.details.length; i += 2) {
        doc.ensure(14);
        for (var c = 0; c < 2; c++) {
          var it = d.details[i + c]; if (!it) continue;
          var x = M + c * colW; doc.text(x, doc.y - 10, it[0], 9, false, true); doc.text(x + 165, doc.y - 10, it[1], 9, true);
        }
        doc.y -= 14;
      }
      doc.text(M, doc.y - 10, 'Anything not listed uses the example figures from the spreadsheets.', 8, false, true); doc.y -= 18;
    }

    // table
    var X = [M, M + 20, M + 118, M + 198, M + 268, M + 340, M + 412];
    var head = ['#', d.nameHeading || 'Strategy', 'ROI', 'Monthly', 'Annual', 'Money in', 'Left in / breakeven'];
    doc.ensure(40); doc.text(M, doc.y - 10, d.tableTitle || 'STRATEGIES', 9, true, true); doc.y -= 16;
    function headerRow() {
      head.forEach(function (t, k) { doc.text(X[k], doc.y - 10, t, 8, true, true); }); doc.y -= 14; doc.rule(doc.y + 2);
    }
    headerRow();
    d.rows.forEach(function (r, i) {
      var rowH = r.sub ? 30 : 22;                                   // a second small line (which calculator) needs more room
      if (doc.y - rowH - 2 < M + 24) { doc.newPage(); headerRow(); }
      if (i === 0) doc.fill(M - 4, doc.y - rowH + 2, W - 2 * M + 8, rowH, 0.93);
      var cells = [String(i + 1), fit(r.name, 17) + (r.refinance ? ' *' : ''), r.roi, r.monthly, r.annual, r.moneyIn, r.extra];
      cells.forEach(function (t, k) { doc.text(X[k], doc.y - 13, t, 9, k === 2 || k === 1); });
      if (r.sub) doc.text(X[1], doc.y - 24, fit(r.sub, 26), 7, false, true);
      doc.y -= rowH; doc.rule(doc.y + 2, 0.88);
    });
    var anyRefi = d.rows.some(function (r) { return r.refinance; });
    doc.ensure(20);
    doc.text(M, doc.y - 10, (anyRefi ? '* ROI is on the cash left in after refinancing. ' : '') + 'Others are on the money put in. ROI and profits are per year.', 8, false, true); doc.y -= 26;

    // flip (only in the single-deal comparison)
    if (d.flip) {
      doc.ensure(70); doc.text(M, doc.y - 10, 'IF YOU FLIP INSTEAD (ONE-OFF, NOT PER YEAR)', 9, true, true); doc.y -= 18;
      [['Profit', d.flip.profit], ['Net profit (of end value)', d.flip.margin, d.flip.marginVerdict], ['Return on money in', d.flip.roi], ['Money in', d.flip.moneyIn]].forEach(function (p) {
        doc.ensure(14); doc.text(M, doc.y - 10, p[0], 9, false, true); doc.text(M + 150, doc.y - 10, p[1], 9, true, p[2]); doc.y -= 14;
      });
      doc.y -= 10;
    }
    doc.ensure(24);
    doc.text(M, doc.y - 10, d.note || 'Estimates from the figures entered and the assumptions in your spreadsheets. Check them before relying on them.', 8, false, true);
    return doc.bytes();
  }
  // Keep long names inside their column (the PDF has no text-wrapping).
  function fit(s, max) { s = clean(s); return s.length > max ? s.slice(0, max - 2) + '..' : s; }

  var api = { build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Pdf = api;
})(this);

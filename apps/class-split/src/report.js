// 市教委への報告書（簡易報告書・様式Ⅰ・様式Ⅱ）を作る計算。画面（コピペ用の表）とサーバー（Excelの書き換え）が同じものを使う。
// 事案の report の形：{ light, found, modes:[10], other, s1:{ hk, kk, sd }, s2:{ sd, vi, ha, kikan } }
//   hk・kk・sd・vi・ha は記録の行の並び [{ d:'YYYY-MM-DD', p:'時間帯', t:'本文' }]
(function (g) {
  'use strict';
  var C = g.CONFIG;
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  var SECTIONS = { hk: '発覚', kk: '経緯', sd: '指導' };
  var SECTIONS2 = { sd: '指導の経過', vi: '被害児童・保護者の様子', ha: '加害児童・保護者の様子' };

  function emptyReport() {
    return { light: false, found: '', modes: C.MODES.map(function () { return false; }), other: '', s1: { hk: [], kk: [], sd: [] }, s2: { sd: [], vi: [], ha: [], kikan: '' } };
  }
  function norm(r) {
    var e = emptyReport(); r = r || {};
    var rows = function (a) { return (a || []).filter(function (x) { return x && String(x.t || '').trim(); }).map(function (x) { return { d: String(x.d || ''), p: String(x.p || ''), t: String(x.t || '') }; }); };
    e.light = !!r.light; e.found = String(r.found || ''); e.other = String(r.other || '');
    e.modes = C.MODES.map(function (m, i) { return !!(r.modes && r.modes[i]); });
    ['hk', 'kk', 'sd'].forEach(function (k) { e.s1[k] = rows(r.s1 && r.s1[k]); });
    ['sd', 'vi', 'ha'].forEach(function (k) { e.s2[k] = rows(r.s2 && r.s2[k]); });
    e.s2.kikan = String(r.s2 && r.s2.kikan || '');
    return e;
  }
  function dateParts(iso) {
    var p = String(iso || '').split('-'), y = +p[0], m = +p[1], d = +p[2];
    if (!y || !m || !d) return null;
    return { y: y, m: m, d: d, w: WD[new Date(y, m - 1, d).getDay()] };
  }
  function md(iso) { var x = dateParts(iso); return x ? x.m + '月' + x.d + '日（' + x.w + '）' : ''; }
  // 記録の行を時系列の箇条書きにする（日付・時間帯の順。同じなら入力した順）
  function lines(rows) {
    var slot = function (p) { var i = C.TIME_SLOTS.indexOf(p); return i < 0 ? 99 : i; };
    return rows.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
      return (a.x.d || '9999') < (b.x.d || '9999') ? -1 : (a.x.d || '9999') > (b.x.d || '9999') ? 1 : slot(a.x.p) - slot(b.x.p) || a.i - b.i;
    }).map(function (o) {
      var head = [md(o.x.d), o.x.p].filter(Boolean).join(' ');
      return '・' + (head ? head + '　' : '') + o.x.t.replace(/\s+$/, '');
    }).join('\n');
  }
  function colRow(ref) { var m = /^([A-Z]+)(\d+)$/.exec(ref); return m ? { c: m[1], r: +m[2] } : null; }

  // その様式に書く値：{ 'B4': '高木北小', ... }
  // kid(id) → { grade, cls(1から), male, name, kana }。victim は被害の児童の id、harms は加害の児童の id の並び
  function cells(kind, inc, o) {
    var R = C.REPORT, H = R.head, rep = norm(inc.report), out = {};
    var put = function (ref, v) { if (v !== '' && v != null) out[ref] = v; };
    put(H.school, o.school || '');
    var dp = dateParts(inc.date);
    if (dp) { var era = dp.y - 2018; put(H.era, era === 1 ? '元' : era); put(H.month, dp.m); put(H.day, dp.d); put(H.wday, '(' + dp.w + ')'); }
    var kidRow = function (row, id) {
      var k = o.kid(id); if (!k) return;
      put('B' + row, k.grade); put('D' + row, k.cls); put('G' + row, k.male ? '男' : '女'); put('I' + row, k.kana || ''); put('I' + (row + 1), k.name);
    };
    if (o.victim) kidRow(H.victim, o.victim);
    if (kind === 'f2') {
      put(R.f2.shido, lines(rep.s2.sd));
      if (rep.s2.vi.length) put(R.f2.victim, '（被害児童生徒及び保護者）\n' + lines(rep.s2.vi));
      if (rep.s2.ha.length) put(R.f2.harm, '（加害児童生徒及び保護者）\n' + lines(rep.s2.ha));
      put(R.f2.kikan, rep.s2.kikan);
      return out;
    }
    var harms = o.harms || [];
    harms.slice(0, R.harmRows.length).forEach(function (id, i) { kidRow(R.harmRows[i], id); });
    var more = harms.slice(R.harmRows.length);
    if (more.length) {
      var m = more.filter(function (id) { var k = o.kid(id); return k && k.male; }).length;
      put(R.harmMore, '※その他に男子（　' + m + '　）名、女子（　' + (more.length - m) + '　）名　　　　全体計（　' + harms.length + '　）名');
    }
    put(R.found, rep.found);
    C.MODES.forEach(function (md0, i) { if (rep.modes[i]) put(md0.cell, '○'); });
    if (rep.modes[C.MODES.length - 1]) put(R.modeOther, rep.other);
    if (kind === 'f1') put(R.f1.gaiyou, lines([].concat(rep.s1.hk, rep.s1.kk, rep.s1.sd)));
    return out;
  }
  // 様式ごとに書いてよいセル（サーバーが受け取る値を確かめる）
  function allowedCells(kind) {
    var R = C.REPORT, H = R.head, a = [H.school, H.era, H.month, H.day, H.wday], row = function (r) { a.push('B' + r, 'D' + r, 'G' + r, 'I' + r, 'I' + (r + 1)); };
    row(H.victim);
    if (kind === 'f2') { a.push(R.f2.shido, R.f2.victim, R.f2.harm, R.f2.kikan); return a; }
    R.harmRows.forEach(row);
    a.push(R.harmMore, R.found, R.modeOther);
    C.MODES.forEach(function (m) { a.push(m.cell); });
    if (kind === 'f1') a.push(R.f1.gaiyou);
    return a;
  }

  // ===== xlsx のシートの XML に値を書く（罫線・結合・入力規則はそのまま） =====
  function xesc(s) { return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colNum(c) { var n = 0; for (var i = 0; i < c.length; i++) n = n * 26 + c.charCodeAt(i) - 64; return n; }
  function cellXml(ref, attrs, v) {
    attrs = (attrs || '').replace(/\s+t="[^"]*"/, '');
    if (typeof v === 'number') return '<c r="' + ref + '"' + attrs + '><v>' + v + '</v></c>';
    return '<c r="' + ref + '"' + attrs + ' t="inlineStr"><is><t xml:space="preserve">' + xesc(v) + '</t></is></c>';
  }
  function setCell(xml, ref, v) {
    var cr = colRow(ref); if (!cr) return xml;
    var re = new RegExp('<c r="' + ref + '"((?:\\s[^>]*?)?)(?:/>|>[\\s\\S]*?</c>)');
    if (re.test(xml)) return xml.replace(re, function (_, attrs) { return cellXml(ref, attrs, v); });
    var rowRe = new RegExp('<row r="' + cr.r + '"([^>]*?)(/>|>([\\s\\S]*?)</row>)');
    var nc = cellXml(ref, '', v);
    if (rowRe.test(xml)) {
      return xml.replace(rowRe, function (_, attrs, end, body) {
        body = end === '/>' ? '' : body;
        var cells = body.match(/<c r="[A-Z]+\d+"[\s\S]*?(?:\/>|<\/c>)/g) || [], placed = false, outB = '';
        cells.forEach(function (c) {
          var r2 = /<c r="([A-Z]+)\d+"/.exec(c)[1];
          if (!placed && colNum(r2) > colNum(cr.c)) { outB += nc; placed = true; }
          outB += c;
        });
        if (!placed) outB += nc;
        return '<row r="' + cr.r + '"' + attrs + '>' + outB + '</row>';
      });
    }
    // 行が無い：番号の順に差し込む
    var rows = xml.match(/<row r="(\d+)"/g) || [], at = -1;
    for (var i = 0; i < rows.length; i++) { if (+/\d+/.exec(rows[i])[0] > cr.r) { at = xml.indexOf(rows[i]); break; } }
    var nr = '<row r="' + cr.r + '">' + nc + '</row>';
    if (at >= 0) return xml.slice(0, at) + nr + xml.slice(at);
    if (/<sheetData\s*\/>/.test(xml)) return xml.replace(/<sheetData\s*\/>/, '<sheetData>' + nr + '</sheetData>');
    return xml.replace('</sheetData>', nr + '</sheetData>');
  }
  function fillSheet(xml, values) {
    Object.keys(values).forEach(function (ref) { xml = setCell(xml, ref, values[ref]); });
    return xml;
  }
  // workbook.xml と その rels から、シート名 → シートのファイルの道筋
  function sheetPath(workbookXml, relsXml, name) {
    var m = new RegExp('<sheet\\b[^>]*name="' + xesc(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*/>').exec(workbookXml);
    if (!m) return '';
    var rid = /r:id="([^"]+)"/.exec(m[0]); if (!rid) return '';
    var rel = new RegExp('<Relationship\\b[^>]*Id="' + rid[1] + '"[^>]*/>').exec(relsXml); if (!rel) return '';
    var tgt = /Target="([^"]+)"/.exec(rel[0])[1];
    return tgt.charAt(0) === '/' ? tgt.slice(1) : 'xl/' + tgt;
  }
  // 開いた時にそのシートを出す
  function activate(workbookXml, name) {
    var names = (workbookXml.match(/<sheet\b[^>]*\/>/g) || []).map(function (s) { return (/name="([^"]*)"/.exec(s) || [])[1]; });
    var i = names.indexOf(xesc(name)); if (i < 0) return workbookXml;
    return workbookXml.replace(/<workbookView\b([^>]*?)\/>/, function (_, a) { a = a.replace(/\s+(activeTab|firstSheet)="\d+"/g, ''); return '<workbookView' + a + ' activeTab="' + i + '"/>'; });
  }
  function untab(sheetXml, on) { sheetXml = sheetXml.replace(/\s+tabSelected="\d"/g, ''); return on ? sheetXml.replace(/<sheetView\b/, '<sheetView tabSelected="1"') : sheetXml; }

  g.Report = { SECTIONS: SECTIONS, SECTIONS2: SECTIONS2, emptyReport: emptyReport, norm: norm, lines: lines, md: md, cells: cells, allowedCells: allowedCells,
    setCell: setCell, fillSheet: fillSheet, sheetPath: sheetPath, activate: activate, untab: untab };
})(typeof globalThis !== 'undefined' ? globalThis : this);

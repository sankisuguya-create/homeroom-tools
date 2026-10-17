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
    return { light: false, found: '', modes: C.MODES.map(function () { return false; }), other: '', s1: { hk: [], kk: [], sd: [] }, s2: { sd: [], vi: [], ha: [], kikan: '' }, s2v: {} };
  }
  function norm(r) {
    var e = emptyReport(); r = r || {};
    var rows = function (a) { return (a || []).filter(function (x) { return x && String(x.t || '').trim(); }).map(function (x) { return { d: String(x.d || ''), p: String(x.p || ''), t: String(x.t || '') }; }); };
    e.light = !!r.light; e.found = String(r.found || ''); e.other = String(r.other || '');
    e.modes = C.MODES.map(function (m, i) { return !!(r.modes && r.modes[i]); });
    ['hk', 'kk', 'sd'].forEach(function (k) { e.s1[k] = rows(r.s1 && r.s1[k]); });
    ['sd', 'vi', 'ha'].forEach(function (k) { e.s2[k] = rows(r.s2 && r.s2[k]); });
    e.s2.kikan = String(r.s2 && r.s2.kikan || '');
    // 被害の児童が複数の時：様式Ⅱの「被害児童・保護者の様子」は児童ごと（id → 行）
    Object.keys(r.s2v || {}).forEach(function (id) { var a = rows(r.s2v[id]); if (a.length) e.s2v[id] = a; });
    return e;
  }
  function dateParts(iso) {
    var p = String(iso || '').split('-'), y = +p[0], m = +p[1], d = +p[2];
    if (!y || !m || !d) return null;
    return { y: y, m: m, d: d, w: WD[new Date(y, m - 1, d).getDay()] };
  }
  function md(iso) { var x = dateParts(iso); return x ? x.m + '月' + x.d + '日（' + x.w + '）' : ''; }
  // 記録の行を「日付 時間帯、内容」にして改行でつなぐ（日付・時間帯の順。同じなら入力した順）
  // 選べる時間帯：設定の時程に、続いた2つの授業の間を「N校時後」として足す（例：1校時と2校時の間＝1校時後）
  function slots() {
    var b = C.TIME_SLOTS, out = [];
    b.forEach(function (p, i) {
      out.push(p);
      var a = /^(\d+)校時$/.exec(p), n = b[i + 1] && /^(\d+)校時$/.exec(b[i + 1]);
      if (a && n) out.push(a[1] + '校時後');
    });
    return out;
  }
  // 次の行の既定：同じ日の次の時間帯。最後（放課後）の次は、次の登校日（土日を飛ばす）の最初の時間帯
  function addDays(d, n) {
    var x = String(d).split('-'), t = new Date(+x[0], +x[1] - 1, +x[2]);
    if (isNaN(t)) return d;
    t.setDate(t.getDate() + n);
    return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
  }
  // ===== 国民の祝日（内閣府の祝日法の決まりから計算する。2000年以降） =====
  // 固定の日・ハッピーマンデー・春分と秋分（近似式）・振替休日・国民の休日（祝日に挟まれた平日）
  function ymd(t) { return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); }
  function nthMonday(y, m, n) { var t = new Date(y, m - 1, 1), off = (8 - t.getDay()) % 7; return 1 + off + (n - 1) * 7; }
  var HOL = {};
  function baseHolidays(y) {
    var h = {}, add = function (m, d) { h[ymd(new Date(y, m - 1, d))] = 1; };
    add(1, 1); add(1, nthMonday(y, 1, 2)); add(2, 11); if (y >= 2020) add(2, 23);
    add(3, Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4)));
    add(4, 29); add(5, 3); add(5, 4); add(5, 5);
    if (y === 2020) add(7, 23); else if (y === 2021) add(7, 22); else add(7, nthMonday(y, 7, 3));
    if (y === 2020) add(7, 24); else if (y === 2021) add(7, 23); else if (y !== 2020 && y !== 2021) add(10, nthMonday(y, 10, 2));
    if (y === 2020) add(8, 10); else if (y === 2021) add(8, 8); else add(8, 11);
    add(9, nthMonday(y, 9, 3));
    add(9, Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4)));
    add(11, 3); add(11, 23);
    return h;
  }
  function holidaysOf(y) {
    if (HOL[y]) return HOL[y];
    var h = baseHolidays(y), out = {};
    Object.keys(h).forEach(function (k) { out[k] = 1; });
    // 振替休日：祝日が日曜なら、その後の最初の祝日でない日
    Object.keys(h).forEach(function (k) {
      var p = k.split('-'), t = new Date(+p[0], +p[1] - 1, +p[2]);
      if (t.getDay() !== 0) return;
      do { t.setDate(t.getDate() + 1); } while (out[ymd(t)]);
      out[ymd(t)] = 1;
    });
    // 国民の休日：前日と翌日が祝日の平日
    for (var t = new Date(y, 0, 2); t.getFullYear() === y; t.setDate(t.getDate() + 1)) {
      var a = new Date(t), b = new Date(t); a.setDate(a.getDate() - 1); b.setDate(b.getDate() + 1);
      if (!out[ymd(t)] && t.getDay() !== 0 && h[ymd(a)] && h[ymd(b)]) out[ymd(t)] = 1;
    }
    return (HOL[y] = out);
  }
  function isHoliday(iso) { var y = +String(iso).slice(0, 4); return !!(y && holidaysOf(y)[iso]); }
  function isOff(t) { return t.getDay() === 0 || t.getDay() === 6 || isHoliday(ymd(t)); }
  // 次の登校日（土日・祝日を飛ばす。夏休みなどの学校の休みは分からないので飛ばさない）
  function nextSchoolDay(d) {
    var x = String(d).split('-'), t = new Date(+x[0], +x[1] - 1, +x[2]);
    if (isNaN(t)) return d;
    do { t.setDate(t.getDate() + 1); } while (isOff(t));
    return ymd(t);
  }
  function nextSlot(d, p) {
    var L = slots(), i = L.indexOf(p);
    if (i < 0 || i < L.length - 1) return { d: d, p: i < 0 ? p : L[i + 1] };
    return { d: nextSchoolDay(d), p: L[0] };
  }
  function lines(rows) {
    var L = slots(), slot = function (p) { var i = L.indexOf(p); return i < 0 ? 99 : i; };
    return rows.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
      return (a.x.d || '9999') < (b.x.d || '9999') ? -1 : (a.x.d || '9999') > (b.x.d || '9999') ? 1 : slot(a.x.p) - slot(b.x.p) || a.i - b.i;
    }).reduce(function (acc, o) {
      // 同じ日の行は1行につなぎ、日付が変わったら改行する。日付は行の初めにだけ書く
      var t = tidy(o.x.t); if (!t) return acc;
      var last = acc[acc.length - 1], head = (o.x.p ? o.x.p + '、' : '');
      if (last && last.d === o.x.d) last.s += head + t;
      else acc.push({ d: o.x.d, s: md(o.x.d) + (head || (o.x.d ? '、' : '')) + t });
      return acc;
    }, []).map(function (g) { return g.s; }).join('\n');
  }
  // 文を整える：空の行と句点の後の空白を消し、終わりに句点が無ければ足す
  function tidy(t) {
    t = String(t || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).join('\n');
    t = t.replace(/。[ 　\t]+/g, '。');
    if (t && !/[。！？!?」）)]$/.test(t)) t += '。';
    return t;
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
      put('B' + row, k.grade); put('D' + row, k.cls); put('G' + row, k.male ? '男' : '女'); put('I' + row, k.kana || ''); put('I' + (row + 1), nospace(k.name));
    };
    if (o.victim) kidRow(H.victim, o.victim);
    if (kind === 'f2') {
      put(R.f2.shido, lines(rep.s2.sd));
      var vi = o.victim && rep.s2v[o.victim] ? rep.s2v[o.victim] : rep.s2.vi;
      if (vi.length) put(R.f2.victim, '（被害児童生徒及び保護者）\n' + lines(vi));
      if (rep.s2.ha.length) put(R.f2.harm, '（加害児童生徒及び保護者）\n' + lines(rep.s2.ha));
      put(R.f2.kikan, rep.s2.kikan);
      return withNames(out, [R.f2.shido, R.f2.victim, R.f2.harm, R.f2.kikan], o.people);
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
    // 発覚・経緯（内容）と指導は、欄ごとにまとめて改行で区切る
    if (kind === 'f1') put(R.f1.gaiyou, ['hk', 'kk', 'sd'].map(function (k) { return lines(rep.s1[k]); }).filter(Boolean).join('\n'));
    return withNames(out, [R.f1.gaiyou], o.people);
  }
  function nospace(n) { return String(n || '').replace(/[ 　]+/g, ''); }
  // 文の中の児童の名前：姓と名の間の空白を消し、書類の中で最初に出る所だけ学年と組を括弧で付ける
  // 関係する児童が全員同じ学年なら組だけ（例：田中ハト(2組)）、違えば学年も（例：田中ハト(6年2組)）
  function withNames(out, refs, people) {
    people = (people || []).filter(function (p) { return p && p.name; });
    if (!people.length) return out;
    var one = people.every(function (p) { return p.grade === people[0].grade; }), seen = {};
    var esc = function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
    // 長い名前から当てる（「田中ハト」と「田中ハトコ」のような重なりで短い方が先に当たらないように）
    var list = people.slice().sort(function (a, b) { return nospace(b.name).length - nospace(a.name).length; });
    refs.forEach(function (ref) {
      if (typeof out[ref] !== 'string') return;
      var t = out[ref];
      list.forEach(function (p) {
        var n = nospace(p.name), re = new RegExp(esc(n).split('').join('[ 　]?'), 'g');
        t = t.replace(re, function () {
          if (seen[n]) return n;
          seen[n] = 1;
          return n + '(' + (one ? '' : p.grade + '年') + p.cls + '組)';
        });
      });
      out[ref] = t;
    });
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
  function xesc(s) { return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\r?\n/g, '&#10;'); } // 改行は文字参照にする（そのままの改行を捨てる表計算ソフトがある）
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

  g.Report = { addDays: addDays, isHoliday: isHoliday, nextSchoolDay: nextSchoolDay, tidy: tidy, slots: slots, nextSlot: nextSlot, SECTIONS: SECTIONS, SECTIONS2: SECTIONS2, emptyReport: emptyReport, norm: norm, lines: lines, md: md, cells: cells, allowedCells: allowedCells,
    setCell: setCell, fillSheet: fillSheet, sheetPath: sheetPath, activate: activate, untab: untab };
})(typeof globalThis !== 'undefined' ? globalThis : this);

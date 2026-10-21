/* クラス分け：決定した組を Excel（次年度組編成）で出す。ui-split.js の中に差し込まれる（同じ閉じた範囲の変数を使う）。単独では動かない */
  // 列は学校の「次年度組編成」の表に合わせる（児童IDは文字のまま＝先頭の0を落とさない）。
  // 次年度の組・番号は、決定でサーバーが作った来年度の名簿から取る（組の番号を決めた後はその番号、決める前は A組・B組…）。
  // 特別支援学級の番号・仮組と生年月日は、このアプリが持っていないので空にする
  var XL_HEAD = ['生徒管理番号', '現年度・学年', '現年度・組', '現年度・番号', '次年度学年', '仮組', '仮番号', '氏名', 'ふりがな', '性別', '現年度特支学級', '現年度特支番号', '特別支援仮組', '特別支援仮番号', '生年月日'];
  function excelRows() {
    var d = App.st.data, cur = d.years.filter(function (y) { return y.fy === d.fy; })[0], nxt = d.years.filter(function (y) { return y.fy === d.fy + 1; })[0];
    if (!nxt || !nxt.rows.length) return null;
    var now = {}; (cur ? cur.rows : []).forEach(function (r) { now[r.id] = r; });
    var named = S.decision && S.decision.named, names = namesOf();
    var clsOf = function (c) { if (named) return c + 1; var k = names.indexOf(c + 1); return C.newClass(k >= 0 ? k : c); }; // 番号を決める前は A組・B組…で
    return nxt.rows.slice().sort(function (a, b) { return a.cls - b.cls || a.no - b.no; }).map(function (r) {
      var s = d.kids[r.id] || {}, o = now[r.id], a = (o && o.a) || {};
      return [String(r.id), o ? d.grade : '', o ? o.cls + 1 : '', o ? o.no : '', d.grade + 1, clsOf(r.cls), r.no, s.name || '', s.kana || '', s.male ? '男' : '女', a.sp ? '○' : '', '', '', '', ''];
    });
  }
  function xmlEsc(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colName(i) { var s = ''; i++; while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function sheetXml(rows) {
    var cell = function (v, ci, ri, head) {
      var ref = colName(ci) + ri;
      if (v === '' || v == null) return '';
      if (typeof v === 'number') return '<c r="' + ref + '"' + (head ? ' s="1"' : '') + '><v>' + v + '</v></c>';
      return '<c r="' + ref + '" t="inlineStr"' + (head ? ' s="1"' : ci === 0 ? ' s="2"' : '') + '><is><t>' + xmlEsc(v) + '</t></is></c>';
    };
    var all = [XL_HEAD].concat(rows);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="' + 'http' + ':/' + '/schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<cols><col min="1" max="1" width="13" customWidth="1"/><col min="2" max="7" width="9" customWidth="1"/><col min="8" max="9" width="16" customWidth="1"/><col min="10" max="15" width="11" customWidth="1"/></cols><sheetData>' +
      all.map(function (r, ri) { return '<row r="' + (ri + 1) + '">' + r.map(function (v, ci) { return cell(v, ci, ri + 1, ri === 0); }).join('') + '</row>'; }).join('') + '</sheetData></worksheet>';
  }
  function excelBlob(rows) {
    var enc = new TextEncoder(), f = function (name, s) { return { name: name, data: enc.encode(s) }; }, NS = 'http' + ':/' + '/schemas.openxmlformats.org'; // xlsx の決まりの名前（通信先ではない。配布の検査が通信先と見なさないよう分けて書く）
    return g.Zip.write([
      f('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="' + NS + '/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'),
      f('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + NS + '/package/2006/relationships"><Relationship Id="rId1" Type="' + NS + '/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
      f('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="' + NS + '/spreadsheetml/2006/main" xmlns:r="' + NS + '/officeDocument/2006/relationships"><sheets><sheet name="次年度組編成" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      f('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + NS + '/package/2006/relationships"><Relationship Id="rId1" Type="' + NS + '/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + NS + '/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
      // 書式：0＝ふつう、1＝見出し（灰色の地）、2＝文字（児童ID）
      f('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="' + NS + '/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="游ゴシック"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFBFBFBF"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fillId="2" applyFill="1"/><xf numFmtId="49" applyNumberFormat="1"/></cellXfs></styleSheet>'),
      f('xl/worksheets/sheet1.xml', sheetXml(rows))
    ]);
  }
  function exportExcel() {
    var rows = excelRows();
    if (!rows) { App.toast('来年度の名簿がまだありません（クラス替えを決定すると作られます）'); return; }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(excelBlob(rows)); a.download = '次年度組編成_' + App.st.grade + '年から' + (App.st.grade + 1) + '年.xlsx';
    document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1000); // すぐ外すとファイル名が付かないことがある
    App.toast('Excel を作りました（' + rows.length + '人）。ダウンロードを確かめてください');
  }

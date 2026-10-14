// 名簿の貼り付けを読む（画面に依存しない。tests/paste.test.mjs が直接読む）。
// スプレッドシートからのコピーはタブ区切り。見出しの行があれば名前で列を決め、無ければ値の形から推定する。
(function (g) {
  'use strict';
  // 見出しの言い換え（小文字・空白なしで比べる）
  var NAMES = {
    id: ['児童id', 'id', '児童番号', '学籍番号', 'アカウント', 'メール', 'メールアドレス', 'email'],
    name: ['名前', '氏名', '児童名', 'なまえ'],
    kana: ['よみ', '読み', 'ふりがな', 'フリガナ', 'かな', 'カナ', 'よみがな', 'ヨミ'],
    sex: ['性別', '男女'],
    cls: ['組', 'クラス', '学級'],
    no: ['出席番号', '番号', '番', 'no']
  };
  var LABEL = { id: '児童ID', name: '名前', kana: 'よみ', sex: '性別', cls: '組', no: '番号' };
  function norm(h) { return String(h).replace(/[\s　]/g, '').toLowerCase(); }
  function roleOfHeader(h) {
    var n = norm(h);
    for (var r in NAMES) if (NAMES[r].some(function (x) { return norm(x) === n; })) return r;
    return null;
  }
  function toHalf(s) { return String(s).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).trim(); }
  function idOf(v) { var m = toHalf(v).match(/^(\d{8})(@|$)/); return m ? m[1] : ''; }
  function sexOf(v) { var s = String(v).trim(); return /^(男|男子|M|m)$/.test(s) ? '男' : /^(女|女子|F|f)$/.test(s) ? '女' : ''; }
  function isKana(v) { return /^[ぁ-んァ-ヶー\s　・]+$/.test(String(v).trim()) && String(v).trim() !== ''; }
  function isSmallInt(v) { var s = toHalf(v); return /^\d{1,2}$/.test(s) && +s >= 1 && +s <= 45; }
  function clsOf(v) { var s = toHalf(v).replace(/組$/, ''); return /^[1-9]$/.test(s) ? +s : 0; }

  function splitRows(text) {
    return String(text).replace(/\r/g, '').split('\n').map(function (l) { return l.split('\t'); })
      .filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }

  // 値の形から列の役割を推定する（見出しが無い時）
  function guess(rows) {
    var w = Math.max.apply(null, rows.map(function (r) { return r.length; })), roles = [], used = {};
    var score = function (c, f) { var n = 0; rows.forEach(function (r) { if (f(r[c] || '')) n++; }); return n / rows.length; };
    for (var c = 0; c < w; c++) {
      var r = null;
      if (!used.id && score(c, function (v) { return !!idOf(v); }) > .8) r = 'id';
      else if (!used.sex && score(c, function (v) { return !!sexOf(v); }) > .8) r = 'sex';
      else if (!used.kana && score(c, isKana) > .8) r = 'kana';
      else if (score(c, isSmallInt) > .8) r = !used.no ? 'no' : null;
      else if (!used.name && score(c, function (v) { return String(v).trim() !== ''; }) > .8) r = 'name';
      if (r) used[r] = 1;
      roles.push(r);
    }
    // 小さな数の列が2つあれば、1〜9だけの列を組、残りを番号とする
    var small = [];
    for (c = 0; c < w; c++) if (score(c, isSmallInt) > .8) small.push(c);
    if (small.length >= 2) {
      var ci = small.filter(function (c) { return score(c, function (v) { return clsOf(v) > 0; }) === 1; })[0];
      if (ci != null) { roles[ci] = 'cls'; roles[small.filter(function (c) { return c !== ci; })[0]] = 'no'; }
    }
    return roles;
  }

  // 戻り値：{ roles: 列ごとの役割, header: 見出しの行があったか, rows: [{id,name,kana,male,cls,no}], errors: [文], counts: {男,女} }
  // cls は 0始まり。組の列が無い時は defaultCls を使う
  function parseRoster(text, defaultCls) {
    var all = splitRows(text);
    if (!all.length) return { roles: [], header: false, rows: [], errors: [], counts: { m: 0, f: 0 } };
    var headRoles = all[0].map(roleOfHeader), header = headRoles.filter(Boolean).length >= 2;
    var body = header ? all.slice(1) : all, roles = header ? headRoles : guess(body);
    var col = {};
    roles.forEach(function (r, c) { if (r && col[r] == null) col[r] = c; });
    var errors = [], rows = [], seen = {}, m = 0, f = 0;
    ['id', 'name'].forEach(function (r) { if (col[r] == null) errors.push(LABEL[r] + 'の列が見つかりません'); });
    if (errors.length) return { roles: roles, header: header, rows: [], errors: errors, counts: { m: 0, f: 0 } };
    body.forEach(function (r, i) {
      var line = (header ? i + 2 : i + 1) + '行目：';
      var id = idOf(r[col.id] || ''), name = String(r[col.name] || '').trim();
      var sex = col.sex != null ? sexOf(r[col.sex] || '') : '';
      var cls = col.cls != null ? clsOf(r[col.cls] || '') - 1 : defaultCls;
      var no = col.no != null ? +toHalf(r[col.no] || '') : 0;
      if (!id) { errors.push(line + '児童IDが8桁の数字ではありません'); return; }
      if (seen[id]) { errors.push(line + '児童ID ' + id + ' が重複しています'); return; }
      if (!name) { errors.push(line + '名前が空です'); return; }
      if (col.sex != null && !sex) errors.push(line + '性別が読めません（男／女）');
      if (!(cls >= 0)) { errors.push(line + '組が読めません'); return; }
      seen[id] = 1;
      if (sex === '男') m++; else if (sex === '女') f++;
      rows.push({ id: id, name: name, kana: col.kana != null ? String(r[col.kana] || '').trim() : '', male: sex === '男', sex: sex, cls: cls, no: no || 0 });
    });
    // 番号が無ければ貼った順に振る
    if (col.no == null) { var byCls = {}; rows.forEach(function (x) { x.no = (byCls[x.cls] = (byCls[x.cls] || 0) + 1); }); }
    return { roles: roles, header: header, rows: rows, errors: errors, counts: { m: m, f: f } };
  }

  g.Paste = { parseRoster: parseRoster, LABEL: LABEL };
})(typeof globalThis !== 'undefined' ? globalThis : this);

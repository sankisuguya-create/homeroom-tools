// 名簿の貼り付けを読む（画面に依存しない。tests/paste.test.mjs が直接読む）。
// スプレッドシートからのコピーはタブ区切り。見出しの行があれば名前で列を決め、無ければ値の形から推定する。
(function (g) {
  'use strict';
  // 見出しの言い換え（小文字・空白なしで比べる）
  var NAMES = {
    id: ['児童id', 'id', '児童番号', '学籍番号', 'アカウント', 'メール', 'メールアドレス', 'email', '生徒コード'],
    name: ['名前', '氏名', '児童名', 'なまえ'],
    kana: ['よみ', '読み', 'ふりがな', 'フリガナ', 'かな', 'カナ', 'よみがな', 'ヨミ'],
    sex: ['性別', '男女'],
    cls: ['組', 'クラス', '学級'],
    no: ['出席番号', '番号', '番', 'no'],
    id2: ['生徒管理コード'], // 児童IDの列が空の時に代わりに使う（校務システムの書き出し）
    grade: ['学年'],
    // 校務システムの書き出し：名前の列が空の時に組み立てる部品（姓＋名、正式名前、正式姓＋正式名）
    sei: ['姓'], mei: ['名'], seiK: ['姓ふりがな'], meiK: ['名ふりがな'],
    // 住所：校務システムは4列（都道府県・市区町村・町番地・アパート/マンション名）。ほかの名簿は「住所」1列
    addr: ['住所'], pref: ['都道府県'], city: ['市区町村'], town: ['町番地', '町名番地', '町名'], apt: ['アパート/マンション名', 'アパート・マンション名', '建物名'],
    fname: ['正式名前'], fkana: ['正式名前ふりがな'], fsei: ['正式姓'], fmei: ['正式名'], fseiK: ['正式姓ふりがな'], fmeiK: ['正式名ふりがな']
  };
  var LABEL = { id: '児童ID', id2: '児童ID', name: '名前', kana: 'よみ', sex: '性別', cls: '組', no: '番号', grade: '学年', addr: '住所', pref: '都道府県', city: '市区町村', town: '町番地', apt: '建物名',
    sei: '姓', mei: '名', seiK: '姓よみ', meiK: '名よみ', fname: '正式名前', fkana: '正式よみ', fsei: '正式姓', fmei: '正式名', fseiK: '正式姓よみ', fmeiK: '正式名よみ' };
  // 名前・よみとして使える列（どれか1つでもあればよい）
  var NAME_ROLES = ['name', 'sei', 'fname', 'fsei'];
  function norm(h) { return String(h).replace(/[\s　]/g, '').toLowerCase(); }
  function roleOfHeader(h) {
    var n = norm(h);
    for (var r in NAMES) if (NAMES[r].some(function (x) { return norm(x) === n; })) return r;
    return null;
  }
  function toHalf(s) { return String(s).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).trim(); }
  // 児童ID：英数字（と - _）20文字まで。メールアドレスなら @ の前を使う
  function idOf(v) { var s = toHalf(v).replace(/[Ａ-Ｚａ-ｚ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).split('@')[0]; return /^[A-Za-z0-9_-]{1,20}$/.test(s) ? s : ''; }
  function sexOf(v) { var s = String(v).trim(); return /^(男|男子|M|m)$/.test(s) ? '男' : /^(女|女子|F|f)$/.test(s) ? '女' : ''; }
  function isKana(v) { return /^[ぁ-んァ-ヶー\s　・]+$/.test(String(v).trim()) && String(v).trim() !== ''; }
  function isSmallInt(v) { var s = toHalf(v); return /^\d{1,2}$/.test(s) && +s >= 1 && +s <= 45; }
  function clsOf(v) { var s = toHalf(v).replace(/組$/, ''); return /^[1-9]$/.test(s) ? +s : 0; }

  // タブ区切りを読む。Excel はセルの中に改行・タブ・" があると "…" で囲み、" を "" にして書き出すので、それを戻す
  function splitRows(text) {
    var t = String(text).replace(/\r\n?/g, '\n'), rows = [], row = [], cell = '', i = 0, q = false, start = true;
    for (; i < t.length; i++) {
      var ch = t[i];
      if (q) {
        if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
        continue;
      }
      if (ch === '"' && start) { q = true; start = false; continue; }
      if (ch === '\t') { row.push(cell); cell = ''; start = true; continue; }
      if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; start = true; continue; }
      cell += ch; start = false;
    }
    row.push(cell); rows.push(row);
    return rows.map(function (r) { return r.map(function (c) { return c.replace(/\n/g, ' '); }); }) // セル内の改行は空白に
      .filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }

  // 値の形から列の役割を推定する（見出しが無い時）
  function guess(rows) {
    var w = Math.max.apply(null, rows.map(function (r) { return r.length; })), roles = [], used = {};
    var score = function (c, f) { var n = 0; rows.forEach(function (r) { if (f(r[c] || '')) n++; }); return n / rows.length; };
    for (var c = 0; c < w; c++) {
      var r = null;
      if (!used.id && score(c, function (v) { var x = idOf(v); return x.length >= 5 && /\d/.test(x); }) > .8) r = 'id'; // 見出しが無い時は、5文字以上で数字を含む列だけを児童IDとみなす（出席番号と取り違えない）
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

  // 町名：町番地の先頭から、数字・丁目・番地の手前まで（例「中央三丁目5-2」→「中央」）。地区の偏りをそろえるのに使う
  function areaOf(town) {
    return toHalf(town).replace(/[\s　]/g, '').replace(/[0-9０-９].*$/, '').replace(/[一二三四五六七八九十〇]+丁目.*$/, '').replace(/[-－ー‐丁目番地号の]+$/, '').slice(0, 20);
  }
  function gradeOf(v) { var s = toHalf(v).replace(/年(生)?$/, ''); return /^[1-6]$/.test(s) ? +s : null; }

  // 戻り値：{ roles: 列ごとの役割, header: 見出しの行があったか, rows: [{id,name,kana,male,cls,no,sp}], errors: [文], counts: {男,女},
  //          skipped: { grade: ほかの学年で読み飛ばした行, blank: 名前が空で読み飛ばした行 }, sp: 特別支援学級の児童の数 }
  // cls は 0始まり。組の列が無い・空の時は defaultCls を使う。組の列が数字でない文字の児童は特別支援学級（sp に学級名、cls は -1＝交流級は未定）
  // opt.tempId：新1年。児童IDの列が無い・空の行を許す（サーバーが仮のIDを振る）
  // opt.grade：学年の列がある時、この学年の行だけを読む（校務システムの全校の書き出しをそのまま貼れる）。新1年（0）は絞らない
  function parseRoster(text, defaultCls, opt) {
    opt = opt || {};
    var empty = { roles: [], header: false, rows: [], errors: [], counts: { m: 0, f: 0 }, skipped: { grade: 0, blank: 0 }, sp: 0 };
    var all = splitRows(text);
    if (!all.length) return empty;
    var headRoles = all[0].map(roleOfHeader), header = headRoles.filter(Boolean).length >= 2;
    var body = header ? all.slice(1) : all, roles = header ? headRoles : guess(body);
    var col = {};
    roles.forEach(function (r, c) { if (r && col[r] == null) col[r] = c; });
    var errors = [], rows = [], seen = {}, m = 0, f = 0, skipped = { grade: 0, blank: 0 }, nsp = 0;
    if (!opt.tempId && col.id == null && col.id2 == null) errors.push(LABEL.id + 'の列が見つかりません');
    if (!NAME_ROLES.some(function (r) { return col[r] != null; })) errors.push(LABEL.name + 'の列が見つかりません');
    if (errors.length) { empty.roles = roles; empty.header = header; empty.errors = errors; return empty; }
    var cell = function (r, k) { return col[k] != null ? String(r[col[k]] || '').trim() : ''; };
    var join = function (a, b) { return (a + ' ' + b).trim(); };
    var filterGrade = col.grade != null && opt.grade != null && +opt.grade > 0;
    body.forEach(function (r, i) {
      var line = (header ? i + 2 : i + 1) + '行目：';
      // 名前：名前 → 姓＋名 → 正式名前 → 正式姓＋正式名（空欄の多い表でも、埋まっている列を使う）
      var name = cell(r, 'name') || join(cell(r, 'sei'), cell(r, 'mei')) || cell(r, 'fname') || join(cell(r, 'fsei'), cell(r, 'fmei'));
      var kana = cell(r, 'kana') || join(cell(r, 'seiK'), cell(r, 'meiK')) || cell(r, 'fkana') || join(cell(r, 'fseiK'), cell(r, 'fmeiK'));
      if (filterGrade) { var gr = gradeOf(cell(r, 'grade')); if (gr !== +opt.grade) { skipped.grade++; return; } }
      if (!name) { skipped.blank++; return; } // 名前の無い行（空欄の行・集計の行など）は読み飛ばす
      var rawId = cell(r, 'id') || cell(r, 'id2');
      var id = idOf(rawId);
      var sex = col.sex != null ? sexOf(r[col.sex] || '') : '';
      var rawCls = cell(r, 'cls'), sp = '', cls;
      if (!rawCls) cls = defaultCls;
      else if (clsOf(rawCls) > 0) cls = clsOf(rawCls) - 1;
      else if (/^\d+$/.test(toHalf(rawCls))) { errors.push(line + '組が読めません（1〜9）'); return; }
      else { sp = rawCls.slice(0, 20); cls = -1; } // 数字でない組＝特別支援学級
      var no = col.no != null ? +toHalf(r[col.no] || '') : 0;
      if (!id && !(opt.tempId && !rawId)) { errors.push(line + '児童IDが読めません（' + (rawId ? '「' + rawId.slice(0, 24) + '」。英数字20文字まで' : '空欄') + '）'); return; }
      if (id && seen[id]) { errors.push(line + '児童ID ' + id + ' が重複しています'); return; }
      if (col.sex != null && !sex) errors.push(line + '性別が読めません（男／女）');
      if (id) seen[id] = 1;
      if (sex === '男') m++; else if (sex === '女') f++;
      if (sp) nsp++;
      var o = { id: id, name: name, kana: kana, male: sex === '男', sex: sex, cls: cls, no: no || 0 };
      if (sp) o.sp = sp;
      // 住所：「住所」1列か、都道府県＋市区町村＋町番地（＋建物名）。町名は町番地から
      var town = cell(r, 'town'), addr = cell(r, 'addr') || (cell(r, 'pref') + cell(r, 'city') + town + (cell(r, 'apt') ? ' ' + cell(r, 'apt') : '')).trim();
      if (addr) { o.addr = addr.slice(0, 200); o.area = areaOf(town); }
      rows.push(o);
    });
    // 番号が無ければ貼った順に振る
    if (col.no == null) { var byCls = {}; rows.forEach(function (x) { x.no = (byCls[x.cls] = (byCls[x.cls] || 0) + 1); }); }
    return { roles: roles, header: header, rows: rows, errors: errors, counts: { m: m, f: f }, skipped: skipped, sp: nsp };
  }

  g.Paste = { parseRoster: parseRoster, LABEL: LABEL };
})(typeof globalThis !== 'undefined' ? globalThis : this);

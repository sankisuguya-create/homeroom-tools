// サーバー（GAS）。scripts/build.py が config.js・engine.js の後ろにつなげて dist/gas/Code.gs を作る。
// 役目は「読み込み（学年ごとに1回）と保存」だけ。計算と描画はブラウザ側（docs/design.md §5）。
// コメントは GAS 上で消えることがあるので、意味を持たせない（principles/gas-javascript-notes.md §1）。

var SERVER_BUILD = '@@BUILD@@';
var DB_PROP = 'CLASS_SPLIT_DB_ID';

// ===== 画面 =====
function doGet() {
  var who = currentTeacher_();
  if (!who.ok) {
    return HtmlService.createHtmlOutput('<!doctype html><html lang="ja"><meta charset="utf-8"><body style="font-family:sans-serif;padding:24px">' +
      '<h1 style="font-size:20px">このページは教員のアカウントで開いてください</h1><p>' + escHtml_(who.email || '（アカウントが分かりません）') + ' では開けません。</p></body></html>')
      .setTitle('クラス替え');
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('クラス替え')
    .addMetaTag('viewport', 'width=device-width,initial-scale=1');
}

// ===== 利用者の確認 =====
// 「自分として実行」でも、同じドメインの利用者のメールは取れる。教員のドメイン以外（児童など）は拒否する
function currentTeacher_() {
  var email = '';
  try { email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (e) { email = ''; }
  // 教員は「…@edu.nishi.or.jp」ちょうど（サブドメインは不可）。児童のドメインと、数字8桁の名前は、どのドメインでも断る
  var at = email.lastIndexOf('@'), local = email.slice(0, at), domain = email.slice(at + 1);
  var student = domain === CONFIG.STUDENT_DOMAIN || /\.kyoiku\./.test('.' + domain) || /^\d{8}$/.test(local);
  var ok = at > 0 && domain === CONFIG.TEACHER_DOMAIN && !student;
  return { ok: ok, email: email };
}
function requireTeacher_() {
  var who = currentTeacher_();
  if (!who.ok) throw userError_('教員のアカウントで開いてください');
  return who.email;
}
// 再試行しても直らない誤り（画面は再試行せずに表示する）
function userError_(msg) { return new Error('USER:' + msg); }
function escHtml_(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

// ===== データの置き場 =====
// 専用のスプレッドシート。初回は setup() を所有者が実行して作る（教員には共有しない）
function setup() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(DB_PROP);
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('クラス替え（データ）');
  props.setProperty(DB_PROP, ss.getId());
  TABLES_.forEach(function (t) { sheet_(ss, t.name, t.head); });
  var fy = CONFIG.fiscalYear();
  sheet_(ss, 'roster_' + fy, ROSTER_HEAD);
  sheet_(ss, 'attrs_' + fy, attrsHead_());
  return ss.getUrl();
}
var ROSTER_HEAD = ['id8', 'name', 'kana', 'sex', 'grade', 'class', 'no'];
var TABLES_ = [
  { name: 'settings', head: ['key', 'json'] },
  { name: 'decisions', head: ['fy', 'grade', 'plan', 'by', 'at', 'undone', 'names'] }, // names：A組から順の組の番号（例 2,1,3）。空＝仮（A組＝1組…）
  { name: 'pairs_carry', head: ['fy', 'type', 'a', 'b', 'memo', 'tags', 'incs', 'since'] },
  // diagram：関係図（児童IDとグループの記号だけ。氏名は入れない）。role：関係図から決めた役割（harm・victim・mutual・related）
  { name: 'incidents', head: ['inc_id', 'date', 'type', 'url', 'file_id', 'title', 'by', 'at', 'deleted', 'diagram', 'date_end', 'detail', 'report'] },
  { name: 'incident_kids', head: ['inc_id', 'id8', 'role'] },
  { name: 'log', head: ['at', 'by', 'action', 'n'] },
  // 新年度の転入生：クラス分けに加え、決定で来年度の名簿に入れる。grade は今年度の学年（その学年のクラス分けに入る）
  { name: 'transfers', head: ['fy', 'grade', 'id8', 'name', 'kana', 'sex', 'by', 'at'] }
];
// side の項目（ア・身・通）は内容の文字も持つ（列名は k5_t など）
function attrsHead_() {
  var h = ['id8'].concat(CONFIG.ATTRS.map(function (at) { return at.k; }));
  CONFIG.ATTRS.forEach(function (at) { if (at.side || at.ctx) h.push(at.k + '_t'); if (at.ctx) h.push(at.k + '_i'); }); // _t＝内容・経緯の文、_i＝紐付けた事案の番号
  h.push('sp'); // 特別支援学級の児童（1＝在籍）。配慮項目ではなく、カードの地の色を変えるだけ
  h.push('memo'); // 備考（自由記述）。決定で来年度に写す
  return h;
}
// シートに書く文字：= + - @ で始まると式として読まれるので、先頭に ' を付けて文字のまま残す
function plainText_(s, max) { s = String(s == null ? '' : s).slice(0, max || 200); return /^[=+\-@]/.test(s) ? "'" + s : s; }

var SS_ = null;
function db_() {
  if (SS_) return SS_;
  var id = PropertiesService.getScriptProperties().getProperty(DB_PROP);
  if (!id) throw userError_('データの置き場がありません。所有者が setup を実行してください');
  SS_ = SpreadsheetApp.openById(id);
  return SS_;
}
function sheet_(ss, name, head) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (head) sh.getRange(1, 1, 1, head.length).setValues([head]);
  }
  return sh;
}
// 表を読む：見出しの名前で列を引く。無い表は空
function read_(name) {
  var sh = db_().getSheetByName(name);
  if (!sh) return { sh: null, head: [], rows: [] };
  var v = sh.getDataRange().getValues();
  if (!v.length) return { sh: sh, head: [], rows: [] };
  var head = v[0].map(String), rows = [];
  for (var r = 1; r < v.length; r++) {
    var o = { _r: r + 1 };
    for (var c = 0; c < head.length; c++) o[head[c]] = v[r][c];
    rows.push(o);
  }
  return { sh: sh, head: head, rows: rows };
}
// 項目を足した時、既存のシートの見出しに無い列を右端に足す（古いシートでも書けるように）
function ensureCols_(name, head) {
  var sh = sheet_(db_(), name, head);
  var w = Math.max(1, sh.getLastColumn()), cur = sh.getRange(1, 1, 1, w).getValues()[0].map(String);
  var miss = head.filter(function (h) { return cur.indexOf(h) < 0; });
  if (miss.length) sh.getRange(1, cur[0] ? w + 1 : 1, 1, miss.length).setValues([miss]);
  return sh;
}
function rowOf_(head, o) { return head.map(function (h) { return o[h] === undefined ? '' : o[h]; }); }
function append_(name, head, objs) {
  if (!objs.length) return;
  var sh = sheet_(db_(), name, head);
  var cur = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  if (!cur[0]) cur = head;
  sh.getRange(sh.getLastRow() + 1, 1, objs.length, cur.length).setValues(objs.map(function (o) { return rowOf_(cur, o); }));
}
// 書き戻しは変えた行の変えた列だけ（同時に別の行を直している人を上書きしない）
function writeCell_(t, row, col, value) {
  var c = t.head.indexOf(col);
  if (c < 0) throw new Error('列がありません：' + col);
  t.sh.getRange(row._r, c + 1).setValue(value);
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw userError_('ほかの人が保存中です。少し待ってからもう一度');
  try { return fn(); } finally { lock.releaseLock(); }
}
function log_(by, action, n) { append_('log', TABLES_[5].head, [{ at: new Date(), by: by, action: action, n: n }]); }

function getSetting_(key, def) {
  var t = read_('settings');
  for (var i = 0; i < t.rows.length; i++) if (t.rows[i].key === key) { try { return JSON.parse(t.rows[i].json); } catch (e) { return def; } }
  return def;
}
function setSetting_(key, value) {
  var t = read_('settings');
  for (var i = 0; i < t.rows.length; i++) if (t.rows[i].key === key) { writeCell_(t, t.rows[i], 'json', JSON.stringify(value)); return; }
  append_('settings', TABLES_[0].head, [{ key: key, json: JSON.stringify(value) }]);
}

// ===== 名簿・配慮項目の読み出し =====
function rosterRows_(fy) {
  return read_('roster_' + fy).rows.filter(function (r) { return String(r.id8); }).map(function (r) {
    return { id: String(r.id8), name: String(r.name), kana: String(r.kana || ''), male: String(r.sex) === '男',
      grade: +r.grade, cls: (+r['class']) - 1, no: +r.no };
  });
}
function attrsMap_(fy) {
  var m = {};
  read_('attrs_' + fy).rows.forEach(function (r) {
    var a = {};
    CONFIG.ATTRS.forEach(function (at) {
      a[at.k] = +r[at.k] || 0;
      if ((at.side || at.ctx) && r[at.k + '_t']) a[at.k + '_t'] = String(r[at.k + '_t']);
      if (at.ctx && r[at.k + '_i']) a[at.k + '_i'] = String(r[at.k + '_i']).split(',').filter(Boolean).map(Number);
    });
    if (+r.sp) a.sp = 1;
    if (r.memo) a.memo = String(r.memo);
    m[String(r.id8)] = a;
  });
  return m;
}
function decisionOf_(fy, grade) {
  var t = read_('decisions'), hit = null;
  t.rows.forEach(function (r) { if (+r.fy === fy && +r.grade === grade && !r.undone) hit = r; });
  return hit;
}

// ===== 画面から呼ぶ関数（platform-gas.js と同じ名前と形） =====
function api_(fn) {
  return function () {
    var args = arguments;
    try { return JSON.stringify({ ok: true, build: SERVER_BUILD, v: fn.apply(null, args) }); }
    catch (e) {
      var m = String(e && e.message || e);
      return JSON.stringify({ ok: false, build: SERVER_BUILD, user: m.indexOf('USER:') === 0, err: m.replace(/^USER:/, '') });
    }
  };
}

var apiListGrades = api_(function () {
  requireTeacher_();
  var fy = CONFIG.fiscalYear(), by = {};
  rosterRows_(fy).forEach(function (r) {
    var g = by[r.grade] = by[r.grade] || { grade: r.grade, count: 0, classes: 0, decided: false };
    g.count++; if (r.cls + 1 > g.classes) g.classes = r.cls + 1;
  });
  Object.keys(by).forEach(function (g) { by[g].decided = !!decisionOf_(fy, +g); });
  var out = [];
  for (var g = 1; g <= 6; g++) out.push(by[g] || { grade: g, count: 0, classes: 0, decided: false });
  return out;
});

var apiBoot = api_(function (grade) {
  requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear(), entry = FY - grade + 1, years = [], kids = {}, idset = {};
  for (var fy = entry; fy <= FY + 1; fy++) {
    var gy = fy - entry + 1, am = attrsMap_(fy);
    var rows = rosterRows_(fy).filter(function (r) { return r.grade === gy; });
    if (!rows.length) continue;
    years.push({ fy: fy, grade: gy, rows: rows.map(function (r) {
      kids[r.id] = { id: r.id, name: r.name, kana: r.kana, male: r.male, area: '' };
      idset[r.id] = 1;
      return { id: r.id, cls: r.cls, no: r.no, a: am[r.id] || emptyAttrs_() };
    }) });
  }
  var incs = incidents_().filter(function (x) { return x.ids.some(function (id) { return idset[id]; }); });
  var dec = decisionOf_(FY, grade);
  return {
    fy: FY, grade: grade, years: years, kids: kids, incidents: incs,
    pairs: pairs_(FY, grade),
    carry: carry_(FY, grade, idset),
    transfers: transfers_(FY, grade),
    plans: getSetting_('plans_' + FY + '_' + grade, { ver: 0, plans: [] }),
    scores: scoresOf_(years),
    decision: dec ? { plan: String(dec.plan), at: String(dec.at), names: namesOf_(dec, FY, grade), named: !!String(dec.names || '') } : null
  };
});
function transfers_(fy, grade) {
  return read_('transfers').rows.filter(function (r) { return +r.fy === fy && +r.grade === grade && String(r.id8); }).map(function (r) {
    return { id: String(r.id8), name: String(r.name), kana: String(r.kana), male: String(r.sex) === '男' };
  });
}
// 転入生を足す：児童IDが分からなければ仮のID（T＋数字）。名簿の児童IDと重なれば断る
var apiAddTransfer = api_(function (grade, x) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear();
  var name = String(x && x.name || '').trim(), kana = String(x && x.kana || '').trim(), id = String(x && x.id || '').trim();
  if (!name) throw userError_('名前を入れてください');
  if (id && !/^\d{8}$/.test(id)) throw userError_('児童IDは数字8桁です（分からなければ空のまま）');
  return withLock_(function () {
    if (decisionOf_(FY, grade)) throw userError_('決定済みです。決定を取り消してから足してください');
    var used = {};
    rosterRows_(FY).concat(rosterRows_(FY + 1)).forEach(function (r) { used[r.id] = 1; });
    read_('transfers').rows.forEach(function (r) { used[String(r.id8)] = 1; });
    if (id && used[id]) throw userError_('その児童IDはもう使われています');
    if (!id) { var n = 1; while (used['T' + FY + ('00' + n).slice(-3)]) n++; id = 'T' + FY + ('00' + n).slice(-3); }
    append_('transfers', TABLES_[6].head, [{ fy: FY, grade: grade, id8: id, name: plainText_(name), kana: plainText_(kana), sex: x.male ? '男' : '女', by: by, at: new Date().toISOString() }]);
    return { id: id };
  });
});
var apiRemoveTransfer = api_(function (grade, id) {
  requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear();
  return withLock_(function () {
    if (decisionOf_(FY, grade)) throw userError_('決定済みです。決定を取り消してから消してください');
    removeRows_('transfers', function (r) { return +r.fy === FY && +r.grade === grade && String(r.id8) === String(id); });
    return { ok: true };
  });
});
function emptyAttrs_() { var a = {}; CONFIG.ATTRS.forEach(function (at) { a[at.k] = 0; }); return a; }

function pairs_(fy, grade) {
  return read_('pairs_' + fy + '_' + grade).rows.filter(function (r) { return String(r.type); }).map(function (r) {
    var p = pairExtra_(r, { t: String(r.type), a: String(r.a) });
    if (p.t === 'fix') p.k = (+r.k) - 1; else p.b = String(r.b);
    return p;
  });
}
var PAIR_HEAD = ['type', 'a', 'b', 'k', 'memo', 'by', 'at', 'tags', 'incs', 'since'];
// つける・離すの添え物：memo＝経緯、tags＝定型の理由（「、」区切り）、incs＝添えた事案の番号（「,」区切り）、since＝何年生の時から
function pairExtra_(r, p) {
  p.memo = String(r.memo || '');
  p.tags = String(r.tags || '').split('、').filter(Boolean);
  p.incs = String(r.incs || '').split(',').filter(Boolean).map(Number);
  if (+r.since) p.since = +r.since;
  return p;
}
function pairCells_(p, grade) {
  return { memo: plainText_(String(p.memo || ''), 1000), tags: (p.tags || []).map(String).join('、').slice(0, 200), incs: (p.incs || []).map(Number).filter(function (n) { return n > 0; }).join(','), since: +p.since || grade };
}
// 前年度に決定した時に持ち越した組のうち、2人とも今この学年にいて、まだ採用していないもの
function carry_(FY, grade, idset) {
  var key = function (p) { return p.t + ':' + [p.a, p.b].sort().join('-'); }, have = {};
  pairs_(FY, grade).forEach(function (p) { have[key(p)] = 1; });
  return read_('pairs_carry').rows.filter(function (r) { return +r.fy === FY - 1 && idset[String(r.a)] && idset[String(r.b)]; })
    .map(function (r) { return pairExtra_(r, { t: String(r.type), a: String(r.a), b: String(r.b) }); })
    .filter(function (p) { return !have[key(p)]; });
}

// つける・離す・組に固定を、学年ごとにまとめて置き換える
var apiSavePairs = api_(function (grade, pairs) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear(), name = 'pairs_' + FY + '_' + grade;
  if (decisionOf_(FY, grade)) throw userError_('クラス替えを決定したので直せません');
  return withLock_(function () {
    sheet_(db_(), name, PAIR_HEAD); ensureCols_(name, PAIR_HEAD);
    removeRows_(name, function (r) { return r._r > 1; });
    append_(name, PAIR_HEAD, (pairs || []).map(function (p) {
      return Object.assign({ type: p.t, a: String(p.a), b: p.t === 'fix' ? '' : String(p.b), k: p.t === 'fix' ? (+p.k) + 1 : '', by: by, at: new Date().toISOString() }, pairCells_(p, grade));
    }));
    return { n: (pairs || []).length };
  });
});

// 名簿を入れる：同じ児童IDは上書き（配慮項目の値は残す）、新しいIDは足す。貼った中にいない児童は知らせるだけ（消さない）
var apiImportRoster = api_(function (fy, grade, rows) {
  var by = requireTeacher_();
  fy = +fy; grade = +grade;
  var FY = CONFIG.fiscalYear();
  if (fy !== FY && fy !== FY + 1) throw userError_('今年度か来年度の名簿だけ入れられます');
  if (!rows || !rows.length) throw userError_('児童がいません');
  return withLock_(function () {
    var name = 'roster_' + fy;
    sheet_(db_(), name, ROSTER_HEAD);
    ensureCols_('attrs_' + fy, attrsHead_());
    var t = read_(name), byId = {}, added = [], updated = 0, classes = {}, ids = {};
    t.rows.forEach(function (r) { byId[String(r.id8)] = r; });
    rows.forEach(function (x) {
      var id = String(x.id);
      if (!/^\d{8}$/.test(id)) throw userError_('児童IDが8桁でない行があります');
      classes[+x.cls] = 1; ids[id] = 1;
      var o = { id8: id, name: String(x.name), kana: String(x.kana || ''), sex: x.male ? '男' : (x.sex || '女'), grade: grade, 'class': (+x.cls) + 1, no: +x.no };
      var r = byId[id];
      if (r) { ['name', 'kana', 'sex', 'grade', 'class', 'no'].forEach(function (c) { if (String(r[c]) !== String(o[c])) writeCell_(t, r, c, o[c]); }); updated++; }
      else added.push(o);
    });
    append_(name, ROSTER_HEAD, added);
    var missing = t.rows.filter(function (r) { return +r.grade === grade && classes[(+r['class']) - 1] && !ids[String(r.id8)]; }).map(function (r) { return String(r.name); });
    log_(by, 'importRoster', rows.length);
    return { added: added.length, updated: updated, missing: missing };
  });
});

function incidents_() {
  var kids = {}, roles = {};
  read_('incident_kids').rows.forEach(function (r) {
    (kids[r.inc_id] = kids[r.inc_id] || []).push(String(r.id8));
    if (r.role) (roles[r.inc_id] = roles[r.inc_id] || {})[String(r.id8)] = String(r.role);
  });
  return read_('incidents').rows.filter(function (r) { return !r.deleted && r.inc_id !== ''; }).map(function (r) {
    var dg = null;
    if (r.diagram) { try { dg = Engine.normDiagram(JSON.parse(String(r.diagram))); } catch (e) { dg = null; } }
    var rp = null;
    if (r.report) { try { rp = Report.norm(JSON.parse(String(r.report))); } catch (e) { rp = null; } }
    return { id: +r.inc_id, date: isoDate_(r.date), dateEnd: r.date_end ? isoDate_(r.date_end) : '', detail: String(r.detail || ''), type: String(r.type), title: String(r.title), url: String(r.url), ids: kids[r.inc_id] || [], roles: roles[r.inc_id] || {}, diagram: dg, report: rp };
  });
}
// 事案の入力を確かめる：関係図があれば、関係する児童と役割は関係図から決める
function incidentInput_(x) {
  if (!x) throw userError_('事案が読めません');
  // 文書のURLは任意（事案管理の入力欄に記録を書くなら要らない）。貼るなら学校のドライブの文書だけ
  if (x.url && !/^https:\/\/(docs|drive)\.google\.com\//.test(String(x.url))) throw userError_('学校のドライブの文書のURLを貼ってください');
  var dg = x.diagram ? Engine.normDiagram(x.diagram) : null, ids, roles = {};
  if (dg && dg.nodes.length) {
    // 「？」（誰か分からない児童）は関係図にだけ残し、事案と児童の結び付き・役割には入れない
    ids = dg.nodes.map(function (n) { return n.id; }).filter(function (id) { return !Engine.isUnknown(id); });
    var all = Engine.diagramRoles(dg); ids.forEach(function (id) { if (all[id]) roles[id] = all[id]; });
  }
  else { ids = (x.ids || []).map(String); dg = null; }
  if (!ids.length) throw userError_('関係する児童を選んでください');
  var json = dg ? JSON.stringify(dg) : '';
  if (json.length > 40000) throw userError_('関係図が大きすぎます');
  // 事案は期間を持つことが多い：始まり（必須）と終わり（任意。空＝その日だけか、続いている）
  var date = String(x.date || ''), end = String(x.dateEnd || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw userError_('始まりの日を入れてください');
  if (end && (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end < date)) throw userError_('終わりの日は始まりの日より後にしてください');
  var rp = x.report ? reportInput_(x.report) : null, rjson = rp ? JSON.stringify(rp) : '';
  if (rjson.length > 45000) throw userError_('記録が長すぎます。分けて書いてください');
  return { ids: ids, roles: roles, diagram: dg, json: json, date: date, dateEnd: end, detail: plainText_(String(x.detail || '').trim(), 5000), type: String(x.type), url: String(x.url || ''), report: rp, rjson: rjson };
}
// 報告書の記録（発覚・経緯・指導、様式Ⅱの追記）を確かめる。文字数と行数に上限を置く
function reportInput_(r) {
  var rp = Report.norm(r), cut = function (a) {
    if (a.length > 80) throw userError_('記録の行が多すぎます（1つの欄に80行まで）');
    return a.map(function (x) { return { d: /^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '', p: String(x.p).slice(0, 20), t: String(x.t).slice(0, 2000) }; });
  };
  ['hk', 'kk', 'sd'].forEach(function (k) { rp.s1[k] = cut(rp.s1[k]); });
  ['sd', 'vi', 'ha'].forEach(function (k) { rp.s2[k] = cut(rp.s2[k]); });
  var v2 = {}; Object.keys(rp.s2v).slice(0, 40).forEach(function (id) { if (/^\d{1,20}$|^T\d+$/.test(id)) v2[id] = cut(rp.s2v[id]); }); rp.s2v = v2;
  rp.s2.kikan = rp.s2.kikan.slice(0, 2000); rp.other = rp.other.slice(0, 200);
  if (rp.found && CONFIG.FOUND_LIST.indexOf(rp.found) < 0) rp.found = '';
  return rp;
}
function isoDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

// 配慮項目は編集できる年度だけ（決定前＝今年度、決定後＝来年度）。決定後の今年度は凍結
// クラス分けテストの点数（年度・学年ごと）。{ max, top, s: { 児童ID: 点数 } }。上位の「賢い」は画面で決める（手動の賢いは消さない）
function scoresOf_(years) {
  var out = {};
  years.forEach(function (y) { var v = getSetting_('scores_' + y.fy + '_' + y.grade, null); if (v) out[y.fy] = v; });
  return out;
}
var apiSetScores = api_(function (fy, grade, v) {
  requireTeacher_();
  fy = +fy; grade = +grade;
  var FY = CONFIG.fiscalYear(), dec = decisionOf_(FY, grade - (fy - FY)), editable = dec ? FY + 1 : FY;
  if (fy !== editable) throw userError_('この年度の点数は直せません');
  var max = +v.max, top = +v.top, s = {};
  if (!(max > 0 && max <= 10000)) throw userError_('満点が違います');
  if (!(top > 0 && top < 1)) throw userError_('上位の割合が違います');
  var ids = {}; rosterRows_(fy).forEach(function (r) { if (r.grade === grade) ids[r.id] = 1; });
  Object.keys(v.s || {}).forEach(function (id) { var n = +v.s[id]; if (ids[id] && n >= 0 && n <= max) s[id] = n; });
  return withLock_(function () { setSetting_('scores_' + fy + '_' + grade, { max: max, top: top, s: s }); return { ok: true }; });
});

var apiSetAttr = api_(function (fy, grade, id, k, v, text, incs) {
  var by = requireTeacher_();
  fy = +fy; grade = +grade; v = +v;
  if (k === 'memo') { text = String(text == null ? '' : text).trim(); v = text ? 1 : 0; }
  var at = k === 'sp' ? { k: 'sp', max: 1 } : k === 'memo' ? { k: 'memo', max: 1 } : CONFIG.ATTRS.filter(function (a) { return a.k === k; })[0];
  if (!at) throw userError_('項目が違います');
  if (!(v >= 0 && v <= at.max)) throw userError_('値が違います');
  var FY = CONFIG.fiscalYear(), cohortGrade = grade - (fy - FY), dec = decisionOf_(FY, cohortGrade);
  var editable = dec ? FY + 1 : FY;
  if (fy !== editable) throw userError_(fy === FY && dec ? 'クラス替えを決定したので、今年度の値は直せません。準備中の年度を直してください' : 'この年度は直せません');
  return withLock_(function () {
    var name = 'attrs_' + fy;
    ensureCols_(name, attrsHead_());
    var t = read_(name), row = null;
    t.rows.forEach(function (r) { if (String(r.id8) === String(id)) row = r; });
    if (k === 'memo') { // 備考は文字だけを持つ
      if (row) writeCell_(t, row, 'memo', plainText_(text, 400));
      else append_(name, attrsHead_(), [{ id8: String(id), memo: plainText_(text, 400) }]);
      return { ok: true, by: by };
    }
    var tk = (at.side || at.ctx) && text !== undefined ? k + '_t' : null, tv = tk ? plainText_(v ? text : '', at.ctx ? 1000 : 200) : '';
    var ik = at.ctx && incs !== undefined ? k + '_i' : null, iv = ik && v ? (incs || []).map(Number).filter(function (n) { return n > 0; }).join(',') : '';
    if (row) { writeCell_(t, row, k, v); if (tk) writeCell_(t, row, tk, tv); if (ik) writeCell_(t, row, ik, iv); }
    else { var o = { id8: String(id) }; o[k] = v; if (tk) o[tk] = tv; if (ik) o[ik] = iv; append_(name, attrsHead_(), [o]); }
    return { ok: true, by: by };
  });
});

// 案は学年ごとに1つの値（版つき）。他の人が先に保存していたら上書きせずに知らせる
var apiSavePlans = api_(function (grade, plans, baseVer) {
  var by = requireTeacher_();
  var key = 'plans_' + CONFIG.fiscalYear() + '_' + (+grade);
  return withLock_(function () {
    var cur = getSetting_(key, { ver: 0, plans: [] });
    if ((+baseVer || 0) !== (+cur.ver || 0)) return { conflict: true, ver: cur.ver, by: cur.by || '' };
    var next = { ver: (+cur.ver || 0) + 1, by: by, at: new Date().toISOString(), plans: plans };
    if (JSON.stringify(next).length > 45000) throw userError_('案が多すぎて保存できません。使わない案を削除してください');
    setSetting_(key, next);
    return { ver: next.ver };
  });
});

function fileIdOf_(url) {
  var m = String(url).match(/\/d\/([\w-]{20,})/) || String(url).match(/[?&]id=([\w-]{20,})/);
  return m ? m[1] : '';
}
// 所有者が開けない文書は名前を取れない（空を返し、画面が入力を求める）
function titleOf_(url) {
  var id = fileIdOf_(url);
  if (!id) return '';
  try { return DriveApp.getFileById(id).getName(); } catch (e) { return ''; }
}
var apiFetchTitle = api_(function (url) { requireTeacher_(); return { title: titleOf_(url) }; });

var apiAddIncident = api_(function (x) {
  var by = requireTeacher_();
  var v = incidentInput_(x);
  var title = String(x.title || '').trim() || (v.url ? titleOf_(v.url) : '');
  return withLock_(function () {
    ensureCols_('incidents', TABLES_[3].head); ensureCols_('incident_kids', TABLES_[4].head);
    var t = read_('incidents'), next = 1;
    t.rows.forEach(function (r) { if (+r.inc_id >= next) next = +r.inc_id + 1; });
    var inc = { inc_id: next, date: v.date, date_end: v.dateEnd, detail: v.detail, type: v.type, url: v.url, file_id: fileIdOf_(v.url), title: title, by: by, at: new Date(), deleted: '', diagram: v.json, report: v.rjson };
    append_('incidents', TABLES_[3].head, [inc]);
    append_('incident_kids', TABLES_[4].head, v.ids.map(function (id) { return { inc_id: next, id8: id, role: v.roles[id] || '' }; }));
    log_(by, 'addIncident', v.ids.length);
    return { id: next, date: inc.date, dateEnd: v.dateEnd, detail: v.detail, type: inc.type, title: title, url: inc.url, ids: v.ids, roles: v.roles, diagram: v.diagram, report: v.report };
  });
});

// 事案を直す（関係図・文書・日付・種別）。関係する児童は関係図から入れ直す
var apiUpdateIncident = api_(function (id, x) {
  var by = requireTeacher_();
  id = +id;
  var v = incidentInput_(x);
  var title = String(x.title || '').trim() || (v.url ? titleOf_(v.url) : '');
  return withLock_(function () {
    ensureCols_('incidents', TABLES_[3].head); ensureCols_('incident_kids', TABLES_[4].head);
    var t = read_('incidents'), row = t.rows.filter(function (r) { return +r.inc_id === id && !r.deleted; })[0];
    if (!row) throw userError_('事案が見つかりません');
    [['date', v.date], ['date_end', v.dateEnd], ['detail', v.detail], ['type', v.type], ['url', v.url], ['file_id', fileIdOf_(v.url)], ['title', title], ['diagram', v.json], ['report', v.rjson]].forEach(function (c) { writeCell_(t, row, c[0], c[1]); });
    removeRows_('incident_kids', function (r) { return +r.inc_id === id; });
    append_('incident_kids', TABLES_[4].head, v.ids.map(function (k) { return { inc_id: id, id8: k, role: v.roles[k] || '' }; }));
    log_(by, 'updateIncident', v.ids.length);
    return { id: id, date: v.date, dateEnd: v.dateEnd, detail: v.detail, type: v.type, title: title, url: v.url, ids: v.ids, roles: v.roles, diagram: v.diagram, report: v.report };
  });
});

// 報告書のExcel：設定の様式ファイル（xlsxのまま置いたもの）を複製し、該当するシートのセルにだけ値を書く。
// 元のファイルは変えない。xlsx の中の XML を直接書き換えるので、罫線・結合・入力規則は元のまま。
// 複製は様式のファイルと同じフォルダに置く（名前に児童の氏名は入れない）
var apiExportReport = api_(function (kind, values, incId, seq) {
  var by = requireTeacher_(), R = CONFIG.REPORT;
  if (!R.sheets[kind]) throw userError_('様式が分かりません');
  var ok = {}; Report.allowedCells(kind).forEach(function (c) { ok[c] = 1; });
  var vals = {};
  Object.keys(values || {}).forEach(function (ref) {
    if (!ok[ref]) return;
    var v = values[ref];
    vals[ref] = typeof v === 'number' && isFinite(v) ? v : String(v).slice(0, 8000);
  });
  var id = fileIdOf_(settings_().template);
  if (!id) throw userError_('様式のファイルが設定されていません。設定の「事案と報告書」でURLを貼ってください');
  var file;
  try { file = DriveApp.getFileById(id); } catch (e) { throw userError_('様式のファイルを開けません。所有者が開けるドライブに置いてください'); }
  if (file.getMimeType() !== MimeType.MICROSOFT_EXCEL) throw userError_('様式のファイルはExcel（.xlsx）のまま置いてください（スプレッドシートに変換しない）');
  var blob = file.getBlob().setContentType('application/zip');
  var parts = Utilities.unzip(blob), byName = {};
  parts.forEach(function (b, i) { byName[b.getName()] = i; });
  var text = function (n) { return parts[byName[n]].getDataAsString('UTF-8'); };
  var put = function (n, s) { parts[byName[n]] = Utilities.newBlob(s, 'application/xml', n); };
  if (byName['xl/workbook.xml'] == null || byName['xl/_rels/workbook.xml.rels'] == null) throw userError_('様式のファイルが読めません');
  var wb = text('xl/workbook.xml'), path = Report.sheetPath(wb, text('xl/_rels/workbook.xml.rels'), R.sheets[kind]);
  if (!path || byName[path] == null) throw userError_('様式のファイルに「' + R.sheets[kind] + '」のシートがありません');
  Object.keys(byName).forEach(function (n) { if (/^xl\/worksheets\/[^/]+\.xml$/.test(n)) put(n, Report.untab(text(n), n === path)); });
  put(path, Report.fillSheet(text(path), vals));
  put('xl/workbook.xml', Report.activate(wb, R.sheets[kind]));
  // 被害の児童が複数の時は、1人ずつ番号を付けて別のファイルにする（名前に氏名は入れない）
  var name = R.names[kind] + '_事案' + (+incId || 0) + (+seq ? '_被害' + (+seq) : '') + '_' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmm') + '.xlsx';
  var out = Utilities.zip(parts, name).setContentType(MimeType.MICROSOFT_EXCEL);
  var folder = null;
  try { var it = file.getParents(); if (it.hasNext()) folder = it.next(); } catch (e) { folder = null; }
  var copy = folder ? folder.createFile(out) : DriveApp.createFile(out);
  log_(by, 'exportReport', +incId || 0);
  return { name: name, url: copy.getUrl() };
});

// 事案の書きかけ（下書き）：教員ごと・学年ごとに1つ。画面を離れても消えないように、入力のたびに少し遅れて保存する
// 中身は入力中の記録そのもの（氏名が入りうる）。登録するか「やめる」で消える
function draftKey_(email, grade) { return 'incdraft_' + String(email).toLowerCase() + '_' + (+grade); }
var apiSaveDraft = api_(function (grade, draft) {
  var by = requireTeacher_(), key = draftKey_(by, grade);
  return withLock_(function () {
    if (!draft) { setSetting_(key, null); return { ok: true }; }
    var s = JSON.stringify(draft);
    if (s.length > 45000) throw userError_('書きかけが長すぎて保存できません。登録してから続きを書いてください');
    setSetting_(key, { at: new Date().toISOString(), draft: draft });
    return { ok: true };
  });
});
var apiLoadDraft = api_(function (grade) {
  var by = requireTeacher_(), v = getSetting_(draftKey_(by, grade), null);
  return v && v.draft ? v : null;
});

// 全校の事案（事案の一覧で、ほかの学年を探す時）
var apiAllIncidents = api_(function () {
  requireTeacher_();
  return incidents_();
});

// 全校の今年度の名簿（事案管理で、ほかの学年の児童を関係図に足すため。名前・よみ・性別・学年・組と、配慮項目の程度・内容の文）
// 備考・経緯への事案の紐付けは渡さない（関係図のアイコンに要らない）
var apiSchoolKids = api_(function () {
  requireTeacher_();
  var FY = CONFIG.fiscalYear(), am = attrsMap_(FY);
  return rosterRows_(FY).map(function (r) {
    var a = {}, src = am[r.id] || {};
    CONFIG.ATTRS.forEach(function (at) { if (src[at.k]) a[at.k] = src[at.k]; if (src[at.k + '_t']) a[at.k + '_t'] = src[at.k + '_t']; });
    if (src.sp) a.sp = 1;
    return { id: r.id, name: r.name, kana: r.kana, male: r.male, grade: r.grade, cls: r.cls, a: a };
  });
});

var apiSchoolIncidents = api_(function () {
  requireTeacher_();
  var cur = {};
  rosterRows_(CONFIG.fiscalYear()).forEach(function (r) { cur[r.id] = r; });
  var cnt = {}, last = {};
  incidents_().forEach(function (x) { x.ids.forEach(function (id) { cnt[id] = (cnt[id] || 0) + 1; if (!last[id] || x.date > last[id]) last[id] = x.date; }); });
  return Object.keys(cnt).filter(function (id) { return cur[id]; }).map(function (id) {
    var r = cur[id];
    return { id: id, name: r.name, male: r.male, grade: r.grade, cls: r.cls, no: r.no, count: cnt[id], last: last[id] };
  });
});

// 決定：来年度の名簿（新しい組・番号）と配慮項目の写しを作り、つける・離すを持ち越しの候補にする
var apiDecide = api_(function (grade, plan) {
  var by = requireTeacher_();
  grade = +grade;
  if (grade >= 6) throw userError_('6年は決定しません');
  var FY = CONFIG.fiscalYear();
  return withLock_(function () {
    if (decisionOf_(FY, grade)) throw userError_('決定済みです');
    var am = attrsMap_(FY);
    var cur = rosterRows_(FY).filter(function (r) { return r.grade === grade; });
    if (!cur.length) throw userError_('名簿がありません');
    // 転入生も名簿の児童と同じに扱う（今年度の値は無いので空）
    var tr = transfers_(FY, grade).map(function (t) { return { id: t.id, name: t.name, kana: t.kana, male: t.male }; });
    cur = cur.concat(tr);
    var kids = cur.map(function (r) { return { id: r.id, kana: r.kana, a: am[r.id] || emptyAttrs_() }; });
    var asg = cur.map(function (r) { return plan.assign[r.id]; });
    if (asg.some(function (k) { return !(k >= 0 && k < CONFIG.MAX_CLASSES); })) throw userError_('組の決まっていない児童がいます');
    var nc = 0; asg.forEach(function (k) { if (k + 1 > nc) nc = k + 1; });
    var rows = Engine.nextYearRows(kids, asg, nc), info = {};
    cur.forEach(function (r) { info[r.id] = r; });
    var nfy = FY + 1;
    append_('roster_' + nfy, ROSTER_HEAD, rows.map(function (r) {
      var s = info[r.id];
      return { id8: r.id, name: s.name, kana: s.kana, sex: s.male ? '男' : '女', grade: grade + 1, 'class': r.cls + 1, no: r.no };
    }));
    ensureCols_('attrs_' + nfy, attrsHead_());
    append_('attrs_' + nfy, attrsHead_(), rows.map(function (r) { var o = { id8: r.id }; CONFIG.ATTRS.forEach(function (at) { o[at.k] = r.a[at.k]; if ((at.side || at.ctx) && r.a[at.k + '_t']) o[at.k + '_t'] = plainText_(r.a[at.k + '_t'], 1000); if (at.ctx && r.a[at.k + '_i']) o[at.k + '_i'] = r.a[at.k + '_i'].join(','); }); if (r.a.sp) o.sp = 1; if (r.a.memo) o.memo = plainText_(r.a.memo, 400); return o; }));
    ensureCols_('pairs_carry', TABLES_[2].head);
    append_('pairs_carry', TABLES_[2].head, pairs_(FY, grade).filter(function (p) { return p.t !== 'fix'; })
      .map(function (p) { return Object.assign({ fy: FY, type: p.t, a: p.a, b: p.b }, pairCells_(p, grade)); })); // 経緯・理由・何年生からを次の年度へ持ち越す
    append_('decisions', TABLES_[1].head, [{ fy: FY, grade: grade, plan: String(plan.name), by: by, at: new Date().toISOString(), undone: '' }]);
    log_(by, 'decide', rows.length);
    return { plan: String(plan.name) };
  });
});

// 取り消し：4/1まで（年度が変わったら決定は確定）。来年度の名簿と写した値・持ち越しの候補を消す
var apiUndoDecide = api_(function (grade) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear();
  return withLock_(function () {
    var dec = decisionOf_(FY, grade);
    if (!dec) throw userError_('決定されていません（年度が変わった後は取り消せません）');
    var ids = {};
    rosterRows_(FY).forEach(function (r) { if (r.grade === grade) ids[r.id] = 1; });
    transfers_(FY, grade).forEach(function (t) { ids[t.id] = 1; });
    var n = removeRows_('roster_' + (FY + 1), function (r) { return +r.grade === grade + 1 && ids[String(r.id8)]; });
    removeRows_('attrs_' + (FY + 1), function (r) { return ids[String(r.id8)]; });
    removeRows_('pairs_carry', function (r) { return +r.fy === FY && (ids[String(r.a)] || ids[String(r.b)]); });
    var t = read_('decisions');
    writeCell_(t, t.rows.filter(function (r) { return r._r === dec._r; })[0], 'undone', new Date().toISOString());
    log_(by, 'undoDecide', n);
    return { ok: true };
  });
});
// 決定した組の番号（A組から順）。未設定は仮で A組＝1組…
function namesOf_(dec, FY, grade) {
  var v = String(dec.names || '');
  if (v) return v.split(',').map(Number);
  var nc = 0;
  rosterRows_(FY + 1).forEach(function (r) { if (r.grade === grade + 1 && r.cls + 1 > nc) nc = r.cls + 1; });
  var out = []; for (var k = 0; k < nc; k++) out.push(k + 1);
  return out;
}
// 組の番号を決める（決定の後の別の操作）。来年度の名簿の組の列を付け替える。出席番号は組の中で変わらない
var apiSetClassNames = api_(function (grade, names) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear();
  return withLock_(function () {
    var dec = decisionOf_(FY, grade);
    if (!dec) throw userError_('決定されていません');
    var old = namesOf_(dec, FY, grade), nc = old.length;
    names = (names || []).map(Number);
    var ok = names.length === nc && names.slice().sort(function (a, b) { return a - b; }).every(function (v, i) { return v === i + 1; });
    if (!ok) throw userError_('組の番号は 1〜' + nc + ' を1つずつ使ってください');
    var ids = {};
    rosterRows_(FY).forEach(function (r) { if (r.grade === grade) ids[r.id] = 1; });
    transfers_(FY, grade).forEach(function (t) { ids[t.id] = 1; });
    var t = read_('roster_' + (FY + 1)), c = t.head.indexOf('class');
    if (t.rows.length) {
      var col = t.rows.map(function (r) {
        var v = +r['class'];
        if (+r.grade === grade + 1 && ids[String(r.id8)]) { var k = old.indexOf(v); if (k >= 0) v = names[k]; }
        return [v];
      });
      t.sh.getRange(2, c + 1, col.length, 1).setValues(col); // 1回で書く（行ごとに書くと遅い）
    }
    ensureCols_('decisions', TABLES_[1].head);
    var d = read_('decisions');
    writeCell_(d, d.rows.filter(function (r) { return r._r === dec._r; })[0], 'names', names.join(','));
    log_(by, 'classNames', nc);
    return { ok: true };
  });
});

// 行を消す（下の行から消すので行番号がずれない）
function removeRows_(name, pred) {
  var t = read_(name), n = 0;
  if (!t.sh) return 0;
  t.rows.slice().reverse().forEach(function (r) { if (pred(r)) { t.sh.deleteRow(r._r); n++; } });
  return n;
}

// ===== 設定 =====
// 項目の名前・頭文字・既定の重み、事案の種別、担任と学級、卒業・転出後に残す年数。正本は settings シートの app
function defaultSettings_() {
  var attrs = {};
  CONFIG.ATTRS.forEach(function (at) { attrs[at.k] = { label: at.label, s: at.s, w: at.w }; });
  return { attrs: attrs, types: CONFIG.INCIDENT_TYPES.slice(), teachers: [], keepYears: CONFIG.KEEP_YEARS_DEFAULT, slots: CONFIG.TIME_SLOTS.slice(), school: '', template: '' };
}
function settings_() {
  var d = defaultSettings_(), s = getSetting_('app', {});
  return { attrs: Object.assign(d.attrs, s.attrs || {}), types: s.types && s.types.length ? s.types : d.types,
    teachers: s.teachers || [], keepYears: s.keepYears == null || s.keepYears === '' ? d.keepYears : +s.keepYears || 0,
    slots: s.slots && s.slots.length ? s.slots : d.slots, school: String(s.school || ''), template: String(s.template || '') };
}
var apiSettings = api_(function () {
  var email = requireTeacher_(), s = settings_(), me = { email: email, grade: 0, cls: -1 };
  s.teachers.forEach(function (t) { if (String(t.email).toLowerCase() === email) { me.grade = +t.grade; me.cls = (+t.cls) - 1; } });
  return { settings: s, me: me };
});
var apiSaveSettings = api_(function (s) {
  var by = requireTeacher_();
  if (!s || !s.attrs) throw userError_('設定が読めません');
  var clean = { attrs: {}, types: [], teachers: [], keepYears: Math.max(0, Math.min(6, +s.keepYears || 0)),
    slots: (s.slots || []).map(function (t) { return String(t).trim().slice(0, 20); }).filter(Boolean).slice(0, 30),
    school: String(s.school || '').trim().slice(0, 40), template: String(s.template || '').trim().slice(0, 300) };
  if (!clean.slots.length) clean.slots = CONFIG.TIME_SLOTS.slice();
  if (clean.template && !fileIdOf_(clean.template)) throw userError_('様式のファイルは、ドライブのファイルのURLを貼ってください');
  CONFIG.ATTRS.forEach(function (at) {
    var x = s.attrs[at.k] || {};
    var label = String(x.label === undefined ? at.label : x.label).trim().slice(0, 20), ini = String(x.s === undefined ? at.s : x.s).trim().slice(0, 1);
    if (!label || !ini) throw userError_('項目の名前と頭文字は空にできません');
    // 説明文：空の欄は既定の文に戻す
    var help = (at.help || []).map(function (d, i) { var t = String(x.help && x.help[i] || '').trim().slice(0, 80); return t || d; });
    clean.attrs[at.k] = { label: label, s: ini, w: Math.max(0, Math.min(3, +x.w || 0)), help: help };
  });
  clean.types = (s.types || []).map(function (t) { return String(t).trim(); }).filter(Boolean).slice(0, 20);
  if (!clean.types.length) throw userError_('事案の種別を1つ以上入れてください');
  clean.teachers = (s.teachers || []).filter(function (t) { return t && t.email; }).map(function (t) {
    return { email: String(t.email).trim().toLowerCase(), grade: +t.grade || 0, cls: +t.cls || 0 };
  });
  withLock_(function () { setSetting_('app', clean); log_(by, 'saveSettings', 0); });
  return clean;
});

// ===== 年度替わり：卒業・転出した児童の記録を消す =====
function rosterSheets_() {
  return db_().getSheets().map(function (sh) { return sh.getName(); }).filter(function (n) { return /^roster_\d{4}$/.test(n); })
    .map(function (n) { return +n.slice(7); }).sort();
}
// 今年度（と来年度）の名簿にいない児童。最後にいた年度から keepYears 年度を過ぎたものだけ
var apiLeaveCandidates = api_(function () {
  requireTeacher_();
  var FY = CONFIG.fiscalYear(), keep = settings_().keepYears, now = {}, last = {};
  [FY, FY + 1].forEach(function (fy) { rosterRows_(fy).forEach(function (r) { now[r.id] = 1; }); });
  rosterSheets_().forEach(function (fy) {
    if (fy >= FY) return;
    rosterRows_(fy).forEach(function (r) { last[r.id] = { id: r.id, name: r.name, fy: fy, grade: r.grade, cls: r.cls, no: r.no }; });
  });
  var cnt = {};
  incidents_().forEach(function (x) { x.ids.forEach(function (id) { cnt[id] = (cnt[id] || 0) + 1; }); });
  return Object.keys(last).filter(function (id) { return !now[id] && CONFIG.purgeable(last[id].fy, FY, keep, !!cnt[id]); }).map(function (id) {
    var x = last[id]; x.reason = x.grade === 6 ? '卒業' : '転出'; x.incidents = cnt[id] || 0; return x;
  }).sort(function (a, b) { return a.fy - b.fy || a.grade - b.grade || a.cls - b.cls || a.no - b.no; });
});
// 消す：名簿・配慮項目・つける離す・持ち越し・事案との結び付き・案の割り当てから、その児童の行を消す。
// 結び付く児童がいなくなった事案は、名前とURLを消して削除済みにする。元に戻せない
var apiPurge = api_(function (ids) {
  var by = requireTeacher_();
  if (!ids || !ids.length) throw userError_('消す児童を選んでください');
  var FY = CONFIG.fiscalYear(), set = {}, now = {};
  [FY, FY + 1].forEach(function (fy) { rosterRows_(fy).forEach(function (r) { now[r.id] = 1; }); });
  ids.forEach(function (id) { if (now[id]) throw userError_('今年度の名簿にいる児童は消せません'); set[String(id)] = 1; });
  // 画面の候補と同じ規則をサーバーでも確かめる（事案に関わった児童は5年度より前に消さない）
  var keep = settings_().keepYears, lastFy = {}, inc = {};
  rosterSheets_().forEach(function (fy) { if (fy < FY) rosterRows_(fy).forEach(function (r) { if (set[r.id]) lastFy[r.id] = fy; }); });
  incidents_().forEach(function (x) { x.ids.forEach(function (id) { inc[id] = 1; }); });
  ids.forEach(function (id) {
    if (lastFy[id] != null && !CONFIG.purgeable(lastFy[id], FY, keep, !!inc[id])) throw userError_('残す年数を過ぎていない児童は消せません（事案に関わった児童は卒業・転出から' + CONFIG.INCIDENT_KEEP_YEARS + '年度）');
  });
  return withLock_(function () {
    var n = 0;
    db_().getSheets().map(function (sh) { return sh.getName(); }).forEach(function (name) {
      if (/^(roster|attrs)_\d{4}$/.test(name)) n += removeRows_(name, function (r) { return set[String(r.id8)]; });
      else if (/^pairs_/.test(name)) removeRows_(name, function (r) { return set[String(r.a)] || set[String(r.b)]; });
    });
    removeRows_('incident_kids', function (r) { return set[String(r.id8)]; });
    removeRows_('transfers', function (r) { return set[String(r.id8)]; });
    var left = {};
    read_('incident_kids').rows.forEach(function (r) { left[r.inc_id] = 1; });
    var t = read_('incidents');
    t.rows.forEach(function (r) {
      if (!r.deleted && r.inc_id !== '' && !left[r.inc_id]) { writeCell_(t, r, 'title', ''); writeCell_(t, r, 'url', ''); if (t.head.indexOf('detail') >= 0) writeCell_(t, r, 'detail', ''); if (t.head.indexOf('report') >= 0) writeCell_(t, r, 'report', ''); writeCell_(t, r, 'deleted', new Date().toISOString()); }
      // 関係図からも消した児童を外す（残った児童の関係図は、その児童のいない形で残す）
      if (r.diagram) {
        var dg; try { dg = JSON.parse(String(r.diagram)); } catch (e) { dg = null; }
        if (dg && (dg.nodes || []).some(function (nd) { return set[String(nd.id)]; })) {
          dg.nodes = dg.nodes.filter(function (nd) { return !set[String(nd.id)]; });
          writeCell_(t, r, 'diagram', left[r.inc_id] ? JSON.stringify(Engine.normDiagram(dg)) : '');
        }
      }
    });
    read_('settings').rows.forEach(function (r) {
      if (!/^plans_/.test(String(r.key))) return;
      var v = JSON.parse(r.json), ch = false;
      (v.plans || []).forEach(function (p) {
        Object.keys(p.assign || {}).forEach(function (id) { if (set[id]) { delete p.assign[id]; ch = true; } });
        p.locks = (p.locks || []).filter(function (id) { return !set[id]; });
      });
      if (ch) setSetting_(String(r.key), v);
    });
    log_(by, 'purge', ids.length);
    return { kids: ids.length, rows: n };
  });
});

// 名簿を入れる（PR③で画面を作るまでの間、所有者がスクリプトエディタから呼ぶ）
// rows: [[id8, name, kana, 性別, 学年, 組, 番号], ...]
function importRoster(fy, rows) {
  sheet_(db_(), 'roster_' + fy, ROSTER_HEAD);
  sheet_(db_(), 'attrs_' + fy, attrsHead_());
  append_('roster_' + fy, ROSTER_HEAD, rows.map(function (r) {
    return { id8: String(r[0]), name: r[1], kana: r[2], sex: r[3], grade: +r[4], 'class': +r[5], no: +r[6] };
  }));
  return rows.length;
}

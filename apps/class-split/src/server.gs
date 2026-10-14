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
  var ok = !!email && email.slice(-(CONFIG.TEACHER_DOMAIN.length + 1)) === '@' + CONFIG.TEACHER_DOMAIN;
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
  { name: 'decisions', head: ['fy', 'grade', 'plan', 'by', 'at', 'undone'] },
  { name: 'pairs_carry', head: ['fy', 'type', 'a', 'b'] },
  { name: 'incidents', head: ['inc_id', 'date', 'type', 'url', 'file_id', 'title', 'by', 'at', 'deleted'] },
  { name: 'incident_kids', head: ['inc_id', 'id8'] },
  { name: 'log', head: ['at', 'by', 'action', 'n'] }
];
function attrsHead_() { return ['id8'].concat(CONFIG.ATTRS.map(function (at) { return at.k; })); }

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
    CONFIG.ATTRS.forEach(function (at) { a[at.k] = +r[at.k] || 0; });
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
    plans: getSetting_('plans_' + FY + '_' + grade, { ver: 0, plans: [] }),
    decision: dec ? { plan: String(dec.plan), at: String(dec.at) } : null
  };
});
function emptyAttrs_() { var a = {}; CONFIG.ATTRS.forEach(function (at) { a[at.k] = 0; }); return a; }

function pairs_(fy, grade) {
  return read_('pairs_' + fy + '_' + grade).rows.filter(function (r) { return String(r.type); }).map(function (r) {
    var p = { t: String(r.type), a: String(r.a), memo: String(r.memo || '') };
    if (p.t === 'fix') p.k = (+r.k) - 1; else p.b = String(r.b);
    return p;
  });
}
var PAIR_HEAD = ['type', 'a', 'b', 'k', 'memo', 'by', 'at'];
// 前年度に決定した時に持ち越した組のうち、2人とも今この学年にいて、まだ採用していないもの
function carry_(FY, grade, idset) {
  var key = function (p) { return p.t + ':' + [p.a, p.b].sort().join('-'); }, have = {};
  pairs_(FY, grade).forEach(function (p) { have[key(p)] = 1; });
  return read_('pairs_carry').rows.filter(function (r) { return +r.fy === FY - 1 && idset[String(r.a)] && idset[String(r.b)]; })
    .map(function (r) { return { t: String(r.type), a: String(r.a), b: String(r.b) }; })
    .filter(function (p) { return !have[key(p)]; });
}

// つける・離す・組に固定を、学年ごとにまとめて置き換える
var apiSavePairs = api_(function (grade, pairs) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear(), name = 'pairs_' + FY + '_' + grade;
  if (decisionOf_(FY, grade)) throw userError_('クラス替えを決定したので直せません');
  return withLock_(function () {
    sheet_(db_(), name, PAIR_HEAD);
    removeRows_(name, function (r) { return r._r > 1; });
    append_(name, PAIR_HEAD, (pairs || []).map(function (p) {
      return { type: p.t, a: String(p.a), b: p.t === 'fix' ? '' : String(p.b), k: p.t === 'fix' ? (+p.k) + 1 : '', memo: String(p.memo || ''), by: by, at: new Date().toISOString() };
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
    sheet_(db_(), 'attrs_' + fy, attrsHead_());
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
  var kids = {};
  read_('incident_kids').rows.forEach(function (r) { (kids[r.inc_id] = kids[r.inc_id] || []).push(String(r.id8)); });
  return read_('incidents').rows.filter(function (r) { return !r.deleted && r.inc_id !== ''; }).map(function (r) {
    return { id: +r.inc_id, date: isoDate_(r.date), type: String(r.type), title: String(r.title), url: String(r.url), ids: kids[r.inc_id] || [] };
  });
}
function isoDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

// 配慮項目は編集できる年度だけ（決定前＝今年度、決定後＝来年度）。決定後の今年度は凍結
var apiSetAttr = api_(function (fy, grade, id, k, v) {
  var by = requireTeacher_();
  fy = +fy; grade = +grade; v = +v;
  if (!CONFIG.ATTRS.some(function (at) { return at.k === k; })) throw userError_('項目が違います');
  if (!(v >= 0 && v <= CONFIG.MAX_LEVEL)) throw userError_('値が違います');
  var FY = CONFIG.fiscalYear(), cohortGrade = grade - (fy - FY), dec = decisionOf_(FY, cohortGrade);
  var editable = dec ? FY + 1 : FY;
  if (fy !== editable) throw userError_(fy === FY && dec ? 'クラス替えを決定したので、今年度の値は直せません。準備中の年度を直してください' : 'この年度は直せません');
  return withLock_(function () {
    var name = 'attrs_' + fy;
    sheet_(db_(), name, attrsHead_());
    var t = read_(name), row = null;
    t.rows.forEach(function (r) { if (String(r.id8) === String(id)) row = r; });
    if (row) writeCell_(t, row, k, v);
    else { var o = { id8: String(id) }; o[k] = v; append_(name, attrsHead_(), [o]); }
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
  if (!x || !x.ids || !x.ids.length) throw userError_('関係する児童を選んでください');
  if (!/^https:\/\/(docs|drive)\.google\.com\//.test(String(x.url))) throw userError_('学校のドライブの文書のURLを貼ってください');
  var title = String(x.title || '').trim() || titleOf_(x.url);
  return withLock_(function () {
    var t = read_('incidents'), next = 1;
    t.rows.forEach(function (r) { if (+r.inc_id >= next) next = +r.inc_id + 1; });
    var inc = { inc_id: next, date: String(x.date), type: String(x.type), url: String(x.url), file_id: fileIdOf_(x.url), title: title, by: by, at: new Date(), deleted: '' };
    append_('incidents', TABLES_[3].head, [inc]);
    append_('incident_kids', TABLES_[4].head, x.ids.map(function (id) { return { inc_id: next, id8: String(id) }; }));
    log_(by, 'addIncident', x.ids.length);
    return { id: next, date: inc.date, type: inc.type, title: title, url: inc.url, ids: x.ids.map(String) };
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
    append_('attrs_' + nfy, attrsHead_(), rows.map(function (r) { var o = { id8: r.id }; CONFIG.ATTRS.forEach(function (at) { o[at.k] = r.a[at.k]; }); return o; }));
    append_('pairs_carry', TABLES_[2].head, pairs_(FY, grade).filter(function (p) { return p.t !== 'fix'; })
      .map(function (p) { return { fy: FY, type: p.t, a: p.a, b: p.b }; }));
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
    var n = removeRows_('roster_' + (FY + 1), function (r) { return +r.grade === grade + 1 && ids[String(r.id8)]; });
    removeRows_('attrs_' + (FY + 1), function (r) { return ids[String(r.id8)]; });
    removeRows_('pairs_carry', function (r) { return +r.fy === FY && (ids[String(r.a)] || ids[String(r.b)]); });
    var t = read_('decisions');
    writeCell_(t, t.rows.filter(function (r) { return r._r === dec._r; })[0], 'undone', new Date().toISOString());
    log_(by, 'undoDecide', n);
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
  return { attrs: attrs, types: CONFIG.INCIDENT_TYPES.slice(), teachers: [], keepYears: 0 };
}
function settings_() {
  var d = defaultSettings_(), s = getSetting_('app', {});
  return { attrs: Object.assign(d.attrs, s.attrs || {}), types: s.types && s.types.length ? s.types : d.types,
    teachers: s.teachers || [], keepYears: +s.keepYears || 0 };
}
var apiSettings = api_(function () {
  var email = requireTeacher_(), s = settings_(), me = { email: email, grade: 0, cls: -1 };
  s.teachers.forEach(function (t) { if (String(t.email).toLowerCase() === email) { me.grade = +t.grade; me.cls = (+t.cls) - 1; } });
  return { settings: s, me: me };
});
var apiSaveSettings = api_(function (s) {
  var by = requireTeacher_();
  if (!s || !s.attrs) throw userError_('設定が読めません');
  var clean = { attrs: {}, types: [], teachers: [], keepYears: Math.max(0, Math.min(6, +s.keepYears || 0)) };
  CONFIG.ATTRS.forEach(function (at) {
    var x = s.attrs[at.k] || {};
    var label = String(x.label === undefined ? at.label : x.label).trim().slice(0, 20), ini = String(x.s === undefined ? at.s : x.s).trim().slice(0, 1);
    if (!label || !ini) throw userError_('項目の名前と頭文字は空にできません');
    clean.attrs[at.k] = { label: label, s: ini, w: Math.max(0, Math.min(3, +x.w || 0)) };
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
  return Object.keys(last).filter(function (id) { return !now[id] && FY > last[id].fy + keep; }).map(function (id) {
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
  return withLock_(function () {
    var n = 0;
    db_().getSheets().map(function (sh) { return sh.getName(); }).forEach(function (name) {
      if (/^(roster|attrs)_\d{4}$/.test(name)) n += removeRows_(name, function (r) { return set[String(r.id8)]; });
      else if (/^pairs_/.test(name)) removeRows_(name, function (r) { return set[String(r.a)] || set[String(r.b)]; });
    });
    removeRows_('incident_kids', function (r) { return set[String(r.id8)]; });
    var left = {};
    read_('incident_kids').rows.forEach(function (r) { left[r.inc_id] = 1; });
    var t = read_('incidents');
    t.rows.forEach(function (r) {
      if (!r.deleted && r.inc_id !== '' && !left[r.inc_id]) { writeCell_(t, r, 'title', ''); writeCell_(t, r, 'url', ''); writeCell_(t, r, 'deleted', new Date().toISOString()); }
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

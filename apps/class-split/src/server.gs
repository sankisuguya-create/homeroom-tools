// サーバー（GAS）。scripts/build.py が config.js・engine.js の後ろにつなげて dist/gas/Code.gs を作る。
// 役目は「読み込み（学年ごとに1回）と保存」だけ。計算と描画はブラウザ側（docs/design.md §5）。
// コメントは GAS 上で消えることがあるので、意味を持たせない（principles/gas-javascript-notes.md §1）。

var SERVER_BUILD = '@@BUILD@@';
var DB_PROP = 'CLASS_SPLIT_DB_ID';

// ===== 画面 =====
// タブに出す名前（設定の「アプリの名前」。既定は SSS＝Student Support System。児童の目を引かない略称）
function appName_() { try { return settings_().appName || 'SSS'; } catch (e) { return 'SSS'; } }
// タブのアイコン：GAS は画像を返せないので、所有者のドライブに PNG を置き、その URL を渡す（GitHub など外部の置き場は使わない）
// 画像はこのコードの中に持つ。setup・selfTest が作り、ID を ICON_ID に覚える
var ICON_PNG_B64 = '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';
function ensureIcon_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('ICON_ID');
  var ver = String(ICON_PNG_B64.length) + ICON_PNG_B64.slice(-16); // 画像を替えた版を貼ったら作り直す
  if (id && props.getProperty('ICON_VER') === ver) { try { DriveApp.getFileById(id); return id; } catch (e) { /* 消されていたら作り直す */ } }
  if (id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { /* 前の画像が無くても続ける */ } }
  var f = DriveApp.createFile(Utilities.newBlob(Utilities.base64Decode(ICON_PNG_B64), 'image/png', 'SSS-icon.png'));
  try { f.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  props.setProperty('ICON_ID', f.getId()); props.setProperty('ICON_VER', ver);
  return f.getId();
}
function iconUrl_() { var id = PropertiesService.getScriptProperties().getProperty('ICON_ID'); return id ? 'https://drive.google.com/uc?export=view&id=' + id + '&.png' : ''; }
function doGet() {
  var who = currentTeacher_();
  if (!who.ok || (!accessOf_(who.email).user && !deviceWindowSafe_())) {
    var msg = !who.ok ? 'このページは教員のアカウントで開いてください' : 'このアプリの利用者に登録されていません';
    var sub = !who.ok ? ' では開けません。' : ' は登録されていません。使う場合は、このアプリの管理者に登録を頼んでください。';
    return HtmlService.createHtmlOutput('<!doctype html><html lang="ja"><meta charset="utf-8"><body style="font-family:sans-serif;padding:24px">' +
      '<h1 style="font-size:20px">' + msg + '</h1><p>' + escHtml_(who.email || '（アカウントが分かりません）') + sub + '</p></body></html>')
      .setTitle(appName_());
  }
  var out = HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(appName_())
    .addMetaTag('viewport', 'width=device-width,initial-scale=1');
  try { var u = iconUrl_(); if (u) out.setFaviconUrl(u); } catch (e) { /* アイコンが無くても開く */ }
  return out;
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
// 利用者：教員のドメインで、かつ設定の教員の一覧に載っている人と所有者だけ（ドメインは市内共通なので、ドメインだけでは他校の職員も通る）
// 管理者：所有者と、一覧で管理者に印を付けた人。一覧が空の間は所有者だけが使える
function ownerEmail_() {
  try { return String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase(); } catch (e) { return ''; }
}
function accessOf_(email) {
  email = String(email || '').toLowerCase();
  var owner = ownerEmail_(), isOwner = !!email && email === owner, hit = null;
  var list = [];
  try { list = getSetting_('app', {}).teachers || []; } catch (e) { list = []; }
  list.forEach(function (t) { if (String(t.email || '').trim().toLowerCase() === email) hit = t; });
  return { user: isOwner || !!hit, admin: isOwner || !!(hit && hit.admin), owner: isOwner };
}
function requireTeacher_() {
  var who = currentTeacher_();
  if (!who.ok) throw userError_('教員のアカウントで開いてください');
  var ac = accessOf_(who.email), win = deviceWindow_();
  // 受付の間に開いた教員は、利用者の一覧に足す（一般の受付なら一般、管理者の受付なら管理者）。校務の端末からに限る
  if (win && (!ac.user || (win.role === 'admin' && !ac.admin))) {
    var vd = CONFIG.deviceVerdict(devInfo_(), getSetting_('app', {}).deviceOs);
    if (!vd.ok) throw userError_('DEVICE:この端末は登録できない種類です（' + vd.why.join('、') + '）。校務用のパソコンで開いてください');
    addUserByWindow_(who.email, win.role === 'admin');
    ac = accessOf_(who.email);
  }
  if (!ac.user) throw userError_('このアプリの利用者に登録されていません。管理者に登録を頼んでください');
  checkDevice_(who.email);
  return who.email;
}
function deviceWindowSafe_() { try { return deviceWindow_(); } catch (e) { return null; } }
function addUserByWindow_(email, admin) {
  withLock_(function () {
    var s = getSetting_('app', {}), list = s.teachers || [], hit = null;
    list.forEach(function (t) { if (String(t.email || '').toLowerCase() === email) hit = t; });
    if (hit) hit.admin = hit.admin || admin;
    else list.push({ email: email, grade: 0, cls: 0, admin: admin });
    s.teachers = list; setSetting_('app', s);
    log_(email, admin ? 'addAdminByWindow' : 'addUserByWindow', list.length);
  });
}

// ===== 端末の登録（仮実装） =====
// 登録済みの端末が1台も無い間は制限しない（試験中に締め出さない）。1台でも登録されたら、登録済みの端末だけが読み書きできる。
// 管理者が受付を開くと、その間（10分）にアクセスした端末を自動で登録する。合い言葉は端末にだけ置き、サーバーはハッシュだけを持つ
var DEVICE_WINDOW_MIN = 10, DEVICE_CHECKED_ = '';
function hashHex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
    .map(function (b) { return ((b + 256) % 256).toString(16); }).map(function (h) { return h.length < 2 ? '0' + h : h; }).join('');
}
function devices_() { return getSetting_('devices', []); }
function deviceWindow_() { var w = getSetting_('devwin', {}); return w.until && new Date(w.until).getTime() > Date.now() ? w : null; }
function devInfo_() {
  var d = DEV_ || {};
  return { os: String(d.os || '不明').slice(0, 20), mobile: !!d.mobile, touch: +d.touch || 0, screen: String(d.screen || '').slice(0, 20) };
}
function checkDevice_(email) {
  if (DEVICE_CHECKED_ === email) return;
  var list = devices_();
  if (!list.length && !deviceWindow_()) { DEVICE_CHECKED_ = email; return; }
  var t = DEV_ && DEV_.t ? String(DEV_.t) : '', h = t ? hashHex_(t) : '', hit = null, info = devInfo_();
  list.forEach(function (x) { if (h && x.h === h && !x.revoked) hit = x; });
  if (hit) {
    // 合い言葉を写して別の種類の端末で使った時（例：携帯電話）は断る
    if (hit.os !== info.os) throw userError_('DEVICE:この端末の種類（' + info.os + '）は、登録した時（' + hit.os + '）と違います');
    if (!hit.last || Date.now() - new Date(hit.last).getTime() > 6 * 3600000) withLock_(function () {
      var l = devices_(); l.forEach(function (x) { if (x.h === h) x.last = new Date().toISOString(); }); setSetting_('devices', l);
    });
    DEVICE_CHECKED_ = email; return;
  }
  var win = deviceWindow_();
  if (win) {
    var vd = CONFIG.deviceVerdict(info, getSetting_('app', {}).deviceOs);
    if (!vd.ok) throw userError_('DEVICE:この端末は登録できない種類です（' + vd.why.join('、') + '）。校務用のパソコンで開いてください');
    registerDevice_(email, info, win.role === 'admin' ? 'window-admin' : 'window');
    DEVICE_CHECKED_ = email; return;
  }
  if (!list.length) { DEVICE_CHECKED_ = email; return; }
  throw userError_('DEVICE:この端末は登録されていません');
}
function registerDevice_(email, info, how) {
  var t = Utilities.getUuid() + Utilities.getUuid();
  withLock_(function () {
    var l = devices_();
    l.push({ id: Utilities.getUuid().slice(0, 8), h: hashHex_(t), by: email, at: new Date().toISOString(), last: new Date().toISOString(), os: info.os, touch: info.touch, screen: info.screen, how: how });
    setSetting_('devices', l);
    log_(email, 'registerDevice', l.length);
  });
  DEV_NEW_ = t; // 画面がこれを端末に保存する（返すのはこの1回だけ）
}
var apiDevices_ = api_(function () {
  requireAdmin_();
  var w = deviceWindow_();
  return { list: devices_().filter(function (x) { return !x.revoked; }).map(function (x) { return { id: x.id, by: x.by, at: x.at, last: x.last, os: x.os, touch: x.touch, screen: x.screen, how: x.how }; }),
    window: w ? { until: w.until, by: w.by, role: w.role || 'user' } : null, mine: DEV_ && DEV_.t ? (devices_().filter(function (x) { return x.h === hashHex_(DEV_.t); })[0] || {}).id || '' : '' };
});
var apiOpenDeviceWindow_ = api_(function (role) {
  var by = requireAdmin_();
  role = role === 'admin' ? 'admin' : 'user';
  var h0 = DEV_ && DEV_.t ? hashHex_(DEV_.t) : '';
  if (!devices_().some(function (x) { return h0 && x.h === h0 && !x.revoked; })) {
    // 受付を開く端末も校務の端末に限る（管理者の携帯電話が登録されないように）
    var vd = CONFIG.deviceVerdict(devInfo_(), getSetting_('app', {}).deviceOs);
    if (!vd.ok) throw userError_('この端末からは受付を開けません（' + vd.why.join('、') + '）。校務用のパソコンで開いてください');
  }
  withLock_(function () { setSetting_('devwin', { until: new Date(Date.now() + DEVICE_WINDOW_MIN * 60000).toISOString(), by: by, role: role }); log_(by, role === 'admin' ? 'openAdminWindow' : 'openDeviceWindow', DEVICE_WINDOW_MIN); });
  // 開いた管理者の端末がまだ未登録なら、ここで登録する（受付を開いた端末が締め出されないように）
  var h = DEV_ && DEV_.t ? hashHex_(DEV_.t) : '';
  if (!devices_().some(function (x) { return h && x.h === h && !x.revoked; })) registerDevice_(by, devInfo_(), 'admin');
  return { until: deviceWindow_().until };
});
var apiCloseDeviceWindow_ = api_(function () {
  var by = requireAdmin_();
  withLock_(function () { setSetting_('devwin', null); log_(by, 'closeDeviceWindow', 0); });
  return { ok: true };
});
var apiRevokeDevice_ = api_(function (id) {
  var by = requireAdmin_();
  withLock_(function () {
    var l = devices_().filter(function (x) { return x.id !== String(id); });
    setSetting_('devices', l); log_(by, 'revokeDevice', l.length);
  });
  return { ok: true };
});
// 締め出された時の安全弁：スクリプトのエディタで所有者が実行すると、端末の登録をすべて消す（制限が外れ、登録し直しになる）
// エディタ（とトリガー）から所有者が実行する関数の門番。名前が _ で終わらない大域の関数は、画面の google.script.run から誰でも呼べるため
// （principles/gas-javascript-notes.md）。エディタ・トリガーでは開いている人＝所有者か空、画面からは呼んだ教員になる
function editorOnly_() {
  var a = '';
  try { a = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (e) { a = ''; }
  if (a && a !== ownerEmail_()) throw new Error('この関数は、所有者がスクリプトのエディタで実行してください');
}
function resetDevices() { editorOnly_(); forget_(); withLock_(function () { setSetting_('devices', null); setSetting_('devwin', null); log_(ownerEmail_(), 'resetDevices', 0); }); return 'reset'; }
function requireAdmin_() {
  var email = requireTeacher_();
  if (!accessOf_(email).admin) throw userError_('この操作は管理者だけができます');
  return email;
}
// 再試行しても直らない誤り（画面は再試行せずに表示する）
function userError_(msg) { return new Error('USER:' + msg); }
function escHtml_(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

// ===== データの置き場 =====
// 専用のスプレッドシート。初回は setup() を所有者が実行して作る（教員には共有しない）
function setup() {
  editorOnly_();
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(DB_PROP);
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('クラス替え（データ）');
  props.setProperty(DB_PROP, ss.getId());
  TABLES_.forEach(function (t) { sheet_(ss, t.name, t.head); });
  var fy = CONFIG.fiscalYear();
  sheet_(ss, 'roster_' + fy, ROSTER_HEAD);
  sheet_(ss, 'attrs_' + fy, attrsHead_());
  ensureWeeklyTrigger_();
  try { ensureIcon_(); } catch (e) { /* アイコンは selfTest で確かめる */ }
  return ss.getUrl();
}
var ROSTER_HEAD = ['id8', 'name', 'kana', 'sex', 'grade', 'class', 'no', 'addr', 'area', 'birth']; // addr：住所の全文、area：町名（地区の偏りに使う）
var TABLES_ = [
  { name: 'settings', head: ['key', 'json'] },
  { name: 'decisions', head: ['fy', 'grade', 'plan', 'by', 'at', 'undone', 'names'] }, // names：A組から順の組の番号（例 2,1,3）。空＝仮（A組＝1組…）
  { name: 'pairs_carry', head: ['fy', 'type', 'a', 'b', 'memo', 'tags', 'incs', 'since'] },
  // diagram：関係図（児童IDとグループの記号だけ。氏名は入れない）。role：関係図から決めた役割（harm・victim・mutual・related）
  { name: 'incidents', head: ['inc_id', 'date', 'type', 'url', 'file_id', 'title', 'by', 'at', 'deleted', 'diagram', 'date_end', 'detail', 'report'] },
  { name: 'incident_kids', head: ['inc_id', 'id8', 'role'] },
  { name: 'log', head: ['at', 'by', 'action', 'n'] },
  // 新年度の転入生：クラス分けに加え、決定で来年度の名簿に入れる。grade は今年度の学年（その学年のクラス分けに入る）
  { name: 'transfers', head: ['fy', 'grade', 'id8', 'name', 'kana', 'sex', 'by', 'at'] },
  // 目安箱：アプリへの意見。送った人は残さない（at・開いていた画面・本文だけ）
  { name: 'suggestions', head: ['at', 'screen', 'text'] },
  // 転出児童：出戻りに備えて残す（転出した年度・その時の学年と組）。年度替わりの削除で消える
  { name: 'left', head: ['fy', 'grade', 'id8', 'name', 'kana', 'sex', 'cls', 'no', 'addr', 'area', 'at', 'by', 'birth'] }
];
// side の項目（ア・身・通）は内容の文字も持つ（列名は k5_t など）
function attrsHead_() {
  var h = ['id8'].concat(CONFIG.ATTRS.map(function (at) { return at.k; }));
  CONFIG.ATTRS.forEach(function (at) { if (at.side || at.ctx) h.push(at.k + '_t'); if (at.ctx) h.push(at.k + '_i'); }); // _t＝内容・経緯の文、_i＝紐付けた事案の番号
  h.push('sp'); // 特別支援学級の児童（1＝在籍）。クラス分けでは人数の計算と自動の案づくりから外し、交流級を手で選ぶ
  h.push('spn'); // 特別支援学級の名前（校務システムの名簿の「組」の文字。例：ひまわり）
  h.push('memo'); // 備考（自由記述）。決定で来年度に写す
  h.push('sib'); // 兄弟（JSON の並び。CONFIG.normSibs の形）。決定で来年度に写す時は学年を1つ上げる
  return h;
}
// シートに書く文字：= + - @ で始まると式として読まれるので、先頭に ' を付けて文字のまま残す
function plainText_(s, max) { s = String(s == null ? '' : s).slice(0, max || 200); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }

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
    forget_(); sh = ss.insertSheet(name);
    if (head) sh.getRange(1, 1, 1, head.length).setValues([head]);
  }
  return sh;
}
// 表を読む：見出しの名前で列を引く。無い表は空
// 1回の呼び出しの間だけ、読んだ表を覚える（設定などを何度も読むのを省く）。
// 何かを書いたら全部忘れ、ロックを取った時も忘れる（ロックの前に読んだ古い値で判断しない）
var READ_ = {};
function forget_() { READ_ = {}; }
function read_(name) {
  if (READ_[name]) return READ_[name];
  return (READ_[name] = readNow_(name));
}
function readNow_(name) {
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
  if (miss.length) { forget_(); sh.getRange(1, cur[0] ? w + 1 : 1, 1, miss.length).setValues([miss]); }
  return sh;
}
function rowOf_(head, o) { return head.map(function (h) { return o[h] === undefined ? '' : o[h]; }); }
// 児童IDの列（と生年月日）は「書式なしテキスト」にしてから書く。スプレッドシートは数字だけの文字を数値に変え、先頭の0を落とす（0012 → 12）。
// 落ちると次の取り込みで別の児童として二重に足される。書く列ごとに書式を当てる（古い表にも効く）
var TEXT_COLS_ = { id8: 1, a: 1, b: 1, birth: 1 };
function textCols_(sh, cols, r0, n) {
  cols.forEach(function (c, i) { if (TEXT_COLS_[c]) sh.getRange(r0, i + 1, n, 1).setNumberFormat('@'); });
}
function append_(name, head, objs) {
  if (!objs.length) return;
  var sh = sheet_(db_(), name, head);
  var cur = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  if (!cur[0]) cur = head;
  textCols_(sh, cur, sh.getLastRow() + 1, objs.length);
  forget_(); sh.getRange(sh.getLastRow() + 1, 1, objs.length, cur.length).setValues(objs.map(function (o) { return rowOf_(cur, o); }));
}
// 書き戻しは変えた行の変えた列だけ（同時に別の行を直している人を上書きしない）
function writeCell_(t, row, col, value) {
  var c = t.head.indexOf(col);
  if (c < 0) throw new Error('列がありません：' + col);
  if (TEXT_COLS_[col]) t.sh.getRange(row._r, c + 1).setNumberFormat('@');
  forget_(); t.sh.getRange(row._r, c + 1).setValue(value);
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw userError_('ほかの人が保存中です。少し待ってからもう一度');
  forget_();
  try { return fn(); } finally { lock.releaseLock(); }
}
function log_(by, action, n) { append_('log', TABLES_[5].head, [{ at: new Date(), by: by, action: action, n: n }]); }

function getSetting_(key, def) {
  var t = read_('settings');
  for (var i = 0; i < t.rows.length; i++) if (t.rows[i].key === key) { try { return JSON.parse(t.rows[i].json); } catch (e) { return def; } }
  return def;
}
function setSetting_(key, value) {
  if (value === null) { removeRows_('settings', function (r) { return r.key === key; }); return; } // 空にする時は行ごと消す（行が増え続けない）
  var t = read_('settings');
  for (var i = 0; i < t.rows.length; i++) if (t.rows[i].key === key) { writeCell_(t, t.rows[i], 'json', JSON.stringify(value)); return; }
  append_('settings', TABLES_[0].head, [{ key: key, json: JSON.stringify(value) }]);
}

// ===== 名簿・配慮項目の読み出し =====
function rosterRows_(fy) {
  return read_('roster_' + fy).rows.filter(function (r) { return String(r.id8); }).map(function (r) {
    return { id: String(r.id8), name: String(r.name), kana: String(r.kana || ''), male: String(r.sex) === '男',
      grade: +r.grade, cls: (+r['class']) - 1, no: +r.no, addr: String(r.addr || ''), area: String(r.area || ''), birth: dateText_(r.birth) };
  });
}
// 生年月日：シートが日付として読んだ時も 2018/4/2 の形の文字にそろえる
function dateText_(v) { if (v instanceof Date) return v.getFullYear() + '/' + (v.getMonth() + 1) + '/' + v.getDate(); return String(v || ''); }
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
    if (r.spn) a.spn = String(r.spn);
    if (r.memo) a.memo = String(r.memo);
    if (r.sib) { var sb = CONFIG.normSibs(String(r.sib)); if (sb.length) a.sib = sb; }
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
// 画面は呼び出しの最後に端末の情報 { __dev: { t: 合い言葉, os, mobile, touch, screen } } を添える（端末の登録）。ここで外して DEV_ に置く
var DEV_ = null, DEV_NEW_ = '';
function api_(fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments);
    var last = args[args.length - 1];
    DEV_ = last && typeof last === 'object' && last.__dev ? args.pop().__dev : null; DEV_NEW_ = ''; DEVICE_CHECKED_ = '';
    forget_();
    var t0 = Date.now();
    try { var v = fn.apply(null, args); return JSON.stringify({ ok: true, build: SERVER_BUILD, v: v, dev: DEV_NEW_ || undefined, ms: Date.now() - t0 }); } // ms：サーバーでかかった時間（遅い時の手がかり）
    catch (e) {
      var m = String(e && e.message || e), dev = m.indexOf('USER:DEVICE:') === 0;
      return JSON.stringify({ ok: false, build: SERVER_BUILD, user: m.indexOf('USER:') === 0, device: dev, err: m.replace(/^USER:(DEVICE:)?/, ''), dev: DEV_NEW_ || undefined }); // 登録の後で失敗しても、合い言葉は端末に渡す
    }
  };
}

// fy：見る年度（省略は今年度）。今年度は新1年〜6年、ほかの年度は1〜6年。決定の印は今年度だけ
var apiListGrades_ = api_(function (fy0) {
  requireTeacher_();
  var FY = CONFIG.fiscalYear(), fy = +fy0 || FY, by = {};
  rosterRows_(fy).forEach(function (r) {
    var g = by[r.grade] = by[r.grade] || { grade: r.grade, count: 0, classes: 0, decided: false };
    g.count++; if (r.cls + 1 > g.classes) g.classes = r.cls + 1;
  });
  Object.keys(by).forEach(function (g) { by[g].decided = fy === FY && !!decisionOf_(fy, +g); });
  var out = [];
  CONFIG.GRADES.forEach(function (g) { if (g === 0 && fy !== FY) return; out.push(by[g] || { grade: g, count: 0, classes: 0, decided: false }); });
  return out;
});
// メニューで選べる年度：名簿のある年度と、今年度・来年度
var apiRosterYears_ = api_(function () {
  requireTeacher_();
  var FY = CONFIG.fiscalYear(), set = {}; set[FY] = 1; set[FY + 1] = 1;
  rosterSheets_().forEach(function (fy) { set[fy] = 1; });
  return Object.keys(set).map(Number).sort();
});

var apiBoot_ = api_(function (grade) {
  readLog_('boot', +grade);
  requireTeacher_();
  grade = +grade;
  if (!(grade >= -1 && grade <= 12)) throw userError_('学年が違います'); // 新1年（0）〜過去の年度の卒業した学年まで
  var FY = CONFIG.fiscalYear(), entry = FY - grade + 1, years = [], kids = {}, idset = {};
  for (var fy = Math.min(entry, FY); fy <= FY + 1; fy++) { // 新1年（grade 0）は今年度の0学年から
    var gy = fy - entry + 1, am = attrsMap_(fy);
    var rows = rosterRows_(fy).filter(function (r) { return r.grade === gy; });
    if (!rows.length) continue;
    years.push({ fy: fy, grade: gy, rows: rows.map(function (r) {
      kids[r.id] = { id: r.id, name: r.name, kana: r.kana, male: r.male, area: r.area, addr: r.addr, birth: r.birth };
      idset[r.id] = 1;
      return { id: r.id, cls: r.cls, no: r.no, a: am[r.id] || emptyAttrs_() };
    }) });
  }
  // 兄弟の学年：結び付いた兄弟の児童は、今年度の名簿の学年を使う（年度が替われば自動で上がる）。名前も名簿のものに
  var nowG = {}; rosterRows_(FY).forEach(function (r) { nowG[r.id] = r; });
  years.forEach(function (y) { y.rows.forEach(function (r) { (r.a.sib || []).forEach(function (s) { var k = s.id && nowG[s.id]; if (k) { s.g = k.grade + (y.fy - FY); s.n = String(k.name).replace(/[<>&"'`]/g, '').slice(0, 20); } }); }); });
  var incs = incidents_().filter(function (x) { return x.ids.some(function (id) { return idset[id]; }); });
  var dec = decisionOf_(FY, grade);
  return {
    fy: FY, grade: grade, years: years, kids: kids, incidents: incs,
    pairs: pairs_(FY, grade),
    carry: carry_(FY, grade, idset),
    transfers: transfers_(FY, grade),
    plans: getSetting_('plans_' + FY + '_' + grade, { ver: 0, plans: [] }),
    scores: scoresOf_(years),
    pairsVer: (getSetting_('pairsver_' + FY + '_' + grade, { ver: 0 }).ver) || 0,
    decision: dec ? { plan: String(dec.plan), at: String(dec.at), names: namesOf_(dec, FY, grade), named: !!String(dec.names || '') } : null
  };
});
function transfers_(fy, grade) {
  return read_('transfers').rows.filter(function (r) { return +r.fy === fy && +r.grade === grade && String(r.id8); }).map(function (r) {
    return { id: String(r.id8), name: String(r.name), kana: String(r.kana), male: String(r.sex) === '男' };
  });
}
// 転入生を足す：児童IDが分からなければ仮のID（T＋数字）。名簿の児童IDと重なれば断る
var apiAddTransfer_ = api_(function (grade, x) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear();
  var name = String(x && x.name || '').trim(), kana = String(x && x.kana || '').trim(), id = String(x && x.id || '').trim();
  if (!name) throw userError_('名前を入れてください');
  if (id && !CONFIG.isKidId(id)) throw userError_('児童IDは英数字20文字までです（分からなければ空のまま）');
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
var apiRemoveTransfer_ = api_(function (grade, id) {
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
// 版つき（案と同じ）：読み込んだ時の版と違えば、ほかの先生が先に保存したので上書きしない
var apiSavePairs_ = api_(function (grade, pairs, baseVer) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear(), name = 'pairs_' + FY + '_' + grade, vkey = 'pairsver_' + FY + '_' + grade;
  return withLock_(function () {
    if (decisionOf_(FY, grade)) throw userError_('クラス替えを決定したので直せません'); // 決定と同時に保存しても、決定の後は書かない
    var cur = getSetting_(vkey, { ver: 0 });
    if (baseVer != null && (+baseVer || 0) !== (+cur.ver || 0)) return { conflict: true, ver: cur.ver, by: cur.by || '' };
    setSetting_(vkey, { ver: (+cur.ver || 0) + 1, by: by });
    sheet_(db_(), name, PAIR_HEAD); ensureCols_(name, PAIR_HEAD);
    removeRows_(name, function (r) { return r._r > 1; });
    append_(name, PAIR_HEAD, (pairs || []).map(function (p) {
      return Object.assign({ type: p.t, a: String(p.a), b: p.t === 'fix' ? '' : String(p.b), k: p.t === 'fix' ? (+p.k) + 1 : '', by: by, at: new Date().toISOString() }, pairCells_(p, grade));
    }));
    return { n: (pairs || []).length, ver: (+cur.ver || 0) + 1 };
  });
});

// 名簿を入れる：同じ児童IDは上書き（配慮項目の値は残す）、新しいIDは足す。貼った中にいない児童は知らせるだけ（消さない）
// opt.dry：書かずに差分だけ返す（取り込む前の確認）。書く時は直前にデータの控えを取る
var apiImportRoster_ = api_(function (fy, grade, rows, opt) {
  var by = requireTeacher_();
  fy = +fy; grade = +grade; opt = opt || {};
  var FY = CONFIG.fiscalYear();
  if (fy !== FY && fy !== FY + 1) throw userError_('今年度か来年度の名簿だけ入れられます');
  if (!rows || !rows.length) throw userError_('児童がいません');
  if (grade < 0 || grade > 6) throw userError_('学年が違います');
  if (opt.dry) return importDiff_(fy, grade, rows);
  var bkErr = tryBackup_('名簿の取り込みの前');
  return withLock_(function () {
    var name = 'roster_' + fy;
    ensureCols_(name, ROSTER_HEAD); // 住所の列が無い古い名簿にも足す
    ensureCols_('attrs_' + fy, attrsHead_());
    var t = read_(name), byId = {}, added = [], updated = 0, classes = {}, ids = {};
    t.rows.forEach(function (r) { byId[String(r.id8)] = r; });
    // 新1年は児童IDが無くてよい（仮のIDを振る）。8桁の番号で貼り直した時は、仮のIDの児童と名前で照らして付け替える
    var relinked = relinkTempIds_(fy, grade, rows, t);
    if (relinked) { t = read_(name); byId = {}; t.rows.forEach(function (r) { byId[String(r.id8)] = r; }); }
    var nextTemp = tempIdSeq_(fy);
    rows.forEach(function (x) {
      if (!String(x.id || '') && (grade === 0 || opt.temp)) x.id = 'N' + fy + ('00' + (nextTemp++)).slice(-3); // 新1年と、名簿の画面の転入（児童IDが分からない時）は仮の番号
      var id = String(x.id);
      if (!CONFIG.isKidId(id)) throw userError_(grade === 0 ? '児童IDは英数字20文字までか、空のままにしてください' : '児童IDが読めない行があります（英数字20文字まで）');
      classes[+x.cls] = 1; ids[id] = 1;
      var o = { id8: id, name: plainText_(x.name, 40), kana: plainText_(x.kana || '', 60), sex: x.male ? '男' : (x.sex || '女'), grade: grade, 'class': (+x.cls) + 1, no: +x.no,
        addr: plainText_(String(x.addr || ''), 200), area: plainText_(String(x.area || ''), 40), birth: plainText_(String(x.birth || ''), 20) };
      var r = byId[id];
      // 住所は、貼った表に住所があった時だけ書き換える（住所の無い名簿を貼り直しても消さない）
      if (r) { ['name', 'kana', 'sex', 'grade', 'class', 'no'].concat(x.addr ? ['addr', 'area'] : []).concat(x.birth ? ['birth'] : []).forEach(function (c) { if (String(r[c]) !== String(o[c])) writeCell_(t, r, c, o[c]); }); updated++; }
      else added.push(o);
    });
    append_(name, ROSTER_HEAD, added);
    // 兄弟（校務システムの「学年-組-番号 名前」）：続柄が分からない（'?'）兄弟は、今年度の名簿の同じ学年・組・番号の児童の性別で決める。配慮項目の表の sib に書く
    var sibRows = rows.filter(function (x) { return x.sib && x.sib.length; });
    if (sibRows.length) {
      var at0 = {}, FY0 = CONFIG.fiscalYear();
      var id0 = {};
      rosterRows_(FY0).forEach(function (r) { var k = r.grade + '-' + (r.cls + 1) + '-' + r.no; at0[k] = r.male ? '男' : '女'; id0[k] = r.id; });
      var atS = read_('attrs_' + fy), arS = {}, newS = [];
      atS.rows.forEach(function (r) { arS[String(r.id8)] = r; });
      sibRows.forEach(function (x) {
        var list = CONFIG.normSibs(x.sib.map(function (s) {
          var r = s.r;
          if (r === '?') { var sx = at0[s.g + '-' + s.cls + '-' + s.no], older = +s.g >= grade; r = sx === '女' ? (older ? '姉' : '妹') : (older ? '兄' : '弟'); } // 分からなければ兄・弟（画面で直せる）
          return { r: r, g: s.g, n: s.n, id: s.id || id0[s.g + '-' + s.cls + '-' + s.no] || '' }; // 兄弟の児童に結び付ける（学年は名簿から読む）
        }));
        var val = JSON.stringify(list), r0 = arS[String(x.id)];
        if (r0) { if (String(r0.sib || '') !== val) writeCell_(atS, r0, 'sib', val); }
        else newS.push({ id8: String(x.id), sib: val });
      });
      append_('attrs_' + fy, attrsHead_(), newS);
    }
    // 特別支援学級の児童：配慮項目の表に「特別支援学級」の印と学級の名前を書く（組は交流級）
    var sps = rows.filter(function (x) { return x.sp; });
    if (sps.length) {
      var at = read_('attrs_' + fy), arow = {};
      at.rows.forEach(function (r) { arow[String(r.id8)] = r; });
      var newA = [];
      sps.forEach(function (x) {
        var id = String(x.id), spn = plainText_(String(x.sp).slice(0, 20), 20), r = arow[id];
        if (r) { if (+r.sp !== 1) writeCell_(at, r, 'sp', 1); if (String(r.spn || '') !== spn) writeCell_(at, r, 'spn', spn); }
        else newA.push({ id8: id, sp: 1, spn: spn });
      });
      append_('attrs_' + fy, attrsHead_(), newA);
    }
    var missing = t.rows.filter(function (r) { return +r.grade === grade && classes[(+r['class']) - 1] && !ids[String(r.id8)]; }).map(function (r) { return String(r.name); });
    log_(by, 'importRoster', rows.length);
    return { added: added.length, updated: updated, missing: missing, relinked: relinked, backupError: bkErr };
  });
});

// 仮のIDの次の番号（その年度の名簿にある N＋年度 の最大＋1）
function tempIdSeq_(fy) {
  var max = 0, pre = 'N' + fy;
  read_('roster_' + fy).rows.forEach(function (r) { var id = String(r.id8); if (id.indexOf(pre) === 0) max = Math.max(max, +id.slice(pre.length) || 0); });
  return max + 1;
}
function normName_(s) { return String(s || '').replace(/[\s　]/g, ''); }
// 8桁の番号の児童を、同じ学年の仮のIDの児童と名前（とよみ）で照らし、一意に合えば仮のIDを8桁に付け替える。付け替えた人数を返す
function relinkTempIds_(fy, grade, rows, t) {
  var temps = t.rows.filter(function (r) { return +r.grade === grade && CONFIG.isTempId(r.id8); });
  if (!temps.length) return 0;
  var have = {}; t.rows.forEach(function (r) { have[String(r.id8)] = 1; });
  var map = {};
  rows.forEach(function (x) {
    var id = String(x.id || '');
    if (!CONFIG.isKidId(id) || CONFIG.isTempId(id) || have[id]) return;
    var hit = temps.filter(function (r) { return normName_(r.name) === normName_(x.name) && (!x.kana || !r.kana || normName_(r.kana) === normName_(x.kana)); });
    if (hit.length === 1 && !map[String(hit[0].id8)]) map[String(hit[0].id8)] = id;
  });
  var n = Object.keys(map).length;
  if (n) replaceIds_(fy, map);
  return n;
}
// 児童IDを付け替える：その年度の名簿・配慮項目、持ち越し、事案との結び付き、転入生
function replaceIds_(fy, map) {
  var sw = function (name, cols) {
    var t = read_(name); if (!t.sh) return;
    t.rows.forEach(function (r) { cols.forEach(function (c) { var v = String(r[c]); if (map[v]) writeCell_(t, r, c, map[v]); }); });
  };
  sw('roster_' + fy, ['id8']); sw('attrs_' + fy, ['id8']); sw('pairs_carry', ['a', 'b']); sw('incident_kids', ['id8']);
}

// 名簿から外す：転出した児童（配慮項目・経緯は過年度の記録として残し、年度替わりで消す）と、誤って登録した児童（その年度の配慮項目も消す）。
// 直せる年度（決定前は今年度、決定後は来年度）だけ。外す前に控えを取る
var apiRemoveKids_ = api_(function (fy, grade, ids, reason) {
  var by = reason === 'mistake' ? requireAdmin_() : requireTeacher_(); // 誤登録の削除（配慮項目も消える）は管理者だけ
  fy = +fy; grade = +grade; ids = (ids || []).map(String).filter(Boolean);
  if (!ids.length) throw userError_('外す児童を選んでください');
  var FY = CONFIG.fiscalYear(), cohort = grade - (fy - FY);
  var editable = decisionOf_(FY, cohort) ? FY + 1 : FY;
  if (fy !== editable) throw userError_('この年度の名簿は直せません');
  var set = {}; ids.forEach(function (id) { set[id] = 1; });
  var bkErr = tryBackup_('名簿から外す前');
  var n = withLock_(function () {
    if (reason !== 'mistake') { // 転出：出戻りに備えて転出児童の一覧に残す（同じ児童の古い行は置き換える）
      var keep = rosterRows_(fy).filter(function (r) { return r.grade === grade && set[r.id]; });
      removeRows_('left', function (r) { return set[String(r.id8)]; });
      ensureCols_('left', TABLES_[8].head); // 生年月日の列が無い古い表にも足す
      append_('left', TABLES_[8].head, keep.map(function (r) { return { fy: fy, grade: grade, id8: r.id, name: plainText_(r.name, 40), kana: plainText_(r.kana, 60), sex: r.male ? '男' : '女', cls: r.cls + 1, no: r.no, addr: plainText_(r.addr, 200), area: plainText_(r.area, 40), at: new Date().toISOString(), by: by, birth: plainText_(r.birth, 20) }; }));
    }
    var k = removeRows_('roster_' + fy, function (r) { return +r.grade === grade && set[String(r.id8)]; });
    if (reason === 'mistake') removeRows_('attrs_' + fy, function (r) { return set[String(r.id8)]; });
    if (fy === FY) removeRows_('pairs_' + FY + '_' + cohort, function (r) { return set[String(r.a)] || set[String(r.b)]; });
    log_(by, reason === 'mistake' ? 'removeMistake' : 'removeLeave', k);
    return k;
  });
  return { n: n, backupError: bkErr };
});

// 転出児童：この学年（今の学年に直して）に当たる児童。転出した年度から学年を進めて数える
function leftOf_(fy, grade) {
  return read_('left').rows.filter(function (r) { return String(r.id8) && +r.grade + (fy - +r.fy) === grade; }).map(function (r) {
    return { id: String(r.id8), name: String(r.name), kana: String(r.kana), male: String(r.sex) === '男', leftFy: +r.fy, leftGrade: +r.grade, cls: +r.cls - 1, no: +r.no, at: String(r.at) };
  });
}
var apiLeftKids_ = api_(function (fy, grade) { requireTeacher_(); return leftOf_(+fy, +grade); });
// 出戻り：転出児童を、同じ児童IDで名簿に戻す（番号は組の最後）。戻す年度に配慮項目の行が無ければ、転出した年度の行を写す
var apiRestoreKid_ = api_(function (fy, grade, id, cls) {
  var by = requireTeacher_();
  fy = +fy; grade = +grade; cls = +cls; id = String(id);
  if (!(cls >= 0 && cls < CONFIG.MAX_CLASSES)) throw userError_('組が違います');
  var FY = CONFIG.fiscalYear(), cohort = grade - (fy - FY);
  if (fy !== (decisionOf_(FY, cohort) ? FY + 1 : FY)) throw userError_('この年度の名簿は直せません');
  return withLock_(function () {
    var lr = read_('left').rows.filter(function (r) { return String(r.id8) === id; })[0];
    if (!lr) throw userError_('転出児童の一覧にいません');
    var name = 'roster_' + fy;
    ensureCols_(name, ROSTER_HEAD);
    var t = read_(name), max = 0, dup = false;
    t.rows.forEach(function (r) { if (String(r.id8) === id) dup = true; if (+r.grade === grade && +r['class'] === cls + 1 && +r.no > max) max = +r.no; });
    if (dup) throw userError_('すでに名簿にいます');
    append_(name, ROSTER_HEAD, [{ id8: id, name: String(lr.name), kana: String(lr.kana), sex: String(lr.sex), grade: grade, 'class': cls + 1, no: max + 1, addr: String(lr.addr || ''), area: String(lr.area || ''), birth: dateText_(lr.birth) }]);
    ensureCols_('attrs_' + fy, attrsHead_());
    var has = read_('attrs_' + fy).rows.some(function (r) { return String(r.id8) === id; });
    if (!has && +lr.fy !== fy) {
      var src = read_('attrs_' + (+lr.fy)).rows.filter(function (r) { return String(r.id8) === id; })[0];
      if (src) { var o = {}; attrsHead_().forEach(function (h) { if (src[h] !== undefined && src[h] !== '') o[h] = src[h]; }); o.id8 = id; append_('attrs_' + fy, attrsHead_(), [o]); }
    }
    removeRows_('left', function (r) { return String(r.id8) === id; });
    log_(by, 'restoreKid', 1);
    return { cls: cls, no: max + 1 };
  });
});

// 名前・よみ・組・番号を直す（名簿の画面の ✎）。直せる年度だけ。児童IDは変えない
var apiUpdateKid_ = api_(function (fy, grade, id, x) {
  var by = requireTeacher_();
  fy = +fy; grade = +grade; id = String(id); x = x || {};
  var name = String(x.name || '').trim(), cls = +x.cls, no = +x.no;
  if (!name) throw userError_('名前を入れてください');
  if (!(cls >= -1 && cls < CONFIG.MAX_CLASSES)) throw userError_('組が違います'); // -1＝クラスなし
  if (!(no >= 1 && no <= 99)) throw userError_('出席番号は1〜99にしてください');
  var FY = CONFIG.fiscalYear(), cohort = grade - (fy - FY);
  if (fy !== (decisionOf_(FY, cohort) ? FY + 1 : FY)) throw userError_('この年度の名簿は直せません');
  return withLock_(function () {
    var t = read_('roster_' + fy), row = null;
    t.rows.forEach(function (r) { if (+r.grade === grade && String(r.id8) === id) row = r; });
    if (!row) throw userError_('名簿にいない児童です');
    ensureCols_('roster_' + fy, ROSTER_HEAD); t = read_('roster_' + fy); t.rows.forEach(function (r) { if (+r.grade === grade && String(r.id8) === id) row = r; });
    var o = { name: plainText_(name, 40), kana: plainText_(String(x.kana || '').trim(), 60), 'class': cls + 1, no: no };
    // 性別・生年月日・住所・町名は、送られてきた時だけ書く（古い画面から送られても消さない）
    if (x.male !== undefined) o.sex = x.male ? '男' : '女';
    ['birth', 'addr', 'area'].forEach(function (k) { if (x[k] !== undefined) o[k] = plainText_(String(x[k] || '').trim(), k === 'addr' ? 200 : 40); });
    Object.keys(o).forEach(function (c) { if (String(row[c] == null ? '' : row[c]) !== String(o[c])) writeCell_(t, row, c, o[c]); });
    // 特別支援学級（配慮項目の表の sp・spn）
    if (x.sp !== undefined) {
      ensureCols_('attrs_' + fy, attrsHead_());
      var at = read_('attrs_' + fy), ar = null; at.rows.forEach(function (r) { if (String(r.id8) === id) ar = r; });
      var sp = x.sp ? 1 : '', spn = x.sp ? plainText_(String(x.spn || '').trim(), 20) : '';
      if (ar) { if (String(ar.sp || '') !== String(sp)) writeCell_(at, ar, 'sp', sp); if (String(ar.spn || '') !== spn) writeCell_(at, ar, 'spn', spn); }
      else if (sp) append_('attrs_' + fy, attrsHead_(), [{ id8: id, sp: 1, spn: spn }]);
    }
    log_(by, 'updateKid', 1);
    return { ok: true };
  });
});

// 組を移す（特別支援学級の児童の交流級を振り分ける）：番号はその組の最後。直せる年度だけ
var apiSetKidClass_ = api_(function (fy, grade, id, cls) {
  var by = requireTeacher_();
  fy = +fy; grade = +grade; cls = +cls; id = String(id);
  if (!(cls >= -1 && cls < CONFIG.MAX_CLASSES)) throw userError_('組が違います'); // -1＝クラスなし
  var FY = CONFIG.fiscalYear(), cohort = grade - (fy - FY);
  if (fy !== (decisionOf_(FY, cohort) ? FY + 1 : FY)) throw userError_('この年度の名簿は直せません');
  return withLock_(function () {
    var t = read_('roster_' + fy), row = null, max = 0;
    t.rows.forEach(function (r) { if (+r.grade !== grade) return; if (String(r.id8) === id) row = r; else if (+r['class'] === cls + 1 && +r.no > max) max = +r.no; });
    if (!row) throw userError_('名簿にいない児童です');
    if (+row['class'] !== cls + 1) { writeCell_(t, row, 'class', cls + 1); writeCell_(t, row, 'no', max + 1); }
    log_(by, 'setKidClass', 1);
    return { cls: cls, no: +row['class'] === cls + 1 ? +row.no : max + 1 };
  });
});

// 取り込む前の差分：追加・名前が変わる・ほかの学年にいる児童・貼った中にいない児童。
// 別の学年や年度の表を貼って上書きする誤りを、書く前に見せて止める（名前の5割以上が変わる、またはほかの学年の児童がいる時は確かめを要る）
function importDiff_(fy, grade, rows) {
  var t = read_('roster_' + fy), byId = {}, ids = {}, classes = {}, added = 0, renamed = [], other = [], relink = [];
  t.rows.forEach(function (r) { byId[String(r.id8)] = r; });
  var temps = t.rows.filter(function (r) { return +r.grade === grade && CONFIG.isTempId(r.id8); });
  rows.forEach(function (x) {
    var id = String(x.id || ''), r = byId[id]; if (id) ids[id] = 1; classes[+x.cls] = 1;
    if (!r) {
      var hit = id && CONFIG.isKidId(id) && !CONFIG.isTempId(id) ? temps.filter(function (q) { return normName_(q.name) === normName_(x.name) && (!x.kana || !q.kana || normName_(q.kana) === normName_(x.kana)); }) : [];
      if (hit.length === 1) { relink.push(String(hit[0].name)); ids[String(hit[0].id8)] = 1; } else added++;
      return;
    }
    if (+r.grade !== grade) other.push(String(r.name) + '（' + r.grade + '年）');
    else if (String(r.name).replace(/[\s　]/g, '') !== String(x.name).replace(/[\s　]/g, '')) renamed.push(String(r.name) + '→' + String(x.name).slice(0, 40));
  });
  var same = t.rows.filter(function (r) { return +r.grade === grade; });
  var missing = same.filter(function (r) { return classes[(+r['class']) - 1] && !ids[String(r.id8)]; }).map(function (r) { return String(r.name); });
  var existing = rows.length - added - other.length - relink.length;
  return { added: added, renamed: renamed, other: other, missing: missing, existing: existing, relink: relink,
    risky: other.length > 0 || (existing > 0 && renamed.length * 2 >= existing) };
}

// ===== 事案のゴミ箱 =====
// ゴミ箱へ：deleted に「trash:日時:誰」を書く（一覧・名簿・クラス分けから消える）。戻すと元どおり。完全に消すのは管理者だけ
// （年度替わりの削除で消えた事案の deleted は日時だけなので、ゴミ箱には出ない）
var apiTrashIncident_ = api_(function (id) {
  var by = requireTeacher_(); id = +id;
  return withLock_(function () {
    var t = read_('incidents'), row = t.rows.filter(function (r) { return +r.inc_id === id && !r.deleted; })[0];
    if (!row) throw userError_('事案が見つかりません（ほかの先生が先に消したかもしれません）');
    writeCell_(t, row, 'deleted', 'trash:' + new Date().toISOString() + ':' + by);
    log_(by, 'trashIncident', id);
    return { ok: true };
  });
});
function trashRows_() { return read_('incidents').rows.filter(function (r) { return String(r.deleted).indexOf('trash:') === 0; }); }
var apiTrashList_ = api_(function () {
  requireTeacher_();
  return trashRows_().map(function (r) { var p = String(r.deleted).split(':'); return { id: +r.inc_id, title: String(r.title || ''), date: isoDate_(r.date), type: String(r.type || ''), at: p.slice(1, 4).join(':'), by: p.slice(4).join(':') }; });
});
var apiRestoreIncident_ = api_(function (id) {
  var by = requireTeacher_(); id = +id;
  return withLock_(function () {
    var t = read_('incidents'), row = t.rows.filter(function (r) { return +r.inc_id === id && String(r.deleted).indexOf('trash:') === 0; })[0];
    if (!row) throw userError_('ゴミ箱にありません');
    writeCell_(t, row, 'deleted', '');
    log_(by, 'restoreIncident', id);
    return { ok: true };
  });
});
var apiEmptyTrash_ = api_(function (ids) {
  var by = requireAdmin_();
  return withLock_(function () {
    var set = {}; trashRows_().forEach(function (r) { if (!ids || !ids.length || ids.map(Number).indexOf(+r.inc_id) >= 0) set[+r.inc_id] = 1; });
    var n = removeRows_('incidents', function (r) { return set[+r.inc_id]; });
    removeRows_('incident_kids', function (r) { return set[+r.inc_id]; });
    log_(by, 'emptyTrash', n);
    return { n: n };
  });
});

// 事案の版：最後に直した時刻。直す時に読んだ時の版と比べ、ほかの先生が先に直していたら上書きしない
function revOf_(at) { return at instanceof Date ? at.toISOString() : String(at || ''); }
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
    return { id: +r.inc_id, rev: revOf_(r.at), by: String(r.by || ''), date: isoDate_(r.date), dateEnd: r.date_end ? isoDate_(r.date_end) : '', detail: String(r.detail || ''), type: String(r.type), title: String(r.title), url: String(r.url), ids: kids[r.inc_id] || [], roles: roles[r.inc_id] || {}, diagram: dg, report: rp };
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
  return { ids: ids, roles: roles, diagram: dg, json: json, date: date, dateEnd: end, detail: plainText_(String(x.detail || '').trim(), 5000), type: plainText_(String(x.type), 60), url: String(x.url || ''), report: rp, rjson: rjson };
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
var apiSetScores_ = api_(function (fy, grade, v) {
  requireTeacher_();
  fy = +fy; grade = +grade;
  var FY = CONFIG.fiscalYear();
  var max = +v.max, top = +v.top, s = {};
  if (!(max > 0 && max <= 10000)) throw userError_('満点が違います');
  if (!(top > 0 && top < 1)) throw userError_('上位の割合が違います');
  var ids = {}; rosterRows_(fy).forEach(function (r) { if (r.grade === grade) ids[r.id] = 1; });
  Object.keys(v.s || {}).forEach(function (id) { var n = +v.s[id]; if (ids[id] && n >= 0 && n <= max) s[id] = n; });
  // 順位（1が上。組の中の男女ごとの順位）。点数と順位のどちらで「賢い」を決めるかは use（最後に保存した方の窓）
  var r = {}, nk = Object.keys(ids).length;
  Object.keys(v.r || {}).forEach(function (id) { var n = Math.floor(+v.r[id]); if (ids[id] && n >= 1 && n <= nk) r[id] = n; });
  var use = v.use === 'rank' ? 'rank' : 'score';
  return withLock_(function () {
    var dec = decisionOf_(FY, grade - (fy - FY)), editable = dec ? FY + 1 : FY;
    if (fy !== editable) throw userError_('この年度の点数は直せません');
    setSetting_('scores_' + fy + '_' + grade, { max: max, top: top, s: s, r: r, use: use }); return { ok: true };
  });
});

var apiSetAttr_ = api_(function (fy, grade, id, k, v, text, incs) {
  var by = requireTeacher_();
  fy = +fy; grade = +grade; v = +v;
  if (k === 'memo') { text = String(text == null ? '' : text).trim(); v = text ? 1 : 0; }
  if (k === 'sib') { text = JSON.stringify(CONFIG.normSibs(text)); v = text === '[]' ? 0 : 1; }
  var at = k === 'sp' ? { k: 'sp', max: 1 } : k === 'memo' || k === 'sib' ? { k: k, max: 1 } : CONFIG.ATTRS.filter(function (a) { return a.k === k; })[0];
  if (!at) throw userError_('項目が違います');
  if (!(v >= 0 && v <= at.max)) throw userError_('値が違います');
  var FY = CONFIG.fiscalYear(), cohortGrade = grade - (fy - FY);
  return withLock_(function () {
    var dec = decisionOf_(FY, cohortGrade), editable = dec ? FY + 1 : FY; // 決定と同時の保存でも、決定の後は書かない
    if (fy !== editable) throw userError_(fy === FY && dec ? 'クラス替えを決定したので、今年度の値は直せません。準備中の年度を直してください' : 'この年度は直せません');
    var name = 'attrs_' + fy;
    ensureCols_(name, attrsHead_());
    var t = read_(name), row = null;
    t.rows.forEach(function (r) { if (String(r.id8) === String(id)) row = r; });
    if (k === 'memo' || k === 'sib') { // 備考・兄弟は文字だけを持つ（兄弟は JSON の並び）
      var val = k === 'sib' ? (v ? text : '') : plainText_(text, 400);
      if (row) writeCell_(t, row, k, val);
      else { var o0 = { id8: String(id) }; o0[k] = val; append_(name, attrsHead_(), [o0]); }
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
var apiSavePlans_ = api_(function (grade, plans, baseVer) {
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
var apiFetchTitle_ = api_(function (url) { requireTeacher_(); return { title: titleOf_(url) }; });

var apiAddIncident_ = api_(function (x) {
  var by = requireTeacher_();
  var v = incidentInput_(x);
  var title = plainText_(String(x.title || '').trim() || (v.url ? titleOf_(v.url) : ''), 200);
  return withLock_(function () {
    ensureCols_('incidents', TABLES_[3].head); ensureCols_('incident_kids', TABLES_[4].head);
    var t = read_('incidents'), next = 1;
    t.rows.forEach(function (r) { if (+r.inc_id >= next) next = +r.inc_id + 1; });
    var inc = { inc_id: next, date: v.date, date_end: v.dateEnd, detail: v.detail, type: v.type, url: v.url, file_id: fileIdOf_(v.url), title: title, by: by, at: new Date(), deleted: '', diagram: v.json, report: v.rjson };
    append_('incidents', TABLES_[3].head, [inc]);
    append_('incident_kids', TABLES_[4].head, v.ids.map(function (id) { return { inc_id: next, id8: id, role: v.roles[id] || '' }; }));
    log_(by, 'addIncident', v.ids.length);
    return { id: next, rev: revOf_(inc.at), date: inc.date, dateEnd: v.dateEnd, detail: v.detail, type: inc.type, title: title, url: inc.url, ids: v.ids, roles: v.roles, diagram: v.diagram, report: v.report };
  });
});

// 事案を直す（関係図・文書・日付・種別）。関係する児童は関係図から入れ直す
var apiUpdateIncident_ = api_(function (id, x, baseRev) {
  var by = requireTeacher_();
  id = +id;
  var v = incidentInput_(x);
  var title = plainText_(String(x.title || '').trim() || (v.url ? titleOf_(v.url) : ''), 200);
  return withLock_(function () {
    ensureCols_('incidents', TABLES_[3].head); ensureCols_('incident_kids', TABLES_[4].head);
    var t = read_('incidents'), row = t.rows.filter(function (r) { return +r.inc_id === id && !r.deleted; })[0];
    if (!row) throw userError_('事案が見つかりません');
    if (baseRev && revOf_(row.at) !== String(baseRev)) return { conflict: true, by: String(row.by || '') };
    var now = new Date();
    writeCell_(t, row, 'by', by); writeCell_(t, row, 'at', now);
    [['date', v.date], ['date_end', v.dateEnd], ['detail', v.detail], ['type', v.type], ['url', v.url], ['file_id', fileIdOf_(v.url)], ['title', title], ['diagram', v.json], ['report', v.rjson]].forEach(function (c) { writeCell_(t, row, c[0], c[1]); });
    removeRows_('incident_kids', function (r) { return +r.inc_id === id; });
    append_('incident_kids', TABLES_[4].head, v.ids.map(function (k) { return { inc_id: id, id8: k, role: v.roles[k] || '' }; }));
    log_(by, 'updateIncident', v.ids.length);
    return { id: id, rev: revOf_(now), date: v.date, dateEnd: v.dateEnd, detail: v.detail, type: v.type, title: title, url: v.url, ids: v.ids, roles: v.roles, diagram: v.diagram, report: v.report };
  });
});

// 報告書のExcel：設定の様式ファイル（xlsxのまま置いたもの）を複製し、該当するシートのセルにだけ値を書く。
// 元のファイルは変えない。xlsx の中の XML を直接書き換えるので、罫線・結合・入力規則は元のまま。
// 複製は様式のファイルと同じフォルダに置く（名前に児童の氏名は入れない）
var apiExportReport_ = api_(function (kind, values, incId, seq) {
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
  return { name: name, url: copy.getUrl(), shared: sharedWith_(copy) };
});

// 事案の書きかけ（下書き）：教員ごと・学年ごとに1つ。画面を離れても消えないように、入力のたびに少し遅れて保存する
// 中身は入力中の記録そのもの（氏名が入りうる）。登録するか「やめる」で消える
function draftKey_(email, grade) { return 'incdraft_' + String(email).toLowerCase() + '_' + (+grade); }
var apiSaveDraft_ = api_(function (grade, draft) {
  var by = requireTeacher_(), key = draftKey_(by, grade);
  return withLock_(function () {
    if (!draft) { setSetting_(key, null); return { ok: true }; }
    var s = JSON.stringify(draft);
    if (s.length > 45000) throw userError_('書きかけが長すぎて保存できません。登録してから続きを書いてください');
    setSetting_(key, { at: new Date().toISOString(), draft: draft });
    return { ok: true };
  });
});
var apiLoadDraft_ = api_(function (grade) {
  var by = requireTeacher_(), v = getSetting_(draftKey_(by, grade), null);
  return v && v.draft ? v : null;
});

// 全校の事案（事案の一覧で、ほかの学年を探す時）
var apiAllIncidents_ = api_(function () {
  readLog_('allIncidents', 0);
  requireTeacher_();
  return incidents_();
});

// 全校の今年度の名簿（事案管理で、ほかの学年の児童を関係図に足すため。名前・よみ・性別・学年・組と、配慮項目の程度・内容の文）
// 備考・経緯への事案の紐付けは渡さない（関係図のアイコンに要らない）
var apiSchoolKids_ = api_(function () {
  readLog_('schoolKids', 0);
  requireTeacher_();
  var FY = CONFIG.fiscalYear(), am = attrsMap_(FY);
  return rosterRows_(FY).map(function (r) {
    var a = {}, src = am[r.id] || {};
    // ほかの学年の児童には、項目の程度（アイコン）だけを渡す。経緯・内容の文（_t。医療・家庭の事情を含む）は渡さない
    CONFIG.ATTRS.forEach(function (at) { if (src[at.k]) a[at.k] = src[at.k]; });
    if (src.sp) a.sp = 1;
    return { id: r.id, name: r.name, kana: r.kana, male: r.male, grade: r.grade, cls: r.cls, a: a };
  });
});

var apiSchoolIncidents_ = api_(function () {
  readLog_('schoolIncidents', 0);
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
var apiDecide_ = api_(function (grade, plan) {
  var by = requireAdmin_(); // 決定・取り消し・組の番号は管理者だけ（4/1を過ぎると取り消せないため）
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
    var nfy = FY + 1, mine = {};
    cur.forEach(function (r) { mine[String(r.id)] = 1; });
    // 前の決定が途中で止まって残した行（決定の行が書かれる前に止まった分）を先に消す。やり直しても二重にならない
    removeRows_('roster_' + nfy, function (r) { return mine[String(r.id8)]; });
    removeRows_('attrs_' + nfy, function (r) { return mine[String(r.id8)]; });
    removeRows_('pairs_carry', function (r) { return +r.fy === FY && (mine[String(r.a)] || mine[String(r.b)]); });
    ensureCols_('roster_' + nfy, ROSTER_HEAD);
    append_('roster_' + nfy, ROSTER_HEAD, rows.map(function (r) {
      var s = info[r.id];
      return { id8: r.id, name: s.name, kana: s.kana, sex: s.male ? '男' : '女', grade: grade + 1, 'class': r.cls + 1, no: r.no, addr: s.addr || '', area: s.area || '', birth: s.birth || '' };
    }));
    ensureCols_('attrs_' + nfy, attrsHead_());
    append_('attrs_' + nfy, attrsHead_(), rows.map(function (r) { var o = { id8: r.id }; CONFIG.ATTRS.forEach(function (at) { o[at.k] = r.a[at.k]; if ((at.side || at.ctx) && r.a[at.k + '_t']) o[at.k + '_t'] = plainText_(r.a[at.k + '_t'], 1000); if (at.ctx && r.a[at.k + '_i']) o[at.k + '_i'] = r.a[at.k + '_i'].join(','); }); if (r.a.sp) o.sp = 1; if (r.a.memo) o.memo = plainText_(r.a.memo, 400); if (r.a.sib && r.a.sib.length) o.sib = JSON.stringify(r.a.sib); return o; }));
    ensureCols_('pairs_carry', TABLES_[2].head);
    append_('pairs_carry', TABLES_[2].head, pairs_(FY, grade).filter(function (p) { return p.t !== 'fix'; })
      .map(function (p) { return Object.assign({ fy: FY, type: p.t, a: p.a, b: p.b }, pairCells_(p, grade)); })); // 経緯・理由・何年生からを次の年度へ持ち越す
    append_('decisions', TABLES_[1].head, [{ fy: FY, grade: grade, plan: String(plan.name), by: by, at: new Date().toISOString(), undone: '' }]);
    log_(by, 'decide', rows.length);
    return { plan: String(plan.name) };
  });
});

// 取り消し：4/1まで（年度が変わったら決定は確定）。来年度の名簿と写した値・持ち越しの候補を消す
var apiUndoDecide_ = api_(function (grade) {
  var by = requireAdmin_(); // 決定・取り消し・組の番号は管理者だけ（4/1を過ぎると取り消せないため）
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
var apiSetClassNames_ = api_(function (grade, names) {
  var by = requireAdmin_(); // 決定・取り消し・組の番号は管理者だけ（4/1を過ぎると取り消せないため）
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
      forget_(); t.sh.getRange(2, c + 1, col.length, 1).setValues(col); // 1回で書く（行ごとに書くと遅い）
    }
    ensureCols_('decisions', TABLES_[1].head);
    var d = read_('decisions');
    writeCell_(d, d.rows.filter(function (r) { return r._r === dec._r; })[0], 'names', names.join(','));
    log_(by, 'classNames', nc);
    return { ok: true };
  });
});

// 行を消す（下の行から消すので行番号がずれない）
// 条件に合う行を消す。1行ずつ deleteRow すると行の数だけ呼び出しが要り、数年分で6分の上限に届くので、
// 残す行を書き戻し、余った末尾の行をまとめて消す（呼び出しは3回）
function removeRows_(name, pred) {
  var t = read_(name);
  if (!t.sh || !t.rows.length) return 0;
  var all = t.sh.getDataRange().getValues(), keep = [], n = 0;
  t.rows.forEach(function (r, i) { if (pred(r)) n++; else keep.push(all[i + 1]); });
  if (!n) return 0;
  var w = all[0].length;
  forget_();
  if (keep.length) { textCols_(t.sh, all[0].map(String), 2, keep.length); t.sh.getRange(2, 1, keep.length, w).setValues(keep); } // 詰めた行にも児童IDの列の書式を当てる
  t.sh.deleteRows(2 + keep.length, n);
  return n;
}

// ===== 目安箱 =====
// 送った人は記録しない（書きやすさと、改善に送り主は要らないため）。名簿の名前・番号・メールが入っていれば断り、語を示して書き直してもらう
function allRosterNames_() {
  var out = [];
  rosterSheets_().forEach(function (fy) { rosterRows_(fy).forEach(function (r) { out.push(r.name); }); });
  read_('transfers').rows.forEach(function (r) { if (r.name) out.push(String(r.name)); });
  return out;
}
function allRosterIds_() { var out = []; rosterSheets_().forEach(function (fy) { rosterRows_(fy).forEach(function (r) { out.push(r.id); }); }); return out; }
var apiSuggest_ = api_(function (text, screen) {
  requireTeacher_();
  text = String(text == null ? '' : text).trim();
  if (!text) throw userError_('意見を書いてください');
  if (text.length > 2000) throw userError_('2000字までにしてください');
  var hits = CONFIG.piiHits(text, allRosterNames_(), allRosterIds_());
  if (hits.length) return { blocked: hits.slice(0, 10) };
  withLock_(function () {
    sheet_(db_(), 'suggestions', TABLES_[7].head);
    append_('suggestions', TABLES_[7].head, [{ at: new Date().toISOString(), screen: plainText_(String(screen || ''), 20), text: plainText_(text, 2000) }]);
  });
  return { ok: true };
});
var apiSuggestions_ = api_(function () {
  requireAdmin_();
  return read_('suggestions').rows.map(function (r) { return { at: String(r.at), screen: String(r.screen), text: String(r.text).replace(/^'/, '') }; });
});

// ===== 読み出しの記録 =====
// 機微な読み出しも log に残す（誰が何を見たかを後から確かめられるように）。教員の確認を兼ねる。
// 同じ人の同じ読み出しは10分に1回だけ書く（開き直すたびに行が増えないように）
function readLog_(action, n) {
  var by = requireTeacher_(), key = 'rl_' + by + '_' + action + '_' + n, c = CacheService.getScriptCache();
  try { if (c.get(key)) return by; } catch (e) { return by; }
  try { log_(by, action, n); c.put(key, '1', 600); } catch (e) { /* 記録に失敗しても読み出しは止めない */ }
  return by;
}
var apiReadLog_ = api_(function () {
  requireAdmin_();
  var rows = read_('log').rows;
  return rows.slice(-200).reverse().map(function (r) { return { at: r.at instanceof Date ? r.at.toISOString() : String(r.at), by: String(r.by), action: String(r.action), n: String(r.n) }; });
});

// ===== 共有の状態と控え =====
// ファイルが所有者以外に見えるか：リンクの公開・編集者・閲覧者。見える相手の文を返す（空＝所有者だけ）
function sharedWith_(file) {
  var out = [];
  try {
    var acc = String(file.getSharingAccess());
    if (acc !== 'PRIVATE') out.push(acc === 'ANYONE' || acc === 'ANYONE_WITH_LINK' ? 'リンクを知る全員' : 'ドメインのリンクを知る人');
    var owner = ownerEmail_();
    file.getEditors().concat(file.getViewers()).forEach(function (u) { var e = String(u.getEmail()).toLowerCase(); if (e && e !== owner && out.indexOf(e) < 0) out.push(e); });
  } catch (e) { out.push('（確かめられませんでした）'); }
  return out;
}
var BACKUP_FOLDER = 'クラス替え（控え）', BACKUP_KEEP = 6;
function backupFolder_() {
  var it = DriveApp.getFoldersByName(BACKUP_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(BACKUP_FOLDER);
}
// データの控え：スプレッドシートを丸ごと複製し、新しい順に BACKUP_KEEP 個だけ残す（個人情報の複製を増やしすぎない）
function backup_(why) {
  var id = PropertiesService.getScriptProperties().getProperty(DB_PROP);
  if (!id) return '';
  var folder = backupFolder_(), stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss');
  var copy = DriveApp.getFileById(id).makeCopy('クラス替え（控え）' + stamp + '_' + why, folder);
  var list = [], it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (String(f.getName()).indexOf('クラス替え（控え）') === 0) list.push(f); }
  list.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  list.slice(BACKUP_KEEP).forEach(function (f) { f.setTrashed(true); });
  return copy.getId();
}
// 控えを取る。失敗しても呼んだ処理（名簿の取り込み・記録の削除）は止めない。失敗はプロパティに残し、管理者のメニューで知らせる
// （ドライブの権限が承認されていない・市教委の設定で許されていない時に、名簿を一切入れられなくなるのを避ける）
function tryBackup_(why) {
  var props = PropertiesService.getScriptProperties();
  try { backup_(why); props.setProperty('BACKUP_ERR', ''); return ''; }
  catch (e) { var m = String(e && e.message || e).slice(0, 300); props.setProperty('BACKUP_ERR', new Date().toISOString() + ' ' + m); return '控えを取れませんでした（' + m.slice(0, 80) + '）'; }
}
// 動作確認：所有者がエディタで実行する。ドライブ・トリガーの権限の承認を求められ、控え・毎週のきっかけ・共有の読み取りが実機で動くかを返す
function selfTest() {
  editorOnly_();
  var out = [], t = function (label, fn) { try { var v = fn(); out.push('○ ' + label + (v ? '：' + v : '')); } catch (e) { out.push('✕ ' + label + '：' + String(e && e.message || e)); } };
  t('データのスプレッドシート', function () { return db_().getName(); });
  t('控え（ドライブにフォルダを作り、複製する）', function () { backup_('動作確認'); PropertiesService.getScriptProperties().setProperty('BACKUP_ERR', ''); return BACKUP_FOLDER; });
  t('タブのアイコン（ドライブに置いた画像）', function () { return ensureIcon_(); });
  t('毎週の控えのきっかけ', function () { ensureWeeklyTrigger_(); return ''; });
  t('共有の状態の読み取り', function () { var s = sharedWith_(DriveApp.getFileById(PropertiesService.getScriptProperties().getProperty(DB_PROP))); return s.length ? '所有者以外にも見えます：' + s.join('、') : '所有者だけ'; });
  var msg = out.join('\n');
  console.log(msg);
  return msg;
}
// 毎週の控え（setup が時刻のきっかけを作る）
function weeklyBackup() { editorOnly_(); tryBackup_('毎週'); try { pruneLog_(); } catch (e) { /* 控えは取れたので止めない */ } }
function ensureWeeklyTrigger_() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'weeklyBackup'; });
  if (!has) ScriptApp.newTrigger('weeklyBackup').timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).create();
}

// 今年度の名簿があるのに、クラス替えを決定していない学年（新1年〜5年）
function undecidedGrades_() {
  var FY = CONFIG.fiscalYear(), has = {};
  rosterRows_(FY).forEach(function (r) { has[r.grade] = 1; });
  return CONFIG.GRADES.filter(function (g) { return g <= 5 && has[g] && !decisionOf_(FY, g); });
}

// ===== 年度末の後片付け =====
// 記録（log）は1年より古い行を消す（毎週の控えのついでと、年度替わりのボタンから）。読み出しも残すので、放っておくと増え続ける
var LOG_KEEP_DAYS = 365;
function pruneLog_() {
  var limit = Date.now() - LOG_KEEP_DAYS * 86400000;
  return withLock_(function () { return removeRows_('log', function (r) { var t = new Date(r.at).getTime(); return t && t < limit; }); });
}
var apiPruneLog_ = api_(function () { var by = requireAdmin_(); var n = pruneLog_(); log_(by, 'pruneLog', n); return { n: n }; });
// 目安箱の意見を消す（読んでコピーした後に、管理者が消す）
var apiClearSuggestions_ = api_(function () {
  var by = requireAdmin_();
  var n = withLock_(function () { return removeRows_('suggestions', function () { return true; }); });
  log_(by, 'clearSuggestions', n);
  return { n: n };
});

// ===== 管理者への知らせ =====
// データ・スクリプト・控えのフォルダが所有者以外に共有されていないか。4〜5月は年度替わりの消し忘れも
var apiAdminStatus_ = api_(function () {
  var email = requireTeacher_();
  if (!accessOf_(email).admin) return { warnings: [] };
  var w = [], id = PropertiesService.getScriptProperties().getProperty(DB_PROP);
  var chk = function (label, file) { var s = sharedWith_(file); if (s.length) w.push({ kind: 'share', text: label + 'が所有者以外にも見える状態です：' + s.slice(0, 5).join('、') + (s.length > 5 ? ' ほか' : '') + '。共有をやめてください（アプリの利用者の制限が効かなくなります）' }); };
  try { if (id) chk('データのスプレッドシート', DriveApp.getFileById(id)); } catch (e) { w.push({ kind: 'share', text: 'データのスプレッドシートの共有の状態を確かめられませんでした' }); }
  try { chk('このアプリのスクリプト', DriveApp.getFileById(ScriptApp.getScriptId())); } catch (e) { /* スクリプトの所在によっては読めない */ }
  try { var it = DriveApp.getFoldersByName(BACKUP_FOLDER); if (it.hasNext()) chk('控えのフォルダ', it.next()); } catch (e) { }
  var be = PropertiesService.getScriptProperties().getProperty('BACKUP_ERR');
  if (be) w.push({ kind: 'backup', text: 'データの控えが取れていません。所有者がスクリプトのエディタで selfTest を実行し、権限を承認してください（' + be.slice(0, 120) + '）' });
  var m = +Utilities.formatDate(new Date(), 'Asia/Tokyo', 'M');
  if (m === 3) {
    var und = undecidedGrades_();
    if (und.length) w.push({ kind: 'decide', text: '3月31日までにクラス替えを決定していない学年があります：' + und.map(CONFIG.gradeLabel).join('・') + '。4月1日を過ぎると、その学年は来年度の名簿が無いまま年度が替わります' });
  }
  if (m === 4 || m === 5) {
    var n = leaveCandidates_().length;
    if (n) w.push({ kind: 'purge', text: '卒業・転出して残す年数を過ぎた児童が' + n + '人います。設定の「年度替わり」で記録を消してください' });
  }
  return { warnings: w };
});

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
    slots: s.slots && s.slots.length ? s.slots : d.slots, school: String(s.school || ''), template: String(s.template || ''), appName: String(s.appName || 'SSS'), formalName: String(s.formalName || '児童理解支援システム') };
}
var apiSettings_ = api_(function () {
  var email = requireTeacher_(), s = settings_(), ac = accessOf_(email), me = { email: email, grade: 0, cls: -1, admin: ac.admin, owner: ac.owner, ownerEmail: ac.admin ? ownerEmail_() : '' };
  s.teachers.forEach(function (t) { if (String(t.email).toLowerCase() === email) { me.grade = +t.grade; me.cls = (+t.cls) - 1; } });
  me.view = getSetting_('view_' + email, {});
  return { settings: s, me: me };
});
// 先生ごとのメニューの表示（出す・出さないだけ）
var apiSaveMyView_ = api_(function (v) {
  var email = requireTeacher_(), o = {};
  ['rost', 'inc', 'split', 'recent', 'others'].forEach(function (k) { o[k] = !(v && v[k] === false); });
  withLock_(function () { setSetting_('view_' + email, o); });
  return o;
});
// 設定の文字から HTML の記号を落とす（画面の HTML にそのまま入る所があるため）
function safeText_(v, n) { return String(v == null ? '' : v).replace(/[<>&"'`]/g, '').trim().slice(0, n); }
var apiSaveSettings_ = api_(function (s) {
  var by = requireAdmin_();
  if (!s || !s.attrs) throw userError_('設定が読めません');
  var clean = { attrs: {}, types: [], teachers: [], keepYears: Math.max(0, Math.min(6, +s.keepYears || 0)),
    slots: (s.slots || []).map(function (t) { return safeText_(t, 20); }).filter(Boolean).slice(0, 30),
    school: String(s.school || '').trim().slice(0, 40), template: String(s.template || '').trim().slice(0, 300), appName: safeText_(s.appName, 12) || 'SSS', formalName: safeText_(s.formalName, 30) || '児童理解支援システム' };
  if (!clean.slots.length) clean.slots = CONFIG.TIME_SLOTS.slice();
  if (clean.template && !fileIdOf_(clean.template)) throw userError_('様式のファイルは、ドライブのファイルのURLを貼ってください');
  CONFIG.ATTRS.forEach(function (at) {
    var x = s.attrs[at.k] || {};
    var label = safeText_(x.label === undefined ? at.label : x.label, 20), ini = safeText_(x.s === undefined ? at.s : x.s, 1);
    if (!label || !ini) throw userError_('項目の名前と頭文字は空にできません');
    // 説明文：空の欄は既定の文に戻す
    var help = (at.help || []).map(function (d, i) { var t = safeText_(x.help && x.help[i] || '', 80); return t || d; });
    clean.attrs[at.k] = { label: label, s: ini, w: Math.max(0, Math.min(3, +x.w || 0)), help: help };
  });
  clean.types = (s.types || []).map(function (t) { return safeText_(t, 20); }).filter(Boolean).slice(0, 20);
  if (!clean.types.length) throw userError_('事案の種別を1つ以上入れてください');
  clean.teachers = (s.teachers || []).filter(function (t) { return t && String(t.email || '').trim(); }).map(function (t) {
    var e = String(t.email).trim().toLowerCase(), at = e.lastIndexOf('@');
    if (at <= 0 || e.slice(at + 1) !== CONFIG.TEACHER_DOMAIN || /^\d{8}$/.test(e.slice(0, at))) throw userError_('教員のメールではありません：' + e.slice(0, 60));
    return t;
  }).map(function (t) {
    return { email: String(t.email).trim().toLowerCase(), grade: +t.grade || 0, cls: +t.cls || 0, admin: !!t.admin };
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
var apiLeaveCandidates_ = api_(function () { requireAdmin_(); return leaveCandidates_(); });
function leaveCandidates_() {
  var FY = CONFIG.fiscalYear(), keep = settings_().keepYears, now = {}, last = {};
  [FY, FY + 1].forEach(function (fy) { rosterRows_(fy).forEach(function (r) { now[r.id] = 1; }); });
  rosterSheets_().forEach(function (fy) {
    if (fy >= FY) return;
    rosterRows_(fy).forEach(function (r) { last[r.id] = { id: r.id, name: r.name, fy: fy, grade: r.grade, cls: r.cls, no: r.no }; });
  });
  var cnt = {};
  incidents_().forEach(function (x) { x.ids.forEach(function (id) { cnt[id] = (cnt[id] || 0) + 1; }); });
  return Object.keys(last).filter(function (id) { return !now[id] && CONFIG.purgeable(last[id].fy, FY, keep, !!cnt[id]); }).map(function (id) {
    var x = last[id]; x.reason = x.grade === 6 ? '卒業' : x.grade === 0 ? '入学せず' : '転出'; x.incidents = cnt[id] || 0; return x;
  }).sort(function (a, b) { return a.fy - b.fy || a.grade - b.grade || a.cls - b.cls || a.no - b.no; });
}
// 消す：名簿・配慮項目・つける離す・持ち越し・事案との結び付き・案の割り当てから、その児童の行を消す。
// 結び付く児童がいなくなった事案は、名前とURLを消して削除済みにする。元に戻せない
var apiPurge_ = api_(function (ids) {
  var by = requireAdmin_();
  if (!ids || !ids.length) throw userError_('消す児童を選んでください');
  var bkErr = tryBackup_('記録を消す前');
  var FY = CONFIG.fiscalYear(), set = {}, now = {};
  [FY, FY + 1].forEach(function (fy) { rosterRows_(fy).forEach(function (r) { now[r.id] = 1; }); });
  ids.forEach(function (id) { if (now[id]) throw userError_('今年度の名簿にいる児童は消せません'); set[String(id)] = 1; });
  // 画面の候補と同じ規則をサーバーでも確かめる（事案に関わった児童は5年度より前に消さない）
  var keep = settings_().keepYears, lastFy = {}, inc = {};
  rosterSheets_().forEach(function (fy) { if (fy < FY) rosterRows_(fy).forEach(function (r) { if (set[r.id]) lastFy[r.id] = fy; }); });
  incidents_().forEach(function (x) { x.ids.forEach(function (id) { inc[id] = 1; }); });
  ids.forEach(function (id) {
    if (lastFy[id] == null) throw userError_('過去の名簿にいない児童は消せません（' + id + '）');
    if (!CONFIG.purgeable(lastFy[id], FY, keep, !!inc[id])) throw userError_('残す年数を過ぎていない児童は消せません（事案に関わった児童は卒業・転出から' + CONFIG.INCIDENT_KEEP_YEARS + '年度）');
  });
  return withLock_(function () {
    var n = 0;
    db_().getSheets().map(function (sh) { return sh.getName(); }).forEach(function (name) {
      if (/^(roster|attrs)_\d{4}$/.test(name)) n += removeRows_(name, function (r) { return set[String(r.id8)]; });
      else if (/^pairs_/.test(name)) removeRows_(name, function (r) { return set[String(r.a)] || set[String(r.b)]; });
    });
    removeRows_('incident_kids', function (r) { return set[String(r.id8)]; });
    removeRows_('transfers', function (r) { return set[String(r.id8)]; });
    removeRows_('left', function (r) { return set[String(r.id8)]; });
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
      // 残った事案の、被害児童ごとの欄（様式Ⅱ）から消した児童の分を外す
      if (left[r.inc_id] && r.report) {
        var rp; try { rp = JSON.parse(String(r.report)); } catch (e) { rp = null; }
        if (rp && rp.s2v && Object.keys(rp.s2v).some(function (id) { return set[id]; })) {
          Object.keys(rp.s2v).forEach(function (id) { if (set[id]) delete rp.s2v[id]; });
          writeCell_(t, r, 'report', JSON.stringify(rp));
        }
      }
    });
    // 設定に入っている児童の値：案の割り当て、クラス分けテストの点数、事案の書きかけ（消した児童が入っていれば書きかけごと捨てる）
    read_('settings').rows.forEach(function (r) {
      var key = String(r.key), v; try { v = JSON.parse(r.json); } catch (e) { return; } // 読めない行は飛ばす（ほかの行の掃除は続ける）
      if (!v) return;
      var ch = false;
      if (/^plans_/.test(key)) {
        (v.plans || []).forEach(function (p) {
          Object.keys(p.assign || {}).forEach(function (id) { if (set[id]) { delete p.assign[id]; ch = true; } });
          var l0 = (p.locks || []).length; p.locks = (p.locks || []).filter(function (id) { return !set[id]; }); if (p.locks.length !== l0) ch = true;
        });
        if (ch) setSetting_(key, v);
      } else if (/^scores_/.test(key)) {
        Object.keys(v.s || {}).forEach(function (id) { if (set[id]) { delete v.s[id]; ch = true; } });
        if (ch) setSetting_(key, v);
      } else if (/^incdraft_/.test(key)) {
        var js = String(r.json);
        if (Object.keys(set).some(function (id) { return js.indexOf('"' + id + '"') >= 0; })) setSetting_(key, null);
      }
    });
    log_(by, 'purge', ids.length);
    return { kids: ids.length, rows: n };
  });
});

// 名簿を入れる（PR③で画面を作るまでの間、所有者がスクリプトエディタから呼ぶ）
// rows: [[id8, name, kana, 性別, 学年, 組, 番号], ...]
function importRoster(fy, rows) {
  editorOnly_();
  sheet_(db_(), 'roster_' + fy, ROSTER_HEAD);
  sheet_(db_(), 'attrs_' + fy, attrsHead_());
  append_('roster_' + fy, ROSTER_HEAD, rows.map(function (r) {
    return { id8: String(r[0]), name: r[1], kana: r[2], sex: r[3], grade: +r[4], 'class': +r[5], no: +r[6] };
  }));
  return rows.length;
}

// ===== 画面から呼ぶ関数の入口 =====
// GAS は google.script.run に「function 名前() {}」と宣言した関数しか出さない（var に入れた関数は画面から見えない）。
// 中身は上の apiXxx_（api_ で包んだもの）で、ここではそれを呼ぶだけ。新しい api を足したら、ここにも1行足す
function apiDevices() { return apiDevices_.apply(null, arguments); }
function apiOpenDeviceWindow() { return apiOpenDeviceWindow_.apply(null, arguments); }
function apiCloseDeviceWindow() { return apiCloseDeviceWindow_.apply(null, arguments); }
function apiRevokeDevice() { return apiRevokeDevice_.apply(null, arguments); }
function apiListGrades() { return apiListGrades_.apply(null, arguments); }
function apiBoot() { return apiBoot_.apply(null, arguments); }
function apiAddTransfer() { return apiAddTransfer_.apply(null, arguments); }
function apiRemoveTransfer() { return apiRemoveTransfer_.apply(null, arguments); }
function apiSavePairs() { return apiSavePairs_.apply(null, arguments); }
function apiImportRoster() { return apiImportRoster_.apply(null, arguments); }
function apiSetScores() { return apiSetScores_.apply(null, arguments); }
function apiSetAttr() { return apiSetAttr_.apply(null, arguments); }
function apiSavePlans() { return apiSavePlans_.apply(null, arguments); }
function apiFetchTitle() { return apiFetchTitle_.apply(null, arguments); }
function apiAddIncident() { return apiAddIncident_.apply(null, arguments); }
function apiUpdateIncident() { return apiUpdateIncident_.apply(null, arguments); }
function apiExportReport() { return apiExportReport_.apply(null, arguments); }
function apiSaveDraft() { return apiSaveDraft_.apply(null, arguments); }
function apiLoadDraft() { return apiLoadDraft_.apply(null, arguments); }
function apiAllIncidents() { return apiAllIncidents_.apply(null, arguments); }
function apiSchoolKids() { return apiSchoolKids_.apply(null, arguments); }
function apiSchoolIncidents() { return apiSchoolIncidents_.apply(null, arguments); }
function apiDecide() { return apiDecide_.apply(null, arguments); }
function apiUndoDecide() { return apiUndoDecide_.apply(null, arguments); }
function apiSetClassNames() { return apiSetClassNames_.apply(null, arguments); }
function apiReadLog() { return apiReadLog_.apply(null, arguments); }
function apiAdminStatus() { return apiAdminStatus_.apply(null, arguments); }
function apiSettings() { return apiSettings_.apply(null, arguments); }
function apiSaveSettings() { return apiSaveSettings_.apply(null, arguments); }
function apiLeaveCandidates() { return apiLeaveCandidates_.apply(null, arguments); }
function apiPurge() { return apiPurge_.apply(null, arguments); }
function apiSuggest() { return apiSuggest_.apply(null, arguments); }
function apiSuggestions() { return apiSuggestions_.apply(null, arguments); }
function apiPruneLog() { return apiPruneLog_.apply(null, arguments); }
function apiClearSuggestions() { return apiClearSuggestions_.apply(null, arguments); }
function apiRemoveKids() { return apiRemoveKids_.apply(null, arguments); }
function apiSetKidClass() { return apiSetKidClass_.apply(null, arguments); }
function apiLeftKids() { return apiLeftKids_.apply(null, arguments); }
function apiRestoreKid() { return apiRestoreKid_.apply(null, arguments); }
function apiUpdateKid() { return apiUpdateKid_.apply(null, arguments); }
function apiRosterYears() { return apiRosterYears_.apply(null, arguments); }
function apiTrashIncident() { return apiTrashIncident_.apply(null, arguments); }
function apiTrashList() { return apiTrashList_.apply(null, arguments); }
function apiRestoreIncident() { return apiRestoreIncident_.apply(null, arguments); }
function apiEmptyTrash() { return apiEmptyTrash_.apply(null, arguments); }
function apiSaveMyView() { return apiSaveMyView_.apply(null, arguments); }

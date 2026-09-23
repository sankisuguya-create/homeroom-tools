/* 生成物：apps/seating/src/ から scripts/build.mjs が作る。直接編集しない。 */
/* 席替え — スプレッドシートにバインドする Apps Script。
   サーバ側は「シートを読む・検査する・書く」だけ。計算はダイアログ（ブラウザ）で行う。 */

var SHEET = {
  roster: '名簿', cond: '条件', layout: '配置', settings: '設定', history: '履歴', chart: '座席表', past: '過去の座席'
};
var ROSTER_HEAD = ['番号', '氏名', '性別', '在籍', '前方', '高身長', '固定席', 'リーダー', '学習支援役', '配慮', 'メモ'];
var ROSTER_CHECKS = ['在籍', '前方', '高身長', 'リーダー', '学習支援役', '配慮'];
var LAYOUT_MAX = 10;   // 配置は最大 10×10。既定の編集枠は 8×8
var COND_HEAD = ['児童A', '児童B', '関係', '強さ', 'メモ'];
var HISTORY_HEAD = ['決定日時', '回', '番号', '氏名', '行', '列', '班'];
var SETTINGS_DEFAULT = [
  ['男女', '隣は男女', '隣は男女／市松／班だけ／考えない'],
  ['前方の行数', 2, '「前方」とみなす座席の行数（前から）'],
  ['履歴を見る回数', 3, '何回前までの隣・班を避けるか'],
  ['候補の数', 3, '一度に出す案の数']
];
var LAYOUT_TOP = 2; // 配置シートは2行目から座席。1行目は「前（黒板）」
var WEIGHT_PREFIX = '重視:';

function onOpen(){
  SpreadsheetApp.getUi().createMenu('席替え')
    .addItem('席替えを開く', 'openDialog')
    .addSeparator()
    .addItem('過去の座席を履歴に取り込む', 'importPast')
    .addSeparator()
    .addItem('シートを用意する', 'setupSheets')
    .addItem('試し用の学級を入れる', 'fillSample')
    .addToUi();
}

function onInstall(){ onOpen(); }

function openDialog(){
  var html = HtmlService.createHtmlOutputFromFile('Dialog').setWidth(1100).setHeight(720);
  SpreadsheetApp.getUi().showModelessDialog(html, '席替え');
}

/* ---------- シートの用意 ---------- */

function setupSheets(){
  var ss = SpreadsheetApp.getActive();
  var roster = ensureSheet_(ss, SHEET.roster, ROSTER_HEAD);
  var head = migrateHeader_(roster, ROSTER_HEAD);
  var check = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  ROSTER_CHECKS.forEach(function(h){ roster.getRange(2, head.indexOf(h) + 1, 60, 1).setDataValidation(check); });
  roster.getRange(2, head.indexOf('性別') + 1, 60, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['男', '女'], true).setAllowInvalid(true).build());
  var fxCol = head.indexOf('固定席') + 1;
  roster.getRange(2, fxCol, 60, 1).setNumberFormat('@');
  roster.getRange(1, head.indexOf('学習支援役') + 1).setNote('教え合いの核になれる児童に ✓。各班に散らします。成績の段階は書かない（座席用の表に評価情報を複製しないため）。');
  roster.getRange(1, head.indexOf('リーダー') + 1).setNote('班をまとめられる児童に ✓。各班に散らします。');
  roster.getRange(1, head.indexOf('高身長') + 1).setNote('✓ の児童は前方の席を避けます（後ろの児童の視界のため）。');
  roster.getRange(1, fxCol).setNote('座席の位置を「行-列」で書く。前から何行目-左から何席目（通路は数えない）。例：1-3');

  var cond = ensureSheet_(ss, SHEET.cond, COND_HEAD);
  cond.getRange(2, 3, 200, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['離す', '近く'], true).build());
  cond.getRange(2, 4, 200, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['できれば', '必須'], true).build());
  cond.getRange(1, 1).setNote('番号でも氏名でも書ける。');

  if(!ss.getSheetByName(SHEET.layout)){
    // 既定：2人組×3列、6行、4人班（8×8 の枠の中）
    var grid = blankGrid_(8, 8), cols = [0, 1, 3, 4, 6, 7];
    for(var r = 0; r < 6; r++) cols.forEach(function(c, ci){ grid[r][c] = String(Math.floor(r / 2) * 3 + Math.floor(ci / 2) + 1); });
    writeLayout_(ss, grid);
  }

  var settings = ss.getSheetByName(SHEET.settings);
  if(!settings){
    settings = ss.insertSheet(SHEET.settings);
    settings.getRange(1, 1, 1, 3).setValues([['項目', '値', '説明']]).setFontWeight('bold');
    settings.getRange(2, 1, SETTINGS_DEFAULT.length, 3).setValues(SETTINGS_DEFAULT);
    settings.getRange(2, 2).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(['隣は男女', '市松', '班だけ', '考えない'], true).build());
  }
  ensureSheet_(ss, SHEET.history, HISTORY_HEAD);
  if(!ss.getSheetByName(SHEET.past)) resetPastSheet_(ss);
  ss.setActiveSheet(roster);
  return 'ok';
}

function ensureSheet_(ss, name, head){
  var sh = ss.getSheetByName(name);
  if(!sh){
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* 旧版の名簿（班長・配慮だけ）に新しい列を足す。既存の列は動かさない */
function migrateHeader_(sh, want){
  var lastCol = Math.max(1, sh.getLastColumn());
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return String(h).trim(); });
  var ri = head.indexOf('班長');
  if(ri >= 0 && head.indexOf('リーダー') < 0){ sh.getRange(1, ri + 1).setValue('リーダー'); head[ri] = 'リーダー'; }
  want.forEach(function(h){
    if(head.indexOf(h) >= 0) return;
    var at = head.length;
    while(at > 0 && head[at - 1] === '') at--;
    sh.getRange(1, at + 1).setValue(h).setFontWeight('bold');
    head[at] = h;
  });
  return head;
}

function blankGrid_(R, C){
  var g = [];
  for(var r = 0; r < R; r++){ g.push([]); for(var c = 0; c < C; c++) g[r].push(''); }
  return g;
}

/* grid[r][c] = 班番号の文字列 | '○'（班なしの座席） | ''（通路）。配置シートの2行目・A列から書く。 */
function writeLayout_(ss, grid){
  var sh = ss.getSheetByName(SHEET.layout) || ss.insertSheet(SHEET.layout);
  var R = grid.length, C = grid[0].length;
  sh.getRange(1, 1, LAYOUT_MAX + 1, LAYOUT_MAX).breakApart().clear();
  sh.getRange(1, 1, 1, C).merge().setValue('前（黒板・教卓）')
    .setHorizontalAlignment('center').setBackground('#2C5C9E').setFontColor('#FFFFFF').setFontWeight('bold');
  sh.getRange(1, 1).setNote('数字＝座席（数字は班）、○＝班なしの座席、空白＝通路。メニュー「席替え」→「席替えを開く」→「配置」で、タップして作れます。');
  var rg = sh.getRange(LAYOUT_TOP, 1, R, C);
  rg.setValues(grid).setHorizontalAlignment('center').setVerticalAlignment('middle');
  rg.setBackgrounds(grid.map(function(row){ return row.map(function(v){ return v === '' ? '#FFFFFF' : groupColor_(v); }); }));
  drawGroupBorders_(sh, grid, LAYOUT_TOP, 1, false);
  sh.setColumnWidths(1, LAYOUT_MAX, 48);
  sh.setRowHeights(LAYOUT_TOP, LAYOUT_MAX, 40);
}

/* 班の境目に太線、同じ班の中は細線。flip は教卓向き（180°回転）で描くとき */
function drawGroupBorders_(sh, grid, top, left, flip){
  var R = grid.length, C = grid[0].length;
  function at(r, c){ return r < 0 || c < 0 || r >= R || c >= C ? '' : grid[r][c]; }
  for(var r = 0; r < R; r++) for(var c = 0; c < C; c++){
    var g = grid[r][c];
    if(g === '' || g == null) continue;
    function edge(n){ return n === '' || n == null || g === '○' || n !== g; }
    var t = edge(at(r - 1, c)), b = edge(at(r + 1, c)), l = edge(at(r, c - 1)), rt = edge(at(r, c + 1));
    var rr = flip ? R - 1 - r : r, cc = flip ? C - 1 - c : c;
    if(flip){ var x = t; t = b; b = x; x = l; l = rt; rt = x; }
    var cell = sh.getRange(top + rr, left + cc);
    cell.setBorder(true, true, true, true, null, null, '#C9C4B8', SpreadsheetApp.BorderStyle.SOLID);
    cell.setBorder(t || null, l || null, b || null, rt || null, null, null, '#1D2126', SpreadsheetApp.BorderStyle.SOLID_THICK);
  }
}

function resetPastSheet_(ss){
  var sh = ss.getSheetByName(SHEET.past) || ss.insertSheet(SHEET.past);
  sh.clear();
  sh.getRange(1, 1, 1, 8).merge().setValue('前（黒板・教卓）')
    .setHorizontalAlignment('center').setBackground('#2C5C9E').setFontColor('#FFFFFF').setFontWeight('bold');
  sh.getRange(1, LAYOUT_MAX + 2).setValue('その席替えの日付');
  sh.getRange(2, LAYOUT_MAX + 2).setNumberFormat('yyyy/mm/dd');
  sh.getRange(4, LAYOUT_MAX + 2, 5, 1).setValues([
    ['使い方'], ['1. 左の枠に、その回に座っていた児童の番号を席の位置どおりに書く（配置シートと同じ位置）'],
    ['2. 右上に日付を書く'], ['3. メニュー「席替え」→「過去の座席を履歴に取り込む」'],
    ['4. 取り込むと枠は空になるので、次の回を書く（古い回からでも新しい回からでもよい）']]);
  sh.setColumnWidths(1, LAYOUT_MAX, 48);
  sh.setRowHeights(LAYOUT_TOP, LAYOUT_MAX, 36);
  sh.getRange(LAYOUT_TOP, 1, LAYOUT_MAX, LAYOUT_MAX).setHorizontalAlignment('center')
    .setBorder(true, true, true, true, true, true, '#DFDCD2', SpreadsheetApp.BorderStyle.SOLID);
  return sh;
}

/* 「過去の座席」シートの1回分を履歴に足す。班は今の配置シートから引く */
function importPast(){
  var ss = SpreadsheetApp.getActive(), ui = SpreadsheetApp.getUi();
  var sh = ss.getSheetByName(SHEET.past);
  if(!sh){ resetPastSheet_(ss); ui.alert('「過去の座席」シートを作りました。番号を書いてから、もう一度実行してください。'); return; }
  var res = readPast_(sh.getRange(1, 1, LAYOUT_MAX + 1, LAYOUT_MAX + 2).getValues(), values_(ss, SHEET.layout), values_(ss, SHEET.roster));
  if(res.error){ ui.alert(res.error); return; }
  var msg = res.entries.length + ' 人分を ' + Utilities.formatDate(res.date, Session.getScriptTimeZone(), 'yyyy/MM/dd') + ' の席替えとして履歴に取り込みます。' +
    (res.warnings.length ? '\n\n' + res.warnings.join('\n') : '');
  if(ui.alert(msg, ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  var hist = ensureSheet_(ss, SHEET.history, HISTORY_HEAD);
  var last = hist.getLastRow(), round = 1;
  if(last > 1) round = Math.max.apply(null, hist.getRange(2, 2, last - 1, 1).getValues().map(function(r){ return +r[0] || 0; })) + 1;
  var rows = res.entries.map(function(e){ return [res.date, round, e.id, e.name, e.r, e.c, e.group]; });
  hist.getRange(last + 1, 1, rows.length, HISTORY_HEAD.length).setValues(rows);
  sh.getRange(LAYOUT_TOP, 1, LAYOUT_MAX, LAYOUT_MAX).clearContent();
  sh.getRange(2, LAYOUT_MAX + 2).clearContent();
  ui.alert('取り込みました（第' + round + '回として）。');
}

/* 純関数。past は「過去の座席」シートの値（1行目＝前、2行目から枠、右に日付） */
function readPast_(past, layoutV, rosterV){
  var date = past[1] && past[1][LAYOUT_MAX + 1];
  if(Object.prototype.toString.call(date) !== '[object Date]' || isNaN(date.getTime()))
    return { error: '右上（' + String.fromCharCode(65 + LAYOUT_MAX + 1) + '2）に、その席替えの日付を書いてください。' };
  var names = {}, head = (rosterV[0] || []).map(function(h){ return String(h).trim(); });
  var iId = head.indexOf('番号'), iNm = head.indexOf('氏名');
  rosterV.slice(1).forEach(function(r){ if(iId >= 0 && r[iId] !== '') names[String(r[iId]).trim()] = iNm >= 0 ? String(r[iNm]) : ''; });
  var entries = [], warnings = [], seen = {};
  for(var r = 1; r <= LAYOUT_MAX && r < past.length; r++){
    for(var c = 0; c < LAYOUT_MAX; c++){
      var v = past[r][c];
      if(v === '' || v === null) continue;
      var id = String(v).trim().replace(/[０-９]/g, function(d){ return String.fromCharCode(d.charCodeAt(0) - 0xFEE0); });
      if(!/^\d+$/.test(id)){ warnings.push(String.fromCharCode(65 + c) + (r + 1) + '「' + v + '」は番号ではないので飛ばします。'); continue; }
      if(seen[id]){ warnings.push(id + '番が2か所にあります。後の方を飛ばします。'); continue; }
      if(!(id in names)) warnings.push(id + '番は名簿にいませんが、そのまま取り込みます。');
      seen[id] = 1;
      var lg = layoutV[r] && layoutV[r][c] !== undefined ? String(layoutV[r][c]).trim() : '';
      entries.push({ id: +id, name: names[id] || '', r: r + 1, c: c + 1, group: lg });
    }
  }
  if(!entries.length) return { error: '枠に番号がありません。' };
  return { date: date, entries: entries, warnings: warnings };
}

/* ---------- 配置・重視の保存（ダイアログから呼ぶ） ---------- */

function saveLayout(grid){
  if(!grid || !grid.length || grid.length > LAYOUT_MAX || grid[0].length > LAYOUT_MAX) throw new Error('配置の大きさが不正です');
  var clean = grid.map(function(row){ return row.map(function(v){
    v = String(v == null ? '' : v).trim();
    return v === '' ? '' : (v === '○' || /^\d{1,2}$/.test(v) ? v : '○');
  }); });
  writeLayout_(SpreadsheetApp.getActive(), clean);
  return loadInput();
}

function saveWeights(levels){
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET.settings) || ss.insertSheet(SHEET.settings);
  var v = sh.getDataRange().getValues(), rowOf = {};
  v.forEach(function(r, i){ rowOf[String(r[0]).trim()] = i + 1; });
  Object.keys(levels).forEach(function(k){
    var lv = Math.max(0, Math.min(4, Math.round(+levels[k])));
    var name = WEIGHT_PREFIX + k;
    if(rowOf[name]) sh.getRange(rowOf[name], 2).setValue(lv);
    else { var r = sh.getLastRow() + 1; sh.getRange(r, 1, 1, 3).setValues([[name, lv, '0=無視 1=弱 2=中 3=強 4=必須（ダイアログの「重視」で変える）']]); rowOf[name] = r; }
  });
  return 'ok';
}

function fillSample(){
  setupSheets();
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET.roster);
  if(sh.getLastRow() > 1){
    var ui = SpreadsheetApp.getUi();
    if(ui.alert('名簿に既にデータがあります。上書きしますか？', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  }
  var fam = ['あおき', 'いとう', 'うえだ', 'えんどう', 'おおた', 'かとう', 'きむら', 'くどう', 'けんもち', 'こばやし',
    'さとう', 'しみず', 'すずき', 'せきぐち', 'そが', 'たなか', 'ちば', 'つじ', 'てらだ', 'とだ',
    'なかの', 'にしだ', 'ぬまた', 'ねもと', 'のむら', 'はやし', 'ひらの', 'ふじい', 'へんみ', 'ほんだ', 'まつい', 'みうら'];
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var rows = fam.map(function(f, i){
    var o = { '番号': i + 1, '氏名': f, '性別': i % 2 ? '女' : '男', '在籍': true, '前方': i === 4,
      '高身長': i === 6 || i === 17 || i === 28, '固定席': '', 'リーダー': i % 4 === 0,
      '学習支援役': i % 4 === 2, '配慮': i === 9 || i === 22, 'メモ': '' };
    return head.map(function(h){ return h in o ? o[h] : ''; });
  });
  sh.getRange(2, 1, rows.length, head.length).setValues(rows);
}

/* ---------- 読み取り（ダイアログから呼ぶ） ---------- */

function loadInput(){
  var ss = SpreadsheetApp.getActive();
  if(!ss.getSheetByName(SHEET.roster) || !ss.getSheetByName(SHEET.layout)){
    return { needSetup: true };
  }
  return readInput_(
    values_(ss, SHEET.roster), values_(ss, SHEET.cond), values_(ss, SHEET.layout),
    values_(ss, SHEET.settings), values_(ss, SHEET.history));
}

function values_(ss, name){
  var sh = ss.getSheetByName(name);
  return sh ? sh.getDataRange().getValues() : [];
}

/* 純関数：シートの値 → solver の入力。problems に人が読める問題文を積む。 */
function readInput_(rosterV, condV, layoutV, settingsV, historyV){
  var problems = [], warnings = [];
  var settings = { genderMode: '隣は男女', frontRows: 2, historyDepth: 3, count: 3, weights: {} };
  settingsV.slice(1).forEach(function(r){
    var k = String(r[0]).trim(), v = r[1];
    if(k === '男女' && v) settings.genderMode = String(v).trim();
    if(k === '前方の行数' && +v > 0) settings.frontRows = +v;
    if(k === '履歴を見る回数' && +v >= 0) settings.historyDepth = +v;
    if(k === '候補の数' && +v > 0) settings.count = Math.min(5, +v);
    if(k.indexOf(WEIGHT_PREFIX) === 0 && v !== '' && !isNaN(+v)) settings.weights[k.slice(WEIGHT_PREFIX.length)] = Math.max(0, Math.min(4, +v));
  });

  /* 配置 */
  var seats = [], layoutGrid = blankGrid_(8, 8);
  for(var r = LAYOUT_TOP - 1; r < Math.min(layoutV.length, LAYOUT_TOP - 1 + LAYOUT_MAX); r++){
    for(var c = 0; c < Math.min(layoutV[r].length, LAYOUT_MAX); c++){
      var v = layoutV[r][c];
      if(v === '' || v === null) continue;
      var g = String(v).trim();
      if(g.length > 3) continue; // 説明書き
      if(!/^\d+$/.test(g)) g = '○';
      if(g === '0') g = '○';
      seats.push({ r: r + 1, c: c + 1, group: g === '○' ? '' : g });
      var gr = r - (LAYOUT_TOP - 1);
      while(layoutGrid.length <= gr) layoutGrid.push(layoutGrid[0].map(function(){ return ''; }));
      while(layoutGrid[0].length <= c) layoutGrid.forEach(function(row){ row.push(''); });
      layoutGrid[gr][c] = g;
    }
  }
  var rowList = uniqSorted_(seats.map(function(s){ return s.r; }));
  var colList = uniqSorted_(seats.map(function(s){ return s.c; }));

  /* 名簿 */
  var students = [], byName = {}, byId = {};
  var head = (rosterV[0] || []).map(function(h){ return String(h).trim(); });
  function col(name){ return head.indexOf(name); }
  var ci = { id: col('番号'), name: col('氏名'), g: col('性別'), on: col('在籍'), front: col('前方'),
    fixed: col('固定席'), leader: col('リーダー') >= 0 ? col('リーダー') : col('班長'), care: col('配慮'),
    support: col('学習支援役'), tall: col('高身長') };
  if(ci.id < 0 || ci.name < 0) problems.push('名簿シートの1行目に「番号」「氏名」が見つかりません。');
  rosterV.slice(1).forEach(function(row, k){
    if(ci.id < 0) return;
    var id = row[ci.id];
    if(id === '' || id === null) return;
    if(ci.on >= 0 && row[ci.on] === false) return;
    id = typeof id === 'number' ? id : String(id).trim();
    if(byId[id]){ problems.push('名簿の番号 ' + id + ' が重複しています（' + (k + 2) + '行目）。'); return; }
    var p = {
      id: id, name: String(row[ci.name] || '').trim(),
      gender: ci.g >= 0 ? normGender_(row[ci.g]) : '',
      front: ci.front >= 0 && row[ci.front] === true,
      leader: ci.leader >= 0 && row[ci.leader] === true,
      care: ci.care >= 0 && row[ci.care] === true,
      support: ci.support >= 0 && row[ci.support] === true,
      tall: ci.tall >= 0 && row[ci.tall] === true,
      fixed: null
    };
    var raw = ci.fixed >= 0 ? row[ci.fixed] : '';
    /* 「1-3」は Sheets が日付（1月3日）に変えることがある。月-日として読み戻す */
    var fx = Object.prototype.toString.call(raw) === '[object Date]' ? (raw.getMonth() + 1) + '-' + raw.getDate() : String(raw || '').trim();
    if(fx){
      var m = fx.replace(/[０-９]/g, function(d){ return String.fromCharCode(d.charCodeAt(0) - 0xFEE0); })
        .match(/^(\d+)\s*[-ー－の,、]\s*(\d+)$/);
      if(!m || !rowList[+m[1] - 1] || !colList[+m[2] - 1]){
        problems.push(p.id + '番 ' + p.name + ' の固定席「' + fx + '」が読めません（例：1-3 ＝前から1行目・左から3席目、通路は数えない）。');
      } else {
        p.fixed = { r: rowList[+m[1] - 1], c: colList[+m[2] - 1], text: fx };
      }
    }
    byId[id] = p;
    if(p.name) byName[p.name] = p;
    students.push(p);
  });

  /* 条件 */
  var conditions = [];
  condV.slice(1).forEach(function(row, k){
    if(row.every(function(x){ return x === '' || x === null; })) return;
    var a = findStudent_(row[0], byId, byName), b = findStudent_(row[1], byId, byName);
    var type = String(row[2] || '').trim(), must = String(row[3] || '').trim() === '必須';
    var line = '条件シート ' + (k + 2) + '行目';
    if(!a || !b){ warnings.push(line + '：児童「' + (a ? row[1] : row[0]) + '」が名簿（在籍）にいないため無視しました。'); return; }
    if(a === b){ warnings.push(line + '：同じ児童どうしなので無視しました。'); return; }
    if(type !== '離す' && type !== '近く'){ warnings.push(line + '：関係は「離す」か「近く」にしてください。'); return; }
    conditions.push({ a: a.id, b: b.id, type: type, must: must });
  });

  /* 履歴：回ごとにまとめ、新しい順 */
  var rounds = {}, order = [], when = {};
  historyV.slice(1).forEach(function(row){
    var n = row[1];
    if(n === '' || n === null) return;
    if(!rounds[n]){ rounds[n] = []; order.push(n); when[n] = dateNum_(row[0]); }
    var id = typeof row[2] === 'number' ? row[2] : String(row[2]).trim();
    rounds[n].push({ id: id, r: +row[4], c: +row[5], group: String(row[6]) });
  });
  /* 新しい順。過去の座席を後から取り込むと回の番号と日付の順がずれるので、日付を優先する */
  var maxRound = order.length ? Math.max.apply(null, order.map(Number)) : 0;
  order.sort(function(x, y){ return (when[y] - when[x]) || (y - x); });
  var history = order.map(function(n){ return rounds[n]; });
  var historyDates = order.map(function(n){ return when[n]; });

  return {
    seats: seats, students: students, conditions: conditions, history: history,
    settings: settings, problems: problems, warnings: warnings,
    rows: rowList, cols: colList, nextRound: maxRound + 1,
    layoutGrid: layoutGrid, historyDates: historyDates
  };
}

function dateNum_(v){
  if(Object.prototype.toString.call(v) === '[object Date]') return v.getTime() || 0;
  var t = Date.parse(v);
  return isNaN(t) ? 0 : t;
}

function uniqSorted_(a){
  var o = [];
  a.forEach(function(x){ if(o.indexOf(x) < 0) o.push(x); });
  return o.sort(function(x, y){ return x - y; });
}

function normGender_(v){
  var s = String(v || '').trim();
  if(/^(男|M|m|男子)$/.test(s)) return '男';
  if(/^(女|F|f|女子)$/.test(s)) return '女';
  return '';
}

function findStudent_(v, byId, byName){
  if(v === '' || v === null) return null;
  if(typeof v === 'number') return byId[v] || null;
  var s = String(v).trim();
  if(/^\d+$/.test(s)) return byId[+s] || byId[s] || null;
  return byName[s] || byName[s.replace(/\s+/g, '')] || null;
}

/* ---------- 決定（ダイアログから呼ぶ） ---------- */

/* seats: [{r,c,group,id,name}] */
function commit(seats, round){
  var lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActive();
    var hist = ensureSheet_(ss, SHEET.history, HISTORY_HEAD);
    var now = new Date();
    var rows = seats.filter(function(s){ return s.id != null; }).map(function(s){
      return [now, round, s.id, s.name, s.r, s.c, s.group];
    });
    if(rows.length) hist.getRange(hist.getLastRow() + 1, 1, rows.length, HISTORY_HEAD.length).setValues(rows);
    writeChart_(ss, seats, round, now);
    return { ok: true, round: round };
  } finally {
    lock.releaseLock();
  }
}

/* 座席表：左に児童から見た向き（黒板が上）、右に教卓から見た向き（180°回転）。 */
function writeChart_(ss, seats, round, when){
  var name = SHEET.chart;
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear();
  var rows = uniqSorted_(seats.map(function(s){ return s.r; }));
  var cols = uniqSorted_(seats.map(function(s){ return s.c; }));
  var r0 = rows[0], c0 = cols[0];
  var H = rows[rows.length - 1] - r0 + 1, Wd = cols[cols.length - 1] - c0 + 1;
  var gap = 2, top = 3;
  var title = '座席表　第' + round + '回　' + Utilities.formatDate(when, Session.getScriptTimeZone(), 'yyyy/MM/dd');
  sh.getRange(1, 1).setValue(title).setFontSize(14).setFontWeight('bold');

  function block(left, flip, caption){
    sh.getRange(2, left).setValue(caption).setFontColor('#5A6470');
    var front = flip ? top + H : top;
    sh.getRange(front, left, 1, Wd).merge().setValue(flip ? '教卓（前）' : '黒板（前）')
      .setHorizontalAlignment('center').setBackground('#2C5C9E').setFontColor('#FFFFFF').setFontWeight('bold');
    var base = flip ? top : top + 1;
    var grid = [];
    for(var i = 0; i < H; i++){ grid.push([]); for(var j = 0; j < Wd; j++) grid[i].push(''); }
    var bg = grid.map(function(r){ return r.map(function(){ return null; }); });
    seats.forEach(function(s){
      var i = s.r - r0, j = s.c - c0;
      if(flip){ i = H - 1 - i; j = Wd - 1 - j; }
      grid[i][j] = s.id != null ? s.id + '\n' + s.name : '（空席）';
      bg[i][j] = groupColor_(s.group);
    });
    var rg = sh.getRange(base, left, H, Wd);
    rg.setValues(grid).setBackgrounds(bg).setWrap(true)
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setFontSize(11);
    var gg = blankGrid_(H, Wd);
    seats.forEach(function(s){ gg[s.r - r0][s.c - c0] = s.group === '' || s.group == null ? '○' : String(s.group); });
    drawGroupBorders_(sh, gg, base, left, flip);
  }
  block(1, false, '児童から見た向き（掲示用）');
  block(1 + Wd + gap, true, '教卓から見た向き（教師用）');
  sh.setColumnWidths(1, Wd * 2 + gap, 84);
  sh.setRowHeights(top, H + 1, 44);
  ss.setActiveSheet(sh);
}

function groupColor_(g){
  var pal = ['#E4EEF9', '#F7EBCB', '#E3F2E8', '#F6E3EC', '#EDE6F7', '#E3F2F3', '#F4EADF', '#EEF3DB', '#F9E6E3', '#E8EAF0'];
  var n = parseInt(g, 10);
  return isNaN(n) ? '#FFFFFF' : pal[(n - 1 + pal.length) % pal.length];
}

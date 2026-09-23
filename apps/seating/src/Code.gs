/* 席替え — スプレッドシートにバインドする Apps Script。
   サーバ側は「シートを読む・検査する・書く」だけ。計算はダイアログ（ブラウザ）で行う。 */

var SHEET = {
  roster: '名簿', cond: '条件', layout: '配置', settings: '設定', history: '履歴', chart: '座席表'
};
var ROSTER_HEAD = ['番号', '氏名', '性別', '在籍', '前方', '固定席', '班長', '配慮', 'メモ'];
var COND_HEAD = ['児童A', '児童B', '関係', '強さ', 'メモ'];
var HISTORY_HEAD = ['決定日時', '回', '番号', '氏名', '行', '列', '班'];
var SETTINGS_DEFAULT = [
  ['男女', '隣は男女', '隣は男女／市松／班だけ／考えない'],
  ['前方の行数', 2, '「前方」とみなす座席の行数（前から）'],
  ['履歴を見る回数', 3, '何回前までの隣・班を避けるか'],
  ['候補の数', 3, '一度に出す案の数']
];
var LAYOUT_TOP = 2; // 配置シートは2行目から座席。1行目は「前（黒板）」

function onOpen(){
  SpreadsheetApp.getUi().createMenu('席替え')
    .addItem('席替えを開く', 'openDialog')
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
  var check = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  [4, 5, 7, 8].forEach(function(c){ roster.getRange(2, c, 60, 1).setDataValidation(check); });
  roster.getRange(2, 3, 60, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['男', '女'], true).setAllowInvalid(true).build());
  roster.getRange(2, 6, 60, 1).setNumberFormat('@');
  roster.getRange(1, 6).setNote('座席の位置を「行-列」で書く。前から何行目-左から何席目（通路は数えない）。例：1-3');

  var cond = ensureSheet_(ss, SHEET.cond, COND_HEAD);
  cond.getRange(2, 3, 200, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['離す', '近く'], true).build());
  cond.getRange(2, 4, 200, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['できれば', '必須'], true).build());
  cond.getRange(1, 1).setNote('番号でも氏名でも書ける。');

  var layout = ss.getSheetByName(SHEET.layout);
  if(!layout){
    layout = ss.insertSheet(SHEET.layout);
    layout.getRange(1, 1, 1, 8).merge().setValue('前（黒板・教卓）')
      .setHorizontalAlignment('center').setBackground('#2C5C9E').setFontColor('#FFFFFF').setFontWeight('bold');
    // 既定：2人組×3列、6行、4人班
    var cols = [1, 2, 4, 5, 7, 8];
    for(var r = 0; r < 6; r++) cols.forEach(function(c, ci){
      layout.getRange(LAYOUT_TOP + r, c).setValue(Math.floor(r / 2) * 3 + Math.floor(ci / 2) + 1);
    });
    layout.setColumnWidths(1, 8, 56);
    layout.getRange(LAYOUT_TOP, 1, 6, 8).setHorizontalAlignment('center');
    layout.getRange(LAYOUT_TOP + 7, 1).setValue('数字のセル＝座席（数字は班）。空白＝通路。行や列を増やしてよい。');
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

function fillSample(){
  setupSheets();
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET.roster);
  if(sh.getLastRow() > 1){
    var ui = SpreadsheetApp.getUi();
    if(ui.alert('名簿に既にデータがあります。上書きしますか？', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, ROSTER_HEAD.length).clearContent();
  }
  var fam = ['あおき', 'いとう', 'うえだ', 'えんどう', 'おおた', 'かとう', 'きむら', 'くどう', 'けんもち', 'こばやし',
    'さとう', 'しみず', 'すずき', 'せきぐち', 'そが', 'たなか', 'ちば', 'つじ', 'てらだ', 'とだ',
    'なかの', 'にしだ', 'ぬまた', 'ねもと', 'のむら', 'はやし', 'ひらの', 'ふじい', 'へんみ', 'ほんだ', 'まつい', 'みうら'];
  var rows = fam.map(function(f, i){
    return [i + 1, f, i % 2 ? '女' : '男', true, i === 4, '', i % 4 === 0, i === 9 || i === 22, ''];
  });
  sh.getRange(2, 1, rows.length, ROSTER_HEAD.length).setValues(rows);
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
  var settings = { genderMode: '隣は男女', frontRows: 2, historyDepth: 3, count: 3 };
  settingsV.slice(1).forEach(function(r){
    var k = String(r[0]).trim(), v = r[1];
    if(k === '男女' && v) settings.genderMode = String(v).trim();
    if(k === '前方の行数' && +v > 0) settings.frontRows = +v;
    if(k === '履歴を見る回数' && +v >= 0) settings.historyDepth = +v;
    if(k === '候補の数' && +v > 0) settings.count = Math.min(5, +v);
  });

  /* 配置 */
  var seats = [], colsUsed = {};
  for(var r = LAYOUT_TOP - 1; r < layoutV.length; r++){
    for(var c = 0; c < layoutV[r].length; c++){
      var v = layoutV[r][c];
      if(v === '' || v === null) continue;
      if(typeof v === 'string' && v.length > 3) continue; // 説明書き
      seats.push({ r: r + 1, c: c + 1, group: String(v).trim() });
      colsUsed[c + 1] = 1;
    }
  }
  var rowList = uniqSorted_(seats.map(function(s){ return s.r; }));
  var colList = uniqSorted_(seats.map(function(s){ return s.c; }));

  /* 名簿 */
  var students = [], byName = {}, byId = {};
  var head = (rosterV[0] || []).map(function(h){ return String(h).trim(); });
  function col(name){ return head.indexOf(name); }
  var ci = { id: col('番号'), name: col('氏名'), g: col('性別'), on: col('在籍'), front: col('前方'),
    fixed: col('固定席'), leader: col('班長'), care: col('配慮') };
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
  var rounds = {}, order = [];
  historyV.slice(1).forEach(function(row){
    var n = row[1];
    if(n === '' || n === null) return;
    if(!rounds[n]){ rounds[n] = []; order.push(n); }
    var id = typeof row[2] === 'number' ? row[2] : String(row[2]).trim();
    rounds[n].push({ id: id, r: +row[4], c: +row[5], group: String(row[6]) });
  });
  order.sort(function(x, y){ return y - x; });
  var history = order.map(function(n){ return rounds[n]; });

  return {
    seats: seats, students: students, conditions: conditions, history: history,
    settings: settings, problems: problems, warnings: warnings,
    rows: rowList, cols: colList, nextRound: order.length ? +order[0] + 1 : 1
  };
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
    seats.forEach(function(s){
      var i = s.r - r0, j = s.c - c0;
      if(flip){ i = H - 1 - i; j = Wd - 1 - j; }
      sh.getRange(base + i, left + j).setBorder(true, true, true, true, null, null, '#9AA3AD', SpreadsheetApp.BorderStyle.SOLID);
    });
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

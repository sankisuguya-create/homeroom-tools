/* ==================================================================
   Setup.gs — Step 1。シートを作る。
   エディタから setupSheets() を1回実行する。
   すでにあるシートには触らない（作り直しではなく足すだけ）。
================================================================== */

/* 見出し行。ここが仕様との接点なので、列名は spec.md と同じにする。 */
const SETUP_SHEETS = {   /* GAS は全ファイルが1スコープ。総称的な名前は置かない */
  "設定":     ["キー", "値"],
  "教科マスタ": ["教科", "時数", "公開"],
  "名簿":     ["児童ID", "出席番号", "氏名", "メール"],
  "単元マスタ": ["教科", "単元名", "開始No", "終了No", "色", "学期", "評価公開"],
  "授業マスタ": ["教科", "No", "実施日"],
  "記録":     ["教科", "児童ID", "No", "記号", "保存時刻", "更新者"],
  "確定":     ["教科", "児童ID", "種別", "対象", "値", "確定時刻"]
};

/* 設定シートの初期値。spec.md の凍結内容がそのまま入っている。
   開室時刻〜ロック時刻が、児童が使える時間。終わりはロック時刻と同じ値を使う。 */
const DEFAULTS = [
  ["学級",        "3年3組"],
  ["年度",        2026],
  ["開室時刻",    "8:00"],
  ["ロック時刻",  "16:00"],
  ["A下限",       "A+"],
  ["C上限",       "C++"],
  ["代表値",      "後半の中央値"],
  ["後半の範囲",  3],
  ["Dを含める",   true],
  ["Cを含める",   true],
  ["教師メール",  ""]
];

function setupSheets(){
  const ss = SpreadsheetApp.getActive();
  const made = [];

  Object.keys(SETUP_SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if(sh){ return; }                       // あるものには触らない
    sh = ss.insertSheet(name);
    const head = SETUP_SHEETS[name];
    sh.getRange(1, 1, 1, head.length).setValues([head])
      .setFontWeight("bold").setBackground("#EFEDE8");
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, head.length);
    made.push(name);
  });

  /* 設定シートが空なら既定値を入れる。 */
  const cfg = ss.getSheetByName("設定");
  if(cfg.getLastRow() <= 1){
    cfg.getRange(2, 1, DEFAULTS.length, 2).setValues(DEFAULTS);
    made.push("設定（既定値）");
  }

  /* 記録は行が増えるので、書き込みが速いよう列の書式だけ先に決めておく。 */
  const rec = ss.getSheetByName("記録");
  rec.getRange("E:E").setNumberFormat("yyyy-mm-dd HH:mm:ss");

  SpreadsheetApp.getUi().alert(
    made.length ? "作ったもの:\n" + made.join("\n") : "すべて揃っている。何もしなかった。");
}

/* 名簿・マスタが埋まっているかを見る。Step 1 の検算。 */
function checkSheets(){
  const ss = SpreadsheetApp.getActive();
  const msg = [];
  Object.keys(SETUP_SHEETS).forEach(name => {
    const sh = ss.getSheetByName(name);
    if(!sh){ msg.push("× " + name + " が無い"); return; }
    const n = Math.max(0, sh.getLastRow() - 1);
    msg.push((n ? "○ " : "△ ") + name + "  " + n + "行");
  });
  const teachers = Config.teacherEmails();
  msg.push(teachers.length ? "○ 教師メール " + teachers.length + "件"
                           : "× 教師メールが空。設定シートに自分のメールを入れる");
  SpreadsheetApp.getUi().alert(msg.join("\n"));
}

/* ==================================================================
   diagnose() — 児童の画面に何が出るか、出ないなら何が足りないかを見る。
   エディタから実行する。児童アカウントで開く前にこれで潰しておく。
================================================================== */
function diagnose(){
  const out = [];
  const ss  = SpreadsheetApp.getActive();
  const row = name => {
    const sh = ss.getSheetByName(name);
    return sh ? Math.max(0, sh.getLastRow() - 1) : -1;
  };

  /* 1. シート */
  Object.keys(SETUP_SHEETS).forEach(n => {
    const c = row(n);
    if(c < 0) out.push("× シート「" + n + "」が無い。setupSheets を実行する");
  });

  /* 2. 教師メール */
  const te = Config.teacherEmails();
  out.push(te.length ? "○ 教師メール " + te.length + "件（" + te.join("、") + "）"
                     : "× 教師メールが空。設定シートに自分のメールを入れる");

  /* 3. 名簿 */
  const roster = Roster.all();
  const noMail = roster.filter(s => !s.email).length;
  out.push(roster.length ? "○ 名簿 " + roster.length + "人" : "× 名簿が空。児童を入れる");
  if(noMail) out.push("× 名簿のうち " + noMail + "人にメールが無い。その児童は使えない");

  /* 4. 教科マスタ ← ここが空だと児童の画面が真っ白になる */
  const subj = Master.load().subjects;
  const names = Object.keys(subj);
  if(!names.length){
    out.push("× 教科マスタが空。ここが空だと児童の画面に何も出ない。"
           + "『教科 / 時数 / 公開』を入れる（公開は TRUE で児童に見える）");
  }else{
    const open = names.filter(n => subj[n].open);
    out.push("○ 教科 " + names.length + "件（" + names.join("、") + "）");
    out.push(open.length ? "○ 児童に見える教科 " + open.length + "件（" + open.join("、") + "）"
                         : "× 公開が TRUE の教科が無い。児童の画面には何も出ない");
  }

  /* 5. 単元マスタ・授業マスタ */
  names.forEach(n => {
    const s = subj[n];
    if(!s.total) out.push("× 「" + n + "」の時数が 0。教科マスタに入れる");
    if(!s.units.length){ out.push("× 「" + n + "」に単元が無い"); return; }

    const covered = {};
    s.units.forEach(u => { for(let i = u.from; i <= u.to; i++) covered[i] = 1; });
    const miss = [];
    for(let i = 1; i <= s.total; i++) if(!covered[i]) miss.push(i);
    if(miss.length) out.push("△ 「" + n + "」でどの単元にも入らない授業が "
                           + miss.length + "件（No." + miss[0] + " など）");

    const now = new Date();
    let held = 0;
    for(let i = 1; i <= s.total; i++) if(Master.isHeld(n, i, now)) held++;
    out.push((held ? "○ " : "× ") + "「" + n + "」実施済みの授業 " + held + "/" + s.total
           + (held ? "" : "。授業マスタに実施日を入れる。0 だと児童は1つも入力できない"));
  });

  /* 6. 時間 */
  const a = Config.openTime(), b = Config.lockTime();
  const p = x => String(x).padStart(2, "0");
  out.push("○ 児童が使える時間 " + p(a.h) + ":" + p(a.m) + "〜" + p(b.h) + ":" + p(b.m)
         + "（いま " + (Hours.isClosed() ? "閉室中" : "開室中") + "）");

  SpreadsheetApp.getUi().alert("児童の画面がどうなるか\n\n" + out.join("\n"));
  return out;
}

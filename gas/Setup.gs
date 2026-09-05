/* ==================================================================
   Setup.gs — Step 1。シートを作る。
   エディタから setupSheets() を1回実行する。
   すでにあるシートには触らない（作り直しではなく足すだけ）。
================================================================== */

/* 見出し行。ここが仕様との接点なので、列名は spec.md と同じにする。 */
const SHEETS = {
  "設定":     ["キー", "値"],
  "教科マスタ": ["教科", "時数", "公開"],
  "名簿":     ["児童ID", "出席番号", "氏名", "メール"],
  "単元マスタ": ["教科", "単元名", "開始No", "終了No", "色", "学期", "評価公開"],
  "授業マスタ": ["教科", "No", "実施日"],
  "記録":     ["教科", "児童ID", "No", "記号", "保存時刻", "更新者"],
  "確定":     ["教科", "児童ID", "種別", "対象", "値", "確定時刻"]
};

/* 設定シートの初期値。spec.md の凍結内容がそのまま入っている。 */
const DEFAULTS = [
  ["学級",        "3年3組"],
  ["年度",        2026],
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

  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if(sh){ return; }                       // あるものには触らない
    sh = ss.insertSheet(name);
    const head = SHEETS[name];
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
  Object.keys(SHEETS).forEach(name => {
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

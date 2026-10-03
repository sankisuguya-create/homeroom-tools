/* ==================================================================
   Year.gs — 年度替わり。年1回、スプレッドシートの「ノート評価」メニューから
   実行する（エディタから直接実行もできる）。

   理念（principles/roster-year-transition.md）に従い、2つの操作は分けてある。

   ・年度を保存する archiveYear() — 安全・冪等。
       名簿・記録・確定を「<名前>_<年度>」に値で写し、「記録」「確定」の
       データ行を消して「年度」を1つ進める。現行の名簿シートは消さない
       （新しい名簿が入るまで児童が未登録になるので。新名簿は教師が
       準備できた時に書き換える）。

   ・個人情報を消す erasePersonalInfo(year, 確認語) — 破壊的・別操作。
       所有者だけが実行できる。確認語「<年度>年度の個人情報を消去」と
       一字一句同じ入力で確定する。
       名簿_<年度> の氏名→児童NNN・メール→<年度>-児童NNN、
       記録_<年度> の更新者→対応する仮メール（名簿に無いメールは
       <年度>-教師NNN）に置き換える。今年度は消せない。
       消えるのは名簿_<年度> と 記録_<年度> だけ。確定シートには
       氏名・メールの列がない（消すものが無い）。
================================================================== */

/* 個人情報があるシートと列（docs/spec.md の年度運用節と対になる一覧。
   列を足したらここと docs を一緒に直す）。
     名簿 / 名簿_<年度>      : 氏名(3列目), メール(4列目)
     記録 / 記録_<年度>      : 更新者(6列目) — 教師の貫通書き込みで入る
     設定                    : 教師メール — 運用中の値。消去の対象外だが個人情報
     消しても残るもの        : スプレッドシートの版履歴、自由記述、設定の名前的情報 */
const YEAR_TARGETS = ["名簿", "記録", "確定"];
const ERASE_MAP_SHEET = "消去_対応表";          /* 中断再開のための仮名対応表 */

function yearPad_(n){ return String(n).padStart(3, "0"); }
function anonMail_(y, n){ return y + "-児童" + yearPad_(n); }
function anonName_(n){ return "児童" + yearPad_(n); }
function anonStaff_(y, n){ return y + "-教師" + yearPad_(n); }

/* 実行ログ。日時・年度・実行者（役割）・件数だけを書く。個人情報は入れない。
   シートが無ければ作る。 */
function yearLog_(op, year, detail){
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName("運用ログ");
  if(!sh){
    sh = ss.insertSheet("運用ログ");
    sh.appendRow(["日時", "操作", "対象年度", "実行者", "内容"]);
  }
  sh.appendRow([new Date(), op, year, whoAmI().role === "teacher" ? "教師" : "その他", detail]);
}

/* ------------------------------------------------------------------
   年度の保存。値で写すので、写したあとに元が変わっても写しは残る。

   再実行・中断への備え:
     ・「最終保存年度」が今年度以上 — 切り替え済み。何もしない
     ・「最終保存年度」が今年度より2つ以上前、かつ前年度の名簿写し
       がある — 前回は年度を進めたあとで止まった。マーカーだけを
       追いつかせて終わり、今年度ぶんの保存は次の年度替わりにまかせる
     ・「最終保存日時」から 30日以内 — 二度押し・回復直後の再実行。
       年に1度の操作なので、保存の直後に来た実行は何もしない
       （記録の無い年度を本当に進めたいときは、日が経ってから実行する）
     ・同名の写しは作らない（空の写しは作りかけと見なして作り直す）

   複写と行消しのあいだに児童の保存が割り込むと、写しに入らない
   評価が消える。Store.write_ と同じスクリプトロックで囲い、
   割り込んだ書き込みには「こんでいます」を返させる。
------------------------------------------------------------------ */
function archiveYear(){
  const lock = LockService.getScriptLock();
  if(!lock.tryLock(30000)){
    return tell_("年度の保存",
      ["× いま記録の書き込みが重なっています。少し待ってからもう一度実行してください"]);
  }
  try{
    return archiveYear_();
  }finally{
    lock.releaseLock();
  }
}

function archiveYear_(){
  const ss   = SpreadsheetApp.getActive();
  const year = Config.year();
  const done = Number(Config.get("最終保存年度", 0)) || 0;
  const msg  = [];

  if(done >= year){
    return tell_("年度の保存", ["○ " + year + "年度の保存は済んでいます（何もしません）"]);
  }

  /* 前回が「年度を進めたあと・最終保存年度を書く前」で止まったとき。
     このまま複写に進むと、進んだ年度の記録まで写して年度をもう
     1つ進めてしまう。ここではマーカーだけを追いつかせて終わる。 */
  if(year - done >= 2 && ss.getSheetByName("名簿_" + (year - 1))){
    configSet({"最終保存年度": year - 1, "最終保存日時": new Date()});
    yearLog_("年度保存", year - 1, "中断していた前回ぶんの回復");
    return tell_("年度の保存",
      ["○ 前回の年度保存が途中で止まっていたので回復しました",
       "△ " + year + "年度の保存は、次の年度替わりに実行してください"]);
  }

  /* 年度の保存は1年に1回。保存の直後にもう一度押すと、記録の無い年度を
     もう1つ進めてしまう（二度押し・回復直後の再実行）ので断る。
     前の保存から日が経っていれば、記録の無い年度でも普通に進められる。 */
  const lastAt = Config.get("最終保存日時", null);
  if(done === year - 1 && lastAt
     && (new Date() - new Date(lastAt)) < 30 * 24 * 60 * 60 * 1000){
    return tell_("年度の保存",
      ["○ " + (year - 1) + "年度の保存は先ほど済んでいます（何もしません）",
       "△ 次の年度替わりにもう一度実行してください"]);
  }

  /* 値の写し。同名シートがあれば飛ばすので、途中で止まっても再実行できる。
     空の写しは「作りかけで止まった」と見なして消して作り直す。 */
  YEAR_TARGETS.forEach(name => {
    const src = ss.getSheetByName(name), dn = name + "_" + year;
    if(!src){ msg.push("△ 「" + name + "」が無い（飛ばす）"); return; }
    const dup = ss.getSheetByName(dn);
    if(dup){
      if(dup.getLastRow() > 0){ msg.push("○ 「" + dn + "」はもうある（飛ばす）"); return; }
      ss.deleteSheet(dup);
    }
    const v = src.getDataRange().getValues();
    let sh = null;
    try{
      sh = ss.insertSheet(dn);
      sh.getRange(1, 1, v.length, Math.max(1, v[0].length)).setValues(v);
    }catch(e){
      /* 空の写しを残すと、再実行が「もうある」と見なして元を消してしまう */
      if(sh) try{ ss.deleteSheet(sh); }catch(_){}
      throw e;
    }
    msg.push("○ 「" + dn + "」に " + (v.length - 1) + "行 写した");
  });

  /* 現行の記録・確定は消す。名簿は消さない（理念§2）。 */
  YEAR_TARGETS.slice(1).forEach(name => {
    const sh = ss.getSheetByName(name);
    if(!sh) return;
    const n = sh.getLastRow() - 1;
    if(n > 0) sh.deleteRows(2, n);
    msg.push("○ 「" + name + "」の今年度ぶん " + Math.max(0, n) + "行 を消した（写しに残る）");
  });

  /* 消した記録がキャッシュに残っていると、画面には前年の評価が
     キャッシュの寿命ぶん残り続ける。全教科ぶん捨てて、次の読み取りに
     作り直させる（名簿は消していないので Roster のキャッシュは残す）。 */
  try{ Master.subjectNames(true).forEach(name => Store.dropCache(name)); }catch(e){}

  msg.push("○ 年度を " + year + " → " + (year + 1) + " に進めた");
  msg.push("△ 名簿は前年のまま残っている。新しい児童の名簿に書き換えると新年度になる");

  configSet({"年度": year + 1});
  configSet({"最終保存年度": year, "最終保存日時": new Date()});
            /* この2行を最後に書く。止まったら再実行で追いつく */
  yearLog_("年度保存", year, msg.filter(m => m.slice(0, 1) === "○").join(" / "));
  return tell_("年度の保存", msg);
}

/* ------------------------------------------------------------------
   個人情報の消去。名簿_<年度> と 記録_<年度> を対象にする。

   仮名の対応表は「消去_対応表」シートに残す。途中で止まっても
   （GAS の実行時間制限など）同じ番号で続けられる。済んだ行は
   メールが仮名に化けているので自然に飛ばされる。全部終わったら
   対応表は消す。
------------------------------------------------------------------ */
function erasePersonalInfo(year, confirmText){
  const ss   = SpreadsheetApp.getActive();
  const now  = Config.year();
  const msg  = [];
  year = Number(year) || (now - 1);

  /* 所有者だけが実行できる。 */
  const owner = ss.getOwner ? (ss.getOwner().getEmail() || "") : "";
  const me    = Session.getActiveUser().getEmail() || "";
  if(owner && me.toLowerCase() !== owner.toLowerCase()){
    return tell_("個人情報の消去", ["× 所有者だけが実行できます"]);
  }
  if(year >= now){
    return tell_("個人情報の消去", ["× 今年度（" + now + "年度）は消せません。年度替わりの後に実行します"]);
  }
  const phrase = year + "年度の個人情報を消去";
  if(String(confirmText || "").trim() !== phrase){
    return tell_("個人情報の消去",
      ["× 確認の語が違います。確定するには「" + phrase + "」と入力します"]);
  }

  const shRoster = ss.getSheetByName("名簿_" + year);
  const shRec    = ss.getSheetByName("記録_" + year);
  if(!shRoster && !shRec){
    return tell_("個人情報の消去",
      ["× " + year + "年度の写し（名簿_" + year + "・記録_" + year + "）が見つかりません"]);
  }

  /* ---- 仮名の対応表。前に止まったぶんがあれば引き継ぐ。 ---- */
  const map = eraseMapRead_(ss);            /* メール → {mail, name} */
  let nextKid = 1, nextStaff = 1;
  Object.keys(map).forEach(e => {
    const m = map[e].mail.match(/-児童(\d+)$/);   if(m) nextKid   = Math.max(nextKid,   +m[1] + 1);
    const s = map[e].mail.match(/-教師(\d+)$/);   if(s) nextStaff = Math.max(nextStaff, +s[1] + 1);
  });

  /* 名簿_<年度> を出席番号→メール順になめて、まだ仮名でないメールに番号を振る。
     （このシートに学年・組の列は無いので「出席番号→メール」順とする） */
  const rosterRows = shRoster ? shRoster.getDataRange().getValues() : [];
  const order = [];
  for(let i = 1; i < rosterRows.length; i++){
    const mail = String(rosterRows[i][3] || "").trim();
    if(mail && mail.indexOf(year + "-") !== 0 && !map[mail]) order.push([Number(rosterRows[i][1]) || 0, mail]);
  }
  order.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  order.forEach(([, mail]) => {
    map[mail] = {mail: anonMail_(year, nextKid), name: anonName_(nextKid)};
    nextKid++;
  });

  /* 記録_<年度> の更新者も対応表へ。名簿に無いメール（教師）は「教師NNN」。 */
  const recRows = shRec ? shRec.getDataRange().getValues() : [];
  for(let i = 1; i < recRows.length; i++){
    const mail = String(recRows[i][5] || "").trim();
    if(mail && mail.indexOf(year + "-") !== 0 && !map[mail]){
      map[mail] = {mail: anonStaff_(year, nextStaff)};
      nextStaff++;
    }
  }
  eraseMapWrite_(ss, map);                  /* 先に対応表を残してから書き換える */

  /* ---- 部分書き戻し。変えた行の変えた列だけを書く。 ---- */
  let cells = 0;
  if(shRoster){
    for(let i = 1; i < rosterRows.length; i++){
      const mail = String(rosterRows[i][3] || "").trim();
      if(!mail || !map[mail] || mail.indexOf(year + "-") === 0) continue;
      if(String(rosterRows[i][2]) !== map[mail].name){
        shRoster.getRange(i + 1, 3).setValue(map[mail].name); cells++;
      }
      shRoster.getRange(i + 1, 4).setValue(map[mail].mail); cells++;
    }
    msg.push("○ 名簿_" + year + " を仮名にした（" + (nextKid - 1) + "人）");
  }
  if(shRec){
    for(let i = 1; i < recRows.length; i++){
      const mail = String(recRows[i][5] || "").trim();
      if(!mail || !map[mail] || mail.indexOf(year + "-") === 0) continue;
      shRec.getRange(i + 1, 6).setValue(map[mail].mail); cells++;
    }
    msg.push("○ 記録_" + year + " の更新者を仮名にした");
  }

  ss.deleteSheet(ss.getSheetByName(ERASE_MAP_SHEET));   /* 全部済んだので対応表は消す */
  yearLog_("個人情報消去", year, "仮名 " + Object.keys(map).length + "件 / 書き換え " + cells + "セル");
  msg.push("○ " + year + "年度の個人情報を消した（" + cells + "セル）");
  msg.push("△ 版の履歴には前の値が残ります。完全に消すにはファイルをコピーし直して元を削除します");
  return tell_("個人情報の消去", msg);
}

/* 対応表シートの読み書き。列は [元メール, 仮メール, 仮氏名]。 */
function eraseMapRead_(ss){
  const sh = ss.getSheetByName(ERASE_MAP_SHEET);
  const map = {};
  if(!sh) return map;
  const v = sh.getDataRange().getValues();
  for(let i = 1; i < v.length; i++){
    if(v[i][0]) map[String(v[i][0]).trim()] = {mail: v[i][1], name: v[i][2] || ""};
  }
  return map;
}
function eraseMapWrite_(ss, map){
  let sh = ss.getSheetByName(ERASE_MAP_SHEET);
  if(!sh) sh = ss.insertSheet(ERASE_MAP_SHEET);
  const rows = [["元メール", "仮メール", "仮氏名"]]
    .concat(Object.keys(map).map(e => [e, map[e].mail, map[e].name]));
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
}

/* ------------------------------------------------------------------
   メニューからの入口。確認の表示はここでやる（関数本体はエディタからも
   そのまま実行できるので、確認は画面側の仕事に寄せる）。
------------------------------------------------------------------ */
function menuArchiveYear(){
  const ui   = SpreadsheetApp.getUi();
  const year = Config.year();
  const r = ui.alert(
    "年度を保存して進める",
    "次をします。\n"
    + "・「名簿」「記録」「確定」を 「◯_" + year + "」 に写します\n"
    + "・「記録」「確定」の中身は消します（写しのほうに残ります）\n"
    + "・「年度」を " + (year + 1) + " に進めます\n"
    + "・「名簿」はそのまま残ります。新年度の名簿に書き換えるのは後でできます\n\n"
    + "進めますか？",
    ui.ButtonSet.YES_NO);
  if(r === ui.Button.YES) archiveYear();
}

function menuErasePersonalInfo(){
  const ui   = SpreadsheetApp.getUi();
  const year = Config.year() - 1;
  const r = ui.prompt(
    year + "年度の個人情報の消去",
    "「名簿_" + year + "」の氏名・メールと「記録_" + year + "」の更新者を仮名に替えます。\n"
    + "元には戻せません（版の履歴には残ります）。\n\n"
    + "確定するには「" + year + "年度の個人情報を消去」と入力してください。",
    ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton() === ui.Button.OK) erasePersonalInfo(year, r.getResponseText());
}

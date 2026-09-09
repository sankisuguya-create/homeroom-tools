/* ==================================================================
   Export.gs — 通知表に写すための表をシートに書き出す。

   記録は縦持ちが正本。人が読む表はここで作る。作り直すたびに
   同じ名前のシートを消して入れ直すので、手で直した内容は残らない。
================================================================== */

/* 教科 × 学期。児童 × 単元の採用値と、期末評定を1枚にする。 */
function exportTerm(subject, term){
  const who = whoAmI();
  if(who.role !== "teacher") return {ok:false, why:"先生だけです"};

  const subj = Master.subject(subject);
  if(!subj) return {ok:false, why:"その教科はありません"};
  const units = term ? subj.units.filter(u => u.term === term) : subj.units;
  const R     = Config.rule();
  const all   = Store.readAll(subject);

  const name = "出力_" + subject + "_" + (term ? term + "学期" : "学年末");
  const ss   = SpreadsheetApp.getActive();
  const old  = ss.getSheetByName(name);
  if(old) ss.deleteSheet(old);
  const sh = ss.insertSheet(name);

  const head = ["出席番号", "児童"].concat(units.map(u => u.name))
             .concat(["まとめ", "仮評定", "採用評定", "入力", "休", "/", "C回数", "D回数"]);
  const rows = [head];

  Roster.all().forEach(st => {
    const per = [], counts = {n:0, total:0, off:0, skip:0, c:0, d:0};
    units.forEach(u => {
      const s = Aggregate.summarize(all[st.id] || {}, u, R);
      counts.n += s.n; counts.total += s.total; counts.off += s.off;
      counts.skip += s.skip; counts.c += s.c; counts.d += s.d;
      per.push(Final.unitValue(subject, st.id, u.name) || s.provSym || "");
    });
    const t = Aggregate.termValue(per, R);
    rows.push([st.no, st.name].concat(per).concat([
      t.v ? symbolOf(t.v) : "", t.rank || "",
      Final.termRank(subject, st.id, term) || "",
      counts.n + "/" + counts.total, counts.off, counts.skip, counts.c, counts.d
    ]));
  });

  /* 末尾に、どの式で出したかを残す。あとから見て再現できるようにする。 */
  rows.push([]);
  rows.push(["集計の式", ruleText_(R)]);
  rows.push(["書き出し", Utilities.formatDate(new Date(),
    Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")]);

  sh.getRange(1, 1, rows.length, head.length).setValues(
    rows.map(r => { const a = r.slice(); while(a.length < head.length) a.push(""); return a; }));
  sh.getRange(1, 1, 1, head.length).setFontWeight("bold").setBackground("#EFEDE8");
  sh.setFrozenRows(1);
  sh.setFrozenColumns(2);
  sh.autoResizeColumns(1, head.length);

  return {ok:true, sheet:name, rows:Roster.all().length};
}

function apiExportTerm(subject, term){ return exportTerm(subject, term); }

/* スプレッドシートのメニューから直接使えるようにする。 */
function onOpen(){
  SpreadsheetApp.getUi().createMenu("ノート評価")
    .addItem("いまの状態を見る（diagnose）", "diagnose")
    .addItem("シートを作る（setup）", "setupSheets")
    .addItem("キャッシュを消す", "clearAllCache")
    .addSeparator()
    .addItem("上端の記号を置き換える（1回だけ）", "migrateSymbols")
    .addToUi();
}

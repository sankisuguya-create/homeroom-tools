/* ==================================================================
   Api.gs — 画面から google.script.run で呼ぶ入口。
   ここに出したものだけが外から呼べる。中の関数は直接呼ばせない。

   どの入口も、役割をメールから引き直すところから始める。
   画面が渡してくる「わたしは誰」は一切見ない。
================================================================== */

/* 最初の1回。画面を組み立てるのに要るものをまとめて返す。 */
function apiBoot(subject){
  const who = whoAmI();
  const at  = new Date();
  if(who.role === "unknown") return {ok:false, why:"だれか わかりません"};

  const isTeacher = who.role === "teacher";
  const subjects  = Master.subjectNames(isTeacher);
  const subj      = (subject && subjects.indexOf(subject) >= 0) ? subject : subjects[0];

  const base = {
    ok: true,
    who: {role: who.role, name: who.name, id: who.id || null},
    className: Config.className(),
    year:      Config.year(),
    subjects:  subjects,
    subject:   subj || null,
    lock:      Config.lockTime(),
    open:      Config.openTime(),
    closed:    Hours.isClosedFor(who, at),
    toClose:   Hours.minutesToClose(at)
  };
  /* 閉室のときは中身を渡さない。画面で隠すのではなく、そもそも返さない。 */
  if(base.closed || !subj) return base;
  return Object.assign(base, apiRead(subj));
}

/* 1教科ぶん。児童は自分の分だけ。 */
function apiRead(subject){
  const who = whoAmI();
  const at  = new Date();
  if(who.role === "unknown")      return {ok:false, why:"だれか わかりません"};
  if(Hours.isClosedFor(who, at))  return {ok:false, closed:true, why:"いまは つかえません"};

  const isTeacher = who.role === "teacher";
  if(!isTeacher && !Master.isOpen(subject))
    return {ok:false, why:"その教科はまだ見られません"};

  const subj = Master.subject(subject);
  if(!subj) return {ok:false, why:"その教科はありません"};

  /* 教師が児童画面を見るときは、名簿の先頭を見る（プロトタイプと同じ扱い）。 */
  const id = isTeacher ? (Roster.all()[0] || {}).id : who.id;
  const rows = id ? Store.read(subject, id, at) : [];

  return {
    ok: true, subject: subject,
    total: subj.total,
    units: Aggregate.unitsForStudent(subject, id, rows),
    rows: rows,
    toClose: Hours.minutesToClose(at)
  };
}

/* 1セル保存。画面は押した瞬間に反映して、ここが false を返したら戻す。 */
function apiSave(subject, no, sym){
  return Store.save(subject, no, sym);
}

/* 教師だけ。ロック・時間・実施日を貫通する。 */
function apiSaveAs(subject, studentId, no, sym){
  return Store.saveAs(subject, studentId, no, sym);
}

/* 教師だけ。「単元の評価をする」。
   旗を立てるだけでは児童に何も出ない。確定シートに値が無いからで、
   押した本人には「押したのに変わらない」としか見えない。
   **押した時点で仮値を採用してから見せる。** すでに教師が直した値は残す。 */
function apiSetRated(subject, unitName, rated){
  const who = whoAmI();
  if(who.role !== "teacher") return {ok:false, why:"先生だけです"};

  const sh = SpreadsheetApp.getActive().getSheetByName("単元マスタ");
  const v  = sh.getDataRange().getValues();
  let row = 0;
  for(let i = 1; i < v.length; i++){
    if(String(v[i][0]) === subject && String(v[i][1]) === unitName){ row = i + 1; break; }
  }
  if(!row) return {ok:false, why:"その単元がありません"};

  let adopted = 0;
  if(rated){
    const subj = Master.subject(subject);
    const u = subj.units.filter(x => x.name === unitName)[0];
    const all = Store.readAll(subject);              // 1回だけ読む
    Roster.all().forEach(st => {
      if(Final.unitValue(subject, st.id, unitName)) return;   // 教師が直したものは残す
      const s = Aggregate.summarize(all[st.id] || {}, u);
      if(s.provSym){ Final.set(subject, st.id, "単元", unitName, s.provSym); adopted++; }
    });
  }

  sh.getRange(row, 7).setValue(!!rated);
  Master.clearCache();
  return {ok:true, rated: !!rated, adopted: adopted};
}

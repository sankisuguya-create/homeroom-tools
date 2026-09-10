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
    released:  Config.released(),
    appUrl:    appUrl_(),
    toClose:   Hours.minutesToClose(at)
  };
  /* 教科が1つも無いときは、その理由まで返す。
     画面が黙って空になると、何を直せばいいのか誰にも分からない。 */
  if(!subj){
    const all = Object.keys(Master.load().subjects).length;
    base.empty = true;
    /* 児童には児童の言葉、教師には直し方を返す。
       「教科マスタが空です」は児童には何のことか分からない。 */
    base.why = isTeacher
      ? (all ? "公開が TRUE の教科がありません。教科マスタの『公開』を見てください"
             : "教科マスタが空です。教科・時数・公開 を入れてください。"
             + "エディタで diagnose() を実行すると、ほかに足りないものも出ます")
      : "せんせいに つたえてください";
    return base;
  }
  /* 閉室のときは中身を渡さない。画面で隠すのではなく、そもそも返さない。 */
  if(base.closed) return base;
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

/* 時計の確認だけ。記録シートを読まない。
   閉室をまたいだかどうかを見るために画面が定期的に呼ぶので、
   ここで重い読み取りをすると、29台ぶんの空読みが毎分走ることになる。 */
function apiTick(){
  const who = whoAmI();
  const at  = new Date();
  return {ok:true,
          closed: Hours.isClosedFor(who, at),
          toClose: Hours.minutesToClose(at)};
}

/* 1セル保存。画面は押した瞬間に反映して、ここが false を返したら戻す。 */
function apiSave(subject, no, sym){
  return Store.save(subject, no, sym);
}

/* 教師だけ。ロック・時間を貫通する。 */
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

/* ==================================================================
   教師画面から呼ぶ入口。すべて役割をメールから引き直す。
================================================================== */
/* 公開しているウェブアプリの URL。
   画面の中の相対リンク（?p=teacher）は iframe の中で解決されてしまい、
   別の場所へ飛ぶ。**絶対 URL をサーバから渡して、それを使う。** */
function appUrl_(){
  try { return ScriptApp.getService().getUrl(); } catch(e) { return ""; }
}

function teacherOnly_(){
  const who = whoAmI();
  return who.role === "teacher" ? null : {ok:false, why:"先生だけです"};
}

function apiTeacherBoot(){
  const bad = teacherOnly_(); if(bad) return bad;
  const subjects = {};
  const all = Master.load().subjects;
  Object.keys(all).forEach(n => {
    subjects[n] = {name:n, total:all[n].total, open:all[n].open, units:all[n].units};
  });
  return {
    ok: true,
    className: Config.className(), year: Config.year(),
    subjects: subjects,
    names: Roster.all().map(s => ({id:s.id, no:s.no, name:s.name})),
    rule: Config.rule(),
    lock: Config.lockTime(), open: Config.openTime(),
    released: Config.released(), releaseFrom: RELEASE_FROM,
    sheetUrl: SpreadsheetApp.getActive().getUrl(),
    appUrl:   appUrl_(),
    releaseSyms: LEVELS.filter(isReleaseSym),
    syms: ALL_SYMS, off: OFF, skip: SKIP,
    diagnose: diagnoseLines()
  };
}

/* 単元1つ × 29人。仮値・指標・採用値をまとめて返す。 */
function apiUnitTable(subject, unitName){
  const bad = teacherOnly_(); if(bad) return bad;
  const subj = Master.subject(subject);
  if(!subj) return {ok:false, why:"その教科はありません"};
  const u = subj.units.filter(x => x.name === unitName)[0];
  if(!u) return {ok:false, why:"その単元はありません"};

  const all  = Store.readAll(subject);
  const R    = Config.rule();
  const rows = Roster.all().map(st => {
    const rec = all[st.id] || {};
    const s   = Aggregate.summarize(rec, u, R);
    const seq = [];
    for(let no = u.from; no <= u.to; no++) seq.push(rec[no] || null);
    return {
      id: st.id, name: st.name, seq: seq,
      n: s.n, total: s.total, off: s.off, skip: s.skip,
      prov: s.provSym, all: symbolOfMedian(s.all),
      high: s.high ? symbolOf(s.high) : null,
      top: s.top, c: s.c, d: s.d,
      final: Final.unitValue(subject, st.id, unitName)
    };
  });
  return {ok:true, unit:u, rows:rows, rule:R, ruleText: ruleText_(R)};
}

function ruleText_(R){
  const stat = R.stat;
  return "A ≧ " + symbolOf(R.aFrom) + " / C ≦ " + symbolOf(R.cTo)
       + " ／ 代表値：" + stat + (stat === "後半の中央値" ? "（後半 1/" + R.late + "）" : "")
       + (R.withD ? "" : " ／ D を除く") + (R.withC ? "" : " ／ C を除く");
}

/* 採用。値を空にすると採用を取り消す（仮値に戻る）。 */
function apiAdopt(subject, unitName, studentId, value){
  const bad = teacherOnly_(); if(bad) return bad;
  return Final.set(subject, studentId, "単元", unitName, value);
}

/* 仮値をまとめて採用する。すでに採用済みのものは触らない。 */
function apiAdoptAll(subject, unitName, overwrite){
  const bad = teacherOnly_(); if(bad) return bad;
  const subj = Master.subject(subject);
  const u = subj && subj.units.filter(x => x.name === unitName)[0];
  if(!u) return {ok:false, why:"その単元はありません"};
  const all = Store.readAll(subject);
  let n = 0;
  Roster.all().forEach(st => {
    if(!overwrite && Final.unitValue(subject, st.id, unitName)) return;
    const s = Aggregate.summarize(all[st.id] || {}, u);
    if(s.provSym){ Final.set(subject, st.id, "単元", unitName, s.provSym); n++; }
  });
  return {ok:true, put:n};
}

/* 一斉入力。既定は空欄だけ。 */
function apiBulk(subject, no, sym, overwrite){
  const bad = teacherOnly_(); if(bad) return bad;
  return Store.bulk(subject, no, sym, overwrite);
}

/* 期末評定。選んだ学期の単元だけで出す。0 は学年末（全学期）。 */
function apiTermTable(subject, term){
  const bad = teacherOnly_(); if(bad) return bad;
  const subj = Master.subject(subject);
  if(!subj) return {ok:false, why:"その教科はありません"};
  const units = term ? subj.units.filter(u => u.term === term) : subj.units;
  const all   = Store.readAll(subject);
  const R     = Config.rule();

  const rows = Roster.all().map(st => {
    const per = units.map(u => {
      const f = Final.unitValue(subject, st.id, u.name);
      if(f) return f;
      return Aggregate.summarize(all[st.id] || {}, u, R).provSym;
    });
    const t = Aggregate.termValue(per, R);
    return {
      id: st.id, name: st.name, per: per,
      sym: t.v ? symbolOf(t.v) : null, rank: t.rank,
      final: Final.termRank(subject, st.id, term)
    };
  });
  const dist = {A:0, B:0, C:0};
  rows.forEach(r => { const k = r.final || r.rank; if(k) dist[k]++; });
  return {ok:true, units:units.map(u => u.name), rows:rows,
          dist:dist, rule:R, ruleText: ruleText_(R)};
}

function apiSetRank(subject, term, studentId, rank){
  const bad = teacherOnly_(); if(bad) return bad;
  return Final.set(subject, studentId, "学期", term, rank);
}

function apiAdoptRanks(subject, term){
  const bad = teacherOnly_(); if(bad) return bad;
  const t = apiTermTable(subject, term);
  if(!t.ok) return t;
  let n = 0;
  t.rows.forEach(r => { if(r.rank){ Final.set(subject, r.id, "学期", term, r.rank); n++; } });
  return {ok:true, put:n};
}

/* ---- 設定 ---- */
function apiSaveRule(r){
  const bad = teacherOnly_(); if(bad) return bad;
  const p = {};
  if(r.released !== undefined) p[RELEASE_FROM + "解放"] = !!r.released;
  if(r.aFrom) p["A下限"]   = r.aFrom;
  if(r.cTo)   p["C上限"]   = r.cTo;
  if(r.stat)  p["代表値"]   = r.stat;
  if(r.late)  p["後半の範囲"] = r.late;
  if(r.lock)  p["ロック時刻"] = r.lock;
  if(r.open)  p["開室時刻"]  = r.open;
  configSet(p);
  return {ok:true, rule: Config.rule(), lock: Config.lockTime(),
          open: Config.openTime(), released: Config.released()};
}

function apiSaveUnits(subject, units){
  const bad = teacherOnly_(); if(bad) return bad;
  masterSaveUnits(subject, units);
  return {ok:true, units: Master.subject(subject).units};
}

function apiSaveSubject(name, total, open){
  const bad = teacherOnly_(); if(bad) return bad;
  if(!name) return {ok:false, why:"教科名が空です"};
  masterSaveSubject(String(name).trim(), Number(total) || 0, !!open);
  return {ok:true, subjects: Master.load().subjects};
}

function apiDiagnose(){
  const bad = teacherOnly_(); if(bad) return bad;
  return {ok:true, lines: diagnoseLines()};
}

/* 教師が児童の画面を見る。名簿から誰の分かを選べる。 */
function apiReadAs(subject, studentId){
  const bad = teacherOnly_(); if(bad) return bad;
  const rows = Store.read(subject, studentId);
  return {ok:true, subject:subject, rows:rows,
          units: Aggregate.unitsForStudent(subject, studentId, rows)};
}

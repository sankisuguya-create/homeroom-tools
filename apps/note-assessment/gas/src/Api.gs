/* ==================================================================
   Api.gs — 画面から google.script.run で呼ぶ入口。
   ここに出したものだけが外から呼べる。中の関数は直接呼ばせない。

   どの入口も、役割をメールから引き直すところから始める。
   画面が渡してくる「わたしは誰」は一切見ない。
================================================================== */

/* 単元の評価（仮値の採用）は、記入率がこれ未満の児童には採用しない。
   母数が小さい代表値（中央値など）は1つの記号で大きく動くので、
   その児童自身がほぼ埋め終わってから見せるようにする。8割そのものに
   強い根拠はないが、「大半が埋まっている」を最低条件として置く。

   **学級全体ではなく、児童1人ごとに見る。** 以前は学級全体の記入率で
   「単元の評価をする」自体を押せなくしていたが、それだと足の速い児童の
   評価まで足の遅い児童に合わせて止まってしまう。押す操作そのものは
   いつでもでき、採用されるかどうかを1人ずつのしきい値で決める。 */
const RATE_MIN = 0.8;

/* この児童のこの単元の記入率が、採用してよい水準か。 */
function meetsRate_(s){ return s.total > 0 && (s.n / s.total) >= RATE_MIN; }

/* 単元1つぶんの記入率（学級全体）。児童 × 授業数のうち、何マス埋まっているか。
   休・/ も「入力」として数える（Aggregate.summarize の n と同じ扱い）。
   採用の可否には使わない。設定タブに出す、いまの様子の目安。 */
function unitFillRate_(all, u){
  const ids = Roster.all().map(s => s.id);
  let entered = 0;
  ids.forEach(id => {
    const rec = all[id] || {};
    for(let no = u.from; no <= u.to; no++) if(rec[no]) entered++;
  });
  const total = ids.length * (u.to - u.from + 1);
  return total ? entered / total : 0;
}

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

  const out = {
    ok: true, subject: subject,
    total: subj.total,
    units: Aggregate.unitsForStudent(subject, id, rows),
    rows: rows,
    /* 「ここまで授業があった」の線。実施日は持たないので、学級の入力から引く。
       画面の「のこり」はこの線より手前の空欄だけを数える。
       線を引かないと、まだ習っていない授業まで「のこり」に入り、
       9月に3学期ぶんの22が赤で出る。 */
    taught: Store.taughtUpTo(subject),
    toClose: Hours.minutesToClose(at)
  };

  /* 教師が見るときだけ、授業ごとの学級平均を添える。
     児童には返さない（自分と学級を比べる情報を児童の画面に置かない）。 */
  if(isTeacher){
    const st = Store.lessonStats(subject);
    const avg = {};
    Object.keys(st).forEach(no=>{
      const a = st[no];
      avg[no] = {n: a[0], sym: a[2] ? symbolOfMedian(a[1] / a[2]) : null, scored: a[2]};
    });
    out.avg = avg;
  }
  return out;
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

  let adopted = 0, skipped = 0, noSym = 0;
  if(rated){
    const subj = Master.subject(subject);
    const u = subj.units.filter(x => x.name === unitName)[0];
    const all = Store.readAll(subject);              // 1回だけ読む

    Roster.all().forEach(st => {
      if(Final.unitValue(subject, st.id, unitName)) return;   // 教師が直したものは残す
      const s = Aggregate.summarize(all[st.id] || {}, u);
      /* 入力があっても値のもとになる記号（休・/ 以外）が無い児童は、
         採用にも見送りにも入らない。別に数えて「採用の対象」とずれないようにする。 */
      if(!s.provSym){ noSym++; return; }
      /* この児童自身の記入率が8割未満なら、まだ採用しない。
         見せる／見せないの旗を立てるだけの操作なので、あとで追いつけば
         次の「単元の評価をする」や「仮値をまとめて採用」で拾われる。 */
      if(!meetsRate_(s)){ skipped++; return; }
      Final.set(subject, st.id, "単元", unitName, s.provSym); adopted++;
    });
  }

  sh.getRange(row, 7).setValue(!!rated);
  Master.clearCache();
  return {ok:true, rated: !!rated, adopted: adopted, skipped: skipped, noSym: noSym};
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
    subjects[n] = {name:n, total:all[n].total, from:all[n].from, to:all[n].to,
                   open:all[n].open, units:all[n].units};
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

  const raw  = Store.rawAll(subject);           // 記号だけでなく更新者まで持つ
  const R    = Config.rule();
  const provs = [];
  const rows = Roster.all().map(st => {
    const rr  = raw[st.id] || {};
    const rec = {};
    Object.keys(rr).forEach(no => { rec[no] = rr[no][0]; });
    const s   = Aggregate.summarize(rec, u, R);
    const seq = [], edited = [];
    for(let no = u.from; no <= u.to; no++){
      seq.push(rec[no] || null);
      /* 教師が貫通して書き換えたマスだけ印を付ける。ロックの貫通を
         見えない書き換えにしないため（児童画面の edited 印と対で持つ）。 */
      edited.push(!!(rr[no] && rr[no][2]));
    }
    return {
      id: st.id, name: st.name, seq: seq, edited: edited,
      n: s.n, total: s.total, off: s.off, skip: s.skip,
      prov: s.provSym, provVal: s.prov, all: symbolOfMedian(s.all),
      high: s.high ? symbolOf(s.high) : null,
      top: s.top, c: s.c, d: s.d,
      /* 「単元の評価をする」「仮値をまとめて採用」が実際に採用する児童か。
         記入率が足りない児童と、値のもとになる記号が無い児童（休・/ だけ
         か未入力）は採用されない（apiSetRated / apiAdoptAll と同じ条件）。 */
      ready: meetsRate_(s) && !!s.provSym,
      nosym: !s.provSym,
      final: Final.unitValue(subject, st.id, unitName)
    };
  });

  /* 学級の真ん中からの差を段数で出す。29人ぶんを1人ずつ見比べなくても、
     外れているところだけ見に行ける。中央値を使うのは、1人の突出で
     基準そのものが動かないようにするため。 */
  rows.forEach(r => { if(r.provVal != null) provs.push(r.provVal); });
  const mid = Aggregate.medianVal(provs);
  rows.forEach(r => { r.diff = (mid == null || r.provVal == null)
                               ? null : Math.round(r.provVal - mid); });

  /* rows[].n はこの単元ぶんの記入数なので、和を取れば記入率が出る。
     Store をもう一度読み直す必要はない。 */
  const entered  = rows.reduce((a, r) => a + r.n, 0);
  const possible = rows.length * (u.to - u.from + 1);

  return {ok:true, unit:u, rows:rows, rule:R, ruleText: ruleText_(R),
          mid: symbolOfMedian(mid), midN: provs.length,
          fillRate: possible ? entered / possible : 0, rateMin: RATE_MIN};
}

function ruleText_(R){
  const stat = R.stat;
  /* しきい値が壊れているときは記号が引けない。そのまま表示すると
     見た目は普通なのに中身が全員 A 相当になるので、ここで分かる形にする。 */
  const a = (R.aFrom != null) ? symbolOf(R.aFrom) : "？（A下限が不正）";
  const c = (R.cTo   != null) ? symbolOf(R.cTo)   : "？（C上限が不正）";
  return "A ≧ " + a + " / C ≦ " + c
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
  let n = 0, skipped = 0, noSym = 0;
  Roster.all().forEach(st => {
    if(!overwrite && Final.unitValue(subject, st.id, unitName)) return;
    const s = Aggregate.summarize(all[st.id] || {}, u);
    if(!s.provSym){ noSym++; return; }
    /* apiSetRated と同じしきい値。まとめて採用するボタンからでも、
       記入率8割未満の児童を素通りさせない。 */
    if(!meetsRate_(s)){ skipped++; return; }
    Final.set(subject, st.id, "単元", unitName, s.provSym); n++;
  });
  return {ok:true, put:n, skipped:skipped, noSym:noSym};
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

function apiSaveSubject(name, total, open, from){
  const bad = teacherOnly_(); if(bad) return bad;
  if(!name) return {ok:false, why:"教科名が空です"};
  masterSaveSubject(String(name).trim(), Number(total) || 0, !!open, Number(from) || 1);
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

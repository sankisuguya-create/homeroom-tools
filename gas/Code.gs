/* ==================================================================
   Code.gs — doGet・ルーティング・役割の判定。

   デプロイは「自分（教師）として実行」「同じ組織内の全員がアクセス」。
   「アクセスしているユーザーとして実行」にしてはいけない。児童の権限で
   シートに書くことになり、児童全員に編集権限が渡る。
================================================================== */

function doGet(e){
  const who  = whoAmI();
  const page = (e && e.parameter && e.parameter.p) || "";

  /* 教師画面は URL で振り分けるが、リンクを出さないのは誘導であって
     権限ではない。飛んだ先でも役割をメールから判定し直す。 */
  let file = "hello";
  if(page === "teacher" && who.role === "teacher") file = "hello";

  const t = HtmlService.createTemplateFromFile(file);
  t.boot = JSON.stringify(bootData(who));
  return t.evaluate()
    .setTitle("ノート評価")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* HTML から別ファイルを差し込む。scale.html をクライアントへ渡すのに使う。 */
function include(name){
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ------------------------------------------------------------------
   役割の判定。ここが Step 3 の山場。
   同一 Workspace ドメイン内なら、「自分として実行」でも
   Session.getActiveUser().getEmail() で誰が開いているかは取れる。
------------------------------------------------------------------ */
function whoAmI(){
  let email = "";
  try { email = (Session.getActiveUser().getEmail() || "").trim().toLowerCase(); }
  catch(err){ email = ""; }

  if(!email) return {role: "unknown", email: "", reason: "メールが取れない"};

  if(Config.teacherEmails().indexOf(email) >= 0){
    return {role: "teacher", email: email, name: "先生"};
  }
  const s = Roster.byEmail(email);
  if(s) return {role: "student", email: email, id: s.id, no: s.no, name: s.name};

  return {role: "unknown", email: email, reason: "名簿にも教師メールにも無い"};
}

/* 画面が最初に受け取るもの。ここでは Step 3 の確認に要る分だけ。 */
function bootData(who){
  const w = who || whoAmI();
  const isTeacher = w.role === "teacher";
  return {
    who:      w,
    className: Config.className(),
    year:     Config.year(),
    lockTime: Config.lockTime(),
    subjects: (w.role === "unknown") ? [] : Master.subjectNames(isTeacher),
    boundary: Lock.lastBoundary().toISOString()
  };
}

/* 設定やマスタを直したあとに1回呼ぶ。5分待たずに反映される。 */
function clearAllCache(){
  Config.clearCache(); Roster.clearCache(); Master.clearCache();
}

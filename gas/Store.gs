/* ==================================================================
   Store.gs — 記録シートの読み書き。

   記録は1行1評価の縦持ち。ロックが保存時刻の関数である以上、評価1つごとに
   時刻を持つ必要がある。横持ちでは成立しない。

   列: 教科 / 児童ID / No / 記号 / 保存時刻 / 更新者
================================================================== */
const Store = (function(){
  const SHEET = "記録";
  const COL = {subject:0, id:1, no:2, sym:3, savedAt:4, by:5};
  const WIDTH = 6;

  function sheet(){ return SpreadsheetApp.getActive().getSheetByName(SHEET); }

  function allRows(){
    const sh = sheet();
    const last = sh.getLastRow();
    if(last < 2) return [];
    return sh.getRange(2, 1, last - 1, WIDTH).getValues();
  }

  /* ------------------------------------------------------------------
     読み取り。児童1人・1教科ぶんを、画面がそのまま使える形で返す。
     単元評価はここでは返さない（確定シートから別に返す）。
  ------------------------------------------------------------------ */
  function read(subject, studentId, now){
    const at    = now || new Date();
    const subj  = Master.subject(subject);
    if(!subj) return [];

    const mine = {};
    allRows().forEach(r => {
      if(String(r[COL.subject]) !== subject) return;
      if(String(r[COL.id])      !== String(studentId)) return;
      mine[Number(r[COL.no])] = {sym: String(r[COL.sym]),
                                 savedAt: r[COL.savedAt], by: String(r[COL.by] || "")};
    });

    const out = [];
    for(let no = 1; no <= subj.total; no++){
      const rec  = mine[no];
      const held = Master.isHeld(subject, no, at);
      const sym  = rec ? rec.sym : null;
      out.push({
        no:      no,
        sym:     sym || null,
        savedAt: rec && toDate_(rec.savedAt) ? toDate_(rec.savedAt).toISOString() : null,
        locked:  rec ? Lock.isLocked(rec.savedAt, at) : false,
        /* state は「授業が済んだか」ではなく「転写したか」。
           実施済みかどうかは授業マスタの実施日が持つ。 */
        state:   !held ? "future" : (sym ? "done" : "todo"),
        edited:  !!(rec && rec.by)               // 教師が貫通して書き換えた印
      });
    }
    return out;
  }

  /* 1教科ぶんを一度に読み、児童ごとの {No: 記号} にたたむ。
     29人ぶんを1人ずつ読むとシート全体を29回なめることになる。 */
  function readAll(subject){
    const by = {};
    allRows().forEach(r => {
      if(String(r[COL.subject]) !== subject) return;
      const id = String(r[COL.id]);
      (by[id] || (by[id] = {}))[Number(r[COL.no])] = String(r[COL.sym]);
    });
    return by;
  }

  /* ------------------------------------------------------------------
     保存。画面から渡ってくる値を1つも信用しない。
     児童IDは呼び出し元のメールから引き直し、ロックも時間もここで判定する。
  ------------------------------------------------------------------ */
  function save(subject, no, sym){
    const who = whoAmI();
    const at  = new Date();
    const isTeacher = who.role === "teacher";

    if(who.role === "unknown") return {ok:false, why:"だれか わかりません"};

    /* 記号の検査。20段のほか 休 と / だけ。空は消去。 */
    const s = (sym === null || sym === undefined || sym === "") ? null : String(sym);
    if(s !== null && !isMark(s) && valueOfSym(s) === null)
      return {ok:false, why:"知らない記号"};

    /* / は授業側の都合なので教師だけが置ける。
       画面に出さないのは誘導であって、権限の実装ではない。 */
    if(s === SKIP && !isTeacher) return {ok:false, why:"/ は先生がつけます"};

    const n = Number(no);
    const subj = Master.subject(subject);
    if(!subj || !n || n < 1 || n > subj.total) return {ok:false, why:"その授業はありません"};

    let studentId;
    if(isTeacher){
      return {ok:false, why:"教師の書き込みは saveAs を使う"};
    }else{
      studentId = who.id;
      if(!Master.isOpen(subject))          return {ok:false, why:"その教科はまだ見られません"};
      if(Hours.isClosed(at))               return {ok:false, why:"いまは つかえません"};
      if(!Master.isHeld(subject, n, at))   return {ok:false, why:"まだ その授業は ありません"};
    }
    return write_(subject, studentId, n, s, at, "");
  }

  /* 教師の書き込み。ロック・時間・実施日を貫通する。更新者を必ず残す。 */
  function saveAs(subject, studentId, no, sym, opt){
    const who = whoAmI();
    if(who.role !== "teacher") return {ok:false, why:"先生だけです"};
    const s = (sym === null || sym === undefined || sym === "") ? null : String(sym);
    if(s !== null && !isMark(s) && valueOfSym(s) === null) return {ok:false, why:"知らない記号"};
    const n = Number(no);
    const subj = Master.subject(subject);
    if(!subj || !n || n < 1 || n > subj.total) return {ok:false, why:"その授業はありません"};
    return write_(subject, String(studentId), n, s, new Date(), who.email,
                  opt && opt.overwrite === false);
  }

  /* ------------------------------------------------------------------
     実際に書く。29人が同時に押すので、必ず排他で囲む。
  ------------------------------------------------------------------ */
  function write_(subject, studentId, no, sym, at, by, keepExisting){
    const lock = LockService.getScriptLock();
    if(!lock.tryLock(20000)) return {ok:false, why:"こんでいます。もう一度おしてください"};
    try{
      const sh   = sheet();
      const last = sh.getLastRow();
      let hit = 0;
      if(last >= 2){
        const key = sh.getRange(2, 1, last - 1, 3).getValues();
        for(let i = 0; i < key.length; i++){
          if(String(key[i][0]) === subject &&
             String(key[i][1]) === String(studentId) &&
             Number(key[i][2]) === no){ hit = i + 2; break; }
        }
      }

      /* 一斉入力の既定は「空欄だけ」。すでに入っていれば触らない。 */
      if(hit && keepExisting){
        const cur = sh.getRange(hit, COL.sym + 1).getValue();
        if(cur !== "" && cur !== null) return {ok:true, skipped:true};
      }

      /* 児童の書き込みは、サーバ側でロックを引き直す。
         端末の時計は児童が変えられるので、画面の判定は当てにしない。 */
      if(hit && !by){
        const savedAt = sh.getRange(hit, COL.savedAt + 1).getValue();
        if(Lock.isLocked(savedAt, at)) return {ok:false, why:"きのうまでの ぶんは なおせません"};
      }

      if(sym === null){
        if(hit) sh.deleteRow(hit);
        return {ok:true, sym:null};
      }
      const row = [subject, studentId, no, sym, at, by || ""];
      if(hit) sh.getRange(hit, 1, 1, WIDTH).setValues([row]);
      else    sh.appendRow(row);
      return {ok:true, sym:sym, savedAt:at.toISOString()};
    } finally {
      lock.releaseLock();
    }
  }

  /* 単元内の1授業を全員に。学級閉鎖・行事・出張のための機能。 */
  function bulk(subject, no, sym, overwrite){
    const who = whoAmI();
    if(who.role !== "teacher") return {ok:false, why:"先生だけです"};
    let put = 0, over = 0;
    Roster.all().forEach(s => {
      const r = saveAs(subject, s.id, no, sym, {overwrite: !!overwrite});
      if(r.ok && !r.skipped){ put++; if(overwrite) over++; }
    });
    return {ok:true, put:put, over:over};
  }

  return {read, readAll, save, saveAs, bulk};
})();

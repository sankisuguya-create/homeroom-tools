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
     児童ごとの記録をキャッシュに置く。

     29人が順に開くと、同じ記録シートを29回なめることになる。年度末には
     7,500行あるので、1回あたり数百ms がまるまる無駄になる。
     **最初の1人がシートを1回読み、そのとき29人ぶんを全部作って置く。**
     残りの28人は読まない。

     書いたときは、その児童のぶんだけ捨てる。教師がシートを手で直したときは
     メニューの「キャッシュを消す」で全部捨てる。
  ------------------------------------------------------------------ */
  const TTL = 1800;                               // 30分
  const keyOf  = (subject, id) => "rec|" + subject + "|" + id;
  const statKey = subject => "lsn|" + subject;
  /* 保存用の行索引：{児童ID → {"教科|No": 行番号}}。
     全件をなめて作るのは索引が無いときだけ。ずれは検証（write_）で潰す。 */
  const idxKey   = id => "ridx|" + id;
  const IDX_BUILT = "ridx|built";                  // 索引を作った時点の行数

  /* 記録シートを1回なめて全員ぶんの行索引を作る。
     0件の児童も鍵を作る（無いと、行が無い児童の保存ごとに作り直しになる）。 */
  function idxBuild_(){
    const cs = CacheService.getScriptCache();
    const sh = sheet();
    const last = sh.getLastRow();
    const per = {};
    Roster.all().forEach(st => { per[String(st.id)] = {}; });
    if(last >= 2){
      const v = sh.getRange(2, 1, last - 1, 3).getValues();
      for(let i = 0; i < v.length; i++){
        const id = String(v[i][1]);
        (per[id] || (per[id] = {}))[String(v[i][0]) + "|" + Number(v[i][2])] = i + 2;
      }
    }
    const put = {};
    Object.keys(per).forEach(id => { put[idxKey(id)] = JSON.stringify(per[id]); });
    put[IDX_BUILT] = String(last);
    try { cs.putAll(put, TTL); } catch(e) {}
  }

  /* 行の削除は全員の索引をずらすので、教科ではなくまとめて捨てる。 */
  function idxDrop_(){
    const cs = CacheService.getScriptCache();
    cs.remove(IDX_BUILT);
    Roster.all().forEach(st => cs.remove(idxKey(st.id)));
  }

  /* 授業ごとの、学級全体の入った人数と評価の合計。
     {No: [入った人数, 評価の合計, 評価の人数]}。休 と / は人数には入るが
     評価の合計には入らない（尺度の値を持たないため）。 */
  function statsFrom_(by){
    const st = {};
    Object.keys(by).forEach(id=>{
      const m = by[id];
      Object.keys(m).forEach(no=>{
        const a = st[no] || (st[no] = [0, 0, 0]);
        a[0]++;
        const v = valueOfSym(m[no][0]);
        if(v != null){ a[1] += v; a[2]++; }
      });
    });
    return st;
  }

  function loadAll_(subject){
    const by = {};
    Roster.all().forEach(st => { by[st.id] = {}; });   // 空の児童も鍵を作る
    allRows().forEach(r => {
      if(String(r[COL.subject]) !== subject) return;
      const id = String(r[COL.id]);
      const d  = toDate_(r[COL.savedAt]);
      (by[id] || (by[id] = {}))[Number(r[COL.no])] =
        [String(r[COL.sym]), d ? d.getTime() : 0, String(r[COL.by] || "")];
    });
    const put = {};
    Object.keys(by).forEach(id => { put[keyOf(subject, id)] = JSON.stringify(by[id]); });
    put[statKey(subject)] = JSON.stringify(statsFrom_(by));
    try { CacheService.getScriptCache().putAll(put, TTL); } catch(e) { /* 入らなくても動く */ }
    return by;
  }

  /* 授業ごとの学級集計。
     **シートは読まない。** 29人ぶんの記録はすでにキャッシュにあるので、
     そこから組み直す。1人でも欠けていれば数がずれるので、そのときだけ読む。 */
  function lessonStats(subject){
    const cs = CacheService.getScriptCache();
    const c  = cs.get(statKey(subject));
    if(c) return JSON.parse(c);

    const ids  = Roster.all().map(st => String(st.id));
    const keys = ids.map(id => keyOf(subject, id));
    const got  = cs.getAll(keys) || {};
    const by   = {};
    let missing = false;
    ids.forEach((id, i) => {
      const v = got[keys[i]];
      if(v === undefined || v === null) missing = true; else by[id] = JSON.parse(v);
    });
    const st = statsFrom_(missing ? loadAll_(subject) : by);
    if(!missing){ try { cs.put(statKey(subject), JSON.stringify(st), TTL); } catch(e) {} }
    return st;
  }

  /* 「ここまで授業があった」とみなす番号。
     実施日は持たないので、**学級の入力そのものを実施の証拠に使う**。
     3人以上が入れている最大の No までを、済んだ授業とみなす。
     1人の押し間違いで線が飛ばないよう、1人では足りないことにしてある。 */
  function taughtUpTo(subject){
    const need = Math.min(3, Roster.all().length || 1);
    const st = lessonStats(subject);
    let top = 0;
    Object.keys(st).forEach(no => { if(st[no][0] >= need && Number(no) > top) top = Number(no); });
    return top;
  }

  /* 児童1人ぶんの {No: [記号, 保存時刻, 更新者]}。 */
  function recOf(subject, studentId){
    const c = CacheService.getScriptCache().get(keyOf(subject, studentId));
    if(c) return JSON.parse(c);
    return loadAll_(subject)[String(studentId)] || {};
  }

  function dropCache(subject, studentId){
    const cs = CacheService.getScriptCache();
    if(studentId) cs.remove(keyOf(subject, studentId));
    else Roster.all().forEach(st => cs.remove(keyOf(subject, st.id)));
    cs.remove(statKey(subject));
    if(!studentId) idxDrop_();                    // 手直しを前提に全部捨てる
  }

  /* 書いたあと、その児童のキャッシュだけを新しい値に差し替える。
     捨てると、次に開いた1人がシート全体をなめ直すことになる。
     学級集計はその場で作り直せるので消してよい（読み直しは起きない）。 */
  function touchCache_(subject, studentId, no, sym, atMs, by){
    const cs = CacheService.getScriptCache();
    const k  = keyOf(subject, studentId);
    const c  = cs.get(k);
    cs.remove(statKey(subject));
    if(c === null){ cs.remove(k); return; }        // 無ければ次の読みで作られる
    const m = JSON.parse(c);
    if(sym === null) delete m[no]; else m[no] = [String(sym), atMs, String(by || "")];
    try { cs.put(k, JSON.stringify(m), TTL); } catch(e) { cs.remove(k); }
  }

  /* ------------------------------------------------------------------
     読み取り。児童1人・1教科ぶんを、画面がそのまま使える形で返す。
     単元評価はここでは返さない（確定シートから別に返す）。
  ------------------------------------------------------------------ */
  function read(subject, studentId, now){
    const at   = now || new Date();
    const subj = Master.subject(subject);
    if(!subj) return [];

    const mine = recOf(subject, studentId);
    const out  = [];
    for(let no = subj.from; no <= subj.to; no++){
      const r = mine[no];                        // [記号, 保存時刻(ms), 更新者]
      const sym = r ? r[0] : null;
      out.push({
        no:      no,
        sym:     sym || null,
        locked:  r && r[1] ? Lock.isLocked(new Date(r[1]), at) : false,
        /* state は「転写したか」だけを持つ。
           「授業が済んだか」は追わない。時数の範囲は全部いつでも入れられる。 */
        state:   sym ? "done" : "todo",
        edited:  !!(r && r[2])                   // 教師が貫通して書き換えた印
      });
    }
    return out;
  }

  /* 1教科ぶんを一度に読み、児童ごとの {No: 記号} にたたむ。
     29人ぶんを1人ずつ読むとシート全体を29回なめることになる。 */
  function readAll(subject){
    const raw = loadAll_(subject);               // 教師画面は必ず最新を見る
    const by  = {};
    Object.keys(raw).forEach(id => {
      const m = {};
      Object.keys(raw[id]).forEach(no => { m[no] = raw[id][no][0]; });
      by[id] = m;
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

    /* Y 以上は、教師が解放するまで児童から書けない。
       選択肢に出さないのも誘導であって、権限はここで守る。 */
    if(s !== null && !isTeacher && isReleaseSym(s) && !Config.released())
      return {ok:false, why:"その きごうは まだ つかえません"};

    const n = Number(no);
    const subj = Master.subject(subject);
    if(!subj || !n || n < subj.from || n > subj.to) return {ok:false, why:"その授業はありません"};

    let studentId;
    if(isTeacher){
      return {ok:false, why:"教師の書き込みは saveAs を使う"};
    }else{
      studentId = who.id;
      if(!Master.isOpen(subject))          return {ok:false, why:"その教科はまだ見られません"};
      if(Hours.isClosed(at))               return {ok:false, why:"いまは つかえません"};
    }
    return write_(subject, studentId, n, s, at, "");
  }

  /* 教師の書き込み。ロック・時間を貫通する。更新者を必ず残す。 */
  function saveAs(subject, studentId, no, sym, opt){
    const who = whoAmI();
    if(who.role !== "teacher") return {ok:false, why:"先生だけです"};
    const s = (sym === null || sym === undefined || sym === "") ? null : String(sym);
    if(s !== null && !isMark(s) && valueOfSym(s) === null) return {ok:false, why:"知らない記号"};
    const n = Number(no);
    const subj = Master.subject(subject);
    if(!subj || !n || n < subj.from || n > subj.to) return {ok:false, why:"その授業はありません"};
    return write_(subject, String(studentId), n, s, new Date(), who.email,
                  opt && opt.overwrite === false);
  }

  /* ------------------------------------------------------------------
     実際に書く。29人が同時に押すので、必ず排他で囲む。

     行の位置はシートの全件スキャンではなく、児童ごとの行索引
     （キャッシュ）から引く。全件スキャンは年度末でも数百msかかり、
     ロックの内側にあると29人ぶんが直列に積み上がる。
     索引はずれうる（行の削除・手で足した行）ので、当たった行の
     キー列を毎回確かめる。1セルぶんの読み取りでずれに気づける。
  ------------------------------------------------------------------ */
  function write_(subject, studentId, no, sym, at, by, keepExisting){
    const lock = LockService.getScriptLock();
    if(!lock.tryLock(20000)) return {ok:false, why:"こんでいます。もう一度おしてください"};
    try{
      const sh   = sheet();
      const cs   = CacheService.getScriptCache();
      const iKey = idxKey(studentId), bKey = subject + "|" + no;

      let idx = JSON.parse(cs.get(iKey) || "null");
      if(idx === null){ idxBuild_(); idx = JSON.parse(cs.get(iKey) || "{}"); }
      let hit = idx[bKey] || 0;

      /* 索引が当たったら、そこが本当にその授業の行かを確かめる。
         途中で行が消えて・挿し込まれてずれていれば、索引を作り直す。 */
      if(hit){
        const chk = sh.getRange(hit, 1, 1, 3).getValues()[0];
        if(String(chk[0]) !== subject || String(chk[1]) !== String(studentId) ||
           Number(chk[2]) !== no){
          idxBuild_();
          idx = JSON.parse(cs.get(iKey) || "{}");
          hit = idx[bKey] || 0;
        }
      }else if(sh.getLastRow() > Number(cs.get(IDX_BUILT) || 0)){
        /* 索引を作ったあとに行が増えている。手で足された行かもしれないので作り直す。 */
        idxBuild_();
        idx = JSON.parse(cs.get(iKey) || "{}");
        hit = idx[bKey] || 0;
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
        if(hit){ sh.deleteRow(hit); idxDrop_(); }   // 行番号がずれるので索引ごと捨てる
        touchCache_(subject, studentId, no, null, 0, "");
        return {ok:true, sym:null};
      }
      const row = [subject, studentId, no, sym, at, by || ""];
      if(hit) sh.getRange(hit, 1, 1, WIDTH).setValues([row]);
      else    sh.appendRow(row);
      /* 自分が書いた位置を索引にも入れる（追記で行数が伸びたぶんも合わせる）。 */
      idx[bKey] = hit || sh.getLastRow();
      try { cs.put(iKey, JSON.stringify(idx), TTL);
            cs.put(IDX_BUILT, String(sh.getLastRow()), TTL); } catch(e) {}
      touchCache_(subject, studentId, no, sym, at.getTime(), by || "");
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
    dropCache(subject);                 // 一斉に入れたので教科ぶんまとめて捨てる
    return {ok:true, put:put, over:over};
  }

  /* readAll は記号だけに削ぎ落とすので、誰が書いたか（貫通の印）が消える。
     教師画面で「どのマスが貫通で直されたか」を出すために、削らない形も返す。 */
  function rawAll(subject){ return loadAll_(subject); }   // {id: {no: [記号, 保存時刻ms, 更新者]}}

  return {read, readAll, rawAll, save, saveAs, bulk, dropCache, lessonStats, taughtUpTo};
})();

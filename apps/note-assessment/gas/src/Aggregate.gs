/* ==================================================================
   Aggregate.gs — 単元評価と期末評定の計算。
   apps/note-assessment/web/dist/teacher-view.html の集計をそのまま移したもの。

   平均は取らない。順序尺度なので D→C の幅と A+→Z− の幅が等しい保証がない。
   休 と / は分母からも外し、理由が違うので別々に数える。
   D は含める（既定）。態度を測っているので「やらなかった」は欠測ではない。
================================================================== */
const Aggregate = (function(){

  function medianVal(a){
    if(!a.length) return null;
    const s = a.slice().sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;   // 偶数個は中間（.5 を許す）
  }
  function modeVal(a){
    if(!a.length) return null;
    const c = {}; a.forEach(v => c[v] = (c[v] || 0) + 1);
    let best = 0; Object.keys(c).forEach(k => { if(c[k] > best) best = c[k]; });
    const tied = Object.keys(c).filter(k => c[k] === best).map(Number);
    return tied[tied.length - 1];
  }

  function meanVal(a){
    if(!a.length) return null;
    let t = 0; a.forEach(v => t += v);
    return t / a.length;
  }
  /* 最大と最小を1つずつ落としてから平均する。1回の突出や1回の落ち込みで
     代表値が動くのを抑える。3つ未満なら落とさない（落とすと何も残らない）。 */
  function trimmedMeanVal(a){
    if(a.length < 3) return meanVal(a);
    const s = a.slice().sort((x, y) => x - y);
    return meanVal(s.slice(1, s.length - 1));
  }

  /* 児童1人・単元1つ。rec は {No: 記号} の連想。 */
  function summarize(rec, u, R){
    R = R || Config.rule();
    const seq = [];
    for(let no = u.from; no <= u.to; no++) seq.push(rec[no] || null);

    const entered = seq.filter(Boolean);
    const off     = entered.filter(x => x === OFF).length;
    const skip    = entered.filter(x => x === SKIP).length;
    const vals    = entered.filter(x => !isMark(x)).map(valueOfSym);

    let scored = vals;
    if(!R.withD) scored = scored.filter(v => baseOf(v) !== "D");
    if(!R.withC) scored = scored.filter(v => baseOf(v) !== "C");

    let prov = null;
    if(scored.length){
      const late = () => scored.slice(-Math.max(1, Math.ceil(scored.length / R.late)));
      if(R.stat === "最高")               prov = Math.max.apply(null, scored);
      else if(R.stat === "最頻値")         prov = modeVal(scored);
      else if(R.stat === "全体の中央値")    prov = medianVal(scored);
      else if(R.stat === "平均値")         prov = meanVal(scored);
      else if(R.stat === "後半の平均値")    prov = meanVal(late());
      /* 順序尺度なので平均は本来取れない（D→C の幅と A+→A++ の幅が
         等しい保証がない）。それでも使うなら、外れ値に動かされにくい
         「最大最小を1ずつ落とした平均」のほうが実態に近い。 */
      else if(R.stat === "内側の平均値")    prov = trimmedMeanVal(scored);
      else {                                       // 既定：後半の中央値
        prov = medianVal(late());
      }
    }
    return {
      n: entered.length, total: u.to - u.from + 1, off: off, skip: skip,
      prov: prov,
      provSym: symbolOfMedian(prov),
      all:  medianVal(scored),
      high: scored.length ? Math.max.apply(null, scored) : null,
      top:  vals.filter(isTopVal).length,
      c:    vals.filter(v => baseOf(v) === "C").length,
      d:    vals.filter(v => baseOf(v) === "D").length
    };
  }

  /* 評定への写像。記号は上振れしているので、A になるのは A+ 以上。
     しきい値（A下限・C上限）が壊れているときは null を返す——
     null との比較は必ず真になるので、そのまま評定すると全員が A になる。
     出さないほうが設定ミスに気づける。診断（diagnoseLines）もこの2つを見る。 */
  function rankOf(v, R){
    R = R || Config.rule();
    if(v == null || R.aFrom == null || R.cTo == null) return null;
    return v >= R.aFrom ? "A" : v <= R.cTo ? "C" : "B";
  }

  /* 学期のまとめ。単元の確定値（採用があればそれ、なければ仮値）から出す。 */
  function termValue(settledSyms, R){
    R = R || Config.rule();
    const vals = settledSyms.filter(Boolean).map(valueOfSym).filter(v => v != null);
    if(!vals.length) return {v: null, rank: null};
    let v;
    if(R.stat === "最頻値")           v = modeVal(vals);
    else if(R.stat === "最後の単元")    v = vals[vals.length - 1];
    else if(R.stat === "平均値")       v = Math.floor(meanVal(vals));
    else if(R.stat === "内側の平均値")  v = Math.floor(trimmedMeanVal(vals));
    else                             v = Math.floor(medianVal(vals));
    return {v: v, rank: rankOf(v, R)};
  }

  /* 児童1人ぶんの記録を {No: 記号} にたたむ。Store.read の出力から作る。 */
  function foldRows(rows){
    const rec = {};
    rows.forEach(r => { if(r.sym) rec[r.no] = r.sym; });
    return rec;
  }

  /* 児童の画面に返す単元評価。
     「単元の評価をする」を押していない単元は値を返さない。押した後に返すのは
     確定シートの採用値で、ここで計算し直した仮値ではない。
     計算し直すと、押した後も転写を書き換えるたびに数字が動いてしまう。 */
  function unitsForStudent(subject, studentId, rows){
    const subj = Master.subject(subject);
    if(!subj) return [];
    const rec = foldRows(rows);
    return subj.units.map(u => {
      const s = summarize(rec, u);
      const shown = u.rated;
      return {
        name: u.name, from: u.from, to: u.to, c: u.c, term: u.term, rated: u.rated,
        n: s.n, total: s.total, off: s.off, skip: s.skip,
        /* 押すまでは値も「いちばん」も「突破の回数」も返さない。
           クライアントで隠すのではなく、そもそも渡さない。 */
        sym:  shown ? Final.unitValue(subject, studentId, u.name) : null,
        high: shown ? s.high : null,
        top:  shown ? s.top  : null
      };
    });
  }

  return {medianVal, modeVal, meanVal, trimmedMeanVal,
          summarize, rankOf, termValue, foldRows, unitsForStudent};
})();

/* ==================================================================
   Final — 確定シート。教師が採用した値だけが入る。仮値は入れない。
   列: 教科 / 児童ID / 種別 / 対象 / 値 / 確定時刻
================================================================== */
const Final = (function(){
  const SHEET = "確定";
  const COL = {subject:0, id:1, kind:2, target:3, value:4, at:5};

  function sheet(){ return SpreadsheetApp.getActive().getSheetByName(SHEET); }

  function all(){
    const sh = sheet(), last = sh.getLastRow();
    if(last < 2) return [];
    return sh.getRange(2, 1, last - 1, 6).getValues();
  }

  /* {教科|児童ID|種別|対象 → {row, value}} の索引。実行のあいだだけ持つ。
     これが無いと apiTermTable や exportTerm のように 児童 × 単元 で
     find を呼ぶところが、呼ぶたびシート全体を読み直して数十秒かかる。
     **1回読んで引ける形にする。** 書き込みは索引も一緒に直し、
     行の削除（番号がずれる）のときだけ索引ごと捨てる。 */
  let IDX_ = null;
  const keyOf_ = (subject, studentId, kind, target) =>
    subject + "|" + studentId + "|" + kind + "|" + target;

  function idx(){
    if(IDX_) return IDX_;
    IDX_ = {};
    all().forEach((r, i) => {
      IDX_[keyOf_(r[COL.subject], r[COL.id], r[COL.kind], r[COL.target])] =
        {row: i + 2, value: String(r[COL.value])};
    });
    return IDX_;
  }

  function find(subject, studentId, kind, target){
    return idx()[keyOf_(subject, studentId, kind, target)] || null;
  }

  function unitValue(subject, studentId, unitName){
    const f = find(subject, studentId, "単元", unitName);
    return f ? f.value : null;
  }
  function termRank(subject, studentId, term){
    const f = find(subject, studentId, "学期", term);
    return f ? f.value : null;
  }

  function set(subject, studentId, kind, target, value){
    const who = whoAmI();
    if(who.role !== "teacher") return {ok:false, why:"先生だけです"};
    /* 値の語彙はここで守る。単元はスケールの記号、学期は A/B/C の評定。
       外れた値が入ると読む側の検査で黙って落ち、壊れた行だけが残る。 */
    if(value !== null && value !== ""){
      const bad = (kind === "学期") ? ["A","B","C"].indexOf(value) < 0
                : (kind === "単元") ? valueOfSym(value) === null : false;
      if(bad) return {ok:false, why:"その値は置けません"};
    }
    const lock = LockService.getScriptLock();
    if(!lock.tryLock(20000)) return {ok:false, why:"こんでいます"};
    try{
      const sh  = sheet();
      const hit = find(subject, studentId, kind, target);
      if(value === null || value === ""){
        if(hit){ sh.deleteRow(hit.row); IDX_ = null; }   // 行番号がずれる
        return {ok:true, value:null};
      }
      const row = [subject, studentId, kind, target, value, new Date()];
      if(hit){
        sh.getRange(hit.row, 1, 1, 6).setValues([row]);
        hit.value = String(value);                       // 索引も当て直す
      }else{
        sh.appendRow(row);
        idx()[keyOf_(subject, studentId, kind, target)] =
          {row: sh.getLastRow(), value: String(value)};
      }
      return {ok:true, value:value};
    } finally { lock.releaseLock(); }
  }

  return {unitValue, termRank, set, find};
})();

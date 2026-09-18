/* このファイルは gas/*.gs をまとめて build.py が作る。
   Apps Script に貼るのはこの1本でよい。直すのは元の gas/*.gs のほう。
   ここを直しても次のビルドで消える。 */

/* ==================== Scale.gs ==================== */
/* このファイルは prototypes/src/scale.js から build.py が作る。
   直すのは src のほう。ここを直しても次のビルドで消える。 */
/* ==================================================================
   評価スケール — プロジェクトの正本。
   児童画面と教師画面がこの1ファイルを読む。build.py が両方に差し込む。
   実装では GAS の Scale.gs と scale.html になる。

   段は**表**で持つ。以前は「基本字 × ニュアンス4」の掛け算で出していたが、
   上端だけ段数が違う形になったので、掛け算では表せなくなった。
   表なら、どの帯が何段でも同じ規則で扱える。

   保存は記号の文字列で行い、計算のときだけ値に変換する。
================================================================== */

/* 基本字は下から上へ。上位が増えたら末尾に足す。
   途中に差し込むと既存の内部値がずれて、過去の記録の意味が変わる。 */
const BASES = ["D","C","B","A","Z","Y"];

/* 帯ごとの刻み。段数は帯によって違う。

   D は1段。「やるべきことを何もしていない」に濃淡は要らない。
   C は2段。届いていない中での差はこの2つで足りる。
   B と A は4段。ここが最頻帯で、いちばん細かく見分ける。
   Z と Y は2段。上端でその細かさは使い分けられない。

   帯ごとに幅を変えたのは、**見分けが要るところに段を寄せる**ため。
   均等に刻むと、使わない段が増えるだけで判定が重くなる。 */
const MODS_ONE  = [""];
const MODS_TWO  = ["", "+"];
const MODS_FULL = ["−", "", "+", "++"];
const MODS_OF = {
  "D": MODS_ONE,  "C": MODS_TWO,
  "B": MODS_FULL, "A": MODS_FULL,
  "Z": MODS_TWO,  "Y": MODS_TWO
};

/* 内部値 1..N の並び。ここが唯一の正本で、変換はすべてこの表を引く。 */
const LEVELS = [];
BASES.forEach(b => (MODS_OF[b] || MODS_FULL).forEach(m => LEVELS.push(b + m)));
const NLEVEL = LEVELS.length;          // 15
const NBASE  = BASES.length;
const ALL_SYMS = LEVELS.slice();

/* 層の境目。コードのどこにも "Z" や "Y" を直接書かない。
   書いた瞬間、基本字を足したときにそこだけ取り残される。 */
const TOP_FROM     = "Z";   // これ以上は突破層（箔をかける・突破回数に数える）
const WARN_TO      = "C";   // これ以下は警告層（文字を赤にする）
const RELEASE_FROM = "Y";   // これ以上は、教師が解放するまで児童に出さない

/* 突破層の見た目は基本字ごとに1つ。段では変えない。
   字を足したらここに1行足す。未登録の字は金の箔。実体は material.css。 */
const BASE_LOOK = { "Z":"foil-gold", "Y":"foil-cosmic" };

/* スケールに乗らない記号。どちらも集計から外すが、理由が違うので分けて数える。
   休：児童がいなかった（個人の欠測）
   / ：その授業を評価に含めない（授業側の都合）。教師だけが設定する。 */
const OFF = "休", SKIP = "/";
const isMark = sym => sym === OFF || sym === SKIP;

const iTop     = BASES.indexOf(TOP_FROM);
const iWarn    = BASES.indexOf(WARN_TO);
const iRelease = BASES.indexOf(RELEASE_FROM);

/* 記号 → 基本字。スケール外（休・/・空・知らない記号）は "" を返す。 */
function baseOfSym(sym){
  if(!sym || isMark(sym)) return "";
  const b = String(sym).charAt(0);
  return BASES.indexOf(b) >= 0 ? b : "";
}
const iOf = sym => { const b = baseOfSym(sym); return b ? BASES.indexOf(b) : -1; };

const isTopSym     = sym => iOf(sym) >= iTop;
const isWarnSym    = sym => { const i = iOf(sym); return i >= 0 && i <= iWarn; };
const isReleaseSym = sym => iOf(sym) >= iRelease;   // 解放されるまで児童に出さない段

/* valueOf という名前は使わない。Object.prototype.valueOf と同名で、
   GAS ではトップレベル宣言がグローバルオブジェクト上のそれを隠す。 */
function valueOfSym(sym){                          // "A++" → 16／スケール外は null
  if(!sym || isMark(sym)) return null;
  const i = LEVELS.indexOf(String(sym));
  return i < 0 ? null : i + 1;
}
const symbolOf = v => LEVELS[v - 1];               // 16 → "A++"
const baseOf   = v => baseOfSym(LEVELS[v - 1]);
const isTopVal  = v => iOf(LEVELS[v - 1]) >= iTop;
const isWarnVal = v => { const i = iOf(LEVELS[v - 1]); return i >= 0 && i <= iWarn; };

/* 材質のクラス名。基本字ごとに1つ。 */
const lookOf = sym => BASE_LOOK[baseOfSym(sym)] || "foil-gold";

/* 帯の先頭の内部値。折れ線の目盛りを引くのに使う。 */
function bandStart(base){
  const i = LEVELS.indexOf(base + (MODS_OF[base] || MODS_FULL)[0]);
  return i + 1;
}
const bandSize = base => (MODS_OF[base] || MODS_FULL).length;

/* 児童に出してよい記号。解放されていない帯（Y 以上）を落とす。
   すでに入っている記号は、値が消えないよう残す。 */
function symsFor(opt){
  const released = !!(opt && opt.released);
  const keep     = opt && opt.keep;
  return LEVELS.filter(s => released || !isReleaseSym(s) || s === keep);
}

/* 中央値が2段の間に落ちたときは下側を採る（水増ししない）。
   順序尺度なので平均は取れない。 */
const symbolOfMedian = m => (m == null) ? null : symbolOf(Math.floor(m));

/* 古い記号を今の記号に置き換える表。
   D の4段を1段に、C の4段を2段に畳んだぶん、**内部値は動く**。
   意味が同じところへ寄せてある（D 系はすべて D、C−/C は C、C+/C++ は C+）。
   B 以上は記号も意味も変わらない。

   ※ 前の版（Z−/Z++ を捨てて Y を足した）からの置換もここに含めてある。
     すでに置換ずみのシートに対しては、その行が当たらないだけで害はない。 */
const SYM_MIGRATION = {
  "D−":"D", "D+":"D", "D++":"D",          // D は1段に畳む
  "C−":"C", "C++":"C+",                    // C は2段に畳む
  "Z−":"Z", "Z++":"Y+"                     // 前の版の名残
};

/* ==================== Config.gs ==================== */
/* ==================================================================
   Config.gs — 設定シートの読み書き。
   1回のリクエストで何度も読むので CacheService に5分置く。
   教師が設定を変えたら clearCache() を呼ぶ。
================================================================== */
const Config = (function(){
  const KEY = "cfg";
  const TTL = 300;                                  // 5分

  function raw(){
    const c = CacheService.getScriptCache().get(KEY);
    if(c) return JSON.parse(c);
    const sh = SpreadsheetApp.getActive().getSheetByName("設定");
    const v  = sh.getDataRange().getValues();
    const o  = {};
    for(let i = 1; i < v.length; i++){
      if(v[i][0] === "") continue;
      o[String(v[i][0]).trim()] = v[i][1];
    }
    CacheService.getScriptCache().put(KEY, JSON.stringify(o), TTL);
    return o;
  }

  function clearCache(){ CacheService.getScriptCache().remove(KEY); }

  function get(key, fallback){
    const v = raw()[key];
    return (v === undefined || v === "") ? fallback : v;
  }

  /* 時刻の欄。
     シートが時刻型に変えてしまうと、スプレッドシートのタイムゾーンで
     解釈された Date が返り、「8:00 と入れたのに違う時刻になる」が起きる。
     **書くときは文字列として書き（configSet が書式を文字列に固定する）、
     読むときは文字と Date の両方を受ける。**
     Date で来た場合は、スクリプトのタイムゾーン（Asia/Tokyo）で読み直す。 */
  function timeOf(key, dh, dm){
    const v = get(key, "");
    if(Object.prototype.toString.call(v) === "[object Date]"){
      const t = Utilities.formatDate(v, Session.getScriptTimeZone(), "HH:mm").split(":");
      return {h: +t[0], m: +t[1]};
    }
    const m = String(v).match(/(\d{1,2})[:：](\d{1,2})/);
    return m ? {h: +m[1], m: +m[2]} : {h: dh, m: dm};
  }

  /* ロック時刻。児童が使える時間の終わりでもある（Hours.gs を見よ）。 */
  function lockTime(){ return timeOf("ロック時刻", 16, 0); }

  /* 開室時刻。ここから児童が使える。 */
  function openTime(){ return timeOf("開室時刻", 8, 0); }

  /* Y 以上を児童に出すか。既定は出さない。教師が設定で解放する。
     出さないだけでなく、保存も断る（Store.save）。 */
  function released(){
    const v = get(RELEASE_FROM + "解放", false);
    return v === true || String(v).toUpperCase() === "TRUE";
  }

  function teacherEmails(){
    return String(get("教師メール", ""))
      .split(/[\s,、]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  }

  /* 集計の式。teacher-view.html の R にあたる。 */
  function rule(){
    return {
      aFrom:  valueOfSym(String(get("A下限", "A+"))),
      cTo:    valueOfSym(String(get("C上限", "C+"))),
      stat:   String(get("代表値", "後半の中央値")),
      late:   Number(get("後半の範囲", 3)) || 3,
      withD:  get("Dを含める", true) !== false,
      withC:  get("Cを含める", true) !== false
    };
  }

  return {get, lockTime, openTime, released, teacherEmails, rule, clearCache,
          className: () => String(get("学級", "")),
          year:      () => Number(get("年度", 0))};
})();

/* ==================================================================
   設定シートへの書き戻し。教師画面から呼ぶ。
   キーが無ければ足す。あれば書き換える。
================================================================== */
function configSet(pairs){
  const sh = SpreadsheetApp.getActive().getSheetByName("設定");
  const v  = sh.getDataRange().getValues();
  const at = {};
  for(let i = 1; i < v.length; i++) at[String(v[i][0]).trim()] = i + 1;

  Object.keys(pairs).forEach(k => {
    const v = pairs[k];
    /* 時刻は文字列のまま持つ。シートに時刻型へ変えられると、
       スプレッドシートのタイムゾーンで解釈されて別の時刻になる。 */
    const isTime = /時刻$/.test(k);
    const cell = at[k] ? sh.getRange(at[k], 2) : null;
    if(cell){
      if(isTime) cell.setNumberFormat("@");
      cell.setValue(v);
    }else{
      sh.appendRow([k, v]);
      if(isTime) sh.getRange(sh.getLastRow(), 2).setNumberFormat("@").setValue(v);
    }
  });
  Config.clearCache();
}

/* ==================== Roster.gs ==================== */
/* ==================================================================
   Roster.gs — 名簿。メール から 児童ID。
   クライアントから渡された児童IDは決して信用しない。必ずここを通す。
================================================================== */
const Roster = (function(){
  const KEY = "roster";
  const TTL = 300;

  function all(){
    const c = CacheService.getScriptCache().get(KEY);
    if(c) return JSON.parse(c);
    const sh = SpreadsheetApp.getActive().getSheetByName("名簿");
    const v  = sh.getDataRange().getValues();
    const list = [];
    for(let i = 1; i < v.length; i++){
      if(v[i][0] === "") continue;
      list.push({
        id:    String(v[i][0]).trim(),
        no:    Number(v[i][1]) || 0,
        name:  String(v[i][2]).trim(),
        email: String(v[i][3]).trim().toLowerCase()
      });
    }
    list.sort((a, b) => a.no - b.no);
    CacheService.getScriptCache().put(KEY, JSON.stringify(list), TTL);
    return list;
  }

  function byEmail(email){
    if(!email) return null;
    const e = String(email).trim().toLowerCase();
    return all().filter(s => s.email && s.email === e)[0] || null;
  }

  function names(){ return all().map(s => s.name); }

  function clearCache(){ CacheService.getScriptCache().remove(KEY); }

  return {all, byEmail, names, clearCache};
})();

/* ==================== Master.gs ==================== */
/* ==================================================================
   Master.gs — 教科マスタ・単元マスタ。
   単元マスタは両画面が読む1つの正本。ここが割れると、教師が設定した
   単元の色や学期が児童画面に届かなくなる。
================================================================== */
const Master = (function(){
  const KEY = "master";
  const TTL = 300;

  function load(){
    const c = CacheService.getScriptCache().get(KEY);
    if(c) return JSON.parse(c);

    const ss = SpreadsheetApp.getActive();
    const subj = {};

    /* 教科マスタ */
    const sv = ss.getSheetByName("教科マスタ").getDataRange().getValues();
    for(let i = 1; i < sv.length; i++){
      const name = String(sv[i][0]).trim();
      if(!name) continue;
      const total = Number(sv[i][1]) || 0;
      /* 開始No。空なら 1（No.1 から）。紙のノートで既に何時間か
         進めていて、この道具は続きの番号から使いたい、という場合に変える。
         範囲は [from, from+total-1] で、to はここでしか計算しない
         （あちこちで from+total-1 を書くと、直し忘れがずれの元になる）。 */
      const from = Number(sv[i][3]) || 1;
      subj[name] = {
        name:  name,
        total: total,
        from:  from,
        to:    from + total - 1,
        open:  sv[i][2] === true || String(sv[i][2]).toUpperCase() === "TRUE",
        units: []
      };
    }

    /* 単元マスタ */
    const uv = ss.getSheetByName("単元マスタ").getDataRange().getValues();
    for(let i = 1; i < uv.length; i++){
      const sn = String(uv[i][0]).trim();
      if(!sn || !subj[sn]) continue;
      subj[sn].units.push({
        name:  String(uv[i][1]).trim(),
        from:  Number(uv[i][2]) || 0,
        to:    Number(uv[i][3]) || 0,
        c:     Number(uv[i][4]) || 0,
        term:  Number(uv[i][5]) || 0,
        rated: uv[i][6] === true || String(uv[i][6]).toUpperCase() === "TRUE"
      });
    }
    Object.keys(subj).forEach(k => subj[k].units.sort((a, b) => a.from - b.from));

    const out = {subjects: subj};
    CacheService.getScriptCache().put(KEY, JSON.stringify(out), TTL);
    return out;
  }

  /* 教科名の一覧。児童には公開されているものだけを返す。 */
  function subjectNames(isTeacher){
    const s = load().subjects;
    return Object.keys(s).filter(k => isTeacher || s[k].open);
  }

  function subject(name){ return load().subjects[name] || null; }

  function isOpen(name){
    const s = subject(name);
    return !!(s && s.open);
  }

  function unitOf(subjName, no){
    const s = subject(subjName);
    if(!s) return null;
    return s.units.filter(u => no >= u.from && no <= u.to)[0] || null;
  }

  function clearCache(){ CacheService.getScriptCache().remove(KEY); }

  return {load, subjectNames, subject, isOpen, unitOf, clearCache};
})();

/* ==================================================================
   マスタへの書き戻し。教師画面から呼ぶ。
   単元マスタは「その教科の行を消して入れ直す」。並べ替えや削除を
   1回の操作で反映するには、差分を追うより入れ直すほうが確実。
================================================================== */
function masterSaveUnits(subject, units){
  const sh = SpreadsheetApp.getActive().getSheetByName("単元マスタ");
  const v  = sh.getDataRange().getValues();
  for(let i = v.length - 1; i >= 1; i--) if(String(v[i][0]) === subject) sh.deleteRow(i + 1);
  units.forEach(u => sh.appendRow([subject, u.name, u.from, u.to, u.c, u.term, !!u.rated]));
  Master.clearCache();
}

function masterSaveSubject(name, total, open, from){
  const sh = SpreadsheetApp.getActive().getSheetByName("教科マスタ");
  const v  = sh.getDataRange().getValues();
  const f  = Number(from) || 1;
  for(let i = 1; i < v.length; i++){
    if(String(v[i][0]) === name){
      sh.getRange(i + 1, 2, 1, 3).setValues([[total, !!open, f]]);
      Master.clearCache();
      return;
    }
  }
  sh.appendRow([name, total, !!open, f]);
  Master.clearCache();
}

/* ==================== Lock.gs ==================== */
/* ==================================================================
   Lock.gs — ロックの判定。
   状態としては持たない。保存時刻と定時から毎回引く。
   日次トリガでフラグを立てる方式にすると、トリガが落ちた日に穴が空き、
   シートとフラグの不整合も起きる。時刻の関数なら落ちようがない。

   直近の境界 = 今日の定時（すでに過ぎていれば今日、まだなら昨日）
   ロック済み ⇔ その評価の保存時刻 < 直近の境界

   保存時刻が無いセル（未記入）はロックしない。
   休んだ児童も、転写を忘れた児童も、後日そのまま入力できる。
================================================================== */
/* シートの日付欄は Date で返ってくるとは限らない。書式を文字列にしていたり、
   手で「2026/4/10」と打ち込んでいると文字列で来る。instanceof だけで判定すると、
   その場合に全部「日付なし」に落ちて、児童の画面が黙って空になる。 */
function toDate_(v){
  if(v === null || v === undefined || v === "") return null;
  if(Object.prototype.toString.call(v) === "[object Date]"){
    return isNaN(v.getTime()) ? null : v;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

const Lock = (function(){

  function lastBoundary(now){
    const at = now || new Date();
    const t  = Config.lockTime();
    const b  = new Date(at);
    b.setHours(t.h, t.m, 0, 0);
    if(b > at) b.setDate(b.getDate() - 1);   // まだ今日の定時前なら、昨日の定時
    return b;
  }

  /* savedAt は Date か、シートから来た文字列。空ならロックしない。 */
  function isLocked(savedAt, now){
    const d = toDate_(savedAt);
    return d ? (d < lastBoundary(now)) : false;
  }

  return {lastBoundary, isLocked};
})();

/* ==================== Hours.gs ==================== */
/* ==================================================================
   Hours.gs — 児童が使える時間。

   開室 8:00 〜 ロック時刻（16:00）。**終わりをロック時刻と同じにしてある。**
   時刻を別に持つと「閉まっているのにまだ直せる」というずれが生まれ、
   それを人手で守り続けることになる。同じ値を見れば、閉室と確定が
   必ず同じ瞬間に起きる。

   画面を閉じるのは誘導であって権限ではない。読み書きの両方で、
   サーバ側がこの判定を通す。
================================================================== */
const Hours = (function(){

  function open_(){ return Config.openTime(); }
  function close_(){ return Config.lockTime(); }        // 終わりはロック時刻

  function isClosed(now){
    const d = now || new Date();
    const m = d.getHours()*60 + d.getMinutes();
    const a = open_(), b = close_();
    const from = a.h*60 + a.m, to = b.h*60 + b.m;
    return (from < to) ? (m < from || m >= to)
                       : (m < from && m >= to);          // 日をまたぐ設定
  }

  /* 教師は時間外でも使える。ロックの貫通と同じ扱い。 */
  function isClosedFor(who, now){
    return (who && who.role === "teacher") ? false : isClosed(now);
  }

  /* 閉まるまでの分。閉まっているときは null。画面の予告に使う。 */
  function minutesToClose(now){
    const d = now || new Date();
    if(isClosed(d)) return null;
    const b = close_();
    const to = b.h*60 + b.m, m = d.getHours()*60 + d.getMinutes();
    return (m < to) ? to - m : (24*60 - m) + to;
  }

  function label(){
    const a = open_(), b = close_();
    const p = n => String(n).padStart(2, "0");
    return p(a.h) + ":" + p(a.m) + "〜" + p(b.h) + ":" + p(b.m);
  }

  return {isClosed, isClosedFor, minutesToClose, label,
          openTime: open_, closeTime: close_};
})();

/* ==================== Store.gs ==================== */
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
        touchCache_(subject, studentId, no, null, 0, "");
        return {ok:true, sym:null};
      }
      const row = [subject, studentId, no, sym, at, by || ""];
      if(hit) sh.getRange(hit, 1, 1, WIDTH).setValues([row]);
      else    sh.appendRow(row);
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

/* ==================== Aggregate.gs ==================== */
/* ==================================================================
   Aggregate.gs — 単元評価と期末評定の計算。
   prototypes/teacher-view.html の集計をそのまま移したもの。

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

  /* 評定への写像。記号は上振れしているので、A になるのは A+ 以上。 */
  function rankOf(v, R){
    R = R || Config.rule();
    if(v == null) return null;
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

  function find(subject, studentId, kind, target){
    const rows = all();
    for(let i = 0; i < rows.length; i++){
      const r = rows[i];
      if(String(r[COL.subject]) === subject &&
         String(r[COL.id])      === String(studentId) &&
         String(r[COL.kind])    === kind &&
         String(r[COL.target])  === String(target)) return {row: i + 2, value: String(r[COL.value])};
    }
    return null;
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
    const lock = LockService.getScriptLock();
    if(!lock.tryLock(20000)) return {ok:false, why:"こんでいます"};
    try{
      const sh = sheet();
      const hit = find(subject, studentId, kind, target);
      if(value === null || value === ""){
        if(hit) sh.deleteRow(hit.row);
        return {ok:true, value:null};
      }
      const row = [subject, studentId, kind, target, value, new Date()];
      if(hit) sh.getRange(hit.row, 1, 1, 6).setValues([row]);
      else    sh.appendRow(row);
      return {ok:true, value:value};
    } finally { lock.releaseLock(); }
  }

  return {unitValue, termRank, set, find};
})();

/* ==================== Api.gs ==================== */
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

  let adopted = 0, skipped = 0;
  if(rated){
    const subj = Master.subject(subject);
    const u = subj.units.filter(x => x.name === unitName)[0];
    const all = Store.readAll(subject);              // 1回だけ読む

    Roster.all().forEach(st => {
      if(Final.unitValue(subject, st.id, unitName)) return;   // 教師が直したものは残す
      const s = Aggregate.summarize(all[st.id] || {}, u);
      if(!s.provSym) return;                          // 記号が1つも無ければ採用しようがない
      /* この児童自身の記入率が8割未満なら、まだ採用しない。
         見せる／見せないの旗を立てるだけの操作なので、あとで追いつけば
         次の「単元の評価をする」や「仮値をまとめて採用」で拾われる。 */
      if(!meetsRate_(s)){ skipped++; return; }
      Final.set(subject, st.id, "単元", unitName, s.provSym); adopted++;
    });
  }

  sh.getRange(row, 7).setValue(!!rated);
  Master.clearCache();
  return {ok:true, rated: !!rated, adopted: adopted, skipped: skipped};
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
      /* この児童自身の記入率が採用の水準に達しているか。
         「単元の評価をする」「仮値をまとめて採用」は、達していない児童を
         採用しない（apiSetRated / apiAdoptAll）。画面にも先に見せておく。 */
      ready: meetsRate_(s),
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
  let n = 0, skipped = 0;
  Roster.all().forEach(st => {
    if(!overwrite && Final.unitValue(subject, st.id, unitName)) return;
    const s = Aggregate.summarize(all[st.id] || {}, u);
    if(!s.provSym) return;
    /* apiSetRated と同じしきい値。まとめて採用するボタンからでも、
       記入率8割未満の児童を素通りさせない。 */
    if(!meetsRate_(s)){ skipped++; return; }
    Final.set(subject, st.id, "単元", unitName, s.provSym); n++;
  });
  return {ok:true, put:n, skipped:skipped};
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

/* ==================== Export.gs ==================== */
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

/* ==================== Code.gs ==================== */
/* ==================================================================
   Code.gs — doGet・ルーティング・役割の判定。

   デプロイは「自分（教師）として実行」「同じ組織内の全員がアクセス」。
   「アクセスしているユーザーとして実行」にしてはいけない。児童の権限で
   シートに書くことになり、児童全員に編集権限が渡る。
================================================================== */

function doGet(e){
  const who  = whoAmI();
  const page = (e && e.parameter && e.parameter.p) || "";

  /* 画面は URL で振り分けるが、リンクを出さないのは誘導であって権限ではない。
     飛んだ先でも役割をメールから判定し直し、Api.gs 側でも毎回引き直す。 */
  let file = "student";
  if(page === "hello")   file = "hello";                              // 置いたときの確認用
  if(page === "teacher") file = (who.role === "teacher") ? "teacher" : "student";
  if(who.role === "unknown") file = "hello";                          // 誰か分からない人には理由を出す

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
    openTime: Config.openTime(),
    hours:    Hours.label(),
    closed:   Hours.isClosedFor(w),        // 児童は時間外だと true
    toClose:  Hours.minutesToClose(),
    subjects: (w.role === "unknown") ? [] : Master.subjectNames(isTeacher),
    boundary: Lock.lastBoundary().toISOString()
  };
}

/* 設定やマスタを直したあとに1回呼ぶ。5分待たずに反映される。 */
function clearAllCache(){
  Config.clearCache(); Roster.clearCache(); Master.clearCache();
  /* 記録は教科ごとに置いてあるので、全教科ぶん捨てる。
     教師がシートを手で直したときは、これを実行する。 */
  Object.keys(Master.load().subjects).forEach(n => Store.dropCache(n));
}

/* ==================== Setup.gs ==================== */
/* ==================================================================
   Setup.gs — Step 1。シートを作る。
   エディタから setupSheets() を1回実行する。
   すでにあるシートには触らない（作り直しではなく足すだけ）。
================================================================== */

/* 見出し行。ここが仕様との接点なので、列名は spec.md と同じにする。
   「開始No」は空なら 1 として扱う（Master.gs）。既存のシートに
   この列が無くても、そのまま動く（見出しは無くても列Dは読み書きできる）。 */
const SETUP_SHEETS = {   /* GAS は全ファイルが1スコープ。総称的な名前は置かない */
  "設定":     ["キー", "値"],
  "教科マスタ": ["教科", "時数", "公開", "開始No"],
  "名簿":     ["児童ID", "出席番号", "氏名", "メール"],
  "単元マスタ": ["教科", "単元名", "開始No", "終了No", "色", "学期", "評価公開"],
  "記録":     ["教科", "児童ID", "No", "記号", "保存時刻", "更新者"],
  "確定":     ["教科", "児童ID", "種別", "対象", "値", "確定時刻"]
};

/* 設定シートの初期値。spec.md の凍結内容がそのまま入っている。
   開室時刻〜ロック時刻が、児童が使える時間。終わりはロック時刻と同じ値を使う。 */
const DEFAULTS = [
  ["学級",        "3年3組"],
  ["年度",        2026],
  ["開室時刻",    "8:00"],
  ["ロック時刻",  "16:00"],
  ["A下限",       "A+"],
  ["C上限",       "C+"],
  ["代表値",      "後半の中央値"],
  ["後半の範囲",  3],
  ["Y解放",       false],
  ["Dを含める",   true],
  ["Cを含める",   true],
  ["教師メール",  ""]
];

/* ==================================================================
   結果の見せ方。

   SpreadsheetApp.getUi() は、UI のある文脈からしか呼べない。
   スクリプトエディタをスプレッドシートから開かずに直接開いたときや、
   トリガから走ったときは「Cannot call SpreadsheetApp.getUi() from this
   context.」で落ちる。**処理が終わったあとの表示で落ちるので、
   仕事は済んでいるのに失敗したように見える。**

   そこで、まず必ず実行ログに出す。ダイアログは出せるときだけ出す。
================================================================== */
function tell_(title, lines){
  const text = title + "\n\n" + lines.join("\n");
  Logger.log(text);                       // 実行ログには必ず残る
  try { SpreadsheetApp.getUi().alert(text); } catch(e) { /* UI が無い文脈 */ }
  return lines;
}

function setupSheets(){
  const ss = SpreadsheetApp.getActive();
  const made = [];

  /* スプレッドシートのタイムゾーンをスクリプトに合わせる。
     ずれていると、シートが時刻型に変えた値を読んだときに別の時刻になる。 */
  const tz = Session.getScriptTimeZone();
  if(ss.getSpreadsheetTimeZone() !== tz){
    ss.setSpreadsheetTimeZone(tz);
    made.push("タイムゾーンを " + tz + " に合わせた");
  }

  Object.keys(SETUP_SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if(sh){ return; }                       // あるものには触らない
    sh = ss.insertSheet(name);
    const head = SETUP_SHEETS[name];
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

  return tell_("シートの用意",
    made.length ? made : ["すべて揃っている。何もしなかった。"]);
}

/* 名簿・マスタが埋まっているかを見る。Step 1 の検算。 */
function checkSheets(){
  const ss = SpreadsheetApp.getActive();
  const msg = [];
  Object.keys(SETUP_SHEETS).forEach(name => {
    const sh = ss.getSheetByName(name);
    if(!sh){ msg.push("× " + name + " が無い"); return; }
    const n = Math.max(0, sh.getLastRow() - 1);
    msg.push((n ? "○ " : "△ ") + name + "  " + n + "行");
  });
  const teachers = Config.teacherEmails();
  msg.push(teachers.length ? "○ 教師メール " + teachers.length + "件"
                           : "× 教師メールが空。設定シートに自分のメールを入れる");
  return tell_("シートの状態", msg);
}

/* ==================================================================
   diagnose() — 児童の画面に何が出るか、出ないなら何が足りないかを見る。
   エディタから実行する。児童アカウントで開く前にこれで潰しておく。
================================================================== */
function diagnoseLines(){
  const out = [];
  const ss  = SpreadsheetApp.getActive();
  const row = name => {
    const sh = ss.getSheetByName(name);
    return sh ? Math.max(0, sh.getLastRow() - 1) : -1;
  };

  /* 1. シート */
  Object.keys(SETUP_SHEETS).forEach(n => {
    const c = row(n);
    if(c < 0) out.push("× シート「" + n + "」が無い。setupSheets を実行する");
  });

  /* 2. 教師メール */
  const te = Config.teacherEmails();
  out.push(te.length ? "○ 教師メール " + te.length + "件（" + te.join("、") + "）"
                     : "× 教師メールが空。設定シートに自分のメールを入れる");

  /* 3. 名簿 */
  const roster = Roster.all();
  const noMail = roster.filter(s => !s.email).length;
  out.push(roster.length ? "○ 名簿 " + roster.length + "人" : "× 名簿が空。児童を入れる");
  if(noMail) out.push("× 名簿のうち " + noMail + "人にメールが無い。その児童は使えない");

  /* 4. 教科マスタ ← ここが空だと児童の画面が真っ白になる */
  const subj = Master.load().subjects;
  const names = Object.keys(subj);
  if(!names.length){
    out.push("× 教科マスタが空。ここが空だと児童の画面に何も出ない。"
           + "『教科 / 時数 / 公開』を入れる（公開は TRUE で児童に見える）");
  }else{
    const open = names.filter(n => subj[n].open);
    out.push("○ 教科 " + names.length + "件（" + names.join("、") + "）");
    out.push(open.length ? "○ 児童に見える教科 " + open.length + "件（" + open.join("、") + "）"
                         : "× 公開が TRUE の教科が無い。児童の画面には何も出ない");
  }

  /* 5. 単元マスタ */
  names.forEach(n => {
    const s = subj[n];
    if(!s.total) out.push("× 「" + n + "」の時数が 0。教科マスタに入れる");
    if(s.from !== 1) out.push("○ 「" + n + "」は No." + s.from + " から始まる（No." + s.to + " まで）");
    if(!s.units.length){ out.push("× 「" + n + "」に単元が無い"); return; }

    const covered = {};
    s.units.forEach(u => { for(let i = u.from; i <= u.to; i++) covered[i] = 1; });
    const miss = [];
    for(let i = s.from; i <= s.to; i++) if(!covered[i]) miss.push(i);
    if(miss.length) out.push("△ 「" + n + "」でどの単元にも入らない授業が "
                           + miss.length + "件（No." + miss[0] + " など）");
  });

  /* 5.5 上端の解放 */
  out.push((Config.released() ? "○ " : "△ ") + RELEASE_FROM + " 以上（"
         + LEVELS.filter(isReleaseSym).join("・") + "）は児童に"
         + (Config.released() ? "出している" : "出していない")
         + "。設定シートの「" + RELEASE_FROM + "解放」で変える");

  /* 5.7 タイムゾーン */
  const tz = Session.getScriptTimeZone();
  const stz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  out.push((stz === tz ? "○ " : "× ") + "タイムゾーン スクリプト " + tz + " / シート " + stz
         + (stz === tz ? "" : "。ずれていると時刻の設定が別の時刻になる。setupSheets で合う"));

  /* 6. 時間 */
  const a = Config.openTime(), b = Config.lockTime();
  const p = x => String(x).padStart(2, "0");
  out.push("○ 児童が使える時間 " + p(a.h) + ":" + p(a.m) + "〜" + p(b.h) + ":" + p(b.m)
         + "（いま " + (Hours.isClosed() ? "閉室中" : "開室中") + "）");

  return out;
}

/* エディタから実行する用。中身は diagnoseLines と同じ。 */
function diagnose(){
  return tell_("児童の画面がどうなるか", diagnoseLines());
}

/* ==================================================================
   migrateSymbols() — 上端の記号を新しい並びに置き換える。

   Z−(17) Z(18) Z+(19) Z++(20) → Z(17) Z+(18) Y(19) Y+(20)

   **内部値は動かない。** 位置で対応させているので、置換しても
   その児童の順位も単元評価も変わらない。変わるのは表示の記号だけ。
   1回だけ実行する。2回目は置き換えるものが無いので何も起きない
   ……のではなく、Z → Z+ が二重にかかる。**必ず1回だけ。**
================================================================== */
function migrateSymbols(){
  const ss = SpreadsheetApp.getActive();
  const done = [];

  [["記録", 4], ["確定", 5]].forEach(([name, col])=>{
    const sh = ss.getSheetByName(name);
    if(!sh || sh.getLastRow() < 2) return;
    const n = sh.getLastRow() - 1;
    const v = sh.getRange(2, col, n, 1).getValues();
    let hit = 0;
    for(let i = 0; i < n; i++){
      const cur = String(v[i][0]);
      if(SYM_MIGRATION[cur] !== undefined){ v[i][0] = SYM_MIGRATION[cur]; hit++; }
    }
    if(hit){ sh.getRange(2, col, n, 1).setValues(v); }
    done.push(name + " " + hit + "件");
  });

  return tell_("上端の記号を置き換えた", done.concat([
    "", "Z− → Z / Z → Z+ / Z+ → Y / Z++ → Y+",
    "内部の順位は動いていない。", "", "※ 2回実行すると二重にかかる。1回だけ。"]));
}

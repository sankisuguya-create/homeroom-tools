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

  /* ロック時刻。"16:00" のほか、シートが時刻型で返す Date も受ける。 */
  function lockTime(){
    const v = get("ロック時刻", "16:00");
    if(v instanceof Date) return {h: v.getHours(), m: v.getMinutes()};
    const m = String(v).match(/(\d{1,2})[:：](\d{1,2})/);
    return m ? {h: +m[1], m: +m[2]} : {h: 16, m: 0};
  }

  function teacherEmails(){
    return String(get("教師メール", ""))
      .split(/[\s,、]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  }

  /* 集計の式。teacher-view.html の R にあたる。 */
  function rule(){
    return {
      aFrom:  valueOfSym(String(get("A下限", "A+"))),
      cTo:    valueOfSym(String(get("C上限", "C++"))),
      stat:   String(get("代表値", "後半の中央値")),
      late:   Number(get("後半の範囲", 3)) || 3,
      withD:  get("Dを含める", true) !== false,
      withC:  get("Cを含める", true) !== false
    };
  }

  return {get, lockTime, teacherEmails, rule, clearCache,
          className: () => String(get("学級", "")),
          year:      () => Number(get("年度", 0))};
})();

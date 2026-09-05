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

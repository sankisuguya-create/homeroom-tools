/* ==================================================================
   Master.gs — 教科マスタ・単元マスタ・授業マスタ。
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
      subj[name] = {
        name:  name,
        total: Number(sv[i][1]) || 0,
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

    /* 授業マスタ。実施日で「済んだが未入力」と「これから」を分ける。 */
    const held = {};
    const lv = ss.getSheetByName("授業マスタ").getDataRange().getValues();
    for(let i = 1; i < lv.length; i++){
      const sn = String(lv[i][0]).trim();
      const no = Number(lv[i][1]);
      if(!sn || !no) continue;
      const d = lv[i][2];
      held[sn + "|" + no] = (d instanceof Date) ? d.getTime() : null;
    }

    const out = {subjects: subj, held: held};
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

  /* その授業が実施済みか。実施日が空または未来なら未実施。 */
  function isHeld(subjName, no, now){
    const t = load().held[subjName + "|" + no];
    if(t === undefined || t === null) return false;
    return t <= (now ? now.getTime() : Date.now());
  }

  function unitOf(subjName, no){
    const s = subject(subjName);
    if(!s) return null;
    return s.units.filter(u => no >= u.from && no <= u.to)[0] || null;
  }

  function clearCache(){ CacheService.getScriptCache().remove(KEY); }

  return {load, subjectNames, subject, isOpen, isHeld, unitOf, clearCache};
})();

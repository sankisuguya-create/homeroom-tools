/* ==================================================================
   localcheck.js — GAS に貼る前に、手元で .gs を動かして確かめる。

     node gas/localcheck.js

   Apps Script の API（SpreadsheetApp・CacheService・Session）を偽物に
   差し替えて、全 .gs を1つのスコープに読み込んで走らせる。GAS も同じく
   全ファイルが1つのスコープを共有するので、ファイル間の参照ずれもここで出る。
   Google のアカウントが要らないので、直すたびに回せる。
================================================================== */
/* Date を1つも作る前にタイムゾーンを固定する。GAS 側は appsscript.json の
   "timeZone": "Asia/Tokyo" が同じ役目をする。ここがずれるとロックの境界が
   まるごとずれるので、検査も同じ時間帯で回す。 */
process.env.TZ = "Asia/Tokyo";

const fs = require("fs"), path = require("path"), vm = require("vm");
const DIR = __dirname;

/* ---- 偽のシート ---- */
const SHEETS = {
  "設定": [["キー","値"],
    ["学級","3年3組"],["年度",2026],["開室時刻","8:00"],["ロック時刻","16:00"],
    ["A下限","A+"],["C上限","C++"],["代表値","後半の中央値"],["後半の範囲",3],
    ["Y解放",false],["Dを含める",true],["Cを含める",true],["教師メール","sensei@example.ed.jp"]],
  "教科マスタ": [["教科","時数","公開"],
    ["算数",70,true],["国語",60,true],["体育",105,false],["社会",70,false]],
  "名簿": [["児童ID","出席番号","氏名","メール"],
    ["s01",1,"あおい","aoi@example.ed.jp"],
    ["s09",9,"さくら","sakura@example.ed.jp"]],
  "単元マスタ": [["教科","単元名","開始No","終了No","色","学期","評価公開"],
    ["算数","九九の表とかけ算",1,14,0,1,true],
    ["算数","わり算",15,30,1,1,false],
    ["算数","たし算とひき算の筆算",31,48,2,2,false],
    ["算数","時こくと時間",49,70,3,3,false],
    ["体育","体つくり運動",1,12,0,1,false]],
  "授業マスタ": [["教科","No","実施日"],
    ["算数",1,new Date("2026-04-10")],
    ["算数",2,new Date("2026-04-11")],
    ["算数",70,new Date("2027-03-01")]],
  "記録": [["教科","児童ID","No","記号","保存時刻","更新者"]],
  "確定": [["教科","児童ID","種別","対象","値","確定時刻"]]
};

let CURRENT_EMAIL = "sakura@example.ed.jp";
const alerts = [];

/* 書ける偽シート。記録と確定は実際に行が増減するので、そこまで真似る。 */
function fakeSheet(name){
  const v = SHEETS[name];
  if(!v) return null;
  const chain = {setValues(){ return this; }, setFontWeight(){ return this; },
                 setBackground(){ return this; }, setNumberFormat(){ return this; }};

  function range(row, col, nRow, nCol){
    if(row === undefined) return Object.assign({getValues: () => v.map(r => r.slice())}, chain);
    const r0 = row - 1, c0 = col - 1;
    return {
      getValues(){
        const out = [];
        for(let i = 0; i < nRow; i++){
          const src = v[r0 + i] || [];
          out.push(src.slice(c0, c0 + nCol));
        }
        return out;
      },
      getValue(){ const src = v[r0] || []; return src[c0]; },
      setValue(x){ while(v.length <= r0) v.push([]); v[r0][c0] = x; return this; },
      setValues(vals){
        for(let i = 0; i < vals.length; i++){
          while(v.length <= r0 + i) v.push([]);
          for(let j = 0; j < vals[i].length; j++) v[r0 + i][c0 + j] = vals[i][j];
        }
        return this;
      },
      setFontWeight(){ return this; }, setBackground(){ return this; },
      setNumberFormat(){ return this; }
    };
  }

  return {
    __name: name,
    getDataRange: () => range(),
    getRange: range,
    setFrozenColumns(){},
    getLastRow: () => v.length,
    appendRow: r => { v.push(r.slice()); },
    deleteRow: n => { v.splice(n - 1, 1); },
    setFrozenRows(){}, autoResizeColumns(){}
  };
}

const sandbox = {
  console,
  Date, Math, JSON, String, Number, Object, Array, isNaN, parseInt, parseFloat,
  SpreadsheetApp: {
    getActive: () => ({
      getSheetByName: fakeSheet,
      deleteSheet: sh => { if(sh && sh.__name) delete SHEETS[sh.__name]; },
      insertSheet: n => { SHEETS[n] = [[]]; return fakeSheet(n) || {
        getRange: () => ({setValues(){return this;},setFontWeight(){return this;},
                          setBackground(){return this;},setNumberFormat(){return this;}}),
        getLastRow: () => 1, setFrozenRows(){}, autoResizeColumns(){} }; }
    }),
    getUi: () => ({ alert: m => alerts.push(m) })
  },
  CacheService: { getScriptCache: () => {
    const m = new Map();
    return {get: k => m.get(k) || null, put: (k,v) => m.set(k,v), remove: k => m.delete(k)};
  }},
  Session: { getActiveUser: () => ({ getEmail: () => CURRENT_EMAIL }),
             getScriptTimeZone: () => "Asia/Tokyo" },
  Utilities: { formatDate: (d) => d.toISOString() },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock(){} }) },
  HtmlService: {
    createHtmlOutputFromFile: n => ({
      getContent: () => fs.readFileSync(path.join(DIR, n + ".html"), "utf8") })
  }
};
sandbox.SHEETS_LEN = () => SHEETS["記録"].length;
sandbox.SH_HAS   = n => !!SHEETS[n];
sandbox.SH_COUNT = n => (SHEETS[n] ? 1 : 0);
sandbox.CURRENT_EMAIL_STUDENT = () => { CURRENT_EMAIL = "sakura@example.ed.jp"; };
vm.createContext(sandbox);

/* ---- 全 .gs を1つのスコープへ。GAS と同じ形。 ---- */
const order = ["Scale.gs","Config.gs","Roster.gs","Master.gs","Lock.gs","Hours.gs",
               "Store.gs","Aggregate.gs","Api.gs","Export.gs","Code.gs","Setup.gs"];
const files = fs.readdirSync(DIR).filter(f => f.endsWith(".gs"));
files.forEach(f => { if(order.indexOf(f) < 0) order.push(f); });

let ng = 0;

/* GAS と同じで、トップレベルの const はコンテキストのプロパティにならない
   （後続のファイルからは見えるが、外からは見えない）。式として評価して確かめる。 */
const ev = expr => vm.runInContext(expr, sandbox);
const ok = (label, expr, show) => {
  let val, err = null;
  try { val = (typeof expr === "string") ? ev(expr) : expr; }
  catch(e){ err = e.message; }
  const pass = !err && val === true;
  console.log((pass ? "  ○ " : "  × ") + label +
    (pass ? "" : "  → " + (err || JSON.stringify(show !== undefined ? ev(show) : val))));
  if(!pass) ng++;
};

/* 検査のあいだだけ時計を止める。これをしないと、回した時刻で結果が変わる。 */
const RealDate = Date;
function clockAt(iso){
  const t = new RealDate(iso).getTime();
  class D extends RealDate {
    constructor(...a){ if(!a.length) super(t); else super(...a); }
    static now(){ return t; }
  }
  sandbox.Date = D;
}
function clockReal(){ sandbox.Date = RealDate; }

const as = e => { CURRENT_EMAIL = e; ev("clearAllCache()"); };
console.log("■ 読み込み（構文と、ファイル間の参照）");
order.forEach(f => {
  try { new vm.Script(fs.readFileSync(path.join(DIR, f), "utf8"), {filename: f}).runInContext(sandbox);
        console.log("  ○ " + f); }
  catch(e){ console.log("  × " + f + "  → " + e.message); ng++; }
});

console.log("■ スケール（20段の往復）");
ok("NLEVEL は 20", "NLEVEL === 20", "NLEVEL");
ok("1〜20 すべて往復する",
   "(function(){for(let v=1;v<=NLEVEL;v++) if(valueOfSym(symbolOf(v))!==v) return false; return NLEVEL>0;})()");
ok("16 は A++", "symbolOf(16) === 'A++'", "symbolOf(16)");
ok("A++ は 16", "valueOfSym('A++') === 16", "valueOfSym('A++')");
ok("休 と / は値を持たない", "valueOfSym('休') === null && valueOfSym('/') === null");
ok("休 と / は突破層でも警告層でもない",
   "isTopSym('休') === false && isWarnSym('/') === false");
ok("Object.prototype.valueOf を壊していない",
   "typeof Object.prototype.valueOf === 'function' && ({}).valueOf() !== undefined");

console.log("■ 上端（Z を2段にして Y を足した）");
ok("20段のまま", "NLEVEL === 20");
ok("上端は Z Z+ Y Y+", "LEVELS.slice(16).join(' ') === 'Z Z+ Y Y+'", "LEVELS.slice(16)");
ok("Z− と Z++ はもう無い", "valueOfSym('Z−') === null && valueOfSym('Z++') === null");
ok("下の4帯は4段のまま", "LEVELS.slice(0,16).join(' ') === 'D− D D+ D++ C− C C+ C++ B− B B+ B++ A− A A+ A++'");
ok("突破層は Z 以上の4つ", "LEVELS.filter(isTopSym).join(' ') === 'Z Z+ Y Y+'");
ok("材質は字ごと（Z=金・Y=宇宙）",
   "lookOf('Z')==='foil-gold' && lookOf('Z+')==='foil-gold' && " +
   "lookOf('Y')==='foil-cosmic' && lookOf('Y+')==='foil-cosmic'");
ok("帯ごとの段数を引ける",
   "bandStart('Z')===17 && bandSize('Z')===2 && bandStart('Y')===19 && bandSize('Y')===2 && " +
   "bandStart('A')===13 && bandSize('A')===4");
ok("児童の選択肢から Y 以上が落ちる",
   "symsFor({released:false}).indexOf('Y') < 0 && symsFor({released:true}).indexOf('Y') >= 0");
ok("すでに入っている Y+ は選択肢に残る（値が消えないように）",
   "symsFor({released:false, keep:'Y+'}).indexOf('Y+') >= 0");
ok("置換表は位置を保つ（内部値が動かない）",
   "valueOfSym(SYM_MIGRATION['Z−'])===17 && valueOfSym(SYM_MIGRATION['Z'])===18 && " +
   "valueOfSym(SYM_MIGRATION['Z+'])===19 && valueOfSym(SYM_MIGRATION['Z++'])===20");
ok("評定のしきい値は記号から引くのでずれない",
   "Config.rule().aFrom === valueOfSym('A+') && Config.rule().cTo === valueOfSym('C++')");

clockAt("2026-05-22T12:00:00+09:00");
as("sakura@example.ed.jp");
ok("解放前は児童が Y を保存できない",
   "Store.save('算数', 2, 'Y').ok === false", "Store.save('算数',2,'Y')");
ok("Z は解放前でも保存できる", "Store.save('算数', 2, 'Z').ok === true", "Store.save('算数',2,'Z')");
as("sensei@example.ed.jp");
ok("教師は解放前でも Y を置ける", "Store.saveAs('算数','s09',2,'Y+').ok === true");
ok("apiSaveRule で解放できる",
   "(function(){apiSaveRule({released:true});return Config.released()===true;})()");
as("sakura@example.ed.jp");
ok("解放後は児童も Y を保存できる", "Store.save('算数', 2, 'Y').ok === true", "Store.save('算数',2,'Y')");
as("sensei@example.ed.jp");
ok("戻せる", "(function(){apiSaveRule({released:false});return Config.released()===false;})()");
ok("teacherBoot が解放の状態と対象記号を返す",
   "(function(){var b=apiTeacherBoot();return b.released===false && b.releaseFrom==='Y' && " +
   "b.releaseSyms.join(' ')==='Y Y+';})()", "apiTeacherBoot().releaseSyms");
clockReal();

console.log("■ 設定");
ok("ロック時刻は 16:00", "Config.lockTime().h === 16 && Config.lockTime().m === 0", "Config.lockTime()");
ok("A下限は A+ の値(15)", "Config.rule().aFrom === 15", "Config.rule()");
ok("C上限は C++ の値(8)", "Config.rule().cTo === 8", "Config.rule()");
ok("教師メールを読める", "Config.teacherEmails().length === 1", "Config.teacherEmails()");

console.log("■ ロック（時刻の関数として引く）");
ok("検査もタイムゾーンが Asia/Tokyo",
   new Date("2026-05-20T20:00:00+09:00").getHours() === 20,
   "'JST でないので、以下のロック検査は意味を持たない'");
ev("var noon  = new Date('2026-05-20T12:00:00+09:00');" +
   "var night = new Date('2026-05-20T20:00:00+09:00');");
ok("12時に引く境界は前日16:00",
   "Lock.lastBoundary(noon).getDate() === 19 && Lock.lastBoundary(noon).getHours() === 16",
   "Lock.lastBoundary(noon).toString()");
ok("20時に引く境界は当日16:00",
   "Lock.lastBoundary(night).getDate() === 20 && Lock.lastBoundary(night).getHours() === 16",
   "Lock.lastBoundary(night).toString()");
ok("15:00 に入れた評価は 20時にはロック済み",
   "Lock.isLocked(new Date('2026-05-20T15:00:00+09:00'), night) === true");
ok("17:00 に入れた評価は 20時にはまだ直せる",
   "Lock.isLocked(new Date('2026-05-20T17:00:00+09:00'), night) === false");
ok("15:00 に入れた評価も、同じ日の12時の時点では直せる",
   "Lock.isLocked(new Date('2026-05-20T15:00:00+09:00'), noon) === false");
ok("未記入（保存時刻なし）はロックしない",
   "Lock.isLocked(null, night) === false && Lock.isLocked('', night) === false");

console.log("■ 名簿とマスタ");
ok("メールから児童を引ける（大文字でも）", "Roster.byEmail('SAKURA@example.ed.jp').id === 's09'");
ok("名簿にないメールは null", "Roster.byEmail('x@example.ed.jp') === null");
ok("児童に見える教科は算数と国語だけ",
   "JSON.stringify(Master.subjectNames(false)) === JSON.stringify(['算数','国語'])",
   "Master.subjectNames(false)");
ok("教師には4教科すべて見える", "Master.subjectNames(true).length === 4", "Master.subjectNames(true)");
ok("体育は非公開", "Master.isOpen('体育') === false");
ok("No.20 は「わり算」", "Master.unitOf('算数', 20).name === 'わり算'", "Master.unitOf('算数',20)");
ok("評価公開：九九=true / わり算=false",
   "Master.unitOf('算数',1).rated === true && Master.unitOf('算数',20).rated === false");
ok("実施日が過ぎた授業は実施済み", "Master.isHeld('算数', 1, new Date('2026-05-20')) === true");
ok("実施日が未来の授業は未実施", "Master.isHeld('算数', 70, new Date('2026-05-20')) === false");
ok("実施日が無い授業は未実施", "Master.isHeld('算数', 5, new Date('2026-05-20')) === false");

console.log("■ 役割の判定");
as("sakura@example.ed.jp");
ok("児童として判定される", "whoAmI().role === 'student' && whoAmI().name === 'さくら'", "whoAmI()");
as("sensei@example.ed.jp");
ok("教師として判定される", "whoAmI().role === 'teacher'", "whoAmI()");
as("stranger@example.ed.jp");
ok("名簿にない人は不明", "whoAmI().role === 'unknown'", "whoAmI()");
as("");
ok("メールが取れなければ不明", "whoAmI().role === 'unknown'", "whoAmI()");

as("sakura@example.ed.jp");
ok("児童の boot に非公開教科が入らない",
   "bootData().subjects.indexOf('体育') < 0 && bootData().subjects.indexOf('社会') < 0",
   "bootData().subjects");
ok("boot にロックの境界が入る", "typeof bootData().boundary === 'string'", "bootData().boundary");

console.log("■ 開室時間（8:00〜16:00。終わりはロック時刻と同じ値）");
ev("var t0759 = new Date('2026-05-20T07:59:00+09:00');" +
   "var t1200 = new Date('2026-05-20T12:00:00+09:00');" +
   "var t1600 = new Date('2026-05-20T16:00:00+09:00');" +
   "var t2000 = new Date('2026-05-20T20:00:00+09:00');");
ok("7:59 は閉まっている", "Hours.isClosed(t0759) === true");
ok("8:00 ちょうどから開く",
   "Hours.isClosed(new Date('2026-05-20T08:00:00+09:00')) === false");
ok("12:00 は開いている", "Hours.isClosed(t1200) === false");
ok("16:00 ちょうどで閉まる", "Hours.isClosed(t1600) === true");
ok("20:00 は閉まっている", "Hours.isClosed(t2000) === true");
ok("閉室とロックの境目が同じ値",
   "Hours.closeTime().h === Config.lockTime().h && Hours.closeTime().m === Config.lockTime().m");
ok("教師は時間外でも閉まらない",
   "Hours.isClosedFor({role:'teacher'}, t2000) === false && Hours.isClosedFor({role:'student'}, t2000) === true");
ok("15:53 なら閉室まで7分", "Hours.minutesToClose(new Date('2026-05-20T15:53:00+09:00')) === 7");
ok("閉まっているときは null", "Hours.minutesToClose(t2000) === null");

console.log("■ 保存（サーバ側が弾くもの）");
/* save() は「いまの時刻」で動くので、検査のあいだだけ時計を止める。
   これをしないと、検査を回した時刻で結果が変わる。 */
clockAt("2026-05-20T12:00:00+09:00");      // 開いている時間
as("sakura@example.ed.jp");
ok("児童は / を置けない", "Store.save('算数', 1, '/').ok === false");
ok("知らない記号は弾かれる", "Store.save('算数', 1, 'X+').ok === false");
ok("無い授業番号は弾かれる", "Store.save('算数', 999, 'A').ok === false");
ok("非公開の教科には書けない", "Store.save('体育', 1, 'A').ok === false",
   "Store.save('体育',1,'A')");
ok("実施日が未来の授業には書けない", "Store.save('算数', 70, 'A').ok === false",
   "Store.save('算数',70,'A')");
ok("12時なら実施済みの授業に書ける", "Store.save('算数', 1, 'A+').ok === true",
   "Store.save('算数',1,'A+')");
ok("書いた値が読み出せる",
   "Store.read('算数','s09').filter(function(r){return r.no===1;})[0].sym === 'A+'");
ok("同じ授業に書き直しても行は増えない",
   "(function(){var n=SHEETS_LEN();Store.save('算数',1,'B');return SHEETS_LEN()===n;})()");
ok("その日のうちはロックされない",
   "Store.read('算数','s09').filter(function(r){return r.no===1;})[0].locked === false");

clockAt("2026-05-21T12:00:00+09:00");      // 翌日。境界（前日16:00）を越えている
ok("翌日にはロック済みになる",
   "Store.read('算数','s09').filter(function(r){return r.no===1;})[0].locked === true");
ok("ロック済みは児童が書き換えられない", "Store.save('算数', 1, 'Z').ok === false",
   "Store.save('算数',1,'Z')");
ok("書き換えられていない",
   "Store.read('算数','s09').filter(function(r){return r.no===1;})[0].sym === 'B'");

clockAt("2026-05-21T20:00:00+09:00");      // 時間外
ok("時間外は児童が書けない", "Store.save('算数', 2, 'A').ok === false", "Store.save('算数',2,'A')");

clockAt("2026-05-21T12:00:00+09:00");
as("sensei@example.ed.jp");
ok("教師は save ではなく saveAs を使う", "Store.save('算数', 1, 'A').ok === false");
ok("教師はロック済みも貫通して書き換えられる",
   "Store.saveAs('算数','s09',1,'A++').ok === true", "Store.saveAs('算数','s09',1,'A++')");
ok("教師が空にすると行が消える",
   "(function(){var n=SHEETS_LEN();Store.saveAs('算数','s09',1,'');return SHEETS_LEN()===n-1;})()");
ok("教師は時間外でも / を置ける", "Store.saveAs('算数','s09',16,'/').ok === true",
   "Store.saveAs('算数','s09',16,'/')");
ok("教師の書き込みには更新者が残る",
   "(function(){var r=Store.read('算数','s09').filter(function(x){return x.no===16;})[0];" +
   "return r.sym==='/' && r.edited===true;})()");
ok("教師は実施日が未来の授業にも置ける", "Store.saveAs('算数','s09',70,'休').ok === true");
as("sakura@example.ed.jp");
ok("児童は他人の行に書けない（saveAs は先生だけ）",
   "Store.saveAs('算数','s01',1,'Z').ok === false");

clockReal();
console.log("■ 集計");
ev("var rec = {}; for(var i=1;i<=14;i++) rec[i] = ['B','B+','A','A−','A+','B+','A','A','B+','A','A+','A','A+','Z'][i-1];");
ok("後半1/3の中央値が仮値になる",
   "(function(){var u=Master.unitOf('算数',1);var s=Aggregate.summarize(rec,u);" +
   "return s.n===14 && s.prov!==null && typeof s.provSym==='string';})()",
   "Aggregate.summarize(rec, Master.unitOf('算数',1))");
ok("休 と / は分母から外れ、別々に数えられる",
   "(function(){var r={};r[1]='A';r[2]='休';r[3]='/';r[4]='B';" +
   "var s=Aggregate.summarize(r,{from:1,to:4});" +
   "return s.n===4 && s.off===1 && s.skip===1;})()",
   "Aggregate.summarize({1:'A',2:'休',3:'/',4:'B'},{from:1,to:4})");
ok("A+ 以上が評定A、C++ 以下が評定C",
   "Aggregate.rankOf(valueOfSym('A+'))==='A' && Aggregate.rankOf(valueOfSym('A'))==='B' && " +
   "Aggregate.rankOf(valueOfSym('C++'))==='C'");
ok("記号の A は評定では B に落ちる", "Aggregate.rankOf(valueOfSym('A')) === 'B'");
ok("中央値が段の間なら下を採る", "Aggregate.medianVal([10,11]) === 10.5 && symbolOfMedian(10.5) === 'B'");

console.log("■ 単元評価を児童に返すか");
as("sakura@example.ed.jp");
ev("var rows = Store.read('算数','s09');");
ok("評価公開が false の単元は値を返さない",
   "(function(){var us=Aggregate.unitsForStudent('算数','s09',rows);" +
   "var w=us.filter(function(u){return u.name==='わり算';})[0];" +
   "return w.rated===false && w.sym===null && w.high===null && w.top===null;})()",
   "Aggregate.unitsForStudent('算数','s09',rows)[1]");
ok("公開されていない単元でも入力数は返す",
   "(function(){var us=Aggregate.unitsForStudent('算数','s09',rows);" +
   "return typeof us[1].n === 'number' && typeof us[1].total === 'number';})()");

console.log("■ 画面から呼ぶ入口");
clockAt("2026-05-22T12:00:00+09:00");
as("sakura@example.ed.jp");
ok("児童の apiBoot は開いている時間なら中身まで返す",
   "(function(){var b=apiBoot();return b.ok===true && b.closed===false && " +
   "Array.isArray(b.rows) && b.rows.length===70 && Array.isArray(b.units);})()",
   "(function(){var b=apiBoot();return {ok:b.ok,closed:b.closed,rows:(b.rows||[]).length};})()");
ok("児童の apiBoot に非公開教科が入らない",
   "apiBoot().subjects.indexOf('体育') < 0");
ok("児童は非公開の教科を読めない", "apiRead('体育').ok === false", "apiRead('体育')");
clockAt("2026-05-22T20:00:00+09:00");
ok("時間外の apiBoot は中身を返さない",
   "(function(){var b=apiBoot();return b.closed===true && b.rows===undefined;})()",
   "apiBoot()");
ok("時間外の apiRead は断る", "apiRead('算数').closed === true", "apiRead('算数')");
as("sensei@example.ed.jp");
ok("教師は時間外でも読める", "apiRead('算数').ok === true", "apiRead('算数')");
ok("教師は非公開の教科も読める", "apiRead('体育').ok === true");
as("sakura@example.ed.jp");
ok("児童は評価公開を切り替えられない",
   "apiSetRated('算数','わり算',true).ok === false");
as("sensei@example.ed.jp");
ok("教師は評価公開を切り替えられる",
   "apiSetRated('算数','わり算',true).ok === true", "apiSetRated('算数','わり算',true)");
ok("切り替えた結果がマスタに効く", "Master.unitOf('算数',20).rated === true");
ok("押した時点で仮値が採用され、確定シートに入る",
   "(function(){" +
   "['B','B+','A','A−','A+','B+','A','A','B+','A','A+','A','A+','Z']" +
   "  .forEach(function(sym,i){ Store.saveAs('算数','s09',i+1,sym); });" +
   "Final.set('算数','s09','単元','九九の表とかけ算','');" +   /* いったん空に */
   "var r = apiSetRated('算数','九九の表とかけ算',true);" +
   "return r.adopted === 1 && typeof Final.unitValue('算数','s09','九九の表とかけ算')==='string';})()",
   "apiSetRated('算数','九九の表とかけ算',true)");
ok("採用ずみの値は押し直しても書き換えられない",
   "(function(){var v=Final.unitValue('算数','s09','九九の表とかけ算');" +
   "Final.set('算数','s09','単元','九九の表とかけ算','Z++');" +
   "apiSetRated('算数','九九の表とかけ算',true);" +
   "return Final.unitValue('算数','s09','九九の表とかけ算')==='Z++';})()");
ok("戻せる", "(function(){apiSetRated('算数','わり算',false);return Master.unitOf('算数',20).rated===false;})()");
clockReal();

console.log("■ 教科が無いとき（今回のつまずき）");
clockAt("2026-05-22T12:00:00+09:00");
as("sakura@example.ed.jp");
/* 教科マスタを空にして、児童の画面が黙って壊れないことを見る */
const savedSubjects = SHEETS["教科マスタ"].splice(1);
ev("clearAllCache()");
ok("教科が無ければ apiBoot は理由を返す",
   "(function(){var b=apiBoot();return b.ok===true && b.empty===true && " +
   "typeof b.why==='string' && b.rows===undefined;})()", "apiBoot()");
ok("児童には児童の言葉で返る（教師の用語を出さない）",
   "apiBoot().why.indexOf('教科マスタ') < 0 && apiBoot().why.indexOf('せんせい') >= 0",
   "apiBoot().why");
/* 公開が false だけのとき */
SHEETS["教科マスタ"].push(["体育",105,false]);
ev("clearAllCache()");
ok("公開が無ければ、児童には空の面が出る",
   "apiBoot().empty === true && apiBoot().why.indexOf('せんせい') >= 0", "apiBoot().why");
as("sensei@example.ed.jp");
ok("教師は非公開しかなくても、その教科で画面が出る",
   "(function(){var b=apiBoot();return b.ok===true && !b.empty && b.subject==='体育';})()",
   "apiBoot()");
/* 戻す */
SHEETS["教科マスタ"].splice(1);
savedSubjects.forEach(function(r){ SHEETS["教科マスタ"].push(r); });
ev("clearAllCache()");
ok("戻したら教科が見える", "Master.subjectNames(false).length === 2");
ok("diagnose が走り、行を返す",
   "(function(){var r=diagnose();return Array.isArray(r) && r.length>0;})()");
ok("diagnose が実施済みの授業数を見ている",
   "diagnose().join('|').indexOf('実施済みの授業') >= 0", "diagnose().join(' / ')");
clockReal();

console.log("■ 教師画面の入口");
clockAt("2026-05-22T12:00:00+09:00");
as("sakura@example.ed.jp");
ok("児童は教師の入口を呼べない",
   "apiTeacherBoot().ok===false && apiUnitTable('算数','わり算').ok===false && " +
   "apiSaveRule({aFrom:'A'}).ok===false && apiSaveUnits('算数',[]).ok===false && " +
   "apiSetHeld('算数',1,2,'2026-04-10').ok===false && apiAdoptAll('算数','わり算').ok===false");
as("sensei@example.ed.jp");
ok("apiTeacherBoot が教科・名簿・式・診断を返す",
   "(function(){var b=apiTeacherBoot();return b.ok && Object.keys(b.subjects).length>0 && " +
   "b.names.length>0 && typeof b.rule.aFrom==='number' && Array.isArray(b.diagnose) && " +
   "Array.isArray(b.syms) && b.syms.length===20;})()", "apiTeacherBoot().diagnose");
ok("apiUnitTable が29人ぶん返す",
   "(function(){var t=apiUnitTable('算数','九九の表とかけ算');" +
   "return t.ok && t.rows.length===Roster.all().length && typeof t.ruleText==='string';})()",
   "apiUnitTable('算数','九九の表とかけ算').rows[0]");
ok("一斉入力は空欄だけに入る",
   "(function(){var r=apiBulk('算数',3,'休',false);return r.ok && typeof r.put==='number';})()",
   "apiBulk('算数',3,'休',false)");
ok("採用を取り消すと仮値に戻る",
   "(function(){apiAdopt('算数','九九の表とかけ算','s09','');" +
   "return Final.unitValue('算数','s09','九九の表とかけ算')===null;})()");
ok("apiAdoptAll が仮値を採用する",
   "apiAdoptAll('算数','九九の表とかけ算',false).put >= 1",
   "apiAdoptAll('算数','九九の表とかけ算',false)");
ok("apiTermTable が評定と分布を返す",
   "(function(){var t=apiTermTable('算数',1);return t.ok && t.rows.length>0 && " +
   "t.dist && typeof t.dist.A==='number';})()", "apiTermTable('算数',1).dist");
ok("学年末（0）は全学期の単元を見る",
   "apiTermTable('算数',0).units.length >= apiTermTable('算数',1).units.length");
ok("しきい値を書き換えると設定に効く",
   "(function(){apiSaveRule({aFrom:'A'});var r=Config.rule();" +
   "apiSaveRule({aFrom:'A+'});return r.aFrom===valueOfSym('A');})()");
ok("開室時刻とロック時刻を書き換えられる",
   "(function(){apiSaveRule({open:'7:30',lock:'17:00'});" +
   "var a=Config.openTime(),b=Config.lockTime();apiSaveRule({open:'8:00',lock:'16:00'});" +
   "return a.h===7&&a.m===30&&b.h===17;})()");
ok("単元を入れ直せる（並べ替え・削除も1回で反映）",
   "(function(){var u=Master.subject('算数').units.slice();" +
   "apiSaveUnits('算数',[{name:'ためし',from:1,to:70,c:5,term:1,rated:false}]);" +
   "var one=Master.subject('算数').units;" +
   "apiSaveUnits('算数',u);" +
   "return one.length===1 && one[0].name==='ためし' && Master.subject('算数').units.length===u.length;})()");
ok("教科を足せる／公開を切り替えられる",
   "(function(){apiSaveSubject('図工',60,false);var s=Master.subject('図工');" +
   "apiSaveSubject('図工',60,true);var t=Master.subject('図工');" +
   "return s.open===false && t.open===true && t.total===60;})()");
ok("実施日をまとめて入れられる",
   "(function(){var r=apiSetHeld('算数',26,30,'2026-05-01');" +
   "return r.ok && r.put===5 && Master.isHeld('算数',30,new Date('2026-05-20'))===true;})()",
   "apiSetHeld('算数',26,30,'2026-05-01')");
ok("apiDiagnose が行を返す", "apiDiagnose().lines.length > 0");
ok("教師は児童を選んでその画面を見られる",
   "(function(){var r=apiReadAs('算数','s09');return r.ok && r.rows.length===70;})()");
clockReal();

console.log("■ 出力");
as("sensei@example.ed.jp");
ok("通知表用の表を書き出せる",
   "(function(){var r=exportTerm('算数',1);" +
   "return r.ok && r.sheet==='出力_算数_1学期' && SH_HAS(r.sheet);})()",
   "exportTerm('算数',1)");
ok("同じ名前で作り直しても増えない",
   "(function(){exportTerm('算数',1);exportTerm('算数',1);return SH_COUNT('出力_算数_1学期')===1;})()");
ok("児童は書き出せない", "(function(){CURRENT_EMAIL_STUDENT();return exportTerm('算数',1).ok===false;})()");
as("sensei@example.ed.jp");

console.log("■ シートの用意");
ev("setupSheets()");
ok("setupSheets が走る（既にあるので何もしない）", alerts.length >= 1, "alerts.length");

console.log(ng ? "\n× " + ng + " 件だめだった" : "\n○ ぜんぶ通った");
process.exit(ng ? 1 : 0);

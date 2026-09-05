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
    ["学級","3年3組"],["年度",2026],["ロック時刻","16:00"],
    ["A下限","A+"],["C上限","C++"],["代表値","後半の中央値"],["後半の範囲",3],
    ["Dを含める",true],["Cを含める",true],["教師メール","sensei@example.ed.jp"]],
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

function fakeSheet(name){
  const v = SHEETS[name];
  if(!v) return null;
  const range = () => ({
    getValues: () => v.map(r => r.slice()),
    setValues(){ return this; }, setFontWeight(){ return this; },
    setBackground(){ return this; }, setNumberFormat(){ return this; }
  });
  return {
    getDataRange: range, getRange: range,
    getLastRow: () => v.length,
    setFrozenRows(){}, autoResizeColumns(){}
  };
}

const sandbox = {
  console,
  Date, Math, JSON, String, Number, Object, Array, isNaN, parseInt, parseFloat,
  SpreadsheetApp: {
    getActive: () => ({
      getSheetByName: fakeSheet,
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
  Session: { getActiveUser: () => ({ getEmail: () => CURRENT_EMAIL }) },
  HtmlService: {
    createHtmlOutputFromFile: n => ({
      getContent: () => fs.readFileSync(path.join(DIR, n + ".html"), "utf8") })
  }
};
vm.createContext(sandbox);

/* ---- 全 .gs を1つのスコープへ。GAS と同じ形。 ---- */
const order = ["Scale.gs","Config.gs","Roster.gs","Master.gs","Lock.gs","Code.gs","Setup.gs"];
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
const as = e => { CURRENT_EMAIL = e; ev("clearAllCache()"); };
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

console.log("■ シートの用意");
ev("setupSheets()");
ok("setupSheets が走る（既にあるので何もしない）", alerts.length === 1, "1");

console.log(ng ? "\n× " + ng + " 件だめだった" : "\n○ ぜんぶ通った");
process.exit(ng ? 1 : 0);

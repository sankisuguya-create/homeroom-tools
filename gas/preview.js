/* ==================================================================
   preview.js — デプロイせずに画面を見る。

     node gas/preview.js                     児童画面を1枚の HTML に書き出す
     node gas/preview.js out.png             playwright-core があれば png も撮る
     node gas/preview.js out.png teacher     教師画面を見る

   gas/ のサーバコードをブラウザの中で動かし、student.html / teacher.html を
   実際に描く。google.script.run をその場の関数呼び出しに差し替えているだけなので、
   **画面もサーバも本物**が動く。Google のアカウントも配置も要らない。

   偽のシートは localcheck.js とは別に持っている。あちらは判定の境目を突く
   ための小さな仕掛け、こちらは画面を1枚描くための1年分。**本番のコードは
   共有していて、ここにあるのは検査の道具だけ**なので、二重でも壊れる先がない。
================================================================== */
process.env.TZ = "Asia/Tokyo";

const fs = require("fs"), path = require("path");
const G = __dirname;

/* Scale.gs は入れない。実 GAS ではサーバとクライアントが別スコープだが、
   このプレビューでは同じ窓に入るので scale.html 側の定義とぶつかる。
   中身は同じ1つの元（src/scale.js）から出ているので、片方で足りる。 */
const gsOrder = ["Config.gs","Roster.gs","Master.gs","Lock.gs","Hours.gs",
                 "Store.gs","Aggregate.gs","Api.gs","Export.gs","Code.gs","Setup.gs"];
const server = gsOrder.map(f => fs.readFileSync(path.join(G, f), "utf8")).join("\n");

const WHICH = (process.argv[3] === "teacher") ? "teacher" : "student";

const SHEETS = {
  "設定": [["キー","値"],["学級","3年3組"],["年度",2026],
    ["開室時刻","8:00"],["ロック時刻","16:00"],
    ["A下限","A+"],["C上限","C+"],["代表値","後半の中央値"],["後半の範囲",3],
    ["Y解放",false],["Dを含める",true],["Cを含める",true],
    ["教師メール","sensei@example.ed.jp"]],
  "教科マスタ": process.env.NO_SUBJECTS
      ? [["教科","時数","公開"]]
      : [["教科","時数","公開"],["算数",70,true],["国語",60,true],["体育",105,false]],
  "名簿": [["児童ID","出席番号","氏名","メール"],
    ["s01",1,"あおい","aoi@example.ed.jp"],
    ["s02",2,"いつき","itsuki@example.ed.jp"],
    ["s03",3,"うみ","umi@example.ed.jp"],
    ["s09",9,"さくら","sakura@example.ed.jp"],
    ["s10",10,"しおん","shion@example.ed.jp"],
    ["s16",16,"なぎさ","nagisa@example.ed.jp"]],
  "単元マスタ": [["教科","単元名","開始No","終了No","色","学期","評価公開"],
    ["算数","九九の表とかけ算",1,14,0,1,true],
    ["算数","わり算",15,30,1,1,false],
    ["算数","たし算とひき算の筆算",31,48,2,2,false],
    ["算数","時こくと時間",49,70,3,3,false]],
  "記録": [["教科","児童ID","No","記号","保存時刻","更新者"]],
  "確定": [["教科","児童ID","種別","対象","値","確定時刻"]]
};

/* 記録：児童ごとに22件。直近2件は今日＝まだ直せる、それ以前は過去＝ロック済み */
(function(){
  const SEED = ["B","B+","B","A−","B+","A","休","B+","A−","A","A+","A","B+","Z",
                "B","/","C","B+","A−","A++","A","A+"];
  const ALL  = ["D","C","C+","B−","B","B+","B++","A−","A","A+","A++","Z","Z+","Y","Y+"];
  const NOW  = new Date("2026-05-22T12:00:00+09:00");
  SHEETS["名簿"].slice(1).forEach((st, si)=>{
    for(let i = 0; i < SEED.length; i++){
      const sym = (si === 0) ? SEED[i]
                : (SEED[i] === "休" || SEED[i] === "/") ? SEED[i]
                : ALL[Math.max(0, Math.min(14, 5 + ((si*5 + i*3) % 6) - (si === 5 ? 4 : 0)))];
      const recent = i >= SEED.length - 2;
      const t = recent ? new Date(NOW.getTime() - 3600e3)
                       : new Date(NOW.getTime() - (SEED.length - i + 2) * 86400e3);
      SHEETS["記録"].push(["算数", st[0], i + 1, sym, t, ""]);
    }
  });
})();

const fakes = `
var SH = ${JSON.stringify(SHEETS)};
/* 保存時刻は JSON を通ると文字列になる。Date に戻す（toDate_ が受けるので
   そのままでも動くが、実物に近づけておく）。 */
SH["記録"].slice(1).forEach(function(r){ if(r[4]) r[4] = new Date(r[4]); });

var CURRENT_EMAIL = "__WHO__";

function fakeSheet(name){
  var v = SH[name]; if(!v) return null;
  function range(row, col, nRow, nCol){
    if(row === undefined) return {getValues:function(){ return v.map(function(r){ return r.slice(); }); }};
    var r0 = row - 1, c0 = col - 1;
    return {
      getValues:function(){ var o=[]; for(var i=0;i<nRow;i++){ var s=v[r0+i]||[]; o.push(s.slice(c0,c0+nCol)); } return o; },
      getValue:function(){ return (v[r0]||[])[c0]; },
      setValue:function(x){ while(v.length<=r0) v.push([]); v[r0][c0]=x; return this; },
      setValues:function(vals){ for(var i=0;i<vals.length;i++){ while(v.length<=r0+i) v.push([]);
        for(var j=0;j<vals[i].length;j++) v[r0+i][c0+j]=vals[i][j]; } return this; },
      setFontWeight:function(){return this;}, setBackground:function(){return this;},
      setNumberFormat:function(){return this;}
    };
  }
  return { __name:name, getDataRange:function(){return range();}, getRange:range,
    getLastRow:function(){return v.length;},
    appendRow:function(r){ v.push(r.slice()); },
    deleteRow:function(n){ v.splice(n-1,1); },
    setFrozenRows:function(){}, setFrozenColumns:function(){}, autoResizeColumns:function(){} };
}

var SpreadsheetApp = {
  getActive:function(){ return {
    getUrl:function(){ return "https://docs.google.com/spreadsheets/d/TEST/edit"; },
    getSpreadsheetTimeZone:function(){ return "Asia/Tokyo"; },
    setSpreadsheetTimeZone:function(){},
    getSheetByName:fakeSheet,
    insertSheet:function(n){ SH[n]=[[]]; return fakeSheet(n); },
    deleteSheet:function(sh){ if(sh && sh.__name) delete SH[sh.__name]; }
  }; },
  getUi:function(){ return {alert:function(){}, createMenu:function(){ 
    var m={addItem:function(){return m;},addSeparator:function(){return m;},addToUi:function(){}}; return m; }}; }
};
var _cache = {};
var CacheService = { getScriptCache:function(){ return {
  get:function(k){ return _cache[k] || null; },
  put:function(k,v){ _cache[k]=v; },
  remove:function(k){ delete _cache[k]; } }; } };
var Session = {
  getActiveUser:function(){ return {getEmail:function(){ return CURRENT_EMAIL; }}; },
  getScriptTimeZone:function(){ return "Asia/Tokyo"; }
};
var ScriptApp = { getService:function(){ return {getUrl:function(){ return ""; }}; } };
var Utilities = { formatDate:function(d, tz, f){
  var p = function(n){ return String(n).padStart(2,"0"); };
  return f === "HH:mm" ? p(d.getHours()) + ":" + p(d.getMinutes()) : d.toISOString(); } };
var Logger = { log:function(){} };
var LockService = { getScriptLock:function(){ return {tryLock:function(){return true;}, releaseLock:function(){}}; } };
var HtmlService = { createHtmlOutputFromFile:function(){ return {getContent:function(){return "";}}; } };

/* 時計を止める。開いている時間の12:00。 */
(function(){
  var Real = Date, t = new Real("2026-05-22T12:00:00+09:00").getTime();
  function D(a){
    if(arguments.length === 0) return new Real(t);
    return arguments.length === 1 ? new Real(a)
      : new Real(arguments[0], arguments[1], arguments[2]||1,
                 arguments[3]||0, arguments[4]||0, arguments[5]||0);
  }
  D.prototype = Real.prototype; D.now = function(){ return t; };
  D.parse = Real.parse; D.UTC = Real.UTC;
  window.Date = D;
})();

/* google.script.run のかわり。window にある関数をそのまま通す。
   名前を並べておくと、入口が増えたときにここだけ古くなって
   「動かない」と誤診することになる。 */
var google = {script:{run:(function(){
  function mk(succ, fail){
    return new Proxy({}, {get:function(_, name){
      if(name === "withSuccessHandler") return function(f){ return mk(f, fail); };
      if(name === "withFailureHandler") return function(f){ return mk(succ, f); };
      return function(){
        var a = arguments;
        setTimeout(function(){
          try{
            if(typeof window[name] !== "function") throw new Error(name + " が無い");
            succ && succ(window[name].apply(null, a));
          }catch(e){ fail && fail(e); }
        }, 30);
      };
    }});
  }
  return mk(null, null);
})()}};
`;

/* サーバコードのあとに、教師が「単元の評価をする」を押した状態を作る */
const seed = `
(function(){ var keep = CURRENT_EMAIL; CURRENT_EMAIL = "sensei@example.ed.jp";
  try{ apiSetRated("算数","九九の表とかけ算",true); }catch(e){ console.log("setRated:", e.message); }
  CURRENT_EMAIL = keep; })();
`;

let html = fs.readFileSync(path.join(G, WHICH + ".html"), "utf8");
html = html.replace(/<\?!= include\('(\w+)'\) \?>/g,
  (_, n) => fs.readFileSync(path.join(G, n + ".html"), "utf8"));
html = html.replace("<script>\nconst $ =",
  "<script>\n" + fakes + "\n" + server + "\n" + seed + "\n</script>\n<script>\nconst $ =");
html = html.replace("__WHO__",
  WHICH === "teacher" ? "sensei@example.ed.jp" : "sakura@example.ed.jp");

const OUT_HTML = path.join(process.cwd(), WHICH + "-preview.html");
fs.writeFileSync(OUT_HTML, html);
console.log("書き出した:", OUT_HTML, "（" + html.length + " bytes）");
console.log("ブラウザで開けば、そのまま画面が動く。");

const shot = process.argv[2];
let chromium = null;
if(shot){
  for(const where of ["playwright-core",
                      path.join(process.cwd(), "node_modules", "playwright-core")]){
    try { chromium = require(where).chromium; break; } catch(e) {}
  }
  if(!chromium) console.log("playwright-core が無いので png は撮らない。上の HTML を開いて見る。");
}
if(chromium) (async()=>{
  const b = await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
  const ctx = await b.newContext({viewport:{width: WHICH === "teacher" ? 1400 : 1200, height:1000},
                                  deviceScaleFactor:2, timezoneId:"Asia/Tokyo"});
  const pg = await ctx.newPage();
  const errs = []; pg.on("pageerror", e => errs.push(e.message));
  await pg.goto("file://" + OUT_HTML);
  await pg.waitForTimeout(1000);
  console.log("errors:", JSON.stringify(errs));
  if(WHICH === "teacher"){
    console.log(JSON.stringify(await pg.evaluate(()=>({
      tabs:  [...document.querySelectorAll("#tabs button")].map(b=>b.textContent),
      subj:  [...document.querySelectorAll("#subjSeg button")].map(b=>b.textContent),
      rows:  document.querySelectorAll("#unitTbl tbody tr").length,
      rule:  document.getElementById("ruleText").textContent,
      err:   document.getElementById("errbar").classList.contains("hidden") ? null
             : document.getElementById("errbar").textContent
    })), null, 1));
  }else{
    console.log(JSON.stringify(await pg.evaluate(()=>({
      title: document.getElementById("title").textContent,
      cells: document.querySelectorAll(".cell").length,
      filled:[...document.querySelectorAll(".cell select")].filter(s=>s.value).length,
      locked:document.querySelectorAll(".cell.locked").length,
      terms: [...document.querySelectorAll(".term-block")].map(b=>
               b.querySelector(".term-head span").textContent + "=" +
               (b.querySelector(".term-row").classList.contains("hidden") ? "とじる" : "ひらく")),
      units: [...document.querySelectorAll(".unit-card")].map(c=>
               c.querySelector(".name").textContent + "=" + c.querySelector(".valbox").textContent),
      loading: !document.getElementById("loading").classList.contains("hidden"),
      closed: !document.getElementById("closedPanel").classList.contains("hidden")
    })), null, 1));
  }
  await pg.screenshot({path: shot});
  console.log("画面:", shot);
  await b.close();
})();

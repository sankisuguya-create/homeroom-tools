/* dist/Dialog.html を Chromium で開き、google.script.run を偽物にして一通り操作する。
     NODE_PATH=$(npm root -g) node apps/seating/tests/ui-smoke.mjs [スクショの出力先]
   playwright が無い環境では何もせず終わる。 */
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
let chromium;
try{ ({chromium}=require('playwright')); }catch(e){ console.log('ui-smoke: playwright なし、省略'); process.exit(0); }
const {makeInput}=require('./fixture.js');
const here=path.dirname(fileURLToPath(import.meta.url));
const shot=process.argv[2];

const input=makeInput(inp=>{
  inp.students.forEach((s,i)=>{ s.name=['あおき','いとう','うえだ','えんどう','おおた','かとう','きむら','くどう'][i%8]+(i+1); });
  inp.students[0].front=true;
  inp.students[4].leader=true;
  inp.conditions.push({a:1,b:2,type:'離す',must:true});
  inp.rows=[2,3,4,5,6,7]; inp.cols=[1,2,4,5,7,8]; inp.warnings=['条件シート 5行目：例']; inp.nextRound=1;
  inp.settings.count=3;
});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||undefined});
const page=await browser.newPage({viewport:{width:1100,height:720}});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',d=>d.accept());
await page.addInitScript(inp=>{
  window.__committed=null;
  const handlers={
    loadInput:()=>inp,
    commit:(seats,round)=>{ window.__committed={seats,round}; return {ok:true,round}; }
  };
  window.google={script:{run:new Proxy({},{get(_,k){
    let ok=()=>{},ng=()=>{};
    const r=new Proxy({},{get(_,m){
      if(m==='withSuccessHandler') return f=>{ok=f;return r;};
      if(m==='withFailureHandler') return f=>{ng=f;return r;};
      return (...a)=>setTimeout(()=>{ try{ok(handlers[m](...a));}catch(e){ng(e);} },10);
    }});
    return r[k];
  }})}};
},input);
await page.goto('file://'+path.join(here,'../dist/Dialog.html'));
await page.waitForSelector('#make:not([disabled])');
await page.click('#make');
await page.waitForSelector('.tab',{timeout:60000});
const tabs=await page.$$eval('.tab',t=>t.length);
if(tabs!==3) throw new Error('案が3つ出ない: '+tabs);
const seats=await page.$$eval('#stage .seat',s=>s.length);
if(seats!==36) throw new Error('座席数 '+seats);
// 入れ替え
const before=await page.$$eval('#stage .seat .nm',s=>s.map(x=>x.textContent));
await page.click('#stage .seat[data-i="10"]'); await page.click('#stage .seat[data-i="20"]');
const after=await page.$$eval('#stage .seat .nm',s=>s.map(x=>x.textContent));
if(after[10]!==before[20]||after[20]!==before[10]) throw new Error('入れ替わらない');
await page.click('#flip');
if(shot) await page.screenshot({path:shot});
await page.click('#commit');
await page.waitForFunction(()=>window.__committed);
const c=await page.evaluate(()=>window.__committed);
if(c.round!==1||c.seats.filter(s=>s.id!=null).length!==32) throw new Error('決定の書き込み内容');
await page.click('#show'); await page.click('#rvnext'); await page.click('#rvall'); await page.click('#rvclose');
if(errors.length) throw new Error(errors.join('\n'));
await browser.close();
console.log('ui-smoke: ok');

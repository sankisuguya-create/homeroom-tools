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
  inp.settings.count=3; inp.settings.weights={};
  inp.students[2].tall=true; inp.students[5].support=true;
  inp.layoutGrid=Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>{
    const s=inp.seats.find(x=>x.r===r+2&&x.c===c+1); return s?String(s.group):'';
  }));
});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||undefined});
const page=await browser.newPage({viewport:{width:1100,height:720}});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',d=>d.accept());
await page.addInitScript(inp=>{
  window.__committed=null;
  const handlers={
    loadInput:()=>inp,
    commit:(seats,round)=>{ window.__committed={seats,round}; return {ok:true,round}; },
    sourceInfo:(url)=>({name:'去年の座席',own:false,sheets:[{name:'メモ',rows:3,cols:3},{name:'2学期の座席',rows:9,cols:8}]}),
    readSource:(url,sheet,a1)=>[
      ['','','黒板','',''],
      ['1 あおき1','いとう2','','3',''],
      ['えんどう4','だれか','','おおた5',''],
      ['','','','','']],
    importEntries:(entries,date)=>{ window.__imported={entries,date}; return {round:2,input:Object.assign({},inp,{history:[entries],settings:Object.assign({},inp.settings,{weights:window.__weights||{}})})}; },
    saveWeights:(w)=>{ window.__weights=w; return 'ok'; },
    saveLayout:(grid)=>{ window.__layout=grid;
      const seats=[]; grid.forEach((row,r)=>row.forEach((v,c)=>{ if(v!=='') seats.push({r:r+2,c:c+1,group:v==='○'?'':v}); }));
      return Object.assign({},inp,{seats,layoutGrid:grid,rows:[...new Set(seats.map(s=>s.r))].sort((a,b)=>a-b)}); }
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
// 重視：高身長を必須に
await page.click('#views [data-v=weights]');
await page.click('.seg button[data-k=tall][data-l="4"]');
await page.waitForFunction(()=>window.__weights&&window.__weights.tall===4);
if(shot) await page.screenshot({path:shot.replace('.png','-weights.png')});
// 取り込み：別ファイルを開く→読む→赤いセルを直す→日付→取り込む
await page.click('#views [data-v=import]');
await page.fill('#imurl','https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz0123/edit');
await page.click('#imopen');
await page.waitForSelector('#imsheet');
if(await page.$eval('#imsheet',e=>e.value)!=='2学期の座席') throw new Error('座席らしいシートを既定で選ばない');
await page.click('#imread');
await page.waitForSelector('.pv');
if(await page.$$eval('.pv td.ng',t=>t.length)!==1) throw new Error('対応できないセルの数');
await page.selectOption('.fix select','skip');
await page.fill('#imdate','2025-09-01');
await page.dispatchEvent('#imdate','change');
if(shot) await page.screenshot({path:shot.replace('.png','-import.png')});
await page.click('#imgo');
await page.waitForFunction(()=>window.__imported);
const im=await page.evaluate(()=>window.__imported);
if(im.date!=='2025-09-01'||im.entries.length!==5) throw new Error('取り込み内容 '+JSON.stringify(im));
const e1=im.entries.find(e=>e.id===1);
if(e1.r!==2||e1.c!==1) throw new Error('座標 '+JSON.stringify(e1));
// 配置：ひな形「4人の島」→ 保存
await page.click('#views [data-v=layout]');
await page.click('[data-p="4人の島"]');
// 1マスを班なしで塗る（ドラッグ）
await page.click('.sw[data-t="○"]');
const box=await page.locator('#ed div[data-r="0"][data-c="2"]').boundingBox();
await page.mouse.move(box.x+10,box.y+10); await page.mouse.down(); await page.mouse.move(box.x+10,box.y+60); await page.mouse.up();
if(shot) await page.screenshot({path:shot.replace('.png','-layout.png')});
await page.click('#edsave');
await page.waitForFunction(()=>window.__layout);
const lay=await page.evaluate(()=>window.__layout);
if(lay[0][2]!=='○'||lay[1][2]!=='○'||lay[0][0]!=='1') throw new Error('配置の保存内容 '+JSON.stringify(lay.slice(0,2)));
await page.click('#views [data-v=seat]');
await page.waitForSelector('#make:not([disabled])');
await page.click('#make');
await page.waitForSelector('.tab',{timeout:60000});
const tabs=await page.$$eval('.tab',t=>t.length);
if(tabs!==3) throw new Error('案が3つ出ない: '+tabs);
const seats=await page.$$eval('#stage .seat',s=>s.length);
if(seats!==38) throw new Error('座席数 '+seats);
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
const tallSeat=c.seats.find(s=>s.id===3);
if(tallSeat.r<=3) throw new Error('高身長（必須）が前方');
await page.click('#show'); await page.click('#rvnext'); await page.click('#rvall'); await page.click('#rvclose');
if(errors.length) throw new Error(errors.join('\n'));
await browser.close();
console.log('ui-smoke: ok');

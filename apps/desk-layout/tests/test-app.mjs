// 描画ロジックの不変条件を確かめる: node apps/desk-layout/tests/test-app.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const src=f=>readFile(new URL('../src/'+f,import.meta.url),'utf8');
const ctx=vm.createContext({});
vm.runInContext((await src('data.js'))+'\n'+(await src('draw.js')),ctx);
const g=vm.runInContext('({itemSize,colorOf,GRID_LEVELS,gridLevel,gridPoints,snap,DESK,ITEMS,DEFAULT_LAYOUTS,flipLayout,composeSingle,composeGroup,topView,layoutLabels,parseName,plainName,iconSvg})',ctx);
const {DESK,ITEMS,DEFAULT_LAYOUTS}=g;

// 標準の配置：知らない用具・知らない状態・机の外の中心を持たない
for(const l of DEFAULT_LAYOUTS){
  for(const p of l.top){
    assert.equal(ITEMS[p.item]?.kind,'top',l.id+':'+p.item);
    assert.ok(ITEMS[p.item].states[p.state],l.id+':'+p.item+':'+p.state);
    assert.ok(p.x>=0&&p.x<=DESK.w&&p.y>=0&&p.y<=DESK.d,l.id+':'+p.item+' 中心が机の外');
  }
  for(const s of ['left','right'])for(const h of l.hooks[s])assert.equal(ITEMS[h.item]?.kind,'hang');
  for(const a of l.away)assert.ok(ITEMS[a.item]);
}
// 開く物は閉じた形と開いた形の両方を持つ
for(const id of ['textbook','notebook','drill','renraku','pencase','colorpencil','pc','shodobox','palette','enogubox'])
  assert.ok(ITEMS[id].states.closed&&ITEMS[id].states.open,id);
// ふりがな記法
assert.deepEqual(JSON.parse(JSON.stringify(g.parseName('{消|け}しゴム'))),[{b:'消',r:'け'},{b:'しゴム',r:''}]);
assert.equal(g.plainName('{絵|え}の{具|ぐ}バッグ'),'絵の具バッグ');

// 左右反転：2回で元に戻る・フックが入れ替わる
for(const l of DEFAULT_LAYOUTS){
  const f=g.flipLayout(l), ff=g.flipLayout(f);
  assert.equal(JSON.stringify(f.hooks.left),JSON.stringify(l.hooks.right));
  ff.top.forEach((p,i)=>{assert.ok(Math.abs(p.x-l.top[i].x)<1e-9);assert.equal(!!p.m,false);assert.equal(p.r||0,l.top[i].r||0);});
}

// 名前の吹き出し：初期状態では出さない／出すと同じ辺で重ならない
const math=DEFAULT_LAYOUTS[0];
assert.equal(g.topView(math,{ruby:true}).labels.length,0);
const all=JSON.parse(JSON.stringify(math)); all.top.forEach(p=>p.label=true);
all.top.push({item:'glue',state:'closed',x:20,y:200,r:0,label:true},{item:'scissors',state:'closed',x:30,y:260,r:0,label:true},{item:'ruler',state:'closed',x:25,y:300,r:0,label:true});
const labs=g.layoutLabels(all.top,['L','R','T','B'],true,DESK.d).labels;
assert.equal(labs.length,all.top.length);
for(const a of labs)for(const b of labs){
  if(a===b||a.side!==b.side)continue;
  const ox=Math.abs(a.cx-b.cx)<(a.box.w+b.box.w)/2, oy=Math.abs(a.cy-b.cy)<(a.box.h+b.box.h)/2;
  assert.ok(!(ox&&oy),'吹き出しが重なる: '+a.name+' / '+b.name);
}
for(const a of labs){   // 机の上には置かない
  const inX=a.cx+a.box.w/2>0&&a.cx-a.box.w/2<DESK.w, inY=a.cy+a.box.h/2>0&&a.cy-a.box.h/2<DESK.d;
  assert.ok(!(inX&&inY),'吹き出しが机に重なる: '+a.name);
}

// 合成：数値が壊れていない
for(const l of DEFAULT_LAYOUTS)for(const flip of [false,true])for(const chair of [false,true]){
  for(const c of [g.composeSingle(l,{ruby:true,chair,flip}),g.composeGroup(l,{ruby:true,chair,flip})]){
    assert.ok(!/NaN|undefined|Infinity/.test(c.viewBox+c.svg),l.id);
    const [,,w,h]=c.viewBox.split(' ').map(Number); assert.ok(w>0&&h>0);
  }
}
// 掛ける物がない配置では横から見た図を出さない
const bare=JSON.parse(JSON.stringify(math)); bare.hooks={left:[],right:[]};
assert.ok(!g.composeSingle(bare,{}).svg.includes('class="cap"'));
assert.equal((g.composeSingle(math,{}).svg.match(/class="cap"/g)||[]).length,4);
assert.ok(!g.composeSingle(math,{topOnly:true}).svg.includes('class="cap"'),'真上だけ');
assert.equal(Object.keys(ITEMS.pc.states).join(),'closed,open,tablet,tent');
for(const id of Object.keys(ITEMS))assert.ok(g.iconSvg(id,40).startsWith('<svg'));

// 判型：ノートは B5／A4、開くと幅2倍。色は表紙だけ
assert.equal(g.itemSize({item:'notebook',state:'closed'}).join(),'179,252');
assert.equal(g.itemSize({item:'notebook',state:'closed',size:'a4'}).join(),'210,297');
assert.equal(g.itemSize({item:'notebook',state:'open',size:'a4'}).join(),'420,297');
assert.equal(g.itemSize({item:'textbook',state:'open',size:'ab'}).join(),'420,257');
assert.equal(g.itemSize({item:'notebook',state:'closed',size:'xx'}).join(),'179,252','知らない判型は既定へ');
assert.ok(g.colorOf({item:'notebook',color:6}).startsWith('#'));
for(const id of Object.keys(ITEMS))if(ITEMS[id].kind==='top')for(const st of Object.keys(ITEMS[id].states)){
  const wd=g.itemSize({item:id,state:st}); assert.ok(wd[0]>0&&wd[1]>0,id+':'+st);
}

// グリッド：細かい段は粗い段の交点をすべて含む／標準の配置は「こまかい」の交点上／snap は動かない点を動かさない
const near=(a,b)=>Math.abs(a-b)<1e-6;
for(let k=1;k<g.GRID_LEVELS.length;k++){
  const fine=g.gridPoints(g.GRID_LEVELS[k]);
  for(const p of g.gridPoints(g.GRID_LEVELS[k-1]))assert.ok(fine.some(q=>near(q.x,p.x)&&near(q.y,p.y)),'段の包含');
}
const fineLv=g.gridLevel('fine');
for(const l of DEFAULT_LAYOUTS)for(const p of l.top){
  const q=g.snap(p.x,p.y,fineLv); assert.ok(near(q.x,p.x)&&near(q.y,p.y),l.id+':'+p.item+' がグリッドの交点にない');
}
for(const lv of g.GRID_LEVELS)for(const p of g.gridPoints(lv)){const q=g.snap(p.x,p.y,lv);assert.ok(near(q.x,p.x)&&near(q.y,p.y));}
const c0=g.snap(-50,9999,g.gridLevel('normal')); assert.ok(c0.x>0&&c0.y<DESK.d,'机の外は端の交点へ');

// 配布物
const dist=await readFile(new URL('../dist/Index.html',import.meta.url),'utf8');
assert.ok(dist.includes('<html lang="ja">')&&dist.includes('<title>机の配置図</title>'));
assert.ok(!dist.includes('@include'));
console.log('ok');

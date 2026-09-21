import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const [app,tagsText,sprite,peopleTagsText,peopleSprite,dist,notices,tablerLicense]=await Promise.all([
  readFile(new URL('src/JavaScript.html',root),'utf8'),
  readFile(new URL('src/assets/LucideTags.html',root),'utf8'),
  readFile(new URL('src/assets/LucideSprite.html',root),'utf8'),
  readFile(new URL('src/assets/TablerPeopleTags.html',root),'utf8'),
  readFile(new URL('src/assets/TablerPeople.html',root),'utf8'),
  readFile(new URL('dist/Index.html',root),'utf8'),
  readFile(new URL('THIRD_PARTY_NOTICES.md',root),'utf8'),
  readFile(new URL('licenses/Tabler-Icons-MIT.txt',root),'utf8')
]);
new Function(app);
const tags=JSON.parse(tagsText);
const peopleTags=JSON.parse(peopleTagsText);
assert.equal(Object.keys(tags).length,1848);
assert.equal((sprite.match(/<symbol id=/g)||[]).length,1848);
assert.equal(Object.keys(peopleTags).length,16);
assert.equal((peopleSprite.match(/<symbol id="tabler-/g)||[]).length,16);
assert.ok(Object.keys(peopleTags).every(name=>peopleSprite.includes(`id="tabler-${name}"`)));
assert.ok(!/<script|<foreignObject|\bon\w+=|(?:href|src)="https?:/i.test(peopleSprite));
assert.ok(!sprite.includes('<?xml'));
assert.ok(!peopleSprite.includes('<?xml'));
assert.ok(notices.includes('v3.47.0')&&notices.includes('9fd36e0ce5ad0ec8ed0aecc60d4bb2278364e71c'));
assert.ok(tablerLicense.includes('MIT License')&&tablerLicense.includes('Copyright (c) 2020-2026 Paweł Kuna'));
assert.ok(!dist.includes('<?!='));
assert.ok(dist.includes('<title>アイコンメーカー</title>'));
assert.ok(dist.includes('<span>アイコンメーカー</span>'));
assert.ok(!dist.includes('Icon Studio'));
assert.ok(dist.includes('const BATCH_SIZE=120'));
assert.ok(dist.includes('id="copyDesignLink"'));
assert.ok(dist.includes('id="downloadJpeg"')&&dist.includes('>JPEG保存</button>'));
assert.ok(dist.includes("function jpegBlob(svg,width,height){return rasterBlob(svg,width,height,'image/jpeg',0.92)}"));
assert.ok(dist.includes("if(type==='image/jpeg'){ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,width,height)}"));
assert.ok(dist.includes('header{height:44px'));
assert.ok(dist.includes('.swatch{width:22px;height:22px'));
assert.ok(dist.includes('align-content:start'));
assert.ok(dist.includes('grid-template-columns:repeat(9,minmax(0,1fr))'));
assert.ok(dist.includes('data-shape="sphere"')&&dist.includes('data-shape="hexagon"')&&dist.includes('data-shape="shield"'));
assert.ok(dist.includes('id="tabler-person-run"')&&dist.includes('id="tabler-people-friends"'));
assert.ok(dist.includes('>保存</button>')&&dist.includes('>読み込み</button>'));
assert.ok(!dist.includes('>JSON保存</button>')&&!dist.includes('>JSON読込</button>'));
const pure=app.slice(0,app.indexOf("$('search').addEventListener"))+`
tags={...JSON.parse(TEST_TAGS),...JSON.parse(TEST_PEOPLE_TAGS)};allNames=Object.keys(tags);
spriteRoot={querySelector:()=>({innerHTML:'<path d="M1 1h22v22"/>'})};
peopleRoot={querySelector:()=>({innerHTML:'<path d="M2 2h20v20"/>'})};
buildIndexes();
RESULT={all:allNames.length,indexed:searchIndex.size,missing:CATEGORIES.filter(x=>!searchIndex.has(x.icon)).length,counts:CATEGORIES.map(x=>(categoryIndex.get(x.id)||[]).length),movementCount:(categoryIndex.get('movement')||[]).length,peopleSearch:searchIndex.get('person-run').includes('走る'),peopleSymbol:symbolId('person-run'),lucideSymbol:symbolId('book-open'),invalid:normalizeDesign({icon:'bad',bg:'bad',mode:'bad'}),front:composeSvg({...state,shape:'front-cube'}).includes('x="42"'),sphere:composeSvg({...state,shape:'sphere'}).includes('radialGradient'),hexagon:composeSvg({...state,shape:'hexagon'}).includes('M256 0 478 128'),shield:composeSvg({...state,shape:'shield'}).includes('M256 8 464 80'),append:appendImportedSet([{icon:'a'}],[{icon:'b'},{icon:'c'}]),limitedAppend:appendImportedSet(Array.from({length:499},()=>({icon:'a'})),[{icon:'b'},{icon:'c'}]),linked:designFromUrl('?icon=star&label=%E6%A0%A1%E5%86%85%E6%8E%B2%E7%A4%BA&bg=%23C62828&mode=white&size=basic&shape=circle&layout=horizontal'),link:designUrl({icon:'star',label:'教材',bg:'#C62828',mode:'white',size:'basic',shape:'circle',layout:'horizontal'},'https://example.test/exec?authuser=0#old')};`;
const context={TEST_TAGS:tagsText,TEST_PEOPLE_TAGS:peopleTagsText,RESULT:null,localStorage:{getItem:()=>null,setItem:()=>{}},document:{getElementById:()=>null},URL,URLSearchParams,console};
vm.createContext(context);vm.runInContext(pure,context);
const result=JSON.parse(JSON.stringify(context.RESULT));
assert.equal(result.all,1864);assert.equal(result.indexed,1864);assert.equal(result.missing,0);
assert.ok(result.counts.every(n=>n>0));assert.equal(result.invalid.icon,'book-open');assert.equal(result.invalid.bg,'#147A42');assert.equal(result.front,true);
assert.equal(result.movementCount,16);
assert.equal(result.peopleSearch,true);assert.equal(result.peopleSymbol,'tabler-person-run');assert.equal(result.lucideSymbol,'lucide-book-open');
assert.equal(result.sphere,true);assert.equal(result.hexagon,true);assert.equal(result.shield,true);
assert.equal(result.append.added,2);assert.equal(result.append.set.length,3);assert.equal(result.limitedAppend.added,1);assert.equal(result.limitedAppend.set.length,500);assert.equal(result.limitedAppend.truncated,true);
assert.deepEqual(result.linked,{id:'',icon:'star',label:'校内掲示',bg:'#C62828',mode:'white',size:'basic',shape:'circle',layout:'horizontal'});
assert.ok(result.link.includes('authuser=0'));assert.ok(result.link.includes('icon=star'));assert.ok(result.link.includes('bg=%23C62828'));assert.ok(!result.link.includes('#old'));
console.log('アイコンメーカー checks passed');

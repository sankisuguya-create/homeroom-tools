import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('./',import.meta.url);
const [app,tagsText,sprite,dist]=await Promise.all([
  readFile(new URL('JavaScript.html',root),'utf8'),
  readFile(new URL('LucideTags.html',root),'utf8'),
  readFile(new URL('LucideSprite.html',root),'utf8'),
  readFile(new URL('dist/Index.html',root),'utf8')
]);
new Function(app);
const tags=JSON.parse(tagsText);
assert.equal(Object.keys(tags).length,1848);
assert.equal((sprite.match(/<symbol id=/g)||[]).length,1848);
assert.ok(!dist.includes('<?!='));
assert.ok(dist.includes('const BATCH_SIZE=120'));
assert.ok(dist.includes('>保存</button>')&&dist.includes('>読み込み</button>'));
assert.ok(!dist.includes('>JSON保存</button>')&&!dist.includes('>JSON読込</button>'));
const pure=app.slice(0,app.indexOf("$('search').addEventListener"))+`
tags=JSON.parse(TEST_TAGS);allNames=Object.keys(tags);
spriteRoot={querySelector:()=>({innerHTML:'<path d="M1 1h22v22"/>'})};
buildIndexes();
RESULT={all:allNames.length,indexed:searchIndex.size,missing:CATEGORIES.filter(x=>!searchIndex.has(x.icon)).length,counts:CATEGORIES.map(x=>(categoryIndex.get(x.id)||[]).length),invalid:normalizeDesign({icon:'bad',bg:'bad',mode:'bad'}),front:composeSvg({...state,shape:'front-cube'}).includes('x="42"'),append:appendImportedSet([{icon:'a'}],[{icon:'b'},{icon:'c'}]),limitedAppend:appendImportedSet(Array.from({length:499},()=>({icon:'a'})),[{icon:'b'},{icon:'c'}])};`;
const context={TEST_TAGS:tagsText,RESULT:null,localStorage:{getItem:()=>null,setItem:()=>{}},document:{getElementById:()=>null},console};
vm.createContext(context);vm.runInContext(pure,context);
const result=JSON.parse(JSON.stringify(context.RESULT));
assert.equal(result.all,1848);assert.equal(result.indexed,1848);assert.equal(result.missing,0);
assert.ok(result.counts.every(n=>n>0));assert.equal(result.invalid.icon,'book-open');assert.equal(result.invalid.bg,'#147A42');assert.equal(result.front,true);
assert.equal(result.append.added,2);assert.equal(result.append.set.length,3);assert.equal(result.limitedAppend.added,1);assert.equal(result.limitedAppend.set.length,500);assert.equal(result.limitedAppend.truncated,true);
console.log('Icon Studio checks passed');

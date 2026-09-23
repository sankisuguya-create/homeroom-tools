/* src/ → dist/。Dialog.html に solver.js を埋め込み、Apps Script に貼る3ファイルを作る。
     node apps/seating/scripts/build.mjs          生成
     node apps/seating/scripts/build.mjs --check  dist が最新か確かめる */
import {readFile,writeFile,mkdir} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const src=f=>readFile(new URL('src/'+f,root),'utf8');
const [dialog,solver,importer,code,manifest]=await Promise.all([src('Dialog.html'),src('solver.js'),src('importer.js'),src('Code.gs'),src('appsscript.json')]);
const strip=js=>js.replace(/\nif\(typeof module[^\n]*\n?$/,'\n');
let page=dialog;
for(const [name,js] of [['solver.js',solver],['importer.js',importer]]){
  const marker='/* @include '+name+' */';
  if(!page.includes(marker))throw new Error('Dialog.html に '+marker+' がありません');
  if(js.includes('</script'))throw new Error(name+' に </script が含まれている');
  page=page.replace(marker,()=>'/* 生成物：apps/seating/src/'+name+' から埋め込み。直接編集しない。 */\n'+strip(js));
}
const banner='/* 生成物：apps/seating/src/ から scripts/build.mjs が作る。直接編集しない。 */\n';
const out={
  'Dialog.html':page,
  'Code.gs':banner+code,
  'appsscript.json':manifest
};
const check=process.argv.includes('--check');
await mkdir(new URL('dist/',root),{recursive:true});
let stale=[];
for(const [name,body] of Object.entries(out)){
  const url=new URL('dist/'+name,root);
  if(check){
    const cur=await readFile(url,'utf8').catch(()=>null);
    if(cur!==body)stale.push(name);
  } else await writeFile(url,body);
}
if(stale.length){console.error('dist が古い: '+stale.join(', '));process.exit(1);}
console.log(check?'seating dist: 最新':'seating dist: 生成');

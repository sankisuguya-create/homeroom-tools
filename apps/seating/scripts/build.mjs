/* src/ → dist/。Dialog.html に solver.js を埋め込み、Apps Script に貼る3ファイルを作る。
     node apps/seating/scripts/build.mjs          生成
     node apps/seating/scripts/build.mjs --check  dist が最新か確かめる */
import {readFile,writeFile,mkdir} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const src=f=>readFile(new URL('src/'+f,root),'utf8');
const [dialog,solver,code,manifest]=await Promise.all([src('Dialog.html'),src('solver.js'),src('Code.gs'),src('appsscript.json')]);
const marker='/* @include solver.js */';
if(!dialog.includes(marker))throw new Error('Dialog.html に '+marker+' がありません');
const banner='/* 生成物：apps/seating/src/ から scripts/build.mjs が作る。直接編集しない。 */\n';
const out={
  'Dialog.html':dialog.replace(marker,()=>banner+solver.replace(/\nif\(typeof module[^\n]*\n?$/,'\n')),
  'Code.gs':banner+code,
  'appsscript.json':manifest
};
if(out['Dialog.html'].includes('</script'+'>')===false)throw new Error('script 終端がない');
if(solver.includes('</script'))throw new Error('solver.js に </script が含まれている');
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

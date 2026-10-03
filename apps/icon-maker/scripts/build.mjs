import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const sharedDir=new URL('../../shared/ui/',root);
// /* @include 名 */ を shared/ui から展開する（中立トークン base.css 用）。
// このツールは color-scheme:light 固定なので @dark{} は展開せず除去する。
const expandIncludes=text=>text.replace(/^[ \t]*\/\* @include ([\w.\-]+) \*\/[ \t]*$/gm,
  (m,name)=>{
    let css=readFileSync(new URL(name,sharedDir),'utf8').replace(/\s+$/,'');
    if(css.includes('@include'))throw new Error(`${name} に未展開の @include があります`);
    return css.replace(/^@dark\{\n[\s\S]*?^\}\n?/gm,'');
  });
const output=new URL('dist/',root);
await mkdir(output,{recursive:true});
const [index,app,sprite,tags,people,peopleTags,manifest]=await Promise.all([
  readFile(new URL('src/Index.html',root),'utf8'),
  readFile(new URL('src/JavaScript.html',root),'utf8'),
  readFile(new URL('src/assets/LucideSprite.html',root),'utf8'),
  readFile(new URL('src/assets/LucideTags.html',root),'utf8'),
  readFile(new URL('src/assets/TablerPeople.html',root),'utf8'),
  readFile(new URL('src/assets/TablerPeopleTags.html',root),'utf8'),
  readFile(new URL('src/appsscript.json',root),'utf8')
]);
if(sprite.includes('<?xml')||people.includes('<?xml'))throw new Error('SVGスプライトにXML宣言が含まれています');
const inline=expandIncludes(index)
  .replace("<?!= include('LucideTags'); ?>",tags)
  .replace("<?!= include('LucideSprite'); ?>",sprite)
  .replace("<?!= include('TablerPeopleTags'); ?>",peopleTags)
  .replace("<?!= include('TablerPeople'); ?>",people)
  .replace("<?!= include('JavaScript'); ?>",app);
if(inline.includes('<?!='))throw new Error('未展開のGASテンプレートがあります');
if(inline.includes('@include'))throw new Error('未展開の @include があります');
const code=`function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('アイコンメーカー')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
`;
await Promise.all([
  writeFile(new URL('Code.gs',output),code),
  writeFile(new URL('Index.html',output),inline),
  writeFile(new URL('appsscript.json',output),manifest)
]);
console.log('dist/ を更新しました');

import {mkdir,readFile,writeFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const output=new URL('dist/',root);
await mkdir(output,{recursive:true});
const [index,app,sprite,tags,manifest]=await Promise.all([
  readFile(new URL('src/Index.html',root),'utf8'),
  readFile(new URL('src/JavaScript.html',root),'utf8'),
  readFile(new URL('src/assets/LucideSprite.html',root),'utf8'),
  readFile(new URL('src/assets/LucideTags.html',root),'utf8'),
  readFile(new URL('src/appsscript.json',root),'utf8')
]);
if(sprite.includes('<?xml'))throw new Error('LucideSprite.htmlにXML宣言が含まれています');
const inline=index
  .replace("<?!= include('LucideTags'); ?>",tags)
  .replace("<?!= include('LucideSprite'); ?>",sprite)
  .replace("<?!= include('JavaScript'); ?>",app);
if(inline.includes('<?!='))throw new Error('未展開のGASテンプレートがあります');
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

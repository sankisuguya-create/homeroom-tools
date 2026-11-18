// 画面のテスト（Playwright）。 node apps/group-maker/tests/ui.test.mjs
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'Index.html');
let chromium;
try { const r = createRequire(import.meta.url); let m; try { m = r('playwright'); } catch { m = r(path.join(execSync('npm root -g').toString().trim(), 'playwright')); } chromium = m.chromium; }
catch { console.log('Playwright が無いので飛ばします'); process.exit(0); }
const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'NG   ') + m); if (!c) fails++; };
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + DIST);
ok(await p.locator('#dSet').evaluate(d => d.open), '名簿が無い時は設定が開いている');
ok(/名簿がありません/.test(await p.textContent('#pv')), '見本に「名簿がありません」');

const SEI = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '清水', '山崎', '森', '池田', '橋本', '阿部', '石川', '山下', '中島', '石井', '小川', '前田', '岡田', '長谷川', '藤田', '後藤', '近藤'];
const MEI = ['健太', '美咲', '翔', '陽菜', '蓮', '結衣', '大翔', '葵', '悠真', '凛'];
const tsv = '出席番号\t氏名\n' + SEI.map((s, i) => `${i + 1}\t${s} ${MEI[i % 10]}`).join('\n');
await p.fill('#pasteBox', tsv);
ok(/35人を読みました/.test(await p.textContent('#pasteResult')), '貼った名簿を読む');
await p.click('#pasteOk');
const groupCount = () => p.locator('#pv .gv-box').count();
ok(await groupCount() === 8, `4人組で8組（35人）：${await groupCount()}`);
ok(/5人×3組・4人×5組/.test(await p.textContent('#sizesNote')), '人数の内訳');
const names = async () => p.$$eval('#pv .gv-box', bs => bs.map(b => [...b.querySelectorAll('.gv-names span')].map(s => s.textContent)));
const a = JSON.stringify(await names()); await p.click('#shuffle'); const b = JSON.stringify(await names());
ok(a !== b, 'ボタンで組み直す');
await p.click('#back'); ok(JSON.stringify(await names()) === a, '前の案に戻す');
await p.keyboard.press('Space'); ok(JSON.stringify(await names()) !== a, 'スペースキーで組み直す');

// どの人数・名前の出し方でも、枠からはみ出さない
const overflow = () => p.$$eval('#pv .gv-box', bs => bs.filter(b => b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1).length);
let worst = 0, minFont = 999;
for (const mode of ['no', 'sei', 'full']) {
  await p.click(`#segMode [data-v=${mode}]`);
  for (let k = 2; k <= 30; k++) {
    await p.evaluate(k => { window.__gm.S.size = k; window.__gm.shuffle(); }, k);
    worst = Math.max(worst, await overflow());
    minFont = Math.min(minFont, await p.$eval('#pv .gv-names', e => parseFloat(e.style.fontSize)));
  }
}
ok(worst === 0, 'はみ出す枠なし（2〜30人組 × 3つの出し方）');
console.log('     見本（幅 ' + (await p.$eval('#pv', e => e.clientWidth)) + 'px）での最小の文字 ' + minFont + 'px');
await p.click('#segMode [data-v=sei]');
await p.click('#segSize [data-v="4"]');
ok(await p.locator('#pv .gv-head').count() === 8, '班の名前を出す');
await p.click('#swHead'); ok(await p.locator('#pv .gv-head').count() === 0, '班の名前を出さない');
await p.click('#swHead');

// 欠席
await p.click('#dAbsent summary');
await p.click('#absentList button >> nth=0');
ok((await names()).flat().length === 34 && !(await names()).flat().includes('佐藤'), '欠席の児童を外す');
ok(/欠席1人/.test(await p.textContent('#headcount')), '欠席の人数');

// 離す組合せ
await p.selectOption('#apartA', { index: 2 }); await p.selectOption('#apartB', { index: 3 });
await p.click('#apartAdd');
ok(await p.locator('#apartList > div').count() === 1, '離す組合せを足す');
let together = 0;
for (let i = 0; i < 30; i++) { await p.click('#shuffle'); if ((await names()).some(g => g.includes('鈴木') && g.includes('高橋'))) together++; }
ok(together === 0, '離す2人は同じ組にならない（30回）');

// 読み込み直しても続き
const before = JSON.stringify(await names());
await p.reload();
ok(JSON.stringify(await names()) === before, '読み込み直しても同じ案');

// モニター
const [mon] = await Promise.all([p.waitForEvent('popup'), p.click('#goMonitor')]);
await mon.setViewportSize({ width: 1920, height: 1080 });
await mon.waitForTimeout(200);
ok(await mon.locator('.gv-box').count() === 8, 'モニターの窓に同じ組');
await p.click('#shuffle'); await mon.waitForTimeout(100);
ok(JSON.stringify(await mon.$$eval('.gv-box', bs => bs.map(b => b.textContent))) === JSON.stringify(await p.$$eval('#pv .gv-box', bs => bs.map(b => b.textContent))), '組み直すとモニターも変わる');
ok(/モニターに出しています/.test(await p.textContent('#stageText')), '出している表示');
console.log('     モニター（1920×1080）の文字 ' + (await mon.$eval('.gv-names', e => e.style.fontSize)));
if (process.env.SHOT) { await mon.screenshot({ path: process.env.SHOT + '/monitor.png' }); await p.screenshot({ path: process.env.SHOT + '/panel.png' }); }
ok(errs.length === 0, 'エラーなし ' + errs.join(' / '));
await browser.close();
process.exit(fails ? 1 : 0);

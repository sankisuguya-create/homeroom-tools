// 画面の確かめ（Playwright）。dist/Index.html を開き、主な流れを操作する。
//   node apps/class-split/tests/ui.test.mjs
// Playwright が無い環境では何もせずに終わる。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'Index.html');
let chromium;
try {
  const req = createRequire(import.meta.url);
  let mod;
  try { mod = req('playwright'); } catch { mod = req(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
  chromium = mod.chromium;
} catch { console.log('Playwright が無いので画面の確かめを飛ばします'); process.exit(0); }

const exe = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
const browser = await chromium.launch(exe);
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'NG   ') + m); if (!c) fails++; };

for (const [w, h] of [[1366, 768], [1920, 1080]]) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST);
  await p.waitForSelector('.gbtn');
  ok(await p.locator('.gbtn').count() === 6, `${w}x${h} メニューに6学年`);

  // クラス分け：全員が1画面に収まる
  await p.click('[data-go="split"]');
  await p.waitForSelector('.board .chip');
  const fit = await p.evaluate(() => {
    const ch = [...document.querySelectorAll('.board .chip')];
    return { n: ch.length, vis: ch.filter(c => { const r = c.getBoundingClientRect(); return r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5; }).length };
  });
  ok(fit.n > 0 && fit.vis === fit.n, `${w}x${h} 全員（${fit.n}人）が1画面に収まる（見えている ${fit.vis}人）`);

  // 案を作る：G → Enter で前回の設定のまま作る。名前に方針が付く
  const before = await p.locator('.tab[data-p]').count();
  await p.keyboard.press('g'); await p.waitForSelector('.dlg.gen');
  await p.click('[data-w="k4"][data-lv="3"]');
  await p.keyboard.press('Enter');
  await p.waitForFunction(n => document.querySelectorAll('.tab[data-p]').length === n + 1, before);
  const name = await p.locator('.tab[data-p]').last().textContent();
  ok(/保の分散重視/.test(name), `${w}x${h} 案の名前に方針が付く：${name.trim().slice(0, 30)}`);

  // 入れ替え：2人を選ぶと確認の枠、Enterで実行、Ctrl+Zで戻る
  const pair = await p.evaluate(() => {
    const S = App.screens.split.state(), asg = S.plans[S.active].asg;
    const a = [...asg.keys()].find(i => Engine.nearGroup(S.ctx, asg, i).length === 1 && !S.ctx.relOf[i].length);
    const b = [...asg.keys()].find(i => asg[i] !== asg[a] && Engine.nearGroup(S.ctx, asg, i).length === 1 && !S.ctx.relOf[i].length);
    return [a, b, asg[a], asg[b]];
  });
  await p.click(`.board .chip[data-i="${pair[0]}"]`);
  await p.click(`.board .chip[data-i="${pair[1]}"]`);
  ok(await p.locator('.dlg h2', { hasText: '入れ替えますか？' }).count() === 1, `${w}x${h} 入れ替えの確認の枠`);
  await p.keyboard.press('Enter');
  const swapped = await p.evaluate(([a, b]) => { const S = App.screens.split.state(), q = S.plans[S.active].asg; return [q[a], q[b]]; }, pair);
  ok(swapped[0] === pair[3] && swapped[1] === pair[2], `${w}x${h} 入れ替わった`);
  await p.keyboard.press('Control+z');
  const back = await p.evaluate(([a]) => { const S = App.screens.split.state(); return S.plans[S.active].asg[a]; }, pair);
  ok(back === pair[2], `${w}x${h} Ctrl+Z で戻る`);

  // 比較タブ
  await p.keyboard.press('0');
  ok(await p.locator('table.cmp').count() === 1, `${w}x${h} 比較の表`);

  // 名簿：年度タブ・児童の経年の記録
  await p.click('[data-go="menu"]'); await p.waitForSelector('.gbtn');
  await p.click('[data-go="roster"]'); await p.waitForSelector('table.r');
  ok(await p.locator('.rbar .tab[data-fy]').count() === 6, `${w}x${h} 6年は6年度分の名簿`);
  await p.locator('td.nm').first().click();
  ok(await p.locator('table.h tbody tr').count() === 6, `${w}x${h} 経年の記録が6行`);
  const cell = p.locator('td.cell').first();
  const v0 = await cell.innerHTML();
  await cell.click();
  ok((await p.locator('td.cell').first().innerHTML()) !== v0, `${w}x${h} 配慮項目のマスを押すと値が変わる`);
  await p.waitForFunction(() => document.getElementById('save').textContent === '保存済み');
  ok(true, `${w}x${h} 保存済みと表示`);

  ok(errs.length === 0, `${w}x${h} 画面のエラーなし ${errs.join(' / ')}`);
  await p.close();
}

// 上限（5年＝4学級×36人＝144人）でも1366x768に収まる
{
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="5"]'); await p.click('[data-go="split"]'); await p.waitForSelector('.board .chip');
  const r = await p.evaluate(() => { const ch = [...document.querySelectorAll('.board .chip')]; return [ch.length, ch.filter(c => c.getBoundingClientRect().bottom <= innerHeight + .5).length]; });
  ok(r[0] === 144 && r[1] === 144, `144人がすべて1画面に収まる（${r[1]}/${r[0]}）`);
  if (process.env.SHOT_DIR) await p.screenshot({ path: process.env.SHOT_DIR + '/split144.png' });
  await p.close();
}

// 決定と取り消し（4年）
{
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="4"]'); await p.click('[data-go="split"]'); await p.waitForSelector('.board .chip');
  await p.click('#decide');
  await p.fill('#cword', '4年のクラス替えを決定'); await p.click('[data-act="ok"]');
  await p.waitForSelector('.decided');
  ok(true, '決定すると決定済みの表示');
  await p.click('[data-go="menu"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('table.r');
  ok(await p.locator('.tab[data-fy]', { hasText: '準備中' }).count() === 1, '名簿に準備中の年度が出る');
  await p.locator('.tab[data-fy]', { hasText: '今年度' }).click();
  ok(await p.locator('table.r.ro').count() === 1, '決定後の今年度は凍結（見るだけ）');
  await p.click('[data-go="menu"]'); await p.click('[data-go="split"]'); await p.waitForSelector('.decided');
  await p.click('#undoDecide'); await p.fill('#cword', '4年の決定を取り消す'); await p.click('[data-act="ok"]');
  await p.waitForSelector('#gen');
  ok(true, '決定を取り消せる');
  await p.close();
}
await browser.close();
console.log(fails ? `\n${fails}件 NG` : '\nすべて ok');
process.exit(fails ? 1 : 0);

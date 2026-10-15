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
  await p.click('[data-g="6"]');
  ok(await p.locator('[data-go="split"]').count() === 0, `${w}x${h} 6年を選ぶと「クラス分けをする」が出ない`);
  await p.click('[data-g="4"]');

  // クラス分け：全員が1画面に収まる
  await p.click('[data-go="split"]');
  await p.waitForSelector('.board .chip');
  const fit = await p.evaluate(() => {
    const ch = [...document.querySelectorAll('.board .chip')];
    return { n: ch.length, vis: ch.filter(c => { const r = c.getBoundingClientRect(); return r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5; }).length };
  });
  ok(fit.n > 0 && fit.vis === fit.n, `${w}x${h} 全員（${fit.n}人）が1画面に収まる（見えている ${fit.vis}人）`);

  // 字形：中国語のフォントで描かれた文字が無いこと（端末に入っている日本語フォントが使われる）
  {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const sel = ['.tab', '.head', '.board .chip .nm', '.legend', '.bar .btn', '.bs .b em'];
    const used = new Set();
    for (const q of sel) {
      const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: q });
      for (const id of nodeIds.slice(0, 20)) {
        const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id });
        fonts.forEach(f => used.add(f.familyName));
      }
    }
    const zh = [...used].filter(f => /WenQuanYi|Zen Hei|SimSun|SimHei|YaHei|PingFang|Heiti|CJK (SC|TC|HK|KR)|Sans (SC|TC)|Unifont|Droid Sans Fallback/i.test(f));
    ok(zh.length === 0, `${w}x${h} 中国語のフォントを使っていない（使用：${[...used].join('、')}）`);
  }

  // 軽さ：児童を選ぶ操作は盤面を作り直さない（選択の印だけ書き換える）
  const selMs = await p.evaluate(async () => {
    const before = document.querySelector('.board .chip'), t0 = performance.now();
    before.click();
    await new Promise(r => requestAnimationFrame(() => setTimeout(r)));
    const same = document.querySelector('.board .chip') === before;
    before.click();
    return same ? performance.now() - t0 : -1;
  });
  ok(selMs >= 0 && selMs < 100, `${w}x${h} 選ぶ操作は盤面を作り直さず ${Math.round(selMs)}ms`);

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
  await p.click('[data-go="menu"]:visible'); await p.waitForSelector('.gbtn');
  await p.click('[data-g="6"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('table.r');
  ok(await p.locator('#main .rbar').count() === 1 && await p.locator('#main .rbar .tab[data-fy], main #paste, main .chk').count() === 0, `${w}x${h} 上の帯は組・学年と「その他…」だけ`);
  await p.click('#rmore');
  ok(await p.locator('.dlg.more .tab[data-fy]').count() === 6, `${w}x${h} 6年は6年度分の名簿（その他の窓）`);
  await p.check('.dlg.more #onlyInc');
  ok(await p.locator('.dlg.more #onlyInc').isChecked() && await p.locator('#main .state', { hasText: '事案のある児童だけ' }).count() === 1, `${w}x${h} 絞り込むと帯に状態が出る`);
  await p.keyboard.press('Escape'); await p.click('#unfilter');
  ok(await p.locator('#main .state').count() === 0, `${w}x${h} 解除で状態が消える`);
  await p.click('#rmore'); await p.click('.dlg.more #rorder');
  await p.click('[data-ord="0:female"]'); await p.click('[data-ord="1:kana"]'); await p.keyboard.press('Enter');
  const sx = await p.locator('td.nm .sx').allTextContents(), fN = sx.filter(x => x === '女').length;
  ok(sx.slice(0, fN).every(x => x === '女') && fN > 0 && fN < sx.length, `${w}x${h} 並び順（女が先）が名簿に効く`);
  ok(await p.locator('#main .state', { hasText: '並び順' }).count() === 1, `${w}x${h} 並び順を変えると帯に出る`);
  await p.click('#unorder');
  ok(await p.locator('#main .state').count() === 0 && (await p.locator('td.nm').first().evaluate(e => e.closest('tr').cells[0].textContent)) === '1', `${w}x${h} 戻すで番号順`);
  await p.click('#rmore'); await p.locator('.dlg.more .tab[data-fy]').last().click();
  ok(await p.locator('.dlg.more').count() === 0 && await p.locator('#main .state', { hasText: '見るだけ' }).count() === 1 && await p.locator('table.r.ro').count() === 1, `${w}x${h} 過去の年度を選ぶと窓が閉じ、帯に「見るだけ」が出る`);
  await p.locator('#main .state .btn').click();
  ok(await p.locator('table.r.ro').count() === 0, `${w}x${h} 戻るで編集できる年度に戻る`);
  await p.locator('td.nm').first().click();
  ok(await p.locator('.kidpop table.h tbody tr').count() === 6, `${w}x${h} 名前を押すと窓が開き、経年の記録が6行`);
  await p.keyboard.press('Escape');
  ok(await p.locator('.kidpop').count() === 0, `${w}x${h} Escで窓を閉じる`);
  const cell = p.locator('td.cell').first();
  const v0 = await cell.innerHTML();
  await cell.click();
  ok((await p.locator('td.cell').first().innerHTML()) !== v0, `${w}x${h} 配慮項目のマスを押すと値が変わる`);
  await p.waitForFunction(() => document.getElementById('save').textContent === '保存済み');
  ok(true, `${w}x${h} 保存済みと表示`);

  // ＋のアイコンにしても行の高さ・列の幅が変わらない
  const k1 = p.locator('td.cell[data-k="k1"]').nth(2);
  const box = async () => p.evaluate(() => { const t = document.querySelector('table.r'); return [t.getBoundingClientRect().width, t.querySelector('tbody tr:nth-child(3)').getBoundingClientRect().height]; });
  const b0 = await box(), seen = new Set();
  for (let n = 0; n < 3; n++) { await p.locator('td.cell[data-k="k1"]').nth(2).click(); seen.add(await p.locator('td.cell[data-k="k1"]').nth(2).locator('.b').getAttribute('data-lv').catch(() => null)); const b = await box(); ok(Math.abs(b[0] - b0[0]) < .5 && Math.abs(b[1] - b0[1]) < .5, `${w}x${h} 程度${n + 1}回目でも表の幅・行の高さが同じ（${b} / ${b0}）`); }
  ok(seen.has('2'), `${w}x${h} ＋のアイコンを通った`);
  ok((await p.locator('th.spc').boundingBox()).width < 45, `${w}x${h} 特支の列は細い`);

  // 名簿からつける・離すを足す
  const first = await p.locator('td.nm').first().getAttribute('data-kid');
  const corner = async loc => { const q = await loc.boundingBox(); await p.mouse.click(q.x + q.width - 4, q.y + q.height - 4); };
  await corner(p.locator('td.pr').first());
  ok(await p.locator('.dlg[aria-label="つける・離す"] [data-padd="far"]').count() === 1, `${w}x${h} つける・離すの枠を押すと、その児童の窓が開く`);
  await p.click('[data-padd="far"]');
  await p.fill('#pq', await p.locator('td.nm').nth(1).evaluate(e => e.lastChild.textContent.slice(0, 2)));
  await p.locator('[data-pfb]:not([data-pfb=""])').first().click();
  await p.fill('#pmemo2', '休み時間に言い合いが続く');
  await p.click('[data-ptag="担任判断"]');
  const np = await p.evaluate(() => App.st.data.pairs.length);
  await p.click('[data-psave]');
  await p.waitForFunction(n => App.st.data.pairs.length > n, np);
  ok(await p.evaluate(id => App.st.data.pairs.some(q => q.a === id && q.memo === '休み時間に言い合いが続く' && q.tags.indexOf('担任判断') >= 0 && q.since === App.st.data.grade), first), `${w}x${h} 経緯・理由・何年生からが付いて保存される`);
  ok(await p.locator('.dlg [data-popen]').count() >= 1, `${w}x${h} 窓に相手のカードが出る`);
  await p.locator('.dlg [data-popen]').last().click();
  ok((await p.locator('.dlg .pdet').innerText()).indexOf('休み時間に言い合いが続く') >= 0, `${w}x${h} カードを押すと経緯が出る`);
  await p.keyboard.press('Escape');
  ok(await p.locator(`td.pr .prm`).count() >= 2, `${w}x${h} 表に印が出る`);

  // 備考
  await p.locator('td.memo').first().click();
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'mtx'), `${w}x${h} 備考の欄を押すと窓が開き、すぐ書ける`);
  await p.selectOption('[data-mpick="1"]', '優しい');
  ok((await p.inputValue('#mtx')).indexOf('優しい') >= 0, `${w}x${h} 定型の言葉を選ぶと入る`);
  await p.fill('#mtx', '');
  await p.fill('#mtx', '給食当番は前半'); await p.keyboard.press('Control+Enter');
  await p.waitForFunction(() => document.getElementById('save').textContent === '保存済み');
  ok((await p.locator('td.memo').first().textContent()) === '給食当番は前半', `${w}x${h} 備考を書ける`);

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

// 設定：項目の名前と頭文字を変えると画面に反映。年度替わりで卒業生を消す
{
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-go="settings"]'); await p.waitForSelector('[data-al="k1"]');
  await p.fill('[data-al="k1"]', '学習の支援'); await p.fill('[data-as="k1"]', '援');
  await p.click('#ssave');
  await p.waitForFunction(() => /設定を保存/.test(document.getElementById('toast').textContent));
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="split"]'); await p.waitForSelector('.legend');
  ok((await p.locator('.legend').textContent()).includes('学習の支援'), '設定した項目の名前が凡例に出る');
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="settings"]'); await p.waitForSelector('[data-stab="year"]');
  await p.click('[data-stab="year"]'); await p.waitForSelector('#purge');
  const n = await p.locator('[data-pp]').count();
  ok(n === 25, `卒業・転出の候補（卒業24人＋転出1人）：${n}人`);
  ok(await p.locator('#purge[disabled]').count() === 1, '初めは誰も選ばれていない');
  await p.check('#pall');
  await p.click('#purge'); await p.fill('#cword', n + '人の記録を消す'); await p.click('[data-act="ok"]');
  await p.waitForSelector('.empty:has-text("候補はありません")');
  ok(true, '消すと候補が無くなる');
  ok(errs.length === 0, '設定の画面のエラーなし ' + errs.join(' / '));
  await p.close();
}

// 決定と取り消し（4年）
{
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="4"]'); await p.click('[data-go="split"]'); await p.waitForSelector('.board .chip');
  await p.click('#smore'); await p.click('#decide');
  await p.fill('#cword', '4年のクラス替えを決定'); await p.click('[data-act="ok"]');
  await p.waitForSelector('.decided');
  ok(true, '決定すると決定済みの表示');
  ok(await p.locator('.decided', { hasText: 'A組＝1組' }).count() === 1 && await p.locator('.decided', { hasText: '（仮）' }).count() === 1, '決定の直後は組の番号が仮');
  await p.click('#cnames'); await p.click('[data-cn="0:2"]'); await p.keyboard.press('Enter');
  await p.waitForSelector('.decided:has-text("A組＝2組")');
  ok(await p.locator('.decided', { hasText: 'B組＝1組' }).count() === 1 && await p.locator('.decided', { hasText: '（仮）' }).count() === 0, '組の番号を決めると入れ替わり、仮が外れる');
  ok(await p.locator('.ncl').first().textContent() === 'A組', 'クラス分けの枠は A組…');
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="roster"]'); await p.waitForSelector('table.r');
  await p.click('#rmore');
  ok(await p.locator('.tab[data-fy]', { hasText: '準備中' }).count() === 1, '名簿に準備中の年度が出る');
  await p.locator('.tab[data-fy]', { hasText: '今年度' }).click();
  ok(await p.locator('table.r.ro').count() === 1, '決定後の今年度は凍結（見るだけ）');
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="split"]'); await p.waitForSelector('.decided');
  await p.click('#undoDecide'); await p.fill('#cword', '4年の決定を取り消す'); await p.click('[data-act="ok"]');
  await p.waitForSelector('#gen');
  ok(true, '決定を取り消せる');
  await p.close();
}
await browser.close();
console.log(fails ? `\n${fails}件 NG` : '\nすべて ok');
process.exit(fails ? 1 : 0);

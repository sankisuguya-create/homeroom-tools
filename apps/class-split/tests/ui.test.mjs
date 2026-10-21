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
const C_STEP1 = '管理職に報告した。';
const ok = (c, m) => { console.log((c ? 'ok   ' : 'NG   ') + m); if (!c) fails++; };
// クラス分けに入る：案がまだ無ければ、設定の窓で作り、並べる動きを飛ばす
const intoSplit = async (p) => {
  await p.waitForSelector('.board .chip, #okbtn');
  if (await p.locator('#okbtn').count()) { await p.click('#okbtn'); await p.waitForSelector('.board .chip'); }
};

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
  await intoSplit(p);
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
  ok(await p.locator('#main .rbar').count() === 1 && await p.locator('#main .rbar .tab[data-fy], main #paste, main .chk').count() === 0, `${w}x${h} 上の帯は組・学年と「名簿を貼る」「その他…」だけ`);
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
  ok(await p.locator('.kidpop table.h th.hm').count() === 1, `${w}x${h} 経年の記録に備考の列`);
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
  const pq = await p.$('#pq'); await p.keyboard.type('あ');
  ok(await pq.evaluate(e => e.isConnected && document.activeElement === e), `${w}x${h} 相手の検索欄は打つたびに作り直さない（日本語入力が切れない）`);
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
  await p.click('[data-g="5"]'); await p.click('[data-go="split"]'); await intoSplit(p);
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
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="split"]'); await intoSplit(p);
  ok((await p.locator('.legend').textContent()).includes('学習の支援'), '設定した項目の名前が凡例に出る');
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="settings"]'); await p.waitForSelector('[data-stab="year"]');
  await p.click('[data-stab="year"]'); await p.waitForSelector('.empty:has-text("候補はありません")');
  ok(await p.locator('[data-keep="5"][aria-pressed="true"]').count() === 1, '残す年数の既定は5年度（昨年度の卒業生は候補に出ない）');
  await p.click('[data-keep="0"]'); await p.waitForSelector('#purge');
  const n = await p.locator('[data-pp]').count();
  const incN = await p.locator('tbody tr').evaluateAll(rs => rs.filter(r => r.cells[5] && r.cells[5].textContent.trim()).length);
  ok(n > 0 && n < 25 && incN === 0, `残さないにしても、事案に関わった児童は候補に出ない：${n}人（全25人）`);
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
  await p.click('[data-g="4"]'); await p.click('[data-go="split"]'); await intoSplit(p);
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
  // 事案管理：登録（発覚・経緯・指導の行、いじめの報告書の項目）→ 追記 → 出力のコピー用の表
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="incidents"]'); await p.waitForSelector('.iwrap');
  const n0 = await p.locator('.icard').count();
  ok(n0 > 0 && await p.locator('.ilist').count() === 0 && await p.locator('.iassist').count() === 0 && await p.locator('#iadd2nd').count() === 1 && await p.locator('#iq').count() === 1, '初めの画面は新規作成・検索と事案カードだけ（左右の欄は出さない）');
  await p.fill('#iq', 'いじめ');
  ok(await p.locator('.icard').count() < n0 && await p.locator('.icard .itg', { hasText: 'いじめ' }).count() > 0, '検索でカードが絞られ、種別のタグにいじめが出る');
  await p.fill('#iq', '');
  await p.click('#ihset'); await p.click('[data-hga]'); await p.waitForFunction(n => document.querySelectorAll('.icard').length > n, n0);
  ok(/全学年/.test(await p.textContent('#inote')), '事案の検索の設定で全学年にすると、ほかの学年の事案も出る');
  await p.click('[data-hgr]');
  await p.click('[data-hf="status:open"]');
  ok(await p.locator('.icard').count() > 0 && await p.locator('.icard:not(.ic-open)').count() === 0, '対応の状況で絞れ、カードの枠は状況の色');
  await p.click('[data-hf="status:open"]'); await p.click('[data-hf="levels:f2"]');
  ok(await p.locator('.icard .ib2').count() === await p.locator('.icard').count(), 'いじめの段階を選ぶと、いじめの事案だけに絞る');
  await p.click('[data-hgr]'); await p.keyboard.press('Escape');
  await p.selectOption('#isort', 'imp');
  ok(await p.locator('.icard').first().evaluate(e => e.classList.contains('ic-open')), '重要度で並べると対応中が先');
  ok(await p.locator('.icard em.rc').count() > 0, '加・被の1字を名前の前に出す');
  await p.selectOption('#isort', 'new');
  ok(await p.locator('.icard').count() === n0, 'この学年だけに戻せる');
  await p.click('#iadd2nd');
  ok(await p.locator('.ilist .icard').count() === n0 && await p.locator('.iassist').count() === 1, '作る時は左に事案カードを1列、右に記入補助');
  await p.fill('#fQ', 'さ'); await p.click('#fSugg [data-pick]');
  await p.click('[data-ty="いじめ"]'); await p.waitForSelector('#fFound');
  await p.selectOption('#fFound', { index: 1 }); await p.check('[data-mode="1"]');
  await p.click('#rw-s1-hk-0'); { const bb = await p.locator('#rw-s1-kk-0').boundingBox(); await p.mouse.click(bb.x + 20, bb.y + 10); }
  ok(await p.evaluate(() => document.activeElement.id) === 'rw-s1-kk-0' && await p.inputValue('#rw-s1-hk-0') === '', '発覚の次に経緯の欄を押すと経緯に入れる（発覚の欄に文が入らない）');
  await p.fill('#rw-s1-kk-0', '');
  await p.fill('#rw-s1-hk-0', '訴えがあった'); await p.selectOption('[data-rw="s1:hk:0:p"]', '朝休み');
  await p.selectOption('[data-rw="s1:kk:0:p"]', '1校時後');
  await p.click('#rw-s1-kk-0'); await p.keyboard.type('悪口'); await p.keyboard.press('Enter');
  ok(await p.locator('[data-rw^="s1:kk:"][data-rw$=":t"]').count() === 1 && (await p.inputValue('#rw-s1-kk-0')).includes('\n'), 'Enter は欄の中で改行');
  await p.keyboard.press('Backspace'); await p.keyboard.press('ArrowDown');
  ok(await p.evaluate(() => document.activeElement.id) === 'rw-s1-sd-0' && await p.locator('[data-rw^="s1:kk:"][data-rw$=":t"]').count() === 1, '最後の行で↓を押すと次の欄へ移る（欄は作らない）');
  await p.keyboard.press('ArrowUp');
  ok(await p.evaluate(() => document.activeElement.id) === 'rw-s1-kk-0', '最初の行で↑を押すと前の欄へ戻る');
  await p.keyboard.press('Shift+Enter');
  ok(await p.locator('[data-rw^="s1:kk:"][data-rw$=":t"]').count() === 2, 'Shift+Enter で次の行ができる');
  ok(await p.inputValue('[data-rw="s1:kk:1:p"]') === '2校時', '足した行は、直前の行の次の時間帯になる');
  const kkd = await p.inputValue('[data-rw="s1:kk:1:d"]');
  await p.click('[data-rnext="s1:kk:1:day"]');
  ok(await p.locator('[data-rw^="s1:kk:"][data-rw$=":t"]').count() === 3 && await p.inputValue('[data-rw="s1:kk:2:d"]') > kkd, '日付の下のボタンで翌日の行ができる');
  await p.click('[data-rnext="s1:kk:0:slot"]');
  ok(await p.inputValue('[data-rw="s1:kk:1:p"]') === '2校時', '時間帯の下のボタンで同じ日の次の時間帯の行ができる');
  await p.click('[data-rdel="s1:kk:1"]'); await p.click('[data-rdel="s1:kk:2"]');
  await p.check('[data-step="1"]');
  ok(await p.inputValue('#rw-s1-sd-0') === C_STEP1, '指導の手順のチェックで行に文が入る');
  await p.check('[data-step="0"]');
  ok(await p.locator('[data-rw^="s1:sd:"][data-rw$=":t"]').count() === 1 && (await p.inputValue('#rw-s1-sd-0')).startsWith(C_STEP1), '2つ目の手順も同じ行の続きに入り、新しい行には進まない');
  await p.click('#incForm button.primary');
  ok(await p.locator('#toast', { hasText: '保護者への連絡' }).count() === 1, '保護者への連絡が無いと一度だけ知らせる');
  await p.click('#incForm button.primary'); await p.waitForSelector('#iadd2');
  await p.click('#ihome'); ok(await p.locator('.icard').count() === n0 + 1, '事案が一覧に足される'); await p.click('.icard');
  await p.click('#iadd2'); await p.fill('#rw-s2-vi-0', '元気に過ごしている'); await p.click('#inc2Form button.primary'); await p.waitForSelector('#iadd2');
  ok(await p.locator('.ipane', { hasText: '元気に過ごしている' }).count() === 1, '様式Ⅱ用の追記が残る');
  await p.click('[data-irep]');
  await p.waitForSelector('[data-irep][aria-pressed="true"]');
  ok(/報告済み/.test(await p.textContent('[data-irep]')), '見る画面で「報告済み」にできる（日付が入る）');
  await p.click('#ihome'); ok(await p.locator('.icard .irp').count() > 0, '報告済みの事案は、カードの右上に印が出る'); await p.locator('.icard').first().click();
  await p.click('[data-iout="f1"]'); await p.waitForSelector('.iout');
  ok(await p.locator('#itmpl').count() === 1, '試行でも様式の Excel を選んで出力できる');
  ok(await p.locator('.icopy td', { hasText: '朝休み、訴えがあった' }).count() === 1 && await p.locator('.icopy td', { hasText: 'H22' }).count() === 1, '様式Ⅰのコピー用の表に時系列と態様の○が出る');
  await p.keyboard.press('Escape');
  // 被害の児童が2人：様式Ⅱ用の追記は児童ごとの欄、Excel は児童の数だけ
  await p.click('#ihome'); await p.click('#iadd2nd'); await p.click('[data-ty="いじめ"]');
  for (const q of ['さ', 'た', 'い']) { await p.fill('#fQ', q); await p.click('#fSugg [data-pick]'); }
  await p.click('[data-dm="arrow"]');
  const dn = p.locator('#fDg .dg-n');
  await dn.nth(0).click(); await dn.nth(1).click(); await dn.nth(0).click(); await dn.nth(2).click();
  await p.click('[data-dtidy]');
  ok(await p.locator('#fDg .dg-gl').count() === 1 && await p.locator('#toast', { hasText: '整えました' }).count() === 1, '「整える」を押すと、矢印の出入りが同じ2人をグループにまとめる');
  await p.click('#tundo'); ok(await p.locator('#fDg .dg-gl').count() === 0, '「戻す」で置いた通りに戻る');
  await p.click('[data-dtidy]');
  await p.fill('#rw-s1-sd-0', '保護者に連絡した'); await p.click('#incForm button.primary'); await p.waitForSelector('#iadd2');
  ok(await p.locator('#vDg .dg-gl').count() === 1, '整えた形で保存される');
  await p.click('#iadd2');
  ok(await p.locator('.isec[data-sec^="s2v:"]').count() === 2, '被害の児童が2人なら、様式Ⅱの「被害児童・保護者の様子」は2つの欄');
  await p.click('#cancelInc');
  await p.click('[data-iout="f2"]'); await p.waitForSelector('.iout');
  ok(await p.locator('#ixls[disabled]').count() === 1, '被害児童を選ぶまで Excel は作れない');
  await p.locator('[data-ivic]').nth(1).check();
  ok(await p.locator('#ixls', { hasText: '1人分' }).count() === 1 && await p.locator('.ivic .note', { hasText: await p.locator('.ivic label').nth(1).innerText().then(s => s.trim()) }).count() === 1, '選んだ児童の分だけ作り、表もその児童の分になる');
  await p.locator('[data-ivic]').nth(0).check();
  ok(await p.locator('#ixls', { hasText: '2人分' }).count() === 1, '2人選べば2つ作る');
  await p.keyboard.press('Escape');
  await p.close();
}
// クラス分けテストの点数：賢いの角の窓から入れると、学年の上位に「賢い」が付く（手動の印・学力しんどさは変わらない）。案は設定してから作る
{
  const p = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="2"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.cell[data-k="k7"]');
  const td = p.locator('td.cell[data-k="k7"]').first(), bb = await td.boundingBox();
  const k1Before = await p.locator('td.cell[data-k="k1"] .mk, td.cell[data-k="k1"] svg').count();
  const autoBefore = await p.locator('td.cell.auto[data-k="k7"]').count();
  await p.mouse.click(bb.x + bb.width - 4, bb.y + bb.height - 4); await p.click('[data-score]'); await p.waitForSelector('.sctab');
  const n = await p.locator('.scin').count();
  await p.fill('#scPaste', Array.from({ length: n }, (_, i) => String(i)).join('\n')); await p.click('[data-scpaste]');
  await p.fill('#scTop', '10'); await p.locator('#scTop').dispatchEvent('input');
  await p.click('.dlg [data-act="ok"]'); await p.waitForFunction(() => !document.querySelector('.sctab'));
  const nAuto = await p.evaluate(() => { const d = App.st.data, y = d.years.filter(y => y.fy === d.fy)[0]; return y.rows.filter(r => r.a.k7s).length; });
  ok(nAuto >= 1 && nAuto <= Math.round(n * 0.1), `点数の上位1割に「賢い」が付く（${nAuto}人／${n}人。手動で付いている児童は数えない）`);
  ok(await p.locator('td.cell[data-k="k1"] .mk, td.cell[data-k="k1"] svg').count() === k1Before, '学力しんどさは点数と連動しない');
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="split"]'); await p.waitForSelector('#okbtn');
  ok(await p.locator('.board .chip').count() === 0 && await p.locator('.ordbox [data-gord^="0:plus"]').count() === 1, '案はいきなり作らず、重み付けと並び順（＋付きが先を含む）の窓を先に出す');
  await p.click('[data-gord="0:plus"]'); await p.click('#okbtn'); await p.waitForSelector('.board .chip');
  ok(await p.locator('.board .chip.plusin').count() > 0, '作るとカードを一度に出し、＋付きのカードを目立たせる');
  ok(await p.locator('#order.ordbtn').count() === 1, '並び順のボタンは上の帯に出る');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 読み込みの失敗：止まらずに理由と「もう一度」を出す。保存の失敗は閉じるまで残る知らせ
{
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.evaluate(() => { const pf = App.pf(), b = pf.boot; let n = 0; pf.boot = g => (n++ ? b.call(pf, g) : Promise.reject(new Error('時間切れ'))); });
  await p.click('[data-go="roster"]'); await p.waitForSelector('#reloadBtn');
  ok(/時間切れ/.test(await p.textContent('#main')), '読み込めない時は理由と「もう一度」を出す');
  await p.click('#reloadBtn'); await p.waitForSelector('td.nm');
  ok(true, '「もう一度」で読み込める');
  await p.evaluate(() => { App.save(() => Promise.reject(Object.assign(new Error('権限がありません'), { noRetry: true }))); });
  await p.waitForSelector('#toast.stay'); await p.waitForTimeout(3800);
  ok(await p.locator('#toast:not([hidden]).stay').count() === 1, '直せない保存の誤りは、時間で消えない');
  await p.click('#tclose'); ok(await p.locator('#toast[hidden]').count() === 1, '×で閉じる');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 名簿：マスの長押しでも、右下の角と同じ窓が開く（値は変えない）
{
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="3"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.cc[data-k="k3"]');
  const td = p.locator('td.cc[data-k="k3"]').first(), before = await td.innerHTML(), bb = await td.boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up();
  ok(await p.locator('#layer .dlg').count() === 1 && await td.innerHTML() === before, 'マスを長押しすると窓が開き、値は変わらない');
  await p.keyboard.press('Escape');
  await p.close();
}
// クラス分け：ホイールでカーソルの所を中心に拡大・縮小。「等倍に戻す」で元へ
{
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="4"]'); await p.click('[data-go="split"]'); await intoSplit(p);
  const chip = p.locator('.board .chip').nth(40), b0 = await chip.boundingBox(), cx = b0.x + b0.width / 2, cy = b0.y + b0.height / 2;
  await p.mouse.move(cx, cy); await p.mouse.wheel(0, -400); await p.waitForTimeout(100);
  const b1 = await chip.boundingBox();
  ok(b1.width > b0.width * 1.5 && Math.abs(b1.x + b1.width / 2 - cx) < 3 && Math.abs(b1.y + b1.height / 2 - cy) < 3, 'ホイールで、カーソルの所を動かさずに拡大する');
  await p.click('#zreset'); const b2 = await chip.boundingBox();
  ok(Math.abs(b2.width - b0.width) < 1 && await p.locator('#zreset').count() === 0, '「等倍に戻す」で元の大きさ');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 名簿を貼る：名簿の上の帯から開き、貼った児童を登録する
{
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="3"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('#paste');
  ok(await p.locator('.bar #paste, #main > div #paste').count() >= 1, '名簿の上の帯に「名簿を貼る」');
  await p.click('#paste'); await p.waitForSelector('#ptxt');
  await p.fill('#ptxt', '組\t番号\t児童ID\t名前\tよみ\t性別\n1\t40\t99990001\t新入 ハナ\tしんにゅう はな\t女');
  await p.click('#okbtn'); await p.waitForFunction(() => /取り込みました/.test(document.getElementById('toast').textContent));
  ok(/追加1人/.test(await p.textContent('#toast')), '貼った児童が名簿に登録される');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
await browser.close();
console.log(fails ? `\n${fails}件 NG` : '\nすべて ok');
process.exit(fails ? 1 : 0);

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
// 名簿のロックは初めはロック中。試験では、ロックの操作を確かめる所以外はロックを外して始める
const newPage = async (o) => { const pg = await browser.newPage(o); await pg.addInitScript(() => { try { if (localStorage.getItem('classSplit.rosterLock') == null) localStorage.setItem('classSplit.rosterLock', '0'); } catch (e) { } }); return pg; };
// 畳んだメニュー（名簿の管理 ▾・その他 ▾）の中の項目は、メニューを開いてから押す
const mclick = async (p, sel) => { const el = p.locator(sel).first(); if (!(await el.isVisible())) { const id = await p.evaluate(s => { const e = document.querySelector(s), dd = e && e.closest('.ddm'); return dd ? dd.querySelector('[data-dd]').dataset.dd : ''; }, sel); if (id) { await p.click('[data-dd="' + id + '"]'); await el.waitFor({ state: 'visible', timeout: 5000 }); } } await el.click(); };
let fails = 0;
const C_STEP1 = '管理職に報告した。';
const ok = (c, m) => { console.log((c ? 'ok   ' : 'NG   ') + m); if (!c) fails++; };
// クラス分けに入る：案がまだ無ければ、設定の窓で作り、並べる動きを飛ばす
const intoSplit = async (p) => {
  await p.waitForSelector('.board .chip, #okbtn');
  if (await p.locator('#okbtn').count()) { await p.click('#okbtn'); await p.waitForSelector('.board .chip'); }
};

for (const [w, h] of [[1366, 768], [1920, 1080]]) {
  const p = await newPage({ viewport: { width: w, height: h } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST);
  await p.waitForSelector('.gbtn');
  ok(await p.locator('.gbtn').count() === 7, `${w}x${h} メニューに新1年と6学年`);
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
  const name = await p.locator('.tab[data-p]').last().getAttribute('title'), lab = (await p.locator('.tab[data-p]').last().textContent()).trim();
  ok(/保の分散重視/.test(name), `${w}x${h} 案の名前に方針が付く（カーソルで出る）：${name.trim().slice(0, 30)}`);
  ok(/^案[A-Z]/.test(lab) && /違反 \d+・偏り△ \d+/.test(name), `${w}x${h} タブは「案A」だけで、違反の数はカーソルで出る：${lab}`);

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
  ok(await p.locator('#main .rbar').count() === 1 && await p.locator('#rmore').count() === 0 && await p.locator('#rfy').count() === 1, `${w}x${h} 「その他」の窓は無く、年度・全校の事案・絞り込みは上の帯`);
  ok(await p.locator('#rfy option').count() === 6, `${w}x${h} 6年は6年度分の名簿（年度の選択）`);
  ok(await p.locator('#onlyIncB').count() === 0 && /^\d{4}$/.test((await p.locator('#rfy option').first().textContent()).trim()), `${w}x${h} 事案で絞るボタンは無く（事案数の見出しで並べる）、年度は「2026」の形`);
  // 見出しを押した順に優先：性別（1回目＝男が先、2回目＝女が先）→ 名前（よみ）
  await p.click('th[data-csort="sex"]'); await p.click('th[data-csort="sex"]'); await p.click('th[data-csort="kana"]');
  const sx = await p.locator('td.sxc .sx').allTextContents(), fN = sx.filter(x => x === '女').length;
  ok(sx.slice(0, fN).every(x => x === '女') && fN > 0 && fN < sx.length, `${w}x${h} 見出しの性別を2回押すと女が先`);
  ok(await p.locator('th[data-csort="sex"] .sa b').textContent() === '1' && await p.locator('th[data-csort="kana"] .sa b').textContent() === '2', `${w}x${h} 押した順に第一・第二の印`);
  ok(await p.locator('#main .state', { hasText: '並び順' }).count() === 1, `${w}x${h} 並び順を変えると帯に出る`);
  await p.click('#unorder');
  ok(await p.locator('#main .state').count() === 0 && (await p.locator('td.nm').first().evaluate(e => e.closest('tr').cells[0].textContent)) === '1', `${w}x${h} 戻すで番号順`);
  { const v = await p.locator('#rfy option').last().getAttribute('value'); await p.selectOption('#rfy', v); }
  ok(await p.locator('#main .state', { hasText: '見るだけ' }).count() === 1 && await p.locator('table.r.ro').count() === 1, `${w}x${h} 過去の年度を選ぶと、帯に「見るだけ」が出る`);
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
  await p.fill('#pq', await p.locator('td.nm').nth(1).evaluate(e => (e.querySelector('.nmt') || e).textContent.slice(0, 2)));
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
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="5"]'); await p.click('[data-go="split"]'); await intoSplit(p);
  // 特別支援学級の児童は盤面の上の別の欄（.spstrip）に並ぶ。両方を合わせて144人
  const r = await p.evaluate(() => { const ch = [...document.querySelectorAll('.board .chip, .spstrip .spk')]; return [ch.length, ch.filter(c => c.getBoundingClientRect().bottom <= innerHeight + .5).length]; });
  ok(r[0] === 144 && r[1] === 144, `144人がすべて1画面に収まる（${r[1]}/${r[0]}）`);
  if (process.env.SHOT_DIR) await p.screenshot({ path: process.env.SHOT_DIR + '/split144.png' });
  await p.close();
}

// 設定：項目の名前と頭文字を変えると画面に反映。年度替わりで卒業生を消す
{
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
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
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="4"]'); await p.click('[data-go="split"]'); await intoSplit(p);
  await p.click('#decide');
  await p.fill('#cword', '4年のクラス替えを決定'); await p.click('[data-act="ok"]');
  await p.waitForSelector('.decided');
  ok(true, '決定すると決定済みの表示');
  { const tt = await p.locator('.decided').getAttribute('title'); ok(tt.includes('A組＝1組') && tt.includes('（仮）'), '決定の直後は組の番号が仮（帯の説明に組の対応）'); }
  {
    const [dl] = await Promise.all([p.waitForEvent('download'), mclick(p, '#xlsOut')]);
    const buf = fs.readFileSync(await dl.path()), txt = buf.toString('utf8');
    ok(buf.slice(0, 2).toString() === 'PK' && txt.includes('生徒管理番号') && txt.includes('仮番号') && txt.includes('>A組<'), '決定した組を Excel（次年度組編成の列）で出せる');
    if (process.env.XLSX_OUT) fs.writeFileSync(process.env.XLSX_OUT, buf);
  }
  await p.click('#cnames'); await p.click('[data-cn="0:2"]'); await p.keyboard.press('Enter');
  await p.waitForSelector('.decided[title*="A組＝2組"]');
  { const tt = await p.locator('.decided').getAttribute('title'); ok(tt.includes('B組＝1組') && !tt.includes('（仮）'), '組の番号を決めると入れ替わり、仮が外れる'); }
  ok(await p.locator('.ncl').first().textContent() === 'A組', 'クラス分けの枠は A組…');
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="roster"]'); await p.waitForSelector('table.r');
  { const fy = await p.evaluate(() => App.st.data.fy); ok(await p.locator('#rfy option[value="' + (fy + 1) + '"]').count() === 1, '名簿に準備中の年度（来年度）が出る'); await p.selectOption('#rfy', String(fy)); }
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
  ok(await p.locator('[data-ty="虞犯"] ruby rt', { hasText: 'ぐはん' }).count() === 1, '事案の種別に「虞犯」（ふりがな付き）');
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
  await p.click('#ihome'); ok(await p.locator('.icard .irbadge').count() > 0, '報告済みの事案は、カードの右上にバッジが出る');
  {
    const cb = await p.locator('.icard:has(.irbadge)').first().boundingBox(), bb = await p.locator('.icard .irbadge').first().boundingBox();
    ok(bb.x + bb.width > cb.x + cb.width && bb.y < cb.y, 'バッジはカードの右上の枠に重なる');
    const all = await p.locator('.icard').count();
    await p.click('#ihset'); await p.click('[data-hf="rep:yes"]'); await p.keyboard.press('Escape');
    const yes = await p.locator('.icard').count();
    ok(yes > 0 && yes === await p.locator('.icard .irbadge').count(), '検索の設定で「報告済み」を選ぶと、バッジのある事案だけ');
    await p.click('#ihset'); await p.click('[data-hf="rep:yes"]'); await p.click('[data-hf="rep:no"]'); await p.keyboard.press('Escape');
    ok(await p.locator('.icard').count() === all - yes && await p.locator('.icard .irbadge').count() === 0, '「未報告」を選ぶと、バッジの無い事案だけ');
    await p.click('#ihset'); await p.click('[data-hgr]'); await p.keyboard.press('Escape');
  } await p.locator('.icard').first().click();
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
  const p = await newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="2"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.cell[data-k="k7"]');
  const td = p.locator('td.cell[data-k="k7"]').first(), bb = await td.boundingBox();
  const k1Before = await p.locator('td.cell[data-k="k1"] .mk, td.cell[data-k="k1"] svg').count();
  const autoBefore = await p.locator('td.cell.auto[data-k="k7"]').count();
  await p.mouse.click(bb.x + bb.width - 4, bb.y + bb.height - 4); await p.click('[data-score]'); await p.waitForSelector('.sctab');
  const n = await p.locator('.scin').count();
  await p.fill('#scPaste', Array.from({ length: n }, (_, i) => String((i * 37) % 101)).join('\n')); await p.click('[data-scpaste]'); // 点数は満点（100）を超えないように
  await p.fill('#scTop', '10'); await p.locator('#scTop').dispatchEvent('input');
  await p.click('.dlg [data-act="ok"]'); await p.waitForFunction(() => !document.querySelector('.sctab'));
  const nAuto = await p.evaluate(() => { const d = App.st.data, y = d.years.filter(y => y.fy === d.fy)[0]; return y.rows.filter(r => r.a.k7s).length; });
  const per = await p.evaluate(() => { const d = App.st.data, y = d.years.filter(y => y.fy === d.fy)[0], g = {}, top = App.topIds(d.scores[d.fy], App.scoreGroup(d, y)); y.rows.forEach(r => { const k = r.cls + (d.kids[r.id].male ? 'm' : 'f'); g[k] = g[k] || { n: 0, t: 0 }; g[k].n++; if (top[r.id]) g[k].t++; }); return Object.values(g); });
  ok(nAuto >= 1 && per.every(x => x.t >= 1 && x.t <= Math.max(1, Math.round(x.n * 0.1)) + 1), `点数の上位1割は、組の中の男女ごとに付く（${per.length}組×男女、点数で付いた${nAuto}人）`);
  ok(await p.locator('td.cell[data-k="k1"] .mk, td.cell[data-k="k1"] svg').count() === k1Before, '学力しんどさは点数と連動しない');
  const tiers = await p.evaluate(() => { const d = App.st.data, y = d.years.filter(y => y.fy === d.fy)[0], c = {}; y.rows.forEach(r => { if (r.a.tier) c[r.a.tier] = (c[r.a.tier] || 0) + 1; }); const P = { kids: y.rows.map(r => ({ id: r.id, male: d.kids[r.id].male, old: r.cls, a: r.a, area: '' })), pairs: [], inc: [], nc: 4 }; return { c, met: Engine.prepare(P, Engine.defaultGen()).MET.filter(m => m.grp === 'acad').length }; });
  ok(tiers.c[1] > 0 && tiers.c[2] > 0 && tiers.c[5] > 0 && tiers.met >= 4, `点数を10％刻みの段に分け、2段から下もクラス分けでそろえる（段ごとの人数 ${JSON.stringify(tiers.c)}・そろえる段 ${tiers.met}）`);
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="split"]'); await p.waitForSelector('#okbtn');
  ok(await p.locator('.board .chip').count() === 0 && await p.locator('.ordbox [data-gord^="0:plus"]').count() === 1, '案はいきなり作らず、重み付けと並び順（＋付きが先を含む）の窓を先に出す');
  await p.click('[data-gord="0:plus"]'); await p.click('#okbtn'); await p.waitForSelector('.board .chip');
  ok(await p.locator('.board .chip.plusin').count() > 0, '作るとカードを一度に出し、＋付きのカードを目立たせる');
  ok(await p.locator('.bar #order').count() === 1, '並び順は上の帯の「その他」にある');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 読み込みの失敗：止まらずに理由と「もう一度」を出す。保存の失敗は閉じるまで残る知らせ
{
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.evaluate(() => { App.saveGen++; /* 先読みした分を使わせない */ const pf = App.pf(), b = pf.boot; let n = 0; pf.boot = g => (n++ ? b.call(pf, g) : Promise.reject(new Error('時間切れ'))); });
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
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
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
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
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
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="3"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('[data-dd="rmenu"]');
  ok(await p.locator('.rbar #paste').count() === 1, '名簿の上の帯の「名簿の管理」に「名簿を貼る」');
  await mclick(p, '#paste'); await p.waitForSelector('#ptxt');
  await p.fill('#ptxt', '組\t番号\t児童ID\t名前\tよみ\t性別\n1\t40\t99990001\t新入 ハナ\tしんにゅう はな\t女');
  await p.click('#okbtn'); await p.waitForSelector('[aria-label="取り込む前の確認"]');
  ok((await p.locator('[aria-label="取り込む前の確認"]').textContent()).includes('追加 1人'), '取り込む前に差分を見せる');
  await p.click('[aria-label="取り込む前の確認"] [data-act="ok"]');
  await p.waitForFunction(() => /取り込みました/.test(document.getElementById('toast').textContent));
  ok(/追加1人/.test(await p.textContent('#toast')), '貼った児童が名簿に登録される');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 学力の順位：数字を打つとその位置へ、名前をドラッグして入れ替え。保存すると順位の上位に「賢い」
{
  const p = await newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="2"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.cell[data-k="k7"]');
  const td = p.locator('td.cell[data-k="k7"]').first(), bb = await td.boundingBox();
  await p.mouse.click(bb.x + bb.width - 4, bb.y + bb.height - 4); await p.click('[data-rank]'); await p.waitForSelector('#rklist');
  const ids = () => p.locator('[data-rk]').evaluateAll(es => es.map(e => e.dataset.rk));
  const n = (await ids()).length, last = (await ids())[n - 1];
  await p.fill('[data-rkn="' + last + '"]', '1'); await p.keyboard.press('Enter');
  ok((await ids())[0] === last, '順位の数字を打つと、その位置へ動く');
  const before = await ids(), h1 = await p.locator('[data-rkh="' + before[1] + '"]').boundingBox(), h0 = await p.locator('[data-rk="' + before[0] + '"]').boundingBox();
  await p.mouse.move(h1.x + 10, h1.y + h1.height / 2); await p.mouse.down(); await p.mouse.move(h1.x + 10, h0.y + 3, { steps: 6 }); await p.mouse.up();
  const after = await ids();
  ok(after[0] === before[1] && after[1] === before[0], '名前をドラッグして入れ替えられる');
  await p.fill('#rkTop', '10'); await p.locator('#rkTop').dispatchEvent('input');
  await p.click('.dlg [data-act="ok"]'); await p.waitForFunction(() => !document.querySelector('#rklist'));
  const res = await p.evaluate(top => { const d = App.st.data, y = d.years.filter(y => y.fy === d.fy)[0], sc = d.scores[d.fy]; return { use: sc.use, first: sc.r[top], auto: y.rows.filter(r => r.a.k7s).map(r => r.id) }; }, after[0]);
  ok(res.use === 'rank' && res.first === 1 && (res.auto.includes(after[0]) || (await p.evaluate(id => App.st.data.years.filter(y => y.fy === App.st.data.fy)[0].rows.find(r => r.id === id).a.k7m, after[0]))), '保存すると順位で決め、1位の児童は「賢い」');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 備考の窓：兄弟を足して保存すると、名簿の備考の欄に出る
{
  const p = await newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="3"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.memo.cc');
  await p.locator('td.memo.cc').nth(1).click(); await p.waitForSelector('#mtx');
  await p.click('[data-sbadd]'); await p.selectOption('[data-sbr="0"]', '姉'); await p.selectOption('[data-sbg="0"]', '7'); await p.fill('[data-sbn="0"]', 'ハナ');
  await p.click('.dlg [data-act="ok"]'); await p.waitForFunction(() => !document.getElementById('mtx'));
  ok(await p.locator('td.memo .msib', { hasText: '中1 ハナ' }).count() === 1, '備考の窓で兄弟を足すと、名簿の備考の欄に出る');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 学力の窓：名簿の帯の「学力…」から開き、点数・順位をタブで切り替え、「賢い」の決め方を選んで保存する
{
  const p = await newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="1"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('[data-dd="rmenu"]');
  // 見本は今年度を順位で決めているので、学力の窓は順位のタブで開く
  await mclick(p, '#acadB'); await p.waitForSelector('#rklist');
  ok(await p.locator('[data-acaduse="rank"]').isChecked(), '見本の今年度は順位で「賢い」を決めている');
  await p.click('[data-acadtab="score"]'); await p.waitForSelector('.sctab');
  await p.click('[data-acadtab="rank"]'); await p.waitForSelector('#rklist');
  ok(await p.locator('[data-acadtab="rank"][aria-selected="true"]').count() === 1, '学力の窓で点数と順位をタブで切り替えられる');
  await p.click('[data-acadtab="score"]'); await p.waitForSelector('.sctab');
  await p.fill('.scin >> nth=0', '90'); await p.click('[data-acadtab="rank"]');
  ok(await p.locator('.sctab').count() === 1 && /保存/.test(await p.textContent('#toast')), '保存していない入力がある時は切り替えない');
  await p.check('[data-acaduse="rank"]'); await p.click('.dlg [data-act="ok"]'); await p.waitForFunction(() => !document.querySelector('.sctab'));
  ok(await p.evaluate(() => App.st.data.scores[App.st.data.fy].use) === 'rank', '「賢い」の決め方は選んだ方で保存する（最後に保存した窓では決めない）');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 学力の順位の窓：低い画面（1366×768 を125%表示した大きさ）でも、児童の一覧が潰れない
{
  const p = await newPage({ viewport: { width: 1093, height: 614 } });
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="5"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('[data-dd="rmenu"]');
  await mclick(p, '#acadB'); await p.waitForSelector('#rklist');
  const hgt = await p.evaluate(() => document.getElementById('rklist').getBoundingClientRect().height);
  ok(hgt >= 250, `低い画面でも順位の一覧が見える（高さ ${Math.round(hgt)}px）`);
  ok(await p.locator('.rkdlg [data-act="ok"]').isVisible(), '保存のボタンが画面の中に残る');
  await p.close();
}
// 新1年：メニューに出る。名簿が0人なら「名簿を貼る」で貼る窓がすぐ開く。児童IDなしで貼れて、クラス分けができる
{
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  ok((await p.locator('.gbtn').first().textContent()).includes('新1年'), 'メニューの学年の先頭に新1年');
  await p.click('[data-g="0"]');
  ok(await p.locator('[data-go="incidents"]').count() === 0, '新1年には事案管理を出さない');
  await p.click('[data-paste]'); await p.waitForSelector('#ptxt');
  ok(true, '名簿が0人の時は「名簿を貼る」で貼る窓がすぐ開く');
  const rows = ['名前\tよみ\t性別'];
  for (let i = 0; i < 40; i++) rows.push('入学 ' + i + '\tにゅうがく ' + i + '\t' + (i % 2 ? '男' : '女'));
  await p.fill('#ptxt', rows.join('\n'));
  await p.waitForSelector('#okbtn:not([disabled])');
  ok((await p.locator('#psum').textContent()).includes('新1年'), '取り込み先は新1年');
  await p.click('#okbtn'); await p.waitForSelector('[aria-label="取り込む前の確認"]');
  await p.click('[aria-label="取り込む前の確認"] [data-act="ok"]');
  await p.waitForFunction(() => /取り込みました/.test(document.getElementById('toast').textContent));
  ok(await p.locator('table.r tbody tr').count() === 40, '児童IDなしで40人が名簿に入る');
  await p.click('[data-go="menu"]:visible');
  ok((await p.locator('[data-g="0"]').textContent()).includes('40人'), 'メニューに人数が出る');
  await p.click('[data-go="split"]'); await intoSplit(p);
  ok(await p.locator('.board .chip').count() === 40, '新1年のクラス分けの盤面に40人');
  ok((await p.locator('[data-go="menu"]:visible').first().textContent()).includes('新1年'), '盤面の戻るボタンに「新1年」');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 特別支援学級：校務システムの名簿の「組」が文字の児童は、取り込む前に交流級を選ぶ。盤面では別の欄に並び、交流級を押して変えられる
{
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="0"]'); await p.click('[data-paste]'); await p.waitForSelector('#ptxt');
  const rows = ['学年\t組\t番号\t姓\t名\t姓ふりがな\t名ふりがな\t名前\t性別\t住所'];
  for (let i = 0; i < 30; i++) rows.push('1\t' + (i % 2 + 1) + '\t' + (i + 1) + '\t入学\t' + i + '\tにゅうがく\t' + i + '\t\t' + (i % 2 ? '男' : '女') + '\t市内' + i);
  rows.push('1\tひまわり\t1\t特支\tハナ\tとくし\tはな\t\t女\t市内');
  await p.fill('#ptxt', rows.join('\n'));
  await p.waitForSelector('.spbox');
  ok((await p.locator('.spbox').textContent()).includes('特支 ハナ'), '取り込む前に、特別支援学級の児童を別に並べる');
  await p.click('[data-spa$=":1"]');
  ok(await p.locator('[data-spa$=":1"][aria-pressed="true"]').count() === 1, '交流級（2組）を選べる');
  await p.click('#okbtn'); await p.waitForSelector('[aria-label="取り込む前の確認"]');
  await p.click('[aria-label="取り込む前の確認"] [data-act="ok"]');
  await p.waitForFunction(() => /取り込みました/.test(document.getElementById('toast').textContent));
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="split"]'); await intoSplit(p);
  ok(await p.locator('.spstrip .spk').count() === 1 && await p.locator('.board .chip').count() === 30, '盤面の組には通常の30人、特別支援学級の児童は別の欄');
  const before = await p.locator('.spstrip [aria-pressed="true"]').textContent();
  await p.click('.spstrip .lv[aria-pressed="false"]');
  ok((await p.locator('.spstrip [aria-pressed="true"]').textContent()) !== before, '交流級を押して変えられる');
  ok((await p.locator('.head .spn').count()) === 1, '組の見出しに交流の人数');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 目安箱：メニューの下から開き、名前が入っていると送らない。送ると管理者が設定で読める
{
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-go="suggest"]'); await p.waitForSelector('#sgtext');
  ok((await p.locator('#main').textContent()).includes('名前、児童の番号'), '個人情報を書かない注意書き');
  const nm = await p.evaluate(async () => { const g5 = await Platforms.demo.boot(5); return g5.kids[g5.years[0].rows[0].id].name; });
  await p.fill('#sgtext', nm.replace(/\s/g, '') + 'の画面が見づらい'); await p.click('#sgsend');
  await p.waitForSelector('#main .warnbox:has-text("送っていません")');
  ok(true, '名簿の名前が入っていると送らない');
  await p.fill('#sgtext', '盤面の文字を大きくしたい'); await p.click('#sgsend');
  await p.waitForSelector('.gbtn');
  ok(/送りました/.test(await p.textContent('#toast')), '送るとメニューに戻る');
  await p.click('[data-go="settings"]'); await p.click('[data-stab="sugg"]'); await p.waitForSelector('#sgcopy');
  ok((await p.locator('table.ro').textContent()).includes('盤面の文字を大きくしたい'), '管理者は設定の目安箱で読める');
  p.once('dialog', d => d.accept());
  await p.click('#sgclear'); await p.waitForSelector('.empty:has-text("まだ意見はありません")');
  ok(true, '読んだ意見を消せる');
  await p.click('[data-stab="year"]'); await p.waitForSelector('.ylist');
  ok((await p.locator('.ylist').textContent()).includes('まだ決定していない学年'), '年度替わりのタブに年度末の手順と、決定していない学年');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 名簿の画面の転入・転出・削除：誤って登録した児童を外し、転入した児童を足す
{
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="3"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('[data-dd="rmenu"]');
  const n0 = await p.locator('table.r tbody tr').count();
  await mclick(p, '#moveB'); await p.waitForSelector('[aria-label="児童登録/削除"]');
  ok((await p.locator('#moveB').textContent()).includes('児童登録/削除'), 'ボタンの名前は「児童登録/削除」');
  await p.click('[data-mtab="out"]'); await p.click('[data-mrs="mistake"]');
  await p.locator('[data-mp]').nth(0).check(); await p.locator('[data-mp]').nth(1).check();
  p.once('dialog', d => d.accept('2人を外す'));
  await p.click('#mgo');
  await p.waitForFunction(() => /名簿から外しました/.test(document.getElementById('toast').textContent));
  ok(await p.locator('table.r tbody tr').count() === n0 - 2, '選んだ2人を名簿から外せる');
  // 転出 → 転出した児童（出戻り）から戻す
  await mclick(p, '#moveB'); await p.click('[data-mtab="out"]');
  const nm = await p.locator('[data-mp]').first().evaluate(el => el.closest('tr').cells[3].textContent);
  await p.locator('[data-mp]').first().check();
  p.once('dialog', d => d.accept('1人を外す')); await p.click('#mgo');
  await p.waitForFunction(() => /名簿から外しました/.test(document.getElementById('toast').textContent));
  await mclick(p, '#moveB'); await p.click('[data-mtab="left"]'); await p.waitForSelector('[data-mrt]');
  ok((await p.locator('[aria-label="児童登録/削除"]').textContent()).includes(nm), '転出した児童が「転出した児童」に残る');
  await p.locator('[data-mrt$=":1"]').first().click();
  await p.waitForFunction(() => /組に戻しました/.test(document.getElementById('toast').textContent));
  ok((await p.locator('table.r tbody').textContent()).includes(nm), '出戻りの児童を名簿に戻せる');
  await mclick(p, '#moveB'); await p.click('[data-mtab="in"]');
  await p.fill('#mfn', '転入 ハナ'); await p.fill('#mfk', 'てんにゅう はな'); await p.click('[data-msx="0"]');
  await p.click('#min');
  await p.waitForFunction(() => /転入として登録しました/.test(document.getElementById('toast').textContent));
  ok((await p.locator('table.r tbody').textContent()).includes('転入 ハナ'), '転入した児童を名簿の画面から足せる（児童IDなし）');
  // 特別支援学級の児童の交流級を、児童登録/削除の窓で振り分ける
  await mclick(p, '#moveB'); await p.click('[data-mtab="sp"]');
  if (await p.locator('[data-msp]').count()) {
    const b = p.locator('[data-msp][aria-pressed="false"]').first(), q = await b.getAttribute('data-msp');
    await b.click(); await p.waitForSelector('[data-msp="' + q + '"][aria-pressed="true"]');
    ok(true, '特別支援学級の児童の交流級を振り分けられる');
  } else ok(false, '見本の3年に特別支援学級の児童がいない');
  await p.keyboard.press('Escape');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 名簿のロックと、名前・組・番号の編集、ふりがな
{
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 } }); // ロックの初めの状態を確かめるので newPage（ロックを外さない）を使わない
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="4"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('#rlock');
  ok((await p.locator('#rlock').textContent()).includes('ロック中'), '初めはロック中');
  ok(await p.locator('.nmk').count() > 0, '名前の上にふりがなを小さく出す');
  const c0 = await p.locator('td.cell[data-k="k3"]').first().innerHTML();
  await p.locator('td.cell[data-k="k3"]').first().click();
  ok(await p.locator('td.cell[data-k="k3"]').first().innerHTML() === c0 && /ロック中/.test(await p.textContent('#toast')), 'ロック中は欄を押しても変わらない');
  ok(await p.locator('[data-kedit]').count() === 0, 'ロック中は名前を直すボタンを出さない');
  await p.click('#rlock');
  ok((await p.locator('#rlock').textContent()).includes('編集中'), '押すとロックが外れる');
  await p.locator('[data-kedit]').first().click(); await p.waitForSelector('#kename');
  await p.fill('#kename', '直した 名前'); await p.click('[data-kecls="1"]'); await p.fill('#keno', '40');
  await p.fill('#keaddr', '見本市南町9-9'); await p.fill('#kebirth', '2016/1/2');
  await p.click('.dlg [data-act="ok"]');
  await p.waitForFunction(() => /直しました/.test(document.getElementById('toast').textContent));
  await p.click('[data-cls="1"]');
  ok((await p.locator('table.r tbody').textContent()).includes('直した 名前'), '名前・組を直すと、移した組の名簿に出る');
  ok(await p.evaluate(() => { const d = App.st.data, k = Object.values(d.kids).find(x => x.name === '直した 名前'); return k && k.addr === '見本市南町9-9' && k.birth === '2016/1/2'; }), '住所・生年月日も名簿の画面から直せる');
  await p.locator('[data-kedit]').first().click(); await p.waitForSelector('#kememo'); await p.click('#kememo');
  ok(await p.locator('#mtx').count() === 1, '「兄弟・備考を直す…」で備考の窓が開く');
  await p.keyboard.press('Escape');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 読み込みの使い回し：保存が無ければ同じ学年を開き直してもサーバーに聞かない。保存したら読み直す
{
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.evaluate(() => { const pf = App.pf(), b = pf.boot; window.__boots = 0; pf.boot = g => { window.__boots++; return b.call(pf, g); }; App.saveGen++; });
  await p.click('[data-g="3"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.nm');
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.nm');
  ok(await p.evaluate(() => window.__boots) === 1, '保存が無ければ、開き直しても読み直さない（先読みを含めて1回）');
  await p.evaluate(() => App.save(() => Promise.resolve({ ok: true })));
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.nm');
  ok(await p.evaluate(() => window.__boots) === 2, '保存した後は読み直す');
  await p.close();
}
// 名簿の見出しの集計（男女・家庭数）と「クラスなし」
{
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="4"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.nm');
  const cnt = await p.evaluate(() => { const rows = [...document.querySelectorAll('table.r tbody tr')]; return [rows.filter(r => r.querySelector('.sx.m')).length, rows.filter(r => r.querySelector('.sx.f')).length]; });
  ok((await p.locator('.hcnt').textContent()) === '男' + cnt[0] + '女' + cnt[1], '性別の見出しに男女の数：' + (await p.locator('.hcnt').textContent()));
  ok(/家庭数 \d+/.test(await p.locator('.hfam').textContent()), '備考の見出しの右下に家庭数');
  const lines = await p.evaluate(() => [...document.querySelectorAll('table.r thead th.an')].map(th => { const fs = parseFloat(getComputedStyle(th).fontSize), h = [...th.childNodes].filter(n => n.nodeType === 3 || n.tagName === 'BR').length; return Math.round(th.scrollHeight / (fs * 1.2)); }));
  ok(await p.evaluate(() => [...document.querySelectorAll('table.r thead th.an')].every(th => th.innerText.split('\n').length <= 2)), '配慮項目の見出しは2段に収まる（中黒で改行）');
  ok(await p.evaluate(() => [...document.querySelectorAll('table.r thead th.an')].some(th => /長欠\n不登校傾向/.test(th.innerText))), '「長欠・不登校傾向」は中黒で改行');
  await p.click('[data-cls="-1"]'); await p.waitForSelector('.nonebox');
  ok((await p.locator('.nonebox').textContent()).includes('転出済みの児童') && (await p.locator('.nonebox').textContent()).includes('転入予定の児童'), '「クラスなし」に転出済み・転入予定の欄');
  ok(/中島 リス/.test(await p.locator('.nonebox').textContent()), '転入予定の児童（見本の4年の転入生）が出る');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// メニューの年度：過去の年度の名簿、来年度（決定した学年）を見られる。クラス分けは今年度だけ
{
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('#mfy');
  const FY = await p.evaluate(() => App.pf().fiscalYear);
  await p.selectOption('#mfy', String(FY - 1)); await p.waitForSelector('.menu .note:has-text("' + (FY - 1) + '年度の名簿を見ています")');
  ok(await p.locator('[data-go="split"]').count() === 0, '過去の年度ではクラス分けを出さない');
  await p.click('[data-g="6"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.nm');
  ok((await p.locator('#crumb').textContent()).includes((FY - 1) + '年度 6年') && await p.inputValue('#rfy') === String(FY - 1), '過去の年度の6年（卒業した学年）の名簿を開ける');
  await p.click('[data-go="menu"]:visible'); await p.waitForSelector('#mfy');
  await p.selectOption('#mfy', String(FY)); await p.waitForSelector('[data-go="split"]');
  await p.click('[data-g="4"]'); await p.click('[data-go="split"]'); await intoSplit(p);
  await p.click('#decide'); await p.waitForSelector('.dlg input[type=text]');
  await p.fill('.dlg input[type=text]', await p.evaluate(() => document.querySelector('.dlg b').textContent)); await p.click('.dlg [data-act="ok"]'); await p.waitForSelector('.decided');
  await p.click('[data-go="menu"]:visible'); await p.waitForSelector('#mfy');
  await p.selectOption('#mfy', String(FY + 1)); await p.waitForSelector('.menu .note:has-text("' + (FY + 1) + '年度の名簿を見ています")');
  ok(/5年1[0-9]{2}人/.test(await p.locator('[data-g="5"]').textContent()), '来年度のメニューに、決定した学年（4年→来年度5年）の名簿が出る：' + await p.locator('[data-g="5"]').textContent());
  await p.click('[data-g="5"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.nm');
  ok(await p.inputValue('#rfy') === String(FY + 1), '来年度の名簿を開ける');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 上部の帯：1段に収める。学力・全校の事案・転入生は帯に出さない（名簿の管理・メニュー・クラスなしへ）
{
  const p = await newPage({ viewport: { width: 1093, height: 614 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const oneRow = sel => p.evaluate(s => { const bar = document.querySelector(s); return bar.getBoundingClientRect().height <= 48; }, sel);
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="4"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.nm');
  ok(await oneRow('#main .rbar'), '1093px でも名簿の帯は1段');
  ok(await p.locator('.rbar [data-scope="school"]').count() === 0 && await p.locator('.rbar > #acadB').count() === 0, '名簿の帯に「学力」「全校の事案」のボタンは無い（学力は名簿の管理の中）');
  await mclick(p, '#trB'); await p.waitForSelector('#trn');
  await p.fill('#trn', '転入 タロウ'); await p.fill('#trk', 'てんにゅう たろう'); await p.click('#tradd');
  await p.waitForFunction(() => /転入予定に足しました/.test(document.getElementById('toast').textContent));
  ok((await p.locator('.nonebox').textContent()).includes('転入 タロウ'), '転入予定の児童を「クラスなし」で足せる');
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="split"]'); await intoSplit(p);
  ok(await oneRow('.bar') && await p.locator('#trans').count() === 0, '1093px でもクラス分けの帯は1段・「転入生」のボタンは無い');
  ok(await p.locator('.board .chip', { hasText: '転入 タロウ' }).count() === 1, '「クラスなし」で足した転入予定の児童が盤面に入る');
  await p.click('[data-go="menu"]:visible'); await p.click('[data-school]'); await p.waitForSelector('#main .state:has-text("全校の事案")');
  ok(true, 'メニュー画面から全校の事案を開ける');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// 速く何度も押した時：同じ欄の保存は順に送り、最後の値だけが残る（後の値が先に届いて古い値で上書きされない）。読み込み中・保存中は点が回る
{
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="3"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.cell[data-k="k2"]');
  await p.evaluate(() => { const pf = App.pf(), f = pf.setAttr; window.__sent = []; let n = 0; pf.setAttr = function (fy, g, id, k, v) { window.__sent.push(v); const d = [300, 50, 10][n++ % 3]; return new Promise(r => setTimeout(r, d)).then(() => f.apply(pf, arguments)); }; });
  const cell = p.locator('td.cell[data-k="k2"]').first();
  await cell.click(); await cell.click(); await cell.click();
  ok(/保存中/.test(await p.textContent('#save')) && await p.locator('#save .dots').count() === 1, '保存中は「保存中」と点が回る');
  await p.waitForFunction(() => /保存済み/.test(document.getElementById('save').textContent), null, { timeout: 5000 });
  const sent = await p.evaluate(() => window.__sent), id = await cell.getAttribute('data-cell');
  const kept = await p.evaluate(id => { const d = App.st.data, r = d.years.find(y => y.fy === d.fy).rows.find(x => x.id === id); return r.a.k2 | 0; }, id);
  ok(sent[sent.length - 1] === kept && sent.length <= 3, '3回押しても、最後の値で保存される（送ったのは ' + sent.join('→') + '）');
  await p.close();
}
// 誤操作の守り：打った後に窓の外・Esc で閉じかけたら確かめる。設定を保存せずに離れる時も確かめる。番号は2桁を続けて打てる
{
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  await p.click('[data-g="3"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.memo');
  await p.locator('td.memo').nth(2).click(); await p.waitForSelector('#mtx'); await p.fill('#mtx', '書きかけのメモ');
  let asked = 0; p.once('dialog', d => { asked++; d.dismiss(); });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(asked === 1 && await p.locator('#mtx').count() === 1, '打った後に Esc を押すと確かめ、「キャンセル」なら窓は閉じない');
  p.once('dialog', d => d.accept()); await p.mouse.click(5, 700); await p.waitForTimeout(200);
  ok(await p.locator('#mtx').count() === 0, '窓の外を押して「OK」なら閉じる');
  await p.locator('[data-kedit]').first().click(); await p.waitForSelector('#keno');
  await p.fill('#keno', ''); await p.type('#keno', '12');
  ok(await p.inputValue('#keno') === '12', '出席番号に2桁を続けて打てる（打つたびに窓を作り直さない）');
  await p.locator('.dlg [data-act="close"]').click();
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="settings"]'); await p.waitForSelector('[data-al="k1"]');
  await p.fill('[data-al="k1"]', '学習の支援X');
  p.once('dialog', d => d.dismiss()); await p.click('[data-go="menu"]:visible'); await p.waitForTimeout(200);
  ok(await p.locator('[data-al="k1"]').count() === 1, '設定を保存せずに離れようとすると確かめ、「キャンセル」なら残る');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
// SSS：名前・つける離すの今の学年と組・名簿から個人票・事案のゴミ箱
{
  const p = await newPage({ viewport: { width: 1366, height: 768 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIST); await p.waitForSelector('.gbtn');
  ok(await p.title() === 'SSS' && (await p.textContent('#appname')) === 'SSS', 'タブと左上の名前は SSS');
  await p.click('[data-g="3"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.pr');
  const q = await p.locator('td.pr').first().boundingBox(); await p.mouse.click(q.x + q.width - 4, q.y + q.height - 4);
  await p.waitForSelector('.dlg[aria-label="つける・離す"]');
  ok(/（3年\d組）/.test(await p.locator('.dlg[aria-label="つける・離す"] h2').textContent()), 'つける離すの窓に今の学年と組（例：3年1組）');
  await p.keyboard.press('Escape');
  await mclick(p, '#rprint'); await p.waitForSelector('#printbox .pc');
  ok(await p.locator('#printbox .pp').count() >= 1 && /年度 3年 1組/.test(await p.locator('#printbox .pp-h').first().textContent()), '名簿の画面から、その組の個人票を印刷できる');
  await p.click('#pclose');
  await p.click('[data-go="menu"]:visible'); await p.click('[data-go="incidents"]'); await p.waitForSelector('.icard');
  const n0 = await p.locator('.icard').count();
  await p.locator('.icard').first().click(); await p.waitForSelector('#itrash');
  p.once('dialog', d => d.accept()); await p.click('#itrash');
  await p.waitForFunction(() => /ゴミ箱へ移しました/.test(document.getElementById('toast').textContent));
  await p.waitForSelector('.icard');
  ok(await p.locator('.icard').count() === n0 - 1, '事案をゴミ箱へ移すと一覧から消える');
  await p.click('#itrashbox'); await p.waitForSelector('[data-trs]');
  await p.click('[data-trs]'); await p.waitForFunction(() => /ゴミ箱から戻しました/.test(document.getElementById('toast').textContent));
  await p.keyboard.press('Escape'); await p.waitForSelector('.icard');
  ok(await p.locator('.icard').count() === n0, 'ゴミ箱から戻すと一覧に戻る');
  ok(!errs.length, '画面のエラーなし ' + errs.join(' / '));
  await p.close();
}
await browser.close();
console.log(fails ? `\n${fails}件 NG` : '\nすべて ok');
process.exit(fails ? 1 : 0);

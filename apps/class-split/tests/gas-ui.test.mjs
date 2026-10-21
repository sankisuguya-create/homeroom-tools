// 本番の画面（dist/gas/Index.html）と、模擬の GAS 上のサーバー（dist/gas/Code.gs）をつないで動かす。
// google.script.run を、Playwright の exposeFunction 経由でサーバーの関数呼び出しに置き換える。
//   node apps/class-split/tests/gas-ui.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, '..', 'dist', 'gas');
let chromium;
try {
  const req = createRequire(import.meta.url);
  let mod; try { mod = req('playwright'); } catch { mod = req(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
  chromium = mod.chromium;
} catch { console.log('Playwright が無いので飛ばします'); process.exit(0); }

// 模擬の GAS（tests/gas.test.mjs と同じ作り）
const { makeGas } = await import('./gas-mock.mjs');
const gas = makeGas(fs.readFileSync(path.join(DIST, 'Code.gs'), 'utf8'));
gas.ctx.setup();
const FY = gas.ctx.CONFIG.fiscalYear();
const rows = [];
for (let k = 1; k <= 3; k++) for (let n = 1; n <= 30; n++) rows.push([String(50000000 + k * 100 + n), '児童' + k + '-' + n, 'じどう' + String(k * 100 + n), n % 2 ? '男' : '女', 5, k, n]);
gas.ctx.importRoster(FY, rows);

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'NG   ') + m); if (!c) fails++; };
// クラス分けに入る：案がまだ無ければ、設定の窓で作り、並べる動きを飛ばす
const intoSplit = async (p) => {
  await p.waitForSelector('.board .chip, #okbtn');
  if (await p.locator('#okbtn').count()) { await p.click('#okbtn'); await p.waitForSelector('.board .chip'); }
};
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
const browser = await chromium.launch(exe);
const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.exposeFunction('gasCall', (name, args) => gas.ctx[name](...args));
await p.addInitScript(() => {
  // google.script.run の形（withSuccessHandler・withFailureHandler・関数名で呼ぶ）を真似る
  const make = (ok, ng) => new Proxy({}, { get: (_, k) => k === 'withSuccessHandler' ? f => make(f, ng) : k === 'withFailureHandler' ? f => make(ok, f) : (...a) => window.gasCall(k, a).then(ok, ng) });
  window.google = { script: { run: make(() => {}, () => {}) } };
});
await p.goto('file://' + path.join(DIST, 'Index.html'));
await p.waitForSelector('.gbtn');
ok(await p.locator('[role=alert]').count() === 0, '版が一致（警告なし）');
await p.click('[data-g="5"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('table.r');
ok(await p.locator('table.r tbody tr').count() === 30, '名簿：1組30人');
await p.locator('td.cell[data-k="k3"]').first().click();
await p.waitForFunction(() => document.getElementById('save').textContent === '保存済み');
const row = gas.db().getSheetByName('attrs_' + FY).data.find(r => r[0] === '50000101');
ok(row && row[3] === 1, '配慮項目がシートに保存された');

await p.click('[data-go="menu"]:visible'); await p.click('[data-go="split"]'); await intoSplit(p);
ok(await p.locator('.board .chip').count() === 90, 'クラス分け：90人');
await p.waitForFunction(() => document.getElementById('save2') && document.getElementById('save2').textContent === '保存済み', null, { timeout: 5000 });
ok(gas.call('apiBoot', 5).v.plans.ver >= 1 && gas.call('apiBoot', 5).v.plans.plans.length === 1, '最初の案がシートに保存された');

// 同時保存：別の人が先に保存すると、この画面の保存は止まって知らせる
gas.call('apiSavePlans', 5, [], gas.call('apiBoot', 5).v.plans.ver);
await p.keyboard.press('d');
await p.waitForFunction(() => /先に保存/.test(document.getElementById('save2').textContent), null, { timeout: 5000 });
ok(true, '同時保存を検知して止まる');

// 試行：左上のボタンでダミーデータに切り替わり、操作してもサーバーに送らない。やめると本番に戻る
await p.click('[data-go="menu"]:visible'); await p.waitForSelector('.gbtn');
const before = JSON.stringify(gas.db().sheets);
await p.click('.top .trial');
await p.waitForFunction(() => document.body.classList.contains('trying'));
ok(await p.waitForSelector('.gbtn small:has-text("138人")', { timeout: 3000 }).then(() => true, () => false), '試行：ダミーデータの学年が出る');
ok(/版：BUILD_[0-9a-f]{12}（試行中）/.test(await p.textContent('#mbuild')), '試行中でもメニューに本番の画面の版が出る');
await p.click('[data-g="6"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('td.cell');
await p.locator('td.cell').first().click();
await p.click('[data-go="menu"]:visible'); await p.click('[data-g="5"]'); await p.click('[data-go="split"]'); await intoSplit(p);
ok(await p.locator('.bar .trial[aria-pressed="true"]').count() === 1, '試行：クラス分けの帯にも試行中の表示');
ok(JSON.stringify(gas.db().sheets) === before, '試行中の操作はサーバーに送らない');
await p.click('.bar .trial');
await p.waitForFunction(() => !document.body.classList.contains('trying'));
await p.waitForSelector('.gbtn');
ok(await p.locator('.gbtn small', { hasText: '90人' }).count() === 1, '試行をやめると本番のデータに戻る');
ok(/^版：BUILD_[0-9a-f]{12}$/.test((await p.textContent('#mbuild')).trim()), '本番ではメニューに版が出る');

// 名簿を貼る（本番）：見出しで読み、取り込むとシートに入る
await p.click('[data-g="5"]'); await p.click('[data-go="roster"]'); await p.waitForSelector('#rfy');
await p.click('#paste'); // 名簿の上の帯から
await p.fill('#ptxt', '児童ID\t名前\tよみ\t性別\t組\t番号\n50000101\t児童1-1\tじどう101\t男\t1\t1\n50000401\t転入 さん\tてんにゅう\t女\t1\t31');
await p.waitForSelector('#okbtn:not([disabled])');
ok((await p.locator('#psum').textContent()).includes('2人'), '貼ると読み取った人数が出る');
await p.keyboard.press('Control+Enter');
await p.waitForFunction(() => /取り込みました/.test(document.getElementById('toast').textContent));
ok(gas.db().getSheetByName('roster_' + FY).data.some(r => r[0] === '50000401'), '名簿がシートに入った');
ok(await p.locator('table.r tbody tr').count() === 31, '1組が31人に');

// つける・離す（本番）：追加して保存すると、読み込み直して違反の判定に入る
await p.click('[data-go="menu"]:visible'); await p.click('[data-go="split"]'); await intoSplit(p);
await p.keyboard.press('p'); await p.waitForSelector('#qa');
await p.fill('#qa', '児童1-1'); await p.click('[data-pk="a:50000101"]');
await p.fill('#qb', '児童1-3'); await p.click('[data-pk="b:50000103"]');
await p.click('#padd');
await p.click('#okbtn');
await p.waitForFunction(() => /保存しました/.test(document.getElementById('toast').textContent));
ok(gas.call('apiBoot', 5).v.pairs.length === 1, 'つける・離すがシートに入った');
ok(await p.locator('#gen').count() === 1, '保存後もクラス分けの画面のまま');

// 版ずれの警告
const p2 = await browser.newPage();
await p2.exposeFunction('gasCall', (name, args) => JSON.stringify({ ...JSON.parse(gas.ctx[name](...args)), build: 'BUILD_old' }));
await p2.addInitScript(() => {
  const make = (ok, ng) => new Proxy({}, { get: (_, k) => k === 'withSuccessHandler' ? f => make(f, ng) : k === 'withFailureHandler' ? f => make(ok, f) : (...a) => window.gasCall(k, a).then(ok, ng) });
  window.google = { script: { run: make(() => {}, () => {}) } };
});
await p2.goto('file://' + path.join(DIST, 'Index.html'));
await p2.waitForSelector('[role=alert]');
ok(true, '版がずれると警告');

ok(errs.length === 0, '画面のエラーなし ' + errs.join(' / '));
await browser.close();
console.log(fails ? `\n${fails}件 NG` : '\nすべて ok');
process.exit(fails ? 1 : 0);

// 画面のテスト（Playwright）。 node apps/classroom-clock/tests/ui.test.mjs
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
await ctx.clock.install({ time: new Date(2026, 10, 12, 9, 0, 0) });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + DIST);
ok(/9:00/.test(await p.textContent('#pv .cv-big')), '時計が今の時刻');
await p.click('#segMode [data-v=timer]');
await p.click('#presets button:nth-child(3)');   // 5分
ok((await p.textContent('#pv .cv-b1')) === '5:00', '5分を押すと 5:00 から始まる');
await ctx.clock.runFor(4 * 60 * 1000 + 1000);
ok((await p.getAttribute('#pv', 'data-phase')) === 'warn', '残り1分で「もうすぐ」の状態');
await ctx.clock.runFor(60 * 1000);
ok((await p.getAttribute('#pv', 'data-phase')) === 'over', '0で「おわり」');
const played = await p.evaluate(() => window.__cc.sound.played.slice());
ok(played.includes('warn') && played.includes('chime'), '予告音と終了音が鳴る: ' + played.filter(x => !x.startsWith('voice')).join(','));
ok(played.includes('voice:おわりです'), '声で「おわりです」');
await p.click('#segFace [data-v=analog]');
await p.click('#tReset'); await p.click('#tToggle');
const d = await p.getAttribute('#pv .cv-sector', 'd');
ok(!!d && d.startsWith('M100'), 'アナログ盤に残り時間の扇形');
// モニター窓：操作の部品が入っていない
const [pop] = await Promise.all([p.waitForEvent('popup'), p.click('#goMonitor')]);
await ctx.clock.runFor(300);
ok(await pop.locator('.cv-big').count() === 1, 'モニター窓に時計が出る');
ok(await pop.locator('button').count() === 0, 'モニター窓に操作の部品は無い');
ok((await pop.textContent('.cv-b1')) === (await p.textContent('#pv .cv-b1')), 'モニターと見本が同じ表示');
await p.reload();
ok((await p.getAttribute('#pv', 'data-mode')) === 'timer', '読み込み直しても続きから');
ok(errs.length === 0, 'エラーなし ' + errs.join(' / '));
await browser.close();
process.exit(fails ? 1 : 0);

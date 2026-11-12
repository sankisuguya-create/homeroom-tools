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
// 時刻が字幅でガタつかない：1・8 など字形の幅が違っても、枠の幅は同じ
const wOf = () => p.evaluate(() => document.querySelector('#pv .cv-b1').getBoundingClientRect().width);
const w1 = await wOf(); await ctx.clock.runFor(11 * 60 * 1000 + 11000); const w2 = await wOf();
ok(Math.abs(w1 - w2) < 0.5, `時刻の幅が変わらない（${w1.toFixed(1)} / ${w2.toFixed(1)}）`);
const lowContrast = () => p.evaluate(() => {
  const L = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => (v /= 255) <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
  const bg = el => { for (; el; el = el.parentElement) { const c = getComputedStyle(el).backgroundColor; if (!/rgba\(.*, 0\)|transparent/.test(c)) return c; } return 'rgb(255,255,255)'; };
  const out = [];
  document.querySelectorAll('body *').forEach(el => {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || !el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) return;
    const a = L(getComputedStyle(el).color), b = L(bg(el)), r = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    if (r < 4.5) out.push(el.textContent.trim().slice(0, 12) + ' ' + r.toFixed(1));
  });
  return out;
});
for (const theme of ['light', 'dark']) {
  if (theme === 'dark') { await p.click('#swDark'); await ctx.clock.runFor(600); await p.waitForTimeout(600); }
  const low = await lowContrast();
  ok(low.length === 0, `文字のコントラスト 4.5 以上（${theme}） ` + low.join(' / '));
}
await p.click('#swDark');
await p.click('#segMode [data-v=timer]');
await p.click('#presets button:nth-child(3)');   // 5分
await ctx.clock.runFor(3000);
ok((await p.textContent('#pv .cv-b1')) === '5:00', '5分を選んでも始まらない');
await p.click('#pv');
await ctx.clock.runFor(1500);
ok((await p.textContent('#pv .cv-b1')) === '4:59', '画面クリックでスタート');
await ctx.clock.runFor(4 * 60 * 1000);
ok((await p.getAttribute('#pv', 'data-phase')) === 'warn', '残り1分で色が変わる状態');
await ctx.clock.runFor(60 * 1000);
ok((await p.getAttribute('#pv', 'data-phase')) === 'over', '0で「終了」');
const played = await p.evaluate(() => window.__cc.sound.played.slice());
ok(played.includes('alarm'), '予告音と終了音が鳴る: ' + played.filter(x => !x.startsWith('voice')).join(','));
ok(['m1', 's30', 'c5', 'c4', 'c3', 'c2', 'c1', 'end'].every(k => played.includes('clip:female-' + k)), '声：残り1分・残り30秒・5〜1・そこまで');
await ctx.clock.runFor(90 * 1000);
ok((await p.textContent('#pv .cv-b1')) === '0:00' && (await p.getAttribute('#pv', 'data-phase')) === 'over', '終了後は 0:00 のまま（超過を数えない）');
// ストップウォッチ：画面クリックとスペースでスタート／一時停止
await p.click('#segMode [data-v=sw]');
await p.click('#pv'); await ctx.clock.runFor(2000); await p.keyboard.press('Space');
const t1 = await p.textContent('#pv .cv-b1'); await ctx.clock.runFor(3000);
ok(t1 === '0:02' && (await p.textContent('#pv .cv-b1')) === t1, 'ストップウォッチを画面クリックで開始、スペースで一時停止');
await p.click('#segMode [data-v=timer]');
await p.click('#segFace [data-v=analog]');
await p.click('#tReset'); await p.click('#tToggle');
const d = await p.getAttribute('#pv .cv-sector', 'd');
ok(!!d && d.startsWith('M100'), 'アナログ盤に残り時間の扇形');
ok(await p.evaluate(() => document.querySelector('#pv .cv-sh').getAttribute('y1') === '100' && ['.cv-hh', '.cv-mh'].every(q => /L104\.5 100Z|L103 100Z/.test(document.querySelector('#pv ' + q).getAttribute('d')))), '針は中心から（反対側に突き出さない）');
ok(/A95\.5 95\.5/.test(d), '扇形は円周まで塗り切る');
ok(!!(await p.getAttribute('#pv .cv-tri', 'd')), '終わりの位置に赤い三角');
await p.click('#segFace [data-v=bar]');
ok(await p.locator('#pv .cv-bar').isVisible(), '横棒で残り時間');
await p.click('#segFace [data-v=analog]');
// モニター窓：操作の部品が入っていない
const [pop] = await Promise.all([p.waitForEvent('popup'), p.click('#goMonitor')]);
await ctx.clock.runFor(300);
ok(await pop.locator('.cv-big').count() === 1, 'モニター窓に時計が出る');
ok(await pop.locator('button').count() === 0, 'モニター窓に操作の部品は無い');
ok((await pop.textContent('.cv-b1')) === (await p.textContent('#pv .cv-b1')), 'モニターと見本が同じ表示');
await p.reload();
ok((await p.getAttribute('#pv', 'data-mode')) === 'timer', '読み込み直しても続きから');
ok((await p.textContent('#pv .cv-label')) === '' , 'モニターの表示に文の説明を出さない');
await p.evaluate(() => window.__cc.sound.unlock());
await p.waitForTimeout(1500);
ok(await p.evaluate(() => window.__cc.sound.playClip('robot-c3') > 0), '録音した声を変換して鳴らせる（24本）');
await p.click('#segMode [data-v=sw]');
ok(await p.evaluate(() => ['analog', 'bar'].every(v => document.querySelector('#segFace [data-v=' + v + ']').disabled) && document.querySelector('#pv').dataset.face === 'digital'), 'ストップウォッチではアナログ・横棒を選べず、デジタルで表示');
await p.click('#segMode [data-v=clock]');
ok(await p.evaluate(() => document.querySelector('#segFace [data-v=bar]').disabled && !document.querySelector('#segFace [data-v=analog]').disabled), '時計では時間割が切のとき横棒を選べない');
ok(errs.length === 0, 'エラーなし ' + errs.join(' / '));
await browser.close();
process.exit(fails ? 1 : 0);

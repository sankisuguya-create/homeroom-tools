// サーバー（dist/gas/Code.gs）を、GAS の各サービスを真似た部品の上で動かして確かめる。
//   node --test apps/class-split/tests/gas.test.mjs
// GAS はコメントを消して配ることがある（principles/gas-javascript-notes.md §2）ので、
// 「そのまま」と「コメントを消した形」の両方で同じ確かめをする。実機の GAS とは別物なので、
// 実機でしか分からないこと（権限の範囲・DriveApp の挙動・ロックの待ち）は docs/design.md に未確認として残す。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeGas } from './gas-mock.mjs';

const CODE = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'gas', 'Code.gs'), 'utf8');
const strip = h => h.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

for (const [label, src] of [['そのまま', CODE], ['コメントを消した形', strip(CODE)]]) {
  test(`サーバー（${label}）：名簿・配慮項目・案・事案・決定と取り消し`, () => {
    const { ctx, env, call, db } = makeGas(src);
    ctx.setup();
    const FY = ctx.CONFIG.fiscalYear();
    // 4年 2学級×4人
    const rows = [];
    for (let k = 1; k <= 2; k++) for (let n = 1; n <= 4; n++) rows.push([String(40000000 + k * 10 + n), '児童' + k + n, 'じどう' + k + n, n % 2 ? '男' : '女', 4, k, n]);
    assert.equal(ctx.importRoster(FY, rows), 8);

    // 教員でないアカウントは拒否
    env.user = '12345678@kyoiku.edu.nishi.or.jp';
    const denied = call('apiBoot', 4);
    assert.equal(denied.ok, false); assert.equal(denied.user, true);
    assert.ok(ctx.doGet().h.includes('教員のアカウント'));
    env.user = 'tanaka@edu.nishi.or.jp';

    const g = call('apiListGrades').v;
    assert.equal(g[3].count, 8); assert.equal(g[3].classes, 2);

    let b = call('apiBoot', 4);
    assert.ok(b.ok, b.err); assert.match(b.build, /^BUILD_/);
    assert.equal(b.v.years.length, 1); assert.equal(b.v.years[0].rows.length, 8);

    // 配慮項目：今年度は直せる
    assert.ok(call('apiSetAttr', FY, 4, '40000011', 'k3', 2).ok);
    b = call('apiBoot', 4).v;
    assert.equal(b.years[0].rows.find(r => r.id === '40000011').a.k3, 2);
    assert.equal(call('apiSetAttr', FY, 4, '40000011', 'kX', 1).ok, false);

    // 案：版が合えば保存、古い版からの保存は上書きしない
    const plans = [{ letter: 'A', assign: {} }];
    assert.equal(call('apiSavePlans', 4, plans, 0).v.ver, 1);
    assert.equal(call('apiSavePlans', 4, plans, 0).v.conflict, true);
    assert.equal(call('apiSavePlans', 4, plans, 1).v.ver, 2);
    assert.equal(call('apiBoot', 4).v.plans.ver, 2);

    // 事案：名前を取れる文書は自動、取れない文書は空。URLが学校のドライブでなければ拒否
    const i1 = call('apiAddIncident', { url: 'https://docs.google.com/document/d/DOC1234567890abcdefghijXYZ/edit', title: '', date: '2026-10-02', type: '対人', ids: ['40000011', '40000021'] });
    assert.ok(i1.ok, i1.err); assert.equal(i1.v.title, '10月2日 休み時間の件');
    assert.equal(call('apiFetchTitle', 'https://docs.google.com/document/d/NOACCESS0000000000000000/edit').v.title, '');
    assert.equal(call('apiAddIncident', { url: 'https://example.com/x', title: 'x', date: '2026-10-02', type: '対人', ids: ['40000011'] }).ok, false);
    b = call('apiBoot', 4).v;
    assert.equal(b.incidents.length, 1); assert.deepEqual(b.incidents[0].ids, ['40000011', '40000021']);
    assert.equal(call('apiSchoolIncidents').v.length, 2);

    // 決定：来年度の名簿（五十音順の番号）と値の写し。今年度は凍結、来年度は直せる
    const assign = {}; rows.forEach((r, i) => { assign[r[0]] = i % 2; });
    const d = call('apiDecide', 4, { name: '案A（標準）', assign });
    assert.ok(d.ok, d.err);
    assert.equal(call('apiDecide', 4, { name: 'x', assign }).ok, false);
    b = call('apiBoot', 4).v;
    const next = b.years.find(y => y.fy === FY + 1);
    assert.equal(next.grade, 5); assert.equal(next.rows.length, 8);
    assert.equal(next.rows.find(r => r.id === '40000011').a.k3, 2, '値が写る');
    assert.deepEqual(next.rows.filter(r => r.cls === 0).map(r => r.no).sort(), [1, 2, 3, 4]);
    assert.ok(b.decision);
    const frozen = call('apiSetAttr', FY, 4, '40000011', 'k3', 1);
    assert.equal(frozen.ok, false); assert.match(frozen.err, /凍結|直せません/);
    assert.ok(call('apiSetAttr', FY + 1, 5, '40000011', 'k3', 1).ok);
    assert.equal(call('apiListGrades').v[3].decided, true);

    // 取り消し：来年度の行が消え、今年度がまた直せる
    assert.ok(call('apiUndoDecide', 4).ok);
    b = call('apiBoot', 4).v;
    assert.equal(b.years.find(y => y.fy === FY + 1), undefined);
    assert.equal(b.decision, null);
    assert.ok(call('apiSetAttr', FY, 4, '40000011', 'k3', 3).ok);
    assert.equal(db().getSheetByName('roster_' + (FY + 1)).getLastRow(), 1, '見出しだけ残る');

    // 6年は決定しない
    assert.equal(call('apiDecide', 6, { name: 'x', assign: {} }).ok, false);
  });
}

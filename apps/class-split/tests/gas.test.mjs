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

// 本物の GAS は google.script.run に「function 名前()」の宣言しか出さない。画面が呼ぶ api がすべて宣言されているか（模擬の GAS では分からない差）
test('画面が呼ぶ api はすべて function で宣言されている', () => {
  const page = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'platform-gas.js'), 'utf8');
  const called = [...new Set([...page.matchAll(/call\('(api[A-Za-z]+)'/g)].map(m => m[1]))];
  assert.ok(called.length > 20);
  const missing = called.filter(n => !new RegExp('^function ' + n + '\\(', 'm').test(CODE));
  assert.deepEqual(missing, [], 'function で宣言されていない api');
});

for (const [label, src] of [['そのまま', CODE], ['コメントを消した形', strip(CODE)]]) {
  test(`サーバー（${label}）：名簿・配慮項目・案・事案・決定と取り消し`, () => {
    const { ctx, env, call, db, drive, props } = makeGas(src);
    ctx.setup();
    const FY = ctx.CONFIG.fiscalYear();
    // 4年 2学級×4人
    const rows = [];
    for (let k = 1; k <= 2; k++) for (let n = 1; n <= 4; n++) rows.push([String(40000000 + k * 10 + n), '児童' + k + n, 'じどう' + k + n, n % 2 ? '男' : '女', 4, k, n]);
    assert.equal(ctx.importRoster(FY, rows), 8);

    // 教員でないアカウントは拒否
    // 児童のアカウント・似せたドメイン・数字8桁の名前は、教員と見なさない
    for (const u of ['12345678@kyoiku.edu.nishi.or.jp', 'taro@kyoiku.edu.nishi.or.jp', '12345678@edu.nishi.or.jp', 'tanaka@sub.edu.nishi.or.jp', 'tanaka@edu.nishi.or.jp.example.com', 'tanaka@xedu.nishi.or.jp']) {
      env.user = u; assert.equal(call('apiListGrades').ok, false, u);
    }
    env.user = 'Tanaka@EDU.NISHI.OR.JP'; assert.equal(call('apiListGrades').ok, true, '大文字でも教員');
    env.user = '12345678@kyoiku.edu.nishi.or.jp';
    const denied = call('apiBoot', 4);
    assert.equal(denied.ok, false); assert.equal(denied.user, true);
    assert.ok(ctx.doGet().h.includes('教員のアカウント'));
    env.user = 'tanaka@edu.nishi.or.jp';

    const g = call('apiListGrades').v;
    assert.deepEqual(g.map(x => x.grade), [0, 1, 2, 3, 4, 5, 6], '新1年（0）から6年まで');
    const g4 = g.find(x => x.grade === 4);
    assert.equal(g4.count, 8); assert.equal(g4.classes, 2);

    let b = call('apiBoot', 4);
    assert.ok(b.ok, b.err); assert.match(b.build, /^BUILD_/);
    assert.equal(b.v.years.length, 1); assert.equal(b.v.years[0].rows.length, 8);

    // 項目を足す前に作ったシート（通の列が無い）でも、足した項目を書ける
    const asd = db().getSheetByName('attrs_' + FY).data, ki = asd[0].indexOf('k10');
    assert.ok(ki > 0); asd.forEach(r => r.splice(ki, 1));
    assert.ok(call('apiSetAttr', FY, 4, '40000012', 'k10', 1).ok);
    assert.equal(call('apiBoot', 4).v.years[0].rows.find(r => r.id === '40000012').a.k10, 1);

    // 配慮項目：今年度は直せる
    assert.ok(call('apiSetAttr', FY, 4, '40000011', 'k3', 2).ok);
    b = call('apiBoot', 4).v;
    assert.equal(b.years[0].rows.find(r => r.id === '40000011').a.k3, 2);
    assert.equal(call('apiSetAttr', FY, 4, '40000011', 'kX', 1).ok, false);
    assert.equal(call('apiSetAttr', FY, 4, '40000011', 'k3', 3).ok, false, '程度は2（アイコン＋）まで');
    assert.equal(call('apiSetAttr', FY, 4, '40000011', 'k5', 2).ok, false, 'ア・身・通は有無だけ');
    assert.equal(call('apiSetAttr', FY, 4, '40000011', 'k7', 2).ok, false, '賢・リ・運も有無だけ');
    assert.ok(call('apiSetAttr', FY, 4, '40000011', 'k5', 1, '=卵').ok);
    assert.equal(call('apiBoot', 4).v.years[0].rows.find(r => r.id === '40000011').a.k5_t, "'=卵", 'ア・身・通の内容は文字のまま残る（式にしない）');
    // 保護者：経緯の文と事案の紐付け
    assert.ok(call('apiSetAttr', FY, 4, '40000011', 'k4', 2, '入学時から電話が多い', [7, 9]).ok);
    let k4 = call('apiBoot', 4).v.years[0].rows.find(r => r.id === '40000011').a;
    assert.deepEqual([k4.k4, k4.k4_t, k4.k4_i], [2, '入学時から電話が多い', [7, 9]]);
    assert.ok(call('apiSetAttr', FY, 4, '40000011', 'k4', 0, '', []).ok);
    k4 = call('apiBoot', 4).v.years[0].rows.find(r => r.id === '40000011').a;
    assert.equal(k4.k4_t, undefined, '無にすると経緯も消える');
    assert.ok(call('apiSetAttr', FY, 4, '40000011', 'k3', 2, '休み時間に手が出る', [2]).ok, '問も経緯と事案を持てる');
    assert.deepEqual(call('apiBoot', 4).v.years[0].rows.find(r => r.id === '40000011').a.k3_i, [2]);
    assert.ok(call('apiSetAttr', FY, 4, '40000011', 'k5', 0, '').ok);
    assert.equal(call('apiBoot', 4).v.years[0].rows.find(r => r.id === '40000011').a.k5_t, undefined, 'なしにすると内容も消える');
    // 備考：列の無い古いシートでも書け、空にすると消える
    assert.ok(call('apiSetAttr', FY, 4, '40000011', 'memo', 1, '前の席').ok);
    assert.equal(call('apiBoot', 4).v.years[0].rows.find(r => r.id === '40000011').a.memo, '前の席');
    assert.equal(call('apiBoot', 4).v.years[0].rows.find(r => r.id === '40000011').a.k3, 2, '備考を書いても配慮項目は変わらない');
    assert.ok(call('apiSetAttr', FY, 4, '40000011', 'memo', 0, '').ok);
    assert.equal(call('apiBoot', 4).v.years[0].rows.find(r => r.id === '40000011').a.memo, undefined);

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
    // 関係図つきの事案：関係する児童と役割は関係図から決まり、直すと入れ替わる
    const dg = { nodes: [{ id: '40000011', x: 10, y: 10 }, { id: '40000012', x: 100, y: 10 }], edges: [{ f: 'k:40000012', t: 'k:40000011' }] };
    const di = call('apiAddIncident', { url: 'https://docs.google.com/document/d/DG1/edit', title: '関係図', date: '2026-10-03', type: '対人', diagram: dg });
    assert.ok(di.ok, di.err); assert.deepEqual(di.v.ids, ['40000011', '40000012']); assert.equal(di.v.roles['40000012'], 'harm');
    let got = call('apiBoot', 4).v.incidents.find(x => x.id === di.v.id);
    assert.equal(got.roles['40000011'], 'victim'); assert.equal(got.diagram.edges.length, 1);
    assert.equal(call('apiAddIncident', { url: 'https://docs.google.com/document/d/DG2/edit', date: '2026-10-05', dateEnd: '2026-10-01', diagram: dg }).ok, false, '終わりが始まりより前は不可');
    // 事案管理：文書のURLは任意。報告書の記録（発覚・経緯・指導）は行ごとに残り、長さと行数に上限がある
    const rp = { light: false, found: '本人からの訴え', modes: [true, false, false, false, false, false, false, false, false, true], other: '靴', s1: { hk: [{ d: '2026-10-03', p: '朝休み', t: '訴え' }], kk: [{ d: 'x', p: '昼休み', t: 'k'.repeat(3000) }], sd: [] }, s2: { sd: [], vi: [], ha: [], kikan: '' } };
    const ri = call('apiAddIncident', { url: '', title: '', date: '2026-10-03', type: 'いじめ', diagram: dg, report: rp });
    assert.ok(ri.ok, ri.err);
    got = call('apiBoot', 4).v.incidents.find(x => x.id === ri.v.id);
    assert.equal(got.url, ''); assert.equal(got.report.found, '本人からの訴え'); assert.equal(got.report.s1.hk[0].p, '朝休み');
    assert.equal(got.report.s1.kk[0].d, '', '日付でない値は空にする'); assert.equal(got.report.s1.kk[0].t.length, 2000);
    assert.equal(call('apiAddIncident', { date: '2026-10-03', type: 'いじめ', diagram: dg, report: { s1: { hk: Array.from({ length: 81 }, () => ({ t: 'a' })) } } }).ok, false, '1つの欄は80行まで');
    // 「？」（誰か分からない児童）は関係図にだけ残り、関係する児童・役割には入らない
    const uk = call('apiAddIncident', { date: '2026-10-04', type: 'いじめ', diagram: { nodes: [{ id: '?1', x: 10, y: 10 }, { id: '40000011', x: 200, y: 10 }], edges: [{ f: 'k:?1', t: 'k:40000011' }] } });
    assert.ok(uk.ok, uk.err); assert.deepEqual(uk.v.ids, ['40000011']); assert.equal(uk.v.roles['40000011'], 'victim'); assert.equal(uk.v.roles['?1'], undefined);
    assert.equal(call('apiBoot', 4).v.incidents.find(x => x.id === uk.v.id).diagram.nodes.length, 2);
    assert.equal(call('apiAddIncident', { date: '2026-10-04', type: 'いじめ', diagram: { nodes: [{ id: '?1', x: 10, y: 10 }], edges: [] } }).ok, false, '「？」だけでは登録できない');
    // 全校の名簿：ほかの学年の児童を関係図に足すため。配慮項目の程度も付く
    const sk = call('apiSchoolKids'); assert.ok(sk.ok, sk.err); assert.equal(sk.v.length, 8); assert.equal(typeof sk.v[0].a, 'object'); assert.equal(sk.v[0].grade, 4);
    // 書きかけ：教員ごと・学年ごとに残り、null で消える
    assert.ok(call('apiSaveDraft', 4, { mode: 'form', form: { type: 'いじめ' } }).ok);
    assert.equal(call('apiLoadDraft', 4).v.draft.form.type, 'いじめ');
    assert.equal(call('apiLoadDraft', 3).v, null, '別の学年には出ない');
    assert.ok(call('apiSaveDraft', 4, null).ok); assert.equal(call('apiLoadDraft', 4).v, null);
    const ex = call('apiExportReport', 'f1', { B4: '高木北小' });
    assert.equal(ex.ok, false); assert.match(ex.err, /様式のファイルが設定されていません/);
    assert.equal(call('apiExportReport', 'zz', {}).ok, false);
    const up = call('apiUpdateIncident', di.v.id, { url: got.url, title: got.title, date: got.date, dateEnd: '2026-10-20', detail: '=経緯 '.repeat(300), type: got.type, diagram: { nodes: dg.nodes.concat([{ id: '40000013', x: 200, y: 10 }]), edges: [{ f: 'k:40000011', t: 'k:40000012' }, { f: 'k:40000012', t: 'k:40000011' }] } });
    assert.ok(up.ok, up.err);
    got = call('apiBoot', 4).v.incidents.find(x => x.id === di.v.id);
    assert.deepEqual(got.ids.slice().sort(), ['40000011', '40000012', '40000013']);
    assert.equal(got.roles['40000011'], 'mutual'); assert.equal(got.roles['40000013'], 'related');
    assert.equal(got.dateEnd, '2026-10-20', '期間の終わり'); assert.ok(got.detail.length > 1000 && got.detail.charAt(0) === "'", '詳細は長くても切らず、式にしない');
    assert.equal(call('apiUpdateIncident', 999, { url: got.url, diagram: dg }).ok, false);
    assert.ok(got.rev, '事案に版が付く');
    assert.equal(call('apiUpdateIncident', got.id, { url: got.url, date: got.date, type: got.type, diagram: got.diagram }, '2000-01-01T00:00:00.000Z').v.conflict, true, 'ほかの先生が先に直していたら上書きしない');
    const up2 = call('apiUpdateIncident', got.id, { url: got.url, date: got.date, dateEnd: got.dateEnd, detail: got.detail, type: got.type, diagram: got.diagram }, got.rev);
    assert.ok(up2.ok && !up2.v.conflict && up2.v.rev, '読んだ版のままなら直せる');

    // 特別支援学級の印：有無だけ
    assert.ok(call('apiSetAttr', FY, 4, '40000012', 'sp', 1).ok);
    assert.equal(call('apiSetAttr', FY, 4, '40000012', 'sp', 2).ok, false);
    // 新年度の転入生：IDが無ければ仮のID。名簿のIDと重なれば断る
    const tr = call('apiAddTransfer', 4, { name: '転入 太郎', kana: 'てんにゅう たろう', male: true });
    assert.ok(tr.ok, tr.err); assert.match(tr.v.id, /^T\d{7}$/);
    assert.equal(call('apiAddTransfer', 4, { name: 'x', id: '40000011' }).ok, false);
    assert.equal(call('apiAddTransfer', 4, { name: '' }).ok, false);
    const tr2 = call('apiAddTransfer', 4, { name: '=消す 花子', kana: 'けす はなこ', male: false, id: '49999999' });
    assert.ok(tr2.ok);
    assert.ok(call('apiRemoveTransfer', 4, '49999999').ok);
    assert.deepEqual(call('apiBoot', 4).v.transfers.map(t => t.id), [tr.v.id]);

    // 決定：来年度の名簿（五十音順の番号）と値の写し。今年度は凍結、来年度は直せる
    const assign = {}; rows.forEach((r, i) => { assign[r[0]] = i % 2; });
    assert.equal(call('apiDecide', 4, { name: 'x', assign }).ok, false, '転入生の組が無ければ決定しない');
    assign[tr.v.id] = 1;
    ctx.append_('roster_' + (FY + 1), ctx.ROSTER_HEAD, [{ id8: '40000011', name: '途中で止まった行', kana: '', sex: '男', grade: 5, 'class': 1, no: 1 }]); // 前の決定が途中で止まった
    const d = call('apiDecide', 4, { name: '案A（標準）', assign });
    assert.ok(d.ok, d.err);
    assert.equal(call('apiAddTransfer', 4, { name: 'y' }).ok, false, '決定後は足せない');
    assert.equal(call('apiDecide', 4, { name: 'x', assign }).ok, false);
    b = call('apiBoot', 4).v;
    const next = b.years.find(y => y.fy === FY + 1);
    assert.equal(next.grade, 5); assert.equal(next.rows.length, 9, '転入生も入る');
    assert.equal(b.kids[tr.v.id].name, '転入 太郎');
    assert.equal(next.rows.find(r => r.id === '40000012').a.sp, 1, '特別支援学級の印が写る');
    assert.equal(next.rows.find(r => r.id === '40000011').a.k3, 2, '値が写る');
    assert.deepEqual(next.rows.filter(r => r.cls === 0).map(r => r.no).sort(), [1, 2, 3, 4]);
    assert.deepEqual(next.rows.filter(r => r.cls === 1).map(r => r.no).sort(), [1, 2, 3, 4, 5]);
    assert.ok(b.decision);
    const frozen = call('apiSetAttr', FY, 4, '40000011', 'k3', 1);
    assert.equal(frozen.ok, false); assert.match(frozen.err, /凍結|直せません/);
    assert.ok(call('apiSetAttr', FY + 1, 5, '40000011', 'k3', 1).ok);
    assert.equal(call('apiListGrades').v.find(x => x.grade === 4).decided, true);

    // 組の番号：決定の直後は仮（A組＝1組）。決めると来年度の名簿の組が付け替わり、出席番号は変わらない
    assert.deepEqual(b.decision.names, [1, 2]); assert.equal(b.decision.named, false);
    const before = Object.fromEntries(next.rows.map(r => [r.id, [r.cls, r.no]]));
    assert.equal(call('apiSetClassNames', 4, [1, 1]).ok, false, '番号の重複は不可');
    assert.ok(call('apiSetClassNames', 4, [2, 1]).ok);
    b = call('apiBoot', 4).v;
    assert.deepEqual(b.decision.names, [2, 1]); assert.equal(b.decision.named, true);
    b.years.find(y => y.fy === FY + 1).rows.forEach(r => { assert.equal(r.cls, 1 - before[r.id][0]); assert.equal(r.no, before[r.id][1]); });
    assert.ok(call('apiSetClassNames', 4, [1, 2]).ok, '直せる');
    call('apiBoot', 4).v.years.find(y => y.fy === FY + 1).rows.forEach(r => assert.equal(r.cls, before[r.id][0]));

    // 取り消し：来年度の行が消え、今年度がまた直せる
    assert.ok(call('apiUndoDecide', 4).ok);
    b = call('apiBoot', 4).v;
    assert.equal(b.years.find(y => y.fy === FY + 1), undefined);
    assert.equal(b.decision, null);
    assert.ok(call('apiSetAttr', FY, 4, '40000011', 'k3', 2).ok);
    assert.equal(db().getSheetByName('roster_' + (FY + 1)).getLastRow(), 1, '見出しだけ残る');

    // 名簿の取り込み：同じIDは上書き（値は残す）、新しいIDは足す、貼った中にいない児童は知らせる（消さない）
    const imp = call('apiImportRoster', FY, 4, [
      { id: '40000011', name: '児童11改', kana: 'じどう11', male: true, cls: 0, no: 1 },
      { id: '40000099', name: '転入生', kana: 'てんにゅう', male: false, cls: 0, no: 5 }
    ]);
    assert.ok(imp.ok, imp.err);
    assert.equal(imp.v.added, 1); assert.equal(imp.v.updated, 1);
    assert.equal(imp.v.missing.length, 3, '1組の残り3人');
    b = call('apiBoot', 4).v;
    assert.equal(b.kids['40000011'].name, '児童11改');
    assert.equal(b.years[0].rows.find(r => r.id === '40000011').a.k3, 2, '配慮項目の値は残る');
    assert.equal(b.years[0].rows.length, 9);
    assert.equal(call('apiImportRoster', FY - 1, 4, [{ id: '40000011', name: 'x', cls: 0, no: 1 }]).ok, false, '過去の年度は入れられない');

    // つける・離す：学年ごとに置き換え。読み込みで返る
    assert.ok(call('apiSavePairs', 4, [{ t: 'far', a: '40000011', b: '40000012', memo: '' }, { t: 'fix', a: '40000013', k: 1, memo: '1階' }]).ok);
    b = call('apiBoot', 4).v;
    assert.deepEqual(b.pairs.map(p => [p.t, p.a, p.b ?? p.k]), [['far', '40000011', '40000012'], ['fix', '40000013', 1]]);
    assert.ok(call('apiSavePairs', 4, [{ t: 'near', a: '40000021', b: '40000022', memo: '' }]).ok);
    assert.equal(call('apiSavePairs', 4, [], 0).v.conflict, true, 'つける・離すも、読んだ版より新しければ上書きしない');
    assert.equal(call('apiBoot', 4).v.pairs.length, 1, '置き換わる');
    // 経緯・定型の理由・添えた事案・何年生からを持つ（何年生からが無ければ今の学年）
    assert.ok(call('apiSavePairs', 4, [{ t: 'far', a: '40000011', b: '40000012', memo: '=前から', tags: ['家庭希望', '担任判断'], incs: [3, 5], since: 2 }, { t: 'near', a: '40000021', b: '40000022', memo: '' }]).ok);
    const ps = call('apiBoot', 4).v.pairs;
    assert.deepEqual([ps[0].memo, ps[0].tags, ps[0].incs, ps[0].since], ["'=前から", ['家庭希望', '担任判断'], [3, 5], 2]);
    assert.equal(ps[1].since, 4);
    assert.ok(call('apiSavePairs', 4, [{ t: 'near', a: '40000021', b: '40000022', memo: '' }]).ok);

    // 6年は決定しない
    assert.equal(call('apiDecide', 6, { name: 'x', assign: {} }).ok, false);

    // 設定：保存の検査、担任の学年・学級
    assert.equal(call('apiSaveSettings', { attrs: { k1: { label: '', s: '' } }, types: ['対人'] }).ok, false, '名前が空は不可');
    const st = call('apiSaveSettings', { attrs: { k1: { label: '学習の支援', s: '援', w: 3 } }, types: ['対人', ' ', 'けが'], teachers: [{ email: 'Tanaka@edu.nishi.or.jp', grade: 4, cls: 2 }], keepYears: 9 });
    assert.ok(st.ok, st.err);
    assert.deepEqual(st.v.types, ['対人', 'けが']); assert.equal(st.v.keepYears, 6); assert.equal(st.v.attrs.k1.s, '援');
    const xs = call('apiSaveSettings', { attrs: { k1: { label: '学<img src=x onerror=alert(1)>習', s: '援', w: 3 } }, types: ['対人"><b>'] });
    assert.ok(xs.ok, xs.err); assert.ok(!/[<>"]/.test(xs.v.attrs.k1.label + xs.v.types[0]), '設定の文字から HTML の記号を落とす');
    call('apiSaveSettings', { attrs: { k1: { label: '学習の支援', s: '援', w: 3 } }, types: ['対人', 'けが'], teachers: [{ email: 'Tanaka@edu.nishi.or.jp', grade: 4, cls: 2 }], keepYears: 6 });
    const me = call('apiSettings').v.me;
    assert.deepEqual([me.grade, me.cls], [4, 1], 'メールの大文字小文字を無視して担任を見つける');
    const hs = call('apiSaveSettings', { attrs: { k3: { label: '問題行動', s: '問', w: 3, help: ['トラブル', '  ', '深刻'] }, k5: { label: 'アレルギー', s: 'ア', w: 1, help: ['食物', '要配慮', 'これは捨てる'] } }, types: ['対人'] });
    assert.ok(hs.ok, hs.err);
    assert.deepEqual(hs.v.attrs.k3.help, ['トラブル', '多い。', '深刻'], '空の欄は既定の文に戻る');
    assert.equal(hs.v.attrs.k5.help.length, 2, '有無だけの項目は2つまで');
    call('apiSaveSettings', Object.assign(call('apiSettings').v.settings, { keepYears: 0 }));

    // 利用者と管理者：ドメインは市内共通なので、一覧に無い教員は通さない。所有者は一覧に無くても管理者
    env.user = 'other@edu.nishi.or.jp';
    assert.equal(call('apiListGrades').ok, false, '一覧に無い教員（他校）は拒否');
    assert.equal(call('apiBoot', 4).ok, false);
    assert.ok(ctx.doGet().h.includes('利用者に登録されていません'));
    env.user = 'tanaka@edu.nishi.or.jp';
    assert.equal(call('apiSaveSettings', Object.assign(call('apiSettings').v.settings, { teachers: [{ email: 'taro@kyoiku.edu.nishi.or.jp' }] })).ok, false, '児童のメールは一覧に入れられない');
    assert.ok(call('apiSaveSettings', Object.assign(call('apiSettings').v.settings, { teachers: [{ email: 'Sato@edu.nishi.or.jp', grade: 4, cls: 1 }, { email: 'kyoto@edu.nishi.or.jp', admin: true }] })).ok);
    assert.equal(call('apiSettings').v.me.admin, true, '所有者は一覧に無くても管理者');
    env.user = 'sato@edu.nishi.or.jp';
    assert.equal(call('apiListGrades').ok, true, '一覧の教員は通る');
    assert.equal(call('apiSettings').v.me.admin, false);
    const sx = call('apiSaveSettings', call('apiSettings').v.settings);
    assert.equal(sx.ok, false, '管理者でない教員は設定を保存できない'); assert.ok(sx.err.includes('管理者'));
    assert.equal(call('apiLeaveCandidates').ok, false); assert.equal(call('apiPurge', ['60000001']).ok, false, '管理者でない教員は記録を消せない');
    for (const [fn, ...a] of [['apiDecide', 4, { name: 'x', assign: {} }], ['apiUndoDecide', 4], ['apiSetClassNames', 4, [1, 2]], ['apiClearSuggestions'], ['apiPruneLog']]) {
      const r = call(fn, ...a); assert.equal(r.ok, false, fn + ' は管理者だけ'); assert.ok(r.err.includes('管理者'), fn);
    }
    env.user = 'kyoto@edu.nishi.or.jp';
    assert.equal(call('apiSettings').v.me.admin, true, '印を付けた人は管理者');
    assert.ok(call('apiSaveSettings', call('apiSettings').v.settings).ok);
    env.owner = 'someone@edu.nishi.or.jp'; env.user = 'tanaka@edu.nishi.or.jp';
    assert.equal(call('apiListGrades').ok, false, '所有者でなく一覧にも無ければ拒否');
    env.owner = 'tanaka@edu.nishi.or.jp';

    // 取り込む前の差分：名前の半分以上が変わる・ほかの学年の児童がいる時は risky
    const fake = [1, 2, 3, 4].map(n => ({ id: String(40000010 + n), name: '別人' + n, kana: '', male: true, cls: 0, no: n }));
    const dr = call('apiImportRoster', FY, 4, fake, { dry: true });
    assert.ok(dr.ok, dr.err); assert.equal(dr.v.renamed.length, 4); assert.equal(dr.v.risky, true, '名前が全部変わるのは別の表の疑い');
    const dr2 = call('apiImportRoster', FY, 5, [{ id: '40000011', name: '児童11', kana: '', male: true, cls: 0, no: 1 }], { dry: true });
    assert.equal(dr2.v.other.length, 1); assert.equal(dr2.v.risky, true, 'ほかの学年の児童がいる');
    const cur = db().getSheetByName('roster_' + FY).data.find(r => r[0] === '40000012');
    const dr3 = call('apiImportRoster', FY, 4, [{ id: '40000012', name: ' ' + String(cur[1]).replace(/(.)/, '$1　'), kana: '', male: true, cls: 0, no: 2 }, { id: '40009999', name: '新入', kana: '', male: false, cls: 0, no: 9 }], { dry: true });
    assert.deepEqual([dr3.v.added, dr3.v.renamed.length, dr3.v.risky], [1, 0, false], '空白の違いは名前の変更にしない');
    const nRows = db().getSheetByName('roster_' + FY).data.length;
    call('apiImportRoster', FY, 4, fake, { dry: true });
    assert.equal(db().getSheetByName('roster_' + FY).data.length, nRows, '差分の確認では書かない');
    // 控え：取り込みの前に取る。6個を超えたら古いものから捨てる
    const bk0 = drive.live().length;
    call('apiImportRoster', FY, 4, [{ id: '40000011', name: '児童11', kana: 'じどう11', male: true, cls: 0, no: 1 }]);
    assert.equal(drive.live().length, bk0 + 1, "取り込みの前に控え");
    for (let i = 0; i < 8; i++) ctx.weeklyBackup();
    assert.equal(drive.live().length, 6, '控えは6個まで');
    assert.ok(drive.triggers.includes('weeklyBackup'), 'setup が毎週の控えのきっかけを作る');
    // 共有の警告：データのスプレッドシートを共有すると管理者に知らせる。管理者でなければ空
    assert.equal(call('apiAdminStatus').v.warnings.length, 0);
    drive.share(props.CLASS_SPLIT_DB_ID, { editors: ['sato@edu.nishi.or.jp'] });
    const ws = call('apiAdminStatus').v.warnings;
    assert.ok(ws.some(w => w.kind === 'share' && w.text.includes('sato@')), '共有の相手を出す');
    env.user = 'sato@edu.nishi.or.jp'; assert.equal(call('apiAdminStatus').v.warnings.length, 0, '管理者でない人には出さない');
    assert.equal(call('apiReadLog').ok, false, '記録は管理者だけ');
    call('apiBoot', 4); env.user = 'tanaka@edu.nishi.or.jp';
    drive.share(props.CLASS_SPLIT_DB_ID, { editors: [], sharing: 'ANYONE_WITH_LINK' });
    assert.ok(call('apiAdminStatus').v.warnings[0].text.includes('リンクを知る全員'));
    drive.share(props.CLASS_SPLIT_DB_ID, { sharing: 'PRIVATE' });
    // 読み出しの記録：開いた学年を残す（同じ人の同じ読み出しは10分に1回）
    const lg = call('apiReadLog').v;
    assert.ok(lg.some(r => r.by === 'sato@edu.nishi.or.jp' && r.action === 'boot' && r.n === '4'), '読み出しが記録に残る');
    const nb = lg.length; call('apiBoot', 4); call('apiBoot', 4);
    assert.ok(call('apiReadLog').v.length <= nb + 1, '開き直しで行が増え続けない');

    // 端末の登録（仮実装）：登録が無い間は制限なし。受付を開くと、開いた端末と、10分の間にアクセスした校務の端末を登録する
    const PC = (t, os = 'Windows', extra = {}) => ({ __dev: { t, os, mobile: false, touch: 10, screen: '1280×720', ...extra } });
    const dcall = (fn, dev, ...a) => JSON.parse(ctx[fn](...a, dev));
    assert.equal(dcall('apiListGrades', PC('')).ok, true, '登録が無い間はどの端末でも開ける');
    assert.equal(dcall('apiOpenDeviceWindow', PC('', 'iOS', { mobile: true })).ok, false, '携帯電話からは受付を開けない');
    const op = dcall('apiOpenDeviceWindow', PC(''));
    assert.ok(op.ok && op.dev, '受付を開いた端末は登録され、合い言葉を受け取る');
    const adminTok = op.dev;
    env.user = 'sato@edu.nishi.or.jp';
    const ph = dcall('apiListGrades', PC('', 'iOS', { mobile: true }));
    assert.equal(ph.device, true, '受付の間でも携帯電話は登録しない'); assert.ok(ph.err.includes('登録できない'));
    assert.equal(dcall('apiListGrades', PC('', 'Linux')).device, true, 'PC版の表示の Android（Linux）も弾く');
    const r2 = dcall('apiListGrades', PC('', 'ChromeOS'));
    assert.ok(r2.ok && r2.dev, '受付の間にアクセスした校務の端末は登録される');
    const satoTok = r2.dev;
    env.user = 'tanaka@edu.nishi.or.jp';
    assert.ok(dcall('apiCloseDeviceWindow', PC(adminTok)).ok);
    env.user = 'sato@edu.nishi.or.jp';
    assert.equal(dcall('apiListGrades', PC('')).device, true, '受付を閉じた後、未登録の端末は開けない');
    assert.equal(dcall('apiListGrades', PC('', 'Windows')).device, true);
    assert.equal(call('apiListGrades').device, true, '端末の情報が無い呼び出しも断る');
    assert.equal(dcall('apiListGrades', PC(satoTok, 'ChromeOS')).ok, true, '登録した端末は開ける');
    assert.equal(dcall('apiListGrades', PC(satoTok, 'iOS', { mobile: true })).device, true, '合い言葉を写しても、種類が違えば断る');
    env.user = 'tanaka@edu.nishi.or.jp';
    const dl = dcall('apiDevices', PC(adminTok)).v;
    assert.equal(dl.list.length, 2); assert.ok(dl.mine);
    assert.ok(!JSON.stringify(dl).includes(satoTok), '合い言葉そのものはサーバーに残さない・返さない');
    const satoId = dl.list.find(x => x.by === 'sato@edu.nishi.or.jp').id;
    assert.ok(dcall('apiRevokeDevice', PC(adminTok), satoId).ok);
    env.user = 'sato@edu.nishi.or.jp';
    assert.equal(dcall('apiListGrades', PC(satoTok, 'ChromeOS')).device, true, '取り消した端末は開けない');
    env.user = 'tanaka@edu.nishi.or.jp';
    // 受付で利用者も登録する：一般の受付では一般、管理者の受付では管理者として一覧に載る。携帯電話では載らない
    env.user = 'newbie@edu.nishi.or.jp';
    assert.equal(dcall('apiListGrades', PC('', 'ChromeOS')).ok, false, '受付の外では一覧に無い教員は開けない');
    env.user = 'tanaka@edu.nishi.or.jp'; assert.ok(dcall('apiOpenDeviceWindow', PC(adminTok), 'user').ok);
    env.user = 'newbie@edu.nishi.or.jp';
    assert.equal(dcall('apiListGrades', PC('', 'iOS', { mobile: true })).ok, false, '携帯電話では利用者にも載らない');
    const nbr = dcall('apiListGrades', PC('', 'ChromeOS'));
    assert.ok(nbr.ok && nbr.dev, '一般の受付で、利用者と端末が一度に登録される');
    assert.equal(dcall('apiSettings', PC(nbr.dev, 'ChromeOS')).v.me.admin, false, '一般ユーザー');
    env.user = 'tanaka@edu.nishi.or.jp'; assert.ok(dcall('apiOpenDeviceWindow', PC(adminTok), 'admin').ok);
    env.user = 'boss@edu.nishi.or.jp';
    const bs = dcall('apiSettings', PC('', 'Windows'));
    assert.ok(bs.ok && bs.dev && bs.v.me.admin, '管理者の受付で、管理者として登録される');
    env.user = 'newbie@edu.nishi.or.jp';
    assert.equal(dcall('apiSettings', PC(nbr.dev, 'ChromeOS')).v.me.admin, true, '管理者の受付の間に開いた既存の一般ユーザーも管理者になる');
    env.user = 'tanaka@edu.nishi.or.jp'; dcall('apiCloseDeviceWindow', PC(adminTok));
    env.user = 'stranger2@edu.nishi.or.jp';
    assert.ok(ctx.doGet().h.includes('利用者に登録されていません'), '受付を閉じた後は、一覧に無い教員に画面も出さない');
    env.user = 'tanaka@edu.nishi.or.jp';
    // エディタ用の関数は、画面から所有者以外が呼んでも断る（google.script.run から誰でも呼べるため）
    env.user = 'sato@edu.nishi.or.jp';
    for (const f of ['resetDevices', 'setup', 'weeklyBackup']) assert.throws(() => ctx[f](), /所有者/, f + ' は所有者以外が呼べない');
    assert.throws(() => ctx.importRoster(FY, [['49999999', 'x', 'x', '男', 4, 1, 1]]), /所有者/);
    env.user = 'tanaka@edu.nishi.or.jp';
    ctx.resetDevices();
    assert.equal(call('apiListGrades').ok, true, 'resetDevices で制限が外れる');

    // 児童IDは8桁に限らない。住所（全文と町名）が名簿に入り、住所の無い表を貼り直しても消えない
    const ad = call('apiImportRoster', FY, 4, [{ id: 'A123', name: '住所 タロウ', kana: 'じゅうしょ たろう', male: true, cls: 0, no: 10, addr: '大阪府西市中央三丁目5-2', area: '中央' }]);
    assert.ok(ad.ok, ad.err);
    const kA = call('apiBoot', 4).v.kids.A123;
    assert.ok(kA && kA.addr === '大阪府西市中央三丁目5-2' && kA.area === '中央', '住所と町名が名簿に入る（8桁でない児童IDでも）');
    assert.ok(call('apiImportRoster', FY, 4, [{ id: 'A123', name: '住所 タロウ', kana: 'じゅうしょ たろう', male: true, cls: 0, no: 10 }]).ok);
    assert.equal(call('apiBoot', 4).v.kids.A123.addr, '大阪府西市中央三丁目5-2', '住所の無い表を貼り直しても消えない');
    assert.equal(call('apiImportRoster', FY, 4, [{ id: 'A 1', name: 'x', cls: 0, no: 1 }]).ok, false, '空白を含む児童IDは断る');

    // 控えが取れない時（ドライブの権限が無い）も、名簿の取り込みは止めない。管理者のメニューで知らせ、selfTest で直る
    const cf = env.DriveApp.createFolder, gf = env.DriveApp.getFoldersByName;
    env.DriveApp.getFoldersByName = () => ({ hasNext: () => false });
    env.DriveApp.createFolder = () => { throw new Error('DriveApp.createFolder を呼び出す権限がありません'); };
    const nbk = call('apiImportRoster', FY, 4, [{ id: '40000011', name: '児童11', kana: 'じどう11', male: true, cls: 0, no: 1 }]);
    assert.ok(nbk.ok && /控えを取れません/.test(nbk.v.backupError), '控えが取れなくても取り込み、理由を返す');
    assert.ok(call('apiAdminStatus').v.warnings.some(w => w.kind === 'backup' && w.text.includes('selfTest')), '管理者のメニューで selfTest を案内する');
    assert.match(ctx.selfTest(), /✕ 控え/, 'selfTest は失敗を示す');
    env.DriveApp.createFolder = cf; env.DriveApp.getFoldersByName = gf;
    const stt = ctx.selfTest();
    assert.match(stt, /○ 控え/); assert.match(stt, /○ 毎週の控えのきっかけ/);
    assert.ok(!call('apiAdminStatus').v.warnings.some(w => w.kind === 'backup'), 'selfTest で控えが取れたら知らせは消える');

    // 兄弟：続柄が分からない兄弟（'?'）は今年度の名簿の同じ学年・組・番号の児童の性別で決め、配慮項目の表に入る
    const sb0 = call('apiImportRoster', FY, 4, [{ id: 'SB1', name: '兄弟 太', kana: '', male: true, cls: 0, no: 60, sib: [{ r: '?', g: 5, cls: 1, no: 1, n: '児童' }, { r: '?', g: 1, cls: 9, no: 9, n: '不明' }] }]);
    assert.ok(sb0.ok, sb0.err);
    const sbA = call('apiBoot', 4).v.years.find(y => y.fy === FY).rows.find(r => r.id === 'SB1').a.sib;
    assert.equal(sbA.length, 2); assert.equal(sbA[0].g, 5); assert.ok(['兄', '姉'].includes(sbA[0].r), '年上は兄か姉'); assert.equal(sbA[1].r, '弟', '名簿にいない年下は弟（画面で直せる）');

    // 兄弟の学年は、結び付いた兄弟の今の名簿から読む（年度が替われば上がる）。組の振り分け（交流級）
    assert.ok(call('apiImportRoster', FY, 4, [{ id: 'SB2', name: '兄弟 次', kana: '', male: true, cls: 0, no: 61, sib: [{ r: '?', g: 3, cls: 1, no: 1, n: '古い名前', id: '40000011' }] }]).ok);
    const sb2 = call('apiBoot', 4).v.years.find(y => y.fy === FY).rows.find(r => r.id === 'SB2').a.sib[0];
    assert.deepEqual([sb2.g, sb2.n, sb2.id], [4, '児童11', '40000011'], '学年と名前は兄弟の児童の名簿から');
    const mv = call('apiSetKidClass', FY, 4, 'SB2', 1);
    assert.ok(mv.ok, mv.err);
    assert.equal(call('apiBoot', 4).v.years.find(y => y.fy === FY).rows.find(r => r.id === 'SB2').cls, 1, '組を移せる（交流級の振り分け）');

    // 名前・よみ・組・番号を直す（児童IDは変えない）
    const upd = call('apiUpdateKid', FY, 4, 'SB2', { name: '直した 名前', kana: 'なおした なまえ', cls: 0, no: 70 });
    assert.ok(upd.ok, upd.err);
    const upr = call('apiBoot', 4).v; const upk = upr.years.find(y => y.fy === FY).rows.find(r => r.id === 'SB2');
    assert.ok(upk.cls === 0 && upk.no === 70 && upr.kids.SB2.name === '直した 名前' && upr.kids.SB2.kana === 'なおした なまえ', '名前・よみ・組・番号が変わる');
    assert.equal(call('apiUpdateKid', FY, 4, 'SB2', { name: '', cls: 0, no: 1 }).ok, false, '名前は空にできない');
    assert.equal(call('apiUpdateKid', FY - 1, 4, 'SB2', { name: 'x', cls: 0, no: 1 }).ok, false, '直せない年度は断る');

    // 名簿から外す：転出は名簿だけ、誤登録は配慮項目も消す。直せない年度は断る。名簿の画面の転入は児童IDなしで仮の番号
    assert.ok(call('apiImportRoster', FY, 4, [{ id: 'ZZ1', name: '誤登録 A', kana: '', male: true, cls: 0, no: 50 }, { id: 'ZZ2', name: '転出 B', kana: '', male: false, cls: 0, no: 51 }]).ok);
    call('apiSetAttr', FY, 4, 'ZZ1', 'k3', 1); call('apiSetAttr', FY, 4, 'ZZ2', 'k3', 1);
    const rmA = call('apiRemoveKids', FY, 4, ['ZZ1'], 'mistake'), rmB = call('apiRemoveKids', FY, 4, ['ZZ2'], 'leave');
    assert.ok(rmA.ok && rmA.v.n === 1 && rmB.ok && rmB.v.n === 1, rmA.err || rmB.err);
    const ros = db().getSheetByName('roster_' + FY).data.map(r => String(r[0])), att = db().getSheetByName('attrs_' + FY).data.map(r => String(r[0]));
    assert.ok(!ros.includes('ZZ1') && !ros.includes('ZZ2'), '名簿から外れる');
    assert.ok(!att.includes('ZZ1') && att.includes('ZZ2'), '誤登録は配慮項目も消え、転出は残る（年度替わりで消す）');
    // 転出児童：転出は一覧に残り、同じ児童IDで戻せる（誤登録は残らない）
    const lf = call('apiLeftKids', FY, 4).v;
    assert.ok(lf.some(x => x.id === 'ZZ2' && x.leftGrade === 4) && !lf.some(x => x.id === 'ZZ1'), '転出した児童だけが転出児童の一覧に残る');
    assert.equal(call('apiLeftKids', FY, 5).v.length, 0, 'ほかの学年には出ない');
    const rs = call('apiRestoreKid', FY, 4, 'ZZ2', 2);
    assert.ok(rs.ok, rs.err);
    const back = call('apiBoot', 4).v.years.find(y => y.fy === FY).rows.find(r => r.id === 'ZZ2');
    assert.ok(back && back.cls === 2 && back.a.k3 === 1, '同じ児童IDで戻り、配慮項目もつながる');
    assert.ok(!call('apiLeftKids', FY, 4).v.some(x => x.id === 'ZZ2'), '戻すと転出児童の一覧から消える');
    assert.equal(call('apiRestoreKid', FY, 4, 'ZZ2', 2).ok, false, '一覧にいない児童は戻せない');
    assert.equal(call('apiRemoveKids', FY - 1, 4, ['40000011'], 'leave').ok, false, '直せない年度は断る');
    const tin = call('apiImportRoster', FY, 4, [{ id: '', name: '転入 C', kana: 'てんにゅう', male: true, cls: 1, no: 9 }], { temp: true });
    assert.ok(tin.ok, tin.err);
    assert.ok(call('apiBoot', 4).v.years.find(y => y.fy === FY).rows.some(r => /^N\d{7}$/.test(r.id) && r.cls === 1), '転入は児童IDなしで仮の番号');

    // 目安箱：名簿の名前・番号があれば送らずに語を返す。送った人は残さない。読めるのは管理者だけ
    const sb = call('apiSuggest', '児童11の配慮項目の入力が分かりにくい', 'menu');
    assert.ok(sb.ok && sb.v.blocked && sb.v.blocked.includes('児童11'), '名簿の名前が入っていれば送らない');
    assert.ok(call('apiSuggest', '番号 40000011 の画面で', 'menu').v.blocked, '8桁の番号も');
    assert.equal(call('apiSuggest', '   ', 'menu').ok, false, '空は送れない');
    assert.ok(call('apiSuggest', '盤面の文字を大きくしたい', 'menu').v.ok);
    const sh = db().getSheetByName('suggestions').data;
    assert.deepEqual(sh[0], ['at', 'screen', 'text'], '送った人の列は無い');
    assert.ok(sh.length === 2 && !JSON.stringify(sh).includes('tanaka'), '送った人は残さない');
    assert.equal(call('apiSuggestions').v[0].text, '盤面の文字を大きくしたい');

    // 年度末：読んだ意見を消す（管理者だけ）、1年より古い記録を消す、決定していない学年

    const sc = call('apiClearSuggestions');
    assert.ok(sc.ok && sc.v.n === 1 && call('apiSuggestions').v.length === 0, '目安箱の意見を消せる');
    const lgS = db().getSheetByName('log');
    lgS.data.push([new Date(Date.now() - 400 * 86400000).toISOString(), 'old@edu.nishi.or.jp', 'boot', 4]);
    const pl = call('apiPruneLog');
    assert.ok(pl.ok && pl.v.n >= 1 && !lgS.data.some(r => r[1] === 'old@edu.nishi.or.jp'), '1年より古い記録を消す');
    assert.ok(lgS.data.some(r => r[2] === 'pruneLog'), '新しい記録は残る');
    assert.ok(ctx.undecidedGrades_().includes(4) === !call('apiListGrades').v.find(x => x.grade === 4).decided, '決定していない学年を数える');

    // 特別支援学級の児童：取り込むと交流級の組に入り、配慮項目の表に印（sp=1）と学級の名前（spn）が付く
    const sp1 = call('apiImportRoster', FY, 4, [{ id: '40000099', name: '特支 ハナ', kana: 'とくし はな', male: false, cls: 1, no: 9, sp: 'ひまわり' }]);
    assert.ok(sp1.ok, sp1.err);
    const spRow = call('apiBoot', 4).v.years.find(y => y.fy === FY).rows.find(r => r.id === '40000099');
    assert.ok(spRow && spRow.cls === 1 && spRow.a.sp === 1 && spRow.a.spn === 'ひまわり', '交流級の組に、特別支援学級の印と名前つきで入る');

    // 新1年（grade 0）：児童IDなしで取り込むと仮の番号（N＋年度＋3桁）。決定で来年度の1年になり、8桁の番号を貼ると名前で照らして付け替える
    const nk = [['入学 ハナ', 'にゅうがく はな', false], ['入学 タロウ', 'にゅうがく たろう', true], ['入学 ジロウ', 'にゅうがく じろう', true], ['入学 サクラ', 'にゅうがく さくら', false]]
      .map((k, i) => ({ id: '', name: k[0], kana: k[1], male: k[2], cls: 0, no: i + 1 }));
    assert.equal(call('apiImportRoster', FY, 1, nk).ok, false, '新1年以外は児童IDが要る');
    const nd = call('apiImportRoster', FY, 0, nk, { dry: true });
    assert.equal(nd.v.added, 4, '差分の確認：4人追加');
    const ni = call('apiImportRoster', FY, 0, nk);
    assert.ok(ni.ok, ni.err); assert.equal(ni.v.added, 4);
    const b0 = call('apiBoot', 0).v;
    const r0 = b0.years.find(y => y.fy === FY);
    assert.ok(r0 && r0.rows.length === 4 && r0.rows.every(r => /^N\d{7}$/.test(r.id)), '仮の番号で今年度の0学年に入る');
    assert.equal(call('apiListGrades').v.find(x => x.grade === 0).count, 4);
    assert.ok(call('apiImportRoster', FY, 0, [{ id: '', name: '入学 モモ', kana: 'にゅうがく もも', male: false, cls: 0, no: 5 }]).ok);
    const ids0 = call('apiBoot', 0).v.years.find(y => y.fy === FY).rows.map(r => r.id);
    assert.equal(new Set(ids0).size, 5, '追加で貼っても仮の番号は重ならない');
    const asg0 = {}; ids0.forEach((id, i) => { asg0[id] = i % 2; });
    const dc0 = call('apiDecide', 0, { name: '案A', assign: asg0 });
    assert.ok(dc0.ok, dc0.err);
    const g1n = call('apiBoot', 0).v.years.find(y => y.fy === FY + 1 && y.grade === 1);
    assert.ok(g1n && g1n.rows.length === 5, '決定すると来年度の1年の名簿になる');
    // 入学後：8桁の番号の名簿を来年度の1年に貼ると、名前（空白の違いは無視）で照らして付け替える
    const real = [{ id: '30000001', name: '入学　ハナ', kana: 'にゅうがく はな', male: false, cls: 0, no: 1 }, { id: '30000002', name: '入学 タロウ', kana: '', male: true, cls: 1, no: 1 }];
    const rd = call('apiImportRoster', FY + 1, 1, real, { dry: true });
    assert.equal(rd.v.relink.length, 2, '差分の確認で付け替えを見せる'); assert.equal(rd.v.added, 0);
    const rr = call('apiImportRoster', FY + 1, 1, real);
    assert.ok(rr.ok, rr.err); assert.equal(rr.v.relinked, 2); assert.equal(rr.v.added, 0, '付け替えた児童は二重に足さない');
    const ids1 = db().getSheetByName('roster_' + (FY + 1)).data.map(r => String(r[0]));
    assert.ok(ids1.includes('30000001') && ids1.includes('30000002') && ids1.filter(x => /^N/.test(x)).length === 3, '名簿の仮の番号が8桁に変わる');
    assert.ok(db().getSheetByName('attrs_' + (FY + 1)).data.some(r => String(r[0]) === '30000001'), '配慮項目の行も付け替わる');

    // 年度替わり：前年度に卒業した児童が候補に出て、消すと名簿・事案の結び付き・案から消える
    ctx.importRoster(FY - 1, [['60000001', '卒業生', 'そつぎょう', '男', 6, 1, 1], ['40000011', '児童11', 'じどう11', '男', 3, 1, 1]]);
    // 事案に関わった児童は、残す年数を0にしても卒業・転出から5年度は候補に出ず、消せない
    ctx.importRoster(FY - 6, [['60000009', '昔の卒業生', 'むかし', '女', 6, 1, 1]]);
    call('apiAddIncident', { url: 'https://docs.google.com/document/d/DOC1234567890abcdefghijOLD/edit', title: '', date: '2020-05-01', type: '対人', ids: ['60000009'] });
    const inc1 = call('apiAddIncident', { url: 'https://docs.google.com/document/d/DOC1234567890abcdefghijXY1/edit', title: '', date: '2026-05-01', type: '対人', ids: ['60000001'] });
    assert.ok(inc1.ok, inc1.err);
    let cand = call('apiLeaveCandidates').v;
    assert.deepEqual(cand.map(x => [x.id, x.reason, x.incidents]), [['60000009', '卒業', 1]], '今年度にいる児童と、事案のある5年度以内の卒業生は出ない');
    assert.equal(call('apiPurge', ['40000011']).ok, false, '今年度の名簿にいる児童は消せない');
    assert.equal(call('apiPurge', ['60000001']).ok, false, '事案のある5年度以内の卒業生は消せない');
    // 事案の結び付きを外すと、残す年数（0）どおり候補に出る
    db().getSheetByName('incident_kids').data = db().getSheetByName('incident_kids').data.filter(r => r[1] !== '60000001');
    const inc2 = call('apiAddIncident', { url: 'https://docs.google.com/document/d/DOC1234567890abcdefghijXYZ/edit', title: '', date: '2026-05-01', type: '対人', ids: ['60000009'] });
    cand = call('apiLeaveCandidates').v;
    assert.deepEqual(cand.map(x => x.id).sort(), ['60000001', '60000009']);
    ctx.setSetting_('scores_' + (FY - 1) + '_6', { max: 100, top: 0.1, s: { '60000001': 90, '60000002': 80 } });
    ctx.setSetting_('incdraft_a@edu.nishi.or.jp_6', { at: 'x', draft: { ids: ['60000001'] } });
    ctx.setSetting_('incdraft_b@edu.nishi.or.jp_4', { at: 'x', draft: { ids: ['40000011'] } });
    const pg = call('apiPurge', ['60000001', '60000009']);
    assert.deepEqual(Object.keys(ctx.getSetting_('scores_' + (FY - 1) + '_6', {}).s), ['60000002'], '点数から消した児童を外す');
    assert.equal(ctx.getSetting_('incdraft_a@edu.nishi.or.jp_6', 'なし'), 'なし', '消した児童の入った書きかけは行ごと捨てる');
    assert.ok(ctx.getSetting_('incdraft_b@edu.nishi.or.jp_4', null), 'ほかの書きかけは残す');
    assert.ok(pg.ok, pg.err);
    assert.equal(call('apiLeaveCandidates').v.length, 0);
    assert.ok(!db().getSheetByName('roster_' + (FY - 1)).data.some(r => r[0] === '60000001'));
    const incRow = db().getSheetByName('incidents').data.find(r => r[0] === inc2.v.id);
    assert.equal(incRow[5], '', '結び付く児童がいない事案は名前を消す'); assert.ok(incRow[8], '削除済み');
    assert.equal(call('apiBoot', 4).v.incidents.length, 4, '他の事案は残る');

    // 持ち越しの候補：前年度に決定した時の組のうち、2人とも今この学年にいて、未採用のもの
    db().getSheetByName('pairs_carry').data.push([FY - 1, 'far', '40000011', '40000021'], [FY - 1, 'near', '40000021', '40000022'], [FY - 2, 'far', '40000011', '40000022']);
    const carry = call('apiBoot', 4).v.carry;
    assert.deepEqual(carry.map(p => [p.t, p.a, p.b]), [['far', '40000011', '40000021']], '採用済みと古い年度は出ない');
  });
}

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
    assert.equal(g[3].count, 8); assert.equal(g[3].classes, 2);

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
    assert.equal(call('apiListGrades').v[3].decided, true);

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
    assert.equal(ctx.getSetting_('incdraft_a@edu.nishi.or.jp_6', 1), null, '消した児童の入った書きかけは捨てる');
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

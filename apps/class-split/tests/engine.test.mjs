// 計算の正本（src/engine.js）と見本の Platform 層を Node で確かめる。
//   node --test apps/class-split/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
for (const f of ['config.js', 'engine.js', 'report.js', 'platform-demo.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(SRC, f), 'utf8'), { filename: f });
}
const { CONFIG: C, Engine: E, Report: RP } = globalThis; const PF = globalThis.Platforms.demo;

// 小さな問題：旧4学級×36人＝144人（上限の場合）
function problem(extra = {}) {
  const R = E.rngOf(7), kids = [];
  for (let i = 0; i < 144; i++) {
    const a = {};
    C.ATTRS.forEach(at => { a[at.k] = R() < .12 ? 1 + Math.floor(R() * 3) : 0; });
    kids.push({ id: String(30000000 + i), name: '児童' + i, kana: 'じどう' + String(i).padStart(3, '0'), male: R() < .5, old: i % 4, a, area: C.AREAS[i % 4] });
  }
  const pairs = [
    { t: 'far', i: 0, j: 4 }, { t: 'far', i: 1, j: 5 }, { t: 'far', i: 2, j: 6 },
    { t: 'near', i: 10, j: 11 }, { t: 'near', i: 20, j: 21 },
    { t: 'fix', i: 30, k: 2 }
  ];
  const inc = [{ kids: [0, 4] }, { kids: [1] }, { kids: [2, 3, 9] }];
  return Object.assign({ kids, pairs, inc, nc: 4, cap: 36 }, extra);
}

test('案を作る：全員がちょうど1つの組に入り、必ず守る条件と上限を守る', () => {
  const ctx = E.prepare(problem());
  for (const seed of [1, 2, 3]) {
    const asg = E.optimize(ctx, new Map(), seed * 7919);
    assert.deepEqual(E.checkInvariants(ctx, asg), []);
    const a = E.analyze(ctx, asg);
    assert.equal(a.bad.length, 0, a.bad.map(b => b.txt).join(' / '));
    for (let k = 0; k < 4; k++) assert.ok(E.sizeOf(asg, k) <= 36);
    assert.equal(asg[30], 2, '組に固定');
  }
});

test('「必」：その項目の各組の人数を平均±1に収め、外れると違反に数える', () => {
  const gen = E.defaultGen(); gen.w.k6 = C.MUST; gen.w.area = C.MUST;
  const ctx = E.prepare(problem(), gen);
  const asg = E.optimize(ctx, new Map(), 11);
  const a = E.analyze(ctx, asg);
  assert.equal(a.bad.length, 0, a.bad.map(b => b.txt).join(' / '));
  ctx.MU.forEach(mi => { for (let k = 0; k < 4; k++) assert.ok(Math.abs(a.c[k][mi] - ctx.MEAN[mi]) <= 1, ctx.MET[mi].label); });
  assert.equal(ctx.MU.length, 1 + C.AREAS.length);
});

test('案を作る：固定した児童は動かない', () => {
  const ctx = E.prepare(problem());
  const locked = new Map([[50, 3], [51, 0], [52, 1]]);
  const asg = E.optimize(ctx, locked, 99);
  for (const [i, k] of locked) assert.equal(asg[i], k);
});

test('必ず守る条件を外すと、その条件は計算に入らない', () => {
  const P = problem();
  const gen = E.defaultGen(); gen.hard.far = false;
  const asg = new Int8Array(P.kids.length).fill(0); asg[0] = 1; asg[4] = 1; // 離すを破る
  const onFar = E.prepare({ ...P, pairs: [{ t: 'far', i: 0, j: 4 }] });
  assert.equal(E.hardPairViol(onFar, asg), 1);
  const onlyFar = E.prepare({ ...P, pairs: [{ t: 'far', i: 0, j: 4 }] }, gen);
  assert.equal(E.hardPairViol(onlyFar, asg), 0);
});

test('つける：相手と一緒に動き、少ない側は自動で補って同数で入れ替える', () => {
  const P = problem();
  const ctx = E.prepare(P);
  const asg = E.optimize(ctx, new Map(), 5);
  const a = 10, kb = (asg[a] + 1) % 4;
  const b = [...asg.keys()].find(i => asg[i] === kb && E.nearGroup(ctx, asg, i).length === 1);
  const d = E.buildSwap(ctx, asg, new Set(), a, b);
  const r = E.swapChanges(d);
  assert.equal(r.A.length, 2); assert.equal(r.B.length, 2); assert.equal(r.ex.length, 1);
  const after = Int8Array.from(asg); r.ch.forEach(([i, k]) => { after[i] = k; });
  assert.equal(after[10], after[11], 'つけるの2人は同じ組のまま');
  for (let k = 0; k < 4; k++) assert.equal(E.sizeOf(after, k), E.sizeOf(asg, k), '人数は変わらない');
  const first = r.ex[0]; E.nextCandidate(d);
  assert.notEqual(E.swapChanges(d).ex[0], first, '別の児童に替えられる');
});

test('離す：抵触を見つけ、続けて入れ替える相手は動かなかった側', () => {
  const P = problem();
  const ctx = E.prepare(P);
  const asg = E.optimize(ctx, new Map(), 11);
  const c = [...asg.keys()].find(i => asg[i] === asg[4] && i !== 4 && !ctx.relOf[i].length && E.nearGroup(ctx, asg, i).length === 1 && E.nearGroup(ctx, asg, 0).length === 1);
  const d = E.buildSwap(ctx, asg, new Set(), 0, c);
  const ch = E.swapChanges(d).ch;
  const br = E.farBreaks(ctx, asg, ch);
  assert.equal(br.length, 1);
  assert.deepEqual(E.farTargets(br, ch), [4]);
});

test('固定した児童は入れ替えられない', () => {
  const ctx = E.prepare(problem());
  const asg = E.optimize(ctx, new Map(), 3);
  const b = [...asg.keys()].find(i => asg[i] !== asg[50] && E.nearGroup(ctx, asg, i).length === 1);
  assert.ok(E.buildSwap(ctx, asg, new Set([50]), 50, b).err);
});

test('組の事案数は同じ事案を1件と数える', () => {
  const P = problem();
  const ctx = E.prepare(P);
  const asg = new Int8Array(144).fill(0);
  // 事案3件がすべて1組 → 1組は3件（児童の件数の合計5ではない）
  assert.deepEqual(E.incByClass(ctx, asg), [3, 0, 0, 0]);
  asg[4] = 1; // 事案1の片方だけ2組へ
  assert.deepEqual(E.incByClass(ctx, asg), [3, 1, 0, 0]);
});

test('事案数の重みは既定で0（計算に入らない）。上げると入る', () => {
  const P = problem();
  const asg = new Int8Array(144).fill(0);
  const s0 = E.score(E.prepare(P), asg);
  const gen = E.defaultGen(); gen.w.inc = 3;
  assert.ok(E.score(E.prepare(P, gen), asg) > s0);
});

test('案の名前：既定は「標準」、重みを上げた項目と固定・外した条件が入る', () => {
  const gen = E.defaultGen();
  assert.equal(E.autoName(gen, 0), '標準');
  gen.w.k3 = 3; gen.w.k4 = 3; gen.w.k2 = 3;
  assert.equal(E.autoName(gen, 0), '欠・問の分散重視');
  gen.hard.far = false;
  assert.equal(E.autoName(gen, 5), '欠・問の分散重視・離すを外す・固定5人');
});

test('組の番号の付け替えは「違い」に数えない', () => {
  const ctx = E.prepare(problem());
  const a = E.optimize(ctx, new Map(), 1);
  const b = Int8Array.from(a, k => (k + 1) % 4);
  assert.equal(E.diffCount(ctx, a, b), 0);
});

test('決定：新しい番号は組ごとの男女混合の五十音順で、値は写される', () => {
  const kids = [
    { id: '1', kana: 'わたなべ', a: { k1: 2 } }, { id: '2', kana: 'あべ', a: {} },
    { id: '3', kana: 'いとう', a: { k3: 1 } }, { id: '4', kana: 'アベ', a: {} }
  ];
  const rows = E.nextYearRows(kids, [0, 0, 1, 0], 2);
  assert.deepEqual(rows.map(r => [r.cls, r.no]), [[0, 3], [0, 1], [1, 1], [0, 2]]);
  assert.equal(rows[0].a.k1, 2); assert.equal(rows[2].a.k3, 1); assert.equal(rows[1].a.k1, 0);
});

test('Platform（見本）：決定で次の年度の名簿ができ、取り消すと消える', async () => {
  const b = await PF.boot(4);
  const cur = b.years.find(y => y.fy === b.fy).rows;
  const assign = {}; cur.forEach((r, i) => { assign[r.id] = i % 4; });
  assert.ok(b.transfers.length, '4年の見本には転入生がいる');
  await assert.rejects(PF.decide(4, { name: '案A', assign }), /組の決まっていない/, '転入生の組が無ければ決定しない');
  b.transfers.forEach((t, i) => { assign[t.id] = i % 4; });
  await PF.decide(4, { name: '案A', assign });
  const b2 = await PF.boot(4);
  const next = b2.years.find(y => y.fy === b.fy + 1);
  assert.equal(next.rows.length, cur.length + b.transfers.length, '転入生も来年度の名簿に入る');
  assert.equal(next.grade, 5);
  assert.ok(b2.decision);
  await PF.undoDecide(4);
  const b3 = await PF.boot(4);
  assert.equal(b3.years.find(y => y.fy === b.fy + 1), undefined);
  await assert.rejects(PF.decide(6, { name: 'x', assign: {} }));
});

test('年度の境目は4/1', () => {
  assert.equal(C.fiscalYear(new Date(2027, 2, 31)), 2026);
  assert.equal(C.fiscalYear(new Date(2027, 3, 1)), 2027);
  assert.equal(C.fiscalYearOfIso('2027-03-31'), 2026);
  assert.equal(C.fiscalYearOfIso('2027-04-01'), 2027);
});

test('Platform（見本）：名簿の取り込み・つける離すの保存・持ち越しの候補', async () => {
  const r = await PF.importRoster(PF.fiscalYear, 2, [{ id: '99999999', name: '転入', kana: 'てんにゅう', male: true, cls: 0, no: 40 }]);
  assert.equal(r.added, 1);
  assert.ok(r.missing.length > 0);
  const b = await PF.boot(2);
  assert.ok(b.years.find(y => y.fy === PF.fiscalYear).rows.some(x => x.id === '99999999'));
  assert.equal(b.carry.length, 3);
  await PF.savePairs(2, [{ t: b.carry[0].t, a: b.carry[0].a, b: b.carry[0].b }]);
  assert.equal((await PF.boot(2)).carry.length, 2, '採用した候補は出ない');
});

test('＋＋は＋2つ分ではない：＋＋の児童は各組の上限（均等割の切り上げ）を超えない', () => {
  const P = problem();
  // ＋＋を旧1組に寄せて置く（何もしなければ偏る）
  P.kids.forEach((s, i) => { ['k1', 'k2', 'k3', 'k4'].forEach(k => { s.a[k] = Math.min(s.a[k], 1); }); if (i % 4 === 0 && i < 40) s.a.k3 = 2; });
  const ctx = E.prepare(P);
  const asg = E.optimize(ctx, new Map(), 5);
  const a = E.analyze(ctx, asg);
  assert.equal(a.bad.filter(b => b.t === 'heavy').length, 0);
  const hm = ctx.MET.findIndex(m => m.k === 'heavy');
  assert.ok(a.c.every(r => r[hm] <= 3)); // 10人÷4組→各組3人まで
  // 1人で1組に4人入れると違反として出る
  const bad = new Int8Array(asg); P.kids.forEach((s, i) => { if (s.a.k3 === 2) bad[i] = 0; });
  assert.ok(E.analyze(ctx, bad).bad.some(b => b.t === 'heavy'));
});

test('関係図：矢印から役割と型を決める（付箋の①〜④）', () => {
  const N = ids => ids.map((id, i) => ({ id, x: i * 50, y: 0 }));
  // ① 山田→田中
  let d = { nodes: N(['田中', '山田']), edges: [{ f: 'k:山田', t: 'k:田中' }] };
  assert.deepEqual(E.diagramRoles(d), { 田中: 'victim', 山田: 'harm' });
  assert.equal(E.diagramPattern(d), '一方的加害（個人）');
  // ② グループA⇄グループB
  d = { nodes: N(['山田', '林田', '水田', '田中', '上田']), groups: [{ g: 'A', members: ['山田', '林田', '水田'] }, { g: 'B', members: ['田中', '上田'] }], edges: [{ f: 'g:A', t: 'g:B' }, { f: 'g:B', t: 'g:A' }] };
  assert.equal(E.diagramRoles(d).上田, 'mutual');
  assert.equal(E.diagramPattern(d), '相互加害（グループ）');
  // ③ 山田→田中・山田→水田（矢印が複数）
  d = { nodes: N(['田中', '山田', '水田']), edges: [{ f: 'k:山田', t: 'k:田中' }, { f: 'k:山田', t: 'k:水田' }] };
  assert.equal(E.diagramPattern(d), '一方的加害（複線）');
  // ④ グループC→上田、グループA→上田
  d = { nodes: N(['野原', '田野', '田中', '山田', '上田']), groups: [{ g: 'C', members: ['野原', '田野'] }, { g: 'A', members: ['田中', '山田'] }], edges: [{ f: 'g:C', t: 'k:上田' }, { f: 'g:A', t: 'k:上田' }] };
  assert.equal(E.diagramPattern(d), '一方的加害（グループ・複線）');
  // 矢印の無い児童は関係者。壊れた参照・自分への矢印・重複は捨てる
  d = E.normDiagram({ nodes: N(['a', 'b', 'c']), groups: [{ g: 'X', members: ['a', 'zz'] }], edges: [{ f: 'k:a', t: 'k:a' }, { f: 'k:a', t: 'k:b' }, { f: 'k:a', t: 'k:b' }, { f: 'g:Q', t: 'k:b' }] });
  assert.equal(d.edges.length, 1); assert.deepEqual(d.groups[0].members, ['a']);
  assert.equal(E.diagramRoles(d).c, 'related');
});

test('報告書：様式のセルの値（被害・加害・態様・時系列）と、加害が7人以上の時の人数', () => {
  const kids = { v: { grade: 4, cls: 2, male: false, name: '被害 花', kana: 'ひがい はな' } };
  for (let i = 0; i < 8; i++) kids['h' + i] = { grade: 4, cls: 1, male: i < 5, name: '加害' + i, kana: 'かがい' + i };
  const inc = { date: '2026-05-07', report: { found: C.FOUND_LIST[0], modes: [true, false, false, false, false, false, false, false, false, true], other: '靴を隠す',
    s1: { hk: [{ d: '2026-05-08', p: '放課後', t: 'B' }], kk: [{ d: '2026-05-08', p: '朝休み', t: 'A' }], sd: [{ d: '', p: '', t: 'C' }] }, s2: { sd: [{ d: '2026-05-11', p: '放課後', t: '聴き取り' }], vi: [], ha: [{ d: '2026-05-12', p: '', t: '反省' }], kikan: '' } } };
  const o = { school: '高木北小', kid: id => kids[id], victim: 'v', harms: Object.keys(kids).filter(k => k !== 'v') };
  const c = RP.cells('f1', inc, o);
  assert.equal(c.B4, '高木北小'); assert.equal(c.C5, 8); assert.equal(c.E5, 5); assert.equal(c.G5, 7); assert.equal(c.I5, '(木)');
  assert.equal(c.G6, '女'); assert.equal(c.I7, '被害花', '名前の姓と名の間の空白は消す'); assert.equal(c.I19, '加害5');
  assert.match(c.B20, /男子（　0　）名、女子（　2　）名.*全体計（　8　）名/);
  assert.equal(c.B22, '○'); assert.equal(c.I26, '○'); assert.equal(c.K26, '靴を隠す'); assert.equal(c.H22, undefined);
  assert.equal(c.B27, '5月8日（金）放課後、B。\n5月8日（金）朝休み、A。\nC。', '欄ごと（発覚・経緯・指導）に改行で区切り、終わりに句点を足す');
  assert.equal(RP.cells('light', inc, o).B27, undefined, '簡易報告書に概要の欄は無い');
  const c2 = RP.cells('f2', inc, o);
  assert.equal(c2.B8, '5月11日（月）放課後、聴き取り。'); assert.equal(c2.B26, undefined); assert.match(c2.B32, /^（加害児童生徒及び保護者）\n5月12日（火）、反省。$/);
  assert.equal(RP.lines([{ d: '2026-05-08', p: '昼休み', t: 'b' }, { d: '2026-05-08', p: '朝休み', t: 'a。 ' }, { d: '2026-05-09', p: '', t: 'c\n\n d' }]), '5月8日（金）朝休み、a。昼休み、b。\n5月9日（土）、c\nd。', '同じ日は1行につなぎ、日付が変わったら改行。空の行と句点の後の空白を消す');
  const multi = { date: '2026-05-07', report: { s2: { vi: [{ d: '2026-05-12', t: '全体' }] }, s2v: { v: [{ d: '2026-05-12', t: 'Aの様子' }] } } };
  assert.match(RP.cells('f2', multi, { kid: id => kids[id], victim: 'v' }).B26, /Aの様子/, '被害の児童ごとの様子を、その児童の様式に書く');
  assert.match(RP.cells('f2', multi, { kid: id => kids[id], victim: 'h0' }).B26, /全体/, 'その児童の欄が無ければ共通の欄');
  assert.equal(c2.I9, undefined, '様式Ⅱに加害の欄は無い');
  assert.equal(RP.cells('f1', { date: '2019-05-01', report: {} }, { kid: () => null }).C5, '元');
  Object.keys(c).forEach(r => assert.ok(RP.allowedCells('f1').includes(r), r));
});

test('報告書：シートの XML に値を書く（既存のセル・無いセル・無い行。書式は残す）', () => {
  const xml = '<worksheet><sheetData><row r="4"><c r="A4" s="3" t="s"><v>0</v></c><c r="C4" s="5"/></row><row r="9"><c r="B9" s="2"/></row></sheetData></worksheet>';
  const out = RP.fillSheet(xml, { C4: '高木北小', B4: 'x<&>', B9: 4, D6: '改行\nあり' });
  assert.match(out, /<c r="A4" s="3" t="s"><v>0<\/v><\/c><c r="B4" t="inlineStr"><is><t xml:space="preserve">x&lt;&amp;&gt;<\/t><\/is><\/c><c r="C4" s="5" t="inlineStr">/);
  assert.match(out, /<c r="B9" s="2"><v>4<\/v><\/c>/);
  assert.match(out, /改行&#10;あり/, '改行は文字参照で書く');
  assert.ok(out.indexOf('<row r="6">') > out.indexOf('<row r="4"') && out.indexOf('<row r="6">') < out.indexOf('<row r="9"'), '行は番号の順に差し込む');
  const wb = '<workbook><bookViews><workbookView xWindow="0" activeTab="3"/></bookViews><sheets><sheet name="簡易報告書" sheetId="2" r:id="rId2"/><sheet name="様式Ⅰ" sheetId="4" r:id="rId4"/></sheets></workbook>';
  const rels = '<Relationships><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId4" Type="x" Target="worksheets/sheet4.xml"/></Relationships>';
  assert.equal(RP.sheetPath(wb, rels, '様式Ⅰ'), 'xl/worksheets/sheet4.xml');
  assert.match(RP.activate(wb, '様式Ⅰ'), /<workbookView xWindow="0" activeTab="1"\/>/);
});

test('時間帯：授業と授業の間を選べ、足す行は次の時間帯（放課後の次は次の登校日の朝）', () => {
  const L = RP.slots();
  assert.ok(L.indexOf('1校時後') === L.indexOf('1校時') + 1 && L.indexOf('2校時') === L.indexOf('1校時') + 2);
  assert.ok(L.indexOf('2校時後') < 0, '2校時と3校時の間は中休み');
  assert.deepEqual(RP.nextSlot('2026-10-16', '昼休み'), { d: '2026-10-16', p: L[L.indexOf('昼休み') + 1] });
  assert.deepEqual(RP.nextSlot('2026-10-16', '放課後'), { d: '2026-10-19', p: '朝休み' }, '金曜の放課後の次は月曜の朝');
  assert.equal(RP.lines([{ d: '2026-10-16', p: '2校時', t: 'b' }, { d: '2026-10-16', p: '1校時後', t: 'a' }]), '10月16日（金）1校時後、a。2校時、b。');
});

test('報告書：文の中の名前は空白を消し、最初に出る所に学年・組（全員同じ学年なら組だけ）', () => {
  const K = { a: { grade: 6, cls: 2, male: true, name: '田中 ハト' }, b: { grade: 6, cls: 1, male: false, name: '山田 イヌ' } };
  const inc = { date: '2026-05-07', report: { s1: { hk: [{ d: '2026-05-08', p: '朝休み', t: '田中 ハトが山田 イヌに悪口を言った。' }], kk: [{ d: '2026-05-08', p: '昼休み', t: '田中ハトは謝った' }], sd: [] } } };
  const o = { kid: id => K[id], victim: 'b', harms: ['a'] };
  assert.equal(RP.cells('f1', inc, { ...o, people: [K.a, K.b] }).B27, '5月8日（金）朝休み、田中ハト(2組)が山田イヌ(1組)に悪口を言った。\n5月8日（金）昼休み、田中ハトは謝った。');
  assert.match(RP.cells('f1', inc, { ...o, people: [K.a, { ...K.b, grade: 5 }] }).B27, /田中ハト\(6年2組\)が山田イヌ\(5年1組\)/);
});

test('祝日：土日・祝日（振替休日・国民の休日を含む）を飛ばして次の登校日にする', () => {
  for (const d of ['2026-01-12', '2026-03-20', '2026-05-06', '2026-09-22', '2026-10-12', '2025-11-24']) assert.ok(RP.isHoliday(d), d);
  assert.ok(!RP.isHoliday('2026-10-16'));
  assert.equal(RP.nextSchoolDay('2026-10-09'), '2026-10-13', '金曜の次は、スポーツの日（月）を飛ばして火曜');
  assert.equal(RP.nextSchoolDay('2026-05-01'), '2026-05-07', '連休を飛ばす');
  assert.deepEqual(RP.nextSlot('2026-09-18', '放課後'), { d: '2026-09-24', p: '朝休み' }, 'シルバーウィークを飛ばす');
});

test('関係図の整理：同じ矢印の児童をまとめ、ほぼ水平の線を揃え、縦の空きを詰める', () => {
  const d = E.tidyDiagram({ nodes: [{ id: 'a', x: 100, y: 60 }, { id: 'b', x: 400, y: 70 }, { id: 'c', x: 400, y: 300 }, { id: 'd', x: 100, y: 300 }], edges: [{ f: 'k:a', t: 'k:b' }, { f: 'k:a', t: 'k:c' }] });
  assert.equal(d.groups.length, 1); assert.deepEqual(d.groups[0].members.sort(), ['b', 'c']);
  assert.deepEqual(d.edges, [{ f: 'k:a', t: 'g:' + d.groups[0].g }]);
  const y = Object.fromEntries(d.nodes.map(n => [n.id, n.y]));
  assert.ok(Math.max(...Object.values(y)) <= 220, '縦の空きを詰める');
  const e2 = E.tidyDiagram({ nodes: [{ id: 'a', x: 100, y: 60 }, { id: 'b', x: 400, y: 80 }, { id: 'c', x: 250, y: 250 }], edges: [{ f: 'k:a', t: 'k:b' }, { f: 'k:b', t: 'k:c' }] });
  const n2 = Object.fromEntries(e2.nodes.map(n => [n.id, n]));
  assert.equal(n2.a.y, n2.b.y, 'ほぼ水平の線は水平に'); assert.notEqual(n2.c.x, n2.b.x, 'はっきり斜めの線は残す');
});

test('関係図の整理：矢印の交差・別の児童を通る線を無くす', () => {
  // a→c が b を通る（一列）
  const d1 = E.tidyDiagram({ nodes: [{ id: 'a', x: 100, y: 100 }, { id: 'b', x: 300, y: 100 }, { id: 'c', x: 500, y: 100 }], edges: [{ f: 'k:a', t: 'k:c' }, { f: 'k:a', t: 'k:b' }] });
  assert.equal(E.diagramProblems(d1), 0);
  // a→d と b→c が交差する
  const d2 = E.tidyDiagram({ nodes: [{ id: 'a', x: 100, y: 60 }, { id: 'b', x: 100, y: 250 }, { id: 'c', x: 500, y: 60 }, { id: 'd', x: 500, y: 250 }], edges: [{ f: 'k:a', t: 'k:d' }, { f: 'k:b', t: 'k:c' }] });
  assert.equal(E.diagramProblems(d2), 0);
});

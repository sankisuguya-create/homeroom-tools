// 名簿の貼り付けの読み取り（src/paste.js）。  node --test apps/class-split/tests/paste.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

vm.runInThisContext(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'paste.js'), 'utf8'));
const { parseRoster } = globalThis.Paste;

test('見出しの名前で列を読む（順番が違っても、言い換えでも）', () => {
  const r = parseRoster('氏名\t男女\t児童ID\t出席番号\tふりがな\n山田 太郎\t男\t20250001\t1\tやまだ たろう\n佐藤 花\t女\t20250002\t2\tさとう はな', 0);
  assert.equal(r.header, true);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.rows.map(x => [x.id, x.name, x.sex, x.no, x.kana, x.cls]), [['20250001', '山田 太郎', '男', 1, 'やまだ たろう', 0], ['20250002', '佐藤 花', '女', 2, 'さとう はな', 0]]);
  assert.deepEqual(r.counts, { m: 1, f: 1 });
});

test('見出しが無ければ値の形から推定する（メールの形の児童ID、全角の数字、組の列）', () => {
  const r = parseRoster('20250001@kyoiku.edu.nishi.or.jp\t山田 太郎\tやまだ たろう\t男\t２\t１\n20250002@kyoiku.edu.nishi.or.jp\t佐藤 花\tさとう はな\t女\t2\t2', 0);
  assert.equal(r.header, false);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.roles, ['id', 'name', 'kana', 'sex', 'cls', 'no']);
  assert.deepEqual(r.rows.map(x => [x.id, x.cls, x.no]), [['20250001', 1, 1], ['20250002', 1, 2]]);
});

test('誤りを行ごとに示す（IDの桁・重複・性別）。名前の無い行は読み飛ばして数える', () => {
  const r = parseRoster('児童ID\t名前\t性別\n2025#001\tA\t男\n20250001\tB\t男\n20250001\tC\t女\n20250002\t\t女\n20250003\tD\t?', 0);
  assert.equal(r.rows.length, 2);
  assert.equal(r.errors.length, 3); assert.equal(r.skipped.blank, 1);
  assert.match(r.errors[0], /2行目.*児童ID/);
  assert.match(r.errors[1], /4行目.*重複/);
});

test('番号の列が無ければ貼った順に振る。名前の列が無ければ取り込めない', () => {
  const r = parseRoster('児童ID\t名前\n20250001\tA\n20250002\tB', 2);
  assert.deepEqual(r.rows.map(x => [x.cls, x.no]), [[2, 1], [2, 2]]);
  assert.match(parseRoster('児童ID\t性別\n20250001\t男', 0).errors[0], /名前の列/);
});

test('新1年（tempId）：児童IDの列が無くても・空でも読める。8桁でない番号は誤り', () => {
  const r = parseRoster('名前\tよみ\t性別\n入学 ハナ\tにゅうがく はな\t女\n入学 タロウ\tにゅうがく たろう\t男', 0, { tempId: true });
  assert.deepEqual(r.errors, []); assert.equal(r.rows.length, 2); assert.equal(r.rows[0].id, '');
  assert.ok(parseRoster('名前\tよみ\t性別\n入学 ハナ\tにゅうがく はな\t女', 0).errors.length > 0, '新1年以外は児童IDの列が要る');
  const m = parseRoster('児童ID\t名前\t性別\n\t入学 ハナ\t女\n30000001\t入学 タロウ\t男\n12#3\t入学 ジロウ\t男', 0, { tempId: true });
  assert.equal(m.rows.length, 2); assert.equal(m.errors.length, 1, '空は許し、読めない番号だけ誤り');
});

// 校務システムの書き出し（添付の生徒情報.xls の見出し35列。値は架空）
const KOUMU_HEAD = '生徒管理コード\t生徒コード\t学年\t組\t番号\t指導要録番号\t特別支援学級\t特別支援学級番号\t姓\t名\t姓ふりがな\t名ふりがな\t正式姓\t正式名\t正式姓ふりがな\t正式名ふりがな\t名前\tふりがな\t正式名前\t正式名前ふりがな\t性別\t生年月日\t外国籍\t郵便番号\t都道府県\t市区町村\t町番地\tアパート/マンション名\t電話番号1\t電話番号2\t電話番号3\tFAX番号\t緊急下校先\t兄弟1\t兄弟2';
const krow = o => [o.mg || '1', o.id || '', o.g, o.c, o.n, '99', '', '', o.sei || '', o.mei || '', o.seiK || '', o.meiK || '', '', '', '', '', o.name || '', o.kana || '', o.fname || '', '', o.sex, '2018/04/02', '', '000-0000', '県', '市', '1-1', '', '000-000-0000', '', '', '', '祖母宅', '"兄 3年\n山田 一郎"', ''].join('\t');
test('校務システムの書き出し：見出しで読み、名前は空なら姓＋名・正式名前から組み立てる。不要な列は使わない', () => {
  const text = [KOUMU_HEAD,
    krow({ id: '30000001', g: '3', c: '1', n: '1', sei: '山田', mei: '太郎', seiK: 'やまだ', meiK: 'たろう', sex: '男' }),
    krow({ id: '30000002', g: '3', c: '2', n: '1', name: '佐藤 花', kana: 'さとう はな', sex: '女' }),
    krow({ id: '30000003', g: '3', c: '1', n: '2', fname: '鈴木 次郎', sex: '男' }),
    krow({ id: '40000001', g: '4', c: '1', n: '1', name: '別学年 子', sex: '女' }),
    krow({ id: '', g: '3', c: '', n: '', sex: '' })].join('\n');
  const r = parseRoster(text, 0, { grade: 3 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.rows.map(x => [x.id, x.name, x.kana, x.cls, x.no]), [['30000001', '山田 太郎', 'やまだ たろう', 0, 1], ['30000002', '佐藤 花', 'さとう はな', 1, 1], ['30000003', '鈴木 次郎', '', 0, 2]]);
  assert.equal(r.skipped.grade, 1, 'ほかの学年の行は読み飛ばす'); assert.equal(r.skipped.blank, 1, '名前の無い行も読み飛ばす');
  const used = r.roles.filter(Boolean);
  assert.ok(used.includes('grade') && used.includes('sei') && used.includes('town'), '学年・姓・住所の列を読む');
  assert.equal(r.rows[0].addr, '県市1-1', '住所は都道府県＋市区町村＋町番地');
  assert.ok(!JSON.stringify(r.rows).includes('祖母宅') && !JSON.stringify(r.rows).includes('000-000') && !JSON.stringify(r.rows).includes('2018/04/02'), '電話・緊急下校先・生年月日は入らない');
});
test('セルの中の改行（Excel の "…"）で行が割れない', () => {
  const r = parseRoster('児童ID\t名前\t備考\n30000001\t"山田\n太郎"\t"a""b"\n30000002\t佐藤 花\tx', 0);
  assert.deepEqual(r.errors, []); assert.deepEqual(r.rows.map(x => x.name), ['山田 太郎', '佐藤 花']);
});
test('組の列が数字でない児童は特別支援学級（交流級は未定＝cls -1）', () => {
  const r = parseRoster('児童ID\t名前\t組\t番号\n30000001\tA\t1\t1\n30000002\tB\tひまわり\t1\n30000003\tC\t２組\t2', 0);
  assert.deepEqual(r.errors, []); assert.equal(r.sp, 1);
  assert.deepEqual(r.rows.map(x => [x.cls, x.sp || '']), [[0, ''], [-1, 'ひまわり'], [1, '']]);
});

test('児童IDは8桁に限らない（英数字20文字まで。メールなら @ の前）', () => {
  const r = parseRoster('児童ID\t名前\n1234\tA\nAB-12345\tB\nst0099@kyoiku.edu.nishi.or.jp\tC\nＸ１２\tD\n12 34\tE', 0);
  assert.deepEqual(r.rows.map(x => x.id), ['1234', 'AB-12345', 'st0099', 'X12']);
  assert.equal(r.errors.length, 1, '空白を含む番号は読めない');
});

test('住所：「住所」1列でも、4列（都道府県・市区町村・町番地・建物名）でも読む。町名は町番地から', () => {
  const a = parseRoster('児童ID\t名前\t都道府県\t市区町村\t町番地\tアパート/マンション名\n1001\tA\t大阪府\t西市\t中央三丁目5-2\tメゾン101\n1002\tB\t大阪府\t西市\t北町12\t\n1003\tC\t\t\t\t', 0);
  assert.deepEqual(a.rows.map(x => [x.addr || '', x.area || '']), [['大阪府西市中央三丁目5-2 メゾン101', '中央'], ['大阪府西市北町12', '北町'], ['', '']]);
  const b = parseRoster('児童ID\t名前\t住所\n1001\tA\t西市中央1-2', 0);
  assert.equal(b.rows[0].addr, '西市中央1-2');
});

test('校務システム：生徒コードが空なら生徒管理コードを児童IDに使う。読めない時は値を示す', () => {
  const r = parseRoster('生徒管理コード\t生徒コード\t学年\t名前\n100234\t\t4\tA\n100235\t\t4\tB\n1 00236\t\t4\tC', 0, { grade: 4 });
  assert.deepEqual(r.rows.map(x => x.id), ['100234', '100235']);
  assert.match(r.errors[0], /「1 00236」/);
  const e = parseRoster('児童ID\t名前\n\tA', 0);
  assert.match(e.errors[0], /空欄/);
});

test('兄弟：「学年-組-番号 名前」を兄弟1・兄弟2…の列から読み、続柄は学年と表の中の性別で決める', () => {
  const t = ['学年\t組\t番号\t名前\t性別\t兄弟1\t兄弟2\t兄弟3',
    '3\t1\t1\t会田 ひろ\t男\t5-1-1 会田さとる\t1-2-3 会田はな\t６－２－４ 会田ゆう',
    '5\t1\t1\t会田 さとる\t男\t3-1-1 会田ひろ\t\t',
    '1\t2\t3\t会田 はな\t女\t\t\t'].join('\n');
  const r = parseRoster(t, 0, { grade: 3, tempId: true });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.rows[0].sib.map(x => [x.r, x.g, x.cls, x.no, x.n]), [['兄', 5, 1, 1, '会田さとる'], ['妹', 1, 2, 3, '会田はな'], ['?', 6, 2, 4, '会田ゆう']]);
  assert.ok(r.roles.includes('sib'));
});

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

test('誤りを行ごとに示す（IDの桁・重複・名前の空・性別）', () => {
  const r = parseRoster('児童ID\t名前\t性別\n2025001\tA\t男\n20250001\tB\t男\n20250001\tC\t女\n20250002\t\t女\n20250003\tD\t?', 0);
  assert.equal(r.rows.length, 2);
  assert.equal(r.errors.length, 4);
  assert.match(r.errors[0], /2行目.*8桁/);
  assert.match(r.errors[1], /4行目.*重複/);
});

test('番号の列が無ければ貼った順に振る。名前の列が無ければ取り込めない', () => {
  const r = parseRoster('児童ID\t名前\n20250001\tA\n20250002\tB', 2);
  assert.deepEqual(r.rows.map(x => [x.cls, x.no]), [[2, 1], [2, 2]]);
  assert.match(parseRoster('児童ID\t性別\n20250001\t男', 0).errors[0], /名前の列/);
});

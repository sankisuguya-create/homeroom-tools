const assert = require('assert');
const I = require('../src/importer.js');
const roster = [
  { id: 1, name: 'あおき はると' }, { id: 2, name: 'いとう さくら' }, { id: 3, name: 'うえだ そう' },
  { id: 4, name: 'えんどう ゆい' }, { id: 5, name: 'おおた れん' }, { id: 6, name: 'おおた ひな' }
];

// セルの分解
assert.deepStrictEqual(I.splitCell('3 うえだ'), { num: 3, name: 'うえだ' });
assert.deepStrictEqual(I.splitCell('３\nうえだ'), { num: 3, name: 'うえだ' });
assert.deepStrictEqual(I.splitCell('うえだ（3）'), { num: 3, name: 'うえだ' });
assert.deepStrictEqual(I.splitCell('12番'), { num: 12, name: '' });
assert.deepStrictEqual(I.splitCell('あおき'), { num: null, name: 'あおき' });

// 児童から見た向き（黒板が上）、書き方が混ざった表
{
  const v = [
    ['', '黒板', '', ''],
    ['1', 'いとう　さくら', '', '3 うえだ'],
    ['えんどうさん', 'おおた', '', '（空席）'],
    ['れん', '99', '', 'だれか']
  ];
  const r = I.parse(v, roster, {});
  assert.strictEqual(r.flip, false);
  const ids = r.entries.map(e => e.id).sort();
  assert.deepStrictEqual(ids, [1, 2, 3, 4, 5]);           // 「れん」は部分一致で 5番
  const e1 = r.entries.find(e => e.id === 1);
  assert.deepStrictEqual([e1.r, e1.c], [2, 1]);            // 座席の左上＝配置の起点（2行目・A列）
  assert.ok(r.problems.some(p => p.raw === 'おおた' && p.note.includes('2 人')));
  assert.ok(r.problems.some(p => p.raw === '99' && p.note.includes('名簿にいない')));
  assert.ok(r.problems.some(p => p.raw === 'だれか'));
  assert.ok(r.labels.some(l => l.raw === '（空席）'));
  assert.deepStrictEqual(r.missing.map(p => p.id), [6]);
}

// 教卓側から見た向き（前の見出しが下）→ 上下左右を反転
{
  const v = [['1', '2'], ['3', '4'], ['教卓（前）', '']];
  const r = I.parse(v, roster, {});
  assert.strictEqual(r.flip, true);
  const e4 = r.entries.find(e => e.id === 4);
  assert.deepStrictEqual([e4.r, e4.c], [2, 1]);            // 右下 → 左上（前列・左）
  assert.strictEqual(I.parse(v, roster, { flip: false }).flip, false);
}

// 番号と名前が食い違う・重複・2つ並んだ表
{
  const r = I.parse([['2 うえだ', '2']], roster, {});
  assert.ok(r.problems[0].note.includes('合わない'));
  assert.ok(r.problems[1].note.includes('2か所'));
  const two = I.parse([['1', '2', '', '4', '3'], ['3', '4', '', '2', '1']], roster, {});
  assert.strictEqual(two.twoBlocks, true);
}

// 手で直した対応
{
  const r = I.parse([['おおた', 'だれか', '4']], roster, { overrides: { '0,0': 6, '0,1': 'skip' } });
  assert.deepStrictEqual(r.entries.map(e => e.id), [6, 4]);
  assert.strictEqual(r.problems.length, 0);
  assert.ok(r.cells[0].manual);
}

// 切り出し
assert.deepStrictEqual(I.trim([['', '', ''], ['', 'a', ''], ['', '', 'b'], ['', '', '']]), [['a', ''], ['', 'b']]);
console.log('importer: ok');

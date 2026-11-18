// 組分けの計算のテスト。 node --test apps/group-maker/tests/core.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('../src/core.js');
const seq = n => Array.from({ length: n }, (_, i) => 's' + i);
function rng(seed) { return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648; }

test('人数：割り切れない分は多い組に回し、指定より少ない組は作らない', () => {
  assert.deepEqual(C.sizes(31, 4), [5, 5, 5, 4, 4, 4, 4]);
  assert.deepEqual(C.sizes(32, 4), Array(8).fill(4));
  assert.deepEqual(C.sizes(7, 2), [3, 2, 2]);
  assert.deepEqual(C.sizes(31, 30), [31]);
  assert.deepEqual(C.sizes(20, 30), [20]);
  for (let n = 1; n <= 45; n++) for (let k = 2; k <= 30; k++) {
    const s = C.sizes(n, k);
    assert.equal(s.reduce((a, b) => a + b, 0), n);
    if (n >= k) assert.ok(s.every(x => x >= k), `${n}人${k}人組`);
  }
});
test('全員がちょうど1つの組に入る', () => {
  for (const k of [2, 3, 4, 5, 6, 10, 30]) {
    const r = C.make(seq(33), k, { rand: rng(k) });
    const all = r.groups.flat().sort();
    assert.deepEqual(all, seq(33).sort());
  }
});
test('押すたびに違う案になる', () => {
  const a = JSON.stringify(C.make(seq(30), 4).groups), b = JSON.stringify(C.make(seq(30), 4).groups);
  assert.notEqual(a, b);
});
test('離す組合せは同じ組にしない', () => {
  const apart = [['s0', 's1'], ['s0', 's2'], ['s3', 's4'], ['s5', 's6'], ['s1', 's2']];
  for (let i = 0; i < 50; i++) {
    const r = C.make(seq(30), 4, { apart, rand: rng(i + 1) });
    assert.equal(r.apart, 0);
    r.groups.forEach(g => apart.forEach(([a, b]) => assert.ok(!(g.includes(a) && g.includes(b)))));
  }
});
test('離せない時は数を返す（全員1組）', () => {
  const r = C.make(seq(10), 30, { apart: [['s0', 's1']] });
  assert.equal(r.apart, 1);
});
test('前回と同じ相手をなるべく避ける', () => {
  const prev = C.make(seq(32), 4, { rand: rng(7) }).groups;
  const r = C.make(seq(32), 4, { prev: C.pairsOf(prev), rand: rng(9) });
  assert.equal(r.prev, 0);
});
test('名前の出し方', () => {
  const R = [{ key: 'a', no: 1, name: '佐藤 健太' }, { key: 'b', no: 2, name: '佐藤　美咲' }, { key: 'c', no: 3, name: '鈴木 一郎' }, { key: 'd', no: 4, name: '田中花子' }];
  assert.deepEqual(C.labels(R, 'no'), { a: '1', b: '2', c: '3', d: '4' });
  assert.deepEqual(C.labels(R, 'sei'), { a: '佐藤 健', b: '佐藤 美', c: '鈴木', d: '田中花子' });
  assert.deepEqual(C.labels(R, 'full'), { a: '佐藤 健太', b: '佐藤 美咲', c: '鈴木 一郎', d: '田中花子' });
  assert.equal(C.noSpaceCount(R), 1);
});

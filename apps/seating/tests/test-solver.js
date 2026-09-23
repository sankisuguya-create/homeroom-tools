const assert = require('assert');
const S = require('../src/solver.js');
const { makeInput } = require('./fixture.js');

function seatOf(res, id){ return res.seats.find(s => s.id === id); }
function adjacent(a, b){ return a.r === b.r && Math.abs(a.c - b.c) === 1; }
function touching(a, b){ return Math.abs(a.r - b.r) <= 1 && Math.abs(a.c - b.c) <= 1 && !(a.r === b.r && a.c === b.c); }

// 1. 基本：全員が1席ずつ
{
  const input = makeInput();
  const [res] = S.solve(input, { seed: 1, count: 1 });
  const ids = res.seats.map(s => s.id).filter(x => x != null).sort((a,b)=>a-b);
  assert.deepStrictEqual(ids, Array.from({length:32}, (_, i) => i + 1));
  assert.strictEqual(res.hard, 0);
  // 隣は男女：同性の隣が無いこと（男女同数なので達成可能）
  assert.ok(!res.issues.some(i => i.kind === '男女' && i.text.includes('隣')), res.issues.slice(0,5).map(i=>i.text).join('\n'));
}

// 2. 必須条件：離す・前方・固定・近く
{
  const input = makeInput(inp => {
    inp.students[0].front = true; inp.students[1].front = true;
    inp.students[2].fixed = { r: 7, c: 8, text: '6-6' };
    inp.conditions.push({ a: 4, b: 5, type: '離す', must: true });
    inp.conditions.push({ a: 6, b: 20, type: '近く', must: true });
    for(let k = 7; k <= 12; k++) inp.conditions.push({ a: k, b: k + 1, type: '離す', must: true });
  });
  assert.deepStrictEqual(S.precheck(input), []);
  const res = S.solve(input, { seed: 2, count: 3 });
  assert.strictEqual(res.length, 3);
  res.forEach(r => {
    assert.strictEqual(r.hard, 0, r.issues.filter(i=>i.hard).map(i=>i.text).join('\n'));
    assert.ok(seatOf(r, 1).r <= 3 && seatOf(r, 2).r <= 3);
    assert.deepStrictEqual([seatOf(r, 3).r, seatOf(r, 3).c], [7, 8]);
    const a = seatOf(r, 4), b = seatOf(r, 5);
    assert.ok(!touching(a, b) && a.group !== b.group);
  });
  // 候補どうしが同一でない
  assert.notDeepStrictEqual(res[0].seats.map(s=>s.id), res[1].seats.map(s=>s.id));
}

// 3. 履歴：前回の隣が繰り返されにくい
{
  const input = makeInput();
  const [prev] = S.solve(input, { seed: 3, count: 1 });
  input.history = [prev.seats.filter(s => s.id != null).map(s => ({ id: s.id, r: s.r, c: s.c, group: s.group }))];
  const [next] = S.solve(input, { seed: 4, count: 1 });
  let repeat = 0;
  prev.seats.forEach(a => prev.seats.forEach(b => {
    if(a.id != null && b.id != null && a.id < b.id && adjacent(a, b)){
      if(adjacent(seatOf(next, a.id), seatOf(next, b.id))) repeat++;
    }
  }));
  assert.strictEqual(repeat, 0, '前回と同じ隣が ' + repeat + ' 組');
}

// 4. 事前検査：席不足・固定重複・前方不足
{
  const input = makeInput(inp => {
    inp.seats = inp.seats.slice(0, 30);
    inp.students[0].fixed = { r: 2, c: 1, text: '1-1' };
    inp.students[1].fixed = { r: 2, c: 1, text: '1-1' };
    inp.students.forEach((s, i) => { if(i < 14) s.front = true; });
  });
  const errs = S.precheck(input);
  assert.ok(errs.some(e => e.includes('足りません')));
  assert.ok(errs.some(e => e.includes('重なって')));
  assert.ok(errs.some(e => e.includes('前方')));
}

// 5. 空席あり・班長・配慮
{
  const input = makeInput(inp => {
    inp.students = inp.students.slice(0, 30);
    [1, 5, 9, 13, 17, 21, 25, 29, 30].forEach(i => inp.students[i - 1].leader = true);
    [2, 3, 4].forEach(i => inp.students[i - 1].care = true);
  });
  const [res] = S.solve(input, { seed: 5, count: 1 });
  assert.strictEqual(res.seats.filter(s => s.id == null).length, 6 * 6 - 30);
  assert.ok(!res.issues.some(i => i.kind === 'リーダー' && i.text.includes('いません')), res.issues.map(i=>i.text).join('\n'));
  assert.ok(!res.issues.some(i => i.kind === '配慮'));
}

// 6. evaluate：手で入れ替えた結果の再採点が solve の採点と一致
{
  const input = makeInput(inp => inp.conditions.push({ a: 1, b: 2, type: '離す', must: false }));
  const [res] = S.solve(input, { seed: 6, count: 1 });
  const ids = res.seats.map(s => s.id);
  assert.strictEqual(S.evaluate(input, ids).cost, res.cost);
  const i1 = ids.indexOf(1), i2 = ids.indexOf(2);
  const near = res.seats.findIndex((s, k) => k !== i1 && s.r === res.seats[i1].r && Math.abs(s.c - res.seats[i1].c) === 1);
  const swapped = ids.slice(); [swapped[near], swapped[i2]] = [swapped[i2], swapped[near]];
  const ev = S.evaluate(input, swapped);
  assert.ok(ev.issues.some(i => i.kind === '離す'));
}

console.log('solver: ok');

// 7. 班長候補が班の数より少ないとき「いない班」を数えない
{
  const input = makeInput(inp => { inp.students[0].leader = true; });
  const [res] = S.solve(input, { seed: 7, count: 1, iters: 20000 });
  assert.ok(!res.issues.some(i => i.kind === 'リーダー'));
}
console.log('solver extra: ok');

// 8. 高身長・学習支援役・重視の段階
{
  const input = makeInput(inp => {
    [3, 8, 20].forEach(i => inp.students[i - 1].tall = true);
    for(let i = 1; i <= 9; i++) inp.students[i * 3 - 1].support = true;
  });
  const [res] = S.solve(input, { seed: 8, count: 1 });
  [3, 8, 20].forEach(id => assert.ok(seatOf(res, id).r > 3, id + '番が前方'));
  const groupsWithSupport = new Set(res.seats.filter(s => [3,6,9,12,15,18,21,24,27].includes(s.id)).map(s => s.group));
  assert.strictEqual(groupsWithSupport.size, 9);
}
{
  // 男女を「無視」にすると男女の問題は出ない。「必須」にすると同性の隣が必須違反になる
  const off = makeInput(inp => { inp.settings.weights = { gender: 0 }; });
  const ids = S.solve(off, { seed: 9, count: 1, iters: 5000 })[0].seats.map(s => s.id);
  assert.ok(!S.evaluate(off, ids).issues.some(i => i.kind === '男女'));
  const must = makeInput(inp => { inp.settings.weights = { gender: 4 }; });
  const bad = must.seats.map((_, i) => i < 32 ? i + 1 : null);   // 番号順＝男が固まる
  assert.ok(S.evaluate(must, bad).issues.some(i => i.kind === '男女' && i.hard));
  // 割合で効く項目は必須にできない（強に丸める）
  const m = S.buildModel(makeInput(inp => { inp.settings.weights = { histAdj: 4 }; }));
  assert.strictEqual(m.w.histAdj, S.weights.histAdj * 2.5);
}
// 9. 班なしの座席（○）は班の関係を持たない
{
  const input = makeInput(inp => inp.seats.forEach(s => s.group = ''));
  const [res] = S.solve(input, { seed: 10, count: 1, iters: 5000 });
  assert.ok(!res.issues.some(i => i.text.includes('班')));
}
console.log('solver weights: ok');

// 時間の計算のテスト。 node --test apps/classroom-clock/tests/core.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('../src/core.js');
const M = C.MIN, S = C.SEC;
const at = (h, m, s = 0) => new Date(2026, 10, 12, h, m, s).getTime();

test('残りは切り上げ、0:00 は終わった瞬間だけ', () => {
  assert.equal(C.fmtRemain(59001), '1:00');
  assert.equal(C.fmtRemain(1), '0:01');
  assert.equal(C.fmtRemain(0), '0:00');
});
test('タイマー：止めても時刻の差で残りが合う', () => {
  const t = C.newTimer(5 * M), n = at(9, 0);
  C.timerStart(t, n);
  assert.equal(C.timerLeft(t, n + 2 * M), 3 * M);
  C.timerPause(t, n + 2 * M);
  assert.equal(C.timerLeft(t, n + 10 * M), 3 * M);
  C.timerStart(t, n + 10 * M);
  assert.equal(C.timerLeft(t, n + 11 * M), 2 * M);
});
test('タイマー：終わったあとの＋1分は今から1分', () => {
  const t = C.newTimer(M), n = at(9, 0);
  C.timerStart(t, n);
  C.timerAdd(t, M, n + 90 * S);
  assert.equal(C.timerLeft(t, n + 90 * S), M);
});
test('タイマー：−1分は1分より下へ行かない', () => {
  const t = C.newTimer(90 * S), n = at(9, 0);
  C.timerAdd(t, -M, n);
  assert.equal(C.timerLeft(t, n), M);
});
test('合図：予告・刻み・おわりが1回ずつ', () => {
  const t = C.newTimer(3 * M), n = at(9, 0);
  C.timerStart(t, n);
  const all = [];
  for (let x = n; x < n + 3 * M + 2 * S; x += 100) all.push(...C.events({ timer: t }, x, x + 100));
  assert.equal(all.filter(e => e.type === 'timerWarn').length, 1);
  assert.equal(all.filter(e => e.type === 'tick').length, 10);
  assert.equal(all.filter(e => e.type === 'timerEnd').length, 1);
});
test('合図：スリープ明けに古い合図をまとめて鳴らさない', () => {
  const t = C.newTimer(3 * M), n = at(9, 0);
  C.timerStart(t, n);
  assert.deepEqual(C.events({ timer: t }, n, n + 10 * M), []);
});
test('時間割：授業中・次まで・範囲外', () => {
  const rows = [{ name: '1時間目', s: '08:45', e: '09:30' }, { name: '2時間目', s: '09:35', e: '10:20' }];
  assert.equal(C.schedNow(rows, at(9, 0)).kind, 'in');
  const b = C.schedNow(rows, at(9, 32));
  assert.equal(b.kind, 'before'); assert.equal(b.name, '2時間目');
  assert.equal(C.schedNow(rows, at(7, 0)), null);
  assert.equal(C.schedNow(rows, at(11, 0)), null);
});
test('チャイム：同じ時刻の終わりと始まりは1回', () => {
  const sched = { on: true, chime: true, pattern: 'a', patterns: { a: { rows: [
    { name: '給食', s: '12:15', e: '13:00' }, { name: '昼休み', s: '13:00', e: '13:20' }] } } };
  const ev = C.events({ sched }, at(12, 59, 59.95), at(13, 0, 0.05));
  assert.equal(ev.length, 1);
});
test('アラーム', () => {
  const ev = C.events({ alarms: [{ on: true, hm: '10:25', label: 'かたづけ' }] }, at(10, 24, 59.9), at(10, 25, 0.05));
  assert.equal(ev[0].label, 'かたづけ');
});
test('タイマー：時間を選んでも始まらない', () => {
  const t = C.newTimer(5 * M);
  C.timerPreset(t, 10 * M);
  assert.equal(t.running, false);
  assert.equal(C.timerLeft(t, at(9, 30)), 10 * M);
});

/* Code.gs の純関数（readInput_）を node で動かす。GAS と同じく1スコープに読み込む。 */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const S = require('../src/solver.js');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/Code.gs'), 'utf8'), ctx);

const roster = [['番号','氏名','性別','在籍','前方','固定席','班長','配慮','メモ']];
for(let i = 1; i <= 30; i++) roster.push([i, '児' + i, i % 2 ? '男' : '女', i !== 30, i === 3, '', i % 5 === 1, false, '']);
roster[5][5] = '1-2';                 // 5番：1行目・2席目
roster[6][5] = new Date(2026, 1, 3);  // 6番：Sheets が日付に化かした「2-3」
roster[7][5] = '9-9';                 // 7番：範囲外
roster.push([31, '', '', true, false, '', false, false, '']);
roster.push([2, '重複', '女', true, false, '', false, false, '']);

const layout = [['前（黒板・教卓）','','','','','','','']];
for(let r = 0; r < 6; r++){
  const row = ['', '', '', '', '', '', '', ''];
  [0,1,3,4,6,7].forEach((c, ci) => row[c] = Math.floor(r / 2) * 3 + Math.floor(ci / 2) + 1);
  layout.push(row);
}
layout.push(['数字のセル＝座席（数字は班）。空白＝通路。','','','','','','','']);

const cond = [['児童A','児童B','関係','強さ','メモ'],
  [1, 2, '離す', '必須', ''],
  ['児4', '児8', '近く', 'できれば', ''],
  [1, 30, '離す', '', ''],       // 30 は在籍外
  [1, 1, '離す', '', ''],
  [3, 5, 'となり', '', ''],
  ['', '', '', '', '']];
const settings = [['項目','値','説明'], ['男女','市松',''], ['前方の行数',1,''], ['履歴を見る回数',2,''], ['候補の数',9,'']];
const history = [['決定日時','回','番号','氏名','行','列','班'],
  [new Date(), 1, 1, '児1', 2, 1, '1'], [new Date(), 1, 2, '児2', 2, 2, '1'],
  [new Date(), 2, 1, '児1', 3, 1, '4'], [new Date(), 2, 2, '児2', 3, 2, '4']];

const inp = JSON.parse(JSON.stringify(ctx.readInput_(roster, cond, layout, settings, history)));
assert.strictEqual(inp.seats.length, 36);
assert.strictEqual(inp.students.length, 30);             // 1..29 + 31（30 は在籍外、2 は重複）
assert.ok(inp.problems.some(p => p.includes('番号 2 が重複')));
assert.deepStrictEqual(inp.students.find(s => s.id === 5).fixed, { r: 2, c: 2, text: '1-2' });
assert.deepStrictEqual([inp.students.find(s => s.id === 6).fixed.r, inp.students.find(s => s.id === 6).fixed.c], [3, 4]);
assert.ok(inp.problems.some(p => p.includes('7番') && p.includes('9-9')));
assert.strictEqual(inp.conditions.length, 2);
assert.strictEqual(inp.warnings.length, 3);
assert.deepStrictEqual(inp.settings, { genderMode: '市松', frontRows: 1, historyDepth: 2, count: 5 });
assert.strictEqual(inp.history.length, 2);
assert.strictEqual(inp.history[0][0].r, 3);               // 新しい回が先
assert.strictEqual(inp.nextRound, 3);
assert.strictEqual(inp.students.find(s => s.id === 1).gender, '男');
assert.strictEqual(inp.students.find(s => s.id === 31).gender, '');

// そのまま solver に渡せる（problems を除けば）
const clean = JSON.parse(JSON.stringify(inp)); clean.problems = [];
clean.students.find(s => s.id === 7).fixed = null;
assert.deepStrictEqual(S.precheck(clean), []);
const [res] = S.solve(clean, { seed: 1, count: 1, iters: 20000 });
assert.strictEqual(res.hard, 0);
console.log('code: ok');

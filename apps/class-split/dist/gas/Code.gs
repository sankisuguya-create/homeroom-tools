/* apps/class-split/src/ の config.js・engine.js・server.gs をつないで
   scripts/build.py が作る。正本を直すこと。 */

/* ==================== config.js ==================== */
// 設定の正本。項目の名前・色・形・重み・学級数の上限はここだけで決める。
// 保存データの列は中立のキー（k1〜k9）だけで持ち、名前はここにしか書かない（開示請求への配慮。docs/design.md §4）。
(function (g) {
  'use strict';
  var CONFIG = {
    MAX_CLASSES: 4,   // 1学年の学級数の上限
    CAP: 36,          // 1学級の人数の上限
    NAME_CHARS: 6,    // クラス分けのカードに出す名前の文字数（空白を含む）。全部は名前にカーソルで出る
    MAX_LEVEL: 2,     // 配慮項目の程度：0＝なし、1＝アイコン、2＝アイコン＋。max: 1 の項目（ア・身・通・賢・リ・運）は有無だけ

    // 配慮項目。good=1 は良い要素（カードの1段目・緑）。w は重みの既定段階（0なし〜3強）
    // help：カーソルを合わせると出す説明［見出し, アイコン, アイコン＋］（max: 1 は［見出し, アイコン］）。side：カードの2段目の右（良い項目の下）に置く。負担の項目の＋は「＋2つ分」ではなく、担任の負担が明確に増えることを表す
    ATTRS: [
      { k: 'k1', label: '学力しんどさ', s: '学', c: '#1E6FD9', t: '#FFFFFF', sh: 'square',   w: 2, heavy: 1, max: 2, help: ['学力のしんどさ', '学習の遅れがある。', '遅れが大きい。個別の手立てがいつも要る。'] },
      { k: 'k2', label: '長欠・不登校傾向', s: '欠', c: '#1A1A1A', t: '#FFFFFF', sh: 'circle',   w: 1, heavy: 1, max: 2, help: ['長欠・不登校傾向', '欠席・遅刻・早退が多い。', '長期欠席、または不登校。'] },
      { k: 'k3', label: '問題行動',     s: '問', c: '#D7263D', t: '#FFFFFF', sh: 'burst',    w: 3, heavy: 1, max: 2, help: ['問題行動、トラブル', '多い。', 'とても多い。または深刻。'] },
      { k: 'k4', label: '保護者',       s: '保', c: '#F2C200', t: '#1A1A1A', sh: 'house',    w: 2, heavy: 1, max: 2, help: ['保護者対応', '連絡・相談が多い。', '対応にとても時間がかかる。または関係づくりが難しい。'] },
      { k: 'k5', label: 'アレルギー',   s: 'ア', c: '#7B3FA0', t: '#FFFFFF', sh: 'octagon',  w: 1, max: 1, side: 1, help: ['アレルギー', '配慮の要るアレルギーがある（エピペンの所持を含む）。'] },
      { k: 'k6', label: '身体的配慮',   s: '身', c: '#7B3FA0', t: '#FFFFFF', sh: 'shield',   w: 1, max: 1, side: 1, help: ['身体的配慮', '体や健康の面で配慮が要る。'] },
      { k: 'k10', label: '通級・要支援', s: '通', c: '#7B3FA0', t: '#FFFFFF', sh: 'shell',    w: 2, max: 1, side: 1, help: ['通級・要支援', '通級や支援を受けている。'] },
      { k: 'k7', label: '賢い',         s: 'か', c: '#009E73', t: '#FFFFFF', sh: 'plain',    w: 1, good: 1, max: 1, help: ['賢い', '学力が高い。'] },
      { k: 'k8', label: 'リーダー',     s: 'リ', c: '#009E73', t: '#FFFFFF', sh: 'crown',    w: 2, good: 1, max: 1, help: ['リーダー', 'まとめる力がある。'] },
      { k: 'k9', label: '走力',         s: '走', c: '#009E73', t: '#FFFFFF', sh: 'para',     w: 1, good: 1, max: 1, help: ['走力（走る速さ）', '走るのが速い。'] }
    ],
    // 配慮項目以外の偏りの指標。w は重みの既定段階
    EXTRA: [
      { k: 'sex',  label: '男女',   s: '男女', w: 3 },
      { k: 'old',  label: '旧学級', s: '旧',   w: 2 },
      { k: 'area', label: '地区',   s: '地区', w: 1 },
      { k: 'inc',  label: '事案数', s: '事案', w: 0 }  // 0＝案を作る条件に入れない。設定の枠で上げると入る
    ],
    // 段階 → 計算に使う重み
    LEVEL_W: [0, 1, 2.5, 5],
    LEVEL_NAMES: ['無', '弱', '中', '強'],
    // 必ず守る条件（設定の枠でオン・オフ）
    HARD: [
      { k: 'far',  label: '離す' },
      { k: 'near', label: 'つける' },
      { k: 'fix',  label: '組に固定' },
      { k: 'heavy', label: '負担の＋を組に分ける' }, // heavy の項目の＋は、担任の負担が明確に増える印なので人数で分ける
      { k: 'cap',  label: '人数の上限' },
      { k: 'sex',  label: '男女の差±1' }
    ],
    // 旧学級の色：c＝帯 t＝帯の文字 l＝カードの地。赤1組・黄2組・青3組・緑4組
    CLASS_COLORS: [
      { c: '#D7263D', t: '#FFFFFF', l: '#FCE6E8' },
      { c: '#F2C200', t: '#1A1A1A', l: '#FFF5CC' },
      { c: '#1E6FD9', t: '#FFFFFF', l: '#E3EEFC' },
      { c: '#2E9E4F', t: '#FFFFFF', l: '#E2F3E7' }
    ],
    AREAS: ['東', '西', '南', '北'],
    INCIDENT_TYPES: ['対人', '物損', 'いじめ', 'けが', 'その他'],
    TEACHER_DOMAIN: 'edu.nishi.or.jp'
  };

  // 年度の境目は4/1。年度に関わる値はすべてこの関数から出す（principles/roster-year-transition.md §1）
  CONFIG.fiscalYear = function (date) {
    var d = date || new Date();
    return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  };
  CONFIG.fiscalYearOfIso = function (iso) {
    var p = String(iso).split('-');
    var y = +p[0], m = +p[1];
    return m >= 4 ? y : y - 1;
  };

  g.CONFIG = CONFIG;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ==================== engine.js ==================== */
// 計算の正本。画面にもサーバーにも依存しない純粋な関数だけを置く（tests/engine.test.mjs が直接読む）。
// 用語: asg＝案の割り当て（児童の並び順 i → 新しい組 0..nc-1）。kids[i].old＝旧学級（0始まり）。
(function (g) {
  'use strict';
  var C = g.CONFIG;
  var W_HARD = 1000;   // 必ず守る条件1件あたり
  var W_SIZE = 40;     // 人数の偏り（常に効く）
  var W_CAP = 1e5;     // 上限超え1人あたり（必ず守る条件がオンのとき）

  function rngOf(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // 案を作る設定の既定値。重みは段階（0〜3）、必ず守る条件は真偽
  function defaultGen() {
    var w = {};
    C.ATTRS.forEach(function (at) { w[at.k] = at.w; });
    C.EXTRA.forEach(function (ex) { w[ex.k] = ex.w; });
    var hard = {};
    C.HARD.forEach(function (h) { hard[h.k] = true; });
    return { w: w, hard: hard };
  }

  // P: { kids:[{id,male,old,a,area}], pairs:[{t:'far'|'near',i,j}|{t:'fix',i,k}], inc:[{kids:[i]}], nc }
  function prepare(P, gen) {
    gen = gen || defaultGen();
    var N = P.kids.length, nc = P.nc;
    var oldN = 0;
    P.kids.forEach(function (s) { if (s.old + 1 > oldN) oldN = s.old + 1; });
    var MET = [];
    MET.push({ k: 'sex', label: '男', w: C.LEVEL_W[gen.w.sex | 0], tol: 1, v: function (s) { return s.male ? 1 : 0; } });
    C.ATTRS.forEach(function (at) {
      // 程度は足さず「いるか」で数える（heavy の項目の＋は下の別枠で数える）
      MET.push({ k: at.k, label: at.s, w: C.LEVEL_W[gen.w[at.k] | 0], tol: 1, at: at, v: function (s) { return (s.a[at.k] | 0) ? 1 : 0; } });
    });
    for (var o = 0; o < oldN; o++) (function (o) {
      MET.push({ k: 'old' + o, grp: 'old', label: '旧' + (o + 1), w: C.LEVEL_W[gen.w.old | 0], tol: 2, v: function (s) { return s.old === o ? 1 : 0; } });
    })(o);
    C.AREAS.forEach(function (ar) {
      MET.push({ k: 'area' + ar, grp: 'area', label: ar, w: C.LEVEL_W[gen.w.area | 0], tol: 2, v: function (s) { return s.area === ar ? 1 : 0; } });
    });
    // ＋（程度2）：＋はアイコン2つ分ではなく、担任の負担が明確に増える印。項目ごとと、4項目のどれかが＋の児童の人数。必ず守る条件で各組の上限（均等割の切り上げ）を超えさせない
    var heavyAt = C.ATTRS.filter(function (at) { return at.heavy; });
    heavyAt.forEach(function (at) {
      MET.push({ k: at.k + '++', grp: 'heavy', label: at.s + '＋', w: C.LEVEL_W[gen.w[at.k] | 0], tol: 1, v: function (s) { return (s.a[at.k] | 0) >= 2 ? 1 : 0; } });
    });
    MET.push({ k: 'heavy', grp: 'heavy', label: '＋の児童', w: C.LEVEL_W[3], tol: 1, v: function (s) { return heavyAt.some(function (at) { return (s.a[at.k] | 0) >= 2; }) ? 1 : 0; } });
    var M = MET.length;
    var VAL = P.kids.map(function (s) { return MET.map(function (m) { return m.v(s); }); });
    var MEAN = MET.map(function (m, mi) { var t = 0; for (var i = 0; i < N; i++) t += VAL[i][mi]; return t / nc; });
    var relOf = P.kids.map(function () { return []; });
    P.pairs.forEach(function (p, pi) {
      if (p.t === 'fix') { relOf[p.i].push(pi); return; }
      relOf[p.i].push(pi); relOf[p.j].push(pi);
    });
    var incOfKid = P.kids.map(function () { return []; });
    (P.inc || []).forEach(function (x, xi) { x.kids.forEach(function (i) { incOfKid[i].push(xi); }); });
    var HV = [];
    MET.forEach(function (m, mi) { if (m.grp === 'heavy') HV.push({ m: mi, max: Math.ceil(MEAN[mi] - 1e-9) }); });
    return { P: P, N: N, nc: nc, cap: P.cap || C.CAP, M: M, MET: MET, VAL: VAL, MEAN: MEAN, SIZE_MEAN: N / nc, HV: HV,
      relOf: relOf, incOfKid: incOfKid, gen: gen, wInc: C.LEVEL_W[gen.w.inc | 0] };
  }

  function counts(ctx, asg) {
    var c = [], k, i, m;
    for (k = 0; k < ctx.nc; k++) c.push(new Float64Array(ctx.M + 1));
    for (i = 0; i < ctx.N; i++) {
      var r = c[asg[i]], v = ctx.VAL[i];
      r[ctx.M]++;
      for (m = 0; m < ctx.M; m++) r[m] += v[m];
    }
    return c;
  }

  // 違反の判定は1か所に置く（画面の表示と計算で食い違わないように）
  function pairBroken(p, asg) {
    if (p.t === 'far') return asg[p.i] === asg[p.j];
    if (p.t === 'near') return asg[p.i] !== asg[p.j];
    return asg[p.i] !== p.k; // fix
  }
  function hardPairViol(ctx, asg) {
    var n = 0, h = ctx.gen.hard;
    ctx.P.pairs.forEach(function (p) { if (h[p.t] && pairBroken(p, asg)) n++; });
    return n;
  }

  // 組の事案数：同じ事案に同じ組の児童が複数いても1件と数える
  function incByClass(ctx, asg) {
    var v = new Array(ctx.nc).fill(0);
    (ctx.P.inc || []).forEach(function (x) {
      var seen = {};
      x.kids.forEach(function (i) { var k = asg[i]; if (!seen[k]) { seen[k] = 1; v[k]++; } });
    });
    return v;
  }
  // 事案数は児童ごとの足し算にならないので別に計算する。重みが0の間は計算しない
  function incPenalty(ctx, asg) {
    if (!ctx.wInc) return 0;
    var v = incByClass(ctx, asg), m = 0, t = 0, k;
    for (k = 0; k < v.length; k++) m += v[k];
    m /= v.length;
    for (k = 0; k < v.length; k++) t += (v[k] - m) * (v[k] - m);
    return ctx.wInc * t;
  }

  function balance(ctx, c) {
    var t = 0, h = ctx.gen.hard, k, m;
    for (k = 0; k < ctx.nc; k++) {
      var r = c[k];
      for (m = 0; m < ctx.M; m++) { var d = r[m] - ctx.MEAN[m]; t += ctx.MET[m].w * d * d; }
      var ds = r[ctx.M] - ctx.SIZE_MEAN; t += W_SIZE * ds * ds;
      if (h.cap && r[ctx.M] > ctx.cap) t += W_CAP * (r[ctx.M] - ctx.cap);
      if (h.sex) { var ex = Math.abs(r[0] - ctx.MEAN[0]) - 1; if (ex > 0) t += W_HARD * ex; }
      if (h.heavy) for (var q = 0; q < ctx.HV.length; q++) { var eh = r[ctx.HV[q].m] - ctx.HV[q].max; if (eh > 0) t += W_HARD * eh; }
    }
    return t;
  }

  function score(ctx, asg) {
    return W_HARD * hardPairViol(ctx, asg) + balance(ctx, counts(ctx, asg)) + incPenalty(ctx, asg);
  }

  // 案を作る：固定（locked: Map i→組）と「組に固定」を守り、残りを焼きなましで入れ替える
  function optimize(ctx, locked, seed) {
    var r = rngOf(seed), N = ctx.N, nc = ctx.nc, M = ctx.M;
    var lock = new Map(locked || []);
    if (ctx.gen.hard.fix) ctx.P.pairs.forEach(function (p) { if (p.t === 'fix' && p.k < nc) lock.set(p.i, p.k); });
    var asg = new Int8Array(N), free = [], sz = new Array(nc).fill(0), i, j, k;
    for (i = 0; i < N; i++) { if (lock.has(i)) { asg[i] = lock.get(i); sz[asg[i]]++; } else free.push(i); }
    for (i = free.length - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); var tmp = free[i]; free[i] = free[j]; free[j] = tmp; }
    free.forEach(function (i) { var b = 0; for (var k = 1; k < nc; k++) if (sz[k] < sz[b]) b = k; asg[i] = b; sz[b]++; });
    if (free.length < 2) return asg;
    var c = counts(ctx, asg), pv = hardPairViol(ctx, asg);
    var cur = W_HARD * pv + balance(ctx, c) + incPenalty(ctx, asg);
    var IT = 50000, T = 8, cool = Math.pow(0.002 / 8, 1 / IT);
    for (var it = 0; it < IT; it++, T *= cool) {
      i = free[Math.floor(r() * free.length)]; j = free[Math.floor(r() * free.length)];
      var a = asg[i], b = asg[j];
      if (a === b) continue;
      var vi = ctx.VAL[i], vj = ctx.VAL[j], m, d;
      for (m = 0; m < M; m++) { d = vj[m] - vi[m]; c[a][m] += d; c[b][m] -= d; }
      asg[i] = b; asg[j] = a;
      var npv = (ctx.relOf[i].length || ctx.relOf[j].length) ? hardPairViol(ctx, asg) : pv;
      var nxt = W_HARD * npv + balance(ctx, c) + (ctx.wInc ? incPenalty(ctx, asg) : 0);
      if (nxt <= cur || r() < Math.exp((cur - nxt) / T)) { cur = nxt; pv = npv; }
      else { asg[i] = a; asg[j] = b; for (m = 0; m < M; m++) { d = vj[m] - vi[m]; c[a][m] -= d; c[b][m] += d; } }
    }
    return asg;
  }

  // 画面に出す違反（✕）と偏り（△）
  function analyze(ctx, asg) {
    var c = counts(ctx, asg), bad = [], warn = [], kids = ctx.P.kids, k, m;
    ctx.P.pairs.forEach(function (p) {
      if (!pairBroken(p, asg)) return;
      if (p.t === 'far') bad.push({ t: 'far', txt: '離す：' + kids[p.i].name + ' と ' + kids[p.j].name + ' が同じ' + (asg[p.i] + 1) + '組', ids: [p.i, p.j] });
      else if (p.t === 'near') bad.push({ t: 'near', txt: 'つける：' + kids[p.i].name + '（' + (asg[p.i] + 1) + '組）と ' + kids[p.j].name + '（' + (asg[p.j] + 1) + '組）が別', ids: [p.i, p.j] });
      else bad.push({ t: 'fix', txt: '組に固定：' + kids[p.i].name + ' が' + (p.k + 1) + '組でない', ids: [p.i] });
    });
    var flag = [];
    for (k = 0; k < ctx.nc; k++) {
      flag.push(new Array(ctx.M + 1).fill(false));
      if (c[k][ctx.M] > ctx.cap) { flag[k][ctx.M] = true; bad.push({ t: 'cap', txt: (k + 1) + '組 ' + c[k][ctx.M] + '人（上限' + ctx.cap + '人）', ids: [] }); }
      else if (Math.abs(c[k][ctx.M] - ctx.SIZE_MEAN) > 1) { flag[k][ctx.M] = true; warn.push({ txt: (k + 1) + '組 人数 ' + c[k][ctx.M] + '（平均' + ctx.SIZE_MEAN.toFixed(1) + '）', k: k, m: ctx.M }); }
      ctx.HV.forEach(function (hv) {
        if (c[k][hv.m] > hv.max) { flag[k][hv.m] = true; bad.push({ t: 'heavy', txt: (k + 1) + '組 ' + ctx.MET[hv.m].label + ' ' + c[k][hv.m] + '人（各組' + hv.max + '人まで）', ids: [] }); }
      });
      for (m = 0; m < ctx.M; m++) if (ctx.MET[m].grp !== 'heavy' && Math.abs(c[k][m] - ctx.MEAN[m]) > ctx.MET[m].tol) {
        flag[k][m] = true;
        warn.push({ txt: (k + 1) + '組 ' + ctx.MET[m].label + ' ' + c[k][m] + '（平均' + ctx.MEAN[m].toFixed(1) + '）', k: k, m: m });
      }
    }
    return { c: c, bad: bad, warn: warn, flag: flag, inc: incByClass(ctx, asg) };
  }

  function spread(c, m) {
    var lo = Infinity, hi = -Infinity;
    c.forEach(function (r) { if (r[m] < lo) lo = r[m]; if (r[m] > hi) hi = r[m]; });
    return hi - lo;
  }

  // 学級名は入れ替え可能なので、組の並べ替えを全通り試して最小の差を出す（最大4学級＝24通り）
  function perms(n) {
    var out = [];
    (function rec(a, rest) {
      if (!rest.length) { out.push(a); return; }
      rest.forEach(function (x, i) { rec(a.concat([x]), rest.slice(0, i).concat(rest.slice(i + 1))); });
    })([], Array.from({ length: n }, function (_, i) { return i; }));
    return out;
  }
  function diffCount(ctx, a, b) {
    var best = ctx.N;
    perms(ctx.nc).forEach(function (pm) {
      var d = 0;
      for (var i = 0; i < ctx.N; i++) if (pm[a[i]] !== b[i]) d++;
      if (d < best) best = d;
    });
    return best;
  }

  // ===== 入れ替え =====
  // 「つける」の相手が同じ組にいれば一緒に動かす
  function nearGroup(ctx, asg, i) {
    var gp = [i], k = asg[i];
    for (var q = 0; q < gp.length; q++) ctx.relOf[gp[q]].forEach(function (pi) {
      var p = ctx.P.pairs[pi];
      if (p.t !== 'near') return;
      var o = p.i === gp[q] ? p.j : p.i;
      if (asg[o] === k && gp.indexOf(o) < 0) gp.push(o);
    });
    return gp;
  }
  // 実行後に新しく同じ組になる「離す」
  function farBreaks(ctx, asg, changes) {
    var after = Int8Array.from(asg);
    changes.forEach(function (x) { after[x[0]] = x[1]; });
    return ctx.P.pairs.filter(function (p) {
      return p.t === 'far' && after[p.i] === after[p.j] && asg[p.i] !== asg[p.j];
    });
  }
  // 離す相手のうち、動かなかった側（続けて入れ替える児童）
  function farTargets(breaks, changes) {
    var moved = {};
    changes.forEach(function (x) { moved[x[0]] = 1; });
    var out = [];
    breaks.forEach(function (p) {
      var t = moved[p.i] && !moved[p.j] ? p.j : p.i;
      if (out.indexOf(t) < 0) out.push(t);
    });
    return out;
  }
  function sizeOf(asg, k) { var n = 0; for (var i = 0; i < asg.length; i++) if (asg[i] === k) n++; return n; }

  function buildSwap(ctx, asg, locks, a, b) {
    var ka = asg[a], kb = asg[b];
    var GA = nearGroup(ctx, asg, a), GB = nearGroup(ctx, asg, b);
    var hit = GA.concat(GB).filter(function (i) { return locks.has(i); });
    if (hit.length) return { err: ctx.P.kids[hit[0]].name + ' は固定しています。先に固定を外してください（L）' };
    var d = { type: 'swap', ka: ka, kb: kb, GA: GA, GB: GB, extraSide: null, cands: [], ci: 0, cnt: 0 };
    var need = GA.length - GB.length;
    if (need !== 0) {
      // 少ない側の組から、偏りが最も小さくなる児童を自動で補う
      var side = need > 0 ? 'B' : 'A', k = need > 0 ? kb : ka, base = need > 0 ? GB : GA, other = need > 0 ? GA : GB;
      var to = k === kb ? ka : kb, pool = [];
      for (var i = 0; i < ctx.N; i++)
        if (asg[i] === k && base.indexOf(i) < 0 && !locks.has(i) && nearGroup(ctx, asg, i).length === 1) pool.push(i);
      var sc = function (i) {
        var t = Int8Array.from(asg);
        other.forEach(function (x) { t[x] = k; });
        base.concat([i]).forEach(function (x) { t[x] = to; });
        return score(ctx, t);
      };
      d.cands = pool.map(function (i) { return [i, sc(i)]; }).sort(function (x, y) { return x[1] - y[1]; }).map(function (x) { return x[0]; });
      d.extraSide = side; d.cnt = Math.abs(need);
      if (d.cands.length < d.cnt) return { err: '一緒に動かせる児童が足りません' };
    }
    return d;
  }
  function swapChanges(d) {
    var ex = d.extraSide ? d.cands.slice(d.ci, d.ci + d.cnt) : [];
    var A = d.extraSide === 'A' ? d.GA.concat(ex) : d.GA, B = d.extraSide === 'B' ? d.GB.concat(ex) : d.GB;
    var ch = A.map(function (i) { return [i, d.kb]; }).concat(B.map(function (i) { return [i, d.ka]; }));
    return { A: A, B: B, ex: ex, ch: ch };
  }
  function nextCandidate(d) {
    var n = Math.floor(d.cands.length / d.cnt) * d.cnt;
    d.ci = (d.ci + d.cnt) % n;
  }
  function buildMove(ctx, asg, locks, a, k) {
    var G = nearGroup(ctx, asg, a);
    var hit = G.filter(function (i) { return locks.has(i); });
    if (hit.length) return { err: ctx.P.kids[hit[0]].name + ' は固定しています。先に固定を外してください（L）' };
    return { type: 'move', ka: asg[a], kb: k, GA: G, ch: G.map(function (i) { return [i, k]; }) };
  }

  // ===== 案の名前 =====
  // 既定より重みを上げた項目を上位2つまで「○・○の分散重視」とし、固定人数と外した必ず守る条件を足す
  function autoName(gen, lockCount) {
    var def = defaultGen(), ups = [], parts = [];
    C.ATTRS.concat(C.EXTRA).forEach(function (x) {
      var dv = (gen.w[x.k] | 0) - (def.w[x.k] | 0);
      if (dv > 0) ups.push({ s: x.s, dv: dv, lv: gen.w[x.k] | 0 });
    });
    ups.sort(function (a, b) { return b.dv - a.dv || b.lv - a.lv; });
    if (ups.length) parts.push(ups.slice(0, 2).map(function (u) { return u.s; }).join('・') + 'の分散重視');
    var off = C.HARD.filter(function (h) { return !gen.hard[h.k]; }).map(function (h) { return h.label; });
    if (off.length) parts.push(off.join('・') + 'を外す');
    if (lockCount) parts.push('固定' + lockCount + '人');
    return parts.length ? parts.join('・') : '標準';
  }
  function genSummary(gen) {
    return C.ATTRS.concat(C.EXTRA).map(function (x) { return x.s + C.LEVEL_NAMES[gen.w[x.k] | 0][0]; }).join(' ');
  }

  // ===== 決定 =====
  // 新しい番号：組ごとに男女混合の五十音順（読みが同じなら児童ID順）
  function assignNumbers(kids, asg, nc) {
    var out = kids.map(function () { return null; });
    for (var k = 0; k < nc; k++) {
      var ids = [];
      for (var i = 0; i < kids.length; i++) if (asg[i] === k) ids.push(i);
      ids.sort(function (x, y) {
        return String(kids[x].kana || '').localeCompare(String(kids[y].kana || ''), 'ja') || (kids[x].id < kids[y].id ? -1 : 1);
      });
      ids.forEach(function (i, n) { out[i] = { cls: k, no: n + 1 }; });
    }
    return out;
  }
  // 決定で作る次の年度の行。配慮項目の値は今年度の値を写す（以後は次の年度の側を直す）
  function nextYearRows(kids, asg, nc) {
    var num = assignNumbers(kids, asg, nc);
    return kids.map(function (s, i) {
      var a = {};
      C.ATTRS.forEach(function (at) { a[at.k] = s.a[at.k] | 0; if (at.side && s.a[at.k + '_t']) a[at.k + '_t'] = s.a[at.k + '_t']; });
      if (s.a.sp) a.sp = 1;
      return { id: s.id, cls: num[i].cls, no: num[i].no, a: a };
    });
  }

  // ===== 不変条件 =====
  function checkInvariants(ctx, asg) {
    var errs = [];
    if (asg.length !== ctx.N) errs.push('割り当ての人数が名簿と違う');
    for (var i = 0; i < asg.length; i++) if (!(asg[i] >= 0 && asg[i] < ctx.nc)) { errs.push('組に入っていない児童がいる：' + i); break; }
    return errs;
  }

  g.Engine = {
    rngOf: rngOf, defaultGen: defaultGen, prepare: prepare, counts: counts, pairBroken: pairBroken,
    hardPairViol: hardPairViol, incByClass: incByClass, score: score, optimize: optimize, analyze: analyze,
    spread: spread, diffCount: diffCount, nearGroup: nearGroup, farBreaks: farBreaks, farTargets: farTargets,
    sizeOf: sizeOf, buildSwap: buildSwap, swapChanges: swapChanges, nextCandidate: nextCandidate,
    buildMove: buildMove, autoName: autoName, genSummary: genSummary, assignNumbers: assignNumbers,
    nextYearRows: nextYearRows, checkInvariants: checkInvariants
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ==================== server.gs ==================== */
// サーバー（GAS）。scripts/build.py が config.js・engine.js の後ろにつなげて dist/gas/Code.gs を作る。
// 役目は「読み込み（学年ごとに1回）と保存」だけ。計算と描画はブラウザ側（docs/design.md §5）。
// コメントは GAS 上で消えることがあるので、意味を持たせない（principles/gas-javascript-notes.md §1）。

var SERVER_BUILD = 'BUILD_477d84017a7f';
var DB_PROP = 'CLASS_SPLIT_DB_ID';

// ===== 画面 =====
function doGet() {
  var who = currentTeacher_();
  if (!who.ok) {
    return HtmlService.createHtmlOutput('<!doctype html><html lang="ja"><meta charset="utf-8"><body style="font-family:sans-serif;padding:24px">' +
      '<h1 style="font-size:20px">このページは教員のアカウントで開いてください</h1><p>' + escHtml_(who.email || '（アカウントが分かりません）') + ' では開けません。</p></body></html>')
      .setTitle('クラス替え');
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('クラス替え')
    .addMetaTag('viewport', 'width=device-width,initial-scale=1');
}

// ===== 利用者の確認 =====
// 「自分として実行」でも、同じドメインの利用者のメールは取れる。教員のドメイン以外（児童など）は拒否する
function currentTeacher_() {
  var email = '';
  try { email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (e) { email = ''; }
  var ok = !!email && email.slice(-(CONFIG.TEACHER_DOMAIN.length + 1)) === '@' + CONFIG.TEACHER_DOMAIN;
  return { ok: ok, email: email };
}
function requireTeacher_() {
  var who = currentTeacher_();
  if (!who.ok) throw userError_('教員のアカウントで開いてください');
  return who.email;
}
// 再試行しても直らない誤り（画面は再試行せずに表示する）
function userError_(msg) { return new Error('USER:' + msg); }
function escHtml_(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

// ===== データの置き場 =====
// 専用のスプレッドシート。初回は setup() を所有者が実行して作る（教員には共有しない）
function setup() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(DB_PROP);
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('クラス替え（データ）');
  props.setProperty(DB_PROP, ss.getId());
  TABLES_.forEach(function (t) { sheet_(ss, t.name, t.head); });
  var fy = CONFIG.fiscalYear();
  sheet_(ss, 'roster_' + fy, ROSTER_HEAD);
  sheet_(ss, 'attrs_' + fy, attrsHead_());
  return ss.getUrl();
}
var ROSTER_HEAD = ['id8', 'name', 'kana', 'sex', 'grade', 'class', 'no'];
var TABLES_ = [
  { name: 'settings', head: ['key', 'json'] },
  { name: 'decisions', head: ['fy', 'grade', 'plan', 'by', 'at', 'undone'] },
  { name: 'pairs_carry', head: ['fy', 'type', 'a', 'b'] },
  { name: 'incidents', head: ['inc_id', 'date', 'type', 'url', 'file_id', 'title', 'by', 'at', 'deleted'] },
  { name: 'incident_kids', head: ['inc_id', 'id8'] },
  { name: 'log', head: ['at', 'by', 'action', 'n'] },
  // 新年度の転入生：クラス分けに加え、決定で来年度の名簿に入れる。grade は今年度の学年（その学年のクラス分けに入る）
  { name: 'transfers', head: ['fy', 'grade', 'id8', 'name', 'kana', 'sex', 'by', 'at'] }
];
// side の項目（ア・身・通）は内容の文字も持つ（列名は k5_t など）
function attrsHead_() {
  var h = ['id8'].concat(CONFIG.ATTRS.map(function (at) { return at.k; }));
  CONFIG.ATTRS.forEach(function (at) { if (at.side) h.push(at.k + '_t'); });
  h.push('sp'); // 特別支援学級の児童（1＝在籍）。配慮項目ではなく、カードの地の色を変えるだけ
  return h;
}
// シートに書く文字：= + - @ で始まると式として読まれるので、先頭に ' を付けて文字のまま残す
function plainText_(s) { s = String(s == null ? '' : s).slice(0, 200); return /^[=+\-@]/.test(s) ? "'" + s : s; }

var SS_ = null;
function db_() {
  if (SS_) return SS_;
  var id = PropertiesService.getScriptProperties().getProperty(DB_PROP);
  if (!id) throw userError_('データの置き場がありません。所有者が setup を実行してください');
  SS_ = SpreadsheetApp.openById(id);
  return SS_;
}
function sheet_(ss, name, head) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (head) sh.getRange(1, 1, 1, head.length).setValues([head]);
  }
  return sh;
}
// 表を読む：見出しの名前で列を引く。無い表は空
function read_(name) {
  var sh = db_().getSheetByName(name);
  if (!sh) return { sh: null, head: [], rows: [] };
  var v = sh.getDataRange().getValues();
  if (!v.length) return { sh: sh, head: [], rows: [] };
  var head = v[0].map(String), rows = [];
  for (var r = 1; r < v.length; r++) {
    var o = { _r: r + 1 };
    for (var c = 0; c < head.length; c++) o[head[c]] = v[r][c];
    rows.push(o);
  }
  return { sh: sh, head: head, rows: rows };
}
// 項目を足した時、既存のシートの見出しに無い列を右端に足す（古いシートでも書けるように）
function ensureCols_(name, head) {
  var sh = sheet_(db_(), name, head);
  var w = Math.max(1, sh.getLastColumn()), cur = sh.getRange(1, 1, 1, w).getValues()[0].map(String);
  var miss = head.filter(function (h) { return cur.indexOf(h) < 0; });
  if (miss.length) sh.getRange(1, cur[0] ? w + 1 : 1, 1, miss.length).setValues([miss]);
  return sh;
}
function rowOf_(head, o) { return head.map(function (h) { return o[h] === undefined ? '' : o[h]; }); }
function append_(name, head, objs) {
  if (!objs.length) return;
  var sh = sheet_(db_(), name, head);
  var cur = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  if (!cur[0]) cur = head;
  sh.getRange(sh.getLastRow() + 1, 1, objs.length, cur.length).setValues(objs.map(function (o) { return rowOf_(cur, o); }));
}
// 書き戻しは変えた行の変えた列だけ（同時に別の行を直している人を上書きしない）
function writeCell_(t, row, col, value) {
  var c = t.head.indexOf(col);
  if (c < 0) throw new Error('列がありません：' + col);
  t.sh.getRange(row._r, c + 1).setValue(value);
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw userError_('ほかの人が保存中です。少し待ってからもう一度');
  try { return fn(); } finally { lock.releaseLock(); }
}
function log_(by, action, n) { append_('log', TABLES_[5].head, [{ at: new Date(), by: by, action: action, n: n }]); }

function getSetting_(key, def) {
  var t = read_('settings');
  for (var i = 0; i < t.rows.length; i++) if (t.rows[i].key === key) { try { return JSON.parse(t.rows[i].json); } catch (e) { return def; } }
  return def;
}
function setSetting_(key, value) {
  var t = read_('settings');
  for (var i = 0; i < t.rows.length; i++) if (t.rows[i].key === key) { writeCell_(t, t.rows[i], 'json', JSON.stringify(value)); return; }
  append_('settings', TABLES_[0].head, [{ key: key, json: JSON.stringify(value) }]);
}

// ===== 名簿・配慮項目の読み出し =====
function rosterRows_(fy) {
  return read_('roster_' + fy).rows.filter(function (r) { return String(r.id8); }).map(function (r) {
    return { id: String(r.id8), name: String(r.name), kana: String(r.kana || ''), male: String(r.sex) === '男',
      grade: +r.grade, cls: (+r['class']) - 1, no: +r.no };
  });
}
function attrsMap_(fy) {
  var m = {};
  read_('attrs_' + fy).rows.forEach(function (r) {
    var a = {};
    CONFIG.ATTRS.forEach(function (at) { a[at.k] = +r[at.k] || 0; if (at.side && r[at.k + '_t']) a[at.k + '_t'] = String(r[at.k + '_t']); });
    if (+r.sp) a.sp = 1;
    m[String(r.id8)] = a;
  });
  return m;
}
function decisionOf_(fy, grade) {
  var t = read_('decisions'), hit = null;
  t.rows.forEach(function (r) { if (+r.fy === fy && +r.grade === grade && !r.undone) hit = r; });
  return hit;
}

// ===== 画面から呼ぶ関数（platform-gas.js と同じ名前と形） =====
function api_(fn) {
  return function () {
    var args = arguments;
    try { return JSON.stringify({ ok: true, build: SERVER_BUILD, v: fn.apply(null, args) }); }
    catch (e) {
      var m = String(e && e.message || e);
      return JSON.stringify({ ok: false, build: SERVER_BUILD, user: m.indexOf('USER:') === 0, err: m.replace(/^USER:/, '') });
    }
  };
}

var apiListGrades = api_(function () {
  requireTeacher_();
  var fy = CONFIG.fiscalYear(), by = {};
  rosterRows_(fy).forEach(function (r) {
    var g = by[r.grade] = by[r.grade] || { grade: r.grade, count: 0, classes: 0, decided: false };
    g.count++; if (r.cls + 1 > g.classes) g.classes = r.cls + 1;
  });
  Object.keys(by).forEach(function (g) { by[g].decided = !!decisionOf_(fy, +g); });
  var out = [];
  for (var g = 1; g <= 6; g++) out.push(by[g] || { grade: g, count: 0, classes: 0, decided: false });
  return out;
});

var apiBoot = api_(function (grade) {
  requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear(), entry = FY - grade + 1, years = [], kids = {}, idset = {};
  for (var fy = entry; fy <= FY + 1; fy++) {
    var gy = fy - entry + 1, am = attrsMap_(fy);
    var rows = rosterRows_(fy).filter(function (r) { return r.grade === gy; });
    if (!rows.length) continue;
    years.push({ fy: fy, grade: gy, rows: rows.map(function (r) {
      kids[r.id] = { id: r.id, name: r.name, kana: r.kana, male: r.male, area: '' };
      idset[r.id] = 1;
      return { id: r.id, cls: r.cls, no: r.no, a: am[r.id] || emptyAttrs_() };
    }) });
  }
  var incs = incidents_().filter(function (x) { return x.ids.some(function (id) { return idset[id]; }); });
  var dec = decisionOf_(FY, grade);
  return {
    fy: FY, grade: grade, years: years, kids: kids, incidents: incs,
    pairs: pairs_(FY, grade),
    carry: carry_(FY, grade, idset),
    transfers: transfers_(FY, grade),
    plans: getSetting_('plans_' + FY + '_' + grade, { ver: 0, plans: [] }),
    decision: dec ? { plan: String(dec.plan), at: String(dec.at) } : null
  };
});
function transfers_(fy, grade) {
  return read_('transfers').rows.filter(function (r) { return +r.fy === fy && +r.grade === grade && String(r.id8); }).map(function (r) {
    return { id: String(r.id8), name: String(r.name), kana: String(r.kana), male: String(r.sex) === '男' };
  });
}
// 転入生を足す：児童IDが分からなければ仮のID（T＋数字）。名簿の児童IDと重なれば断る
var apiAddTransfer = api_(function (grade, x) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear();
  var name = String(x && x.name || '').trim(), kana = String(x && x.kana || '').trim(), id = String(x && x.id || '').trim();
  if (!name) throw userError_('名前を入れてください');
  if (id && !/^\d{8}$/.test(id)) throw userError_('児童IDは数字8桁です（分からなければ空のまま）');
  return withLock_(function () {
    if (decisionOf_(FY, grade)) throw userError_('決定済みです。決定を取り消してから足してください');
    var used = {};
    rosterRows_(FY).concat(rosterRows_(FY + 1)).forEach(function (r) { used[r.id] = 1; });
    read_('transfers').rows.forEach(function (r) { used[String(r.id8)] = 1; });
    if (id && used[id]) throw userError_('その児童IDはもう使われています');
    if (!id) { var n = 1; while (used['T' + FY + ('00' + n).slice(-3)]) n++; id = 'T' + FY + ('00' + n).slice(-3); }
    append_('transfers', TABLES_[6].head, [{ fy: FY, grade: grade, id8: id, name: plainText_(name), kana: plainText_(kana), sex: x.male ? '男' : '女', by: by, at: new Date().toISOString() }]);
    return { id: id };
  });
});
var apiRemoveTransfer = api_(function (grade, id) {
  requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear();
  return withLock_(function () {
    if (decisionOf_(FY, grade)) throw userError_('決定済みです。決定を取り消してから消してください');
    removeRows_('transfers', function (r) { return +r.fy === FY && +r.grade === grade && String(r.id8) === String(id); });
    return { ok: true };
  });
});
function emptyAttrs_() { var a = {}; CONFIG.ATTRS.forEach(function (at) { a[at.k] = 0; }); return a; }

function pairs_(fy, grade) {
  return read_('pairs_' + fy + '_' + grade).rows.filter(function (r) { return String(r.type); }).map(function (r) {
    var p = { t: String(r.type), a: String(r.a), memo: String(r.memo || '') };
    if (p.t === 'fix') p.k = (+r.k) - 1; else p.b = String(r.b);
    return p;
  });
}
var PAIR_HEAD = ['type', 'a', 'b', 'k', 'memo', 'by', 'at'];
// 前年度に決定した時に持ち越した組のうち、2人とも今この学年にいて、まだ採用していないもの
function carry_(FY, grade, idset) {
  var key = function (p) { return p.t + ':' + [p.a, p.b].sort().join('-'); }, have = {};
  pairs_(FY, grade).forEach(function (p) { have[key(p)] = 1; });
  return read_('pairs_carry').rows.filter(function (r) { return +r.fy === FY - 1 && idset[String(r.a)] && idset[String(r.b)]; })
    .map(function (r) { return { t: String(r.type), a: String(r.a), b: String(r.b) }; })
    .filter(function (p) { return !have[key(p)]; });
}

// つける・離す・組に固定を、学年ごとにまとめて置き換える
var apiSavePairs = api_(function (grade, pairs) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear(), name = 'pairs_' + FY + '_' + grade;
  if (decisionOf_(FY, grade)) throw userError_('クラス替えを決定したので直せません');
  return withLock_(function () {
    sheet_(db_(), name, PAIR_HEAD);
    removeRows_(name, function (r) { return r._r > 1; });
    append_(name, PAIR_HEAD, (pairs || []).map(function (p) {
      return { type: p.t, a: String(p.a), b: p.t === 'fix' ? '' : String(p.b), k: p.t === 'fix' ? (+p.k) + 1 : '', memo: String(p.memo || ''), by: by, at: new Date().toISOString() };
    }));
    return { n: (pairs || []).length };
  });
});

// 名簿を入れる：同じ児童IDは上書き（配慮項目の値は残す）、新しいIDは足す。貼った中にいない児童は知らせるだけ（消さない）
var apiImportRoster = api_(function (fy, grade, rows) {
  var by = requireTeacher_();
  fy = +fy; grade = +grade;
  var FY = CONFIG.fiscalYear();
  if (fy !== FY && fy !== FY + 1) throw userError_('今年度か来年度の名簿だけ入れられます');
  if (!rows || !rows.length) throw userError_('児童がいません');
  return withLock_(function () {
    var name = 'roster_' + fy;
    sheet_(db_(), name, ROSTER_HEAD);
    ensureCols_('attrs_' + fy, attrsHead_());
    var t = read_(name), byId = {}, added = [], updated = 0, classes = {}, ids = {};
    t.rows.forEach(function (r) { byId[String(r.id8)] = r; });
    rows.forEach(function (x) {
      var id = String(x.id);
      if (!/^\d{8}$/.test(id)) throw userError_('児童IDが8桁でない行があります');
      classes[+x.cls] = 1; ids[id] = 1;
      var o = { id8: id, name: String(x.name), kana: String(x.kana || ''), sex: x.male ? '男' : (x.sex || '女'), grade: grade, 'class': (+x.cls) + 1, no: +x.no };
      var r = byId[id];
      if (r) { ['name', 'kana', 'sex', 'grade', 'class', 'no'].forEach(function (c) { if (String(r[c]) !== String(o[c])) writeCell_(t, r, c, o[c]); }); updated++; }
      else added.push(o);
    });
    append_(name, ROSTER_HEAD, added);
    var missing = t.rows.filter(function (r) { return +r.grade === grade && classes[(+r['class']) - 1] && !ids[String(r.id8)]; }).map(function (r) { return String(r.name); });
    log_(by, 'importRoster', rows.length);
    return { added: added.length, updated: updated, missing: missing };
  });
});

function incidents_() {
  var kids = {};
  read_('incident_kids').rows.forEach(function (r) { (kids[r.inc_id] = kids[r.inc_id] || []).push(String(r.id8)); });
  return read_('incidents').rows.filter(function (r) { return !r.deleted && r.inc_id !== ''; }).map(function (r) {
    return { id: +r.inc_id, date: isoDate_(r.date), type: String(r.type), title: String(r.title), url: String(r.url), ids: kids[r.inc_id] || [] };
  });
}
function isoDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

// 配慮項目は編集できる年度だけ（決定前＝今年度、決定後＝来年度）。決定後の今年度は凍結
var apiSetAttr = api_(function (fy, grade, id, k, v, text) {
  var by = requireTeacher_();
  fy = +fy; grade = +grade; v = +v;
  var at = k === 'sp' ? { k: 'sp', max: 1 } : CONFIG.ATTRS.filter(function (a) { return a.k === k; })[0];
  if (!at) throw userError_('項目が違います');
  if (!(v >= 0 && v <= at.max)) throw userError_('値が違います');
  var FY = CONFIG.fiscalYear(), cohortGrade = grade - (fy - FY), dec = decisionOf_(FY, cohortGrade);
  var editable = dec ? FY + 1 : FY;
  if (fy !== editable) throw userError_(fy === FY && dec ? 'クラス替えを決定したので、今年度の値は直せません。準備中の年度を直してください' : 'この年度は直せません');
  return withLock_(function () {
    var name = 'attrs_' + fy;
    ensureCols_(name, attrsHead_());
    var t = read_(name), row = null;
    t.rows.forEach(function (r) { if (String(r.id8) === String(id)) row = r; });
    var tk = at.side && text !== undefined ? k + '_t' : null, tv = tk ? plainText_(v ? text : '') : '';
    if (row) { writeCell_(t, row, k, v); if (tk) writeCell_(t, row, tk, tv); }
    else { var o = { id8: String(id) }; o[k] = v; if (tk) o[tk] = tv; append_(name, attrsHead_(), [o]); }
    return { ok: true, by: by };
  });
});

// 案は学年ごとに1つの値（版つき）。他の人が先に保存していたら上書きせずに知らせる
var apiSavePlans = api_(function (grade, plans, baseVer) {
  var by = requireTeacher_();
  var key = 'plans_' + CONFIG.fiscalYear() + '_' + (+grade);
  return withLock_(function () {
    var cur = getSetting_(key, { ver: 0, plans: [] });
    if ((+baseVer || 0) !== (+cur.ver || 0)) return { conflict: true, ver: cur.ver, by: cur.by || '' };
    var next = { ver: (+cur.ver || 0) + 1, by: by, at: new Date().toISOString(), plans: plans };
    if (JSON.stringify(next).length > 45000) throw userError_('案が多すぎて保存できません。使わない案を削除してください');
    setSetting_(key, next);
    return { ver: next.ver };
  });
});

function fileIdOf_(url) {
  var m = String(url).match(/\/d\/([\w-]{20,})/) || String(url).match(/[?&]id=([\w-]{20,})/);
  return m ? m[1] : '';
}
// 所有者が開けない文書は名前を取れない（空を返し、画面が入力を求める）
function titleOf_(url) {
  var id = fileIdOf_(url);
  if (!id) return '';
  try { return DriveApp.getFileById(id).getName(); } catch (e) { return ''; }
}
var apiFetchTitle = api_(function (url) { requireTeacher_(); return { title: titleOf_(url) }; });

var apiAddIncident = api_(function (x) {
  var by = requireTeacher_();
  if (!x || !x.ids || !x.ids.length) throw userError_('関係する児童を選んでください');
  if (!/^https:\/\/(docs|drive)\.google\.com\//.test(String(x.url))) throw userError_('学校のドライブの文書のURLを貼ってください');
  var title = String(x.title || '').trim() || titleOf_(x.url);
  return withLock_(function () {
    var t = read_('incidents'), next = 1;
    t.rows.forEach(function (r) { if (+r.inc_id >= next) next = +r.inc_id + 1; });
    var inc = { inc_id: next, date: String(x.date), type: String(x.type), url: String(x.url), file_id: fileIdOf_(x.url), title: title, by: by, at: new Date(), deleted: '' };
    append_('incidents', TABLES_[3].head, [inc]);
    append_('incident_kids', TABLES_[4].head, x.ids.map(function (id) { return { inc_id: next, id8: String(id) }; }));
    log_(by, 'addIncident', x.ids.length);
    return { id: next, date: inc.date, type: inc.type, title: title, url: inc.url, ids: x.ids.map(String) };
  });
});

var apiSchoolIncidents = api_(function () {
  requireTeacher_();
  var cur = {};
  rosterRows_(CONFIG.fiscalYear()).forEach(function (r) { cur[r.id] = r; });
  var cnt = {}, last = {};
  incidents_().forEach(function (x) { x.ids.forEach(function (id) { cnt[id] = (cnt[id] || 0) + 1; if (!last[id] || x.date > last[id]) last[id] = x.date; }); });
  return Object.keys(cnt).filter(function (id) { return cur[id]; }).map(function (id) {
    var r = cur[id];
    return { id: id, name: r.name, male: r.male, grade: r.grade, cls: r.cls, no: r.no, count: cnt[id], last: last[id] };
  });
});

// 決定：来年度の名簿（新しい組・番号）と配慮項目の写しを作り、つける・離すを持ち越しの候補にする
var apiDecide = api_(function (grade, plan) {
  var by = requireTeacher_();
  grade = +grade;
  if (grade >= 6) throw userError_('6年は決定しません');
  var FY = CONFIG.fiscalYear();
  return withLock_(function () {
    if (decisionOf_(FY, grade)) throw userError_('決定済みです');
    var am = attrsMap_(FY);
    var cur = rosterRows_(FY).filter(function (r) { return r.grade === grade; });
    if (!cur.length) throw userError_('名簿がありません');
    // 転入生も名簿の児童と同じに扱う（今年度の値は無いので空）
    var tr = transfers_(FY, grade).map(function (t) { return { id: t.id, name: t.name, kana: t.kana, male: t.male }; });
    cur = cur.concat(tr);
    var kids = cur.map(function (r) { return { id: r.id, kana: r.kana, a: am[r.id] || emptyAttrs_() }; });
    var asg = cur.map(function (r) { return plan.assign[r.id]; });
    if (asg.some(function (k) { return !(k >= 0 && k < CONFIG.MAX_CLASSES); })) throw userError_('組の決まっていない児童がいます');
    var nc = 0; asg.forEach(function (k) { if (k + 1 > nc) nc = k + 1; });
    var rows = Engine.nextYearRows(kids, asg, nc), info = {};
    cur.forEach(function (r) { info[r.id] = r; });
    var nfy = FY + 1;
    append_('roster_' + nfy, ROSTER_HEAD, rows.map(function (r) {
      var s = info[r.id];
      return { id8: r.id, name: s.name, kana: s.kana, sex: s.male ? '男' : '女', grade: grade + 1, 'class': r.cls + 1, no: r.no };
    }));
    ensureCols_('attrs_' + nfy, attrsHead_());
    append_('attrs_' + nfy, attrsHead_(), rows.map(function (r) { var o = { id8: r.id }; CONFIG.ATTRS.forEach(function (at) { o[at.k] = r.a[at.k]; if (at.side && r.a[at.k + '_t']) o[at.k + '_t'] = plainText_(r.a[at.k + '_t']); }); if (r.a.sp) o.sp = 1; return o; }));
    append_('pairs_carry', TABLES_[2].head, pairs_(FY, grade).filter(function (p) { return p.t !== 'fix'; })
      .map(function (p) { return { fy: FY, type: p.t, a: p.a, b: p.b }; }));
    append_('decisions', TABLES_[1].head, [{ fy: FY, grade: grade, plan: String(plan.name), by: by, at: new Date().toISOString(), undone: '' }]);
    log_(by, 'decide', rows.length);
    return { plan: String(plan.name) };
  });
});

// 取り消し：4/1まで（年度が変わったら決定は確定）。来年度の名簿と写した値・持ち越しの候補を消す
var apiUndoDecide = api_(function (grade) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear();
  return withLock_(function () {
    var dec = decisionOf_(FY, grade);
    if (!dec) throw userError_('決定されていません（年度が変わった後は取り消せません）');
    var ids = {};
    rosterRows_(FY).forEach(function (r) { if (r.grade === grade) ids[r.id] = 1; });
    transfers_(FY, grade).forEach(function (t) { ids[t.id] = 1; });
    var n = removeRows_('roster_' + (FY + 1), function (r) { return +r.grade === grade + 1 && ids[String(r.id8)]; });
    removeRows_('attrs_' + (FY + 1), function (r) { return ids[String(r.id8)]; });
    removeRows_('pairs_carry', function (r) { return +r.fy === FY && (ids[String(r.a)] || ids[String(r.b)]); });
    var t = read_('decisions');
    writeCell_(t, t.rows.filter(function (r) { return r._r === dec._r; })[0], 'undone', new Date().toISOString());
    log_(by, 'undoDecide', n);
    return { ok: true };
  });
});
// 行を消す（下の行から消すので行番号がずれない）
function removeRows_(name, pred) {
  var t = read_(name), n = 0;
  if (!t.sh) return 0;
  t.rows.slice().reverse().forEach(function (r) { if (pred(r)) { t.sh.deleteRow(r._r); n++; } });
  return n;
}

// ===== 設定 =====
// 項目の名前・頭文字・既定の重み、事案の種別、担任と学級、卒業・転出後に残す年数。正本は settings シートの app
function defaultSettings_() {
  var attrs = {};
  CONFIG.ATTRS.forEach(function (at) { attrs[at.k] = { label: at.label, s: at.s, w: at.w }; });
  return { attrs: attrs, types: CONFIG.INCIDENT_TYPES.slice(), teachers: [], keepYears: 0 };
}
function settings_() {
  var d = defaultSettings_(), s = getSetting_('app', {});
  return { attrs: Object.assign(d.attrs, s.attrs || {}), types: s.types && s.types.length ? s.types : d.types,
    teachers: s.teachers || [], keepYears: +s.keepYears || 0 };
}
var apiSettings = api_(function () {
  var email = requireTeacher_(), s = settings_(), me = { email: email, grade: 0, cls: -1 };
  s.teachers.forEach(function (t) { if (String(t.email).toLowerCase() === email) { me.grade = +t.grade; me.cls = (+t.cls) - 1; } });
  return { settings: s, me: me };
});
var apiSaveSettings = api_(function (s) {
  var by = requireTeacher_();
  if (!s || !s.attrs) throw userError_('設定が読めません');
  var clean = { attrs: {}, types: [], teachers: [], keepYears: Math.max(0, Math.min(6, +s.keepYears || 0)) };
  CONFIG.ATTRS.forEach(function (at) {
    var x = s.attrs[at.k] || {};
    var label = String(x.label === undefined ? at.label : x.label).trim().slice(0, 20), ini = String(x.s === undefined ? at.s : x.s).trim().slice(0, 1);
    if (!label || !ini) throw userError_('項目の名前と頭文字は空にできません');
    // 説明文：空の欄は既定の文に戻す
    var help = (at.help || []).map(function (d, i) { var t = String(x.help && x.help[i] || '').trim().slice(0, 80); return t || d; });
    clean.attrs[at.k] = { label: label, s: ini, w: Math.max(0, Math.min(3, +x.w || 0)), help: help };
  });
  clean.types = (s.types || []).map(function (t) { return String(t).trim(); }).filter(Boolean).slice(0, 20);
  if (!clean.types.length) throw userError_('事案の種別を1つ以上入れてください');
  clean.teachers = (s.teachers || []).filter(function (t) { return t && t.email; }).map(function (t) {
    return { email: String(t.email).trim().toLowerCase(), grade: +t.grade || 0, cls: +t.cls || 0 };
  });
  withLock_(function () { setSetting_('app', clean); log_(by, 'saveSettings', 0); });
  return clean;
});

// ===== 年度替わり：卒業・転出した児童の記録を消す =====
function rosterSheets_() {
  return db_().getSheets().map(function (sh) { return sh.getName(); }).filter(function (n) { return /^roster_\d{4}$/.test(n); })
    .map(function (n) { return +n.slice(7); }).sort();
}
// 今年度（と来年度）の名簿にいない児童。最後にいた年度から keepYears 年度を過ぎたものだけ
var apiLeaveCandidates = api_(function () {
  requireTeacher_();
  var FY = CONFIG.fiscalYear(), keep = settings_().keepYears, now = {}, last = {};
  [FY, FY + 1].forEach(function (fy) { rosterRows_(fy).forEach(function (r) { now[r.id] = 1; }); });
  rosterSheets_().forEach(function (fy) {
    if (fy >= FY) return;
    rosterRows_(fy).forEach(function (r) { last[r.id] = { id: r.id, name: r.name, fy: fy, grade: r.grade, cls: r.cls, no: r.no }; });
  });
  var cnt = {};
  incidents_().forEach(function (x) { x.ids.forEach(function (id) { cnt[id] = (cnt[id] || 0) + 1; }); });
  return Object.keys(last).filter(function (id) { return !now[id] && FY > last[id].fy + keep; }).map(function (id) {
    var x = last[id]; x.reason = x.grade === 6 ? '卒業' : '転出'; x.incidents = cnt[id] || 0; return x;
  }).sort(function (a, b) { return a.fy - b.fy || a.grade - b.grade || a.cls - b.cls || a.no - b.no; });
});
// 消す：名簿・配慮項目・つける離す・持ち越し・事案との結び付き・案の割り当てから、その児童の行を消す。
// 結び付く児童がいなくなった事案は、名前とURLを消して削除済みにする。元に戻せない
var apiPurge = api_(function (ids) {
  var by = requireTeacher_();
  if (!ids || !ids.length) throw userError_('消す児童を選んでください');
  var FY = CONFIG.fiscalYear(), set = {}, now = {};
  [FY, FY + 1].forEach(function (fy) { rosterRows_(fy).forEach(function (r) { now[r.id] = 1; }); });
  ids.forEach(function (id) { if (now[id]) throw userError_('今年度の名簿にいる児童は消せません'); set[String(id)] = 1; });
  return withLock_(function () {
    var n = 0;
    db_().getSheets().map(function (sh) { return sh.getName(); }).forEach(function (name) {
      if (/^(roster|attrs)_\d{4}$/.test(name)) n += removeRows_(name, function (r) { return set[String(r.id8)]; });
      else if (/^pairs_/.test(name)) removeRows_(name, function (r) { return set[String(r.a)] || set[String(r.b)]; });
    });
    removeRows_('incident_kids', function (r) { return set[String(r.id8)]; });
    removeRows_('transfers', function (r) { return set[String(r.id8)]; });
    var left = {};
    read_('incident_kids').rows.forEach(function (r) { left[r.inc_id] = 1; });
    var t = read_('incidents');
    t.rows.forEach(function (r) {
      if (!r.deleted && r.inc_id !== '' && !left[r.inc_id]) { writeCell_(t, r, 'title', ''); writeCell_(t, r, 'url', ''); writeCell_(t, r, 'deleted', new Date().toISOString()); }
    });
    read_('settings').rows.forEach(function (r) {
      if (!/^plans_/.test(String(r.key))) return;
      var v = JSON.parse(r.json), ch = false;
      (v.plans || []).forEach(function (p) {
        Object.keys(p.assign || {}).forEach(function (id) { if (set[id]) { delete p.assign[id]; ch = true; } });
        p.locks = (p.locks || []).filter(function (id) { return !set[id]; });
      });
      if (ch) setSetting_(String(r.key), v);
    });
    log_(by, 'purge', ids.length);
    return { kids: ids.length, rows: n };
  });
});

// 名簿を入れる（PR③で画面を作るまでの間、所有者がスクリプトエディタから呼ぶ）
// rows: [[id8, name, kana, 性別, 学年, 組, 番号], ...]
function importRoster(fy, rows) {
  sheet_(db_(), 'roster_' + fy, ROSTER_HEAD);
  sheet_(db_(), 'attrs_' + fy, attrsHead_());
  append_('roster_' + fy, ROSTER_HEAD, rows.map(function (r) {
    return { id8: String(r[0]), name: r[1], kana: r[2], sex: r[3], grade: +r[4], 'class': +r[5], no: +r[6] };
  }));
  return rows.length;
}

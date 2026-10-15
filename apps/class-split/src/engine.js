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
      C.ATTRS.forEach(function (at) { a[at.k] = s.a[at.k] | 0; });
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

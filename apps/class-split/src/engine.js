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
    // 学力の段（2段から下）：段ごとの人数を組でそろえる。1段は「賢い」として上で数える
    var tierMax = 0; P.kids.forEach(function (s) { var t = s.a && s.a.tier | 0; if (t > tierMax) tierMax = t; });
    if ((gen.w.acad | 0) > 0) for (var tr = 2; tr <= tierMax; tr++) (function (tr) {
      MET.push({ k: 'acad' + tr, grp: 'acad', label: '学力' + tr + '段', w: C.LEVEL_W[gen.w.acad | 0], tol: 1, v: function (s) { return (s.a && s.a.tier | 0) === tr ? 1 : 0; } });
    })(tr);
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
    // 「必」の段階の指標（＋の別枠は除く）。各組を平均±1に収めることを必ず守る
    var MU = [];
    MET.forEach(function (m, mi) { if (m.grp !== 'heavy' && (gen.w[m.grp || m.k] | 0) === C.MUST) MU.push(mi); });
    var HV = [];
    MET.forEach(function (m, mi) { if (m.grp === 'heavy') HV.push({ m: mi, max: Math.ceil(MEAN[mi] - 1e-9) }); });
    return { P: P, N: N, nc: nc, cap: P.cap || C.CAP, M: M, MET: MET, VAL: VAL, MEAN: MEAN, SIZE_MEAN: N / nc, HV: HV, MU: MU,
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
      for (var u = 0; u < ctx.MU.length; u++) { var eu = Math.abs(r[ctx.MU[u]] - ctx.MEAN[ctx.MU[u]]) - 1; if (eu > 0) t += W_HARD * eu; }
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
    // 入れ替えのたびに全部を数え直さない：つける・離すは入れ替えた2人に関わる組だけ、事案は2人が関わる事案だけを差し引きする
    var hard = ctx.gen.hard, PAIRS = ctx.P.pairs;
    var brokenOf = function (list) { var n = 0; for (var q = 0; q < list.length; q++) { var p0 = PAIRS[list[q]]; if (hard[p0.t] && pairBroken(p0, asg)) n++; } return n; };
    var INC = ctx.wInc ? (ctx.P.inc || []) : [], incOf = [], cnt = [], v = new Array(nc).fill(0);
    if (ctx.wInc) {
      for (i = 0; i < N; i++) incOf.push([]);
      INC.forEach(function (x, xi) { var row = new Array(nc).fill(0); x.kids.forEach(function (q) { incOf[q].push(xi); if (!row[asg[q]]++) v[asg[q]]++; }); cnt.push(row); });
    }
    var moveInc = function (q, from, to) { var l = incOf[q]; for (var t0 = 0; t0 < l.length; t0++) { var row = cnt[l[t0]]; if (!--row[from]) v[from]--; if (!row[to]++) v[to]++; } };
    var incPen = function () { var m0 = 0, t1 = 0, k0; for (k0 = 0; k0 < nc; k0++) m0 += v[k0]; m0 /= nc; for (k0 = 0; k0 < nc; k0++) t1 += (v[k0] - m0) * (v[k0] - m0); return ctx.wInc * t1; };
    var IT = 50000, T = 8, cool = Math.pow(0.002 / 8, 1 / IT);
    for (var it = 0; it < IT; it++, T *= cool) {
      i = free[Math.floor(r() * free.length)]; j = free[Math.floor(r() * free.length)];
      var a = asg[i], b = asg[j];
      if (a === b) continue;
      var vi = ctx.VAL[i], vj = ctx.VAL[j], m, d;
      for (m = 0; m < M; m++) { d = vj[m] - vi[m]; c[a][m] += d; c[b][m] -= d; }
      var rel = ctx.relOf[i].length || ctx.relOf[j].length ? ctx.relOf[i].concat(ctx.relOf[j].filter(function (q) { return ctx.relOf[i].indexOf(q) < 0; })) : null; // 2人に共通の組は1回だけ数える
      var before = rel ? brokenOf(rel) : 0;
      asg[i] = b; asg[j] = a;
      var npv = rel ? pv - before + brokenOf(rel) : pv;
      if (ctx.wInc) { moveInc(i, a, b); moveInc(j, b, a); }
      var nxt = W_HARD * npv + balance(ctx, c) + (ctx.wInc ? incPen() : 0);
      if (nxt <= cur || r() < Math.exp((cur - nxt) / T)) { cur = nxt; pv = npv; }
      else { asg[i] = a; asg[j] = b; for (m = 0; m < M; m++) { d = vj[m] - vi[m]; c[a][m] -= d; c[b][m] += d; } if (ctx.wInc) { moveInc(j, a, b); moveInc(i, b, a); } }
    }
    return asg;
  }

  // 画面に出す違反（✕）と偏り（△）
  function analyze(ctx, asg) {
    var c = counts(ctx, asg), bad = [], warn = [], kids = ctx.P.kids, k, m;
    ctx.P.pairs.forEach(function (p) {
      if (!pairBroken(p, asg)) return;
      if (p.t === 'far') bad.push({ t: 'far', txt: '離す：' + kids[p.i].name + ' と ' + kids[p.j].name + ' が同じ' + C.newClass(asg[p.i]), ids: [p.i, p.j] });
      else if (p.t === 'near') bad.push({ t: 'near', txt: 'つける：' + kids[p.i].name + '（' + C.newClass(asg[p.i]) + '）と ' + kids[p.j].name + '（' + C.newClass(asg[p.j]) + '）が別', ids: [p.i, p.j] });
      else bad.push({ t: 'fix', txt: '組に固定：' + kids[p.i].name + ' が' + C.newClass(p.k) + 'でない', ids: [p.i] });
    });
    var flag = [];
    for (k = 0; k < ctx.nc; k++) {
      flag.push(new Array(ctx.M + 1).fill(false));
      if (c[k][ctx.M] > ctx.cap) { flag[k][ctx.M] = true; bad.push({ t: 'cap', txt: C.newClass(k) + ' ' + c[k][ctx.M] + '人（上限' + ctx.cap + '人）', ids: [] }); }
      else if (Math.abs(c[k][ctx.M] - ctx.SIZE_MEAN) > 1) { flag[k][ctx.M] = true; warn.push({ txt: C.newClass(k) + ' 人数 ' + c[k][ctx.M] + '（平均' + ctx.SIZE_MEAN.toFixed(1) + '）', k: k, m: ctx.M }); }
      ctx.HV.forEach(function (hv) {
        if (c[k][hv.m] > hv.max) { flag[k][hv.m] = true; bad.push({ t: 'heavy', txt: C.newClass(k) + ' ' + ctx.MET[hv.m].label + ' ' + c[k][hv.m] + '人（各組' + hv.max + '人まで）', ids: [] }); }
      });
      ctx.MU.forEach(function (mi) {
        if (Math.abs(c[k][mi] - ctx.MEAN[mi]) > 1) { flag[k][mi] = true; bad.push({ t: 'must', txt: C.newClass(k) + ' ' + ctx.MET[mi].label + ' ' + c[k][mi] + '人（必：平均' + ctx.MEAN[mi].toFixed(1) + '±1）', ids: [] }); }
      });
      for (m = 0; m < ctx.M; m++) if (ctx.MET[m].grp !== 'heavy' && ctx.MU.indexOf(m) < 0 && Math.abs(c[k][m] - ctx.MEAN[m]) > ctx.MET[m].tol) {
        flag[k][m] = true;
        warn.push({ txt: C.newClass(k) + ' ' + ctx.MET[m].label + ' ' + c[k][m] + '（平均' + ctx.MEAN[m].toFixed(1) + '）', k: k, m: m });
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
      C.ATTRS.forEach(function (at) { a[at.k] = s.a[at.k] | 0; if ((at.side || at.ctx) && s.a[at.k + '_t']) a[at.k + '_t'] = s.a[at.k + '_t']; if (at.ctx && s.a[at.k + '_i']) a[at.k + '_i'] = s.a[at.k + '_i'].slice(); });
      if (s.a.sp) a.sp = 1;
      if (s.a.memo) a.memo = s.a.memo;
      return { id: s.id, cls: num[i].cls, no: num[i].no, a: a };
    });
  }

  // ===== 事案の関係図 =====
  // d = { v:1, nodes:[{id,x,y}], groups:[{g:'A', members:[id]}], edges:[{f:'k:ID'|'g:A', t:同じ}] }
  // 矢印は「加害」を表す。座標は 640×320 の論理座標。児童は1つのグループにだけ入る
  var DG_W = 640, DG_H = 320;
  // 誰か分からない児童（加害者が不明など）：関係図にだけ置く「？」のカード。id は ? で始まり、名簿の児童には結び付けない
  function isUnknown(id) { return String(id).charAt(0) === '?'; }
  function normDiagram(d) {
    d = d || {};
    var ids = {}, nodes = [], gs = {}, groups = [], edges = [], seen = {};
    (d.nodes || []).forEach(function (n) {
      var id = String(n && n.id || ''); if (!id || ids[id]) return;
      ids[id] = 1;
      nodes.push({ id: id, x: Math.max(0, Math.min(DG_W, +n.x || 0)), y: Math.max(0, Math.min(DG_H, +n.y || 0)) });
    });
    var inGroup = {};
    (d.groups || []).forEach(function (gr) {
      var g = String(gr && gr.g || '').slice(0, 4); if (!g || gs[g]) return;
      var m = (gr.members || []).map(String).filter(function (id) { return ids[id] && !inGroup[id]; });
      if (!m.length) return;
      m.forEach(function (id) { inGroup[id] = g; });
      gs[g] = 1; groups.push({ g: g, members: m });
    });
    var ok = function (e) { var p = String(e || '').split(':'); return p.length === 2 && (p[0] === 'k' ? !!ids[p[1]] : p[0] === 'g' && !!gs[p[1]]); };
    (d.edges || []).forEach(function (e) {
      if (!e || !ok(e.f) || !ok(e.t) || e.f === e.t) return;
      var key = e.f + '>' + e.t; if (seen[key]) return;
      seen[key] = 1; edges.push({ f: String(e.f), t: String(e.t) });
    });
    return { v: 1, nodes: nodes, groups: groups, edges: edges };
  }
  function dgMembers(d, end) {
    var p = end.split(':');
    if (p[0] === 'k') return [p[1]];
    var gr = d.groups.filter(function (x) { return x.g === p[1]; })[0];
    return gr ? gr.members.slice() : [];
  }
  // 児童ごとの役割：矢印を出す＝加害、受ける＝被害、両方＝相互、矢印に関わらない＝関係者。グループの矢印は中の全員に効く
  function diagramRoles(d) {
    d = normDiagram(d);
    var out = {}, inn = {}, r = {};
    d.edges.forEach(function (e) {
      dgMembers(d, e.f).forEach(function (id) { out[id] = 1; });
      dgMembers(d, e.t).forEach(function (id) { inn[id] = 1; });
    });
    d.nodes.forEach(function (n) { r[n.id] = out[n.id] && inn[n.id] ? 'mutual' : out[n.id] ? 'harm' : inn[n.id] ? 'victim' : 'related'; });
    return r;
  }
  // 型：相互加害（どこかで向きが両方）か一方的加害か。一方的は、グループの矢印があるか・矢印が2本以上か（複線）で分ける
  function diagramPattern(d) {
    d = normDiagram(d);
    if (!d.edges.length) return '';
    var roles = diagramRoles(d), mutual = Object.keys(roles).some(function (id) { return roles[id] === 'mutual'; });
    var grp = d.edges.some(function (e) { return e.f.charAt(0) === 'g' || e.t.charAt(0) === 'g'; }), multi = d.edges.length > 1;
    if (mutual) return '相互加害' + (grp ? '（グループ）' : '');
    return '一方的加害（' + (grp && multi ? 'グループ・複線' : grp ? 'グループ' : multi ? '複線' : '個人') + '）';
  }
  // 保存時の整理（利用者の置いた位置を元に、動かす量を少なく）：
  // 1) 矢印の出入りがまったく同じ児童（グループに入っていない、矢印のある児童）が2人以上いれば、グループにまとめて矢印を1本にする
  // 2) 矢印で結ばれ、ほぼ水平・ほぼ垂直の組は、高さ・横位置を揃える（はっきり斜めの線は残す）
  // 3) 段と段の空きを詰めて、縦幅を無駄に大きくしない（上下の並び順は変えない）
  // 整理で使う、論理座標でのおおよその大きさ（児童の札・グループの枠）
  var DG_HW = 50, DG_HH = 28;
  function dgBox(d, end) {
    var p = String(end).split(':'), ns;
    if (p[0] === 'k') ns = d.nodes.filter(function (n) { return n.id === p[1]; });
    else { var gr = d.groups.filter(function (x) { return x.g === p[1]; })[0]; ns = gr ? d.nodes.filter(function (n) { return gr.members.indexOf(n.id) >= 0; }) : []; }
    if (!ns.length) return null;
    var pad = p[0] === 'g' ? 12 : 0, b = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
    ns.forEach(function (n) { b.x1 = Math.min(b.x1, n.x - DG_HW - pad); b.x2 = Math.max(b.x2, n.x + DG_HW + pad); b.y1 = Math.min(b.y1, n.y - DG_HH - pad); b.y2 = Math.max(b.y2, n.y + DG_HH + pad); });
    b.cx = (b.x1 + b.x2) / 2; b.cy = (b.y1 + b.y2) / 2; b.ids = ns.map(function (n) { return n.id; });
    return b;
  }
  function segCross(a, b, c, e) {
    var o = function (p, q, r) { var v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return Math.abs(v) < 1e-6 ? 0 : v > 0 ? 1 : -1; };
    var o1 = o(a, b, c), o2 = o(a, b, e), o3 = o(c, e, a), o4 = o(c, e, b);
    if (o1 && o2 && o3 && o4) return o1 !== o2 && o3 !== o4;
    if (!o1 && !o2) { // 同じ直線上：重なっていれば重なり
      var ax = Math.abs(a[0] - b[0]) > Math.abs(a[1] - b[1]) ? 0 : 1;
      var lo = Math.max(Math.min(a[ax], b[ax]), Math.min(c[ax], e[ax])), hi = Math.min(Math.max(a[ax], b[ax]), Math.max(c[ax], e[ax]));
      return hi - lo > 1;
    }
    return false;
  }
  function segHitsBox(p, q, b) {
    var t0 = 0, t1 = 1, dx = q[0] - p[0], dy = q[1] - p[1];
    var cl = function (pp, qq) { if (!pp) return qq >= 0; var r = qq / pp; if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
    return cl(-dx, p[0] - b.x1) && cl(dx, b.x2 - p[0]) && cl(-dy, p[1] - b.y1) && cl(dy, b.y2 - p[1]) && t1 - t0 > 1e-6;
  }
  // 交差・重なりの数：矢印どうしの交差（端を共にしない）・同じ線上の重なり・矢印が関係しない児童を通る・児童の札どうしの重なり
  function dgProblems(d) {
    var segs = d.edges.map(function (e) { var a = dgBox(d, e.f), b = dgBox(d, e.t); return a && b ? { e: e, a: a, b: b, p: [a.cx, a.cy], q: [b.cx, b.cy] } : null; }).filter(Boolean), n = 0;
    for (var i = 0; i < segs.length; i++) {
      for (var j = i + 1; j < segs.length; j++) {
        var s1 = segs[i], s2 = segs[j];
        var share = s1.e.f === s2.e.f || s1.e.f === s2.e.t || s1.e.t === s2.e.f || s1.e.t === s2.e.t;
        if (share) { if (segCross(s1.p, s1.q, s2.p, s2.q) && !(s1.e.f === s2.e.t && s1.e.t === s2.e.f)) { // 端を共にして同じ向きに重なる
          var u1 = [s1.q[0] - s1.p[0], s1.q[1] - s1.p[1]], u2 = [s2.q[0] - s2.p[0], s2.q[1] - s2.p[1]];
          if (Math.abs(u1[0] * u2[1] - u1[1] * u2[0]) < 1e-6) n++;
        } } else if (segCross(s1.p, s1.q, s2.p, s2.q)) n++;
      }
      d.nodes.forEach(function (nd) {
        var s0 = segs[i]; if (s0.a.ids.indexOf(nd.id) >= 0 || s0.b.ids.indexOf(nd.id) >= 0) return;
        if (segHitsBox(s0.p, s0.q, { x1: nd.x - DG_HW + 6, x2: nd.x + DG_HW - 6, y1: nd.y - DG_HH + 6, y2: nd.y + DG_HH - 6 })) n++;
      });
    }
    for (var a = 0; a < d.nodes.length; a++) for (var b = a + 1; b < d.nodes.length; b++) {
      var p1 = d.nodes[a], p2 = d.nodes[b];
      if (Math.abs(p1.x - p2.x) < DG_HW * 2 - 4 && Math.abs(p1.y - p2.y) < DG_HH * 2 - 4) n++;
    }
    return n;
  }
  var TIDY_SNAP = 40, TIDY_GAP = 100, TIDY_TOP = 45;
  function tidyDiagram(d0) {
    var d = normDiagram(JSON.parse(JSON.stringify(d0 || {})));
    var inG = {}; d.groups.forEach(function (gr) { gr.members.forEach(function (id) { inG[id] = gr.g; }); });
    var sig = {};
    d.nodes.forEach(function (n) {
      if (inG[n.id]) return;
      var k = 'k:' + n.id, o = [], i = [];
      d.edges.forEach(function (e) { if (e.f === k) o.push(e.t); if (e.t === k) i.push(e.f); });
      if (!o.length && !i.length) return;
      var key = o.sort().join(',') + '|' + i.sort().join(',');
      (sig[key] = sig[key] || []).push(n.id);
    });
    var LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    Object.keys(sig).forEach(function (key) {
      var ms = sig[key]; if (ms.length < 2) return;
      var used = d.groups.map(function (gr) { return gr.g; }), gname = LET.split('').filter(function (c) { return used.indexOf(c) < 0; })[0];
      if (!gname) return;
      d.groups.push({ g: gname, members: ms.slice() });
      var ks = {}; ms.forEach(function (id) { ks['k:' + id] = 1; });
      var seen = {}, edges = [];
      d.edges.forEach(function (e) {
        var f = ks[e.f] ? 'g:' + gname : e.f, t = ks[e.t] ? 'g:' + gname : e.t, k2 = f + '>' + t;
        if (f === t || seen[k2]) return; seen[k2] = 1; edges.push({ f: f, t: t });
      });
      d.edges = edges;
      // まとめた児童は、いちばん上の児童の下に縦に寄せる（横は平均）
      var ns = d.nodes.filter(function (n) { return ks['k:' + n.id]; }).sort(function (a, b) { return a.y - b.y; });
      var cx = ns.reduce(function (s0, n) { return s0 + n.x; }, 0) / ns.length;
      ns.forEach(function (n, j) { n.x = Math.round(cx); n.y = ns[0].y + j * (DG_HH * 2 + 4); });
    });
    // 動かす単位：グループ（中の児童ごと）と、グループに入っていない児童
    var byId = {}; d.nodes.forEach(function (n) { byId[n.id] = n; });
    var unit = {};
    d.groups.forEach(function (gr) { unit['g:' + gr.g] = gr.members.map(function (id) { return byId[id]; }).filter(Boolean); });
    d.nodes.forEach(function (n) { var g0 = d.groups.filter(function (gr) { return gr.members.indexOf(n.id) >= 0; })[0]; if (!g0) unit['k:' + n.id] = [n]; });
    var ctr = function (u) { var ns = unit[u] || []; return ns.length ? [ns.reduce(function (s0, n) { return s0 + n.x; }, 0) / ns.length, ns.reduce(function (s0, n) { return s0 + n.y; }, 0) / ns.length] : null; };
    var shift = function (u, dx, dy) { (unit[u] || []).forEach(function (n) { n.x += dx; n.y += dy; }); };
    // ほぼ水平（ほぼ垂直）の線で結ばれた単位を束ね、束ごとに平均の高さ（横位置）に揃える
    [1, 0].forEach(function (ax) {
      var par = {}, find = function (u) { while (par[u] && par[u] !== u) u = par[u]; return u; };
      Object.keys(unit).forEach(function (u) { par[u] = u; });
      d.edges.forEach(function (e) {
        var a = ctr(e.f), b = ctr(e.t); if (!a || !b) return;
        var along = Math.abs(a[1 - ax] - b[1 - ax]), across = Math.abs(a[ax] - b[ax]);
        if (across > 0 && across <= TIDY_SNAP && along > across * 2) par[find(e.f)] = find(e.t);
      });
      var sets = {}; Object.keys(unit).forEach(function (u) { (sets[find(u)] = sets[find(u)] || []).push(u); });
      Object.keys(sets).forEach(function (r) {
        var us = sets[r]; if (us.length < 2) return;
        var m = us.reduce(function (s0, u) { return s0 + ctr(u)[ax]; }, 0) / us.length;
        us.forEach(function (u) { var c = ctr(u)[ax]; shift(u, ax ? 0 : m - c, ax ? m - c : 0); });
      });
    });
    // 矢印の交差・重なり（線が別の児童を通る・同じ線上に重なる・児童どうしが重なる）を、少ない移動で無くす
    var orig = {}; d.nodes.forEach(function (n) { orig[n.id] = [n.x, n.y]; });
    var bad = function () { return dgProblems(d); };
    var cost = function () {
      var c = bad() * 1000;
      d.edges.forEach(function (e) { var a = dgBox(d, e.f), b = dgBox(d, e.t); if (a && b && Math.abs(a.cx - b.cx) > 1 && Math.abs(a.cy - b.cy) > 1) c += 3; });
      d.nodes.forEach(function (n) { c += (Math.abs(n.x - orig[n.id][0]) + Math.abs(n.y - orig[n.id][1])) / 10; });
      return c;
    };
    var MOVES = [[0, 50], [0, -50], [0, 100], [0, -100], [0, 150], [0, -150], [0, 200], [0, -200], [80, 0], [-80, 0], [160, 0], [-160, 0], [80, 50], [-80, 50], [80, -50], [-80, -50]];
    var inside = function (u) { return (unit[u] || []).every(function (n) { return n.x >= 30 && n.x <= DG_W - 30 && n.y >= 20 && n.y <= DG_H - 20; }); };
    var t0 = Date.now(); // 大きな図でも待たせない：0.3秒で打ち切る（それまでに直せた所までで止める）
    for (var it = 0; it < 40 && Date.now() - t0 < 300 && bad(); it++) {
      var c0 = cost(), best = null;
      Object.keys(unit).forEach(function (u) {
        MOVES.forEach(function (m) {
          shift(u, m[0], m[1]);
          if (inside(u)) { var c1 = cost(); if (c1 < c0 - 0.5 && (!best || c1 < best.c)) best = { u: u, m: m, c: c1 }; }
          shift(u, -m[0], -m[1]);
        });
      });
      // 2つの単位の位置を入れ替える（交差は1つずつの移動では解けないことが多い）
      var us = Object.keys(unit);
      for (var i1 = 0; i1 < us.length; i1++) for (var i2 = i1 + 1; i2 < us.length; i2++) {
        var p1 = ctr(us[i1]), p2 = ctr(us[i2]), m = [p2[0] - p1[0], p2[1] - p1[1]];
        shift(us[i1], m[0], m[1]); shift(us[i2], -m[0], -m[1]);
        var c2 = cost(); if (c2 < c0 - 0.5 && (!best || c2 < best.c)) best = { u: us[i1], u2: us[i2], m: m, c: c2 };
        shift(us[i1], -m[0], -m[1]); shift(us[i2], m[0], m[1]);
      }
      if (!best) break;
      shift(best.u, best.m[0], best.m[1]); if (best.u2) shift(best.u2, -best.m[0], -best.m[1]);
    }
    // 段の空きを詰める（詰めて交差・重なりが増えるなら詰めない）
    var b0 = bad(), keep = d.nodes.map(function (n) { return [n.x, n.y]; });
    var ys = d.nodes.map(function (n) { return n.y; }).sort(function (a, b) { return a - b; }), map = {}, cur = TIDY_TOP;
    ys.forEach(function (y, i) { if (i) cur += Math.min(y - ys[i - 1], TIDY_GAP); map[y] = cur; });
    d.nodes.forEach(function (n) { n.y = map[n.y]; });
    if (bad() > b0) d.nodes.forEach(function (n, i) { n.x = keep[i][0]; n.y = keep[i][1]; });
    d.nodes.forEach(function (n) {
      n.y = Math.round(Math.max(0, Math.min(DG_H, n.y)));
      n.x = Math.round(Math.max(0, Math.min(DG_W, n.x)));
    });
    return d;
  }
  var ROLE_NAMES = { harm: '加害', victim: '被害', mutual: '相互', related: '関係者' };

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
    nextYearRows: nextYearRows, checkInvariants: checkInvariants,
    normDiagram: normDiagram, diagramRoles: diagramRoles, isUnknown: isUnknown, UNKNOWN_NAME: '？', diagramPattern: diagramPattern, tidyDiagram: tidyDiagram, diagramProblems: dgProblems, ROLE_NAMES: ROLE_NAMES, DG_W: DG_W, DG_H: DG_H
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

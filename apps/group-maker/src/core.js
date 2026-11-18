// グループ分けの計算（画面に依存しない。tests/core.test.mjs が直接読む）。
(function (g) {
  'use strict';
  var MIN = 2, MAX = 30;

  // 組ごとの人数。指定人数の組を作り、割り切れない分は「多い組」に回す（利用者の判断：指定より少ない組は作らない）。
  // 31人を4人組 → 5,5,5,4,4,4,4。指定人数より人が少なければ全員で1組。
  // 不変条件：合計＝n、どの組も size 以上（n < size の時の1組を除く）
  function sizes(n, size) {
    if (n <= 0) return [];
    var k = Math.max(1, Math.floor(n / size)), base = Math.floor(n / k), extra = n % k, out = [];
    for (var i = 0; i < k; i++) out.push(base + (i < extra ? 1 : 0));
    return out;
  }

  function key(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  function pairSet(list) { var s = {}; (list || []).forEach(function (p) { s[key(p[0], p[1])] = 1; }); return s; }
  // 組の案から「同じ組だった2人」の一覧を作る（前回を避けるために使う）
  function pairsOf(groups) {
    var out = [];
    groups.forEach(function (gr) { for (var i = 0; i < gr.length; i++) for (var j = i + 1; j < gr.length; j++) out.push([gr[i], gr[j]]); });
    return out;
  }

  var W_APART = 1000, W_PREV = 1; // 離す組合せは必ず守る側、前回の相手は「なるべく」

  function cost(groups, apart, prev) {
    var c = 0, a = 0, p = 0;
    groups.forEach(function (gr) {
      for (var i = 0; i < gr.length; i++) for (var j = i + 1; j < gr.length; j++) {
        var k = key(gr[i], gr[j]);
        if (apart[k]) a++;
        if (prev[k]) p++;
      }
    });
    c = a * W_APART + p * W_PREV;
    return { cost: c, apart: a, prev: p };
  }

  // ids をランダムに組へ分け、離す組合せ・前回の相手が同じ組にならないよう入れ替えで直す。
  // opt: { apart:[[id,id]], prev:[[id,id]], rand: ()=>[0,1) }
  // 返り値: { groups:[[id]], apart: 守れなかった離す組合せの数, prev: 前回と同じ相手の組の数 }
  function make(ids, size, opt) {
    opt = opt || {};
    var rand = opt.rand || Math.random, apart = pairSet(opt.apart), prev = pairSet(opt.prev);
    var a = ids.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    var sz = sizes(a.length, size), groups = [], at = 0;
    // 人数の多い組の位置もランダムにする（いつも1組目が多い、を避ける）
    for (i = sz.length - 1; i > 0; i--) { j = Math.floor(rand() * (i + 1)); t = sz[i]; sz[i] = sz[j]; sz[j] = t; }
    sz.forEach(function (s) { groups.push(a.slice(at, at + s)); at += s; });
    var cur = cost(groups, apart, prev);
    if (groups.length > 1 && cur.cost > 0) {
      // 入れ替えの山登り。悪くならない入れ替えは採る（同点でも動かして偏りを残さない）
      for (var it = 0; it < 4000 && cur.cost > 0; it++) {
        var g1 = Math.floor(rand() * groups.length), g2 = Math.floor(rand() * groups.length);
        if (g1 === g2) continue;
        var i1 = Math.floor(rand() * groups[g1].length), i2 = Math.floor(rand() * groups[g2].length);
        t = groups[g1][i1]; groups[g1][i1] = groups[g2][i2]; groups[g2][i2] = t;
        var nx = cost(groups, apart, prev);
        if (nx.cost <= cur.cost) cur = nx;
        else { groups[g2][i2] = groups[g1][i1]; groups[g1][i1] = t; }
      }
    }
    return { groups: groups, apart: cur.apart, prev: cur.prev };
  }

  // 名前の表示。mode: 'no'（出席番号）／'sei'（名字）／'full'（フルネーム）
  // 名字は姓と名の間の空白で切る。空白が無い名前は名字にできないので、フルネームのまま出す。
  // 名簿の中で名字が同じ児童は、名の1字目を添えて見分ける（例：佐藤 健・佐藤 美）。
  function splitName(name) { var m = String(name).trim().split(/[\s　]+/); return m.length >= 2 ? { sei: m[0], mei: m.slice(1).join('') } : null; }
  function labels(roster, mode) {
    var out = {}, count = {};
    if (mode === 'sei') roster.forEach(function (s) { var p = splitName(s.name); if (p) count[p.sei] = (count[p.sei] || 0) + 1; });
    roster.forEach(function (s) {
      if (mode === 'no') { out[s.key] = String(s.no); return; }
      var p = splitName(s.name);
      if (mode === 'full' || !p) { out[s.key] = p ? p.sei + ' ' + p.mei : String(s.name).trim(); return; }
      out[s.key] = count[p.sei] > 1 ? p.sei + ' ' + p.mei.charAt(0) : p.sei;
    });
    return out;
  }
  function noSpaceCount(roster) { return roster.filter(function (s) { return !splitName(s.name); }).length; }

  // 組の名前（グループ名をつける時）
  function groupName(i) { return (i + 1) + '班'; }

  // 名簿の児童の鍵：組＋番号（貼り直しても同じ児童を同じ鍵で指す。欠席・離す組合せを引き継ぐ）
  function studentKey(s) { return (s.cls >= 0 ? s.cls + 1 : 0) + '-' + s.no; }

  var api = { MIN: MIN, MAX: MAX, sizes: sizes, make: make, pairsOf: pairsOf, labels: labels, splitName: splitName,
    noSpaceCount: noSpaceCount, groupName: groupName, studentKey: studentKey, key: key };
  g.GroupCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

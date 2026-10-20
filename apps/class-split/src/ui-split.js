// クラス分け：全員を1画面に並べ、案をタブに積み、入れ替え・比較・決定する。
// 計算はすべて Engine。ここは状態と描画と操作だけを持つ。
(function (g) {
  'use strict';
  var App = g.App, C = g.CONFIG, E = g.Engine;
  var LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var S = null; // { P, ctx, plans, active, view, sel, follow, lastGen, nc, readOnly }

  // ===== 読み込み：今年度の名簿から問題を組み立てる =====
  function build() {
    var d = App.st.data, cur = d.years.filter(function (y) { return y.fy === d.fy; })[0];
    var rows = cur.rows.slice().sort(function (a, b) { return a.cls - b.cls || a.no - b.no; });
    var idx = {};
    var kids = rows.map(function (r, i) {
      var s = d.kids[r.id]; idx[r.id] = i;
      return { id: r.id, name: s.name, kana: s.kana, male: s.male, old: r.cls, no: r.no, a: r.a, area: s.area };
    });
    // 新年度の転入生：旧学級は無し（-1）。名簿の児童の後ろに並べる
    (d.transfers || []).forEach(function (t) {
      idx[t.id] = kids.length;
      kids.push({ id: t.id, name: t.name, kana: t.kana, male: t.male, old: -1, no: 0, a: {}, area: '', tr: true });
    });
    var pairs = [];
    d.pairs.forEach(function (p) {
      if (!(p.a in idx)) return;
      if (p.t === 'fix') pairs.push({ t: 'fix', i: idx[p.a], k: p.k });
      else if (p.b in idx) pairs.push({ t: p.t, i: idx[p.a], j: idx[p.b] });
    });
    // 事案数は在籍中の全期間で数える（同じ事案は1件）
    var inc = d.incidents.map(function (x) { return { kids: x.ids.filter(function (id) { return id in idx; }).map(function (id) { return idx[id]; }), src: x }; })
      .filter(function (x) { return x.kids.length; });
    var oldN = 0; kids.forEach(function (s) { if (s.old + 1 > oldN) oldN = s.old + 1; });
    var nc = Math.min(C.MAX_CLASSES, Math.max(2, oldN));
    var P = { kids: kids, pairs: pairs, inc: inc, nc: nc, cap: C.CAP };
    var ji = kids.map(function () { return 0; }), jv = kids.map(function () { return 0; });
    inc.forEach(function (x) { x.kids.forEach(function (i) { ji[i]++; if (App.isVictim(x.src, kids[i].id)) jv[i]++; }); });
    inc.forEach(function (x) { delete x.src; });
    S = { P: P, idx: idx, ji: ji, jv: jv, plans: [], active: 0, view: 'plan', sel: -1, follow: null, lastGen: E.defaultGen(), letIdx: 0,
      decision: d.decision };
    S.ctx = E.prepare(P, S.lastGen);
    // 保存済みの案を戻す
    (d.plans || []).forEach(function (sp) {
      var asg = new Int8Array(kids.length);
      var miss = [], sz = new Array(nc).fill(0);
      kids.forEach(function (s, i) { if (s.id in sp.assign) { asg[i] = sp.assign[s.id] | 0; sz[asg[i]]++; } else miss.push(i); });
      // 案を作った後に足した転入生は、その案でいちばん人数の少ない組に入れる
      miss.forEach(function (i) { var k = sz.indexOf(Math.min.apply(null, sz)); asg[i] = k; sz[k]++; });
      var locks = new Set((sp.locks || []).filter(function (id) { return id in idx; }).map(function (id) { return idx[id]; }));
      S.plans.push({ letter: sp.letter, name: sp.name, auto: sp.auto, gen: sp.gen || E.defaultGen(), asg: asg, locks: locks, hist: [], fut: [], edits: sp.edits | 0, from: sp.from || null });
      var li = LET.indexOf(sp.letter); if (li + 1 > S.letIdx) S.letIdx = li + 1;
    });
    // 案がまだ無い時は、いきなり作らず、重み付けと並び順を決めてから作る（enter で設定の窓を開く）
  }

  function ctxFor(gen) { return E.prepare(S.P, gen); }
  function planName(p) { return '案' + p.letter + '（' + (p.name || p.auto) + '）'; }

  function serialize() {
    return S.plans.map(function (p) {
      var assign = {}; S.P.kids.forEach(function (s, i) { assign[s.id] = p.asg[i]; });
      return { letter: p.letter, name: p.name || '', auto: p.auto, gen: p.gen, assign: assign, locks: Array.from(p.locks).map(function (i) { return S.P.kids[i].id; }), edits: p.edits, from: p.from };
    });
  }
  // 案の保存は少し待ってまとめる。学年と中身は呼んだ時点で決め（待つ間に学年を変えても、元の学年に保存する）、画面を離れる時はすぐ送る
  var saveT = 0, pend = null;
  function persist() {
    clearTimeout(saveT);
    App.saveState('saving');
    var grade = App.st.grade, S0 = S;
    pend = function () { pend = null; var cur = S; S = S0; var data = serialize(); S = cur; App.save(function () { return App.pf().savePlans(grade, data); }, 'plans:' + grade); };
    saveT = setTimeout(function () { if (pend) pend(); }, 1200);
  }
  function flush() { clearTimeout(saveT); if (pend) pend(); }

  function addGenerated(gen, locked, from) {
    var ctx = ctxFor(gen), t0 = performance.now();
    var asg = E.optimize(ctx, locked, (Date.now() & 0xffff) * 7919 + S.letIdx);
    var p = { letter: LET[S.letIdx++ % 26], name: '', auto: E.autoName(gen, locked.size), gen: JSON.parse(JSON.stringify(gen)), asg: asg,
      locks: new Set(locked.keys()), hist: [], fut: [], edits: 0, from: from };
    S.plans.push(p); S.active = S.plans.length - 1; S.view = 'plan'; S.sel = -1; S.follow = null;
    return { p: p, ms: Math.round(performance.now() - t0) };
  }

  // ===== 項目で絞って見る：組の見出しの項目を押すと、その項目の児童以外を暗くする（もう一度押すか Esc で戻す） =====
  function applyHl() {
    var board = App.$('board'); if (!board) return;
    board.classList.toggle('hl', !!S.hl);
    board.querySelectorAll('.chip').forEach(function (el) {
      var s = S.P.kids[+el.dataset.i];
      el.classList.toggle('hit', !!S.hl && (s.a[S.hl] | 0) > 0);
    });
    board.querySelectorAll('[data-hl]').forEach(function (el) { el.classList.toggle('on', el.dataset.hl === S.hl); });
  }

  // ===== 並び順：組の中の児童の並べ方（第一〜第三優先）。この端末にだけ覚える =====
  var SORT_KEYS = [
    { k: 'old', label: '旧クラス', f: function (s) { return s.old < 0 ? 99 : s.old; } }, // 転入生は最後
    { k: 'male', label: '男女（男が先）', f: function (s) { return s.male ? 0 : 1; } },
    { k: 'female', label: '男女（女が先）', f: function (s) { return s.male ? 1 : 0; } },
    { k: 'no', label: '旧出席番号', f: function (s) { return s.old < 0 ? 999 : s.no; } },
    { k: 'kana', label: 'よみ（五十音）', f: null },
    { k: 'plus', label: '＋付きが先', f: function (s) { return hasPlus(s) ? 0 : 1; } }
  ];
  // 負担の＋（担任の負担が明確に増える印）が1つでもある児童
  function hasPlus(s) { return C.ATTRS.some(function (at) { return at.heavy && (s.a[at.k] | 0) >= 2; }); }
  var DEF_ORDER = ['old', 'no', ''];
  function loadOrder() { try { var v = JSON.parse(localStorage.getItem('classSplit.order')); if (Array.isArray(v) && v.length === 3) return v; } catch (e) { /* 読めない時は既定 */ } return DEF_ORDER.slice(); }
  var ORDER = loadOrder();
  function byOrder(x, y) { return App.byKeys(SORT_KEYS, ORDER, S.P.kids[x], S.P.kids[y]); }
  function orderDialog() {
    App.orderDialog({ title: '組の中の並び順', keys: SORT_KEYS, def: DEF_ORDER, cur: ORDER, onOk: function (O) {
      ORDER = O;
      try { localStorage.setItem('classSplit.order', JSON.stringify(ORDER)); } catch (e) { /* 覚えられなくても今の画面には効く */ }
      render();
    } });
  }

  /* @include split/split-board.js */
  /* @include split/split-dialogs.js */
  /* @include split/split-pairs.js */
  /* @include split/split-actions.js */
  /* @include split/split-zoom.js */
  /* @include split/split-excel.js */

  App.screens.split = {
    enter: function () {
      var d = App.st.data, cur = d.years.filter(function (y) { return y.fy === d.fy; })[0];
      if (d.grade >= 6) { App.$('main').innerHTML = '<div class="menu"><section><h2>6年は卒業するので、クラス分けはありません</h2><button class="btn" data-go="menu">メニューに戻る</button></section></div>'; return; }
      if (!cur || !cur.rows.length) { // 名簿が無いと組めない
        App.$('main').innerHTML = '<div class="menu"><section><h2>' + d.grade + '年の今年度の名簿がありません</h2><p>先に名簿を入れてください。</p>' +
          '<button class="btn primary" data-go="roster">名簿へ</button></section></div>';
        return;
      }
      build(); document.body.classList.add('fit');
      if (!S.plans.length) { renderSetup(); genDialog(); return; }
      render();
    },
    leave: function () { flush(); if (PRT_CLOSE) PRT_CLOSE(); if (DEAL) { clearTimeout(DEAL.t); DEAL = null; } document.body.classList.remove('fit'); },
    render: function () { if (S) render(); },
    state: function () { return S; },
    click: function (t, e) {
      var x;
      if (t.closest('#zreset')) { zoomReset(); return true; }
      if (t.closest('#xlsOut')) { exportExcel(); return true; }
      if ((x = t.closest('[data-del]'))) {
        e.stopPropagation(); delDialog(+x.dataset.del); return true;
      }
      if (t.closest('#delp')) { delDialog(S.active); return true; }
      if ((x = t.closest('.tab'))) { if (x.dataset.cmp) { S.view = 'cmp'; S.sel = -1; S.follow = null; render(); } else selectPlan(+x.dataset.p); return true; }
      if ((x = t.closest('th[data-p]'))) { selectPlan(+x.dataset.p); return true; }
      if (t.closest('#vbtn')) { showViol(); return true; }
      if (t.closest('#undo')) { undo(); return true; }
      if (t.closest('#redo')) { redo(); return true; }
      if (t.closest('#dup')) { dup(); return true; }
      if (t.closest('#gen')) { genDialog(); return true; }
      if (t.closest('#fs')) { fullscreen(); return true; }
      if (t.closest('#hbtn')) { helpDialog(); return true; }
      if (t.closest('#pairs')) { pairsDialog(); return true; }
      if (t.closest('#cnames')) { namesDialog(); return true; }
      if (t.closest('#trans')) { transDialog(); return true; }
      if (t.closest('#order')) { orderDialog(); return true; }
      if (t.closest('#prt')) { printCards(); return true; }
      if (t.closest('#decide')) { decideDialog(); return true; }
      if (t.closest('#undoDecide')) { undoDecideDialog(); return true; }
      // カードの事案の数を押すと、その児童の経年の記録と事案を窓で見る（児童は選ばない）
      if ((x = t.closest('.board .chip .jr')) && x.querySelector('.jn')) { var kc = S.P.kids[+x.closest('.chip').dataset.i]; if (!kc.tr) App.showRecord(kc.id); return true; }
      // カードの右下の灰色の角：その児童の経年の記録と事案（名簿の表と同じ印）
      if ((x = t.closest('.board .chip')) && e) {
        var q = x.getBoundingClientRect();
        if (e.clientX >= q.right - 16 && e.clientY >= q.bottom - 16) { var kc2 = S.P.kids[+x.dataset.i]; if (!kc2.tr) App.showRecord(kc2.id); return true; }
      }
      if ((x = t.closest('.board .chip'))) { tapChip(+x.dataset.i); return true; }
      if ((x = t.closest('[data-hl]'))) { S.hl = S.hl === x.dataset.hl ? null : x.dataset.hl; applyHl(); return true; }
      if ((x = t.closest('.head'))) { tapHead(+x.dataset.k); return true; }
      if (t.closest('#board') && S.sel >= 0 && S.follow == null) { S.sel = -1; updateSel(); return true; }
      return false;
    },
    dblclick: function (t) { var x = t.closest('.tab[data-p]'); if (x && !S.decision) { renameDialog(+x.dataset.p); return true; } return false; },
    key: function (e) {
      var k = e.key, ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return true; }
      if (ctrl && (k === 'y' || k === 'Y')) { e.preventDefault(); redo(); return true; }
      if (ctrl || e.altKey) return false;
      if ((k === 'Enter' || k === ' ') && e.target.matches('.chip,.head,.tab,th[data-p]')) { e.preventDefault(); e.target.click(); return true; }
      if (k === 'Escape') { if (S.sel >= 0 || S.follow != null) { S.sel = -1; S.follow = null; updateSel(); } else if (S.hl) { S.hl = null; applyHl(); } return true; }
      if (/^[1-9]$/.test(k)) { if (+k - 1 < S.plans.length) selectPlan(+k - 1); return true; }
      if (k === '0') { S.view = 'cmp'; S.sel = -1; S.follow = null; render(); return true; }
      var K = k.toLowerCase();
      if (K === 'g' && !S.decision) { genDialog(); return true; }
      if (K === 'd') { dup(); return true; }
      if (k === 'Delete' && S.view === 'plan') { delDialog(S.active); return true; }
      if (K === 'p' && !S.decision) { pairsDialog(); return true; }
      if (K === 'l' && S.view === 'plan') { toggleLock(); return true; }
      if (K === 'f') { fullscreen(); return true; }
      if (K === 'v' && S.view === 'plan') { showViol(); return true; }
      if (k === '?') { helpDialog(); return true; }
      return false;
    },
    resize: function () { if (S && S.view === 'plan') render(); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

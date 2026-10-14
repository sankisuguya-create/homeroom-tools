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
    var pairs = [];
    d.pairs.forEach(function (p) {
      if (!(p.a in idx)) return;
      if (p.t === 'fix') pairs.push({ t: 'fix', i: idx[p.a], k: p.k });
      else if (p.b in idx) pairs.push({ t: p.t, i: idx[p.a], j: idx[p.b] });
    });
    // 事案数は在籍中の全期間で数える（同じ事案は1件）
    var inc = d.incidents.map(function (x) { return { kids: x.ids.filter(function (id) { return id in idx; }).map(function (id) { return idx[id]; }) }; })
      .filter(function (x) { return x.kids.length; });
    var oldN = 0; kids.forEach(function (s) { if (s.old + 1 > oldN) oldN = s.old + 1; });
    var nc = Math.min(C.MAX_CLASSES, Math.max(2, oldN));
    var P = { kids: kids, pairs: pairs, inc: inc, nc: nc, cap: C.CAP };
    var ji = kids.map(function () { return 0; });
    inc.forEach(function (x) { x.kids.forEach(function (i) { ji[i]++; }); });
    S = { P: P, idx: idx, ji: ji, plans: [], active: 0, view: 'plan', sel: -1, follow: null, lastGen: E.defaultGen(), letIdx: 0,
      decision: d.decision };
    S.ctx = E.prepare(P, S.lastGen);
    // 保存済みの案を戻す
    (d.plans || []).forEach(function (sp) {
      var asg = new Int8Array(kids.length);
      kids.forEach(function (s, i) { asg[i] = sp.assign[s.id] | 0; });
      var locks = new Set((sp.locks || []).filter(function (id) { return id in idx; }).map(function (id) { return idx[id]; }));
      S.plans.push({ letter: sp.letter, name: sp.name, auto: sp.auto, gen: sp.gen || E.defaultGen(), asg: asg, locks: locks, hist: [], fut: [], edits: sp.edits | 0, from: sp.from || null });
      var li = LET.indexOf(sp.letter); if (li + 1 > S.letIdx) S.letIdx = li + 1;
    });
    if (!S.plans.length) { addGenerated(E.defaultGen(), new Map(), null); persist(); } // 最初の案もすぐ保存する
  }

  function ctxFor(gen) { return E.prepare(S.P, gen); }
  function planName(p) { return '案' + p.letter + '（' + (p.name || p.auto) + '）'; }

  function serialize() {
    return S.plans.map(function (p) {
      var assign = {}; S.P.kids.forEach(function (s, i) { assign[s.id] = p.asg[i]; });
      return { letter: p.letter, name: p.name || '', auto: p.auto, gen: p.gen, assign: assign, locks: Array.from(p.locks).map(function (i) { return S.P.kids[i].id; }), edits: p.edits, from: p.from };
    });
  }
  var saveT = 0;
  function persist() {
    clearTimeout(saveT);
    App.saveState('saving');
    saveT = setTimeout(function () { var grade = App.st.grade, data = serialize(); App.save(function () { return App.pf().savePlans(grade, data); }); }, 1200);
  }

  function addGenerated(gen, locked, from) {
    var ctx = ctxFor(gen), t0 = performance.now();
    var asg = E.optimize(ctx, locked, (Date.now() & 0xffff) * 7919 + S.letIdx);
    var p = { letter: LET[S.letIdx++ % 26], name: '', auto: E.autoName(gen, locked.size), gen: JSON.parse(JSON.stringify(gen)), asg: asg,
      locks: new Set(locked.keys()), hist: [], fut: [], edits: 0, from: from };
    S.plans.push(p); S.active = S.plans.length - 1; S.view = 'plan'; S.sel = -1; S.follow = null;
    return { p: p, ms: Math.round(performance.now() - t0) };
  }

  // ===== 描画 =====
  function chipHTML(i, cls, extra) {
    var s = S.P.kids[i], oc = App.classColor(s.old), esc = App.esc;
    // 2段目のアイコンは項目ごとに決まった位置（--s 番目の枠）に置く。空の枠は要素を作らない（140人×10枠の要素が重いため）
    var slot = function (good) {
      var n = 0, out = '', ats = C.ATTRS.filter(function (at) { return !!at.good === !!good; });
      // 良い項目（1段目）は右詰め：ある分だけを枠の右端から並べる。2段目は項目ごとに決まった位置
      if (good) n = ats.length - ats.filter(function (at) { return s.a[at.k] | 0; }).length;
      ats.forEach(function (at) {
        var v = s.a[at.k] | 0;
        if (v) out += App.mark(at, v).replace('style="', 'style="--s:' + n + ';');
        if (v || !good) n++;
      });
      if (!good && S.ji[i]) out += '<span class="jn" style="--s:' + n + '" title="事案' + S.ji[i] + '件">' + S.ji[i] + '</span>';
      return out;
    };
    return '<div class="chip ' + (s.male ? 'm' : 'f') + ' ' + (cls || '') + '" style="--oc:' + oc.c + ';--ot:' + oc.t + ';--ol:' + oc.l + '" data-i="' + i + '" role="button" tabindex="0" title="' + esc(s.name) + '（旧' + (s.old + 1) + '組' + s.no + '番・' + (s.male ? '男' : '女') + '）">' +
      '<span class="old">' + s.no + '</span><span class="l1"><span class="nm">' + esc(s.name) + '</span>' + (extra || '') + '<span class="bs gd">' + slot(1) + '</span></span><span class="bs">' + slot(0) + '</span></div>';
  }

  function renderBar() {
    var h = '<button class="btn trial"></button><button class="btn" data-go="menu" title="メニューに戻る">← ' + App.st.grade + '年</button><div class="tabs" role="tablist">';
    S.plans.forEach(function (p, pi) {
      var a = E.analyze(S.ctx, p.asg), v = a.bad.length;
      h += '<span class="tab" role="tab" tabindex="0" data-p="' + pi + '" aria-selected="' + (S.view === 'plan' && pi === S.active) + '" title="ダブルクリックで名前を変える">' +
        (pi < 9 ? '<span class="k">' + (pi + 1) + '</span>' : '') + App.esc(planName(p)) + '<span class="v ' + (v ? 'bad' : '') + '">違反' + v + '・△' + a.warn.length + '</span>' +
        (S.plans.length > 1 && !S.decision ? '<button class="x" data-del="' + pi + '" aria-label="' + p.letter + 'を削除">×</button>' : '') + '</span>';
    });
    h += '<span class="tab cmp" role="tab" tabindex="0" data-cmp="1" aria-selected="' + (S.view === 'cmp') + '"><span class="k">0</span>比較（' + S.plans.length + '案）</span></div>';
    var p = S.plans[S.active], ro = !!S.decision;
    h += '<button class="vio" id="vbtn"' + (S.view === 'cmp' ? ' hidden' : '') + '></button><span class="hint" id="hint"></span><span class="save" id="save2" aria-live="polite"></span>';
    if (ro) h += '<span class="decided">決定済み：' + App.esc(S.decision.plan) + '　4/1まで取り消せます<button class="btn danger" id="undoDecide">決定を取り消す…</button></span>';
    else {
      h += '<button class="btn" id="undo"' + (S.view !== 'plan' || !p.hist.length ? ' disabled' : '') + '>↶ 戻す<kbd>Ctrl+Z</kbd></button>' +
        '<button class="btn" id="redo"' + (S.view !== 'plan' || !p.fut.length ? ' disabled' : '') + '>↷<kbd>Ctrl+Y</kbd></button>' +
        '<button class="btn" id="dup"' + (S.view !== 'plan' ? ' disabled' : '') + '>複製<kbd>D</kbd></button>' +
        (S.plans.length > 1 && !S.decision ? '<button class="btn" id="delp"' + (S.view !== 'plan' ? ' disabled' : '') + '>削除<kbd>Del</kbd></button>' : '') +
        '<button class="btn" id="pairs">つける・離す…<kbd>P</kbd></button>' +
        '<button class="btn" id="decide"' + (App.st.grade >= 6 ? ' disabled title="6年は決定しません"' : '') + '>決定…</button>';
    }
    h += '<button class="btn" id="fs">全画面<kbd>F</kbd></button><button class="btn" id="hbtn" aria-label="ショートカット一覧">?</button>';
    if (!ro) h += '<button class="btn primary" id="gen">案を作る<kbd>G</kbd></button>';
    return '<div class="bar">' + h + '</div>';
  }

  // 盤面の描画。重い処理（寸法の計測）はカードを入れる前に1回だけ行う
  function render() {
    App.$('main').innerHTML = renderBar() + '<div id="board" class="board"></div><div class="legend" id="legend"></div>';
    App.saveState(); App.paintTrial();
    if (S.view === 'cmp') { renderCmp(); return; }
    var p = S.plans[S.active], a = E.analyze(S.ctx, p.asg), nc = S.P.nc;
    var vb = App.$('vbtn');
    vb.className = 'vio' + (a.bad.length ? ' has' : '');
    vb.innerHTML = (a.bad.length ? '✕ 違反 ' + a.bad.length : '違反なし') + '・△ ' + a.warn.length + ' ▾<kbd>V</kbd>';
    var rows = 1, per = [], k, i;
    for (k = 0; k < nc; k++) {
      var ids = [];
      for (i = 0; i < S.ctx.N; i++) if (p.asg[i] === k) ids.push(i);
      ids.sort(function (x, y) { return S.P.kids[x].old - S.P.kids[y].old || S.P.kids[x].no - S.P.kids[y].no; });
      var half = Math.ceil(ids.length / 2);
      per.push([ids.slice(0, half), ids.slice(half)]); rows = Math.max(rows, half);
    }
    var M = S.ctx.M, h = '<div class="cols" style="--nc:' + nc + '">';
    var HM = S.ctx.MET.findIndex(function (m) { return m.k === 'heavy'; });
    for (k = 0; k < nc; k++) {
      var c = a.c[k], fl = a.flag[k];
      var cnt = function (m, inner) { return '<span class="c ' + (fl[m] ? 'w' : '') + '">' + inner + c[m] + '</span>'; };
      h += '<section class="col"><div class="head" data-k="' + k + '" role="button" tabindex="0">' +
        '<div class="h1"><b>' + (k + 1) + '組</b><span class="' + (fl[M] ? 'w' : '') + '">' + c[M] + '人</span><span class="' + (fl[0] ? 'w' : '') + '">男' + c[0] + (fl[0] ? '△' : '') + '</span><span>女' + (c[M] - c[0]) + '</span>' +
        '<span class="' + (fl[HM] ? 'w' : '') + '" title="学・欠・問・保のどれかが＋＋以上の児童">＋＋' + c[HM] + '人</span>' +
        '<span class="jis" title="同じ事案は1件と数える">事案数 ' + a.inc[k] + '</span></div>' +
        '<div class="st">' + C.ATTRS.map(function (at, ai) { return cnt(ai + 1, App.mark(at, 1)); }).join('') + '</div>' +
        '</div><div class="sub2"><div class="gcol"></div><div class="gcol"></div></div></section>';
    }
    App.$('board').innerHTML = h + '</div>';
    // 凡例は計測の前に入れる（後から折り返すと盤面が縮み、最後の児童がはみ出す）
    App.$('legend').innerHTML = C.ATTRS.map(function (at) { return '<span class="c">' + App.mark(at, 1) + at.label + '</span>'; }).join('');
    fit(rows);
    var gcols = App.$('board').querySelectorAll('.gcol');
    for (k = 0; k < nc; k++) for (var g2 = 0; g2 < 2; g2++)
      gcols[k * 2 + g2].innerHTML = per[k][g2].map(function (i) { return chipHTML(i, p.locks.has(i) ? 'locked' : ''); }).join('');
    updateSel();

  }
  function maxOld() { var n = 0; S.P.kids.forEach(function (s) { if (s.old + 1 > n) n = s.old + 1; }); return n; }

  // 選択・離す/つけるの印・移す先の見出し・案内の文だけを書き換える（盤面は作り直さない）
  var marked = [];
  function updateSel() {
    var board = App.$('board'), esc = App.esc;
    if (!board || S.view !== 'plan') return;
    marked.forEach(function (el) { el.classList.remove('sel', 'rel-far', 'rel-near'); });
    marked = [];
    var p = S.plans[S.active];
    var mark = function (i, cls) { var el = board.querySelector('.chip[data-i="' + i + '"]'); if (el) { el.classList.add(cls); marked.push(el); } };
    if (S.sel >= 0) {
      mark(S.sel, 'sel');
      S.ctx.relOf[S.sel].forEach(function (pi) { var pr = S.P.pairs[pi]; if (pr.t !== 'fix') mark(pr.i === S.sel ? pr.j : pr.i, 'rel-' + pr.t); });
    }
    board.querySelectorAll('.head').forEach(function (hd) { hd.classList.toggle('target', S.sel >= 0 && p.asg[S.sel] !== +hd.dataset.k); });
    var hint = App.$('hint');
    hint.className = 'hint' + (S.follow != null ? ' follow' : '');
    // 案内の文は出さない（操作は確認の枠と選択の印で分かる）。続けて入れ替える時だけ、誰の番かを出す
    hint.innerHTML = S.follow != null ? '続けて <b>' + esc(S.P.kids[S.follow].name) + '</b> の入れ替え相手をタップ' : '';
  }

  // 行の高さとアイコンの大きさを、空の列の寸法から決める（全員を1画面に収める）。
  // カードを入れた後に測ると、140人分の配置を2回計算することになり重い
  function fit(rows) {
    var gc = document.querySelector('.gcol');
    if (!gc) return;
    var rh = (gc.clientHeight - (rows - 1) * 2) / rows, rhc = Math.max(18, Math.min(40, rh)), root = document.documentElement.style;
    root.setProperty('--rowh', rhc.toFixed(2) + 'px');
    var ic = Math.min(rhc * .36, (gc.clientWidth - rhc * .31 - rhc * .38 - 10) / ((C.ATTRS.filter(function (a) { return !a.good; }).length + 1) * 1.5 + .1));
    root.setProperty('--ic', Math.max(8, ic).toFixed(2) + 'px');
  }

  function renderCmp() {
    var A = S.plans.map(function (p) { return E.analyze(S.ctx, p.asg); }), ref = S.plans[S.active], M = S.ctx.M;
    var rows = [
      { lab: '違反（離す・つける・固定・上限）', f: function (p, a) { return a.bad.length; }, bad: true },
      { lab: '人数の差', f: function (p, a) { return E.spread(a.c, M); } },
      { lab: '男の数の差', f: function (p, a) { return E.spread(a.c, 0); } }
    ].concat(C.ATTRS.map(function (at, ai) { return { lab: at.label, f: function (p, a) { return E.spread(a.c, ai + 1); } }; })).concat([
      { lab: '旧学級の偏り（最大）', f: function (p, a) { return Math.max.apply(null, S.ctx.MET.map(function (m, mi) { return m.grp === 'old' ? E.spread(a.c, mi) : 0; })); } },
      { lab: '地区の偏り（最大）', f: function (p, a) { return Math.max.apply(null, S.ctx.MET.map(function (m, mi) { return m.grp === 'area' ? E.spread(a.c, mi) : 0; })); } },
      { lab: '事案数の差', f: function (p, a) { return Math.max.apply(null, a.inc) - Math.min.apply(null, a.inc); } },
      { lab: '偏り△の数', f: function (p, a) { return a.warn.length; } },
      { lab: '手で動かした回数', f: function (p) { return p.edits; }, nobest: true },
      { lab: '案' + ref.letter + 'と所属が違う児童', f: function (p) { return E.diffCount(S.ctx, p.asg, ref.asg); }, nobest: true },
      { lab: '元にした案', f: function (p) { return p.from || '—'; }, txt: true },
      { lab: '重み（な・弱・中・強）', f: function (p) { return E.genSummary(p.gen); }, txt: true, small: true },
      { lab: '外した必ず守る条件', f: function (p) { return C.HARD.filter(function (h) { return !p.gen.hard[h.k]; }).map(function (h) { return h.label; }).join('・') || '—'; }, txt: true }
    ]);
    var h = '<div class="cmpwrap"><table class="cmp"><thead><tr><th>指標</th>' + S.plans.map(function (p, pi) { return '<th data-p="' + pi + '" tabindex="0">' + App.esc(planName(p)) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      var vs = S.plans.map(function (p, pi) { return r.f(p, A[pi]); });
      var best = r.nobest || r.txt ? null : Math.min.apply(null, vs), same = !r.txt && vs.every(function (v) { return v === vs[0]; });
      h += '<tr><td>' + App.esc(r.lab) + '</td>' + vs.map(function (v) {
        return '<td class="' + (r.bad && v > 0 ? 'bad ' : '') + (best !== null && v === best && !same ? 'best ' : '') + (r.small ? 'small' : '') + '">' + App.esc(v) + '</td>';
      }).join('') + '</tr>';
    });
    App.$('board').className = 'cmpwrap';
    App.$('board').innerHTML = h + '</tbody></table><p class="note">「所属が違う児童」は組の番号の付け替えを無視して数える。重みの略号：頭文字＋段階（な＝なし）。</p></div>';
  }

  // ===== 確認の枠 =====
  function chipsSide(ids, from, to, ex) {
    return '<div class="side"><div class="lab"><b>' + (from + 1) + '組</b> → ' + (to + 1) + '組</div>' + ids.map(function (i) { return chipHTML(i, ex && ex.indexOf(i) >= 0 ? 'extra' : ''); }).join('') + '</div>';
  }
  function swapDialog(d) {
    var p = S.plans[S.active];
    App.openDlg({
      focus: 'okbtn', d: d,
      html: function () {
        var left, right, arrow, title, ex = [], note = '';
        if (d.type === 'swap') { var r = E.swapChanges(d); d.ch = r.ch; ex = r.ex; left = r.A; right = r.B; arrow = '⇄'; title = '入れ替えますか？'; }
        else { left = d.GA; arrow = '→'; title = (d.kb + 1) + '組へ移しますか？'; }
        if (d.GA.length > 1 || (d.GB && d.GB.length > 1)) note += '<span>「つける」の相手と一緒に動かします。</span>';
        if (ex.length) note += '<span><b>' + ex.map(function (i) { return App.esc(S.P.kids[i].name); }).join('・') + '</b> は人数を合わせるため自動で選びました（偏りが最も小さくなる児童）。</span>' +
          (d.cands.length > d.cnt ? '<button class="btn" data-act="next">別の児童にする（' + ((d.ci / d.cnt | 0) + 1) + '/' + Math.floor(d.cands.length / d.cnt) + '）<kbd>Tab</kbd></button>' : '');
        var br = E.farBreaks(S.ctx, p.asg, d.ch), warn = '';
        d.br = br; d.next = null;
        if (br.length) {
          var tgt = E.farTargets(br, d.ch); d.next = tgt[0];
          warn = '<div class="farbox">離す児童と同じクラスになります。続けて離す児童の入れ替えに移ります。続行しますか？<div class="side" style="margin-top:6px"><div class="lab">離す児童（' + tgt.length + '人）</div>' +
            tgt.slice(0, 3).map(function (i) { return chipHTML(i, ''); }).join('') +
            (tgt.length > 3 ? '<details class="more"><summary>＋ あと' + (tgt.length - 3) + '人</summary><div class="side">' + tgt.slice(3).map(function (i) { return chipHTML(i, ''); }).join('') + '</div></details>' : '') + '</div></div>';
        }
        if (d.type === 'move' && E.sizeOf(p.asg, d.kb) + left.length > C.CAP) warn += '<div class="warnbox">✕ ' + (d.kb + 1) + '組が上限' + C.CAP + '人を超えます</div>';
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="' + title + '"><h2>' + title + '</h2>' +
          '<div class="swap">' + chipsSide(left, d.ka, d.kb, ex) + '<div class="arrow">' + arrow + '</div>' +
          (right ? chipsSide(right, d.kb, d.ka, ex) : '<div class="side"><div class="lab"><b>' + (d.kb + 1) + '組</b>（' + E.sizeOf(p.asg, d.kb) + '人 → ' + (E.sizeOf(p.asg, d.kb) + left.length) + '人）</div></div>') + '</div>' +
          (note ? '<div class="notebox">' + note + '</div>' : '') + warn +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok" id="okbtn">' +
          (br.length ? '続行する' : d.type === 'swap' ? '入れ替える' : '移す') + '<kbd>Enter</kbd></button></div></div></div>';
      },
      onOk: function () {
        var names = d.type === 'swap' ? d.GA.map(function (i) { return S.P.kids[i].name; }).join('・') + ' ⇄ ' + E.swapChanges(d).B.map(function (i) { return S.P.kids[i].name; }).join('・')
          : d.GA.map(function (i) { return S.P.kids[i].name; }).join('・') + ' → ' + (d.kb + 1) + '組';
        App.closeDlg();
        doMove(d.ch, names);
        if (d.next != null) { S.follow = d.next; S.sel = d.next; updateSel(); flash([d.next]); }
      },
      onTab: function () { if (d.extraSide && d.cands.length > d.cnt) { E.nextCandidate(d); App.refreshDlg(); return true; } return false; }
    });
  }

  function genDialog() {
    var gen = JSON.parse(JSON.stringify(S.lastGen)), p = S.plans[S.active];
    var keep = S.view === 'plan' && p.locks.size;
    App.openDlg({
      focus: 'okbtn',
      html: function () {
        var lvRow = function (x) {
          return '<tr><td>' + (x.sh ? App.mark(x, 1) + ' ' : '') + x.label + '</td><td><div class="lvs">' + C.LEVEL_NAMES.map(function (n, lv) {
            return '<button class="lv" data-w="' + x.k + '" data-lv="' + lv + '" aria-pressed="' + ((gen.w[x.k] | 0) === lv) + '">' + n + '</button>';
          }).join('') + '</div></td></tr>';
        };
        return '<div class="pop" data-close="1"><div class="dlg gen" role="dialog" aria-modal="true" aria-label="案を作る"><h2>案を作る</h2>' +
          '<div><b>必ず守る条件</b>（押すと外す／戻す）<div class="toggles" style="margin-top:6px">' + C.HARD.map(function (h) {
            return '<button class="tg" data-hard="' + h.k + '" aria-pressed="' + !!gen.hard[h.k] + '">' + h.label + '</button>';
          }).join('') + '</div></div>' +
          '<div><b>偏りの重み</b>（強いほど均等に分ける）<div class="gencols" style="margin-top:6px"><table>' + C.ATTRS.map(lvRow).join('') + '</table><table>' + C.EXTRA.map(lvRow).join('') + '</table></div></div>' +
          '<div class="notebox">名前：案' + LET[S.letIdx % 26] + '（' + App.esc(E.autoName(gen, keep ? p.locks.size : 0)) + '）' + (keep ? '　今の案で固定した' + p.locks.size + '人はそのままの組に置きます' : '') + '</div>' +
          '<div class="acts"><button class="btn" data-act="reset">既定に戻す</button><span class="sp"></span><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button>' +
          '<button class="btn primary" data-act="ok" id="okbtn">この設定で作る<kbd>Enter</kbd></button></div></div></div>';
      },
      click: function (t) {
        var x;
        if ((x = t.closest('[data-w]'))) { gen.w[x.dataset.w] = +x.dataset.lv; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-hard]'))) { gen.hard[x.dataset.hard] = !gen.hard[x.dataset.hard]; App.refreshDlg(); return true; }
        if (t.closest('[data-act="reset"]')) { gen = E.defaultGen(); App.refreshDlg(); return true; }
        return false;
      },
      onOk: function () {
        App.closeDlg();
        S.lastGen = gen;
        var locked = keep ? (function () { var m = new Map(); p.locks.forEach(function (i) { m.set(i, p.asg[i]); }); return m; })() : new Map();
        var r = addGenerated(gen, locked, keep ? '案' + p.letter + 'の固定' : null);
        render(); persist();
        App.toast(planName(r.p) + 'を作りました（' + r.ms + 'ms）');
      }
    });
  }

  function renameDialog(pi) {
    var p = S.plans[pi];
    App.openDlg({
      focus: 'rnm',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="名前を変える" style="max-width:480px"><h2>案' + p.letter + 'の名前</h2>' +
          '<input type="text" id="rnm" value="' + App.esc(p.name || p.auto) + '"><div class="note">空にすると自動の名前（' + App.esc(p.auto) + '）に戻ります</div>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">変える<kbd>Enter</kbd></button></div></div></div>';
      },
      onOk: function () { var v = App.$('rnm').value.trim(); p.name = v === p.auto ? '' : v; App.closeDlg(); render(); persist(); }
    });
  }

  function confirmDialog(title, body, word, btn, run) {
    App.openDlg({
      focus: 'cword',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="' + title + '" style="max-width:620px"><h2>' + title + '</h2>' + body +
          '<label>確かめるため「<b>' + word + '</b>」と入力してください<br><input type="text" id="cword" style="width:100%;margin-top:4px" autocomplete="off"></label>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn danger" data-act="ok">' + btn + '</button></div></div></div>';
      },
      onOk: function () {
        if (App.$('cword').value.trim() !== word) { App.toast('入力した語が違います'); return; }
        App.closeDlg(); run();
      }
    });
  }

  function decideDialog() {
    var p = S.plans[S.active], a = E.analyze(S.ctx, p.asg), grade = App.st.grade;
    var body = '<p>' + App.esc(planName(p)) + ' で決定します。次のことを行います。</p><ul><li>' + (grade + 1) + '年の名簿を作ります（新しい番号は組ごとの男女混合の五十音順）</li>' +
      '<li>今年度の配慮項目の値を、来年度に写します。今年度の値はこの時点で凍結されます</li><li>つける・離すを、来年度の候補として持ち越します</li></ul>' +
      (a.bad.length ? '<div class="warnbox">✕ この案には違反が' + a.bad.length + '件あります</div>' : '') + '<p class="note">4/1までは取り消せます。</p>';
    confirmDialog('クラス替えを決定', body, grade + '年のクラス替えを決定', '決定する', function () {
      var assign = {}; S.P.kids.forEach(function (s, i) { assign[s.id] = p.asg[i]; });
      App.save(function () { return App.pf().savePlans(grade, serialize()).then(function () { return App.pf().decide(grade, { name: planName(p), assign: assign }); }); })
        .then(function () { return App.reload(); }).then(function () { App.toast('決定しました'); });
    });
  }
  function undoDecideDialog() {
    var grade = App.st.grade;
    confirmDialog('決定を取り消す', '<p>来年度の名簿と、写した配慮項目の値を消します。来年度の側で直した値も消えます。</p>', grade + '年の決定を取り消す', '取り消す', function () {
      App.save(function () { return App.pf().undoDecide(grade); }).then(function () { return App.reload(); }).then(function () { App.toast('決定を取り消しました'); });
    });
  }

  // ===== つける・離す・組に固定 =====
  // 学年全体で1つの表。保存すると読み込み直し、案の違反の判定に反映する（案そのものは変えない）
  var PT = { far: '離す', near: 'つける', fix: '組に固定' };
  function pairsDialog() {
    var d = App.st.data, esc = App.esc, kids = S.P.kids;
    var list = d.pairs.map(function (p) { return JSON.parse(JSON.stringify(p)); });
    var carry = (d.carry || []).slice();
    var F = { t: 'far', a: null, b: null, k: 0, memo: '' };
    var nm = function (id) { var i = S.idx[id]; return i == null ? id : kids[i].name + '（旧' + (kids[i].old + 1) + '組）'; };
    var desc = function (p) { return p.t === 'fix' ? nm(p.a) + ' → ' + (p.k + 1) + '組' : nm(p.a) + ' と ' + nm(p.b); };
    var sugg = function (q, slot) {
      q = (q || '').trim();
      if (!q) return '';
      var hit = kids.filter(function (s) { return s.name.indexOf(q) >= 0 || s.kana.indexOf(q) >= 0 || s.id.indexOf(q) === 0; }).slice(0, 8);
      return hit.length ? '<div class="sugg">' + hit.map(function (s) { return '<button type="button" data-pk="' + slot + ':' + s.id + '">旧' + (s.old + 1) + '組' + s.no + '番 ' + esc(s.name) + '</button>'; }).join('') + '</div>' : '<div class="note">見つかりません</div>';
    };
    var pick = function (slot) {
      var id = F[slot];
      return id ? '<span class="picked"><span>' + esc(nm(id)) + '<button type="button" data-unpk="' + slot + '" aria-label="外す">×</button></span></span>' :
        '<input id="q' + slot + '" placeholder="名前・よみ・児童IDで探す" autocomplete="off" style="padding:4px 6px;border:1px solid var(--line);border-radius:4px"><div id="s' + slot + '"></div>';
    };
    var canAdd = function () { return F.a && (F.t === 'fix' ? true : F.b && F.b !== F.a); };
    App.openDlg({
      focus: 'qa',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="つける・離す"><h2>つける・離す・組に固定</h2>' +
          '<div class="form"><div class="toggles">' + ['far', 'near', 'fix'].map(function (t) { return '<button class="tg" data-pt="' + t + '" aria-pressed="' + (F.t === t) + '">' + PT[t] + '</button>'; }).join('') + '</div>' +
          '<div class="row" style="align-items:flex-start"><div>' + pick('a') + '</div><div>' + (F.t === 'fix' ?
            '<div class="lvs">' + Array.from({ length: S.P.nc }, function (_, k) { return '<button class="lv" data-pkc="' + k + '" aria-pressed="' + (F.k === k) + '">' + (k + 1) + '組</button>'; }).join('') + '</div>' : pick('b')) + '</div></div>' +
          '<div class="row"><input id="pmemo" placeholder="メモ（任意・氏名は書かない）" value="' + esc(F.memo) + '" style="padding:4px 6px;border:1px solid var(--line);border-radius:4px"><button class="btn" id="padd"' + (canAdd() ? '' : ' disabled') + '>追加</button></div></div>' +
          '<div class="tw" style="max-height:220px"><table class="r ro"><thead><tr><th>種類</th><th style="text-align:left">児童</th><th style="text-align:left">メモ</th><th></th></tr></thead><tbody>' +
          (list.map(function (p, i) { return '<tr><td>' + PT[p.t] + '</td><td style="text-align:left">' + esc(desc(p)) + '</td><td style="text-align:left">' + esc(p.memo || '') + '</td><td><button class="btn" data-pdel="' + i + '">削除</button></td></tr>'; }).join('') ||
            '<tr><td colspan="4" class="empty">まだありません</td></tr>') + '</tbody></table></div>' +
          (carry.length ? '<div><b>前年度からの候補</b>（採用すると上の表に入る）<div class="tw" style="max-height:140px"><table class="r ro"><tbody>' + carry.map(function (p, i) {
            return '<tr><td>' + PT[p.t] + '</td><td style="text-align:left">' + esc(desc(p)) + '</td><td><button class="btn" data-pcar="' + i + '">採用</button></td></tr>';
          }).join('') + '</tbody></table></div></div>' : '') +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok" id="okbtn">保存する（' + list.length + '件）</button></div></div></div>';
      },
      input: function (t) {
        if (t.id === 'qa' || t.id === 'qb') { var slot = t.id.slice(1); App.$('s' + slot).innerHTML = sugg(t.value, slot); }
        else if (t.id === 'pmemo') F.memo = t.value;
      },
      click: function (t) {
        var x;
        if ((x = t.closest('[data-pt]'))) { F.t = x.dataset.pt; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-pk]'))) { var v = x.dataset.pk.split(':'); F[v[0]] = v[1]; App.refreshDlg(); var q = App.$(v[0] === 'a' ? 'qb' : 'qa'); if (q) q.focus(); return true; }
        if ((x = t.closest('[data-unpk]'))) { F[x.dataset.unpk] = null; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-pkc]'))) { F.k = +x.dataset.pkc; App.refreshDlg(); return true; }
        if (t.closest('#padd')) {
          if (!canAdd()) return true;
          list.push(F.t === 'fix' ? { t: 'fix', a: F.a, k: F.k, memo: F.memo } : { t: F.t, a: F.a, b: F.b, memo: F.memo });
          F = { t: F.t, a: null, b: null, k: F.k, memo: '' }; App.refreshDlg(); return true;
        }
        if ((x = t.closest('[data-pdel]'))) { list.splice(+x.dataset.pdel, 1); App.refreshDlg(); return true; }
        if ((x = t.closest('[data-pcar]'))) { var c = carry.splice(+x.dataset.pcar, 1)[0]; list.push({ t: c.t, a: c.a, b: c.b, memo: '' }); App.refreshDlg(); return true; }
        return false;
      },
      onOk: function () {
        var grade = App.st.grade, data = serialize(), n = list.length;
        App.closeDlg();
        // 案を先に保存してから読み込み直す（案は残る）
        clearTimeout(saveT);
        App.save(function () { return App.pf().savePlans(grade, data).then(function () { return App.pf().savePairs(grade, list); }); })
          .then(function () { return App.reload(); }).then(function () { App.toast('つける・離すを保存しました（' + n + '件）'); });
      }
    });
  }

  function showViol() {
    var a = E.analyze(S.ctx, S.plans[S.active].asg), r = App.$('vbtn').getBoundingClientRect(), esc = App.esc;
    App.openDlg({
      html: function () {
        return '<div class="pop" data-close="1" style="background:transparent;align-items:flex-start;justify-content:flex-start"><div class="viol" style="top:' + (r.bottom + 4) + 'px;left:' + Math.max(8, r.left) + 'px"><ul>' +
          a.bad.map(function (x) { return '<li data-ids="' + x.ids.join(',') + '"><span class="k bad">✕ 違反</span> ' + esc(x.txt) + '</li>'; }).join('') +
          a.warn.map(function (x) { return '<li data-wk="' + x.k + '" data-wm="' + x.m + '"><span class="k">△ 偏り</span> ' + esc(x.txt) + '</li>'; }).join('') +
          (a.bad.length + a.warn.length ? '' : '<li>違反・偏りはありません</li>') + '</ul></div></div>';
      },
      noEnter: true,
      click: function (t) {
        var li = t.closest('.viol li');
        if (!li) return false;
        App.closeDlg();
        if (li.dataset.ids) flash(li.dataset.ids.split(',').filter(Boolean).map(Number));
        else if (li.dataset.wk) {
          var k = +li.dataset.wk, m = +li.dataset.wm, p = S.plans[S.active], ids = [];
          for (var i = 0; i < S.ctx.N; i++) if (p.asg[i] === k && (m === S.ctx.M || S.ctx.VAL[i][m] > 0)) ids.push(i);
          if (m !== S.ctx.M) flash(ids);
        }
        return true;
      }
    });
  }
  function helpDialog() {
    var keys = [['クリック → クリック', '入れ替え（確認の枠が出る）'], ['Enter', '確認の枠で実行'], ['Esc', '選択の解除・枠を閉じる'], ['Ctrl+Z', '元に戻す'], ['Ctrl+Y／Ctrl+Shift+Z', 'やり直す'],
      ['1〜9', '案のタブを切り替え'], ['0', '比較'], ['G', '案を作る（設定の枠。Enterで前回の設定のまま作る）'], ['D', 'この案を複製'], ['Delete', 'この案を削除（通知の「戻す」で戻せる）'], ['P', 'つける・離す・組に固定'], ['L', '選択中の児童を固定／解除'], ['V', '違反・偏りの一覧'], ['F', '全画面'], ['?', 'この一覧']];
    App.openDlg({
      focus: 'okbtn',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg help" role="dialog" aria-modal="true" aria-label="ショートカット" style="max-width:600px"><h2>ショートカット</h2><table>' +
          keys.map(function (k) { return '<tr><td><kbd>' + k[0] + '</kbd></td><td>' + k[1] + '</td></tr>'; }).join('') +
          '</table><div class="acts"><button class="btn primary" data-act="close" id="okbtn">閉じる<kbd>Esc</kbd></button></div></div></div>';
      },
      onOk: function () { App.closeDlg(); }
    });
  }

  // ===== 操作 =====
  function apply(p, ch) { ch.forEach(function (x) { p.asg[x[0]] = x[1]; }); }
  function doMove(changes, msg) {
    var p = S.plans[S.active], prev = changes.map(function (x) { return [x[0], p.asg[x[0]]]; });
    apply(p, changes); p.hist.push({ prev: prev, next: changes, msg: msg }); p.fut = []; p.edits++;
    S.sel = -1; S.follow = null; render(); persist(); App.toast(msg, undo);
    flash(changes.map(function (x) { return x[0]; }));
  }
  function undo() { if (S.view !== 'plan' || S.decision) return; var p = S.plans[S.active], h = p.hist.pop(); if (!h) return; apply(p, h.prev); p.fut.push(h); p.edits--; S.sel = -1; S.follow = null; render(); persist(); App.toast('戻しました：' + h.msg); }
  function redo() { if (S.view !== 'plan' || S.decision) return; var p = S.plans[S.active], h = p.fut.pop(); if (!h) return; apply(p, h.next); p.hist.push(h); p.edits++; S.sel = -1; S.follow = null; render(); persist(); App.toast('やり直しました：' + h.msg); }
  function tapChip(i) {
    if (S.decision) return;
    var p = S.plans[S.active];
    if (S.sel < 0) { S.sel = i; updateSel(); return; }
    if (S.sel === i) { S.sel = -1; S.follow = null; updateSel(); return; }
    if (p.asg[S.sel] === p.asg[i]) { if (S.follow != null) { App.toast('別の組の児童を選んでください'); return; } S.sel = i; updateSel(); return; }
    var d = E.buildSwap(ctxFor(p.gen), p.asg, p.locks, S.sel, i); // 補う児童は、その案を作った重みで選ぶ
    if (d.err) App.toast(d.err); else swapDialog(d);
  }
  function tapHead(k) {
    if (S.decision) return;
    var p = S.plans[S.active];
    if (S.sel < 0 || p.asg[S.sel] === k) return;
    var d = E.buildMove(S.ctx, p.asg, p.locks, S.sel, k);
    if (d.err) App.toast(d.err); else swapDialog(d);
  }
  function toggleLock() {
    if (S.decision) return;
    var p = S.plans[S.active];
    if (S.sel < 0) { App.toast('先に児童を選んでください'); return; }
    var i = S.sel;
    if (p.locks.has(i)) p.locks.delete(i); else p.locks.add(i);
    var el = App.$('board').querySelector('.chip[data-i="' + i + '"]');
    if (el) el.classList.toggle('locked', p.locks.has(i));
    persist(); App.toast(S.P.kids[i].name + '：' + (p.locks.has(i) ? '固定しました' : '固定を外しました'));
  }
  function flash(ids) {
    requestAnimationFrame(function () {
      ids.forEach(function (i) { var el = document.querySelector('.board .chip[data-i="' + i + '"]'); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } });
    });
  }
  // 案を消す：確かめてから消し、通知欄の「戻す」で元の位置に戻せる
  function delDialog(pi) {
    if (S.plans.length < 2 || S.decision) return;
    var p = S.plans[pi], nm = '案' + p.letter;
    App.openDlg({
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="案を削除" style="max-width:480px"><h2>' + App.esc(planName(p)) + 'を削除しますか</h2>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">削除する<kbd>Enter</kbd></button></div></div></div>';
      },
      onOk: function () {
        App.closeDlg();
        var at = S.plans.indexOf(p); if (at < 0) return;
        S.plans.splice(at, 1);
        if (S.active >= S.plans.length) S.active = S.plans.length - 1; else if (S.active > at) S.active--;
        S.sel = -1; S.follow = null; render(); persist();
        App.toast(nm + 'を削除しました', function () {
          if (S.decision || S.plans.indexOf(p) >= 0) return;
          S.plans.splice(Math.min(at, S.plans.length), 0, p); S.active = S.plans.indexOf(p); S.view = 'plan'; render(); persist();
        });
      }
    });
  }
  function dup() {
    if (S.view !== 'plan' || S.decision) return;
    var p = S.plans[S.active];
    var q = { letter: LET[S.letIdx++ % 26], name: p.name, auto: p.auto, gen: JSON.parse(JSON.stringify(p.gen)), asg: Int8Array.from(p.asg), locks: new Set(p.locks), hist: [], fut: [], edits: 0, from: '案' + p.letter };
    S.plans.push(q); S.active = S.plans.length - 1; S.sel = -1; S.follow = null; render(); persist();
    App.toast('案' + p.letter + 'を複製して案' + q.letter + 'を作りました');
  }
  function fullscreen() {
    var d = document;
    if (d.fullscreenElement) { if (d.exitFullscreen) d.exitFullscreen(); }
    else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(function () { App.toast('この表示では全画面にできません。F11キーを使ってください'); });
  }
  function selectPlan(pi) { S.active = pi; S.view = 'plan'; S.sel = -1; S.follow = null; render(); }

  App.screens.split = {
    enter: function () {
      var d = App.st.data, cur = d.years.filter(function (y) { return y.fy === d.fy; })[0];
      if (d.grade >= 6) { App.$('main').innerHTML = '<div class="menu"><section><h2>6年は卒業するので、クラス分けはありません</h2><button class="btn" data-go="menu">メニューに戻る</button></section></div>'; return; }
      if (!cur || !cur.rows.length) { // 名簿が無いと組めない
        App.$('main').innerHTML = '<div class="menu"><section><h2>' + d.grade + '年の今年度の名簿がありません</h2><p>先に名簿を入れてください。</p>' +
          '<button class="btn primary" data-go="roster">名簿へ</button></section></div>';
        return;
      }
      build(); document.body.classList.add('fit'); render();
    },
    leave: function () { document.body.classList.remove('fit'); },
    render: function () { if (S) render(); },
    state: function () { return S; },
    click: function (t, e) {
      var x;
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
      if (t.closest('#decide')) { decideDialog(); return true; }
      if (t.closest('#undoDecide')) { undoDecideDialog(); return true; }
      if ((x = t.closest('.board .chip'))) { tapChip(+x.dataset.i); return true; }
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
      if (k === 'Escape') { if (S.sel >= 0 || S.follow != null) { S.sel = -1; S.follow = null; updateSel(); } return true; }
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

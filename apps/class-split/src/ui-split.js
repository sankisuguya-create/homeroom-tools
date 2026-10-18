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

  // ===== 描画 =====
  function chipHTML(i, cls, extra) {
    var s = S.P.kids[i], oc = App.classColor(s.old), esc = App.esc;
    // 特別支援学級の児童は、地（旧学級の薄い色）を薄いオレンジにする。帯は旧学級の色のまま
    var bg = s.a.sp ? '#FFE0BF' : oc.l;
    // 名前と旧学級の説明は名前と帯にだけ付ける（アイコンの上ではアイコンの説明を出すため）
    var tt = esc(s.name) + '（' + (s.tr ? '転入生' : '旧' + (s.old + 1) + '組' + s.no + '番') + '・' + (s.male ? '男' : '女') + (s.a.sp ? '・特別支援学級' : '') + '）';
    // アイコンは項目ごとに決まった位置（--s 番目の枠）に置く。空の枠は要素を作らない（140人×10枠の要素が重いため）
    // 枠：1段目右＝良い項目（賢・リ・運）、2段目右＝その真下に有無だけの項目（ア・身・通）、2段目左＝負担の項目
    var slot = function (pick) {
      var n = 0, out = '';
      C.ATTRS.forEach(function (at) {
        if (!pick(at)) return;
        var v = s.a[at.k] | 0;
        if (v) out += App.mark(at, v, s.a[at.k + '_t']).replace('style="', 'style="--s:' + n + ';');
        n++;
      });
      return out;
    };
    var jn = App.incBox(S.ji[i], S.jv[i], '事案' + S.ji[i] + '件・そのうち被害' + S.jv[i] + '件（押すと経年の記録と事案）');
    return '<div class="chip ' + (s.male ? 'm' : 'f') + (s.tr ? ' trn' : '') + ' ' + (cls || '') + '" style="--oc:' + oc.c + ';--ot:' + oc.t + ';--ol:' + bg + '" data-i="' + i + '" role="button" tabindex="0" aria-label="' + tt + '">' +
      '<span class="old" title="' + tt + '">' + (s.tr ? '転' : s.no) + '</span><span class="l1"><span class="nm" title="' + tt + '">' + esc(Array.from(s.name).slice(0, C.NAME_CHARS).join('')) + '</span>' + (extra || '') + '<span class="bs gd">' + slot(function (at) { return at.good; }) + '</span></span>' +
      '<span class="l2"><span class="bs">' + slot(function (at) { return !at.good && !at.side; }) + '</span><span class="bs gd">' + slot(function (at) { return at.side; }) + '</span></span>' +
      '<span class="jr">' + jn + '</span></div>';
  }

  function moreDialog() {
    var ro = !!S.decision, np = S.view !== 'plan';
    var btn = function (id, label, kbd, off) { return '<button class="btn" id="' + id + '"' + (off ? ' disabled' : '') + '>' + label + (kbd ? '<kbd>' + kbd + '</kbd>' : '') + '</button>'; };
    App.openDlg({
      noEnter: true,
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg more" role="dialog" aria-modal="true" aria-label="その他" style="max-width:560px"><h2>その他</h2>' +
          (ro ? '' : '<section><h3>案</h3><div class="rbar">' + btn('dup', '複製', 'D', np) + (S.plans.length > 1 ? btn('delp', '削除', 'Del', np) : '') + '</div></section>' +
            '<section><h3>条件と児童</h3><div class="rbar">' + btn('pairs', 'つける・離す…', 'P') + btn('trans', '転入生…') + '</div></section>') +
          '<section><h3>表示</h3><div class="rbar">' + btn('prt', '個人票を印刷…', '', np) + btn('fs', '全画面', 'F') + btn('hbtn', 'ショートカット一覧', '?') + '</div></section>' +
          (ro ? '' : '<section><h3>決める</h3><div class="rbar">' + btn('decide', '決定…', '', App.st.grade >= 6) + (App.st.grade >= 6 ? '<span class="note">6年は決定しません</span>' : '') + '</div></section>') +
          '<div class="acts"><button class="btn" data-act="close">閉じる<kbd>Esc</kbd></button></div></div></div>';
      },
      click: function (t) {
        var b = t.closest('button[id]');
        if (!b || b.disabled) return false;
        App.closeDlg(); return App.screens.split.click(t);
      }
    });
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
    if (ro) h += '<span class="decided">決定済み：' + App.esc(S.decision.plan) + '　' + namesText() + '<button class="btn primary" id="cnames">組の番号を決める…</button><button class="btn danger" id="undoDecide">決定を取り消す…</button></span>';
    else h += '<button class="btn" id="undo"' + (S.view !== 'plan' || !p.hist.length ? ' disabled' : '') + '>↶ 戻す<kbd>Ctrl+Z</kbd></button>' +
      '<button class="btn" id="redo"' + (S.view !== 'plan' || !p.fut.length ? ' disabled' : '') + '>↷<kbd>Ctrl+Y</kbd></button>';
    // 編集中に毎回は使わない操作は「その他…」の窓へ（キーの近道はそのまま効く）
    h += '<button class="btn ordbtn" id="order"' + (S.view !== 'plan' ? ' disabled' : '') + '>⇅ 並び順…</button><button class="btn" id="smore" aria-haspopup="dialog">その他…</button>';
    if (!ro) h += '<button class="btn primary" id="gen">案を作る<kbd>G</kbd></button>';
    return '<div class="bar">' + h + '</div>';
  }

  // 盤面の描画。重い処理（寸法の計測）はカードを入れる前に1回だけ行う
  // 案がまだ無い時の画面：設定の窓を開くボタンだけ
  function renderSetup() {
    App.$('main').innerHTML = '<div class="menu"><section><h2>' + App.st.grade + '年のクラス分け</h2><p>偏りの重み付けと、組の中の並び順を決めてから、案を作ります。</p>' +
      '<button class="btn primary big" id="gen">重み付けと並び順を決めて、案を作る…</button> <button class="btn" data-go="menu">メニューに戻る</button></section></div>';
  }
  function render() {
    if (!S.plans.length) { renderSetup(); return; }
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
      ids.sort(byOrder);
      var half = Math.ceil(ids.length / 2);
      per.push([ids.slice(0, half), ids.slice(half)]); rows = Math.max(rows, half);
    }
    var M = S.ctx.M, h = '<div class="cols" style="--nc:' + nc + '">';
    var HM = S.ctx.MET.findIndex(function (m) { return m.k === 'heavy'; });
    for (k = 0; k < nc; k++) {
      var c = a.c[k], fl = a.flag[k];
      var cnt = function (m, inner, hk) { return '<span class="c ' + (fl[m] ? 'w' : '') + (hk && S.hl === hk ? ' on' : '') + '"' + (hk ? ' data-hl="' + hk + '" role="button" title="押すと、この項目の児童だけを明るく出す"' : '') + '>' + inner + c[m] + '</span>'; };
      h += '<section class="col nc' + (k % 2) + '"><div class="head" data-k="' + k + '" role="button" tabindex="0">' +
        '<div class="h1"><b class="ncl">' + C.newClass(k) + '</b><span class="' + (fl[M] ? 'w' : '') + '">' + c[M] + '人</span><span class="' + (fl[0] ? 'w' : '') + '">男' + c[0] + (fl[0] ? '△' : '') + '</span><span>女' + (c[M] - c[0]) + '</span>' +
        '<span class="' + (fl[HM] ? 'w' : '') + '" title="学・欠・問・保のどれかが＋の児童">＋' + c[HM] + '人</span>' +
        '<span class="jis" title="同じ事案は1件と数える">事案数 ' + a.inc[k] + '</span></div>' +
        '<div class="st">' + C.ATTRS.map(function (at, ai) { return cnt(ai + 1, App.mark(at, 1), at.k); }).join('') + '</div>' +
        '</div><div class="sub2"><div class="gcol"></div><div class="gcol"></div></div></section>';
    }
    App.$('board').innerHTML = h + '</div>';
    // 凡例は計測の前に入れる（後から折り返すと盤面が縮み、最後の児童がはみ出す）
    App.$('legend').innerHTML = C.ATTRS.map(function (at) { return '<span class="c">' + App.mark(at, 1) + at.label + '</span>'; }).join('') +
      '<span class="c"><span class="lg" style="background:#FFE0BF"></span>特別支援学級</span><span class="c"><span class="lg tr"></span>転入生</span>';
    fit(rows);
    var gcols = App.$('board').querySelectorAll('.gcol');
    for (k = 0; k < nc; k++) for (var g2 = 0; g2 < 2; g2++)
      gcols[k * 2 + g2].innerHTML = per[k][g2].map(function (i) { return chipHTML(i, p.locks.has(i) ? 'locked' : ''); }).join('');
    updateSel();
    applyHl();

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
    // アイコンの間隔は崩れない範囲で最大にとる（＋で大きくしたアイコンどうしが重ならないように）。
    // 右の枠（1段目＝賢・リ・運、2段目＝ア・身・通）は縦にそろえるので同じ間隔：1段目の名前（空白を含め NAME_CHARS 文字）の残り。
    // 2段目の左の枠（学・欠・問・保）は、右の枠の残りを使い切る間隔
    var W = gc.clientWidth - 2 - rhc * .31 - rhc * .5 - 8, ic = rhc * .36;
    var nameW = (C.NAME_CHARS - .5) * rhc * .38 + 6; // 空白は半角の幅
    var nL = C.ATTRS.filter(function (a) { return !a.good && !a.side; }).length;
    // 右の枠（賢・リ・運／ア・身・通）は有無だけなので＋が無い：間隔はアイコン1つ分＋すき間。
    // 左の枠（学・欠・問・保）の＋は1.3倍で、右上の＋は中心から (.48em＋.62em)×1.3 はみ出す。
    // 間隔は「＋のアイコンの中心から＋の右端まで」＋「隣のアイコンの左半分」以上にする（＋が隣に被らない）
    var IW = 1.8, RW = IW + .1, PLUSW = Math.max((.48 + .62) * 1.3, IW / 2 * 1.3) + IW / 2; // IW＝カードのアイコンの横幅（em）
    // 右の枠は要る分（少しゆとり）だけ取り、残りを左の枠へ回す。足りなければアイコンを小さくする
    var slotR = Math.min((W - nameW) / 3, RW * ic * 1.15);
    ic = Math.min(ic, slotR / RW);
    var slotL = Math.min((W - 3 * slotR - 1.3 * IW * ic - 6) / (nL - 1), ic * 4);
    if (slotL < PLUSW * ic) {
      ic = (W - 6) / (3 * RW * 1.15 + (nL - 1) * PLUSW + 1.3 * IW);
      slotR = Math.min((W - nameW) / 3, RW * ic * 1.15); ic = Math.min(ic, slotR / RW);
      slotL = (W - 3 * slotR - 1.3 * IW * ic - 6) / (nL - 1);
    }
    ic = Math.max(8, ic);
    ic *= App.iconScale(); // ⚙ 設定の「表示」で選んだ倍率
    root.setProperty('--ic', ic.toFixed(2) + 'px');
    root.setProperty('--slot', slotR.toFixed(2) + 'px');
    root.setProperty('--slotL', Math.max(ic * 1.2, slotL).toFixed(2) + 'px');
  }

  function renderCmp() {
    var A = S.plans.map(function (p) { return E.analyze(S.ctx, p.asg); }), ref = S.plans[S.active], M = S.ctx.M;
    var rows = [
      { lab: '違反（離す・つける・固定・上限・必）', f: function (p, a) { return a.bad.length; }, bad: true },
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
      { lab: '重み（無・弱・中・強）', f: function (p) { return E.genSummary(p.gen); }, txt: true, small: true },
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
    return '<div class="side"><div class="lab"><b>' + C.newClass(from) + '</b> → ' + C.newClass(to) + '</div>' + ids.map(function (i) { return chipHTML(i, ex && ex.indexOf(i) >= 0 ? 'extra' : ''); }).join('') + '</div>';
  }
  function swapDialog(d) {
    var p = S.plans[S.active];
    App.openDlg({
      focus: 'okbtn', d: d,
      html: function () {
        var left, right, arrow, title, ex = [], note = '';
        if (d.type === 'swap') { var r = E.swapChanges(d); d.ch = r.ch; ex = r.ex; left = r.A; right = r.B; arrow = '⇄'; title = '入れ替えますか？'; }
        else { left = d.GA; arrow = '→'; title = C.newClass(d.kb) + 'へ移しますか？'; }
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
        if (d.type === 'move' && E.sizeOf(p.asg, d.kb) + left.length > C.CAP) warn += '<div class="warnbox">✕ ' + C.newClass(d.kb) + 'が上限' + C.CAP + '人を超えます</div>';
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="' + title + '"><h2>' + title + '</h2>' +
          '<div class="swap">' + chipsSide(left, d.ka, d.kb, ex) + '<div class="arrow">' + arrow + '</div>' +
          (right ? chipsSide(right, d.kb, d.ka, ex) : '<div class="side"><div class="lab"><b>' + C.newClass(d.kb) + '</b>（' + E.sizeOf(p.asg, d.kb) + '人 → ' + (E.sizeOf(p.asg, d.kb) + left.length) + '人）</div></div>') + '</div>' +
          (note ? '<div class="notebox">' + note + '</div>' : '') + warn +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok" id="okbtn">' +
          (br.length ? '続行する' : d.type === 'swap' ? '入れ替える' : '移す') + '<kbd>Enter</kbd></button></div></div></div>';
      },
      onOk: function () {
        var names = d.type === 'swap' ? d.GA.map(function (i) { return S.P.kids[i].name; }).join('・') + ' ⇄ ' + E.swapChanges(d).B.map(function (i) { return S.P.kids[i].name; }).join('・')
          : d.GA.map(function (i) { return S.P.kids[i].name; }).join('・') + ' → ' + C.newClass(d.kb);
        App.closeDlg();
        doMove(d.ch, names);
        if (d.next != null) { S.follow = d.next; S.sel = d.next; updateSel(); flash([d.next]); }
      },
      onTab: function () { if (d.extraSide && d.cands.length > d.cnt) { E.nextCandidate(d); App.refreshDlg(); return true; } return false; }
    });
  }

  function genDialog() {
    var gen = JSON.parse(JSON.stringify(S.lastGen)), p = S.plans[S.active], O = ORDER.slice();
    var keep = !!(p && S.view === 'plan' && p.locks.size);
    App.openDlg({
      focus: 'okbtn',
      html: function () {
        var lvRow = function (x) {
          return '<tr><td>' + (x.sh ? App.mark(x, 1) + ' ' : '') + x.label + '</td><td><div class="lvs">' + C.LEVEL_NAMES.map(function (n, lv) {
            return '<button class="lv' + (lv === C.MUST ? ' must' : '') + '" data-w="' + x.k + '" data-lv="' + lv + '" aria-pressed="' + ((gen.w[x.k] | 0) === lv) + '">' + n + '</button>';
          }).join('') + '</div></td></tr>';
        };
        return '<div class="pop" data-close="1"><div class="dlg gen" role="dialog" aria-modal="true" aria-label="案を作る"><h2>案を作る</h2>' +
          '<div><b>必ず守る条件</b>（押すと外す／戻す）<div class="toggles" style="margin-top:6px">' + C.HARD.map(function (h) {
            return '<button class="tg" data-hard="' + h.k + '" aria-pressed="' + !!gen.hard[h.k] + '">' + h.label + '</button>';
          }).join('') + '</div></div>' +
          '<div><b>偏りの重み</b>（強いほど均等に分ける）<div class="gencols" style="margin-top:6px"><table>' + C.ATTRS.map(lvRow).join('') + '</table><table>' + C.EXTRA.map(lvRow).join('') + '</table></div></div>' +
          (Object.keys(gen.w).some(function (k) { return (gen.w[k] | 0) === C.MUST; }) ? '<div class="mustwarn">⚠ ' + C.MUST_WARN + '</div>' : '') +
          // 組の中の並び順（カードを並べる順）。目立つ枠で、ここで決めてから作る
          '<div class="ordbox"><b>組の中の並び順</b>（カードを並べる順。この端末に覚える）' + ['第一', '第二', '第三'].map(function (lab, i) {
            return '<div class="ordrow"><b>' + lab + '</b><div class="lvs">' + SORT_KEYS.concat([{ k: '', label: 'なし' }]).map(function (q) {
              return '<button class="lv" data-gord="' + i + ':' + q.k + '" aria-pressed="' + (O[i] === q.k) + '">' + q.label + '</button>';
            }).join('') + '</div></div>';
          }).join('') + '</div>' +
          '<div class="notebox">名前：案' + LET[S.letIdx % 26] + '（' + App.esc(E.autoName(gen, keep ? p.locks.size : 0)) + '）' + (keep ? '　今の案で固定した' + p.locks.size + '人はそのままの組に置きます' : '') + '</div>' +
          '<div class="acts"><button class="btn" data-act="reset">既定に戻す</button><span class="sp"></span><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button>' +
          '<button class="btn primary" data-act="ok" id="okbtn">この設定で作る<kbd>Enter</kbd></button></div></div></div>';
      },
      click: function (t) {
        var x;
        if ((x = t.closest('[data-w]'))) { gen.w[x.dataset.w] = +x.dataset.lv; App.refreshDlg(); if (+x.dataset.lv === C.MUST) App.toast(C.MUST_WARN); return true; }
        if ((x = t.closest('[data-gord]'))) { var gp = x.dataset.gord.split(':'); O[+gp[0]] = gp[1]; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-hard]'))) { gen.hard[x.dataset.hard] = !gen.hard[x.dataset.hard]; App.refreshDlg(); return true; }
        if (t.closest('[data-act="reset"]')) { gen = E.defaultGen(); App.refreshDlg(); return true; }
        return false;
      },
      onOk: function () {
        App.closeDlg();
        S.lastGen = gen; ORDER = O;
        try { localStorage.setItem('classSplit.order', JSON.stringify(ORDER)); } catch (e) { /* 覚えられなくても今の画面には効く */ }
        var locked = keep ? (function () { var m = new Map(); p.locks.forEach(function (i) { m.set(i, p.asg[i]); }); return m; })() : new Map();
        var r = addGenerated(gen, locked, keep ? '案' + p.letter + 'の固定' : null);
        render(); persist(); deal();
        App.toast(planName(r.p) + 'を作りました（' + r.ms + 'ms）');
      }
    });
  }

  // 作った案を、A組から1枚ずつカードを並べて見せる。＋付きのカードは画面を揺らして目立たせる。押すかキーで最後まで飛ばす
  var DEAL = null;
  function deal() {
    var board = App.$('board'); if (!board) return;
    var chips = []; board.querySelectorAll('.col').forEach(function (col) { col.querySelectorAll('.chip').forEach(function (c) { chips.push(c); }); });
    if (!chips.length) return;
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches, i = 0;
    board.classList.add('dealing');
    var done = function () { if (!DEAL) return; clearTimeout(DEAL.t); chips.forEach(function (c) { c.classList.add('dealt'); }); board.classList.remove('dealing'); document.removeEventListener('pointerdown', done, true); document.removeEventListener('keydown', done, true); DEAL = null; };
    var step = function () {
      if (!DEAL) return;
      if (i >= chips.length) { done(); return; }
      var c = chips[i++], plus = hasPlus(S.P.kids[+c.dataset.i]);
      c.classList.add('dealt');
      if (plus) { c.classList.add('plusin'); if (!calm) { var m = App.$('main'); m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake'); } }
      DEAL.t = setTimeout(step, plus ? 420 : 28);
    };
    DEAL = { t: 0 };
    document.addEventListener('pointerdown', done, true); document.addEventListener('keydown', done, true);
    step();
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

  // 決定した組の番号。未設定の間は仮（A組＝1組…）
  // ===== 個人票の印刷 =====
  // 18×4cm の票を A4 縦に7枚、隙間なしで並べる（裁断機で切って既存の個人票に貼る）。新しい組ごとに改ページし、組の中は五十音順。
  // 左は上に良い項目（緑）、名前、下に負担の4項目と事案数。右上に配慮（紫）と備考、右下に離す・つける。色はアイコンと旧学級の帯（濃い方）だけ。女子は左を半円（画面のカードと同じ形）。字は枠に収まるまで縮める（下限6pt）
  var PRINT_PER_PAGE = 7, PRINT_MIN_PT = 6;
  function printCards() {
    var p = S.plans[S.active], kids = S.P.kids, esc = App.esc;
    var named = S.decision && S.decision.named, names = namesOf();
    var clsName = function (k) { return named ? names[k] + '組' : C.newClass(k) + (S.decision ? '' : '（案' + p.letter + '）'); };
    var rel = kids.map(function () { return { far: [], near: [] }; });
    S.P.pairs.forEach(function (q) {
      if (q.t !== 'far' && q.t !== 'near') return;
      rel[q.i][q.t].push(q.j); rel[q.j][q.t].push(q.i);
    });
    var side = C.ATTRS.filter(function (at) { return at.side; });
    var card = function (i) {
      var s = kids[i], a = s.a || {}, oc = App.classColor(s.old);
      // 項目ごとに決まった位置に出す（無い項目は見えないアイコンで場所を取る）
      var ic = function (good) { return C.ATTRS.filter(function (at) { return !at.side && !at.good === !good; }).map(function (at) { var v = a[at.k] | 0; return v ? App.mark(at, v) : '<span class="ph" aria-hidden="true">' + App.mark(at, 1) + '</span>'; }).join(''); };
      var who = function (js) { return js.map(function (j) { return esc(kids[j].name); }).join('・'); };
      var bot = (rel[i].far.length ? '<div><b>離</b> ' + who(rel[i].far) + '</div>' : '') + (rel[i].near.length ? '<div><b>つ</b> ' + who(rel[i].near) + '</div>' : '');
      var top = side.filter(function (at) { return a[at.k] | 0; }).map(function (at) { return '<div>' + App.mark(at, 1) + ' ' + esc(a[at.k + '_t'] || '') + '</div>'; }).join('') +
        (a.memo ? '<div><b>備考</b> ' + esc(a.memo) + '</div>' : '');
      return '<div class="pc ' + (s.male ? 'm' : 'f') + '"><div class="pc-in">' +
        '<div class="pc-band" style="background:' + oc.c + '"></div>' +
        '<div class="pc-l"><div class="pc-ic">' + ic(true) + (a.sp ? '<span class="pc-sp">特支</span>' : '') + '</div><div class="pc-kana">' + esc(s.kana || '') + '</div><div class="pc-name">' + esc(s.name) + '</div>' +
        '<div class="pc-ic">' + ic(false) + '<span class="pc-ji">' + App.incBox(S.ji[i], S.jv[i], '', true) + '</span>' + '</div></div>' +
        '<div class="pc-r"><div class="pc-t fit">' + top + '</div><div class="pc-b fit">' + bot + '</div></div>' +
        '<div class="pc-fam"><div>家庭環境</div><div>父子・母子</div><div>生保・就援</div><div>兄弟（　 年）</div></div>' +
        '</div></div>';
    };
    var pages = [], total = 0;
    for (var k = 0; k < S.P.nc; k++) {
      var ids = [];
      kids.forEach(function (s, i) { if (p.asg[i] === k) ids.push(i); });
      ids.sort(function (x, y) { return String(kids[x].kana).localeCompare(String(kids[y].kana), 'ja'); });
      var np = Math.ceil(ids.length / PRINT_PER_PAGE) || 1;
      for (var pg = 0; pg < np; pg++) {
        var part = ids.slice(pg * PRINT_PER_PAGE, (pg + 1) * PRINT_PER_PAGE);
        total += part.length;
        pages.push('<div class="pp"><div class="pp-h">' + App.st.grade + '年 ' + esc(clsName(k)) + '　' + (pg + 1) + '/' + np + '</div>' + part.map(card).join('') +
          '<div class="pp-f"><span class="pp-ruler"></span>この線が10cmなら実寸（倍率100%・余白なしで印刷）</div></div>');
      }
    }
    var box = document.createElement('div');
    box.id = 'printbox';
    box.innerHTML = '<div class="pbar"><b>個人票の印刷（' + total + '枚・' + pages.length + 'ページ）</b><span id="pover"></span><span class="sp"></span>' +
      '<button class="btn primary" id="pgo">印刷する</button><button class="btn" id="pclose">閉じる<kbd>Esc</kbd></button></div>' +
      '<div class="pages">' + pages.join('') + '</div>';
    document.body.appendChild(box);
    document.body.classList.add('printing');
    // 字を枠に収まるまで縮める。下限でも収まらない票は数えて知らせる
    var over = 0;
    box.querySelectorAll('.fit').forEach(function (el) {
      var pt = 9;
      el.style.fontSize = pt + 'pt';
      while (el.scrollHeight > el.clientHeight + 1 && pt > PRINT_MIN_PT) { pt -= .5; el.style.fontSize = pt + 'pt'; }
      if (el.scrollHeight > el.clientHeight + 1) { over++; el.classList.add('over'); }
    });
    // 長い名前は横幅だけを縮める（縦の大きさはそのまま）
    box.querySelectorAll('.pc-name').forEach(function (el) {
      var room = el.parentNode.clientWidth - 2 * parseFloat(getComputedStyle(el.parentNode).paddingLeft), w = el.scrollWidth;
      if (w > room) el.style.transform = 'scaleX(' + (room / w).toFixed(3) + ')';
    });
    if (over) box.querySelector('#pover').textContent = '　⚠ ' + over + 'か所が' + PRINT_MIN_PT + 'ptでも入りきりません（赤い点線の枠）';
    var close = function () { document.removeEventListener('keydown', onKey, true); box.remove(); document.body.classList.remove('printing'); };
    var onKey = function (e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    box.addEventListener('click', function (e) {
      if (e.target.closest('#pclose')) close();
      else if (e.target.closest('#pgo')) window.print();
    });
  }

  function namesOf() { var d = S.decision, n = d && d.names; return n && n.length ? n : Array.from({ length: S.P.nc }, function (_, k) { return k + 1; }); }
  function namesText() {
    return namesOf().map(function (v, k) { return C.newClass(k) + '＝' + v + '組'; }).join('・') + (S.decision.named ? '' : '（仮）');
  }
  function namesDialog() {
    var N = namesOf().slice(), grade = App.st.grade;
    App.openDlg({
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="組の番号を決める" style="max-width:560px"><h2>組の番号を決める</h2>' +
          N.map(function (v, k) {
            return '<div class="ordrow"><b class="ncl">' + C.newClass(k) + '</b><span>→</span><div class="lvs">' + N.map(function (_, j) {
              return '<button class="lv" data-cn="' + k + ':' + (j + 1) + '" aria-pressed="' + (v === j + 1) + '">' + (j + 1) + '組</button>';
            }).join('') + '</div></div>';
          }).join('') +
          '<div class="note">番号を押すと、その番号だった組と入れ替わります。保存すると、来年度の名簿の組が付け替わります（出席番号は組の中で変わりません）。後から何度でも直せます。</div>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">この番号にする<kbd>Enter</kbd></button></div></div></div>';
      },
      click: function (t) {
        var x = t.closest('[data-cn]'); if (!x) return false;
        var p = x.dataset.cn.split(':'), k = +p[0], v = +p[1], j = N.indexOf(v);
        N[j] = N[k]; N[k] = v; App.refreshDlg(); return true;
      },
      onOk: function () {
        App.closeDlg();
        App.save(function () { return App.pf().setClassNames(grade, N); }).then(function () { return App.reload(); })
          .then(function () { App.toast('組の番号を決めました：' + N.map(function (v, k) { return C.newClass(k) + '＝' + v + '組'; }).join('・')); });
      }
    });
  }

  function decideDialog() {
    var p = S.plans[S.active], a = E.analyze(S.ctx, p.asg), grade = App.st.grade;
    var body = '<p>' + App.esc(planName(p)) + ' で決定します。次のことを行います。</p><ul><li>' + (grade + 1) + '年の名簿を作ります（新しい番号は組ごとの男女混合の五十音順）</li>' +
      '<li>組の番号は仮で A組＝1組・B組＝2組… にします。番号は後で「組の番号を決める」で決めます</li><li>今年度の配慮項目の値を、来年度に写します。今年度の値はこの時点で凍結されます</li><li>つける・離すを、来年度の候補として持ち越します</li></ul>' +
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
  // 新年度の転入生：足すと、すべての案でいちばん人数の少ない組に入る。決定で来年度の名簿に入る
  function transDialog() {
    var grade = App.st.grade, F = { name: '', kana: '', male: true, id: '' }, busy = false;
    var list = function () { return S.P.kids.filter(function (s) { return s.tr; }); };
    // 足す・消すの前に、手元の案を保存してから読み直す（案の入れ替えを失わない）
    var run = function (fn) {
      if (busy) return; busy = true;
      clearTimeout(saveT);
      App.save(function () { return App.pf().savePlans(grade, serialize()); })
        .then(function () { return App.save(fn); })
        .then(function () { App.closeDlg(); return App.reload(); }).then(function () { transDialog(); });
    };
    App.openDlg({
      focus: 'trName',
      html: function () {
        var esc = App.esc, L = list();
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="転入生" style="max-width:560px"><h2>新年度の転入生（' + grade + '年→' + (grade + 1) + '年）</h2>' +
          (L.length ? '<table class="r"><tbody>' + L.map(function (s) {
            return '<tr><td>' + (s.male ? '男' : '女') + '</td><td style="text-align:left"><b>' + esc(s.name) + '</b> <span class="note">' + esc(s.kana) + '</span></td><td class="note">' + (s.id.charAt(0) === 'T' ? 'IDは未定' : esc(s.id)) + '</td>' +
              '<td><button class="btn" data-trdel="' + esc(s.id) + '">消す</button></td></tr>';
          }).join('') + '</tbody></table>' : '<div class="note">まだいません。</div>') +
          '<div class="trf"><input id="trName" placeholder="名前（例：中島 リス）" value="' + esc(F.name) + '"><input id="trKana" placeholder="よみ（番号の五十音順に使う）" value="' + esc(F.kana) + '">' +
          '<span class="lvs"><button class="lv" data-trsex="1" aria-pressed="' + F.male + '">男</button><button class="lv" data-trsex="0" aria-pressed="' + !F.male + '">女</button></span>' +
          '<input id="trId" inputmode="numeric" maxlength="8" placeholder="児童ID（分かれば。8桁）" value="' + esc(F.id) + '"></div>' +
          '<div class="note">足すと、どの案でもいちばん人数の少ない組に入ります。カードは灰色の帯・白い地で出ます。</div>' +
          '<div class="acts"><button class="btn" data-act="close">閉じる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">足す<kbd>Enter</kbd></button></div></div></div>';
      },
      input: function (t) { if (t.id === 'trName') F.name = t.value; if (t.id === 'trKana') F.kana = t.value; if (t.id === 'trId') F.id = t.value; },
      click: function (t) {
        var x;
        if ((x = t.closest('[data-trsex]'))) { F.male = x.dataset.trsex === '1'; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-trdel]'))) { var id = x.dataset.trdel; run(function () { return App.pf().removeTransfer(grade, id); }); return true; }
        return false;
      },
      onOk: function () {
        if (!F.name.trim()) { App.toast('名前を入れてください'); return; }
        var x = { name: F.name, kana: F.kana, male: F.male, id: F.id };
        run(function () { return App.pf().addTransfer(grade, x); });
      }
    });
  }

  function pairsDialog() {
    App.pairsDialog({
      kids: S.P.kids.map(function (s) { return { id: s.id, name: s.name, kana: s.kana, no: s.no, cls: s.old }; }), nc: S.P.nc, pre: '旧',
      // 案を先に保存してから読み込み直す（案は残る）
      save: function (list) { var grade = App.st.grade, data = serialize(); clearTimeout(saveT); return App.pf().savePlans(grade, data).then(function () { return App.pf().savePairs(grade, list); }); }
    });
  }

  // つける・離す・組に固定の窓。クラス分けの画面と名簿の画面から開く
  // o: { kids:[{id,name,kana,no,cls}], nc, pre:'旧'|'', a:最初に選んでおく児童, save:function(list)→Promise }
  App.pairsDialog = function (o) {
    var d = App.st.data, esc = App.esc, kids = o.kids, kidOf = {};
    kids.forEach(function (s) { kidOf[s.id] = s; });
    var list = d.pairs.map(function (p) { return JSON.parse(JSON.stringify(p)); });
    var carry = (d.carry || []).slice();
    var F = { t: 'far', a: o.a || null, b: null, k: 0, memo: '' };
    var cl = function (s) { return s.cls < 0 ? '転入' : o.pre + (s.cls + 1) + '組'; };
    var nm = function (id) { var s = kidOf[id]; return s ? s.name + '（' + cl(s) + '）' : id; };
    var desc = function (p) { return p.t === 'fix' ? nm(p.a) + ' → ' + C.newClass(p.k) : nm(p.a) + ' と ' + nm(p.b); };
    var sugg = function (q, slot) {
      q = (q || '').trim();
      if (!q) return '';
      var hit = kids.filter(function (s) { return s.name.indexOf(q) >= 0 || s.kana.indexOf(q) >= 0 || s.id.indexOf(q) === 0; }).slice(0, 8);
      return hit.length ? '<div class="sugg">' + hit.map(function (s) { return '<button type="button" data-pk="' + slot + ':' + s.id + '">' + cl(s) + (s.no ? s.no + '番 ' : ' ') + esc(s.name) + '</button>'; }).join('') + '</div>' : '<div class="note">見つかりません</div>';
    };
    var pick = function (slot) {
      var id = F[slot];
      return id ? '<span class="picked"><span>' + esc(nm(id)) + '<button type="button" data-unpk="' + slot + '" aria-label="外す">×</button></span></span>' :
        '<input id="q' + slot + '" placeholder="名前・よみ・児童IDで探す" autocomplete="off" style="padding:4px 6px;border:1px solid var(--line);border-radius:4px"><div id="s' + slot + '"></div>';
    };
    var canAdd = function () { return F.a && (F.t === 'fix' ? true : F.b && F.b !== F.a); };
    App.openDlg({
      focus: F.a ? 'qb' : 'qa',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="つける・離す"><h2>つける・離す・組に固定</h2>' +
          '<div class="form"><div class="toggles">' + ['far', 'near', 'fix'].map(function (t) { return '<button class="tg" data-pt="' + t + '" aria-pressed="' + (F.t === t) + '">' + PT[t] + '</button>'; }).join('') + '</div>' +
          '<div class="row" style="align-items:flex-start"><div>' + pick('a') + '</div><div>' + (F.t === 'fix' ?
            '<div class="lvs">' + Array.from({ length: o.nc }, function (_, k) { return '<button class="lv" data-pkc="' + k + '" aria-pressed="' + (F.k === k) + '">' + C.newClass(k) + '</button>'; }).join('') + '</div>' : pick('b')) + '</div></div>' +
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
        if ((x = t.closest('[data-pcar]'))) { var c = carry.splice(+x.dataset.pcar, 1)[0]; list.push(JSON.parse(JSON.stringify(c))); App.refreshDlg(); return true; } // 経緯・理由・何年生からも引き継ぐ
        return false;
      },
      onOk: function () {
        var n = list.length;
        App.closeDlg();
        App.save(function () { return o.save(list); })
          .then(function () { return App.reload(); }).then(function () { App.toast('つける・離すを保存しました（' + n + '件）'); });
      }
    });
  };

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
      build(); document.body.classList.add('fit');
      if (!S.plans.length) { renderSetup(); genDialog(); return; }
      render();
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
      if (t.closest('#smore')) { moreDialog(); return true; }
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

/* クラス分け：描画（児童カード・上の帯・盤面・比較の表）。ui-split.js の中に差し込まれる（同じ閉じた範囲の変数を使う）。単独では動かない */
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
    applyZoom();

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
  var FIT_W = 4.2; // 列の幅÷行の高さ。これより狭い列では行の高さ（字・印の大きさ）を小さくする
  function fit(rows) {
    var gc = document.querySelector('.gcol');
    if (!gc) return;
    // 行の高さは、縦（全員の行が入る）と横（名前と印が列の幅に入る）の両方から決める。画面が狭くても横に流さない（拡大は盤面の拡大で）
    var rh = (gc.clientHeight - (rows - 1) * 2) / rows, rw = gc.clientWidth / FIT_W, rhc = Math.max(10, Math.min(40, rh, rw)), root = document.documentElement.style;
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

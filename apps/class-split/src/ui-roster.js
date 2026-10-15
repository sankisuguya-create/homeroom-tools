// 名簿：年度・組（または学年・全校）を切り替えて見る。編集できる年度は1つだけ
// （決定前＝今年度、決定後＝次の年度。決定後の今年度は凍結）。児童の名前を押すと、経年の記録と事案を窓で出す。
(function (g) {
  'use strict';
  var App = g.App, C = g.CONFIG, E = g.Engine;
  var R = { fy: 0, cls: 0, scope: 'cls', onlyInc: false, kid: null, form: null, school: null };

  function D() { return App.st.data; }
  function editableFy() { return D().decision ? D().fy + 1 : D().fy; }
  function yearOf(fy) { return D().years.filter(function (y) { return y.fy === fy; })[0]; }
  function incsOf(id, fy) {
    return D().incidents.filter(function (x) { return x.ids.indexOf(id) >= 0 && (fy == null || C.fiscalYearOfIso(x.date) === fy); });
  }

  // つける・離すは今年度の学年の分だけ（決定の後は前年度からの候補として持ち越す）
  function pairEdit() { return R.fy === D().fy && !D().decision; }
  function pairsOf(id) { return D().pairs.filter(function (p) { return p.a === id || p.b === id; }); }
  function openPairs(a) {
    var d = D(), Y = yearOf(d.fy), nc = 0;
    Y.rows.forEach(function (r) { if (r.cls + 1 > nc) nc = r.cls + 1; });
    var kids = Y.rows.map(function (r) { var s = d.kids[r.id]; return { id: r.id, name: s.name, kana: s.kana, no: r.no, cls: r.cls }; });
    (d.transfers || []).forEach(function (t) { kids.push({ id: t.id, name: t.name, kana: t.kana, no: 0, cls: -1 }); });
    App.pairsDialog({ kids: kids, nc: Math.min(C.MAX_CLASSES, Math.max(2, nc)), pre: '', a: a,
      save: function (list) { return App.pf().savePairs(d.grade, list); } });
  }

  // 備考：児童ごと・年度ごとの自由記述。決定で来年度に写る
  function memoDialog(Y, r) {
    var s = D().kids[r.id], fy = R.fy, grade = Y.grade;
    App.openDlg({
      focus: 'mtx',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="備考" style="max-width:520px">' +
          '<h2>' + App.esc(s.name) + 'の備考（' + fy + '年度）</h2>' +
          '<textarea id="mtx" rows="4" maxlength="200" style="width:100%;box-sizing:border-box;font:inherit;padding:6px" placeholder="引き継ぎたいこと（200字まで）">' + App.esc(r.a.memo || '') + '</textarea>' +
          '<div class="note">学年の先生全員が見られます。クラス替えを決定すると、来年度の名簿にも写ります。</div>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">保存<kbd>Ctrl+Enter</kbd></button></div></div></div>';
      },
      onOk: function () {
        var text = App.$('mtx').value.trim();
        if (text) r.a.memo = text; else delete r.a.memo;
        App.closeDlg(); render();
        App.save(function () { return App.pf().setAttr(fy, grade, r.id, 'memo', text ? 1 : 0, text); });
      }
    });
  }

  // ===== 並び順（第一〜第三優先）。クラス分けと同じ窓。この端末にだけ覚える =====
  // 行には id・kana・male・cls・no・a・n（その年度の事案の件数）を持たせて比べる
  var SORT_KEYS = [
    { k: 'cls', label: '組', f: function (s) { return s.cls; } },
    { k: 'no', label: '出席番号', f: function (s) { return s.no; } },
    { k: 'male', label: '男女（男が先）', f: function (s) { return s.male ? 0 : 1; } },
    { k: 'female', label: '男女（女が先）', f: function (s) { return s.male ? 1 : 0; } },
    { k: 'kana', label: 'よみ（五十音）', f: null },
    { k: 'inc', label: '事案の件数（多い順）', f: function (s) { return -s.n; } },
    { k: 'care', label: '配慮項目の数（多い順）', f: function (s) { var n = 0; C.ATTRS.forEach(function (at) { if (!at.good && (s.a[at.k] | 0)) n += s.a[at.k] | 0; }); return -n; } }
  ];
  var DEF_ORDER = ['cls', 'no', ''];
  var ORDER = (function () { try { var v = JSON.parse(localStorage.getItem('classSplit.rosterOrder')); if (Array.isArray(v) && v.length === 3) return v; } catch (e) { /* 読めない時は既定 */ } return DEF_ORDER.slice(); })();
  function setOrder(O) {
    ORDER = O;
    try { localStorage.setItem('classSplit.rosterOrder', JSON.stringify(ORDER)); } catch (e) { /* 覚えられなくても今の画面には効く */ }
    render();
  }

  // 「その他…」の窓：年度・全校の事案・絞り込み・つける離す・名簿を貼る・使い方
  function moreDialog() {
    App.openDlg({
      html: function () {
        var d = D(), edit = R.fy === editableFy();
        var years = d.years.map(function (y) { return y.fy; }).sort(function (a, b) { return b - a; });
        return '<div class="pop" data-close="1"><div class="dlg more" role="dialog" aria-modal="true" aria-label="その他" style="max-width:640px"><h2>その他</h2>' +
          '<section><h3>年度</h3><div class="rbar">' + years.map(function (fy) {
            return '<button class="tab" data-fy="' + fy + '" aria-selected="' + (fy === R.fy) + '">' + fy + '年度（' + yearOf(fy).grade + '年）' +
              (fy === d.fy ? '・今年度' : fy > d.fy ? '・準備中' : '') + '</button>';
          }).join('') + '</div></section>' +
          '<section><h3>表示</h3><div class="rbar"><button class="tab" data-scope="school" aria-selected="' + (R.scope === 'school') + '">全校の事案</button>' +
          '<label class="chk"><input type="checkbox" id="onlyInc"' + (R.onlyInc ? ' checked' : '') + '>事案のある児童だけ</label>' +
          '<button class="btn" id="rorder">並び順…</button></div></section>' +
          '<section><h3>編集</h3><div class="rbar">' +
          (pairEdit() ? '<button class="btn" id="rpairs">つける・離す…（' + d.pairs.length + '件）</button>' : '<span class="note">つける・離すは、今年度・決定前だけ直せます。</span>') +
          (edit ? '<button class="btn" id="paste">名簿を貼る…</button>' : '') + '</div></section>' +
          '<section><h3>使い方</h3><div class="note">項目のマスをタップ：空→アイコン→＋→空。ア・身・通と備考は内容を書く（自動保存）。<br>' +
          'つける・離すの列を押すと、その児童を選んで設定の窓が開きます。直せるのは' + editableFy() + '年度だけです（' + (d.decision ? '決定の後は今年度を凍結' : '決定前は今年度') + '）。</div></section>' +
          '<div class="acts"><button class="btn" data-act="close">閉じる<kbd>Esc</kbd></button></div></div></div>';
      },
      noEnter: true,
      input: function (t) { App.screens.roster.input(t); App.refreshDlg(); },
      // 窓の中のボタンは名簿の操作と同じ。押したら窓を閉じてから行う（次の窓を開けるように）
      click: function (t) {
        if (!t.closest('button[data-fy],button[data-scope],#rpairs,#paste,#rorder')) return false;
        App.closeDlg(); return App.screens.roster.click(t);
      }
    });
  }

  function reset() { R.fy = editableFy(); R.cls = App.me && App.me.grade === App.st.grade && App.me.cls >= 0 ? App.me.cls : 0; R.scope = 'cls'; R.onlyInc = false; R.byCount = false; R.kid = null; R.form = null; R.school = null; }

  function render() {
    var d = D(), esc = App.esc;
    var years = d.years.map(function (y) { return y.fy; }).sort(function (a, b) { return b - a; });
    if (years.indexOf(R.fy) < 0) R.fy = editableFy();
    var Y = yearOf(R.fy), edit = R.fy === editableFy();
    if (!Y) { // まだ名簿が無い学年
      App.$('main').innerHTML = '<div class="menu"><section><h2>' + d.grade + '年の名簿がまだありません</h2>' +
        '<p>既存の名簿の範囲をコピーして貼り付けます（児童ID・名前・よみ・性別・組・番号）。</p>' +
        '<button class="btn primary" id="paste">名簿を貼る…</button></section></div>';
      return;
    }
    var nc = 0; Y.rows.forEach(function (r) { if (r.cls + 1 > nc) nc = r.cls + 1; });
    // 上の帯：編集中に使う「組・学年」の切り替えと、いまの状態（既定と違う時だけ）だけを出す。ほかは「その他…」の窓へ
    var h = '<div class="rbar">';
    // 決定の後の準備中の年度：組の番号が仮の間は、どの新しい組かを添える
    var prov = R.fy === d.fy + 1 && d.decision && !d.decision.named ? d.decision.names : null;
    for (var k = 0; k < nc; k++) h += '<button class="tab" data-cls="' + k + '" aria-selected="' + (R.scope === 'cls' && R.cls === k) + '"><span class="band" style="background:' + App.classColor(k).c + '"></span>' + (k + 1) + '組' + (prov && prov.indexOf(k + 1) >= 0 ? '〔' + C.newClass(prov.indexOf(k + 1)) + '・仮〕' : '') + '（' + Y.rows.filter(function (r) { return r.cls === k; }).length + '人）</button>';
    h += '<button class="tab" data-scope="grade" aria-selected="' + (R.scope === 'grade') + '">学年（' + Y.rows.length + '人）</button>';
    if (R.scope === 'school') h += '<span class="state">全校の事案を表示中<button class="btn" data-scope="cls">戻る</button></span>';
    else {
      if (R.fy !== editableFy()) h += '<span class="state">' + R.fy + '年度（' + Y.grade + '年）を表示中・' +
        (R.fy === d.fy && d.decision ? '決定したので凍結' : '見るだけ') + '<button class="btn" data-fy="' + editableFy() + '">戻る</button></span>';
      if (R.onlyInc) h += '<span class="state">事案のある児童だけ<button class="btn" id="unfilter">解除</button></span>';
      if (ORDER.join() !== DEF_ORDER.join()) h += '<span class="state">並び順：' + ORDER.filter(String).map(function (k) { return SORT_KEYS.filter(function (q) { return q.k === k; })[0].label; }).join('→') +
        '<button class="btn" id="rorder">変える</button><button class="btn" id="unorder">戻す</button></span>';
    }
    h += '<span class="sp"></span><button class="btn" id="rmore" aria-haspopup="dialog">その他…</button>';
    h += '</div><div class="layout">' + (R.scope === 'school' ? schoolTable() : table(Y, edit)) + '</div>';
    h += '<div class="legend">' + C.ATTRS.map(function (at) { return '<span class="c">' + App.mark(at, 1) + at.label + '</span>'; }).join('') +
      '<span>＋＝負担が明確に増える（アイコンにカーソルで説明）　点線の数字＝その年度の事案の件数</span></div>';
    App.$('main').innerHTML = h;
    App.fitNames(App.$('main'));
    kidPop();
  }

  // ア・身・通：有無と内容（例：卵・エピペン）を書く。内容はアイコンにカーソルを合わせると出る
  function noteDialog(Y, r, at, cell) {
    var s = D().kids[r.id], fy = R.fy, grade = Y.grade;
    var put = function (v, text) {
      r.a[at.k] = v;
      if (v && text) r.a[at.k + '_t'] = text; else delete r.a[at.k + '_t'];
      App.closeDlg();
      cell.innerHTML = v ? App.mark(at, v, r.a[at.k + '_t']) : '';
      if (R.kid === r.id) render();
      App.save(function () { return App.pf().setAttr(fy, grade, r.id, at.k, v, v ? text : ''); });
    };
    App.openDlg({
      focus: 'ntx',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="' + App.esc(at.label) + '" style="max-width:480px">' +
          '<h2>' + App.mark(at, 1) + ' ' + App.esc(s.name) + 'の' + App.esc(at.label) + '</h2>' +
          '<textarea id="ntx" rows="3" maxlength="200" placeholder="内容（例：' + (at.k === 'k5' ? '卵・ピーナッツ。エピペンあり' : at.k === 'k6' ? '右耳が聞こえにくい。前の席' : '週1回 ことばの教室') + '）">' + App.esc(r.a[at.k + '_t'] || '') + '</textarea>' +
          '<div class="note">カーソルを合わせると、この内容が出ます。</div>' +
          '<div class="acts">' + ((r.a[at.k] | 0) ? '<button class="btn" data-act="none" style="margin-right:auto">なしにする</button>' : '') +
          '<button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">ありで保存<kbd>Ctrl+Enter</kbd></button></div></div></div>';
      },
      click: function (t) { if (t.closest('[data-act="none"]')) { put(0, ''); return true; } return false; },
      onOk: function () { put(1, App.$('ntx').value.trim()); }
    });
  }

  function table(Y, edit) {
    var d = D(), esc = App.esc, showPairs = R.fy === d.fy, pe = pairEdit();
    var rows = Y.rows.filter(function (r) { return R.scope === 'grade' || r.cls === R.cls; }).map(function (r) {
      return { r: r, n: incsOf(r.id, R.fy).length };
    });
    if (R.onlyInc) rows = rows.filter(function (x) { return x.n > 0; });
    rows.forEach(function (x) { var s = d.kids[x.r.id]; x.id = x.r.id; x.kana = s.kana; x.male = s.male; x.cls = x.r.cls; x.no = x.r.no; x.a = x.r.a; });
    rows.sort(function (a, b) { return App.byKeys(SORT_KEYS, ORDER, a, b); });
    var h = '<div class="tw"><table class="r ' + (edit ? '' : 'ro') + '"><thead><tr>' + (R.scope === 'grade' ? '<th>組</th>' : '') + '<th>番号</th><th style="text-align:left">名前</th><th class="spc" title="特別支援学級">特支</th>' +
      C.ATTRS.map(function (at) { return '<th class="an">' + App.esc(at.label) + '</th>'; }).join('') + '<th>事案</th>' + (showPairs ? '<th class="pr">つける<br>離す</th>' : '') + '<th class="memo">備考</th></tr></thead><tbody>';
    rows.forEach(function (x) {
      var r = x.r, s = d.kids[r.id];
      h += '<tr class="' + (r.id === R.kid ? 'on' : '') + '">' + (R.scope === 'grade' ? '<td><span class="band" style="background:' + App.classColor(r.cls).c + '"></span>' + (r.cls + 1) + '</td>' : '') +
        '<td>' + r.no + '</td><td class="nm" data-kid="' + r.id + '"><span class="sx ' + (s.male ? 'm' : 'f') + '">' + (s.male ? '男' : '女') + '</span>' + App.nameBox(s.name) + '</td>' +
        '<td class="cell spc" data-cell="' + r.id + '" data-k="sp" title="特別支援学級">' + (r.a.sp ? '<span class="spb">支</span>' : '') + '</td>' +
        C.ATTRS.map(function (at) { var v = r.a[at.k] | 0; return '<td class="cell" data-cell="' + r.id + '" data-k="' + at.k + '">' + (v ? App.mark(at, v, r.a[at.k + '_t']) : '') + '</td>'; }).join('') +
        '<td class="ji" data-kid="' + r.id + '">' + (x.n ? '<span class="jn">' + x.n + '</span>' : '') + '</td>' +
        (showPairs ? '<td class="pr' + (pe ? ' ed' : '') + '"' + (pe ? ' data-rpair="' + r.id + '"' : '') + '>' + pairMarks(r.id) + '</td>' : '') +
        '<td class="memo' + (edit ? ' ed' : '') + '"' + (edit ? ' data-memo="' + r.id + '"' : '') + (r.a.memo ? ' title="' + esc(r.a.memo) + '"' : '') + '><div>' + esc(r.a.memo || '') + '</div></td></tr>';
    });
    if (!rows.length) h += '<tr><td colspan="16" class="empty">該当する児童はいません</td></tr>';
    return h + '</tbody></table></div>';
  }

  // その児童の「離す」「つける」「固定」の数。相手の名前はカーソルで出す
  function pairMarks(id) {
    var d = D(), ps = pairsOf(id), n = { far: 0, near: 0, fix: 0 }, tip = [];
    var PT = { far: '離す', near: 'つける', fix: '組に固定' };
    ps.forEach(function (p) {
      n[p.t]++;
      var o = p.a === id ? p.b : p.a;
      tip.push(PT[p.t] + '：' + (p.t === 'fix' ? (p.k + 1) + '組' : d.kids[o] ? d.kids[o].name : o));
    });
    if (!ps.length) return '';
    return '<span class="prm" title="' + App.esc(tip.join('\n')) + '">' + (n.far ? '<b class="pf">離' + (n.far > 1 ? n.far : '') + '</b>' : '') +
      (n.near ? '<b class="pn">つ' + (n.near > 1 ? n.near : '') + '</b>' : '') + (n.fix ? '<b class="px">固</b>' : '') + '</span>';
  }

  function schoolTable() {
    if (!R.school) {
      App.pf().schoolIncidents().then(function (rows) { R.school = rows; if (App.st.screen === 'roster' && R.scope === 'school') render(); });
      return '<div class="tw"><div class="empty">読み込んでいます…</div></div>';
    }
    var esc = App.esc, rows = R.school.slice().sort(function (a, b) { return b.count - a.count || a.grade - b.grade || a.cls - b.cls || a.no - b.no; });
    return '<div class="tw"><table class="r ro"><thead><tr><th>学年</th><th>組</th><th>番号</th><th style="text-align:left">名前</th><th>件数</th><th>最新</th></tr></thead><tbody>' +
      rows.map(function (x) {
        return '<tr><td>' + x.grade + '</td><td><span class="band" style="background:' + App.classColor(x.cls).c + '"></span>' + (x.cls + 1) + '</td><td>' + x.no + '</td>' +
          '<td class="nm" data-jump="' + x.grade + ':' + x.id + '"><span class="sx">' + (x.male ? '男' : '女') + '</span>' + esc(x.name) + '</td><td><span class="jn">' + x.count + '</span></td><td>' + x.last + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  // 児童の窓：経年の記録と事案。名前を押すと開き、閉じると選択も外す
  function kidPop() {
    var d = D();
    if (!R.kid || !d.kids[R.kid]) { if (App.dlg && App.dlg.kid) App.closeDlg(); return; }
    if (App.dlg && App.dlg.kid) { App.refreshDlg(); mountDg(); return; }
    if (App.dlg) return; // ほかの枠が開いている間は出さない
    App.openDlg({
      kid: true,
      html: function () { return '<div class="pop" data-close="1">' + pane() + '</div>'; },
      click: function (t) { return t.closest('.kidpop') ? App.screens.roster.click(t) : false; },
      input: function (t) { App.screens.roster.input(t); },
      onClose: function () { R.kid = null; R.form = null; render(); }
    });
    mountDg();
  }
  // 関係図は自分の枠だけ描き直す（窓全体を描き直すと入力中の文字が切れるため）
  function mountDg() {
    var el = App.$('fDg');
    if (el && R.form) App.Diagram.mount(el, R.form.dg, function (st) { R.form.dg = st; });
  }

  function pane() { return recordHtml(R.kid, R.fy, true); }

  // 児童の記録（経年の記録と事案）。名簿の窓と、クラス分けのカードの事案の数から開く窓で使う
  function recordHtml(kid, curFy, canAdd) {
    var d = D(), esc = App.esc;
    var s = d.kids[kid];
    var h = '<aside class="dlg pane kidpop" role="dialog" aria-modal="true" aria-label="' + esc(s.name) + 'の記録"><button class="btn kx" data-act="close" aria-label="閉じる">閉じる<kbd>Esc</kbd></button><h2>' + esc(s.name) + ' <span class="id">' + s.id + '・' + (s.male ? '男' : '女') + '</span></h2>' +
      '<section><h3>経年の記録</h3><table class="h"><thead><tr><th>年度</th><th>学年-組-番</th>' +
      C.ATTRS.map(function (at) { return '<th>' + App.mark(at, 1) + '</th>'; }).join('') + '<th>事案</th></tr></thead><tbody>';
    d.years.slice().sort(function (a, b) { return a.fy - b.fy; }).forEach(function (y) {
      var r = y.rows.filter(function (x) { return x.id === kid; })[0];
      if (!r) return;
      var n = incsOf(kid, y.fy).length;
      h += '<tr class="' + (y.fy === curFy ? 'cur' : '') + '"><td>' + String(y.fy).slice(2) + (y.fy > d.fy ? '準' : '') + '</td><td class="gcn"><span class="band" style="background:' + App.classColor(r.cls).c + '"></span>' + y.grade + '-' + (r.cls + 1) + '-<span class="no">' + r.no + '</span></td>' +
        C.ATTRS.map(function (at) { return '<td>' + ((r.a[at.k] | 0) || '') + '</td>'; }).join('') + '<td>' + (n || '') + '</td></tr>';
    });
    h += '</tbody></table><div class="note">項目の数字は程度（空欄＝なし）。「準」は決定後の準備中の年度。</div></section>';
    var list = incsOf(kid).sort(function (a, b) { return b.date < a.date ? -1 : 1; });
    h += '<section><h3>事案（全' + list.length + '件）' + (canAdd && !R.form ? '<button class="btn primary" id="addInc">＋事案を登録</button>' : '') + '</h3>';
    if (canAdd && R.form) h += form();
    h += '<div class="inc">' + (list.map(function (x) {
      var others = x.ids.filter(function (id) { return id !== kid; }).map(function (id) { return d.kids[id] ? d.kids[id].name : id; });
      var y = d.years.filter(function (yy) { return yy.fy === C.fiscalYearOfIso(x.date); })[0];
      var role = x.roles && x.roles[kid];
      return '<div class="it"><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title || '（名前なし）') + ' ↗</a><span class="meta">' + App.span(x) + '・' + esc(x.type) +
        (y ? '・' + y.grade + '年の時' : '') + (role ? '・<em class="r-' + role + '">' + E.ROLE_NAMES[role] + '</em>' : '') + (others.length ? '・関係：' + others.map(esc).join('、') : '') + '</span>' + (x.detail ? '<div class="dt">' + esc(x.detail) + '</div>' : '') +
        (canAdd && !R.form ? '<button type="button" class="btn ie" data-editinc="' + x.id + '">関係図・直す</button>' : '') + '</div>';
    }).join('') || '<div class="note">事案はありません</div>') + '</div></section></aside>';
    return h;
  }
  // クラス分けの画面から：見るだけの窓
  App.showRecord = function (kid) {
    if (!D().kids[kid]) return;
    App.openDlg({ html: function () { return '<div class="pop" data-close="1">' + recordHtml(kid, D().fy, false) + '</div>'; } });
  };

  function form() {
    var f = R.form, d = D(), esc = App.esc;
    var today = new Date(), iso = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
    f.date = f.date || iso;
    return '<form class="form" id="incForm">' +
      '<label>文書のURL<input id="fUrl" value="' + esc(f.url || '') + '" placeholder="docs.google.com/… を貼る" required></label>' +
      '<label>文書の名前' + (f.titleMsg ? '（' + f.titleMsg + '）' : '') + '<input id="fTitle" value="' + esc(f.title || '') + '" placeholder="URLを貼ると自動で入ります"></label>' +
      '<label>関係する児童と関係図（矢印＝加害）</label>' +
      '<input id="fQ" value="" placeholder="名前・よみ・番号で児童を足す" autocomplete="off"><div id="fSugg"></div><div id="fDg" class="dg"></div>' +
      '<label>詳細（経緯・したこと・言ったこと・対応 など）<textarea id="fDetail" rows="5" maxlength="5000" placeholder="見たこと・聞いたこと・したことを、日時とともに事実で書きます">' + esc(f.detail || '') + '</textarea></label>' +
      '<div class="note">保護者から開示を求められることがある記録です。事実を書き、推測や人柄の評価は書きません。卒業・転出から' + C.INCIDENT_KEEP_YEARS + '年度は残ります。</div>' +
      '<div class="row"><label>期間（始まり）<input id="fDate" type="date" value="' + f.date + '"></label><label>終わり（その日だけなら空のまま）<input id="fDateEnd" type="date" min="' + f.date + '" value="' + (f.dateEnd || '') + '"></label></div>' +
      '<div class="row"><label>種別<select id="fType">' +
      C.INCIDENT_TYPES.map(function (t) { return '<option' + (t === f.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="note">文書の名前に児童の氏名を入れないでください（一覧は全教員が見られます）</div>' +
      '<div class="row"><button type="button" class="btn" id="cancelInc">やめる</button><button class="btn primary">' + (f.edit ? '直す' : '登録する') + '</button></div></form>';
  }

  // 候補だけを描き直す（入力欄を作り直すと日本語入力の変換が切れるため）
  function suggHtml(q) {
    var d = D(), f = R.form, esc = App.esc;
    q = (q || '').trim();
    if (!q) return '';
    var items = yearOf(d.fy).rows.filter(function (r) {
      var s = d.kids[r.id];
      return !f.dg.d.nodes.some(function (n) { return n.id === r.id; }) && (s.name.indexOf(q) >= 0 || s.kana.indexOf(q) >= 0 || r.id.indexOf(q) === 0 || String(r.no) === q);
    }).slice(0, 8);
    return items.length ? '<div class="sugg">' + items.map(function (r) { return '<button type="button" data-pick="' + r.id + '">' + (r.cls + 1) + '組' + r.no + '番 ' + esc(d.kids[r.id].name) + '</button>'; }).join('') + '</div>' : '<div class="note">見つかりません</div>';
  }

  // ===== 名簿を貼る =====
  // 既存の名簿の範囲をコピーして貼る。見出しで列を読み、読めた結果と誤りをその場で見せてから取り込む
  function pasteDialog() {
    var d = D(), fy = editableFy(), grade = fy === d.fy ? d.grade : d.grade + 1, esc = App.esc;
    var P = { text: '', cls: R.scope === 'cls' ? R.cls : 0, res: null };
    var summary = function () {
      var r = P.res = g.Paste.parseRoster(P.text, P.cls);
      if (!P.text.trim()) return '<div class="note">貼ると、読み取った結果がここに出ます</div>';
      var hasCls = r.roles.indexOf('cls') >= 0;
      var h = '<div class="rbar"><span class="lab">読み取った列</span>' + r.roles.map(function (x) { return '<span class="tab" style="cursor:default">' + (x ? g.Paste.LABEL[x] : '（使わない）') + '</span>'; }).join('') + '</div>';
      if (!hasCls) h += '<div class="rbar"><span class="lab">組の列が無いので、この組に入れる</span>' + [0, 1, 2, 3].map(function (k) {
        return '<button class="tab" data-pcls="' + k + '" aria-selected="' + (P.cls === k) + '"><span class="band" style="background:' + App.classColor(k).c + '"></span>' + (k + 1) + '組</button>';
      }).join('') + '</div>';
      h += '<div><b>' + r.rows.length + '人</b>（男' + r.counts.m + '・女' + r.counts.f + '）を ' + fy + '年度 ' + grade + '年 に取り込みます。同じ児童IDの児童は上書きし、入力済みの配慮項目は消しません。</div>';
      if (r.errors.length) h += '<div class="warnbox">✕ ' + r.errors.length + '件 取り込めない行があります<ul style="margin:4px 0 0;font-weight:400;color:var(--ink)">' +
        r.errors.slice(0, 6).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + (r.errors.length > 6 ? '<li>ほか' + (r.errors.length - 6) + '件</li>' : '') + '</ul></div>';
      if (r.rows.length) h += '<div class="tw" style="max-height:180px"><table class="r ro"><thead><tr><th>組</th><th>番号</th><th>児童ID</th><th style="text-align:left">名前</th><th>よみ</th><th>性別</th></tr></thead><tbody>' +
        r.rows.slice(0, 5).map(function (x) { return '<tr><td>' + (x.cls + 1) + '</td><td>' + x.no + '</td><td>' + x.id + '</td><td style="text-align:left">' + esc(x.name) + '</td><td>' + esc(x.kana) + '</td><td>' + (x.sex || '—') + '</td></tr>'; }).join('') +
        (r.rows.length > 5 ? '<tr><td colspan="6" class="note">ほか' + (r.rows.length - 5) + '人</td></tr>' : '') + '</tbody></table></div>';
      return h;
    };
    var refresh = function () { App.$('psum').innerHTML = summary(); var b = App.$('okbtn'); b.disabled = !P.res.rows.length; b.firstChild.textContent = '取り込む（' + P.res.rows.length + '人）'; };
    App.openDlg({
      focus: 'ptxt',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="名簿を貼る"><h2>名簿を貼る</h2>' +
          '<textarea id="ptxt" rows="6" style="width:100%;box-sizing:border-box;font:inherit;padding:6px" placeholder="既存の名簿の範囲（見出しの行を含めて）をコピーして、ここに貼り付けます">' + esc(P.text) + '</textarea>' +
          '<div id="psum">' + summary() + '</div>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok" id="okbtn"' + (P.res && P.res.rows.length ? '' : ' disabled') + '>取り込む（' + (P.res ? P.res.rows.length : 0) + '人）<kbd>Ctrl+Enter</kbd></button></div></div></div>';
      },
      input: function (t) { if (t.id === 'ptxt') { P.text = t.value; refresh(); } },
      click: function (t) { var x = t.closest('[data-pcls]'); if (x) { P.cls = +x.dataset.pcls; refresh(); return true; } return false; },
      onOk: function () {
        if (!P.res || !P.res.rows.length) return;
        var rows = P.res.rows;
        App.closeDlg();
        App.save(function () { return App.pf().importRoster(fy, grade, rows); }).then(function (r) {
          return App.reload().then(function () {
            App.toast('取り込みました：追加' + r.added + '人・更新' + r.updated + '人' + (r.missing.length ? '。貼った中にいない児童（名簿には残っています）：' + r.missing.slice(0, 5).join('、') + (r.missing.length > 5 ? ' ほか' + (r.missing.length - 5) + '人' : '') : ''));
          });
        });
      }
    });
  }

  function refocus(id, pos) { var el = App.$(id); if (el) { el.focus(); if (pos != null && el.setSelectionRange) el.setSelectionRange(pos, pos); } }

  App.screens.roster = {
    enter: function () { reset(); render(); },
    render: render,
    selectKid: function (id) { R.kid = id; render(); },
    click: function (t) {
      var d = D(), x;
      if ((x = t.closest('[data-fy]'))) { R.fy = +x.dataset.fy; render(); return true; }
      if ((x = t.closest('[data-cls]'))) { R.scope = 'cls'; R.cls = +x.dataset.cls; render(); return true; }
      if ((x = t.closest('[data-scope]'))) { R.scope = x.dataset.scope; if (R.scope === 'school') R.school = null; render(); return true; }
      if ((x = t.closest('[data-jump]'))) {
        var p = x.dataset.jump.split(':');
        App.go('roster', +p[0]).then(function () { R.kid = p[1]; R.scope = 'cls'; var r = yearOf(D().fy).rows.filter(function (y) { return y.id === p[1]; })[0]; if (r) R.cls = r.cls; render(); });
        return true;
      }
      if ((x = t.closest('[data-cell]'))) {
        if (R.fy !== editableFy()) return true;
        var Y = yearOf(R.fy), r = Y.rows.filter(function (y) { return y.id === x.dataset.cell; })[0], k = x.dataset.k;
        if (k === 'sp') { // 特別支援学級：押すたびに あり／なし
          var sv = r.a.sp ? 0 : 1, sfy = R.fy, sg = Y.grade;
          if (sv) r.a.sp = 1; else delete r.a.sp;
          x.innerHTML = sv ? '<span class="spb">支</span>' : '';
          App.save(function () { return App.pf().setAttr(sfy, sg, r.id, 'sp', sv); });
          return true;
        }
        var at = C.ATTRS.filter(function (a) { return a.k === k; })[0];
        if (at.side) { noteDialog(Y, r, at, x); return true; }
        r.a[k] = (r.a[k] | 0) >= at.max ? 0 : (r.a[k] | 0) + 1; // 押すたびに 無→アイコン→アイコン＋→無
        var v = r.a[k], fy = R.fy, grade = Y.grade;
        x.innerHTML = v ? App.mark(at, v) : ''; // そのマスだけ書き換える（表を作り直さない）
        if (R.kid === r.id) render();
        App.save(function () { return App.pf().setAttr(fy, grade, r.id, k, v); });
        return true;
      }
      if ((x = t.closest('[data-kid]'))) { R.kid = x.dataset.kid; R.form = null; render(); return true; }
      if (t.closest('#paste')) { pasteDialog(); return true; }
      if (t.closest('#rpairs')) { openPairs(null); return true; }
      if (t.closest('#rmore')) { moreDialog(); return true; }
      if (t.closest('#unfilter')) { R.onlyInc = false; render(); return true; }
      if (t.closest('#unorder')) { setOrder(DEF_ORDER.slice()); return true; }
      if (t.closest('#rorder')) { App.orderDialog({ title: '名簿の並び順', keys: SORT_KEYS, def: DEF_ORDER, cur: ORDER, onOk: setOrder }); return true; }
      if ((x = t.closest('[data-rpair]'))) { openPairs(x.dataset.rpair); return true; }
      if ((x = t.closest('[data-memo]'))) {
        if (R.fy !== editableFy()) return true;
        var MY = yearOf(R.fy); memoDialog(MY, MY.rows.filter(function (y) { return y.id === x.dataset.memo; })[0]); return true;
      }
      if (t.closest('#addInc')) { var st0 = App.Diagram.state(null); App.Diagram.add(st0, R.kid); R.form = { dg: st0 }; render(); refocus('fUrl'); return true; }
      if ((x = t.closest('[data-editinc]'))) {
        var inc = d.incidents.filter(function (y) { return y.id === +x.dataset.editinc; })[0];
        if (!inc) return true;
        var st1 = App.Diagram.state(inc.diagram);
        if (!inc.diagram) inc.ids.forEach(function (id) { App.Diagram.add(st1, id); }); // 関係図の無い古い事案は、関係する児童を並べて始める
        R.form = { edit: inc.id, url: inc.url, title: inc.title, date: inc.date, dateEnd: inc.dateEnd || '', detail: inc.detail || '', type: inc.type, dg: st1 }; render(); return true;
      }
      if (t.closest('#cancelInc')) { R.form = null; render(); return true; }
      if ((x = t.closest('[data-pick]'))) { App.Diagram.add(R.form.dg, x.dataset.pick); App.$('fQ').value = ''; App.$('fSugg').innerHTML = ''; mountDg(); refocus('fQ'); return true; }
      return false;
    },
    input: function (t) {
      if (t.id === 'onlyInc') { R.onlyInc = t.checked; render(); return; }
      if (!R.form) return;
      if (t.id === 'fQ') { App.$('fSugg').innerHTML = suggHtml(t.value); }
      else if (t.id === 'fTitle') R.form.title = t.value;
      else if (t.id === 'fDate') { R.form.date = t.value; var fe = App.$('fDateEnd'); if (fe) fe.min = t.value; }
      else if (t.id === 'fDateEnd') R.form.dateEnd = t.value;
      else if (t.id === 'fDetail') R.form.detail = t.value;
      else if (t.id === 'fType') R.form.type = t.value;
      else if (t.id === 'fUrl') {
        R.form.url = t.value;
        var url = t.value;
        clearTimeout(R.form.timer);
        R.form.timer = setTimeout(function () {
          App.pf().fetchTitle(url).then(function (r) {
            if (!R.form || R.form.url !== url) return;
            if (r.title) { R.form.title = r.title; R.form.titleMsg = '自動で取得しました'; }
            else R.form.titleMsg = '取得できませんでした。名前を入力してください';
            render(); refocus(r.title ? 'fType' : 'fTitle');
          });
        }, 400);
      }
    },
    submit: function (f) {
      if (f.id !== 'incForm') return;
      var x = R.form, dg = x.dg.d;
      if (!dg.nodes.length) { App.toast('関係する児童を1人以上足してください'); return; }
      if (x.dateEnd && x.dateEnd < x.date) { App.toast('終わりの日は始まりの日より後にしてください'); return; }
      var body = { url: x.url, title: x.title || '', date: x.date, dateEnd: x.dateEnd || '', detail: x.detail || '', type: x.type || C.INCIDENT_TYPES[0], ids: dg.nodes.map(function (n) { return n.id; }), diagram: dg };
      App.save(function () { return x.edit ? App.pf().updateIncident(x.edit, body) : App.pf().addIncident(body); }).then(function (inc) {
        var list = D().incidents, i = list.map(function (y) { return y.id; }).indexOf(inc.id);
        if (i >= 0) list[i] = inc; else list.push(inc);
        R.form = null; render(); App.toast(x.edit ? '事案を直しました' : '事案を登録しました');
      });
    },
    key: function (e) {
      if (e.key === 'Escape' && R.kid) { R.kid = null; R.form = null; render(); return true; }
      return false;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

// 名簿：年度・組（または学年・全校）を切り替えて見る。編集できる年度は1つだけ
// （決定前＝今年度、決定後＝次の年度。決定後の今年度は凍結）。右に児童の経年の記録と事案。
(function (g) {
  'use strict';
  var App = g.App, C = g.CONFIG;
  var R = { fy: 0, cls: 0, scope: 'cls', onlyInc: false, byCount: false, kid: null, form: null, school: null };

  function D() { return App.st.data; }
  function editableFy() { return D().decision ? D().fy + 1 : D().fy; }
  function yearOf(fy) { return D().years.filter(function (y) { return y.fy === fy; })[0]; }
  function incsOf(id, fy) {
    return D().incidents.filter(function (x) { return x.ids.indexOf(id) >= 0 && (fy == null || C.fiscalYearOfIso(x.date) === fy); });
  }

  function reset() { R.fy = editableFy(); R.cls = 0; R.scope = 'cls'; R.onlyInc = false; R.byCount = false; R.kid = null; R.form = null; R.school = null; }

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
    var h = '<div class="rbar"><span class="lab">年度</span>' + years.map(function (fy) {
      var y = yearOf(fy);
      return '<button class="tab" data-fy="' + fy + '" aria-selected="' + (fy === R.fy) + '">' + fy + '年度（' + y.grade + '年）' +
        (fy === d.fy ? '・今年度' : fy > d.fy ? '・準備中' : '') + '</button>';
    }).join('') + '</div>';
    h += '<div class="rbar"><span class="lab">範囲</span>';
    for (var k = 0; k < nc; k++) h += '<button class="tab" data-cls="' + k + '" aria-selected="' + (R.scope === 'cls' && R.cls === k) + '"><span class="band" style="background:' + App.classColor(k).c + '"></span>' + (k + 1) + '組（' + Y.rows.filter(function (r) { return r.cls === k; }).length + '人）</button>';
    h += '<button class="tab" data-scope="grade" aria-selected="' + (R.scope === 'grade') + '">学年（' + Y.rows.length + '人）</button>';
    h += '<button class="tab" data-scope="school" aria-selected="' + (R.scope === 'school') + '">全校の事案</button>';
    if (R.scope !== 'school') {
      h += '<label class="chk"><input type="checkbox" id="onlyInc"' + (R.onlyInc ? ' checked' : '') + '>事案のある児童だけ</label>';
      h += '<label class="chk"><input type="checkbox" id="byCount"' + (R.byCount ? ' checked' : '') + '>件数の多い順</label>';
    }
    h += '<span class="sp"></span>';
    if (edit && R.scope !== 'school') h += '<button class="btn" id="paste">名簿を貼る…</button>';
    if (R.scope !== 'school') h += edit ? '<span class="note">項目のマスをタップ：空→1→2→3→空（自動保存）</span>' :
      R.fy === d.fy && d.decision ? '<span class="frozen">クラス替えを決定したので、今年度の値は凍結しています。直すのは「準備中」の年度です。</span>' :
      '<span class="note">過去の年度は見るだけです</span>';
    h += '</div><div class="layout">' + (R.scope === 'school' ? schoolTable() : table(Y, edit)) + pane() + '</div>';
    h += '<div class="legend">' + C.ATTRS.map(function (at) { return '<span class="c">' + App.mark(at, 1) + at.label + '</span>'; }).join('') +
      '<span>＋＝程度2　＋＋＝程度3　点線の数字＝その年度の事案の件数</span></div>';
    App.$('main').innerHTML = h;
  }

  function table(Y, edit) {
    var d = D(), esc = App.esc;
    var rows = Y.rows.filter(function (r) { return R.scope === 'grade' || r.cls === R.cls; }).map(function (r) {
      return { r: r, n: incsOf(r.id, R.fy).length };
    });
    if (R.onlyInc) rows = rows.filter(function (x) { return x.n > 0; });
    rows.sort(function (a, b) { return (R.byCount ? b.n - a.n : 0) || a.r.cls - b.r.cls || a.r.no - b.r.no; });
    var h = '<div class="tw"><table class="r ' + (edit ? '' : 'ro') + '"><thead><tr>' + (R.scope === 'grade' ? '<th>組</th>' : '') + '<th>番号</th><th style="text-align:left">名前</th>' +
      C.ATTRS.map(function (at) { return '<th title="' + at.label + '">' + App.mark(at, 1) + '</th>'; }).join('') + '<th>事案</th></tr></thead><tbody>';
    rows.forEach(function (x) {
      var r = x.r, s = d.kids[r.id];
      h += '<tr class="' + (r.id === R.kid ? 'on' : '') + '">' + (R.scope === 'grade' ? '<td><span class="band" style="background:' + App.classColor(r.cls).c + '"></span>' + (r.cls + 1) + '</td>' : '') +
        '<td>' + r.no + '</td><td class="nm" data-kid="' + r.id + '"><span class="sx">' + (s.male ? '男' : '女') + '</span>' + esc(s.name) + '</td>' +
        C.ATTRS.map(function (at) { var v = r.a[at.k] | 0; return '<td class="cell" data-cell="' + r.id + '" data-k="' + at.k + '">' + (v ? App.mark(at, v) : '') + '</td>'; }).join('') +
        '<td class="ji" data-kid="' + r.id + '">' + (x.n ? '<span class="jn">' + x.n + '</span>' : '') + '</td></tr>';
    });
    if (!rows.length) h += '<tr><td colspan="12" class="empty">該当する児童はいません</td></tr>';
    return h + '</tbody></table></div>';
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

  function pane() {
    var d = D(), esc = App.esc;
    if (!R.kid || !d.kids[R.kid]) return '<aside class="pane"><div class="empty">児童の名前を押すと、<br>経年の記録と事案が出ます</div></aside>';
    var s = d.kids[R.kid];
    var h = '<aside class="pane"><h2>' + esc(s.name) + ' <span class="id">' + s.id + '・' + (s.male ? '男' : '女') + '</span></h2>' +
      '<section><h3>経年の記録</h3><table class="h"><thead><tr><th>年度</th><th>学年-組-番</th>' +
      C.ATTRS.map(function (at) { return '<th>' + App.mark(at, 1) + '</th>'; }).join('') + '<th>事案</th></tr></thead><tbody>';
    d.years.slice().sort(function (a, b) { return a.fy - b.fy; }).forEach(function (y) {
      var r = y.rows.filter(function (x) { return x.id === R.kid; })[0];
      if (!r) return;
      var n = incsOf(R.kid, y.fy).length;
      h += '<tr class="' + (y.fy === R.fy ? 'cur' : '') + '"><td>' + String(y.fy).slice(2) + (y.fy > d.fy ? '準' : '') + '</td><td><span class="band" style="background:' + App.classColor(r.cls).c + '"></span>' + y.grade + '-' + (r.cls + 1) + '-' + r.no + '</td>' +
        C.ATTRS.map(function (at) { return '<td>' + ((r.a[at.k] | 0) || '') + '</td>'; }).join('') + '<td>' + (n || '') + '</td></tr>';
    });
    h += '</tbody></table><div class="note">項目の数字は程度（空欄＝なし）。「準」は決定後の準備中の年度。</div></section>';
    var list = incsOf(R.kid).sort(function (a, b) { return b.date < a.date ? -1 : 1; });
    h += '<section><h3>事案（全' + list.length + '件）' + (R.form ? '' : '<button class="btn primary" id="addInc">＋事案を登録</button>') + '</h3>';
    if (R.form) h += form();
    h += '<div class="inc">' + (list.map(function (x) {
      var others = x.ids.filter(function (id) { return id !== R.kid; }).map(function (id) { return d.kids[id] ? d.kids[id].name : id; });
      var y = d.years.filter(function (yy) { return yy.fy === C.fiscalYearOfIso(x.date); })[0];
      return '<div class="it"><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title || '（名前なし）') + ' ↗</a><span class="meta">' + x.date + '・' + esc(x.type) +
        (y ? '・' + y.grade + '年の時' : '') + (others.length ? '・関係：' + others.map(esc).join('、') : '') + '</span></div>';
    }).join('') || '<div class="note">事案はありません</div>') + '</div></section></aside>';
    return h;
  }

  function form() {
    var f = R.form, d = D(), esc = App.esc;
    var today = new Date(), iso = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
    f.date = f.date || iso;
    return '<form class="form" id="incForm">' +
      '<label>文書のURL<input id="fUrl" value="' + esc(f.url || '') + '" placeholder="docs.google.com/… を貼る" required></label>' +
      '<label>文書の名前' + (f.titleMsg ? '（' + f.titleMsg + '）' : '') + '<input id="fTitle" value="' + esc(f.title || '') + '" placeholder="URLを貼ると自動で入ります"></label>' +
      '<label>関係する児童</label><div class="picked">' + f.ids.map(function (id) { return '<span>' + esc(d.kids[id].name) + '<button type="button" data-unpick="' + id + '" aria-label="外す">×</button></span>'; }).join('') + '</div>' +
      '<input id="fQ" value="" placeholder="名前・よみ・番号で追加" autocomplete="off"><div id="fSugg"></div>' +
      '<div class="row"><label>日付<input id="fDate" type="date" value="' + f.date + '"></label><label>種別<select id="fType">' +
      C.INCIDENT_TYPES.map(function (t) { return '<option' + (t === f.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="note">文書の名前に児童の氏名を入れないでください（一覧は全教員が見られます）</div>' +
      '<div class="row"><button type="button" class="btn" id="cancelInc">やめる</button><button class="btn primary">登録する</button></div></form>';
  }

  // 候補だけを描き直す（入力欄を作り直すと日本語入力の変換が切れるため）
  function suggHtml(q) {
    var d = D(), f = R.form, esc = App.esc;
    q = (q || '').trim();
    if (!q) return '';
    var items = yearOf(d.fy).rows.filter(function (r) {
      var s = d.kids[r.id];
      return f.ids.indexOf(r.id) < 0 && (s.name.indexOf(q) >= 0 || s.kana.indexOf(q) >= 0 || r.id.indexOf(q) === 0 || String(r.no) === q);
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
        r.a[k] = ((r.a[k] | 0) + 1) % (C.MAX_LEVEL + 1);
        var v = r.a[k], fy = R.fy, grade = Y.grade, at = C.ATTRS.filter(function (a) { return a.k === k; })[0];
        x.innerHTML = v ? App.mark(at, v) : ''; // そのマスだけ書き換える（表を作り直さない）
        if (R.kid === r.id) render();
        App.save(function () { return App.pf().setAttr(fy, grade, r.id, k, v); });
        return true;
      }
      if ((x = t.closest('[data-kid]'))) { R.kid = x.dataset.kid; R.form = null; render(); return true; }
      if (t.closest('#paste')) { pasteDialog(); return true; }
      if (t.closest('#addInc')) { R.form = { ids: [R.kid] }; render(); refocus('fUrl'); return true; }
      if (t.closest('#cancelInc')) { R.form = null; render(); return true; }
      if ((x = t.closest('[data-pick]'))) { R.form.ids.push(x.dataset.pick); render(); refocus('fQ'); return true; }
      if ((x = t.closest('[data-unpick]'))) { R.form.ids = R.form.ids.filter(function (id) { return id !== x.dataset.unpick; }); render(); return true; }
      return false;
    },
    input: function (t) {
      if (!R.form) return;
      if (t.id === 'fQ') { App.$('fSugg').innerHTML = suggHtml(t.value); }
      else if (t.id === 'fTitle') R.form.title = t.value;
      else if (t.id === 'fDate') R.form.date = t.value;
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
      else if (t.id === 'onlyInc') { R.onlyInc = t.checked; render(); }
      else if (t.id === 'byCount') { R.byCount = t.checked; render(); }
    },
    submit: function (f) {
      if (f.id !== 'incForm') return;
      var x = R.form;
      if (!x.ids.length) { App.toast('関係する児童を1人以上選んでください'); return; }
      App.save(function () {
        return App.pf().addIncident({ url: x.url, title: x.title || '', date: x.date, type: x.type || C.INCIDENT_TYPES[0], ids: x.ids });
      }).then(function (inc) { D().incidents.push(inc); R.form = null; render(); App.toast('事案を登録しました'); });
    },
    key: function (e) {
      if (e.key === 'Escape' && (R.form || R.kid)) { if (R.form) R.form = null; else R.kid = null; render(); return true; }
      return false;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

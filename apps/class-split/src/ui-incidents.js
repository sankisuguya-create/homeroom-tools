// 事案管理：学年の事案の一覧・登録と直す・様式Ⅱ用の追記・市教委への報告書（簡易報告書・様式Ⅰ・様式Ⅱ）の出力。
// 記録は「発覚・経緯・指導」の欄に、行ごとに［日付・時間帯・本文］で書く。報告書の時系列の欄は、この行から作る。
(function (g) {
  'use strict';
  var App = g.App, C = g.CONFIG, E = g.Engine, Rp = g.Report;
  // sel：選んだ事案の id。mode：'view' | 'form'（登録・直す） | 'add2'（様式Ⅱ用の追記）
  var I = { sel: null, mode: 'view', form: null };

  function D() { return App.st.data; }
  function esc(s) { return App.esc(s); }
  function yearOf(fy) { return D().years.filter(function (y) { return y.fy === fy; })[0]; }
  function incOf(id) { return D().incidents.filter(function (x) { return x.id === id; })[0]; }
  function kidName(id) { var s = D().kids[id]; return s ? s.name : id; }
  function today() { var t = new Date(); return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); }
  function isBully(type) { return /いじめ/.test(String(type || '')); }
  function titleOf(x) { return x.title || (x.type + 'の事案'); }
  function refocus(id) { var el = App.$(id); if (el) { el.focus(); if (el.setSelectionRange && el.type !== 'date') { var n = el.value.length; el.setSelectionRange(n, n); } } }

  // その事案の日の学年・組（その年度の名簿から。無ければ今年度）
  function kidAt(id, iso) {
    var d = D(), s = d.kids[id]; if (!s) return null;
    var fy = C.fiscalYearOfIso(iso || today()), y = yearOf(fy) || yearOf(d.fy), r = y && y.rows.filter(function (x) { return x.id === id; })[0];
    if (!r) { y = yearOf(d.fy); r = y && y.rows.filter(function (x) { return x.id === id; })[0]; }
    return { grade: y ? y.grade : '', cls: r ? r.cls + 1 : '', male: s.male, name: s.name, kana: s.kana };
  }
  function victimsOf(x) {
    var v = x.ids.filter(function (id) { var r = x.roles && x.roles[id]; return r === 'victim' || r === 'mutual'; });
    return v.length ? v : x.ids.slice();
  }
  function harmsOf(x, victim) {
    // 矢印が1本も無い（加害・被害が決まっていない）時は、被害の児童以外を加害の側として並べる
    var anyRole = x.ids.some(function (id) { var r = x.roles && x.roles[id]; return r === 'harm' || r === 'victim' || r === 'mutual'; });
    return x.ids.filter(function (id) {
      if (id === victim) return false;
      var r = x.roles && x.roles[id];
      return anyRole ? r === 'harm' || r === 'mutual' : true;
    });
  }

  // ===== 描く =====
  function render() {
    var d = D(), list = d.incidents.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id; });
    var h = '<div class="ibar"><button class="btn primary" id="iadd">＋ 事案を登録</button><span class="note">' + d.grade + '年の児童が関わる事案（全' + list.length + '件）</span></div><div class="iwrap"><div class="ilist">';
    var lastFy = null;
    list.forEach(function (x) {
      var fy = C.fiscalYearOfIso(x.date);
      if (fy !== lastFy) { h += '<div class="ify">' + fy + '年度</div>'; lastFy = fy; }
      var rp = x.report, badges = [];
      if (rp && isBully(x.type)) badges.push(rp.light ? '簡易' : '様式Ⅰ');
      if (rp && (rp.s2.sd.length || rp.s2.vi.length || rp.s2.ha.length || rp.s2.kikan)) badges.push('追記');
      h += '<button class="iit' + (I.sel === x.id ? ' on' : '') + '" data-isel="' + x.id + '"><span class="d">' + esc(App.span(x)) + '・' + esc(x.type) + '</span><b>' + esc(titleOf(x)) + '</b>' +
        '<span class="k">' + x.ids.map(function (id) { var r = x.roles && x.roles[id]; return esc(kidName(id)) + (r ? '<em class="r-' + r + '">' + E.ROLE_NAMES[r] + '</em>' : ''); }).join('、') + '</span>' +
        (badges.length ? '<span class="bd">' + badges.map(function (b) { return '<i>' + b + '</i>'; }).join('') + '</span>' : '') + '</button>';
    });
    if (!list.length) h += '<div class="empty">事案はありません</div>';
    h += '</div><div class="ipane" id="ipane">' + pane() + '</div></div>';
    App.$('main').innerHTML = h;
    mountDg();
  }
  function pane() {
    if (I.mode === 'form') return formHtml();
    var x = I.sel != null && incOf(I.sel);
    if (!x) return '<div class="empty">左の一覧から事案を選ぶか、「＋ 事案を登録」を押します</div>';
    if (I.mode === 'add2') return add2Html(x);
    return viewHtml(x);
  }
  function rowsView(rows) {
    if (!rows.length) return '<div class="note">（記入なし）</div>';
    return '<table class="irv">' + rows.map(function (r) { return '<tr><th>' + esc([Rp.md(r.d), r.p].filter(Boolean).join(' ')) + '</th><td>' + esc(r.t) + '</td></tr>'; }).join('') + '</table>';
  }
  function viewHtml(x) {
    var rp = x.report || Rp.emptyReport(), b = isBully(x.type);
    var h = '<h2>' + esc(titleOf(x)) + '</h2><div class="meta">' + esc(App.span(x)) + '・' + esc(x.type) + (x.url ? '・<a href="' + esc(x.url) + '" target="_blank" rel="noopener">文書 ↗</a>' : '') + '</div>' +
      '<div class="iacts"><button class="btn" id="iedit">直す</button><button class="btn" id="iadd2">その後の経緯を追記（様式Ⅱ用）</button><span class="sp"></span>' +
      (b ? '<button class="btn primary" data-iout="' + (rp.light ? 'light' : 'f1') + '">' + (rp.light ? '簡易報告書' : '様式Ⅰ') + 'を出力…</button><button class="btn" data-iout="f2">様式Ⅱを出力…</button>' : '') + '</div>' +
      '<section><h3>関係する児童</h3><div class="note">' + x.ids.map(function (id) { var r = x.roles && x.roles[id]; return esc(kidName(id)) + (r ? '（' + E.ROLE_NAMES[r] + '）' : ''); }).join('、') + '</div></section>';
    if (b) h += '<section><h3>報告書の項目</h3><table class="irv"><tr><th>報告</th><td>' + (rp.light ? '軽微な事案（簡易報告書）' : '様式Ⅰ') + '</td></tr><tr><th>発見のきっかけ</th><td>' + esc(rp.found || '（未選択）') + '</td></tr><tr><th>態様</th><td>' +
      (C.MODES.filter(function (m, i) { return rp.modes[i]; }).map(function (m) { return esc(m.t); }).join('<br>') || '（未選択）') + (rp.modes[C.MODES.length - 1] && rp.other ? '：' + esc(rp.other) : '') + '</td></tr></table></section>';
    ['hk', 'kk', 'sd'].forEach(function (k) { h += '<section><h3>' + Rp.SECTIONS[k] + '</h3>' + rowsView(rp.s1[k]) + '</section>'; });
    var s2 = rp.s2;
    if (s2.sd.length || s2.vi.length || s2.ha.length || s2.kikan) {
      h += '<h3 class="i2h">その後の経緯（様式Ⅱ）</h3>';
      ['sd', 'vi', 'ha'].forEach(function (k) { h += '<section><h3>' + Rp.SECTIONS2[k] + '</h3>' + rowsView(s2[k]) + '</section>'; });
      h += '<section><h3>関係機関との連携</h3><div>' + (esc(s2.kikan) || '<span class="note">（記入なし）</span>') + '</div></section>';
    }
    if (x.detail) h += '<section><h3>詳細（以前の記録）</h3><div class="dt">' + esc(x.detail) + '</div></section>';
    return h;
  }

  // 記録の行：左に日付と時間帯、右に本文
  function rowsEdit(sec, key, rows) {
    return '<div class="irows">' + rows.map(function (r, i) {
      var at = sec + ':' + key + ':' + i;
      return '<div class="irow"><div class="itime"><input type="date" data-rw="' + at + ':d" value="' + esc(r.d) + '" aria-label="日付"><select data-rw="' + at + ':p" aria-label="時間帯"><option value="">時間帯</option>' +
        C.TIME_SLOTS.map(function (p) { return '<option' + (p === r.p ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + (r.p && C.TIME_SLOTS.indexOf(r.p) < 0 ? '<option selected>' + esc(r.p) + '</option>' : '') + '</select></div>' +
        '<textarea data-rw="' + at + ':t" id="rw-' + sec + '-' + key + '-' + i + '" rows="2" maxlength="2000" placeholder="見たこと・聞いたこと・したことを事実で">' + esc(r.t) + '</textarea>' +
        '<button type="button" class="btn ix" data-rdel="' + sec + ':' + key + ':' + i + '" aria-label="この行を消す">×</button></div>';
    }).join('') + '<button type="button" class="btn" data-radd="' + sec + ':' + key + '">＋ 行を足す</button></div>';
  }
  function formHtml() {
    var f = I.form, rp = f.rep, b = isBully(f.type);
    var h = '<form class="form iform" id="incForm"><h2>' + (f.edit ? '事案を直す' : '事案を登録') + '</h2>' +
      '<div class="row"><label>期間（始まり＝認知した日）<input id="fDate" type="date" value="' + f.date + '"></label><label>終わり（その日だけなら空のまま）<input id="fDateEnd" type="date" min="' + f.date + '" value="' + (f.dateEnd || '') + '"></label>' +
      '<label>種別<select id="fType">' + C.INCIDENT_TYPES.map(function (t) { return '<option' + (t === f.type ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label></div>' +
      '<label>関係する児童と関係図（矢印＝加害）</label><input id="fQ" value="" placeholder="名前・よみ・番号で児童を足す" autocomplete="off"><div id="fSugg"></div><div id="fDg" class="dg"></div>';
    if (b) {
      h += '<fieldset class="irep"><legend>報告書の項目（いじめ）</legend>' +
        '<label class="chk"><input type="checkbox" id="fLight"' + (rp.light ? ' checked' : '') + '> 軽微な事案（簡易報告書で報告する）</label>' +
        '<label>発見のきっかけ<select id="fFound"><option value="">選ぶ</option>' + C.FOUND_LIST.map(function (t) { return '<option' + (t === rp.found ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
        '<div class="lab">いじめの態様（複数選べます）</div><div class="imodes">' + C.MODES.map(function (m, i) { return '<label class="chk"><input type="checkbox" data-mode="' + i + '"' + (rp.modes[i] ? ' checked' : '') + '> ' + esc(m.t) + '</label>'; }).join('') + '</div>' +
        '<label>その他の内容<input id="fOther" value="' + esc(rp.other) + '" maxlength="200"' + (rp.modes[C.MODES.length - 1] ? '' : ' disabled') + '></label></fieldset>';
    }
    ['hk', 'kk', 'sd'].forEach(function (k) { h += '<h3>' + Rp.SECTIONS[k] + '</h3>' + rowsEdit('s1', k, rp.s1[k]); });
    h += '<details class="iopt"><summary>文書のURL（任意）</summary><label>文書のURL<input id="fUrl" value="' + esc(f.url || '') + '" placeholder="docs.google.com/… を貼る"></label>' +
      '<label>題名（空なら「種別の事案」）<input id="fTitle" value="' + esc(f.title || '') + '" maxlength="80" placeholder="児童の氏名は入れない"></label></details>' +
      (f.detail ? '<label>詳細（以前の記録）<textarea id="fDetail" rows="4" maxlength="5000">' + esc(f.detail) + '</textarea></label>' : '') +
      '<div class="note">保護者から開示を求められることがある記録です。事実を書き、推測や人柄の評価は書きません。卒業・転出から' + C.INCIDENT_KEEP_YEARS + '年度は残ります。題名に児童の氏名を入れないでください（一覧は全教員が見られます）。</div>' +
      '<div class="row"><button type="button" class="btn" id="cancelInc">やめる</button><button class="btn primary">' + (f.edit ? '直す' : '登録する') + '</button></div></form>';
    return h;
  }
  function add2Html(x) {
    var f = I.form, s2 = f.rep.s2;
    var h = '<form class="form iform" id="inc2Form"><h2>その後の経緯を追記（様式Ⅱ用）</h2><div class="meta">' + esc(titleOf(x)) + '・' + esc(App.span(x)) + '</div>';
    ['sd', 'vi', 'ha'].forEach(function (k) { h += '<h3>' + Rp.SECTIONS2[k] + '</h3>' + rowsEdit('s2', k, s2[k]); });
    h += '<label>関係機関との連携<input id="fKikan" value="' + esc(s2.kikan) + '" maxlength="2000" placeholder="例：少年サポートセンターにつなぎ、招致指導を受けた"></label>' +
      '<div class="row"><button type="button" class="btn" id="cancelInc">やめる</button><button class="btn primary">保存する</button></div></form>';
    return h;
  }
  function mountDg() {
    var el = App.$('fDg');
    if (el && I.form && I.form.dg) App.Diagram.mount(el, I.form.dg, function (st) { I.form.dg = st; });
  }
  function rerenderPane() { var p = App.$('ipane'); if (p) { p.innerHTML = pane(); mountDg(); } }

  function suggHtml(q) {
    var d = D(), f = I.form;
    q = (q || '').trim();
    if (!q) return '';
    var items = yearOf(d.fy).rows.filter(function (r) {
      var s = d.kids[r.id];
      return !f.dg.d.nodes.some(function (n) { return n.id === r.id; }) && (s.name.indexOf(q) >= 0 || s.kana.indexOf(q) >= 0 || r.id.indexOf(q) === 0 || String(r.no) === q);
    }).slice(0, 8);
    return items.length ? '<div class="sugg">' + items.map(function (r) { return '<button type="button" data-pick="' + r.id + '">' + (r.cls + 1) + '組' + r.no + '番 ' + esc(d.kids[r.id].name) + '</button>'; }).join('') + '</div>' : '<div class="note">見つかりません</div>';
  }

  // ===== 始める =====
  function newForm(kid) {
    var st = App.Diagram.state(null);
    if (kid) App.Diagram.add(st, kid);
    var rp = Rp.emptyReport(), d0 = today();
    ['hk', 'kk', 'sd'].forEach(function (k) { rp.s1[k].push({ d: d0, p: '', t: '' }); });
    I.form = { dg: st, date: d0, dateEnd: '', type: C.INCIDENT_TYPES[0], url: '', title: '', detail: '', rep: rp };
    I.mode = 'form';
  }
  function editForm(x) {
    var st = App.Diagram.state(x.diagram);
    if (!x.diagram) x.ids.forEach(function (id) { App.Diagram.add(st, id); }); // 関係図の無い古い事案は、関係する児童を並べて始める
    I.form = { edit: x.id, dg: st, date: x.date, dateEnd: x.dateEnd || '', type: x.type, url: x.url || '', title: x.title || '', detail: x.detail || '', rep: Rp.norm(x.report) };
    ['hk', 'kk', 'sd'].forEach(function (k) { if (!I.form.rep.s1[k].length) I.form.rep.s1[k].push({ d: x.date, p: '', t: '' }); });
    I.mode = 'form'; I.sel = x.id;
  }
  function add2Form(x) {
    I.form = { edit: x.id, rep: Rp.norm(x.report), x: x };
    var last = x.date;
    ['sd', 'vi', 'ha'].forEach(function (k) { if (!I.form.rep.s2[k].length) I.form.rep.s2[k].push({ d: today(), p: '', t: '' }); });
    I.mode = 'add2'; I.sel = x.id; void last;
  }
  function rowsAt(path) { var p = path.split(':'); return I.form.rep[p[0]][p[1]]; }

  function body(x, f) {
    var dg = f.dg ? f.dg.d : x.diagram;
    return { url: f.url != null ? f.url : x.url, title: f.title != null ? f.title : x.title, date: f.date || x.date, dateEnd: f.dateEnd != null ? f.dateEnd : x.dateEnd || '', detail: f.detail != null ? f.detail : x.detail || '',
      type: f.type || x.type, ids: dg ? dg.nodes.map(function (n) { return n.id; }) : x.ids, diagram: dg, report: f.rep };
  }
  function saved(inc, msg) {
    var list = D().incidents, i = list.map(function (y) { return y.id; }).indexOf(inc.id);
    if (i >= 0) list[i] = inc; else list.push(inc);
    I.sel = inc.id; I.mode = 'view'; I.form = null; render(); App.toast(msg);
  }

  // ===== 出力 =====
  var LABELS = null;
  function labels() {
    if (LABELS) return LABELS;
    var R = C.REPORT, H = R.head, L = {};
    L[H.school] = '学校名'; L[H.era] = '認知年月日：令和（年）'; L[H.month] = '認知年月日：月'; L[H.day] = '認知年月日：日'; L[H.wday] = '認知年月日：曜日';
    var row = function (r, who) { L['B' + r] = who + '：学年'; L['D' + r] = who + '：組'; L['G' + r] = who + '：性別'; L['I' + r] = who + '：ふりがな'; L['I' + (r + 1)] = who + '：名前'; };
    row(H.victim, '被害');
    R.harmRows.forEach(function (r, i) { row(r, '加害' + (i + 1)); });
    L[R.harmMore] = '加害：その他の人数'; L[R.found] = '発見のきっかけ'; L[R.modeOther] = '態様：その他の内容';
    C.MODES.forEach(function (m) { L[m.cell] = '態様：' + m.t; });
    L[R.f1.gaiyou] = 'いじめの概要（時系列）';
    L[R.f2.shido] = '指導の経過'; L[R.f2.victim] = '被害児童生徒及び保護者の現在の状況'; L[R.f2.harm] = '加害児童生徒及び保護者の現在の状況'; L[R.f2.kikan] = '関係機関との連携';
    return (LABELS = L);
  }
  function outDialog(x, kind) {
    var vs = victimsOf(x), st = { victim: vs[0] };
    var cellsOf = function () {
      return Rp.cells(kind, x, { school: (App.settings && App.settings.school) || '', kid: function (id) { return kidAt(id, x.date); }, victim: st.victim, harms: harmsOf(x, st.victim) });
    };
    App.openDlg({
      noEnter: true,
      html: function () {
        var cells = cellsOf(), L = labels(), refs = C.REPORT && Rp.allowedCells(kind).filter(function (r) { return cells[r] !== undefined; });
        var harms = harmsOf(x, st.victim);
        return '<div class="pop" data-close="1"><div class="dlg iout" role="dialog" aria-modal="true" aria-label="報告書を出力"><h2>' + C.REPORT.names[kind] + 'を出力</h2>' +
          (vs.length > 1 ? '<div class="rbar"><span class="lab">被害の児童</span>' + vs.map(function (id) { return '<button class="lv" data-ivic="' + id + '" aria-pressed="' + (id === st.victim) + '">' + esc(kidName(id)) + '</button>'; }).join('') + '</div><p class="note">様式は被害の児童1人ごとに作ります。</p>' : '') +
          (kind !== 'f2' ? '<p class="note">加害の児童（関係図から）：' + (harms.map(function (id) { return esc(kidName(id)); }).join('、') || 'なし') + (harms.length > C.REPORT.harmRows.length ? '。' + (C.REPORT.harmRows.length + 1) + '人目からは人数だけを書きます' : '') + '</p>' : '') +
          '<div class="acts" style="justify-content:flex-start"><button class="btn primary" id="ixls">Excel を作る（様式のファイルに書き込む）</button><span class="note">' + (App.settings && App.settings.template ? '' : '様式のファイルが設定されていません（設定の「事案と報告書」）') + '</span></div>' +
          '<h3>コピー用（Excel が作れない時）</h3><table class="icopy"><thead><tr><th>欄</th><th>セル</th><th>書く値</th><th></th></tr></thead><tbody>' +
          refs.map(function (r) { return '<tr><td>' + esc(L[r] || r) + '</td><td>' + r + '</td><td><pre>' + esc(String(cells[r])) + '</pre></td><td><button class="btn" data-icopy="' + r + '">コピー</button></td></tr>'; }).join('') +
          (refs.length ? '' : '<tr><td colspan="4" class="note">書く値がありません</td></tr>') + '</tbody></table>' +
          '<div class="acts"><button class="btn" data-act="close">閉じる<kbd>Esc</kbd></button></div></div></div>';
      },
      click: function (t) {
        var b;
        if ((b = t.closest('[data-ivic]'))) { st.victim = b.dataset.ivic; App.refreshDlg(); return true; }
        if ((b = t.closest('[data-icopy]'))) { copyText(String(cellsOf()[b.dataset.icopy])); return true; }
        if (t.closest('#ixls')) {
          App.save(function () { return App.pf().exportReport(kind, cellsOf()); }).then(function (r) { download(r.name, r.b64); App.toast(r.name + ' を作りました'); });
          return true;
        }
        return false;
      }
    });
  }
  // 窓の中から書き込み許可の要らない方法でコピーする（GAS の画面は iframe の中なので clipboard API が使えないことがある）
  function copyText(s) {
    var ta = document.createElement('textarea');
    ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    App.toast(ok ? 'コピーしました' : 'コピーできませんでした。値を選んでコピーしてください');
  }
  function download(name, b64) {
    var bin = atob(b64), buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  App.screens.incidents = {
    enter: function () {
      I.mode = 'view'; I.form = null;
      var f = App.st.incFocus; App.st.incFocus = null;
      if (f && f.edit != null && incOf(f.edit)) editForm(incOf(f.edit));
      else if (f && f.sel != null && incOf(f.sel)) I.sel = f.sel;
      else if (f && f.add) newForm(f.kid || null);
      else if (I.sel != null && !incOf(I.sel)) I.sel = null;
      render();
    },
    click: function (t) {
      var x;
      if (t.closest('#iadd')) { newForm(null); render(); refocus('fQ'); return true; }
      if ((x = t.closest('[data-isel]'))) { if (I.mode !== 'view' && !confirmLeave()) return true; I.sel = +x.dataset.isel; I.mode = 'view'; I.form = null; render(); return true; }
      if (t.closest('#iedit')) { editForm(incOf(I.sel)); rerenderPane(); return true; }
      if (t.closest('#iadd2')) { add2Form(incOf(I.sel)); rerenderPane(); return true; }
      if ((x = t.closest('[data-iout]'))) { outDialog(incOf(I.sel), x.dataset.iout); return true; }
      if (t.closest('#cancelInc')) { I.mode = 'view'; I.form = null; if (I.sel != null && !incOf(I.sel)) I.sel = null; rerenderPane(); return true; }
      if ((x = t.closest('[data-pick]'))) { App.Diagram.add(I.form.dg, x.dataset.pick); App.$('fQ').value = ''; App.$('fSugg').innerHTML = ''; mountDg(); refocus('fQ'); return true; }
      if ((x = t.closest('[data-radd]'))) {
        var rows = rowsAt(x.dataset.radd), prev = rows[rows.length - 1];
        rows.push({ d: prev ? prev.d : (I.form.date || today()), p: '', t: '' });
        rerenderPane(); var p = x.dataset.radd.split(':'); refocus('rw-' + p[0] + '-' + p[1] + '-' + (rows.length - 1)); return true;
      }
      if ((x = t.closest('[data-rdel]'))) { var q = x.dataset.rdel.split(':'); I.form.rep[q[0]][q[1]].splice(+q[2], 1); rerenderPane(); return true; }
      return false;
    },
    input: function (t) {
      var f = I.form; if (!f) return;
      if (t.dataset.rw) { var q = t.dataset.rw.split(':'), r = f.rep[q[0]][q[1]][+q[2]]; if (r) r[q[3]] = t.value; return; }
      if (t.dataset.mode != null) { f.rep.modes[+t.dataset.mode] = t.checked; var o = App.$('fOther'); if (o) o.disabled = !f.rep.modes[C.MODES.length - 1]; return; }
      switch (t.id) {
        case 'fQ': App.$('fSugg').innerHTML = suggHtml(t.value); break;
        case 'fDate': f.date = t.value; var fe = App.$('fDateEnd'); if (fe) fe.min = t.value; break;
        case 'fDateEnd': f.dateEnd = t.value; break;
        case 'fType': var was = isBully(f.type); f.type = t.value; if (was !== isBully(f.type)) rerenderPane(); break;
        case 'fUrl': f.url = t.value.trim(); break;
        case 'fTitle': f.title = t.value; break;
        case 'fDetail': f.detail = t.value; break;
        case 'fLight': f.rep.light = t.checked; break;
        case 'fFound': f.rep.found = t.value; break;
        case 'fOther': f.rep.other = t.value; break;
        case 'fKikan': f.rep.s2.kikan = t.value; break;
      }
    },
    submit: function (form) {
      var f = I.form; if (!f) return;
      if (form.id === 'inc2Form') {
        var x2 = incOf(f.edit);
        App.save(function () { return App.pf().updateIncident(x2.id, body(x2, { rep: f.rep })); }).then(function (inc) { saved(inc, 'その後の経緯を保存しました'); });
        return;
      }
      if (form.id !== 'incForm') return;
      var dg = f.dg.d;
      if (!dg.nodes.length) { App.toast('関係する児童を1人以上足してください'); return; }
      if (f.dateEnd && f.dateEnd < f.date) { App.toast('終わりの日は始まりの日より後にしてください'); return; }
      var x = f.edit != null ? incOf(f.edit) : {};
      var b = body(x, f);
      App.save(function () { return f.edit != null ? App.pf().updateIncident(f.edit, b) : App.pf().addIncident(b); }).then(function (inc) { saved(inc, f.edit != null ? '事案を直しました' : '事案を登録しました'); });
    },
    key: function (e) {
      if (e.key === 'Escape' && I.mode !== 'view') { I.mode = 'view'; I.form = null; rerenderPane(); return true; }
      return false;
    }
  };
  function confirmLeave() { return window.confirm('入力中の内容は保存されません。移りますか'); }
})(typeof globalThis !== 'undefined' ? globalThis : this);

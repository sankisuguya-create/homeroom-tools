// 事案管理：学年の事案の一覧・登録と直す・様式Ⅱ用の追記・市教委への報告書（簡易報告書・様式Ⅰ・様式Ⅱ）の出力。
// 記録は「発覚・経緯・指導」の欄に、行ごとに［日付・時間帯・本文］で書く。報告書の時系列の欄は、この行から作る。
(function (g) {
  'use strict';
  var App = g.App, C = g.CONFIG, E = g.Engine, Rp = g.Report;
  // sel：選んだ事案の id。mode：'view' | 'form'（登録・直す） | 'add2'（様式Ⅱ用の追記）
  var I = { sel: null, mode: 'view', form: null, focus: null };
  // 左の一覧と右の記入補助は畳める（この端末に覚える）
  var FOLD = (function () { try { return JSON.parse(localStorage.getItem('classSplit.incFold') || '{}'); } catch (e) { return {}; } })();
  function saveFold() { try { localStorage.setItem('classSplit.incFold', JSON.stringify(FOLD)); } catch (e) { /* 覚えられなくても今は効く */ } }

  // 画面のアイコン（線の絵。色は文字の色を使う）
  var SVG = function (body) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>'; };
  var IC = {
    // 枠と左（右）の帯。矢印は畳む向き
    listClose: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M16 9l-3 3 3 3"/>'),
    listOpen: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M13 9l3 3-3 3"/>'),
    asClose: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/><path d="M8 9l3 3-3 3"/>'),
    asOpen: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/><path d="M11 9l-3 3 3 3"/>'),
    plus: SVG('<path d="M12 5v14M5 12h14"/>'),
    trash: SVG('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
    edit: SVG('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/>'),
    addNote: SVG('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M12.5 11v6M9.5 14h6"/>'),
    file: SVG('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 13h7M9 17h5"/>'),
    help: SVG('<path d="M4 6h10M4 10h7M4 14h6"/><path d="M14 20l1-4 6-6-3-3-6 6-1 4z"/>')
  };
  function D() { return App.st.data; }
  function esc(s) { return App.esc(s); }
  function yearOf(fy) { return D().years.filter(function (y) { return y.fy === fy; })[0]; }
  function incOf(id) { return D().incidents.filter(function (x) { return x.id === id; })[0]; }
  function kidName(id) { var s = D().kids[id]; return s ? s.name : id; }
  function today() { var t = new Date(); return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); }
  // 種別は複数選べる（「いじめ・物損」のように「・」でつないで持つ）
  function typesOf(type) { return String(type || '').split('・').filter(Boolean); }
  function isBully(type) { return typesOf(type).indexOf('いじめ') >= 0 || /いじめ/.test(String(type || '')); }
  function onlyDamage(type) { var t = typesOf(type); return t.length === 1 && t[0] === '物損'; }
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
    var h = '<div class="iwrap' + (FOLD.list ? ' lc' : '') + (FOLD.assist ? ' ac' : '') + '"><div class="ilist">';
    if (FOLD.list) h += '<button class="ifold" id="ilistT" title="事案の一覧を開く" aria-label="事案の一覧を開く">' + IC.listOpen + '</button><button class="ivlab" id="ilistT2" tabindex="-1">事案の一覧</button>';
    else {
      h += '<div class="ihead"><button class="btn primary ib" id="iadd">' + IC.plus + '事案を登録</button><button class="ifold" id="ilistT" title="事案の一覧を畳む" aria-label="事案の一覧を畳む">' + IC.listClose + '</button></div><div class="note">' + d.grade + '年の児童が関わる事案（' + list.length + '件）</div>';
      var lastFy = null;
      list.forEach(function (x) {
        var fy = C.fiscalYearOfIso(x.date);
        if (fy !== lastFy) { h += '<div class="ify">' + fy + '年度</div>'; lastFy = fy; }
        var rp = x.report, more = rp && (rp.s2.sd.length || rp.s2.vi.length || rp.s2.ha.length || rp.s2.kikan);
        h += '<button class="iit' + (I.sel === x.id ? ' on' : '') + '" data-isel="' + x.id + '"><span class="d">' + esc(App.span(x)) + '・' + esc(x.type) + '</span><b>' + esc(titleOf(x)) + '</b>' +
          '<span class="k">' + x.ids.map(function (id) { var r = x.roles && x.roles[id]; return esc(kidName(id)) + (r ? '<em class="r-' + r + '">' + E.ROLE_NAMES[r] + '</em>' : ''); }).join('、') + '</span>' +
          (more ? '<span class="bd"><i>追記あり</i></span>' : '') + '</button>';
      });
      if (!list.length) h += '<div class="empty">事案はありません</div>';
    }
    h += '</div><div class="ipane" id="ipane">' + pane() + '</div><aside class="iassist" id="iassist">' + assistHtml() + '</aside></div>';
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
    return '<table class="irv">' + rows.map(function (r) { return '<tr><th>' + esc(Rp.md(r.d) + (r.p || '')) + '</th><td>' + esc(r.t) + '</td></tr>'; }).join('') + '</table>';
  }
  function viewHtml(x) {
    var rp = x.report || Rp.emptyReport(), b = isBully(x.type);
    var h = '<h2>' + esc(titleOf(x)) + '</h2><div class="meta">' + esc(App.span(x)) + '・' + esc(x.type) + (x.url ? '・<a href="' + esc(x.url) + '" target="_blank" rel="noopener">文書 ↗</a>' : '') + '</div>' +
      '<div class="iacts"><button class="btn ib" id="iedit">' + IC.edit + '直す</button><button class="btn ib" id="iadd2">' + IC.addNote + 'その後の経緯を追記（様式Ⅱ用）</button><span class="sp"></span><span class="lab">出力</span>' +
      '<button class="btn ib" data-iout="light">' + IC.file + '簡易報告書</button><button class="btn ib" data-iout="f1">' + IC.file + '様式Ⅰ</button><button class="btn ib" data-iout="f2">' + IC.file + '様式Ⅱ</button></div>';
    h += x.diagram && x.diagram.nodes.length ? '<section><h3>関係図</h3><div id="vDg" class="dg ro"></div></section>' :
      '<section><h3>関係する児童</h3><div>' + x.ids.map(function (id) { var r = x.roles && x.roles[id]; return esc(kidName(id)) + (r ? '（' + E.ROLE_NAMES[r] + '）' : ''); }).join('、') + '</div></section>';
    if (b) h += '<section><h3>いじめの項目</h3><table class="irv"><tr><th>発見のきっかけ</th><td>' + esc(rp.found || '（未選択）') + '</td></tr><tr><th>態様</th><td>' +
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

  // 記録の行：日付・時間帯・本文を横に並べる
  function rowsEdit(sec, key, rows) {
    return '<div class="irows">' + rows.map(function (r, i) {
      var at = sec + ':' + key + ':' + i;
      return '<div class="irow" data-phs="' + sec + ':' + key + '"><input type="date" data-rw="' + at + ':d" value="' + esc(r.d) + '" aria-label="日付"><select data-rw="' + at + ':p" aria-label="時間帯"><option value="">時間帯</option>' +
        C.TIME_SLOTS.map(function (p) { return '<option' + (p === r.p ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + (r.p && C.TIME_SLOTS.indexOf(r.p) < 0 ? '<option selected>' + esc(r.p) + '</option>' : '') + '</select>' +
        '<textarea data-rw="' + at + ':t" id="rw-' + sec + '-' + key + '-' + i + '" rows="2" maxlength="2000" placeholder="右の記入補助から選ぶか、事実を書く">' + esc(r.t) + '</textarea>' +
        '<button type="button" class="ix" data-rdel="' + at + '" title="この行を消す" aria-label="この行を消す">' + IC.trash + '</button></div>';
    }).join('') + '<button type="button" class="btn ib iaddrow" data-radd="' + sec + ':' + key + '">' + IC.plus + '行を足す</button></div>';
  }
  function formHtml() {
    var f = I.form, rp = f.rep, b = isBully(f.type), ts = typesOf(f.type);
    var h = '<form class="form iform" id="incForm"><h2>' + (f.edit ? '事案を直す' : '事案を登録') + '</h2>' +
      '<div class="lab">事案の種別（複数選べます）</div><div class="itypes">' + C.INCIDENT_TYPES.map(function (t) { return '<button type="button" class="lv" data-ty="' + esc(t) + '" aria-pressed="' + (ts.indexOf(t) >= 0) + '">' + esc(t) + '</button>'; }).join('') + '</div>' +
      '<label>関係する児童' + (onlyDamage(f.type) ? '' : 'と関係図（矢印＝加害）') + '</label><input id="fQ" value="" placeholder="名前・よみ・番号で児童を足す" autocomplete="off"><div id="fSugg"></div>';
    if (onlyDamage(f.type)) h += '<div class="ikids">' + f.dg.d.nodes.map(function (n) { return '<span class="chip">' + esc(kidName(n.id)) + '<button type="button" data-kdel="' + n.id + '" aria-label="外す">×</button></span>'; }).join('') + '</div>';
    else h += '<div id="fDg" class="dg"></div>';
    if (b) {
      h += '<fieldset class="irep"><legend>いじめの項目</legend>' +
        '<label>発見のきっかけ<select id="fFound"><option value="">選ぶ</option>' + C.FOUND_LIST.map(function (t) { return '<option' + (t === rp.found ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
        '<div class="lab">いじめの態様（複数選べます）</div><div class="imodes">' + C.MODES.map(function (m, i) { return '<label class="chk"><input type="checkbox" data-mode="' + i + '"' + (rp.modes[i] ? ' checked' : '') + '> ' + esc(m.t) + '</label>'; }).join('') + '</div>' +
        '<label>その他の内容<input id="fOther" value="' + esc(rp.other) + '" maxlength="200"' + (rp.modes[C.MODES.length - 1] ? '' : ' disabled') + '></label></fieldset>';
    }
    ['hk', 'kk', 'sd'].forEach(function (k) { h += '<h3>' + Rp.SECTIONS[k] + '</h3>' + rowsEdit('s1', k, rp.s1[k]); });
    h += '<details class="iopt"><summary>文書のURL・題名（任意）</summary><label>文書のURL<input id="fUrl" value="' + esc(f.url || '') + '" placeholder="docs.google.com/… を貼る"></label>' +
      '<label>題名（空なら「種別の事案」）<input id="fTitle" value="' + esc(f.title || '') + '" maxlength="80" placeholder="児童の氏名は入れない"></label></details>' +
      (f.detail ? '<label>詳細（以前の記録）<textarea id="fDetail" rows="4" maxlength="5000">' + esc(f.detail) + '</textarea></label>' : '') +
      '<div class="note">事実を書き、推測や人柄の評価は書きません（保護者から開示を求められることがある記録です）。期間は記録の行の日付から決まります。</div>' +
      '<div class="row"><button type="button" class="btn" id="cancelInc">やめる</button><button class="btn primary">' + (f.edit ? '直す' : '登録する') + '</button></div></form>';
    return h;
  }
  function add2Html(x) {
    var f = I.form, s2 = f.rep.s2;
    var h = '<form class="form iform" id="inc2Form"><h2>その後の経緯を追記（様式Ⅱ用）</h2><div class="meta">' + esc(titleOf(x)) + '・' + esc(App.span(x)) + '</div>';
    ['sd', 'vi', 'ha'].forEach(function (k) { h += '<h3>' + Rp.SECTIONS2[k] + '</h3>' + rowsEdit('s2', k, s2[k]); });
    h += '<h3>関係機関との連携</h3><input id="fKikan" class="ikikan" data-phs="kikan" value="' + esc(s2.kikan) + '" maxlength="2000" placeholder="右の記入補助から選ぶか、書く">' +
      '<div class="row"><button type="button" class="btn" id="cancelInc">やめる</button><button class="btn primary">保存する</button></div></form>';
    return h;
  }
  function mountDg() {
    var el = App.$('fDg');
    if (el && I.form && I.form.dg) App.Diagram.mount(el, I.form.dg, function (st) { I.form.dg = st; });
    var v = App.$('vDg'), x = I.sel != null && incOf(I.sel);
    // 見るだけ（動かす操作は CSS で止める。「カードで表示」だけ選べる。選び直すと描き直すので、そのたびに切り出す）
    if (v && x && x.diagram) { App.Diagram.mount(v, App.Diagram.state(x.diagram), function (st) { cropDg(v, st.d); }); cropDg(v, x.diagram); }
  }
  // 見る画面の関係図は、児童のいる範囲だけを切り出す（白い余白を出さない）
  function cropDg(el, d) {
    var cv = el.querySelector('.dg-canvas'); if (!cv || !d.nodes.length) return;
    var W = E.DG_W, H = E.DG_H, xs = d.nodes.map(function (n) { return n.x; }), ys = d.nodes.map(function (n) { return n.y; });
    var x0 = Math.max(0, Math.min.apply(null, xs) - 120), x1 = Math.min(W, Math.max.apply(null, xs) + 120);
    var y0 = Math.max(0, Math.min.apply(null, ys) - 45), y1 = Math.min(H, Math.max.apply(null, ys) + 45);
    var cw = cv.getBoundingClientRect().width, k = cw / W;
    var box = document.createElement('div');
    box.className = 'dg-crop';
    box.style.width = Math.round((x1 - x0) * k) + 'px'; box.style.height = Math.round((y1 - y0) * k) + 'px';
    cv.parentNode.insertBefore(box, cv); box.appendChild(cv);
    cv.style.width = Math.round(cw) + 'px'; cv.style.marginLeft = -Math.round(x0 * k) + 'px'; cv.style.marginTop = -Math.round(y0 * k) + 'px';
  }
  function rerenderPane() { var p = App.$('ipane'); if (p) { p.innerHTML = pane(); mountDg(); } renderAssist(); }

  // ===== 記入補助（右）：選んでいる欄に合う定型文と、関係する児童の名前。押すか、ドラッグして入れる =====
  var ASSIST_NAMES = { 's1:hk': '発覚', 's1:kk': '経緯', 's1:sd': '指導', 's2:sd': '指導の経過', 's2:vi': '被害児童・保護者の様子', 's2:ha': '加害児童・保護者の様子', kikan: '関係機関との連携' };
  function phraseKey(where) { return where === 'kikan' ? 'kikan' : where === 's2:sd' ? 's2sd' : where.split(':')[1]; }
  function assistHtml() {
    if (FOLD.assist) return '<button class="ifold" id="iasT" title="記入補助を開く" aria-label="記入補助を開く">' + IC.asOpen + '</button><button class="ivlab" id="iasT2" tabindex="-1">記入補助</button>';
    var h = '<div class="ihead"><b class="ib">' + IC.help + '記入補助</b><button class="ifold" id="iasT" title="記入補助を畳む" aria-label="記入補助を畳む">' + IC.asClose + '</button></div>';
    var where = I.form && I.focus ? I.focus.split(':').slice(0, 2).join(':') : null;
    if (I.form && I.focus === 'kikan') where = 'kikan';
    if (!I.form || !where || !ASSIST_NAMES[where]) return h + '<p class="note">入力欄を押すと、その欄に合う文がここに出ます。押すか、入力欄へドラッグして入れます。</p>';
    var names = formKids(), ph = C.PHRASES[phraseKey(where)] || [];
    h += '<div class="iaw">' + ASSIST_NAMES[where] + '</div>';
    if (names.length && where !== 'kikan') h += '<div class="lab">児童の名前</div><div class="iph">' + names.map(function (n) { return '<button type="button" class="nm" draggable="true" data-ph="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') + '</div>';
    h += '<div class="lab">定型文</div><div class="iph col">' + ph.map(function (t) { return '<button type="button" draggable="true" data-ph="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>';
    return h;
  }
  function renderAssist() { var a = App.$('iassist'); if (a) a.innerHTML = assistHtml(); }
  function formKids() {
    var f = I.form; if (!f) return [];
    var ids = f.dg ? f.dg.d.nodes.map(function (n) { return n.id; }) : (f.x ? f.x.ids : []);
    return ids.map(kidName);
  }
  // 入れる：選んでいる行のカーソルの所へ。文の途中でなく末尾なら、句点で終わっていない時は「。」を挟む（名前の後ろは挟まない）
  function putPhrase(text) {
    var f = I.form; if (!f || !I.focus) return;
    if (I.focus === 'kikan') {
      var k = App.$('fKikan'), cur = f.rep.s2.kikan;
      f.rep.s2.kikan = cur ? cur.replace(/[、。\s]*$/, '') + '、' + text : text;
      if (k) { k.value = f.rep.s2.kikan; refocus('fKikan'); }
      return;
    }
    var q = I.focus.split(':'), r = f.rep[q[0]][q[1]][+q[2]];
    if (!r) return;
    var el = App.$('rw-' + q[0] + '-' + q[1] + '-' + q[2]), pos = el ? el.selectionStart : r.t.length, end = el ? el.selectionEnd : r.t.length;
    var before = r.t.slice(0, pos), after = r.t.slice(end), isName = formKids().indexOf(text) >= 0;
    var lastName = formKids().some(function (n) { return before.slice(-n.length) === n; });
    var glue = !before || isName || lastName || /[。、\s]$/.test(before) || after ? '' : '。';
    r.t = before + glue + text + after; pos = (before + glue + text).length;
    if (el) { el.value = r.t; el.focus(); el.setSelectionRange(pos, pos); }
  }
  // 最後に触った入力欄を覚え、記入補助を描き直す
  document.addEventListener('focusin', function (e) {
    if (App.st.screen !== 'incidents' || !I.form) return;
    var t = e.target, was = I.focus;
    if (t && t.tagName === 'TEXTAREA' && t.dataset && t.dataset.rw) { var q = t.dataset.rw.split(':'); I.focus = q[0] + ':' + q[1] + ':' + q[2]; }
    else if (t && t.id === 'fKikan') I.focus = 'kikan';
    else return;
    if (!was || was.split(':').slice(0, 2).join() !== I.focus.split(':').slice(0, 2).join()) renderAssist();
  });
  document.addEventListener('dragstart', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.iassist [data-ph]');
    if (b) { e.dataTransfer.setData('text/plain', b.dataset.ph); e.dataTransfer.effectAllowed = 'copy'; }
  });
  // 入力欄に落とした時：落とした欄の末尾に、押した時と同じ規則で入れる（文の途中に割り込ませない）
  document.addEventListener('dragover', function (e) { if (e.target && e.target.closest && e.target.closest('textarea[data-rw],#fKikan')) e.preventDefault(); });
  document.addEventListener('drop', function (e) {
    var t = e.target && e.target.closest && e.target.closest('textarea[data-rw],#fKikan');
    if (!t || App.st.screen !== 'incidents' || !I.form) return;
    var text = e.dataTransfer.getData('text/plain'); if (!text) return;
    e.preventDefault();
    t.focus(); if (t.setSelectionRange) t.setSelectionRange(t.value.length, t.value.length);
    putPhrase(text);
  });
  function rowsAt(path) { var p = path.split(':'); return I.form.rep[p[0]][p[1]]; }

  // 期間は記録の行（発覚・経緯・指導）の日付の最初と最後から決める
  function spanOf(rep, fallback) {
    var ds = [].concat(rep.s1.hk, rep.s1.kk, rep.s1.sd).map(function (r) { return r.d; }).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); }).sort();
    if (!ds.length) return { date: fallback || today(), dateEnd: '' };
    return { date: ds[0], dateEnd: ds[ds.length - 1] === ds[0] ? '' : ds[ds.length - 1] };
  }
  function body(x, f) {
    var dg = f.dg ? f.dg.d : x.diagram, sp = f.dg ? spanOf(f.rep, x.date) : { date: x.date, dateEnd: x.dateEnd || '' };
    return { url: f.url != null ? f.url : x.url, title: f.title != null ? f.title : x.title, date: sp.date, dateEnd: sp.dateEnd, detail: f.detail != null ? f.detail : x.detail || '',
      type: f.type || x.type, ids: dg ? dg.nodes.map(function (n) { return n.id; }) : x.ids, diagram: f.dg && onlyDamage(f.type) ? null : dg, report: f.rep };
  }
  function saved(inc, msg) {
    var list = D().incidents, i = list.map(function (y) { return y.id; }).indexOf(inc.id);
    if (i >= 0) list[i] = inc; else list.push(inc);
    I.sel = inc.id; I.mode = 'view'; I.form = null; I.focus = null; render(); App.toast(msg);
  }

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
    I.form = { dg: st, type: '', url: '', title: '', detail: '', rep: rp };
    I.mode = 'form'; I.focus = null;
  }
  function editForm(x) {
    var st = App.Diagram.state(x.diagram);
    if (!x.diagram) x.ids.forEach(function (id) { App.Diagram.add(st, id); }); // 関係図の無い古い事案は、関係する児童を並べて始める
    I.form = { edit: x.id, dg: st, type: x.type, url: x.url || '', title: x.title || '', detail: x.detail || '', rep: Rp.norm(x.report) };
    ['hk', 'kk', 'sd'].forEach(function (k) { if (!I.form.rep.s1[k].length) I.form.rep.s1[k].push({ d: x.date, p: '', t: '' }); });
    I.mode = 'form'; I.sel = x.id; I.focus = null;
  }
  function add2Form(x) {
    I.form = { edit: x.id, rep: Rp.norm(x.report), x: x };
    ['sd', 'vi', 'ha'].forEach(function (k) { if (!I.form.rep.s2[k].length) I.form.rep.s2[k].push({ d: today(), p: '', t: '' }); });
    I.mode = 'add2'; I.sel = x.id; I.focus = null;
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
    var vs = victimsOf(x), st = { victim: vs[0], made: null };
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
          '<div class="acts" style="justify-content:flex-start"><button class="btn primary" id="ixls">Excel を作る（様式を複製して書き込む）</button><span class="note">' + (App.settings && App.settings.template ? '元の様式は変えず、同じフォルダに複製を作ります' : '様式のファイルが設定されていません（設定の「事案と報告書」）') + '</span></div>' +
          (st.made ? '<div class="notebox">作りました：<a href="' + esc(st.made.url) + '" target="_blank" rel="noopener">' + esc(st.made.name) + ' ↗</a></div>' : '') +
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
          App.save(function () { return App.pf().exportReport(kind, cellsOf(), x.id); }).then(function (r) { st.made = r; App.refreshDlg(); });
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
  App.screens.incidents = {
    enter: function () {
      I.mode = 'view'; I.form = null; I.focus = null;
      var f = App.st.incFocus; App.st.incFocus = null;
      if (f && f.edit != null && incOf(f.edit)) editForm(incOf(f.edit));
      else if (f && f.sel != null && incOf(f.sel)) I.sel = f.sel;
      else if (f && f.add) newForm(f.kid || null);
      else if (I.sel != null && !incOf(I.sel)) I.sel = null;
      render();
    },
    click: function (t) {
      var x;
      if (t.closest('#ilistT,#ilistT2')) { FOLD.list = !FOLD.list; saveFold(); render(); return true; }
      if (t.closest('#iasT,#iasT2')) { FOLD.assist = !FOLD.assist; saveFold(); renderAssist(); App.$('iassist').parentNode.classList.toggle('ac', !!FOLD.assist); return true; }
      if ((x = t.closest('.iassist [data-ph]'))) { putPhrase(x.dataset.ph); return true; }
      if (t.closest('#iadd')) { if (I.mode !== 'view' && !confirmLeave()) return true; newForm(null); render(); refocus('fQ'); return true; }
      if ((x = t.closest('[data-isel]'))) { if (I.mode !== 'view' && !confirmLeave()) return true; I.sel = +x.dataset.isel; I.mode = 'view'; I.form = null; I.focus = null; render(); return true; }
      if (t.closest('#iedit')) { editForm(incOf(I.sel)); rerenderPane(); return true; }
      if (t.closest('#iadd2')) { add2Form(incOf(I.sel)); rerenderPane(); return true; }
      if ((x = t.closest('[data-iout]'))) { outDialog(incOf(I.sel), x.dataset.iout); return true; }
      if (t.closest('#cancelInc')) { I.mode = 'view'; I.form = null; I.focus = null; if (I.sel != null && !incOf(I.sel)) I.sel = null; rerenderPane(); return true; }
      if ((x = t.closest('[data-ty]'))) {
        var ts = typesOf(I.form.type), ty = x.dataset.ty, i = ts.indexOf(ty);
        if (i >= 0) ts.splice(i, 1); else ts.push(ty);
        I.form.type = C.INCIDENT_TYPES.filter(function (t0) { return ts.indexOf(t0) >= 0; }).join('・');
        rerenderPane(); return true;
      }
      if ((x = t.closest('[data-kdel]'))) { I.form.dg.d.nodes = I.form.dg.d.nodes.filter(function (n) { return n.id !== x.dataset.kdel; }); rerenderPane(); return true; }
      if ((x = t.closest('[data-pick]'))) {
        App.Diagram.add(I.form.dg, x.dataset.pick); App.$('fQ').value = ''; App.$('fSugg').innerHTML = '';
        if (onlyDamage(I.form.type)) rerenderPane(); else mountDg();
        renderAssist(); refocus('fQ'); return true;
      }
      if ((x = t.closest('[data-radd]'))) {
        var rows = rowsAt(x.dataset.radd), prev = rows[rows.length - 1];
        rows.push({ d: prev ? prev.d : today(), p: prev ? prev.p : '', t: '' });
        rerenderPane(); var p = x.dataset.radd.split(':'); refocus('rw-' + p[0] + '-' + p[1] + '-' + (rows.length - 1)); return true;
      }
      if ((x = t.closest('[data-rdel]'))) { var q = x.dataset.rdel.split(':'); I.form.rep[q[0]][q[1]].splice(+q[2], 1); I.focus = null; rerenderPane(); return true; }
      return false;
    },
    input: function (t) {
      var f = I.form; if (!f) return;
      if (t.dataset.rw) { var q = t.dataset.rw.split(':'), r = f.rep[q[0]][q[1]][+q[2]]; if (r) r[q[3]] = t.value; return; }
      if (t.dataset.mode != null) { f.rep.modes[+t.dataset.mode] = t.checked; var o = App.$('fOther'); if (o) o.disabled = !f.rep.modes[C.MODES.length - 1]; return; }
      switch (t.id) {
        case 'fQ': App.$('fSugg').innerHTML = suggHtml(t.value); break;
        case 'fUrl': f.url = t.value.trim(); break;
        case 'fTitle': f.title = t.value; break;
        case 'fDetail': f.detail = t.value; break;
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
      if (!typesOf(f.type).length) { App.toast('事案の種別を選んでください'); return; }
      if (!f.dg.d.nodes.length) { App.toast('関係する児童を1人以上足してください'); return; }
      var x = f.edit != null ? incOf(f.edit) : {};
      var b = body(x, f);
      App.save(function () { return f.edit != null ? App.pf().updateIncident(f.edit, b) : App.pf().addIncident(b); }).then(function (inc) { saved(inc, f.edit != null ? '事案を直しました' : '事案を登録しました'); });
    },
    key: function (e) {
      if (e.key === 'Escape' && I.mode !== 'view') { I.mode = 'view'; I.form = null; I.focus = null; rerenderPane(); return true; }
      return false;
    }
  };
  function confirmLeave() { return window.confirm('入力中の内容は保存されません。移りますか'); }
})(typeof globalThis !== 'undefined' ? globalThis : this);

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
    down2: SVG('<path d="M7 6l5 5 5-5"/><path d="M7 13l5 5 5-5"/>'),
    help: SVG('<path d="M4 6h10M4 10h7M4 14h6"/><path d="M14 20l1-4 6-6-3-3-6 6-1 4z"/>')
  };
  function D() { return App.st.data; }
  function esc(s) { return App.esc(s); }
  function yearOf(fy) { return D().years.filter(function (y) { return y.fy === fy; })[0]; }
  function incOf(id) { return D().incidents.filter(function (x) { return x.id === id; })[0] || (ALLINC || []).filter(function (x) { return x.id === id; })[0]; }
  function kidName(id) { if (E.isUnknown(id)) return '（不明の児童）'; var s = D().kids[id]; return s ? s.name : id; }
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
    // ほかの学年の児童は、全校の今年度の名簿から
    if (!r && d.xk && d.xk[id]) return { grade: d.xk[id].grade, cls: d.xk[id].cls + 1, male: s.male, name: s.name, kana: s.kana };
    return { grade: y ? y.grade : '', cls: r ? r.cls + 1 : '', male: s.male, name: s.name, kana: s.kana };
  }
  // 全校の今年度の名簿を1回だけ読み、ほかの学年の児童の名前と学年・組を足す（ほかの学年を検索する時・ほかの学年の児童が関わる事案を見る時）
  var SCHOOL = null;
  function loadSchool() {
    if (SCHOOL) return Promise.resolve(SCHOOL);
    return App.pf().schoolKids().then(function (list) { SCHOOL = list; mergeSchool(); return list; });
  }
  function mergeSchool() {
    var d = D(); if (!SCHOOL || !d) return;
    d.xk = d.xk || {};
    SCHOOL.forEach(function (k) { if (!d.kids[k.id]) d.kids[k.id] = { id: k.id, name: k.name, kana: k.kana, male: k.male }; d.xk[k.id] = { grade: k.grade, cls: k.cls, a: k.a || {} }; });
  }
  // 全校の事案（事案の一覧で、ほかの学年を選んだ時だけ読む）
  var ALLINC = null;
  function loadAllInc() {
    if (ALLINC) return Promise.resolve(ALLINC);
    return Promise.all([App.pf().allIncidents(), loadSchool()]).then(function (r) { ALLINC = r[0]; return ALLINC; });
  }
  // 事案の一覧で探す学年（この端末に覚える。空＝この学年だけ）
  var HOME = (function () { try { return JSON.parse(localStorage.getItem('classSplit.incHome') || '{}'); } catch (e) { return {}; } })();
  function homeGrades() { return HOME.grades && HOME.grades.length ? HOME.grades : [D().grade]; }
  function homeOthers() { return homeGrades().some(function (g0) { return g0 !== D().grade; }); }
  function homeList() {
    var gs = homeGrades(), src = D().incidents;
    if (homeOthers() && ALLINC) {
      var seen = {}; src = src.concat(ALLINC).filter(function (x) { if (seen[x.id]) return false; seen[x.id] = 1; return true; });
    }
    // 学年は今年度の学年で見る（この学年の事案は D().incidents に入っている。ほかは全校の名簿の学年）
    var own = {}; D().incidents.forEach(function (x) { own[x.id] = 1; });
    var xk = D().xk || {};
    var ty = HOME.types || [], lv = HOME.levels || [], st = HOME.status || [];
    return src.filter(function (x) {
      if (!(own[x.id] && gs.indexOf(D().grade) >= 0) && !x.ids.some(function (id) { return xk[id] && gs.indexOf(xk[id].grade) >= 0; })) return false;
      var ts = typesOf(x.type), rp = x.report || Rp.emptyReport();
      if (ty.length && !ts.some(function (t) { return ty.indexOf(t) >= 0; })) return false;
      if (lv.length && !(isBully(x.type) && lv.indexOf(levelOf(x)) >= 0)) return false; // 段階を選ぶと、いじめの事案だけに絞る
      if (st.length && st.indexOf(rp.status || 'open') < 0) return false;
      return true;
    }).sort(SORTS.filter(function (s0) { return s0.k === (HOME.sort || 'new'); })[0].f);
  }
  // 並び替え。同じ順位は新しい順
  var byNew = function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id; };
  var ST_RANK = { open: 0, watch: 1, done: 2, closed: 3 }, LV_RANK = { grave: 0, f2: 1, f1: 2, light: 3 };
  function lastRec(x) { var rp = x.report || Rp.emptyReport(), ds = [].concat(rp.s1.hk, rp.s1.kk, rp.s1.sd, rp.s2.sd || []).map(function (r) { return r.d; }).filter(Boolean).sort(); return ds.length ? ds[ds.length - 1] : x.date; }
  function weight(x) { return (isBully(x.type) ? LV_RANK[levelOf(x)] : 4); }
  var SORTS = [
    { k: 'new', label: '日付（新しい順）', f: byNew },
    { k: 'old', label: '日付（古い順）', f: function (a, b) { return -byNew(a, b); } },
    { k: 'imp', label: '重要度（対応中・いじめの段階が重い順）', f: function (a, b) { return (ST_RANK[(a.report || {}).status || 'open'] - ST_RANK[(b.report || {}).status || 'open']) || (weight(a) - weight(b)) || byNew(a, b); } },
    { k: 'stale', label: '記録が止まっている順（解消を除き、最後の記録が古い順）', f: function (a, b) { var ca = ((a.report || {}).status === 'closed'), cb = ((b.report || {}).status === 'closed'); return (ca - cb) || (lastRec(a) < lastRec(b) ? -1 : lastRec(a) > lastRec(b) ? 1 : 0) || byNew(a, b); } },
    { k: 'grade', label: '学年（低い順）', f: function (a, b) { return ((gradesOf(a)[0] || 9) - (gradesOf(b)[0] || 9)) || byNew(a, b); } }
  ];
  function saveHome() { try { localStorage.setItem('classSplit.incHome', JSON.stringify(HOME)); } catch (e) { /* 今は効く */ } }
  function homeFiltered() { return homeOthers() || (HOME.types || []).length || (HOME.levels || []).length || (HOME.status || []).length; }
  function refreshCards() {
    var cs = App.$('icards'); if (!cs) return;
    var q = (I.q || '').trim(), list = homeList(), shown = list.filter(function (x) { return matchQ(x, q); });
    cs.innerHTML = cardsHtml(shown);
    var n = App.$('inote'); if (n) n.textContent = homeNote(list, shown, q);
  }
  function homeNote(list, shown, q) {
    var gs = homeGrades(), lab = gs.length === 6 ? '全学年' : gs.join('・') + '年';
    var f = [].concat(HOME.types || [], (HOME.levels || []).map(function (k) { return 'いじめ・' + C.BULLY_LEVELS.filter(function (b) { return b.k === k; })[0].label; }), (HOME.status || []).map(function (k) { return C.STATUS.filter(function (s0) { return s0.k === k; })[0].label; }));
    lab += f.length ? '・' + f.join('／') : '';
    return (q ? '「' + q + '」に合う事案 ' + shown.length + '件（' + lab + '）' : lab + 'の事案 ' + list.length + '件') + (homeOthers() && !ALLINC ? '　読み込み中…' : '');
  }
  function homeDialog() {
    App.openDlg({
      html: function () {
        var gs = homeGrades();
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="事案の検索の設定" style="max-width:460px"><h2>事案の検索</h2>' +
          '<div class="lab">探す学年</div><div class="lvs"><button class="lv" data-hga="1" aria-pressed="' + (gs.length === 6) + '">全学年</button>' + [1, 2, 3, 4, 5, 6].map(function (g0) { return '<button class="lv" data-hg="' + g0 + '" aria-pressed="' + (gs.indexOf(g0) >= 0) + '">' + g0 + '年</button>'; }).join('') + '</div>' +
          '<p class="note">学年は、関わった児童の学年で選びます。ほかの学年を選ぶと、全校の事案を読み込みます。</p>' +
          '<div class="lab">種別（選ばなければすべて）</div><div class="lvs">' + C.INCIDENT_TYPES.map(function (t) { return '<button class="lv" data-hf="types:' + esc(t) + '" aria-pressed="' + ((HOME.types || []).indexOf(t) >= 0) + '">' + (TYPE_IC[t] || '') + esc(t) + '</button>'; }).join('') + '</div>' +
          '<div class="lab">いじめの段階（選ぶと、いじめの事案だけに絞る）</div><div class="lvs">' + C.BULLY_LEVELS.map(function (b) { return '<button class="lv" data-hf="levels:' + b.k + '" aria-pressed="' + ((HOME.levels || []).indexOf(b.k) >= 0) + '">' + esc(b.label) + '</button>'; }).join('') + '</div>' +
          '<div class="lab">対応の状況（選ばなければすべて）</div><div class="lvs">' + C.STATUS.map(function (s0) { return '<button class="lv" data-hf="status:' + s0.k + '" aria-pressed="' + ((HOME.status || []).indexOf(s0.k) >= 0) + '">' + ST_IC[s0.k] + esc(s0.label) + '</button>'; }).join('') + '</div>' +
          '<div class="acts"><button class="btn" data-hgr="1">' + D().grade + '年だけ・絞り込みなしに戻す</button><button class="btn primary" data-act="close">閉じる<kbd>Esc</kbd></button></div></div></div>';
      },
      click: function (t) {
        var b, gs = homeGrades().slice();
        if ((b = t.closest('[data-hg]'))) { var g0 = +b.dataset.hg, i = gs.indexOf(g0); if (i >= 0) { if (gs.length > 1) gs.splice(i, 1); } else gs.push(g0); }
        else if (t.closest('[data-hga]')) gs = gs.length === 6 ? [D().grade] : [1, 2, 3, 4, 5, 6];
        else if (t.closest('[data-hgr]')) { gs = [D().grade]; HOME.types = []; HOME.levels = []; HOME.status = []; }
        else if ((b = t.closest('[data-hf]'))) { var kv = b.dataset.hf.split(':'), arr = HOME[kv[0]] = (HOME[kv[0]] || []).slice(), j = arr.indexOf(kv[1]); if (j >= 0) arr.splice(j, 1); else arr.push(kv[1]); }
        else return false;
        HOME.grades = gs.sort(); saveHome();
        if (homeOthers()) loadAllInc().then(refreshCards, function (e) { App.toast && App.toast('全校の事案を読めませんでした：' + e.message); });
        App.refreshDlg(); refreshCards(); return true;
      }
    });
  }
  // 関係する児童の検索の設定（この端末に覚える）：探す学年（空＝この学年だけ）と、候補の書き方
  var SRCH = (function () { try { return JSON.parse(localStorage.getItem('classSplit.incSearch') || '{}'); } catch (e) { return {}; } })();
  function saveSrch() { try { localStorage.setItem('classSplit.incSearch', JSON.stringify(SRCH)); } catch (e) { /* 今は効く */ } }
  function srchGrades() { return SRCH.grades && SRCH.grades.length ? SRCH.grades : [D().grade]; }
  var FMTS = [['gc', '3-2 田中 ハト'], ['name', '田中 ハト（3年2組）'], ['kana', '田中 ハト（たなか はと）3-2']];
  function srchDialog() {
    App.openDlg({
      html: function () {
        var gs = srchGrades(), fmt = SRCH.fmt || 'gc';
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="検索の設定" style="max-width:460px"><h2>関係する児童の検索</h2>' +
          '<div class="lab">探す学年</div><div class="lvs">' + [1, 2, 3, 4, 5, 6].map(function (g0) { return '<button class="lv" data-sg="' + g0 + '" aria-pressed="' + (gs.indexOf(g0) >= 0) + '">' + g0 + '年</button>'; }).join('') + '</div>' +
          '<p class="note">ほかの学年を選ぶと、全校の今年度の名簿から探します。</p>' +
          '<div class="lab">候補の書き方</div><div class="ivic">' + FMTS.map(function (f) { return '<label class="chk"><input type="radio" name="sfmt" data-sf="' + f[0] + '"' + (fmt === f[0] ? ' checked' : '') + '> ' + esc(f[1]) + '</label>'; }).join('') + '</div>' +
          '<div class="acts"><button class="btn primary" data-act="close">閉じる<kbd>Esc</kbd></button></div></div></div>';
      },
      click: function (t) {
        var b;
        if ((b = t.closest('[data-sg]'))) {
          var g0 = +b.dataset.sg, gs = srchGrades().slice(), i = gs.indexOf(g0);
          if (i >= 0) { if (gs.length > 1) gs.splice(i, 1); } else gs.push(g0);
          SRCH.grades = gs.sort(); saveSrch(); if (gs.some(function (x) { return x !== D().grade; })) loadSchool();
          App.refreshDlg(); return true;
        }
        if ((b = t.closest('[data-sf]'))) { SRCH.fmt = b.dataset.sf; saveSrch(); return true; }
        return false;
      },
      onClose: function () { var q = App.$('fQ'); if (q) { App.$('fSugg').innerHTML = suggHtml(q.value); q.focus(); } }
    });
  }
  function victimsOf(x) {
    var v = x.ids.filter(function (id) { var r = x.roles && x.roles[id]; return r === 'victim' || r === 'mutual'; });
    return v.length ? v : x.ids.slice();
  }
  // 矢印で被害の側に決まった児童（2人以上なら、様式Ⅱの「被害児童・保護者の様子」と Excel を児童ごとに分ける）
  function realVictims(x) { return x.ids.filter(function (id) { var r = x.roles && x.roles[id]; return r === 'victim' || r === 'mutual'; }); }
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
  // 左（事案の一覧）と右（記入補助）は、作る・直す・追記の時だけ出す。一覧は事案の一覧の画面の検索設定（学年・言葉）に合わせる
  function sided() { return I.mode === 'form' || I.mode === 'add2'; }
  function sideList() {
    var q = (I.q || '').trim(), list = homeList().filter(function (x) { return matchQ(x, q); });
    return '<div class="ihead"><button class="ifold" id="ilistT" title="事案の一覧を畳む" aria-label="事案の一覧を畳む">' + IC.listClose + '</button></div>' +
      '<div class="note">' + esc(homeNote(homeList(), list, q)) + '</div><div class="icards one" id="icards">' + cardsHtml(list) + '</div>';
  }
  function render() {
    if (!sided()) { App.$('main').innerHTML = '<div class="iwrap solo"><div class="ipane" id="ipane">' + pane() + '</div></div>'; mountDg(); autosizeAll(); showExtra(); return; }
    var h = '<div class="iwrap' + (FOLD.list ? ' lc' : '') + (FOLD.assist ? ' ac' : '') + '"><div class="ilist">';
    if (FOLD.list) h += '<button class="ifold" id="ilistT" title="事案の一覧を開く" aria-label="事案の一覧を開く">' + IC.listOpen + '</button><button class="ivlab" id="ilistT2" tabindex="-1">事案の一覧</button>';
    else h += sideList();
    h += '</div><div class="ipane" id="ipane">' + pane() + '</div><aside class="iassist" id="iassist">' + assistHtml() + '</aside></div>';
    App.$('main').innerHTML = h;
    mountDg(); autosizeAll(); showExtra();
  }
  function pane() {
    if (I.mode === 'form') return formHtml();
    var dr = I.draft && I.draft.draft;
    var banner = dr ? '<div class="notebox idb">書きかけがあります（' + esc(dr.mode === 'add2' ? 'その後の経緯の追記' : dr.form.edit != null ? '事案を直す' : '新しい事案') + '・' + esc(String(I.draft.at || '').slice(5, 16).replace('T', ' ')) + '）' +
      '<button class="btn primary" id="idrGo">続きを書く</button><button class="btn" id="idrDel">捨てる</button></div>' : '';
    if (I.mode === 'add2') return add2Html(incOf(I.sel));
    return banner + paneView();
  }
  function paneView() {
    var x = I.sel != null && incOf(I.sel);
    if (!x) return homeHtml();
    return '<button class="btn ib iback" id="ihome">' + IC.listClose + '事案の一覧へ</button>' + viewHtml(x);
  }

  // ===== 初めの画面：新規作成と検索、その下に事案カード（新しい順） =====
  var TYPE_IC = {
    '対人': SVG('<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c0-3 2-5 5-5s5 2 5 5M11 20c0-3 2-5 5-5s5 2 5 5"/>'),
    '物損': SVG('<path d="M4 6h7l-2 5 3 2-1 5H4zM14 6h6v12h-7l1-4-3-2z"/>'),
    'いじめ': SVG('<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>'),
    'けが': SVG('<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="M11 11l2 2M13 11l-2 2"/>'),
    'その他': SVG('<circle cx="12" cy="12" r="8"/><path d="M8 12h.5M12 12h.5M16 12h.5"/>')
  };
  var ST_IC = {
    open: SVG('<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>'),
    done: SVG('<path d="M5 12l4 4 10-10"/>'),
    watch: SVG('<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>'),
    closed: SVG('<circle cx="12" cy="12" r="8"/><path d="M8 12l3 3 5-6"/>')
  };
  // いじめの報告の段階：決めていなければ、様式Ⅱ用の追記があれば様式Ⅱ、なければ様式Ⅰ
  function levelOf(x) {
    var rp = x.report || Rp.emptyReport();
    if (rp.level) return rp.level;
    return rp.s2.sd.length || rp.s2.vi.length || rp.s2.ha.length || Object.keys(rp.s2v || {}).length ? 'f2' : 'f1';
  }
  function gradesOf(x) {
    var gs = [];
    x.ids.forEach(function (id) { var k = kidAt(id, x.date); if (k && k.grade && gs.indexOf(k.grade) < 0) gs.push(k.grade); });
    return gs.sort();
  }
  function tagsHtml(x) {
    var rp = x.report || Rp.emptyReport(), h = '<div class="itags">';
    var gs = gradesOf(x); if (gs.length) h += '<span class="itg ig">' + gs.join('・') + '年</span>';
    typesOf(x.type).forEach(function (t) {
      if (t === 'いじめ') {
        var lv = C.BULLY_LEVELS.filter(function (b) { return b.k === levelOf(x); })[0];
        h += '<span class="itg ib2" style="background:' + lv.c + ';color:' + lv.t + ';border-color:' + lv.c + '">' + TYPE_IC['いじめ'] + 'いじめ・' + esc(lv.label) + '</span>';
      } else h += '<span class="itg">' + (TYPE_IC[t] || TYPE_IC['その他']) + esc(t) + '</span>';
    });
    var st = C.STATUS.filter(function (s0) { return s0.k === rp.status; })[0] || C.STATUS[0];
    h += '<span class="itg ist st-' + st.k + '">' + ST_IC[st.k] + esc(st.label) + '</span>';
    return h + '</div>';
  }
  function matchQ(x, q) {
    if (!q) return true;
    var rp = x.report || Rp.emptyReport(), txt = [x.type, x.title, x.detail].concat(x.ids.map(kidName));
    ['hk', 'kk', 'sd'].forEach(function (k) { rp.s1[k].forEach(function (r) { txt.push(r.t); }); });
    var all = txt.join(' ').replace(/[ 　]/g, '');
    return q.split(/[ 　]+/).filter(Boolean).every(function (w) { return all.indexOf(w) >= 0; });
  }
  function homeHtml() {
    var list = homeList();
    if (homeOthers() && !ALLINC) loadAllInc().then(refreshCards);
    var q = (I.q || '').trim(), shown = list.filter(function (x) { return matchQ(x, q); });
    var dflt = !homeFiltered();
    var h = '<div class="ihome"><button class="big ihb" id="iadd2nd">' + IC.plus + '<b>事案を新規作成</b></button>' +
      '<label class="big ihb ihs">' + SVG('<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>') + '<input id="iq" value="' + esc(I.q || '') + '" placeholder="事案を検索（名前・種別・内容）" autocomplete="off">' +
      '<button type="button" class="iqc' + (dflt ? '' : ' on') + '" id="ihset" title="検索の設定（学年・種別・いじめの段階・対応の状況）" aria-label="検索の設定"></button></label>' +
      '<label class="big ihb ihsort">' + SVG('<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>') + '<span>並び替え</span><select id="isort">' + SORTS.map(function (s0) { return '<option value="' + s0.k + '"' + ((HOME.sort || 'new') === s0.k ? ' selected' : '') + '>' + esc(s0.label) + '</option>'; }).join('') + '</select></label></div>';
    h += '<div class="note" id="inote">' + esc(homeNote(list, shown, q)) + '</div>';
    h += '<div class="icards" id="icards">' + cardsHtml(shown) + '</div>';
    return h;
  }
  // カードの役割は1字を名前の前に（加＝赤、被＝青、相互＝紫）
  var ROLE_CH = { harm: '加', victim: '被', mutual: '相' };
  function cardsHtml(list) {
    if (!list.length) return '<div class="empty">事案はありません</div>';
    return list.map(function (x) {
      var st0 = (x.report || {}).status || 'open';
      return '<button class="icard ic-' + st0 + '" data-isel="' + x.id + '"><div class="icm"><span class="d">' + esc(App.span(x)) + '</span><b>' + esc(titleOf(x)) + '</b>' +
        '<span class="k">' + x.ids.map(function (id) { var r = x.roles && x.roles[id], c = ROLE_CH[r]; return (c ? '<em class="rc r-' + r + '">' + c + '</em>' : '') + esc(kidName(id)); }).join('、') + '</span></div>' + tagsHtml(x) + '</button>';
    }).join('');
  }
  function rowsView(rows) {
    if (!rows.length) return '<div class="note">（記入なし）</div>';
    return '<table class="irv">' + rows.map(function (r) { return '<tr><th>' + esc(Rp.md(r.d) + (r.p || '')) + '</th><td>' + esc(r.t) + '</td></tr>'; }).join('') + '</table>';
  }
  function viewHtml(x) {
    var rp = x.report || Rp.emptyReport(), b = isBully(x.type);
    var h = '<h2>' + esc(titleOf(x)) + '</h2><div class="meta">' + esc(App.span(x)) + '・' + esc(x.type) + (x.url ? '・<a href="' + esc(x.url) + '" target="_blank" rel="noopener">文書 ↗</a>' : '') + '</div>' +
      '<div class="iacts"><button class="btn ib" id="iedit">' + IC.edit + '直す</button><button class="btn ib" id="iadd2">' + IC.addNote + 'その後の経緯を追記（様式Ⅱ用）</button><span class="sp"></span><span class="lab">出力</span>' +
      '<button class="btn ib" data-iout="light">' + IC.file + '簡易報告書</button><button class="btn ib" data-iout="f1">' + IC.file + '様式Ⅰ</button><button class="btn ib" data-iout="f2">' + IC.file + '様式Ⅱ</button></div>' +
      // 対応の状況と、いじめの報告の段階（押すとすぐ保存）
      '<div class="istat"><span class="lab">対応</span>' + C.STATUS.map(function (s0) { return '<button class="lv ib st-' + s0.k + '" data-ist="' + s0.k + '" aria-pressed="' + (rp.status === s0.k) + '">' + ST_IC[s0.k] + esc(s0.label) + '</button>'; }).join('') +
      (b ? '<span class="lab">報告</span>' + C.BULLY_LEVELS.map(function (lv) { return '<button class="lv" data-ilv="' + lv.k + '" aria-pressed="' + (levelOf(x) === lv.k) + '"' + (levelOf(x) === lv.k ? ' style="background:' + lv.c + ';color:' + lv.t + ';border-color:' + lv.c + '"' : '') + '>' + esc(lv.label) + '</button>'; }).join('') : '') + '</div>';
    h += x.diagram && x.diagram.nodes.length ? '<section><h3>関係図</h3><div id="vDg" class="dg ro"></div></section>' :
      '<section><h3>関係する児童</h3><div>' + x.ids.map(function (id) { var r = x.roles && x.roles[id]; return esc(kidName(id)) + (r ? '（' + E.ROLE_NAMES[r] + '）' : ''); }).join('、') + '</div></section>';
    if (b) h += '<section><h3>いじめの項目</h3><table class="irv"><tr><th>発見のきっかけ</th><td>' + esc(rp.found || '（未選択）') + '</td></tr><tr><th>態様</th><td>' +
      (C.MODES.filter(function (m, i) { return rp.modes[i]; }).map(function (m) { return esc(m.t); }).join('<br>') || '（未選択）') + (rp.modes[C.MODES.length - 1] && rp.other ? '：' + esc(rp.other) : '') + '</td></tr></table></section>';
    ['hk', 'kk', 'sd'].forEach(function (k) { h += '<section><h3>' + Rp.SECTIONS[k] + '</h3>' + rowsView(rp.s1[k]) + '</section>'; });
    var s2 = rp.s2;
    var vv = realVictims(x), byV = vv.length > 1;
    if (s2.sd.length || s2.vi.length || s2.ha.length || s2.kikan || Object.keys(rp.s2v).length) {
      h += '<h3 class="i2h">その後の経緯（様式Ⅱ）</h3>';
      ['sd', 'vi', 'ha'].forEach(function (k) {
        if (k === 'vi' && byV) { vv.forEach(function (id) { h += '<section><h3>被害児童・保護者の様子（' + esc(kidName(id)) + '）</h3>' + rowsView(rp.s2v[id] || []) + '</section>'; }); return; }
        h += '<section><h3>' + Rp.SECTIONS2[k] + '</h3>' + rowsView(s2[k]) + '</section>';
      });
      h += '<section><h3>関係機関との連携</h3><div>' + (esc(s2.kikan) || '<span class="note">（記入なし）</span>') + '</div></section>';
    }
    if (x.detail) h += '<section><h3>詳細（以前の記録）</h3><div class="dt">' + esc(x.detail) + '</div></section>';
    return h;
  }

  // 欄の見出しは「何を書く欄か」を問いで示す。欄ごとに色の帯を付け、右の記入補助の見出しも同じ色にする
  var ASK = { 's1:hk': 'だれが・どうやって知ったか', 's1:kk': 'だれが・だれに・何をしたか', 's1:sd': '学校がしたこと（聴き取り・指導・連絡）',
    's2:sd': 'その後に学校がしたこと', 's2:vi': '被害の児童と保護者の、今の様子', 's2:ha': '加害の児童と保護者の、今の様子' };
  var SEC_NAME = { 's1:hk': '発覚', 's1:kk': '経緯', 's1:sd': '指導', 's2:sd': '指導の経過', 's2:vi': '被害児童・保護者の様子', 's2:ha': '加害児童・保護者の様子' };
  function mdShort(iso) { var p = String(iso || '').split('-'); if (p.length !== 3) return '日付'; var w = '日月火水木金土'.charAt(new Date(+p[0], +p[1] - 1, +p[2]).getDay()); return (+p[1]) + '/' + (+p[2]) + '(' + w + ')'; }
  function secHtml(sec, key, rows) {
    var w = sec + ':' + key, isV = sec === 's2v';
    var h = '<div class="isec s-' + (isV ? 's2vi' : sec + key) + '" data-sec="' + w + '"><h3 class="ish"><b>' + (isV ? '被害児童・保護者の様子（' + esc(kidName(key)) + '）' : SEC_NAME[w]) + '</b><span>' + (isV ? 'この児童と保護者の、今の様子' : ASK[w]) + '</span></h3>';
    if (w === 's1:sd') h += stepsHtml(rows);
    h += '<div class="irows">' + rows.map(function (r, i) {
      var at = w + ':' + i;
      // 日付は「月/日」だけを見せ、押すと暦が開く（年は事案の記録では毎回見なくてよい）
      return '<div class="irow" data-row="' + at + '"><label class="idate" title="' + esc(Rp.md(r.d)) + '"><span>' + esc(mdShort(r.d)) + '</span><input type="date" data-rw="' + at + ':d" value="' + esc(r.d) + '" aria-label="日付"></label>' +
        '<select class="islot' + (r.p ? ' on' : '') + '" data-rw="' + at + ':p" aria-label="時間帯"><option value="">時間帯</option>' + Rp.slots().map(function (p) { return '<option' + (p === r.p ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') +
        (r.p && Rp.slots().indexOf(r.p) < 0 ? '<option selected>' + esc(r.p) + '</option>' : '') + '</select>' +
        '<textarea data-rw="' + at + ':t" id="rw-' + sec + '-' + key + '-' + i + '" rows="1" maxlength="2000" placeholder="' + (i ? 'Enter で次の行' : '下の文を押すか、書く') + '">' + esc(r.t) + '</textarea>' +
        '<button type="button" class="ix" data-rdel="' + at + '" title="この行を消す" aria-label="この行を消す">' + IC.trash + '</button>' +
        // 日付の下：翌日の行を足す。時間帯の下：同じ日の次の時間帯の行を足す
        '<button type="button" class="inx" data-rnext="' + at + ':day" title="翌日の行を足す" aria-label="翌日の行を足す">' + IC.down2 + '</button>' +
        '<button type="button" class="inx" data-rnext="' + at + ':slot" title="次の時間帯の行を足す" aria-label="次の時間帯の行を足す">' + IC.down2 + '</button>' +
        '<div class="irx" id="irx-' + sec + '-' + key + '-' + i + '"></div></div>';
    }).join('') + (rows.length ? '' : '<button type="button" class="btn ib iaddrow" data-radd="' + w + '">' + IC.plus + '行を足す</button>') + '</div></div>';
    return h;
  }
  // 指導の「よくある手順」：チェックで行を足す・外す
  function stepsHtml(rows) {
    var all = rows.map(function (r) { return r.t; }).join('\n');
    return '<div class="isteps">' + C.SD_STEPS.map(function (t, i) { return '<label class="chk"><input type="checkbox" data-step="' + i + '"' + (all.indexOf(t) >= 0 ? ' checked' : '') + '> ' + esc(t) + '</label>'; }).join('') + '</div>';
  }
  // 選んでいる行の下：時間帯のボタン列と、次によく書く文
  function extraHtml(at) {
    var q = at.split(':'), w = q[0] + ':' + q[1], r = I.form.rep[q[0]][q[1]][+q[2]]; if (!r) return '';
    var h = '';
    var sg = [];
    if (w === 's1:kk') leads().forEach(function (t) { sg.push({ t: t, nm: true }); });
    nextPhrases(w, 5).forEach(function (t) { sg.push({ t: t }); });
    if (sg.length) h += '<div class="iph isg">' + sg.map(function (x) { return '<button type="button" class="' + (x.nm ? 'nm' : '') + '" data-ph="' + esc(x.t) + '">' + esc(x.t) + '</button>'; }).join('') + '</div>';
    return h;
  }
  function showExtra() {
    Array.prototype.forEach.call(document.querySelectorAll('.irx'), function (el) { el.innerHTML = ''; });
    Array.prototype.forEach.call(document.querySelectorAll('.irow.cur'), function (el) { el.classList.remove('cur'); });
    if (!I.form || !I.focus || I.focus === 'kikan') return;
    var q = I.focus.split(':'), el = App.$('irx-' + q[0] + '-' + q[1] + '-' + q[2]);
    if (el) { el.innerHTML = extraHtml(I.focus); el.parentNode.classList.add('cur'); }
  }
  // その欄で使った定型文の、後に続く文から順に（使った文は出さない）
  function phrasesOf(w) { return C.PHRASES[phraseKey(w)] || []; }
  function usedIn(w) {
    if (w === 'kikan') return I.form.rep.s2.kikan;
    var q = w.split(':'); return I.form.rep[q[0]][q[1]].map(function (r) { return r.t; }).join('\n');
  }
  function nextPhrases(w, n) {
    // 指導の「よくある手順」はチェックで入れるので、行の下には出さない
    var ph = phrasesOf(w).filter(function (t) { return w !== 's1:sd' || C.SD_STEPS.indexOf(t) < 0; }), txt = usedIn(w), last = -1;
    ph.forEach(function (t, i) { if (txt.indexOf(t) >= 0) last = i; });
    var out = [];
    for (var k = 1; k <= ph.length && out.length < n; k++) { var t = ph[(last + k) % ph.length]; if (txt.indexOf(t) < 0) out.push(t); }
    return out;
  }
  // 関係図の矢印から「（加害の児童）が（被害の児童）」
  function leads() {
    var f = I.form; if (!f || !f.dg) return [];
    var d = f.dg.d, nameOf = function (end) {
      var p = end.split(':');
      if (p[0] === 'k') return kidName(p[1]);
      var gr = d.groups.filter(function (x) { return x.g === p[1]; })[0];
      return gr ? gr.members.map(kidName).join('・') : '';
    };
    // 助詞は続けて選ぶ文の側が持つ（「に悪口を言った」「を叩いた」）ので、ここでは「Aが B」まで
    return d.edges.map(function (e) { return nameOf(e.f) + 'が' + nameOf(e.t); });
  }
  function autosize(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; }
  function autosizeAll() { Array.prototype.forEach.call(document.querySelectorAll('.irow textarea'), autosize); }

  function formHtml() {
    var f = I.form, rp = f.rep, b = isBully(f.type), ts = typesOf(f.type);
    var h = '<form class="form iform" id="incForm"><h2>' + (f.edit ? '事案を直す' : '事案を登録') + '<span class="idraft" id="idraft"></span></h2>' +
      '<div class="lab">事案の種別（複数選べます）</div><div class="itypes">' + C.INCIDENT_TYPES.map(function (t) { return '<button type="button" class="lv" data-ty="' + esc(t) + '" aria-pressed="' + (ts.indexOf(t) >= 0) + '">' + esc(t) + '</button>'; }).join('') + '</div>' +
      '<label>関係する児童' + (onlyDamage(f.type) ? '' : 'と関係図（矢印＝加害）') + '</label><div class="iq"><span class="iqw"><input id="fQ" value="" placeholder="名前・よみで児童を足す（' + esc(srchGrades().map(function (g0) { return g0 + '年'; }).join('・')) + '）" autocomplete="off"><button type="button" class="iqc" id="fQset" title="検索の設定（探す学年・候補の書き方）" aria-label="検索の設定"></button></span>' +
      (onlyDamage(f.type) ? '' : '<button type="button" class="btn" id="fUnk" title="誰か分からない児童（加害者が不明など）のカードを足す">＋ ？（不明の児童）</button>') + '</div><div id="fSugg"></div>';
    if (onlyDamage(f.type)) h += '<div class="ikids">' + f.dg.d.nodes.map(function (n) { return '<span class="chip">' + esc(kidName(n.id)) + '<button type="button" data-kdel="' + n.id + '" aria-label="外す">×</button></span>'; }).join('') + '</div>';
    else h += '<div id="fDg" class="dg"></div>';
    if (b) {
      h += '<fieldset class="irep"><legend>いじめの項目</legend>' +
        '<label>発見のきっかけ<select id="fFound"><option value="">選ぶ</option>' + C.FOUND_LIST.map(function (t) { return '<option' + (t === rp.found ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
        '<div class="lab">いじめの態様（複数選べます）</div><div class="imodes">' + C.MODES.map(function (m, i) {
          // 長い補足は「？」の中に畳む（押すと開く）
          return '<div class="imode"><label class="chk"><input type="checkbox" data-mode="' + i + '"' + (rp.modes[i] ? ' checked' : '') + '> ' + esc(m.t) + '</label>' +
            (m.note ? '<button type="button" class="imq" data-mq="1" title="例を見る" aria-label="例を見る" aria-expanded="false">？</button><div class="imqt" hidden>' + esc(m.note) + '</div>' : '') + '</div>';
        }).join('') + '</div>' +
        '<label>その他の内容<input id="fOther" value="' + esc(rp.other) + '" maxlength="200"' + (rp.modes[C.MODES.length - 1] ? '' : ' disabled') + '></label></fieldset>';
    }
    ['hk', 'kk', 'sd'].forEach(function (k) { h += secHtml('s1', k, rp.s1[k]); });
    h += '<details class="iopt"><summary>文書のURL・題名（任意）</summary><label>文書のURL<input id="fUrl" value="' + esc(f.url || '') + '" placeholder="docs.google.com/… を貼る"></label>' +
      '<label>題名（空なら「種別の事案」）<input id="fTitle" value="' + esc(f.title || '') + '" maxlength="80" placeholder="児童の氏名は入れない"></label></details>' +
      (f.detail ? '<label>詳細（以前の記録）<textarea id="fDetail" rows="4" maxlength="5000">' + esc(f.detail) + '</textarea></label>' : '') +
      '<div class="note">事実を書き、推測や人柄の評価は書きません（保護者から開示を求められることがある記録です）。期間は記録の行の日付から決まります。</div>' +
      '<div class="row"><button type="button" class="btn" id="cancelInc">やめる</button><button class="btn primary">' + (f.edit ? '直す' : '登録する') + '</button></div></form>';
    return h;
  }
  function add2Html(x) {
    var f = I.form, s2 = f.rep.s2;
    var h = '<form class="form iform" id="inc2Form"><h2>その後の経緯を追記（様式Ⅱ用）<span class="idraft" id="idraft"></span></h2><div class="meta">' + esc(titleOf(x)) + '・' + esc(App.span(x)) + '</div>';
    var vv = realVictims(x);
    ['sd', 'vi', 'ha'].forEach(function (k) {
      // 被害の児童が2人以上なら、児童ごとに欄を分ける（Excel も児童ごとに作る）
      if (k === 'vi' && vv.length > 1) { vv.forEach(function (id) { h += secHtml('s2v', id, f.rep.s2v[id]); }); return; }
      h += secHtml('s2', k, s2[k]);
    });
    h += '<h3 class="ish"><b>関係機関との連携</b><span>相談・連携した機関（無ければ「なし」）</span></h3><input id="fKikan" class="ikikan" data-phs="kikan" value="' + esc(s2.kikan) + '" maxlength="2000" placeholder="右の記入補助から選ぶか、書く">' +
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
    var rc = cv.getBoundingClientRect(), cw = rc.width, k = cw / W, ky = rc.height / H;
    var box = document.createElement('div');
    box.className = 'dg-crop';
    box.style.width = Math.round((x1 - x0) * k) + 'px'; box.style.height = Math.round((y1 - y0) * ky) + 'px';
    cv.parentNode.insertBefore(box, cv); box.appendChild(cv);
    cv.style.width = Math.round(cw) + 'px'; cv.style.height = Math.round(rc.height) + 'px'; cv.style.marginLeft = -Math.round(x0 * k) + 'px'; cv.style.marginTop = -Math.round(y0 * ky) + 'px';
  }
  function rerenderPane() { var w = document.querySelector('.iwrap'); if (w && w.classList.contains('solo') === sided()) return render(); var p = App.$('ipane'); if (p) { p.innerHTML = pane(); mountDg(); autosizeAll(); showExtra(); } renderAssist(); }

  // ===== 記入補助（右）：選んでいる欄に合う定型文と、関係する児童の名前。押すか、ドラッグして入れる =====
  var ASSIST_NAMES = { 's1:hk': '発覚', 's1:kk': '経緯', 's1:sd': '指導', 's2:sd': '指導の経過', 's2:vi': '被害児童・保護者の様子', 's2:ha': '加害児童・保護者の様子', kikan: '関係機関との連携' };
  function phraseKey(where) { return where === 'kikan' ? 'kikan' : where === 's2:sd' ? 's2sd' : where.split(':')[0] === 's2v' ? 'vi' : where.split(':')[1]; }
  function assistHtml() {
    if (FOLD.assist) return '<button class="ifold" id="iasT" title="記入補助を開く" aria-label="記入補助を開く">' + IC.asOpen + '</button><button class="ivlab" id="iasT2" tabindex="-1">記入補助</button>';
    var h = '<div class="ihead"><b class="ib">' + IC.help + '記入補助</b><button class="ifold" id="iasT" title="記入補助を畳む" aria-label="記入補助を畳む">' + IC.asClose + '</button></div>';
    var where = I.form && I.focus ? I.focus.split(':').slice(0, 2).join(':') : null;
    if (I.form && I.focus === 'kikan') where = 'kikan';
    var vName = where && where.split(':')[0] === 's2v' ? '被害児童・保護者の様子（' + kidName(where.split(':')[1]) + '）' : null;
    if (!I.form || !where || !(ASSIST_NAMES[where] || vName)) return h + '<p class="note">入力欄を押すと、その欄に合う文がここに出ます。押すか、入力欄へドラッグして入れます。</p>';
    var names = formKids(), ph = C.PHRASES[phraseKey(where)] || [];
    h += '<div class="iaw s-' + (vName ? 's2vi' : where.replace(':', '')) + '">' + esc(vName || ASSIST_NAMES[where]) + '</div>';
    var used = usedIn(where);
    if (names.length && where !== 'kikan') h += '<div class="lab">児童の名前</div><div class="iph">' + names.map(function (n) { return '<button type="button" class="nm" draggable="true" data-ph="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') + '</div>';
    h += '<div class="lab">定型文（使った文は ✓）</div><div class="iph col">' + ph.map(function (t) { var u = used.indexOf(t) >= 0; return '<button type="button" draggable="true" class="' + (u ? 'used' : '') + '" data-ph="' + esc(t) + '">' + (u ? '✓ ' : '') + esc(t) + '</button>'; }).join('') + '</div>';
    return h;
  }
  function renderAssist() { var a = App.$('iassist'); if (a) a.innerHTML = assistHtml(); }
  function formKids() {
    var f = I.form; if (!f) return [];
    var ids = f.dg ? f.dg.d.nodes.map(function (n) { return n.id; }) : (f.x ? f.x.ids : []);
    return ids.filter(function (id) { return !E.isUnknown(id); }).map(kidName);
  }
  // 入れる：選んでいる行のカーソルの所へ。文の途中でなく末尾なら、句点で終わっていない時は「。」を挟む（名前の後ろは挟まない）
  function putPhrase(text) {
    var f = I.form; if (!f || !I.focus) return;
    if (I.focus === 'kikan') {
      var k = App.$('fKikan'), cur = f.rep.s2.kikan.replace(/[、。\s]*$/, '');
      if (k) { k.focus(); k.setSelectionRange(cur.length, k.value.length); typeIn(k, (cur ? '、' : '') + text); }
      return;
    }
    var q = I.focus.split(':'), r = f.rep[q[0]][q[1]][+q[2]];
    if (!r) return;
    var el = App.$('rw-' + q[0] + '-' + q[1] + '-' + q[2]), pos = el ? el.selectionStart : r.t.length, end = el ? el.selectionEnd : r.t.length;
    var before = r.t.slice(0, pos), after = r.t.slice(end), isName = formKids().indexOf(text) >= 0;
    var lastName = formKids().some(function (n) { return before.slice(-n.length) === n; });
    // 助詞で始まる文（「に悪口を言った」）や、助詞で終わる途中（「Aが」）にはつなげて入れる
    var glue = !before || isName || lastName || /[。、\s]$/.test(before) || /[がにをとへでものは]$/.test(before) || /^[にをのがとへでも]/.test(text) || after ? '' : '。';
    if (el) { el.focus(); el.setSelectionRange(pos, end); typeIn(el, glue + text); }
    else { r.t = before + glue + text + after; }
    afterEdit();
  }
  // 入力欄に文字を入れる：ブラウザの「入力」として入れるので、Ctrl+Z（元に戻す）・Ctrl+Y（やり直す）が効く
  function typeIn(el, text) {
    var ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) { var a = el.selectionStart, b = el.selectionEnd; el.value = el.value.slice(0, a) + text + el.value.slice(b); el.setSelectionRange(a + text.length, a + text.length); el.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  // 入力が変わった後：選んでいる行の補助と右の一覧（✓）を描き直し、書きかけを保存する
  function afterEdit() { showExtra(); renderAssist(); syncSteps(); saveDraftSoon(); }
  function syncSteps() {
    if (!I.form || !I.form.rep.s1) return;
    var all = I.form.rep.s1.sd.map(function (r) { return r.t; }).join('\n');
    Array.prototype.forEach.call(document.querySelectorAll('[data-step]'), function (cb) { cb.checked = all.indexOf(C.SD_STEPS[+cb.dataset.step]) >= 0; });
  }
  // ===== 書きかけ（下書き）：入力が止まって1.5秒後にサーバーへ =====
  var draftT = 0;
  function draftOf() {
    var f = I.form; if (!f) return null;
    return { mode: I.mode, form: { edit: f.edit, type: f.type, url: f.url, title: f.title, detail: f.detail, rep: f.rep, dg: f.dg ? f.dg.d : null } };
  }
  function saveDraftSoon() {
    clearTimeout(draftT);
    draftT = setTimeout(function () {
      var d = draftOf(); if (!d) return;
      App.pf().saveDraft(App.st.grade, d).then(function () { I.draft = { at: new Date().toISOString(), draft: d }; var el = App.$('idraft'); if (el) el.textContent = '書きかけを保存しました'; }, function () { var el = App.$('idraft'); if (el) el.textContent = '書きかけを保存できません（通信）'; });
    }, 1500);
  }
  function dropDraft() { clearTimeout(draftT); I.draft = null; App.pf().saveDraft(App.st.grade, null); }
  function restoreDraft() {
    var dr = I.draft && I.draft.draft; if (!dr) return;
    var f = dr.form;
    if (dr.mode === 'add2') { var x = incOf(f.edit); if (!x) { dropDraft(); return; } I.form = { edit: x.id, rep: Rp.norm(f.rep), x: x }; ensureV(x); I.mode = 'add2'; I.sel = x.id; }
    else { I.form = { edit: f.edit, dg: App.Diagram.state(f.dg), type: f.type || '', url: f.url || '', title: f.title || '', detail: f.detail || '', rep: Rp.norm(f.rep) }; I.mode = 'form'; if (f.edit != null) I.sel = f.edit; }
    ['hk', 'kk', 'sd'].forEach(function (k) { if (I.mode === 'form' && !I.form.rep.s1[k].length) I.form.rep.s1[k].push({ d: today(), p: '', t: '' }); });
    ['sd', 'vi', 'ha'].forEach(function (k) { if (I.mode === 'add2' && !I.form.rep.s2[k].length) I.form.rep.s2[k].push({ d: today(), p: '', t: '' }); });
    I.focus = null;
  }
  // 最後に触った入力欄を覚え、記入補助を描き直す
  document.addEventListener('focusin', function (e) {
    if (App.st.screen !== 'incidents' || !I.form) return;
    var t = e.target, was = I.focus;
    if (t && t.tagName === 'TEXTAREA' && t.dataset && t.dataset.rw) {
      var q = t.dataset.rw.split(':'); I.focus = q[0] + ':' + q[1] + ':' + q[2];
      // 経緯の最初の行が空なら、関係図の矢印から「Aが B」を入れておく
      var r = I.form.rep[q[0]][q[1]][+q[2]], ld = leads();
      if (q[0] === 's1' && q[1] === 'kk' && +q[2] === 0 && r && !r.t && ld.length) typeIn(t, ld[0]);
    } else if (t && t.id === 'fKikan') I.focus = 'kikan';
    else return;
    if (was !== I.focus) showExtra();
    if (!was || was.split(':').slice(0, 2).join() !== I.focus.split(':').slice(0, 2).join()) renderAssist();
  });
  // 空の入力欄で Ctrl+Z：文字の取り消しが無いので、行を足すなどの操作を戻す
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (App.st.screen !== 'incidents' || !I.form || !(e.ctrlKey || e.metaKey) || e.shiftKey || (e.key !== 'z' && e.key !== 'Z')) return;
    if (t && /^(TEXTAREA|INPUT)$/.test(t.tagName) && t.type !== 'checkbox' && t.value === '' && undo()) e.preventDefault();
  });
  // Enter で次の行（Shift+Enter は行の中で改行）。日本語の変換中は何もしない
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229 || !t || t.tagName !== 'TEXTAREA' || !t.dataset.rw || !I.form) return;
    e.preventDefault();
    if (!t.value.trim()) return;
    var q = t.dataset.rw.split(':'), rows = I.form.rep[q[0]][q[1]], i = +q[2], r = rows[i];
    if (rows[i + 1] && !rows[i + 1].t) { refocus('rw-' + q[0] + '-' + q[1] + '-' + (i + 1)); return; }
    snap(); rows.splice(i + 1, 0, nextRow(r));
    rerenderPane(); refocus('rw-' + q[0] + '-' + q[1] + '-' + (i + 1)); saveDraftSoon();
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
    var d = D(), f = I.form, gs = srchGrades(), fmt = SRCH.fmt || 'gc';
    q = (q || '').trim();
    if (!q) return '';
    var pool = [];
    if (gs.indexOf(d.grade) >= 0) yearOf(d.fy).rows.forEach(function (r) { pool.push({ id: r.id, grade: d.grade, cls: r.cls, no: r.no }); });
    var others = gs.filter(function (g0) { return g0 !== d.grade; });
    if (others.length && !SCHOOL) { loadSchool().then(function () { var el = App.$('fQ'); if (el && App.$('fSugg')) App.$('fSugg').innerHTML = suggHtml(el.value); }); }
    (SCHOOL || []).forEach(function (k) { if (others.indexOf(k.grade) >= 0) pool.push({ id: k.id, grade: k.grade, cls: k.cls }); });
    var items = pool.filter(function (r) {
      var s = d.kids[r.id]; if (!s) return false;
      return !f.dg.d.nodes.some(function (n) { return n.id === r.id; }) && (s.name.indexOf(q) >= 0 || s.name.replace(/\s/g, '').indexOf(q) >= 0 || s.kana.indexOf(q) >= 0 || r.id.indexOf(q) === 0 || String(r.no) === q);
    }).slice(0, 10);
    var label = function (r) {
      var s = d.kids[r.id], gc = r.grade + '-' + (r.cls + 1);
      return fmt === 'name' ? esc(s.name) + '（' + r.grade + '年' + (r.cls + 1) + '組）' : fmt === 'kana' ? esc(s.name) + '（' + esc(s.kana) + '）' + gc : gc + ' ' + esc(s.name);
    };
    return items.length ? '<div class="sugg">' + items.map(function (r) { return '<button type="button" data-pick="' + r.id + '">' + label(r) + '</button>'; }).join('') + '</div>' : '<div class="note">' + (others.length && !SCHOOL ? '全校の名簿を読んでいます…' : '見つかりません') + '</div>';
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
    ensureV(x);
    I.mode = 'add2'; I.sel = x.id; I.focus = null;
  }
  function ensureV(x) {
    var vv = realVictims(x);
    if (vv.length > 1) vv.forEach(function (id) { if (!I.form.rep.s2v[id] || !I.form.rep.s2v[id].length) I.form.rep.s2v[id] = [{ d: today(), p: '', t: '' }]; });
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
    // 被害の児童1人に1つの様式。矢印が無ければ最初の児童を被害の側とする
    var vs = realVictims(x); if (!vs.length) vs = x.ids.slice(0, 1);
    // どの児童を被害児童とする書類を作るかは、教員が選ぶ（1人だけなら選んだ状態で始める）
    var st = { victim: vs[0], pick: vs.length === 1 ? vs.slice() : [], made: [] };
    var cellsOf = function (v) {
      v = v || st.victim;
      return Rp.cells(kind, x, { school: (App.settings && App.settings.school) || '', kid: function (id) { return kidAt(id, x.date); }, victim: v, harms: harmsOf(x, v),
        people: x.ids.map(function (id) { return kidAt(id, x.date); }).filter(function (k) { return k && k.grade; }) });
    };
    App.openDlg({
      noEnter: true,
      html: function () {
        var cells = cellsOf(), L = labels(), refs = C.REPORT && Rp.allowedCells(kind).filter(function (r) { return cells[r] !== undefined; });
        var harms = harmsOf(x, st.victim);
        return '<div class="pop" data-close="1"><div class="dlg iout" role="dialog" aria-modal="true" aria-label="報告書を出力"><h2>' + C.REPORT.names[kind] + 'を出力</h2>' +
          (vs.length > 1 ? '<div class="ivic"><div class="lab">被害児童とする児童を選ぶ（矢印を向けられている児童。複数選べます）</div>' + vs.map(function (id) {
              return '<label class="chk"><input type="checkbox" data-ivic="' + id + '"' + (st.pick.indexOf(id) >= 0 ? ' checked' : '') + '> ' + esc(kidName(id)) + '</label>';
            }).join('') + '<p class="note">選んだ児童1人につき1つの書類を作ります。下のコピー用の表は ' + esc(kidName(st.victim)) + ' の分です。</p></div>' : '') +
          (kind !== 'f2' ? '<p class="note">加害の児童（関係図から）：' + (harms.map(function (id) { return esc(kidName(id)); }).join('、') || 'なし') + (harms.length > C.REPORT.harmRows.length ? '。' + (C.REPORT.harmRows.length + 1) + '人目からは人数だけを書きます' : '') + '</p>' : '') +
          '<div class="acts" style="justify-content:flex-start"><button class="btn primary" id="ixls"' + (st.pick.length ? '' : ' disabled') + '>Excel を作る' + (vs.length > 1 ? (st.pick.length ? '（選んだ' + st.pick.length + '人分・' + st.pick.length + 'ファイル）' : '（被害児童を選んでください）') : '（様式を複製して書き込む）') + '</button><span class="note">' + (App.settings && App.settings.template ? '元の様式は変えず、同じフォルダに複製を作ります' : '様式のファイルが設定されていません（設定の「事案と報告書」）') + '</span></div>' +
          (st.made.length ? '<div class="notebox">作りました：' + st.made.map(function (m) { return '<div><a href="' + esc(m.url) + '" target="_blank" rel="noopener">' + esc(m.name) + ' ↗</a>（' + esc(kidName(m.victim)) + '）</div>'; }).join('') + '</div>' : '') +
          '<h3>コピー用（Excel が作れない時）</h3><table class="icopy"><thead><tr><th>欄</th><th>セル</th><th>書く値</th><th></th></tr></thead><tbody>' +
          refs.map(function (r) { return '<tr><td>' + esc(L[r] || r) + '</td><td>' + r + '</td><td><pre>' + esc(String(cells[r])) + '</pre></td><td><button class="btn" data-icopy="' + r + '">コピー</button></td></tr>'; }).join('') +
          (refs.length ? '' : '<tr><td colspan="4" class="note">書く値がありません</td></tr>') + '</tbody></table>' +
          '<div class="acts"><button class="btn" data-act="close">閉じる<kbd>Esc</kbd></button></div></div></div>';
      },
      click: function (t) {
        var b;
        if ((b = t.closest('[data-ivic]'))) {
          var id = b.dataset.ivic, k = st.pick.indexOf(id);
          if (b.checked && k < 0) st.pick.push(id); else if (!b.checked && k >= 0) st.pick.splice(k, 1);
          st.pick.sort(function (a, c) { return vs.indexOf(a) - vs.indexOf(c); });
          if (b.checked) st.victim = id; else if (st.pick.length) st.victim = st.pick[0];
          App.refreshDlg(); return true;
        }
        if ((b = t.closest('[data-icopy]'))) { copyText(String(cellsOf()[b.dataset.icopy])); return true; }
        if (t.closest('#ixls') && st.pick.length) {
          // 被害の児童ごとに1つずつ作る（同時に送らず、順に）
          st.made = [];
          App.save(function () {
            return st.pick.reduce(function (pr, v) {
              var seq = vs.length > 1 ? vs.indexOf(v) + 1 : 0;
              return pr.then(function () { return App.pf().exportReport(kind, cellsOf(v), x.id, seq); }).then(function (r) { r.victim = v; st.made.push(r); });
            }, Promise.resolve());
          }).then(function () { App.refreshDlg(); });
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
  // その行より後の、まだ書いていない行の日付をそろえる（前日の事案で日付を1つずつ直さなくてよい）
  function spreadDate(at, d) {
    var q = at.split(':'); if (q[0] === 's2v') return;
    var order = q[0] === 's1' ? ['hk', 'kk', 'sd'] : ['sd', 'vi', 'ha'], seen = false;
    order.forEach(function (k) {
      I.form.rep[q[0]][k].forEach(function (r, i) {
        if (k === q[1] && i === +q[2]) { seen = true; return; }
        if (seen && !r.t) { r.d = d; var el = document.querySelector('[data-rw="' + q[0] + ':' + k + ':' + i + ':d"]'); if (el) { el.value = d; var lb = el.parentNode.querySelector('span'); if (lb) lb.textContent = mdShort(d); } }
      });
    });
  }
  function toggleStep(i, on) {
    snap();
    // チェックした手順は、指導の欄の最後の行の続きに入れる（新しい行・次の時間帯には進めない）
    var rows = I.form.rep.s1.sd, t = C.SD_STEPS[i], last = rows[rows.length - 1];
    if (on) {
      if (!last) rows.push({ d: today(), p: '', t: t });
      else last.t = !last.t ? t : last.t + (/[。！？]$/.test(last.t) ? '' : '。') + t;
    } else {
      rows.forEach(function (r) { r.t = r.t.replace(t, '').replace(/^。|。(?=。)|。$/g, ''); });
      for (var k = rows.length - 1; k >= 0 && rows.length > 1; k--) if (!rows[k].t.trim()) rows.splice(k, 1);
    }
    rerenderPane(); saveDraftSoon();
  }
  // 足す行の既定：直前の行と同じ日の、次の時間帯（直前に時間帯が無ければ空のまま）
  function nextRow(prev) {
    if (!prev) return { d: today(), p: '', t: '' };
    if (!prev.p) return { d: prev.d, p: '', t: '' };
    var n = Rp.nextSlot(prev.d, prev.p); return { d: n.d, p: n.p, t: '' };
  }
  // 行を足す・消す、種別・児童・手順のチェックなどの操作を戻す（Ctrl+Z。文字の入力の取り消しはブラウザに任せる）
  var HIST = [];
  function snap() { if (!I.form) return; HIST.push(JSON.stringify({ rep: I.form.rep, type: I.form.type, d: I.form.dg ? I.form.dg.d : null })); if (HIST.length > 50) HIST.shift(); }
  function undo() {
    if (!I.form || !HIST.length) return false;
    var v = JSON.parse(HIST.pop()); I.form.rep = v.rep; I.form.type = v.type;
    if (v.d && I.form.dg) I.form.dg.d = v.d;
    I.focus = null; rerenderPane(); saveDraftSoon(); App.toast('1つ前に戻しました'); return true;
  }
  function closeForm() { HIST = []; I.mode = 'view'; I.form = null; I.focus = null; if (I.sel != null && !incOf(I.sel)) I.sel = null; }

  App.screens.incidents = {
    enter: function () {
      I.mode = 'view'; I.form = null; I.focus = null; I.draft = null;
      var f = App.st.incFocus; App.st.incFocus = null;
      if (f && f.edit != null && incOf(f.edit)) editForm(incOf(f.edit));
      else if (f && f.sel != null && incOf(f.sel)) I.sel = f.sel;
      else if (f && f.add) newForm(f.kid || null);
      else if (I.sel != null && !incOf(I.sel)) I.sel = null;
      mergeSchool();
      render();
      // ほかの学年の児童が関わる事案があれば、全校の名簿を読んで名前を出す
      var dd = D();
      if (!SCHOOL && dd.incidents.some(function (x) { return x.ids.some(function (id) { return !dd.kids[id]; }) || (x.diagram && x.diagram.nodes.some(function (n) { return !E.isUnknown(n.id) && !dd.kids[n.id]; })); }))
        loadSchool().then(function () { if (App.st.screen === 'incidents') render(); });
      // 書きかけがあれば知らせる（入力中でなければ）
      var grade = App.st.grade;
      App.pf().loadDraft(grade).then(function (dr) {
        if (!dr || App.st.screen !== 'incidents' || App.st.grade !== grade) return;
        I.draft = dr; if (I.mode === 'view') rerenderPane();
      }, function () { /* 読めなくても入力はできる */ });
    },
    leave: function () { if (I.form) { clearTimeout(draftT); var d = draftOf(); if (d) { I.draft = { at: new Date().toISOString(), draft: d }; App.pf().saveDraft(App.st.grade, d); } } },
    click: function (t) {
      var x;
      if (t.closest('#ilistT,#ilistT2')) { FOLD.list = !FOLD.list; saveFold(); render(); return true; }
      if (t.closest('#iasT,#iasT2')) { FOLD.assist = !FOLD.assist; saveFold(); renderAssist(); App.$('iassist').parentNode.classList.toggle('ac', !!FOLD.assist); return true; }
      if ((x = t.closest('[data-ph]')) && x.closest('.iassist,.irx')) { putPhrase(x.dataset.ph); return true; }
      if (t.closest('#ihome')) { I.sel = null; render(); return true; }
      if (t.closest('#iadd2nd')) { newForm(null); render(); refocus('fQ'); return true; }
      if ((x = t.closest('[data-ist],[data-ilv]'))) {
        var xi = incOf(I.sel), rp0 = Rp.norm(xi.report);
        if (x.dataset.ist) rp0.status = x.dataset.ist; else rp0.level = x.dataset.ilv;
        App.save(function () { return App.pf().updateIncident(xi.id, body(xi, { rep: rp0 })); }).then(function (inc) {
          var list = D().incidents, i = list.map(function (y) { return y.id; }).indexOf(inc.id); if (i >= 0) list[i] = inc; render();
        });
        return true;
      }
      if (t.closest('#idrGo')) { restoreDraft(); render(); return true; }
      if (t.closest('#idrDel')) { dropDraft(); rerenderPane(); App.toast('書きかけを捨てました'); return true; }
      // 書きかけはサーバーに残っているので、別の事案を開いても失わない
      if (t.closest('#iadd')) { if (I.form) App.screens.incidents.leave(); newForm(null); render(); refocus('fQ'); return true; }
      if ((x = t.closest('[data-isel]'))) { if (I.form) App.screens.incidents.leave(); I.sel = +x.dataset.isel; closeForm(); render(); return true; }
      if (t.closest('#iedit')) { editForm(incOf(I.sel)); rerenderPane(); return true; }
      if (t.closest('#iadd2')) { add2Form(incOf(I.sel)); rerenderPane(); return true; }
      if ((x = t.closest('[data-iout]'))) { outDialog(incOf(I.sel), x.dataset.iout); return true; }
      if (t.closest('#cancelInc')) { dropDraft(); closeForm(); rerenderPane(); return true; }
      if ((x = t.closest('[data-mq]'))) { var nt = x.nextElementSibling, open = nt.hidden; nt.hidden = !open; x.setAttribute('aria-expanded', String(open)); return true; }
      if ((x = t.closest('.idate'))) { var di = x.querySelector('input'); if (di && di.showPicker) { try { di.showPicker(); } catch (e) { di.focus(); } } return true; }
      if ((x = t.closest('[data-ty]'))) { snap();
        var ts = typesOf(I.form.type), ty = x.dataset.ty, k = ts.indexOf(ty);
        if (k >= 0) ts.splice(k, 1); else ts.push(ty);
        I.form.type = C.INCIDENT_TYPES.filter(function (t0) { return ts.indexOf(t0) >= 0; }).join('・');
        rerenderPane(); saveDraftSoon(); return true;
      }
      if ((x = t.closest('[data-kdel]'))) { snap(); I.form.dg.d.nodes = I.form.dg.d.nodes.filter(function (n) { return n.id !== x.dataset.kdel; }); rerenderPane(); saveDraftSoon(); return true; }
      if (t.closest('#fQset')) { srchDialog(); return true; }
      if (t.closest('#ihset')) { homeDialog(); return true; }
      if (t.closest('#fUnk')) { snap();
        var n = 1; while (I.form.dg.d.nodes.some(function (nd) { return nd.id === '?' + n; })) n++;
        App.Diagram.add(I.form.dg, '?' + n); mountDg(); saveDraftSoon(); return true;
      }
      if ((x = t.closest('[data-pick]'))) { snap();
        App.Diagram.add(I.form.dg, x.dataset.pick); App.$('fQ').value = ''; App.$('fSugg').innerHTML = '';
        if (onlyDamage(I.form.type)) rerenderPane(); else mountDg();
        renderAssist(); refocus('fQ'); saveDraftSoon(); return true;
      }
      if ((x = t.closest('[data-rnext]'))) { snap();
        var nq = x.dataset.rnext.split(':'), nrows = I.form.rep[nq[0]][nq[1]], ni = +nq[2], base = nrows[ni];
        // 自動で入れる日付は土日・祝日を飛ばす（その日にしたい時は日付の欄で選び直せる）
        var nr = nq[3] === 'day' ? { d: Rp.nextSchoolDay(base.d || today()), p: Rp.slots()[0], t: '' } : nextRow(base.p ? base : { d: base.d, p: Rp.slots()[0], t: '' });
        if (nq[3] === 'slot' && !base.p) nr = { d: base.d, p: Rp.slots()[0], t: '' };
        nrows.splice(ni + 1, 0, nr);
        rerenderPane(); refocus('rw-' + nq[0] + '-' + nq[1] + '-' + (ni + 1)); saveDraftSoon(); return true;
      }
      if ((x = t.closest('[data-radd]'))) {
        var rows = rowsAt(x.dataset.radd), prev = rows[rows.length - 1];
        rows.push(nextRow(prev));
        rerenderPane(); var p = x.dataset.radd.split(':'); refocus('rw-' + p[0] + '-' + p[1] + '-' + (rows.length - 1)); return true;
      }
      if ((x = t.closest('[data-rdel]'))) { snap(); var q = x.dataset.rdel.split(':'); I.form.rep[q[0]][q[1]].splice(+q[2], 1); I.focus = null; rerenderPane(); saveDraftSoon(); return true; }
      return false;
    },
    input: function (t) {
      // 事案の検索：カードだけを描き直す（入力欄を作り直すと日本語の変換が切れる）
      if (t.id === 'iq') { I.q = t.value; refreshCards(); return; }
      if (t.id === 'isort') { HOME.sort = t.value; saveHome(); refreshCards(); return; }
      var f = I.form; if (!f) return;
      if (t.dataset.step != null) { toggleStep(+t.dataset.step, t.checked); return; }
      if (t.dataset.rw) {
        var q = t.dataset.rw.split(':'), r = f.rep[q[0]][q[1]][+q[2]]; if (!r) return;
        r[q[3]] = t.value;
        if (q[3] === 'd') { spreadDate(q.slice(0, 3).join(':'), t.value); var lb = t.parentNode.querySelector('span'); if (lb) lb.textContent = mdShort(t.value); t.parentNode.title = Rp.md(t.value); }
        if (q[3] === 'p') t.classList.toggle('on', !!t.value);
        if (q[3] === 't') { autosize(t); renderAssist(); syncSteps(); var ex = App.$('irx-' + q[0] + '-' + q[1] + '-' + q[2]); if (ex && I.focus === q.slice(0, 3).join(':')) ex.innerHTML = extraHtml(I.focus); }
        saveDraftSoon(); return;
      }
      if (t.dataset.mode != null) { f.rep.modes[+t.dataset.mode] = t.checked; var o = App.$('fOther'); if (o) o.disabled = !f.rep.modes[C.MODES.length - 1]; saveDraftSoon(); return; }
      switch (t.id) {
        case 'iq': return;
        case 'fQ': App.$('fSugg').innerHTML = suggHtml(t.value); return;
        case 'fUrl': f.url = t.value.trim(); break;
        case 'fTitle': f.title = t.value; break;
        case 'fDetail': f.detail = t.value; break;
        case 'fFound': f.rep.found = t.value; break;
        case 'fOther': f.rep.other = t.value; break;
        case 'fKikan': f.rep.s2.kikan = t.value; renderAssist(); break;
        default: return;
      }
      saveDraftSoon();
    },
    submit: function (form) {
      var f = I.form; if (!f) return;
      if (form.id === 'inc2Form') {
        var x2 = incOf(f.edit);
        App.save(function () { return App.pf().updateIncident(x2.id, body(x2, { rep: f.rep })); }).then(function (inc) { dropDraft(); saved(inc, 'その後の経緯を保存しました'); });
        return;
      }
      if (form.id !== 'incForm') return;
      if (!typesOf(f.type).length) { App.toast('事案の種別を選んでください'); return; }
      if (!f.dg.d.nodes.some(function (n) { return !E.isUnknown(n.id); })) { App.toast('関係する児童を1人以上足してください（「？」だけでは登録できません）'); return; }
      // 保護者への連絡が書かれていなければ一度だけ知らせる（もう一度押せばそのまま登録）
      var sdTxt = f.rep.s1.sd.map(function (r) { return r.t; }).join('');
      if (!f.warned && sdTxt.indexOf('保護者') < 0) { f.warned = true; App.toast('指導の欄に、保護者への連絡が書かれていません。このままでよければ、もう一度「' + (f.edit != null ? '直す' : '登録する') + '」を押します'); return; }
      var x = f.edit != null ? incOf(f.edit) : {};
      var b = body(x, f), orig = b.diagram;
      // 関係図は保存の時に整理する（同じ矢印の児童をグループに・ほぼ水平垂直の線を揃える・縦の空きを詰める）。通知の「戻す」で置いた通りに戻せる
      if (orig) b.diagram = E.tidyDiagram(orig);
      var moved = orig && JSON.stringify(E.normDiagram(orig)) !== JSON.stringify(b.diagram);
      App.save(function () { return f.edit != null ? App.pf().updateIncident(f.edit, b) : App.pf().addIncident(b); }).then(function (inc) {
        dropDraft(); saved(inc, (f.edit != null ? '事案を直しました' : '事案を登録しました') + (moved ? '（関係図を整理しました）' : ''));
        if (moved) App.toast((f.edit != null ? '事案を直しました' : '事案を登録しました') + '（関係図を整理しました）', function () {
          var b2 = Object.assign({}, body(inc, { rep: inc.report }), { diagram: orig });
          App.save(function () { return App.pf().updateIncident(inc.id, b2); }).then(function (inc2) { saved(inc2, '関係図を置いた通りに戻しました'); });
        });
      });
    },
    key: function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z') && I.mode !== 'view' && undo()) { e.preventDefault(); return true; }
      if (e.key === 'Escape' && I.mode !== 'view') { App.screens.incidents.leave(); closeForm(); rerenderPane(); App.toast('書きかけは残してあります'); return true; }
      return false;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

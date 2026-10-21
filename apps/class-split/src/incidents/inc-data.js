/* 事案管理：全校の名簿・事案の読み込み、一覧の絞り込みと並べ方、検索の設定、被害・加害の児童。ui-incidents.js の中に差し込まれる（同じ閉じた範囲の変数を使う）。単独では動かない */
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
  // 事案の一覧で探す学年と絞り込み（開いている間だけ覚える。校務PCは共用なので、次の先生の画面に残さない。空＝この学年だけ）
  var HOME = (function () { try { return JSON.parse(sessionStorage.getItem('classSplit.incHome') || '{}'); } catch (e) { return {}; } })();
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
    }).sort((SORTS.filter(function (s0) { return s0.k === (HOME.sort || 'imp'); })[0] || SORTS[0]).f);
  }
  // 並び替え。同じ順位は新しい順
  var byNew = function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id; };
  var ST_RANK = { open: 0, watch: 1, done: 2, closed: 3 };
  var SORTS = [
    { k: 'imp', label: '対応中が先（次に新しい順）', f: function (a, b) { return (ST_RANK[(a.report || {}).status || 'open'] - ST_RANK[(b.report || {}).status || 'open']) || byNew(a, b); } },
    { k: 'new', label: '新しい順', f: byNew }
  ];
  function saveHome() { try { sessionStorage.setItem('classSplit.incHome', JSON.stringify(HOME)); } catch (e) { /* 今は効く */ } }
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
          '<div class="lab">種別（選ばなければすべて）</div><div class="lvs">' + C.INCIDENT_TYPES.map(function (t) { return '<button class="lv" data-hf="types:' + esc(t) + '" aria-pressed="' + ((HOME.types || []).indexOf(t) >= 0) + '">' + (TYPE_IC[t] || '') + typeHtml(t) + '</button>'; }).join('') + '</div>' +
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
  // 関係する児童の検索の設定（開いている間だけ覚える）：探す学年（空＝この学年だけ）
  var SRCH = (function () { try { return JSON.parse(sessionStorage.getItem('classSplit.incSearch') || '{}'); } catch (e) { return {}; } })();
  function saveSrch() { try { sessionStorage.setItem('classSplit.incSearch', JSON.stringify(SRCH)); } catch (e) { /* 今は効く */ } }
  function srchGrades() { return SRCH.grades && SRCH.grades.length ? SRCH.grades : [D().grade]; }
  function srchDialog() {
    App.openDlg({
      html: function () {
        var gs = srchGrades();
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="検索の設定" style="max-width:460px"><h2>関係する児童の検索</h2>' +
          '<div class="lab">探す学年</div><div class="lvs">' + [1, 2, 3, 4, 5, 6].map(function (g0) { return '<button class="lv" data-sg="' + g0 + '" aria-pressed="' + (gs.indexOf(g0) >= 0) + '">' + g0 + '年</button>'; }).join('') + '</div>' +
          '<p class="note">ほかの学年を選ぶと、全校の今年度の名簿から探します。</p>' +
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

/* 事案管理：描く（左右の欄・初めの画面・事案カード・見る画面）。ui-incidents.js の中に差し込まれる（同じ閉じた範囲の変数を使う）。単独では動かない */
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
  // 報告済み：書類に✓の印（生徒指導担当が一覧で見分けられるように、カードの右上に出す）
  var REP_IC = SVG('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 14l2.5 2.5L16 11"/>');
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
    if (rp.reported) h += '<span class="itg irp" title="' + esc(Rp.md(rp.reported)) + 'に報告">' + REP_IC + '報告済み</span>';
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
      '<label class="big ihb ihsort">' + SVG('<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>') + '<span>並び替え</span><select id="isort">' + SORTS.map(function (s0) { return '<option value="' + s0.k + '"' + ((HOME.sort || 'imp') === s0.k ? ' selected' : '') + '>' + esc(s0.label) + '</option>'; }).join('') + '</select></label></div>';
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
      '<span class="lab">報告</span><button class="lv ib irpb" data-irep="1" aria-pressed="' + !!rp.reported + '">' + REP_IC + (rp.reported ? esc(Rp.md(rp.reported)) + 'に報告済み' : '未報告') + '</button>' +
      (b ? C.BULLY_LEVELS.map(function (lv) { return '<button class="lv" data-ilv="' + lv.k + '" aria-pressed="' + (levelOf(x) === lv.k) + '"' + (levelOf(x) === lv.k ? ' style="background:' + lv.c + ';color:' + lv.t + ';border-color:' + lv.c + '"' : '') + '>' + esc(lv.label) + '</button>'; }).join('') : '') + '</div>';
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

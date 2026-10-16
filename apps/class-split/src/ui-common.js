// 画面の共通部品：状態、文字の無害化、印、トースト、浮く枠、保存状態の表示。
(function (g) {
  'use strict';
  var C = g.CONFIG;
  var App = {
    st: { screen: 'menu', grade: 0, grades: [], data: null },
    $: function (id) { return document.getElementById(id); },
    esc: function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); },
    screens: {}
  };

  // 配慮項目の印：頭文字＋色＋形。程度2以上は字の右上に「+」を（程度−1）個
  // データの出し入れ先。本番（gas）と試行（demo：ダミーデータ・保存しない）を画面から切り替える
  App.mode = g.Platforms.gas ? 'gas' : 'demo';
  App.pf = function () { return g.Platforms[App.mode]; };

  // 程度の＋：縦横が同じ長さの十字を図で描く（字の＋はフォントによって縦長になる）。
  // 下に敷く白い十字は黒より両側と両端に1目盛りずつ大きく、縁取りの幅がどこでも同じになる
  var PLUS = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0V10M0 5H10" stroke="#fff" stroke-width="4.4"/><path d="M5 1.2V8.8M1.2 5H8.8" stroke="#1A1A1A" stroke-width="2"/></svg>';
  App.mark = function (at, lv, note) {
    lv = Math.min(lv, at.max || lv); // 以前の値（程度3）はアイコン＋で出す
    return '<span class="b ' + at.sh + '" style="--c:' + at.c + ';--t:' + at.t + '" data-a="' + at.k + '" data-lv="' + lv + '"' + (note ? ' data-t="' + App.esc(note) + '"' : '') + '><i></i><em>' + at.s + '</em>' +
      (lv > 1 ? '<u>' + PLUS + '</u>' : '') + '</span>';
  };
  // 名簿の名前：枠は空白込み8文字分。入らない名前だけ、左へ流して最初に戻すのを繰り返す
  App.nameBox = function (name) { return '<span class="nmw"><span class="nmt">' + App.esc(name) + '</span></span>'; };
  App.fitNames = function (root) {
    var ts = root.querySelectorAll('.nmt'), over = [];
    for (var i = 0; i < ts.length; i++) { var d = ts[i].scrollWidth - ts[i].parentNode.clientWidth; if (d > 1) over.push([ts[i], d]); } // 測ってから書く（行ごとの再計算を避ける）
    over.forEach(function (x) { x[0].style.setProperty('--d', -x[1] + 'px'); x[0].style.setProperty('--dur', (3 + x[1] / 25).toFixed(1) + 's'); x[0].classList.add('run'); });
  };
  // 並び順の窓（第一〜第三優先）。クラス分けと名簿で共用。o: { title, keys:[{k,label}], def, cur, onOk(O) }
  App.orderDialog = function (o) {
    var O = o.cur.slice();
    App.openDlg({
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="並び順" style="max-width:780px"><h2>' + o.title + '</h2>' +
          ['第一優先', '第二優先', '第三優先'].map(function (lab, i) {
            return '<div class="ordrow"><b>' + lab + '</b><div class="lvs">' + o.keys.concat([{ k: '', label: 'なし' }]).map(function (q) {
              return '<button class="lv" data-ord="' + i + ':' + q.k + '" aria-pressed="' + (O[i] === q.k) + '">' + q.label + '</button>';
            }).join('') + '</div></div>';
          }).join('') +
          '<div class="note">同じ順位の児童は、よみの順に並べます。並び順はこの端末だけに覚えます（ほかの先生の画面は変わりません）。</div>' +
          '<div class="acts"><button class="btn" data-ordreset="1" style="margin-right:auto">初めに戻す</button><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">この順にする<kbd>Enter</kbd></button></div></div></div>';
      },
      click: function (t) {
        var x = t.closest('[data-ord]');
        if (x) { var p = x.dataset.ord.split(':'); O[+p[0]] = p[1]; App.refreshDlg(); return true; }
        if (t.closest('[data-ordreset]')) { O = o.def.slice(); App.refreshDlg(); return true; }
        return false;
      },
      onOk: function () { App.closeDlg(); o.onOk(O.slice()); }
    });
  };
  // 第一〜第三優先で比べる。keys の f が無いものは よみ で比べる。最後は よみ・ID
  App.byKeys = function (keys, order, a, b) {
    for (var i = 0; i < order.length; i++) {
      var key = keys.filter(function (q) { return q.k === order[i]; })[0];
      if (!key) continue;
      var d = key.f ? key.f(a) - key.f(b) : String(a.kana).localeCompare(String(b.kana), 'ja');
      if (d) return d;
    }
    return String(a.kana).localeCompare(String(b.kana), 'ja') || (a.id < b.id ? -1 : 1);
  };

  // 旧学級の無い児童（新年度の転入生）は、帯を灰色・地を白にする
  var NO_CLASS = { c: '#8C8C8C', t: '#FFFFFF', l: '#FFFFFF' };
  // クラス分けの盤面のアイコンの大きさ（倍率）。この端末にだけ覚える
  App.ICON_SCALES = [{ v: .8, label: '小' }, { v: 1, label: '標準' }, { v: 1.2, label: '大' }, { v: 1.4, label: '特大' }, { v: 1.6, label: '最大' }];
  App.iconScale = function () { try { var v = +localStorage.getItem('classSplit.iconScale'); if (v >= .5 && v <= 2) return v; } catch (e) { /* 読めない時は標準 */ } return 1; };
  App.setIconScale = function (v) { try { localStorage.setItem('classSplit.iconScale', String(v)); } catch (e) { /* 覚えられない時は何もしない */ } };
  // 事案の期間：始まり〜終わり（同じ年なら終わりの年を省く。終わりが無ければ始まりだけ）
  App.span = function (x) {
    var a = String(x.date || ''), b = String(x.dateEnd || '');
    if (!b || b === a) return a;
    return a + '〜' + (b.slice(0, 4) === a.slice(0, 4) ? b.slice(5) : b);
  };
  // 児童カード（名前にカーソルを合わせた時・一覧の窓）：今年度の組-番・名前・配慮項目のアイコン
  App.kidCard = function (id) {
    var d = App.st.data, s = d && d.kids[id];
    if (!s) return '';
    var y = d.years.filter(function (x) { return x.fy === d.fy; })[0], r = y && y.rows.filter(function (x) { return x.id === id; })[0];
    var oc = App.classColor(r ? r.cls : -1);
    var marks = r ? C.ATTRS.filter(function (at) { return r.a[at.k] | 0; }).map(function (at) { return App.mark(at, r.a[at.k] | 0, r.a[at.k + '_t']); }).join('') : '';
    return '<div class="kcard ' + (s.male ? 'm' : 'f') + '" style="--oc:' + oc.c + ';--ol:' + (r && r.a.sp ? '#FFE0BF' : oc.l) + '"><span class="nb">' + (r ? (r.cls + 1) + '組' + r.no + '番' : '転入生') + '</span><b>' + App.esc(s.name) + '</b>' +
      (marks ? '<span class="mk">' + marks + '</span>' : '') + '</div>';
  };
  // 事案の数と、そのうち被害の側（被害・相互）の数。関係図の役割から数える
  App.isVictim = function (x, id) { var r = x.roles && x.roles[id]; return r === 'victim' || r === 'mutual'; };
  // line：1段（名簿の表）。省くと2段（クラス分けのカード）
  App.incBox = function (n, v, title, line) {
    if (!n) return '';
    return '<span class="jn ' + (line ? 'jn1' : 'jn2') + '"' + (title ? ' title="' + App.esc(title) + '"' : '') + '><b>' + n + '</b><i>(' + v + ')</i></span>';
  };
  App.surname = function (name) { return String(name || '').split(/[ 　]/)[0]; };
  App.classColor = function (k) { return k < 0 ? NO_CLASS : C.CLASS_COLORS[k % C.CLASS_COLORS.length]; };

  var toastT = 0;
  App.toast = function (msg, undoFn) {
    var t = App.$('toast');
    t.innerHTML = '<span>' + App.esc(msg) + '</span>' + (undoFn ? '<button id="tundo">戻す</button>' : '');
    t.hidden = false;
    App.toastUndo = undoFn || null;
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, undoFn ? 8000 : 3500); // 戻せる通知は読んで押す間を残す
  };

  // 浮く枠。dlg は {html, onOk, onKey}。Enter で onOk、Esc で閉じる
  App.dlg = null;
  // 窓を開いたら、入力欄にはすぐ書けるようにする（カーソルは書いてある文の最後）
  App.openDlg = function (d) {
    App.dlg = d; App.$('layer').innerHTML = d.html();
    if (d.focus) { var f = App.$(d.focus); if (f) { f.focus(); if (f.setSelectionRange && /^(TEXTAREA|INPUT)$/.test(f.tagName) && f.type !== 'date') { var n = f.value.length; f.setSelectionRange(n, n); } } }
  };
  App.refreshDlg = function () { if (App.dlg) App.openDlg(App.dlg); };
  App.closeDlg = function () { var d = App.dlg; App.dlg = null; App.$('layer').innerHTML = ''; if (d && d.onClose) d.onClose(); };

  // 保存状態（自動保存の結果を必ず画面に返す）
  // 表示は上部の見出し行（#save）と、クラス分けの帯（#save2）の両方。帯を描き直した時は App.saveState() で戻す
  App.saveState = function (s, msg) {
    if (s !== undefined) { App.sv = s; App.svMsg = msg; }
    var txt = App.sv === 'saving' ? '保存中…' : App.sv === 'err' ? '保存できません：' + (App.svMsg || '') : App.sv === 'ok' ? '保存済み' : '';
    ['save', 'save2'].forEach(function (id) {
      var el = App.$(id);
      if (el) { el.className = 'save' + (App.sv === 'err' ? ' err' : ''); el.textContent = txt; }
    });
  };
  // 失敗したら5秒後にもう一度。成功・失敗を表示する
  App.save = function (fn) {
    App.saveState('saving');
    return fn().then(function (r) { App.saveState('ok'); return r; }, function (e) {
      App.saveState('err', e && e.message);
      // 直しようのない誤り（権限・凍結・同時保存など）は再試行せず、知らせて止める
      if (e && e.noRetry) { App.toast(e.message); return new Promise(function () {}); } // 後の処理（画面の更新など）に進ませない
      return new Promise(function (res) { setTimeout(res, 5000); }).then(function () { return App.save(fn); });
    });
  };

  g.App = App;
})(typeof globalThis !== 'undefined' ? globalThis : this);

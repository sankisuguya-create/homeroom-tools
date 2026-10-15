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
  // 旧学級の無い児童（新年度の転入生）は、帯を灰色・地を白にする
  var NO_CLASS = { c: '#8C8C8C', t: '#FFFFFF', l: '#FFFFFF' };
  // クラス分けの盤面のアイコンの大きさ（倍率）。この端末にだけ覚える
  App.ICON_SCALES = [{ v: .8, label: '小' }, { v: 1, label: '標準' }, { v: 1.2, label: '大' }, { v: 1.4, label: '特大' }, { v: 1.6, label: '最大' }];
  App.iconScale = function () { try { var v = +localStorage.getItem('classSplit.iconScale'); if (v >= .5 && v <= 2) return v; } catch (e) { /* 読めない時は標準 */ } return 1; };
  App.setIconScale = function (v) { try { localStorage.setItem('classSplit.iconScale', String(v)); } catch (e) { /* 覚えられない時は何もしない */ } };
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
  App.openDlg = function (d) { App.dlg = d; App.$('layer').innerHTML = d.html(); if (d.focus) { var f = App.$(d.focus); if (f) f.focus(); } };
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

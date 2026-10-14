// 入口：画面の切り替えと、クリック・キー・入力の振り分け。
(function (g) {
  'use strict';
  var App = g.App, PF = g.Platform;
  // 漢字を中国語の字形で出さないため、どこに埋め込まれても日本語として扱わせる
  document.documentElement.lang = 'ja';

  function crumb() {
    var st = App.st;
    App.$('crumb').innerHTML = st.screen === 'menu' ? '' :
      '<button data-go="menu">メニュー</button> ＞ ' + st.grade + '年 ＞ ' + (st.screen === 'roster' ? '名簿' : 'クラス分け');
  }

  // 画面を移る。学年のデータはここで1回だけ読む（以後の操作はサーバーを待たない）
  App.go = function (screen, grade) {
    var st = App.st, prev = App.screens[st.screen];
    if (prev && prev.leave) prev.leave();
    App.closeDlg();
    if (grade) st.grade = grade;
    st.screen = screen;
    crumb();
    if (screen === 'menu') {
      return PF.listGrades().then(function (gs) { st.grades = gs; App.screens.menu.render(); });
    }
    App.$('main').innerHTML = '<div class="empty">読み込んでいます…</div>';
    return PF.boot(st.grade).then(function (d) { st.data = d; App.screens[screen].enter(); });
  };
  App.reload = function () { return App.go(App.st.screen, App.st.grade); };

  document.addEventListener('click', function (e) {
    var t = e.target, scr = App.screens[App.st.screen];
    if (t.closest('#tundo')) { if (App.toastUndo) App.toastUndo(); App.$('toast').hidden = true; return; }
    if (App.dlg) {
      var act = t.closest('[data-act]');
      if (act && act.dataset.act === 'ok') { App.dlg.onOk(); return; }
      if (act && act.dataset.act === 'close') { App.closeDlg(); return; }
      if (act && act.dataset.act === 'next' && App.dlg.onTab) { App.dlg.onTab(); return; }
      if (App.dlg.click && App.dlg.click(t)) return;
      if (t.closest('[data-close]') && !t.closest('.dlg,.viol')) App.closeDlg();
      return;
    }
    var go = t.closest('[data-go]');
    if (go) { App.go(go.dataset.go); return; }
    if (scr && scr.click) scr.click(t, e);
  });
  document.addEventListener('dblclick', function (e) { var scr = App.screens[App.st.screen]; if (!App.dlg && scr && scr.dblclick) scr.dblclick(e.target); });
  document.addEventListener('input', function (e) { var scr = App.screens[App.st.screen]; if (scr && scr.input) scr.input(e.target, e); });
  document.addEventListener('submit', function (e) { e.preventDefault(); var scr = App.screens[App.st.screen]; if (scr && scr.submit) scr.submit(e.target); });
  document.addEventListener('keydown', function (e) {
    if (App.dlg) {
      if (e.key === 'Escape') { e.preventDefault(); App.closeDlg(); }
      else if (e.key === 'Enter' && !App.dlg.noEnter && App.dlg.onOk && !e.isComposing) { e.preventDefault(); App.dlg.onOk(); }
      else if (e.key === 'Tab' && App.dlg.onTab && App.dlg.onTab()) e.preventDefault();
      return;
    }
    if (e.target.matches('input,select,textarea')) return;
    var scr = App.screens[App.st.screen];
    if (scr && scr.key) scr.key(e);
  });
  var rz = 0;
  addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { var s = App.screens[App.st.screen]; if (s && s.resize) s.resize(); }, 120); });
  document.addEventListener('fullscreenchange', function () { setTimeout(function () { var s = App.screens[App.st.screen]; if (s && s.resize) s.resize(); }, 50); });

  // 開いた時は担当の学年を選んだ状態にする（本番は担任と学級の対応から。見本は6年）
  App.st.grade = 6;
  App.$('demo').hidden = PF.name !== 'demo';
  App.go('menu');
})(typeof globalThis !== 'undefined' ? globalThis : this);

// 入口：画面の切り替えと、クリック・キー・入力の振り分け。
(function (g) {
  'use strict';
  var App = g.App;
  // 漢字を中国語の字形で出さないため、どこに埋め込まれても日本語として扱わせる
  document.documentElement.lang = 'ja';

  function crumb() {
    var st = App.st;
    App.$('crumb').innerHTML = st.screen === 'menu' ? '' :
      '<button data-go="menu">メニュー</button> ＞ ' + (st.screen === 'settings' ? '' : st.grade + '年 ＞ ') + (st.screen === 'roster' ? '名簿' : st.screen === 'settings' ? '設定' : 'クラス分け');
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
      // 設定（項目の名前・頭文字・重み、担任と学級）もここで読む。担任なら初めはその学年を選ぶ
      return Promise.all([App.pf().listGrades(), App.pf().settings()]).then(function (r) {
        st.grades = r[0];
        App.applySettings(r[1].settings); App.me = r[1].me;
        if (!st.gradeChosen && r[1].me.grade) st.grade = r[1].me.grade;
        App.screens.menu.render();
      });
    }
    if (screen === 'settings') { App.screens.settings.enter(); return Promise.resolve(); }
    App.$('main').innerHTML = '<div class="empty">読み込んでいます…</div>';
    return App.pf().boot(st.grade).then(function (d) { st.data = d; App.screens[screen].enter(); });
  };
  App.reload = function () { return App.go(App.st.screen, App.st.grade); };

  document.addEventListener('click', function (e) {
    var t = e.target, scr = App.screens[App.st.screen];
    if (t.closest('.trial')) { App.toggleTrial(); return; }
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
  document.addEventListener('input', function (e) { if (App.dlg && App.dlg.input) { App.dlg.input(e.target, e); return; } var scr = App.screens[App.st.screen]; if (scr && scr.input) scr.input(e.target, e); });
  document.addEventListener('submit', function (e) { e.preventDefault(); var scr = App.screens[App.st.screen]; if (scr && scr.submit) scr.submit(e.target); });
  document.addEventListener('keydown', function (e) {
    if (App.dlg) {
      if (e.key === 'Escape') { e.preventDefault(); App.closeDlg(); }
      else if (e.key === 'Enter' && !App.dlg.noEnter && App.dlg.onOk && !e.isComposing && (!e.target.matches('textarea') || e.ctrlKey || e.metaKey)) { e.preventDefault(); App.dlg.onOk(); }
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
  // 試行：本番の画面でダミーデータに切り替えて操作を試す（保存はサーバーに送らない）
  App.canTry = !!(g.Platforms.gas && g.Platforms.demo);
  App.paintTrial = function () {
    var on = App.mode === 'demo';
    document.body.classList.toggle('trying', on && App.canTry);
    document.querySelectorAll('.trial').forEach(function (b) {
      b.hidden = !App.canTry;
      b.textContent = on ? '試行をやめる' : '試行';
      b.setAttribute('aria-pressed', String(on));
      b.title = on ? '本番のデータに戻る' : 'ダミーデータで操作を試す（保存されません）';
    });
    App.$('demo').hidden = !on;
    App.$('demo').textContent = App.canTry ? '試行中：ダミーデータです。保存されません。' : '見本：架空の児童。保存は画面を閉じるまで。';
  };
  App.toggleTrial = function () {
    App.mode = App.mode === 'demo' ? 'gas' : 'demo';
    App.sv = undefined; App.saveState();
    App.paintTrial();
    App.go('menu');
  };
  App.paintTrial();
  App.go('menu');
})(typeof globalThis !== 'undefined' ? globalThis : this);

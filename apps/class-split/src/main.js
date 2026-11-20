// 入口：画面の切り替えと、クリック・キー・入力の振り分け。
(function (g) {
  'use strict';
  var App = g.App;
  // 漢字を中国語の字形で出さないため、どこに埋め込まれても日本語として扱わせる
  document.documentElement.lang = 'ja';

  function crumb() {
    var st = App.st;
    App.$('toptools').innerHTML = ''; // 画面ごとの上部の道具（名簿のロックなど）は、その画面が入れる
    App.$('crumb').innerHTML = st.screen === 'menu' ? '' :
      '<button data-go="menu">メニュー</button> ＞ ' + (st.screen === 'settings' || st.screen === 'suggest' ? '' : App.viewLabel() + ' ＞ ') + (st.screen === 'roster' ? '名簿' : st.screen === 'incidents' ? '事案管理' : st.screen === 'settings' ? '設定' : st.screen === 'suggest' ? '目安箱' : 'クラス分け');
  }

  // 画面を移る。学年のデータはここで1回だけ読む（以後の操作はサーバーを待たない）
  // 見ている年度（メニューの年度）。学年（st.grade）はいつも「今年度の学年」で持ち、表示は見ている年度の学年に直す
  App.viewOff = function () { var FY0 = App.pf().fiscalYear; return (App.st.viewFy || FY0) - FY0; };
  App.viewLabel = function () { var off = App.viewOff(); return (off ? (App.pf().fiscalYear + off) + '年度 ' : '') + g.CONFIG.gradeLabel(App.st.grade + off); };
  App.go = function (screen, grade) {
    var st = App.st, prev = App.screens[st.screen];
    if (prev && prev.leave) prev.leave();
    App.closeDlg();
    if (grade) st.grade = grade;
    st.screen = screen;
    document.body.dataset.screen = screen; // 名簿とクラス分けは背景を黒にする（app.css）
    crumb();
    if (screen === 'menu') {
      // 設定（項目の名前・頭文字・重み、担任と学級）もここで読む。担任なら初めはその学年を選ぶ
      var FY0 = App.pf().fiscalYear, vfy = st.viewFy || FY0;
      return Promise.all([App.pf().listGrades(vfy), App.pf().settings(), App.pf().rosterYears ? App.pf().rosterYears() : Promise.resolve([FY0])]).then(function (r) {
        st.grades = r[0]; st.years = r[2];
        App.applySettings(r[1].settings); App.me = r[1].me;
        if (!st.gradeChosen && r[1].me.grade && vfy === FY0) st.grade = r[1].me.grade;
        App.screens.menu.render();
        App.preload(st.grade); // 選んでいる学年を裏で読み始める
        if (r[1].me.admin && App.pf().adminStatus && !App.adminChecked) {
          App.adminChecked = true;
          App.pf().adminStatus().then(function (a) { App.adminWarnings = a.warnings || []; if (App.adminWarnings.length && App.st.screen === 'menu') App.screens.menu.render(); }, function () {});
        }
      }, loadFailed);
    }
    if (screen === 'settings') { App.screens.settings.enter(); return Promise.resolve(); }
    if (screen === 'suggest') { App.screens.suggest.enter(); return Promise.resolve(); }
    App.$('main').innerHTML = '<div class="empty">読み込んでいます…</div>';
    return bootFor(st.grade).then(function (d) { if (st.screen !== screen) return; st.data = d; App.applyScores(d); App.screens[screen].enter(); }, loadFailed);
  };
  // 学年のデータを使い回す：同じ学年を開き直す時、その間に保存が1つも無ければサーバーに聞かない（保存したら読み直す）。
  // メニューで学年を選んだ時に先読みもする（App.preload）。見本・試行と本番は別に持つ
  var BOOT = {};
  function bootFor(grade) {
    var key = (App.mode || '') + ':' + grade, c = BOOT[key];
    if (c && c.gen === App.saveGen) return c.p;
    var p = App.pf().boot(grade);
    BOOT[key] = { gen: App.saveGen, p: p };
    p.catch(function () { if (BOOT[key] && BOOT[key].p === p) delete BOOT[key]; }); // 失敗は覚えない
    return p;
  }
  App.preload = function (grade) { if (grade == null) return; bootFor(grade).catch(function () { /* 開く時に読み直す */ }); };
  // 読み込めなかった時：「読み込んでいます…」のまま止めず、理由と「もう一度」を出す
  function loadFailed(e) {
    if (e && e.device) {
      App.$('main').innerHTML = '<div class="menu"><section><h2>この端末では開けません</h2><p>' + App.esc(e.message) + '</p>' +
        '<p class="note">校務用のパソコンを登録するには、管理者に設定の「端末」で「10分間 登録を受け付ける」を押してもらい、その間にこのページを開き直してください。</p><button class="btn primary" id="reloadBtn">開き直す</button></section></div>';
      return;
    }
    App.$('main').innerHTML = '<div class="menu"><section><h2>読み込めませんでした</h2><p>' + App.esc((e && e.message) || '通信の誤り') + '</p>' +
      '<p class="note">通信が不安定な時に起こります。少し待ってから押してください。</p><button class="btn primary" id="reloadBtn">もう一度読み込む</button> <button class="btn" data-go="menu">メニューへ</button></section></div>';
  }
  App.reload = function () { return App.go(App.st.screen, App.st.grade); };

  document.addEventListener('click', function (e) {
    var t = e.target, scr = App.screens[App.st.screen];
    // 畳んだメニュー：押すと開閉。項目を押したら閉じて、そのまま各画面の click へ。外を押したら閉じる
    var dd = t.closest('[data-dd]');
    if (dd) { var pop = dd.nextElementSibling, open = pop.hidden; App.closeDd(); pop.hidden = !open; dd.setAttribute('aria-expanded', String(open)); return; }
    App.closeDd();
    if (t.closest('.trial')) { App.toggleTrial(); return; }
    if (t.closest('#reloadBtn')) { App.reload(); return; }
    if (t.closest('#tundo')) { if (App.toastUndo) App.toastUndo(); App.$('toast').hidden = true; return; }
    if (t.closest('#tclose') || (t.closest('#toast') && !App.$('toast').classList.contains('stay'))) { App.$('toast').hidden = true; return; } // 時間を待たずに消せる（誤りの知らせは×で）
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
    if (go) { if (go.dataset.paste) App.st.openPaste = true; if (go.dataset.school) App.st.openSchool = true; App.go(go.dataset.go); return; } // data-paste：名簿の画面で貼る窓をすぐ開く
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
  // アイコンの説明：カーソルを合わせると、その項目の意味と＋の付け方を出す（枠は1つを使い回す）
  var tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; document.body.appendChild(tip);
  var tipOn = null;
  document.addEventListener('mouseover', function (e) {
    var b = e.target.closest && e.target.closest('.b[data-a],[data-kc]');
    if (b === tipOn) return;
    tipOn = b;
    if (!b) { tip.hidden = true; return; }
    var at = g.CONFIG.ATTRS.filter(function (x) { return x.k === b.dataset.a; })[0];
    if (b.dataset.kc) { tip.innerHTML = App.kidCard(b.dataset.kc); tip.hidden = false; place(b); return; } // 名前にカーソル：児童カード
    if (!at || !at.help) { tip.hidden = true; return; }
    var lv = +b.dataset.lv, m1 = App.mark(at, 1), m2 = App.mark(at, 2);
    tip.innerHTML = '<h3>' + App.esc(at.help[0]) + '</h3><table>' +
      '<tr class="' + (lv === 1 ? 'on' : '') + '"><td>' + m1 + '</td><td>' + App.esc(at.help[1]) + '</td></tr>' +
      (at.max > 1 ? '<tr class="' + (lv === 2 ? 'on' : '') + '"><td>' + m2 + '</td><td>' + App.esc(at.help[2]) + '</td></tr>' : '') + '</table>' +
      (b.dataset.t ? '<div class="tn">' + App.esc(b.dataset.t) + '</div>' : '') +
      (at.max > 1 ? '<p>' + (at.good ? '特に際立つ場合はプラスをつけてください。' : '担任の負担が明確に増える場合はプラスをつけてください。') + '</p>' : '');
    tip.hidden = false;
    place(b);
  });
  function place(b) {
    var r = b.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    var x = Math.max(8, Math.min(r.left, innerWidth - w - 8)), y = r.bottom + 6;
    if (y + h > innerHeight - 8) y = r.top - h - 6;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  addEventListener('scroll', function () { tip.hidden = true; tipOn = null; }, true);

  var rz = 0;
  addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { var s = App.screens[App.st.screen]; if (s && s.resize) s.resize(); }, 120); });
  document.addEventListener('fullscreenchange', function () { setTimeout(function () { var s = App.screens[App.st.screen]; if (s && s.resize) s.resize(); }, 50); });

  // 開いた時は担当の学年を選んだ状態にする（本番は担任と学級の対応から。見本は6年）
  App.st.grade = 5;
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
  // 放置の覆い：操作が IDLE_MIN 分ないと画面を覆う（席を離れた間に児童がのぞく・触るのを防ぐ）。押すと戻る。データと入力中の内容はそのまま
  var IDLE_MIN = 3, idleAt = Date.now();
  var touch = function () { idleAt = Date.now(); };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) { addEventListener(ev, touch, true); });
  // 覆いは、ありきたりの算数・国語のプリントに見せる（fakeprint.js。隠すたびに替える）。1回押すと戻る（利用者の判断）
  var hide = function () { var cv = App.$('idle'); if (!cv || !cv.hidden) return; cv.innerHTML = '<div class="fp-back">クリックで作業に戻る</div>' + App.fakePrint(); cv.scrollTop = 0; cv.hidden = false; tip.hidden = true; };
  setInterval(function () { if (Date.now() - idleAt > IDLE_MIN * 60000) hide(); }, 10000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) hide(); });
  var cvEl = App.$('idle');
  cvEl.addEventListener('click', function (e) { e.stopPropagation(); cvEl.hidden = true; cvEl.innerHTML = ''; touch(); });
  App.paintTrial();
  App.go('menu');
})(typeof globalThis !== 'undefined' ? globalThis : this);

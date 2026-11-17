// メニュー：学年を選び、「名簿を見る」「事案管理」「クラス分けをする」を選ぶ。
(function (g) {
  'use strict';
  var App = g.App;
  App.screens.menu = {
    render: function () {
      var st = App.st, cur = (st.grades || []).filter(function (x) { return x.grade === st.grade; })[0];
      // 管理者への知らせ（共有の状態・年度替わりの消し忘れ）。読み込みは main.js が go('menu') の時に1回
      var warn = (App.adminWarnings || []).map(function (w) { return '<div class="warnbox" role="alert">' + App.esc(w.text) + (w.kind === 'purge' ? ' <button class="btn" data-go="settings">設定を開く</button>' : '') + '</div>'; }).join('');
      App.$('main').innerHTML = '<div class="menu">' + warn +
        '<section><h2>学年を選ぶ</h2><div class="grades">' + st.grades.map(function (x) {
          return '<button class="gbtn" data-g="' + x.grade + '" aria-pressed="' + (x.grade === st.grade) + '">' + g.CONFIG.gradeLabel(x.grade) + '<small>' + (x.count ? x.count + '人' + (x.grade === 0 ? '' : '・' + x.classes + '学級') : '名簿なし') + (x.decided ? '・決定済み' : '') + '</small></button>';
        }).join('') + '</div></section>' +
        '<section><h2>' + g.CONFIG.gradeLabel(st.grade) + 'で何をしますか</h2><div class="bigs">' +
        // 名簿が0人の学年は、名簿を貼る入口を先頭に大きく出す（名簿の画面を開くと、すぐ貼る窓が開く）
        (cur && !cur.count ? '<button class="big" data-go="roster" data-paste="1"><b>名簿を貼る</b><span>' + (st.grade === 0 ? '来年度に入学する児童の名簿を、Excel やスプレッドシートからコピーして貼る。児童IDは無くてよい（仮の番号を振る）。' : 'まだ名簿がありません。Excel やスプレッドシートの名簿をコピーして貼る。') + '</span></button>'
          : '<button class="big" data-go="roster"><b>名簿を見る</b><span>' + (st.grade === 0 ? '来年度に入学する児童の名簿。配慮項目の入力。' : '今年度と過去の年度の学級名簿。配慮項目の入力、児童ごとの経年の記録。') + '</span></button>') +
        (st.grade === 0 ? '' : '<button class="big" data-go="incidents"><b>事案管理</b><span>事案の登録と記録（発覚・経緯・指導）、その後の経緯、市教委への報告書の出力。</span></button>') + // 新1年は入学前なので事案は無い
        (st.grade >= 6 ? '' : '<button class="big" data-go="split"><b>クラス分けをする</b><span>' + (st.grade === 0 ? '入学する児童を1年の学級に分ける案を作り、入れ替え・比較して決める。' : '来年度の学級の案を作り、入れ替え・比較して決める。') + '</span></button>') + // 6年は卒業するのでクラス分けは無い
        '</div></section>' +
        '<section><button class="btn" data-go="settings">⚙ 設定（配慮項目・利用者と担任・事案と報告書・年度替わり）</button>' +
        '<p class="note" id="mbuild">版：' + App.esc(App.buildLabel()) + '</p></section></div>'; // 貼った版を GitHub の dist と照らす
    },
    click: function (t) {
      var gb = t.closest('[data-g]');
      if (gb) { App.st.grade = +gb.dataset.g; App.st.gradeChosen = true; App.screens.menu.render(); return true; }
      return false;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

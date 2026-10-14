// メニュー：学年を選び、「名簿を見る」か「クラス分けをする」を選ぶ。
(function (g) {
  'use strict';
  var App = g.App;
  App.screens.menu = {
    render: function () {
      var st = App.st;
      App.$('main').innerHTML = '<div class="menu">' +
        '<section><h2>学年を選ぶ</h2><div class="grades">' + st.grades.map(function (x) {
          return '<button class="gbtn" data-g="' + x.grade + '" aria-pressed="' + (x.grade === st.grade) + '">' + x.grade + '年<small>' + x.count + '人・' + x.classes + '学級' + (x.decided ? '・決定済み' : '') + '</small></button>';
        }).join('') + '</div></section>' +
        '<section><h2>' + st.grade + '年で何をしますか</h2><div class="bigs">' +
        '<button class="big" data-go="roster"><b>名簿を見る</b><span>今年度と過去の年度の学級名簿。配慮項目の入力、事案の登録と一覧、児童ごとの経年の記録。</span></button>' +
        '<button class="big" data-go="split"><b>クラス分けをする</b><span>来年度の学級の案を作り、入れ替え・比較して決める。</span></button>' +
        '</div></section>' +
        '<section><button class="btn" data-go="settings">⚙ 設定（配慮項目・担任と学級・事案の種別・年度替わり）</button></section></div>';
    },
    click: function (t) {
      var gb = t.closest('[data-g]');
      if (gb) { App.st.grade = +gb.dataset.g; App.st.gradeChosen = true; App.screens.menu.render(); return true; }
      return false;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

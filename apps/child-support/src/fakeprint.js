// 画面を隠す時の見せかけのプリント（算数・国語）。席を離れた間に児童がのぞいても、ありきたりのプリントに見えるようにする。
// 中身はすべて作りもの（児童の名前は入れない。名前の欄は空のまま）。隠すたびに3種類から順に替える。
(function (g) {
  'use strict';
  var App = g.App;
  var head = function (title, sub) {
    return '<div class="fp-head"><div><div class="fp-title">' + title + '</div><div class="fp-sub">' + sub + '</div></div>' +
      '<div class="fp-name">　　年　　組　名前（　　　　　　　　　）</div></div>';
  };
  var box = '<span class="fp-box"></span>';
  var PRINTS = [
    // 1. 算数：わり算の練習（3年）
    function () {
      var q = [[24, 6], [35, 7], [48, 8], [27, 3], [42, 6], [63, 9], [32, 4], [56, 7], [45, 5], [72, 8], [18, 2], [54, 9], [36, 4], [49, 7], [40, 5], [81, 9]];
      return head('わり算の練習 ⑤', '3年　算数　〔あまりのないわり算〕') +
        '<p class="fp-lead">つぎの計算をしましょう。</p><ol class="fp-grid">' +
        q.map(function (x) { return '<li>' + x[0] + ' ÷ ' + x[1] + ' ＝ ' + box + '</li>'; }).join('') + '</ol>' +
        '<p class="fp-lead">□にあてはまる数をかきましょう。</p><ol class="fp-grid fp-grid2" start="17">' +
        ['□ × 6 ＝ 42', '8 × □ ＝ 64', '□ ÷ 3 ＝ 9', '28 ÷ □ ＝ 4'].map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>';
    },
    // 2. 国語：漢字の書き取り（4年）
    function () {
      var q = [['たいせつ', 'な', 'ほうほう', 'を考える。'], ['しゅくだい', 'を', 'わす', 'れる。'], ['ろうか', 'を', 'しず', 'かに歩く。'], ['きゅうしょく', 'の', 'じゅんび', 'をする。'],
        ['かんさつ', 'カードを', 'か', 'く。'], ['きせつ', 'の', 'へんか', 'を調べる。'], ['にっき', 'を', 'つづ', 'ける。'], ['とうばん', 'を', 'き', 'める。']];
      return head('漢字の書き取り ⑫', '4年　国語　〔新しく習った漢字〕') +
        '<p class="fp-lead">――の言葉を、漢字で書きましょう。</p><ol class="fp-kanji">' +
        q.map(function (x) { return '<li><span class="fp-ul">' + x[0] + '</span>' + x[1] + '<span class="fp-ul">' + x[2] + '</span>' + x[3] + '<span class="fp-masu"><i></i><i></i><i></i><i></i></span></li>'; }).join('') + '</ol>';
    },
    // 3. 算数：文章題（2年）
    function () {
      var q = ['はるきさんは、シールを 38まい もっています。お姉さんから 15まい もらいました。シールは ぜんぶで なんまいに なりましたか。',
        'こうえんで 子どもが 52人 あそんでいます。そのうち 27人が かえりました。のこりは なん人ですか。',
        'えんぴつが 1はこに 6本ずつ 入っています。4はこでは、えんぴつは なん本ですか。',
        'あさがおの つるが きのうより 9cm のびて、46cm に なりました。きのうは なんcm でしたか。'];
      return head('文しょうもんだい ⑦', '2年　さんすう　〔しきと こたえを かこう〕') +
        '<ol class="fp-word">' + q.map(function (t) { return '<li><p>' + t + '</p><div class="fp-ans"><span>しき</span><span class="fp-line"></span><span>こたえ</span><span class="fp-line s"></span></div></li>'; }).join('') + '</ol>';
    }
  ];
  var next = Math.floor(Math.random() * PRINTS.length);
  // 覆いに次のプリントを入れる（隠すたびに替える）
  App.fakePrint = function () { var h = PRINTS[next](); next = (next + 1) % PRINTS.length; return '<div class="fp-paper">' + h + '</div>'; };
  App.FAKE_PRINTS = PRINTS.length;
})(typeof globalThis !== 'undefined' ? globalThis : this);

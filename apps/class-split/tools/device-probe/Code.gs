// 端末の判定の確かめ（本番のクラス替えとは別のプロジェクトに貼る）。データにも個人情報にも触れない。
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('端末の確かめ').addMetaTag('viewport', 'width=device-width,initial-scale=1');
}
// 画面から送られた値を、サーバーでも受け取れるかの確かめ（保存はしない）
function echo(v) { return { got: v, at: new Date().toISOString() }; }

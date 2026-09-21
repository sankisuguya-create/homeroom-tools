function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('アイコンメーカー')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

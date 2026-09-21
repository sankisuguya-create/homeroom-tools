function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Icon Studio')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

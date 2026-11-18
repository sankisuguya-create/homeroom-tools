function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('スライド1枚目まとめ印刷')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function apiListFiles(input) {
  var m = String(input || '').match(/[-\w]{25,}/);
  if (!m) throw new Error('フォルダのURLを貼ってください');
  var folder = DriveApp.getFolderById(m[0]);
  var it = folder.getFilesByType(MimeType.GOOGLE_SLIDES);
  var list = [];
  while (it.hasNext()) {
    var f = it.next();
    var owner = '';
    try { owner = f.getOwner().getEmail(); } catch (e) {}
    var name = f.getName();
    list.push({ id: f.getId(), name: name, label: name.split(' - ')[0], key: owner || name });
  }
  list.sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
  return { folder: folder.getName(), files: list };
}

function apiThumb(fileId) {
  for (var i = 0; i < 4; i++) {
    try {
      var pres = Slides.Presentations.get(fileId, { fields: 'pageSize,slides.objectId' });
      var t = Slides.Presentations.Pages.getThumbnail(fileId, pres.slides[0].objectId,
        { 'thumbnailProperties.thumbnailSize': 'LARGE' });
      return { url: t.contentUrl, w: t.width, h: t.height };
    } catch (e) {
      if (!/429|rate|quota/i.test(e.message) || i === 3) throw e;
      Utilities.sleep(5000 * (i + 1));
    }
  }
}

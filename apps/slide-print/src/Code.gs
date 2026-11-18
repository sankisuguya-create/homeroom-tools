function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('スライドまとめ印刷')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function apiListFiles(input) {
  var t = String(input || '').trim();
  var m = t.match(/folders\/([-\w]{10,})/) || t.match(/[?&]id=([-\w]{10,})/) || t.match(/^([-\w]{10,})$/);
  if (!m) throw new Error('フォルダのURLを貼ってください');
  var folder = DriveApp.getFolderById(m[1]);
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

// which: 1始まりの番号、または 'all'
function apiThumbs(fileId, which) {
  var pres = retry_(function () {
    return Slides.Presentations.get(fileId, { fields: 'slides.objectId' });
  });
  var slides = pres.slides || [];
  var idx = [];
  if (which === 'all') { for (var i = 0; i < slides.length; i++) idx.push(i); }
  else if (slides.length >= which) idx.push(which - 1);
  return { total: slides.length, items: idx.map(function (i) {
    var t = retry_(function () {
      return Slides.Presentations.Pages.getThumbnail(fileId, slides[i].objectId,
        { 'thumbnailProperties.thumbnailSize': 'LARGE' });
    });
    return { no: i + 1, url: t.contentUrl, w: t.width, h: t.height };
  }) };
}

function retry_(fn) {
  for (var i = 0; ; i++) {
    try { return fn(); } catch (e) {
      if (!/429|rate|quota/i.test(e.message) || i === 3) throw e;
      Utilities.sleep(5000 * (i + 1));
    }
  }
}

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
  var me = Session.getActiveUser().getEmail();
  var list = [];
  while (it.hasNext()) {
    var f = it.next();
    var owner = '';
    try { owner = f.getOwner().getEmail(); } catch (e) {}
    var name = f.getName();
    var dash = name.indexOf(' - ');
    // 提出すると所有者が教師に移る（返却で児童に戻る）。所有者では並べない。
    // 「氏名 - 元ファイル名」でない名前は、教師の元ファイル（雛形）とみなす。
    list.push({ id: f.getId(), name: name, label: dash > 0 ? name.slice(0, dash) : name,
      template: dash <= 0, mine: !!me && owner === me });
  }
  list.sort(function (a, b) {
    return (a.template - b.template) || a.label.localeCompare(b.label, 'ja', { numeric: true });
  });
  return { folder: folder.getName(), files: list };
}

// which: 1始まりの番号、または 'all'
function apiThumbs(fileId, which, size) {
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
        { 'thumbnailProperties.thumbnailSize': size === 'MEDIUM' ? 'MEDIUM' : 'LARGE' });
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

// PDF用：サムネイルの画像を data URL で返す（画面側の canvas に描くため）
function apiImage(url) {
  if (!/^https:\/\/[\w.-]+\.googleusercontent\.com\//.test(String(url))) throw new Error('画像のURLが正しくありません');
  var b = UrlFetchApp.fetch(url).getBlob();
  return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
}

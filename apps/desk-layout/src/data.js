/* ===== 机・用具・標準配置の正本 =====
   寸法はすべて mm。机の上から見た座標は
     x: 0（児童の左）→ 650（児童の右）
     y: 0（黒板がわ＝前）→ 450（児童がすわる がわ＝後ろ）
   用具の名前は {漢字|よみ} でふりがなを付ける。 */

/* 机：写真の机（天板は平ら・物入れは児童がわに開く・フックは左右両側）に合わせる */
var DESK = {
  w: 650, d: 450,          // 天板（新JIS相当）
  top: 25,                 // 天板の厚み
  trayV: 25, trayH: 105,   // 物入れ：天板の下 25〜130
  trayInset: 22,
  hookY: 330,              // フックの前後位置（前から）。写真では児童がわ寄り
  hookV: 48,               // フックの高さ（天板の上面から下へ）
  legInset: 28,
  crop: 560                // 横から見た図は上から 560mm までを描き、脚の下は切る
};
var CHAIR = { w: 380, d: 350, gap: 40, seatV: 330, backV: 70 };

var SIDES = ['left', 'right'];   // フックのある面
var PLACES = [
  { id: 'tray',   name: '{机|つくえ}の{中|なか}' },
  { id: 'locker', name: 'ロッカー' },
  { id: 'bag',    name: 'ランドセル' }
];

/* ---- 描画の小道具（用具の絵だけが使う） ---- */
var INK = '#3A352E';
function R(x, y, w, h, fill, rx, sw, stroke) {
  return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx == null ? 6 : rx) +
    '" fill="' + fill + '" stroke="' + (stroke || INK) + '" stroke-width="' + (sw == null ? 3 : sw) + '"/>';
}
function L(x1, y1, x2, y2, stroke, sw) {
  return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (stroke || INK) +
    '" stroke-width="' + (sw || 3) + '" stroke-linecap="round"/>';
}
function C(cx, cy, r, fill, sw) {
  return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '" stroke="' + INK + '" stroke-width="' + (sw == null ? 3 : sw) + '"/>';
}
function rules(x, y, w, h, step, col) {   // 横線
  var s = '';
  for (var yy = y + step; yy < y + h - 4; yy += step) s += L(x, yy, x + w, yy, col, 2);
  return s;
}
function grid(x, y, w, h, step, col) {    // ます目
  var s = rules(x, y, w, h, step, col);
  for (var xx = x + step; xx < x + w - 4; xx += step) s += L(xx, y, xx, y + h, col, 2);
  return s;
}
function book(w, h, page) {              // 開いた本：左右のページ＋のど
  return R(0, 0, w / 2, h, '#FFFFFF', 3) + R(w / 2, 0, w / 2, h, '#FFFFFF', 3) +
    page(0, w / 2, h) + page(w / 2, w / 2, h) + L(w / 2, 0, w / 2, h, INK, 4);
}
var RAINBOW = ['#E5484D', '#F2994A', '#F2C94C', '#6FCF97', '#2F9E6E', '#56CCF2', '#2F80ED', '#9B51E0', '#E08DBB', '#8D6E63', '#4F4F4F', '#F5F5F5'];

/* ---- 用具 ----
   kind:'top'  机の上に置く。states に 閉じた形 closed／開いた形 open（開く物だけ）
   kind:'hang' フックに掛ける。side=[幅,高さ]（横から見た大きさ）, t=厚み */
var ITEMS = {
  textbook: { name: '{教科書|きょうかしょ}', kind: 'top', states: {
    closed: { w: 210, d: 257, draw: function (w, h) {
      return R(0, 0, w, h, '#7FB0D6') + R(0, 0, 16, h, '#5B8DB8', 0) + R(45, 45, 130, 60, '#FFFFFF', 4, 2) + C(110, 175, 34, '#F2C94C', 2);
    } },
    open: { w: 420, d: 257, draw: function (w, h) {
      return book(w, h, function (x, pw, ph) { return rules(x + 24, 20, pw - 48, ph - 40, 22, '#C9C3B6'); }) + R(w / 2 + 40, 40, 120, 80, '#BFDDEF', 4, 2);
    } } } },
  notebook: { name: 'ノート', kind: 'top', states: {
    closed: { w: 182, d: 252, draw: function (w, h) {
      return R(0, 0, w, h, '#F1E3A8') + R(28, 40, w - 56, 70, '#FFFFFF', 4, 2) + rules(36, 46, w - 72, 58, 18, '#C9C3B6');
    } },
    open: { w: 364, d: 252, draw: function (w, h) {
      return book(w, h, function (x, pw, ph) { return grid(x + 10, 10, pw - 20, ph - 20, 19, '#BCD3E8'); });
    } } } },
  drill: { name: 'ドリル', kind: 'top', states: {
    closed: { w: 182, d: 257, draw: function (w, h) {
      return R(0, 0, w, h, '#F0A07E') + R(28, 40, w - 56, 60, '#FFFFFF', 4, 2) + grid(30, 130, w - 60, 96, 24, '#C46D4C');
    } },
    open: { w: 364, d: 257, draw: function (w, h) {
      return book(w, h, function (x, pw, ph) {
        var s = '';
        for (var i = 0; i < 5; i++) s += R(x + 22, 24 + i * 44, 30, 30, '#FFFFFF', 3, 2) + L(x + 64, 40 + i * 44, x + pw - 22, 40 + i * 44, '#C9C3B6', 2);
        return s;
      });
    } } } },
  renraku: { name: '{連絡帳|れんらくちょう}', kind: 'top', states: {
    closed: { w: 128, d: 182, draw: function (w, h) { return R(0, 0, w, h, '#9FCB8E') + R(20, 26, w - 40, 44, '#FFFFFF', 4, 2); } },
    open: { w: 256, d: 182, draw: function (w, h) {
      return book(w, h, function (x, pw, ph) { return rules(x + 14, 12, pw - 28, ph - 24, 20, '#C9C3B6'); });
    } } } },
  pencase: { name: '{筆箱|ふでばこ}', kind: 'top', states: {
    closed: { w: 210, d: 75, draw: function (w, h) { return R(0, 0, w, h, '#5E86BD', 14) + L(10, 16, w - 10, 16, '#3F638F', 3); } },
    open: { w: 210, d: 150, draw: function (w, h) {
      var s = R(0, 0, w, 75, '#89A9D3', 14) + R(0, 75, w, 75, '#DDE6F2', 14);
      for (var i = 0; i < 4; i++) {
        var y = 86 + i * 14;
        s += R(30, y, 140, 9, ['#F2C94C', '#E5484D', '#2F80ED', '#6FCF97'][i], 2, 2) +
             '<path d="M170 ' + y + ' l14 4.5 l-14 4.5z" fill="#E8D3B0" stroke="' + INK + '" stroke-width="2"/>';
      }
      return s;
    } } } },
  colorpencil: { name: '{色鉛筆|いろえんぴつ}', kind: 'top', states: {
    closed: { w: 190, d: 130, draw: function (w, h) { return R(0, 0, w, h, '#C9A5D6', 8) + R(30, 30, w - 60, 40, '#FFFFFF', 4, 2); } },
    open: { w: 380, d: 130, draw: function (w, h) {
      var s = R(0, 0, w / 2, h, '#F4EEF7', 8) + R(w / 2, 0, w / 2, h, '#F4EEF7', 8);
      for (var i = 0; i < 24; i++) {
        var x = (i < 12 ? 18 : w / 2 + 18) + (i % 12) * 13;
        s += R(x, 16, 10, h - 32, RAINBOW[i % 12], 2, 1.5);
      }
      return s;
    } } } },
  pc: { name: 'パソコン', kind: 'top', states: {
    closed: { w: 292, d: 204, draw: function (w, h) { return R(0, 0, w, h, '#4C535C', 12) + R(14, 14, w - 28, h - 28, '#5A626B', 8, 1.5, '#3A4048'); } },
    open: { w: 292, d: 250, draw: function (w, h) {
      var s = R(0, 0, w, 48, '#2B3036', 8) + R(10, 8, w - 20, 30, '#5E87A8', 4, 1.5) +
              R(0, 46, w, h - 46, '#5A626B', 12) + R(20, 66, w - 40, 104, '#3A4048', 4, 2);
      for (var r = 0; r < 4; r++) for (var c = 0; c < 10; c++) s += R(26 + c * 24.5, 72 + r * 24.5, 20, 20, '#626A73', 3, 1);
      return s + R(w / 2 - 44, 186, 88, 50, '#6A727B', 6, 2);
    } } } },
  glue: { name: 'のり', kind: 'top', states: {
    closed: { w: 34, d: 34, draw: function (w, h) { return C(17, 17, 16, '#F2C94C') + C(17, 17, 7, '#FFFFFF', 2); } } } },
  scissors: { name: 'はさみ', kind: 'top', states: {
    closed: { w: 70, d: 165, draw: function () {
      return '<path d="M30 2 L40 2 L44 100 L26 100 Z" fill="#C7CCD1" stroke="' + INK + '" stroke-width="3"/>' +
             '<ellipse cx="17" cy="132" rx="15" ry="26" fill="#E2574C" stroke="' + INK + '" stroke-width="3"/>' +
             '<ellipse cx="53" cy="132" rx="15" ry="26" fill="#E2574C" stroke="' + INK + '" stroke-width="3"/>' + C(35, 100, 5, '#FFFFFF', 2);
    } } } },
  ruler: { name: 'じょうぎ', kind: 'top', states: {
    closed: { w: 30, d: 170, draw: function (w, h) {
      var s = R(0, 0, w, h, '#E7F1F8', 3);
      for (var y = 10; y < h; y += 10) s += L(0, y, y % 50 ? 9 : 16, y, INK, 1.5);
      return s;
    } } } },
  pencil: { name: '{鉛筆|えんぴつ}', kind: 'top', states: {
    closed: { w: 10, d: 175, draw: function (w, h) {
      return R(0, 22, w, h - 22, '#F2C94C', 2, 2) + '<path d="M0 22 L5 0 L10 22 Z" fill="#E8D3B0" stroke="' + INK + '" stroke-width="2"/>';
    } } } },
  eraser: { name: '{消|け}しゴム', kind: 'top', states: {
    closed: { w: 26, d: 50, draw: function (w, h) { return R(0, 0, w, h, '#FFFFFF', 3) + R(0, 14, w, 24, '#3C78C8', 0, 2); } } } },
  shitajiki: { name: '{下|した}じき', kind: 'top', states: {
    closed: { w: 182, d: 257, draw: function (w, h) { return R(0, 0, w, h, '#CFE6F5', 6, 2); } } } },
  test: { name: 'テスト', kind: 'top', states: {
    closed: { w: 364, d: 257, draw: function (w, h) {
      var s = R(0, 0, w, h, '#FFFFFF', 2) + R(14, 14, w - 28, 34, '#EDEAE2', 2, 2);
      for (var i = 0; i < 4; i++) s += R(20, 64 + i * 46, 26, 26, '#FFFFFF', 2, 2) + L(56, 80 + i * 46, w - 24, 80 + i * 46, '#C9C3B6', 2);
      return s;
    } } } },
  felt: { name: '{習字|しゅうじ}の{下|した}じき', kind: 'top', states: {
    closed: { w: 270, d: 370, draw: function (w, h) { return R(0, 0, w, h, '#2E3B5C', 4); } } } },
  hanshi: { name: '{半紙|はんし}', kind: 'top', states: {
    closed: { w: 242, d: 333, draw: function (w, h) { return R(0, 0, w, h, '#FBFAF4', 1, 2, '#8D877B'); } } } },
  bunchin: { name: '{文鎮|ぶんちん}', kind: 'top', states: {
    closed: { w: 210, d: 22, draw: function (w, h) { return R(0, 0, w, h, '#2B2B2B', 4); } } } },
  suzuri: { name: 'すずり', kind: 'top', states: {
    closed: { w: 105, d: 180, draw: function (w, h) { return R(0, 0, w, h, '#2F2F33', 12) + R(12, 12, w - 24, h - 24, '#4A4A50', 8, 2) + R(12, 12, w - 24, 46, '#151517', 8, 2); } } } },
  fude: { name: '{筆|ふで}', kind: 'top', states: {
    closed: { w: 12, d: 200, draw: function (w, h) {
      return R(0, 40, w, h - 40, '#C9A56B', 3, 2) + '<path d="M0 42 Q6 -4 12 42 Z" fill="#1F1F1F" stroke="' + INK + '" stroke-width="2"/>';
    } } } },
  bokuju: { name: '{墨汁|ぼくじゅう}', kind: 'top', states: {
    closed: { w: 46, d: 46, draw: function () { return C(23, 23, 22, '#1F1F1F') + C(23, 23, 10, '#E5484D', 2); } } } },
  shodobox: { name: '{習字|しゅうじ}セット', kind: 'top', states: {
    closed: { w: 300, d: 200, draw: function (w, h) { return R(0, 0, w, h, '#3E4F7A', 10) + R(30, 30, w - 60, 30, '#5B6E9C', 4, 2); } },
    open: { w: 300, d: 400, draw: function (w, h) {
      return R(0, 0, w, 200, '#5B6E9C', 10) + R(0, 200, w, 200, '#DCE1EC', 10) +
             R(14, 214, 110, 172, '#C6CDDD', 6, 2) + R(136, 214, 150, 80, '#C6CDDD', 6, 2) + R(136, 306, 150, 80, '#C6CDDD', 6, 2);
    } } } },
  paper: { name: '{画用紙|がようし}', kind: 'top', states: {
    closed: { w: 270, d: 380, draw: function (w, h) { return R(0, 0, w, h, '#FFFDF5', 1, 2, '#8D877B'); } } } },
  palette: { name: 'パレット', kind: 'top', states: {
    closed: { w: 120, d: 230, draw: function (w, h) { return R(0, 0, w, h, '#F7F7F7', 10) + R(14, 14, w - 28, h - 28, '#FFFFFF', 6, 1.5, '#B5B0A6'); } },
    open: { w: 240, d: 230, draw: function (w, h) {
      var s = R(0, 0, w, h, '#F7F7F7', 10) + L(w / 2, 0, w / 2, h, '#B5B0A6', 2);
      for (var i = 0; i < 8; i++) s += R(12, 12 + i * 26, 30, 22, '#FFFFFF', 4, 1.5, '#B5B0A6');
      return s + R(54, 14, 60, 200, '#FFFFFF', 6, 1.5, '#B5B0A6') + R(w / 2 + 12, 14, w / 2 - 24, 96, '#FFFFFF', 6, 1.5, '#B5B0A6') +
             R(w / 2 + 12, 120, w / 2 - 24, 96, '#FFFFFF', 6, 1.5, '#B5B0A6');
    } } } },
  fudearai: { name: '{筆洗|ひっせん}', kind: 'top', states: {
    closed: { w: 200, d: 110, draw: function (w, h) { return R(0, 0, w, h, '#A9D3E8', 14) + L(70, 8, 70, h - 8, INK, 3) + L(135, 8, 135, h - 8, INK, 3); } } } },
  enogubox: { name: '{絵|え}の{具|ぐ}セット', kind: 'top', states: {
    closed: { w: 270, d: 180, draw: function (w, h) { return R(0, 0, w, h, '#E8A33D', 10) + R(30, 30, w - 60, 30, '#F6CF8F', 4, 2); } },
    open: { w: 270, d: 360, draw: function (w, h) {
      var s = R(0, 0, w, 180, '#F6CF8F', 10) + R(0, 180, w, 180, '#FFF4E0', 10);
      for (var i = 0; i < 8; i++) s += R(16 + i * 31, 196, 24, 90, RAINBOW[i], 4, 2);
      return s + R(16, 300, w - 32, 44, '#F6CF8F', 6, 2);
    } } } },
  zoukin: { name: 'ぞうきん', kind: 'top', states: {
    closed: { w: 120, d: 120, draw: function (w, h) { return R(0, 0, w, h, '#F3F0E6', 4) + L(14, 14, w - 14, h - 14, '#B5B0A6', 2) + L(w - 14, 14, 14, h - 14, '#B5B0A6', 2); } } } },

  kyushoku: { name: '{給食袋|きゅうしょくぶくろ}', kind: 'hang', side: [190, 240], t: 40, color: '#F2B8B5', style: 'string' },
  taisou:   { name: '{体操服|たいそうふく}', kind: 'hang', side: [300, 370], t: 70, color: '#7FB8A6', style: 'string' },
  uwabaki:  { name: '{上|うわ}ばき', kind: 'hang', side: [220, 300], t: 60, color: '#B9A6D9', style: 'string' },
  tesage:   { name: '{手|て}さげ', kind: 'hang', side: [320, 300], t: 50, color: '#D8C49A', style: 'handle' },
  shodobag: { name: '{習字|しゅうじ}バッグ', kind: 'hang', side: [400, 300], t: 90, color: '#3E4F7A', style: 'handle' },
  enogubag: { name: '{絵|え}の{具|ぐ}バッグ', kind: 'hang', side: [330, 290], t: 80, color: '#E8A33D', style: 'handle' }
};

/* ---- 標準の配置 ----
   name, yomi: 活動名とその読み（読みは名前全体に付ける）
   top:   { item, state, x, y（中心）, r（回転°）, label（名前を出すか） }
   hooks: { left:[{item,label}], right:[…] }
   away:  [{ item, place, label }]
   flip:  左右反転してよいか（習字は右手で書く指導が通例なので false） */
var DEFAULT_LAYOUTS = [
  { id: 'math', name: '算数', yomi: 'さんすう', flip: true,
    top: [
      { item: 'textbook', state: 'open', x: 300, y: 130, r: 0 },
      { item: 'notebook', state: 'open', x: 300, y: 324, r: 0 },
      { item: 'pencase', state: 'closed', x: 600, y: 130, r: 90 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'taisou' }] },
    away: [{ item: 'drill', place: 'tray' }, { item: 'renraku', place: 'tray' }] },
  { id: 'kokugo', name: '国語', yomi: 'こくご', flip: true,
    top: [
      { item: 'textbook', state: 'open', x: 300, y: 130, r: 0 },
      { item: 'notebook', state: 'open', x: 300, y: 324, r: 0 },
      { item: 'pencase', state: 'closed', x: 600, y: 130, r: 90 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'taisou' }] },
    away: [{ item: 'drill', place: 'tray' }] },
  { id: 'shuji', name: '習字', yomi: 'しゅうじ', flip: false,
    top: [
      { item: 'felt', state: 'closed', x: 250, y: 225, r: 0 },
      { item: 'hanshi', state: 'closed', x: 250, y: 225, r: 0 },
      { item: 'bunchin', state: 'closed', x: 250, y: 72, r: 0 },
      { item: 'suzuri', state: 'closed', x: 500, y: 150, r: 0 },
      { item: 'fude', state: 'closed', x: 590, y: 150, r: 0 },
      { item: 'bokuju', state: 'closed', x: 500, y: 300, r: 0 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'shodobag' }] },
    away: [{ item: 'pencase', place: 'tray' }, { item: 'textbook', place: 'tray' }] },
  { id: 'enogu', name: '絵の具', yomi: 'えのぐ', flip: true,
    top: [
      { item: 'paper', state: 'closed', x: 150, y: 225, r: 0 },
      { item: 'palette', state: 'open', x: 440, y: 125, r: 0 },
      { item: 'fudearai', state: 'closed', x: 430, y: 330, r: 0 },
      { item: 'zoukin', state: 'closed', x: 588, y: 380, r: 0 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'enogubag' }] },
    away: [{ item: 'pencase', place: 'tray' }] },
  { id: 'pc', name: 'パソコン', yomi: '', flip: true,
    top: [
      { item: 'pc', state: 'open', x: 325, y: 175, r: 0 },
      { item: 'pencase', state: 'closed', x: 325, y: 380, r: 0 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'taisou' }] },
    away: [{ item: 'textbook', place: 'tray' }, { item: 'notebook', place: 'tray' }] },
  { id: 'test', name: 'テスト', yomi: '', flip: true,
    top: [
      { item: 'test', state: 'closed', x: 300, y: 225, r: 0 },
      { item: 'pencil', state: 'closed', x: 560, y: 210, r: 0 },
      { item: 'pencil', state: 'closed', x: 585, y: 210, r: 0 },
      { item: 'eraser', state: 'closed', x: 610, y: 340, r: 0 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'taisou' }] },
    away: [{ item: 'pencase', place: 'tray' }, { item: 'textbook', place: 'tray' }, { item: 'notebook', place: 'tray' }] }
];

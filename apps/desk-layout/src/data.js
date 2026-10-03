/* ===== 机・用具・標準配置の正本 =====
   寸法はすべて mm。机の上から見た座標は
     x: 0（児童の左）→ 650（児童の右）
     y: 0（黒板がわ＝前）→ 450（児童がすわる がわ＝後ろ）
   用具の名前は {漢字|よみ} でふりがなを付ける。 */

/* 机：写真の机（天板は平ら・物入れは児童がわに開く・フックは左右両側）に合わせる */
var DESK = {
  w: 650, d: 450,          // 天板：新JIS（JIS S 1021）の 650×450
  top: 25,                 // 天板の厚み
  trayV: 25, trayH: 105,   // 物入れ：天板の下 25〜130
  trayInset: 22,
  hookY: 330,              // フックの前後位置（前から）。写真では児童がわ寄り
  hookV: 48,               // フックの高さ（天板の上面から下へ）
  legInset: 28,
  crop: 560                // 横から見た図は上から 560mm までを描き、脚の下は切る
};
/* 椅子：新JIS 3号（座面幅360・座面高340）。机3号（高さ580）と組むので座面は天板の 240 下 */
var CHAIR = { w: 360, d: 340, gap: 40, seatV: 240, backV: 20 };

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
   絵は「形＋見分けるための印1つ」までにとどめる（モニターで遠くから見るため）。
   kind:'top'  机の上に置く。states に 閉じた形 closed／開いた形 open（開く物だけ）
               sizes があれば判型を選べる（閉じた形の幅×高さ。開くと幅が2倍）
               colors があれば表紙の色を選べる。draw(w, h, 色)
   kind:'hang' フックに掛ける。side=[幅,高さ]（横から見た大きさ）, t=厚み */
var NOTE_COLORS = ['#3FA7D6', '#E8738A', '#9BC53D', '#F2C230', '#8E7CC3'];   // 青・桃・黄緑・黄・紫（参考：方眼ノートの表紙）
function cover(w, h, col) {
  // 方眼ノートの表紙：色の地＋左下の方眼の面＋下の名前欄
  var gw = w * 0.62, gh = h * 0.55, gy = h * 0.22;
  return R(0, 0, w, h, col, 4) + R(10, gy, gw, gh, '#FFFFFF', 3, 0) + grid(10, gy, gw, gh, 16, '#C9DDF0') +
         R(0, h * 0.84, w, h * 0.16, col, 0, 0) + R(12, h * 0.86, w - 24, h * 0.1, '#FFFFFF', 8, 2);
}
var ITEMS = {
  textbook: { name: '{教科書|きょうかしょ}', kind: 'top',
    sizes: { b5: { name: 'B5', w: 182, d: 257 }, ab: { name: 'AB', w: 210, d: 257 } },
    states: {
      closed: { draw: function (w, h) { return R(0, 0, w, h, '#7FB0D6') + R(0, 0, 16, h, '#5B8DB8', 0, 0) + R(w * 0.2, h * 0.15, w * 0.65, h * 0.2, '#FFFFFF', 4, 2); } },
      open: { draw: function (w, h) { return book(w, h, function () { return ''; }) + R(w * 0.06, h * 0.1, w * 0.36, h * 0.25, '#DCEBF5', 4, 0); } } } },
  notebook: { name: 'ノート', kind: 'top',
    sizes: { b5: { name: 'B5', w: 179, d: 252 }, a4: { name: 'A4', w: 210, d: 297 } },
    colors: NOTE_COLORS,
    states: {
      closed: { draw: function (w, h, col) { return cover(w, h, col); } },
      open: { draw: function (w, h) { return book(w, h, function (x, pw, ph) { return grid(x + 8, 8, pw - 16, ph - 16, 10, '#D3E3F1'); }); } } } },
  drill: { name: 'ドリル', kind: 'top', states: {
    closed: { w: 182, d: 257, draw: function (w, h) { return R(0, 0, w, h, '#F0A07E') + R(w * 0.15, h * 0.12, w * 0.7, h * 0.2, '#FFFFFF', 4, 2); } },
    open: { w: 364, d: 257, draw: function (w, h) { return book(w, h, function () { return ''; }); } } } },
  renraku: { name: '{連絡帳|れんらくちょう}', kind: 'top', states: {
    closed: { w: 128, d: 182, draw: function (w, h) { return R(0, 0, w, h, '#9FCB8E') + R(w * 0.15, h * 0.12, w * 0.7, h * 0.2, '#FFFFFF', 4, 2); } },
    open: { w: 256, d: 182, draw: function (w, h) { return book(w, h, function () { return ''; }); } } } },
  pencase: { name: '{筆箱|ふでばこ}', kind: 'top', states: {
    closed: { w: 222, d: 89, draw: function (w, h) { return R(0, 0, w, h, '#5E86BD', 14); } },
    open: { w: 222, d: 178, draw: function (w, h) { return R(0, 0, w, h / 2, '#89A9D3', 14) + R(0, h / 2, w, h / 2, '#5E86BD', 14) + R(14, h / 2 + 12, w - 28, h / 2 - 24, '#DDE6F2', 8, 0); } } } },
  colorpencil: { name: '{色鉛筆|いろえんぴつ}', kind: 'top', states: {
    closed: { w: 190, d: 130, draw: function (w, h) { return R(0, 0, w, h, '#C9A5D6', 8); } },
    open: { w: 380, d: 130, draw: function (w, h) {
      var s = R(0, 0, w, h, '#F4EEF7', 8) + L(w / 2, 0, w / 2, h, INK, 3);
      for (var i = 0; i < 12; i++) s += R(20 + i * 13, 16, 10, h - 32, RAINBOW[i], 2, 0);
      return s;
    } } } },
  pc: { name: 'パソコン', kind: 'top', states: {
    closed: { w: 297, d: 213, draw: function (w, h) { return R(0, 0, w, h, '#4C535C', 12); } },
    open: { w: 297, d: 258, draw: function (w, h) {
      return R(0, 0, w, 48, '#2B3036', 8) + R(0, 46, w, h - 46, '#5A626B', 12) + R(20, 66, w - 40, 104, '#3A4048', 4, 0) + R(w / 2 - 44, 186, 88, 54, '#6A727B', 6, 0);
    } } } },
  glue: { name: 'のり', kind: 'top', states: {
    closed: { w: 34, d: 34, draw: function () { return C(17, 17, 16, '#F2C94C'); } } } },
  scissors: { name: 'はさみ', kind: 'top', states: {
    closed: { w: 70, d: 165, draw: function () {
      return '<path d="M30 2 L40 2 L44 100 L26 100 Z" fill="#C7CCD1" stroke="' + INK + '" stroke-width="3"/>' + C(17, 132, 18, '#E2574C') + C(53, 132, 18, '#E2574C');
    } } } },
  ruler: { name: 'じょうぎ', kind: 'top', states: {
    closed: { w: 30, d: 170, draw: function (w, h) { return R(0, 0, w, h, '#E7F1F8', 3) + L(0, 50, 14, 50, INK, 2) + L(0, 100, 14, 100, INK, 2) + L(0, 150, 14, 150, INK, 2); } } } },
  pencil: { name: '{鉛筆|えんぴつ}', kind: 'top', states: {
    closed: { w: 10, d: 175, draw: function (w, h) { return R(0, 22, w, h - 22, '#F2C94C', 2, 2) + '<path d="M0 22 L5 0 L10 22 Z" fill="#E8D3B0" stroke="' + INK + '" stroke-width="2"/>'; } } } },
  eraser: { name: '{消|け}しゴム', kind: 'top', states: {
    closed: { w: 26, d: 50, draw: function (w, h) { return R(0, 0, w, h, '#FFFFFF', 3) + R(0, 14, w, 24, '#3C78C8', 0, 2); } } } },
  shitajiki: { name: '{下|した}じき', kind: 'top', states: {
    closed: { w: 182, d: 257, draw: function (w, h) { return R(0, 0, w, h, '#CFE6F5', 6, 2); } } } },
  test: { name: 'テスト', kind: 'top', states: {
    closed: { w: 364, d: 257, draw: function (w, h) { return R(0, 0, w, h, '#FFFFFF', 2) + R(14, 14, w - 28, 34, '#EDEAE2', 2, 0); } } } },
  felt: { name: '{習字|しゅうじ}の{下|した}じき', kind: 'top', states: {
    closed: { w: 270, d: 360, draw: function (w, h) { return R(0, 0, w, h, '#2E3B5C', 4); } } } },
  hanshi: { name: '{半紙|はんし}', kind: 'top', states: {
    closed: { w: 242, d: 333, draw: function (w, h) { return R(0, 0, w, h, '#FBFAF4', 1, 2, '#8D877B'); } } } },
  bunchin: { name: '{文鎮|ぶんちん}', kind: 'top', states: {
    closed: { w: 130, d: 18, draw: function (w, h) { return R(0, 0, w, h, '#2B2B2B', 4); } } } },
  suzuri: { name: 'すずり', kind: 'top', states: {
    closed: { w: 100, d: 160, draw: function (w, h) { return R(0, 0, w, h, '#2F2F33', 12) + R(12, 12, w - 24, 44, '#151517', 8, 0); } } } },
  fude: { name: '{筆|ふで}', kind: 'top', states: {
    closed: { w: 12, d: 210, draw: function (w, h) { return R(0, 40, w, h - 40, '#C9A56B', 3, 2) + '<path d="M0 42 Q6 -4 12 42 Z" fill="#1F1F1F" stroke="' + INK + '" stroke-width="2"/>'; } } } },
  bokuju: { name: '{墨汁|ぼくじゅう}', kind: 'top', states: {
    closed: { w: 50, d: 50, draw: function () { return C(25, 25, 24, '#1F1F1F'); } } } },
  shodobox: { name: '{習字|しゅうじ}セット', kind: 'top', states: {
    closed: { w: 350, d: 240, draw: function (w, h) { return R(0, 0, w, h, '#3E4F7A', 10); } },
    open: { w: 350, d: 480, draw: function (w, h) { return R(0, 0, w, h / 2, '#5B6E9C', 10) + R(0, h / 2, w, h / 2, '#DCE1EC', 10); } } } },
  paper: { name: '{画用紙|がようし}', kind: 'top', states: {
    closed: { w: 270, d: 380, draw: function (w, h) { return R(0, 0, w, h, '#FFFDF5', 1, 2, '#8D877B'); } } } },
  palette: { name: 'パレット', kind: 'top', states: {
    closed: { w: 140, d: 213, draw: function (w, h) { return R(0, 0, w, h, '#F7F7F7', 10); } },
    open: { w: 279, d: 213, draw: function (w, h) {
      var s = R(0, 0, w, h, '#F7F7F7', 10) + L(w / 2, 0, w / 2, h, '#B5B0A6', 2);
      for (var i = 0; i < 6; i++) s += R(14, 14 + i * 31, 28, 24, '#FFFFFF', 4, 1.5, '#B5B0A6');
      return s;
    } } } },
  fudearai: { name: '{筆洗|ひっせん}', kind: 'top', states: {
    closed: { w: 200, d: 110, draw: function (w, h) { return R(0, 0, w, h, '#A9D3E8', 14) + L(w / 3, 8, w / 3, h - 8, INK, 3) + L(w * 2 / 3, 8, w * 2 / 3, h - 8, INK, 3); } } } },
  enogubox: { name: '{絵|え}の{具|ぐ}セット', kind: 'top', states: {
    closed: { w: 270, d: 180, draw: function (w, h) { return R(0, 0, w, h, '#E8A33D', 10); } },
    open: { w: 270, d: 360, draw: function (w, h) {
      var s = R(0, 0, w, h / 2, '#F6CF8F', 10) + R(0, h / 2, w, h / 2, '#FFF4E0', 10);
      for (var i = 0; i < 8; i++) s += R(16 + i * 31, h / 2 + 16, 24, 90, RAINBOW[i], 4, 0);
      return s;
    } } } },
  zoukin: { name: 'ぞうきん', kind: 'top', states: {
    closed: { w: 120, d: 120, draw: function (w, h) { return R(0, 0, w, h, '#F3F0E6', 4); } } } },

  kyushoku: { name: '{給食袋|きゅうしょくぶくろ}', kind: 'hang', side: [200, 260], t: 40, color: '#F2B8B5', style: 'string' },
  taisou:   { name: '{体操服|たいそうふく}', kind: 'hang', side: [350, 400], t: 50, color: '#7FB8A6', style: 'string' },
  uwabaki:  { name: '{上|うわ}ばき', kind: 'hang', side: [220, 320], t: 60, color: '#B9A6D9', style: 'string' },
  tesage:   { name: '{手|て}さげ', kind: 'hang', side: [320, 300], t: 50, color: '#D8C49A', style: 'handle' },
  shodobag: { name: '{習字|しゅうじ}バッグ', kind: 'hang', side: [350, 240], t: 60, color: '#3E4F7A', style: 'handle' },
  enogubag: { name: '{絵|え}の{具|ぐ}バッグ', kind: 'hang', side: [325, 140], t: 140, color: '#E8A33D', style: 'handle' }
};

/* ---- 置き場所のグリッド ----
   物の中心は、天板を等分した線の交点にだけ置ける。細かい段は粗い段の交点をすべて含む
   （分割数が2倍ずつ）ので、段を切り替えても置いた物はずれない。 */
var GRID_LEVELS = [
  { id: 'coarse', name: 'あらい',   nx: 6,  ny: 4 },    // 約108×113mm
  { id: 'normal', name: 'ふつう',   nx: 12, ny: 8 },    // 約54×56mm
  { id: 'fine',   name: 'こまかい', nx: 24, ny: 16 }    // 約27×28mm
];
function gx(k, n) { return k * DESK.w / (n || 12); }   // 標準の配置は「ふつう」の交点で書く
function gy(k, n) { return k * DESK.d / (n || 8); }

/* ---- 標準の配置 ----
   name, yomi: 活動名とその読み（読みは名前全体に付ける）
   top:   { item, state, x, y（中心。グリッドの交点）, r（回転°）, label（名前を出すか）,
            size（判型。sizes を持つ物だけ）, color（表紙の色の番号。colors を持つ物だけ） }
   hooks: { left:[{item,label}], right:[…] }
   away:  [{ item, place, label }]
   flip:  左右反転してよいか（習字は右手で書く指導が通例なので false） */
var DEFAULT_LAYOUTS = [
  { id: 'math', name: '算数', yomi: 'さんすう', flip: true,
    top: [
      { item: 'textbook', state: 'open', x: gx(5), y: gy(2), r: 0 },
      { item: 'notebook', state: 'open', x: gx(5), y: gy(6), r: 0, color: 0 },
      { item: 'pencase', state: 'closed', x: gx(10), y: gy(2), r: 90 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'taisou' }] },
    away: [{ item: 'drill', place: 'tray' }, { item: 'renraku', place: 'tray' }] },
  { id: 'kokugo', name: '国語', yomi: 'こくご', flip: true,
    top: [
      { item: 'textbook', state: 'open', x: gx(5), y: gy(2), r: 0 },
      { item: 'notebook', state: 'open', x: gx(5), y: gy(6), r: 0, color: 1 },
      { item: 'pencase', state: 'closed', x: gx(10), y: gy(2), r: 90 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'taisou' }] },
    away: [{ item: 'drill', place: 'tray' }] },
  { id: 'shuji', name: '習字', yomi: 'しゅうじ', flip: false,
    top: [
      { item: 'felt', state: 'closed', x: gx(4), y: gy(4), r: 0 },
      { item: 'hanshi', state: 'closed', x: gx(4), y: gy(4), r: 0 },
      { item: 'bunchin', state: 'closed', x: gx(4), y: gy(3, 16), r: 0 },
      { item: 'suzuri', state: 'closed', x: gx(9), y: gy(3), r: 0 },
      { item: 'fude', state: 'closed', x: gx(11), y: gy(3), r: 0 },
      { item: 'bokuju', state: 'closed', x: gx(9), y: gy(6), r: 0 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'shodobag' }] },
    away: [{ item: 'pencase', place: 'tray' }, { item: 'textbook', place: 'tray' }] },
  { id: 'enogu', name: '絵の具', yomi: 'えのぐ', flip: true,
    top: [
      { item: 'paper', state: 'closed', x: gx(3), y: gy(4), r: 0 },
      { item: 'palette', state: 'open', x: gx(8), y: gy(2), r: 0 },
      { item: 'fudearai', state: 'closed', x: gx(8), y: gy(6), r: 0 },
      { item: 'zoukin', state: 'closed', x: gx(11), y: gy(7), r: 0 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'enogubag' }] },
    away: [{ item: 'pencase', place: 'tray' }] },
  { id: 'pc', name: 'パソコン', yomi: '', flip: true,
    top: [
      { item: 'pc', state: 'open', x: gx(6), y: gy(3), r: 0 },
      { item: 'pencase', state: 'closed', x: gx(6), y: gy(7), r: 0 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'taisou' }] },
    away: [{ item: 'textbook', place: 'tray' }, { item: 'notebook', place: 'tray' }] },
  { id: 'test', name: 'テスト', yomi: '', flip: true,
    top: [
      { item: 'test', state: 'closed', x: gx(5), y: gy(4), r: 0 },
      { item: 'pencil', state: 'closed', x: gx(21, 24), y: gy(3), r: 0 },
      { item: 'pencil', state: 'closed', x: gx(11), y: gy(3), r: 0 },
      { item: 'eraser', state: 'closed', x: gx(11), y: gy(6), r: 0 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'taisou' }] },
    away: [{ item: 'pencase', place: 'tray' }, { item: 'textbook', place: 'tray' }, { item: 'notebook', place: 'tray' }] }
];

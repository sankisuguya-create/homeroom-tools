/* ===== 机・用具・標準配置の正本 =====
   寸法はすべて mm。机の上から見た座標は
     x: 0（児童の左）→ 650（児童の右）
     y: 0（黒板がわ＝前）→ 450（児童がすわる がわ＝後ろ）
   用具の名前は {漢字|よみ} でふりがなを付ける。 */

/* ---- 場所（モード）：床の大きさ・置ける物・細かい設定 ----
   「机の上」に加えて、教室・体育館・運動場の配置図を作れる（メニューで場所を選ぶ）。
   useScene で DESK・GRID_LEVELS・K がいまの場所に切り替わる（描画・編集の仕組みは机と同じ）。
   K は文字・線・余白の見た目の倍率：床の幅を机の幅 650 で割ったもの（広い場所ほど大きく描く）。
   items: その場所に置ける物の id（机は全種）。grid: あらい→ふつう→こまかい（各2倍、包含が保たれる）。 */
var SCENES = {
  /* 机：写真の机（天板は平ら・物入れは児童がわに開く・フックは左右両側）に合わせる */
  desk: {
    id: 'desk', name: '机の上', title: '机の配置図', desk: true, w: 650, d: 450,
    // 天板：新JIS（JIS S 1021）の 650×450
    top: 25,                 // 天板の厚み
    trayV: 25, trayH: 105,   // 物入れ：天板の下 25〜130
    trayInset: 22,
    hookY: 225,              // フックの前後位置（前から）。左右の面の中央
    hookV: 48,               // フックの高さ（天板の上面から下へ）
    legInset: 28,
    crop: 560,               // 横から見た図は上から 560mm までを描き、脚の下は切る
    grid: [
      { id: 'coarse', name: 'あらい',   nx: 6,  ny: 4 },    // 約108×113mm
      { id: 'normal', name: 'ふつう',   nx: 12, ny: 8 },    // 約54×56mm
      { id: 'fine',   name: 'こまかい', nx: 24, ny: 16 }    // 約27×28mm
    ],
    msg: '<ruby>机<rt>つくえ</rt></ruby>の<ruby>上<rt>うえ</rt></ruby>をこの<ruby>形<rt>かたち</rt></ruby>にしてね'
  },
  class: {   // 普通教室 7m×9m（利用者指定。標準的な63㎡級）
    id: 'class', name: '教室', title: '教室の配置図', w: 7000, d: 9000,
    grid: [
      { id: 'coarse', name: 'あらい',   nx: 7,  ny: 9 },    // 1000mm
      { id: 'normal', name: 'ふつう',   nx: 14, ny: 18 },   // 500mm
      { id: 'fine',   name: 'こまかい', nx: 28, ny: 36 }    // 250mm
    ],
    items: ['cdesk', 'ctable', 'cshelf', 'person', 'rowdot', 'rowline', 'rowseno', 'arrow'],
    msg: '<ruby>教室<rt>きょうしつ</rt></ruby>をこの<ruby>形<rt>かたち</rt></ruby>にしてね'
  },
  gym: {     // 体育館 20m×30m（利用者指定）
    id: 'gym', name: '体育館', title: '体育館の配置図', w: 20000, d: 30000,
    grid: [
      { id: 'coarse', name: 'あらい',   nx: 4,  ny: 6 },    // 5000mm
      { id: 'normal', name: 'ふつう',   nx: 8,  ny: 12 },   // 2500mm
      { id: 'fine',   name: 'こまかい', nx: 16, ny: 24 }    // 1250mm
    ],
    items: ['gbox', 'gboard', 'gmat', 'gbeam', 'gbar', 'gtora', 'gball', 'gline', 'person', 'rowdot', 'rowline', 'rowseno', 'arrow'],
    msg: '<ruby>体育館<rt>たいいくかん</rt></ruby>をこの<ruby>形<rt>かたち</rt></ruby>にしてね'
  },
  field: {   // 運動場 40m×60m（利用者指定）
    id: 'field', name: '運動場', title: '運動場の配置図', w: 40000, d: 60000,
    grid: [
      { id: 'coarse', name: 'あらい',   nx: 8,  ny: 12 },   // 5000mm
      { id: 'normal', name: 'ふつう',   nx: 16, ny: 24 },   // 2500mm
      { id: 'fine',   name: 'こまかい', nx: 32, ny: 48 }    // 1250mm
    ],
    items: ['gbar', 'funten', 'fsand', 'ftire', 'fgoal', 'fcone', 'fmark', 'gball', 'gline', 'person', 'rowdot', 'rowline', 'rowseno', 'arrow'],
    msg: '<ruby>運動場<rt>うんどうじょう</rt></ruby>をこの<ruby>形<rt>かたち</rt></ruby>にしてね'
  }
};
var SCENE_ORDER = ['desk', 'class', 'gym', 'field'];   // メニューの並び
var SCENE = SCENES.desk;
var DESK = SCENE;                 // いまの床（机モードでは机そのもの）
var GRID_LEVELS = SCENE.grid;
var K = 1;                       // 文字・線・余白の倍率（床の幅÷机の幅650）
function useScene(id) {
  SCENE = SCENES[id] || SCENES.desk;
  DESK = SCENE; GRID_LEVELS = SCENE.grid; K = DESK.w / 650;
}
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
var ENOGU_COLORS = ['#2B2F36', '#2E4A7A', '#B9A3D6', '#5E6670', '#3D7EBF'];   // 黒・紺・ラベンダー・灰・青（参考：画材セットのバッグ）

/* 表紙の文字。左右反転で描くときも文字は裏返さない（drawTopItem が MIRROR を立てる） */
var MIRROR = 1;
function T(cx, cy, text, fs, fill) {
  return '<g transform="translate(' + cx + ' ' + cy + ') scale(' + MIRROR + ' 1)"><text x="0" y="' + (fs * 0.36) + '" font-size="' + fs +
    '" font-weight="700" text-anchor="middle" fill="' + (fill || INK) + '">' + String(text).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</text></g>';
}
function cover(w, h, col, title, ruled) {
  // 学習帳の表紙：色の地＋上に題名＋左下の白い面（方眼か罫線）＋下の名前欄
  var gw = w * 0.62, gh = h * 0.52, gy = h * 0.26, fs = Math.min(w * 0.2, 42);
  return R(0, 0, w, h, col, 4) + T(w * 0.5, h * 0.13, title, fs) +
         R(10, gy, gw, gh, '#FFFFFF', 3, 0) + (ruled ? rules(10, gy, gw, gh, 16, '#C9DDF0') : grid(10, gy, gw, gh, 16, '#C9DDF0')) +
         R(12, h * 0.85, w - 24, h * 0.1, '#FFFFFF', 8, 2);
}
var PC_BUMPER = '#3E4247', PC_BODY = '#878C92', PC_SCREEN = '#7FA9C9';   // バンパー・本体（ミネラルグレー）・画面
function tabShell(w, h) { return R(0, 0, w, h, PC_BUMPER, 18); }
function tabScreen(x, y, w, h) {   // バンパー＋黒い縁＋画面
  return R(x, y, w, h, PC_BUMPER, 16) + R(x + 10, y + 10, w - 20, h - 20, '#1E2124', 8, 0) + R(x + 26, y + 22, w - 52, h - 44, PC_SCREEN, 3, 0);
}
/* 角を丸めた多角形（台形のバンパーを ① ③ と同じ丸みにするため）。pts は時計回りの頂点、r は角の丸み */
function roundPoly(pts, r) {
  var n = pts.length, d = '';
  for (var i = 0; i < n; i++) {
    var p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    var la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]), k = Math.min(r, la / 2, lb / 2);
    var p1 = [p[0] + (a[0] - p[0]) * k / la, p[1] + (a[1] - p[1]) * k / la], p2 = [p[0] + (b[0] - p[0]) * k / lb, p[1] + (b[1] - p[1]) * k / lb];
    d += (i ? ' L' : 'M') + p1[0] + ' ' + p1[1] + ' Q' + p[0] + ' ' + p[1] + ' ' + p2[0] + ' ' + p2[1];
  }
  return d + ' Z';
}
function roundTrap(x0, y0, x1, y1, insetTop, insetBot, r, fill, stroke) {   // 上の辺を insetTop、下の辺を insetBot だけ内に寄せた角丸の台形
  return '<path d="' + roundPoly([[x0 + insetTop, y0], [x1 - insetTop, y0], [x1 - insetBot, y1], [x0 + insetBot, y1]], r) + '" fill="' + fill + '"' +
         (stroke ? ' stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"' : '') + '/>';
}
/* 状態の呼び名（編集画面のボタン） */
var STATE_NAMES = { closed: 'とじる', open: 'ひらく', open360: '360°', open360r: '360°右', tablet: 'タブレット', tent: '山がた',
                    go: 'まっすぐ', turn: 'まがる', zag: 'つづら', flow: 'ながれる',
                    normal: 'ふつう', hat: 'ぼうし', bib: 'ゼッケン', r1: '1列', r2: '2列', r4: '4列' };

var CLEAR = 'rgba(214,236,247,.85)', CLEAR_LINE = 'rgba(58,53,46,.35)';   // 透明なプラスチック
function ticks(y0, y1, x) {   // 縦の目盛り（1cm＝10mm ごと、5cm ごとに長く）
  var s = '';
  for (var y = y0, k = 0; y <= y1 + 0.1; y += 10, k++) s += L(x, y, x + (k % 5 ? 8 : 15), y, INK, 1.5);
  return s;
}
/* 360°（表紙をうしろへまげた形）：綴じがわの長辺は、まげられた紙と表紙が筒に丸まる。
   筒は長辺のはしまで寄せてある（表紙色の縁は隠れる）＋上はしだけ巻き口（輪）、下はしはそのまま半円。
   ページは筒の下にもぐる。筒の両はしは長辺の両端にかぶる。right=true なら右の長辺側（鏡像）。 */
function roll360(w, h, right) {
  var cx = 10;   // 筒の中心（机の上では約20mm ぶん）
  var s = R(0, -2, 20, h + 4, '#F6F3EA', 10) +                            // 紙の筒（長辺いっぱい・両端にかぶる）
          L(8, 2, 8, h - 2, '#DCD5C2', 2) +                               // 紙の端の縫い目
          C(cx, 4, 7, '#F6F3EA') + C(cx, 4, 2.8, '#D6CFBA', 1.6) +        // 上の巻き口だけ
          R(20, 0, 5, h, 'rgba(0,0,0,.10)', 3, 0);                        // ページに落ちるかげ
  return right ? '<g transform="translate(' + w + ' 0) scale(-1 1)">' + s + '</g>' : s;
}
/* 矢印（動きの説明用）：軸はインクの縁＋色の太線、矢じりは角丸の多角形。
   「ながれる」は SMIL で破線が進行方向に流れる。 */
var ARROW = '#F2994A';
function arrowShaft(d, sw) {
  return '<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="' + (sw + 80) + '" stroke-linecap="round" stroke-linejoin="round"/>' +
         '<path d="' + d + '" fill="none" stroke="' + ARROW + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/>';
}
function arrowHead(pts) {
  return '<path d="' + roundPoly(pts, 40) + '" fill="' + ARROW + '" stroke="' + INK + '" stroke-width="60" stroke-linejoin="round"/>';
}
function tireRing(r) {   // 中が透けるドーナツ（描く場所の床色にかかわらず正しく見える）
  var ri = r * 0.55;
  return '<path d="M 0 ' + r + ' a ' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0 a ' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0 ' +
         'M ' + (r - ri) + ' ' + r + ' a ' + ri + ' ' + ri + ' 0 1 0 ' + 2 * ri + ' 0 a ' + ri + ' ' + ri + ' 0 1 0 ' + (-2 * ri) + ' 0" fill="' + INK + '" fill-rule="evenodd"/>';
}
/* 場所モードの用具は「斜め上から見た模型」：上の面＋手前の面（下）の2面で高さを出す。
   影や脚・厚みの帯は絵の下に置き、置く大きさ(w×d)は床での実寸のまま */
function ELL(cx, cy, rx, ry, fill) {
  return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"/>';
}

var ITEMS = {
  /* 教科書・ノートは「ひらく」（180°）のほか「360°」（表紙をうしろへまげた形）を持つ。
     360°は見えるのが1枚のページだけで、机での大きさは閉じた形と同じ（itemSize は open だけ幅2倍）。 */
  textbook: { name: '{教科書|きょうかしょ}', kind: 'top',
    sizes: { b5: { name: 'B5', w: 182, d: 257 }, a4: { name: 'A4', w: 210, d: 297 } },
    states: {
      closed: { draw: function (w, h) { return R(0, 0, w, h, '#7FB0D6') + R(0, 0, 16, h, '#5B8DB8', 0, 0) + R(w * 0.2, h * 0.15, w * 0.65, h * 0.2, '#FFFFFF', 4, 2); } },
      open: { draw: function (w, h) { return book(w, h, function () { return ''; }) + R(w * 0.06, h * 0.1, w * 0.36, h * 0.25, '#DCEBF5', 4, 0); } },
      open360: { draw: function (w, h) {
        return R(0, 0, w, h, '#FFFFFF', 4) + R(w * 0.26, h * 0.14, w * 0.55, h * 0.24, '#DCEBF5', 4, 0) + roll360(w, h);
      } },
      open360r: { draw: function (w, h) {
        return R(0, 0, w, h, '#FFFFFF', 4) + R(w * 0.19, h * 0.14, w * 0.55, h * 0.24, '#DCEBF5', 4, 0) + roll360(w, h, true);
      } } } },
  notebook: { name: 'ノート', kind: 'top',
    sizes: { b5: { name: 'B5', w: 179, d: 252 }, a4: { name: 'A4', w: 210, d: 297 } },
    colors: NOTE_COLORS,
    states: {
      closed: { draw: function (w, h, col) { return cover(w, h, col, 'ノート'); } },
      open: { draw: function (w, h) { return book(w, h, function (x, pw, ph) { return grid(x + 8, 8, pw - 16, ph - 16, 10, '#D3E3F1'); }); } },
      open360: { draw: function (w, h, col) {
        return R(0, 0, w, h, '#FFFFFF', 4) + grid(30, 14, w - 42, h - 28, 10, '#D3E3F1') + roll360(w, h);
      } },
      open360r: { draw: function (w, h, col) {
        return R(0, 0, w, h, '#FFFFFF', 4) + grid(10, 14, w - 42, h - 28, 10, '#D3E3F1') + roll360(w, h, true);
      } } } },
  drill: { name: 'ドリル', kind: 'top', states: {
    closed: { w: 182, d: 257, draw: function (w, h) { return R(0, 0, w, h, '#F0A07E') + R(w * 0.15, h * 0.12, w * 0.7, h * 0.2, '#FFFFFF', 4, 2); } },
    open: { w: 364, d: 257, draw: function (w, h) { return book(w, h, function () { return ''; }); } } } },
  renraku: { name: '{連絡帳|れんらくちょう}', kind: 'top', colors: NOTE_COLORS, color0: 2, states: {
    closed: { w: 128, d: 182, draw: function (w, h, col) { return cover(w, h, col, 'れんらく', true); } },
    open: { w: 256, d: 182, draw: function (w, h) { return book(w, h, function () { return ''; }); } } } },
  file: { name: 'ファイル', kind: 'top', colors: NOTE_COLORS, color0: 4, states: {
    closed: { w: 236, d: 310, draw: function (w, h, col) {
      return R(0, 0, w, h, col, 6) + R(0, 0, 18, h, 'rgba(0,0,0,.18)', 0, 0) + R(w * 0.18, h * 0.08, w * 0.7, h * 0.16, '#FFFFFF', 6, 2) +
             T(w * 0.53, h * 0.16, 'ファイル', Math.min(w * 0.13, 36));
    } },
    open: { w: 472, d: 310, draw: function (w, h, col) {
      return R(0, 0, w, h, col, 6) + R(12, 12, w / 2 - 24, h - 24, 'rgba(255,255,255,.55)', 4, 0) + R(w / 2 + 12, 12, w / 2 - 24, h - 24, '#FFFFFF', 2, 2) + L(w / 2, 0, w / 2, h, INK, 3);
    } } } },
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
  /* 児童用タブレット：ASUS Chromebook CZ11 Flip（CZ1104F）。ミネラルグレーの本体を、濃い色のゴムのバンパーが一周囲む。
     360°回る画面で4つの形をとる。閉じる・タブレットは真上から、開く・山がたは手前の上から見た絵 */
  pc: { name: 'タブレット', kind: 'top', states: {
    closed: { w: 297, d: 213, draw: function (w, h) {
      // ふたの左下に黄色と白の横長のシール（名前・番号のラベル）
      return tabShell(w, h) + R(16, 16, w - 32, h - 32, PC_BODY, 8, 0) + L(30, 10, w - 30, 10, '#2A2D31', 4) +
             R(32, h - 62, 70, 26, '#F2C94C', 3, 2) + R(108, h - 62, 90, 26, '#FFFFFF', 3, 2);
    } },
    open: { w: 297, d: 300, draw: function (w, h) {
      // 画面が立ち、手前にキーボードの面。奥が少しだけせまい台形（手前の上から見ているため）
      var sh = 170, q = 10;
      var trap = function (x0, y0, x1, y1, inset, fill, stroke, r) { return roundTrap(x0, y0, x1, y1, inset, 0, r, fill, stroke); };
      return tabScreen(18, 0, w - 36, sh) + trap(0, sh, w, h, q, PC_BUMPER, true, 16) + trap(10, sh + 10, w - 10, h - 10, q * 0.9, PC_BODY, false, 8) +
             trap(24, sh + 18, w - 24, sh + 80, q * 0.6, '#2E3236', false, 4) + R(w / 2 - 40, sh + 88, 80, 30, '#9AA0A6', 6, 0);
    } },
    tablet: { w: 297, d: 213, draw: function (w, h) { return tabScreen(0, 0, w, h); } },
    tent: { w: 297, d: 200, draw: function (w, h) {
      // 山がた（横から見ると「^」）を手前の上から。下の辺は ①〜③ と同じ幅、傾きは ② のキーボードと同じ（高さ130で10寄る）
      var inset = h * 10 / 130;
      var ex = function (y) { return inset * (1 - y / h); };   // 左の辺の x
      // 左右の辺に、後ろの脚（キーボードの面）の縁が三角にのぞく
      var y0 = 2, y1 = h * 0.6;   // タブレットの上の辺から始まり、外へは 9 だけ張り出す（少しだけ見える）
      var leg = function (dir) {
        var a = dir < 0 ? ex(y0) : w - ex(y0), b = dir < 0 ? ex(y1) : w - ex(y1);
        return '<path d="' + roundPoly(dir < 0 ? [[a + 8, y0], [b + 8, y1], [b + dir * 9, y1]] : [[a - 8, y0], [b + dir * 9, y1], [b - 8, y1]], 4) +
               '" fill="' + PC_BODY + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>';
      };
      // 枠・黒い縁・画面を同じ傾きの台形にそろえる（左右の辺は ex(y) から一定の幅だけ内側）
      var band = function (top, bot, side, fill, stroke, r) {
        return '<path d="' + roundPoly([[ex(top) + side, top], [w - ex(top) - side, top], [w - ex(bot) - side, bot], [ex(bot) + side, bot]], r) + '" fill="' + fill + '"' +
               (stroke ? ' stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"' : '') + '/>';
      };
      return leg(-1) + leg(1) + band(0, h, 0, PC_BUMPER, true, 18) + band(10, h - 22, 12, '#1E2124', false, 8) + band(22, h - 34, 26, PC_SCREEN, false, 3);
    } } } },
  glue: { name: 'のり', kind: 'top', states: {
    /* 立てたスティックのりをやや斜めから：キャップ（色）・胴（白）・上の楕円 */
    closed: { w: 34, d: 84, draw: function (w, h) {
      return '<path d="M0 12 L0 ' + (h - 8) + ' A17 7 0 0 0 34 ' + (h - 8) + ' L34 12 Z" fill="#FFFFFF" stroke="' + INK + '" stroke-width="3"/>' +
             '<path d="M0 12 L0 38 A17 7 0 0 0 34 38 L34 12 Z" fill="#F2C94C" stroke="' + INK + '" stroke-width="3"/>' +
             '<ellipse cx="17" cy="12" rx="17" ry="7" fill="#F7DC7A" stroke="' + INK + '" stroke-width="3"/>';
    } } } },
  scissors: { name: 'はさみ', kind: 'top', states: {
    closed: { w: 70, d: 165, draw: function () {
      return '<path d="M30 2 L40 2 L44 100 L26 100 Z" fill="#C7CCD1" stroke="' + INK + '" stroke-width="3"/>' + C(17, 132, 18, '#E2574C') + C(53, 132, 18, '#E2574C');
    } } } },
  /* 定規類：透明なプラスチックを淡い水色で。目盛りは 1cm ごとの短い線、5cm ごとに長い線 */
  ruler: { name: '{定規|じょうぎ}（15cm）', kind: 'top', states: {
    closed: { w: 30, d: 170, draw: function (w, h) { return R(0, 0, w, h, CLEAR, 3) + ticks(10, h - 10, 0); } } } },
  ruler30: { name: '{定規|じょうぎ}（30cm）', kind: 'top', states: {
    closed: { w: 34, d: 330, draw: function (w, h) { return R(0, 0, w, h, CLEAR, 3) + ticks(15, h - 15, 0); } } } },
  tri45: { name: '{三角定規|さんかくじょうぎ}（45°）', kind: 'top', states: {
    closed: { w: 150, d: 150, draw: function (w, h) {
      return '<path d="M0 0 L0 ' + h + ' L' + w + ' ' + h + ' Z" fill="' + CLEAR + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
             '<path d="M22 50 L22 ' + (h - 22) + ' L' + (w - 50) + ' ' + (h - 22) + ' Z" fill="none" stroke="' + CLEAR_LINE + '" stroke-width="2"/>' + ticks(10, h - 10, 0);
    } } } },
  tri60: { name: '{三角定規|さんかくじょうぎ}（60°）', kind: 'top', states: {
    closed: { w: 120, d: 208, draw: function (w, h) {
      return '<path d="M0 0 L0 ' + h + ' L' + w + ' ' + h + ' Z" fill="' + CLEAR + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
             '<path d="M20 64 L20 ' + (h - 20) + ' L' + (w - 40) + ' ' + (h - 20) + ' Z" fill="none" stroke="' + CLEAR_LINE + '" stroke-width="2"/>' + ticks(10, h - 10, 0);
    } } } },
  protractor: { name: '{分度器|ぶんどき}', kind: 'top', states: {
    closed: { w: 130, d: 70, draw: function (w, h) {
      var r = w / 2, s = '<path d="M0 ' + h + ' A' + r + ' ' + r + ' 0 0 1 ' + w + ' ' + h + ' Z" fill="' + CLEAR + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>';
      for (var a = 0; a <= 180; a += 10) {
        var c = Math.cos(a * Math.PI / 180), n = Math.sin(a * Math.PI / 180), l = a % 90 ? 9 : 16;
        s += L(r + c * r, h - n * r, r + c * (r - l), h - n * (r - l), INK, 1.5);
      }
      return s + '<path d="M' + (r - 22) + ' ' + h + ' A22 22 0 0 1 ' + (r + 22) + ' ' + h + '" fill="none" stroke="' + CLEAR_LINE + '" stroke-width="2"/>' + L(r, h - 8, r, h, INK, 2);
    } } } },
  compass: { name: 'コンパス', kind: 'top', states: {
    closed: { w: 46, d: 150, draw: function (w, h) {
      // 寝かせたコンパス：上に持ち手、2本の脚。左が針、右が鉛筆の芯
      return '<path d="M' + (w / 2 - 6) + ' 30 L4 ' + (h - 14) + ' L8 ' + (h - 14) + ' L' + (w / 2) + ' 34 Z" fill="#C7CCD1" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
             L(6, h - 14, 6, h, INK, 2) +
             '<path d="M' + (w / 2 + 6) + ' 30 L' + (w - 4) + ' ' + (h - 24) + ' L' + (w - 12) + ' ' + (h - 24) + ' L' + (w / 2) + ' 34 Z" fill="#5E86BD" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
             '<path d="M' + (w - 12) + ' ' + (h - 24) + ' L' + (w - 4) + ' ' + (h - 24) + ' L' + (w - 8) + ' ' + (h - 4) + ' Z" fill="#E8D3B0" stroke="' + INK + '" stroke-width="2"/>' +
             R(w / 2 - 10, 0, 20, 34, '#5E86BD', 6, 2.5) + C(w / 2, 34, 7, '#C7CCD1', 2);
    } } } },
  redpencil: { name: '{赤鉛筆|あかえんぴつ}', kind: 'top', states: {
    closed: { w: 10, d: 175, draw: function (w, h) { return R(0, 22, w, h - 22, '#E5484D', 2, 2) + '<path d="M0 22 L5 0 L10 22 Z" fill="#E8D3B0" stroke="' + INK + '" stroke-width="2"/>' + '<path d="M3 8 L5 0 L7 8 Z" fill="#E5484D"/>'; } } } },
  pencil: { name: '{鉛筆|えんぴつ}', kind: 'top', states: {
    closed: { w: 10, d: 175, draw: function (w, h) { return R(0, 22, w, h - 22, '#F2C94C', 2, 2) + '<path d="M0 22 L5 0 L10 22 Z" fill="#E8D3B0" stroke="' + INK + '" stroke-width="2"/>'; } } } },
  eraser: { name: '{消|け}しゴム', kind: 'top', states: {
    closed: { w: 26, d: 50, draw: function (w, h) { return R(0, 0, w, h, '#FFFFFF', 3) + R(0, 14, w, 24, '#3C78C8', 0, 2); } } } },
  shitajiki: { name: '{下|した}じき', kind: 'top', states: {
    closed: { w: 182, d: 257, draw: function (w, h) { return R(0, 0, w, h, '#CFE6F5', 6, 2); } } } },
  /* プリント：判型を選び、識別のための文字（例：「漢字①」「宿題」）を書き込める。text を持つ物だけ編集画面に文字の欄が出る */
  print: { name: 'プリント', kind: 'top', text: true,
    sizes: { b5: { name: 'B5', w: 182, d: 257 }, a4: { name: 'A4', w: 210, d: 297 }, b4: { name: 'B4', w: 257, d: 364 }, a3: { name: 'A3', w: 297, d: 420 } },
    states: {
      closed: { draw: function (w, h, col, p) {
        var t = (p && p.text) || '', fs = t ? Math.min(w * 0.22, (w - 30) / Math.max(1, t.length)) : 0, s = R(0, 0, w, h, '#FFFFFF', 2, 2);
        for (var y = h * 0.5; y < h - 20; y += 26) s += L(20, y, w - 20, y, '#D6D2C8', 2);
        return s + (t ? T(w / 2, h * 0.25, t, fs) : R(20, 20, w * 0.5, 22, '#EDEAE2', 2, 0));
      } } } },
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
  /* 墨汁の容器をやや斜めから：キャップ・肩・胴・ラベル */
  bokuju: { name: '{墨汁|ぼくじゅう}', kind: 'top', states: {
    closed: { w: 56, d: 130, draw: function (w, h) {
      return '<path d="M0 46 L0 ' + (h - 8) + ' A28 8 0 0 0 56 ' + (h - 8) + ' L56 46 Z" fill="#1F1F1F" stroke="' + INK + '" stroke-width="3"/>' +
             '<path d="M0 46 Q0 26 18 24 L38 24 Q56 26 56 46 Z" fill="#1F1F1F" stroke="' + INK + '" stroke-width="3"/>' +
             R(16, 4, 24, 22, '#E5484D', 5, 3) + R(6, 62, 44, 40, '#FFFFFF', 3, 2);
    } } } },
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
  /* 画材セット（箱型バッグ 幅325×奥行140×高さ140）：上から見ると、2本の持ち手と手前のベルト */
  enogubox: { name: '{絵|え}の{具|ぐ}セット', kind: 'top', colors: ENOGU_COLORS, states: {
    closed: { w: 325, d: 140, draw: function (w, h, col) {
      var s = R(0, 0, w, h, col, 12) + R(8, 8, w - 16, h - 16, 'rgba(255,255,255,.12)', 8, 0);
      [0.3, 0.7].forEach(function (k) {
        s += R(w * k - 8, -6, 16, h + 12, '#1A1A1A', 6, 0);   // 持ち手：ふたの上を前後にわたる帯
      });
      return s + R(w / 2 - 22, h - 46, 44, 46, '#1A1A1A', 6, 2) + C(w / 2, h - 22, 9, '#C9A65B', 2);
    } },
    open: { w: 325, d: 280, draw: function (w, h, col) {
      // ふたを奥へ倒した形：奥がふたの裏、手前が中身（パレット・筆洗・絵の具）
      var m = h / 2, s = R(0, 0, w, m, col, 12) + R(10, 10, w - 20, m - 20, 'rgba(255,255,255,.2)', 8, 0) +
          R(0, m, w, m, col, 12) + R(10, m + 10, w - 20, m - 20, '#F4F1EA', 8, 0) +
          R(18, m + 18, 110, m - 36, '#FFFFFF', 6, 1.5, '#B5B0A6') + R(138, m + 18, 76, m - 36, '#A9D3E8', 8, 1.5);
      for (var i = 0; i < 6; i++) s += R(224 + (i % 3) * 30, m + 18 + Math.floor(i / 3) * 52, 24, 46, RAINBOW[i], 4, 1.5);
      return s;
    } } } },
  zoukin: { name: 'ぞうきん', kind: 'top', states: {
    closed: { w: 120, d: 120, draw: function (w, h) { return R(0, 0, w, h, '#F3F0E6', 4); } } } },

  /* ---- 場所モードの物 ----
     scenes がある物は、その場所（モード）でだけ置ける。机には出さない。
     線の太さは物のサイズに合わせた絶対値（床の広さによらず同じ割合で見える）。 */
  /* 教室（絵は「斜め上から見た模型」：上の面と手前の面で高さを出す） */
  cdesk: { name: '{児童|じどう}の{机|つくえ}といす', kind: 'top', scenes: ['class'], states: {
    closed: { w: 650, d: 890, draw: function (w, h) {   // 机（天板＋前の面＋脚）＋いす（座面＋前の面＋背もたれ）
      return R(0, 0, 650, 340, WOOD, 14, 4) + R(0, 340, 650, 110, '#B98A55', 8, 4) +
             R(70, 450, 48, 80, '#8A8F96', 8, 0) + R(532, 450, 48, 80, '#8A8F96', 8, 0) +
             R(145, 560, 360, 220, '#D9874A', 40, 4) + R(145, 780, 360, 60, '#C9763A', 12, 4) +
             R(165, 830, 320, 60, '#B86730', 16, 3);
    } } } },
  ctable: { name: '{教卓|きょうたく}', kind: 'top', scenes: ['class'], states: {
    closed: { w: 1200, d: 600, draw: function (w, h) {   // 天板＋前の面（右に引き出し2段）
      return R(0, 0, w, h * 0.48, '#B8895A', 20, 12) + R(0, h * 0.48, w, h * 0.52, '#9A6B3F', 10, 12) +
             L(20, h * 0.48, w - 20, h * 0.48, 'rgba(0,0,0,.2)', 12) +
             R(w * 0.6, h * 0.56, w * 0.34, h * 0.16, 'rgba(0,0,0,.16)', 8, 0) + R(w * 0.6, h * 0.76, w * 0.34, h * 0.16, 'rgba(0,0,0,.16)', 8, 0);
    } } } },
  cshelf: { name: '{棚|たな}', kind: 'top', scenes: ['class'], states: {
    closed: { w: 900, d: 460, draw: function (w, h) {   // 上の面＋前の面（棚の中と仕切りが見える）
      return R(0, 0, w, h * 0.22, '#C6955E', 10, 14) + R(0, h * 0.18, w, h * 0.82, '#B98A55', 12, 14) +
             R(w * 0.05, h * 0.28, w * 0.9, h * 0.62, '#8A6238', 6, 0) +
             L(w * 0.05, h * 0.6, w * 0.95, h * 0.6, '#B98A55', 26) +
             L(w * 0.36, h * 0.28, w * 0.36, h * 0.9, '#B98A55', 24) + L(w * 0.67, h * 0.28, w * 0.67, h * 0.9, '#B98A55', 24);
    } } } },
  /* 体育館 */
  gbox: { name: '{跳|と}び{箱|ばこ}', kind: 'top', scenes: ['gym'], states: {
    closed: { w: 900, d: 1100, draw: function (w, h) {   // 台形の立体：白い天面＋下に広がる木の面（段の境目）
      return '<path d="' + roundPoly([[w * 0.15, 0], [w * 0.85, 0], [w * 0.97, h], [w * 0.03, h]], 25) + '" fill="#C9A676" stroke="' + INK + '" stroke-width="26" stroke-linejoin="round"/>' +
             '<path d="' + roundPoly([[w * 0.09, h * 0.5], [w * 0.91, h * 0.5], [w * 0.965, h * 0.985], [w * 0.035, h * 0.985]], 18) + '" fill="#B98A55"/>' +
             '<path d="' + roundPoly([[w * 0.2, h * 0.05], [w * 0.8, h * 0.05], [w * 0.88, h * 0.46], [w * 0.12, h * 0.46]], 16) + '" fill="#F7F4EA" stroke="#DDD8C8" stroke-width="12"/>' +
             L(w * 0.09, h * 0.5, w * 0.91, h * 0.5, 'rgba(0,0,0,.18)', 14) +
             L(w * 0.08, h * 0.67, w * 0.92, h * 0.67, 'rgba(0,0,0,.2)', 12) + L(w * 0.07, h * 0.83, w * 0.93, h * 0.83, 'rgba(0,0,0,.2)', 12);
    } } } },
  gboard: { name: '{踏|ふ}み{込|こ}み{台|だい}', kind: 'top', scenes: ['gym'], states: {
    closed: { w: 600, d: 1200, draw: function (w, h) {   // ロイター板：緑の面＋奥（上）は黒いバネ帯、手前に厚み
      return R(0, 0, w, h, '#4F9B4F', 20, 20) + R(0, 0, w, h * 0.15, '#33383E', 10, 0) +
             C(w * 0.2, h * 0.075, 16, '#C9CDD2', 0) + C(w * 0.5, h * 0.075, 16, '#C9CDD2', 0) + C(w * 0.8, h * 0.075, 16, '#C9CDD2', 0) +
             R(0, h * 0.88, w, h * 0.12, '#3B7A3C', 8, 0) + L(w * 0.06, h * 0.88, w * 0.94, h * 0.88, 'rgba(0,0,0,.2)', 10);
    } } } },
  gmat: { name: 'マット', kind: 'top', scenes: ['gym'],
    sizes: { s: { name: '小', w: 1800, d: 900 }, l: { name: '大', w: 2000, d: 2000 } },
    states: {
      closed: { draw: function (w, h) {   // 上の面（縫い目の破線）＋手前の厚み
        return R(0, 0, w, h, '#6B9DC7', 60, 20) + R(0, h * 0.82, w, h * 0.18, '#5A87AE', 30, 0) +
               '<rect x="' + w * 0.05 + '" y="' + h * 0.05 + '" width="' + w * 0.9 + '" height="' + h * 0.72 + '" rx="40" fill="none" stroke="#4E7FAF" stroke-width="12" stroke-dasharray="70 45"/>';
      } } } },
  gbeam: { name: '{平均台|へいきんだい}', kind: 'top', scenes: ['gym'], states: {
    closed: { w: 5000, d: 100, draw: function (w, h) {   // 台（白い端）＋2か所のA脚
      return R(w * 0.13, h * 0.45, 90, h * 0.55, '#8A8F96', 8, 0) + R(w * 0.85, h * 0.45, 90, h * 0.55, '#8A8F96', 8, 0) +
             R(0, h * 0.05, w, h * 0.45, '#C9A676', 12, 10) + R(0, h * 0.05, 55, h * 0.45, '#F5F2E8', 8, 0) + R(w - 55, h * 0.05, 55, h * 0.45, '#F5F2E8', 8, 0) +
             L(0, h * 0.5, w, h * 0.5, 'rgba(0,0,0,.15)', 8);
    } } } },
  gbar: { name: '{鉄棒|てつぼう}', kind: 'top', scenes: ['gym', 'field'], states: {
    closed: { w: 2400, d: 900, draw: function (w, h) {   // 土台・支柱2本・上にバー1本（斜め上からの正面）
      return R(w * 0.06 - 150, h * 0.74, 300, h * 0.2, '#7A7F86', 14, 12) + R(w * 0.94 - 150, h * 0.74, 300, h * 0.2, '#7A7F86', 14, 12) +
             R(w * 0.06 - 60, h * 0.18, 120, h * 0.6, '#A9AEB6', 10, 10) + R(w * 0.94 - 60, h * 0.18, 120, h * 0.6, '#A9AEB6', 10, 10) +
             R(w * 0.06, h * 0.12, w * 0.88, 90, '#C9CDD2', 45, 14, '#5F646B');
    } } } },
  gtora: { name: 'トランポリン', kind: 'top', scenes: ['gym'], states: {
    closed: { w: 1200, d: 1200, draw: function (w, h) {   // 橙のパッド枠＋黒い跳ね面＋手前の厚みと脚
      return R(w * 0.14, h * 0.86, 90, h * 0.14, '#8A8F96', 10, 0) + R(w * 0.78, h * 0.86, 90, h * 0.14, '#8A8F96', 10, 0) +
             R(0, 0, w, h * 0.92, '#E8956A', 80, 16) + R(0, h * 0.78, w, h * 0.14, '#C97A52', 20, 0) +
             R(w * 0.14, h * 0.13, w * 0.72, h * 0.56, '#3A3F45', 30, 10, '#2A2E33') +
             R(w * 0.18, h * 0.16, w * 0.64, h * 0.5, 'none', 24, 6, 'rgba(255,255,255,.18)');
    } } } },
  gball: { name: 'ボール', kind: 'top', scenes: ['gym', 'field'], colors: ['#E08A3C', '#F2C94C', '#F5F5F5'], states: {
    closed: { w: 250, d: 250, draw: function (w, h, col) {   // 床に落ちる影＋継ぎ目のある球
      return ELL(w / 2, h * 0.8, w * 0.4, h * 0.09, 'rgba(0,0,0,.16)') +
             C(w / 2, h * 0.42, w * 0.4, col, 8) +
             '<path d="M' + (w * 0.2) + ' ' + (h * 0.48) + ' Q' + (w * 0.5) + ' ' + (h * 0.26) + ' ' + (w * 0.8) + ' ' + (h * 0.48) + '" fill="none" stroke="' + INK + '" stroke-width="8"/>' +
             '<path d="M' + (w * 0.2) + ' ' + (h * 0.38) + ' Q' + (w * 0.5) + ' ' + (h * 0.6) + ' ' + (w * 0.8) + ' ' + (h * 0.38) + '" fill="none" stroke="' + INK + '" stroke-width="8"/>';
    } } } },
  gline: { name: 'ライン', kind: 'top', scenes: ['gym', 'field'], states: {
    closed: { w: 3000, d: 80, draw: function (w, h) { return R(0, 0, w, h, '#F5F2E8', 12, 8); } } } },
  /* 運動場 */
  funten: { name: 'うんてい', kind: 'top', scenes: ['field'], states: {
    closed: { w: 4500, d: 1600, draw: function (w, h) {   // 両はしの柱＋上の横梁＋等間隔に下がるつり手
      var s = R(w * 0.01 - 30, h * 0.78, 180, h * 0.2, '#6E747C', 10, 0) + R(w * 0.99 - 150, h * 0.78, 180, h * 0.2, '#6E747C', 10, 0) +
              R(w * 0.01, h * 0.06, 120, h * 0.76, '#8A8F96', 12, 10) + R(w * 0.99 - 120, h * 0.06, 120, h * 0.76, '#8A8F96', 12, 10) +
              R(0, 0, w, 90, '#8A8F96', 20, 12);
      for (var x = 500; x < w - 300; x += 500) s += L(x, 90, x, h * 0.52, '#5E6670', 45);
      return s;
    } } } },
  fsand: { name: '{砂場|すなば}', kind: 'top', scenes: ['field'], states: {
    closed: { w: 4000, d: 4000, draw: function (w, h) {   // 囲いの枠＋砂の面＋手前の枠の面
      return R(0, 0, w, h, '#B8A078', 80, 16) + R(0, h * 0.8, w, h * 0.2, '#A08B64', 30, 0) +
             R(110, 110, w - 220, h * 0.6, '#EBDCB4', 50, 10) +
             C(w * 0.32, h * 0.36, 200, '#E0CD9E', 0) + C(w * 0.66, h * 0.5, 240, '#E0CD9E', 0);
    } } } },
  ftire: { name: 'タイヤ', kind: 'top', scenes: ['field'], states: {
    closed: { w: 700, d: 700, draw: function (w, h) {
      return ELL(w / 2, h * 0.62, w * 0.46, h * 0.3, 'rgba(0,0,0,.16)') +
             '<g transform="translate(0 ' + (-h * 0.12) + ')">' + tireRing(w / 2) + '</g>';
    } } } },
  fgoal: { name: 'サッカーゴール', kind: 'top', scenes: ['field'], states: {
    closed: { w: 5000, d: 1900, draw: function (w, h) {   // 少年用 幅5m・奥行1.9m。開口は手前（下）がわ
      var s = R(0, 0, w, 90, '#F2F2F2', 10, 12) + R(0, 0, 90, h, '#F2F2F2', 10, 12) + R(w - 90, 0, 90, h, '#F2F2F2', 10, 12);
      for (var x = 300; x < w; x += 600) s += L(x, 100, x - 150, h - 120, 'rgba(120,115,105,.4)', 18);   // 網目の流れ
      return s + R(0, h - 160, 160, 160, '#FFFFFF', 10, 12) + R(w - 160, h - 160, 160, 160, '#FFFFFF', 10, 12) +
             R(0, h - 40, w, 40, 'rgba(0,0,0,.1)', 10, 0);
    } } } },
  fcone: { name: 'コーン', kind: 'top', scenes: ['field'], states: {
    closed: { w: 320, d: 320, draw: function (w, h) {   // 円すい＋台座
      return '<ellipse cx="' + w / 2 + '" cy="' + h * 0.82 + '" rx="' + w * 0.44 + '" ry="' + h * 0.1 + '" fill="#E08030" stroke="' + INK + '" stroke-width="8"/>' +
             '<path d="M' + (w * 0.24) + ' ' + (h * 0.8) + ' L' + (w * 0.46) + ' ' + (h * 0.1) + ' L' + (w * 0.54) + ' ' + (h * 0.1) + ' L' + (w * 0.76) + ' ' + (h * 0.8) + ' Z" fill="#F2994A" stroke="' + INK + '" stroke-width="8" stroke-linejoin="round"/>' +
             L(w * 0.36, h * 0.48, w * 0.64, h * 0.48, '#F5F2E8', 22);
    } } } },
  fmark: { name: 'マーカー', kind: 'top', scenes: ['field'], colors: ['#F2C94C', '#FFFFFF', '#E5484D', '#2F80ED'], states: {
    closed: { w: 200, d: 200, draw: function (w, h, col) { return C(w / 2, h / 2, w / 2 - 6, col, 6) + C(w / 2, h / 2, w * 0.14, 'rgba(255,255,255,.35)', 0); } } } },
  /* 人と列：子どもがどこに立つ・どう並ぶかを示す。列はドット（点）とライン（棒）の2種類、それぞれ1列・2列・4列 */
  person: { name: '{人|ひと}', kind: 'top', scenes: ['class', 'gym', 'field'], colors: ['#3A3F45', '#E5484D', '#2F80ED', '#F2C94C'], states: {
    normal: { w: 400, d: 500, draw: function (w, h, col) {   // あたま＋肩の広がる体のシルエット
      return ELL(w / 2, h * 0.94, w * 0.42, h * 0.05, 'rgba(0,0,0,.16)') +
             C(w / 2, h * 0.18, w * 0.24, col, 8) +
             '<path d="' + roundPoly([[w * 0.28, h * 0.4], [w * 0.72, h * 0.4], [w * 0.88, h * 0.95], [w * 0.12, h * 0.95]], 40) + '" fill="' + col + '" stroke="' + INK + '" stroke-width="8" stroke-linejoin="round"/>';
    } },
    hat: { w: 400, d: 560, draw: function (w, h, col) {   // ぼうしの形：あたまの上に丸い天板とひさし
      return ELL(w / 2, h * 0.95, w * 0.42, h * 0.05, 'rgba(0,0,0,.16)') +
             C(w / 2, h * 0.16, w * 0.26, col, 8) +                                    // ぼうしの丸い部分
             ELL(w / 2, h * 0.3, w * 0.36, h * 0.08, col) +                            // ひさし
             '<ellipse cx="' + w / 2 + '" cy="' + h * 0.3 + '" rx="' + w * 0.36 + '" ry="' + h * 0.08 + '" fill="none" stroke="' + INK + '" stroke-width="8"/>' +
             '<path d="' + roundPoly([[w * 0.28, h * 0.42], [w * 0.72, h * 0.42], [w * 0.88, h * 0.96], [w * 0.12, h * 0.96]], 40) + '" fill="' + col + '" stroke="' + INK + '" stroke-width="8" stroke-linejoin="round"/>';
    } },
    bib: { w: 400, d: 500, draw: function (w, h, col) {   // ゼッケン：体の白い四角
      return ELL(w / 2, h * 0.94, w * 0.42, h * 0.05, 'rgba(0,0,0,.16)') +
             C(w / 2, h * 0.18, w * 0.24, col, 8) +
             '<path d="' + roundPoly([[w * 0.28, h * 0.4], [w * 0.72, h * 0.4], [w * 0.88, h * 0.95], [w * 0.12, h * 0.95]], 40) + '" fill="' + col + '" stroke="' + INK + '" stroke-width="8" stroke-linejoin="round"/>' +
             R(w * 0.3, h * 0.48, w * 0.4, h * 0.34, '#F7F4EA', 8, 6);
    } } } },
  rowdot: { name: '{列|れつ}（ドット）', kind: 'top', scenes: ['class', 'gym', 'field'], colors: ['#3A3F45', '#E5484D', '#2F80ED', '#F2C94C'], states: {
    r1: { w: 500, d: 2000 }, r2: { w: 1000, d: 2000 }, r4: { w: 2000, d: 2000 } } },
  rowline: { name: '{列|れつ}（ライン）', kind: 'top', scenes: ['class', 'gym', 'field'], colors: ['#3A3F45', '#E5484D', '#2F80ED', '#F2C94C'], states: {
    r1: { w: 500, d: 2000 }, r2: { w: 1000, d: 2000 }, r4: { w: 2000, d: 2000 } } },
  rowseno: { name: '{背|せ}の{順|じゅん}ライン', kind: 'top', scenes: ['class', 'gym', 'field'], colors: ['#3A3F45', '#E5484D', '#2F80ED', '#F2C94C'], states: {
    closed: { w: 600, d: 2000, draw: function (w, h, col) {   // 太い棒＋上の端に「低」、下の端に「高」の漢字入り丸
      var r = w * 0.4;
      return L(w / 2, h * 0.16, w / 2, h * 0.84, col, 120) +
             C(w / 2, h * 0.13, r, col, 0) + C(w / 2, h * 0.13, r - 16, '#F7F4EA', 0) + T(w / 2, h * 0.11, '低', r * 0.9) +
             C(w / 2, h * 0.87, r, col, 0) + C(w / 2, h * 0.87, r - 16, '#F7F4EA', 0) + T(w / 2, h * 0.85, '高', r * 0.9);
    } } } },
  /* 矢印：形で選ぶ（向きは「回す」）。ながれる矢印は中の破線が進行方向に動く */
  arrow: { name: '{矢印|やじるし}', kind: 'top', scenes: ['class', 'gym', 'field'], states: {
    go: { w: 800, d: 3000, draw: function (w, h) {
      return arrowHead([[w * 0.32, h], [w * 0.32, h * 0.44], [0, h * 0.44], [w / 2, 0], [w, h * 0.44], [w * 0.68, h * 0.44], [w * 0.68, h]]);
    } },
    turn: { w: 2200, d: 2200, draw: function (w, h) {   // 上に進んで右に曲がる
      return arrowShaft('M ' + (w * 0.3) + ' ' + h + ' L ' + (w * 0.3) + ' ' + (h * 0.36) + ' Q ' + (w * 0.3) + ' ' + (h * 0.16) + ' ' + (w * 0.55) + ' ' + (h * 0.16) + ' L ' + (w * 0.78) + ' ' + (h * 0.16), w * 0.24) +
             arrowHead([[w * 0.58, h * 0.02], [w, h * 0.16], [w * 0.58, h * 0.3]]);
    } },
    zag: { w: 1800, d: 2600, draw: function (w, h) {   // つづら折れ（ジグザグに進む）
      return arrowShaft('M ' + (w * 0.5) + ' ' + h + ' L ' + (w * 0.85) + ' ' + (h * 0.66) + ' L ' + (w * 0.15) + ' ' + (h * 0.38) + ' L ' + (w * 0.5) + ' ' + (h * 0.17), w * 0.2) +
             arrowHead([[w * 0.2, h * 0.26], [w * 0.5, 0], [w * 0.8, h * 0.26]]);
    } },
    flow: { w: 900, d: 3200, draw: function (w, h) {   // 太い矢印の中を白い破線が進行方向に流れる
      return '<path d="' + roundPoly([[w * 0.18, h], [w * 0.18, h * 0.4], [0, h * 0.4], [w / 2, 0], [w, h * 0.4], [w * 0.82, h * 0.4], [w * 0.82, h]], 50) + '" fill="' + ARROW + '" stroke="' + INK + '" stroke-width="50" stroke-linejoin="round"/>' +
             '<line x1="' + (w / 2) + '" y1="' + (h * 0.93) + '" x2="' + (w / 2) + '" y2="' + (h * 0.16) + '" stroke="#FFF" stroke-width="' + (w * 0.14) + '" stroke-dasharray="' + (w * 0.22) + ' ' + (w * 0.16) + '" stroke-linecap="round">' +
             '<animate attributeName="stroke-dashoffset" from="' + (w * 0.38) + '" to="0" dur="0.9s" repeatCount="indefinite"/></line>';
    } } } },

  kyushoku: { name: '{給食袋|きゅうしょくぶくろ}', kind: 'hang', side: [200, 260], t: 40, color: '#F2B8B5', style: 'string' },
  taisou:   { name: '{体操服|たいそうふく}', kind: 'hang', side: [350, 400], t: 50, color: '#7FB8A6', style: 'string' },
  uwabaki:  { name: '{上|うわ}ばき', kind: 'hang', side: [220, 320], t: 60, color: '#B9A6D9', style: 'string' },
  tesage:   { name: '{手|て}さげ', kind: 'hang', side: [320, 300], t: 50, color: '#D8C49A', style: 'handle' },
  shodobag: { name: '{習字|しゅうじ}バッグ', kind: 'hang', side: [350, 240], t: 60, color: '#3E4F7A', style: 'handle' },
  enogubag: { name: '{絵|え}の{具|ぐ}セット', kind: 'hang', side: [325, 140], t: 140, color: '#2B2F36', style: 'box' }
};

/* 列（ドット・ライン）の絵は、列の数だけ点や棒を等間隔に並べて作る（1列・2列・4列共通） */
(function () {
  var COLS = { r1: 1, r2: 2, r4: 4 };
  ['rowdot', 'rowline'].forEach(function (id) {
    Object.keys(ITEMS[id].states).forEach(function (k) {
      var n = COLS[k];
      ITEMS[id].states[k].draw = function (w, h, col) {
        var s = '', i, j;
        for (i = 0; i < n; i++) {
          var cx = w * (i + 0.5) / n;
          if (id === 'rowline') s += L(cx, h * 0.08, cx, h * 0.92, col, 140);
          else for (j = 0; j < 4; j++) s += C(cx, h * (j + 0.5) / 4, 100, col, 10);
        }
        return s;
      };
    });
  });
})();

/* ---- 置き場所のグリッド ----
   物の中心は、床を等分した線の交点、および床の外に「あらい」1目分広げた交点にだけ置ける
   （本が半分だけ机に乗る配置のため）。細かい段は粗い段の交点をすべて含む
   （分割数が2倍ずつ）ので、段を切り替えても置いた物はずれない。
   GRID_LEVELS は SCENES.grid を useScene で切り替える（上の「場所」節を参照）。 */
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
      { item: 'pencase', state: 'closed', x: gx(10), y: gy(2), r: 90 },
      { item: 'pencil', state: 'closed', x: gx(10), y: gy(6), r: 0 },
      { item: 'redpencil', state: 'closed', x: gx(21, 24), y: gy(6), r: 0 },
      { item: 'eraser', state: 'closed', x: gx(11), y: gy(7), r: 0 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'taisou' }] },
    away: [{ item: 'drill', place: 'tray' }, { item: 'renraku', place: 'tray' }] },
  { id: 'kokugo', name: '国語', yomi: 'こくご', flip: true,
    top: [
      { item: 'textbook', state: 'open', x: gx(5), y: gy(2), r: 0 },
      { item: 'notebook', state: 'open', x: gx(5), y: gy(6), r: 0, color: 1 },
      { item: 'pencase', state: 'closed', x: gx(10), y: gy(2), r: 90 },
      { item: 'pencil', state: 'closed', x: gx(10), y: gy(6), r: 0 },
      { item: 'redpencil', state: 'closed', x: gx(21, 24), y: gy(6), r: 0 },
      { item: 'eraser', state: 'closed', x: gx(11), y: gy(7), r: 0 }
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
  { id: 'pc', name: 'タブレット', yomi: '', flip: true,
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
    away: [{ item: 'pencase', place: 'tray' }, { item: 'textbook', place: 'tray' }, { item: 'notebook', place: 'tray' }] },
  { id: 'zukei', name: '算数（図形）', yomi: 'さんすう（ずけい）', flip: true,
    top: [
      { item: 'notebook', state: 'open', x: gx(4), y: gy(5), r: 0, color: 0 },
      { item: 'protractor', state: 'closed', x: gx(4), y: gy(1), r: 0 },
      { item: 'tri45', state: 'closed', x: gx(9), y: gy(2), r: 0 },
      { item: 'tri60', state: 'closed', x: gx(11), y: gy(5), r: 0 },
      { item: 'compass', state: 'closed', x: gx(8), y: gy(5), r: 0 },
      { item: 'pencil', state: 'closed', x: gx(9), y: gy(6), r: 0 },
      { item: 'eraser', state: 'closed', x: gx(8), y: gy(7), r: 0 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'taisou' }] },
    away: [{ item: 'pencase', place: 'tray' }, { item: 'textbook', place: 'tray' }] },
  { id: 'print', name: 'プリント', yomi: '', flip: true,
    top: [
      { item: 'print', state: 'closed', x: gx(5), y: gy(4), r: 0, size: 'b4', text: '漢字①' },
      { item: 'pencil', state: 'closed', x: gx(9), y: gy(4), r: 0 },
      { item: 'redpencil', state: 'closed', x: gx(19, 24), y: gy(4), r: 0 },
      { item: 'eraser', state: 'closed', x: gx(11), y: gy(6), r: 0 }
    ],
    hooks: { left: [{ item: 'kyushoku' }], right: [{ item: 'taisou' }] },
    away: [{ item: 'pencase', place: 'tray' }, { item: 'textbook', place: 'tray' }, { item: 'notebook', place: 'tray' }] },

  /* ---- 場所モードの標準配置（座標はその場所の「こまかい」交点上、単位 mm） ---- */
  { id: 'c_basic', scene: 'class', name: '4列20人', yomi: 'よんれつにじゅうにん', flip: true,
    top: (function () {
      var t = [];
      [1000, 2250, 3500, 4750, 6000].forEach(function (x) {
        [3250, 4500, 5750, 7000].forEach(function (y) { t.push({ item: 'cdesk', state: 'closed', x: x, y: y, r: 0 }); });
      });
      t.push({ item: 'ctable', state: 'closed', x: 3500, y: 1250, r: 0 });
      t.push({ item: 'cshelf', state: 'closed', x: 6500, y: 7250, r: 90 });
      t.push({ item: 'cshelf', state: 'closed', x: 6500, y: 8250, r: 90 });
      return t;
    })(),
    hooks: { left: [], right: [] }, away: [] },
  { id: 'g_tobibako', scene: 'gym', name: '跳び箱の準備', yomi: 'とびばこのじゅんび', flip: true,
    top: [
      { item: 'gbox',   state: 'closed', x: 10000, y: 8750,  r: 0 },
      { item: 'gmat',   state: 'closed', x: 10000, y: 6250,  r: 0, size: 'l' },
      { item: 'gmat',   state: 'closed', x: 6250,  y: 8750,  r: 90 },
      { item: 'gmat',   state: 'closed', x: 13750, y: 8750,  r: 90 },
      { item: 'gboard', state: 'closed', x: 10000, y: 10000, r: 0 },
      { item: 'arrow',  state: 'go',     x: 10000, y: 16250, r: 0, label: true },
      { item: 'person', state: 'normal', x: 11250, y: 17500, r: 0 }
    ],
    hooks: { left: [], right: [] }, away: [] },
  { id: 'f_undoukai', scene: 'field', name: 'うんどうかい', yomi: 'うんどうかい', flip: true,
    top: [
      { item: 'fgoal',  state: 'closed', x: 20000, y: 1250,  r: 0 },
      { item: 'fcone',  state: 'closed', x: 12500, y: 12500, r: 0 },
      { item: 'fcone',  state: 'closed', x: 17500, y: 12500, r: 0 },
      { item: 'fcone',  state: 'closed', x: 22500, y: 12500, r: 0 },
      { item: 'fcone',  state: 'closed', x: 27500, y: 12500, r: 0 },
      { item: 'fmark',  state: 'closed', x: 15000, y: 15000, r: 0 },
      { item: 'fmark',  state: 'closed', x: 20000, y: 15000, r: 0 },
      { item: 'fmark',  state: 'closed', x: 25000, y: 15000, r: 0 },
      { item: 'fmark',  state: 'closed', x: 30000, y: 15000, r: 0 },
      { item: 'funten', state: 'closed', x: 7500,  y: 45000, r: 0 },
      { item: 'gbar',   state: 'closed', x: 15000, y: 47500, r: 0 },
      { item: 'ftire',  state: 'closed', x: 6250,  y: 52500, r: 0 },
      { item: 'fsand',  state: 'closed', x: 30000, y: 50000, r: 0 },
      { item: 'gline',  state: 'closed', x: 20000, y: 40000, r: 0 },
      { item: 'arrow',  state: 'flow',   x: 20000, y: 35000, r: 90 }
    ],
    hooks: { left: [], right: [] }, away: [] }
];

/* ===== 描画：配置データ → SVG 文字列 =====
   画面（DOM）には触らない。app.js とテストの両方が使う。 */

var WOOD = '#C8925C', WOOD_EDGE = '#8E6237', TRAY = '#A19E95', TRAY_IN = '#4E4C47', PIPE = '#B8B3A7';
var LABEL_FS = 46, LABEL_PAD = 10, LABEL_GAP = 34;
var VIEW_GAP = 70;   // 図と図のあいだ
var SIDE_SCALE = 0.6; // 横から見た図の縮尺。主役は上から見た図なので小さくする

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* ---- 名前とふりがな ---- */
function parseName(name) {
  var out = [], re = /\{([^|}]+)\|([^}]+)\}|([^{]+)/g, m;
  while ((m = re.exec(name))) out.push(m[3] != null ? { b: m[3], r: '' } : { b: m[1], r: m[2] });
  return out;
}
function plainName(name) { return parseName(name).map(function (s) { return s.b; }).join(''); }
function charW(ch, fs) { return /[\x20-\x7e]/.test(ch) ? fs * 0.6 : fs; }
function textW(s, fs) { var w = 0; for (var i = 0; i < s.length; i++) w += charW(s[i], fs); return w; }
function nameMetrics(name, fs, ruby) {
  var segs = parseName(name), w = 0;
  segs.forEach(function (s) { w += textW(s.b, fs); });
  var hasRuby = ruby && segs.some(function (s) { return s.r; });
  return { w: w, h: fs * 1.15 + (hasRuby ? fs * 0.55 : 0), rubyH: hasRuby ? fs * 0.55 : 0 };
}
/* 左上 (x,y) から名前を書く。ふりがなは各漢字のかたまりの上に、はみ出すときは詰める */
function nameSvg(name, x, y, fs, ruby) {
  var m = nameMetrics(name, fs, ruby), base = y + m.rubyH + fs * 0.9, rfs = fs * 0.48, cx = x, s = '';
  parseName(name).forEach(function (seg) {
    var bw = textW(seg.b, fs);
    s += '<text x="' + cx + '" y="' + base + '" font-size="' + fs + '" class="lb">' + esc(seg.b) + '</text>';
    if (ruby && seg.r) {
      var rw = Math.min(textW(seg.r, rfs), bw + fs * 0.3);
      s += '<text x="' + (cx + bw / 2) + '" y="' + (base - fs * 0.98) + '" font-size="' + rfs + '" text-anchor="middle" class="rb" textLength="' + rw +
           '" lengthAdjust="spacingAndGlyphs">' + esc(seg.r) + '</text>';
    }
    cx += bw;
  });
  return s;
}
/* 吹き出しの箱。(cx,cy) が箱の中心 */
function labelBoxSize(name, ruby) {
  var m = nameMetrics(name, LABEL_FS, ruby);
  return { w: m.w + LABEL_PAD * 2, h: m.h + LABEL_PAD * 2 };
}
function labelBox(name, cx, cy, ruby) {
  var b = labelBoxSize(name, ruby), x = cx - b.w / 2, y = cy - b.h / 2;
  return '<rect x="' + x + '" y="' + y + '" width="' + b.w + '" height="' + b.h + '" rx="12" class="lbox"/>' +
         nameSvg(name, x + LABEL_PAD, y + LABEL_PAD, LABEL_FS, ruby);
}

/* ---- 用具の形 ---- */
function stateOf(p) {
  var st = ITEMS[p.item].states;
  return st[p.state] ? p.state : 'closed';
}
function itemSize(p) {
  var s = ITEMS[p.item].states[stateOf(p)];
  return [s.w, s.d];
}
/* 回転したときの外接箱の幅・奥行き */
function rotBox(w, d, r) {
  var a = r * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  return [w * c + d * s, w * s + d * c];
}
function drawTopItem(p, i, cls) {
  var st = ITEMS[p.item].states[stateOf(p)], w = st.w, d = st.d;
  return '<g class="it' + (cls ? ' ' + cls : '') + '" data-i="' + i + '" transform="translate(' + p.x + ' ' + p.y + ') rotate(' + (p.r || 0) + ')' +
         (p.m ? ' scale(-1 1)' : '') + '"><g transform="translate(' + (-w / 2) + ' ' + (-d / 2) + ')">' + st.draw(w, d) +
         (cls === 'sel' ? '<rect class="selbox" x="-10" y="-10" width="' + (w + 20) + '" height="' + (d + 20) + '" rx="10"/>' : '') + '</g></g>';
}
function iconSvg(itemId, size) {   // しまう物・編集のパレット用の小さな絵
  var it = ITEMS[itemId], w, d, body;
  if (it.kind === 'hang') { w = it.side[0]; d = it.side[1] + 80; body = '<g transform="translate(' + w / 2 + ' 4)">' + hangFace(it) + '</g>'; }
  else { var s = it.states.closed; w = s.w; d = s.d; body = s.draw(w, d); }
  var pad = 8;
  return '<svg viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (w + pad * 2) + ' ' + (d + pad * 2) + '" width="' + size + '" height="' + size + '" aria-hidden="true">' + body + '</svg>';
}

/* ---- 左右反転：x を鏡にし、左右のフックを入れ替える ---- */
function flipLayout(lay) {
  var c = JSON.parse(JSON.stringify(lay));
  c.top = lay.top.map(function (p) {
    var q = Object.assign({}, p);
    q.x = DESK.w - p.x; q.r = p.r ? -p.r : 0; q.m = !p.m;
    return q;
  });
  c.hooks = { left: (lay.hooks.right || []).slice(), right: (lay.hooks.left || []).slice() };
  return c;
}

/* ---- 上から見た図（机1台、机の左上が原点） ---- */
function deskTopSvg() {
  return '<rect x="0" y="0" width="' + DESK.w + '" height="' + DESK.d + '" rx="14" fill="' + WOOD + '" stroke="' + WOOD_EDGE + '" stroke-width="6"/>' +
         '<rect x="-10" y="' + (DESK.hookY - 9) + '" width="10" height="18" rx="3" fill="' + PIPE + '" stroke="' + INK + '" stroke-width="2"/>' +
         '<rect x="' + DESK.w + '" y="' + (DESK.hookY - 9) + '" width="10" height="18" rx="3" fill="' + PIPE + '" stroke="' + INK + '" stroke-width="2"/>';
}
function chairTopSvg() {
  var x = (DESK.w - CHAIR.w) / 2, y = DESK.d + CHAIR.gap;
  return '<g class="chair"><rect x="' + x + '" y="' + y + '" width="' + CHAIR.w + '" height="' + CHAIR.d + '" rx="40" fill="#D9874A" stroke="' + INK + '" stroke-width="3"/>' +
         '<rect x="' + (x + 20) + '" y="' + (y + CHAIR.d - 10) + '" width="' + (CHAIR.w - 40) + '" height="36" rx="14" fill="#C9763A" stroke="' + INK + '" stroke-width="3"/></g>';
}
function chairExtent() { return CHAIR.gap + CHAIR.d + 30; }

/* 名前の吹き出しを机の外の余白に並べる。sides: 使ってよい辺 */
function spread(list, lo, hi, gap) {
  list.sort(function (a, b) { return a.pref - b.pref; });
  var cur = lo;
  list.forEach(function (a) { a.pos = Math.max(a.pref, cur + a.size / 2); cur = a.pos + a.size / 2 + gap; });
  var lim = hi;
  for (var i = list.length - 1; i >= 0; i--) {
    var a = list[i];
    if (a.pos + a.size / 2 > lim) a.pos = lim - a.size / 2;
    lim = a.pos - a.size / 2 - gap;
  }
}
function layoutLabels(top, sides, ruby, bottomStart) {
  var groups = { L: [], R: [], T: [], B: [] };
  top.forEach(function (p, i) {
    if (!p.label) return;
    var name = ITEMS[p.item].name, box = labelBoxSize(name, ruby);
    var dist = { L: p.x, R: DESK.w - p.x, T: p.y, B: DESK.d - p.y }, best = null;
    sides.forEach(function (s) { if (best == null || dist[s] < dist[best]) best = s; });
    var vert = best === 'L' || best === 'R';
    groups[best].push({ i: i, p: p, name: name, box: box, pref: vert ? p.y : p.x, size: vert ? box.h : box.w });
  });
  var out = [], m = { L: 0, R: 0, T: 0, B: 0 };
  Object.keys(groups).forEach(function (s) {
    var g = groups[s];
    if (!g.length) return;
    var vert = s === 'L' || s === 'R';
    var span = vert ? DESK.d : DESK.w;
    spread(g, vert ? -40 : -200, vert ? span + 40 : span + 200, 12);
    g.forEach(function (a) {
      var cx, cy;
      if (s === 'L') { cx = -LABEL_GAP - a.box.w / 2; cy = a.pos; m.L = Math.max(m.L, a.box.w + LABEL_GAP); }
      if (s === 'R') { cx = DESK.w + LABEL_GAP + a.box.w / 2; cy = a.pos; m.R = Math.max(m.R, a.box.w + LABEL_GAP); }
      if (s === 'T') { cx = a.pos; cy = -LABEL_GAP - a.box.h / 2; m.T = Math.max(m.T, a.box.h + LABEL_GAP); }
      if (s === 'B') { cx = a.pos; cy = bottomStart + LABEL_GAP + a.box.h / 2; m.B = Math.max(m.B, a.box.h + LABEL_GAP); }
      var ax = s === 'L' ? cx + a.box.w / 2 : s === 'R' ? cx - a.box.w / 2 : cx;
      var ay = s === 'T' ? cy + a.box.h / 2 : s === 'B' ? cy - a.box.h / 2 : cy;
      out.push({ i: a.i, side: s, name: a.name, cx: cx, cy: cy, ax: ax, ay: ay, tx: a.p.x, ty: a.p.y, box: a.box });
    });
  });
  return { labels: out, margin: m };
}
function labelsSvg(labels, ruby) {
  var lines = '', boxes = '';
  labels.forEach(function (l) {
    lines += '<line x1="' + l.ax + '" y1="' + l.ay + '" x2="' + l.tx + '" y2="' + l.ty + '" class="lead-halo"/>' +
             '<line x1="' + l.ax + '" y1="' + l.ay + '" x2="' + l.tx + '" y2="' + l.ty + '" class="lead"/>' +
             '<circle cx="' + l.tx + '" cy="' + l.ty + '" r="9" class="lead-dot"/>';
    boxes += labelBox(l.name, l.cx, l.cy, ruby);
  });
  return '<g class="labels">' + lines + boxes + '</g>';
}

/* 上から見た机1台。返す box は描いた範囲（ラベル込み） */
function topView(lay, o) {
  var sides = o.sides || ['L', 'R', 'T'].concat(o.chair ? [] : ['B']);
  var bottom = DESK.d + (o.chair ? chairExtent() : 0);
  var lab = o.noLabels ? { labels: [], margin: { L: 0, R: 0, T: 0, B: 0 } } : layoutLabels(lay.top, sides, o.ruby, bottom);
  var s = deskTopSvg() + (o.chair ? chairTopSvg() : '');
  lay.top.forEach(function (p, i) { s += drawTopItem(p, i, o.sel === i ? 'sel' : ''); });
  s += labelsSvg(lab.labels, o.ruby);
  var m = lab.margin;
  return { svg: s, labels: lab.labels, box: { x0: -Math.max(m.L, 20), y0: -Math.max(m.T, 20), x1: DESK.w + Math.max(m.R, 20), y1: bottom + Math.max(m.B, 20) } };
}

/* ---- 横から見た図 ----
   u: 横方向（その面に立って見たときの左→右）、v: 天板の上面から下へ */
function hangFace(it) {
  var w = it.side[0], h = it.side[1], c = it.color, s;
  if (it.style === 'handle') {
    s = '<path d="M' + (-w * 0.28) + ' 74 Q0 -36 ' + (w * 0.28) + ' 74" fill="none" stroke="' + INK + '" stroke-width="12" stroke-linecap="round"/>' +
        '<path d="M' + (-w * 0.28) + ' 74 Q0 -36 ' + (w * 0.28) + ' 74" fill="none" stroke="' + c + '" stroke-width="6" stroke-linecap="round"/>' +
        R(-w / 2, 70, w, h, c, 14) + L(-w / 2 + 16, 104, w / 2 - 16, 104, 'rgba(0,0,0,.25)', 3);
  } else {
    s = L(0, 0, -w * 0.22, 66, INK, 4) + L(0, 0, w * 0.22, 66, INK, 4) +
        '<path d="M' + (-w / 2) + ' ' + (70 + h) + ' L' + (-w / 2) + ' 92 Q' + (-w / 2) + ' 64 ' + (-w * 0.24) + ' 64 L' + (w * 0.24) + ' 64 Q' + (w / 2) + ' 64 ' + (w / 2) +
        ' 92 L' + (w / 2) + ' ' + (70 + h) + ' Z" fill="' + c + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
        L(-w / 2 + 14, 82, w / 2 - 14, 82, 'rgba(0,0,0,.25)', 3);
  }
  return s;
}
function hangBottom(it) { return 70 + it.side[1]; }

function elevation(view, lay, o) {
  var side = view === 'left' || view === 'right';
  var W = side ? DESK.d : DESK.w, s = '', cap = { left: 'ひだりから', right: 'みぎから', front: 'こくばんがわから', back: 'うしろから' }[view];
  // 脚は、いちばん下まで垂れる物の少し下で切る
  var crop = 260;
  SIDES.forEach(function (sd) { (lay.hooks[sd] || []).forEach(function (h) { crop = Math.max(crop, DESK.hookV + hangBottom(ITEMS[h.item]) + 40); }); });
  if (o.chair) crop = Math.max(crop, CHAIR.seatV + 80);
  var u0 = 0, u1 = W, v1 = crop, labels = [];
  // 机
  var legs = side ? [DESK.legInset, W - DESK.legInset] : [DESK.legInset, W - DESK.legInset];
  legs.forEach(function (u) { s += '<rect x="' + (u - 11) + '" y="' + DESK.top + '" width="22" height="' + (crop - DESK.top) + '" fill="' + PIPE + '" stroke="' + INK + '" stroke-width="2"/>'; });
  s += '<rect x="' + DESK.legInset + '" y="150" width="' + (W - DESK.legInset * 2) + '" height="14" rx="6" fill="' + PIPE + '" stroke="' + INK + '" stroke-width="2"/>';
  s += R(DESK.trayInset, DESK.trayV, W - DESK.trayInset * 2, DESK.trayH, TRAY, 6, 2.5);
  if (view === 'back') s += R(DESK.trayInset + 16, DESK.trayV + 12, W - DESK.trayInset * 2 - 32, DESK.trayH - 22, TRAY_IN, 4, 2);
  s += R(-6, 0, W + 12, DESK.top, WOOD, 6, 3, WOOD_EDGE);

  // 椅子（児童がわ）
  var chairU = null;
  if (o.chair) {
    if (view === 'left') chairU = [DESK.d + CHAIR.gap, DESK.d + CHAIR.gap + CHAIR.d];
    if (view === 'right') chairU = [-CHAIR.gap - CHAIR.d, -CHAIR.gap];
    if (chairU) {
      var back = view === 'left' ? chairU[1] - 20 : chairU[0];
      s += '<g class="chair"><rect x="' + chairU[0] + '" y="' + CHAIR.seatV + '" width="' + CHAIR.d + '" height="18" rx="8" fill="#D9874A" stroke="' + INK + '" stroke-width="3"/>' +
           '<rect x="' + back + '" y="' + CHAIR.backV + '" width="20" height="140" rx="8" fill="#D9874A" stroke="' + INK + '" stroke-width="3"/>' +
           '<rect x="' + (back + 6) + '" y="' + (CHAIR.backV + 140) + '" width="8" height="' + (crop - CHAIR.backV - 140) + '" fill="' + PIPE + '"/>' +
           '<rect x="' + (chairU[0] + 20) + '" y="' + (CHAIR.seatV + 18) + '" width="12" height="' + (crop - CHAIR.seatV - 18) + '" fill="' + PIPE + '" stroke="' + INK + '" stroke-width="2"/>' +
           '<rect x="' + (chairU[1] - 32) + '" y="' + (CHAIR.seatV + 18) + '" width="12" height="' + (crop - CHAIR.seatV - 18) + '" fill="' + PIPE + '" stroke="' + INK + '" stroke-width="2"/></g>';
      u0 = Math.min(u0, chairU[0]); u1 = Math.max(u1, chairU[1]);
    }
    if (view === 'back') {
      var cx0 = (W - CHAIR.w) / 2;
      s += '<g class="chair ghost"><rect x="' + cx0 + '" y="' + CHAIR.backV + '" width="' + CHAIR.w + '" height="140" rx="20" fill="#D9874A" stroke="' + INK + '" stroke-width="3"/>' +
           '<rect x="' + cx0 + '" y="' + CHAIR.seatV + '" width="' + CHAIR.w + '" height="18" rx="8" fill="#D9874A" stroke="' + INK + '" stroke-width="3"/></g>';
    }
  }

  // フックと掛ける物
  var hookU = view === 'left' ? DESK.hookY : view === 'right' ? DESK.d - DESK.hookY : null;
  if (side) {
    var list = lay.hooks[view] || [];
    list.forEach(function (h, k) {
      var it = ITEMS[h.item], hu = hookU + k * 18;
      s += '<g transform="translate(' + hu + ' ' + DESK.hookV + ')">' + hangFace(it) + '</g>';
      u0 = Math.min(u0, hu - it.side[0] / 2); u1 = Math.max(u1, hu + it.side[0] / 2);
      v1 = Math.max(v1, DESK.hookV + hangBottom(it) + 20);
      if (h.label) labels.push({ name: it.name, cx: hu, bottom: DESK.hookV + hangBottom(it) });
    });
    s += '<path d="M' + (hookU - 8) + ' ' + DESK.top + ' v' + (DESK.hookV - DESK.top + 6) + ' q8 10 16 0" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>';
  } else {
    // 正面・背面：掛けた物は横向き（厚みだけ）に見える
    var ends = view === 'back' ? { left: 0, right: W } : { left: W, right: 0 };
    SIDES.forEach(function (sd) {
      var edge = ends[sd], dir = edge === 0 ? -1 : 1, off = 0;
      (lay.hooks[sd] || []).forEach(function (h) {
        var it = ITEMS[h.item], a = edge + dir * off, b = edge + dir * (off + it.t);
        s += L(edge + dir * 6, DESK.hookV, (a + b) / 2, DESK.hookV + 66, INK, 4) +
             R(Math.min(a, b), DESK.hookV + 64, it.t, it.side[1] + 6, it.color, 10);
        off += it.t + 6;
        u0 = Math.min(u0, Math.min(a, b) - 10); u1 = Math.max(u1, Math.max(a, b) + 10);
        v1 = Math.max(v1, DESK.hookV + hangBottom(it) + 20);
      });
      s += '<rect x="' + (edge === 0 ? -14 : edge) + '" y="' + (DESK.hookV - 8) + '" width="14" height="16" rx="3" fill="' + PIPE + '" stroke="' + INK + '" stroke-width="2"/>';
    });
  }
  // 脚の下は切った印
  s += '<line x1="' + (u0 - 10) + '" y1="' + crop + '" x2="' + (u1 + 10) + '" y2="' + crop + '" class="cut"/>';

  // 名前（掛けた物の下）
  labels.forEach(function (l, k) {
    // 図ごと SIDE_SCALE で縮むので、名前はその分大きく描いて上から見た図の名前とそろえる
    var K = 1 / SIDE_SCALE, b0 = labelBoxSize(l.name, o.ruby), b = { w: b0.w * K, h: b0.h * K };
    var cy = l.bottom + 22 + b.h / 2 + k * (b.h + 10);
    s += '<g transform="translate(' + l.cx + ' ' + cy + ') scale(' + K + ')">' + labelBox(l.name, 0, 0, o.ruby) + '</g>';
    u0 = Math.min(u0, l.cx - b.w / 2); u1 = Math.max(u1, l.cx + b.w / 2);
    v1 = Math.max(v1, cy + b.h / 2 + 10);
  });
  // 見出し
  var capFs = 44;
  s += '<text x="' + ((u0 + u1) / 2) + '" y="' + (-capFs * 0.9) + '" font-size="' + capFs + '" text-anchor="middle" class="cap">' + cap + '</text>';
  return { svg: s, box: { x0: u0, y0: -capFs * 2, x1: u1, y1: v1 } };
}
function hasHang(lay, sd) { return (lay.hooks[sd] || []).length > 0; }

/* ---- 1台の机：中央に上から見た図、まわりに横から見た図 ---- */
function place(part, dx, dy, k) {
  k = k || 1;
  return { svg: '<g transform="translate(' + dx + ' ' + dy + ')' + (k !== 1 ? ' scale(' + k + ')' : '') + '">' + part.svg + '</g>',
           box: { x0: part.box.x0 * k + dx, y0: part.box.y0 * k + dy, x1: part.box.x1 * k + dx, y1: part.box.y1 * k + dy } };
}
function bounds(parts) {
  var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  parts.forEach(function (p) { b.x0 = Math.min(b.x0, p.box.x0); b.y0 = Math.min(b.y0, p.box.y0); b.x1 = Math.max(b.x1, p.box.x1); b.y1 = Math.max(b.y1, p.box.y1); });
  return b;
}
function composeSingle(lay, o) {
  var L0 = o.flip ? flipLayout(lay) : lay;
  var top = topView(L0, o), parts = [place(top, 0, 0)], tb = top.box;
  var cy = DESK.d / 2;
  var k = SIDE_SCALE, mid = DESK.w / 2 * (1 - k);
  if (hasHang(L0, 'left')) { var e = elevation('left', L0, o); parts.push(place(e, tb.x0 - VIEW_GAP - e.box.x1 * k, cy - (e.box.y0 + e.box.y1) * k / 2, k)); }
  if (hasHang(L0, 'right')) { var f = elevation('right', L0, o); parts.push(place(f, tb.x1 + VIEW_GAP - f.box.x0 * k, cy - (f.box.y0 + f.box.y1) * k / 2, k)); }
  if (hasHang(L0, 'left') || hasHang(L0, 'right')) {
    var fr = elevation('front', L0, o); parts.push(place(fr, mid, tb.y0 - VIEW_GAP - fr.box.y1 * k, k));
    var bk = elevation('back', L0, o); parts.push(place(bk, mid, tb.y1 + VIEW_GAP - bk.box.y0 * k, k));
  }
  return finish(parts);
}

/* ---- 4人グループ：2台ずつ向かい合わせ。手前の2台は1台表示と同じ向き ----
   掛ける物は、机どうしがくっつく内がわのフックには掛けられないので、外がわのフックに寄せて描く */
var GROUP = [
  { key: 'bl', dx: 0, dy: DESK.d, rot: 0, outer: 'left' },
  { key: 'br', dx: DESK.w, dy: DESK.d, rot: 0, outer: 'right' },
  { key: 'tl', dx: DESK.w, dy: DESK.d, rot: 180, outer: 'right' },
  { key: 'tr', dx: DESK.w * 2, dy: DESK.d, rot: 180, outer: 'left' }
];
function hangTopSvg(lay, outer) {
  var all = (lay.hooks.left || []).concat(lay.hooks.right || []), s = '', off = 0;
  all.forEach(function (h) {
    var it = ITEMS[h.item], w = it.side[0];
    var x = outer === 'left' ? -10 - off - it.t : DESK.w + 10 + off;
    s += R(x, DESK.hookY - w / 2, it.t, w, it.color, 8);
    off += it.t + 4;
  });
  return s;
}
function composeGroup(lay, o) {
  var L0 = o.flip ? flipLayout(lay) : lay, parts = [];
  GROUP.forEach(function (g) {
    var isLabelled = g.key === 'bl';
    var v = topView(L0, { ruby: o.ruby, chair: o.chair, noLabels: !isLabelled, sides: o.chair ? ['L'] : ['L', 'B'] });
    var svg = hangTopSvg(L0, g.outer) + v.svg;
    var tr = g.rot ? 'translate(' + g.dx + ' ' + g.dy + ') rotate(180)' : 'translate(' + g.dx + ' ' + g.dy + ')';
    var hangW = 220, b = v.box;
    var box = g.rot
      ? { x0: g.dx - DESK.w - (g.outer === 'right' ? hangW : 0), y0: g.dy - b.y1, x1: g.dx + (g.outer === 'left' ? hangW : 0), y1: g.dy }
      : { x0: g.dx + Math.min(b.x0, g.outer === 'left' ? -hangW : 0), y0: g.dy, x1: g.dx + Math.max(b.x1, g.outer === 'right' ? DESK.w + hangW : DESK.w), y1: g.dy + b.y1 };
    parts.push({ svg: '<g transform="' + tr + '">' + svg + '</g>', box: box });
  });
  return finish(parts);
}
function finish(parts) {
  var b = bounds(parts), pad = 30;
  return {
    viewBox: (b.x0 - pad) + ' ' + (b.y0 - pad) + ' ' + (b.x1 - b.x0 + pad * 2) + ' ' + (b.y1 - b.y0 + pad * 2),
    svg: parts.map(function (p) { return p.svg; }).join('')
  };
}

/* ===== 画面と保存 ===== */
var KEY = 'desk-layout.v1';
var $ = function (id) { return document.getElementById(id); };

/* ---- 保存：この端末のブラウザだけ。読めない環境では標準の配置で動く ---- */
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function freshState() {
  return { layouts: clone(DEFAULT_LAYOUTS), recent: [], prefs: { group: false, chair: false, ruby: true, grid: 'normal' } };
}
function load() {
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var s = JSON.parse(raw);
      if (s && Array.isArray(s.layouts)) return sanitize(s);
    }
  } catch (e) { /* 読めなければ標準へ */ }
  return freshState();
}
/* 知らない用具・壊れた値を落とす（読み込んだファイルにも使う） */
function sanitize(s) {
  var base = freshState();
  var layouts = (s.layouts || []).filter(function (l) { return l && l.id && Array.isArray(l.top); }).map(function (l) {
    return {
      id: String(l.id), name: String(l.name || '無題'), yomi: String(l.yomi || ''), flip: l.flip !== false,
      top: l.top.filter(function (p) { return ITEMS[p.item] && ITEMS[p.item].kind === 'top'; }).map(function (p) {
        return { item: p.item, state: ITEMS[p.item].states[p.state] ? p.state : 'closed', x: +p.x || DESK.w / 2, y: +p.y || DESK.d / 2, r: +p.r || 0, label: !!p.label,
                 size: ITEMS[p.item].sizes && ITEMS[p.item].sizes[p.size] ? p.size : undefined, color: ITEMS[p.item].colors ? (p.color | 0) : undefined };
      }),
      hooks: {
        left: ((l.hooks || {}).left || []).filter(isHang).map(function (h) { return { item: h.item, label: !!h.label }; }),
        right: ((l.hooks || {}).right || []).filter(isHang).map(function (h) { return { item: h.item, label: !!h.label }; })
      },
      away: (l.away || []).filter(function (a) { return ITEMS[a.item] && PLACES.some(function (p) { return p.id === a.place; }); })
        .map(function (a) { return { item: a.item, place: a.place, label: !!a.label }; })
    };
  });
  return { layouts: layouts, recent: Array.isArray(s.recent) ? s.recent.map(String) : [], prefs: Object.assign(base.prefs, s.prefs || {}) };
}
function isHang(h) { return h && ITEMS[h.item] && ITEMS[h.item].kind === 'hang'; }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('この端末には保存できません（書き出しで残してください）'); }
}

var S = load();
var cur = null;          // 表示・編集中の配置
var flip = false;        // 左右反転はその場かぎり（保存しない）
var sel = -1;            // 編集で選んでいる机の上の物
var tab = 'top', dest = { hang: 'left', away: 'tray' };

function byId(id) { return S.layouts.filter(function (l) { return l.id === id; })[0]; }
function rubyHtml(name, yomi) {
  return yomi && S.prefs.ruby ? '<ruby>' + esc(name) + '<rt>' + esc(yomi) + '</rt></ruby>' : esc(name);
}
function itemNameHtml(name) {
  return parseName(name).map(function (s) {
    return s.r && S.prefs.ruby ? '<ruby>' + esc(s.b) + '<rt>' + esc(s.r) + '</rt></ruby>' : esc(s.b);
  }).join('');
}
var toastTimer;
function toast(msg) {
  var t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
}
function go(view) {
  ['vHome', 'vShow', 'vEdit'].forEach(function (v) { $(v).hidden = v !== view; });
  window.scrollTo(0, 0);
}

/* ---- ① えらぶ ---- */
function orderedLayouts() {
  var rank = function (l) { var i = S.recent.indexOf(l.id); return i < 0 ? 1e6 + S.layouts.indexOf(l) : i; };
  return S.layouts.slice().sort(function (a, b) { return rank(a) - rank(b); });
}
function renderHome() {
  var html = '';
  orderedLayouts().forEach(function (l) {
    var t = topView(l, { noLabels: true });
    var b = t.box;
    html += '<div class="card"><button type="button" class="go" data-id="' + esc(l.id) + '">' +
      '<svg viewBox="' + (b.x0) + ' ' + (b.y0) + ' ' + (b.x1 - b.x0) + ' ' + (b.y1 - b.y0) + '" aria-hidden="true">' + t.svg + '</svg>' +
      '<span class="nm">' + rubyHtml(l.name, l.yomi) + '</span></button>' +
      '<button type="button" class="fix" data-fix="' + esc(l.id) + '">なおす</button></div>';
  });
  $('cards').innerHTML = html;
  go('vHome');
}
$('cards').addEventListener('click', function (e) {
  var g = e.target.closest('[data-id]'), f = e.target.closest('[data-fix]');
  if (f) openEdit(f.getAttribute('data-fix'));
  else if (g) openShow(g.getAttribute('data-id'));
});
$('hNew').onclick = function () {
  var l = { id: 'l' + Date.now().toString(36), name: '新しい配置', yomi: '', flip: true, top: [], hooks: { left: [], right: [] }, away: [] };
  S.layouts.push(l); save(); openEdit(l.id);
};
$('dExport').onclick = function () {
  var blob = new Blob([JSON.stringify({ app: 'desk-layout', version: 1, layouts: S.layouts }, null, 1)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = '机の配置図.json'; a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
};
$('dImport').onchange = function (e) {
  var f = e.target.files[0]; if (!f) return;
  f.text().then(function (txt) {
    var got = sanitize(JSON.parse(txt));
    if (!got.layouts.length) throw new Error('empty');
    var n = 0;
    got.layouts.forEach(function (l) {   // 同じ id は上書き、新しい id は追加
      var i = S.layouts.findIndex(function (x) { return x.id === l.id; });
      if (i >= 0) S.layouts[i] = l; else S.layouts.push(l);
      n++;
    });
    save(); renderHome(); toast(n + '件の配置を読み込みました');
  }).catch(function () { toast('このファイルは読み込めません'); });
  e.target.value = '';
};
$('dReset').onclick = function () {
  if (!confirm('つくった配置と直した内容をすべて消して、標準の配置に戻します。よろしいですか？')) return;
  var prefs = S.prefs; S = freshState(); S.prefs = prefs; save(); renderHome(); toast('標準の配置に戻しました');
};

/* ---- ② 見せる ---- */
function openShow(id) {
  cur = byId(id); if (!cur) return renderHome();
  flip = false;
  S.recent = [id].concat(S.recent.filter(function (x) { return x !== id; })).slice(0, 30); save();
  go('vShow'); renderShow();
}
function renderShow() {
  var o = { ruby: S.prefs.ruby, chair: S.prefs.chair, flip: flip && cur.flip };
  var c = S.prefs.group ? composeGroup(cur, o) : composeSingle(cur, o);
  var svg = $('stageSvg');
  svg.setAttribute('viewBox', c.viewBox); svg.innerHTML = c.svg;
  svg.setAttribute('aria-label', cur.name + 'の机の配置');
  $('sTitle').innerHTML = rubyHtml(cur.name, cur.yomi);
  $('sOne').classList.toggle('on', !S.prefs.group); $('sFour').classList.toggle('on', S.prefs.group);
  $('sFlip').disabled = !cur.flip; $('sFlip').setAttribute('aria-pressed', String(flip && cur.flip));
  $('sFlip').title = cur.flip ? '' : 'この活動は左右反転しない設定です';
  $('sChair').setAttribute('aria-pressed', String(S.prefs.chair));
  $('sRuby').setAttribute('aria-pressed', String(S.prefs.ruby));
  renderAway();
}
function renderAway() {
  var html = '';
  PLACES.forEach(function (pl) {
    var list = cur.away.filter(function (a) { return a.place === pl.id; });
    if (!list.length) return;
    html += '<section><h3>' + itemNameHtml(pl.name) + '</h3><div class="icons">' + list.map(function (a) {
      return '<figure>' + iconSvg(a.item, 80) + (a.label ? '<figcaption>' + itemNameHtml(ITEMS[a.item].name) + '</figcaption>' : '') + '</figure>';
    }).join('') + '</div></section>';
  });
  $('away').innerHTML = html;
}
$('sBack').onclick = renderHome;
$('sOne').onclick = function () { S.prefs.group = false; save(); renderShow(); };
$('sFour').onclick = function () { S.prefs.group = true; save(); renderShow(); };
$('sFlip').onclick = function () { flip = !flip; renderShow(); };
$('sChair').onclick = function () { S.prefs.chair = !S.prefs.chair; save(); renderShow(); };
$('sRuby').onclick = function () { S.prefs.ruby = !S.prefs.ruby; save(); renderShow(); };
$('sFull').onclick = function () {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
};
document.addEventListener('keydown', function (e) {   // ← → で活動を切り替える
  if ($('vShow').hidden || e.target.closest('input')) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  var list = orderedLayouts(), i = list.indexOf(cur);
  var n = list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
  cur = n; flip = false; renderShow();
});

/* ---- ③ つくる・なおす ---- */
function openEdit(id) {
  cur = byId(id); if (!cur) return renderHome();
  sel = -1;
  $('eName').value = cur.name; $('eYomi').value = cur.yomi; $('eFlip').checked = cur.flip;
  go('vEdit'); renderEdit(); renderPalette();
}
function renderEdit() {
  var t = topView(cur, { ruby: S.prefs.ruby, sel: sel, grid: gridLevel(S.prefs.grid) });
  var b = t.box, pad = 60;
  var svg = $('editSvg');
  // 余白は広めに固定して、吹き出しが増えても机が跳ねないようにする
  var x0 = Math.min(b.x0, -300) - pad, y0 = Math.min(b.y0, -130) - pad, x1 = Math.max(b.x1, DESK.w + 300) + pad, y1 = Math.max(b.y1, DESK.d + 130) + pad;
  svg.setAttribute('viewBox', x0 + ' ' + y0 + ' ' + (x1 - x0) + ' ' + (y1 - y0));
  svg.innerHTML = t.svg;
  var p = cur.top[sel];
  $('selBar').hidden = !p;
  if (p) {
    var it = ITEMS[p.item], keys = Object.keys(it.states);
    $('selName').textContent = plainName(it.name);
    $('selState').hidden = keys.length < 2;
    $('selState').textContent = stateOf(p) === 'open' ? 'とじる' : 'ひらく';
    $('selLabel').setAttribute('aria-pressed', String(!!p.label));
    $('selSize').hidden = !it.sizes;
    if (it.sizes) $('selSize').textContent = Object.keys(it.sizes).map(function (k) { return (k === sizeOf(p) ? '●' : '○') + it.sizes[k].name; }).join(' ');
    $('selColor').hidden = !it.colors;
    if (it.colors) $('selColor').innerHTML = '色 <span class="sw" style="background:' + colorOf(p) + '"></span>';
  }
  renderChips();
  $('eGrid').innerHTML = GRID_LEVELS.map(function (g) {
    return '<button type="button" data-grid="' + g.id + '" class="' + (g.id === gridLevel(S.prefs.grid).id ? 'on' : '') + '">' + g.name + '</button>';
  }).join('');
}
$('eGrid').addEventListener('click', function (e) {
  var b = e.target.closest('[data-grid]'); if (!b) return;
  S.prefs.grid = b.getAttribute('data-grid'); save(); renderEdit();
});
function chipHtml(entry, where, k, extra) {
  return '<span class="chip">' + iconSvg(entry.item, 34) + '<span>' + esc(plainName(ITEMS[entry.item].name)) + '</span>' + (extra || '') +
    '<button type="button" data-lab="' + where + ':' + k + '" aria-pressed="' + !!entry.label + '">名前</button>' +
    '<button type="button" data-rm="' + where + ':' + k + '" aria-label="けす">×</button></span>';
}
function renderChips() {
  $('lHookL').innerHTML = cur.hooks.left.map(function (h, k) { return chipHtml(h, 'left', k); }).join('');
  $('lHookR').innerHTML = cur.hooks.right.map(function (h, k) { return chipHtml(h, 'right', k); }).join('');
  $('lAway').innerHTML = cur.away.map(function (a, k) {
    var pl = PLACES.filter(function (p) { return p.id === a.place; })[0];
    return chipHtml(a, 'away', k, '<span class="pl">（' + plainName(pl.name) + '）</span>');
  }).join('');
}
function listOf(where) { return where === 'away' ? cur.away : cur.hooks[where]; }
document.querySelector('.lists').addEventListener('click', function (e) {
  var lab = e.target.closest('[data-lab]'), rm = e.target.closest('[data-rm]');
  var ref = (lab || rm); if (!ref) return;
  var parts = (ref.getAttribute('data-lab') || ref.getAttribute('data-rm')).split(':'), list = listOf(parts[0]), k = +parts[1];
  if (lab) list[k].label = !list[k].label; else list.splice(k, 1);
  save(); renderEdit();
});

function renderPalette() {
  document.querySelectorAll('.tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab)); });
  var d = '';
  if (tab === 'hang') d = [['left', '左のフック'], ['right', '右のフック']].map(function (x) {
    return '<button type="button" data-dest="' + x[0] + '" class="' + (dest.hang === x[0] ? 'on' : '') + '">' + x[1] + 'へ</button>';
  }).join('');
  if (tab === 'away') d = PLACES.map(function (p) {
    return '<button type="button" data-dest="' + p.id + '" class="' + (dest.away === p.id ? 'on' : '') + '">' + plainName(p.name) + '</button>';
  }).join('');
  $('pDest').innerHTML = d;
  var kind = tab === 'hang' ? 'hang' : 'top';
  $('pItems').innerHTML = Object.keys(ITEMS).filter(function (id) { return tab === 'away' || ITEMS[id].kind === kind; }).map(function (id) {
    return '<button type="button" data-add="' + id + '">' + iconSvg(id, 54) + '<span>' + plainName(ITEMS[id].name) + '</span></button>';
  }).join('');
}
document.querySelector('.tabs').addEventListener('click', function (e) {
  var b = e.target.closest('[data-tab]'); if (!b) return;
  tab = b.getAttribute('data-tab'); renderPalette();
});
$('pDest').addEventListener('click', function (e) {
  var b = e.target.closest('[data-dest]'); if (!b) return;
  dest[tab] = b.getAttribute('data-dest'); renderPalette();
});
$('pItems').addEventListener('click', function (e) {
  var b = e.target.closest('[data-add]'); if (!b) return;
  var id = b.getAttribute('data-add');
  if (tab === 'top') {
    cur.top.push({ item: id, state: 'closed', x: DESK.w / 2, y: DESK.d / 2, r: 0, label: false });
    sel = cur.top.length - 1;
  } else if (tab === 'hang') cur.hooks[dest.hang].push({ item: id, label: false });
  else cur.away.push({ item: id, place: dest.away, label: false });
  save(); renderEdit();
});

$('eName').oninput = function () { cur.name = this.value.trim() || '無題'; save(); };
$('eYomi').oninput = function () { cur.yomi = this.value.trim(); save(); };
$('eFlip').onchange = function () { cur.flip = this.checked; save(); };
$('eBack').onclick = renderHome;
$('eShow').onclick = function () { openShow(cur.id); };
$('eCopy').onclick = function () {
  var c = clone(cur); c.id = 'l' + Date.now().toString(36); c.name = cur.name + '（コピー）';
  S.layouts.splice(S.layouts.indexOf(cur) + 1, 0, c); save(); openEdit(c.id); toast('複製しました');
};
$('eDel').onclick = function () {
  if (!confirm('「' + cur.name + '」の配置を削除します。元に戻せません。よろしいですか？')) return;
  S.layouts.splice(S.layouts.indexOf(cur), 1);
  S.recent = S.recent.filter(function (x) { return x !== cur.id; });
  save(); renderHome(); toast('削除しました');
};
$('selState').onclick = function () { var p = cur.top[sel]; p.state = stateOf(p) === 'open' ? 'closed' : 'open'; clampP(p); save(); renderEdit(); };
$('selSize').onclick = function () {
  var p = cur.top[sel], ks = Object.keys(ITEMS[p.item].sizes);
  p.size = ks[(ks.indexOf(sizeOf(p)) + 1) % ks.length]; save(); renderEdit();
};
$('selColor').onclick = function () { var p = cur.top[sel]; p.color = ((p.color | 0) + 1) % ITEMS[p.item].colors.length; save(); renderEdit(); };
$('selRot').onclick = function () { var p = cur.top[sel]; p.r = ((p.r || 0) + 90) % 360; clampP(p); save(); renderEdit(); };
$('selLabel').onclick = function () { var p = cur.top[sel]; p.label = !p.label; save(); renderEdit(); };
$('selFront').onclick = function () { toFront(); save(); renderEdit(); };
$('selDel').onclick = function () { cur.top.splice(sel, 1); sel = -1; save(); renderEdit(); };
function toFront() { var p = cur.top.splice(sel, 1)[0]; cur.top.push(p); sel = cur.top.length - 1; }

/* 物の中心をいちばん近いグリッドの交点に合わせる。
   物が机からはみ出すのは許す（教科書にノートを重ねるなど、実際の机でも起きる） */
function clampP(p) {
  var q = snap(p.x, p.y, gridLevel(S.prefs.grid));
  p.x = q.x; p.y = q.y;
}

/* ドラッグ：動かしている間は transform だけを書き換え、離したら描き直す */
var drag = null;
function svgPoint(svg, e) {
  var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
$('editSvg').addEventListener('pointerdown', function (e) {
  var g = e.target.closest('.it');
  if (!g) {
    // 物を選んでいるときに机の上の空いた所を押すと、そこへ移す（指で引きずらなくてよい）
    var q = svgPoint(this, e);
    if (sel >= 0 && q.x >= 0 && q.x <= DESK.w && q.y >= 0 && q.y <= DESK.d) {
      var sp = cur.top[sel]; sp.x = q.x; sp.y = q.y; clampP(sp); save(); renderEdit();
    } else if (sel >= 0) { sel = -1; renderEdit(); }
    return;
  }
  var i = +g.getAttribute('data-i'), p = cur.top[i], pt = svgPoint(this, e);
  if (sel !== i) { sel = i; renderEdit(); g = this.querySelector('.it[data-i="' + i + '"]'); }
  drag = { el: g, p: p, dx: pt.x - p.x, dy: pt.y - p.y, moved: false };
  this.setPointerCapture(e.pointerId);
});
$('editSvg').addEventListener('pointermove', function (e) {
  if (!drag) return;
  var pt = svgPoint(this, e), p = drag.p;
  var nx = p.x, ny = p.y;
  p.x = pt.x - drag.dx; p.y = pt.y - drag.dy; clampP(p);
  if (p.x !== nx || p.y !== ny) drag.moved = true;
  drag.el.setAttribute('transform', 'translate(' + p.x + ' ' + p.y + ') rotate(' + (p.r || 0) + ')');
});
function endDrag() {
  if (!drag) return;
  var moved = drag.moved; drag = null;
  if (moved) { save(); renderEdit(); }
}
$('editSvg').addEventListener('pointerup', endDrag);
document.addEventListener('keydown', function (e) {   // 矢印キーでグリッド1目ずつ動かす
  if ($('vEdit').hidden || sel < 0 || e.target.closest('input')) return;
  var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!d) return;
  e.preventDefault();
  var g = gridLevel(S.prefs.grid), p = cur.top[sel];
  p.x += d[0] * DESK.w / g.nx; p.y += d[1] * DESK.d / g.ny; clampP(p); save(); renderEdit();
});
$('editSvg').addEventListener('pointercancel', endDrag);

renderHome();

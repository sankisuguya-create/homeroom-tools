// モニターに映す面（手元の見本とモニターの窓の両方をこれ1つで描く）。
// 画面を格子に区切り、同じ組を1つの枠に入れる。文字の大きさは全部の枠で同じにし、
// 一番長い名前が枠に収まる最大の大きさを、列の数を変えながら探して決める。
(function (g) {
  'use strict';
  // 字の幅（em）の目安：全角1、半角0.6。最後に実寸で確かめて縮める
  function textW(s) { var w = 0; for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) < 0x2000 ? 0.6 : 1; return w; }

  // W×H の面に、groups（名前の配列の配列）を並べる最大の文字の大きさと、外の列数・中の列数を求める
  var GAP = 0.012, PAD = 0.22, LH = 1.25, HEAD = 0.8; // GAP は面の短辺に対する比、PAD・HEAD は文字の大きさに対する比
  function fit(W, H, groups, showHead) {
    var G = groups.length, maxN = 0, maxW = 0.6;
    groups.forEach(function (gr) { maxN = Math.max(maxN, gr.length); gr.forEach(function (s) { maxW = Math.max(maxW, textW(s)); }); });
    if (!G || !maxN) return null;
    var gap = Math.min(W, H) * GAP, best = null;
    for (var c = 1; c <= G; c++) {
      var r = Math.ceil(G / c), cw = (W - gap * (c + 1)) / c, ch = (H - gap * (r + 1)) / r;
      for (var ic = 1; ic <= maxN; ic++) {
        var ir = Math.ceil(maxN / ic);
        // 枠の中：幅 = ic×(名前幅+間) + 余白、高さ = 見出し + ir×行の高さ + 余白
        var fW = cw / (ic * (maxW + 0.8) + 2 * PAD);
        var fH = ch / (ir * LH + 2 * PAD + (showHead ? HEAD * LH : 0));
        var f = Math.min(fW, fH);
        if (!best || f > best.f + 0.01) best = { f: f, c: c, r: r, ic: ic, gap: gap };
      }
    }
    return best;
  }

  function create(doc, root) {
    root.classList.add('gv');
    var last = null;
    function update(plan, opt) {
      last = { plan: plan, opt: opt };
      var W = root.clientWidth, H = root.clientHeight;
      root.textContent = '';
      if (!plan || !plan.groups.length) {
        var e = doc.createElement('div'); e.className = 'gv-empty'; e.textContent = opt && opt.empty || '';
        root.appendChild(e); return;
      }
      var lay = fit(W, H, plan.groups, opt.showHead);
      if (!lay) return;
      var f = Math.floor(Math.min(lay.f, H / 3));
      var grid = doc.createElement('div'); grid.className = 'gv-grid';
      grid.style.cssText = 'gap:' + lay.gap + 'px;padding:' + lay.gap + 'px;grid-template-columns:repeat(' + lay.c + ',minmax(0,1fr));grid-template-rows:repeat(' + lay.r + ',minmax(0,1fr))';
      plan.groups.forEach(function (gr, i) {
        var box = doc.createElement('div'); box.className = 'gv-box'; box.style.padding = (f * PAD) + 'px';
        if (opt.showHead) {
          var h = doc.createElement('div'); h.className = 'gv-head'; h.textContent = plan.names[i];
          h.style.fontSize = (f * HEAD) + 'px'; box.appendChild(h);
        }
        var ul = doc.createElement('div'); ul.className = 'gv-names';
        ul.style.cssText = 'font-size:' + f + 'px;grid-template-columns:repeat(' + lay.ic + ',auto);column-gap:' + (f * 0.8) + 'px';
        gr.forEach(function (s) { var n = doc.createElement('span'); n.textContent = s; ul.appendChild(n); });
        box.appendChild(ul); grid.appendChild(box);
      });
      root.appendChild(grid);
      // 目安の字幅で決めたので、実寸ではみ出す枠があれば全体を少しずつ縮める（全部の枠で同じ大きさを保つ）
      for (var k = 0; k < 12 && overflow(grid); k++) {
        f = Math.floor(f * 0.93);
        grid.querySelectorAll('.gv-names').forEach(function (u) { u.style.fontSize = f + 'px'; u.style.columnGap = (f * 0.8) + 'px'; });
        grid.querySelectorAll('.gv-head').forEach(function (u) { u.style.fontSize = (f * HEAD) + 'px'; });
        grid.querySelectorAll('.gv-box').forEach(function (u) { u.style.padding = (f * PAD) + 'px'; });
      }
    }
    function overflow(grid) {
      var bad = false;
      grid.querySelectorAll('.gv-box').forEach(function (b) { if (b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1) bad = true; });
      return bad;
    }
    var ro = new (doc.defaultView.ResizeObserver)(function () { if (last) update(last.plan, last.opt); });
    ro.observe(root);
    return { update: update };
  }

  g.GroupView = { create: create, fit: fit, textW: textW };
})(typeof globalThis !== 'undefined' ? globalThis : this);

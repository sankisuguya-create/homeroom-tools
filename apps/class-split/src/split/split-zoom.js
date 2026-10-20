/* クラス分け：盤面の拡大・縮小。ui-split.js の中に差し込まれる（同じ閉じた範囲の変数を使う）。単独では動かない */
  // ホイール（2本指のスクロール）で、カーソルのある所を中心に拡大・縮小する。タッチは2本指で広げる・つまむ。
  // 拡大中は、ドラッグして動かす（5px より動いた時だけ。動かさずに離せば、ふつうの「押す」）。「等倍に戻す」で全員が1画面に収まる元の表示へ。
  // 盤面は描き直しても、同じ倍率と位置を保つ（入れ替えのたびに戻らない）
  var ZOOM = { k: 1, x: 0, y: 0 }, ZMAX = 4;
  function zoomBox() { var b = App.$('board'); return b && b.querySelector('.cols') ? b : null; }
  function clampZoom(b) {
    var w = b.clientWidth, h = b.clientHeight;
    ZOOM.k = Math.max(1, Math.min(ZMAX, ZOOM.k));
    ZOOM.x = Math.min(0, Math.max(w - w * ZOOM.k, ZOOM.x)); ZOOM.y = Math.min(0, Math.max(h - h * ZOOM.k, ZOOM.y));
    if (ZOOM.k === 1) { ZOOM.x = 0; ZOOM.y = 0; }
  }
  function applyZoom() {
    var b = zoomBox(); if (!b) return;
    clampZoom(b);
    var cols = b.querySelector('.cols'), on = ZOOM.k > 1.001;
    cols.style.transformOrigin = '0 0';
    cols.style.transform = on ? 'translate(' + ZOOM.x + 'px,' + ZOOM.y + 'px) scale(' + ZOOM.k + ')' : '';
    b.classList.toggle('zoomed', on);
    var r = b.querySelector('.zreset');
    if (on && !r) b.insertAdjacentHTML('beforeend', '<button type="button" class="btn zreset" id="zreset">等倍に戻す（' + Math.round(ZOOM.k * 100) + '%）</button>');
    else if (on) r.textContent = '等倍に戻す（' + Math.round(ZOOM.k * 100) + '%）';
    else if (r) r.remove();
  }
  // 盤面の中の点 (px, py) を動かさずに倍率を k にする
  function zoomAt(px, py, k) {
    var b = zoomBox(); if (!b) return;
    var k0 = ZOOM.k; k = Math.max(1, Math.min(ZMAX, k));
    ZOOM.x = px - (px - ZOOM.x) * k / k0; ZOOM.y = py - (py - ZOOM.y) * k / k0; ZOOM.k = k;
    applyZoom();
  }
  function zoomReset() { ZOOM = { k: 1, x: 0, y: 0 }; applyZoom(); }
  document.addEventListener('wheel', function (e) {
    if (App.st.screen !== 'split' || App.dlg || !S || S.view !== 'plan') return;
    var b = zoomBox(); if (!b || !b.contains(e.target)) return;
    e.preventDefault();
    var r = b.getBoundingClientRect(), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(e.clientX - r.left, e.clientY - r.top, ZOOM.k * Math.exp(-dy * 0.0015));
  }, { passive: false });
  // 指・ペン：2本で広げる・つまむ。拡大中は1本でドラッグして動かす
  var ZP = {};
  document.addEventListener('pointerdown', function (e) {
    var b = App.st.screen === 'split' && zoomBox(); if (!b || !b.contains(e.target) || e.target.closest('.zreset')) return;
    ZP[e.pointerId] = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
    var ids = Object.keys(ZP);
    if (ids.length === 2) { var a = ZP[ids[0]], c = ZP[ids[1]]; ZP.pinch = { d: Math.hypot(a.x - c.x, a.y - c.y) || 1, k: ZOOM.k }; }
  }, true);
  document.addEventListener('pointermove', function (e) {
    var p = ZP[e.pointerId]; if (!p) return;
    var b = zoomBox(); if (!b) return;
    var r = b.getBoundingClientRect(), ids = Object.keys(ZP).filter(function (k) { return k !== 'pinch' && k !== 'pan'; });
    if (ids.length === 2 && ZP.pinch) {
      p.x = e.clientX; p.y = e.clientY;
      var a = ZP[ids[0]], c = ZP[ids[1]], d = Math.hypot(a.x - c.x, a.y - c.y) || 1;
      zoomAt((a.x + c.x) / 2 - r.left, (a.y + c.y) / 2 - r.top, ZP.pinch.k * d / ZP.pinch.d);
      return;
    }
    if (ZOOM.k > 1 && (ZP.pan || Math.abs(e.clientX - p.x0) + Math.abs(e.clientY - p.y0) > 5)) {
      ZOOM.x += e.clientX - p.x; ZOOM.y += e.clientY - p.y; ZP.pan = true; applyZoom();
    }
    p.x = e.clientX; p.y = e.clientY;
  }, true);
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { delete ZP[e.pointerId]; if (Object.keys(ZP).filter(function (k) { return k !== 'pinch' && k !== 'pan'; }).length < 2) delete ZP.pinch; if (!Object.keys(ZP).filter(function (k) { return k !== 'pan'; }).length) setTimeout(function () { delete ZP.pan; }, 0); }, true);
  });
  // 動かした後の「押す」は、カードの選択にしない
  document.addEventListener('click', function (e) { if (ZP.pan && App.st.screen === 'split') { e.stopPropagation(); e.preventDefault(); delete ZP.pan; } }, true);

// 事案の関係図：児童を置く・グループで囲む・矢印（加害）を引く。役割と型は Engine が矢印から決める。
// 座標は Engine.DG_W×DG_H の論理座標で持ち、画面の幅に合わせて伸び縮みさせる。
(function (g) {
  'use strict';
  var App = g.App, E = g.Engine;
  var W = E.DG_W, H = E.DG_H, LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var MODES = [['move', '動かす'], ['arrow', '矢印（加害）'], ['group', 'グループ'], ['del', '消す']];

  function data() { return App.st.data; }
  function kidOf(id) { return data().kids[id] || { name: id }; }
  function rowOf(id) {
    var d = data(), y = d.years.filter(function (x) { return x.fy === d.fy; })[0];
    return y ? y.rows.filter(function (r) { return r.id === id; })[0] : null;
  }

  // st = { d: 関係図, mode, from: 矢印の元, pick: グループにする児童, card: カードで出すか }
  App.Diagram = {
    state: function (d) { return { d: E.normDiagram(d), mode: 'move', from: null, pick: [], card: loadCard() }; },
    // 児童を足す：空いている場所に置く
    add: function (st, id) {
      if (st.d.nodes.some(function (n) { return n.id === id; })) return;
      var i = st.d.nodes.length, cols = 4;
      st.d.nodes.push({ id: id, x: 90 + (i % cols) * 150, y: 50 + Math.floor(i / cols) % 4 * 75 });
    },
    mount: mount
  };
  function loadCard() { try { return localStorage.getItem('classSplit.dgCard') === '1'; } catch (e) { return false; } }
  function saveCard(v) { try { localStorage.setItem('classSplit.dgCard', v ? '1' : '0'); } catch (e) { /* 覚えられなくても今は効く */ } }

  function nodeHtml(st, n) {
    var esc = App.esc, s = kidOf(n.id), r = rowOf(n.id), cls = 'dg-n' + (st.from === 'k:' + n.id ? ' from' : '') + (st.pick.indexOf(n.id) >= 0 ? ' pick' : '');
    var style = 'left:' + (n.x / W * 100) + '%;top:' + (n.y / H * 100) + '%';
    if (!st.card) return '<div class="' + cls + '" data-dn="' + esc(n.id) + '" style="' + style + '">' + esc(s.name) + '</div>';
    var oc = App.classColor(r ? r.cls : -1), marks = r ? g.CONFIG.ATTRS.filter(function (at) { return r.a[at.k] | 0; }).map(function (at) { return App.mark(at, r.a[at.k] | 0, r.a[at.k + '_t']); }).join('') : '';
    return '<div class="' + cls + ' card ' + (s.male ? 'm' : 'f') + '" data-dn="' + esc(n.id) + '" style="' + style + ';--oc:' + oc.c + ';--ol:' + oc.l + '">' +
      '<span class="nb">' + (r ? (r.cls + 1) + '-' + r.no : '') + '</span><span class="nt">' + esc(s.name) + '</span>' + (marks ? '<span class="nm2">' + marks + '</span>' : '') + '</div>';
  }

  function mount(el, st, onChange) {
    var esc = App.esc, d = st.d;
    var roles = E.diagramRoles(d), pat = E.diagramPattern(d), by = { harm: [], victim: [], mutual: [], related: [] };
    d.nodes.forEach(function (n) { by[roles[n.id]].push(kidOf(n.id).name); });
    el.innerHTML = '<div class="dg-bar"><div class="lvs">' + MODES.map(function (m) {
        return '<button type="button" class="lv" data-dm="' + m[0] + '" aria-pressed="' + (st.mode === m[0]) + '">' + m[1] + '</button>';
      }).join('') + '</div>' +
      (st.mode === 'group' ? '<button type="button" class="btn primary" data-dgroup="1"' + (st.pick.length ? '' : ' disabled') + '>選んだ' + st.pick.length + '人を囲む</button>' : '') +
      '<label class="chk"><input type="checkbox" data-dcard="1"' + (st.card ? ' checked' : '') + '>カードで表示</label></div>' +
      '<div class="dg-hint note">' + ({ move: '児童やグループの記号をドラッグして動かします。', arrow: '矢印の元（加害の側）→ 先（被害の側）の順に、児童かグループの記号を押します。', group: '囲む児童を押して選び、「囲む」を押します。', del: '消す児童・グループの記号・矢印を押します。' })[st.mode] + '</div>' +
      '<div class="dg-canvas"><svg class="dg-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"></svg>' +
      d.nodes.map(function (n) { return nodeHtml(st, n); }).join('') + '</div>' +
      '<div class="dg-sum">' + (pat ? '<b>' + pat + '</b>' : '<span class="note">矢印を引くと、加害・被害と型が決まります。</span>') +
      ['harm', 'victim', 'mutual', 'related'].filter(function (k) { return by[k].length; }).map(function (k) { return '<span><em class="r-' + k + '">' + E.ROLE_NAMES[k] + '</em>' + by[k].map(esc).join('・') + '</span>'; }).join('') + '</div>';
    var cv = el.querySelector('.dg-canvas'), svg = el.querySelector('.dg-svg');
    draw(cv, svg, st);

    // 押す・ドラッグする（タッチとペンも同じ）
    var drag = null;
    cv.onpointerdown = function (e) {
      var t = e.target, nd = t.closest('[data-dn]'), gl = t.closest('[data-dg]'), eg = t.closest('[data-de]');
      var key = nd ? 'k:' + nd.dataset.dn : gl ? 'g:' + gl.dataset.dg : null;
      if (st.mode === 'move' && key) {
        var ids = nd ? [nd.dataset.dn] : (d.groups.filter(function (x) { return x.g === gl.dataset.dg; })[0] || { members: [] }).members;
        var r = cv.getBoundingClientRect();
        drag = { ids: ids, sx: e.clientX, sy: e.clientY, kx: W / r.width, ky: H / r.height, start: ids.map(function (id) { var n = nodeOf(id); return [n.x, n.y]; }) };
        cv.setPointerCapture(e.pointerId); e.preventDefault(); return;
      }
      if (st.mode === 'arrow' && key) {
        if (!st.from) st.from = key;
        else { if (st.from !== key) d.edges.push({ f: st.from, t: key }); st.from = null; st.d = d = E.normDiagram(d); }
        return redo();
      }
      if (st.mode === 'group' && nd) { var id = nd.dataset.dn, i = st.pick.indexOf(id); if (i >= 0) st.pick.splice(i, 1); else st.pick.push(id); return redo(); }
      if (st.mode === 'del') {
        if (nd) d.nodes = d.nodes.filter(function (n) { return n.id !== nd.dataset.dn; });
        else if (gl) d.groups = d.groups.filter(function (x) { return x.g !== gl.dataset.dg; });
        else if (eg) d.edges.splice(+eg.dataset.de, 1);
        else return;
        st.d = d = E.normDiagram(d); return redo();
      }
    };
    cv.onpointermove = function (e) {
      if (!drag) return;
      var dx = (e.clientX - drag.sx) * drag.kx, dy = (e.clientY - drag.sy) * drag.ky;
      drag.ids.forEach(function (id, i) {
        var n = nodeOf(id); n.x = Math.max(20, Math.min(W - 20, drag.start[i][0] + dx)); n.y = Math.max(14, Math.min(H - 14, drag.start[i][1] + dy));
        var div = cv.querySelector('[data-dn="' + CSS.escape(id) + '"]'); if (div) { div.style.left = (n.x / W * 100) + '%'; div.style.top = (n.y / H * 100) + '%'; }
      });
      draw(cv, svg, st);
    };
    cv.onpointerup = cv.onpointercancel = function () { if (drag) { drag = null; onChange(st); } };
    el.onclick = function (e) {
      var t = e.target, x;
      if ((x = t.closest('[data-dm]'))) { st.mode = x.dataset.dm; st.from = null; st.pick = []; redo(); }
      else if (t.closest('[data-dgroup]') && st.pick.length) {
        var used = d.groups.map(function (gr) { return gr.g; }), gname = LET.split('').filter(function (c) { return used.indexOf(c) < 0; })[0];
        d.groups.forEach(function (gr) { gr.members = gr.members.filter(function (id) { return st.pick.indexOf(id) < 0; }); }); // 児童は1つのグループにだけ入る
        d.groups.push({ g: gname, members: st.pick.slice() }); st.pick = [];
        st.d = d = E.normDiagram(d); redo();
      }
      e.stopPropagation();
    };
    el.onchange = function (e) { if (e.target.dataset.dcard) { st.card = e.target.checked; saveCard(st.card); redo(); } };
    function nodeOf(id) { return d.nodes.filter(function (n) { return n.id === id; })[0]; }
    function redo() { mount(el, st, onChange); onChange(st); }
  }

  // グループの枠と矢印を描く。児童の大きさは画面の実寸から測る
  function draw(cv, svg, st) {
    var d = st.d, r = cv.getBoundingClientRect(), kx = W / (r.width || 1), ky = H / (r.height || 1), box = {};
    cv.querySelectorAll('[data-dn]').forEach(function (div) {
      var q = div.getBoundingClientRect();
      box['k:' + div.dataset.dn] = { x1: (q.left - r.left) * kx, y1: (q.top - r.top) * ky, x2: (q.right - r.left) * kx, y2: (q.bottom - r.top) * ky };
    });
    var h = '', labels = '';
    d.groups.forEach(function (gr) {
      var b = null;
      gr.members.forEach(function (id) { var q = box['k:' + id]; if (!q) return; b = b ? { x1: Math.min(b.x1, q.x1), y1: Math.min(b.y1, q.y1), x2: Math.max(b.x2, q.x2), y2: Math.max(b.y2, q.y2) } : Object.assign({}, q); });
      if (!b) return;
      b = { x1: b.x1 - 12, y1: b.y1 - 16, x2: b.x2 + 12, y2: b.y2 + 10 };
      box['g:' + gr.g] = b;
      h += '<rect class="dg-g' + (st.from === 'g:' + gr.g ? ' from' : '') + '" x="' + b.x1 + '" y="' + b.y1 + '" width="' + (b.x2 - b.x1) + '" height="' + (b.y2 - b.y1) + '" rx="18"/>';
      labels += '<div class="dg-gl' + (st.from === 'g:' + gr.g ? ' from' : '') + '" data-dg="' + gr.g + '" style="left:' + (b.x1 / W * 100) + '%;top:' + (b.y1 / H * 100) + '%">' + gr.g + '</div>';
    });
    d.edges.forEach(function (e, i) {
      var a = box[e.f], b = box[e.t]; if (!a || !b) return;
      var ca = [(a.x1 + a.x2) / 2, (a.y1 + a.y2) / 2], cb = [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2];
      var p = edgePt(a, ca, cb), q = edgePt(b, cb, ca);
      // 両向きの矢印は少しずらして2本に見せる
      var rev = d.edges.some(function (o) { return o.f === e.t && o.t === e.f; }), nx = 0, ny = 0;
      if (rev) { var L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; nx = -(q[1] - p[1]) / L * 6; ny = (q[0] - p[0]) / L * 6; }
      var x1 = p[0] + nx, y1 = p[1] + ny, x2 = q[0] + nx, y2 = q[1] + ny, dpath = 'M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2;
      // 矢じりは三角を描く（SVG の marker は参照の書き方が配布の検査に掛かるので使わない）
      var L2 = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L2, uy = (y2 - y1) / L2, hl = 13, hw = 6;
      var head = 'M' + x2 + ' ' + y2 + 'L' + (x2 - ux * hl - uy * hw) + ' ' + (y2 - uy * hl + ux * hw) + 'L' + (x2 - ux * hl + uy * hw) + ' ' + (y2 - uy * hl - ux * hw) + 'Z';
      h += '<path class="dg-e" d="M' + x1 + ' ' + y1 + 'L' + (x2 - ux * hl * .8) + ' ' + (y2 - uy * hl * .8) + '"/><path class="dg-ah" d="' + head + '"/><path class="dg-eh" data-de="' + i + '" d="' + dpath + '"/>';
    });
    svg.innerHTML = h;
    cv.querySelectorAll('.dg-gl').forEach(function (x) { x.remove(); });
    cv.insertAdjacentHTML('beforeend', labels);
  }
  // 中心から相手の中心へ向かう線が、枠の縁と交わる点
  function edgePt(b, c, to) {
    var dx = to[0] - c[0], dy = to[1] - c[1], hw = (b.x2 - b.x1) / 2 + 3, hh = (b.y2 - b.y1) / 2 + 3;
    if (!dx && !dy) return c;
    var s = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    return [c[0] + dx * s, c[1] + dy * s];
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

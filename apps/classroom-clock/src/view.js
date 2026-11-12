/* モニターに映す面を作る。同じ関数で、手元の見本とモニター用の窓の両方を描く
   （描き方が1つなので、見本とモニターが食い違わない）。 */
var ClockView = (function () {
  'use strict';
  var C = ClockCore;

  function pt(deg, r) { var a = (deg - 90) * Math.PI / 180; return (100 + r * Math.cos(a)).toFixed(2) + ' ' + (100 + r * Math.sin(a)).toFixed(2); }
  /* 12時の位置から時計回りに a0→a1 度の扇形 */
  function sectorPath(a0, a1, r) {
    var span = Math.min(a1 - a0, 359.9);
    return 'M100 100L' + pt(a0, r) + 'A' + r + ' ' + r + ' 0 ' + (span > 180 ? 1 : 0) + ' 1 ' + pt(a0 + span, r) + 'Z';
  }
  function faceSvg() {
    var s = '<circle class="cv-face" cx="100" cy="100" r="97"/><path class="cv-sector" d=""/>';
    for (var i = 0; i < 60; i++) {
      var five = i % 5 === 0;
      s += '<line class="' + (five ? 'cv-tick5' : 'cv-tick') + '" x1="100" y1="' + (five ? 4 : 4) + '" x2="100" y2="' + (five ? 17 : 10) + '" transform="rotate(' + (i * 6) + ' 100 100)"/>';
    }
    for (var n = 1; n <= 12; n++) { var p = pt(n * 30, 65).split(' '); s += '<text class="cv-num" x="' + p[0] + '" y="' + p[1] + '">' + n + '</text>'; }
    s += '<line class="cv-goal" x1="100" y1="100" x2="100" y2="100"/>'
      + '<path class="cv-tri" d=""/>'
      /* 針は中心から先へだけ伸ばす（反対側へ突き出さない） */
      + '<line class="cv-hh" x1="100" y1="100" x2="100" y2="50"/>'
      + '<line class="cv-mh" x1="100" y1="100" x2="100" y2="13"/>'
      + '<line class="cv-sh" x1="100" y1="100" x2="100" y2="10"/>'
      + '<circle class="cv-pin" cx="100" cy="100" r="5.5"/>';
    return s;
  }

  function create(doc, root) {
    root.className = 'cv';
    root.lang = 'ja';
    root.innerHTML = '<div class="cv-in"><div class="cv-top"><span class="cv-date"></span><span class="cv-now"></span></div>'
      + '<div class="cv-main"><svg class="cv-analog" viewBox="-16 -16 232 232" aria-hidden="true">' + faceSvg() + '</svg>'
      + '<div class="cv-read"><div class="cv-label"></div><div class="cv-big"><span class="cv-b1"></span><span class="cv-b2"></span></div>'
      + '<div class="cv-gauge"><div class="cv-bar"><i></i><b></b></div><div class="cv-scale"></div></div><div class="cv-sub"></div><ol class="cv-laps"></ol></div></div></div>'
      + '<div class="cv-banner"></div><div class="cv-hint"></div>';
    var q = function (s) { return root.querySelector(s); };
    var el = { date: q('.cv-date'), now: q('.cv-now'), label: q('.cv-label'), b1: q('.cv-b1'), b2: q('.cv-b2'), bar: q('.cv-bar i'),
      sub: q('.cv-sub'), laps: q('.cv-laps'), banner: q('.cv-banner'), hint: q('.cv-hint'),
      sector: q('.cv-sector'), tri: q('.cv-tri'), ticks: q('.cv-bar b'), scale: q('.cv-scale'), goal: q('.cv-goal'), hh: q('.cv-hh'), mh: q('.cv-mh'), sh: q('.cv-sh') };
    var last = {};
    function txt(k, v) { if (last[k] !== v) { last[k] = v; el[k].textContent = v; } }
    /* 数字を1字ずつ同じ幅の枠に入れる。BIZ UDPゴシックなど字幅が数字ごとに違う書体でも、
       桁の位置が動かない（1→2 で時刻が横にずれない）。tabular-nums は書体が対応していないと効かない。 */
    function dg(k, v) {
      if (last[k] === v) return; last[k] = v;
      var html = '';
      for (var i = 0; i < v.length; i++) {
        var ch = v.charAt(i);
        html += /[0-9]/.test(ch) ? '<i class="cv-d">' + ch + '</i>' : /[:.]/.test(ch) ? '<i class="cv-p">' + ch + '</i>' : ch;
      }
      el[k].innerHTML = html;
    }
    function attr(k, node, name, v) { if (last[k] !== v) { last[k] = v; node.setAttribute(name, v); } }

    function update(state, now, fx) {
      fx = fx || {};
      var mode = state.mode, d = new Date(now), c = C.fmtClock(now);
      var label = '', b1 = '', b2 = '', sub = '', phase = 'idle', bar = -1, total = 0, goal = null, laps = '';
      if (mode === 'clock') {
        b1 = c.h + ':' + c.m; b2 = ':' + c.s;
        if (state.sched.on) {
          var sn = C.schedNow((state.sched.patterns[state.sched.pattern] || { rows: [] }).rows, now);
          if (sn && sn.kind === 'in') { sub = sn.name + '　終了まで あと' + C.ceilMin(sn.endAt - now) + '分'; goal = sn.endAt; total = sn.endAt - sn.startAt; }
          else if (sn) { sub = '次は ' + sn.name + '　あと' + C.ceilMin(sn.startAt - now) + '分'; goal = sn.startAt; total = C.HOUR; }
          if (goal !== null) bar = Math.min(1, (goal - now) / total);
        }
      } else if (mode === 'timer') {
        var t = state.timer, left = C.timerLeft(t, now);
        /* 終わったら 0:00 で止める（超過は数えない） */
        if (left <= 0) { phase = 'over'; label = '終了'; b1 = '0:00'; bar = 0; total = t.dur; }
        else {
          var soon = left <= C.MIN && t.dur >= 2 * C.MIN;
          b1 = C.fmtRemain(left); label = soon ? '残りわずか' : '残り';
          phase = soon ? 'warn' : (t.running ? 'run' : 'idle');
          bar = Math.min(1, left / t.dur); total = t.dur;
          if (t.running) { goal = t.endAt; sub = C.fmtHmJa(t.endAt + 999) + 'まで'; }
          else if (t.started) sub = '一時停止中';
        }
      } else {
        var w = state.sw, sw = C.fmtSw(C.swElapsed(w, now));
        label = 'ストップウォッチ'; b1 = sw.main; b2 = sw.tenth;
        laps = w.laps.slice(-4).map(function (ms, i, a) { var f = C.fmtSw(ms); return (w.laps.length - a.length + i + 1) + '回目 ' + f.main + f.tenth; }).join('\n');
      }
      attr('mode', root, 'data-mode', mode); attr('face', root, 'data-face', state.face);
      attr('theme', root, 'data-theme', state.theme); attr('phase', root, 'data-phase', phase);
      txt('date', C.fmtDate(now)); dg('now', c.h + ':' + c.m);
      txt('label', label); dg('b1', b1); dg('b2', b2); txt('sub', sub);
      attr('hasbar', root, 'data-bar', bar >= 0 ? '1' : '0');
      attr('bar', el.bar, 'style', 'width:' + (Math.max(0, bar) * 100).toFixed(2) + '%');
      /* 横棒の1分ごとの目盛り（60分以下のときだけ。多いと線が詰まって読めない） */
      var nmin = Math.round(total / C.MIN);
      attr('ticks', el.ticks, 'style', nmin >= 2 && nmin <= 60 ? '--n:' + nmin : 'display:none');
      /* 横棒の目盛りの数字：棒の位置＝その時点の残り分。10分以下は1分ごと、30分以下は5分ごと、それより長ければ10分ごと */
      var step = nmin <= 10 ? 1 : nmin <= 30 ? 5 : 10, sc = '';
      if (bar >= 0 && nmin >= 1 && nmin <= 60) for (var m = 0; m <= nmin; m += step) sc += '<span style="left:' + (m / nmin * 100).toFixed(2) + '%">' + m + (m + step > nmin ? '分' : '') + '</span>';
      if (last.scale !== sc) { last.scale = sc; el.scale.innerHTML = sc; }
      if (last.lapsTxt !== laps) {
        last.lapsTxt = laps; el.laps.textContent = '';
        if (laps) laps.split('\n').forEach(function (s) { var li = doc.createElement('li'); li.textContent = s; el.laps.appendChild(li); });
      }
      if (state.face === 'analog') {
        var sec = d.getSeconds(), min = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + min / 60;
        var am = min * 6;
        attr('hh', el.hh, 'transform', 'rotate(' + (hr * 30).toFixed(2) + ' 100 100)');
        attr('mh', el.mh, 'transform', 'rotate(' + am.toFixed(2) + ' 100 100)');
        attr('sh', el.sh, 'transform', 'rotate(' + (sec * 6) + ' 100 100)');
        /* 残り時間を「今の長針から、終わりの位置まで」の面で塗る。長針1周（60分）以内だけ。 */
        var remain = goal === null ? 0 : goal - now, show = remain > 0 && remain <= C.HOUR;
        var a1 = am + remain / C.HOUR * 360;
        /* 中心から円周（文字盤のふちの内側）まで塗り切る */
        attr('sector', el.sector, 'd', show ? sectorPath(am, a1, 95.5) : '');
        var g = show ? pt(a1, 95.5).split(' ') : ['100', '100'];
        /* 終わりの位置を、円の外の赤い三角の角でも示す（角が中心を向く） */
        attr('tri', el.tri, 'd', show ? 'M' + pt(a1, 100) + 'L' + pt(a1 - 4.2, 114) + 'L' + pt(a1 + 4.2, 114) + 'Z' : '');
        attr('gx', el.goal, 'x2', g[0]); attr('gy', el.goal, 'y2', g[1]);
      }
      var flash = !!(fx.flashUntil && now < fx.flashUntil);
      if (last.flash !== flash) { last.flash = flash; root.classList.toggle('flash', flash); }
      txt('banner', fx.banner && now < fx.banner.until ? fx.banner.text : '');
      txt('hint', fx.hint || '');
    }
    return { update: update, root: root };
  }
  return { create: create, sectorPath: sectorPath };
})();

/* 時間の計算の正本。画面にも音にも触れない（node のテストからそのまま読む）。
   決まり：残り時間・経過時間は「数えた回数」ではなく時刻の差から出す。
   タブが裏に回って処理が間引かれても、読み込み直しても、ずれない。 */
var ClockCore = (function () {
  'use strict';
  var SEC = 1000, MIN = 60000, HOUR = 3600000;
  var TIMER_MAX = 180 * MIN;
  var LATE_LIMIT = 5 * SEC;   // これより遅れて気づいた合図は鳴らさない（スリープ明けに古い合図をまとめて鳴らさない）

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hm2min(hm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(hm || '');
    if (!m) return null;
    var h = +m[1], mi = +m[2];
    return (h > 23 || mi > 59) ? null : h * 60 + mi;
  }
  function dayStart(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function atHm(ts, hm) { var m = hm2min(hm); return m === null ? null : dayStart(ts) + m * MIN; }

  function fmtClock(ts) { var d = new Date(ts); return { h: String(d.getHours()), m: pad(d.getMinutes()), s: pad(d.getSeconds()) }; }
  function fmtDate(ts) { var d = new Date(ts); return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + '日月火水木金土'.charAt(d.getDay()) + '）'; }
  function fmtHmJa(ts) { var d = new Date(ts); return d.getHours() + '時' + (d.getMinutes() ? d.getMinutes() + '分' : ''); }
  /* 残りは切り上げる：0:00 が出るのは終わった瞬間だけ（「0:00 なのにまだ鳴らない」1秒を作らない） */
  function fmtRemain(ms) { var s = Math.max(0, Math.ceil(ms / SEC)); return Math.floor(s / 60) + ':' + pad(s % 60); }
  function fmtOver(ms) { var s = Math.max(0, Math.floor(ms / SEC)); return '+' + Math.floor(s / 60) + ':' + pad(s % 60); }
  function fmtSw(ms) { var t = Math.floor(Math.max(0, ms) / 100), s = Math.floor(t / 10); return { main: Math.floor(s / 60) + ':' + pad(s % 60), tenth: '.' + (t % 10) }; }
  function ceilMin(ms) { return Math.max(1, Math.ceil(ms / MIN)); }

  /* ---- タイマー ---- { dur, left, running, endAt, started }
     不変条件：running のとき残りは endAt - now、止まっているとき残りは left。 */
  function newTimer(dur) { return { dur: dur, left: dur, running: false, endAt: 0, started: false }; }
  function timerLeft(t, now) { return t.running ? t.endAt - now : t.left; }
  function timerStart(t, now) {
    if (t.running) return;
    if (t.left <= 0) t.left = t.dur;          // 終わったあとのスタートは同じ長さでもう一度
    t.running = true; t.started = true; t.endAt = now + t.left;
  }
  function timerPause(t, now) { if (!t.running) return; t.left = t.endAt - now; t.running = false; }
  function timerReset(t) { t.running = false; t.started = false; t.left = t.dur; t.endAt = 0; }
  /* 時間を選ぶだけで、始めない（スタートは別の操作） */
  function timerPreset(t, dur) { t.dur = dur; t.left = dur; t.running = false; t.started = false; t.endAt = 0; }
  function timerAdd(t, ms, now) {
    var left = timerLeft(t, now);
    var next = left <= 0 ? (ms > 0 ? ms : 0) : left + ms;   // 終わったあとの＋は「今から」延ばす
    if (ms < 0 && next < -ms) next = left > 0 ? Math.min(left, -ms) : left;  // −は1回分（1分・10秒）より下へ行かない
    if (next > TIMER_MAX) next = TIMER_MAX;
    if (t.running) t.endAt = now + next; else { t.left = next; if (!t.started && next > 0) t.dur = next; }
  }

  /* ---- ストップウォッチ ---- { running, startAt, acc, laps[] } */
  function newSw() { return { running: false, startAt: 0, acc: 0, laps: [] }; }
  function swElapsed(w, now) { return w.acc + (w.running ? now - w.startAt : 0); }
  function swStart(w, now) { if (!w.running) { w.running = true; w.startAt = now; } }
  function swStop(w, now) { if (w.running) { w.acc = swElapsed(w, now); w.running = false; } }
  function swLap(w, now) { var e = swElapsed(w, now); if (e > 0) w.laps.push(e); }
  function swReset(w) { w.running = false; w.acc = 0; w.startAt = 0; w.laps = []; }

  /* ---- 時間割 ---- rows: [{name, s:'08:45', e:'09:30'}]
     今が授業中なら {kind:'in'}、次の授業まで60分以内なら {kind:'before'}、どちらでもなければ null。
     60分で切るのは、アナログ盤の扇形（長針1周）で表せる範囲に合わせるため。 */
  function schedNow(rows, now) {
    var next = null;
    for (var i = 0; i < rows.length; i++) {
      var s = atHm(now, rows[i].s), e = atHm(now, rows[i].e);
      if (s === null || e === null || e <= s) continue;
      if (now >= s && now < e) return { kind: 'in', name: rows[i].name, startAt: s, endAt: e };
      if (s > now && (!next || s < next.startAt)) next = { kind: 'before', name: rows[i].name, startAt: s, endAt: e };
    }
    return next && next.startAt - now <= HOUR ? next : null;
  }

  /* ---- 合図 ---- (prev, now] の間に通りすぎた合図を返す。状態は書きかえない。 */
  function events(state, prev, now) {
    var out = [];
    if (!(prev < now)) return out;
    if (now - prev > LATE_LIMIT) prev = now - LATE_LIMIT;
    function crossed(ts) { return ts !== null && ts > prev && ts <= now; }
    var t = state.timer;
    if (t && t.running) {
      if (crossed(t.endAt)) out.push({ type: 'timerEnd' });
      else {
        if (t.dur >= 2 * MIN && crossed(t.endAt - MIN)) out.push({ type: 'timerWarn' });
        if (t.dur >= MIN && crossed(t.endAt - 30 * SEC)) out.push({ type: 'timer30' });
        for (var k = 10; k >= 1; k--) {
          if (t.dur > k * SEC && crossed(t.endAt - k * SEC)) { out.push({ type: 'tick', left: k }); break; }
        }
      }
    }
    (state.alarms || []).forEach(function (a) {
      if (a.on && crossed(atHm(now, a.hm))) out.push({ type: 'alarm', hm: a.hm, label: a.label || '' });
    });
    var sc = state.sched;
    if (sc && sc.on && sc.chime) {
      var rows = (sc.patterns[sc.pattern] || { rows: [] }).rows, done = {};
      rows.forEach(function (r) {
        [['start', r.s], ['end', r.e]].forEach(function (p) {
          var ts = atHm(now, p[1]);
          if (crossed(ts) && !done[ts]) { done[ts] = 1; out.push({ type: 'chime', edge: p[0], name: r.name }); }
        });
      });
    }
    return out;
  }

  return {
    SEC: SEC, MIN: MIN, HOUR: HOUR, TIMER_MAX: TIMER_MAX,
    hm2min: hm2min, atHm: atHm, fmtClock: fmtClock, fmtDate: fmtDate, fmtHmJa: fmtHmJa,
    fmtRemain: fmtRemain, fmtOver: fmtOver, fmtSw: fmtSw, ceilMin: ceilMin,
    newTimer: newTimer, timerLeft: timerLeft, timerStart: timerStart, timerPause: timerPause,
    timerReset: timerReset, timerPreset: timerPreset, timerAdd: timerAdd,
    newSw: newSw, swElapsed: swElapsed, swStart: swStart, swStop: swStop, swLap: swLap, swReset: swReset,
    schedNow: schedNow, events: events
  };
})();
if (typeof module !== 'undefined') module.exports = ClockCore;

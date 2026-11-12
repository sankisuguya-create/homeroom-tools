/* 音。音源ファイルを持たず、ブラウザの中で合成する（通信なし・読み込み待ちなし）。
   ブラウザは利用者が画面を押すまで音を止めるので、最初の操作で unlock() を呼ぶ。
   音の型は既存のタイマーアプリ・キッチンタイマーに合わせる：
     終了音は止めるまで繰り返す（最長30秒）／予告は短い「ピッ ピッ」／残り10秒は毎秒「ピッ」。 */
var ClockSound = (function () {
  'use strict';
  var ctx = null, master = null, vol = 0.8, played = [], jaVoice = null;
  var buses = [], timers = [];
  var LOOP_MAX = 30000;

  function unlock() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) { ctx = new AC(); master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
  }
  function ready() { return !!ctx && ctx.state === 'running'; }
  function setVol(v) { vol = v; if (master) master.gain.value = v; }

  /* 1音。type が sine のときは倍音を足して鐘・木琴に近づける。 */
  function note(bus, freq, at, len, gain, type) {
    var t0 = ctx.currentTime + at, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
    if (type === 'square') g.gain.setValueAtTime(gain, t0 + len * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    g.connect(bus);
    (type === 'square' ? [[1, 1]] : [[1, 1], [2, 0.3], [3, 0.12], [4.2, 0.06]]).forEach(function (h) {
      var o = ctx.createOscillator(), hg = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq * h[0]; hg.gain.value = h[1];
      o.connect(hg); hg.connect(g); o.start(t0); o.stop(t0 + len + 0.05);
    });
  }
  var E5 = 659.25, C5 = 523.25, D5 = 587.33, G4 = 392.0, G5 = 783.99, C6 = 1046.5, E6 = 1318.5;
  /* 1回分の鳴り。ms はその長さ、loop は繰り返す間隔（終了音・アラームだけ）。 */
  var TUNES = {
    /* 電子音：キッチンタイマーの「ピピピピッ」 */
    alarm: { ms: 1000, loop: 1000, f: function (b) { for (var i = 0; i < 4; i++) note(b, 2048, i * 0.12, 0.07, 0.16, 'square'); } },
    /* ベル：目覚まし時計のように細かく打ち続ける */
    bell: { ms: 1500, loop: 1800, f: function (b) { for (var i = 0; i < 14; i++) note(b, i % 2 ? 2350 : 2500, i * 0.1, 0.35, 0.18); } },
    /* マリンバ：上がる3音（スマートフォンのアラームに多い型） */
    marimba: { ms: 1400, loop: 1600, f: function (b) { [C6, E6, G5 * 2].forEach(function (f, i) { note(b, f / 2, i * 0.18, 0.6, 0.45); note(b, f / 2, 0.75 + i * 0.18, 0.6, 0.45); }); } },
    /* 学校のチャイム（8音）。繰り返さない */
    school: { ms: 7000, f: function (b) { [E5, C5, D5, G4, G4, D5, E5, C5].forEach(function (f, i) { note(b, f, i * 0.6 + (i > 3 ? 0.6 : 0), (i % 4) === 3 ? 2.2 : 1.2, 0.5); }); } },
    /* 予告：短い「ピッ ピッ」 */
    warn: { ms: 450, f: function (b) { note(b, 1568, 0, 0.12, 0.18, 'square'); note(b, 1568, 0.25, 0.12, 0.18, 'square'); } },
    /* 残り10秒：毎秒「ピッ」 */
    tick: { ms: 100, f: function (b) { note(b, 1568, 0, 0.06, 0.12, 'square'); } }
  };
  function bus() { var g = ctx.createGain(); g.connect(master); buses.push(g); return g; }
  /* 鳴らして、最初の1回が鳴り終わるまでのミリ秒を返す（声をその後ろに置くため）。
     loop の音は stop() まで、最長30秒くり返す。声がある時は2回目までの間をあけ、声を音と重ねない。 */
  function play(name, opts) {
    played.push(name);
    var t = TUNES[name];
    if (!t) return 0;
    unlock();
    if (!ctx) return 0;
    var b = bus();
    t.f(b);
    if (t.loop) {
      var gap = opts && opts.voiceGap ? 2600 : 0, start = Date.now();
      var next = function () {
        if (Date.now() - start > LOOP_MAX || buses.indexOf(b) < 0) return;
        t.f(b); timers.push(setTimeout(next, t.loop));
      };
      timers.push(setTimeout(next, t.loop + gap));
    }
    return t.ms;
  }
  /* 鳴っている音をすべて止める（画面や操作ボタンを押した時） */
  function stop() {
    timers.forEach(clearTimeout); timers = [];
    buses.forEach(function (g) { try { g.disconnect(); } catch (e) {} }); buses = [];
    if (window.speechSynthesis) speechSynthesis.cancel();
  }
  function ringing() { return timers.length > 0 && buses.length > 0; }

  function pickVoice() {
    if (!window.speechSynthesis) return;
    var vs = speechSynthesis.getVoices().filter(function (v) { return /^ja/i.test(v.lang); });
    jaVoice = vs.filter(function (v) { return v.localService; })[0] || vs[0] || null;
  }
  if (window.speechSynthesis) {
    pickVoice();
    if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', pickVoice);
  }
  function canSpeak() { return !!jaVoice; }
  /* 日本語の声が端末に無いときは読まない（外国語の声で日本語を読ませない）。 */
  function speak(text, delayMs) {
    played.push('voice:' + text);
    if (!jaVoice) return;
    timers.push(setTimeout(function () {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP'; u.voice = jaVoice; u.volume = vol; u.rate = 1;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    }, delayMs || 0));
  }
  return { unlock: unlock, ready: ready, setVol: setVol, play: play, stop: stop, ringing: ringing, speak: speak, canSpeak: canSpeak, played: played };
})();

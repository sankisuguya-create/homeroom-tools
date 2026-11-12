/* 音。音源ファイルを持たず、ブラウザの中で合成する（通信なし・読み込み待ちなし）。
   ブラウザは利用者が画面を押すまで音を止めるので、最初の操作で unlock() を呼ぶ。 */
var ClockSound = (function () {
  'use strict';
  var ctx = null, master = null, vol = 0.8, played = [], jaVoice = null;

  function unlock() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) { ctx = new AC(); master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
  }
  function ready() { return !!ctx && ctx.state === 'running'; }
  function setVol(v) { vol = v; if (master) master.gain.value = v; }

  /* 1音。倍音を少し足した正弦波を、打ってから減衰させる（鐘・木琴に近い鳴り方）。 */
  function note(freq, at, len, gain, type) {
    var t0 = ctx.currentTime + at, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    g.connect(master);
    [[1, 1], [2, 0.28], [3, 0.1]].forEach(function (h) {
      if (type === 'square' && h[0] > 1) return;
      var o = ctx.createOscillator(), hg = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq * h[0]; hg.gain.value = h[1];
      o.connect(hg); hg.connect(g); o.start(t0); o.stop(t0 + len + 0.05);
    });
  }
  var E5 = 659.25, C5 = 523.25, D5 = 587.33, G4 = 392.0;
  var TUNES = {
    /* 学校のチャイムの前半4音 */
    chime: function () { [E5, C5, D5, G4].forEach(function (f, i) { note(f, i * 0.6, i === 3 ? 2.2 : 1.1, 0.5); }); return 4000; },
    /* 前半＋後半の8音（時間割の区切り） */
    school: function () { [E5, C5, D5, G4, G4, D5, E5, C5].forEach(function (f, i) { note(f, i * 0.6 + (i > 3 ? 0.6 : 0), (i % 4) === 3 ? 2.2 : 1.1, 0.5); }); return 7000; },
    soft: function () { note(880, 0, 1.6, 0.45); note(659.25, 0.55, 2.2, 0.45); return 2800; },
    beep: function () { for (var r = 0; r < 3; r++) for (var i = 0; i < 3; i++) note(2000, r * 0.9 + i * 0.16, 0.1, 0.22, 'square'); return 2700; },
    warn: function () { note(783.99, 0, 1.4, 0.4); return 1400; },
    tick: function () { note(1000, 0, 0.07, 0.25); return 80; },
    none: function () { return 0; }
  };
  /* 鳴らして、鳴り終わるまでのミリ秒を返す（声をその後ろに置くため）。 */
  function play(name) {
    played.push(name);
    if (name === 'none' || !TUNES[name]) return 0;
    unlock();
    if (!ctx) return 0;
    return TUNES[name]();
  }

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
    setTimeout(function () {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP'; u.voice = jaVoice; u.volume = vol; u.rate = 0.95;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    }, delayMs || 0);
  }
  return { unlock: unlock, ready: ready, setVol: setVol, play: play, speak: speak, canSpeak: canSpeak, played: played };
})();

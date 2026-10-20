/* クラス分け：操作（入れ替え・戻す・固定・複製・全画面）。ui-split.js の中に差し込まれる（同じ閉じた範囲の変数を使う）。単独では動かない */
  // ===== 操作 =====
  function apply(p, ch) { ch.forEach(function (x) { p.asg[x[0]] = x[1]; }); }
  function doMove(changes, msg) {
    var p = S.plans[S.active], prev = changes.map(function (x) { return [x[0], p.asg[x[0]]]; });
    apply(p, changes); p.hist.push({ prev: prev, next: changes, msg: msg }); p.fut = []; p.edits++;
    S.sel = -1; S.follow = null; render(); persist(); App.toast(msg, undo);
    flash(changes.map(function (x) { return x[0]; }));
  }
  function undo() { if (S.view !== 'plan' || S.decision) return; var p = S.plans[S.active], h = p.hist.pop(); if (!h) return; apply(p, h.prev); p.fut.push(h); p.edits--; S.sel = -1; S.follow = null; render(); persist(); App.toast('戻しました：' + h.msg); }
  function redo() { if (S.view !== 'plan' || S.decision) return; var p = S.plans[S.active], h = p.fut.pop(); if (!h) return; apply(p, h.next); p.hist.push(h); p.edits++; S.sel = -1; S.follow = null; render(); persist(); App.toast('やり直しました：' + h.msg); }
  function tapChip(i) {
    if (S.decision) return;
    var p = S.plans[S.active];
    if (S.sel < 0) { S.sel = i; updateSel(); return; }
    if (S.sel === i) { S.sel = -1; S.follow = null; updateSel(); return; }
    if (p.asg[S.sel] === p.asg[i]) { if (S.follow != null) { App.toast('別の組の児童を選んでください'); return; } S.sel = i; updateSel(); return; }
    var d = E.buildSwap(ctxFor(p.gen), p.asg, p.locks, S.sel, i); // 補う児童は、その案を作った重みで選ぶ
    if (d.err) App.toast(d.err); else swapDialog(d);
  }
  function tapHead(k) {
    if (S.decision) return;
    var p = S.plans[S.active];
    if (S.sel < 0 || p.asg[S.sel] === k) return;
    var d = E.buildMove(S.ctx, p.asg, p.locks, S.sel, k);
    if (d.err) App.toast(d.err); else swapDialog(d);
  }
  function toggleLock() {
    if (S.decision) return;
    var p = S.plans[S.active];
    if (S.sel < 0) { App.toast('先に児童を選んでください'); return; }
    var i = S.sel;
    if (p.locks.has(i)) p.locks.delete(i); else p.locks.add(i);
    var el = App.$('board').querySelector('.chip[data-i="' + i + '"]');
    if (el) el.classList.toggle('locked', p.locks.has(i));
    persist(); App.toast(S.P.kids[i].name + '：' + (p.locks.has(i) ? '固定しました' : '固定を外しました'));
  }
  function flash(ids) {
    requestAnimationFrame(function () {
      ids.forEach(function (i) { var el = document.querySelector('.board .chip[data-i="' + i + '"]'); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } });
    });
  }
  // 案を消す：確かめてから消し、通知欄の「戻す」で元の位置に戻せる
  function delDialog(pi) {
    if (S.plans.length < 2 || S.decision) return;
    var p = S.plans[pi], nm = '案' + p.letter;
    App.openDlg({
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="案を削除" style="max-width:480px"><h2>' + App.esc(planName(p)) + 'を削除しますか</h2>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">削除する<kbd>Enter</kbd></button></div></div></div>';
      },
      onOk: function () {
        App.closeDlg();
        var at = S.plans.indexOf(p); if (at < 0) return;
        S.plans.splice(at, 1);
        if (S.active >= S.plans.length) S.active = S.plans.length - 1; else if (S.active > at) S.active--;
        S.sel = -1; S.follow = null; render(); persist();
        App.toast(nm + 'を削除しました', function () {
          if (S.decision || S.plans.indexOf(p) >= 0) return;
          S.plans.splice(Math.min(at, S.plans.length), 0, p); S.active = S.plans.indexOf(p); S.view = 'plan'; render(); persist();
        });
      }
    });
  }
  function dup() {
    if (S.view !== 'plan' || S.decision) return;
    var p = S.plans[S.active];
    var q = { letter: LET[S.letIdx++ % 26], name: p.name, auto: p.auto, gen: JSON.parse(JSON.stringify(p.gen)), asg: Int8Array.from(p.asg), locks: new Set(p.locks), hist: [], fut: [], edits: 0, from: '案' + p.letter };
    S.plans.push(q); S.active = S.plans.length - 1; S.sel = -1; S.follow = null; render(); persist();
    App.toast('案' + p.letter + 'を複製して案' + q.letter + 'を作りました');
  }
  function fullscreen() {
    var d = document;
    if (d.fullscreenElement) { if (d.exitFullscreen) d.exitFullscreen(); }
    else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(function () { App.toast('この表示では全画面にできません。F11キーを使ってください'); });
  }
  function selectPlan(pi) { S.active = pi; S.view = 'plan'; S.sel = -1; S.follow = null; render(); }

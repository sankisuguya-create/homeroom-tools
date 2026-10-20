/* クラス分け：確認の枠・案を作る窓・個人票の印刷・組の番号・決定。ui-split.js の中に差し込まれる（同じ閉じた範囲の変数を使う）。単独では動かない */
  // ===== 確認の枠 =====
  function chipsSide(ids, from, to, ex) {
    return '<div class="side"><div class="lab"><b>' + C.newClass(from) + '</b> → ' + C.newClass(to) + '</div>' + ids.map(function (i) { return chipHTML(i, ex && ex.indexOf(i) >= 0 ? 'extra' : ''); }).join('') + '</div>';
  }
  function swapDialog(d) {
    var p = S.plans[S.active];
    App.openDlg({
      focus: 'okbtn', d: d,
      html: function () {
        var left, right, arrow, title, ex = [], note = '';
        if (d.type === 'swap') { var r = E.swapChanges(d); d.ch = r.ch; ex = r.ex; left = r.A; right = r.B; arrow = '⇄'; title = '入れ替えますか？'; }
        else { left = d.GA; arrow = '→'; title = C.newClass(d.kb) + 'へ移しますか？'; }
        if (d.GA.length > 1 || (d.GB && d.GB.length > 1)) note += '<span>「つける」の相手と一緒に動かします。</span>';
        if (ex.length) note += '<span><b>' + ex.map(function (i) { return App.esc(S.P.kids[i].name); }).join('・') + '</b> は人数を合わせるため自動で選びました（偏りが最も小さくなる児童）。</span>' +
          (d.cands.length > d.cnt ? '<button class="btn" data-act="next">別の児童にする（' + ((d.ci / d.cnt | 0) + 1) + '/' + Math.floor(d.cands.length / d.cnt) + '）<kbd>Tab</kbd></button>' : '');
        var br = E.farBreaks(S.ctx, p.asg, d.ch), warn = '';
        d.br = br; d.next = null;
        if (br.length) {
          var tgt = E.farTargets(br, d.ch); d.next = tgt[0];
          warn = '<div class="farbox">離す児童と同じクラスになります。続けて離す児童の入れ替えに移ります。続行しますか？<div class="side" style="margin-top:6px"><div class="lab">離す児童（' + tgt.length + '人）</div>' +
            tgt.slice(0, 3).map(function (i) { return chipHTML(i, ''); }).join('') +
            (tgt.length > 3 ? '<details class="more"><summary>＋ あと' + (tgt.length - 3) + '人</summary><div class="side">' + tgt.slice(3).map(function (i) { return chipHTML(i, ''); }).join('') + '</div></details>' : '') + '</div></div>';
        }
        if (d.type === 'move' && E.sizeOf(p.asg, d.kb) + left.length > C.CAP) warn += '<div class="warnbox">✕ ' + C.newClass(d.kb) + 'が上限' + C.CAP + '人を超えます</div>';
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="' + title + '"><h2>' + title + '</h2>' +
          '<div class="swap">' + chipsSide(left, d.ka, d.kb, ex) + '<div class="arrow">' + arrow + '</div>' +
          (right ? chipsSide(right, d.kb, d.ka, ex) : '<div class="side"><div class="lab"><b>' + C.newClass(d.kb) + '</b>（' + E.sizeOf(p.asg, d.kb) + '人 → ' + (E.sizeOf(p.asg, d.kb) + left.length) + '人）</div></div>') + '</div>' +
          (note ? '<div class="notebox">' + note + '</div>' : '') + warn +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok" id="okbtn">' +
          (br.length ? '続行する' : d.type === 'swap' ? '入れ替える' : '移す') + '<kbd>Enter</kbd></button></div></div></div>';
      },
      onOk: function () {
        var names = d.type === 'swap' ? d.GA.map(function (i) { return S.P.kids[i].name; }).join('・') + ' ⇄ ' + E.swapChanges(d).B.map(function (i) { return S.P.kids[i].name; }).join('・')
          : d.GA.map(function (i) { return S.P.kids[i].name; }).join('・') + ' → ' + C.newClass(d.kb);
        App.closeDlg();
        doMove(d.ch, names);
        if (d.next != null) { S.follow = d.next; S.sel = d.next; updateSel(); flash([d.next]); }
      },
      onTab: function () { if (d.extraSide && d.cands.length > d.cnt) { E.nextCandidate(d); App.refreshDlg(); return true; } return false; }
    });
  }

  function genDialog() {
    var gen = JSON.parse(JSON.stringify(S.lastGen)), p = S.plans[S.active], O = ORDER.slice();
    var keep = !!(p && S.view === 'plan' && p.locks.size);
    App.openDlg({
      focus: 'okbtn',
      html: function () {
        var lvRow = function (x) {
          return '<tr><td>' + (x.sh ? App.mark(x, 1) + ' ' : '') + x.label + '</td><td><div class="lvs">' + C.LEVEL_NAMES.map(function (n, lv) {
            return '<button class="lv' + (lv === C.MUST ? ' must' : '') + '" data-w="' + x.k + '" data-lv="' + lv + '" aria-pressed="' + ((gen.w[x.k] | 0) === lv) + '">' + n + '</button>';
          }).join('') + '</div></td></tr>';
        };
        return '<div class="pop" data-close="1"><div class="dlg gen" role="dialog" aria-modal="true" aria-label="案を作る"><h2>案を作る</h2>' +
          '<div><b>必ず守る条件</b>（押すと外す／戻す）<div class="toggles" style="margin-top:6px">' + C.HARD.map(function (h) {
            return '<button class="tg" data-hard="' + h.k + '" aria-pressed="' + !!gen.hard[h.k] + '">' + h.label + '</button>';
          }).join('') + '</div></div>' +
          '<div><b>偏りの重み</b>（強いほど均等に分ける）<div class="gencols" style="margin-top:6px"><table>' + C.ATTRS.map(lvRow).join('') + '</table><table>' + C.EXTRA.map(lvRow).join('') + '</table></div></div>' +
          (Object.keys(gen.w).some(function (k) { return (gen.w[k] | 0) === C.MUST; }) ? '<div class="mustwarn">⚠ ' + C.MUST_WARN + '</div>' : '') +
          // 組の中の並び順（カードを並べる順）。目立つ枠で、ここで決めてから作る
          '<div class="ordbox"><b>組の中の並び順</b>（カードを並べる順。この端末に覚える）' + ['第一', '第二', '第三'].map(function (lab, i) {
            return '<div class="ordrow"><b>' + lab + '</b><div class="lvs">' + SORT_KEYS.concat([{ k: '', label: 'なし' }]).map(function (q) {
              return '<button class="lv" data-gord="' + i + ':' + q.k + '" aria-pressed="' + (O[i] === q.k) + '">' + q.label + '</button>';
            }).join('') + '</div></div>';
          }).join('') + '</div>' +
          '<div class="notebox">名前：案' + LET[S.letIdx % 26] + '（' + App.esc(E.autoName(gen, keep ? p.locks.size : 0)) + '）' + (keep ? '　今の案で固定した' + p.locks.size + '人はそのままの組に置きます' : '') + '</div>' +
          '<div class="acts"><button class="btn" data-act="reset">既定に戻す</button><span class="sp"></span><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button>' +
          '<button class="btn primary" data-act="ok" id="okbtn">この設定で作る<kbd>Enter</kbd></button></div></div></div>';
      },
      click: function (t) {
        var x;
        if ((x = t.closest('[data-w]'))) { gen.w[x.dataset.w] = +x.dataset.lv; App.refreshDlg(); if (+x.dataset.lv === C.MUST) App.toast(C.MUST_WARN); return true; }
        if ((x = t.closest('[data-gord]'))) { var gp = x.dataset.gord.split(':'); O[+gp[0]] = gp[1]; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-hard]'))) { gen.hard[x.dataset.hard] = !gen.hard[x.dataset.hard]; App.refreshDlg(); return true; }
        if (t.closest('[data-act="reset"]')) { gen = E.defaultGen(); App.refreshDlg(); return true; }
        return false;
      },
      onOk: function () {
        App.closeDlg();
        S.lastGen = gen; ORDER = O;
        try { localStorage.setItem('classSplit.order', JSON.stringify(ORDER)); } catch (e) { /* 覚えられなくても今の画面には効く */ }
        var locked = keep ? (function () { var m = new Map(); p.locks.forEach(function (i) { m.set(i, p.asg[i]); }); return m; })() : new Map();
        var r = addGenerated(gen, locked, keep ? '案' + p.letter + 'の固定' : null);
        render(); persist(); deal();
        App.toast(planName(r.p) + 'を作りました（' + r.ms + 'ms）');
      }
    });
  }

  // 作った案は一度に出す（待たせない）。＋付きのカードだけ、少しの間ふちを光らせて目立たせる
  var DEAL = null, PRT_CLOSE = null;
  function deal() {
    var board = App.$('board'); if (!board) return;
    var plus = []; board.querySelectorAll('.chip').forEach(function (c) { if (hasPlus(S.P.kids[+c.dataset.i])) { c.classList.add('plusin'); plus.push(c); } });
    if (!plus.length) return;
    DEAL = { t: setTimeout(function () { plus.forEach(function (c) { c.classList.remove('plusin'); }); DEAL = null; }, 1600) };
  }

  function renameDialog(pi) {
    var p = S.plans[pi];
    App.openDlg({
      focus: 'rnm',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="名前を変える" style="max-width:480px"><h2>案' + p.letter + 'の名前</h2>' +
          '<input type="text" id="rnm" value="' + App.esc(p.name || p.auto) + '"><div class="note">空にすると自動の名前（' + App.esc(p.auto) + '）に戻ります</div>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">変える<kbd>Enter</kbd></button></div></div></div>';
      },
      onOk: function () { var v = App.$('rnm').value.trim(); p.name = v === p.auto ? '' : v; App.closeDlg(); render(); persist(); }
    });
  }

  function confirmDialog(title, body, word, btn, run) {
    App.openDlg({
      focus: 'cword',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="' + title + '" style="max-width:620px"><h2>' + title + '</h2>' + body +
          '<label>確かめるため「<b>' + word + '</b>」と入力してください<br><input type="text" id="cword" style="width:100%;margin-top:4px" autocomplete="off"></label>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn danger" data-act="ok">' + btn + '</button></div></div></div>';
      },
      onOk: function () {
        if (App.$('cword').value.trim() !== word) { App.toast('入力した語が違います'); return; }
        App.closeDlg(); run();
      }
    });
  }

  // 決定した組の番号。未設定の間は仮（A組＝1組…）
  // ===== 個人票の印刷 =====
  // 18×5cm の票を A4 縦に5枚、隙間なしで並べる（裁断機で切って既存の個人票に貼る）。新しい組ごとに改ページし、組の中は五十音順。
  // 左は上に良い項目（緑）、名前、下に負担の4項目と事案数。右上に配慮（紫）と備考、右下に離す・つける。色はアイコンと旧学級の帯（濃い方）だけ。女子は左を半円（画面のカードと同じ形）。字は枠に収まるまで縮める（下限6pt）
  var PRINT_PER_PAGE = 5, PRINT_MIN_PT = 6;
  function printCards() {
    var p = S.plans[S.active], kids = S.P.kids, esc = App.esc;
    var named = S.decision && S.decision.named, names = namesOf();
    var clsName = function (k) { return named ? names[k] + '組' : C.newClass(k) + (S.decision ? '' : '（案' + p.letter + '）'); };
    var rel = kids.map(function () { return { far: [], near: [] }; });
    S.P.pairs.forEach(function (q) {
      if (q.t !== 'far' && q.t !== 'near') return;
      rel[q.i][q.t].push(q.j); rel[q.j][q.t].push(q.i);
    });
    var side = C.ATTRS.filter(function (at) { return at.side; });
    var card = function (i) {
      var s = kids[i], a = s.a || {}, oc = App.classColor(s.old);
      // 項目ごとに決まった位置に出す（無い項目は見えないアイコンで場所を取る）
      var ic = function (good) { return C.ATTRS.filter(function (at) { return !at.side && !at.good === !good; }).map(function (at) { var v = a[at.k] | 0; return v ? App.mark(at, v) : '<span class="ph" aria-hidden="true">' + App.mark(at, 1) + '</span>'; }).join(''); };
      var who = function (js) { return js.map(function (j) { return esc(kids[j].name); }).join('・'); };
      var bot = (rel[i].far.length ? '<div><b>離</b> ' + who(rel[i].far) + '</div>' : '') + (rel[i].near.length ? '<div><b>つ</b> ' + who(rel[i].near) + '</div>' : '');
      var top = side.filter(function (at) { return a[at.k] | 0; }).map(function (at) { return '<div>' + App.mark(at, 1) + ' ' + esc(a[at.k + '_t'] || '') + '</div>'; }).join('') +
        (a.memo ? '<div><b>備考</b> ' + esc(a.memo) + '</div>' : '');
      return '<div class="pc ' + (s.male ? 'm' : 'f') + '"><div class="pc-in">' +
        '<div class="pc-band" style="background:' + oc.c + '"></div>' +
        '<div class="pc-l"><div class="pc-ic">' + ic(true) + (a.sp ? '<span class="pc-sp">特支</span>' : '') + '</div><div class="pc-kana">' + esc(s.kana || '') + '</div><div class="pc-name">' + esc(s.name) + '</div>' +
        '<div class="pc-ic">' + ic(false) + '<span class="pc-ji">' + App.incBox(S.ji[i], S.jv[i], '', true) + '</span>' + '</div></div>' +
        '<div class="pc-r"><div class="pc-t fit">' + top + '</div><div class="pc-b fit">' + bot + '</div></div>' +
        '<div class="pc-fam"><div>家庭環境</div><div>父子・母子</div><div>生保・就援</div><div>兄弟（　 年）</div></div>' +
        '</div></div>';
    };
    var pages = [], total = 0;
    for (var k = 0; k < S.P.nc; k++) {
      var ids = [];
      kids.forEach(function (s, i) { if (p.asg[i] === k) ids.push(i); });
      ids.sort(function (x, y) { return String(kids[x].kana).localeCompare(String(kids[y].kana), 'ja'); });
      var np = Math.ceil(ids.length / PRINT_PER_PAGE) || 1;
      for (var pg = 0; pg < np; pg++) {
        var part = ids.slice(pg * PRINT_PER_PAGE, (pg + 1) * PRINT_PER_PAGE);
        total += part.length;
        pages.push('<div class="pp"><div class="pp-h">' + App.st.grade + '年 ' + esc(clsName(k)) + '　' + (pg + 1) + '/' + np + '</div>' + part.map(card).join('') +
          '<div class="pp-f"><span class="pp-ruler"></span>この線が10cmなら実寸（倍率100%・余白なしで印刷）</div></div>');
      }
    }
    var box = document.createElement('div');
    box.id = 'printbox';
    box.innerHTML = '<div class="pbar"><b>個人票の印刷（' + total + '枚・' + pages.length + 'ページ）</b><span id="pover"></span><span class="pnote">印刷の設定は「用紙 A4」「倍率 100%（実際のサイズ）」「余白 なし」。「用紙に合わせる」にすると大きさが変わります</span><span class="sp"></span>' +
      '<button class="btn primary" id="pgo">印刷する</button><button class="btn" id="pclose">閉じる<kbd>Esc</kbd></button></div>' +
      '<div class="pages">' + pages.join('') + '</div>';
    document.body.appendChild(box);
    document.body.classList.add('printing');
    // 字を枠に収まるまで縮める。下限でも収まらない票は数えて知らせる
    var over = 0;
    box.querySelectorAll('.fit').forEach(function (el) {
      var pt = 9;
      el.style.fontSize = pt + 'pt';
      while (el.scrollHeight > el.clientHeight + 1 && pt > PRINT_MIN_PT) { pt -= .5; el.style.fontSize = pt + 'pt'; }
      if (el.scrollHeight > el.clientHeight + 1) { over++; el.classList.add('over'); }
    });
    // 長い名前は横幅だけを縮める（縦の大きさはそのまま）
    box.querySelectorAll('.pc-name').forEach(function (el) {
      var room = el.parentNode.clientWidth - 2 * parseFloat(getComputedStyle(el.parentNode).paddingLeft), w = el.scrollWidth;
      if (w > room) el.style.transform = 'scaleX(' + (room / w).toFixed(3) + ')';
    });
    if (over) box.querySelector('#pover').textContent = '　⚠ ' + over + 'か所が' + PRINT_MIN_PT + 'ptでも入りきりません（赤い点線の枠）';
    var close = function () { document.removeEventListener('keydown', onKey, true); box.remove(); document.body.classList.remove('printing'); PRT_CLOSE = null; };
    PRT_CLOSE = close; // 画面を離れる時にも閉じる（Esc を握ったまま残さない）
    var onKey = function (e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    box.addEventListener('click', function (e) {
      if (e.target.closest('#pclose')) close();
      else if (e.target.closest('#pgo')) window.print();
    });
  }

  function namesOf() { var d = S.decision, n = d && d.names; return n && n.length ? n : Array.from({ length: S.P.nc }, function (_, k) { return k + 1; }); }
  function namesText() {
    return namesOf().map(function (v, k) { return C.newClass(k) + '＝' + v + '組'; }).join('・') + (S.decision.named ? '' : '（仮）');
  }
  function namesDialog() {
    var N = namesOf().slice(), grade = App.st.grade;
    App.openDlg({
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="組の番号を決める" style="max-width:560px"><h2>組の番号を決める</h2>' +
          N.map(function (v, k) {
            return '<div class="ordrow"><b class="ncl">' + C.newClass(k) + '</b><span>→</span><div class="lvs">' + N.map(function (_, j) {
              return '<button class="lv" data-cn="' + k + ':' + (j + 1) + '" aria-pressed="' + (v === j + 1) + '">' + (j + 1) + '組</button>';
            }).join('') + '</div></div>';
          }).join('') +
          '<div class="note">番号を押すと、その番号だった組と入れ替わります。保存すると、来年度の名簿の組が付け替わります（出席番号は組の中で変わりません）。後から何度でも直せます。</div>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">この番号にする<kbd>Enter</kbd></button></div></div></div>';
      },
      click: function (t) {
        var x = t.closest('[data-cn]'); if (!x) return false;
        var p = x.dataset.cn.split(':'), k = +p[0], v = +p[1], j = N.indexOf(v);
        N[j] = N[k]; N[k] = v; App.refreshDlg(); return true;
      },
      onOk: function () {
        App.closeDlg();
        App.save(function () { return App.pf().setClassNames(grade, N); }).then(function () { return App.reload(); })
          .then(function () { App.toast('組の番号を決めました：' + N.map(function (v, k) { return C.newClass(k) + '＝' + v + '組'; }).join('・')); });
      }
    });
  }

  function decideDialog() {
    var p = S.plans[S.active], a = E.analyze(S.ctx, p.asg), grade = App.st.grade;
    var body = '<p>' + App.esc(planName(p)) + ' で決定します。次のことを行います。</p><ul><li>' + (grade + 1) + '年の名簿を作ります（新しい番号は組ごとの男女混合の五十音順）</li>' +
      '<li>組の番号は仮で A組＝1組・B組＝2組… にします。番号は後で「組の番号を決める」で決めます</li><li>今年度の配慮項目の値を、来年度に写します。今年度の値はこの時点で凍結されます</li><li>つける・離すを、来年度の候補として持ち越します</li></ul>' +
      (a.bad.length ? '<div class="warnbox">✕ この案には違反が' + a.bad.length + '件あります</div>' : '') + '<p class="note">4/1までは取り消せます。</p>';
    confirmDialog('クラス替えを決定', body, grade + '年のクラス替えを決定', '決定する', function () {
      var assign = {}; S.P.kids.forEach(function (s, i) { assign[s.id] = p.asg[i]; });
      App.save(function () { return App.pf().savePlans(grade, serialize()).then(function () { return App.pf().decide(grade, { name: planName(p), assign: assign }); }); })
        .then(function () { return App.reload(); }).then(function () { App.toast('決定しました'); });
    });
  }
  function undoDecideDialog() {
    var grade = App.st.grade;
    confirmDialog('決定を取り消す', '<p>来年度の名簿と、写した配慮項目の値を消します。来年度の側で直した値も消えます。</p>', grade + '年の決定を取り消す', '取り消す', function () {
      App.save(function () { return App.pf().undoDecide(grade); }).then(function () { return App.reload(); }).then(function () { App.toast('決定を取り消しました'); });
    });
  }

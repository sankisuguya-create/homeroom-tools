/* クラス分け：つける・離す・転入生・違反の一覧・ショートカット。ui-split.js の中に差し込まれる（同じ閉じた範囲の変数を使う）。単独では動かない */
  // ===== つける・離す・組に固定 =====
  // 学年全体で1つの表。保存すると読み込み直し、案の違反の判定に反映する（案そのものは変えない）
  var PT = { far: '離す', near: 'つける', fix: '組に固定' };
  // 新年度の転入生：足すと、すべての案でいちばん人数の少ない組に入る。決定で来年度の名簿に入る
  function transDialog() {
    var grade = App.st.grade, F = { name: '', kana: '', male: true, id: '' }, busy = false;
    var list = function () { return S.P.kids.filter(function (s) { return s.tr; }); };
    // 足す・消すの前に、手元の案を保存してから読み直す（案の入れ替えを失わない）
    var run = function (fn) {
      if (busy) return; busy = true;
      clearTimeout(saveT);
      App.save(function () { return App.pf().savePlans(grade, serialize()); })
        .then(function () { return App.save(fn); })
        .then(function () { App.closeDlg(); return App.reload(); }).then(function () { transDialog(); });
    };
    App.openDlg({
      focus: 'trName',
      html: function () {
        var esc = App.esc, L = list();
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="転入生" style="max-width:560px"><h2>新年度の転入生（' + grade + '年→' + (grade + 1) + '年）</h2>' +
          (L.length ? '<table class="r"><tbody>' + L.map(function (s) {
            return '<tr><td>' + (s.male ? '男' : '女') + '</td><td style="text-align:left"><b>' + esc(s.name) + '</b> <span class="note">' + esc(s.kana) + '</span></td><td class="note">' + (s.id.charAt(0) === 'T' ? 'IDは未定' : esc(s.id)) + '</td>' +
              '<td><button class="btn" data-trdel="' + esc(s.id) + '">消す</button></td></tr>';
          }).join('') + '</tbody></table>' : '<div class="note">まだいません。</div>') +
          '<div class="trf"><input id="trName" placeholder="名前（例：中島 リス）" value="' + esc(F.name) + '"><input id="trKana" placeholder="よみ（番号の五十音順に使う）" value="' + esc(F.kana) + '">' +
          '<span class="lvs"><button class="lv" data-trsex="1" aria-pressed="' + F.male + '">男</button><button class="lv" data-trsex="0" aria-pressed="' + !F.male + '">女</button></span>' +
          '<input id="trId" inputmode="numeric" maxlength="8" placeholder="児童ID（分かれば。8桁）" value="' + esc(F.id) + '"></div>' +
          '<div class="note">足すと、どの案でもいちばん人数の少ない組に入ります。カードは灰色の帯・白い地で出ます。</div>' +
          '<div class="acts"><button class="btn" data-act="close">閉じる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">足す<kbd>Enter</kbd></button></div></div></div>';
      },
      input: function (t) { if (t.id === 'trName') F.name = t.value; if (t.id === 'trKana') F.kana = t.value; if (t.id === 'trId') F.id = t.value; },
      click: function (t) {
        var x;
        if ((x = t.closest('[data-trsex]'))) { F.male = x.dataset.trsex === '1'; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-trdel]'))) { var id = x.dataset.trdel; run(function () { return App.pf().removeTransfer(grade, id); }); return true; }
        return false;
      },
      onOk: function () {
        if (!F.name.trim()) { App.toast('名前を入れてください'); return; }
        var x = { name: F.name, kana: F.kana, male: F.male, id: F.id };
        run(function () { return App.pf().addTransfer(grade, x); });
      }
    });
  }

  function pairsDialog() {
    App.pairsDialog({
      kids: S.P.kids.map(function (s) { return { id: s.id, name: s.name, kana: s.kana, no: s.no, cls: s.old }; }), nc: S.P.nc, pre: '旧',
      // 案を先に保存してから読み込み直す（案は残る）
      save: function (list) { var grade = App.st.grade, data = serialize(); clearTimeout(saveT); return App.pf().savePlans(grade, data).then(function () { return App.pf().savePairs(grade, list); }); }
    });
  }

  // つける・離す・組に固定の窓。クラス分けの画面と名簿の画面から開く
  // o: { kids:[{id,name,kana,no,cls}], nc, pre:'旧'|'', a:最初に選んでおく児童, save:function(list)→Promise }
  App.pairsDialog = function (o) {
    var d = App.st.data, esc = App.esc, kids = o.kids, kidOf = {};
    kids.forEach(function (s) { kidOf[s.id] = s; });
    var list = d.pairs.map(function (p) { return JSON.parse(JSON.stringify(p)); });
    var carry = (d.carry || []).slice();
    var F = { t: 'far', a: o.a || null, b: null, k: 0, memo: '' };
    var cl = function (s) { return s.cls < 0 ? '転入' : o.pre + (s.cls + 1) + '組'; };
    var nm = function (id) { var s = kidOf[id]; return s ? s.name + '（' + cl(s) + '）' : id; };
    var desc = function (p) { return p.t === 'fix' ? nm(p.a) + ' → ' + C.newClass(p.k) : nm(p.a) + ' と ' + nm(p.b); };
    var sugg = function (q, slot) {
      q = (q || '').trim();
      if (!q) return '';
      var hit = kids.filter(function (s) { return s.name.indexOf(q) >= 0 || s.kana.indexOf(q) >= 0 || s.id.indexOf(q) === 0; }).slice(0, 8);
      return hit.length ? '<div class="sugg">' + hit.map(function (s) { return '<button type="button" data-pk="' + slot + ':' + s.id + '">' + cl(s) + (s.no ? s.no + '番 ' : ' ') + esc(s.name) + '</button>'; }).join('') + '</div>' : '<div class="note">見つかりません</div>';
    };
    var pick = function (slot) {
      var id = F[slot];
      return id ? '<span class="picked"><span>' + esc(nm(id)) + '<button type="button" data-unpk="' + slot + '" aria-label="外す">×</button></span></span>' :
        '<input id="q' + slot + '" placeholder="名前・よみ・児童IDで探す" autocomplete="off" style="padding:4px 6px;border:1px solid var(--line);border-radius:4px"><div id="s' + slot + '"></div>';
    };
    var canAdd = function () { return F.a && (F.t === 'fix' ? true : F.b && F.b !== F.a); };
    App.openDlg({
      focus: F.a ? 'qb' : 'qa',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="つける・離す"><h2>つける・離す・組に固定</h2>' +
          '<div class="form"><div class="toggles">' + ['far', 'near', 'fix'].map(function (t) { return '<button class="tg" data-pt="' + t + '" aria-pressed="' + (F.t === t) + '">' + PT[t] + '</button>'; }).join('') + '</div>' +
          '<div class="row" style="align-items:flex-start"><div>' + pick('a') + '</div><div>' + (F.t === 'fix' ?
            '<div class="lvs">' + Array.from({ length: o.nc }, function (_, k) { return '<button class="lv" data-pkc="' + k + '" aria-pressed="' + (F.k === k) + '">' + C.newClass(k) + '</button>'; }).join('') + '</div>' : pick('b')) + '</div></div>' +
          '<div class="row"><input id="pmemo" placeholder="メモ（任意・氏名は書かない）" value="' + esc(F.memo) + '" style="padding:4px 6px;border:1px solid var(--line);border-radius:4px"><button class="btn" id="padd"' + (canAdd() ? '' : ' disabled') + '>追加</button></div></div>' +
          '<div class="tw" style="max-height:220px"><table class="r ro"><thead><tr><th>種類</th><th style="text-align:left">児童</th><th style="text-align:left">メモ</th><th></th></tr></thead><tbody>' +
          (list.map(function (p, i) { return '<tr><td>' + PT[p.t] + '</td><td style="text-align:left">' + esc(desc(p)) + '</td><td style="text-align:left">' + esc(p.memo || '') + '</td><td><button class="btn" data-pdel="' + i + '">削除</button></td></tr>'; }).join('') ||
            '<tr><td colspan="4" class="empty">まだありません</td></tr>') + '</tbody></table></div>' +
          (carry.length ? '<div><b>前年度からの候補</b>（採用すると上の表に入る）<div class="tw" style="max-height:140px"><table class="r ro"><tbody>' + carry.map(function (p, i) {
            return '<tr><td>' + PT[p.t] + '</td><td style="text-align:left">' + esc(desc(p)) + '</td><td><button class="btn" data-pcar="' + i + '">採用</button></td></tr>';
          }).join('') + '</tbody></table></div></div>' : '') +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok" id="okbtn">保存する（' + list.length + '件）</button></div></div></div>';
      },
      input: function (t) {
        if (t.id === 'qa' || t.id === 'qb') { var slot = t.id.slice(1); App.$('s' + slot).innerHTML = sugg(t.value, slot); }
        else if (t.id === 'pmemo') F.memo = t.value;
      },
      click: function (t) {
        var x;
        if ((x = t.closest('[data-pt]'))) { F.t = x.dataset.pt; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-pk]'))) { var v = x.dataset.pk.split(':'); F[v[0]] = v[1]; App.refreshDlg(); var q = App.$(v[0] === 'a' ? 'qb' : 'qa'); if (q) q.focus(); return true; }
        if ((x = t.closest('[data-unpk]'))) { F[x.dataset.unpk] = null; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-pkc]'))) { F.k = +x.dataset.pkc; App.refreshDlg(); return true; }
        if (t.closest('#padd')) {
          if (!canAdd()) return true;
          list.push(F.t === 'fix' ? { t: 'fix', a: F.a, k: F.k, memo: F.memo } : { t: F.t, a: F.a, b: F.b, memo: F.memo });
          F = { t: F.t, a: null, b: null, k: F.k, memo: '' }; App.refreshDlg(); return true;
        }
        if ((x = t.closest('[data-pdel]'))) { list.splice(+x.dataset.pdel, 1); App.refreshDlg(); return true; }
        if ((x = t.closest('[data-pcar]'))) { var c = carry.splice(+x.dataset.pcar, 1)[0]; list.push(JSON.parse(JSON.stringify(c))); App.refreshDlg(); return true; } // 経緯・理由・何年生からも引き継ぐ
        return false;
      },
      onOk: function () {
        var n = list.length;
        App.closeDlg();
        App.save(function () { return o.save(list); })
          .then(function () { return App.reload(); }).then(function () { App.toast('つける・離すを保存しました（' + n + '件）'); });
      }
    });
  };

  function showViol() {
    var a = E.analyze(S.ctx, S.plans[S.active].asg), r = App.$('vbtn').getBoundingClientRect(), esc = App.esc;
    App.openDlg({
      html: function () {
        return '<div class="pop" data-close="1" style="background:transparent;align-items:flex-start;justify-content:flex-start"><div class="viol" style="top:' + (r.bottom + 4) + 'px;left:' + Math.max(8, r.left) + 'px"><ul>' +
          a.bad.map(function (x) { return '<li data-ids="' + x.ids.join(',') + '"><span class="k bad">✕ 違反</span> ' + esc(x.txt) + '</li>'; }).join('') +
          a.warn.map(function (x) { return '<li data-wk="' + x.k + '" data-wm="' + x.m + '"><span class="k">△ 偏り</span> ' + esc(x.txt) + '</li>'; }).join('') +
          (a.bad.length + a.warn.length ? '' : '<li>違反・偏りはありません</li>') + '</ul></div></div>';
      },
      noEnter: true,
      click: function (t) {
        var li = t.closest('.viol li');
        if (!li) return false;
        App.closeDlg();
        if (li.dataset.ids) flash(li.dataset.ids.split(',').filter(Boolean).map(Number));
        else if (li.dataset.wk) {
          var k = +li.dataset.wk, m = +li.dataset.wm, p = S.plans[S.active], ids = [];
          for (var i = 0; i < S.ctx.N; i++) if (p.asg[i] === k && (m === S.ctx.M || S.ctx.VAL[i][m] > 0)) ids.push(i);
          if (m !== S.ctx.M) flash(ids);
        }
        return true;
      }
    });
  }
  function helpDialog() {
    var keys = [['クリック → クリック', '入れ替え（確認の枠が出る）'], ['Enter', '確認の枠で実行'], ['Esc', '選択の解除・枠を閉じる'], ['Ctrl+Z', '元に戻す'], ['Ctrl+Y／Ctrl+Shift+Z', 'やり直す'],
      ['1〜9', '案のタブを切り替え'], ['0', '比較'], ['G', '案を作る（設定の枠。Enterで前回の設定のまま作る）'], ['D', 'この案を複製'], ['Delete', 'この案を削除（通知の「戻す」で戻せる）'], ['P', 'つける・離す・組に固定'], ['L', '選択中の児童を固定／解除'], ['V', '違反・偏りの一覧'], ['F', '全画面'], ['?', 'この一覧']];
    App.openDlg({
      focus: 'okbtn',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg help" role="dialog" aria-modal="true" aria-label="ショートカット" style="max-width:600px"><h2>ショートカット</h2><table>' +
          keys.map(function (k) { return '<tr><td><kbd>' + k[0] + '</kbd></td><td>' + k[1] + '</td></tr>'; }).join('') +
          '</table><div class="acts"><button class="btn primary" data-act="close" id="okbtn">閉じる<kbd>Esc</kbd></button></div></div></div>';
      },
      onOk: function () { App.closeDlg(); }
    });
  }

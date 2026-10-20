/* 事案管理：出力（Excel・コピー用の表）、行の追加、戻す。ui-incidents.js の中に差し込まれる（同じ閉じた範囲の変数を使う）。単独では動かない */
  // ===== 出力 =====
  var LABELS = null;
  function labels() {
    if (LABELS) return LABELS;
    var R = C.REPORT, H = R.head, L = {};
    L[H.school] = '学校名'; L[H.era] = '認知年月日：令和（年）'; L[H.month] = '認知年月日：月'; L[H.day] = '認知年月日：日'; L[H.wday] = '認知年月日：曜日';
    var row = function (r, who) { L['B' + r] = who + '：学年'; L['D' + r] = who + '：組'; L['G' + r] = who + '：性別'; L['I' + r] = who + '：ふりがな'; L['I' + (r + 1)] = who + '：名前'; };
    row(H.victim, '被害');
    R.harmRows.forEach(function (r, i) { row(r, '加害' + (i + 1)); });
    L[R.harmMore] = '加害：その他の人数'; L[R.found] = '発見のきっかけ'; L[R.modeOther] = '態様：その他の内容';
    C.MODES.forEach(function (m) { L[m.cell] = '態様：' + m.t; });
    L[R.f1.gaiyou] = 'いじめの概要（時系列）';
    L[R.f2.shido] = '指導の経過'; L[R.f2.victim] = '被害児童生徒及び保護者の現在の状況'; L[R.f2.harm] = '加害児童生徒及び保護者の現在の状況'; L[R.f2.kikan] = '関係機関との連携';
    return (LABELS = L);
  }
  function outDialog(x, kind) {
    // 被害の児童1人に1つの様式。矢印が無ければ最初の児童を被害の側とする
    var vs = realVictims(x); if (!vs.length) vs = x.ids.slice(0, 1);
    // どの児童を被害児童とする書類を作るかは、教員が選ぶ（1人だけなら選んだ状態で始める）
    var st = { victim: vs[0], pick: vs.length === 1 ? vs.slice() : [], made: [] };
    var cellsOf = function (v) {
      v = v || st.victim;
      return Rp.cells(kind, x, { school: (App.settings && App.settings.school) || '', kid: function (id) { return kidAt(id, x.date); }, victim: v, harms: harmsOf(x, v),
        people: x.ids.map(function (id) { return kidAt(id, x.date); }).filter(function (k) { return k && k.grade; }) });
    };
    App.openDlg({
      noEnter: true,
      html: function () {
        var cells = cellsOf(), L = labels(), refs = C.REPORT && Rp.allowedCells(kind).filter(function (r) { return cells[r] !== undefined; });
        var harms = harmsOf(x, st.victim);
        return '<div class="pop" data-close="1"><div class="dlg iout" role="dialog" aria-modal="true" aria-label="報告書を出力"><h2>' + C.REPORT.names[kind] + 'を出力</h2>' +
          (vs.length > 1 ? '<div class="ivic"><div class="lab">被害児童とする児童を選ぶ（矢印を向けられている児童。複数選べます）</div>' + vs.map(function (id) {
              return '<label class="chk"><input type="checkbox" data-ivic="' + id + '"' + (st.pick.indexOf(id) >= 0 ? ' checked' : '') + '> ' + esc(kidName(id)) + '</label>';
            }).join('') + '<p class="note">選んだ児童1人につき1つの書類を作ります。下のコピー用の表は ' + esc(kidName(st.victim)) + ' の分です。</p></div>' : '') +
          (kind !== 'f2' ? '<p class="note">加害の児童（関係図から）：' + (harms.map(function (id) { return esc(kidName(id)); }).join('、') || 'なし') + (harms.length > C.REPORT.harmRows.length ? '。' + (C.REPORT.harmRows.length + 1) + '人目からは人数だけを書きます' : '') + '</p>' : '') +
          '<div class="acts" style="justify-content:flex-start"><button class="btn primary" id="ixls"' + (st.pick.length ? '' : ' disabled') + '>Excel を作る' + (vs.length > 1 ? (st.pick.length ? '（選んだ' + st.pick.length + '人分・' + st.pick.length + 'ファイル）' : '（被害児童を選んでください）') : '（様式を複製して書き込む）') + '</button><span class="note">' + (App.mode === 'demo' ? (App.pf().template ? '選んだ様式に書き込み、ダウンロードします（元のファイルは変えません）' : '試行では、市教委の様式の Excel（.xlsx）をこの端末から選んでください') : App.settings && App.settings.template ? '元の様式は変えず、同じフォルダに複製を作ります' : '様式のファイルが設定されていません（設定の「事案と報告書」）') + '</span>' +
            (App.mode === 'demo' ? '<label class="btn ib">様式の Excel を選ぶ<input type="file" id="itmpl" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label>' + (App.pf().templateName ? '<span class="note">' + esc(App.pf().templateName) + '</span>' : '') : '') + '</div>' +
          (st.made.length ? '<div class="notebox">作りました：' + st.made.map(function (m) { return '<div><a href="' + esc(m.url) + '"' + (m.download ? ' download="' + esc(m.name) + '"' : ' target="_blank" rel="noopener"') + '>' + esc(m.name) + (m.download ? ' ⤓' : ' ↗') + '</a>（' + esc(kidName(m.victim)) + '）</div>'; }).join('') + '</div>' : '') +
          '<h3>コピー用（Excel が作れない時）</h3><table class="icopy"><thead><tr><th>欄</th><th>セル</th><th>書く値</th><th></th></tr></thead><tbody>' +
          refs.map(function (r) { return '<tr><td>' + esc(L[r] || r) + '</td><td>' + r + '</td><td><pre>' + esc(String(cells[r])) + '</pre></td><td><button class="btn" data-icopy="' + r + '">コピー</button></td></tr>'; }).join('') +
          (refs.length ? '' : '<tr><td colspan="4" class="note">書く値がありません</td></tr>') + '</tbody></table>' +
          '<div class="acts"><button class="btn" data-act="close">閉じる<kbd>Esc</kbd></button></div></div></div>';
      },
      click: function (t) {
        var b;
        if ((b = t.closest('[data-ivic]'))) {
          var id = b.dataset.ivic, k = st.pick.indexOf(id);
          if (b.checked && k < 0) st.pick.push(id); else if (!b.checked && k >= 0) st.pick.splice(k, 1);
          st.pick.sort(function (a, c) { return vs.indexOf(a) - vs.indexOf(c); });
          if (b.checked) st.victim = id; else if (st.pick.length) st.victim = st.pick[0];
          App.refreshDlg(); return true;
        }
        if ((b = t.closest('[data-icopy]'))) { copyText(String(cellsOf()[b.dataset.icopy])); return true; }
        if (t.closest('#ixls') && st.pick.length) {
          // 被害の児童ごとに1つずつ作る（同時に送らず、順に）
          st.made = [];
          App.save(function () {
            return st.pick.reduce(function (pr, v) {
              var seq = vs.length > 1 ? vs.indexOf(v) + 1 : 0;
              return pr.then(function () { return App.pf().exportReport(kind, cellsOf(v), x.id, seq); }).then(function (r) { r.victim = v; st.made.push(r); });
            }, Promise.resolve());
          }).then(function () {
            App.refreshDlg();
            // 試行：作った分をそのままダウンロードする
            st.made.forEach(function (m) { if (m.download) { var a = document.createElement('a'); a.href = m.url; a.download = m.name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1000); } });
          });
          return true;
        }
        return false;
      },
      input: function (t) {
        if (t.id !== 'itmpl' || !t.files || !t.files[0]) return;
        var f = t.files[0];
        f.arrayBuffer().then(function (b) { App.pf().template = b; App.pf().templateName = f.name; App.refreshDlg(); App.toast('様式を読み込みました：' + f.name); });
      }
    });
  }
  // 窓の中から書き込み許可の要らない方法でコピーする（GAS の画面は iframe の中なので clipboard API が使えないことがある）
  function copyText(s) {
    var ta = document.createElement('textarea');
    ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    App.toast(ok ? 'コピーしました' : 'コピーできませんでした。値を選んでコピーしてください');
  }
  // その行より後の、まだ書いていない行の日付をそろえる（前日の事案で日付を1つずつ直さなくてよい）
  function spreadDate(at, d) {
    var q = at.split(':'); if (q[0] === 's2v') return;
    var order = q[0] === 's1' ? ['hk', 'kk', 'sd'] : ['sd', 'vi', 'ha'], seen = false;
    order.forEach(function (k) {
      I.form.rep[q[0]][k].forEach(function (r, i) {
        if (k === q[1] && i === +q[2]) { seen = true; return; }
        if (seen && !r.t) { r.d = d; var el = document.querySelector('[data-rw="' + q[0] + ':' + k + ':' + i + ':d"]'); if (el) { el.value = d; var lb = el.parentNode.querySelector('span'); if (lb) lb.textContent = mdShort(d); } }
      });
    });
  }
  function toggleStep(i, on) {
    snap();
    // チェックした手順は、指導の欄の最後の行の続きに入れる（新しい行・次の時間帯には進めない）
    var rows = I.form.rep.s1.sd, t = C.SD_STEPS[i], last = rows[rows.length - 1];
    if (on) {
      if (!last) rows.push({ d: today(), p: '', t: t });
      else last.t = !last.t ? t : last.t + (/[。！？]$/.test(last.t) ? '' : '。') + t;
    } else {
      rows.forEach(function (r) { r.t = r.t.replace(t, '').replace(/^。|。(?=。)|。$/g, ''); });
      for (var k = rows.length - 1; k >= 0 && rows.length > 1; k--) if (!rows[k].t.trim()) rows.splice(k, 1);
    }
    rerenderPane(); saveDraftSoon();
  }
  // 足す行の既定：直前の行と同じ日の、次の時間帯（直前に時間帯が無ければ空のまま）
  function nextRow(prev) {
    if (!prev) return { d: today(), p: '', t: '' };
    if (!prev.p) return { d: prev.d, p: '', t: '' };
    var n = Rp.nextSlot(prev.d, prev.p); return { d: n.d, p: n.p, t: '' };
  }
  // 行を足す・消す、種別・児童・手順のチェックなどの操作を戻す（Ctrl+Z。文字の入力の取り消しはブラウザに任せる）
  var HIST = [];
  function snap() { if (!I.form) return; HIST.push(JSON.stringify({ rep: I.form.rep, type: I.form.type, d: I.form.dg ? I.form.dg.d : null })); if (HIST.length > 50) HIST.shift(); }
  function undo() {
    if (!I.form || !HIST.length) return false;
    var v = JSON.parse(HIST.pop()); I.form.rep = v.rep; I.form.type = v.type;
    if (v.d && I.form.dg) I.form.dg.d = v.d;
    I.focus = null; rerenderPane(); saveDraftSoon(); App.toast('1つ前に戻しました'); return true;
  }
  function closeForm() { HIST = []; I.mode = 'view'; I.form = null; I.focus = null; if (I.sel != null && !incOf(I.sel)) I.sel = null; }

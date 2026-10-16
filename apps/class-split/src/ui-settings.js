// 設定：年に1回だけ触るもの（配慮項目・担任と学級・事案の種別・年度替わり）。
// 項目の色と形は位置（k1〜k10）ごとに固定。変えられるのは名前・頭文字・既定の重みだけ（識別の検証を崩さないため）。
(function (g) {
  'use strict';
  var App = g.App, C = g.CONFIG;
  var T = { tab: 'attrs', s: null, cand: null, pick: {}, dirty: false };

  // 読み込んだ設定を画面の設定に反映する（項目の名前・頭文字・既定の重み、事案の種別）
  // 説明文の既定（config.js の help）。設定で空にした欄はこれに戻る
  var DEF_HELP = {};
  C.ATTRS.forEach(function (at) { DEF_HELP[at.k] = (at.help || []).slice(); });
  function helpOf(at, x) { var d = DEF_HELP[at.k], h = x && x.help || []; return d.map(function (t, i) { return h[i] ? String(h[i]) : t; }); }
  App.applySettings = function (s) {
    App.settings = s;
    C.ATTRS.forEach(function (at) { var x = s.attrs && s.attrs[at.k]; if (x) { at.label = x.label; at.s = x.s; at.w = +x.w; } at.help = helpOf(at, x); });
    if (s.types && s.types.length) C.INCIDENT_TYPES = s.types.slice();
    if (s.slots && s.slots.length) C.TIME_SLOTS = s.slots.slice();
  };

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function render() {
    var esc = App.esc, s = T.s;
    var tabs = [['attrs', '配慮項目'], ['teachers', '担任と学級'], ['types', '事案と報告書'], ['view', '表示'], ['year', '年度替わり']];
    var h = '<div class="rbar">' + tabs.map(function (t) { return '<button class="tab" data-stab="' + t[0] + '" aria-selected="' + (T.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') +
      '<span class="sp"></span>' + (T.tab !== 'year' && T.tab !== 'view' ? '<button class="btn primary" id="ssave"' + (T.dirty ? '' : ' disabled') + '>保存する</button>' : '') + '</div><div class="tw" style="padding:12px;max-width:900px">';
    if (T.tab === 'attrs') {
      h += '<table class="r"><thead><tr><th>印</th><th style="text-align:left">名前</th><th>頭文字</th><th style="text-align:left">既定の重み（案を作る時の初めの値）</th></tr></thead><tbody>' +
        C.ATTRS.map(function (at) {
          var x = s.attrs[at.k], prev = { sh: at.sh, c: at.c, t: at.t, label: x.label, s: x.s };
          return '<tr><td style="font-size:20px">' + App.mark(prev, 1) + '</td>' +
            '<td style="text-align:left"><input data-al="' + at.k + '" value="' + esc(x.label) + '" maxlength="20" style="padding:4px 6px;border:1px solid var(--line);border-radius:4px"></td>' +
            '<td><input data-as="' + at.k + '" value="' + esc(x.s) + '" maxlength="1" style="width:2.5em;text-align:center;padding:4px;border:1px solid var(--line);border-radius:4px"></td>' +
            '<td style="text-align:left"><div class="lvs">' + C.LEVEL_NAMES.map(function (n, lv) { return '<button class="lv' + (lv === C.MUST ? ' must' : '') + '" data-aw="' + at.k + ':' + lv + '" aria-pressed="' + (+x.w === lv) + '">' + n + '</button>'; }).join('') + '</div></td></tr>' +
            // 説明文（アイコンにカーソルを合わせると出る）：見出し・アイコン・アイコン＋
            '<tr class="hrow"><td></td><td colspan="3"><div class="hlp">' + helpOf(at, x).map(function (t, i) {
              var lab = i === 0 ? '見出し' : i === 1 ? App.mark(prev, 1) : App.mark(prev, 2);
              return '<label><span>' + lab + '</span><input data-ah="' + at.k + ':' + i + '" value="' + esc(t) + '" maxlength="80" placeholder="' + esc(DEF_HELP[at.k][i]) + '"></label>';
            }).join('') + '</div></td></tr>';
        }).join('') + '</tbody></table><p class="note">説明文は、アイコンにカーソルを合わせると出ます。空にすると既定の文に戻ります。色と形は項目の位置ごとに決まっていて変えられません（見分けやすさを確かめた組み合わせのため）。保存した値は、次に画面を開いた時から使われます。</p>';
    } else if (T.tab === 'teachers') {
      h += '<p class="note">担任と学級を登録すると、開いた時にその学年・学級を選んだ状態になります。</p><table class="r"><thead><tr><th style="text-align:left">教員のメール</th><th>学年</th><th>組</th><th></th></tr></thead><tbody>' +
        s.teachers.map(function (t, i) {
          return '<tr><td style="text-align:left"><input data-te="' + i + '" value="' + esc(t.email) + '" style="width:22em;padding:4px 6px;border:1px solid var(--line);border-radius:4px"></td>' +
            '<td><select data-tg="' + i + '">' + [0, 1, 2, 3, 4, 5, 6].map(function (gr) { return '<option value="' + gr + '"' + (+t.grade === gr ? ' selected' : '') + '>' + (gr ? gr + '年' : '—') + '</option>'; }).join('') + '</select></td>' +
            '<td><select data-tc="' + i + '">' + [0, 1, 2, 3, 4].map(function (k) { return '<option value="' + k + '"' + (+t.cls === k ? ' selected' : '') + '>' + (k ? k + '組' : '—') + '</option>'; }).join('') + '</select></td>' +
            '<td><button class="btn" data-tdel="' + i + '">削除</button></td></tr>';
        }).join('') + '</tbody></table><div class="rbar" style="margin-top:8px"><button class="btn" id="tadd">＋ 追加</button>' +
        (App.me && !s.teachers.some(function (t) { return t.email === App.me.email; }) ? '<button class="btn" id="tme">＋ 自分（' + esc(App.me.email) + '）</button>' : '') + '</div>';
    } else if (T.tab === 'types') {
      h += '<div class="setcols"><div><h3>事案の種別</h3><p class="note">1行に1つ。事案を登録する時の選択肢になります。</p><textarea id="types" rows="8" style="width:16em;font:inherit;padding:6px">' + esc(s.types.join('\n')) + '</textarea></div>' +
        '<div><h3>時間帯（学校の時程）</h3><p class="note">1行に1つ、上から時刻の順に。記録の行の左で選びます。</p><textarea id="slots" rows="12" style="width:12em;font:inherit;padding:6px">' + esc((s.slots || C.TIME_SLOTS).join('\n')) + '</textarea></div></div>' +
        '<h3>市教委への報告書</h3><label class="setrow">学校名（様式の「学校名」の欄）<input id="school" value="' + esc(s.school || '') + '" maxlength="40" placeholder="例：高木北小"></label>' +
        '<label class="setrow">様式のファイル（ドライブに置いた .xlsx のURL）<input id="tmpl" value="' + esc(s.template || '') + '" placeholder="drive.google.com/file/d/… を貼る" style="width:100%"></label>' +
        '<p class="note">市教委から配られた Excel を、<b>スプレッドシートに変換せずに</b>ドライブに置き、そのURLを貼ります。様式が変わったら、新しいファイルのURLに貼り替えます（セルの位置が変わった時は、プログラムの設定 config.js の REPORT を直す必要があります）。</p>';
    } else if (T.tab === 'view') {
      // クラス分けの盤面のアイコンの大きさ。端末の画面の大きさで合う値が違うので、この端末にだけ覚える
      var cur = App.iconScale();
      h += '<h3 style="margin:0 0 6px">クラス分けの盤面のアイコンの大きさ</h3><div class="lvs">' + App.ICON_SCALES.map(function (x) {
        return '<button class="lv" data-isz="' + x.v + '" aria-pressed="' + (x.v === cur) + '">' + x.label + '</button>';
      }).join('') + '</div><p class="note">押すとすぐに変わり、この端末だけに覚えます（ほかの先生の画面は変わりません）。<br>「標準」は、＋のアイコンが隣に重ならない範囲でいちばん大きい大きさです。大きくすると、＋のアイコンや＋の印が隣に重なることがあります。</p>';
    } else {
      h += yearTab();
    }
    App.$('main').innerHTML = h + '</div>';
  }

  function yearTab() {
    var esc = App.esc, s = T.s;
    if (!T.cand) {
      App.pf().leaveCandidates().then(function (c) { T.cand = c; T.pick = {}; /* 元に戻せないので、初めは誰も選ばない */ if (App.st.screen === 'settings' && T.tab === 'year') render(); });
      return '<div class="empty">読み込んでいます…</div>';
    }
    var n = T.cand.filter(function (x) { return T.pick[x.id]; }).length;
    return '<h3 style="margin:0 0 6px">卒業・転出した児童の記録を消す</h3>' +
      '<p class="note">今年度の名簿にいない児童です。消すと、名簿・配慮項目・つける離す・事案との結び付きから、その児童の行が消えます。結び付く児童がいなくなった事案は、名前とURLを消します。<b>元に戻せません。</b>スプレッドシートの版の履歴と、ドライブの事案の文書そのものは残ります。</p>' +
      '<div class="rbar"><span class="lab">卒業・転出した後も残す年数</span>' + [0, 1, 2, 3, 4, 5, 6].map(function (y) {
        return '<button class="lv" data-keep="' + y + '" aria-pressed="' + (+s.keepYears === y) + '">' + (y ? y + '年度' : '残さない') + (y === C.KEEP_YEARS_DEFAULT ? '（既定）' : '') + '</button>';
      }).join('') + '</div><p class="note">事案に関わった児童は、この設定にかかわらず卒業・転出から' + C.INCIDENT_KEEP_YEARS + '年度は候補に出しません（いじめ等の記録の保存の目安。年数の正本は教育委員会の文書管理規程）。</p>' +
      (T.cand.length ? '<table class="r"><thead><tr><th><input type="checkbox" id="pall"' + (n === T.cand.length ? ' checked' : '') + ' aria-label="すべて"></th><th>理由</th><th>最後の年度</th><th>学年-組-番</th><th style="text-align:left">名前</th><th>事案</th></tr></thead><tbody>' +
        T.cand.map(function (x) {
          return '<tr><td><input type="checkbox" data-pp="' + x.id + '"' + (T.pick[x.id] ? ' checked' : '') + '></td><td>' + x.reason + '</td><td>' + x.fy + '</td><td>' + x.grade + '-' + (x.cls + 1) + '-' + x.no + '</td><td style="text-align:left">' + esc(x.name) + '</td><td>' + (x.incidents || '') + '</td></tr>';
        }).join('') + '</tbody></table><div class="rbar" style="margin-top:8px"><button class="btn danger" id="purge"' + (n ? '' : ' disabled') + '>選んだ' + n + '人の記録を消す…</button></div>' :
        '<div class="empty">消す候補はありません</div>');
  }

  function purgeDialog() {
    var ids = T.cand.filter(function (x) { return T.pick[x.id]; }).map(function (x) { return x.id; }), word = ids.length + '人の記録を消す';
    App.openDlg({
      focus: 'cword',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="記録を消す" style="max-width:600px"><h2>' + ids.length + '人の記録を消す</h2>' +
          '<p>元に戻せません。スプレッドシートの版の履歴には、消す前の値が残ります。</p>' +
          '<label>確かめるため「<b>' + word + '</b>」と入力してください<br><input type="text" id="cword" style="width:100%;margin-top:4px" autocomplete="off"></label>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn danger" data-act="ok">消す</button></div></div></div>';
      },
      onOk: function () {
        if (App.$('cword').value.trim() !== word) { App.toast('入力した語が違います'); return; }
        App.closeDlg();
        App.save(function () { return App.pf().purge(ids); }).then(function () { T.cand = null; render(); App.toast(ids.length + '人の記録を消しました'); });
      }
    });
  }

  function set(fn) { fn(); T.dirty = true; }
  App.screens.settings = {
    enter: function () {
      T.tab = 'attrs'; T.cand = null; T.dirty = false;
      App.$('main').innerHTML = '<div class="empty">読み込んでいます…</div>';
      App.pf().settings().then(function (r) { T.s = clone(r.settings); App.me = r.me; render(); });
    },
    render: function () { if (T.s) render(); },
    click: function (t) {
      var x, s = T.s;
      if ((x = t.closest('[data-stab]'))) { T.tab = x.dataset.stab; render(); return true; }
      if ((x = t.closest('[data-isz]'))) { App.setIconScale(+x.dataset.isz); render(); App.toast('アイコンの大きさを「' + x.textContent + '」にしました'); return true; }
      if ((x = t.closest('[data-aw]'))) { var p = x.dataset.aw.split(':'); set(function () { s.attrs[p[0]].w = +p[1]; }); render(); if (+p[1] === C.MUST) App.toast(C.MUST_WARN); return true; }
      if (t.closest('#tadd')) { set(function () { s.teachers.push({ email: '', grade: 0, cls: 0 }); }); render(); return true; }
      if (t.closest('#tme')) { set(function () { s.teachers.push({ email: App.me.email, grade: App.st.grade, cls: 1 }); }); render(); return true; }
      if ((x = t.closest('[data-tdel]'))) { set(function () { s.teachers.splice(+x.dataset.tdel, 1); }); render(); return true; }
      if ((x = t.closest('[data-keep]'))) {
        s.keepYears = +x.dataset.keep; T.cand = null;
        App.save(function () { return App.pf().saveSettings(s); }).then(function () { render(); });
        return true;
      }
      if (t.closest('#purge')) { purgeDialog(); return true; }
      if (t.closest('#ssave')) {
        App.save(function () { return App.pf().saveSettings(s); }).then(function (saved) {
          T.s = clone(saved); T.dirty = false; App.applySettings(saved); render(); App.toast('設定を保存しました');
        });
        return true;
      }
      return false;
    },
    input: function (t) {
      var s = T.s, k;
      if ((k = t.dataset.al)) set(function () { s.attrs[k].label = t.value; });
      else if ((k = t.dataset.as)) set(function () { s.attrs[k].s = t.value; });
      else if (t.dataset.ah) { var q = t.dataset.ah.split(':'), at = C.ATTRS.filter(function (a) { return a.k === q[0]; })[0]; set(function () { var h = helpOf(at, s.attrs[q[0]]); h[+q[1]] = t.value; s.attrs[q[0]].help = h; }); }
      else if (t.dataset.te != null) set(function () { s.teachers[+t.dataset.te].email = t.value.trim(); });
      else if (t.dataset.tg != null) set(function () { s.teachers[+t.dataset.tg].grade = +t.value; });
      else if (t.dataset.tc != null) set(function () { s.teachers[+t.dataset.tc].cls = +t.value; });
      else if (t.id === 'types') set(function () { s.types = t.value.split('\n'); });
      else if (t.id === 'slots') set(function () { s.slots = t.value.split('\n'); });
      else if (t.id === 'school') set(function () { s.school = t.value; });
      else if (t.id === 'tmpl') set(function () { s.template = t.value.trim(); });
      else if (t.id === 'pall') { T.cand.forEach(function (x) { T.pick[x.id] = t.checked; }); render(); return; }
      else if (t.dataset.pp) { T.pick[t.dataset.pp] = t.checked; render(); return; }
      else return;
      var b = App.$('ssave'); if (b) b.disabled = false;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

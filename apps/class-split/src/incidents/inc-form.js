/* 事案管理：記入（記録の行・記入補助・書きかけ・入力欄のキー・始める）。ui-incidents.js の中に差し込まれる（同じ閉じた範囲の変数を使う）。単独では動かない */
  var ASK = { 's1:hk': 'だれが・どうやって知ったか', 's1:kk': 'だれが・だれに・何をしたか', 's1:sd': '学校がしたこと（聴き取り・指導・連絡）',
    's2:sd': 'その後に学校がしたこと', 's2:vi': '被害の児童と保護者の、今の様子', 's2:ha': '加害の児童と保護者の、今の様子' };
  var SEC_NAME = { 's1:hk': '発覚', 's1:kk': '経緯', 's1:sd': '指導', 's2:sd': '指導の経過', 's2:vi': '被害児童・保護者の様子', 's2:ha': '加害児童・保護者の様子' };
  function mdShort(iso) { var p = String(iso || '').split('-'); if (p.length !== 3) return '日付'; var w = '日月火水木金土'.charAt(new Date(+p[0], +p[1] - 1, +p[2]).getDay()); return (+p[1]) + '/' + (+p[2]) + '(' + w + ')'; }
  function secHtml(sec, key, rows) {
    var w = sec + ':' + key, isV = sec === 's2v';
    var h = '<div class="isec s-' + (isV ? 's2vi' : sec + key) + '" data-sec="' + w + '"><h3 class="ish"><b>' + (isV ? '被害児童・保護者の様子（' + esc(kidName(key)) + '）' : SEC_NAME[w]) + '</b><span>' + (isV ? 'この児童と保護者の、今の様子' : ASK[w]) + '</span></h3>';
    if (w === 's1:sd') h += stepsHtml(rows);
    h += '<div class="irows">' + rows.map(function (r, i) {
      var at = w + ':' + i;
      // 日付は「月/日」だけを見せ、押すと暦が開く（年は事案の記録では毎回見なくてよい）
      return '<div class="irow" data-row="' + at + '"><label class="idate" title="' + esc(Rp.md(r.d)) + '"><span>' + esc(mdShort(r.d)) + '</span><input type="date" data-rw="' + at + ':d" value="' + esc(r.d) + '" aria-label="日付"></label>' +
        '<select class="islot' + (r.p ? ' on' : '') + '" data-rw="' + at + ':p" aria-label="時間帯"><option value="">時間帯</option>' + Rp.slots().map(function (p) { return '<option' + (p === r.p ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') +
        (r.p && Rp.slots().indexOf(r.p) < 0 ? '<option selected>' + esc(r.p) + '</option>' : '') + '</select>' +
        '<textarea data-rw="' + at + ':t" id="rw-' + sec + '-' + key + '-' + i + '" rows="1" maxlength="2000" placeholder="' + (i ? 'Shift+Enter で次の行' : '下の文を押すか、書く') + '">' + esc(r.t) + '</textarea>' +
        '<button type="button" class="ix" data-rdel="' + at + '" title="この行を消す" aria-label="この行を消す">' + IC.trash + '</button>' +
        // 日付の下：翌日の行を足す。時間帯の下：同じ日の次の時間帯の行を足す
        '<button type="button" class="inx" data-rnext="' + at + ':day" title="翌日の行を足す" aria-label="翌日の行を足す">' + IC.down2 + '</button>' +
        '<button type="button" class="inx" data-rnext="' + at + ':slot" title="次の時間帯の行を足す" aria-label="次の時間帯の行を足す">' + IC.down2 + '</button>' +
        '<div class="irx" id="irx-' + sec + '-' + key + '-' + i + '"></div></div>';
    }).join('') + (rows.length ? '' : '<button type="button" class="btn ib iaddrow" data-radd="' + w + '">' + IC.plus + '行を足す</button>') + '</div></div>';
    return h;
  }
  // 指導の「よくある手順」：チェックで行を足す・外す
  function stepsHtml(rows) {
    var all = rows.map(function (r) { return r.t; }).join('\n');
    return '<div class="isteps">' + C.SD_STEPS.map(function (t, i) { return '<label class="chk"><input type="checkbox" data-step="' + i + '"' + (all.indexOf(t) >= 0 ? ' checked' : '') + '> ' + esc(t) + '</label>'; }).join('') + '</div>';
  }
  // 選んでいる行の下：時間帯のボタン列と、次によく書く文
  function extraHtml(at) {
    var q = at.split(':'), w = q[0] + ':' + q[1], r = I.form.rep[q[0]][q[1]][+q[2]]; if (!r) return '';
    var h = '';
    var sg = [];
    if (w === 's1:kk') leads().forEach(function (t) { sg.push({ t: t, nm: true }); });
    nextPhrases(w, 5).forEach(function (t) { sg.push({ t: t }); });
    if (sg.length) h += '<div class="iph isg">' + sg.map(function (x) { return '<button type="button" class="' + (x.nm ? 'nm' : '') + '" data-ph="' + esc(x.t) + '">' + esc(x.t) + '</button>'; }).join('') + '</div>';
    return h;
  }
  function showExtra() {
    Array.prototype.forEach.call(document.querySelectorAll('.irx'), function (el) { el.innerHTML = ''; });
    Array.prototype.forEach.call(document.querySelectorAll('.irow.cur'), function (el) { el.classList.remove('cur'); });
    if (!I.form || !I.focus || I.focus === 'kikan') return;
    var q = I.focus.split(':'), el = App.$('irx-' + q[0] + '-' + q[1] + '-' + q[2]);
    if (el) { el.innerHTML = extraHtml(I.focus); el.parentNode.classList.add('cur'); }
  }
  // その欄で使った定型文の、後に続く文から順に（使った文は出さない）
  function phrasesOf(w) { return C.PHRASES[phraseKey(w)] || []; }
  function usedIn(w) {
    if (w === 'kikan') return I.form.rep.s2.kikan;
    var q = w.split(':'); return I.form.rep[q[0]][q[1]].map(function (r) { return r.t; }).join('\n');
  }
  function nextPhrases(w, n) {
    // 指導の「よくある手順」はチェックで入れるので、行の下には出さない
    var ph = phrasesOf(w).filter(function (t) { return w !== 's1:sd' || C.SD_STEPS.indexOf(t) < 0; }), txt = usedIn(w), last = -1;
    ph.forEach(function (t, i) { if (txt.indexOf(t) >= 0) last = i; });
    var out = [];
    for (var k = 1; k <= ph.length && out.length < n; k++) { var t = ph[(last + k) % ph.length]; if (txt.indexOf(t) < 0) out.push(t); }
    return out;
  }
  // 関係図の矢印から「（加害の児童）が（被害の児童）」
  function leads() {
    var f = I.form; if (!f || !f.dg) return [];
    var d = f.dg.d, nameOf = function (end) {
      var p = end.split(':');
      if (p[0] === 'k') return kidName(p[1]);
      var gr = d.groups.filter(function (x) { return x.g === p[1]; })[0];
      return gr ? gr.members.map(kidName).join('・') : '';
    };
    // 助詞は続けて選ぶ文の側が持つ（「に悪口を言った」「を叩いた」）ので、ここでは「Aが B」まで
    return d.edges.map(function (e) { return nameOf(e.f) + 'が' + nameOf(e.t); });
  }
  function autosize(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; }
  function autosizeAll() { Array.prototype.forEach.call(document.querySelectorAll('.irow textarea'), autosize); }

  function formHtml() {
    var f = I.form, rp = f.rep, b = isBully(f.type), ts = typesOf(f.type);
    var h = '<form class="form iform" id="incForm"><h2>' + (f.edit ? '事案を直す' : '事案を登録') + '<span class="idraft" id="idraft"></span></h2>' +
      '<div class="lab">事案の種別（複数選べます）</div><div class="itypes">' + C.INCIDENT_TYPES.map(function (t) { return '<button type="button" class="lv" data-ty="' + esc(t) + '" aria-pressed="' + (ts.indexOf(t) >= 0) + '">' + typeHtml(t) + '</button>'; }).join('') + '</div>' +
      '<label>関係する児童' + (onlyDamage(f.type) ? '' : 'と関係図（矢印＝加害）') + '</label><div class="iq"><span class="iqw"><input id="fQ" value="" placeholder="名前・よみで児童を足す（' + esc(srchGrades().map(function (g0) { return g0 + '年'; }).join('・')) + '）" autocomplete="off"><button type="button" class="iqc" id="fQset" title="検索の設定（探す学年）" aria-label="検索の設定"></button></span>' +
      (onlyDamage(f.type) ? '' : '<button type="button" class="btn" id="fUnk" title="誰か分からない児童（加害者が不明など）のカードを足す">＋ ？（不明の児童）</button>') + '</div><div id="fSugg"></div>';
    if (onlyDamage(f.type)) h += '<div class="ikids">' + f.dg.d.nodes.map(function (n) { return '<span class="chip">' + esc(kidName(n.id)) + '<button type="button" data-kdel="' + n.id + '" aria-label="外す">×</button></span>'; }).join('') + '</div>';
    else h += '<div id="fDg" class="dg"></div>';
    if (b) {
      h += '<fieldset class="irep"><legend>いじめの項目</legend>' +
        '<label>発見のきっかけ<select id="fFound"><option value="">選ぶ</option>' + C.FOUND_LIST.map(function (t) { return '<option' + (t === rp.found ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
        '<div class="lab">いじめの態様（複数選べます）</div><div class="imodes">' + C.MODES.map(function (m, i) {
          // 長い補足は「？」の中に畳む（押すと開く）
          return '<div class="imode"><label class="chk"><input type="checkbox" data-mode="' + i + '"' + (rp.modes[i] ? ' checked' : '') + '> ' + esc(m.t) + '</label>' +
            (m.note ? '<button type="button" class="imq" data-mq="1" title="例を見る" aria-label="例を見る" aria-expanded="false">？</button><div class="imqt" hidden>' + esc(m.note) + '</div>' : '') + '</div>';
        }).join('') + '</div>' +
        '<label>その他の内容<input id="fOther" value="' + esc(rp.other) + '" maxlength="200"' + (rp.modes[C.MODES.length - 1] ? '' : ' disabled') + '></label></fieldset>';
    }
    ['hk', 'kk', 'sd'].forEach(function (k) { h += secHtml('s1', k, rp.s1[k]); });
    h += '<details class="iopt"><summary>文書のURL・題名（任意）</summary><label>文書のURL<input id="fUrl" value="' + esc(f.url || '') + '" placeholder="docs.google.com/… を貼る"></label>' +
      '<label>題名（空なら「種別の事案」）<input id="fTitle" value="' + esc(f.title || '') + '" maxlength="80" placeholder="児童の氏名は入れない"></label></details>' +
      (f.detail ? '<label>詳細（以前の記録）<textarea id="fDetail" rows="4" maxlength="5000">' + esc(f.detail) + '</textarea></label>' : '') +
      '<div class="note">事実を書き、推測や人柄の評価は書きません（保護者から開示を求められることがある記録です）。期間は記録の行の日付から決まります。</div>' +
      '<div class="row"><button type="button" class="btn" id="cancelInc">やめる</button><button class="btn primary">' + (f.edit ? '直す' : '登録する') + '</button></div></form>';
    return h;
  }
  function add2Html(x) {
    var f = I.form, s2 = f.rep.s2;
    var h = '<form class="form iform" id="inc2Form"><h2>その後の経緯を追記（様式Ⅱ用）<span class="idraft" id="idraft"></span></h2><div class="meta">' + esc(titleOf(x)) + '・' + esc(App.span(x)) + '</div>';
    var vv = realVictims(x);
    ['sd', 'vi', 'ha'].forEach(function (k) {
      // 被害の児童が2人以上なら、児童ごとに欄を分ける（Excel も児童ごとに作る）
      if (k === 'vi' && vv.length > 1) { vv.forEach(function (id) { h += secHtml('s2v', id, f.rep.s2v[id]); }); return; }
      h += secHtml('s2', k, s2[k]);
    });
    h += '<h3 class="ish"><b>関係機関との連携</b><span>相談・連携した機関（無ければ「なし」）</span></h3><input id="fKikan" class="ikikan" data-phs="kikan" value="' + esc(s2.kikan) + '" maxlength="2000" placeholder="右の記入補助から選ぶか、書く">' +
      '<div class="row"><button type="button" class="btn" id="cancelInc">やめる</button><button class="btn primary">保存する</button></div></form>';
    return h;
  }
  function mountDg() {
    var el = App.$('fDg');
    if (el && I.form && I.form.dg) App.Diagram.mount(el, I.form.dg, function (st) { I.form.dg = st; });
    var v = App.$('vDg'), x = I.sel != null && incOf(I.sel);
    // 見るだけ（動かす操作は CSS で止める。「カードで表示」だけ選べる。選び直すと描き直すので、そのたびに切り出す）
    if (v && x && x.diagram) { App.Diagram.mount(v, App.Diagram.state(x.diagram), function (st) { cropDg(v, st.d); }); cropDg(v, x.diagram); }
  }
  // 見る画面の関係図は、児童のいる範囲だけを切り出す（白い余白を出さない）
  function cropDg(el, d) {
    var cv = el.querySelector('.dg-canvas'); if (!cv || !d.nodes.length) return;
    var W = E.DG_W, H = E.DG_H, xs = d.nodes.map(function (n) { return n.x; }), ys = d.nodes.map(function (n) { return n.y; });
    var x0 = Math.max(0, Math.min.apply(null, xs) - 120), x1 = Math.min(W, Math.max.apply(null, xs) + 120);
    var y0 = Math.max(0, Math.min.apply(null, ys) - 45), y1 = Math.min(H, Math.max.apply(null, ys) + 45);
    var rc = cv.getBoundingClientRect(), cw = rc.width, k = cw / W, ky = rc.height / H;
    var box = document.createElement('div');
    box.className = 'dg-crop';
    box.style.width = Math.round((x1 - x0) * k) + 'px'; box.style.height = Math.round((y1 - y0) * ky) + 'px';
    cv.parentNode.insertBefore(box, cv); box.appendChild(cv);
    cv.style.width = Math.round(cw) + 'px'; cv.style.height = Math.round(rc.height) + 'px'; cv.style.marginLeft = -Math.round(x0 * k) + 'px'; cv.style.marginTop = -Math.round(y0 * ky) + 'px';
  }
  function rerenderPane() { var w = document.querySelector('.iwrap'); if (w && w.classList.contains('solo') === sided()) return render(); var p = App.$('ipane'); if (p) { p.innerHTML = pane(); mountDg(); autosizeAll(); showExtra(); } renderAssist(); }

  // ===== 記入補助（右）：選んでいる欄に合う定型文と、関係する児童の名前。押すか、ドラッグして入れる =====
  var ASSIST_NAMES = { 's1:hk': '発覚', 's1:kk': '経緯', 's1:sd': '指導', 's2:sd': '指導の経過', 's2:vi': '被害児童・保護者の様子', 's2:ha': '加害児童・保護者の様子', kikan: '関係機関との連携' };
  function phraseKey(where) { return where === 'kikan' ? 'kikan' : where === 's2:sd' ? 's2sd' : where.split(':')[0] === 's2v' ? 'vi' : where.split(':')[1]; }
  function assistHtml() {
    if (FOLD.assist) return '<button class="ifold" id="iasT" title="記入補助を開く" aria-label="記入補助を開く">' + IC.asOpen + '</button><button class="ivlab" id="iasT2" tabindex="-1">記入補助</button>';
    var h = '<div class="ihead"><b class="ib">' + IC.help + '記入補助</b><button class="ifold" id="iasT" title="記入補助を畳む" aria-label="記入補助を畳む">' + IC.asClose + '</button></div>';
    var where = I.form && I.focus ? I.focus.split(':').slice(0, 2).join(':') : null;
    if (I.form && I.focus === 'kikan') where = 'kikan';
    var vName = where && where.split(':')[0] === 's2v' ? '被害児童・保護者の様子（' + kidName(where.split(':')[1]) + '）' : null;
    if (!I.form || !where || !(ASSIST_NAMES[where] || vName)) return h + '<p class="note">入力欄を押すと、その欄に合う文がここに出ます。押すか、入力欄へドラッグして入れます。</p>';
    var names = formKids(), ph = C.PHRASES[phraseKey(where)] || [];
    h += '<div class="iaw s-' + (vName ? 's2vi' : where.replace(':', '')) + '">' + esc(vName || ASSIST_NAMES[where]) + '</div>';
    var used = usedIn(where);
    if (names.length && where !== 'kikan') h += '<div class="lab">児童の名前</div><div class="iph">' + names.map(function (n) { return '<button type="button" class="nm" draggable="true" data-ph="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') + '</div>';
    h += '<div class="lab">定型文（使った文は ✓）</div><div class="iph col">' + ph.map(function (t) { var u = used.indexOf(t) >= 0; return '<button type="button" draggable="true" class="' + (u ? 'used' : '') + '" data-ph="' + esc(t) + '">' + (u ? '✓ ' : '') + esc(t) + '</button>'; }).join('') + '</div>';
    return h;
  }
  function renderAssist() { var a = App.$('iassist'); if (a) a.innerHTML = assistHtml(); }
  function formKids() {
    var f = I.form; if (!f) return [];
    var ids = f.dg ? f.dg.d.nodes.map(function (n) { return n.id; }) : (f.x ? f.x.ids : []);
    return ids.filter(function (id) { return !E.isUnknown(id); }).map(kidName);
  }
  // 入れる：選んでいる行のカーソルの所へ。文の途中でなく末尾なら、句点で終わっていない時は「。」を挟む（名前の後ろは挟まない）
  function putPhrase(text) {
    var f = I.form; if (!f || !I.focus) return;
    if (I.focus === 'kikan') {
      var k = App.$('fKikan'), cur = f.rep.s2.kikan.replace(/[、。\s]*$/, '');
      if (k) { k.focus(); k.setSelectionRange(cur.length, k.value.length); typeIn(k, (cur ? '、' : '') + text); }
      return;
    }
    var q = I.focus.split(':'), r = f.rep[q[0]][q[1]][+q[2]];
    if (!r) return;
    var el = App.$('rw-' + q[0] + '-' + q[1] + '-' + q[2]), pos = el ? el.selectionStart : r.t.length, end = el ? el.selectionEnd : r.t.length;
    var before = r.t.slice(0, pos), after = r.t.slice(end), isName = formKids().indexOf(text) >= 0;
    var lastName = formKids().some(function (n) { return before.slice(-n.length) === n; });
    // 助詞で始まる文（「に悪口を言った」）や、助詞で終わる途中（「Aが」）にはつなげて入れる
    var glue = !before || isName || lastName || /[。、\s]$/.test(before) || /[がにをとへでものは]$/.test(before) || /^[にをのがとへでも]/.test(text) || after ? '' : '。';
    if (el) { el.focus(); el.setSelectionRange(pos, end); typeIn(el, glue + text); }
    else { r.t = before + glue + text + after; }
    afterEdit();
  }
  // 入力欄に文字を入れる：ブラウザの「入力」として入れるので、Ctrl+Z（元に戻す）・Ctrl+Y（やり直す）が効く
  function typeIn(el, text) {
    var ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) { var a = el.selectionStart, b = el.selectionEnd; el.value = el.value.slice(0, a) + text + el.value.slice(b); el.setSelectionRange(a + text.length, a + text.length); el.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  // 入力が変わった後：選んでいる行の補助と右の一覧（✓）を描き直し、書きかけを保存する
  function afterEdit() { showExtra(); renderAssist(); syncSteps(); saveDraftSoon(); }
  function syncSteps() {
    if (!I.form || !I.form.rep.s1) return;
    var all = I.form.rep.s1.sd.map(function (r) { return r.t; }).join('\n');
    Array.prototype.forEach.call(document.querySelectorAll('[data-step]'), function (cb) { cb.checked = all.indexOf(C.SD_STEPS[+cb.dataset.step]) >= 0; });
  }
  // ===== 書きかけ（下書き）：入力が止まって1.5秒後にサーバーへ =====
  var draftT = 0;
  function draftOf() {
    var f = I.form; if (!f) return null;
    return { mode: I.mode, form: { edit: f.edit, type: f.type, url: f.url, title: f.title, detail: f.detail, rep: f.rep, dg: f.dg ? f.dg.d : null } };
  }
  function saveDraftSoon() {
    clearTimeout(draftT);
    draftT = setTimeout(function () {
      var d = draftOf(); if (!d) return;
      App.pf().saveDraft(App.st.grade, d).then(function () { I.draft = { at: new Date().toISOString(), draft: d }; var el = App.$('idraft'); if (el) el.textContent = '書きかけを保存しました'; }, function () { var el = App.$('idraft'); if (el) el.textContent = '書きかけを保存できません（通信）'; });
    }, 1500);
  }
  function dropDraft() { clearTimeout(draftT); I.draft = null; var gr = App.st.grade; App.save(function () { return App.pf().saveDraft(gr, null); }, 'draft:' + gr); }
  function restoreDraft() {
    HIST = []; // 前の記入の「戻す」を、書きかけに当てない
    var dr = I.draft && I.draft.draft; if (!dr) return;
    var f = dr.form;
    if (dr.mode === 'add2') { var x = incOf(f.edit); if (!x) { dropDraft(); return; } I.form = { edit: x.id, rep: Rp.norm(f.rep), x: x }; ensureV(x); I.mode = 'add2'; I.sel = x.id; }
    else { I.form = { edit: f.edit, dg: App.Diagram.state(f.dg), type: f.type || '', url: f.url || '', title: f.title || '', detail: f.detail || '', rep: Rp.norm(f.rep) }; I.mode = 'form'; if (f.edit != null) I.sel = f.edit; }
    ['hk', 'kk', 'sd'].forEach(function (k) { if (I.mode === 'form' && !I.form.rep.s1[k].length) I.form.rep.s1[k].push({ d: today(), p: '', t: '' }); });
    ['sd', 'vi', 'ha'].forEach(function (k) { if (I.mode === 'add2' && !I.form.rep.s2[k].length) I.form.rep.s2[k].push({ d: today(), p: '', t: '' }); });
    I.focus = null;
  }
  // 最後に触った入力欄を覚え、記入補助を描き直す
  // 押している間に補助の欄を描き直すと、欄の位置がずれて、離した時に別の欄（や補助の文）を押したことになる。
  // 押している間に入った時は、離してから描き直す
  var PDOWN = false, PEND = null;
  document.addEventListener('pointerdown', function () { PDOWN = true; }, true);
  document.addEventListener('pointerup', function () { PDOWN = false; if (PEND) { var f = PEND; PEND = null; setTimeout(f, 0); } }, true);
  // 指を離した知らせが届かない時（枠の外で離した・タブを切り替えた）に、押している印が残らないように
  ['blur', 'visibilitychange'].forEach(function (ev) { (ev === 'blur' ? window : document).addEventListener(ev, function () { PDOWN = false; PEND = null; }); });
  document.addEventListener('pointercancel', function () { PDOWN = false; if (PEND) { var f = PEND; PEND = null; setTimeout(f, 0); } }, true);
  document.addEventListener('focusin', function (e) {
    if (App.st.screen !== 'incidents' || !I.form) return;
    if (PDOWN) { var ev = e; PEND = function () { if (document.activeElement === ev.target) onFocus(ev); }; return; }
    onFocus(e);
  });
  function onFocus(e) {
    if (!I.form) return;
    var t = e.target, was = I.focus;
    if (t && t.tagName === 'TEXTAREA' && t.dataset && t.dataset.rw) {
      var q = t.dataset.rw.split(':'); I.focus = q[0] + ':' + q[1] + ':' + q[2];
      // 経緯の最初の行が空なら、関係図の矢印から「Aが B」を入れておく
      var r = I.form.rep[q[0]][q[1]][+q[2]], ld = leads();
      if (q[0] === 's1' && q[1] === 'kk' && +q[2] === 0 && r && !r.t && ld.length && document.activeElement === t) typeIn(t, ld[0]);
    } else if (t && t.id === 'fKikan') I.focus = 'kikan';
    else return;
    if (was !== I.focus) showExtra();
    if (!was || was.split(':').slice(0, 2).join() !== I.focus.split(':').slice(0, 2).join()) renderAssist();
  }
  // 空の入力欄で Ctrl+Z：文字の取り消しが無いので、行を足すなどの操作を戻す
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (App.st.screen !== 'incidents' || !I.form || !(e.ctrlKey || e.metaKey) || e.shiftKey || (e.key !== 'z' && e.key !== 'Z')) return;
    if (t && /^(TEXTAREA|INPUT)$/.test(t.tagName) && t.type !== 'checkbox' && t.value === '' && undo()) e.preventDefault();
  });
  // Shift+Enter で次の行（次の時間帯）を作る。Enter は欄の中で改行（ブラウザのまま）。日本語の変換中は何もしない
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (e.key !== 'Enter' || !e.shiftKey || e.isComposing || e.keyCode === 229 || !t || t.tagName !== 'TEXTAREA' || !t.dataset.rw || !I.form) return;
    e.preventDefault();
    if (!t.value.trim()) return;
    var q = t.dataset.rw.split(':'), rows = I.form.rep[q[0]][q[1]], i = +q[2], r = rows[i];
    if (rows[i + 1] && !rows[i + 1].t) { refocus('rw-' + q[0] + '-' + q[1] + '-' + (i + 1)); return; }
    snap(); rows.splice(i + 1, 0, nextRow(r));
    rerenderPane(); refocus('rw-' + q[0] + '-' + q[1] + '-' + (i + 1)); saveDraftSoon();
  });
  // ↑↓：欄の中では行を移り、いちばん上の行で↑なら前の欄（末尾）へ、いちばん下の行で↓なら次の欄（先頭）へ。欄は作らない。
  // 折り返しの行も見分けるため、ブラウザに先に動かさせ、端の行にいた（カーソルが先頭・末尾に飛んだ）かで決める
  document.addEventListener('keydown', function (e) {
    var t = e.target, up = e.key === 'ArrowUp';
    if ((!up && e.key !== 'ArrowDown') || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || !t || t.tagName !== 'TEXTAREA' || !t.dataset.rw || !I.form) return;
    if (t.selectionStart !== t.selectionEnd) return;
    var before = t.selectionStart, len = t.value.length;
    var go = function () {
      var all = Array.prototype.slice.call(document.querySelectorAll('#incForm textarea[data-rw],#inc2Form textarea[data-rw]')), j = all.indexOf(t) + (up ? -1 : 1), n = all[j];
      if (!n) return;
      n.focus(); var pos = up ? n.value.length : 0; n.setSelectionRange(pos, pos);
    };
    if (up ? before === 0 : before === len) { e.preventDefault(); go(); return; }
    setTimeout(function () {
      if (document.activeElement !== t) return;
      var after = t.selectionStart;
      if (up ? after === 0 && t.value.lastIndexOf('\n', before - 1) < 0 && !onLaterLine(t, before) : after === t.value.length && t.value.indexOf('\n', before) < 0 && !onEarlierLine(t, before)) go();
    }, 0);
  });
  // カーソルの位置が、折り返しで2行目以降・最後の行より前にあるか（見えない写しの div で測る）
  function caretTop(t, pos) {
    var cs = getComputedStyle(t), m = document.createElement('div');
    ['font', 'letterSpacing', 'lineHeight', 'padding', 'border', 'boxSizing', 'whiteSpace', 'wordBreak', 'overflowWrap'].forEach(function (k) { m.style[k] = cs[k]; });
    m.style.position = 'absolute'; m.style.visibility = 'hidden'; m.style.whiteSpace = 'pre-wrap'; m.style.width = t.clientWidth + 'px';
    m.textContent = t.value.slice(0, pos); var sp = document.createElement('span'); sp.textContent = '\u200b'; m.appendChild(sp);
    document.body.appendChild(m); var y = sp.offsetTop; m.remove(); return y;
  }
  function onLaterLine(t, pos) { return caretTop(t, pos) > caretTop(t, 0) + 2; }
  function onEarlierLine(t, pos) { return caretTop(t, pos) < caretTop(t, t.value.length) - 2; }
  document.addEventListener('dragstart', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.iassist [data-ph]');
    if (b) { e.dataTransfer.setData('text/plain', b.dataset.ph); e.dataTransfer.effectAllowed = 'copy'; }
  });
  // 入力欄に落とした時：落とした欄の末尾に、押した時と同じ規則で入れる（文の途中に割り込ませない）
  document.addEventListener('dragover', function (e) { if (e.target && e.target.closest && e.target.closest('textarea[data-rw],#fKikan')) e.preventDefault(); });
  document.addEventListener('drop', function (e) {
    var t = e.target && e.target.closest && e.target.closest('textarea[data-rw],#fKikan');
    if (!t || App.st.screen !== 'incidents' || !I.form) return;
    var text = e.dataTransfer.getData('text/plain'); if (!text) return;
    e.preventDefault();
    t.focus(); if (t.setSelectionRange) t.setSelectionRange(t.value.length, t.value.length);
    putPhrase(text);
  });
  function rowsAt(path) { var p = path.split(':'); return I.form.rep[p[0]][p[1]]; }

  // 期間は記録の行（発覚・経緯・指導）の日付の最初と最後から決める
  function spanOf(rep, fallback) {
    var ds = [].concat(rep.s1.hk, rep.s1.kk, rep.s1.sd).map(function (r) { return r.d; }).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); }).sort();
    if (!ds.length) return { date: fallback || today(), dateEnd: '' };
    return { date: ds[0], dateEnd: ds[ds.length - 1] === ds[0] ? '' : ds[ds.length - 1] };
  }
  function body(x, f) {
    var dg = f.dg ? f.dg.d : x.diagram, sp = f.dg ? spanOf(f.rep, x.date) : { date: x.date, dateEnd: x.dateEnd || '' };
    return { url: f.url != null ? f.url : x.url, title: f.title != null ? f.title : x.title, date: sp.date, dateEnd: sp.dateEnd, detail: f.detail != null ? f.detail : x.detail || '',
      type: f.type || x.type, ids: dg ? dg.nodes.map(function (n) { return n.id; }) : x.ids, diagram: f.dg && onlyDamage(f.type) ? null : dg, report: f.rep };
  }
  function saved(inc, msg) {
    var list = D().incidents, i = list.map(function (y) { return y.id; }).indexOf(inc.id);
    if (i >= 0) list[i] = inc; else list.push(inc);
    I.sel = inc.id; I.mode = 'view'; I.form = null; I.focus = null; render(); App.toast(msg);
  }

  function suggHtml(q) {
    var d = D(), f = I.form, gs = srchGrades();
    q = (q || '').trim();
    if (!q) return '';
    var pool = [];
    if (gs.indexOf(d.grade) >= 0) yearOf(d.fy).rows.forEach(function (r) { pool.push({ id: r.id, grade: d.grade, cls: r.cls, no: r.no }); });
    var others = gs.filter(function (g0) { return g0 !== d.grade; });
    if (others.length && !SCHOOL) { loadSchool().then(function () { var el = App.$('fQ'); if (el && App.$('fSugg')) App.$('fSugg').innerHTML = suggHtml(el.value); }); }
    (SCHOOL || []).forEach(function (k) { if (others.indexOf(k.grade) >= 0) pool.push({ id: k.id, grade: k.grade, cls: k.cls }); });
    var items = pool.filter(function (r) {
      var s = d.kids[r.id]; if (!s) return false;
      return !f.dg.d.nodes.some(function (n) { return n.id === r.id; }) && (s.name.indexOf(q) >= 0 || s.name.replace(/\s/g, '').indexOf(q) >= 0 || s.kana.indexOf(q) >= 0 || r.id.indexOf(q) === 0 || String(r.no) === q);
    }).slice(0, 10);
    var label = function (r) {
      var s = d.kids[r.id], gc = r.grade + '-' + (r.cls + 1);
      return gc + ' ' + esc(s.name) + '<small>（' + esc(s.kana) + '）</small>'; // 学年-組・名前・よみ（よみで探した時にも合っているか分かる）
    };
    return items.length ? '<div class="sugg">' + items.map(function (r) { return '<button type="button" data-pick="' + r.id + '">' + label(r) + '</button>'; }).join('') + '</div>' : '<div class="note">' + (others.length && !SCHOOL ? '全校の名簿を読んでいます…' : '見つかりません') + '</div>';
  }

  // ===== 始める =====
  function newForm(kid) {
    HIST = [];
    var st = App.Diagram.state(null);
    if (kid) App.Diagram.add(st, kid);
    var rp = Rp.emptyReport(), d0 = today();
    ['hk', 'kk', 'sd'].forEach(function (k) { rp.s1[k].push({ d: d0, p: '', t: '' }); });
    I.form = { dg: st, type: '', url: '', title: '', detail: '', rep: rp };
    I.mode = 'form'; I.focus = null;
  }
  function editForm(x) {
    var st = App.Diagram.state(x.diagram);
    if (!x.diagram) x.ids.forEach(function (id) { App.Diagram.add(st, id); }); // 関係図の無い古い事案は、関係する児童を並べて始める
    I.form = { edit: x.id, dg: st, type: x.type, url: x.url || '', title: x.title || '', detail: x.detail || '', rep: Rp.norm(x.report) };
    ['hk', 'kk', 'sd'].forEach(function (k) { if (!I.form.rep.s1[k].length) I.form.rep.s1[k].push({ d: x.date, p: '', t: '' }); });
    I.mode = 'form'; I.sel = x.id; I.focus = null;
  }
  function add2Form(x) {
    I.form = { edit: x.id, rep: Rp.norm(x.report), x: x };
    ['sd', 'vi', 'ha'].forEach(function (k) { if (!I.form.rep.s2[k].length) I.form.rep.s2[k].push({ d: today(), p: '', t: '' }); });
    ensureV(x);
    I.mode = 'add2'; I.sel = x.id; I.focus = null;
  }
  function ensureV(x) {
    var vv = realVictims(x);
    if (vv.length > 1) vv.forEach(function (id) { if (!I.form.rep.s2v[id] || !I.form.rep.s2v[id].length) I.form.rep.s2v[id] = [{ d: today(), p: '', t: '' }]; });
  }

// 名簿：年度・組（または学年・全校）を切り替えて見る。編集できる年度は1つだけ
// （決定前＝今年度、決定後＝次の年度。決定後の今年度は凍結）。児童の名前を押すと、経年の記録と事案を窓で出す。
(function (g) {
  'use strict';
  var App = g.App, C = g.CONFIG, E = g.Engine;
  var R = { fy: 0, cls: 0, scope: 'cls', kid: null, form: null, school: null, col: null };

  function D() { return App.st.data; }
  // ロック：名簿の表の編集（配慮項目・備考・つける離す・名前・組・番号）を止める。端末ごとに覚える（初めはロック）
  var LOCK = (function () { try { return localStorage.getItem('classSplit.rosterLock') !== '0'; } catch (e) { return true; } })();
  function setLock(v) { LOCK = v; try { localStorage.setItem('classSplit.rosterLock', v ? '1' : '0'); } catch (e) { /* 今の画面には効く */ } }
  function editableFy() { return D().decision ? D().fy + 1 : D().fy; }
  function yearOf(fy) { return D().years.filter(function (y) { return y.fy === fy; })[0]; }
  function incsOf(id, fy) {
    return D().incidents.filter(function (x) { return x.ids.indexOf(id) >= 0 && (fy == null || C.fiscalYearOfIso(x.date) === fy); });
  }

  // つける・離すは今年度の学年の分だけ（決定の後は前年度からの候補として持ち越す）
  function pairEdit() { return R.fy === D().fy && !D().decision; }
  function pairsOf(id) { return D().pairs.filter(function (p) { return p.a === id || p.b === id; }); }
  function openPairs(a) {
    var d = D(), Y = yearOf(d.fy), nc = 0;
    Y.rows.forEach(function (r) { if (r.cls + 1 > nc) nc = r.cls + 1; });
    var kids = Y.rows.map(function (r) { var s = d.kids[r.id]; return { id: r.id, name: s.name, kana: s.kana, no: r.no, cls: r.cls }; });
    (d.transfers || []).forEach(function (t) { kids.push({ id: t.id, name: t.name, kana: t.kana, no: 0, cls: -1 }); });
    App.pairsDialog({ kids: kids, nc: Math.min(C.MAX_CLASSES, Math.max(2, nc)), pre: '', a: a,
      save: function (list) { return App.pf().savePairs(d.grade, list); } });
  }

  // 備考：児童ごと・年度ごとの自由記述。決定で来年度に写る
  // 右下の角か（指でも押せるよう、角の三角より少し広くとる）
  // 長押し（約0.5秒）でも角と同じ窓を開く。指やペンで角を狙わなくてよいように。開いたら、離した時の「押す」（値を変える）は捨てる
  var LP = { t: 0, fired: false };
  document.addEventListener('pointerdown', function (e) {
    if (App.st.screen !== 'roster' || App.dlg) return;
    var td = e.target.closest && e.target.closest('td.cc'); if (!td) return;
    clearTimeout(LP.t); LP.fired = false;
    var x0 = e.clientX, y0 = e.clientY;
    LP.move = function (ev) { if (Math.abs(ev.clientX - x0) > 8 || Math.abs(ev.clientY - y0) > 8) clearTimeout(LP.t); };
    document.addEventListener('pointermove', LP.move);
    LP.t = setTimeout(function () { LP.fired = true; if (navigator.vibrate) { try { navigator.vibrate(15); } catch (er) { /* 無くてよい */ } } cornerDialog(td); }, 500);
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) { document.addEventListener(ev, function () { clearTimeout(LP.t); if (LP.move) document.removeEventListener('pointermove', LP.move); }); });
  document.addEventListener('click', function (e) { if (LP.fired) { LP.fired = false; e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', function (e) { if (App.st.screen === 'roster' && e.target.closest && e.target.closest('td.cc')) e.preventDefault(); }); // 長押しで出るメニューを止める
  function inCorner(td, e) { var q = td.getBoundingClientRect(), z = 18; return e.clientX >= q.right - z && e.clientY >= q.bottom - z; }
  // 角を押した時の窓：欄の種類ごとに、文字の入力・相手の選択・事案などをここに集める
  function cornerDialog(td) {
    var d = D(), Y = yearOf(R.fy), id = td.dataset.cell || td.dataset.kid || td.dataset.rpair || td.dataset.memo;
    var r = Y.rows.filter(function (y) { return y.id === id; })[0];
    if (td.classList.contains('ji')) { R.kid = id; R.form = null; render(); return; }
    if (td.classList.contains('pr')) { kidPairsDialog(id); return; }
    if (R.fy !== editableFy() || !r) return;
    if (td.classList.contains('memo')) { memoDialog(Y, r); return; }
    var k = td.dataset.k;
    if (k === 'sp') { levelDialog(Y, r, { k: 'sp', label: '特別支援学級', max: 1, help: ['特別支援学級', '在籍している。'] }, td); return; }
    var at = C.ATTRS.filter(function (a) { return a.k === k; })[0];
    if (at.side) noteDialog(Y, r, at, td); else if (at.ctx) ctxDialog(Y, r, at, td); else levelDialog(Y, r, at, td);
  }
  // 程度を選ぶ窓（説明つき）
  function levelDialog(Y, r, at, cell) {
    var s = D().kids[r.id], cur = at.k === 'sp' ? (r.a.sp ? 1 : 0) : at.k === 'k7' ? r.a.k7m | 0 : r.a[at.k] | 0, fy = R.fy, grade = Y.grade, esc = App.esc;
    var opts = [[0, '無', '']].concat([[1, at.k === 'sp' ? 'あり' : App.mark(at, 1), (at.help || [])[1] || '']]).concat(at.max > 1 ? [[2, App.mark(at, 2), (at.help || [])[2] || '']] : []);
    App.openDlg({
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="' + esc(at.label) + '" style="max-width:520px"><h2>' + esc(s.name) + 'の' + esc(at.label) + '</h2>' +
          '<div class="lvpick">' + opts.map(function (o) { return '<button type="button" class="lvopt" data-lvset="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '"><span class="ic">' + o[1] + '</span><span>' + esc(o[2]) + '</span></button>'; }).join('') + '</div>' +
          (at.k === 'k7' ? '<div class="notebox">' + (r.a.k7s ? '点数か順位で上位なので、「賢い」が付いています（手動の印とは別）。' : '手動の印のほかに、クラス分けテストの点数か学力の順位の上位にも「賢い」が付きます。') +
            '<div style="margin-top:6px;display:flex;flex-direction:column;align-items:flex-start;gap:6px"><button type="button" class="btn primary" data-score="1">クラス分けテストの点数を入力</button>' +
            '<button type="button" class="btn primary" data-rank="1">学力の順位を入力</button></div>' +
            '<p class="note">点数と順位のどちらで決めるかは、学力の窓の上で選びます。</p></div>' : '') +
          '<div class="acts"><button class="btn" data-act="close">閉じる<kbd>Esc</kbd></button></div></div></div>';
      },
      click: function (t) {
        if (t.closest('[data-score]')) { App.closeDlg(); scoreDialog(Y); return true; }
        if (t.closest('[data-rank]')) { App.closeDlg(); rankDialog(Y); return true; }
        var x = t.closest('[data-lvset]'); if (!x) return false;
        var v = +x.dataset.lvset;
        if (at.k === 'k7') { r.a.k7m = v; App.applyScores(D()); App.closeDlg(); render(); App.save(function () { return App.pf().setAttr(fy, grade, r.id, 'k7', v); }); return true; }
        if (at.k === 'sp') { if (v) r.a.sp = 1; else delete r.a.sp; cell.innerHTML = v ? '<span class="spb">支</span>' : ''; }
        else { r.a[at.k] = v; cell.innerHTML = v ? App.mark(at, v, r.a[at.k + '_t']) : ''; }
        App.closeDlg();
        App.save(function () { return App.pf().setAttr(fy, grade, r.id, at.k, v); });
        return true;
      }
    });
  }

  // 程度＋経緯の文＋事案の紐付け（保護者など ctx の項目）
  function ctxDialog(Y, r, at, cell) {
    var d = D(), s = d.kids[r.id], fy = R.fy, grade = Y.grade, esc = App.esc;
    var F = { v: r.a[at.k] | 0, text: r.a[at.k + '_t'] || '', incs: (r.a[at.k + '_i'] || []).slice(), show: !!(r.a[at.k + '_i'] || []).length };
    var rel = d.incidents.filter(function (x) { return x.ids.indexOf(r.id) >= 0; }).sort(function (a, b) { return b.date < a.date ? -1 : 1; });
    App.openDlg({
      focus: 'ctxt', noEnter: true,
      html: function () {
        var opts = [[0, '無', '']].concat([[1, App.mark(at, 1), at.help[1] || ''], [2, App.mark(at, 2), at.help[2] || '']]);
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="' + esc(at.label) + '" style="max-width:640px"><h2>' + esc(s.name) + 'の' + esc(at.label) + '</h2>' +
          '<div class="lvpick">' + opts.map(function (o) { return '<button type="button" class="lvopt" data-cv="' + o[0] + '" aria-pressed="' + (F.v === o[0]) + '"><span class="ic">' + o[1] + '</span><span>' + esc(o[2]) + '</span></button>'; }).join('') + '</div>' +
          '<label class="ctxl">経緯<textarea id="ctxt" rows="4" maxlength="1000" placeholder="いつから・どんなことが・どう対応したか">' + esc(F.text) + '</textarea></label>' +
          '<label class="chk"><input type="checkbox" id="cshow"' + (F.show ? ' checked' : '') + '>関わる事案を見て紐付ける（' + rel.length + '件）</label>' +
          (F.show ? '<div class="pinclist">' + (rel.map(function (x) { return '<label class="chk"><input type="checkbox" data-cinc="' + x.id + '"' + (F.incs.indexOf(x.id) >= 0 ? ' checked' : '') + '><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title || '（名前なし）') + ' ↗</a><span class="note">' + App.span(x) + '</span></label>'; }).join('') || '<div class="note">事案はありません</div>') + '</div>' : '') +
          '<div class="note">「無」で保存すると、経緯と紐付けも消えます。</div>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">保存</button></div></div></div>';
      },
      input: function (t) {
        if (t.id === 'ctxt') F.text = t.value;
        else if (t.id === 'cshow') { F.show = t.checked; App.refreshDlg(); }
        else if (t.dataset.cinc) { var n = +t.dataset.cinc, i = F.incs.indexOf(n); if (t.checked && i < 0) F.incs.push(n); if (!t.checked && i >= 0) F.incs.splice(i, 1); }
      },
      click: function (t) { var x = t.closest('[data-cv]'); if (!x) return false; F.v = +x.dataset.cv; App.refreshDlg(); return true; },
      onOk: function () {
        var v = F.v, text = v ? F.text.trim() : '', incs = v ? F.incs.slice() : [];
        r.a[at.k] = v;
        if (text) r.a[at.k + '_t'] = text; else delete r.a[at.k + '_t'];
        if (incs.length) r.a[at.k + '_i'] = incs; else delete r.a[at.k + '_i'];
        App.closeDlg();
        cell.innerHTML = v ? App.mark(at, v, r.a[at.k + '_t']) : '';
        App.save(function () { return App.pf().setAttr(fy, grade, r.id, at.k, v, text, incs); });
      }
    });
  }

  // クラス分けテストの点数：出席番号順の表に手で入れるか、Excel などの列（点数だけ、または 番号・名前・点数）を貼る。
  // 満点と上位の割合も決める。組の中の男女ごとに、上位の児童に「賢い」が付く（手動の印は消さない。学力しんどさとは連動しない）
  // 学力の窓の上の部分（点数・順位で共通）：切り替えのタブ、「賢い」の決め方（点数か順位か）、手動で付けた「賢い」の児童
  function acadHead(Y, kind, F) {
    var d = D(), esc = App.esc, man = Y.rows.filter(function (r) { return r.a.k7m; });
    return '<h2>学力（' + R.fy + '年度 ' + C.gradeLabel(Y.grade) + '）</h2>' +
      '<div class="rbar acadtabs"><button type="button" class="tab" data-acadtab="score" aria-selected="' + (kind === 'score') + '">点数</button><button type="button" class="tab" data-acadtab="rank" aria-selected="' + (kind === 'rank') + '">順位</button>' +
      '<span class="acaduse">「賢い」の決め方 <label class="chk"><input type="radio" name="acaduse" data-acaduse="score"' + (F.use === 'score' ? ' checked' : '') + '> 点数で</label><label class="chk"><input type="radio" name="acaduse" data-acaduse="rank"' + (F.use === 'rank' ? ' checked' : '') + '> 順位で</label></span></div>' +
      '<p class="note">学力は組の中の男女ごとに比べます。' + (man.length ? '</p><details class="acadman"><summary>手動で「賢い」を付けた児童 ' + man.length + '人（点数・順位に関わらず「賢い」）</summary><div class="note">' + man.map(function (r) { return esc(d.kids[r.id].name); }).join('、') + '</div></details>' : '手動で「賢い」を付けた児童はいません。</p>');
  }
  // タブを押した時：保存していない入力があれば切り替えない（入力を失わない）
  function acadTab(t, kind, F, Y) {
    var b = t.closest('[data-acadtab]'); if (!b) return false;
    if (b.dataset.acadtab === kind) return true;
    if (F.dirty) { App.toast('入力を保存するか「やめる」を押してから切り替えてください'); return true; }
    App.closeDlg(); (b.dataset.acadtab === 'rank' ? rankDialog : scoreDialog)(Y); return true;
  }
  App.acadDialog = function () { var Y = yearOf(R.fy), sc = D().scores[R.fy] || {}; (sc.use === 'rank' ? rankDialog : scoreDialog)(Y); };
  function scoreDialog(Y) {
    var d = D(), fy = R.fy, grade = Y.grade, esc = App.esc, sc0 = d.scores[fy] || {};
    var F = { max: sc0.max || C.SCORE_DEF.max, top: sc0.top || C.SCORE_DEF.top, s: Object.assign({}, sc0.s || {}), use: sc0.use || 'score', dirty: false };
    var rows = Y.rows.slice().sort(function (a, b) { return a.cls - b.cls || a.no - b.no; });
    var tops = function () { return App.topIds({ max: F.max, top: F.top, s: F.s }, App.scoreGroup(d, Y)); }; // 組の中の男女ごとの上位
    App.openDlg({
      noEnter: true, focus: 'scPaste',
      html: function () {
        var tp = tops(), n = Object.keys(F.s).length;
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="学力（点数）" style="max-width:760px">' + acadHead(Y, 'score', F) +
          '<div class="scset"><label>満点 <input type="number" id="scMax" min="1" max="10000" value="' + F.max + '"> 点</label>' +
          '<label>組の男女ごとに上から <input type="number" id="scTop" min="1" max="99" value="' + Math.round(F.top * 100) + '"> ％刻みで段に分ける（1段＝「賢い」。2段から下は印なしで、クラス分けで組ごとにそろえる）</label>' +
          '<span class="note">入力 ' + n + '人・上位 ' + Object.keys(tp).length + '人（同点は含める）</span></div>' +
          '<label class="ctxl">まとめて貼る（Excel などから。1行に1人：点数だけなら下の表の順、または「組・番号・点数」「名前・点数」）<textarea id="scPaste" rows="3" placeholder="例）1	1	85"></textarea></label>' +
          '<div class="acts" style="margin-top:4px;justify-content:flex-start"><button type="button" class="btn" data-scpaste="1">貼った値を表に入れる</button></div>' +
          '<div class="sctab"><table class="h"><thead><tr><th>組-番</th><th>名前</th><th>点数</th><th></th></tr></thead><tbody>' + rows.map(function (r) {
            var v = F.s[r.id];
            return '<tr><td>' + (r.cls + 1) + '-' + r.no + '</td><td>' + esc(d.kids[r.id].name) + '</td><td><input type="number" class="scin" data-sc="' + r.id + '" min="0" max="' + F.max + '" value="' + (v == null ? '' : v) + '"></td><td>' + (tp[r.id] ? App.mark(C.ATTRS.filter(function (a) { return a.k === 'k7'; })[0], 1) : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<div class="note">空欄は点数なし（順位に入れない）。学力しんどさの印は変わりません。</div>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">保存</button></div></div></div>';
      },
      input: function (t) {
        if (t.dataset.acaduse) { F.use = t.dataset.acaduse; F.dirty = true; return; }
        F.dirty = true;
        if (t.id === 'scMax') { var m = +t.value; if (m > 0) F.max = m; return; }
        if (t.id === 'scTop') { var p = +t.value; if (p >= 1 && p <= 99) F.top = p / 100; return; }
        if (t.dataset.sc) { if (t.value === '') delete F.s[t.dataset.sc]; else F.s[t.dataset.sc] = Math.max(0, Math.min(F.max, +t.value)); }
      },
      click: function (t) {
        if (acadTab(t, 'score', F, Y)) return true;
        if (!t.closest('[data-scpaste]')) return false;
        F.dirty = true;
        var lines = App.$('scPaste').value.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean), bad = 0;
        var byName = {}; rows.forEach(function (r) { byName[d.kids[r.id].name.replace(/[\s　]/g, '')] = r; });
        lines.forEach(function (l, i) {
          var c = l.split(/\t|,|\s+/).filter(Boolean), num = +c[c.length - 1], r = null;
          if (!(num >= 0) || num > F.max) { bad++; return; }
          if (c.length === 1) r = rows[i];
          else if (c.length >= 3 && /^\d+$/.test(c[0]) && /^\d+$/.test(c[1])) r = rows.filter(function (x) { return x.cls + 1 === +c[0] && x.no === +c[1]; })[0];
          else r = byName[c.slice(0, -1).join('').replace(/[\s　]/g, '')];
          if (r) F.s[r.id] = num; else bad++;
        });
        App.refreshDlg(); App.toast(lines.length - bad + '人を入れました' + (bad ? '（' + bad + '行は読めませんでした）' : ''));
        return true;
      },
      onOk: function () {
        var v = { max: F.max, top: F.top, s: F.s, r: sc0.r || {}, use: F.use }; // 順位は残す。決め方は窓の切り替えで選んだ方
        d.scores[fy] = v; App.applyScores(d); App.closeDlg(); render();
        App.save(function () { return App.pf().setScores(fy, grade, v); });
      }
    });
  }

  // 学力の順位：組の中の男女ごと（1組の男子・1組の女子…）に、上から1位・2位…の並び。上の切り替えで組と男女を選ぶ。
  // 順位の数字を打つか、名前をドラッグして入れ替える（指・ペンでも動く）。
  // 上位の割合（点数と共用）の線より上の児童に「賢い」が付く。保存すると、点数ではなく順位で決める
  function rankDialog(Y) {
    var d = D(), fy = R.fy, grade = Y.grade, esc = App.esc, sc0 = d.scores[fy] || {};
    var F = { top: sc0.top || C.SCORE_DEF.top, use: sc0.use === 'score' && Object.keys(sc0.s || {}).length ? 'score' : 'rank', dirty: false };
    var r0 = sc0.r || {}, s0 = sc0.s || {}, grp = App.scoreGroup(d, Y), byId = {};
    Y.rows.forEach(function (r) { byId[r.id] = r; });
    // 組ごと・男女ごとの並び。始めは 前の順位 → 点数の高い順 → 番号
    var G = {}, keys = [];
    Y.rows.slice().sort(function (a, b) {
      var ra = r0[a.id] || 1e9, rb = r0[b.id] || 1e9; if (ra !== rb) return ra - rb;
      var sa = s0[a.id] == null ? -1 : s0[a.id], sb = s0[b.id] == null ? -1 : s0[b.id]; if (sa !== sb) return sb - sa;
      return a.no - b.no;
    }).forEach(function (r) { var k = grp(r.id); if (!G[k]) { G[k] = []; keys.push(k); } G[k].push(r.id); });
    keys.sort(function (a, b) { var p = a.split(':'), q = b.split(':'); return (+p[0] - +q[0]) || (p[1] === 'm' ? -1 : 1); });
    var cur = keys.filter(function (k) { return +k.split(':')[0] === (R.scope === 'cls' ? R.cls : 0); })[0] || keys[0];
    var label = function (k) { var p = k.split(':'); return (+p[0] + 1) + '組・' + (p[1] === 'm' ? '男子' : '女子'); };
    var order = function () { return G[cur] || []; };
    var cut = function () { return Math.max(1, Math.round(order().length * F.top)); };
    // 段：1段は上位の割合まで、2段から下は並びの位置で刻む（名簿の計算 App.tiers と同じ決め方）
    var tierAt = function (i) { var n = order().length; return i < cut() ? 1 : Math.max(2, Math.min(C.TIER_MAX, Math.floor(i / (n * F.top)) + 1)); };
    var row = function (id, i) {
      var r = byId[id], s = d.kids[id], t = tierAt(i), last = i === order().length - 1 || tierAt(i + 1) !== t;
      return '<div class="rkrow' + (t === 1 ? ' top' : '') + (i === cut() - 1 ? ' cut' : last ? ' tierend' : '') + '" data-rk="' + id + '">' +
        '<span class="rkt" title="' + t + '段">' + (i + 1) + '位</span>' +
        '<input type="number" class="rkn" data-rkn="' + id + '" min="1" max="' + order().length + '" value="' + (i + 1) + '" aria-label="順位">' +
        '<span class="rkh" data-rkh="' + id + '" title="ドラッグで入れ替える">⠿ ' + esc(s.name) + '<small>' + (r.cls + 1) + '-' + r.no + '</small></span>' +
        (s0[id] != null ? '<span class="note">' + s0[id] + '点</span>' : '') +
        '<span class="rkk">' + (t === 1 ? App.mark(C.ATTRS.filter(function (a) { return a.k === 'k7'; })[0], 1) : '') + '</span></div>'; // 1段＝「賢い」は右に印
    };
    var list = function () { return order().map(row).join(''); };
    var redraw = function () { var el = App.$('rklist'); if (el) { var st = el.scrollTop; el.innerHTML = list(); el.scrollTop = st; } var n = App.$('rkcnt'); if (n) n.textContent = label(cur) + '：上位 ' + cut() + '人に「賢い」'; };
    var moveTo = function (id, pos) { F.dirty = true; var o = order(), i = o.indexOf(id); if (i < 0) return; o.splice(i, 1); o.splice(Math.max(0, Math.min(o.length, pos)), 0, id); };
    App.openDlg({
      noEnter: true,
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg rkdlg" role="dialog" aria-modal="true" aria-label="学力（順位）" style="max-width:600px">' + acadHead(Y, 'rank', F) +
          '<div class="rbar rktabs">' + keys.map(function (k) { return '<button type="button" class="tab" data-rkg="' + k + '" aria-selected="' + (k === cur) + '"><span class="band" style="background:' + App.classColor(+k.split(':')[0]).c + '"></span>' + label(k) + '（' + G[k].length + '）</button>'; }).join('') + '</div>' +
          '<div class="scset"><label>組の男女ごとに上から <input type="number" id="rkTop" min="1" max="99" value="' + Math.round(F.top * 100) + '"> ％刻みで段に分ける（1段＝「賢い」）</label><span class="note" id="rkcnt">' + label(cur) + '：上位 ' + cut() + '人に「賢い」</span>' +
          (Object.keys(s0).length ? '<button type="button" class="btn" data-rkscore="1">この組・男女を点数の順に並べ直す</button>' : '') + '</div>' +
          '<p class="note">順位の数字を打つか、名前（⠿）をドラッグして並べ替えます。太い線より上に「賢い」が付きます。</p>' +
          '<div class="rklist" id="rklist">' + list() + '</div>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">保存（全部の組・男女の順位）</button></div></div></div>';
      },
      input: function (t) {
        if (t.dataset.acaduse) { F.use = t.dataset.acaduse; F.dirty = true; return; }
        if (t.id === 'rkTop') { var p = +t.value; if (p >= 1 && p <= 99) { F.top = p / 100; F.dirty = true; redraw(); } }
      },
      click: function (t) {
        if (acadTab(t, 'rank', F, Y)) return true;
        var b = t.closest('[data-rkg]'); if (b) { cur = b.dataset.rkg; App.refreshDlg(); return true; }
        if (t.closest('[data-rkscore]')) { order().sort(function (a, c) { var sa = s0[a] == null ? -1 : s0[a], sc = s0[c] == null ? -1 : s0[c]; return sc - sa; }); redraw(); return true; }
        return false;
      },
      onOk: function () {
        var r = {}; keys.forEach(function (k) { G[k].forEach(function (id, i) { r[id] = i + 1; }); }); // 順位は組・男女の中での順位
        var v = { max: sc0.max || C.SCORE_DEF.max, top: F.top, s: s0, r: r, use: F.use };
        d.scores[fy] = v; App.applyScores(d); App.closeDlg(); render();
        App.save(function () { return App.pf().setScores(fy, grade, v); });
      }
    });
    // 順位の数字：打ち終えたら（Enter か欄を出た時）その位置へ
    var commit = function (t) { var n = Math.floor(+t.value); if (n >= 1) { moveTo(t.dataset.rkn, n - 1); redraw(); var el = document.querySelector('[data-rkn="' + t.dataset.rkn + '"]'); if (el) el.focus(); } };
    var layer = App.$('layer'), H = {};
    H.change = function (e) { if (e.target.dataset && e.target.dataset.rkn) commit(e.target); };
    H.keydown = function (e) { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.rkn) { e.preventDefault(); e.target.blur(); } };
    // ドラッグ：⠿ を押して上下に動かすと、指の下の行の位置へ入れる（動かすたびに並びを描き直す）
    var drag = null;
    H.pointerdown = function (e) {
      var h = e.target.closest && e.target.closest('[data-rkh]'); if (!h) return;
      e.preventDefault(); drag = h.dataset.rkh; layer.setPointerCapture && layer.setPointerCapture(e.pointerId);
      var rw = h.closest('.rkrow'); if (rw) rw.classList.add('drag');
    };
    H.pointermove = function (e) {
      if (!drag) return;
      var el = document.elementFromPoint(e.clientX, e.clientY), rw = el && el.closest && el.closest('[data-rk]'), box = App.$('rklist');
      if (box) { var q = box.getBoundingClientRect(); if (e.clientY < q.top + 24) box.scrollTop -= 12; else if (e.clientY > q.bottom - 24) box.scrollTop += 12; } // 端に寄せると流す
      if (!rw || rw.dataset.rk === drag) return;
      moveTo(drag, order().indexOf(rw.dataset.rk)); redraw();
      var me = document.querySelector('[data-rk="' + drag + '"]'); if (me) me.classList.add('drag');
    };
    H.pointerup = H.pointercancel = function () { if (!drag) return; drag = null; redraw(); };
    Object.keys(H).forEach(function (k) { layer.addEventListener(k, H[k]); });
    // 窓を閉じたら外す（開くたびに増やさない）
    var dlg = App.dlg, prevClose = dlg.onClose;
    dlg.onClose = function () { Object.keys(H).forEach(function (k) { layer.removeEventListener(k, H[k]); }); if (prevClose) prevClose(); };
  }

  function memoDialog(Y, r) {
    var s = D().kids[r.id], fy = R.fy, grade = Y.grade, esc = App.esc;
    var SB = C.normSibs(r.a.sib || []), memoNow = r.a.memo || '';
    var sibRows = function () {
      return SB.map(function (x, i) {
        return '<div class="sibrow"><select data-sbr="' + i + '">' + C.SIB_REL.map(function (q) { return '<option' + (q === x.r ? ' selected' : '') + '>' + q + '</option>'; }).join('') + '</select>' +
          '<select data-sbg="' + i + '">' + C.SIB_GRADES.map(function (q) { return '<option value="' + q[0] + '"' + (q[0] === x.g ? ' selected' : '') + '>' + q[1] + '</option>'; }).join('') + '</select>' +
          '<input data-sbn="' + i + '" value="' + esc(x.n) + '" maxlength="20" placeholder="名前（なくてよい）">' +
          '<button type="button" class="btn ib" data-sbdel="' + i + '" aria-label="この兄弟を消す">✕</button></div>';
      }).join('') || '<div class="note">兄弟はいません（いれば「＋兄弟を足す」）</div>';
    };
    App.openDlg({
      focus: 'mtx',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="備考" style="max-width:700px">' +
          '<h2>' + App.esc(s.name) + 'の備考（' + fy + '年度）</h2>' + (s.addr ? '<p class="note">住所：' + App.esc(s.addr) + '</p>' : '') +
          '<textarea id="mtx" rows="5" maxlength="400" style="width:100%;box-sizing:border-box;font:inherit;padding:6px" placeholder="引き継ぎたいこと（400字まで）">' + App.esc(memoNow) + '</textarea>' +
          // 定型の言葉：選ぶと、入力欄のカーソルの位置に「、」で区切って入る
          '<div class="mpicks">' + C.MEMO_PICKS.map(function (g, i) { return '<select data-mpick="' + i + '"><option value="">' + App.esc(g.label) + ' ▾</option>' + g.items.map(function (w) { return '<option>' + App.esc(w) + '</option>'; }).join('') + '</select>'; }).join('') + '</div>' +
          '<div class="lab" style="margin-top:10px">兄弟（この学校にいない兄弟も）</div><div id="sibs">' + sibRows() + '</div>' +
          '<button type="button" class="btn" data-sbadd="1">＋兄弟を足す</button>' +
          '<div class="note">学年の先生全員が見られます。クラス替えを決定すると、来年度の名簿にも写ります（兄弟の学年は1つ上がります）。個人票の印刷では、備考の欄の下に家庭環境と兄弟をまとめて出します。</div>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">保存<kbd>Ctrl+Enter</kbd></button></div></div></div>';
      },
      click: function (t) {
        var b;
        if (t.closest('[data-sbadd]')) { memoNow = App.$('mtx').value; SB.push({ r: '兄', g: Math.min(10, grade + 1), n: '' }); App.refreshDlg(); return true; }
        if ((b = t.closest('[data-sbdel]'))) { memoNow = App.$('mtx').value; SB.splice(+b.dataset.sbdel, 1); App.refreshDlg(); return true; }
        return false;
      },
      input: function (t) {
        if (t.dataset.sbr != null) { SB[+t.dataset.sbr].r = t.value; return; }
        if (t.dataset.sbg != null) { SB[+t.dataset.sbg].g = +t.value; return; }
        if (t.dataset.sbn != null) { SB[+t.dataset.sbn].n = t.value; return; }
        if (!t.dataset.mpick || !t.value) return;
        var ta = App.$('mtx'), w = t.value, a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
        var before = v.slice(0, a), after = v.slice(b), sep = before && !/[、。\s]$/.test(before) ? '、' : '';
        ta.value = (before + sep + w + after).slice(0, 400); t.value = '';
        var pos = Math.min(400, (before + sep + w).length); ta.focus(); ta.setSelectionRange(pos, pos);
      },
      onOk: function () {
        var text = App.$('mtx').value.trim().slice(0, 400), sb = C.normSibs(SB), changedSib = JSON.stringify(sb) !== JSON.stringify(C.normSibs(r.a.sib || []));
        if (text) r.a.memo = text; else delete r.a.memo;
        if (sb.length) r.a.sib = sb; else delete r.a.sib;
        App.closeDlg(); render();
        App.save(function () { return App.pf().setAttr(fy, grade, r.id, 'memo', text ? 1 : 0, text); });
        if (changedSib) App.save(function () { return App.pf().setAttr(fy, grade, r.id, 'sib', sb.length ? 1 : 0, JSON.stringify(sb)); });
      }
    });
  }

  // ===== 並び順：見出しを押した順に、第一・第二…の優先にする。この端末に覚える =====
  // 1回目：その列を次の優先に足す（数の列は多い順、組・番号・よみ・性別は小さい順）。2回目：向きを逆に。3回目：外す。
  // どれも選んでいない時は、組→番号→よみ
  var NUM_DESC = { cls: false, no: false, kana: false, sex: false }; // ここに無い列（印・事案・つける離す・備考・特支）は多い順から
  var SORT = (function () { try { var v = JSON.parse(localStorage.getItem('classSplit.rosterSort')); if (Array.isArray(v)) return v.filter(function (x) { return x && x.k; }); } catch (e) { /* 読めない時は既定 */ } return []; })();
  function saveSort() { try { localStorage.setItem('classSplit.rosterSort', JSON.stringify(SORT)); } catch (e) { /* 覚えられなくても今の画面には効く */ } }
  function clickSort(k) {
    var i = SORT.map(function (x) { return x.k; }).indexOf(k), first = NUM_DESC[k] === false ? 1 : -1;
    if (i < 0) SORT.push({ k: k, dir: first });
    else if (SORT[i].dir === first) SORT[i].dir = -first;
    else SORT.splice(i, 1);
    saveSort(); render();
  }
  var SORT_LABEL = { cls: '組', no: '番号', kana: 'よみ', sex: '性別', sp: '特支', ji: '事案数', pr: 'つける離す', memo: '備考' };
  function sortLabel(k) { var at = C.ATTRS.filter(function (a) { return a.k === k; })[0]; return at ? at.label : SORT_LABEL[k] || k; }

  // 使い方の窓（帯の「?」）
  function helpDialog() {
    var d = D();
    App.openDlg({ noEnter: true, html: function () {
      return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="名簿の使い方" style="max-width:640px"><h2>名簿の使い方</h2><div class="note">' +
        '配慮項目のマスの真ん中を押す：空→アイコン→＋→空。マスの右下の灰色の角を押すか、マスを長押しする：説明・経緯・事案などの窓（文字を書く窓は「保存」で保存）。<br>' +
        '見出しを押した順に並べ替えの優先になります（もう一度で逆、3回目で外す）。<br>' +
        'つける・離すの欄の右下を押すと、その児童のつける・離す（経緯・理由・何年生から）の窓が開きます。学年全体の一覧はクラス分けの画面の「つける離す」でも同じものを直せます。<br>' +
        '直せるのは' + editableFy() + '年度だけです（' + (d.decision ? '決定の後は今年度を凍結' : '決定前は今年度') + '）。</div>' +
        '<div class="acts"><button class="btn" data-act="close">閉じる<kbd>Esc</kbd></button></div></div></div>';
    } });
  }

  function reset() { R.fy = editableFy(); R.cls = App.me && App.me.grade === App.st.grade && App.me.cls >= 0 ? App.me.cls : 0; R.scope = 'cls'; R.byCount = false; R.kid = null; R.form = null; R.school = null; }

  function render() {
    var d = D(), esc = App.esc;
    var years = d.years.map(function (y) { return y.fy; }).sort(function (a, b) { return b - a; });
    if (years.indexOf(R.fy) < 0) R.fy = editableFy();
    var Y = yearOf(R.fy), canEdit = R.fy === editableFy(), edit = canEdit && !LOCK;
    if (!Y) { // まだ名簿が無い学年
      App.$('main').innerHTML = '<div class="menu"><section><h2>' + C.gradeLabel(d.grade) + 'の名簿がまだありません</h2>' +
        '<p>' + (d.grade === 0 ? '入学する児童の名簿の範囲（見出しの行ごと）をコピーして貼り付けます。名前・よみ・性別があれば足ります。児童IDは無くてよく、仮の番号を振ります（入学後に本来の児童IDの入った名簿を貼ると、名前で照らして付け替えます）。' : '既存の名簿の範囲をコピーして貼り付けます（児童ID・名前・よみ・性別・組・番号）。') + '</p>' +
        '<button class="btn primary" id="paste">名簿を貼る…</button></section></div>';
      if (App.st.openPaste) { App.st.openPaste = false; pasteDialog(); }
      return;
    }
    var nc = 0; Y.rows.forEach(function (r) { if (r.cls + 1 > nc) nc = r.cls + 1; });
    // 上の帯：編集中に使う「組・学年」の切り替えと、いまの状態（既定と違う時だけ）だけを出す。ほかは「その他…」の窓へ
    var h = '<div class="rbar">';
    // 決定の後の準備中の年度：組の番号が仮の間は、どの新しい組かを添える
    var prov = R.fy === d.fy + 1 && d.decision && !d.decision.named ? d.decision.names : null;
    for (var k = 0; k < nc; k++) h += '<button class="tab" data-cls="' + k + '" aria-selected="' + (R.scope === 'cls' && R.cls === k) + '"><span class="band" style="background:' + App.classColor(k).c + '"></span>' + (k + 1) + '組' + (prov && prov.indexOf(k + 1) >= 0 ? '〔' + C.newClass(prov.indexOf(k + 1)) + '・仮〕' : '') + '（' + Y.rows.filter(function (r) { return r.cls === k; }).length + '人）</button>';
    // クラスなし：どの組にも入っていない児童（未振り分けの特別支援学級の児童など）と、転出済み・転入予定の児童
    var nNone = Y.rows.filter(function (r) { return r.cls < 0; }).length;
    h += '<button class="tab" data-cls="-1" aria-selected="' + (R.scope === 'cls' && R.cls === -1) + '"><span class="band" style="background:' + App.classColor(-1).c + '"></span>クラスなし（' + nNone + '人）</button>';
    h += '<button class="tab" data-scope="grade" aria-selected="' + (R.scope === 'grade') + '">学年（' + Y.rows.length + '人）</button>';
    if (R.scope === 'school') h += '<span class="state">全校の事案を表示中<button class="btn" data-scope="cls">戻る</button></span>';
    else {
      if (R.fy !== editableFy()) h += '<span class="state">' + R.fy + '年度（' + C.gradeLabel(Y.grade) + '）を表示中・' +
        (R.fy === d.fy && d.decision ? '決定したので凍結' : '見るだけ') + '<button class="btn" data-fy="' + editableFy() + '">戻る</button></span>';
      if (SORT.length) h += '<span class="state">並び順：' + SORT.map(function (x) { return App.esc(sortLabel(x.k)) + (x.dir > 0 ? '↑' : '↓'); }).join('→') + '<button class="btn" id="unorder">解除</button></span>';
    }
    // 名簿を貼る：年度の初めや転入の時にすぐ使えるよう、上の帯に出す（直せる年度だけ）
    // 「その他」の窓をやめ、年度・全校の事案・絞り込み・使い方を帯に出す
    var years = d.years.map(function (y) { return y.fy; }).sort(function (a, b) { return b - a; });
    h += '<span class="sp"></span>' +
      '<label class="rfy">年度 <select id="rfy">' + years.map(function (fy) { return '<option value="' + fy + '"' + (fy === R.fy ? ' selected' : '') + '>' + fy + '</option>'; }).join('') + '</select></label>' +
      (R.scope !== 'school' ? '<button class="btn" id="acadB" title="クラス分けテストの点数・学力の順位（「賢い」と学力の段を決める）">学力…</button>' : '') +
      '<button class="btn" data-scope="' + (R.scope === 'school' ? 'cls' : 'school') + '" aria-pressed="' + (R.scope === 'school') + '">全校の事案</button>' +
      (canEdit ? '<button class="btn rlock" id="rlock" aria-pressed="' + LOCK + '" title="' + (LOCK ? 'ロック中：押すと名簿を編集できる' : '編集できる：押すとロックする（誤って触っても変わらない）') + '">' + (LOCK ? '🔒 ロック中' : '🔓 編集中') + '</button>' : '') +
      (edit && R.scope !== 'school' ? '<button class="btn" id="moveB" title="児童を足す（転入など）・名簿から外す（転出・誤登録）・特別支援学級の児童の交流級を振り分ける">児童登録/削除…</button>' : '') +
      (edit && R.scope !== 'school' ? '<button class="btn primary" id="paste" title="既存の名簿（Excel・スプレッドシート）の範囲をコピーして貼り、児童を登録・更新する">名簿を貼る…</button>' : '') +
      '<button class="btn" id="rhelp" title="名簿の使い方">?</button>';
    h += '</div><div class="layout">' + (R.scope === 'school' ? schoolTable() : R.scope === 'cls' && R.cls === -1 ? '<div class="nonewrap">' + table(Y, edit) + noneExtra(Y) + '</div>' : table(Y, edit)) + '</div>';
    h += '<div class="legend">' + C.ATTRS.map(function (at) { return '<span class="c">' + App.mark(at, 1) + at.label + '</span>'; }).join('') +
      '<span>＋＝負担が明確に増える（アイコンにカーソルで説明）　点線の数字＝その年度の事案の件数</span></div>';
    App.$('main').innerHTML = h;
    App.fitNames(App.$('main'));
    kidPop();
  }

  // クラスなしの下：転出済みの児童（この学年に当たる）と、転入予定の児童（クラス分けの「転入生」）
  var LEFT = {};
  function noneExtra(Y) {
    var d = D(), esc = App.esc, key = R.fy + ':' + Y.grade, edit = R.fy === editableFy() && !LOCK;
    if (!LEFT[key]) {
      LEFT[key] = 'loading';
      App.pf().leftKids(R.fy, Y.grade).then(function (l) { LEFT[key] = l; if (App.st.screen === 'roster' && R.cls === -1) render(); }, function () { LEFT[key] = []; });
    }
    var lf = Array.isArray(LEFT[key]) ? LEFT[key] : null, tr = d.transfers || [];
    return '<div class="nonebox"><h3>転出済みの児童</h3>' + (lf === null ? '<div class="note">読み込んでいます…</div>' : lf.length ? '<ul>' + lf.map(function (x) { return '<li>' + esc(x.name) + '<span class="note">（' + x.leftFy + '年度 ' + esc(C.gradeLabel(x.leftGrade)) + (x.cls + 1) + '組で転出）</span></li>'; }).join('') + '</ul>' + (edit ? '<button class="btn" id="noneLeft">名簿に戻す…</button>' : '') : '<div class="note">いません</div>') +
      '<h3>転入予定の児童</h3>' + (tr.length ? '<ul>' + tr.map(function (x) { return '<li>' + esc(x.name) + '</li>'; }).join('') + '</ul><div class="note">クラス分けの「転入生」で登録した児童です（決定で来年度の名簿に入ります）。</div>' : '<div class="note">いません（クラス分けの「転入生」で登録します）</div>') + '</div>';
  }

  // ア・身・通：有無と内容（例：卵・エピペン）を書く。内容はアイコンにカーソルを合わせると出る
  function noteDialog(Y, r, at, cell) {
    var s = D().kids[r.id], fy = R.fy, grade = Y.grade;
    var put = function (v, text) {
      r.a[at.k] = v;
      if (v && text) r.a[at.k + '_t'] = text; else delete r.a[at.k + '_t'];
      App.closeDlg();
      cell.innerHTML = v ? App.mark(at, v, r.a[at.k + '_t']) : '';
      if (R.kid === r.id) render();
      App.save(function () { return App.pf().setAttr(fy, grade, r.id, at.k, v, v ? text : ''); });
    };
    App.openDlg({
      focus: 'ntx',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="' + App.esc(at.label) + '" style="max-width:480px">' +
          '<h2>' + App.mark(at, 1) + ' ' + App.esc(s.name) + 'の' + App.esc(at.label) + '</h2>' +
          '<textarea id="ntx" rows="3" maxlength="200" placeholder="内容（例：' + (at.k === 'k5' ? '卵・ピーナッツ。エピペンあり' : at.k === 'k6' ? '右耳が聞こえにくい。前の席' : '週1回 ことばの教室') + '）">' + App.esc(r.a[at.k + '_t'] || '') + '</textarea>' +
          '<div class="note">カーソルを合わせると、この内容が出ます。</div>' +
          '<div class="acts">' + ((r.a[at.k] | 0) ? '<button class="btn" data-act="none" style="margin-right:auto">なしにする</button>' : '') +
          '<button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">ありで保存<kbd>Ctrl+Enter</kbd></button></div></div></div>';
      },
      click: function (t) { if (t.closest('[data-act="none"]')) { put(0, ''); return true; } return false; },
      onOk: function () { put(1, App.$('ntx').value.trim()); }
    });
  }

  // 押すと並べ替える見出し
  // 学内（1〜6年）に弟・妹がいるか（家庭数を数える：いない児童＝その家庭のいちばん下の子として1家庭）。同じ学年は続柄が弟・妹の時
  function hasYoungerInSchool(r, grade) {
    return (r.a && r.a.sib || []).some(function (s) { return s.g >= 1 && s.g <= 6 && (s.g < grade || (s.g === grade && (s.r === '弟' || s.r === '妹'))); });
  }
  function sth(k, cls, label, title, style) {
    var i = SORT.map(function (x) { return x.k; }).indexOf(k), on = i >= 0;
    return '<th class="' + cls + ' sorth' + (on ? ' on' : '') + '" data-csort="' + k + '"' + (style ? ' style="' + style + '"' : '') + ' title="' + (title ? title + '：' : '') + '押した順に並べる優先になる（もう一度で逆、3回目で外す）">' + label +
      (on ? '<span class="sa"><b>' + (i + 1) + '</b>' + (SORT[i].dir > 0 ? '▲' : '▼') + '</span>' : '') + '</th>';
  }
  function table(Y, edit) {
    var d = D(), esc = App.esc, showPairs = R.fy === d.fy, pe = pairEdit();
    var rows = Y.rows.filter(function (r) { return R.scope === 'grade' || r.cls === R.cls; }).map(function (r) {
      return { r: r, n: incsOf(r.id, R.fy).length };
    });
    rows.forEach(function (x) { var s = d.kids[x.r.id]; x.id = x.r.id; x.kana = s.kana; x.male = s.male; x.cls = x.r.cls; x.no = x.r.no; x.a = x.r.a; });
    // 見出しを押した順の優先で並べる。最後は 組→番号→よみ
    var val = function (x, k) {
      return k === 'cls' ? x.cls : k === 'no' ? x.no : k === 'sex' ? (x.male ? 0 : 1) : k === 'ji' ? x.n : k === 'pr' ? pairsOf(x.id).length : k === 'memo' ? (x.a.memo ? 1 : 0) : k === 'sp' ? (x.a.sp ? 1 : 0) : x.a[k] | 0;
    };
    var keys = SORT.concat([{ k: 'cls', dir: 1 }, { k: 'no', dir: 1 }, { k: 'kana', dir: 1 }]);
    rows.sort(function (a, b) {
      for (var q = 0; q < keys.length; q++) {
        var k = keys[q].k, d0 = k === 'kana' ? String(a.kana).localeCompare(String(b.kana), 'ja') : val(a, k) - val(b, k);
        if (d0) return d0 * keys[q].dir;
      }
      return a.id < b.id ? -1 : 1;
    });
    // 見出しの集計：表示中の児童の男女の数と、家庭数（学内に弟・妹がいない児童の数）
    var nM = 0, nF = 0, nFam = 0;
    rows.forEach(function (x) { var s0 = d.kids[x.r.id] || {}; if (s0.male) nM++; else nF++; if (!hasYoungerInSchool(x.r, Y.grade)) nFam++; });
    var h = '<div class="tw"><table class="r ' + (edit ? '' : 'ro') + '"><thead><tr>' + (R.scope === 'grade' ? sth('cls', '', '組') : '') + sth('no', '', '番号') + sth('kana', '', '名前', 'よみの順', 'text-align:left') + sth('sex', 'sxc', '性別<br><small class="hcnt">男' + nM + '女' + nF + '</small>') + sth('sp', 'spc', '特支', '特別支援学級') +
      C.ATTRS.map(function (at) { return sth(at.k, 'an', App.esc(at.label)); }).join('') + sth('ji', 'jh', '事案数<br><small>(被害)</small>') + (showPairs ? sth('pr', 'pr', 'つける<br>離す') : '') + sth('memo', 'memo', '備考<small class="hfam" title="学内（1〜6年）に弟・妹がいない児童の数">家庭数 ' + nFam + '</small>') + '</tr></thead><tbody>';
    rows.forEach(function (x) {
      var r = x.r, s = d.kids[r.id];
      h += '<tr class="' + (r.id === R.kid ? 'on' : '') + '">' + (R.scope === 'grade' ? '<td><span class="band" style="background:' + App.classColor(r.cls).c + '"></span>' + (r.cls < 0 ? 'なし' : r.cls + 1) + '</td>' : '') +
        '<td>' + r.no + '</td><td class="nm" data-kid="' + r.id + '">' + App.nameBox(s.name, s.kana) + (edit ? '<button type="button" class="kedit" data-kedit="' + r.id + '" title="名前・よみ・組・番号を直す" aria-label="名前・よみ・組・番号を直す">✎</button>' : '') + '</td><td class="sxc"><span class="sx ' + (s.male ? 'm' : 'f') + '">' + (s.male ? '男' : '女') + '</span></td>' +
        '<td class="cell spc" data-cell="' + r.id + '" data-k="sp" title="特別支援学級">' + (r.a.sp ? '<span class="spb">支</span>' : '') + '</td>' +
        C.ATTRS.map(function (at) { var v = r.a[at.k] | 0; return '<td class="cell' + (edit ? ' cc' : '') + (at.k === 'k7' && r.a.k7s ? ' auto' : '') + '" data-cell="' + r.id + '" data-k="' + at.k + '">' + (v ? App.mark(at, v, r.a[at.k + '_t']) : '') + '</td>'; }).join('') +
        '<td class="ji cc" data-kid="' + r.id + '">' + App.incBox(x.n, incsOf(r.id, R.fy).filter(function (y) { return App.isVictim(y, r.id); }).length, 'この年度の事案' + x.n + '件（かっこは被害の件数）', true) + '</td>' +
        (showPairs ? '<td class="pr' + (pe || pairsOf(r.id).length ? ' cc' : '') + '"' + (pe || pairsOf(r.id).length ? ' data-rpair="' + r.id + '"' : '') + '>' + pairMarks(r.id) + '</td>' : '') +
        '<td class="memo' + (edit ? ' cc' : '') + '"' + (edit ? ' data-memo="' + r.id + '"' : '') + (r.a.memo || r.a.sib ? ' title="' + esc((r.a.memo || '') + (r.a.sib ? '　兄弟：' + C.sibText(r.a.sib) : '')) + '"' : '') + '><div>' + esc(r.a.memo || '') + (r.a.sib ? ' <small class="msib">兄弟：' + esc(C.sibText(r.a.sib)) + '</small>' : '') + '</div></td></tr>';
    });
    if (!rows.length) h += '<tr><td colspan="16" class="empty">該当する児童はいません</td></tr>';
    return h + '</tbody></table></div>';
  }

  // その児童の「離す」（上の段）「つける」（下の段）の相手：苗字を・区切りで3人まで、4人目からは＋に畳む。
  // 名前にカーソルで児童カード、枠を押すと窓（相手の一覧・経緯・追加と削除）
  var PAIR_MAX = 3;
  function partners(id) {
    var out = { far: [], near: [], fix: [] };
    pairsOf(id).forEach(function (p) { if (p.t === 'fix') out.fix.push(p.k); else out[p.t].push(p.a === id ? p.b : p.a); });
    return out;
  }
  function pairMarks(id) {
    var d = D(), P = partners(id), esc = App.esc;
    var row = function (k, lab, cls) {
      var list = P[k], vis = list.slice(0, PAIR_MAX);
      return '<div class="pl"><b class="' + cls + '">' + lab + '</b>' + vis.map(function (o) { return '<span class="pk" data-kc="' + esc(o) + '">' + esc(App.surname(d.kids[o] ? d.kids[o].name : o)) + '</span>'; }).join('・') +
        (list.length > PAIR_MAX ? '<span class="pmore">＋' + (list.length - PAIR_MAX) + '</span>' : '') + '</div>';
    };
    if (!P.far.length && !P.near.length && !P.fix.length) return '';
    return '<div class="prm">' + (P.far.length ? row('far', '離', 'pf') : '<div class="pl"></div>') + (P.near.length ? row('near', 'つ', 'pn') : '') +
      (P.fix.length ? '<div class="pl"><b class="px">固</b>' + C.newClass(P.fix[0]) + '</div>' : '') + '</div>';
  }

  // その児童の、つける・離すの窓：相手をカードで並べ、カードを押すと経緯・理由・事案・何年生からを出す。追加と削除もここで
  function kidPairsDialog(id) {
    var d = D(), esc = App.esc, edit = pairEdit(), open = null, F = null;
    var Y = yearOf(d.fy), kids = Y.rows.map(function (r) { return r.id; }).concat((d.transfers || []).map(function (t) { return t.id; }));
    var list = d.pairs.map(function (p) { return JSON.parse(JSON.stringify(p)); });
    var mine = function () { return list.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return x.p.t !== 'fix' && (x.p.a === id || x.p.b === id); }); };
    var other = function (p) { return p.a === id ? p.b : p.a; };
    var incsFor = function (ids) { return d.incidents.filter(function (x) { return ids.some(function (k) { return x.ids.indexOf(k) >= 0; }); }).sort(function (a, b) { return b.date < a.date ? -1 : 1; }); };
    var incLink = function (x) { return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title || '（名前なし）') + ' ↗</a><span class="note">' + App.span(x) + '</span>'; };
    var since = function (p) { var g0 = +p.since || d.grade; return g0 < d.grade ? g0 + '年生の時から継続' : g0 + '年生から'; };
    var save = function () { var grade = d.grade, data = list; App.save(function () { return App.pf().savePairs(grade, data); }).then(function () { d.pairs = JSON.parse(JSON.stringify(data)); render(); App.refreshDlg(); }); };
    var detail = function (x) {
      var p = x.p, incs = d.incidents.filter(function (y) { return (p.incs || []).indexOf(y.id) >= 0; });
      return '<div class="pdet"><div><b>' + since(p) + '</b>' + ((p.tags || []).length ? '　' + p.tags.map(function (t) { return '<span class="ptag on">' + esc(t) + '</span>'; }).join('') : '') + '</div>' +
        '<div class="pmemo">' + (p.memo ? esc(p.memo) : '<span class="note">経緯は書かれていません</span>') + '</div>' +
        (incs.length ? '<div class="pinc"><b>添えた事案</b>' + incs.map(function (y) { return '<div>' + incLink(y) + '</div>'; }).join('') + '</div>' : '') +
        (edit ? '<div class="row"><button type="button" class="btn" data-pedit="' + x.i + '">直す</button><button type="button" class="btn danger" data-pdel2="' + x.i + '">この組を消す</button></div>' : '') + '</div>';
    };
    // 相手の候補：入力欄は描き直さず、候補の欄だけを描き直す（入力欄を作り直すと日本語入力の変換が切れるため）
    var suggHtml = function () {
      var hit = F.q ? kids.filter(function (k) { var s = d.kids[k]; return k !== id && s && (s.name.indexOf(F.q) >= 0 || s.kana.indexOf(F.q) >= 0); }).slice(0, 8) : [];
      return hit.map(function (k) { return '<button type="button" data-pfb="' + esc(k) + '">' + esc(d.kids[k].name) + '</button>'; }).join('');
    };
    var form = function () {
      var rel = incsFor(F.b ? [id, F.b] : [id]);
      return '<div class="pform"><h3>' + (F.i != null ? '直す' : F.t === 'far' ? '離す相手を足す' : 'つける相手を足す') + '</h3>' +
        (F.b ? '<div class="row"><span class="picked"><span>' + esc(d.kids[F.b].name) + (F.i == null ? '<button type="button" data-pfb="" aria-label="外す">×</button>' : '') + '</span></span></div>' :
          '<input id="pq" placeholder="名前・よみで探す" autocomplete="off" value="' + esc(F.q || '') + '"><div class="sugg" id="psugg">' + suggHtml() + '</div>') +
        '<label>経緯<textarea id="pmemo2" rows="3" maxlength="1000" placeholder="なぜ離す（つける）のか、これまでの経緯">' + esc(F.memo) + '</textarea></label>' +
        '<div class="ptags">' + C.PAIR_TAGS.map(function (t) { return '<button type="button" class="ptag' + (F.tags.indexOf(t) >= 0 ? ' on' : '') + '" data-ptag="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>' +
        '<label class="chk"><input type="checkbox" id="pincs"' + (F.showInc ? ' checked' : '') + '>関わる事案を見て添える（' + rel.length + '件）</label>' +
        (F.showInc ? '<div class="pinclist">' + (rel.map(function (y) { return '<label class="chk"><input type="checkbox" data-pinc="' + y.id + '"' + (F.incs.indexOf(y.id) >= 0 ? ' checked' : '') + '>' + incLink(y) + '</label>'; }).join('') || '<div class="note">事案はありません</div>') + '</div>' : '') +
        '<div class="row"><button type="button" class="btn" data-pcancel="1">やめる</button><button type="button" class="btn primary" data-psave="1"' + (F.b ? '' : ' disabled') + '>' + (F.i != null ? '直す' : '足す') + '</button></div></div>';
    };
    App.openDlg({
      noEnter: true,
      html: function () {
        var M = mine();
        var sec = function (t, lab, cls) {
          var xs = M.filter(function (x) { return x.p.t === t; });
          return '<div><h3><b class="' + cls + '">' + lab + '</b>（' + xs.length + '人）' + (edit && !F ? '<button type="button" class="btn" data-padd="' + t + '">＋ ' + lab + '相手を足す</button>' : '') + '</h3>' +
            '<div class="kcards">' + xs.map(function (x) { return '<button type="button" class="kbtn' + (open === x.i ? ' on' : '') + '" data-popen="' + x.i + '">' + App.kidCard(other(x.p)) + '<span class="ksince">' + since(x.p) + '</span></button>'; }).join('') + '</div>' +
            xs.filter(function (x) { return x.i === open; }).map(detail).join('') + '</div>';
        };
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="つける・離す" style="max-width:760px"><h2>' + esc(d.kids[id].name) + ' の、つける・離す</h2>' +
          '<div class="prd">' + sec('far', '離す', 'pf') + sec('near', 'つける', 'pn') + (F ? form() : '') + '</div>' +
          (edit ? '' : '<div class="note">つける・離すは、今年度・決定前だけ直せます。</div>') +
          '<div class="acts"><button class="btn" data-act="close">閉じる<kbd>Esc</kbd></button></div></div></div>';
      },
      input: function (t) {
        if (!F) return;
        if (t.id === 'pq') { F.q = t.value.trim(); App.$('psugg').innerHTML = suggHtml(); }
        else if (t.id === 'pmemo2') F.memo = t.value;
        else if (t.id === 'pincs') { F.showInc = t.checked; App.refreshDlg(); }
        else if (t.dataset.pinc) { var n = +t.dataset.pinc, k = F.incs.indexOf(n); if (t.checked && k < 0) F.incs.push(n); if (!t.checked && k >= 0) F.incs.splice(k, 1); }
      },
      click: function (t) {
        var x;
        if ((x = t.closest('[data-popen]'))) { var i = +x.dataset.popen; open = open === i ? null : i; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-padd]'))) { F = { t: x.dataset.padd, b: null, q: '', memo: '', tags: [], incs: [], showInc: false }; open = null; App.refreshDlg(); var q = App.$('pq'); if (q) q.focus(); return true; }
        if ((x = t.closest('[data-pedit]'))) { var p = list[+x.dataset.pedit]; F = { i: +x.dataset.pedit, t: p.t, b: other(p), memo: p.memo || '', tags: (p.tags || []).slice(), incs: (p.incs || []).slice(), showInc: !!(p.incs || []).length }; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-pdel2]'))) { list.splice(+x.dataset.pdel2, 1); open = null; save(); return true; }
        if ((x = t.closest('[data-pfb]'))) { F.b = x.dataset.pfb || null; F.q = ''; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-ptag]'))) { var tg = x.dataset.ptag, j = F.tags.indexOf(tg); if (j >= 0) F.tags.splice(j, 1); else F.tags.push(tg); App.refreshDlg(); return true; }
        if (t.closest('[data-pcancel]')) { F = null; App.refreshDlg(); return true; }
        if (t.closest('[data-psave]') && F && F.b) {
          var memo = (App.$('pmemo2') || {}).value; if (memo != null) F.memo = memo;
          if (F.i != null) Object.assign(list[F.i], { memo: F.memo.trim(), tags: F.tags, incs: F.incs });
          else {
            if (list.some(function (p) { return p.t !== 'fix' && ((p.a === id && p.b === F.b) || (p.a === F.b && p.b === id)); })) { App.toast('この2人の組はもうあります'); return true; }
            list.push({ t: F.t, a: id, b: F.b, memo: F.memo.trim(), tags: F.tags, incs: F.incs, since: d.grade });
          }
          F = null; save(); return true;
        }
        return false;
      }
    });
  }

  function schoolTable() {
    if (!R.school) {
      App.pf().schoolIncidents().then(function (rows) { R.school = rows; if (App.st.screen === 'roster' && R.scope === 'school') render(); });
      return '<div class="tw"><div class="empty">読み込んでいます…</div></div>';
    }
    var esc = App.esc, rows = R.school.slice().sort(function (a, b) { return b.count - a.count || a.grade - b.grade || a.cls - b.cls || a.no - b.no; });
    return '<div class="tw"><table class="r ro"><thead><tr><th>学年</th><th>組</th><th>番号</th><th style="text-align:left">名前</th><th>件数</th><th>最新</th></tr></thead><tbody>' +
      rows.map(function (x) {
        return '<tr><td>' + x.grade + '</td><td><span class="band" style="background:' + App.classColor(x.cls).c + '"></span>' + (x.cls + 1) + '</td><td>' + x.no + '</td>' +
          '<td class="nm" data-jump="' + x.grade + ':' + x.id + '"><span class="sx">' + (x.male ? '男' : '女') + '</span>' + esc(x.name) + '</td><td><span class="jn">' + x.count + '</span></td><td>' + x.last + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  // 児童の窓：経年の記録と事案。名前を押すと開き、閉じると選択も外す
  function kidPop() {
    var d = D();
    if (!R.kid || !d.kids[R.kid]) { if (App.dlg && App.dlg.kid) App.closeDlg(); return; }
    if (App.dlg && App.dlg.kid) { App.refreshDlg(); return; }
    if (App.dlg) return; // ほかの枠が開いている間は出さない
    App.openDlg({
      kid: true,
      html: function () { return '<div class="pop" data-close="1">' + pane() + '</div>'; },
      click: function (t) { return t.closest('.kidpop') ? App.screens.roster.click(t) : false; },
      input: function (t) { App.screens.roster.input(t); },
      onClose: function () { R.kid = null; R.form = null; render(); }
    });
  }

  function pane() { return recordHtml(R.kid, R.fy, true); }

  // 児童の記録（経年の記録と事案）。名簿の窓と、クラス分けのカードの事案の数から開く窓で使う
  function recordHtml(kid, curFy, canAdd) {
    var d = D(), esc = App.esc;
    var s = d.kids[kid];
    var h = '<aside class="dlg pane kidpop" role="dialog" aria-modal="true" aria-label="' + esc(s.name) + 'の記録"><button class="btn kx" data-act="close" aria-label="閉じる">閉じる<kbd>Esc</kbd></button><h2>' + esc(s.name) + ' <span class="id">' + s.id + '・' + (s.male ? '男' : '女') + '</span></h2>' +
      '<section><h3>経年の記録</h3><table class="h"><thead><tr><th>年度</th><th>学年-組-番</th>' +
      C.ATTRS.map(function (at) { return '<th>' + App.mark(at, 1) + '</th>'; }).join('') + '<th>事案<br><small>(被害)</small></th><th class="hm">備考</th></tr></thead><tbody>';
    d.years.slice().sort(function (a, b) { return a.fy - b.fy; }).forEach(function (y) {
      var r = y.rows.filter(function (x) { return x.id === kid; })[0];
      if (!r) return;
      var yl = incsOf(kid, y.fy), n = yl.length, nv = yl.filter(function (x) { return App.isVictim(x, kid); }).length;
      h += '<tr class="' + (y.fy === curFy ? 'cur' : '') + '"><td>' + String(y.fy).slice(2) + (y.fy > d.fy ? '準' : '') + '</td><td class="gcn"><span class="band" style="background:' + App.classColor(r.cls).c + '"></span>' + '<span class="g">' + y.grade + '</span><span class="sep">-</span><span class="g">' + (r.cls + 1) + '</span><span class="sep">-</span><span class="no">' + r.no + '</span></td>' +
        C.ATTRS.map(function (at) { return '<td>' + ((r.a[at.k] | 0) || '') + '</td>'; }).join('') + '<td>' + (n ? n + '<small>(' + nv + ')</small>' : '') + '</td><td class="hm">' + esc(r.a.memo || '') + '</td></tr>';
    });
    h += '</tbody></table><div class="note">項目の数字は程度（空欄＝なし）。事案の（ ）は被害の件数（関係図で被害・相互の側）。「準」は決定後の準備中の年度。</div></section>';
    var list = incsOf(kid).sort(function (a, b) { return b.date < a.date ? -1 : 1; });
    h += '<section><h3>事案（全' + list.length + '件）' + (canAdd && !R.form ? '<button class="btn primary" id="addInc" title="事案管理の画面で、この児童の事案を作る">＋事案管理で登録</button>' : '') + '</h3>';
    h += '<div class="inc">' + (list.map(function (x) {
      var others = x.ids.filter(function (id) { return id !== kid; }).map(function (id) { return d.kids[id] ? d.kids[id].name : id; });
      var y = d.years.filter(function (yy) { return yy.fy === C.fiscalYearOfIso(x.date); })[0];
      var role = x.roles && x.roles[kid];
      return '<div class="it">' + (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title || '（名前なし）') + ' ↗</a>' : '<b>' + esc(x.title || x.type + 'の事案') + '</b>') + '<span class="meta">' + App.span(x) + '・' + esc(x.type) +
        (y ? '・' + y.grade + '年の時' : '') + (role ? '・<em class="r-' + role + '">' + E.ROLE_NAMES[role] + '</em>' : '') + (others.length ? '・関係：' + others.map(esc).join('、') : '') + '</span>' + (x.detail ? '<div class="dt">' + esc(x.detail) + '</div>' : '') +
        (canAdd && !R.form ? '<button type="button" class="btn ie" data-editinc="' + x.id + '">事案管理で開く</button>' : '') + '</div>';
    }).join('') || '<div class="note">事案はありません</div>') + '</div></section></aside>';
    return h;
  }
  // クラス分けの画面から：見るだけの窓
  App.showRecord = function (kid) {
    if (!D().kids[kid]) return;
    App.openDlg({ html: function () { return '<div class="pop" data-close="1">' + recordHtml(kid, D().fy, false) + '</div>'; } });
  };

  // ===== 名簿を貼る =====
  // 既存の名簿の範囲をコピーして貼る。見出しで列を読み、読めた結果と誤りをその場で見せてから取り込む
  function pasteDialog() {
    var d = D(), fy = editableFy(), grade = fy === d.fy ? d.grade : d.grade + 1, esc = App.esc;
    var P = { text: '', cls: R.scope === 'cls' ? R.cls : 0, res: null, sa: {} }; // sa：特別支援学級の児童の交流級（児童ID か名前 → 組）
    var spKey = function (x) { return x.id || x.name; };
    // 特別支援学級の児童に交流級を当てる：選んだ組、まだなら組を順に回して仮に当てる（画面で直せる）
    var applySp = function (r) {
      var nc = 1; r.rows.forEach(function (x) { if (x.cls + 1 > nc) nc = x.cls + 1; });
      P.nc = Math.max(nc, 1);
      var rr = 0;
      r.rows.forEach(function (x) { if (!x.sp) return; var k = spKey(x); if (!(P.sa[k] >= -1 && P.sa[k] < 9)) P.sa[k] = -1; }); // 初めはクラスなし（あとで名簿の「児童登録/削除」で振り分けてもよい）
    };
    var summary = function () {
      var r = P.res = g.Paste.parseRoster(P.text, P.cls, { tempId: grade === 0, grade: grade });
      if (!P.text.trim()) return '<div class="note">貼ると、読み取った結果がここに出ます。校務システムの名簿は、全校分・全部の列のままで貼れます（この学年の行と、名前・よみ・性別・組・番号・生年月日・住所・兄弟などを読み、電話・緊急下校先などは読みません）。</div>';
      applySp(r);
      var hasCls = r.roles.indexOf('cls') >= 0, used = r.roles.filter(Boolean), unused = r.roles.length - used.length;
      // 名前・よみの部品（姓・名・正式名前など）は「名前」「よみ」にまとめて見せる
      var GROUP = { id2: 'id', pref: 'addr', city: 'addr', town: 'addr', apt: 'addr', sei: 'name', mei: 'name', fname: 'name', fsei: 'name', fmei: 'name', seiK: 'kana', meiK: 'kana', fkana: 'kana', fseiK: 'kana', fmeiK: 'kana' }, shown = [];
      ['id', 'grade', 'cls', 'no', 'name', 'kana', 'sex', 'birth', 'addr', 'sib'].forEach(function (k) { if (used.some(function (x) { return (GROUP[x] || x) === k; })) shown.push(g.Paste.LABEL[k]); });
      var h = '<div class="rbar"><span class="lab">読み取った列</span>' + shown.map(function (x) { return '<span class="tab" style="cursor:default">' + x + '</span>'; }).join('') + (unused ? '<span class="note">ほかの' + unused + '列は読みません</span>' : '') + '</div>';
      if (r.skipped.grade || r.skipped.blank) h += '<div class="note">読み飛ばした行：' + [r.skipped.grade ? 'ほかの学年 ' + r.skipped.grade + '行' : '', r.skipped.blank ? '名前の無い行 ' + r.skipped.blank + '行' : ''].filter(Boolean).join('・') + '</div>';
      if (!hasCls) h += '<div class="rbar"><span class="lab">組の列が無いので、この組に入れる</span>' + [0, 1, 2, 3].map(function (k) {
        return '<button class="tab" data-pcls="' + k + '" aria-selected="' + (P.cls === k) + '"><span class="band" style="background:' + App.classColor(k).c + '"></span>' + (k + 1) + '組</button>';
      }).join('') + '</div>';
      h += '<div><b>' + r.rows.length + '人</b>（男' + r.counts.m + '・女' + r.counts.f + '）を ' + fy + '年度 ' + C.gradeLabel(grade) + ' に取り込みます。' + (grade === 0 ? '児童IDの無い児童には仮の番号を振ります。' : '') + '同じ児童IDの児童は上書きし、入力済みの配慮項目は消しません。</div>';
      if (r.errors.length) h += '<div class="warnbox">✕ ' + r.errors.length + '件 取り込めない行があります<ul style="margin:4px 0 0;font-weight:400;color:var(--ink)">' +
        r.errors.slice(0, 6).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + (r.errors.length > 6 ? '<li>ほか' + (r.errors.length - 6) + '件</li>' : '') + '</ul></div>';
      // 特別支援学級の児童：通常の学級とは別に並べ、交流級を選ぶ（取り込むと、その組の名簿に「特別支援学級」の印つきで入る）
      var sps = r.rows.filter(function (x) { return x.sp; });
      if (sps.length) h += '<div class="spbox"><b>特別支援学級の児童 ' + sps.length + '人</b>：交流級を選んでください（決まっていなければ「クラスなし」のまま取り込み、あとで振り分けられます）<table class="r ro"><tbody>' +
        sps.map(function (x) {
          var k = spKey(x);
          return '<tr><td style="text-align:left">' + esc(x.name) + '</td><td>' + esc(x.sp) + '</td><td style="text-align:left"><div class="lvs">' + Array.from({ length: Math.max(P.nc, 1) }, function (_, c) {
            return '<button class="lv" data-spa="' + esc(k) + ':' + c + '" aria-pressed="' + (P.sa[k] === c) + '">' + (c + 1) + '組</button>';
          }).join('') + '<button class="lv" data-spa="' + esc(k) + ':-1" aria-pressed="' + (P.sa[k] === -1) + '">クラスなし</button></div></td></tr>';
        }).join('') + '</tbody></table></div>';
      if (r.rows.length) h += '<div class="tw" style="max-height:180px"><table class="r ro"><thead><tr><th>組</th><th>番号</th><th>児童ID</th><th style="text-align:left">名前</th><th>よみ</th><th>性別</th></tr></thead><tbody>' +
        r.rows.slice(0, 5).map(function (x) { return '<tr><td>' + (x.sp ? esc(x.sp) : x.cls + 1) + '</td><td>' + x.no + '</td><td>' + x.id + '</td><td style="text-align:left">' + esc(x.name) + '</td><td>' + esc(x.kana) + '</td><td>' + (x.sex || '—') + '</td></tr>'; }).join('') +
        (r.rows.length > 5 ? '<tr><td colspan="6" class="note">ほか' + (r.rows.length - 5) + '人</td></tr>' : '') + '</tbody></table></div>';
      return h;
    };
    var refresh = function () { App.$('psum').innerHTML = summary(); var b = App.$('okbtn'); b.disabled = !P.res.rows.length; b.firstChild.textContent = '取り込む（' + P.res.rows.length + '人）'; };
    App.openDlg({
      focus: 'ptxt',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="名簿を貼る"><h2>名簿を貼る</h2>' +
          '<textarea id="ptxt" rows="6" style="width:100%;box-sizing:border-box;font:inherit;padding:6px" placeholder="既存の名簿の範囲（見出しの行を含めて）をコピーして、ここに貼り付けます">' + esc(P.text) + '</textarea>' +
          '<div id="psum">' + summary() + '</div>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok" id="okbtn"' + (P.res && P.res.rows.length ? '' : ' disabled') + '>取り込む（' + (P.res ? P.res.rows.length : 0) + '人）<kbd>Ctrl+Enter</kbd></button></div></div></div>';
      },
      input: function (t) { if (t.id === 'ptxt') { P.text = t.value; refresh(); } },
      click: function (t) {
        var x = t.closest('[data-pcls]'); if (x) { P.cls = +x.dataset.pcls; refresh(); return true; }
        x = t.closest('[data-spa]'); if (x) { var q = x.dataset.spa, i = q.lastIndexOf(':'); P.sa[q.slice(0, i)] = +q.slice(i + 1); refresh(); return true; }
        return false;
      },
      onOk: function () {
        if (!P.res || !P.res.rows.length) return;
        var rows = P.res.rows.map(function (x) { if (!x.sp) return x; var y = Object.assign({}, x); var c0 = P.sa[spKey(x)]; y.cls = c0 >= -1 ? c0 : -1; return y; }); // 特別支援学級の児童は交流級の組に入れる
        App.closeDlg();
        // 書く前に差分を見せる。別の学年・年度の表の疑いがある時は、語を打って確かめる
        App.pf().importRoster(fy, grade, rows, { dry: true }).then(function (df) { importConfirm(fy, grade, rows, df); }, function (e) { App.toast(String(e && e.message || e)); });
      }
    });
  }
  // 児童の情報を直す（ロックを外した時の ✎）：名前・よみ・性別・組・番号・生年月日・住所・町名・特別支援学級。兄弟と備考は備考の窓へ
  function kidEditDialog(id) {
    var d = D(), fy = editableFy(), Y = yearOf(fy), r = Y && Y.rows.filter(function (y) { return y.id === id; })[0], s = d.kids[id], esc = App.esc;
    if (!r || !s) return;
    var nc = 1; Y.rows.forEach(function (y) { if (y.cls + 1 > nc) nc = y.cls + 1; });
    var F = { name: s.name, kana: s.kana || '', male: !!s.male, cls: r.cls, no: r.no, birth: s.birth || '', addr: s.addr || '', area: s.area || '', sp: !!(r.a && r.a.sp), spn: (r.a && r.a.spn) || '' };
    var dupOf = function () { return Y.rows.filter(function (y) { return y.id !== id && y.cls === F.cls && y.no === F.no; }).map(function (y) { return (d.kids[y.id] || {}).name; })[0]; };
    var inp = function (lab, idA, val, max, ph, w) { return '<label class="setrow">' + lab + '<input id="' + idA + '" value="' + esc(val) + '" maxlength="' + max + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + (w ? ' style="width:' + w + '"' : '') + '></label>'; };
    App.openDlg({
      focus: 'kename',
      html: function () {
        var dup = dupOf();
        return '<div class="pop" data-close="1"><div class="dlg kedlg" role="dialog" aria-modal="true" aria-label="児童の情報" style="max-width:640px"><h2>' + esc(s.name) + '（' + fy + '年度・児童ID ' + esc(id) + '）</h2>' +
          '<div class="kegrid">' + inp('名前', 'kename', F.name, 40) + inp('よみ', 'kekana', F.kana, 60) + '</div>' +
          '<div class="rbar"><span class="lab">性別</span><button class="lv" data-kesx="1" aria-pressed="' + F.male + '">男</button><button class="lv" data-kesx="0" aria-pressed="' + !F.male + '">女</button>' +
          '<span class="lab" style="margin-left:14px">組</span>' + Array.from({ length: nc }, function (_, k) { return '<button class="tab" data-kecls="' + k + '" aria-selected="' + (F.cls === k) + '"><span class="band" style="background:' + App.classColor(k).c + '"></span>' + (k + 1) + '組</button>'; }).join('') + '<button class="tab" data-kecls="-1" aria-selected="' + (F.cls < 0) + '">クラスなし</button>' +
          '<label style="margin-left:14px">出席番号 <input id="keno" type="number" min="1" max="99" value="' + F.no + '" style="width:4.5em"></label></div>' +
          (dup && F.cls >= 0 ? '<div class="warnbox" style="font-weight:400">' + (F.cls + 1) + '組の' + F.no + '番には、すでに ' + esc(dup) + ' がいます（このまま保存すると同じ番号が2人になります）</div>' : '') +
          '<div class="kegrid">' + inp('生年月日', 'kebirth', F.birth, 20, '例：2018/4/2') + inp('町名（住所の偏りに使う）', 'kearea', F.area, 40, '例：中央') + '</div>' +
          inp('住所', 'keaddr', F.addr, 200, '例：大阪府西市中央三丁目5-2') +
          '<div class="rbar"><span class="lab">特別支援学級</span><button class="lv" data-kesp="1" aria-pressed="' + F.sp + '">在籍</button><button class="lv" data-kesp="0" aria-pressed="' + !F.sp + '">なし</button>' +
          (F.sp ? '<label style="margin-left:10px">学級名 <input id="kespn" value="' + esc(F.spn) + '" maxlength="20" placeholder="例：ひまわり" style="width:9em"></label>' : '') + '</div>' +
          '<div class="rbar"><button class="btn" id="kememo">兄弟・備考を直す…</button><span class="note">' + esc(r.a && r.a.sib && r.a.sib.length ? '兄弟：' + C.sibText(r.a.sib) : '兄弟の登録なし') + '</span></div>' +
          '<p class="note">児童IDは変えられません（配慮項目・事案などの記録のつながりを保つため）。</p>' +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok">保存する</button></div></div></div>';
      },
      input: function (t) {
        var m = { kename: 'name', kekana: 'kana', kebirth: 'birth', kearea: 'area', keaddr: 'addr', kespn: 'spn' }[t.id];
        if (m) { F[m] = t.value; return; }
        if (t.id === 'keno') { F.no = Math.max(1, Math.min(99, +t.value || 1)); var w = App.$('keno'), pos = w && w.selectionStart; App.refreshDlg(); var el = App.$('keno'); if (el) el.focus(); }
      },
      click: function (t) {
        var x;
        if ((x = t.closest('[data-kecls]'))) { F.cls = +x.dataset.kecls; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-kesx]'))) { F.male = x.dataset.kesx === '1'; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-kesp]'))) { F.sp = x.dataset.kesp === '1'; App.refreshDlg(); return true; }
        if (t.closest('#kememo')) { App.closeDlg(); memoDialog(Y, r); return true; }
        return false;
      },
      onOk: function () {
        if (!F.name.trim()) { App.toast('名前を入れてください'); return; }
        var x = { name: F.name.trim(), kana: F.kana.trim(), male: F.male, cls: F.cls, no: F.no, birth: F.birth.trim(), addr: F.addr.trim(), area: F.area.trim(), sp: F.sp, spn: F.sp ? F.spn.trim() : '' };
        App.closeDlg();
        App.save(function () { return App.pf().updateKid(fy, Y.grade, id, x); }).then(function () {
          s.name = x.name; s.kana = x.kana; s.male = x.male; s.birth = x.birth; s.addr = x.addr; s.area = x.area; r.cls = x.cls; r.no = x.no;
          if (x.sp) { r.a.sp = 1; if (x.spn) r.a.spn = x.spn; else delete r.a.spn; } else { delete r.a.sp; delete r.a.spn; }
          render(); App.toast('直しました');
        });
      }
    });
  }

  // 転入・転出・削除：名簿の画面で、1人を足す・選んだ児童を外す
  function moveDialog(tab0) {
    var d = D(), fy = editableFy(), Y = yearOf(fy), grade = Y ? Y.grade : (fy === d.fy ? d.grade : d.grade + 1), esc = App.esc;
    var rows = Y ? Y.rows.slice() : [], nc = 1; rows.forEach(function (r) { if (r.cls + 1 > nc) nc = r.cls + 1; });
    var M = { tab: tab0 || 'in', scope: 'cls', cls: R.cls < nc ? R.cls : 0, pick: {}, reason: 'leave', f: { name: '', kana: '', male: true, cls: R.cls < nc ? R.cls : 0, id: '' } };
    var shown = function () { return rows.filter(function (r) { return M.scope === 'all' || r.cls === M.cls; }).sort(function (a, b) { return a.cls - b.cls || a.no - b.no; }); };
    var picked = function () { return shown().filter(function (r) { return M.pick[r.id]; }); };
    var nextNo = function (k) { var m = 0; rows.forEach(function (r) { if (r.cls === k && r.no > m) m = r.no; }); return m + 1; };
    var clsBtns = function (attr, cur) { return Array.from({ length: nc }, function (_, k) { return '<button class="tab" ' + attr + '="' + k + '" aria-selected="' + (cur === k) + '"><span class="band" style="background:' + App.classColor(k).c + '"></span>' + (k + 1) + '組</button>'; }).join(''); };
    App.openDlg({
      onClose: function () { render(); }, // 交流級を振り分けた後、名簿の表を作り直す
      html: function () {
        var h = '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="児童登録/削除" style="max-width:720px"><h2>' + fy + '年度 ' + C.gradeLabel(grade) + '：児童登録/削除</h2>' +
          '<div class="rbar"><button class="tab" data-mtab="in" aria-selected="' + (M.tab === 'in') + '">児童を足す（転入など）</button><button class="tab" data-mtab="out" aria-selected="' + (M.tab === 'out') + '">名簿から外す（転出・誤登録）</button><button class="tab" data-mtab="sp" aria-selected="' + (M.tab === 'sp') + '">特別支援学級（交流級）</button><button class="tab" data-mtab="left" aria-selected="' + (M.tab === 'left') + '">転出した児童（出戻り）</button></div>';
        if (M.tab === 'out') {
          var list = shown(), n = picked().length;
          h += '<div class="rbar"><span class="lab">表示</span>' + clsBtns('data-mcls', M.scope === 'cls' ? M.cls : -1) + '<button class="tab" data-mall="1" aria-selected="' + (M.scope === 'all') + '">学年全体</button></div>' +
            '<div class="rbar"><span class="lab">理由</span><button class="lv" data-mrs="leave" aria-pressed="' + (M.reason === 'leave') + '">転出した</button><button class="lv" data-mrs="mistake" aria-pressed="' + (M.reason === 'mistake') + '">誤って登録した</button></div>' +
            '<p class="note">' + (M.reason === 'leave' ? '転出：この年度の名簿から外し、「転出した児童（出戻り）」に残します。戻ってきたら、そこから同じ児童IDで名簿に戻せます。配慮項目・事案の記録も残ります（設定の「年度替わり」で、残す年数を過ぎたら消します）。' : '誤って登録：この年度の名簿と配慮項目から消します。') + '外す前にデータの控えを取ります。</p>' +
            '<div class="tw" style="max-height:300px"><table class="r ro"><thead><tr><th><input type="checkbox" id="mallp"' + (list.length && n === list.length ? ' checked' : '') + ' aria-label="すべて"></th><th>組</th><th>番号</th><th style="text-align:left">名前</th><th>児童ID</th></tr></thead><tbody>' +
            list.map(function (r) { var s = d.kids[r.id] || {}; return '<tr><td><input type="checkbox" data-mp="' + esc(r.id) + '"' + (M.pick[r.id] ? ' checked' : '') + '></td><td>' + (r.cls + 1) + '</td><td>' + r.no + '</td><td style="text-align:left">' + esc(s.name || '') + '</td><td>' + esc(r.id) + '</td></tr>'; }).join('') +
            '</tbody></table></div>' +
            '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn danger" id="mgo"' + (n ? '' : ' disabled') + '>選んだ' + n + '人を外す…</button></div>';
        } else if (M.tab === 'left') {
          // 転出児童：転出した時に残した児童。この学年に当たる児童（学年は年度に合わせて進める）を、同じ児童IDで名簿に戻す
          if (!M.left) {
            App.pf().leftKids(fy, grade).then(function (l) { M.left = l; App.refreshDlg(); }, function (e) { App.toast(String(e && e.message || e)); });
            h += '<div class="empty">読み込んでいます…</div>';
          } else {
            h += '<p class="note">転出として外した児童です（この学年に当たる児童）。戻ってきたら、組を押して名簿に戻します。同じ児童IDで戻るので、配慮項目・事案・兄弟などの記録はつながったままです。</p>' +
              (M.left.length ? '<table class="r ro"><thead><tr><th style="text-align:left">名前</th><th>転出した時</th><th style="text-align:left">戻す組</th></tr></thead><tbody>' + M.left.map(function (x) {
                return '<tr><td style="text-align:left">' + esc(x.name) + '</td><td>' + x.leftFy + '年度 ' + esc(C.gradeLabel(x.leftGrade)) + (x.cls + 1) + '組</td><td style="text-align:left"><div class="lvs">' +
                  Array.from({ length: Math.max(nc, 1) }, function (_, k) { return '<button class="lv" data-mrt="' + esc(x.id) + ':' + k + '">' + (k + 1) + '組に戻す</button>'; }).join('') + '</div></td></tr>';
              }).join('') + '</tbody></table>' : '<div class="empty">この学年に当たる転出児童はいません</div>');
          }
          h += '<div class="acts"><button class="btn" data-act="close">閉じる<kbd>Esc</kbd></button></div>';
        } else if (M.tab === 'sp') {
          // 特別支援学級の児童：所属する組（交流級）を振り分ける。名簿の「特支」の欄に印のある児童
          var sps = rows.filter(function (r) { return r.a && r.a.sp; }).sort(function (a, b) { return a.cls - b.cls || a.no - b.no; });
          h += '<p class="note">名簿の「特支」の欄に印のある児童です。押した組が交流級になり、その組の名簿の最後に入ります。印は名簿の「特支」の欄で付け外しできます。</p>' +
            (sps.length ? '<table class="r ro"><tbody>' + sps.map(function (r) {
              var s = d.kids[r.id] || {};
              return '<tr><td style="text-align:left">' + esc(s.name || '') + (r.a.spn ? '<small class="note">（' + esc(r.a.spn) + '）</small>' : '') + '</td><td style="text-align:left"><div class="lvs">' +
                Array.from({ length: Math.max(nc, 1) }, function (_, k) { return '<button class="lv" data-msp="' + esc(r.id) + ':' + k + '" aria-pressed="' + (r.cls === k) + '">' + (k + 1) + '組</button>'; }).join('') + '<button class="lv" data-msp="' + esc(r.id) + ':-1" aria-pressed="' + (r.cls < 0) + '">クラスなし</button></div></td></tr>';
            }).join('') + '</tbody></table>' : '<div class="empty">特別支援学級の児童はいません</div>') +
            '<div class="acts"><button class="btn" data-act="close">閉じる<kbd>Esc</kbd></button></div>';
        } else {
          var f = M.f;
          h += '<label class="setrow">名前<input id="mfn" value="' + esc(f.name) + '" maxlength="40" placeholder="例：山田 花子"></label>' +
            '<label class="setrow">よみ<input id="mfk" value="' + esc(f.kana) + '" maxlength="60" placeholder="例：やまだ はなこ"></label>' +
            '<div class="rbar"><span class="lab">性別</span><button class="lv" data-msx="1" aria-pressed="' + f.male + '">男</button><button class="lv" data-msx="0" aria-pressed="' + !f.male + '">女</button></div>' +
            '<div class="rbar"><span class="lab">組</span>' + clsBtns('data-mfc', f.cls) + '<span class="note">番号は ' + nextNo(f.cls) + ' 番（組の最後）</span></div>' +
            '<label class="setrow">児童ID（分からなければ空のまま。仮の番号を振り、あとで名簿を貼ると名前で照らして付け替えます）<input id="mfi" value="' + esc(f.id) + '" maxlength="20"></label>' +
            '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" id="min"' + (f.name.trim() ? '' : ' disabled') + '>転入を登録する</button></div>';
        }
        return h + '</div></div>';
      },
      input: function (t) {
        var f = M.f;
        if (t.id === 'mallp') { shown().forEach(function (r) { M.pick[r.id] = t.checked; }); App.refreshDlg(); return; }
        if (t.dataset.mp) { M.pick[t.dataset.mp] = t.checked; App.refreshDlg(); return; }
        if (t.id === 'mfn') { f.name = t.value; var b = App.$('min'); if (b) b.disabled = !f.name.trim(); }
        else if (t.id === 'mfk') f.kana = t.value; else if (t.id === 'mfi') f.id = t.value.trim();
      },
      click: function (t) {
        var x;
        if ((x = t.closest('[data-mtab]'))) { M.tab = x.dataset.mtab; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-mcls]'))) { M.scope = 'cls'; M.cls = +x.dataset.mcls; App.refreshDlg(); return true; }
        if (t.closest('[data-mall]')) { M.scope = 'all'; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-mrs]'))) { M.reason = x.dataset.mrs; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-msx]'))) { M.f.male = x.dataset.msx === '1'; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-mfc]'))) { M.f.cls = +x.dataset.mfc; App.refreshDlg(); return true; }
        if ((x = t.closest('[data-mrt]'))) {
          var q2 = x.dataset.mrt, j = q2.lastIndexOf(':'), rid = q2.slice(0, j), kc = +q2.slice(j + 1), who = (M.left.filter(function (y) { return y.id === rid; })[0] || {}).name || '';
          App.closeDlg();
          LEFT = {};
          App.save(function () { return App.pf().restoreKid(fy, grade, rid, kc); }).then(function () {
            return App.reload().then(function () { R.cls = kc; render(); App.toast(who + 'を' + (kc + 1) + '組に戻しました'); });
          });
          return true;
        }
        if ((x = t.closest('[data-msp]'))) {
          var q = x.dataset.msp, i = q.lastIndexOf(':'), sid = q.slice(0, i), k = +q.slice(i + 1), row0 = rows.filter(function (r) { return r.id === sid; })[0];
          if (!row0 || row0.cls === k) return true;
          App.save(function () { return App.pf().setKidClass(fy, grade, sid, k); }).then(function () {
            var mx = 0; rows.forEach(function (r) { if (r.cls === k && r.no > mx) mx = r.no; }); row0.cls = k; row0.no = mx + 1; // 画面の名簿も直す（開き直さない）
            App.refreshDlg(); App.toast(((d.kids[sid] || {}).name || '') + (k < 0 ? 'をクラスなしにしました' : 'の交流級を' + (k + 1) + '組にしました'));
          });
          return true;
        }
        if (t.closest('#mgo')) {
          var ps = picked(), word = ps.length + '人を外す', names = ps.map(function (r) { return (d.kids[r.id] || {}).name || r.id; });
          if (!ps.length) return true;
          var typed = prompt((M.reason === 'mistake' ? '誤って登録した児童として消します：' : '転出した児童として名簿から外します：') + names.slice(0, 10).join('、') + (names.length > 10 ? ' ほか' + (names.length - 10) + '人' : '') + '\n確かめるため「' + word + '」と入力してください');
          if (typed == null) return true;
          if (typed.trim() !== word) { App.toast('入力した語が違います'); return true; }
          App.closeDlg();
          LEFT = {};
          App.save(function () { return App.pf().removeKids(fy, grade, ps.map(function (r) { return r.id; }), M.reason); }).then(function (r) {
            return App.reload().then(function () { App.toast((r.backupError ? '⚠ ' + r.backupError + '。' : '') + r.n + '人を名簿から外しました'); });
          });
          return true;
        }
        if (t.closest('#min')) {
          var f = M.f; if (!f.name.trim()) return true;
          if (f.id && !C.isKidId(f.id)) { App.toast('児童IDは英数字20文字までです'); return true; }
          var row = { id: f.id, name: f.name.trim(), kana: f.kana.trim(), male: f.male, sex: f.male ? '男' : '女', cls: f.cls, no: nextNo(f.cls) };
          App.closeDlg();
          App.save(function () { return App.pf().importRoster(fy, grade, [row], { temp: true }); }).then(function () {
            return App.reload().then(function () { R.cls = f.cls; render(); App.toast(row.name + 'を' + (f.cls + 1) + '組に転入として登録しました'); });
          });
          return true;
        }
        return false;
      }
    });
  }
  function importConfirm(fy, grade, rows, df) {
    var esc = App.esc, word = df.risky ? '上書きする' : '';
    var list = function (title, a) { return a.length ? '<div><b>' + title + ' ' + a.length + '人</b><div class="note">' + esc(a.slice(0, 8).join('、')) + (a.length > 8 ? ' ほか' + (a.length - 8) + '人' : '') + '</div></div>' : ''; };
    App.openDlg({
      focus: word ? 'iword' : 'okbtn',
      html: function () {
        return '<div class="pop" data-close="1"><div class="dlg" role="dialog" aria-modal="true" aria-label="取り込む前の確認" style="max-width:640px"><h2>' + fy + '年度 ' + C.gradeLabel(grade) + ' に取り込む前の確認</h2>' +
          '<div>追加 <b>' + df.added + '人</b>・すでにいる児童 <b>' + df.existing + '人</b></div>' +
          list('仮の番号から本来の児童IDに付け替える', df.relink || []) + list('名前が変わる', df.renamed) + list('ほかの学年にいる', df.other) + list('貼った中にいない（名簿には残る）', df.missing) +
          (df.risky ? '<div class="warnbox">別の学年や年度の表を貼っていないか確かめてください（' + (df.other.length ? 'ほかの学年の児童がいます' : 'すでにいる児童の半分以上で名前が変わります') + '）。取り込む直前に、データの控えを自動で取ります。</div>' +
            '<label>このまま取り込むなら「<b>' + word + '</b>」と入力<br><input type="text" id="iword" style="width:100%;margin-top:4px" autocomplete="off"></label>' : '<p class="note">取り込む直前に、データの控えを自動で取ります。</p>') +
          '<div class="acts"><button class="btn" data-act="close">やめる<kbd>Esc</kbd></button><button class="btn primary" data-act="ok" id="okbtn">取り込む（' + rows.length + '人）</button></div></div></div>';
      },
      onOk: function () {
        if (word && App.$('iword').value.trim() !== word) { App.toast('入力した語が違います'); return; }
        App.closeDlg();
        App.save(function () { return App.pf().importRoster(fy, grade, rows); }).then(function (r) {
          return App.reload().then(function () {
            App.toast((r.backupError ? '⚠ ' + r.backupError + '。' : '') + '取り込みました：追加' + r.added + '人・更新' + r.updated + '人' + (r.relinked ? '・付け替え' + r.relinked + '人' : '') + (r.missing.length ? '。貼った中にいない児童（名簿には残っています）：' + r.missing.slice(0, 5).join('、') + (r.missing.length > 5 ? ' ほか' + (r.missing.length - 5) + '人' : '') : ''));
          });
        });
      }
    });
  }

  function refocus(id, pos) { var el = App.$(id); if (el) { el.focus(); if (pos != null && el.setSelectionRange) el.setSelectionRange(pos, pos); } }

  App.screens.roster = {
    enter: function () { reset(); render(); },
    render: render,
    selectKid: function (id) { R.kid = id; render(); },
    click: function (t, e) {
      var d = D(), x;
      if (t.closest('#rlock')) { setLock(!LOCK); render(); App.toast(LOCK ? 'ロックしました（名簿は変わりません）' : 'ロックを外しました（名簿を編集できます）'); return true; }
      if ((x = t.closest('[data-kedit]'))) { kidEditDialog(x.dataset.kedit); return true; }
      // ロック中は、表の欄を押しても値を変えない（見るだけ）
      if (LOCK && (t.closest('td.cc') || t.closest('[data-cell]'))) { App.toast('ロック中です。「🔒 ロック中」を押すと編集できます'); return true; }
      // 表の欄：右下の灰色の角を押すと設定の窓、欄の真ん中を押すと値を変える（0→1→2）
      var td = t.closest('td.cc');
      // 事案・つける離す・備考は、欄のどこを押しても同じ窓
      if (td && ((e && inCorner(td, e)) || td.matches('.ji,.pr,.memo'))) { cornerDialog(td); return true; }
      if ((x = t.closest('[data-csort]'))) {
        clickSort(x.dataset.csort); return true;
      }
      if ((x = t.closest('[data-fy]'))) { R.fy = +x.dataset.fy; render(); return true; }
      if ((x = t.closest('[data-cls]'))) { R.scope = 'cls'; R.cls = +x.dataset.cls; render(); return true; }
      if ((x = t.closest('[data-scope]'))) { R.scope = x.dataset.scope; if (R.scope === 'school') R.school = null; render(); return true; }
      if ((x = t.closest('[data-jump]'))) {
        var p = x.dataset.jump.split(':');
        App.go('roster', +p[0]).then(function () { R.kid = p[1]; R.scope = 'cls'; var r = yearOf(D().fy).rows.filter(function (y) { return y.id === p[1]; })[0]; if (r) R.cls = r.cls; render(); });
        return true;
      }
      if ((x = t.closest('[data-cell]'))) {
        if (R.fy !== editableFy()) return true;
        var Y = yearOf(R.fy), r = Y.rows.filter(function (y) { return y.id === x.dataset.cell; })[0], k = x.dataset.k;
        if (k === 'sp') { // 特別支援学級：押すたびに あり／なし
          var sv = r.a.sp ? 0 : 1, sfy = R.fy, sg = Y.grade;
          if (sv) r.a.sp = 1; else delete r.a.sp;
          x.innerHTML = sv ? '<span class="spb">支</span>' : '';
          App.save(function () { return App.pf().setAttr(sfy, sg, r.id, 'sp', sv); });
          return true;
        }
        var at = C.ATTRS.filter(function (a) { return a.k === k; })[0];
        if (k === 'k7') { r.a.k7m = r.a.k7m ? 0 : 1; App.applyScores(D()); } // 賢い：手動の印だけを切り替える（点数の印は残る）
        else r.a[k] = (r.a[k] | 0) >= at.max ? 0 : (r.a[k] | 0) + 1; // 押すたびに 無→アイコン→アイコン＋→無
        var v = k === 'k7' ? r.a.k7m : r.a[k], fy = R.fy, grade = Y.grade;
        x.innerHTML = r.a[k] ? App.mark(at, r.a[k]) : ''; x.classList.toggle('auto', !!(k === 'k7' && r.a.k7s)); // そのマスだけ書き換える（表を作り直さない）
        if (R.kid === r.id) render();
        App.save(function () { return App.pf().setAttr(fy, grade, r.id, k, v); });
        return true;
      }
      if (t.closest('td.ji')) return true; // 事案の欄は角から開く
      if ((x = t.closest('[data-kid]'))) { R.kid = x.dataset.kid; R.form = null; render(); return true; }
      if (t.closest('#paste')) { pasteDialog(); return true; }
      if (t.closest('#moveB')) { moveDialog(); return true; }
      if (t.closest('#noneLeft')) { moveDialog('left'); return true; }
      if (t.closest('#rhelp')) { helpDialog(); return true; }
      if (t.closest('#acadB')) { App.acadDialog(); return true; }
      if (t.closest('#unorder')) { SORT = []; saveSort(); render(); return true; }
      if (t.closest('[data-rpair],[data-memo]')) return true; // 文字や相手の入力は角から
      // 事案の登録・直すは事案管理の画面で行う（開いていた児童を入れておく）
      if (t.closest('#addInc')) { App.st.incFocus = { add: true, kid: R.kid }; App.go('incidents'); return true; }
      if ((x = t.closest('[data-editinc]'))) { App.st.incFocus = { sel: +x.dataset.editinc }; App.go('incidents'); return true; }
      return false;
    },
    input: function (t) {
      if (t.id === 'rfy') { R.fy = +t.value; render(); return; }
    },
    key: function (e) {
      if (e.key === 'Escape' && R.kid) { R.kid = null; R.form = null; render(); return true; }
      return false;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

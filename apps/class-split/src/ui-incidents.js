// 事案管理：学年の事案の一覧・登録と直す・様式Ⅱ用の追記・市教委への報告書（簡易報告書・様式Ⅰ・様式Ⅱ）の出力。
// 記録は「発覚・経緯・指導」の欄に、行ごとに［日付・時間帯・本文］で書く。報告書の時系列の欄は、この行から作る。
(function (g) {
  'use strict';
  var App = g.App, C = g.CONFIG, E = g.Engine, Rp = g.Report;
  // sel：選んだ事案の id。mode：'view' | 'form'（登録・直す） | 'add2'（様式Ⅱ用の追記）
  var I = { sel: null, mode: 'view', form: null, focus: null };
  // 左の一覧と右の記入補助は畳める（この端末に覚える）
  var FOLD = (function () { try { return JSON.parse(localStorage.getItem('classSplit.incFold') || '{}'); } catch (e) { return {}; } })();
  function saveFold() { try { localStorage.setItem('classSplit.incFold', JSON.stringify(FOLD)); } catch (e) { /* 覚えられなくても今は効く */ } }

  // 画面のアイコン（線の絵。色は文字の色を使う）
  var SVG = function (body) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>'; };
  var IC = {
    // 枠と左（右）の帯。矢印は畳む向き
    listClose: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M16 9l-3 3 3 3"/>'),
    listOpen: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M13 9l3 3-3 3"/>'),
    asClose: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/><path d="M8 9l3 3-3 3"/>'),
    asOpen: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/><path d="M11 9l-3 3 3 3"/>'),
    plus: SVG('<path d="M12 5v14M5 12h14"/>'),
    trash: SVG('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
    edit: SVG('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/>'),
    addNote: SVG('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M12.5 11v6M9.5 14h6"/>'),
    file: SVG('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 13h7M9 17h5"/>'),
    down2: SVG('<path d="M7 6l5 5 5-5"/><path d="M7 13l5 5 5-5"/>'),
    help: SVG('<path d="M4 6h10M4 10h7M4 14h6"/><path d="M14 20l1-4 6-6-3-3-6 6-1 4z"/>')
  };
  function D() { return App.st.data; }
  function esc(s) { return App.esc(s); }
  // 事案の種別の名前。読みにくい種別（虞犯）は漢字の上にふりがなを付ける
  function typeHtml(t) { var r = (C.TYPE_RUBY || {})[t]; return r ? '<ruby>' + esc(t) + '<rt>' + esc(r) + '</rt></ruby>' : esc(t); }
  function typesHtml(type) { return typesOf(type).map(typeHtml).join('・') || esc(type); }
  function yearOf(fy) { return D().years.filter(function (y) { return y.fy === fy; })[0]; }
  function incOf(id) { return D().incidents.filter(function (x) { return x.id === id; })[0] || (ALLINC || []).filter(function (x) { return x.id === id; })[0]; }
  function kidName(id) { if (E.isUnknown(id)) return '（不明の児童）'; var s = D().kids[id]; return s ? s.name : id; }
  function today() { var t = new Date(); return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); }
  // 種別は複数選べる（「いじめ・物損」のように「・」でつないで持つ）
  function typesOf(type) { return String(type || '').split('・').filter(Boolean); }
  function isBully(type) { return typesOf(type).indexOf('いじめ') >= 0 || /いじめ/.test(String(type || '')); }
  function onlyDamage(type) { var t = typesOf(type); return t.length === 1 && t[0] === '物損'; }
  function titleOf(x) { return x.title || (x.type + 'の事案'); }
  function refocus(id) { var el = App.$(id); if (el) { el.focus(); if (el.setSelectionRange && el.type !== 'date') { var n = el.value.length; el.setSelectionRange(n, n); } } }

  // その事案の日の学年・組（その年度の名簿から。無ければ今年度）
  function kidAt(id, iso) {
    var d = D(), s = d.kids[id]; if (!s) return null;
    var fy = C.fiscalYearOfIso(iso || today()), y = yearOf(fy) || yearOf(d.fy), r = y && y.rows.filter(function (x) { return x.id === id; })[0];
    if (!r) { y = yearOf(d.fy); r = y && y.rows.filter(function (x) { return x.id === id; })[0]; }
    // ほかの学年の児童は、全校の今年度の名簿から
    if (!r && d.xk && d.xk[id]) return { grade: d.xk[id].grade, cls: d.xk[id].cls + 1, male: s.male, name: s.name, kana: s.kana };
    return { grade: y ? y.grade : '', cls: r ? r.cls + 1 : '', male: s.male, name: s.name, kana: s.kana };
  }
  // 全校の今年度の名簿を1回だけ読み、ほかの学年の児童の名前と学年・組を足す（ほかの学年を検索する時・ほかの学年の児童が関わる事案を見る時）

  /* @include incidents/inc-data.js */
  /* @include incidents/inc-list.js */
  /* @include incidents/inc-form.js */
  /* @include incidents/inc-output.js */

  App.screens.incidents = {
    enter: function () {
      I.mode = 'view'; I.form = null; I.focus = null; I.draft = null;
      var f = App.st.incFocus; App.st.incFocus = null;
      if (f && f.edit != null && incOf(f.edit)) editForm(incOf(f.edit));
      else if (f && f.sel != null && incOf(f.sel)) I.sel = f.sel;
      else if (f && f.add) newForm(f.kid || null);
      else if (I.sel != null && !incOf(I.sel)) I.sel = null;
      mergeSchool();
      render();
      // ほかの学年の児童が関わる事案があれば、全校の名簿を読んで名前を出す
      var dd = D();
      if (!SCHOOL && dd.incidents.some(function (x) { return x.ids.some(function (id) { return !dd.kids[id]; }) || (x.diagram && x.diagram.nodes.some(function (n) { return !E.isUnknown(n.id) && !dd.kids[n.id]; })); }))
        loadSchool().then(function () { if (App.st.screen === 'incidents') render(); });
      // 書きかけがあれば知らせる（入力中でなければ）
      var grade = App.st.grade;
      App.pf().loadDraft(grade).then(function (dr) {
        if (!dr || App.st.screen !== 'incidents' || App.st.grade !== grade) return;
        I.draft = dr; if (I.mode === 'view') rerenderPane();
      }, function () { /* 読めなくても入力はできる */ });
    },
    leave: function () { if (I.form) { clearTimeout(draftT); var d = draftOf(); if (d) { var gr = App.st.grade; App.save(function () { return App.pf().saveDraft(gr, d); }, 'draft:' + gr).then(function () { I.draft = { at: new Date().toISOString(), draft: d }; }); } } },
    click: function (t) {
      var x;
      if (t.closest('#ilistT,#ilistT2')) { FOLD.list = !FOLD.list; saveFold(); render(); return true; }
      if (t.closest('#iasT,#iasT2')) { FOLD.assist = !FOLD.assist; saveFold(); renderAssist(); App.$('iassist').parentNode.classList.toggle('ac', !!FOLD.assist); return true; }
      if ((x = t.closest('[data-ph]')) && x.closest('.iassist,.irx')) { putPhrase(x.dataset.ph); return true; }
      if (t.closest('#ihome')) { I.sel = null; render(); return true; }
      if (t.closest('#iadd2nd')) { newForm(null); render(); refocus('fQ'); return true; }
      if ((x = t.closest('[data-ist],[data-ilv],[data-irep]'))) {
        var xi = incOf(I.sel), rp0 = Rp.norm(xi.report);
        if (x.dataset.ist) rp0.status = x.dataset.ist; else if (x.dataset.irep) rp0.reported = rp0.reported ? '' : today(); else rp0.level = x.dataset.ilv;
        App.save(function () { return App.pf().updateIncident(xi.id, body(xi, { rep: rp0 })); }).then(function (inc) {
          var list = D().incidents, i = list.map(function (y) { return y.id; }).indexOf(inc.id); if (i >= 0) list[i] = inc; render();
        });
        return true;
      }
      if (t.closest('#idrGo')) { restoreDraft(); render(); return true; }
      if (t.closest('#idrDel')) { dropDraft(); rerenderPane(); App.toast('書きかけを捨てました'); return true; }
      // 書きかけはサーバーに残っているので、別の事案を開いても失わない
      if (t.closest('#iadd')) { if (I.form) App.screens.incidents.leave(); newForm(null); render(); refocus('fQ'); return true; }
      if ((x = t.closest('[data-isel]'))) { if (I.form) App.screens.incidents.leave(); I.sel = +x.dataset.isel; closeForm(); render(); return true; }
      if (t.closest('#iedit')) { editForm(incOf(I.sel)); rerenderPane(); return true; }
      if (t.closest('#iadd2')) { add2Form(incOf(I.sel)); rerenderPane(); return true; }
      if ((x = t.closest('[data-iout]'))) { outDialog(incOf(I.sel), x.dataset.iout); return true; }
      if (t.closest('#cancelInc')) { dropDraft(); closeForm(); rerenderPane(); return true; }
      if ((x = t.closest('[data-mq]'))) { var nt = x.nextElementSibling, open = nt.hidden; nt.hidden = !open; x.setAttribute('aria-expanded', String(open)); return true; }
      // 日付：透明の入力欄の暦の印が枠いっぱいに広がっているので、押せばブラウザが暦を開く（GAS の枠の中では showPicker が使えないことがある）
      if ((x = t.closest('.idate'))) { var di = x.querySelector('input'); if (t !== di && di && di.showPicker) { try { di.showPicker(); } catch (e) { di.focus(); } } return false; }
      if ((x = t.closest('[data-ty]'))) { snap();
        var ts = typesOf(I.form.type), ty = x.dataset.ty, k = ts.indexOf(ty);
        if (k >= 0) ts.splice(k, 1); else ts.push(ty);
        I.form.type = C.INCIDENT_TYPES.filter(function (t0) { return ts.indexOf(t0) >= 0; }).join('・');
        rerenderPane(); saveDraftSoon(); return true;
      }
      if ((x = t.closest('[data-kdel]'))) { snap(); I.form.dg.d.nodes = I.form.dg.d.nodes.filter(function (n) { return n.id !== x.dataset.kdel; }); rerenderPane(); saveDraftSoon(); return true; }
      if (t.closest('#fQset')) { srchDialog(); return true; }
      if (t.closest('#ihset')) { homeDialog(); return true; }
      if (t.closest('#fUnk')) { snap();
        var n = 1; while (I.form.dg.d.nodes.some(function (nd) { return nd.id === '?' + n; })) n++;
        App.Diagram.add(I.form.dg, '?' + n); mountDg(); saveDraftSoon(); return true;
      }
      if ((x = t.closest('[data-pick]'))) { snap();
        App.Diagram.add(I.form.dg, x.dataset.pick); App.$('fQ').value = ''; App.$('fSugg').innerHTML = '';
        if (onlyDamage(I.form.type)) rerenderPane(); else mountDg();
        renderAssist(); refocus('fQ'); saveDraftSoon(); return true;
      }
      if ((x = t.closest('[data-rnext]'))) { snap();
        var nq = x.dataset.rnext.split(':'), nrows = I.form.rep[nq[0]][nq[1]], ni = +nq[2], base = nrows[ni];
        // 自動で入れる日付は土日・祝日を飛ばす（その日にしたい時は日付の欄で選び直せる）
        var nr = nq[3] === 'day' ? { d: Rp.nextSchoolDay(base.d || today()), p: Rp.slots()[0], t: '' } : nextRow(base.p ? base : { d: base.d, p: Rp.slots()[0], t: '' });
        if (nq[3] === 'slot' && !base.p) nr = { d: base.d, p: Rp.slots()[0], t: '' };
        nrows.splice(ni + 1, 0, nr);
        rerenderPane(); refocus('rw-' + nq[0] + '-' + nq[1] + '-' + (ni + 1)); saveDraftSoon(); return true;
      }
      if ((x = t.closest('[data-radd]'))) {
        var rows = rowsAt(x.dataset.radd), prev = rows[rows.length - 1];
        rows.push(nextRow(prev));
        rerenderPane(); var p = x.dataset.radd.split(':'); refocus('rw-' + p[0] + '-' + p[1] + '-' + (rows.length - 1)); return true;
      }
      if ((x = t.closest('[data-rdel]'))) { snap(); var q = x.dataset.rdel.split(':'); I.form.rep[q[0]][q[1]].splice(+q[2], 1); I.focus = null; rerenderPane(); saveDraftSoon(); return true; }
      return false;
    },
    input: function (t) {
      // 事案の検索：カードだけを描き直す（入力欄を作り直すと日本語の変換が切れる）
      if (t.id === 'iq') { I.q = t.value; refreshCards(); return; }
      if (t.id === 'isort') { HOME.sort = t.value; saveHome(); refreshCards(); return; }
      var f = I.form; if (!f) return;
      if (t.dataset.step != null) { toggleStep(+t.dataset.step, t.checked); return; }
      if (t.dataset.rw) {
        var q = t.dataset.rw.split(':'), r = f.rep[q[0]][q[1]][+q[2]]; if (!r) return;
        r[q[3]] = t.value;
        if (q[3] === 'd') { spreadDate(q.slice(0, 3).join(':'), t.value); var lb = t.parentNode.querySelector('span'); if (lb) lb.textContent = mdShort(t.value); t.parentNode.title = Rp.md(t.value); }
        if (q[3] === 'p') t.classList.toggle('on', !!t.value);
        if (q[3] === 't') { autosize(t); renderAssist(); syncSteps(); var ex = App.$('irx-' + q[0] + '-' + q[1] + '-' + q[2]); if (ex && I.focus === q.slice(0, 3).join(':')) ex.innerHTML = extraHtml(I.focus); }
        saveDraftSoon(); return;
      }
      if (t.dataset.mode != null) { f.rep.modes[+t.dataset.mode] = t.checked; var o = App.$('fOther'); if (o) o.disabled = !f.rep.modes[C.MODES.length - 1]; saveDraftSoon(); return; }
      switch (t.id) {
        case 'iq': return;
        case 'fQ': App.$('fSugg').innerHTML = suggHtml(t.value); return;
        case 'fUrl': f.url = t.value.trim(); break;
        case 'fTitle': f.title = t.value; break;
        case 'fDetail': f.detail = t.value; break;
        case 'fFound': f.rep.found = t.value; break;
        case 'fOther': f.rep.other = t.value; break;
        case 'fKikan': f.rep.s2.kikan = t.value; renderAssist(); break;
        default: return;
      }
      saveDraftSoon();
    },
    submit: function (form) {
      var f = I.form; if (!f) return;
      if (form.id === 'inc2Form') {
        var x2 = incOf(f.edit);
        App.save(function () { return App.pf().updateIncident(x2.id, body(x2, { rep: f.rep })); }).then(function (inc) { dropDraft(); saved(inc, 'その後の経緯を保存しました'); });
        return;
      }
      if (form.id !== 'incForm') return;
      if (!typesOf(f.type).length) { App.toast('事案の種別を選んでください'); return; }
      if (!f.dg.d.nodes.some(function (n) { return !E.isUnknown(n.id); })) { App.toast('関係する児童を1人以上足してください（「？」だけでは登録できません）'); return; }
      // 保護者への連絡が書かれていなければ一度だけ知らせる（もう一度押せばそのまま登録）
      var sdTxt = f.rep.s1.sd.map(function (r) { return r.t; }).join('');
      if (!f.warned && sdTxt.indexOf('保護者') < 0) { f.warned = true; App.toast('指導の欄に、保護者への連絡が書かれていません。このままでよければ、もう一度「' + (f.edit != null ? '直す' : '登録する') + '」を押します'); return; }
      var x = f.edit != null ? incOf(f.edit) : {};
      var b = body(x, f);
      App.save(function () { return f.edit != null ? App.pf().updateIncident(f.edit, b) : App.pf().addIncident(b); }).then(function (inc) {
        dropDraft(); saved(inc, f.edit != null ? '事案を直しました' : '事案を登録しました');
      });
    },
    key: function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z') && I.mode !== 'view' && undo()) { e.preventDefault(); return true; }
      if (e.key === 'Escape' && I.mode !== 'view') { App.screens.incidents.leave(); closeForm(); rerenderPane(); App.toast('書きかけは残してあります'); return true; }
      return false;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

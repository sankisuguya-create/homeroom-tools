// Platform層（本番）。platform/demo.js と同じ名前・同じ形の非同期 API を、google.script.run で GAS に送る。
// 版の照合：画面の PAGE_BUILD とサーバーの SERVER_BUILD が違えば、貼り忘れとして画面の上に警告を出す
// （principles/gas-javascript-notes.md §4。値は scripts/build.py が両方に同じものを焼き込む）。
(function (g) {
  'use strict';
  var C = g.CONFIG;
  var PAGE_BUILD = '@@BUILD@@';
  var planVer = {}; // 学年 → 読み込んだ時の案の版（同時保存の検知に使う）
  var pairsVer = {}, incRev = {}; // つける・離すの版、事案ごとの版（ほかの先生が先に直していたら上書きしない）
  var conflict = function (who, what) { var e = new Error((who || 'ほかの先生') + ' が' + what + 'を先に保存しました。メニューから開き直してください（この画面の変更は保存されていません）'); e.noRetry = true; return e; };
  var keepRev = function (x) { if (x && x.id != null && x.rev) incRev[x.id] = x.rev; return x; };
  var warned = false;

  function warnBuild(server) {
    if (warned || server === PAGE_BUILD) return;
    warned = true;
    var d = document.createElement('div');
    d.setAttribute('role', 'alert');
    d.style.cssText = 'background:#fbe7e1;color:#C0330A;border:2px solid #C0330A;padding:6px 10px;font-weight:700;margin-bottom:6px';
    d.textContent = '画面とサーバーの版が違います（画面 ' + PAGE_BUILD + '／サーバー ' + server + '）。Code.gs と Index.html を同じ版で貼り直し、デプロイを「新しいバージョン」で更新してください。';
    document.body.insertBefore(d, document.body.firstChild);
  }

  // 端末の登録：合い言葉はこの端末のブラウザにだけ置く。毎回の呼び出しに、合い言葉と端末の種類を添える
  var DEV_KEY = 'classSplit.device';
  function devToken() { try { return localStorage.getItem(DEV_KEY) || ''; } catch (e) { return ''; } }
  function devInfo() { var i = C.deviceInfo(navigator, screen); i.t = devToken(); return { __dev: i }; }
  function call(name) {
    var args = Array.prototype.slice.call(arguments, 1);
    args.push(devInfo());
    var t0 = Date.now();
    return new Promise(function (res, rej) {
      var run = g.google.script.run
        .withSuccessHandler(function (s) {
          var r = JSON.parse(s);
          if (g.console && r.ms != null) console.info('[クラス替え] ' + name + '：サーバー ' + r.ms + 'ms／往復 ' + (Date.now() - t0) + 'ms');
          warnBuild(r.build);
          if (r.dev) { try { localStorage.setItem(DEV_KEY, r.dev); } catch (x) { /* 保存できないと次から締め出される */ } }
          if (r.ok) res(r.v);
          else { var e = new Error(r.err); e.noRetry = !!r.user; e.device = !!r.device; rej(e); }
        })
        .withFailureHandler(function (e) { rej(e instanceof Error ? e : new Error(String(e))); });
      // サーバーに関数が無い＝画面とサーバーの版が違う（貼り忘れ・保存忘れ・デプロイの更新忘れ）。何が無いかを出す
      if (typeof run[name] !== 'function') {
        var e = new Error('サーバーに「' + name + '」がありません（画面の版 ' + PAGE_BUILD + '）。Code.gs・Index.html・appsscript.json の3つを同じ版で貼り直して保存し、「デプロイを管理 → 編集 → 新バージョン」で更新してください。');
        e.noRetry = true; rej(e); return;
      }
      run[name].apply(run, args);
    });
  }

  g.Platforms = g.Platforms || {};
  g.Platforms.gas = {
    name: 'gas',
    fiscalYear: C.fiscalYear(),
    listGrades: function (fy) { return call('apiListGrades', fy || 0); },
    rosterYears: function () { return call('apiRosterYears'); },
    menu: function (fy) { return call('apiMenu', fy || 0); }, // 学年の一覧・設定・年度の一覧を1回で
    perf: function () { return call('apiPerf'); },
    boot: function (grade) {
      return call('apiBoot', grade).then(function (d) {
        planVer[grade] = d.plans.ver || 0; pairsVer[grade] = d.pairsVer || 0;
        (d.incidents || []).forEach(keepRev);
        d.plans = d.plans.plans || [];
        return d;
      });
    },
    setAttr: function (fy, grade, id, k, v, text, incs) { return call('apiSetAttr', fy, grade, id, k, v, text, incs); },
    setAttrs: function (list) { return call('apiSetAttrs', list); },
    updateKids: function (fy, grade, list) { return call('apiUpdateKids', fy, grade, list); },
    gaijiFound: function () { return call('apiGaijiFound'); },
    setClassCount: function (fy, grade, n) { return call('apiSetClassCount', fy, grade, n); },
    savePlans: function (grade, plans) {
      return call('apiSavePlans', grade, plans, planVer[grade] || 0).then(function (r) {
        if (r.conflict) {
          var e = new Error((r.by || 'ほかの人') + ' が案を先に保存しました。メニューから開き直してください（この画面の変更は保存されていません）');
          e.noRetry = true;
          throw e;
        }
        planVer[grade] = r.ver;
        return r;
      });
    },
    addIncident: function (x) { return call('apiAddIncident', x).then(keepRev); },
    updateIncident: function (id, x) { return call('apiUpdateIncident', id, x, incRev[id] || '').then(function (r) { if (r.conflict) throw conflict(r.by, 'この事案'); return keepRev(r); }); },
    fetchTitle: function (url) { return call('apiFetchTitle', url); },
    saveDraft: function (grade, d) { return call('apiSaveDraft', grade, d); },
    loadDraft: function (grade) { return call('apiLoadDraft', grade); },
    exportReport: function (kind, values, incId, seq) { return call('apiExportReport', kind, values, incId, seq); },
    build: PAGE_BUILD,
    schoolKids: function () { return call('apiSchoolKids'); },
    setScores: function (fy, grade, v) { return call('apiSetScores', fy, grade, v); },
    allIncidents: function () { return call('apiAllIncidents').then(function (l) { l.forEach(keepRev); return l; }); },
    schoolIncidents: function () { return call('apiSchoolIncidents'); },
    decide: function (grade, plan) { return call('apiDecide', grade, plan); },
    addTransfer: function (grade, x) { return call('apiAddTransfer', grade, x); },
    removeTransfer: function (grade, id) { return call('apiRemoveTransfer', grade, id); },
    leftKids: function (fy, grade) { return call('apiLeftKids', fy, grade); },
    restoreKid: function (fy, grade, id, cls) { return call('apiRestoreKid', fy, grade, id, cls); },
    updateKid: function (fy, grade, id, x) { return call('apiUpdateKid', fy, grade, id, x); },
    setKidClass: function (fy, grade, id, cls) { return call('apiSetKidClass', fy, grade, id, cls); },
    removeKids: function (fy, grade, ids, reason) { return call('apiRemoveKids', fy, grade, ids, reason); },
    importRoster: function (fy, grade, rows, opt) { return call('apiImportRoster', fy, grade, rows, opt || {}); },
    adminStatus: function () { return call('apiAdminStatus'); },
    readLog: function () { return call('apiReadLog'); },
    savePairs: function (grade, pairs) { return call('apiSavePairs', grade, pairs, pairsVer[grade] || 0).then(function (r) { if (r.conflict) throw conflict(r.by, 'つける・離す'); pairsVer[grade] = r.ver; return r; }); },
    undoDecide: function (grade) { return call('apiUndoDecide', grade); },
    setClassNames: function (grade, names) { return call('apiSetClassNames', grade, names); },
    settings: function () { return call('apiSettings'); },
    saveSettings: function (s) { return call('apiSaveSettings', s); },
    saveMyView: function (v) { return call('apiSaveMyView', v); },
    leaveCandidates: function () { return call('apiLeaveCandidates'); },
    purge: function (ids) { return call('apiPurge', ids); },
    trashIncident: function (id) { return call('apiTrashIncident', id); },
    trashList: function () { return call('apiTrashList'); },
    restoreIncident: function (id) { return call('apiRestoreIncident', id); },
    emptyTrash: function (ids) { return call('apiEmptyTrash', ids || []); },
    suggest: function (text, screen) { return call('apiSuggest', text, screen); },
    suggestions: function () { return call('apiSuggestions'); },
    clearSuggestions: function () { return call('apiClearSuggestions'); },
    pruneLog: function () { return call('apiPruneLog'); },
    devices: function () { return call('apiDevices'); },
    openDeviceWindow: function (role) { return call('apiOpenDeviceWindow', role); },
    closeDeviceWindow: function () { return call('apiCloseDeviceWindow'); },
    revokeDevice: function (id) { return call('apiRevokeDevice', id); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

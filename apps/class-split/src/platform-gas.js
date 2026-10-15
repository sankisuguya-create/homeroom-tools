// Platform層（本番）。platform-demo.js と同じ名前・同じ形の非同期 API を、google.script.run で GAS に送る。
// 版の照合：画面の PAGE_BUILD とサーバーの SERVER_BUILD が違えば、貼り忘れとして画面の上に警告を出す
// （principles/gas-javascript-notes.md §4。値は scripts/build.py が両方に同じものを焼き込む）。
(function (g) {
  'use strict';
  var C = g.CONFIG;
  var PAGE_BUILD = '@@BUILD@@';
  var planVer = {}; // 学年 → 読み込んだ時の案の版（同時保存の検知に使う）
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

  function call(name) {
    var args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (res, rej) {
      var run = g.google.script.run
        .withSuccessHandler(function (s) {
          var r = JSON.parse(s);
          warnBuild(r.build);
          if (r.ok) res(r.v);
          else { var e = new Error(r.err); e.noRetry = !!r.user; rej(e); }
        })
        .withFailureHandler(function (e) { rej(e instanceof Error ? e : new Error(String(e))); });
      run[name].apply(run, args);
    });
  }

  g.Platforms = g.Platforms || {};
  g.Platforms.gas = {
    name: 'gas',
    fiscalYear: C.fiscalYear(),
    listGrades: function () { return call('apiListGrades'); },
    boot: function (grade) {
      return call('apiBoot', grade).then(function (d) {
        planVer[grade] = d.plans.ver || 0;
        d.plans = d.plans.plans || [];
        return d;
      });
    },
    setAttr: function (fy, grade, id, k, v, text) { return call('apiSetAttr', fy, grade, id, k, v, text); },
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
    addIncident: function (x) { return call('apiAddIncident', x); },
    updateIncident: function (id, x) { return call('apiUpdateIncident', id, x); },
    fetchTitle: function (url) { return call('apiFetchTitle', url); },
    schoolIncidents: function () { return call('apiSchoolIncidents'); },
    decide: function (grade, plan) { return call('apiDecide', grade, plan); },
    addTransfer: function (grade, x) { return call('apiAddTransfer', grade, x); },
    removeTransfer: function (grade, id) { return call('apiRemoveTransfer', grade, id); },
    importRoster: function (fy, grade, rows) { return call('apiImportRoster', fy, grade, rows); },
    savePairs: function (grade, pairs) { return call('apiSavePairs', grade, pairs); },
    undoDecide: function (grade) { return call('apiUndoDecide', grade); },
    settings: function () { return call('apiSettings'); },
    saveSettings: function (s) { return call('apiSaveSettings', s); },
    leaveCandidates: function () { return call('apiLeaveCandidates'); },
    purge: function (ids) { return call('apiPurge', ids); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

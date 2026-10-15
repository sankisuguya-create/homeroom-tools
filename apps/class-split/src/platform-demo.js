// Platform層（見本用）。本番の GAS と同じ形の非同期 API を、メモリ上の架空データで返す。
// 画面はこの API だけを呼ぶ。PR② で同じ形の platform-gas.js（google.script.run）を足して差し替える。
// データの形は docs/design.md §3（シート構成）と同じにしてある。
(function (g) {
  'use strict';
  var C = g.CONFIG, E = g.Engine;
  var FY = C.fiscalYear();

  var SUR = [['佐藤','さとう'],['鈴木','すずき'],['高橋','たかはし'],['田中','たなか'],['伊藤','いとう'],['渡辺','わたなべ'],['山本','やまもと'],['中村','なかむら'],['小林','こばやし'],['加藤','かとう'],['吉田','よしだ'],['山田','やまだ'],['佐々木','ささき'],['山口','やまぐち'],['松本','まつもと'],['井上','いのうえ'],['木村','きむら'],['林','はやし'],['清水','しみず'],['山崎','やまざき'],['森','もり'],['池田','いけだ'],['橋本','はしもと'],['阿部','あべ'],['石川','いしかわ'],['前田','まえだ'],['藤田','ふじた'],['小川','おがわ'],['岡田','おかだ'],['後藤','ごとう']];
  // 下の名前は動物のカタカナ名（3字以下）。ダミーだと一目で分かるように（例：田中 カメ）。よみはひらがなにする
  var ANIMALS = 'カメ イルカ ウシ ウマ ブタ ヤギ ヒツジ ネコ イヌ サル クマ シカ リス タヌキ キツネ ウサギ ネズミ ゾウ キリン ラクダ カバ サイ トラ ワニ ヘビ カエル ツル カモ タカ ワシ ハト スズメ クジラ サメ タイ コイ カニ エビ タコ イカ ラッコ パンダ コアラ ゴリラ ヒョウ モグラ アヒル'.split(' ');
  var toHira = function (k) { return k.replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); }); };
  var GM = ANIMALS.map(function (x) { return [x, toHira(x)]; }), GF = GM;
  var PLACES = ['休み時間', '給食', '登校', '体育', '清掃'];
  var P_ATTR = { k1: .13, k2: .03, k3: .08, k4: .06, k5: .08, k6: .04, k7: .15, k8: .12, k9: .18, k10: .06 };

  // ===== 架空データ（学年ごとに入学から今年度まで） =====
  var S = { kids: {}, years: {}, inc: [], pairs: {}, carry: {}, plans: {}, decisions: {}, transfers: {}, nextInc: 1 };
  function yearRows(fy, grade) { S.years[fy] = S.years[fy] || {}; return (S.years[fy][grade] = S.years[fy][grade] || []); }

  // ダミーデータは初めて使う時に作る（本番の画面では「試行」を押すまで作らない）
  var made = false;
  function gen() {
    if (made) return;
    made = true;
    // grade 7 は昨年度に卒業した学年（年度替わりの削除の候補の見本）
    for (var grade = 1; grade <= 7; grade++) {
      // ア・身・通の内容の見本
      var NOTE = { k5: ['卵', '小麦・そば', 'ピーナッツ。エピペンあり', '乳製品', ''], k6: ['右耳が聞こえにくい。前の席', 'ぜんそく', '視力が弱い。前の席', ''], k10: ['週1回 ことばの教室', '週2回 通級（LD）', '支援員が国語に入る', ''] };
      var R = E.rngOf(1000 + grade), pick = function (a) { return a[Math.floor(R() * a.length)]; };
      // 5年は上限（4学級×36人＝144人）、3年は3学級
      var nc = grade === 3 ? 3 : grade === 7 ? 2 : 4, n = nc === 3 ? 103 : grade === 7 ? 24 : grade === 5 ? 144 : 138, ny = Math.min(grade, 6), entry = FY - grade + 1, ids = [], base = {};
      for (var i = 0; i < n; i++) {
        var male = R() < .5, sn = pick(SUR), gn = male ? pick(GM) : pick(GF);
        var id = String(20000000 + entry * 1000 + i + 1);
        S.kids[id] = { id: id, name: sn[0] + ' ' + gn[0], kana: sn[1] + ' ' + gn[1], male: male, area: pick(C.AREAS) };
        ids.push(id);
        var a = {};
        C.ATTRS.forEach(function (at) { a[at.k] = R() < P_ATTR[at.k] ? Math.min(at.max, 1 + Math.floor(R() * R() * 3)) : 0; });
        base[id] = a;
      }
      for (var y = 0; y < ny; y++) {
        var fy = entry + y, order = ids.slice().sort(function () { return R() - .5; }), rows = yearRows(fy, y + 1);
        order.forEach(function (id, ix) {
          var a = {};
          C.ATTRS.forEach(function (at) {
            var v = base[id][at.k];
            if (R() < .2) v = Math.max(0, Math.min(at.max, v + (R() < .5 ? -1 : 1)));
            a[at.k] = v;
            if (at.side && v) a[at.k + '_t'] = NOTE[at.k][(+id) % NOTE[at.k].length];
          });
          if ((+id) % 53 === 7) a.sp = 1; // 特別支援学級の児童の見本（各学年2〜3人）
          rows.push({ id: id, cls: ix % nc, no: 0, a: a });
        });
        for (var k = 0; k < nc; k++) rows.filter(function (r) { return r.cls === k; })
          .sort(function (p, q) { return S.kids[p.id].kana.localeCompare(S.kids[q.id].kana, 'ja'); })
          .forEach(function (r, no) { r.no = no + 1; });
      }
      // 事案（1件に1〜3人）
      for (var t = 0; t < ny * 14; t++) {
        var fyI = entry + Math.floor(R() * ny), mo = 1 + Math.floor(R() * 12), day = 1 + Math.floor(R() * 28);
        var yr = mo >= 4 ? fyI : fyI + 1, now = new Date();
        if (yr * 100 + mo > now.getFullYear() * 100 + now.getMonth() + 1) continue;
        var kids = [pick(ids)];
        if (R() < .5) { var o = pick(ids); if (kids.indexOf(o) < 0) kids.push(o); }
        if (R() < .12) { var o2 = pick(ids); if (kids.indexOf(o2) < 0) kids.push(o2); }
        S.inc.push({ id: S.nextInc++, date: yr + '-' + ('0' + mo).slice(-2) + '-' + ('0' + day).slice(-2),
          type: pick(C.INCIDENT_TYPES), title: mo + '月' + day + '日 ' + pick(PLACES) + 'の件', url: '#demo-' + S.nextInc, ids: kids });
      }
      // つける・離す・組に固定（今年度の学年の分）
      var cur = ids.slice(), pairs = [], used = {};
      var two = function () { var a, b; do { a = pick(cur); b = pick(cur); } while (a === b || used[a] || used[b]); used[a] = used[b] = 1; return [a, b]; };
      var MEMO = ['低学年の時からトラブルが続いている', '保護者から申し出があった', '休み時間に一緒になると落ち着かない', ''];
      for (var f = 0; f < 6; f++) { var ab = two(); pairs.push({ t: 'far', a: ab[0], b: ab[1], since: Math.max(1, grade - Math.floor(R() * 3)), tags: [pick(C.PAIR_TAGS)], memo: pick(MEMO), incs: [] }); }
      for (var nr = 0; nr < 2; nr++) { var cd = two(); pairs.push({ t: 'near', a: cd[0], b: cd[1] }); }
      var fx = pick(cur); if (!used[fx]) pairs.push({ t: 'fix', a: fx, k: 0, memo: '教室が1階' });
      S.pairs[grade] = pairs;
      // 前年度から持ち越した「つける・離す」の候補（見本）
      S.carry[grade] = grade >= 2 ? [0, 1, 2].map(function () { var ab = two(); return { t: R() < .7 ? 'far' : 'near', a: ab[0], b: ab[1], memo: '', tags: ['前担任から'], incs: [], since: Math.max(1, grade - 1 - Math.floor(R() * 2)) }; }) : [];
      S.plans[grade] = [];
    }
    // 4年の1人は今年度に転出した（今年度の名簿にいない）
    var g4 = yearRows(FY, 4); g4.splice(0, 1);
    S.settings = (function () {
      var attrs = {};
      C.ATTRS.forEach(function (at) { attrs[at.k] = { label: at.label, s: at.s, w: at.w }; });
      return { attrs: attrs, types: C.INCIDENT_TYPES.slice(), teachers: [{ email: 'demo@' + C.TEACHER_DOMAIN, grade: 5, cls: 1 }], keepYears: 0 };
    })();
  }

  // 本番の incidentInput_ と同じ：関係図があれば、関係する児童と役割は関係図から決める
  function demoIncident(x) {
    var dg = x.diagram ? E.normDiagram(x.diagram) : null;
    if (dg && !dg.nodes.length) dg = null;
    return { date: x.date, dateEnd: x.dateEnd || '', detail: String(x.detail || '').slice(0, 5000), type: x.type, title: x.title || '', url: x.url, ids: dg ? dg.nodes.map(function (n) { return n.id; }) : (x.ids || []).slice(), roles: dg ? E.diagramRoles(dg) : {}, diagram: dg };
  }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function later(v) { return new Promise(function (res) { setTimeout(function () { res(clone(v)); }, 30); }); }

  // その学年（今年度の学年）の児童が、各年度に何年何組だったか
  function cohortYears(grade) {
    var out = [], entry = FY - grade + 1;
    for (var fy = entry; fy <= FY + 1; fy++) {
      var gy = fy - entry + 1, rows = S.years[fy] && S.years[fy][gy];
      if (rows && rows.length) out.push({ fy: fy, grade: gy, rows: rows });
    }
    return out;
  }

  // 持ち越しの候補のうち、まだ採用していない組だけ
  function carryOf(grade) {
    var key = function (p) { return p.t + ':' + [p.a, p.b].sort().join('-'); }, have = {};
    (S.pairs[grade] || []).forEach(function (p) { have[key(p)] = 1; });
    return (S.carry[grade] || []).filter(function (p) { return !have[key(p)]; });
  }

  g.Platforms = g.Platforms || {};
  g.Platforms.demo = {
    name: 'demo',
    fiscalYear: FY,
    listGrades: function () { gen();
      var out = [];
      for (var grade = 1; grade <= 6; grade++) {
        var rows = yearRows(FY, grade), nc = 0;
        rows.forEach(function (r) { if (r.cls + 1 > nc) nc = r.cls + 1; });
        out.push({ grade: grade, count: rows.length, classes: nc, decided: !!S.decisions[grade] });
      }
      return later(out);
    },
    boot: function (grade) { gen();
      if (!S.transfers[grade] && grade === 4) { // 新年度の転入生の見本（5年は上限の144人なので4年に置く）
        S.transfers[4] = [{ id: 'T' + FY + '001', name: '中島 リス', kana: 'なかじま りす', male: false }, { id: 'T' + FY + '002', name: '野村 シカ', kana: 'のむら しか', male: true }];
        S.transfers[4].forEach(function (t) { S.kids[t.id] = { id: t.id, name: t.name, kana: t.kana, male: t.male, area: '' }; });
      }
      var years = cohortYears(grade), idset = {};
      years.forEach(function (y) { y.rows.forEach(function (r) { idset[r.id] = 1; }); });
      var kids = {};
      Object.keys(idset).forEach(function (id) { kids[id] = S.kids[id]; });
      return later({
        fy: FY, grade: grade, years: years, kids: kids,
        incidents: S.inc.filter(function (x) { return x.ids.some(function (id) { return idset[id]; }); }),
        pairs: S.pairs[grade] || [], carry: carryOf(grade), plans: S.plans[grade] || [], decision: S.decisions[grade] || null,
        transfers: clone(S.transfers[grade] || [])
      });
    },
    addTransfer: function (grade, x) { gen();
      if (S.decisions[grade]) return Promise.reject(new Error('決定済みです。決定を取り消してから足してください'));
      var name = String(x.name || '').trim(), id = String(x.id || '').trim();
      if (!name) return Promise.reject(new Error('名前を入れてください'));
      if (id && !/^\d{8}$/.test(id)) return Promise.reject(new Error('児童IDは数字8桁です（分からなければ空のまま）'));
      if (id && S.kids[id]) return Promise.reject(new Error('その児童IDはもう使われています'));
      if (!id) { var n = 1; while (S.kids['T' + FY + ('00' + n).slice(-3)]) n++; id = 'T' + FY + ('00' + n).slice(-3); }
      var t = { id: id, name: name, kana: String(x.kana || '').trim(), male: !!x.male };
      (S.transfers[grade] = S.transfers[grade] || []).push(t);
      S.kids[id] = { id: id, name: t.name, kana: t.kana, male: t.male, area: '' };
      return later({ id: id });
    },
    removeTransfer: function (grade, id) { gen();
      if (S.decisions[grade]) return Promise.reject(new Error('決定済みです。決定を取り消してから消してください'));
      S.transfers[grade] = (S.transfers[grade] || []).filter(function (t) { return t.id !== id; });
      return later({ ok: true });
    },
    setAttr: function (fy, grade, id, k, v, text) { gen();
      var r = yearRows(fy, grade).filter(function (x) { return x.id === id; })[0];
      if (!r) return Promise.reject(new Error('児童が見つかりません'));
      if (k === 'memo') { if (text) r.a.memo = String(text).slice(0, 200); else delete r.a.memo; return later({ ok: true }); }
      if (k === 'sp') { if (v) r.a.sp = 1; else delete r.a.sp; } else r.a[k] = v;
      if (text !== undefined) { if (v && text) r.a[k + '_t'] = String(text).slice(0, 200); else delete r.a[k + '_t']; }
      return later({ ok: true });
    },
    savePlans: function (grade, plans) { gen(); S.plans[grade] = clone(plans); return later({ ok: true }); },
    addIncident: function (x) { gen();
      // 本番は所有者の権限で文書の名前を取る。取れない時は title を空で返し、画面が入力を求める
      var inc = Object.assign({ id: S.nextInc++ }, demoIncident(x));
      if (!inc.ids.length) return Promise.reject(new Error('関係する児童を選んでください'));
      S.inc.push(inc);
      return later(clone(inc));
    },
    updateIncident: function (id, x) { gen();
      var cur = S.inc.filter(function (y) { return y.id === +id; })[0];
      if (!cur) return Promise.reject(new Error('事案が見つかりません'));
      var v = demoIncident(x);
      if (!v.ids.length) return Promise.reject(new Error('関係する児童を選んでください'));
      Object.assign(cur, v);
      return later(clone(cur));
    },
    fetchTitle: function (url) { gen();
      return later({ title: /docs\.google\.com/.test(url) ? '（見本）取得した文書の名前' : '' });
    },
    schoolIncidents: function () { gen();
      var out = {};
      for (var grade = 1; grade <= 6; grade++) yearRows(FY, grade).forEach(function (r) { out[r.id] = { grade: grade, cls: r.cls, no: r.no }; });
      var rows = [];
      Object.keys(out).forEach(function (id) {
        var list = S.inc.filter(function (x) { return x.ids.indexOf(id) >= 0; });
        if (!list.length) return;
        var last = list.map(function (x) { return x.date; }).sort().pop();
        rows.push({ id: id, name: S.kids[id].name, male: S.kids[id].male, grade: out[id].grade, cls: out[id].cls, no: out[id].no, count: list.length, last: last });
      });
      return later(rows);
    },
    // 決定：次の年度の名簿（新しい組・番号）を作り、配慮項目の値を写し、つける・離すを持ち越しの候補にする
    decide: function (grade, plan) { gen();
      if (S.decisions[grade]) return Promise.reject(new Error('決定済みです'));
      if (grade >= 6) return Promise.reject(new Error('6年は決定しません'));
      var cur = yearRows(FY, grade).concat((S.transfers[grade] || []).map(function (t) { return { id: t.id, a: {} }; }));
      var kids = cur.map(function (r) { var s = S.kids[r.id]; return { id: r.id, kana: s.kana, a: r.a }; });
      var asg = cur.map(function (r) { return plan.assign[r.id]; });
      if (asg.some(function (k) { return !(k >= 0 && k < C.MAX_CLASSES); })) return Promise.reject(new Error('組の決まっていない児童がいます'));
      var nc = 0; asg.forEach(function (k) { if (k + 1 > nc) nc = k + 1; });
      S.years[FY + 1] = S.years[FY + 1] || {};
      S.years[FY + 1][grade + 1] = E.nextYearRows(kids, asg, nc);
      S.decisions[grade] = { plan: plan.name, at: new Date().toISOString(), names: Array.from({ length: nc }, function (_, k) { return k + 1; }), named: false, carry: (S.pairs[grade] || []).filter(function (p) { return p.t !== 'fix'; }).map(function (p) { return { t: p.t, a: p.a, b: p.b, memo: p.memo || '', tags: (p.tags || []).slice(), incs: (p.incs || []).slice(), since: p.since || grade }; }) };
      return later(S.decisions[grade]);
    },
    // 名簿を入れる：同じ児童IDは上書き（配慮項目の値は残す）、新しいIDは足す。貼った中にいない児童は知らせるだけ
    importRoster: function (fy, grade, rows) {
      gen();
      var cur = yearRows(fy, grade), byId = {}, added = 0, updated = 0, classes = {};
      cur.forEach(function (r) { byId[r.id] = r; });
      rows.forEach(function (x) {
        classes[x.cls] = 1;
        S.kids[x.id] = { id: x.id, name: x.name, kana: x.kana, male: x.male, area: (S.kids[x.id] || {}).area || '' };
        if (byId[x.id]) { byId[x.id].cls = x.cls; byId[x.id].no = x.no; updated++; }
        else { var a = {}; C.ATTRS.forEach(function (at) { a[at.k] = 0; }); cur.push({ id: x.id, cls: x.cls, no: x.no, a: a }); added++; }
      });
      var ids = {}; rows.forEach(function (x) { ids[x.id] = 1; });
      var missing = cur.filter(function (r) { return classes[r.cls] && !ids[r.id]; }).map(function (r) { return S.kids[r.id].name; });
      return later({ added: added, updated: updated, missing: missing });
    },
    savePairs: function (grade, pairs) { gen(); S.pairs[grade] = clone(pairs); return later({ ok: true }); },
    settings: function () { gen(); return later({ settings: S.settings, me: { email: 'demo@' + C.TEACHER_DOMAIN, grade: 5, cls: 0 } }); },
    saveSettings: function (x) { gen(); S.settings = clone(x); return later(S.settings); },
    leaveCandidates: function () {
      gen();
      var now = {}, last = {}, cnt = {};
      [FY, FY + 1].forEach(function (fy) { Object.keys(S.years[fy] || {}).forEach(function (gr) { S.years[fy][gr].forEach(function (r) { now[r.id] = 1; }); }); });
      Object.keys(S.years).map(Number).sort().forEach(function (fy) {
        if (fy >= FY) return;
        Object.keys(S.years[fy]).forEach(function (gr) { S.years[fy][gr].forEach(function (r) { last[r.id] = { id: r.id, name: S.kids[r.id].name, fy: fy, grade: +gr, cls: r.cls, no: r.no }; }); });
      });
      S.inc.forEach(function (x) { x.ids.forEach(function (id) { cnt[id] = (cnt[id] || 0) + 1; }); });
      return later(Object.keys(last).filter(function (id) { return !now[id] && FY > last[id].fy + (S.settings.keepYears | 0); }).map(function (id) {
        var x = last[id]; x.reason = x.grade === 6 ? '卒業' : '転出'; x.incidents = cnt[id] || 0; return x;
      }).sort(function (a, b) { return a.fy - b.fy || a.grade - b.grade || a.cls - b.cls || a.no - b.no; }));
    },
    purge: function (ids) {
      gen();
      var set = {}; ids.forEach(function (id) { set[id] = 1; });
      Object.keys(S.years).forEach(function (fy) { Object.keys(S.years[fy]).forEach(function (gr) { S.years[fy][gr] = S.years[fy][gr].filter(function (r) { return !set[r.id]; }); }); });
      S.inc.forEach(function (x) { x.ids = x.ids.filter(function (id) { return !set[id]; }); });
      S.inc = S.inc.filter(function (x) { return x.ids.length; });
      ids.forEach(function (id) { delete S.kids[id]; });
      return later({ kids: ids.length });
    },
    // 組の番号を決める：来年度の名簿の組を付け替える（A組から順に names の番号へ）
    setClassNames: function (grade, names) { gen();
      var dec = S.decisions[grade];
      if (!dec) return Promise.reject(new Error('決定されていません'));
      var old = dec.names, nc = old.length;
      if (names.length !== nc || names.slice().sort().join() !== old.slice().sort().join()) return Promise.reject(new Error('組の番号は 1〜' + nc + ' を1つずつ使ってください'));
      (S.years[FY + 1][grade + 1] || []).forEach(function (r) { var k = old.indexOf(r.cls + 1); if (k >= 0) r.cls = names[k] - 1; });
      dec.names = names.slice(); dec.named = true;
      return later({ ok: true });
    },
    undoDecide: function (grade) { gen();
      if (!S.decisions[grade]) return Promise.reject(new Error('決定されていません'));
      if (S.years[FY + 1]) delete S.years[FY + 1][grade + 1];
      delete S.decisions[grade];
      return later({ ok: true });
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

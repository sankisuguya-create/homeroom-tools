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
  // 学・欠・問・保の経緯の見本（角の窓で書く文）
  var CTX_NOTE = {
    k1: ['九九があやしい。放課後に補充', '文章を読むのに時間がかかる', '計算は早いが文章題が苦手', '個別に声をかけると取りかかれる'],
    k2: ['月曜に休みが多い', '朝起きられず遅刻が続く', '2学期から登校しぶり。別室登校あり', '家庭の事情で欠席が多い'],
    k3: ['かっとなると手が出る', '友達への言葉がきつい', '授業中に立ち歩く', '持ち物のトラブルが続いた'],
    k4: ['連絡帳でのやりとりが多い', '電話での相談が月に数回', '学校への要望が強い', '連絡がつきにくい']
  };
  var DETAIL = ['当事者それぞれから聞き取り、互いに謝った。', '保護者に電話で経過を伝えた。', '学年で共有し、休み時間の見守りを増やした。', '管理職に報告。後日、再度聞き取りをした。', ''];
  var P_ATTR = { k1: .13, k2: .03, k3: .08, k4: .06, k5: .08, k6: .04, k7: .15, k8: .12, k9: .18, k10: .06 };

  // ===== 架空データ（学年ごとに入学から今年度まで） =====
  var S = { kids: {}, years: {}, inc: [], pairs: {}, carry: {}, plans: {}, decisions: {}, transfers: {}, nextInc: 1 };
  function yearRows(fy, grade) { S.years[fy] = S.years[fy] || {}; return (S.years[fy][grade] = S.years[fy][grade] || []); }

  // ダミーデータは初めて使う時に作る（本番の画面では「試行」を押すまで作らない）
  var made = false;
  function gen() {
    if (made) return;
    made = true;
    var incFy = {}; // 事案の年度（経緯への紐付けで、その年度までの事案だけを選ぶ）
    // grade 7 は昨年度に卒業した学年（年度替わりの削除の候補の見本）
    for (var grade = 1; grade <= 7; grade++) {
      // ア・身・通の内容の見本
      var NOTE = { k5: ['卵', '小麦・そば', 'ピーナッツ。エピペンあり', '乳製品', ''], k6: ['右耳が聞こえにくい。前の席', 'ぜんそく', '視力が弱い。前の席', ''], k10: ['週1回 ことばの教室', '週2回 通級（LD）', '支援員が国語に入る', ''] };
      var R = E.rngOf(1000 + grade), pick = function (a) { return a[Math.floor(R() * a.length)]; };
      var R2 = E.rngOf(7000 + grade), pick2 = function (a) { return a[Math.floor(R2() * a.length)]; };
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
        var date = yr + '-' + ('0' + mo).slice(-2) + '-' + ('0' + day).slice(-2), dateEnd = '';
        if (R() < .2) { var d2 = new Date(yr, mo - 1, day + 2 + Math.floor(R() * 10)); dateEnd = d2.getFullYear() + '-' + ('0' + (d2.getMonth() + 1)).slice(-2) + '-' + ('0' + d2.getDate()).slice(-2); }
        // 種別はときどき2つ（いじめ・物損 など）。いじめには報告書の項目と、発覚・経緯・指導の記録を付ける
        // 記録の見本は別の乱数で作る（名簿・事案の数など、ほかの見本の並びを変えないため）
        var type = pick(C.INCIDENT_TYPES); if (type === 'いじめ' && R2() < .25) type = 'いじめ・物損';
        var dg = demoDiagram(kids, R2);
        // 加害者が分からないいじめ（「？」のカード）
        if (/いじめ/.test(type) && kids.length === 1 && R2() < .5) dg = { nodes: [{ id: '?1', x: 100, y: 110 }, { id: kids[0], x: 330, y: 110 }], groups: [], edges: [{ f: 'k:?1', t: 'k:' + kids[0] }] };
        var x = demoIncident({ date: date, dateEnd: dateEnd, detail: pick(DETAIL), type: type, title: mo + '月' + day + '日 ' + pick(PLACES) + 'の件', url: R2() < .4 ? '#demo-' + S.nextInc : '', ids: kids, diagram: dg,
          report: demoReport(type, date, dg, R2, pick2) });
        x.id = S.nextInc++; incFy[x.id] = fyI;
        S.inc.push(x);
      }
      // どの学年にも、被害の児童が2人のいじめを1件（様式を児童ごとに作る見本）。今年度の最近の日付
      if (grade <= 6) {
        var t3 = [ids[3], ids[7], ids[11]], nowD = new Date(), dd = new Date(nowD.getFullYear(), nowD.getMonth(), Math.max(1, nowD.getDate() - 5));
        var iso3 = dd.getFullYear() + '-' + ('0' + (dd.getMonth() + 1)).slice(-2) + '-' + ('0' + dd.getDate()).slice(-2);
        var dg3 = { nodes: t3.map(function (id, i) { return { id: id, x: 110 + i * 200, y: 110 + (i % 2) * 70 }; }), groups: [], edges: [{ f: 'k:' + t3[0], t: 'k:' + t3[1] }, { f: 'k:' + t3[0], t: 'k:' + t3[2] }] };
        var rp3 = demoReport('いじめ', iso3, dg3, function () { return .2; }, pick2);
        rp3.level = 'f2'; // 被害の児童が2人で、様式Ⅱを児童ごとに作る見本
        var x3 = demoIncident({ date: iso3, type: 'いじめ', title: '', url: '', ids: t3, diagram: dg3, report: rp3 });
        x3.id = S.nextInc++; incFy[x3.id] = FY; S.inc.push(x3);
      }
      // 学・欠・問・保：経緯の文と、その年度までの本人の事案の紐付け（問は事案があれば紐付ける）
      var incBy = {};
      S.inc.forEach(function (x) { x.ids.forEach(function (id) { (incBy[id] = incBy[id] || []).push(x); }); });
      for (var y2 = 0; y2 < ny; y2++) yearRows(entry + y2, y2 + 1).forEach(function (r) {
        C.ATTRS.forEach(function (at) {
          if (!at.ctx || !r.a[at.k]) return;
          if (R() < .7) r.a[at.k + '_t'] = pick(CTX_NOTE[at.k]);
          var mine = (incBy[r.id] || []).filter(function (x) { return incFy[x.id] <= entry + y2; });
          if (mine.length && (at.k === 'k3' || R() < .3)) r.a[at.k + '_i'] = mine.slice(-2).map(function (x) { return x.id; });
        });
        // 備考：定型の言葉を1〜2個
        if (R() < .15) {
          var w = [], gp = pick(C.MEMO_PICKS); w.push(pick(gp.items));
          if (R() < .4) w.push(pick(pick(C.MEMO_PICKS).items));
          r.a.memo = w.filter(function (v, i) { return w.indexOf(v) === i; }).join('。');
        }
        // 兄弟の見本：番号で決める（乱数を使わない＝ほかの見本の値を変えない）
        if (r.no % 7 === 0) r.a.sib = [{ r: r.no % 2 ? '兄' : '姉', g: Math.min(10, y2 + 3), n: '' }].concat(r.no % 14 === 0 ? [{ r: '妹', g: 0, n: '' }] : []);
      });
      // クラス分けテストの点数（今年度と前年度）。学力しんどさは低め・賢いは高め。数人は欠席で点数なし。
      // 上位の割合（top）に入った児童は「賢い」が自動で付く（App.applyScores）。別の乱数で作る
      if (grade <= 6) {
        var RS = E.rngOf(9000 + grade);
        [FY - 1, FY].forEach(function (fyS) {
          if (fyS < entry) return;
          var sc = { max: 100, top: C.SCORE_DEF.top, s: {} };
          yearRows(fyS, fyS - entry + 1).forEach(function (r) {
            if (RS() < .04) return;
            var v = 62 + (RS() + RS() + RS() - 1.5) * 30 - (r.a.k1 | 0) * 14 + (r.a.k7 | 0) * 16;
            sc.s[r.id] = Math.max(0, Math.min(100, Math.round(v)));
          });
          // 学力の順位（組・男女の中での順位）。点数の高い順に付け、点数の無い児童は後ろ。今年度は順位で「賢い」を決める見本
          var grp = {};
          yearRows(fyS, fyS - entry + 1).forEach(function (r) { var k = r.cls + ':' + (S.kids[r.id].male ? 'm' : 'f'); (grp[k] = grp[k] || []).push(r); });
          sc.r = {};
          Object.keys(grp).forEach(function (k) {
            grp[k].sort(function (p, q) { var a = sc.s[p.id] == null ? -1 : sc.s[p.id], b = sc.s[q.id] == null ? -1 : sc.s[q.id]; return b - a || p.no - q.no; })
              .forEach(function (r, i) { sc.r[r.id] = i + 1; });
          });
          sc.use = fyS === FY ? 'rank' : 'score';
          ((S.scores = S.scores || {})[grade] = S.scores[grade] || {})[fyS] = sc;
        });
      }
      // つける・離す・組に固定（今年度の学年の分）
      var cur = ids.slice(), pairs = [], used = {};
      var two = function () { var a, b; do { a = pick(cur); b = pick(cur); } while (a === b || used[a] || used[b]); used[a] = used[b] = 1; return [a, b]; };
      var MEMO = ['低学年の時からトラブルが続いている', '保護者から申し出があった', '休み時間に一緒になると落ち着かない', ''];
      // 事案で一緒になった2人を、離すの初めの3組にする（経緯と事案の紐付けの見本）
      S.inc.filter(function (x) { return x.ids.length >= 2 && cur.indexOf(x.ids[0]) >= 0 && cur.indexOf(x.ids[1]) >= 0 && !used[x.ids[0]] && !used[x.ids[1]]; }).slice(0, 3).forEach(function (x) {
        used[x.ids[0]] = used[x.ids[1]] = 1;
        pairs.push({ t: 'far', a: x.ids[0], b: x.ids[1], since: Math.max(1, grade - Math.floor(R() * 2)), tags: ['事案による'], memo: x.title + 'から', incs: [x.id] });
      });
      for (var f = pairs.length; f < 6; f++) { var ab = two(); pairs.push({ t: 'far', a: ab[0], b: ab[1], since: Math.max(1, grade - Math.floor(R() * 3)), tags: [pick(C.PAIR_TAGS)], memo: pick(MEMO), incs: [] }); }
      var NEAR_MEMO = ['一緒だと落ち着いて過ごせる', '登校をいつも一緒にしている', '新しい環境が苦手で、支えになる友達', ''];
      for (var nr = 0; nr < 2; nr++) { var cd = two(); pairs.push({ t: 'near', a: cd[0], b: cd[1], since: grade, tags: [pick(['家庭希望', '担任判断'])], memo: pick(NEAR_MEMO), incs: [] }); }
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
      return { attrs: attrs, types: C.INCIDENT_TYPES.slice(), teachers: [{ email: 'demo@' + C.TEACHER_DOMAIN, grade: 5, cls: 1 }], keepYears: C.KEEP_YEARS_DEFAULT, slots: C.TIME_SLOTS.slice(), school: '（見本）○○小', template: '' };
    })();
  }

  // 本番の incidentInput_ と同じ：関係図があれば、関係する児童と役割は関係図から決める
  var RL = E.rngOf(5151); // いじめの報告の段階の見本だけに使う乱数
  function demoIncident(x) {
    var dg = x.diagram ? E.normDiagram(x.diagram) : null;
    if (dg && !dg.nodes.length) dg = null;
    return { date: x.date, dateEnd: x.dateEnd || '', detail: String(x.detail || '').slice(0, 5000), type: x.type, title: x.title || '', url: x.url || '', report: x.report ? E_REPORT().norm(x.report) : null, ids: dg ? dg.nodes.map(function (n) { return n.id; }).filter(function (id) { return !E.isUnknown(id); }) : (x.ids || []).slice(), roles: dg ? (function (all) { var o = {}; Object.keys(all).forEach(function (id) { if (!E.isUnknown(id)) o[id] = all[id]; }); return o; })(E.diagramRoles(dg)) : {}, diagram: dg };
  }
  // 事案の関係図の見本：2人以上なら、1人目→2人目の加害の矢印。3人なら2人目と3人目を1つのまとまりにする
  function demoDiagram(ids, R) {
    if (ids.length < 2) return null;
    var nodes = ids.map(function (id, i) { return { id: id, x: 120 + i * 200, y: 120 + (i % 2) * 80 }; });
    // 3人：半分は「1人が2人に」（被害の児童が2人＝様式は2つ）、残りは2人をまとまりにする
    if (ids.length === 3 && R && R() < .5) return { nodes: nodes, groups: [], edges: [{ f: 'k:' + ids[0], t: 'k:' + ids[1] }, { f: 'k:' + ids[0], t: 'k:' + ids[2] }] };
    if (ids.length === 3) return { nodes: nodes, groups: [{ g: 'A', members: [ids[1], ids[2]] }], edges: [{ f: 'k:' + ids[0], t: 'g:A' }] };
    return { nodes: nodes, groups: [], edges: [{ f: 'k:' + ids[0], t: 'k:' + ids[1] }] };
  }
  // 事案の記録の見本：定型文と時間帯で、発覚→経緯→指導の行を作る。いじめには発見のきっかけ・態様、半分に様式Ⅱ用の追記
  function demoReport(type, date, dg, R, pick) {
    var Rp = g.Report, rp = Rp.emptyReport(), L = Rp.slots(), si = Math.floor(R() * 8), d = date;
    var row = function (t) { var r = { d: d, p: L[si % L.length], t: t }; var n = Rp.nextSlot(d, r.p); si = L.indexOf(n.p); d = n.d; return r; };
    var P = C.PHRASES, names = dg ? dg.nodes.filter(function (n) { return !E.isUnknown(n.id); }).map(function (n) { return S.kids[n.id] ? S.kids[n.id].name : ''; }) : [];
    var lead = dg && dg.edges.length ? (function (e) {
      var nm = function (end) { var q = end.split(':'); if (q[0] === 'g') return dg.groups.filter(function (x) { return x.g === q[1]; })[0].members.map(function (id) { return S.kids[id].name; }).join('・'); return E.isUnknown(q[1]) ? '（不明の児童）' : S.kids[q[1]].name; };
      return nm(e.f) + 'が' + nm(e.t);
    })(dg.edges[0]) : (names[0] || '') + 'が';
    // 対応の状況：古い事案ほど解消・指導済みが多い
    var age = (Date.now() - new Date(date).getTime()) / 864e5;
    rp.status = age < 14 ? pick(['open', 'open', 'done']) : age < 90 ? pick(['done', 'watch', 'watch', 'open']) : pick(['closed', 'closed', 'done', 'watch']);
    // 報告済み：いじめで、1週間より前の事案で、対応中でないもの（乱数は使わない＝ほかの見本の値を変えない）
    if (/いじめ/.test(type) && age >= 7 && rp.status !== 'open') rp.reported = Rp.addDays(date, 7);
    rp.s1.hk.push(row(pick(P.hk)));
    rp.s1.kk.push(row(lead + pick(P.kk.slice(0, 11))));
    if (R() < .5) rp.s1.kk.push(row(pick(P.kk.slice(11))));
    rp.s1.sd.push(row(C.SD_STEPS[0]));
    rp.s1.sd.push(row(C.SD_STEPS[1]));
    rp.s1.sd.push(row(R() < .7 ? C.SD_STEPS[3] : pick(P.sd)));
    if (/いじめ/.test(type)) {
      rp.found = pick(C.FOUND_LIST);
      rp.modes[Math.floor(R() * 8)] = true; if (R() < .3) rp.modes[Math.floor(R() * 8)] = true;
      if (R() < .5) {
        d = Rp.addDays(date, 7 + Math.floor(R() * 14)); si = 1;
        rp.s2.sd.push(row(pick(P.s2sd))); rp.s2.ha.push(row(pick(P.ha)));
        var vic = dg ? Object.keys(E.diagramRoles(dg)).filter(function (id) { var r = E.diagramRoles(dg)[id]; return !E.isUnknown(id) && (r === 'victim' || r === 'mutual'); }) : [];
        if (vic.length > 1) vic.forEach(function (id) { rp.s2v[id] = [row(pick(P.vi))]; }); else rp.s2.vi.push(row(pick(P.vi)));
        rp.s2.kikan = pick(P.kikan);
      }
    }
    // いじめの報告の段階：多くは簡易、ときどき様式Ⅰ・Ⅱ、まれに重大事態（別の乱数。ほかの見本の並びを変えない）
    if (/いじめ/.test(type)) { var lv = RL(); rp.level = lv < .55 ? 'light' : lv < .82 ? 'f1' : lv < .97 ? 'f2' : 'grave'; }
    return rp;
  }
  function E_REPORT() { return g.Report; }
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
        transfers: clone(S.transfers[grade] || []),
        scores: clone((S.scores || {})[grade] || {})
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
    setAttr: function (fy, grade, id, k, v, text, incs) { gen();
      var r = yearRows(fy, grade).filter(function (x) { return x.id === id; })[0];
      if (!r) return Promise.reject(new Error('児童が見つかりません'));
      if (k === 'memo') { if (text) r.a.memo = String(text).slice(0, 400); else delete r.a.memo; return later({ ok: true }); }
      if (k === 'sib') { var sb = C.normSibs(text); if (sb.length) r.a.sib = sb; else delete r.a.sib; return later({ ok: true }); }
      if (k === 'sp') { if (v) r.a.sp = 1; else delete r.a.sp; } else r.a[k] = v;
      if (text !== undefined) { if (v && text) r.a[k + '_t'] = String(text).slice(0, 1000); else delete r.a[k + '_t']; }
      if (incs !== undefined) { if (v && incs.length) r.a[k + '_i'] = incs.slice(); else delete r.a[k + '_i']; }
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
    saveDraft: function (grade, d) { S.drafts = S.drafts || {}; S.drafts[grade] = d ? { at: new Date().toISOString(), draft: clone(d) } : null; return later({ ok: true }); },
    loadDraft: function (grade) { return later((S.drafts || {})[grade] || null); },
    // 試行の Excel：選んだ様式の .xlsx（template に入れた中身）を画面の中で開き、本番のサーバーと同じ手順でセルに書き、ダウンロードさせる
    template: null,
    exportReport: function (kind, values, incId, seq) {
      var self = this, R = C.REPORT, Rp = g.Report;
      if (!self.template) return Promise.reject(Object.assign(new Error('様式の Excel（.xlsx）を選んでください'), { noRetry: true }));
      if (!R.sheets[kind]) return Promise.reject(Object.assign(new Error('様式が分かりません'), { noRetry: true }));
      var ok = {}; Rp.allowedCells(kind).forEach(function (c) { ok[c] = 1; });
      var vals = {}; Object.keys(values || {}).forEach(function (ref) { if (ok[ref]) { var v = values[ref]; vals[ref] = typeof v === 'number' && isFinite(v) ? v : String(v).slice(0, 8000); } });
      return g.Zip.read(self.template).then(function (files) {
        var by = {}, dec = new TextDecoder(), enc = new TextEncoder();
        files.forEach(function (f, i) { by[f.name] = i; });
        var text = function (n) { return dec.decode(files[by[n]].data); }, put = function (n, s) { files[by[n]].data = enc.encode(s); };
        if (by['xl/workbook.xml'] == null || by['xl/_rels/workbook.xml.rels'] == null) throw Object.assign(new Error('様式のファイルが読めません'), { noRetry: true });
        var wb = text('xl/workbook.xml'), path = Rp.sheetPath(wb, text('xl/_rels/workbook.xml.rels'), R.sheets[kind]);
        if (!path || by[path] == null) throw Object.assign(new Error('様式のファイルに「' + R.sheets[kind] + '」のシートがありません'), { noRetry: true });
        Object.keys(by).forEach(function (n) { if (/^xl\/worksheets\/[^/]+\.xml$/.test(n)) put(n, Rp.untab(text(n), n === path)); });
        put(path, Rp.fillSheet(text(path), vals));
        put('xl/workbook.xml', Rp.activate(wb, R.sheets[kind]));
        var t = new Date(), p2 = function (n) { return ('0' + n).slice(-2); };
        var name = R.names[kind] + '_事案' + (+incId || 0) + (+seq ? '_被害' + (+seq) : '') + '_' + t.getFullYear() + p2(t.getMonth() + 1) + p2(t.getDate()) + '_' + p2(t.getHours()) + p2(t.getMinutes()) + '.xlsx';
        return { name: name, url: URL.createObjectURL(g.Zip.write(files)), download: true };
      });
    },
    fetchTitle: function (url) { gen();
      return later({ title: /docs\.google\.com/.test(url) ? '（見本）取得した文書の名前' : '' });
    },
    setScores: function (fy, grade, v) { S.scores = S.scores || {}; var g0 = grade - (fy - FY); (S.scores[g0] = S.scores[g0] || {})[fy] = clone(v); return later({ ok: true }); },
    allIncidents: function () { gen(); return later(clone(S.inc)); },
    schoolKids: function () { gen();
      var out = [];
      for (var gr = 1; gr <= 6; gr++) yearRows(FY, gr).forEach(function (r) { var s = S.kids[r.id]; var a = {}; C.ATTRS.forEach(function (at) { if (r.a[at.k]) a[at.k] = r.a[at.k]; }); out.push({ id: r.id, name: s.name, kana: s.kana, male: s.male, grade: gr, cls: r.cls, a: a }); });
      return later(out);
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
      return later(Object.keys(last).filter(function (id) { return !now[id] && C.purgeable(last[id].fy, FY, S.settings.keepYears | 0, !!cnt[id]); }).map(function (id) {
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

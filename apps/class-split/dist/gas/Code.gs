/* apps/class-split/src/ の config.js・engine.js・report.js・server.gs をつないで
   scripts/build.py が作る。正本を直すこと。 */

/* ==================== config.js ==================== */
// 設定の正本。項目の名前・色・形・重み・学級数の上限はここだけで決める。
// 保存データの列は中立のキー（k1〜k9）だけで持ち、名前はここにしか書かない（開示請求への配慮。docs/design.md §4）。
(function (g) {
  'use strict';
  var CONFIG = {
    MAX_CLASSES: 4,   // 1学年の学級数の上限
    CAP: 36,          // 1学級の人数の上限
    NAME_CHARS: 6,    // クラス分けのカードに出す名前の文字数（空白を含む）。全部は名前にカーソルで出る
    PAIR_TAGS: ['家庭希望', '担任判断', '前担任から', '事案による', '学年で協議', '管理職の判断'], // つける・離すの定型の理由
    // 備考の定型の言葉（選ぶと備考の入力欄に入る）
    MEMO_PICKS: [
      { label: '発達特性', items: ['自閉症', '自閉傾向', 'ADHD傾向', 'LD傾向', '感覚過敏', 'こだわりが強い', '切り替えが苦手'] },
      { label: '性分', items: ['ぼーっとしている', '優しい', '世話焼き', 'おとなしい', '活発', '負けず嫌い', '気分の波がある', '人見知り', 'まじめ'] },
      { label: '身辺整理', items: ['忘れ物が多い', '提出物△', '整理整頓が苦手', '時間を守るのが苦手', '身支度に時間がかかる'] },
      { label: '対人', items: ['友達が少ない', '一人でいることが多い', '手が出やすい', '言葉がきつい', 'リーダー格', '頼まれると断れない'] }
    ],
    MAX_LEVEL: 2,     // 配慮項目の程度：0＝なし、1＝アイコン、2＝アイコン＋。max: 1 の項目（ア・身・通・賢・リ・運）は有無だけ

    // 配慮項目。good=1 は良い要素（カードの1段目・緑）。w は重みの既定段階（0なし〜3強）。既定：強＝学力・賢い・男女・旧学級／中＝問・欠・保・走／弱＝その他／無＝地区・身・ア
    // help：カーソルを合わせると出す説明［見出し, アイコン, アイコン＋］（max: 1 は［見出し, アイコン］）。side：カードの2段目の右（良い項目の下）に置く。ctx：経緯の文と事案の紐付けを持つ（角の窓で書く）。負担の項目の＋は「＋2つ分」ではなく、担任の負担が明確に増えることを表す
    ATTRS: [
      { k: 'k1', label: '学力しんどさ', s: '学', c: '#1E6FD9', t: '#FFFFFF', sh: 'square',   w: 3, heavy: 1, ctx: 1, max: 2, help: ['学力のしんどさ', '学習の遅れがある。', '遅れが大きい。個別の手立てがいつも要る。'] },
      { k: 'k2', label: '長欠・不登校傾向', s: '欠', c: '#1A1A1A', t: '#FFFFFF', sh: 'circle',   w: 2, heavy: 1, ctx: 1, max: 2, help: ['長欠・不登校傾向', '欠席・遅刻・早退が多い。', '長期欠席、または不登校。'] },
      { k: 'k3', label: '問題行動',     s: '問', c: '#D7263D', t: '#FFFFFF', sh: 'burst',    w: 2, heavy: 1, ctx: 1, max: 2, help: ['問題行動、トラブル', '多い。', 'とても多い。または深刻。'] },
      { k: 'k4', label: '保護者',       s: '保', c: '#F2C200', t: '#1A1A1A', sh: 'house',    w: 2, heavy: 1, ctx: 1, max: 2, help: ['保護者対応', '連絡・相談が多い。', '対応にとても時間がかかる。または関係づくりが難しい。'] },
      { k: 'k5', label: 'アレルギー',   s: 'ア', c: '#7B3FA0', t: '#FFFFFF', sh: 'octagon',  w: 0, max: 1, side: 1, help: ['アレルギー', '配慮の要るアレルギーがある（エピペンの所持を含む）。'] },
      { k: 'k6', label: '身体的配慮',   s: '身', c: '#7B3FA0', t: '#FFFFFF', sh: 'shield',   w: 0, max: 1, side: 1, help: ['身体的配慮', '体や健康の面で配慮が要る。'] },
      { k: 'k10', label: '通級・要支援', s: '通', c: '#7B3FA0', t: '#FFFFFF', sh: 'shell',    w: 1, max: 1, side: 1, help: ['通級・要支援', '通級や支援を受けている。'] },
      { k: 'k7', label: '賢い',         s: 'か', c: '#009E73', t: '#FFFFFF', sh: 'plain',    w: 3, good: 1, max: 1, help: ['賢い', '学力が高い。'] },
      { k: 'k8', label: 'リーダー',     s: 'リ', c: '#009E73', t: '#FFFFFF', sh: 'crown',    w: 1, good: 1, max: 1, help: ['リーダー', 'まとめる力がある。'] },
      { k: 'k9', label: '走力',         s: '走', c: '#009E73', t: '#FFFFFF', sh: 'para',     w: 2, good: 1, max: 1, help: ['走力（走る速さ）', '走るのが速い。'] }
    ],
    // 配慮項目以外の偏りの指標。w は重みの既定段階
    EXTRA: [
      { k: 'sex',  label: '男女',   s: '男女', w: 3 },
      { k: 'old',  label: '旧学級', s: '旧',   w: 3 },
      { k: 'area', label: '地区',   s: '地区', w: 0 },
      { k: 'inc',  label: '事案数', s: '事案', w: 1 }  // 0にすると案を作る条件に入れない
    ],
    // 段階 → 計算に使う重み
    LEVEL_W: [0, 1, 2.5, 5, 5],
    LEVEL_NAMES: ['無', '弱', '中', '強', '必'],
    MUST: 4,          // 「必」の段階：各組の人数を平均±1に収めることを必ず守る条件にする（重みは強と同じ）
    MUST_WARN: '「必」は必ず守る条件になります。ほかの条件（離す・つける・男女・負担の＋など）と両立できないと、案が条件を守れなかったり、ほかの偏りが大きくなったりします。必要な項目だけにしてください。',
    // 必ず守る条件（設定の枠でオン・オフ）
    HARD: [
      { k: 'far',  label: '離す' },
      { k: 'near', label: 'つける' },
      { k: 'fix',  label: '組に固定' },
      { k: 'heavy', label: '負担の＋を組に分ける' }, // heavy の項目の＋は、担任の負担が明確に増える印なので人数で分ける
      { k: 'cap',  label: '人数の上限' },
      { k: 'sex',  label: '男女の差±1' }
    ],
    // 旧学級の色：c＝帯 t＝帯の文字 l＝カードの地。赤1組・黄2組・青3組・緑4組
    CLASS_COLORS: [
      { c: '#D7263D', t: '#FFFFFF', l: '#FCE6E8' },
      { c: '#F2C200', t: '#1A1A1A', l: '#FFF5CC' },
      { c: '#1E6FD9', t: '#FFFFFF', l: '#E3EEFC' },
      { c: '#2E9E4F', t: '#FFFFFF', l: '#E2F3E7' }
    ],
    AREAS: ['東', '西', '南', '北'],
    INCIDENT_TYPES: ['対人', '物損', 'いじめ', 'けが', 'その他'],
    // 事案の記録の時間帯（学校の時程）。設定で並びと名前を変えられる
    TIME_SLOTS: ['朝休み', '1校時', '2校時', '中休み', '3校時', '4校時', '給食', '昼休み', '掃除', '5校時', '6校時', '放課後'],
    // 記録の欄の定型文（押すと、選んでいる行に入る）。欄：hk 発覚・kk 経緯・sd 指導・s2sd 指導の経過・vi 被害の様子・ha 加害の様子・kikan 関係機関
    PHRASES: {
      hk: ['本人から訴えがあった', '保護者から連絡があった', '他の児童から報告があった', '担任が現認した', '他の教職員が現認した', 'アンケートで分かった', '連絡帳に書かれていた'],
      kk: ['悪口を言った', 'からかった', '叩いた', '蹴った', '押した', '物を隠した', '物を壊した', '仲間外れにした', '無視した', 'SNSに書き込んだ', '言い合いになった', 'つかみ合いになった'],
      sd: ['双方から聴き取りをした', '本人から聴き取りをした', '周りの児童から聴き取りをした', '加害児童に指導した', '双方に指導した', '謝罪の場を設けた', '互いに謝った', '保護者に電話で伝えた', '保護者に来校してもらい伝えた', '家庭訪問をした', '学年で共有した', '管理職に報告した', 'いじめ対応チームを招集した', '見守りを続けることにした'],
      s2sd: ['経過を聴き取った', '再度指導した', '保護者に経過を伝えた', 'いじめ対応チームで経過を確認した', '見守りを続けている'],
      vi: ['元気に過ごしている', '落ち着いて登校している', '加害児童とも普通に関わっている', '不安を訴えている', '保護者は了承している', '保護者は経過の見守りを希望している'],
      ha: ['反省している', '謝罪した', '同じことはしないと約束した', '保護者も謝罪の意向を示した', '保護者から家庭でも指導したと連絡があった'],
      kikan: ['スクールカウンセラー', 'スクールソーシャルワーカー', '子ども家庭センター', '少年サポートセンター', '警察', '医療機関', 'なし']
    },
    // ===== 市教委への報告書（いじめ認知報告書）=====
    // 選択肢と文言は様式（R08）の入力規則と同じ。様式が変わったらここと REPORT のセルの番地を直す
    FOUND_LIST: ['学級担任が発見した', '学級担任以外の教職員が発見した', '養護教諭が発見した', 'スクールカウンセラー等の相談員が発見した', 'アンケート調査など学校の取組により発見した', '本人からの訴え', '当該児童生徒（本人）の保護者からの訴え', '児童生徒（本人を除く。）からの情報', '保護者（本人の保護者を除く。）からの情報', '地域の住民からの情報', '学校以外の関係機関（相談機関を含む。）からの情報', 'その他（匿名の投書など）'],
    // いじめの態様（複数選択）。cell は ○ を書くセル
    MODES: [
      { t: '冷やかし・からかい・悪口や脅し文句、嫌なことを言われる', cell: 'B22' },
      { t: '仲間外れ、集団による無視をされる', cell: 'H22' },
      { t: '軽くぶつかられたり、遊ぶふりをしてたたかれたり、蹴られたりする', cell: 'B23' },
      { t: 'ひどくぶつかられたりたたかれたり、蹴られたりする', cell: 'H23' },
      { t: '金品をたかられる', cell: 'B24' },
      { t: '金品を隠されたり、盗まれたり、壊されたり、捨てられたりする', cell: 'H24' },
      { t: '嫌なことや恥ずかしいこと、危険なことをされたり、させられたりする', cell: 'B25' },
      { t: 'パソコンや携帯電話等で、ひぼう・中傷や嫌なことをされる', cell: 'H25' },
      { t: '性的な嫌がらせや性的な行為をされる（卑猥な言葉・身体を触る・性的な動画や画像の撮影・送信など）', cell: 'B26' },
      { t: 'その他', cell: 'I26' }
    ],
    // 様式のシート名と、書くセルの番地。head は3つの様式で共通の頭の部分
    REPORT: {
      sheets: { light: '簡易報告書', f1: '様式Ⅰ', f2: '様式Ⅱ' },
      names: { light: '簡易報告書', f1: '様式Ⅰ', f2: '様式Ⅱ' },
      head: { school: 'B4', era: 'C5', month: 'E5', day: 'G5', wday: 'I5', victim: 6 }, // victim：被害の児童の行（学年B・組D・性別G・ふりがなI、名前は次の行のI）
      harmRows: [8, 10, 12, 14, 16, 18], harmMore: 'B20', // 加害の児童（簡易・様式Ⅰ）。7人目からは人数だけ
      found: 'B21', modeOther: 'K26',
      f1: { gaiyou: 'B27' },
      f2: { shido: 'B8', victim: 'B26', harm: 'B32', kikan: 'B38' }
    },
    TEACHER_DOMAIN: 'edu.nishi.or.jp'
  };

  // 年度の境目は4/1。年度に関わる値はすべてこの関数から出す（principles/roster-year-transition.md §1）
  CONFIG.fiscalYear = function (date) {
    var d = date || new Date();
    return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  };
  CONFIG.fiscalYearOfIso = function (iso) {
    var p = String(iso).split('-');
    var y = +p[0], m = +p[1];
    return m >= 4 ? y : y - 1;
  };

  // 新しい組（クラス分けの枠）の名前。番号は決定の後に別の操作で決める（それまでは A組＝1組 の仮）
  CONFIG.newClass = function (k) { return String.fromCharCode(65 + k) + '組'; };

  // 卒業・転出の後に残す年数。既定は5年度（利用者の方針）。事案に関わった児童は、設定にかかわらず5年度は消さない
  // （いじめ等の記録の保存の目安。正本は教育委員会の文書管理規程。docs/design.md §4）
  CONFIG.KEEP_YEARS_DEFAULT = 5;
  CONFIG.INCIDENT_KEEP_YEARS = 5;
  // 最後に名簿にいた年度 lastFy の児童を、今年度 FY に消してよいか
  CONFIG.purgeable = function (lastFy, FY, keep, hasIncident) {
    return FY > lastFy + (hasIncident ? Math.max(keep, CONFIG.INCIDENT_KEEP_YEARS) : keep);
  };

  g.CONFIG = CONFIG;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ==================== engine.js ==================== */
// 計算の正本。画面にもサーバーにも依存しない純粋な関数だけを置く（tests/engine.test.mjs が直接読む）。
// 用語: asg＝案の割り当て（児童の並び順 i → 新しい組 0..nc-1）。kids[i].old＝旧学級（0始まり）。
(function (g) {
  'use strict';
  var C = g.CONFIG;
  var W_HARD = 1000;   // 必ず守る条件1件あたり
  var W_SIZE = 40;     // 人数の偏り（常に効く）
  var W_CAP = 1e5;     // 上限超え1人あたり（必ず守る条件がオンのとき）

  function rngOf(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // 案を作る設定の既定値。重みは段階（0〜3）、必ず守る条件は真偽
  function defaultGen() {
    var w = {};
    C.ATTRS.forEach(function (at) { w[at.k] = at.w; });
    C.EXTRA.forEach(function (ex) { w[ex.k] = ex.w; });
    var hard = {};
    C.HARD.forEach(function (h) { hard[h.k] = true; });
    return { w: w, hard: hard };
  }

  // P: { kids:[{id,male,old,a,area}], pairs:[{t:'far'|'near',i,j}|{t:'fix',i,k}], inc:[{kids:[i]}], nc }
  function prepare(P, gen) {
    gen = gen || defaultGen();
    var N = P.kids.length, nc = P.nc;
    var oldN = 0;
    P.kids.forEach(function (s) { if (s.old + 1 > oldN) oldN = s.old + 1; });
    var MET = [];
    MET.push({ k: 'sex', label: '男', w: C.LEVEL_W[gen.w.sex | 0], tol: 1, v: function (s) { return s.male ? 1 : 0; } });
    C.ATTRS.forEach(function (at) {
      // 程度は足さず「いるか」で数える（heavy の項目の＋は下の別枠で数える）
      MET.push({ k: at.k, label: at.s, w: C.LEVEL_W[gen.w[at.k] | 0], tol: 1, at: at, v: function (s) { return (s.a[at.k] | 0) ? 1 : 0; } });
    });
    for (var o = 0; o < oldN; o++) (function (o) {
      MET.push({ k: 'old' + o, grp: 'old', label: '旧' + (o + 1), w: C.LEVEL_W[gen.w.old | 0], tol: 2, v: function (s) { return s.old === o ? 1 : 0; } });
    })(o);
    C.AREAS.forEach(function (ar) {
      MET.push({ k: 'area' + ar, grp: 'area', label: ar, w: C.LEVEL_W[gen.w.area | 0], tol: 2, v: function (s) { return s.area === ar ? 1 : 0; } });
    });
    // ＋（程度2）：＋はアイコン2つ分ではなく、担任の負担が明確に増える印。項目ごとと、4項目のどれかが＋の児童の人数。必ず守る条件で各組の上限（均等割の切り上げ）を超えさせない
    var heavyAt = C.ATTRS.filter(function (at) { return at.heavy; });
    heavyAt.forEach(function (at) {
      MET.push({ k: at.k + '++', grp: 'heavy', label: at.s + '＋', w: C.LEVEL_W[gen.w[at.k] | 0], tol: 1, v: function (s) { return (s.a[at.k] | 0) >= 2 ? 1 : 0; } });
    });
    MET.push({ k: 'heavy', grp: 'heavy', label: '＋の児童', w: C.LEVEL_W[3], tol: 1, v: function (s) { return heavyAt.some(function (at) { return (s.a[at.k] | 0) >= 2; }) ? 1 : 0; } });
    var M = MET.length;
    var VAL = P.kids.map(function (s) { return MET.map(function (m) { return m.v(s); }); });
    var MEAN = MET.map(function (m, mi) { var t = 0; for (var i = 0; i < N; i++) t += VAL[i][mi]; return t / nc; });
    var relOf = P.kids.map(function () { return []; });
    P.pairs.forEach(function (p, pi) {
      if (p.t === 'fix') { relOf[p.i].push(pi); return; }
      relOf[p.i].push(pi); relOf[p.j].push(pi);
    });
    var incOfKid = P.kids.map(function () { return []; });
    (P.inc || []).forEach(function (x, xi) { x.kids.forEach(function (i) { incOfKid[i].push(xi); }); });
    // 「必」の段階の指標（＋の別枠は除く）。各組を平均±1に収めることを必ず守る
    var MU = [];
    MET.forEach(function (m, mi) { if (m.grp !== 'heavy' && (gen.w[m.grp || m.k] | 0) === C.MUST) MU.push(mi); });
    var HV = [];
    MET.forEach(function (m, mi) { if (m.grp === 'heavy') HV.push({ m: mi, max: Math.ceil(MEAN[mi] - 1e-9) }); });
    return { P: P, N: N, nc: nc, cap: P.cap || C.CAP, M: M, MET: MET, VAL: VAL, MEAN: MEAN, SIZE_MEAN: N / nc, HV: HV, MU: MU,
      relOf: relOf, incOfKid: incOfKid, gen: gen, wInc: C.LEVEL_W[gen.w.inc | 0] };
  }

  function counts(ctx, asg) {
    var c = [], k, i, m;
    for (k = 0; k < ctx.nc; k++) c.push(new Float64Array(ctx.M + 1));
    for (i = 0; i < ctx.N; i++) {
      var r = c[asg[i]], v = ctx.VAL[i];
      r[ctx.M]++;
      for (m = 0; m < ctx.M; m++) r[m] += v[m];
    }
    return c;
  }

  // 違反の判定は1か所に置く（画面の表示と計算で食い違わないように）
  function pairBroken(p, asg) {
    if (p.t === 'far') return asg[p.i] === asg[p.j];
    if (p.t === 'near') return asg[p.i] !== asg[p.j];
    return asg[p.i] !== p.k; // fix
  }
  function hardPairViol(ctx, asg) {
    var n = 0, h = ctx.gen.hard;
    ctx.P.pairs.forEach(function (p) { if (h[p.t] && pairBroken(p, asg)) n++; });
    return n;
  }

  // 組の事案数：同じ事案に同じ組の児童が複数いても1件と数える
  function incByClass(ctx, asg) {
    var v = new Array(ctx.nc).fill(0);
    (ctx.P.inc || []).forEach(function (x) {
      var seen = {};
      x.kids.forEach(function (i) { var k = asg[i]; if (!seen[k]) { seen[k] = 1; v[k]++; } });
    });
    return v;
  }
  // 事案数は児童ごとの足し算にならないので別に計算する。重みが0の間は計算しない
  function incPenalty(ctx, asg) {
    if (!ctx.wInc) return 0;
    var v = incByClass(ctx, asg), m = 0, t = 0, k;
    for (k = 0; k < v.length; k++) m += v[k];
    m /= v.length;
    for (k = 0; k < v.length; k++) t += (v[k] - m) * (v[k] - m);
    return ctx.wInc * t;
  }

  function balance(ctx, c) {
    var t = 0, h = ctx.gen.hard, k, m;
    for (k = 0; k < ctx.nc; k++) {
      var r = c[k];
      for (m = 0; m < ctx.M; m++) { var d = r[m] - ctx.MEAN[m]; t += ctx.MET[m].w * d * d; }
      var ds = r[ctx.M] - ctx.SIZE_MEAN; t += W_SIZE * ds * ds;
      if (h.cap && r[ctx.M] > ctx.cap) t += W_CAP * (r[ctx.M] - ctx.cap);
      if (h.sex) { var ex = Math.abs(r[0] - ctx.MEAN[0]) - 1; if (ex > 0) t += W_HARD * ex; }
      for (var u = 0; u < ctx.MU.length; u++) { var eu = Math.abs(r[ctx.MU[u]] - ctx.MEAN[ctx.MU[u]]) - 1; if (eu > 0) t += W_HARD * eu; }
      if (h.heavy) for (var q = 0; q < ctx.HV.length; q++) { var eh = r[ctx.HV[q].m] - ctx.HV[q].max; if (eh > 0) t += W_HARD * eh; }
    }
    return t;
  }

  function score(ctx, asg) {
    return W_HARD * hardPairViol(ctx, asg) + balance(ctx, counts(ctx, asg)) + incPenalty(ctx, asg);
  }

  // 案を作る：固定（locked: Map i→組）と「組に固定」を守り、残りを焼きなましで入れ替える
  function optimize(ctx, locked, seed) {
    var r = rngOf(seed), N = ctx.N, nc = ctx.nc, M = ctx.M;
    var lock = new Map(locked || []);
    if (ctx.gen.hard.fix) ctx.P.pairs.forEach(function (p) { if (p.t === 'fix' && p.k < nc) lock.set(p.i, p.k); });
    var asg = new Int8Array(N), free = [], sz = new Array(nc).fill(0), i, j, k;
    for (i = 0; i < N; i++) { if (lock.has(i)) { asg[i] = lock.get(i); sz[asg[i]]++; } else free.push(i); }
    for (i = free.length - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); var tmp = free[i]; free[i] = free[j]; free[j] = tmp; }
    free.forEach(function (i) { var b = 0; for (var k = 1; k < nc; k++) if (sz[k] < sz[b]) b = k; asg[i] = b; sz[b]++; });
    if (free.length < 2) return asg;
    var c = counts(ctx, asg), pv = hardPairViol(ctx, asg);
    var cur = W_HARD * pv + balance(ctx, c) + incPenalty(ctx, asg);
    var IT = 50000, T = 8, cool = Math.pow(0.002 / 8, 1 / IT);
    for (var it = 0; it < IT; it++, T *= cool) {
      i = free[Math.floor(r() * free.length)]; j = free[Math.floor(r() * free.length)];
      var a = asg[i], b = asg[j];
      if (a === b) continue;
      var vi = ctx.VAL[i], vj = ctx.VAL[j], m, d;
      for (m = 0; m < M; m++) { d = vj[m] - vi[m]; c[a][m] += d; c[b][m] -= d; }
      asg[i] = b; asg[j] = a;
      var npv = (ctx.relOf[i].length || ctx.relOf[j].length) ? hardPairViol(ctx, asg) : pv;
      var nxt = W_HARD * npv + balance(ctx, c) + (ctx.wInc ? incPenalty(ctx, asg) : 0);
      if (nxt <= cur || r() < Math.exp((cur - nxt) / T)) { cur = nxt; pv = npv; }
      else { asg[i] = a; asg[j] = b; for (m = 0; m < M; m++) { d = vj[m] - vi[m]; c[a][m] -= d; c[b][m] += d; } }
    }
    return asg;
  }

  // 画面に出す違反（✕）と偏り（△）
  function analyze(ctx, asg) {
    var c = counts(ctx, asg), bad = [], warn = [], kids = ctx.P.kids, k, m;
    ctx.P.pairs.forEach(function (p) {
      if (!pairBroken(p, asg)) return;
      if (p.t === 'far') bad.push({ t: 'far', txt: '離す：' + kids[p.i].name + ' と ' + kids[p.j].name + ' が同じ' + C.newClass(asg[p.i]), ids: [p.i, p.j] });
      else if (p.t === 'near') bad.push({ t: 'near', txt: 'つける：' + kids[p.i].name + '（' + C.newClass(asg[p.i]) + '）と ' + kids[p.j].name + '（' + C.newClass(asg[p.j]) + '）が別', ids: [p.i, p.j] });
      else bad.push({ t: 'fix', txt: '組に固定：' + kids[p.i].name + ' が' + C.newClass(p.k) + 'でない', ids: [p.i] });
    });
    var flag = [];
    for (k = 0; k < ctx.nc; k++) {
      flag.push(new Array(ctx.M + 1).fill(false));
      if (c[k][ctx.M] > ctx.cap) { flag[k][ctx.M] = true; bad.push({ t: 'cap', txt: C.newClass(k) + ' ' + c[k][ctx.M] + '人（上限' + ctx.cap + '人）', ids: [] }); }
      else if (Math.abs(c[k][ctx.M] - ctx.SIZE_MEAN) > 1) { flag[k][ctx.M] = true; warn.push({ txt: C.newClass(k) + ' 人数 ' + c[k][ctx.M] + '（平均' + ctx.SIZE_MEAN.toFixed(1) + '）', k: k, m: ctx.M }); }
      ctx.HV.forEach(function (hv) {
        if (c[k][hv.m] > hv.max) { flag[k][hv.m] = true; bad.push({ t: 'heavy', txt: C.newClass(k) + ' ' + ctx.MET[hv.m].label + ' ' + c[k][hv.m] + '人（各組' + hv.max + '人まで）', ids: [] }); }
      });
      ctx.MU.forEach(function (mi) {
        if (Math.abs(c[k][mi] - ctx.MEAN[mi]) > 1) { flag[k][mi] = true; bad.push({ t: 'must', txt: C.newClass(k) + ' ' + ctx.MET[mi].label + ' ' + c[k][mi] + '人（必：平均' + ctx.MEAN[mi].toFixed(1) + '±1）', ids: [] }); }
      });
      for (m = 0; m < ctx.M; m++) if (ctx.MET[m].grp !== 'heavy' && ctx.MU.indexOf(m) < 0 && Math.abs(c[k][m] - ctx.MEAN[m]) > ctx.MET[m].tol) {
        flag[k][m] = true;
        warn.push({ txt: C.newClass(k) + ' ' + ctx.MET[m].label + ' ' + c[k][m] + '（平均' + ctx.MEAN[m].toFixed(1) + '）', k: k, m: m });
      }
    }
    return { c: c, bad: bad, warn: warn, flag: flag, inc: incByClass(ctx, asg) };
  }

  function spread(c, m) {
    var lo = Infinity, hi = -Infinity;
    c.forEach(function (r) { if (r[m] < lo) lo = r[m]; if (r[m] > hi) hi = r[m]; });
    return hi - lo;
  }

  // 学級名は入れ替え可能なので、組の並べ替えを全通り試して最小の差を出す（最大4学級＝24通り）
  function perms(n) {
    var out = [];
    (function rec(a, rest) {
      if (!rest.length) { out.push(a); return; }
      rest.forEach(function (x, i) { rec(a.concat([x]), rest.slice(0, i).concat(rest.slice(i + 1))); });
    })([], Array.from({ length: n }, function (_, i) { return i; }));
    return out;
  }
  function diffCount(ctx, a, b) {
    var best = ctx.N;
    perms(ctx.nc).forEach(function (pm) {
      var d = 0;
      for (var i = 0; i < ctx.N; i++) if (pm[a[i]] !== b[i]) d++;
      if (d < best) best = d;
    });
    return best;
  }

  // ===== 入れ替え =====
  // 「つける」の相手が同じ組にいれば一緒に動かす
  function nearGroup(ctx, asg, i) {
    var gp = [i], k = asg[i];
    for (var q = 0; q < gp.length; q++) ctx.relOf[gp[q]].forEach(function (pi) {
      var p = ctx.P.pairs[pi];
      if (p.t !== 'near') return;
      var o = p.i === gp[q] ? p.j : p.i;
      if (asg[o] === k && gp.indexOf(o) < 0) gp.push(o);
    });
    return gp;
  }
  // 実行後に新しく同じ組になる「離す」
  function farBreaks(ctx, asg, changes) {
    var after = Int8Array.from(asg);
    changes.forEach(function (x) { after[x[0]] = x[1]; });
    return ctx.P.pairs.filter(function (p) {
      return p.t === 'far' && after[p.i] === after[p.j] && asg[p.i] !== asg[p.j];
    });
  }
  // 離す相手のうち、動かなかった側（続けて入れ替える児童）
  function farTargets(breaks, changes) {
    var moved = {};
    changes.forEach(function (x) { moved[x[0]] = 1; });
    var out = [];
    breaks.forEach(function (p) {
      var t = moved[p.i] && !moved[p.j] ? p.j : p.i;
      if (out.indexOf(t) < 0) out.push(t);
    });
    return out;
  }
  function sizeOf(asg, k) { var n = 0; for (var i = 0; i < asg.length; i++) if (asg[i] === k) n++; return n; }

  function buildSwap(ctx, asg, locks, a, b) {
    var ka = asg[a], kb = asg[b];
    var GA = nearGroup(ctx, asg, a), GB = nearGroup(ctx, asg, b);
    var hit = GA.concat(GB).filter(function (i) { return locks.has(i); });
    if (hit.length) return { err: ctx.P.kids[hit[0]].name + ' は固定しています。先に固定を外してください（L）' };
    var d = { type: 'swap', ka: ka, kb: kb, GA: GA, GB: GB, extraSide: null, cands: [], ci: 0, cnt: 0 };
    var need = GA.length - GB.length;
    if (need !== 0) {
      // 少ない側の組から、偏りが最も小さくなる児童を自動で補う
      var side = need > 0 ? 'B' : 'A', k = need > 0 ? kb : ka, base = need > 0 ? GB : GA, other = need > 0 ? GA : GB;
      var to = k === kb ? ka : kb, pool = [];
      for (var i = 0; i < ctx.N; i++)
        if (asg[i] === k && base.indexOf(i) < 0 && !locks.has(i) && nearGroup(ctx, asg, i).length === 1) pool.push(i);
      var sc = function (i) {
        var t = Int8Array.from(asg);
        other.forEach(function (x) { t[x] = k; });
        base.concat([i]).forEach(function (x) { t[x] = to; });
        return score(ctx, t);
      };
      d.cands = pool.map(function (i) { return [i, sc(i)]; }).sort(function (x, y) { return x[1] - y[1]; }).map(function (x) { return x[0]; });
      d.extraSide = side; d.cnt = Math.abs(need);
      if (d.cands.length < d.cnt) return { err: '一緒に動かせる児童が足りません' };
    }
    return d;
  }
  function swapChanges(d) {
    var ex = d.extraSide ? d.cands.slice(d.ci, d.ci + d.cnt) : [];
    var A = d.extraSide === 'A' ? d.GA.concat(ex) : d.GA, B = d.extraSide === 'B' ? d.GB.concat(ex) : d.GB;
    var ch = A.map(function (i) { return [i, d.kb]; }).concat(B.map(function (i) { return [i, d.ka]; }));
    return { A: A, B: B, ex: ex, ch: ch };
  }
  function nextCandidate(d) {
    var n = Math.floor(d.cands.length / d.cnt) * d.cnt;
    d.ci = (d.ci + d.cnt) % n;
  }
  function buildMove(ctx, asg, locks, a, k) {
    var G = nearGroup(ctx, asg, a);
    var hit = G.filter(function (i) { return locks.has(i); });
    if (hit.length) return { err: ctx.P.kids[hit[0]].name + ' は固定しています。先に固定を外してください（L）' };
    return { type: 'move', ka: asg[a], kb: k, GA: G, ch: G.map(function (i) { return [i, k]; }) };
  }

  // ===== 案の名前 =====
  // 既定より重みを上げた項目を上位2つまで「○・○の分散重視」とし、固定人数と外した必ず守る条件を足す
  function autoName(gen, lockCount) {
    var def = defaultGen(), ups = [], parts = [];
    C.ATTRS.concat(C.EXTRA).forEach(function (x) {
      var dv = (gen.w[x.k] | 0) - (def.w[x.k] | 0);
      if (dv > 0) ups.push({ s: x.s, dv: dv, lv: gen.w[x.k] | 0 });
    });
    ups.sort(function (a, b) { return b.dv - a.dv || b.lv - a.lv; });
    if (ups.length) parts.push(ups.slice(0, 2).map(function (u) { return u.s; }).join('・') + 'の分散重視');
    var off = C.HARD.filter(function (h) { return !gen.hard[h.k]; }).map(function (h) { return h.label; });
    if (off.length) parts.push(off.join('・') + 'を外す');
    if (lockCount) parts.push('固定' + lockCount + '人');
    return parts.length ? parts.join('・') : '標準';
  }
  function genSummary(gen) {
    return C.ATTRS.concat(C.EXTRA).map(function (x) { return x.s + C.LEVEL_NAMES[gen.w[x.k] | 0][0]; }).join(' ');
  }

  // ===== 決定 =====
  // 新しい番号：組ごとに男女混合の五十音順（読みが同じなら児童ID順）
  function assignNumbers(kids, asg, nc) {
    var out = kids.map(function () { return null; });
    for (var k = 0; k < nc; k++) {
      var ids = [];
      for (var i = 0; i < kids.length; i++) if (asg[i] === k) ids.push(i);
      ids.sort(function (x, y) {
        return String(kids[x].kana || '').localeCompare(String(kids[y].kana || ''), 'ja') || (kids[x].id < kids[y].id ? -1 : 1);
      });
      ids.forEach(function (i, n) { out[i] = { cls: k, no: n + 1 }; });
    }
    return out;
  }
  // 決定で作る次の年度の行。配慮項目の値は今年度の値を写す（以後は次の年度の側を直す）
  function nextYearRows(kids, asg, nc) {
    var num = assignNumbers(kids, asg, nc);
    return kids.map(function (s, i) {
      var a = {};
      C.ATTRS.forEach(function (at) { a[at.k] = s.a[at.k] | 0; if ((at.side || at.ctx) && s.a[at.k + '_t']) a[at.k + '_t'] = s.a[at.k + '_t']; if (at.ctx && s.a[at.k + '_i']) a[at.k + '_i'] = s.a[at.k + '_i'].slice(); });
      if (s.a.sp) a.sp = 1;
      if (s.a.memo) a.memo = s.a.memo;
      return { id: s.id, cls: num[i].cls, no: num[i].no, a: a };
    });
  }

  // ===== 事案の関係図 =====
  // d = { v:1, nodes:[{id,x,y}], groups:[{g:'A', members:[id]}], edges:[{f:'k:ID'|'g:A', t:同じ}] }
  // 矢印は「加害」を表す。座標は 640×320 の論理座標。児童は1つのグループにだけ入る
  var DG_W = 640, DG_H = 320;
  function normDiagram(d) {
    d = d || {};
    var ids = {}, nodes = [], gs = {}, groups = [], edges = [], seen = {};
    (d.nodes || []).forEach(function (n) {
      var id = String(n && n.id || ''); if (!id || ids[id]) return;
      ids[id] = 1;
      nodes.push({ id: id, x: Math.max(0, Math.min(DG_W, +n.x || 0)), y: Math.max(0, Math.min(DG_H, +n.y || 0)) });
    });
    var inGroup = {};
    (d.groups || []).forEach(function (gr) {
      var g = String(gr && gr.g || '').slice(0, 4); if (!g || gs[g]) return;
      var m = (gr.members || []).map(String).filter(function (id) { return ids[id] && !inGroup[id]; });
      if (!m.length) return;
      m.forEach(function (id) { inGroup[id] = g; });
      gs[g] = 1; groups.push({ g: g, members: m });
    });
    var ok = function (e) { var p = String(e || '').split(':'); return p.length === 2 && (p[0] === 'k' ? !!ids[p[1]] : p[0] === 'g' && !!gs[p[1]]); };
    (d.edges || []).forEach(function (e) {
      if (!e || !ok(e.f) || !ok(e.t) || e.f === e.t) return;
      var key = e.f + '>' + e.t; if (seen[key]) return;
      seen[key] = 1; edges.push({ f: String(e.f), t: String(e.t) });
    });
    return { v: 1, nodes: nodes, groups: groups, edges: edges };
  }
  function dgMembers(d, end) {
    var p = end.split(':');
    if (p[0] === 'k') return [p[1]];
    var gr = d.groups.filter(function (x) { return x.g === p[1]; })[0];
    return gr ? gr.members.slice() : [];
  }
  // 児童ごとの役割：矢印を出す＝加害、受ける＝被害、両方＝相互、矢印に関わらない＝関係者。グループの矢印は中の全員に効く
  function diagramRoles(d) {
    d = normDiagram(d);
    var out = {}, inn = {}, r = {};
    d.edges.forEach(function (e) {
      dgMembers(d, e.f).forEach(function (id) { out[id] = 1; });
      dgMembers(d, e.t).forEach(function (id) { inn[id] = 1; });
    });
    d.nodes.forEach(function (n) { r[n.id] = out[n.id] && inn[n.id] ? 'mutual' : out[n.id] ? 'harm' : inn[n.id] ? 'victim' : 'related'; });
    return r;
  }
  // 型：相互加害（どこかで向きが両方）か一方的加害か。一方的は、グループの矢印があるか・矢印が2本以上か（複線）で分ける
  function diagramPattern(d) {
    d = normDiagram(d);
    if (!d.edges.length) return '';
    var roles = diagramRoles(d), mutual = Object.keys(roles).some(function (id) { return roles[id] === 'mutual'; });
    var grp = d.edges.some(function (e) { return e.f.charAt(0) === 'g' || e.t.charAt(0) === 'g'; }), multi = d.edges.length > 1;
    if (mutual) return '相互加害' + (grp ? '（グループ）' : '');
    return '一方的加害（' + (grp && multi ? 'グループ・複線' : grp ? 'グループ' : multi ? '複線' : '個人') + '）';
  }
  var ROLE_NAMES = { harm: '加害', victim: '被害', mutual: '相互', related: '関係者' };

  // ===== 不変条件 =====
  function checkInvariants(ctx, asg) {
    var errs = [];
    if (asg.length !== ctx.N) errs.push('割り当ての人数が名簿と違う');
    for (var i = 0; i < asg.length; i++) if (!(asg[i] >= 0 && asg[i] < ctx.nc)) { errs.push('組に入っていない児童がいる：' + i); break; }
    return errs;
  }

  g.Engine = {
    rngOf: rngOf, defaultGen: defaultGen, prepare: prepare, counts: counts, pairBroken: pairBroken,
    hardPairViol: hardPairViol, incByClass: incByClass, score: score, optimize: optimize, analyze: analyze,
    spread: spread, diffCount: diffCount, nearGroup: nearGroup, farBreaks: farBreaks, farTargets: farTargets,
    sizeOf: sizeOf, buildSwap: buildSwap, swapChanges: swapChanges, nextCandidate: nextCandidate,
    buildMove: buildMove, autoName: autoName, genSummary: genSummary, assignNumbers: assignNumbers,
    nextYearRows: nextYearRows, checkInvariants: checkInvariants,
    normDiagram: normDiagram, diagramRoles: diagramRoles, diagramPattern: diagramPattern, ROLE_NAMES: ROLE_NAMES, DG_W: DG_W, DG_H: DG_H
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ==================== report.js ==================== */
// 市教委への報告書（簡易報告書・様式Ⅰ・様式Ⅱ）を作る計算。画面（コピペ用の表）とサーバー（Excelの書き換え）が同じものを使う。
// 事案の report の形：{ light, found, modes:[10], other, s1:{ hk, kk, sd }, s2:{ sd, vi, ha, kikan } }
//   hk・kk・sd・vi・ha は記録の行の並び [{ d:'YYYY-MM-DD', p:'時間帯', t:'本文' }]
(function (g) {
  'use strict';
  var C = g.CONFIG;
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  var SECTIONS = { hk: '発覚', kk: '経緯', sd: '指導' };
  var SECTIONS2 = { sd: '指導の経過', vi: '被害児童・保護者の様子', ha: '加害児童・保護者の様子' };

  function emptyReport() {
    return { light: false, found: '', modes: C.MODES.map(function () { return false; }), other: '', s1: { hk: [], kk: [], sd: [] }, s2: { sd: [], vi: [], ha: [], kikan: '' } };
  }
  function norm(r) {
    var e = emptyReport(); r = r || {};
    var rows = function (a) { return (a || []).filter(function (x) { return x && String(x.t || '').trim(); }).map(function (x) { return { d: String(x.d || ''), p: String(x.p || ''), t: String(x.t || '') }; }); };
    e.light = !!r.light; e.found = String(r.found || ''); e.other = String(r.other || '');
    e.modes = C.MODES.map(function (m, i) { return !!(r.modes && r.modes[i]); });
    ['hk', 'kk', 'sd'].forEach(function (k) { e.s1[k] = rows(r.s1 && r.s1[k]); });
    ['sd', 'vi', 'ha'].forEach(function (k) { e.s2[k] = rows(r.s2 && r.s2[k]); });
    e.s2.kikan = String(r.s2 && r.s2.kikan || '');
    return e;
  }
  function dateParts(iso) {
    var p = String(iso || '').split('-'), y = +p[0], m = +p[1], d = +p[2];
    if (!y || !m || !d) return null;
    return { y: y, m: m, d: d, w: WD[new Date(y, m - 1, d).getDay()] };
  }
  function md(iso) { var x = dateParts(iso); return x ? x.m + '月' + x.d + '日（' + x.w + '）' : ''; }
  // 記録の行を「日付 時間帯、内容」にして改行でつなぐ（日付・時間帯の順。同じなら入力した順）
  function lines(rows) {
    var slot = function (p) { var i = C.TIME_SLOTS.indexOf(p); return i < 0 ? 99 : i; };
    return rows.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
      return (a.x.d || '9999') < (b.x.d || '9999') ? -1 : (a.x.d || '9999') > (b.x.d || '9999') ? 1 : slot(a.x.p) - slot(b.x.p) || a.i - b.i;
    }).map(function (o) {
      var head = md(o.x.d) + (o.x.p || '');
      return (head ? head + '、' : '') + o.x.t.replace(/\s+$/, '');
    }).join('\n');
  }
  function colRow(ref) { var m = /^([A-Z]+)(\d+)$/.exec(ref); return m ? { c: m[1], r: +m[2] } : null; }

  // その様式に書く値：{ 'B4': '高木北小', ... }
  // kid(id) → { grade, cls(1から), male, name, kana }。victim は被害の児童の id、harms は加害の児童の id の並び
  function cells(kind, inc, o) {
    var R = C.REPORT, H = R.head, rep = norm(inc.report), out = {};
    var put = function (ref, v) { if (v !== '' && v != null) out[ref] = v; };
    put(H.school, o.school || '');
    var dp = dateParts(inc.date);
    if (dp) { var era = dp.y - 2018; put(H.era, era === 1 ? '元' : era); put(H.month, dp.m); put(H.day, dp.d); put(H.wday, '(' + dp.w + ')'); }
    var kidRow = function (row, id) {
      var k = o.kid(id); if (!k) return;
      put('B' + row, k.grade); put('D' + row, k.cls); put('G' + row, k.male ? '男' : '女'); put('I' + row, k.kana || ''); put('I' + (row + 1), k.name);
    };
    if (o.victim) kidRow(H.victim, o.victim);
    if (kind === 'f2') {
      put(R.f2.shido, lines(rep.s2.sd));
      if (rep.s2.vi.length) put(R.f2.victim, '（被害児童生徒及び保護者）\n' + lines(rep.s2.vi));
      if (rep.s2.ha.length) put(R.f2.harm, '（加害児童生徒及び保護者）\n' + lines(rep.s2.ha));
      put(R.f2.kikan, rep.s2.kikan);
      return out;
    }
    var harms = o.harms || [];
    harms.slice(0, R.harmRows.length).forEach(function (id, i) { kidRow(R.harmRows[i], id); });
    var more = harms.slice(R.harmRows.length);
    if (more.length) {
      var m = more.filter(function (id) { var k = o.kid(id); return k && k.male; }).length;
      put(R.harmMore, '※その他に男子（　' + m + '　）名、女子（　' + (more.length - m) + '　）名　　　　全体計（　' + harms.length + '　）名');
    }
    put(R.found, rep.found);
    C.MODES.forEach(function (md0, i) { if (rep.modes[i]) put(md0.cell, '○'); });
    if (rep.modes[C.MODES.length - 1]) put(R.modeOther, rep.other);
    // 発覚・経緯（内容）と指導は、欄ごとにまとめて改行で区切る
    if (kind === 'f1') put(R.f1.gaiyou, ['hk', 'kk', 'sd'].map(function (k) { return lines(rep.s1[k]); }).filter(Boolean).join('\n'));
    return out;
  }
  // 様式ごとに書いてよいセル（サーバーが受け取る値を確かめる）
  function allowedCells(kind) {
    var R = C.REPORT, H = R.head, a = [H.school, H.era, H.month, H.day, H.wday], row = function (r) { a.push('B' + r, 'D' + r, 'G' + r, 'I' + r, 'I' + (r + 1)); };
    row(H.victim);
    if (kind === 'f2') { a.push(R.f2.shido, R.f2.victim, R.f2.harm, R.f2.kikan); return a; }
    R.harmRows.forEach(row);
    a.push(R.harmMore, R.found, R.modeOther);
    C.MODES.forEach(function (m) { a.push(m.cell); });
    if (kind === 'f1') a.push(R.f1.gaiyou);
    return a;
  }

  // ===== xlsx のシートの XML に値を書く（罫線・結合・入力規則はそのまま） =====
  function xesc(s) { return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colNum(c) { var n = 0; for (var i = 0; i < c.length; i++) n = n * 26 + c.charCodeAt(i) - 64; return n; }
  function cellXml(ref, attrs, v) {
    attrs = (attrs || '').replace(/\s+t="[^"]*"/, '');
    if (typeof v === 'number') return '<c r="' + ref + '"' + attrs + '><v>' + v + '</v></c>';
    return '<c r="' + ref + '"' + attrs + ' t="inlineStr"><is><t xml:space="preserve">' + xesc(v) + '</t></is></c>';
  }
  function setCell(xml, ref, v) {
    var cr = colRow(ref); if (!cr) return xml;
    var re = new RegExp('<c r="' + ref + '"((?:\\s[^>]*?)?)(?:/>|>[\\s\\S]*?</c>)');
    if (re.test(xml)) return xml.replace(re, function (_, attrs) { return cellXml(ref, attrs, v); });
    var rowRe = new RegExp('<row r="' + cr.r + '"([^>]*?)(/>|>([\\s\\S]*?)</row>)');
    var nc = cellXml(ref, '', v);
    if (rowRe.test(xml)) {
      return xml.replace(rowRe, function (_, attrs, end, body) {
        body = end === '/>' ? '' : body;
        var cells = body.match(/<c r="[A-Z]+\d+"[\s\S]*?(?:\/>|<\/c>)/g) || [], placed = false, outB = '';
        cells.forEach(function (c) {
          var r2 = /<c r="([A-Z]+)\d+"/.exec(c)[1];
          if (!placed && colNum(r2) > colNum(cr.c)) { outB += nc; placed = true; }
          outB += c;
        });
        if (!placed) outB += nc;
        return '<row r="' + cr.r + '"' + attrs + '>' + outB + '</row>';
      });
    }
    // 行が無い：番号の順に差し込む
    var rows = xml.match(/<row r="(\d+)"/g) || [], at = -1;
    for (var i = 0; i < rows.length; i++) { if (+/\d+/.exec(rows[i])[0] > cr.r) { at = xml.indexOf(rows[i]); break; } }
    var nr = '<row r="' + cr.r + '">' + nc + '</row>';
    if (at >= 0) return xml.slice(0, at) + nr + xml.slice(at);
    if (/<sheetData\s*\/>/.test(xml)) return xml.replace(/<sheetData\s*\/>/, '<sheetData>' + nr + '</sheetData>');
    return xml.replace('</sheetData>', nr + '</sheetData>');
  }
  function fillSheet(xml, values) {
    Object.keys(values).forEach(function (ref) { xml = setCell(xml, ref, values[ref]); });
    return xml;
  }
  // workbook.xml と その rels から、シート名 → シートのファイルの道筋
  function sheetPath(workbookXml, relsXml, name) {
    var m = new RegExp('<sheet\\b[^>]*name="' + xesc(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*/>').exec(workbookXml);
    if (!m) return '';
    var rid = /r:id="([^"]+)"/.exec(m[0]); if (!rid) return '';
    var rel = new RegExp('<Relationship\\b[^>]*Id="' + rid[1] + '"[^>]*/>').exec(relsXml); if (!rel) return '';
    var tgt = /Target="([^"]+)"/.exec(rel[0])[1];
    return tgt.charAt(0) === '/' ? tgt.slice(1) : 'xl/' + tgt;
  }
  // 開いた時にそのシートを出す
  function activate(workbookXml, name) {
    var names = (workbookXml.match(/<sheet\b[^>]*\/>/g) || []).map(function (s) { return (/name="([^"]*)"/.exec(s) || [])[1]; });
    var i = names.indexOf(xesc(name)); if (i < 0) return workbookXml;
    return workbookXml.replace(/<workbookView\b([^>]*?)\/>/, function (_, a) { a = a.replace(/\s+(activeTab|firstSheet)="\d+"/g, ''); return '<workbookView' + a + ' activeTab="' + i + '"/>'; });
  }
  function untab(sheetXml, on) { sheetXml = sheetXml.replace(/\s+tabSelected="\d"/g, ''); return on ? sheetXml.replace(/<sheetView\b/, '<sheetView tabSelected="1"') : sheetXml; }

  g.Report = { SECTIONS: SECTIONS, SECTIONS2: SECTIONS2, emptyReport: emptyReport, norm: norm, lines: lines, md: md, cells: cells, allowedCells: allowedCells,
    setCell: setCell, fillSheet: fillSheet, sheetPath: sheetPath, activate: activate, untab: untab };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ==================== server.gs ==================== */
// サーバー（GAS）。scripts/build.py が config.js・engine.js の後ろにつなげて dist/gas/Code.gs を作る。
// 役目は「読み込み（学年ごとに1回）と保存」だけ。計算と描画はブラウザ側（docs/design.md §5）。
// コメントは GAS 上で消えることがあるので、意味を持たせない（principles/gas-javascript-notes.md §1）。

var SERVER_BUILD = 'BUILD_94c1d1dacab4';
var DB_PROP = 'CLASS_SPLIT_DB_ID';

// ===== 画面 =====
function doGet() {
  var who = currentTeacher_();
  if (!who.ok) {
    return HtmlService.createHtmlOutput('<!doctype html><html lang="ja"><meta charset="utf-8"><body style="font-family:sans-serif;padding:24px">' +
      '<h1 style="font-size:20px">このページは教員のアカウントで開いてください</h1><p>' + escHtml_(who.email || '（アカウントが分かりません）') + ' では開けません。</p></body></html>')
      .setTitle('クラス替え');
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('クラス替え')
    .addMetaTag('viewport', 'width=device-width,initial-scale=1');
}

// ===== 利用者の確認 =====
// 「自分として実行」でも、同じドメインの利用者のメールは取れる。教員のドメイン以外（児童など）は拒否する
function currentTeacher_() {
  var email = '';
  try { email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (e) { email = ''; }
  var ok = !!email && email.slice(-(CONFIG.TEACHER_DOMAIN.length + 1)) === '@' + CONFIG.TEACHER_DOMAIN;
  return { ok: ok, email: email };
}
function requireTeacher_() {
  var who = currentTeacher_();
  if (!who.ok) throw userError_('教員のアカウントで開いてください');
  return who.email;
}
// 再試行しても直らない誤り（画面は再試行せずに表示する）
function userError_(msg) { return new Error('USER:' + msg); }
function escHtml_(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

// ===== データの置き場 =====
// 専用のスプレッドシート。初回は setup() を所有者が実行して作る（教員には共有しない）
function setup() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(DB_PROP);
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('クラス替え（データ）');
  props.setProperty(DB_PROP, ss.getId());
  TABLES_.forEach(function (t) { sheet_(ss, t.name, t.head); });
  var fy = CONFIG.fiscalYear();
  sheet_(ss, 'roster_' + fy, ROSTER_HEAD);
  sheet_(ss, 'attrs_' + fy, attrsHead_());
  return ss.getUrl();
}
var ROSTER_HEAD = ['id8', 'name', 'kana', 'sex', 'grade', 'class', 'no'];
var TABLES_ = [
  { name: 'settings', head: ['key', 'json'] },
  { name: 'decisions', head: ['fy', 'grade', 'plan', 'by', 'at', 'undone', 'names'] }, // names：A組から順の組の番号（例 2,1,3）。空＝仮（A組＝1組…）
  { name: 'pairs_carry', head: ['fy', 'type', 'a', 'b', 'memo', 'tags', 'incs', 'since'] },
  // diagram：関係図（児童IDとグループの記号だけ。氏名は入れない）。role：関係図から決めた役割（harm・victim・mutual・related）
  { name: 'incidents', head: ['inc_id', 'date', 'type', 'url', 'file_id', 'title', 'by', 'at', 'deleted', 'diagram', 'date_end', 'detail', 'report'] },
  { name: 'incident_kids', head: ['inc_id', 'id8', 'role'] },
  { name: 'log', head: ['at', 'by', 'action', 'n'] },
  // 新年度の転入生：クラス分けに加え、決定で来年度の名簿に入れる。grade は今年度の学年（その学年のクラス分けに入る）
  { name: 'transfers', head: ['fy', 'grade', 'id8', 'name', 'kana', 'sex', 'by', 'at'] }
];
// side の項目（ア・身・通）は内容の文字も持つ（列名は k5_t など）
function attrsHead_() {
  var h = ['id8'].concat(CONFIG.ATTRS.map(function (at) { return at.k; }));
  CONFIG.ATTRS.forEach(function (at) { if (at.side || at.ctx) h.push(at.k + '_t'); if (at.ctx) h.push(at.k + '_i'); }); // _t＝内容・経緯の文、_i＝紐付けた事案の番号
  h.push('sp'); // 特別支援学級の児童（1＝在籍）。配慮項目ではなく、カードの地の色を変えるだけ
  h.push('memo'); // 備考（自由記述）。決定で来年度に写す
  return h;
}
// シートに書く文字：= + - @ で始まると式として読まれるので、先頭に ' を付けて文字のまま残す
function plainText_(s, max) { s = String(s == null ? '' : s).slice(0, max || 200); return /^[=+\-@]/.test(s) ? "'" + s : s; }

var SS_ = null;
function db_() {
  if (SS_) return SS_;
  var id = PropertiesService.getScriptProperties().getProperty(DB_PROP);
  if (!id) throw userError_('データの置き場がありません。所有者が setup を実行してください');
  SS_ = SpreadsheetApp.openById(id);
  return SS_;
}
function sheet_(ss, name, head) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (head) sh.getRange(1, 1, 1, head.length).setValues([head]);
  }
  return sh;
}
// 表を読む：見出しの名前で列を引く。無い表は空
function read_(name) {
  var sh = db_().getSheetByName(name);
  if (!sh) return { sh: null, head: [], rows: [] };
  var v = sh.getDataRange().getValues();
  if (!v.length) return { sh: sh, head: [], rows: [] };
  var head = v[0].map(String), rows = [];
  for (var r = 1; r < v.length; r++) {
    var o = { _r: r + 1 };
    for (var c = 0; c < head.length; c++) o[head[c]] = v[r][c];
    rows.push(o);
  }
  return { sh: sh, head: head, rows: rows };
}
// 項目を足した時、既存のシートの見出しに無い列を右端に足す（古いシートでも書けるように）
function ensureCols_(name, head) {
  var sh = sheet_(db_(), name, head);
  var w = Math.max(1, sh.getLastColumn()), cur = sh.getRange(1, 1, 1, w).getValues()[0].map(String);
  var miss = head.filter(function (h) { return cur.indexOf(h) < 0; });
  if (miss.length) sh.getRange(1, cur[0] ? w + 1 : 1, 1, miss.length).setValues([miss]);
  return sh;
}
function rowOf_(head, o) { return head.map(function (h) { return o[h] === undefined ? '' : o[h]; }); }
function append_(name, head, objs) {
  if (!objs.length) return;
  var sh = sheet_(db_(), name, head);
  var cur = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  if (!cur[0]) cur = head;
  sh.getRange(sh.getLastRow() + 1, 1, objs.length, cur.length).setValues(objs.map(function (o) { return rowOf_(cur, o); }));
}
// 書き戻しは変えた行の変えた列だけ（同時に別の行を直している人を上書きしない）
function writeCell_(t, row, col, value) {
  var c = t.head.indexOf(col);
  if (c < 0) throw new Error('列がありません：' + col);
  t.sh.getRange(row._r, c + 1).setValue(value);
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw userError_('ほかの人が保存中です。少し待ってからもう一度');
  try { return fn(); } finally { lock.releaseLock(); }
}
function log_(by, action, n) { append_('log', TABLES_[5].head, [{ at: new Date(), by: by, action: action, n: n }]); }

function getSetting_(key, def) {
  var t = read_('settings');
  for (var i = 0; i < t.rows.length; i++) if (t.rows[i].key === key) { try { return JSON.parse(t.rows[i].json); } catch (e) { return def; } }
  return def;
}
function setSetting_(key, value) {
  var t = read_('settings');
  for (var i = 0; i < t.rows.length; i++) if (t.rows[i].key === key) { writeCell_(t, t.rows[i], 'json', JSON.stringify(value)); return; }
  append_('settings', TABLES_[0].head, [{ key: key, json: JSON.stringify(value) }]);
}

// ===== 名簿・配慮項目の読み出し =====
function rosterRows_(fy) {
  return read_('roster_' + fy).rows.filter(function (r) { return String(r.id8); }).map(function (r) {
    return { id: String(r.id8), name: String(r.name), kana: String(r.kana || ''), male: String(r.sex) === '男',
      grade: +r.grade, cls: (+r['class']) - 1, no: +r.no };
  });
}
function attrsMap_(fy) {
  var m = {};
  read_('attrs_' + fy).rows.forEach(function (r) {
    var a = {};
    CONFIG.ATTRS.forEach(function (at) {
      a[at.k] = +r[at.k] || 0;
      if ((at.side || at.ctx) && r[at.k + '_t']) a[at.k + '_t'] = String(r[at.k + '_t']);
      if (at.ctx && r[at.k + '_i']) a[at.k + '_i'] = String(r[at.k + '_i']).split(',').filter(Boolean).map(Number);
    });
    if (+r.sp) a.sp = 1;
    if (r.memo) a.memo = String(r.memo);
    m[String(r.id8)] = a;
  });
  return m;
}
function decisionOf_(fy, grade) {
  var t = read_('decisions'), hit = null;
  t.rows.forEach(function (r) { if (+r.fy === fy && +r.grade === grade && !r.undone) hit = r; });
  return hit;
}

// ===== 画面から呼ぶ関数（platform-gas.js と同じ名前と形） =====
function api_(fn) {
  return function () {
    var args = arguments;
    try { return JSON.stringify({ ok: true, build: SERVER_BUILD, v: fn.apply(null, args) }); }
    catch (e) {
      var m = String(e && e.message || e);
      return JSON.stringify({ ok: false, build: SERVER_BUILD, user: m.indexOf('USER:') === 0, err: m.replace(/^USER:/, '') });
    }
  };
}

var apiListGrades = api_(function () {
  requireTeacher_();
  var fy = CONFIG.fiscalYear(), by = {};
  rosterRows_(fy).forEach(function (r) {
    var g = by[r.grade] = by[r.grade] || { grade: r.grade, count: 0, classes: 0, decided: false };
    g.count++; if (r.cls + 1 > g.classes) g.classes = r.cls + 1;
  });
  Object.keys(by).forEach(function (g) { by[g].decided = !!decisionOf_(fy, +g); });
  var out = [];
  for (var g = 1; g <= 6; g++) out.push(by[g] || { grade: g, count: 0, classes: 0, decided: false });
  return out;
});

var apiBoot = api_(function (grade) {
  requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear(), entry = FY - grade + 1, years = [], kids = {}, idset = {};
  for (var fy = entry; fy <= FY + 1; fy++) {
    var gy = fy - entry + 1, am = attrsMap_(fy);
    var rows = rosterRows_(fy).filter(function (r) { return r.grade === gy; });
    if (!rows.length) continue;
    years.push({ fy: fy, grade: gy, rows: rows.map(function (r) {
      kids[r.id] = { id: r.id, name: r.name, kana: r.kana, male: r.male, area: '' };
      idset[r.id] = 1;
      return { id: r.id, cls: r.cls, no: r.no, a: am[r.id] || emptyAttrs_() };
    }) });
  }
  var incs = incidents_().filter(function (x) { return x.ids.some(function (id) { return idset[id]; }); });
  var dec = decisionOf_(FY, grade);
  return {
    fy: FY, grade: grade, years: years, kids: kids, incidents: incs,
    pairs: pairs_(FY, grade),
    carry: carry_(FY, grade, idset),
    transfers: transfers_(FY, grade),
    plans: getSetting_('plans_' + FY + '_' + grade, { ver: 0, plans: [] }),
    decision: dec ? { plan: String(dec.plan), at: String(dec.at), names: namesOf_(dec, FY, grade), named: !!String(dec.names || '') } : null
  };
});
function transfers_(fy, grade) {
  return read_('transfers').rows.filter(function (r) { return +r.fy === fy && +r.grade === grade && String(r.id8); }).map(function (r) {
    return { id: String(r.id8), name: String(r.name), kana: String(r.kana), male: String(r.sex) === '男' };
  });
}
// 転入生を足す：児童IDが分からなければ仮のID（T＋数字）。名簿の児童IDと重なれば断る
var apiAddTransfer = api_(function (grade, x) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear();
  var name = String(x && x.name || '').trim(), kana = String(x && x.kana || '').trim(), id = String(x && x.id || '').trim();
  if (!name) throw userError_('名前を入れてください');
  if (id && !/^\d{8}$/.test(id)) throw userError_('児童IDは数字8桁です（分からなければ空のまま）');
  return withLock_(function () {
    if (decisionOf_(FY, grade)) throw userError_('決定済みです。決定を取り消してから足してください');
    var used = {};
    rosterRows_(FY).concat(rosterRows_(FY + 1)).forEach(function (r) { used[r.id] = 1; });
    read_('transfers').rows.forEach(function (r) { used[String(r.id8)] = 1; });
    if (id && used[id]) throw userError_('その児童IDはもう使われています');
    if (!id) { var n = 1; while (used['T' + FY + ('00' + n).slice(-3)]) n++; id = 'T' + FY + ('00' + n).slice(-3); }
    append_('transfers', TABLES_[6].head, [{ fy: FY, grade: grade, id8: id, name: plainText_(name), kana: plainText_(kana), sex: x.male ? '男' : '女', by: by, at: new Date().toISOString() }]);
    return { id: id };
  });
});
var apiRemoveTransfer = api_(function (grade, id) {
  requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear();
  return withLock_(function () {
    if (decisionOf_(FY, grade)) throw userError_('決定済みです。決定を取り消してから消してください');
    removeRows_('transfers', function (r) { return +r.fy === FY && +r.grade === grade && String(r.id8) === String(id); });
    return { ok: true };
  });
});
function emptyAttrs_() { var a = {}; CONFIG.ATTRS.forEach(function (at) { a[at.k] = 0; }); return a; }

function pairs_(fy, grade) {
  return read_('pairs_' + fy + '_' + grade).rows.filter(function (r) { return String(r.type); }).map(function (r) {
    var p = pairExtra_(r, { t: String(r.type), a: String(r.a) });
    if (p.t === 'fix') p.k = (+r.k) - 1; else p.b = String(r.b);
    return p;
  });
}
var PAIR_HEAD = ['type', 'a', 'b', 'k', 'memo', 'by', 'at', 'tags', 'incs', 'since'];
// つける・離すの添え物：memo＝経緯、tags＝定型の理由（「、」区切り）、incs＝添えた事案の番号（「,」区切り）、since＝何年生の時から
function pairExtra_(r, p) {
  p.memo = String(r.memo || '');
  p.tags = String(r.tags || '').split('、').filter(Boolean);
  p.incs = String(r.incs || '').split(',').filter(Boolean).map(Number);
  if (+r.since) p.since = +r.since;
  return p;
}
function pairCells_(p, grade) {
  return { memo: plainText_(String(p.memo || ''), 1000), tags: (p.tags || []).map(String).join('、').slice(0, 200), incs: (p.incs || []).map(Number).filter(function (n) { return n > 0; }).join(','), since: +p.since || grade };
}
// 前年度に決定した時に持ち越した組のうち、2人とも今この学年にいて、まだ採用していないもの
function carry_(FY, grade, idset) {
  var key = function (p) { return p.t + ':' + [p.a, p.b].sort().join('-'); }, have = {};
  pairs_(FY, grade).forEach(function (p) { have[key(p)] = 1; });
  return read_('pairs_carry').rows.filter(function (r) { return +r.fy === FY - 1 && idset[String(r.a)] && idset[String(r.b)]; })
    .map(function (r) { return pairExtra_(r, { t: String(r.type), a: String(r.a), b: String(r.b) }); })
    .filter(function (p) { return !have[key(p)]; });
}

// つける・離す・組に固定を、学年ごとにまとめて置き換える
var apiSavePairs = api_(function (grade, pairs) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear(), name = 'pairs_' + FY + '_' + grade;
  if (decisionOf_(FY, grade)) throw userError_('クラス替えを決定したので直せません');
  return withLock_(function () {
    sheet_(db_(), name, PAIR_HEAD); ensureCols_(name, PAIR_HEAD);
    removeRows_(name, function (r) { return r._r > 1; });
    append_(name, PAIR_HEAD, (pairs || []).map(function (p) {
      return Object.assign({ type: p.t, a: String(p.a), b: p.t === 'fix' ? '' : String(p.b), k: p.t === 'fix' ? (+p.k) + 1 : '', by: by, at: new Date().toISOString() }, pairCells_(p, grade));
    }));
    return { n: (pairs || []).length };
  });
});

// 名簿を入れる：同じ児童IDは上書き（配慮項目の値は残す）、新しいIDは足す。貼った中にいない児童は知らせるだけ（消さない）
var apiImportRoster = api_(function (fy, grade, rows) {
  var by = requireTeacher_();
  fy = +fy; grade = +grade;
  var FY = CONFIG.fiscalYear();
  if (fy !== FY && fy !== FY + 1) throw userError_('今年度か来年度の名簿だけ入れられます');
  if (!rows || !rows.length) throw userError_('児童がいません');
  return withLock_(function () {
    var name = 'roster_' + fy;
    sheet_(db_(), name, ROSTER_HEAD);
    ensureCols_('attrs_' + fy, attrsHead_());
    var t = read_(name), byId = {}, added = [], updated = 0, classes = {}, ids = {};
    t.rows.forEach(function (r) { byId[String(r.id8)] = r; });
    rows.forEach(function (x) {
      var id = String(x.id);
      if (!/^\d{8}$/.test(id)) throw userError_('児童IDが8桁でない行があります');
      classes[+x.cls] = 1; ids[id] = 1;
      var o = { id8: id, name: String(x.name), kana: String(x.kana || ''), sex: x.male ? '男' : (x.sex || '女'), grade: grade, 'class': (+x.cls) + 1, no: +x.no };
      var r = byId[id];
      if (r) { ['name', 'kana', 'sex', 'grade', 'class', 'no'].forEach(function (c) { if (String(r[c]) !== String(o[c])) writeCell_(t, r, c, o[c]); }); updated++; }
      else added.push(o);
    });
    append_(name, ROSTER_HEAD, added);
    var missing = t.rows.filter(function (r) { return +r.grade === grade && classes[(+r['class']) - 1] && !ids[String(r.id8)]; }).map(function (r) { return String(r.name); });
    log_(by, 'importRoster', rows.length);
    return { added: added.length, updated: updated, missing: missing };
  });
});

function incidents_() {
  var kids = {}, roles = {};
  read_('incident_kids').rows.forEach(function (r) {
    (kids[r.inc_id] = kids[r.inc_id] || []).push(String(r.id8));
    if (r.role) (roles[r.inc_id] = roles[r.inc_id] || {})[String(r.id8)] = String(r.role);
  });
  return read_('incidents').rows.filter(function (r) { return !r.deleted && r.inc_id !== ''; }).map(function (r) {
    var dg = null;
    if (r.diagram) { try { dg = Engine.normDiagram(JSON.parse(String(r.diagram))); } catch (e) { dg = null; } }
    var rp = null;
    if (r.report) { try { rp = Report.norm(JSON.parse(String(r.report))); } catch (e) { rp = null; } }
    return { id: +r.inc_id, date: isoDate_(r.date), dateEnd: r.date_end ? isoDate_(r.date_end) : '', detail: String(r.detail || ''), type: String(r.type), title: String(r.title), url: String(r.url), ids: kids[r.inc_id] || [], roles: roles[r.inc_id] || {}, diagram: dg, report: rp };
  });
}
// 事案の入力を確かめる：関係図があれば、関係する児童と役割は関係図から決める
function incidentInput_(x) {
  if (!x) throw userError_('事案が読めません');
  // 文書のURLは任意（事案管理の入力欄に記録を書くなら要らない）。貼るなら学校のドライブの文書だけ
  if (x.url && !/^https:\/\/(docs|drive)\.google\.com\//.test(String(x.url))) throw userError_('学校のドライブの文書のURLを貼ってください');
  var dg = x.diagram ? Engine.normDiagram(x.diagram) : null, ids, roles = {};
  if (dg && dg.nodes.length) { ids = dg.nodes.map(function (n) { return n.id; }); roles = Engine.diagramRoles(dg); }
  else { ids = (x.ids || []).map(String); dg = null; }
  if (!ids.length) throw userError_('関係する児童を選んでください');
  var json = dg ? JSON.stringify(dg) : '';
  if (json.length > 40000) throw userError_('関係図が大きすぎます');
  // 事案は期間を持つことが多い：始まり（必須）と終わり（任意。空＝その日だけか、続いている）
  var date = String(x.date || ''), end = String(x.dateEnd || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw userError_('始まりの日を入れてください');
  if (end && (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end < date)) throw userError_('終わりの日は始まりの日より後にしてください');
  var rp = x.report ? reportInput_(x.report) : null, rjson = rp ? JSON.stringify(rp) : '';
  if (rjson.length > 45000) throw userError_('記録が長すぎます。分けて書いてください');
  return { ids: ids, roles: roles, diagram: dg, json: json, date: date, dateEnd: end, detail: plainText_(String(x.detail || '').trim(), 5000), type: String(x.type), url: String(x.url || ''), report: rp, rjson: rjson };
}
// 報告書の記録（発覚・経緯・指導、様式Ⅱの追記）を確かめる。文字数と行数に上限を置く
function reportInput_(r) {
  var rp = Report.norm(r), cut = function (a) {
    if (a.length > 80) throw userError_('記録の行が多すぎます（1つの欄に80行まで）');
    return a.map(function (x) { return { d: /^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '', p: String(x.p).slice(0, 20), t: String(x.t).slice(0, 2000) }; });
  };
  ['hk', 'kk', 'sd'].forEach(function (k) { rp.s1[k] = cut(rp.s1[k]); });
  ['sd', 'vi', 'ha'].forEach(function (k) { rp.s2[k] = cut(rp.s2[k]); });
  rp.s2.kikan = rp.s2.kikan.slice(0, 2000); rp.other = rp.other.slice(0, 200);
  if (rp.found && CONFIG.FOUND_LIST.indexOf(rp.found) < 0) rp.found = '';
  return rp;
}
function isoDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

// 配慮項目は編集できる年度だけ（決定前＝今年度、決定後＝来年度）。決定後の今年度は凍結
var apiSetAttr = api_(function (fy, grade, id, k, v, text, incs) {
  var by = requireTeacher_();
  fy = +fy; grade = +grade; v = +v;
  if (k === 'memo') { text = String(text == null ? '' : text).trim(); v = text ? 1 : 0; }
  var at = k === 'sp' ? { k: 'sp', max: 1 } : k === 'memo' ? { k: 'memo', max: 1 } : CONFIG.ATTRS.filter(function (a) { return a.k === k; })[0];
  if (!at) throw userError_('項目が違います');
  if (!(v >= 0 && v <= at.max)) throw userError_('値が違います');
  var FY = CONFIG.fiscalYear(), cohortGrade = grade - (fy - FY), dec = decisionOf_(FY, cohortGrade);
  var editable = dec ? FY + 1 : FY;
  if (fy !== editable) throw userError_(fy === FY && dec ? 'クラス替えを決定したので、今年度の値は直せません。準備中の年度を直してください' : 'この年度は直せません');
  return withLock_(function () {
    var name = 'attrs_' + fy;
    ensureCols_(name, attrsHead_());
    var t = read_(name), row = null;
    t.rows.forEach(function (r) { if (String(r.id8) === String(id)) row = r; });
    if (k === 'memo') { // 備考は文字だけを持つ
      if (row) writeCell_(t, row, 'memo', plainText_(text, 400));
      else append_(name, attrsHead_(), [{ id8: String(id), memo: plainText_(text, 400) }]);
      return { ok: true, by: by };
    }
    var tk = (at.side || at.ctx) && text !== undefined ? k + '_t' : null, tv = tk ? plainText_(v ? text : '', at.ctx ? 1000 : 200) : '';
    var ik = at.ctx && incs !== undefined ? k + '_i' : null, iv = ik && v ? (incs || []).map(Number).filter(function (n) { return n > 0; }).join(',') : '';
    if (row) { writeCell_(t, row, k, v); if (tk) writeCell_(t, row, tk, tv); if (ik) writeCell_(t, row, ik, iv); }
    else { var o = { id8: String(id) }; o[k] = v; if (tk) o[tk] = tv; if (ik) o[ik] = iv; append_(name, attrsHead_(), [o]); }
    return { ok: true, by: by };
  });
});

// 案は学年ごとに1つの値（版つき）。他の人が先に保存していたら上書きせずに知らせる
var apiSavePlans = api_(function (grade, plans, baseVer) {
  var by = requireTeacher_();
  var key = 'plans_' + CONFIG.fiscalYear() + '_' + (+grade);
  return withLock_(function () {
    var cur = getSetting_(key, { ver: 0, plans: [] });
    if ((+baseVer || 0) !== (+cur.ver || 0)) return { conflict: true, ver: cur.ver, by: cur.by || '' };
    var next = { ver: (+cur.ver || 0) + 1, by: by, at: new Date().toISOString(), plans: plans };
    if (JSON.stringify(next).length > 45000) throw userError_('案が多すぎて保存できません。使わない案を削除してください');
    setSetting_(key, next);
    return { ver: next.ver };
  });
});

function fileIdOf_(url) {
  var m = String(url).match(/\/d\/([\w-]{20,})/) || String(url).match(/[?&]id=([\w-]{20,})/);
  return m ? m[1] : '';
}
// 所有者が開けない文書は名前を取れない（空を返し、画面が入力を求める）
function titleOf_(url) {
  var id = fileIdOf_(url);
  if (!id) return '';
  try { return DriveApp.getFileById(id).getName(); } catch (e) { return ''; }
}
var apiFetchTitle = api_(function (url) { requireTeacher_(); return { title: titleOf_(url) }; });

var apiAddIncident = api_(function (x) {
  var by = requireTeacher_();
  var v = incidentInput_(x);
  var title = String(x.title || '').trim() || (v.url ? titleOf_(v.url) : '');
  return withLock_(function () {
    ensureCols_('incidents', TABLES_[3].head); ensureCols_('incident_kids', TABLES_[4].head);
    var t = read_('incidents'), next = 1;
    t.rows.forEach(function (r) { if (+r.inc_id >= next) next = +r.inc_id + 1; });
    var inc = { inc_id: next, date: v.date, date_end: v.dateEnd, detail: v.detail, type: v.type, url: v.url, file_id: fileIdOf_(v.url), title: title, by: by, at: new Date(), deleted: '', diagram: v.json, report: v.rjson };
    append_('incidents', TABLES_[3].head, [inc]);
    append_('incident_kids', TABLES_[4].head, v.ids.map(function (id) { return { inc_id: next, id8: id, role: v.roles[id] || '' }; }));
    log_(by, 'addIncident', v.ids.length);
    return { id: next, date: inc.date, dateEnd: v.dateEnd, detail: v.detail, type: inc.type, title: title, url: inc.url, ids: v.ids, roles: v.roles, diagram: v.diagram, report: v.report };
  });
});

// 事案を直す（関係図・文書・日付・種別）。関係する児童は関係図から入れ直す
var apiUpdateIncident = api_(function (id, x) {
  var by = requireTeacher_();
  id = +id;
  var v = incidentInput_(x);
  var title = String(x.title || '').trim() || (v.url ? titleOf_(v.url) : '');
  return withLock_(function () {
    ensureCols_('incidents', TABLES_[3].head); ensureCols_('incident_kids', TABLES_[4].head);
    var t = read_('incidents'), row = t.rows.filter(function (r) { return +r.inc_id === id && !r.deleted; })[0];
    if (!row) throw userError_('事案が見つかりません');
    [['date', v.date], ['date_end', v.dateEnd], ['detail', v.detail], ['type', v.type], ['url', v.url], ['file_id', fileIdOf_(v.url)], ['title', title], ['diagram', v.json], ['report', v.rjson]].forEach(function (c) { writeCell_(t, row, c[0], c[1]); });
    removeRows_('incident_kids', function (r) { return +r.inc_id === id; });
    append_('incident_kids', TABLES_[4].head, v.ids.map(function (k) { return { inc_id: id, id8: k, role: v.roles[k] || '' }; }));
    log_(by, 'updateIncident', v.ids.length);
    return { id: id, date: v.date, dateEnd: v.dateEnd, detail: v.detail, type: v.type, title: title, url: v.url, ids: v.ids, roles: v.roles, diagram: v.diagram, report: v.report };
  });
});

// 報告書のExcel：設定の様式ファイル（xlsxのまま置いたもの）を複製し、該当するシートのセルにだけ値を書く。
// 元のファイルは変えない。xlsx の中の XML を直接書き換えるので、罫線・結合・入力規則は元のまま。
// 複製は様式のファイルと同じフォルダに置く（名前に児童の氏名は入れない）
var apiExportReport = api_(function (kind, values, incId) {
  var by = requireTeacher_(), R = CONFIG.REPORT;
  if (!R.sheets[kind]) throw userError_('様式が分かりません');
  var ok = {}; Report.allowedCells(kind).forEach(function (c) { ok[c] = 1; });
  var vals = {};
  Object.keys(values || {}).forEach(function (ref) {
    if (!ok[ref]) return;
    var v = values[ref];
    vals[ref] = typeof v === 'number' && isFinite(v) ? v : String(v).slice(0, 8000);
  });
  var id = fileIdOf_(settings_().template);
  if (!id) throw userError_('様式のファイルが設定されていません。設定の「事案と報告書」でURLを貼ってください');
  var file;
  try { file = DriveApp.getFileById(id); } catch (e) { throw userError_('様式のファイルを開けません。所有者が開けるドライブに置いてください'); }
  if (file.getMimeType() !== MimeType.MICROSOFT_EXCEL) throw userError_('様式のファイルはExcel（.xlsx）のまま置いてください（スプレッドシートに変換しない）');
  var blob = file.getBlob().setContentType('application/zip');
  var parts = Utilities.unzip(blob), byName = {};
  parts.forEach(function (b, i) { byName[b.getName()] = i; });
  var text = function (n) { return parts[byName[n]].getDataAsString('UTF-8'); };
  var put = function (n, s) { parts[byName[n]] = Utilities.newBlob(s, 'application/xml', n); };
  if (byName['xl/workbook.xml'] == null || byName['xl/_rels/workbook.xml.rels'] == null) throw userError_('様式のファイルが読めません');
  var wb = text('xl/workbook.xml'), path = Report.sheetPath(wb, text('xl/_rels/workbook.xml.rels'), R.sheets[kind]);
  if (!path || byName[path] == null) throw userError_('様式のファイルに「' + R.sheets[kind] + '」のシートがありません');
  Object.keys(byName).forEach(function (n) { if (/^xl\/worksheets\/[^/]+\.xml$/.test(n)) put(n, Report.untab(text(n), n === path)); });
  put(path, Report.fillSheet(text(path), vals));
  put('xl/workbook.xml', Report.activate(wb, R.sheets[kind]));
  var name = R.names[kind] + '_事案' + (+incId || 0) + '_' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmm') + '.xlsx';
  var out = Utilities.zip(parts, name).setContentType(MimeType.MICROSOFT_EXCEL);
  var folder = null;
  try { var it = file.getParents(); if (it.hasNext()) folder = it.next(); } catch (e) { folder = null; }
  var copy = folder ? folder.createFile(out) : DriveApp.createFile(out);
  log_(by, 'exportReport', +incId || 0);
  return { name: name, url: copy.getUrl() };
});

var apiSchoolIncidents = api_(function () {
  requireTeacher_();
  var cur = {};
  rosterRows_(CONFIG.fiscalYear()).forEach(function (r) { cur[r.id] = r; });
  var cnt = {}, last = {};
  incidents_().forEach(function (x) { x.ids.forEach(function (id) { cnt[id] = (cnt[id] || 0) + 1; if (!last[id] || x.date > last[id]) last[id] = x.date; }); });
  return Object.keys(cnt).filter(function (id) { return cur[id]; }).map(function (id) {
    var r = cur[id];
    return { id: id, name: r.name, male: r.male, grade: r.grade, cls: r.cls, no: r.no, count: cnt[id], last: last[id] };
  });
});

// 決定：来年度の名簿（新しい組・番号）と配慮項目の写しを作り、つける・離すを持ち越しの候補にする
var apiDecide = api_(function (grade, plan) {
  var by = requireTeacher_();
  grade = +grade;
  if (grade >= 6) throw userError_('6年は決定しません');
  var FY = CONFIG.fiscalYear();
  return withLock_(function () {
    if (decisionOf_(FY, grade)) throw userError_('決定済みです');
    var am = attrsMap_(FY);
    var cur = rosterRows_(FY).filter(function (r) { return r.grade === grade; });
    if (!cur.length) throw userError_('名簿がありません');
    // 転入生も名簿の児童と同じに扱う（今年度の値は無いので空）
    var tr = transfers_(FY, grade).map(function (t) { return { id: t.id, name: t.name, kana: t.kana, male: t.male }; });
    cur = cur.concat(tr);
    var kids = cur.map(function (r) { return { id: r.id, kana: r.kana, a: am[r.id] || emptyAttrs_() }; });
    var asg = cur.map(function (r) { return plan.assign[r.id]; });
    if (asg.some(function (k) { return !(k >= 0 && k < CONFIG.MAX_CLASSES); })) throw userError_('組の決まっていない児童がいます');
    var nc = 0; asg.forEach(function (k) { if (k + 1 > nc) nc = k + 1; });
    var rows = Engine.nextYearRows(kids, asg, nc), info = {};
    cur.forEach(function (r) { info[r.id] = r; });
    var nfy = FY + 1;
    append_('roster_' + nfy, ROSTER_HEAD, rows.map(function (r) {
      var s = info[r.id];
      return { id8: r.id, name: s.name, kana: s.kana, sex: s.male ? '男' : '女', grade: grade + 1, 'class': r.cls + 1, no: r.no };
    }));
    ensureCols_('attrs_' + nfy, attrsHead_());
    append_('attrs_' + nfy, attrsHead_(), rows.map(function (r) { var o = { id8: r.id }; CONFIG.ATTRS.forEach(function (at) { o[at.k] = r.a[at.k]; if ((at.side || at.ctx) && r.a[at.k + '_t']) o[at.k + '_t'] = plainText_(r.a[at.k + '_t'], 1000); if (at.ctx && r.a[at.k + '_i']) o[at.k + '_i'] = r.a[at.k + '_i'].join(','); }); if (r.a.sp) o.sp = 1; if (r.a.memo) o.memo = plainText_(r.a.memo, 400); return o; }));
    ensureCols_('pairs_carry', TABLES_[2].head);
    append_('pairs_carry', TABLES_[2].head, pairs_(FY, grade).filter(function (p) { return p.t !== 'fix'; })
      .map(function (p) { return Object.assign({ fy: FY, type: p.t, a: p.a, b: p.b }, pairCells_(p, grade)); })); // 経緯・理由・何年生からを次の年度へ持ち越す
    append_('decisions', TABLES_[1].head, [{ fy: FY, grade: grade, plan: String(plan.name), by: by, at: new Date().toISOString(), undone: '' }]);
    log_(by, 'decide', rows.length);
    return { plan: String(plan.name) };
  });
});

// 取り消し：4/1まで（年度が変わったら決定は確定）。来年度の名簿と写した値・持ち越しの候補を消す
var apiUndoDecide = api_(function (grade) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear();
  return withLock_(function () {
    var dec = decisionOf_(FY, grade);
    if (!dec) throw userError_('決定されていません（年度が変わった後は取り消せません）');
    var ids = {};
    rosterRows_(FY).forEach(function (r) { if (r.grade === grade) ids[r.id] = 1; });
    transfers_(FY, grade).forEach(function (t) { ids[t.id] = 1; });
    var n = removeRows_('roster_' + (FY + 1), function (r) { return +r.grade === grade + 1 && ids[String(r.id8)]; });
    removeRows_('attrs_' + (FY + 1), function (r) { return ids[String(r.id8)]; });
    removeRows_('pairs_carry', function (r) { return +r.fy === FY && (ids[String(r.a)] || ids[String(r.b)]); });
    var t = read_('decisions');
    writeCell_(t, t.rows.filter(function (r) { return r._r === dec._r; })[0], 'undone', new Date().toISOString());
    log_(by, 'undoDecide', n);
    return { ok: true };
  });
});
// 決定した組の番号（A組から順）。未設定は仮で A組＝1組…
function namesOf_(dec, FY, grade) {
  var v = String(dec.names || '');
  if (v) return v.split(',').map(Number);
  var nc = 0;
  rosterRows_(FY + 1).forEach(function (r) { if (r.grade === grade + 1 && r.cls + 1 > nc) nc = r.cls + 1; });
  var out = []; for (var k = 0; k < nc; k++) out.push(k + 1);
  return out;
}
// 組の番号を決める（決定の後の別の操作）。来年度の名簿の組の列を付け替える。出席番号は組の中で変わらない
var apiSetClassNames = api_(function (grade, names) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear();
  return withLock_(function () {
    var dec = decisionOf_(FY, grade);
    if (!dec) throw userError_('決定されていません');
    var old = namesOf_(dec, FY, grade), nc = old.length;
    names = (names || []).map(Number);
    var ok = names.length === nc && names.slice().sort(function (a, b) { return a - b; }).every(function (v, i) { return v === i + 1; });
    if (!ok) throw userError_('組の番号は 1〜' + nc + ' を1つずつ使ってください');
    var ids = {};
    rosterRows_(FY).forEach(function (r) { if (r.grade === grade) ids[r.id] = 1; });
    transfers_(FY, grade).forEach(function (t) { ids[t.id] = 1; });
    var t = read_('roster_' + (FY + 1)), c = t.head.indexOf('class');
    if (t.rows.length) {
      var col = t.rows.map(function (r) {
        var v = +r['class'];
        if (+r.grade === grade + 1 && ids[String(r.id8)]) { var k = old.indexOf(v); if (k >= 0) v = names[k]; }
        return [v];
      });
      t.sh.getRange(2, c + 1, col.length, 1).setValues(col); // 1回で書く（行ごとに書くと遅い）
    }
    ensureCols_('decisions', TABLES_[1].head);
    var d = read_('decisions');
    writeCell_(d, d.rows.filter(function (r) { return r._r === dec._r; })[0], 'names', names.join(','));
    log_(by, 'classNames', nc);
    return { ok: true };
  });
});

// 行を消す（下の行から消すので行番号がずれない）
function removeRows_(name, pred) {
  var t = read_(name), n = 0;
  if (!t.sh) return 0;
  t.rows.slice().reverse().forEach(function (r) { if (pred(r)) { t.sh.deleteRow(r._r); n++; } });
  return n;
}

// ===== 設定 =====
// 項目の名前・頭文字・既定の重み、事案の種別、担任と学級、卒業・転出後に残す年数。正本は settings シートの app
function defaultSettings_() {
  var attrs = {};
  CONFIG.ATTRS.forEach(function (at) { attrs[at.k] = { label: at.label, s: at.s, w: at.w }; });
  return { attrs: attrs, types: CONFIG.INCIDENT_TYPES.slice(), teachers: [], keepYears: CONFIG.KEEP_YEARS_DEFAULT, slots: CONFIG.TIME_SLOTS.slice(), school: '', template: '' };
}
function settings_() {
  var d = defaultSettings_(), s = getSetting_('app', {});
  return { attrs: Object.assign(d.attrs, s.attrs || {}), types: s.types && s.types.length ? s.types : d.types,
    teachers: s.teachers || [], keepYears: s.keepYears == null || s.keepYears === '' ? d.keepYears : +s.keepYears || 0,
    slots: s.slots && s.slots.length ? s.slots : d.slots, school: String(s.school || ''), template: String(s.template || '') };
}
var apiSettings = api_(function () {
  var email = requireTeacher_(), s = settings_(), me = { email: email, grade: 0, cls: -1 };
  s.teachers.forEach(function (t) { if (String(t.email).toLowerCase() === email) { me.grade = +t.grade; me.cls = (+t.cls) - 1; } });
  return { settings: s, me: me };
});
var apiSaveSettings = api_(function (s) {
  var by = requireTeacher_();
  if (!s || !s.attrs) throw userError_('設定が読めません');
  var clean = { attrs: {}, types: [], teachers: [], keepYears: Math.max(0, Math.min(6, +s.keepYears || 0)),
    slots: (s.slots || []).map(function (t) { return String(t).trim().slice(0, 20); }).filter(Boolean).slice(0, 30),
    school: String(s.school || '').trim().slice(0, 40), template: String(s.template || '').trim().slice(0, 300) };
  if (!clean.slots.length) clean.slots = CONFIG.TIME_SLOTS.slice();
  if (clean.template && !fileIdOf_(clean.template)) throw userError_('様式のファイルは、ドライブのファイルのURLを貼ってください');
  CONFIG.ATTRS.forEach(function (at) {
    var x = s.attrs[at.k] || {};
    var label = String(x.label === undefined ? at.label : x.label).trim().slice(0, 20), ini = String(x.s === undefined ? at.s : x.s).trim().slice(0, 1);
    if (!label || !ini) throw userError_('項目の名前と頭文字は空にできません');
    // 説明文：空の欄は既定の文に戻す
    var help = (at.help || []).map(function (d, i) { var t = String(x.help && x.help[i] || '').trim().slice(0, 80); return t || d; });
    clean.attrs[at.k] = { label: label, s: ini, w: Math.max(0, Math.min(3, +x.w || 0)), help: help };
  });
  clean.types = (s.types || []).map(function (t) { return String(t).trim(); }).filter(Boolean).slice(0, 20);
  if (!clean.types.length) throw userError_('事案の種別を1つ以上入れてください');
  clean.teachers = (s.teachers || []).filter(function (t) { return t && t.email; }).map(function (t) {
    return { email: String(t.email).trim().toLowerCase(), grade: +t.grade || 0, cls: +t.cls || 0 };
  });
  withLock_(function () { setSetting_('app', clean); log_(by, 'saveSettings', 0); });
  return clean;
});

// ===== 年度替わり：卒業・転出した児童の記録を消す =====
function rosterSheets_() {
  return db_().getSheets().map(function (sh) { return sh.getName(); }).filter(function (n) { return /^roster_\d{4}$/.test(n); })
    .map(function (n) { return +n.slice(7); }).sort();
}
// 今年度（と来年度）の名簿にいない児童。最後にいた年度から keepYears 年度を過ぎたものだけ
var apiLeaveCandidates = api_(function () {
  requireTeacher_();
  var FY = CONFIG.fiscalYear(), keep = settings_().keepYears, now = {}, last = {};
  [FY, FY + 1].forEach(function (fy) { rosterRows_(fy).forEach(function (r) { now[r.id] = 1; }); });
  rosterSheets_().forEach(function (fy) {
    if (fy >= FY) return;
    rosterRows_(fy).forEach(function (r) { last[r.id] = { id: r.id, name: r.name, fy: fy, grade: r.grade, cls: r.cls, no: r.no }; });
  });
  var cnt = {};
  incidents_().forEach(function (x) { x.ids.forEach(function (id) { cnt[id] = (cnt[id] || 0) + 1; }); });
  return Object.keys(last).filter(function (id) { return !now[id] && CONFIG.purgeable(last[id].fy, FY, keep, !!cnt[id]); }).map(function (id) {
    var x = last[id]; x.reason = x.grade === 6 ? '卒業' : '転出'; x.incidents = cnt[id] || 0; return x;
  }).sort(function (a, b) { return a.fy - b.fy || a.grade - b.grade || a.cls - b.cls || a.no - b.no; });
});
// 消す：名簿・配慮項目・つける離す・持ち越し・事案との結び付き・案の割り当てから、その児童の行を消す。
// 結び付く児童がいなくなった事案は、名前とURLを消して削除済みにする。元に戻せない
var apiPurge = api_(function (ids) {
  var by = requireTeacher_();
  if (!ids || !ids.length) throw userError_('消す児童を選んでください');
  var FY = CONFIG.fiscalYear(), set = {}, now = {};
  [FY, FY + 1].forEach(function (fy) { rosterRows_(fy).forEach(function (r) { now[r.id] = 1; }); });
  ids.forEach(function (id) { if (now[id]) throw userError_('今年度の名簿にいる児童は消せません'); set[String(id)] = 1; });
  // 画面の候補と同じ規則をサーバーでも確かめる（事案に関わった児童は5年度より前に消さない）
  var keep = settings_().keepYears, lastFy = {}, inc = {};
  rosterSheets_().forEach(function (fy) { if (fy < FY) rosterRows_(fy).forEach(function (r) { if (set[r.id]) lastFy[r.id] = fy; }); });
  incidents_().forEach(function (x) { x.ids.forEach(function (id) { inc[id] = 1; }); });
  ids.forEach(function (id) {
    if (lastFy[id] != null && !CONFIG.purgeable(lastFy[id], FY, keep, !!inc[id])) throw userError_('残す年数を過ぎていない児童は消せません（事案に関わった児童は卒業・転出から' + CONFIG.INCIDENT_KEEP_YEARS + '年度）');
  });
  return withLock_(function () {
    var n = 0;
    db_().getSheets().map(function (sh) { return sh.getName(); }).forEach(function (name) {
      if (/^(roster|attrs)_\d{4}$/.test(name)) n += removeRows_(name, function (r) { return set[String(r.id8)]; });
      else if (/^pairs_/.test(name)) removeRows_(name, function (r) { return set[String(r.a)] || set[String(r.b)]; });
    });
    removeRows_('incident_kids', function (r) { return set[String(r.id8)]; });
    removeRows_('transfers', function (r) { return set[String(r.id8)]; });
    var left = {};
    read_('incident_kids').rows.forEach(function (r) { left[r.inc_id] = 1; });
    var t = read_('incidents');
    t.rows.forEach(function (r) {
      if (!r.deleted && r.inc_id !== '' && !left[r.inc_id]) { writeCell_(t, r, 'title', ''); writeCell_(t, r, 'url', ''); if (t.head.indexOf('detail') >= 0) writeCell_(t, r, 'detail', ''); if (t.head.indexOf('report') >= 0) writeCell_(t, r, 'report', ''); writeCell_(t, r, 'deleted', new Date().toISOString()); }
      // 関係図からも消した児童を外す（残った児童の関係図は、その児童のいない形で残す）
      if (r.diagram) {
        var dg; try { dg = JSON.parse(String(r.diagram)); } catch (e) { dg = null; }
        if (dg && (dg.nodes || []).some(function (nd) { return set[String(nd.id)]; })) {
          dg.nodes = dg.nodes.filter(function (nd) { return !set[String(nd.id)]; });
          writeCell_(t, r, 'diagram', left[r.inc_id] ? JSON.stringify(Engine.normDiagram(dg)) : '');
        }
      }
    });
    read_('settings').rows.forEach(function (r) {
      if (!/^plans_/.test(String(r.key))) return;
      var v = JSON.parse(r.json), ch = false;
      (v.plans || []).forEach(function (p) {
        Object.keys(p.assign || {}).forEach(function (id) { if (set[id]) { delete p.assign[id]; ch = true; } });
        p.locks = (p.locks || []).filter(function (id) { return !set[id]; });
      });
      if (ch) setSetting_(String(r.key), v);
    });
    log_(by, 'purge', ids.length);
    return { kids: ids.length, rows: n };
  });
});

// 名簿を入れる（PR③で画面を作るまでの間、所有者がスクリプトエディタから呼ぶ）
// rows: [[id8, name, kana, 性別, 学年, 組, 番号], ...]
function importRoster(fy, rows) {
  sheet_(db_(), 'roster_' + fy, ROSTER_HEAD);
  sheet_(db_(), 'attrs_' + fy, attrsHead_());
  append_('roster_' + fy, ROSTER_HEAD, rows.map(function (r) {
    return { id8: String(r[0]), name: r[1], kana: r[2], sex: r[3], grade: +r[4], 'class': +r[5], no: +r[6] };
  }));
  return rows.length;
}

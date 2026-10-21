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
    // クラス分けテストの点数：満点と、学年で上位何割を「賢い」にするかの既定（年度・学年ごとに直せる）
    SCORE_DEF: { max: 100, top: 0.1 }, // top＝段の刻み（1段＝賢い）
    TIER_MAX: 10, // 段は10段まで（刻みが細かくても、下の方はまとめる）
    // 備考の定型の言葉（選ぶと備考の入力欄に入る）
    MEMO_PICKS: [
      { label: '発達特性', items: ['自閉症', '自閉傾向', 'ADHD傾向', 'LD傾向', '感覚過敏', 'こだわりが強い', '切り替えが苦手'] },
      { label: '性分', items: ['ぼーっとしている', '優しい', '世話焼き', 'おとなしい', '活発', '負けず嫌い', '気分の波がある', '人見知り', 'まじめ'] },
      { label: '身辺整理', items: ['忘れ物が多い', '提出物△', '整理整頓が苦手', '時間を守るのが苦手', '身支度に時間がかかる'] },
      { label: '家庭環境', items: ['母子家庭', '父子家庭', '祖父母が養育', '離婚調停中', '別居中', '再婚家庭', '里親・施設から通学', '保護者が多忙', '保護者と連絡が取りにくい', '保護者が日本語に不慣れ'] },
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
      { k: 'inc',  label: '事案数', s: '事案', w: 1 },  // 0にすると案を作る条件に入れない
      { k: 'acad', label: '学力の段', s: '段', w: 2 }   // 点数・順位の2段から下（1段＝賢いは「賢い」の重み）を組ごとにそろえる
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
    INCIDENT_TYPES: ['対人', '物損', 'いじめ', 'けが', '虞犯', 'その他'],
    TYPE_RUBY: { '虞犯': 'ぐはん' }, // 事案の種別のふりがな（画面で漢字の上に出す）
    // 事案の記録の時間帯（学校の時程）。設定で並びと名前を変えられる
    TIME_SLOTS: ['朝休み', '1校時', '2校時', '中休み', '3校時', '4校時', '給食', '昼休み', '掃除', '5校時', '6校時', '放課後'],
    // 記録の欄の定型文（右の「記入補助」に、選んでいる欄の分を出す。押すかドラッグで入る）
    // 欄：hk 発覚・kk 経緯・sd 指導・s2sd 指導の経過・vi 被害の様子・ha 加害の様子・kikan 関係機関
    // 文は各地の教育委員会のいじめ対応の手引き（聴き取りは複数の教員で個別に・食い違いは再確認・双方の保護者への連絡・
    // 謝罪は被害児童の意向を確かめて・解消は行為が止んで3か月）と、様式Ⅰの記入例をもとにした
    PHRASES: {
      hk: ['本人から担任に訴えがあった', '保護者から電話で相談があった', '保護者から連絡帳で訴えがあった', '他の児童から担任に報告があった', '担任が休み時間に現認した', '他の教職員が現認し、担任に伝えた', '生活アンケートの記述から分かった', '教育相談で本人が話した', '養護教諭が保健室で話を聞いて分かった'],
      kk: ['に悪口を言った', 'をからかった', 'を叩いた', 'を蹴った', 'の持ち物を隠した', 'の持ち物を壊した', 'を仲間外れにした', 'を無視した', 'についてSNSに書き込んだ', 'に金品を要求した', 'に嫌なことをさせた', '以前から同じようなことがあったと話した', '周りの児童も見ていた'],
      sd: ['複数の教員で、関係する児童から個別に聴き取りをした', '聴き取りの内容を突き合わせ、食い違う点を再度確かめた', 'いじめ対応チームを招集し、対応を協議した', '管理職に報告した', '学年の教員で情報を共有した', '加害児童に、行為の意味と相手の気持ちを考えさせる指導をした', '被害児童に、学校が守ることを伝えた', '被害児童の意向を確かめたうえで、加害児童が謝罪した', '被害児童の保護者に、事実と学校の対応を電話で伝えた', '加害児童の保護者に、事実と指導の内容を伝えた', '家庭でも話をしてもらうよう依頼した', '休み時間の見守りを強めた', '座席や班を配慮した', '今後も見守りを続けることを伝えた'],
      s2sd: ['被害児童から、その後の様子を聴き取った', '加害児童に、その後の様子を確かめた', 'いじめ対応チームで経過を確かめた', '行為が止んでいることを確かめた', '行為が止んでから3か月、見守りを続けている', '双方の保護者に経過を伝えた', '加害児童に再度指導した'],
      vi: ['元気に登校している', '学級で落ち着いて過ごしている', '加害児童とも普段どおり関わっている', '心身の苦痛は感じていないと話している', 'まだ不安を感じていると話している', '保護者は学校の対応を了承している', '保護者は今後の見守りを希望している'],
      ha: ['反省していると話している', '被害児童に謝罪した', '同じことはしないと約束した', 'その後、同じような行為は見られない', '保護者は家庭でも指導したと話している', '保護者が、被害児童の保護者に謝罪の意向を示した'],
      kikan: ['スクールカウンセラーと面談した', 'スクールソーシャルワーカーと連携した', '子ども家庭センターに相談した', '少年サポートセンターにつないだ', '警察に相談した', '医療機関を受診した', '関係機関との連携はなし']
    },
    // 指導の欄の「よくある手順」（チェックすると、その文の行ができる）。保護者への連絡が無いまま登録すると一度だけ知らせる
    SD_STEPS: ['複数の教員で、関係する児童から個別に聴き取りをした', '管理職に報告した', 'いじめ対応チームを招集し、対応を協議した', '被害児童の保護者に、事実と学校の対応を電話で伝えた', '加害児童の保護者に、事実と指導の内容を伝えた'],
    // 事案の対応の状況（事案カードの右に出す）。既定は「対応中」
    STATUS: [{ k: 'open', label: '対応中' }, { k: 'done', label: '指導済み' }, { k: 'watch', label: '経過観察' }, { k: 'closed', label: '解消' }],
    // いじめの報告の段階。簡易→様式Ⅰ→様式Ⅱ→重大事態の順に、同じ色相で濃くする（文字でも段階を書く）
    BULLY_LEVELS: [
      { k: 'light', label: '簡易', c: '#F6D3CC', t: '#5A1A10' },
      { k: 'f1', label: '様式Ⅰ', c: '#E58A76', t: '#3A0E06' },
      { k: 'f2', label: '様式Ⅱ', c: '#C0392B', t: '#FFFFFF' },
      { k: 'grave', label: '重大事態', c: '#6E1208', t: '#FFFFFF' }
    ],
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
      { t: '性的な嫌がらせや性的な行為をされる', note: '卑猥なことを言われる、身体を触られる、性的な動画・画像を撮影・送信されるなど', cell: 'B26' },
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
    TEACHER_DOMAIN: 'edu.nishi.or.jp',
    // 児童のアカウント（数字8桁@kyoiku.edu.nishi.or.jp）。教員のドメインの末尾と重なるので、別に名指しして必ず断る
    STUDENT_DOMAIN: 'kyoiku.edu.nishi.or.jp'
  };

  // 定型文と指導の手順は、文の終わりに句点を付けて持つ（入れたまま文として終わる）
  (function () {
    var end = function (t) { return /[。！？]$/.test(t) ? t : t + '。'; };
    Object.keys(CONFIG.PHRASES).forEach(function (k) { if (k !== 'kikan') CONFIG.PHRASES[k] = CONFIG.PHRASES[k].map(end); });
    CONFIG.SD_STEPS = CONFIG.SD_STEPS.map(end);
  })();

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
  // 兄弟：[{ r: 続柄, g: 学年（0＝未就学、1〜6、7〜9＝中1〜3、10＝高校以上）, n: 名前（任意） }]。決定で来年度に写す時は学年を1つ上げる
  CONFIG.SIB_REL = ['兄', '姉', '弟', '妹'];
  CONFIG.SIB_GRADES = [[0, '未就学'], [1, '1年'], [2, '2年'], [3, '3年'], [4, '4年'], [5, '5年'], [6, '6年'], [7, '中1'], [8, '中2'], [9, '中3'], [10, '高校以上']];
  CONFIG.normSibs = function (list) {
    if (typeof list === 'string') { try { list = JSON.parse(list || '[]'); } catch (e) { list = []; } }
    return (Array.isArray(list) ? list : []).slice(0, 8).map(function (x) {
      var g = Math.floor(+(x && x.g)); if (!(g >= 0 && g <= 10)) g = 0;
      return { r: CONFIG.SIB_REL.indexOf(x && x.r) >= 0 ? x.r : '兄', g: g, n: String((x && x.n) || '').replace(/[<>&"'`]/g, '').trim().slice(0, 20) };
    });
  };
  CONFIG.sibText = function (list) {
    return CONFIG.normSibs(list).map(function (x) { var gl = CONFIG.SIB_GRADES.filter(function (q) { return q[0] === x.g; })[0]; return x.r + '（' + (gl ? gl[1] : '') + '）' + (x.n ? x.n : ''); }).join('、');
  };
  CONFIG.nextSibs = function (list) { return CONFIG.normSibs(list).map(function (x) { return { r: x.r, g: x.g > 0 ? Math.min(10, x.g + 1) : 0, n: x.n }; }); };
  // 家庭環境：備考の文から、定型の言葉（MEMO_PICKS の「家庭環境」）を拾う（個人票の印刷で、備考の欄の下にまとめて出す）
  CONFIG.familyWords = function (memo) {
    var grp = CONFIG.MEMO_PICKS.filter(function (gp) { return gp.label === '家庭環境'; })[0], m = String(memo || '');
    return grp ? grp.items.filter(function (w) { return m.indexOf(w) >= 0; }) : [];
  };
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
    // 学力の段（2段から下）：段ごとの人数を組でそろえる。1段は「賢い」として上で数える
    var tierMax = 0; P.kids.forEach(function (s) { var t = s.a && s.a.tier | 0; if (t > tierMax) tierMax = t; });
    if ((gen.w.acad | 0) > 0) for (var tr = 2; tr <= tierMax; tr++) (function (tr) {
      MET.push({ k: 'acad' + tr, grp: 'acad', label: '学力' + tr + '段', w: C.LEVEL_W[gen.w.acad | 0], tol: 1, v: function (s) { return (s.a && s.a.tier | 0) === tr ? 1 : 0; } });
    })(tr);
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
    // 入れ替えのたびに全部を数え直さない：つける・離すは入れ替えた2人に関わる組だけ、事案は2人が関わる事案だけを差し引きする
    var hard = ctx.gen.hard, PAIRS = ctx.P.pairs;
    var brokenOf = function (list) { var n = 0; for (var q = 0; q < list.length; q++) { var p0 = PAIRS[list[q]]; if (hard[p0.t] && pairBroken(p0, asg)) n++; } return n; };
    var INC = ctx.wInc ? (ctx.P.inc || []) : [], incOf = [], cnt = [], v = new Array(nc).fill(0);
    if (ctx.wInc) {
      for (i = 0; i < N; i++) incOf.push([]);
      INC.forEach(function (x, xi) { var row = new Array(nc).fill(0); x.kids.forEach(function (q) { incOf[q].push(xi); if (!row[asg[q]]++) v[asg[q]]++; }); cnt.push(row); });
    }
    var moveInc = function (q, from, to) { var l = incOf[q]; for (var t0 = 0; t0 < l.length; t0++) { var row = cnt[l[t0]]; if (!--row[from]) v[from]--; if (!row[to]++) v[to]++; } };
    var incPen = function () { var m0 = 0, t1 = 0, k0; for (k0 = 0; k0 < nc; k0++) m0 += v[k0]; m0 /= nc; for (k0 = 0; k0 < nc; k0++) t1 += (v[k0] - m0) * (v[k0] - m0); return ctx.wInc * t1; };
    var IT = 50000, T = 8, cool = Math.pow(0.002 / 8, 1 / IT);
    for (var it = 0; it < IT; it++, T *= cool) {
      i = free[Math.floor(r() * free.length)]; j = free[Math.floor(r() * free.length)];
      var a = asg[i], b = asg[j];
      if (a === b) continue;
      var vi = ctx.VAL[i], vj = ctx.VAL[j], m, d;
      for (m = 0; m < M; m++) { d = vj[m] - vi[m]; c[a][m] += d; c[b][m] -= d; }
      var rel = ctx.relOf[i].length || ctx.relOf[j].length ? ctx.relOf[i].concat(ctx.relOf[j].filter(function (q) { return ctx.relOf[i].indexOf(q) < 0; })) : null; // 2人に共通の組は1回だけ数える
      var before = rel ? brokenOf(rel) : 0;
      asg[i] = b; asg[j] = a;
      var npv = rel ? pv - before + brokenOf(rel) : pv;
      if (ctx.wInc) { moveInc(i, a, b); moveInc(j, b, a); }
      var nxt = W_HARD * npv + balance(ctx, c) + (ctx.wInc ? incPen() : 0);
      if (nxt <= cur || r() < Math.exp((cur - nxt) / T)) { cur = nxt; pv = npv; }
      else { asg[i] = a; asg[j] = b; for (m = 0; m < M; m++) { d = vj[m] - vi[m]; c[a][m] -= d; c[b][m] += d; } if (ctx.wInc) { moveInc(j, a, b); moveInc(i, b, a); } }
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
      if (s.a.sib && s.a.sib.length) a.sib = C.nextSibs(s.a.sib); // 兄弟の学年は1つ上げて写す
      return { id: s.id, cls: num[i].cls, no: num[i].no, a: a };
    });
  }

  // ===== 事案の関係図 =====
  // d = { v:1, nodes:[{id,x,y}], groups:[{g:'A', members:[id]}], edges:[{f:'k:ID'|'g:A', t:同じ}] }
  // 矢印は「加害」を表す。座標は 640×320 の論理座標。児童は1つのグループにだけ入る
  var DG_W = 640, DG_H = 320;
  // 誰か分からない児童（加害者が不明など）：関係図にだけ置く「？」のカード。id は ? で始まり、名簿の児童には結び付けない
  function isUnknown(id) { return String(id).charAt(0) === '?'; }
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
  // 保存時の整理（利用者の置いた位置を元に、動かす量を少なく）：
  // 1) 矢印の出入りがまったく同じ児童（グループに入っていない、矢印のある児童）が2人以上いれば、グループにまとめて矢印を1本にする
  // 2) 矢印で結ばれ、ほぼ水平・ほぼ垂直の組は、高さ・横位置を揃える（はっきり斜めの線は残す）
  // 3) 段と段の空きを詰めて、縦幅を無駄に大きくしない（上下の並び順は変えない）
  // 整理で使う、論理座標でのおおよその大きさ（児童の札・グループの枠）
  var DG_HW = 50, DG_HH = 28;
  function dgBox(d, end) {
    var p = String(end).split(':'), ns;
    if (p[0] === 'k') ns = d.nodes.filter(function (n) { return n.id === p[1]; });
    else { var gr = d.groups.filter(function (x) { return x.g === p[1]; })[0]; ns = gr ? d.nodes.filter(function (n) { return gr.members.indexOf(n.id) >= 0; }) : []; }
    if (!ns.length) return null;
    var pad = p[0] === 'g' ? 12 : 0, b = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
    ns.forEach(function (n) { b.x1 = Math.min(b.x1, n.x - DG_HW - pad); b.x2 = Math.max(b.x2, n.x + DG_HW + pad); b.y1 = Math.min(b.y1, n.y - DG_HH - pad); b.y2 = Math.max(b.y2, n.y + DG_HH + pad); });
    b.cx = (b.x1 + b.x2) / 2; b.cy = (b.y1 + b.y2) / 2; b.ids = ns.map(function (n) { return n.id; });
    return b;
  }
  function segCross(a, b, c, e) {
    var o = function (p, q, r) { var v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return Math.abs(v) < 1e-6 ? 0 : v > 0 ? 1 : -1; };
    var o1 = o(a, b, c), o2 = o(a, b, e), o3 = o(c, e, a), o4 = o(c, e, b);
    if (o1 && o2 && o3 && o4) return o1 !== o2 && o3 !== o4;
    if (!o1 && !o2) { // 同じ直線上：重なっていれば重なり
      var ax = Math.abs(a[0] - b[0]) > Math.abs(a[1] - b[1]) ? 0 : 1;
      var lo = Math.max(Math.min(a[ax], b[ax]), Math.min(c[ax], e[ax])), hi = Math.min(Math.max(a[ax], b[ax]), Math.max(c[ax], e[ax]));
      return hi - lo > 1;
    }
    return false;
  }
  function segHitsBox(p, q, b) {
    var t0 = 0, t1 = 1, dx = q[0] - p[0], dy = q[1] - p[1];
    var cl = function (pp, qq) { if (!pp) return qq >= 0; var r = qq / pp; if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
    return cl(-dx, p[0] - b.x1) && cl(dx, b.x2 - p[0]) && cl(-dy, p[1] - b.y1) && cl(dy, b.y2 - p[1]) && t1 - t0 > 1e-6;
  }
  // 交差・重なりの数：矢印どうしの交差（端を共にしない）・同じ線上の重なり・矢印が関係しない児童を通る・児童の札どうしの重なり
  function dgProblems(d) {
    var segs = d.edges.map(function (e) { var a = dgBox(d, e.f), b = dgBox(d, e.t); return a && b ? { e: e, a: a, b: b, p: [a.cx, a.cy], q: [b.cx, b.cy] } : null; }).filter(Boolean), n = 0;
    for (var i = 0; i < segs.length; i++) {
      for (var j = i + 1; j < segs.length; j++) {
        var s1 = segs[i], s2 = segs[j];
        var share = s1.e.f === s2.e.f || s1.e.f === s2.e.t || s1.e.t === s2.e.f || s1.e.t === s2.e.t;
        if (share) { if (segCross(s1.p, s1.q, s2.p, s2.q) && !(s1.e.f === s2.e.t && s1.e.t === s2.e.f)) { // 端を共にして同じ向きに重なる
          var u1 = [s1.q[0] - s1.p[0], s1.q[1] - s1.p[1]], u2 = [s2.q[0] - s2.p[0], s2.q[1] - s2.p[1]];
          if (Math.abs(u1[0] * u2[1] - u1[1] * u2[0]) < 1e-6) n++;
        } } else if (segCross(s1.p, s1.q, s2.p, s2.q)) n++;
      }
      d.nodes.forEach(function (nd) {
        var s0 = segs[i]; if (s0.a.ids.indexOf(nd.id) >= 0 || s0.b.ids.indexOf(nd.id) >= 0) return;
        if (segHitsBox(s0.p, s0.q, { x1: nd.x - DG_HW + 6, x2: nd.x + DG_HW - 6, y1: nd.y - DG_HH + 6, y2: nd.y + DG_HH - 6 })) n++;
      });
    }
    for (var a = 0; a < d.nodes.length; a++) for (var b = a + 1; b < d.nodes.length; b++) {
      var p1 = d.nodes[a], p2 = d.nodes[b];
      if (Math.abs(p1.x - p2.x) < DG_HW * 2 - 4 && Math.abs(p1.y - p2.y) < DG_HH * 2 - 4) n++;
    }
    return n;
  }
  var TIDY_SNAP = 40, TIDY_GAP = 100, TIDY_TOP = 45;
  function tidyDiagram(d0) {
    var d = normDiagram(JSON.parse(JSON.stringify(d0 || {})));
    var inG = {}; d.groups.forEach(function (gr) { gr.members.forEach(function (id) { inG[id] = gr.g; }); });
    var sig = {};
    d.nodes.forEach(function (n) {
      if (inG[n.id]) return;
      var k = 'k:' + n.id, o = [], i = [];
      d.edges.forEach(function (e) { if (e.f === k) o.push(e.t); if (e.t === k) i.push(e.f); });
      if (!o.length && !i.length) return;
      var key = o.sort().join(',') + '|' + i.sort().join(',');
      (sig[key] = sig[key] || []).push(n.id);
    });
    var LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    Object.keys(sig).forEach(function (key) {
      var ms = sig[key]; if (ms.length < 2) return;
      var used = d.groups.map(function (gr) { return gr.g; }), gname = LET.split('').filter(function (c) { return used.indexOf(c) < 0; })[0];
      if (!gname) return;
      d.groups.push({ g: gname, members: ms.slice() });
      var ks = {}; ms.forEach(function (id) { ks['k:' + id] = 1; });
      var seen = {}, edges = [];
      d.edges.forEach(function (e) {
        var f = ks[e.f] ? 'g:' + gname : e.f, t = ks[e.t] ? 'g:' + gname : e.t, k2 = f + '>' + t;
        if (f === t || seen[k2]) return; seen[k2] = 1; edges.push({ f: f, t: t });
      });
      d.edges = edges;
      // まとめた児童は、いちばん上の児童の下に縦に寄せる（横は平均）
      var ns = d.nodes.filter(function (n) { return ks['k:' + n.id]; }).sort(function (a, b) { return a.y - b.y; });
      var cx = ns.reduce(function (s0, n) { return s0 + n.x; }, 0) / ns.length;
      ns.forEach(function (n, j) { n.x = Math.round(cx); n.y = ns[0].y + j * (DG_HH * 2 + 4); });
    });
    // 動かす単位：グループ（中の児童ごと）と、グループに入っていない児童
    var byId = {}; d.nodes.forEach(function (n) { byId[n.id] = n; });
    var unit = {};
    d.groups.forEach(function (gr) { unit['g:' + gr.g] = gr.members.map(function (id) { return byId[id]; }).filter(Boolean); });
    d.nodes.forEach(function (n) { var g0 = d.groups.filter(function (gr) { return gr.members.indexOf(n.id) >= 0; })[0]; if (!g0) unit['k:' + n.id] = [n]; });
    var ctr = function (u) { var ns = unit[u] || []; return ns.length ? [ns.reduce(function (s0, n) { return s0 + n.x; }, 0) / ns.length, ns.reduce(function (s0, n) { return s0 + n.y; }, 0) / ns.length] : null; };
    var shift = function (u, dx, dy) { (unit[u] || []).forEach(function (n) { n.x += dx; n.y += dy; }); };
    // ほぼ水平（ほぼ垂直）の線で結ばれた単位を束ね、束ごとに平均の高さ（横位置）に揃える
    [1, 0].forEach(function (ax) {
      var par = {}, find = function (u) { while (par[u] && par[u] !== u) u = par[u]; return u; };
      Object.keys(unit).forEach(function (u) { par[u] = u; });
      d.edges.forEach(function (e) {
        var a = ctr(e.f), b = ctr(e.t); if (!a || !b) return;
        var along = Math.abs(a[1 - ax] - b[1 - ax]), across = Math.abs(a[ax] - b[ax]);
        if (across > 0 && across <= TIDY_SNAP && along > across * 2) par[find(e.f)] = find(e.t);
      });
      var sets = {}; Object.keys(unit).forEach(function (u) { (sets[find(u)] = sets[find(u)] || []).push(u); });
      Object.keys(sets).forEach(function (r) {
        var us = sets[r]; if (us.length < 2) return;
        var m = us.reduce(function (s0, u) { return s0 + ctr(u)[ax]; }, 0) / us.length;
        us.forEach(function (u) { var c = ctr(u)[ax]; shift(u, ax ? 0 : m - c, ax ? m - c : 0); });
      });
    });
    // 矢印の交差・重なり（線が別の児童を通る・同じ線上に重なる・児童どうしが重なる）を、少ない移動で無くす
    var orig = {}; d.nodes.forEach(function (n) { orig[n.id] = [n.x, n.y]; });
    var bad = function () { return dgProblems(d); };
    var cost = function () {
      var c = bad() * 1000;
      d.edges.forEach(function (e) { var a = dgBox(d, e.f), b = dgBox(d, e.t); if (a && b && Math.abs(a.cx - b.cx) > 1 && Math.abs(a.cy - b.cy) > 1) c += 3; });
      d.nodes.forEach(function (n) { c += (Math.abs(n.x - orig[n.id][0]) + Math.abs(n.y - orig[n.id][1])) / 10; });
      return c;
    };
    var MOVES = [[0, 50], [0, -50], [0, 100], [0, -100], [0, 150], [0, -150], [0, 200], [0, -200], [80, 0], [-80, 0], [160, 0], [-160, 0], [80, 50], [-80, 50], [80, -50], [-80, -50]];
    var inside = function (u) { return (unit[u] || []).every(function (n) { return n.x >= 30 && n.x <= DG_W - 30 && n.y >= 20 && n.y <= DG_H - 20; }); };
    var t0 = Date.now(); // 大きな図でも待たせない：0.3秒で打ち切る（それまでに直せた所までで止める）
    for (var it = 0; it < 40 && Date.now() - t0 < 300 && bad(); it++) {
      var c0 = cost(), best = null;
      Object.keys(unit).forEach(function (u) {
        MOVES.forEach(function (m) {
          shift(u, m[0], m[1]);
          if (inside(u)) { var c1 = cost(); if (c1 < c0 - 0.5 && (!best || c1 < best.c)) best = { u: u, m: m, c: c1 }; }
          shift(u, -m[0], -m[1]);
        });
      });
      // 2つの単位の位置を入れ替える（交差は1つずつの移動では解けないことが多い）
      var us = Object.keys(unit);
      for (var i1 = 0; i1 < us.length; i1++) for (var i2 = i1 + 1; i2 < us.length; i2++) {
        var p1 = ctr(us[i1]), p2 = ctr(us[i2]), m = [p2[0] - p1[0], p2[1] - p1[1]];
        shift(us[i1], m[0], m[1]); shift(us[i2], -m[0], -m[1]);
        var c2 = cost(); if (c2 < c0 - 0.5 && (!best || c2 < best.c)) best = { u: us[i1], u2: us[i2], m: m, c: c2 };
        shift(us[i1], -m[0], -m[1]); shift(us[i2], m[0], m[1]);
      }
      if (!best) break;
      shift(best.u, best.m[0], best.m[1]); if (best.u2) shift(best.u2, -best.m[0], -best.m[1]);
    }
    // 段の空きを詰める（詰めて交差・重なりが増えるなら詰めない）
    var b0 = bad(), keep = d.nodes.map(function (n) { return [n.x, n.y]; });
    var ys = d.nodes.map(function (n) { return n.y; }).sort(function (a, b) { return a - b; }), map = {}, cur = TIDY_TOP;
    ys.forEach(function (y, i) { if (i) cur += Math.min(y - ys[i - 1], TIDY_GAP); map[y] = cur; });
    d.nodes.forEach(function (n) { n.y = map[n.y]; });
    if (bad() > b0) d.nodes.forEach(function (n, i) { n.x = keep[i][0]; n.y = keep[i][1]; });
    d.nodes.forEach(function (n) {
      n.y = Math.round(Math.max(0, Math.min(DG_H, n.y)));
      n.x = Math.round(Math.max(0, Math.min(DG_W, n.x)));
    });
    return d;
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
    normDiagram: normDiagram, diagramRoles: diagramRoles, isUnknown: isUnknown, UNKNOWN_NAME: '？', diagramPattern: diagramPattern, tidyDiagram: tidyDiagram, diagramProblems: dgProblems, ROLE_NAMES: ROLE_NAMES, DG_W: DG_W, DG_H: DG_H
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
    return { light: false, level: '', status: 'open', reported: '', found: '', modes: C.MODES.map(function () { return false; }), other: '', s1: { hk: [], kk: [], sd: [] }, s2: { sd: [], vi: [], ha: [], kikan: '' }, s2v: {} };
  }
  function norm(r) {
    var e = emptyReport(); r = r || {};
    var rows = function (a) { return (a || []).filter(function (x) { return x && String(x.t || '').trim(); }).map(function (x) { return { d: String(x.d || ''), p: String(x.p || ''), t: String(x.t || '') }; }); };
    e.level = C.BULLY_LEVELS.some(function (x) { return x.k === r.level; }) ? r.level : '';
    e.status = C.STATUS.some(function (x) { return x.k === r.status; }) ? r.status : 'open';
    e.reported = /^\d{4}-\d{2}-\d{2}$/.test(String(r.reported || '')) ? String(r.reported) : ''; // 市教委（生徒指導担当）へ報告した日。空＝未報告
    e.light = !!r.light; e.found = String(r.found || ''); e.other = String(r.other || '');
    e.modes = C.MODES.map(function (m, i) { return !!(r.modes && r.modes[i]); });
    ['hk', 'kk', 'sd'].forEach(function (k) { e.s1[k] = rows(r.s1 && r.s1[k]); });
    ['sd', 'vi', 'ha'].forEach(function (k) { e.s2[k] = rows(r.s2 && r.s2[k]); });
    e.s2.kikan = String(r.s2 && r.s2.kikan || '');
    // 被害の児童が複数の時：様式Ⅱの「被害児童・保護者の様子」は児童ごと（id → 行）
    Object.keys(r.s2v || {}).forEach(function (id) { var a = rows(r.s2v[id]); if (a.length) e.s2v[id] = a; });
    return e;
  }
  function dateParts(iso) {
    var p = String(iso || '').split('-'), y = +p[0], m = +p[1], d = +p[2];
    if (!y || !m || !d) return null;
    return { y: y, m: m, d: d, w: WD[new Date(y, m - 1, d).getDay()] };
  }
  function md(iso) { var x = dateParts(iso); return x ? x.m + '月' + x.d + '日（' + x.w + '）' : ''; }
  // 記録の行を「日付 時間帯、内容」にして改行でつなぐ（日付・時間帯の順。同じなら入力した順）
  // 選べる時間帯：設定の時程に、続いた2つの授業の間を「N校時後」として足す（例：1校時と2校時の間＝1校時後）
  function slots() {
    var b = C.TIME_SLOTS, out = [];
    b.forEach(function (p, i) {
      out.push(p);
      var a = /^(\d+)校時$/.exec(p), n = b[i + 1] && /^(\d+)校時$/.exec(b[i + 1]);
      if (a && n) out.push(a[1] + '校時後');
    });
    return out;
  }
  // 次の行の既定：同じ日の次の時間帯。最後（放課後）の次は、次の登校日（土日を飛ばす）の最初の時間帯
  function addDays(d, n) {
    var x = String(d).split('-'), t = new Date(+x[0], +x[1] - 1, +x[2]);
    if (isNaN(t)) return d;
    t.setDate(t.getDate() + n);
    return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
  }
  // ===== 国民の祝日（内閣府の祝日法の決まりから計算する。2000年以降） =====
  // 固定の日・ハッピーマンデー・春分と秋分（近似式）・振替休日・国民の休日（祝日に挟まれた平日）
  function ymd(t) { return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); }
  function nthMonday(y, m, n) { var t = new Date(y, m - 1, 1), off = (8 - t.getDay()) % 7; return 1 + off + (n - 1) * 7; }
  var HOL = {};
  function baseHolidays(y) {
    var h = {}, add = function (m, d) { h[ymd(new Date(y, m - 1, d))] = 1; };
    add(1, 1); add(1, nthMonday(y, 1, 2)); add(2, 11); if (y >= 2020) add(2, 23);
    add(3, Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4)));
    add(4, 29); add(5, 3); add(5, 4); add(5, 5);
    if (y === 2020) add(7, 23); else if (y === 2021) add(7, 22); else add(7, nthMonday(y, 7, 3));
    if (y === 2020) add(7, 24); else if (y === 2021) add(7, 23); else if (y !== 2020 && y !== 2021) add(10, nthMonday(y, 10, 2));
    if (y === 2020) add(8, 10); else if (y === 2021) add(8, 8); else add(8, 11);
    add(9, nthMonday(y, 9, 3));
    add(9, Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4)));
    add(11, 3); add(11, 23);
    return h;
  }
  function holidaysOf(y) {
    if (HOL[y]) return HOL[y];
    var h = baseHolidays(y), out = {};
    Object.keys(h).forEach(function (k) { out[k] = 1; });
    // 振替休日：祝日が日曜なら、その後の最初の祝日でない日
    Object.keys(h).forEach(function (k) {
      var p = k.split('-'), t = new Date(+p[0], +p[1] - 1, +p[2]);
      if (t.getDay() !== 0) return;
      do { t.setDate(t.getDate() + 1); } while (out[ymd(t)]);
      out[ymd(t)] = 1;
    });
    // 国民の休日：前日と翌日が祝日の平日
    for (var t = new Date(y, 0, 2); t.getFullYear() === y; t.setDate(t.getDate() + 1)) {
      var a = new Date(t), b = new Date(t); a.setDate(a.getDate() - 1); b.setDate(b.getDate() + 1);
      if (!out[ymd(t)] && t.getDay() !== 0 && h[ymd(a)] && h[ymd(b)]) out[ymd(t)] = 1;
    }
    return (HOL[y] = out);
  }
  function isHoliday(iso) { var y = +String(iso).slice(0, 4); return !!(y && holidaysOf(y)[iso]); }
  function isOff(t) { return t.getDay() === 0 || t.getDay() === 6 || isHoliday(ymd(t)); }
  // 次の登校日（土日・祝日を飛ばす。夏休みなどの学校の休みは分からないので飛ばさない）
  function nextSchoolDay(d) {
    var x = String(d).split('-'), t = new Date(+x[0], +x[1] - 1, +x[2]);
    if (isNaN(t)) return d;
    do { t.setDate(t.getDate() + 1); } while (isOff(t));
    return ymd(t);
  }
  function nextSlot(d, p) {
    var L = slots(), i = L.indexOf(p);
    if (i < 0 || i < L.length - 1) return { d: d, p: i < 0 ? p : L[i + 1] };
    return { d: nextSchoolDay(d), p: L[0] };
  }
  function lines(rows) {
    var L = slots(), slot = function (p) { var i = L.indexOf(p); return i < 0 ? 99 : i; };
    return rows.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
      return (a.x.d || '9999') < (b.x.d || '9999') ? -1 : (a.x.d || '9999') > (b.x.d || '9999') ? 1 : slot(a.x.p) - slot(b.x.p) || a.i - b.i;
    }).reduce(function (acc, o) {
      // 同じ日の行は1行につなぎ、日付が変わったら改行する。日付は行の初めにだけ書く
      var t = tidy(o.x.t); if (!t) return acc;
      var last = acc[acc.length - 1], head = (o.x.p ? o.x.p + '、' : '');
      if (last && last.d === o.x.d) last.s += head + t;
      else acc.push({ d: o.x.d, s: md(o.x.d) + (head || (o.x.d ? '、' : '')) + t });
      return acc;
    }, []).map(function (g) { return g.s; }).join('\n');
  }
  // 文を整える：空の行と句点の後の空白を消し、終わりに句点が無ければ足す
  function tidy(t) {
    t = String(t || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).join('\n');
    t = t.replace(/。[ 　\t]+/g, '。');
    if (t && !/[。！？!?」）)]$/.test(t)) t += '。';
    return t;
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
      put('B' + row, k.grade); put('D' + row, k.cls); put('G' + row, k.male ? '男' : '女'); put('I' + row, k.kana || ''); put('I' + (row + 1), nospace(k.name));
    };
    if (o.victim) kidRow(H.victim, o.victim);
    if (kind === 'f2') {
      put(R.f2.shido, lines(rep.s2.sd));
      var vi = o.victim && rep.s2v[o.victim] ? rep.s2v[o.victim] : rep.s2.vi;
      if (vi.length) put(R.f2.victim, '（被害児童生徒及び保護者）\n' + lines(vi));
      if (rep.s2.ha.length) put(R.f2.harm, '（加害児童生徒及び保護者）\n' + lines(rep.s2.ha));
      put(R.f2.kikan, rep.s2.kikan);
      return withNames(out, [R.f2.shido, R.f2.victim, R.f2.harm, R.f2.kikan], o.people);
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
    return withNames(out, [R.f1.gaiyou], o.people);
  }
  function nospace(n) { return String(n || '').replace(/[ 　]+/g, ''); }
  // 文の中の児童の名前：姓と名の間の空白を消し、書類の中で最初に出る所だけ学年と組を括弧で付ける
  // 関係する児童が全員同じ学年なら組だけ（例：田中ハト(2組)）、違えば学年も（例：田中ハト(6年2組)）
  function withNames(out, refs, people) {
    people = (people || []).filter(function (p) { return p && p.name; });
    if (!people.length) return out;
    var one = people.every(function (p) { return p.grade === people[0].grade; }), seen = {};
    var esc = function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
    // 長い名前から当てる（「田中ハト」と「田中ハトコ」のような重なりで短い方が先に当たらないように）
    var list = people.slice().sort(function (a, b) { return nospace(b.name).length - nospace(a.name).length; });
    refs.forEach(function (ref) {
      if (typeof out[ref] !== 'string') return;
      var t = out[ref];
      list.forEach(function (p) {
        var n = nospace(p.name), re = new RegExp(esc(n).split('').join('[ 　]?'), 'g');
        t = t.replace(re, function () {
          if (seen[n]) return n;
          seen[n] = 1;
          return n + '(' + (one ? '' : p.grade + '年') + p.cls + '組)';
        });
      });
      out[ref] = t;
    });
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
  function xesc(s) { return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\r?\n/g, '&#10;'); } // 改行は文字参照にする（そのままの改行を捨てる表計算ソフトがある）
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

  g.Report = { addDays: addDays, isHoliday: isHoliday, nextSchoolDay: nextSchoolDay, tidy: tidy, slots: slots, nextSlot: nextSlot, SECTIONS: SECTIONS, SECTIONS2: SECTIONS2, emptyReport: emptyReport, norm: norm, lines: lines, md: md, cells: cells, allowedCells: allowedCells,
    setCell: setCell, fillSheet: fillSheet, sheetPath: sheetPath, activate: activate, untab: untab };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ==================== server.gs ==================== */
// サーバー（GAS）。scripts/build.py が config.js・engine.js の後ろにつなげて dist/gas/Code.gs を作る。
// 役目は「読み込み（学年ごとに1回）と保存」だけ。計算と描画はブラウザ側（docs/design.md §5）。
// コメントは GAS 上で消えることがあるので、意味を持たせない（principles/gas-javascript-notes.md §1）。

var SERVER_BUILD = 'BUILD_1fe28ac245c4';
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
  // 教員は「…@edu.nishi.or.jp」ちょうど（サブドメインは不可）。児童のドメインと、数字8桁の名前は、どのドメインでも断る
  var at = email.lastIndexOf('@'), local = email.slice(0, at), domain = email.slice(at + 1);
  var student = domain === CONFIG.STUDENT_DOMAIN || /\.kyoiku\./.test('.' + domain) || /^\d{8}$/.test(local);
  var ok = at > 0 && domain === CONFIG.TEACHER_DOMAIN && !student;
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
  h.push('sib'); // 兄弟（JSON の並び。CONFIG.normSibs の形）。決定で来年度に写す時は学年を1つ上げる
  return h;
}
// シートに書く文字：= + - @ で始まると式として読まれるので、先頭に ' を付けて文字のまま残す
function plainText_(s, max) { s = String(s == null ? '' : s).slice(0, max || 200); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }

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
    forget_(); sh = ss.insertSheet(name);
    if (head) sh.getRange(1, 1, 1, head.length).setValues([head]);
  }
  return sh;
}
// 表を読む：見出しの名前で列を引く。無い表は空
// 1回の呼び出しの間だけ、読んだ表を覚える（設定などを何度も読むのを省く）。
// 何かを書いたら全部忘れ、ロックを取った時も忘れる（ロックの前に読んだ古い値で判断しない）
var READ_ = {};
function forget_() { READ_ = {}; }
function read_(name) {
  if (READ_[name]) return READ_[name];
  return (READ_[name] = readNow_(name));
}
function readNow_(name) {
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
  if (miss.length) { forget_(); sh.getRange(1, cur[0] ? w + 1 : 1, 1, miss.length).setValues([miss]); }
  return sh;
}
function rowOf_(head, o) { return head.map(function (h) { return o[h] === undefined ? '' : o[h]; }); }
function append_(name, head, objs) {
  if (!objs.length) return;
  var sh = sheet_(db_(), name, head);
  var cur = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  if (!cur[0]) cur = head;
  forget_(); sh.getRange(sh.getLastRow() + 1, 1, objs.length, cur.length).setValues(objs.map(function (o) { return rowOf_(cur, o); }));
}
// 書き戻しは変えた行の変えた列だけ（同時に別の行を直している人を上書きしない）
function writeCell_(t, row, col, value) {
  var c = t.head.indexOf(col);
  if (c < 0) throw new Error('列がありません：' + col);
  forget_(); t.sh.getRange(row._r, c + 1).setValue(value);
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw userError_('ほかの人が保存中です。少し待ってからもう一度');
  forget_();
  try { return fn(); } finally { lock.releaseLock(); }
}
function log_(by, action, n) { append_('log', TABLES_[5].head, [{ at: new Date(), by: by, action: action, n: n }]); }

function getSetting_(key, def) {
  var t = read_('settings');
  for (var i = 0; i < t.rows.length; i++) if (t.rows[i].key === key) { try { return JSON.parse(t.rows[i].json); } catch (e) { return def; } }
  return def;
}
function setSetting_(key, value) {
  if (value === null) { removeRows_('settings', function (r) { return r.key === key; }); return; } // 空にする時は行ごと消す（行が増え続けない）
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
    if (r.sib) { var sb = CONFIG.normSibs(String(r.sib)); if (sb.length) a.sib = sb; }
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
    forget_();
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
    scores: scoresOf_(years),
    pairsVer: (getSetting_('pairsver_' + FY + '_' + grade, { ver: 0 }).ver) || 0,
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
// 版つき（案と同じ）：読み込んだ時の版と違えば、ほかの先生が先に保存したので上書きしない
var apiSavePairs = api_(function (grade, pairs, baseVer) {
  var by = requireTeacher_();
  grade = +grade;
  var FY = CONFIG.fiscalYear(), name = 'pairs_' + FY + '_' + grade, vkey = 'pairsver_' + FY + '_' + grade;
  return withLock_(function () {
    if (decisionOf_(FY, grade)) throw userError_('クラス替えを決定したので直せません'); // 決定と同時に保存しても、決定の後は書かない
    var cur = getSetting_(vkey, { ver: 0 });
    if (baseVer != null && (+baseVer || 0) !== (+cur.ver || 0)) return { conflict: true, ver: cur.ver, by: cur.by || '' };
    setSetting_(vkey, { ver: (+cur.ver || 0) + 1, by: by });
    sheet_(db_(), name, PAIR_HEAD); ensureCols_(name, PAIR_HEAD);
    removeRows_(name, function (r) { return r._r > 1; });
    append_(name, PAIR_HEAD, (pairs || []).map(function (p) {
      return Object.assign({ type: p.t, a: String(p.a), b: p.t === 'fix' ? '' : String(p.b), k: p.t === 'fix' ? (+p.k) + 1 : '', by: by, at: new Date().toISOString() }, pairCells_(p, grade));
    }));
    return { n: (pairs || []).length, ver: (+cur.ver || 0) + 1 };
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
      var o = { id8: id, name: plainText_(x.name, 40), kana: plainText_(x.kana || '', 60), sex: x.male ? '男' : (x.sex || '女'), grade: grade, 'class': (+x.cls) + 1, no: +x.no };
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

// 事案の版：最後に直した時刻。直す時に読んだ時の版と比べ、ほかの先生が先に直していたら上書きしない
function revOf_(at) { return at instanceof Date ? at.toISOString() : String(at || ''); }
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
    return { id: +r.inc_id, rev: revOf_(r.at), date: isoDate_(r.date), dateEnd: r.date_end ? isoDate_(r.date_end) : '', detail: String(r.detail || ''), type: String(r.type), title: String(r.title), url: String(r.url), ids: kids[r.inc_id] || [], roles: roles[r.inc_id] || {}, diagram: dg, report: rp };
  });
}
// 事案の入力を確かめる：関係図があれば、関係する児童と役割は関係図から決める
function incidentInput_(x) {
  if (!x) throw userError_('事案が読めません');
  // 文書のURLは任意（事案管理の入力欄に記録を書くなら要らない）。貼るなら学校のドライブの文書だけ
  if (x.url && !/^https:\/\/(docs|drive)\.google\.com\//.test(String(x.url))) throw userError_('学校のドライブの文書のURLを貼ってください');
  var dg = x.diagram ? Engine.normDiagram(x.diagram) : null, ids, roles = {};
  if (dg && dg.nodes.length) {
    // 「？」（誰か分からない児童）は関係図にだけ残し、事案と児童の結び付き・役割には入れない
    ids = dg.nodes.map(function (n) { return n.id; }).filter(function (id) { return !Engine.isUnknown(id); });
    var all = Engine.diagramRoles(dg); ids.forEach(function (id) { if (all[id]) roles[id] = all[id]; });
  }
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
  return { ids: ids, roles: roles, diagram: dg, json: json, date: date, dateEnd: end, detail: plainText_(String(x.detail || '').trim(), 5000), type: plainText_(String(x.type), 60), url: String(x.url || ''), report: rp, rjson: rjson };
}
// 報告書の記録（発覚・経緯・指導、様式Ⅱの追記）を確かめる。文字数と行数に上限を置く
function reportInput_(r) {
  var rp = Report.norm(r), cut = function (a) {
    if (a.length > 80) throw userError_('記録の行が多すぎます（1つの欄に80行まで）');
    return a.map(function (x) { return { d: /^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '', p: String(x.p).slice(0, 20), t: String(x.t).slice(0, 2000) }; });
  };
  ['hk', 'kk', 'sd'].forEach(function (k) { rp.s1[k] = cut(rp.s1[k]); });
  ['sd', 'vi', 'ha'].forEach(function (k) { rp.s2[k] = cut(rp.s2[k]); });
  var v2 = {}; Object.keys(rp.s2v).slice(0, 40).forEach(function (id) { if (/^\d{1,20}$|^T\d+$/.test(id)) v2[id] = cut(rp.s2v[id]); }); rp.s2v = v2;
  rp.s2.kikan = rp.s2.kikan.slice(0, 2000); rp.other = rp.other.slice(0, 200);
  if (rp.found && CONFIG.FOUND_LIST.indexOf(rp.found) < 0) rp.found = '';
  return rp;
}
function isoDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

// 配慮項目は編集できる年度だけ（決定前＝今年度、決定後＝来年度）。決定後の今年度は凍結
// クラス分けテストの点数（年度・学年ごと）。{ max, top, s: { 児童ID: 点数 } }。上位の「賢い」は画面で決める（手動の賢いは消さない）
function scoresOf_(years) {
  var out = {};
  years.forEach(function (y) { var v = getSetting_('scores_' + y.fy + '_' + y.grade, null); if (v) out[y.fy] = v; });
  return out;
}
var apiSetScores = api_(function (fy, grade, v) {
  requireTeacher_();
  fy = +fy; grade = +grade;
  var FY = CONFIG.fiscalYear();
  var max = +v.max, top = +v.top, s = {};
  if (!(max > 0 && max <= 10000)) throw userError_('満点が違います');
  if (!(top > 0 && top < 1)) throw userError_('上位の割合が違います');
  var ids = {}; rosterRows_(fy).forEach(function (r) { if (r.grade === grade) ids[r.id] = 1; });
  Object.keys(v.s || {}).forEach(function (id) { var n = +v.s[id]; if (ids[id] && n >= 0 && n <= max) s[id] = n; });
  // 順位（1が上。組の中の男女ごとの順位）。点数と順位のどちらで「賢い」を決めるかは use（最後に保存した方の窓）
  var r = {}, nk = Object.keys(ids).length;
  Object.keys(v.r || {}).forEach(function (id) { var n = Math.floor(+v.r[id]); if (ids[id] && n >= 1 && n <= nk) r[id] = n; });
  var use = v.use === 'rank' ? 'rank' : 'score';
  return withLock_(function () {
    var dec = decisionOf_(FY, grade - (fy - FY)), editable = dec ? FY + 1 : FY;
    if (fy !== editable) throw userError_('この年度の点数は直せません');
    setSetting_('scores_' + fy + '_' + grade, { max: max, top: top, s: s, r: r, use: use }); return { ok: true };
  });
});

var apiSetAttr = api_(function (fy, grade, id, k, v, text, incs) {
  var by = requireTeacher_();
  fy = +fy; grade = +grade; v = +v;
  if (k === 'memo') { text = String(text == null ? '' : text).trim(); v = text ? 1 : 0; }
  if (k === 'sib') { text = JSON.stringify(CONFIG.normSibs(text)); v = text === '[]' ? 0 : 1; }
  var at = k === 'sp' ? { k: 'sp', max: 1 } : k === 'memo' || k === 'sib' ? { k: k, max: 1 } : CONFIG.ATTRS.filter(function (a) { return a.k === k; })[0];
  if (!at) throw userError_('項目が違います');
  if (!(v >= 0 && v <= at.max)) throw userError_('値が違います');
  var FY = CONFIG.fiscalYear(), cohortGrade = grade - (fy - FY);
  return withLock_(function () {
    var dec = decisionOf_(FY, cohortGrade), editable = dec ? FY + 1 : FY; // 決定と同時の保存でも、決定の後は書かない
    if (fy !== editable) throw userError_(fy === FY && dec ? 'クラス替えを決定したので、今年度の値は直せません。準備中の年度を直してください' : 'この年度は直せません');
    var name = 'attrs_' + fy;
    ensureCols_(name, attrsHead_());
    var t = read_(name), row = null;
    t.rows.forEach(function (r) { if (String(r.id8) === String(id)) row = r; });
    if (k === 'memo' || k === 'sib') { // 備考・兄弟は文字だけを持つ（兄弟は JSON の並び）
      var val = k === 'sib' ? (v ? text : '') : plainText_(text, 400);
      if (row) writeCell_(t, row, k, val);
      else { var o0 = { id8: String(id) }; o0[k] = val; append_(name, attrsHead_(), [o0]); }
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
  var title = plainText_(String(x.title || '').trim() || (v.url ? titleOf_(v.url) : ''), 200);
  return withLock_(function () {
    ensureCols_('incidents', TABLES_[3].head); ensureCols_('incident_kids', TABLES_[4].head);
    var t = read_('incidents'), next = 1;
    t.rows.forEach(function (r) { if (+r.inc_id >= next) next = +r.inc_id + 1; });
    var inc = { inc_id: next, date: v.date, date_end: v.dateEnd, detail: v.detail, type: v.type, url: v.url, file_id: fileIdOf_(v.url), title: title, by: by, at: new Date(), deleted: '', diagram: v.json, report: v.rjson };
    append_('incidents', TABLES_[3].head, [inc]);
    append_('incident_kids', TABLES_[4].head, v.ids.map(function (id) { return { inc_id: next, id8: id, role: v.roles[id] || '' }; }));
    log_(by, 'addIncident', v.ids.length);
    return { id: next, rev: revOf_(inc.at), date: inc.date, dateEnd: v.dateEnd, detail: v.detail, type: inc.type, title: title, url: inc.url, ids: v.ids, roles: v.roles, diagram: v.diagram, report: v.report };
  });
});

// 事案を直す（関係図・文書・日付・種別）。関係する児童は関係図から入れ直す
var apiUpdateIncident = api_(function (id, x, baseRev) {
  var by = requireTeacher_();
  id = +id;
  var v = incidentInput_(x);
  var title = plainText_(String(x.title || '').trim() || (v.url ? titleOf_(v.url) : ''), 200);
  return withLock_(function () {
    ensureCols_('incidents', TABLES_[3].head); ensureCols_('incident_kids', TABLES_[4].head);
    var t = read_('incidents'), row = t.rows.filter(function (r) { return +r.inc_id === id && !r.deleted; })[0];
    if (!row) throw userError_('事案が見つかりません');
    if (baseRev && revOf_(row.at) !== String(baseRev)) return { conflict: true, by: String(row.by || '') };
    var now = new Date();
    writeCell_(t, row, 'by', by); writeCell_(t, row, 'at', now);
    [['date', v.date], ['date_end', v.dateEnd], ['detail', v.detail], ['type', v.type], ['url', v.url], ['file_id', fileIdOf_(v.url)], ['title', title], ['diagram', v.json], ['report', v.rjson]].forEach(function (c) { writeCell_(t, row, c[0], c[1]); });
    removeRows_('incident_kids', function (r) { return +r.inc_id === id; });
    append_('incident_kids', TABLES_[4].head, v.ids.map(function (k) { return { inc_id: id, id8: k, role: v.roles[k] || '' }; }));
    log_(by, 'updateIncident', v.ids.length);
    return { id: id, rev: revOf_(now), date: v.date, dateEnd: v.dateEnd, detail: v.detail, type: v.type, title: title, url: v.url, ids: v.ids, roles: v.roles, diagram: v.diagram, report: v.report };
  });
});

// 報告書のExcel：設定の様式ファイル（xlsxのまま置いたもの）を複製し、該当するシートのセルにだけ値を書く。
// 元のファイルは変えない。xlsx の中の XML を直接書き換えるので、罫線・結合・入力規則は元のまま。
// 複製は様式のファイルと同じフォルダに置く（名前に児童の氏名は入れない）
var apiExportReport = api_(function (kind, values, incId, seq) {
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
  // 被害の児童が複数の時は、1人ずつ番号を付けて別のファイルにする（名前に氏名は入れない）
  var name = R.names[kind] + '_事案' + (+incId || 0) + (+seq ? '_被害' + (+seq) : '') + '_' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmm') + '.xlsx';
  var out = Utilities.zip(parts, name).setContentType(MimeType.MICROSOFT_EXCEL);
  var folder = null;
  try { var it = file.getParents(); if (it.hasNext()) folder = it.next(); } catch (e) { folder = null; }
  var copy = folder ? folder.createFile(out) : DriveApp.createFile(out);
  log_(by, 'exportReport', +incId || 0);
  return { name: name, url: copy.getUrl() };
});

// 事案の書きかけ（下書き）：教員ごと・学年ごとに1つ。画面を離れても消えないように、入力のたびに少し遅れて保存する
// 中身は入力中の記録そのもの（氏名が入りうる）。登録するか「やめる」で消える
function draftKey_(email, grade) { return 'incdraft_' + String(email).toLowerCase() + '_' + (+grade); }
var apiSaveDraft = api_(function (grade, draft) {
  var by = requireTeacher_(), key = draftKey_(by, grade);
  return withLock_(function () {
    if (!draft) { setSetting_(key, null); return { ok: true }; }
    var s = JSON.stringify(draft);
    if (s.length > 45000) throw userError_('書きかけが長すぎて保存できません。登録してから続きを書いてください');
    setSetting_(key, { at: new Date().toISOString(), draft: draft });
    return { ok: true };
  });
});
var apiLoadDraft = api_(function (grade) {
  var by = requireTeacher_(), v = getSetting_(draftKey_(by, grade), null);
  return v && v.draft ? v : null;
});

// 全校の事案（事案の一覧で、ほかの学年を探す時）
var apiAllIncidents = api_(function () {
  requireTeacher_();
  return incidents_();
});

// 全校の今年度の名簿（事案管理で、ほかの学年の児童を関係図に足すため。名前・よみ・性別・学年・組と、配慮項目の程度・内容の文）
// 備考・経緯への事案の紐付けは渡さない（関係図のアイコンに要らない）
var apiSchoolKids = api_(function () {
  requireTeacher_();
  var FY = CONFIG.fiscalYear(), am = attrsMap_(FY);
  return rosterRows_(FY).map(function (r) {
    var a = {}, src = am[r.id] || {};
    // ほかの学年の児童には、項目の程度（アイコン）だけを渡す。経緯・内容の文（_t。医療・家庭の事情を含む）は渡さない
    CONFIG.ATTRS.forEach(function (at) { if (src[at.k]) a[at.k] = src[at.k]; });
    if (src.sp) a.sp = 1;
    return { id: r.id, name: r.name, kana: r.kana, male: r.male, grade: r.grade, cls: r.cls, a: a };
  });
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
    var nfy = FY + 1, mine = {};
    cur.forEach(function (r) { mine[String(r.id)] = 1; });
    // 前の決定が途中で止まって残した行（決定の行が書かれる前に止まった分）を先に消す。やり直しても二重にならない
    removeRows_('roster_' + nfy, function (r) { return mine[String(r.id8)]; });
    removeRows_('attrs_' + nfy, function (r) { return mine[String(r.id8)]; });
    removeRows_('pairs_carry', function (r) { return +r.fy === FY && (mine[String(r.a)] || mine[String(r.b)]); });
    append_('roster_' + nfy, ROSTER_HEAD, rows.map(function (r) {
      var s = info[r.id];
      return { id8: r.id, name: s.name, kana: s.kana, sex: s.male ? '男' : '女', grade: grade + 1, 'class': r.cls + 1, no: r.no };
    }));
    ensureCols_('attrs_' + nfy, attrsHead_());
    append_('attrs_' + nfy, attrsHead_(), rows.map(function (r) { var o = { id8: r.id }; CONFIG.ATTRS.forEach(function (at) { o[at.k] = r.a[at.k]; if ((at.side || at.ctx) && r.a[at.k + '_t']) o[at.k + '_t'] = plainText_(r.a[at.k + '_t'], 1000); if (at.ctx && r.a[at.k + '_i']) o[at.k + '_i'] = r.a[at.k + '_i'].join(','); }); if (r.a.sp) o.sp = 1; if (r.a.memo) o.memo = plainText_(r.a.memo, 400); if (r.a.sib && r.a.sib.length) o.sib = JSON.stringify(r.a.sib); return o; }));
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
      forget_(); t.sh.getRange(2, c + 1, col.length, 1).setValues(col); // 1回で書く（行ごとに書くと遅い）
    }
    ensureCols_('decisions', TABLES_[1].head);
    var d = read_('decisions');
    writeCell_(d, d.rows.filter(function (r) { return r._r === dec._r; })[0], 'names', names.join(','));
    log_(by, 'classNames', nc);
    return { ok: true };
  });
});

// 行を消す（下の行から消すので行番号がずれない）
// 条件に合う行を消す。1行ずつ deleteRow すると行の数だけ呼び出しが要り、数年分で6分の上限に届くので、
// 残す行を書き戻し、余った末尾の行をまとめて消す（呼び出しは3回）
function removeRows_(name, pred) {
  var t = read_(name);
  if (!t.sh || !t.rows.length) return 0;
  var all = t.sh.getDataRange().getValues(), keep = [], n = 0;
  t.rows.forEach(function (r, i) { if (pred(r)) n++; else keep.push(all[i + 1]); });
  if (!n) return 0;
  var w = all[0].length;
  forget_();
  if (keep.length) t.sh.getRange(2, 1, keep.length, w).setValues(keep);
  t.sh.deleteRows(2 + keep.length, n);
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
// 設定の文字から HTML の記号を落とす（画面の HTML にそのまま入る所があるため）
function safeText_(v, n) { return String(v == null ? '' : v).replace(/[<>&"'`]/g, '').trim().slice(0, n); }
var apiSaveSettings = api_(function (s) {
  var by = requireTeacher_();
  if (!s || !s.attrs) throw userError_('設定が読めません');
  var clean = { attrs: {}, types: [], teachers: [], keepYears: Math.max(0, Math.min(6, +s.keepYears || 0)),
    slots: (s.slots || []).map(function (t) { return safeText_(t, 20); }).filter(Boolean).slice(0, 30),
    school: String(s.school || '').trim().slice(0, 40), template: String(s.template || '').trim().slice(0, 300) };
  if (!clean.slots.length) clean.slots = CONFIG.TIME_SLOTS.slice();
  if (clean.template && !fileIdOf_(clean.template)) throw userError_('様式のファイルは、ドライブのファイルのURLを貼ってください');
  CONFIG.ATTRS.forEach(function (at) {
    var x = s.attrs[at.k] || {};
    var label = safeText_(x.label === undefined ? at.label : x.label, 20), ini = safeText_(x.s === undefined ? at.s : x.s, 1);
    if (!label || !ini) throw userError_('項目の名前と頭文字は空にできません');
    // 説明文：空の欄は既定の文に戻す
    var help = (at.help || []).map(function (d, i) { var t = safeText_(x.help && x.help[i] || '', 80); return t || d; });
    clean.attrs[at.k] = { label: label, s: ini, w: Math.max(0, Math.min(3, +x.w || 0)), help: help };
  });
  clean.types = (s.types || []).map(function (t) { return safeText_(t, 20); }).filter(Boolean).slice(0, 20);
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
    if (lastFy[id] == null) throw userError_('過去の名簿にいない児童は消せません（' + id + '）');
    if (!CONFIG.purgeable(lastFy[id], FY, keep, !!inc[id])) throw userError_('残す年数を過ぎていない児童は消せません（事案に関わった児童は卒業・転出から' + CONFIG.INCIDENT_KEEP_YEARS + '年度）');
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
      // 残った事案の、被害児童ごとの欄（様式Ⅱ）から消した児童の分を外す
      if (left[r.inc_id] && r.report) {
        var rp; try { rp = JSON.parse(String(r.report)); } catch (e) { rp = null; }
        if (rp && rp.s2v && Object.keys(rp.s2v).some(function (id) { return set[id]; })) {
          Object.keys(rp.s2v).forEach(function (id) { if (set[id]) delete rp.s2v[id]; });
          writeCell_(t, r, 'report', JSON.stringify(rp));
        }
      }
    });
    // 設定に入っている児童の値：案の割り当て、クラス分けテストの点数、事案の書きかけ（消した児童が入っていれば書きかけごと捨てる）
    read_('settings').rows.forEach(function (r) {
      var key = String(r.key), v; try { v = JSON.parse(r.json); } catch (e) { return; } // 読めない行は飛ばす（ほかの行の掃除は続ける）
      if (!v) return;
      var ch = false;
      if (/^plans_/.test(key)) {
        (v.plans || []).forEach(function (p) {
          Object.keys(p.assign || {}).forEach(function (id) { if (set[id]) { delete p.assign[id]; ch = true; } });
          var l0 = (p.locks || []).length; p.locks = (p.locks || []).filter(function (id) { return !set[id]; }); if (p.locks.length !== l0) ch = true;
        });
        if (ch) setSetting_(key, v);
      } else if (/^scores_/.test(key)) {
        Object.keys(v.s || {}).forEach(function (id) { if (set[id]) { delete v.s[id]; ch = true; } });
        if (ch) setSetting_(key, v);
      } else if (/^incdraft_/.test(key)) {
        var js = String(r.json);
        if (Object.keys(set).some(function (id) { return js.indexOf('"' + id + '"') >= 0; })) setSetting_(key, null);
      }
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

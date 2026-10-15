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

    // 配慮項目。good=1 は良い要素（カードの1段目・緑）。w は重みの既定段階（0なし〜3強）
    // help：カーソルを合わせると出す説明［見出し, アイコン, アイコン＋］（max: 1 は［見出し, アイコン］）。side：カードの2段目の右（良い項目の下）に置く。負担の項目の＋は「＋2つ分」ではなく、担任の負担が明確に増えることを表す
    ATTRS: [
      { k: 'k1', label: '学力しんどさ', s: '学', c: '#1E6FD9', t: '#FFFFFF', sh: 'square',   w: 2, heavy: 1, max: 2, help: ['学力のしんどさ', '学習の遅れがある。', '遅れが大きい。個別の手立てがいつも要る。'] },
      { k: 'k2', label: '長欠・不登校傾向', s: '欠', c: '#1A1A1A', t: '#FFFFFF', sh: 'circle',   w: 1, heavy: 1, max: 2, help: ['長欠・不登校傾向', '欠席・遅刻・早退が多い。', '長期欠席、または不登校。'] },
      { k: 'k3', label: '問題行動',     s: '問', c: '#D7263D', t: '#FFFFFF', sh: 'burst',    w: 3, heavy: 1, max: 2, help: ['問題行動、トラブル', '多い。', 'とても多い。または深刻。'] },
      { k: 'k4', label: '保護者',       s: '保', c: '#F2C200', t: '#1A1A1A', sh: 'house',    w: 2, heavy: 1, max: 2, help: ['保護者対応', '連絡・相談が多い。', '対応にとても時間がかかる。または関係づくりが難しい。'] },
      { k: 'k5', label: 'アレルギー',   s: 'ア', c: '#7B3FA0', t: '#FFFFFF', sh: 'octagon',  w: 1, max: 1, side: 1, help: ['アレルギー', '配慮の要るアレルギーがある（エピペンの所持を含む）。'] },
      { k: 'k6', label: '身体的配慮',   s: '身', c: '#7B3FA0', t: '#FFFFFF', sh: 'shield',   w: 1, max: 1, side: 1, help: ['身体的配慮', '体や健康の面で配慮が要る。'] },
      { k: 'k10', label: '通級・要支援', s: '通', c: '#7B3FA0', t: '#FFFFFF', sh: 'shell',    w: 2, max: 1, side: 1, help: ['通級・要支援', '通級や支援を受けている。'] },
      { k: 'k7', label: '賢い',         s: 'か', c: '#009E73', t: '#FFFFFF', sh: 'plain',    w: 1, good: 1, max: 1, help: ['賢い', '学力が高い。'] },
      { k: 'k8', label: 'リーダー',     s: 'リ', c: '#009E73', t: '#FFFFFF', sh: 'crown',    w: 2, good: 1, max: 1, help: ['リーダー', 'まとめる力がある。'] },
      { k: 'k9', label: '走力',         s: '走', c: '#009E73', t: '#FFFFFF', sh: 'para',     w: 1, good: 1, max: 1, help: ['走力（走る速さ）', '走るのが速い。'] }
    ],
    // 配慮項目以外の偏りの指標。w は重みの既定段階
    EXTRA: [
      { k: 'sex',  label: '男女',   s: '男女', w: 3 },
      { k: 'old',  label: '旧学級', s: '旧',   w: 2 },
      { k: 'area', label: '地区',   s: '地区', w: 1 },
      { k: 'inc',  label: '事案数', s: '事案', w: 0 }  // 0＝案を作る条件に入れない。設定の枠で上げると入る
    ],
    // 段階 → 計算に使う重み
    LEVEL_W: [0, 1, 2.5, 5],
    LEVEL_NAMES: ['無', '弱', '中', '強'],
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

  g.CONFIG = CONFIG;
})(typeof globalThis !== 'undefined' ? globalThis : this);

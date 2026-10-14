// 設定の正本。項目の名前・色・形・重み・学級数の上限はここだけで決める。
// 保存データの列は中立のキー（k1〜k9）だけで持ち、名前はここにしか書かない（開示請求への配慮。docs/design.md §4）。
(function (g) {
  'use strict';
  var CONFIG = {
    MAX_CLASSES: 4,   // 1学年の学級数の上限
    CAP: 36,          // 1学級の人数の上限
    MAX_LEVEL: 3,     // 配慮項目の程度（0＝なし、1〜3）

    // 配慮項目。good=1 は良い要素（カードの1段目・緑）。w は重みの既定段階（0なし〜3強）
    ATTRS: [
      { k: 'k1', label: '学力しんどさ', s: '学', c: '#1E6FD9', t: '#FFFFFF', sh: 'square',   w: 2 },
      { k: 'k2', label: '長欠',         s: '欠', c: '#56B4E9', t: '#1A1A1A', sh: 'circle',   w: 1 },
      { k: 'k3', label: '問題行動',     s: '問', c: '#D7263D', t: '#FFFFFF', sh: 'diamond',  w: 3 },
      { k: 'k4', label: '保護者',       s: '保', c: '#F2C200', t: '#1A1A1A', sh: 'hexagon',  w: 2 },
      { k: 'k5', label: 'アレルギー',   s: 'ア', c: '#1A1A1A', t: '#FFFFFF', sh: 'octagon',  w: 1 },
      { k: 'k6', label: '身体的配慮',   s: '身', c: '#8C6D31', t: '#FFFFFF', sh: 'shield',   w: 1 },
      { k: 'k7', label: '賢',           s: '賢', c: '#009E73', t: '#FFFFFF', sh: 'pentagon', w: 1, good: 1 },
      { k: 'k8', label: 'リーダー',     s: 'リ', c: '#009E73', t: '#FFFFFF', sh: 'pill',     w: 2, good: 1 },
      { k: 'k9', label: '運動',         s: '運', c: '#009E73', t: '#FFFFFF', sh: 'para',     w: 1, good: 1 }
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
    LEVEL_NAMES: ['なし', '弱', '中', '強'],
    // 必ず守る条件（設定の枠でオン・オフ）
    HARD: [
      { k: 'far',  label: '離す' },
      { k: 'near', label: 'つける' },
      { k: 'fix',  label: '組に固定' },
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

  g.CONFIG = CONFIG;
})(typeof globalThis !== 'undefined' ? globalThis : this);

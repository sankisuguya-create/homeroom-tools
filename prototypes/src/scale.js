/* ==================================================================
   評価スケール — プロジェクトの正本。
   児童画面と教師画面がこの1ファイルを読む。build.py が両方に差し込む。
   実装では GAS の scale.html になり、サーバとクライアントの両方から読む。

   基本字5 × ニュアンス4（− / 無 / + / ++）＝ 20段。
   ++ は + とは別の段。A++ は A+ と Z− のあいだに座る。
   保存は記号の文字列で行い、計算のときだけ値に変換する。
================================================================== */

/* 基本字は下から上へ並べる。上位が増えたら末尾に足すだけでよい（例：…,"Z","Y"）。
   途中に差し込むと既存の内部値がずれて過去の記録の意味が変わる。追加は末尾だけ。 */
const BASES = ["D","C","B","A","Z"];
const MODS  = [{s:"−",v:0},{s:"",v:1},{s:"+",v:2},{s:"++",v:3}];
const NMOD   = MODS.length;
const NBASE  = BASES.length;
const NLEVEL = NBASE * NMOD;            // 20

/* 層の境目もここだけで決める。Z の上に Y を足したら、Y も自動で突破層に入る。
   コードのどこにも "Z" を直接書かない。書いた瞬間に取り残される。 */
const TOP_FROM = "Z";                   // これ以上は突破層
const WARN_TO  = "C";                   // これ以下は警告層

/* 突破層の見た目は基本字ごとに1つ。段（− / 無 / + / ++）では変えない。
   字を足したらここに1行足す。未登録の字は金の箔にする。
   実体は material.css にある。 */
const BASE_LOOK = { "Z":"foil-gold", "Y":"foil-cosmic" };

/* スケールに乗らない記号。どちらも集計から外すが、理由が違うので分けて数える。
   休：児童がいなかった（個人の欠測）
   / ：その授業を評価に含めない（授業側の都合。行事・テスト・予備時間など）
   / は教師だけが設定する。 */
const OFF = "休", SKIP = "/";
const isMark = sym => sym === OFF || sym === SKIP;

const iTop  = BASES.indexOf(TOP_FROM);
const iWarn = BASES.indexOf(WARN_TO);
/* 記号 → 基本字の位置。スケール外（休・/・空）は -1 を返す。 */
const iOf   = sym => (!sym || isMark(sym)) ? -1 : BASES.indexOf(sym[0]);

const isTopSym  = sym => iOf(sym) >= iTop;
const isWarnSym = sym => { const i = iOf(sym); return i >= 0 && i <= iWarn; };
const isTopVal  = v => Math.floor((v-1)/NMOD) >= iTop;
const isWarnVal = v => Math.floor((v-1)/NMOD) <= iWarn;

function valueOf(sym){                             // "A++" → 16／スケール外は null
  const b = iOf(sym);
  if(b < 0) return null;
  const m = MODS.find(m => m.s === sym.slice(1));
  return m ? b*NMOD + m.v + 1 : null;
}
const symbolOf = v => BASES[Math.floor((v-1)/NMOD)] + MODS[(v-1)%NMOD].s;   // 16 → "A++"
const baseOf   = v => BASES[Math.floor((v-1)/NMOD)];
const modIdx   = v => (v-1)%NMOD;
/* 材質のクラス名。基本字ごとに1つ。 */
const lookOf   = sym => BASE_LOOK[sym[0]] || "foil-gold";

const ALL_SYMS = [];
BASES.forEach(b => MODS.forEach(m => ALL_SYMS.push(b + m.s)));

/* 中央値が2段の間に落ちたときは下側を採る（水増ししない）。
   順序尺度なので平均は取れない。 */
const symbolOfMedian = m => (m == null) ? null : symbolOf(Math.floor(m));

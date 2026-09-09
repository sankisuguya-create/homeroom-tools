/* ==================================================================
   評価スケール — プロジェクトの正本。
   児童画面と教師画面がこの1ファイルを読む。build.py が両方に差し込む。
   実装では GAS の Scale.gs と scale.html になる。

   段は**表**で持つ。以前は「基本字 × ニュアンス4」の掛け算で出していたが、
   上端だけ段数が違う形になったので、掛け算では表せなくなった。
   表なら、どの帯が何段でも同じ規則で扱える。

   保存は記号の文字列で行い、計算のときだけ値に変換する。
================================================================== */

/* 基本字は下から上へ。上位が増えたら末尾に足す。
   途中に差し込むと既存の内部値がずれて、過去の記録の意味が変わる。 */
const BASES = ["D","C","B","A","Z","Y"];

/* 帯ごとの刻み。下の4帯は 4段、上の2帯は 2段。
   上端を4段にしていたときは Z− と Z++ があったが、そこまでの細かさを
   使い分けられないので 2段にし、空いた2段を Y に回した。 */
const MODS_FULL = ["−", "", "+", "++"];
const MODS_TOP  = ["", "+"];
const MODS_OF = {
  "D": MODS_FULL, "C": MODS_FULL, "B": MODS_FULL, "A": MODS_FULL,
  "Z": MODS_TOP,  "Y": MODS_TOP
};

/* 内部値 1..N の並び。ここが唯一の正本で、変換はすべてこの表を引く。 */
const LEVELS = [];
BASES.forEach(b => (MODS_OF[b] || MODS_FULL).forEach(m => LEVELS.push(b + m)));
const NLEVEL = LEVELS.length;          // 20
const NBASE  = BASES.length;
const ALL_SYMS = LEVELS.slice();

/* 層の境目。コードのどこにも "Z" や "Y" を直接書かない。
   書いた瞬間、基本字を足したときにそこだけ取り残される。 */
const TOP_FROM     = "Z";   // これ以上は突破層（箔をかける・突破回数に数える）
const WARN_TO      = "C";   // これ以下は警告層（文字を赤にする）
const RELEASE_FROM = "Y";   // これ以上は、教師が解放するまで児童に出さない

/* 突破層の見た目は基本字ごとに1つ。段では変えない。
   字を足したらここに1行足す。未登録の字は金の箔。実体は material.css。 */
const BASE_LOOK = { "Z":"foil-gold", "Y":"foil-cosmic" };

/* スケールに乗らない記号。どちらも集計から外すが、理由が違うので分けて数える。
   休：児童がいなかった（個人の欠測）
   / ：その授業を評価に含めない（授業側の都合）。教師だけが設定する。 */
const OFF = "休", SKIP = "/";
const isMark = sym => sym === OFF || sym === SKIP;

const iTop     = BASES.indexOf(TOP_FROM);
const iWarn    = BASES.indexOf(WARN_TO);
const iRelease = BASES.indexOf(RELEASE_FROM);

/* 記号 → 基本字。スケール外（休・/・空・知らない記号）は "" を返す。 */
function baseOfSym(sym){
  if(!sym || isMark(sym)) return "";
  const b = String(sym).charAt(0);
  return BASES.indexOf(b) >= 0 ? b : "";
}
const iOf = sym => { const b = baseOfSym(sym); return b ? BASES.indexOf(b) : -1; };

const isTopSym     = sym => iOf(sym) >= iTop;
const isWarnSym    = sym => { const i = iOf(sym); return i >= 0 && i <= iWarn; };
const isReleaseSym = sym => iOf(sym) >= iRelease;   // 解放されるまで児童に出さない段

/* valueOf という名前は使わない。Object.prototype.valueOf と同名で、
   GAS ではトップレベル宣言がグローバルオブジェクト上のそれを隠す。 */
function valueOfSym(sym){                          // "A++" → 16／スケール外は null
  if(!sym || isMark(sym)) return null;
  const i = LEVELS.indexOf(String(sym));
  return i < 0 ? null : i + 1;
}
const symbolOf = v => LEVELS[v - 1];               // 16 → "A++"
const baseOf   = v => baseOfSym(LEVELS[v - 1]);
const isTopVal  = v => iOf(LEVELS[v - 1]) >= iTop;
const isWarnVal = v => { const i = iOf(LEVELS[v - 1]); return i >= 0 && i <= iWarn; };

/* 材質のクラス名。基本字ごとに1つ。 */
const lookOf = sym => BASE_LOOK[baseOfSym(sym)] || "foil-gold";

/* 帯の先頭の内部値。折れ線の目盛りを引くのに使う。 */
function bandStart(base){
  const i = LEVELS.indexOf(base + (MODS_OF[base] || MODS_FULL)[0]);
  return i + 1;
}
const bandSize = base => (MODS_OF[base] || MODS_FULL).length;

/* 児童に出してよい記号。解放されていない帯（Y 以上）を落とす。
   すでに入っている記号は、値が消えないよう残す。 */
function symsFor(opt){
  const released = !!(opt && opt.released);
  const keep     = opt && opt.keep;
  return LEVELS.filter(s => released || !isReleaseSym(s) || s === keep);
}

/* 中央値が2段の間に落ちたときは下側を採る（水増ししない）。
   順序尺度なので平均は取れない。 */
const symbolOfMedian = m => (m == null) ? null : symbolOf(Math.floor(m));

/* 古い記号を今の記号に置き換える表。内部値は動かない。
   Z−(17) Z(18) Z+(19) Z++(20) → Z(17) Z+(18) Y(19) Y+(20) */
const SYM_MIGRATION = { "Z−":"Z", "Z":"Z+", "Z+":"Y", "Z++":"Y+" };

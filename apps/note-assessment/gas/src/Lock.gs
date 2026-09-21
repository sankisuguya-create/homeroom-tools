/* ==================================================================
   Lock.gs — ロックの判定。
   状態としては持たない。保存時刻と定時から毎回引く。
   日次トリガでフラグを立てる方式にすると、トリガが落ちた日に穴が空き、
   シートとフラグの不整合も起きる。時刻の関数なら落ちようがない。

   直近の境界 = 今日の定時（すでに過ぎていれば今日、まだなら昨日）
   ロック済み ⇔ その評価の保存時刻 < 直近の境界

   保存時刻が無いセル（未記入）はロックしない。
   休んだ児童も、転写を忘れた児童も、後日そのまま入力できる。
================================================================== */
/* シートの日付欄は Date で返ってくるとは限らない。書式を文字列にしていたり、
   手で「2026/4/10」と打ち込んでいると文字列で来る。instanceof だけで判定すると、
   その場合に全部「日付なし」に落ちて、児童の画面が黙って空になる。 */
function toDate_(v){
  if(v === null || v === undefined || v === "") return null;
  if(Object.prototype.toString.call(v) === "[object Date]"){
    return isNaN(v.getTime()) ? null : v;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

const Lock = (function(){

  function lastBoundary(now){
    const at = now || new Date();
    const t  = Config.lockTime();
    const b  = new Date(at);
    b.setHours(t.h, t.m, 0, 0);
    if(b > at) b.setDate(b.getDate() - 1);   // まだ今日の定時前なら、昨日の定時
    return b;
  }

  /* savedAt は Date か、シートから来た文字列。空ならロックしない。 */
  function isLocked(savedAt, now){
    const d = toDate_(savedAt);
    return d ? (d < lastBoundary(now)) : false;
  }

  return {lastBoundary, isLocked};
})();

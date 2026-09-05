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
    if(!savedAt) return false;
    const d = (savedAt instanceof Date) ? savedAt : new Date(savedAt);
    if(isNaN(d.getTime())) return false;
    return d < lastBoundary(now);
  }

  return {lastBoundary, isLocked};
})();

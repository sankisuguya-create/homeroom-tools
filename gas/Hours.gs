/* ==================================================================
   Hours.gs — 児童が使える時間。

   開室 8:00 〜 ロック時刻（16:00）。**終わりをロック時刻と同じにしてある。**
   時刻を別に持つと「閉まっているのにまだ直せる」というずれが生まれ、
   それを人手で守り続けることになる。同じ値を見れば、閉室と確定が
   必ず同じ瞬間に起きる。

   画面を閉じるのは誘導であって権限ではない。読み書きの両方で、
   サーバ側がこの判定を通す。
================================================================== */
const Hours = (function(){

  function open_(){ return Config.openTime(); }
  function close_(){ return Config.lockTime(); }        // 終わりはロック時刻

  function isClosed(now){
    const d = now || new Date();
    const m = d.getHours()*60 + d.getMinutes();
    const a = open_(), b = close_();
    const from = a.h*60 + a.m, to = b.h*60 + b.m;
    return (from < to) ? (m < from || m >= to)
                       : (m < from && m >= to);          // 日をまたぐ設定
  }

  /* 教師は時間外でも使える。ロックの貫通と同じ扱い。 */
  function isClosedFor(who, now){
    return (who && who.role === "teacher") ? false : isClosed(now);
  }

  /* 閉まるまでの分。閉まっているときは null。画面の予告に使う。 */
  function minutesToClose(now){
    const d = now || new Date();
    if(isClosed(d)) return null;
    const b = close_();
    const to = b.h*60 + b.m, m = d.getHours()*60 + d.getMinutes();
    return (m < to) ? to - m : (24*60 - m) + to;
  }

  function label(){
    const a = open_(), b = close_();
    const p = n => String(n).padStart(2, "0");
    return p(a.h) + ":" + p(a.m) + "〜" + p(b.h) + ":" + p(b.m);
  }

  return {isClosed, isClosedFor, minutesToClose, label,
          openTime: open_, closeTime: close_};
})();

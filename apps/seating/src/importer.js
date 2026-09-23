/* 過去の座席表（任意のスプレッドシートの格子）を読み、名簿の児童に対応づける。
   ブラウザ（Dialog.html）と node（tests/）の両方で読む。外部参照なし。 */
var SeatImport = (function(){

  /* 座席ではない見出し。これを含むセルは児童として扱わず、向きの判定に使う */
  var FRONT = /黒板|教卓|前（|^前$|ホワイトボード|スクリーン/;
  var LABEL = /黒板|教卓|ホワイトボード|スクリーン|窓|廊下|入口|出口|ドア|ロッカー|空席|欠番|^前$|^後ろ?$|座席表|向き|第\s*\d+\s*回|^\d{4}[\/\-年]/;

  function half(s){
    return String(s).replace(/[０-９Ａ-Ｚａ-ｚ]/g, function(d){ return String.fromCharCode(d.charCodeAt(0) - 0xFEE0); });
  }
  function normName(s){
    return half(s).replace(/[\s　・]/g, '').replace(/(さん|くん|君|ちゃん)$/, '');
  }

  /* 1セルを {num, name} に分ける。「3 あおき」「3\nあおき」「あおき(3)」「3」「あおき」 */
  function splitCell(raw){
    var s = half(String(raw == null ? '' : raw)).trim();
    if(!s) return null;
    var m = s.match(/^(\d{1,3})\s*(?:番)?[\s\n.:：、,)）-]*(.*)$/) || s.match(/^(.*?)[\s(（]*(\d{1,3})\s*(?:番)?[)）]?$/);
    if(m){
      var numFirst = /^\d/.test(s);
      var num = +(numFirst ? m[1] : m[2]), name = (numFirst ? m[2] : m[1]).trim();
      return { num: num, name: name };
    }
    return { num: null, name: s };
  }

  /* values: 2次元配列（表示値）。students: [{id,name}]。
     opts.flip: 教卓側から見た向きなら true（null なら見出しの位置から推定）
   opts.overrides: {'r,c': 児童番号 | 'skip'}  教員が手で直した対応 */
  function parse(values, students, opts){
    opts = opts || {};
    var byNum = {}, byName = {}, names = [];
    students.forEach(function(p){
      byNum[String(p.id)] = p;
      var k = normName(p.name);
      if(k){ (byName[k] = byName[k] || []).push(p); names.push({ k: k, p: p }); }
    });
    var cells = [], labels = [], frontRows = [];
    values.forEach(function(row, r){
      row.forEach(function(v, c){
        var raw = String(v == null ? '' : v).trim();
        if(!raw) return;
        if(FRONT.test(raw)) frontRows.push(r);
        if(LABEL.test(raw)){ labels.push({ r: r, c: c, raw: raw }); return; }
        var x = splitCell(raw);
        var hit = null, why = '';
        var ov = opts.overrides && opts.overrides[r + ',' + c];
        if(ov === 'skip'){ labels.push({ r: r, c: c, raw: raw, skipped: true }); return; }
        if(ov != null && byNum[String(ov)]){
          hit = byNum[String(ov)];
        } else if(x.num != null && byNum[String(x.num)]){
          hit = byNum[String(x.num)];
          if(x.name && normName(x.name) !== normName(hit.name) && normName(hit.name).indexOf(normName(x.name)) < 0 && normName(x.name).indexOf(normName(hit.name)) < 0)
            why = '番号は ' + hit.id + '番 ' + hit.name + ' だが、名前「' + x.name + '」と合わない';
        } else if(x.name){
          var k = normName(x.name), list = byName[k];
          if(list && list.length === 1) hit = list[0];
          else if(list && list.length > 1) why = '同じ名前が名簿に ' + list.length + ' 人いる';
          else {
            /* 姓だけ・名だけの書き方に備え、前方一致・部分一致で1人に絞れるときだけ採る */
            var part = names.filter(function(n){ return n.k.indexOf(k) === 0 || k.indexOf(n.k) === 0 || (k.length >= 2 && n.k.indexOf(k) >= 0); });
            if(part.length === 1){ hit = part[0].p; why = '名前の一部で「' + hit.name + '」とみなした'; }
            else if(part.length > 1) why = '「' + x.name + '」に当たる児童が ' + part.length + ' 人いる';
            else if(x.num != null) why = x.num + '番は名簿にいない';
            else why = '名簿に見つからない';
          }
        } else if(x.num != null) why = x.num + '番は名簿にいない';
        cells.push({ r: r, c: c, raw: raw, id: hit ? hit.id : null, name: hit ? hit.name : '', note: why, sure: !!hit && !why, manual: ov != null });
      });
    });

    /* 同じ児童が2か所：2つ目以降を外す */
    var seen = {}, dup = [];
    cells.forEach(function(x){
      if(x.id == null) return;
      if(seen[x.id]){ dup.push(x); x.note = x.id + '番が2か所にある（' + seen[x.id].raw + '）'; x.id = null; x.name = ''; x.sure = false; }
      else seen[x.id] = x;
    });

    /* 向き：前の見出しが座席より下にあれば、教卓側から見た表 */
    var flip = opts.flip;
    if(flip == null){
      var seatRows = cells.map(function(x){ return x.r; });
      var mid = seatRows.length ? (Math.min.apply(null, seatRows) + Math.max.apply(null, seatRows)) / 2 : 0;
      flip = frontRows.length ? frontRows.every(function(r){ return r > mid; }) : false;
    }
    var H = values.length, W = values.reduce(function(m, row){ return Math.max(m, row.length); }, 0);
    var entries = cells.filter(function(x){ return x.id != null; }).map(function(x){
      var r = flip ? H - 1 - x.r : x.r, c = flip ? W - 1 - x.c : x.c;
      return { id: x.id, name: x.name, r: r, c: c, group: '' };
    });
    /* 座席の左上を配置シートの座席の起点（2行目・A列）にそろえる。見出しの行・列は座標に含めない */
    if(entries.length){
      var rMin = Math.min.apply(null, entries.map(function(e){ return e.r; }));
      var cMin = Math.min.apply(null, entries.map(function(e){ return e.c; }));
      entries.forEach(function(e){ e.r = e.r - rMin + 2; e.c = e.c - cMin + 1; });
    }
    var missing = students.filter(function(p){ return !seen[p.id]; });
    return {
      cells: cells, labels: labels, flip: flip, entries: entries,
      problems: cells.filter(function(x){ return x.note; }),
      /* 同じ児童がほぼ全員2回ずつ＝向き違いの表が2つ並んでいる（この道具の座席表シートなど） */
      twoBlocks: dup.length >= 4 && dup.length >= entriesCount(cells) * 0.8,
      missing: missing
    };
  }

  function entriesCount(cells){ return cells.filter(function(x){ return x.id != null; }).length; }

  /* 大きな範囲から、空でないセルを囲む最小の矩形を切り出す */
  function trim(values){
    var r0 = Infinity, r1 = -1, c0 = Infinity, c1 = -1;
    values.forEach(function(row, r){ row.forEach(function(v, c){
      if(String(v == null ? '' : v).trim()){ r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
    }); });
    if(r1 < 0) return [];
    return values.slice(r0, r1 + 1).map(function(row){
      var o = row.slice(c0, c1 + 1); while(o.length < c1 - c0 + 1) o.push(''); return o;
    });
  }

  return { parse: parse, trim: trim, splitCell: splitCell, normName: normName };
})();
if(typeof module !== 'undefined') module.exports = SeatImport;

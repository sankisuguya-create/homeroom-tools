/* 席替えの計算部。ブラウザ（Dialog.html）と node（tests/）の両方で読む。
   外部参照なし。入力は Code.gs の readInput() が返す形。 */
var Seating = (function(){

  var HARD = 100000;
  var W = {
    sepAdj: 60, sepFb: 40, sepDiag: 20, sepGroup: 30,
    near: 30,
    genderPair: 20, genderGrid: 10, genderGroup: 10,
    leaderNone: 40, leaderExtra: 12,
    supportNone: 30, supportExtra: 10,
    careGroup: 40, careAdj: 30,
    tallFront: 25,
    histAdj: 50, histGroup: 12, histDecay: 0.6, sameSeat: 15,
    frontBias: 20
  };
  /* 重視の項目。教員がダイアログで 0〜4 の段階を選ぶ（0=無視 1=弱 2=中 3=強 4=必須）。
     must=false の項目は「必須」を選べない（割合で効く項目は必須にすると意味が壊れる）。 */
  var CATEGORIES = [
    { key: 'sep',       label: '「離す」の組',        keys: ['sepAdj', 'sepFb', 'sepDiag', 'sepGroup'], must: true },
    { key: 'near',      label: '「近く」の組',        keys: ['near'], must: true },
    { key: 'gender',    label: '男女の混ざり方',      keys: ['genderPair', 'genderGrid', 'genderGroup'], must: true },
    { key: 'leader',    label: 'リーダーを各班に',    keys: ['leaderNone', 'leaderExtra'], must: true },
    { key: 'support',   label: '学習支援役を各班に',  keys: ['supportNone', 'supportExtra'], must: true },
    { key: 'care',      label: '配慮の児童を分ける',  keys: ['careGroup', 'careAdj'], must: true },
    { key: 'tall',      label: '高身長は後ろへ',      keys: ['tallFront'], must: true },
    { key: 'histAdj',   label: '最近の隣を避ける',    keys: ['histAdj'], must: false },
    { key: 'histGroup', label: '最近の班を避ける',    keys: ['histGroup'], must: false },
    { key: 'sameSeat',  label: '前回と同じ席を避ける', keys: ['sameSeat'], must: true },
    { key: 'frontBias', label: '前・後ろの回り持ち',  keys: ['frontBias'], must: false }
  ];
  var LEVEL_MUL = [0, 0.4, 1, 2.5];

  function effectiveWeights(levels){
    var w = {};
    Object.keys(W).forEach(function(k){ w[k] = W[k]; });
    CATEGORIES.forEach(function(cat){
      var lv = levels && levels[cat.key] != null ? +levels[cat.key] : 2;
      if(lv >= 4 && !cat.must) lv = 3;
      cat.keys.forEach(function(k){ w[k] = lv >= 4 ? HARD : W[k] * LEVEL_MUL[Math.max(0, lv)]; });
    });
    return w;
  }

  function rng(seed){
    var a = seed >>> 0;
    return function(){
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 座席どうしの関係を前計算する。rel[i][j] = 'adj' | 'fb' | 'diag' | null */
  function buildModel(input){
    var seats = input.seats;            // [{r,c,group}]
    var students = input.students;      // [{id,name,gender,front,fixed,leader,care}]
    var n = seats.length;
    var key = {};
    seats.forEach(function(s, i){ key[s.r + ',' + s.c] = i; });
    var rows = [];
    seats.forEach(function(s){ if(rows.indexOf(s.r) < 0) rows.push(s.r); });
    rows.sort(function(a, b){ return a - b; });
    var frontRows = input.settings.frontRows || 2;
    var isFront = seats.map(function(s){ return rows.indexOf(s.r) < frontRows; });
    var adj = [], fb = [], diag = [], grid4 = [];
    for(var i = 0; i < n; i++){
      var s = seats[i], a = [], f = [], d = [];
      var L = key[s.r + ',' + (s.c - 1)], R = key[s.r + ',' + (s.c + 1)];
      var U = key[(s.r - 1) + ',' + s.c], D = key[(s.r + 1) + ',' + s.c];
      if(L !== undefined) a.push(L);
      if(R !== undefined) a.push(R);
      if(U !== undefined) f.push(U);
      if(D !== undefined) f.push(D);
      [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(function(o){
        var k = key[(s.r + o[0]) + ',' + (s.c + o[1])];
        if(k !== undefined) d.push(k);
      });
      adj.push(a); fb.push(f); diag.push(d); grid4.push(a.concat(f));
    }
    var groupOf = seats.map(function(s){ var g = s.group == null ? '' : String(s.group); return g === '0' || g === '○' ? '' : g; });
    var groups = {};
    groupOf.forEach(function(g, i){ if(g !== '') (groups[g] = groups[g] || []).push(i); });  // '' ＝班なし

    function relation(i, j){
      if(adj[i].indexOf(j) >= 0) return 'adj';
      if(fb[i].indexOf(j) >= 0) return 'fb';
      if(diag[i].indexOf(j) >= 0) return 'diag';
      return null;
    }

    /* 児童インデックス。空席は仮想児童 (id=null) */
    var people = students.slice();
    while(people.length < n) people.push({ id: null, name: '', gender: '', ghost: true });
    var idx = {};
    people.forEach(function(p, k){ if(p.id != null) idx[p.id] = k; });

    /* 条件を児童ごとに引けるようにする */
    var pairs = [];
    (input.conditions || []).forEach(function(c){
      if(idx[c.a] === undefined || idx[c.b] === undefined) return;
      pairs.push({ a: idx[c.a], b: idx[c.b], type: c.type, must: !!c.must });
    });
    var pairsOf = people.map(function(){ return []; });
    pairs.forEach(function(p, k){ pairsOf[p.a].push(k); pairsOf[p.b].push(k); });

    /* 履歴：recent[k] = {seatKeyOf: {id: 'r,c'}, groupOf: {id: g}}（k=0 が前回） */
    var hist = (input.history || []).slice(0, input.settings.historyDepth || 3);
    var histAdj = people.map(function(){ return {}; });
    var histGroup = people.map(function(){ return {}; });
    var lastSeat = people.map(function(){ return null; });
    hist.forEach(function(h, k){
      var decay = Math.pow(W.histDecay, k);
      var byPos = {}, byGroup = {};
      h.forEach(function(e){
        if(idx[e.id] === undefined) return;
        byPos[e.r + ',' + e.c] = idx[e.id];
        var eg = e.group == null ? '' : String(e.group);
        if(eg !== '' && eg !== '0' && eg !== '○') (byGroup[eg] = byGroup[eg] || []).push(idx[e.id]);
        if(k === 0) lastSeat[idx[e.id]] = e.r + ',' + e.c;
      });
      h.forEach(function(e){
        var p = idx[e.id]; if(p === undefined) return;
        [byPos[e.r + ',' + (e.c - 1)], byPos[e.r + ',' + (e.c + 1)]].forEach(function(q){
          if(q !== undefined) histAdj[p][q] = (histAdj[p][q] || 0) + decay;
        });
        (byGroup[String(e.group)] || []).forEach(function(q){
          if(q !== p) histGroup[p][q] = (histGroup[p][q] || 0) + decay;
        });
      });
    });
    /* 場所の偏り：全履歴の前方率 */
    var frontRate = people.map(function(){ return 0; });
    var allHist = input.history || [];
    if(allHist.length){
      var cnt = people.map(function(){ return 0; });
      allHist.forEach(function(h){
        var rs = [];
        h.forEach(function(e){ if(rs.indexOf(e.r) < 0) rs.push(e.r); });
        rs.sort(function(a, b){ return a - b; });
        h.forEach(function(e){
          var p = idx[e.id]; if(p === undefined) return;
          cnt[p]++;
          if(rs.indexOf(e.r) < frontRows) frontRate[p]++;
        });
      });
      frontRate = frontRate.map(function(v, p){ return cnt[p] ? v / cnt[p] : 0; });
    }
    var meanFront = isFront.filter(Boolean).length / n;

    var fixedSeat = people.map(function(p){
      if(!p.fixed) return -1;
      var k = key[p.fixed.r + ',' + p.fixed.c];
      return k === undefined ? -1 : k;
    });

    return computeNear({
      n: n, seats: seats, people: people, idx: idx, adj: adj, fb: fb, diag: diag, grid4: grid4,
      groupOf: groupOf, groups: groups, isFront: isFront, relation: relation,
      pairs: pairs, pairsOf: pairsOf, histAdj: histAdj, histGroup: histGroup, lastSeat: lastSeat,
      frontRate: frontRate, meanFront: meanFront, fixedSeat: fixedSeat,
      genderMode: input.settings.genderMode || '隣は男女',
      useLeaders: people.some(function(p){ return p.leader; }),
      /* 班長候補が班の数より少ないなら「いない班」は避けようがないので数えない */
      leadersEnough: people.filter(function(p){ return p.leader; }).length >= Object.keys(groups).length,
      useCare: people.some(function(p){ return p.care; }),
      useSupport: people.some(function(p){ return p.support; }),
      supportEnough: people.filter(function(p){ return p.support; }).length >= Object.keys(groups).length,
      w: effectiveWeights(input.settings.weights)
    });
  }

  /* 入力の致命的な矛盾を先に見つける。返り値は文の配列（空なら生成可） */
  function precheck(input){
    var errs = [];
    var seats = input.seats, st = input.students;
    if(!seats.length) errs.push('配置シートに座席がありません。');
    if(st.length > seats.length) errs.push('座席が ' + (st.length - seats.length) + ' 席足りません（在籍 ' + st.length + ' 人、座席 ' + seats.length + ' 席）。');
    var seatKey = {};
    seats.forEach(function(s){ seatKey[s.r + ',' + s.c] = 1; });
    var used = {};
    st.forEach(function(p){
      if(!p.fixed) return;
      var k = p.fixed.r + ',' + p.fixed.c;
      if(!seatKey[k]) errs.push(label(p) + ' の固定席（' + p.fixed.text + '）は座席ではありません。');
      else if(used[k]) errs.push(label(p) + ' と ' + label(used[k]) + ' の固定席が重なっています。');
      else used[k] = p;
    });
    var rows = [];
    seats.forEach(function(s){ if(rows.indexOf(s.r) < 0) rows.push(s.r); });
    rows.sort(function(a, b){ return a - b; });
    var fr = input.settings.frontRows || 2;
    var frontSeats = seats.filter(function(s){ return rows.indexOf(s.r) < fr; }).length;
    var needFront = st.filter(function(p){ return p.front; }).length;
    if(needFront > frontSeats) errs.push('前方が必要な児童 ' + needFront + ' 人に対し、前方の座席は ' + frontSeats + ' 席です（設定「前方の行数」を増やすか、前方の指定を減らしてください）。');
    return errs.concat(input.problems || []);
  }

  function label(p){ return p.id + '番 ' + (p.name || ''); }

  /* ---- 採点 ---- */
  /* asg[seat] = person index。pos[person] = seat */
  function genderClash(m, a, b){
    var ga = m.people[a].gender, gb = m.people[b].gender;
    return ga && gb && ga === gb;
  }

  /* 1人の児童 p が seat にいるときの、他者との関係項（半分ずつ持つ対称項は pairKey で重複回避）。
     差分計算を簡単にするため、「p に関わる全項」を返す関数と、全体採点関数を分ける。 */
  function personCost(m, asg, pos, p, out){
    var s = pos[p], P = m.people[p], c = 0;
    if(P.ghost) return 0;
    if(P.front && !m.isFront[s]){ c += HARD; if(out) out.push({ w: HARD, kind: '前方', text: label(P) + ' が前方の席ではありません。', seats: [s] }); }
    if(P.tall && !P.front && m.isFront[s] && m.w.tallFront){
      c += m.w.tallFront; if(out) out.push({ w: m.w.tallFront, kind: '高身長', text: label(P) + '（高身長）が前方の席です。', seats: [s] });
    }
    // 場所の偏り
    if(m.w.frontBias && m.isFront[s] && m.frontRate[p] > m.meanFront && !P.front){
      var v = m.w.frontBias * (m.frontRate[p] - m.meanFront);
      c += v; if(out && v >= 5) out.push({ w: v, kind: '偏り', text: label(P) + ' はこれまでも前方が多めです。', seats: [s] });
    }
    if(m.w.sameSeat && m.lastSeat[p] && m.lastSeat[p] === m.seats[s].r + ',' + m.seats[s].c){
      c += m.w.sameSeat; if(out) out.push({ w: m.w.sameSeat, kind: '履歴', text: label(P) + ' が前回と同じ席です。', seats: [s] });
    }
    return c;
  }

  function pairCost(m, asg, pos, a, b, out){
    // a<b を前提に1回だけ数える
    var A = m.people[a], B = m.people[b];
    if(A.ghost || B.ghost) return 0;
    var sa = pos[a], sb = pos[b], c = 0;
    var rel = m.relation(sa, sb);
    var sameG = (m.groupOf[sa] !== '' && m.groupOf[sa] === m.groupOf[sb]);
    // 履歴
    var ha = m.histAdj[a][b];
    if(ha && rel === 'adj' && m.w.histAdj){ var v = m.w.histAdj * ha; c += v; if(out) out.push({ w: v, kind: '履歴', text: label(A) + ' と ' + label(B) + ' は最近も隣でした。', seats: [sa, sb] }); }
    var hg = m.histGroup[a][b];
    if(hg && sameG && m.w.histGroup){ var v2 = m.w.histGroup * hg; c += v2; if(out && v2 >= 6) out.push({ w: v2, kind: '履歴', text: label(A) + ' と ' + label(B) + ' は最近も同じ班でした。', seats: [sa, sb] }); }
    // 男女
    if(genderClash(m, a, b)){
      if(m.genderMode === '隣は男女' && rel === 'adj' && m.w.genderPair){ c += m.w.genderPair; if(out) out.push({ w: m.w.genderPair, kind: '男女', text: label(A) + ' と ' + label(B) + ' の隣が同性です。', seats: [sa, sb] }); }
      if(m.genderMode === '市松' && (rel === 'adj' || rel === 'fb') && m.w.genderGrid){ c += m.w.genderGrid; if(out) out.push({ w: m.w.genderGrid, kind: '男女', text: label(A) + ' と ' + label(B) + ' が同性で接しています。', seats: [sa, sb] }); }
    }
    // 配慮
    if(m.useCare && m.w.careAdj && A.care && B.care && (rel === 'adj' || rel === 'fb')){
      c += m.w.careAdj; if(out) out.push({ w: m.w.careAdj, kind: '配慮', text: label(A) + ' と ' + label(B) + '（配慮）が接しています。', seats: [sa, sb] });
    }
    return c;
  }

  function condCost(m, pos, k, out){
    var q = m.pairs[k], A = m.people[q.a], B = m.people[q.b];
    var sa = pos[q.a], sb = pos[q.b];
    var rel = m.relation(sa, sb), sameG = (m.groupOf[sa] !== '' && m.groupOf[sa] === m.groupOf[sb]), c = 0;
    if(q.type === '離す'){
      var hit = [];
      if(q.must){
        if(rel || sameG){ c = HARD; hit.push(rel ? { adj: '隣', fb: '前後', diag: '斜め' }[rel] : '同じ班'); }
      } else {
        if(rel === 'adj'){ c += m.w.sepAdj; hit.push('隣'); }
        if(rel === 'fb'){ c += m.w.sepFb; hit.push('前後'); }
        if(rel === 'diag'){ c += m.w.sepDiag; hit.push('斜め'); }
        if(sameG){ c += m.w.sepGroup; hit.push('同じ班'); }
      }
      if(c && out) out.push({ w: c, kind: '離す', text: label(A) + ' と ' + label(B) + ' が' + hit.join('・') + 'です（離す' + (q.must ? '・必須' : '') + '）。', seats: [sa, sb] });
    } else if(q.type === '近く'){
      if(!(rel === 'adj' || rel === 'fb' || sameG)){
        c = q.must ? HARD : m.w.near;
        if(out) out.push({ w: c, kind: '近く', text: label(A) + ' と ' + label(B) + ' が離れています（近く' + (q.must ? '・必須' : '') + '）。', seats: [sa, sb] });
      }
    }
    return c;
  }

  function groupCost(m, asg, g, out){
    var list = m.groups[g] || [], c = 0, boys = 0, girls = 0, leaders = 0, care = 0, support = 0, members = 0;
    list.forEach(function(s){
      var P = m.people[asg[s]]; if(P.ghost) return;
      members++;
      if(P.gender === '男') boys++; else if(P.gender === '女') girls++;
      if(P.leader) leaders++;
      if(P.care) care++;
      if(P.support) support++;
    });
    if(members < 2) return 0;
    if(m.genderMode !== '考えない' && m.w.genderGroup){
      var diff = Math.abs(boys - girls) - 1;
      if(diff > 0){ c += m.w.genderGroup * diff; if(out) out.push({ w: m.w.genderGroup * diff, kind: '男女', text: g + '班の男女が偏っています（男' + boys + '・女' + girls + '）。', seats: list }); }
    }
    if(m.useLeaders && m.w.leaderNone){
      if(leaders === 0 && m.leadersEnough){ c += m.w.leaderNone; if(out) out.push({ w: m.w.leaderNone, kind: 'リーダー', text: g + '班にリーダーがいません。', seats: list }); }
      else if(leaders > 1){ c += m.w.leaderExtra * (leaders - 1); if(out) out.push({ w: m.w.leaderExtra * (leaders - 1), kind: 'リーダー', text: g + '班にリーダーが ' + leaders + ' 人います。', seats: list }); }
    }
    if(m.useSupport && m.w.supportNone){
      if(support === 0 && m.supportEnough){ c += m.w.supportNone; if(out) out.push({ w: m.w.supportNone, kind: '学習支援', text: g + '班に学習支援役がいません。', seats: list }); }
      else if(support > 1){ c += m.w.supportExtra * (support - 1); if(out) out.push({ w: m.w.supportExtra * (support - 1), kind: '学習支援', text: g + '班に学習支援役が ' + support + ' 人います。', seats: list }); }
    }
    if(m.useCare && m.w.careGroup && care > 1){ c += m.w.careGroup * (care - 1); if(out) out.push({ w: m.w.careGroup * (care - 1), kind: '配慮', text: g + '班に配慮の児童が ' + care + ' 人います。', seats: list }); }
    return c;
  }

  /* 近傍（接している席と同じ班）の人 */
  function neighborsOf(m, s){ return m.near[s]; }
  function computeNear(m){
    m.near = [];
    for(var s = 0; s < m.n; s++){
      var set = {};
      m.adj[s].concat(m.fb[s], m.diag[s], m.groups[m.groupOf[s]] || []).forEach(function(t){ if(t !== s) set[t] = 1; });
      m.near.push(Object.keys(set).map(Number));
    }
    return m;
  }

  function totalCost(m, asg, pos, out){
    var c = 0, i, j;
    for(i = 0; i < m.n; i++) c += personCost(m, asg, pos, i, out);
    for(i = 0; i < m.n; i++){
      var ns = neighborsOf(m, i);
      for(j = 0; j < ns.length; j++){
        var t = ns[j]; if(t <= i) continue;
        var a = asg[i], b = asg[t];
        c += pairCost(m, asg, pos, Math.min(a, b), Math.max(a, b), out);
      }
    }
    for(i = 0; i < m.pairs.length; i++) c += condCost(m, pos, i, out);
    Object.keys(m.groups).forEach(function(g){ c += groupCost(m, asg, g, out); });
    return c;
  }

  /* 席 s1,s2 の入れ替えで変わりうる項だけの合計 */
  function localCost(m, asg, pos, s1, s2){
    var c = 0, seen = {};
    [s1, s2].forEach(function(s){
      c += personCost(m, asg, pos, asg[s]);
      neighborsOf(m, s).forEach(function(t){
        var k = Math.min(s, t) + ',' + Math.max(s, t);
        if(seen[k]) return; seen[k] = 1;
        var a = asg[s], b = asg[t];
        c += pairCost(m, asg, pos, Math.min(a, b), Math.max(a, b));
      });
    });
    var ks = {};
    m.pairsOf[asg[s1]].concat(m.pairsOf[asg[s2]]).forEach(function(k){ ks[k] = 1; });
    Object.keys(ks).forEach(function(k){ c += condCost(m, pos, +k); });
    var g1 = m.groupOf[s1], g2 = m.groupOf[s2];
    c += groupCost(m, asg, g1);
    if(g2 !== g1) c += groupCost(m, asg, g2);
    return c;
  }

  function swap(asg, pos, s1, s2){
    var a = asg[s1], b = asg[s2];
    asg[s1] = b; asg[s2] = a; pos[b] = s1; pos[a] = s2;
  }

  function initial(m, rand){
    var asg = new Array(m.n), pos = new Array(m.n), free = [], people = [];
    for(var s = 0; s < m.n; s++) free.push(s);
    m.people.forEach(function(p, k){
      var f = m.fixedSeat[k];
      if(f >= 0){ asg[f] = k; pos[k] = f; free.splice(free.indexOf(f), 1); }
      else people.push(k);
    });
    // 前方指定を先に前方席へ
    people.sort(function(a, b){ return (m.people[b].front ? 1 : 0) - (m.people[a].front ? 1 : 0); });
    shuffle(free, rand);
    free.sort(function(a, b){ return (m.isFront[b] ? 1 : 0) - (m.isFront[a] ? 1 : 0); });
    var frontN = people.filter(function(k){ return m.people[k].front; }).length;
    var head = free.slice(0, frontN), tail = free.slice(frontN);
    shuffle(tail, rand);
    free = head.concat(tail);
    people.forEach(function(k, i){ asg[free[i]] = k; pos[k] = free[i]; });
    return { asg: asg, pos: pos };
  }

  function shuffle(a, rand){
    for(var i = a.length - 1; i > 0; i--){
      var j = Math.floor(rand() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function anneal(m, seed, iters){
    var rand = rng(seed);
    var st = initial(m, rand), asg = st.asg, pos = st.pos;
    var movable = [];
    for(var s = 0; s < m.n; s++) if(m.fixedSeat[asg[s]] < 0) movable.push(s);
    var cur = totalCost(m, asg, pos), best = cur, bestAsg = asg.slice();
    if(movable.length < 2) return { asg: bestAsg, cost: best };
    var T0 = 60, T1 = 0.5;
    for(var it = 0; it < iters; it++){
      var T = T0 * Math.pow(T1 / T0, it / iters);
      var s1 = movable[Math.floor(rand() * movable.length)];
      var s2 = movable[Math.floor(rand() * movable.length)];
      if(s1 === s2) continue;
      if(m.people[asg[s1]].ghost && m.people[asg[s2]].ghost) continue;
      var before = localCost(m, asg, pos, s1, s2);
      swap(asg, pos, s1, s2);
      var d = localCost(m, asg, pos, s1, s2) - before;
      if(d <= 0 || rand() < Math.exp(-d / T)){
        cur += d;
        if(cur < best - 1e-9){ best = cur; bestAsg = asg.slice(); }
      } else swap(asg, pos, s1, s2);
    }
    return { asg: bestAsg, cost: totalCost(m, bestAsg, posOf(bestAsg)) };
  }

  function posOf(asg){
    var pos = new Array(asg.length);
    asg.forEach(function(p, s){ pos[p] = s; });
    return pos;
  }

  /* 候補を count 個。互いの席の一致率が高すぎるものは捨てる */
  function solve(input, opts){
    opts = opts || {};
    var m = buildModel(input);
    var count = opts.count || 3, iters = opts.iters || Math.max(20000, m.n * 1500);
    var seed = opts.seed == null ? (Date.now() & 0x7fffffff) : opts.seed;
    var tries = [], limit = count * 3;
    for(var t = 0; t < limit && tries.length < count * 2; t++){
      tries.push(anneal(m, seed + t * 7919, iters));
    }
    tries.sort(function(a, b){ return a.cost - b.cost; });
    var picked = [];
    tries.forEach(function(r){
      if(picked.length >= count) return;
      var similar = picked.some(function(p){
        var same = 0;
        for(var s = 0; s < m.n; s++) if(p.asg[s] === r.asg[s]) same++;
        return same / m.n > 0.6;
      });
      if(!similar) picked.push(r);
    });
    tries.forEach(function(r){ if(picked.length < count && picked.indexOf(r) < 0) picked.push(r); });
    return picked.map(function(r){ return describe(m, r.asg); });
  }

  /* 表示用：配置と違反一覧 */
  function describe(m, asg){
    var pos = posOf(asg), out = [];
    var cost = totalCost(m, asg, pos, out);
    out.sort(function(a, b){ return b.w - a.w; });
    return {
      cost: Math.round(cost),
      hard: out.filter(function(v){ return v.w >= HARD; }).length,
      issues: out.map(function(v){ return { kind: v.kind, text: v.text, w: Math.round(v.w), hard: v.w >= HARD, seats: v.seats }; }),
      seats: m.seats.map(function(s, i){
        var P = m.people[asg[i]];
        return { r: s.r, c: s.c, group: s.group, id: P.ghost ? null : P.id, name: P.name || '' };
      })
    };
  }

  /* 手で入れ替えた後の再採点。seatIds[i] = 席 i の児童番号（空席は null） */
  function evaluate(input, seatIds){
    var m = buildModel(input);
    var asg = new Array(m.n), used = {}, ghosts = [];
    m.people.forEach(function(p, k){ if(p.ghost) ghosts.push(k); });
    seatIds.forEach(function(id, s){
      if(id == null || m.idx[id] === undefined){ asg[s] = ghosts.pop(); }
      else { asg[s] = m.idx[id]; used[id] = 1; }
    });
    return describe(m, asg);
  }

  return { solve: solve, evaluate: evaluate, precheck: precheck, buildModel: buildModel, weights: W, categories: CATEGORIES, HARD: HARD, _rng: rng };
})();
if(typeof module !== 'undefined') module.exports = Seating;

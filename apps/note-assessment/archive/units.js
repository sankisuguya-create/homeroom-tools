/* ==================================================================
   教科と単元のマスタ — 両画面が読む正本。
   実装では「教科マスタ」と「単元マスタ」の2枚のシートになる。

   open  … false の教科は児童の画面に出ない。教師だけが選べる。
           単元と授業の区切りを入れ終わってから公開する。
           画面に出さないのは誘導であって権限ではないので、
           実装ではサーバ側でも児童からの非公開教科への保存を弾く。
   c     … 単元の色（0〜19）。教師画面の設定タブが書き換える。
           両画面がこの番号を見るので、変えれば児童の表にも同じ色が出る。
   term  … 学期（1／2／3）。期末評定は選んだ学期の単元だけで計算する。
           No の順に戻らないこと・同じ学期が連続することを設定画面で検算する。
   rated … 教師が「単元の評価をする」を押したか。false のあいだ、単元評価は
           児童の画面に出ない。児童が転写を書き換えるたびに数字が動くのを
           見せると、事実と違う記号を入れて数字を上げる遊びが成り立つ。
           押したあとに出るのは教師が採用した値で、児童画面の計算結果ではない。
================================================================== */
const SUBJECTS = {
  "算数": { open:true, total:70, units:[
    {name:"九九の表とかけ算",     from:1,  to:14,  c:0, rated:true,  term:1},
    {name:"わり算",               from:15, to:30,  c:1, rated:false, term:1},
    {name:"たし算とひき算の筆算", from:31, to:48,  c:2, rated:false, term:2},
    {name:"時こくと時間",         from:49, to:70,  c:3, rated:false, term:3}]},

  "国語": { open:true, total:60, units:[
    {name:"きつつきの商売",       from:1,  to:12,  c:0, rated:false, term:1},
    {name:"こまを楽しむ",         from:13, to:26,  c:1, rated:false, term:1},
    {name:"まいごのかぎ",         from:27, to:42,  c:2, rated:false, term:2},
    {name:"すがたをかえる大豆",   from:43, to:60,  c:3, rated:false, term:3}]},

  /* 単元は仮置き。実際の年間計画で差し替える。 */
  "体育": { open:false, total:105, units:[
    {name:"体つくり運動",         from:1,   to:12,  c:0, rated:false, term:1},
    {name:"かけっこ・リレー",     from:13,  to:26,  c:1, rated:false, term:1},
    {name:"水泳運動",             from:27,  to:42,  c:2, rated:false, term:1},
    {name:"マット運動",           from:43,  to:58,  c:3, rated:false, term:2},
    {name:"ゲーム（ゴール型）",   from:59,  to:78,  c:4, rated:false, term:2},
    {name:"表現運動",             from:79,  to:92,  c:5, rated:false, term:3},
    {name:"跳び箱運動",           from:93,  to:105, c:6, rated:false, term:3}]},

  "社会": { open:false, total:70, units:[
    {name:"わたしたちの市の様子", from:1,  to:24,  c:0, rated:false, term:1},
    {name:"店ではたらく人",       from:25, to:44,  c:1, rated:false, term:2},
    {name:"安全なくらしを守る",   from:45, to:58,  c:2, rated:false, term:2},
    {name:"市のうつりかわり",     from:59, to:70,  c:3, rated:false, term:3}]}
};

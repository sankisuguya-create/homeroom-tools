// メニュー：学年を選び、「名簿を見る」「事案管理」「クラス分けをする」を選ぶ。
(function (g) {
  'use strict';
  var App = g.App;
  // 先生ごとのメニューの表示（どの件数と、最近の記録を出すか）。既定は全部出す
  var VIEW_KEYS = [['rost', '名簿の件数（配慮のある児童）'], ['inc', '事案の件数（対応中・今月）'], ['split', 'クラス分けの状態'], ['recent', '最近の記録'], ['others', '最近の記録に、ほかの先生の記録も出す']];
  App.myView = function () { var v = (App.me && App.me.view) || {}, o = {}; VIEW_KEYS.forEach(function (k) { o[k[0]] = v[k[0]] !== false; }); return o; };
  App.saveMyView = function (v) { if (App.me) App.me.view = v; App.pf().saveMyView(v).catch(function () { App.toast('表示の設定を保存できませんでした'); }); }; // App.save だと学年のデータを読み直すので使わない
  // 学年のデータから、ボタンの件数と最近の記録を作る。0件の札は出さない（いつも出ていると慣れて見なくなるため）
  App.menuSummary = function (d, v) {
    var esc = App.esc, C = g.CONFIG, FY = d.fy, from = FY + '-04-01', mon = new Date().toISOString().slice(0, 7);
    var chip = function (t, red) { return '<i class="mchip' + (red ? ' red' : '') + '">' + esc(t) + '</i>'; };
    var wrap = function (h) { return '<span class="mchips">' + h + '</span>'; }; // 札が無くても行の場所は取る（名前の位置を変えない）
    var y = (d.years || []).filter(function (x) { return x.fy === FY; })[0], care = 0;
    if (y) y.rows.forEach(function (r) { if (C.ATTRS.some(function (at) { return +r.a[at.k] > 0; })) care++; });
    var incs = (d.incidents || []).filter(function (x) { return x.date >= from; });
    var open = incs.filter(function (x) { return ((x.report || {}).status || 'open') === 'open'; }).length, month = incs.filter(function (x) { return x.date.slice(0, 7) === mon; }).length;
    var np = ((d.plans || {}).plans || []).length;
    var chips = {
      rost: !v.rost ? wrap('') : wrap(care ? chip('配慮あり ' + care + '人') : ''),
      inc: !v.inc ? wrap('') : wrap((open ? chip('対応中 ' + open + '件', true) : '') + (month ? chip('今月 ' + month + '件') : '')),
      split: !v.split ? wrap('') : wrap(d.decision ? chip('決定済み') : chip('未決定') + (np ? chip('案 ' + np + 'つ') : ''))
    };
    var me = String((App.me && App.me.email) || '').toLowerCase(), md = function (s) { var m = String(s || '').match(/^\d{4}-(\d{2})-(\d{2})/); return '<span class="md"><i>' + (m ? +m[1] : '') + '</i>/<i>' + (m ? +m[2] : '') + '</i></span>'; }, // 月と日の間の / を縦に揃える
      day = function (s) { return String(s || '').slice(5, 10).split('-').map(Number).join('/'); }; // 11/1 の形（0 を付けない）
    var items = (d.incidents || []).filter(function (x) { return v.others || String(x.by || '').toLowerCase() === me; }).map(function (x) {
      return { at: String(x.rev || ''), h: '<button class="mrow" data-rinc="' + x.id + '"><span class="tg t3">事案</span>' + md(x.date) + '<span class="mt">' + esc(String(x.title || '（題なし）').replace(/^\s*\d{1,2}月\d{1,2}日\s*/, '') || '（題なし）') + '</span>' + '<span class="note">' + esc(day(x.rev) + (String(x.by || '').toLowerCase() === me ? ' 自分' : ' ' + String(x.by || '').split('@')[0])) + '</span></button>' };
    });
    if (d.decision && v.others) items.push({ at: String(d.decision.at), h: '<button class="mrow" data-go="split"><span class="tg t1">クラス分け</span>' + md(String(d.decision.at).slice(0, 10)) + '<span class="mt">決定した</span><span class="note">' + esc(day(d.decision.at)) + '</span></button>' });
    items.sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
    return { chips: chips, recent: items.slice(0, 5).map(function (x) { return x.h; }) };
  };
  App.screens.menu = {
    render: function () {
      var st = App.st, FY0 = App.pf().fiscalYear, vfy = st.viewFy || FY0, off = vfy - FY0, dg = st.grade + off, now = !off;
      var cur = (st.grades || []).filter(function (x) { return x.grade === dg; })[0];
      if (!cur && st.grades && st.grades.length) { cur = st.grades[0]; st.grade = cur.grade - off; dg = cur.grade; } // 見ている年度にその学年が無ければ先頭の学年
      // 年度の選択：来年度（決定した学年の名簿）と過去の年度も見られる
      var yearSel = '<label class="mfy">年度 <select id="mfy">' + (st.years || [FY0]).map(function (y) { return '<option value="' + y + '"' + (y === vfy ? ' selected' : '') + '>' + y + '年度' + (y === FY0 ? '（今年度）' : y === FY0 + 1 ? '（来年度）' : '') + '</option>'; }).join('') + '</select></label>';
      // 管理者への知らせ（共有の状態・年度替わりの消し忘れ）。読み込みは main.js が go('menu') の時に1回
      var warn = (App.adminWarnings || []).map(function (w) { return '<div class="warnbox" role="alert">' + App.esc(w.text) + (w.kind === 'purge' ? ' <button class="btn" data-go="settings">設定を開く</button>' : '') + '</div>'; }).join('');
      var v = App.myView(), d = now && App.bootCached ? App.bootCached(st.grade) : null, sm = d ? App.menuSummary(d, v) : null;
      var EMPTY = '<div class="big bslot" aria-hidden="true"></div>'; // 無い機能の場所は空けておく（ほかのボタンの幅と位置を変えない）
      var NOCHIP = '<span class="mchips"></span>', chips = sm ? sm.chips : { rost: NOCHIP, inc: NOCHIP, split: NOCHIP };
      var recent = sm && v.recent ? '<section class="mrecent"><h2>最近の記録</h2>' + (sm.recent.length ? sm.recent.join('') : '<p class="note">まだありません</p>') + '</section>' : '';
      App.$('main').innerHTML = '<div class="menu">' + warn +
        '<section><h2>学年を選ぶ ' + yearSel + '</h2>' + (now ? '' : '<p class="note">' + vfy + '年度の名簿を見ています。' + (off > 0 ? 'クラス替えを決定した学年だけが入っています。' : '') + 'クラス分けは今年度だけです。</p>') + '<div class="grades">' + st.grades.map(function (x) {
          return '<button class="gbtn" data-g="' + x.grade + '" aria-pressed="' + (x.grade === dg) + '">' + g.CONFIG.gradeLabel(x.grade) + '<small>' + (x.count ? x.count + '人' + (x.grade === 0 ? '' : '・' + x.classes + '学級') : '名簿なし') + (x.decided ? '・決定済み' : '') + '</small></button>';
        }).join('') + '</div></section>' +
        '<section><h2>' + App.viewLabel() + 'で</h2><div class="bigs bigs3">' +
        // 名簿が0人の学年は、名簿を貼る入口を先頭に出す（名簿の画面を開くと、すぐ貼る窓が開く）
        (cur && !cur.count && now ? '<button class="big" data-go="roster" data-paste="1"><b>名簿を貼る</b><span class="mchips"></span></button>'
          : '<button class="big" data-go="roster"><b>名簿を見る</b>' + chips.rost + '</button>') +
        (st.grade <= 0 ? EMPTY : '<button class="big" data-go="incidents"><b>事案管理</b>' + chips.inc + '</button>') + // 新1年は入学前なので事案は無い
        (st.grade >= 6 || !now ? EMPTY : '<button class="big bsplit" data-go="split"><b>クラス分けをする</b>' + chips.split + '</button>') + // 6年は卒業するのでクラス分けは無い
        '</div></section>' + recent +
        '<section class="mfoot"><button class="btn" data-go="settings">⚙ 設定</button><button class="btn" data-go="roster" data-school="1" title="全校の事案と、関わった児童の一覧">全校の事案</button>' +
        App.ddMenu('mview', '表示', VIEW_KEYS.map(function (k) { return App.ddItem('mv-' + k[0], (v[k[0]] ? '☑ ' : '☐ ') + k[1], '', false, ' role="menuitemcheckbox" aria-checked="' + !!v[k[0]] + '"'); }).join(''), 'メニューに出すものを選ぶ（先生ごとに覚える）') +
        '<span class="sp"></span><span class="note" id="mfull">' + App.esc(App.fullName || 'CSS（児童理解支援システム）') + '</span>' +
        '<button class="linkbtn" data-go="suggest">目安箱</button><span class="note" id="mbuild">版：' + App.esc(App.buildLabel()) + '</span></section></div>'; // 貼った版を GitHub の dist と照らす
      // 件数と最近の記録は、学年のデータ（先読み）が届いてから出す
      if (now && !sm && App.bootCached && st.grade != null) { var g0 = st.grade; App.preload(g0, function () { if (App.st.screen === 'menu' && App.st.grade === g0 && !App.viewOff() && App.bootCached(g0)) App.screens.menu.render(); }); } // 届いた分が使える時だけ描き直す（間に保存があれば描き直さず、読み直しも起こさない）
    },
    input: function (t) { if (t.id === 'mfy') { App.st.viewFy = +t.value; App.$('main').innerHTML = '<div class="empty">読み込み中<span class="ldots" aria-hidden="true"></span></div>'; App.go('menu'); } }, // 読み直す間は古い一覧を押させない // 年度を変えたら、その年度の学年の一覧を読み直す
    click: function (t) {
      var gb = t.closest('[data-g]');
      var mv = t.closest('[id^="mv-"]');
      if (mv) { var k = mv.id.slice(3), vv = App.myView(); vv[k] = !vv[k]; App.saveMyView(vv); App.screens.menu.render(); return true; }
      var ri = t.closest('[data-rinc]');
      if (ri) { App.st.incFocus = { sel: +ri.dataset.rinc }; App.go('incidents'); return true; }
      if (gb) { var cg = +gb.dataset.g - App.viewOff(); App.preload(cg); App.st.grade = cg; App.st.gradeChosen = true; App.screens.menu.render(); return true; } // 見ている年度の学年を、今年度の学年に直して持つ
      return false;
    }
  };

  // 目安箱：アプリへの意見を集め、年度末に読んで改善する。送った人は残さない。名前・番号が入っていれば送らずに知らせる
  var SG = { text: '' };
  App.screens.suggest = {
    enter: function () { this.render(); },
    render: function (msg) {
      var esc = App.esc;
      App.$('main').innerHTML = '<div class="menu"><section><h2>目安箱（このアプリへの意見）</h2>' +
        '<p>使いにくい所、欲しい機能、分かりにくい言葉などを書いてください。年度末にまとめて読み、アプリを直します。<b>誰が送ったかは記録しません。</b></p>' +
        '<div class="warnbox" style="font-weight:400">児童・保護者・職員の<b>名前、児童の番号、事案の中身</b>は書かないでください（「〇年の名簿の画面で」「ある児童の配慮項目を入れる時」のように書いてください）。名簿の名前や番号が入っていると、送らずにお知らせします。</div>' +
        (msg || '') +
        '<textarea id="sgtext" rows="7" maxlength="2000" style="width:100%;box-sizing:border-box;font:inherit;padding:8px;margin-top:8px" placeholder="例：クラス分けの盤面で、名前が小さくて読みにくい">' + esc(SG.text) + '</textarea>' +
        '<div class="acts" style="justify-content:flex-start;margin-top:8px"><button class="btn primary" id="sgsend">送る</button><button class="btn" data-go="menu">メニューに戻る</button></div></section></div>';
    },
    click: function (t) {
      if (!t.closest('#sgsend')) return false;
      var text = App.$('sgtext').value.trim(), self = this;
      SG.text = text;
      if (!text) { App.toast('意見を書いてください'); return true; }
      App.save(function () { return App.pf().suggest(text, 'menu'); }).then(function (r) {
        if (r && r.blocked) { self.render('<div class="warnbox">名前や番号のような語が入っているので、送っていません：' + App.esc(r.blocked.join('、')) + '。言い換えてから、もう一度送ってください。</div>'); return; }
        SG.text = ''; App.toast('送りました。ありがとうございます'); App.go('menu');
      });
      return true;
    },
    input: function (t) { if (t.id === 'sgtext') SG.text = t.value; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

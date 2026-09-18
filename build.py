#!/usr/bin/env python3
"""prototypes/src/ を組み立てて、プロトタイプと GAS の両方を書き出す。

スケールの定義と色トークンは1箇所にしか置かない。読む側が5つある。

  prototypes/grid-sheet.html     児童画面（プロトタイプ）
  prototypes/teacher-view.html   教師画面（プロトタイプ）
  prototypes/dance-count.html    ダンスカウント表（色トークンだけ読む）
  gas/Scale.gs                   GAS のサーバ側
  gas/scale.html                 GAS のクライアント側

GAS の2つは src/scale.js から機械的に作る。手順書には eval で読む書き方を
載せていたが、トップレベルの const が eval の外へ出ない場合があるので、
実ファイルを2つ生成する形にした。中身は同じ1つの元から出ている。

**gas/dist/** は、Apps Script に貼る枚数を減らすための生成物。
gas/*.gs（11本）を1本の Code.gs に、gas/*.html の include() を全部
その場に展開した student/teacher/hello の3本にまとめる。GAS はどの道
全ファイルを1つのスコープで読むので、貼るときの枚数を減らしても
実行結果は変わらない（node gas/localcheck.js は今まで通り gas/*.gs を
個別に読む。エラーが起きたときにどのファイルか分かるように、
開発中はそちらを見る）。

  python3 build.py           生成する
  python3 build.py --check   生成物が元と一致するか調べる（ずれたら終了コード1）
"""
import sys, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent
SRC  = ROOT / "prototypes" / "src"
OUT  = ROOT / "prototypes"
GAS  = ROOT / "gas"
DIST = GAS / "dist"
PAGES = ["grid-sheet.html", "teacher-view.html", "dance-count.html"]

# gas/*.gs を1本にまとめる順。node gas/localcheck.js の読み込み順
# （order）と同じにする。GAS は全ファイルを1つのスコープで読むので
# 本来どの順でも動くはずだが、すでに検査で動くと確かめてある順番に
# 合わせておけば、まとめる側で新たに考えることが無い。
GAS_ORDER = ["Scale.gs", "Config.gs", "Roster.gs", "Master.gs", "Lock.gs", "Hours.gs",
             "Store.gs", "Aggregate.gs", "Api.gs", "Export.gs", "Code.gs", "Setup.gs"]
INCLUDE_HTML = re.compile(r"<\?!= include\('(\w+)'\) \?>")

BANNER = ("/* このファイルは prototypes/src/scale.js から build.py が作る。\n"
          "   直すのは src のほう。ここを直しても次のビルドで消える。 */\n")

INCLUDE = re.compile(r'^[ \t]*/\* @include ([\w.\-]+) \*/[ \t]*$', re.M)

def expand_dark(css: str) -> str:
    """@dark{ … } を、暗い配色の2つのブロックに展開する。

    値を1箇所に保つための仕掛け。CSS ではメディアクエリの中と外を
    1つのセレクタにまとめられないので、ここで複製する。"""
    out, i = [], 0
    for m in re.finditer(r'^@dark\{\n(.*?)^\}\n', css, re.S | re.M):
        body = m.group(1)
        indented = "".join(("  " + l if l.strip() else l) + "\n"
                           for l in body.rstrip("\n").split("\n"))
        out.append(css[i:m.start()])
        out.append(
            "@media (prefers-color-scheme:dark){\n"
            "  :root:not([data-theme=\"light\"]){\n" + indented + "  }\n}\n"
            ":root[data-theme=\"dark\"]{\n" + body + "}\n")
        i = m.end()
    out.append(css[i:])
    return "".join(out)

def render(page: str) -> str:
    src = (SRC / page).read_text(encoding="utf-8")
    seen = []
    def sub(m):
        name = m.group(1)
        seen.append(name)
        body = (SRC / name).read_text(encoding="utf-8").rstrip("\n")
        if name.endswith(".css"):
            body = expand_dark(body + "\n").rstrip("\n")
        return ("/* ▼ src/%s から。直すのは src のほう ▼ */\n" % name
                + body
                + "\n/* ▲ src/%s ここまで ▲ */" % name)
    out = INCLUDE.sub(sub, src)
    if "@include" in out:
        raise SystemExit("差し込みきれていない @include が %s に残っている" % page)
    print("  %-18s ← %s" % (page, ", ".join(seen)))
    return out

def gas_targets():
    """GAS 側の生成物。(出力先, 中身) の組を返す。

    スケールも色トークンも材質も、prototypes/src/ の1つの元から出す。
    プロトタイプと GAS で見た目が割れないのはこれのおかげ。"""
    note = ("<!-- prototypes/src/%s から build.py が作る。直すのは src のほう。 -->\n")

    scale = (SRC / "scale.js").read_text(encoding="utf-8")
    yield GAS / "Scale.gs", BANNER + scale, "scale.js"
    yield GAS / "scale.html", note % "scale.js" + "<script>\n" + scale + "</script>\n", "scale.js"

    for name, out in (("tokens.css", "tokens.html"), ("material.css", "material.html")):
        css = expand_dark((SRC / name).read_text(encoding="utf-8"))
        yield GAS / out, note % name + "<style>\n" + css + "</style>\n", name

def merged_code() -> str:
    """gas/*.gs を GAS_ORDER の順に1本へ連結する。

    GAS はもともと全ファイルを1つのスコープで読む（ファイルをまたぐ
    参照は今もある）ので、1本にまとめても実行結果は変わらない。
    変わるのは Apps Script エディタで作るファイルの数だけ。"""
    parts = []
    for name in GAS_ORDER:
        body = (GAS / name).read_text(encoding="utf-8").rstrip("\n")
        parts.append("/* ==================== %s ==================== */\n" % name + body)
    return ("/* このファイルは gas/*.gs をまとめて build.py が作る。\n"
            "   Apps Script に貼るのはこの1本でよい。直すのは元の gas/*.gs のほう。\n"
            "   ここを直しても次のビルドで消える。 */\n\n"
            + "\n\n".join(parts) + "\n")

def merged_html(name: str) -> str:
    """<?!= include('x') ?> を gas/x.html の中身でその場に展開する。

    展開してしまえば scale.html・tokens.html・material.html は
    要らなくなる（HtmlService の include はファイルの実在が要るが、
    文字列としてその場に置くだけなら要らない）。"""
    src = (GAS / name).read_text(encoding="utf-8")
    def sub(m):
        frag = (GAS / (m.group(1) + ".html")).read_text(encoding="utf-8").rstrip("\n")
        return frag
    out = INCLUDE_HTML.sub(sub, src)
    if "include(" in out:
        raise SystemExit("差し込みきれていない include() が %s に残っている" % name)
    return out

def dist_targets():
    """貼る枚数を減らした版。(出力先, 中身) の組を返す。"""
    yield DIST / "Code.gs", merged_code()
    for name in ("student.html", "teacher.html", "hello.html"):
        yield DIST / name, merged_html(name)

def main():
    check = "--check" in sys.argv
    bad = []
    print("生成物を確認" if check else "生成")
    for page in PAGES:
        built = render(page)
        dest  = OUT / page
        if check:
            cur = dest.read_text(encoding="utf-8") if dest.exists() else ""
            if cur != built:
                bad.append(page)
        else:
            dest.write_text(built, encoding="utf-8")
    if GAS.exists():
        for dest, built, src_name in gas_targets():
            if check:
                cur = dest.read_text(encoding="utf-8") if dest.exists() else ""
                if cur != built:
                    bad.append(dest.name)
            else:
                dest.write_text(built, encoding="utf-8")
                print("  %-18s ← src/%s" % (dest.name, src_name))
        if not check:
            DIST.mkdir(exist_ok=True)
        for dest, built in dist_targets():
            if check:
                cur = dest.read_text(encoding="utf-8") if dest.exists() else ""
                if cur != built:
                    bad.append("dist/" + dest.name)
            else:
                dest.write_text(built, encoding="utf-8")
                print("  %-18s ← gas/*" % ("dist/" + dest.name))
    if check:
        if bad:
            print("\nsrc と一致しない: " + ", ".join(bad))
            print("python3 build.py で作り直す")
            return 1
        print("\n一致している")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""prototypes/src/ を組み立てて、プロトタイプと GAS の両方を書き出す。

スケールの定義と色トークンは1箇所にしか置かない。読む側が4つある。

  prototypes/grid-sheet.html     児童画面（プロトタイプ）
  prototypes/teacher-view.html   教師画面（プロトタイプ）
  gas/Scale.gs                   GAS のサーバ側
  gas/scale.html                 GAS のクライアント側

GAS の2つは src/scale.js から機械的に作る。手順書には eval で読む書き方を
載せていたが、トップレベルの const が eval の外へ出ない場合があるので、
実ファイルを2つ生成する形にした。中身は同じ1つの元から出ている。

  python3 build.py           生成する
  python3 build.py --check   生成物が src と一致するか調べる（ずれたら終了コード1）
"""
import sys, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent
SRC  = ROOT / "prototypes" / "src"
OUT  = ROOT / "prototypes"
GAS  = ROOT / "gas"
PAGES = ["grid-sheet.html", "teacher-view.html"]

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
    """GAS 側の生成物。(出力先, 中身) の組を返す。"""
    scale = (SRC / "scale.js").read_text(encoding="utf-8")
    yield GAS / "Scale.gs", BANNER + scale
    yield GAS / "scale.html", ("<!-- prototypes/src/scale.js から build.py が作る。"
                               "直すのは src のほう。 -->\n"
                               "<script>\n" + scale + "</script>\n")

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
        for dest, built in gas_targets():
            if check:
                cur = dest.read_text(encoding="utf-8") if dest.exists() else ""
                if cur != built:
                    bad.append(dest.name)
            else:
                dest.write_text(built, encoding="utf-8")
                print("  %-18s ← src/scale.js" % dest.name)
    if check:
        if bad:
            print("\nsrc と一致しない: " + ", ".join(bad))
            print("python3 build.py で作り直す")
            return 1
        print("\n一致している")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

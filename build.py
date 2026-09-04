#!/usr/bin/env python3
"""prototypes/src/ を組み立てて prototypes/*.html を書き出す。

スケールの定義と色トークンは1箇所にしか置かない。両画面がそれを読む。
出力は単一ファイルのままなので、アーティファクトへの公開手順は変わらない。

  python3 build.py           生成する
  python3 build.py --check   生成物が src と一致するか調べる（ずれたら終了コード1）
"""
import sys, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent
SRC  = ROOT / "prototypes" / "src"
OUT  = ROOT / "prototypes"
PAGES = ["grid-sheet.html", "teacher-view.html"]

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
    if check:
        if bad:
            print("\nsrc と一致しない: " + ", ".join(bad))
            print("python3 build.py で作り直す")
            return 1
        print("\n一致している")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

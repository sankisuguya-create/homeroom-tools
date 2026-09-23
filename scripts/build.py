#!/usr/bin/env python3
"""各アプリの src/ と shared/ から、配布用 dist/ と GAS 中間生成物を作る。

編集する正本:
  shared/ui/tokens.css
  apps/note-assessment/web/src/
  apps/note-assessment/gas/src/
  apps/dance-count/src/

生成物:
  apps/note-assessment/web/dist/
  apps/note-assessment/gas/generated/
  apps/note-assessment/gas/dist/
  apps/dance-count/dist/

  python3 scripts/build.py
  python3 scripts/build.py --check
"""
import sys, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
NOTE = ROOT / "apps" / "note-assessment"
NOTE_WEB_SRC = NOTE / "web" / "src"
NOTE_WEB_DIST = NOTE / "web" / "dist"
GAS_SRC = NOTE / "gas" / "src"
GAS_GENERATED = NOTE / "gas" / "generated"
GAS_DIST = NOTE / "gas" / "dist"
DANCE = ROOT / "apps" / "dance-count"
DANCE_SRC = DANCE / "src"
DANCE_DIST = DANCE / "dist"
COLLECT = ROOT / "apps" / "collection-check"
COLLECT_SRC = COLLECT / "src"
COLLECT_DIST = COLLECT / "dist"
SHARED_UI = ROOT / "shared" / "ui"

PAGES = [
    (NOTE_WEB_SRC / "grid-sheet.html", NOTE_WEB_DIST / "grid-sheet.html", [NOTE_WEB_SRC, SHARED_UI]),
    (NOTE_WEB_SRC / "teacher-view.html", NOTE_WEB_DIST / "teacher-view.html", [NOTE_WEB_SRC, SHARED_UI]),
    (DANCE_SRC / "Index.html", DANCE_DIST / "Index.html", [DANCE_SRC, SHARED_UI]),
    (COLLECT_SRC / "Index.html", COLLECT_DIST / "Index.html", [COLLECT_SRC, SHARED_UI]),
]
GAS_ORDER = ["Scale.gs", "Config.gs", "Roster.gs", "Master.gs", "Lock.gs", "Hours.gs",
             "Store.gs", "Aggregate.gs", "Api.gs", "Export.gs", "Code.gs", "Setup.gs"]
INCLUDE_HTML = re.compile(r"<\?!= include\('(\w+)'\) \?>")
INCLUDE = re.compile(r'^[ \t]*/\* @include ([\w.\-]+) \*/[ \t]*$', re.M)

BANNER = ("/* このファイルは apps/note-assessment/web/src/scale.js から\n"
          "   scripts/build.py が作る。正本を直すこと。 */\n")

def expand_dark(css: str) -> str:
    """@dark{ … } を暗い配色の2ブロックへ展開する。"""
    out, i = [], 0
    for m in re.finditer(r'^@dark\{\n(.*?)^\}\n', css, re.S | re.M):
        body = m.group(1)
        indented = "".join(("  " + line if line.strip() else line) + "\n"
                           for line in body.rstrip("\n").split("\n"))
        out.append(css[i:m.start()])
        out.append(
            "@media (prefers-color-scheme:dark){\n"
            "  :root:not([data-theme=\"light\"]){\n" + indented + "  }\n}\n"
            ":root[data-theme=\"dark\"]{\n" + body + "}\n")
        i = m.end()
    out.append(css[i:])
    return "".join(out)

def include_file(name: str, search_dirs) -> pathlib.Path:
    for directory in search_dirs:
        candidate = directory / name
        if candidate.exists():
            return candidate
    raise SystemExit("include元が見つからない: " + name)

def render(src: pathlib.Path, search_dirs) -> str:
    body = src.read_text(encoding="utf-8")
    seen = []
    def sub(match):
        name = match.group(1)
        seen.append(name)
        included = include_file(name, search_dirs).read_text(encoding="utf-8").rstrip("\n")
        if name.endswith(".css"):
            included = expand_dark(included + "\n").rstrip("\n")
        return ("/* ▼ src/%s から。直すのは src のほう ▼ */\n" % name
                + included
                + "\n/* ▲ src/%s ここまで ▲ */" % name)
    out = INCLUDE.sub(sub, body)
    if "@include" in out:
        raise SystemExit("差し込みきれていない @include が %s に残っている" % src.name)
    print("  %-18s ← %s" % (src.name, ", ".join(seen)))
    return out

def gas_targets():
    note = ("<!-- apps/note-assessment/web/src/%s から scripts/build.py が作る。"
            " 正本を直すこと。 -->\n")
    scale = (NOTE_WEB_SRC / "scale.js").read_text(encoding="utf-8")
    yield GAS_GENERATED / "Scale.gs", BANNER + scale
    yield GAS_GENERATED / "scale.html", note % "scale.js" + "<script>\n" + scale + "</script>\n"

    material = expand_dark((NOTE_WEB_SRC / "material.css").read_text(encoding="utf-8"))
    yield GAS_GENERATED / "material.html", note % "material.css" + "<style>\n" + material + "</style>\n"

    tokens = expand_dark((SHARED_UI / "tokens.css").read_text(encoding="utf-8"))
    token_note = ("<!-- shared/ui/tokens.css から scripts/build.py が作る。"
                  " 正本を直すこと。 -->\n")
    yield GAS_GENERATED / "tokens.html", token_note + "<style>\n" + tokens + "</style>\n"

def gas_file(name: str) -> pathlib.Path:
    generated = GAS_GENERATED / name
    return generated if generated.exists() else GAS_SRC / name

def merged_code() -> str:
    parts = []
    for name in GAS_ORDER:
        body = gas_file(name).read_text(encoding="utf-8").rstrip("\n")
        parts.append("/* ==================== %s ==================== */\n" % name + body)
    return ("/* apps/note-assessment/gas/src/ と generated/ をまとめて\n"
            "   scripts/build.py が作る。正本を直すこと。 */\n\n"
            + "\n\n".join(parts) + "\n")

def merged_html(name: str) -> str:
    src = (GAS_SRC / name).read_text(encoding="utf-8")
    def sub(match):
        fragment = (GAS_GENERATED / (match.group(1) + ".html")).read_text(
            encoding="utf-8").rstrip("\n")
        return fragment
    out = INCLUDE_HTML.sub(sub, src)
    if "include(" in out:
        raise SystemExit("差し込みきれていない include() が %s に残っている" % name)
    return out

def dist_targets():
    yield GAS_DIST / "Code.gs", merged_code()
    for name in ("student.html", "teacher.html", "hello.html"):
        yield GAS_DIST / name, merged_html(name)
    yield GAS_DIST / "appsscript.json", (GAS_SRC / "appsscript.json").read_text(encoding="utf-8")

def write_or_check(dest: pathlib.Path, built: str, check: bool, bad):
    if check:
        current = dest.read_text(encoding="utf-8") if dest.exists() else ""
        if current != built:
            bad.append(str(dest.relative_to(ROOT)))
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(built, encoding="utf-8")

def main():
    check = "--check" in sys.argv
    bad = []
    print("生成物を確認" if check else "生成")

    for src, dest, search_dirs in PAGES:
        write_or_check(dest, render(src, search_dirs), check, bad)

    for dest, built in gas_targets():
        write_or_check(dest, built, check, bad)
        if not check:
            print("  %-18s ← 正本" % dest.name)

    for dest, built in dist_targets():
        write_or_check(dest, built, check, bad)
        if not check:
            print("  %-18s ← gas/src + generated" % ("dist/" + dest.name))

    if check:
        if bad:
            print("\n正本と一致しない生成物:\n  " + "\n  ".join(bad))
            print("python3 scripts/build.py で作り直す")
            return 1
        print("\n一致している")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

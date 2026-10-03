#!/usr/bin/env python3
"""各アプリの src/ と shared/ から、配布用 dist/ と GAS 中間生成物を作る。

編集する正本:
  shared/ui/tokens.css
  apps/note-assessment/web/src/   （scale.js・material.css のみ。画面の正本は gas/src）
  apps/note-assessment/gas/src/
  apps/dance-count/src/
  apps/collection-check/src/
  apps/desk-layout/src/

生成物:
  apps/note-assessment/gas/generated/
  apps/note-assessment/gas/dist/
  apps/dance-count/dist/
  apps/collection-check/dist/

  python3 scripts/build.py
  python3 scripts/build.py --check
"""
import sys, pathlib, re, hashlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
NOTE = ROOT / "apps" / "note-assessment"
NOTE_WEB_SRC = NOTE / "web" / "src"
GAS_SRC = NOTE / "gas" / "src"
GAS_GENERATED = NOTE / "gas" / "generated"
GAS_DIST = NOTE / "gas" / "dist"
DANCE = ROOT / "apps" / "dance-count"
DANCE_SRC = DANCE / "src"
DANCE_DIST = DANCE / "dist"
COLLECT = ROOT / "apps" / "collection-check"
COLLECT_SRC = COLLECT / "src"
COLLECT_DIST = COLLECT / "dist"
DESK = ROOT / "apps" / "desk-layout"
DESK_SRC = DESK / "src"
DESK_DIST = DESK / "dist"
SHARED_UI = ROOT / "shared" / "ui"

# PAGES の4列目は「外部通信なし」の宣言。True のページは dist から
# 外部参照（フォント・fetch・画像など）が見つかった時点で生成を止める。
# 個人情報を扱う collection-check のみが対象。dance-count は Google Fonts を
# 意図的に遅延読み込みする設計（src/Index.html のフォント節を見よ）なので対象外。
# desk-layout は名簿などの個人情報を持たない設計（docs/spec.md）なので対象外。
PAGES = [
    (DANCE_SRC / "Index.html", DANCE_DIST / "Index.html", [DANCE_SRC, SHARED_UI], False),
    (COLLECT_SRC / "Index.html", COLLECT_DIST / "Index.html", [COLLECT_SRC, SHARED_UI], True),
    (DESK_SRC / "Index.html", DESK_DIST / "Index.html", [DESK_SRC, SHARED_UI], False),
]

# 「外部通信なし」ページの禁止パターン。発信・読み込みどちらの形も拾う。
OFFLINE_PATTERNS = [
    r"https?://", r"url\(", r"fetch\(", r"XMLHttpRequest",
    r"<script src", r"<link", r"@import", r"sendBeacon",
    r"new Image\(", r"<img src", r"<iframe",
]
OFFLINE_RE = re.compile("|".join(OFFLINE_PATTERNS))

def external_refs(text: str):
    hits = []
    for m in OFFLINE_RE.finditer(text):
        line = text.count("\n", 0, m.start()) + 1
        hits.append("%d行目の %s" % (line, m.group(0)))
    return hits

GAS_ORDER = ["Scale.gs", "Config.gs", "Roster.gs", "Master.gs", "Lock.gs", "Hours.gs",
             "Store.gs", "Aggregate.gs", "Api.gs", "Export.gs", "Code.gs", "Setup.gs",
             "Year.gs"]
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

HTML_HEAD = ("<!doctype html>\n<html lang=\"ja\">\n<head>\n"
             "<meta charset=\"utf-8\">\n"
             "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n")
HTML_TAIL = "\n</body>\n</html>\n"

def html_doc(body: str) -> str:
    """静的ページを完全な HTML 文書に包む。src は <title> 始まりの
    フラグメントなので、head の後ろにそのまま置く。最初の非 head 要素で
    ブラウザが自動的に body を開く（<title> は head に入ったまま動く）。
    lang=\"ja\" が無いと漢字を中国語系字形で出す端末があるので必ず付ける。"""
    return HTML_HEAD + body.rstrip("\n") + HTML_TAIL

def expand_css(path: pathlib.Path, search_dirs) -> str:
    """css ファイル内の /* @include */ を再帰的に展開する。
    tokens.css が base.css を読むような、共有cssの層構造に使う。"""
    def sub(match):
        name = match.group(1)
        included = expand_css(include_file(name, search_dirs), search_dirs).rstrip("\n")
        return ("/* ▼ %s から ▼ */\n" % name
                + included
                + "\n/* ▲ %s ここまで ▲ */" % name)
    return INCLUDE.sub(sub, path.read_text(encoding="utf-8"))

def render(src: pathlib.Path, search_dirs) -> str:
    body = src.read_text(encoding="utf-8")
    seen = []
    def sub(match):
        name = match.group(1)
        seen.append(name)
        if name.endswith(".css"):
            included = expand_css(include_file(name, search_dirs), search_dirs)
            included = expand_dark(included.rstrip("\n") + "\n").rstrip("\n")
        else:
            included = include_file(name, search_dirs).read_text(encoding="utf-8").rstrip("\n")
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

    material = expand_dark(expand_css(NOTE_WEB_SRC / "material.css", [NOTE_WEB_SRC, SHARED_UI]))
    yield GAS_GENERATED / "material.html", note % "material.css" + "<style>\n" + material + "</style>\n"

    tokens = expand_dark(expand_css(SHARED_UI / "tokens.css", [SHARED_UI]))
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

# 手貼り運用の版ずれ検知。gas/dist 一式（焼き込み前の本文）の内容ハッシュから
# BUILD 値を決め、各ファイルの @@BUILD@@ 印に同じ値を焼き込む。
# 生成時刻ではなく内容ハッシュにするのは、--check の決定性（dist ≡ 正本からの
# fresh render）を保つため。appsscript.json は JSON で印を置けないので、
# ハッシュの入力だけに含める。
BUILD_TOKEN = "@@BUILD@@"

def build_stamp(arts):
    digests = [hashlib.sha256(built.encode("utf-8")).hexdigest()[:8]
               for _, built in arts]
    build = "BUILD_" + hashlib.sha256("".join(digests).encode("utf-8")).hexdigest()[:12]
    return build, [(d, c.replace(BUILD_TOKEN, build)) for d, c in arts]

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

    for src, dest, search_dirs, offline in PAGES:
        body = html_doc(render(src, search_dirs))
        if offline:
            hits = external_refs(body)
            if hits:
                print("  × %-18s 外部参照があります: %s" % (dest.name, "、".join(hits)))
                bad.append(str(dest.relative_to(ROOT)) + "（外部通信禁止なのに外部参照あり）")
                continue
        write_or_check(dest, body, check, bad)

    for dest, built in gas_targets():
        write_or_check(dest, built, check, bad)
        if not check:
            print("  %-18s ← 正本" % dest.name)

    build, stamped = build_stamp(list(dist_targets()))
    for dest, built in stamped:
        write_or_check(dest, built, check, bad)
        if not check:
            print("  %-18s ← gas/src + generated（%s）" % (("dist/" + dest.name), build))

    if bad:
        print("\n" + ("正本と一致しない生成物" if check else "作れなかった生成物") + ":\n  " + "\n  ".join(bad))
        if check:
            print("python3 scripts/build.py で作り直す")
        return 1
    if check:
        print("\n一致している")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

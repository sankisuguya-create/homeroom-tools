#!/usr/bin/env python3
"""私用PCで VOICEVOX の声を書き出す（Python 標準だけで動く。追加のインストール不要）。

使い方（くわしくは docs/voicevox-steps.md）:
  1. VOICEVOX を起動したままにする
  2. このファイルを置いたフォルダで  python voicevox_export.py
  3. 同じフォルダの voicevox_wav に 24 個の .wav ができる
  4. それを GitHub の apps/classroom-clock/voices-src/ にアップロードする
     （ロボット加工・無音の切り詰め・圧縮・アプリへの埋め込みはクラウド側で行う）
"""
import json, os, sys, urllib.parse, urllib.request

ENGINE = "http://127.0.0.1:50021"   # VOICEVOX が起動中に待ち受ける場所（変えない）

# ---- ここだけ直せば声の調子を変えられる ----
PHRASES = {
    "m1": "残り1分", "s30": "残り30秒",
    "c5": "ご", "c4": "よん", "c3": "さん", "c2": "にー", "c1": "いち",
    "end": "そこまで",
}
VOICES = {
    # キー: (話者名, スタイル名, 話速, 音高, 抑揚)
    "female": ("冥鳴ひまり", "ノーマル", 1.0, 0.0, 1.0),
    "male":   ("青山龍星", "ノーマル", 0.95, -0.04, 0.9),
    "robot":  ("玄野武宏", "ノーマル", 0.9, 0.0, 0.0),   # 抑揚0＝平らな読み。機械の響きは後でクラウド側で足す
}
# ------------------------------------------------

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voicevox_wav")

def call(method, path, body=None, **q):
    url = ENGINE + path + ("?" + urllib.parse.urlencode(q) if q else "")
    data = json.dumps(body).encode("utf-8") if body is not None else (b"" if method == "POST" else None)
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def main():
    try:
        speakers = json.loads(call("GET", "/speakers"))
    except Exception:
        print("VOICEVOX につながりません。VOICEVOX を起動してから、もう一度実行してください。")
        return 1
    ids = {}
    for sp in speakers:
        for st in sp["styles"]:
            ids[(sp["name"], st["name"])] = st["id"]
    os.makedirs(OUT, exist_ok=True)
    n = 0
    for vk, (name, style, speed, pitch, into) in VOICES.items():
        sid = ids.get((name, style))
        if sid is None:
            print("話者が見つかりません: %s（%s）。VOICEVOX を最新版にしてください。" % (name, style))
            return 1
        for pk, text in PHRASES.items():
            q = json.loads(call("POST", "/audio_query", text=text, speaker=sid))
            q.update(speedScale=speed, pitchScale=pitch, intonationScale=into,
                     prePhonemeLength=0.05, postPhonemeLength=0.1, outputSamplingRate=24000)
            wav = call("POST", "/synthesis", q, speaker=sid)
            with open(os.path.join(OUT, "%s-%s.wav" % (vk, pk)), "wb") as f:
                f.write(wav)
            n += 1
            print("%2d/24  %s-%s.wav  %s（%s）" % (n, vk, pk, text, name))
    print("\nできました: " + OUT)
    print("この中の 24 個の .wav を GitHub の apps/classroom-clock/voices-src/ にアップロードしてください。")
    return 0

if __name__ == "__main__":
    sys.exit(main())

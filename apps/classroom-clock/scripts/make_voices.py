#!/usr/bin/env python3
"""教室の時計の読み上げ音声を作る（手元で1回だけ動かす。生成物は src/voices/ に置き、build.py が埋め込む）。

方法（docs/design.md「音声」）:
  1. VOICEVOX ENGINE（無料・ローカル動作のニューラル音声合成）を http://127.0.0.1:50021 で起こしておく。
  2. 話者ごとに audio_query → synthesis で WAV を得る。
  3. ロボットは同じ文を「抑揚0（ピッチ平坦）」で合成し、リングモジュレーション・櫛形フィルタ・
     ビット落としで人間らしさの手がかりを消す（ボコーダー系ロボット声の定石）。
  4. 無音を詰め、音量をそろえ（ピーク -1 dBFS）、ffmpeg で Opus 24kbps モノラルにする。

  python3 apps/classroom-clock/scripts/make_voices.py
"""
import json, pathlib, subprocess, sys, urllib.parse, urllib.request, wave, io
import numpy as np

ENGINE = "http://127.0.0.1:50021"
OUT = pathlib.Path(__file__).resolve().parent.parent / "src" / "voices"

# 文言。キーはアプリが使う名前（src/Index.html の VOICE_KEYS と一致させる）
PHRASES = {
    "m1": "残り1分",
    "s30": "残り30秒",
    "c5": "ご", "c4": "よん", "c3": "さん", "c2": "に", "c1": "いち",
    "end": "そこまで",
}
# 声。speaker は VOICEVOX のスタイルID（engine の /speakers で名前から引く）
VOICES = {
    "female": {"name": "冥鳴ひまり", "style": "ノーマル", "speed": 1.0, "pitch": 0.0, "into": 1.0},
    "male":   {"name": "青山龍星", "style": "ノーマル", "speed": 0.95, "pitch": -0.04, "into": 0.9},
    "robot":  {"name": "玄野武宏", "style": "ノーマル", "speed": 0.9, "pitch": 0.0, "into": 0.0, "robot": True},
}

def get(path):
    return json.loads(urllib.request.urlopen(ENGINE + path).read())

def post(path, body=None, **q):
    url = ENGINE + path + "?" + urllib.parse.urlencode(q)
    data = json.dumps(body).encode() if body is not None else b""
    req = urllib.request.Request(url, data=data, method="POST", headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(req).read()

def style_id(name, style):
    for sp in get("/speakers"):
        if sp["name"] == name:
            for st in sp["styles"]:
                if st["name"] == style:
                    return st["id"]
    raise SystemExit("話者が見つからない: %s / %s" % (name, style))

def synth(text, v, sid):
    q = json.loads(post("/audio_query", text=text, speaker=sid))
    q.update(speedScale=v["speed"], pitchScale=v["pitch"], intonationScale=v["into"],
             prePhonemeLength=0.0, postPhonemeLength=0.05, outputSamplingRate=24000)
    wav = post("/synthesis", q, speaker=sid)
    with wave.open(io.BytesIO(wav)) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return x, sr

def robotize(x, sr):
    t = np.arange(len(x)) / sr
    y = x * (0.55 + 0.45 * np.sin(2 * np.pi * 50 * t))      # リングモジュレーション（50Hzのうなり）
    d = int(sr * 0.006); z = np.copy(y); z[d:] += 0.6 * y[:-d]  # 櫛形フィルタ（金属的な響き）
    z = np.round(z * 48) / 48                               # ビット落とし（約6ビット相当のざらつき）
    return z

def finish(x, sr):
    a = np.abs(x); th = a.max() * 0.02
    idx = np.where(a > th)[0]
    x = x[max(0, idx[0] - int(sr * .01)):idx[-1] + int(sr * .04)]
    return x / (np.abs(x).max() + 1e-9) * 0.89

def write_opus(x, sr, path):
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "-",
                    "-c:a", "libopus", "-b:a", "24k", "-application", "voip", str(path)], input=pcm, check=True)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for vk, v in VOICES.items():
        sid = style_id(v["name"], v["style"])
        for pk, text in PHRASES.items():
            x, sr = synth(text, v, sid)
            if v.get("robot"): x = robotize(x, sr)
            write_opus(finish(x, sr), sr, OUT / ("%s-%s.ogg" % (vk, pk)))
            print("  %s-%s  %s" % (vk, pk, text))
    (OUT / "CREDITS.txt").write_text("VOICEVOX:冥鳴ひまり / VOICEVOX:青山龍星 / VOICEVOX:玄野武宏\n", encoding="utf-8")

if __name__ == "__main__":
    sys.exit(main())

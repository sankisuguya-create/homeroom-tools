#!/usr/bin/env python3
"""私用PCで VOICEVOX から書き出した wav（voices-src/）を、アプリの src/voices.js にする（クラウド側で実行）。

  python3 apps/classroom-clock/scripts/voices_from_wav.py
  python3 scripts/build.py

ロボットは VOICEVOX の平らな読み（抑揚0）に、リングモジュレーション・櫛形フィルタ・ビット落としを足す。
アプリ内の声のクレジット（src/Index.html の id="voiceCredit"）も VOICEVOX の表記に書きかえる。
"""
import pathlib, re, wave
import numpy as np
from voice_post import KEYS, VOICE_KINDS, SRC, robotize, finish, opus_b64, write_js

WAV = pathlib.Path(__file__).resolve().parent.parent / "voices-src"
CREDIT = "VOICEVOX:冥鳴ひまり / VOICEVOX:青山龍星 / VOICEVOX:玄野武宏"

def read(path):
    with wave.open(str(path)) as w:
        sr, ch = w.getframerate(), w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), sr

def main():
    clips = {}
    for v in VOICE_KINDS:
        for k in KEYS:
            p = WAV / ("%s-%s.wav" % (v, k))
            if not p.exists():
                raise SystemExit("見つからない: voices-src/" + p.name)
            x, sr = read(p)
            if v == "robot":
                x = robotize(x, sr)
            clips[v + "-" + k] = opus_b64(finish(x, sr), sr)
    write_js(clips, CREDIT)
    idx = SRC / "Index.html"
    s = idx.read_text(encoding="utf-8")
    s = re.sub(r'(<p class="note" id="voiceCredit">)[^<]*(</p>)', r"\g<1>声：" + CREDIT + r"\g<2>", s)
    idx.write_text(s, encoding="utf-8")
    print("クレジットを書きかえた: " + CREDIT)

if __name__ == "__main__":
    main()

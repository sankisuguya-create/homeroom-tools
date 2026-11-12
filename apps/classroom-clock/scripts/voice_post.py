"""声の後処理（クラウド側で使う共通部品）。make_voices_hts.py と voices_from_wav.py が読む。"""
import base64, pathlib, subprocess
import numpy as np

KEYS = ["m1", "s30", "c5", "c4", "c3", "c2", "c1", "end"]   # src/Index.html の CUES と一致させる
VOICE_KINDS = ["female", "male", "robot"]
SRC = pathlib.Path(__file__).resolve().parent.parent / "src"

def robotize(x, sr):
    x = x / (np.abs(x).max() + 1e-9) * 0.9                     # 先に音量をそろえる（小さいままビットを落とすと声が崩れる）
    t = np.arange(len(x)) / sr
    y = x * (0.55 + 0.45 * np.sin(2 * np.pi * 50 * t))        # リングモジュレーション（50Hzのうなり）
    d = int(sr * 0.006); z = np.copy(y); z[d:] += 0.6 * y[:-d]  # 櫛形フィルタ（金属的な響き）
    return np.round(z * 48) / 48                                # ビット落とし（ざらつき）

def finish(x, sr):
    """前後の無音を詰め、ピークを -1 dBFS にそろえる"""
    a = np.abs(x); idx = np.where(a > a.max() * 0.02)[0]
    x = x[max(0, idx[0] - int(sr * .01)):idx[-1] + int(sr * .04)]
    return x / (np.abs(x).max() + 1e-9) * 0.89

def opus_b64(x, sr):
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()
    out = subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "-",
                          "-ar", "24000", "-c:a", "libopus", "-b:a", "24k", "-application", "voip", "-f", "ogg", "-"],
                         input=pcm, capture_output=True, check=True).stdout
    return base64.b64encode(out).decode()

def write_js(clips, credit):
    missing = [v + "-" + k for v in VOICE_KINDS for k in KEYS if v + "-" + k not in clips]
    if missing:
        raise SystemExit("足りない声: " + ", ".join(missing))
    body = ",\n".join('  "%s": "%s"' % (k, v) for k, v in sorted(clips.items()))
    (SRC / "voices.js").write_text("/* 録音した声。scripts/ の生成手順が作る。直接直さない。\n   声: " + credit + " */\n"
                                   "var CLOCK_VOICES = {\n" + body + "\n};\n", encoding="utf-8")
    print("src/voices.js %d KB" % ((SRC / "voices.js").stat().st_size // 1024))

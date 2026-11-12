#!/usr/bin/env python3
"""読み上げ音声の予備の作り方（VOICEVOX が使えない環境用）。このリポジトリの中だけで完結する。

  pip install pyopenjtalk-plus pyworld numpy
  python3 apps/classroom-clock/scripts/make_voices_hts.py

方法:
  1. Open JTalk（HMM 音声合成）＋ 東北大学 tohoku-f01 neutral（CC BY 4.0）で女性の声を作る。
  2. WORLD（音声分析合成）で 声の高さ F0 と 声道の響き（スペクトル包絡）を分けて操作する:
     - 女性: F0 を 0.8 倍（元の声は高めなので落ち着かせる、中央値 約270Hz）
     - 低い男性: F0 を 0.33 倍（中央値 約110Hz）、包絡の周波数軸を 0.8 倍に縮める（声道を長くした響き）
     - ロボット: F0 を一定（平坦）にし、包絡を少し縮め、リングモジュレーション・櫛形フィルタ・ビット落とし
  3. 無音を詰め、ピーク -1 dBFS にそろえ、Opus 24kbps にし、src/voices.js に base64 で書く。
"""
import base64, pathlib, subprocess, sys
import numpy as np, pyopenjtalk, pyworld
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from make_voices import PHRASES, robotize, finish   # 文言と後処理は VOICEVOX 版と共通

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE.parent / "src"
VOICE = HERE / "htsvoice" / "tohoku-f01-neutral.htsvoice"
READ = {"m1": "のこりいっぷん", "s30": "のこりさんじゅうびょう", "c5": "ご", "c4": "よん", "c3": "さん", "c2": "にー", "c1": "いち", "end": "そこまで"}

def base(text, speed=1.0):
    from pyopenjtalk.htsengine import HTSEngine
    eng = HTSEngine(str(VOICE).encode()); eng.set_speed(speed)
    x = eng.synthesize(pyopenjtalk.extract_fullcontext(text))
    return np.asarray(x, dtype=np.float64) / 32768, eng.get_sampling_frequency()

def warp(sp, ratio):
    """包絡の周波数軸を ratio 倍に（ratio<1 で響きが低く＝体が大きく聞こえる）"""
    n = sp.shape[1]; src = np.arange(n) / ratio
    out = np.empty_like(sp)
    for i in range(sp.shape[0]):
        out[i] = np.interp(src, np.arange(n), sp[i], right=sp[i, -1])
    return out

def world(x, sr, f0mul=1.0, f0flat=None, warp_ratio=1.0):
    f0, t = pyworld.harvest(x, sr, f0_floor=70, f0_ceil=600)
    sp = pyworld.cheaptrick(x, f0, t, sr); ap = pyworld.d4c(x, f0, t, sr)
    f0 = np.where(f0 > 0, float(f0flat) if f0flat else f0 * f0mul, 0.0).astype(np.float64)
    return pyworld.synthesize(f0, warp(sp, warp_ratio), ap, sr)

def opus_b64(x, sr):
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()
    out = subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "-",
                          "-ar", "24000", "-c:a", "libopus", "-b:a", "24k", "-application", "voip", "-f", "ogg", "-"],
                         input=pcm, capture_output=True, check=True).stdout
    return base64.b64encode(out).decode()

def main():
    clips = {}
    for k in PHRASES:
        x, sr = base(READ[k], speed=0.95)
        variants = {
            "female": world(x, sr, f0mul=0.8, warp_ratio=0.97),
            "male": world(x, sr, f0mul=0.33, warp_ratio=0.8),
            "robot": robotize(world(x, sr, f0flat=105, warp_ratio=0.9), sr),
        }
        for vk, y in variants.items():
            clips["%s-%s" % (vk, k)] = opus_b64(finish(np.asarray(y, dtype=np.float32), sr), sr)
            print("  %s-%s" % (vk, k))
    body = ",\n".join('  "%s": "%s"' % (k, v) for k, v in sorted(clips.items()))
    (SRC / "voices.js").write_text(
        "/* 録音した声。scripts/make_voices_hts.py（または make_voices.py）が作る。直接直さない。\n"
        "   声: Open JTalk ＋ HTS voice tohoku-f01（(c) 2015 東北大学 伊藤・能勢研究室, CC BY 4.0）を WORLD で加工 */\n"
        "var CLOCK_VOICES = {\n" + body + "\n};\n", encoding="utf-8")
    print("voices.js %d KB" % ((SRC / "voices.js").stat().st_size // 1024))

if __name__ == "__main__":
    main()

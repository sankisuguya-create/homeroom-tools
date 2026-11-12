# voices-src

私用PCで `scripts/voicevox_export.py` を実行してできた 24 個の `.wav` を、ここにアップロードする（手順は `../docs/voicevox-steps.md`）。
アップロード後、Claude に「声を差し替えて」と伝えると、`scripts/voices_from_wav.py` でアプリの `src/voices.js` を作り直す。

ファイル名は `female-m1.wav` のように「声-区切り」。声は female／male／robot、区切りは m1／s30／c5〜c1／end。

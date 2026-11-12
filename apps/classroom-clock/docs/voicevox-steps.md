# 声を VOICEVOX に差し替える手順（私用PC）

今アプリに入っている声は Open JTalk で作った予備。私用PCで VOICEVOX の声を書き出し、GitHub に上げると、Claude がアプリに組み込む。
所要：初回 20〜30分（インストール含む）、2回目以降 5分。

**全体の流れ**：① VOICEVOX を入れる → ② Python を入れる → ③ 書き出し用のファイルを入手 → ④ 実行して24個の声を作る → ⑤ 聞いて確かめる → ⑥ GitHub に上げる → ⑦ Claude に頼む

---

## ① VOICEVOX を入れて起動する（初回のみ）

1. ブラウザで「VOICEVOX」と検索し、公式サイト（voicevox.hiroshiba.jp）を開く。
2. 「ダウンロード」→ OS を選ぶ（Windows／Mac）。Windows で迷ったら「CPU版」（どのPCでも動く）。
3. インストーラーを実行し、画面の指示どおりに進める。
4. VOICEVOX を起動する。初回は利用規約が出るので同意する。キャラクターが並ぶ画面が出れば準備完了。
5. **このあとの作業中、VOICEVOX は閉じずに起動したままにする**（裏で声を作る役をする）。

## ② Python を入れる（初回のみ・入っていれば飛ばす）

**入っているか確かめる**：
- Windows：スタートボタンを右クリック →「ターミナル」（または「Windows PowerShell」）を開き、`python --version` と打って Enter。`Python 3.x.x` と出れば入っている。
- Mac：「ターミナル」を開き、`python3 --version`。

**入っていない時（Windows）**：
1. python.org →「Downloads」→ 最新の「Download Python 3.x」を押す。
2. インストーラーの最初の画面で、下の **「Add python.exe to PATH」に必ずチェック**を入れてから「Install Now」。
3. 終わったらターミナルを一度閉じて開き直し、`python --version` で確かめる。

## ③ 書き出し用のファイルを入手する

1. デスクトップに新しいフォルダ「voices」を作る。
2. ブラウザで GitHub の homeroom-tools を開き、左上のブランチ名を押して `claude/dreamy-lamport-c4u9kt` に切り替える（PR が取り込まれた後なら `main` のままでよい）。
3. `apps` → `classroom-clock` → `scripts` → `voicevox_export.py` を開く。
4. 右上の「↓（Download raw file）」を押し、①で作った「voices」フォルダに保存する。

## ④ 実行して24個の声を作る

**Windows**：
1. エクスプローラーで「voices」フォルダを開く。
2. 上のアドレス欄（場所が表示されている所）をクリックし、`cmd` と打って Enter。黒い画面が開く。
3. `python voicevox_export.py` と打って Enter。

**Mac**：
1. ターミナルで `cd ~/Desktop/voices` と打って Enter。
2. `python3 voicevox_export.py` と打って Enter。

`1/24 … 24/24` と順に表示され、最後に「できました」と出れば成功。「voices」フォルダの中に `voicevox_wav` フォルダができ、`female-m1.wav` など24個のファイルが入る。

| 出たメッセージ | 直し方 |
|---|---|
| VOICEVOX につながりません | VOICEVOX を起動してから、もう一度④を実行 |
| 話者が見つかりません | VOICEVOX を最新版に入れ直す |
| `python` は認識されていません（Windows） | ②の「Add python.exe to PATH」を入れ忘れ。Python を入れ直す |

## ⑤ 聞いて確かめる

`voicevox_wav` の中のファイルをダブルクリックすると鳴る。

| ファイル名の前半 | 声 |
|---|---|
| female | 女性（冥鳴ひまり） |
| male | 低い男性（青山龍星） |
| robot | ロボットの元（玄野武宏を平らに読ませたもの。機械らしい響きは⑦でクラウド側が足す） |

読み方や速さを変えたい時は、`voicevox_export.py` をメモ帳で開き、「ここだけ直せば」の枠の中の数字（話速・音高・抑揚）や文を直して、④をやり直す。

## ⑥ GitHub に上げる

1. ブラウザで homeroom-tools を開き、ブランチを `claude/dreamy-lamport-c4u9kt` に切り替える。
2. `apps` → `classroom-clock` → `voices-src` を開く。
3. 右上の「Add file」→「Upload files」。
4. `voicevox_wav` の中の24個の .wav を全部選んで、画面にドラッグする。
5. 下の「Commit changes」を押す（「Commit directly to the claude/dreamy-lamport-c4u9kt branch」が選ばれていることを確かめる）。

## ⑦ Claude に頼む

「声を差し替えて」と伝える。Claude が次を行う：ロボットの加工、無音の切り詰め、音量そろえ、圧縮、アプリへの埋め込み、クレジット表記の変更（「VOICEVOX:冥鳴ひまり / VOICEVOX:青山龍星 / VOICEVOX:玄野武宏」）、テスト、push。

---

## 利用規約（voicevox_vvm リポジトリの README・TERMS による）

- 3名とも「VOICEVOX:名前」のクレジットを書けば、商用・非商用で使える。クレジットはアプリの「音」の設定の中に出る。
- 青山龍星は「企業が携わる形で利用する場合」は、事前に ななはぴ に確認が要る。公立学校の授業での個人利用がこれに当たるかは、規約の文面からは判断できない（根拠なし）。気になる場合は、低い男性を玄野武宏（同じ確認条件なし）に替える：③のファイルの `"male"` の行の `青山龍星` を `玄野武宏` に直す。

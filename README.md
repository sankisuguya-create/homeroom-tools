# homeroom-tools

小学校の校務を効率化する道具。2026年度 3年3組。

## ノート評価

教師がノートに書いた記号を児童がサイトへ転写し、その蓄積から単元評価と期末評定を組み立てる。
評価する観点は**主体的に学習に取り組む態度**。

| ファイル | 内容 |
|---|---|
| [`docs/spec.md`](docs/spec.md) | **仕様の正本（仮決定版 v1）。まずここを読む** |
| [`docs/implementation-plan.md`](docs/implementation-plan.md) | GAS + スプレッドシートへの載せ方 |
| [`docs/history.md`](docs/history.md) | 決定の経緯と、取り下げた判断 |
| `prototypes/grid-sheet.html` | 児童画面（生成物） |
| `prototypes/teacher-view.html` | 教師画面（生成物） |
| `prototypes/src/` | 上の2つの元。**直すのはこちら** |
| [`gas/`](gas/) | Google Apps Script 側。いまは Step 3（本人確認）まで |

## ダンスカウント表

運動会・学芸会の集団演技の振り付けを、8カウント単位で書き起こして A4横 に刷る。
曲を問わない。1行＝1エイト（8拍・2小節）で、上に言葉、下に1〜8の動きを入れる。

| ファイル | 内容 |
|---|---|
| [`docs/dance-count.md`](docs/dance-count.md) | 何を決めて何を決めなかったか |
| `prototypes/dance-count.html` | 本体（生成物）。ブラウザで開くだけで動く |
| `prototypes/src/dance-count.html` | その元。**直すのはこちら** |

保存はブラウザ内。端末をまたぐときは書き出したJSONを持ち運ぶ。
**歌詞を入れたJSONはこのリポジトリにコミットしない**（公開リポジトリのため。理由は上のdocs）。

```
python3 build.py           src/ から prototypes/*.html と gas/Scale.gs を生成する
python3 build.py --check   生成物が src と一致するか調べる
node gas/localcheck.js     GAS のコードを手元で走らせて確かめる
```

スケールの定義・色トークン・単元マスタは `prototypes/src/` に1箇所ずつしか置いていない。
それを読む側が5つある（両画面・ダンスカウント表・GAS の2つ）。
`prototypes/*.html` を直接編集すると次のビルドで消える。

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

```
python3 build.py           src/ から prototypes/*.html を生成する
python3 build.py --check   生成物が src と一致するか調べる
```

スケールの定義・色トークン・単元マスタは `prototypes/src/` に1箇所ずつしか置いていない。
両画面がそれを読む。`prototypes/*.html` を直接編集すると次のビルドで消える。

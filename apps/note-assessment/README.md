# ノート評価

教師がノートへ付けた記号を児童がサイトへ転写し、その蓄積から単元評価と期末評定を組み立てます。評価対象は「主体的に学習に取り組む態度」です。

## 読む順番

1. [仕様](docs/spec.md)
2. [実装・配置手順](docs/implementation-plan.md)
3. [判断履歴](docs/history.md)
4. [GASへの配置](gas/README.md)

## どこを編集するか

| 場所 | 内容 |
|---|---|
| `web/src/` | 児童・教師画面の正本、評価スケール、単元例、材質CSS |
| `gas/src/` | GASの手書きコードとHTML |
| `gas/generated/` | `web/src/`と`shared/`から作る中間生成物。編集禁止 |
| `web/dist/` | ブラウザで確認できる完成HTML。編集禁止 |
| `gas/dist/` | Apps Scriptへ貼る完成物。編集禁止 |
| `archive/` | 不採用案。現行実装ではない |

色トークンの正本は、ダンスカウント表と共用する [`../../shared/ui/tokens.css`](../../shared/ui/tokens.css) です。

## コマンド

```bash
python3 scripts/build.py
python3 scripts/build.py --check
node apps/note-assessment/gas/scripts/localcheck.js
node apps/note-assessment/gas/scripts/preview.js
```


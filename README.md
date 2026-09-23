# homeroom-tools

小学校の校務を効率化する道具を、機能ごとに分けて管理するリポジトリです。

## 収録ツール

| ツール | 用途 | 最初に読むもの |
|---|---|---|
| [ノート評価](apps/note-assessment/) | 児童の自己転写から単元評価・期末評定を組み立てる | [概要](apps/note-assessment/README.md) |
| [ダンスカウント表](apps/dance-count/) | 集団演技を8カウント単位で作成・印刷する | [概要](apps/dance-count/README.md) |
| [アイコンメーカー](apps/icon-maker/) | 校務資料用の統一アイコンを作る | [概要](apps/icon-maker/README.md) |
| [席替え](apps/seating/) | 条件と履歴を満たす座席配置を計算する（スプレッドシート拡張） | [概要](apps/seating/README.md) |

週案（時間割の共同編集）は別リポジトリの [school-timetable](https://github.com/sankisuguya-create/school-timetable) が正本です。

## フォルダの規則

- `apps/<ツール名>/src/`: 人が編集する正本
- `apps/<ツール名>/dist/`: 配布・貼り付け用の生成物。直接編集しない
- `apps/<ツール名>/docs/`: 仕様・判断履歴
- `apps/<ツール名>/scripts/` または `tests/`: ビルド・検査
- `shared/`: 複数ツールで共有する正本
- `scripts/`: リポジトリ全体の生成処理

## 生成・検査

```bash
python3 scripts/build.py
python3 scripts/build.py --check
node apps/note-assessment/gas/scripts/localcheck.js
node apps/icon-maker/scripts/build.mjs
node apps/icon-maker/tests/test-app.mjs
node apps/seating/scripts/build.mjs --check
node apps/seating/tests/test-solver.js
node apps/seating/tests/test-code.js
node apps/seating/tests/test-importer.js
```

`dist/`を直しても次のビルドで上書きされます。変更は各`src/`または`shared/`へ入れます。

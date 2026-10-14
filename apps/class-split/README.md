# クラス替え

学年の名簿（配慮項目・事案・経年の記録）とクラス替え（案を作る・入れ替える・比べる・決める）を1つにした職員用の道具。
今は **見本**（架空の児童、ブラウザだけで動く）。`dist/Index.html` をブラウザで開く。GAS への接続は次の PR。

- 設計と決めたことの理由：[docs/design.md](docs/design.md)
- 個人情報の置き場：[docs/pii-map.md](docs/pii-map.md)

## 生成・検査

```bash
python3 scripts/build.py                         # src → dist/Index.html
node --test apps/class-split/tests/engine.test.mjs  # 計算（案・入れ替え・事案数・名前・決定）
node apps/class-split/tests/ui.test.mjs             # 画面（Playwright。無ければ飛ばす）
```

`dist/` は直接直さない。`src/` を直して生成する。

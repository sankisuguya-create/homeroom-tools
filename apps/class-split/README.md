# クラス替え

学年の名簿（配慮項目・事案・経年の記録）とクラス替え（案を作る・入れ替える・比べる・決める）を1つにした職員用の道具。

- 見本（架空の児童・ブラウザだけで動く）：`dist/Index.html` をブラウザで開く
- 本番（GAS）：`dist/gas/` の3つを貼る（下の手順）
- 設計と決めたことの理由：[docs/design.md](docs/design.md)
- 個人情報の置き場：[docs/pii-map.md](docs/pii-map.md)

## 本番の導入（所有者が1回）

1. 新しい Apps Script のプロジェクトを作る（スタンドアロン）。
2. `dist/gas/` の **3つを同じコミットから** 貼る（一部だけ貼り直さない。版がずれると画面に警告が出る）。
   - `Code.gs` → スクリプトの `コード.gs` に全文
   - `Index.html` → HTML ファイル `Index` を作って全文
   - `appsscript.json` → プロジェクトの設定で「appsscript.json をエディタで表示」をオンにして全文
3. エディタで `setup` を実行する。データ用のスプレッドシート「クラス替え（データ）」が所有者のドライブに作られる。**教員には共有しない**（アプリを通してだけ読み書きする）。
4. 名簿を入れる（名簿の貼り付け画面は PR③。それまではエディタで `importRoster(年度, [[児童ID, 氏名, よみ, 性別, 学年, 組, 番号], ...])` を実行するか、`roster_<年度>` シートに直接書く）。
5. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」。実行するユーザー「自分」、アクセスできるユーザー「（学校のドメイン）内の全員」。
6. 直したら、3つを貼り直してから、デプロイの管理 → 編集 → バージョン「新バージョン」で更新する（保存だけでは反映されない）。

## 生成・検査

```bash
python3 scripts/build.py                               # src → dist/Index.html（見本）と dist/gas/（本番）
node --test apps/class-split/tests/engine.test.mjs     # 計算
node --test apps/class-split/tests/gas.test.mjs        # サーバー（模擬の GAS 上。コメントを消した形でも）
node apps/class-split/tests/ui.test.mjs                # 見本の画面（Playwright。無ければ飛ばす）
node apps/class-split/tests/gas-ui.test.mjs            # 本番の画面＋模擬の GAS（Playwright）
```

`dist/` は直接直さない。`src/` を直して生成する。

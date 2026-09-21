# アイコンメーカー

小学校の校務資料向けに、Lucideアイコンを統一された背景・カード形式で量産するGASウェブアプリです。Lucide 1,848種の図形・検索データを同梱しているため、アプリ利用時の外部通信はありません。

## Apps Scriptへの配置

このフォルダを1つの独立したApps Scriptプロジェクトとして扱います。ノート評価の `apps/note-assessment/gas/` プロジェクトとは混ぜません。

1. Apps Scriptで新規プロジェクトを作成する。
2. 最初からある `コード.gs` の内容を、`dist/Code.gs` の内容で置き換える（ファイル名は `Code.gs` にそろえる）。
3. HTMLファイル `Index` を1つ追加し、`dist/Index.html` の内容を貼り付ける。
4. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」を選ぶ。
5. 実行ユーザーは自分、アクセス範囲は学校の運用方針に合わせる。

手動配置で貼り付けるのは上記2ファイルだけです。`appsscript.json` はApps Scriptが自動管理するため、通常は貼り付け不要です。リポジトリ内の `appsscript.json` は `clasp` 配置と設定の再現用に残しています。

`clasp`を使う場合は `.clasp.json.example` を `.clasp.json` にコピーし、`scriptId`を設定してから、このフォルダを作業ディレクトリとして `clasp push` を実行します。編集用ファイルは `src/` に分割されていますが、`dist` は手動配置用にすべてを1つのHTMLへ展開した配布版です。

ソース変更後は `node scripts/build.mjs` で配布版を再生成し、`node tests/test-app.mjs` でアイコン件数・構文・分類・出力形式を検証します。

## 主な操作

- 初期画面はおすすめアイコン。左上の斜線入りメニューから分類・全件へ移動
- プレビューのアイコン部分をクリックすると背景付き画像をコピー
- カード余白をクリックするとカード全体をコピー
- プレビューまたはセット項目を右クリックすると、コピー範囲を選択
- SVG／PNG／JPEG保存、横長カード／正方形カード、セットJSON入出力に対応
- 「設定リンク」で現在のデザインを再現できるURLをコピー
- 背景形は角丸・丸・球体・菱形・六角・立方体・正面立方体・八星・盾の9種類
- 「人物動作」カテゴリに走る・歩く・車椅子・各種運動など16点の人物SVGを内蔵

## デザイン再現URL

URLパラメータで1つのデザインを再現できます。人が読める固定形式なので、AIへデザインを依頼するときも同じ条件を受け渡せます。

```text
?icon=book-open&label=教材&bg=%23147A42&mode=auto&size=large&shape=rounded&layout=icon
```

| パラメータ | 値 |
|---|---|
| `icon` | Lucideのアイコン名 |
| `label` | 表示名（30文字まで） |
| `bg` | `#RRGGBB`。URL内では`#`を`%23`にする |
| `mode` | `auto` / `white` / `black` |
| `size` | `basic` / `large` |
| `shape` | `rounded` / `circle` / `sphere` / `diamond` / `hexagon` / `cube` / `front-cube` / `star` / `shield` |
| `layout` | `icon` / `horizontal` / `square-card` |

不正な値は安全な既定値へ戻します。既存のデプロイURLにこのパラメータを付ければ、端末やブラウザをまたいで同じデザインを開けます。

## AIへデザインを依頼する

AIが依頼文を再現URLへ変換するための判断規則、依頼テンプレート、出力形式は[AI_DESIGN_WORKFLOW.md](AI_DESIGN_WORKFLOW.md)に定義しています。共有する設定リンクには、児童名などの個人情報を表示名として入れません。

## 人物ピクトグラムの出典

人物SVGは[Tabler Icons v3.47.0](https://github.com/tabler/tabler-icons/tree/v3.47.0)から選定し、外部通信なしで使えるSVGスプライトへ変換しています。ライセンスはMITです。採用ファイル、元データのblob SHA、変換内容は[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)、ライセンス全文は[`licenses/Tabler-Icons-MIT.txt`](licenses/Tabler-Icons-MIT.txt)に記録しています。

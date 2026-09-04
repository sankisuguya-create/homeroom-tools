# homeroom-tools

小学校の学級担任業務を効率化する道具置き場。

## 授業評価・単元評価

児童が返却されたノートの評価記号をサイトに転写し、その蓄積から単元評価を組み立てる仕組み。

- [`docs/evaluation-format.md`](docs/evaluation-format.md) — 評価スケール（D〜Z+ の9段階）、集約規則、画面設計の決定事項
- [`prototypes/student-transcribe.html`](prototypes/student-transcribe.html) — 児童の転写画面プロトタイプ。単体で開けるダミーデータ版

実装は Google Apps Script + スプレッドシート。Classroom API は使わない。

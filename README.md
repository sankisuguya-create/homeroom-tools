# homeroom-tools

小学校の学級担任業務を効率化する道具置き場。

## 授業評価・単元評価

児童が返却されたノートの評価記号をサイトに転写し、その蓄積から単元評価を組み立てる仕組み。

- [`docs/evaluation-format.md`](docs/evaluation-format.md) — 評価スケール（D〜Z+ の9段階）、集約規則、画面設計の決定事項
- [`docs/implementation-plan.md`](docs/implementation-plan.md) — GAS 実装手順
- [`prototypes/scale.md`](prototypes/scale.md) — スケール・ロック・集約の仕様（正本）
- [`prototypes/grid-sheet.html`](prototypes/grid-sheet.html) — 児童の転写画面
- [`prototypes/teacher-view.html`](prototypes/teacher-view.html) — 教師の確定画面
- [`prototypes/student-transcribe.html`](prototypes/student-transcribe.html) — 転写画面の別案（1画面1操作）

実装は Google Apps Script + スプレッドシート。Classroom API は使わない。

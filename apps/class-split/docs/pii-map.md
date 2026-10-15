# 個人情報の置き場

列を足したら、この表と削除の処理を一緒に直す（`principles/roster-year-transition.md` §1）。

| 置き場 | 個人を指す列 | 機微な列 | 消す時 |
|---|---|---|---|
| `roster_<年度>` | id8, name, kana | — | 卒業・転出の削除の候補で |
| `attrs_<年度>` | id8 | k1〜k10（配慮項目の程度。名前は settings にだけある）、k5_t・k6_t・k10_t（ア・身・通の内容の文字。病名・配慮の中身など特に機微） | 同上 |
| `pairs_<年度>_<学年>` | id_a, id_b | type, memo（自由記述。氏名を書かない運用） | 同上 |
| `pairs_carry` | id_a, id_b | type（memo は持ち越さない） | 同上 |
| `settings` の `plans_<年度>_<学年>` | assign, locks（id8） | — | 同上 |
| `incidents` | — | title（文書の名前。氏名を入れない運用）, url | 全員が卒業・転出した事案を削除の候補に |
| `incident_kids` | id8 | — | 同上 |
| `log` | by（教員のメール） | — | 個人情報（児童）は入れない |

消しても残るもの（利用者に明示する）：スプレッドシートの版の履歴、事案の文書そのもの（ドライブ側）。

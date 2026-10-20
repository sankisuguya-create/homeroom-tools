# AGENTS.md

作業の前に、利用者のプロファイル・設計理念・スキルの正本を読む：GitHub の `sankisuguya-create/-` リポジトリの `AGENTS.md`（profile/ → principles/ の順）。

- アプリごとの設計の決定は各アプリの `docs/design.md`、個人情報の置き場は `docs/pii-map.md` に書く。利用者に見える動きを変えたら、同じコミットで design.md も直す。
- `dist/` は `python3 scripts/build.py` で作る生成物。直接直さない。push 前に `python3 scripts/build.py --check` とテストを通す（GitHub Actions の check でも確かめる）。

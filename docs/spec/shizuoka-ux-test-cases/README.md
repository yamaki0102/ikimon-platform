# 静岡県内ユースケース検証パック

ikimon.life の品質チェックと UX 検証のために、静岡県内に限定した 10 本の具体的ユースケースを 1 ケース 1 ファイルで整理した。

## Claude Opus 用パック

- 実行手順: [CLAUDE_OPUS_RUNBOOK.md](./CLAUDE_OPUS_RUNBOOK.md)
- 結果テンプレート: [TEST_REPORT_TEMPLATE.md](./TEST_REPORT_TEMPLATE.md)
- ケース別 prompt: `./prompts/`
- レポート保存先: [docs/review/shizuoka-ux-tests/README.md](C:/Users/YAMAKI/Documents/Playground/docs/review/shizuoka-ux-tests/README.md)

## 使い方

1. 1 スレッドにつき 1 ケースだけ扱う
2. 検証前に「前提条件」と「必要な入力データ」を確認する
3. 操作中は「観察ポイント」を順番に評価する
4. 検証後は「合格条件」「失敗シグナル」「記録欄」を埋める

## ケース一覧

| ID | テーマ | 主な検証軸 | ファイル |
| --- | --- | --- | --- |
| SZ-UC-01 | 浜名湖で初心者が初投稿する | 初回投稿導線 / 種名不確実性 / 位置の安心感 | [01_hamanako_beginner_first_post.md](./01_hamanako_beginner_first_post.md) |
| SZ-UC-02 | 下田の親子が磯遊び記録を残す | 連続投稿 / 家族利用 / 海辺生物の扱いやすさ | [02_shimoda_family_tidepool_trip.md](./02_shimoda_family_tidepool_trip.md) |
| SZ-UC-03 | 朝霧高原で夜の昆虫を高精度記録する | 詳細入力 / 複数写真 / 同定保留の扱い | [03_asagiri_night_insect_logging.md](./03_asagiri_night_insect_logging.md) |
| SZ-UC-04 | 焼津港で見慣れない魚を共有する | あいまい投稿 / 海洋文脈 / コメント期待値 | [04_yaizu_unknown_fish_report.md](./04_yaizu_unknown_fish_report.md) |
| SZ-UC-05 | 牧之原の茶農家が益虫害虫を記録する | 高齢者 UI / 実用目的 / 写真中心投稿 | [05_makinohara_tea_farm_insect_check.md](./05_makinohara_tea_farm_insect_check.md) |
| SZ-UC-06 | 沼津の高校生が観察会を記録する | 教育利用 / 複数人利用 / 継続動機 | [06_numazu_school_field_trip.md](./06_numazu_school_field_trip.md) |
| SZ-UC-07 | 安倍川で外来種モニタリングを継続する | データ品質 / 継続比較 / 再訪導線 | [07_abekawa_invasive_species_monitoring.md](./07_abekawa_invasive_species_monitoring.md) |
| SZ-UC-08 | 山地の希少植物を安全に投稿する | 位置秘匿 / プライバシー理解 / 投稿安心感 | [08_mountain_rare_plant_privacy.md](./08_mountain_rare_plant_privacy.md) |
| SZ-UC-09 | 天竜川河口で通信不安定下に記録する | 屋外耐性 / 再開性 / 失敗時 UX | [09_tenryu_estuary_low_connectivity.md](./09_tenryu_estuary_low_connectivity.md) |
| SZ-UC-10 | 富士市の日常観察を積み上げる | 継続利用 / 軽量投稿 / Life List 価値 | [10_fuji_daily_casual_logging.md](./10_fuji_daily_casual_logging.md) |

## 推奨記録ルール

- 各ケースで「完了時間」「迷った箇所」「離脱しそうになった箇所」を必ず残す
- 投稿の成否だけでなく、「次も使いたいか」を 5 段階で記録する
- 画面や API の不具合と、UX 上の違和感は分けて記録する
- 迷いが出た文言や UI 部品は、できればスクリーンショットも残す

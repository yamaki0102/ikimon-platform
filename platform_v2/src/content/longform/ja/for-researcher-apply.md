# 研究でデータを使いたいときの申請窓口

ikimon の市民観察データを研究で利用するための窓口です。送信いただいた内容は個別に確認した上で、1–3 営業日を目安にメールで返信します。

## 対象データ

- [`/api/v1/research/occurrences`](/api/v1/research/occurrences) — Evidence Tier 3+ の観察を Darwin Core JSON で返す公開 API（CC-BY）
- `export_dwca.php` — researcher tier 以上の API キーで DwC-A zip を取得（CC0 / CC-BY）
- 音声アーカイブ — sound_archive 系、bulk export は相談ベースで個別対応

## 申請に含めてほしい情報

「内容」欄に以下を書いてください。構造化フォームは順次整備中です。

- 所属機関（大学 / 研究所 / NPO / 自治体 / 個人）
- ORCID iD（あれば審査が早くなります）
- 希望 tier（researcher / enterprise / government）
- 希望データ範囲（地域・分類群・期間・音声 bulk の要否など）
- 利用目的（研究テーマ・投稿先ジャーナル候補・引用方法）

## データの使い方についてのお願い

ikimon は canonical pack §1.5 trust boundary に従い、AI 候補提示 → 市民記録 → 分類合意 → authority / expert review の段階的信頼レーンを運用しています。既定でお渡しするのは **Evidence Tier 3+** の record です。これは「2 名以上の独立合意、または authority / expert review がある」ことを意味しますが、open dispute、位置秘匿、ライセンス、sampling effort は別途確認します。

- quick capture だけで「いない」「増えた」「減った」を強く言わない
- AI の候補だけを根拠に確定扱いにしない
- 種名で割れている記録は、分類系列上の合意点（属・科など）へ戻して読む
- open dispute がある record は、解決または専門確認まで研究 API / DwC-A の標準対象にしない
- レッドリスト種の位置情報は `coordinateUncertaintyInMeters` で粗化済み、原位置は提供しません
- 強い研究主張には effort / evidence / review の 3 条件を運用側で確認させていただきます

詳しくは [研究とデータの考え方](/learn/methodology) をご覧ください。

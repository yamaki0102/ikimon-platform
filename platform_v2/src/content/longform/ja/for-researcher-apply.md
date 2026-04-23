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

ikimon は canonical pack §1.5 trust boundary に従い、AI 候補提示 → 市民記録 → 専門家レビューの段階的信頼レーンを運用しています。研究利用可能なのは **Evidence Tier 3+**（2 名以上の合意 または 専門家 1 名レビュー済）の record です。

- quick capture だけで「いない」「増えた」「減った」を強く言わない
- AI の候補だけを根拠に確定扱いにしない
- レッドリスト種の位置情報は `coordinateUncertaintyInMeters` で粗化済み、原位置は提供しません
- 強い研究主張には effort / evidence / review の 3 条件を運用側で確認させていただきます

詳しくは [研究とデータの考え方](/learn/methodology) をご覧ください。

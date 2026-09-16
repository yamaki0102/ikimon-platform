# 旧クビアカ実装Master Plan — SUPERSEDED

- Status: `SUPERSEDED / HISTORICAL POINTER`
- Superseded: 2026-09-13 JST, after merge of the citizen-biosecurity design

2026-07-29版のPostgreSQL中心の専用物理モデル、古いPR番号に依存した順序、Kubiaka固有DBを恒久化する読み方は現行実装の正本ではない。

現在の入口:

- [共通の市民参加型バイオセキュリティ詳細設計](../citizen-biosecurity/SPEC.md)
- [クビアカ対象profile](SPEC.md)
- [現行実装計画・受入・rollback](PLAN.md)
- [3プロファイル例と44の受入ケース](../citizen-biosecurity/CONTRACT_EXAMPLES.json)

旧本文は[置換前の固定版](https://github.com/yamaki0102/ikimon-platform/blob/c6b983443a250937bc7c1ea70a57b4893a83275a/docs/spec/kubiaka-focused-experience/IMPLEMENTATION_MASTER_PLAN.md)とGit履歴に保存されている。過去の判断を調べる参照資料であり、旧route・旧schema・旧release手順を復活させる指示ではない。

維持する不変条件は、private-first、actual outbound sinkでの通知遮断、guest/shared-device隔離、receipt単位claim、写真単位の確認範囲、確認authorityの区別、casual写真からのabsence禁止、明示的な外部送信、公開位置の保護である。新設計ではそれらを共通Coreと対象profileに分けて継承する。

本pointerの変更はデータ削除・runtime変更・migration・公開・行政連携の実行を含まない。

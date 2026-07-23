# ikimon.life Home／「自分」再設計 Wレビュー採用ログ

- 日付: 2026-07-24
- 対象: `operations/ai_os/ikimon_home_self_redesign_plan_2026-07-24.md`
- 結果: `complete`
- Claude: `claude-opus-4-8`
- Gemini: `gemini-3.5-flash`
- raw evidence: `operations/ai_os/external_review_evidence/2026-07/ikimon-home-self-redesign-20260724/20260724-050053/`

## 採用

- 他者反応をHeroから外し、本人の記憶を継続動機の基盤にする
- P0を下書き／最近の記憶／安全な活動文脈／初回の4状態に限定する
- Home全サーフェスへサーバー側の写真・位置安全ポリシーを適用する
- 自宅、学校、私有地、希少種、センシティブな場所を自動再訪提案から除外する
- IndexedDB下書きを所有者partitionと認証継続tokenで隔離する
- 公開プロフィールへの下書き・未読・参加予定・訪問頻度漏洩をテストで禁止する
- 反応はP1の専用read modelへ移し、反応者名は表示同意まで出さない
- 計測を事前ベースライン、記録数コホート、完了／閲覧の二層に分ける

## 保留

- 招待制の家族・学校・チーム共有はP2の専用プライバシー設計まで保留
- 反応者実名は双方同意と子どもアカウント規則が決まるまで保留
- 同日・同月・同場所の自動「見返す」は安全選出を含むP1へ保留

## 不採用

- 本人Homeの希少種写真を一律に強くぼかす
  - 自動Hero・再訪から除外し、サーバー側の安全表示で代替する
- 再訪先を公共公園だけに限定する
  - 既存の立入条件・公開ポリシーで安全性を判定する
- Reactのライフサイクルフックを使う
  - 現行のAlpine.js／vanilla DOMに合わせ、差し替え・終了・DOM破棄時に解放する
- ハッシュ化userIdだけで下書き隔離を完了扱いにする
  - ハッシュは認可ではないため、所有者partition、認証継続token、セッション切替時の除去を組み合わせる

## 制約

Claudeは対象ファイルの埋め込み本文をレビューし、実コード自体は読めなかった。正本コードの根拠確認はCodexがローカルで実施し、次を確認済み。

- Home正本: `platform_v2/src/ui/landingHomeState.ts`
- 自分正本: `platform_v2/src/routes/read.ts` の `renderSelfProfileHub()`
- 下書きの現行キー: `ikimon-record-draft / drafts / latest`
- Home既存データ: `myFeed / myPlaces / nearbyEvents / habit / dailyDashboard`

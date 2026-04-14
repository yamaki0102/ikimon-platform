# ikimon.life BtoBtoC Readiness Review

更新日: 2026-04-11

レビュー対象:

- `docs/strategy/ikimon_btobtoc_execution_plan_2026-04-11.md`
- `docs/strategy/ikimon_btobtoc_field_mentor_redesign_2026-04-11.md`
- `docs/spec/ikimon_btobtoc_ui_implementation_spec_2026-04-11.md`
- `docs/spec/ikimon_btobtoc_analytics_spec_2026-04-11.md`
- `docs/strategy/ikimon_btobtoc_route_disposition_2026-04-11.md`
- `docs/strategy/ikimon_btobtoc_release_gate_plan_2026-04-11.md`

---

## 1. 総評

この planning package は、実装前の判断材料として十分強い。

理由:

- 戦略が `表は個人 / 裏は企業` に一貫している
- 画面、計測、露出整理、リリース順が分離されている
- 実装時にブレやすいポイントに gate がある

判定:

- `戦略妥当性`: 高い
- `実装可能性`: 高い
- `依存の明確さ`: 中〜高
- `このまま着手可否`: 可

---

## 2. Findings

## P1. 写真なし軽量記録の永続化は実装で最初に確定すべき

現行計画では `note only` 導線を採用しているが、どの resource / payload で保存するかはまだコード未定。
戦略上は正しいが、実装に入る最初の設計判断として固定する必要がある。

対応:

- R2 着手時に `post.php` と保存先仕様を同時に決める

## P1. Team Workspace の visibility と operational settings の境界は崩れやすい

`corporate_dashboard.php` を支援画面に寄せる方針は正しい。
ただし設定導線を下げすぎると既存運用者が詰まる。

対応:

- UI 上は後段に下げる
- 機能自体は削らない

## P2. analytics の新規イベント追加は save_analytics whitelist 更新を忘れやすい

既存実装は whitelist 型なので、フロントだけ更新しても保存されない。

対応:

- R1 / R2 の DoD に whitelist 更新確認を入れる

## P2. guide 群の役割整理は後半でよいが、トップ露出だけ先に切る必要がある

SEO / 信頼資産として価値はある。
ただし公開トップとナビに残しすぎると主導線を散らす。

対応:

- R1 で露出整理
- R4 で内容整理

---

## 3. Blocker 判定

Blocker はない。

つまり、

- 実装前提の計画としては成立している
- 追加で必要なのは、着手フェーズごとの局所仕様確定だけ

---

## 4. GO 条件

次の条件を採用するなら GO 推奨。

- Home を最初に変える
- 企業向け導線は sponsor page 化する
- wellness をスコアページから習慣ページへ変える
- Team Workspace を支援画面へ寄せる
- 露出整理は最後にまとめて行う

---

## 5. 最終判定

`GO 推奨`

ただし、

- 実装時に方針を戻さない
- フェーズ順を崩さない
- 各リリース gate を守る

この 3 条件は必須。


# ikimon.life BtoBtoC Release Gate Plan

更新日: 2026-04-11

目的:

- 実装順を守る
- 途中で設計が散るのを防ぐ
- 戻し条件を明示する

---

## 1. リリース単位

### R1. Public Repositioning

対象:

- `index.php`
- `components/nav.php`
- `for-business/index.php`
- `components/onboarding_modal.php`

Gate:

- ホームの主導線が 2 本以内
- フィードが主役でない
- Teams 導線が裏方として成立

Rollback 条件:

- 新規訪問からの導線クリック率が大きく悪化
- ログイン済みユーザーが `どこから記録するか` 迷う

### R2. Daily Loop

対象:

- `post.php`
- `wellness.php`
- analytics

Gate:

- 初回記録完了の導線が短い
- `wellness` が次の一歩を返している
- note only 導線の仕様が定まっている

Rollback 条件:

- 投稿完了率が大きく落ちる
- 既存投稿機能の回帰が出る

### R3. Team Sponsor

対象:

- `corporate_dashboard.php`
- `for-business/apply.php`
- `corporate_members.php`

Gate:

- 監視画面に見えない
- manager が次の一手を見つけやすい

Rollback 条件:

- team workspace で設定系導線が見つからず運用停止
- 既存契約ユーザーが必要操作に到達できない

### R4. Place and Evidence

対象:

- `site_dashboard.php`
- `guide/*`
- `generate_*_report.php`

Gate:

- sponsor -> team -> place -> evidence がつながる

### R5. Exposure Cleanup

対象:

- 各種リンク
- ナビ
- 補助ページ導線

Gate:

- 主導線が散っていない
- 深いページが見えなくなりすぎていない

---

## 2. 共通チェック

各リリース前後で最低限確認すること。

- `php tools/lint.php`
- 主要対象ページの表示確認
- CTA 遷移確認
- モバイル表示確認
- analytics 発火確認

---

## 3. スモークテスト

## 3.1 Public

- `/` 表示
- Hero CTA から `post.php` 到達
- Hero CTA から `for-business/` 到達

## 3.2 Capture

- 写真あり記録
- 写真なし導線
- ゲスト制限
- オフライン保留

## 3.3 Team

- `for-business/` 表示
- `apply.php` 到達
- `corporate_dashboard.php` 表示
- `site_dashboard.php` 到達

---

## 4. 戻し戦略

- 既存 deep pages は消さずに残す
- 主導線だけ先に切り替える
- 各リリースは 1ブランチ 1主テーマで切る
- 問題が出たら UI 差し替えを戻し、データ構造変更は後退させない

---

## 5. 実装順固定ルール

以下の順以外で着手しない。

1. Home
2. Nav
3. Team Sponsor Page
4. Capture
5. My Rhythm
6. Team Workspace
7. Place Workspace
8. Exposure Cleanup

---

## 6. Definition of Done

- 各リリースに gate がある
- rollback 条件が明文化されている
- 実装順が崩れない


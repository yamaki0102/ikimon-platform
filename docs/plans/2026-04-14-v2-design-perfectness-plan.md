# ikimon v2 デザイン完成度向上 実装プラン

> For Hermes: この計画に従い、stagingでデザイン完成度を上げる。production切替は実施しない。

Goal:
- production相当の体験を維持したまま、コンセプト整合（日本語体験・情報設計・導線）を改善し、「切替前にデザイン完成」と言える状態にする。

Architecture:
- 既存 `platform_v2` のサーバーサイドHTML生成（Fastify + siteShell）を維持。
- 破壊的なレイアウト変更は避け、まずは文言・導線・視覚的一貫性の改善を段階実装。
- すべて staging で確認し、visual/parityチェック通過まで production 切替は禁止。

Tech Stack:
- TypeScript / Fastify / SSR HTML (`platform_v2/src/app.ts`, `platform_v2/src/routes/marketing.ts`, `platform_v2/src/ui/siteShell.ts`)

---

## 現状ファクト（本作業で確認済み）

- `https://ikimon.life` と `https://staging.ikimon.life/v2` の主要マーケティングページHTMLは一致（title/length/hash一致）
  - `/`, `/about`, `/for-business`, `/faq`, `/learn`
- stagingの `/v2/for-business.php?lang=ja` 互換導線は修正済み（200到達）
- staging readiness は `near_ready` に復帰済み
- ただし `?lang=ja` 表示でも英語文言が多く残る
  - 例: `Enjoy Nature`, `Learn`, `For Business`, フッタータグライン英語

---

## 完成定義（Design DoD）

1) JA体験の言語整合
- `lang=ja` ページで主要ナビ、見出し、CTA、フッターが日本語化されている
- 意図的な英語（ブランド語）以外の混在を除去

2) 情報設計整合
- 主要導線が3クリック以内で完結
  - ホーム -> 記録
  - ホーム -> みつける
  - ホーム -> 読む（FAQ/Methodology/更新）
  - ホーム -> 法人向け

3) 視覚的一貫性
- ヘッダー・ボタン・カード・フッターのトーン統一
- ページ間で余白/タイポ/ラベル規則が一貫

4) リグレッション安全性
- `/v2` 配下の互換リダイレクト破壊なし
- health/readyz/readiness が200
- 主要5ページのHTML差分レポートが意図通り

---

## Task 1: デザイン基準面の固定（baseline採取）

Objective:
- 変更前ベースラインを固定し、改善後比較可能にする。

Files:
- Create: `docs/review/2026-04-14-v2-design-baseline.md`
- Create: `output/design-baseline/*.html`

Steps:
1. productionとstaging(v2)の主要ページHTMLを保存（5ページ）
2. タイトル・本文長・主要文言（JA/EN混在）を抽出
3. レビュー文書に「問題箇所（文言・導線・一貫性）」を記録

Verification:
- ベースライン文書に、URLごとの比較結果が残ること

---

## Task 2: JA言語整合の最小修正

Objective:
- `lang=ja` で英語混在を解消し、ブランドコンセプトを日本語体験へ寄せる。

Files:
- Modify: `platform_v2/src/ui/siteShell.ts`
- Modify: `platform_v2/src/routes/marketing.ts`
- Modify: `platform_v2/src/app.ts`

Steps:
1. `shellCopy.ja` の `brandTagline`, nav, footer文言を日本語主体へ調整
2. `marketing.ts` の JAタイトル/eyebrowを日本語化（About/Learn/For Businessなど）
3. `app.ts` ランディング導線文言のJA版を最終語彙へ統一
4. 破壊防止として `lang=en/es/pt-BR` を変更しない

Verification:
- `?lang=ja` の抽出語に英語残存が大幅減（許容語のみ）
- `/about`, `/learn`, `/for-business` のtitleがJA方針に一致

---

## Task 3: コンセプト改善（追加価値）

Objective:
- 「本番再現 + 追加改善」を満たすため、価値訴求を一段上げる。

Files:
- Modify: `platform_v2/src/app.ts` (landing copy)
- Modify: `platform_v2/src/routes/marketing.ts` (learn/about card文言)

Steps:
1. ヒーロー下に「3つの価値」(続ける理由/場所記録/後で見返せる) を短文化
2. Learnカードを「初心者導線」「根拠確認導線」に再編
3. For Businessの最初の訴求を「導入効果」中心に修正

Verification:
- CTAクリック先が全て有効（404なし）
- 価値訴求文の重複削減、可読性向上（文字数制御）

---

## Task 4: QAと差分レビュー

Objective:
- 改善の妥当性を機械的に確認し、主観だけで進めない。

Files:
- Create: `docs/review/2026-04-14-v2-design-after.md`

Steps:
1. 変更後HTMLを再採取
2. baselineとの差分を要約（文言・リンク・タイトル）
3. health/readinessと主要ページステータスを再確認

Verification:
- `status near_ready` 維持
- 主要ページ200
- before/after差分がレビュー文書に明示

---

## Task 5: 切替前ゲート（切替はまだしない）

Objective:
- 「切替可能判定」だけ作る。実切替は禁止。

Files:
- Create: `docs/review/2026-04-14-cutover-gate-design-only.md`

Steps:
1. Go/No-Go チェックリスト作成
2. デザイン要件未達項目があればNo-Goを維持
3. ユーザー承認が出るまで production切替を禁止

Verification:
- 判定文書に、未達・達成・次アクションが明示されていること

---

## 実行ルール

- 本番切替コマンドは実行しない
- stagingのみ変更・検証
- 途中でも不整合を見つけたら先に修正
- 各Task後に結果を記録し、次Taskへ進む

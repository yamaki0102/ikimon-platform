# ZUKAN — Documentation Start Here

このrepoの実装入口はroot [`AGENTS.md`](../AGENTS.md)、機械可読project pointerは[`PROJECT.json`](../PROJECT.json)です。

公開サービスの現行名は`ZUKAN`です。`ikimon.life`、`platform_v2`、repository名、API名は移行承認まで技術識別子として維持します。ZUKANは生き物・自然観察アプリを他領域へ拡張するサービスではなく、地域の写真、資料、観察、活動、出来事等を根拠・時点・権利・確認状態つきで育て、ViewやPublicationへ返す地域知識基盤です。

## 世界共通のプラットフォーム束 — 2026-09-13 amendment

`zukan.earth` は同格の公開プラットフォーム／体験の束です。優先的な「通常ZUKAN」、全領域共通の必須AI prompt、生物アプリを親とする構造はありません。求人・飲食・イベント・特典・環境・外来種・学習・地域情報などを共有の意味／権利／時点／Evidenceでつなぎます。市民の記録・投稿・参加も継続するので、NOCOSILからの発信だけに限定しません。

[Global Platform Bundle + NOCOSIL Public Distribution revision 2](https://github.com/yamaki0102/all-projects-management/blob/main/operations/decisions/2026-09-13-zukan-public-portal-network-and-nocosil-distribution-v1.md) を、この範囲のURL・公開配信・世界対応の設計正本として参照します。言語と地域／市場／法域の分離、安定Area/Object ID、発信先別効果、翻訳鮮度、掲載終了、検索、費用、GP01–GP30の受入条件を定義します。従来文書を「通常版が専門版を所有する」と解釈すること、日本の都道府県／市区町村階層を世界共通の必須構造にすることはSUPERSEDEDです。既存のデータ責任・利用権・安全境界・稼働route・実装順を一括変更する宣言ではありません。

ZUKANの有効なプロダクト境界は [`spec/zukan-product-architecture/SPEC.md`](spec/zukan-product-architecture/SPEC.md)、実装順は [`spec/zukan-product-architecture/PLAN.md`](spec/zukan-product-architecture/PLAN.md) を参照します。Program / Publication / Source exchangeの広い将来プロファイルとanti-drift境界は [`spec/zukan-product-architecture/PROFILE_HORIZON.md`](spec/zukan-product-architecture/PROFILE_HORIZON.md)、ユーザー体験の現行正本は [`spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md`](spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md) を参照します。

市民参加型の外来種記録・通報支援は [`spec/citizen-biosecurity/SPEC.md`](spec/citizen-biosecurity/SPEC.md) を共通契約とし、専門体験／prompt境界は [`SERVICE_SURFACE_AND_PROMPT_BOUNDARY.md`](spec/citizen-biosecurity/SERVICE_SURFACE_AND_PROMPT_BOUNDARY.md)、AI/API費用境界は [`AI_INFERENCE_COST_BOUNDARY.md`](spec/citizen-biosecurity/AI_INFERENCE_COST_BOUNDARY.md)、クビアカ固有の差分は [`spec/kubiaka-focused-experience/SPEC.md`](spec/kubiaka-focused-experience/SPEC.md)、実装順は [`spec/kubiaka-focused-experience/PLAN.md`](spec/kubiaka-focused-experience/PLAN.md) を参照します。専門サービス体験と共通Recordを分ける設計であり、別DBや本番稼働済みの宣言ではありません。

公開ホームの現行仕様は [`spec/public-home-state-split.md`](spec/public-home-state-split.md)、完了判定は [`operations/public-home-ux-completion-gate.md`](operations/public-home-ux-completion-gate.md) を参照します。

## 読む順番

1. [`AGENTS.md`](../AGENTS.md) — current app、security、test、deploy境界
2. [`PROJECT.json`](../PROJECT.json) — organization / service / projectと外部正本へのpointer
3. このファイルのGlobal Platform Bundle amendmentと [`spec/zukan-product-architecture/SPEC.md`](spec/zukan-product-architecture/SPEC.md) — 有効範囲ごとのプロダクト境界
4. [`spec/zukan-product-architecture/PROFILE_HORIZON.md`](spec/zukan-product-architecture/PROFILE_HORIZON.md) — 生物/観察会へ狭めないProgram・Publication・Source exchange horizon
5. [`spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md`](spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md) — public/member/PWAを含む現行Experience contract
6. このファイル — product docsの入口
7. 対象機能のREADME
8. 現行仕様、ADR、実装計画
9. `yamaki0102/all-projects-management`のcurrent-state packetと中央Issue
10. 対応Issue・PR・code・tests

## Current app

正本URLは `https://zukan.earth/`。稼働入口は `platform_v2/cloudflare_shadow/src/index.ts` と登録済みCloudflare資源です。Node/UI materializationとPostgreSQL実装資産は稼働状態と区別し、旧LIVE_VERIFIED・旧デプロイ資料を現在の証明に流用しません。

通常の開発対象は`platform_v2/`です。`upload_package/`は互換・rollback・data preservation等の明示的なlegacy作業だけで扱います。

## 主要な仕様入口

### ZUKANのプロダクト構造・Record／Claim／Publication／Action境界

[`spec/zukan-product-architecture/SPEC.md`](spec/zukan-product-architecture/SPEC.md)

Knowledge Core、Participation / Workflow、Experience / Publicationの3層と、横断Domain Pack、安全・緊急対応の責任境界を定義します。

### ZUKANのProgram / Publication / Source exchange horizon

[`spec/zukan-product-architecture/PROFILE_HORIZON.md`](spec/zukan-product-architecture/PROFILE_HORIZON.md)

観察会を一つのProgram profileとして位置づけ、フォトコン、写生・編集企画、まち歩き/ミッション、観光・関係人口施策、地域Publication、権利安全な人物profile、NOCOSIL public-safe projectionまでを同じCoreから展開する境界を定義します。ここにある将来profileは、Product Registryでexecutor-eligibleになるまでruntime実装済みを意味しません。

### ZUKAN App Experience

[`spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md`](spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md)

Home / 記録 / 場所 / 参加 / 自分、global撮影action、状態優先順位、現在の観察会profileと将来Program profileの見せ分け、PWAのZUKANブランド移行を定義します。既存navigationは現在の体験契約であって、すべてのpeer platformへ必須の親shellを課す意味ではありません。

### 市民参加型バイオセキュリティとクビアカ見守り

[`spec/citizen-biosecurity/SPEC.md`](spec/citizen-biosecurity/SPEC.md)

対象別guideと共通Record、Claim/Review、地域policy、guest/private receipt、通報handoff、再訪、権利付き再利用、国際交換の責務を定めます。既存Biodiversity Domain Pack内のprofile群であり、ZUKAN全体を外来種アプリへ狭めません。

[`spec/citizen-biosecurity/AI_INFERENCE_COST_BOUNDARY.md`](spec/citizen-biosecurity/AI_INFERENCE_COST_BOUNDARY.md) はTarget Profile数とAI/API実行回数を切り離し、他のpeer surfaceへの外来種常時screeningを禁止します。操作起点の必要時推論・文脈／権利を確認した結果再利用・同時実行を含む予算制御・AI以外の費用計測を定めます。

最初の対象は [`クビアカprofile`](spec/kubiaka-focused-experience/SPEC.md)。[`PLAN.md`](spec/kubiaka-focused-experience/PLAN.md) が実装順と受入を持ち、[`CONTRACT_EXAMPLES.json`](spec/citizen-biosecurity/CONTRACT_EXAMPLES.json) は構造検証用3プロファイルと44の受入ケースです。ケースは製品テスト結果ではありません。旧PostgreSQL中心のIMPLEMENTATION_MASTER_PLANはSUPERSEDEDです。

### 記録詳細・複数観察・AI解析・環境モニタリング

[`spec/record-detail-observation/README.md`](spec/record-detail-observation/README.md)

この仕様は、record、observation、media、identification、occurrence、AI provisional data、community identification、environment assessment、monitoringの責務を分離します。これらの生物専門モデルはBiodiversity Domain Packとして維持し、ZUKAN全体の対象境界とは解釈しません。

## 正本境界

- company / product strategy: `yamaki0102/ikimon-business-strategy`
- active product specification / ADR / implementation plan / code: このrepo
- live phase / blocker / next action / deploy state: `yamaki0102/all-projects-management`
- organization boundary: `yamaki0102/company-strategy-portfolio`
- global routing: `yamaki0102/github-project-map`

このrepoへ横断的なlive statusや他社戦略を複製しません。

## 書き方

- `SPEC.md`: 現在有効な契約
- `decisions/ADR-*`: 変更理由、棄却案、影響
- `PLAN.md`: 実装順、migration、検証、rollback
- `PROFILE_HORIZON.md`: 実装済みと将来profileを混同せず、共通Coreからの展開範囲とanti-driftを固定
- GitHub Issue: 個別作業
- Pull Request: 差分、review、verification evidence

ローカル絶対パス、端末名、secret、OAuth値を恒久的な正本参照として書きません。

## 2026-09-17 — Quiet discovery and personal continuity

The logged-in cross-surface Home and private saved-reference delta are governed by `docs/spec/zukan-app-experience/QUIET_DISCOVERY_PERSONAL_CONTINUITY_V1.md` (relative to repository root). This narrowly supersedes compulsory recent-photo/next-task dominance, not specialist/capture/rights behavior. Automatic NOCOSIL account linking and ongoing synchronization are separate unverified boundaries, not implied by export.

# ZUKAN Promotional Outputs and Coupons Contract

- Date: 2026-07-27
- Status: accepted strategy contract / source not implemented
- Strategy source: `yamaki0102/ikimon-business-strategy@main`
- Related decisions:
  - `decisions/2026-07-27-zukan-minimal-paid-offerings.md`
  - `decisions/2026-07-27-zukan-species-report-export-boundary.md`
- Related free core: `docs/spec/programs/ZUKAN_FREE_ORGANIZATIONAL_CORE_CONTRACT.md`

## 1. Purpose

ZUKANの標準利用を無料で維持しながら、特定組織の提出・集客・販促へ追加価値を作る有償領域を実装上分離する。

有償商品は次の3系統を基本とする。

1. 専門レポート・種リスト・生物相集計
2. ZUKANデータ活用型LP・キャンペーン・独自イベントページ
3. クーポン

この文書は課金実装を承認しない。ドメイン境界、権利、安全、表示上の不変条件だけを定める。

## 2. Free invariants

次は料金状態に依存させない。

- Account
- Program
- participants / teams / roles
- Quest
- standard activity or event page
- visibility / consent / Review
- cross-year handover
- operational activity summary
- raw-record portability archive for records created by the user or organization
- normal regional View publication of individual Records and non-exhaustive curated discoveries
- correction and objection routes

有料契約が終了しても、無料コア、原記録ポータビリティ、訂正経路へのアクセスを失わせない。

次はfree invariantではない。

- site-, Program-, organization-, or period-level taxon inventories
- provisional or reviewed species lists
- species/taxon counts and taxonomic composition
- biodiversity comparisons
- report-oriented CSV, Excel, PDF, API, tables, and charts

## 3. Paid output types

### 3.1 TaxonInventory

場所、サイト、Program、組織、期間等を単位に、複数Recordから分類群を抽出・統合して作る派生物。

TaxonInventoryは、専門家確認や品質保証が付かない暫定版であっても有償領域とする。

含み得る処理:

- record selection by Place, Program, organization, or period
- duplicate-observation consolidation
- taxonomic name normalization
- accepted-name / synonym resolution
- Japanese/scientific/common-name mapping
- taxonomic hierarchy projection
- provisional, reviewed, or confirmed status projection
- evidence and source linkage
- first/last observation date
- observation effort and coverage fields
- conservation or rare-species status projection
- species/taxon counts and composition
- comparison across periods or sites

最低属性候補:

- `taxonInventoryId`
- `commissioningAgentId`
- `subjectPlaceIds`
- `coveredProgramIds`
- `observationPeriod`
- `sourceRecordIds`
- `inventoryScope`
- `normalizationPolicyVersion`
- `deduplicationPolicyVersion`
- `reviewLevel`
- `generatedAt`
- `version`
- `deliveryState`
- `disclaimer`

TaxonInventoryの画面表示、download、APIは同じ有償境界とする。画面だけ無料、exportだけ有償という分離は採用しない。

### 3.2 ProfessionalReport

自然共生サイト報告、モニタリング報告、行政・認証・社内開示等、人が確認・編集し、提出物として品質や説明責任を負う成果物。

ProfessionalReportはTaxonInventoryを参照できるが、canonical RecordやReviewを所有・上書きしない。

最低属性候補:

- `reportId`
- `reportType`
- `commissioningAgentId`
- `subjectPlaceIds`
- `coveredProgramIds`
- `observationPeriod`
- `sourceRecordIds`
- `taxonInventoryIds`
- `reviewScope`
- `reviewerAgentIds`
- `generatedAt`
- `approvedAt`
- `version`
- `deliveryState`
- `disclaimer`

### 3.3 PromotionalPublication

ZUKANのPlace、Record、時間軸、公開情報等を利用し、特定組織の集客、ブランド、販売促進のために制作する公開物。

例:

- LP
- campaign page
- custom event page
- feature / story / route
- banner / video / social creative

標準Programページや標準イベントページはPromotionalPublicationではない。

最低属性候補:

- `publicationId`
- `sponsorAgentId`
- `purpose`
- `sourcePlaceIds`
- `sourceRecordIds`
- `commercialUseClearance`
- `sponsorDisclosure`
- `publicationWindow`
- `editorialOwner`
- `canonicalDataRevision`
- `status`

### 3.4 CouponCampaign

特定の発行者が条件付きの便益を利用者へ提供する販促オブジェクト。

初期scope:

- issue
- distribute
- claim
- validate
- redeem
- suspend / cancel
- aggregate usage

初期scope外:

- payment
- settlement
- stored value
- cash equivalent
- automatic revenue sharing

これらを追加する場合は別Decision、法務・会計・セキュリティreviewを必要とする。

最低属性候補:

- `couponCampaignId`
- `issuerAgentId`
- `title`
- `terms`
- `eligiblePlaceIds`
- `eligibleProgramIds`
- `validFrom`
- `validUntil`
- `claimLimit`
- `redemptionLimit`
- `validationMethod`
- `sponsorDisclosure`
- `status`

## 4. Raw record and derived output separation

`RawRecordPortabilityArchive`と`TaxonInventory`を同一contractにしない。

RawRecordPortabilityArchive:

- Record単位の原本・原入力・識別子・日時・Place・同意・公開状態・Review状態等を保全・移行する
- uncertaintyを保持する
- 複数Recordを分類群単位へ統合しない
- 分類名を報告用に正規化しない
- 種数・分類群構成を計算しない
- サイト・期間単位の一覧や比較を生成しない

TaxonInventory:

- 複数Recordを特定scopeで選択する
- 分類群単位へ統合する
- 名寄せ・重複排除・集計・比較を行う
- 報告や説明へ利用できる派生物を生成する

利用者が自身の原記録を用いて、自ら集計や報告を行うことは、このcontractで禁止しない。ZUKANが無料で提出直前の派生物を生成しない、という境界である。

## 5. Knowledge and commerce separation

TaxonInventory、ProfessionalReport、PromotionalPublication、CouponCampaignは、canonical Place、Record、Assertion、Reviewを所有・上書きしない。

- 派生物が引用するcanonical dataは参照として保持する。
- 有料顧客の要望でcanonical facts、Review結果、確認状態を変更しない。
- 有料状態を検索順位、地域View掲載可否、同定確度、Review権限へ使わない。
- 派生物から得た新情報を正本へ戻す場合も通常のEvidence・Reviewを通す。
- sponsor、advertisement、coupon、official、editorial、inventory、reportを表示上区別する。

## 6. Rights and consent gate

ZUKAN上で閲覧可能であることと、商用利用・報告利用可能であることを同一視しない。

PromotionalPublicationや外部提出物へRecord等を採用する前に、少なくとも次を判定する。

- copyright / license
- contributor consent
- portrait and personal data
- minor consent
- commercial reuse permission
- reporting reuse permission
- location sensitivity
- rare species safety
- organization-specific confidentiality
- attribution requirement
- modification permission

判定不能の場合は自動採用しない。公開データであっても利用権が確認できない素材は除外または個別確認とする。

## 7. Free display boundary

無料で表示できるもの:

- individual Record
- individual Place
- individual identification candidate or Review state
- operational activity summary
- explicitly non-exhaustive recent discoveries
- curated features that do not claim completeness

無料で表示しないもの:

- complete or list-like species inventory for a Place, Program, organization, site, or period
- provisional complete species list
- species count or taxonomic composition intended as biodiversity outcome
- deduplicated taxon table
- report-like comparison or dashboard

非網羅的な発見表示は、完全な種一覧ではないことを明示する。

## 8. Page boundary

### Free standard page

- standard template
- Program / Quest / event facts
- standard media slots
- standard map and Place references
- standard schedule and participation information
- standard sharing metadata

### Paid custom publication

次のうち一つ以上を、特定組織向けに人が設計・制作・保証する場合。

- individual campaign concept
- custom information architecture
- custom visual design or motion
- editorial curation using ZUKAN data
- custom conversion flow
- external marketing integration
- campaign analytics and optimization
- fixed delivery date and acceptance criteria

機能の見た目が豪華かだけで判定せず、個別制作・集客目的・成果責任で判定する。

## 9. Coupon trust boundary

- 利用者のclaim / redeemは無料とする。
- 発行者側の発行・管理・分析を有償対象にできる。
- 発行者、条件、期限、対象、利用方法を明示する。
- coupon statusをPlaceの品質・公式性・人気度へ変換しない。
- couponを理由にRecord投稿、Review承認、個人情報提供を強制しない。
- 未成年向けの場合は同意・景品・個人情報の追加gateを設ける。
- 不正利用、取消、重複利用、時刻改ざんを監査可能にする。

## 10. Billing independence

ドメインモデルは外部のbilling providerや有料plan名へ依存させない。

- `paid_tier`等をProgram権限の前提にしない。
- TaxonInventory、ProfessionalReport、PromotionalPublication、CouponCampaignの契約・受注状態と、公開・Review・privacy権限を分離する。
- billing failureでcanonical dataや原記録を削除・非公開化しない。
- 課金設定は別承認境界とする。

## 11. Source implementation order

実装する場合の順序は次とする。

1. audit current report, species-list, aggregation, export, and regional View surfaces
2. pure domain types for RawRecordPortabilityArchive and TaxonInventory
3. boundary tests between free operational summary and paid biodiversity-derived outputs
4. free standard page / paid custom publication classification tests
5. rights and consent gate
6. sponsor and advertisement display contract
7. CouponCampaign state machine without payment
8. audit log and abuse tests
9. reporting contract
10. billing adapter only after separate approval

## 12. Required fixtures

- operational_summary_does_not_include_species_count
- raw_record_archive_preserves_record_granularity
- raw_record_archive_does_not_emit_taxon_inventory
- provisional_site_species_list_is_paid_derived_output
- taxon_inventory_screen_and_export_share_same_boundary
- individual_record_is_free_without_complete_site_inventory
- non_exhaustive_discovery_cards_are_clearly_labeled
- standard_event_page_is_free
- custom_campaign_publication_is_paid_output
- public_record_without_commercial_rights_is_rejected
- sponsor_does_not_change_canonical_ranking
- coupon_user_access_is_free
- issuer_manages_coupon_campaign
- expired_coupon_cannot_redeem
- duplicate_redemption_is_audited
- cancelled_paid_contract_preserves_canonical_and_source_records
- professional_report_references_source_records_inventory_and_revision

## 13. Approval boundary

This contract does not approve:

- source implementation
- database or migration
- production or staging release
- billing provider or price
- payment or settlement
- DNS, secret, permission changes
- external publication

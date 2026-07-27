# ZUKAN Promotional Outputs and Coupons Contract

- Date: 2026-07-27
- Status: accepted strategy contract / source not implemented
- Parent issue: #1463
- Strategy source: `yamaki0102/ikimon-business-strategy@04183ce28ac196f656d3ff904f6bcf0f37cae602`
- Related free core: `docs/spec/programs/ZUKAN_FREE_ORGANIZATIONAL_CORE_CONTRACT.md`

## 1. Purpose

ZUKANの標準利用を無料で維持しながら、特定組織の提出・集客・販促へ追加価値を作る有償領域を実装上分離する。

有償商品は次の3系統を基本とする。

1. 専門・保証付きレポート
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
- basic reports and export
- normal regional View publication
- correction and objection routes

有料契約が終了しても、無料コア、自組織データ、基本エクスポート、訂正経路へのアクセスを失わせない。

## 3. Paid output types

### 3.1 ProfessionalReport

自然共生サイト報告、種リスト、モニタリング報告等、人が確認・編集し、提出物として品質や説明責任を負う成果物。

最低属性候補:

- `reportId`
- `reportType`
- `commissioningAgentId`
- `subjectPlaceIds`
- `coveredProgramIds`
- `observationPeriod`
- `sourceRecordIds`
- `reviewScope`
- `reviewerAgentIds`
- `generatedAt`
- `approvedAt`
- `version`
- `deliveryState`
- `disclaimer`

標準集計・CSVはProfessionalReportではない。

### 3.2 PromotionalPublication

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

### 3.3 CouponCampaign

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

## 4. Knowledge and commerce separation

ProfessionalReport、PromotionalPublication、CouponCampaignは、canonical Place、Record、Assertion、Reviewを所有・上書きしない。

- 販促物が引用するcanonical dataは参照として保持する。
- 有料顧客の要望でcanonical facts、Review結果、確認状態を変更しない。
- 有料状態を検索順位、地域View掲載可否、同定確度、Review権限へ使わない。
- 販促物から得た新情報を正本へ戻す場合も通常のEvidence・Reviewを通す。
- sponsor、advertisement、coupon、official、editorialを表示上区別する。

## 5. Rights and consent gate

ZUKAN上で閲覧可能であることと、商用利用可能であることを同一視しない。

PromotionalPublicationへRecord等を採用する前に、少なくとも次を判定する。

- copyright / license
- contributor consent
- portrait and personal data
- minor consent
- commercial reuse permission
- location sensitivity
- rare species safety
- organization-specific confidentiality
- attribution requirement
- modification permission

判定不能の場合は自動採用しない。公開データであっても商用利用権が確認できない素材は除外または個別確認とする。

## 6. Page boundary

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

## 7. Coupon trust boundary

- 利用者のclaim / redeemは無料とする。
- 発行者側の発行・管理・分析を有償対象にできる。
- 発行者、条件、期限、対象、利用方法を明示する。
- coupon statusをPlaceの品質・公式性・人気度へ変換しない。
- couponを理由にRecord投稿、Review承認、個人情報提供を強制しない。
- 未成年向けの場合は同意・景品・個人情報の追加gateを設ける。
- 不正利用、取消、重複利用、時刻改ざんを監査可能にする。

## 8. Billing independence

ドメインモデルは外部のbilling providerや有料plan名へ依存させない。

- `paid_tier`等をProgram権限の前提にしない。
- ProfessionalReport、PromotionalPublication、CouponCampaignの契約・受注状態と、公開・Review・privacy権限を分離する。
- billing failureでcanonical dataを削除・非公開化しない。
- 課金設定は別承認境界とする。

## 9. Source implementation order

実装する場合の順序は次とする。

1. pure domain types and tests
2. free standard page / paid custom publication classification tests
3. commercial-use rights gate
4. sponsor and advertisement display contract
5. CouponCampaign state machine without payment
6. audit log and abuse tests
7. reporting contract
8. billing adapter only after separate approval

## 10. Required fixtures

- standard_event_page_is_free
- custom_campaign_publication_is_paid_output
- public_record_without_commercial_rights_is_rejected
- sponsor_does_not_change_canonical_ranking
- coupon_user_access_is_free
- issuer_manages_coupon_campaign
- expired_coupon_cannot_redeem
- duplicate_redemption_is_audited
- cancelled_paid_contract_preserves_canonical_data
- professional_report_references_source_records_and_revision

## 11. Approval boundary

This contract does not approve:

- source implementation
- database or migration
- production or staging release
- billing provider or price
- payment or settlement
- DNS, secret, permission changes
- external publication

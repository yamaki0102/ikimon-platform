# IKIMON Monitoring Commercial Readiness Gap Review

Date: 2026-05-24
Scope: `platform_v2` / branch `codex/ikimon-monitoring-business-flow`
Status: deploy-blocking review document

Production scope note:

- This review blocked deploying the earlier full application/admin/invoice prototype as the commercial operating flow.
- The current production-safe scope is intentionally narrower: a public "providing preparation / early consultation" page that sends leads through the existing contact pipeline.
- Contract formation, billing, partner compensation, and provisioning remain out of this release.

## Executive Decision

Do not treat the earlier full application/admin/invoice prototype as production-ready commercial operation.

That implementation is useful as a first application and admin prototype, but it is still centered on `application_id`. The commercial model decided in the grill requires a contract-centered operating system:

```text
application
  -> contract_offer
  -> customer acceptance
  -> admin final approval
  -> contract
  -> contract_term
  -> invoice / payment / provisioning / partner compensation / outputs
```

Until this model exists, deploying the current branch as the commercial flow would create avoidable ambiguity around contract formation, billing, partner commissions, renewal, output responsibility, and workspace access.

## Evidence Inspected

Earlier full-flow prototype evidence inspected:

- `platform_v2/db/migrations/0116_monitoring_business_flow.sql`
- `platform_v2/src/services/monitoringBusiness.ts`
- `platform_v2/src/routes/monitoringBusiness.ts`
- `platform_v2/src/routes/sampleReport.ts`
- `platform_v2/src/siteMap.ts`
- `platform_v2/src/app.ts`

Existing product capability evidence:

- `platform_v2/src/routes/read.ts`
- `platform_v2/src/routes/write.ts`
- `platform_v2/src/routes/mapApi.ts`
- `platform_v2/src/routes/guideApi.ts`
- `platform_v2/src/routes/fieldscanApi.ts`
- `platform_v2/src/routes/observationFieldsApi.ts`
- `platform_v2/src/routes/observationEventApi.ts`
- `platform_v2/src/routes/observationEventPages.ts`
- `platform_v2/src/routes/researchApi.ts`
- `platform_v2/src/routes/adminSiteEvidence.ts`
- `platform_v2/src/services/monitoringRecordContract.ts`
- `platform_v2/src/services/monitoringReadiness.ts`
- `platform_v2/src/services/siteEvidenceReport.ts`
- `platform_v2/src/services/sensitiveSpeciesMasking.ts`
- `platform_v2/src/services/researchExport.ts`

Verification already run after the latest implementation work:

- `npm --prefix platform_v2 run typecheck`
- `npm --prefix platform_v2 run test:node -- monitoringBusiness`

Both passed at the time of review, but passing tests do not prove commercial readiness because the test scope does not cover the decided contract-centered operating model.

## Product Decisions Locked

### Product and Pricing

- Product name: IKIMON Monitoring.
- Standard price: JPY 1,000,000 per year.
- Regional development price: JPY 500,000 per year.
- Regional development price is a candidate at application time and requires IKIMON admin approval before contract.
- The same service is provided at the regional development price. This is not "Lite".
- Customers must be told before contract that regional development pricing can move to standard pricing when the region's operating base grows.

### Contract Formation

- Application and email confirmation are not contract formation.
- Contract formation requires:
  - customer acceptance of finalized terms,
  - IKIMON admin final approval,
  - contract acceptance email and invoice PDF sent by IKIMON.
- A `contract_offer` is required between application and contract.
- The offer must expire after 14 days.
- Any change to price, tax, target area, support scope, partner access, renewal, cancellation, or output responsibility invalidates the old offer and requires reacceptance.

### Billing and Payment

- Invoice sending is admin-triggered, not automatic on application.
- Invoice belongs to contract/contract term, not application.
- Payment confirmation can be manual initially.
- Payment ledger must record invoice number, amount, due date, paid date, payment memo, and operator.
- Usage starts after payment confirmation by default.
- Early activation before payment is allowed only with admin exception approval and audit log.

### Provisioning

- Contract approval creates a provisioning draft.
- Activation happens after payment confirmation or early activation approval.
- Provisioning must cover organization account, initial admin invite, workspace/target area, partner role, and start email.

### Partner Program

- Partner program is invite/screening based.
- Public page can explain the program and collect inquiries, but code issuance requires IKIMON approval.
- Partner screening must check regional accompaniment ability, operational continuity, privacy/location-data literacy, responsibility-boundary understanding, and ability to explain non-guaranteed outcomes.
- Partner certification renews yearly.
- Each project requires IKIMON approval.
- Partner access to customer workspace requires explicit customer consent at contract offer acceptance.
- Partner role is limited to viewing, commenting, progress notes, and partner supplement suggestions. It cannot delete data, manage billing/contracts, manage permissions, or approve official species lists.

### Partner Compensation

- First year: 20% of first-year actual received amount.
- Second year onward: 10% continuing accompaniment compensation if:
  - customer renews,
  - payment is confirmed,
  - partner remains active/certified,
  - customer or IKIMON confirms continuing accompaniment.
- Payment timing: end of the month following the month in which compensation becomes finalized.
- Follow-up partner attribution can be unlimited in time, but compensation requires:
  - applicant/customer email confirmation,
  - IKIMON admin approval,
  - reason memo,
  - stakeholder notification,
  - 14-day objection period.

### Standard Output and Analytics

- Customer can generate IKIMON Monitoring standard outputs by selecting period, target area, and purpose.
- These are formal system outputs, not IKIMON's individually reviewed official opinion.
- External submission/sharing is allowed.
- No guarantee is made for grant acceptance, certification, TNFD completion, expert identification equivalence, or rare species discovery.
- Outputs must separate:
  - confirmed records,
  - candidate records,
  - insufficient-evidence candidates,
  - effort metrics,
  - next monitoring suggestions.
- Official indicators/species list calculations must use confirmed records only.
- Important/rare species candidates are "additional confirmation needed", not discoveries.
- PDF/CSV output must include purpose, period, target area, certainty class, warning text, masking/coarsening state, and audit log ID.

### Location and Privacy

- Internal workspace can use detailed locations when the viewer is authorized.
- External-output mode must automatically coarsen or hide sensitive species, important species, private residences, schools/child-related sites, private land, customer-hidden sites, and other sensitive places.
- Coarsening override requires customer admin request, reason, responsibility confirmation, and IKIMON admin approval or explicit customer responsibility confirmation.

## Current Implementation Summary

### Implemented or Partially Implemented

- Public application page: `/for-business/monitoring/apply`.
- Application email confirmation.
- Monitoring application table.
- Partner table.
- Partner code at application time.
- Follow-up partner attribution request and applicant confirmation.
- Admin application list at `/admin/monitoring-contracts`.
- Basic status/billing/price/regional status editing.
- Basic KGI cards.
- Application CSV export.
- Partner admin create/update.
- Invoice table and PDF generation prototype.
- Invoice PDF admin view and send action prototype.
- Monitoring application route registration in `app.ts`.
- Sample report CTA to Monitoring application page.

### Existing Adjacent Product Capabilities

These are not yet connected to IKIMON Monitoring contracts, but they are valuable foundations:

- Record creation and detail pages.
- Photo/video/audio/media handling.
- Guide flow and guide record outcomes.
- FieldScan/audio ingestion.
- Public map and area map APIs.
- Field registry and field details.
- Place snapshot and site evidence report.
- Observation events and event recap.
- Monitoring record contract/readiness concepts.
- Research export and QA report.
- Sensitive species masking.

## Critical Gaps

### G1. Contract Model Is Missing

Current schema has `monitoring_contract_applications`, but no:

- `monitoring_contract_offers`
- `monitoring_contracts`
- `monitoring_contract_terms`
- `monitoring_workspaces`
- `monitoring_provisioning_tasks`

Impact:

- Application can be mistaken for contract.
- Contract-term renewal cannot be modeled safely.
- Multiple target areas per organization will be hard.
- Contract condition snapshots are not preserved.
- Invoice generation currently attaches to application instead of contract term.

### G2. Contract Offer Acceptance Is Missing

There is no customer-facing finalized-condition acceptance flow.

Missing:

- 14-day offer URL.
- offer snapshot.
- customer acceptor email verification.
- name, department, role, IP, UA, accepted-at.
- automatic invalidation on condition change.
- admin final approval after customer acceptance.

Impact:

- The application acknowledgements are too early and too generic.
- Regional price, partner access, target area, renewal, and cancellation are not reaccepted after admin review.

### G3. Billing Is Prematurely Connected to Application

The current invoice prototype can generate/send an invoice for an application.

Impact:

- It bypasses the decided contract offer acceptance model.
- Invoice does not belong to a contract term.
- Payment ledger is missing.
- Contract acceptance email and invoice are not a single transaction.
- It can create the appearance of billing before contract formation.

### G4. Payment and Provisioning Are Missing

Missing:

- payment status ledger,
- payment confirmation operator/date/memo,
- early activation exception approval,
- organization account provisioning draft,
- workspace creation,
- initial admin invite,
- partner limited-role grant,
- start email state.

Impact:

- "Contracted" cannot reliably answer whether a customer can start using the service.
- Partner access cannot be safely granted based on customer consent.

### G5. Partner Compensation Workflow Is Incomplete

Current partner logic supports code and attribution, but not compensation lifecycle.

Missing:

- first-year 20% actual-received compensation,
- year-two-and-after 10% continuing accompaniment compensation,
- continuing accompaniment confirmation,
- objection period,
- stakeholder notification,
- compensation finalization,
- payment batch/month.

Impact:

- Partner disputes and accounting ambiguity remain.

### G6. Workspace Connection Is Missing

Existing record, map, guide, field, event, and report features are not tied to an IKIMON Monitoring contract/workspace.

Impact:

- Commercial customer cannot reliably see "their" monitoring area.
- Partner cannot be limited to their assigned customer/area.
- Standard outputs cannot guarantee period/area/purpose boundaries.

### G7. Standard Output Product Is Missing

Existing site evidence and research export are strong foundations, but the decided standard output is not implemented as a commercial customer feature.

Missing:

- customer-facing period/area/purpose selection,
- output audit log,
- output purpose-specific caveats,
- PDF/CSV commercial template,
- partner supplement acceptance,
- standard output wording that avoids "IKIMON official reviewed opinion",
- output-level masking/coarsening log.

Impact:

- The key value of "analytics-like, output when needed" is not yet productized.

### G8. Feature-Level Commercial UX Is Not Ready

Existing features are broad but not yet assembled into a repeatable Monitoring workflow.

Minimum commercial experience by feature:

| Feature | Minimum commercial experience |
|---|---|
| Record/post screen | User can record into the correct contract workspace/target area with photo/video/audio/text/location/effort. Failure recovery is clear. |
| Record detail | Shows confirmed/candidate/insufficient-evidence state, basis, review status, public/export readiness, and masking status. |
| Guide flow | Helps non-experts collect useful monitoring records, not just one-off observations. Effort/no-detection/next-action data survives. |
| FieldScan | Fast field capture with later workspace organization. Low-connectivity behavior must not lose records. |
| Area map | Shows contract target area, density, gaps, effort, seasonality, candidates, masking state, and next monitoring needs. |
| Field detail | Shows place history, revisit reasons, missing data, stewardship/activity hints, and partner-useful notes. |
| Event/observation meeting | Records from group activities become contract workspace data with participant/event context. |
| Customer workspace | Makes organization, target area, members, partner access, output authority, and support route obvious. |
| Partner workspace | Shows assigned customers, next accompaniment actions, data gaps, supplement comments, renewal/accompaniment confirmation. |
| Standard output | Lets users choose purpose/period/area and export PDF/CSV with mandatory caveats, classes, masking state, and audit ID. |
| Admin operations | Shows next human action queue: offer issue, customer acceptance wait, final approval, payment wait, provisioning, partner compensation, output exceptions. |

## P0 Backlog

### P0-1. Contract-Centered Schema

Add:

- `monitoring_contract_offers`
- `monitoring_contract_offer_acceptances`
- `monitoring_contracts`
- `monitoring_contract_terms`
- `monitoring_contract_events`
- `monitoring_workspaces`
- `monitoring_workspace_members`

Acceptance:

- Application cannot become contract directly.
- Contract term can represent initial year and renewal years.
- Multiple contracts for the same organization are possible.
- Contract offer snapshot can reproduce what customer accepted.

### P0-2. Contract Offer Flow

Implement:

- admin offer draft/edit,
- issue URL,
- 14-day expiry,
- customer email verification,
- customer acceptance form,
- old-offer invalidation on any condition change,
- admin final approval.

Acceptance:

- A changed offer cannot be approved without new customer acceptance.
- Acceptance captures name, department, role, email, IP, UA, timestamp, and snapshot version.

### P0-3. Contract Approval and Invoice Transaction

Implement one admin action:

```text
approve offer -> create contract + term -> generate invoice -> send contract acceptance email + invoice PDF
```

Acceptance:

- Invoice belongs to `contract_term_id`.
- Contract acceptance email contains terms summary, partner access, support boundary, renewal/cancellation, and start flow.
- Invoice cannot be sent for application-only state.

### P0-4. Payment Ledger

Add:

- invoice due date,
- paid amount,
- paid date,
- payment confirmation actor,
- payment memo,
- payment status history.

Acceptance:

- Paid state cannot be set without amount/date/operator.
- Partial/refund/cancel state can be represented or explicitly rejected.

### P0-5. Provisioning Ledger

Add provisioning draft and activation:

- organization account,
- workspace/target area,
- initial admin invite,
- partner role grant,
- start email,
- failure state/retry.

Acceptance:

- Activation requires payment confirmed or early activation exception.
- Early activation requires reason, approver, timestamp, expected payment date.

### P0-6. Workspace Binding for Existing Features

Connect existing record/map/guide/field/event/report surfaces to `monitoring_workspace_id`.

Acceptance:

- Customer sees only their contract workspace data.
- Partner sees only workspaces approved by customer and IKIMON.
- New records can be attached to target workspace/area.
- Existing records can be assigned/imported with audit log.

### P0-7. Standard Output v1

Implement:

- purpose selection,
- period selection,
- target area selection,
- PDF output,
- CSV output,
- output audit log,
- certainty classes,
- mandatory non-guarantee wording,
- masking/coarsening state,
- audit log ID in file.

Acceptance:

- Output cannot be generated without purpose/period/area.
- Confirmed indicators use confirmed records only.
- Candidate and insufficient-evidence sections are visually and structurally separate.
- CSV contains purpose, generated-at, audit ID, certainty class, and masking state.

### P0-8. Partner Compensation Ledger

Implement:

- first-year 20%,
- continuing accompaniment 10%,
- actual-received amount base,
- objection period,
- stakeholder notification,
- accompaniment confirmation,
- payment month.

Acceptance:

- Compensation cannot finalize before payment confirmation and objection-period completion.
- Year-two compensation requires active partner and accompaniment confirmation.

### P0-9. Admin Operations Queue

Replace "table only" admin with action queues:

- offer issue needed,
- customer acceptance waiting,
- final approval needed,
- payment confirmation waiting,
- provisioning activation waiting,
- partner attribution/objection waiting,
- continuing accompaniment confirmation needed,
- output masking exception waiting.

Acceptance:

- Each queue item has one next recommended action.
- External-impact actions require two-step confirmation.
- Each action writes before/after diff and reason/audit log.

## P1 Backlog

- Partner portal for assigned workspaces, data gaps, supplement comments, and renewal accompaniment confirmation.
- Customer workspace dashboard for monitoring readiness, data gaps, recent records, and outputs.
- Event-to-workspace import flow.
- FieldScan offline/low-connectivity hardening for Monitoring contracts.
- Standard output purpose-specific templates:
  - internal review,
  - government submission,
  - grant,
  - certification/TNFD,
  - community sharing,
  - press/public relations.
- Output case-study collection:
  - submitted material,
  - result,
  - use context,
  - public-use consent.
- Renewal notification 60 days before term end.
- Regional development price reapproval and standard-price migration workflow.

## P2 Backlog

- Bank/accounting SaaS reconciliation.
- LTV/churn/cohort analytics.
- Optional IKIMON-reviewed report contract.
- Advanced partner quality scoring.
- Automated partner payout file generation.

## Deploy Readiness Decision

### Current Branch

Not ready for production deployment as the commercial IKIMON Monitoring flow.

It can be deployed only if explicitly labeled as:

- internal prototype,
- non-contractual application intake,
- no invoice sending in production,
- no partner compensation finalization,
- no customer workspace provisioning.

### Minimum Production Gate

Before production commercial launch, complete at least:

1. `contract_offer -> contract -> contract_term` model.
2. Customer offer acceptance and admin final approval.
3. Invoice sending attached to contract term.
4. Payment ledger.
5. Provisioning ledger.
6. Workspace binding for existing record/map/output features.
7. Standard output audit log and mandatory caveats.
8. Partner compensation ledger.
9. Admin action queue with audit logs.

## Current Implementation Reuse Guidance

Keep and refactor:

- application form copy,
- acknowledgement copy,
- partner code input,
- applicant email confirmation,
- partner follow-up attribution candidate,
- admin dashboard prototype,
- invoice PDF renderer as a low-level utility.

Do not keep as final commercial model:

- invoice attached to `application_id`,
- application status pretending to be contract status,
- single application CSV as the main commercial ledger,
- direct invoice send before contract offer acceptance,
- partner commission forecast without compensation lifecycle,
- admin table as the primary operations surface.

## Recommended Next Implementation Order

1. Freeze current `monitoringBusiness` branch as prototype.
2. Add new migrations for contract-centered schema instead of stretching `monitoring_contract_applications`.
3. Refactor services around offer/contract/term.
4. Move invoice functions from application input to contract-term input.
5. Add workspace binding.
6. Build standard output v1 using existing `siteEvidenceReport`, `monitoringRecordContract`, `monitoringReadiness`, `researchExport`, and `sensitiveSpeciesMasking`.
7. Rebuild admin as operations queue.

## One-Line Summary

The current work proves the business intake direction, but commercial launch requires turning existing ikimon.life features into a contract-bound monitoring workspace with offer acceptance, output auditability, controlled partner access, payment/provisioning state, and standard outputs that are safe to submit externally.

# ZUKAN Semantic Lens Integration Profile v1

Status: ADOPTED DESIGN / CANONICAL ON MERGE / NOT RUNTIME EVIDENCE
Date: 2026-09-19 JST
Owner / acting_as: IKIMON / IKIMON
Design owner: Noah
Implementation executor: LUNA or another authorized lane
Baseline source: `yamaki0102/ikimon-platform@d41928d6a8a5c7fc12fa059251eec997d5ad293e`

## 0. Purpose

ZUKAN may consume bounded semantic Lens projections to improve discovery, review preparation and publication composition without changing ZUKAN's canonical Record / Source / Evidence / Claim / Rights / Review / Publication semantics.

This profile intentionally does **not** put a general Jev runtime or NOCOSIL memory store inside ZUKAN.

NOCOSIL owns reusable private work, Lens definitions and semantic-evaluation capability where appropriate.
ZUKAN owns its public/regional product state and all domain authority.

## 1. Product boundary

Keep these ZUKAN responsibilities authoritative:

- Record;
- Source / Evidence;
- Claim / ClaimRevision;
- Place / Entity;
- Rights / consent / safe precision;
- Review / Verification;
- Publication / PublicationEdition;
- Program / Event / Quest;
- external writeback and effect evidence.

A semantic Lens output is always a **candidate projection**.

It cannot:

- confirm a taxon, person, place or specialist diagnosis;
- establish rights or consent;
- change location precision;
- replace specialist Review;
- accept/reject a Claim;
- publish;
- create a Case automatically;
- claim scientific, ecological or social impact.

## 2. Lens uses that are allowed

### 2.1 Expert Review preparation

Goal:
reduce the expert's reading burden without pretending the model is the expert.

Inputs:
- authorized Record/Claim/Evidence excerpts;
- adopted Domain Pack criteria;
- expert Lens only when rights and attribution permit.

Outputs:
- likely relevant evidence;
- possible contradiction;
- missing evidence candidate;
- questions worth reviewing;
- similar prior reviewed cases/criteria refs.

If an Expert Lens is inferred from prior material, label it `inferred_from_sources`.
Do not say "the expert says" unless the expert actually said/approved it.

### 2.2 Research / Evidence Lens

Use public or authorized research/official material to evaluate whether a proposed explanatory statement is:

- supported;
- contradicted;
- insufficient;
- unrelated;
- potentially outside the study/population/time scope.

Statistical calculation and applicability metadata are established before the semantic evaluation.

The Lens output does not convert a paper into a canonical ZUKAN Claim.

### 2.3 Regional discovery

After deterministic rights, safe precision, place/time and publication eligibility filters, a semantic profile may rerank already-eligible public Records/Programs for a declared visitor purpose.

Examples:

- 子どもと今日見に行ける地域の記録;
- この場所の歴史を知る入口;
- 季節の変化が分かる記録.

Semantic ranking never makes an otherwise non-public item public.

### 2.4 Program / Event content preparation

For organizer-side work, prefer NOCOSIL.

ZUKAN may consume prepared, rights-safe candidate projections for:

- event description relevance;
- duplicated information;
- missing practical details;
- related public Records/Places;
- evidence/source links.

Do not create a second organizer dashboard or content-management system in ZUKAN.

### 2.5 Publication composition

For a PublicationEdition draft, a Lens may identify:

- content that serves the publication purpose;
- redundant sections;
- source/evidence gaps;
- conflicting claims;
- audience-fit candidates.

Human/publisher Review and existing publication authority remain required.

## 3. Candidate contract

Conceptual contract only; map to existing ZUKAN objects where possible.

```ts
interface ZukanSemanticProjectionRef {
  schema: "zukan.semantic-projection-ref/v1";
  subjectKind: "record" | "claim" | "publication_draft" | "program";
  subjectId: string;
  subjectRevision: string;
  profileId: string;
  profileVersion: string;
  lensRef: string;
  projectionDigest: string;
  generatedAt: string;
  provenanceRefs: readonly string[];
  state: "candidate" | "stale" | "unavailable";
  canonicalClaimAuthorized: false;
  reviewAuthorized: false;
  publicationAuthorized: false;
}
```

Do not persist raw private NOCOSIL Lens content merely to keep this reference.

## 4. Cross-product boundary

NOCOSIL and ZUKAN keep separate stores and Security Domains.

Allowed interaction:

1. caller proves current authorized scope;
2. select minimum ZUKAN subject projection;
3. retrieve only Lens/source excerpts allowed for the declared purpose;
4. evaluate;
5. return bounded semantic result/provenance refs;
6. ZUKAN stores only the minimum candidate/ref needed by its current object model, if persistence is useful.

Do not:

- mirror NOCOSIL Current State into ZUKAN;
- mirror ZUKAN canonical Records into NOCOSIL as mutable copies;
- transfer private source text merely because the same person belongs to both products;
- create a giant cross-product semantic DB.

## 5. Privacy and public surface

Public content may be evaluated only when its current rights allow the intended provider transmission.

Private/precise/sensitive material follows the current ZUKAN media/data-rights policy and provider-transmission policy.

A public Record is not automatically consent for:
- homepage promotion;
- external model transmission;
- external syndication;
- derived expert-profile training.

Do not expose a Lens title/source if that existence itself is private.

## 6. Expert Lens attribution

Three states:

`expert_approved`
- expert explicitly approved the Lens/version.

`inferred_from_sources`
- model/system derived criteria from authorized source material;
- show as an inference, not the expert's statement.

`domain_pack`
- criteria belong to an adopted ZUKAN Domain Pack or official review protocol, not one person's view.

Never merge these labels.

## 7. First ZUKAN slice

Do not start until the NOCOSIL Semantic Lens Runtime core is verified reusable.

Recommended first profile:
`zukan.review-prep/v1`

Journey:

1. open a staging Record/Claim already eligible for expert Review;
2. deterministic rights/scope check;
3. retrieve relevant Evidence and adopted Domain Pack criteria;
4. semantic projection returns:
   - evidence relevance;
   - contradiction candidate;
   - missing-evidence candidate;
   - review questions;
5. UI shows a compact "確認の補助" area;
6. expert can ignore/open source/adopt an actual Review using existing Review semantics;
7. model output itself never changes Claim/Review;
8. reload preserves canonical state and candidate provenance correctly.

Use staging/synthetic or an explicitly authorized real case; do not create dummy production Records.

## 8. Evaluation

For review preparation, measure:

- expert-agreed useful candidate precision;
- important evidence/contradiction recall;
- review time;
- source-opening/retrace success;
- false confidence/authority confusion incidents = 0.

For discovery, measure:

- eligible-set preservation = 100%;
- usefulness against declared visitor intent;
- no rights/precision leakage.

Do not use generic Jev benchmark numbers as ZUKAN evidence.

## 9. Failure behavior

Evaluator unavailable/malformed/timeout:

- normal Record/Place/Program/Review experience remains usable;
- no canonical mutation;
- no publication change;
- candidate area becomes unavailable or disappears truthfully;
- no false "0 issues" state.

## 10. Implementation sequence

1. fresh ZUKAN Work/source/runtime;
2. verify NOCOSIL semantic-evaluator contract is stable and reusable;
3. bind a minimal adapter at the product boundary;
4. RED focused Review-prep tests;
5. staging fixture;
6. real authorized expert-review journey if available;
7. measurement;
8. decide keep-shadow / expose;
9. only then consider regional discovery/publication profiles.

Do not introduce Jev routing/Warden concepts into ZUKAN.

## 11. Done

The first slice is DONE only when:

- no new canonical truth store exists;
- Review authority is unchanged;
- provider failure cannot affect Record/Claim/Publication truth;
- source/provenance can be opened from every surfaced candidate;
- staging runtime exact source is verified;
- representative measurement exists;
- current Evidence/Resume records what is still unverified.


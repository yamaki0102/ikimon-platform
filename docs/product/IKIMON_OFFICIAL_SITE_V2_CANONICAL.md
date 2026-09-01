# IKIMON Official Site V2 Canonical

Status: `ACTIVE / CANONICAL`
Effective: 2026-09-01 JST
Scope: `ikimon.co.jp` company official site

## 1. Product goal

`ikimon.co.jp` is the official company surface of IKIMON株式会社. It is not a duplicate landing page for ZUKAN.

The site must let a first-time visitor understand within roughly 30 seconds:

1. what IKIMON is;
2. what IKIMON builds and does;
3. why IKIMON is credible;
4. how municipalities, companies, schools, communities, researchers, and partners can work with IKIMON;
5. where to continue into the appropriate product or inquiry path.

Primary outcome:

> Understand IKIMON -> see a relevant product/project/evidence -> take the next action without confusion.

## 2. Authority and boundaries

- IKIMON株式会社 = legal / operating entity.
- IKIMON = company brand.
- `ikimon.co.jp` = company official site.
- ZUKAN = IKIMON-operated product; its product meaning, capability, UI, safety, publication policy, and current state remain authoritative in the current ZUKAN Product Registry / product canonical.
- The company site may explain and route to ZUKAN, but must not fork or independently redefine the ZUKAN product experience.
- Other products, services, programs, and capabilities may appear only when supported by current canonical source or current evidence.
- Historical names, old plans, stale status copy, and superseded offerings are not current truth merely because they remain in production or old documents.

When this document conflicts with a newer product-specific canonical on product behavior, the product-specific canonical wins for that product. This document owns only the company-site experience and presentation.

## 3. Experience principles

1. Concrete before abstract: show what IKIMON does before long philosophy copy.
2. Evidence before claims: real projects, real people, real places, real UI, and verified results outrank generic capability statements.
3. Company before product detail: the official site explains IKIMON; product detail lives on the product surface.
4. Audience clarity: visitors should quickly identify a relevant path for municipality, company, school, community/event, research/PoC, media, or other inquiry.
5. One clear next action per section; avoid repeated generic `お問い合わせ` CTAs.
6. No internal implementation jargon in public UI unless the audience genuinely needs it.
7. No unsupported numbers, customer claims, partnerships, capabilities, awards, or status statements.
8. Japanese and English must describe the same current company and products; English is not allowed to remain a stale mirror.

## 4. Information architecture

Keep the route set as small as practical. Reuse and strengthen existing routes before adding thin pages.

### Home

Required narrative order:

1. Hero — clear company proposition and primary action.
2. What IKIMON does — short, concrete company explanation.
3. Products — ZUKAN first when supported by current company/product truth; other current products only if publication-ready.
4. Work with IKIMON — municipality / company / school / community or event / research and PoC paths as applicable.
5. Projects / Cases — selected real work with evidence.
6. Impact / Trust — verified awards, partnerships, activity, outcomes, or public evidence.
7. Company / People — enough human and corporate context to establish trust.
8. News — current activity only.
9. Contextual contact CTA.

Mission / vision / philosophy may remain, but must not dominate the first-view or substitute for concrete explanation.

### Product / ZUKAN

The company-site product page should answer only:

- what the product is;
- who it is for;
- what current use cases it supports;
- what makes it credible / safe;
- where the real product experience is.

Use current product copy, real current UI where available, and current evidence. Do not invent company-site-only features or duplicate the full product landing experience.

### Solutions / Collaboration

Organize around visitor problems and engagement modes rather than vague DX categories.

Each important audience path should make clear:

- typical problem or objective;
- what IKIMON can actually contribute;
- example project / evidence where available;
- expected engagement shape;
- one relevant CTA.

### Projects / Cases

Prefer evidence-backed case studies to generic capability cards.

A case may include only verified fields:

- context / partner type;
- challenge;
- IKIMON contribution;
- result or current status;
- evidence / related product;
- next action.

Do not manufacture outcomes to make a case look complete.

### Impact

Use verified activity, awards, collaboration, nature-positive / biodiversity, education, research, or community evidence. Separate fact from aspiration.

### Company / People

Keep corporate facts current. Founder / member profiles should support company trust and relevance; remove stale titles, excessive personal trivia, and old positioning that conflicts with current company direction.

### Contact

The contact experience should reduce decision cost. Use contextual entry points such as municipality, company, school, community/event, ZUKAN, research/PoC, media, AI/Web/DX consultation, or other only where those categories reflect current scope.

## 5. Content standard

Audit every public route for:

- stale or superseded product names;
- stale `開発中`, release, beta, or availability statements;
- unsupported capabilities and results;
- duplicated or contradictory copy;
- abstract / generic / AI-sounding prose;
- internal terminology;
- unnecessary English in Japanese UI;
- long text walls;
- placeholder or sample material that may be mistaken for real evidence;
- outdated people / company information.

Preferred copy pattern:

> concrete fact -> user relevance -> evidence -> next action

## 6. Visual and interaction standard

Preserve useful current brand assets; do not redesign for novelty.

Prefer:

- real people;
- real locations;
- real projects;
- real biodiversity / field activity;
- real current product UI;
- restrained supporting illustration only when it cannot be mistaken for evidence.

Avoid generic SaaS composition, excessive gradients, decorative AI imagery, repetitive card grids, and identical section treatments across every route.

Every major page needs page-specific hierarchy while sharing one header, footer, typography system, spacing system, CTA treatment, and responsive behavior.

Minimum responsive QA widths: `375`, `768`, `1280`, `1440` px.

## 7. Japanese / English

JA and EN are one product surface.

They must remain aligned for:

- company identity;
- product naming;
- navigation;
- key claims;
- CTA destinations;
- company facts;
- contact;
- legal / metadata.

English should read naturally for a visitor unfamiliar with Hamamatsu or IKIMON. Public PHP warnings, stack traces, debug output, or internal error details are P0 defects.

## 8. Trust, SEO, accessibility, performance

All public routes must be checked for the applicable items:

- title / meta description;
- canonical / hreflang;
- OGP / share preview;
- structured data;
- sitemap / robots;
- link and redirect integrity;
- 404 behavior;
- forms and spam protection;
- privacy / legal links;
- security headers;
- keyboard / focus / contrast / touch targets;
- reduced motion;
- responsive overflow;
- image sizing / loading;
- Core Web Vitals or equivalent practical performance checks;
- browser console and server/runtime error exposure;
- analytics behavior where currently authorized.

HTTP 200 alone is not proof of a good route.

## 9. Delivery order

### P0 — Truth and defects

Fix first:

- broken routes / forms / navigation;
- runtime warnings or errors;
- stale product / company naming;
- unsupported or contradictory claims;
- severe JA/EN mismatch;
- incorrect redirects / canonical links;
- public debug leakage.

### P1 — Comprehension and conversion

Strengthen:

- Home;
- product / ZUKAN explanation and routing;
- audience-specific collaboration / solutions;
- Projects / Cases;
- Company / People;
- Contact.

### P2 — Visual quality

Polish all material routes for page-specific hierarchy, real assets, typography, spacing, responsive behavior, and mobile usability.

### P3 — Quality closure

Close JA/EN parity, SEO, accessibility, performance, all-route browser QA, and release evidence.

## 10. Verification and release

Staging is the default implementation and QA surface.

Minimum representative journeys:

1. landing -> understand IKIMON -> understand relevant product/project -> evidence -> contact;
2. landing -> ZUKAN explanation -> actual ZUKAN destination;
3. JA <-> EN navigation for the same core information.

Minimum final checks:

- all material routes smoke-tested;
- `375` and `1280` visual QA for all material templates / routes;
- navigation and external destinations;
- forms;
- console / runtime errors;
- overflow;
- JA / EN parity;
- SEO / metadata;
- accessibility basics;
- exact source / staging identity when the runtime supports it;
- rollback readiness before production mutation.

Do not declare completion from source-only success.

Target terminal states:

- `STAGING_LIVE_VERIFIED` — exact intended source is live on staging and required browser journeys / checks pass.
- `PRODUCTION_LIVE_VERIFIED` — the authorized production release is live and the required production read-back / journeys pass.

Production mutation follows the current authority boundary; this document does not grant new production authority.

## 11. Definition of done

IKIMON Official Site V2 is complete only when:

1. current public content reflects current company and product truth;
2. company / product roles are not confused;
3. Home and major subpages have clear visitor-specific next actions;
4. meaningful projects / evidence are visible where publishable;
5. major routes are visually coherent and mobile-usable;
6. JA / EN no longer materially diverge;
7. P0 public defects are zero;
8. required staging journeys and quality checks pass on the intended exact source;
9. remaining production-only boundary, if any, is explicit rather than hidden in implementation work.

## 12. Executor rule

Executors must fresh-read this file at material Work start and use it as the company-site meaning canonical.

Do not redesign the product strategy from chat history. Do not turn old production content into truth. When implementation reveals a genuine product decision or a conflict with newer canonical evidence, preserve the evidence and escalate the decision instead of inventing one.

Small reversible source, UI, copy, test, and staging changes should continue autonomously within current authority until the next real protected boundary.

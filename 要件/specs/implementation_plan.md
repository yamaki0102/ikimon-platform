# implementation_plan.md

# Nature Symbiosis Platform Development Plan

This plan outlines the development of the "ikimon" Citizen Participation Biological Observation Service.
**Core Principle**: "Human-Centric Identification". We prioritize a robust expert ecosystem over immature AI identification. AI is used solely for input assistance (metadata, quality checks).

## User Review Required
> [!IMPORTANT]
> **AI Policy**: AI Species Identification is **EXCLUDED** from Phase 1.
> AI will only be used for:
> 1.  Metadata extraction (Exif date/location)
> 2.  Image quality assessment (Blurry/Darkness detection)
> 3.  Broad categorization (e.g., "Is this a bird or a bug?") *only if high confidence*.

> [!WARNING]
> **Hosting Constraint**: All backend logic must be compatible with **Onamae.com RS Plan** (Standard PHP/Apache environment). No Node.js server processes.

## Proposed Changes

### Phase 1: Foundation & Entry (Week 1-2)
Goal: Release the "Explore" and "Story" experiences.

#### [FRONTEND] Core UI Structure
- [NEW] `public_html/index.php`: Top page with 3-door entry (Explore, Support, Data).
- [NEW] `public_html/assets/css/input.css`: Tailwind setup with "Nature Positive" palette.
- [NEW] `public_html/components/nav.php`: Global navigation with unified search bar.

#### [FRONTEND] Map Experience
- [NEW] `public_html/explore.php`: Main map interface.
- [NEW] `public_html/js/map_engine.js`: Leaflet/Mapbox integration with clustering.
- [NEW] `public_html/data/dummy_observations.json`: Initial mock data for development.

### Phase 2: Post & Identification (Week 3-4)
Goal: Enable data submission and the "Identification Center".

#### [BACKEND] Submission System
- [NEW] `public_html/api/submit_observation.php`: Handle photo upload & JSON storage.
- [NEW] `public_html/js/post_flow.js`: "Instant Camera" UI logic with PWA support.
- [NEW] `includes/ImageHandler.php`: Client-side resize & Server-side compression logic.

#### [FRONTEND] Identification Center (The "1000-Knock")
- [NEW] `public_html/id_center.php`: The "Specialist Mode" optimized for speed.
- [NEW] `public_html/components/id_card.php`: "Card" component for rapid decision making (Agree / Suggest / Skip).
- [NEW] `public_html/js/id_center.js`: Keyboard shortcuts and swipe logic for speed.

### Phase 3: Dashboard & Scoring (Week 5)
Goal: Visualize value for Municipalities and Corporate sponsors.

#### [FRONTEND] Analysis Dashboard
- [NEW] `public_html/dashboard.php`: Analytics view.
- [NEW] `public_html/js/charts.js`: Chart.js visualizations for Species Counts, etc.
- [NEW] `includes/ScoringEngine.php`: Logic to calculate "Biodiversity Score" (Beta) based on JSON data.

### Phase 4: Polish & Launch (Week 6)
Goal: Mobile optimization (Gate T) and Security.

#### [QUALITY] Quality Assurance
- [ ] **Mobile Audit**: Verify "Gate T" (Text Area Width > 300px) on all pages.
- [ ] **Performance**: Ensure Lighthouse score > 90.
- [ ] **Security**: Implement rate limiting and WAF checks compatible with RS Plan.

## Verification Plan

### Automated Tests
- **PWA Capabilities**: Verify offline fallback and install prompt.
- **Image Compression**: Upload 10MB test image, verify server storage < 500KB.

### Manual Verification
- **"1000-Knock" Test**: Can a user process 10 identification requests in < 60 seconds?
- **Mobile Field Test**: Go to a park, take a photo, and upload it within 30 seconds on 4G network.

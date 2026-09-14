# External Frontend Source Registry

Status values: `APPROVED` = preferred source for bounded reuse; `REFERENCE_ONLY` = inspect for ideas but do not make it a default dependency; `REJECTED_DEFAULT` = do not introduce as another design system without a product-specific decision.

| Source | Status | Primary use |
| --- | --- | --- |
| transitions.dev | APPROVED | portable motion patterns and motion-token calibration |
| shadcn/ui | APPROVED | component/state/API reference and source-registry model |
| Base UI | APPROVED | accessible headless primitive reference for future React surfaces |
| React Aria | APPROVED | accessibility, internationalisation and interaction reference |
| Radix UI | APPROVED | established primitive behavior reference |
| Motion | APPROVED | complex layout/shared-element/gesture motion when native CSS is insufficient |
| 21st.dev | APPROVED | discovery of source-owned component patterns; review each candidate |
| MDN Web Docs | APPROVED | browser-native capability and accessibility baseline |
| WAI-ARIA APG | APPROVED | keyboard/ARIA interaction contracts |
| Open UI | APPROVED | emerging native component semantics research |
| Kokonut UI | REFERENCE_ONLY | specialised AI/product surface patterns |
| Aceternity UI | REFERENCE_ONLY | marketing/visual motion patterns |
| Cult UI | REFERENCE_ONLY | interaction ideas |
| Magic UI | REFERENCE_ONLY | marketing/motion ideas |
| Origin UI | REFERENCE_ONLY | shadcn-compatible variants |
| ReUI | REFERENCE_ONLY | broad shadcn-compatible patterns |
| Ark UI | REFERENCE_ONLY | headless state-machine component reference |
| Park UI | REFERENCE_ONLY | styled Ark UI reference |
| Headless UI | REFERENCE_ONLY | lightweight accessible primitive reference |
| Floating UI | REFERENCE_ONLY | positioning/collision behavior reference |
| Ariakit | REFERENCE_ONLY | accessible headless interaction reference |
| Zag.js | REFERENCE_ONLY | state-machine interaction reference |
| React Spectrum | REFERENCE_ONLY | enterprise accessibility/system reference |
| HeroUI | REFERENCE_ONLY | modern React component benchmark |
| Mantine | REFERENCE_ONLY | broad component/API benchmark |
| Material UI | REJECTED_DEFAULT | separate styled system; benchmark only unless explicitly selected |
| Ant Design | REJECTED_DEFAULT | separate enterprise design system |
| Chakra UI | REJECTED_DEFAULT | separate token/component system |
| PrimeReact | REJECTED_DEFAULT | separate broad component system |
| Blueprint | REJECTED_DEFAULT | separate desktop-heavy component system |
| Semantic UI React | REJECTED_DEFAULT | legacy-styled system; no default adoption |
| Bootstrap | REJECTED_DEFAULT | separate visual/component system for current product surfaces |
| Flowbite | REFERENCE_ONLY | Tailwind component benchmark |
| DaisyUI | REFERENCE_ONLY | token/theme benchmark, not a default runtime layer |
| Preline | REFERENCE_ONLY | utility-based interaction examples |
| Tremor | REFERENCE_ONLY | dashboard/data-display patterns |
| Tailwind Plus | REFERENCE_ONLY | composition/layout reference where license permits |
| Uiverse | REFERENCE_ONLY | microinteraction inspiration; candidate quality varies |
| HyperUI | REFERENCE_ONLY | lightweight Tailwind pattern reference |
| Shoelace/Web Awesome | REFERENCE_ONLY | web-component/native-like behavior benchmark |
| Adobe Spectrum 2 | REFERENCE_ONLY | mature design-system/accessibility benchmark |

## Selection rules

1. Existing project source wins over importing another library.
2. Prefer native platform capability before a package.
3. Accessible behavior is more valuable than copied visual styling.
4. Do not introduce two competing token, focus, portal or primitive systems into one product surface without a concrete requirement.
5. Copy/adapt only the minimum needed source; record material license/provenance.
6. Motion snippets should converge on foundation tokens rather than preserve arbitrary source timings.
7. A source can be downgraded if maintenance, licensing or accessibility evidence changes.

## 2026 screening notes

The ecosystem increasingly separates primitives, composed source-owned components and registries. shadcn supports multiple primitive bases, with Base UI the current default for new projects and React Aria available as a first-class base. This reinforces a progressive-adoption strategy instead of framework migration.

Transitions.dev is particularly suitable for the current TypeScript/server-rendered surfaces because its patterns are available as portable CSS as well as React examples; no React migration is required to reuse the motion language.

Motion remains an exception tool for problems such as layout/shared-element transitions and gestures rather than the default for fades, pressed states or simple enter/exit effects.

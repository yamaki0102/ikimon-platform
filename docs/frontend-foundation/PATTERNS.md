# Frontend Foundation Patterns v1

These are interaction contracts, not brand components. Product themes may change visual expression while preserving behavior.

| Pattern | Required behavior | Avoid |
| --- | --- | --- |
| Action | clear focus, >=44px target, pressed state | hover-only affordance |
| Async action | immediate pending state, duplicate-submit guard, terminal feedback | silent waiting |
| Loading | preserve layout where practical; identify active work | full-screen spinner for small actions |
| Success | concise confirmation near the completed action | celebratory motion for routine saves |
| Error | explain recoverable next action; preserve user input | generic failure without recovery |
| Empty | explain why empty and expose the next useful action | decorative dead ends |
| Toast | transient non-blocking status; important actions remain in page state | critical decisions only in toast |
| Modal | focus management, explicit close, escape behavior when safe | nested modal chains |
| Sheet | mobile-friendly secondary task surface | using sheet for primary navigation by default |
| Dropdown | keyboard-operable choices and visible current state | hidden destructive action |
| Tabs | preserve one conceptual object with alternate views | tabs for unrelated destinations |
| Search | visible query state, empty and error distinction | clearing query on recoverable error |
| Validation | field-near feedback plus summary when multiple errors matter | color-only errors |
| Skeleton | approximate final geometry and stop after content resolves | indefinite shimmer |
| Confirmation | proportional to consequence; destructive choices explicit | confirmation for harmless reversible actions |

## Motion contract

Use the shared token scale before introducing a new duration/easing pair.

- fast: micro interaction;
- normal: ordinary UI transition;
- slow: larger surface entrance/exit;
- reduced motion: remove spatial animation and preserve state clarity.

Motion is functional when it communicates continuity, state change, hierarchy or causality. Pure decoration should not delay task completion.

## External pattern adoption

External examples are candidates, not dependencies. Adapt useful behavior into project-owned source and existing tokens. Preserve source/license notes when copied code is material.

## Promotion rule

A one-off visual treatment stays local. Promote it into the foundation only after repeated use proves that sharing reduces drift or implementation cost.

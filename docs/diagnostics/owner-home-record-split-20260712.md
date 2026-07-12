# Owner home July record split diagnosis — 2026-07-12

## Conclusion

The July 10 and July 7 cards currently rendered as `名前待ちのメモ` are note-only observation rows and do not contain image assets.

Separate photo observation rows exist on the same dates:

- 2026-07-10: one photo asset
- 2026-07-07: three photo assets

All four original R2 objects and all four public derivative objects exist. The photo observation owner matches the known authenticated account. The two note-only observation owners do not match that account.

Therefore the remaining defect is not image loss. It is a split-record / owner-feed selection problem: note-only rows are being presented as `自分の記録`, while the authenticated account's photo rows are not appearing in the expected position.

## Safety

- Read-only production diagnosis
- No raw user IDs, observation IDs, email addresses, or object keys recorded
- No production data mutation

## Required fix

1. Do not label a card as `自分の記録` unless its owner resolves to the authenticated account or an explicitly approved account alias.
2. Ensure authenticated photo rows are included in the owner feed and sorted correctly.
3. Add a regression fixture with same-date note and photo rows under different owner identities.
4. Keep Issue #1247 open until Android confirms the July photos are visible.

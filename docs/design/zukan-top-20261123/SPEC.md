# ZUKAN top page — decided spec (Hakari, 2026-11-23). Supersedes waiting for a Muse final.

Owner asked 2026-11-23 「ZUKANのログイン前とログイン後のトップページはいつ改善反映されるんじゃ」. Do not wait for another design. Implement this. Tasks: task_fb9e2604 (logged-out), task_a6f6407a (main surfaces).

## Rules (all screens)
- Familiar nav kept: mobile bottom tabs ライブラリ(logged-in)/ホーム(logged-out) ・イベント・撮る(orange, center)・場所・自分. Desktop: left sidebar, 撮る button on top.
- On-screen text = names, dates, places, short action labels only. No slogans, taglines, greetings, explanatory or encouraging sentences, no 「AI」 badges.
- White #ffffff background, sections #f6f7f6, green #245c3a accents/links, orange #b94f18 only for 撮る. Noto Sans JP, min text 14px, targets 44px, WCAG AA.
- Photos are the hero. No mascot, no badges/levels/streaks/counters, no dark navy+cyan.
- Display speed: first paint from fast data; measure LCP on each ship (target p75 ≤ 2.5s mobile).
- Location protection (task_61028fd9) applies: no exact coordinates anywhere; event/place names only.

## Logged-in top = photo library (see top-mobile-loggedin-390-v2.png, top-desktop-loggedin-1440-v2.png)
1. Top bar: ZUKAN logo, one search field (placeholder 「祭り・川・去年の秋で探す」), avatar.
2. 「1年前のこの場所」: two photos of the same place, one year apart, labels 「YYYY年M月」, place name. Hide the block when no pair exists (no empty card).
3. Library grid (3 cols mobile / 6 cols desktop, square thumbs), grouped by day + event/place: header 「11月22日（土）・みなと通り 朝市」.
   - Group not on the regional book: outline button 「図鑑に載せる」 + share icon.
   - Group already on it: green chip 「図鑑に掲載中」 instead of the button.
   - Photos taken at an event join that event's shared album automatically (no step).
4. 「図鑑に載せる」 opens a small popover: title 「<place>の図鑑に載せる」, row of the group's thumbnails with checkboxes (all on), 「載せる」 primary, 「やめる」 text. No explanation sentences. Faces are blurred automatically before publishing; reversible later from the same chip.
5. Empty library (new user): never an empty box. Show, in this order: the 撮る button row, then 「近くの場所」 = public place pages near the viewer's coarse area (or the most recently recorded places) as large photo cards, then 「最近の記録」 = latest public records grid. No onboarding prose.

## Logged-out top
1. Top bar: ZUKAN logo, 「ログイン」 text button.
2. Hero = the owner's own photos (owner approved: 「まっきーの写真はトップに使ってよい」). Use 4–5 landscape/scenery photos from the owner account's public records (no other people's faces, no private places, no children). Each photo labeled 「<place>・<M月D日>」 and links to its place page. Pick server-side (latest public, face-check passed), cache it.
3. Under the hero: two buttons — primary 「ウェイティングリストに登録」 (→ /<lang>/waitlist; open sign-up is closed) and outline 「近くのイベントを見る」.
4. No headline sentence. If a heading is needed for accessibility, use the visually hidden h1 「ZUKAN」.
5. 「近くのイベント」: 3 rows — date, event title, organizer, chevron → event page.
6. 「場所」 strip: up to 6 public place pages with one photo each (links to /places/plc_…).
7. Same bottom tabs, 「ホーム」 active.

## Zero events is the normal case (owner 2026-11-23: 「最初はイベントがないことがほとんどだから0件だったときも、さみしくならないような設計にしてね」)
- No screen may show an empty list, an empty card, or a 「0件」/「まだありません」 message as its main content. Each block has a fallback that always has real content.
- Fallback order for any event block (logged-out top, イベント tab, place page): (1) upcoming events → (2) past events' takeaway scenery 「<event>・<M月D日>」 as photo cards → (3) recent public records at nearby / recently active places → (4) the owner's public photos. Always at least one of these exists.
- The block heading follows what is shown: 「近くのイベント」 only when (1) exists; otherwise 「最近の記録」 or 「場所」. Never show a heading over nothing.
- Under the fallback, one small action: logged-in 「イベントを開く」 (creates an event via NOCOSIL handoff), logged-out 「ウェイティングリストに登録」. No prose.
- 「1年前のこの場所」 falls back to 「この場所の今」 (latest photo of the user's most-recorded place), then hides.
- Test with an empty-events fixture: logged-out top, logged-in top (empty and non-empty library), イベント tab, place page — each shows photos and no empty-state message.

## Done when (production, not PR/tests)
- Logged-out zukan.earth/ja: owner photos render with place/date labels, waitlist button works, no slogan text, no faces (face sweep 0), LCP measured.
- Logged-in /ja: library grouped by day/event, 「図鑑に載せる」 popover publishes selected photos and the chip flips to 「図鑑に掲載中」; unpublish works.
- With zero upcoming events in production, the logged-out top, イベント tab and an empty-library account still show photo content (no empty-state message).
- 390/768/1440 screenshots attached to the task; console errors 0.
- Write paths enforce: logged-out 401, other user's photos 403 (standing rule #11).

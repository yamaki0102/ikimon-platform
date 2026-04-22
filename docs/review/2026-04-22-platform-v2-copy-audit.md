# 2026-04-22 platform_v2 Copy Audit

監査タグ:
- `抽象`
- `広告臭`
- `AI臭`
- `内部語`
- `英語混在`
- `説明不足`
- `過圧縮`
- `過説明`
- `prod参考あり`

## content / short

| file | area | status | tags | action |
| --- | --- | --- | --- | --- |
| `platform_v2/src/content/short/ja/shared.json` | public shell | 要改稿 | 抽象, AI臭 | brand / footer / AI 説明を具体化 |
| `platform_v2/src/content/short/ja/public.json` | public / trust / business | 要改稿 | 抽象, 英語混在, 過圧縮, prod参考あり | hero, marketing lead, contact, business 系を全面修正 |
| `platform_v2/src/content/short/ja/specialist.json` | specialist | 要改稿 | 英語混在, 内部語 | hero と action を日本語化 |
| `platform_v2/src/content/short/ja/ops.json` | ops | 要改稿 | 英語混在, 内部語 | QA site map を日本語化 |

## content / longform

| file group | area | status | tags | action |
| --- | --- | --- | --- | --- |
| `about.md`, `faq.md`, `learn-*.md` | public learn | 要再整理 | 過圧縮, prod参考あり | 理由・線引き・次の一歩を明示 |
| `privacy.md`, `terms.md`, `contact.md` | trust | 要改稿 | 説明不足 | 取扱い範囲と窓口を増やす |
| `for-business*.md` | business | 要改稿 | 過圧縮, prod参考あり | 無料範囲 / 相談範囲 / 準備事項を明記 |

## routes

| file | area | status | tags | action |
| --- | --- | --- | --- | --- |
| `platform_v2/src/routes/marketing.ts` | public | 概ね content 化済み | - | content 変更に追随 |
| `platform_v2/src/routes/read.ts` | public + specialist/admin | 要改稿 | 英語混在, 内部語 | specialist/admin の見出し、フォーム、状態文を日本語化 |

## ui

| file | area | status | tags | action |
| --- | --- | --- | --- | --- |
| `platform_v2/src/ui/communityMeter.ts` | public | 要改稿 | AI臭 | 効果表現を具体化 |
| `platform_v2/src/ui/fieldNoteMain.ts` | public | 要改稿 | 抽象 | lead と hypothesis 見出しを具体化 |
| `platform_v2/src/ui/todayHabit.ts` | public | 要改稿 | AI臭, 詩的 | 習慣文言を plain にする |
| `platform_v2/src/ui/guideFlow.ts` | public | 要改稿 | AI臭 | subtitle と UI 文言を実機能ベースにする |
| `platform_v2/src/ui/mapExplorer.ts` | public | 部分改稿 | 抽象, AI臭 | side brief / search error / revisit label を具体化 |
| `platform_v2/src/ui/mentorStrip.ts` | public | 要改稿 | 詩的 | 専門確認の位置づけを plain にする |
| `platform_v2/src/ui/officialNoticeCard.ts` | public | 要改稿 | 英語混在 | eyebrow を日本語化 |
| `platform_v2/src/ui/revisitFlow.ts` | public | 要改稿 | 詩的 | 再訪理由を plain にする |

## 監査結論

- production から拾うべきもの
  - FAQ の問いの立て方
  - contact の用途別整理
  - business の無料範囲の説明責任
  - about の原体験の具体性
- production から持ち込まないもの
  - AI 過剰訴求
  - 旧 pricing / old plan 言語
  - 広げすぎたテーマ設計
  - 詩的 lead

# 2026-04-22 Human Web Writing and AI-Smell Synthesis

目的:
- `platform_v2` の日本語コピーを、`人が現場で書いたように読める` 基準へ寄せる
- そのために `clear writing` と `AIっぽく感じる症状` を分けて整理する

## 採用結論

- まず plain language を採用する
- 次に people-first を採用する
- その上で、AI 検出ごっこではなく、`抽象化 / 均一化 / 責任回避 / 具体性不足` を減らす

## Source Notes

### 1. GOV.UK Writing for GOV.UK

- claim: タイトルと要約は、ユーザーが自分向けのページかをすぐ判定できるものにする。本文は concise だが terse ではなく、具体で user-focused に書く
- mechanism: 見出しと summary が検索結果・一覧・1画面目の判断材料になる。曖昧語や buzzword を減らすと理解速度が上がる
- applies_when: public page、guide、legal summary、UI label
- fails_when: 説明が必要なページまで summary だけで終わらせると情報不足になる
- evidence grade: E4
- source: [GOV.UK Writing for GOV.UK](https://www.gov.uk/guidance/content-design/writing-for-gov-uk)

### 2. GOV.UK Writing for User Interfaces

- claim: UI copy は短く直接的にし、ユーザーの言葉を使い、認知負荷を減らす
- mechanism: 忙しい人ほど長いラベルや曖昧な操作語を嫌う。even specialist users prefer clear language
- applies_when: CTA、フォームラベル、状態文、業務UI
- fails_when: 短くすること自体が目的になり、必要な説明まで消す
- evidence grade: E4
- source: [GOV.UK Writing for user interfaces](https://www.gov.uk/service-manual/design/writing-for-user-interfaces)

### 3. Digital.gov Plain Language

- claim: 読者が最初に読んだ時点で分かることを優先し、jargon と ambiguity を減らす
- mechanism: plain language は low literacy や limited English だけでなく、全員の理解コストを下げる
- applies_when: public page、help、trust page、ops guide
- fails_when: 具体的な条件や例外まで削ってしまうと誤読が増える
- evidence grade: E4
- source: [Digital.gov Plain Language Guide](https://digital.gov/guides/plain-language), [An introduction to plain language](https://digital.gov/resources/an-introduction-to-plain-language)

### 4. Microsoft Style Guide

- claim: simple verbs, one clear meaning, consistent term choice, unnecessary modifiers の削除が効く
- mechanism: 曖昧な動詞や修飾語を減らすと、文章が `賢そう` ではなく `分かる` 方向へ寄る
- applies_when: product copy、フォーム、error message、status message
- fails_when: blunt すぎて文脈や配慮が消える
- evidence grade: E4
- source: [Microsoft Style Guide — Use simple words, concise sentences](https://learn.microsoft.com/en-us/style-guide/word-choice/use-simple-words-concise-sentences)

### 5. Google Search Helpful, Reliable, People-First Content

- claim: people-first content は、検索のための word count や keyword wrapper ではなく、読者の問いに答える original で useful な内容にする
- mechanism: 目的に対して十分な説明があり、誰かの実体験や独自整理があるページは、SEO-first の薄い量産文より役に立つ
- applies_when: about、faq、learn、business guide
- fails_when: キーワード回収のためにテーマを広げすぎると、焦点がぼける
- evidence grade: E4
- source: [Google Search — Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)

### 6. Decision Intelligence OS: 日本語UIの情報密度

- claim: 日本語UIは `減らす` より `整流する`。情報不足は trust を下げるので、見出し、要約、比較で流れを作る
- mechanism: 日本語は長文化しやすいが、階層と改行で scanability を作れる
- applies_when: 日本語 longform、high involvement page、business / trust / ops
- fails_when: 入口面まで同じ密度を持ち込むと重い
- evidence grade: E3
- source: `C:/Users/YAMAKI/.codex/knowledge/decision_intelligence_os/artifacts/notes/japanese_ui_density_and_readability.md`

### 7. AI-generated text detection research

- claim: 人も検出器も、AI 生成文と人間文を安定的に切り分けにくくなっている。したがって `AIっぽさを隠す小手先` より、具体性と責任境界を持った文章に寄せる方が有効
- mechanism: 分布差が縮んでおり、`誤字を混ぜる` `表記を崩す` などの擬似人間化は本質解ではない
- applies_when: AI臭さ対策の方針決定
- fails_when: detector evasion を目的にすると、読者体験より回避テクニックが優先される
- evidence grade: E2-E3
- source:
  - [MAGE: Machine-generated Text Detection in the Wild](https://arxiv.org/abs/2305.13242)
  - [Human intelligence can safeguard against artificial intelligence](https://www.nature.com/articles/s41598-024-76218-y)

## 採用条件

- ページ冒頭で役割が分かる
- 同じ概念を同じ語で呼ぶ
- 具体例が早い
- AI の限界を隠さない
- 必要な説明は削りすぎない

## 不採用条件

- かっこよさだけの lead
- 対句で整えた見出し
- 誰でも書ける generic な前向き文
- SEO 用の総花説明
- AI を主役にする copy

## 実務ルールへの変換

- `短くする` は目的ではなく手段
- `人間らしく見せる` のではなく `人間が責任を持って書いた内容` にする
- `AI臭さ対策` は detector 回避ではなく、`抽象名詞だけの文` `空疎な褒め言葉` `説明のない前向き断定` を消すこと

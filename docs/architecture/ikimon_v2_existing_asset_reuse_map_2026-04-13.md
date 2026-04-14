# ikimon v2 Existing Asset Reuse Map

更新日: 2026-04-13

## 0. 目的

既存の `ikimon.life` 資産を無駄にせず、v2 の新 sitemap にどう再配置するかを固定する。  
原則は `全部作り直す` ではなく、**中身は活かし、役割と置き場所を整理する**。

---

## 1. 分類ルール

### A. Keep and polish

- 役割が今後も同じ
- v2 の visual / IA に寄せればそのまま活きる

### B. Move under Learn

- content marketing / explanatory / SEO 資産
- 初回導線の主役ではないが、理解を深める面として重要

### C. Move under Role lane

- specialist / admin / review / corporate utility
- public main nav の主役ではない

### D. Merge / summarize

- 単独ページでなく cluster landing にまとめる方が良い

---

## 2. 既存 public_html の再配置方針

### 2.1 Core observer flow

Keep and polish:

- `index.php`
- `explore.php`
- `post.php`
- `observation_detail.php`
- `profile.php`
- `dashboard.php`
- `species.php`

方針:

- v2 の `Top / Explore / Record / Detail / Home / Profile` に吸収
- `species.php` は encyclopedia 的に扱わず、観察導線から見える補助面にする

### 2.2 Learn cluster

Move under Learn:

- `about.php`
- `faq.php`
- `updates.php`
- `guides.php`
- `guidelines.php`
- `methodology.php`
- `for-citizen.php`
- `for-researcher.php`
- `android-app.php`

方針:

- `Learn` landing を作り、その下に再編
- About/FAQ は top nav の直リンクから外してもよい
- `for-citizen` / `for-researcher` は audience split の再利用素材として使う

### 2.3 Place / field / program surfaces

Keep selectively:

- `field_scan.php`
- `fieldscan.php`
- `bioscan.php`
- `ikimon_walk.php`
- `walk.php`
- `compass.php`
- `biodiversity_map.php`
- `livemap.php`
- `compare.php`
- `zukan.php`

方針:

- すべてを top nav に出さない
- 将来的に `Explore` 配下、または `Learn / local route` 配下へ寄せる
- field mentor / local nature / revisit を強める素材として利用

### 2.4 Business / institutional

Keep and polish:

- `for-business.php`
- `pricing.php`
- `contact.php`
- `csr_showcase.php`
- `showcase.php`
- `showcase_embed.php`
- `wellness.php`

方針:

- `for-business` cluster に統合
- `showcase` や `csr` は business proof / case として再利用
- `contact` は trust/support と business entry の接点として維持

### 2.5 Specialist / formal ID

Move under Role lane:

- `id_workbench.php`
- `id_center.php`
- `needs_id.php`
- `review_queue.php`
- `id_form.php`
- `id_wizard.php`

方針:

- `observer + AI suggestion` とは分ける
- role-based lane として visibility を制御
- public main nav の主役にしない

### 2.6 Trust / legal

Keep:

- `privacy.php`
- `terms.php`
- `contact.php`

方針:

- footer / trust cluster の固定資産として使う

---

## 3. すでに価値がある既存要素

### About

価値:

- ikimon の思想、地域性、社会的意味をかなり厚く持っている
- 単なる会社紹介ではなく、content asset として強い

再利用:

- `Learn > About ikimon`
- `Top` の lower section への要約流用

### FAQ

価値:

- friction 解消と trust に効く
- content / SEO / support の兼用資産

再利用:

- `Learn > FAQ`
- `For Business` から必要項目だけ要約リンク

### Guides / Methodology

価値:

- mentor 的な説明資産に転換しやすい
- AI suggestion と expert lane の違い説明にも使える

再利用:

- `Learn > Identification basics`
- `Learn > Methodology`

### Updates

価値:

- 運営の動きと継続感を作る
- SEO と信頼形成に寄与する

再利用:

- `Learn > Updates`

---

## 4. いまの v2 で先にやること

1. `Learn` landing を作る
2. shared shell の nav を `Home / Explore / Record / Learn / For Business` に変える
3. `About / FAQ` を Learn cluster の面として見せる
4. Specialist は utility / role lane として下げる
5. 既存 `guides / methodology / updates` を v2 Learn 配下へ移す順番を決める

---

## 5. 捨てないもの

- 既存の translated copy
- About の長文思想
- FAQ の friction 解消
- for-business の B2B 導線
- specialist の運用知見
- field / local nature の素材

---

## 6. 次の進化

この reuse map に沿って、v2 に `Learn` cluster を実装し、header を新 sitemap へ切り替える。

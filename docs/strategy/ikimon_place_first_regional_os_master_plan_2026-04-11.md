# ikimon.life Place-First Regional OS Master Plan

更新日: 2026-04-11

この文書は次を supersede する。

- `docs/strategy/ikimon_btobtoc_field_mentor_redesign_2026-04-11.md`
- `docs/strategy/ikimon_btobtoc_execution_plan_2026-04-11.md`

---

## 0. 結論

ikimon.life は、次のように再定義する。

- 表の定義: `今日は何がいた?` から始まる place-first nature app
- 背骨の定義: `この場所はどう変わった?` に答える Long-term Nature Observatory
- 事業の定義: `旅行者 / 地元 / 関係人口 / 地域事業者 / 企業 / 自治体` をつなぐ Regional OS
- 売り方: `BtoBtoC + BtoG + place-based regional business`

一言で言うと、`観察アプリ` ではなく `場所を起点に、人・データ・再訪・地域経済をつなぐOS` にする。

---

## 1. 何が前の計画で足りなかったか

前の BtoBtoC 計画で足りなかったのは次の 4 点。

- `企業が買う / 個人が使う` までは切れていたが、`地域が育つ` が弱かった
- place を中心変数に据えていなかった
- 観光庁、文化庁、地方創生2.0 の `関係人口 / 新結合 / 再訪 / 深い理解` に十分接続できていなかった
- 偶発的な観光記録と、地元の定点観測を同じ設計で束ねていなかった

つまり、今までの計画は `プロダクト計画` としては一定の筋があったが、`地域OS計画` としては不十分だった。

---

## 2. なぜ今この形か

### 2.1 地方創生2.0との整合

- 地方創生2.0 は `新結合`, `関係人口`, `人や企業の地方分散`, `広域リージョン連携` を前面に出している
- 基本構想の施策集は `1年 / 3年 / 5年` の工程表と KPI を明示して積み上げることを求めている

ikimon は、自然観察を単独の趣味にせず、`観光`, `教育`, `企業研修`, `地域実装`, `文化解釈`, `再訪` をつなぐ `新結合` の器にできる。

### 2.2 観光庁との整合

- `第2のふるさとづくり` は、地域との交流や参画を通じて継続来訪と経済効果を生むことを狙っている
- `地域観光新発見事業` は、コンテンツ造成だけでなくマーケティングデータを活かした磨き上げ、販路開拓、情報発信の一貫支援を求めている
- 令和8年度の `質的価値の維持向上事業` は、品質の見える化、効果検証、中長期戦略を求めている

ikimon は、`旅先の偶発的な1枚` を `再訪の理由` と `地域側の観測資産` に変えられる。

### 2.3 文化庁との整合

- 文化観光は、歴史・芸術・伝統・暮らしに根ざした文化資源の価値を `正しく理解し、深く味わうこと` を目的としている

ikimon が自然だけを切り出すと弱い。`自然 x 暮らし x 食 x 仕事 x 記憶` の place interpretation にすると強い。

### 2.4 心理学との整合

- 入口は `今日 / ここ / 自分`
- 継続は `今季 / 去年の今ごろ / 過去の自分`
- ミッションは `この場所は10年でどう変わった?`

遠い使命だけでは動かない。だが、近い行動を長い意味に橋渡しすれば継続できる。

---

## 3. プロダクトの中心命題

ikimon の中心命題は次の 3 行に固定する。

1. `人は場所との関係を持つことで動く`
2. `地域は再訪と関係人口で強くなる`
3. `100年後に効くのは、同じ場所を見続けた記録である`

---

## 4. Actor Tree

### 4.1 Traveler

- 旅先や外出先で偶発的に撮る人
- 価値: `旅が少し深くなる`

### 4.2 Local Steward

- 地元で定点的に見続ける人
- 価値: `自分の場所を見守れる`

### 4.3 Relationship Population

- 何度も通う人、応援する人、二拠点的につながる人
- 価値: `また来る理由ができる`

### 4.4 Regional Curator

- ガイド、観光協会、地域事業者、博物館・学芸員、学校、NPO
- 価値: `自然と文化を束ねて物語れる`

### 4.5 Sponsor

- 企業、学校、施設運営者
- 価値: `拠点を支える文化と証拠基盤を持てる`

### 4.6 Municipality / Research Partner

- 自治体、地域協議会、研究者
- 価値: `場所単位の長期変化と事業効果を読める`

---

## 5. Value Loop

### Loop 1. Traveler Capture

- 旅先で1枚撮る
- その場所の自然・文化・季節の意味が返る
- `また別の季節に来たい` が生まれる

### Loop 2. Place Follow

- 気に入った場所をフォローする
- 季節変化、次の見どころ、イベント、食、文化導線が返る
- 偶発来訪が関係人口化する

### Loop 3. Local Stewardship

- 地元の人が同じ場所を見続ける
- 在来 / 外来 / 群集 / site condition の変化が読める
- 偶発記録と定点記録が補完し合う

### Loop 4. Regional Program

- 地域側が `観察 -> 学習 -> 食 -> 対話 -> 再訪 -> 参加` を設計する
- 単発観光でなく repeatable regional loop にする

### Loop 5. Sponsor / Enterprise

- 企業や学校が place stewardship を支える
- wellness は副次便益
- 主価値は `拠点の文化形成`, `自然共生活動`, `説明責任`, `地域接点`

---

## 6. Product Stack

### Layer A. Public Entry

- `index.php`
- `components/nav.php`
- `about.php`

役割:

- `今日は何がいた?`
- `近くの場所を見守ろう`
- `旅先でも1枚残せる`

### Layer B. Capture

- `post.php`
- `field_research.php`
- `bioblitz_join.php`

役割:

- quick incidental capture
- place walk
- event / tourism participation

### Layer C. Place Memory

- `explore.php`
- `profile.php`
- `dashboard.php`
- `wellness.php` の縮退再定義

役割:

- 自分の場所
- 季節比較
- 去年比較
- follow / revisit の誘発

### Layer D. Place Workspace

- `site_dashboard.php`
- `fieldscan.php`
- `century_archive.php`

役割:

- place 単位の蓄積
- 長期変化の読解
- 高密度センサー記録の受け皿

### Layer E. Regional / Sponsor

- `for-business/index.php`
- `corporate_dashboard.php`
- `dashboard_municipality.php`
- `csr_showcase.php`
- `generate_grant_report.php`

役割:

- sponsor explanation
- regional operator workspace
- municipality / grant / program outputs

### Layer F. Support / Archive

- `for-citizen.php`
- `for-researcher.php`
- `methodology.php`
- `guides.php`

役割:

- support info
- deeper evidence
- archive of specialized explanation

---

## 7. 核となる設計原則

### 7.1 Place first

- 主語は species でなく place
- species は place change を読むための一要素

### 7.2 Visit first

- 基本単位は post でなく visit
- 1 visit に `what / when / where / how / condition / confidence` をぶら下げる

### 7.3 Incidental + Structured

- traveler の偶発記録を捨てない
- ただし local steward の定点記録と同じ重みで扱わない
- `incidental`, `follow-up`, `fixed-point`, `high-density scan` を分ける

### 7.4 Interpretation over raw listing

- 場所の自然だけでなく、文化、歴史、食、暮らし、仕事との接続を返す
- 文化庁文脈では `正しく理解し、深く味わう`

### 7.5 Sponsor is backstage

- 企業導線は裏方
- 個人の autonomy を壊さない
- team support は ambient

### 7.6 Long-term beats vanity

- species_count, likes, ranking を北極星にしない
- repeat place coverage, seasonality coverage, revisit continuity を重視する

---

## 8. 何を捨てるか

- `自然観察SNS` の自己目的化
- `健康アプリ` の前面化
- `AIで何でも当てる` という物語
- `企業導入LP` を公開トップの主役にすること
- 種名だけの収集主義
- 単発イベントで地方創生を名乗ること

---

## 9. North Star と KPI

## 9.1 North Star

`四半期内に、同じ place で再訪記録が成立した active places 数`

理由:

- 個人継続
- place continuity
- 地域再訪
- sponsor explanation

を同時に見やすい。

## 9.2 Public / Product

- home -> capture start
- first visit completion
- place follow rate
- 30日以内 revisit rate
- same-season revisit rate

## 9.3 Regional

- repeat visitor rate
- relationship population conversion
- program conversion
- local partner count
- local spend proxy

## 9.4 Observatory

- effort completion
- confidence capture
- site condition logging
- seasonality coverage
- fixed-point continuity

## 9.5 Sponsor / Government

- active sponsored places
- member participation spread
- site-level continuity
- report / grant output usage

---

## 10. いま本当にやるべき一手

最初の一手は `Home を直すこと` ではない。
**`place model を正本にすること`** だ。

そのうえで順番はこうする。

1. public message を place-first に変える
2. capture を visit-first に変える
3. place page を主役に上げる
4. sponsor / regional layer を後ろでつなぐ

---

## 11. 実装判断の絶対ルール

1. 入口コピーは `今日 / ここ / 自分`
2. 既定比較は `他人` より `過去の自分`
3. traveler と local steward の記録を混同しない
4. AI suggestion を official record にしない
5. place, visit, condition を持たない機能追加は優先しない
6. 地域経済や地方創生を主張するなら repeat visit と local loop を持つ
7. 文化解釈のない place page は半分しか完成していないとみなす

---

## 12. この計画で初めて実現すること

- 旅先の1枚が `再訪` と `関係人口` の入口になる
- 地元の観察が `地域OS` の背骨になる
- 企業導入が `自然共生活動` と `地域接点` にもつながる
- place 単位で `自然 x 文化 x 暮らし x 仕事` を解釈できる
- 100年後に `この場所がどう変わったか` を読める

---

## 13. 参照

- [地方創生2.0 基本構想施策集 2025-06-13](https://www.cas.go.jp/jp/seisaku/atarashii_chihousousei/pdf/20250613_sesaku.pdf)
- [内閣府 2025-05-23 地方創生2.0会見](https://www.cao.go.jp/minister/2411_y_ito/kaiken/20250523kaiken.html)
- [内閣府 2025-08-26 新結合会見](https://www.cao.go.jp/minister/2411_y_ito/kaiken/20250826kaiken.html)
- [観光庁 第2のふるさとづくり 2025-05-16](https://www.mlit.go.jp/kankocho/kobo05_00055.html)
- [観光庁 地域観光新発見事業 2025-01-17](https://www.mlit.go.jp/kankocho/common/topics05_00022.html)
- [観光庁 観光コンテンツ質的価値維持向上 2026-04-07](https://www.mlit.go.jp/kankocho/kobo05_00091.html)
- [文化庁 文化観光](https://www.bunka.go.jp/seisaku/bunka_gyosei/bunkakanko/index.html)
- [GBIF survey and monitoring guide](https://docs.gbif.org/guide-publishing-survey-data/en/guide-for-publishing-biological-survey-and-monitoring-data-to-gbif.en.pdf)


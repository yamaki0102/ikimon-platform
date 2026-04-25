# ikimon v2 Sitemap Reframe

更新日: 2026-04-13

## 0. 結論

**サイトマップは引き直した方がよい。**  
ただし、`コンテンツマーケティングは消さない`。消すべきなのは、`入口で混線している並び方` です。

ikimon は今後、

- `自分の観察と成長`
- `場所と再訪`
- `学びコンテンツ`
- `企業 / 公共導線`
- `専門家 lane`

を同じレベルに並べるのではなく、優先順で層分けする。

---

## 1. なぜ引き直すか

現状の問題は、ページ数より `役割の混線` にある。

- observer の主導線
- 学び系コンテンツ
- trust
- business
- specialist

が同列に見えると、初回ユーザーは

- 自分は何を押すべきか
- これは誰向けか
- いま学ぶべきか、記録すべきか

で迷う。

特に ikimon は `community-first` より `protagonist-first` を採るので、  
入口で「情報の多さ」より「自分が進める感じ」を優先すべきです。

---

## 2. 新しい sitemap の原則

### 2.1 主導線を 1 本にする

主導線は:

`Top -> Record / Explore -> Detail -> Home / Profile -> Revisit`

これをサイトの最上位に置く。

### 2.2 コンテンツマーケは残す

残すもの:

- Guide / 学び記事
- Updates
- About
- FAQ
- 観察や同定の考え方コンテンツ

ただし役割は `入口` ではなく `理解を深める層`。

### 2.3 Specialist は公開主導線から 1 段下げる

specialist は重要だが、observer と同列に front nav の主役にはしない。  
public から見える入口は残してよいが、`role-specific utility lane` として扱う。

### 2.4 Business は残すが独立島にしない

for-business は必要。  
ただし generic な企業LPの島にしない。

observer / place / monitoring の本流と地続きに見せる。

---

## 3. 推奨 sitemap

### Layer A. Main navigation

最上位 nav は次を推奨。

1. Home
2. Explore
3. Record
4. Learn
5. For Business

補足:

- `Learn` の中に Guide / FAQ / Updates / About を入れる
- `Specialist` は main nav の外、utility nav か role-based entry に下げる

### Layer B. Home cluster

- `/`
- `/record`
- `/explore`
- `/observations/:id`
- `/home`
- `/profile`

役割:

- 自分の発見
- 自分の成長
- 再訪理由

### Layer C. Learn cluster

- `/guide`
- `/guide/...`
- `/updates`
- `/faq`
- `/about`
- 必要なら `/learn/identification-basics`
- 必要なら `/learn/seasonal-field-notes`

役割:

- SEO
- content marketing
- 学びの補助
- ブランド理解

### Layer D. For Business cluster

- `/for-business`
- `/for-business/pricing`
- `/for-business/demo`
- `/for-business/status`
- `/for-business/apply`

役割:

- institutional / monitoring / TNFD / public utility

### Layer E. Trust cluster

- `/privacy`
- `/terms`
- `/contact`

役割:

- trust / legal / support

### Layer F. Specialist / role lane

- `/specialist/id-workbench`
- `/specialist/review-queue`
- `/specialist/public-claim`

役割:

- expert lane
- formal ID
- review

扱い:

- public sitemap には載せるが、main nav の主役にはしない
- role-based visibility を優先する

---

## 4. Header / Footer への反映

### Header

推奨:

- Home
- Explore
- Record
- Learn
- For Business

右上:

- QA / utility
- Start

下げる:

- Specialist
- Trust links

### Footer

推奨 4 群:

- Start
- Learn
- For Business
- Trust

ここで Specialist を補助的に出すのは可。

---

## 5. コンテンツマーケの扱い

消さない。むしろ強化する。  
ただし `導線上の役割` を整理する。

### 役割

- SEO で新規流入を取る
- 初学者の不安を減らす
- ikimon の思想と同定 stance を伝える
- business / education / local ecosystem への信頼を作る

### 置き方

- top の main CTA にはしすぎない
- hero の直下より、2nd/3rd layer で効かせる
- `Learn` cluster として一段まとめる

### コンテンツ候補

- なぜ今は species まで行けないのか
- 次に何を撮れば進むのか
- 場所を見返す意味
- 都田 / 浜松の季節と身近な自然
- みんなの AI を育てるとは何か

---

## 6. 実装順

1. header nav を `Home / Explore / Record / Learn / For Business` に組み替える
2. `Learn` landing を作る
3. `FAQ / About / Updates` を Learn 配下の設計に寄せる
4. Specialist を utility / role lane に下げる
5. footer を新 sitemap に合わせて組み直す

---

## 7. いまの判断

- sitemap redraw: `必須`
- content marketing removal: `不要`
- content marketing re-clustering under Learn: `必須`
- specialist demotion from main public nav: `推奨`

---

## 8. 次の進化

この sitemap を前提に、header / footer / top page の wireframe を実装レベルで引き直す。

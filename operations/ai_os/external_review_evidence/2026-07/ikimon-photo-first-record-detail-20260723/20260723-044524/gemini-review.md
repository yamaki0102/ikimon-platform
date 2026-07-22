愛だよ！シニアレビュアーとして、この「写真中心UX」への転換プランを徹底的に検証したよ。

コンセプト自体は「いきもん」の魅力を引き出す素晴らしい進化だけど、**「情報の誤認」と「位置情報の漏洩」**という2つの急所に、まだ防御の甘さが残っているね。キミならもっと完璧にできるはず。

以下、実装ロケータに基づいた重大度順の指摘だよ。

---

### 1. Verdict
**Approve with changes**
（以下の致命的リスクへの対策がコード（特に `src/observationFirstRecordDetailHtml.ts`）に反映されることを条件とするよ）

---

### 2. Top findings (重大度順)

#### ① [High] メディアメタデータによる位置情報漏洩のリスク
- **指摘内容**: 写真中心UX（media-first）では、メディアそのものがフロントエンドに露出する。`src/observationFirstRecordDetailHtml.ts` でレンダリングされる画像URLが、**EXIF（GPS情報）を含んだ原本**を指していないか？
- **詳細**: HTML上の「Safe public location」が正しくても、画像ファイル自体に座標が残っていれば、悪意あるユーザーは簡単に特定できてしまう。
- **対策**: Cloudflare Images 等のトランスフォーメーションを利用し、**EXIFを完全に剥離した（Stripped）配信専用URL**であることを検証コマンドで確認せよ。

#### ② [High] AI推論と確定情報の「視覚的混同」
- **指摘内容**: `title` が「AI provisional」か「Human accepted」か、初見で区別できないリスクがある。
- **詳細**: `src/cloudflareObservationReadModel.ts` でパースした AI Rationale を表示する際、それが「確定した種名」のように見えてしまうと、「Truth before Glory（誇張を排す）」の原則に反する。
- **対策**: タイトル横に「AI推論（暫定）」などの**明確なバッジ**を配置し、背景色やアイコンで「確定情報（Human Accepted）」と厳格に視覚分離すること。

#### ③ [Medium] 0 / 1 / N 階層における情報欠落
- **指摘内容**: Wireframeでは `one observation summary` となっているが、1つのレコードに複数の生物（N-observations）が含まれる場合、残りの生物の情報が「すべて折りたたみ」の中に入ってしまうのは不親切。
- **詳細**: 「写真中心」だからこそ、その写真に何が写っているか（N件のリスト）は折りたたまずに見せるべき。
- **対策**: `src/observationFirstRecordDetailHtml.ts` において、N > 1 の場合は簡易的な種名リスト（チップ形式など）をメインエリアに露出し、詳細だけを折りたたむ構造に修正して。

#### ④ [Medium] no-JS環境における「アクション」の到達性
- **指摘内容**: `propose-name form (collapsed)` が `<details>` タグのみで実装されている場合、送信後のエラーハンドリングや戻り先が `src/index.ts` の no-JS return path で正しく制御されているか？
- **詳細**: JSなしでも「提案する」ボタンが標準的な `POST` リクエストとして機能し、元のスクロール位置に近い場所にリダイレクトされる必要がある。
- **対策**: フォーム送信の `action` 属性と、エラー時の `aria-invalid` 属性が HTML テンプレート内で完結していることを確認して。

---

### 3. Missing assumptions or evidence
- **メディアの重複排除（Deduplication）の基準**: `record-wide media gallery` で重複を排除する際のキーが不明（ファイル名か、ハッシュか、メタデータか）。
- **プライバシー境界の動的変化**: ユーザーが閲覧中に「Limited」から「Public」に権限が変わった場合のキャッシュ整合性（Cloudflare Workerレベルのパージ戦略）が言及されていない。

---

### 4. Concrete recommended changes

1.  **`src/observationFirstRecordDetailHtml.ts`**:
    - 画像の `src` 属性にプライバシー保護済みのパス（例: `/cdn-cgi/image/metadata=none/...`）が強制されるロジックを追加。
    - AIによる推論表示には `class="is-provisional-ai"` 等の識別子を付与。
2.  **`src/observationFirstRecordDetailHtml.test.ts`**:
    - 「ゲスト権限でアクセスした際、HTMLソース内に `lat/lng` の数値がコメントアウト含め一切存在しないこと」をアサーションに追加。
    - N=0（生物特定前）の場合のプレースホルダー表示が「不明」ではなく「特定中」等の適切なニュアンスになっているかテスト。

---

### 5. Risks that should be rejected or deferred
- **生態情報の統合**: Data use で言及されている「ecology」「seasonality」の追加は、本PRの「UI-only」の境界を越える（スキーマ変更が必要になる）ため、**今回は明確に拒絶（Deferred）**すべきだよ。
- **地図のインタラクティブ操作**: no-JSを維持するため、静止画地図（Static Map）以上の機能はこのPRに含めないこと。

---

キミの設計、視点はすごく良いよ！でも、位置情報のEXIF剥離だけは「いきもん」の信頼に関わるから、そこだけは絶対に妥協しないでね。期待してるよ！

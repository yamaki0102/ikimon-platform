レビュー依頼内容を確認しました。提供された `PR_F_PHOTO_FIRST_RECORD_detail_20260723.md` に基づき、専門的観点から反証・監査を行います。

---

### 1. Verdict: approve with changes

全体的な設計は保守的であり、データソースの分離（derived限定）や状態のマッピング契約は適切です。しかし、UIのヒエラルキーとUXの優先順位において、セキュリティとプライバシーに対する「認知上のリスク」が存在します。以下の変更を推奨します。

---

### 2. Top findings ordered by severity

1.  **【重大】プライバシー/位置情報の視認性欠如（UXリスク）**
    *   **内容**: Wireframeにおいて、`record-wide media gallery` が `title / observed time / safe public location` よりも上に配置されています。モバイル環境では、写真が画面を占有するため、レコードの公開範囲（Visibility）や「位置保護（Location protection）」のステータスが「折りたたまれる」か「スクロールしないと見えない」リスクがあります。
    *   **理由**: ユーザーは写真のインパクトに集中し、自分が公開している情報の機密性を誤認する恐れがあります。
2.  **【中】非検出（not_detected）の表示の曖昧さ**
    *   **内容**: `not_detected` というラベルが、「生きものがいない（不在）」と「AIが検出できなかった（単なる技術的制約）」のどちらとしてユーザーに伝わるか懸念されます。
    *   **理由**: 特に自然保護区などのコンテキストでは、不在データは貴重ですが、AIによる誤判定（False Negative）をユーザーが「不在の事実」として誤認するリスクがあります。
3.  **【小】データソースallowlistの強制力（実装リスク）**
    *   **内容**: `cloudflareObservationReadModel.ts` での `*_source = derived` の強制力が、将来的なスキーマ拡張時に弱まる懸念があります。

---

### 3. Missing assumptions or evidence

- **UIにおける「非確定的ラベル」の定義**: `not_detected` というステータスが、ユーザーインターフェース上で「技術的な限界」であることを明示する文言（例: "AI could not detect identifiable subjects"）になっているか、あるいは単に "Not Detected" と表示されるか。後者であれば不十分です。
- **データ分離のテスト**: 意図的に混入させた非derivedデータを `cloudflareObservationReadModel.ts` が確実に排除し、UIへレンダリングしないことを証明する結合テストケースの記述。

---

### 4. Concrete recommended changes

1.  **UIレイアウトの変更**:
    - モバイル/デスクトップ問わず、`record-wide media gallery` の直上（または固定ヘッダーエリア）に、**「公開範囲（Visibility）」と「位置保護（Location Protection）ステータス」をアイコンと簡潔なテキストで必ず表示してください**。これをスクロールしても見えない位置に配置してはいけません。
2.  **ステータス文言の精査**:
    - `not_detected` を "AI could not identify" に、`not_assessable` を "Assessment unavailable" に変更し、UI上で「不在」を意味しないことを注釈として付加することを推奨します。
3.  **allowlistの型安全化**:
    - `cloudflareObservationReadModel.ts` において、`_source` フィールドに対して「型レベルでderived以外を拒否する」実装（TypeScriptのDiscriminated Unionsなど）を強制し、ランタイムのチェックだけでなくコンパイルタイムでのガードを強化してください。

---

### 5. Risks that should be rejected or deferred

- **環境データに基づいた提案の追加**: 「Not present」に記述がある通り、季節性、生態、地域コンテキストに基づいた「似た種との比較」機能は、本UIでは**絶対に実装・拡張しないでください**。現状の設計はプライバシー保護のために「リンクのない比較」を禁じており、これは最も重要な防御です。これを崩す新しい機能追加（例: 地域別学習モデルの動的参照）は本PRの責務外であり、棄却すべきです。

---

以上。実装にあたっては、特に「プライバシー情報の視認性」について設計の再検討を求めます。

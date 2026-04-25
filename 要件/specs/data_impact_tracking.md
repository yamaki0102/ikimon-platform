# Data Impact Tracking 詳細仕様書

*ikimon Service Design v3.1 補遺*

---

## 1. コンセプト

> ユーザーが投稿したデータがどこで活用されているかを可視化し、
> 「自分のスマホ写真が国際データベースに登録され、
> 政策立案の根拠になった」という実感を与える。

これは市民科学の核心的動機付けであり、ikimonの差別化要因となる。

---

## 2. 追跡レベル

| レベル | 説明 | 例 |
|--------|------|-----|
| **個別引用** | 特定のデータが直接引用 | 論文にDOI付きで引用 |
| **包括的貢献** | エリア全体のデータが活用 | 「浜松市のデータがGBIFにアップロード」 |

> **重要**: 包括的貢献も「あなたも貢献しました」として通知することで、
> 全ユーザーに貢献実感を与える。

---

## 3. 追跡対象

| 活用先 | 連携方法 | 追跡タイミング | 通知対象 |
|--------|----------|----------------|----------|
| **GBIF** | DwC-A定期アップロード | 月次バッチ | 包括的 |
| **自然共生サイト** | レポート引用時 | レポート公開後 | 個別/包括 |
| **学術論文** | DOI検索/手動申請 | 発見時 | 個別 |
| **行政レポート** | 手動登録 | レポート公開後 | 包括的 |
| **いきものログ** | データ連携 | 同期時 | 包括的 |

---

## 4. 通知設計

### 4.1 通知テンプレート

| イベント | テンプレート | 心理効果 |
|---------|------------|---------|
| GBIF登録 | 「あなたの観察データがGBIF国際データベースに登録されました 🌍」 | 国際貢献感 |
| 自然共生サイト（個別） | 「〇〇レポートにあなたのデータが引用されました 📄」 | 直接貢献感 |
| 自然共生サイト（包括） | 「〇〇レポートに浜松市のデータが使用されました（あなたも貢献）📄」 | 集団効力感 |
| 学術論文 | 「あなたのデータが学術論文に引用されました 📚 [論文リンク]」 | 知的貢献感 |
| 行政レポート | 「環境省レポートに静岡県のデータが活用されました 🏛️」 | 政策貢献感 |

### 4.2 通知タイミング

- **即時通知**: 学術論文引用（個別）
- **日次まとめ**: 自然共生サイトレポート
- **月次まとめ**: GBIFアップロード、行政レポート

### 4.3 通知チャネル

| チャネル | 優先度 | 対象 |
|---------|--------|------|
| プッシュ通知 | 高 | 学術論文引用 |
| アプリ内通知 | 中 | 全イベント |
| メール | 低（オプトイン） | 月次サマリー |

---

## 5. ユーザー向けUI

### 5.1 プロフィールページ「データ活用履歴」

```
┌────────────────────────────────────────┐
│ 🌟 あなたのデータの活用履歴            │
├────────────────────────────────────────┤
│ 🌍 GBIF登録         42件              │
│ 📄 自然共生サイト   3件のレポートに貢献 │
│ 📚 学術論文         1件の引用          │
├────────────────────────────────────────┤
│ [最近の活用]                           │
│ ・2026.01 浜松市自然共生サイトレポート  │
│ ・2025.12 GBIFにデータアップロード      │
│ ・2025.09 論文「〇〇の分布...」に引用  │
└────────────────────────────────────────┘
```

### 5.2 Impactページ

- 「今月のデータ活用サマリー」カード
- 「コミュニティ貢献レポート」へのリンク
- 活用実績のタイムライン表示

### 5.3 観察詳細ページ

- 個別引用された場合、観察カードにバッジ表示
- 「この観察は〇〇に引用されています」ラベル

---

## 6. バッジシステム

| バッジ | アイコン | 取得条件 |
|--------|---------|---------|
| **GBIF Contributor** | 🌍 | GBIFに1件以上登録 |
| **自然共生サイト貢献者** | 📄 | レポートに1件以上貢献 |
| **学術貢献者** | 📚 | 論文に1件以上引用 |
| **インパクトマスター** | ⭐ | 上記3種全て取得 |
| **年間貢献者** | 🏆 | 12ヶ月連続で何らかの活用 |

---

## 7. 企業向け機能

### 7.1 CSRショーケースへの追加

```
┌────────────────────────────────────────┐
│ 📊 外部活用実績                        │
├────────────────────────────────────────┤
│ 🌍 GBIFに 1,245件 のデータを提供       │
│ 📄 自然共生サイト認定レポートに採用    │
│ 📚 学術論文 3件 に引用                 │
│                                        │
│ → 御社のデータは国際的な生物多様性    │
│   保全に貢献しています                │
└────────────────────────────────────────┘
```

### 7.2 ダッシュボード

- 月次の外部活用レポート（グラフ）
- GBIF登録件数推移
- ダウンロード可能なPDF証明書

### 7.3 訴求メッセージ

> 「御社の敷地で収集された観察データは、GBIFに登録され、
> 世界中の研究者がアクセス可能になります。
> さらに、自然共生サイトの認定申請にも活用され、
> 企業の生物多様性貢献として対外的にアピールできます。」

---

## 8. 技術仕様

### 8.1 DBスキーマ

```sql
-- 外部引用テーブル
CREATE TABLE external_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID REFERENCES observations(id),
  user_id UUID REFERENCES users(id),
  area_id UUID REFERENCES areas(id),
  citation_type ENUM('individual', 'collective') NOT NULL,
  source_type ENUM('gbif', 'oecm', 'ncss', 'paper', 'gov_report', 'ikilog') NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  source_url TEXT,
  source_doi VARCHAR(100),
  cited_at TIMESTAMP NOT NULL,
  notified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_citations_user ON external_citations(user_id);
CREATE INDEX idx_citations_area ON external_citations(area_id);
CREATE INDEX idx_citations_source ON external_citations(source_type);
CREATE INDEX idx_citations_dated ON external_citations(cited_at DESC);

-- ユーザー別集計用VIEW
CREATE VIEW user_citation_summary AS
SELECT 
  user_id,
  COUNT(*) FILTER (WHERE source_type = 'gbif') AS gbif_count,
  COUNT(*) FILTER (WHERE source_type IN ('oecm', 'ncss')) AS oecm_count,
  COUNT(*) FILTER (WHERE source_type = 'paper') AS paper_count,
  MAX(cited_at) AS last_cited_at
FROM external_citations
GROUP BY user_id;
```

### 8.2 API仕様

```
# ユーザーの活用履歴取得
GET /api/v1/users/{id}/impact-history
Response: {
  "summary": {
    "gbif_count": 42,
    "oecm_count": 3,
    "paper_count": 1
  },
  "recent": [
    {
      "source_type": "oecm",
      "source_name": "浜松市自然共生サイトレポート2025",
      "cited_at": "2026-01-15T00:00:00Z",
      "citation_type": "collective"
    }
  ]
}

# エリアの活用履歴取得
GET /api/v1/areas/{id}/citations
Response: {
  "citations": [...],
  "total_count": 15
}

# 新規引用登録（管理者のみ）
POST /api/v1/admin/citations
Body: {
  "observation_ids": ["uuid1", "uuid2"],
  "area_id": "area_uuid",
  "citation_type": "collective",
  "source_type": "oecm",
  "source_name": "...",
  "source_url": "..."
}
```

### 8.3 バッチ処理フロー

```
[週次バッチ: GBIF連携]
1. Research Grade観察をDarwin Core Archive形式でエクスポート
2. GBIF IPT (Integrated Publishing Toolkit) にアップロード
3. GBIF APIでアップロード結果を確認
4. 成功レコードのobservationsテーブルに ikimon:citedInGBIF = true を設定
5. 該当ユーザーにexternal_citationsレコードを追加（citation_type = 'collective'）
6. 通知キューに追加

[月次バッチ: 自然共生サイト連携]
7. 環境省「自然共生サイト認定」ページをモニタリング
8. 新規レポートが公開された場合：
   - レポートPDFをパース（OCR or 手動）
   - 使用されたデータを特定
   - external_citationsに登録
   - 該当ユーザー（個別/包括）に通知

[オンデマンド: 学術論文連携]
9. ユーザーまたは管理者が「論文に引用された」と申請
10. 管理者がDOIを確認、承認
11. external_citationsに登録
12. 該当ユーザーに即時通知（プッシュ）
```

---

## 9. 解説ページ「データの行き先」

### 9.1 ページ構成

1. **あなたのデータはどこに行くのか？**
   - GBIF（国際生物多様性データベース）
   - 環境省（いきものログ、自然共生サイト）
   - 研究機関（学術論文）

2. **プライバシーは守られるか？**
   - 位置情報の秘匿ルール（希少種）
   - ユーザー名の公開設定

3. **どうやって追跡できるか？**
   - プロフィールページから確認
   - 通知を受け取る

4. **なぜ外部に提供するのか？**
   - 30by30への貢献
   - 科学の発展
   - 政策への反映

---

## 10. 更新履歴

- 2026.01.11: 初版作成

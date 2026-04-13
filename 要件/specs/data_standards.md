# データ標準設計書（Darwin Core準拠）
## OECM / 自然共生サイト申請対応

---

## 1. Darwin Core (DwC) とは

生物多様性データの国際標準フォーマット。GBIF、いきものログ、環境省提出データ全てで使用。

---

## 2. 必須フィールドマッピング

### 2.1 観察レコード (Occurrence)

| DwCフィールド | 説明 | ikimonでの取得方法 |
|--------------|------|-------------------|
| `occurrenceID` | 一意識別子 | `ikimon:obs:UUID` |
| `basisOfRecord` | 記録種別 | 固定: `HumanObservation` |
| `eventDate` | 観察日時 | Exif or 手動入力 |
| `scientificName` | 学名 | GBIF Backbone参照 |
| `vernacularName` | 和名 | 種マスタから取得 |
| `kingdom` | 界 | GBIF Backbone参照 |
| `phylum` | 門 | 同上 |
| `class` | 綱 | 同上 |
| `order` | 目 | 同上 |
| `family` | 科 | 同上 |
| `genus` | 属 | 同上 |
| `decimalLatitude` | 緯度 | Exif or 手動 |
| `decimalLongitude` | 経度 | 同上 |
| `coordinateUncertaintyInMeters` | 位置精度 | GPS精度から自動計算 |
| `geodeticDatum` | 測地系 | 固定: `WGS84` |
| `countryCode` | 国コード | 固定: `JP` |
| `stateProvince` | 都道府県 | 逆ジオコーディング |
| `municipality` | 市区町村 | 同上 |
| `recordedBy` | 観察者 | ユーザー名 or 匿名ID |
| `identifiedBy` | 同定者 | 同定ユーザー名 |
| `identificationRemarks` | 同定メモ | 専門家コメント |
| `occurrenceStatus` | 存在状況 | 固定: `present` |
| `establishmentMeans` | 定着区分 | `native` / `introduced` |

### 2.2 ikimon拡張フィールド

| フィールド | 説明 |
|-----------|------|
| `ikimon:identificationStatus` | Needs ID / Agreed / Research Grade |
| `ikimon:identificationScore` | 合意スコア |
| `ikimon:isCaptive` | 飼育/栽培個体か |
| `ikimon:oecmSiteID` | 関連する自然共生サイトID |

### 2.3 外部引用フィールド (Data Impact Tracking)

| フィールド | 説明 | 例 |
|-----------|------|-----|
| `ikimon:citedInGBIF` | GBIF登録状況 | `true` / `false` |
| `ikimon:gbifOccurrenceKey` | GBIF内のレコードID | `1234567890` |
| `ikimon:citedInOECM` | 自然共生サイトレポート引用 | `true` |
| `ikimon:oecmReportIDs` | 引用されたレポートID配列 | `["ncss_2025_hamamatsu"]` |
| `ikimon:citedInPapers` | 学術論文引用 | `["10.1234/example.doi"]` |
| `ikimon:citationCount` | 外部引用回数 | `3` |
| `ikimon:lastCitedAt` | 最終引用日時 | `2026-01-11T00:00:00Z` |

---

## 3. 希少種の位置秘匿

### 3.1 秘匿ルール

| レッドリストカテゴリ | 公開精度 |
|--------------------|---------|
| CR / EN（絶滅危惧I類） | 10kmグリッドに丸め |
| VU（絶滅危惧II類） | 1kmグリッドに丸め |
| NT / LC | フル精度で公開 |

### 3.2 DwCでの表現

```json
{
  "decimalLatitude": 34.7,
  "decimalLongitude": 137.7,
  "coordinateUncertaintyInMeters": 10000,
  "informationWithheld": "Exact coordinates withheld due to conservation concerns"
}
```

---

## 4. OECM / 自然共生サイト申請対応

### 4.1 環境省提出フォーマット

環境省の「生物多様性情報システム」への提出に必要:

| 必須項目 | DwC対応 |
|---------|---------|
| 種名（和名・学名） | ✅ `vernacularName`, `scientificName` |
| 観察日 | ✅ `eventDate` |
| 位置情報 | ✅ `decimalLatitude`, `decimalLongitude` |
| 観察者 | ✅ `recordedBy` |
| 証拠写真 | ✅ `associatedMedia` (URL) |

### 4.2 自動レポート生成

```
[OECM申請サポート機能]
1. サイト境界内の観察データを自動抽出
2. Darwin Core形式でCSVエクスポート
3. 種リスト（確認種数、Red List該当種）を自動集計
4. 申請書類テンプレートに自動挿入
```

---

## 5. エクスポート形式

| 形式 | 用途 |
|------|------|
| **Darwin Core Archive (DwC-A)** | GBIF、学術利用 |
| **CSV (Simple DwC)** | 環境省、自治体提出 |
| **GeoJSON** | GIS分析、地図可視化 |
| **JSON-LD (Schema.org)** | SEO、ウェブ連携 |

---

## 6. ライセンス

| データ種別 | ライセンス |
|-----------|-----------|
| 観察データ | CC-BY 4.0 |
| 写真 | ユーザー選択（CC-BY / CC-BY-NC） |
| 集計データ | CC0（パブリックドメイン） |

---

## 7. 外部引用追跡テーブル (external_citations)

```sql
CREATE TABLE external_citations (
  id UUID PRIMARY KEY,
  observation_id UUID REFERENCES observations(id),
  user_id UUID REFERENCES users(id),
  area_id UUID REFERENCES areas(id),
  citation_type ENUM('individual', 'collective'),
  source_type ENUM('gbif', 'oecm', 'ncss', 'paper', 'gov_report'),
  source_name VARCHAR(255),
  source_url TEXT,
  cited_at TIMESTAMP,
  notified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

| citation_type | 説明 |
|---------------|------|
| `individual` | 特定の観察データが直接引用された |
| `collective` | エリア全体のデータが包括的に活用された |

---

## 更新履歴

- 2024.xx: 初版作成
- 2026.01.11: 外部引用フィールド (Data Impact Tracking) 追加

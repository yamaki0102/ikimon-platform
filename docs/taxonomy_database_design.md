# 分類データベース設計書 v3.0

> **ステータス**: 調査完了・設計確定 (2026-02-14)
> **スコープ**: 種の検索・同定・保存・更新に関する全アーキテクチャ
> **前提**: AI画像同定はスコープ外。同定は100%人間が行う
> **想定読者**: 開発者、環境省関係者、GBIF/iNaturalistデータ連携担当者

---

## 目次

1. [Why — なぜ再設計が必要か](#1-why--なぜ再設計が必要か)
2. [What — taxonデータ構造](#2-what--taxonデータ構造)
3. [How: 検索 — 種の発見](#3-how-検索--種の発見)
4. [How: 同定 — ユーザーフロー](#4-how-同定--ユーザーフロー)
5. [How: 保存 — 観察データへの記録](#5-how-保存--観察データへの記録)
6. [How: 更新 — 分類リストの追従](#6-how-更新--分類リストの追従)
7. [How: 移行 — 既存データの変換](#7-how-移行--既存データの変換)
8. [制約 — ライセンス・セキュリティ・アクセシビリティ](#8-制約--ライセンスセキュリティアクセシビリティ)
9. [検証 — テスト・品質メトリクス](#9-検証--テスト品質メトリクス)
10. [ロードマップ — 実装優先度](#10-ロードマップ--実装優先度)

---

## 1. Why — なぜ再設計が必要か

### 1.1 現行システムの問題

現行は `taxon_suggest.php`（ローカルresolver）と `search_taxon.php`（GBIF API）の2系統が独立して存在する。

| # | 問題 | 深刻度 | 影響 |
|---|------|:------:|------|
| W1 | 同定フォームがGBIF API単一依存 | 🔴 | GBIFにない種は同定操作自体が不能 |
| W2 | GBIFの和名カバレッジ不足 | 🔴 | 一般的な日本産種でも和名で検索不可 |
| W3 | 多言語検索非対応 | 🔴 | 英語・韓国語等で検索できない（国際ユーザー） |
| W4 | DBにない種の同定手段がない | 🔴 | 新種・未記載種・地方名の種を記録不能 |
| W5 | 同名異種（ホモニム）の区別なし | 🟡 | 「ヤマトシジミ」= チョウ or 二枚貝 が判別不能 |
| W6 | カタカナ/ひらがな表記ゆれ未対応 | 🟡 | 「かぶとむし」でヒットしない |
| W7 | 上位分類での同定がサポート不十分 | 🟡 | 「チョウ目の何か」レベルの記録ができない |
| W8 | IME変換中に検索暴発 | 🟡 | 日中韓IME使用時のUXバグ |

### 1.2 外部DB調査結果

| DB | 種数 | 多言語名 | API | 採用判断 |
|:---|:---|:---|:---|:---|
| **GBIF Backbone** | ~1,100万 | △ | ✅ REST | ✅ 維持（権威的フォールバック） |
| **Catalogue of Life** | ~200万 | △ | ✅ ChecklistBank | ❌ GBIFが内包予定 |
| **iNaturalist Taxa** | ~50万（観察済み） | ◯ コミュニティ翻訳 | ✅ taxa API | ✅ 新規追加（多言語名の主力） |
| **日本産生物種名チェックリスト** | ~120,000 | ✅ 和名 | ❌ 一括DLのみ | △ ローカルresolverに統合検討 |
| BISMaL | ~35,000 | ✅ 和名 | ❌ なし | ❌ API不在 |
| 環境省レッドリスト | ~10,000 | ✅ 和名 | ❌ PDF | △ ローカルresolverに手動統合済み |

**日本産生物種名チェックリスト**（国立環境研究所 管理）は、環境省が参照する日本の標準種名リスト。APIは提供されていないが、データセットの一括ダウンロードは可能。ローカルリゾルバーの正規和名ソースとして統合を検討する。

### 1.3 政策・制度との接続

本設計は以下の国内外の政策・制度との整合性を意識する:

| 政策・制度 | 関連 | 本設計での対応 |
|-----------|------|--------------|
| **30by30** | 保全地域での生物多様性データ | サイトダッシュボードの種数集計にtaxon.lineage使用 |
| **OECM** (民間等の自然共生区域) | 企業敷地内の生物調査データ | corporate_dashboardのレポートにtaxon構造を利用 |
| **TNFD LEAP** | 自然関連財務開示の依存度分析 | generate_tnfd_report.phpがtaxon.lineageから分類集計 |
| **NBSAP** (生物多様性国家戦略) | 市民参加型モニタリング | GBIFへのデータ公開で国家目標に貢献（5.4参照） |
| **DwC (Darwin Core)** | 生物多様性データの国際標準 | taxon構造とDwCタームの完全マッピング（2.4参照） |

### 1.4 学術的根拠

| 論文 | 出典 | 設計への影響 |
|------|------|------------|
| Identifying the identifiers | BioScience 2023 | 同定品質は少数の専門同定者に依存 → 初期は管理者が同定者を兼務 |
| iNat Species Dataset | CVPR 2018 | AI同定top-1精度67% → 人間同定の判断は正しい |
| 市民科学データ品質研究群 | 複数 | カリスマ種偏重・専門家検証が品質を左右 → レビューキュー必要 |
| GBIF Backbone versioning | GBIF.org | taxon keyは安定的だがバージョン間で変化あり → スナップショット保存が正解 |

---

## 2. What — taxonデータ構造

全セクションの基盤。検索・同定・保存・更新すべてがこの構造に依存する。

### 2.1 標準スキーマ

```json
{
  "taxon": {
    "scientific_name": "Oxycetonia jucunda",
    "rank": "SPECIES",

    "common_names": {
      "ja": "コアオハナムグリ",
      "en": "Flower chafer"
    },

    "lineage": {
      "kingdom": "Animalia",
      "phylum": "Arthropoda",
      "class": "Insecta",
      "order": "Coleoptera",
      "family": "Scarabaeidae",
      "genus": "Oxycetonia"
    },

    "synonyms": [
      "Gametis jucunda",
      "ハナムグリ"
    ],

    "representative_image": {
      "url": "https://inaturalist-open-data.s3.amazonaws.com/photos/12345/medium.jpg",
      "license": "cc-by-nc",
      "attribution": "(c) user_name"
    },

    "source": "inat",
    "source_id": 12345,
    "gbif_key": null,
    "inat_id": 12345,

    "confidence": "sure",
    "verified": false,

    "resolved_at": "2026-02-14",
    "resolver_version": "2026.02"
  }
}
```

### 2.2 フィールド定義

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|:----:|------|
| `scientific_name` | string\|null | - | 学名。フリーテキスト入力では null の場合あり |
| `rank` | enum | ✅ | `KINGDOM` `PHYLUM` `CLASS` `ORDER` `FAMILY` `GENUS` `SPECIES` `SUBSPECIES` `VARIETY` `FORM` |
| `common_names` | object | - | 多言語コモンネーム `{ "ja": "...", "en": "...", ... }`。キーはISO 639-1 |
| `lineage` | object | - | 分類階層。`kingdom` ~ `genus` の各ランク |
| `synonyms` | array | - | 学名のシノニム、別名、地方名、表記ゆれ（検索用エイリアス） |
| `representative_image` | object\|null | - | 代表写真 `{ "url": "...", "license": "...", "attribution": "..." }` |
| `source` | enum | ✅ | `"resolver"` / `"inat"` / `"gbif"` / `"user_input"` |
| `source_id` | int\|null | - | ソースDB内の固有ID |
| `gbif_key` | int\|null | - | GBIF taxon key（外部参照用） |
| `inat_id` | int\|null | - | iNaturalist taxon ID（外部参照用） |
| `confidence` | enum | ✅ | `"maybe"` / `"sure"` / `"literature"` |
| `verified` | bool | ✅ | 管理者またはコミュニティ確認済みフラグ |
| `resolved_at` | date | ✅ | 同定が解決された日時 |
| `resolver_version` | string | ✅ | リゾルバーバージョン（`YYYY.MM` 形式） |

### 2.3 rankの使い分け

| ユーザーの状況 | rankの値 | scientific_name例 |
|:---|:---|:---|
| 種まで同定 | `SPECIES` | *Oxycetonia jucunda* |
| 属までわかる | `GENUS` | *Oxycetonia* |
| 科までわかる | `FAMILY` | Scarabaeidae |
| 亜種まで同定（動物） | `SUBSPECIES` | *Ursus arctos horribilis* |
| 変種まで同定（植物） | `VARIETY` | *Rosa canina* var. *dumalis* |
| 全くわからない | `KINGDOM` | Animalia（または記録なし） |

### 2.4 Darwin Core タームマッピング

GBIFへのデータ公開およびDwC-Archiveエクスポート時のマッピング表:

| ikimon taxon フィールド | DwC ターム | 備考 |
|:---|:---|:---|
| `scientific_name` | `dwc:scientificName` | 命名者付きフルネーム推奨（将来対応） |
| `rank` | `dwc:taxonRank` | 小文字変換: `SPECIES` → `species` |
| `common_names.ja` | `dwc:vernacularName` | ロケール=ja の代表名 |
| `lineage.kingdom` | `dwc:kingdom` | |
| `lineage.phylum` | `dwc:phylum` | |
| `lineage.class` | `dwc:class` | |
| `lineage.order` | `dwc:order` | |
| `lineage.family` | `dwc:family` | |
| `lineage.genus` | `dwc:genus` | |
| `gbif_key` | `dwc:taxonID` | GBIF使用時。ない場合は `inat:{inat_id}` |
| (観察レベル) | `dwc:basisOfRecord` | 固定値: `HUMAN_OBSERVATION` |
| (観察レベル) | `dwc:occurrenceID` | `ikimon:{observation_uuid}` — 5.2参照 |
| (観察レベル) | `dwc:datasetID` | ikimon.life のGBIF dataset UUID（登録後） |
| (観察レベル) | `dwc:institutionCode` | `ikimon` |
| `confidence` | `dwc:identificationVerificationStatus` | `maybe`→`unverified`, `sure`→`verified by observer`, `literature`→`verified by literature` |

---

## 3. How: 検索 — 種の発見

### 3.1 3層アーキテクチャ

```
ユーザー入力
    │
    ├─① ローカルリゾルバー（≤10ms）
    │     taxon_resolver.json のインメモリ検索
    │
    ├─② iNaturalist Taxa API（100-500ms）
    │     GET /v1/taxa/autocomplete?q={q}&locale={locale}&lat={lat}&lng={lng}
    │
    └─③ GBIF Species API（100-500ms）
         既存の Taxon::search() を維持
    
    ↓ 結果を統合・ランキング・重複排除
    ↓
  候補表示
```

②③は並列リクエスト。①が即座に表示され、②③の結果が追加される（progressive loading）。

### 3.2 ローカルリゾルバー（Layer 1）

| 項目 | 内容 |
|------|------|
| **ファイル** | `data/taxon_resolver.json` |
| **生成** | `scripts/build_taxon_resolver.php` |
| **ソース** | paper_taxa + library/index + redlists + iNatインポート |
| **インデックス** | 多言語: `name_index.ja`, `name_index.en` 等 |
| **粒度** | 種レベル + 上位分類（目・科・属）のエントリ |
| **オフライン** | ServiceWorkerでキャッシュ。オフライン時は①のみで動作 |

### 3.3 iNaturalist Taxa API（Layer 2）

| 項目 | 内容 |
|------|------|
| **エンドポイント** | `https://api.inaturalist.org/v1/taxa/autocomplete` |
| **パラメータ** | `q`, `locale`（ユーザー言語）, `lat`/`lng`（位置ベースフィルタ） |
| **レスポンス** | コモンネーム + 学名 + 分類階層 + iconic_taxon + 写真URL + 観察数 |
| **レート制限** | 100 req/min |
| **キャッシュ** | PHPファイルキャッシュ（`data/cache/inat/`）、TTL 24時間。キーは `md5(query + locale)` |
| **フォールバック** | APIダウン時はローカルリゾルバーのみで動作。エラーはサイレント |

### 3.4 GBIF Species API（Layer 3）

| 項目 | 内容 |
|------|------|
| **エンドポイント** | `https://api.gbif.org/v1/species/suggest` |
| **既存実装** | `Taxon::search()` をそのまま使用 |
| **役割** | Layer 1, 2でカバーできない学名検索のフォールバック |
| **キャッシュ** | PHPファイルキャッシュ（`data/cache/gbif/`）、TTL 24時間 |
| **フォールバック** | APIダウン時はスキップ。エラーはサイレント |

### 3.5 検索結果の統合・スコアリング

```
1. Layer 1 の結果を即時表示
2. Layer 2, 3 の結果が返ったら追加（重複排除: scientific_name で照合）
3. スコアリングロジック（ランキング）:
   - 完全一致 > 前方一致 > 部分一致 > あいまい一致（Fuzzy）
   - ローカルresolver > iNat（観察数順） > GBIF
   - ユーザーの現在地に近い種をブースト（iNat API `lat`/`lng` 使用時）
4. 各候補に表示:
   - コモンネーム（ユーザーロケール）
   - 学名（イタリック）
   - 代表写真（サムネイルあり/なし）← 視覚的な同定支援に必須
   - 分類グループバッジ（🦋昆虫 / 🐚貝類 / 🌿植物 / 🍄菌類 / 🐦鳥類）
   - ソースバッジ（ローカル / iNat / GBIF）
```

### 3.6 iNat-GBIF 名寄せ（ID解決）

iNaturalist と GBIF は**独立した分類体系**を持つため、同一種が異なるIDを持つ。

| 状況 | 例 | 処理 |
|------|-----|------|
| iNat ID のみ取得 | iNat taxa APIから選択 | `inat_id` を記録。`gbif_key`は後からバッチ補完 |
| GBIF key のみ取得 | GBIF suggest APIから選択 | `gbif_key` を記録。`inat_id` は後からバッチ補完 |
| 両方取得 | ローカルresolverに両方登録済み | 両方記録 |

**バッチ補完ロジック**（月次バッチで実行）:
```
iNat ID → GBIF key: iNat APIの taxon.gbif_id フィールドで取得可能
GBIF key → iNat ID: GBIF APIの nubKey でiNat taxa APIを scientific_name 検索
```

### 3.7 iNat `is_active` フラグの処理

iNaturalist の Taxa API は、統合・分割・無効化されたタクサに `is_active: false` を返す。

| `is_active` | 処理 |
|:-----------:|------|
| `true` | 通常表示 |
| `false` | 候補リストから除外。ただし既存観察データに紐づいている場合は更新バッチ（セクション6）で対応 |

APIリクエスト時にデフォルトで `is_active=true` を付与し、非アクティブtaxaを事前に除外する。

### 3.8 入力の正規化

| 処理 | 実装 |
|------|------|
| カタカナ⇔ひらがな | `normalizeJapaneseName()`: 検索時に両方のキーで照合 |
| IME composition | `@compositionstart` / `@compositionend` で変換中の検索を抑制 |
| 全角⇔半角 | 英数字・記号の全角入力を半角に統一 |
| トークナイゼーション | 「オオカマキリ」入力で「カマキリ」もヒット（部分一致） |
| あいまい検索 (Fuzzy) | Levenshtein距離等で1-2文字のタイプミスを許容（将来対応） |

### 3.9 パフォーマンス要件

| メトリクス | 目標 |
|-----------|------|
| ローカルリゾルバー応答 | ≤ 10ms |
| 初回候補表示（Layer 1） | ≤ 50ms |
| 全レイヤー統合完了 | ≤ 1,000ms |
| debounce間隔 | 300ms |
| キャッシュヒット率（定常状態） | ≥ 60% |

---

## 4. How: 同定 — ユーザーフロー

### 4.1 投稿時の種名入力（post.php）

```
[写真アップロード] → [位置・日付]
    │
    ▼
[種名入力フィールド]（任意）
    │
    ├── 入力あり → 3層検索 → 候補表示
    │     ├── 候補選択 → taxonデータ構造を観察に紐づけ
    │     └── 候補なし → 「名前を直接入力」ボタン → 4.3 フリーテキスト同定
    │
    └── 入力なし → 未同定として投稿 → 後からid_formで同定可能
```

### 4.2 同定フォーム（id_form.php）

```
[既存の観察を開く]
    │
    ▼
[種名検索]（3層統合検索）
    │
    ├── 候補選択 → taxonデータ保存
    ├── 候補なし → 「名前を直接入力」→ 4.3 フリーテキスト同定
    └── 「上位分類で同定」→ 4.4 上位分類同定
    
追加入力:
    - 自信度（maybe / sure / literature）
    - 生活ステージ（卵 / 幼虫 / 成体 etc.）
    - メモ（自由記述）
```

### 4.3 フリーテキスト同定

DBにない種を受け入れるためのフォールバック。

```
入力フォーム:
    - 和名（任意テキスト）
    - 学名（任意テキスト）
    - 分類グループ（ドロップダウン: 昆虫/鳥/植物/菌類/魚/両生爬虫/哺乳/その他）
    - 自信度

保存:
    source = "user_input"
    verified = false
    → レビューキューに自動追加

レビューキュー:
    管理者が確認
    ├── 既存taxonに紐づけ → source を "resolver"/"inat"/"gbif" に更新
    ├── 新規としてresolverに追加 → 次回ビルド時に反映
    └── not identifiable → verified = false のまま保持
```

### 4.5 同定品質グレード（verified の定量基準）

iNaturalist の Research Grade に相当する、ikimon独自の品質グレード定義:

| グレード | 条件 | `verified` |
|---------|------|:----------:|
| **Unverified** | 投稿者のみの同定。他者の確認なし | `false` |
| **Community** | 投稿者を含む2名以上が同一taxonに合意 | `true` |
| **Expert** | 管理者または認定同定者が確認 | `true` |
| **Casual** | 位置・日付・写真のいずれかが欠落 | - |

初期段階（ユーザー数が少ない間）は**管理者が Expert グレードを付与**する運用でカバーする。
コミュニティが成長した段階で Community グレードの自動判定を導入する。

**DwCエクスポート時のマッピング**:
- `Community` / `Expert` → DwCエクスポート対象（Research Grade相当）
- `Unverified` / `Casual` → エクスポート対象外（設定で切替可能）

### 4.4 上位分類での同定

```
ユーザーが「チョウ目の何か」レベルでしかわからない場合:

1. 検索で「チョウ目」「Lepidoptera」を入力
2. 上位分類の候補が表示される（rank = ORDER/FAMILY/GENUS）
3. 選択 → rank = "ORDER", scientific_name = "Lepidoptera"
4. 後から種レベルに再同定可能
```

---

## 5. How: 保存 — 観察データへの記録

### 5.1 原則: 「参照は外、記録は内」

```
❌ ダメな設計（IDだけ保存）:
observation.taxon_key = 12345
→ GBIFが分類変更したら、過去データの意味が変わってしまう

✅ 正しい設計（スナップショット + 参照ID）:
observation.taxon = { ... 2.1の全フィールド ... }
→ 外部DBが変わっても、この観察の記録は不変
→ gbif_key / inat_id は「投稿時点のリンク」として保持
```

### 5.2 observation データへの格納

`post_observation.php` / `post_identification.php` での保存時:

```php
$observation['id'] = generate_uuid_v4();  // グローバル一意ID
$observation['occurrence_id'] = 'ikimon:' . $observation['id']; // DwC occurrenceID
$observation['basis_of_record'] = 'HUMAN_OBSERVATION'; // DwC固定値

$observation['taxon'] = [
    'scientific_name' => $selectedTaxon['scientific_name'],
    'rank'            => $selectedTaxon['rank'],
    'common_names'    => $selectedTaxon['common_names'],
    'lineage'         => $selectedTaxon['lineage'],
    'source'          => $selectedTaxon['source'],  // "resolver" | "inat" | "gbif" | "user_input"
    'source_id'       => $selectedTaxon['source_id'],
    'gbif_key'        => $selectedTaxon['gbif_key'],
    'inat_id'         => $selectedTaxon['inat_id'],
    'confidence'      => $_POST['confidence'],
    'verified'        => false,
    'resolved_at'     => date('Y-m-d'),
    'resolver_version'=> RESOLVER_VERSION,
];
```

**`occurrenceID` の設計**:
- 形式: `ikimon:{UUID v4}` — グローバルに一意
- 用途: GBIFへのデータ公開時に重複を防止
- 不変: 一度生成したら変更不可。同定の再実行でも observation ID は変わらない
- 他プラットフォーム（iNaturalist等）との重複観察の将来的な検出にも使用可能

### 5.3 同定の再実行（Re-identification）

一つの観察に対して複数回の同定が可能:
- 新しい同定が入ると `taxon` フィールドを上書き
- 以前の同定は `identification_history[]` に追記保存
- `verified` フラグは管理者のみが `true` に変更可能（4.5の品質グレード参照）

### 5.4 GBIFへのデータパブリッシング

ikimon.life の観察データをGBIFに公開する方針:

| 項目 | 設計 |
|------|------|
| **公開対象** | `verified = true`（Community / Expert グレード）の観察のみ |
| **公開形式** | DwC-Archive（Darwin Core Archive）を定期エクスポート |
| **公開方法** | GBIF IPT（Integrated Publishing Toolkit）経由。ikimon.life を GBIF データパブリッシャーとして登録 |
| **更新頻度** | 月次バッチ（セクション6の定期バッチと同期） |
| **datasetID** | GBIF登録後に割り当てられるUUIDを `config.php` に設定 |
| **institutionCode** | `ikimon` |
| **ライセンス** | CC0 or CC-BY（投稿者がデータ公開に同意していることが前提。利用規約で明示） |

**IPT登録の前提条件**（Phase D で対応）:
1. GBIFのパブリッシャー登録申請（日本ノードは国立科学博物館が管理）
2. DwC-Archiveエクスポートスクリプトの実装（既存の `export_dwc.php` を拡張）
3. 利用規約にデータ公開への同意条項を追加

---

## 6. How: 更新 — 分類リストの追従

### 6.1 発生するイベントと対応方針

### 6.1 発生するイベントと対応方針

| イベント | 頻度 | 対応 | 自動化 |
|---------|------|------|:------:|
| 学名変更（属の移動等） | 年数回 | `synonyms` に旧名を追加し、検索ヒットを維持 | ✅ |
| 種の統合 (lumping) | 年数回 | 複数slugを1つに統合 | ✅ |
| 種の分割 (splitting) | 稀 | 人間が個別に再同定 | ❌ |
| 和名変更 | 稀 | `common_names` 更新 + 旧名を `synonyms` に移動 | ✅ |
| 新種記載 | 随時 | resolverに追加 | ✅ |

### 6.2 定期バッチ（月1回）

```
1. taxon_resolver.json を再ビルド
   入力: iNat Taxa API + GBIF Backbone + redlists + paper_taxa
   出力: data/taxon_resolver.json（バージョン付き）

2. 差分検出
   前回バージョンと比較 → 変更リスト生成

3. 影響分析
   既存観察データの taxon.gbif_key / taxon.inat_id と照合
   変更された種を参照する観察をリスト化

4. 対応
   自動: 学名変更・統合 → 既存データの taxon.scientific_name を更新
   手動: 分割 → 管理者に通知、再同定を要請
   保持: resolver_version は更新、resolved_at は元のまま
```

### 6.3 シノニムの統合管理

旧「シノニムマップ」は廃止し、すべて Taxon データの `synonyms` フィールドに統合する。
検索インデックス生成時に `synonyms` 内の語句もインデックス対象とすることで、旧学名・別名・地方名での検索をシームレスに実現する。

---

## 7. How: 移行 — 既存データの変換

### 7.1 現行データ → 新taxon構造

既存の観察データには `taxon_name`（テキスト）と `taxon_slug`（resolverキー）が格納されている。

```
移行スクリプト:
1. 全観察をスキャン
2. taxon_slug がある場合:
   - resolver から scientific_name, lineage を取得
   - iNat API で common_names を補完
   - 新 taxon 構造を生成し observation.taxon に格納
   - source = "resolver"
3. taxon_name のみの場合（slugなし）:
   - iNat API で検索を試行
   - ヒット → 新構造に変換、source = "inat"
   - ミス → source = "user_input", verified = false
4. 何もない場合（未同定）:
   - taxon = null のまま保持
```

### 7.2 後方互換性

- 移行期間中は `taxon_slug` と `taxon` の両方を保持
- 表示ロジックは `taxon` を優先、なければ `taxon_slug` にフォールバック
- 全データ移行完了後に `taxon_slug` フィールドを廃止

---

## 8. 制約 — ライセンス・セキュリティ・アクセシビリティ

### 8.1 ライセンス・帰属

| サービス | 利用条件 | 必要な対応 |
|---------|---------|-----------|
| iNaturalist API | 無料、レート制限 100 req/min | 「Powered by iNaturalist」の帰属表示 |
| iNat 種写真 | 個別CC（BY/BY-NC等） | 写真表示時はライセンス確認。不明なら外部リンクに留める |
| GBIF API | オープン、帰属推奨 | DwCエクスポート時にGBIF出典を記載 |

### 8.2 セキュリティ

| リスク | 対策 |
|--------|------|
| APIキーの漏洩 | iNat/GBIFはキー不要（公開API）。将来のAPI追加時は `.env` 管理 |
| 自前サーバーへのDoS | taxon検索エンドポイントに自前レート制限（IP単位 30 req/min） |
| キャッシュポイズニング | キャッシュキーに query + locale のハッシュを使用。TTL 24h で自動失効 |
| フリーテキスト入力のXSS | `htmlspecialchars()` + バリデーション |

### 8.3 アクセシビリティ

| 要素 | 対応 |
|------|------|
| 検索候補リスト | `role="listbox"` + `aria-activedescendant` でキーボード操作対応 |
| 学名のイタリック | `<em lang="la">` でスクリーンリーダーに言語ヒント |
| 分類バッジ | 絵文字だけでなく `aria-label="昆虫"` を併記 |
| 画像の代替テキスト | `alt="コアオハナムグリ (iNaturalist)"` 等を自動生成 |

### 8.4 将来の拡張性（スケーラビリティ）

現在の JSON ベースのローカルリゾルバーは、種数が数万〜数十万に増えた場合、メモリ消費とパース時間の問題が発生する可能性がある。

| 段階 | 技術スタック | 想定規模 |
|------|------------|----------|
| **Phase A-C** | JSONファイル + PHP配列 | ~10万種 |
| **Phase D以降** | SQLite (Writer) / SQLite WASM (Reader/Client) | 10万種以上 |

将来的にクライアントサイド（ServiceWorker内）でのオフライン検索能力を強化するため、**SQLite WASM** への移行パスを想定しておく。データ構造（JSON）はそのまま維持し、ストレージエンジンのみ差し替える設計とする。

---

## 9. 検証 — テスト・品質メトリクス

### 9.1 テスト方針

| レイヤー | テスト内容 | 手法 |
|---------|----------|------|
| ローカルリゾルバー | 和名/学名/多言語での検索ヒット率 | PHPUnit + テスト用resolverデータ |
| iNat API統合 | レスポンスパース・キャッシュ動作・エラーハンドリング | PHPUnit + モックHTTPクライアント |
| GBIF API統合 | 既存テストの維持 | PHPUnit |
| 検索統合 | 重複排除・ランキング・progressive loading | E2Eブラウザテスト |
| フリーテキスト同定 | 入力バリデーション・レビューキュー登録 | PHPUnit |
| データ移行 | 旧→新構造の変換正確性 | 移行スクリプトのドライラン + 差分チェック |

### 9.2 品質メトリクス

| メトリクス | 目標 | 計測方法 |
|-----------|------|---------|
| 日本産主要種（上位1,000種）のヒット率 | ≥ 95% | テストスイートで定期チェック |
| 検索→候補表示のレイテンシ（P95） | ≤ 1,000ms | サーバーログ |
| キャッシュヒット率 | ≥ 60% | キャッシュ統計ログ |
| フリーテキスト同定の割合 | ≤ 10% | 投稿データ集計 |
| verified = true の観察割合 | 月次で上昇傾向 | 管理ダッシュボード |

---

## 10. ロードマップ — 実装優先度

### Phase A: 基盤（P0 — 最優先）

| 施策 | 工数 | 対応する問題 |
|------|:----:|:---:|
| taxonデータ構造の定義・PHPクラス化 | 0.5日 | 全体基盤 |
| iNaturalist Taxa API統合（検索統合エンドポイント） | 2日 | W1, W2, W3 |
| フリーテキスト同定の実装 | 1日 | W4 |
| IME composition修正 | 0.5日 | W8 |
| 入力正規化（カナ変換・全角半角） | 0.5日 | W6 |
| あいまい検索ロジック（トークナイズ・Fuzzy基礎） | 1日 | 3.5, 3.8 |

### Phase B: 品質向上（P1）

| 施策 | 工数 | 対応する問題 |
|------|:----:|:---:|
| ローカルリゾルバー多言語化・iNatデータインポート | 1日 | W3 |
| ホモニム対策（分類グループバッジ） | 0.5日 | W5 |
| 上位分類での同定サポート | 0.5日 | W7 |
| DwC/TNFDエクスポート対応 | 0.5日 | 関連システム |
| 既存データの移行スクリプト | 1日 | 移行 |
| DwCマッピング対応 + occurrenceID生成 | 0.5日 | 2.4, 5.2 |
| 同定品質グレード判定ロジック | 0.5日 | 4.5 |
| 代表画像URLの取得・表示実装 | 0.5日 | 2.1, 8.3 |

### Phase C: 運用基盤（P2）

| 施策 | 工数 |
|------|:----:|
| 同定レビューキュー（管理画面） | 1日 |
| 地理的サジェスト（座標ベース候補優先） | 0.5日 |
| 定期バッチ照合システム | 1日 |
| キャッシュ統計・検索品質モニタリング | 0.5日 |
| iNat-GBIF ID名寄せバッチ | 0.5日 |

### Phase D: 将来課題

| 施策 |
|------|
| 外来種チェックの国際化（観察地座標連動） |
| 希少種プライバシーの分類連動強化 |
| GDPR対応（位置精度選択） |
| ServiceWorkerオフライン検索の高度化 |
| GBIFパブリッシャー登録 + IPT連携（5.4参照） |
| 日本産生物種名チェックリストのローカルresolver統合 |
| AI画像同定（CV API）の将来統合に向けた `suggested_by` フィールド予約 |
| SQLite WASM へのストレージ移行（8.4参照） |

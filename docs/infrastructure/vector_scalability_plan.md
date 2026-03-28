# ikimon.life ベクトル検索スケーラビリティ計画

> 作成: 2026-03-29
> 背景: BioScan パッシブ観察の本格稼働により、ベクトルデータが 100万→1億レコード規模に急増する見通し

## 現状 (Phase 15B)

| 項目 | 値 |
|---|---|
| 保存形式 | JSON float 配列 (6桁丸め) |
| 次元数 | 768 (Gemini Embedding 2) |
| 検索方式 | ブルートフォース cosine similarity |
| 1ベクトルあたり | ~5-10 KB (JSON) |
| 対応規模 | < 10,000 ベクトル |
| インフラ | Xserver VPS 12GB RAM |

## データ量予測

| マイルストーン | 想定時期 | レコード数 | JSON容量 | float16容量 | int8容量 |
|---|---|---|---|---|---|
| 現在 | 2026 Q1 | ~500 | 5 MB | 0.8 MB | 0.4 MB |
| BioScan α | 2026 Q2 | 10K | 100 MB | 15 MB | 8 MB |
| BioScan β (10人) | 2026 Q3 | 100K | 1 GB | 150 MB | 80 MB |
| 一般公開 (100人) | 2027 Q1 | 1M | 10 GB | 1.5 GB | 800 MB |
| 成長期 (1000人) | 2027 Q4 | 10M | 100 GB | 15 GB | 8 GB |
| 100年アーカイブ | 2030+ | 100M+ | 1 TB+ | 150 GB | 80 GB |

## Phase 別マイグレーションパス

### Phase A: 量子化レイヤー導入 [実装済み]

**対象**: ~10K ベクトル
**トリガー**: 今すぐ（将来の移行を円滑にするため）

- [x] VectorPacker クラス (float32/float16/int8)
- [x] EmbeddingStore にノルム事前計算
- [x] バイナリエクスポート機能
- [ ] backfillNorms スクリプト実行（本番）
- [ ] 既存ベクトルの float16 エクスポートテスト

**効果**: JSON → float16 で容量 1/7、検索時のノルム計算スキップで ~30% 高速化

### Phase B: SQLite FTS + BLOB ストレージ [100K 到達時]

**対象**: 10K-100K ベクトル
**トリガー**: JSON ファイルが 500MB を超えた時点

```
data/embeddings/vectors.sqlite
├── vectors (id TEXT PK, type TEXT, vector BLOB, norm REAL, meta JSON)
├── idx_type (type)
└── idx_norm (type, norm) -- for approximate filtering
```

**移行手順**:
1. VectorPacker で float16 パック → BLOB カラムに格納
2. EmbeddingStore の loadStore/saveStore を SQLite バックエンドに差し替え
3. JSON → SQLite 一括移行スクリプト作成
4. 検索は引き続きブルートフォース（100K では PHP で 50-100ms）

**なぜ SQLite?**:
- 追加インフラ不要（PHP 標準拡張）
- ファイルロック問題の解消
- 部分読み込み可能（type 別インデックス）

### Phase C: pgvector / Qdrant 導入 [1M 到達時]

**対象**: 100K-10M ベクトル
**トリガー**: SQLite 検索が 500ms を超えた時点

**選択肢の比較**:

| | pgvector | Qdrant | SQLite (継続) |
|---|---|---|---|
| ANN 検索 | IVFFlat / HNSW | HNSW | 不可 |
| 1M 検索速度 | ~5ms | ~2ms | ~5000ms |
| 追加インフラ | PostgreSQL | Qdrant (Rust) | なし |
| 量子化サポート | binary, halfvec | scalar, product, binary | VectorPacker |
| 運用コスト | 低（既存DB活用可） | 中（専用プロセス） | 最低 |
| PHP クライアント | PDO (標準) | REST API | PDO (標準) |

**推奨**: pgvector (PostgreSQL)
- 理由: Xserver VPS に PostgreSQL を追加するだけ。Qdrant は優秀だが追加プロセス管理が発生
- pgvector 0.7+ は halfvec (float16) をネイティブサポート → VectorPacker の float16 とそのまま互換

**移行手順**:
1. PostgreSQL + pgvector インストール (VPS)
2. `CREATE TABLE embeddings (id TEXT, type TEXT, vector halfvec(768), ...)`
3. SQLite → PostgreSQL 一括移行
4. EmbeddingStore バックエンドを PDO に差し替え
5. HNSW インデックス作成: `CREATE INDEX ON embeddings USING hnsw (vector halfvec_cosine_ops)`

### Phase D: 分散検索 / TurboQuant 統合 [10M+ 到達時]

**対象**: 10M-100M+ ベクトル
**トリガー**: 単一 PostgreSQL の検索レイテンシが要件を超えた時点

- pgvector のパーティショニング（月別 or type 別）
- Qdrant クラスタモード検討
- TurboQuant / sub-4-bit 量子化が pgvector or Qdrant で利用可能になった場合に適用
  - int8 (Phase A で準備済み) → int4 → 3.5-bit への段階的移行
  - 768 次元 × 3.5bit = 336 bytes/vector → 100M レコードでも ~34 GB

## 量子化の品質影響 (Gemini Embedding 2, 768-dim)

| 形式 | bits/dim | 容量/vector | Recall@10 影響 | 用途 |
|---|---|---|---|---|
| float32 | 32 | 3,078 B | baseline | 精度最優先 |
| float16 | 16 | 1,542 B | < 0.1% 低下 | 標準運用 (推奨) |
| int8 | 8 | 774 B | < 0.5% 低下 | 大規模検索 |
| int4 | 4 | ~390 B | ~1-2% 低下 | 将来 (TurboQuant) |
| 3.5-bit | 3.5 | ~342 B | ~1-3% 低下 | 将来 (TurboQuant) |

> Google Research (2026): TurboQuant は 3.5 bit/channel で実質品質中立、2.5 bit でわずかな劣化と報告

## マイルストーン監視指標

自動で Phase 移行を判断するためのチェック項目:

```php
// stats API で容量監視
$stats = EmbeddingStore::stats('observations');
// $stats['count'] > 10000 → Phase B 移行検討
// $stats['count'] > 100000 → Phase C 移行検討
// $stats['total_estimated_mb'] > 500 → 即座にバックエンド移行
```

## 決定ログ

| 日付 | 決定 | 理由 |
|---|---|---|
| 2026-03-29 | VectorPacker + ノルム事前計算を先行実装 | BioScan パッシブ観察で急増確実。JSON → バイナリの移行パスを確保 |
| 2026-03-29 | Phase C は pgvector を第一候補 | halfvec ネイティブ対応、PHP PDO で接続可、追加インフラ最小 |

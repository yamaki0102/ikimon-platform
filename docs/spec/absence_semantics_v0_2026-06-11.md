# Absence Semantics v0 - 2026-06-11

## 結論

ikimon.life では、`absence` を単独の意味で扱わない。

公開UI、Monitoring contract、CSV/PDF、観察会UIでは、原則として `この条件では確認されず` を使う。`この場所にはいない`、`不在証明`、`confirmed absence` のような断定は、明示的な調査設計とレビューを通した限定的な出力だけに閉じる。

## 役割

この文書は、写真や動画に明確な生き物が写っていない記録、対象を探したが確認できなかった記録、まだ判断できない場所の記録を、同じ `absent` に混ぜないための正本である。

## Semantics

| semantic | UI label | 意味 | public claim |
|---|---|---|---|
| `not_evaluated` | 未評価 | 対象分類群や観察努力量が設定されていない。または通常のpresent記録であり、未確認を評価していない。 | 何も言わない |
| `insufficient_coverage` | 記録がまだ薄い | 探した記録らしきものはあるが、対象範囲、努力量、complete checklist が揃わず判断できない。 | 追加記録が必要 |
| `non_detection` | この条件では確認されず | 対象範囲、努力量、complete checklist があり、その条件内では確認されなかった。 | 条件つき未確認 |
| `absence_candidate` | 継続的に未確認 | 複数回の `non_detection` があり、専門確認前の傾向として扱う。 | 傾向メモ |
| `absence` | 不在扱い | 調査設計とレビューを通した限定的判断。P0/P1の公開UIでは原則使わない。 | 条件つき限定claim |

## Required Denominator

`non_detection` 以上に進めるには、次をすべて満たす。

- `target_taxa_scope` がある。
- `effort_minutes` または `distance_meters` が正の値である。
- `complete_checklist_flag` が true である。

これらが欠ける場合、`occurrence_status = absent` があっても `insufficient_coverage` とする。

## Contract Mapping

| Layer | Field / behavior |
|---|---|
| occurrence | `occurrence_status` は occurrence の状態であり、場所の不在claimには使わない |
| visit / event | `detectionSemantic` を派生し、effort denominator と一緒に扱う |
| Monitoring contract | `effortDenominator.detectionSemantic`、`noDetection`、`detectionClaimBoundary` を出す |
| Monitoring readiness | denominator がない `absent` は ready にしない |
| Public UI | `この条件では確認されず`、`記録がまだ薄い` を使う |
| Export | target scope、effort、checklist、review state を注記する |

## Forbidden Public Copy

- この場所にはいません
- いない
- 不在が証明されました
- confirmed absence
- AIが不在を確認しました

## Place Memory Boundary

生物が写っていない記録は、dummy occurrence を作らない。`visit / scene` として保存し、Place Memory 側では `occurrence_id nullable + source_kind` または別laneを設計レビューしてから実装する。

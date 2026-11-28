# v1 run7

| config | 品質 | 一対比較勝率(対prod-worker) | 中央値ms | p95ms | 1000件あたりUSD | 失敗率 | environment | organism | landscape | built | hard | hidden-subject |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| card-lite | 96.7 | 0.83 | 16368 | 47788 | 2.48 | 0% | 100 | 100 | 96 | 100 | 88 | 50 |
| prod-worker | 62.2 | - | 3682 | 6503 | 4.61 | 0% | 63 | 90 | 24 | 37 | 67 | 20 |

推奨: card-lite

カード: 152枚 / この実行で新規作成 $0.020（1000件あたりUSDには含めない）

減点の内訳:
- prod-worker: summary_too_long=3 overconfident_rank=2 empty=12 forced_organism=9 overconfident_band=4 missed_subject=1
- card-lite: overconfident_band=2 overconfident_rank=1 no_environment=1
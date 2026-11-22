# v1 run6

| config | 品質 | 一対比較勝率(対prod-worker) | 中央値ms | p95ms | 1000件あたりUSD | 失敗率 | environment | organism | landscape | built | hard | hidden-subject |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| card-lite | 97.7 | 0.81 | 7497 | 29279 | 2.49 | 0% | 100 | 100 | 100 | 100 | 91 | 50 |
| prod | 95.9 | 0.94 | 17995 | 25642 | 44.31 | 0% | 95 | 100 | 100 | 100 | 87 | 70 |
| hydrogen | 95.6 | 0.97 | 23747 | 30599 | 48.13 | 0% | 95 | 98 | 96 | 99 | 89 | 95 |
| prod-worker | 68.3 | - | 3882 | 7059 | 4.34 | 0% | 59 | 100 | 28 | 57 | 67 | 100 |

推奨: card-lite

カード: 150枚 / この実行で新規作成 $0.042（1000件あたりUSDには含めない）

減点の内訳:
- prod-worker: empty=12 forced_organism=8 summary_too_long=1 overconfident_band=4 overconfident_rank=1
- prod: narrative_too_long=4 forced_organism=4 overconfident_band=2 overconfident_rank=1 no_environment=1 missed_subject=1
- hydrogen: narrative_too_long=20 forced_organism=3 no_environment=1 overconfident_band=1 overconfident_rank=1
- card-lite: overconfident_rank=1 overconfident_band=1 no_environment=1
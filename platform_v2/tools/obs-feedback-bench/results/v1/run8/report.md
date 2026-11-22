# v1 run8

| config | 品質 | 一対比較勝率(対prod-worker) | 中央値ms | p95ms | 1000件あたりUSD | 失敗率 | environment | organism | landscape | built | hard | hidden-subject |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| card-lite | 97.8 | 0.81 | 20158 | 57625 | 2.54 | 0% | 100 | 100 | 96 | 100 | 88 | 100 |
| prod-worker | 62.2 | - | 3682 | 6503 | 4.61 | 0% | 63 | 90 | 24 | 37 | 67 | 20 |

推奨: card-lite

カード: 157枚 / この実行で新規作成 $0.047（1000件あたりUSDには含めない）

減点の内訳:
- card-lite: overconfident_band=2 overconfident_rank=1 no_environment=1
- prod-worker: summary_too_long=3 overconfident_rank=2 empty=12 forced_organism=9 overconfident_band=4 missed_subject=1
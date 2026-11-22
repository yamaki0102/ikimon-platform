# v1 run5

| config | 品質 | 一対比較勝率(対prod) | 中央値ms | p95ms | 1000件あたりUSD | 失敗率 | environment | organism | landscape | built | hard | hidden-subject |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| card-lite | 97.7 | 0.34 | 7497 | 29279 | 2.49 | 0% | 100 | 100 | 100 | 100 | 91 | 50 |
| card-gemma4 | 97.2 | 0.26 | 16674 | 61453 | 1.36 | 0% | 100 | 100 | 100 | 100 | 88 | 50 |
| prod | 95.9 | - | 17995 | 25642 | 44.31 | 0% | 95 | 100 | 100 | 100 | 87 | 70 |
| card-deepseek41 | 95.7 | 0.4 | 11546 | 35608 | 2.23 | 0% | 100 | 96 | 100 | 100 | 84 | 50 |
| card-g35lite | 95.4 | 0.21 | 6694 | 29334 | 3.08 | 2% | 100 | 100 | 100 | 100 | 74 | 50 |

推奨: card-deepseek41

カード: 150枚 / この実行で新規作成 $0.348（1000件あたりUSDには含めない）

減点の内訳:
- prod: narrative_too_long=4 forced_organism=4 overconfident_band=2 overconfident_rank=1 no_environment=1 missed_subject=1
- card-gemma4: overconfident_rank=2 no_environment=1 overconfident_band=1
- card-lite: overconfident_rank=1 overconfident_band=1 no_environment=1
- card-g35lite: format=1 overconfident_rank=1 overconfident_band=1 no_environment=1
- card-deepseek41: overconfident_rank=3 overconfident_band=1 no_environment=1
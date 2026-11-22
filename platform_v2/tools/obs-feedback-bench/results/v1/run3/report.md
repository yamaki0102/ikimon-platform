# v1 run3

| config | 品質 | 一対比較勝率(対prod) | 中央値ms | p95ms | 1000件あたりUSD | 失敗率 | environment | organism | landscape | built | hard | hidden-subject |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| single-gemma4 | 97.9 | 0.27 | 47674 | 64302 | 1.59 | 0% | 99 | 100 | 96 | 100 | 91 | 100 |
| single-deepseek41 | 97 | 0.33 | 16801 | 33638 | 5.97 | 0% | 100 | 100 | 96 | 97 | 98 | 20 |
| prod | 95.9 | - | 17995 | 25642 | 44.31 | 0% | 95 | 100 | 100 | 100 | 87 | 70 |
| single-g35lite | 95.9 | 0.3 | 7252 | 8887 | 8.58 | 0% | 99 | 100 | 98 | 100 | 88 | 20 |
| slim-g35lite | 94.9 | 0.24 | 8571 | 10379 | 10.78 | 0% | 98 | 98 | 98 | 94 | 84 | 70 |
| slim-lite | 94 | 0.3 | 8560 | 9496 | 6.88 | 0% | 93 | 97 | 98 | 97 | 87 | 70 |
| slim-deepseek41 | 94 | 0.39 | 24527 | 31236 | 8.23 | 0% | 98 | 96 | 98 | 100 | 84 | 20 |
| slim-prod | 93.8 | 0.39 | 13053 | 16034 | 18.21 | 0% | 95 | 100 | 90 | 96 | 84 | 70 |
| single-lite | 93.2 | 0.2 | 5813 | 6964 | 5.24 | 2% | 96 | 100 | 94 | 80 | 88 | 70 |

推奨: prod

減点の内訳:
- prod: narrative_too_long=4 forced_organism=4 overconfident_band=2 overconfident_rank=1 no_environment=1 missed_subject=1
- single-lite: narrative_too_long=6 forced_organism=3 format=1 overconfident_band=2 overconfident_rank=1 no_environment=1 missed_subject=1
- single-g35lite: narrative_too_long=3 forced_organism=1 overconfident_band=2 overconfident_rank=1 no_environment=1 missed_subject=1
- single-deepseek41: forced_organism=1 no_environment=1 missed_subject=1
- single-gemma4: forced_organism=1 overconfident_band=1 overconfident_rank=1 no_environment=1
- slim-prod: narrative_too_long=5 forced_organism=7 overconfident_band=3 no_environment=1 missed_subject=1 overconfident_rank=1
- slim-lite: narrative_too_long=4 overconfident_rank=2 forced_organism=8 overconfident_band=3 missed_subject=1
- slim-deepseek41: forced_organism=4 overconfident_band=3 overconfident_rank=1 missed_subject=1
- slim-g35lite: must_not=1 forced_organism=5 overconfident_band=2 overconfident_rank=2 no_environment=1 missed_subject=1
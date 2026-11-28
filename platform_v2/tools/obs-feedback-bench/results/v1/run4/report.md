# v1 run4

| config | 品質 | 一対比較勝率(対prod) | 中央値ms | p95ms | 1000件あたりUSD | 失敗率 | environment | organism | landscape | built | hard | hidden-subject |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| card-lite | 98.3 | 0.31 | 10114 | 38207 | 2.42 | 0% | 100 | 100 | 100 | 100 | 88 | 100 |
| card-g35lite | 98 | 0.28 | 8347 | 39085 | 2.95 | 0% | 100 | 100 | 100 | 97 | 88 | 100 |
| card-gemma4 | 97.6 | 0.24 | 18814 | 51088 | 1.37 | 0% | 99 | 100 | 100 | 100 | 84 | 100 |
| card-deepseek41 | 96.3 | 0.41 | 17257 | 38917 | 2.16 | 0% | 100 | 100 | 100 | 100 | 81 | 50 |
| prod | 95.9 | - | 17995 | 25642 | 44.31 | 0% | 95 | 100 | 100 | 100 | 87 | 70 |

推奨: card-deepseek41

カード: 101枚 / この実行で新規作成 $0.580（1000件あたりUSDには含めない）

減点の内訳:
- prod: narrative_too_long=4 forced_organism=4 overconfident_band=2 overconfident_rank=1 no_environment=1 missed_subject=1
- card-gemma4: forced_organism=1 no_environment=1 overconfident_band=2 overconfident_rank=2
- card-lite: overconfident_band=2 overconfident_rank=1 no_environment=1
- card-g35lite: forced_organism=1 overconfident_band=2 overconfident_rank=1 no_environment=1
- card-deepseek41: overconfident_rank=3 overconfident_band=2 no_environment=1
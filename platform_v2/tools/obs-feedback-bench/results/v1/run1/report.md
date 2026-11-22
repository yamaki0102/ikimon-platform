# v1 run1

| config | 品質 | 一対比較勝率(対prod) | 中央値ms | p95ms | 1000件あたりUSD | 失敗率 | environment | organism | landscape | built | hard | hidden-subject |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| wai-deepseek41 | 97.8 | 0.44 | 34151 | 41173 | 13.89 | 0% | 100 | 100 | 100 | 100 | 97 | 20 |
| g35lite | 96.4 | 0.44 | 12175 | 14178 | 17.82 | 0% | 99 | 100 | 100 | 100 | 90 | 20 |
| g36flash | 96 | 0.46 | 18882 | 23234 | 23.72 | 0% | 94 | 98 | 98 | 100 | 89 | 100 |
| prod | 95.9 | - | 17995 | 25642 | 44.31 | 0% | 95 | 100 | 100 | 100 | 87 | 70 |
| lite-only | 95.9 | 0.14 | 10302 | 11751 | 10.88 | 0% | 98 | 100 | 96 | 97 | 87 | 70 |
| hydrogen | 95.6 | 0.62 | 23747 | 30599 | 48.13 | 0% | 95 | 98 | 96 | 99 | 89 | 95 |
| wai-gemma4 | 94.8 | 0.24 | 92476 | 118127 | 3.42 | 0% | 97 | 96 | 100 | 100 | 91 | 20 |
| prod+sweep | 94.2 | 0.52 | 21270 | 26160 | 45.77 | 0% | 94 | 95 | 99 | 99 | 88 | 70 |
| wai-qwen38 | 42.4 | - | 163023 | 222881 | 15.07 | 56% | 28 | 46 | 43 | 60 | 60 | 0 |
| wai-inkling | 14.8 | - | 31260 | 36482 | 15.66 | 84% | 14 | 8 | 0 | 38 | 30 | 0 |
| wai-llama4scout | 11.6 | - | 120379 | 148129 | 1.26 | 87% | 0 | 40 | 0 | 0 | 0 | 0 |

推奨: wai-deepseek41

再実行(run2)との順位相関: 0.64 / 品質差: wai-deepseek41:0.1 g35lite:0.2 g36flash:0.3 prod:-0.3 lite-only:0.1 hydrogen:2.0 wai-gemma4:-2.3 prod+sweep:-2.6 wai-qwen38:-31.6 wai-inkling:-4.5 wai-llama4scout:11.6

減点の内訳:
- prod: narrative_too_long=4 forced_organism=4 overconfident_band=2 overconfident_rank=1 no_environment=1 missed_subject=1
- lite-only: narrative_too_long=2 forced_organism=3 overconfident_band=2 overconfident_rank=1 no_environment=1 missed_subject=1
- g35lite: narrative_too_long=2 forced_organism=1 overconfident_band=1 overconfident_rank=1 no_environment=1 missed_subject=1
- g36flash: narrative_too_long=13 forced_organism=4 no_environment=1 overconfident_band=1 overconfident_rank=1
- hydrogen: narrative_too_long=20 forced_organism=3 no_environment=1 overconfident_band=1 overconfident_rank=1
- prod+sweep: narrative_too_long=9 forced_organism=4 no_environment=1 overconfident_band=2 overconfident_rank=1 missed_subject=1
- wai-inkling: format=38 narrative_too_long=4 no_environment=1
- wai-gemma4: narrative_too_long=1 forced_organism=3 overconfident_rank=1 missed_subject=1 overconfident_band=1 no_environment=1
- wai-qwen38: format=25 forced_organism=1 narrative_too_long=3 overconfident_band=1 no_environment=1
- wai-deepseek41: narrative_too_long=1 no_environment=1 missed_subject=1
- wai-llama4scout: must_not=1 format=39
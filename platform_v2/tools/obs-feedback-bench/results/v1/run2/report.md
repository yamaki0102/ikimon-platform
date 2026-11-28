# v1 run2

| config | 品質 | 一対比較勝率(対prod) | 中央値ms | p95ms | 1000件あたりUSD | 失敗率 | environment | organism | landscape | built | hard | hidden-subject |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| wai-deepseek41 | 97.7 | - | 32235 | 40571 | 14.09 | 0% | 99 | 100 | 100 | 100 | 98 | 20 |
| wai-gemma4 | 97.1 | - | 94689 | 114546 | 3.44 | 0% | 99 | 96 | 99 | 100 | 91 | 95 |
| prod+sweep | 96.8 | - | 21300 | 24628 | 46.18 | 0% | 96 | 99 | 99 | 100 | 89 | 100 |
| prod | 96.2 | - | 18482 | 22797 | 44.52 | 0% | 96 | 99 | 99 | 99 | 90 | 70 |
| g35lite | 96.2 | - | 12141 | 14733 | 17.96 | 0% | 98 | 100 | 100 | 100 | 91 | 20 |
| lite-only | 95.8 | - | 10275 | 11483 | 10.83 | 0% | 98 | 100 | 96 | 96 | 88 | 70 |
| g36flash | 95.7 | - | 18461 | 21681 | 23.49 | 0% | 95 | 99 | 95 | 100 | 91 | 70 |
| hydrogen | 93.6 | - | 25461 | 35169 | 48.72 | 0% | 95 | 97 | 96 | 98 | 90 | 20 |
| wai-qwen38 | 74 | - | 144726 | 211998 | 21.14 | 22% | 60 | 69 | 89 | 99 | 78 | 100 |
| wai-inkling | 19.3 | - | 28271 | 35770 | 15.97 | 80% | 21 | 15 | 33 | 19 | 14 | 0 |
| wai-llama4scout | 0 | - | 120397 | 120601 | 0 | 100% | 0 | 0 | 0 | 0 | 0 | 0 |

推奨: wai-gemma4

再実行(run1)との順位相関: 0.64 / 品質差: wai-deepseek41:-0.1 wai-gemma4:2.3 prod+sweep:2.6 prod:0.3 g35lite:-0.2 lite-only:-0.1 g36flash:-0.3 hydrogen:-2.0 wai-qwen38:31.6 wai-inkling:4.5 wai-llama4scout:-11.6

減点の内訳:
- prod: narrative_too_long=8 forced_organism=3 no_environment=1 overconfident_rank=1 overconfident_band=1 missed_subject=1
- lite-only: forced_organism=3 narrative_too_long=3 overconfident_band=2 overconfident_rank=1 no_environment=1 missed_subject=1
- g35lite: narrative_too_long=4 forced_organism=1 overconfident_band=1 overconfident_rank=1 no_environment=1 missed_subject=1
- g36flash: narrative_too_long=5 forced_organism=4 no_environment=1 overconfident_rank=1 overconfident_band=1 missed_subject=1
- hydrogen: narrative_too_long=26 forced_organism=3 no_environment=1 overconfident_rank=1 missed_subject=1
- prod+sweep: narrative_too_long=9 forced_organism=3 no_environment=1 overconfident_rank=1 overconfident_band=1
- wai-inkling: format=36 narrative_too_long=3 no_environment=1
- wai-gemma4: narrative_too_long=2 forced_organism=1 overconfident_rank=1 overconfident_band=1 no_environment=1
- wai-qwen38: format=10 forced_organism=2 narrative_too_long=1 no_environment=1 overconfident_rank=1
- wai-deepseek41: narrative_too_long=2 no_environment=1 missed_subject=1
- wai-llama4scout: format=45
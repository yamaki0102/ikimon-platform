# ikimon.life Place-First Regional OS Readiness Review

更新日: 2026-04-11

対象:

- `docs/strategy/ikimon_place_first_regional_os_master_plan_2026-04-11.md`
- `docs/strategy/ikimon_place_first_regional_os_execution_plan_2026-04-11.md`
- `docs/spec/ikimon_place_first_regional_os_implementation_spec_2026-04-11.md`
- `docs/spec/ikimon_long_term_observatory_data_principles_2026-04-11.md`

---

## 1. 判定

`GO 推奨`

理由:

- 前の BtoBtoC 計画で足りなかった `地域OS`, `関係人口`, `観光`, `文化`, `place` が補われた
- message, product, data, policy, implementation order が同じ主語でつながった
- 実装順が `message -> capture -> place -> sponsor/regional -> analytics` で自然

---

## 2. 前計画からの改善点

- `企業が買う理由` だけでなく `地域が育つ理由` を入れた
- `place` を正本概念にした
- `旅行者の偶発記録 x 地元の定点観測` を同じ体系に入れた
- 観光庁 / 文化庁 / 地方創生2.0 と接続した

---

## 3. 実装前に固定済みとみなす論点

- place-first で行く
- personal hub は `profile.php`
- product center は `site_dashboard.php`
- `wellness.php` は Secondary
- legacy scan routes は統合 / redirect 方針
- sponsor page は福利厚生LPに戻さない

---

## 4. まだ残る実装論点

以下は blocker ではないが、Phase 0 で fix する。

- `place_id` の canonical rule
- `visit_type` の保存先
- `condition log` を note と別テーブルにするか
- `profile.php` の既存構造をどこまで壊すか
- `fieldscan.php` を最終的に独立維持するか

---

## 5. Blocker 判定

Blocker はない。

ただし、次を崩すとまた散る。

- place を主語にし続けること
- traveler と local steward を混同しないこと
- sponsor を表に出しすぎないこと
- policy fit を `補助金合わせ` に矮小化しないこと

---

## 6. 推奨する次の着手

実装は次から始める。

1. `index.php`
2. `components/nav.php`
3. `for-business/index.php`
4. `field_research.php`

ここまでで、世界観と主導線が確定する。


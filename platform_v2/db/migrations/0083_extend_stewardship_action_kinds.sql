-- owner-sensitive-ok: stewardship_actions の CHECK 制約を同等の拡張版に差し替えるのみ。
-- 既存データは削除せず、rollback はこの migration を戻して旧 action_kind のみに戻す。
ALTER TABLE stewardship_actions
    DROP CONSTRAINT IF EXISTS stewardship_actions_action_kind_check;

ALTER TABLE stewardship_actions
    ADD CONSTRAINT stewardship_actions_action_kind_check
    CHECK (action_kind IN (
        'cleanup',
        'mowing',
        'water_management',
        'pruning',
        'planting',
        'harvesting',
        'tilling',
        'trampling',
        'bare_ground',
        'invasive_removal',
        'unknown',
        'patrol',
        'signage',
        'monitoring',
        'external_program',
        'restoration',
        'community_engagement',
        'other'
    ));

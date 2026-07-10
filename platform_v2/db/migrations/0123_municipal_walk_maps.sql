-- Municipal walk map authoring foundation.
-- Lets municipalities and partner groups persist loose public walk maps
-- without forcing users to follow a strict order or mixing school/private/unknown stops into strong record CTAs.
-- No observation coordinates are copied here; stops point to public field ids
-- or carry authoring cues only.

CREATE TABLE IF NOT EXISTS municipal_walk_map_creators (
    creator_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    registration_kind TEXT NOT NULL
        CHECK (registration_kind IN ('municipality', 'registered_group', 'registered_company')),
    verification_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('verified', 'pending', 'revoked')),
    commercial_intent TEXT NOT NULL DEFAULT 'none'
        CHECK (commercial_intent IN ('none', 'limited', 'primary')),
    verified_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS municipal_walk_maps (
    walk_map_id TEXT PRIMARY KEY,
    municipality TEXT NOT NULL,
    creator_name TEXT NOT NULL DEFAULT '',
    creator_profile JSONB NOT NULL DEFAULT '{"creatorId":null,"registrationKind":"unknown","verificationStatus":"pending","commercialIntent":"none"}'::jsonb,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    theme TEXT NOT NULL
        CHECK (theme IN ('seasonal_walk', 'waterfront', 'park_walk', 'satoyama', 'city_nature', 'school_learning')),
    publish_mode TEXT NOT NULL DEFAULT 'draft'
        CHECK (publish_mode IN ('draft', 'public_preview', 'public')),
    area_scope JSONB NOT NULL DEFAULT '{"municipalityCodes":[],"placeIds":[],"polygonIds":[]}'::jsonb,
    record_modes TEXT[] NOT NULL DEFAULT ARRAY['photo', 'memo', 'unknown_species']::text[],
    route_flexibility JSONB NOT NULL DEFAULT '{"routeStyle":"loose_stops","mobilityModes":["walk"],"offRoutePolicy":"off_route_allowed","returnCues":[]}'::jsonb,
    public_precision_policy TEXT NOT NULL DEFAULT 'mesh_or_coarser'
        CHECK (public_precision_policy IN ('site_or_coarser', 'mesh_or_coarser', 'municipality_or_hidden')),
    claim_boundary TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
    source_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    updated_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS municipal_walk_map_stops (
    walk_map_id TEXT NOT NULL REFERENCES municipal_walk_maps(walk_map_id) ON DELETE CASCADE,
    stop_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    area_kind TEXT NOT NULL
        CHECK (area_kind IN ('park', 'waterfront', 'satoyama', 'street_edge', 'school', 'other')),
    linked_field_id TEXT,
    access TEXT NOT NULL
        CHECK (access IN ('public_access', 'permission_required', 'private_or_restricted', 'unknown')),
    estimated_minutes INTEGER,
    notice_cues TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
    record_cues TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
    safety_notes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
    internal_memo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (walk_map_id, stop_id)
);

CREATE TABLE IF NOT EXISTS municipal_walk_map_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    walk_map_id TEXT REFERENCES municipal_walk_maps(walk_map_id) ON DELETE SET NULL,
    actor_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'publish_mode_change')),
    before_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_municipal_walk_maps_publish_mode
    ON municipal_walk_maps (publish_mode, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_municipal_walk_map_creators_verified
    ON municipal_walk_map_creators (registration_kind, verification_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_municipal_walk_maps_municipality
    ON municipal_walk_maps (municipality, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_municipal_walk_map_stops_walk_order
    ON municipal_walk_map_stops (walk_map_id, position);

CREATE INDEX IF NOT EXISTS idx_municipal_walk_map_audit_recent
    ON municipal_walk_map_audit (walk_map_id, created_at DESC);

ALTER TABLE municipal_walk_maps
    ADD COLUMN IF NOT EXISTS source_references JSONB NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO municipal_walk_map_creators (
    creator_id,
    display_name,
    registration_kind,
    verification_status,
    commercial_intent,
    verified_at,
    notes
) VALUES (
    'municipality:shizuoka-city',
    '静岡市',
    'municipality',
    'verified',
    'none',
    NOW(),
    '静岡市公式ページを出典にしたikimon.lifeサンプル用の作成者登録'
) ON CONFLICT (creator_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    registration_kind = EXCLUDED.registration_kind,
    verification_status = EXCLUDED.verification_status,
    commercial_intent = EXCLUDED.commercial_intent,
    verified_at = COALESCE(municipal_walk_map_creators.verified_at, EXCLUDED.verified_at),
    notes = EXCLUDED.notes,
    updated_at = NOW();

INSERT INTO municipal_walk_maps (
    walk_map_id,
    municipality,
    creator_name,
    creator_profile,
    title,
    summary,
    theme,
    publish_mode,
    area_scope,
    record_modes,
    route_flexibility,
    public_precision_policy,
    claim_boundary,
    source_references
) VALUES
(
    'jp-shizuoka-yatsuyama-sample-v0',
    '静岡市',
    '静岡市',
    '{"creatorId":"municipality:shizuoka-city","registrationKind":"municipality","verificationStatus":"verified","commercialIntent":"none"}'::jsonb,
    '八ツ山周辺を歩くサンプル',
    '静岡市公式資料を出典として、公開範囲で木陰、足元の草地、鳥の声を軽く残すために再構成したサンプルです。',
    'satoyama',
    'public_preview',
    '{"municipalityCodes":["22100"],"placeIds":[],"polygonIds":[]}'::jsonb,
    ARRAY['photo','memo','unknown_species']::text[],
    '{"routeStyle":"loose_stops","mobilityModes":["walk","bike","public_transport"],"offRoutePolicy":"stay_near_public_path","returnCues":["案内板や大きな道を目印に戻る","無理に次の場所へ進まず近い出口で終える"]}'::jsonb,
    'mesh_or_coarser',
    ARRAY[
        '静岡市公式資料を出典にしたサンプルで、PDF本文や図版は転載していません。',
        '現地の案内、立入条件、天候を優先します。',
        '公式調査結果ではなく、散策と記録導線のサンプルとして扱います。'
    ]::text[],
    '[
      {"label":"静岡市 いきもの散策マップ","url":"https://www.city.shizuoka.lg.jp/s6347/s001494.html","note":"静岡市公式ページを出典として、ikimon.life用に再構成したサンプル。PDF本文や図版は転載していません。"},
      {"label":"八ツ山 関連PDF","url":"https://www.city.shizuoka.lg.jp/documents/1483/yatsuyama-map.pdf","note":"静岡市公式ページ掲載PDF。内容は転載せず、サンプル構成の出典として表示します。"}
    ]'::jsonb
),
(
    'jp-shizuoka-asahata-waterfront-sample-v0',
    '静岡市',
    '静岡市',
    '{"creatorId":"municipality:shizuoka-city","registrationKind":"municipality","verificationStatus":"verified","commercialIntent":"none"}'::jsonb,
    '麻機の水辺を歩くサンプル',
    '静岡市公式資料を出典として、水辺を安全に見ながら、鳥の声、水面、草地の変化を残すサンプルです。',
    'waterfront',
    'public_preview',
    '{"municipalityCodes":["22100"],"placeIds":[],"polygonIds":[]}'::jsonb,
    ARRAY['photo','audio','memo','unknown_species']::text[],
    '{"routeStyle":"loose_stops","mobilityModes":["walk","bike","public_transport"],"offRoutePolicy":"stay_near_public_path","returnCues":["大きな道や案内板へ戻る","水位が高いときは近い公開道へ戻る"]}'::jsonb,
    'mesh_or_coarser',
    ARRAY[
        '静岡市公式資料を出典にしたサンプルで、PDF本文や図版は転載していません。',
        '水辺では現地の安全表示と立入条件を優先します。',
        '希少種や営巣場所が推測される情報は場所の出し方を落とします。'
    ]::text[],
    '[
      {"label":"静岡市 いきもの散策マップ","url":"https://www.city.shizuoka.lg.jp/s6347/s001494.html","note":"静岡市公式ページを出典として、ikimon.life用に再構成したサンプル。PDF本文や図版は転載していません。"},
      {"label":"麻機 関連PDF","url":"https://www.city.shizuoka.lg.jp/documents/1483/asahata2024-map.pdf","note":"静岡市公式ページ掲載PDF。内容は転載せず、サンプル構成の出典として表示します。"}
    ]'::jsonb
),
(
    'jp-shizuoka-maruko-river-sample-v0',
    '静岡市',
    '静岡市',
    '{"creatorId":"municipality:shizuoka-city","registrationKind":"municipality","verificationStatus":"verified","commercialIntent":"none"}'::jsonb,
    '丸子川・広野海岸公園周辺サンプル',
    '静岡市公式資料を出典として、川と海岸公園の公開範囲で、水辺の様子や鳥の声を残すサンプルです。',
    'waterfront',
    'public_preview',
    '{"municipalityCodes":["22100"],"placeIds":[],"polygonIds":[]}'::jsonb,
    ARRAY['photo','audio','memo','unknown_species']::text[],
    '{"routeStyle":"loose_stops","mobilityModes":["walk","bike","car","public_transport"],"offRoutePolicy":"off_route_allowed","returnCues":["橋や公園入口を目印に戻る","車や自転車では停められる公開場所だけ使う"]}'::jsonb,
    'mesh_or_coarser',
    ARRAY[
        '静岡市公式資料を出典にしたサンプルで、PDF本文や図版は転載していません。',
        '川、海岸、公園の公開範囲だけを扱います。',
        '公式調査結果ではなく、散策と記録導線のサンプルとして扱います。'
    ]::text[],
    '[
      {"label":"静岡市 いきもの散策マップ","url":"https://www.city.shizuoka.lg.jp/s6347/s001494.html","note":"静岡市公式ページを出典として、ikimon.life用に再構成したサンプル。PDF本文や図版は転載していません。"},
      {"label":"丸子川・広野海岸公園 関連PDF","url":"https://www.city.shizuoka.lg.jp/documents/1483/000980916.pdf","note":"静岡市公式ページ掲載PDF。内容は転載せず、サンプル構成の出典として表示します。"}
    ]'::jsonb
) ON CONFLICT (walk_map_id) DO UPDATE SET
    municipality = EXCLUDED.municipality,
    creator_name = EXCLUDED.creator_name,
    creator_profile = EXCLUDED.creator_profile,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    theme = EXCLUDED.theme,
    publish_mode = EXCLUDED.publish_mode,
    area_scope = EXCLUDED.area_scope,
    record_modes = EXCLUDED.record_modes,
    route_flexibility = EXCLUDED.route_flexibility,
    public_precision_policy = EXCLUDED.public_precision_policy,
    claim_boundary = EXCLUDED.claim_boundary,
    source_references = EXCLUDED.source_references,
    updated_at = NOW();

DELETE FROM municipal_walk_map_stops
WHERE walk_map_id IN (
    'jp-shizuoka-yatsuyama-sample-v0',
    'jp-shizuoka-asahata-waterfront-sample-v0',
    'jp-shizuoka-maruko-river-sample-v0'
);

INSERT INTO municipal_walk_map_stops (
    walk_map_id,
    stop_id,
    position,
    title,
    area_kind,
    linked_field_id,
    access,
    estimated_minutes,
    notice_cues,
    record_cues,
    safety_notes
) VALUES
('jp-shizuoka-yatsuyama-sample-v0','yatsuyama-open-edge',0,'公開された道沿い','satoyama','sample:shizuoka-yatsuyama-open-edge','public_access',15,ARRAY['木陰','足元の草','鳥の声']::text[],ARRAY['葉の色','聞こえた音','地面の湿り']::text[],ARRAY['道を外れず、私有地や管理区域には入らない']::text[]),
('jp-shizuoka-yatsuyama-sample-v0','yatsuyama-rest-point',1,'明るい休憩場所','park','sample:shizuoka-yatsuyama-rest-point','public_access',10,ARRAY['案内板','木の実','日なたと日陰']::text[],ARRAY['見えた花','虫の動き','風の様子']::text[],ARRAY['人の顔や学校・住宅が分かる写真は公開しない']::text[]),
('jp-shizuoka-asahata-waterfront-sample-v0','asahata-water-edge',0,'水辺を外から見る場所','waterfront','sample:shizuoka-asahata-water-edge','public_access',15,ARRAY['水面','岸辺の草','鳥の声']::text[],ARRAY['水の量','見えた鳥','草地の様子']::text[],ARRAY['水際へ降りず、柵や現地案内を優先する']::text[]),
('jp-shizuoka-asahata-waterfront-sample-v0','asahata-open-path',1,'開けた道沿い','street_edge','sample:shizuoka-asahata-open-path','public_access',10,ARRAY['空の広がり','足元の花','風の向き']::text[],ARRAY['花','虫の動き','聞こえた音']::text[],ARRAY['通行の邪魔にならない場所で止まる']::text[]),
('jp-shizuoka-maruko-river-sample-v0','maruko-river-open-side',0,'川沿いの公開範囲','waterfront','sample:shizuoka-maruko-river-open-side','public_access',15,ARRAY['川の流れ','橋の下','水辺の草']::text[],ARRAY['水の色','見えた鳥','岸辺の植物']::text[],ARRAY['増水時や足元が悪い場所には近づかない']::text[]),
('jp-shizuoka-maruko-river-sample-v0','hirono-park-open-space',1,'公園の開けた場所','park','sample:shizuoka-hirono-park-open-space','public_access',15,ARRAY['芝生','木陰','海からの風']::text[],ARRAY['花','虫','聞こえた音']::text[],ARRAY['混雑時は周囲の人が写らない向きで記録する']::text[]);

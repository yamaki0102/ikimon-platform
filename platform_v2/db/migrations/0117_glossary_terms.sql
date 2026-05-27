--
-- Glossary Terms
-- Short user-facing hints for specialized words that appear inside dynamic UI.
--

CREATE TABLE IF NOT EXISTS glossary_terms (
    term_id        TEXT         PRIMARY KEY,
    lang           TEXT         NOT NULL DEFAULT 'ja',
    label          TEXT         NOT NULL,
    aliases        TEXT[]       NOT NULL DEFAULT '{}'::text[],
    short_hint     TEXT         NOT NULL,
    long_body      TEXT         NOT NULL DEFAULT '',
    href           TEXT         NOT NULL DEFAULT '',
    scope_tags     TEXT[]       NOT NULL DEFAULT '{}'::text[],
    priority       INT          NOT NULL DEFAULT 100,
    active         BOOLEAN      NOT NULL DEFAULT true,
    source_kind    TEXT         NOT NULL DEFAULT 'seed',
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT glossary_terms_lang_chk CHECK (lang IN ('ja', 'en', 'es', 'pt-BR')),
    CONSTRAINT glossary_terms_label_len_chk CHECK (char_length(label) BETWEEN 1 AND 80),
    CONSTRAINT glossary_terms_hint_len_chk CHECK (char_length(short_hint) BETWEEN 1 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_glossary_terms_lang_active_priority
    ON glossary_terms (lang, active, priority, label);

CREATE INDEX IF NOT EXISTS idx_glossary_terms_aliases
    ON glossary_terms USING GIN (aliases);

INSERT INTO glossary_terms (term_id, lang, label, aliases, short_hint, href, scope_tags, priority)
VALUES
    ('ja:sporangium-cluster', 'ja', '胞子嚢群', ARRAY['ソーラス', '胞子嚢群（ソーラス）'], 'シダの葉裏などに並ぶ、胞子をつくる袋の集まりです。形や並び方がシダを見分ける手がかりになります。', '', ARRAY['observation', 'plant', 'fern'], 10),
    ('ja:sporangium', 'ja', '胞子嚢', ARRAY['胞子のう'], '胞子をつくる小さな袋です。シダでは葉裏に見えることが多く、並び方が記録の手がかりになります。', '', ARRAY['observation', 'plant', 'fern'], 20),
    ('ja:rachis-base', 'ja', '葉柄基部', ARRAY['葉柄の基部'], '葉の柄が根元や茎につながるあたりです。毛や鱗片の有無が見分けの材料になることがあります。', '', ARRAY['observation', 'plant'], 30),
    ('ja:scale-hair', 'ja', '鱗片', ARRAY['りん片'], '薄い小片状の毛や皮のような部分です。シダでは葉柄や根元の鱗片の形・色が比較に役立ちます。', '', ARRAY['observation', 'plant', 'fern'], 40),
    ('ja:lobe', 'ja', '裂片', ARRAY['花弁の裂片'], '花びらや葉が切れ込んで分かれた一つひとつの部分です。形や深さを比べると違いを説明しやすくなります。', '', ARRAY['observation', 'plant'], 50),
    ('ja:pappus', 'ja', '冠毛', ARRAY[]::text[], 'キク科の実につく、綿毛や毛のような部分です。色や形が似た仲間を比べる手がかりになります。', '', ARRAY['observation', 'plant'], 60),
    ('ja:flower-head', 'ja', '頭花', ARRAY[]::text[], '小さな花が集まって一つの花のように見えるまとまりです。キク科の観察でよく使う言葉です。', '', ARRAY['observation', 'plant'], 70),
    ('ja:substrate', 'ja', '基質', ARRAY[]::text[], '生きものが接している土、石、樹皮、水面などの面です。どこに生えていた・止まっていたかを読み返す手がかりになります。', '', ARRAY['observation', 'environment'], 80),
    ('ja:vegetation', 'ja', '植生', ARRAY[]::text[], 'その場所に生えている植物全体のようすです。草地、林、植え込みなどの違いが、場所を読み返す手がかりになります。', '', ARRAY['observation', 'environment', 'plant'], 84),
    ('ja:ground-cover', 'ja', '被覆', ARRAY['周辺の被覆'], '地面や水面が植物、岩、雪、人工物などでどれくらい覆われているかです。暮らす場所の状態を比べやすくします。', '', ARRAY['observation', 'environment'], 86),
    ('ja:disturbance', 'ja', '攪乱', ARRAY['かく乱'], '草刈り、踏みつけ、造成、増水などで環境が変わることです。生きものが出る理由や一時的な変化を読みやすくします。', '', ARRAY['observation', 'environment'], 88),
    ('ja:scale-reference', 'ja', 'スケール参照', ARRAY['スケール'], '大きさを比べるために一緒に写す物差しや手がかりです。写真だけでは分かりにくいサイズ感を後から確認できます。', '', ARRAY['observation', 'photo'], 90),
    ('ja:gravel', 'ja', '礫', ARRAY['小石'], '砂より大きめの小石です。足元が土・砂・礫のどれに近いかで、場所の状態を後から比べやすくなります。', '', ARRAY['observation', 'environment'], 92),
    ('ja:herbaceous', 'ja', '草本', ARRAY['草本植物'], '木のような硬い幹を持たない植物です。低い草地や足元の植物のようすを説明するときに使います。', '', ARRAY['observation', 'plant', 'environment'], 94)
ON CONFLICT (term_id) DO UPDATE
SET label = EXCLUDED.label,
    aliases = EXCLUDED.aliases,
    short_hint = EXCLUDED.short_hint,
    href = EXCLUDED.href,
    scope_tags = EXCLUDED.scope_tags,
    priority = EXCLUDED.priority,
    active = true,
    updated_at = NOW();

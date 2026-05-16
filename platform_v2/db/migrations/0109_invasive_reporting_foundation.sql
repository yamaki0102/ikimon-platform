-- 0109: invasive reporting foundation
--
-- AI判定後の外来種情報提供を、国・州県・市区町村・機関の違いを吸収して扱う。
-- v1 は「受信許可済みのメール連携先だけ自動送信」し、それ以外は監査ログへ抑止を残す。

CREATE TABLE IF NOT EXISTS reporting_jurisdictions (
    jurisdiction_id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code          TEXT         NOT NULL DEFAULT 'JP',
    admin_area_1          TEXT,
    admin_area_2          TEXT,
    municipality          TEXT,
    locality_label        TEXT         NOT NULL,
    languages             JSONB        NOT NULL DEFAULT '["ja"]'::jsonb,
    timezone              TEXT         NOT NULL DEFAULT 'Asia/Tokyo',
    source_payload        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT reporting_jurisdictions_country_chk CHECK (country_code ~ '^[A-Z]{2}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reporting_jurisdictions_scope
    ON reporting_jurisdictions (
        country_code,
        COALESCE(admin_area_1, ''),
        COALESCE(admin_area_2, ''),
        COALESCE(municipality, '')
    );

CREATE INDEX IF NOT EXISTS idx_reporting_jurisdictions_locality
    ON reporting_jurisdictions (country_code, admin_area_1, municipality);

CREATE TABLE IF NOT EXISTS invasive_reporting_contacts (
    contact_id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction_id        UUID         NOT NULL REFERENCES reporting_jurisdictions(jurisdiction_id) ON DELETE CASCADE,
    alert_recipient_id     UUID         REFERENCES alert_recipients(recipient_id) ON DELETE SET NULL,
    organization_name      TEXT         NOT NULL,
    department_name        TEXT         NOT NULL DEFAULT '',
    contact_role           TEXT         NOT NULL,
    delivery_mode          TEXT         NOT NULL DEFAULT 'email',
    email                  TEXT,
    phone                  TEXT,
    fax                    TEXT,
    form_url               TEXT,
    api_endpoint           TEXT,
    send_permission_status TEXT         NOT NULL DEFAULT 'not_requested',
    supported_languages    JSONB        NOT NULL DEFAULT '["ja"]'::jsonb,
    official_url           TEXT         NOT NULL DEFAULT '',
    source_title           TEXT         NOT NULL DEFAULT '',
    last_verified_at       DATE,
    active_from            DATE,
    active_until           DATE,
    notes                  TEXT         NOT NULL DEFAULT '',
    source_payload         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT invasive_reporting_contacts_role_chk
        CHECK (contact_role IN ('municipality','prefecture','national','regional_council','research_network','partner_api','other')),
    CONSTRAINT invasive_reporting_contacts_delivery_chk
        CHECK (delivery_mode IN ('email','external_form','phone','partner_api','none')),
    CONSTRAINT invasive_reporting_contacts_permission_chk
        CHECK (send_permission_status IN ('approved','pending','not_requested','denied','external_only','revoked'))
);

CREATE INDEX IF NOT EXISTS idx_invasive_reporting_contacts_jurisdiction
    ON invasive_reporting_contacts (jurisdiction_id);

CREATE INDEX IF NOT EXISTS idx_invasive_reporting_contacts_permission
    ON invasive_reporting_contacts (send_permission_status, delivery_mode);

CREATE TABLE IF NOT EXISTS invasive_reporting_rules (
    rule_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id           UUID         NOT NULL REFERENCES invasive_reporting_contacts(contact_id) ON DELETE CASCADE,
    jurisdiction_id      UUID         NOT NULL REFERENCES reporting_jurisdictions(jurisdiction_id) ON DELETE CASCADE,
    reporting_category   TEXT         NOT NULL,
    urgency              TEXT         NOT NULL DEFAULT 'normal',
    taxon_names          JSONB        NOT NULL DEFAULT '[]'::jsonb,
    mhlw_categories      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    required_fields      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    handling_warnings    JSONB        NOT NULL DEFAULT '[]'::jsonb,
    user_guidance_ja     TEXT         NOT NULL DEFAULT '',
    authority_guidance_ja TEXT        NOT NULL DEFAULT '',
    is_active            BOOLEAN      NOT NULL DEFAULT true,
    active_from          DATE,
    active_until         DATE,
    source_payload       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT invasive_reporting_rules_category_chk
        CHECK (reporting_category IN (
            'emergency_biosecurity',
            'sighting_report',
            'management_consultation',
            'illegal_activity',
            'time_limited_program'
        )),
    CONSTRAINT invasive_reporting_rules_urgency_chk
        CHECK (urgency IN ('urgent','normal','seasonal','reference'))
);

CREATE INDEX IF NOT EXISTS idx_invasive_reporting_rules_scope
    ON invasive_reporting_rules (jurisdiction_id, reporting_category)
    WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_invasive_reporting_rules_mhlw
    ON invasive_reporting_rules USING GIN (mhlw_categories);

CREATE INDEX IF NOT EXISTS idx_invasive_reporting_rules_taxa
    ON invasive_reporting_rules USING GIN (taxon_names);

CREATE TABLE IF NOT EXISTS invasive_reporting_events (
    event_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id     TEXT         REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    visit_id          TEXT         REFERENCES visits(visit_id) ON DELETE SET NULL,
    rule_id           UUID         REFERENCES invasive_reporting_rules(rule_id) ON DELETE SET NULL,
    contact_id        UUID         REFERENCES invasive_reporting_contacts(contact_id) ON DELETE SET NULL,
    recipient_id      UUID         REFERENCES alert_recipients(recipient_id) ON DELETE SET NULL,
    delivery_id       UUID         REFERENCES alert_deliveries(delivery_id) ON DELETE SET NULL,
    event_status      TEXT         NOT NULL,
    trigger_source    TEXT         NOT NULL DEFAULT 'ai_reassess',
    invasive_status   TEXT,
    payload_json      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    error_message     TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT invasive_reporting_events_status_chk
        CHECK (event_status IN ('candidate','suppressed_no_permission','pending_delivery','sent','failed'))
);

CREATE INDEX IF NOT EXISTS idx_invasive_reporting_events_occurrence
    ON invasive_reporting_events (occurrence_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invasive_reporting_events_delivery
    ON invasive_reporting_events (delivery_id)
    WHERE delivery_id IS NOT NULL;

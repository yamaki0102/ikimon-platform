-- Replace generic raw-usage filtering with a strict provider-usage metadata allowlist.
-- Prompt, response, tool payload, and arbitrary unknown keys are rejected.

CREATE OR REPLACE FUNCTION ai_usage_json_is_safe(value JSONB, depth INTEGER DEFAULT 0)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    item JSONB;
    key_name TEXT;
    normalized_key TEXT;
    value_type TEXT;
    item_count INTEGER;
    count_keys CONSTANT TEXT[] := ARRAY[
        'prompttokencount', 'candidatestokencount', 'thoughtstokencount',
        'cachedcontenttokencount', 'totaltokencount', 'tooluseprompttokencount',
        'tokencount', 'prompt_tokens', 'completion_tokens', 'total_tokens',
        'prompt_cache_hit_tokens', 'prompt_cache_miss_tokens', 'input_tokens',
        'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens',
        'cached_tokens', 'audio_tokens', 'reasoning_tokens',
        'accepted_prediction_tokens', 'rejected_prediction_tokens',
        'ephemeral_5m_input_tokens', 'ephemeral_1h_input_tokens'
    ];
    enum_keys CONSTANT TEXT[] := ARRAY['traffictype', 'modality', 'service_tier'];
    container_keys CONSTANT TEXT[] := ARRAY[
        'prompttokensdetails', 'cachetokensdetails', 'candidatestokensdetails',
        'tooluseprompttokensdetails', 'prompt_tokens_details',
        'completion_tokens_details', 'input_tokens_details', 'output_tokens_details',
        'cache_creation'
    ];
BEGIN
    IF depth > 6 THEN RETURN FALSE; END IF;

    CASE jsonb_typeof(value)
        WHEN 'object' THEN
            SELECT COUNT(*) INTO item_count FROM jsonb_each(value);
            IF item_count > 256 THEN RETURN FALSE; END IF;
            FOR key_name, item IN SELECT * FROM jsonb_each(value) LOOP
                normalized_key := lower(key_name);
                value_type := jsonb_typeof(item);
                IF normalized_key = ANY(count_keys) THEN
                    IF value_type NOT IN ('number', 'null') THEN RETURN FALSE; END IF;
                ELSIF normalized_key = ANY(enum_keys) THEN
                    IF value_type NOT IN ('string', 'null') THEN RETURN FALSE; END IF;
                    IF value_type = 'string' AND char_length(item #>> '{}') > 64 THEN RETURN FALSE; END IF;
                ELSIF normalized_key = ANY(container_keys) THEN
                    IF value_type NOT IN ('object', 'array', 'null') THEN RETURN FALSE; END IF;
                    IF value_type <> 'null' AND NOT ai_usage_json_is_safe(item, depth + 1) THEN RETURN FALSE; END IF;
                ELSE
                    RETURN FALSE;
                END IF;
            END LOOP;
        WHEN 'array' THEN
            IF jsonb_array_length(value) > 256 THEN RETURN FALSE; END IF;
            FOR item IN SELECT * FROM jsonb_array_elements(value) LOOP
                IF jsonb_typeof(item) NOT IN ('object', 'null') THEN RETURN FALSE; END IF;
                IF jsonb_typeof(item) <> 'null' AND NOT ai_usage_json_is_safe(item, depth + 1) THEN RETURN FALSE; END IF;
            END LOOP;
        ELSE
            RETURN FALSE;
    END CASE;
    RETURN TRUE;
END;
$$;

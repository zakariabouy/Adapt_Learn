-- 007_guardrails.sql: Audit logging for guardrail events + rate limit tracking

CREATE TABLE IF NOT EXISTS guardrail_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,           -- 'prompt_injection', 'content_safety', 'output_validation', 'rate_limit', 'hallucination'
    severity TEXT NOT NULL DEFAULT 'warning',  -- 'info', 'warning', 'critical'
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    endpoint TEXT,
    input_snippet TEXT,                 -- first 500 chars of offending input (redacted)
    output_snippet TEXT,                -- first 500 chars of offending output (redacted)
    details JSONB DEFAULT '{}',         -- structured details (matched patterns, scores, etc.)
    action_taken TEXT NOT NULL,         -- 'blocked', 'sanitized', 'flagged', 'passed'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardrail_events_type ON guardrail_events(event_type);
CREATE INDEX IF NOT EXISTS idx_guardrail_events_user ON guardrail_events(user_id);
CREATE INDEX IF NOT EXISTS idx_guardrail_events_created ON guardrail_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardrail_events_severity ON guardrail_events(severity) WHERE severity IN ('warning', 'critical');

-- Rate limit tracking (sliding window per user)
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint_group TEXT NOT NULL,       -- 'llm_call', 'upload', 'api_general'
    window_start TIMESTAMPTZ NOT NULL,
    request_count INT DEFAULT 1,
    PRIMARY KEY (user_id, endpoint_group, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_buckets(window_start);

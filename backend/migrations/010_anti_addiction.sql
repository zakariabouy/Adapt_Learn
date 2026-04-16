-- 010_anti_addiction.sql: Anti-addiction safeguards — session limits, usage tracking, forced breaks

-- Daily Usage Log (tracks cumulative screen time per student per day)
CREATE TABLE IF NOT EXISTS daily_usage_log (
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_minutes FLOAT DEFAULT 0,
    session_count INT DEFAULT 0,
    forced_breaks INT DEFAULT 0,
    last_session_start TIMESTAMPTZ,
    last_break_at TIMESTAMPTZ,
    PRIMARY KEY (student_id, usage_date)
);
CREATE INDEX IF NOT EXISTS idx_usage_log_date ON daily_usage_log(usage_date DESC);

-- Session Lock (active lock when a forced break is in effect)
CREATE TABLE IF NOT EXISTS session_locks (
    student_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    locked_until TIMESTAMPTZ NOT NULL,
    reason TEXT DEFAULT 'forced_break',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

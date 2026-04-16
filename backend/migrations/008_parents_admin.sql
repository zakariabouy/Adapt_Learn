-- 008_parents_admin.sql: Parent role, parental controls, custom rewards, onboarding, admin enhancements

-- Extend role CHECK to include 'parent'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'teacher', 'admin', 'parent'));

-- Parent-Child Link
CREATE TABLE IF NOT EXISTS parent_child_link (
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'parent',  -- 'parent', 'guardian', 'tutor'
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (parent_id, child_id)
);
CREATE INDEX IF NOT EXISTS idx_parent_child_parent ON parent_child_link(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_child ON parent_child_link(child_id);

-- Parent Onboarding Data (scientific child profiling by parent)
CREATE TABLE IF NOT EXISTS parent_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_birth_date DATE,
    known_conditions TEXT[],             -- e.g., ARRAY['dyslexia', 'ADHD', 'hearing_impairment']
    preferred_learning_time TEXT,        -- 'morning', 'afternoon', 'evening'
    attention_span_minutes INT,
    interests TEXT[],                    -- e.g., ARRAY['dinosaurs', 'space', 'drawing']
    languages_spoken TEXT[],
    additional_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_id, child_id)
);

-- Parental Controls
CREATE TABLE IF NOT EXISTS parental_controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    daily_time_limit_minutes INT DEFAULT 60,
    session_max_minutes INT DEFAULT 45,
    allowed_start_hour INT DEFAULT 8,      -- 24h format
    allowed_end_hour INT DEFAULT 20,
    break_interval_minutes INT DEFAULT 45,
    break_duration_minutes INT DEFAULT 10,
    allow_leaderboard BOOLEAN DEFAULT TRUE,
    allow_messaging BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_id, child_id)
);

-- Custom Gamification Rewards (parent-defined)
CREATE TABLE IF NOT EXISTS custom_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    xp_cost INT NOT NULL CHECK (xp_cost > 0),
    icon TEXT DEFAULT 'gift',             -- emoji or icon name
    is_active BOOLEAN DEFAULT TRUE,
    is_redeemed BOOLEAN DEFAULT FALSE,
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custom_rewards_child ON custom_rewards(child_id, is_active);

-- Classroom Rewards (teacher-defined)
CREATE TABLE IF NOT EXISTS classroom_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    xp_cost INT NOT NULL CHECK (xp_cost > 0),
    icon TEXT DEFAULT 'star',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reward Redemptions (tracks when students redeem rewards)
CREATE TABLE IF NOT EXISTS reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('custom', 'classroom')),
    reward_id UUID NOT NULL,
    xp_spent INT NOT NULL,
    redeemed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_redemptions_student ON reward_redemptions(student_id);

-- Teacher Corrections to AI profiles
CREATE TABLE IF NOT EXISTS teacher_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    correction_type TEXT NOT NULL,  -- 'profile_override', 'behavior_note', 'attention_span', 'tag_adjustment'
    data JSONB NOT NULL,
    applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_corrections_student ON teacher_corrections(student_id);

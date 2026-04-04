-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('student', 'teacher', 'admin')),
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learner Profiles (The Learner Model)
CREATE TABLE IF NOT EXISTS learner_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    profile_data JSONB NOT NULL,              -- Full LearnerModel as JSON
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id)
);

-- Content Items (Raw lessons uploaded by teachers)
CREATE TABLE IF NOT EXISTS content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES users(id),
    title TEXT NOT NULL,
    original_text TEXT NOT NULL,
    subject TEXT,
    grade_level INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adapted Content Cache
CREATE TABLE IF NOT EXISTS adapted_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_items(id),
    student_id UUID REFERENCES users(id),
    adaptation_config JSONB,                  -- The config used for this adaptation
    adapted_text TEXT,
    audio_url TEXT,
    diagram_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_id, student_id, md5(adaptation_config::text))
);

-- Learning Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id),
    content_id UUID REFERENCES content_items(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    telemetry_summary JSONB,                  -- Aggregated metrics
    adaptations_applied JSONB[]
);

-- Assessments (Quizzes)
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id),
    student_id UUID REFERENCES users(id),
    questions JSONB NOT NULL,
    responses JSONB NOT NULL,
    score FLOAT,
    theta_before FLOAT,
    theta_after FLOAT,
    taken_at TIMESTAMPTZ DEFAULT NOW()
);

-- IEP Reports (Teacher facing)
CREATE TABLE IF NOT EXISTS iep_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id),
    teacher_id UUID REFERENCES users(id),
    report_data JSONB NOT NULL,
    pdf_url TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    week TEXT                                 -- e.g., "2026-W14"
);

-- Migration 005_grade_level.sql
-- Tracking primary school grades (1 to 6) for students

-- Add grade_level to users (only applicable for students)
ALTER TABLE users ADD COLUMN IF NOT EXISTS grade_level INT CHECK (grade_level >= 1 AND grade_level <= 6);

-- Track multi-year progression history
CREATE TABLE IF NOT EXISTS grade_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    grade_level INT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    school_year TEXT, -- e.g., "2025-2026"
    UNIQUE(student_id, grade_level, school_year)
);

-- Update existing content_items to ensure grade_level is within 1-6 (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'content_items_grade_check'
    ) THEN
        ALTER TABLE content_items ADD CONSTRAINT content_items_grade_check
            CHECK (grade_level >= 1 AND grade_level <= 6);
    END IF;
END $$;

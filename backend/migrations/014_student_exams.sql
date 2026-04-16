-- Migration 009_student_exams.sql
-- Stores approved exams delivered to students via the HITL pipeline.
-- A teacher approves an exam in the pending_actions queue, which triggers
-- insertion here. This table is the student's exam inbox.

CREATE TABLE IF NOT EXISTS student_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id),
    content_id UUID REFERENCES content_items(id) ON DELETE SET NULL,
    pending_action_id UUID REFERENCES pending_actions(id),
    exam_data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (
        status IN ('assigned', 'in_progress', 'completed')
    ),
    score FLOAT,
    answers JSONB,
    theta_before FLOAT,
    theta_after FLOAT,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_student_exams_student
    ON student_exams(student_id, status, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_exams_teacher
    ON student_exams(teacher_id, assigned_at DESC);

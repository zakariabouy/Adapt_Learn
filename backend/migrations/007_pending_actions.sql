-- Migration 006_pending_actions.sql
-- Human-in-the-Loop: teacher approval workflow for high-risk AI outputs.
-- Agents enqueue artifacts here instead of delivering them directly; the
-- teacher reviews, then approves / rejects / modifies before anything
-- becomes visible to downstream consumers (students, parents).

CREATE TABLE IF NOT EXISTS pending_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL CHECK (
        action_type IN (
            'exam_generation',
            'orientation_report',
            'iep_report',
            'content_adaptation'
        )
    ),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content_items(id) ON DELETE SET NULL,
    payload JSONB NOT NULL,
    original_payload JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rejected', 'modified')
    ),
    reviewer_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_teacher_status
    ON pending_actions(teacher_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pending_actions_student
    ON pending_actions(student_id, created_at DESC);

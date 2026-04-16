-- 012_orientation.sql: Orientation reports with HITL teacher review

CREATE TABLE IF NOT EXISTS orientation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_data JSONB NOT NULL,
    input_context JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revised')),
    teacher_notes TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orientation_student ON orientation_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_orientation_status ON orientation_reports(status);

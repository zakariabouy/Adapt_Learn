-- Teacher-Student Relationship Join Table
CREATE TABLE IF NOT EXISTS teacher_student_link (
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (teacher_id, student_id)
);

-- Index for student lookups
CREATE INDEX IF NOT EXISTS idx_teacher_student_student ON teacher_student_link(student_id);

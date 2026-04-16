-- 009_communication_feedback.sql: Messaging, notifications, student & parent feedback

-- Messages (parent <-> teacher <-> admin communication)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,  -- for threading
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(parent_message_id);

-- Notifications (system-generated alerts)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,  -- 'badge_earned', 'session_complete', 'report_ready', 'message', 'reward_redeemed', 'feedback_received'
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',         -- extra structured data (links, IDs, etc.)
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- Student Feedback (after sessions — rates content & teacher)
CREATE TABLE IF NOT EXISTS student_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    content_id UUID REFERENCES content_items(id) ON DELETE SET NULL,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content_rating INT CHECK (content_rating BETWEEN 1 AND 5),
    teacher_rating INT CHECK (teacher_rating BETWEEN 1 AND 5),
    difficulty_feedback TEXT CHECK (difficulty_feedback IN ('too_easy', 'just_right', 'too_hard')),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_feedback_content ON student_feedback(content_id);
CREATE INDEX IF NOT EXISTS idx_student_feedback_teacher ON student_feedback(teacher_id);

-- Parent Issues & Feedback
CREATE TABLE IF NOT EXISTS parent_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issue_type TEXT NOT NULL CHECK (issue_type IN (
        'assessment_disagree', 'content_complaint', 'teacher_feedback',
        'technical_issue', 'safety_concern', 'general'
    )),
    target_id UUID,                   -- could be content_id, assessment_id, etc.
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
    response TEXT,                    -- teacher/admin response
    responded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_parent_issues_status ON parent_issues(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parent_issues_child ON parent_issues(child_id);

-- Content Reviews (Content Critic Agent output)
CREATE TABLE IF NOT EXISTS content_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    reviewer_type TEXT NOT NULL DEFAULT 'ai',  -- 'ai' or 'teacher'
    overall_score FLOAT,              -- 0.0 to 1.0
    feedback_markdown TEXT NOT NULL,
    issues JSONB DEFAULT '[]',        -- structured list of issues found
    suggestions JSONB DEFAULT '[]',   -- structured list of improvements
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_reviews_content ON content_reviews(content_id);

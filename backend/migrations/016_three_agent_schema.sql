-- Migration 016_three_agent_schema.sql
-- Restructure around the three-agent pipeline:
--   Agent 1 (Profiler)     — aggregates parent/teacher/child inputs → profile
--   Agent 2 (Personalizer) — profile + teacher content → child_content + quiz + parent_summary
--   Agent 3 (Critic)       — original vs personalized → accuracy report
--
-- HITL stays in pending_actions; delivered artifacts land in
-- personalization_deliveries after teacher approval. Child feedback is
-- captured structurally so Agent 2 can cycle on signal (not free text alone).

-- ─────────────────────────────────────────────────────────────────────────────
-- Teacher observations about a student (input for Agent 1)
-- One row per (teacher, student); teachers overwrite their own notes.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_observations (
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notes TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (teacher_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_observations_student
    ON teacher_observations(student_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Structured child feedback on delivered content.
-- Drives the Agent 2 feedback cycle: rating <= 3 triggers re-personalization.
-- Tags are a controlled vocabulary so the LLM gets discrete signals.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS child_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    delivery_id UUID,  -- FK added below after personalization_deliveries exists
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    tags TEXT[] NOT NULL DEFAULT '{}',  -- subset of: too_hard, too_easy, confusing, boring
    free_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_child_feedback_content
    ON child_feedback(content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_child_feedback_student
    ON child_feedback(student_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Approved personalization deliveries. One row per approved (student, content).
-- This is what the student and parent actually consume — raw agent output stays
-- in pending_actions until the teacher approves it.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personalization_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    pending_action_id UUID REFERENCES pending_actions(id) ON DELETE SET NULL,

    -- Agent 2 outputs
    child_content TEXT NOT NULL,
    quiz JSONB NOT NULL DEFAULT '[]',
    parent_summary TEXT NOT NULL,

    -- Agent 3 output (captured at approval time for audit)
    critic_report JSONB,

    -- Approval metadata
    approved_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- If the child's feedback triggered a re-personalization, this links the
    -- new delivery to the previous one so we can show the lineage.
    superseded_by UUID REFERENCES personalization_deliveries(id) ON DELETE SET NULL,

    UNIQUE (student_id, content_id, approved_at)
);

CREATE INDEX IF NOT EXISTS idx_personalization_deliveries_student_content
    ON personalization_deliveries(student_id, content_id, approved_at DESC);

-- Back-fill the FK on child_feedback now that personalization_deliveries exists.
ALTER TABLE child_feedback
    DROP CONSTRAINT IF EXISTS child_feedback_delivery_id_fkey;
ALTER TABLE child_feedback
    ADD CONSTRAINT child_feedback_delivery_id_fkey
    FOREIGN KEY (delivery_id) REFERENCES personalization_deliveries(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Extend pending_actions to allow the new 'personalization' action type.
-- The existing CHECK constraint is too strict; drop + re-add with the union.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE pending_actions
    DROP CONSTRAINT IF EXISTS pending_actions_action_type_check;

ALTER TABLE pending_actions
    ADD CONSTRAINT pending_actions_action_type_check
    CHECK (action_type IN (
        'exam_generation',
        'orientation_report',
        'iep_report',
        'content_adaptation',
        'personalization'
    ));

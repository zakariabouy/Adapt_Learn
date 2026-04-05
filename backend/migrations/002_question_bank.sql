-- Question Bank for IRT-Adaptive Assessments
-- Each question has a difficulty parameter (theta) on the IRT scale (-3.0 to +3.0)
-- and is linked to a content_item (subject/topic).

CREATE TABLE IF NOT EXISTS question_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    difficulty FLOAT NOT NULL DEFAULT 0.0,      -- IRT difficulty parameter (b): -3.0 (easy) to +3.0 (hard)
    discrimination FLOAT NOT NULL DEFAULT 1.0,  -- IRT discrimination parameter (a): higher = more discriminating
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,                      -- [{"id": "A", "label": "..."}, ...]
    correct_id TEXT NOT NULL,                    -- e.g. "A"
    hint TEXT,
    explanation TEXT,                            -- Shown after answering
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient difficulty-range queries per content/subject
CREATE INDEX IF NOT EXISTS idx_qbank_content_difficulty 
ON question_bank(content_id, difficulty);

CREATE INDEX IF NOT EXISTS idx_qbank_subject_difficulty 
ON question_bank(subject, difficulty);

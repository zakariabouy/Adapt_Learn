-- Migration 013_adventure.sql
-- Persist the Godot Adventure World state per student: which therapy pack the
-- parent/teacher assigned and which mission arrows the student has cleared.
-- The mini-games live in-engine; this table is just the server-of-record so
-- the iframe can reload fresh without losing progress, and so XP awards are
-- idempotent (one-XP-per-mission enforced on the server, not the browser).

CREATE TABLE IF NOT EXISTS student_adventure (
    student_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    -- 'dyslexia' | 'adhd' | 'autism' | 'anxiety' — matches PACKS in game_manager.gd.
    -- Default 'anxiety' because that's what the Godot autoload defaults to today.
    pack_id TEXT NOT NULL DEFAULT 'anxiety',
    -- Ordered list of mission IDs the student has completed (e.g. ["mw1","fr1"]).
    completed_missions JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_adventure_updated_at ON student_adventure(updated_at);

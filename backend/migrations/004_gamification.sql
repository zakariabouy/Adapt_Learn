-- Migration 004_gamification.sql
-- Gamification for primary school students (XP, levels, streaks, badges, leaderboard)

-- XP Logs: tracking every point earned
CREATE TABLE IF NOT EXISTS xp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    xp_amount INT NOT NULL,
    reason TEXT, -- e.g., 'quiz_perfect', 'daily_streak', 'course_complete'
    earned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student Stats: tracking current standing
CREATE TABLE IF NOT EXISTS student_gamification (
    student_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_xp INT DEFAULT 0,
    current_level INT DEFAULT 1,
    current_streak INT DEFAULT 0,
    max_streak INT DEFAULT 0,
    last_activity_date DATE,
    badges_unlocked JSONB DEFAULT '[]' -- Array of badge IDs/names
);

-- Badges Master Table
CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY, -- e.g., 'quiz_master_5'
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    requirement_xp INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leaderboard View: for class/global ranking
CREATE OR REPLACE VIEW leaderboard AS
SELECT 
    u.id as student_id,
    u.name,
    u.grade_level,
    sg.current_xp,
    sg.current_level,
    sg.current_streak,
    RANK() OVER (PARTITION BY u.grade_level ORDER BY sg.current_xp DESC) as grade_rank,
    RANK() OVER (ORDER BY sg.current_xp DESC) as global_rank
FROM users u
JOIN student_gamification sg ON u.id = sg.student_id
WHERE u.role = 'student';

-- Initialize badges
INSERT INTO badges (id, name, description, requirement_xp) VALUES
('explorer_1', 'Novice Explorer', 'Joined the AdaptLearn adventure!', 0),
('smarty_100', 'Smarty Pants', 'Earned your first 100 XP!', 100),
('streak_3', 'Flame On', 'Kept a 3-day learning streak!', 300),
('quiz_ace', 'Quiz Ace', 'Got a perfect score on a quiz!', 500)
ON CONFLICT (id) DO NOTHING;

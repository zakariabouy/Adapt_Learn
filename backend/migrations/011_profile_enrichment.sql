-- 011_profile_enrichment.sql: Add personal data columns to parent_onboarding

ALTER TABLE parent_onboarding ADD COLUMN IF NOT EXISTS favorite_color TEXT;
ALTER TABLE parent_onboarding ADD COLUMN IF NOT EXISTS favorite_subject TEXT;
ALTER TABLE parent_onboarding ADD COLUMN IF NOT EXISTS favorite_animal TEXT;
ALTER TABLE parent_onboarding ADD COLUMN IF NOT EXISTS hobbies TEXT[];
ALTER TABLE parent_onboarding ADD COLUMN IF NOT EXISTS personality_observations TEXT[];

ALTER TABLE competitions ADD COLUMN IF NOT EXISTS bracket_slots jsonb DEFAULT '{}'::jsonb;

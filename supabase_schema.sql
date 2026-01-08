-- Party Matchmaker Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== Events Table ====================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  host_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast code lookup
CREATE INDEX IF NOT EXISTS idx_events_code ON events(code);

-- ==================== Guests Table ====================
CREATE TABLE IF NOT EXISTS guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  nickname VARCHAR(100) NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, nickname)
);

-- Index for event lookup
CREATE INDEX IF NOT EXISTS idx_guests_event_id ON guests(event_id);

-- ==================== Questions Table ====================
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  question_type VARCHAR(50) DEFAULT 'multiple_choice',
  options JSONB,
  order_index INT DEFAULT 0
);

-- Index for event lookup and ordering
CREATE INDEX IF NOT EXISTS idx_questions_event_id ON questions(event_id);

-- ==================== Row Level Security (RLS) ====================
-- Enable RLS but allow all operations for now (you can tighten this later)

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (makes schema re-runnable)
DROP POLICY IF EXISTS "Allow all operations on events" ON events;
DROP POLICY IF EXISTS "Allow all operations on guests" ON guests;
DROP POLICY IF EXISTS "Allow all operations on questions" ON questions;

-- Policy: Allow all operations for now (open access for MVP)
CREATE POLICY "Allow all operations on events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on guests" ON guests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on questions" ON questions FOR ALL USING (true) WITH CHECK (true);

-- ==================== Responses Table ====================
CREATE TABLE IF NOT EXISTS responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guest_id, question_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_responses_guest_id ON responses(guest_id);
CREATE INDEX IF NOT EXISTS idx_responses_question_id ON responses(question_id);

-- ==================== Matches Table ====================
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  guest_a_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  guest_b_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  score FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for event and guest lookups
CREATE INDEX IF NOT EXISTS idx_matches_event_id ON matches(event_id);
CREATE INDEX IF NOT EXISTS idx_matches_guest_a ON matches(guest_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_guest_b ON matches(guest_b_id);

-- ==================== Add matching_completed to events ====================
ALTER TABLE events ADD COLUMN IF NOT EXISTS matching_completed BOOLEAN DEFAULT FALSE;

-- ==================== Add host_user_id and matches_revealed to events ====================
ALTER TABLE events ADD COLUMN IF NOT EXISTS host_user_id UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS matches_revealed BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_events_host ON events(host_user_id);

-- ==================== Host Settings ====================
ALTER TABLE events ADD COLUMN IF NOT EXISTS matching_mode VARCHAR(20) DEFAULT 'any';
ALTER TABLE events ADD COLUMN IF NOT EXISTS matches_per_guest INT DEFAULT 1;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type VARCHAR(20) DEFAULT 'party';

-- ==================== Guest Profile ====================
ALTER TABLE guests ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS looking_for VARCHAR(20);

-- ==================== RLS for new tables ====================
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on responses" ON responses;
DROP POLICY IF EXISTS "Allow all operations on matches" ON matches;

CREATE POLICY "Allow all operations on responses" ON responses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on matches" ON matches FOR ALL USING (true) WITH CHECK (true);

-- ==================== Sample Data (Optional) ====================
-- Uncomment to insert sample data for testing

-- INSERT INTO events (code, name, host_name) VALUES ('TEST01', 'Test Party', 'Demo Host');

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

-- ==================== Messages Table ====================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for real-time subscriptions by match
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy (Open for MVP)
DROP POLICY IF EXISTS "Allow all operations on messages" ON messages;
CREATE POLICY "Allow all operations on messages" ON messages FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for this table
-- Note: You may need to run this separately or ensure your user has permissions
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE events, messages;
COMMIT;
-- Alternatively, if publication exists:

-- ==================== User Profiles (Sync with Auth) ====================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, email)
  VALUES (new.id, new.raw_user_meta_data->>'first_name', new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

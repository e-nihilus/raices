CREATE TABLE IF NOT EXISTS families (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS family_members (family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, PRIMARY KEY(family_id,user_id));
CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE, title TEXT NOT NULL, created_at TEXT NOT NULL, duration REAL NOT NULL DEFAULT 0, status TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', error TEXT, audio_path TEXT NOT NULL, mime_type TEXT NOT NULL, bookmarks TEXT NOT NULL DEFAULT '[]', extraction TEXT);
CREATE TABLE IF NOT EXISTS people (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE, name TEXT NOT NULL, aliases TEXT NOT NULL DEFAULT '[]', candidate_ids TEXT NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS segments (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, start_time REAL NOT NULL, end_time REAL NOT NULL, text TEXT NOT NULL, speaker TEXT);
CREATE TABLE IF NOT EXISTS claims (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, person_id TEXT REFERENCES people(id) ON DELETE SET NULL, segment_id TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE, quote TEXT NOT NULL, statement TEXT NOT NULL, certainty TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS relationships (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE, person_a TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE, person_b TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE, type TEXT NOT NULL, claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, description TEXT NOT NULL, type TEXT NOT NULL, year INTEGER, place TEXT, certainty TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS event_people (event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE, PRIMARY KEY(event_id,person_id));
CREATE TABLE IF NOT EXISTS event_claims (event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE, PRIMARY KEY(event_id,claim_id));
CREATE TABLE IF NOT EXISTS processing_jobs (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, available_at TEXT NOT NULL, lease_until TEXT, error TEXT);
CREATE INDEX IF NOT EXISTS conversations_family ON conversations(family_id,created_at);
CREATE INDEX IF NOT EXISTS people_family ON people(family_id);
CREATE INDEX IF NOT EXISTS segments_conversation ON segments(conversation_id,start_time);
CREATE INDEX IF NOT EXISTS claims_conversation ON claims(conversation_id);
CREATE INDEX IF NOT EXISTS events_conversation ON events(conversation_id);
CREATE INDEX IF NOT EXISTS jobs_pending ON processing_jobs(status,available_at);

-- Keep private families visible only to their authenticated members.
CREATE OR REPLACE FUNCTION public.is_family_member(family TEXT) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.family_members WHERE family_id=family AND user_id=auth.uid()); $$;
REVOKE ALL ON FUNCTION public.is_family_member(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_family_member(TEXT) TO authenticated;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.families FROM anon, authenticated;
GRANT SELECT ON public.families TO authenticated;
CREATE POLICY "family_read_families" ON public.families FOR SELECT TO authenticated USING (public.is_family_member(id));
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_members FROM anon, authenticated;
GRANT SELECT ON public.family_members TO authenticated;
CREATE POLICY "family_read_family_members" ON public.family_members FOR SELECT TO authenticated USING (user_id=auth.uid());
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversations FROM anon, authenticated;
GRANT SELECT ON public.conversations TO authenticated;
CREATE POLICY "family_read_conversations" ON public.conversations FOR SELECT TO authenticated USING (public.is_family_member(family_id));
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.people FROM anon, authenticated;
GRANT SELECT ON public.people TO authenticated;
CREATE POLICY "family_read_people" ON public.people FOR SELECT TO authenticated USING (public.is_family_member(family_id));
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.relationships FROM anon, authenticated;
GRANT SELECT ON public.relationships TO authenticated;
CREATE POLICY "family_read_relationships" ON public.relationships FOR SELECT TO authenticated USING (public.is_family_member(family_id));
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.segments FROM anon, authenticated;
GRANT SELECT ON public.segments TO authenticated;
CREATE POLICY "family_read_segments" ON public.segments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id=conversation_id AND public.is_family_member(c.family_id)));
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.claims FROM anon, authenticated;
GRANT SELECT ON public.claims TO authenticated;
CREATE POLICY "family_read_claims" ON public.claims FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id=conversation_id AND public.is_family_member(c.family_id)));
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.events FROM anon, authenticated;
GRANT SELECT ON public.events TO authenticated;
CREATE POLICY "family_read_events" ON public.events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id=conversation_id AND public.is_family_member(c.family_id)));
ALTER TABLE public.event_people ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_people FROM anon, authenticated;
GRANT SELECT ON public.event_people TO authenticated;
CREATE POLICY "family_read_event_people" ON public.event_people FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e JOIN public.conversations c ON c.id=e.conversation_id WHERE e.id=event_id AND public.is_family_member(c.family_id)));
ALTER TABLE public.event_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_claims FROM anon, authenticated;
GRANT SELECT ON public.event_claims TO authenticated;
CREATE POLICY "family_read_event_claims" ON public.event_claims FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e JOIN public.conversations c ON c.id=e.conversation_id WHERE e.id=event_id AND public.is_family_member(c.family_id)));

ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.processing_jobs FROM anon, authenticated;
-- Backend writes use a dedicated database connection; no client write policies.
INSERT INTO storage.buckets(id,name,public,file_size_limit)
VALUES ('family-audio','family-audio',false,104857600) ON CONFLICT(id) DO NOTHING;
CREATE POLICY "family_audio_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='family-audio' AND public.is_family_member((storage.foldername(name))[1]));

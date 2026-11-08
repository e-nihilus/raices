CREATE TABLE IF NOT EXISTS public.person_source_searches (id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES public.families(id) ON DELETE CASCADE, person_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE, query TEXT NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS person_source_searches_person ON public.person_source_searches(family_id,person_id,created_at);
ALTER TABLE public.person_source_searches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.person_source_searches FROM anon, authenticated;

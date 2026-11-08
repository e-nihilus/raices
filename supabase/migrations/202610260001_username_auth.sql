-- Username-only accounts are authenticated by the API. Existing Supabase Auth
-- memberships and their foreign key remain unchanged.
CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS public.app_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_sessions_user ON public.app_sessions(user_id);
CREATE TABLE IF NOT EXISTS public.app_family_members (
  family_id TEXT NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  PRIMARY KEY(family_id,user_id)
);
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_family_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_users, public.app_sessions, public.app_family_members FROM anon, authenticated;

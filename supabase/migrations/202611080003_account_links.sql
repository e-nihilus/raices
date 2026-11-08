CREATE TABLE IF NOT EXISTS public.account_profiles (user_id UUID PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE, first_name TEXT NOT NULL, surname1 TEXT NOT NULL, surname2 TEXT NOT NULL, discoverable INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS public.family_link_requests (id TEXT PRIMARY KEY, sender_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE, recipient_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE, person_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE, relationship TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
ALTER TABLE public.account_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_link_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_profiles, public.family_link_requests FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.shared_tree_people (user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE, person_id TEXT NOT NULL REFERENCES public.people(id) ON DELETE CASCADE, PRIMARY KEY(user_id,person_id));
ALTER TABLE public.shared_tree_people ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shared_tree_people FROM anon, authenticated;

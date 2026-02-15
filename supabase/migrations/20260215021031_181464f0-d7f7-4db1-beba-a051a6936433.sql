
-- Add link column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS link text;

-- Create profile_highlights table
CREATE TABLE public.profile_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);
ALTER TABLE public.profile_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view highlights" ON public.profile_highlights FOR SELECT USING (true);
CREATE POLICY "Users manage own highlights" ON public.profile_highlights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own highlights" ON public.profile_highlights FOR DELETE USING (auth.uid() = user_id);

-- Create clips table
CREATE TABLE public.clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  media_url text NOT NULL,
  thumbnail_url text,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view clips" ON public.clips FOR SELECT USING (true);
CREATE POLICY "Users create own clips" ON public.clips FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users delete own clips" ON public.clips FOR DELETE USING (auth.uid() = author_id);

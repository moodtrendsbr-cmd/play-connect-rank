
-- Table: follows
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- Table: hashtags
CREATE TABLE public.hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hashtags" ON public.hashtags FOR SELECT USING (true);
CREATE POLICY "Auth users can insert hashtags" ON public.hashtags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Table: post_hashtags
CREATE TABLE public.post_hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  UNIQUE(post_id, hashtag_id)
);
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view post_hashtags" ON public.post_hashtags FOR SELECT USING (true);
CREATE POLICY "Post authors can insert post_hashtags" ON public.post_hashtags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid())
);

-- Table: hashtag_searches
CREATE TABLE public.hashtag_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hashtag_id uuid REFERENCES public.hashtags(id) ON DELETE CASCADE,
  searched_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hashtag_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hashtag_searches" ON public.hashtag_searches FOR SELECT USING (true);
CREATE POLICY "Auth users can insert hashtag_searches" ON public.hashtag_searches FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Add columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS titles text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_contact boolean DEFAULT false;

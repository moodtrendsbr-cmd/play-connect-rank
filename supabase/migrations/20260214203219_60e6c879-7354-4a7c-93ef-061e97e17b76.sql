
-- ENUM TYPES
CREATE TYPE public.app_role AS ENUM ('organizer', 'athlete');
CREATE TYPE public.tournament_category AS ENUM ('masculino', 'feminino', 'misto');
CREATE TYPE public.tournament_type AS ENUM ('individual', 'duplas', 'equipes');
CREATE TYPE public.enrollment_status AS ENUM ('pending', 'paid', 'expired');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  city TEXT,
  state TEXT,
  whatsapp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- TOURNAMENTS
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category public.tournament_category NOT NULL DEFAULT 'misto',
  type public.tournament_type NOT NULL DEFAULT 'individual',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  address TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  entry_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_slots INTEGER NOT NULL DEFAULT 16,
  payment_deadline_days INTEGER NOT NULL DEFAULT 3,
  rules TEXT,
  image_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- ENROLLMENTS
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status public.enrollment_status NOT NULL DEFAULT 'pending',
  payment_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- MATCH RESULTS
CREATE TABLE public.match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  match_number INTEGER NOT NULL DEFAULT 1,
  player1_id UUID REFERENCES auth.users(id),
  player2_id UUID REFERENCES auth.users(id),
  score1 INTEGER,
  score2 INTEGER,
  winner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

-- POSTS
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'manual',
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- COMMENTS
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- LIKES
CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id),
  UNIQUE (user_id, comment_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_tournament_owner(_tournament_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.tournaments WHERE id = _tournament_id AND organizer_id = _user_id) $$;

-- UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tournaments_updated BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_enrollments_updated BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_match_results_updated BEFORE UPDATE ON public.match_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'athlete'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: profiles
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS: user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- RLS: tournaments
CREATE POLICY "Public tournaments visible" ON public.tournaments FOR SELECT USING (is_public = true OR organizer_id = auth.uid());
CREATE POLICY "Organizers create tournaments" ON public.tournaments FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'organizer') AND auth.uid() = organizer_id);
CREATE POLICY "Organizers update own" ON public.tournaments FOR UPDATE USING (auth.uid() = organizer_id);
CREATE POLICY "Organizers delete own" ON public.tournaments FOR DELETE USING (auth.uid() = organizer_id);

-- RLS: enrollments
CREATE POLICY "View enrollments" ON public.enrollments FOR SELECT USING (user_id = auth.uid() OR public.is_tournament_owner(tournament_id, auth.uid()));
CREATE POLICY "Athletes enroll" ON public.enrollments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Manage enrollment" ON public.enrollments FOR UPDATE USING (user_id = auth.uid() OR public.is_tournament_owner(tournament_id, auth.uid()));
CREATE POLICY "Cancel enrollment" ON public.enrollments FOR DELETE USING (auth.uid() = user_id);

-- RLS: match_results
CREATE POLICY "View matches" ON public.match_results FOR SELECT USING (
  public.is_tournament_owner(tournament_id, auth.uid()) OR EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND is_public = true)
);
CREATE POLICY "Organizers insert matches" ON public.match_results FOR INSERT WITH CHECK (public.is_tournament_owner(tournament_id, auth.uid()));
CREATE POLICY "Organizers update matches" ON public.match_results FOR UPDATE USING (public.is_tournament_owner(tournament_id, auth.uid()));
CREATE POLICY "Organizers delete matches" ON public.match_results FOR DELETE USING (public.is_tournament_owner(tournament_id, auth.uid()));

-- RLS: posts
CREATE POLICY "Anyone view posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Auth create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors update posts" ON public.posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors delete posts" ON public.posts FOR DELETE USING (auth.uid() = author_id);

-- RLS: comments
CREATE POLICY "Anyone view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Auth create comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors update comments" ON public.comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors delete comments" ON public.comments FOR DELETE USING (auth.uid() = author_id);

-- RLS: likes
CREATE POLICY "Anyone view likes" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Auth create likes" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('tournament-images', 'tournament-images', true);
CREATE POLICY "View tournament images" ON storage.objects FOR SELECT USING (bucket_id = 'tournament-images');
CREATE POLICY "Upload tournament images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tournament-images' AND auth.role() = 'authenticated');
CREATE POLICY "Update tournament images" ON storage.objects FOR UPDATE USING (bucket_id = 'tournament-images' AND auth.role() = 'authenticated');
CREATE POLICY "Delete tournament images" ON storage.objects FOR DELETE USING (bucket_id = 'tournament-images' AND auth.role() = 'authenticated');

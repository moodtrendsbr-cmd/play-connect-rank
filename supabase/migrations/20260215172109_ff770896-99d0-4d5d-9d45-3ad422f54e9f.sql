
-- Add match_enabled to tournaments
ALTER TABLE public.tournaments ADD COLUMN match_enabled boolean NOT NULL DEFAULT false;

-- tournament_match_pool
CREATE TABLE public.tournament_match_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  match_type text NOT NULL DEFAULT 'dupla',
  category text NOT NULL DEFAULT 'misto',
  level text NOT NULL DEFAULT 'iniciante',
  position text,
  availability text,
  bio text,
  status text NOT NULL DEFAULT 'looking',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);
ALTER TABLE public.tournament_match_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view match pool" ON public.tournament_match_pool FOR SELECT USING (true);
CREATE POLICY "Users insert own pool entry" ON public.tournament_match_pool FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pool entry" ON public.tournament_match_pool FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own pool entry" ON public.tournament_match_pool FOR DELETE USING (auth.uid() = user_id);

-- match_requests
CREATE TABLE public.match_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.match_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view match requests" ON public.match_requests FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Users send match requests" ON public.match_requests FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Receiver updates match requests" ON public.match_requests FOR UPDATE USING (auth.uid() = to_user_id);

-- match_pairs
CREATE TABLE public.match_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_type text NOT NULL DEFAULT 'dupla',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.match_pairs ENABLE ROW LEVEL SECURITY;

-- match_pair_members
CREATE TABLE public.match_pair_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.match_pairs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
);
ALTER TABLE public.match_pair_members ENABLE ROW LEVEL SECURITY;

-- Security definer function for pair membership
CREATE OR REPLACE FUNCTION public.is_pair_member(_pair_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.match_pair_members WHERE pair_id = _pair_id AND user_id = _user_id)
$$;

CREATE POLICY "Members view match pairs" ON public.match_pairs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.match_pair_members WHERE pair_id = id AND user_id = auth.uid())
);
CREATE POLICY "Members view pair members" ON public.match_pair_members FOR SELECT USING (
  is_pair_member(pair_id, auth.uid())
);
CREATE POLICY "Auth users insert pair members" ON public.match_pair_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users insert pairs" ON public.match_pairs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- match_conversations
CREATE TABLE public.match_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid REFERENCES public.match_pairs(id) ON DELETE SET NULL,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.match_conversations ENABLE ROW LEVEL SECURITY;

-- match_conversation_members
CREATE TABLE public.match_conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.match_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
);
ALTER TABLE public.match_conversation_members ENABLE ROW LEVEL SECURITY;

-- Security definer for conversation membership
CREATE OR REPLACE FUNCTION public.is_match_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.match_conversation_members WHERE conversation_id = _conversation_id AND user_id = _user_id)
$$;

CREATE POLICY "Members view match conversations" ON public.match_conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.match_conversation_members WHERE conversation_id = id AND user_id = auth.uid())
);
CREATE POLICY "Auth users insert match conversations" ON public.match_conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Members view conversation members" ON public.match_conversation_members FOR SELECT USING (
  is_match_conversation_member(conversation_id, auth.uid())
);
CREATE POLICY "Auth users insert conversation members" ON public.match_conversation_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- match_messages
CREATE TABLE public.match_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.match_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
ALTER TABLE public.match_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view match messages" ON public.match_messages FOR SELECT USING (
  is_match_conversation_member(conversation_id, auth.uid())
);
CREATE POLICY "Members send match messages" ON public.match_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND is_match_conversation_member(conversation_id, auth.uid())
);
CREATE POLICY "Members update match messages" ON public.match_messages FOR UPDATE USING (
  is_match_conversation_member(conversation_id, auth.uid())
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_requests;


-- 1. tournament_modalities (create table FIRST)
CREATE TABLE public.tournament_modalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'dupla',
  status text NOT NULL DEFAULT 'open',
  bracket_format text NOT NULL DEFAULT 'single_elimination',
  num_groups integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tournament_modalities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view modalities" ON public.tournament_modalities FOR SELECT USING (true);
CREATE POLICY "Owner insert modalities" ON public.tournament_modalities FOR INSERT WITH CHECK (is_tournament_owner(tournament_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Owner update modalities" ON public.tournament_modalities FOR UPDATE USING (is_tournament_owner(tournament_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Owner delete modalities" ON public.tournament_modalities FOR DELETE USING (is_tournament_owner(tournament_id, auth.uid()) OR is_admin(auth.uid()));

-- Helper function (NOW table exists)
CREATE OR REPLACE FUNCTION public.is_modality_tournament_owner(_modality_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_modalities tm
    JOIN public.tournaments t ON t.id = tm.tournament_id
    WHERE tm.id = _modality_id AND t.organizer_id = _user_id
  )
$$;

-- 2. modality_entries
CREATE TABLE public.modality_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modality_id uuid NOT NULL REFERENCES public.tournament_modalities(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  seed integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.modality_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view entries" ON public.modality_entries FOR SELECT USING (true);
CREATE POLICY "Owner insert entries" ON public.modality_entries FOR INSERT WITH CHECK (is_modality_tournament_owner(modality_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Owner update entries" ON public.modality_entries FOR UPDATE USING (is_modality_tournament_owner(modality_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Owner delete entries" ON public.modality_entries FOR DELETE USING (is_modality_tournament_owner(modality_id, auth.uid()) OR is_admin(auth.uid()));

-- 3. modality_entry_members
CREATE TABLE public.modality_entry_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.modality_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
);
ALTER TABLE public.modality_entry_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view entry members" ON public.modality_entry_members FOR SELECT USING (true);
CREATE POLICY "Owner insert entry members" ON public.modality_entry_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.modality_entries me WHERE me.id = entry_id AND is_modality_tournament_owner(me.modality_id, auth.uid()))
  OR is_admin(auth.uid())
);
CREATE POLICY "Owner delete entry members" ON public.modality_entry_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.modality_entries me WHERE me.id = entry_id AND is_modality_tournament_owner(me.modality_id, auth.uid()))
  OR is_admin(auth.uid())
);

-- 4. modality_groups
CREATE TABLE public.modality_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modality_id uuid NOT NULL REFERENCES public.tournament_modalities(id) ON DELETE CASCADE,
  group_name text NOT NULL DEFAULT 'A'
);
ALTER TABLE public.modality_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view groups" ON public.modality_groups FOR SELECT USING (true);
CREATE POLICY "Owner insert groups" ON public.modality_groups FOR INSERT WITH CHECK (is_modality_tournament_owner(modality_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Owner delete groups" ON public.modality_groups FOR DELETE USING (is_modality_tournament_owner(modality_id, auth.uid()) OR is_admin(auth.uid()));

-- 5. modality_group_members
CREATE TABLE public.modality_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.modality_groups(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES public.modality_entries(id) ON DELETE CASCADE
);
ALTER TABLE public.modality_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view group members" ON public.modality_group_members FOR SELECT USING (true);
CREATE POLICY "Owner insert group members" ON public.modality_group_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.modality_groups mg WHERE mg.id = group_id AND is_modality_tournament_owner(mg.modality_id, auth.uid()))
  OR is_admin(auth.uid())
);
CREATE POLICY "Owner delete group members" ON public.modality_group_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.modality_groups mg WHERE mg.id = group_id AND is_modality_tournament_owner(mg.modality_id, auth.uid()))
  OR is_admin(auth.uid())
);

-- 6. modality_matches
CREATE TABLE public.modality_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modality_id uuid NOT NULL REFERENCES public.tournament_modalities(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.modality_groups(id) ON DELETE SET NULL,
  round_number integer NOT NULL DEFAULT 1,
  match_number integer NOT NULL DEFAULT 1,
  entry_a_id uuid REFERENCES public.modality_entries(id) ON DELETE SET NULL,
  entry_b_id uuid REFERENCES public.modality_entries(id) ON DELETE SET NULL,
  score_a integer,
  score_b integer,
  winner_entry_id uuid REFERENCES public.modality_entries(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.modality_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view matches" ON public.modality_matches FOR SELECT USING (true);
CREATE POLICY "Owner insert matches" ON public.modality_matches FOR INSERT WITH CHECK (is_modality_tournament_owner(modality_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Owner update matches" ON public.modality_matches FOR UPDATE USING (is_modality_tournament_owner(modality_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Owner delete matches" ON public.modality_matches FOR DELETE USING (is_modality_tournament_owner(modality_id, auth.uid()) OR is_admin(auth.uid()));

-- 7. modality_placements
CREATE TABLE public.modality_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modality_id uuid NOT NULL REFERENCES public.tournament_modalities(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES public.modality_entries(id) ON DELETE CASCADE,
  position integer NOT NULL
);
ALTER TABLE public.modality_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view placements" ON public.modality_placements FOR SELECT USING (true);
CREATE POLICY "Owner insert placements" ON public.modality_placements FOR INSERT WITH CHECK (is_modality_tournament_owner(modality_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Owner update placements" ON public.modality_placements FOR UPDATE USING (is_modality_tournament_owner(modality_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Owner delete placements" ON public.modality_placements FOR DELETE USING (is_modality_tournament_owner(modality_id, auth.uid()) OR is_admin(auth.uid()));

-- 8. modality_prizes
CREATE TABLE public.modality_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modality_id uuid NOT NULL REFERENCES public.tournament_modalities(id) ON DELETE CASCADE,
  position integer NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text
);
ALTER TABLE public.modality_prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view prizes" ON public.modality_prizes FOR SELECT USING (true);
CREATE POLICY "Owner insert prizes" ON public.modality_prizes FOR INSERT WITH CHECK (is_modality_tournament_owner(modality_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Owner update prizes" ON public.modality_prizes FOR UPDATE USING (is_modality_tournament_owner(modality_id, auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Owner delete prizes" ON public.modality_prizes FOR DELETE USING (is_modality_tournament_owner(modality_id, auth.uid()) OR is_admin(auth.uid()));


-- Drop existing restrictive SELECT policies on match_results
DROP POLICY IF EXISTS "Admin view all matches" ON public.match_results;
DROP POLICY IF EXISTS "View matches" ON public.match_results;

-- Recreate as PERMISSIVE (default) so any ONE passing is sufficient
CREATE POLICY "Admin view all matches"
  ON public.match_results FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Public view matches of public tournaments"
  ON public.match_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tournaments
    WHERE tournaments.id = match_results.tournament_id
    AND tournaments.is_public = true
  ));

CREATE POLICY "Organizers view own tournament matches"
  ON public.match_results FOR SELECT
  USING (is_tournament_owner(tournament_id, auth.uid()));


-- Add payer_id and athlete info fields to enrollments for third-party enrollment
ALTER TABLE public.enrollments ADD COLUMN payer_id UUID REFERENCES auth.users(id);
ALTER TABLE public.enrollments ADD COLUMN athlete_name TEXT;
ALTER TABLE public.enrollments ADD COLUMN athlete_email TEXT;
ALTER TABLE public.enrollments ADD COLUMN athlete_whatsapp TEXT;

-- Remove unique constraint on (tournament_id, user_id) to allow payer to enroll multiple athletes
-- user_id can be null for non-registered athletes
ALTER TABLE public.enrollments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.enrollments DROP CONSTRAINT enrollments_tournament_id_user_id_key;

-- Update RLS to allow payer to see their enrollments too
DROP POLICY IF EXISTS "View enrollments" ON public.enrollments;
CREATE POLICY "View enrollments" ON public.enrollments FOR SELECT USING (
  user_id = auth.uid() OR payer_id = auth.uid() OR public.is_tournament_owner(tournament_id, auth.uid())
);

DROP POLICY IF EXISTS "Athletes can enroll" ON public.enrollments;
CREATE POLICY "Users can enroll" ON public.enrollments FOR INSERT WITH CHECK (
  auth.uid() = payer_id OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "Manage enrollment" ON public.enrollments;
CREATE POLICY "Manage enrollment" ON public.enrollments FOR UPDATE USING (
  payer_id = auth.uid() OR user_id = auth.uid() OR public.is_tournament_owner(tournament_id, auth.uid())
);

DROP POLICY IF EXISTS "Cancel enrollment" ON public.enrollments;
CREATE POLICY "Cancel enrollment" ON public.enrollments FOR DELETE USING (
  payer_id = auth.uid() OR user_id = auth.uid()
);

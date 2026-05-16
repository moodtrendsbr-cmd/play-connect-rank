
-- Allow 'tournament.won' activity type so champion event reaches the feed
ALTER TABLE public.athlete_activities DROP CONSTRAINT IF EXISTS athlete_activities_activity_type_check;
ALTER TABLE public.athlete_activities ADD CONSTRAINT athlete_activities_activity_type_check
  CHECK (activity_type = ANY (ARRAY[
    'tournament.enrolled','tournament.checked_in','tournament.match_won','tournament.match_lost',
    'tournament.placed','tournament.won',
    'class.attended','class.enrolled','social.posted','social.clip_posted'
  ]));

-- Backfill the champion activity for any modality that already has a 1st-place placement but no tournament.won activity
INSERT INTO public.athlete_activities (athlete_id, tenant_id, activity_type, reference_type, reference_id, metadata)
SELECT mem.user_id, mp.tenant_id, 'tournament.won', 'tournament', tm.tournament_id,
       jsonb_build_object('modality_id', mp.modality_id, 'position', 1)
FROM public.modality_placements mp
JOIN public.tournament_modalities tm ON tm.id = mp.modality_id
JOIN public.modality_entry_members mem ON mem.entry_id = mp.entry_id
WHERE mp.position = 1 AND mem.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.athlete_activities a
    WHERE a.athlete_id = mem.user_id
      AND a.activity_type = 'tournament.won'
      AND a.reference_id = tm.tournament_id
  );

ALTER TABLE public.tournament_modalities
  ADD COLUMN IF NOT EXISTS max_entries int,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS sets_to_win int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS points_per_set int DEFAULT 21,
  ADD COLUMN IF NOT EXISTS sport text DEFAULT 'Vôlei',
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE public.modality_matches
  ADD COLUMN IF NOT EXISTS court_id uuid;
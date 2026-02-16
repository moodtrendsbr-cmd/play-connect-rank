
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS modality text DEFAULT 'Vôlei de Praia',
  ADD COLUMN IF NOT EXISTS gender text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS arena text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS entry_fee_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entry_fee_3 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rules_file_url text,
  ADD COLUMN IF NOT EXISTS slot_config jsonb DEFAULT '[]';

INSERT INTO storage.buckets (id, name, public)
VALUES ('tournament-files', 'tournament-files', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Auth users upload tournament files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tournament-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Public view tournament files"
ON storage.objects FOR SELECT
USING (bucket_id = 'tournament-files');

-- 1. enrollments.entry_id
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS entry_id uuid REFERENCES public.modality_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_entry_id ON public.enrollments(entry_id) WHERE entry_id IS NOT NULL;

-- 2. modality_matches: source links for auto-advance
ALTER TABLE public.modality_matches
  ADD COLUMN IF NOT EXISTS source_a_match_id uuid REFERENCES public.modality_matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_b_match_id uuid REFERENCES public.modality_matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_a_role text CHECK (source_a_role IN ('winner','loser')),
  ADD COLUMN IF NOT EXISTS source_b_role text CHECK (source_b_role IN ('winner','loser')),
  ADD COLUMN IF NOT EXISTS bracket_side text CHECK (bracket_side IN ('winners','losers','final'));

CREATE INDEX IF NOT EXISTS idx_modality_matches_source_a ON public.modality_matches(source_a_match_id) WHERE source_a_match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_modality_matches_source_b ON public.modality_matches(source_b_match_id) WHERE source_b_match_id IS NOT NULL;

-- 3. modality_placements unique constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'modality_placements_modality_position_uq'
  ) THEN
    ALTER TABLE public.modality_placements
      ADD CONSTRAINT modality_placements_modality_position_uq UNIQUE (modality_id, position);
  END IF;
END $$;

-- 4. Trigger: enrollment paid -> create modality_entry + member
CREATE OR REPLACE FUNCTION public.trg_enrollments_create_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
  v_entry_name text;
BEGIN
  IF NEW.status <> 'paid' THEN RETURN NEW; END IF;
  IF NEW.modality_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.entry_id IS NOT NULL THEN RETURN NEW; END IF;

  v_entry_name := COALESCE(
    NULLIF(NEW.athlete_name, ''),
    (SELECT NULLIF(full_name, '') FROM public.profiles WHERE id = NEW.user_id LIMIT 1),
    (SELECT NULLIF(nickname, '') FROM public.profiles WHERE id = NEW.user_id LIMIT 1),
    'Atleta'
  );

  INSERT INTO public.modality_entries (modality_id, name, tenant_id)
  VALUES (NEW.modality_id, v_entry_name, NEW.tenant_id)
  RETURNING id INTO v_entry_id;

  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.modality_entry_members (entry_id, user_id)
    VALUES (v_entry_id, NEW.user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.enrollments SET entry_id = v_entry_id WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_enrollments_create_entry failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollments_create_entry ON public.enrollments;
CREATE TRIGGER trg_enrollments_create_entry
AFTER UPDATE OF status ON public.enrollments
FOR EACH ROW
WHEN (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.trg_enrollments_create_entry();

DROP TRIGGER IF EXISTS trg_enrollments_create_entry_ins ON public.enrollments;
CREATE TRIGGER trg_enrollments_create_entry_ins
AFTER INSERT ON public.enrollments
FOR EACH ROW
WHEN (NEW.status = 'paid')
EXECUTE FUNCTION public.trg_enrollments_create_entry();

-- 5. Trigger: auto-advance winners/losers to next match
CREATE OR REPLACE FUNCTION public.trg_matches_advance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loser_id uuid;
  v_next record;
  v_value uuid;
BEGIN
  IF NEW.winner_entry_id IS NULL THEN RETURN NEW; END IF;

  v_loser_id := CASE
    WHEN NEW.entry_a_id = NEW.winner_entry_id THEN NEW.entry_b_id
    WHEN NEW.entry_b_id = NEW.winner_entry_id THEN NEW.entry_a_id
    ELSE NULL
  END;

  FOR v_next IN
    SELECT id, source_a_match_id, source_b_match_id, source_a_role, source_b_role, entry_a_id, entry_b_id
    FROM public.modality_matches
    WHERE source_a_match_id = NEW.id OR source_b_match_id = NEW.id
  LOOP
    IF v_next.source_a_match_id = NEW.id THEN
      v_value := CASE WHEN v_next.source_a_role = 'loser' THEN v_loser_id ELSE NEW.winner_entry_id END;
      IF v_value IS NOT NULL AND (v_next.entry_a_id IS DISTINCT FROM v_value) THEN
        UPDATE public.modality_matches SET entry_a_id = v_value WHERE id = v_next.id;
      END IF;
    END IF;
    IF v_next.source_b_match_id = NEW.id THEN
      v_value := CASE WHEN v_next.source_b_role = 'loser' THEN v_loser_id ELSE NEW.winner_entry_id END;
      IF v_value IS NOT NULL AND (v_next.entry_b_id IS DISTINCT FROM v_value) THEN
        UPDATE public.modality_matches SET entry_b_id = v_value WHERE id = v_next.id;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_matches_advance failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matches_advance ON public.modality_matches;
CREATE TRIGGER trg_matches_advance
AFTER UPDATE OF winner_entry_id ON public.modality_matches
FOR EACH ROW
WHEN (NEW.winner_entry_id IS NOT NULL AND NEW.winner_entry_id IS DISTINCT FROM OLD.winner_entry_id)
EXECUTE FUNCTION public.trg_matches_advance();

-- 6. Trigger: auto-fill podium
CREATE OR REPLACE FUNCTION public.trg_matches_finalize_podium()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_round int;
  v_loser_id uuid;
  v_third_match_exists boolean;
BEGIN
  IF NEW.winner_entry_id IS NULL THEN RETURN NEW; END IF;

  SELECT MAX(round_number) INTO v_max_round
  FROM public.modality_matches
  WHERE modality_id = NEW.modality_id
    AND COALESCE(bracket_side,'winners') IN ('winners','final');

  IF v_max_round IS NULL THEN RETURN NEW; END IF;

  v_loser_id := CASE
    WHEN NEW.entry_a_id = NEW.winner_entry_id THEN NEW.entry_b_id
    WHEN NEW.entry_b_id = NEW.winner_entry_id THEN NEW.entry_a_id
    ELSE NULL
  END;

  IF NEW.round_number = v_max_round THEN
    INSERT INTO public.modality_placements (modality_id, entry_id, position, tenant_id)
      VALUES (NEW.modality_id, NEW.winner_entry_id, 1, NEW.tenant_id)
      ON CONFLICT (modality_id, position) DO NOTHING;
    IF v_loser_id IS NOT NULL THEN
      INSERT INTO public.modality_placements (modality_id, entry_id, position, tenant_id)
        VALUES (NEW.modality_id, v_loser_id, 2, NEW.tenant_id)
        ON CONFLICT (modality_id, position) DO NOTHING;
    END IF;
    UPDATE public.tournament_modalities SET status = 'finished' WHERE id = NEW.modality_id;
  END IF;

  IF NEW.round_number = v_max_round - 1 THEN
    SELECT EXISTS(
      SELECT 1 FROM public.modality_matches
      WHERE modality_id = NEW.modality_id
        AND COALESCE(bracket_side,'winners') = 'final'
        AND round_number = v_max_round
        AND match_number > 1
    ) INTO v_third_match_exists;

    IF NOT v_third_match_exists AND v_loser_id IS NOT NULL THEN
      INSERT INTO public.modality_placements (modality_id, entry_id, position, tenant_id)
        VALUES (NEW.modality_id, v_loser_id, 3, NEW.tenant_id)
        ON CONFLICT (modality_id, position) DO NOTHING;
      IF NOT FOUND THEN
        INSERT INTO public.modality_placements (modality_id, entry_id, position, tenant_id)
          VALUES (NEW.modality_id, v_loser_id, 4, NEW.tenant_id)
          ON CONFLICT (modality_id, position) DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_matches_finalize_podium failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matches_finalize_podium ON public.modality_matches;
CREATE TRIGGER trg_matches_finalize_podium
AFTER UPDATE OF winner_entry_id ON public.modality_matches
FOR EACH ROW
WHEN (NEW.winner_entry_id IS NOT NULL AND NEW.winner_entry_id IS DISTINCT FROM OLD.winner_entry_id)
EXECUTE FUNCTION public.trg_matches_finalize_podium();
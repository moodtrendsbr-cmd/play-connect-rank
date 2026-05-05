-- 1. Coluna needs_category_review
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS needs_category_review boolean NOT NULL DEFAULT false;

-- 2. RPC enroll_athlete_in_tournament: agora persiste modality_id e valida
CREATE OR REPLACE FUNCTION public.enroll_athlete_in_tournament(
  _tournament_id uuid,
  _modality_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_t record;
  v_enr_id uuid;
  v_mod_count int;
  v_mod_valid boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT id, tenant_id, entry_fee, max_slots, status, name
    INTO v_t
  FROM public.tournaments
  WHERE id = _tournament_id;

  IF v_t.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tournament_not_found');
  END IF;

  SELECT count(*) INTO v_mod_count
  FROM public.tournament_modalities
  WHERE tournament_id = _tournament_id;

  -- Torneio sem categorias = não inscricionável
  IF v_mod_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tournament_has_no_categories');
  END IF;

  -- Categoria obrigatória quando há ≥1
  IF _modality_id IS NULL THEN
    IF v_mod_count = 1 THEN
      SELECT id INTO _modality_id
      FROM public.tournament_modalities
      WHERE tournament_id = _tournament_id
      LIMIT 1;
    ELSE
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'modality_required',
        'available_modalities', (
          SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'gender', gender, 'level', level))
          FROM public.tournament_modalities
          WHERE tournament_id = _tournament_id
        )
      );
    END IF;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.tournament_modalities
      WHERE id = _modality_id AND tournament_id = _tournament_id
    ) INTO v_mod_valid;
    IF NOT v_mod_valid THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_modality_for_tournament');
    END IF;
  END IF;

  -- Bloquear duplicata POR (tournament,user,modality) — permite múltiplas categorias
  IF EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE tournament_id = _tournament_id
      AND user_id = v_user
      AND modality_id = _modality_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_enrolled');
  END IF;

  INSERT INTO public.enrollments (
    tournament_id, user_id, tenant_id, modality_id, status, amount_paid
  )
  VALUES (
    _tournament_id, v_user, v_t.tenant_id, _modality_id,
    CASE WHEN COALESCE(v_t.entry_fee, 0) = 0 THEN 'paid' ELSE 'pending' END,
    0
  )
  RETURNING id INTO v_enr_id;

  RETURN jsonb_build_object(
    'ok', true,
    'enrollment_id', v_enr_id,
    'tournament_id', _tournament_id,
    'tournament_name', v_t.name,
    'modality_id', _modality_id,
    'requires_payment', COALESCE(v_t.entry_fee, 0) > 0
  );
END;
$function$;

-- 3. Trigger: também disparar quando modality_id é setado depois (para o backfill)
DROP TRIGGER IF EXISTS trg_enrollments_create_entry_modality ON public.enrollments;
CREATE TRIGGER trg_enrollments_create_entry_modality
AFTER UPDATE OF modality_id ON public.enrollments
FOR EACH ROW
WHEN (
  NEW.status = 'paid'::enrollment_status
  AND NEW.modality_id IS NOT NULL
  AND OLD.modality_id IS DISTINCT FROM NEW.modality_id
  AND NEW.entry_id IS NULL
)
EXECUTE FUNCTION public.trg_enrollments_create_entry();

-- 4. RPC backfill admin-only
CREATE OR REPLACE FUNCTION public.backfill_orphan_enrollments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_linked int := 0;
  v_skipped int := 0;
  v_review int := 0;
  r record;
  v_only_mod uuid;
  v_count int;
BEGIN
  IF v_user IS NULL OR NOT public.has_role(v_user, 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  FOR r IN
    SELECT id, tournament_id
    FROM public.enrollments
    WHERE status = 'paid'
      AND modality_id IS NULL
      AND needs_category_review = false
  LOOP
    SELECT count(*) INTO v_count
    FROM public.tournament_modalities
    WHERE tournament_id = r.tournament_id;

    IF v_count = 0 THEN
      v_skipped := v_skipped + 1;
    ELSIF v_count = 1 THEN
      SELECT id INTO v_only_mod
      FROM public.tournament_modalities
      WHERE tournament_id = r.tournament_id
      LIMIT 1;
      UPDATE public.enrollments SET modality_id = v_only_mod WHERE id = r.id;
      v_linked := v_linked + 1;
    ELSE
      UPDATE public.enrollments SET needs_category_review = true WHERE id = r.id;
      v_review := v_review + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'linked', v_linked,
    'skipped_no_modality', v_skipped,
    'needs_review', v_review
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.backfill_orphan_enrollments() TO authenticated;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS orphan_reason text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_enrollments_orphan_reason ON public.enrollments(orphan_reason) WHERE orphan_reason IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_archived_at ON public.enrollments(archived_at) WHERE archived_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.backfill_orphan_enrollments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_auto int := 0;
  v_review int := 0;
  v_unrec int := 0;
  v_total int := 0;
  r record;
  v_only_mod uuid;
  v_count int;
  v_items jsonb := '[]'::jsonb;
  v_is_test boolean;
  v_bucket text;
BEGIN
  IF v_user IS NULL OR NOT public.has_role(v_user, 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  FOR r IN
    SELECT e.id, e.tournament_id, t.name AS tournament_name
    FROM public.enrollments e
    LEFT JOIN public.tournaments t ON t.id = e.tournament_id
    WHERE e.status = 'paid'
      AND (e.modality_id IS NULL OR e.entry_id IS NULL)
      AND e.archived_at IS NULL
  LOOP
    v_total := v_total + 1;
    v_is_test := (r.tournament_name ILIKE '[SMOKE]%' OR r.tournament_name ILIKE '%seed%' OR r.tournament_name ILIKE '%test%');

    SELECT count(*) INTO v_count
    FROM public.tournament_modalities
    WHERE tournament_id = r.tournament_id;

    IF v_count = 0 THEN
      UPDATE public.enrollments
      SET orphan_reason = 'unrecoverable_no_category',
          needs_category_review = false
      WHERE id = r.id;
      v_unrec := v_unrec + 1;
      v_bucket := 'unrecoverable_no_category';
    ELSIF v_count = 1 THEN
      SELECT id INTO v_only_mod FROM public.tournament_modalities WHERE tournament_id = r.tournament_id LIMIT 1;
      UPDATE public.enrollments
      SET modality_id = v_only_mod,
          needs_category_review = false,
          orphan_reason = NULL
      WHERE id = r.id;
      v_auto := v_auto + 1;
      v_bucket := 'auto_linked';
    ELSE
      UPDATE public.enrollments
      SET needs_category_review = true,
          orphan_reason = 'needs_category_review'
      WHERE id = r.id;
      v_review := v_review + 1;
      v_bucket := 'needs_category_review';
    END IF;

    v_items := v_items || jsonb_build_object(
      'enrollment_id', r.id,
      'tournament_id', r.tournament_id,
      'tournament_name', r.tournament_name,
      'modality_count', v_count,
      'bucket', v_bucket,
      'is_test', v_is_test
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'total_processed', v_total,
    'auto_linked', v_auto,
    'needs_category_review', v_review,
    'unrecoverable_no_category', v_unrec,
    'items', v_items
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.archive_test_orphans()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_archived int := 0;
BEGIN
  IF v_user IS NULL OR NOT public.has_role(v_user, 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  WITH targets AS (
    SELECT e.id
    FROM public.enrollments e
    LEFT JOIN public.tournaments t ON t.id = e.tournament_id
    WHERE e.archived_at IS NULL
      AND e.orphan_reason = 'unrecoverable_no_category'
      AND (
        t.name ILIKE '[SMOKE]%'
        OR t.name ILIKE '%seed%'
        OR t.name ILIKE '%test%'
      )
  )
  UPDATE public.enrollments e
  SET archived_at = now(),
      orphan_reason = COALESCE(orphan_reason, '') || '|archived_test_data'
  FROM targets
  WHERE e.id = targets.id;

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'archived', v_archived);
END;
$function$;

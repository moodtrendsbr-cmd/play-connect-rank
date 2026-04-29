-- Enqueue a reminder trigger for an enrollment (organizer-action). 
-- ORKYM will pick it up via orkym_triggers_queue and decide message content.
CREATE OR REPLACE FUNCTION public.enqueue_enrollment_reminder(_enrollment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_en record;
  v_t record;
  v_id uuid;
BEGIN
  SELECT * INTO v_en FROM public.enrollments WHERE id = _enrollment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'enrollment_not_found';
  END IF;

  SELECT * INTO v_t FROM public.tournaments WHERE id = v_en.tournament_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tournament_not_found';
  END IF;

  -- Only the organizer (or admin) can enqueue
  IF auth.uid() IS DISTINCT FROM v_t.organizer_id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.orkym_triggers_queue (
    tenant_id, arena_id, user_id, profile_type,
    trigger_type, entity_type, entity_id,
    payload, priority, status
  ) VALUES (
    v_t.tenant_id, v_t.arena_id, v_en.user_id, 'athlete',
    'enrollment_reminder', 'enrollment', v_en.id,
    jsonb_build_object(
      'tournament_id', v_t.id,
      'tournament_name', v_t.name,
      'expires_at', v_en.expires_at,
      'amount', v_en.amount_paid,
      'requested_by', auth.uid()
    ),
    'high', 'pending'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_enrollment_reminder(uuid) TO authenticated;
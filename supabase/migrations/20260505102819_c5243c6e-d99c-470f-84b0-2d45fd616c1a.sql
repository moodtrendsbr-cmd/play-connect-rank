-- Fix 1: trg_enrollments_create_entry — remove profiles.nickname, fix profiles.user_id join
CREATE OR REPLACE FUNCTION public.trg_enrollments_create_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entry_id uuid;
  v_entry_name text;
BEGIN
  IF NEW.status <> 'paid' THEN RETURN NEW; END IF;
  IF NEW.modality_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.entry_id IS NOT NULL THEN RETURN NEW; END IF;

  v_entry_name := COALESCE(
    NULLIF(NEW.athlete_name, ''),
    (SELECT NULLIF(full_name, '') FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1),
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
$function$;

-- Fix 2: trg_xp_from_enrollment — use NEW.user_id (athlete_id does not exist), wrap in EXCEPTION
CREATE OR REPLACE FUNCTION public.trg_xp_from_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.award_xp(NEW.user_id, 'enrollment', NEW.id, 20, 'Tournament enrollment');
  PERFORM public.update_streak(NEW.user_id, CURRENT_DATE);
  PERFORM public.evaluate_badges(NEW.user_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_xp_from_enrollment failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;
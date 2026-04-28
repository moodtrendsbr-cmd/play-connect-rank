-- Phase 12.6 — Multi-profile aliases in WhatsApp identity resolver
CREATE OR REPLACE FUNCTION public.resolve_whatsapp_identity(_wa_phone text, _instance_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phone text := regexp_replace(COALESCE(_wa_phone,''), '\D', '', 'g');
  v_id record;
  v_tenant uuid;
  v_arena uuid;
  v_profiles jsonb;
BEGIN
  IF length(v_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_phone');
  END IF;

  SELECT id, user_id, default_profile_type, verified_at, metadata
    INTO v_id
    FROM wa_identities
   WHERE wa_phone = v_phone
   ORDER BY verified_at DESC NULLS LAST, created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 'is_lead', true, 'verified', false,
      'wa_phone', v_phone, 'instance_id', _instance_id,
      'available_profiles', '[]'::jsonb
    );
  END IF;

  SELECT tenant_id INTO v_tenant
    FROM tenant_memberships
   WHERE user_id = v_id.user_id
   ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO v_arena
    FROM arenas
   WHERE owner_user_id = v_id.user_id
   ORDER BY created_at ASC LIMIT 1;

  -- Build available_profiles aggregating all roles+entities for this user
  WITH roles AS (
    SELECT DISTINCT role::text AS profile_type, NULL::uuid AS entity_id, NULL::text AS entity_name
      FROM user_roles WHERE user_id = v_id.user_id
    UNION ALL
    SELECT 'arena'::text, a.id, a.name
      FROM arenas a WHERE a.owner_user_id = v_id.user_id
    UNION ALL
    SELECT 'organizer'::text, t.id, t.name
      FROM tenants t WHERE t.owner_user_id = v_id.user_id
    UNION ALL
    SELECT 'company'::text, c.id, c.name
      FROM companies c WHERE c.owner_user_id = v_id.user_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'profile_type', profile_type,
    'entity_id', entity_id,
    'entity_name', entity_name,
    'is_default', profile_type = v_id.default_profile_type
  )), '[]'::jsonb) INTO v_profiles FROM roles;

  RETURN jsonb_build_object(
    'success', true, 'is_lead', false,
    'verified', v_id.verified_at IS NOT NULL,
    'identity_id', v_id.id,
    'user_id', v_id.user_id,
    'profile_type', v_id.default_profile_type,
    'tenant_id', v_tenant,
    'arena_id', v_arena,
    'wa_phone', v_phone,
    'instance_id', _instance_id,
    'available_profiles', v_profiles
  );
END $function$;

ALTER FUNCTION public._social_normalize_phone(text) SET search_path = public;
ALTER FUNCTION public._social_username_generate(text) SET search_path = public;
ALTER FUNCTION public.social_event_description(text, jsonb, text, text) SET search_path = public;
ALTER FUNCTION public.unaccent_safe(text) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public._social_insert_event(uuid, uuid, uuid, text, text, uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._social_username_generate(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.social_identity_upsert(text, text, text, uuid, uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.social_identity_for_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.social_profile_set_visibility(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.social_event_hide(uuid) FROM anon;

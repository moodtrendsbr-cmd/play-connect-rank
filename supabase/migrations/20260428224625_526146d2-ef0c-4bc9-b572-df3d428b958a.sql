
REVOKE EXECUTE ON FUNCTION public.acquire_session_lock(uuid, text, int) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_session_lock(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_or_create_session(uuid, uuid, uuid, text, uuid, text, int, int, text, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_session_context(uuid, jsonb, int) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prepare_session_confirmation(uuid, jsonb, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_session_executing(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_session(uuid, jsonb, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.abandon_session(uuid, text, int) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_sessions(int) FROM anon, authenticated;

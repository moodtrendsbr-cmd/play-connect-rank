
REVOKE EXECUTE ON FUNCTION public.award_xp(uuid, text, uuid, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_streak(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.evaluate_badges(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp(uuid, text, uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_streak(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_badges(uuid) TO authenticated, service_role;

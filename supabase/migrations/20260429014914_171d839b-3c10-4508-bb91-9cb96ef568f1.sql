
REVOKE ALL ON FUNCTION public.orkym_trigger_enqueue(uuid,uuid,uuid,text,text,text,uuid,jsonb,text,text,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orkym_trigger_claim_batch(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orkym_trigger_complete(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orkym_proactive_check_eligibility(uuid,uuid,text,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.orkym_proactive_record_send(text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orkym_generate_periodic_triggers() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.orkym_trigger_enqueue(uuid,uuid,uuid,text,text,text,uuid,jsonb,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.orkym_trigger_claim_batch(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.orkym_trigger_complete(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.orkym_proactive_check_eligibility(uuid,uuid,text,text,text,uuid) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.orkym_proactive_record_send(text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.orkym_generate_periodic_triggers() TO service_role;

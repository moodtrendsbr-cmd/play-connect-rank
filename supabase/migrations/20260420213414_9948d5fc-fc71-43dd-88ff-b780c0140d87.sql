-- View pública estendida para página de contato da empresa no marketplace
-- Exclui apenas cnpj, billing_status, plan_id (admin), commission_rate, mantém contato
CREATE OR REPLACE VIEW public.companies_contact_public
WITH (security_invoker = on) AS
SELECT
  id, name, logo_url, description, category, city, state,
  email, phone, whatsapp, address, zip_code,
  plan, status, tenant_id, created_at
FROM public.companies
WHERE status = 'approved';

GRANT SELECT ON public.companies_contact_public TO anon, authenticated;
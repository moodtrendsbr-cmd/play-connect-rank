-- 1) Campos opcionais novos em arenas
ALTER TABLE public.arenas
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS modalities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- 2) Metadados de gestão para QRs físicos
ALTER TABLE public.wa_qr_tokens
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS scans_count integer NOT NULL DEFAULT 0;

-- 3) Categoria leve em produtos (lojinha/bar da arena)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category text;

-- 4) Equipe da arena (mínima)
CREATE TABLE IF NOT EXISTS public.arena_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  email text,
  phone text,
  role text NOT NULL CHECK (role IN ('gerente','recepcao','professor','organizador','financeiro','bar_lojinha','suporte')),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arena_staff_arena ON public.arena_staff(arena_id);
CREATE INDEX IF NOT EXISTS idx_arena_staff_user ON public.arena_staff(user_id);

ALTER TABLE public.arena_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Arena owner manage staff" ON public.arena_staff;
CREATE POLICY "Arena owner manage staff"
ON public.arena_staff
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.owner_user_id = auth.uid())
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.owner_user_id = auth.uid())
  OR public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Staff sees own row" ON public.arena_staff;
CREATE POLICY "Staff sees own row"
ON public.arena_staff
FOR SELECT
USING (user_id = auth.uid());

-- updated_at trigger
DROP TRIGGER IF EXISTS update_arena_staff_updated_at ON public.arena_staff;
CREATE TRIGGER update_arena_staff_updated_at
BEFORE UPDATE ON public.arena_staff
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
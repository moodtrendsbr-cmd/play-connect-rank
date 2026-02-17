-- Adicionar novos valores ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'arena';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'company';

-- Adicionar coluna CNPJ na tabela companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cnpj text;
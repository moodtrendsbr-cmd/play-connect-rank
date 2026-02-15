
-- Add new columns to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS zip_code text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS whatsapp text;

-- Add new columns to marketplace_orders
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS shipping_zip text;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS payment_id text;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS buyer_confirmed boolean DEFAULT false;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS company_confirmed boolean DEFAULT false;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS items jsonb;

-- Allow company owners to update their own orders (for company_confirmed)
CREATE POLICY "Company owner update orders"
ON public.marketplace_orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM products p
    JOIN companies c ON c.id = p.company_id
    WHERE p.id = marketplace_orders.product_id AND c.owner_user_id = auth.uid()
  )
);

-- Allow buyers to update their own orders (for buyer_confirmed)
CREATE POLICY "Buyer update own orders"
ON public.marketplace_orders
FOR UPDATE
USING (auth.uid() = buyer_user_id);

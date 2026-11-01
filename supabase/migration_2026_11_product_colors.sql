-- Adds optional visual identification color to inventory products.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color text;

-- Keep product codes optional on existing installations too.
ALTER TABLE public.products ALTER COLUMN code DROP NOT NULL;
ALTER TABLE public.stock_logs ALTER COLUMN code DROP NOT NULL;

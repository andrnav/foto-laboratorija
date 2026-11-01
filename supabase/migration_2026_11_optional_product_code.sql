-- Leidžiama pridėti prekes be kodo. Esami kodai išsaugomi.
-- Supabase SQL Editor aplinkoje vykdykite vieną kartą.
alter table public.products alter column code drop not null;
alter table public.stock_logs alter column code drop not null;

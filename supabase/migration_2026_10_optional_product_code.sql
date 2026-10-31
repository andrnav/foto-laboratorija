-- Leidžia kurti prekes be kodo. Esami kodai ir jų unikalumo taisyklė išlieka.
alter table public.products alter column code drop not null;
alter table public.stock_logs alter column code drop not null;

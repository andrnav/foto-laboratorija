-- FOTO LABORATORIJOS SANDĖLIO SISTEMA: kategorijų atnaujinimas
-- Vykdykite vieną kartą Supabase Dashboard -> SQL Editor -> New query.
-- Ši migracija nekeičia esamų likučių ar prekių kodų.

alter table public.products add column if not exists subcategory text not null default 'other';

alter table public.products drop constraint if exists products_kind_check;
alter table public.products add constraint products_kind_check check (kind in ('paper','chemical','ink','item'));

alter table public.products drop constraint if exists ink_percentage_check;
alter table public.products add constraint ink_percentage_check check (
  (kind <> 'ink') or (quantity <= 100 and min_quantity <= 100)
);

-- Esamų foto medžiagų subkategorijos priskiriamos automatiškai.
update public.products set subcategory = 'paper' where category = 'photo' and kind = 'paper';
update public.products set subcategory = 'chemical' where category = 'photo' and kind = 'chemical';
update public.products set subcategory = 'paper' where category = 'wide' and (kind = 'paper' or subcategory = 'other');
update public.products set subcategory = 'cups' where category = 'sublimation' and subcategory = 'other' and (name ilike '%puodel%');
update public.products set subcategory = 'subframes' where category = 'framing' and subcategory = 'other' and (name ilike '%porem%');

create index if not exists products_category_subcategory_idx on public.products(category, subcategory);

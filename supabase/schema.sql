-- FOTO LABORATORIJOS SANDĖLIO SISTEMA
-- Vykdykite visą failą Supabase Dashboard -> SQL Editor -> New query.
create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('photo','wide','sublimation','framing','other')),
  subcategory text not null default 'other',
  kind text not null default 'item' check (kind in ('paper','chemical','ink','item')),
  name text not null,
  surface text,
  width_cm numeric(6,2),
  code text not null unique,
  quantity numeric(10,2) not null default 0 check (quantity >= 0),
  min_quantity numeric(10,2) not null default 0 check (min_quantity >= 0),
  unit text not null default 'vnt.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paper_fields_check check (
    (kind <> 'paper') or (surface is not null and width_cm is not null)
  ),
  constraint ink_percentage_check check (
    (kind <> 'ink') or (quantity <= 100 and min_quantity <= 100)
  )
);

create table if not exists public.stock_logs (
  id bigint generated always as identity primary key,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  code text not null,
  delta numeric(10,2) not null,
  quantity_before numeric(10,2) not null,
  quantity_after numeric(10,2) not null,
  reason text not null default 'Likučio pakeitimas',
  actor uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists products_category_idx on public.products(category);
create index if not exists products_category_subcategory_idx on public.products(category, subcategory);
create index if not exists stock_logs_created_at_idx on public.stock_logs(created_at desc);
create index if not exists stock_logs_product_id_idx on public.stock_logs(product_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

alter table public.admins enable row level security;
alter table public.products enable row level security;
alter table public.stock_logs enable row level security;

drop policy if exists "admins can view own admin row" on public.admins;
create policy "admins can view own admin row" on public.admins for select to authenticated using (user_id = auth.uid());

drop policy if exists "products are public read" on public.products;
create policy "products are public read" on public.products for select to anon, authenticated using (true);
drop policy if exists "admins can insert products" on public.products;
create policy "admins can insert products" on public.products for insert to authenticated with check (public.is_admin());
drop policy if exists "admins can update products" on public.products;
create policy "admins can update products" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins can delete products" on public.products;
create policy "admins can delete products" on public.products for delete to authenticated using (public.is_admin());

drop policy if exists "logs are public read" on public.stock_logs;
create policy "logs are public read" on public.stock_logs for select to anon, authenticated using (true);
drop policy if exists "admins can insert logs" on public.stock_logs;
create policy "admins can insert logs" on public.stock_logs for insert to authenticated with check (public.is_admin());

create or replace function public.scan_stock(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.products%rowtype;
  before_qty numeric(10,2);
begin
  if not public.is_admin() then raise exception 'Tik administratorius gali skenuoti ir keisti likučius.'; end if;
  select * into p from public.products where code = trim(p_code) for update;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if p.quantity < 1 then return jsonb_build_object('status','empty','name',p.name); end if;
  before_qty := p.quantity;
  update public.products set quantity = quantity - 1, updated_at = now() where id = p.id returning * into p;
  insert into public.stock_logs(product_id,product_name,code,delta,quantity_before,quantity_after,reason,actor)
  values(p.id, coalesce(p.surface || ' ' || p.width_cm || ' cm',p.name),p.code,-1,before_qty,p.quantity,'QR nuskaitymas',auth.uid());
  return jsonb_build_object('status','ok','name',coalesce(p.surface || ' ' || p.width_cm || ' cm',p.name),'quantity',p.quantity);
end;
$$;

create or replace function public.adjust_stock(p_product_id uuid, p_new_quantity numeric, p_reason text default 'Likučio pakeitimas')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.products%rowtype;
  before_qty numeric(10,2);
  reason_text text;
begin
  if not public.is_admin() then raise exception 'Tik administratorius gali keisti likučius.'; end if;
  if p_new_quantity is null or p_new_quantity < 0 then raise exception 'Likutis negali būti neigiamas.'; end if;
  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'Prekė nerasta.'; end if;
  before_qty := p.quantity;
  reason_text := coalesce(nullif(trim(p_reason),''),'Likučio pakeitimas');
  update public.products set quantity = p_new_quantity, updated_at = now() where id = p.id returning * into p;
  insert into public.stock_logs(product_id,product_name,code,delta,quantity_before,quantity_after,reason,actor)
  values(p.id,coalesce(p.surface || ' ' || p.width_cm || ' cm',p.name),p.code,p.quantity-before_qty,before_qty,p.quantity,reason_text,auth.uid());
  return jsonb_build_object('status','ok','quantity',p.quantity);
end;
$$;

revoke all on function public.scan_stock(text) from public;
revoke all on function public.adjust_stock(uuid,numeric,text) from public;
grant execute on function public.scan_stock(text) to authenticated;
grant execute on function public.adjust_stock(uuid,numeric,text) to authenticated;

-- Pradinės foto medžiagos įkeliamos tik jei jų kodai dar neegzistuoja.
insert into public.products(category,subcategory,kind,name,surface,width_cm,code,quantity,min_quantity,unit)
values
('photo','paper','paper','Glossy','Glossy',12.7,'FP-G127',5,4,'vnt.'),
('photo','paper','paper','Glossy','Glossy',15.2,'FP-G152',2,4,'vnt.'),
('photo','paper','paper','Glossy','Glossy',30.5,'FP-G305',6,4,'vnt.'),
('photo','paper','paper','Lustre','Lustre',12.7,'FP-L127',4,4,'vnt.'),
('photo','paper','paper','Lustre','Lustre',15.2,'FP-L152',7,4,'vnt.'),
('photo','paper','paper','Lustre','Lustre',30.5,'FP-L305',0,2,'vnt.'),
('photo','paper','paper','Silk','Silk',12.7,'FP-S127',3,3,'vnt.'),
('photo','paper','paper','Silk','Silk',15.2,'FP-S152',4,3,'vnt.'),
('photo','paper','paper','Silk','Silk',30.5,'FP-S305',5,4,'vnt.'),
('photo','chemical','chemical','CD Developer',null,null,'CH-CD',2.5,2,'bak.'),
('photo','chemical','chemical','BF Bleach Fix',null,null,'CH-BF',2,2,'bak.'),
('photo','chemical','chemical','STB Super Stabilizer',null,null,'CH-STB',1.5,2,'bak.')
on conflict (code) do nothing;

-- Darbuotojo rolė: gali keisti likučius ir naudoti QR, bet negali pridėti ar trinti prekių.
-- Pirmiausia sukurkite vartotoją Supabase Dashboard -> Authentication -> Users.
-- Tada vykdykite šį failą. Jei vartotojas darbuotojas@darbuotojas.lt jau sukurtas,
-- jis automatiškai bus įtrauktas į darbuotojų sąrašą.

create table if not exists public.employees (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.employees enable row level security;
drop policy if exists "employees can view own employee row" on public.employees;
create policy "employees can view own employee row"
  on public.employees for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_employee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (select 1 from public.employees where user_id = auth.uid());
$$;

-- Automatiškai priskiriame darbuotojo rolę, jei paskyra jau sukurta.
insert into public.employees(user_id)
select id from auth.users where lower(email) = lower('darbuotojas@darbuotojas.lt')
on conflict (user_id) do nothing;

create or replace function public.scan_stock(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.products%rowtype;
  before_qty numeric(10,2);
  shown_name text;
begin
  if not public.is_employee() then
    raise exception 'QR nuskaitymui ir likučių keitimui reikia darbuotojo arba administratoriaus teisių.';
  end if;

  select * into p
  from public.products
  where lower(trim(code)) = lower(trim(coalesce(p_code, '')))
    and kind = 'paper'
  limit 1
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  shown_name := coalesce(nullif(trim(p.surface), ''), nullif(trim(p.name), ''), p.code);
  if p.width_cm is not null then
    shown_name := shown_name || ' ' || replace(p.width_cm::text, '.', ',') || ' cm';
  end if;

  if p.quantity < 1 then
    return jsonb_build_object('status', 'empty', 'name', shown_name, 'quantity', p.quantity);
  end if;

  before_qty := p.quantity;
  update public.products
  set quantity = quantity - 1, updated_at = now()
  where id = p.id
  returning * into p;

  insert into public.stock_logs(product_id, product_name, code, delta, quantity_before, quantity_after, reason, actor)
  values (p.id, shown_name, p.code, -1, before_qty, p.quantity, 'QR nuskaitymas', auth.uid());

  return jsonb_build_object('status', 'ok', 'name', shown_name, 'code', p.code, 'quantity', p.quantity);
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
  if not public.is_employee() then raise exception 'Tik darbuotojas arba administratorius gali keisti likučius.'; end if;
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

-- QR nuskaitymo pataisymas: atnaujina likutį duomenų bazėje ir įrašo istoriją.
-- Supabase Dashboard -> SQL Editor -> New query -> įklijuokite ir Run.

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
  if not public.is_admin() then
    raise exception 'QR nuskaitymui ir likučių keitimui reikia administratoriaus teisių.';
  end if;

  -- Ieškome pagal tikslų kodą, bet nepaisome netyčia įvestų tarpų ir raidžių dydžio.
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

revoke all on function public.scan_stock(text) from public;
grant execute on function public.scan_stock(text) to authenticated;

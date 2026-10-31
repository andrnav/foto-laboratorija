-- Prideda pasirenkamą vizualinę spalvą kitoms prekėms.
-- Foto popieriaus ir foto chemijos spalvos valdomos atskirai programos sąsajoje.
alter table public.products
  add column if not exists color text;

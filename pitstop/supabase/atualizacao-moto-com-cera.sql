-- =====================================================================
-- PitStop — ATUALIZAÇÃO para quem JÁ criou o banco com a versão anterior.
-- Adiciona a "Lavagem completa com cera" para moto (R$ 50,00) e atualiza o
-- que cada lavagem inclui. Rode uma vez em: Supabase → SQL Editor → Run.
-- Preços já existentes NÃO são alterados (só o serviço novo entra com R$ 50,00).
-- Agendamentos antigos continuam com o nome/preço que tinham na época.
-- =====================================================================
insert into public.services (id, vehicle, name, description, price, sort) values
  ('moto-cera', 'moto', 'Lavagem completa com cera',
   E'Lavagem\nRestaurador para os plásticos\nAplicação de cera Vonixx com 3 meses de proteção\nSelante para pneus', 50.00, 3)
on conflict (id) do nothing;

update public.services set name = 'Lavagem completa com cera', sort = 1,
  description = E'Lavagem externa\nAspiração interna\nLimpeza do painel\nAplicação de cera' where id = 'carro-cera';
update public.services set name = 'Lavagem sem cera', sort = 2,
  description = E'Lavagem externa\nAspiração interna\nLimpeza do painel' where id = 'carro-simples';
update public.services set name = 'Lavagem completa com cera', sort = 3,
  description = E'Lavagem\nRestaurador para os plásticos\nAplicação de cera Vonixx com 3 meses de proteção\nSelante para pneus' where id = 'moto-cera';
update public.services set name = 'Lavagem sem cera', sort = 4,
  description = E'Lavagem\nPretinho nos pneus' where id = 'moto';

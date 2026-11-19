-- =====================================================================
-- PitStop Lava Jato — banco de dados (Supabase / PostgreSQL)
-- Cole este arquivo inteiro em: Supabase → SQL Editor → New query → Run
-- Pode ser executado de novo sem apagar dados (idempotente).
-- =====================================================================

-- ---------- Tabelas ----------------------------------------------------

create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'staff' check (role in ('owner','staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id          text primary key,
  vehicle     text not null check (vehicle in ('moto','carro')),
  name        text not null,
  description text not null default '',
  price       numeric(8,2) not null check (price >= 0),
  active      boolean not null default true,
  sort        int not null default 0
);

insert into public.services (id, vehicle, name, description, price, sort) values
  ('moto',          'moto',  'Lavagem de moto',           'Lavagem da sua moto.', 35.00, 1),
  ('carro-cera',    'carro', 'Lavagem completa com cera', 'Lavagem externa, aspiração interna, limpeza do painel e cera.', 65.00, 2),
  ('carro-simples', 'carro', 'Lavagem sem cera',          'Lavagem externa, aspiração interna e limpeza do painel.', 45.00, 3)
on conflict (id) do nothing;

create table if not exists public.settings (
  key   text primary key,
  value text not null
);
insert into public.settings (key, value) values ('hold_minutes', '120') on conflict (key) do nothing;

create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 60),
  vehicle       text not null check (vehicle in ('moto','carro')),
  service_id    text not null references public.services(id),
  service_name  text not null,
  price         numeric(8,2) not null,
  booking_date  date not null,
  booking_time  time not null,
  status        text not null default 'pendente'
                check (status in ('pendente','confirmado','em_andamento','concluido','cancelado','expirado')),
  phone         text,
  notes         text,
  source        text not null default 'site' check (source in ('site','admin')),
  requested_at  timestamptz not null default now(),
  expires_at    timestamptz,
  updated_at    timestamptz not null default now()
);

-- CONTROLE DE CONCORRÊNCIA: no máximo UMA reserva ativa por data+horário, garantido pelo banco.
-- (cancelado e expirado liberam o horário)
create unique index if not exists bookings_one_active_per_slot
  on public.bookings (booking_date, booking_time)
  where status in ('pendente','confirmado','em_andamento','concluido');
create index if not exists bookings_date_idx   on public.bookings (booking_date);
create index if not exists bookings_status_idx on public.bookings (status);

create table if not exists public.blocked_slots (
  id         uuid primary key default gen_random_uuid(),
  slot_date  date not null,
  slot_time  time,                         -- NULL = dia inteiro
  reason     text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists blocked_slots_unique
  on public.blocked_slots (slot_date, coalesce(slot_time, '00:00'::time));

create table if not exists public.booking_events (
  id         bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  at         timestamptz not null default now(),
  actor      uuid,
  from_status text,
  to_status   text,
  note       text
);
create index if not exists booking_events_booking_idx on public.booking_events (booking_id, at);

-- ---------- Funções de apoio --------------------------------------------

-- Horários de início (1h cada). Expediente 08–17h, almoço 12–13h.
create or replace function public.business_slots()
returns setof time language sql immutable as $$
  select unnest(array['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00']::time[])
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and role = 'owner')
$$;

create or replace function public.hold_minutes()
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(value,'')::int from public.settings where key = 'hold_minutes'), 120)
$$;

-- ---------- Gatilhos ------------------------------------------------------

-- Antes de gravar: libera reservas pendentes VENCIDAS do mesmo horário e zera o prazo quando deixa de ser pendente.
create or replace function public.bookings_before_write()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status <> 'pendente' then new.expires_at := null; end if;
  if new.status in ('pendente','confirmado','em_andamento','concluido')
     and (tg_op = 'INSERT'
          or new.booking_date is distinct from old.booking_date
          or new.booking_time is distinct from old.booking_time
          or new.status       is distinct from old.status) then
    update public.bookings
       set status = 'expirado'
     where booking_date = new.booking_date and booking_time = new.booking_time
       and status = 'pendente' and expires_at is not null and expires_at < now()
       and id <> new.id;
  end if;
  return new;
end $$;

drop trigger if exists bookings_before_write on public.bookings;
create trigger bookings_before_write before insert or update on public.bookings
  for each row execute function public.bookings_before_write();

-- Histórico: registra criação, mudança de status e reagendamento.
create or replace function public.bookings_log_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_events (booking_id, actor, to_status, note)
    values (new.id, auth.uid(), new.status, case when new.source = 'admin' then 'Criado pelo painel' else 'Solicitado pelo site' end);
  else
    if new.status is distinct from old.status then
      insert into public.booking_events (booking_id, actor, from_status, to_status)
      values (new.id, auth.uid(), old.status, new.status);
    end if;
    if new.booking_date is distinct from old.booking_date or new.booking_time is distinct from old.booking_time then
      insert into public.booking_events (booking_id, actor, from_status, to_status, note)
      values (new.id, auth.uid(), old.status, new.status,
              'Reagendado de ' || to_char(old.booking_date,'DD/MM/YYYY') || ' ' || to_char(old.booking_time,'HH24:MI')
              || ' para ' || to_char(new.booking_date,'DD/MM/YYYY') || ' ' || to_char(new.booking_time,'HH24:MI'));
    end if;
  end if;
  return null;
end $$;

drop trigger if exists bookings_log_event on public.bookings;
create trigger bookings_log_event after insert or update on public.bookings
  for each row execute function public.bookings_log_event();

-- ---------- Funções públicas (única porta de entrada dos clientes) --------

-- Horários ocupados num intervalo (reservas ativas não vencidas + bloqueios). Não expõe nomes nem dados.
create or replace function public.get_availability(p_from date, p_to date)
returns table (slot_date date, slot_time text)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 92 then
    raise exception 'INVALID_RANGE';
  end if;
  return query
    select b.booking_date, to_char(b.booking_time, 'HH24:MI')
      from public.bookings b
     where b.booking_date between p_from and p_to
       and b.status in ('pendente','confirmado','em_andamento','concluido')
       and not (b.status = 'pendente' and b.expires_at is not null and b.expires_at < now())
    union
    select s.slot_date, to_char(t, 'HH24:MI')
      from public.blocked_slots s cross join lateral public.business_slots() t
     where s.slot_date between p_from and p_to and s.slot_time is null
    union
    select s.slot_date, to_char(s.slot_time, 'HH24:MI')
      from public.blocked_slots s
     where s.slot_date between p_from and p_to and s.slot_time is not null;
end $$;

-- Cria a solicitação (status "pendente" = Aguardando confirmação) com TODAS as validações no servidor.
create or replace function public.create_booking(
  p_name text, p_vehicle text, p_service_id text, p_date date, p_time text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_svc   public.services%rowtype;
  v_now   timestamp := (now() at time zone 'America/Recife');
  v_today date      := (now() at time zone 'America/Recife')::date;
  v_t     time;
  v_name  text;
  v_hold  int := public.hold_minutes();
  v_row   public.bookings%rowtype;
begin
  v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  if char_length(v_name) < 2 or char_length(v_name) > 60 then raise exception 'INVALID_NAME'; end if;

  select * into v_svc from public.services where id = p_service_id and active;
  if not found then raise exception 'INVALID_SERVICE'; end if;
  if v_svc.vehicle is distinct from p_vehicle then raise exception 'SERVICE_MISMATCH'; end if;

  if p_date is null then raise exception 'PAST_DATE'; end if;
  if p_date < v_today then raise exception 'PAST_DATE'; end if;
  if p_date > v_today + 60 then raise exception 'TOO_FAR'; end if;
  if extract(isodow from p_date) = 7 then raise exception 'CLOSED_DAY'; end if;

  begin v_t := p_time::time; exception when others then raise exception 'INVALID_TIME'; end;
  if not exists (select 1 from public.business_slots() s where s = v_t) then raise exception 'INVALID_TIME'; end if;
  if p_date = v_today and v_t <= v_now::time then raise exception 'PAST_TIME'; end if;

  if exists (select 1 from public.blocked_slots where slot_date = p_date and (slot_time is null or slot_time = v_t)) then
    raise exception 'SLOT_BLOCKED';
  end if;

  -- freio simples contra abuso: no máximo 3 pedidos pendentes em aberto com o mesmo nome
  if (select count(*) from public.bookings
       where lower(customer_name) = lower(v_name) and status = 'pendente'
         and expires_at > now() and booking_date >= v_today) >= 3 then
    raise exception 'TOO_MANY';
  end if;

  -- serializa tentativas simultâneas do MESMO horário; o índice único é a garantia final
  perform pg_advisory_xact_lock(hashtext(p_date::text || ' ' || v_t::text));

  begin
    insert into public.bookings (customer_name, vehicle, service_id, service_name, price, booking_date, booking_time, status, source, expires_at)
    values (v_name, v_svc.vehicle, v_svc.id, v_svc.name, v_svc.price, p_date, v_t, 'pendente', 'site', now() + make_interval(mins => v_hold))
    returning * into v_row;
  exception when unique_violation then
    raise exception 'SLOT_TAKEN';
  end;

  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'price', v_row.price,
                            'service_name', v_row.service_name, 'expires_at', v_row.expires_at, 'hold_minutes', v_hold);
end $$;

-- Varre reservas pendentes vencidas (o painel chama ao abrir/atualizar).
create or replace function public.sweep_expired()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.bookings set status = 'expirado'
   where status = 'pendente' and expires_at is not null and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- Permissões e RLS ---------------------------------------------

revoke all on public.admins, public.settings, public.bookings, public.blocked_slots, public.booking_events from anon;
revoke all on public.services from anon;
grant select on public.services to anon, authenticated;
grant select, insert, update, delete on public.services, public.settings, public.bookings, public.blocked_slots to authenticated;
grant select on public.admins, public.booking_events to authenticated;

revoke all on function public.get_availability(date,date)        from public;
revoke all on function public.create_booking(text,text,text,date,text) from public;
revoke all on function public.sweep_expired()                    from public;
revoke all on function public.is_admin(), public.is_owner(), public.hold_minutes() from public;
grant execute on function public.get_availability(date,date)             to anon, authenticated;
grant execute on function public.create_booking(text,text,text,date,text) to anon, authenticated;
grant execute on function public.sweep_expired()                         to authenticated;
grant execute on function public.is_admin(), public.is_owner(), public.hold_minutes() to authenticated;

alter table public.admins         enable row level security;
alter table public.services       enable row level security;
alter table public.settings       enable row level security;
alter table public.bookings       enable row level security;
alter table public.blocked_slots  enable row level security;
alter table public.booking_events enable row level security;

drop policy if exists admins_read_self     on public.admins;
drop policy if exists admins_read_all      on public.admins;
create policy admins_read_self on public.admins for select to authenticated using (user_id = auth.uid());
create policy admins_read_all  on public.admins for select to authenticated using (public.is_owner());

-- Serviços: clientes só enxergam os ativos; só o proprietário altera.
drop policy if exists services_read   on public.services;
drop policy if exists services_read_anon on public.services;
drop policy if exists services_write  on public.services;
create policy services_read_anon on public.services for select to anon using (active);
create policy services_read  on public.services for select to authenticated using (active or public.is_admin());
create policy services_write on public.services for all    to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists settings_read  on public.settings;
drop policy if exists settings_write on public.settings;
create policy settings_read  on public.settings for select to authenticated using (public.is_admin());
create policy settings_write on public.settings for all    to authenticated using (public.is_owner()) with check (public.is_owner());

-- Agendamentos: NENHUM acesso direto para clientes (anon). Equipe lê/cria/edita; só o proprietário exclui.
drop policy if exists bookings_select on public.bookings;
drop policy if exists bookings_insert on public.bookings;
drop policy if exists bookings_update on public.bookings;
drop policy if exists bookings_delete on public.bookings;
create policy bookings_select on public.bookings for select to authenticated using (public.is_admin());
create policy bookings_insert on public.bookings for insert to authenticated with check (public.is_admin());
create policy bookings_update on public.bookings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy bookings_delete on public.bookings for delete to authenticated using (public.is_owner());

drop policy if exists blocked_select on public.blocked_slots;
drop policy if exists blocked_write  on public.blocked_slots;
create policy blocked_select on public.blocked_slots for select to authenticated using (public.is_admin());
create policy blocked_write  on public.blocked_slots for all    to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists events_select on public.booking_events;
create policy events_select on public.booking_events for select to authenticated using (public.is_admin());

-- =====================================================================
-- DEPOIS DE RODAR ESTE ARQUIVO:
--  1) Authentication → Users → Add user (e-mail + senha do dono).
--  2) Rode (troque o e-mail) para torná-lo administrador/proprietário:
--
--     insert into public.admins (user_id, role)
--     select id, 'owner' from auth.users where email = 'dono@exemplo.com';
--
--     Para um funcionário (sem poder excluir registros nem mudar preços): role 'staff'.
--  3) Authentication → Sign In / Providers → desative "Allow new users to sign up".
-- =====================================================================

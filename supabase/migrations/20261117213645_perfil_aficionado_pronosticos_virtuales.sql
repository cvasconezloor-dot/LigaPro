-- Perfil de aficionado y pronósticos con puntos virtuales sin conversión monetaria.
alter table public.perfiles add column if not exists apodo text not null default '';
alter table public.perfiles add column if not exists ciudad text not null default '';
alter table public.perfiles add column if not exists club_favorito_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfiles_club_favorito_fk') then
    alter table public.perfiles add constraint perfiles_club_favorito_fk foreign key (club_favorito_id) references public.clubes(id) on delete set null;
  end if;
end $$;

create table if not exists public.carteras_virtuales (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  saldo_puntos integer not null default 1000 check (saldo_puntos >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.carteras_virtuales (usuario_id)
select pf.id from public.perfiles pf
on conflict (usuario_id) do nothing;

create table if not exists public.pronosticos_virtuales (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  partido_id uuid not null references public.partidos(id) on delete cascade,
  seleccion text not null check (seleccion in ('local', 'empate', 'visitante')),
  cuota numeric(5,2) not null check (cuota > 1 and cuota <= 20),
  puntos_apostados integer not null check (puntos_apostados between 10 and 500),
  retorno_puntos integer generated always as (round(puntos_apostados * cuota)::integer) stored,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'ganado', 'perdido', 'anulado')),
  created_at timestamptz not null default now(),
  resuelto_at timestamptz,
  unique (usuario_id, partido_id),
  check ((seleccion = 'local' and cuota = 2.10) or (seleccion = 'empate' and cuota = 3.20) or (seleccion = 'visitante' and cuota = 2.80))
);

create index if not exists pronosticos_virtuales_usuario_fecha_idx on public.pronosticos_virtuales(usuario_id, created_at desc);
create index if not exists pronosticos_virtuales_partido_estado_idx on public.pronosticos_virtuales(partido_id, estado) where estado = 'pendiente';
alter table public.carteras_virtuales enable row level security;
alter table public.pronosticos_virtuales enable row level security;

drop policy if exists carteras_virtuales_select_own on public.carteras_virtuales;
create policy carteras_virtuales_select_own on public.carteras_virtuales for select to authenticated
  using (usuario_id = (select auth.uid()));
drop policy if exists pronosticos_virtuales_select_own on public.pronosticos_virtuales;
create policy pronosticos_virtuales_select_own on public.pronosticos_virtuales for select to authenticated
  using (usuario_id = (select auth.uid()));

-- Keep table-level updates away from authenticated clients; grant only safe profile columns.
drop policy if exists perfiles_update_admin on public.perfiles;
drop policy if exists perfiles_update_self_profile_fields on public.perfiles;
create policy perfiles_update_self_profile_fields on public.perfiles for update to authenticated
  using (id = (select auth.uid()) or private.tiene_rol(array['administrador']::public.rol_usuario[]))
  with check (id = (select auth.uid()) or private.tiene_rol(array['administrador']::public.rol_usuario[]));
revoke update on public.perfiles from authenticated;
grant update (nombre, apodo, ciudad, club_favorito_id) on public.perfiles to authenticated;
revoke all on public.carteras_virtuales, public.pronosticos_virtuales from anon, authenticated;
grant select on public.carteras_virtuales, public.pronosticos_virtuales to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;

create or replace function private.crear_cartera_virtual_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.carteras_virtuales (usuario_id) values (new.id) on conflict (usuario_id) do nothing;
  return new;
end;
$$;
revoke all on function private.crear_cartera_virtual_usuario() from public, anon, authenticated, service_role;
drop trigger if exists al_crear_perfil_crear_cartera_virtual on public.perfiles;
create trigger al_crear_perfil_crear_cartera_virtual after insert on public.perfiles
for each row execute function private.crear_cartera_virtual_usuario();

create or replace function private.registrar_pronostico_virtual(p_partido_id uuid, p_seleccion text, p_puntos integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_usuario uuid := (select auth.uid());
  v_partido public.partidos%rowtype;
  v_saldo integer;
  v_cuota numeric(5,2);
  v_pronostico uuid;
begin
  if v_usuario is null then raise exception 'Inicia sesión para participar.'; end if;
  if p_seleccion not in ('local', 'empate', 'visitante') then raise exception 'Selección no válida.'; end if;
  if p_puntos is null or p_puntos < 10 or p_puntos > 500 then raise exception 'Usa entre 10 y 500 puntos virtuales.'; end if;
  if not exists (select 1 from public.perfiles pf where pf.id = v_usuario and btrim(pf.nombre) <> '' and btrim(pf.apodo) <> '') then
    raise exception 'Completa tu nombre y apodo antes de participar.';
  end if;

  select * into v_partido from public.partidos p where p.id = p_partido_id for update;
  if not found or v_partido.estado <> 'programado' or v_partido.fecha_hora is null or v_partido.fecha_hora <= now() then
    raise exception 'El partido ya no está disponible para pronósticos.';
  end if;

  v_cuota := case p_seleccion when 'local' then 2.10 when 'empate' then 3.20 else 2.80 end;
  insert into public.carteras_virtuales (usuario_id) values (v_usuario) on conflict (usuario_id) do nothing;
  select c.saldo_puntos into v_saldo from public.carteras_virtuales c where c.usuario_id = v_usuario for update;
  if v_saldo < p_puntos then raise exception 'No tienes suficientes puntos virtuales.'; end if;

  update public.carteras_virtuales c set saldo_puntos = c.saldo_puntos - p_puntos, updated_at = now() where c.usuario_id = v_usuario;
  insert into public.pronosticos_virtuales (usuario_id, partido_id, seleccion, cuota, puntos_apostados)
  values (v_usuario, p_partido_id, p_seleccion, v_cuota, p_puntos) returning id into v_pronostico;
  return v_pronostico;
end;
$$;
revoke all on function private.registrar_pronostico_virtual(uuid, text, integer) from public, anon, authenticated, service_role;
grant execute on function private.registrar_pronostico_virtual(uuid, text, integer) to authenticated;

create or replace function public.crear_pronostico_virtual(p_partido_id uuid, p_seleccion text, p_puntos integer)
returns uuid language sql security invoker set search_path = '' as $$
  select private.registrar_pronostico_virtual(p_partido_id, p_seleccion, p_puntos);
$$;
revoke all on function public.crear_pronostico_virtual(uuid, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.crear_pronostico_virtual(uuid, text, integer) to authenticated;

create or replace function private.liquidar_pronosticos_virtuales()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_resultado text;
begin
  if new.estado = 'finalizado' and old.estado is distinct from 'finalizado' then
    v_resultado := case when new.goles_local > new.goles_visitante then 'local' when new.goles_local = new.goles_visitante then 'empate' else 'visitante' end;
    with liquidados as (
      update public.pronosticos_virtuales pr
      set estado = case when pr.seleccion = v_resultado then 'ganado' else 'perdido' end,
          resuelto_at = now()
      where pr.partido_id = new.id and pr.estado = 'pendiente'
      returning pr.usuario_id, pr.estado, pr.retorno_puntos
    )
    update public.carteras_virtuales cv
    set saldo_puntos = cv.saldo_puntos + case when l.estado = 'ganado' then l.retorno_puntos else 0 end,
        updated_at = now()
    from liquidados l where cv.usuario_id = l.usuario_id;
  elsif new.estado in ('cancelado', 'suspendido') and old.estado is distinct from new.estado then
    with anulados as (
      update public.pronosticos_virtuales pr
      set estado = 'anulado', resuelto_at = now()
      where pr.partido_id = new.id and pr.estado = 'pendiente'
      returning pr.usuario_id, pr.puntos_apostados
    )
    update public.carteras_virtuales cv
    set saldo_puntos = cv.saldo_puntos + a.puntos_apostados, updated_at = now()
    from anulados a where cv.usuario_id = a.usuario_id;
  end if;
  return new;
end;
$$;
revoke all on function private.liquidar_pronosticos_virtuales() from public, anon, authenticated, service_role;
drop trigger if exists al_cerrar_partido_liquidar_pronosticos_virtuales on public.partidos;
create trigger al_cerrar_partido_liquidar_pronosticos_virtuales after update of estado, goles_local, goles_visitante on public.partidos
for each row execute function private.liquidar_pronosticos_virtuales();

create or replace function public.crear_perfil_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre, apodo, ciudad)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email, ''), coalesce(new.raw_user_meta_data ->> 'nickname', ''), coalesce(new.raw_user_meta_data ->> 'city', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.crear_perfil_usuario() from public, anon, authenticated, service_role;

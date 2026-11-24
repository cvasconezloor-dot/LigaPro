-- SIGEC-LP · Esquema inicial para Supabase (PostgreSQL)
-- Los registros prefijados DEMO provienen de las pantallas Stitch y deben reemplazarse
-- con información oficial antes de habilitar una temporada real.

create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.rol_usuario as enum ('administrador', 'organizador', 'comisario', 'arbitro', 'disciplina', 'club', 'publico');
exception when duplicate_object then null; end $$;

create table if not exists public.competencias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  temporada integer not null check (temporada between 1900 and 2200),
  serie text not null check (serie in ('A', 'B')),
  formato text not null default 'fase_clasificatoria',
  estado text not null default 'borrador' check (estado in ('borrador', 'activa', 'cerrada', 'demo')),
  visible_publico boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (temporada, serie)
);

create table if not exists public.clubes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  sigla text not null unique,
  serie text not null default 'A' check (serie in ('A', 'B')),
  color_primario text,
  estadio text,
  escudo_path text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  rol public.rol_usuario not null default 'publico',
  club_id uuid references public.clubes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fases (
  id uuid primary key default gen_random_uuid(),
  competencia_id uuid not null references public.competencias(id) on delete cascade,
  nombre text not null,
  orden smallint not null default 1 check (orden > 0),
  jornadas smallint check (jornadas is null or jornadas > 0),
  estado text not null default 'borrador' check (estado in ('borrador', 'activa', 'cerrada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competencia_id, orden)
);

create table if not exists public.jugadores (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete cascade,
  nombre text not null,
  dorsal smallint not null check (dorsal between 1 and 99),
  posicion text not null default 'Sin asignar',
  nacionalidad text,
  fecha_nacimiento date,
  es_extranjero boolean not null default false,
  estado_comet text not null default 'pendiente' check (estado_comet in ('habilitado', 'pendiente', 'suspendido', 'no_elegible')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, dorsal)
);

create table if not exists public.partidos (
  id uuid primary key default gen_random_uuid(),
  competencia_id uuid not null references public.competencias(id) on delete restrict,
  fase_id uuid references public.fases(id) on delete set null,
  jornada smallint not null check (jornada > 0),
  club_local_id uuid not null references public.clubes(id) on delete restrict,
  club_visitante_id uuid not null references public.clubes(id) on delete restrict,
  fecha_hora timestamptz,
  estadio text,
  estado text not null default 'programado' check (estado in ('programado', 'en_vivo', 'finalizado', 'suspendido', 'cancelado')),
  goles_local smallint not null default 0 check (goles_local >= 0),
  goles_visitante smallint not null default 0 check (goles_visitante >= 0),
  visible_publico boolean not null default true,
  comisario_id uuid references public.perfiles(id) on delete set null,
  arbitro_id uuid references public.perfiles(id) on delete set null,
  acta_bloqueada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (club_local_id <> club_visitante_id)
);

create table if not exists public.alineaciones (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos(id) on delete cascade,
  jugador_id uuid not null references public.jugadores(id) on delete restrict,
  club_id uuid not null references public.clubes(id) on delete restrict,
  titular boolean not null default false,
  dorsal_partido smallint not null check (dorsal_partido between 1 and 99),
  estado_validacion text not null default 'pendiente' check (estado_validacion in ('pendiente', 'habilitado', 'observado', 'rechazado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partido_id, jugador_id)
);

create table if not exists public.incidencias (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos(id) on delete cascade,
  club_id uuid not null references public.clubes(id) on delete restrict,
  jugador_id uuid references public.jugadores(id) on delete set null,
  jugador_secundario_id uuid references public.jugadores(id) on delete set null,
  minuto smallint not null check (minuto between 0 and 130),
  tipo text not null check (tipo in ('gol', 'sustitucion', 'amarilla', 'roja', 'var', 'observacion', 'lesion')),
  detalle text not null default '',
  registrado_por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.actas (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null unique references public.partidos(id) on delete cascade,
  referencia_comet text,
  estado text not null default 'borrador' check (estado in ('borrador', 'validada', 'firmada', 'bloqueada', 'transmitida')),
  observaciones text not null default '',
  hash_documento text,
  firmada_por uuid references public.perfiles(id) on delete set null,
  firmada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sanciones (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references public.jugadores(id) on delete restrict,
  club_id uuid not null references public.clubes(id) on delete restrict,
  partido_id uuid references public.partidos(id) on delete set null,
  incidencia_id uuid references public.incidencias(id) on delete set null,
  infraccion text not null,
  jornadas_suspension smallint not null default 0 check (jornadas_suspension between 0 and 100),
  multa numeric(10,2) check (multa is null or multa >= 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'notificada', 'cumplida', 'apelada', 'anulada')),
  resuelta_por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comunicados (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria text not null default 'general',
  resumen text not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'publicado', 'archivado')),
  publicado_at timestamptz,
  autor_id uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (estado <> 'publicado' or publicado_at is not null)
);

create index if not exists fases_competencia_idx on public.fases(competencia_id, orden);
create index if not exists jugadores_club_idx on public.jugadores(club_id, activo);
create index if not exists perfiles_club_idx on public.perfiles(club_id) where club_id is not null;
create index if not exists partidos_fecha_idx on public.partidos(competencia_id, fecha_hora);
create index if not exists partidos_fase_idx on public.partidos(fase_id) where fase_id is not null;
create index if not exists partidos_club_local_idx on public.partidos(club_local_id);
create index if not exists partidos_club_visitante_idx on public.partidos(club_visitante_id);
create index if not exists partidos_comisario_idx on public.partidos(comisario_id) where comisario_id is not null;
create index if not exists partidos_arbitro_idx on public.partidos(arbitro_id) where arbitro_id is not null;
create index if not exists incidencias_partido_idx on public.incidencias(partido_id, minuto, created_at);
create index if not exists incidencias_club_idx on public.incidencias(club_id);
create index if not exists incidencias_jugador_idx on public.incidencias(jugador_id) where jugador_id is not null;
create index if not exists incidencias_jugador_secundario_idx on public.incidencias(jugador_secundario_id) where jugador_secundario_id is not null;
create index if not exists incidencias_registrado_por_idx on public.incidencias(registrado_por) where registrado_por is not null;
create index if not exists alineaciones_partido_club_idx on public.alineaciones(partido_id, club_id, titular);
create index if not exists alineaciones_jugador_idx on public.alineaciones(jugador_id);
create index if not exists alineaciones_club_idx on public.alineaciones(club_id);
create index if not exists actas_firmada_por_idx on public.actas(firmada_por) where firmada_por is not null;
create index if not exists sanciones_jugador_estado_idx on public.sanciones(jugador_id, estado);
create index if not exists sanciones_club_idx on public.sanciones(club_id);
create index if not exists sanciones_partido_idx on public.sanciones(partido_id) where partido_id is not null;
create index if not exists sanciones_incidencia_idx on public.sanciones(incidencia_id) where incidencia_id is not null;
create index if not exists sanciones_resuelta_por_idx on public.sanciones(resuelta_por) where resuelta_por is not null;
create index if not exists comunicados_publicacion_idx on public.comunicados(estado, publicado_at desc);
create index if not exists comunicados_autor_idx on public.comunicados(autor_id) where autor_id is not null;

create or replace function public.tocar_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['competencias','clubes','perfiles','fases','jugadores','partidos','alineaciones','actas','sanciones','comunicados'] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.tocar_updated_at()', table_name || '_updated_at', table_name);
  end loop;
end $$;

create or replace function public.crear_perfil_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_registrar_crear_perfil on auth.users;
create trigger al_registrar_crear_perfil after insert on auth.users
for each row execute function public.crear_perfil_usuario();

revoke all on function public.crear_perfil_usuario() from public, anon, authenticated, service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;

create or replace function private.tiene_rol(roles public.rol_usuario[])
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.rol = any($1)
  );
$$;

create or replace function private.es_responsable_partido(partido uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.partidos p
    where p.id = $1 and (p.comisario_id = (select auth.uid()) or p.arbitro_id = (select auth.uid()))
  );
$$;

revoke all on function private.tiene_rol(public.rol_usuario[]) from public, anon, service_role;
revoke all on function private.es_responsable_partido(uuid) from public, anon, service_role;
grant execute on function private.tiene_rol(public.rol_usuario[]) to authenticated;
grant execute on function private.es_responsable_partido(uuid) to authenticated;

create or replace function public.tiene_rol(roles public.rol_usuario[])
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.tiene_rol($1);
$$;

create or replace function public.es_responsable_partido(partido uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.es_responsable_partido($1);
$$;

revoke all on function public.tiene_rol(public.rol_usuario[]) from public, anon, service_role;
revoke all on function public.es_responsable_partido(uuid) from public, anon, service_role;
grant execute on function public.tiene_rol(public.rol_usuario[]) to authenticated;
grant execute on function public.es_responsable_partido(uuid) to authenticated;

revoke all on function public.tocar_updated_at() from public, anon, authenticated, service_role;

drop view if exists public.clasificacion_publica;
create view public.clasificacion_publica with (security_invoker = true) as
  with competencias_publicadas as (
    select id, serie from public.competencias
    where estado in ('activa', 'demo') and visible_publico = true
  ), resultados as (
    select p.competencia_id, p.club_local_id as club_id, p.estado,
      p.goles_local as gf, p.goles_visitante as gc
    from public.partidos p join competencias_publicadas cp on cp.id = p.competencia_id
    union all
    select p.competencia_id, p.club_visitante_id as club_id, p.estado,
      p.goles_visitante as gf, p.goles_local as gc
    from public.partidos p join competencias_publicadas cp on cp.id = p.competencia_id
  ), resumen as (
    select c.id as club_id, c.nombre as club, c.sigla, c.serie,
      count(r.club_id) filter (where r.estado = 'finalizado') as pj,
      count(r.club_id) filter (where r.estado = 'finalizado' and r.gf > r.gc) as pg,
      count(r.club_id) filter (where r.estado = 'finalizado' and r.gf = r.gc) as pe,
      count(r.club_id) filter (where r.estado = 'finalizado' and r.gf < r.gc) as pp,
      coalesce(sum(r.gf) filter (where r.estado = 'finalizado'), 0) as gf,
      coalesce(sum(r.gc) filter (where r.estado = 'finalizado'), 0) as gc,
      (count(r.club_id) filter (where r.estado = 'finalizado' and r.gf > r.gc) * 3 +
       count(r.club_id) filter (where r.estado = 'finalizado' and r.gf = r.gc)) as pts
    from public.clubes c
    left join resultados r on r.club_id = c.id
    where c.activo = true
      and exists (select 1 from competencias_publicadas cp where cp.serie = c.serie)
    group by c.id, c.nombre, c.sigla, c.serie
  )
  select row_number() over (partition by r.serie order by r.pts desc, (r.gf-r.gc) desc, r.gf desc, r.club) as posicion,
    r.club_id, r.club, r.sigla, r.serie, r.pj, r.pg, r.pe, r.pp, r.gf, r.gc, r.pts
  from resumen r
  order by r.serie, r.pts desc, (r.gf-r.gc) desc, r.gf desc, r.club;

alter table public.competencias enable row level security;
alter table public.clubes enable row level security;
alter table public.perfiles enable row level security;
alter table public.fases enable row level security;
alter table public.jugadores enable row level security;
alter table public.partidos enable row level security;
alter table public.alineaciones enable row level security;
alter table public.incidencias enable row level security;
alter table public.actas enable row level security;
alter table public.sanciones enable row level security;
alter table public.comunicados enable row level security;

drop policy if exists competencias_public_select on public.competencias;
create policy competencias_public_select on public.competencias for select
  using (visible_publico and estado in ('activa', 'demo'));
drop policy if exists competencias_staff_all on public.competencias;
create policy competencias_staff_all on public.competencias for all to authenticated
  using (public.tiene_rol(array['administrador','organizador']::public.rol_usuario[]))
  with check (public.tiene_rol(array['administrador','organizador']::public.rol_usuario[]));

drop policy if exists clubes_public_select on public.clubes;
create policy clubes_public_select on public.clubes for select using (activo = true);
drop policy if exists clubes_staff_all on public.clubes;
create policy clubes_staff_all on public.clubes for all to authenticated
  using (public.tiene_rol(array['administrador','organizador']::public.rol_usuario[]))
  with check (public.tiene_rol(array['administrador','organizador']::public.rol_usuario[]));

drop policy if exists perfiles_select_self_or_admin on public.perfiles;
create policy perfiles_select_self_or_admin on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or public.tiene_rol(array['administrador']::public.rol_usuario[]));
drop policy if exists perfiles_update_admin on public.perfiles;
create policy perfiles_update_admin on public.perfiles for update to authenticated
  using (public.tiene_rol(array['administrador']::public.rol_usuario[]))
  with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));

drop policy if exists fases_public_select on public.fases;
create policy fases_public_select on public.fases for select using (
  exists (select 1 from public.competencias c where c.id = competencia_id and c.visible_publico and c.estado in ('activa','demo'))
);
drop policy if exists fases_staff_all on public.fases;
create policy fases_staff_all on public.fases for all to authenticated
  using (public.tiene_rol(array['administrador','organizador']::public.rol_usuario[]))
  with check (public.tiene_rol(array['administrador','organizador']::public.rol_usuario[]));

drop policy if exists partidos_public_select on public.partidos;
create policy partidos_public_select on public.partidos for select using (
  visible_publico and exists (select 1 from public.competencias c where c.id = competencia_id and c.visible_publico and c.estado in ('activa','demo'))
);
drop policy if exists partidos_staff_select on public.partidos;
create policy partidos_staff_select on public.partidos for select to authenticated
  using (public.tiene_rol(array['administrador','organizador','comisario','arbitro','disciplina']::public.rol_usuario[])
    or comisario_id = (select auth.uid()) or arbitro_id = (select auth.uid()));
drop policy if exists partidos_staff_insert on public.partidos;
create policy partidos_staff_insert on public.partidos for insert to authenticated
  with check (public.tiene_rol(array['administrador','organizador','comisario']::public.rol_usuario[]));
drop policy if exists partidos_staff_update on public.partidos;
create policy partidos_staff_update on public.partidos for update to authenticated
  using (public.tiene_rol(array['administrador','organizador']::public.rol_usuario[]) or public.es_responsable_partido(id))
  with check (public.tiene_rol(array['administrador','organizador']::public.rol_usuario[]) or public.es_responsable_partido(id));
drop policy if exists partidos_admin_delete on public.partidos;
create policy partidos_admin_delete on public.partidos for delete to authenticated
  using (public.tiene_rol(array['administrador']::public.rol_usuario[]));

drop policy if exists jugadores_staff_select on public.jugadores;
create policy jugadores_staff_select on public.jugadores for select to authenticated
  using (public.tiene_rol(array['administrador','organizador','comisario','arbitro','disciplina']::public.rol_usuario[])
    or exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'club' and p.club_id = jugadores.club_id));
drop policy if exists jugadores_public_select on public.jugadores;
create policy jugadores_public_select on public.jugadores for select using (false);
drop policy if exists jugadores_staff_insert on public.jugadores;
create policy jugadores_staff_insert on public.jugadores for insert to authenticated
  with check (public.tiene_rol(array['administrador','organizador']::public.rol_usuario[])
    or exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'club' and p.club_id = jugadores.club_id));
drop policy if exists jugadores_staff_update on public.jugadores;
create policy jugadores_staff_update on public.jugadores for update to authenticated
  using (public.tiene_rol(array['administrador','organizador']::public.rol_usuario[])
    or exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'club' and p.club_id = jugadores.club_id))
  with check (public.tiene_rol(array['administrador','organizador']::public.rol_usuario[])
    or exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'club' and p.club_id = jugadores.club_id));
drop policy if exists jugadores_admin_delete on public.jugadores;
create policy jugadores_admin_delete on public.jugadores for delete to authenticated
  using (public.tiene_rol(array['administrador']::public.rol_usuario[]));

drop policy if exists alineaciones_staff_select on public.alineaciones;
create policy alineaciones_staff_select on public.alineaciones for select to authenticated
  using (public.tiene_rol(array['administrador','organizador','comisario','arbitro']::public.rol_usuario[])
    or exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'club' and p.club_id = alineaciones.club_id));
drop policy if exists alineaciones_staff_insert on public.alineaciones;
create policy alineaciones_staff_insert on public.alineaciones for insert to authenticated
  with check (public.tiene_rol(array['administrador','organizador','comisario','arbitro']::public.rol_usuario[])
    or exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'club' and p.club_id = alineaciones.club_id));
drop policy if exists alineaciones_staff_update on public.alineaciones;
create policy alineaciones_staff_update on public.alineaciones for update to authenticated
  using (public.tiene_rol(array['administrador','organizador','comisario','arbitro']::public.rol_usuario[])
    or exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'club' and p.club_id = alineaciones.club_id))
  with check (public.tiene_rol(array['administrador','organizador','comisario','arbitro']::public.rol_usuario[])
    or exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'club' and p.club_id = alineaciones.club_id));
drop policy if exists alineaciones_admin_delete on public.alineaciones;
create policy alineaciones_admin_delete on public.alineaciones for delete to authenticated
  using (public.tiene_rol(array['administrador']::public.rol_usuario[]));

drop policy if exists incidencias_staff_select on public.incidencias;
create policy incidencias_staff_select on public.incidencias for select to authenticated
  using (public.tiene_rol(array['administrador','organizador','comisario','arbitro','disciplina']::public.rol_usuario[]));
drop policy if exists incidencias_staff_insert on public.incidencias;
create policy incidencias_staff_insert on public.incidencias for insert to authenticated
  with check (
    public.tiene_rol(array['administrador']::public.rol_usuario[]) or
    (public.tiene_rol(array['comisario','arbitro']::public.rol_usuario[]) and public.es_responsable_partido(partido_id))
  );
drop policy if exists incidencias_staff_update on public.incidencias;
create policy incidencias_staff_update on public.incidencias for update to authenticated
  using (
    public.tiene_rol(array['administrador']::public.rol_usuario[]) or
    (public.tiene_rol(array['comisario']::public.rol_usuario[]) and public.es_responsable_partido(partido_id))
  )
  with check (
    public.tiene_rol(array['administrador']::public.rol_usuario[]) or
    (public.tiene_rol(array['comisario']::public.rol_usuario[]) and public.es_responsable_partido(partido_id))
  );
drop policy if exists incidencias_admin_delete on public.incidencias;
create policy incidencias_admin_delete on public.incidencias for delete to authenticated
  using (public.tiene_rol(array['administrador']::public.rol_usuario[]));

drop policy if exists actas_staff_select on public.actas;
create policy actas_staff_select on public.actas for select to authenticated
  using (public.tiene_rol(array['administrador','organizador','comisario','arbitro','disciplina']::public.rol_usuario[]));
drop policy if exists actas_staff_insert on public.actas;
create policy actas_staff_insert on public.actas for insert to authenticated
  with check (public.tiene_rol(array['administrador','comisario','arbitro']::public.rol_usuario[]));
drop policy if exists actas_staff_update on public.actas;
create policy actas_staff_update on public.actas for update to authenticated
  using (public.tiene_rol(array['administrador','comisario','arbitro']::public.rol_usuario[]))
  with check (public.tiene_rol(array['administrador','comisario','arbitro']::public.rol_usuario[]));
drop policy if exists actas_admin_delete on public.actas;
create policy actas_admin_delete on public.actas for delete to authenticated
  using (public.tiene_rol(array['administrador']::public.rol_usuario[]));

drop policy if exists sanciones_staff_select on public.sanciones;
create policy sanciones_staff_select on public.sanciones for select to authenticated
  using (public.tiene_rol(array['administrador','organizador','comisario','disciplina']::public.rol_usuario[]));
drop policy if exists sanciones_discipline_insert on public.sanciones;
create policy sanciones_discipline_insert on public.sanciones for insert to authenticated
  with check (public.tiene_rol(array['administrador','disciplina']::public.rol_usuario[]));
drop policy if exists sanciones_discipline_update on public.sanciones;
create policy sanciones_discipline_update on public.sanciones for update to authenticated
  using (public.tiene_rol(array['administrador','disciplina']::public.rol_usuario[]))
  with check (public.tiene_rol(array['administrador','disciplina']::public.rol_usuario[]));
drop policy if exists sanciones_admin_delete on public.sanciones;
create policy sanciones_admin_delete on public.sanciones for delete to authenticated
  using (public.tiene_rol(array['administrador']::public.rol_usuario[]));

drop policy if exists comunicados_public_select on public.comunicados;
create policy comunicados_public_select on public.comunicados for select
  using (estado = 'publicado' and publicado_at <= now());
drop policy if exists comunicados_staff_all on public.comunicados;
create policy comunicados_staff_all on public.comunicados for all to authenticated
  using (public.tiene_rol(array['administrador','organizador']::public.rol_usuario[]))
  with check (public.tiene_rol(array['administrador','organizador']::public.rol_usuario[]));

grant select on public.clasificacion_publica to anon, authenticated;
grant select on public.competencias, public.clubes, public.fases, public.partidos to anon, authenticated;
grant select, insert, update, delete on public.competencias, public.clubes, public.fases, public.partidos,
  public.perfiles, public.jugadores, public.alineaciones, public.incidencias, public.actas, public.sanciones, public.comunicados to authenticated;
grant select on public.comunicados to anon;
grant usage on type public.rol_usuario to authenticated;

-- Realtime para cambios del marcador y la cronología de incidencias.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'partidos') then
    alter publication supabase_realtime add table public.partidos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'incidencias') then
    alter publication supabase_realtime add table public.incidencias;
  end if;
end $$;

-- Buckets: escudos de lectura pública y actas privadas para personal autorizado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-escudos', 'club-escudos', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('actas-comet', 'actas-comet', false, 10485760, array['application/pdf','image/png','image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists escudos_read_public on storage.objects;
create policy escudos_read_public on storage.objects for select using (bucket_id = 'club-escudos');
drop policy if exists escudos_manage_staff on storage.objects;
create policy escudos_manage_staff on storage.objects for all to authenticated
  using (bucket_id = 'club-escudos' and public.tiene_rol(array['administrador','organizador']::public.rol_usuario[]))
  with check (bucket_id = 'club-escudos' and public.tiene_rol(array['administrador','organizador']::public.rol_usuario[]));
drop policy if exists actas_read_staff on storage.objects;
create policy actas_read_staff on storage.objects for select to authenticated
  using (bucket_id = 'actas-comet' and public.tiene_rol(array['administrador','organizador','comisario','arbitro','disciplina']::public.rol_usuario[]));
drop policy if exists actas_manage_staff on storage.objects;
create policy actas_manage_staff on storage.objects for all to authenticated
  using (bucket_id = 'actas-comet' and public.tiene_rol(array['administrador','comisario','arbitro']::public.rol_usuario[]))
  with check (bucket_id = 'actas-comet' and public.tiene_rol(array['administrador','comisario','arbitro']::public.rol_usuario[]));

-- Catálogo de muestra basado en los nombres que aparecen en las pantallas Stitch.
insert into public.competencias (id, nombre, temporada, serie, formato, estado, visible_publico)
values ('10000000-0000-4000-8000-000000000001', 'DEMO · LigaPro Ecuador Serie A', 2024, 'A', 'fase_clasificatoria', 'demo', true)
on conflict (id) do nothing;

insert into public.clubes (id, nombre, sigla, serie, color_primario, estadio) values
('20000000-0000-4000-8000-000000000001','Independiente del Valle','IDV','A','#111b38','Banco Guayaquil'),
('20000000-0000-4000-8000-000000000002','SD Aucas','AUC','A','#f1c948','Gonzalo Pozo Ripalda'),
('20000000-0000-4000-8000-000000000003','LDU Quito','LDU','A','#25324a','Rodrigo Paz Delgado'),
('20000000-0000-4000-8000-000000000004','Barcelona SC','BSC','A','#edc444','Monumental Banco Pichincha'),
('20000000-0000-4000-8000-000000000005','Universidad Católica','UCA','A','#5268a0','Olímpico Atahualpa'),
('20000000-0000-4000-8000-000000000006','CS Emelec','CSE','A','#253c75','George Capwell'),
('20000000-0000-4000-8000-000000000007','El Nacional','NAC','A','#cd302d','Olímpico Atahualpa'),
('20000000-0000-4000-8000-000000000008','Macará','MAC','A','#68707d','Bellavista'),
('20000000-0000-4000-8000-000000000009','Deportivo Cuenca','CUE','A','#b6282e','Alejandro Serrano Aguilar'),
('20000000-0000-4000-8000-000000000010','Orense SC','ORE','A','#138652','9 de Mayo'),
('20000000-0000-4000-8000-000000000011','Mushuc Runa','MRU','A','#35614f','Echaleche'),
('20000000-0000-4000-8000-000000000012','Cumbayá FC','CUM','A','#68707d','Olímpico Atahualpa'),
('20000000-0000-4000-8000-000000000013','Imbabura SC','IMB','A','#315e91','Olímpico de Ibarra'),
('20000000-0000-4000-8000-000000000014','Técnico Universitario','TEC','A','#bd2526','Bellavista'),
('20000000-0000-4000-8000-000000000015','Delfín SC','DEL','A','#1971aa','Jocay'),
('20000000-0000-4000-8000-000000000016','Libertad FC','LIB','A','#b6272e','Reina del Cisne')
on conflict (id) do nothing;

insert into public.fases (id, competencia_id, nombre, orden, jornadas, estado)
values ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Fase 1',1,15,'activa')
on conflict (id) do nothing;

insert into public.partidos (id, competencia_id, fase_id, jornada, club_local_id, club_visitante_id, fecha_hora, estadio, estado, goles_local, goles_visitante)
values
('40000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',11,'20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2024-05-11 18:00:00-05','Banco Guayaquil','finalizado',2,0),
('40000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',11,'20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000004','2024-05-11 19:00:00-05','Rodrigo Paz Delgado','finalizado',1,0),
('40000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',11,'20000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000006','2024-05-12 15:30:00-05','Olímpico Atahualpa','finalizado',1,1),
('40000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',11,'20000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000008','2024-05-12 18:00:00-05','Olímpico Atahualpa','finalizado',2,1),
('40000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',11,'20000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000010','2024-05-13 19:00:00-05','Alejandro Serrano Aguilar','finalizado',1,0),
('40000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',11,'20000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000012','2024-05-14 18:00:00-05','Echaleche','finalizado',1,1),
('40000000-0000-4000-8000-000000000017','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',11,'20000000-0000-4000-8000-000000000013','20000000-0000-4000-8000-000000000014','2024-05-14 19:00:00-05','Olímpico de Ibarra','finalizado',1,2),
('40000000-0000-4000-8000-000000000018','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',11,'20000000-0000-4000-8000-000000000015','20000000-0000-4000-8000-000000000016','2024-05-15 18:00:00-05','Jocay','finalizado',0,1),
('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',12,'20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','2024-05-18 18:00:00-05','Rodrigo Paz Delgado','en_vivo',2,1),
('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',12,'20000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000006','2024-05-18 19:00:00-05','Monumental Banco Pichincha','programado',0,0),
('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',12,'20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000007','2024-05-19 15:30:00-05','Gonzalo Pozo Ripalda','programado',0,0),
('40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',12,'20000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000015','2024-05-19 18:00:00-05','Olímpico Atahualpa','programado',0,0)
on conflict (id) do nothing;

insert into public.comunicados (id, titulo, categoria, resumen, estado, publicado_at)
values
('50000000-0000-4000-8000-000000000001','DEMO · Calendario de la jornada','Programación','Consulta horarios, estadios y estado de los encuentros de la fase.','publicado',now()),
('50000000-0000-4000-8000-000000000002','DEMO · Información de temporadas','Competiciones','Revisa el estado de las competencias y sus jornadas.','publicado',now()),
('50000000-0000-4000-8000-000000000003','DEMO · Resoluciones disciplinarias','Disciplina','Sanciones de muestra y estados de notificación.','publicado',now())
on conflict (id) do nothing;


-- Perfil de aficionado y pronósticos con puntos virtuales sin conversión monetaria.
alter table public.perfiles add column if not exists apodo text not null default '';
alter table public.perfiles add column if not exists ciudad text not null default '';
alter table public.perfiles add column if not exists club_favorito_id uuid;
alter table public.perfiles add column if not exists avatar_url text;
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
grant update (avatar_url) on public.perfiles to authenticated;
revoke all on public.carteras_virtuales, public.pronosticos_virtuales from anon, authenticated;
grant select on public.carteras_virtuales, public.pronosticos_virtuales to authenticated;

-- Fotos de perfil públicas; la escritura queda limitada a la carpeta del usuario.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_select_own on storage.objects;
create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

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


-- Snapshot actualizado con la migracion de consola, ranking y OAuth Google.
-- Reloj persistente, registro atomico de eventos y ranking publico solo con alias/puntos.
alter table public.partidos
  add column if not exists periodo text not null default 'pre_partido',
  add column if not exists reloj_inicio_at timestamptz,
  add column if not exists reloj_acumulado_segundos integer not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'partidos_periodo_check' and conrelid = 'public.partidos'::regclass) then
    alter table public.partidos add constraint partidos_periodo_check
      check (periodo in ('pre_partido', 'primer_tiempo', 'medio_tiempo', 'segundo_tiempo', 'final'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'partidos_reloj_acumulado_check' and conrelid = 'public.partidos'::regclass) then
    alter table public.partidos add constraint partidos_reloj_acumulado_check
      check (reloj_acumulado_segundos between 0 and 7800);
  end if;
end $$;

update public.partidos set periodo = case
  when estado = 'en_vivo' then 'primer_tiempo'
  when estado = 'finalizado' then 'final'
  else 'pre_partido'
end
where periodo = 'pre_partido' and estado in ('en_vivo', 'finalizado');
update public.partidos set reloj_inicio_at = clock_timestamp(), reloj_acumulado_segundos = 0
where estado = 'en_vivo' and reloj_inicio_at is null;

alter table public.incidencias drop constraint if exists incidencias_tipo_check;
alter table public.incidencias add constraint incidencias_tipo_check
  check (tipo in ('gol', 'sustitucion', 'amarilla', 'roja', 'var', 'observacion', 'lesion', 'inicio', 'medio_tiempo', 'inicio_segundo_tiempo', 'final'));

-- Eventos de partido visibles solo cuando son datos de marcador/cronologia publica.
drop policy if exists incidencias_live_public_select on public.incidencias;
create policy incidencias_live_public_select on public.incidencias for select to anon, authenticated
  using (tipo in ('gol', 'sustitucion', 'amarilla', 'roja', 'inicio', 'medio_tiempo', 'inicio_segundo_tiempo', 'final'));
grant select on public.incidencias to anon;
revoke insert, update, delete on public.incidencias from authenticated;
revoke update on public.partidos from authenticated;

-- La liquidacion y los movimientos de saldo solo se ejecutan desde funciones de confianza.
create or replace function private.registrar_pronostico_virtual(p_partido_id uuid, p_seleccion text, p_puntos integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_usuario uuid := (select auth.uid());
  v_partido public.partidos%rowtype;
  v_saldo integer;
  v_cuota numeric(5,2);
  v_pronostico uuid;
begin
  if v_usuario is null then raise exception 'Inicia sesion para participar.'; end if;
  if p_seleccion is null or p_seleccion not in ('local', 'empate', 'visitante') then raise exception 'Seleccion no valida.'; end if;
  if p_puntos is null or p_puntos < 10 or p_puntos > 500 then raise exception 'Usa entre 10 y 500 puntos virtuales.'; end if;
  if not exists (select 1 from public.perfiles pf where pf.id = v_usuario and btrim(pf.nombre) <> '' and btrim(pf.apodo) <> '') then
    raise exception 'Completa tu nombre y apodo antes de participar.';
  end if;

  select * into v_partido from public.partidos p where p.id = p_partido_id for update;
  if not found or v_partido.estado <> 'programado' or v_partido.fecha_hora is null or v_partido.fecha_hora <= clock_timestamp() then
    raise exception 'El partido ya no esta disponible para pronosticos.';
  end if;

  v_cuota := case p_seleccion when 'local' then 2.10 when 'empate' then 3.20 else 2.80 end;
  insert into public.carteras_virtuales (usuario_id) values (v_usuario) on conflict (usuario_id) do nothing;
  select c.saldo_puntos into v_saldo from public.carteras_virtuales c where c.usuario_id = v_usuario for update;
  if v_saldo < p_puntos then raise exception 'No tienes suficientes puntos virtuales.'; end if;

  update public.carteras_virtuales c set saldo_puntos = c.saldo_puntos - p_puntos, updated_at = clock_timestamp() where c.usuario_id = v_usuario;
  insert into public.pronosticos_virtuales (usuario_id, partido_id, seleccion, cuota, puntos_apostados)
  values (v_usuario, p_partido_id, p_seleccion, v_cuota, p_puntos) returning id into v_pronostico;
  return v_pronostico;
end;
$$;

create or replace function private.registrar_evento_en_vivo(
  p_partido_id uuid,
  p_accion text,
  p_club_id uuid default null,
  p_jugador_id uuid default null,
  p_jugador_secundario_id uuid default null,
  p_detalle text default ''
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_usuario uuid := (select auth.uid());
  v_partido public.partidos%rowtype;
  v_evento uuid;
  v_ahora timestamptz;
  v_segundos integer;
  v_minuto smallint;
  v_tipo text;
  v_club_jugador uuid;
begin
  if v_usuario is null then raise exception 'Inicia sesion para operar el partido.'; end if;
  if not coalesce(public.tiene_rol(array['administrador']::public.rol_usuario[]), false)
     and not (coalesce(public.tiene_rol(array['comisario','arbitro']::public.rol_usuario[]), false) and coalesce(public.es_responsable_partido(p_partido_id), false)) then
    raise exception 'No tienes autorizacion para registrar eventos de este partido.';
  end if;
  if p_accion is null then raise exception 'Accion no valida.'; end if;

  select * into v_partido from public.partidos p where p.id = p_partido_id for update;
  if not found then raise exception 'No existe el partido solicitado.'; end if;
  v_ahora := clock_timestamp();
  v_segundos := least(7800, greatest(0, coalesce(v_partido.reloj_acumulado_segundos, 0)
    + case when v_partido.reloj_inicio_at is null then 0 else floor(extract(epoch from (v_ahora - v_partido.reloj_inicio_at)))::integer end));
  v_minuto := least(130, floor(v_segundos / 60.0)::integer)::smallint;

  if p_accion = 'iniciar' then
    if v_partido.estado <> 'programado' then raise exception 'El partido no esta en estado programado.'; end if;
    if v_partido.fecha_hora is not null and v_partido.fecha_hora > v_ahora then raise exception 'Aun no llega la hora programada del partido.'; end if;
    update public.partidos set estado = 'en_vivo', periodo = 'primer_tiempo', reloj_inicio_at = v_ahora, reloj_acumulado_segundos = 0 where id = p_partido_id;
    v_segundos := 0; v_minuto := 0; v_tipo := 'inicio';
  elsif p_accion = 'medio_tiempo' then
    if v_partido.estado <> 'en_vivo' or v_partido.periodo <> 'primer_tiempo' then raise exception 'El partido no esta en el primer tiempo.'; end if;
    update public.partidos set periodo = 'medio_tiempo', reloj_inicio_at = null, reloj_acumulado_segundos = v_segundos where id = p_partido_id;
    v_tipo := 'medio_tiempo';
  elsif p_accion = 'inicio_segundo_tiempo' then
    if v_partido.estado <> 'en_vivo' or v_partido.periodo <> 'medio_tiempo' then raise exception 'El partido no esta en el medio tiempo.'; end if;
    update public.partidos set periodo = 'segundo_tiempo', reloj_inicio_at = v_ahora, reloj_acumulado_segundos = v_segundos where id = p_partido_id;
    v_tipo := 'inicio_segundo_tiempo';
  elsif p_accion = 'final' then
    if v_partido.estado <> 'en_vivo' then raise exception 'El partido no esta en vivo.'; end if;
    update public.partidos set estado = 'finalizado', periodo = 'final', reloj_inicio_at = null, reloj_acumulado_segundos = v_segundos where id = p_partido_id;
    v_tipo := 'final';
  else
    if p_accion not in ('gol', 'amarilla', 'roja', 'sustitucion') then raise exception 'Accion no valida.'; end if;
    if v_partido.estado <> 'en_vivo' or v_partido.periodo not in ('primer_tiempo', 'segundo_tiempo') then raise exception 'El partido no admite eventos en este momento.'; end if;
    if p_club_id is null or p_club_id not in (v_partido.club_local_id, v_partido.club_visitante_id) then raise exception 'Selecciona uno de los clubes del partido.'; end if;
    if p_jugador_id is not null then
      select j.club_id into v_club_jugador from public.jugadores j where j.id = p_jugador_id;
      if not found or v_club_jugador <> p_club_id then raise exception 'El jugador seleccionado no pertenece a ese club.'; end if;
    end if;
    if p_accion = 'sustitucion' then
      if p_jugador_id is null or p_jugador_secundario_id is null or p_jugador_id = p_jugador_secundario_id then raise exception 'Selecciona dos jugadores distintos para el cambio.'; end if;
      select j.club_id into v_club_jugador from public.jugadores j where j.id = p_jugador_secundario_id;
      if not found or v_club_jugador <> p_club_id then raise exception 'Los dos jugadores deben pertenecer al club seleccionado.'; end if;
    elsif p_jugador_secundario_id is not null then
      raise exception 'El segundo jugador solo se admite en una sustitucion.';
    end if;

    v_tipo := p_accion;
    if p_accion = 'gol' and p_club_id = v_partido.club_local_id then
      update public.partidos set goles_local = goles_local + 1 where id = p_partido_id;
    elsif p_accion = 'gol' then
      update public.partidos set goles_visitante = goles_visitante + 1 where id = p_partido_id;
    end if;
  end if;

  insert into public.incidencias (partido_id, club_id, jugador_id, jugador_secundario_id, minuto, tipo, detalle, registrado_por)
  values (p_partido_id, case when v_tipo in ('gol', 'sustitucion', 'amarilla', 'roja') then p_club_id else v_partido.club_local_id end, p_jugador_id, p_jugador_secundario_id, v_minuto, v_tipo, coalesce(btrim(p_detalle), ''), v_usuario)
  returning id into v_evento;
  return v_evento;
end;
$$;
revoke all on function private.registrar_evento_en_vivo(uuid, text, uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function private.registrar_evento_en_vivo(uuid, text, uuid, uuid, uuid, text) to authenticated;

create or replace function public.registrar_evento_en_vivo(
  p_partido_id uuid,
  p_accion text,
  p_club_id uuid default null,
  p_jugador_id uuid default null,
  p_jugador_secundario_id uuid default null,
  p_detalle text default ''
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.registrar_evento_en_vivo(p_partido_id, p_accion, p_club_id, p_jugador_id, p_jugador_secundario_id, p_detalle);
$$;
revoke all on function public.registrar_evento_en_vivo(uuid, text, uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.registrar_evento_en_vivo(uuid, text, uuid, uuid, uuid, text) to authenticated;

-- El RPC del ranking devuelve solo apodo y rendimiento, sin grants de lectura a las tablas privadas.
create or replace function private.obtener_ranking_pronosticos()
returns table (posicion integer, apodo text, puntos integer, aciertos integer, total_pronosticos integer)
language sql stable security definer set search_path = '' as $$
  select row_number() over (
           order by cv.saldo_puntos desc,
             count(pr.id) filter (where pr.estado = 'ganado') desc,
             p.apodo asc
         )::integer as posicion,
         p.apodo,
         cv.saldo_puntos as puntos,
         (count(pr.id) filter (where pr.estado = 'ganado'))::integer as aciertos,
         count(pr.id)::integer as total_pronosticos
  from public.perfiles p
  join public.carteras_virtuales cv on cv.usuario_id = p.id
  left join public.pronosticos_virtuales pr on pr.usuario_id = p.id and pr.estado <> 'anulado'
  where p.rol = 'publico' and nullif(btrim(p.apodo), '') is not null
  group by p.id, p.apodo, cv.saldo_puntos;
$$;
revoke all on function private.obtener_ranking_pronosticos() from public, anon, authenticated, service_role;
grant usage on schema private to anon;
grant execute on function private.obtener_ranking_pronosticos() to anon, authenticated;

create or replace function public.obtener_ranking_pronosticos()
returns table (posicion integer, apodo text, puntos integer, aciertos integer, total_pronosticos integer)
language sql stable security invoker set search_path = '' as $$
  select * from private.obtener_ranking_pronosticos();
$$;
revoke all on function public.obtener_ranking_pronosticos() from public, anon, authenticated, service_role;
grant execute on function public.obtener_ranking_pronosticos() to anon, authenticated;

-- Realtime privado por usuario y ranking son consultados por vistas seguras/polling.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'carteras_virtuales') then
    alter publication supabase_realtime add table public.carteras_virtuales;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pronosticos_virtuales') then
    alter publication supabase_realtime add table public.pronosticos_virtuales;
  end if;
end $$;

create or replace function public.crear_perfil_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_nombre text := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), new.email, '');
  v_apodo text := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nickname'), ''), nullif(btrim(new.raw_user_meta_data ->> 'preferred_username'), ''), nullif(split_part(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), ' ', 1), ''), '');
  v_avatar text := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''), nullif(btrim(new.raw_user_meta_data ->> 'picture'), ''));
begin
  insert into public.perfiles as perfil (id, nombre, apodo, ciudad, avatar_url)
  values (new.id, v_nombre, v_apodo, coalesce(new.raw_user_meta_data ->> 'city', ''), v_avatar)
  on conflict (id) do update set
    nombre = case when btrim(perfil.nombre) = '' then excluded.nombre else perfil.nombre end,
    apodo = case when btrim(perfil.apodo) = '' then excluded.apodo else perfil.apodo end,
    avatar_url = coalesce(perfil.avatar_url, excluded.avatar_url);
  return new;
end;
$$;
revoke all on function public.crear_perfil_usuario() from public, anon, authenticated, service_role;

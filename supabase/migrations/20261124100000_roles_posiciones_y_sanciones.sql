-- SIGEC-LP: cuatro roles de aplicación, permisos RLS, posiciones y sanciones por tarjetas.

-- Rol de aplicación estable, conservando el enum anterior para compatibilidad con RPC existentes.
alter table public.perfiles add column if not exists rol_app text not null default 'aficionado';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfiles_rol_app_check' and conrelid = 'public.perfiles'::regclass) then
    alter table public.perfiles add constraint perfiles_rol_app_check check (rol_app in ('aficionado','operador','arbitro','administrador'));
  end if;
end $$;
update public.perfiles set rol_app = case rol::text
  when 'administrador' then 'administrador' when 'organizador' then 'administrador' when 'disciplina' then 'administrador'
  when 'comisario' then 'operador' when 'arbitro' then 'arbitro' else 'aficionado' end
where rol_app = 'aficionado' and rol::text <> 'publico';
update public.perfiles set rol = 'publico' where rol = 'club';
create index if not exists perfiles_club_favorito_idx on public.perfiles(club_favorito_id) where club_favorito_id is not null;

-- La cuenta solo modifica campos de perfil; los roles se asignan mediante una función validada.
revoke update on public.perfiles from authenticated;
grant update (nombre, apodo, ciudad, club_favorito_id, avatar_url) on public.perfiles to authenticated;

-- La autorización deriva del rol canónico; el usuario no puede editar rol_app desde el cliente.
create or replace function private.tiene_rol(roles public.rol_usuario[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and (
      (p.rol_app = 'administrador' and $1 && array['administrador','organizador','disciplina']::public.rol_usuario[]) or
      (p.rol_app = 'operador' and 'comisario'::public.rol_usuario = any($1)) or
      (p.rol_app = 'arbitro' and 'arbitro'::public.rol_usuario = any($1)) or
      (p.rol_app = 'aficionado' and 'publico'::public.rol_usuario = any($1))
    )
  );
$$;
revoke all on function private.tiene_rol(public.rol_usuario[]) from public, anon, service_role;
grant execute on function private.tiene_rol(public.rol_usuario[]) to authenticated;

create or replace function public.administrar_rol_perfil(p_usuario_id uuid, p_rol text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(private.tiene_rol(array['administrador']::public.rol_usuario[]), false) then
    raise exception 'Solo una cuenta administradora puede asignar roles.';
  end if;
  if p_rol is null or p_rol not in ('aficionado','operador','arbitro','administrador') then
    raise exception 'Rol no válido.';
  end if;
  update public.perfiles set
    rol_app=p_rol,
    rol=case p_rol when 'operador' then 'comisario'::public.rol_usuario
      when 'arbitro' then 'arbitro'::public.rol_usuario
      when 'administrador' then 'administrador'::public.rol_usuario
      else 'publico'::public.rol_usuario end,
    updated_at=clock_timestamp()
  where id=p_usuario_id;
  if not found then raise exception 'No existe el perfil solicitado.'; end if;
end;
$$;
revoke all on function public.administrar_rol_perfil(uuid,text) from public,anon,service_role;
grant execute on function public.administrar_rol_perfil(uuid,text) to authenticated;

create or replace function public.asignar_oficial_partido(p_partido_id uuid, p_campo text, p_usuario_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_rol text;
begin
  if not coalesce(private.tiene_rol(array['administrador']::public.rol_usuario[]), false) then
    raise exception 'Solo una cuenta administradora puede asignar oficiales.';
  end if;
  if p_campo is null or p_campo not in ('arbitro_id','comisario_id') then raise exception 'Tipo de asignación no válido.'; end if;
  if p_usuario_id is not null then
    select p.rol_app into v_rol from public.perfiles p where p.id=p_usuario_id;
    if not found then raise exception 'No existe el perfil seleccionado.'; end if;
    if (p_campo='arbitro_id' and v_rol<>'arbitro') or (p_campo='comisario_id' and v_rol<>'operador') then
      raise exception 'El perfil debe tener el rol requerido para esta asignación.';
    end if;
  end if;
  update public.partidos set arbitro_id=case when p_campo='arbitro_id' then p_usuario_id else arbitro_id end,
    comisario_id=case when p_campo='comisario_id' then p_usuario_id else comisario_id end
  where id=p_partido_id;
  if not found then raise exception 'No existe el partido solicitado.'; end if;
end;
$$;
revoke all on function public.asignar_oficial_partido(uuid,text,uuid) from public,anon,service_role;
grant execute on function public.asignar_oficial_partido(uuid,text,uuid) to authenticated;

-- Un operador registra eventos; COMET queda reservado a árbitros y administradores.
create or replace function private.registrar_evento_en_vivo(
  p_partido_id uuid, p_accion text, p_club_id uuid default null,
  p_jugador_id uuid default null, p_jugador_secundario_id uuid default null, p_detalle text default ''
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
  if v_usuario is null then raise exception 'Inicia sesión para operar el partido.'; end if;
  if not coalesce(public.tiene_rol(array['administrador']::public.rol_usuario[]), false)
     and not (coalesce(public.tiene_rol(array['comisario']::public.rol_usuario[]), false) and coalesce(public.es_responsable_partido(p_partido_id), false)) then
    raise exception 'Solo operador o administrador puede registrar eventos en vivo.';
  end if;
  if p_accion is null then raise exception 'Acción no válida.'; end if;

  select * into v_partido from public.partidos p where p.id = p_partido_id for update;
  if not found then raise exception 'No existe el partido solicitado.'; end if;
  v_ahora := clock_timestamp();
  v_segundos := least(7800, greatest(0, coalesce(v_partido.reloj_acumulado_segundos, 0)
    + case when v_partido.reloj_inicio_at is null then 0 else floor(extract(epoch from (v_ahora - v_partido.reloj_inicio_at)))::integer end));
  v_minuto := least(130, floor(v_segundos / 60.0)::integer)::smallint;

  if p_accion = 'iniciar' then
    if v_partido.estado <> 'programado' then raise exception 'El partido no está en estado programado.'; end if;
    if v_partido.fecha_hora is not null and v_partido.fecha_hora > v_ahora then raise exception 'Aún no llega la hora programada.'; end if;
    update public.partidos set estado='en_vivo', periodo='primer_tiempo', reloj_inicio_at=v_ahora, reloj_acumulado_segundos=0 where id=p_partido_id;
    v_segundos := 0; v_minuto := 0; v_tipo := 'inicio';
  elsif p_accion = 'medio_tiempo' then
    if v_partido.estado <> 'en_vivo' or v_partido.periodo <> 'primer_tiempo' then raise exception 'El partido no está en el primer tiempo.'; end if;
    update public.partidos set periodo='medio_tiempo', reloj_inicio_at=null, reloj_acumulado_segundos=v_segundos where id=p_partido_id;
    v_tipo := 'medio_tiempo';
  elsif p_accion = 'inicio_segundo_tiempo' then
    if v_partido.estado <> 'en_vivo' or v_partido.periodo <> 'medio_tiempo' then raise exception 'El partido no está en el medio tiempo.'; end if;
    update public.partidos set periodo='segundo_tiempo', reloj_inicio_at=v_ahora, reloj_acumulado_segundos=v_segundos where id=p_partido_id;
    v_tipo := 'inicio_segundo_tiempo';
  elsif p_accion = 'final' then
    if v_partido.estado <> 'en_vivo' then raise exception 'El partido no está en vivo.'; end if;
    update public.partidos set estado='finalizado', periodo='final', reloj_inicio_at=null, reloj_acumulado_segundos=v_segundos where id=p_partido_id;
    v_tipo := 'final';
  else
    if p_accion not in ('gol','amarilla','roja','sustitucion') then raise exception 'Acción no válida.'; end if;
    if v_partido.estado <> 'en_vivo' or v_partido.periodo not in ('primer_tiempo','segundo_tiempo') then raise exception 'El partido no admite eventos en este momento.'; end if;
    if p_club_id is null or p_club_id not in (v_partido.club_local_id,v_partido.club_visitante_id) then raise exception 'Selecciona uno de los clubes del partido.'; end if;
    if p_jugador_id is not null then
      select j.club_id into v_club_jugador from public.jugadores j where j.id=p_jugador_id;
      if not found or v_club_jugador <> p_club_id then raise exception 'El jugador no pertenece al club seleccionado.'; end if;
    end if;
    if p_accion='sustitucion' then
      if p_jugador_id is null or p_jugador_secundario_id is null or p_jugador_id=p_jugador_secundario_id then raise exception 'Selecciona dos jugadores distintos.'; end if;
      select j.club_id into v_club_jugador from public.jugadores j where j.id=p_jugador_secundario_id;
      if not found or v_club_jugador <> p_club_id then raise exception 'Los dos jugadores deben pertenecer al club seleccionado.'; end if;
    elsif p_jugador_secundario_id is not null then raise exception 'El segundo jugador solo se admite en una sustitución.';
    end if;
    v_tipo := p_accion;
    if p_accion='gol' and p_club_id=v_partido.club_local_id then
      update public.partidos set goles_local=goles_local+1 where id=p_partido_id;
    elsif p_accion='gol' then
      update public.partidos set goles_visitante=goles_visitante+1 where id=p_partido_id;
    end if;
  end if;

  insert into public.incidencias (partido_id,club_id,jugador_id,jugador_secundario_id,minuto,tipo,detalle,registrado_por)
  values (p_partido_id,case when v_tipo in ('gol','sustitucion','amarilla','roja') then p_club_id else v_partido.club_local_id end,
    p_jugador_id,p_jugador_secundario_id,v_minuto,v_tipo,coalesce(btrim(p_detalle),''),v_usuario)
  returning id into v_evento;
  return v_evento;
end;
$$;
revoke all on function private.registrar_evento_en_vivo(uuid,text,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.registrar_evento_en_vivo(uuid,text,uuid,uuid,uuid,text) to authenticated;

-- Tabla de posiciones por competencia; el cierre de un partido actualiza la vista al instante.
drop view if exists public.clasificacion_publica;
create view public.clasificacion_publica with (security_invoker = true) as
with competencias_publicadas as (
  select id,serie,temporada from public.competencias where estado in ('activa','demo') and visible_publico=true
), resultados as (
  select p.competencia_id,p.club_local_id as club_id,p.estado,p.jornada,p.fecha_hora,
    p.goles_local as gf,p.goles_visitante as gc,
    case when p.goles_local>p.goles_visitante then 'G' when p.goles_local=p.goles_visitante then 'E' else 'P' end as forma
  from public.partidos p join competencias_publicadas cp on cp.id=p.competencia_id
  union all
  select p.competencia_id,p.club_visitante_id as club_id,p.estado,p.jornada,p.fecha_hora,
    p.goles_visitante as gf,p.goles_local as gc,
    case when p.goles_visitante>p.goles_local then 'G' when p.goles_visitante=p.goles_local then 'E' else 'P' end as forma
  from public.partidos p join competencias_publicadas cp on cp.id=p.competencia_id
), resumen as (
  select cp.id as competencia_id,cp.temporada,c.id as club_id,c.nombre as club,c.sigla,c.serie,
    count(r.club_id) filter (where r.estado='finalizado')::integer as pj,
    count(r.club_id) filter (where r.estado='finalizado' and r.gf>r.gc)::integer as pg,
    count(r.club_id) filter (where r.estado='finalizado' and r.gf=r.gc)::integer as pe,
    count(r.club_id) filter (where r.estado='finalizado' and r.gf<r.gc)::integer as pp,
    coalesce(sum(r.gf) filter (where r.estado='finalizado'),0)::integer as gf,
    coalesce(sum(r.gc) filter (where r.estado='finalizado'),0)::integer as gc,
    (coalesce(sum(r.gf) filter (where r.estado='finalizado'),0)-coalesce(sum(r.gc) filter (where r.estado='finalizado'),0))::integer as dg,
    (count(r.club_id) filter (where r.estado='finalizado' and r.gf>r.gc)*3+
     count(r.club_id) filter (where r.estado='finalizado' and r.gf=r.gc))::integer as pts,
    coalesce((select array_agg(f.forma order by f.jornada desc,f.fecha_hora desc)
      from (select r2.forma,r2.jornada,r2.fecha_hora from resultados r2
        where r2.competencia_id=cp.id and r2.club_id=c.id and r2.estado='finalizado'
        order by r2.jornada desc,r2.fecha_hora desc limit 5) f),array[]::text[]) as ultimas_5
  from competencias_publicadas cp join public.clubes c on c.activo=true and c.serie=cp.serie
  left join resultados r on r.competencia_id=cp.id and r.club_id=c.id
  group by cp.id,cp.temporada,c.id,c.nombre,c.sigla,c.serie
)
select row_number() over (partition by r.competencia_id order by r.pts desc,r.dg desc,r.gf desc,r.club)::integer as posicion,
  r.competencia_id,r.temporada,r.club_id,r.club,r.sigla,r.serie,r.pj,r.pg,r.pe,r.pp,r.gf,r.gc,r.dg,r.pts,r.ultimas_5
from resumen r order by r.competencia_id,r.pts desc,r.dg desc,r.gf desc,r.club;
revoke all on public.clasificacion_publica from public,anon,authenticated;
grant select on public.clasificacion_publica to anon,authenticated;
-- Lectura pública y acceso institucional consolidado para evitar permisos más amplios.
drop policy if exists competencias_public_select on public.competencias;
drop policy if exists competencias_staff_all on public.competencias;
create policy competencias_anon_select on public.competencias for select to anon using (visible_publico and estado in ('activa','demo'));
create policy competencias_auth_select on public.competencias for select to authenticated
  using ((visible_publico and estado in ('activa','demo')) or public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy competencias_admin_insert on public.competencias for insert to authenticated with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy competencias_admin_update on public.competencias for update to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[])) with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy competencias_admin_delete on public.competencias for delete to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[]));

drop policy if exists clubes_public_select on public.clubes;
drop policy if exists clubes_staff_all on public.clubes;
create policy clubes_anon_select on public.clubes for select to anon using (activo=true);
create policy clubes_auth_select on public.clubes for select to authenticated using (activo=true or public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy clubes_admin_insert on public.clubes for insert to authenticated with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy clubes_admin_update on public.clubes for update to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[])) with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy clubes_admin_delete on public.clubes for delete to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[]));

drop policy if exists fases_public_select on public.fases;
drop policy if exists fases_staff_all on public.fases;
create policy fases_anon_select on public.fases for select to anon using (exists(select 1 from public.competencias c where c.id=competencia_id and c.visible_publico and c.estado in ('activa','demo')));
create policy fases_auth_select on public.fases for select to authenticated using (
  exists(select 1 from public.competencias c where c.id=competencia_id and c.visible_publico and c.estado in ('activa','demo')) or public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy fases_admin_insert on public.fases for insert to authenticated with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy fases_admin_update on public.fases for update to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[])) with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy fases_admin_delete on public.fases for delete to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[]));

drop policy if exists partidos_public_select on public.partidos;
drop policy if exists partidos_staff_select on public.partidos;
drop policy if exists partidos_staff_insert on public.partidos;
drop policy if exists partidos_staff_update on public.partidos;
drop policy if exists partidos_admin_delete on public.partidos;
create policy partidos_anon_select on public.partidos for select to anon using (
  visible_publico and exists(select 1 from public.competencias c where c.id=competencia_id and c.visible_publico and c.estado in ('activa','demo')));
create policy partidos_auth_select on public.partidos for select to authenticated using (
  (visible_publico and exists(select 1 from public.competencias c where c.id=competencia_id and c.visible_publico and c.estado in ('activa','demo')))
  or public.tiene_rol(array['administrador']::public.rol_usuario[]) or
  (public.tiene_rol(array['comisario','arbitro']::public.rol_usuario[]) and (comisario_id=(select auth.uid()) or arbitro_id=(select auth.uid()))));
create policy partidos_admin_insert on public.partidos for insert to authenticated with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy partidos_admin_update on public.partidos for update to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[])) with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy partidos_admin_delete on public.partidos for delete to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[]));
revoke update on public.partidos from authenticated;

drop policy if exists jugadores_public_select on public.jugadores;
drop policy if exists jugadores_staff_select on public.jugadores;
drop policy if exists jugadores_staff_insert on public.jugadores;
drop policy if exists jugadores_staff_update on public.jugadores;
drop policy if exists jugadores_admin_delete on public.jugadores;
create policy jugadores_staff_select on public.jugadores for select to authenticated using (
  public.tiene_rol(array['administrador']::public.rol_usuario[]) or (public.tiene_rol(array['comisario','arbitro']::public.rol_usuario[]) and exists(
    select 1 from public.partidos p where public.es_responsable_partido(p.id)
      and club_id in (p.club_local_id,p.club_visitante_id)
  )));
create policy jugadores_admin_insert on public.jugadores for insert to authenticated with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy jugadores_admin_update on public.jugadores for update to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[])) with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy jugadores_admin_delete on public.jugadores for delete to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[]));

drop policy if exists alineaciones_staff_select on public.alineaciones;
drop policy if exists alineaciones_staff_insert on public.alineaciones;
drop policy if exists alineaciones_staff_update on public.alineaciones;
drop policy if exists alineaciones_admin_delete on public.alineaciones;
create policy alineaciones_staff_select on public.alineaciones for select to authenticated using (
  public.tiene_rol(array['administrador']::public.rol_usuario[]) or (public.tiene_rol(array['arbitro','comisario']::public.rol_usuario[]) and public.es_responsable_partido(partido_id)));
create policy alineaciones_staff_insert on public.alineaciones for insert to authenticated with check (
  public.tiene_rol(array['administrador']::public.rol_usuario[]) or (public.tiene_rol(array['arbitro']::public.rol_usuario[]) and public.es_responsable_partido(partido_id)));
create policy alineaciones_staff_update on public.alineaciones for update to authenticated using (
  public.tiene_rol(array['administrador']::public.rol_usuario[]) or (public.tiene_rol(array['arbitro']::public.rol_usuario[]) and public.es_responsable_partido(partido_id))) with check (
  public.tiene_rol(array['administrador']::public.rol_usuario[]) or (public.tiene_rol(array['arbitro']::public.rol_usuario[]) and public.es_responsable_partido(partido_id)));
create policy alineaciones_admin_delete on public.alineaciones for delete to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[]));

drop policy if exists incidencias_live_public_select on public.incidencias;
drop policy if exists incidencias_staff_select on public.incidencias;
drop policy if exists incidencias_staff_insert on public.incidencias;
drop policy if exists incidencias_staff_update on public.incidencias;
drop policy if exists incidencias_admin_delete on public.incidencias;
create policy incidencias_anon_select on public.incidencias for select to anon using (
  tipo in ('gol','sustitucion','amarilla','roja','inicio','medio_tiempo','inicio_segundo_tiempo','final') and exists(
    select 1 from public.partidos p join public.competencias c on c.id=p.competencia_id
    where p.id=partido_id and p.visible_publico and c.visible_publico and c.estado in ('activa','demo')));
create policy incidencias_auth_select on public.incidencias for select to authenticated using (
  (tipo in ('gol','sustitucion','amarilla','roja','inicio','medio_tiempo','inicio_segundo_tiempo','final') and exists(
    select 1 from public.partidos p join public.competencias c on c.id=p.competencia_id
    where p.id=partido_id and p.visible_publico and c.visible_publico and c.estado in ('activa','demo')))
  or public.tiene_rol(array['administrador']::public.rol_usuario[]) or exists(
    select 1 from public.partidos p where p.id=partido_id and public.tiene_rol(array['comisario','arbitro']::public.rol_usuario[])
      and (p.comisario_id=(select auth.uid()) or p.arbitro_id=(select auth.uid()))));
revoke insert,update,delete on public.incidencias from authenticated;

-- RLS de COMET y disciplina. El árbitro consulta sanciones vigentes; operador no altera planillas.
drop policy if exists actas_staff_select on public.actas;
drop policy if exists actas_staff_insert on public.actas;
drop policy if exists actas_staff_update on public.actas;
drop policy if exists actas_admin_delete on public.actas;
create policy actas_staff_select on public.actas for select to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[]) or (public.tiene_rol(array['arbitro']::public.rol_usuario[]) and public.es_responsable_partido(partido_id)));
create policy actas_staff_insert on public.actas for insert to authenticated with check (public.tiene_rol(array['administrador']::public.rol_usuario[]) or (public.tiene_rol(array['arbitro']::public.rol_usuario[]) and public.es_responsable_partido(partido_id)));
create policy actas_staff_update on public.actas for update to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[]) or (public.tiene_rol(array['arbitro']::public.rol_usuario[]) and public.es_responsable_partido(partido_id))) with check (public.tiene_rol(array['administrador']::public.rol_usuario[]) or (public.tiene_rol(array['arbitro']::public.rol_usuario[]) and public.es_responsable_partido(partido_id)));
create policy actas_admin_delete on public.actas for delete to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[]));
drop policy if exists sanciones_staff_select on public.sanciones;
drop policy if exists sanciones_discipline_insert on public.sanciones;
drop policy if exists sanciones_discipline_update on public.sanciones;
drop policy if exists sanciones_admin_delete on public.sanciones;
create policy sanciones_staff_select on public.sanciones for select to authenticated using (public.tiene_rol(array['administrador','arbitro']::public.rol_usuario[]));
create policy sanciones_admin_insert on public.sanciones for insert to authenticated with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy sanciones_admin_update on public.sanciones for update to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[])) with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy sanciones_admin_delete on public.sanciones for delete to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[]));

drop policy if exists comunicados_public_select on public.comunicados;
drop policy if exists comunicados_staff_all on public.comunicados;
create policy comunicados_anon_select on public.comunicados for select to anon using (estado='publicado' and publicado_at<=now());
create policy comunicados_auth_select on public.comunicados for select to authenticated using (
  (estado='publicado' and publicado_at<=now()) or public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy comunicados_admin_insert on public.comunicados for insert to authenticated with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy comunicados_admin_update on public.comunicados for update to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[])) with check (public.tiene_rol(array['administrador']::public.rol_usuario[]));
create policy comunicados_admin_delete on public.comunicados for delete to authenticated using (public.tiene_rol(array['administrador']::public.rol_usuario[]));

-- Reglas de suspensión por expulsión directa o segunda amarilla; se cumplen al cerrar la siguiente fecha del club.
alter table public.sanciones
  add column if not exists jornada_inicio smallint,
  add column if not exists jornadas_cumplidas smallint not null default 0,
  add column if not exists ultima_jornada_cumplida smallint,
  add column if not exists automatica boolean not null default false;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='sanciones_jornada_inicio_check' and conrelid='public.sanciones'::regclass) then
    alter table public.sanciones add constraint sanciones_jornada_inicio_check check (jornada_inicio is null or jornada_inicio>0);
  end if;
  if not exists(select 1 from pg_constraint where conname='sanciones_jornadas_cumplidas_check' and conrelid='public.sanciones'::regclass) then
    alter table public.sanciones add constraint sanciones_jornadas_cumplidas_check check (jornadas_cumplidas between 0 and jornadas_suspension);
  end if;
end $$;
update public.sanciones s set jornada_inicio=coalesce(
  (select p.jornada+1 from public.partidos p where p.id=s.partido_id),
  (select min(p.jornada) from public.partidos p where p.estado='programado' and (p.club_local_id=s.club_id or p.club_visitante_id=s.club_id) and (p.fecha_hora is null or p.fecha_hora>now())),
  (select max(p.jornada)+1 from public.partidos p where p.club_local_id=s.club_id or p.club_visitante_id=s.club_id),1)
where s.jornada_inicio is null and s.jornadas_suspension>0;
create index if not exists sanciones_jugador_vigentes_idx on public.sanciones(jugador_id,estado,jornada_inicio) where estado in ('pendiente','notificada');
create unique index if not exists sanciones_auto_incidencia_idx on public.sanciones(incidencia_id) where automatica and incidencia_id is not null;
create unique index if not exists sanciones_auto_partido_jugador_idx on public.sanciones(partido_id,jugador_id) where automatica and partido_id is not null;

create or replace function private.establecer_jornada_sancion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_jornada smallint;
begin
  if new.jornadas_cumplidas is null then new.jornadas_cumplidas:=0; end if;
  if new.jornadas_suspension>0 and new.jornada_inicio is null then
    if new.partido_id is not null then
      select p.jornada+1 into v_jornada from public.partidos p where p.id=new.partido_id;
    end if;
    if v_jornada is null then
      select p.jornada into v_jornada from public.partidos p
      where (p.club_local_id=new.club_id or p.club_visitante_id=new.club_id) and p.estado='programado'
        and (p.fecha_hora is null or p.fecha_hora>clock_timestamp()) order by p.fecha_hora nulls last,p.jornada limit 1;
    end if;
    if v_jornada is null then
      select max(p.jornada)+1 into v_jornada from public.partidos p where p.club_local_id=new.club_id or p.club_visitante_id=new.club_id;
    end if;
    new.jornada_inicio:=coalesce(v_jornada,1);
  end if;
  return new;
end;
$$;
revoke all on function private.establecer_jornada_sancion() from public,anon,authenticated,service_role;
drop trigger if exists antes_sancion_asignar_jornada on public.sanciones;
create trigger antes_sancion_asignar_jornada before insert on public.sanciones for each row execute function private.establecer_jornada_sancion();

create or replace function private.sincronizar_estado_sancion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.jugadores j set estado_comet=case when exists(
    select 1 from public.sanciones s where s.jugador_id=new.jugador_id and s.estado in ('pendiente','notificada')
      and s.jornadas_suspension>s.jornadas_cumplidas
  ) then 'suspendido' when j.estado_comet='suspendido' then 'habilitado' else j.estado_comet end
  where j.id=new.jugador_id;
  return new;
end;
$$;
revoke all on function private.sincronizar_estado_sancion() from public,anon,authenticated,service_role;
drop trigger if exists al_cambiar_sancion_actualizar_jugador on public.sanciones;
create trigger al_cambiar_sancion_actualizar_jugador after insert or update on public.sanciones for each row execute function private.sincronizar_estado_sancion();

create or replace function private.generar_sancion_por_tarjeta()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_partido public.partidos%rowtype;
  v_amarillas integer;
  v_infraccion text;
  v_insertadas integer;
begin
  if new.tipo not in ('roja','amarilla') or new.jugador_id is null then return new; end if;
  select * into v_partido from public.partidos p where p.id=new.partido_id;
  if not found then return new; end if;
  if new.tipo='roja' then
    v_infraccion:='Expulsión por tarjeta roja';
  else
    select count(*) into v_amarillas from public.incidencias i
      where i.partido_id=new.partido_id and i.jugador_id=new.jugador_id and i.tipo='amarilla';
    if v_amarillas<2 then return new; end if;
    v_infraccion:='Expulsión por segunda tarjeta amarilla';
  end if;
  perform 1 from public.jugadores j where j.id=new.jugador_id for update;
  insert into public.sanciones (jugador_id,club_id,partido_id,incidencia_id,infraccion,jornadas_suspension,estado,jornada_inicio,automatica)
  values (new.jugador_id,new.club_id,new.partido_id,new.id,v_infraccion,1,'pendiente',v_partido.jornada+1,true)
  on conflict do nothing;
  get diagnostics v_insertadas=row_count;
  if v_insertadas>0 then
    update public.jugadores set estado_comet='suspendido' where id=new.jugador_id;
  end if;
  return new;
end;
$$;
revoke all on function private.generar_sancion_por_tarjeta() from public,anon,authenticated,service_role;
drop trigger if exists al_registrar_tarjeta_generar_sancion on public.incidencias;
create trigger al_registrar_tarjeta_generar_sancion after insert on public.incidencias for each row execute function private.generar_sancion_por_tarjeta();

create or replace function private.validar_jugador_sancionado()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_estado text;
  v_jornada smallint;
  v_club uuid;
begin
  select j.estado_comet,j.club_id into v_estado,v_club from public.jugadores j where j.id=new.jugador_id;
  if not found then raise exception 'Jugador no registrado.'; end if;
  if new.club_id<>v_club then raise exception 'El jugador no pertenece al club de la alineación.'; end if;
  if v_estado<>'habilitado' then raise exception 'El jugador no está habilitado en COMET (%).',v_estado; end if;
  select p.jornada into v_jornada from public.partidos p where p.id=new.partido_id and new.club_id in (p.club_local_id,p.club_visitante_id);
  if not found then raise exception 'El club de la alineación no participa en el partido.'; end if;
  if exists(select 1 from public.sanciones s where s.jugador_id=new.jugador_id and s.estado in ('pendiente','notificada')
      and s.jornadas_cumplidas<s.jornadas_suspension and s.jornada_inicio<=v_jornada
      and (s.partido_id is null or exists(select 1 from public.partidos origen where origen.id=s.partido_id and origen.competencia_id=(select p.competencia_id from public.partidos p where p.id=new.partido_id)))) then
    raise exception 'Jugador suspendido para esta jornada. Revisa control disciplinario.';
  end if;
  return new;
end;
$$;
revoke all on function private.validar_jugador_sancionado() from public,anon,authenticated,service_role;
drop trigger if exists antes_alineacion_validar_elegibilidad on public.alineaciones;
create trigger antes_alineacion_validar_elegibilidad before insert or update of jugador_id,club_id,partido_id on public.alineaciones for each row execute function private.validar_jugador_sancionado();

create or replace function private.cumplir_suspension_al_finalizar_jornada()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado='finalizado' and old.estado is distinct from 'finalizado' then
    update public.sanciones s set
      jornadas_cumplidas=least(s.jornadas_suspension,s.jornadas_cumplidas+1),
      ultima_jornada_cumplida=new.jornada,
      estado=case when s.jornadas_cumplidas+1>=s.jornadas_suspension then 'cumplida' else s.estado end,
      updated_at=clock_timestamp()
    where s.club_id in (new.club_local_id,new.club_visitante_id)
      and s.estado in ('pendiente','notificada')
      and s.jornadas_suspension>s.jornadas_cumplidas
      and s.jornada_inicio<=new.jornada
      and s.ultima_jornada_cumplida is distinct from new.jornada
      and (s.partido_id is null or exists(select 1 from public.partidos origen where origen.id=s.partido_id and origen.competencia_id=new.competencia_id));
  end if;
  return new;
end;
$$;
revoke all on function private.cumplir_suspension_al_finalizar_jornada() from public,anon,authenticated,service_role;
drop trigger if exists al_finalizar_jornada_cumplir_sanciones on public.partidos;
create trigger al_finalizar_jornada_cumplir_sanciones after update of estado on public.partidos for each row execute function private.cumplir_suspension_al_finalizar_jornada();

-- Actas privadas: solo los usuarios de COMET autorizados las consultan y guardan.
drop policy if exists actas_read_staff on storage.objects;
drop policy if exists actas_manage_staff on storage.objects;
create policy actas_read_staff on storage.objects for select to authenticated
  using (bucket_id='actas-comet' and public.tiene_rol(array['administrador','arbitro']::public.rol_usuario[]));
drop policy if exists actas_insert_staff on storage.objects;
drop policy if exists actas_update_staff on storage.objects;
drop policy if exists actas_delete_staff on storage.objects;
create policy actas_insert_staff on storage.objects for insert to authenticated
  with check (bucket_id='actas-comet' and public.tiene_rol(array['administrador','arbitro']::public.rol_usuario[]));
create policy actas_update_staff on storage.objects for update to authenticated
  using (bucket_id='actas-comet' and public.tiene_rol(array['administrador','arbitro']::public.rol_usuario[]))
  with check (bucket_id='actas-comet' and public.tiene_rol(array['administrador','arbitro']::public.rol_usuario[]));
create policy actas_delete_staff on storage.objects for delete to authenticated
  using (bucket_id='actas-comet' and public.tiene_rol(array['administrador','arbitro']::public.rol_usuario[]));

-- Asignación administrativa manual: UPDATE perfiles SET rol_app='operador', rol='comisario' WHERE id='<uuid>';

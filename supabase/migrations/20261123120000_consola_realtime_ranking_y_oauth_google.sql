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

-- La vista omite correo, nombre legal e identificadores; solo publica apodo y rendimiento virtual.
create or replace view public.ranking_pronosticos with (security_invoker = false) as
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
revoke all on public.ranking_pronosticos from public, anon, authenticated;
grant select on public.ranking_pronosticos to anon, authenticated;

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

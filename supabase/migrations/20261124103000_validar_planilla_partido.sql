-- Guarda una planilla de titulares de forma atómica y solo para el árbitro designado o administrador.
create or replace function public.validar_planilla_partido(p_partido_id uuid, p_jugadores uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_partido public.partidos%rowtype;
  v_locales integer;
  v_visitantes integer;
  v_seleccionados integer;
begin
  if (select auth.uid()) is null then raise exception 'Inicia sesión para validar la planilla.'; end if;
  select * into v_partido from public.partidos p where p.id=p_partido_id for update;
  if not found then raise exception 'No existe el partido solicitado.'; end if;
  if not coalesce(private.tiene_rol(array['administrador']::public.rol_usuario[]),false)
    and not (coalesce(private.tiene_rol(array['arbitro']::public.rol_usuario[]),false)
      and coalesce(public.es_responsable_partido(p_partido_id),false)) then
    raise exception 'Solo el árbitro designado o administrador puede validar esta planilla.';
  end if;
  if v_partido.estado<>'programado' then raise exception 'La planilla solo se valida antes del inicio del partido.'; end if;
  if coalesce(cardinality(p_jugadores),0)<>22 then raise exception 'Selecciona exactamente 11 titulares por club.'; end if;
  select count(distinct seleccion.seleccionado),
    count(*) filter (where j.club_id=v_partido.club_local_id),
    count(*) filter (where j.club_id=v_partido.club_visitante_id)
  into v_seleccionados,v_locales,v_visitantes
  from unnest(p_jugadores) as seleccion(seleccionado)
  join public.jugadores j on j.id=seleccion.seleccionado;
  if v_seleccionados<>22 or v_locales<>11 or v_visitantes<>11 then
    raise exception 'La selección debe incluir 11 jugadores distintos de cada club participante.';
  end if;
  if exists(select 1 from public.jugadores j where j.id=any(p_jugadores) and j.estado_comet<>'habilitado') then
    raise exception 'La planilla contiene jugadores pendientes, suspendidos o no elegibles.';
  end if;

  delete from public.alineaciones a where a.partido_id=p_partido_id;
  insert into public.alineaciones (partido_id,jugador_id,club_id,titular,dorsal_partido,estado_validacion)
  select p_partido_id,j.id,j.club_id,true,j.dorsal,'habilitado'
  from public.jugadores j where j.id=any(p_jugadores);
end;
$$;
revoke all on function public.validar_planilla_partido(uuid,uuid[]) from public,anon,service_role;
grant execute on function public.validar_planilla_partido(uuid,uuid[]) to authenticated;

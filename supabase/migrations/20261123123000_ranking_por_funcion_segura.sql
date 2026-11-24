-- Sustituye la vista SECURITY DEFINER por una funcion que solo divulga el ranking publico permitido.
drop view if exists public.ranking_pronosticos;

create or replace function private.obtener_ranking_pronosticos()
returns table (
  posicion integer,
  apodo text,
  puntos integer,
  aciertos integer,
  total_pronosticos integer
)
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
returns table (
  posicion integer,
  apodo text,
  puntos integer,
  aciertos integer,
  total_pronosticos integer
)
language sql stable security invoker set search_path = '' as $$
  select * from private.obtener_ranking_pronosticos();
$$;
revoke all on function public.obtener_ranking_pronosticos() from public, anon, authenticated, service_role;
grant execute on function public.obtener_ranking_pronosticos() to anon, authenticated;

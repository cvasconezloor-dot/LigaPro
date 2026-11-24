"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type View = "portal" | "tabla" | "calendario" | "partido" | "clubes" | "club" | "estadisticas" | "boletines" | "torneos" | "temporadas" | "competencia" | "fases" | "clubesAdmin" | "clubAdmin" | "programacion" | "designaciones" | "usuarios" | "planillas" | "planilla" | "jugador" | "acta" | "vivo" | "incidencias" | "var" | "disciplina" | "alertas" | "sanciones" | "resolucion" | "pronosticos" | "misPronosticos" | "perfil";
type AuthMode = "signin" | "signup" | "recovery" | "confirmation";
type Role = "aficionado" | "operador" | "arbitro" | "administrador";
type Club = { id: string; nombre: string; sigla: string; color?: string; estadio?: string; serie?: string; activo?: boolean };
type Standing = { competencia_id: string; temporada: number; club_id?: string; club?: string; sigla?: string; serie: string; pj: number; pg: number; pe: number; pp: number; gf: number; gc: number; dg: number; pts: number; ultimas_5: string[] };
type Match = { id: string; local_id?: string; visitante_id?: string; local?: string; visitante?: string; goles_local: number; goles_visitante: number; fecha?: string; fecha_hora?: string; jornada: number; estado: string; estadio?: string; fase?: string; periodo?: string; reloj_inicio_at?: string | null; reloj_acumulado_segundos?: number; arbitro_id?: string | null; comisario_id?: string | null };
type Profile = { nombre: string; apodo: string; ciudad: string; club_favorito_id: string | null; avatar_url: string | null };
type VirtualPrediction = { id: string; partido_id: string; seleccion: "local" | "empate" | "visitante"; cuota: number; puntos_apostados: number; retorno_puntos: number; estado: "pendiente" | "ganado" | "perdido" | "anulado"; created_at: string };
type Competition = { id: string; nombre: string; temporada: number; serie: string; estado: string; formato?: string };
type ManagedUser = { id: string; nombre: string; apodo?: string; rol_app: Role; created_at?: string };
type Phase = { id: string; competencia_id: string; nombre: string; orden: number; jornadas: number | null; estado: string };
type Player = { id: string; club_id: string; nombre: string; dorsal: number; posicion: string; estado_comet: string };
type LineupRow = { partido_id: string; jugador_id: string; club_id: string; titular: boolean; dorsal_partido: number; estado_validacion: string };
type EventRow = { id: string; partido_id: string; minuto: number; tipo: string; club_id?: string; jugador?: string; detalle?: string };
type LeaderboardRow = { posicion: number; apodo: string; puntos: number; aciertos: number; total_pronosticos: number };
type Sanction = { id: string; jugador: string; club: string; infraccion: string; jornadas: number; estado: string; fecha?: string };
type Bulletin = { id: string; titulo: string; categoria: string; resumen: string; publicado_at?: string };

const menu: { id: View; label: string; symbol: string }[] = [
  { id: "portal", label: "Portal público", symbol: "◉" },
  { id: "pronosticos", label: "Pronósticos", symbol: "⚽" },
  { id: "perfil", label: "Mi perfil", symbol: "♙" },
  { id: "torneos", label: "Panel torneos", symbol: "♜" },
  { id: "planillas", label: "Planilla COMET", symbol: "▣" },
  { id: "vivo", label: "Consola en vivo", symbol: "◉" },
  { id: "disciplina", label: "Control disciplinario", symbol: "⚖" },
];

const screenGroups: { root: View; label: string; screens: { id: View; label: string }[] }[] = [
  { root: "portal", label: "PORTAL PÚBLICO", screens: [{ id: "portal", label: "Inicio" }, { id: "tabla", label: "Posiciones" }, { id: "calendario", label: "Calendario" }, { id: "partido", label: "Partido" }, { id: "clubes", label: "Clubes" }, { id: "club", label: "Ficha de club" }, { id: "estadisticas", label: "Estadísticas" }, { id: "boletines", label: "Boletines" }] },
  { root: "pronosticos", label: "AFICIONADOS", screens: [{ id: "pronosticos", label: "Pronósticos" }, { id: "misPronosticos", label: "Mis pronósticos" }, { id: "perfil", label: "Mi perfil" }] },
  { root: "torneos", label: "GESTIÓN DE TORNEOS", screens: [{ id: "torneos", label: "Resumen" }, { id: "temporadas", label: "Temporadas" }, { id: "competencia", label: "Nueva competencia" }, { id: "fases", label: "Fases" }, { id: "clubesAdmin", label: "Clubes afiliados" }, { id: "clubAdmin", label: "Ficha de club" }, { id: "programacion", label: "Programación" }, { id: "designaciones", label: "Designaciones" }, { id: "usuarios", label: "Usuarios y roles" }] },
  { root: "planillas", label: "PLANILLA COMET", screens: [{ id: "planillas", label: "Partidos" }, { id: "planilla", label: "Validar nómina" }, { id: "jugador", label: "Elegibilidad" }, { id: "acta", label: "Cierre del acta" }] },
  { root: "vivo", label: "CONSOLA EN VIVO", screens: [{ id: "vivo", label: "Marcador en vivo" }, { id: "incidencias", label: "Cronología" }, { id: "var", label: "VAR e integridad" }] },
  { root: "disciplina", label: "CONTROL DISCIPLINARIO", screens: [{ id: "disciplina", label: "Resumen" }, { id: "alertas", label: "Alertas" }, { id: "sanciones", label: "Libro de sanciones" }, { id: "resolucion", label: "Nueva resolución" }] },
];

const roleLabels: Record<string, string> = {
  administrador: "Administrador",
  operador: "Operador",
  arbitro: "Árbitro",
  aficionado: "Aficionado",
};

const roleScreens: Record<Exclude<Role, "aficionado">, View[]> = {
  operador: ["vivo", "incidencias", "var"],
  arbitro: ["planillas", "planilla", "jugador", "acta"],
  administrador: ["torneos", "temporadas", "competencia", "fases", "clubesAdmin", "clubAdmin", "programacion", "designaciones", "usuarios", "planillas", "planilla", "jugador", "acta", "vivo", "incidencias", "var", "disciplina", "alertas", "sanciones", "resolucion"],
};

const publicScreens: View[] = ["portal", "tabla", "calendario", "partido", "clubes", "club", "estadisticas", "boletines", "pronosticos", "misPronosticos", "perfil"];

function normalizeRole(value?: string | null): Role | null {
  if (!value) return null;
  if (["administrador", "organizador", "disciplina"].includes(value)) return "administrador";
  if (["operador", "comisario"].includes(value)) return "operador";
  if (value === "arbitro") return "arbitro";
  if (["aficionado", "publico", "club"].includes(value)) return "aficionado";
  return null;
}

function canAccessView(screen: View, role: Role | null) {
  if (publicScreens.includes(screen)) return true;
  if (!role) return false;
  return role === "administrador" || roleScreens[role as Exclude<Role, "aficionado">]?.includes(screen) === true;
}
function badgeText(value?: string) {
  if (value === "finalizado") return "Finalizado";
  if (value === "en_vivo") return "En vivo";
  if (value === "suspendido") return "Suspendido";
  return "Programado";
}

function elapsedMatchSeconds(match?: Match) {
  if (!match) return 0;
  const base = match.reloj_acumulado_segundos ?? 0;
  if (match.estado !== "en_vivo" || !match.reloj_inicio_at) return base;
  const startedAt = Date.parse(match.reloj_inicio_at);
  return base + (Number.isFinite(startedAt) ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0);
}

function periodLabel(period?: string, compact = false) {
  const labels: Record<string, [string, string]> = {
    primer_tiempo: ["PRIMER TIEMPO", "1T"],
    medio_tiempo: ["MEDIO TIEMPO", "MT"],
    segundo_tiempo: ["SEGUNDO TIEMPO", "2T"],
    final: ["FINALIZADO", "FT"],
  };
  return labels[period ?? ""]?.[compact ? 1 : 0] ?? (compact ? "—" : "POR INICIAR");
}

export default function Home() {
  const [view, setView] = useState<View>("portal");
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [virtualBalance, setVirtualBalance] = useState(0);
  const [myPredictions, setMyPredictions] = useState<VirtualPrediction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [lineups, setLineups] = useState<LineupRow[]>([]);
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [database, setDatabase] = useState<"connecting" | "connected" | "error">("connecting");
  const [loading, setLoading] = useState(true);
  const [routingReady, setRoutingReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [databaseError, setDatabaseError] = useState("");
  const [notice, setNotice] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [search, setSearch] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [liveActionBusy, setLiveActionBusy] = useState(false);
  const [lineupBusy, setLineupBusy] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [utcClock, setUtcClock] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("view") ?? params.get("pantalla");
    const requestedScreen = requested === "tablero" ? "torneos" : requested;
    if (requestedScreen && screenGroups.some((group) => group.screens.some((screen) => screen.id === requestedScreen))) setView(requestedScreen as View);
    setRoutingReady(true);
  }, []);

  useEffect(() => {
    if (!routingReady) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("pantalla");
    if (view === "torneos") url.searchParams.set("view", "tablero");
    else if (view === "portal") url.searchParams.delete("view");
    else url.searchParams.set("view", view);
    window.history.replaceState({}, "", url);
  }, [view, routingReady]);

  useEffect(() => {
    const updateClock = () => setUtcClock(new Intl.DateTimeFormat("es-EC", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Guayaquil", hourCycle: "h23" }).format(new Date()));
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadData = useCallback(async (client: SupabaseClient) => {
    setLoading(true);
    try {
      const compResult = await client.from("competencias").select("id,nombre,temporada,serie,estado,formato").order("temporada", { ascending: false }).limit(100);
      if (compResult.error) throw compResult.error;
      const competitionRows = (compResult.data ?? []) as Competition[];
      const primaryCompetition = competitionRows.find((item) => item.estado === "activa") ?? competitionRows.find((item) => item.estado === "borrador") ?? competitionRows.find((item) => item.estado === "demo") ?? competitionRows[0] ?? null;
      const standingsQuery = client.from("clasificacion_publica").select("competencia_id,temporada,club_id,club,sigla,serie,pj,pg,pe,pp,gf,gc,dg,pts,ultimas_5")
        .eq("competencia_id", primaryCompetition?.id ?? "00000000-0000-0000-0000-000000000000").order("posicion");
      const [clubResult, matchResult, phaseResult, standingsResult, playerResult, lineupResult, sanctionResult, eventResult, bulletinResult, rankingResult, userResult] = await Promise.all([
        client.from("clubes").select("id,nombre,sigla,color_primario,estadio,serie,activo").order("nombre"),
        client.from("partidos").select("id,club_local_id,club_visitante_id,goles_local,goles_visitante,jornada,estado,estadio,fecha_hora,periodo,reloj_inicio_at,reloj_acumulado_segundos,arbitro_id,comisario_id,fase:fases(nombre)").eq("competencia_id", primaryCompetition?.id ?? "00000000-0000-0000-0000-000000000000").order("fecha_hora", { ascending: true }).limit(500),
        client.from("fases").select("id,competencia_id,nombre,orden,jornadas,estado").eq("competencia_id", primaryCompetition?.id ?? "00000000-0000-0000-0000-000000000000").order("orden"),
        standingsQuery,
        client.from("jugadores").select("id,club_id,nombre,dorsal,posicion,estado_comet").order("dorsal"),
        client.from("alineaciones").select("partido_id,jugador_id,club_id,titular,dorsal_partido,estado_validacion").order("created_at"),
        client.from("sanciones").select("id,jugador:jugadores(nombre),club:clubes(nombre),infraccion,jornadas_suspension,jornadas_cumplidas,jornada_inicio,automatica,estado,created_at").order("created_at", { ascending: false }).limit(100),
        client.from("incidencias").select("id,partido_id,minuto,tipo,club_id,jugador:jugadores(nombre),detalle").order("created_at", { ascending: true }).limit(500),
        client.from("comunicados").select("id,titulo,categoria,resumen,publicado_at").eq("estado", "publicado").order("publicado_at", { ascending: false }).limit(100),
        client.rpc("obtener_ranking_pronosticos").limit(10),
        client.from("perfiles").select("id,nombre,apodo,rol_app,created_at").order("created_at", { ascending: false }).limit(500),
      ]);

      if (clubResult.error || matchResult.error || phaseResult.error || standingsResult.error) {
        throw clubResult.error ?? matchResult.error ?? phaseResult.error ?? standingsResult.error;
      }

      setCompetitions(competitionRows);
      setCompetition(primaryCompetition);
      setClubs((clubResult.data ?? []).map((row: any) => ({ id: row.id, nombre: row.nombre, sigla: row.sigla, color: row.color_primario, estadio: row.estadio, serie: row.serie, activo: row.activo })));
      setPhases((phaseResult.data ?? []) as Phase[]);
      setMatches((matchResult.data ?? []).map((row: any) => ({
        id: row.id,
        local_id: row.club_local_id,
        visitante_id: row.club_visitante_id,
        goles_local: row.goles_local ?? 0,
        goles_visitante: row.goles_visitante ?? 0,
        jornada: row.jornada,
        estado: row.estado,
        periodo: row.periodo,
        reloj_inicio_at: row.reloj_inicio_at,
        reloj_acumulado_segundos: row.reloj_acumulado_segundos ?? 0,
        arbitro_id: row.arbitro_id,
        comisario_id: row.comisario_id,
        estadio: row.estadio,
        fecha_hora: row.fecha_hora,
        fecha: row.fecha_hora ? new Date(row.fecha_hora).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" }) : "Por programar",
        fase: Array.isArray(row.fase) ? row.fase[0]?.nombre : row.fase?.nombre,
      })));
      setStandings((standingsResult.data ?? []) as Standing[]);
      setPlayers(!playerResult.error ? (playerResult.data ?? []) as Player[] : []);
      setLineups(!lineupResult.error ? (lineupResult.data ?? []) as LineupRow[] : []);
      setSanctions(!sanctionResult.error ? (sanctionResult.data ?? []).map((row: any) => ({ id: row.id.slice(0, 8), jugador: row.jugador?.nombre ?? "Jugador", club: row.club?.nombre ?? "Club", infraccion: row.infraccion, jornadas: row.jornadas_suspension, estado: row.estado, fecha: row.created_at })) : []);
      setEvents(!eventResult.error ? (eventResult.data ?? []).map((row: any) => ({ id: row.id, partido_id: row.partido_id, minuto: row.minuto, tipo: row.tipo, club_id: row.club_id, jugador: Array.isArray(row.jugador) ? row.jugador[0]?.nombre : row.jugador?.nombre, detalle: row.detalle })).reverse() : []);
      setBulletins(!bulletinResult.error ? (bulletinResult.data ?? []) as Bulletin[] : []);
      setLeaderboard(!rankingResult.error && rankingResult.data ? rankingResult.data as LeaderboardRow[] : []);
      setManagedUsers(!userResult.error ? (userResult.data ?? []).filter((row: any) => normalizeRole(row.rol_app)).map((row: any) => ({ ...row, rol_app: normalizeRole(row.rol_app) })) as ManagedUser[] : []);
      setDatabaseError("");
      setDatabase("connected");
    } catch {
      setClubs([]); setStandings([]); setMatches([]); setPlayers([]); setLineups([]); setSanctions([]); setEvents([]); setBulletins([]); setCompetition(null); setCompetitions([]); setPhases([]); setManagedUsers([]);
      setDatabaseError("No se pudieron leer clubes, temporadas, jornadas o posiciones desde Supabase. Revisa la configuración y las políticas RLS.");
      setDatabase("error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFanData = useCallback(async (client: SupabaseClient, userId: string) => {
    const [profileResult, walletResult, predictionResult] = await Promise.all([
      client.from("perfiles").select("nombre,apodo,ciudad,club_favorito_id,avatar_url").eq("id", userId).maybeSingle(),
      client.from("carteras_virtuales").select("saldo_puntos").eq("usuario_id", userId).maybeSingle(),
      client.from("pronosticos_virtuales").select("id,partido_id,seleccion,cuota,puntos_apostados,retorno_puntos,estado,created_at").eq("usuario_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (profileResult.data) setProfile(profileResult.data as Profile);
    setVirtualBalance(walletResult.data?.saldo_puntos ?? 0);
    if (!predictionResult.error && predictionResult.data) setMyPredictions(predictionResult.data as VirtualPrediction[]);
  }, []);

  const loadLeaderboard = useCallback(async (client: SupabaseClient) => {
    const { data, error } = await client.rpc("obtener_ranking_pronosticos").limit(10);
    if (!error && data) setLeaderboard(data as LeaderboardRow[]);
  }, []);

  const syncGoogleProfile = useCallback(async (client: SupabaseClient, authUser: User) => {
    const isGoogle = authUser.app_metadata?.provider === "google" || authUser.identities?.some((identity) => identity.provider === "google");
    if (!isGoogle) return;
    const metadata = authUser.user_metadata ?? {};
    const googleName = String(metadata.full_name ?? metadata.name ?? "").trim();
    const googleAvatar = String(metadata.avatar_url ?? metadata.picture ?? "").trim();
    const googleNickname = String(metadata.nickname ?? metadata.preferred_username ?? googleName.split(/\s+/)[0] ?? "").trim();
    const { data: current } = await client.from("perfiles").select("nombre,apodo,avatar_url").eq("id", authUser.id).maybeSingle();
    if (!current) return;
    const changes: Record<string, string> = {};
    if (!String(current.nombre ?? "").trim() && googleName) changes.nombre = googleName;
    if (!String(current.apodo ?? "").trim() && googleNickname) changes.apodo = googleNickname.slice(0, 30);
    if (!current.avatar_url && googleAvatar) changes.avatar_url = googleAvatar;
    if (Object.keys(changes).length) await client.from("perfiles").update(changes).eq("id", authUser.id);
  }, []);

  const hydrateUser = useCallback(async (client: SupabaseClient, authUser: User) => {
    await syncGoogleProfile(client, authUser);
    setUser(authUser);
    const { data: currentProfile } = await client.from("perfiles").select("rol_app,rol").eq("id", authUser.id).maybeSingle();
    const normalized = normalizeRole(currentProfile?.rol_app ?? currentProfile?.rol);
    setRole(normalized);
    await Promise.all([loadFanData(client, authUser.id), loadData(client)]);
    return normalized;
  }, [loadData, loadFanData, syncGoogleProfile]);

  useEffect(() => {
    try {
      const client = createClient();
      setSupabase(client);
      void client.auth.getUser().then(async ({ data }) => {
        if (data.user) await hydrateUser(client, data.user);
        else { setUser(null); setRole(null); }
      }).catch(() => { setUser(null); setRole(null); }).finally(() => setAuthReady(true));
      const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          setUser(null); setRole(null); setProfile(null); setMyPredictions([]); setVirtualBalance(0);
        } else if (event === "SIGNED_IN" && session?.user) {
          const signedInUser = session.user;
          window.setTimeout(() => void hydrateUser(client, signedInUser), 0);
        }
      });
      void loadData(client);
      void loadLeaderboard(client);
      const rankingTimer = window.setInterval(() => void loadLeaderboard(client), 30000);
      const channel = client.channel("liga-pro-live-feed")
        .on("postgres_changes", { event: "*", schema: "public", table: "incidencias" }, () => void loadData(client))
        .on("postgres_changes", { event: "*", schema: "public", table: "partidos" }, () => void loadData(client))
        .subscribe();
      return () => { window.clearInterval(rankingTimer); void client.removeChannel(channel); authListener.subscription.unsubscribe(); };
    } catch {
      setDatabaseError("No se pudo iniciar el cliente de Supabase. Revisa las variables públicas en Netlify.");
      setDatabase("error");
      setLoading(false);
      setAuthReady(true);
    }
  }, [loadData, loadFanData, loadLeaderboard, hydrateUser]);

  useEffect(() => {
    if (!supabase || !user) return;
    const personalChannel = supabase.channel("pronosticos-personales-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "carteras_virtuales", filter: "usuario_id=eq." + user.id }, () => void loadFanData(supabase, user.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "pronosticos_virtuales", filter: "usuario_id=eq." + user.id }, () => void loadFanData(supabase, user.id))
      .subscribe();
    return () => { void supabase.removeChannel(personalChannel); };
  }, [supabase, user, loadFanData]);

  const clubName = (id?: string) => clubs.find((club) => club.id === id)?.nombre ?? "Por asignar";
  const clubShort = (id?: string) => clubs.find((club) => club.id === id)?.sigla ?? "—";
  const canManageTournaments = Boolean(user && role === "administrador");
  const canManageLineups = Boolean(user && (role === "administrador" || role === "arbitro"));
  const canOperateLive = Boolean(user && (role === "administrador" || role === "operador"));
  const activeMatch = matches.find((match) => match.id === selectedMatchId) ?? matches.find((match) => match.estado === "en_vivo") ?? matches.find((match) => match.estado === "programado") ?? matches[0];
  const currentGroup = screenGroups.find((group) => group.screens.some((screen) => screen.id === view)) ?? screenGroups[0];
  const navigateTo = (screen: View) => setView(screen);

  useEffect(() => {
    if (!routingReady || !authReady || canAccessView(view, role)) return;
    setView("portal");
    if (!user) {
      setAuthMode("signin");
      setAuthMessage("Inicia sesión con un rol autorizado para entrar a ese módulo.");
      setAuthOpen(true);
      setNotice("Este módulo requiere una cuenta autorizada.");
    } else {
      setNotice("Tu rol no tiene permiso para abrir ese módulo.");
    }
  }, [authReady, role, routingReady, user, view]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    setLoginBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
    setLoginBusy(false);
    if (error) { setAuthMessage("No se pudo iniciar sesión. Verifica el correo y la contraseña."); return; }
    const signedInRole = await hydrateUser(supabase, data.user);
    setAuthOpen(false);
    setAuthMessage("");
    setNotice(signedInRole ? `Sesión iniciada como ${roleLabels[signedInRole] ?? signedInRole}.` : "Sesión iniciada. El administrador debe asignar un rol a tu perfil.");
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    setLoginBusy(true);
    setAuthMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/?view=perfil` },
      });
      if (!error) return;
      setLoginBusy(false);
      setAuthMessage("No se pudo iniciar con Google. Revisa la configuración del proveedor en Supabase.");
    } catch {
      setLoginBusy(false);
      setAuthMessage("No se pudo iniciar con Google. Revisa la conexión y la configuración del proveedor.");
    }
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("password_confirm"))) {
      setAuthMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoginBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password,
      options: {
        data: { full_name: String(form.get("full_name")).trim(), nickname: String(form.get("nickname")).trim(), city: String(form.get("city") ?? "").trim() },
        emailRedirectTo: `${window.location.origin}/?view=perfil`,
      },
    });
    setLoginBusy(false);
    if (error) {
      setAuthMessage("No se pudo crear la cuenta. Revisa el correo y la contraseña e inténtalo de nuevo.");
      return;
    }

    if (data.session && data.user) {
      setAuthOpen(false);
      setUser(data.user);
      const { data: profile } = await supabase.from("perfiles").select("rol_app,rol").eq("id", data.user.id).maybeSingle();
      const normalized = normalizeRole(profile?.rol_app ?? profile?.rol) ?? "aficionado";
      setRole(normalized);
      void loadFanData(supabase, data.user.id);
      setNotice("Cuenta creada. Tu rol inicial es público; el administrador puede habilitar módulos institucionales.");
    } else {
      setAuthEmail(String(form.get("email")).trim());
      setAuthMode("confirmation");
      setAuthMessage("Revisa tu correo para confirmar tu cuenta. Después podrás iniciar sesión.");
    }
  }

  async function recoverPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    setLoginBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer`,
    });
    setLoginBusy(false);
    if (error) { setAuthMessage("Si el correo está registrado, recibirás un enlace para restablecer tu contraseña."); return; }
    setAuthMessage("Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.");
  }

  async function resendConfirmation() {
    if (!supabase || !authEmail) return;
    setLoginBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: authEmail,
      options: { emailRedirectTo: `${window.location.origin}/?view=perfil` },
    });
    setLoginBusy(false);
    setAuthMessage(error ? "No se pudo reenviar ahora. Espera un momento e inténtalo otra vez." : "Si la cuenta sigue pendiente de confirmación, recibirás un nuevo correo.");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("current_password"));
    const password = String(form.get("password"));
    if (password !== String(form.get("password_confirm"))) { setNotice("La nueva contraseña y su confirmación no coinciden."); return; }
    if (password.length < 8) { setNotice("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    setLoginBusy(true);
    const { error } = await supabase.auth.updateUser({ password, current_password: currentPassword });
    setLoginBusy(false);
    if (error) { setNotice("No se pudo cambiar la contraseña. Revisa la contraseña actual e inténtalo otra vez."); return; }
    setNotice("Contraseña cambiada correctamente.");
    formElement.reset();
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setAuthOpen(false);
    setUser(null); setRole(null); setProfile(null); setMyPredictions([]); setVirtualBalance(0); setNotice("Sesión cerrada.");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) { setAuthOpen(true); return; }
    const form = new FormData(event.currentTarget);
    const changes = { nombre: String(form.get("nombre")).trim(), apodo: String(form.get("apodo")).trim(), ciudad: String(form.get("ciudad")).trim(), club_favorito_id: String(form.get("club_favorito_id") || "") || null };
    const { data, error } = await supabase.from("perfiles").update(changes).eq("id", user.id).select("nombre,apodo,ciudad,club_favorito_id,avatar_url").single();
    if (error) { setNotice(`No se pudo guardar el perfil: ${error.message}`); return; }
    setProfile(data as Profile);
    setNotice("Perfil actualizado.");
  }

  async function uploadAvatar(file: File) {
    if (!supabase || !user) throw new Error("Inicia sesión para cambiar tu foto.");
    const extensionByMime: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const extension = extensionByMime[file.type];
    if (!extension) throw new Error("Elige una imagen JPG, PNG o WEBP.");
    if (file.size > 2 * 1024 * 1024) throw new Error("La foto debe pesar 2 MB o menos.");

    const path = `${user.id}/avatar.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type,
    });
    if (uploadError) throw new Error("No se pudo subir la foto. Comprueba que el esquema de Supabase esté aplicado.");

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
    const { data: savedProfile, error: profileError } = await supabase.from("perfiles").update({ avatar_url: avatarUrl }).eq("id", user.id).select("nombre,apodo,ciudad,club_favorito_id,avatar_url").single();
    if (profileError) throw new Error("La foto se subió, pero no se pudo guardar en el perfil. Ejecuta supabase/schema.sql en el proyecto.");

    const oldUrl = profile?.avatar_url;
    if (oldUrl) {
      try {
        const oldPath = new URL(oldUrl).pathname.split("/storage/v1/object/public/avatars/")[1];
        if (oldPath && oldPath !== path) await supabase.storage.from("avatars").remove([decodeURIComponent(oldPath)]);
      } catch { /* The updated profile remains valid even if an older file cannot be removed. */ }
    }
    setProfile(savedProfile as Profile);
  }

  async function createVirtualPrediction(matchId: string, selection: "local" | "empate" | "visitante", points: number) {
    if (!supabase || !user) { setAuthOpen(true); return; }
    const { error } = await supabase.rpc("crear_pronostico_virtual", { p_partido_id: matchId, p_seleccion: selection, p_puntos: points });
    if (error) { setNotice(`No se pudo guardar el pronóstico: ${error.message}`); return; }
    await loadFanData(supabase, user.id);
    await loadLeaderboard(supabase);
    setNotice("Pronóstico registrado. Su saldo usa puntos virtuales sin valor monetario.");
  }

  function requireRole(allowed: Role[], message = "Tu perfil no tiene permisos para esta acción.") {
    if (!user) { setAuthOpen(true); return false; }
    if (!role || !allowed.includes(role)) { setNotice(message); return false; }
    return true;
  }

  async function createCompetition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !requireRole(["administrador"])) return;
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("competencias").insert({ nombre: String(form.get("nombre")), temporada: Number(form.get("temporada")), serie: String(form.get("serie")), formato: String(form.get("formato") ?? "fase_clasificatoria"), estado: String(form.get("estado") ?? "activa") });
    if (error) { setNotice(`No se pudo crear la competencia: ${error.message}`); return; }
    setNotice("Competencia creada.");
    void loadData(supabase);
    formElement.reset();
  }

  async function createClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !requireRole(["administrador"])) return;
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("clubes").insert({
      nombre: String(form.get("nombre")).trim(),
      sigla: String(form.get("sigla")).trim().toUpperCase(),
      serie: String(form.get("serie")),
      estadio: String(form.get("estadio") || "").trim() || null,
      color_primario: String(form.get("color") || "").trim() || null,
    });
    if (error) { setNotice(`No se pudo guardar el club: ${error.message}`); return; }
    setNotice("Club guardado en Supabase.");
    formElement.reset();
    await loadData(supabase);
  }

  async function createPhase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !requireRole(["administrador"])) return;
    if (!competition) { setNotice("Crea primero una competencia."); return; }
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("fases").insert({
      competencia_id: competition.id,
      nombre: String(form.get("nombre")).trim(),
      orden: Number(form.get("orden")),
      jornadas: Number(form.get("jornadas")) || null,
      estado: String(form.get("estado")),
    });
    if (error) { setNotice(`No se pudo guardar la fase: ${error.message}`); return; }
    formElement.reset();
    setNotice("Fase y jornadas guardadas en Supabase.");
    await loadData(supabase);
  }

  async function setManagedUserRole(userId: string, nextRole: Role) {
    if (!supabase || !requireRole(["administrador"])) return;
    const { error } = await supabase.rpc("administrar_rol_perfil", { p_usuario_id: userId, p_rol: nextRole });
    if (error) { setNotice(`No se pudo actualizar el rol: ${error.message}`); return; }
    setNotice("Rol actualizado. La persona verá el permiso nuevo al volver a iniciar sesión.");
    await loadData(supabase);
  }

  async function assignMatchOfficial(matchId: string, field: "arbitro_id" | "comisario_id", userId: string) {
    if (!supabase || !requireRole(["administrador"])) return;
    const { error } = await supabase.rpc("asignar_oficial_partido", { p_partido_id: matchId, p_campo: field, p_usuario_id: userId || null });
    if (error) { setNotice(`No se pudo guardar la designación: ${error.message}`); return; }
    setNotice("Designación guardada.");
    await loadData(supabase);
  }

  async function saveMatchLineup(matchId: string, playerIds: string[]) {
    if (!supabase || !requireRole(["administrador", "arbitro"])) return false;
    setLineupBusy(true);
    const { error } = await supabase.rpc("validar_planilla_partido", { p_partido_id: matchId, p_jugadores: playerIds });
    if (error) {
      setNotice(`No se pudo validar la planilla: ${error.message}`);
      setLineupBusy(false);
      return false;
    }
    await loadData(supabase);
    setNotice("Once titular validado y guardado en Supabase para cada club.");
    setLineupBusy(false);
    return true;
  }

  async function createMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !requireRole(["administrador"])) return;
    if (!competition) { setNotice("Crea o selecciona una competencia antes de programar partidos."); return; }
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const local = String(form.get("local"));
    const away = String(form.get("visitante"));
    if (local === away) { setNotice("Selecciona dos clubes distintos."); return; }
    const { error } = await supabase.from("partidos").insert({ competencia_id: competition.id, fase_id: String(form.get("fase") || "") || null, club_local_id: local, club_visitante_id: away, jornada: Number(form.get("jornada")), fecha_hora: new Date(String(form.get("fecha"))).toISOString(), estadio: String(form.get("estadio")), estado: "programado" });
    if (error) { setNotice(`No se pudo programar el partido: ${error.message}`); return; }
    setNotice("Partido programado."); void loadData(supabase); formElement.reset();
  }

  async function createLiveAction(action: string, clubId?: string, playerId?: string, secondaryPlayerId?: string, detail?: string) {
    if (!supabase || !activeMatch || !requireRole(["administrador", "operador"])) return;
    setLiveActionBusy(true);
    try {
      const { error } = await supabase.rpc("registrar_evento_en_vivo", {
        p_partido_id: activeMatch.id,
        p_accion: action,
        p_club_id: clubId || null,
        p_jugador_id: playerId || null,
        p_jugador_secundario_id: secondaryPlayerId || null,
        p_detalle: detail?.trim() ?? "",
      });
      if (error) { setNotice(`No se pudo registrar la acción: ${error.message}`); return; }
      setNotice(action === "final" ? "Partido finalizado; los pronósticos se liquidaron en Supabase." : "Acción registrada. El marcador y la cronología se actualizaron en vivo.");
      await loadData(supabase);
      if (user) await loadFanData(supabase, user.id);
      await loadLeaderboard(supabase);
    } catch {
      setNotice("No se pudo conectar con Supabase. Vuelve a intentarlo cuando la conexión esté disponible.");
    } finally {
      setLiveActionBusy(false);
    }
  }

  async function createSanction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !requireRole(["administrador"])) return;
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const playerId = String(form.get("jugador_id"));
    const player = players.find((item) => item.id === playerId);
    if (!player) { setNotice("Carga primero el registro del jugador en Supabase."); return; }
    const { error } = await supabase.from("sanciones").insert({ jugador_id: player.id, club_id: player.club_id, infraccion: String(form.get("infraccion")), jornadas_suspension: Number(form.get("jornadas")), estado: "pendiente" });
    if (error) { setNotice(`No se pudo emitir la sanción: ${error.message}`); return; }
    setNotice("Resolución disciplinaria registrada."); void loadData(supabase); formElement.reset();
  }

  const filteredSanctions = sanctions.filter((item) => `${item.jugador} ${item.club} ${item.infraccion} ${item.estado}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className={`app-shell ${highContrast ? "high-contrast-mode" : ""}`} style={{ "--app-font-scale": fontScale } as React.CSSProperties}>
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-crest">⚡</div><div><strong>LIGAPRO ECUADOR</strong><span>SIGEC-LP · GESTIÓN DE COMPETICIONES</span></div></div>
        <div className="division-switch"><span>COMPETENCIA</span><div><span className="selected">{competition ? `SERIE ${competition.serie} · ${competition.temporada}` : "SIN COMPETENCIA"}</span></div></div>
        <nav className="side-nav" aria-label="Módulos">
          {menu.filter((item) => canAccessView(item.id, role)).map((item) => <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)}><span className="nav-icon">{item.symbol}</span>{item.label}</button>)}
        </nav>
      <div className="sidebar-bottom"><span className={`status-dot ${database === "connected" ? "green" : "gold"}`} />{database === "connected" ? "SUPABASE CONECTADO" : database === "connecting" ? "CONECTANDO CON SUPABASE" : "SUPABASE SIN CONEXIÓN"}<small>30 pantallas · 6 módulos</small><small>UTC−5 · Ecuador</small></div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-season"><span className="season-badge">TEMPORADA {competition?.temporada ?? new Date().getFullYear()}</span><span>{competition?.nombre ?? "Competencias y resultados"}</span></div>
          <button className="topbar-live" onClick={() => navigateTo(canOperateLive ? "vivo" : "partido")} aria-label={`Ver marcador: ${clubShort(activeMatch?.local_id)} ${activeMatch?.goles_local ?? 0} a ${activeMatch?.goles_visitante ?? 0} ${clubShort(activeMatch?.visitante_id)}`}>
            <span className={`topbar-live-dot ${activeMatch?.estado === "en_vivo" ? "is-live" : ""}`} />
            <span className="topbar-live-label">{activeMatch?.estado === "en_vivo" ? "EN VIVO" : "MARCADORES"}</span>
            <strong>{clubShort(activeMatch?.local_id)}</strong>
            <span className="topbar-score">{activeMatch?.goles_local ?? 0} - {activeMatch?.goles_visitante ?? 0}</span>
            <strong>{clubShort(activeMatch?.visitante_id)}</strong>
            <span className="topbar-minute">{activeMatch?.estado === "en_vivo" ? `${Math.floor(elapsedMatchSeconds(activeMatch) / 60)}′ ${periodLabel(activeMatch.periodo, true)}` : activeMatch?.estado === "finalizado" ? "FT" : "UTC−5"}</span>
          </button>
          <div className="topbar-user">
            <div className="topbar-clock"><span>UTC−5</span><time>{utcClock || "--:--:--"}</time></div>
            <div className="accessibility-controls" aria-label="Controles de accesibilidad">
              <button className={highContrast ? "selected" : ""} onClick={() => setHighContrast((value) => !value)} aria-pressed={highContrast} aria-label="Alternar alto contraste" title="Alto contraste">◐</button>
              <button onClick={() => setFontScale((value) => Math.max(0.9, Number((value - 0.1).toFixed(1))))} aria-label="Reducir tamaño de texto" title="Reducir texto">A−</button>
              <button onClick={() => setFontScale((value) => Math.min(1.2, Number((value + 0.1).toFixed(1))))} aria-label="Aumentar tamaño de texto" title="Aumentar texto">A+</button>
            </div>
            {role === "administrador" && <button className="header-icon-button" onClick={() => setView("alertas")} aria-label="Ver alertas" title="Alertas">♧</button>}
            <span className={`connection-pill ${database === "connected" ? "ok" : "demo"}`}><i />{database === "connected" ? "Datos en línea" : database === "connecting" ? "Conectando" : "Sin conexión"}</span>
            {user ? <><button className="header-profile-link" onClick={() => setView("perfil")} aria-label="Abrir mi perfil"><span className="header-profile-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : (profile?.apodo || profile?.nombre || user.email || "LP").slice(0, 2).toUpperCase()}</span><span className="user-label">{profile?.apodo || roleLabels[role ?? ""] || user.email}</span></button><button className="btn btn-quiet" onClick={() => void signOut()}>Cerrar sesión</button></> : <button className="btn btn-dark" onClick={() => setAuthOpen(true)}>Ingresar</button>}
          </div>
        </header>

        <div className="content-wrap">
          <nav className="fan-shortcuts" aria-label="Accesos para aficionados">
            <div className="fan-shortcuts-copy"><strong>Zona del aficionado</strong><span>Perfil, cuenta y pronósticos</span></div>
            <button className={view === "pronosticos" || view === "misPronosticos" ? "fan-shortcut active" : "fan-shortcut"} onClick={() => navigateTo("pronosticos")}><span>⚽</span> Pronósticos</button>
            <button className={view === "perfil" ? "fan-shortcut active" : "fan-shortcut"} onClick={() => navigateTo("perfil")}><span>♙</span> Mi perfil</button>
          </nav>
          <nav className="screen-tabs" aria-label={`Pantallas de ${currentGroup.label}`}><span>{currentGroup.label}</span>{currentGroup.screens.filter((screen) => canAccessView(screen.id, role)).map((screen) => <button key={screen.id} className={view === screen.id ? "active" : ""} onClick={() => navigateTo(screen.id)}>{screen.label}</button>)}</nav>
          {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Cerrar aviso" onClick={() => setNotice("")}>×</button></div>}
          {database === "error" && <div className="demo-banner" role="alert"><span>ⓘ</span><div><strong>Supabase no está disponible</strong><span>{databaseError}</span></div><button className="btn btn-dark" onClick={() => { if (supabase) void loadData(supabase); }}>Reintentar</button></div>}

          {view === "portal" && <Portal clubs={clubs} standings={standings} matches={matches} bulletins={bulletins} competition={competition} clubName={clubName} clubShort={clubShort} loading={loading} onSelectMatch={setSelectedMatchId} onView={navigateTo} />}
          {view === "pronosticos" && <PredictionsPage matches={matches} competition={competition} clubName={clubName} balance={virtualBalance} leaderboard={leaderboard} isLoggedIn={Boolean(user)} profileComplete={Boolean(profile?.nombre.trim() && profile?.apodo.trim())} databaseConnected={database === "connected"} onLogin={() => { setAuthMode("signup"); setAuthOpen(true); }} onPlace={createVirtualPrediction} onView={navigateTo} />}
          {view === "misPronosticos" && <MyPredictionsPage predictions={myPredictions} matches={matches} clubName={clubName} isLoggedIn={Boolean(user)} onLogin={() => { setAuthMode("signin"); setAuthOpen(true); }} onView={navigateTo} />}
          {view === "perfil" && <ProfilePage user={user} profile={profile} clubs={clubs} balance={virtualBalance} predictionCount={myPredictions.length} onSave={saveProfile} onUploadAvatar={uploadAvatar} onChangePassword={changePassword} passwordBusy={loginBusy} onSignIn={() => { setAuthMode("signin"); setAuthMessage(""); setAuthOpen(true); }} onSignUp={() => { setAuthMode("signup"); setAuthMessage(""); setAuthOpen(true); }} onRecover={() => { setAuthEmail(user?.email ?? authEmail); setAuthMode("recovery"); setAuthMessage(""); setAuthOpen(true); }} onSignOut={() => void signOut()} onView={navigateTo} />}
          {view === "tabla" && <PublicTablePage clubs={clubs} standings={standings} competition={competition} clubName={clubName} onView={navigateTo} />}
          {view === "calendario" && <CalendarPage clubs={clubs} matches={matches} competition={competition} clubName={clubName} onSelectMatch={setSelectedMatchId} onView={navigateTo} />}
          {view === "partido" && <MatchDetailPage clubs={clubs} match={activeMatch} competition={competition} events={events.filter((event) => event.partido_id === activeMatch?.id)} canOperateLive={canOperateLive} clubName={clubName} onView={navigateTo} />}
          {view === "clubes" && <ClubDirectoryPage clubs={clubs} onView={navigateTo} />}
          {view === "club" && <ClubProfilePage clubs={clubs} matches={matches} clubName={clubName} onView={navigateTo} />}
          {view === "estadisticas" && <StatisticsPage clubs={clubs} standings={standings} onView={navigateTo} />}
          {view === "boletines" && <BulletinsScreen bulletins={bulletins} onView={navigateTo} />}
          {view === "torneos" && <TournamentPanel clubs={clubs} matches={matches} phases={phases} competition={competition} clubName={clubName} onCreateCompetition={createCompetition} onCreateMatch={createMatch} onLogin={() => setAuthOpen(true)} canWrite={canManageTournaments} />}
          {view === "temporadas" && <CompetitionListPage competitions={competitions} onView={navigateTo} />}
          {view === "competencia" && <CompetitionFormPage onCreate={createCompetition} canWrite={canManageTournaments} onLogin={() => setAuthOpen(true)} />}
          {view === "fases" && <PhasesPage competition={competition} phases={phases.filter((phase) => phase.competencia_id === competition?.id)} canWrite={canManageTournaments} onLogin={() => setAuthOpen(true)} onCreate={createPhase} onView={navigateTo} />}
          {view === "clubesAdmin" && <ClubManagementPage clubs={clubs} canWrite={canManageTournaments} onLogin={() => setAuthOpen(true)} onCreate={createClub} onView={navigateTo} />}
          {view === "clubAdmin" && <AdminClubDetailPage clubs={clubs} onView={navigateTo} />}
          {view === "programacion" && <FixtureManagementPage clubs={clubs} phases={phases} matches={matches} clubName={clubName} onCreate={createMatch} canWrite={canManageTournaments} onLogin={() => setAuthOpen(true)} />}
          {view === "designaciones" && <DesignationPage matches={matches} users={managedUsers} clubName={clubName} canWrite={canManageTournaments} onLogin={() => setAuthOpen(true)} onAssign={assignMatchOfficial} />}
          {view === "usuarios" && <UserManagementPage users={managedUsers} onSetRole={setManagedUserRole} onView={navigateTo} />}
          {view === "planillas" && <LineupSelectorPage matches={matches} clubName={clubName} onSelectMatch={setSelectedMatchId} onView={navigateTo} />}
          {view === "planilla" && <LineupPanel clubs={clubs} players={players} lineups={lineups} matches={matches} selectedMatchId={selectedMatchId} clubName={clubName} clubShort={clubShort} canWrite={canManageLineups} busy={lineupBusy} onValidate={saveMatchLineup} onLogin={() => setAuthOpen(true)} onNotice={setNotice} />}
          {view === "jugador" && <PlayerEligibilityPage clubs={clubs} players={players} onView={navigateTo} />}
          {view === "acta" && <ActaPage match={activeMatch} competition={competition} clubName={clubName} onNotice={setNotice} />}
          {view === "vivo" && <LivePanel clubs={clubs} matches={matches} match={activeMatch} events={events.filter((event) => event.partido_id === activeMatch?.id)} players={players} clubName={clubName} clubShort={clubShort} canWrite={canOperateLive} actionBusy={liveActionBusy} onLogin={() => setAuthOpen(true)} onSelectMatch={setSelectedMatchId} onCreateAction={createLiveAction} />}
          {view === "incidencias" && <IncidentRegisterPage events={events} clubShort={clubShort} onView={navigateTo} />}
          {view === "var" && <VarIntegrityPage events={events} clubShort={clubShort} onView={navigateTo} />}
          {view === "disciplina" && <DisciplinePanel clubs={clubs} players={players} sanctions={filteredSanctions} search={search} setSearch={setSearch} canWrite={canManageTournaments} onLogin={() => setAuthOpen(true)} onCreateSanction={createSanction} />}
          {view === "alertas" && <DisciplineAlertsPage sanctions={sanctions} onView={navigateTo} />}
          {view === "sanciones" && <SanctionLedgerPage sanctions={filteredSanctions} search={search} setSearch={setSearch} onView={navigateTo} />}
          {view === "resolucion" && <ResolutionPage players={players} clubs={clubs} onCreate={createSanction} canWrite={canManageTournaments} onLogin={() => setAuthOpen(true)} />}
        </div>
        <footer className="footer"><span>Temporada {competition?.temporada ?? new Date().getFullYear()} · SIGEC-LP</span><span>Proyecto académico de demostración, sin afiliación oficial con LigaPro</span></footer>
      </div>

      {authOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
        <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
          <button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Cerrar">×</button>
          <div className="brand-crest large">LP</div>
          <p className="eyebrow">CUENTA DE AFICIONADO Y ACCESO</p>
          <h2 id="login-title">{authMode === "signin" ? "Ingresa a tu cuenta" : authMode === "signup" ? "Crea tu cuenta" : authMode === "recovery" ? "Recupera tu contraseña" : "Confirma tu correo"}</h2>
          <p className="muted">{authMode === "recovery" ? "Te enviaremos un enlace seguro a tu correo para restablecer el acceso." : authMode === "confirmation" ? "Confirma tu dirección para activar el acceso a tu cuenta." : "El acceso a cada módulo depende del rol asignado a tu perfil."}</p>
          {authMode === "confirmation" ? <div className="confirmation-panel"><p className="auth-message" role="status">{authMessage || "Revisa tu correo para confirmar tu cuenta."}</p><strong>{authEmail}</strong><button className="btn btn-gold full" type="button" disabled={loginBusy} onClick={() => void resendConfirmation()}>{loginBusy ? "Enviando…" : "Reenviar correo de confirmación"}</button><button className="auth-switch" type="button" onClick={() => { setAuthMode("signin"); setAuthMessage(""); }}>Volver a iniciar sesión</button></div> : <form onSubmit={authMode === "signin" ? signIn : authMode === "signup" ? signUp : recoverPassword} className="form-stack">
            {authMode === "signup" && <>
              <label>Nombre completo<input name="full_name" type="text" required maxLength={80} autoComplete="name" placeholder="Tu nombre y apellido" /></label>
              <label>Apodo<input name="nickname" type="text" required maxLength={30} autoComplete="nickname" placeholder="Cómo te verán en la comunidad" /></label>
              <label>Ciudad <span className="muted">(opcional)</span><input name="city" type="text" maxLength={60} autoComplete="address-level2" placeholder="Quito, Guayaquil…" /></label>
            </>}
            <label>Correo electrónico<input name="email" type="email" required autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="nombre@ligapro.ec" /></label>
            {authMode !== "recovery" && <label>Contraseña<input name="password" type="password" required minLength={8} autoComplete={authMode === "signin" ? "current-password" : "new-password"} placeholder="Mínimo 8 caracteres" /></label>}
            {authMode === "signup" && <label>Confirma la contraseña<input name="password_confirm" type="password" required minLength={8} autoComplete="new-password" placeholder="Repite tu contraseña" /></label>}
            {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
            <button className="btn btn-gold full" disabled={loginBusy}>{loginBusy ? "Procesando…" : authMode === "signin" ? "Iniciar sesión" : authMode === "signup" ? "Crear cuenta" : "Enviar enlace de recuperación"}</button>
          </form>}
          {authMode === "signin" && <button className="auth-switch" type="button" onClick={() => { setAuthMode("recovery"); setAuthMessage(""); }}>¿Olvidaste tu contraseña?</button>}
          {(authMode === "signin" || authMode === "signup") && <button className="auth-switch" type="button" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthMessage(""); }}>
            {authMode === "signin" ? "¿No tienes cuenta? Crear cuenta" : "¿Ya tienes cuenta? Iniciar sesión"}
          </button>}
          {(authMode === "signin" || authMode === "signup") && <><div className="oauth-divider"><span>o</span></div><button className="oauth-button" type="button" disabled={loginBusy} onClick={() => void signInWithGoogle()}><span className="google-g" aria-hidden="true">G</span>{loginBusy ? "Conectando…" : "Continuar con Google"}</button></>}
          {authMode === "recovery" && <button className="auth-switch" type="button" onClick={() => { setAuthMode("signin"); setAuthMessage(""); }}>Volver a iniciar sesión</button>}
          {(authMode === "signin" || authMode === "signup") && <p className="auth-footnote">Las cuentas nuevas tienen rol público. Los pronósticos usan únicamente puntos virtuales sin depósitos ni retiros.</p>}
        </section>
      </div>}
    </main>
  );
}

function PredictionsPage({ matches, competition, clubName, balance, leaderboard, isLoggedIn, profileComplete, databaseConnected, onLogin, onPlace, onView }: { matches: Match[]; competition: Competition | null; clubName: (id?: string) => string; balance: number; leaderboard: LeaderboardRow[]; isLoggedIn: boolean; profileComplete: boolean; databaseConnected: boolean; onLogin: () => void; onPlace: (matchId: string, selection: "local" | "empate" | "visitante", points: number) => void; onView: (view: View) => void }) {
  const games = matches.filter((match) => match.estado === "programado");
  const openGames = games.filter((match) => Boolean(match.fecha_hora && new Date(match.fecha_hora).getTime() > Date.now()));
  return <>
    <PageHeading eyebrow="PAN-028 · EXPERIENCIA DEL AFICIONADO" title="Pronósticos deportivos" subtitle="Elige el resultado de próximos partidos y compite con puntos virtuales. Los puntos no se compran ni se canjean por dinero."><button className="btn btn-light" onClick={() => onView("misPronosticos")}>Mis pronósticos →</button></PageHeading>
    <section className="prediction-banner"><div className="prediction-mark">⚽</div><div><span className="eyebrow">LIGA DE PRONÓSTICOS · SERIE {competition?.serie ?? "—"} · {competition?.temporada ?? "—"}</span><h2>Tu saldo virtual <strong>{balance.toLocaleString("es-EC")} pts</strong></h2><p>Saldo de demostración recreativa. No representa dinero, no admite depósitos, retiros ni premios canjeables.</p></div><button className="btn btn-dark" onClick={() => onView("misPronosticos")}>Ver actividad</button></section>
    {!isLoggedIn && <div className="permission-banner"><span>♙</span><div><strong>Regístrate para guardar tus pronósticos</strong><p>Completa nombre y apodo. Luego podrás usar el saldo inicial de puntos virtuales.</p></div><button className="btn btn-gold" onClick={onLogin}>Crear cuenta</button></div>}
    {isLoggedIn && !profileComplete && <div className="permission-banner"><span>ⓘ</span><div><strong>Completa tu perfil para participar</strong><p>Necesitas guardar tu nombre y apodo antes de enviar un pronóstico.</p></div><button className="btn btn-dark" onClick={() => onView("perfil")}>Completar perfil</button></div>}
    {!databaseConnected && <div className="risk-note eligibility-note"><span>ⓘ</span><p>No hay conexión con Supabase. Los pronósticos se habilitarán cuando se recupere el servicio.</p></div>}
    {databaseConnected && games.length > 0 && openGames.length === 0 && <div className="risk-note eligibility-note"><span>◷</span><p>Los partidos programados disponibles pertenecen a fechas pasadas. El organizador debe publicar próximos encuentros para habilitar nuevos pronósticos.</p><button className="text-link" onClick={() => onView("calendario")}>Revisar calendario →</button></div>}
    <div className="prediction-section-title"><div><p className="eyebrow">MERCADO 1X2</p><h2>¿Quién gana?</h2></div><span className="pill">Local · Empate · Visitante</span></div>
    {games.length ? <div className="prediction-list">{games.map((match) => <PredictionCard key={match.id} match={match} clubName={clubName} balance={balance} canPredict={isLoggedIn && profileComplete && databaseConnected && Boolean(match.fecha_hora && new Date(match.fecha_hora).getTime() > Date.now())} onLogin={onLogin} onPlace={onPlace} />)}</div> : <section className="panel empty-state"><span>◷</span><strong>Aún no hay partidos programados</strong><p>Cuando el organizador publique próximos encuentros, aquí aparecerán las opciones de pronóstico.</p></section>}
    <section className="panel leaderboard-panel"><div className="panel-heading"><div><p className="eyebrow">COMUNIDAD · PUNTOS VIRTUALES</p><h2>Ranking de pronósticos</h2></div><span className="pill">Actualiza cada 30 s</span></div>{leaderboard.length ? <ol className="ranking-list">{leaderboard.map((row) => <li key={`${row.posicion}-${row.apodo}`}><span className="ranking-position">{row.posicion}</span><span className="ranking-name">{row.apodo}</span><span className="ranking-record">{row.aciertos}/{row.total_pronosticos} aciertos</span><strong>{row.puntos.toLocaleString("es-EC")} pts</strong></li>)}</ol> : <div className="empty-state compact"><strong>Aún no hay pronósticos registrados</strong><p>Solo publica apodos y puntos virtuales; nunca correos ni nombres de cuenta.</p></div>}</section>
  </>;
}

function PredictionCard({ match, clubName, balance, canPredict, onLogin, onPlace }: { match: Match; clubName: (id?: string) => string; balance: number; canPredict: boolean; onLogin: () => void; onPlace: (matchId: string, selection: "local" | "empate" | "visitante", points: number) => void }) {
  const [selection, setSelection] = useState<"local" | "empate" | "visitante" | null>(null);
  const [points, setPoints] = useState(20);
  const odds = { local: 2.1, empate: 3.2, visitante: 2.8 };
  const isOpen = Boolean(match.fecha_hora && new Date(match.fecha_hora).getTime() > Date.now());
  const options: { key: "local" | "empate" | "visitante"; label: string; team: string; price: number }[] = [
    { key: "local", label: "1 · Gana local", team: clubName(match.local_id), price: odds.local },
    { key: "empate", label: "X · Empate", team: "Igualdad", price: odds.empate },
    { key: "visitante", label: "2 · Gana visitante", team: clubName(match.visitante_id), price: odds.visitante },
  ];
  function submit() {
    if (!canPredict) { onLogin(); return; }
    if (!selection) return;
    onPlace(match.id, selection, points);
  }
  return <article className="panel prediction-card">
    <div className="prediction-card-head"><div><span className="eyebrow">JORNADA {match.jornada} · {match.fase ?? "LIGAPRO"}</span><h3>{clubName(match.local_id)} <small>vs</small> {clubName(match.visitante_id)}</h3><p>{match.fecha ?? "Fecha pendiente"} · {match.estadio ?? "Estadio por confirmar"}</p></div><span className={`pill ${isOpen ? "pill-green" : "pill-warn"}`}>{isOpen ? "Abierto" : "Cerrado / sin fecha"}</span></div>
    <div className="prediction-options">{options.map((option) => <button key={option.key} className={selection === option.key ? "prediction-option selected" : "prediction-option"} disabled={!canPredict} onClick={() => setSelection(option.key)} aria-pressed={selection === option.key}><span>{option.label}</span><strong>{option.price.toFixed(2)}</strong><small>{option.team}</small></button>)}</div>
    <div className="prediction-card-foot"><label>Puntos a usar<input type="number" min={10} max={Math.min(500, balance)} step={10} value={points} disabled={!canPredict} onChange={(event) => setPoints(Number(event.target.value))}/></label><div className="prediction-return"><span>Retorno virtual estimado</span><strong>{selection ? Math.round(points * odds[selection]).toLocaleString("es-EC") : "—"} pts</strong></div><button className="btn btn-gold" disabled={!canPredict || !selection || points < 10 || points > Math.min(500, balance)} onClick={submit}>{canPredict ? "Confirmar pronóstico" : "No disponible"}</button></div>
  </article>;
}

function MyPredictionsPage({ predictions, matches, clubName, isLoggedIn, onLogin, onView }: { predictions: VirtualPrediction[]; matches: Match[]; clubName: (id?: string) => string; isLoggedIn: boolean; onLogin: () => void; onView: (view: View) => void }) {
  const label: Record<VirtualPrediction["estado"], string> = { pendiente: "Pendiente", ganado: "Acertado", perdido: "No acertado", anulado: "Anulado · puntos devueltos" };
  const matchFor = (id: string) => matches.find((match) => match.id === id);
  return <>
    <PageHeading eyebrow="PAN-029 · HISTORIAL PERSONAL" title="Mis pronósticos" subtitle="Revisa tus selecciones y el resultado de cada jornada."><button className="btn btn-dark" onClick={() => onView("pronosticos")}>Explorar partidos →</button></PageHeading>
    {!isLoggedIn ? <section className="panel empty-state"><span>♙</span><strong>Inicia sesión para ver tu historial</strong><button className="btn btn-gold" onClick={onLogin}>Ingresar o registrarme</button></section> : predictions.length ? <section className="panel prediction-history"><div className="panel-heading"><div><p className="eyebrow">ÚLTIMOS 50 REGISTROS</p><h2>Actividad de pronósticos</h2></div><span className="pill">{predictions.length} registros</span></div>{predictions.map((prediction) => { const match = matchFor(prediction.partido_id); const picked = prediction.seleccion === "local" ? clubName(match?.local_id) : prediction.seleccion === "visitante" ? clubName(match?.visitante_id) : "Empate"; return <article className="prediction-history-row" key={prediction.id}><div><span className="eyebrow">{match ? `JORNADA ${match.jornada}` : "LIGAPRO"} · {new Date(prediction.created_at).toLocaleDateString("es-EC")}</span><strong>{match ? `${clubName(match.local_id)} vs ${clubName(match.visitante_id)}` : "Partido"}</strong><small>Selección: {picked} · cuota {Number(prediction.cuota).toFixed(2)}</small></div><div className="prediction-history-points"><span>{prediction.puntos_apostados} pts</span><strong>{prediction.retorno_puntos} pts retorno</strong></div><span className={`pill ${prediction.estado === "ganado" ? "pill-green" : prediction.estado === "pendiente" ? "pill-gold" : "pill-warn"}`}>{label[prediction.estado]}</span></article>; })}</section> : <section className="panel empty-state"><span>⚽</span><strong>Aún no tienes pronósticos</strong><p>Elige un resultado antes del inicio de un partido programado.</p><button className="btn btn-dark" onClick={() => onView("pronosticos")}>Ver partidos</button></section>}
  </>;
}

function ProfilePage({ user, profile, clubs, balance, predictionCount, onSave, onUploadAvatar, onChangePassword, passwordBusy, onSignIn, onSignUp, onRecover, onSignOut, onView }: { user: User | null; profile: Profile | null; clubs: Club[]; balance: number; predictionCount: number; onSave: (event: FormEvent<HTMLFormElement>) => void; onUploadAvatar: (file: File) => Promise<void>; onChangePassword: (event: FormEvent<HTMLFormElement>) => void; passwordBusy: boolean; onSignIn: () => void; onSignUp: () => void; onRecover: () => void; onSignOut: () => void; onView: (view: View) => void }) {
  const [draft, setDraft] = useState<Profile>({ nombre: "", apodo: "", ciudad: "", club_favorito_id: "", avatar_url: null });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");
  const avatarInput = useRef<HTMLInputElement>(null);

  async function handleAvatarSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setAvatarMessage("Elige una foto JPG, PNG o WEBP."); return; }
    if (file.size > 2 * 1024 * 1024) { setAvatarMessage("La foto debe pesar 2 MB o menos."); return; }
    setAvatarBusy(true);
    setAvatarMessage("");
    try {
      const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const isJpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
      const isPng = signature.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
      const isWebp = String.fromCharCode(...signature.slice(0, 4)) === "RIFF" && String.fromCharCode(...signature.slice(8, 12)) === "WEBP";
      if (!isJpeg && !isPng && !isWebp) throw new Error("El archivo no parece ser una imagen JPG, PNG o WEBP válida.");
      await onUploadAvatar(file);
      setAvatarMessage("Foto de perfil actualizada.");
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : "No se pudo actualizar la foto.");
    } finally {
      setAvatarBusy(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    setDraft({
      nombre: profile?.nombre ?? String(user.user_metadata?.full_name ?? ""),
      apodo: profile?.apodo ?? String(user.user_metadata?.nickname ?? ""),
      ciudad: profile?.ciudad ?? String(user.user_metadata?.city ?? ""),
      club_favorito_id: profile?.club_favorito_id ?? "",
      avatar_url: profile?.avatar_url ?? null,
    });
  }, [profile, user]);
  if (!user) return <><PageHeading eyebrow="PAN-030 · REGISTRO DE AFICIONADO" title="Mi perfil LigaPro" subtitle="Accede a tu cuenta, actualiza tus datos y participa en los pronósticos con puntos virtuales."/><section className="profile-signup panel"><div className="profile-avatar">LP</div><div className="profile-signup-content"><span className="eyebrow">TU CUENTA DE AFICIONADO</span><h2>Todo tu seguimiento en un solo lugar</h2><p>Guarda tu nombre, apodo, ciudad y club favorito. Consulta tu actividad, administra tu acceso y explora los partidos de pronósticos.</p><div className="profile-actions"><button className="btn btn-dark" onClick={onSignIn}>Iniciar sesión</button><button className="btn btn-gold" onClick={onSignUp}>Crear cuenta gratis</button><button className="btn btn-light" onClick={onRecover}>Recuperar contraseña</button></div></div></section><div className="profile-feature-grid"><button className="panel profile-feature" onClick={() => onView("pronosticos")}><span>⚽</span><strong>Pronósticos</strong><small>Elige resultados con puntos de juego virtuales.</small></button><button className="panel profile-feature" onClick={() => onView("misPronosticos")}><span>▤</span><strong>Mi actividad</strong><small>Consulta tus pronósticos guardados al iniciar sesión.</small></button></div></>;
  return <>
    <PageHeading eyebrow="PAN-030 · PERFIL DE AFICIONADO" title="Mi perfil" subtitle="Edita tus datos, revisa tu actividad y administra la seguridad de tu cuenta."><button className="btn btn-light" onClick={() => onView("pronosticos")}>⚽ Ver pronósticos</button></PageHeading>
    <div className="profile-layout"><section className="panel profile-summary"><div className="profile-photo-control"><div className="profile-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt={`Foto de ${profile.apodo || profile.nombre || "perfil"}`} /> : (profile?.apodo || profile?.nombre || user.email || "LP").slice(0, 2).toUpperCase()}</div><button className="btn btn-light" onClick={() => avatarInput.current?.click()} disabled={avatarBusy || !profile}>{avatarBusy ? "Subiendo foto…" : profile?.avatar_url ? "Cambiar foto" : "Subir foto"}</button><input ref={avatarInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleAvatarSelect(event)} /><small>JPG, PNG o WEBP · máximo 2 MB</small>{avatarMessage && <p className="avatar-message" role="status">{avatarMessage}</p>}</div><span className="pill pill-green">Cuenta activa</span><h2>{profile?.apodo || "Aficionado"}</h2><p>{user.email}</p><div className="profile-summary-foot"><span>Miembro desde</span><strong>{new Date(user.created_at).toLocaleDateString("es-EC", { month: "short", year: "numeric" })}</strong></div><div className="profile-account-actions"><button className="btn btn-light" onClick={() => document.getElementById("profile-editor")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Editar perfil</button><button className="btn btn-light" onClick={() => setPasswordOpen((open) => !open)}>{passwordOpen ? "Ocultar cambio de contraseña" : "Cambiar contraseña"}</button><button className="btn btn-quiet" onClick={onSignOut}>Cerrar sesión</button></div></section>
    <section className="profile-main-column"><div className="profile-feature-grid"><article className="panel profile-stat"><span>PRONÓSTICOS GUARDADOS</span><strong>{predictionCount}</strong><button className="text-link" onClick={() => onView("misPronosticos")}>Ver mi actividad →</button></article><article className="panel profile-stat"><span>SALDO DE JUEGO VIRTUAL</span><strong>{balance.toLocaleString("es-EC")} pts</strong><small>Sin valor monetario ni canje</small></article></div>
    <section className="panel form-panel profile-form-panel" id="profile-editor"><div className="panel-heading"><div><p className="eyebrow">INFORMACIÓN PERSONAL</p><h2>Editar datos de perfil</h2></div><span className="pill">Privado por defecto</span></div><form className="profile-form" onSubmit={onSave}><label>Nombre completo<input name="nombre" required maxLength={80} autoComplete="name" value={draft.nombre} onChange={(event) => setDraft({ ...draft, nombre: event.target.value })} placeholder="Nombre y apellido"/></label><label>Apodo<input name="apodo" required maxLength={30} autoComplete="nickname" value={draft.apodo} onChange={(event) => setDraft({ ...draft, apodo: event.target.value })} placeholder="Cómo te verá la comunidad"/></label><label>Ciudad <span className="muted">(opcional)</span><input name="ciudad" maxLength={60} autoComplete="address-level2" value={draft.ciudad} onChange={(event) => setDraft({ ...draft, ciudad: event.target.value })} placeholder="Ciudad"/></label><label>Club favorito <span className="muted">(opcional)</span><select name="club_favorito_id" value={draft.club_favorito_id ?? ""} onChange={(event) => setDraft({ ...draft, club_favorito_id: event.target.value })}><option value="">No elegir por ahora</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label><div className="form-actions"><p className="muted">Tu correo se administra de forma segura con Supabase Auth.</p><button className="btn btn-gold">Guardar cambios</button></div></form></section>
    {passwordOpen && <section className="panel form-panel profile-form-panel" id="password-editor"><div className="panel-heading"><div><p className="eyebrow">SEGURIDAD DE LA CUENTA</p><h2>Cambiar contraseña</h2></div><span className="pill">Verificaremos tu contraseña actual</span></div><form className="password-change-form" onSubmit={onChangePassword}><label>Contraseña actual<input name="current_password" type="password" required autoComplete="current-password" placeholder="Tu contraseña actual"/></label><label>Nueva contraseña<input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres"/></label><label>Confirma la nueva contraseña<input name="password_confirm" type="password" required minLength={8} autoComplete="new-password" placeholder="Repite la nueva contraseña"/></label><div className="profile-password-actions"><button className="btn btn-gold" disabled={passwordBusy}>{passwordBusy ? "Actualizando…" : "Guardar contraseña"}</button><button className="text-link" type="button" onClick={onRecover}>¿Olvidaste tu contraseña actual?</button></div></form></section>}</section></div>
  </>;
}

function PageHeading({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children?: React.ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted heading-copy">{subtitle}</p></div>{children && <div className="heading-actions">{children}</div>}</div>;
}

function ClubMark({ club, compact = false }: { club?: Club; compact?: boolean }) {
  return <span className={`club-mark ${compact ? "compact" : ""}`} style={{ "--club-color": club?.color ?? "#d7dbe2" } as React.CSSProperties}>{club?.sigla ?? "LP"}</span>;
}

function Portal({ clubs, standings, matches, bulletins, competition, clubName, clubShort, loading, onSelectMatch, onView }: { clubs: Club[]; standings: Standing[]; matches: Match[]; bulletins: Bulletin[]; competition: Competition | null; clubName: (id?: string) => string; clubShort: (id?: string) => string; loading: boolean; onSelectMatch: (matchId: string) => void; onView: (view: View) => void }) {
  const live = matches.find((match) => match.estado === "en_vivo");
  const finished = matches.filter((match) => match.estado === "finalizado");
  const goals = matches.reduce((total, match) => total + match.goles_local + match.goles_visitante, 0);
  const average = finished.length ? (finished.reduce((total, match) => total + match.goles_local + match.goles_visitante, 0) / finished.length).toFixed(2) : "—";
  const round = Math.max(0, ...matches.map((match) => match.jornada));
  const clubFor = (id?: string) => clubs.find((club) => club.id === id);
  const season = competition?.temporada ?? new Date().getFullYear();
  return <>
    <div className="portal-hero"><div className="hero-title"><span className="hero-icon">◈</span><div><div className="eyebrow gold-text">SIGEC-LP · COMPETICIONES</div><h1>Competiciones y resultados</h1><p>{competition?.nombre ?? "No hay una competencia cargada todavía."}</p></div></div><div className="hero-stats"><div><span>PARTIDOS CARGADOS</span><strong>{matches.length}</strong></div><div><span>GOLES REGISTRADOS</span><strong>{goals}</strong></div><div><span>PROMEDIO / PARTIDO</span><strong>{average}</strong></div></div></div>
    <div className="portal-toolbar"><div className="phase-tabs"><button className="selected">Temporada {season}</button><button onClick={() => onView("tabla")}>Tabla de posiciones</button></div><button className="btn btn-light" onClick={() => onView("calendario")}>▦ Calendario completo</button></div>
    <section className="section-block"><div className="section-heading"><div>{live && <span className="live-dot" />} <h2>{live ? "Partido en vivo" : `Jornada ${round || "—"}`}</h2></div><span className="timezone-label">HORA DE ECUADOR · UTC−5</span></div>{matches.length ? <div className="match-grid">{matches.slice(0, 4).map((match) => <article className={`match-card ${match.estado === "en_vivo" ? "is-live" : ""}`} key={match.id}><div className="match-card-top"><span className={match.estado === "en_vivo" ? "match-status live" : "match-status"}>{match.estado === "en_vivo" ? "● EN VIVO" : match.fecha ?? "PROGRAMADO"}</span><span className="match-venue">{match.estadio ?? "Estadio por asignar"}</span></div><div className="match-team"><ClubMark club={clubFor(match.local_id)} compact /><strong>{clubName(match.local_id)}</strong><b>{match.estado === "programado" ? "–" : match.goles_local}</b></div><div className="match-team"><ClubMark club={clubFor(match.visitante_id)} compact /><strong>{clubName(match.visitante_id)}</strong><b>{match.estado === "programado" ? "–" : match.goles_visitante}</b></div><div className="match-card-foot"><span>{match.fase ?? "Competencia"} · Jornada {match.jornada}</span><button className="text-link" onClick={() => { onSelectMatch(match.id); onView("partido"); }}>Detalle →</button></div></article>)}</div> : <div className="empty-state"><span>◷</span><strong>{loading ? "Cargando partidos…" : "No hay partidos cargados"}</strong><p>Cuando se registren partidos en Supabase aparecerán aquí.</p></div>}</section>
    <div className="portal-columns"><section className="panel standings-panel"><div className="panel-heading"><div><p className="eyebrow">TEMPORADA {season} · SERIE {competition?.serie ?? "—"}</p><h2>Tabla de posiciones</h2><p className="muted">Se calcula automáticamente con los partidos finalizados.</p></div><span className="pill pill-gold">{round ? `JORNADA ${round}` : "SIN PARTIDOS"}</span></div>{standings.length ? <div className="table-scroll"><table className="data-table standings-table"><thead><tr><th>Pos.</th><th>Club</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr></thead><tbody>{standings.map((row, index) => <tr key={row.club_id ?? index}><td><span className="position">{index + 1}</span></td><td><span className="club-cell"><ClubMark club={clubFor(row.club_id)} compact /><strong>{row.club ?? clubName(row.club_id)}</strong></span></td><td>{row.pj}</td><td>{row.pg}</td><td>{row.pe}</td><td>{row.pp}</td><td>{row.gf}</td><td>{row.gc}</td><td className={row.dg < 0 ? "negative" : ""}>{row.dg > 0 ? `+${row.dg}` : row.dg}</td><td><strong>{row.pts}</strong></td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>La tabla aparecerá con la competencia</strong><p>No hay resultados finalizados para calcular posiciones.</p></div>}<div className="table-meta">{standings.length} clubes · Temporada {season}</div></section>
      <aside className="portal-rail"><section className="official-card"><p className="eyebrow gold-text">SEGUIMIENTO DEL PARTIDO</p><h2>{live ? "Marcador en desarrollo" : "Próximos encuentros"}</h2><p>{live ? `${clubName(live.local_id)} vs ${clubName(live.visitante_id)}` : "Consulta los partidos y horarios cargados para la competencia."}</p><div className="official-match"><span>{live ? `${live.goles_local} — ${live.goles_visitante}` : `${matches.filter((match) => match.estado === "programado").length} programados`}</span><strong>{live ? "EN VIVO" : "JORNADA " + (round || "—")}</strong></div><button className="btn btn-gold full" onClick={() => onView(live ? "partido" : "calendario")}>{live ? "Ver partido" : "Abrir calendario"}</button></section><section className="panel bulletin-card"><div className="panel-heading"><h2>Comunicados</h2><span className="pill">{bulletins.length}</span></div>{bulletins.length ? bulletins.slice(0, 4).map((bulletin) => <article className="bulletin" key={bulletin.id}><span className="eyebrow">{bulletin.categoria}</span><h3>{bulletin.titulo}</h3><p className="muted">{bulletin.resumen}</p></article>) : <div className="empty-state compact"><strong>No hay comunicados publicados</strong><p>Los comunicados vigentes se cargarán desde Supabase.</p></div>}</section></aside></div>
  </>;
}
function TournamentPanel({ clubs, matches, phases, competition, clubName, onCreateCompetition, onCreateMatch, onLogin, canWrite }: { clubs: Club[]; matches: Match[]; phases: Phase[]; competition: Competition | null; clubName: (id?: string) => string; onCreateCompetition: (event: FormEvent<HTMLFormElement>) => void; onCreateMatch: (event: FormEvent<HTMLFormElement>) => void; onLogin: () => void; canWrite: boolean }) {
  const [showCompetition, setShowCompetition] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  return <>
    <PageHeading eyebrow="PAN-002 · DIRECCIÓN DE COMPETICIONES" title="Torneos, fases y calendario" subtitle="Gestiona temporadas, estructura de competencia, clubes y programación."><button className="btn btn-light" onClick={() => setShowCompetition(!showCompetition)}>＋ Nueva competencia</button><button className="btn btn-gold" onClick={() => setShowMatch(!showMatch)}>▦ Programar partido</button></PageHeading>
    {!canWrite && <div className="permission-banner"><span>◉</span><div><strong>Acceso de consulta</strong><p>Inicia sesión con un perfil autorizado para crear temporadas o programar encuentros.</p></div><button className="btn btn-dark" onClick={onLogin}>Ingresar</button></div>}
    {showCompetition && <section className="panel form-panel"><div className="panel-heading"><h2>Crear competencia</h2><button className="icon-close" onClick={() => setShowCompetition(false)}>×</button></div><form className="inline-form" onSubmit={onCreateCompetition}><label>Nombre<input name="nombre" required placeholder="LigaPro Serie A" /></label><label>Temporada<input name="temporada" type="number" min="2000" max="2100" defaultValue={new Date().getFullYear()} required /></label><label>Serie<select name="serie"><option value="A">Serie A</option><option value="B">Serie B</option></select></label><button className="btn btn-dark">Guardar</button></form></section>}
    {showMatch && <section className="panel form-panel"><div className="panel-heading"><h2>Programar partido</h2><button className="icon-close" onClick={() => setShowMatch(false)}>×</button></div><form className="inline-form match-form" onSubmit={onCreateMatch}><label>Club local<select name="local" required>{clubs.map((club) => <option value={club.id} key={club.id}>{club.nombre}</option>)}</select></label><label>Club visitante<select name="visitante" required>{clubs.map((club) => <option value={club.id} key={club.id}>{club.nombre}</option>)}</select></label><label>Fase<select name="fase"><option value="">Sin fase</option>{phases.map((phase) => <option value={phase.id} key={phase.id}>{phase.nombre}</option>)}</select></label><label>Jornada<input name="jornada" type="number" min="1" max="60" defaultValue="1" required /></label><label>Fecha y hora<input name="fecha" type="datetime-local" required /></label><label>Estadio<input name="estadio" placeholder="Estadio del club local" /></label><button className="btn btn-gold">Guardar programación</button></form></section>}
    <section className="metrics-grid four"><Metric label="AVANCE DEL CALENDARIO" value={`${matches.filter((m) => m.estado === "finalizado").length}`} suffix={` / ${matches.length}`} note="Partidos finalizados" icon="▦" /><Metric label="PARTIDOS PROGRAMADOS" value={`${matches.filter((m) => m.estado === "programado").length}`} note="En el calendario visible" icon="◷" /><Metric label="CLUBES AFILIADOS" value={`${clubs.length}`} note="Participantes cargados" icon="♜" /><Metric label="ESTADO COMPETENCIA" value={competition ? (competition.estado === "demo" ? "Muestra inicial" : competition.estado) : "Sin competencia"} note={competition?.nombre ?? "LigaPro Serie A"} icon="◈" />
    </section>
    <section className="regulatory-callout"><span className="callout-icon">◷</span><div><strong>Protocolo de programación</strong><p>Verifica fechas, sedes y disponibilidad antes de publicar el calendario. La simultaneidad de horarios debe configurarse según el reglamento de la competencia.</p></div><span className="pill pill-gold">REGLA CONFIGURABLE</span></section>
    <div className="tournament-layout"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">TEMPORADA {competition?.temporada ?? "—"}</p><h2>Clubes afiliados</h2></div><span className="pill">{clubs.length} clubes</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>CLUB / ENTIDAD</th><th>ESTADIO PRINCIPAL</th><th>DIVISIÓN</th><th>ESTADO</th></tr></thead><tbody>{clubs.map((club) => <tr key={club.id}><td><span className="club-cell"><ClubMark club={club} compact /><strong>{club.nombre}</strong></span></td><td>{club.estadio ?? "No registrado"}</td><td><span className="pill pill-gold">{club.serie ? `SERIE ${club.serie}` : "SIN SERIE"}</span></td><td><span className={club.activo ? "state-ok" : "pill pill-warn"}>{club.activo ? "● Activo" : "Inactivo"}</span></td></tr>)}</tbody></table></div></section><aside className="panel fixture-panel"><div className="panel-heading"><div><p className="eyebrow">TABLERO OPERATIVO</p><h2>Programación</h2></div><span className="pill pill-gold">{competition?.formato ?? "SIN FORMATO"}</span></div><div className="fixture-list">{matches.map((match) => <article className="fixture-item" key={match.id}><div className="fixture-date"><span>{match.fecha ?? "Fecha por asignar"}</span><span className={`pill ${match.estado === "en_vivo" ? "pill-red" : ""}`}>{badgeText(match.estado)}</span></div><h3>{clubName(match.local_id)} <small>vs</small> {clubName(match.visitante_id)}</h3><p>{match.estadio ?? "Sede pendiente"} · Jornada {match.jornada}</p></article>)}</div><button className="btn btn-dark full" onClick={() => canWrite ? setShowMatch(true) : onLogin()}>＋ Agregar partido</button></aside></div>
  </>;
}

function Metric({ label, value, suffix, note, icon }: { label: string; value: string; suffix?: string; note: string; icon: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><div className="metric-value">{value}<small>{suffix}</small></div><p>{note}</p></article>;
}

function LineupPanel({ clubs, players, lineups, matches, selectedMatchId, clubName, clubShort, canWrite, busy, onValidate, onLogin, onNotice }: { clubs: Club[]; players: Player[]; lineups: LineupRow[]; matches: Match[]; selectedMatchId: string | null; clubName: (id?: string) => string; clubShort: (id?: string) => string; canWrite: boolean; busy: boolean; onValidate: (matchId: string, playerIds: string[]) => Promise<boolean>; onLogin: () => void; onNotice: (message: string) => void }) {
  const match = matches.find((item) => item.id === selectedMatchId) ?? matches.find((item) => item.estado === "programado") ?? matches[0];
  const sides = [match?.local_id, match?.visitante_id].filter(Boolean) as string[];
  const rosterFor = (id: string) => players.filter((player) => player.club_id === id);
  const [starters, setStarters] = useState<Record<string, string[]>>({});
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    const current = lineups.filter((row) => row.partido_id === match?.id && row.titular);
    const saved: Record<string, string[]> = {};
    for (const clubId of sides) saved[clubId] = current.filter((row) => row.club_id === clubId).map((row) => row.jugador_id);
    setStarters(saved);
    setValidated(current.length === 22);
  }, [match?.id, lineups]);

  function toggleStarter(clubId: string, playerId: string) {
    if (!canWrite) { onLogin(); return; }
    const player = players.find((item) => item.id === playerId);
    if (!player || player.estado_comet !== "habilitado") return;
    const selected = starters[clubId] ?? [];
    if (!selected.includes(playerId) && selected.length >= 11) { onNotice("Cada club puede seleccionar exactamente 11 titulares."); return; }
    setValidated(false);
    setStarters({ ...starters, [clubId]: selected.includes(playerId) ? selected.filter((id) => id !== playerId) : [...selected, playerId] });
  }

  async function validate() {
    if (!canWrite) { onLogin(); return; }
    if (!match) { onNotice("Selecciona un partido programado."); return; }
    if (sides.length !== 2 || sides.some((clubId) => (starters[clubId] ?? []).length !== 11)) {
      onNotice("Selecciona exactamente 11 titulares habilitados por cada club.");
      setValidated(false);
      return;
    }
    const selectedIds = sides.flatMap((clubId) => starters[clubId] ?? []);
    const saved = await onValidate(match.id, selectedIds);
    setValidated(saved);
  }

  return <>
    <PageHeading eyebrow="PAN-003 · PLANILLA DE PARTIDO" title="Nóminas titulares" subtitle="Selecciona once jugadores habilitados por equipo y guarda la planilla en Supabase."><button className="btn btn-gold" disabled={busy || !match || match.estado !== "programado"} onClick={() => void validate()}>{busy ? "Guardando…" : "✓ Validar y guardar"}</button></PageHeading>
    {!canWrite && <div className="permission-banner"><span>▣</span><div><strong>Consulta de planilla</strong><p>La validación requiere al árbitro asignado al partido o a un administrador.</p></div><button className="btn btn-dark" onClick={onLogin}>Ingresar</button></div>}
    {match ? <><section className="match-banner"><div className="match-banner-title"><span className="eyebrow gold-text">SIGEC-LP · {match.fase ?? "FASE SIN ASIGNAR"}</span><span className="pill">{badgeText(match.estado)}</span></div><div className="versus"><div><ClubMark club={clubs.find((club) => club.id === match.local_id)} /><strong>{clubName(match.local_id)}</strong><small>LOCAL · JORNADA {match.jornada}</small></div><span>VS</span><div><ClubMark club={clubs.find((club) => club.id === match.visitante_id)} /><strong>{clubName(match.visitante_id)}</strong><small>VISITANTE · JORNADA {match.jornada}</small></div></div><div className="match-banner-foot"><span>▦ {match.estadio ?? "Estadio pendiente"}</span><span>{match.fecha ?? "Fecha pendiente"}</span><span>Lista guardada en SIGEC-LP</span></div></section>
    {validated && <div className="success-banner">✓ Planilla guardada en Supabase: 11 titulares por club.</div>}
    <div className="squad-grid">{sides.map((clubId) => { const roster = rosterFor(clubId); const selected = starters[clubId] ?? []; const suspendedCount = roster.filter((player) => player.estado_comet === "suspendido").length; return <section className="panel squad-panel" key={clubId}><div className="panel-heading"><div className="club-cell"><ClubMark club={clubs.find((club) => club.id === clubId)} /><div><h2>{clubName(clubId)}</h2><p className="eyebrow">CLUB · {clubShort(clubId)}</p></div></div><span className={`pill ${selected.length === 11 ? "pill-green" : "pill-warn"}`}>{selected.length} / 11 titulares</span></div>{roster.length ? <><div className="roster-summary"><span>Elegibles <strong>{roster.filter((player) => player.estado_comet === "habilitado").length}</strong></span><span>Suspendidos <strong>{suspendedCount}</strong></span><span>Disponibles <strong>{roster.length - suspendedCount}</strong></span></div>{suspendedCount > 0 && <p className="suspension-inline-note">Los jugadores suspendidos para esta jornada no se pueden seleccionar.</p>}<div className="roster-list">{roster.map((player) => <label className="roster-row lineup-player-row" key={player.id}><input type="checkbox" checked={selected.includes(player.id)} disabled={!canWrite || player.estado_comet !== "habilitado" || (selected.length >= 11 && !selected.includes(player.id)) || match.estado !== "programado"} onChange={() => toggleStarter(clubId, player.id)} aria-label={`Seleccionar a ${player.nombre} como titular`} /><span className="jersey">{player.dorsal}</span><strong>{player.nombre}</strong><span className="position-chip">{player.posicion}</span><span className={player.estado_comet === "habilitado" ? "pill pill-green" : "pill pill-red"}>{player.estado_comet === "suspendido" ? "Suspendido · próxima fecha" : player.estado_comet}</span></label>)}</div></> : <div className="empty-state"><span>▣</span><strong>No hay jugadores cargados</strong><p>Registra la plantilla del club en Supabase para preparar la planilla.</p></div>}</section>; })}</div></> : <section className="panel empty-state"><strong>No hay partidos accesibles para revisar</strong><p>El árbitro debe estar asignado al partido o la competencia debe tener encuentros programados.</p></section>}
    <section className="risk-note eligibility-note"><span>ⓘ</span><p>La validación y elegibilidad se guardan en SIGEC-LP. La sincronización con el sistema externo COMET no está configurada.</p></section>
  </>;
}
function LivePanel({ clubs, matches, match, events, players, clubName, clubShort, canWrite, actionBusy, onLogin, onSelectMatch, onCreateAction }: { clubs: Club[]; matches: Match[]; match?: Match; events: EventRow[]; players: Player[]; clubName: (id?: string) => string; clubShort: (id?: string) => string; canWrite: boolean; actionBusy: boolean; onLogin: () => void; onSelectMatch: (matchId: string) => void; onCreateAction: (action: string, clubId?: string, playerId?: string, secondaryPlayerId?: string, detail?: string) => void }) {
  const [clubId, setClubId] = useState(match?.local_id ?? "");
  const [playerId, setPlayerId] = useState("");
  const [playerOutId, setPlayerOutId] = useState("");
  const [playerInId, setPlayerInId] = useState("");
  const [detail, setDetail] = useState("");
  const homeRoster = players.filter((player) => player.club_id === match?.local_id);
  const awayRoster = players.filter((player) => player.club_id === match?.visitante_id);
  const teamRoster = players.filter((player) => player.club_id === clubId);
  const seconds = elapsedMatchSeconds(match);
  const clock = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  const minute = Math.floor(seconds / 60);
  const isLive = match?.estado === "en_vivo";
  const canRecordMatchEvent = isLive && ["primer_tiempo", "segundo_tiempo"].includes(match?.periodo ?? "");

  useEffect(() => {
    setClubId(match?.local_id ?? "");
    setPlayerId("");
    setPlayerOutId("");
    setPlayerInId("");
  }, [match?.id, match?.local_id]);

  function submitAction(action: string) {
    let player = "";
    let secondPlayer = "";
    let eventDetail = detail.trim();
    if (["gol", "amarilla", "roja", "sustitucion"].includes(action) && !clubId) return;
    if (action === "sustitucion") {
      if (!playerOutId || !playerInId || playerOutId === playerInId) return;
      const outgoing = players.find((item) => item.id === playerOutId);
      const incoming = players.find((item) => item.id === playerInId);
      player = playerOutId;
      secondPlayer = playerInId;
      eventDetail = "Sale " + (outgoing?.nombre ?? "jugador") + "; entra " + (incoming?.nombre ?? "jugador") + (eventDetail ? " · " + eventDetail : "");
    } else if (playerId) {
      player = playerId;
      const scorer = players.find((item) => item.id === playerId);
      eventDetail = (scorer?.nombre ? scorer.nombre + (eventDetail ? " · " : "") : "") + eventDetail;
    }
    onCreateAction(action, clubId || undefined, player || undefined, secondPlayer || undefined, eventDetail);
    if (action !== "iniciar" && action !== "medio_tiempo" && action !== "inicio_segundo_tiempo" && action !== "final") setDetail("");
  }

  return <>
    <PageHeading eyebrow="PAN-004 · CONSOLA DE REGISTRO EN VIVO" title="Consola del operador en vivo" subtitle="El marcador, el reloj y los eventos se sincronizan desde Supabase para todos los espectadores."><span className="live-connect"><i /> {isLive ? "SINCRONIZADO EN VIVO" : "ACTA DIGITAL"}</span></PageHeading>
    {!canWrite && <div className="permission-banner"><span>◉</span><div><strong>Consola en modo consulta</strong><p>El registro en vivo está habilitado para operador o administrador.</p></div><button className="btn btn-dark" onClick={onLogin}>Ingresar</button></div>}
    <div className="live-match-picker"><label>Partido<select value={match?.id ?? ""} onChange={(event) => onSelectMatch(event.target.value)}>{matches.map((item) => <option key={item.id} value={item.id}>{clubShort(item.local_id)} vs {clubShort(item.visitante_id)} · {badgeText(item.estado)}{item.fecha ? " · " + item.fecha : ""}</option>)}</select></label><span className="muted">Marcador conectado a Supabase Realtime</span></div>
    <section className="live-scoreboard"><div className="score-side"><ClubMark club={clubs.find((club) => club.id === match?.local_id)} /><div><span className="eyebrow gold-text">LOCAL · SERIE {clubs.find((club) => club.id === match?.local_id)?.serie ?? "—"}</span><h2>{clubName(match?.local_id)}</h2></div></div><div className="score-center"><div className="period">{isLive && <span className="live-dot" />} {periodLabel(match?.periodo)}</div><div className="score"><strong>{match?.goles_local ?? 0}</strong><span>{clock}</span><strong>{match?.goles_visitante ?? 0}</strong></div><span className="muted">{match ? badgeText(match.estado).toUpperCase() : "SIN PARTIDO ACTIVO"}</span></div><div className="score-side away"><div><span className="eyebrow gold-text">VISITANTE · SERIE {clubs.find((club) => club.id === match?.visitante_id)?.serie ?? "—"}</span><h2>{clubName(match?.visitante_id)}</h2></div><ClubMark club={clubs.find((club) => club.id === match?.visitante_id)} /></div></section>
    <div className="metrics-grid four"><Metric label="MINUTO OFICIAL" value={isLive ? String(minute) : "—"} suffix={isLive ? "′" : ""} note={isLive ? periodLabel(match?.periodo) : "El reloj se inicia desde el panel arbitral"} icon="◷" /><Metric label="ESTADO DEL PARTIDO" value={match ? badgeText(match.estado) : "Sin partido"} note={match?.fecha ?? "Selecciona un encuentro programado"} icon="◉" /><Metric label="JUGADORES CARGADOS" value={String(homeRoster.length + awayRoster.length)} note="Nóminas disponibles" icon="✓" /><Metric label="EVENTOS DEL ACTA" value={String(events.length)} note="Compartidos en tiempo real" icon="☷" /></div>
    {canWrite && <section className="panel tactical-panel"><div className="panel-heading"><div><p className="eyebrow">PANEL DEL OPERADOR</p><h2>Acciones rápidas del partido</h2></div><span className="muted">{match ? clubShort(match.local_id) + " vs " + clubShort(match.visitante_id) : "Sin encuentro"}</span></div>
      {!match && <div className="empty-state compact"><strong>Selecciona o programa un partido para activar el acta.</strong></div>}
      {match?.estado === "programado" && <div className="operator-start"><p>Al iniciar el encuentro, los pronósticos se cierran en el servidor y el reloj compartido comienza.</p><button className="btn btn-gold" type="button" disabled={actionBusy} onClick={() => submitAction("iniciar")}>{actionBusy ? "Guardando…" : "▶ Iniciar partido"}</button></div>}
      {isLive && <div className="incident-form">
        <label>Equipo<select value={clubId} onChange={(event) => { setClubId(event.target.value); setPlayerId(""); setPlayerOutId(""); setPlayerInId(""); }}><option value={match?.local_id}>{clubName(match?.local_id)} · Local</option><option value={match?.visitante_id}>{clubName(match?.visitante_id)} · Visitante</option></select></label>
        <label>Jugador<select value={playerId} onChange={(event) => setPlayerId(event.target.value)}><option value="">Sin jugador</option>{teamRoster.map((player) => <option key={player.id} value={player.id}>{player.dorsal} · {player.nombre}</option>)}</select></label>
        <label className="incident-detail">Detalle opcional<input value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={240} placeholder="Observación breve para el acta" /></label>
        {canRecordMatchEvent && <div className="incident-actions">{[["gol", "⚽", "Gol"], ["amarilla", "▰", "Amarilla"], ["roja", "▰", "Roja"]].map(([action, icon, label]) => <button className={"incident-button incident-" + action} key={action} type="button" disabled={actionBusy} onClick={() => submitAction(action)}><span>{icon}</span><strong>{label}</strong></button>)}
          <button className="incident-button incident-sustitucion" type="button" disabled={actionBusy} onClick={() => submitAction("sustitucion")}><span>↔</span><strong>Cambio</strong></button>
          <button className="incident-button" type="button" disabled={actionBusy || match.periodo !== "primer_tiempo"} onClick={() => submitAction("medio_tiempo")}><span>Ⅱ</span><strong>Medio tiempo</strong></button>
          <button className="incident-button" type="button" disabled={actionBusy || match.periodo !== "medio_tiempo"} onClick={() => submitAction("inicio_segundo_tiempo")}><span>▶</span><strong>Iniciar 2T</strong></button>
          <button className="incident-button incident-roja" type="button" disabled={actionBusy} onClick={() => submitAction("final")}><span>■</span><strong>Final</strong></button>
        </div>}
        {canRecordMatchEvent && <div className="substitution-fields"><label>Sale<select value={playerOutId} onChange={(event) => setPlayerOutId(event.target.value)}><option value="">Seleccionar jugador</option>{teamRoster.map((player) => <option key={player.id} value={player.id}>{player.dorsal} · {player.nombre}</option>)}</select></label><label>Entra<select value={playerInId} onChange={(event) => setPlayerInId(event.target.value)}><option value="">Seleccionar jugador</option>{teamRoster.map((player) => <option key={player.id} value={player.id}>{player.dorsal} · {player.nombre}</option>)}</select></label><span className="muted">El cambio registra a ambos jugadores en el acta.</span></div>}
      </div>}
      {match?.estado === "finalizado" && <div className="operator-start"><strong>Partido finalizado.</strong><span className="muted">Los pronósticos fueron liquidados automáticamente al cerrar el acta.</span></div>}
    </section>}
    <div className="live-columns"><section className="panel timeline-panel"><div className="panel-heading"><div><p className="eyebrow">CRONOLOGÍA MINUTO A MINUTO</p><h2>Línea de tiempo reglamentaria</h2></div><span className="pill pill-live">{events.length} eventos</span></div>{events.length ? <div className="timeline">{events.map((event) => <article className="timeline-item" key={event.id}><span className="timeline-minute">{event.minuto}′</span><div><strong>{event.tipo.replaceAll("_", " ").toUpperCase()}{event.club_id ? " · " + clubShort(event.club_id) : ""}</strong><p>{event.detalle || "Incidencia registrada en el partido."}</p></div></article>)}</div> : <div className="empty-state"><span>◷</span><strong>Aún no hay incidencias</strong><p>Las acciones registradas aparecerán aquí para todos los espectadores.</p></div>}</section><aside className="panel roster-live"><div className="panel-heading"><div><p className="eyebrow">PARTIDO ACTIVO</p><h2>Alineación</h2></div><span className="pill">{homeRoster.length + awayRoster.length} jugadores</span></div>{[...homeRoster.slice(0, 5), ...awayRoster.slice(0, 5)].length ? [...homeRoster.slice(0, 5), ...awayRoster.slice(0, 5)].map((player) => <div className="roster-mini" key={player.id}><span className="jersey">{player.dorsal}</span><strong>{player.nombre}</strong><span className="state-ok">{player.estado_comet}</span></div>) : <div className="empty-state"><p>La alineación aparecerá cuando se carguen las plantillas.</p></div>}<div className="official-integrity"><strong>Integridad del acta</strong><span><i /> Eventos autorizados por Supabase RLS</span></div></aside></div>
  </>;
}

function DisciplinePanel({ clubs, players, sanctions, search, setSearch, canWrite, onLogin, onCreateSanction }: { clubs: Club[]; players: Player[]; sanctions: Sanction[]; search: string; setSearch: (value: string) => void; canWrite: boolean; onLogin: () => void; onCreateSanction: (event: FormEvent<HTMLFormElement>) => void }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Todos los estados");
  const displayedSanctions = statusFilter === "Todos los estados" ? sanctions : sanctions.filter((item) => item.estado.toLowerCase() === statusFilter.toLowerCase());
  const pending = sanctions.filter((row) => row.estado.toLowerCase().includes("pendiente") || row.estado.toLowerCase().includes("notificada")).length;
  return <>
    <PageHeading eyebrow="PAN-005 · COMISIÓN DISCIPLINARIA" title="Control disciplinario y sanciones" subtitle="Consulta las resoluciones vigentes y documenta las medidas disciplinarias de la competencia."><button className="btn btn-light" onClick={() => setCreateOpen(!createOpen)}>＋ Nueva resolución</button><button className="btn btn-dark" onClick={() => canWrite ? setCreateOpen(true) : onLogin()}>⚖ Emitir sanción</button></PageHeading>
    {!canWrite && <div className="permission-banner"><span>⚖</span><div><strong>Libro disciplinario de consulta</strong><p>La emisión y edición de sanciones requiere un perfil de la Comisión Disciplinaria o administrador.</p></div><button className="btn btn-dark" onClick={onLogin}>Ingresar</button></div>}
    {createOpen && <section className="panel form-panel"><div className="panel-heading"><h2>Registrar resolución</h2><button className="icon-close" onClick={() => setCreateOpen(false)}>×</button></div><form className="inline-form" onSubmit={onCreateSanction}><label>Jugador<select name="jugador_id" required><option value="">Selecciona un jugador cargado</option>{players.map((player) => <option value={player.id} key={player.id}>{player.nombre} · {clubs.find((club) => club.id === player.club_id)?.sigla}</option>)}</select></label><label>Infracción<input name="infraccion" required placeholder="Descripción de la resolución" /></label><label>Fechas de suspensión<input name="jornadas" type="number" min="0" max="30" defaultValue="1" required /></label><button className="btn btn-gold">Guardar resolución</button></form></section>}
    <section className="metrics-grid four"><Metric label="RESOLUCIONES MOSTRADAS" value={`${sanctions.length}`} note="Libro de sanciones" icon="▤" /><Metric label="PENDIENTES / NOTIFICADAS" value={`${pending}`} note="Seguimiento requerido" icon="◷" /><Metric label="JUGADORES REGISTRADOS" value={`${players.length}`} note="En la base de datos" icon="♟" /><Metric label="ESTADO DISCIPLINARIO" value="En línea" note="Resoluciones consultables" icon="⚖" /></section>
    <div className="discipline-cards"><section className="panel risk-panel"><div className="panel-heading"><div><p className="eyebrow">SEGUIMIENTO</p><h2>Resoluciones recientes</h2></div><span className="pill pill-warn">{pending} pendientes</span></div><p className="muted">Una tarjeta roja o una segunda amarilla crea una sanción automática de una jornada.</p><div className="risk-note"><span>ⓘ</span><p>La sanción automática se activa en la siguiente jornada y la base de datos bloquea al jugador en la planilla.</p></div></section><section className="panel decision-card"><p className="eyebrow gold-text">ACTA DISCIPLINARIA</p><h2>Emisión y notificación</h2><p>Registra el motivo, la cantidad de fechas y el estado de notificación asociado a cada resolución.</p><button className="btn btn-gold" onClick={() => canWrite ? setCreateOpen(true) : onLogin()}>Abrir formulario</button></section></div>
    <section className="panel discipline-ledger"><div className="panel-heading"><div><p className="eyebrow">CONTROL DISCIPLINARIO</p><h2>Libro de sanciones</h2></div><span className="pill">{displayedSanctions.length} resoluciones</span></div><div className="ledger-tools"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="⌕ Buscar jugador, acta o club…" /><select aria-label="Filtrar estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todos los estados</option><option>Pendiente</option><option>Notificada</option><option>Cumplida</option></select><button className="btn btn-light" onClick={() => { setSearch(""); setStatusFilter("Todos los estados"); }}>Limpiar filtros</button></div><div className="table-scroll"><table className="data-table"><thead><tr><th>ACTA / FECHA</th><th>CLUB</th><th>JUGADOR</th><th>INFRACCIÓN</th><th>SANCIÓN</th><th>ESTADO</th></tr></thead><tbody>{displayedSanctions.map((row) => <tr key={row.id}><td><strong>#{row.id}</strong><small>{row.fecha ? new Date(row.fecha).toLocaleDateString("es-EC") : "Sin fecha registrada"}</small></td><td>{row.club}</td><td><strong>{row.jugador}</strong></td><td className="infraction-cell">{row.infraccion}</td><td><span className="pill pill-red">{row.jornadas} {row.jornadas === 1 ? "fecha" : "fechas"}</span></td><td><span className={`pill ${row.estado === "Cumplida" ? "pill-green" : "pill-warn"}`}>{row.estado}</span></td></tr>)}</tbody></table>{displayedSanctions.length === 0 && <div className="empty-state">No hay resoluciones que coincidan con la búsqueda.</div>}</div></section>
  </>;
}

function PublicTablePage({ clubs, standings, competition, clubName, onView }: { clubs: Club[]; standings: Standing[]; competition: Competition | null; clubName: (id?: string) => string; onView: (view: View) => void }) {
  const colorFor = (id?: string) => clubs.find((club) => club.id === id)?.color;
  const season = competition?.temporada ?? new Date().getFullYear();
  return <>
    <PageHeading eyebrow="PORTAL PÚBLICO" title="Tabla de posiciones" subtitle="Clasificación calculada con resultados registrados en Supabase."><button className="btn btn-light" onClick={() => onView("calendario")}>Ver calendario →</button></PageHeading>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">SERIE {competition?.serie ?? "—"} · TEMPORADA {season}</p><h2>{competition?.nombre ?? "Competencia"}</h2><p className="muted">PJ, resultados, goles, puntos y forma de las últimas cinco jornadas.</p></div><span className="pill pill-gold">AUTOMÁTICA</span></div>{standings.length ? <div className="table-scroll"><table className="data-table standings-table expanded-table"><thead><tr><th>Pos.</th><th>Club</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th><th>Últimos 5</th></tr></thead><tbody>{standings.map((row, index) => <tr key={row.club_id ?? index}><td>{index + 1}</td><td><span className="club-cell"><span className="club-mark compact" style={{ "--club-color": colorFor(row.club_id) ?? "#cbd1da" } as React.CSSProperties}>{row.sigla ?? "LP"}</span><strong>{row.club ?? clubName(row.club_id)}</strong></span></td><td>{row.pj}</td><td>{row.pg}</td><td>{row.pe}</td><td>{row.pp}</td><td>{row.gf}</td><td>{row.gc}</td><td>{row.dg > 0 ? `+${row.dg}` : row.dg}</td><td><strong>{row.pts}</strong></td><td><span className="form-dots">{row.ultimas_5?.length ? row.ultimas_5.map((form, formIndex) => <i key={`${row.club_id}-${formIndex}`} className={`form-result ${form.toLowerCase()}`}>{form}</i>) : "—"}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>No hay posiciones disponibles</strong><p>La tabla se llenará al cerrar partidos de esta temporada.</p></div>}</section>
  </>;
}
function CalendarPage({ clubs, matches, competition, clubName, onSelectMatch, onView }: { clubs: Club[]; matches: Match[]; competition: Competition | null; clubName: (id?: string) => string; onSelectMatch: (matchId: string) => void; onView: (view: View) => void }) {
  const rounds = [...new Set(matches.map((match) => match.jornada))].sort((a, b) => a - b);
  const [selectedRound, setSelectedRound] = useState(0);
  const currentRound = rounds.includes(selectedRound) ? selectedRound : rounds[rounds.length - 1] ?? 0;
  const roundIndex = rounds.indexOf(currentRound);
  const roundMatches = matches.filter((match) => match.jornada === currentRound);
  return <>
    <PageHeading eyebrow="PAN-007 · PORTAL PÚBLICO" title="Calendario de competencia" subtitle="Partidos, jornadas, estadios y horarios cargados desde Supabase."><button className="btn btn-light" onClick={() => onView("tabla")}>Ver posiciones →</button></PageHeading>
    <section className="calendar-heading panel"><div><p className="eyebrow">SERIE {competition?.serie ?? "—"} · TEMPORADA {competition?.temporada ?? new Date().getFullYear()}</p><h2>{currentRound ? `Jornada ${currentRound}` : "Sin jornadas"}</h2><p className="muted">Hora de Ecuador · UTC−5</p></div><div className="calendar-switch"><button disabled={roundIndex <= 0} onClick={() => setSelectedRound(rounds[Math.max(0, roundIndex - 1)])}>‹ Anterior</button><strong>{currentRound ? `${roundIndex + 1} / ${rounds.length}` : "—"}</strong><button disabled={roundIndex < 0 || roundIndex >= rounds.length - 1} onClick={() => setSelectedRound(rounds[Math.min(rounds.length - 1, roundIndex + 1)])}>Siguiente ›</button></div></section>
    {roundMatches.length ? <section className="calendar-list">{roundMatches.map((match) => <button className="calendar-match panel" key={match.id} onClick={() => { onSelectMatch(match.id); onView("partido"); }}><div className="calendar-when"><span className={match.estado === "en_vivo" ? "pill pill-red" : "pill pill-gold"}>{match.fecha ?? "Fecha por confirmar"}</span><span>J{match.jornada}</span></div><div className="calendar-clubs"><span>{clubs.find((club) => club.id === match.local_id)?.sigla ?? "LP"} · {clubName(match.local_id)}</span><strong>{match.estado === "programado" ? "—" : `${match.goles_local} : ${match.goles_visitante}`}</strong><span>{clubs.find((club) => club.id === match.visitante_id)?.sigla ?? "LP"} · {clubName(match.visitante_id)}</span></div><div className="calendar-place">▦ {match.estadio ?? "Estadio pendiente"}<span>{badgeText(match.estado)}</span></div></button>)}</section> : <section className="panel empty-state"><strong>No hay partidos en esta jornada</strong><p>El calendario se actualizará al registrar encuentros en Supabase.</p></section>}
  </>;
}

function MatchDetailPage({ clubs, match, competition, events, canOperateLive, clubName, onView }: { clubs: Club[]; match?: Match; competition: Competition | null; events: EventRow[]; canOperateLive: boolean; clubName: (id?: string) => string; onView: (view: View) => void }) {
  const timeline = [...events].sort((a, b) => a.minuto - b.minuto);
  const clock = String(Math.floor(elapsedMatchSeconds(match) / 60)).padStart(2, "0") + ":" + String(elapsedMatchSeconds(match) % 60).padStart(2, "0");
  const home = clubs.find((club) => club.id === match?.local_id);
  const away = clubs.find((club) => club.id === match?.visitante_id);
  return <>
    <PageHeading eyebrow="PAN-008 · DETALLE DE PARTIDO" title="Ficha del encuentro" subtitle="Marcador, cronología y datos del partido registrados en Supabase."><button className="btn btn-light" onClick={() => onView("calendario")}>← Volver al calendario</button>{canOperateLive && <button className="btn btn-dark" onClick={() => onView("vivo")}>Abrir consola</button>}</PageHeading>
    {match ? <><section className="match-detail-score panel"><div className="match-detail-phase"><span className="pill pill-gold">SERIE {competition?.serie ?? "—"} · TEMPORADA {competition?.temporada ?? "—"}</span><span className="pill">JORNADA {match.jornada}</span><span className={match.estado === "en_vivo" ? "pill pill-live" : "pill"}>{badgeText(match.estado)}</span></div><div className="detail-scoreline"><div><span className="club-mark" style={{ "--club-color": home?.color } as React.CSSProperties}>{home?.sigla}</span><h2>{clubName(match.local_id)}</h2><small>LOCAL</small></div><strong>{match.goles_local}<i>:</i>{match.goles_visitante}{match.estado === "en_vivo" && <small className="detail-live-clock">{clock} · {periodLabel(match.periodo, true)}</small>}</strong><div><span className="club-mark" style={{ "--club-color": away?.color } as React.CSSProperties}>{away?.sigla}</span><h2>{clubName(match.visitante_id)}</h2><small>VISITANTE</small></div></div><div className="detail-meta"><span>◷ {match.fecha ?? "Fecha por confirmar"}</span><span>▦ {match.estadio ?? "Estadio pendiente"}</span><span>{match.fase ?? "Fase sin asignar"}</span></div></section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">CRONOLOGÍA DEL PARTIDO</p><h2>Eventos registrados</h2></div><span className="pill">{timeline.length} eventos</span></div>{timeline.length ? <div className="timeline detailed-timeline">{timeline.map((event) => <article className="timeline-item" key={event.id}><span className="timeline-minute">{event.minuto}′</span><div><strong>{event.tipo.replaceAll("_", " ").toUpperCase()}{event.club_id ? ` · ${clubName(event.club_id)}` : ""}</strong><p>{event.jugador ? `${event.jugador} · ` : ""}{event.detalle || "Evento registrado"}</p></div></article>)}</div> : <div className="empty-state"><span>◷</span><strong>No hay eventos publicados</strong><p>La cronología aparecerá cuando se registren incidencias del encuentro.</p></div>}</section></> : <section className="panel empty-state"><strong>No hay un partido seleccionado</strong><p>Selecciona un encuentro desde el calendario para ver su detalle.</p><button className="btn btn-dark" onClick={() => onView("calendario")}>Abrir calendario</button></section>}
  </>;
}
function ClubDirectoryPage({ clubs, onView }: { clubs: Club[]; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-009 · PORTAL PÚBLICO" title="Clubes participantes" subtitle="Directorio de clubes afiliados a la competencia."><span className="pill pill-gold">{clubs.length} clubes</span></PageHeading><div className="club-directory">{clubs.map((club) => <button className="club-directory-card panel" key={club.id} onClick={() => onView("club")}><span className="club-mark" style={{ "--club-color": club.color } as React.CSSProperties}>{club.sigla}</span><div><h2>{club.nombre}</h2><p>{club.estadio ?? "Estadio por registrar"}</p></div><span className="pill">SERIE {club.serie ?? "—"}</span><b>→</b></button>)}</div></>;
}

function ClubProfilePage({ clubs, matches, clubName, onView }: { clubs: Club[]; matches: Match[]; clubName: (id?: string) => string; onView: (view: View) => void }) {
  const [clubId, setClubId] = useState(clubs[0]?.id ?? "");
  const club = clubs.find((item) => item.id === clubId);
  const calendar = matches.filter((match) => (match.local_id === club?.id || match.visitante_id === club?.id) && match.estado !== "finalizado");
  return <><PageHeading eyebrow="PAN-010 · FICHA DE CLUB" title="Perfil del club" subtitle="Consulta la información disponible en el catálogo de Supabase."><label className="select-inline">Seleccionar club<select value={club?.id ?? ""} onChange={(event) => setClubId(event.target.value)}>{clubs.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><button className="btn btn-light" onClick={() => onView("clubes")}>← Directorio</button></PageHeading>{club ? <><section className="club-profile-hero panel"><ClubMark club={club}/><div><span className="eyebrow">SERIE {club.serie ?? "—"}</span><h2>{club.nombre}</h2><p>{club.estadio ?? "Estadio sin registrar"}</p></div><span className={`pill ${club.activo ? "pill-green" : "pill-warn"}`}>{club.activo ? "Activo" : "Inactivo"}</span></section><div className="metrics-grid four"><Metric label="PARTIDOS EN CALENDARIO" value={`${calendar.length}`} note="Encuentros no finalizados" icon="◷"/><Metric label="SERIE" value={club.serie ?? "—"} note="Dato del catálogo" icon="♜"/><Metric label="ESTADIO" value={club.estadio ? "Registrado" : "Sin dato"} note={club.estadio ?? "Agrega el estadio al registro"} icon="▦"/><Metric label="ESTADO DEL CLUB" value={club.activo ? "Activo" : "Inactivo"} note="Dato del catálogo Supabase" icon="✓"/></div><section className="panel"><div className="panel-heading"><h2>Próximos encuentros</h2><span className="pill">{calendar.length}</span></div>{calendar.length ? calendar.map((match) => <div className="fixture-item profile-fixture" key={match.id}><div><strong>{clubName(match.local_id)} vs {clubName(match.visitante_id)}</strong><p>{match.fecha ?? "Fecha pendiente"} · {match.estadio ?? "Sede pendiente"}</p></div><span className="pill">{badgeText(match.estado)}</span></div>) : <div className="empty-state">No hay partidos pendientes para este club en la competencia seleccionada.</div>}</section></> : <section className="panel empty-state"><strong>No hay clubes disponibles</strong><p>Registra clubes en Supabase para ver sus fichas.</p></section>}</>;
}

function StatisticsPage({ clubs, standings, onView }: { clubs: Club[]; standings: Standing[]; onView: (view: View) => void }) {
  const top = [...standings].sort((a, b) => b.gf - a.gf).slice(0, 5);
  return <><PageHeading eyebrow="PAN-011 · ESTADÍSTICAS" title="Estadísticas de competencia" subtitle="Resumen estadístico calculado con los partidos y resultados registrados."><button className="btn btn-light" onClick={() => onView("tabla")}>Ver tabla →</button></PageHeading><div className="metrics-grid four"><Metric label="CLUBES" value={`${clubs.length}`} note="En la clasificación" icon="♜" /><Metric label="GOLES REGISTRADOS" value={`${standings.reduce((sum, row) => sum + row.gf, 0)}`} note="Datos de la fase" icon="⚽" /><Metric label="PARTIDOS JUGADOS" value={`${standings.reduce((sum, row) => sum + row.pj, 0) / 2}`} note="Suma de apariciones / 2" icon="◷" /><Metric label="LÍDER EN GOLES" value={top[0]?.club ?? "—"} note={`${top[0]?.gf ?? 0} goles anotados`} icon="↗" /></div><section className="panel"><div className="panel-heading"><div><p className="eyebrow">ATAQUE</p><h2>Goles a favor por club</h2></div><span className="pill">Top 5</span></div><div className="bar-chart">{top.map((row, index) => <div className="bar-row" key={row.club_id ?? index}><strong>{row.club ?? clubs.find((c) => c.id === row.club_id)?.nombre}</strong><div><i style={{ width: `${Math.max(8, row.gf / (top[0]?.gf || 1) * 100)}%` }} /></div><b>{row.gf}</b></div>)}</div></section></>;
}

function CompetitionListPage({ competitions, onView }: { competitions: Competition[]; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-013 · TEMPORADAS" title="Temporadas y competencias" subtitle="Competencias leídas desde Supabase."><button className="btn btn-gold" onClick={() => onView("competencia")}>＋ Nueva competencia</button></PageHeading><section className="panel"><div className="panel-heading"><div><p className="eyebrow">REGISTRO DE COMPETENCIAS</p><h2>Temporadas configuradas</h2></div><span className="pill">{competitions.length} registros</span></div>{competitions.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>COMPETENCIA</th><th>TEMPORADA</th><th>SERIE</th><th>FORMATO</th><th>ESTADO</th></tr></thead><tbody>{competitions.map((item) => <tr key={item.id}><td><strong>{item.nombre}</strong></td><td>{item.temporada}</td><td>Serie {item.serie}</td><td>{item.formato ?? "—"}</td><td><span className="pill pill-gold">{item.estado}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>No hay competencias registradas</strong><p>Crea una competencia para configurar sus fases y partidos.</p></div>}</section></>;
}

function CompetitionFormPage({ onCreate, canWrite, onLogin }: { onCreate: (event: FormEvent<HTMLFormElement>) => void; canWrite: boolean; onLogin: () => void }) {
  return <><PageHeading eyebrow="PAN-014 · REGISTRO DE COMPETENCIA" title="Crear competencia" subtitle="Guarda temporada, serie y formato en Supabase."><span className="pill pill-gold">Solo administradores</span></PageHeading><section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">NUEVA TEMPORADA</p><h2>Datos de competencia</h2></div><span className="pill">Se guarda en Supabase</span></div><form className="screen-form" onSubmit={onCreate}><label>Nombre<input name="nombre" required maxLength={120} placeholder="Competencia Serie A" /></label><label>Temporada<input name="temporada" type="number" min="2000" max="2200" required defaultValue={new Date().getFullYear()} /></label><label>Serie<select name="serie" defaultValue="A"><option value="A">Serie A</option><option value="B">Serie B</option></select></label><label>Formato<select name="formato" defaultValue="fase_clasificatoria"><option value="fase_clasificatoria">Fase clasificatoria</option><option value="todos_contra_todos">Todos contra todos</option><option value="grupos_y_final">Grupos y final</option></select></label><label>Estado inicial<select name="estado" defaultValue="activa"><option value="borrador">Borrador privado</option><option value="activa">Activa y pública</option></select></label><div className="form-actions"><span className="muted">Los partidos se vinculan a la competencia activa.</span>{canWrite ? <button className="btn btn-gold">Guardar competencia</button> : <button type="button" className="btn btn-dark" onClick={onLogin}>Ingresar</button>}</div></form></section></>;
}

function PhasesPage({ competition, phases, canWrite, onLogin, onCreate, onView }: { competition: Competition | null; phases: Phase[]; canWrite: boolean; onLogin: () => void; onCreate: (event: FormEvent<HTMLFormElement>) => void; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-015 · ESTRUCTURA DE COMPETENCIA" title="Fases y jornadas" subtitle={`Fases guardadas para ${competition?.nombre ?? "la competencia seleccionada"}.`}><button className="btn btn-dark" onClick={() => onView("programacion")}>Programar partido →</button></PageHeading>{canWrite ? <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">NUEVA FASE</p><h2>Configurar jornadas</h2></div></div><form className="screen-form" onSubmit={onCreate}><label>Nombre<input name="nombre" required maxLength={100} placeholder="Fase de grupos" /></label><label>Orden<input name="orden" type="number" min="1" max="50" required defaultValue={phases.length + 1} /></label><label>Número de jornadas<input name="jornadas" type="number" min="1" max="60" placeholder="Opcional" /></label><label>Estado<select name="estado" defaultValue="activa"><option value="borrador">Borrador</option><option value="activa">Activa</option><option value="cerrada">Cerrada</option></select></label><div className="form-actions"><span className="muted">Se asociará a {competition?.nombre ?? "la competencia activa"}.</span><button className="btn btn-gold" disabled={!competition}>Guardar fase</button></div></form></section> : <div className="permission-banner"><span>▦</span><div><strong>Consulta de fases</strong><p>Solo una cuenta administradora puede configurar las jornadas.</p></div><button className="btn btn-dark" onClick={onLogin}>Ingresar</button></div>}{phases.length ? <div className="phase-card-grid">{phases.map((phase) => <article className="panel phase-card" key={phase.id}><span className="phase-number">{String(phase.orden).padStart(2, "0")}</span><span className={`pill ${phase.estado === "activa" ? "pill-green" : "pill-gold"}`}>{phase.estado}</span><p className="eyebrow">FASE {phase.orden}</p><h2>{phase.nombre}</h2><p className="muted">{phase.jornadas ?? "Jornadas sin definir"} jornadas</p><button className="text-link" onClick={() => onView("programacion")}>Ver programación →</button></article>)}</div> : <section className="panel empty-state"><strong>No hay fases configuradas</strong><p>Agrega la estructura de fases y jornadas para esta competencia.</p></section>}</>;
}
function ClubManagementPage({ clubs, canWrite, onLogin, onCreate, onView }: { clubs: Club[]; canWrite: boolean; onLogin: () => void; onCreate: (event: FormEvent<HTMLFormElement>) => void; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-016 · CLUBES" title="Registro de clubes" subtitle="Consulta y registra clubes en el catálogo conectado a Supabase."><span className="pill">{clubs.length} registrados</span></PageHeading>{canWrite ? <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">NUEVO REGISTRO</p><h2>Agregar club</h2></div></div><form className="screen-form" onSubmit={onCreate}><label>Nombre<input name="nombre" required maxLength={120} placeholder="Nombre del club" /></label><label>Sigla<input name="sigla" required maxLength={8} placeholder="ABC" /></label><label>Serie<select name="serie" defaultValue="A"><option value="A">Serie A</option><option value="B">Serie B</option></select></label><label>Estadio<input name="estadio" maxLength={120} placeholder="Sede principal" /></label><label>Color de identificación<input name="color" type="color" defaultValue="#19345b" /></label><div className="form-actions"><span className="muted">La sigla debe ser única.</span><button className="btn btn-gold">Guardar club</button></div></form></section> : <div className="permission-banner"><span>♜</span><div><strong>Catálogo de solo lectura</strong><p>Ingresa con rol administrador para agregar clubes.</p></div><button className="btn btn-dark" onClick={onLogin}>Ingresar</button></div>}<section className="panel"><div className="panel-heading"><div><p className="eyebrow">SERIE / DIVISIÓN</p><h2>Clubes registrados</h2></div><button className="btn btn-light" onClick={() => onView("clubAdmin")}>Detalle →</button></div>{clubs.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>CLUB</th><th>SIGLA</th><th>ESTADIO</th><th>SERIE</th><th>ESTADO</th></tr></thead><tbody>{clubs.map((club) => <tr key={club.id}><td><span className="club-cell"><ClubMark club={club} compact/><strong>{club.nombre}</strong></span></td><td>{club.sigla}</td><td>{club.estadio ?? "Sin registrar"}</td><td>{club.serie ? `Serie ${club.serie}` : "Sin serie"}</td><td><span className={club.activo ? "pill pill-green" : "pill pill-warn"}>{club.activo ? "Activo" : "Inactivo"}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>No hay clubes registrados</strong><p>Agrega clubes para asociarlos a competencias y partidos.</p></div>}</section></>;
}

function UserManagementPage({ users, onSetRole, onView }: { users: ManagedUser[]; onSetRole: (userId: string, nextRole: Role) => void; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-026 · CUENTAS Y PERMISOS" title="Usuarios y roles" subtitle="Asigna a cada cuenta el permiso que habilita sus módulos."><button className="btn btn-light" onClick={() => onView("designaciones")}>Designar oficiales →</button></PageHeading><section className="risk-note"><span>ⓘ</span><p>Las cuentas nuevas empiezan como aficionado. Los cambios se validan en Supabase y se activan para esa persona al iniciar sesión de nuevo.</p></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">PERFILES REGISTRADOS</p><h2>Administración de accesos</h2></div><span className="pill">{users.length} cuentas</span></div>{users.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>USUARIO</th><th>ID DE PERFIL</th><th>ROL ACTUAL</th><th>CAMBIAR ROL</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.nombre || user.apodo || "Sin nombre"}</strong></td><td><code>{user.id.slice(0, 8)}…</code></td><td>{roleLabels[user.rol_app]}</td><td><select value={user.rol_app} onChange={(event) => onSetRole(user.id, event.target.value as Role)} aria-label={`Cambiar rol de ${user.nombre || user.id}`}><option value="aficionado">Aficionado</option><option value="operador">Operador</option><option value="arbitro">Árbitro</option><option value="administrador">Administrador</option></select></td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>No se pudieron leer perfiles</strong><p>Comprueba que esta cuenta sea administradora y que la migración de roles esté aplicada.</p></div>}</section></>;
}

function AdminClubDetailPage({ clubs, onView }: { clubs: Club[]; onView: (view: View) => void }) {
  const [clubId, setClubId] = useState(clubs[0]?.id ?? "");
  const club = clubs.find((item) => item.id === clubId);
  return <><PageHeading eyebrow="PAN-017 · DETALLE DE CLUB" title="Ficha administrativa" subtitle="Datos guardados del catálogo de clubes."><label className="select-inline">Seleccionar club<select value={club?.id ?? ""} onChange={(event) => setClubId(event.target.value)}>{clubs.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><button className="btn btn-light" onClick={() => onView("clubesAdmin")}>← Clubes</button></PageHeading>{club ? <section className="club-profile-hero panel"><ClubMark club={club}/><div><span className="eyebrow">SERIE {club.serie ?? "—"} · {club.sigla}</span><h2>{club.nombre}</h2><p>{club.estadio ?? "Estadio sin registrar"}</p></div><span className={`pill ${club.activo ? "pill-green" : "pill-warn"}`}>{club.activo ? "Activo" : "Inactivo"}</span></section> : <section className="panel empty-state"><strong>No hay clubes registrados</strong><p>Agrega un club desde el catálogo administrativo.</p></section>}</>;
}

function FixtureManagementPage({ clubs, phases, matches, clubName, onCreate, canWrite, onLogin }: { clubs: Club[]; phases: Phase[]; matches: Match[]; clubName: (id?: string) => string; onCreate: (event: FormEvent<HTMLFormElement>) => void; canWrite: boolean; onLogin: () => void }) {
  return <><PageHeading eyebrow="PAN-018 · CALENDARIO ADMINISTRATIVO" title="Programación de partidos" subtitle="Crea encuentros y administra la fecha, sede y jornada asignadas."><button className="btn btn-gold" onClick={() => canWrite ? document.getElementById("fixture-form")?.scrollIntoView({ behavior: "smooth" }) : onLogin()}>＋ Programar partido</button></PageHeading><section className="panel form-panel" id="fixture-form"><div className="panel-heading"><h2>Nuevo encuentro</h2><span className="pill">Datos obligatorios</span></div><form className="screen-form" onSubmit={onCreate}><label>Club local<select name="local">{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label><label>Club visitante<select name="visitante">{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label><label>Fase<select name="fase"><option value="">Sin fase</option>{phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.nombre}</option>)}</select></label><label>Jornada<input name="jornada" type="number" min="1" defaultValue="1"/></label><label>Fecha y hora<input name="fecha" type="datetime-local" required/></label><label>Estadio<input name="estadio" placeholder="Estadio principal"/></label><div className="form-actions"><span className="muted">Se guardará en la competencia activa.</span>{canWrite ? <button className="btn btn-gold">Guardar programación</button> : <button type="button" className="btn btn-dark" onClick={onLogin}>Ingresar</button>}</div></form></section><section className="panel"><div className="panel-heading"><h2>Calendario de la jornada</h2><span className="pill">{matches.length} partidos</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>JORNADA</th><th>FECHA</th><th>LOCAL</th><th>VISITANTE</th><th>ESTADIO</th><th>ESTADO</th></tr></thead><tbody>{matches.map((match) => <tr key={match.id}><td>J{match.jornada}</td><td>{match.fecha ?? "Por programar"}</td><td>{clubName(match.local_id)}</td><td>{clubName(match.visitante_id)}</td><td>{match.estadio}</td><td><span className="pill">{badgeText(match.estado)}</span></td></tr>)}</tbody></table></div></section></>;
}

function DesignationPage({ matches, users, clubName, canWrite, onLogin, onAssign }: { matches: Match[]; users: ManagedUser[]; clubName: (id?: string) => string; canWrite: boolean; onLogin: () => void; onAssign: (matchId: string, field: "arbitro_id" | "comisario_id", userId: string) => void }) {
  const referees = users.filter((user) => user.rol_app === "arbitro");
  const operators = users.filter((user) => user.rol_app === "operador");
  return <><PageHeading eyebrow="PAN-019 · DESIGNACIONES" title="Designaciones de partido" subtitle="Selecciona cuentas existentes para asignar árbitro y operador."><span className="pill">{matches.length} partidos</span></PageHeading>{!canWrite && <div className="permission-banner"><span>⚖</span><div><strong>Consulta de designaciones</strong><p>Solo una cuenta administradora puede asignar oficiales.</p></div><button className="btn btn-dark" onClick={onLogin}>Ingresar</button></div>}<section className="panel"><div className="panel-heading"><div><p className="eyebrow">COMPETENCIA ACTIVA</p><h2>Partidos y oficiales</h2></div><span className="pill pill-gold">CUENTAS REGISTRADAS</span></div>{matches.length ? matches.map((match) => <div className="designation-row" key={match.id}><div><strong>{clubName(match.local_id)} vs {clubName(match.visitante_id)}</strong><small>Jornada {match.jornada} · {match.fecha ?? "Fecha por asignar"} · {match.estadio ?? "Sede pendiente"}</small></div><label className="designation-select">Árbitro<select disabled={!canWrite || !referees.length} value={match.arbitro_id ?? ""} onChange={(event) => onAssign(match.id, "arbitro_id", event.target.value)}><option value="">Sin asignar</option>{referees.map((user) => <option key={user.id} value={user.id}>{user.nombre || user.apodo || user.id.slice(0, 8)}</option>)}</select></label><label className="designation-select">Operador<select disabled={!canWrite || !operators.length} value={match.comisario_id ?? ""} onChange={(event) => onAssign(match.id, "comisario_id", event.target.value)}><option value="">Sin asignar</option>{operators.map((user) => <option key={user.id} value={user.id}>{user.nombre || user.apodo || user.id.slice(0, 8)}</option>)}</select></label></div>) : <div className="empty-state"><strong>No hay partidos en la competencia activa</strong><p>Programa partidos para habilitar las designaciones.</p></div>}</section>{canWrite && (!referees.length || !operators.length) && <div className="risk-note"><span>ⓘ</span><p>{!referees.length ? "Registra primero una cuenta y asígnale el rol árbitro." : "Registra primero una cuenta y asígnale el rol operador."} Luego aparecerá en estas listas.</p></div>}</>;
}

function LineupSelectorPage({ matches, clubName, onSelectMatch, onView }: { matches: Match[]; clubName: (id?: string) => string; onSelectMatch: (matchId: string) => void; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-020 · SELECCIÓN DE PARTIDO" title="Planillas pendientes de validar" subtitle="Elige un encuentro para revisar sus nóminas y estado COMET."><span className="pill pill-gold">COMET · CONSULTA</span></PageHeading>{matches.length ? <div className="selection-list">{matches.map((match) => <article className="panel selection-card" key={match.id}><div><span className="eyebrow">JORNADA {match.jornada} · {match.fase ?? "Fase sin asignar"}</span><h2>{clubName(match.local_id)} <small>vs</small> {clubName(match.visitante_id)}</h2><p>{match.fecha ?? "Fecha por confirmar"} · {match.estadio ?? "Estadio pendiente"}</p></div><span className={`pill ${match.estado === "en_vivo" ? "pill-live" : "pill-warn"}`}>{match.estado === "finalizado" ? "Acta cerrada" : "Pendiente de revisión"}</span><button className="btn btn-dark" onClick={() => { onSelectMatch(match.id); onView("planilla"); }}>Revisar planilla →</button></article>)}</div> : <section className="panel empty-state"><strong>No hay partidos para revisar</strong><p>Los encuentros de la competencia aparecerán aquí cuando se programen.</p></section>}</>;
}

function PlayerEligibilityPage({ clubs, players, onView }: { clubs: Club[]; players: Player[]; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-021 · REGISTRO COMET" title="Elegibilidad de jugadores" subtitle="Revisa la habilitación federativa antes de validar cada nómina."><button className="btn btn-light" onClick={() => onView("planillas")}>← Partidos</button><span className="pill">{players.length} jugadores</span></PageHeading><section className="panel"><div className="panel-heading"><div><p className="eyebrow">ESTADO COMET</p><h2>Registro de jugadores</h2></div><span className="pill pill-warn">Validación requerida</span></div>{players.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>DORSAL</th><th>JUGADOR</th><th>CLUB</th><th>POSICIÓN</th><th>COMET</th></tr></thead><tbody>{players.map((player) => <tr key={player.id}><td>{player.dorsal}</td><td><strong>{player.nombre}</strong></td><td>{clubs.find((club) => club.id === player.club_id)?.nombre}</td><td>{player.posicion}</td><td><span className={player.estado_comet === "habilitado" ? "pill pill-green" : "pill pill-warn"}>{player.estado_comet}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><span>♟</span><strong>No hay jugadores cargados</strong><p>La elegibilidad se muestra cuando la entidad registra plantillas en Supabase.</p></div>}</section><section className="risk-note eligibility-note"><span>ⓘ</span><p>La conexión automatizada con COMET no está incluida sin credenciales y autorización de integración. Este panel usa el estado local guardado en SIGEC-LP.</p></section></>;
}

function ActaPage({ match, competition, clubName, onNotice }: { match?: Match; competition: Competition | null; clubName: (id?: string) => string; onNotice: (message: string) => void }) {
  return <><PageHeading eyebrow="PAN-022 · ACTA DE PARTIDO" title="Revisión del acta" subtitle="Consulta el marcador y la información registrada para el encuentro seleccionado."><span className="pill pill-warn">{match ? badgeText(match.estado) : "Sin partido"}</span></PageHeading>{match ? <section className="panel acta-document"><div className="acta-title"><div className="brand-crest">LP</div><div><span className="eyebrow">SIGEC-LP · TEMPORADA {competition?.temporada ?? "—"}</span><h2>Resumen del encuentro</h2><p>{clubName(match.local_id)} vs {clubName(match.visitante_id)}</p></div><span className="pill">Jornada {match.jornada}</span></div><div className="acta-checks"><div><span className="check-ready">✓</span><span>Competencia</span><small>{competition?.nombre ?? "Sin competencia"}</small></div><div><span className="check-ready">✓</span><span>Marcador registrado</span><small>{match.goles_local} : {match.goles_visitante}</small></div><div><span className="check-ready">✓</span><span>Estado</span><small>{badgeText(match.estado)}</small></div><div><span className="check-pending">○</span><span>Documento COMET</span><small>No integrado</small></div></div><div className="acta-warning">Esta vista resume los datos guardados en SIGEC-LP. La firma oficial y el intercambio con COMET requieren una integración autorizada.</div><div className="form-actions"><span className="muted">La generación de PDF y firma no está configurada.</span><button className="btn btn-light" onClick={() => onNotice("La descarga estará disponible cuando se configure el generador de actas.")}>Descargar borrador</button></div></section> : <section className="panel empty-state"><strong>No hay partidos para mostrar</strong><p>Selecciona o programa un partido desde la competencia activa.</p></section>}</>;
}

function IncidentRegisterPage({ events, clubShort, onView }: { events: EventRow[]; clubShort: (id?: string) => string; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-023 · CRONOLOGÍA DEL ACTA" title="Registro de incidencias" subtitle="Consulta la cronología minuto a minuto y sus observaciones arbitrales."><button className="btn btn-dark" onClick={() => onView("vivo")}>＋ Registrar incidencia</button></PageHeading><section className="panel"><div className="panel-heading"><div><p className="eyebrow">PARTIDO ACTIVO</p><h2>Eventos oficiales</h2></div><span className="pill pill-live">{events.length} registros</span></div>{events.length ? <div className="timeline detailed-timeline">{events.map((event) => <article className="timeline-item" key={event.id}><span className="timeline-minute">{event.minuto}′</span><div><strong>{event.tipo.replaceAll("_", " ").toUpperCase()} · {clubShort(event.club_id)}</strong><p>{event.jugador ? `${event.jugador} · ` : ""}{event.detalle || "Sin observación adicional."}</p></div><span className="pill">Acta</span></article>)}</div> : <div className="empty-state"><span>◷</span><strong>No hay eventos registrados</strong><p>Inicia un partido y registra una incidencia para formar la cronología.</p><button className="btn btn-dark" onClick={() => onView("vivo")}>Abrir consola</button></div>}</section></>;
}

function VarIntegrityPage({ events, clubShort, onView }: { events: EventRow[]; clubShort: (id?: string) => string; onView: (view: View) => void }) {
  const varEvents = events.filter((event) => event.tipo === "var");
  return <><PageHeading eyebrow="PAN-024 · REVISIÓN DE VIDEO" title="VAR e integridad del acta" subtitle="Registra chequeos y consulta las revisiones asociadas al partido."><button className="btn btn-dark" onClick={() => onView("vivo")}>Abrir consola en vivo</button></PageHeading><div className="metrics-grid four"><Metric label="CHEQUEOS VAR" value={`${varEvents.length}`} note="En el registro cargado" icon="▣"/><Metric label="ESTADO DE CONEXIÓN" value="Sin enlace" note="No hay integración audiovisual" icon="◉"/><Metric label="ACTA DIGITAL" value="Protegida" note="Acceso por rol Supabase" icon="✓"/><Metric label="LATENCIA" value="—" note="Servicio no configurado" icon="◷"/></div><section className="panel"><div className="panel-heading"><div><p className="eyebrow">REVISIONES REGISTRADAS</p><h2>Chequeos y decisiones VAR</h2></div><span className="pill">{varEvents.length} revisiones</span></div>{varEvents.length ? varEvents.map((event) => <div className="designation-row" key={event.id}><div><strong>Revisión VAR · {clubShort(event.club_id)}</strong><small>Minuto {event.minuto} · {event.detalle || "Sin detalle"}</small></div><span className="pill pill-warn">Revisar acta</span></div>) : <div className="empty-state"><span>▣</span><strong>Sin revisiones registradas</strong><p>El uso de vídeo requiere una integración externa. Los eventos manuales quedan en el acta.</p></div>}</section></>;
}

function DisciplineAlertsPage({ sanctions, onView }: { sanctions: Sanction[]; onView: (view: View) => void }) {
  const alerts = sanctions.filter((item) => item.estado !== "Cumplida");
  return <><PageHeading eyebrow="PAN-025 · ALERTAS DISCIPLINARIAS" title="Alertas y suspensiones" subtitle="Control de resoluciones que requieren seguimiento por la Comisión Disciplinaria."><button className="btn btn-light" onClick={() => onView("sanciones")}>Abrir libro de sanciones →</button></PageHeading><div className="metrics-grid four"><Metric label="ALERTAS ABIERTAS" value={`${alerts.length}`} note="Pendientes o notificadas" icon="⚠"/><Metric label="EN CUMPLIMIENTO" value={`${sanctions.filter((item) => item.estado === "Cumplida").length}`} note="Resoluciones cumplidas" icon="✓"/><Metric label="SUSPENSIONES" value={`${sanctions.reduce((sum, item) => sum + item.jornadas, 0)}`} note="Fechas indicadas" icon="▰"/><Metric label="REGLAMENTO" value="Por validar" note="Umbrales de tarjetas" icon="ⓘ"/></div><div className="alert-card-grid">{alerts.length ? alerts.map((item) => <article className="panel alert-detail-card" key={item.id}><span className="pill pill-warn">{item.estado}</span><h2>{item.jugador}</h2><p>{item.club}</p><div className="suspension-count">{item.jornadas} <small>fechas</small></div><strong>{item.infraccion}</strong><button className="text-link" onClick={() => onView("sanciones")}>Ver expediente →</button></article>) : <div className="empty-state panel">No hay alertas pendientes.</div>}</div><section className="risk-note eligibility-note"><span>ⓘ</span><p>Los avisos por acumulación de tarjetas deben configurarse de acuerdo con el reglamento aprobado para la temporada correspondiente.</p></section></>;
}

function SanctionLedgerPage({ sanctions, search, setSearch, onView }: { sanctions: Sanction[]; search: string; setSearch: (value: string) => void; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-026 · LIBRO MAESTRO" title="Libro de sanciones" subtitle="Historial de resoluciones, fechas de suspensión y estado de notificación."><button className="btn btn-gold" onClick={() => onView("resolucion")}>＋ Nueva resolución</button></PageHeading><section className="panel discipline-ledger"><div className="panel-heading"><div><p className="eyebrow">RESOLUCIONES REGISTRADAS</p><h2>Libro disciplinario</h2></div><span className="pill">{sanctions.length} entradas</span></div><div className="ledger-tools"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="⌕ Buscar por jugador, club o infracción…"/><button className="btn btn-light" onClick={() => setSearch("")}>Limpiar</button></div><div className="table-scroll"><table className="data-table"><thead><tr><th>ACTA</th><th>JUGADOR</th><th>CLUB</th><th>INFRACCIÓN</th><th>JORNADAS</th><th>ESTADO</th></tr></thead><tbody>{sanctions.map((item) => <tr key={item.id}><td>#{item.id}</td><td><strong>{item.jugador}</strong></td><td>{item.club}</td><td>{item.infraccion}</td><td>{item.jornadas}</td><td><span className={`pill ${item.estado === "Cumplida" ? "pill-green" : "pill-warn"}`}>{item.estado}</span></td></tr>)}</tbody></table></div>{sanctions.length === 0 && <div className="empty-state">No hay registros para mostrar.</div>}</section></>;
}

function ResolutionPage({ players, clubs, onCreate, canWrite, onLogin }: { players: Player[]; clubs: Club[]; onCreate: (event: FormEvent<HTMLFormElement>) => void; canWrite: boolean; onLogin: () => void }) {
  return <><PageHeading eyebrow="PAN-027 · COMISIÓN DISCIPLINARIA" title="Nueva resolución" subtitle="Documenta la infracción y la medida disciplinaria aplicable."><button className="btn btn-light" onClick={onLogin}>Ayuda de acceso</button></PageHeading><section className="panel form-panel large-form"><div className="panel-heading"><div><p className="eyebrow">BORRADOR DE RESOLUCIÓN</p><h2>Datos del expediente</h2></div><span className="pill pill-warn">No publicado</span></div><form className="screen-form" onSubmit={onCreate}><label>Jugador<select name="jugador_id" required><option value="">Selecciona un jugador</option>{players.map((player) => <option key={player.id} value={player.id}>{player.nombre} · {clubs.find((club) => club.id === player.club_id)?.sigla}</option>)}</select></label><label>Infracción<input name="infraccion" required placeholder="Describe la infracción documentada"/></label><label>Fechas de suspensión<input name="jornadas" type="number" min="0" max="100" defaultValue="1" required/></label><label>Estado inicial<select name="estado"><option value="pendiente">Pendiente de notificación</option></select></label><div className="resolution-preview"><span className="eyebrow">VISTA PREVIA</span><p>La resolución deberá indicar el fundamento reglamentario, el partido de origen y la fecha en que surte efecto.</p></div><div className="form-actions"><span className="muted">La publicación definitiva se confirma después de revisar el expediente.</span>{canWrite ? <button className="btn btn-gold">Guardar borrador</button> : <button type="button" className="btn btn-dark" onClick={onLogin}>Ingresar</button>}</div></form></section></>;
}

function BulletinsScreen({ bulletins, onView }: { bulletins: Bulletin[]; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-012 · COMUNICADOS" title="Boletines y comunicados" subtitle="Publicaciones relacionadas con la programación y las resoluciones de la competencia."><button className="btn btn-light" onClick={() => onView("sanciones")}>Ver resoluciones →</button></PageHeading><div className="bulletin-grid">{bulletins.map((item) => <article className="panel bulletin-tile" key={item.id}><span className="eyebrow">{item.categoria.toUpperCase()}</span><h2>{item.titulo}</h2><p className="muted">{item.resumen}</p><span className="bulletin-date">{item.publicado_at ? new Date(item.publicado_at).toLocaleDateString("es-EC") : "Contenido de muestra"}</span><button className="text-link" onClick={() => onView(item.categoria.toLowerCase().includes("discip") ? "sanciones" : item.categoria.toLowerCase().includes("program") ? "calendario" : "torneos")}>Consultar →</button></article>)}</div>{bulletins.length === 0 && <section className="panel empty-state">No hay comunicados publicados.</section>}</>;
}

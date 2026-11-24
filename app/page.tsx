"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type View = "portal" | "tabla" | "calendario" | "partido" | "clubes" | "club" | "estadisticas" | "boletines" | "torneos" | "temporadas" | "competencia" | "fases" | "clubesAdmin" | "clubAdmin" | "programacion" | "designaciones" | "planillas" | "planilla" | "jugador" | "acta" | "vivo" | "incidencias" | "var" | "disciplina" | "alertas" | "sanciones" | "resolucion" | "pronosticos" | "misPronosticos" | "perfil";
type AuthMode = "signin" | "signup" | "recovery" | "confirmation";
type Role = "administrador" | "organizador" | "comisario" | "arbitro" | "disciplina" | "club" | "publico";
type Club = { id: string; nombre: string; sigla: string; color?: string; estadio?: string };
type Standing = { club_id?: string; club?: string; sigla?: string; pj: number; pg: number; pe: number; pp: number; gf: number; gc: number; pts: number };
type Match = { id: string; local_id?: string; visitante_id?: string; local?: string; visitante?: string; goles_local: number; goles_visitante: number; fecha?: string; fecha_hora?: string; jornada: number; estado: string; estadio?: string; fase?: string; periodo?: string; reloj_inicio_at?: string | null; reloj_acumulado_segundos?: number };
type Profile = { nombre: string; apodo: string; ciudad: string; club_favorito_id: string | null; avatar_url: string | null };
type VirtualPrediction = { id: string; partido_id: string; seleccion: "local" | "empate" | "visitante"; cuota: number; puntos_apostados: number; retorno_puntos: number; estado: "pendiente" | "ganado" | "perdido" | "anulado"; created_at: string };
type Competition = { id: string; nombre: string; temporada: number; serie: string; estado: string };
type Player = { id: string; club_id: string; nombre: string; dorsal: number; posicion: string; estado_comet: string };
type EventRow = { id: string; partido_id: string; minuto: number; tipo: string; club_id?: string; jugador?: string; detalle?: string };
type LeaderboardRow = { posicion: number; apodo: string; puntos: number; aciertos: number; total_pronosticos: number };
type Sanction = { id: string; jugador: string; club: string; infraccion: string; jornadas: number; estado: string; fecha?: string };
type Bulletin = { id: string; titulo: string; categoria: string; resumen: string; publicado_at?: string };

const sampleClubs: Club[] = [
  { id: "idv", nombre: "Independiente del Valle", sigla: "IDV", color: "#111b38", estadio: "Banco Guayaquil" },
  { id: "auc", nombre: "SD Aucas", sigla: "AUC", color: "#f1c948", estadio: "Gonzalo Pozo Ripalda" },
  { id: "ldu", nombre: "LDU Quito", sigla: "LDU", color: "#25324a", estadio: "Rodrigo Paz Delgado" },
  { id: "bsc", nombre: "Barcelona SC", sigla: "BSC", color: "#edc444", estadio: "Monumental Banco Pichincha" },
  { id: "uca", nombre: "Universidad Católica", sigla: "UCA", color: "#5268a0", estadio: "Olímpico Atahualpa" },
  { id: "cse", nombre: "CS Emelec", sigla: "CSE", color: "#253c75", estadio: "George Capwell" },
  { id: "nac", nombre: "El Nacional", sigla: "NAC", color: "#cd302d", estadio: "Olímpico Atahualpa" },
  { id: "mac", nombre: "Macará", sigla: "MAC", estadio: "Bellavista" },
  { id: "cue", nombre: "Deportivo Cuenca", sigla: "CUE", color: "#b6282e", estadio: "Alejandro Serrano Aguilar" },
  { id: "ore", nombre: "Orense SC", sigla: "ORE", color: "#138652", estadio: "9 de Mayo" },
  { id: "mru", nombre: "Mushuc Runa", sigla: "MRU", estadio: "Echaleche" },
  { id: "cum", nombre: "Cumbayá FC", sigla: "CUM", estadio: "Olímpico Atahualpa" },
  { id: "imb", nombre: "Imbabura SC", sigla: "IMB", estadio: "Olímpico de Ibarra" },
  { id: "tec", nombre: "Técnico Universitario", sigla: "TEC", estadio: "Bellavista" },
  { id: "del", nombre: "Delfín SC", sigla: "DEL", color: "#1971aa", estadio: "Jocay" },
  { id: "lib", nombre: "Libertad FC", sigla: "LIB", color: "#b6272e", estadio: "Reina del Cisne" },
];

const sampleStandings: Standing[] = [
  { club_id: "idv", pj: 12, pg: 8, pe: 4, pp: 0, gf: 22, gc: 8, pts: 28 },
  { club_id: "auc", pj: 11, pg: 8, pe: 2, pp: 1, gf: 25, gc: 12, pts: 26 },
  { club_id: "ldu", pj: 10, pg: 8, pe: 0, pp: 2, gf: 21, gc: 10, pts: 24 },
  { club_id: "bsc", pj: 11, pg: 6, pe: 4, pp: 1, gf: 18, gc: 8, pts: 22 },
  { club_id: "uca", pj: 10, pg: 5, pe: 3, pp: 2, gf: 20, gc: 12, pts: 18 },
  { club_id: "cse", pj: 11, pg: 4, pe: 5, pp: 2, gf: 13, gc: 9, pts: 17 },
  { club_id: "nac", pj: 11, pg: 5, pe: 0, pp: 6, gf: 13, gc: 16, pts: 15 },
  { club_id: "mac", pj: 11, pg: 3, pe: 5, pp: 3, gf: 11, gc: 10, pts: 14 },
  { club_id: "cue", pj: 11, pg: 2, pe: 5, pp: 4, gf: 17, gc: 21, pts: 11 },
  { club_id: "ore", pj: 11, pg: 2, pe: 5, pp: 4, gf: 9, gc: 14, pts: 11 },
  { club_id: "mru", pj: 11, pg: 3, pe: 2, pp: 6, gf: 12, gc: 17, pts: 11 },
  { club_id: "cum", pj: 11, pg: 3, pe: 1, pp: 7, gf: 10, gc: 17, pts: 10 },
  { club_id: "imb", pj: 11, pg: 2, pe: 3, pp: 6, gf: 10, gc: 19, pts: 9 },
  { club_id: "tec", pj: 11, pg: 1, pe: 5, pp: 5, gf: 9, gc: 17, pts: 8 },
  { club_id: "del", pj: 11, pg: 1, pe: 3, pp: 7, gf: 6, gc: 17, pts: 6 },
  { club_id: "lib", pj: 11, pg: 0, pe: 2, pp: 9, gf: 7, gc: 22, pts: 2 },
];

const sampleMatches: Match[] = [
  { id: "demo-live", local_id: "ldu", visitante_id: "idv", goles_local: 2, goles_visitante: 1, jornada: 12, estado: "en_vivo", estadio: "Rodrigo Paz Delgado", fase: "Fase 1" },
  { id: "demo-1", local_id: "bsc", visitante_id: "cse", goles_local: 0, goles_visitante: 0, jornada: 12, estado: "programado", fecha: "Hoy · 19:00", estadio: "Monumental Banco Pichincha", fase: "Fase 1" },
  { id: "demo-2", local_id: "auc", visitante_id: "nac", goles_local: 0, goles_visitante: 0, jornada: 12, estado: "programado", fecha: "Mañana · 15:30", estadio: "Gonzalo Pozo Ripalda", fase: "Fase 1" },
  { id: "demo-3", local_id: "uca", visitante_id: "del", goles_local: 0, goles_visitante: 0, jornada: 12, estado: "programado", fecha: "Domingo · 18:00", estadio: "Olímpico Atahualpa", fase: "Fase 1" },
];

const sampleSanctions: Sanction[] = [
  { id: "ACT-1084", jugador: "Leonai Souza", club: "Barcelona SC", infraccion: "Acumulación de tarjetas amarillas", jornadas: 1, estado: "Pendiente" },
  { id: "ACT-1083", jugador: "Facundo Castelli", club: "CS Emelec", infraccion: "Expulsión directa", jornadas: 2, estado: "Notificada" },
  { id: "ACT-1082", jugador: "Damián Díaz", club: "Barcelona SC", infraccion: "Conducta antideportiva", jornadas: 1, estado: "Cumplida" },
];

const sampleBulletins: Bulletin[] = [
  { id: "demo-b1", titulo: "Calendario oficial de la jornada", categoria: "Programación", resumen: "Consulta horarios, estadios y estado de los encuentros de la fase." },
  { id: "demo-b2", titulo: "Información de temporadas y fases", categoria: "Competiciones", resumen: "Revisa el estado de las competencias y sus jornadas." },
  { id: "demo-b3", titulo: "Resoluciones de la Comisión Disciplinaria", categoria: "Disciplina", resumen: "Sanciones registradas y estados de notificación." },
];

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
  { root: "torneos", label: "GESTIÓN DE TORNEOS", screens: [{ id: "torneos", label: "Resumen" }, { id: "temporadas", label: "Temporadas" }, { id: "competencia", label: "Nueva competencia" }, { id: "fases", label: "Fases" }, { id: "clubesAdmin", label: "Clubes afiliados" }, { id: "clubAdmin", label: "Ficha de club" }, { id: "programacion", label: "Programación" }, { id: "designaciones", label: "Designaciones" }] },
  { root: "planillas", label: "PLANILLA COMET", screens: [{ id: "planillas", label: "Partidos" }, { id: "planilla", label: "Validar nómina" }, { id: "jugador", label: "Elegibilidad" }, { id: "acta", label: "Cierre del acta" }] },
  { root: "vivo", label: "CONSOLA EN VIVO", screens: [{ id: "vivo", label: "Marcador en vivo" }, { id: "incidencias", label: "Cronología" }, { id: "var", label: "VAR e integridad" }] },
  { root: "disciplina", label: "CONTROL DISCIPLINARIO", screens: [{ id: "disciplina", label: "Resumen" }, { id: "alertas", label: "Alertas" }, { id: "sanciones", label: "Libro de sanciones" }, { id: "resolucion", label: "Nueva resolución" }] },
];

const roleLabels: Record<string, string> = {
  administrador: "Administrador de LigaPro",
  organizador: "Dirección de competiciones",
  comisario: "Comisario de partido",
  arbitro: "Equipo arbitral",
  disciplina: "Comisión disciplinaria",
  club: "Delegado de club",
  publico: "Usuario",
};

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
  const [view, setView] = useState<View>("torneos");
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [virtualBalance, setVirtualBalance] = useState(1000);
  const [myPredictions, setMyPredictions] = useState<VirtualPrediction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [clubs, setClubs] = useState<Club[]>(sampleClubs);
  const [standings, setStandings] = useState<Standing[]>(sampleStandings);
  const [matches, setMatches] = useState<Match[]>(sampleMatches);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sanctions, setSanctions] = useState<Sanction[]>(sampleSanctions);
  const [bulletins, setBulletins] = useState<Bulletin[]>(sampleBulletins);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [database, setDatabase] = useState<"demo" | "connected" | "error">("demo");
  const [loading, setLoading] = useState(true);
  const [routingReady, setRoutingReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [search, setSearch] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [liveActionBusy, setLiveActionBusy] = useState(false);
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
    const [clubResult, compResult, matchResult, standingsResult, playerResult, sanctionResult, eventResult, bulletinResult, rankingResult] = await Promise.all([
      client.from("clubes").select("id,nombre,sigla,color_primario,estadio").order("nombre"),
      client.from("competencias").select("id,nombre,temporada,serie,estado").order("temporada", { ascending: false }).limit(1),
      client.from("partidos").select("id,club_local_id,club_visitante_id,goles_local,goles_visitante,jornada,estado,estadio,fecha_hora,periodo,reloj_inicio_at,reloj_acumulado_segundos,fase:fases(nombre)").order("fecha_hora", { ascending: true }).limit(20),
      client.from("clasificacion_publica").select("club_id,club,sigla,pj,pg,pe,pp,gf,gc,pts").order("posicion"),
      client.from("jugadores").select("id,club_id,nombre,dorsal,posicion,estado_comet").order("dorsal"),
      client.from("sanciones").select("id,jugador:jugadores(nombre),club:clubes(nombre),infraccion,jornadas_suspension,estado,created_at").order("created_at", { ascending: false }).limit(30),
      client.from("incidencias").select("id,partido_id,minuto,tipo,club_id,detalle").order("created_at", { ascending: true }).limit(100),
      client.from("comunicados").select("id,titulo,categoria,resumen,publicado_at").eq("estado", "publicado").order("publicado_at", { ascending: false }).limit(12),
      client.rpc("obtener_ranking_pronosticos").limit(10),
    ]);

    if (clubResult.error || matchResult.error) {
      setDatabase("demo");
      setLoading(false);
      return;
    }

    if (clubResult.data?.length) {
      setClubs(clubResult.data.map((row: any) => ({ id: row.id, nombre: row.nombre, sigla: row.sigla, color: row.color_primario, estadio: row.estadio })));
    }
    if (compResult.data?.[0]) setCompetition(compResult.data[0] as Competition);
    if (matchResult.data?.length) {
      setMatches(matchResult.data.map((row: any) => ({
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
        estadio: row.estadio,
        fecha_hora: row.fecha_hora,
        fecha: row.fecha_hora ? new Date(row.fecha_hora).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" }) : "Por programar",
        fase: Array.isArray(row.fase) ? row.fase[0]?.nombre : row.fase?.nombre,
      })));
    }
    if (!standingsResult.error && standingsResult.data?.length) setStandings(standingsResult.data as Standing[]);
    if (!playerResult.error && playerResult.data?.length) setPlayers(playerResult.data as Player[]);
    if (!sanctionResult.error && sanctionResult.data?.length) {
      setSanctions(sanctionResult.data.map((row: any) => ({ id: row.id.slice(0, 8), jugador: row.jugador?.nombre ?? "Jugador", club: row.club?.nombre ?? "Club", infraccion: row.infraccion, jornadas: row.jornadas_suspension, estado: row.estado, fecha: row.created_at })));
    }
    if (!eventResult.error) setEvents((eventResult.data ?? []).map((row: any) => ({ id: row.id, partido_id: row.partido_id, minuto: row.minuto, tipo: row.tipo, club_id: row.club_id, detalle: row.detalle })).reverse());
    if (!bulletinResult.error && bulletinResult.data?.length) setBulletins(bulletinResult.data as Bulletin[]);
    if (!rankingResult.error && rankingResult.data) setLeaderboard(rankingResult.data as LeaderboardRow[]);
    setDatabase("connected");
    setLoading(false);
  }, []);

  const loadFanData = useCallback(async (client: SupabaseClient, userId: string) => {
    const [profileResult, walletResult, predictionResult] = await Promise.all([
      client.from("perfiles").select("nombre,apodo,ciudad,club_favorito_id,avatar_url").eq("id", userId).maybeSingle(),
      client.from("carteras_virtuales").select("saldo_puntos").eq("usuario_id", userId).maybeSingle(),
      client.from("pronosticos_virtuales").select("id,partido_id,seleccion,cuota,puntos_apostados,retorno_puntos,estado,created_at").eq("usuario_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (profileResult.data) setProfile(profileResult.data as Profile);
    if (walletResult.data) setVirtualBalance(walletResult.data.saldo_puntos);
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
    const { data: currentProfile } = await client.from("perfiles").select("rol").eq("id", authUser.id).maybeSingle();
    setRole((currentProfile?.rol as Role) ?? null);
    await loadFanData(client, authUser.id);
    return (currentProfile?.rol as Role) ?? null;
  }, [loadFanData, syncGoogleProfile]);

  useEffect(() => {
    try {
      const client = createClient();
      setSupabase(client);
      void client.auth.getUser().then(async ({ data }) => {
        if (data.user) await hydrateUser(client, data.user);
        else setUser(null);
      });
      const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          setUser(null); setRole(null); setProfile(null); setMyPredictions([]); setVirtualBalance(1000);
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
      setDatabase("demo");
      setLoading(false);
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
  const canWrite = Boolean(user && role && role !== "publico");
  const canOperateLive = Boolean(user && role && ["administrador", "comisario", "arbitro"].includes(role));
  const activeMatch = matches.find((match) => match.id === selectedMatchId) ?? matches.find((match) => match.estado === "en_vivo") ?? matches[0];
  const currentGroup = screenGroups.find((group) => group.screens.some((screen) => screen.id === view)) ?? screenGroups[0];
  const navigateTo = (screen: View) => setView(screen);

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
      const { data: profile } = await supabase.from("perfiles").select("rol").eq("id", data.user.id).maybeSingle();
      setRole((profile?.rol as Role) ?? "publico");
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
    setUser(null); setRole(null); setProfile(null); setMyPredictions([]); setVirtualBalance(1000); setNotice("Sesión cerrada.");
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
    if (!supabase || !requireRole(["administrador", "organizador"])) return;
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("competencias").insert({ nombre: String(form.get("nombre")), temporada: Number(form.get("temporada")), serie: String(form.get("serie")), formato: String(form.get("formato") ?? "fase_clasificatoria"), estado: "borrador" });
    if (error) { setNotice(`No se pudo crear la competencia: ${error.message}`); return; }
    setNotice("Competencia creada.");
    void loadData(supabase);
    formElement.reset();
  }

  async function createMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !requireRole(["administrador", "organizador", "comisario"])) return;
    if (!competition) { setNotice("Crea o selecciona una competencia antes de programar partidos."); return; }
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const local = String(form.get("local"));
    const away = String(form.get("visitante"));
    if (local === away) { setNotice("Selecciona dos clubes distintos."); return; }
    const { error } = await supabase.from("partidos").insert({ competencia_id: competition.id, club_local_id: local, club_visitante_id: away, jornada: Number(form.get("jornada")), fecha_hora: new Date(String(form.get("fecha"))).toISOString(), estadio: String(form.get("estadio")), estado: "programado" });
    if (error) { setNotice(`No se pudo programar el partido: ${error.message}`); return; }
    setNotice("Partido programado."); void loadData(supabase); formElement.reset();
  }

  async function createLiveAction(action: string, clubId?: string, playerId?: string, secondaryPlayerId?: string, detail?: string) {
    if (!supabase || !activeMatch || !requireRole(["administrador", "comisario", "arbitro"])) return;
    if (activeMatch.id.startsWith("demo")) { setNotice("El marcador de muestra es de solo lectura. Ejecuta la migración de Supabase y selecciona un partido real."); return; }
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
    if (!supabase || !requireRole(["administrador", "disciplina"])) return;
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
        <div className="brand-lockup"><div className="brand-crest">⚡</div><div><strong>LIGAPRO ECUABET</strong><span>SIGEC-LP · SISTEMA OPERATIVO</span></div></div>
        <div className="division-switch"><span>DIVISIÓN OFICIAL</span><div><button className="selected">SERIE A</button><button onClick={() => setNotice("Serie B estará disponible al crear una competencia de esa división.")}>SERIE B</button></div></div>
        <nav className="side-nav" aria-label="Módulos">
          {menu.map((item) => <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)}><span className="nav-icon">{item.symbol}</span>{item.label}</button>)}
        </nav>
      <div className="sidebar-bottom"><span className={`status-dot ${database === "connected" ? "green" : "gold"}`} />{database === "connected" ? "SUPABASE CONECTADO" : "MODO DEMOSTRACIÓN"}<small>30 pantallas · 6 módulos</small><small>UTC−5 · Ecuador</small></div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-season"><span className="season-badge">TEMPORADA {competition?.temporada ?? "2024"}</span><span>{competition?.nombre ?? "LigaPro Ecuador · Fase clasificatoria"}</span></div>
          <button className="topbar-live" onClick={() => setView("vivo")} aria-label={`Abrir consola en vivo: ${clubShort(activeMatch?.local_id)} ${activeMatch?.goles_local ?? 0} a ${activeMatch?.goles_visitante ?? 0} ${clubShort(activeMatch?.visitante_id)}`}>
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
            <button className="header-icon-button" onClick={() => setView("alertas")} aria-label="Ver alertas" title="Alertas">♧</button>
            <span className={`connection-pill ${database === "connected" ? "ok" : "demo"}`}><i />{database === "connected" ? "Datos en línea" : "Datos de muestra"}</span>
            {user ? <><button className="header-profile-link" onClick={() => setView("perfil")} aria-label="Abrir mi perfil"><span className="header-profile-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : (profile?.apodo || profile?.nombre || user.email || "LP").slice(0, 2).toUpperCase()}</span><span className="user-label">{profile?.apodo || roleLabels[role ?? ""] || user.email}</span></button><button className="btn btn-quiet" onClick={() => void signOut()}>Cerrar sesión</button></> : <button className="btn btn-dark" onClick={() => setAuthOpen(true)}>Ingresar</button>}
          </div>
        </header>

        <div className="content-wrap">
          <nav className="fan-shortcuts" aria-label="Accesos para aficionados">
            <div className="fan-shortcuts-copy"><strong>Zona del aficionado</strong><span>Perfil, cuenta y pronósticos</span></div>
            <button className={view === "pronosticos" || view === "misPronosticos" ? "fan-shortcut active" : "fan-shortcut"} onClick={() => navigateTo("pronosticos")}><span>⚽</span> Pronósticos</button>
            <button className={view === "perfil" ? "fan-shortcut active" : "fan-shortcut"} onClick={() => navigateTo("perfil")}><span>♙</span> Mi perfil</button>
          </nav>
          <nav className="screen-tabs" aria-label={`Pantallas de ${currentGroup.label}`}><span>{currentGroup.label}</span>{currentGroup.screens.map((screen) => <button key={screen.id} className={view === screen.id ? "active" : ""} onClick={() => navigateTo(screen.id)}>{screen.label}</button>)}</nav>
          {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Cerrar aviso" onClick={() => setNotice("")}>×</button></div>}
          {database === "demo" && <div className="demo-banner"><span>ⓘ</span><div><strong>Vista de demostración</strong><span>Los datos visibles son ilustrativos. Conecta Supabase y ejecuta <code>supabase/schema.sql</code> para habilitar datos reales y guardar cambios.</span></div></div>}

          {view === "portal" && <Portal clubs={clubs} standings={standings} matches={matches} bulletins={bulletins} clubName={clubName} clubShort={clubShort} loading={loading} onView={navigateTo} />}
          {view === "pronosticos" && <PredictionsPage matches={matches} clubName={clubName} balance={virtualBalance} leaderboard={leaderboard} isLoggedIn={Boolean(user)} profileComplete={Boolean(profile?.nombre.trim() && profile?.apodo.trim())} databaseConnected={database === "connected"} onLogin={() => { setAuthMode("signup"); setAuthOpen(true); }} onPlace={createVirtualPrediction} onView={navigateTo} />}
          {view === "misPronosticos" && <MyPredictionsPage predictions={myPredictions} matches={matches} clubName={clubName} isLoggedIn={Boolean(user)} onLogin={() => { setAuthMode("signin"); setAuthOpen(true); }} onView={navigateTo} />}
          {view === "perfil" && <ProfilePage user={user} profile={profile} clubs={clubs} balance={virtualBalance} predictionCount={myPredictions.length} onSave={saveProfile} onUploadAvatar={uploadAvatar} onChangePassword={changePassword} passwordBusy={loginBusy} onSignIn={() => { setAuthMode("signin"); setAuthMessage(""); setAuthOpen(true); }} onSignUp={() => { setAuthMode("signup"); setAuthMessage(""); setAuthOpen(true); }} onRecover={() => { setAuthEmail(user?.email ?? authEmail); setAuthMode("recovery"); setAuthMessage(""); setAuthOpen(true); }} onSignOut={() => void signOut()} onView={navigateTo} />}
          {view === "tabla" && <PublicTablePage clubs={clubs} standings={standings} clubName={clubName} onView={navigateTo} />}
          {view === "calendario" && <CalendarPage clubs={clubs} matches={matches} clubName={clubName} onView={navigateTo} />}
          {view === "partido" && <MatchDetailPage clubs={clubs} match={activeMatch} clubName={clubName} onView={navigateTo} />}
          {view === "clubes" && <ClubDirectoryPage clubs={clubs} onView={navigateTo} />}
          {view === "club" && <ClubProfilePage clubs={clubs} matches={matches} clubName={clubName} onView={navigateTo} />}
          {view === "estadisticas" && <StatisticsPage clubs={clubs} standings={standings} onView={navigateTo} />}
          {view === "boletines" && <BulletinsScreen bulletins={bulletins} onView={navigateTo} />}
          {view === "torneos" && <TournamentPanel clubs={clubs} matches={matches} competition={competition} clubName={clubName} onCreateCompetition={createCompetition} onCreateMatch={createMatch} onLogin={() => setAuthOpen(true)} canWrite={canWrite} />}
          {view === "temporadas" && <CompetitionListPage competition={competition} onView={navigateTo} />}
          {view === "competencia" && <CompetitionFormPage onCreate={createCompetition} canWrite={canWrite} onLogin={() => setAuthOpen(true)} />}
          {view === "fases" && <PhasesPage competition={competition} onView={navigateTo} />}
          {view === "clubesAdmin" && <ClubManagementPage clubs={clubs} onView={navigateTo} />}
          {view === "clubAdmin" && <AdminClubDetailPage clubs={clubs} onView={navigateTo} />}
          {view === "programacion" && <FixtureManagementPage clubs={clubs} matches={matches} clubName={clubName} onCreate={createMatch} canWrite={canWrite} onLogin={() => setAuthOpen(true)} />}
          {view === "designaciones" && <DesignationPage matches={matches} clubName={clubName} canWrite={canWrite} onLogin={() => setAuthOpen(true)} onNotice={setNotice} />}
          {view === "planillas" && <LineupSelectorPage matches={matches} clubName={clubName} onView={navigateTo} />}
          {view === "planilla" && <LineupPanel clubs={clubs} players={players} matches={matches} clubName={clubName} clubShort={clubShort} canWrite={canWrite} onLogin={() => setAuthOpen(true)} onNotice={setNotice} />}
          {view === "jugador" && <PlayerEligibilityPage clubs={clubs} players={players} onView={navigateTo} />}
          {view === "acta" && <ActaPage match={activeMatch} clubName={clubName} onNotice={setNotice} />}
          {view === "vivo" && <LivePanel clubs={clubs} matches={matches} match={activeMatch} events={events.filter((event) => event.partido_id === activeMatch?.id)} players={players} clubName={clubName} clubShort={clubShort} canWrite={canOperateLive} actionBusy={liveActionBusy} onLogin={() => setAuthOpen(true)} onSelectMatch={setSelectedMatchId} onCreateAction={createLiveAction} />}
          {view === "incidencias" && <IncidentRegisterPage events={events} clubShort={clubShort} onView={navigateTo} />}
          {view === "var" && <VarIntegrityPage events={events} clubShort={clubShort} onView={navigateTo} />}
          {view === "disciplina" && <DisciplinePanel clubs={clubs} players={players} sanctions={filteredSanctions} search={search} setSearch={setSearch} canWrite={canWrite} onLogin={() => setAuthOpen(true)} onCreateSanction={createSanction} />}
          {view === "alertas" && <DisciplineAlertsPage sanctions={sanctions} onView={navigateTo} />}
          {view === "sanciones" && <SanctionLedgerPage sanctions={filteredSanctions} search={search} setSearch={setSearch} onView={navigateTo} />}
          {view === "resolucion" && <ResolutionPage players={players} clubs={clubs} onCreate={createSanction} canWrite={canWrite} onLogin={() => setAuthOpen(true)} />}
        </div>
        <footer className="footer"><span>© 2026 LigaPro · Sistema de Gestión de Competiciones</span><span>30 pantallas · 6 módulos · Centro oficial de resultados y gobernanza</span></footer>
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

function PredictionsPage({ matches, clubName, balance, leaderboard, isLoggedIn, profileComplete, databaseConnected, onLogin, onPlace, onView }: { matches: Match[]; clubName: (id?: string) => string; balance: number; leaderboard: LeaderboardRow[]; isLoggedIn: boolean; profileComplete: boolean; databaseConnected: boolean; onLogin: () => void; onPlace: (matchId: string, selection: "local" | "empate" | "visitante", points: number) => void; onView: (view: View) => void }) {
  const games = matches.filter((match) => match.estado === "programado");
  const openGames = games.filter((match) => Boolean(match.fecha_hora && new Date(match.fecha_hora).getTime() > Date.now()));
  return <>
    <PageHeading eyebrow="PAN-028 · EXPERIENCIA DEL AFICIONADO" title="Pronósticos deportivos" subtitle="Elige el resultado de próximos partidos y compite con puntos virtuales. Los puntos no se compran ni se canjean por dinero."><button className="btn btn-light" onClick={() => onView("misPronosticos")}>Mis pronósticos →</button></PageHeading>
    <section className="prediction-banner"><div className="prediction-mark">⚽</div><div><span className="eyebrow">LIGA DE PRONÓSTICOS · SERIE A</span><h2>Tu saldo virtual <strong>{balance.toLocaleString("es-EC")} pts</strong></h2><p>Saldo de demostración recreativa. No representa dinero, no admite depósitos, retiros ni premios canjeables.</p></div><button className="btn btn-dark" onClick={() => onView("misPronosticos")}>Ver actividad</button></section>
    {!isLoggedIn && <div className="permission-banner"><span>♙</span><div><strong>Regístrate para guardar tus pronósticos</strong><p>Completa nombre y apodo. Luego podrás usar el saldo inicial de puntos virtuales.</p></div><button className="btn btn-gold" onClick={onLogin}>Crear cuenta</button></div>}
    {isLoggedIn && !profileComplete && <div className="permission-banner"><span>ⓘ</span><div><strong>Completa tu perfil para participar</strong><p>Necesitas guardar tu nombre y apodo antes de enviar un pronóstico.</p></div><button className="btn btn-dark" onClick={() => onView("perfil")}>Completar perfil</button></div>}
    {!databaseConnected && <div className="risk-note eligibility-note"><span>ⓘ</span><p>Estás viendo partidos de muestra. Al conectar la base y cargar próximos encuentros, podrás guardar pronósticos asociados a partidos reales.</p></div>}
    {databaseConnected && games.length > 0 && openGames.length === 0 && <div className="risk-note eligibility-note"><span>◷</span><p>Los partidos programados disponibles pertenecen a fechas pasadas. El organizador debe publicar próximos encuentros para habilitar nuevos pronósticos.</p><button className="text-link" onClick={() => onView("calendario")}>Revisar calendario →</button></div>}
    <div className="prediction-section-title"><div><p className="eyebrow">MERCADO 1X2</p><h2>¿Quién gana?</h2></div><span className="pill">Local · Empate · Visitante</span></div>
    {games.length ? <div className="prediction-list">{games.map((match) => <PredictionCard key={match.id} match={match} clubName={clubName} balance={balance} canPredict={isLoggedIn && profileComplete && databaseConnected && Boolean(match.fecha_hora && new Date(match.fecha_hora).getTime() > Date.now())} onLogin={onLogin} onPlace={onPlace} />)}</div> : <section className="panel empty-state"><span>◷</span><strong>Aún no hay partidos programados</strong><p>Cuando el organizador publique próximos encuentros, aquí aparecerán las opciones de pronóstico.</p></section>}
    <section className="panel leaderboard-panel"><div className="panel-heading"><div><p className="eyebrow">COMUNIDAD · PUNTOS VIRTUALES</p><h2>Ranking de pronósticos</h2></div><span className="pill">Actualiza cada 30 s</span></div>{leaderboard.length ? <ol className="ranking-list">{leaderboard.map((row) => <li key={`${row.posicion}-${row.apodo}`}><span className="ranking-position">{row.posicion}</span><span className="ranking-name">{row.apodo}</span><span className="ranking-record">{row.aciertos}/{row.total_pronosticos} aciertos</span><strong>{row.puntos.toLocaleString("es-EC")} pts</strong></li>)}</ol> : <div className="empty-state compact"><strong>El ranking se mostrará al aplicar la migración de pronósticos</strong><p>Solo publica apodos y puntos virtuales; nunca correos ni nombres de cuenta.</p></div>}</section>
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

function Portal({ clubs, standings, matches, bulletins, clubName, clubShort, loading, onView }: { clubs: Club[]; standings: Standing[]; matches: Match[]; bulletins: Bulletin[]; clubName: (id?: string) => string; clubShort: (id?: string) => string; loading: boolean; onView: (view: View) => void }) {
  const [series, setSeries] = useState("SERIE A");
  const live = matches.find((match) => match.estado === "en_vivo");
  const finishedMatches = matches.filter((match) => match.estado === "finalizado");
  const goalTotal = matches.reduce((total, match) => total + match.goles_local + match.goles_visitante, 0);
  const averageGoals = finishedMatches.length ? (finishedMatches.reduce((total, match) => total + match.goles_local + match.goles_visitante, 0) / finishedMatches.length).toFixed(2) : "—";
  const clubById = (id?: string) => clubs.find((club) => club.id === id);
  return <>
    <div className="portal-hero"><div className="hero-title"><span className="hero-icon">◈</span><div><div className="eyebrow gold-text">LIGAPRO ECUABET · CENTRO OFICIAL</div><h1>Competiciones y resultados</h1><p>Marcadores, calendario y tabla de posiciones oficial.</p></div></div><div className="hero-stats"><div><span>PARTIDOS CARGADOS</span><strong>{matches.length}</strong></div><div><span>GOLES REGISTRADOS</span><strong>{goalTotal}</strong></div><div><span>PROMEDIO / PARTIDO</span><strong>{averageGoals}</strong></div></div></div>
    <div className="portal-toolbar"><div className="segmented"><button className={series === "SERIE A" ? "selected" : ""} onClick={() => setSeries("SERIE A")}>Serie A</button><button className={series === "SERIE B" ? "selected" : ""} onClick={() => setSeries("SERIE B")}>Serie B</button></div><div className="phase-tabs"><button className="selected">Fase 1</button><button onClick={() => onView("fases")}>Fase 2</button><button onClick={() => onView("tabla")}>Tabla acumulada</button></div><button className="btn btn-light" onClick={() => onView("calendario")}>▦ Calendario completo</button></div>
    <section className="section-block"><div className="section-heading"><div><span className="live-dot" /> <h2>Jornada 12 — Programación oficial</h2></div><span className="timezone-label">HORA OFICIAL ECUADOR · UTC−5</span></div><div className="match-grid">{matches.slice(0, 4).map((match) => <article className={`match-card ${match.estado === "en_vivo" ? "is-live" : ""}`} key={match.id}><div className="match-card-top"><span className={match.estado === "en_vivo" ? "match-status live" : "match-status"}>{match.estado === "en_vivo" ? "● EN VIVO" : match.fecha ?? "PROGRAMADO"}</span><span className="match-venue">{match.estadio ?? "Estadio por asignar"}</span></div><div className="match-team"><ClubMark club={clubById(match.local_id)} compact /><strong>{clubName(match.local_id)}</strong><b>{match.estado === "programado" ? "–" : match.goles_local}</b></div><div className="match-team"><ClubMark club={clubById(match.visitante_id)} compact /><strong>{clubName(match.visitante_id)}</strong><b>{match.estado === "programado" ? "–" : match.goles_visitante}</b></div><div className="match-card-foot"><span>{match.fase ?? "Fase 1"}</span><button className="text-link" onClick={() => onView("partido")}>Detalle →</button></div></article>)}</div></section>
    <div className="portal-columns"><section className="panel standings-panel"><div className="panel-heading"><div><p className="eyebrow">CLASIFICACIÓN OFICIAL</p><h2>Tabla de posiciones</h2><p className="muted">Puntos calculados sobre partidos finalizados.</p></div><span className="pill pill-gold">FASE 1</span></div><div className="table-scroll"><table className="data-table standings-table"><thead><tr><th>Pos.</th><th>Club</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>GD</th><th>PTS</th></tr></thead><tbody>{standings.map((row, index) => { const id = row.club_id; const diff = row.gf - row.gc; return <tr key={id ?? index} className={index < 4 ? "qualify" : index >= 14 ? "relegate" : index < 7 ? "sudamericana" : ""}><td><span className="position">{index + 1}</span></td><td><span className="club-cell"><ClubMark club={clubById(id)} compact /><strong>{row.club ?? clubName(id)}</strong></span></td><td>{row.pj}</td><td>{row.pg}</td><td>{row.pe}</td><td>{row.pp}</td><td>{row.gf}</td><td>{row.gc}</td><td className={diff < 0 ? "negative" : ""}>{diff > 0 ? `+${diff}` : diff}</td><td><strong>{row.pts}</strong></td></tr>; })}</tbody></table></div><div className="table-legend"><span><i className="gold-bar" /> 1°–4° Libertadores</span><span><i className="green-bar" /> 5°–7° Sudamericana</span><span><i className="red-bar" /> 15°–16° Descenso</span></div><div className="table-meta">{loading ? "Actualizando datos…" : `${standings.length} clubes · Jornada 12`}<span>Temporada de muestra</span></div></section>
      <aside className="portal-rail"><section className="official-card"><p className="eyebrow gold-text">◉ COMISIÓN DE ARBITRAJE</p><h2>{live ? "Partido en desarrollo" : "Próximos encuentros"}</h2><p>Seguimiento de designaciones y programación de la jornada.</p><div className="official-match"><span>{live ? `${clubShort(live.local_id)} ${live.goles_local} — ${live.goles_visitante} ${clubShort(live.visitante_id)}` : "JORNADA 12"}</span><strong>{live ? "EN VIVO" : "Designaciones pendientes"}</strong></div><button className="btn btn-gold full" onClick={() => onView("vivo")}>Abrir consola de partido</button></section><section className="panel bulletin-card"><div className="panel-heading"><h2>Boletines oficiales</h2><span className="pill">3</span></div><article className="bulletin"><span className="eyebrow">COMUNICADO · COMPETICIONES</span><h3>Programación oficial de la jornada</h3><p className="muted">Consulta horarios, estadios y estado de los encuentros programados.</p><button className="text-link" onClick={() => onView("torneos")}>Ver calendario →</button></article><article className="bulletin"><span className="eyebrow">COMISIÓN DISCIPLINARIA</span><h3>Resoluciones disciplinarias</h3><p className="muted">Revisa las sanciones vigentes de la competencia.</p><button className="text-link" onClick={() => onView("disciplina")}>Consultar resoluciones →</button></article><div className="sponsors"><span>AUSPICIANTES OFICIALES</span><strong>ECUABET　 BANCO PICHINCHA　 CNT</strong></div></section></aside></div>
    <div className="portal-bottom-cards"><section className="panel scorers-card"><div className="panel-heading"><h2>◉ Líderes de goleo</h2><span className="pill pill-dark">Muestra</span></div>{[["Alex Arce", "LDU Quito", "13"], ["Jeison Medina", "SD Aucas", "11"], ["Francisco Fydriszewski", "Barcelona SC", "9"]].map((p, i) => <div className="scorer-row" key={p[0]}><b>{i + 1}</b><span className="avatar">{p[0].split(" ").map((n) => n[0]).join("")}</span><div><strong>{p[0]}</strong><small>{p[1]}</small></div><strong>{p[2]} <small>goles</small></strong></div>)}</section><section className="panel suspension-card"><div className="panel-heading"><h2>⚠ Alertas disciplinarias</h2><span className="pill pill-warn">Seguimiento</span></div>{[["Moisés Ramírez", "Independiente del Valle", "En observación", "warn"], ["Leonai Souza", "Barcelona SC", "En observación", "warn"], ["Facundo Rodríguez", "LDU Quito", "1 fecha", "danger"]].map((r) => <div className="alert-row" key={r[0]}><span className={`alert-marker ${r[3]}`} /><div><strong>{r[0]}</strong><small>{r[1]}</small></div><span className={`pill ${r[3] === "danger" ? "pill-red" : "pill-warn"}`}>{r[2]}</span></div>)}</section></div>
  </>;
}

function TournamentPanel({ clubs, matches, competition, clubName, onCreateCompetition, onCreateMatch, onLogin, canWrite }: { clubs: Club[]; matches: Match[]; competition: Competition | null; clubName: (id?: string) => string; onCreateCompetition: (event: FormEvent<HTMLFormElement>) => void; onCreateMatch: (event: FormEvent<HTMLFormElement>) => void; onLogin: () => void; canWrite: boolean }) {
  const [showCompetition, setShowCompetition] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  return <>
    <PageHeading eyebrow="PAN-002 · DIRECCIÓN DE COMPETICIONES" title="Torneos, fases y calendario" subtitle="Gestiona temporadas, estructura de competencia, clubes afiliados y programación oficial."><button className="btn btn-light" onClick={() => setShowCompetition(!showCompetition)}>＋ Nueva competencia</button><button className="btn btn-gold" onClick={() => setShowMatch(!showMatch)}>▦ Programar partido</button></PageHeading>
    {!canWrite && <div className="permission-banner"><span>◉</span><div><strong>Acceso de consulta</strong><p>Inicia sesión con un perfil autorizado para crear temporadas o programar encuentros.</p></div><button className="btn btn-dark" onClick={onLogin}>Ingresar</button></div>}
    {showCompetition && <section className="panel form-panel"><div className="panel-heading"><h2>Crear competencia</h2><button className="icon-close" onClick={() => setShowCompetition(false)}>×</button></div><form className="inline-form" onSubmit={onCreateCompetition}><label>Nombre<input name="nombre" required placeholder="LigaPro Serie A" /></label><label>Temporada<input name="temporada" type="number" min="2000" max="2100" defaultValue={new Date().getFullYear()} required /></label><label>Serie<select name="serie"><option value="A">Serie A</option><option value="B">Serie B</option></select></label><button className="btn btn-dark">Guardar</button></form></section>}
    {showMatch && <section className="panel form-panel"><div className="panel-heading"><h2>Programar partido</h2><button className="icon-close" onClick={() => setShowMatch(false)}>×</button></div><form className="inline-form match-form" onSubmit={onCreateMatch}><label>Club local<select name="local" required>{clubs.map((club) => <option value={club.id} key={club.id}>{club.nombre}</option>)}</select></label><label>Club visitante<select name="visitante" required>{clubs.map((club) => <option value={club.id} key={club.id}>{club.nombre}</option>)}</select></label><label>Jornada<input name="jornada" type="number" min="1" max="60" defaultValue="1" required /></label><label>Fecha y hora<input name="fecha" type="datetime-local" required /></label><label>Estadio<input name="estadio" placeholder="Estadio del club local" /></label><button className="btn btn-gold">Guardar programación</button></form></section>}
    <section className="metrics-grid four"><Metric label="AVANCE DEL CALENDARIO" value={`${matches.filter((m) => m.estado === "finalizado").length}`} suffix={` / ${matches.length}`} note="Partidos finalizados" icon="▦" /><Metric label="PARTIDOS PROGRAMADOS" value={`${matches.filter((m) => m.estado === "programado").length}`} note="En el calendario visible" icon="◷" /><Metric label="CLUBES AFILIADOS" value={`${clubs.length}`} note="Participantes cargados" icon="♜" /><Metric label="ESTADO COMPETENCIA" value={competition?.estado === "activa" ? "Activa" : "Demo"} note={competition?.nombre ?? "LigaPro Serie A"} icon="◈" />
    </section>
    <section className="regulatory-callout"><span className="callout-icon">◷</span><div><strong>Protocolo de programación</strong><p>Verifica fechas, sedes y disponibilidad antes de publicar el calendario oficial. La simultaneidad de horarios debe configurarse según el reglamento de la competencia.</p></div><span className="pill pill-gold">REGLA CONFIGURABLE</span></section>
    <div className="tournament-layout"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">TEMPORADA {competition?.temporada ?? "2024 · DEMO"}</p><h2>Clubes afiliados</h2></div><span className="pill">{clubs.length} clubes</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>CLUB / ENTIDAD</th><th>ESTADIO PRINCIPAL</th><th>DIVISIÓN</th><th>ESTADO</th></tr></thead><tbody>{clubs.map((club) => <tr key={club.id}><td><span className="club-cell"><ClubMark club={club} compact /><strong>{club.nombre}</strong></span></td><td>{club.estadio ?? "No registrado"}</td><td><span className="pill pill-gold">SERIE A</span></td><td><span className="state-ok">● Habilitado</span></td></tr>)}</tbody></table></div></section><aside className="panel fixture-panel"><div className="panel-heading"><div><p className="eyebrow">TABLERO OPERATIVO</p><h2>Programación</h2></div><span className="pill pill-gold">FASE 1</span></div><div className="fixture-list">{matches.map((match) => <article className="fixture-item" key={match.id}><div className="fixture-date"><span>{match.fecha ?? "Fecha por asignar"}</span><span className={`pill ${match.estado === "en_vivo" ? "pill-red" : ""}`}>{badgeText(match.estado)}</span></div><h3>{clubName(match.local_id)} <small>vs</small> {clubName(match.visitante_id)}</h3><p>{match.estadio ?? "Sede pendiente"} · Jornada {match.jornada}</p></article>)}</div><button className="btn btn-dark full" onClick={() => canWrite ? setShowMatch(true) : onLogin()}>＋ Agregar partido</button></aside></div>
  </>;
}

function Metric({ label, value, suffix, note, icon }: { label: string; value: string; suffix?: string; note: string; icon: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><div className="metric-value">{value}<small>{suffix}</small></div><p>{note}</p></article>;
}

function LineupPanel({ clubs, players, matches, clubName, clubShort, canWrite, onLogin, onNotice }: { clubs: Club[]; players: Player[]; matches: Match[]; clubName: (id?: string) => string; clubShort: (id?: string) => string; canWrite: boolean; onLogin: () => void; onNotice: (message: string) => void }) {
  const match = matches[0];
  const sides = [match?.local_id, match?.visitante_id].filter(Boolean) as string[];
  const rosterFor = (id: string) => players.filter((player) => player.club_id === id);
  const [validated, setValidated] = useState(false);
  function validate() {
    if (!canWrite) { onLogin(); return; }
    const squads = sides.map(rosterFor);
    if (squads.some((squad) => squad.length < 11)) { onNotice("No se puede validar: cada club debe tener al menos 11 jugadores habilitados cargados en Supabase."); setValidated(false); return; }
    if (squads.some((squad) => squad.some((player) => player.estado_comet !== "habilitado"))) { onNotice("Hay jugadores no habilitados. Corrige las observaciones antes de cerrar la planilla."); setValidated(false); return; }
    setValidated(true); onNotice("Validación de nóminas completada. La firma final aún debe registrarse en el acta.");
  }
  return <>
    <PageHeading eyebrow="PAN-003 · VALIDACIÓN DE PLANILLA COMET" title="Planilla oficial del partido" subtitle="Comprueba nóminas y elegibilidad de los jugadores antes de cerrar el acta."><button className="btn btn-light" onClick={() => onNotice("La sincronización COMET se habilita al configurar las credenciales de integración.")}>↻ Sincronizar COMET</button><button className="btn btn-gold" onClick={validate}>✓ Validar nóminas</button></PageHeading>
    {!canWrite && <div className="permission-banner"><span>▣</span><div><strong>Vista de planilla</strong><p>El cierre y la validación final requieren un usuario autorizado de comisaría o LigaPro.</p></div><button className="btn btn-dark" onClick={onLogin}>Ingresar</button></div>}
    <section className="match-banner"><div className="match-banner-title"><span className="eyebrow gold-text">LIGAPRO ECUABET · {match?.fase ?? "FASE 1"}</span><span className="pill pill-live">{match ? badgeText(match.estado).toUpperCase() : "SIN PARTIDO"}</span></div><div className="versus"><div><ClubMark club={clubs.find((c) => c.id === match?.local_id)} /><strong>{clubName(match?.local_id)}</strong><small>CLUB LOCAL</small></div><span>VS</span><div><ClubMark club={clubs.find((c) => c.id === match?.visitante_id)} /><strong>{clubName(match?.visitante_id)}</strong><small>CLUB VISITANTE</small></div></div><div className="match-banner-foot"><span>▦ {match?.estadio ?? "Estadio pendiente"}</span><span>Jornada {match?.jornada ?? "—"}</span><span>Acta digital</span></div></section>
    {validated && <div className="success-banner">✓ Nóminas validadas para el acta. Pendiente de firma digital del delegado.</div>}
    <div className="squad-grid">{sides.map((clubId) => { const roster = rosterFor(clubId); return <section className="panel squad-panel" key={clubId}><div className="panel-heading"><div className="club-cell"><ClubMark club={clubs.find((club) => club.id === clubId)} /><div><h2>{clubName(clubId)}</h2><p className="eyebrow">CLUB · {clubShort(clubId)}</p></div></div><span className={`pill ${roster.length >= 11 ? "pill-green" : "pill-warn"}`}>{roster.length ? `${roster.length} jugadores` : "Sin nómina"}</span></div>{roster.length ? <><div className="roster-summary"><span>Elegibles <strong>{roster.filter((player) => player.estado_comet === "habilitado").length}</strong></span><span>Observados <strong>{roster.filter((player) => player.estado_comet !== "habilitado").length}</strong></span><span>COMET <strong>Validación local</strong></span></div><div className="roster-list">{roster.map((player) => <div className="roster-row" key={player.id}><span className="jersey">{player.dorsal}</span><strong>{player.nombre}</strong><span className="position-chip">{player.posicion}</span><span className={player.estado_comet === "habilitado" ? "pill pill-green" : "pill pill-red"}>{player.estado_comet}</span></div>)}</div></> : <div className="empty-state"><span>▣</span><strong>No hay jugadores cargados</strong><p>Registra la plantilla del club en la base de datos para validar la nómina.</p></div>}</section>; })}</div>
    <section className="panel closing-panel"><div><p className="eyebrow">CIERRE, VALIDACIÓN Y FIRMA DIGITAL</p><h2>Acta COMET</h2><p className="muted">El cierre bloquea la nómina validada y genera el registro oficial del partido.</p></div><div className="closing-status"><span className={`status-dot ${validated ? "green" : "gold"}`} />{validated ? "Nóminas verificadas" : "Pendiente de validación"}</div><button className="btn btn-dark" onClick={() => validated ? onNotice("La firma digital COMET requiere una integración habilitada por LigaPro.") : validate()}>🔒 Firmar y bloquear</button></section>
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
    <PageHeading eyebrow="PAN-004 · CONSOLA DE REGISTRO EN VIVO" title="Consola de arbitraje y comisaría" subtitle="El marcador, el reloj y los eventos se sincronizan desde Supabase para todos los espectadores."><span className="live-connect"><i /> {isLive ? "SINCRONIZADO EN VIVO" : "ACTA DIGITAL"}</span></PageHeading>
    {!canWrite && <div className="permission-banner"><span>◉</span><div><strong>Consola en modo consulta</strong><p>El registro exige un usuario con rol de árbitro, comisario o administrador.</p></div><button className="btn btn-dark" onClick={onLogin}>Ingresar</button></div>}
    <div className="live-match-picker"><label>Partido<select value={match?.id ?? ""} onChange={(event) => onSelectMatch(event.target.value)}>{matches.map((item) => <option key={item.id} value={item.id}>{clubShort(item.local_id)} vs {clubShort(item.visitante_id)} · {badgeText(item.estado)}{item.fecha ? " · " + item.fecha : ""}</option>)}</select></label><span className="muted">Marcador conectado a Supabase Realtime</span></div>
    <section className="live-scoreboard"><div className="score-side"><ClubMark club={clubs.find((club) => club.id === match?.local_id)} /><div><span className="eyebrow gold-text">LOCAL · SERIE A</span><h2>{clubName(match?.local_id)}</h2></div></div><div className="score-center"><div className="period">{isLive && <span className="live-dot" />} {periodLabel(match?.periodo)}</div><div className="score"><strong>{match?.goles_local ?? 0}</strong><span>{clock}</span><strong>{match?.goles_visitante ?? 0}</strong></div><span className="muted">{match ? badgeText(match.estado).toUpperCase() : "SIN PARTIDO ACTIVO"}</span></div><div className="score-side away"><div><span className="eyebrow gold-text">VISITANTE · SERIE A</span><h2>{clubName(match?.visitante_id)}</h2></div><ClubMark club={clubs.find((club) => club.id === match?.visitante_id)} /></div></section>
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
    <div className="discipline-cards"><section className="panel risk-panel"><div className="panel-heading"><div><p className="eyebrow">SEGUIMIENTO</p><h2>Resoluciones recientes</h2></div><span className="pill pill-warn">{pending} pendientes</span></div><p className="muted">Las suspensiones automáticas requieren la confirmación de la regla vigente por temporada.</p><div className="risk-note"><span>ⓘ</span><p>Las reglas sobre acumulación de tarjetas y fechas de suspensión son configurables; no se aplican sin validación reglamentaria.</p></div></section><section className="panel decision-card"><p className="eyebrow gold-text">ACTA DISCIPLINARIA</p><h2>Emisión y notificación</h2><p>Registra el motivo, la cantidad de fechas y el estado de notificación asociado a cada resolución.</p><button className="btn btn-gold" onClick={() => canWrite ? setCreateOpen(true) : onLogin()}>Abrir formulario</button></section></div>
    <section className="panel discipline-ledger"><div className="panel-heading"><div><p className="eyebrow">REGISTRO OFICIAL</p><h2>Libro maestro de sanciones</h2></div><span className="pill">{displayedSanctions.length} resoluciones</span></div><div className="ledger-tools"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="⌕ Buscar jugador, acta o club…" /><select aria-label="Filtrar estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todos los estados</option><option>Pendiente</option><option>Notificada</option><option>Cumplida</option></select><button className="btn btn-light" onClick={() => { setSearch(""); setStatusFilter("Todos los estados"); }}>Limpiar filtros</button></div><div className="table-scroll"><table className="data-table"><thead><tr><th>ACTA / FECHA</th><th>CLUB</th><th>JUGADOR</th><th>INFRACCIÓN</th><th>SANCIÓN</th><th>ESTADO</th></tr></thead><tbody>{displayedSanctions.map((row) => <tr key={row.id}><td><strong>#{row.id}</strong><small>{row.fecha ? new Date(row.fecha).toLocaleDateString("es-EC") : "Temporada demo"}</small></td><td>{row.club}</td><td><strong>{row.jugador}</strong></td><td className="infraction-cell">{row.infraccion}</td><td><span className="pill pill-red">{row.jornadas} {row.jornadas === 1 ? "fecha" : "fechas"}</span></td><td><span className={`pill ${row.estado === "Cumplida" ? "pill-green" : "pill-warn"}`}>{row.estado}</span></td></tr>)}</tbody></table>{displayedSanctions.length === 0 && <div className="empty-state">No hay resoluciones que coincidan con la búsqueda.</div>}</div></section>
  </>;
}

function PublicTablePage({ clubs, standings, clubName, onView }: { clubs: Club[]; standings: Standing[]; clubName: (id?: string) => string; onView: (view: View) => void }) {
  const colorFor = (id?: string) => clubs.find((club) => club.id === id)?.color;
  return <>
    <PageHeading eyebrow="PAN-006 · PORTAL PÚBLICO" title="Tabla de posiciones" subtitle="Clasificación por puntos, diferencia de goles y goles a favor."><button className="btn btn-light" onClick={() => onView("calendario")}>Ver calendario →</button></PageHeading>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">SERIE A · TEMPORADA DEMO 2024</p><h2>Fase 1 · Clasificación general</h2><p className="muted">El orden se calcula sobre los partidos finalizados de la competencia.</p></div><span className="pill pill-gold">ACTUALIZACIÓN EN LÍNEA</span></div><div className="table-scroll"><table className="data-table standings-table expanded-table"><thead><tr><th>Pos.</th><th>Club</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>GD</th><th>PTS</th><th>Últimos 5</th></tr></thead><tbody>{standings.map((row, index) => <tr key={row.club_id ?? index} className={index < 4 ? "qualify" : index >= 14 ? "relegate" : index < 7 ? "sudamericana" : ""}><td>{index + 1}</td><td><span className="club-cell"><span className="club-mark compact" style={{ "--club-color": colorFor(row.club_id) ?? "#cbd1da" } as React.CSSProperties}>{row.sigla ?? "LP"}</span><strong>{row.club ?? clubName(row.club_id)}</strong></span></td><td>{row.pj}</td><td>{row.pg}</td><td>{row.pe}</td><td>{row.pp}</td><td>{row.gf}</td><td>{row.gc}</td><td>{row.gf - row.gc > 0 ? `+${row.gf - row.gc}` : row.gf - row.gc}</td><td><strong>{row.pts}</strong></td><td><span className="form-dots">● ● ◌ ● ◌</span></td></tr>)}</tbody></table></div><div className="table-legend"><span><i className="gold-bar" /> 1°–4° Libertadores</span><span><i className="green-bar" /> 5°–7° Sudamericana</span><span><i className="red-bar" /> 15°–16° Descenso</span></div></section>
  </>;
}

function CalendarPage({ clubs, matches, clubName, onView }: { clubs: Club[]; matches: Match[]; clubName: (id?: string) => string; onView: (view: View) => void }) {
  return <>
    <PageHeading eyebrow="PAN-007 · PORTAL PÚBLICO" title="Calendario de competencia" subtitle="Partidos de la jornada, estadios y horarios oficiales."><button className="btn btn-light" onClick={() => onView("tabla")}>Ver posiciones →</button></PageHeading>
    <section className="calendar-heading panel"><div><p className="eyebrow">SERIE A · FASE 1</p><h2>Jornada 12</h2><p className="muted">Hora oficial de Ecuador · UTC−5</p></div><div className="calendar-switch"><button>‹ Anterior</button><strong>12 / 30</strong><button>Siguiente ›</button></div></section>
    <section className="calendar-list">{matches.map((match) => <button className="calendar-match panel" key={match.id} onClick={() => onView("partido")}><div className="calendar-when"><span className={match.estado === "en_vivo" ? "pill pill-red" : "pill pill-gold"}>{match.fecha ?? "Fecha por confirmar"}</span><span>J{match.jornada}</span></div><div className="calendar-clubs"><span>{clubs.find((club) => club.id === match.local_id)?.sigla ?? "LP"} · {clubName(match.local_id)}</span><strong>{match.estado === "programado" ? "—" : `${match.goles_local}  :  ${match.goles_visitante}`}</strong><span>{clubs.find((club) => club.id === match.visitante_id)?.sigla ?? "LP"} · {clubName(match.visitante_id)}</span></div><div className="calendar-place">▦ {match.estadio ?? "Estadio pendiente"}<span>{badgeText(match.estado)}</span></div></button>)}</section>
  </>;
}

function MatchDetailPage({ clubs, match, clubName, onView }: { clubs: Club[]; match?: Match; clubName: (id?: string) => string; onView: (view: View) => void }) {
  return <>
    <PageHeading eyebrow="PAN-008 · DETALLE DE PARTIDO" title="Ficha del encuentro" subtitle="Marcador, estado y datos oficiales del partido."><button className="btn btn-light" onClick={() => onView("calendario")}>← Volver al calendario</button><button className="btn btn-dark" onClick={() => onView("vivo")}>Abrir consola</button></PageHeading>
    <section className="match-detail-score panel"><div className="match-detail-phase"><span className="pill pill-gold">LIGAPRO ECUABET · FASE 1</span><span className="pill">JORNADA {match?.jornada ?? "—"}</span><span className={match?.estado === "en_vivo" ? "pill pill-live" : "pill"}>{badgeText(match?.estado)}</span></div><div className="detail-scoreline"><div><span className="club-mark" style={{ "--club-color": clubs.find((c) => c.id === match?.local_id)?.color } as React.CSSProperties}>{clubs.find((c) => c.id === match?.local_id)?.sigla}</span><h2>{clubName(match?.local_id)}</h2><small>LOCAL</small></div><strong>{match?.goles_local ?? "—"}<i>:</i>{match?.goles_visitante ?? "—"}</strong><div><span className="club-mark" style={{ "--club-color": clubs.find((c) => c.id === match?.visitante_id)?.color } as React.CSSProperties}>{clubs.find((c) => c.id === match?.visitante_id)?.sigla}</span><h2>{clubName(match?.visitante_id)}</h2><small>VISITANTE</small></div></div><div className="detail-meta"><span>◷ {match?.fecha ?? "Fecha por confirmar"}</span><span>▦ {match?.estadio ?? "Estadio pendiente"}</span><span>Acta oficial digital</span></div></section>
    <div className="detail-grid"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">ACTA DEL ENCUENTRO</p><h2>Resumen del partido</h2></div><span className="pill">Información pública</span></div><div className="empty-state"><span>◷</span><strong>Eventos publicados</strong><p>La cronología oficial se mostrará cuando el equipo arbitral registre las incidencias.</p></div></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">DATOS DEL PARTIDO</p><h2>Información oficial</h2></div></div><dl className="info-list"><div><dt>Competencia</dt><dd>LigaPro Serie A · 2024 (demo)</dd></div><div><dt>Fase</dt><dd>{match?.fase ?? "Fase 1"}</dd></div><div><dt>Jornada</dt><dd>{match?.jornada ?? "—"}</dd></div><div><dt>Estadio</dt><dd>{match?.estadio ?? "Pendiente"}</dd></div></dl></section></div>
  </>;
}

function ClubDirectoryPage({ clubs, onView }: { clubs: Club[]; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-009 · PORTAL PÚBLICO" title="Clubes participantes" subtitle="Directorio de clubes afiliados a la competencia."><span className="pill pill-gold">{clubs.length} clubes</span></PageHeading><div className="club-directory">{clubs.map((club) => <button className="club-directory-card panel" key={club.id} onClick={() => onView("club")}><span className="club-mark" style={{ "--club-color": club.color } as React.CSSProperties}>{club.sigla}</span><div><h2>{club.nombre}</h2><p>{club.estadio ?? "Estadio por registrar"}</p></div><span className="pill">SERIE A</span><b>→</b></button>)}</div></>;
}

function ClubProfilePage({ clubs, matches, clubName, onView }: { clubs: Club[]; matches: Match[]; clubName: (id?: string) => string; onView: (view: View) => void }) {
  const [clubId, setClubId] = useState(clubs[0]?.id ?? "");
  const club = clubs.find((item) => item.id === clubId) ?? clubs[0];
  const upcoming = matches.filter((match) => match.local_id === club?.id || match.visitante_id === club?.id);
  return <><PageHeading eyebrow="PAN-010 · FICHA PÚBLICA DE CLUB" title="Perfil del club" subtitle="Datos generales, sede y próximos encuentros."><label className="select-inline">Seleccionar club<select value={club?.id ?? ""} onChange={(event) => setClubId(event.target.value)}>{clubs.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><button className="btn btn-light" onClick={() => onView("clubes")}>← Directorio</button></PageHeading><section className="club-profile-hero panel"><span className="club-mark big" style={{ "--club-color": club?.color } as React.CSSProperties}>{club?.sigla}</span><div><span className="eyebrow">CLUB AFILIADO · SERIE A</span><h2>{club?.nombre}</h2><p>▦ {club?.estadio ?? "Estadio pendiente"}</p></div><span className="pill pill-green">Competencia activa</span></section><div className="metrics-grid four"><Metric label="PARTIDOS CARGADOS" value={`${upcoming.length}`} note="En esta jornada" icon="◷" /><Metric label="DIVISIÓN" value="Serie A" note="Temporada de muestra" icon="♜" /><Metric label="ESTADIO" value="Registrado" note={club?.estadio ?? "Pendiente"} icon="▦" /><Metric label="ESTADO" value="Afiliado" note="Ficha pública" icon="✓" /></div><section className="panel"><div className="panel-heading"><h2>Próximos partidos</h2></div>{upcoming.length ? upcoming.map((match) => <div className="fixture-item profile-fixture" key={match.id}><div><strong>{clubName(match.local_id)} vs {clubName(match.visitante_id)}</strong><p>{match.fecha ?? "Fecha pendiente"} · {match.estadio}</p></div><span className="pill">{badgeText(match.estado)}</span></div>) : <div className="empty-state">No hay partidos programados para esta jornada.</div>}</section></>;
}

function StatisticsPage({ clubs, standings, onView }: { clubs: Club[]; standings: Standing[]; onView: (view: View) => void }) {
  const top = [...standings].sort((a, b) => b.gf - a.gf).slice(0, 5);
  return <><PageHeading eyebrow="PAN-011 · ESTADÍSTICAS" title="Estadísticas de competencia" subtitle="Resumen estadístico calculado con los partidos y resultados registrados."><button className="btn btn-light" onClick={() => onView("tabla")}>Ver tabla →</button></PageHeading><div className="metrics-grid four"><Metric label="CLUBES" value={`${clubs.length}`} note="En la clasificación" icon="♜" /><Metric label="GOLES REGISTRADOS" value={`${standings.reduce((sum, row) => sum + row.gf, 0)}`} note="Datos de la fase" icon="⚽" /><Metric label="PARTIDOS JUGADOS" value={`${standings.reduce((sum, row) => sum + row.pj, 0) / 2}`} note="Suma de apariciones / 2" icon="◷" /><Metric label="LÍDER EN GOLES" value={top[0]?.club ?? "—"} note={`${top[0]?.gf ?? 0} goles anotados`} icon="↗" /></div><section className="panel"><div className="panel-heading"><div><p className="eyebrow">ATAQUE</p><h2>Goles a favor por club</h2></div><span className="pill">Top 5</span></div><div className="bar-chart">{top.map((row, index) => <div className="bar-row" key={row.club_id ?? index}><strong>{row.club ?? clubs.find((c) => c.id === row.club_id)?.nombre}</strong><div><i style={{ width: `${Math.max(8, row.gf / (top[0]?.gf || 1) * 100)}%` }} /></div><b>{row.gf}</b></div>)}</div></section></>;
}

function BulletinsPage({ onView }: { onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-012 · COMUNICACIÓN OFICIAL" title="Boletines y comunicados" subtitle="Publicaciones relacionadas con la programación y las resoluciones de la competencia."><button className="btn btn-light" onClick={() => onView("sanciones")}>Ver resoluciones →</button></PageHeading><div className="bulletin-grid">{[["PROGRAMACIÓN", "Calendario oficial de la jornada", "Horarios y sedes de los encuentros registrados para la fase."], ["COMPETICIONES", "Información de temporadas y fases", "Consulta el estado de cada competencia y sus jornadas."], ["DISCIPLINA", "Resoluciones de la Comisión Disciplinaria", "Sanciones registradas y estados de notificación."], ["COMET", "Actas y validación de nóminas", "Información sobre la gestión digital de las actas de partido."]].map((row) => <article className="panel bulletin-tile" key={row[0]}><span className="eyebrow">{row[0]} · OFICIAL</span><h2>{row[1]}</h2><p className="muted">{row[2]}</p><button className="text-link" onClick={() => onView(row[0] === "DISCIPLINA" ? "sanciones" : row[0] === "PROGRAMACIÓN" ? "calendario" : "torneos")}>Consultar →</button></article>)}</div></>;
}

function CompetitionListPage({ competition, onView }: { competition: Competition | null; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-013 · TEMPORADAS" title="Temporadas y competencias" subtitle="Administra el ciclo anual y el estado de cada división."><button className="btn btn-gold" onClick={() => onView("competencia")}>＋ Nueva competencia</button></PageHeading><section className="panel"><div className="panel-heading"><div><p className="eyebrow">REGISTRO DE COMPETENCIAS</p><h2>Temporadas configuradas</h2></div><span className="pill">1 registro de demostración</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>COMPETENCIA</th><th>TEMPORADA</th><th>SERIE</th><th>FORMATO</th><th>ESTADO</th><th>ACCIÓN</th></tr></thead><tbody><tr><td><strong>{competition?.nombre ?? "DEMO · LigaPro Ecuador Serie A"}</strong></td><td>{competition?.temporada ?? 2024}</td><td>Serie {competition?.serie ?? "A"}</td><td>Fase clasificatoria</td><td><span className="pill pill-gold">{competition?.estado ?? "demo"}</span></td><td><button className="text-link" onClick={() => onView("fases")}>Gestionar fases →</button></td></tr></tbody></table></div></section></>;
}

function CompetitionFormPage({ onCreate, canWrite, onLogin }: { onCreate: (event: FormEvent<HTMLFormElement>) => void; canWrite: boolean; onLogin: () => void }) {
  return <><PageHeading eyebrow="PAN-014 · FORMULARIO DE COMPETENCIA" title="Crear competencia" subtitle="Define la temporada, división y formato inicial de la competencia."/><section className="panel form-panel large-form"><div className="panel-heading"><div><p className="eyebrow">DATOS GENERALES</p><h2>Nueva competencia</h2></div><span className="pill pill-gold">Borrador</span></div><form className="screen-form" onSubmit={onCreate}><label>Nombre de competencia<input name="nombre" required placeholder="LigaPro Serie A"/></label><label>Temporada<input name="temporada" type="number" min="2000" max="2100" defaultValue={new Date().getFullYear()} required/></label><label>División<select name="serie"><option value="A">Serie A</option><option value="B">Serie B</option></select></label><label>Formato inicial<select name="formato"><option value="fase_clasificatoria">Fase clasificatoria</option><option value="todos_contra_todos">Todos contra todos</option></select></label><div className="form-actions"><p className="muted">El registro se crea como borrador; agrega las fases y clubes antes de activarlo.</p>{canWrite ? <button className="btn btn-gold">Crear borrador</button> : <button type="button" className="btn btn-dark" onClick={onLogin}>Ingresar para continuar</button>}</div></form></section></>;
}

function PhasesPage({ competition, onView }: { competition: Competition | null; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-015 · ESTRUCTURA DE COMPETENCIA" title="Fases y jornadas" subtitle={`Estructura para ${competition?.nombre ?? "la competencia seleccionada"}.`}><button className="btn btn-light" onClick={() => onView("temporadas")}>← Temporadas</button><button className="btn btn-dark" onClick={() => onView("programacion")}>Programar jornada →</button></PageHeading><div className="phase-card-grid">{[["01", "Fase 1", "Clasificatoria", "15 jornadas", "Activa"], ["02", "Fase 2", "Clasificatoria", "15 jornadas", "Borrador"], ["03", "Final", "Definición", "2 partidos", "Borrador"]].map((row) => <article className="panel phase-card" key={row[0]}><span className="phase-number">{row[0]}</span><span className="pill pill-gold">{row[4]}</span><p className="eyebrow">{row[2]}</p><h2>{row[1]}</h2><p className="muted">{row[3]} configuradas</p><button className="text-link" onClick={() => onView("programacion")}>Ver programación →</button></article>)}</div><section className="regulatory-callout"><span className="callout-icon">ⓘ</span><div><strong>Reglas del formato</strong><p>Configura el número de jornadas y criterios de clasificación según el reglamento aprobado para la temporada.</p></div><span className="pill">POR TEMPORADA</span></section></>;
}

function ClubManagementPage({ clubs, onView }: { clubs: Club[]; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-016 · AFILIACIÓN DE CLUBES" title="Control de clubes afiliados" subtitle="Consulta sedes, estados y datos de los clubes participantes."><button className="btn btn-light" onClick={() => onView("clubAdmin")}>Detalle de club →</button></PageHeading><section className="panel"><div className="panel-heading"><div><p className="eyebrow">SERIE A</p><h2>Clubes registrados</h2></div><span className="pill pill-green">{clubs.length} habilitados</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>CLUB</th><th>SIGLA</th><th>ESTADIO</th><th>FAIR PLAY</th><th>ESTADO</th><th></th></tr></thead><tbody>{clubs.map((club) => <tr key={club.id}><td><span className="club-cell"><ClubMark club={club} compact/><strong>{club.nombre}</strong></span></td><td>{club.sigla}</td><td>{club.estadio ?? "Pendiente"}</td><td><span className="pill pill-green">Verificado</span></td><td><span className="state-ok">● Activo</span></td><td><button className="text-link" onClick={() => onView("clubAdmin")}>Abrir →</button></td></tr>)}</tbody></table></div></section></>;
}

function AdminClubDetailPage({ clubs, onView }: { clubs: Club[]; onView: (view: View) => void }) {
  const club = clubs[0];
  return <><PageHeading eyebrow="PAN-017 · EXPEDIENTE DE CLUB" title="Ficha administrativa de club" subtitle="Documentos, estadio y estado de habilitación del club."><button className="btn btn-light" onClick={() => onView("clubesAdmin")}>← Clubes afiliados</button></PageHeading><section className="club-profile-hero panel"><ClubMark club={club}/><div><span className="eyebrow">EXPEDIENTE · SERIE A</span><h2>{club?.nombre}</h2><p>{club?.estadio}</p></div><span className="pill pill-green">HABILITADO</span></section><div className="metrics-grid four"><Metric label="REPRESENTANTE LEGAL" value="Registrado" note="Validación documental" icon="▤"/><Metric label="FAIR PLAY FINANCIERO" value="Al día" note="Evidencia cargada" icon="$"/><Metric label="ESTADIO" value="Homologado" note={club?.estadio ?? "Sede"} icon="▦"/><Metric label="COMET" value="Conectado" note="Código de club" icon="✓"/></div><div className="detail-grid"><section className="panel"><div className="panel-heading"><h2>Documentación de cumplimiento</h2><span className="pill pill-green">4 verificaciones</span></div>{["Registro legal", "Fair Play financiero", "Indumentaria homologada", "Licencia de competición"].map((item) => <div className="check-row" key={item}><span className="state-ok">✓</span><strong>{item}</strong><span className="pill pill-green">Verificado</span></div>)}</section><section className="panel"><div className="panel-heading"><h2>Datos de sede</h2></div><dl className="info-list"><div><dt>Estadio principal</dt><dd>{club?.estadio}</dd></div><div><dt>Serie</dt><dd>A · Primera categoría</dd></div><div><dt>Documentos pendientes</dt><dd>0</dd></div></dl></section></div></>;
}

function FixtureManagementPage({ clubs, matches, clubName, onCreate, canWrite, onLogin }: { clubs: Club[]; matches: Match[]; clubName: (id?: string) => string; onCreate: (event: FormEvent<HTMLFormElement>) => void; canWrite: boolean; onLogin: () => void }) {
  return <><PageHeading eyebrow="PAN-018 · CALENDARIO ADMINISTRATIVO" title="Programación de partidos" subtitle="Crea encuentros y administra la fecha, sede y jornada asignadas."><button className="btn btn-gold" onClick={() => canWrite ? document.getElementById("fixture-form")?.scrollIntoView({ behavior: "smooth" }) : onLogin()}>＋ Programar partido</button></PageHeading><section className="panel form-panel" id="fixture-form"><div className="panel-heading"><h2>Nuevo encuentro</h2><span className="pill">Datos obligatorios</span></div><form className="screen-form" onSubmit={onCreate}><label>Club local<select name="local">{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label><label>Club visitante<select name="visitante">{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label><label>Jornada<input name="jornada" type="number" min="1" defaultValue="1"/></label><label>Fecha y hora<input name="fecha" type="datetime-local" required/></label><label>Estadio<input name="estadio" placeholder="Estadio principal"/></label><div className="form-actions"><span className="muted">Se guardará en la competencia activa.</span>{canWrite ? <button className="btn btn-gold">Guardar programación</button> : <button type="button" className="btn btn-dark" onClick={onLogin}>Ingresar</button>}</div></form></section><section className="panel"><div className="panel-heading"><h2>Calendario de la jornada</h2><span className="pill">{matches.length} partidos</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>JORNADA</th><th>FECHA</th><th>LOCAL</th><th>VISITANTE</th><th>ESTADIO</th><th>ESTADO</th></tr></thead><tbody>{matches.map((match) => <tr key={match.id}><td>J{match.jornada}</td><td>{match.fecha ?? "Por programar"}</td><td>{clubName(match.local_id)}</td><td>{clubName(match.visitante_id)}</td><td>{match.estadio}</td><td><span className="pill">{badgeText(match.estado)}</span></td></tr>)}</tbody></table></div></section></>;
}

function DesignationPage({ matches, clubName, canWrite, onLogin, onNotice }: { matches: Match[]; clubName: (id?: string) => string; canWrite: boolean; onLogin: () => void; onNotice: (message: string) => void }) {
  return <><PageHeading eyebrow="PAN-019 · COMISIÓN DE ARBITRAJE" title="Designaciones arbitrales" subtitle="Asigna árbitro y comisario a los encuentros de la jornada."><button className="btn btn-light" onClick={() => onNotice("La designación se guardará al conectar los perfiles habilitados de comisarios y árbitros.")}>Ver criterios</button></PageHeading>{!canWrite && <div className="permission-banner"><span>⚖</span><div><strong>Consulta de designaciones</strong><p>Para asignar oficiales se requiere un usuario organizador o administrador.</p></div><button className="btn btn-dark" onClick={onLogin}>Ingresar</button></div>}<section className="panel"><div className="panel-heading"><div><p className="eyebrow">JORNADA 12 · SERIE A</p><h2>Partidos y oficiales designados</h2></div><span className="pill pill-gold">COMISIÓN NACIONAL</span></div>{matches.map((match) => <div className="designation-row" key={match.id}><div><strong>{clubName(match.local_id)} vs {clubName(match.visitante_id)}</strong><small>{match.fecha ?? "Fecha por asignar"} · {match.estadio ?? "Sede pendiente"}</small></div><div><span>Árbitro central</span><strong>Sin asignar</strong></div><div><span>Comisario</span><strong>Sin asignar</strong></div><button className="btn btn-light" onClick={() => canWrite ? onNotice("Selecciona un perfil de árbitro/comisario habilitado en el panel de administración.") : onLogin()}>Asignar</button></div>)}</section></>;
}

function LineupSelectorPage({ matches, clubName, onView }: { matches: Match[]; clubName: (id?: string) => string; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-020 · SELECCIÓN DE PARTIDO" title="Planillas pendientes de validar" subtitle="Elige un encuentro para revisar sus nóminas y habilitación COMET."><span className="pill pill-gold">COMET · CONSULTA</span></PageHeading><div className="selection-list">{matches.map((match) => <article className="panel selection-card" key={match.id}><div><span className="eyebrow">JORNADA {match.jornada} · {match.fase ?? "FASE 1"}</span><h2>{clubName(match.local_id)} <small>vs</small> {clubName(match.visitante_id)}</h2><p>{match.fecha ?? "Fecha por confirmar"} · {match.estadio ?? "Estadio pendiente"}</p></div><span className={`pill ${match.estado === "en_vivo" ? "pill-live" : "pill-warn"}`}>{match.estado === "finalizado" ? "Acta cerrada" : "Pendiente de revisión"}</span><button className="btn btn-dark" onClick={() => onView("planilla")}>Revisar planilla →</button></article>)}</div></>;
}

function PlayerEligibilityPage({ clubs, players, onView }: { clubs: Club[]; players: Player[]; onView: (view: View) => void }) {
  return <><PageHeading eyebrow="PAN-021 · REGISTRO COMET" title="Elegibilidad de jugadores" subtitle="Revisa la habilitación federativa antes de validar cada nómina."><button className="btn btn-light" onClick={() => onView("planillas")}>← Partidos</button><span className="pill">{players.length} jugadores</span></PageHeading><section className="panel"><div className="panel-heading"><div><p className="eyebrow">ESTADO COMET</p><h2>Registro de jugadores</h2></div><span className="pill pill-warn">Validación requerida</span></div>{players.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>DORSAL</th><th>JUGADOR</th><th>CLUB</th><th>POSICIÓN</th><th>COMET</th></tr></thead><tbody>{players.map((player) => <tr key={player.id}><td>{player.dorsal}</td><td><strong>{player.nombre}</strong></td><td>{clubs.find((club) => club.id === player.club_id)?.nombre}</td><td>{player.posicion}</td><td><span className={player.estado_comet === "habilitado" ? "pill pill-green" : "pill pill-warn"}>{player.estado_comet}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><span>♟</span><strong>No hay jugadores cargados</strong><p>La elegibilidad se muestra cuando la entidad registra plantillas en Supabase.</p></div>}</section><section className="risk-note eligibility-note"><span>ⓘ</span><p>La conexión automatizada con COMET no está incluida sin credenciales y autorización de integración. Este panel usa el estado local guardado en SIGEC-LP.</p></section></>;
}

function ActaPage({ match, clubName, onNotice }: { match?: Match; clubName: (id?: string) => string; onNotice: (message: string) => void }) {
  return <><PageHeading eyebrow="PAN-022 · ACTA DIGITAL" title="Revisión y cierre de acta" subtitle="Comprueba los datos del encuentro antes de completar la firma oficial."><span className="pill pill-warn">Pendiente de firma</span></PageHeading><section className="panel acta-document"><div className="acta-title"><div className="brand-crest">LP</div><div><span className="eyebrow">LIGAPRO ECUADOR · TEMPORADA DEMO</span><h2>Acta oficial del partido</h2><p>{clubName(match?.local_id)} vs {clubName(match?.visitante_id)}</p></div><span className="pill">#{match?.id.slice(0, 8) ?? "ACTA"}</span></div><div className="acta-checks">{["Nóminas y elegibilidad revisadas", "Marcador y eventos conciliados", "Identificación de sede y jornada", "Firma de delegado y comisario"].map((item, index) => <div key={item}><span className={index < 2 ? "check-ready" : "check-pending"}>{index < 2 ? "✓" : "○"}</span><span>{item}</span><small>{index < 2 ? "Revisado" : "Pendiente"}</small></div>)}</div><div className="acta-warning">La firma digital, el hash documental y el envío a COMET requieren credenciales y una integración autorizada.</div><div className="form-actions"><span className="muted">El acta se encuentra en borrador.</span><button className="btn btn-light" onClick={() => onNotice("La descarga del PDF estará disponible al activar la función de generación de actas.")}>Descargar borrador</button><button className="btn btn-gold" onClick={() => onNotice("La firma oficial necesita la integración COMET autorizada.")}>Firmar y bloquear</button></div></section></>;
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
  return <><PageHeading eyebrow="PAN-012 · COMUNICACIÓN OFICIAL" title="Boletines y comunicados" subtitle="Publicaciones relacionadas con la programación y las resoluciones de la competencia."><button className="btn btn-light" onClick={() => onView("sanciones")}>Ver resoluciones →</button></PageHeading><div className="bulletin-grid">{bulletins.map((item) => <article className="panel bulletin-tile" key={item.id}><span className="eyebrow">{item.categoria.toUpperCase()} · OFICIAL</span><h2>{item.titulo}</h2><p className="muted">{item.resumen}</p><span className="bulletin-date">{item.publicado_at ? new Date(item.publicado_at).toLocaleDateString("es-EC") : "Contenido de muestra"}</span><button className="text-link" onClick={() => onView(item.categoria.toLowerCase().includes("discip") ? "sanciones" : item.categoria.toLowerCase().includes("program") ? "calendario" : "torneos")}>Consultar →</button></article>)}</div>{bulletins.length === 0 && <section className="panel empty-state">No hay comunicados publicados.</section>}</>;
}

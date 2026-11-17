# SIGEC-LP — Gestión de Competiciones LigaPro

Aplicación web en español basada en las pantallas Stitch entregadas. Incluye 30 vistas navegables organizadas en seis módulos: portal público, experiencia del aficionado, torneos, planillas, consola en vivo y disciplina.

El módulo del aficionado incluye registro con nombre y apodo, edición del perfil, club favorito, pronósticos 1X2 y un historial con saldo de puntos virtuales. Los puntos no se compran, no se retiran y no tienen equivalencia ni premios en dinero; las cuotas son ilustrativas.

> Las capturas y filas iniciales con temporada 2024 son material de demostración. Sustituye los datos de muestra y confirma el reglamento antes de usar información oficial.

## Requisitos

- Node.js 24 (o versión compatible con Next.js 16)
- pnpm 11 (el proyecto incluye `pnpm-lock.yaml`)
- Proyecto Supabase con Auth, PostgreSQL y Realtime

## Desarrollo local

```powershell
pnpm install
pnpm dev
```

Abre `http://localhost:3000`.

## Configurar Supabase

1. Copia `.env.example` a `.env.local` y define `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `.env.local` está excluido de Git.
2. En Supabase → SQL Editor, ejecuta `supabase/schema.sql`. Para una base que ya tiene el esquema inicial, aplica la migración más reciente de `supabase/migrations/`.
3. Crea la primera cuenta institucional en Supabase Auth. La app asigna rol `publico` por defecto.
4. Desde SQL Editor, promueve solo la cuenta administradora acordada:

```sql
update public.perfiles
set rol = 'administrador'
where id = (select id from auth.users where email = 'admin@tu-dominio.ec');
```

5. Para operación real, asigna perfiles de organizador, comisario, árbitro, disciplina y club; asigna árbitros/comisarios a cada partido.

La clave publishable es pública y está pensada para el navegador. Nunca añadas una clave `service_role` al cliente, a `NEXT_PUBLIC_*` o al repositorio. RLS controla cada escritura.

## Netlify

El proyecto incluye `netlify.toml`; el build es `pnpm build`. Netlify detecta Next.js y aplica su adaptador para Next.js. Configura en Netlify `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con los valores del entorno de Supabase elegido; `.env.local` nunca se versiona. Cuando el dominio público esté disponible, agrégalo a las URL permitidas de Supabase Auth.

Para conectar un repositorio Git existente, vincúlalo al proyecto Netlify con `netlify init` (o desde Netlify → Add new project → Import an existing project). Una vez conectado, cada push a la rama de producción dispara un build y un despliegue.

## Estructura

```text
app/                 Interfaz, pantallas y estilos
utils/supabase/      Clientes Supabase para browser y servidor
proxy.ts             Refresco de sesión Supabase
supabase/schema.sql  Tablas, vista, trigger, RLS, Storage y datos demo
design-reference/    Capturas, HTML y DESIGN.md del ZIP de Stitch
SRS_SIGEC-LP_Gestion_Competiciones_LigaPro.md
```

## Estado de integraciones

La lectura/escritura directa a Supabase está preparada con Auth y RLS. COMET/FEF, firma digital, publicación PDF, correo y vídeo/VAR requieren API, credenciales y autorización institucional; la interfaz los marca como integraciones pendientes y no simula su confirmación.

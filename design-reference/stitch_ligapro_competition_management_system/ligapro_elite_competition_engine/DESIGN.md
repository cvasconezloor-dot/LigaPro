---
name: LigaPro Elite Competition Engine
colors:
  surface: '#f8f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f6'
  surface-container: '#edeef0'
  surface-container-high: '#e7e8ea'
  surface-container-highest: '#e1e2e4'
  on-surface: '#191c1e'
  on-surface-variant: '#44474d'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f3'
  outline: '#75777e'
  outline-variant: '#c5c6ce'
  surface-tint: '#4f5e7f'
  primary: '#00030f'
  on-primary: '#ffffff'
  primary-container: '#0b1d3a'
  on-primary-container: '#7585a8'
  inverse-primary: '#b6c7ec'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fed65b'
  on-secondary-container: '#745c00'
  tertiary: '#000502'
  on-tertiary: '#ffffff'
  tertiary-container: '#002315'
  on-tertiary-container: '#009869'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#b6c7ec'
  on-primary-fixed: '#091b38'
  on-primary-fixed-variant: '#374766'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e1e2e4'
typography:
  display-score:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 52px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  table-data:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  label-xs:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.06em
  timer-display:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system establishes an elite sporting and corporate operating system tailored for administrative precision, regulatory governance, and high-density match management. Built specifically for competition delegates, referees, technical directors, and operational staff managing matches under the official competition handbook, the interface reconciles the prestige of premier championship football with the rigor of enterprise compliance software.

The aesthetic fuses **Corporate High-Precision** with **Modern Elite Athleticism**:
- **Authority & Heritage:** Deep navy anchors institutional integrity, conveying solemn regulatory weight and legal-grade certainty across official minutes (*actas de juego*), COMET validations, and disciplinary logs.
- **Trophy Prestige:** Controlled metallic gold accents highlight qualification thresholds, official seals, match trophies, and championship milestones without degrading into decorative kitsch.
- **Tactical Speed & Ergonomics:** High visual density, crisp borders, compact tabular architecture, and fast-trigger tactical actions allow match commissaries and VAR/refereeing operators to log match incidents with zero cognitive friction.

## Colors

The palette balances institutional prestige, legal compliance, and high-urgency refereeing alerts:

- **Primary Canvas & Authority (`#0B1D3A`):** The definitive ground for dark-mode command modules, headers, and primary administrative actions.
- **Championship Gold (`#D4AF37`):** Reserved for elite qualification tiers (Copa Libertadores slots), active title phases, trophy branding, and prominent active tabs.
- **Institutional Backgrounds:** Clean porcelain (`#F4F5F7`) for high-legibility desktop data sheets and deep pitch navy (`#0F172A`) for live match monitoring consoles.

### Regulatory & Semantic Mapping
- **International Tournaments:** `#D4AF37` (Libertadores direct and preliminary stages) and `#10B981` (Copa Sudamericana placement).
- **Relegation Zone (Puestos 15° y 16°):** `#EF4444` indicator flags, subtle soft red background strips (`#FEF2F2`), and bold warning text.
- **Disciplinary Escalation:**
  - *Warning Threshold (4ª tarjeta amarilla):* Amber alert (`#F59E0B`) indicating impending suspension risk.
  - *Sanction / Expulsion (5ª tarjeta amarilla o Roja directa):* Crimson red (`#DC2626`).
- **COMET & Economic Fair Play Status:**
  - *Habilitado / Validado:* `#16A34A`
  - *En Observación / Pendiente:* `#EAB308`
  - *Bloqueado / No Elegible:* `#DC2626`

## Typography

Inter serves as the unified typographic engine across all contexts. Its neutral grotesk anatomy and exceptional vertical metrics provide flawless numerical alignment in data-intensive environments:

- **Tabular Figures:** All numeric data points (minute marks, points, goal difference, jersey numbers, and COMET IDs) must use OpenType tabular numbers (`font-feature-settings: "tnum" 1, "cv05" 1`) to eliminate visual horizontal jitter.
- **Labels and Badges:** Uppercase styling combined with generous letter spacing is strictly applied to status pills, field positions, and stage indicators to ensure immediate recognition at a glance.
- **Scores & Clocks:** High-weight, slightly condensed numeric presentations (`display-score` and `timer-display`) retain extreme visibility even on pitch-side tablets under full sunlight.

## Layout & Spacing

The layout is built upon an adaptive 12-column grid structured for operational control desks:

- **Desktop (>= 1280px):** 12-column fluid grid with `1.5rem` gutters and `2rem` screen margins. Supports multi-pane interfaces: Navigation (Fixed 240px), Main Tactical Data (7-8 columns), and Incident Command/COMET Stream (4-5 columns).
- **Tablet / Touch Terminal (768px - 1279px):** 8-column layout with `1rem` gutters. Match commissaries benefit from split touch panes: Pitch Lineup on the left, Event Trigger pad on the right.
- **Mobile (< 768px):** 4-column layout with `1rem` margins. Tables collapse into segmented swipeable cards or horizontal scrolling tables with sticky key columns (Team name / Position).
- **Density Control:** Data density is intentionally high. Table rows are constrained to 36px–40px heights to display 16 teams simultaneously without vertical scrolling on typical 1080p monitors.

## Elevation & Depth

Visual hierarchy uses crisp, structured separation rather than diffuse drop shadows. This preserves contrast under varied lighting conditions and maintains a professional sports-corporate aesthetic:

- **Base Layer (Level 0):** Canvas background `#F4F5F7` (Light Mode) or `#0F172A` (Match Control Dark Mode).
- **Card & Sheet Layer (Level 1):** Solid `#FFFFFF` or `#1E293B` containers bound by a structural 1px border (`#E2E8F0` / `#334155`). No shadow is cast in analytical views.
- **Elevated Modals & Match Action Sheets (Level 2):** Applied to fast-incident logging drawers and confirmation prompts. Uses a clean, tinted ambient shadow: `0 8px 24px -4px rgba(11, 29, 58, 0.12), 0 2px 6px -1px rgba(11, 29, 58, 0.08)`.
- **Top Bar & Active Sticky Panels:** Flat surface with a bottom border accent, using a subtle 2px gold indicator (`#D4AF37`) underneath active competition tabs.

## Shapes

The interface embraces a disciplined **Soft (`0.25rem` / `4px`)** shape language, communicating technical rigor, data density, and organizational strength:

- **Inputs, Buttons, and Cards:** Default to `4px` corner radii (`rounded`). This minimizes wasted white space at grid corners, allowing compact data arrangement.
- **Status Badges & Pills:** Maintain a higher curvature (`rounded-lg` / `8px` or full rounded capsules for jersey numbers only) to visually distinguish immutable status labels from interactive buttons.
- **Zone Indication Borders:** Competition qualification bars (Libertadores, Sudamericana, Descenso) use strict `0px` outer left accent strokes (3px width) directly integrated into table cells.

## Components

### 1. Classification Standings Table
- **Row Heights:** 38px fixed height for desktop.
- **Position Indicators:** Left-hand 3px indicator strip:
  - 1° - 4° (Libertadores): Solid `#D4AF37` accent line.
  - 5° - 8° (Sudamericana): Solid `#10B981` accent line.
  - 9° - 14° (Permanencia neutral): Transparent border.
  - 15° - 16° (Descenso): Solid `#EF4444` accent line with light `#FEF2F2` row tint.
- **Data Columns:** Numerical alignment strictly centered for matches played (PJ), won (PG), drawn (PE), lost (PP), and goal differential (GD); points (PTS) right-aligned in bold weight.

### 2. Match Header & Live Chronometer
- **Container:** Dark Navy (`#0B1D3A`) banner displaying official tournament crest, venue information, and weather conditions.
- **Timer Component:** High-contrast monospaced display with live state badge:
  - Active Play: `#16A34A` pulsing indicator with `45:00 +3'`.
  - Half-Time / Extra-Time: Neutral gray badge `#64748B`.
- **Scoreboard:** Extra-bold 48px typography split by an understated gold colon separator.

### 3. Rapid Incident Action Buttons (Referee & Delegate Desk)
- **Grid Layout:** 2x3 or 2x4 matrix of high-touch physical buttons (minimum touch target 48x48px).
- **Incident Types:**
  - *Gol:* Solid `#0B1D3A` fill, gold outline on trigger.
  - *Tarjeta Amarilla:* High-visibility yellow fill (`#FACC15`) with black typography.
  - *4ª Amarilla Alert:* Amber fill (`#F59E0B`) with immediate notification icon.
  - *Tarjeta Roja Directa / 2ª Amarilla:* Crimson fill (`#DC2626`) with crisp white typography.
  - *Sustitución:* Crisp outlined container with green enter / red exit indicators.
  - *Revisión VAR / Incidencia Comisario:* High-contrast indigo container.

### 4. Player Lineup & Official Roster Cards
- **Jersey Marker:** Circular pill displaying uniform number; color matches team primary kit.
- **COMET & Medical Status Badges:** Compact icon pins indicating:
  - Habilitado (Checkmark green).
  - Suspensión reglamentaria (Lock red icon with text: "Art. 42 CD").
  - Extranjero / Juvenil Sub-20 (Neutral grey chip for quota tracking).

### 5. Input Fields & Form Controls
- **Height:** Compact 36px inputs with 1px border (`#CBD5E1`).
- **Focus State:** 2px ring in navy (`#0B1D3A`) with gold offset highlight (`#D4AF37`).
- **Validation Messages:** Positioned directly below inputs using `label-xs` typography in `#DC2626`.
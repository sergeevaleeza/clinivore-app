# Changelog

All notable changes to Clinivore are documented here.

---

## [0.4.1] — 2026-06-30

### Fix: Legal Name Fields for Practice Fusion Name Matching

**Root cause**: PF appointment exports contain full legal names ("Jane Doe", "Brian Osei") but the Patient model only stored display names ("J. Doe", "B. Osei"). The fuzzy matcher's Levenshtein distance threshold (≤ 2 characters) is too tight to bridge a first-initial abbreviation to a full first name — "jane doe" vs "j doe" is distance 3, so only Amy Kim happened to match by chance (distance 1).

**Schema (`prisma/schema.prisma`)**
- Added `legalFirstName String?` and `legalLastName String?` to the `Patient` model (both optional, backward compatible)

**Seed (`prisma/seed.ts`)**
- Added `legalFirstName` / `legalLastName` to all 20 `patient.create()` calls directly — no backfill loop. The seed always deletes and recreates all records, so `forEach`-async or `upsert`-missing-fields bugs can't occur here; legal names were simply included in the initial create data

  | Display | Legal First | Legal Last |
  |---------|-------------|------------|
  | J. Doe | Jane | Doe |
  | A. Kim | Amy | Kim |
  | M. Reyes | Maria | Reyes |
  | T. Park | Thomas | Park |
  | R. Morales | Rosa | Morales |
  | L. Chen | Lucas | Chen |
  | S. Pham | Sara | Pham |
  | T. Walsh | Trevor | Walsh |
  | D. Okafor | David | Okafor |
  | C. Mbanaso | Chioma | Mbanaso |
  | E. Vasquez | Elena | Vasquez |
  | N. Adeyemi | Nadia | Adeyemi |
  | B. Osei | Brian | Osei |
  | H. Nguyen | Hannah | Nguyen |
  | G. Tanaka | Grace | Tanaka |
  | F. Romero | Felipe | Romero |
  | K. Abara | Kemi | Abara |
  | P. Singh | Priya | Singh |
  | W. Mensah | William | Mensah |
  | I. Zhao | Isabella | Zhao |

**Matcher (`lib/csvImport.ts`)**
- `PatientMatchCandidate` extended with optional `legalFirstName` / `legalLastName`
- `matchPatientByName()` now tries in priority order: (1) exact legal name, (2) exact display name, (3) fuzzy legal name, (4) fuzzy display name — so Amy Kim now correctly resolves as `confidence: "exact"` instead of `"fuzzy"`

**Preview route (`app/api/import/pf-appointments/preview/route.ts`)**
- `candidatePool` now includes `legalFirstName` / `legalLastName` from the patient query

**To apply**: run `npx prisma db push` (adds columns to Neon, no data loss — both fields are nullable), then `npx prisma db seed`

---

## [0.4.0] — 2026-06-29

### Feature: Practice Fusion Appointment Import

New second tab on the Import page (`/import`) — staff can upload a Practice Fusion appointment export CSV directly without any manual reformatting.

**Parser (`lib/csvImport.ts`)**
- Added `parsePfAppointmentRow()`: handles both modern PF export column names (`AppointmentTime`, `AppointmentStatus`, `SeenBy`) and legacy space-separated names (`DATE/TIME`, `APPT. STATUS`, `SEEN BY PROVIDER`) with a multi-key fallback
- Added `normalizeApptStatus()`: maps freeform PF status strings (`"Checked Out"`, `"No Show"`, `"Canceled"`, etc.) to four canonical values: `completed | no_show | cancelled | unknown`
- Added `matchPatientByName()`: fuzzy Levenshtein name matching (distance ≤ 2, no external dependency), handles `"Last, First"` → `"first last"` normalization
- Design constraint honored: `AppointmentType` is extracted but never used for matching or automation — displayed to staff as context only

**Shared enrollment logic (`lib/enrollments.ts`)** — new file
- `completeTreatment(enrollmentId, date, note)`: extracted from PATCH `/api/enrollments/[id]` — updates `lastTreatmentDate`, computes `nextDueDate` from `protocol.defaultIntervalDays`, creates `TreatmentEvent(COMPLETED)`, writes audit log
- `markMissedTreatment(enrollmentId, date, note)`: same extraction — creates `TreatmentEvent(MISSED)`, creates `OutreachTask(priority: HIGH)`, writes audit log
- Both actions now called from the PATCH route and the new PF confirm route — zero duplication of next-due-date logic

**API: Preview** (`POST /api/import/pf-appointments/preview`)
- Parses all rows, matches each to an active patient by name (exact then fuzzy)
- For matched patients with active enrollments: returns candidate events; pre-checks only the most recent `completed` appointment per enrollment (staff can override)
- For matched patients without active enrollments: lists under "No Protocol Assigned" (informational only)
- For unmatched rows: lists under "Unmatched"
- Writes audit log: `PF_APPOINTMENT_PREVIEW` (entity-level only, no patient data in metadata)
- Does not write to the database

**API: Confirm** (`POST /api/import/pf-appointments/confirm`)
- Accepts staff-confirmed event list; calls `completeTreatment()` or `markMissedTreatment()` for each
- Creates `ImportBatch` record; writes audit log `PF_APPOINTMENT_IMPORT_CONFIRMED`
- Returns `{ eventsCreated, outreachTasksCreated }`

**UI (`app/import/page.tsx`)**
- Added tab navigation: `[Patient Roster CSV] [Practice Fusion Appointments]`
- PF tab: upload → auto-preview → staff review with per-event checkboxes → confirm
- Candidate events show: patient name, protocol, date, raw appt status badge, appt type (labeled "for reference only"), fuzzy match warning, "not the most recent visit" warning for older events in the same file
- No-show events display: "→ Will create: Missed event + HIGH priority outreach task"
- Confirm button disabled until at least one event is checked; label updates live with checked count
- Success screen shows events created + outreach tasks created
- Roster tab unchanged

**Settings page copy (`app/settings/page.tsx`)**
- Updated Practice Fusion description to accurately reflect the import capability that now exists, rather than describing it as future-only

---

## [0.3.2] — 2026-06-29

### Infrastructure
- Switched database from SQLite to PostgreSQL (Neon) for Vercel deployment — updated `prisma/schema.prisma` provider to `postgresql`
- Generated `NEXTAUTH_SECRET` and configured in `.env`

### Seed Data (`prisma/seed.ts`)
- **Fixed stale demo data**: `TODAY` constant changed from hardcoded `new Date("2026-05-25")` to `new Date()` — all patient dates now compute relative to the moment the seed runs, so the dashboard always shows a realistic distribution (overdue / due today / due soon / on track) regardless of when it's seeded
- Demo staff account email renamed `staff@clinivore.local` → `demo@clinivore.com`

### Login Page
- Email placeholder updated from `you@clinivore.local` → `demo@clinivore.com`

### Settings Page (`app/settings/page.tsx`)
- Database label now derived from `DATABASE_URL` at render time via `getDatabaseLabel()` — shows `"PostgreSQL (Neon)"` on Neon, `"PostgreSQL"` for other Postgres, `"SQLite (local)"` for file-based, never stale

### Dark Mode Fixes
- **Page header titles** (`components/PageHeader.tsx`): changed `color: "var(--navy)"` → `color: "var(--text-primary)"` — `--navy` has no dark override and was invisible against the dark page background; `--text-primary` correctly resolves to `#F1ECE4` in dark mode
- **Dashboard greeting h1** (`app/page.tsx`): same `var(--navy)` → `var(--text-primary)` fix; also fixed two section heading h2s and the patient name link/hover-restore
- **Dashboard card backgrounds** (`app/page.tsx`): changed all three card containers (stat cards, Urgent Patients panel, Treatment Status Overview chart) from hardcoded `background: "#ffffff"` → `background: "var(--card-bg)"` which resolves to `#112A4F` in dark mode
- **Filter inputs & dropdowns** (`app/patients/page.tsx`, `app/outreach/page.tsx`): replaced Tailwind `border-gray-300` (hardcoded light color) with inline CSS vars `var(--input-bg)` / `var(--input-border)` / `var(--input-text)` — already have correct dark values defined in `globals.css`
- **Button dark mode overrides** (`app/globals.css`): added `[data-theme="dark"]` rules for `.btn-secondary` (translucent blue instead of light `#EEF4FF`), `.btn-danger` (translucent red, softer `#F87171` text), `.btn-tertiary` hover, and `.btn-primary` hover

### Bug Fix
- Removed unused `formatDate` import from `app/page.tsx` (TypeScript hint 6133)

---

## [0.3.1] — 2026-05-26

### Dark / Light Theme Toggle

- **`app/globals.css`**: Added `[data-theme="dark"]` CSS override block — dark page bg (`#08152E`), dark card bg (`#112A4F`), adjusted text hierarchy, brightened brand accent tokens (teal `#14C9B8`, blue `#4B8EF5`, plum `#9F67F5`). Added `--input-bg`, `--input-border`, `--input-text`, `--table-hover` CSS variables to `:root` (with dark overrides). Added `transition: background-color 0.2s ease, color 0.2s ease` to `body` for smooth theme switching. Updated `.table-row-hover:hover` to use `var(--table-hover)`.
- **`lib/theme.tsx`**: New `ThemeProvider` (React Context) with `useTheme` hook. Reads saved preference from `localStorage` on mount, applies `data-theme` attribute to `<html>`. `toggleTheme` persists to `localStorage`.
- **`app/layout.tsx`**: Imported `ThemeProvider`. Added anti-flash inline `<script>` in `<head>` that reads `clinivore-theme` from `localStorage` and sets `data-theme` before first paint. Wrapped layout body in `<ThemeProvider>`.
- **`components/Sidebar.tsx`**: Imported `useTheme`. Added theme toggle button between nav and HIPAA badge — shows 🌙 "Dark mode" in light theme, ☀️ "Light mode" in dark theme. Sidebar stays deep navy in both modes.

---

## [0.3.0] — 2026-05-26

### Brand Implementation — Clinivore V3 Official

---

### Design System

- Replaced generic Tailwind config with official Clinivore brand palette: Navy `#0B1D3A`, Teal `#10B5A6`, Blue `#2563EB`, Green `#10B981`, Gold `#D4A373`, Off-white `#F8F5F0`, Midnight `#112A4F`, Plum `#7C3AED`
- Added `Sora` (headings) and `Inter` (body/UI) via `next/font/google` with CSS variable registration
- Replaced `globals.css` with full brand CSS variable set: semantic tokens for page bg, cards, text hierarchy, sidebar, and all 6 status states
- Updated component utilities: `.btn-primary` → Compassionate Teal, `.btn-secondary` → pale blue, `.card` → white with warm border + brand shadow, `.btn-danger` → light red

---

### Sidebar (`components/Sidebar.tsx`)

- Full redesign — Deep Navy background, all inline CSS styles using brand variables
- New SVG icon mark: C arc (teal highlight) + orbit dots (blue/green) + heart (teal fill)
- Wordmark split: **Clini** in white + **vore** in teal `#10B5A6`, Sora 700 18px
- Active nav items: blue `#2563EB` left border + translucent blue background
- Inactive items: muted white with hover brightening
- HIPAA-Aware badge above user footer (teal-tinted, bordered)
- User footer: teal initials avatar circle, name in white, role in muted white, sign-out arrow

---

### Status Badges (`components/StatusBadge.tsx`, `lib/status.ts`)

- Replaced Tailwind class strings with hex color values throughout `STATUS_CONFIG`
- `StatusBadge` now renders via inline styles — dot indicator + label, brand-spec colors per status
- Overdue/High Priority: red palette; Due Soon/Today: gold palette; Needs Outreach: teal; On Track/Completed: green; Paused/Discontinued: gray

---

### Dashboard (`app/page.tsx`)

- Replaced static header with time-based personalized greeting ("Good morning/afternoon/evening 👋/☀️/🌙")
- Stat cards redesigned: Sora bold 36px number, uppercase label, sub-label, color-coded icon box, "View all →" link row at card bottom
- Chart colors updated to match brand status palette

---

### Page Header (`components/PageHeader.tsx`)

- Switched from Tailwind classes to CSS variable styles
- Title uses Sora 700 22px in `--navy`; subtitle in `--text-muted`

---

### Outreach Queue (`app/outreach/page.tsx`)

- AI draft output block restyled with plum `#EDE9FE` background, `#DDD6FE` border, `#6D28D9` header text, and `✦ AI Draft` label

---

### App Layout (`app/layout.tsx`)

- Added Sora + Inter font imports with CSS variable registration
- Applied `--font-sora` and `--font-inter` variables to `<html>` element
- Updated metadata: new title template (`%s | Clinivore`), HIPAA-aware description, SVG favicon + OG tags

---

### Favicon (`public/icon.svg`)

- Created SVG favicon: navy rounded square, C arc with teal highlight, orbit dots (blue/green), teal heart center — matches sidebar icon mark

---

### Build Results

```
✓ Compiled successfully (Next.js 15.5.18)
✓ 0 TypeScript errors
✓ 23 routes built
```

---

## [0.2.1] — 2026-05-26

### Rebrand — Adherix → Clinivore

- Renamed product from **Adherix** to **Clinivore** across all source files
- Updated `package.json` and `package-lock.json` name field to `clinivore`
- Updated sidebar and login page logo: icon monogram `Ax` → `Cv`; brand text now renders `clini` in accent blue and `vore` in white
- Updated `app/layout.tsx` page title and metadata
- Updated `.env` and `.env.example` — `NEXT_PUBLIC_APP_NAME` and PostgreSQL db URL example
- Updated seed user emails from `@adherix.local` to `@clinivore.local`
- Updated CSV export filenames in Reports and Import pages
- Updated AI weekly summary header ("Generated by: Clinivore")
- Updated seed console message, README, CHANGELOG, and planning docs

---

## [0.2.0] — 2026-05-26

### Phase 1 Completion — Auth, PostgreSQL, Reporting, Hardening

---

### Authentication (`lib/auth.ts`, `middleware.ts`, `app/login/`)

- Added **NextAuth v5** (beta) with Credentials provider — email + password login backed by Prisma `User` table
- Passwords hashed with `bcryptjs` (cost factor 10); seed accounts use `password123` (dev only)
- JWT session strategy; `role` and `id` threaded through JWT callbacks into session
- `middleware.ts` at project root protects all routes except `/login` and `/api/auth/**`
- `/login` page: Clinivore brand mark, email/password form, error display, HIPAA notice
- `app/api/auth/[...nextauth]/route.ts` exports GET/POST handlers
- `app/layout.tsx` fetches session server-side and passes it to `<Sidebar>`
- `components/Sidebar.tsx` shows logged-in user name + role in footer; Sign out button calls `signOut()`

---

### PostgreSQL Migration + Deployment (`prisma/schema.prisma`, `railway.json`)

- Changed Prisma datasource provider from `sqlite` → `postgresql`
- Added `passwordHash String?` field to `User` model; regenerated Prisma client
- Updated `.env.example` with `DATABASE_URL` examples for both SQLite and PostgreSQL, plus `NEXTAUTH_SECRET` and `NEXTAUTH_URL`
- Added `railway.json` with Nixpacks builder, `prisma migrate deploy` start command, and health check path
- Added `app/api/health/route.ts` — returns `{ status: "ok", timestamp }` for Railway health checks
- Added `package.json` scripts: `postinstall` (prisma generate), `migrate:prod`, `db:seed:prod`

---

### Outcomes Reporting (`app/reports/`, `app/api/reports/`)

- New **`GET /api/reports`** route: accepts `period` (7d / 30d / 90d / custom) query params; queries `TreatmentEvent`, `OutreachTask`, `TreatmentEnrollment`, and `AuditLog`; returns summary stats, per-protocol breakdown, weekly trend, outreach metrics, and staff activity
- New **`/reports` page** with:
  - Period selector (4 buttons + custom date pickers)
  - 6 summary cards: Completed, Missed, Adherence Rate (color-coded), Outreach Resolved, Reschedule Rate, Active Patients
  - Recharts `ComposedChart` — bars for completed/missed per week + line for adherence % on dual Y-axes
  - Protocol adherence table sorted worst-first with color-coded adherence badges
  - Outreach metrics card (avg attempts, avg days to reschedule, top method breakdown)
  - Staff activity table from audit log
  - "Download Report CSV" button — client-side `Blob` + `URL.createObjectURL`, no server route
- Added "Reports" nav item to sidebar (between Audit Log and Settings)

---

### Outreach Improvements

- **`GET /api/outreach/count`** — fast count endpoint returning `{ urgent, total }` for open tasks; no joins
- Sidebar Outreach Queue badge shows live URGENT task count (fetched on mount, red pill badge)
- Outreach page: confirmation toast auto-dismisses after 3 s when "Mark Contacted" or "Voicemail Left" is clicked — no external library

---

### Patient Page Hardening

- Added **Pause Treatment** button with optional free-text reason modal (common use case: insurance hold) — calls `UPDATE_STATUS` → `PAUSED`
- Added **Resume Treatment** button (shown when status is PAUSED)
- Added **Discontinue Treatment** button with browser confirm guard → `DISCONTINUED`
- Enrollment status chip (ACTIVE / PAUSED / DISCONTINUED) shown next to protocol name in the Active Treatment card

---

## [0.1.0] — 2026-05-25

### Phase 1 MVP — Initial Build

---

### Project Scaffold

- Initialized Next.js 15 project with App Router and TypeScript
- Configured `tailwind.config.ts` with custom brand color palette and component utilities (`btn`, `card`, `table-row-hover`)
- Configured `postcss.config.js` with Tailwind + Autoprefixer
- Configured `next.config.ts` with `serverExternalPackages` for Prisma client compatibility
- Added `tsconfig.json` with strict TypeScript, path alias `@/*`, and bundler module resolution
- Added `.env.example` documenting all environment variables with HIPAA safety notes
- Added `.gitignore` excluding `node_modules`, `.next`, `.env`, and SQLite database files

---

### Data Model (`prisma/schema.prisma`)

Defined 9 Prisma models targeting SQLite:

| Model | Purpose |
|---|---|
| `User` | Staff accounts with roles: ADMIN, PROVIDER, STAFF |
| `Patient` | Display name, internal ID, provider, contact info, active flag |
| `TreatmentProtocol` | Interval rules, due-soon/overdue/escalation thresholds, built-in flag |
| `TreatmentEnrollment` | Links patient to protocol; tracks last treatment and next due date |
| `TreatmentEvent` | Immutable history: COMPLETED, MISSED, RESCHEDULED, SCHEDULED, CANCELLED |
| `OutreachTask` | Staff follow-up tasks with priority and status workflow |
| `AiDraft` | Saved AI-generated content (call scripts, chart notes, SMS, summaries) |
| `AuditLog` | Append-only compliance log for all staff actions |
| `ImportBatch` | Tracks CSV import history with row counts and status |

---

### Library Utilities (`lib/`)

#### `lib/db.ts`
- Singleton Prisma client with global caching for Next.js hot reload compatibility

#### `lib/status.ts`
- Defined `TreatmentStatus` enum: `HIGH_PRIORITY`, `OVERDUE`, `NEEDS_OUTREACH`, `DUE_TODAY`, `DUE_SOON`, `ON_TRACK`, `COMPLETED`, `PAUSED`, `DISCONTINUED`, `NO_DATE`
- `STATUS_CONFIG` map with label, Tailwind color classes, and sort priority for each status
- `computeEnrollmentStatus()` — core business logic: compares today vs. `nextDueDate` against each protocol's `overdueAfterDays` and `escalationAfterDays` thresholds; checks for open outreach tasks
- `formatDate()` — locale-formatted date string
- `daysFromNow()` — integer day delta from today
- `daysLabel()` — human-readable label ("Today", "In 3 days", "5 days ago")

#### `lib/audit.ts`
- `logAudit()` — async helper that writes to `AuditLog`; silently swallows errors so failed audits never break the user action

#### `lib/ai.ts`
- `generateAiDraft()` — dual-mode: mock (default) or live OpenAI
- Mock mode generates realistic, fully-formatted templates for all 4 draft types without any API call
- Live OpenAI mode respects `ALLOW_PHI_TO_AI` env var — when `false`, only `displayName` and `internalId` are included in prompts (no DOB, diagnosis, phone, or other PHI)
- Draft types: `CALL_SCRIPT`, `SMS_MESSAGE`, `CHART_NOTE`, `WEEKLY_SUMMARY`
- Falls back to mock on any API error

#### `lib/csvImport.ts`
- `validateCsvRow()` — validates required fields and date formats; returns `_valid`, `_errors`, and `_rowIndex` metadata per row
- `CSV_TEMPLATE_HEADERS` and `CSV_TEMPLATE_EXAMPLE` — downloadable template constants

#### `lib/types.ts`
- Shared TypeScript interfaces: `PatientWithStatus`, `EnrollmentWithProtocol`, `DashboardStats`

---

### API Routes (`app/api/`)

#### `GET /api/dashboard`
- Aggregates all active enrollments; computes status for each using `computeEnrollmentStatus()`
- Returns: stat counts (dueToday, dueThisWeek, overdue, needsOutreach, highPriority, completedThisWeek), top 10 urgent patients sorted by severity, status count map for chart

#### `GET /api/patients`
- Supports `search` (name/ID/provider) and `activeOnly` query params
- Returns patients with active enrollments and open outreach task counts included

#### `POST /api/patients`
- Creates a new patient; enforces unique `internalId`; writes audit log entry

#### `GET /api/patients/[id]`
- Full patient detail: enrollments with protocols, last 30 treatment events, all outreach tasks (with enrollment/protocol context)

#### `PUT /api/patients/[id]`
- Updates patient demographic fields; writes audit log entry

#### `POST /api/enrollments`
- Creates a new treatment enrollment for a patient; writes audit log entry

#### `PATCH /api/enrollments/[id]`
- Multi-action endpoint supporting:
  - `COMPLETED` — updates `lastTreatmentDate`, calculates next `nextDueDate` from protocol interval, creates `TreatmentEvent`
  - `MISSED` — creates `TreatmentEvent`, auto-creates a HIGH priority `OutreachTask`
  - `RESCHEDULE` — updates `nextDueDate`, creates `TreatmentEvent`
  - `UPDATE_STATUS` — changes enrollment status (ACTIVE/PAUSED/DISCONTINUED)
- All actions write audit log entries

#### `GET /api/outreach`
- Returns open outreach tasks (excludes CLOSED by default); supports `status` and `priority` filters
- Sorted by priority (URGENT first) then due date

#### `POST /api/outreach`
- Creates a new outreach task; writes audit log entry

#### `PATCH /api/outreach/[id]`
- Updates outreach task status and outcome note; sets `lastAttemptAt` timestamp; writes audit log entry

#### `POST /api/ai`
- Looks up enrollment with patient + protocol + recent outreach history
- Calls `generateAiDraft()` with safe context
- Saves result to `AiDraft` table; writes audit log entry (records which AI provider was used)

#### `GET /api/audit`
- Paginated audit log (default 50/page); returns total count for pagination

#### `POST /api/import`
- Accepts parsed CSV rows + filename
- Creates `ImportBatch` record; upserts patients by `internalId`; creates or updates `TreatmentEnrollment` if protocol name matches
- Returns per-row error details for display; writes audit log entry

#### `GET /api/protocols`
- Returns all protocols with active enrollment counts

#### `POST /api/protocols`
- Creates a custom (non-built-in) protocol; writes audit log entry

---

### Shared Components (`components/`)

- **`Sidebar.tsx`** — Fixed left nav (64 = 256px wide); active route highlighted; Clinivore brand mark; role/phase indicator in footer
- **`StatusBadge.tsx`** — Renders colored pill badge for any `TreatmentStatus`; supports `sm` and `md` sizes
- **`PageHeader.tsx`** — Consistent page title + subtitle + optional action button slot
- **`EmptyState.tsx`** — Centered icon + message + optional action for empty lists
- **`LoadingSpinner.tsx`** — Animated spinner with label for async states

---

### App Layout (`app/layout.tsx`, `app/globals.css`)

- Root layout wraps all pages with `<Sidebar>` + `<main>` two-column structure
- Global CSS defines Tailwind layers with reusable `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-sm`, `.card`, `.table-row-hover` classes

---

### Pages

#### Dashboard (`app/page.tsx`)
- 6 stat cards: High Priority (purple), Overdue (red), Due Today (yellow), Due This Week (blue), Needs Outreach (orange), Completed This Week (green)
- Urgent patient list (top 10) with name, protocol, days label, status badge, and link to detail
- Horizontal bar chart (Recharts `BarChart`) showing patient count per status, color-coded to match status palette
- Quick link to Outreach Queue

#### Patients List (`app/patients/page.tsx`)
- Table with columns: Patient (name + ID), Protocol, Last Treatment, Next Due (with days label), Status badge, Provider, View button
- Debounced search input (300ms) filtering by name/ID/provider via API
- Status dropdown filter applied client-side after fetch
- Add Patient modal with form validation and duplicate ID detection

#### Patient Detail (`app/patients/[id]/page.tsx`)
- 3-column layout: patient info card, active enrollment card, action buttons, draft generator — then timeline + outreach tasks
- Action buttons: Mark Completed, Mark Missed, Reschedule (modal with date picker), Create Outreach Task
- Draft generator buttons: Call Script, SMS Message, Chart Note, Weekly Summary — output shown inline in a monospace pre block
- Activity timeline: merges `TreatmentEvent` and `OutreachTask` records sorted by date, color-coded by event type
- Open outreach tasks panel with link to Outreach Queue

#### Outreach Queue (`app/outreach/page.tsx`)
- Cards sorted by priority (URGENT → HIGH → NORMAL → LOW)
- Per-task action buttons: Mark Contacted, Voicemail Left, Rescheduled (with note modal), Notify Provider, Generate Call Script, Generate Chart Note, Close Task
- Draft modal shows generated content with tab-switch between Call Script / SMS / Chart Note
- Outcome note modal for Rescheduled and Close actions
- Status + priority filter dropdowns
- Summary line showing urgent/high count

#### Protocols (`app/protocols/page.tsx`)
- Cards grouped by category (Addiction Medicine, Schizophrenia, Ketamine, Spravato)
- Each card shows: interval, due-soon threshold, overdue-after, escalation-after, active patient count, built-in indicator
- Add Custom Protocol modal with all configurable fields

#### CSV Import (`app/import/page.tsx`)
- Drag-and-drop zone + click-to-browse file input
- PapaParse used client-side; no file upload to server — parsed in-browser
- Preview table with per-row validation status and inline error messages
- Row count badges (valid/invalid) before import
- Import button disabled when 0 valid rows
- Result summary card on success
- Downloadable CSV template button
- Column reference table when no file is loaded

#### Audit Log (`app/audit/page.tsx`)
- Paginated table (50/page) with timestamp, actor, action badge (color-coded by action type), entity type, truncated entity ID, metadata preview
- Previous/Next pagination controls

#### Settings (`app/settings/page.tsx`)
- HIPAA compliance warning banner with full checklist
- Current configuration display (AI provider, PHI-to-AI status, database, audit logging)
- Phase roadmap (Phase 1 current → Phase 2 → Phase 3)
- Future integrations section: Practice Fusion EHR, Twilio SMS, AI (BAA-covered)
- AI environment variable reference with example `.env` block

---

### Seed Data (`prisma/seed.ts`)

Seeded 9 built-in treatment protocols:

| Protocol | Category | Interval |
|---|---|---|
| Vivitrol | Addiction Medicine | 28 days |
| Sublocade | Addiction Medicine | 30 days |
| Invega Sustenna | Schizophrenia | 30 days |
| Invega Trinza | Schizophrenia | 90 days |
| Abilify Maintena | Schizophrenia | 30 days |
| Aristada | Schizophrenia | 30 days |
| Ketamine Induction | Ketamine | 3 days |
| Ketamine Maintenance | Ketamine | 28 days |
| Spravato | Spravato | 7 days |

Seeded 20 mock patients covering all status scenarios:

| Patient | Protocol | Status |
|---|---|---|
| J. Doe (PF-10294) | Vivitrol | HIGH PRIORITY — 12 days overdue |
| A. Kim (PF-10388) | Sublocade | HIGH PRIORITY — 9 days overdue |
| M. Reyes (PF-10318) | Invega Sustenna | OVERDUE — 4 days |
| T. Park (PF-10421) | Abilify Maintena | OVERDUE — 5 days, outreach contacted |
| R. Morales (PF-10377) | Invega Trinza | DUE TODAY |
| L. Chen (PF-10512) | Spravato | DUE TODAY |
| S. Pham (PF-10301) | Ketamine Induction | DUE TODAY (session 4 of 6) |
| T. Walsh (PF-10355) | Vivitrol | DUE SOON — 4 days |
| D. Okafor (PF-10466) | Sublocade | DUE SOON — 6 days |
| C. Mbanaso (PF-10533) | Aristada | DUE SOON — 5 days |
| E. Vasquez (PF-10601) | Invega Sustenna | ON TRACK — 15 days |
| N. Adeyemi (PF-10645) | Abilify Maintena | ON TRACK — 16 days |
| B. Osei (PF-10677) | Ketamine Maintenance | ON TRACK — 21 days |
| H. Nguyen (PF-10711) | Vivitrol | COMPLETED this week |
| G. Tanaka (PF-10745) | Spravato | COMPLETED this week |
| F. Romero (PF-10780) | Invega Trinza | PAUSED — insurance hold |
| K. Abara (PF-10815) | Aristada | ON TRACK — 10 days |
| P. Singh (PF-10849) | Abilify Maintena | OVERDUE — 8 days (borderline escalation) |
| W. Mensah (PF-10883) | Invega Sustenna | NEEDS OUTREACH — open reminder task |
| I. Zhao (PF-10917) | Ketamine Maintenance | ON TRACK — 18 days |

Also seeded: 59 treatment events, 6 open outreach tasks (2 urgent, 2 high), 8 audit log entries, 4 users.

---

### README (`README.md`)

- Product summary and daily operational question Clinivore answers
- Step-by-step local setup instructions
- Full npm script reference table
- Built-in protocol table with all threshold values
- HIPAA disclaimer with full compliance checklist
- AI configuration reference
- CSV import format specification
- Known Phase 1 limitations
- Phase roadmap (Phase 1 → 2 → 3)
- Future integration notes: Practice Fusion EHR, Twilio SMS, BAA-covered AI

---

### Build Results

```
✓ Compiled successfully (Next.js 15.5.18)
✓ 0 TypeScript errors
✓ 18 routes built (8 pages + 10 API route groups)
✓ Database seeded (SQLite, Prisma 5.22.0)
```

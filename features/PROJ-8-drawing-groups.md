# PROJ-8: Zeichnungsgruppen

## Status: In Review
**Created:** 2026-03-19
**Last Updated:** 2026-03-19

## Dependencies
- Requires: PROJ-3 (PDF Upload & Viewer) — Gruppen organisieren die bestehenden Zeichnungen innerhalb eines Projekts
- Requires: PROJ-2 (Projektverwaltung) — Gruppen gehören zu einem Projekt

## Overview
Zeichnungen innerhalb eines Projekts können in frei benennbare Gruppen eingeteilt werden (z.B. „Erdgeschoss", „Obergeschoss", „Elektro"). In der Projektübersicht erscheinen die Gruppen als auf- und zuklappbare Bereiche mit Überschrift und der Anzahl aktiver Zeichnungen. Zeichnungen ohne Gruppe werden in einem separaten Bereich „Ohne Gruppe" angezeigt. Gruppen können direkt in der Projektübersicht erstellt, umbenannt und archiviert werden.

## User Stories
- Als Nutzer möchte ich Zeichnungen in Gruppen (z.B. „EG", „OG", „Keller") einteilen, damit ich in Projekten mit vielen Plänen schneller die richtige Zeichnung finde.
- Als Nutzer möchte ich Gruppen in der Projektübersicht auf- und zuklappen, damit ich nur die Bereiche sehe, die ich gerade brauche.
- Als Nutzer möchte ich die Anzahl der aktiven Zeichnungen pro Gruppe auf einen Blick sehen, ohne die Gruppe aufklappen zu müssen.
- Als Nutzer möchte ich direkt in der Projektübersicht eine neue Gruppe anlegen, ohne in ein separates Einstellungsmenü wechseln zu müssen.
- Als Nutzer möchte ich eine Zeichnung über ihr Aktionsmenü einer Gruppe zuweisen oder in eine andere Gruppe verschieben.
- Als Nutzer möchte ich eine Gruppe umbenennen oder archivieren, wenn sie nicht mehr benötigt wird.

## Acceptance Criteria

### Gruppen in der Projektübersicht
- [ ] Gruppen werden als auf-/zuklappbare Abschnitte untereinander dargestellt, standardmäßig alle aufgeklappt
- [ ] Jede Gruppen-Überschrift zeigt: Gruppenname + Anzahl aktiver (nicht-archivierter) Zeichnungen in Klammern, z.B. „Erdgeschoss (3)"
- [ ] Zeichnungen ohne Gruppe erscheinen in einem festen Bereich „Ohne Gruppe" am Ende der Liste
- [ ] Der Bereich „Ohne Gruppe" wird ausgeblendet, wenn alle Zeichnungen einer Gruppe zugewiesen sind
- [ ] Die Reihenfolge der Gruppen entspricht der Erstellungsreihenfolge (älteste zuerst)
- [ ] Leere (aktive) Gruppen werden ebenfalls angezeigt, mit Zähler „(0)"

### Gruppe erstellen
- [ ] Ein „+ Gruppe hinzufügen"-Button ist sichtbar auf der Projektdetailseite
- [ ] Klick öffnet einen Inline-Input oder Dialog zur Eingabe des Gruppennamens
- [ ] Gruppenname: 1–100 Zeichen, Pflichtfeld, keine Leerzeichen-only
- [ ] Doppelte Gruppennamen im selben Projekt werden abgelehnt (Fehlermeldung)
- [ ] Nach dem Erstellen erscheint die neue Gruppe sofort in der Übersicht (optimistic update oder Refetch)

### Gruppe umbenennen
- [ ] Neben jeder Gruppenüberschrift gibt es ein Kontextmenü (⋮) mit den Optionen „Umbenennen" und „Archivieren"
- [ ] „Umbenennen" öffnet einen Dialog oder Inline-Edit mit dem aktuellen Namen vorausgefüllt
- [ ] Validierung wie beim Erstellen (1–100 Zeichen, kein Duplikat)

### Gruppe archivieren
- [ ] „Archivieren" öffnet einen Bestätigungsdialog
- [ ] Archivierte Gruppen verschwinden aus der aktiven Projektübersicht
- [ ] Zeichnungen der archivierten Gruppe verlieren ihre Gruppenzuweisung NICHT — sie wandern in „Ohne Gruppe"
- [ ] Gruppen werden nie dauerhaft gelöscht (konsistent mit PROJ-6)

### Zeichnung einer Gruppe zuweisen
- [ ] Im Aktionsmenü (⋮) einer DrawingCard gibt es den Eintrag „Gruppe zuweisen"
- [ ] Ein Dropdown listet alle aktiven Gruppen des Projekts sowie die Option „Ohne Gruppe"
- [ ] Die aktuell zugewiesene Gruppe ist im Dropdown markiert
- [ ] Nach der Zuweisung erscheint die Zeichnung sofort in der neuen Gruppe und verschwindet aus der alten

## Edge Cases
- **Zeichnung archivieren, die einer Gruppe zugewiesen ist:** Die Zeichnung bleibt der Gruppe zugeordnet (in der DB), wird aber aus der aktiven Anzeige der Gruppe gefiltert; der Zähler sinkt.
- **Gruppe archivieren mit aktiven Zeichnungen:** Möglich — die Zeichnungen wandern nach „Ohne Gruppe"; Bestätigungsdialog weist darauf hin, z.B. „2 Zeichnungen werden nach ‚Ohne Gruppe' verschoben."
- **Gruppenname-Duplikat:** Fehlermeldung beim Erstellen/Umbenennen: „Eine Gruppe mit diesem Namen existiert bereits."
- **Letzte Gruppe archivieren:** Erlaubt — alle Zeichnungen wandern nach „Ohne Gruppe".
- **Keine Gruppen vorhanden:** Projektübersicht zeigt nur den Bereich „Ohne Gruppe" (bisheriges Verhalten bleibt erhalten).
- **Viele Gruppen (>10):** Alle Gruppen werden untereinander aufgelistet; kein technisches Limit; UI bleibt scrollbar.
- **Gleichzeitige Änderungen durch mehrere Nutzer:** Kein Echtzeit-Sync erforderlich (V1); ein Reload zeigt den aktuellen Stand.
- **Zeichnung einer archivierten Gruppe zuweisen:** Nicht möglich — archivierte Gruppen erscheinen nicht im Zuweis-Dropdown.

## Technical Requirements
- Neue Tabelle `drawing_groups` (id, project_id FK, name, is_archived, created_by, created_at, updated_at)
- `drawings`-Tabelle erhält neues Feld `group_id` (nullable FK → `drawing_groups`)
- RLS: Gruppen sichtbar und verwaltbar für alle Projektmitglieder (owner + member)
- API-Routen für Gruppen: Liste abrufen, erstellen, umbenennen, archivieren; Zeichnung-Gruppe-Zuweisung via PATCH auf bestehender drawings-Route
- Keine Reihenfolge-Manipulation (Drag & Drop) in V1 — Reihenfolge nach Erstellungsdatum
- Browser Support: Chrome, Firefox, Safari (aktuellste Versionen)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
**Erstellt:** 2026-03-19

### Komponenten-Struktur

```
Projektdetail-Seite /dashboard/projects/[id]
+-- ProjectHeader (bestehend)
+-- AddGroupButton ("+ Gruppe hinzufügen")
|   +-- CreateGroupDialog (Dialog + Input + Form)
+-- GroupedDrawingList (neu — ersetzt bestehendes DrawingGrid)
    +-- DrawingGroupSection[] (eine pro aktiver Gruppe, sortiert nach Erstellungszeit)
    |   +-- Collapsible (shadcn — bereits installiert)
    |       +-- CollapsibleTrigger
    |       |   +-- ChevronIcon (dreht bei auf/zu)
    |       |   +-- Gruppenname
    |       |   +-- Badge (Anzahl aktiver Zeichnungen, z.B. „3")
    |       |   +-- GroupActionsMenu (DropdownMenu)
    |       |       +-- "Umbenennen" → RenameGroupDialog (Dialog)
    |       |       +-- "Archivieren" → ArchiveGroupDialog (AlertDialog)
    |       +-- CollapsibleContent
    |           +-- DrawingGrid (bestehend, wiederverwendet)
    |               +-- DrawingCard[] (angepasst: neuer Menü-Eintrag)
    |                   +-- "Gruppe zuweisen" → AssignGroupSelect (Select)
    +-- DrawingGroupSection ("Ohne Gruppe" — fix am Ende, nur sichtbar wenn Zeichnungen vorhanden)
        +-- [gleiche Collapsible-Struktur, kein Aktionsmenü]
        +-- DrawingGrid (bestehend)
```

### Datenmodell

**Tabelle `drawing_groups`** (neu):
- id, project_id (FK → projects), name (Text, max. 100 Zeichen, eindeutig pro Projekt), is_archived, created_by, created_at, updated_at

**Tabelle `drawings`** (angepasst — ein Feld hinzugefügt):
- Neu: group_id (nullable FK → drawing_groups)
- Alle anderen Felder bleiben unverändert

**Geschäftslogik beim Archivieren einer Gruppe (serverseitig):**
- Alle Zeichnungen mit dieser group_id erhalten group_id = NULL (wandern nach „Ohne Gruppe")
- Die Gruppe selbst wird auf is_archived = true gesetzt

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Auf-/Zuklappen | `Collapsible` (shadcn — bereits installiert) | Passt exakt; kein Accordion (unabhängiges Auf-/Zuklappen gewünscht) |
| Gruppen-Zähler | `Badge` (shadcn — bereits installiert) | Einheitlich mit anderen Badges im Projekt |
| Gruppe-Zuweisung | `Select` (shadcn — bereits installiert) im bestehenden DropdownMenu | Kein Extra-Dialog nötig, direkte Auswahl |
| Kein Drag & Drop | Bewusste Entscheidung für V1 | Komplexität vs. Nutzen; Reihenfolge nach Erstellungszeit reicht |
| „Ohne Gruppe" | Fester Abschnitt, kein DB-Eintrag | Zeichnungen mit group_id = NULL; kein Overhead in der DB |

### API-Routen

- `GET /api/projects/[id]/groups` — alle aktiven Gruppen laden (für Dropdown + Gruppenliste)
- `POST /api/projects/[id]/groups` — neue Gruppe erstellen (Duplikat-Prüfung server-seitig)
- `PATCH /api/projects/[id]/groups/[groupId]` — Gruppe umbenennen
- `POST /api/projects/[id]/groups/[groupId]/archive` — Gruppe archivieren (setzt Zeichnungen auf group_id = NULL)
- `PATCH /api/projects/[id]/drawings/[drawingId]` — bestehende Route, erweitert um `group_id` im Request-Body

### Neue Abhängigkeiten

Keine neuen Pakete erforderlich — alle benötigten shadcn-Komponenten (`Collapsible`, `Badge`, `Select`, `Dialog`, `AlertDialog`, `DropdownMenu`, `Input`) sind bereits installiert.

## Frontend Implementation Notes
**Implemented:** 2026-03-19

### New Files
- `src/lib/types/drawing.ts` -- Added `DrawingGroup` interface and `group_id` field to `Drawing`
- `src/lib/validations/drawing-group.ts` -- Zod schemas for create/rename group
- `src/hooks/use-drawing-groups.ts` -- Hook for CRUD operations on drawing groups
- `src/components/drawings/GroupedDrawingList.tsx` -- Orchestrator: groups drawings by group, renders sections
- `src/components/drawings/DrawingGroupSection.tsx` -- Collapsible section with group header, badge count, context menu
- `src/components/drawings/CreateGroupDialog.tsx` -- Dialog for creating new groups with duplicate validation
- `src/components/drawings/RenameGroupDialog.tsx` -- Dialog for renaming groups with duplicate validation
- `src/components/drawings/ArchiveGroupDialog.tsx` -- AlertDialog with confirmation and drawing count warning
- `src/components/drawings/AssignGroupSelect.tsx` -- Dialog listing all active groups + "Ohne Gruppe" for assignment

### Modified Files
- `src/components/drawings/DrawingCard.tsx` -- Added "Gruppe zuweisen" menu entry + AssignGroupSelect integration
- `src/components/drawings/DrawingGrid.tsx` -- Passes through `groups` and `onAssignGroup` props
- `src/app/(protected)/dashboard/projects/[id]/page.tsx` -- Integrated `useDrawingGroups`, replaced `DrawingGrid` with `GroupedDrawingList`, added "+ Gruppe hinzufuegen" button and `CreateGroupDialog`

### Key Decisions
- Used `Collapsible` (shadcn) for independent open/close per group (not Accordion)
- "Ohne Gruppe" section only shown when groups exist and ungrouped drawings are present
- When no groups exist at all, drawings display without any group header (backward compatible)
- Group assignment uses a Dialog with selectable list rather than inline Select for better UX on mobile
- All group names are validated client-side for duplicates before submission

## Backend Implementation Notes
**Implemented:** 2026-03-19

### Database Migration
- `supabase/migrations/008_drawing_groups.sql`
- New table `drawing_groups` with RLS enabled and policies for SELECT, INSERT, UPDATE (all project members)
- No DELETE policy (archive-only, consistent with PROJ-6)
- Unique partial index on `(project_id, lower(trim(name))) WHERE is_archived = false` to prevent duplicate active group names (case-insensitive)
- Indexes on `project_id`, `is_archived`, `created_at`
- `updated_at` trigger reuses `handle_updated_at()` from migration 001
- Added `group_id` (nullable FK with ON DELETE SET NULL) to `drawings` table with index

### API Routes
- `GET /api/projects/[id]/groups` -- Returns active groups ordered by `created_at` ASC
- `POST /api/projects/[id]/groups` -- Creates group with Zod validation + server-side duplicate check + unique index fallback
- `PATCH /api/projects/[id]/groups/[groupId]` -- Renames group with duplicate check; rejects archived groups
- `POST /api/projects/[id]/groups/[groupId]/archive` -- Archives group and sets all assigned drawings to `group_id = NULL` (two sequential updates in the same API call)

### Modified Files
- `src/app/api/projects/[id]/drawings/[drawingId]/route.ts` -- Extended PATCH to accept optional `group_id` (nullable UUID). Validates group exists, belongs to project, and is not archived before assignment.
- `src/lib/validations/drawing.ts` -- Added `updateDrawingSchema` (supports `display_name` and/or `group_id` with at-least-one-field refine)

### Permissions
- All project members (owner + member) can create, rename, and archive groups -- consistent with drawing RLS policies
- No rate limiting in V1

### Key Decisions
- Archiving is done sequentially (unassign drawings first, then archive group) in the same API handler rather than an RPC function; acceptable for V1 since both operations are fast
- Duplicate name check uses both application-level `ilike` query and DB-level unique partial index as fallback for race conditions
- `updateDrawingSchema` uses `.refine()` to ensure at least one field is provided, allowing the same PATCH endpoint for both rename and group assignment

## QA Test Results

**Tested:** 2026-03-19
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Static code review + TypeScript compilation check (tsc --noEmit: PASS, 0 errors)

### Acceptance Criteria Status

#### AC-1: Gruppen in der Projektuebersicht
- [x] Gruppen werden als auf-/zuklappbare Abschnitte dargestellt (Collapsible component, defaultOpen=true)
- [x] Jede Gruppen-Ueberschrift zeigt Gruppenname + Anzahl aktiver Zeichnungen via Badge
- [x] Zeichnungen ohne Gruppe erscheinen in festem Bereich "Ohne Gruppe" am Ende der Liste
- [x] Bereich "Ohne Gruppe" wird ausgeblendet, wenn alle Zeichnungen zugewiesen sind (ungroupedDrawings.length > 0 check)
- [x] Reihenfolge der Gruppen nach Erstellungsreihenfolge (sort by created_at ASC)
- [x] Leere aktive Gruppen werden angezeigt mit Zaehler "(0)" (activeGroups initialized with empty arrays in groupedDrawings map)

#### AC-2: Gruppe erstellen
- [x] "+ Gruppe hinzufuegen" Button sichtbar auf Projektdetailseite
- [x] Klick oeffnet CreateGroupDialog mit Input-Feld
- [x] Gruppenname: 1-100 Zeichen, Pflichtfeld, keine Leerzeichen-only (Zod schema + client validation)
- [ ] BUG: Doppelte Gruppennamen-Pruefung serverseitig nutzt ilike() -- siehe BUG-1
- [x] Nach Erstellen erscheint Gruppe sofort (fetchGroups refetch nach createGroup)

#### AC-3: Gruppe umbenennen
- [x] Kontextmenue (drei Punkte) neben jeder Gruppenueberscrhift mit "Umbenennen" und "Archivieren"
- [x] "Umbenennen" oeffnet RenameGroupDialog mit aktuellem Namen vorausgefuellt
- [x] Validierung wie beim Erstellen (1-100 Zeichen, Duplikat-Pruefung client+server)

#### AC-4: Gruppe archivieren
- [x] "Archivieren" oeffnet Bestaetigungsdialog (ArchiveGroupDialog mit AlertDialog)
- [x] Archivierte Gruppen verschwinden aus aktiver Uebersicht (is_archived=false Filter)
- [ ] BUG: Zeichnungen der archivierten Gruppe verlieren Gruppenzuweisung (group_id=NULL) -- spec sagt sie sollen in "Ohne Gruppe" wandern, was korrekt ist, ABER die Archivierung ist nicht atomar -- siehe BUG-2
- [x] Gruppen werden nie dauerhaft geloescht (kein DELETE RLS-Policy, kein DELETE API)

#### AC-5: Zeichnung einer Gruppe zuweisen
- [x] Im Aktionsmenue einer DrawingCard gibt es "Gruppe zuweisen" Eintrag
- [x] Dialog listet alle aktiven Gruppen + "Ohne Gruppe"
- [x] Aktuell zugewiesene Gruppe ist markiert (Check-Icon)
- [x] Nach Zuweisung erscheint Zeichnung in neuer Gruppe (refetchDrawings nach assignDrawingToGroup)

### Edge Cases Status

#### EC-1: Zeichnung archivieren, die einer Gruppe zugewiesen ist
- [x] Zeichnung wird aus aktiver Anzeige der Gruppe gefiltert (drawings.filter(d => !d.is_archived)); Zaehler basiert auf uebergebenen drawings

#### EC-2: Gruppe archivieren mit aktiven Zeichnungen
- [x] Moeglich -- Bestaetigungsdialog zeigt Anzahl betroffener Zeichnungen ("X Zeichnungen werden nach 'Ohne Gruppe' verschoben")

#### EC-3: Gruppenname-Duplikat
- [ ] BUG: Client-seitige Pruefung korrekt (case-insensitive). Server-seitige Pruefung nutzt ilike() -- siehe BUG-1

#### EC-4: Letzte Gruppe archivieren
- [x] Erlaubt -- alle Zeichnungen wandern nach "Ohne Gruppe"; wenn keine Gruppen mehr existieren, werden Zeichnungen ohne Gruppenheader angezeigt (activeGroups.length === 0 branch)

#### EC-5: Keine Gruppen vorhanden
- [x] Projektuebersicht zeigt nur Zeichnungen ohne Gruppenheader (backward compatible)

#### EC-6: Viele Gruppen (>10)
- [x] Alle Gruppen untereinander aufgelistet; kein technisches Limit; UI scrollbar (space-y-2 layout)

#### EC-7: Gleichzeitige Aenderungen
- [x] Kein Echtzeit-Sync (V1); Reload zeigt aktuellen Stand (refetch-Pattern)

#### EC-8: Zeichnung einer archivierten Gruppe zuweisen
- [x] Nicht moeglich -- Server prueft is_archived und gibt 400 zurueck; archivierte Gruppen erscheinen nicht im Dropdown (activeGroups Filter)

### Cross-Browser Testing
- Note: Static code review only. No browser-specific APIs used in the drawing groups feature. All components use standard React + shadcn/ui (Radix primitives) which are cross-browser compatible.
- [ ] Chrome: Manual testing required
- [ ] Firefox: Manual testing required
- [ ] Safari: Manual testing required

### Responsive Testing
- Note: Static code review only. Dialog components use `sm:max-w-md` / `sm:max-w-sm` for mobile responsiveness. DrawingGrid uses `grid-cols-2 sm:grid-cols-2 lg:grid-cols-3`. Group section header uses `flex` with `truncate` for long names.
- [ ] 375px (Mobile): Manual testing required
- [ ] 768px (Tablet): Manual testing required
- [ ] 1440px (Desktop): Manual testing required

### Security Audit Results
- [x] Authentication: All API routes verify auth via supabase.auth.getUser() before processing
- [x] Authorization: All API routes verify project membership via project_members table before any data access
- [x] RLS: drawing_groups table has RLS enabled with policies for SELECT, INSERT, UPDATE scoped to project members
- [x] No DELETE policy: archive-only pattern prevents permanent data deletion
- [x] Input validation: Zod schemas on server-side for all mutation endpoints (create, rename, update drawing)
- [ ] BUG: ilike() pattern matching vulnerability -- see BUG-1
- [ ] FINDING: No rate limiting on group CRUD operations (documented as "no rate limiting in V1") -- see BUG-3
- [ ] FINDING: projectId and groupId from URL params not validated as UUID format before use in queries -- see BUG-4
- [x] No exposed secrets in client code
- [x] No sensitive data leakage in API responses (only returns group/drawing objects)
- [x] CSRF: POST/PATCH routes use JSON body parsing (not form data), mitigating basic CSRF
- [x] XSS: Group names rendered via React JSX (auto-escaped); no dangerouslySetInnerHTML usage

### Bugs Found

#### BUG-1: ilike() used for duplicate name check allows pattern matching bypass
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Go to a project detail page
  2. Create a group named "test_group" (with underscore)
  3. Try to create a group named "testXgroup" (X = any single character)
  4. Expected: Group "testXgroup" is created successfully (different name)
  5. Actual: Server may reject it as duplicate because PostgreSQL ilike() treats underscore as "match any single character" wildcard
  6. Conversely, creating a name with literal underscore/percent might fail to detect actual duplicates if the stored name contains these characters
- **Affected files:**
  - `src/app/api/projects/[id]/groups/route.ts` line 108
  - `src/app/api/projects/[id]/groups/[groupId]/route.ts` line 83
- **Fix:** Replace `.ilike("name", name.trim())` with a case-insensitive exact match approach. Options: (a) use `.eq("name", name.trim())` if the DB unique index already handles case via `lower(trim(name))`, or (b) use a raw filter with `lower(name) = lower(?)`. The DB-level unique partial index on `lower(trim(name))` serves as the true fallback and is correct.
- **Priority:** Fix before deployment

#### BUG-2: Non-atomic group archiving can leave data in inconsistent state
- **Severity:** Low
- **Steps to Reproduce:**
  1. Have a group with active drawings
  2. Archive the group via POST /api/projects/[id]/groups/[groupId]/archive
  3. If step 1 (unassign drawings) succeeds but step 2 (archive group) fails due to a transient DB error
  4. Expected: Either both operations succeed or neither does
  5. Actual: Drawings lose their group_id (set to NULL) but the group remains active
- **Affected file:** `src/app/api/projects/[id]/groups/[groupId]/archive/route.ts` lines 59-81
- **Note:** Documented as "acceptable for V1" in the backend implementation notes. The failure scenario is unlikely since both are simple UPDATE operations. A Supabase RPC function wrapping both in a transaction would be the proper fix.
- **Priority:** Fix in next sprint

#### BUG-3: No rate limiting on group CRUD operations
- **Severity:** Low
- **Steps to Reproduce:**
  1. Send rapid POST requests to /api/projects/[id]/groups with different names
  2. Expected: After N requests, subsequent requests are throttled
  3. Actual: All requests are processed without limit
- **Note:** Explicitly documented as "No rate limiting in V1" in the spec. An attacker could flood the database with thousands of groups.
- **Priority:** Fix in next sprint

#### BUG-4: URL params (projectId, groupId) not validated as UUID before DB queries
- **Severity:** Low
- **Steps to Reproduce:**
  1. Send GET /api/projects/NOT-A-UUID/groups
  2. Expected: 400 Bad Request with clear validation error
  3. Actual: Query is sent to Supabase which returns an error, resulting in a 500 or unhelpful error message
- **Affected files:** All route files under `src/app/api/projects/[id]/groups/`
- **Fix:** Add UUID format validation at the start of each route handler
- **Priority:** Nice to have

#### BUG-5: "Gruppe zuweisen" menu entry not shown when groups list is empty
- **Severity:** Low
- **Steps to Reproduce:**
  1. Have a project with drawings but no groups
  2. Open drawing action menu (three dots)
  3. Expected: "Gruppe zuweisen" is shown (it could open dialog showing only "Ohne Gruppe")
  4. Actual: "Gruppe zuweisen" menu entry is hidden because of `groups.length > 0` condition in DrawingCard.tsx line 132
- **Note:** This is arguably correct behavior (no point assigning to a group when none exist), but it means a drawing that was assigned to a group before it was archived cannot be explicitly unassigned via the menu if no other groups exist. The archiving process already sets group_id to NULL, so this is not a data integrity issue -- just a minor UX inconsistency.
- **Priority:** Nice to have

### Summary
- **Acceptance Criteria:** 18/20 passed (2 related to ilike pattern matching issue BUG-1)
- **Edge Cases:** 7/8 passed (1 related to BUG-1)
- **Bugs Found:** 5 total (0 critical, 0 high, 1 medium, 4 low)
- **Security:** One medium finding (ilike pattern matching), two low findings (no rate limiting, no UUID validation)
- **TypeScript Compilation:** PASS (0 errors)
- **Production Ready:** NOT READY -- BUG-1 (medium) should be fixed before deployment as it can cause false positive/negative duplicate detection for group names containing underscore or percent characters
- **Recommendation:** Fix BUG-1 (replace ilike with proper case-insensitive exact match), then re-test. BUG-2/3/4/5 can be deferred to next sprint.

## Deployment
_To be added by /deploy_

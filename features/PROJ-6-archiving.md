# PROJ-6: Archivierungssystem für Projekte und Zeichnungen

## Status: In Review
**Created:** 2026-03-13
**Last Updated:** 2026-03-18

## Dependencies
- Requires: PROJ-2 (Projektverwaltung) — Projekte können archiviert werden
- Requires: PROJ-3 (PDF Upload & Viewer) — Zeichnungen (PDFs) können archiviert werden

## Overview
Projekte und Zeichnungen (PDFs) können nicht gelöscht werden — weder aus Versehen noch absichtlich. Stattdessen gibt es eine Archivierungsfunktion: Archivierte Elemente verschwinden aus der Standardansicht, bleiben aber in der Datenbank und im Storage erhalten. Archivierte Elemente können jederzeit wiederhergestellt werden.

## User Stories
- Als Nutzer möchte ich ein Projekt archivieren statt löschen, damit ich keine Daten unwiederbringlich verliere.
- Als Nutzer möchte ich eine Zeichnung (PDF) archivieren statt löschen, damit verknüpfte Marker nicht unkontrolliert verloren gehen.
- Als Nutzer möchte ich archivierte Projekte in einer separaten "Archiv"-Ansicht einsehen können, damit ich auf ältere Projekte zugreifen kann.
- Als Nutzer möchte ich archivierte Zeichnungen innerhalb eines Projekts in einer Archiv-Ansicht sehen können, damit ich ältere Dokumente bei Bedarf wiederfinden kann.
- Als Nutzer möchte ich ein archiviertes Projekt oder eine archivierte Zeichnung wiederherstellen (de-archivieren), damit ich es erneut aktiv nutzen kann.
- Als Nutzer möchte ich beim Versuch, auf eine archivierte Zeichnung zu navigieren (z.B. über einen Marker), einen klaren Hinweis erhalten, dass das Dokument archiviert ist.

## Acceptance Criteria

### Archivierung
- [ ] Der "Löschen"-Button für Projekte wird durch "Archivieren" ersetzt (kein Löschen möglich)
- [ ] Der "Löschen"-Button für Zeichnungen (PDFs) wird durch "Archivieren" ersetzt (kein Löschen möglich)
- [ ] Vor dem Archivieren erscheint ein Bestätigungsdialog mit Hinweis auf die Auswirkungen
- [ ] Archivierte Projekte sind in der normalen Projektübersicht nicht mehr sichtbar
- [ ] Archivierte Zeichnungen sind in der normalen PDF-Liste eines Projekts nicht mehr sichtbar
- [ ] Archivierte Elemente werden in der Datenbank als `archived = true` markiert (kein Hard-Delete)
- [ ] Dateien in Supabase Storage werden beim Archivieren NICHT gelöscht

### Archiv-Ansicht
- [ ] In der Projektübersicht gibt es einen Toggle/Tab "Archiv", der archivierte Projekte anzeigt
- [ ] Innerhalb eines Projekts gibt es einen Toggle/Tab "Archiv", der archivierte Zeichnungen anzeigt
- [ ] Archivierte Elemente sind in der Archiv-Ansicht klar als "Archiviert" gekennzeichnet (Badge/Label)

### Wiederherstellung
- [ ] Archivierte Projekte können aus der Archiv-Ansicht heraus wiederhergestellt werden
- [ ] Archivierte Zeichnungen können aus der Archiv-Ansicht heraus wiederhergestellt werden
- [ ] Nach der Wiederherstellung erscheint das Element wieder in der normalen Ansicht

### Berechtigungen
- [ ] Nur der Projektersteller kann ein Projekt archivieren oder wiederherstellen
- [ ] Projektmitglieder (nicht Ersteller) können Zeichnungen archivieren oder wiederherstellen
- [ ] Archivierte Projekte sind für alle Projektmitglieder in der Archiv-Ansicht sichtbar

### Marker-Verhalten bei archivierten Zeichnungen
- [ ] Marker, die auf eine archivierte Zeichnung zeigen, bleiben in der Datenbank erhalten
- [ ] Beim Klick auf einen solchen Marker wird eine Meldung angezeigt: "Diese Zeichnung ist archiviert" mit Option zur Archiv-Ansicht zu springen

## Edge Cases
- Was passiert, wenn ein Projekt archiviert wird, das aktive Zeichnungen und Marker enthält? → Alle Inhalte bleiben erhalten; das Projekt und seine Inhalte sind über die Archiv-Ansicht zugänglich.
- Was passiert, wenn eine Zeichnung archiviert wird, auf die noch Marker anderer Zeichnungen zeigen? → Marker bleiben bestehen; beim Klick erscheint die Meldung "Diese Zeichnung ist archiviert".
- Was passiert, wenn man auf eine archivierte Zeichnung per Direktlink zugreift? → Nutzer sieht eine Info-Seite: "Diese Zeichnung ist archiviert" — kein Viewer wird geöffnet.
- Was passiert, wenn ein archiviertes Projekt wiederhergestellt wird? → Alle enthaltenen Zeichnungen werden ebenfalls wieder aktiv (sofern sie nicht einzeln archiviert wurden).
- Was passiert, wenn eine einzeln archivierte Zeichnung in einem aktiven Projekt wiederhergestellt wird? → Zeichnung erscheint wieder in der normalen PDF-Liste des Projekts.
- Kann ein Nutzer, der kein Projektersteller ist, ein Projekt archivieren? → Nein; nur der Ersteller kann das Projekt selbst archivieren. Fehlermeldung bei unberechtigtem Versuch.
- Kann ein Admin (PROJ-5) Projekte und Zeichnungen archivieren oder wiederherstellen? → Ja, Admins haben vollständige Archivierungs- und Wiederherstellungsrechte für alle Projekte.

## Technical Requirements
- Datenbankänderungen: `archived` Boolean-Spalte (default: `false`) in `projects` und `pdfs`/`documents`-Tabellen
- Optional: `archived_at` Timestamp für Audit-Zwecke
- RLS-Policies müssen archivierte Elemente standardmäßig aus normalen Abfragen ausschließen
- Kein Cascading Delete — alle Foreign-Key-Beziehungen bleiben beim Archivieren erhalten
- Supabase Storage: Keine Dateilöschung beim Archivieren

---
<!-- Sections below are added by subsequent skills -->

## Implementation Notes (2026-03-18)

### What already existed (from PROJ-2 and PROJ-3)
- `is_archived` boolean column on `projects` and `drawings` tables with indexes
- `POST /api/projects/[id]/archive` — archive a project
- `POST /api/projects/[id]/drawings/[drawingId]/archive` — archive a drawing
- `archiveProject()` and `archiveDrawing()` in hooks
- `ArchiveDrawingDialog` confirmation dialog
- Frontend filters out archived items from default views

### New — Restore API Endpoints
- `POST /api/projects/[id]/restore` — restore archived project (owner or admin only)
- `POST /api/projects/[id]/drawings/[drawingId]/restore` — restore archived drawing (project member)

### New — Hook Extensions
- `restoreProject(id)` added to `useProjects` hook
- `restoreDrawing(drawingId)` added to `useDrawings` hook
- `archivedProjects` state + `fetchArchivedProjects()` added to `useProjects` hook

### New — Archive UI
- Dashboard (`/dashboard`): Tabs "Aktiv" / "Archiv" for projects with restore buttons
- Project detail page: Tabs "Aktiv" / "Archiv" for drawings with restore buttons
- Archived items show "Archiviert" badge and placeholder icon
- Restore button with loading state

### Design Decisions
- No hard delete anywhere — archive only (per spec)
- Project restore requires ownership or admin role
- Drawing restore only requires project membership
- Archived drawing count shown as badge on the archive tab
- Storage files are never deleted when archiving

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results

**Tested:** 2026-03-18
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Static code review of all implementation files + architecture analysis

### Acceptance Criteria Status

#### AC-1: Der "Loeschen"-Button fuer Projekte wird durch "Archivieren" ersetzt (kein Loeschen moeglich)
- [x] `ProjectCard` dropdown shows "Archivieren" option (owner only)
- [x] No "Loeschen" option exists for projects anywhere in the UI
- [x] No DELETE RLS policy on `projects` table -- deletion denied by default
- [x] No DELETE API route exists for projects
- **PASS**

#### AC-2: Der "Loeschen"-Button fuer Zeichnungen wird durch "Archivieren" ersetzt
- [x] `DrawingCard` dropdown shows "Archivieren" option
- [x] No "Loeschen" option exists for drawings in the UI
- [x] No DELETE RLS policy on `drawings` table
- [x] No DELETE API route for drawings
- **PASS**

#### AC-3: Vor dem Archivieren erscheint ein Bestaetigungsdialog mit Hinweis auf Auswirkungen
- [x] Project archive: `AlertDialog` with message mentioning PDFs and markers preserved
- [x] Drawing archive: `ArchiveDrawingDialog` (shadcn AlertDialog) with confirmation
- [x] Both use shadcn/ui AlertDialog (correct per conventions)
- **PASS**

#### AC-4: Archivierte Projekte sind in der normalen Projektuebersicht nicht mehr sichtbar
- [x] `useProjects.fetchProjects()` filters with `.eq("is_archived", false)`
- [x] Only active projects shown in the "Aktiv" tab
- **PASS**

#### AC-5: Archivierte Zeichnungen sind in der normalen PDF-Liste nicht mehr sichtbar
- [x] `GET /api/projects/[id]/drawings` filters with `.eq("is_archived", false)`
- [x] Project detail page active tab: `drawings.filter((d) => !d.is_archived)`
- **PASS**

#### AC-6: Archivierte Elemente werden in der Datenbank als archived = true markiert (kein Hard-Delete)
- [x] Project archive: `.update({ is_archived: true })` -- no row deletion
- [x] Drawing archive: `.update({ is_archived: true })` -- no row deletion
- [x] `is_archived` boolean column exists on both `projects` and `drawings` tables
- **PASS**

#### AC-7: Dateien in Supabase Storage werden beim Archivieren NICHT geloescht
- [x] Archive API routes only update the `is_archived` flag
- [x] No `storage.from("drawings").remove()` call in any archive logic
- [x] No Storage DELETE RLS policy exists
- **PASS**

#### AC-8: In der Projektuebersicht gibt es einen Toggle/Tab "Archiv" fuer archivierte Projekte
- [x] Dashboard page has shadcn/ui `Tabs` with "Aktiv" and "Archiv" tabs
- [x] Archived tab fetches archived projects via `fetchArchivedProjects()`
- [x] Lazy loading: archived projects only fetched when tab is selected
- **PASS**

#### AC-9: Innerhalb eines Projekts gibt es einen Toggle/Tab "Archiv" fuer archivierte Zeichnungen
- [x] Project detail page has shadcn/ui `Tabs` with "Aktiv" and "Archiv" tabs in the drawings section
- [x] Archive tab shows count badge when archived drawings exist
- [x] Archived drawings displayed with Archive icon placeholder instead of thumbnail
- **PASS**

#### AC-10: Archivierte Elemente sind in der Archiv-Ansicht klar als "Archiviert" gekennzeichnet
- [x] Archived projects show `Badge variant="secondary"` with text "Archiviert"
- [x] Archived drawings show `Badge variant="secondary"` with text "Archiviert"
- **PASS**

#### AC-11: Archivierte Projekte koennen wiederhergestellt werden
- [x] Restore button ("Wiederherstellen" with RotateCcw icon) on each archived project card
- [x] `POST /api/projects/[id]/restore` sets `is_archived: false`
- [x] Loading state during restore with Loader2 spinner
- [x] Toast notification on success/failure
- [x] After restore: project disappears from archive tab (via fetchArchivedProjects) and appears in active tab (via fetchProjects)
- **PASS**

#### AC-12: Archivierte Zeichnungen koennen wiederhergestellt werden
- [x] Restore button on each archived drawing card
- [x] `POST /api/projects/[id]/drawings/[drawingId]/restore` sets `is_archived: false`
- [x] Loading state during restore
- [x] Toast notification on success/failure
- [x] After restore: drawing reappears in active drawings list (via fetchDrawings)
- **PASS**

#### AC-13: Nach der Wiederherstellung erscheint das Element wieder in der normalen Ansicht
- [x] Project restore calls both `fetchProjects()` and `fetchArchivedProjects()` to update both lists
- [x] Drawing restore calls `fetchDrawings()` which re-fetches all drawings
- **PASS**

#### AC-14: Nur der Projektersteller kann ein Projekt archivieren oder wiederherstellen
- [x] Archive: ProjectCard only shows archive option when `project.role === "owner"`
- [x] Archive API: relies on RLS UPDATE policy (owner only)
- [x] Restore API: explicitly checks `membership?.role === "owner"` OR `profile?.is_admin`
- [ ] BUG: The archive API route (`POST /api/projects/[id]/archive`) does NOT explicitly check ownership -- it relies entirely on RLS. However, the Supabase RLS UPDATE policy for projects only allows owners. If RLS is ever misconfigured, any project member could archive. The restore route is more secure because it explicitly checks role. See BUG-1.
- **PASS** (RLS enforces correctly, but inconsistent defense-in-depth)

#### AC-15: Projektmitglieder (nicht Ersteller) koennen Zeichnungen archivieren oder wiederherstellen
- [x] Archive drawing: API checks project membership (any member can archive)
- [x] Restore drawing: API checks project membership (any member can restore)
- [x] RLS allows UPDATE for any project member on drawings
- **PASS**

#### AC-16: Archivierte Projekte sind fuer alle Projektmitglieder in der Archiv-Ansicht sichtbar
- [x] `fetchArchivedProjects` queries `project_members` for current user, then fetches archived projects
- [x] RLS SELECT policy on projects allows all project members to view (including archived)
- **PASS**

#### AC-17: Marker auf archivierte Zeichnung -- Hinweis angezeigt
- [x] `handleMarkerClick` in viewer page checks `marker.target_drawing.is_archived`
- [x] Shows toast.error "Diese Zeichnung ist archiviert."
- [ ] BUG: Spec says "mit Option zur Archiv-Ansicht zu springen" but the current implementation only shows a toast error message. There is no link or button to navigate to the archive view of the project. See BUG-2.
- **PARTIAL PASS** (message shown, but no navigation to archive view)

### Edge Cases Status

#### EC-1: Projekt archiviert das aktive Zeichnungen und Marker enthaelt
- [x] Archive only sets `is_archived = true` on the project
- [x] Drawings and markers remain untouched in the database
- [x] Access via archive view still possible
- **PASS**

#### EC-2: Zeichnung archiviert auf die Marker anderer Zeichnungen zeigen
- [x] Marker remains in database (no CASCADE on archive)
- [x] `MarkerWithTarget` join returns `is_archived: true` for the target drawing
- [x] Marker shown in gray (muted) color, tooltip shows "Zeichnung archiviert"
- [x] Click shows toast error
- **PASS**

#### EC-3: Archivierte Zeichnung per Direktlink zugreifen
- [ ] BUG: Spec says "Nutzer sieht eine Info-Seite: 'Diese Zeichnung ist archiviert' -- kein Viewer wird geoeffnet." However, the viewer page loads drawings from `useDrawings` which fetches non-archived drawings. If the active drawing is archived, `drawings.find((d) => d.id === activeDrawingId)` returns `undefined`, and the page shows "Zeichnung" as display name with the PDF still loading via signed URL (which would succeed since the file is still in Storage). There is no explicit check for archived status on the drawing being viewed. See BUG-3.
- **FAIL**

#### EC-4: Archiviertes Projekt wiederhergestellt -- enthaltene Zeichnungen
- [x] Restore only sets `is_archived = false` on the project
- [x] Individually archived drawings remain archived (separate `is_archived` flag on drawings)
- [x] Spec says "sofern sie nicht einzeln archiviert wurden" -- correctly handled
- **PASS**

#### EC-5: Einzeln archivierte Zeichnung in aktivem Projekt wiederhergestellt
- [x] Drawing restore sets `is_archived = false` on the specific drawing
- [x] Drawing reappears in active drawings list
- [x] No impact on project archive status
- **PASS**

#### EC-6: Nicht-Ersteller versucht Projekt zu archivieren
- [x] UI: archive option not shown for non-owners in ProjectCard
- [x] RLS: UPDATE policy restricts to owners
- [x] If called via console: RLS blocks, generic error shown
- **PASS**

#### EC-7: Admin kann Projekte und Zeichnungen archivieren/wiederherstellen
- [x] Restore project route checks `profile?.is_admin === true` as alternative to owner
- [ ] BUG: The archive project route does NOT check admin status. It relies on RLS which has an admin UPDATE policy (from PROJ-5 migration). So admins CAN archive projects via RLS, but if the admin is not a project member, the direct API route may not work because the RLS also checks project membership for UPDATE. Need to verify the exact RLS policy. See BUG-4.
- [ ] BUG: Drawing archive and restore routes do not check admin status. They only check project membership. An admin who is not a project member cannot archive/restore drawings. The spec says "Admins haben vollstaendige Archivierungs- und Wiederherstellungsrechte fuer alle Projekte." See BUG-5.
- **PARTIAL PASS**

### Cross-Browser Assessment (Code Review)

#### Chrome (latest)
- [x] Standard React/shadcn/ui Tabs component -- no browser-specific issues
- [x] Toast notifications (sonner) work across browsers
- **PASS (expected)**

#### Firefox (latest)
- [x] No Firefox-specific API usage
- **PASS (expected)**

#### Safari (latest)
- [x] No Safari-specific issues detected
- **PASS (expected)**

### Responsive Assessment (Code Review)

#### Mobile (375px)
- [x] Dashboard tabs: shadcn/ui TabsList handles responsive layout
- [x] Archived project cards: use same grid layout as active cards
- [x] Archived drawing cards: 2-column grid on mobile (`grid-cols-2`)
- [x] Restore button is full-width (`w-full`) -- easy to tap
- **PASS**

#### Tablet (768px)
- [x] 2-column grid for projects, 2-column for drawings
- **PASS**

#### Desktop (1440px)
- [x] 3-column grid for projects, 3-column for drawings
- [x] Max-width containers prevent excessive stretching
- **PASS**

### Security Audit Results (Red Team)

#### Authentication
- [x] All restore API routes call `supabase.auth.getUser()` and reject with 401
- [x] Archive routes also verify authentication
- **PASS**

#### Authorization
- [x] Project restore: checks ownership OR admin
- [x] Drawing restore: checks project membership
- [x] Project archive: relies on RLS (owner only)
- [x] Drawing archive: checks project membership
- [ ] BUG-SEC-1: Inconsistent authorization patterns. Project restore explicitly checks role, but project archive relies entirely on RLS. Both should have explicit checks for consistency and defense-in-depth. See BUG-1.
- [ ] BUG-SEC-2: Admin access to drawing archive/restore not implemented. See BUG-5.

#### Input Validation
- [x] Restore routes only perform `update({ is_archived: false })` -- no user input beyond the project/drawing ID (from URL)
- [x] Archive routes only perform `update({ is_archived: true })` -- minimal attack surface
- [x] IDs come from URL parameters (validated as UUID by Supabase)
- **PASS**

#### Rate Limiting
- [ ] BUG: No rate limiting on archive/restore endpoints. Rapid toggle between archive and restore could create excessive database writes. Severity: Low (limited impact).

#### Restore of Already-Active Items
- [x] Restore routes filter `.eq("is_archived", true)` -- restoring an already-active project/drawing returns an error (`.single()` will fail)
- **PASS**

### Regression Testing

#### PROJ-1 (User Authentication) - Status: In Review
- [x] No changes to auth flow
- **No regression detected**

#### PROJ-2 (Projektverwaltung) - Status: In Review
- [x] Dashboard page significantly modified (archive tabs added)
- [x] `useProjects` hook extended with `restoreProject`, `archivedProjects`, `fetchArchivedProjects`
- [x] Existing project CRUD not affected
- [x] Archive confirmation dialog now uses shadcn/ui AlertDialog (previously was custom modal per PROJ-2 BUG-11 -- this appears FIXED)
- **No regression detected** (PROJ-2 BUG-11 appears fixed)

#### PROJ-3 (PDF Upload & Viewer) - Status: In Review
- [x] `useDrawings` hook extended with `restoreDrawing`
- [x] Project detail page modified with archive tabs for drawings
- [x] Upload, rename, archive drawing functionality unchanged
- **No regression detected**

#### PROJ-4 (Marker-System) - Status: In Review
- [x] Marker viewer page handles archived target drawings correctly
- [x] MarkerTooltip shows archive indicator for archived targets
- **No regression detected**

#### PROJ-5 (Admin-Bereich) - Status: In Review
- [x] Admin link in dashboard header unchanged
- [x] Admin panel not modified
- **No regression detected**

### Bugs Found

#### BUG-1: Project Archive Route Lacks Explicit Ownership Check
- **Severity:** Medium (Security)
- **Steps to Reproduce:**
  1. Review `src/app/api/projects/[id]/archive/route.ts`
  2. The route authenticates the user but does not check if they are the project owner
  3. It relies entirely on RLS UPDATE policy for authorization
  4. Compare with `src/app/api/projects/[id]/restore/route.ts` which explicitly checks `membership?.role === "owner"`
  5. Expected: Both archive and restore routes should have explicit role checks
  6. Actual: Archive route has no explicit role check (RLS blocks unauthorized access, but error message is generic)
- **Priority:** Fix before deployment (defense-in-depth)

#### BUG-2: Archived Drawing Marker Click Has No Navigation to Archive View
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Have Drawing A with a marker pointing to Drawing B
  2. Archive Drawing B
  3. Open Drawing A in the viewer
  4. Click the marker that points to archived Drawing B
  5. Expected: Message "Diese Zeichnung ist archiviert" WITH an option to jump to the archive view
  6. Actual: Only a toast error message shown. No button/link to navigate to the project's archive tab where the drawing can be found.
- **Affected File:** `src/app/(protected)/dashboard/projects/[id]/drawings/[drawingId]/page.tsx` lines 158-161
- **Priority:** Fix in next sprint

#### BUG-3: Archived Drawing Accessible via Direct URL (No Archive Guard)
- **Severity:** High
- **Steps to Reproduce:**
  1. Archive a drawing in a project
  2. Navigate directly to `/dashboard/projects/{projectId}/drawings/{archivedDrawingId}`
  3. Expected: Info page "Diese Zeichnung ist archiviert" -- viewer should NOT open
  4. Actual: The viewer page loads and attempts to render the PDF. The drawing may not appear in the `drawings` list (fetched with `is_archived: false`), causing `drawing` to be undefined, but the signed URL may still work because Storage does not check archive status. The user sees "Zeichnung" as the display name but the PDF might still render.
- **Affected File:** `src/app/(protected)/dashboard/projects/[id]/drawings/[drawingId]/page.tsx`
- **Priority:** Fix before deployment

#### BUG-4: Admin Cannot Archive Projects They Are Not Members Of (Inconsistency)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Admin user who is NOT a member of Project X
  2. Try to archive Project X (would need to call API directly)
  3. Expected: Admin can archive any project per spec
  4. Actual: The archive route has no admin check. RLS may allow or block depending on admin-specific policies from PROJ-5 migration (admin UPDATE policy exists on projects). If the admin policy allows updates, it works. If not, admin is blocked.
- **Affected File:** `src/app/api/projects/[id]/archive/route.ts`
- **Priority:** Fix in next sprint (verify RLS policy covers this case)

#### BUG-5: Admin Cannot Archive/Restore Drawings in Projects They Are Not Members Of
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Admin user who is NOT a member of a project
  2. Try to restore an archived drawing in that project
  3. Expected: Admin can manage all projects per spec ("Admins haben vollstaendige Archivierungs- und Wiederherstellungsrechte")
  4. Actual: Drawing archive/restore routes only check project membership, not admin status. Admin without membership is blocked with 403.
- **Affected Files:** `src/app/api/projects/[id]/drawings/[drawingId]/archive/route.ts`, `src/app/api/projects/[id]/drawings/[drawingId]/restore/route.ts`
- **Priority:** Fix in next sprint

#### BUG-6: Archived Projects fetchArchivedProjects Silently Swallows Errors
- **Severity:** Low
- **Steps to Reproduce:**
  1. Review `src/hooks/use-projects.ts` lines 134-178
  2. `fetchArchivedProjects` has `catch { // silently fail for archived list }`
  3. Expected: Some form of error feedback
  4. Actual: Errors are silently swallowed. If the archive list fails to load, user sees an empty list with no indication of failure.
- **Priority:** Nice to have

### Summary
- **Acceptance Criteria:** 15/17 passed, 1 partial (AC-17 no archive navigation link), 0 failed
- **Edge Cases:** 5/7 passed, 1 failed (EC-3 direct URL access to archived drawing), 1 partial (EC-7 admin rights)
- **Bugs Found:** 6 total (0 critical, 1 high, 4 medium, 1 low)
- **Security:** Issues found (inconsistent authorization, admin access gaps)
- **Production Ready:** NO
- **Recommendation:** Fix BUG-3 (archived drawing accessible via direct URL) before deployment. BUG-1 (archive route authorization), BUG-4, and BUG-5 (admin access) should be addressed in the next sprint. BUG-2 (archive navigation link) and BUG-6 (error handling) are nice-to-have.

## Deployment
_To be added by /deploy_

# PROJ-4: Marker-System mit Navigation & Verlauf

## Status: In Review
**Created:** 2026-03-13
**Last Updated:** 2026-03-18

## Dependencies
- Requires: PROJ-3 (PDF Upload & Viewer) — Marker werden auf angezeigten PDFs platziert

## Overview
Nutzer können auf einer PDF-Seite Marker (Pin-Punkte) setzen und diese mit einer anderen PDF im selben Projekt verknüpfen. Beim Hover über einen Marker wird der Name und eine Vorschau der Ziel-PDF angezeigt. Beim Klick öffnet sich die Ziel-PDF. Eine Navigationshistorie (Breadcrumb-Leiste) zeigt den Pfad der besuchten PDFs an und ermöglicht das Zurückspringen zu einem früheren Dokument.

## User Stories
- Als Nutzer möchte ich im Bearbeitungsmodus einen Marker auf eine beliebige Stelle einer PDF-Seite setzen können.
- Als Nutzer möchte ich beim Setzen eines Markers eine Ziel-PDF aus dem gleichen Projekt auswählen und dem Marker einen Namen geben.
- Als Nutzer möchte ich einen bestehenden Marker verschieben, umbenennen oder löschen können.
- Als Nutzer möchte ich im Anzeigemodus mit der Maus über einen Marker fahren, um den Namen und eine Vorschau der Ziel-PDF zu sehen.
- Als Nutzer möchte ich auf einen Marker klicken, damit sich die verknüpfte Ziel-PDF öffnet.
- Als Nutzer möchte ich nach mehreren Marker-Klicks in der Navigationshistorie sehen, welche PDFs ich besucht habe (Breadcrumb-Pfad).
- Als Nutzer möchte ich in der Navigationshistorie auf einen früheren Eintrag klicken, um direkt zu dieser PDF zurückzuspringen.
- Als Nutzer möchte ich die Navigationshistorie löschen/zurücksetzen können.

## Acceptance Criteria
- [ ] Im Bearbeitungsmodus (Edit-Toggle) kann der Nutzer durch Klick auf die PDF-Seite einen neuen Marker platzieren
- [ ] Beim Platzieren öffnet sich ein Dialog: Marker-Name (Pflichtfeld) + Auswahl der Ziel-PDF (Dropdown mit allen PDFs im Projekt)
- [ ] Marker wird als sichtbarer Pin (Icon + Name) auf der PDF-Seite angezeigt
- [ ] Im Anzeigemodus (kein Edit): Hover über Marker zeigt Tooltip mit Marker-Name + Thumbnail der ersten Seite der Ziel-PDF
- [ ] Klick auf Marker im Anzeigemodus öffnet die Ziel-PDF im Viewer
- [ ] Marker können nicht auf die eigene PDF (aktuelle PDF) zeigen
- [ ] Im Bearbeitungsmodus: Marker kann per Drag & Drop verschoben werden
- [ ] Im Bearbeitungsmodus: Rechtsklick auf Marker öffnet Kontextmenü (Umbenennen / Ziel ändern / Löschen)
- [ ] Navigationshistorie: Nach dem Öffnen der ersten PDF via Marker erscheint eine Breadcrumb-Leiste oben im Viewer
- [ ] Breadcrumb zeigt den vollständigen Pfad: "PDF A → PDF B → PDF C (aktuell)"
- [ ] Klick auf einen früheren Breadcrumb-Eintrag öffnet die entsprechende PDF und entfernt alle nachfolgenden Einträge aus der History
- [ ] "Navigation zurücksetzen"-Button löscht die gesamte Navigationshistorie
- [ ] Navigationshistorie ist session-basiert (wird beim Seitenwechsel/Neuladen zurückgesetzt)
- [ ] Marker-Positionen sind relativ zur Seitengröße gespeichert (skalieren korrekt bei Zoom)

## Edge Cases
- Was passiert wenn die Ziel-PDF eines Markers gelöscht wurde? → Marker bleibt sichtbar, aber beim Klick erscheint eine Fehlermeldung: "Zieldokument wurde gelöscht. Bitte Marker neu verknüpfen."
- Was passiert wenn man denselben Marker mehrfach hintereinander klickt (Endlosschleife)? → Marker können nicht auf die eigene PDF zeigen (verhindert direkte Loops); bei indirekten Loops (A→B→A) wird die History trotzdem aufgebaut, kein automatischer Stopp
- Was passiert wenn viele Marker auf einer Seite dicht beieinander liegen? → Marker werden übereinander angezeigt; bei Überlappung werden sie leicht versetzt dargestellt
- Was passiert wenn die PDF beim Zoom skaliert wird? → Marker-Positionen skalieren mit (prozentuale Positionierung relativ zur Seitengröße)
- Was passiert wenn ein Nutzer einen Marker setzt, während ein anderer die PDF gerade anschaut? → Marker erscheint beim anderen Nutzer nach einem Reload/Refresh
- Was passiert wenn der Marker-Name sehr lang ist? → Wird im Tooltip/Pin auf max. 50 Zeichen begrenzt und mit "…" abgeschnitten

## Technical Requirements
- Marker-Positionen: Gespeichert als relative Koordinaten (x%, y% der Seitengröße) in der Datenbank
- Datenbank: `markers` Tabelle mit `pdf_id`, `page_number`, `x_percent`, `y_percent`, `name`, `target_pdf_id`
- Hover-Tooltip: Thumbnail wird aus dem bereits gerenderten ersten Seiten-Canvas der Ziel-PDF erstellt
- Navigationshistorie: Client-seitiger State (React useState / Context), nicht persistiert
- RLS: Nur Projektmitglieder dürfen Marker lesen/schreiben

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## Backend Implementation Notes (2026-03-18)

### Database
- Migration: `supabase/migrations/006_markers.sql`
- Table `markers` with columns: id, drawing_id, target_drawing_id, project_id, name, page_number, x_percent, y_percent, created_by, created_at, updated_at
- RLS enabled: all CRUD policies scoped to project membership
- DB constraints: no self-reference (drawing_id != target_drawing_id), same-project check trigger
- ON DELETE CASCADE on target_drawing_id (marker deleted when target drawing is deleted)
- ON DELETE CASCADE on drawing_id (markers deleted when source drawing is deleted)
- Indexes on drawing_id, target_drawing_id, project_id, and composite (drawing_id, page_number)

### API Endpoints
- `GET /api/projects/[id]/drawings/[drawingId]/markers` — list markers with joined target drawing info
- `POST /api/projects/[id]/drawings/[drawingId]/markers` — create marker (Zod validated, max 100 per drawing)
- `PATCH /api/projects/[id]/drawings/[drawingId]/markers/[markerId]` — update marker (partial, Zod validated)
- `DELETE /api/projects/[id]/drawings/[drawingId]/markers/[markerId]` — delete marker

### Permissions
- All project members can create/read/update/delete any marker in their project
- No owner-only restrictions

### Validations
- name: 1-50 chars, trimmed
- page_number: integer >= 1
- x_percent/y_percent: number 0-100
- target_drawing_id: valid UUID, must exist in same project, must not be archived, must not equal drawing_id

### Files Created
- `supabase/migrations/006_markers.sql`
- `src/lib/types/marker.ts`
- `src/lib/validations/marker.ts`
- `src/app/api/projects/[id]/drawings/[drawingId]/markers/route.ts`
- `src/app/api/projects/[id]/drawings/[drawingId]/markers/[markerId]/route.ts`
- `src/hooks/use-markers.ts`

## Frontend Implementation Notes (2026-03-18)

### Components Created
- `src/components/drawings/MarkerPin.tsx` — Individual marker pin with icon, name label, color states (normal/archived/deleted)
- `src/components/drawings/MarkerOverlay.tsx` — Container overlay on PDF page, handles click-to-create, drag & drop, and delegates to child components
- `src/components/drawings/MarkerCreationDialog.tsx` — Dialog for creating markers: name input (1-50 chars) + target drawing dropdown
- `src/components/drawings/MarkerTooltip.tsx` — Hover tooltip with marker name, target drawing name, and PDF thumbnail preview
- `src/components/drawings/MarkerContextMenu.tsx` — Right-click context menu with rename, change target, and delete actions
- `src/components/drawings/NavigationBreadcrumb.tsx` — Breadcrumb bar showing navigation path with click-to-jump and clear button

### Page Integration
- `src/app/(protected)/dashboard/projects/[id]/drawings/[drawingId]/page.tsx` — Fully rewritten to integrate all marker functionality:
  - Edit/View mode toggle in header
  - Marker overlay rendered on top of PDF page (inside TransformComponent for zoom scaling)
  - Click-to-create markers in edit mode
  - Drag & drop repositioning in edit mode
  - Right-click context menu in edit mode
  - Hover tooltip with PDF thumbnail in view mode
  - Click-to-navigate in view mode
  - Client-side navigation history with breadcrumb (session-based)
  - In-page drawing switching (no full page reload when navigating via markers)
  - Panning disabled in edit mode to avoid conflicts with marker placement

### Design Decisions
- Navigation history is kept as React state (session-based, resets on page reload) per spec
- Marker positions scale with PDF zoom because they are rendered inside the TransformComponent
- Edit mode disables pan to allow clicking on the PDF to place markers
- Markers with deleted targets show in red, archived targets in gray

## QA Test Results

**Tested:** 2026-03-18
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Static code review of all implementation files + architecture analysis

### Acceptance Criteria Status

#### AC-1: Im Bearbeitungsmodus (Edit-Toggle) kann der Nutzer durch Klick auf die PDF-Seite einen neuen Marker platzieren
- [x] Edit/View mode toggle button in viewer header (`Pencil`/`Eye` icons)
- [x] `MarkerOverlay.handleOverlayClick` calculates xPercent/yPercent from click position
- [x] Click-to-create only fires in edit mode (`if (!editMode || dragging) return`)
- [x] Only overlay-direct clicks create markers (`if (e.target !== overlayRef.current) return`)
- [x] Edit mode indicator bar shown below header: "Bearbeitungsmodus -- Klicke auf die Zeichnung..."
- **PASS**

#### AC-2: Beim Platzieren oeffnet sich ein Dialog: Marker-Name (Pflichtfeld) + Auswahl der Ziel-PDF
- [x] `MarkerCreationDialog` opens when `creationPos !== null`
- [x] Name input with maxLength={50} and character counter
- [x] Target drawing select dropdown using shadcn `Select` component
- [x] Available drawings filtered: excludes current drawing and archived drawings
- [x] Submit button disabled when name empty or no target selected
- [x] Loading state during creation with Loader2 spinner
- [x] Dialog resets name and target on close
- **PASS**

#### AC-3: Marker wird als sichtbarer Pin (Icon + Name) auf der PDF-Seite angezeigt
- [x] `MarkerPin` renders `MapPin` icon from lucide-react with `fill="currentColor"`
- [x] Name label shown on hover via `opacity-0 group-hover/pin:opacity-100`
- [x] Color states: primary (normal), destructive (deleted target), muted (archived target)
- [x] Positioned via absolute positioning with `left: x_percent%`, `top: y_percent%`
- **PASS**

#### AC-4: Im Anzeigemodus: Hover zeigt Tooltip mit Marker-Name + Thumbnail der Ziel-PDF
- [x] `MarkerTooltip` renders on hover when `hoveredMarker` is set and not in context menu
- [x] Shows marker name, target drawing name with arrow, and PDF thumbnail via react-pdf
- [x] Fetches signed URL for target drawing thumbnail
- [x] Handles deleted target: shows "Zieldokument geloescht" with FileWarning icon
- [x] Handles archived target: shows "Zeichnung archiviert" with Archive icon
- [x] Positioned above marker using fixed positioning with transform translate
- [x] `pointer-events-none` prevents tooltip from interfering with marker interactions
- **PASS**

#### AC-5: Klick auf Marker im Anzeigemodus oeffnet die Ziel-PDF im Viewer
- [x] `handleMarkerClick` changes `activeDrawingId` state to target drawing ID
- [x] In-page navigation without full page reload (React state change only)
- [x] `useMarkers` hook re-fetches markers for the new drawing ID
- [x] Signed URL fetched for the new drawing
- [x] Deleted target: toast error "Zieldokument wurde geloescht. Bitte Marker neu verknuepfen."
- [x] Archived target: toast error "Diese Zeichnung ist archiviert."
- **PASS**

#### AC-6: Marker koennen nicht auf die eigene PDF zeigen
- [x] Client-side: `MarkerCreationDialog` filters out `currentDrawingId` from dropdown
- [x] Server-side: API POST route checks `target_drawing_id === drawingId` and returns 400
- [x] Server-side: API PATCH route checks `updates.target_drawing_id === drawingId` and returns 400
- [x] Database: `markers_no_self_reference` CHECK constraint (`drawing_id != target_drawing_id`)
- [x] Three layers of defense (UI, API, DB) -- excellent
- **PASS**

#### AC-7: Im Bearbeitungsmodus: Marker kann per Drag & Drop verschoben werden
- [x] `handleDragStart` attaches mousemove/mouseup listeners to document
- [x] During drag: visually updates marker position via direct DOM manipulation (`pinEl.style.left/top`)
- [x] On mouse up: calls `onMarkerDrag` with clamped coordinates (0-100)
- [x] Cursor changes to `cursor-grab` / `active:cursor-grabbing` in edit mode
- [x] Hovered marker cleared during drag to avoid tooltip interference
- [ ] BUG: Drag only works with mouse (mousemove/mouseup). Touch devices (touchstart/touchmove/touchend) are not handled. This means markers cannot be repositioned on mobile/tablet in edit mode. See BUG-1.
- **PARTIAL PASS** (works on desktop, not on touch devices)

#### AC-8: Im Bearbeitungsmodus: Rechtsklick oeffnet Kontextmenu (Umbenennen / Ziel aendern / Loeschen)
- [x] `onContextMenu` handler prevents default and opens `MarkerContextMenu`
- [x] Context menu shows three options: Umbenennen (Pencil), Ziel aendern (Link2), Loeschen (Trash2)
- [x] Rename mode: inline input with Enter to save, Escape to cancel
- [x] Retarget mode: dropdown select for new target drawing
- [x] Delete: confirmation via direct action with loading state
- [x] Click-outside and Escape-key close the menu
- [ ] BUG: Right-click context menu is not accessible on touch devices. There is no long-press handler as an alternative to right-click. See BUG-2.
- **PARTIAL PASS** (works on desktop, not on touch devices)

#### AC-9: Navigationshistorie: Breadcrumb-Leiste erscheint nach Marker-Navigation
- [x] `NavigationBreadcrumb` renders when `history.length > 0`
- [x] Uses shadcn/ui `Breadcrumb` components (BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator)
- [x] Positioned below header as a `bg-muted/50 border-b` bar
- [x] Only appears after first marker-based navigation (not on initial load)
- **PASS**

#### AC-10: Breadcrumb zeigt den vollstaendigen Pfad: "PDF A -> PDF B -> PDF C (aktuell)"
- [x] History entries rendered as clickable `BreadcrumbLink` elements
- [x] Current drawing name shown as final non-clickable `span` with `font-medium`
- [x] Separators between entries via `BreadcrumbSeparator`
- [x] Drawing names displayed (not IDs)
- **PASS**

#### AC-11: Klick auf frueheren Breadcrumb-Eintrag oeffnet PDF und entfernt nachfolgende
- [x] `handleBreadcrumbNavigate(index)` sets `activeDrawingId` to the clicked entry
- [x] History trimmed to `prev.slice(0, index)` -- removes clicked entry and all after it
- **PASS**

#### AC-12: "Navigation zuruecksetzen"-Button loescht die gesamte Navigationshistorie
- [x] X button in breadcrumb with `aria-label="Navigation zuruecksetzen"`
- [x] Calls `handleClearHistory` which sets `navHistory` to empty array
- [x] Breadcrumb bar disappears when history is empty (`if (history.length === 0) return null`)
- **PASS**

#### AC-13: Navigationshistorie ist session-basiert (wird bei Seitenwechsel/Neuladen zurueckgesetzt)
- [x] `navHistory` is React `useState` -- resets on component unmount/page reload
- [x] Not persisted in localStorage, sessionStorage, or database
- **PASS**

#### AC-14: Marker-Positionen sind relativ zur Seitengroesse gespeichert (skalieren korrekt bei Zoom)
- [x] Database stores `x_percent` and `y_percent` as DOUBLE PRECISION (0-100)
- [x] MarkerOverlay is rendered inside `TransformComponent` wrapper (react-zoom-pan-pinch)
- [x] Marker positions use CSS `left: x%`, `top: y%` relative to the overlay container
- [x] Overlay has `absolute inset-0` on the PDF page container -- scales with zoom
- **PASS**

### Edge Cases Status

#### EC-1: Ziel-PDF eines Markers geloescht
- [x] `MarkerWithTarget.target_drawing` is `null` when target is deleted (LEFT JOIN in query)
- [x] `MarkerPin` shows destructive (red) color when `!marker.target_drawing`
- [x] `handleMarkerClick` shows toast.error "Zieldokument wurde geloescht. Bitte Marker neu verknuepfen."
- [x] `MarkerTooltip` shows "Zieldokument geloescht" with FileWarning icon
- **PASS**

#### EC-2: Indirekte Loops (A -> B -> A)
- [x] Self-reference prevented at DB level, but A->B->A is allowed
- [x] History builds correctly: [A] then [A, B] when going back to A
- [x] No automatic loop detection per spec ("bei indirekten Loops wird die History trotzdem aufgebaut")
- **PASS** (matches spec)

#### EC-3: Viele Marker dicht beieinander
- [x] Markers overlay using absolute positioning -- they stack naturally via z-index
- [ ] BUG: Spec says "bei Ueberlappung werden sie leicht versetzt dargestellt" but there is no offset logic for overlapping markers. Markers at the same position will render exactly on top of each other, making the lower one inaccessible. See BUG-3.
- **FAIL** (no overlap offset implemented)

#### EC-4: PDF beim Zoom skaliert
- [x] MarkerOverlay inside TransformComponent -- positions scale with zoom
- **PASS**

#### EC-5: Marker gesetzt waehrend anderer Nutzer die PDF anschaut
- [x] Per spec: "Marker erscheint beim anderen Nutzer nach einem Reload/Refresh"
- [x] No real-time subscription -- markers fetched once on load/navigation
- [x] `refetch` available for manual refresh
- **PASS** (matches spec -- no real-time required)

#### EC-6: Marker-Name sehr lang
- [x] Name limited to 50 chars via Zod validation and DB CHECK constraint
- [x] `MarkerPin` truncates at 30 chars with ellipsis for the on-PDF label
- [x] `MarkerTooltip` uses `truncate` CSS class on the name
- [x] `MarkerCreationDialog` input has `maxLength={50}` and shows character counter
- **PASS**

### Cross-Browser Assessment (Code Review)

#### Chrome (latest)
- [x] Standard React/Next.js patterns, no Chrome-specific issues
- [x] Context menu via `onContextMenu` works in Chrome
- [x] Drag & drop via document mouse listeners works in Chrome
- **PASS (expected)**

#### Firefox (latest)
- [x] `onContextMenu` event handler correctly calls `e.preventDefault()` to suppress native menu
- [x] Standard DOM event listeners for drag -- no Firefox issues expected
- **PASS (expected)**

#### Safari (latest)
- [x] Standard event handling -- no Safari-specific API usage detected
- [ ] NOTE: `onContextMenu` behavior can vary on Safari mobile (long-press may trigger system menus)
- **PASS (expected on desktop; mobile behavior unverified)**

### Responsive Assessment (Code Review)

#### Mobile (375px)
- [x] Viewer header uses `flex-wrap` for controls wrapping
- [x] Drawing name truncated with `max-w-[200px]` on mobile
- [x] Breadcrumb text uses `text-xs` for compact display
- [ ] BUG: Marker drag only handles mouse events, not touch events -- markers cannot be repositioned on mobile. See BUG-1.
- [ ] BUG: Right-click context menu unavailable on touch devices. See BUG-2.
- [ ] BUG: MarkerOverlay `pointerEvents` set to `"none"` in view mode, but the child marker divs set `pointerEvents: "auto"`. On small screens with many markers, the pin targets (24x24 px icons) may be too small to tap accurately.
- **FAIL** (touch interactions broken)

#### Tablet (768px)
- [x] Viewer layout works at tablet width
- [x] Same touch issues as mobile apply
- **PARTIAL PASS** (touch issues)

#### Desktop (1440px)
- [x] Full viewer layout works well
- [x] All interactions (click, hover, right-click, drag) work on desktop
- **PASS**

### Security Audit Results (Red Team)

#### Authentication
- [x] All marker API routes call `supabase.auth.getUser()` and reject with 401 if unauthenticated
- [x] Middleware redirects unauthenticated users for page routes
- **PASS**

#### Authorization (Horizontal Privilege Escalation)
- [x] All API routes verify project membership via `project_members` table before processing
- [x] RLS policies enforce project membership for all CRUD operations
- [x] Markers scoped by `drawing_id`, `project_id`, and `markerId` in queries (triple-filter)
- [x] PATCH and DELETE routes filter by all three IDs: `.eq("id", markerId).eq("drawing_id", drawingId).eq("project_id", projectId)`
- [x] CREATE route verifies both source and target drawings belong to the same project
- **PASS**

#### Input Validation
- [x] Server-side: Zod schemas validate all inputs (createMarkerSchema, updateMarkerSchema)
- [x] `name`: 1-50 chars, trimmed
- [x] `page_number`: integer >= 1
- [x] `x_percent` / `y_percent`: number 0-100
- [x] `target_drawing_id`: valid UUID regex
- [x] DB constraints mirror Zod validation (defense-in-depth)
- [x] Invalid JSON body returns 400
- **PASS**

#### Self-Reference Prevention
- [x] API layer: `target_drawing_id === drawingId` check on create and update
- [x] DB constraint: `markers_no_self_reference CHECK (drawing_id != target_drawing_id)`
- [x] UI layer: dropdown excludes current drawing
- **PASS** (triple defense)

#### Cross-Project Marker Injection
- [x] API CREATE route verifies both source and target drawings have `project_id = projectId`
- [x] DB trigger `check_markers_same_project` verifies both drawings belong to the marker's project
- [ ] BUG-SEC-1: The `check_markers_same_project()` function uses `SECURITY DEFINER` without `SET search_path`. Same issue as PROJ-1 BUG-9 (handle_new_user). A search_path injection could theoretically bypass the same-project check. See BUG-4.
- **PARTIAL PASS** (functional but SECURITY DEFINER not hardened)

#### Rate Limiting
- [ ] BUG-SEC-2: No rate limiting on marker API endpoints. An attacker could create markers rapidly up to the 100-per-drawing limit, or spam update/delete requests. See BUG-5.

#### Data Exposure
- [x] Marker API responses include `target_drawing.storage_path` via the joined query. This leaks internal storage paths but is not directly exploitable since Storage requires auth and signed URLs.
- [x] All marker data scoped to project membership via RLS

#### XSS Prevention
- [x] Marker names rendered via React JSX auto-escaping (`{marker.name}`, `{truncatedName}`)
- [x] No use of `dangerouslySetInnerHTML`
- **PASS**

#### Max Markers Limit
- [x] POST route enforces `MAX_MARKERS_PER_DRAWING = 100` with count check before insert
- [x] Clear error message returned when limit reached
- **PASS**

### Regression Testing

#### PROJ-1 (User Authentication) - Status: In Review
- [x] Middleware unchanged -- auth flow still works
- [x] No modifications to auth components
- **No regression detected**

#### PROJ-2 (Projektverwaltung) - Status: In Review
- [x] Project management pages not modified by PROJ-4
- [x] Project detail page unchanged (drawings section was modified by PROJ-3, not PROJ-4)
- **No regression detected**

#### PROJ-3 (PDF Upload & Viewer) - Status: In Review
- [x] Viewer page fully rewritten for PROJ-4 integration
- [x] PDF rendering still uses react-pdf with same configuration
- [x] Zoom/pan still works via react-zoom-pan-pinch (panning disabled in edit mode only)
- [x] Page navigation still present with same controls
- [ ] NOTE: `getSignedUrl` is now wrapped in `useCallback` in `use-drawings.ts` (line 152). This may fix the infinite re-render risk identified in PROJ-3 BUG-8/BUG-9. However, `fetchUrl` in the viewer page depends on both `activeDrawingId` and `getSignedUrl`, and `getSignedUrl` depends on `projectId`. Since `projectId` does not change during marker navigation, this should be stable. The previous PROJ-3 BUG-8/BUG-9 appear to be FIXED.
- **No regression detected** (PROJ-3 BUG-8/BUG-9 appear fixed)

### Bugs Found

#### BUG-1: Marker Drag & Drop Does Not Work on Touch Devices
- **Severity:** High
- **Steps to Reproduce:**
  1. Open a drawing in the viewer on a mobile/tablet device
  2. Switch to edit mode
  3. Try to drag a marker to reposition it
  4. Expected: Marker moves with the finger
  5. Actual: Only mouse events (mousedown/mousemove/mouseup) are handled. No touch event handlers (touchstart/touchmove/touchend) exist. Markers cannot be repositioned on touch devices.
- **Affected File:** `src/components/drawings/MarkerOverlay.tsx` lines 68-125 (handleDragStart)
- **Priority:** Fix before deployment

#### BUG-2: Right-Click Context Menu Not Accessible on Touch Devices
- **Severity:** High
- **Steps to Reproduce:**
  1. Open a drawing in the viewer on a mobile/tablet device
  2. Switch to edit mode
  3. Try to access rename/retarget/delete for a marker
  4. Expected: Long-press or alternative gesture opens context menu
  5. Actual: `onContextMenu` only fires on right-click (desktop). No long-press handler exists as an alternative. Touch users cannot rename, change target, or delete markers.
- **Affected File:** `src/components/drawings/MarkerOverlay.tsx` line 167 (onContextMenu), `src/components/drawings/MarkerContextMenu.tsx`
- **Priority:** Fix before deployment

#### BUG-3: Overlapping Markers Not Offset as Specified
- **Severity:** Medium
- **Steps to Reproduce:**
  1. In edit mode, place two markers at the same or very close positions
  2. Expected: Markers are "leicht versetzt dargestellt" (slightly offset) per edge case spec
  3. Actual: Markers render at exact positions without any offset logic. Overlapping markers stack directly on top of each other, making the lower marker inaccessible.
- **Affected File:** `src/components/drawings/MarkerOverlay.tsx`
- **Priority:** Fix in next sprint

#### BUG-4: check_markers_same_project() Uses SECURITY DEFINER Without search_path
- **Severity:** Medium (Security)
- **Steps to Reproduce:**
  1. Review `supabase/migrations/006_markers.sql` line 145
  2. `check_markers_same_project()` is declared with `SECURITY DEFINER` but no `SET search_path`
  3. Expected: `SET search_path = public` should be set to prevent search_path injection
  4. Actual: No search_path restriction. This is the same class of issue as PROJ-1 BUG-9.
- **Affected File:** `supabase/migrations/006_markers.sql` line 145
- **Priority:** Fix before deployment

#### BUG-5: No Rate Limiting on Marker API Endpoints
- **Severity:** Medium (Security)
- **Steps to Reproduce:**
  1. Write a script that calls POST/PATCH/DELETE marker endpoints in a tight loop
  2. Expected: Requests are rate-limited
  3. Actual: No application-level rate limiting
- **Affected Files:** All marker API routes
- **Priority:** Fix in next sprint

#### BUG-6: Marker Name Label Only Visible on Hover (Touch Accessibility)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. View markers on a PDF page on a touch device
  2. Expected: Marker names should be visible or accessible
  3. Actual: `MarkerPin` name label has `opacity-0 group-hover/pin:opacity-100`. On touch devices there is no hover, so the name label is never visible -- users only see the pin icon without knowing what it links to. They must tap to see the tooltip (which does work in view mode).
- **Affected File:** `src/components/drawings/MarkerPin.tsx` line 54
- **Priority:** Fix before deployment

#### BUG-7: MarkerContextMenu Is a Custom Component Instead of shadcn/ui ContextMenu
- **Severity:** Low
- **Steps to Reproduce:**
  1. Review `src/components/drawings/MarkerContextMenu.tsx`
  2. It is a custom `fixed z-50` div with manual click-outside and Escape handlers
  3. Expected: Use shadcn/ui `ContextMenu` component (Radix-based) for consistent UX and accessibility
  4. Actual: Custom implementation lacks proper ARIA attributes (no role="menu", no aria-label, no focus management)
  5. CLAUDE.md states: "shadcn/ui first: NEVER create custom versions of installed shadcn components"
- **Affected File:** `src/components/drawings/MarkerContextMenu.tsx`
- **Priority:** Fix in next sprint

#### BUG-8: Tooltip getSignedUrl Dependency Causes Potential Re-fetching
- **Severity:** Low
- **Steps to Reproduce:**
  1. Hover over a marker in view mode
  2. `MarkerTooltip` calls `getSignedUrl(target.id)` in a useEffect
  3. The useEffect depends on `[target, getSignedUrl]`
  4. `getSignedUrl` is now wrapped in `useCallback` in use-drawings.ts, but it is passed through several component layers (page -> MarkerOverlay -> MarkerTooltip)
  5. If the parent component re-renders, the function reference passed as prop may change
  6. Expected: Thumbnail URL fetched once per hover
  7. Actual: May re-fetch on parent re-renders if prop reference changes
- **Affected File:** `src/components/drawings/MarkerTooltip.tsx` lines 27-49
- **Priority:** Nice to have

### Summary
- **Acceptance Criteria:** 12/14 passed, 2 partial (AC-7 drag touch, AC-8 context menu touch)
- **Edge Cases:** 5/6 passed, 1 failed (EC-3 overlapping markers not offset)
- **Bugs Found:** 8 total (0 critical, 2 high, 4 medium, 2 low)
- **Security:** Issues found (SECURITY DEFINER search_path, no rate limiting)
- **Production Ready:** NO
- **Recommendation:** Fix BUG-1 (touch drag), BUG-2 (touch context menu), BUG-4 (SECURITY DEFINER search_path), and BUG-6 (touch label visibility) before deployment. BUG-3 (overlap offset), BUG-5 (rate limiting), BUG-7 (custom context menu), and BUG-8 (tooltip re-fetch) can be addressed in the next sprint.

## Deployment
_To be added by /deploy_

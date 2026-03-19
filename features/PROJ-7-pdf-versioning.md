# PROJ-7: PDF-Versionierung

## Status: In Review
**Created:** 2026-03-19
**Last Updated:** 2026-03-19

## Dependencies
- Requires: PROJ-3 (PDF Upload & Viewer) — Versionierung erweitert das bestehende Zeichnungs- und Viewer-System
- Requires: PROJ-4 (Marker-System) — Marker sind versionsspezifisch; neue Versionen erben Marker der Vorgängerversion

## Overview
Zeichnungen können mehrere PDF-Versionen haben. In der Projektübersicht wird stets nur die neueste (aktive) Version einer Zeichnung angezeigt. Im Viewer gibt es ein ausklappbares Seiten-Panel, das alle Versionen auflistet und das Wechseln, Hinzufügen, Umbenennen (Label) und Archivieren von Versionen ermöglicht. Beim Anlegen einer neuen Version werden die Marker der bisher aktuellen Version automatisch auf die neue Version kopiert.

## User Stories
- Als Nutzer möchte ich einer Zeichnung eine neue PDF-Version hinzufügen, damit ich überarbeitete Pläne zentral verwalten kann, ohne alte Versionen zu verlieren.
- Als Nutzer möchte ich in der Projektübersicht immer die neueste Version einer Zeichnung sehen, damit ich nicht versehentlich veraltete Pläne öffne.
- Als Nutzer möchte ich im Viewer über ein Seiten-Panel zwischen verschiedenen Versionen einer Zeichnung wechseln, damit ich Änderungen nachvollziehen kann.
- Als Nutzer möchte ich jeder Version ein eigenes Label geben (z.B. „Finale Version", „Nach Besprechung"), damit ich Versionen auf einen Blick unterscheide.
- Als Nutzer möchte ich eine Version archivieren, wenn sie nicht mehr relevant ist, ohne dass die Datei verloren geht.
- Als Nutzer möchte ich, dass beim Anlegen einer neuen Version alle Marker der aktuellen Version automatisch übernommen werden, damit ich nicht alles neu setzen muss.

## Acceptance Criteria

### Projektübersicht
- [ ] Die Zeichnungskarte (DrawingCard) zeigt immer die neueste nicht-archivierte Version (Thumbnail, Name, Datum)
- [ ] Ein kleines Versions-Badge auf der Karte zeigt die Anzahl der Versionen (z.B. „v3"), wenn mehr als eine Version existiert

### Versionen-Panel im Viewer
- [ ] Der Viewer zeigt ein ausklappbares Seiten-Panel (links oder rechts) mit allen Versionen der Zeichnung
- [ ] Jeder Versions-Eintrag zeigt: Versions-Label, Versionsnummer (v1, v2, v3…), Upload-Datum
- [ ] Die aktuell angezeigte Version ist im Panel als aktiv markiert
- [ ] Per Klick auf einen Eintrag lädt der Viewer die ausgewählte Version (neue Signed URL, PDF neu laden)
- [ ] Die neueste nicht-archivierte Version ist als „Aktuell" gekennzeichnet

### Neue Version hinzufügen
- [ ] Im Versions-Panel gibt es eine Schaltfläche „Neue Version hochladen"
- [ ] Der Upload-Flow entspricht dem bestehenden PDF-Upload (Drag & Drop oder Datei-Dialog, max. 50 MB, nur PDF)
- [ ] Nach dem Upload wird die neue Version automatisch zur aktuellen Version
- [ ] Alle Marker der zuvor aktuellen Version werden auf die neue Version kopiert
- [ ] Die neue Version erhält automatisch die nächste Versionsnummer (v1, v2, …) und als Standard-Label das aktuelle Datum (z.B. „19.03.2026")

### Versions-Label umbenennen
- [ ] Im Panel kann das Label einer Version per Inline-Edit oder Dialog geändert werden
- [ ] Das Label ist 1–100 Zeichen lang (Pflichtfeld, kein Leerzeichen-only)
- [ ] Die Versionsnummer (v1, v2, …) ist nicht änderbar

### Version archivieren
- [ ] Im Panel kann jede Version über ein Aktionsmenü archiviert werden
- [ ] Archivierte Versionen werden im Panel ausgegraut/abgetrennt dargestellt oder standardmäßig ausgeblendet (mit Option zum Einblenden)
- [ ] Die letzte verbleibende nicht-archivierte Version einer Zeichnung kann nicht archiviert werden
- [ ] Archivierte Versionen sind weiterhin abrufbar (keine Dateilöschung)

### Marker-Vererbung
- [ ] Beim Anlegen einer neuen Version werden alle Marker der bisher aktuellen Version als Kopie in die neue Version übernommen
- [ ] Neu gesetzte Marker sind immer nur an der Version gespeichert, auf der sie erstellt wurden
- [ ] Beim Versionswechsel im Viewer wechseln die angezeigten Marker entsprechend

## Edge Cases
- **Letzte Version archivieren:** Nicht möglich — Fehlermeldung anzeigen: „Die einzige verbleibende aktive Version kann nicht archiviert werden."
- **Upload schlägt fehl während Versionserstellung:** Keine neue Version wird gespeichert; Fehlermeldung zeigen, Nutzer kann es erneut versuchen.
- **Marker-Kopie schlägt fehl:** Neue Version wird trotzdem angelegt; Nutzer wird mit einem Toast informiert: „Version angelegt, Marker konnten nicht übernommen werden."
- **Sehr viele Versionen (>20):** Panel bleibt scrollbar; keine technische Beschränkung der Versionsanzahl.
- **Versionswechsel während anderer Nutzer dieselbe Zeichnung betrachtet:** Kein Echtzeit-Sync nötig (kein Realtime-Requirement in V1); andere Nutzer sehen die neue Version erst nach einem Reload.
- **Archivierte Zeichnung mit Versionen:** Alle Versionen sind implizit nicht mehr zugänglich (Zeichnung selbst ist archiviert, PROJ-6 greift).
- **Marker auf archivierter Version:** Marker bleiben in der DB; beim Klick auf den Marker zeigt der Viewer diese Version an (mit Hinweis „Archivierte Version").
- **Neue Version auf Zeichnung ohne Marker:** Keine Marker zu kopieren — leere Kopier-Operation, kein Fehler.

## Technical Requirements
- Datenbankstruktur: Neue Tabelle `drawing_versions` (storage_path, file_size, page_count, version_number, label, is_archived, created_by, created_at) verknüpft mit `drawings` (id)
- Die `drawings`-Tabelle bleibt das primäre Objekt; `storage_path`, `file_size`, `page_count` werden aus `drawings` in `drawing_versions` verschoben
- Marker-Tabelle (PROJ-4) erhält eine `drawing_version_id` Spalte (statt `drawing_id`)
- API: Neue Endpunkte für Versionsverwaltung (Liste, Hochladen, Umbenennen, Archivieren)
- Signed URLs werden pro Version generiert (aus `drawing_versions.storage_path`)
- Storage-Pfad: `{project_id}/{drawing_id}/{version_number}.pdf`
- Browser Support: Chrome, Firefox, Safari (aktuellste Versionen)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
**Erstellt:** 2026-03-19

### Wichtiger Hinweis: Breaking Change am Datenmodell
PROJ-7 erfordert eine strukturelle Änderung der bestehenden `drawings`-Tabelle. Die Felder `storage_path`, `file_size` und `page_count` wandern von `drawings` in eine neue Tabelle `drawing_versions`. Das Marker-System (PROJ-4) wird ebenfalls angepasst: Marker referenzieren künftig eine Versionszeile statt der übergeordneten Zeichnungszeile.

---

### Komponenten-Struktur

```
Projektdetail-Seite /dashboard/projects/[id]
+-- DrawingCard (pro Zeichnung, bestehend — angepasst)
    +-- PdfThumbnail (lädt Thumbnail der neuesten Version)
    +-- Badge ("v3") — nur sichtbar wenn >1 Versionen vorhanden

Viewer-Seite /dashboard/projects/[id]/drawings/[drawingId]?versionId=[id]
+-- Header (bestehend: Zurück-Button, Dateiname, Seitennavigation, Zoom)
+-- VersionPanelToggleButton (öffnet/schließt Seiten-Panel)
+-- Haupt-Layout (Flex-Row: Panel links, Viewer rechts)
    +-- VersionSidePanel (Sheet — ausklappbar)
    |   +-- Panel-Header ("Versionen")
    |   +-- NewVersionButton ("Neue Version hochladen")
    |   |   +-- VersionUploadDialog (Dialog)
    |   |       +-- PdfUploadZone (wiederverwendet aus PROJ-3)
    |   |       +-- Progress-Anzeige
    |   +-- VersionList (ScrollArea)
    |   |   +-- VersionItem[] (sortiert: neueste zuerst)
    |   |       +-- Versions-Label (editierbar)
    |   |       +-- Versionsnummer (v1, v2, …)
    |   |       +-- Upload-Datum
    |   |       +-- „Aktuell"-Badge (nur auf neuester aktiver Version)
    |   |       +-- Aktiv-Indikator (wenn diese Version gerade angezeigt wird)
    |   |       +-- Aktionsmenü (DropdownMenu)
    |   |           +-- RenameVersionDialog (Dialog)
    |   |           +-- ArchiveVersionDialog (AlertDialog)
    |   +-- ShowArchivedToggle (Switch — blendet archivierte Versionen ein/aus)
    +-- PdfViewer (bestehend: TransformWrapper, PdfPage)
```

### Datenmodell

**Tabelle `drawings`** (angepasst — verliert PDF-spezifische Felder):
- id, project_id (FK), display_name, is_archived, uploaded_by, created_at, updated_at
- *(Entfernt: storage_path, file_size, page_count — diese wandern in drawing_versions)*

**Tabelle `drawing_versions`** (neu):
- id, drawing_id (FK → drawings), version_number (ganzzählig, je Zeichnung aufsteigend: 1, 2, 3…), label (Text, max. 100 Zeichen), storage_path, file_size, page_count, is_archived, created_by, created_at, updated_at

**Tabelle `markers`** (PROJ-4 — angepasst):
- Spalte `drawing_id` wird ersetzt durch `drawing_version_id` (FK → drawing_versions)

**Supabase Storage:**
- Bucket: `drawings` (bestehend)
- Pfad-Schema angepasst: `{project_id}/{drawing_id}/{version_number}.pdf`

**Datenmigration (bestehende Daten):**
- Jede bestehende Zeichnungszeile wird zur Version v1 in `drawing_versions`
- `storage_path`, `file_size`, `page_count` werden kopiert, dann aus `drawings` entfernt
- Bestehende Marker erhalten eine `drawing_version_id` (ihre bisherige v1-Version)

### URL-Strategie

Der Viewer verwendet einen Query-Parameter für die ausgewählte Version:
`/dashboard/projects/[id]/drawings/[drawingId]?versionId=[versionId]`

Ohne Query-Parameter → neueste nicht-archivierte Version wird automatisch geladen. Direktlink zu einer bestimmten Version ist damit möglich (z.B. aus Marker-Ziel-Link).

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Versions-Panel | `Sheet` (shadcn — bereits installiert) | Slide-in von der Seite, schließbar, spart Viewport-Platz |
| Versions-Liste | `ScrollArea` (shadcn — bereits installiert) | Scrollbar bei vielen Versionen ohne Overflow-Probleme |
| Archivierte Versionen | `Switch` zum Ein-/Ausblenden | Einfach, platzsparend, konsistent mit gängigen UX-Patterns |
| Version wechseln | Query-Parameter `?versionId=` | Direktlinks bleiben möglich; kein State-Verlust beim Reload |
| Marker-Kopie | Serverseitig beim POST der neuen Version | Atomic — Marker-Kopie schlägt fehl → kein Rollback der Version, aber Toast-Hinweis |

### API-Routen

- `GET /api/projects/[id]/drawings/[drawingId]/versions` — alle Versionen laden (inkl. archivierte wenn `?includeArchived=true`)
- `POST /api/projects/[id]/drawings/[drawingId]/versions` — neue Version anlegen (Metadaten speichern + Marker kopieren)
- `PATCH /api/projects/[id]/drawings/[drawingId]/versions/[versionId]` — Label umbenennen
- `POST /api/projects/[id]/drawings/[drawingId]/versions/[versionId]/archive` — Version archivieren
- `GET /api/projects/[id]/drawings/[drawingId]/versions/[versionId]/url` — Signed URL generieren (ersetzt bestehende `/url`-Route)

### Neue Abhängigkeiten

Keine neuen Pakete erforderlich — alle benötigten shadcn-Komponenten (`Sheet`, `ScrollArea`, `Switch`, `Badge`, `Dialog`, `AlertDialog`, `DropdownMenu`) sind bereits installiert.

## Frontend Implementation Notes
_To be added by /frontend_

## Backend Implementation Notes
**Implementiert:** 2026-03-19

### Datenbankmigrierung (009_drawing_versions.sql)
- Neue Tabelle `drawing_versions` mit RLS (SELECT, INSERT, UPDATE fuer Projektmitglieder)
- Bestehende Zeichnungen werden zu v1 migriert (storage_path, file_size, page_count kopiert)
- `markers` Tabelle erhaelt `drawing_version_id` (NOT NULL FK), bestehende Marker auf v1 gesetzt
- `check_markers_same_project` Trigger aktualisiert (validiert drawing_version_id)
- Spalten `storage_path`, `file_size`, `page_count` aus `drawings` entfernt
- Indexes: drawing_id, is_archived, created_at, created_by, composite (drawing_id + is_archived + version_number DESC)
- Unique constraint: (drawing_id, version_number)

### API-Routen
- `GET /api/projects/[id]/drawings/[drawingId]/versions` - Alle Versionen laden (optional `?includeArchived=true`)
- `POST /api/projects/[id]/drawings/[drawingId]/versions` - Neue Version anlegen + Marker-Kopie (best-effort)
- `PATCH /api/projects/[id]/drawings/[drawingId]/versions/[versionId]` - Label umbenennen
- `POST /api/projects/[id]/drawings/[drawingId]/versions/[versionId]/archive` - Version archivieren (mit Schutz der letzten aktiven Version)
- `GET /api/projects/[id]/drawings/[drawingId]/versions/[versionId]/url` - Signed URL (1h Ablauf)

### Angepasste bestehende Routen
- `GET /api/projects/[id]/drawings` - Liefert jetzt `version_count` und `latest_version` pro Zeichnung
- `POST /api/projects/[id]/drawings` - Erstellt automatisch v1 in drawing_versions
- `GET /api/projects/[id]/drawings/[drawingId]/url` - Resolved automatisch auf neueste aktive Version (1h Signed URL)
- `GET/POST /api/projects/[id]/drawings/[drawingId]/markers` - Unterstuetzt `?versionId=` Query-Parameter
- `PATCH /api/projects/[id]/drawings/[drawingId]/markers/[markerId]` - storage_path aus target_drawing Join entfernt

### Typen & Validierung
- `Drawing` Typ: storage_path/file_size/page_count entfernt, latest_version hinzugefuegt
- `Marker` Typ: drawing_version_id hinzugefuegt
- `MarkerWithTarget`: storage_path aus target_drawing entfernt
- `createVersionSchema` (Zod): storage_path, file_size, page_count, label (optional)
- `renameVersionSchema` (Zod): label (1-100 Zeichen, kein whitespace-only)

### Hooks
- `use-versions.ts` aktualisiert: uploadVersion gibt {version, markersCopied, markerCopyFailed} zurueck, label-Parameter
- `use-markers.ts` aktualisiert: optionaler versionId-Parameter fuer versionsspezifische Marker-Abfragen
- `use-drawings.ts` aktualisiert: neues Storage-Pfad-Schema ({project_id}/{drawing_id}/1.pdf)

## QA Test Results

**Tested:** 2026-03-19
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Code review, TypeScript compilation, static analysis (no running Supabase instance available for live testing)

### Acceptance Criteria Status

#### AC-1: Projektubersicht -- DrawingCard shows newest version
- [x] DrawingCard receives `versionCount` prop and displays Badge when > 1 version exists
- [x] Badge shows `v{count}` in the thumbnail area (top-right corner)
- [ ] BUG-1: Version badge shows total version count (including archived) rather than the version_number of the latest active version. The API returns `version_count: versions.length` (all versions), and the card renders `v{versionCount}`. For example, with v1 (archived), v2, v3 -- the badge shows "v3" which happens to be correct, but if v3 is archived and only v2 is active, the badge still shows "v3" because version_count=3. The spec says "Anzahl der Versionen (z.B. 'v3')" which is ambiguous but the intent seems to be showing the latest active version number, not a total count.
- [x] API enriches drawings with `latest_version` (newest non-archived) for thumbnail/name/date display

#### AC-2: Versionen-Panel im Viewer
- [x] Viewer shows a collapsible side panel (Sheet component, slides from left) with all versions
- [x] Each version entry shows: label, version number (v1, v2...), upload date
- [x] Currently displayed version is marked as active (blue dot indicator + border highlight)
- [x] Clicking a version entry triggers version switch (new signed URL, PDF reload)
- [x] Latest non-archived version is marked with "Aktuell" badge

#### AC-3: Neue Version hinzufugen
- [x] "Neue Version hochladen" button exists in the version panel
- [x] Upload flow uses PdfUploadZone (drag & drop or file dialog, max 50 MB, PDF only)
- [x] After upload, new version becomes the selected version automatically
- [x] Markers from the previously active version are copied to the new version (server-side)
- [x] New version gets auto-incremented version number and default label (current date DD.MM.YYYY)
- [ ] BUG-2: Race condition in version number calculation -- the client calculates `nextVersionNumber` from local state to build the storage path, while the server independently calculates it from the database. If two users upload simultaneously for the same drawing, both clients could compute the same version number, leading to a storage path collision (same filename in Supabase Storage due to `x-upsert: true`) while the server may assign different version numbers. The storage_path sent by the client could mismatch the actual version_number assigned by the server.

#### AC-4: Versions-Label umbenennen
- [x] Label can be renamed via inline dialog from the action menu (DropdownMenu -> Pencil icon)
- [x] Label validation: 1-100 characters, no whitespace-only (both client-side and server-side via Zod)
- [x] Version number (v1, v2...) is not editable

#### AC-5: Version archivieren
- [x] Archive option available in the action menu for each non-archived version
- [x] Archived versions are displayed with reduced opacity (opacity-50) and "Archiviert" badge
- [x] Archived versions are hidden by default; toggle switch to show/hide them exists
- [x] Last remaining non-archived version cannot be archived (server-side check: count <= 1 returns 400)
- [x] Archived versions remain accessible (no file deletion, can still be viewed in the panel)

#### AC-6: Marker-Vererbung
- [x] When creating a new version, all markers from the current active version are copied server-side
- [x] Copied markers receive the new version's ID; originals remain on their version
- [x] Toast feedback for marker copy results (success count, or warning on failure)
- [ ] BUG-3: Viewer does not pass versionId to useMarkers hook. The viewer page calls `useMarkers(projectId, activeDrawingId)` without the third `versionId` parameter (line 83-84 of the viewer page). This means markers are always fetched for the latest active version via the API default, NOT for the currently selected version. When a user switches to an older version, the markers displayed will still be from the latest version, not the selected one. This breaks the core requirement that "Beim Versionswechsel im Viewer wechseln die angezeigten Marker entsprechend."

### Edge Cases Status

#### EC-1: Letzte Version archivieren
- [x] Server returns 400 with message "Die einzige verbleibende aktive Version kann nicht archiviert werden." when attempting to archive the last active version
- [x] Client hides the archive menu item when `canArchive` is false (activeVersions.length <= 1)

#### EC-2: Upload schlagt fehl wahrend Versionserstellung
- [x] If upload fails (XHR onerror or non-2xx status), no version is saved; error is thrown and caught in dialog
- [x] If metadata POST fails after successful storage upload, error is thrown but orphaned file remains in storage (acceptable trade-off, no data inconsistency in DB)

#### EC-3: Marker-Kopie schlagt fehl
- [x] New version is still created even if marker copy fails (best-effort approach)
- [x] Toast warning shown: "Version angelegt, Marker konnten nicht ubernommen werden."

#### EC-4: Sehr viele Versionen (>20)
- [x] Panel uses ScrollArea component -- scrollable, no hard limit on version count

#### EC-5: Versionswechsel wahrend anderer Nutzer dieselbe Zeichnung betrachtet
- [x] No realtime sync -- other users see updates after reload (consistent with spec)

#### EC-6: Archivierte Zeichnung mit Versionen
- [x] Viewer shows "Diese Zeichnung ist archiviert" full-page message for archived drawings, preventing access to any versions

#### EC-7: Marker auf archivierter Version
- [x] Archived versions can be selected in the panel; viewer shows "Archivierte Version" banner
- [ ] BUG-4: Due to BUG-3 (versionId not passed to useMarkers), markers on archived versions will not display correctly -- the API defaults to the latest active version's markers instead.

#### EC-8: Neue Version auf Zeichnung ohne Marker
- [x] Server handles empty marker array gracefully -- no error when there are 0 markers to copy

### Security Audit Results

#### Authentication
- [x] All version API routes verify user authentication via `supabase.auth.getUser()`
- [x] Unauthenticated requests return 401

#### Authorization
- [x] All version API routes verify project membership before proceeding
- [x] Unauthorized users receive 403
- [x] Version PATCH and archive routes verify version belongs to the specified drawing AND project (preventing IDOR across projects)
- [x] RLS policies enforce project membership at database level (defense in depth)

#### Input Validation
- [x] `createVersionSchema` validates storage_path (non-empty string), file_size (positive integer), label (1-100 chars, no whitespace-only)
- [x] `renameVersionSchema` validates label (1-100 chars, no whitespace-only)
- [x] Server validates storage_path starts with `{projectId}/{drawingId}/` (prevents path traversal)
- [x] Database CHECK constraint enforces `version_number >= 1` and label length

#### Rate Limiting
- [ ] BUG-5: No rate limiting on version API endpoints. A malicious user could rapidly create versions, consuming storage space. There is no per-user or per-drawing rate limit.

#### Data Exposure
- [x] API responses contain only version metadata, no secrets or internal paths exposed beyond storage_path (which is a relative path in Supabase Storage, not a direct URL)
- [x] Signed URLs have 1-hour expiry

#### Storage Security
- [ ] BUG-6: The `use-versions.ts` hook uses `x-upsert: true` header when uploading to Supabase Storage. This means if an attacker crafts a request with an existing storage path, they could overwrite another version's PDF file. While the storage path is validated server-side to match the `{projectId}/{drawingId}/` prefix, the actual upload happens directly from the client to Supabase Storage BEFORE the server validates it. An attacker could upload to any path within the `drawings` bucket that Supabase Storage policies allow.

#### XSS
- [x] Version labels are rendered as text content (not dangerouslySetInnerHTML), no XSS risk
- [x] User input is validated and sanitized by Zod schemas

#### IDOR (Insecure Direct Object Reference)
- [x] All endpoints verify project membership and drawing/version ownership chain
- [x] Cannot access versions of drawings in other projects
- [ ] BUG-7: The version creation endpoint validates `storage_path.startsWith(expectedPrefix)` but does not validate the filename portion. An attacker could send a path like `{projectId}/{drawingId}/../otherDrawingId/1.pdf` which would pass the prefix check but reference a different storage location. However, Supabase Storage typically normalizes paths, so exploitation depends on the storage backend behavior.

#### Security Headers
- [x] X-Frame-Options: DENY
- [x] X-Content-Type-Options: nosniff
- [x] Strict-Transport-Security with includeSubDomains
- [x] CSP configured with frame-ancestors 'none'
- [x] Referrer-Policy: strict-origin-when-cross-origin

### Cross-Browser & Responsive Notes
(Code review only -- no live browser testing available)
- [x] Components use standard CSS (Tailwind) with no browser-specific features
- [x] Sheet panel width: 320px default, 360px on sm+ breakpoint -- appropriate for mobile/desktop
- [x] Version button label hidden on mobile (only icon shown via `hidden sm:inline`)
- [x] Truncation applied to drawing name on mobile (`max-w-[200px] sm:max-w-none`)

### Bugs Found

#### BUG-1: Version badge shows total count instead of latest version number
- **Severity:** Low
- **Steps to Reproduce:**
  1. Create a drawing with 3 versions (v1, v2, v3)
  2. Archive v3
  3. Expected: Badge shows "v2" (latest active version number)
  4. Actual: Badge shows "v3" (total version count)
- **Priority:** Nice to have

#### BUG-2: Race condition in storage path vs. version number
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Two users simultaneously upload a new version for the same drawing
  2. Both clients compute the same nextVersionNumber from local state
  3. Expected: Each version gets a unique storage path matching its server-assigned version number
  4. Actual: Both clients upload to the same storage path (e.g., `3.pdf`); second upload overwrites first due to `x-upsert: true`. Server may assign different version_numbers, causing a mismatch between `storage_path` and `version_number`.
- **Priority:** Fix in next sprint

#### BUG-3: Markers not version-scoped in viewer (Critical)
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Open a drawing in the viewer that has multiple versions with different markers
  2. Switch to an older version using the version panel
  3. Expected: Markers switch to those belonging to the selected version
  4. Actual: Markers remain those of the latest active version because `useMarkers(projectId, activeDrawingId)` is called without `versionId` parameter (line 83-84 of page.tsx)
- **File:** `src/app/(protected)/dashboard/projects/[id]/drawings/[drawingId]/page.tsx`, line 83-84
- **Fix required:** Pass `activeVersion?.id` as the third argument to `useMarkers()`
- **Priority:** Fix before deployment

#### BUG-4: Markers on archived versions not visible (consequence of BUG-3)
- **Severity:** High
- **Steps to Reproduce:**
  1. View an archived version in the viewer
  2. Expected: Markers stored on that archived version are displayed
  3. Actual: Markers from the latest active version are shown instead
- **Priority:** Fix before deployment (resolved by fixing BUG-3)

#### BUG-5: No rate limiting on version API endpoints
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Programmatically send rapid POST requests to `/api/projects/[id]/drawings/[drawingId]/versions`
  2. Expected: Requests are throttled after a reasonable limit
  3. Actual: No rate limiting; unlimited version creation possible
- **Priority:** Fix in next sprint

#### BUG-6: Client-side storage upload before server validation
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Intercept the upload request in the browser (e.g., via DevTools)
  2. Modify the storage path in the XHR upload to point to a different drawing's folder
  3. The upload to Supabase Storage succeeds (if Storage RLS allows it)
  4. The subsequent metadata POST to the API may fail validation, but the file is already in storage
  5. Expected: Upload path should be validated before the file is uploaded, or server should generate the upload URL
  6. Actual: Client determines the upload path; server only validates after-the-fact
- **Priority:** Fix in next sprint

#### BUG-7: Path traversal potential in storage_path validation
- **Severity:** Low
- **Steps to Reproduce:**
  1. Send a POST to the versions API with `storage_path: "{projectId}/{drawingId}/../otherDrawingId/1.pdf"`
  2. Expected: Server rejects the path
  3. Actual: Server only checks `startsWith(expectedPrefix)`, so `../` traversal sequences pass the check
- **Note:** Exploitation depends on whether Supabase Storage normalizes paths. Likely low risk in practice.
- **Priority:** Nice to have (add explicit `../` rejection)

### Summary
- **Acceptance Criteria:** 14/17 passed (3 failures related to BUG-1, BUG-2, BUG-3)
- **Edge Cases:** 7/8 passed (1 failure as consequence of BUG-3)
- **Bugs Found:** 7 total (1 critical, 1 high, 3 medium, 2 low)
- **Security:** Issues found (BUG-5 rate limiting, BUG-6 client-side upload, BUG-7 path traversal)
- **TypeScript Build:** PASSES (no compilation errors)
- **Production Ready:** NO
- **Recommendation:** BUG-3 (critical) must be fixed before deployment -- the viewer must pass `activeVersion?.id` to `useMarkers()`. BUG-4 is resolved automatically when BUG-3 is fixed. BUG-2, BUG-5, and BUG-6 should be addressed in the next sprint. BUG-1 and BUG-7 are nice-to-have improvements.

## Deployment
_To be added by /deploy_

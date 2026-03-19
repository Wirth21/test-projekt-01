# PROJ-3: PDF Upload & Viewer

## Status: In Review
**Created:** 2026-03-13
**Last Updated:** 2026-03-16

## Dependencies
- Requires: PROJ-2 (Projektverwaltung) — PDFs gehören zu einem Projekt

## Overview
Nutzer können PDFs in ein Projekt hochladen, diese verwalten und im Browser anzeigen. PDFs werden in Supabase Storage gespeichert. Der integrierte Viewer zeigt die PDF-Seiten an und bildet die Basis für das spätere Marker-System.

## User Stories
- Als Nutzer möchte ich eine oder mehrere PDFs in ein Projekt hochladen, damit ich die Pläne zentral ablegen kann.
- Als Nutzer möchte ich alle PDFs eines Projekts in einer Listenansicht sehen (mit Name und Vorschau der ersten Seite), damit ich schnell die richtige Datei finde.
- Als Nutzer möchte ich eine PDF im Browser öffnen und die Seiten durchblättern können, ohne eine externe App zu brauchen.
- Als Nutzer möchte ich eine PDF umbenennen, damit der Anzeigename aussagekräftig ist.
- Als Nutzer möchte ich eine PDF archivieren, wenn sie nicht mehr aktiv benötigt wird (kein Löschen möglich — siehe PROJ-6).
- Als Nutzer möchte ich eine PDF zoomen und die Ansicht verschieben (pan), um Details besser zu sehen.

## Acceptance Criteria
- [ ] Nutzer kann PDFs per Drag & Drop oder Datei-Dialog hochladen
- [ ] Upload-Fortschritt wird angezeigt
- [ ] Maximale Dateigröße: 50 MB pro PDF
- [ ] Nur PDF-Dateien werden akzeptiert (Validierung nach MIME-Type und Dateiendung)
- [ ] PDF-Liste zeigt: Dateiname, Vorschau-Thumbnail der ersten Seite, Upload-Datum
- [ ] PDF öffnet sich in einem integrierten Viewer (keine externe App nötig)
- [ ] Viewer unterstützt: Seitennavigation (vor/zurück, Seitenzahl), Zoom (rein/raus), Pan (Maus oder Touch)
- [ ] Nutzer kann den Anzeigenamen einer PDF ändern (ohne die Originaldatei umzubenennen)
- [ ] Nutzer kann eine PDF archivieren (kein Löschen möglich) — Details in PROJ-6
- [ ] PDFs werden beim Archivieren NICHT aus Supabase Storage entfernt

## Edge Cases
- Was passiert beim Upload einer Datei, die kein PDF ist? → Fehlermeldung, Upload wird abgebrochen
- Was passiert bei einer beschädigten PDF? → Fehlermeldung beim Rendern, Nutzer kann die Datei archivieren
- Was passiert bei sehr großen PDFs (>50 MB)? → Fehlermeldung vor dem Upload
- Was passiert wenn eine PDF archiviert wird, auf die noch Marker anderer PDFs zeigen? → Marker bleiben in der DB; beim Klick erscheint die Meldung "Diese Zeichnung ist archiviert" (Details in PROJ-6)
- Was passiert wenn mehrere Nutzer gleichzeitig in einem Projekt eine PDF hochladen? → Kein Konflikt, beide Uploads werden verarbeitet

## Technical Requirements
- PDF-Rendering: `react-pdf` (PDF.js-basiert) für clientseitiges Rendering
- Supabase Storage für Dateiablage (Bucket pro Projekt oder gemeinsamer Bucket mit Pfad-Struktur)
- Thumbnail-Generierung: Erste Seite wird als Vorschaubild gerendert (clientseitig beim ersten Öffnen oder via Edge Function)
- Maximale Dateigröße: 50 MB
- Browser Support: Chrome, Firefox, Safari (aktuellste Versionen)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
**Erstellt:** 2026-03-15

### Komponenten-Struktur

```
Projektdetail-Seite /dashboard/projects/[id]
+-- PdfUploadZone (Drag & Drop + Datei-Dialog)
|   +-- Progress-Anzeige (shadcn Progress)
+-- DrawingGrid
    +-- DrawingCard (pro PDF)
        +-- PdfThumbnail (erste Seite als Vorschau, via react-pdf)
        +-- Dateiname + Upload-Datum
        +-- Aktionsmenü (Umbenennen, Archivieren)
        +-- RenameDrawingDialog (shadcn Dialog)
        +-- ArchiveDrawingDialog (shadcn AlertDialog)

Viewer-Seite /dashboard/projects/[id]/drawings/[drawingId]
+-- Header (Zurück-Button, Dateiname, Seitennavigation)
+-- PdfViewer (Vollbild)
    +-- ZoomControls (rein/raus/zurücksetzen)
    +-- PanContainer (react-zoom-pan-pinch)
    +-- PdfPage (gerenderte Seite via react-pdf)
```

### Datenmodell

**Tabelle `drawings`** (Metadaten):
- id, project_id (FK), display_name, storage_path, file_size, page_count, is_archived, uploaded_by, created_at, updated_at

**Supabase Storage:**
- Bucket: `drawings`
- Pfad: `{project_id}/{drawing_id}.pdf`
- Zugriff: Signed URLs (zeitbegrenzt, nur für Projektmitglieder)

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| PDF-Rendering | `react-pdf` | PDF.js-basiert, läuft im Browser, kein Server nötig |
| Zoom & Pan | `react-zoom-pan-pinch` | Touch + Maus out-of-the-box |
| Thumbnail | Client-seitig (react-pdf) | Kein Edge-Function-Aufwand für MVP |
| Storage-Zugriff | Signed URLs | PDFs nicht öffentlich, nur für Mitglieder |
| Viewer-Layout | Eigene Fullscreen-Route | Mehr Platz, Basis für PROJ-4 Marker-System |

### Neue Abhängigkeiten

- `react-pdf` — PDF-Seiten im Browser rendern
- `react-zoom-pan-pinch` — Zoom und Pan im Viewer

### API-Routen (Backend-Schritt)

- `POST /api/projects/[id]/drawings` — Metadaten nach Upload speichern
- `GET /api/projects/[id]/drawings` — PDF-Liste laden
- `PATCH /api/projects/[id]/drawings/[drawingId]` — Umbenennen
- `POST /api/projects/[id]/drawings/[drawingId]/archive` — Archivieren
- `GET /api/projects/[id]/drawings/[drawingId]/url` — Signed URL generieren

## Frontend Implementation Notes
**Implemented:** 2026-03-15

### What was built:
- **Types:** `src/lib/types/drawing.ts` (Drawing interface)
- **Validation:** `src/lib/validations/drawing.ts` (Zod schema for rename, 1-200 chars)
- **Hook:** `src/hooks/use-drawings.ts` (useDrawings hook — fetch, upload, rename, archive, getSignedUrl)
- **Components:**
  - `src/components/drawings/PdfThumbnail.tsx` — renders first page of PDF at thumbnail size via react-pdf
  - `src/components/drawings/PdfUploadZone.tsx` — drag & drop + file dialog, PDF/50MB validation, progress bar
  - `src/components/drawings/DrawingCard.tsx` — thumbnail + name + date + dropdown (rename/archive)
  - `src/components/drawings/DrawingGrid.tsx` — responsive grid (2 cols sm, 3 cols lg) + empty state
  - `src/components/drawings/RenameDrawingDialog.tsx` — shadcn Dialog with react-hook-form + Zod
  - `src/components/drawings/ArchiveDrawingDialog.tsx` — shadcn AlertDialog confirmation
- **Pages:**
  - Updated `src/app/(protected)/dashboard/projects/[id]/page.tsx` — replaced PDF placeholder with upload zone + drawing grid
  - Created `src/app/(protected)/dashboard/projects/[id]/drawings/[drawingId]/page.tsx` — full-page PDF viewer with zoom/pan (react-zoom-pan-pinch), page navigation, loading/error states
- **Config:** Updated `next.config.ts` with transpilePackages for react-pdf/pdfjs-dist, canvas alias

### Dependencies added:
- `react-pdf` v10.4.1 — PDF rendering
- `react-zoom-pan-pinch` — zoom and pan in viewer

### Notes:
- Upload uses XMLHttpRequest directly to Supabase Storage for progress tracking, then POSTs metadata to API
- Backend API routes (`/api/projects/[id]/drawings/*`) not yet built — will return 404 until /backend step
- Build passes cleanly with no TypeScript errors

## Backend Implementation Notes
**Implemented:** 2026-03-16

### What was built:
- **Migration:** `supabase/migrations/003_drawings.sql`
  - `drawings` table with all specified columns (id, project_id, display_name, storage_path, file_size, page_count, is_archived, uploaded_by, created_at, updated_at)
  - RLS enabled with 3 policies: SELECT/INSERT/UPDATE scoped to project membership (owner + member identical permissions), no DELETE policy (archive-only)
  - 4 indexes: project_id, is_archived, uploaded_by, created_at DESC
  - updated_at trigger reusing `handle_updated_at()` from 001_profiles.sql
  - Storage bucket `drawings` (private, 50MB limit, PDF-only)
  - Storage RLS policies for INSERT/SELECT scoped to project membership via folder path
- **Validation:** Updated `src/lib/validations/drawing.ts` with `createDrawingSchema` (display_name 1-200 chars, storage_path non-empty, file_size positive int, page_count optional nullable int)
- **API Routes:**
  - `GET /api/projects/[id]/drawings` — list non-archived drawings, ordered by created_at DESC, returns `{ drawings }`
  - `POST /api/projects/[id]/drawings` — save drawing metadata after client upload, validates with Zod, returns `{ drawing }` with 201
  - `PATCH /api/projects/[id]/drawings/[drawingId]` — rename drawing, returns `{ drawing }`
  - `POST /api/projects/[id]/drawings/[drawingId]/archive` — set is_archived=true, returns `{ drawing }`
  - `GET /api/projects/[id]/drawings/[drawingId]/url` — generate signed URL (10-year expiry), returns `{ url }`
- All endpoints authenticate via `supabase.auth.getUser()` and verify project membership before processing
- Response shapes match what `use-drawings.ts` hook expects

### Notes:
- Migration needs to be applied to Supabase via `mcp__supabase__apply_migration` (migration file is ready)
- Build passes cleanly with no TypeScript errors

## QA Test Results

**Tested:** 2026-03-16
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build Status:** PASS (Next.js 16.1.6 Turbopack, no TypeScript errors)

### Acceptance Criteria Status

#### AC-1: Nutzer kann PDFs per Drag & Drop oder Datei-Dialog hochladen
- [x] PdfUploadZone implements drag & drop via onDragOver/onDrop handlers
- [x] File dialog available via hidden `<input type="file">` triggered by click and "Datei auswaehlen" button
- [x] Upload zone has proper ARIA attributes (role="button", aria-label, keyboard support)
- [x] Upload disabled during active upload (pointer-events-none, opacity-70)
- **Result: PASS**

#### AC-2: Upload-Fortschritt wird angezeigt
- [x] Progress bar rendered via shadcn `<Progress>` component during upload
- [x] Percentage displayed as text below progress bar
- [x] XMLHttpRequest xhr.upload.onprogress tracks real upload progress
- [x] Animated pulse icon indicates active upload
- **Result: PASS**

#### AC-3: Maximale Dateigroesse: 50 MB pro PDF
- [x] Client-side validation: `MAX_FILE_SIZE = 50 * 1024 * 1024` in PdfUploadZone.tsx
- [x] Server-side validation: Storage bucket configured with `file_size_limit: 52428800` (50 MB)
- [x] Error message displayed: "Die Datei darf maximal 50 MB gross sein"
- **Result: PASS**

#### AC-4: Nur PDF-Dateien werden akzeptiert (Validierung nach MIME-Type und Dateiendung)
- [x] Client-side: checks `file.type !== "application/pdf"` AND `!file.name.toLowerCase().endsWith(".pdf")`
- [x] HTML input accepts: `.pdf,application/pdf`
- [x] Server-side: Storage bucket `allowed_mime_types: ARRAY['application/pdf']`
- [ ] BUG: Client validation uses OR logic (passes if EITHER mime OR extension match) instead of AND. A file with `.pdf` extension but wrong MIME type would pass client validation (server would still block it)
- **Result: PASS (with minor client-side gap, server enforces correctly)**

#### AC-5: PDF-Liste zeigt: Dateiname, Vorschau-Thumbnail der ersten Seite, Upload-Datum
- [x] DrawingCard shows `drawing.display_name` (truncated with CSS)
- [x] DrawingCard shows formatted date via `toLocaleDateString("de-DE")`
- [x] PdfThumbnail renders first page via react-pdf `<Document>` + `<Page pageNumber={1}>`
- [x] Thumbnail URLs fetched via signed URLs for each drawing
- [x] Fallback icon shown when thumbnail URL not available or PDF load fails
- **Result: PASS**

#### AC-6: PDF oeffnet sich in einem integrierten Viewer (keine externe App noetig)
- [x] Dedicated viewer page at `/dashboard/projects/[id]/drawings/[drawingId]`
- [x] Uses react-pdf for in-browser rendering
- [x] Full-screen layout with h-screen flex column
- [x] Loading state with spinner while URL and PDF are loading
- [x] Error state with "PDF kann nicht angezeigt werden" message for corrupted files
- **Result: PASS**

#### AC-7: Viewer unterstuetzt: Seitennavigation (vor/zurueck, Seitenzahl), Zoom (rein/raus), Pan (Maus oder Touch)
- [x] Page navigation: ChevronLeft/ChevronRight buttons, disabled at boundaries
- [x] Page counter: "{currentPage} / {numPages}" display
- [x] Zoom: ZoomIn/ZoomOut buttons via react-zoom-pan-pinch
- [x] Reset zoom: RotateCcw button calls `resetTransform()`
- [x] Pan: TransformWrapper with centerOnInit, wheel zoom step 0.1
- [x] Min/max scale: 0.5 to 5
- [ ] BUG: Page navigation controls only shown when `numPages > 1`. For single-page PDFs this is correct, but the page counter "1 / 1" would be useful context.
- **Result: PASS**

#### AC-8: Nutzer kann den Anzeigenamen einer PDF aendern (ohne die Originaldatei umzubenennen)
- [x] RenameDrawingDialog with react-hook-form + Zod validation (1-200 chars)
- [x] PATCH API route only updates `display_name` and `updated_at`, not `storage_path`
- [x] Server-side validation via `renameDrawingSchema`
- [x] Dialog pre-filled with current name via `values` prop
- [x] Form resets on close
- **Result: PASS**

#### AC-9: Nutzer kann eine PDF archivieren (kein Loeschen moeglich)
- [x] ArchiveDrawingDialog with confirmation prompt
- [x] POST archive API route sets `is_archived: true`
- [x] No DELETE RLS policy exists on drawings table (archive-only by design)
- [x] No DELETE API route exists
- [x] Archived drawings filtered out in DrawingGrid: `drawings.filter((d) => !d.is_archived)`
- [x] GET API also filters: `.eq("is_archived", false)`
- **Result: PASS**

#### AC-10: PDFs werden beim Archivieren NICHT aus Supabase Storage entfernt
- [x] Archive route only calls `.update({ is_archived: true })` on the drawings table
- [x] No `storage.from("drawings").remove()` call anywhere in archive logic
- [x] No Storage DELETE RLS policy exists (only INSERT and SELECT)
- **Result: PASS**

### Edge Cases Status

#### EC-1: Upload einer Datei, die kein PDF ist
- [x] Client-side validation blocks and shows: "Nur PDF-Dateien sind erlaubt"
- [x] Server-side storage bucket enforces `allowed_mime_types: ['application/pdf']`
- [x] Error displayed via `role="alert"` for accessibility
- **Result: PASS**

#### EC-2: Beschaedigte PDF
- [x] PdfThumbnail: `onLoadError` sets hasError state, shows fallback icon
- [x] Viewer: `handleDocumentLoadError` sets pdfError state, shows error message
- [x] Error message: "Die Datei ist moeglicherweise beschaedigt oder in einem nicht unterstuetzten Format."
- [x] User can still archive the drawing (archiving does not require PDF rendering)
- **Result: PASS**

#### EC-3: Sehr grosse PDFs (>50 MB)
- [x] Client validation fires BEFORE upload: `file.size > MAX_FILE_SIZE`
- [x] Error message shown inline: "Die Datei darf maximal 50 MB gross sein"
- [x] No network request made for oversized files
- **Result: PASS**

#### EC-4: PDF archiviert, auf die Marker zeigen
- Not yet testable (PROJ-4 Marker-System not built)
- Marker data would remain in DB (no cascade delete on drawings archive)
- **Result: N/A (deferred to PROJ-4/PROJ-6)**

#### EC-5: Gleichzeitige Uploads durch mehrere Nutzer
- [x] Each upload generates a unique UUID via `crypto.randomUUID()` for the storage path
- [x] Storage path `{projectId}/{drawingId}.pdf` prevents collisions
- [x] Database insert uses separate rows, no shared state conflicts
- [x] `x-upsert: true` header on storage upload prevents conflicts even if same path is used
- **Result: PASS (by design)**

### Additional Edge Cases Identified

#### EC-6: Empty display_name on rename
- [x] Zod schema enforces `.min(1)` and `.trim()` — empty/whitespace-only names rejected
- [x] Server-side validation via `renameDrawingSchema.safeParse()` returns 400
- **Result: PASS**

#### EC-7: Renaming/archiving a drawing from another project
- [x] PATCH and archive routes both filter by `projectId` AND `drawingId`: `.eq("id", drawingId).eq("project_id", projectId)`
- [x] RLS further restricts to project membership
- **Result: PASS**

#### EC-8: Accessing viewer for non-existent drawing
- [x] URL route returns 404 if drawing not found: `.single()` will error
- [x] Viewer shows error state with "PDF konnte nicht geladen werden"
- **Result: PASS**

### Cross-Browser Assessment (Code Review)

#### Chrome (latest)
- [x] react-pdf uses PDF.js which has full Chrome support
- [x] react-zoom-pan-pinch supports Chrome pointer events
- [x] Drag & drop API fully supported
- **Result: PASS (expected)**

#### Firefox (latest)
- [x] PDF.js originally built by Mozilla for Firefox
- [x] Drag & drop API fully supported
- [x] TransformWrapper uses standard pointer events
- **Result: PASS (expected)**

#### Safari (latest)
- [ ] BUG: `crypto.randomUUID()` requires Safari 15.4+. Should work in latest versions but older Safari installs may fail silently
- [x] react-pdf/react-zoom-pan-pinch have Safari support
- **Result: PASS (with minor Safari version caveat)**

### Responsive Assessment (Code Review)

#### Mobile (375px)
- [x] DrawingGrid: `grid-cols-2` on small screens (correct)
- [x] PdfUploadZone: responsive padding, centered content
- [x] Viewer header: `flex-wrap` allows controls to wrap on narrow screens
- [x] Drawing name truncated with `max-w-[200px]` on mobile
- [ ] BUG: Dropdown menu action button on DrawingCard has `opacity-0 group-hover:opacity-100` which is not accessible on touch devices (no hover state). Users cannot access rename/archive actions on mobile.
- **Result: FAIL (touch accessibility bug)**

#### Tablet (768px)
- [x] DrawingGrid: `grid-cols-2` (sm breakpoint)
- [x] Viewer controls visible and properly spaced
- **Result: PASS**

#### Desktop (1440px)
- [x] DrawingGrid: `grid-cols-3` (lg breakpoint)
- [x] Max-width `4xl` on project detail page prevents excessive stretching
- [x] Viewer uses full screen height
- **Result: PASS**

### Security Audit Results (Red Team)

#### Authentication
- [x] All API routes call `supabase.auth.getUser()` and reject with 401 if unauthenticated
- [x] Middleware redirects unauthenticated users to /login for protected routes
- [x] Upload uses session access_token from `supabase.auth.getSession()`
- [ ] BUG-SEC-1: `use-drawings.ts` line 52 uses `supabase.auth.getSession()` instead of `supabase.auth.getUser()` for the client-side upload. Per Supabase docs, `getSession()` reads from local storage and is not guaranteed to be validated against the server. This means a tampered/expired session token could be sent to Supabase Storage. Severity: Medium (Storage RLS still enforces auth, but the token could be stale).

#### Authorization (Horizontal Privilege Escalation)
- [x] All API routes verify project membership before processing
- [x] RLS policies on `drawings` table enforce project membership for SELECT/INSERT/UPDATE
- [x] Storage RLS enforces project membership via folder path matching
- [x] No DELETE policies exist (preventing unauthorized deletion)
- [ ] BUG-SEC-2: The `POST /api/projects/[id]/drawings` route accepts `storage_path` from the client request body without validating that it matches the expected `{projectId}/{drawingId}.pdf` pattern. An attacker could POST metadata with a `storage_path` pointing to another project's files, potentially allowing them to create a drawing record that generates signed URLs for files they should not access. Severity: High.

#### Input Validation
- [x] Zod schemas validate all inputs on server side (createDrawingSchema, renameDrawingSchema)
- [x] display_name trimmed and length-checked (1-200 chars)
- [x] file_size validated as positive integer
- [x] Invalid JSON body returns 400
- [x] XSS via display_name: React escapes output by default, display_name rendered via `{drawing.display_name}` (safe)
- [x] SQL injection: Supabase client uses parameterized queries (safe)

#### Rate Limiting
- [ ] BUG-SEC-3: No rate limiting on any drawing API endpoints. An attacker could spam uploads, rename requests, or signed URL generation. Supabase Storage has its own limits but the metadata API is unprotected. Severity: Medium.

#### Data Exposure
- [x] API responses return full drawing objects including `storage_path` — this is internal data but not directly exploitable since Storage requires auth
- [ ] BUG-SEC-4: Signed URLs generated with 10-year expiry (315,360,000 seconds). If a signed URL leaks (logs, shared links, browser history), anyone with the URL can access the PDF for 10 years without authentication. The spec says "Signed URLs (zeitbegrenzt, nur fuer Projektmitglieder)" implying time-limited access. A 1-hour or 24-hour expiry would be more appropriate. Severity: High.

#### Storage Security
- [x] Storage bucket is private (not public)
- [x] Storage RLS uses `storage.foldername(name)` to match project_id — correct pattern
- [ ] BUG-SEC-5: No Storage DELETE policy exists, which correctly prevents file deletion. However, the upload uses `x-upsert: true` header, which means any project member could overwrite an existing PDF file at a known path without the uploader's knowledge. This is a data integrity concern. Severity: Medium.

#### IDOR (Insecure Direct Object Reference)
- [x] Drawing operations scoped by both `drawingId` AND `projectId` — cross-project IDOR prevented
- [x] RLS provides defense-in-depth

#### Security Headers
- [x] X-Frame-Options: DENY
- [x] X-Content-Type-Options: nosniff
- [x] Strict-Transport-Security with includeSubDomains
- [x] CSP configured with connect-src restricted to supabase domain
- [x] frame-ancestors: none

### Bugs Found

#### BUG-1: Touch devices cannot access drawing actions (Rename/Archive)
- **Severity:** High
- **Steps to Reproduce:**
  1. Open project detail page on a mobile device (375px viewport)
  2. View the drawing cards in the grid
  3. Try to access the three-dot menu (MoreVertical) on a drawing card
  4. Expected: Menu button is visible and tappable
  5. Actual: Menu button has `opacity-0 group-hover:opacity-100` — on touch devices there is no hover state, so the button remains invisible
- **Affected File:** `src/components/drawings/DrawingCard.tsx` line 108
- **Priority:** Fix before deployment

#### BUG-2: storage_path not validated against expected pattern (IDOR risk)
- **Severity:** High (Security)
- **Steps to Reproduce:**
  1. Authenticate as a member of Project A
  2. Upload a PDF to Project A normally (file goes to Storage)
  3. Send a crafted POST to `/api/projects/{projectA}/drawings` with body `{"display_name":"test","storage_path":"OTHER_PROJECT_ID/OTHER_DRAWING.pdf","file_size":1000}`
  4. Expected: Server rejects the storage_path as invalid
  5. Actual: Server accepts any string as storage_path and saves it to the database
  6. Then call GET `/api/projects/{projectA}/drawings/{newDrawingId}/url` to get a signed URL for the OTHER project's file
- **Affected File:** `src/app/api/projects/[id]/drawings/route.ts` (POST handler)
- **Priority:** Fix before deployment

#### BUG-3: Signed URL expiry too long (10 years)
- **Severity:** High (Security)
- **Steps to Reproduce:**
  1. Open any drawing in the viewer
  2. Inspect network requests in browser DevTools
  3. Copy the signed URL from the `/url` API response
  4. Expected: URL expires after a short period (1 hour or 24 hours)
  5. Actual: URL is valid for 10 years (315,360,000 seconds). If leaked, the PDF is accessible to anyone without authentication for the URL's lifetime.
- **Affected File:** `src/app/api/projects/[id]/drawings/[drawingId]/url/route.ts` line 53
- **Priority:** Fix before deployment

#### BUG-4: No rate limiting on drawing API endpoints
- **Severity:** Medium (Security)
- **Steps to Reproduce:**
  1. Write a script that calls `POST /api/projects/{id}/drawings` in a tight loop
  2. Expected: Requests are rate-limited after a threshold
  3. Actual: All requests are processed without any throttling
- **Affected Files:** All API routes under `src/app/api/projects/[id]/drawings/`
- **Priority:** Fix in next sprint

#### BUG-5: Upload uses getSession() instead of getUser()
- **Severity:** Medium (Security)
- **Steps to Reproduce:**
  1. Review `src/hooks/use-drawings.ts` line 52
  2. `supabase.auth.getSession()` reads from local storage without server validation
  3. Expected: Use `getUser()` which validates the token against the Supabase Auth server
  4. Actual: Uses `getSession()` which could send a stale or tampered token
- **Affected File:** `src/hooks/use-drawings.ts` line 52
- **Priority:** Fix in next sprint

#### BUG-6: x-upsert allows file overwrite by any project member
- **Severity:** Medium (Security/Data Integrity)
- **Steps to Reproduce:**
  1. User A uploads a PDF to a project
  2. User B (also a project member) crafts an upload request with `x-upsert: true` to the same storage path
  3. Expected: Either reject overwrite or version the file
  4. Actual: The file is silently overwritten
- **Affected File:** `src/hooks/use-drawings.ts` line 65
- **Priority:** Fix in next sprint

#### BUG-7: Client-side PDF validation uses OR instead of AND
- **Severity:** Low
- **Steps to Reproduce:**
  1. Review `src/components/drawings/PdfUploadZone.tsx` line 26
  2. Condition: `file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")`
  3. A file named "evil.pdf" with MIME type "text/html" would pass (extension matches)
  4. Expected: Both MIME type AND extension should match
  5. Actual: Either match is sufficient on the client (server blocks wrong MIME)
- **Affected File:** `src/components/drawings/PdfUploadZone.tsx` line 26
- **Priority:** Nice to have (server enforces correctly)

#### BUG-8: Infinite re-render risk in fetchThumbnailUrls
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Review `src/app/(protected)/dashboard/projects/[id]/page.tsx` lines 47-69
  2. `fetchThumbnailUrls` depends on `drawings` and `getSignedUrl`
  3. `getSignedUrl` is a function that is re-created on every render of `useDrawings` (not wrapped in useCallback)
  4. Expected: Stable function reference
  5. Actual: `getSignedUrl` in `use-drawings.ts` is defined as a regular async function (not useCallback-wrapped), causing `fetchThumbnailUrls` to be recreated, triggering `useEffect` repeatedly
- **Affected Files:** `src/hooks/use-drawings.ts` (getSignedUrl not memoized), `src/app/(protected)/dashboard/projects/[id]/page.tsx` lines 47-69
- **Priority:** Fix before deployment

#### BUG-9: Viewer fetchUrl has same infinite loop risk
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Review `src/app/(protected)/dashboard/projects/[id]/drawings/[drawingId]/page.tsx` lines 51-68
  2. `fetchUrl` callback depends on `getSignedUrl` from `useDrawings`
  3. `getSignedUrl` is not memoized in the hook, causing `fetchUrl` to be recreated
  4. This triggers the useEffect on line 66-68 repeatedly
  5. Expected: Fetch URL once on mount
  6. Actual: Potentially infinite fetch loop
- **Affected Files:** Same as BUG-8
- **Priority:** Fix before deployment

### Regression Testing

#### PROJ-1 (User Authentication) - Status: In Review
- [x] Middleware still correctly redirects unauthenticated users
- [x] Auth flow unchanged (no modifications to auth components)
- [x] Login/Register routes still excluded from middleware protection
- **Result: No regression detected**

#### PROJ-2 (Projektverwaltung) - Status: In Review
- [x] Project detail page enhanced with drawings section — no removal of existing functionality
- [x] Project members section still renders below drawings
- [x] Project info section (name, description, badge) still renders correctly
- [x] InviteMemberDialog still included and functional
- **Result: No regression detected**

### Summary
- **Acceptance Criteria:** 10/10 passed (all criteria met at functional level)
- **Bugs Found:** 9 total (0 critical, 3 high, 4 medium, 1 low, 1 N/A)
- **Security:** Issues found (storage_path IDOR, 10-year signed URLs, no rate limiting, getSession usage, file overwrite)
- **Production Ready:** NO
- **Recommendation:** Fix BUG-1 (touch accessibility), BUG-2 (storage_path validation), BUG-3 (signed URL expiry), BUG-8, and BUG-9 (infinite loop risks) before deployment. Address BUG-4, BUG-5, BUG-6 in next sprint.

## Deployment
_To be added by /deploy_

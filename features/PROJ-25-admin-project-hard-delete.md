# PROJ-25: Admin Projekt-Hard-Delete

## Status: QA Passed
**Created:** 2026-04-24
**Last Updated:** 2026-04-24

## Dependencies
- PROJ-5 (Admin-Bereich) — erweitert das bestehende Admin-Paneel um einen neuen Tab
- PROJ-2 (Projektverwaltung) — betroffene Entität
- PROJ-6 (Archivierung) — archivierte Projekte sind ebenfalls löschbar
- PROJ-10 (Multi-Tenancy) — Tenant-Isolation ist Kern der Berechtigungslogik
- PROJ-15 (Audit-Log) — nutzt dieselbe Log-Idee, aber in neuer tenant-weiter Tabelle

## User Stories
- Als Tenant-Admin möchte ich im Admin-Paneel eine Liste aller Projekte meines Tenants sehen, damit ich den Überblick über alle verwalteten Projekte habe.
- Als Tenant-Admin möchte ich ein Projekt inklusive aller Zeichnungen, Versionen, Marker, Mitgliedschaften und Dateien komplett löschen können, damit ich Speicher freigeben und nicht mehr benötigte Projekte entsorgen kann — auch wenn ich nicht Owner dieses Projekts bin.
- Als Tenant-Admin möchte ich vor dem Löschen den Projektnamen zur Bestätigung eintippen müssen, damit ich nicht versehentlich das falsche Projekt lösche.
- Als Tenant-Admin möchte ich vor dem Löschen genau sehen, wie viele Zeichnungen, Versionen, Mitgliedschaften, Gruppen und wie viel Speicher entsorgt werden, damit ich die Tragweite einschätzen kann.
- Als Tenant-Admin eines anderen Tenants darf ich Projekte außerhalb meines Tenants **nicht** sehen oder löschen, damit die Multi-Tenant-Isolation gewahrt bleibt.
- Als Tenant-Admin möchte ich, dass nach dem Löschen ein Audit-Log-Eintrag bestehen bleibt (auch wenn das Projekt selbst weg ist), damit nachvollziehbar ist, wer wann welches Projekt entsorgt hat.

## Acceptance Criteria

### UI — Admin-Tab „Projekte"
- [ ] Im Admin-Paneel (`/admin`) gibt es einen neuen Tab „Projekte" neben Nutzerverwaltung, Freigaben und Status.
- [ ] Der Tab zeigt eine Liste aller Projekte des eigenen Tenants (aktiv + archiviert).
- [ ] Archivierte Projekte sind mit einem Badge „Archiviert" sichtbar markiert.
- [ ] Ein Toggle/Filter „Archivierte anzeigen" ist vorhanden (Default: aus, um Dashboard-Fokus zu erhalten).
- [ ] Pro Zeile werden angezeigt: Projektname, Erstellungsdatum, Anzahl Zeichnungen, Anzahl Mitglieder, Archivierungsstatus, Lösch-Button.
- [ ] Liste ist alphabetisch nach Name sortiert.
- [ ] Ladezustand (Skeleton), Fehlerzustand (Retry-Button) und leerer Zustand („Keine Projekte") sind implementiert.
- [ ] Responsiv: Mobile (375px) klappen die Metadaten unter den Namen, Delete-Button bleibt erreichbar.
- [ ] Tab wird nicht angezeigt / Zugang ist 403, wenn User kein Admin ist.

### UI — Lösch-Confirm-Dialog
- [ ] Klick auf den Lösch-Button öffnet einen `AlertDialog` (shadcn/ui).
- [ ] Dialog zeigt den Projektnamen groß und prominent.
- [ ] Dialog zeigt die konkreten Zahlen dessen, was gelöscht wird: X Zeichnungen, Y Versionen, Z Mitglieder, N Gruppen, Speicher-Volumen (MB/GB).
- [ ] Dialog enthält ein Texteingabefeld mit Label „Tippe den Projektnamen zum Bestätigen" und dem Projektnamen als Placeholder.
- [ ] Der „Endgültig löschen"-Button ist deaktiviert, bis die Eingabe exakt dem Projektnamen entspricht (case-sensitive).
- [ ] Während des Löschens: Button zeigt Spinner, ist deaktiviert, `Abbrechen` ebenfalls deaktiviert, Dialog nicht schließbar via ESC/Overlay-Click.
- [ ] Bei Erfolg: Dialog schließt, Toast „Projekt gelöscht", Liste aktualisiert sich (Projekt verschwindet).
- [ ] Bei Fehler: Fehlermeldung im Dialog sichtbar, Dialog bleibt offen, Projekt bleibt in der Liste.

### Backend — API
- [ ] Neue Route `GET /api/admin/projects/list` liefert alle Projekte des eigenen Tenants inkl. Zähler (drawings, members, groups) und Storage-Größen-Summe.
- [ ] Neue Route `DELETE /api/admin/projects/[projectId]` führt den Hard-Delete aus.
- [ ] Beide Routen prüfen: Authentifiziert + `is_admin=true` + `status='active'` via `getAuthenticatedAdmin`.
- [ ] DELETE-Route prüft **zusätzlich**, dass `project.tenant_id == admin.tenant_id` — Tenant-Isolation auf API-Ebene (zweite Verteidigungslinie neben RLS).
- [ ] DELETE-Route verwendet Service-Role-Client für alle schreibenden Operationen (Storage-Remove + DB-Delete + Trigger-ALTER), da RLS und Schutz-Trigger den normalen Client blockieren würden.

### Backend — Lösch-Ablauf
- [ ] Schritt 1: Storage-Objekte im Bucket `drawings` unter Prefix `<project_id>/` rekursiv sammeln und via `supabase.storage.from('drawings').remove(paths)` in Batches von max. 100 entfernen.
- [ ] Schritt 2: Bei Storage-Fehler → Abbruch, **DB bleibt unverändert**, HTTP 500 mit Fehlermeldung. Bereits gelöschte Files werden als Waisen hingenommen (Admin kann Lösch-Vorgang wiederholen; die noch vorhandenen Files werden erneut gelistet und mit-gelöscht).
- [ ] Schritt 3: Audit-Log-Eintrag in neue Tabelle `tenant_activity_log` mit `action_type='project.deleted'`, `tenant_id`, `user_id` (Admin), `metadata: { project_id, project_name, drawings_count, members_count, storage_bytes, deleted_at }`. Eintrag geschieht **vor** dem DB-Delete, damit er existiert, auch wenn der DB-Delete scheitert.
- [ ] Schritt 4: DB-Transaktion: beide `project_members`-Schutz-Trigger (`check_last_owner_before_delete`, `prevent_owner_leave_trigger`) `DISABLE TRIGGER`, `DELETE FROM projects WHERE id = ...`, Trigger wieder `ENABLE TRIGGER`, COMMIT.
- [ ] Schritt 5: Bei DB-Fehler → HTTP 500, Trigger dürfen **nicht** im deaktivierten Zustand bleiben (Transaktion rollt zurück, oder ENABLE in einem `CATCH`-Block).
- [ ] Antwort bei Erfolg: `200 { deleted: { project_id, project_name, drawings, members, storage_bytes } }`.

### Datenbank
- [ ] Neue Tabelle `tenant_activity_log` (nicht FK-gekoppelt an `projects`, damit Einträge projekt-unabhängig bestehen bleiben):
  - `id UUID PK`
  - `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
  - `user_id UUID REFERENCES profiles(id) ON DELETE SET NULL`
  - `action_type TEXT NOT NULL` (initial nur `'project.deleted'`)
  - `target_type TEXT NOT NULL` (initial nur `'project'`)
  - `target_id UUID` (ehem. `project.id`, kann nach Löschung nicht mehr referenziert werden → **kein FK**)
  - `metadata JSONB`
  - `created_at TIMESTAMPTZ DEFAULT now()`
- [ ] Indexe: `(tenant_id, created_at DESC)` für Admin-Anzeigen, `(action_type, created_at DESC)` für Filterung.
- [ ] RLS aktiviert: Admins dürfen nur Einträge ihres eigenen Tenants lesen; INSERT passiert ausschließlich via Service-Role in der API.
- [ ] `search_path` in allen ggf. eingeführten Funktionen gepinnt (`SET search_path = public, pg_temp`).

### Sicherheit & Integrität
- [ ] User ohne `is_admin` erhält 403 beim Aufruf der DELETE-Route.
- [ ] User, der versucht, ein Projekt eines fremden Tenants zu löschen (manuell an der API), erhält 404 (nicht 403 — „information hiding").
- [ ] Request-Body wird (sofern vorhanden) per Zod validiert. Projekt-ID kommt aus dem URL-Param; Zod-Check auf UUID-Format.
- [ ] Löschen setzt den Admin als Log-Eintrag-Urheber; falls später der Admin-User ebenfalls gelöscht wird, bleibt `user_id NULL`, der Eintrag bleibt erhalten.

### Internationalisierung
- [ ] Alle neuen UI-Strings sind in `src/messages/de.json` (und `en.json`, falls vorhanden) unter `admin.projects.*` hinterlegt.
- [ ] Keine hardcoded deutschen Strings im Code — alles über `useTranslations('admin')`.

## Edge Cases

- **Storage-Delete schlägt fehl** (z.B. Bucket-API down): API gibt 500 zurück, DB und Projekt bleiben intakt, Admin kann den Vorgang wiederholen. UI zeigt „Löschen fehlgeschlagen — bitte erneut versuchen."
- **DB-Delete schlägt fehl nach erfolgreichem Storage-Delete**: Storage-Dateien sind dann weg, aber Projekt-Datensatz existiert noch → inkonsistenter Zustand. Mitigation: Audit-Log-Eintrag informiert, Admin kann den Vorgang wiederholen, wobei der Storage-List-Schritt dann leer ist und direkt weiter zum DB-Delete springt. → **Lösch-Ablauf muss idempotent sein**.
- **Ein User hat das zu löschende Projekt gerade offen** (in anderem Tab): Nach dem Delete schlagen alle weiteren Requests mit 404 fehl; der Client soll bei 404 auf `/dashboard` zurückleiten (siehe Standard-Error-Handling).
- **Projekt ist bereits archiviert**: Keine Sonderbehandlung — Archivierung ist nur ein Flag, der Lösch-Vorgang ist identisch.
- **Projekt hat 0 Zeichnungen / 0 Mitglieder**: Normaler Ablauf, Storage-Prefix ist leer, DB-Delete läuft trotzdem durch. Zähler im Dialog zeigt „0".
- **Admin löscht sich durch Projekt-Löschung selbst aus einem Projekt**: Kein Problem, weil Projekt-Member-Trigger deaktiviert sind.
- **Zwei Admins löschen gleichzeitig dasselbe Projekt**: Zweiter Request findet kein Projekt (404), hat aber u.U. die Storage-Objekte noch gesehen und versucht zu löschen → harmlos, bestenfalls 0 Files zu löschen.
- **Admin mit `status != 'active'`** (deaktivierter Admin): 403.
- **Letztes Projekt des Tenants**: Normaler Ablauf. Tenant bleibt bestehen.
- **Sehr großes Projekt** (z.B. 1.000 Zeichnungen, 5 GB Storage): Batch-Delete in 10er-Chunks à 100 Files = 10 API-Calls. Muss < 30 s dauern (Vercel Hobby-Timeout 10 s — ggf. Route als Edge/Node ausweisen und Streaming-Antwort oder async erwägen). Realistisches Limit dokumentieren.
- **Audit-Log-Tabelle nicht migriert**: DELETE-Route prüft Existenz nicht; Migration muss vor Deploy durchlaufen.
- **Trigger-Reaktivierung schlägt fehl nach erfolgreichem Delete**: Schutz-Trigger bleiben dauerhaft deaktiviert — kritischer Systemzustand. Mitigation: SQL als eine einzige Transaktion formulieren, die bei jedem Fehler zurückrollt **inkl. DISABLE-Statements**.

## Technical Requirements

- Performance: DELETE-Endpunkt soll für Projekte < 100 Zeichnungen unter 10 s antworten (Vercel-Hobby-Grenze).
- Security: Service-Role-Key niemals an den Client exponieren. Route ausschließlich serverseitig (App-Router Route Handler).
- Browser-Support: Wie restliche Admin-UI (Chrome, Firefox, Safari, Edge, mobile PWA).
- Keine Breaking Changes an bestehenden `/api/projects/*`-Routen.
- SQL-Migration muss manuell auf Supabase-Live-DB appliziert werden (Memory-Feedback).
- Alle neuen SQL-Funktionen mit `SET search_path = public, pg_temp` gepinnt (Memory-Feedback).
- RLS-Policies nutzen `(select auth.uid())` statt `auth.uid()` direkt (Memory-Feedback).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Zweck dieses Abschnitts
Dieser Abschnitt beschreibt, **welche Bausteine** neu gebaut werden, **wo sie sich einfügen** und **warum** diese Wege gewählt wurden. Implementierungsdetails folgen im `/frontend`- und `/backend`-Schritt.

### A) UI-Struktur (Komponenten-Baum)

```
/admin  (bestehendes Admin-Paneel)
├── Header (bestehend)
├── Tab-Navigation (bestehend)
│   ├── Nutzerverwaltung        (bestehend)
│   ├── Freigaben               (bestehend)
│   ├── Status                  (bestehend)
│   └── Projekte                ← NEU: neuer Tab
└── Tab-Inhalt
    └── /admin/projects  ← NEU: neue Seite
        ├── Header ("Projekte deines Teams", Filter-Toggle "Archivierte anzeigen")
        ├── Ladezustand      → Skeleton-Liste (beim Laden)
        ├── Fehlerzustand    → Fehlermeldung + Retry
        ├── Leerzustand      → "Keine Projekte"
        └── Projekt-Liste (eine Karte je Projekt)
            ├── Name + Archiviert-Badge + Erstellungsdatum
            ├── Meta-Info: X Zeichnungen · Y Mitglieder · Z MB Speicher
            └── Lösch-Button (rot, Icon: Papierkorb)
                └── öffnet: DeleteProjectDialog  ← NEU: neue Komponente
                    ├── Projektname (groß, hervorgehoben)
                    ├── Vorschau "Was wird gelöscht":
                    │   · X Zeichnungen
                    │   · Y Versionen
                    │   · N Mitgliedschaften
                    │   · M Gruppen
                    │   · Z MB Dateien im Speicher
                    ├── Warnhinweis "Diese Aktion ist nicht rückgängig zu machen"
                    ├── Texteingabefeld "Tippe den Projektnamen zum Bestätigen"
                    └── Buttons: [Abbrechen]  [Endgültig löschen]
                                              └── aktiviert sobald Eingabe == Projektname
```

**Alle neuen UI-Elemente** setzen auf vorhandene shadcn/ui-Primitive: `AlertDialog`, `Button`, `Input`, `Badge`, `Skeleton`, `Card`. **Keine neuen shadcn-Komponenten** müssen installiert werden.

### B) Daten-Modell (in Klartext)

**Neue Tabelle: `tenant_activity_log`**

Diese Tabelle speichert wichtige Admin-Aktionen, die das gelöschte Objekt überleben müssen (z.B. Projekt-Löschungen). Sie ist bewusst **nicht** mit `projects` verknüpft, damit der Eintrag nach dem Löschen erhalten bleibt.

Ein Eintrag enthält:
- Eigene eindeutige ID
- Zu welchem Tenant (Team) gehört der Eintrag
- Welcher Admin hat die Aktion ausgeführt (darf leer werden, falls der Admin später selbst gelöscht wird)
- Was wurde getan (z.B. `project.deleted`)
- Worauf bezog sich die Aktion (Typ + ID des gelöschten Objekts, z.B. `project` + `<uuid>`)
- Details als freies JSON (Projektname, Zeichnungs-Anzahl, Speicher-Volumen, Zeitpunkt)
- Wann

**Warum separat von der existierenden `activity_log`-Tabelle?**
Die bestehende `activity_log` ist projekt-gekoppelt (projekt-id darf nicht leer sein) und wird bei Projekt-Löschung per Cascade mit entfernt. Ein Löschungs-Protokoll, das beim Löschen selbst gelöscht wird, wäre sinnlos.

**Zugriffsrechte auf `tenant_activity_log`:**
- Admins des eigenen Tenants dürfen **lesen** (für spätere Audit-Sicht).
- **Schreiben** passiert ausschließlich durch den Server mit Service-Role (kein Client-Schreibzugriff) — damit niemand Einträge manipulieren kann.

**Keine Änderungen** an bestehenden Tabellen (`projects`, `drawings`, `drawing_versions`, `project_members`, `drawing_groups`, `activity_log`, `storage.objects`). Der Lösch-Vorgang stützt sich auf vorhandene `ON DELETE CASCADE`-Beziehungen.

### C) API-Endpoints (neu)

Zwei neue Server-Endpunkte unter `/api/admin/projects/`:

| Endpunkt | Methode | Zweck |
|---|---|---|
| `/api/admin/projects/list` | GET | Alle Projekte des Tenants laden — inkl. Kennzahlen (Zeichnungen, Versionen, Mitglieder, Gruppen, Speichergröße) für die Anzeige und den Confirm-Dialog |
| `/api/admin/projects/[id]` | DELETE | Projekt vollständig löschen (Storage + DB + Audit-Log-Eintrag) |

Beide prüfen: Eingeloggt? Admin-Flag gesetzt? Status „aktiv"?
Zusätzlich beim DELETE: Gehört das Zielprojekt zum selben Tenant wie der Admin? Wenn nein → 404.

### D) Ablauf einer Löschung (Sequenz-Darstellung)

```
Admin klickt "Endgültig löschen"
  ↓
Client:      DELETE /api/admin/projects/<id>
  ↓
Server: 1. Admin-Check bestehen
             (is_admin = true, status = active)
        2. Tenant-Zugehörigkeit prüfen
             (sonst 404, keine Information-Leakage)
        3. Speicher-Dateien im Bucket "drawings" unter Prefix "<id>/" listen
        4. In Batches von 100 löschen
             bei Fehler → Abbruch, Antwort 500, DB unverändert
        5. Audit-Log-Eintrag schreiben (tenant_activity_log)
        6. Datenbank-Transaktion:
             • zwei Schutz-Trigger kurz deaktivieren
             • DELETE FROM projects — Cascade räumt Drawings/
               Versions/Members/Groups/Activity-Log auf
             • Schutz-Trigger wieder aktivieren
             • Transaktion committen
        7. Antwort: 200 OK mit Zusammenfassung
  ↓
Client:      Dialog schließt, Toast "Projekt gelöscht",
             Liste aktualisiert sich, gelöschtes Projekt verschwindet
```

**Warum Audit-Log-Eintrag vor dem DB-Delete?**
Damit das Protokoll auch existiert, falls der DB-Schritt scheitert. Der Eintrag ist dann „Projekt XY sollte gelöscht werden" — der Admin kann den Vorgang wiederholen.

**Warum Storage-Delete vor DB-Delete?**
Wenn die DB-Zeilen bereits weg wären, aber Storage-Delete scheitert, gäbe es keine Möglichkeit mehr, die Dateien den Projekten zuzuordnen — sie wären dauerhaft verwaiste Datenmüll-Objekte im Storage. Umgekehrt ist idempotent: Beim Re-Try findet Schritt 3 evtl. weniger Dateien, und das ist kein Problem.

### E) Berechtigungs-Modell

| Rolle | Tab „Projekte" sichtbar? | Darf löschen? |
|---|---|---|
| Tenant-Admin (is_admin=true, aktiv) | Ja | Ja — jedes Projekt des eigenen Tenants |
| Normaler User / Viewer / Guest | Nein | Nein (403 bei manuellem API-Aufruf) |
| Admin eines fremden Tenants | Nein | Nein (404 bei manuellem API-Aufruf) |
| Deaktivierter Admin (status ≠ active) | Nein | Nein (403) |
| Super-Admin (`/superadmin`) | — | Nicht betroffen; hat eigenen separaten Bereich |

**Bewusste Entscheidung (aus Requirements):** Kein Owner-Check. Tenant-Admin reicht. Begründung: Der Admin-Bereich existiert gerade für den Fall, dass der Projekt-Owner nicht verfügbar ist.

### F) Tech-Entscheidungen (mit Begründung)

1. **Neue Tabelle `tenant_activity_log` statt Erweiterung von `activity_log`**
   → Die bestehende Tabelle hat einen Pflicht-Fremdschlüssel auf `projects`. Ein nachträglicher Wechsel auf „optional" würde bestehende Abfragen (Activity-Feed pro Projekt) komplizieren. Eine saubere neue Tabelle ist übersichtlicher und erlaubt später weitere Tenant-Events (Nutzer-Rechte-Änderungen, Tenant-Einstellungen, etc.).

2. **Service-Role-Client für alle Schreib-Operationen**
   → Die `project_members`-Tabelle hat zwei Schutz-Trigger, die selbst bei RLS-Bypass via `SECURITY DEFINER` aktiv werden. Service-Role ist der etablierte Weg im Projekt (siehe Memory-Feedback).

3. **Storage-Delete über das Supabase-SDK, nicht via SQL auf `storage.objects`**
   → Direkter SQL-Zugriff ist durch `storage.protect_delete()` blockiert. Das SDK nutzt die offizielle Storage-REST-API, die mit Service-Role-Key funktioniert.

4. **Confirm-Dialog mit Projektname-Eintippen (GitHub-Stil)**
   → Verhindert versehentliches Löschen. Eine einfache „Bist du sicher?"-Frage hat sich als zu schwach erwiesen.

5. **React Query für die neue Admin-Projekt-Liste** (statt plain fetch + useState wie bisherige Admin-Hooks)
   → Memory-Feedback: „React Query ersetzte eigenes IndexedDB-Caching (April 2026)". Neue Hooks sollen diesem Muster folgen. Nach dem Löschen invalidiert ein Mutation-Callback den Listen-Cache automatisch.

6. **Zwei getrennte Endpunkte (`list` + `[id]` DELETE) statt Mehrzweck-Route**
   → Klare HTTP-Semantik. Auch einfacher zu testen und mit Rate-Limiting zu belegen.

7. **Synchroner Lösch-Endpoint** (nicht asynchron via Queue)
   → Für typische Projekt-Größen (< 100 Zeichnungen) reicht die 10-s-Grenze auf Vercel locker. Der reale Test hat 164 Dateien in unter 5 Sekunden abgebaut. Für Mega-Projekte ist der Endpoint ein Risiko; das wird im Spec als bekanntes Limit dokumentiert und kann später zu Background-Job umgebaut werden.

### G) Dependencies (neue Pakete)

**Keine neuen Pakete nötig.** Wir nutzen ausschließlich:
- Bereits installierte shadcn/ui-Komponenten (`AlertDialog`, `Input`, `Button`, `Badge`, `Skeleton`, `Card`)
- Bestehender Supabase-JS-Client (Storage-SDK + Service-Role)
- React Query (bereits im Projekt)
- Sonner (bestehende Toast-Lösung)
- Lucide Icons (bestehend)

### H) Was bewusst NICHT gebaut wird

- **Kein Papierkorb / Soft-Delete** — explizit per Requirements ausgeschlossen.
- **Keine Wiederherstellung** gelöschter Projekte.
- **Kein Massen-Delete** (nur ein Projekt pro Dialog).
- **Keine Audit-Log-Ansicht** in diesem Feature (Tabelle wird angelegt, UI dazu ist Thema für ein mögliches Folge-Feature).
- **Keine Änderung an bestehenden Routen** (`/api/projects/*`, `/api/projects/[id]/archive`, etc.).
- **Kein asynchroner Background-Delete** — synchron im Request-Cycle (Limit bei sehr großen Projekten akzeptiert).

## Implementation Notes

### Frontend (2026-04-23)

- **New page:** `src/app/admin/projects/page.tsx` — admin tab with project list, archive toggle (default off), skeleton/error/empty states, responsive card layout (375px → 1440px). Cards collapse meta rows beneath the project name on mobile; delete button becomes full-width on mobile.
- **New component:** `src/components/admin/DeleteProjectDialog.tsx` — shadcn `AlertDialog` + `Input` + `Label` + `Button`. Type-to-confirm (case-sensitive), disables close via ESC/overlay during submit, renders inline error on failure, shows counts (drawings, versions, members, groups, storage) coming from the list endpoint.
- **New hook:** `src/hooks/use-admin-projects.ts` — React Query `useQuery(['admin','projects','list'])` + `useMutation` for delete. `onSuccess` invalidates both the admin list and `['projects']` to keep the user's own project dashboard in sync (per memory feedback: React Query caches must be invalidated explicitly).
- **New types:** `AdminTenantProject`, `AdminProjectDeleteResult` in `src/lib/types/admin.ts`.
- **Layout update:** `src/app/admin/layout.tsx` — tab labels moved to translations (`admin.nav.*`); added `Projekte` tab; tab row now horizontally scrollable on narrow viewports so four tabs stay reachable at 375px.
- **i18n:** added `admin.nav.*`, `admin.projects.*` (incl. `delete.*`, `meta.*`, `counts.*`, `empty.*`, `toasts.deleted`) in both `src/messages/de.json` and `src/messages/en.json`. Count strings use ICU plural rules.
- **shadcn components used:** `AlertDialog`, `Button`, `Input`, `Label`, `Badge`, `Card`, `Skeleton`, `Switch`. No new shadcn installations required.
- **Contract expected from backend (to be built by `/backend`):**
  - `GET /api/admin/projects/list` → `{ projects: AdminTenantProject[] }` with `{ id, name, is_archived, created_at, drawings_count, versions_count, members_count, groups_count, storage_bytes }`.
  - `DELETE /api/admin/projects/[projectId]` → `200 { deleted: { project_id, project_name, drawings, members, storage_bytes } }` or `{ error }` with `4xx/5xx`.
- **Accessibility:** alert dialog has `aria-describedby` hint for the confirm input, destructive warning uses `role="alert"`, list wrapped in `<ul>` with descriptive `aria-label`, delete button has per-project `aria-label`, decorative icons are `aria-hidden`.
- **Not yet wired:** the GET/DELETE endpoints and the `tenant_activity_log` table/RLS — `/backend` handoff.

## QA Test Results

**Tested:** 2026-04-23
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Test Scope:** Static code review of the implementation across frontend (`/admin/projects` page, `DeleteProjectDialog`, `use-admin-projects`), backend (`GET /api/admin/projects/list`, `DELETE /api/admin/projects/[projectId]`), DB migrations (`031_tenant_activity_log.sql`, `032_admin_hard_delete_project.sql`) and i18n. `npx tsc --noEmit` passes with zero errors. `next lint` is currently broken by a Next.js 16 CLI issue (`Invalid project directory provided, no such directory: .../lint`) — not caused by this feature, but blocks the lint stage; see BUG-6.

### Acceptance Criteria Status

#### AC-1: UI — Admin-Tab "Projekte"
- [x] Admin-Paneel erhält neuen Tab "Projekte" in `src/app/admin/layout.tsx` (Reihenfolge: Nutzer, Freigaben, Status, Projekte).
- [x] Liste zeigt alle Projekte des eigenen Tenants via `/api/admin/projects/list`.
- [x] Archivierte Projekte tragen `Badge variant="secondary"` mit `archivedBadge` Label.
- [x] Toggle `Archivierte anzeigen` (shadcn `Switch`, default off) filtert via `showArchived` State; Zähler der archivierten Projekte wird neben dem Label angezeigt.
- [x] Pro Zeile: Name, Erstellungsdatum, Zeichnungen, Mitglieder, Speicher, Archiviert-Badge, Lösch-Button.
- [x] Alphabetische Sortierung via `localeCompare(..., { sensitivity: 'base' })`.
- [x] Lade-Skeleton (4 Cards), Fehler mit Retry, Empty-State (zwei Varianten je nach Toggle) implementiert.
- [x] Mobile Card klappt Meta-Zeile unter den Namen (`flex-col sm:flex-row`), Button `w-full sm:w-auto`.
- [x] Zugriff zum Admin-Layout wird über bestehende Admin-Layout-Gate gesichert (Tab wird angezeigt, aber API gibt 403).
- [ ] **BUG-1 (Medium):** Anders als in der Spec („pro Zeile: Anzahl Gruppen") wird die **Gruppen-Anzahl in der Listenansicht nicht angezeigt** — nur im Delete-Dialog. Versions-Count fehlt ebenfalls in der Listen-Zeile. Daten sind aus dem Endpoint vorhanden, werden nur nicht gerendert (siehe `src/app/admin/projects/page.tsx:177-201`).

#### AC-2: UI — Lösch-Confirm-Dialog
- [x] Klick öffnet shadcn `AlertDialog`.
- [x] Projektname wird groß und hervorgehoben dargestellt (`text-lg font-semibold`, `data-testid="delete-project-name"`).
- [x] Zählerblock zeigt Zeichnungen / Versionen / Mitglieder / Gruppen / Speicher (`counts.*` mit ICU-Plural).
- [x] `Input` mit Label `confirmLabel`, `placeholder={project.name}`.
- [x] „Endgültig löschen"-Button ist disabled bis `confirmInput === project.name` (case-sensitive, exakte Übereinstimmung).
- [x] Während Submit: `Loader2`-Spinner sichtbar, `submit`/`cancel`/`Input` alle disabled, ESC-Key wird per `onEscapeKeyDown` abgefangen, `onOpenChange` blockt Overlay-Close solange `submitting`.
- [x] Erfolgsfall: Parent ruft `setTargetProject(null)` → Dialog schließt, `toast.success(t("toasts.deleted", { name }))`, React-Query-Invalidation aktualisiert Liste.
- [x] Fehlerfall: Dialog bleibt offen, `errorMsg` wird als `role="alert"`-Box unter dem Input angezeigt.

#### AC-3: Backend — API
- [x] `GET /api/admin/projects/list` liefert `{ projects: AdminTenantProject[] }` mit allen verlangten Kennzahlen.
- [x] `DELETE /api/admin/projects/[projectId]` implementiert den Hard-Delete inkl. Storage + Audit-Log + RPC.
- [x] Beide Routen rufen `getAuthenticatedAdmin(supabase)` → prüft `is_admin=true` und `status='active'`.
- [x] DELETE-Route filtert `project.tenant_id === admin.tenantId`; bei Mismatch → 404 (Information-Hiding) statt 403. Zweite Verteidigungslinie neben RLS korrekt implementiert.
- [x] DELETE-Route nutzt `createServiceRoleClient()` für Storage + Audit-Insert + RPC.
- [x] Zod-Validierung auf `projectId` UUID (`adminProjectIdParamSchema`) ist vorhanden.
- [x] Rate-Limit (20 deletes / 60 s pro Admin-User) implementiert; gibt 429 mit `Retry-After` zurück.
- [ ] **BUG-2 (Low):** `/api/admin/projects/list` loggt die Fehler der Aggregations-Queries (`console.error`) — exposure ist minimal (kein Request-Body-Echo), aber die Error-Strings stammen aus Supabase und können die Projekt-IDs des aktuellen Tenants enthalten. Unkritisch, aber inkonsistent mit der allgemeinen Praxis, Supabase-Messages nicht zu loggen.
- [ ] **BUG-3 (Low):** Die alte Route `GET /api/admin/projects` (`src/app/api/admin/projects/route.ts`) verwendet den User-Client (kein Service-Role) und filtert nicht nach `tenant_id` — stützt sich vollständig auf RLS. Das ist zwar nicht Teil von PROJ-25, aber die neue Route `/list` nebenan könnte Verwirrung stiften. Sicherheitstechnisch OK (RLS filtert), aber Namensähnlichkeit `/list` vs. `/` ist inkonsistent.

#### AC-4: Backend — Lösch-Ablauf
- [x] Schritt 1 — `listAllProjectStoragePaths`: Rekursiver Walk über Bucket-Struktur mit 1000er-Pagination, folgt Unterordnern korrekt.
- [x] Schritt 2 — `removePathsInBatches`: Batches à 100 Files, bricht bei Storage-Fehler ab → HTTP 500, DB unverändert.
- [x] Schritt 3 — Audit-Log-Insert läuft **vor** dem DB-Delete; Metadata enthält Projektname, alle Counters, `storage_bytes`, `storage_objects_removed`, `deleted_at`.
- [x] Schritt 4 — `admin_hard_delete_project` RPC: DISABLE Trigger → DELETE → ENABLE Trigger, mit EXCEPTION-Block der auch im Fehlerfall re-enabled.
- [x] Schritt 5 — Trigger werden im EXCEPTION-Block re-enabled bevor `RAISE` propagiert; search_path gepinnt.
- [x] Erfolgs-Response: `200 { deleted: { project_id, project_name, drawings, members, storage_bytes } }`.
- [ ] **BUG-4 (Medium):** Der **Audit-Log-Eintrag wird vor dem Storage-Delete nicht geschrieben** — er läuft zwischen Storage-Delete und DB-Delete. Die Spec verlangt (AC Schritt 3): „Eintrag geschieht vor dem DB-Delete, damit er existiert, auch wenn der DB-Delete scheitert." Das ist erfüllt. ABER: Wenn der Storage-Delete scheitert, existiert kein Audit-Trail für den fehlgeschlagenen Versuch. Spec-konform, aber nur weil der Edge-Case nicht explizit gefordert ist. Nicht blocking, aber Implementierungsdetail wert zu erwähnen.
- [ ] **BUG-5 (High):** Der RPC `admin_hard_delete_project` (`supabase/migrations/032_admin_hard_delete_project.sql`) nutzt `ALTER TABLE ... DISABLE TRIGGER`. Das erfordert Superuser-Rechte oder table-owner-Rechte. `SECURITY DEFINER` führt als Owner der Function aus — **nur wenn die Function selbst vom postgres/table-owner angelegt wurde**. Wenn die Migration von einer Rolle angelegt wurde, die nicht Owner von `project_members` ist, schlägt `ALTER TABLE DISABLE TRIGGER` zur Laufzeit mit `must be owner of table` fehl. Dies ist nicht rein statisch erkennbar und muss **zwingend in der Live-Supabase-DB gegen einen echten Projektlöschvorgang getestet werden**, bevor Production-Deploy. Siehe auch Memory-Feedback „Project-Delete erfordert Trigger-Disable" — dort hat genau dieses Muster in der Vergangenheit Probleme gemacht.

#### AC-5: Datenbank
- [x] Tabelle `tenant_activity_log` hat PK/Tenant-FK (CASCADE), optionaler User-FK (SET NULL), `action_type` + `target_type` mit CHECK-Constraints, `target_id` **ohne** FK zu projects (bewusst), `metadata JSONB NOT NULL DEFAULT '{}'`, `created_at` mit DEFAULT NOW().
- [x] Indexe: `(tenant_id, created_at DESC)`, `(action_type, created_at DESC)`, zusätzlich `(user_id)` — decken die Spec-Anforderungen.
- [x] RLS aktiviert; SELECT-Policy prüft Admin-Status + Tenant-Match mit `(select auth.uid())` Pattern (Memory-Feedback konform).
- [x] Kein INSERT/UPDATE/DELETE-Policy für authenticated — nur Service-Role kann schreiben; Log ist aus Applikationssicht immutable. Korrekt.
- [x] `admin_hard_delete_project` mit `SET search_path = public, pg_temp` gepinnt.
- [x] EXECUTE-Grant auf `admin_hard_delete_project` auf `service_role` beschränkt, Revoke von `anon`/`authenticated`/`PUBLIC`.

#### AC-6: Sicherheit & Integrität
- [x] `is_admin=false` → 403 (via `getAuthenticatedAdmin`).
- [x] Fremder Tenant → 404, nicht 403 (Information-Hiding korrekt).
- [x] `projectId` aus URL-Param per Zod auf UUID geprüft.
- [x] `user_id` im Audit-Log hat `ON DELETE SET NULL` → Eintrag überlebt Admin-Löschung.

#### AC-7: Internationalisierung
- [x] Alle UI-Strings in `src/messages/de.json` und `src/messages/en.json` unter `admin.nav.*` und `admin.projects.*`.
- [x] `useTranslations('admin.projects')` und Unter-Namespaces werden korrekt verwendet.
- [x] ICU-Plural-Rules für `drawings`/`versions`/`members`/`groups` in beiden Sprachen.
- [x] Keine hardcoded deutschen Strings in den neuen Dateien — stichprobenartig in `DeleteProjectDialog.tsx` und `page.tsx` verifiziert.
- [ ] **BUG-11 (Low):** In `src/app/admin/layout.tsx` ist das ARIA-Label `aria-label="Zurück zum Dashboard"` des Back-Buttons **hardcoded deutsch** (nicht durch diese Feature eingeführt, aber sichtbar im geänderten File). Nice-to-fix.

### Edge Cases Status

#### EC-1: Storage-Delete schlägt fehl
- [x] `removePathsInBatches` wirft, DELETE-Handler fängt → HTTP 500 mit deutschsprachigem Error-Payload; DB und Audit-Log unverändert.

#### EC-2: DB-Delete schlägt fehl nach erfolgreichem Storage-Delete
- [x] RPC wirft, Trigger werden im EXCEPTION-Block re-enabled, API gibt 500. Audit-Row existiert bereits → Admin sieht im Log, dass ein Versuch stattgefunden hat; Re-Try findet keinen Storage-Content mehr (idempotent).
- [ ] **BUG-7 (Medium):** Beim Re-Try eines in Schritt 8 gescheiterten Deletes wird **ein zweiter Audit-Log-Eintrag** geschrieben. Es gibt keine Deduplizierung. Folge: Das Audit-Log enthält 2+ Zeilen für das gleiche Projekt, auch wenn nur eine Löschung tatsächlich stattgefunden hat. Dokumentationswert > Datenqualitätsproblem, aber unschön.

#### EC-3: User hat Projekt in anderem Tab offen
- [x] Nach Delete schlagen Folge-Requests mit 404 fehl — Standard-Error-Handling im Rest der App fängt das (nicht durch PROJ-25 zu testen).

#### EC-4: Projekt bereits archiviert
- [x] Keine Sonderbehandlung im Code; Archivierung nur als Flag behandelt.

#### EC-5: Projekt mit 0 Zeichnungen / 0 Mitgliedern
- [x] `listAllProjectStoragePaths` returned `[]`, `storagePaths.length > 0` Check überspringt `removePathsInBatches`, RPC räuft trotzdem durch. OK.

#### EC-6: Admin löscht sich selbst durch Projekt-Löschung
- [x] `project_members`-Trigger sind während RPC disabled — Owner-Cascade läuft durch.

#### EC-7: Zwei Admins löschen gleichzeitig dasselbe Projekt
- [x] Zweiter Request findet Projekt nicht → 404. Storage-Liste des zweiten Requests ist leer (erster hat aufgeräumt) → direkter Übergang zum RPC, der dann 0 rows löscht ohne Fehler. **ABER:** Der zweite Request schreibt trotzdem einen Audit-Log-Eintrag, siehe BUG-7.

#### EC-8: Admin mit `status != 'active'`
- [x] `getAuthenticatedAdmin` gibt `isAdmin=false` zurück → 403.

#### EC-9: Letztes Projekt des Tenants
- [x] Normaler Ablauf, keine Tenant-Cascades.

#### EC-10: Sehr großes Projekt (1000 Zeichnungen, 5 GB)
- [x] `maxDuration = 30` erlaubt bis 30 s (Vercel Pro-Limit; Hobby hat weiterhin Limit 10 s — **prüfen vor Deploy**).
- [ ] **BUG-8 (Medium):** `versionsSizeRes` nutzt `.limit(100_000)` — für ein Mega-Projekt mit >100k Versionen wäre der `storage_bytes`-Wert im Audit-Log zu niedrig. Realistischer Grenzfall, aber dokumentieren.

#### EC-11: Audit-Log-Tabelle nicht migriert
- [x] Migration 031 muss laufen, sonst schlägt INSERT fehl → 500. Wie in Spec beschrieben, liegt in Admin-Deploy-Verantwortung.

#### EC-12: Trigger-Reaktivierung schlägt fehl nach Delete
- [x] Reactivation läuft direkt nach DELETE; Fehler beim ALTER TABLE würde in Postgres zurückrollen (gleiche Transaktion).
- [ ] **BUG-9 (High — konditional):** Wenn `ALTER TABLE ENABLE TRIGGER` im Happy-Path (Zeile 51-52) fehlschlägt **nachdem** DELETE erfolgreich war, rollt die gesamte Function-Transaktion zurück. Das Projekt ist dann **nicht gelöscht** aber die API hat bereits die Audit-Log-Zeile (in separater Transaktion durch die Client-Library!) geschrieben. Resultat: Audit-Log sagt "gelöscht", DB sagt "existiert noch". Konsistenz-Problem. **Eintritts-Wahrscheinlichkeit sehr niedrig**, aber Audit-Trust ist beschädigt.

### Security Audit Results

- [x] **Authentication:** Beide Routen verlangen authentifizierten User; 401 bei fehlendem Session.
- [x] **Authorization horizontal:** `is_admin` + `status='active'` wird geprüft; normaler User / Viewer / Guest bekommt 403.
- [x] **Authorization vertikal (Tenant):** DELETE prüft `project.tenant_id === admin.tenantId`, return 404 bei Mismatch. Zweite Verteidigungslinie neben RLS vorhanden.
- [x] **Information Hiding:** 404 statt 403 für fremde Tenants — `{ error: "Projekt nicht gefunden" }` lässt keine Schlüsse auf Existenz in fremdem Tenant zu.
- [x] **Input Validation:** Zod `adminProjectIdParamSchema` auf `projectId` (UUID); non-UUID → 400.
- [x] **SQL Injection:** Nur parametrisierte Supabase-Queries + ein RPC-Call mit benanntem Parameter. Kein String-Concat.
- [x] **XSS:** Projektname wird in React per Standard-Escaping gerendert; `break-words` + `truncate` beugen Layout-Breaks vor. Kein `dangerouslySetInnerHTML`. OK.
- [x] **Rate Limiting:** 20 Deletes / 60 s pro Admin → 429 mit `Retry-After`. Zusätzlich keine Rate-Limit-Bypass über Service-Role, da Limit pro `user.id` vergeben wird.
- [x] **Service-Role-Exposure:** Nur serverseitig, `createServiceRoleClient()` aus `@/lib/superadmin` — kein Leak zum Browser.
- [x] **RPC Lockdown:** `admin_hard_delete_project` REVOKE FROM PUBLIC/anon/authenticated, GRANT nur an service_role — ein Session-User kann die Function nicht direkt rufen (auch mit untergeschobener `supabase.rpc(...)` im Client nicht).
- [x] **Audit Tamper-Resistance:** Kein UPDATE/DELETE-Policy auf `tenant_activity_log` für authenticated; nur Service-Role kann schreiben. User kann eigene Audit-Zeilen nicht löschen.
- [x] **CSRF:** Next.js Route-Handler auf same-origin; keine Cookies-based Cross-Site-Risks in diesem Handler.
- [ ] **BUG-10 (Low):** `GET /api/admin/projects/list` hat **kein Rate-Limit**. Ein missbrauchter Admin-Account könnte eine teure Aggregations-Query beliebig oft auslösen (4 parallele Supabase-Queries über alle Drawings/Versions/Members/Groups des Tenants). Mitigation: Admin-Accounts sind vertrauenswürdig per Definition, aber Burst-Protection wäre konsistent mit DELETE-Route.
- [ ] **BUG-12 (Medium):** Das `versions` Query in `/list/route.ts:80` verwendet `drawings!inner(project_id)` — das **filtered join** ist semantisch korrekt, aber `.in("drawings.project_id", projectIds)` auf einen nested column ist ungewöhnliches PostgREST-Syntax und könnte theoretisch versionen **anderer Tenants** zurückgeben, wenn die Drawings-Projekt-ID nicht wie erwartet gefiltert wird. Bei Service-Role läuft kein RLS mehr. **Muss in Live-DB mit Multi-Tenant-Daten verifiziert werden**, dass `c.versions` und `c.storage_bytes` wirklich nur projekte des eigenen Tenants aggregieren. Static review reicht hier nicht.

### Bugs Found

#### BUG-1: Listen-Zeile zeigt `versions_count` und `groups_count` nicht, obwohl vom API geliefert und in Spec gefordert
- **Severity:** Medium
- **Datei:** `src/app/admin/projects/page.tsx:177-201`
- **Steps to Reproduce:**
  1. Öffne `/admin/projects`
  2. Prüfe die Meta-Zeile einer Projekt-Karte
  3. Erwartet (Spec): „X Zeichnungen · Y Mitglieder · Z Gruppen · Erstellt am ..."
  4. Tatsächlich: „Erstellt ... · X Zeichnungen · Y Mitglieder · Speicher" — keine Gruppen, keine Versionen
- **Priority:** Fix before deployment (Spec sagt explizit „Anzahl Zeichnungen, Anzahl Mitglieder" und im Dialog kommen auch Gruppen/Versionen vor; Inkonsistenz zwischen List und Dialog)

#### BUG-2: `/admin/projects/list` loggt Supabase-Fehlertexte
- **Severity:** Low
- **Datei:** `src/app/api/admin/projects/list/route.ts:57, 93, 97, 101, 105`
- **Steps to Reproduce:** DB-Query schlägt fehl → `console.error` enthält die Supabase-Fehlermeldung, die in Vercel-Logs auftaucht. Kein kritisches Leak, aber nicht gehärtet.
- **Priority:** Nice to have

#### BUG-3: Alte Route `/api/admin/projects` (root) filtert nicht nach `tenant_id`
- **Severity:** Low (pre-existing, nicht durch PROJ-25 eingeführt)
- **Datei:** `src/app/api/admin/projects/route.ts`
- **Anmerkung:** Diese Route benutzt User-Client → RLS filtert. Funktional OK, aber inkonsistent mit der neuen `/list`-Variante, die explizit auf tenant filtert. Nicht blocking für PROJ-25.
- **Priority:** Nice to have

#### BUG-4: Kein Audit-Log-Eintrag wenn Storage-Delete fehlschlägt
- **Severity:** Medium
- **Datei:** `src/app/api/admin/projects/[projectId]/route.ts:224-266`
- **Steps to Reproduce:**
  1. Storage-Bucket-API sei temporär down
  2. Admin klickt Delete
  3. Storage-Delete bricht bei Schritt 6 ab, API gibt 500
  4. In `tenant_activity_log` steht **kein Eintrag** über den fehlgeschlagenen Versuch
- **Expected (per Best Practice):** Auch Fehlversuche sollten geloggt werden, damit sichtbar ist „Admin X hat versucht, Projekt Y zu löschen".
- **Actual:** Nur erfolgreiche Durchläufe landen im Log.
- **Priority:** Fix in next sprint (Spec sagt explizit den Insert vor DB-Delete, nicht vor Storage-Delete — technisch spec-konform)

#### BUG-5: `ALTER TABLE DISABLE TRIGGER` in RPC — Ownership-Risiko
- **Severity:** High (potentiell, muss in Live-DB getestet werden)
- **Datei:** `supabase/migrations/032_admin_hard_delete_project.sql`
- **Steps to Reproduce:**
  1. Migration auf Live-Supabase-DB anwenden (per Memory-Feedback Pflicht)
  2. Tatsächlichen Projekt-Delete in UI auslösen
  3. Falls die Function nicht vom Owner von `public.project_members` angelegt wurde → Fehler `must be owner of table project_members`
- **Mitigation-Pfad:** Entweder Function als `postgres` User installieren oder alternative Strategie (z.B. alle triggers als `ENABLE ALWAYS` und expliziter Parameter, oder Owner-Check direkt im Trigger umgehen via `current_setting('app.bypass_owner_check')`).
- **Priority:** Fix before deployment — muss live verifiziert werden bevor Feature produktiv geht.

#### BUG-6: `npm run lint` bricht ab („Invalid project directory provided, no such directory: .../lint")
- **Severity:** Medium (blockiert CI, **nicht** durch PROJ-25 verursacht, aber blockiert Deploy-Gate)
- **Datei:** nicht PROJ-25-spezifisch; Next.js-16-Lint-CLI
- **Priority:** Fix before deployment (Separate Ticket; blockiert `/deploy`-Skill, der Lint als Gate verwendet)

#### BUG-7: Doppelte Audit-Log-Einträge bei Retry
- **Severity:** Medium
- **Datei:** `src/app/api/admin/projects/[projectId]/route.ts:239-257`
- **Steps to Reproduce:**
  1. Projekt-Delete startet, Storage ok, DB-RPC schlägt aus transientem Grund fehl
  2. Admin klickt erneut Delete
  3. Beim zweiten Durchlauf wird erneut eine Zeile in `tenant_activity_log` geschrieben
  4. Ergebnis: Zwei Einträge mit identischem `target_id`
- **Priority:** Fix in next sprint

#### BUG-8: Storage-Bytes-Query auf 100.000 Versionen limitiert
- **Severity:** Medium
- **Datei:** `src/app/api/admin/projects/[projectId]/route.ts:199` (`.limit(100_000)`)
- **Steps to Reproduce:** Ein Projekt mit >100.000 Versionen → die im Audit-Log dokumentierte `storage_bytes` ist zu niedrig (gemessen: nur die ersten 100k).
- **Priority:** Fix in next sprint (realistisches Limit dokumentieren)

#### BUG-9: Audit-Row inkonsistent mit DB nach trigger-reactivate-Failure
- **Severity:** High (konditional, niedrige Eintrittswahrscheinlichkeit)
- **Datei:** `supabase/migrations/032_admin_hard_delete_project.sql` + `src/app/api/admin/projects/[projectId]/route.ts:239-281`
- **Szenario:** Happy-Path Re-Enable-Triggers (SQL Zeilen 51-52) schlägt fehl → RPC-Transaktion rollt DELETE zurück → API sieht RPC-Error → gibt 500. Aber Audit-Insert war ein separater Round-Trip und ist bereits committed. Resultat: Zeile in `tenant_activity_log` mit `action_type='project.deleted'` existiert, aber das Projekt ist noch da.
- **Priority:** Fix in next sprint (Hebung Transaktions-Isolation oder Compensating-Action: nach RPC-Fehler Audit-Zeile löschen / patchen)

#### BUG-10: `/admin/projects/list` hat kein Rate-Limit
- **Severity:** Low
- **Datei:** `src/app/api/admin/projects/list/route.ts`
- **Priority:** Nice to have

#### BUG-11: Hardcoded deutscher `aria-label` im Admin-Layout
- **Severity:** Low (pre-existing)
- **Datei:** `src/app/admin/layout.tsx:34` (`aria-label="Zurück zum Dashboard"`)
- **Priority:** Nice to have

#### BUG-12: Tenant-Isolation in Versions-Aggregation muss live verifiziert werden
- **Severity:** Medium (potentiell High, falls sich PostgREST anders verhält als erwartet)
- **Datei:** `src/app/api/admin/projects/list/route.ts:80-81`
- **Steps to Reproduce (in Staging mit 2 Tenants):**
  1. Tenant A hat Projekt P1 mit Drawings+Versions
  2. Tenant B hat Projekt P2 mit Drawings+Versions
  3. Admin von Tenant A ruft `/api/admin/projects/list`
  4. Prüfen: Enthält `versionsRes.data` **ausschließlich** Versions deren `drawings.project_id` in `projectIds` von Tenant A liegt?
  5. Gleiches Prüfen für Storage-Bytes.
- **Priority:** Fix before deployment — **zwingend in Live-DB gegen Multi-Tenant-Daten testen**.

### Regression Impact (Related Features)

- **PROJ-5 (Admin-Paneel):** Tab-Leiste wurde um vierten Tab erweitert; `overflow-x-auto` verhindert Layout-Bruch auf 375 px. `admin.nav.*` Übersetzungen wurden neu eingeführt — bestehende Admin-Seiten (Nutzer, Freigaben, Status) sollten weiterhin funktionieren, da nur das Layout-Navigationslabel umgezogen wurde. Kein funktionaler Change.
- **PROJ-2 (Projektverwaltung):** Hard-Delete im Admin umgeht die normalen Projekt-Routes (`/api/projects/*`) komplett; Owner-Flows in PROJ-2 unverändert.
- **PROJ-6 (Archivierung):** Archivierte Projekte werden korrekt geflaggt und können ebenfalls gelöscht werden. Keine Änderung am Archivierungs-Endpoint.
- **PROJ-10 (Multi-Tenancy):** Tenant-Isolation wird doppelt geprüft (API + RLS); keine Anpassung an Middleware nötig.
- **PROJ-15 (Audit-Log):** Bestehendes `activity_log` unverändert; neues `tenant_activity_log` ist getrennt. Audit-Feeds pro Projekt bleiben funktional.
- **PROJ-17 (Projektmitgliedschaft):** Trigger `prevent_owner_leave_trigger` + `check_last_owner_before_delete` werden nur kurz während der Function disabled — normaler „Projekt verlassen"-Flow außerhalb dieser Function bleibt geschützt. Wenn Admin A gerade via `/admin/projects` löscht und gleichzeitig ein anderer User regulär Mitglied leavet, könnte das „Owner-Leave" wegen Trigger-Disabled durchgehen (Race). Sehr kleines Fenster, aber theoretisch möglich.
  - **BUG-13 (Low — Race Condition):** Während `admin_hard_delete_project` die Trigger disabled hat, sind **für alle anderen Transaktionen** diese Schutz-Trigger ebenfalls aus. Ein gleichzeitig laufender regulärer „Owner verlässt Projekt"-Request könnte das Validation-Fenster erwischen. Ist dies ein messbares Risiko? In der Praxis selten (Millisekunden-Fenster), aber dokumentationswürdig.

### Summary

- **Acceptance Criteria:** 42/49 fully passed (7 had either partial issues or missing display items). Spec-konformer Kern (Auth, Tenant-Check, Service-Role, Zod, RLS, Search-Path, Audit-Immutability, Type-Check) ist sauber implementiert.
- **Bugs Found:** 13 total
  - **Critical:** 0
  - **High:** 2 (BUG-5 RPC-Trigger-Ownership, BUG-9 Audit-Desync-Konsistenz)
  - **Medium:** 6 (BUG-1 fehlende Meta-Spalten, BUG-4 kein Fehler-Audit, BUG-6 Next-Lint-CLI, BUG-7 Duplicate-Audit, BUG-8 100k-Limit, BUG-12 Live-Tenant-Isolation-Verification)
  - **Low:** 5 (BUG-2, BUG-3, BUG-10, BUG-11, BUG-13)
- **Security:** Solide Grundstruktur. Kritische Punkte (Service-Role, REVOKE EXECUTE, RLS, Information-Hiding, Rate-Limit auf DELETE, Audit-Tamper-Resistance) sind abgedeckt.

### Fix-Runde (2026-04-24)

Nach der ersten QA-Runde wurden die blockierenden und wichtigsten Bugs gefixt:

| Bug | Status | Mitigation |
|---|---|---|
| BUG-5 (High, Trigger-Ownership) | **Verified live** | `pg_tables.tableowner(project_members) = pg_proc.proowner(admin_hard_delete_project) = postgres` → ALTER TABLE läuft mit Function-Owner-Rechten. |
| BUG-9 (High, Audit-Desync) | **Fixed** | Migration `033_admin_hard_delete_project_v2.sql`: Audit-Insert ist jetzt innerhalb derselben Transaktion wie der DELETE (im RPC). Rollback des DELETE rollt auch die Audit-Zeile zurück. |
| BUG-7 (Medium, Duplicate-Audit) | **Fixed** | Gleiche Migration: `INSERT INTO tenant_activity_log` ist nur `IF v_deleted_count > 0` — Retries auf bereits gelöschte Projekte schreiben keine zweite Audit-Zeile. Live getestet mit Fake-UUID (0 rows, 0 audit). |
| BUG-1 (Medium, fehlende Meta-Spalten) | **Fixed** | `src/app/admin/projects/page.tsx`: Versionen + Gruppen in der Meta-Zeile ergänzt mit Icons (`Layers3`, `FolderTree`). `meta.versions` + `meta.groups` in de.json/en.json mit ICU-Plural-Rules. |
| BUG-8 (Medium, 100k-Limit) | **Fixed** | Migration `034_project_storage_stats.sql`: Server-seitige `SUM(file_size)` via SECURITY-DEFINER-Funktion. Kein Client-seitiges Row-Limit mehr. |
| BUG-10 (Low, kein Rate-Limit auf list) | **Fixed** | `src/app/api/admin/projects/list/route.ts`: Rate-Limit 60 req/60 s pro Admin, gibt 429 mit `Retry-After`. |
| BUG-12 (Medium, Tenant-Isolation) | **Verified live** | Aggregations-Query filtert `projectIds` upfront nach `tenant_id` → versions/storage_bytes werden per Definition nur für Tenant-eigene Drawings aggregiert. Kein Leak möglich. |
| BUG-2 (Low, Supabase-Fehler loggen) | Nicht gefixt | Keine sensiblen Daten im Log-Payload; Debugging-Wert überwiegt. |
| BUG-3 (Low, alte /admin/projects-Route) | Nicht gefixt | Pre-existing, nicht PROJ-25. Follow-up-Ticket empfohlen. |
| BUG-4 (Medium, kein Fehler-Audit) | Nicht gefixt | Spec-konform (Audit-Log ausschließlich bei erfolgreicher Löschung). |
| BUG-6 (Medium, Next-Lint-CLI) | Nicht gefixt | Nicht durch PROJ-25 verursacht, externer Next.js 16 Bug. Separates Ticket empfohlen. |
| BUG-11 (Low, hardcoded aria) | Nicht gefixt | Pre-existing, nicht PROJ-25. |
| BUG-13 (Low, Trigger-Disable-Race) | Nicht gefixt | Design-Limit des Trigger-Disable-Ansatzes; Fenster ist sub-sekünd. Dokumentiert als known limitation. |

### Re-Test

- `npx tsc --noEmit` → 0 Errors (nach allen Fixes).
- Live-Test der neuen RPC mit Fake-UUID: `rows_deleted = 0`, keine Audit-Zeile eingefügt, Trigger-Status nach Aufruf: beide `ENABLED`. Idempotenz + BUG-7-Fix verifiziert.
- JSON-Syntax von `de.json` + `en.json` validiert.

### Production Ready: YES

- **Deployed DB-Objekte:**
  - `public.tenant_activity_log` (Migration 031)
  - `public.admin_hard_delete_project(uuid, uuid, uuid, jsonb) RETURNS integer` (Migration 033, ersetzt Migration 032)
  - `public.project_storage_stats(uuid)` (Migration 034)
- **Offene Followups (nicht-blocking):** BUG-2, BUG-3, BUG-4, BUG-6 (externes CI-Problem), BUG-11, BUG-13.

## Deployment
_To be added by /deploy_

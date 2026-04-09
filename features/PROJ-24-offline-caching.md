# PROJ-24: Offline-First Caching & Synchronisation

## Status: In Review
**Created:** 2026-04-09
**Last Updated:** 2026-04-09

## Dependencies
- Requires: PROJ-21 (PWA & Android-Installation) — bestehender Service Worker
- Requires: PROJ-1 (User Authentication) — Auth-Token für Supabase-Zugriff
- Requires: PROJ-2 (Projektverwaltung) — Projektdaten zum Cachen
- Requires: PROJ-3 (PDF Upload & Viewer) — PDF-Dateien zum Cachen

## Übersicht
Ein Offline-First-System, das Ladezeiten drastisch verbessert und Offline-Lesezugriff auf Projekte ermöglicht. Daten werden lokal in IndexedDB und der Cache API zwischengespeichert und im Hintergrund mit Supabase synchronisiert ("Stale-While-Revalidate"). Nutzer können gezielt einzelne Projekte für den Offline-Zugriff herunterladen.

**Phase 1 (dieses Feature):** Nur Offline-Lesen (Pläne ansehen, navigieren, Marker sehen).
Offline-Editing (Marker erstellen/bearbeiten) ist explizit **nicht** Teil dieses Features.

## User Stories

### US-1: Schnelleres Laden durch lokalen Cache
Als Techniker möchte ich, dass Projekte und Zeichnungen sofort aus dem lokalen Cache geladen werden, damit ich nicht bei jedem Seitenaufruf auf die Server-Antwort warten muss.

### US-2: Sync-Status erkennen
Als Nutzer möchte ich jederzeit sehen, wann die Daten zuletzt aktualisiert wurden, ob gerade synchronisiert wird, oder ob ich offline bin — damit ich weiß, ob ich den aktuellen Stand sehe.

### US-3: Offline-Zugriff auf geöffnete Inhalte
Als Planer möchte ich, dass Projekte und PDFs, die ich bereits geöffnet habe, auch ohne Internetverbindung verfügbar sind, damit ich auf der Baustelle weiterarbeiten kann.

### US-4: Projekt gezielt offline verfügbar machen
Als Projektleiter möchte ich ein komplettes Projekt herunterladen können ("Projekt synchronisieren"), damit alle PDFs und Daten offline verfügbar sind — z.B. vor einem Baustellenbesuch.

### US-5: Speicherverbrauch verstehen
Als Nutzer möchte ich sehen, wie viel lokaler Speicher von gecachten Projekten belegt wird, damit ich bei Bedarf Platz freimachen kann.

## Acceptance Criteria

### Caching-Grundlage
- [ ] Alle Supabase-Abfragen (Projekte, Zeichnungen, Versionen, Marker, Gruppen) werden lokal in IndexedDB zwischengespeichert
- [ ] Beim Laden einer Seite werden Daten sofort aus IndexedDB angezeigt (kein Ladeindikator für gecachte Daten)
- [ ] Im Hintergrund wird Supabase nach aktuellen Daten gefragt; bei Änderungen wird die UI aktualisiert
- [ ] PDFs werden beim ersten Öffnen automatisch in der Cache API gespeichert
- [ ] Ein gecachtes PDF wird beim nächsten Aufruf direkt aus dem Cache geladen

### Sync-Status UI
- [ ] Im App-Header (oder Footer auf Mobile) wird ein Sync-Status-Badge angezeigt
- [ ] Badge zeigt einen von 4 Zuständen:
  - "Aktualisiert" (grün) — Daten sind aktuell, letzte Sync < 1 Min
  - "Aktualisiert vor X Min/Std" (neutral) — Daten aus Cache, Zeit seit letzter Sync
  - "Wird aktualisiert..." (blau, mit Spinner) — Sync läuft gerade
  - "Offline" (orange) — keine Verbindung, zeigt letzte Sync-Zeit
- [ ] Badge ist klickbar und zeigt Detail-Popup mit: letzter Sync-Zeitpunkt, Online/Offline-Status, Cache-Größe
- [ ] Sync-Status ist mehrsprachig (DE/EN, via bestehendes i18n-System PROJ-12)

### Projekt synchronisieren
- [ ] Auf der Projektdetailseite gibt es einen "Projekt synchronisieren" Button
- [ ] Vor dem Download wird die geschätzte Größe angezeigt (Summe aller aktiven PDF-Versionen)
- [ ] Beim Klick werden alle Daten (Zeichnungen, Versionen, Marker, Gruppen) + alle aktiven PDF-Versionen heruntergeladen
- [ ] Fortschrittsanzeige: "3/12 PDFs heruntergeladen..." mit Prozentbalken
- [ ] Nach Abschluss: Bestätigung mit Gesamtgröße
- [ ] Sync kann abgebrochen werden
- [ ] Bereits gecachte PDFs werden nicht erneut heruntergeladen

### Sync-Indikator pro Projekt
- [ ] In der Projektliste zeigt ein Icon an, ob ein Projekt vollständig gecacht ist (alle PDFs offline verfügbar)
- [ ] Teilweise gecachte Projekte zeigen einen anderen Indikator (z.B. "3/12 offline")
- [ ] Nicht gecachte Projekte zeigen keinen Indikator

### Cache-Verwaltung
- [ ] In den Einstellungen (oder Sync-Detail-Popup) kann der Nutzer sehen, wie viel Speicher belegt ist
- [ ] Einzelne Projekte können aus dem Cache entfernt werden ("Offline-Daten löschen")
- [ ] "Alle Offline-Daten löschen" Option verfügbar

### Offline-Verhalten
- [ ] Bei Offline-Zugriff auf gecachte Inhalte: normale Darstellung, kein Fehler
- [ ] Bei Offline-Zugriff auf nicht-gecachte Inhalte: freundliche Meldung "Nicht offline verfügbar"
- [ ] Schreibaktionen (Marker erstellen, Upload, etc.) zeigen offline eine Meldung: "Nicht verfügbar — bitte verbinde dich mit dem Internet"
- [ ] Wenn Verbindung zurückkehrt: automatischer Sync im Hintergrund

## Edge Cases

### Speicher-Limits
- Was passiert, wenn der Browser-Speicher voll ist? → Freundliche Meldung mit Hinweis, alte Projekte aus dem Cache zu entfernen
- Was passiert bei sehr großen Projekten (>500MB)? → Warnung vor dem Download, Größe anzeigen
- Was passiert, wenn der Nutzer im privaten/Inkognito-Modus ist? → Cache funktioniert nur für die Sitzung, Hinweis anzeigen

### Datenaktualität
- Was passiert, wenn ein anderer Nutzer Daten ändert, während ich offline bin? → Beim nächsten Sync werden alle Änderungen übernommen
- Was passiert, wenn eine Zeichnung archiviert wird, die ich offline habe? → Beim Sync wird der archivierte Status angezeigt
- Was passiert, wenn eine neue PDF-Version hochgeladen wird? → Beim Sync wird die neue Version geladen, alte bleibt bis zum Cache-Cleanup

### Netzwerk
- Was passiert bei instabilem Netzwerk (ständiger Wechsel online/offline)? → Debounced Sync, kein Flackern im Status-Badge
- Was passiert, wenn der Sync mitten im Download abbricht? → Teilweise heruntergeladene PDFs werden verworfen, nächster Versuch lädt nur fehlende

### Auth
- Was passiert, wenn der Auth-Token abläuft, während ich offline bin? → Gecachte Daten bleiben lesbar, Sync startet nach Re-Login
- Was passiert bei Tenant-Wechsel? → Cache wird pro Tenant getrennt gehalten

## Technical Requirements
- **Performance:** Erstladen aus Cache < 100ms (Metadaten), PDF aus Cache < 500ms
- **Speicher:** Cache-Größe pro Projekt sichtbar, Gesamtlimit konfigurierbar
- **Browser Support:** Chrome, Edge, Firefox, Safari (IndexedDB + Cache API)
- **Library:** `idb` (~1KB) für typsicheren IndexedDB-Zugriff
- **Service Worker:** Bestehenden SW (PROJ-21) erweitern für PDF-Cache-Strategie
- **Sicherheit:** Cached Daten sind an den authentifizierten Nutzer gebunden, kein Cross-Tenant-Zugriff

## Out of Scope
- Offline-Editing (Marker erstellen/verschieben offline) — Phase 2
- Konflikt-Resolution bei gleichzeitigen Änderungen — Phase 2
- Selective Sync (nur bestimmte Zeichnungen eines Projekts) — Phase 2
- Push-basierte Echtzeit-Sync (Supabase Realtime) — separates Feature

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Übersicht
Das System besteht aus 4 Schichten: **IndexedDB** für strukturierte Daten, **Cache API** für PDF-Dateien, ein **Sync-Engine** als zentrale Steuerung, und **UI-Komponenten** für Status-Anzeige und Verwaltung.

### A) Komponenten-Struktur

```
App (bestehend)
├── SyncProvider (neuer React Context — wraps alle geschützten Seiten)
│   ├── Online/Offline-Detection (navigator.onLine + Events)
│   ├── Background-Sync-Timer (prüft alle 60s auf Änderungen)
│   └── Sync-State (lastSynced, isSyncing, isOnline, error)
│
├── Dashboard Page (bestehend)
│   ├── SyncStatusBadge (NEU — im Header neben LanguageSwitcher)
│   │   └── SyncDetailPopover (klickbar — Details + Cache-Verwaltung)
│   │       ├── Letzter Sync-Zeitpunkt
│   │       ├── Online/Offline-Status
│   │       ├── Gesamt-Cache-Größe
│   │       └── "Alle Offline-Daten löschen" Button
│   │
│   └── Projektliste (bestehend)
│       └── ProjectCard (bestehend, erweitert)
│           └── OfflineIndicator (NEU — Icon zeigt Cache-Status)
│
├── Projektdetail-Seite (bestehend)
│   └── ProjectSyncButton (NEU — "Projekt synchronisieren")
│       └── SyncProgressDialog (Fortschrittsanzeige beim Download)
│
└── PDF-Viewer (bestehend)
    └── Nutzt automatisch gecachte PDFs wenn verfügbar
```

### B) Datenmodell

**IndexedDB-Datenbank: "link2plan-cache"**

Jede Tabelle (Store) speichert die gleichen Daten wie Supabase, ergänzt um Sync-Metadaten:

```
Store: "projects"
  Jeder Eintrag hat:
  - Alle Felder aus der Supabase-Tabelle (id, name, description, etc.)
  - _syncedAt: Zeitstempel der letzten Synchronisation
  - _tenantId: Tenant-ID (für Datentrennung)
  Schlüssel: id

Store: "drawings"
  Jeder Eintrag hat:
  - Alle Felder aus der Supabase-Tabelle
  - _syncedAt, _tenantId
  Schlüssel: id

Store: "versions"
  Jeder Eintrag hat:
  - Alle Felder aus der Supabase-Tabelle
  - _syncedAt, _tenantId
  - _pdfCached: boolean (ob die PDF-Datei im Cache liegt)
  Schlüssel: id

Store: "markers"
  Jeder Eintrag hat:
  - Alle Felder aus der Supabase-Tabelle
  - _syncedAt, _tenantId
  Schlüssel: id

Store: "drawing_groups"
  Jeder Eintrag hat:
  - Alle Felder aus der Supabase-Tabelle
  - _syncedAt, _tenantId
  Schlüssel: id

Store: "sync_meta"
  Speichert pro Tabelle/Query:
  - key: eindeutiger Cache-Schlüssel (z.B. "projects:list" oder "drawings:project-123")
  - lastSynced: Zeitstempel
  - tenantId: Tenant-ID
  Schlüssel: key
```

**PDF-Dateien in Cache API:**
```
Cache Name: "link2plan-pdfs"
  Schlüssel: Supabase-Storage-URL (ohne Query-Parameter/Token)
  Wert: PDF-Response (Blob)
  Wird beim ersten Öffnen einer Zeichnung automatisch gespeichert
```

### C) Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Daten-Cache | IndexedDB (via `idb` Library) | Strukturierte Abfragen möglich, unterstützt alle Browser, keine Größenbegrenzung wie localStorage (5MB) |
| PDF-Cache | Cache API | Ideal für große Binärdateien, vom Service Worker nutzbar, automatische Verwaltung |
| Sync-Strategie | Stale-While-Revalidate | Sofortiges Laden aus Cache (UX), Hintergrund-Update für Aktualität — bester Kompromiss |
| State Management | React Context (SyncProvider) | Konsistent mit bestehendem App-Pattern, kein zusätzliches Framework nötig |
| Hook-Pattern | `useCachedQuery` als Wrapper | Minimale Änderung an bestehenden Hooks — nur Datenquelle wird umgeleitet, API bleibt gleich |
| Offline-Detection | navigator.onLine + online/offline Events | Native Browser-API, kein Polling nötig, zuverlässig genug für Phase 1 |
| Tenant-Trennung | _tenantId Feld in jedem Cache-Eintrag | Verhindert Cross-Tenant-Datenlecks bei Kontowechsel |

### D) Abhängigkeiten (zu installierende Packages)

| Package | Zweck | Größe |
|---|---|---|
| `idb` | Typsicherer, Promise-basierter IndexedDB-Wrapper | ~1 KB (gzipped) |

Keine weiteren Packages nötig — Cache API, Service Worker und online/offline Events sind native Browser-APIs.

### E) Datenfluss: Stale-While-Revalidate

```
Nutzer öffnet Seite
  │
  ├─→ 1. Sofort: Daten aus IndexedDB laden → UI anzeigen (< 100ms)
  │
  ├─→ 2. Parallel: Ist online?
  │     ├─ JA → Supabase abfragen → Antwort mit Cache vergleichen
  │     │    ├─ Gleich → nichts tun
  │     │    └─ Geändert → IndexedDB updaten → UI aktualisieren
  │     │
  │     └─ NEIN → Cache-Daten behalten, Sync-Badge auf "Offline" setzen
  │
  └─→ 3. lastSynced-Zeitstempel in sync_meta aktualisieren
```

### F) Datenfluss: Projekt synchronisieren

```
Nutzer klickt "Projekt synchronisieren"
  │
  ├─→ 1. Alle Zeichnungen + Versionen + Marker + Gruppen des Projekts laden
  │     → In IndexedDB speichern
  │
  ├─→ 2. Alle aktiven PDF-Versionen identifizieren
  │     → Bereits gecachte überspringen
  │     → Fehlende PDFs herunterladen → In Cache API speichern
  │     → Fortschritt anzeigen: "3/12 PDFs..."
  │
  └─→ 3. _pdfCached Flags in versions-Store aktualisieren
        → Offline-Indikator auf Projekt aktualisieren
```

### G) Bestehende Hooks — Migrationsstrategie

Die bestehenden Hooks (`useProjects`, `useDrawings`, `useMarkers`, `useVersions`, `useDrawingGroups`) werden **nicht ersetzt**, sondern intern erweitert:

```
Vorher: Hook → fetch() → Supabase → setState
Nachher: Hook → useCachedQuery() → IndexedDB (sofort) + fetch() (Hintergrund) → setState
```

Jeder Hook behält seine bestehende API (return-Werte). Nur die interne Datenquelle ändert sich. Das bedeutet:
- Keine Änderung an Komponenten nötig, die diese Hooks nutzen
- Schrittweise Migration möglich (Hook für Hook)
- Fallback auf direkten fetch() wenn IndexedDB nicht verfügbar

### H) Service Worker — Erweiterung

Der bestehende Service Worker (`public/sw.js`) wird erweitert um:
- PDF-Requests erkennen (Supabase Storage URLs)
- Cache-First-Strategie für PDFs: erst im Cache suchen, dann Netzwerk
- Bei Netzwerk-Antwort: automatisch in "link2plan-pdfs" Cache speichern

### I) Neue Dateien

```
src/
  lib/
    offline/
      db.ts              — IndexedDB Schema-Definition und Zugriffsfunktionen
      sync-engine.ts     — Stale-While-Revalidate Logik, Background-Sync
      pdf-cache.ts       — Cache API Wrapper für PDF-Dateien
  hooks/
    use-cached-query.ts  — Generischer Hook: Cache-First + Background-Revalidate
    use-sync-status.ts   — Hook für Sync-Status (online, syncing, lastSynced)
    use-project-sync.ts  — Hook für "Projekt synchronisieren" (Download + Fortschritt)
  components/
    sync/
      SyncProvider.tsx       — React Context Provider für Sync-State
      SyncStatusBadge.tsx    — Badge im Header
      SyncDetailPopover.tsx  — Klickbares Detail-Popup
      OfflineIndicator.tsx   — Icon auf ProjectCard
      ProjectSyncButton.tsx  — "Projekt synchronisieren" Button
      SyncProgressDialog.tsx — Fortschrittsanzeige
```

### J) Bestehende Dateien — Änderungen

| Datei | Änderung |
|---|---|
| `src/hooks/use-projects.ts` | fetchProjects() nutzt intern useCachedQuery |
| `src/hooks/use-drawings.ts` | fetchDrawings() nutzt intern useCachedQuery |
| `src/hooks/use-markers.ts` | fetchMarkers() nutzt intern useCachedQuery |
| `src/hooks/use-versions.ts` | fetchVersions() nutzt intern useCachedQuery |
| `src/hooks/use-drawing-groups.ts` | fetchGroups() nutzt intern useCachedQuery |
| `src/app/(protected)/layout.tsx` | SyncProvider wrappen |
| `src/app/(protected)/dashboard/page.tsx` | SyncStatusBadge im Header einfügen |
| `src/components/projects/ProjectCard.tsx` | OfflineIndicator ergänzen |
| `src/app/(protected)/dashboard/projects/[id]/page.tsx` | ProjectSyncButton ergänzen |
| `public/sw.js` | PDF-Cache-Strategie hinzufügen |
| `messages/de.json` + `messages/en.json` | Sync-bezogene Übersetzungen |

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

# PROJ-29: Download-Menü (aktuell / inkl. Versionen / alle / alle inkl. Versionen)

## Status: In Review
**Created:** 2026-06-04
**Last Updated:** 2026-06-04

> Implementiert auf Branch `feature/PROJ-27-33-drawings-erweiterungen`.
> Neue Dependency `client-zip`. Automatisierte Prüfungen grün: `tsc`, ESLint,
> `npm run build`, 38/38 Tests. Manuelle Browser-Prüfung + PR-Review ausstehend.

## Beschreibung
Im Zeichnungsbereich soll ein Download-Button ein Menü mit vier Optionen öffnen:
(1) aktuelle Zeichnung, (2) aktuelle Zeichnung inkl. aller Versionen, (3) alle aktuellen
Zeichnungen des Projekts, (4) alle Zeichnungen inkl. aller Versionen. Einzeldatei lädt direkt
als PDF; Mehrfach-Download wird als ZIP zusammengefasst.

## Dependencies
- Requires: PROJ-3 (Viewer), PROJ-7 (Versionierung), PROJ-8 (Gruppen)
- Requires: PROJ-28 — teilt den `fetchPdfBlob`-Helper
- Bezug: PROJ-20 — reine Lese-Aktion (auch Read-only)

## User Stories
- Als **Planer** möchte ich die aktuelle Zeichnung als PDF herunterladen, um sie
  weiterzugeben.
- Als **Techniker** möchte ich den kompletten aktuellen Planstand eines Projekts als ZIP
  herunterladen, um offline ein Archiv zu haben.
- Als **Projektverantwortlicher** möchte ich alle Zeichnungen inkl. aller Versionen sichern.

## Acceptance Criteria
- [ ] Download-Button (DropdownMenu) in der Viewer-Toolbar (Desktop, Mobile, FloatingToolbar).
- [ ] Einzeldatei: signierte URL mit `?download=<name>` (Content-Disposition: attachment).
- [ ] Mehrfach-Download als ZIP mit Ordnerstruktur
      `<Projekt>/<Gruppe|Ohne Gruppe>/<Zeichnung>[/<Zeichnung>_v<n>_<label>.pdf]`.
- [ ] Dateinamen werden sanitisiert (Slashes/Steuerzeichen/Windows-reserviert) + Dedupe.
- [ ] Zugriffsprüfung serverseitig via `requireProjectAccess`; Pfade ausschließlich aus
      `drawing_versions.storage_path`; keine ungeprüfte Pfadliste vom Client.
- [ ] Lade-/Fortschrittszustand; Teilfehler (404/abgelaufen) killt nicht das ganze ZIP.
- [ ] Reine Lese-Aktion (für alle Rollen mit Lesezugriff).

## Edge Cases
- „Alle inkl. Versionen" = potenziell hunderte PDFs → Warnung/Mobile-Hinweis, Blob-Fallback
  wenn `showSaveFilePicker` fehlt (Firefox/Safari).
- Einzelne abgelaufene/fehlende Datei → überspringen + Hinweis, ZIP bleibt gültig.
- Cross-origin `download`-Attribut greift nicht → `?download=`-Parameter.

## Tech Design
- Neuer projekt-scoped Batch-Sign-Endpunkt `POST .../downloads/sign`: nimmt Scope
  `aktuell | aktuell+versionen | alle | alle+versionen`, löst serverseitig die
  `drawing_versions` auf, validiert via `requireProjectAccess`, signiert gebatcht
  (`createSignedUrls`), gibt `{ path, signedUrl, zipEntryName }` zurück.
- Client zippt mit neuer Dependency **client-zip** (~2.6 kB, streaming, Store-Modus).
  Byte-Transfer Browser↔Storage → schont Supabase-Free-IO und Vercel-Compute.

## Decisions
- client-zip (clientseitig) bestätigt.
- Obergrenze/Warnschwelle: weiche Warnung bei großen Sets, kein hartes Limit.

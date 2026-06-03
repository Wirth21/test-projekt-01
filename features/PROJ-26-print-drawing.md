# PROJ-26: Zeichnung drucken

## Status: Planned
**Created:** 2026-06-03
**Last Updated:** 2026-06-03

## Beschreibung
Nutzer sollen aus der Zeichnungsansicht heraus die aktuell angezeigte Zeichnung (das
zugrunde liegende PDF) drucken können — über den nativen Druckdialog des Browsers/Geräts.
Gedruckt wird das **Original-PDF aller Seiten ohne Marker-Overlays**. Der Nutzer kann im
System-Druckdialog selbst Seitenbereich, Drucker und Papierformat wählen.

## Dependencies
- Requires: PROJ-3 (PDF Upload & Viewer) — liefert die Zeichnungsansicht und den PDF-Abruf
- Requires: PROJ-7 (PDF-Versionierung) — gedruckt wird immer die aktuell angezeigte/aktive Version
- Bezug: PROJ-20 (Rollen: Viewer & Guest) — Drucken ist für alle Rollen mit Lesezugriff erlaubt

## User Stories
- Als **Techniker** möchte ich die geöffnete Zeichnung mit einem Klick drucken, damit ich
  einen Papierplan mit auf die Baustelle nehmen kann.
- Als **Planer** möchte ich beim Drucken den Seitenbereich eines mehrseitigen PDFs selbst
  wählen, damit ich nur die relevante Seite auf Papier bringe.
- Als **Gast/Viewer** (nur Lesezugriff) möchte ich eine Zeichnung drucken können, ohne sie
  bearbeiten zu dürfen, damit ich sie offline weiterverwenden kann.
- Als **Nutzer** möchte ich, dass der Ausdruck das saubere Original-PDF zeigt (ohne
  Marker-Pins), damit der Plan unverfälscht zum Weitergeben ist.
- Als **Nutzer** möchte ich beim Drucken die korrekt benannte Datei wiedererkennen
  (Zeichnungsname), damit ich Ausdrucke zuordnen kann.

## Acceptance Criteria
- [ ] In der Zeichnungsansicht gibt es eine klar erkennbare Druck-Aktion (Drucker-Icon in
      der `FloatingToolbar` des Viewers, mit Tooltip „Drucken").
- [ ] Ein Klick darauf öffnet den nativen Druckdialog des Browsers/Geräts mit dem
      Original-PDF der aktuell angezeigten Version.
- [ ] Bei mehrseitigen PDFs enthält der Druckdialog alle Seiten; der Nutzer kann dort den
      Seitenbereich einschränken.
- [ ] Der Ausdruck zeigt **keine** Marker-Pins/Overlays — nur das Original-PDF.
- [ ] Die Druck-Aktion ist für **alle Rollen mit Lesezugriff** verfügbar (inkl. Viewer und
      Guest); sie ist **nicht** an den Bearbeitungsmodus geknüpft.
- [ ] Während das PDF für den Druck vorbereitet wird, ist ein Lade-/Deaktiviert-Zustand
      sichtbar (kein doppeltes Auslösen, keine eingefrorene UI).
- [ ] Schlägt die Vorbereitung fehl (z. B. PDF nicht abrufbar), erscheint eine verständliche
      Fehlermeldung (Toast) statt eines leeren Druckdialogs.
- [ ] Funktioniert auf Desktop (Chrome, Firefox, Safari, Edge) und mobil (Android-Chrome,
      iOS-Safari) — ggf. mit gerätetypischem „Teilen/Drucken"-Verhalten.
- [ ] Das Auslösen des Drucks erzeugt keine Änderung am Datenbestand (reiner Lesevorgang).

## Edge Cases
- **Mehrseitiges PDF:** Es wird das gesamte Dokument an den Druckdialog übergeben; Seitenwahl
  trifft der Nutzer im System-Dialog. (Kein eigener Seitenwähler in der App.)
- **Signierte URL abgelaufen:** Die Viewer-PDF-URL ist zeitlich begrenzt. Vor dem Druck muss
  sichergestellt sein, dass eine gültige Quelle verwendet wird; sonst klare Fehlermeldung.
- **Offline (PWA):** Ist die Zeichnung im Offline-Cache vorhanden, soll Drucken möglich sein;
  ist sie es nicht und es besteht keine Verbindung, klare Meldung „offline nicht verfügbar".
- **Pop-up-/Druckfenster blockiert:** Wird ein separates Druckfenster vom Browser blockiert,
  bekommt der Nutzer einen Hinweis, wie er fortfährt.
- **Sehr großes PDF:** Große Dateien können beim Vorbereiten kurz dauern → Ladezustand; keine
  Mehrfach-Auslösung durch wiederholtes Klicken.
- **Mobiler Druck:** Auf Mobilgeräten kann statt eines klassischen Druckdialogs das native
  „Teilen/Drucken"-Sheet erscheinen — das ist akzeptabel und gilt als erfüllt.
- **Archivierte Zeichnung / nur-Lese-Projekt:** Drucken bleibt erlaubt, solange der Nutzer die
  Zeichnung sehen darf.

## Technical Requirements (optional)
- **Security:** Authentifizierung erforderlich; es darf nur gedruckt werden, was der Nutzer
  ohnehin lesen darf (gleiche Zugriffsprüfung wie beim Anzeigen der Zeichnung). Keine neuen
  öffentlichen Endpunkte.
- **Scope:** Es wird das gespeicherte Original-PDF gedruckt, kein client-seitig neu
  gerendertes Bild — dadurch volle Auflösung/Vektorqualität und keine Marker.
- **Performance:** Druckvorbereitung idealerweise < 1–2 s bei normalen Plangrößen; sichtbarer
  Ladezustand bei größeren Dateien.
- **Browser-Support:** Chrome, Firefox, Safari, Edge (Desktop) + Android-Chrome, iOS-Safari.
- **Keine Schema-Änderung:** Reines Lese-/Frontend-Feature; keine neue Tabelle/Migration nötig.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

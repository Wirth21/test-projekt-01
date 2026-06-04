# PROJ-32: Drag&Drop — PDF auf Zeichnung → neue Version

## Status: In Progress
**Created:** 2026-06-04
**Last Updated:** 2026-06-04

## Beschreibung
In der Übersicht soll man ein PDF aus dem Dateisystem direkt auf eine bestehende Zeichnung
ziehen können. Das PDF wird als neue Version oben auf den Stapel der Zeichnung gelegt.

## Dependencies
- Requires: PROJ-3, PROJ-7 (Versionierung), PROJ-8 (Gruppen)
- Bezug: PROJ-30 (Status/Datum) — optionaler Status-/Datum-Dialog nach dem Drop

## User Stories
- Als **Planer** möchte ich eine aktualisierte PDF einfach auf die zugehörige Zeichnung
  ziehen, damit daraus ohne Umwege eine neue Version wird.

## Acceptance Criteria
- [ ] Eine `DrawingCard` ist Drop-Target für PDF-Dateien; beim Drüberziehen visuelles
      Highlight.
- [ ] Drop einer PDF löst den bestehenden `uploadVersion`-Flow für genau diese Zeichnung aus
      (neue `version_number = max+1`, Marker werden serverseitig kopiert, Status geerbt bzw.
      via Dialog gesetzt).
- [ ] Nicht-PDF-Dateien werden abgelehnt (klare Meldung).
- [ ] Nur für `canEdit`-Nutzer aktiv (Schreib-Aktion); Read-only zeigt kein Drop-Verhalten.
- [ ] Erfolg/Fehler als Toast; Liste aktualisiert sich.

## Edge Cases
- Mehrere PDFs gleichzeitig auf eine Card → definiertes Verhalten (erste Datei als neue
  Version; Rest ignorieren oder als Folgeversionen — siehe Decisions).
- Versehentliches Droppen → optionale Bestätigung/Status-Dialog.
- Marker-Kopie läuft serverseitig automatisch.

## Tech Design
- `DrawingCard.tsx`: `onDragOver` / `onDragLeave` / `onDrop` analog `PdfUploadZone`; lokaler
  `dragOver`-State fürs Highlight. Native HTML5-DnD, keine zusätzliche Library.
- `use-versions` ist heute an einen festen `drawingId` gebunden → schlanke
  `uploadVersion`-Variante mit `drawingId`-Argument (in `use-drawings` oder als
  parametrisierte Funktion), damit pro Card hochgeladen werden kann.

## Decisions
- Nach dem Drop: kurzer Bestätigungs-/Status-Datum-Dialog (nutzt PROJ-30-Komponente), damit
  kein versehentlicher Upload passiert.
- Mehrere PDFs auf eine Card: nur die erste Datei wird als neue Version übernommen.
- Drop erzeugt ausschließlich eine neue Version derselben Zeichnung (kein Gruppen-Verschieben).

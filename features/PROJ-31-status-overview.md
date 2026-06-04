# PROJ-31: Stand-Übersicht (Liste mit Datum + Status, aufklappbare Historie)

## Status: In Progress
**Created:** 2026-06-04
**Last Updated:** 2026-06-04

## Beschreibung
Eine Übersicht, die den Stand der Zeichnungen als Liste darstellt — pro Zeichnung Name,
Datum und Status. Die Versionshistorie ist pro Zeile auf- und zuklappbar.

## Dependencies
- Requires: PROJ-3, PROJ-7, PROJ-19 (Status pro Version), PROJ-8 (Gruppen)
- Bezug: PROJ-27 (Gruppen-Sort), PROJ-30 (Datums-/Status-Modell)

## User Stories
- Als **Projektverantwortlicher** möchte ich auf einen Blick den Stand (Datum + Status) aller
  Zeichnungen sehen, ohne jede einzeln zu öffnen.
- Als **Planer** möchte ich die Versionshistorie einer Zeichnung bei Bedarf aufklappen, um
  die Entwicklung nachzuvollziehen.

## Acceptance Criteria
- [ ] Umschaltung zwischen Karten-Ansicht (bestehend) und Listen-/Stand-Ansicht (neu) im
      „Aktiv"-Bereich; die Grid-Ansicht bleibt unverändert erhalten.
- [ ] Listen-Ansicht zeigt pro Zeichnung: Name, Datum (`created_at` der aktiven Version),
      Status-Pille.
- [ ] Gruppierung pro Gruppe; Gruppen alphabetisch (teilt Sort-Logik mit PROJ-27).
- [ ] Versionshistorie pro Zeile via Accordion auf-/zuklappbar; Versionen werden **lazy**
      beim Aufklappen geladen (Free-Plan-IO schonen), gecached (React Query, staleTime ≥ 5min,
      `refetchOnWindowFocus: false`).
- [ ] Historie zeigt Versionsnummer, Label, Datum und Status.

## Edge Cases
- Massenhaftes Aufklappen → nur on-demand laden, cachen.
- Zeichnung ohne aktive Version → leerer/neutraler Zustand.

## Tech Design
- Vorhandene shadcn-Bausteine: `table` + `accordion` (bislang ungenutzt).
- Neue Schwester-Komponente `DrawingStatusTable.tsx` mit denselben Props wie
  `GroupedDrawingList` (drawings, groups, statuses, onStatusChange).
- Neuer Hook `useDrawingVersions(projectId, drawingId)` (lazy), gespeist vom bestehenden
  GET `.../versions`.

## Decisions
- Grid↔Tabelle-Toggle innerhalb des „Aktiv"-Tabs (kein dritter Tab).
- Status-Pille in der Stand-Liste editierbar (`onStatusChange`).
- Historie zeigt standardmäßig nur aktive Versionen (Archiv-Schalter wie im SidePanel optional).

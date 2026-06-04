# PROJ-27: Gruppen alphabetisch sortieren

## Status: In Progress
**Created:** 2026-06-04
**Last Updated:** 2026-06-04

## Beschreibung
Zeichnungsgruppen in der Projektübersicht sollen alphabetisch nach Name sortiert
werden statt nach Erstelldatum. Innerhalb einer Gruppe sind die Zeichnungen bereits
alphabetisch sortiert — diese Logik wird auf die Gruppen-Ebene übertragen.

## Dependencies
- Requires: PROJ-8 (Zeichnungsgruppen) — liefert die Gruppen-Struktur

## User Stories
- Als **Planer** möchte ich Gruppen in alphabetischer Reihenfolge sehen, damit ich
  eine bestimmte Gruppe schnell finde, ohne mich an die Anlegereihenfolge zu erinnern.

## Acceptance Criteria
- [ ] Gruppen werden in der aktiven Projektübersicht alphabetisch (locale "de",
      `sensitivity: base`, natürliche Zahlen-Sortierung `numeric: true`) sortiert.
- [ ] „Ohne Gruppe" bleibt wie bisher immer am Ende der Liste.
- [ ] Numerische Präfixe sortieren natürlich (z. B. „2 Plan" vor „10 Plan").
- [ ] Keine Regression an der bestehenden Zeichnungs-Sortierung innerhalb der Gruppen.

## Edge Cases
- Gruppen mit identischem Namen: stabile, deterministische Reihenfolge (Tie-Break
  über `created_at`).
- Umlaute/Akzente werden über die Locale-Collation korrekt einsortiert.

## Tech Design
- Frontend ist maßgeblich: `activeGroups`-Sort in
  [GroupedDrawingList.tsx](../src/components/drawings/GroupedDrawingList.tsx) von
  `created_at` auf `name.localeCompare(..., { numeric: true, sensitivity: "base" })`.
- Optional begleitend `groups/route.ts` `.order('created_at')` → `.order('name')`.
- Keine `sort_order`-Spalte auf `drawing_groups` vorhanden → keine Migration, gefahrlos.

## Decisions
- „Ohne Gruppe" bleibt unten (nicht alphabetisch eingereiht).
- Natürliche Zahlen-Sortierung aktiv.

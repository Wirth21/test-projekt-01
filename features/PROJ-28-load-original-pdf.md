# PROJ-28: Original-PDF in voller Auflösung laden

## Status: In Review
**Created:** 2026-06-04
**Last Updated:** 2026-06-04

> Implementiert auf Branch `feature/PROJ-27-33-drawings-erweiterungen`.
> Umsetzung: „Original öffnen" öffnet das Original-PDF im nativen Browser-Viewer
> (neuer Tab) — volle Vektorauflösung ohne Canvas-Limit-Risiko (robuster als
> In-Viewer-Hochskalierung).
> Automatisierte Prüfungen grün: `tsc`, ESLint, `npm run build`, 38/38 Tests.
> Manuelle Browser-Prüfung + PR-Review ausstehend.

## Beschreibung
In der Zeichnungsansicht soll per Knopfdruck das Original-PDF in voller Auflösung
geladen werden können. Die normale Viewer-Darstellung ist aus Performance-/RAM-Gründen
herunterskaliert; bei sehr feinen Plänen ist das schwer lesbar. Der Nutzer bekommt eine
Aktion, die das unskalierte Original anzeigt bzw. öffnet.

## Dependencies
- Requires: PROJ-3 (PDF Upload & Viewer)
- Requires: PROJ-26 (Drucken) — teilt den `fetch → blob`-Mechanismus aus `print-pdf.ts`
- Bezug: PROJ-20 (Viewer/Guest) — reine Lese-Aktion, auch für Read-only sichtbar

## User Stories
- Als **Techniker** möchte ich einen feinen Plan in Originalauflösung anschauen, damit
  ich kleine Beschriftungen/Details lesen kann.

## Acceptance Criteria
- [ ] In der Viewer-Toolbar (Desktop-Header, Mobile-Leiste, FloatingToolbar) gibt es eine
      klar erkennbare Aktion „Original laden / volle Auflösung".
- [ ] Auf Desktop wird das Original der aktiven Version hochauflösend dargestellt; auf
      Mobile/bei sehr großen Plänen wird das Original-PDF robust in einem neuen Tab geöffnet
      (Fallback gegen Canvas-/RAM-Limit).
- [ ] Sichtbarer Lade-/Deaktiviert-Zustand; kein doppeltes Auslösen.
- [ ] Fehler (PDF nicht abrufbar) → verständlicher Toast.
- [ ] Aktion ist für alle Rollen mit Lesezugriff verfügbar (nicht an Bearbeitungsmodus
      geknüpft).
- [ ] Keine Regression der bestehenden Viewer-Render-Pipeline.

## Edge Cases
- Sehr großer A0-Plan überschreitet das Canvas-Flächenbudget (~45–64 MP) → Tab-Fallback.
- Abgelaufene signierte URL → Fehlermeldung statt leerer Anzeige.
- Offline (PWA): vorhandene `blob:`-Quelle direkt nutzen.
- Blob-URLs müssen revoked werden (kein Memory-Leak).

## Tech Design
- Gemeinsamer Helper `fetchPdfBlob(source)` aus
  [print-pdf.ts](../src/lib/print/print-pdf.ts) extrahieren (fetch → blob → object URL;
  `blob:`-Quelle direkt durchreichen). Wird von Print, Original-Laden und Download (PROJ-29)
  geteilt.
- „Original laden" rendert **separat** vom laufenden `<Page>` (kein Runtime-DPR-Wechsel auf
  der sichtbaren Page — sonst weißes Canvas) bzw. öffnet das Original im Browser-PDF-Viewer.
- State `loadingOriginal` analog `printing`. Buttons analog Print-Block an drei Stellen.

## Decisions
- In-Viewer hochauflösend wo möglich, Tab-Fallback auf Mobile/bei Überschreitung des
  Canvas-Limits.

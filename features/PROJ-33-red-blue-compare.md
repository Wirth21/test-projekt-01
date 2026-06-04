# PROJ-33: Rot-Blau-Vergleich zweier Planversionen

## Status: In Review
**Created:** 2026-06-04
**Last Updated:** 2026-06-04

> Implementiert auf Branch `feature/PROJ-27-33-drawings-erweiterungen`.
> Vollausbau: Überblenden + Swipe + Rot-Blau + Differenz; unverändert = Grau.
> Automatisierte Prüfungen grün: `tsc`, ESLint, `npm run build`, 38/38 Tests.
> Manuelle Browser-Prüfung + PR-Review ausstehend.

## Beschreibung
In der Zeichnungsansicht soll ein Versionsvergleich möglich sein. Neben einem Überblend-/
Swipe-Vergleich gibt es den klassischen Rot-Blau-Differenzplan: alte Version rot, neue Version
blau eingefärbt und überlagert; unveränderte Bereiche werden **grau** dargestellt. Zusätzlich
ein Differenz-Modus, der Änderungen hervorhebt.

## Dependencies
- Requires: PROJ-3 (Viewer), PROJ-7 (Versionierung)
- Requires: PROJ-28 — teilt `fetchPdfBlob`; nutzt vorhandenes `getVersionSignedUrl`
- Bezug: `src/lib/thumbnails/render.ts` — erprobtes Offscreen-pdfjs-Render-Muster

## User Stories
- Als **Planer** möchte ich zwei Versionen überblenden/swipen, um schnell zu sehen, was sich
  geändert hat.
- Als **Techniker** möchte ich einen Rot-Blau-Differenzplan, um Planänderungen eindeutig
  (rot = entfernt, blau = neu, grau = unverändert) zu erkennen.

## Acceptance Criteria
- [ ] Vergleichsmodus mit Auswahl von zwei Versionen derselben Zeichnung (Default: zwei
      neueste).
- [ ] Modi: **Überblenden** (Opacity-Slider), **Swipe** (vertikaler Trenner), **Rot-Blau**
      (alt=rot, neu=blau, unverändert=grau), **Differenz** (Änderungen leuchten auf).
- [ ] Vergleich läuft als **separate Render-Route** (Offscreen-Canvas + Compositing-Canvas) —
      die bestehende `<Page>`-Pipeline wird nicht angefasst.
- [ ] „Gleiche Geometrie angenommen"; bei abweichenden Seitenformaten Warnung statt Blockade.
- [ ] Sequentielles Rendern + Spinner; Offscreen-Canvases nach Compositing freigeben.
- [ ] Funktioniert mit dem Worker aus `/public` (`workerSrc` erneut setzen), dynamic
      `ssr:false`.

## Edge Cases
- Abweichende Blattgrößen → Aspekt vergleichen, warnen.
- Mobile RAM (drei Canvases + Pixel-Loop) → moderate Auflösung, TransformWrapper-Upscaling.
- Rot-Grün-/Rot-Blau-Farbschwäche → Differenz-Modus als Alternative.
- Cross-origin getImageData → beide Quellen als same-origin-Blob via `fetchPdfBlob`.

## Tech Design
- Neue Komponente `PdfCompareView.tsx` (client-only, `ssr:false`).
- Rot-Blau (Ansatz B): beide Versionen offscreen rendern → Tinte = 255−Luminanz als Alpha,
  alt→Rot/neu→Blau; Compositing-Canvas erst füllen, Layer 1 `source-over`, Layer 2
  `multiply`; **unverändert = grau** (statt violett) durch gewählte Tintenfarben/Compositing.
- Differenz-Modus: `globalCompositeOperation = "difference"` über denselben Offscreen-Layern.
- Zweite Versions-URL via `getVersionSignedUrl(otherVersionId)`; beide über `fetchPdfBlob`.

## Decisions
- **Voller Ausbau in V1:** Überblenden + Swipe + Rot-Blau + Differenz zusammen.
- Unveränderte Bereiche im Rot-Blau-Modus in **Grau** (nicht Violett).
- Manueller X/Y-Offset-Slider optional als spätere Eskalation.

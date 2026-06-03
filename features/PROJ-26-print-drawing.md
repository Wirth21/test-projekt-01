# PROJ-26: Zeichnung drucken

## Status: Deployed
**Created:** 2026-06-03
**Last Updated:** 2026-06-03

> Gemergt via PR #1 nach `main` und über Vercel auf link2plan.de deployt
> (2026-06-03). Vom Nutzer im Vercel-Preview manuell getestet — Drucken
> funktioniert.

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

**Ansatz:** Es werden die bereits geladenen Original-PDF-Bytes der aktiven Version gedruckt
(`pdfUrl` im `DrawingViewerClient`). Marker sind ein separates HTML-Overlay (`MarkerOverlay`)
und damit automatisch nicht Teil des Ausdrucks — keine Render-/Overlay-Tricks nötig.

**Neuer Helper:** [src/lib/print/print-pdf.ts](../src/lib/print/print-pdf.ts)
- `printPdf(source)` erzeugt immer eine **same-origin Blob-URL** (signierte Supabase-URL →
  `fetch`; eine Offline-`blob:`-Quelle wird direkt weiterverwendet). Grund: `iframe.print()`
  wirft bei fremder Herkunft einen SecurityError.
- **Desktop (pointer: fine):** verstecktes iframe + nativer Druckdialog; Aufräumen via
  `afterprint` + Safety-Timeout; Blob-URL wird erst verzögert revoked.
- **Touch/Mobil (pointer: coarse):** PDF in neuem Tab öffnen (synchron im Klick-Gesture, um
  Popup-Blocker zu umgehen) → OS-Teilen/Drucken-Sheet.

**UI-Anbindung im [DrawingViewerClient.tsx](../src/app/(protected)/dashboard/projects/[id]/drawings/[drawingId]/DrawingViewerClient.tsx):**
- `printing`-State + `handlePrint`-Callback (Fehler → `toast.error(t("toasts.printFailed"))`).
- Drucken-Button (Printer-Icon) in: Desktop-Kopfzeile, mobiler Steuerleiste und der
  `FloatingToolbar` (Vollbild). Sichtbar/aktiv, sobald eine Version geladen ist — **nicht** an
  den Bearbeitungsmodus geknüpft, also auch für Viewer/Guest verfügbar.
- Neue i18n-Keys: `drawings.print` und `drawings.toasts.printFailed` (de + en).

**Keine Backend-/Schema-Änderung** — reines Frontend/Lese-Feature.

## QA Test Results

**Automatisierte Prüfungen (alle grün):**
- `npx tsc --noEmit` — keine Typfehler
- ESLint auf geänderten Dateien — 0 Errors (nur 1 vorbestehende `<img>`-Warnung, nicht aus
  diesem Feature)
- `npm run build` — erfolgreich (Exit 0)
- `npm test` — 38/38 Tests bestanden

**Noch offen (manuell zu bestätigen, Teil des Reviews):**
- [ ] Tatsächliches Öffnen des Druckdialogs im echten Browser (Chrome/Edge/Firefox Desktop)
- [ ] Mobiler Pfad: neuer Tab + Teilen/Drucken auf Android-Chrome / iOS-Safari
- [ ] Offline-Fall (PWA): Drucken einer im Cache vorhandenen Zeichnung
- [ ] Sichtprüfung: Ausdruck enthält keine Marker-Pins

## Deployment
_To be added by /deploy_

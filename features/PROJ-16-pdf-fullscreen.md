# PROJ-16: PDF Vollbildansicht

## Status: In Review
**Created:** 2026-03-25
**Last Updated:** 2026-03-25

## Dependencies
- Requires: PROJ-3 (PDF Upload & Viewer) -- Erweitert den bestehenden PDF-Viewer

## Overview
PDFs sollen im echten Browser-Vollbild geöffnet werden können. Der Nutzer kann über einen Button im Viewer den Vollbildmodus aktivieren, wodurch die gesamte Browseransicht für die PDF-Darstellung genutzt wird. Im Vollbildmodus bleiben alle Viewer-Funktionen (Zoom, Pan, Seitennavigation, Marker) verfügbar. Der Vollbildmodus kann per Escape-Taste oder Button verlassen werden.

## User Stories
- Als Nutzer möchte ich eine PDF im Vollbildmodus betrachten, damit ich technische Details auf dem gesamten Bildschirm sehen kann, ohne durch Menüleisten oder Browser-UI abgelenkt zu werden.
- Als Nutzer möchte ich im Vollbildmodus alle Viewer-Funktionen (Zoom, Pan, Seitennavigation) weiterhin nutzen können.
- Als Nutzer möchte ich den Vollbildmodus jederzeit per Escape-Taste oder Button verlassen können.
- Als Nutzer möchte ich im Vollbildmodus weiterhin Marker sehen und mit ihnen interagieren können.

## Acceptance Criteria
- [ ] Im PDF-Viewer gibt es einen gut sichtbaren "Vollbild"-Button (z.B. Maximize-Icon)
- [ ] Klick auf den Button aktiviert den Browser-Vollbildmodus (Fullscreen API) für den Viewer-Bereich
- [ ] Im Vollbildmodus ist die gesamte Bildschirmfläche für die PDF-Anzeige verfügbar
- [ ] Alle Viewer-Steuerungen (Zoom rein/raus, Pan, Seitennavigation) bleiben im Vollbild funktional
- [ ] Im Vollbildmodus wird eine schwebende Toolbar mit den Steuerungselementen angezeigt
- [ ] Der Vollbildmodus kann verlassen werden per:
  - Escape-Taste (Browser-Standard)
  - Klick auf einen "Vollbild verlassen"-Button in der schwebenden Toolbar
- [ ] Marker (PROJ-4) werden im Vollbildmodus korrekt angezeigt und sind interaktiv
- [ ] Das Versions-Panel (PROJ-7) kann auch im Vollbildmodus geöffnet werden
- [ ] Der aktuelle Zoom-Level und die Seitenposition bleiben beim Wechsel in/aus dem Vollbild erhalten

## Edge Cases
- Was passiert, wenn der Browser die Fullscreen API nicht unterstützt? -> Vollbild-Button wird ausgeblendet; Fallback ist die bestehende Viewer-Seite (die bereits fast vollflächig ist)
- Was passiert, wenn der Nutzer den Vollbildmodus über die Browser-eigene Funktion (F11) aktiviert? -> Funktioniert unabhängig; der Viewer passt sich an die verfügbare Fläche an
- Was passiert auf mobilen Geräten? -> Vollbild-Button wird angezeigt, nutzt die mobile Fullscreen API (falls verfügbar); auf iOS Safari eingeschränkt unterstützt
- Was passiert, wenn eine Tastenkombination (z.B. Strg+F für Suche) im Vollbild gedrückt wird? -> Browser-Standardverhalten wird nicht blockiert

## Technical Requirements
- Verwendet die Browser Fullscreen API (`element.requestFullscreen()` / `document.exitFullscreen()`)
- Fullscreen wird auf den Viewer-Container angewendet (nicht auf `document.documentElement`), damit die Toolbar innerhalb des Vollbilds bleibt
- CSS-Anpassungen für den `:fullscreen` Pseudo-Selektor (Hintergrundfarbe, Toolbar-Positionierung)
- Browser Support: Chrome, Firefox, Safari (aktuellste Versionen) -- mit Feature-Detection für Fullscreen API
- Keine neuen npm-Abhängigkeiten nötig

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
**Erstellt:** 2026-03-25

### Wichtiger Hinweis
PROJ-16 ist ein reines Frontend-Feature. Es sind keine Datenbankänderungen oder API-Routen nötig. Die Fullscreen API ist eine Browser-Standard-API.

---

### Komponenten-Struktur

```
Viewer-Seite /dashboard/projects/[id]/drawings/[drawingId]
+-- Header (bestehend)
|   +-- FullscreenToggleButton (NEU -- Maximize/Minimize Icon)
+-- ViewerContainer (ref für Fullscreen-Target)
    +-- TransformWrapper (bestehend: Zoom, Pan)
    |   +-- TransformComponent
    |       +-- PDF Page + MarkerOverlay
    +-- FloatingToolbar (NEU -- nur im Fullscreen sichtbar)
    |   +-- Seitennavigation (ChevronLeft, Seite X/Y, ChevronRight)
    |   +-- Zoom-Controls (ZoomIn, ZoomOut, Reset)
    |   +-- Fullscreen-Verlassen-Button (Minimize)
    |   +-- Edit-Mode-Toggle
    +-- ZoomControls (bestehend -- im Normal-Modus unten rechts)
```

### Funktionsweise

**Fullscreen aktivieren:**
1. Nutzer klickt auf Fullscreen-Button im Viewer-Header
2. `viewerContainerRef.current.requestFullscreen()` wird aufgerufen
3. Der gesamte Viewer-Container (PDF + Toolbar) geht in den Fullscreen-Modus
4. Header der normalen Seite verschwindet (Browser-Standard)
5. Eine schwebende Toolbar erscheint im Fullscreen mit allen Steuerungen

**Fullscreen verlassen:**
1. Nutzer drückt Escape (Browser-Standard) ODER klickt Minimize-Button
2. `document.exitFullscreen()` wird aufgerufen
3. Viewer kehrt zur normalen Ansicht zurück

**State-Erhaltung:**
- Zoom-Level und Pan-Position werden durch `react-zoom-pan-pinch` intern verwaltet und bleiben erhalten
- Seitennummer bleibt erhalten
- Marker bleiben sichtbar und interaktiv

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Fullscreen-Target | Viewer-Container (nicht document) | Toolbar bleibt innerhalb des Fullscreen-Elements sichtbar |
| Fullscreen-Detection | `document.fullscreenElement` + `fullscreenchange` Event | Standard-API; kein State-Polling nötig |
| Feature-Detection | `document.fullscreenEnabled` prüfen | Button wird ausgeblendet wenn Browser Fullscreen nicht unterstützt |
| Toolbar im Fullscreen | Schwebend (fixed position innerhalb Container) | Alle Steuerungen bleiben erreichbar; auto-hide nach Inaktivität optional |
| CSS-Styling | `:fullscreen` Pseudo-Selektor + Tailwind | Hintergrund schwarz/dunkel im Fullscreen für bessere Lesbarkeit |

### Neue Abhängigkeiten

Keine -- die Fullscreen API ist ein Browser-Standard und benötigt keine npm-Pakete.

## Frontend Implementation Notes
**Implemented:** 2026-03-25

### Files Created
- `src/hooks/use-fullscreen.ts` -- Custom hook wrapping the Browser Fullscreen API with feature detection, Safari vendor prefix support, and reactive state via `fullscreenchange` event listener.
- `src/components/drawings/FloatingToolbar.tsx` -- Floating toolbar component for fullscreen mode with all viewer controls (page navigation, zoom, edit mode toggle, version panel access, exit fullscreen). Auto-hides after 3 seconds of inactivity, stays visible on hover.

### Files Modified
- `src/app/(protected)/dashboard/projects/[id]/drawings/[drawingId]/page.tsx` -- Added fullscreen toggle button to both desktop header and mobile toolbar. Viewer container wrapped with ref for Fullscreen API target. FloatingToolbar rendered inside TransformWrapper render prop for access to zoom functions. Normal zoom controls hidden in fullscreen mode.
- `src/app/globals.css` -- Added `:fullscreen` and `:-webkit-full-screen` pseudo-selector styles for dark background.
- `src/messages/de.json` and `src/messages/en.json` -- Added fullscreen-related i18n translations.

### Design Decisions
- FloatingToolbar placed inside TransformWrapper render prop to access zoomIn/zoomOut/resetTransform functions directly.
- Fullscreen applied to the viewer container div (not document.documentElement) so the FloatingToolbar and VersionSidePanel remain visible within the fullscreen element.
- Auto-hide delay set to 3 seconds; toolbar reappears on any mouse movement or keypress.
- Fullscreen button hidden entirely when `document.fullscreenEnabled` is false (feature detection).

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

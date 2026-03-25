# PROJ-18: Mobile Optimierung (Responsive Design)

## Status: In Review
**Created:** 2026-03-25
**Last Updated:** 2026-03-25

## Dependencies
- Requires: PROJ-1 bis PROJ-8 -- Alle bestehenden UI-Komponenten werden optimiert
- Requires: PROJ-9 (Landing Page) -- Landing Page muss ebenfalls mobil-optimiert sein

## Overview
Die gesamte App wird für die Darstellung auf Mobilgeräten (Smartphones, 320px-428px) und Tablets (768px-1024px) optimiert. Bekannte Probleme wie fehlende Touch-Interaktion, abgeschnittene Felder und zu kleine Schaltflächen werden behoben. Ziel ist eine vollständig nutzbare App auf allen Bildschirmgrößen.

## User Stories
- Als mobiler Nutzer möchte ich alle Funktionen der App auf meinem Smartphone nutzen können, ohne dass Inhalte abgeschnitten oder unzugänglich sind.
- Als mobiler Nutzer möchte ich Schaltflächen und Links bequem per Touch bedienen können, ohne versehentlich falsche Elemente zu treffen.
- Als mobiler Nutzer möchte ich Formulare und Dialoge vollständig sehen und ausfüllen können, ohne horizontal scrollen zu müssen.
- Als Tablet-Nutzer möchte ich ein optimiertes Layout haben, das den verfügbaren Platz sinnvoll nutzt.

## Acceptance Criteria

### Allgemein
- [ ] Kein horizontales Scrollen auf Bildschirmbreiten ab 320px
- [ ] Alle Schaltflächen und interaktiven Elemente haben eine Mindestgröße von 44x44px (Touch-Target gemäß WCAG)
- [ ] Texte sind lesbar (mindestens 14px auf mobilen Geräten)
- [ ] Dialoge/Modals passen sich an die Bildschirmgröße an (kein Überlauf)

### Navigation & Header
- [ ] Der Dashboard-Header ist auf mobilen Geräten kompakt und bricht sinnvoll um
- [ ] Navigation-Elemente (Admin-Link, Abmelden-Button) bleiben auf mobilen Geräten erreichbar
- [ ] Der Projekt-Header (Zurück-Button, Projektname, Aktionen) passt auf eine Zeile oder bricht sauber um

### Projektübersicht (Dashboard)
- [ ] Projektkarten werden auf mobilen Geräten einspaltig angezeigt (grid-cols-1)
- [ ] Tab-Leiste (Aktiv/Inaktiv/Archiv) ist auf mobilen Geräten scrollbar oder bricht um
- [ ] Projekt-Erstellen-Dialog passt auf den mobilen Bildschirm

### Projektdetailseite
- [ ] Zeichnungs-Grid passt sich an (1 Spalte auf kleinen Phones, 2 Spalten ab 400px)
- [ ] Upload-Zone ist per Touch bedienbar und visuell klar
- [ ] Die Mitgliederliste ist auf mobilen Geräten lesbar (Tabelle oder Listenansicht)

### PDF-Viewer
- [ ] Viewer-Steuerungen (Zoom, Seite, Vollbild) sind als Touch-freundliche Toolbar am unteren Bildschirmrand positioniert
- [ ] Zoom und Pan funktionieren per Pinch-to-Zoom und Swipe (Touch-Gesten)
- [ ] Seitennavigation ist per Swipe oder gut erreichbare Buttons möglich
- [ ] Das Versions-Panel (Sheet) lässt sich per Touch öffnen und schließen

### Bekannte Bugs (aus QA-Reports)
- [ ] BUG PROJ-3 BUG-1: DrawingCard Aktions-Button (MoreVertical) ist auf Touch-Geräten nicht sichtbar (opacity-0 group-hover:opacity-100) -- muss immer sichtbar sein oder per Long-Press auslösbar
- [ ] Admin-Bereich: Tabelle auf mobilen Geräten horizontal scrollbar oder als Karten-Layout dargestellt

### Formulare & Dialoge
- [ ] Alle Dialoge (Create, Edit, Invite, Rename, Archive) sind auf mobilen Geräten vollständig sichtbar
- [ ] Eingabefelder haben ausreichende Größe für Touch-Eingabe
- [ ] Tastatur-Overlay (Mobile-Keyboard) verschiebt den Dialog-Inhalt nicht aus dem sichtbaren Bereich oder scrollt mit

## Edge Cases
- Was passiert bei sehr kleinen Bildschirmen (<320px)? -> Mindest-Breakpoint 320px; darunter wird horizontales Scrollen toleriert
- Was passiert bei Landscape-Modus auf Smartphones? -> Layout passt sich an; Viewer nutzt die volle Breite; Toolbar positioniert sich am Rand
- Was passiert bei Tablets im Portrait-Modus? -> Zwei-Spalten-Layout für Zeichnungen; Dialoge zentriert
- Was passiert mit sehr langen Projektnamen auf mobilen Geräten? -> Truncation mit Ellipsis (...) und Tooltip bei Hover/Long-Press
- Was passiert mit dem PDF-Viewer bei Orientation-Change? -> PDF passt sich an die neue Viewport-Größe an; Zoom wird zurückgesetzt oder beibehalten

## Technical Requirements
- Ausschließlich CSS/Tailwind-Änderungen -- kein JavaScript-Refactoring der Kernlogik
- Tailwind Breakpoints: `sm` (640px), `md` (768px), `lg` (1024px) als Basis
- Mobile-First Ansatz: Standardlayout ist mobil, größere Layouts per Breakpoints
- Touch-Events: `react-zoom-pan-pinch` unterstützt Touch bereits -- sicherstellen, dass keine CSS-Überlagerung Touch blockiert
- Testen auf: iPhone SE (375px), iPhone 14 (390px), iPad (768px), Android-Standardgeräte
- Keine neuen npm-Abhängigkeiten nötig

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
**Erstellt:** 2026-03-25

### Wichtiger Hinweis
PROJ-18 ist ein reines Frontend/CSS-Feature. Es sind keine Datenbankänderungen, API-Routen oder neuen Pakete nötig. Alle Änderungen betreffen ausschließlich Tailwind-Klassen und ggf. minimale Komponentenlogik (z.B. Touch-Sichtbarkeit).

---

### Betroffene Bereiche und Maßnahmen

#### 1. DrawingCard -- Touch-Accessibility (BUG PROJ-3 BUG-1)

**Problem:** Der Aktions-Button (MoreVertical / Drei-Punkte-Menü) ist auf Touch-Geräten unsichtbar, weil er `opacity-0 group-hover:opacity-100` verwendet. Auf Touch-Geräten gibt es kein Hover.

**Lösung:** Button ist immer sichtbar (kein Hover-gesteuerte Sichtbarkeit). Alternativ: auf mobilen Geräten immer sichtbar (`sm:opacity-0 sm:group-hover:opacity-100`), auf Desktop bleibt das Hover-Verhalten erhalten.

**Betroffene Datei:** `src/components/drawings/DrawingCard.tsx`

---

#### 2. Dashboard-Header (Navigation)

**Problem:** Bei schmalen Bildschirmen können Admin-Link, Sprachwechsler und Abmelden-Button überlappen oder abgeschnitten werden.

**Lösung:**
- Header-Buttons: Auf Mobil nur Icons zeigen (Label per `hidden sm:inline`), Tooltips für Kontext
- Flexbox mit `flex-wrap` als Fallback
- App-Name kann auf Mobil kürzer dargestellt werden

**Betroffene Datei:** `src/app/(protected)/dashboard/page.tsx` (Header-Bereich)

---

#### 3. Dashboard -- Projekt-Übersicht

**Problem:** "Neues Projekt"-Button und Überschrift können auf schmalen Bildschirmen kollidieren.

**Lösung:**
- Titel und Button auf Mobil untereinander (`flex-col sm:flex-row`)
- Button volle Breite auf Mobil (`w-full sm:w-auto`)
- Tab-Leiste: `overflow-x-auto` für horizontales Scrollen wenn nötig

**Betroffene Datei:** `src/app/(protected)/dashboard/page.tsx`

---

#### 4. Projektdetailseite

**Problem:** Zeichnungs-Grid, Upload-Zone und Mitgliederliste brauchen mobile Anpassung.

**Lösung:**
- DrawingGrid: `grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3` (1 Spalte unter 400px)
- Upload-Zone: Padding anpassen, Touch-freundlicher CTA-Button
- Mitgliederliste: Als vertikale Liste statt Tabelle auf Mobil (Stacken von Name, E-Mail, Rolle)

**Betroffene Dateien:** `src/components/drawings/DrawingGrid.tsx`, `src/app/(protected)/dashboard/projects/[id]/page.tsx`

---

#### 5. PDF-Viewer Header

**Problem:** Viele Steuerungselemente im Viewer-Header (Zurück, Name, Versionen, Bearbeiten, Seitennavigation) passen nicht auf schmale Bildschirme.

**Lösung:**
- Viewer-Header zweizeilig auf Mobil:
  - Zeile 1: Zurück-Button + Zeichnungsname (truncated)
  - Zeile 2: Steuerungen (Versionen, Bearbeiten, Seitennavigation) -- horizontal scrollbar
- Separatoren auf Mobil ausblenden (bereits teilweise mit `hidden sm:block`)
- Button-Labels auf Mobil ausblenden, nur Icons zeigen

**Betroffene Datei:** `src/app/(protected)/dashboard/projects/[id]/drawings/[drawingId]/page.tsx`

---

#### 6. PDF-Viewer Zoom-Controls

**Problem:** Zoom-Controls unten rechts könnten Touch-Gesten blockieren.

**Lösung:**
- Zoom-Buttons größer auf Mobil (mindestens 44x44px Touch-Target)
- Position: Unten rechts bleibt, aber mit mehr Abstand zum Rand
- `react-zoom-pan-pinch` unterstützt Pinch-to-Zoom bereits nativ -- sicherstellen, dass keine CSS-`touch-action`-Regeln dies blockieren

**Betroffene Datei:** `src/app/(protected)/dashboard/projects/[id]/drawings/[drawingId]/page.tsx`

---

#### 7. Admin-Bereich Tabelle

**Problem:** Die Nutzertabelle im Admin-Bereich passt nicht auf schmale Bildschirme.

**Lösung:**
- Tabelle in einen horizontal scrollbaren Container (`overflow-x-auto`)
- Alternative: Auf Mobil als Karten-Layout (bereits teilweise implementiert: E-Mail unter Name auf sm-Breakpoint)

**Betroffene Dateien:** `src/app/admin/users/page.tsx`, `src/components/admin/UserDetailSheet.tsx`

---

#### 8. Dialoge und Formulare

**Problem:** Dialoge können auf kleinen Bildschirmen über den Rand hinausgehen oder vom Mobile-Keyboard verdeckt werden.

**Lösung:**
- Alle shadcn/ui Dialoge nutzen bereits `sm:max-w-md` -- überprüfen, dass kein Dialog diese Konvention bricht
- DialogContent: `max-h-[85vh] overflow-y-auto` für lange Formulare
- Sicherstellen, dass `ScrollArea` in Sheets korrekt auf Mobil scrollt

**Betroffene Dateien:** Alle Dialog-Komponenten unter `src/components/`

---

### Zusammenfassung der Komponentenänderungen

```
Betroffene Komponenten:
+-- DrawingCard.tsx .............. Touch-Sichtbarkeit Aktions-Button
+-- DrawingGrid.tsx .............. Responsive Grid-Spalten
+-- Dashboard page.tsx ........... Header-Kompaktierung, Titel/Button-Layout
+-- Project detail page.tsx ...... Mitgliederliste, Upload-Zone
+-- Viewer page.tsx .............. Header zweizeilig, Zoom-Controls Touch
+-- Admin users page.tsx ......... Tabelle scrollbar/Karten
+-- UserDetailSheet.tsx .......... Sheet-Breite auf Mobil
+-- Alle Dialoge ................. max-h + overflow-y-auto Check
```

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Ansatz | Mobile-First CSS-Anpassungen | Kein JS-Refactoring nötig; Tailwind-Breakpoints reichen aus |
| DrawingCard Menü | Immer sichtbar auf Mobil | Touch-Geräte haben kein Hover; User muss Aktionen immer erreichen |
| Viewer-Header | Zweizeilig auf Mobil | Alle Steuerungen bleiben erreichbar ohne Overflow |
| Admin-Tabelle | Horizontal scrollbar | Einfachste Lösung; Karten-Layout wäre schöner, aber mehr Aufwand |
| Touch-Targets | Mindestens 44x44px | WCAG-Richtlinie für Touch-Bedienbarkeit |

### Neue Abhängigkeiten

Keine -- alle Änderungen nutzen bestehendes Tailwind CSS und shadcn/ui-Komponenten.

## Frontend Implementation Notes
**Implementiert:** 2026-03-25

### Durchgefuehrte Aenderungen

1. **DrawingCard.tsx** - Aktions-Button (MoreVertical) ist jetzt auf mobilen Geraeten immer sichtbar. Auf Desktop bleibt das Hover-Verhalten erhalten (`sm:opacity-0 sm:group-hover:opacity-100`). Touch-Target auf 32x32px vergroessert.

2. **DrawingGrid.tsx** - Grid-Spalten geaendert von `grid-cols-2` auf `grid-cols-1 min-[400px]:grid-cols-2` fuer Phones unter 400px.

3. **Dashboard page.tsx** - Header-Buttons zeigen auf Mobil nur Icons (Labels per `hidden sm:inline`). Titel und "Neues Projekt"-Button sind auf Mobil untereinander (`flex-col sm:flex-row`). Button volle Breite auf Mobil. Tab-Leiste overflow-x-auto.

4. **Project detail page.tsx** - Zurueck-Button zeigt auf Mobil nur Icon. Zeichnungs-Header flex-col auf Mobil. Grid fuer archivierte Zeichnungen responsive angepasst.

5. **Viewer page.tsx** - Header zweizeilig auf Mobil: Zeile 1 hat Zurueck-Button + Name, Zeile 2 hat alle Steuerungen. Desktop zeigt alles einzeilig. Zoom-Controls auf Mobil 44x44px Touch-Targets (h-11 w-11).

6. **Admin users page.tsx** - Tabelle in `overflow-x-auto` Container. Titel/Button-Layout flex-col auf Mobil.

7. **dialog.tsx + alert-dialog.tsx** - `max-h-[85vh] overflow-y-auto` hinzugefuegt, damit Dialoge auf mobilen Geraeten nicht ueber den Bildschirm hinausgehen.

8. **DrawingGroupSection.tsx** - Gruppen-Aktions-Button auf 32x32px vergroessert. Reduzierter linker Einzug auf Mobil (`pl-2 sm:pl-6`).

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_

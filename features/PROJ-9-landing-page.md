---
id: PROJ-9
title: Landing Page
status: Planned
created: 2026-03-24
---

# PROJ-9: Landing Page

## Beschreibung

Öffentliche Marketing-Landingpage für **Link2Plan** unter `link2plan.app` (Pfad: `/`). Die Seite richtet sich an potenzielle Neukunden — Techniker, Planer, Architekten und Ingenieure — und erklärt den Nutzen der Plattform: zentrale Verwaltung technischer PDF-Pläne, intelligente Marker/Links zwischen Dokumenten und kollaborativer Teamzugriff. Authentifizierte Nutzer werden automatisch auf `/dashboard` weitergeleitet. Die Seite ist vollständig responsiv (Mobile-first), SEO-optimiert und unterstützt Mehrsprachigkeit (Deutsch + Englisch, vorbereitet für PROJ-14).

---

## User Stories

### US-1: Besucher versteht den Produktnutzen sofort
**Als** interessierter Besucher
**möchte ich** auf der Startseite sofort verstehen, was Link2Plan ist und welches Problem es löst,
**damit ich** entscheiden kann, ob das Tool für mich und mein Team relevant ist.

**Akzeptanzkriterien:**
- [ ] Hero-Section ist das erste sichtbare Element ohne Scrollen (above the fold)
- [ ] Headline beschreibt den Kernnutzen in einem Satz (max. 10 Wörter)
- [ ] Subheadline liefert Kontext zu Zielgruppe und Anwendungsfall
- [ ] Mindestens ein CTA-Button ("Kostenlos testen" oder "Jetzt starten") ist prominent sichtbar

### US-2: Besucher erfährt die wichtigsten Features
**Als** potenzieller Kunde
**möchte ich** die wichtigsten Funktionen von Link2Plan auf einen Blick sehen,
**damit ich** den Funktionsumfang beurteilen kann, ohne mich registrieren zu müssen.

**Akzeptanzkriterien:**
- [ ] Features-Section zeigt mindestens 4 zentrale Funktionen mit Icon, Titel und kurzer Beschreibung
- [ ] Folgende Features werden hervorgehoben:
  - PDF-Upload und Viewer im Browser
  - Marker/Links zwischen Plänen setzen
  - Navigationshistorie (Zurückspringen zwischen verknüpften Dokumenten)
  - Teamzugriff und gemeinsame Projekte
- [ ] Features sind visuell klar gegliedert (Cards oder Grid-Layout)

### US-3: Besucher sieht verfügbare Preispläne
**Als** interessierter Käufer
**möchte ich** die Preise und enthaltenen Leistungen der verschiedenen Pläne einsehen,
**damit ich** den passenden Plan für mein Team auswählen kann.

**Akzeptanzkriterien:**
- [ ] Pricing-Section zeigt drei Pläne: **Free**, **Team**, **Business**
- [ ] Jeder Plan zeigt: Preis, enthaltene Features (als Liste) und einen CTA-Button
- [ ] Der empfohlene Plan (z. B. "Team") ist visuell hervorgehoben (z. B. Badge "Beliebt")
- [ ] Free-Plan hat CTA "Kostenlos starten", kostenpflichtige Pläne "Plan wählen" oder "Kontakt aufnehmen"
- [ ] Hinweis auf monatliche/jährliche Abrechnung (auch wenn noch nicht implementiert)

### US-4: Besucher kann sich einloggen
**Als** bestehender Nutzer
**möchte ich** direkt von der Landingpage zur Login-Seite navigieren können,
**damit ich** nicht suchen muss, wie ich in die App komme.

**Akzeptanzkriterien:**
- [ ] Navbar enthält oben rechts einen "Anmelden"-Button, der zu `/login` führt
- [ ] Button ist auf allen Bildschirmgrößen sichtbar und zugänglich
- [ ] Auf Mobilgeräten ist der Button im Hamburger-Menü oder als separater Button erreichbar

### US-5: Authentifizierter Nutzer wird weitergeleitet
**Als** bereits eingeloggter Nutzer
**möchte ich** beim Aufrufen von `/` automatisch zu `/dashboard` weitergeleitet werden,
**damit ich** nicht die Marketing-Seite sehe, wenn ich bereits angemeldet bin.

**Akzeptanzkriterien:**
- [ ] Middleware oder serverseitige Logik prüft Auth-Status beim Aufruf von `/`
- [ ] Eingeloggte Nutzer werden sofort (ohne Flash der Landingpage) zu `/dashboard` umgeleitet
- [ ] Nicht eingeloggte Nutzer sehen die Landingpage ohne Weiterleitung

### US-6: Besucher navigiert auf Mobilgeräten komfortabel
**Als** Nutzer auf einem Smartphone
**möchte ich** die Landingpage ohne horizontales Scrollen und mit lesbaren Schriftgrößen nutzen können,
**damit ich** die Inhalte auch unterwegs gut aufnehmen kann.

**Akzeptanzkriterien:**
- [ ] Layout bricht bei Viewport-Breiten ab 375 px korrekt um (Mobile-first)
- [ ] Keine horizontale Scrollbar auf Mobilgeräten
- [ ] Schriftgrößen sind auf allen Viewports lesbar (min. 16 px Fließtext)
- [ ] Touch-Targets (Buttons, Links) haben min. 44 × 44 px Klickfläche

### US-7: Seite ist SEO-optimiert
**Als** Marketingverantwortlicher
**möchte ich** dass die Landingpage korrekte Meta-Tags und strukturierte Daten enthält,
**damit ich** die Seite in Suchmaschinen gut positionieren kann.

**Akzeptanzkriterien:**
- [ ] `<title>` enthält den Produktnamen und einen beschreibenden Zusatz
- [ ] `<meta name="description">` mit max. 160 Zeichen vorhanden
- [ ] Open-Graph-Tags (`og:title`, `og:description`, `og:image`) für Social Sharing
- [ ] Korrekte `<h1>`–`<h3>`-Hierarchie (genau eine `<h1>` pro Seite)
- [ ] `lang`-Attribut am `<html>`-Tag entsprechend aktiver Sprache gesetzt
- [ ] Canonical-URL gesetzt

### US-8: Besucher wechselt die Sprache
**Als** englischsprachiger Besucher
**möchte ich** die Landingpage auf Englisch lesen können,
**damit ich** den Inhalt in meiner bevorzugten Sprache verstehe.

**Akzeptanzkriterien:**
- [ ] Sprachumschalter (DE / EN) ist in der Navbar sichtbar
- [ ] Alle Texte auf der Seite sind übersetzbar (keine hartcodierten deutschen Strings)
- [ ] i18n-Struktur ist kompatibel mit PROJ-14 (next-intl oder gleichwertige Lösung)
- [ ] URL-Struktur unterstützt Locale-Präfix (z. B. `/en`, `/de`) oder Locale-Cookie

### US-9: Besucher findet rechtliche Informationen
**Als** Besucher
**möchte ich** Links zu Impressum, Datenschutzerklärung und AGB im Footer finden,
**damit ich** die rechtlichen Informationen einsehen kann.

**Akzeptanzkriterien:**
- [ ] Footer enthält Links zu: Impressum (`/impressum`), Datenschutz (`/datenschutz`), AGB (`/agb`)
- [ ] Footer zeigt Copyright-Hinweis mit aktuellem Jahr
- [ ] Footer-Links sind auf allen Viewports erreichbar
- [ ] Verlinkungen führen zu vorhandenen oder platzhaltermäßig angelegten Seiten

---

## Akzeptanzkriterien

### Funktional
- [ ] Seite ist unter `/` erreichbar und zeigt Landingpage für nicht eingeloggte Nutzer
- [ ] Eingeloggte Nutzer werden zu `/dashboard` weitergeleitet (kein Flash)
- [ ] Alle Sections sind vorhanden: Navbar, Hero, Features, Pricing, Footer
- [ ] Alle internen Links funktionieren (Anmelden → `/login`, CTA → `/register` oder `/login`)
- [ ] Sprachumschalter wechselt Seiteninhalt zwischen Deutsch und Englisch

### Design & UX
- [ ] Mobile-first Responsive Design (375 px bis 1440 px getestet)
- [ ] Konsistentes Design mit dem restlichen App-Design (Tailwind CSS + shadcn/ui Tokens)
- [ ] Klare visuelle Hierarchie: Hero > Features > Pricing > Footer
- [ ] CTA-Buttons sind farblich hervorgehoben und klar beschriftet
- [ ] Ladezeit der Seite unter 2 Sekunden (LCP) auf einer durchschnittlichen Verbindung

### SEO & Accessibility
- [ ] Lighthouse SEO Score ≥ 90
- [ ] Lighthouse Accessibility Score ≥ 90
- [ ] Alle Bilder haben `alt`-Attribute
- [ ] Tastaturnavigation durch alle interaktiven Elemente möglich
- [ ] Korrekte `<meta>`-Tags und Open-Graph-Tags vorhanden

### Technisch
- [ ] Keine clientseitigen Fehler in der Browser-Konsole
- [ ] Produktions-Build (`npm run build`) schlägt nicht fehl
- [ ] ESLint-Prüfung (`npm run lint`) ohne Fehler
- [ ] Texte sind in i18n-Ressourcendateien ausgelagert (nicht hartcodiert)

---

## Technische Notizen

### Seitenstruktur (Next.js App Router)
```
src/app/
  page.tsx                  # Landingpage (öffentlich, kein Auth erforderlich)
  (landing)/
    _components/
      Navbar.tsx            # Navigation mit Login-Button und Sprachumschalter
      HeroSection.tsx       # Hero mit Headline, Subheadline, CTA
      FeaturesSection.tsx   # Feature-Grid / -Cards
      PricingSection.tsx    # Drei Preiskarten
      Footer.tsx            # Links zu Impressum, Datenschutz, AGB
```

### Auth-Redirect (Middleware)
Die bestehende `middleware.ts` muss erweitert werden: Eingeloggte Nutzer, die `/` aufrufen, werden serverseitig zu `/dashboard` weitergeleitet — bevor die Seite gerendert wird. Nicht eingeloggte Nutzer bleiben auf `/`.

### i18n-Vorbereitung (PROJ-14)
- Alle angezeigten Texte werden in Übersetzungsdateien ausgelagert (z. B. `messages/de.json`, `messages/en.json`)
- Empfohlen: `next-intl` (kompatibel mit Next.js App Router)
- Locale wird über URL-Präfix gesteuert (`/de/`, `/en/`) oder per Cookie-Fallback
- Die Landingpage muss von Anfang an mit diesem System gebaut werden, auch wenn PROJ-14 noch nicht abgeschlossen ist

### Pricing-Pläne (Platzhalter — endgültige Preise noch offen)
| Plan | Preis | Enthaltene Features |
|------|-------|---------------------|
| Free | 0 €/Monat | 1 Projekt, bis zu 3 Nutzer, 100 MB Speicher |
| Team | X €/Monat | Unbegrenzte Projekte, bis zu 20 Nutzer, 10 GB Speicher, Versionierung |
| Business | Auf Anfrage | Unbegrenzte Nutzer, SSO, SLA, dedizierter Support |

### SEO-Meta-Tags (Standardwerte)
```tsx
export const metadata: Metadata = {
  title: "Link2Plan – Technische PDF-Pläne verwalten und verknüpfen",
  description: "Link2Plan ermöglicht Teams die zentrale Verwaltung technischer PDF-Pläne mit intelligenten Markern, Dokumentenlinks und Navigationshistorie.",
  openGraph: {
    title: "Link2Plan",
    description: "Technische PDF-Pläne verwalten, verknüpfen und gemeinsam nutzen.",
    url: "https://link2plan.app",
    siteName: "Link2Plan",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale: "de_DE",
    type: "website",
  },
};
```

### Komponenten-Strategie
- Navbar: shadcn/ui `NavigationMenu` oder eigene Komponente mit Tailwind
- Hero: eigene Komponente, kein shadcn-Äquivalent erforderlich
- Features: shadcn/ui `Card` für Feature-Cards
- Pricing: shadcn/ui `Card` + `Badge` (für "Beliebt"-Label) + `Button`
- Footer: eigene Komponente mit Tailwind

### Rechtliche Seiten
Die Seiten `/impressum`, `/datenschutz` und `/agb` werden als einfache statische Seiten angelegt. Inhalte sind Platzhalter — müssen vor dem Go-live durch echte Rechtstexte ersetzt werden.

---

## Offene Fragen

1. **Preisgestaltung:** Sind die Preise für die Pricing-Section bereits festgelegt, oder sollen zunächst Platzhalter verwendet werden?
2. **Hero-Bild / Illustration:** Soll ein Screenshot der App, eine Illustration oder ein abstraktes Bild im Hero-Bereich verwendet werden?
3. **OG-Image:** Wer erstellt das Open-Graph-Bild (`/og-image.png`, 1200 × 630 px)?
4. **Rechtliche Texte:** Sind Impressum, Datenschutzerklärung und AGB bereits vorhanden oder müssen diese neu erstellt/beauftragt werden?
5. **Sprachpriorität:** Soll Deutsch (`/de`) oder Englisch (`/en`) die Standard-Locale sein? Oder soll Browser-Sprache erkannt werden?
6. **Analytics:** Soll von Anfang an ein datenschutzkonformes Tracking (z. B. Plausible, umami) eingebunden werden?
7. **Domain:** Ist `link2plan.app` bereits registriert und auf Vercel konfiguriert?
8. **Abhängigkeit zu PROJ-14:** Soll die i18n-Infrastruktur im Rahmen von PROJ-9 aufgebaut werden, oder soll zunächst nur Deutsch implementiert und später auf i18n umgestellt werden?

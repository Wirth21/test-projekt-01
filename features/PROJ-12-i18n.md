---
id: PROJ-12
title: Mehrsprachigkeit (i18n)
status: In Review
created: 2026-03-24
---

# PROJ-12: Mehrsprachigkeit (i18n)

## Beschreibung

Link2Plan soll ab Launch auf Deutsch und Englisch verfügbar sein. Die Architektur muss so gestaltet sein, dass weitere Sprachen jederzeit ohne strukturelle Änderungen ergänzt werden können.

Die Sprachauswahl unterscheidet sich je nach Bereich der App:

- **Landingpage (öffentlicher Bereich, PROJ-9):** Sprache richtet sich nach dem URL-Präfix (`/de`, `/en`) oder — bei fehlendem Präfix — nach der Browser-Locale des Nutzers (automatische Weiterleitung).
- **App (authentifizierter Bereich):** Sprache richtet sich nach der im Nutzerprofil gespeicherten Sprachpräferenz.

Alle sichtbaren UI-Strings (Buttons, Labels, Fehlermeldungen, Toasts, Platzhalter, Navigationseinträge etc.) werden aus zentralen Übersetzungsdateien geladen. Benutzerdaten aus Supabase (z. B. Projektname, Beschreibungen) werden nicht übersetzt und bleiben in der Originalsprache des Erstellers.

---

## User Stories

**US-1 — Automatische Sprachauswahl auf der Landingpage**
Als Besucher der Landingpage möchte ich, dass die Seite automatisch in meiner Browser-Sprache angezeigt wird (Deutsch oder Englisch), damit ich keine manuelle Auswahl treffen muss.

**US-2 — URL-basierte Sprachauswahl**
Als Nutzer möchte ich die Sprache der Landingpage über den URL-Pfad steuern können (`/de/...`, `/en/...`), damit ich sprachspezifische Links teilen kann.

**US-3 — Sprachpräferenz im Profil speichern**
Als eingeloggter Nutzer möchte ich meine bevorzugte Sprache in meinem Profil speichern können, damit die App bei jedem Login in meiner gewählten Sprache erscheint.

**US-4 — Language Switcher in der Navbar**
Als Nutzer (eingeloggt oder nicht) möchte ich jederzeit über einen Schalter in der Navbar zwischen Deutsch und Englisch wechseln können.

**US-5 — Vollständige Übersetzung der UI**
Als Nutzer möchte ich, dass alle Texte der Oberfläche — Buttons, Labels, Fehlermeldungen, Toasts, Formulare — in der gewählten Sprache angezeigt werden, ohne dass einzelne Strings auf Englisch oder Deutsch "durchfallen".

**US-6 — Lokalisierte Datums- und Zahlenformatierung**
Als Nutzer möchte ich, dass Datumsangaben und Zahlen dem Format meiner gewählten Sprache entsprechen (z. B. `24.03.2026` auf Deutsch, `Mar 24, 2026` auf Englisch).

**US-7 — SEO-konforme Mehrsprachigkeit**
Als Betreiber möchte ich, dass die Landingpage korrekte `hreflang`-Tags enthält, damit Suchmaschinen die sprachspezifischen Seiten korrekt indexieren.

**US-8 — Graceful Fallback bei fehlenden Übersetzungen**
Als Entwickler möchte ich, dass bei einem fehlenden Übersetzungsschlüssel automatisch auf die deutsche Version zurückgefallen wird, damit keine leeren Strings oder Fehler sichtbar werden.

---

## Akzeptanzkriterien

### Sprach-Routing (Landingpage)

- [ ] URL-Präfixe `/de` und `/en` sind aktiv und zeigen die korrekte Sprachversion
- [ ] Besucher ohne Präfix werden anhand ihrer Browser-Locale automatisch zu `/de` oder `/en` weitergeleitet
- [ ] Nicht unterstützte Locales fallen auf `/de` zurück
- [ ] Die Canonical-URL und `hreflang`-Tags (`de`, `en`, `x-default`) sind im `<head>` jeder Landingpage-Seite vorhanden

### Sprachauswahl (App)

- [ ] Die Sprachpräferenz des Nutzers ist in der Supabase-Tabelle `profiles` als `locale`-Feld gespeichert (Werte: `de`, `en`)
- [ ] Nach Login wird die gespeicherte Sprachpräferenz korrekt geladen und angewendet
- [ ] Ändert der Nutzer die Sprache über den Switcher, wird die Änderung sofort sichtbar und in `profiles.locale` persistiert

### Language Switcher

- [ ] Ein Language Switcher ist in der Navbar der Landingpage sichtbar
- [ ] Ein Language Switcher ist in der Navbar des authentifizierten Bereichs sichtbar
- [ ] Der Switcher zeigt mindestens Deutsch (DE) und Englisch (EN) an
- [ ] Der aktuell aktive Sprachzustand ist im Switcher erkennbar hervorgehoben

### Übersetzungsvollständigkeit

- [ ] Alle UI-Strings sind in Übersetzungsdateien ausgelagert — kein hartkodierter sichtbarer Text im Code (außer Supabase-Nutzdaten)
- [ ] Fehlermeldungen (API-Fehler, Validierungsfehler) sind übersetzt
- [ ] Toast-Nachrichten (Erfolg, Fehler, Info) sind übersetzt
- [ ] Formular-Labels, Platzhalter und Hilfetexte sind übersetzt
- [ ] Navigationseinträge, Seitentitel und Headings sind übersetzt
- [ ] Leere-Zustände (Empty States) und Bestätigungsdialoge sind übersetzt

### Lokalisierung

- [ ] Datumsangaben werden mit der Locale-spezifischen Formatierung ausgegeben
- [ ] Zahlen und ggf. Währungsangaben verwenden das lokale Format
- [ ] `Intl`-APIs oder die i18n-Bibliothek werden für Formatierung genutzt (kein manuelles Formatieren)

### Fallback

- [ ] Fehlt ein Übersetzungsschlüssel in der englischen Datei, wird automatisch der deutsche Wert angezeigt
- [ ] Es erscheint kein leerer String und kein Übersetzungsschlüssel-Rohtext in der UI

### Erweiterbarkeit

- [ ] Eine neue Sprache kann durch Hinzufügen einer neuen JSON-Datei und eines Eintrags in der Sprachkonfiguration ergänzt werden — ohne Änderungen an Komponenten
- [ ] Die Sprachkonfiguration ist an einer zentralen Stelle definiert (z. B. `i18n.config.ts`)

---

## Technische Notizen

### Empfohlene Bibliothek

**next-intl** ist die empfohlene i18n-Bibliothek für Next.js 16 App Router. Sie unterstützt:
- Server Components und Client Components
- Middleware-basiertes Locale-Routing
- Typed translations (mit `createTranslator`)
- `useFormatter` für Datum/Zahlen
- Pluralisierung

Alternativ: **next-i18next** (falls bereits im Projekt vorhanden) oder **i18next** direkt. Entscheidung vor Implementierungsbeginn treffen.

### Dateistruktur (Vorschlag)

```
src/
  i18n/
    config.ts          # Unterstützte Sprachen, Standardsprache
    request.ts         # next-intl: getRequestConfig
  messages/
    de.json            # Deutsche Übersetzungen (Standardsprache)
    en.json            # Englische Übersetzungen
```

### Middleware

Die `middleware.ts` im Projektstamm wird um Locale-Routing erweitert (next-intl `createMiddleware`). Bereits vorhandene Middleware-Logik (Auth-Guards, PROJ-1) muss mit dem i18n-Middleware kombiniert werden — Reihenfolge beachten: Auth vor Locale oder als verkettete Middleware.

### Supabase: `profiles`-Tabelle

Ein neues Feld `locale VARCHAR(5) DEFAULT 'de'` wird in der `profiles`-Tabelle ergänzt. Migration ist Teil der Backend-Implementierung.

### Übersetzungsschlüssel-Konvention

Hierarchische Schlüsselstruktur nach Feature/Bereich, z. B.:

```json
{
  "nav": { "projects": "Projekte", "logout": "Abmelden" },
  "auth": { "loginButton": "Anmelden", "emailLabel": "E-Mail-Adresse" },
  "errors": { "generic": "Ein Fehler ist aufgetreten." }
}
```

### SEO / hreflang

Für die Landingpage werden im `<head>` folgende Tags generiert:

```html
<link rel="alternate" hreflang="de" href="https://link2plan.app/de" />
<link rel="alternate" hreflang="en" href="https://link2plan.app/en" />
<link rel="alternate" hreflang="x-default" href="https://link2plan.app/de" />
```

Dies kann über next-intl's `generateMetadata`-Integration oder manuell in den `layout.tsx`-Dateien erfolgen.

### Nicht übersetzt (explizit ausgeschlossen)

- Projektname, Projektbeschreibung
- Zeichnungsname, Beschreibungen von Zeichnungen
- Namen/E-Mails von Nutzern
- Marker-Beschriftungen (vom Nutzer eingegeben)

---

## Offene Fragen

1. **Bibliothekswahl:** Wird next-intl verwendet oder gibt es bereits eine i18n-Abhängigkeit im Projekt, die berücksichtigt werden muss?

2. **URL-Struktur App:** Gilt das `/de`/`/en`-Präfix auch für den authentifizierten Bereich (`/de/dashboard`, `/en/dashboard`) oder nur für die Landingpage? (Empfehlung: nur Landingpage; App nutzt gespeicherte Präferenz ohne URL-Präfix.)

3. **Erstsprachige Nutzer:** Beim ersten Login (vor dem Setzen der Sprachpräferenz) — soll die Browser-Locale als Initialwert übernommen werden oder immer Deutsch als Standard?

4. **Bestehende Strings:** Wie wird die Migration bestehender hartkodierter Strings aus PROJ-1 bis PROJ-8 organisiert — als Teil von PROJ-12 oder als separate Cleanup-Tasks pro Feature?

5. **RTL-Unterstützung:** Muss die Architektur von Anfang an Right-to-Left-Sprachen (z. B. Arabisch) berücksichtigen, oder ist das explizit kein Ziel für V1?

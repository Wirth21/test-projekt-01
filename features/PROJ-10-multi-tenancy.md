---
id: PROJ-10
title: Multi-Tenancy mit Subdomains
status: In Progress
created: 2026-03-24
---

# PROJ-10: Multi-Tenancy mit Subdomains

## Beschreibung

Jeder Kunde (Organisation/Tenant) erhält eine eigene Subdomain der Form `firmenname.link2plan.app`. Die gesamte Applikation wird mandantenfähig: Projekte, PDFs, Marker und Nutzer sind vollständig nach Tenant isoliert. Der Tenant wird in der Next.js Middleware anhand des `Host`-Headers aufgelöst und steht der gesamten Anwendung zur Verfügung. Die Datenisolation wird auf Datenbankebene durch Supabase Row Level Security (RLS) durchgesetzt.

Die Stammdomain `link2plan.app` (ohne Subdomain) zeigt die öffentliche Landing Page (PROJ-9). Unbekannte oder ungültige Subdomains werden mit einer 404-Seite beantwortet oder leiten auf die Landing Page weiter.

## User Stories

- **Als Organisations-Administrator** möchte ich, dass mein Team über `meinefirma.link2plan.app` auf die Anwendung zugreift, damit unsere Daten klar von anderen Organisationen getrennt sind.
- **Als Nutzer** möchte ich, dass ich nur Projekte, Zeichnungen und Marker meiner eigenen Organisation sehe, damit keine fremden Daten einsehbar sind.
- **Als Nutzer** möchte ich bei Eingabe einer ungültigen Subdomain auf die Landing Page weitergeleitet werden, damit ich nicht auf einer leeren oder fehlerhaften Seite lande.
- **Als Plattform-Betreiber** möchte ich Tenants zentral in einer Datenbanktabelle verwalten (Name, Slug, Plan, Einstellungen), damit neue Kunden einfach angelegt werden können.
- **Als Plattform-Betreiber** möchte ich, dass Subdomain-Slugs eindeutig, kleingeschrieben und nur aus alphanumerischen Zeichen sowie Bindestrichen bestehen, damit DNS-Konflikte und Sicherheitsprobleme vermieden werden.

## Akzeptanzkriterien

### Subdomain-Auflösung
- [ ] Der `Host`-Header wird in der Next.js Middleware ausgelesen und der Subdomain-Slug extrahiert.
- [ ] Der extrahierte Slug wird gegen die `tenants`-Tabelle geprüft.
- [ ] Bei gültigem Slug wird der Tenant-Kontext (z.B. `tenant_id`) als Header oder Cookie an die Anwendung weitergegeben.
- [ ] Bei ungültigem oder unbekanntem Slug antwortet die Middleware mit einem 404 oder leitet auf `link2plan.app` weiter.
- [ ] Der Zugriff auf `link2plan.app` (ohne Subdomain) zeigt die Landing Page und ist nicht an einen Tenant gebunden.

### Datenisolation
- [ ] Jede relevante Tabelle (Projekte, Zeichnungen, Marker, Profile) enthält eine `tenant_id`-Spalte als Fremdschlüssel auf `tenants.id`.
- [ ] RLS-Policies stellen sicher, dass ein authentifizierter Nutzer ausschließlich Datensätze seines eigenen Tenants lesen und schreiben kann.
- [ ] Ein Nutzer kann sich nicht durch direkte API-Aufrufe Zugang zu Daten eines anderen Tenants verschaffen.
- [ ] Neue Datensätze erhalten automatisch die `tenant_id` des angemeldeten Nutzers (via RLS-Policy oder DB-Trigger).

### Tenants-Tabelle
- [ ] Die Tabelle `tenants` existiert mit mindestens folgenden Spalten: `id` (UUID), `name` (text), `slug` (text, unique), `plan` (text), `settings` (jsonb, nullable), `created_at` (timestamptz).
- [ ] Der Slug ist eindeutig, nicht leer und erfüllt das Muster `^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$`.
- [ ] Reservierte Subdomains (`www`, `app`, `api`, `admin`, `mail`, `support`, etc.) sind nicht als Slug verwendbar.

### Nutzer-Zuordnung
- [ ] Die `profiles`-Tabelle enthält eine `tenant_id`-Spalte als Fremdschlüssel auf `tenants.id`.
- [ ] Bei der Nutzerregistrierung bzw. Einladung wird die `tenant_id` korrekt gesetzt.
- [ ] Ein Nutzer gehört zu genau einem Tenant.

### DNS & Infrastruktur
- [ ] Ein Wildcard-DNS-Eintrag `*.link2plan.app` ist beim DNS-Provider eingerichtet und auf die Vercel-Deployment-URL zeigend dokumentiert.
- [ ] Vercel ist so konfiguriert, dass Wildcard-Subdomains akzeptiert werden.

### Fehlerbehandlung
- [ ] Eine dedizierte 404-Seite (`not-found.tsx`) informiert den Nutzer, dass die aufgerufene Organisation nicht gefunden wurde, mit einem Link zur Landing Page.
- [ ] Fehler bei der Tenant-Auflösung werden serverseitig geloggt (ohne sensible Daten).

## Technische Notizen

### Next.js Middleware

Die Tenant-Auflösung erfolgt in `src/middleware.ts`. Der `Host`-Header wird geparst, die Subdomain extrahiert und per `fetch` oder Supabase-Admin-Client gegen die `tenants`-Tabelle geprüft. Der aufgelöste `tenant_id` wird als Request-Header (z.B. `x-tenant-id`) an die Route Handlers und Server Components weitergegeben.

```
Middleware-Ablauf:
1. Host-Header lesen → Subdomain extrahieren
2. Subdomain gegen tenants.slug prüfen (Supabase Admin Client)
3a. Gefunden → x-tenant-id Header setzen, Request weiterleiten
3b. Nicht gefunden → 404-Response oder Redirect auf link2plan.app
4. Root-Domain → direkt weiterleiten (keine Tenant-Prüfung)
```

### Datenbankschema (Erweiterungen)

```sql
-- Neue Tabelle
CREATE TABLE tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  plan       text NOT NULL DEFAULT 'free',
  settings   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Erweiterungen bestehender Tabellen
ALTER TABLE profiles ADD COLUMN tenant_id uuid REFERENCES tenants(id) NOT NULL;
ALTER TABLE projects  ADD COLUMN tenant_id uuid REFERENCES tenants(id) NOT NULL;
-- (analog für drawings, markers, etc.)
```

### RLS-Policies (Beispiel)

```sql
-- Nutzer darf nur Projekte des eigenen Tenants sehen
CREATE POLICY "tenant_isolation_projects" ON projects
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );
```

Analoge Policies für alle tenant-isolierten Tabellen. Service-Role-Key (Backend/Admin-Routen) umgeht RLS und muss mit Bedacht eingesetzt werden.

### Supabase Auth

Supabase Auth bleibt projektübergreifend (eine Auth-Instanz). Die Tenant-Zuordnung erfolgt ausschließlich über die `profiles.tenant_id`-Spalte, nicht über Supabase-Organisationskonzepte.

### Vercel-Konfiguration

In `vercel.json` oder im Vercel-Dashboard muss die Domain `*.link2plan.app` als Wildcard-Domain hinterlegt werden. Lokale Entwicklung kann mit einem Tool wie `localcan` oder manuellen `/etc/hosts`-Einträgen (z.B. `testfirma.localhost`) simuliert werden.

### Reservierte Slugs

Eine Blockliste reservierter Subdomains muss bei der Tenant-Erstellung geprüft werden (Middleware + Backend-Validierung):
`www`, `app`, `api`, `admin`, `mail`, `support`, `help`, `status`, `blog`, `login`, `auth`, `dashboard`

### Zukünftige Erweiterungen (kein MVP-Scope)

- Tenant-spezifisches Branding: Logo-Upload und primäre Akzentfarbe pro Tenant (vorbereitet via `settings`-JSONB-Feld).
- Custom Domains: Eigene Kundendomain zeigt auf den Tenant (erfordert Vercel Pro).
- Tenant-Verwaltungs-UI für Plattform-Admins.

## Offene Fragen

1. **Tenant-Erstellung:** Wie werden neue Tenants angelegt? Manuell durch Plattform-Admins (zunächst via SQL/Admin-UI) oder durch einen Self-Service-Registrierungsflow?
2. **Subdomain-Änderung:** Darf ein Tenant seinen Slug nachträglich ändern? (Empfehlung: nein, da URLs brechen.)
3. **Lokale Entwicklung:** Welches Tool/Vorgehen wird für die lokale Subdomain-Simulation standardisiert? (`*.localhost` mit Caddy, `localcan`, oder manuelle `/etc/hosts`-Einträge?)
4. **Middleware-Caching:** Soll das Tenant-Lookup in der Middleware gecacht werden (z.B. via Edge-Cache oder kurzes In-Memory-TTL), um Latenz zu reduzieren?
5. **Migration bestehender Daten:** Wie werden bestehende Nutzer und Projekte (aus PROJ-1/PROJ-2) einem initialen Tenant zugeordnet?
6. **Plan-Typen:** Welche Plan-Stufen (`free`, `pro`, `enterprise`) sollen initial unterstützt werden und welche Limits gelten jeweils (Anzahl Projekte, Nutzer, Speicher)?

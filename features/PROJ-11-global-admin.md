---
id: PROJ-11
title: Globaler Admin-Bereich
status: Planned
created: 2026-03-24
---

# PROJ-11: Globaler Admin-Bereich

## Beschreibung

Der globale Admin-Bereich ist das Steuerungszentrum der Link2Plan-Plattform für Superadmins des Betreibers. Er ist vollständig getrennt vom tenant-spezifischen Admin-Bereich (PROJ-5), der nur innerhalb einer Tenant-Instanz gilt.

Superadmins können über diesen Bereich alle Tenants (Organisationen) der Plattform verwalten, Abonnementpläne zuweisen, Nutzungs- und Verbrauchsdaten einsehen sowie Support-Funktionen wie Impersonation und Passwort-Reset durchführen.

Der Zugriff erfolgt über eine dedizierte URL (`admin.link2plan.app` oder `link2plan.app/admin`) und ist ausschliesslich Nutzern mit dem Flag `is_superadmin = true` in der `profiles`-Tabelle vorbehalten. Dieses Flag ist unabhängig vom tenant-bezogenen `is_admin`-Flag (PROJ-5).

Grundlage der Multi-Tenant-Architektur ist PROJ-10 (Subdomains, Tenant-Isolation).

---

## User Stories

### Superadmin-Zugang

- **Als Superadmin** möchte ich mich über `admin.link2plan.app` einloggen, damit ich Zugriff auf alle Plattform-Verwaltungsfunktionen habe.
- **Als Superadmin** möchte ich, dass Tenant-Admins (PROJ-5) keinen Zugriff auf diesen Bereich haben, damit die Plattformverwaltung sicher bleibt.

### Dashboard & Übersicht

- **Als Superadmin** möchte ich auf einem Dashboard eine Gesamtübersicht sehen: Anzahl aktiver Tenants, Gesamtanzahl Nutzer, gesamter Speicherverbrauch und (optional) Umsatzkennzahlen.
- **Als Superadmin** möchte ich auf einen Blick erkennen, welche Tenants zuletzt aktiv waren oder Auffälligkeiten aufweisen.

### Tenant-Verwaltung

- **Als Superadmin** möchte ich alle Tenants in einer Liste sehen (Name, Subdomain, Plan, Status, Nutzeranzahl), damit ich einen schnellen Überblick habe.
- **Als Superadmin** möchte ich einen neuen Tenant anlegen (Name, Subdomain, Plan, initialer Admin-Nutzer), damit Neukunden ongeboardet werden können.
- **Als Superadmin** möchte ich einen Tenant bearbeiten (Name, Subdomain ändern), damit Korrekturen möglich sind.
- **Als Superadmin** möchte ich einen Tenant deaktivieren, damit der Zugriff gesperrt wird, ohne Daten zu löschen.
- **Als Superadmin** möchte ich einen Tenant löschen (mit Bestätigungsdialog und Warnung), damit inaktive Test-Tenants entfernt werden können.

### Planverwaltung

- **Als Superadmin** möchte ich jedem Tenant einen Plan zuweisen (Free / Team / Business), damit Funktionsumfang und Limits gesteuert werden.
- **Als Superadmin** möchte ich die Plan-Limits pro Plan definieren oder einsehen (z.B. max. Nutzer, max. Speicher, max. Projekte), damit ich Überläufe erkennen kann.

### Nutzungsübersicht pro Tenant

- **Als Superadmin** möchte ich für jeden Tenant folgende Kennzahlen sehen:
  - Genutzter Speicher (MB/GB)
  - Anzahl Nutzer
  - Anzahl Projekte
  - Anzahl hochgeladener PDFs
- **Als Superadmin** möchte ich erkennen, wenn ein Tenant sein Plan-Limit überschreitet oder sich annähert.

### Nutzer-Verwaltung auf Plattformebene

- **Als Superadmin** möchte ich alle Nutzer eines bestimmten Tenants einsehen (Name, E-Mail, Rolle, letzter Login).
- **Als Superadmin** möchte ich für einen Nutzer ein Passwort-Reset auslösen (per E-Mail), damit ich Support leisten kann.
- **Als Superadmin** möchte ich einen einzelnen Nutzer deaktivieren (plattformweit), damit gesperrte Nutzer keinen Zugriff mehr haben.

### Impersonation (Support-Funktion)

- **Als Superadmin** möchte ich mich als Tenant-Admin einloggen ("Impersonieren"), damit ich Probleme im Kontext des Tenants diagnostizieren kann.
- **Als Superadmin** möchte ich beim Impersonieren einen klar sichtbaren Banner sehen ("Du agierst als [Tenant-Name]"), damit ich nicht versehentlich im falschen Kontext handle.
- **Als Superadmin** möchte ich die Impersonation jederzeit beenden und zum globalen Admin zurückkehren.

### Audit-Log

- **Als Superadmin** möchte ich ein Audit-Log einsehen, das alle relevanten Aktionen protokolliert:
  - Tenant erstellt / bearbeitet / deaktiviert / gelöscht
  - Plan geändert
  - Nutzer deaktiviert / Passwort zurückgesetzt
  - Impersonation gestartet / beendet
- **Als Superadmin** möchte ich das Log nach Datum, Aktion und betroffenem Tenant filtern.

---

## Akzeptanzkriterien

### Zugang & Sicherheit

- [ ] Der globale Admin-Bereich ist nur über eine dedizierte Route erreichbar (`/admin` oder Subdomain `admin.link2plan.app`).
- [ ] Nur Nutzer mit `is_superadmin = true` in der `profiles`-Tabelle erhalten Zugang; alle anderen erhalten HTTP 403.
- [ ] Tenant-Admins (`is_admin = true`, PROJ-5) haben keinen Zugang zum globalen Admin-Bereich.
- [ ] Die Superadmin-Session ist von der normalen Tenant-Session getrennt.

### Dashboard

- [ ] Das Dashboard zeigt: Gesamtanzahl Tenants (aktiv/inaktiv), Gesamtnutzer, Gesamtspeicher, Anzahl PDFs.
- [ ] Die Kennzahlen werden in Echtzeit oder mit maximal 5 Minuten Verzögerung aktualisiert.

### Tenant-Verwaltung

- [ ] Superadmin kann neuen Tenant anlegen: Name, Subdomain (unique, lowercase, alphanumerisch), Plan, E-Mail des initialen Admins.
- [ ] Das System legt automatisch den initialen Admin-Nutzer an und sendet eine Einladungs-E-Mail.
- [ ] Subdomain-Konflikte werden beim Anlegen validiert und abgelehnt.
- [ ] Tenant deaktivieren sperrt alle Logins für diesen Tenant sofort.
- [ ] Tenant löschen erfordert eine explizite Bestätigung (z.B. Eingabe des Tenant-Namens) und ist irreversibel.

### Planverwaltung

- [ ] Superadmin kann den Plan eines Tenants in der Detailansicht ändern; die Änderung ist sofort wirksam.
- [ ] Plan-Limits (max. Nutzer, max. Speicher, max. Projekte) sind pro Plan konfiguriert und werden beim Tenant angezeigt.

### Nutzungsdaten

- [ ] Pro Tenant werden Speicherverbrauch, Nutzeranzahl, Projektanzahl und PDF-Anzahl angezeigt.
- [ ] Ein visueller Indikator zeigt an, wenn ein Tenant > 80 % seines Plan-Limits erreicht hat.

### Nutzerverwaltung

- [ ] Nutzerliste pro Tenant zeigt: Name, E-Mail, Rolle, letzter Login, Status (aktiv/deaktiviert).
- [ ] Passwort-Reset löst eine E-Mail über Supabase Auth aus.
- [ ] Nutzer deaktivieren sperrt den Login plattformweit (Supabase Auth: `banned`-Status oder äquivalent).

### Impersonation

- [ ] Superadmin kann einen Tenant-Admin aus der Nutzerliste impersonieren.
- [ ] Während der Impersonation ist ein permanenter Banner sichtbar mit Tenant-Name und "Impersonation beenden"-Button.
- [ ] Alle im Impersonation-Modus durchgeführten Aktionen werden im Audit-Log als "Superadmin X als Tenant-Admin Y" verzeichnet.
- [ ] Nach Beenden der Impersonation kehrt der Superadmin zur globalen Admin-Ansicht zurück.

### Audit-Log

- [ ] Alle definierten Aktionen (Tenant CRUD, Plan-Änderung, Nutzer-Aktionen, Impersonation) werden im Audit-Log gespeichert.
- [ ] Jeder Log-Eintrag enthält: Zeitstempel, ausführender Superadmin, Aktion, betroffener Tenant/Nutzer, Details.
- [ ] Das Log ist filterbar nach: Zeitraum, Aktionstyp, Tenant.
- [ ] Log-Einträge sind nicht löschbar (append-only).

---

## Technische Notizen

### Routing & Middleware

- Der Bereich ist erreichbar unter `link2plan.app/admin` (Fallback) oder als eigene Subdomain `admin.link2plan.app`.
- Die Next.js Middleware prüft `is_superadmin` aus dem JWT-Claims oder `profiles`-Tabelle und leitet Nicht-Superadmins zu `/403` weiter.
- Separate Next.js Route Group `(admin)` mit eigenem Layout, das den Superadmin-Kontext bereitstellt.

### Datenbankschema (Erweiterungen)

```sql
-- Superadmin-Flag (getrennt von is_admin für Tenant-Admins)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;

-- Audit-Log-Tabelle
CREATE TABLE global_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  superadmin_id UUID NOT NULL REFERENCES profiles(id),
  action        TEXT NOT NULL,           -- z.B. 'tenant.created', 'plan.changed', 'impersonation.started'
  tenant_id     UUID REFERENCES tenants(id),
  target_user_id UUID REFERENCES profiles(id),
  details       JSONB,                   -- Freitext-Details zur Aktion
  impersonating_as UUID REFERENCES profiles(id)  -- gesetzt wenn Aktion im Impersonation-Modus
);

-- Keine RLS für Superadmins — Zugriff nur über Service Role Key im Backend
-- Audit-Log ist append-only (kein DELETE, kein UPDATE via RLS)
```

### Plan-Konfiguration

- Pläne (`Free`, `Team`, `Business`) sind als Enum oder Lookup-Tabelle in der Datenbank definiert.
- Limits pro Plan werden in einer `plans`-Tabelle oder `config`-Tabelle hinterlegt (max_users, max_storage_mb, max_projects).
- Tenant-Nutzungsdaten werden aus den bestehenden Tabellen aggregiert (Storage: Supabase Storage API, Nutzer: `profiles`, Projekte: `projects`, PDFs: `drawings`).

### Impersonation

- Impersonation erfolgt serverseitig: Der Superadmin erhält ein kurzlebiges Token (z.B. via Supabase Admin API oder custom JWT) das den Tenant-Admin repräsentiert.
- Alternativ: Session-Cookie mit `impersonating_as`-Feld, das in allen API-Anfragen mitgeführt wird.
- Alle Aktionen im Impersonation-Modus werden mit `impersonating_as`-Referenz im Audit-Log verzeichnet.

### API-Routen

- `GET/POST /api/admin/tenants` — Tenant-Liste, neuen Tenant anlegen
- `GET/PATCH/DELETE /api/admin/tenants/[id]` — Tenant-Details, bearbeiten, löschen
- `PATCH /api/admin/tenants/[id]/plan` — Plan zuweisen
- `PATCH /api/admin/tenants/[id]/status` — Tenant deaktivieren/aktivieren
- `GET /api/admin/tenants/[id]/users` — Nutzerliste eines Tenants
- `POST /api/admin/users/[id]/reset-password` — Passwort-Reset auslösen
- `PATCH /api/admin/users/[id]/status` — Nutzer deaktivieren
- `POST /api/admin/impersonate` — Impersonation starten
- `DELETE /api/admin/impersonate` — Impersonation beenden
- `GET /api/admin/audit-log` — Audit-Log abrufen
- `GET /api/admin/dashboard` — Plattform-Kennzahlen

Alle Routen werden durch Middleware auf `is_superadmin` geprüft und verwenden den Supabase Service Role Key (nie den anon Key).

### UI-Komponenten

- Eigenes Admin-Layout (`src/app/(admin)/layout.tsx`) mit Superadmin-Navigation.
- Impersonation-Banner als fester Sticky-Header (z.B. gelber Hintergrund, deutlich sichtbar).
- Daten-Tabellen via shadcn/ui `<Table>` mit Pagination und Filterung.
- Bestätigungsdialoge für destruktive Aktionen (Löschen, Deaktivieren) via shadcn/ui `<AlertDialog>`.

---

## Offene Fragen

1. **Subdomain vs. Pfad:** Wird `admin.link2plan.app` als eigene Subdomain betrieben oder reicht `link2plan.app/admin`? Die Subdomain erfordert zusätzliche DNS- und Middleware-Konfiguration in PROJ-10.

2. **Impersonation-Methode:** Supabase bietet keine native Impersonation. Soll ein kurzlebiger Custom-JWT verwendet werden, oder wird der Zustand rein clientseitig in der Session gehalten (mit serverseitiger Validierung)?

3. **Umsatz-Dashboard:** Soll der Revenue-Überblick in MVP integriert werden, oder ist er ein separates Feature (z.B. Stripe-Integration)?

4. **Plan-Konfiguration:** Werden Plan-Limits hart im Code definiert oder über eine Admin-UI konfigurierbar gemacht?

5. **Audit-Log-Retention:** Wie lange werden Audit-Log-Einträge aufbewahrt? Gibt es eine Archivierungsstrategie für ältere Einträge?

6. **Superadmin-Onboarding:** Wie wird der erste Superadmin-Account angelegt? (Datenbankskript, Bootstrap-Route, manuell via Supabase Dashboard?)

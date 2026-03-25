---
id: PROJ-13
title: Speicherbegrenzung & PDF-Limits
status: In Review
created: 2026-03-24
---

# PROJ-13: Speicherbegrenzung & PDF-Limits

## Beschreibung

Jeder Tenant (Team/Organisation) in Link2Plan unterliegt plan-abhängigen Speicher- und Nutzungslimits. Diese Limits kontrollieren die Infrastrukturkosten und bilden die Grundlage des SaaS-Preismodells. Die Grenzen betreffen Gesamtspeicher, maximale PDF-Dateigröße, Anzahl der Nutzer sowie Anzahl der Projekte pro Tenant.

### Tarife im Überblick

| Plan       | Max Speicher | Max PDF-Größe | Max Nutzer  | Max Projekte |
|------------|-------------|---------------|-------------|-------------|
| Free       | 500 MB      | 20 MB/Datei   | 2           | 1           |
| Team       | 10 GB       | 50 MB/Datei   | 10          | 10          |
| Business   | 100 GB      | 100 MB/Datei  | 50          | Unbegrenzt  |
| Enterprise | Individuell | 200 MB/Datei  | Unbegrenzt  | Unbegrenzt  |

Limits werden serverseitig durchgesetzt und sind nicht durch den Nutzer umgehbar. Admins (PROJ-11) können einzelne Limits für spezifische Tenants manuell überschreiben.

---

## User Stories

**US-1 – Datei-Upload mit Limit-Prüfung**
Als Nutzer möchte ich beim Hochladen einer PDF sofort eine verständliche Fehlermeldung erhalten, wenn die Datei zu groß ist oder mein Speicherkontingent erschöpft ist, damit ich weiß, was ich tun muss.

**US-2 – Speicheranzeige im Dashboard**
Als Tenant-Administrator möchte ich im Dashboard meinen aktuellen Speicherverbrauch als Fortschrittsbalken sehen (z.B. „5,2 GB / 10 GB verwendet"), damit ich den Verbrauch im Blick behalte.

**US-3 – Warnmeldung bei hohem Verbrauch**
Als Tenant-Administrator möchte ich eine Warnung erhalten, wenn mein Speicher zu 80 % ausgeschöpft ist, damit ich rechtzeitig reagieren oder upgraden kann.

**US-4 – Harte Sperre bei vollem Speicher**
Als Nutzer möchte ich eine klare Fehlermeldung sehen, wenn der Speicher zu 100 % voll ist, und einen direkten Hinweis auf einen Upgrade, damit ich die nächsten Schritte kenne.

**US-5 – Projekt-Limit**
Als Nutzer möchte ich informiert werden, wenn ich die maximale Projektanzahl meines Tarifs erreicht habe, bevor ich ein neues Projekt anlegen möchte.

**US-6 – Nutzer-Limit**
Als Tenant-Administrator möchte ich beim Einladen neuer Nutzer eine Meldung erhalten, wenn das Nutzer-Limit meines Tarifs erreicht ist.

**US-7 – Admin-Override**
Als Super-Admin (PROJ-11) möchte ich für einzelne Tenants Limits manuell anpassen können (z.B. Enterprise-Sonderkonditionen), ohne den Plan zu wechseln.

**US-8 – Nur PDF erlaubt**
Als Nutzer möchte ich beim Upload einer Nicht-PDF-Datei sofort eine klare Fehlermeldung erhalten, damit keine unzulässigen Dateitypen hochgeladen werden.

---

## Akzeptanzkriterien

### Upload-Validierung
- [ ] Client-seitige Prüfung der Dateigröße vor dem Upload (kein Request an den Server bei Überschreitung)
- [ ] Server-seitige Prüfung der Dateigröße als zweite Verteidigungslinie (Supabase Storage Policy + API-Endpunkt)
- [ ] Nur Dateien mit MIME-Type `application/pdf` werden akzeptiert (Client + Server)
- [ ] Bei Überschreitung der max. Dateigröße: Fehlermeldung mit aktuellem Limit des Tarifs
- [ ] Bei vollem Gesamtspeicher: Fehlermeldung mit Hinweis auf Upgrade

### Speicher-Tracking
- [ ] Speicherverbrauch wird pro Tenant in Echtzeit oder near-real-time erfasst (Tabelle `tenant_usage` oder Berechnung aus Supabase Storage)
- [ ] Versionierte PDFs (PROJ-7) zählen vollständig zum Gesamtspeicher des Tenants
- [ ] Archivierte Projekte und Zeichnungen (PROJ-6) zählen weiterhin zum Gesamtspeicher
- [ ] Speicherverbrauch wird beim Löschen (Archivieren) entsprechend aktualisiert

### Dashboard-Anzeige
- [ ] Fortschrittsbalken zeigt „X GB / Y GB verwendet" im Tenant-Dashboard
- [ ] Ab 80 % Auslastung: gelbe Warnanzeige mit Text „Ihr Speicher ist zu 80 % voll. Erwägen Sie ein Upgrade."
- [ ] Ab 100 % Auslastung: rote Anzeige, Upload-Button deaktiviert, Hinweis auf Upgrade

### Limit-Durchsetzung
- [ ] Upload-API prüft vor dem Speichern: Gesamtspeicher-Limit und Dateigrößen-Limit
- [ ] Projekt-Erstellungs-API prüft: Projektanzahl-Limit des Tarifs
- [ ] Nutzer-Einladungs-API prüft: Nutzeranzahl-Limit des Tarifs
- [ ] Alle Prüfungen greifen auch bei direktem API-Zugriff (kein Bypass über Frontend möglich)
- [ ] Supabase RLS-Policies als zusätzliche Absicherung

### Admin-Override
- [ ] Super-Admins (PROJ-11) können in der Admin-Oberfläche pro Tenant individuelle Limits setzen
- [ ] Individuelle Limits überschreiben die Plan-Defaults
- [ ] Overrides werden in der Datenbank persistiert und sind nachvollziehbar (wer hat wann was geändert)

### Fehlermeldungen & UX
- [ ] Alle Fehlermeldungen sind auf Deutsch und handlungsorientiert (was soll der Nutzer tun?)
- [ ] Bei Limit-Erreichen wird der passende Upgrade-Pfad angezeigt (Verweis auf Preisseite oder Upgrade-Dialog)
- [ ] Fehlermeldungen unterscheiden klar zwischen: Datei zu groß, Speicher voll, falscher Dateityp, Projektlimit, Nutzerlimit

---

## Technische Notizen

### Datenbankschema

**Tabelle `tenant_usage`** (oder als View über Supabase Storage berechnet):
```sql
CREATE TABLE tenant_usage (
  tenant_id     UUID PRIMARY KEY REFERENCES tenants(id),
  storage_bytes BIGINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Tabelle `tenant_plan_overrides`** (für Admin-Overrides):
```sql
CREATE TABLE tenant_plan_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  max_storage_bytes BIGINT,           -- NULL = Plan-Default verwenden
  max_file_bytes    BIGINT,
  max_users         INT,
  max_projects      INT,
  override_by       UUID REFERENCES users(id),
  override_at       TIMESTAMP WITH TIME ZONE DEFAULT now(),
  note              TEXT
);
```

### Limit-Definitionen (plan_limits)
Plan-Limits werden als Konstanten im Code oder in einer `plan_limits`-Tabelle gepflegt:

| Plan       | storage_bytes    | max_file_bytes | max_users | max_projects |
|------------|-----------------|----------------|-----------|-------------|
| free       | 524_288_000     | 20_971_520     | 2         | 1           |
| team       | 10_737_418_240  | 52_428_800     | 10        | 10          |
| business   | 107_374_182_400 | 104_857_600    | 50        | NULL        |
| enterprise | NULL (custom)   | 209_715_200    | NULL      | NULL        |

### API-Endpunkte (Erweiterungen)

- `POST /api/drawings/upload` — Prüft Dateigröße + Gesamtspeicher vor Upload
- `POST /api/projects` — Prüft Projektanzahl-Limit
- `POST /api/tenants/[id]/members/invite` — Prüft Nutzeranzahl-Limit
- `GET /api/tenants/[id]/usage` — Gibt aktuellen Verbrauch zurück (für Dashboard)

### Client-seitige Prüfung
```ts
// Beispiel: Dateigröße vor Upload prüfen
const MAX_FILE_SIZE = planLimits[tenant.plan].max_file_bytes;
if (file.size > MAX_FILE_SIZE) {
  toast.error(`Die Datei überschreitet das Limit von ${formatBytes(MAX_FILE_SIZE)} für Ihren Tarif.`);
  return;
}
```

### Supabase Storage Policy
Supabase Storage Policies können als erste Linie Uploads blockieren, die die maximale Dateigröße überschreiten. Die Gesamtspeicher-Prüfung muss serverseitig in der API erfolgen, da Supabase Storage keine tenant-weite Aggregation nativ unterstützt.

### Abhängigkeiten
- **PROJ-6 (Archivierung):** Archivierte Projekte/Zeichnungen zählen weiterhin zum Speicher.
- **PROJ-7 (PDF-Versionierung):** Jede Version einer PDF zählt separat zum Speicher.
- **PROJ-11 (Admin-Bereich / Multi-Tenancy):** Admin-Override setzt PROJ-11 voraus (tenant_id, plan-Zuordnung).

---

## Offene Fragen

1. **Speicher-Tracking-Strategie:** Wird `tenant_usage` bei jedem Upload/Löschen per Trigger aktualisiert, oder wird der Verbrauch bei Bedarf aus Supabase Storage berechnet? (Trigger ist performanter für Dashboard, Berechnung ist genauer aber langsamer.)

2. **Enterprise-Limits:** Wie werden individuelle Enterprise-Kontingente initial gesetzt? Über das Admin-Interface (PROJ-11) oder direkt in der Datenbank durch einen Super-Admin?

3. **Speicher-Berechnung bei Versionen:** Zählt nur die aktuelle Version oder alle Versionen einer PDF? (Empfehlung: alle Versionen zählen, da sie Speicherplatz belegen.)

4. **Upgrade-Flow:** Gibt es in V1 einen Self-Service-Upgrade (z.B. Stripe-Integration), oder ist Upgrade nur per Kontaktaufnahme möglich?

5. **Grandfathering:** Was passiert, wenn ein Tenant nach einem Downgrade über dem neuen Limit liegt? Wird der Upload gesperrt, aber vorhandene Daten bleiben erhalten?

6. **Quota-Reset:** Gibt es ein monatliches Reset-Intervall für irgendwelche Limits, oder sind alle Limits dauerhaft (nicht zeitgebunden)?

---
id: PROJ-14
title: Monetarisierung & Stripe-Integration
status: Planned
created: 2026-03-24
---

# PROJ-14: Monetarisierung & Stripe-Integration

## Beschreibung

Link2Plan wird als SaaS-Produkt mit abgestuften Abonnementplänen angeboten. Die Zahlungsabwicklung erfolgt vollständig über Stripe (PCI-konformes Hosted Checkout). Abonnementstatus und Plan-Limits werden in Echtzeit per Webhook mit Supabase synchronisiert. Die Integration entspricht den Anforderungen der DSGVO und dem deutschen Steuerrecht (Umsatzsteuer / Kleinunternehmerregelung, EU-Mehrwertsteuer via Stripe Tax).

---

## Preismodell

| Plan | Preis (monatlich) | Preis (jährlich) | Zielgruppe |
|---|---|---|---|
| Free | 0 EUR | 0 EUR | Einzelpersonen, Ausprobieren |
| Team | 39 EUR/Monat | ~390 EUR/Jahr (~2 Monate gratis) | Kleine Teams |
| Business | 119 EUR/Monat | ~1.190 EUR/Jahr (~2 Monate gratis) | Grosse Teams / Bueros |
| Enterprise | auf Anfrage | auf Anfrage | Konzerne, individuelle SLAs |

- Jahreszahlung: ca. 2 Monate gratis (entspricht ~16,7 % Rabatt)
- Testphase: 14 Tage kostenlos fuer Team- und Business-Plan (kreditkartenpflichtig, kein Charge waehrend Trial)
- Enterprise: kein Self-Service, Kontaktformular / direktes Sales-Gespraech

---

## User Stories

### Abonnement abschliessen

- Als neuer Nutzer moechte ich einen kostenlosen 14-Tage-Test des Team-Plans starten, ohne sofort zahlen zu muessen, damit ich die Funktionen in Ruhe testen kann.
- Als Nutzer moechte ich ueber einen gehosteten Stripe-Checkout sicher bezahlen, ohne meine Zahlungsdaten direkt an Link2Plan zu uebermitteln.
- Als Nutzer moechte ich zwischen monatlicher und jaehrlicher Zahlung waehlen, um vom Jahresrabatt zu profitieren.

### Abonnement verwalten

- Als Nutzer moechte ich mein Abonnement selbst im Stripe Customer Portal verwalten (Plan wechseln, Zahlungsmethode aktualisieren, Rechnungen herunterladen, kuendigen), ohne den Support kontaktieren zu muessen.
- Als Nutzer moechte ich nach einer Kuendigung bis zum Ende der bezahlten Periode weiterhin vollen Zugriff haben.
- Als Nutzer moechte ich bei einem Upgrade sofort auf den neuen Plan hochgestuft werden (anteilige Abrechnung durch Stripe).
- Als Nutzer moechte ich bei einem Downgrade am Ende der aktuellen Abrechnungsperiode auf den guenstigeren Plan wechseln. Wenn meine aktuelle Nutzung die Limits des neuen Plans ueberschreitet, werde ich rechtzeitig informiert (siehe PROJ-13).

### Zahlungsprobleme

- Als Nutzer moechte ich bei fehlgeschlagener Zahlung per E-Mail benachrichtigt werden, damit ich meine Zahlungsdaten aktualisieren kann.
- Als Nutzer moechte ich eine Gnadenfrist erhalten, bevor mein Account auf Free downgegradet wird.

### Rechnungen & Steuern

- Als Nutzer moechte ich DSGVO-konforme Rechnungen mit korrekter Mehrwertsteuerausweisung erhalten.
- Als Nutzer aus einem EU-Land moechte ich meine USt-IdNr. hinterlegen koennen, damit bei B2B-Transaktionen das Reverse-Charge-Verfahren angewendet wird.

---

## Akzeptanzkriterien

### Stripe Checkout & Produktkonfiguration

- [ ] Stripe Products und Prices sind im Stripe Dashboard konfiguriert (je Plan: monatliche und jaehrliche Price-ID)
- [ ] Stripe Tax ist aktiviert fuer automatische EU-Mehrwertsteuerberechnung
- [ ] Checkout-Session wird server-seitig erstellt (API-Route), niemals client-seitig
- [ ] Checkout enthaelt `client_reference_id` = Tenant-ID fuer sicheres Mapping nach Abschluss
- [ ] Trial-Periode von 14 Tagen ist in den Stripe Prices fuer Team und Business konfiguriert
- [ ] Nach erfolgreichem Checkout wird der Nutzer auf eine Erfolgsseite weitergeleitet (`/settings/billing?success=true`)
- [ ] Bei Abbruch wird der Nutzer auf `/settings/billing?canceled=true` weitergeleitet

### Stripe Customer Portal

- [ ] Customer-Portal-Link wird server-seitig generiert (API-Route `/api/stripe/portal`)
- [ ] Im Portal sind erlaubt: Plan-Wechsel, Zahlungsmethode aendern, Kuendigung, Rechnungsdownload
- [ ] Im Portal ist die Rueck-URL konfiguriert (`/settings/billing`)

### Webhook-Verarbeitung

Endpunkt: `POST /api/stripe/webhook`

Verarbeitete Events:

| Event | Aktion |
|---|---|
| `checkout.session.completed` | Tenant: `stripe_customer_id`, `stripe_subscription_id`, `plan`, `status = active` setzen |
| `customer.subscription.updated` | Tenant: `plan`, `status`, `current_period_end` aktualisieren |
| `customer.subscription.deleted` | Tenant: `status = canceled`, nach `current_period_end` Downgrade auf Free |
| `invoice.payment_failed` | Tenant: `status = past_due` setzen, Retry-Zaehler erhoehen |

- [ ] Webhook-Signatur wird mit `stripe.webhooks.constructEvent` verifiziert (kein ungesicherter Endpunkt)
- [ ] Idempotenz: wiederholte Events fuehren zu keinen Doppel-Updates (Event-ID pruefen oder upsert)
- [ ] Bei `payment_failed`: nach 3 Stripe-Retries und Ablauf der Gnadenfrist (7 Tage) wird Tenant auf Free downgegradet
- [ ] Alle Webhook-Events werden geloggt (Tabelle `stripe_webhook_events` mit `event_id`, `type`, `processed_at`, `payload`)

### Datenbankschema (Erweiterung `tenants`-Tabelle)

Neue Spalten in der bestehenden `tenants`-Tabelle:

```sql
stripe_customer_id        TEXT UNIQUE,
stripe_subscription_id    TEXT UNIQUE,
plan                      TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'team' | 'business' | 'enterprise'
billing_interval          TEXT,                           -- 'month' | 'year'
subscription_status       TEXT,                           -- 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
trial_ends_at             TIMESTAMPTZ,
current_period_end        TIMESTAMPTZ,
cancel_at_period_end      BOOLEAN DEFAULT false
```

- [ ] RLS-Policies: `stripe_customer_id` und `stripe_subscription_id` sind nur fuer Super-Admins und Server-seitige Routen (Service-Role-Key) lesbar, nicht fuer normale Nutzer
- [ ] Plan-Limits werden ueber PROJ-13 enforced (dieses Feature liefert nur den `plan`-Wert)

### Rechnungen & deutsches Steuerrecht

- [ ] Stripe Tax aktiviert: automatische Steuerberechnung fuer EU-Laender
- [ ] Checkout enthaelt Feld fuer USt-IdNr. (B2B Reverse Charge)
- [ ] Stripe ist so konfiguriert, dass Rechnungen folgende Pflichtangaben enthalten:
  - Vollstaendiger Name / Firmenname und Adresse des Rechnungsempfaengers
  - Vollstaendiger Name / Firmenname und Adresse des Rechnungsstellers (Link2Plan / Betreibergesellschaft)
  - Rechnungsdatum und Rechnungsnummer
  - Leistungsbeschreibung (z.B. "Link2Plan Team Plan - Monatliches Abonnement")
  - Nettobetrag, Steuersatz, Steuerbetrag, Bruttobetrag
  - USt-IdNr. des Rechnungsstellers
  - Hinweis auf Kleinunternehmerregelung (§ 19 UStG), falls zutreffend
- [ ] Rechnungen sind als PDF ueber das Stripe Customer Portal abrufbar

### Upgrade / Downgrade / Kuendigung

- [ ] Upgrade: sofort wirksam, Preisdifferenz wird anteilig von Stripe berechnet
- [ ] Downgrade: wird fuer das Ende der aktuellen Periode geplant (`cancel_at_period_end`-Logik auf Subscription-Item-Ebene)
- [ ] Vor einem Downgrade: Pruefung ob aktuelle Nutzung (Projekte, Nutzer, Speicher) in die neuen Limits passt (Integration mit PROJ-13); Nutzer erhaelt Warnmeldung falls nicht
- [ ] Kuendigung: Zugriff bleibt bis `current_period_end` erhalten, danach automatischer Wechsel auf Free
- [ ] Reaktivierung: Nutzer kann jederzeit ein neues Abonnement abschliessen

### UI / Frontend

- [ ] Seite `/settings/billing` zeigt aktuellen Plan, Status, naechstes Abrechnungsdatum, Trial-Restlaufzeit
- [ ] "Upgrade"-Button oeffnet Stripe Checkout (server-seitig generierter Link)
- [ ] "Abonnement verwalten"-Button oeffnet Stripe Customer Portal (server-seitig generierter Link)
- [ ] Erfolgs- und Fehlermeldungen nach Checkout-Rueckkehr
- [ ] Preistabelle auf Marketing-/Onboarding-Seite zeigt alle Plaene mit Features und CTA

### DSGVO & rechtliche Anforderungen

- [ ] Stripe Data Processing Agreement (DPA) ist unterzeichnet und archiviert
- [ ] Datenschutzerklaerung erwaehnt Stripe als Auftragsverarbeiter (Art. 13 DSGVO)
- [ ] Stripe-Daten werden ausschliesslich auf EU-Servern verarbeitet (Stripe EU-Entitaet verwenden) oder SCCs sind dokumentiert
- [ ] Rechtliche Seiten vorhanden (oder verlinkt):
  - AGB (Allgemeine Geschaeftsbedingungen)
  - Widerrufsbelehrung (relevant fuer B2C; bei reinem B2B-Fokus optional, aber empfohlen)
  - Datenschutzerklaerung (aktualisiert um Stripe-Abschnitt)
  - Impressum

---

## Technische Notizen

### Bibliotheken

```
stripe          # Offizielles Stripe Node.js SDK (server-seitig)
@stripe/stripe-js  # Nur falls Stripe Elements verwendet werden (nicht bei Hosted Checkout noetig)
```

### Umgebungsvariablen

```
STRIPE_SECRET_KEY              # sk_live_... / sk_test_...
STRIPE_WEBHOOK_SECRET          # whsec_... (aus Stripe Dashboard)
STRIPE_PRICE_TEAM_MONTHLY      # price_...
STRIPE_PRICE_TEAM_YEARLY       # price_...
STRIPE_PRICE_BUSINESS_MONTHLY  # price_...
STRIPE_PRICE_BUSINESS_YEARLY   # price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  # pk_live_... (nur fuer Client, falls Stripe.js benoetigt)
```

### API-Routen

| Route | Methode | Beschreibung |
|---|---|---|
| `/api/stripe/checkout` | POST | Erstellt Stripe Checkout Session, gibt `url` zurueck |
| `/api/stripe/portal` | POST | Erstellt Customer Portal Session, gibt `url` zurueck |
| `/api/stripe/webhook` | POST | Empfaengt und verarbeitet Stripe Webhook Events |

### Sicherheit

- Alle Stripe-API-Aufrufe nur server-seitig (API-Routes / Server Actions), niemals im Client-Bundle
- `STRIPE_SECRET_KEY` ist ausschliesslich eine serverseitige Umgebungsvariable
- Webhook-Endpunkt prueft Signatur mit `stripe.webhooks.constructEvent` vor jeder Verarbeitung
- Service-Role-Key fuer Supabase-Updates im Webhook-Handler (umgeht RLS)

### Abhängigkeiten zu anderen Features

- **PROJ-13** (Plan-Limits & Usage Enforcement): PROJ-14 liefert den `plan`-Wert im Tenant; PROJ-13 liest diesen und enforced Limits
- **PROJ-1** (Auth): Tenant-ID muss beim Checkout-Start bekannt sein (eingeloggter Nutzer)
- **PROJ-2** (Projektverwaltung): Projekt-Erstellung wird durch Plan-Limits (PROJ-13) eingeschraenkt

### Stripe-Konfiguration (Dashboard)

- Products: "Link2Plan Team", "Link2Plan Business"
- Prices: je 4 Prices (monatlich / jaehrlich, je Team / Business) mit Trial-Period-Einstellung
- Customer Portal: aktivieren, erlaubte Aktionen konfigurieren
- Stripe Tax: aktivieren, Steuerregistrierung hinterlegen
- Webhooks: Endpunkt registrieren, relevante Events auswaehlen

---

## Offene Fragen

1. **Betreibergesellschaft / Rechtsform:** Unter welcher Firma wird Stripe betrieben? (GmbH, Einzelunternehmen?) Relevant fuer Rechnungspflichtangaben und Kleinunternehmerregelung (§ 19 UStG).
2. **Kleinunternehmerregelung:** Greift § 19 UStG (kein Umsatzsteuerausweis), oder wird regulaer Umsatzsteuer ausgewiesen? Entscheidet, wie Stripe Tax konfiguriert wird.
3. **B2B vs. B2C:** Richtet sich Link2Plan primaer an Unternehmen (B2B)? Falls ja, vereinfacht das die Widerrufsbelehrungspflicht erheblich.
4. **Enterprise-Prozess:** Wie soll der Enterprise-Kaufprozess abgewickelt werden? (Manuell per Invoice in Stripe? Externer Vertrag?) Scope fuer PROJ-14 oder separates Feature?
5. **Waehrung:** Nur EUR, oder auch CHF / GBP fuer Nachbarmaerkte?
6. **Bestandsnutzer bei Plan-Einfuehrung:** Falls die App bereits Nutzer hat, wie wird der Uebergang gehandhabt? (Grandfathering, Stichtag?)
7. **Stripe-Entitaet:** Wird Stripe Inc. (USA) oder Stripe Payments Europe Ltd. (Irland) verwendet? Relevant fuer DSGVO-Konformitaet ohne SCCs.

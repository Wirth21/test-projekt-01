import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
};

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Button variant="ghost" size="sm" asChild className="mb-8">
          <Link href="/">&larr; Zurück zur Startseite</Link>
        </Button>

        <h1 className="text-3xl font-bold mb-8">Datenschutzerklärung</h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              1. Datenschutz auf einen Blick
            </h2>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Allgemeine Hinweise
            </h3>
            <p>
              Die folgenden Hinweise geben einen einfachen Überblick darüber,
              was mit Ihren personenbezogenen Daten passiert, wenn Sie diese
              Website nutzen. Personenbezogene Daten sind alle Daten, mit denen
              Sie persönlich identifiziert werden können.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              2. Verantwortliche Stelle
            </h2>
            <p>
              Wirth Tec GmbH
              <br />
              Christian-Wehner-Straße 10
              <br />
              09113 Chemnitz
              <br />
              E-Mail: info@link2plan.de
            </p>
            <p>
              Verantwortliche Stelle ist die natürliche oder juristische Person,
              die allein oder gemeinsam mit anderen über die Zwecke und Mittel
              der Verarbeitung von personenbezogenen Daten entscheidet.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              3. Datenerfassung auf dieser Website
            </h2>

            <h3 className="text-lg font-medium text-foreground mb-2">
              Cookies
            </h3>
            <p>
              Diese Website verwendet Cookies. Dabei handelt es sich um
              technisch notwendige Cookies für die Authentifizierung und
              Spracheinstellungen. Es werden keine Tracking- oder
              Werbe-Cookies eingesetzt.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Authentifizierungs-Cookies:</strong> Für die
                Anmeldung und Sitzungsverwaltung (Supabase Auth). Laufzeit:
                Sitzung.
              </li>
              <li>
                <strong>Spracheinstellung:</strong> Speichert die gewählte
                Sprache (DE/EN). Laufzeit: 1 Jahr.
              </li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-2 mt-4">
              Server-Log-Dateien
            </h3>
            <p>
              Der Provider der Seiten erhebt und speichert automatisch
              Informationen in sogenannten Server-Log-Dateien, die Ihr Browser
              automatisch übermittelt. Dies sind: Browsertyp und -version,
              verwendetes Betriebssystem, Referrer URL, Hostname des
              zugreifenden Rechners, Uhrzeit der Serveranfrage, IP-Adresse.
            </p>

            <h3 className="text-lg font-medium text-foreground mb-2 mt-4">
              Registrierung und Nutzerkonto
            </h3>
            <p>
              Bei der Registrierung erfassen wir: E-Mail-Adresse, Passwort
              (verschlüsselt gespeichert), Anzeigename. Diese Daten werden für
              die Bereitstellung des Dienstes verarbeitet (Art. 6 Abs. 1 lit. b
              DSGVO — Vertragserfüllung).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              4. Hosting und Drittanbieter
            </h2>

            <h3 className="text-lg font-medium text-foreground mb-2">
              Vercel (Hosting)
            </h3>
            <p>
              Diese Website wird bei Vercel Inc. gehostet. Vercel verarbeitet
              Zugriffsdaten (IP-Adresse, Zeitstempel) im Rahmen der
              Bereitstellung der Website. Rechtsgrundlage: Art. 6 Abs. 1 lit. f
              DSGVO (berechtigtes Interesse an zuverlässigem Hosting).
            </p>

            <h3 className="text-lg font-medium text-foreground mb-2 mt-4">
              Supabase (Datenbank & Auth)
            </h3>
            <p>
              Für Datenbank, Authentifizierung und Dateispeicherung nutzen wir
              Supabase. Daten werden in der EU-Region gespeichert.
              Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
            </p>

            <h3 className="text-lg font-medium text-foreground mb-2 mt-4">
              Stripe (Zahlungsabwicklung)
            </h3>
            <p>
              Für die Abwicklung von Zahlungen nutzen wir Stripe. Bei einem
              Upgrade auf einen kostenpflichtigen Plan werden Zahlungsdaten
              direkt an Stripe übermittelt und dort verarbeitet. Wir speichern
              keine Kreditkartendaten. Rechtsgrundlage: Art. 6 Abs. 1 lit. b
              DSGVO (Vertragserfüllung).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              5. Ihre Rechte
            </h2>
            <p>Sie haben jederzeit das Recht auf:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Auskunft</strong> (Art. 15 DSGVO) — Welche Daten wir
                über Sie gespeichert haben.
              </li>
              <li>
                <strong>Berichtigung</strong> (Art. 16 DSGVO) — Korrektur
                unrichtiger Daten.
              </li>
              <li>
                <strong>Löschung</strong> (Art. 17 DSGVO) — Löschung Ihrer
                Daten, soweit keine gesetzliche Aufbewahrungspflicht besteht.
              </li>
              <li>
                <strong>Einschränkung der Verarbeitung</strong> (Art. 18
                DSGVO).
              </li>
              <li>
                <strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO) —
                Export Ihrer Daten in einem gängigen Format.
              </li>
              <li>
                <strong>Widerspruch</strong> (Art. 21 DSGVO) — Gegen die
                Verarbeitung Ihrer Daten.
              </li>
            </ul>
            <p className="mt-4">
              <strong>So üben Sie Ihre Rechte aus:</strong> Wenden Sie sich an
              den Administrator Ihrer Organisation. Dieser kann über den
              Admin-Bereich Ihre Daten exportieren oder Ihr Konto löschen.
              Alternativ erreichen Sie uns unter:{" "}
              <a
                href="mailto:info@link2plan.de"
                className="text-primary hover:underline"
              >
                info@link2plan.de
              </a>
            </p>
            <p>
              Wir bearbeiten Anfragen innerhalb von 30 Tagen (Art. 12 Abs. 3
              DSGVO). Sie haben zudem das Recht, sich bei einer Datenschutz-
              Aufsichtsbehörde zu beschweren.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              6. Datensicherheit
            </h2>
            <p>
              Wir verwenden SSL/TLS-Verschlüsselung für alle
              Datenübertragungen. Passwörter werden ausschließlich als
              kryptographische Hashes gespeichert. Der Zugriff auf Daten
              erfolgt über Row Level Security (RLS) — jeder Nutzer sieht nur
              die Daten seiner Organisation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              7. Auftragsverarbeitung
            </h2>
            <p>
              Mit allen Drittanbietern (Vercel, Supabase, Stripe) wurden
              Auftragsverarbeitungsverträge (AVV) gemäß Art. 28 DSGVO
              geschlossen.
            </p>
          </section>

          <section>
            <p className="text-sm">
              Stand: März 2026
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

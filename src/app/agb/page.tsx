import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Allgemeine Geschäftsbedingungen",
};

export default function AGBPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Button variant="ghost" size="sm" asChild className="mb-8">
          <Link href="/">&larr; Zurück zur Startseite</Link>
        </Button>

        <h1 className="text-3xl font-bold mb-8">
          Allgemeine Geschäftsbedingungen (AGB)
        </h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              § 1 Geltungsbereich
            </h2>
            <p>
              Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der
              Webanwendung &quot;Link2Plan&quot; (nachfolgend &quot;Dienst&quot;), bereitgestellt
              von [Firmenname] (nachfolgend &quot;Anbieter&quot;).
            </p>
            <p>
              Mit der Registrierung und Nutzung des Dienstes akzeptiert der
              Nutzer diese AGB.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              § 2 Leistungsbeschreibung
            </h2>
            <p>
              Der Dienst ermöglicht Teams die Verwaltung technischer
              PDF-Plandokumente mit folgenden Funktionen:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Upload und Anzeige von PDF-Dokumenten im Browser</li>
              <li>Setzen von Markern als klickbare Verweise zwischen PDFs</li>
              <li>Navigationshistorie zwischen verknüpften Dokumenten</li>
              <li>Team- und Projektverwaltung</li>
              <li>PDF-Versionierung und Archivierung</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              § 3 Registrierung und Nutzerkonto
            </h2>
            <p>
              Die Nutzung des Dienstes erfordert eine Registrierung. Der
              Nutzer ist verpflichtet, wahrheitsgemäße Angaben zu machen und
              seine Zugangsdaten vertraulich zu behandeln.
            </p>
            <p>
              Der Zugang wird nach Freigabe durch einen Administrator der
              jeweiligen Organisation aktiviert.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              § 4 Preise und Zahlung
            </h2>
            <p>
              Der Dienst wird in verschiedenen Tarifen angeboten (Free, Team,
              Business). Die jeweils gültigen Preise und Leistungsumfänge sind
              auf der Preisseite einsehbar.
            </p>
            <p>
              Kostenpflichtige Tarife werden monatlich im Voraus per
              Kreditkarte oder SEPA-Lastschrift über den Zahlungsdienstleister
              Stripe abgerechnet. Es gilt eine Testphase von 14 Tagen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              § 5 Kündigung
            </h2>
            <p>
              Kostenpflichtige Abonnements können jederzeit zum Ende des
              aktuellen Abrechnungszeitraums gekündigt werden. Nach Kündigung
              wird der Account auf den Free-Tarif umgestellt.
            </p>
            <p>
              Der Anbieter behält sich vor, Nutzerkonten bei Verstoß gegen
              diese AGB zu sperren oder zu kündigen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              § 6 Verfügbarkeit
            </h2>
            <p>
              Der Anbieter bemüht sich um eine hohe Verfügbarkeit des Dienstes,
              kann diese aber nicht garantieren. Wartungsarbeiten werden nach
              Möglichkeit vorab angekündigt.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              § 7 Haftung
            </h2>
            <p>
              Der Anbieter haftet unbeschränkt bei Vorsatz und grober
              Fahrlässigkeit. Bei leichter Fahrlässigkeit haftet der Anbieter
              nur bei Verletzung wesentlicher Vertragspflichten, begrenzt auf
              den vorhersehbaren, vertragstypischen Schaden.
            </p>
            <p>
              Die Haftung für Datenverlust ist auf den typischen
              Wiederherstellungsaufwand begrenzt, der bei regelmäßiger
              Datensicherung entstanden wäre.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              § 8 Datenschutz
            </h2>
            <p>
              Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer{" "}
              <Link
                href="/datenschutz"
                className="text-primary hover:underline"
              >
                Datenschutzerklärung
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              § 9 Nutzungsrechte und Inhalte
            </h2>
            <p>
              Der Nutzer behält alle Rechte an den von ihm hochgeladenen
              Dokumenten. Der Anbieter erhält lediglich das Recht, die Inhalte
              im Rahmen der Diensterbringung zu speichern und den berechtigten
              Teammitgliedern zugänglich zu machen.
            </p>
            <p>
              Der Nutzer stellt sicher, dass er zur Nutzung und zum Upload
              der Dokumente berechtigt ist.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              § 10 Schlussbestimmungen
            </h2>
            <p>
              Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand
              ist, soweit gesetzlich zulässig, der Sitz des Anbieters.
            </p>
            <p>
              Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt
              die Wirksamkeit der übrigen Bestimmungen unberührt.
            </p>
          </section>

          <section>
            <p className="text-sm">Stand: März 2026</p>
          </section>
        </div>
      </div>
    </div>
  );
}

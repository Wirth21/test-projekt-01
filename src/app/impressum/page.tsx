import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Impressum",
};

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Button variant="ghost" size="sm" asChild className="mb-8">
          <Link href="/">&larr; Zurück zur Startseite</Link>
        </Button>

        <h1 className="text-3xl font-bold mb-8">Impressum</h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">
              Angaben gemäß § 5 TMG
            </h2>
            {/* TODO: Echte Firmendaten eintragen */}
            <p className="text-muted-foreground">
              [Firmenname]
              <br />
              [Straße und Hausnummer]
              <br />
              [PLZ Ort]
              <br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Vertreten durch</h2>
            <p className="text-muted-foreground">
              [Geschäftsführer / Inhaber]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Kontakt</h2>
            <p className="text-muted-foreground">
              E-Mail: [kontakt@link2plan.app]
              <br />
              Telefon: [+49 XXX XXXXXXX]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              Registereintrag
            </h2>
            <p className="text-muted-foreground">
              Eintragung im Handelsregister.
              <br />
              Registergericht: [Amtsgericht Ort]
              <br />
              Registernummer: [HRB XXXXX]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Umsatzsteuer-ID</h2>
            <p className="text-muted-foreground">
              Umsatzsteuer-Identifikationsnummer gemäß § 27a
              Umsatzsteuergesetz:
              <br />
              [DE XXXXXXXXX]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
            </h2>
            <p className="text-muted-foreground">
              [Name]
              <br />
              [Adresse]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              Streitschlichtung
            </h2>
            <p className="text-muted-foreground">
              Die Europäische Kommission stellt eine Plattform zur
              Online-Streitbeilegung (OS) bereit:{" "}
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                https://ec.europa.eu/consumers/odr
              </a>
              .
              <br />
              <br />
              Wir sind nicht bereit oder verpflichtet, an
              Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

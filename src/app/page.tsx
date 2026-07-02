import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  FileText,
  MousePointerClick,
  History,
  Users,
  Layers,
  Archive,
  Check,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const FEATURES = [
  { key: "pdfViewer" as const, icon: FileText },
  { key: "markers" as const, icon: MousePointerClick },
  { key: "navigation" as const, icon: History },
  { key: "teams" as const, icon: Users },
  { key: "versioning" as const, icon: Layers },
  { key: "archive" as const, icon: Archive },
];

const PLANS = ["free", "team", "business"] as const;

export default async function LandingPage() {
  const t = await getTranslations("landing");

  const faqItems = t.raw("faq.items") as {
    question: string;
    answer: string;
  }[];

  const siteUrl = "https://link2plan.de";

  // Strukturierte Daten für Google (Rich Results)
  const softwareLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Link2plan",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: t("hero.subtitle"),
    url: siteUrl,
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "EUR" },
      { "@type": "Offer", name: "Team", price: "39", priceCurrency: "EUR" },
      { "@type": "Offer", name: "Business", price: "119", priceCurrency: "EUR" },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="tracking-tight">
            <Logo size="md" />
          </Link>

          <div className="hidden items-center gap-6 sm:flex">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("nav.features")}
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("nav.pricing")}
            </a>
            <a
              href="#faq"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("nav.faq")}
            </a>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">{t("nav.login")}</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:py-36">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          {t("hero.title")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          {t("hero.subtitle")}
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" asChild>
            <Link href="/register">{t("hero.cta")}</Link>
          </Button>
          <Button variant="ghost" size="lg" asChild>
            <a href="#features">{t("hero.ctaSecondary")}</a>
          </Button>
        </div>

        {/*
          Produkt-Vorschau. Platzhalter-Frame im Branding — ersetze den
          inneren Block durch einen echten Screenshot, sobald vorhanden:
          <Image src="/screenshots/app-preview.png" alt={t("hero.previewAlt")}
                 width={1280} height={720} className="w-full" priority />
        */}
        <div className="mt-16 overflow-hidden rounded-xl border bg-card text-left shadow-2xl">
          <div className="flex items-center gap-1.5 border-b bg-muted/50 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
            <span className="ml-3 text-xs text-muted-foreground">
              link2plan.de
            </span>
          </div>
          <div
            className="relative flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950"
            role="img"
            aria-label={t("hero.previewAlt")}
          >
            {/* Dekorative Marker deuten das Kernfeature an */}
            <MapPin className="absolute left-[18%] top-[28%] h-8 w-8 text-blue-400/80" />
            <MapPin className="absolute right-[24%] top-[22%] h-6 w-6 text-blue-300/70" />
            <MapPin className="absolute bottom-[26%] left-[42%] h-7 w-7 text-blue-500/80" />
            <div className="flex flex-col items-center gap-3 text-center">
              <MapPin className="h-14 w-14 text-blue-500" />
              <span className="text-sm font-medium text-slate-300">
                {t("hero.previewAlt")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("features.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            {t("features.subtitle")}
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {FEATURES.map(({ key, icon: Icon }) => (
            <Card key={key}>
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">
                  {t(`features.${key}.title`)}
                </h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t(`features.${key}.description`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section
        id="pricing"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("pricing.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            {t("pricing.subtitle")}
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const isTeam = plan === "team";
            const features = t.raw(`pricing.${plan}.features`) as string[];

            return (
              <Card
                key={plan}
                className={
                  isTeam ? "relative border-primary shadow-md" : undefined
                }
              >
                {isTeam && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Popular
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <h3 className="text-lg font-semibold">
                    {t(`pricing.${plan}.name`)}
                  </h3>
                  <div className="mt-2">
                    <span className="text-4xl font-bold">
                      {t(`pricing.${plan}.price`)}
                    </span>
                    {plan !== "free" && (
                      <span className="text-muted-foreground">
                        {t("pricing.monthly")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(`pricing.${plan}.description`)}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="mb-6 space-y-3">
                    {features.map((feature: string) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={isTeam ? "default" : "outline"}
                    className="w-full"
                    asChild
                  >
                    <Link href="/register">
                      {t(`pricing.${plan}.cta`)}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* FAQ Section */}
      <section
        id="faq"
        className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("faq.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            {t("faq.subtitle")}
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {faqItems.map((item) => (
            <div key={item.question}>
              <h3 className="font-semibold">{item.question}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("cta.title")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          {t("cta.subtitle")}
        </p>
        <div className="mt-8">
          <Button size="lg" asChild>
            <Link href="/register">{t("cta.button")}</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <Logo size="sm" />
            </div>

            <div>
              <h4 className="text-sm font-semibold">{t("footer.product")}</h4>
              <ul className="mt-3 space-y-2">
                <li>
                  <a
                    href="#features"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t("footer.features")}
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t("footer.pricing")}
                  </a>
                </li>
                <li>
                  <a
                    href="#faq"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t("footer.faq")}
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold">{t("footer.legal")}</h4>
              <ul className="mt-3 space-y-2">
                <li>
                  <a
                    href="/impressum"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t("footer.imprint")}
                  </a>
                </li>
                <li>
                  <a
                    href="/datenschutz"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t("footer.privacy")}
                  </a>
                </li>
                <li>
                  <a
                    href="/agb"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t("footer.terms")}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t pt-8">
            <p className="text-center text-sm text-muted-foreground">
              {t("footer.copyright")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

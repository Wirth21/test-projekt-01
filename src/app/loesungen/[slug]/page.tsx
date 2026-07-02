import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MousePointerClick,
  FileText,
  History,
  Layers,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { getUseCase, useCases } from "../use-cases";

const SITE_URL = "https://link2plan.de";
const SOLUTION_ICONS = [MousePointerClick, FileText, History, Layers];

export const dynamicParams = false;

export function generateStaticParams() {
  return useCases.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const uc = getUseCase(slug);
  if (!uc) return {};

  const url = `${SITE_URL}/loesungen/${uc.slug}`;
  return {
    title: uc.metaTitle,
    description: uc.metaDescription,
    alternates: { canonical: `/loesungen/${uc.slug}` },
    openGraph: {
      type: "website",
      locale: "de_DE",
      url,
      title: uc.metaTitle,
      description: uc.metaDescription,
    },
  };
}

export default async function UseCasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const uc = getUseCase(slug);
  if (!uc) notFound();

  const otherUseCases = useCases.filter((u) => u.slug !== uc.slug);

  // Strukturierte Daten für Google (Breadcrumb + FAQ)
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Start", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: uc.eyebrow,
        item: `${SITE_URL}/loesungen/${uc.slug}`,
      },
    ],
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: uc.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      {/* Header */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="tracking-tight">
            <Logo size="md" />
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Anmelden</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Kostenlos starten</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          {uc.eyebrow}
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          {uc.h1}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          {uc.heroSubtitle}
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" asChild>
            <Link href="/register">Kostenlos starten</Link>
          </Button>
          <Button variant="ghost" size="lg" asChild>
            <Link href="/#features">Alle Funktionen ansehen</Link>
          </Button>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          {uc.problemTitle}
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {uc.problems.map((item) => (
            <Card key={item.title} className="border-destructive/20">
              <CardHeader>
                <h3 className="text-lg font-semibold">{item.title}</h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Solution */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          {uc.solutionTitle}
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {uc.solutions.map((item, i) => {
            const Icon = SOLUTION_ICONS[i % SOLUTION_ICONS.length];
            return (
              <Card key={item.title}>
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          So funktioniert&apos;s
        </h2>
        <div className="mt-12 space-y-8">
          {uc.steps.map((item, i) => (
            <div key={item.title} className="flex gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                {i + 1}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Häufige Fragen
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {uc.faq.map((item) => (
            <div key={item.question}>
              <h3 className="flex items-start gap-2 font-semibold">
                <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                {item.question}
              </h3>
              <p className="mt-2 pl-6 text-sm text-muted-foreground">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {uc.ctaTitle}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          {uc.ctaSubtitle}
        </p>
        <div className="mt-8">
          <Button size="lg" asChild>
            <Link href="/register">Kostenlos starten</Link>
          </Button>
        </div>
      </section>

      {/* Weitere Lösungen — interne Verlinkung */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-xl font-semibold">Weitere Lösungen</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {otherUseCases.map((other) => (
            <Link
              key={other.slug}
              href={`/loesungen/${other.slug}`}
              className="group flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <span className="font-medium">{other.eyebrow}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center sm:px-6">
          <Logo size="sm" />
          <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Startseite
            </Link>
            <Link href="/impressum" className="hover:text-foreground">
              Impressum
            </Link>
            <Link href="/datenschutz" className="hover:text-foreground">
              Datenschutz
            </Link>
            <Link href="/agb" className="hover:text-foreground">
              AGB
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

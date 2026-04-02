import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { CookieConsent } from "@/components/CookieConsent";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Link2Plan — Technische PDF-Pläne verwalten und verknüpfen",
    template: "%s | Link2Plan",
  },
  description:
    "Link2Plan verbindet technische PDF-Pläne mit intelligenten Markern. Teams navigieren per Klick zwischen Grundrissen, Schnitten und Details.",
  manifest: "/manifest.json",
  metadataBase: new URL("https://link2plan.de"),
  openGraph: {
    type: "website",
    locale: "de_DE",
    alternateLocale: "en_US",
    siteName: "Link2Plan",
    title: "Link2Plan — Technische PDF-Pläne verwalten und verknüpfen",
    description:
      "Verbinde technische PDF-Pläne mit intelligenten Markern. Dein Team navigiert per Klick zwischen Grundrissen, Schnitten und Details.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Link2Plan",
    description:
      "Technische PDF-Pläne verwalten und verknüpfen — mit intelligenten Markern und Team-Zusammenarbeit.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Link2Plan",
  },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head />
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
          <CookieConsent />
        </NextIntlClientProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js');
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

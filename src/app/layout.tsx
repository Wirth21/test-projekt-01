import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlanLink",
  description: "Technische PDF-Pläne verwalten und verknüpfen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

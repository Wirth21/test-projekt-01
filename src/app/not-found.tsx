import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  const tc = await getTranslations("common");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold mb-2">{t("title")}</h1>
        <h2 className="text-xl font-semibold mb-4">{t("heading")}</h2>
        <p className="text-muted-foreground mb-8">
          {t("description")}
        </p>
        <Link
          href="https://link2plan.de"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {tc("toStartPage")}
        </Link>
      </div>
    </div>
  );
}

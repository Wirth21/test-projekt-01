import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <h2 className="text-xl font-semibold mb-4">Organisation nicht gefunden</h2>
        <p className="text-muted-foreground mb-8">
          Die aufgerufene Adresse konnte keiner Organisation zugeordnet werden.
          Bitte prüfe die URL oder wende dich an deinen Administrator.
        </p>
        <Link
          href="https://link2plan.app"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}

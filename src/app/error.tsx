"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { captureException } from "@/lib/sentry";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold mb-2">Fehler</h1>
        <h2 className="text-xl font-semibold mb-4">
          Etwas ist schiefgelaufen
        </h2>
        <p className="text-muted-foreground mb-8">
          Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
        </p>
        <Button onClick={reset}>Erneut versuchen</Button>
      </div>
    </div>
  );
}

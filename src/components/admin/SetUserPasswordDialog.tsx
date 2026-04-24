"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, RefreshCw, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface SetUserPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userDisplayName: string;
  userEmail: string;
}

function generateStrongPassword(): string {
  // 16 chars: lowercase + uppercase + digits + safe symbols. Rejects to
  // be regenerated if the result doesn't satisfy the min-rules check.
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!?$%&*+";
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => chars[n % chars.length]).join("");
}

function passesServerRules(pw: string): boolean {
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

export function SetUserPasswordDialog({
  open,
  onOpenChange,
  userId,
  userDisplayName,
  userEmail,
}: SetUserPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setReveal(false);
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  function handleGenerate() {
    // Retry a few times in case random chars don't produce a letter+digit.
    for (let i = 0; i < 5; i++) {
      const pw = generateStrongPassword();
      if (passesServerRules(pw)) {
        setPassword(pw);
        setReveal(true);
        return;
      }
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("In Zwischenablage kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!passesServerRules(password)) {
      setError(
        "Passwort zu schwach — mindestens 8 Zeichen mit Buchstabe und Ziffer."
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? "Passwort konnte nicht gesetzt werden");
      }
      setSuccess(true);
      toast.success(`Passwort fuer ${userDisplayName || userEmail} gesetzt`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Passwort für {userDisplayName || userEmail} setzen</DialogTitle>
          <DialogDescription>
            Du setzt das Passwort direkt ohne Bestätigung des Nutzers.
            Teile es über einen sicheren Kanal mit und fordere den Nutzer auf,
            es bei der nächsten Anmeldung zu ändern.
          </DialogDescription>
        </DialogHeader>

        {!success ? (
          <>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-admin-password">Neues Passwort</Label>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Input
                      id="new-admin-password"
                      type={reveal ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={saving}
                      autoComplete="new-password"
                      aria-describedby="new-admin-password-hint"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-7 w-7 p-0"
                      onClick={() => setReveal((r) => !r)}
                      disabled={saving}
                      aria-label={reveal ? "Passwort verbergen" : "Passwort anzeigen"}
                    >
                      {reveal ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={saving}
                    title="Starkes Passwort generieren"
                    aria-label="Starkes Passwort generieren"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    disabled={!password || saving}
                    title="Passwort kopieren"
                    aria-label="Passwort kopieren"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p
                  id="new-admin-password-hint"
                  className="text-xs text-muted-foreground"
                >
                  Mindestens 8 Zeichen mit Buchstabe + Ziffer.
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !password}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Passwort setzen
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
              <p className="font-medium text-foreground">
                Passwort gesetzt.
              </p>
              <p>
                Übergib es dem Nutzer über einen sicheren Kanal. Aus
                Sicherheitsgründen wird es hier nur solange angezeigt, bis
                du den Dialog schließt.
              </p>
              <div className="flex items-center gap-2 rounded bg-background border p-2 font-mono text-xs break-all">
                {reveal ? password : "••••••••••••"}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={() => setReveal((r) => !r)}
                  aria-label={reveal ? "Passwort verbergen" : "Passwort anzeigen"}
                >
                  {reveal ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={handleCopy}
                  aria-label="Passwort kopieren"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Schließen</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

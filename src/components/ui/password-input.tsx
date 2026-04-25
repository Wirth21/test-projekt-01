"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PasswordInputProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Input>, "type"> {
  /** Override the toggle button's accessible label. */
  toggleAriaLabel?: string;
}

/**
 * Password field with a built-in show/hide toggle. Behaves like a normal
 * shadcn `<Input>` — pass any of the same props (value, onChange, disabled,
 * autoComplete, …). The toggle button sits on the right edge.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, toggleAriaLabel, disabled, ...props }, ref) {
    const [visible, setVisible] = React.useState(false);
    const Icon = visible ? EyeOff : Eye;

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          disabled={disabled}
          // Reserve space on the right for the toggle button.
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={
            toggleAriaLabel ??
            (visible ? "Passwort verbergen" : "Passwort anzeigen")
          }
          aria-pressed={visible}
          className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <Icon className="h-4 w-4" />
        </button>
      </div>
    );
  }
);

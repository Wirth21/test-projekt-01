"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { TenantRole } from "@/lib/types/admin";

export type UserContextValue = {
  userId: string;
  tenantId: string;
  tenantRole: TenantRole;
  isAdmin: boolean;
  isReadOnly: boolean;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({
  value,
  children,
}: {
  value: UserContextValue;
  children: ReactNode;
}) {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const v = useContext(UserContext);
  if (!v) throw new Error("useUser must be used inside <UserProvider>");
  return v;
}

"use client";

import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/auth/use-sign-out";

export function LogoutButton() {
  const { signOut, isPending, error } = useSignOut({
    redirectTo: "/auth/login",
    refresh: true,
  });

  return (
    <Button onClick={signOut} disabled={isPending}>
      {isPending ? "Logging out..." : "Logout"}
      {error && <span className="ml-2 text-xs text-destructive">Error</span>}
    </Button>
  );
}

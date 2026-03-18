"use client";

import { useEffect, useState } from "react";
import { UpdatePasswordForm } from "@/components/update-password-form";
import { createClient } from "@/lib/supabase/client";
import { initPasswordLinkSession } from "@/lib/auth/password-link";

export default function ResetPasswordPage() {
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function initSession() {
      try {
        const errorMessage = await initPasswordLinkSession({
          supabase,
          expectedType: "recovery",
        });
        setSessionError(errorMessage);
      } catch {
        setSessionError("No se pudo validar la sesión de recuperación.");
      } finally {
        setIsSessionReady(true);
      }
    }

    void initSession();
  }, []);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-muted/40">
      <div className="w-full max-w-lg">
        <UpdatePasswordForm
          isSessionReady={isSessionReady}
          sessionError={sessionError}
        />
      </div>
    </div>
  );
}

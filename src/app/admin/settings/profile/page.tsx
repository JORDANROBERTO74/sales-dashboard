import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/require-auth";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { Button } from "@/components/ui/button";

export default async function ProfileSettingsPage() {
  await requireAuth({
    redirectTo: "/auth/login",
  });

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link href="/admin/settings" aria-label="Volver a configuración">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">Mi perfil</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Administra tu información personal y preferencias de cuenta.
        </p>
      </div>
      <ProfileSettingsForm />
    </div>
  );
}

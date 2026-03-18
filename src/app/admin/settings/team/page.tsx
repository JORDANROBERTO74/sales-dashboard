import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAnyRole } from "@/lib/auth/require-auth";
import { UserRole } from "@/lib/auth/permissions";
import { TeamSettingsPanel } from "@/components/settings/team-settings-panel";
import { Button } from "@/components/ui/button";

export default async function TeamSettingsPage() {
  await requireAnyRole([UserRole.OWNER, UserRole.ADMIN], {
    redirectTo: "/auth/login",
    unauthorizedRedirectTo: "/auth/unauthorized",
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
          <h1 className="text-xl md:text-2xl font-bold">Equipo</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Gestiona invitaciones, roles y estado activo del equipo.
        </p>
      </div>
      <TeamSettingsPanel />
    </div>
  );
}

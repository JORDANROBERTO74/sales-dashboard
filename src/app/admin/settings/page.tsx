import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireAnyRole } from "@/lib/auth/require-auth";
import { hasAnyRole, UserRole } from "@/lib/auth/permissions";
import {
  SETTINGS_ALLOWED_ROLES,
  SETTINGS_SECTIONS,
} from "@/lib/settings/constants";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminSettingsPage() {
  const user = await requireAnyRole(SETTINGS_ALLOWED_ROLES, {
    redirectTo: "/auth/login",
    unauthorizedRedirectTo: "/auth/unauthorized",
  });

  const sections = SETTINGS_SECTIONS.filter((section) =>
    hasAnyRole(
      {
        ...user,
        role: (user.role as UserRole | null) ?? null,
      },
      section.requiredRoles,
    ),
  );

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl md:text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona equipo y métodos de pago según tu rol operativo.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.key}>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <CardTitle>{section.title}</CardTitle>
                <Badge variant="secondary">{section.accessLabel}</Badge>
              </div>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={section.href}>
                  Abrir sección
                  <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

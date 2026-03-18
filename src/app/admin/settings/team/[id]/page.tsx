import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAnyRole } from "@/lib/auth/require-auth";
import { UserRole } from "@/lib/auth/permissions";
import { MemberDetail } from "@/components/settings/member-detail";
import { Button } from "@/components/ui/button";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TeamMemberDetailPage({ params }: PageProps) {
  await requireAnyRole([UserRole.OWNER, UserRole.ADMIN], {
    redirectTo: "/auth/login",
    unauthorizedRedirectTo: "/auth/unauthorized",
  });

  const { id } = await params;

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link href="/admin/settings/team" aria-label="Volver a equipo">
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">Detalle de miembro</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Ajusta permisos operativos y estado de la cuenta del miembro.
        </p>
      </div>

      <MemberDetail memberId={id} />
    </div>
  );
}

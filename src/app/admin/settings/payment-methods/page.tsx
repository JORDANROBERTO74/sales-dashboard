import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAnyRole } from "@/lib/auth/require-auth";
import { UserRole } from "@/lib/auth/permissions";
import { PaymentMethodsPanel } from "@/components/settings/payment-methods/panel";
import { Button } from "@/components/ui/button";

const PAYMENT_METHODS_ALLOWED_ROLES = [UserRole.OWNER, UserRole.ADMIN, UserRole.SELLER];

export default async function PaymentMethodsSettingsPage() {
  await requireAnyRole(PAYMENT_METHODS_ALLOWED_ROLES, {
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
          <h1 className="text-xl md:text-2xl font-bold">Métodos de pago</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Configura tus cuentas para recibir pagos y retiros de comisiones.
        </p>
      </div>
      <PaymentMethodsPanel />
    </div>
  );
}

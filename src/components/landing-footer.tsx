import Link from "next/link";
import { Building2 } from "lucide-react";
import { BRAND } from "@/config/brand";

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-background">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 md:grid-cols-3">
        <div className="space-y-3">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg shadow-sm">
              <Building2 className="size-4" />
            </div>
            <span>{BRAND.appName}</span>
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">
            Operacion centralizada de transacciones Stripe, comisiones,
            balances y retiros para equipos de ventas.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Accesos</p>
          <nav
            className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm"
            aria-label="Enlaces del pie"
          >
            <div className="min-w-0 space-y-2">
              <div className="flex flex-col gap-2">
                <Link
                  href="/services"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Servicios y pagos
                </Link>
                <Link
                  href="/payment-methods"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Métodos de pago
                </Link>
                <Link
                  href="/payment-methods/binance"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Tutorial Binance
                </Link>
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-col gap-2">
                <Link
                  href="/auth/login"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/admin/dashboard"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/transactions"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Transacciones
                </Link>
                <Link
                  href="/admin/balances/payouts"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Retiros
                </Link>
              </div>
            </div>
          </nav>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Enfoque del producto</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Asignacion de ventas por seller</li>
            <li>Calculo de comisiones por transaccion</li>
            <li>Trazabilidad de payouts y balances</li>
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-xs text-muted-foreground">
          <p>Copyright {year} {BRAND.appName}.</p>
          <p>Built for Stripe operations.</p>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { Home, LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative flex min-h-[min(100svh,900px)] w-full flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-background to-muted/50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[min(100%,42rem)] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl dark:bg-primary/[0.12]"
      />
      <p
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[clamp(8rem,28vw,16rem)] font-bold leading-none tracking-tighter text-foreground/[0.04] dark:text-foreground/[0.07]"
      >
        404
      </p>

      <div className="relative z-10 flex max-w-lg flex-col items-center text-center">
        <Badge variant="secondary" className="mb-6 rounded-full px-3">
          J-Node Sales
        </Badge>

        <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          Página no encontrada
        </h1>
        <p className="mt-3 text-pretty text-muted-foreground md:text-lg">
          La ruta que buscas no existe o fue movida. Revisa la URL o vuelve al
          inicio para seguir navegando.
        </p>

        <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/">
              <Home className="size-4" />
              Ir al inicio
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/admin/dashboard">
              <LayoutDashboard className="size-4" />
              Panel admin
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

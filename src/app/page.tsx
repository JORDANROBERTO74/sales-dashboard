"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BanknoteArrowDown,
  CircleDollarSign,
  CreditCard,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Lock,
  RefreshCcw,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "@/hooks/auth/use-user";
import { BRAND } from "@/config/brand";

const stackItems = [
  { label: "Origen de datos", value: "Transacciones de Stripe centralizadas" },
  { label: "Asignaciones", value: "Ventas reclamadas y trazables por seller" },
  { label: "Comisiones", value: "Calculo por transaccion y tasa de usuario" },
  { label: "Retiros", value: "Control de saldo disponible y payouts" },
];

const capabilityItems = [
  {
    title: "Transacciones en tiempo real",
    description:
      "Consolida cobros de Stripe por cuenta, estado y fecha para operar con datos actualizados.",
    icon: Activity,
  },
  {
    title: "Asignacion de ventas",
    description:
      "Asigna cada transaccion a un seller y mantiene historial claro de ownership comercial.",
    icon: Users,
  },
  {
    title: "Comisiones auditables",
    description:
      "Calcula neto, comision y estado por operacion para seguimiento financiero sin friccion.",
    icon: HandCoins,
  },
  {
    title: "Saldos y retiros",
    description:
      "Visualiza disponible para payout, pendientes y retiros completados por seller.",
    icon: Wallet,
  },
];

const flowItems = [
  {
    name: "1. Ingesta de cobros",
    detail:
      "Los eventos de Stripe alimentan la capa de transacciones con monto, fee, neto y metadata.",
    icon: CircleDollarSign,
  },
  {
    name: "2. Asignacion comercial",
    detail:
      "Cada venta se asigna al seller correspondiente para gobernar ownership y comision.",
    icon: Users,
  },
  {
    name: "3. Comision y balance",
    detail:
      "El sistema consolida comisiones ganadas, saldos pendientes y disponible para retiro.",
    icon: RefreshCcw,
  },
  {
    name: "4. Ejecucion de payouts",
    detail:
      "Admin gestiona retiros con trazabilidad de estado y evidencia operativa por transaccion.",
    icon: BanknoteArrowDown,
  },
];

const roleItems = [
  {
    role: "Admin / Owner",
    detail:
      "Supervision global de transacciones, asignaciones, comisiones y retiros.",
  },
  {
    role: "Seller",
    detail:
      "Visibilidad de ventas asignadas, comision acumulada y saldo disponible para payout.",
  },
  {
    role: "Analyst / Viewer",
    detail:
      "Monitoreo de KPIs operativos sin exponer acciones criticas de administracion.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const { data: userProfile } = useUser();

  useEffect(() => {
    // Redirige tokens de invitacion/recuperacion a sus flujos dedicados.
    const hash = window.location.hash;
    const queryParams = new URLSearchParams(window.location.search);
    const tokenHash = queryParams.get("token_hash");
    const queryType = queryParams.get("type");

    if (hash) {
      const params = new URLSearchParams(hash.slice(1));
      const type = params.get("type");
      const hasAccessToken = params.has("access_token");
      const hasRefreshToken = params.has("refresh_token");
      const hasAuthPayload = hasAccessToken || hasRefreshToken;

      if (hasAuthPayload && type === "invite") {
        router.replace(`/auth/invite-password${hash}`);
        return;
      }

      if (hasAuthPayload && type === "recovery") {
        router.replace(`/auth/update-password${hash}`);
        return;
      }
    }

    if (tokenHash && queryType === "invite") {
      router.replace(`/auth/invite-password${window.location.search}`);
      return;
    }

    if (tokenHash && queryType === "recovery") {
      router.replace(`/auth/update-password${window.location.search}`);
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 md:py-24">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="rounded-full px-3">
            {BRAND.appName}
          </Badge>
        </div>

        <div className="space-y-4">
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
            Gestiona Stripe, comisiones y retiros en un solo lugar.
          </h1>
          <p className="max-w-3xl text-lg text-muted-foreground md:text-xl">
            {BRAND.appName} esta disenada para operaciones comerciales reales:
            asignacion de transacciones, calculo de comisiones por seller,
            control de balances y ejecucion de payouts con trazabilidad.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/admin/dashboard">
              Ver dashboard
              <ArrowRight />
            </Link>
          </Button>
          {!userProfile && (
            <Button asChild variant="outline" size="lg">
              <Link href="/auth/login">
                Iniciar sesion
                <Lock />
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="lg" className="min-h-11">
            <Link href="/services">
              <CreditCard className="size-4" />
              Servicios y pagos
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-h-11">
            <Link href="/payment-methods">
              <Landmark className="size-4" />
              Métodos de pago
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-6 pb-12 md:grid-cols-2 lg:grid-cols-4">
        {stackItems.map((item) => (
          <Card key={item.label} className="gap-3">
            <CardHeader className="gap-1">
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-base">{item.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-12">
        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-2">
            <CreditCard className="size-5 text-primary" />
            <h2 className="text-2xl font-semibold">Pagos y guías públicas</h2>
          </div>
          <p className="max-w-3xl text-muted-foreground">
            Accede sin iniciar sesión a los enlaces de cobro con Stripe y a las
            guías para configurar métodos de pago y retiro en la aplicación.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="size-5 text-primary" />
                Servicios y enlaces de pago
              </CardTitle>
              <CardDescription>
                Catálogo de servicios con precios y enlaces de Payment Links de
                Stripe: paga en una pestaña nueva o copia el enlace para
                compartirlo.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild variant="default">
                <Link href="/services">
                  Ir a servicios y pagos
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Landmark className="size-5 text-primary" />
                Tutoriales de métodos de pago
              </CardTitle>
              <CardDescription>
                Guías paso a paso para configurar Binance, Airtm y Banco QR y
                reducir errores al habilitar pagos y retiros.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex flex-wrap gap-2">
              <Button asChild variant="default">
                <Link href="/payment-methods">
                  Ver índice de tutoriales
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/payment-methods/binance">Empezar con Binance</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center gap-2">
          <LayoutDashboard className="size-5 text-primary" />
          <h2 className="text-2xl font-semibold">Capacidades clave</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {capabilityItems.map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <item.icon className="size-5 text-primary" />
                  {item.title}
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h2 className="text-2xl font-semibold">Flujo operativo</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {flowItems.map((flow) => (
            <Card key={flow.name}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <flow.icon className="size-5 text-primary" />
                  {flow.name}
                </CardTitle>
                <CardDescription>{flow.detail}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Users className="size-5 text-primary" />
          <h2 className="text-2xl font-semibold">Valor por rol</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {roleItems.map((item) => (
            <Card key={item.role}>
              <CardHeader>
                <CardTitle>{item.role}</CardTitle>
                <CardDescription>{item.detail}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Comienza la operacion</CardTitle>
            <CardDescription>
              Accede al dashboard para monitorear KPIs y gestiona el ciclo
              completo: transaccion, asignacion, comision y retiro.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/admin/transactions">
                  Ver transacciones
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/admin/balances/payouts">Gestionar retiros</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/settings">Configurar equipo y tasas</Link>
              </Button>
            </div>
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm text-muted-foreground">
                ¿Solo necesitas pagar un servicio o configurar métodos de pago?
                Estas páginas son públicas.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline" className="min-h-11">
                  <Link href="/services">
                    <CreditCard className="size-4" />
                    Servicios y pagos
                  </Link>
                </Button>
                <Button asChild variant="outline" className="min-h-11">
                  <Link href="/payment-methods">
                    <Landmark className="size-4" />
                    Métodos de pago
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

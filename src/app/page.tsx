"use client";

import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  LayoutDashboard,
  Lock,
  Puzzle,
  Route,
  ShieldCheck,
  Sparkles,
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

const stackItems = [
  { label: "Plataforma", value: "Aplicación web modular" },
  { label: "Interfaz", value: "Panel responsivo para operación diaria" },
  { label: "Datos", value: "Sincronización de cobros y ventas" },
  { label: "Validación", value: "Formularios con reglas de negocio" },
];

const architectureItems = [
  {
    title: "App Router por dominio",
    description:
      "Rutas separadas en ecommerce, admin, auth y settings para facilitar escalabilidad.",
    icon: Route,
  },
  {
    title: "Auth centralizado",
    description:
      "La plataforma maneja sesión y usuarios, con middleware para proteger áreas privadas.",
    icon: ShieldCheck,
  },
  {
    title: "UI reutilizable",
    description:
      "Componentes base en UI y wrappers de negocio para mantener consistencia visual.",
    icon: Puzzle,
  },
  {
    title: "Datos preparados para evolución",
    description:
      "Capas `hooks` y `lib` listas para migrar de mock data a integración real de pagos.",
    icon: Boxes,
  },
];

const moduleItems = [
  {
    name: "Ecommerce",
    detail: "Catálogo, producto, carrito, checkout, categorías y ofertas.",
  },
  {
    name: "Admin",
    detail:
      "Dashboard, pedidos, productos, inventario y configuración operativa.",
  },
  {
    name: "Auth",
    detail:
      "Login, registro, recuperación, actualización y confirmación de email.",
  },
  {
    name: "Settings",
    detail: "Gestión de equipo y métodos de pago para operaciones internas.",
  },
];

export default function HomePage() {
  const router = useRouter();

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
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            J-Node Sales
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            Administrador de cobros y ventas
          </Badge>
        </div>

        <div className="space-y-4">
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
            Plataforma de ventas preparada para escalar en ecommerce y operación
            interna.
          </h1>
          <p className="max-w-3xl text-lg text-muted-foreground md:text-xl">
            Este proyecto combina experiencia de usuario, administración y
            seguridad en una sola arquitectura moderna. Está diseñado para
            evolucionar de entorno mock a integraciones reales sin romper la
            estructura base.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/admin/dashboard">
              Ver dashboard
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/login">
              Ir a autenticación
              <Lock />
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

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center gap-2">
          <LayoutDashboard className="size-5 text-primary" />
          <h2 className="text-2xl font-semibold">Arquitectura del proyecto</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {architectureItems.map((item) => (
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
          <Sparkles className="size-5 text-primary" />
          <h2 className="text-2xl font-semibold">Módulos principales</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {moduleItems.map((module) => (
            <Card key={module.name}>
              <CardHeader>
                <CardTitle>{module.name}</CardTitle>
                <CardDescription>{module.detail}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Siguiente paso recomendado</CardTitle>
            <CardDescription>
              Integrar la capa de pagos real y mover progresivamente la data
              mock a servicios productivos, manteniendo el mismo contrato de
              hooks y componentes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/admin/settings">
                Gestionar settings
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/admin/orders">Explorar operaciones</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

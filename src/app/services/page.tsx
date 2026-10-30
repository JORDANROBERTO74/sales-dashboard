import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  CreditCard,
  Home,
  MousePointerClick,
  Share2,
} from "lucide-react";
import { StripePaymentLinkCard } from "@/components/services/stripe-payment-link-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActiveStripePaymentLinks } from "@/data/stripe-payment-links";
import { BRAND } from "@/config/brand";

export const metadata: Metadata = {
  title: `Servicios y pagos | ${BRAND.appName}`,
  description: `Enlaces de pago seguros con Stripe para contratar servicios profesionales.`,
};

const howItWorks = [
  {
    title: "Elige un servicio",
    description:
      "Revisa el nombre, la descripción y el precio (USD o BOB según el servicio).",
    icon: MousePointerClick,
  },
  {
    title: "Paga o comparte",
    description:
      "Entra a Stripe para pagar con tarjeta, o copia el enlace y envíalo a quien deba completar el pago.",
    icon: Share2,
  },
  {
    title: "Confirmación",
    description:
      "Stripe te mostrará el comprobante; conserva el correo de confirmación para tu registro.",
    icon: ClipboardList,
  },
] as const;

export default function ServicesPage() {
  const links = getActiveStripePaymentLinks();

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 md:py-24">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="rounded-full px-3 py-1">
            Pagos con Stripe
          </Badge>
        </div>

        <div className="space-y-4">
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
            Servicios y enlaces de pago
          </h1>
          <p className="max-w-3xl text-lg text-muted-foreground md:text-xl">
            Contrata en pocos clics: los servicios aparecen ordenados de menor a
            mayor precio. Abre el checkout en Stripe o comparte el enlace. La
            mayoría de precios están en USD; uno puede mostrarse en BOB según la
            configuración del enlace en Stripe.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="lg" className="min-h-11">
            <Link href="/">
              <Home className="size-4" />
              Volver al inicio
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-h-11">
            <Link href="/payment-methods">
              Métodos de pago
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-10">
        <h2 className="sr-only">Cómo funciona</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {howItWorks.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title}>
                <Card className="h-full border-muted-foreground/15">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </span>
                      <Icon className="size-5 text-muted-foreground" aria-hidden />
                      <CardTitle className="text-base">{step.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {step.description}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-12">
        <h2 className="mb-4 text-lg font-semibold tracking-tight md:text-xl">
          Catálogo de enlaces
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {links.map((item) => (
            <StripePaymentLinkCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              Sobre los cobros
            </CardTitle>
            <CardDescription>
              Los pagos se procesan de forma segura a través de Stripe. Los
              precios se muestran en USD cuando están configurados en el código;
              impuestos o cargos adicionales pueden aplicarse según la
              configuración de tu enlace en Stripe y el país del pagador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/">
                Volver al inicio
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

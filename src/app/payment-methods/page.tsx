import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Landmark, QrCode, Settings2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PAYMENT_METHOD_TUTORIAL_LIST } from "@/components/payment-methods/tutorial-data";

export const metadata: Metadata = {
  title: "Metodos de pago | J-Node Sales",
  description:
    "Guia publica para configurar Binance, Airtm y Banco QR en J-Node Sales.",
};

const tutorialIcons = {
  binance: Wallet,
  airtm: Landmark,
  "banco-qr": QrCode,
} as const;

export default function PaymentMethodsTutorialIndexPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 md:py-24">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="rounded-full px-3 py-1">
            Tutoriales publicos
          </Badge>
        </div>

        <div className="space-y-4">
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
            Metodos de pago: tutoriales de configuracion
          </h1>
          <p className="max-w-3xl text-lg text-muted-foreground md:text-xl">
            Elige el metodo que deseas configurar y sigue una guia paso a paso para
            reducir errores al momento de habilitar pagos y retiros.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/admin/settings/payment-methods">
              Configurar en settings
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">
              Volver al inicio
              <Settings2 />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-12">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PAYMENT_METHOD_TUTORIAL_LIST.map((tutorial) => {
            const Icon = tutorialIcons[tutorial.key];
            return (
              <Card key={tutorial.key}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="size-5 text-primary" />
                    {tutorial.name}
                  </CardTitle>
                  <CardDescription>{tutorial.shortDescription}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <Badge variant="outline">Guia practica</Badge>
                  <Button asChild variant="outline">
                    <Link href={tutorial.path}>
                      Ver tutorial
                      <ArrowRight />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Recomendacion operativa</CardTitle>
            <CardDescription>
              Antes de marcar un metodo como predeterminado, valida los datos con
              una prueba interna para prevenir rechazos y retrabajo del equipo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/admin/settings/payment-methods">
                Ir a metodos de pago
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/payment-methods/binance">Comenzar por Binance</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

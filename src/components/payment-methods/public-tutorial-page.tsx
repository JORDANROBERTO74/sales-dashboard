import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Smartphone,
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

type TutorialError = {
  title: string;
  description: string;
};

type MobileGuideSection = {
  title: string;
  steps: string[];
};

type TutorialSourceLink = {
  label: string;
  url: string;
};

type PublicTutorialPageProps = {
  methodName: string;
  methodDescription: string;
  methodPath: string;
  prerequisites: string[];
  mobilePrerequisiteSteps: MobileGuideSection[];
  jnodeFieldGuide: string[];
  mobileNotes?: string[];
  sourceLinks?: TutorialSourceLink[];
  steps: string[];
  commonErrors: TutorialError[];
  tips?: string[];
};

export function PublicTutorialPage({
  methodName,
  methodDescription,
  methodPath,
  prerequisites,
  mobilePrerequisiteSteps,
  jnodeFieldGuide,
  mobileNotes = [],
  sourceLinks = [],
  steps,
  commonErrors,
  tips = [],
}: PublicTutorialPageProps) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 md:py-24">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="rounded-full px-3 py-1">
            Tutorial de metodo de pago
          </Badge>
        </div>

        <div className="space-y-4">
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
            Configuracion de {methodName}
          </h1>
          <p className="max-w-3xl text-lg text-muted-foreground md:text-xl">
            {methodDescription}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="lg">
            <Link href="/payment-methods">
              <ArrowLeft />
              Volver a metodos de pago
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/admin/settings/payment-methods">
              Configurar ahora
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-6 pb-8 md:grid-cols-2">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              Prerequisitos
            </CardTitle>
            <CardDescription>
              Asegura esta informacion antes de iniciar en
              {" "}
              <span className="font-medium">{methodName}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {prerequisites.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 size-1.5 rounded-full bg-primary" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Paso a paso</CardTitle>
            <CardDescription>
              Sigue esta secuencia para guardar correctamente tu metodo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm text-muted-foreground">
              {steps.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-4 flex items-center gap-2">
          <Smartphone className="size-5 text-primary" />
          <h2 className="text-2xl font-semibold">Obtener prerequisitos desde tu movil</h2>
        </div>
        <div className={`grid gap-4 ${mobilePrerequisiteSteps.length > 2 ? "md:grid-cols-3 lg:grid-cols-3" : "md:grid-cols-2"}`}>
          {mobilePrerequisiteSteps.map((section) => (
            <Card key={section.title}>
              <CardHeader className="gap-1">
                <CardTitle className="text-base">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  {section.steps.map((step, index) => (
                    <li key={step} className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-8">
        <Card>
          <CardHeader>
            <CardTitle>Como pegar los datos en la aplicacion</CardTitle>
            <CardDescription>
              Esta guia conecta los datos del proveedor con los campos del formulario en settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {jnodeFieldGuide.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 size-1.5 rounded-full bg-primary" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="size-5 text-primary" />
          <h2 className="text-2xl font-semibold">Errores comunes</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {commonErrors.map((error) => (
            <Card key={error.title}>
              <CardHeader className="gap-1">
                <CardTitle className="text-base">{error.title}</CardTitle>
                <CardDescription>{error.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Listo para configurar {methodName}</CardTitle>
            <CardDescription>
              Cuando tengas los datos validados, vuelve a settings y completa el formulario.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/admin/settings/payment-methods">
                Ir a configuracion
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={methodPath}>Recargar este tutorial</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {tips.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-6 pb-12">
          <Card>
            <CardHeader>
              <CardTitle>Buenas practicas recomendadas</CardTitle>
              <CardDescription>
                Recomendaciones para reducir rechazos y errores operativos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {tips.map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <span className="mt-1 size-1.5 rounded-full bg-primary" aria-hidden />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {(mobileNotes.length > 0 || sourceLinks.length > 0) ? (
        <section className="mx-auto w-full max-w-6xl px-6 pb-12">
          <Card>
            <CardHeader>
              <CardTitle>Fuentes y vigencia</CardTitle>
              <CardDescription>
                Revisa estas fuentes oficiales y verifica cambios de interfaz en las apps moviles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mobileNotes.length > 0 ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {mobileNotes.map((note) => (
                    <li key={note} className="flex items-start gap-2">
                      <span className="mt-1 size-1.5 rounded-full bg-primary" aria-hidden />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {sourceLinks.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {sourceLinks.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"
                      >
                        {source.label}
                        <ExternalLink className="size-4" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </main>
  );
}
